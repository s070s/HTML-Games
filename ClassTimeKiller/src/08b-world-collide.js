// S08 add-on: hull sweeps for movers (actors, rigid bodies). A mover gathers nearby brushes once per step, then runs
// traces against that short list: collide-and-slide with plane-by-plane velocity clipping (up to 3 planes), step-up,
// ground probe, overlap tests and depenetration (ARC-013). Every move is swept, so fast movers never tunnel.

const COLLISION_SKIN = 0.005;          // metres kept between a hull and a surface (stops float rounding from sinking in)
const MAX_CANDIDATES = 256;            // brushes near one mover; a step never needs more
const MAX_CLIP_PLANES = 5;             // planes remembered during one slide (3 independent ones stop the move)
const SLIDE_BUMPS = 4;                 // trace / clip rounds per slide
const OVERCLIP = 1.001;                // push slightly off a clipped plane so the next trace does not touch it again
const SAME_PLANE_DOT = 0.99;
const DEPENETRATE_PASSES = 4;
const GATHER_MARGIN = 0.25;            // extra metres around a mover's sweep when collecting candidate brushes
const WALKABLE_NORMAL_Y = Math.cos(45 * DEG) - 1e-4; // DATA-003: slopes up to 45 deg are floor
const ACTOR_RADIUS = 0.40;             // DATA-003 capsule radius
const STEP_HEIGHT = 0.45;              // DATA-003 step-up height
const ACTOR_STAND_HEIGHT = 1.80;       // DATA-003 standing capsule height; hit volumes scale by height / this

const makeTrace = () => ({ fraction: 1, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null, startSolid: false, allSolid: false });
const makeMover = () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hull: makeHull(), planes: new Float32Array(MAX_CLIP_PLANES * 3), planeCount: 0,
  lastBrush: null });

