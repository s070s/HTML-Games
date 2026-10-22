// S08 add-on: simple rigid bodies (thrown items, debris) and destructible props (step 4.4, MAP-013, PERF-010).
// Bodies are spheres or boxes that slide and bounce on the world, sleep after 1 s at rest and never touch each other
// (no stacking, no joints). map.props = [{ min, max, health, material, mass, debris, color }] are solid boxes that
// block actors and rays until destroyed; then they break into 4-8 debris bodies. Every prop is solid whatever the
// video quality (gameplay geometry never depends on it); only the first Quality.current().props of a map can break,
// and live debris is capped the same way (MAP-013, PERF-010).

const BODY_CAPACITY = 20;              // step 4.4: 6-20 bodies
const BODY_SHAPE = { SPHERE: 0, BOX: 1 };
const BODY_KIND = { THROWN: 0, DEBRIS: 1 };
const BODY_SLEEP_SPEED = 0.15;         // m/s under which a body on the ground counts as resting
const BODY_SLEEP_SECONDS = 1;          // step 4.4 / MAP-013
const BODY_RESTITUTION = 0.3;          // fraction of the into-surface speed bounced back (< 1: energy only leaves)
const BODY_BOUNCE_MIN_SPEED = 1;       // slower impacts just stop instead of jittering
const BODY_GROUND_FRICTION = 4;        // 1/s horizontal damping while touching the floor
const BODY_MAX_SPEED = 40;
const BODY_IMPACT_MIN_SPEED = 6;       // thrown bodies faster than this hurt the actors they hit
const BODY_IMPACT_DAMAGE_PER_MOMENTUM = 0.05; // HP per kg*m/s
const BODY_IMPACT_MAX_DAMAGE = 40;     // impact damage is clamped
const BODY_IMPACT_COOLDOWN = 0.5;
const DEBRIS_LINGER_SECONDS = 3;       // a sleeping debris piece stays this long, then frees its slot
const DEBRIS_MIN_PIECES = 4, DEBRIS_MAX_PIECES = 8;
const DEBRIS_SPEED = 4;                // m/s scatter of new debris
const EXPLOSION_PROP_DAMAGE = 100;     // damage at the explosion centre, falling to 0 at its radius
const EXPLOSION_BODY_IMPULSE = 120;    // kg*m/s at the centre
const BREAK_NOISE_RADIUS = 30;
const PROP_FIELDS = { min: REQUIRED, max: REQUIRED, health: 50, material: 'wood', mass: 20, debris: 6, color: 0x8a6a45 };

