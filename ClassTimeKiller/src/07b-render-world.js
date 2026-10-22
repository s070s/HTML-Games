// Static world (REN-001, REN-004): on 'world.load' every convex brush is turned into face polygons from its planes,
// cut on a world-aligned grid, lit on the CPU (hemisphere ambient + baked AO + sun with shadow rays + map lights),
// and merged into one vertex buffer with one draw range per 16 m chunk. Materials are a per-vertex index into a
// uniform table (one draw per chunk instead of one per chunk and material). Also the procedural sky.

const CHUNK_METERS = 16;
const BAKE_CELL_MIN = 2;                 // metres between lighting samples on big faces
const BAKE_CELL_MAX = 6;
const BAKE_CELLS_ACROSS = 60;            // bigger maps use bigger cells so the vertex count stays bounded
const BRUSH_GRID_METERS = 8;             // bake-time lookup grid for nearby brushes
const FACE_EPSILON = 0.02;
const MIN_PIECE_AREA = 1e-4;             // square metres
const AO_DISTANCES = [0.35, 0.9];
const AO_STRENGTH = 0.6;
const SUN_RAY_METERS = 300;
const SUN_GRID_METERS = 4;               // coarse sun-visibility grid for moving objects
const SUN_GRID_MAX_CELLS = 32768;
const MAX_MATERIALS = 32;
const MATERIAL_PATTERNS = ['noise', 'panels', 'tiles', 'planks', 'bricks', 'stripes', 'glow', 'grid', 'flat'];
const WORLD_VERTEX_BYTES = 24;           // position 3 x f32 | normal + material 4 x i8 | light rgb + AO 4 x u8 | sun 4 x u8
const WORLD_ATTRIBUTES = { aPosition: 0, aNormal: 1, aLight: 2, aExtra: 3 };
const BAKE_VALUES_PER_VERTEX = 12;     // x y z nx ny nz material r g b ao sun while building

const WorldMesh = {
  chunks: [],              // { minX, minY, minZ, maxX, maxY, maxZ, offset (bytes into the index buffer), count }
  vertexBytes: null, indexData: null, vertexCount: 0, triangles: 0,
  vertexBuffer: null, indexBuffer: null, vertexArray: null, indexType: 0,
  theme: null,
  materialIndex: new Map(),
  materialA: new Float32Array(MAX_MATERIALS * 3), materialB: new Float32Array(MAX_MATERIALS * 3), materialParams: new Float32Array(MAX_MATERIALS * 4),
  skyTop: new Float32Array(3), skyHorizon: new Float32Array(3), fogScale: 1,
  sunGrid: { originX: 0, originY: 0, originZ: 0, cell: SUN_GRID_METERS, countX: 0, countY: 0, countZ: 0, values: null },
  bakeMs: 0,
};
CAT.materials.forEach((row, index) => WorldMesh.materialIndex.set(row.id, index));

// ---- Theme: palette, sun, ambient, fog (MAP-022) ----
function applyTheme(themeId) {
  const theme = CAT.themes.byId(themeId) || CAT.themes[0];
  const frame = Render.frame;
  WorldMesh.theme = theme;
  WorldMesh.fogScale = theme.fogDensity;
  const elevation = theme.sunElevation * DEG, azimuth = theme.sunAzimuth * DEG;
  frame.sunDirection[0] = Math.sin(azimuth) * Math.cos(elevation);
  frame.sunDirection[1] = Math.sin(elevation);
  frame.sunDirection[2] = Math.cos(azimuth) * Math.cos(elevation);
  writeColor(frame.sunColor, 0, theme.sunColor);
  for (let i = 0; i < 3; i++) frame.sunColor[i] *= theme.sunIntensity;
  writeColor(frame.ambientSky, 0, theme.ambientSky);
  writeColor(frame.ambientGround, 0, theme.ambientGround);
  writeColor(frame.fogColor, 0, theme.fog);
  writeColor(WorldMesh.skyTop, 0, theme.skyTop);
  writeColor(WorldMesh.skyHorizon, 0, theme.skyHorizon);
  CAT.materials.forEach((row, index) => writeMaterial(row, index, theme));
}