const Collide = {
  candidates: new Array(MAX_CANDIDATES).fill(null),
  candidateCount: 0,
  trace: makeTrace(),          // scratch result for callers that do not keep their own

  // Collects the brushes whose box touches the given box (static tree + dynamic props) for the traces that follow.
  gather(minX, minY, minZ, maxX, maxY, maxZ) {
    const query = gatherQuery;
    query.minX = minX; query.minY = minY; query.minZ = minZ; query.maxX = maxX; query.maxY = maxY; query.maxZ = maxZ;
    this.candidateCount = 0;
    walkTree(World.tree, query, boxTestNode, gatherBrush);
    for (let i = 0; i < World.dynamic.length; i++) gatherBrush(query, World.dynamic[i]);
  },
  // Gathers everything the mover's hull can touch while moving up to `reach` metres from where it stands.
  gatherAround(mover, reach) {
    const side = hullSide(mover.hull) + reach + GATHER_MARGIN;
    this.gather(mover.x - side, mover.y - hullBelow(mover.hull) - reach - GATHER_MARGIN, mover.z - side,
      mover.x + side, mover.y + hullAbove(mover.hull) + reach + GATHER_MARGIN, mover.z + side);
  },
  // Sweeps the hull from start to end against the gathered brushes. Moves that start inside a brush and leave it
  // ignore that brush (so a stuck mover can walk out); a move that stays inside reports allSolid with fraction 0.
  sweep(sx, sy, sz, ex, ey, ez, hull, out) {
    out.fraction = 1; out.brush = null; out.startSolid = false; out.allSolid = false;
    const side = hullSide(hull), below = hullBelow(hull), above = hullAbove(hull);
    const minX = Math.min(sx, ex) - side, minY = Math.min(sy, ey) - below, minZ = Math.min(sz, ez) - side;
    const maxX = Math.max(sx, ex) + side, maxY = Math.max(sy, ey) + above, maxZ = Math.max(sz, ez) + side;
    for (let i = 0; i < this.candidateCount; i++) {
      const brush = this.candidates[i];
      if (brush.maxX < minX || brush.minX > maxX || brush.maxY < minY || brush.minY > maxY || brush.maxZ < minZ || brush.minZ > maxZ) continue;
      const fraction = clipBrush(brush, sx, sy, sz, ex, ey, ez, hull, COLLISION_SKIN);
      if (fraction < 0 || fraction >= out.fraction) continue;
      if (clipResult.startSolid) { recordSolid(out, clipResult.allSolid, brush); continue; }
      out.fraction = fraction; out.brush = brush; out.nx = clipResult.nx; out.ny = clipResult.ny; out.nz = clipResult.nz;
    }
    out.x = sx + (ex - sx) * out.fraction; out.y = sy + (ey - sy) * out.fraction; out.z = sz + (ez - sz) * out.fraction;
    return out.fraction < 1;
  },
  // True when the hull placed at (x,y,z) overlaps any gathered brush.
  overlaps(x, y, z, hull) {
    for (let i = 0; i < this.candidateCount; i++) if (insideGrown(this.candidates[i], x, y, z, hull, -COLLISION_SKIN * 0.5) !== null) return true;
    return false;
  },
  // Slides the mover through its velocity for dt seconds; clips velocity against every surface it touches.
  // mover.planeCount may be preset (e.g. 1 = the ground plane) so the move follows that plane. Returns true on contact.
  slide(mover, dt) {
    const primalX = mover.vx, primalY = mover.vy, primalZ = mover.vz;
    let timeLeft = dt, touched = false;
    for (let bump = 0; bump < SLIDE_BUMPS && timeLeft > 0; bump++) {
      const trace = this.trace;
      this.sweep(mover.x, mover.y, mover.z, mover.x + mover.vx * timeLeft, mover.y + mover.vy * timeLeft, mover.z + mover.vz * timeLeft, mover.hull, trace);
      if (trace.allSolid) { mover.vy = 0; return true; }
      mover.x = trace.x; mover.y = trace.y; mover.z = trace.z;
      if (trace.fraction >= 1) break;
      touched = true;
      mover.lastBrush = trace.brush;
      timeLeft -= timeLeft * trace.fraction;
      if (!addClipPlane(mover, trace.nx, trace.ny, trace.nz)) { setVelocity(mover, 0, 0, 0); break; }
      if (!resolveVelocity(mover) || mover.vx * primalX + mover.vy * primalY + mover.vz * primalZ <= 0) { setVelocity(mover, 0, 0, 0); break; }
    }
    return touched;
  },
  // Slide with step-up (stairs, kerbs up to stepHeight): when the plain slide was blocked, also try "up, across, down"
  // and keep whichever went further on the ground plane.
  stepSlide(mover, dt, stepHeight) {
    const startX = mover.x, startY = mover.y, startZ = mover.z, startVX = mover.vx, startVY = mover.vy, startVZ = mover.vz;
    if (!this.slide(mover, dt)) return false;
    saveMover(stepSave, mover);
    const trace = this.trace;
    this.sweep(startX, startY, startZ, startX, startY + stepHeight, startZ, mover.hull, trace);
    if (trace.allSolid || trace.y - startY < COLLISION_SKIN) { loadMover(mover, stepSave); return true; }
    const raised = trace.y - startY;
    mover.x = startX; mover.y = trace.y; mover.z = startZ; setVelocity(mover, startVX, startVY, startVZ); mover.planeCount = 0;
    this.slide(mover, dt);
    this.sweep(mover.x, mover.y, mover.z, mover.x, mover.y - raised - COLLISION_SKIN * 2, mover.z, mover.hull, trace);
    const landed = !trace.allSolid && trace.fraction < 1 && trace.ny >= WALKABLE_NORMAL_Y;
    const stepDistance = (mover.x - startX) ** 2 + (mover.z - startZ) ** 2, plainDistance = (stepSave.x - startX) ** 2 + (stepSave.z - startZ) ** 2;
    if (!landed || stepDistance <= plainDistance + 1e-8) { loadMover(mover, stepSave); return true; }
    mover.y = trace.y;
    return true;
  },
  // Looks down from the mover by `distance`; fills out and returns true when it finds walkable floor.
  probeGround(mover, distance, out) {
    this.sweep(mover.x, mover.y, mover.z, mover.x, mover.y - distance, mover.z, mover.hull, out);
    return out.fraction < 1 && !out.allSolid && out.ny >= WALKABLE_NORMAL_Y;
  },
  // Pushes a mover that ended up inside geometry out along the shallowest face. Returns true when it is free.
  depenetrate(mover) {
    for (let pass = 0; pass < DEPENETRATE_PASSES; pass++) {
      const push = deepestOverlap(mover);
      if (push === null) return true;
      mover.x += push.nx * push.depth; mover.y += push.ny * push.depth; mover.z += push.nz * push.depth;
    }
    return deepestOverlap(mover) === null;
  },
};

