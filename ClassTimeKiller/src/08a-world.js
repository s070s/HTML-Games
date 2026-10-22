// ==== S08 WORLD / COLLISION ====
// The static world is a list of convex brushes, each stored as planes (normal + offset) plus its bounding box,
// indexed by a static bounding-volume tree (ARC-013). Map brushes (MAP-001):
// { shape: 'box' | 'ramp' | 'wedge' | 'cylinder', min: [x,y,z], max: [x,y,z], dir: '+x'|'-x'|'+z'|'-z' (ramp/wedge rises toward dir),
//   sides: 8 (cylinder), material }. A wedge is a ramp; a cylinder is a low-poly prism inside the box.
// Every query clips a move against brushes grown by a "hull" (ray = point, capsule, sphere or box): see clipBrush.

const BVH_LEAF_SIZE = 2;               // brushes per leaf: small leaves keep ray and capsule tests cheap
const BVH_STACK_SIZE = 64;             // traversal stack; a median-split tree of 2^30 brushes is 31 levels deep
const CYLINDER_DEFAULT_SIDES = 8;
const BOUNDS_FIELDS = 6;               // minX minY minZ maxX maxY maxZ per tree node

const World = {
  brushes: [],            // { shape, material, index, prop, minX..maxZ, planes: Float32Array [nx,ny,nz,d, ...], planeCount, source }
  dynamic: [],            // brushes that can disappear (destructible props, 08d); tested after the static tree
  map: null,              // the loaded map row
  tree: null,             // static bounding-volume tree over brushes
  parts: [],              // add-on files of this section: { load(map), clear() }
  boundsMin: Vec.make(), boundsMax: Vec.make(),

  addPart(part) { this.parts.push(part); },
  load(map) {
    this.clear();
    this.map = map;
    this.brushes = map.brushes.map((source, index) => makeBrush(source, index));
    this.computeBounds();
    this.tree = buildTree(this.brushes);
    for (const part of this.parts) part.load(map);
    Bus.emit('world.load', map);
  },
  clear() {
    for (const part of this.parts) part.clear();
    this.map = null; this.brushes = []; this.dynamic.length = 0;
    this.computeBounds(); // no brushes: the bounds are not finite (the fall-out check skips them)
    this.tree = buildTree(this.brushes);
  },
  computeBounds() {
    Vec.set(this.boundsMin, Infinity, Infinity, Infinity);
    Vec.set(this.boundsMax, -Infinity, -Infinity, -Infinity);
    for (const b of this.brushes) {
      this.boundsMin.x = Math.min(this.boundsMin.x, b.minX); this.boundsMin.y = Math.min(this.boundsMin.y, b.minY); this.boundsMin.z = Math.min(this.boundsMin.z, b.minZ);
      this.boundsMax.x = Math.max(this.boundsMax.x, b.maxX); this.boundsMax.y = Math.max(this.boundsMax.y, b.maxY); this.boundsMax.z = Math.max(this.boundsMax.z, b.maxZ);
    }
  },
  // Ray against all brushes; direction must be normalized. Fills hit {distance, x,y,z, nx,ny,nz, brush}; returns true on a hit.
  // A ray that starts inside a brush hits at distance 0 with the normal facing back along the ray.
  raycast(ox, oy, oz, dx, dy, dz, maxDistance, hit) {
    const query = rayQuery;
    query.sx = ox; query.sy = oy; query.sz = oz; query.dx = dx; query.dy = dy; query.dz = dz;
    query.ex = ox + dx * maxDistance; query.ey = oy + dy * maxDistance; query.ez = oz + dz * maxDistance;
    query.length = maxDistance; query.fraction = 1; query.brush = null;
    walkTree(this.tree, query, rayTestNode, rayTestBrush);
    for (let i = 0; i < this.dynamic.length; i++) rayTestBrush(query, this.dynamic[i]);
    if (!query.brush) return false;
    hit.distance = query.fraction * maxDistance;
    hit.x = ox + dx * hit.distance; hit.y = oy + dy * hit.distance; hit.z = oz + dz * hit.distance;
    hit.nx = query.nx; hit.ny = query.ny; hit.nz = query.nz; hit.brush = query.brush;
    return true;
  },
  // True when nothing solid lies between the two points (bot line of sight, splash occlusion).
  lineClear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) return true;
    return !this.raycast(ax, ay, az, dx / length, dy / length, dz / length, length, scratchHit);
  },
  pointInside(x, y, z) {
    const query = pointQuery;
    query.x = x; query.y = y; query.z = z; query.found = false;
    walkTree(this.tree, query, pointTestNode, pointTestBrush);
    for (let i = 0; i < this.dynamic.length; i++) pointTestBrush(query, this.dynamic[i]);
    return query.found;
  },
};