function writeMaterial(row, index, theme) {
  if (index >= MAX_MATERIALS) return;
  const colors = theme.palette[row.id] || [row.colorA, row.colorB];
  writeColor(WorldMesh.materialA, index * 3, colors[0]);
  writeColor(WorldMesh.materialB, index * 3, colors[1]);
  const params = WorldMesh.materialParams;
  params[index * 4] = Math.max(0, MATERIAL_PATTERNS.indexOf(row.pattern));
  params[index * 4 + 1] = row.scale;
  params[index * 4 + 2] = row.emissive;
  params[index * 4 + 3] = row.shine;
}

// ---- Convex polygon helpers (load time only) ----
const snapZero = (distance) => (Math.abs(distance) < 1e-7 ? 0 : distance);

// Keeps the part of a polygon (flat [x,y,z,...]) behind the plane n.p = offset.
function clipPolygon(points, nx, ny, nz, offset) {
  const result = [];
  const count = points.length / 3;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const ax = points[i * 3], ay = points[i * 3 + 1], az = points[i * 3 + 2];
    const bx = points[j * 3], by = points[j * 3 + 1], bz = points[j * 3 + 2];
    const da = snapZero(nx * ax + ny * ay + nz * az - offset), db = snapZero(nx * bx + ny * by + nz * bz - offset);
    if (da <= 0) result.push(ax, ay, az);
    if (!((da < 0 && db > 0) || (da > 0 && db < 0))) continue; // a point on the plane is already kept: no duplicate
    const t = da / (da - db);
    result.push(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
  }
  return result;
}

// The face of plane `index` of a brush: a big quad on the plane clipped by every other plane (counter-clockwise from outside).
function brushFace(brush, index) {
  const p = brush.planes;
  const nx = p[index * 4], ny = p[index * 4 + 1], nz = p[index * 4 + 2], offset = p[index * 4 + 3];
  const cx = (brush.minX + brush.maxX) / 2, cy = (brush.minY + brush.maxY) / 2, cz = (brush.minZ + brush.maxZ) / 2;
  const along = nx * cx + ny * cy + nz * cz - offset;
  const ox = cx - nx * along, oy = cy - ny * along, oz = cz - nz * along;
  const helperX = Math.abs(ny) > 0.9 ? 1 : 0, helperY = Math.abs(ny) > 0.9 ? 0 : 1;
  // tangent = normalize(cross(normal, helper)), bitangent = cross(normal, tangent): (t, b, n) is right-handed
  let tx = ny * 0 - nz * helperY, ty = nz * helperX - nx * 0, tz = nx * helperY - ny * helperX;
  const length = Math.hypot(tx, ty, tz); tx /= length; ty /= length; tz /= length;
  const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
  const r = Math.hypot(brush.maxX - brush.minX, brush.maxY - brush.minY, brush.maxZ - brush.minZ) + 1;
  let polygon = [];
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) polygon.push(ox + (tx * su + bx * sv) * r, oy + (ty * su + by * sv) * r, oz + (tz * su + bz * sv) * r);
  for (let j = 0; j < brush.planeCount && polygon.length >= 9; j++) {
    if (j !== index) polygon = clipPolygon(polygon, p[j * 4], p[j * 4 + 1], p[j * 4 + 2], p[j * 4 + 3]);
  }
  return polygon;
}

// Grid axes (0 = x, 1 = y, 2 = z) a face is cut along: the two axes the normal is most perpendicular to.
function faceAxes(nx, ny, nz) {
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  if (ay >= ax && ay >= az) return [0, 2];
  return ax >= az ? [2, 1] : [0, 1];
}