const Bodies = {
  active: new Uint8Array(BODY_CAPACITY), sleeping: new Uint8Array(BODY_CAPACITY),
  shape: new Uint8Array(BODY_CAPACITY), kind: new Uint8Array(BODY_CAPACITY), owner: new Int8Array(BODY_CAPACITY),
  x: new Float32Array(BODY_CAPACITY), y: new Float32Array(BODY_CAPACITY), z: new Float32Array(BODY_CAPACITY),
  vx: new Float32Array(BODY_CAPACITY), vy: new Float32Array(BODY_CAPACITY), vz: new Float32Array(BODY_CAPACITY),
  halfX: new Float32Array(BODY_CAPACITY), halfY: new Float32Array(BODY_CAPACITY), halfZ: new Float32Array(BODY_CAPACITY),
  mass: new Float32Array(BODY_CAPACITY), rest: new Float32Array(BODY_CAPACITY), age: new Float32Array(BODY_CAPACITY),
  impactClock: new Float32Array(BODY_CAPACITY), color: new Uint32Array(BODY_CAPACITY),
  debrisLimit: BODY_CAPACITY,
  // Fill this reusable spec and pass it to spawn(); radius = halfX for spheres.
  spec: { shape: BODY_SHAPE.SPHERE, kind: BODY_KIND.THROWN, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, halfX: 0.2, halfY: 0.2, halfZ: 0.2, mass: 1, color: 0xffffff, owner: -1 },

  // Returns the new body's index, or -1 when every slot holds a thrown body (debris is recycled oldest first).
  spawn(spec) {
    const index = this.freeSlot(spec.kind);
    if (index < 0) return -1;
    this.active[index] = 1; this.sleeping[index] = 0; this.shape[index] = spec.shape; this.kind[index] = spec.kind; this.owner[index] = spec.owner;
    this.x[index] = spec.x; this.y[index] = spec.y; this.z[index] = spec.z; this.vx[index] = spec.vx; this.vy[index] = spec.vy; this.vz[index] = spec.vz;
    const sphere = spec.shape === BODY_SHAPE.SPHERE;
    this.halfX[index] = spec.halfX; this.halfY[index] = sphere ? spec.halfX : spec.halfY; this.halfZ[index] = sphere ? spec.halfX : spec.halfZ;
    this.mass[index] = Math.max(0.01, spec.mass); this.rest[index] = 0; this.age[index] = 0; this.impactClock[index] = 0; this.color[index] = spec.color;
    return index;
  },
  // A free slot, unless new debris would pass debrisLimit or no slot is free: then the oldest debris is recycled.
  freeSlot(kind) {
    let free = -1, oldestDebris = -1, debrisCount = 0;
    for (let i = 0; i < BODY_CAPACITY; i++) {
      if (!this.active[i]) { free = free < 0 ? i : free; continue; }
      if (this.kind[i] !== BODY_KIND.DEBRIS) continue;
      debrisCount++;
      if (oldestDebris < 0 || this.age[i] > this.age[oldestDebris]) oldestDebris = i;
    }
    const debrisFull = kind === BODY_KIND.DEBRIS && debrisCount >= this.debrisLimit;
    return free >= 0 && !debrisFull ? free : oldestDebris;
  },
  debrisCount() { let total = 0; for (let i = 0; i < BODY_CAPACITY; i++) total += this.active[i] && this.kind[i] === BODY_KIND.DEBRIS ? 1 : 0; return total; },
  remove(index) { this.active[index] = 0; },
  clear() { this.active.fill(0); },
  count() { let total = 0; for (let i = 0; i < BODY_CAPACITY; i++) total += this.active[i]; return total; },
  // Velocity change = impulse / mass (kg*m/s in, m/s out); wakes the body.
  applyImpulse(index, impulseX, impulseY, impulseZ) {
    if (!this.active[index]) return;
    const inverseMass = 1 / this.mass[index];
    this.vx[index] += impulseX * inverseMass; this.vy[index] += impulseY * inverseMass; this.vz[index] += impulseZ * inverseMass;
    this.sleeping[index] = 0; this.rest[index] = 0;
    clampBodySpeed(index);
  },
  // Nearest body along a normalized ray within maxDistance: fills hit (hit.brush = null) and returns its index, or -1.
  raycast(ox, oy, oz, dx, dy, dz, maxDistance, hit) {
    let best = maxDistance, found = -1;
    for (let i = 0; i < BODY_CAPACITY; i++) {
      if (!this.active[i]) continue;
      const distance = this.shape[i] === BODY_SHAPE.SPHERE ? raySphere(ox, oy, oz, dx, dy, dz, this.x[i], this.y[i], this.z[i], this.halfX[i]) : rayBoundsDistance(ox, oy, oz, dx, dy, dz, best,
        this.x[i] - this.halfX[i], this.y[i] - this.halfY[i], this.z[i] - this.halfZ[i], this.x[i] + this.halfX[i], this.y[i] + this.halfY[i], this.z[i] + this.halfZ[i]);
      if (distance < 0 || distance >= best) continue;
      best = distance; found = i;
    }
    if (found >= 0) fillBodyHit(found, ox, oy, oz, dx, dy, dz, best, hit);
    return found;
  },
};