const gatherQuery = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
const stepSave = makeMover();
const overlapPush = { nx: 0, ny: 0, nz: 0, depth: 0 };

function boxTestNode(query, bounds, base) {
  return bounds[base] <= query.maxX && bounds[base + 3] >= query.minX && bounds[base + 1] <= query.maxY
    && bounds[base + 4] >= query.minY && bounds[base + 2] <= query.maxZ && bounds[base + 5] >= query.minZ;
}

function gatherBrush(query, brush) {
  if (Collide.candidateCount >= MAX_CANDIDATES) return;
  if (brush.maxX < query.minX || brush.minX > query.maxX || brush.maxY < query.minY || brush.minY > query.maxY) return;
  if (brush.maxZ < query.minZ || brush.minZ > query.maxZ) return;
  Collide.candidates[Collide.candidateCount++] = brush;
}

function recordSolid(out, allSolid, brush) {
  out.startSolid = true;
  if (!allSolid) return;
  out.allSolid = true; out.fraction = 0; out.brush = brush; out.nx = 0; out.ny = 1; out.nz = 0;
}

// Returns the face the point is least deep behind when (x,y,z) lies inside the brush grown by the hull, else null.
function insideGrown(brush, x, y, z, hull, margin) {
  const p = brush.planes;
  let best = -Infinity, plane = -1;
  for (let i = 0; i < brush.planeCount; i++) {
    const nx = p[i * 4], ny = p[i * 4 + 1], nz = p[i * 4 + 2];
    const distance = nx * x + ny * y + nz * z - p[i * 4 + 3] - hullOffset(hull, nx, ny, nz);
    if (distance > margin) return null;
    if (distance > best) { best = distance; plane = i; }
  }
  overlapPush.nx = p[plane * 4]; overlapPush.ny = p[plane * 4 + 1]; overlapPush.nz = p[plane * 4 + 2]; overlapPush.depth = -best + COLLISION_SKIN;
  return overlapPush;
}

function deepestOverlap(mover) {
  for (let i = 0; i < Collide.candidateCount; i++) {
    const push = insideGrown(Collide.candidates[i], mover.x, mover.y, mover.z, mover.hull, -COLLISION_SKIN * 0.5);
    if (push !== null) return push;
  }
  return null;
}

function setVelocity(mover, vx, vy, vz) { mover.vx = vx; mover.vy = vy; mover.vz = vz; }

function saveMover(target, mover) {
  target.x = mover.x; target.y = mover.y; target.z = mover.z; target.vx = mover.vx; target.vy = mover.vy; target.vz = mover.vz;
  target.planeCount = mover.planeCount; target.planes.set(mover.planes); target.lastBrush = mover.lastBrush;
}

function loadMover(mover, saved) { saveMover(mover, saved); }

