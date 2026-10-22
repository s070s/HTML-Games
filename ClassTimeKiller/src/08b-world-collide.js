// S08 add-on: hull sweeps for movers (actors, rigid bodies). A mover gathers nearby brushes once per step, then runs
// traces against that short list: collide-and-slide with plane-by-plane velocity clipping (up to 3 planes), step-up,
// ground probe, overlap tests and depenetration (ARC-013). Every move is swept, so fast movers never tunnel.

const COLLISION_SKIN = 0.005;          // metres kept between a hull and a surface (stops float rounding from sinking in)
const CANDIDATE_START_SIZE = 256;      // brushes near one mover; a crowded map grows the list once (never skips a brush)
const MAX_CLIP_PLANES = 5;             // planes remembered during one slide (3 independent ones stop the move)
const SLIDE_BUMPS = 4;                 // trace / clip rounds per slide
const OVERCLIP = 1.001;                // push slightly off a clipped plane so the next trace does not touch it again
const SAME_PLANE_DOT = 0.99;
const DEPENETRATE_PASSES = 4;
const GATHER_MARGIN = 0.25;            // extra metres around a mover's sweep when collecting candidate brushes
const WALKABLE_NORMAL_Y = Math.cos(45 * DEG) - 1e-4; // DATA-003: slopes up to 45 deg are floor

const makeTrace = () => ({ fraction: 1, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null, startSolid: false, allSolid: false });
// planes: normals of the surfaces touched during the current slide; planeBrushes[i]: the brush of planes[i].
const makeMover = () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hull: makeHull(), planes: new Float32Array(MAX_CLIP_PLANES * 3), planeCount: 0,
  planeBrushes: new Array(MAX_CLIP_PLANES).fill(null), lastBrush: null });