const AXIS_NORMALS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
// Cuts a face polygon into world-aligned cells so lighting samples are at most `cell` metres apart (crack-free: shared cell edges).
function cutFace(polygon, nx, ny, nz, cell, emit) {
  const [u, v] = faceAxes(nx, ny, nz);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < polygon.length; i += 3) {
    minU = Math.min(minU, polygon[i + u]); maxU = Math.max(maxU, polygon[i + u]);
    minV = Math.min(minV, polygon[i + v]); maxV = Math.max(maxV, polygon[i + v]);
  }
  const un = AXIS_NORMALS[u], vn = AXIS_NORMALS[v];
  for (let cu = Math.floor(minU / cell) * cell; cu < maxU - 1e-6; cu += cell) {
    const strip = clipPolygon(clipPolygon(polygon, -un[0], -un[1], -un[2], -cu), un[0], un[1], un[2], cu + cell);
    if (strip.length < 9) continue;
    for (let cv = Math.floor(minV / cell) * cell; cv < maxV - 1e-6; cv += cell) {
      const piece = clipPolygon(clipPolygon(strip, -vn[0], -vn[1], -vn[2], -cv), vn[0], vn[1], vn[2], cv + cell);
      if (piece.length >= 9) emit(piece);
    }
  }
}

// ---- Bake-time brush lookup grid (XZ cells -> brush indices) ----
function makeBrushGrid(brushes) {
  const grid = new Map();
  brushes.forEach((brush, index) => {
    for (let gx = Math.floor(brush.minX / BRUSH_GRID_METERS); gx <= Math.floor(brush.maxX / BRUSH_GRID_METERS); gx++) {
      for (let gz = Math.floor(brush.minZ / BRUSH_GRID_METERS); gz <= Math.floor(brush.maxZ / BRUSH_GRID_METERS); gz++) {
        const key = gx + ',' + gz;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(index);
      }
    }
  });
  return grid;
}

function insideBrush(brush, x, y, z) {
  const p = brush.planes;
  for (let i = 0; i < brush.planeCount; i++) if (p[i * 4] * x + p[i * 4 + 1] * y + p[i * 4 + 2] * z - p[i * 4 + 3] > -1e-4) return false;
  return true;
}

// Index of a brush (other than `skip`) containing the point, or -1.
function brushAt(bake, x, y, z, skip) {
  const list = bake.grid.get(Math.floor(x / BRUSH_GRID_METERS) + ',' + Math.floor(z / BRUSH_GRID_METERS));
  if (!list) return -1;
  for (const index of list) if (index !== skip && insideBrush(bake.brushes[index], x, y, z)) return index;
  return -1;
}

// A face cell is hidden when another brush covers its front, or when a lower-index brush has a coplanar face there (no z-fighting).
function cellHidden(bake, brushIndex, x, y, z, nx, ny, nz) {
  if (brushAt(bake, x + nx * FACE_EPSILON, y + ny * FACE_EPSILON, z + nz * FACE_EPSILON, brushIndex) >= 0) return true;
  const behind = brushAt(bake, x - nx * FACE_EPSILON, y - ny * FACE_EPSILON, z - nz * FACE_EPSILON, brushIndex);
  return behind >= 0 && behind < brushIndex;
}

// ---- Vertex lighting (REN-004): hemisphere ambient x AO + sun with a shadow ray + map lights ----
const bakeHit = { distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null };

function ambientOcclusion(bake, x, y, z, nx, ny, nz) {
  const [tx, ty, tz] = Math.abs(ny) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx; // a tangent perpendicular to the normal
  const cx = ny * bz - nz * by, cy = nz * bx - nx * bz, cz = nx * by - ny * bx;
  let blocked = 0, samples = 0;
  for (const distance of AO_DISTANCES) {
    for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const sx = x + (nx + (bx * a + cx * b) * 0.8) * distance, sy = y + (ny + (by * a + cy * b) * 0.8) * distance, sz = z + (nz + (bz * a + cz * b) * 0.8) * distance;
      if (brushAt(bake, sx, sy, sz, -1) >= 0) blocked++;
      samples++;
    }
  }
  return 1 - (blocked / samples) * AO_STRENGTH;
}

function sunVisible(x, y, z) {
  const sun = Render.frame.sunDirection;
  return World.raycast(x, y, z, sun[0], sun[1], sun[2], SUN_RAY_METERS, bakeHit) ? 0 : 1;
}

