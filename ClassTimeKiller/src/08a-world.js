// ==== S08 WORLD / COLLISION ====
// The static world is a list of convex brushes, each stored as planes (normal + offset) plus its bounding box.
// Map brushes: { shape: 'box' | 'ramp', min: [x,y,z], max: [x,y,z], dir: '+x'|'-x'|'+z'|'-z' (ramp rises toward dir), material }.

const World = {
  brushes: [],            // { shape, material, minX..maxZ, planes: Float32Array [nx,ny,nz,d, ...], planeCount, source }
  map: null,              // the loaded map row
  boundsMin: Vec.make(), boundsMax: Vec.make(),

  load(map) {
    this.map = map;
    this.brushes = map.brushes.map((source) => makeBrush(source));
    this.computeBounds();
    Bus.emit('world.load', map);
  },
  clear() { this.map = null; this.brushes = []; },
  computeBounds() {
    Vec.set(this.boundsMin, Infinity, Infinity, Infinity);
    Vec.set(this.boundsMax, -Infinity, -Infinity, -Infinity);
    for (const b of this.brushes) {
      this.boundsMin.x = Math.min(this.boundsMin.x, b.minX); this.boundsMin.y = Math.min(this.boundsMin.y, b.minY); this.boundsMin.z = Math.min(this.boundsMin.z, b.minZ);
      this.boundsMax.x = Math.max(this.boundsMax.x, b.maxX); this.boundsMax.y = Math.max(this.boundsMax.y, b.maxY); this.boundsMax.z = Math.max(this.boundsMax.z, b.maxZ);
    }
  },
  // Ray against all brushes; direction must be normalized. Fills hit {distance, x,y,z, nx,ny,nz, brush}; returns true on a hit.
  raycast(ox, oy, oz, dx, dy, dz, maxDistance, hit) {
    let best = maxDistance, found = false;
    for (let i = 0; i < this.brushes.length; i++) {
      const brush = this.brushes[i];
      if (!rayHitsBox(ox, oy, oz, dx, dy, dz, best, brush)) continue;
      if (rayVersusBrush(ox, oy, oz, dx, dy, dz, best, brush, hit)) { best = hit.distance; found = true; }
    }
    if (found) { hit.x = ox + dx * best; hit.y = oy + dy * best; hit.z = oz + dz * best; }
    return found;
  },
  // True when nothing solid lies between the two points (bot line of sight, splash occlusion).
  lineClear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) return true;
    return !this.raycast(ax, ay, az, dx / length, dy / length, dz / length, length, scratchHit);
  },
  pointInside(x, y, z) {
    for (let i = 0; i < this.brushes.length; i++) if (pointInBrush(x, y, z, this.brushes[i], 0)) return true;
    return false;
  },
};

const scratchHit = { distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null };
const makeHit = () => ({ distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null });

function makeBrush(source) {
  const [minX, minY, minZ] = source.min, [maxX, maxY, maxZ] = source.max;
  const planes = [];
  const addPlane = (nx, ny, nz, px, py, pz) => { const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; planes.push(nx, ny, nz, nx * px + ny * py + nz * pz); };
  addPlane(-1, 0, 0, minX, 0, 0); addPlane(1, 0, 0, maxX, 0, 0);
  addPlane(0, 0, -1, 0, 0, minZ); addPlane(0, 0, 1, 0, 0, maxZ);
  addPlane(0, -1, 0, 0, minY, 0);
  if (source.shape === 'ramp') {
    // Top plane passes through the low edge (height minY) and the high edge (height maxY).
    const rise = maxY - minY;
    if (source.dir === '+x') addPlane(-rise, maxX - minX, 0, minX, minY, 0);
    else if (source.dir === '-x') addPlane(rise, maxX - minX, 0, maxX, minY, 0);
    else if (source.dir === '+z') addPlane(0, maxZ - minZ, -rise, 0, minY, minZ);
    else addPlane(0, maxZ - minZ, rise, 0, minY, maxZ);
  } else {
    addPlane(0, 1, 0, 0, maxY, 0);
  }
  return { shape: source.shape || 'box', material: source.material || 'concrete', source, minX, minY, minZ, maxX, maxY, maxZ,
    planes: new Float32Array(planes), planeCount: planes.length / 4 };
}

function rayHitsBox(ox, oy, oz, dx, dy, dz, maxDistance, box) {
  let near = 0, far = maxDistance;
  const axis = (origin, direction, low, high) => {
    if (Math.abs(direction) < 1e-9) return origin >= low && origin <= high;
    let t1 = (low - origin) / direction, t2 = (high - origin) / direction;
    if (t1 > t2) { const keep = t1; t1 = t2; t2 = keep; }
    if (t1 > near) near = t1;
    if (t2 < far) far = t2;
    return near <= far;
  };
  return axis(ox, dx, box.minX, box.maxX) && axis(oy, dy, box.minY, box.maxY) && axis(oz, dz, box.minZ, box.maxZ);
}

// Clips the ray against every plane of a convex brush. A ray starting inside reports a hit at distance 0.
function rayVersusBrush(ox, oy, oz, dx, dy, dz, maxDistance, brush, hit) {
  let enter = -Infinity, exit = maxDistance, enterPlane = -1;
  const p = brush.planes;
  for (let i = 0; i < brush.planeCount; i++) {
    const nx = p[i * 4], ny = p[i * 4 + 1], nz = p[i * 4 + 2], offset = p[i * 4 + 3];
    const outside = nx * ox + ny * oy + nz * oz - offset;   // > 0: origin is in front of this plane
    const along = nx * dx + ny * dy + nz * dz;
    if (Math.abs(along) < 1e-9) { if (outside > 0) return false; continue; }
    const t = -outside / along;
    if (along < 0) { if (t > enter) { enter = t; enterPlane = i; } } else if (t < exit) exit = t;
    if (enter > exit) return false;
  }
  if (enterPlane < 0 || enter < 0) { // origin inside the brush
    hit.distance = 0; hit.nx = -dx; hit.ny = -dy; hit.nz = -dz; hit.brush = brush;
    return true;
  }
  if (enter > maxDistance) return false;
  hit.distance = enter; hit.nx = p[enterPlane * 4]; hit.ny = p[enterPlane * 4 + 1]; hit.nz = p[enterPlane * 4 + 2]; hit.brush = brush;
  return true;
}

function pointInBrush(x, y, z, brush, margin) {
  const p = brush.planes;
  for (let i = 0; i < brush.planeCount; i++) if (p[i * 4] * x + p[i * 4 + 1] * y + p[i * 4 + 2] * z - p[i * 4 + 3] > margin) return false;
  return true;
}