// Hooks of earlier sections: the renderer bakes World.brushes on 'world.load'; audio muffles sounds behind walls.
Render.worldQuery = World;
Sound.lineOfSight = (ax, ay, az, bx, by, bz) => World.lineClear(ax, ay, az, bx, by, bz);

const scratchHit = { distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null };
const makeHit = () => ({ distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null });
const rayQuery = { sx: 0, sy: 0, sz: 0, ex: 0, ey: 0, ez: 0, dx: 0, dy: 0, dz: 0, length: 0, fraction: 1, nx: 0, ny: 0, nz: 0, brush: null };
const pointQuery = { x: 0, y: 0, z: 0, found: false };

// ---- Brushes ----
function makeBrush(source, index) {
  const [minX, minY, minZ] = source.min, [maxX, maxY, maxZ] = source.max;
  const planes = [];
  const addPlane = (nx, ny, nz, px, py, pz) => { const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; planes.push(nx, ny, nz, nx * px + ny * py + nz * pz); };
  addPlane(0, -1, 0, 0, minY, 0);
  if (source.shape === 'cylinder') addPrismSides(addPlane, source.sides || CYLINDER_DEFAULT_SIDES, minX, minZ, maxX, maxZ);
  else addBoxSides(addPlane, minX, minZ, maxX, maxZ);
  if (source.shape === 'ramp' || source.shape === 'wedge') addRampTop(addPlane, source.dir, minX, minY, minZ, maxX, maxY, maxZ);
  else addPlane(0, 1, 0, 0, maxY, 0);
  return { shape: source.shape || 'box', material: source.material || 'concrete', index, prop: -1, source, minX, minY, minZ, maxX, maxY, maxZ,
    planes: new Float32Array(planes), planeCount: planes.length / 4 };
}

function addBoxSides(addPlane, minX, minZ, maxX, maxZ) {
  addPlane(-1, 0, 0, minX, 0, 0); addPlane(1, 0, 0, maxX, 0, 0);
  addPlane(0, 0, -1, 0, 0, minZ); addPlane(0, 0, 1, 0, 0, maxZ);
}

// Vertical faces of a regular prism inscribed in the box footprint (an ellipse when the footprint is not square).
function addPrismSides(addPlane, sides, minX, minZ, maxX, maxZ) {
  const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2, radiusX = (maxX - minX) / 2, radiusZ = (maxZ - minZ) / 2;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2, b = ((i + 1) / sides) * Math.PI * 2;
    const ax = centerX + Math.cos(a) * radiusX, az = centerZ + Math.sin(a) * radiusZ;
    const bx = centerX + Math.cos(b) * radiusX, bz = centerZ + Math.sin(b) * radiusZ;
    addPlane(bz - az, 0, ax - bx, ax, 0, az); // outward normal of edge a->b (vertices run by increasing angle)
  }
}

// Top plane passes through the low edge (height minY) and the high edge (height maxY).
function addRampTop(addPlane, dir, minX, minY, minZ, maxX, maxY, maxZ) {
  const rise = maxY - minY;
  if (dir === '+x') addPlane(-rise, maxX - minX, 0, minX, minY, 0);
  else if (dir === '-x') addPlane(rise, maxX - minX, 0, maxX, minY, 0);
  else if (dir === '+z') addPlane(0, maxZ - minZ, -rise, 0, minY, minZ);
  else addPlane(0, maxZ - minZ, rise, 0, minY, maxZ);
}

// ---- Hulls: the shape a query moves. The reference point is the capsule's feet or the sphere/box centre. ----
// Support offset along a plane normal: radius + |nx|*halfX + |nz|*halfZ + (ny >= 0 ? ny*bottom : -ny*top).
// Capsule (feet reference): radius r, bottom -r, top height-r. Box: halfX/halfZ, bottom = top = halfY. Ray: all zero.
const makeHull = () => ({ radius: 0, halfX: 0, halfZ: 0, bottom: 0, top: 0 });
const POINT_HULL = makeHull();

function setCapsuleHull(hull, radius, height) {
  hull.radius = radius; hull.halfX = 0; hull.halfZ = 0; hull.bottom = -radius; hull.top = height - radius;
  return hull;
}

function setBoxHull(hull, halfX, halfY, halfZ) {
  hull.radius = 0; hull.halfX = halfX; hull.halfZ = halfZ; hull.bottom = halfY; hull.top = halfY;
  return hull;
}