function mapLightContribution(bake, x, y, z, nx, ny, nz, out) {
  for (const light of bake.lights) {
    const dx = light.x - x, dy = light.y - y, dz = light.z - z, distance = Math.hypot(dx, dy, dz);
    if (distance >= light.radius) continue;
    const facing = (nx * dx + ny * dy + nz * dz) / Math.max(distance, 1e-3);
    if (facing <= 0 || !World.lineClear(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, light.x, light.y, light.z)) continue;
    const strength = (1 - distance / light.radius) ** 2 * facing * light.intensity;
    for (let i = 0; i < 3; i++) out[i] += light.color[i] * strength;
  }
}

// Returns [r, g, b, ao, sun] for a surface point; cached because neighbouring cells share their corner points.
function vertexLight(bake, x, y, z, nx, ny, nz) {
  const key = Math.round(x * 50) + ',' + Math.round(y * 50) + ',' + Math.round(z * 50) + ',' + Math.round(nx * 9) + ',' + Math.round(ny * 9) + ',' + Math.round(nz * 9);
  const cached = bake.lightCache.get(key);
  if (cached) return cached;
  const frame = Render.frame, sun = frame.sunDirection;
  const ao = ambientOcclusion(bake, x, y, z, nx, ny, nz);
  const facing = nx * sun[0] + ny * sun[1] + nz * sun[2];
  const direct = facing > 0 ? facing * sunVisible(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05) : 0;
  const hemisphere = ny * 0.5 + 0.5, light = [0, 0, 0, ao, direct];
  for (let i = 0; i < 3; i++) light[i] = lerp(frame.ambientGround[i], frame.ambientSky[i], hemisphere) * ao + frame.sunColor[i] * direct;
  mapLightContribution(bake, x, y, z, nx, ny, nz, light);
  bake.lightCache.set(key, light);
  return light;
}

// ---- Mesh build ----
function bakeCellSize(brushes) {
  let extent = 0;
  for (const brush of brushes) extent = Math.max(extent, brush.maxX - brush.minX, brush.maxZ - brush.minZ);
  return clamp(extent / BAKE_CELLS_ACROSS, BAKE_CELL_MIN, BAKE_CELL_MAX);
}

function readMapLights(map) {
  return (map.lights || []).map((light) => {
    const color = new Float32Array(3);
    writeColor(color, 0, light.color || '#ffe0b0');
    return { x: light.pos[0], y: light.pos[1], z: light.pos[2], radius: light.radius || 8, intensity: light.intensity === undefined ? 1 : light.intensity, color };
  });
}

// Bake context: theme applied, brush lookup grid, map lights, light cache and chunk lists.
function makeBake(map, brushes) {
  applyTheme(map.theme);
  return { brushes, grid: makeBrushGrid(brushes), lights: readMapLights(map), lightCache: new Map(), chunks: new Map(), cell: bakeCellSize(brushes) };
}

// Builds the CPU-side world mesh from World.brushes; returns the chunk list (also used by the self-test).
function buildWorldMesh(map, brushes) {
  const started = performance.now();
  const bake = makeBake(map, brushes);
  let floorY = Infinity;
  for (const brush of brushes) floorY = Math.min(floorY, brush.minY);
  brushes.forEach((brush, brushIndex) => addBrushFaces(bake, brush, brushIndex, floorY));
  packWorldMesh(bake.chunks);
  buildSunGrid(brushes);
  WorldMesh.bakeMs = performance.now() - started;
  return WorldMesh.chunks;
}

function addBrushFaces(bake, brush, brushIndex, floorY) {
  const material = WorldMesh.materialIndex.has(brush.material) ? WorldMesh.materialIndex.get(brush.material) : 0;
  const p = brush.planes;
  for (let plane = 0; plane < brush.planeCount; plane++) {
    const nx = p[plane * 4], ny = p[plane * 4 + 1], nz = p[plane * 4 + 2];
    if (ny < -0.99 && brush.minY <= floorY + 1e-3) continue; // the underside of the lowest brushes is never seen
    const polygon = brushFace(brush, plane);
    if (polygon.length < 9) continue;
    cutFace(polygon, nx, ny, nz, bake.cell, (piece) => addPiece(bake, piece, brushIndex, material, nx, ny, nz));
  }
}