const Props = {
  health: [], mass: [], debris: [], color: [], brushes: [], breakable: [],
  load(map) {
    this.clear();
    const rows = map.props || [];
    const budget = Quality.current().props;
    for (let i = 0; i < rows.length; i++) this.add(Data.normalize(PROP_FIELDS, rows[i]), i, i < budget);
  },
  add(row, index, breakable) {
    const brush = makeBrush({ shape: 'box', min: row.min, max: row.max, material: row.material }, -1);
    brush.prop = index;
    this.brushes[index] = brush; this.health[index] = row.health; this.mass[index] = row.mass; this.debris[index] = row.debris; this.color[index] = row.color;
    this.breakable[index] = breakable;
    World.dynamic.push(brush);
  },
  clear() {
    this.health.length = this.mass.length = this.debris.length = this.color.length = this.brushes.length = this.breakable.length = 0;
    Bodies.clear();
  },
  isStanding(index) { return this.health[index] > 0; },
  // Damage from a weapon hit (S11 calls this when a ray hit returns hit.brush.prop >= 0). Breaks the prop at 0 health;
  // props past the quality budget ignore damage and stay standing.
  damage(index, amount) {
    if (!(this.health[index] > 0) || !this.breakable[index]) return;
    this.health[index] -= amount;
    if (this.health[index] <= 0) this.breakProp(index);
  },
  breakProp(index) {
    const brush = this.brushes[index];
    const listIndex = World.dynamic.indexOf(brush);
    if (listIndex >= 0) World.dynamic.splice(listIndex, 1);
    this.health[index] = 0;
    Bodies.debrisLimit = Math.min(BODY_CAPACITY, Quality.current().props); // read now: quality can change mid-match
    spawnDebris(brush, clamp(this.debris[index], DEBRIS_MIN_PIECES, DEBRIS_MAX_PIECES), this.mass[index], this.color[index]);
    breakEvent.prop = index; breakEvent.material = brush.material;
    breakEvent.x = (brush.minX + brush.maxX) / 2; breakEvent.y = (brush.minY + brush.maxY) / 2; breakEvent.z = (brush.minZ + brush.maxZ) / 2;
    Bus.emit('world.break', breakEvent);
    emitSound(breakEvent.x, breakEvent.y, breakEvent.z, BREAK_NOISE_RADIUS, 'break', -1);
  },
};

const breakEvent = { prop: 0, material: '', x: 0, y: 0, z: 0 };
const bodyMover = makeMover();

World.addPart({ load: (map) => Props.load(map), clear: () => Props.clear() });

function spawnDebris(brush, pieces, mass, color) {
  const spec = Bodies.spec, random = Rng.fx;
  const sizeX = (brush.maxX - brush.minX) / 3, sizeY = (brush.maxY - brush.minY) / 3, sizeZ = (brush.maxZ - brush.minZ) / 3;
  for (let i = 0; i < pieces; i++) {
    spec.shape = BODY_SHAPE.BOX; spec.kind = BODY_KIND.DEBRIS; spec.owner = -1; spec.color = color; spec.mass = mass / pieces;
    spec.halfX = sizeX / 2; spec.halfY = sizeY / 2; spec.halfZ = sizeZ / 2;
    spec.x = random.range(brush.minX + sizeX / 2, brush.maxX - sizeX / 2);
    spec.y = random.range(brush.minY + sizeY / 2, brush.maxY - sizeY / 2);
    spec.z = random.range(brush.minZ + sizeZ / 2, brush.maxZ - sizeZ / 2);
    spec.vx = random.range(-DEBRIS_SPEED, DEBRIS_SPEED); spec.vy = random.range(0, DEBRIS_SPEED); spec.vz = random.range(-DEBRIS_SPEED, DEBRIS_SPEED);
    Bodies.spawn(spec);
  }
}

function clampBodySpeed(index) {
  const speed = Math.hypot(Bodies.vx[index], Bodies.vy[index], Bodies.vz[index]);
  if (speed <= BODY_MAX_SPEED) return;
  const scale = BODY_MAX_SPEED / speed;
  Bodies.vx[index] *= scale; Bodies.vy[index] *= scale; Bodies.vz[index] *= scale;
}