function setSphereHull(hull, radius) {
  hull.radius = radius; hull.halfX = 0; hull.halfZ = 0; hull.bottom = 0; hull.top = 0;
  return hull;
}

function hullOffset(hull, nx, ny, nz) {
  return hull.radius + Math.abs(nx) * hull.halfX + Math.abs(nz) * hull.halfZ + (ny >= 0 ? ny * hull.bottom : -ny * hull.top);
}

// How far the hull reaches sideways, below and above its reference point (for bounding-box tests).
const hullSide = (hull) => hull.radius + Math.max(hull.halfX, hull.halfZ);
const hullBelow = (hull) => hull.radius + hull.bottom;
const hullAbove = (hull) => hull.radius + hull.top;

const clipResult = { nx: 0, ny: 0, nz: 0, startSolid: false, allSolid: false };

// Clips the move start->end of a hull against one convex brush (the brush grown by the hull). Returns the entry
// fraction 0..1, or -1 for a miss. A move that starts inside returns 0 with clipResult.startSolid set (allSolid when it
// also ends inside). skin keeps the hull that far in front of the surface (a small epsilon; 0 for exact rays).
function clipBrush(brush, sx, sy, sz, ex, ey, ez, hull, skin) {
  const p = brush.planes;
  let enter = -1, leave = 1, plane = -1, startsOutside = false, endsOutside = false;
  for (let i = 0; i < brush.planeCount; i++) {
    const nx = p[i * 4], ny = p[i * 4 + 1], nz = p[i * 4 + 2], offset = p[i * 4 + 3] + hullOffset(hull, nx, ny, nz);
    const startDistance = nx * sx + ny * sy + nz * sz - offset, endDistance = nx * ex + ny * ey + nz * ez - offset;
    if (startDistance > 0) startsOutside = true;
    if (endDistance > 0) endsOutside = true;
    if (startDistance > 0 && (endDistance >= skin || endDistance >= startDistance)) return -1; // wholly in front of this face
    if (startDistance <= 0 && endDistance <= 0) continue;
    if (startDistance <= endDistance) { leave = Math.min(leave, (startDistance + skin) / (startDistance - endDistance)); continue; }
    const fraction = Math.max(0, (startDistance - skin) / (startDistance - endDistance));
    if (fraction > enter) { enter = fraction; plane = i; }
  }
  clipResult.startSolid = !startsOutside;
  clipResult.allSolid = !startsOutside && !endsOutside;
  if (!startsOutside) return 0;
  if (enter >= leave || plane < 0) return -1;
  clipResult.nx = p[plane * 4]; clipResult.ny = p[plane * 4 + 1]; clipResult.nz = p[plane * 4 + 2];
  return enter;
}

// Slab test of a ray (origin, direction, length) against a box given as six numbers: entry distance (0 when the
// origin is inside), or -1 when the ray misses within maxDistance.
function rayBoundsDistance(ox, oy, oz, dx, dy, dz, maxDistance, minX, minY, minZ, maxX, maxY, maxZ) {
  slab.near = 0; slab.far = maxDistance;
  if (!clipSlab(ox, dx, minX, maxX) || !clipSlab(oy, dy, minY, maxY) || !clipSlab(oz, dz, minZ, maxZ)) return -1;
  return slab.near;
}

const slab = { near: 0, far: 0 };

function clipSlab(origin, direction, low, high) {
  if (Math.abs(direction) < 1e-9) return origin >= low && origin <= high;
  const t1 = (low - origin) / direction, t2 = (high - origin) / direction;
  slab.near = Math.max(slab.near, Math.min(t1, t2));
  slab.far = Math.min(slab.far, Math.max(t1, t2));
  return slab.near <= slab.far;
}

const rayHitsBounds = (ox, oy, oz, dx, dy, dz, maxDistance, minX, minY, minZ, maxX, maxY, maxZ) =>
  rayBoundsDistance(ox, oy, oz, dx, dy, dz, maxDistance, minX, minY, minZ, maxX, maxY, maxZ) >= 0;

function rayTestNode(query, bounds, base) {
  return rayHitsBounds(query.sx, query.sy, query.sz, query.dx, query.dy, query.dz, query.fraction * query.length,
    bounds[base], bounds[base + 1], bounds[base + 2], bounds[base + 3], bounds[base + 4], bounds[base + 5]);
}