// Area of a planar polygon along its normal (Newell); slivers from clipping (a ramp's zero-height end) are dropped.
function polygonArea(points, nx, ny, nz) {
  let x = 0, y = 0, z = 0;
  const count = points.length / 3;
  for (let i = 0; i < count; i++) {
    const j = ((i + 1) % count) * 3, k = i * 3;
    x += (points[k + 1] - points[j + 1]) * (points[k + 2] + points[j + 2]);
    y += (points[k + 2] - points[j + 2]) * (points[k] + points[j]);
    z += (points[k] - points[j]) * (points[k + 1] + points[j + 1]);
  }
  return Math.abs(x * nx + y * ny + z * nz) / 2;
}

function addPiece(bake, piece, brushIndex, material, nx, ny, nz) {
  if (polygonArea(piece, nx, ny, nz) < MIN_PIECE_AREA) return;
  const count = piece.length / 3;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < piece.length; i += 3) { cx += piece[i]; cy += piece[i + 1]; cz += piece[i + 2]; }
  cx /= count; cy /= count; cz /= count;
  if (cellHidden(bake, brushIndex, cx, cy, cz, nx, ny, nz)) return;
  const key = Math.floor(cx / CHUNK_METERS) + ',' + Math.floor(cz / CHUNK_METERS);
  if (!bake.chunks.has(key)) bake.chunks.set(key, { vertices: [], indices: [] });
  const chunk = bake.chunks.get(key), base = chunk.vertices.length / BAKE_VALUES_PER_VERTEX;
  for (let i = 0; i < piece.length; i += 3) {
    const light = vertexLight(bake, piece[i], piece[i + 1], piece[i + 2], nx, ny, nz);
    chunk.vertices.push(piece[i], piece[i + 1], piece[i + 2], nx, ny, nz, material, light[0], light[1], light[2], light[3], light[4]);
  }
  for (let i = 1; i < count - 1; i++) chunk.indices.push(base, base + i, base + i + 1);
}

// Packs every chunk into one interleaved vertex buffer and one index buffer (chunk = one index range).
function packWorldMesh(chunkMap) {
  let vertexCount = 0, indexCount = 0;
  for (const chunk of chunkMap.values()) { vertexCount += chunk.vertices.length / BAKE_VALUES_PER_VERTEX; indexCount += chunk.indices.length; }
  const bytes = new ArrayBuffer(Math.max(1, vertexCount) * WORLD_VERTEX_BYTES);
  const views = { floats: new Float32Array(bytes), signed: new Int8Array(bytes), unsigned: new Uint8Array(bytes) };
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  const chunks = [];
  let vertex = 0, index = 0;
  for (const chunk of chunkMap.values()) {
    const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity, offset: index * indices.BYTES_PER_ELEMENT, count: chunk.indices.length };
    for (let i = 0; i < chunk.indices.length; i++) indices[index++] = chunk.indices[i] + vertex;
    for (let i = 0; i < chunk.vertices.length; i += BAKE_VALUES_PER_VERTEX) {
      writeWorldVertex(views, vertex++, chunk.vertices, i);
      growBounds(bounds, chunk.vertices[i], chunk.vertices[i + 1], chunk.vertices[i + 2]);
    }
    chunks.push(bounds);
  }
  Object.assign(WorldMesh, { chunks, vertexBytes: bytes, indexData: indices, vertexCount, triangles: indexCount / 3 });
}

function writeWorldVertex(views, vertex, values, i) {
  const byte = vertex * WORLD_VERTEX_BYTES, floatIndex = byte / 4;
  views.floats[floatIndex] = values[i]; views.floats[floatIndex + 1] = values[i + 1]; views.floats[floatIndex + 2] = values[i + 2];
  for (let c = 0; c < 3; c++) views.signed[byte + 12 + c] = Math.round(values[i + 3 + c] * 127);
  views.signed[byte + 15] = values[i + 6];
  for (let c = 0; c < 3; c++) views.unsigned[byte + 16 + c] = Math.round(clamp(values[i + 7 + c] / LIGHT_SCALE, 0, 1) * 255);
  views.unsigned[byte + 19] = Math.round(clamp(values[i + 10], 0, 1) * 255);
  views.unsigned[byte + 20] = Math.round(clamp(values[i + 11], 0, 1) * 255);
}