// Hit point and an outward normal (sphere: radial; box: the dominant axis of the hit point seen from the centre).
function fillBodyHit(index, ox, oy, oz, dx, dy, dz, distance, hit) {
  hit.distance = distance; hit.brush = null;
  hit.x = ox + dx * distance; hit.y = oy + dy * distance; hit.z = oz + dz * distance;
  const rx = (hit.x - Bodies.x[index]) / Bodies.halfX[index], ry = (hit.y - Bodies.y[index]) / Bodies.halfY[index], rz = (hit.z - Bodies.z[index]) / Bodies.halfZ[index];
  if (Bodies.shape[index] === BODY_SHAPE.SPHERE) { const length = Math.hypot(rx, ry, rz) || 1; hit.nx = rx / length; hit.ny = ry / length; hit.nz = rz / length; return; }
  const ax = Math.abs(rx), ay = Math.abs(ry), az = Math.abs(rz);
  hit.nx = ax >= ay && ax >= az ? Math.sign(rx) : 0;
  hit.ny = hit.nx === 0 && ay >= az ? Math.sign(ry) : 0;
  hit.nz = hit.nx === 0 && hit.ny === 0 ? Math.sign(rz) || 1 : 0;
}

// ---- Fixed step (after projectiles, before items) ----
function stepBodies(dt) {
  for (let i = 0; i < BODY_CAPACITY; i++) {
    if (!Bodies.active[i]) continue;
    Bodies.age[i] += dt;
    Bodies.impactClock[i] = Math.max(0, Bodies.impactClock[i] - dt);
    if (Bodies.sleeping[i]) { expireDebris(i); continue; }
    moveBody(i, dt);
    if (Bodies.kind[i] === BODY_KIND.THROWN) hitActors(i);
  }
}

function moveBody(index, dt) {
  const mover = bodyMover;
  if (Bodies.shape[index] === BODY_SHAPE.SPHERE) setSphereHull(mover.hull, Bodies.halfX[index]);
  else setBoxHull(mover.hull, Bodies.halfX[index], Bodies.halfY[index], Bodies.halfZ[index]);
  mover.x = Bodies.x[index]; mover.y = Bodies.y[index]; mover.z = Bodies.z[index];
  mover.vx = Bodies.vx[index]; mover.vy = Bodies.vy[index] - bodyGravity() * dt; mover.vz = Bodies.vz[index];
  mover.planeCount = 0;
  const intoX = mover.vx, intoY = mover.vy, intoZ = mover.vz;
  Collide.gatherAround(mover, Math.hypot(mover.vx, mover.vy, mover.vz) * dt);
  const touched = Collide.slide(mover, dt);
  if (touched) bounce(mover, intoX, intoY, intoZ, dt);
  if (!Collide.depenetrate(mover)) { mover.x = Bodies.x[index]; mover.y = Bodies.y[index]; mover.z = Bodies.z[index]; }
  Bodies.x[index] = mover.x; Bodies.y[index] = mover.y; Bodies.z[index] = mover.z;
  Bodies.vx[index] = mover.vx; Bodies.vy[index] = mover.vy; Bodies.vz[index] = mover.vz;
  updateSleep(index, touched && onFloor(mover), dt);
}

// Restitution along the last touched plane, plus floor friction. Speed only ever drops (no energy gain).
function bounce(mover, intoX, intoY, intoZ, dt) {
  const base = (mover.planeCount - 1) * 3, nx = mover.planes[base], ny = mover.planes[base + 1], nz = mover.planes[base + 2];
  const into = intoX * nx + intoY * ny + intoZ * nz;
  if (into < -BODY_BOUNCE_MIN_SPEED) {
    const push = -into * BODY_RESTITUTION;
    mover.vx += nx * push; mover.vy += ny * push; mover.vz += nz * push;
  }
  if (!onFloor(mover)) return;
  const keep = Math.max(0, 1 - BODY_GROUND_FRICTION * dt);
  mover.vx *= keep; mover.vz *= keep;
}

function onFloor(mover) {
  for (let i = 0; i < mover.planeCount; i++) if (mover.planes[i * 3 + 1] >= WALKABLE_NORMAL_Y) return true;
  return false;
}

// Bodies sleep after BODY_SLEEP_SECONDS at rest; debris sleeps after that long no matter what (MAP-013).
function updateSleep(index, grounded, dt) {
  const speed = Math.hypot(Bodies.vx[index], Bodies.vy[index], Bodies.vz[index]);
  Bodies.rest[index] = grounded && speed < BODY_SLEEP_SPEED ? Bodies.rest[index] + dt : 0;
  const debrisDone = Bodies.kind[index] === BODY_KIND.DEBRIS && Bodies.age[index] >= BODY_SLEEP_SECONDS;
  if (Bodies.rest[index] < BODY_SLEEP_SECONDS && !debrisDone) return;
  Bodies.sleeping[index] = 1;
  Bodies.vx[index] = Bodies.vy[index] = Bodies.vz[index] = 0;
}