// Remembers a touched plane; a plane hit again gets a tiny push instead (stops jitter in a corner). False when full.
function addClipPlane(mover, nx, ny, nz) {
  const planes = mover.planes;
  for (let i = 0; i < mover.planeCount; i++) {
    if (planes[i * 3] * nx + planes[i * 3 + 1] * ny + planes[i * 3 + 2] * nz < SAME_PLANE_DOT) continue;
    mover.vx += nx * COLLISION_SKIN; mover.vy += ny * COLLISION_SKIN; mover.vz += nz * COLLISION_SKIN;
    return true;
  }
  if (mover.planeCount >= MAX_CLIP_PLANES) return false;
  planes[mover.planeCount * 3] = nx; planes[mover.planeCount * 3 + 1] = ny; planes[mover.planeCount * 3 + 2] = nz;
  mover.planeCount++;
  return true;
}

// Removes the part of the velocity that points into the plane (with a hair of overclip).
function clipVelocity(mover, nx, ny, nz) {
  const into = mover.vx * nx + mover.vy * ny + mover.vz * nz;
  if (into >= 0) return;
  const backoff = into * OVERCLIP;
  mover.vx -= nx * backoff; mover.vy -= ny * backoff; mover.vz -= nz * backoff;
}

// Velocity that respects every touched plane: clip against one plane if that satisfies the others, else slide
// along the crease of the last two planes; three planes that disagree stop the mover.
function resolveVelocity(mover) {
  const planes = mover.planes, vx = mover.vx, vy = mover.vy, vz = mover.vz;
  for (let i = 0; i < mover.planeCount; i++) {
    setVelocity(mover, vx, vy, vz);
    clipVelocity(mover, planes[i * 3], planes[i * 3 + 1], planes[i * 3 + 2]);
    if (respectsPlanes(mover, i, i)) return true;
  }
  if (mover.planeCount < 2) return false;
  const a = (mover.planeCount - 2) * 3, b = (mover.planeCount - 1) * 3;
  let cx = planes[a + 1] * planes[b + 2] - planes[a + 2] * planes[b + 1];
  let cy = planes[a + 2] * planes[b] - planes[a] * planes[b + 2];
  let cz = planes[a] * planes[b + 1] - planes[a + 1] * planes[b];
  const length = Math.hypot(cx, cy, cz);
  if (length < 1e-6) return false;
  cx /= length; cy /= length; cz /= length;
  const along = cx * vx + cy * vy + cz * vz;
  setVelocity(mover, cx * along, cy * along, cz * along);
  return respectsPlanes(mover, mover.planeCount - 2, mover.planeCount - 1);
}

function respectsPlanes(mover, skipA, skipB) {
  const planes = mover.planes;
  for (let j = 0; j < mover.planeCount; j++) {
    if (j === skipA || j === skipB) continue;
    if (mover.vx * planes[j * 3] + mover.vy * planes[j * 3 + 1] + mover.vz * planes[j * 3 + 2] < -1e-4) return false;
  }
  return true;
}

// ---- Queries for other sections (spawns, nav, items): each gathers its own candidates ----
const queryMover = makeMover();

// True when a standing capsule of this height fits with its feet at (x,y,z) (DATA-003 radius 0.40).
World.capsuleFits = function capsuleFits(x, y, z, radius, height) {
  const mover = queryMover;
  mover.x = x; mover.y = y; mover.z = z;
  setCapsuleHull(mover.hull, radius, height);
  Collide.gatherAround(mover, 0);
  return !Collide.overlaps(x, y, z, mover.hull);
};

// Sweeps a capsule from a to b; fills out (a trace) and returns true when something blocks it.
World.sweepCapsule = function sweepCapsule(ax, ay, az, bx, by, bz, radius, height, out) {
  const mover = queryMover;
  mover.x = (ax + bx) / 2; mover.y = Math.min(ay, by); mover.z = (az + bz) / 2;
  setCapsuleHull(mover.hull, radius, height);
  Collide.gatherAround(mover, Math.hypot(bx - ax, by - ay, bz - az) / 2 + Math.abs(by - ay));
  return Collide.sweep(ax, ay, az, bx, by, bz, mover.hull, out);
};