function rayTestBrush(query, brush) {
  if (!rayHitsBounds(query.sx, query.sy, query.sz, query.dx, query.dy, query.dz, query.fraction * query.length,
    brush.minX, brush.minY, brush.minZ, brush.maxX, brush.maxY, brush.maxZ)) return;
  const fraction = clipBrush(brush, query.sx, query.sy, query.sz, query.ex, query.ey, query.ez, POINT_HULL, 0);
  if (fraction < 0 || fraction >= query.fraction) return;
  query.fraction = fraction; query.brush = brush;
  if (clipResult.startSolid) { query.nx = -query.dx; query.ny = -query.dy; query.nz = -query.dz; return; }
  query.nx = clipResult.nx; query.ny = clipResult.ny; query.nz = clipResult.nz;
}

function pointTestNode(query, bounds, base) {
  return query.x >= bounds[base] && query.y >= bounds[base + 1] && query.z >= bounds[base + 2]
    && query.x <= bounds[base + 3] && query.y <= bounds[base + 4] && query.z <= bounds[base + 5];
}

function pointTestBrush(query, brush) {
  if (!query.found && pointInBrush(query.x, query.y, query.z, brush, 0)) query.found = true;
}

function pointInBrush(x, y, z, brush, margin) {
  const p = brush.planes;
  for (let i = 0; i < brush.planeCount; i++) if (p[i * 4] * x + p[i * 4 + 1] * y + p[i * 4 + 2] * z - p[i * 4 + 3] > margin) return false;
  return true;
}

// ---- Static bounding-volume tree (median split on the longest axis). Node n's left child is n + 1. ----
function buildTree(brushes) {
  const capacity = Math.max(1, brushes.length * 2);
  const tree = { brushes, nodeCount: 0, bounds: new Float32Array(capacity * BOUNDS_FIELDS), first: new Int32Array(capacity),
    count: new Int32Array(capacity), right: new Int32Array(capacity), order: Int32Array.from(brushes.keys()) };
  if (brushes.length) buildNode(tree, 0, brushes.length);
  return tree;
}

function buildNode(tree, start, end) {
  const node = tree.nodeCount++;
  const base = node * BOUNDS_FIELDS;
  fitNode(tree, base, start, end);
  tree.first[node] = start;
  tree.count[node] = end - start;
  if (end - start <= BVH_LEAF_SIZE) return node;
  const b = tree.bounds, sizeX = b[base + 3] - b[base], sizeY = b[base + 4] - b[base + 1], sizeZ = b[base + 5] - b[base + 2];
  const axis = sizeX >= sizeY && sizeX >= sizeZ ? 'X' : sizeY >= sizeZ ? 'Y' : 'Z';
  const center = (index) => tree.brushes[index]['min' + axis] + tree.brushes[index]['max' + axis];
  tree.order.subarray(start, end).sort((a, c) => center(a) - center(c));
  const middle = (start + end) >> 1;
  tree.count[node] = 0; // inner node
  buildNode(tree, start, middle);
  tree.right[node] = buildNode(tree, middle, end);
  return node;
}

function fitNode(tree, base, start, end) {
  const b = tree.bounds;
  b[base] = b[base + 1] = b[base + 2] = Infinity;
  b[base + 3] = b[base + 4] = b[base + 5] = -Infinity;
  for (let i = start; i < end; i++) {
    const brush = tree.brushes[tree.order[i]];
    b[base] = Math.min(b[base], brush.minX); b[base + 1] = Math.min(b[base + 1], brush.minY); b[base + 2] = Math.min(b[base + 2], brush.minZ);
    b[base + 3] = Math.max(b[base + 3], brush.maxX); b[base + 4] = Math.max(b[base + 4], brush.maxY); b[base + 5] = Math.max(b[base + 5], brush.maxZ);
  }
}

const treeStack = new Int32Array(BVH_STACK_SIZE);

// Visits every brush in leaves whose box passes nodeTest(query, bounds, base); calls onBrush(query, brush).
// Not re-entrant: onBrush must not start another walk.
function walkTree(tree, query, nodeTest, onBrush) {
  if (!tree || !tree.nodeCount) return;
  let top = 0;
  treeStack[top++] = 0;
  while (top > 0) {
    const node = treeStack[--top];
    if (!nodeTest(query, tree.bounds, node * BOUNDS_FIELDS)) continue;
    const count = tree.count[node];
    if (count === 0) { treeStack[top++] = tree.right[node]; treeStack[top++] = node + 1; continue; }
    const first = tree.first[node];
    for (let i = 0; i < count; i++) onBrush(query, tree.brushes[tree.order[first + i]]);
  }
}

World.clear();