function expireDebris(index) {
  if (Bodies.kind[index] === BODY_KIND.DEBRIS && Bodies.age[index] >= BODY_SLEEP_SECONDS + DEBRIS_LINGER_SECONDS) Bodies.remove(index);
}

function bodyGravity() {
  const rules = Game.match && Game.match.rules;
  return GRAVITY * (rules && rules.gravityScale !== undefined ? rules.gravityScale : 1);
}

// A fast thrown body that overlaps an actor's capsule asks for clamped impact damage (kind 'crush').
function hitActors(index) {
  if (Bodies.impactClock[index] > 0) return;
  const speed = Math.hypot(Bodies.vx[index], Bodies.vy[index], Bodies.vz[index]);
  if (speed < BODY_IMPACT_MIN_SPEED) return;
  const reach = ACTOR_RADIUS + Math.max(Bodies.halfX[index], Bodies.halfZ[index]);
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id] || id === Bodies.owner[index]) continue;
    if ((Actors.x[id] - Bodies.x[index]) ** 2 + (Actors.z[id] - Bodies.z[index]) ** 2 > reach * reach) continue;
    if (Bodies.y[index] + Bodies.halfY[index] < Actors.y[id] || Bodies.y[index] - Bodies.halfY[index] > Actors.y[id] + Actors.height[id]) continue;
    const amount = clamp(Bodies.mass[index] * speed * BODY_IMPACT_DAMAGE_PER_MOMENTUM, 0, BODY_IMPACT_MAX_DAMAGE);
    requestDamageAt(id, Bodies.owner[index], amount, 'crush', 'kinetic', Bodies.x[index], Bodies.y[index], Bodies.z[index]);
    Bodies.impactClock[index] = BODY_IMPACT_COOLDOWN;
    return;
  }
}

// Explosions push bodies (impulse falls off with distance) and damage props in their radius.
function onExplosion(event) {
  for (let i = 0; i < BODY_CAPACITY; i++) {
    if (!Bodies.active[i]) continue;
    const dx = Bodies.x[i] - event.x, dy = Bodies.y[i] - event.y, dz = Bodies.z[i] - event.z, distance = Math.hypot(dx, dy, dz);
    if (distance >= event.radius) continue;
    const strength = EXPLOSION_BODY_IMPULSE * (1 - distance / event.radius) / (distance || 1);
    Bodies.applyImpulse(i, dx * strength, dy * strength + EXPLOSION_BODY_IMPULSE * 0.2, dz * strength);
  }
  for (let i = 0; i < Props.brushes.length; i++) {
    const brush = Props.brushes[i];
    if (!Props.isStanding(i)) continue;
    const dx = clamp(event.x, brush.minX, brush.maxX) - event.x, dy = clamp(event.y, brush.minY, brush.maxY) - event.y, dz = clamp(event.z, brush.minZ, brush.maxZ) - event.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < event.radius) Props.damage(i, EXPLOSION_PROP_DAMAGE * (1 - distance / event.radius));
  }
}

function drawBodies(batch) {
  for (let i = 0; i < Props.brushes.length; i++) {
    if (!Props.isStanding(i)) continue;
    const b = Props.brushes[i], color = Props.color[i];
    batch.mesh('box', (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2, 0, 0, b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ,
      (color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255, 0);
  }
  for (let i = 0; i < BODY_CAPACITY; i++) {
    if (!Bodies.active[i]) continue;
    const color = Bodies.color[i], shape = Bodies.shape[i] === BODY_SHAPE.SPHERE ? 'sphere' : 'box';
    batch.mesh(shape, Bodies.x[i], Bodies.y[i], Bodies.z[i], 0, 0, Bodies.halfX[i] * 2, Bodies.halfY[i] * 2, Bodies.halfZ[i] * 2,
      (color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255, 0);
  }
}

Sim.addSystem('bodies', 55, stepBodies);
Render.addSource('bodies', drawBodies);
Bus.on('explosion', onExplosion);