// Height of walkable floor under (x,y,z) within maxDrop metres, or NaN. hit (optional) receives the ray hit.
World.floorBelow = function floorBelow(x, y, z, maxDrop, hit) {
  const target = hit || scratchHit;
  if (!World.raycast(x, y, z, 0, -1, 0, maxDrop, target) || target.ny < WALKABLE_NORMAL_Y) return NaN;
  return target.y;
};

// True when a sphere of the radius around (x,y,z) touches the world (splash checks, item placement).
World.sphereTouches = function sphereTouches(x, y, z, radius) {
  const mover = queryMover;
  mover.x = x; mover.y = y; mover.z = z;
  setSphereHull(mover.hull, radius);
  Collide.gatherAround(mover, 0);
  return Collide.overlaps(x, y, z, mover.hull);
};

// ---- Actor hit volumes (DATA-003, ARC-014): head sphere on the eye, torso and legs cylinders scaled by height / 1.8 ----
const HEAD_RADIUS = 0.14, HEAD_ABOVE_EYE = 0.04;
const TORSO_RADIUS = 0.30, TORSO_LOW = 0.85, TORSO_HIGH = 1.45;
const LEGS_RADIUS = 0.22, LEGS_LOW = 0.05, LEGS_HIGH = 0.85;
const makeActorHit = () => ({ distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null, actor: -1, zone: 'none' });
const zoneResult = { zone: 'none' };

// Nearest live actor hit volume along a normalized ray (ignoring one actor, e.g. the shooter). Fills hit (from
// makeActorHit) with distance, point, actor and zone 'head' | 'body' | 'legs'; returns the actor id or -1.
// Walls are not checked: compare with World.raycast (hitscan order ARC-014: world first, then actors).
World.raycastActors = function raycastActors(ox, oy, oz, dx, dy, dz, maxDistance, ignoreId, hit) {
  let best = maxDistance, found = -1, zone = 'none';
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id] || id === ignoreId) continue;
    const x = Actors.x[id], y = Actors.y[id], z = Actors.z[id], top = y + Math.max(Actors.height[id], Actors.eye[id] + HEAD_ABOVE_EYE + HEAD_RADIUS);
    if (!rayHitsBounds(ox, oy, oz, dx, dy, dz, best, x - ACTOR_RADIUS, y, z - ACTOR_RADIUS, x + ACTOR_RADIUS, top, z + ACTOR_RADIUS)) continue;
    const distance = rayActorDistance(id, ox, oy, oz, dx, dy, dz);
    if (distance < 0 || distance >= best) continue;
    best = distance; found = id; zone = zoneResult.zone;
  }
  if (found < 0) return -1;
  hit.distance = best; hit.x = ox + dx * best; hit.y = oy + dy * best; hit.z = oz + dz * best;
  hit.nx = -dx; hit.ny = -dy; hit.nz = -dz; hit.brush = null; hit.actor = found; hit.zone = zone;
  return found;
};

// Writes the ids of live actors whose capsule touches the sphere into out (array); returns how many.
World.actorsInSphere = function actorsInSphere(x, y, z, radius, out) {
  let count = 0;
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id]) continue;
    const nearestY = clamp(y, Actors.y[id] + ACTOR_RADIUS, Actors.y[id] + Math.max(ACTOR_RADIUS, Actors.height[id] - ACTOR_RADIUS));
    const reach = radius + ACTOR_RADIUS;
    if (distanceSquared3(x, y, z, Actors.x[id], nearestY, Actors.z[id]) <= reach * reach) out[count++] = id;
  }
  return count;
};