function growBounds(bounds, x, y, z) {
  bounds.minX = Math.min(bounds.minX, x); bounds.minY = Math.min(bounds.minY, y); bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxX = Math.max(bounds.maxX, x); bounds.maxY = Math.max(bounds.maxY, y); bounds.maxZ = Math.max(bounds.maxZ, z);
}

// ---- Coarse sun visibility for moving objects (actors, props, the view model): one shadow ray per 4 m cell ----
function buildSunGrid(brushes) {
  const grid = WorldMesh.sunGrid;
  grid.values = null;
  if (!brushes.length) return;
  const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  for (const brush of brushes) { growBounds(bounds, brush.minX, brush.minY, brush.minZ); growBounds(bounds, brush.maxX, brush.maxY + 4, brush.maxZ); }
  const cellsFor = (size) => Math.ceil((bounds.maxX - bounds.minX) / size) * Math.ceil((bounds.maxY - bounds.minY) / size) * Math.ceil((bounds.maxZ - bounds.minZ) / size);
  let cell = SUN_GRID_METERS;
  while (cellsFor(cell) > SUN_GRID_MAX_CELLS) cell *= 1.5;
  Object.assign(grid, { originX: bounds.minX, originY: bounds.minY, originZ: bounds.minZ, cell,
    countX: Math.ceil((bounds.maxX - bounds.minX) / cell), countY: Math.ceil((bounds.maxY - bounds.minY) / cell), countZ: Math.ceil((bounds.maxZ - bounds.minZ) / cell) });
  grid.values = new Uint8Array(grid.countX * grid.countY * grid.countZ);
  for (let iy = 0; iy < grid.countY; iy++) {
    for (let iz = 0; iz < grid.countZ; iz++) fillSunRow(grid, iy, iz);
  }
}

function fillSunRow(grid, iy, iz) {
  for (let ix = 0; ix < grid.countX; ix++) {
    const x = grid.originX + (ix + 0.5) * grid.cell, y = grid.originY + (iy + 0.5) * grid.cell, z = grid.originZ + (iz + 0.5) * grid.cell;
    grid.values[(iy * grid.countZ + iz) * grid.countX + ix] = World.pointInside(x, y, z) ? 255 : sunVisible(x, y, z) * 255;
  }
}

// 0..1 sun visibility near a point (1 outside the grid). Used per instance by the shapes batch.
function sampleSunVisibility(x, y, z) {
  const grid = WorldMesh.sunGrid;
  if (!grid.values) return 1;
  const ix = Math.floor((x - grid.originX) / grid.cell), iy = Math.floor((y - grid.originY) / grid.cell), iz = Math.floor((z - grid.originZ) / grid.cell);
  if (ix < 0 || iy < 0 || iz < 0 || ix >= grid.countX || iy >= grid.countY || iz >= grid.countZ) return 1;
  return grid.values[(iy * grid.countZ + iz) * grid.countX + ix] / 255;
}

function clearWorldMesh() {
  const gl = Render.gl;
  if (gl) { gl.deleteBuffer(WorldMesh.vertexBuffer); gl.deleteBuffer(WorldMesh.indexBuffer); gl.deleteVertexArray(WorldMesh.vertexArray); }
  Object.assign(WorldMesh, { chunks: [], vertexBytes: null, indexData: null, vertexCount: 0, triangles: 0, vertexBuffer: null, indexBuffer: null, vertexArray: null });
  WorldMesh.sunGrid.values = null;
}