const Collide = {
  candidates: new Array(CANDIDATE_START_SIZE).fill(null),
  candidateCount: 0,
  trace: makeTrace(),         // scratch result for callers that do not keep their own

  // Collects the brushes whose box touches the given box (static tree + dynamic props) for the traces that follow.
  gather(minX, minY, minZ, maxX, maxY, maxZ) {
    const query = gatherQuery;
    query.minX = minX; query.minY = minY; query.minZ = minZ; query.maxX = maxX; query.maxY = maxY; query.maxZ = maxZ;
    this.candidateCount = 0;
    visitBox(query, gatherBrush);
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
    const query = startSweep(sx, sy, sz, ex, ey, ez, hull, out);
    for (let i = 0; i < this.candidateCount; i++) sweepTestBrush(query, this.candidates[i]);
    return finishSweep(query);
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
      if (!addClipPlane(mover, trace.nx, trace.ny, trace.nz, trace.brush)) { setVelocity(mover, 0, 0, 0); break; }
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
const sweepQuery = { sx: 0, sy: 0, sz: 0, ex: 0, ey: 0, ez: 0, hull: null, out: null, minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
const stepSave = makeMover();
const overlapPush = { nx: 0, ny: 0, nz: 0, depth: 0 };

function boxTestNode(query, bounds, base) {
  return bounds[base] <= query.maxX && bounds[base + 3] >= query.minX && bounds[base + 1] <= query.maxY
    && bounds[base + 4] >= query.minY && bounds[base + 2] <= query.maxZ && bounds[base + 5] >= query.minZ;
}

function brushTouchesBox(box, brush) {
  return brush.maxX >= box.minX && brush.minX <= box.maxX && brush.maxY >= box.minY && brush.minY <= box.maxY
    && brush.maxZ >= box.minZ && brush.minZ <= box.maxZ;
}

// Calls onBrush(query, brush) for the static brushes in tree leaves touching the query box, then for every prop.
function visitBox(query, onBrush) {
  walkTree(World.tree, query, boxTestNode, onBrush);
  for (let i = 0; i < World.dynamic.length; i++) onBrush(query, World.dynamic[i]);
}

// Past its start size the list simply grows (the array keeps that size afterwards, so steady play allocates nothing).
function gatherBrush(query, brush) {
  if (!brushTouchesBox(query, brush)) return;
  Collide.candidates[Collide.candidateCount++] = brush;
}

// One hull sweep start->end: the swept box limits which brushes get clipped; the nearest entry wins.
function startSweep(sx, sy, sz, ex, ey, ez, hull, out) {
  const query = sweepQuery, side = hullSide(hull), below = hullBelow(hull), above = hullAbove(hull);
  out.fraction = 1; out.brush = null; out.startSolid = false; out.allSolid = false;
  query.sx = sx; query.sy = sy; query.sz = sz; query.ex = ex; query.ey = ey; query.ez = ez; query.hull = hull; query.out = out;
  query.minX = Math.min(sx, ex) - side; query.minY = Math.min(sy, ey) - below; query.minZ = Math.min(sz, ez) - side;
  query.maxX = Math.max(sx, ex) + side; query.maxY = Math.max(sy, ey) + above; query.maxZ = Math.max(sz, ez) + side;
  return query;
}

function sweepTestBrush(query, brush) {
  if (!brushTouchesBox(query, brush)) return;
  const out = query.out;
  const fraction = clipBrush(brush, query.sx, query.sy, query.sz, query.ex, query.ey, query.ez, query.hull, COLLISION_SKIN);
  if (fraction < 0 || fraction >= out.fraction) return;
  if (clipResult.startSolid) { recordSolid(out, clipResult.allSolid, brush); return; }
  out.fraction = fraction; out.brush = brush; out.nx = clipResult.nx; out.ny = clipResult.ny; out.nz = clipResult.nz;
}

function finishSweep(query) {
  const out = query.out;
  out.x = query.sx + (query.ex - query.sx) * out.fraction; out.y = query.sy + (query.ey - query.sy) * out.fraction;
  out.z = query.sz + (query.ez - query.sz) * out.fraction;
  return out.fraction < 1;
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
    const push = insideGrown(Collide.candidates[i], mover.x, mover.y, mover.z, mover.hull, 0);
    if (push !== null) return push;
  }
  return null;
}

function setVelocity(mover, vx, vy, vz) { mover.vx = vx; mover.vy = vy; mover.vz = vz; }

function saveMover(target, mover) {
  target.x = mover.x; target.y = mover.y; target.z = mover.z; target.vx = mover.vx; target.vy = mover.vy; target.vz = mover.vz;
  target.planeCount = mover.planeCount; target.planes.set(mover.planes); target.lastBrush = mover.lastBrush;
  for (let i = 0; i < MAX_CLIP_PLANES; i++) target.planeBrushes[i] = mover.planeBrushes[i];
}

function loadMover(mover, saved) { saveMover(mover, saved); }

// Remembers a touched plane and its brush; a plane hit again gets a tiny push instead (stops jitter in a corner).
// False when full.
function addClipPlane(mover, nx, ny, nz, brush) {
  const planes = mover.planes;
  for (let i = 0; i < mover.planeCount; i++) {
    if (planes[i * 3] * nx + planes[i * 3 + 1] * ny + planes[i * 3 + 2] * nz < SAME_PLANE_DOT) continue;
    mover.vx += nx * COLLISION_SKIN; mover.vy += ny * COLLISION_SKIN; mover.vz += nz * COLLISION_SKIN;
    return true;
  }
  if (mover.planeCount >= MAX_CLIP_PLANES) return false;
  planes[mover.planeCount * 3] = nx; planes[mover.planeCount * 3 + 1] = ny; planes[mover.planeCount * 3 + 2] = nz;
  mover.planeBrushes[mover.planeCount] = brush;
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

// Sweeps a capsule from a to b; fills out (a trace) and returns true when something blocks it. It walks the tree
// directly (no capped candidate list), so a sweep of any length tests every brush along its path.
World.sweepCapsule = function sweepCapsule(ax, ay, az, bx, by, bz, radius, height, out) {
  const query = startSweep(ax, ay, az, bx, by, bz, setCapsuleHull(queryMover.hull, radius, height), out);
  visitBox(query, sweepTestBrush);
  return finishSweep(query);
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

const makeActorHit = () => ({ distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null, actor: -1, zone: 'none' });

// ---- Actor hit volumes (DATA-003, ARC-014): head sphere, torso and legs as upright cylinders that never overlap, scaled when crouched ----
const ACTOR_REJECT_RADIUS = 1.2;         // every hit volume lies within this distance of the actor's middle

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, radius) {
  const px = ox - cx, py = oy - cy, pz = oz - cz;
  const b = px * dx + py * dy + pz * dz, c = px * px + py * py + pz * pz - radius * radius;
  if (c <= 0) return 0;
  const disc = b * b - c;
  if (b > 0 || disc < 0) return -1;
  return -b - Math.sqrt(disc);
}
function rayCap(ox, oy, oz, dx, dy, dz, cx, cz, capY, radius) {
  const t = (capY - oy) / dy;
  if (t < 0) return -1;
  const hx = ox + dx * t - cx, hz = oz + dz * t - cz;
  return hx * hx + hz * hz <= radius * radius ? t : -1;
}
function nearestHit(a, b) { return a < 0 ? b : b < 0 ? a : Math.min(a, b); }
// Upright cylinder from y0 to y1: side wall plus the two caps. Returns the entry distance or -1.
function rayCylinder(ox, oy, oz, dx, dy, dz, cx, cz, y0, y1, radius) {
  const px = ox - cx, pz = oz - cz;
  const a = dx * dx + dz * dz, b = px * dx + pz * dz, c = px * px + pz * pz - radius * radius;
  if (c <= 0 && oy >= y0 && oy <= y1) return 0;
  let best = -1;
  const disc = b * b - a * c;
  if (a > 1e-9 && disc >= 0) {
    const t = (-b - Math.sqrt(disc)) / a, y = oy + dy * t;
    if (t >= 0 && y >= y0 && y <= y1) best = t;
  }
  if (Math.abs(dy) < 1e-9) return best;
  return nearestHit(best, nearestHit(rayCap(ox, oy, oz, dx, dy, dz, cx, cz, y0, radius), rayCap(ox, oy, oz, dx, dy, dz, cx, cz, y1, radius)));
}

const Hitbox = {
  zone: ZONE.NONE,
  stomach: false,
  sizeScale: new Float32Array(MAX_ACTORS).fill(1),   // per actor body size factor (mutators X31 growth, X39 diminish)
  headScale: new Float32Array(MAX_ACTORS).fill(1),   // per actor head size factor (mutator X14)
  // Nearest hit volume of actor id along a normalized ray; inflate grows every volume (melee, projectile radius).
  // Returns the distance or -1 and leaves the zone in Hitbox.zone.
  ray(id, ox, oy, oz, dx, dy, dz, maxDistance, inflate) {
    const x = Actors.x[id], y = Actors.y[id], z = Actors.z[id], scale = Actors.height[id] / STAND_HEIGHT * this.sizeScale[id];
    const mx = x - ox, my = y + 0.9 * scale - oy, mz = z - oz, along = mx * dx + my * dy + mz * dz;
    const reject = ACTOR_REJECT_RADIUS * Math.max(1, this.sizeScale[id]) + inflate;
    if (along < -reject || along > maxDistance + reject) return -1;
    if (mx * mx + my * my + mz * mz - along * along > reject * reject) return -1;
    let best = -1;
    this.zone = ZONE.NONE;
    const head = raySphere(ox, oy, oz, dx, dy, dz, x, y + Actors.eye[id] + HEAD_ABOVE_EYE, z, HEAD_RADIUS * this.headScale[id] + inflate);
    if (head >= 0) { best = head; this.zone = ZONE.HEAD; }
    const torso = rayCylinder(ox, oy, oz, dx, dy, dz, x, z, y + TORSO_LOW * scale, y + TORSO_HIGH * scale, TORSO_RADIUS + inflate);
    if (torso >= 0 && (best < 0 || torso < best)) { best = torso; this.zone = ZONE.BODY; }
    const legs = rayCylinder(ox, oy, oz, dx, dy, dz, x, z, y + LEGS_LOW * scale, y + LEGS_HIGH * scale, LEGS_RADIUS + inflate);
    if (legs >= 0 && (best < 0 || legs < best)) { best = legs; this.zone = ZONE.LEGS; }
    if (best > maxDistance) { this.zone = ZONE.NONE; return -1; }
    this.stomach = this.zone === ZONE.BODY && oy + dy * best < y + STOMACH_HIGH * scale;
    return best;
  },
  // Centre of a zone (bots, aim assist, lock-on, homing).
  point(id, zone, out) {
    const scale = Actors.height[id] / STAND_HEIGHT * this.sizeScale[id];
    let height = (TORSO_LOW + TORSO_HIGH) * 0.5 * scale;
    if (zone === ZONE.HEAD) height = Actors.eye[id] + HEAD_ABOVE_EYE;
    if (zone === ZONE.LEGS) height = (LEGS_LOW + LEGS_HIGH) * 0.5 * scale;
    return Vec.set(out, Actors.x[id], Actors.y[id] + height, Actors.z[id]);
  },
};

// Nearest live actor hit volume along a normalized ray (ignoring one actor, e.g. the shooter). Fills hit (from
// makeActorHit) with distance, point, actor and zone 'head' | 'body' | 'legs'; returns the actor id or -1.
// Walls are not checked: compare with World.raycast (hitscan order ARC-014: world first, then actors).
World.raycastActors = function raycastActors(ox, oy, oz, dx, dy, dz, maxDistance, ignoreId, hit) {
  let best = maxDistance, found = -1, zone = ZONE.NONE;
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id] || id === ignoreId) continue;
    const distance = Hitbox.ray(id, ox, oy, oz, dx, dy, dz, best, 0);
    if (distance < 0 || distance >= best) continue;
    best = distance; found = id; zone = Hitbox.zone;
  }
  if (found < 0) return -1;
  hit.distance = best; hit.x = ox + dx * best; hit.y = oy + dy * best; hit.z = oz + dz * best;
  hit.nx = -dx; hit.ny = -dy; hit.nz = -dz; hit.brush = null; hit.actor = found; hit.zone = ZONE_NAMES[zone];
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