// Writes the ids of live actors whose chest lies within range and the cone (cosine of the half angle) into out.
World.actorsInCone = function actorsInCone(ox, oy, oz, dx, dy, dz, cosHalfAngle, range, ignoreId, out) {
  let count = 0;
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id] || id === ignoreId) continue;
    const vx = Actors.x[id] - ox, vy = Actors.y[id] + Actors.height[id] * 0.6 - oy, vz = Actors.z[id] - oz, distance = Math.hypot(vx, vy, vz);
    if (distance > range || distance < 1e-6) continue;
    if ((vx * dx + vy * dy + vz * dz) / distance >= cosHalfAngle) out[count++] = id;
  }
  return count;
};

function rayActorDistance(id, ox, oy, oz, dx, dy, dz) {
  const x = Actors.x[id], y = Actors.y[id], z = Actors.z[id], scale = Actors.height[id] / ACTOR_STAND_HEIGHT;
  const head = raySphereDistance(ox, oy, oz, dx, dy, dz, x, y + Actors.eye[id] + HEAD_ABOVE_EYE, z, HEAD_RADIUS);
  const torso = rayCylinderDistance(ox, oy, oz, dx, dy, dz, x, y + TORSO_LOW * scale, y + TORSO_HIGH * scale, z, TORSO_RADIUS);
  const legs = rayCylinderDistance(ox, oy, oz, dx, dy, dz, x, y + LEGS_LOW * scale, y + LEGS_HIGH * scale, z, LEGS_RADIUS);
  const nearest = nearestDistance(nearestDistance(head, torso), legs);
  zoneResult.zone = nearest < 0 ? 'none' : nearest === head ? 'head' : nearest === torso ? 'body' : 'legs';
  return nearest;
}

const nearestDistance = (a, b) => (a < 0 ? b : b < 0 ? a : Math.min(a, b));

// Ray against a sphere: entry distance (0 when the origin is inside) or -1.
function raySphereDistance(ox, oy, oz, dx, dy, dz, cx, cy, cz, radius) {
  const px = cx - ox, py = cy - oy, pz = cz - oz, centerSquared = px * px + py * py + pz * pz;
  if (centerSquared <= radius * radius) return 0;
  const along = px * dx + py * dy + pz * dz;
  if (along < 0) return -1;
  const closestSquared = centerSquared - along * along;
  if (closestSquared > radius * radius) return -1;
  return along - Math.sqrt(radius * radius - closestSquared);
}

// Ray against a vertical flat-capped cylinder spanning exactly bottomY..topY at x, z: the side wall plus both caps.
// Flat caps (not rounded ends) keep the head, body and legs zones from overlapping where they meet.
function rayCylinderDistance(ox, oy, oz, dx, dy, dz, x, bottomY, topY, z, radius) {
  const side = rayCylinderSide(ox, oy, oz, dx, dy, dz, x, bottomY, topY, z, radius);
  const low = rayDiscDistance(ox, oy, oz, dx, dy, dz, x, bottomY, z, radius);
  return nearestDistance(nearestDistance(side, low), rayDiscDistance(ox, oy, oz, dx, dy, dz, x, topY, z, radius));
}

function rayDiscDistance(ox, oy, oz, dx, dy, dz, x, discY, z, radius) {
  if (Math.abs(dy) < 1e-12) return -1;
  const distance = (discY - oy) / dy;
  if (distance < 0) return -1;
  const px = ox + dx * distance - x, pz = oz + dz * distance - z;
  return px * px + pz * pz <= radius * radius ? distance : -1;
}

function rayCylinderSide(ox, oy, oz, dx, dy, dz, x, bottomY, topY, z, radius) {
  const px = ox - x, pz = oz - z;
  const a = dx * dx + dz * dz, b = px * dx + pz * dz, c = px * px + pz * pz - radius * radius;
  if (a < 1e-12 || b * b - a * c < 0) return -1; // vertical rays reach a cylinder through its caps
  const distance = c <= 0 ? 0 : (-b - Math.sqrt(b * b - a * c)) / a;
  const y = oy + dy * distance;
  return distance >= 0 && y >= bottomY && y <= topY ? distance : -1;
}