// GPU upload; also runs after a context restore from the kept CPU arrays.
function uploadWorldMesh(gl) {
  WorldMesh.vertexArray = null;
  if (!WorldMesh.vertexBytes || !WorldMesh.vertexCount) return;
  WorldMesh.vertexArray = gl.createVertexArray();
  gl.bindVertexArray(WorldMesh.vertexArray);
  WorldMesh.vertexBuffer = makeBuffer(gl, gl.ARRAY_BUFFER, WorldMesh.vertexBytes);
  bindAttributes(gl, WorldMesh.vertexBuffer, [
    [WORLD_ATTRIBUTES.aPosition, 3, gl.FLOAT, false, 0], [WORLD_ATTRIBUTES.aNormal, 4, gl.BYTE, true, 12],
    [WORLD_ATTRIBUTES.aLight, 4, gl.UNSIGNED_BYTE, true, 16], [WORLD_ATTRIBUTES.aExtra, 4, gl.UNSIGNED_BYTE, true, 20]], WORLD_VERTEX_BYTES, 0);
  WorldMesh.indexBuffer = makeBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, WorldMesh.indexData);
  WorldMesh.indexType = WorldMesh.indexData.BYTES_PER_ELEMENT === 4 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
  gl.bindVertexArray(null);
}
Render.addGpuPart('world', uploadWorldMesh);

Bus.on('world.load', (map) => {
  if (Game.headless) return;
  clearWorldMesh();
  buildWorldMesh(map, World.brushes);
  if (Render.gl && !Render.lost) uploadWorldMesh(Render.gl);
});
Bus.on('match.stop', () => clearWorldMesh());
applyTheme(CAT.themes[0].id);

// ---- World program ----
const WORLD_VERTEX = `#version 300 es
precision highp float;
uniform mat4 uViewProjection;
in vec3 aPosition;
in vec4 aNormal;
in vec4 aLight;
in vec4 aExtra;
out vec3 vPosition;
out vec3 vNormal;
out vec4 vLight;
out float vSun;
flat out int vMaterial;
void main() {
  vPosition = aPosition;
  vNormal = aNormal.xyz;
  vLight = aLight;
  vSun = aExtra.x;
  vMaterial = int(aNormal.w * 127.0 + 0.5);
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}`;
const WORLD_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uMaterialA[${MAX_MATERIALS}];
uniform vec3 uMaterialB[${MAX_MATERIALS}];
uniform vec4 uMaterialParams[${MAX_MATERIALS}];
${GLSL_LIGHTING}
in vec3 vPosition;
in vec3 vNormal;
in vec4 vLight;
in float vSun;
flat in int vMaterial;
out vec4 outColor;
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float seam(vec2 cell, float width) { vec2 d = min(cell, 1.0 - cell); return 1.0 - step(width, min(d.x, d.y)); }
// 0 = colour A, 1 = colour B. Pattern ids follow MATERIAL_PATTERNS.
float pattern(int kind, vec2 uv) {
  if (kind == 0) return noise(uv) * 0.65 + noise(uv * 4.1) * 0.35;
  if (kind == 1) return max(seam(fract(uv), 0.015), hash(floor(uv)) * 0.35 + noise(uv * 6.0) * 0.1);
  if (kind == 2) return max(seam(fract(uv), 0.04), hash(floor(uv)) * 0.25);
  if (kind == 3) { float row = floor(uv.y * 2.0); return max(step(fract(uv.y * 2.0), 0.05), noise(vec2(uv.x * 0.7, row * 7.3)) * 0.6); }
  if (kind == 4) { vec2 brick = vec2(uv.x + 0.5 * mod(floor(uv.y * 2.0), 2.0), uv.y * 2.0); return max(seam(fract(brick), 0.05), hash(floor(brick)) * 0.3); }
  if (kind == 5) return step(0.5, fract((uv.x + uv.y) * 0.5));
  if (kind == 6) return 1.0 - seam(fract(uv), 0.12);
  if (kind == 7) return max(seam(fract(uv * 2.0), 0.08) * 0.8, noise(uv * 3.0) * 0.2);
  return noise(uv * 0.5) * 0.15;
}
void main() {
  vec3 normal = normalize(vNormal);
  vec4 params = uMaterialParams[vMaterial];
  vec2 uv = (abs(normal.y) > 0.6 ? vPosition.xz : (abs(normal.x) > abs(normal.z) ? vPosition.zy : vPosition.xy)) * params.y;
  float distance = length(vPosition - uCameraPosition);
  float mixAmount = mix(pattern(int(params.x + 0.5), uv), 0.35, smoothstep(30.0, 90.0, distance)); // far patterns fade: no shimmer
  vec3 albedo = mix(uMaterialA[vMaterial], uMaterialB[vMaterial], mixAmount);
  vec3 light = vLight.rgb * ${LIGHT_SCALE.toFixed(1)} + dynamicLight(vPosition, normal) * vLight.a;
  vec3 halfVector = normalize(uSunDirection + normalize(uCameraPosition - vPosition));
  float highlight = pow(max(dot(normal, halfVector), 0.0), 32.0) * params.w * vSun;
  vec3 color = albedo * light + uSunColor * highlight + albedo * params.z * mixAmount * 1.5;
  outColor = vec4(finishColor(color, vPosition), 1.0);
}`;
Render.defineProgram('world', WORLD_VERTEX, WORLD_FRAGMENT, WORLD_ATTRIBUTES);

function drawWorld(gl) {
  if (!WorldMesh.vertexArray) return;
  const program = Render.programs.world, u = program.uniforms;
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  gl.useProgram(program.handle);
  applyFrameUniforms(gl, program, Render.frame.viewProjection);
  gl.uniform3fv(u.uMaterialA, WorldMesh.materialA);
  gl.uniform3fv(u.uMaterialB, WorldMesh.materialB);
  gl.uniform4fv(u.uMaterialParams, WorldMesh.materialParams);
  gl.bindVertexArray(WorldMesh.vertexArray);
  const chunks = WorldMesh.chunks;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!boxVisible(chunk.minX, chunk.minY, chunk.minZ, chunk.maxX, chunk.maxY, chunk.maxZ)) continue;
    gl.drawElements(gl.TRIANGLES, chunk.count, WorldMesh.indexType, chunk.offset);
    Render.countDraw(chunk.count / 3);
  }
}
Render.addPass(20, drawWorld);

// Fog follows the active quality's view distance (REN-001 distance fog; the far plane sits just behind it).
Render.addUpdate(5, () => { Render.frame.fogDensity = FOG_FULL_AT_VIEW * WorldMesh.fogScale / Render.quality.viewDistance; });

// ---- Sky: full-screen gradient + sun disc, drawn first with depth off ----
const SKY_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec3 uForward;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uFogColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
in vec2 vClip;
out vec4 outColor;
void main() {
  vec3 direction = normalize(uForward + uRight * vClip.x + uUp * vClip.y);
  float height = direction.y;
  vec3 color = mix(uSkyHorizon, uSkyTop, pow(clamp(height, 0.0, 1.0), 0.6));
  color = mix(color, uFogColor * 0.85, smoothstep(0.0, -0.25, height));
  float sun = max(dot(direction, uSunDirection), 0.0);
  color += uSunColor * (pow(sun, 900.0) * 3.0 + pow(sun, 12.0) * 0.25);
  outColor = vec4(color, 1.0);
}`;
Render.defineProgram('sky', GLSL_FULLSCREEN_VERTEX, SKY_FRAGMENT, {});

function drawSky(gl) {
  const program = Render.programs.sky, u = program.uniforms, view = Render.view, frame = Render.frame;
  gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
  gl.useProgram(program.handle);
  gl.uniform3fv(u.uForward, view.forward);
  gl.uniform3fv(u.uRight, view.skyRight);
  gl.uniform3fv(u.uUp, view.skyUp);
  gl.uniform3fv(u.uSkyTop, WorldMesh.skyTop);
  gl.uniform3fv(u.uSkyHorizon, WorldMesh.skyHorizon);
  gl.uniform3fv(u.uFogColor, frame.fogColor);
  gl.uniform3fv(u.uSunDirection, frame.sunDirection);
  gl.uniform3fv(u.uSunColor, frame.sunColor);
  drawFullscreen(gl);
  gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
}
Render.addPass(10, drawSky);
