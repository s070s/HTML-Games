// S12 grenades and throwables (step 10.3, GAD-001, GAD-002, REN-007): carried counts per economy kit, BTN.GRENADE hold to
// cook and release to throw (ALT = underhand), pooled thrown bodies with bounce / stick / impact, effects per data row
// (frag, smoke, flash scaled by view angle, fire, impulse, freeze, pull, EMP), timed areas, and smoke
// volumes as an occupancy grid that blocks Smoke.lineBlocked (bots, aim assist) and loses cells to bullets and blasts.
// Placed and deployed devices are 12d (Gadgets.deployers). Every hit goes through Damage.apply / Damage.explode.

const GADGET_COUNT = CAT.gadgets.length;
CAT.gadgets.forEach((row, index) => { row.index = index; });
const THROWN_CAP = 64;
const THROWN_STATE = { FREE: 0, FLYING: 1, RESTING: 2, STUCK: 3, ATTACHED: 4 };
const THROWN_RADIUS = 0.1;
const THROWN_REST_SPEED = 1.5;           // slower than this on a floor: the grenade lies still
const THROWN_FLOOR_NORMAL = 0.7;
const BOUNCE_TICK_SPEED = 2;             // slower bounces make no tick (AUD-005)
const ACTOR_BOUNCE_KEEP = 0.25;          // a grenade that hits a body drops off it
const THROW_FORWARD = 0.5;               // thrown from this far in front of the eye
const GRENADE_NOISE = 15;                // bots hear a bounce within this radius
const POP_NOISE = 35;                    // pops without damage (smoke, flash, freeze, pulse)
const AREA_CAP = 32;
const FIRE_AREA_HEIGHT = 1.5;            // fire reaches feet this close above or below
const FIRE_FX_COUNT = 6;                 // fire particles per damage tick (G04, 12h burning oil)
const FIRE_FLOOR_PROBE = 3;              // fire that went off on a wall or a body drops this far at most to the floor
const SMOKE_CAP = 16;                    // grenade clouds plus the puffs of ability curtains (A17)
const SMOKE_CELL = 1;                    // REN-007 occupancy grid cell (m)
const SMOKE_LARGEST_RADIUS = CAT.gadgets.reduce((most, row) => row.effect === 'smoke' ? Math.max(most, row.radius) : most, 1);
const SMOKE_HALF = Math.ceil(SMOKE_LARGEST_RADIUS / SMOKE_CELL);
const SMOKE_DIM = SMOKE_HALF * 2 + 1;
const SMOKE_CELLS = SMOKE_DIM * SMOKE_DIM * SMOKE_DIM;
const SMOKE_BLOCK_METRES = 1;            // this much smoke along a line blocks sight
const SMOKE_SAMPLE = 0.5;                // step (m) of the samples taken along a line
const SMOKE_DRAW_STEP = 2;               // every 2nd cell per axis is drawn as one blob
const SMOKE_DRAW_BUDGET = 480;           // most smoke blobs per frame (the renderer takes 1024 spheres from every source)
const SMOKE_DRAW_START = SMOKE_HALF % SMOKE_DRAW_STEP;   // the lattice is centred on the cloud
const SMOKE_BLOB = SMOKE_CELL * 2.7;
const CURTAIN_PUFF_SPACING = 0.75;       // Smoke.add: puffs along a curtain overlap by a quarter of their diameter
const PREVIEW_SECONDS = 0.05;
const THROWN_LONGEST_FUSE = CAT.gadgets.reduce((most, row) => row.kind === 'thrown' ? Math.max(most, row.fuse) : most, 0);
const PREVIEW_POINTS = Math.ceil(THROWN_LONGEST_FUSE / PREVIEW_SECONDS);   // the arc preview follows the flight up to the fuse
const HERO_EXTRA_GRENADES = 1;           // H05 passive 'extraGrenade': one more of the hero's gadget (above its carry limit)

const GADGET_USE_EVENT = { id: 0, gadget: '', kind: '' };
const BOUNCE_EVENT = { x: 0, y: 0, z: 0, kind: 'grenade', source: -1 };
const POP_EVENT = { x: 0, y: 0, z: 0, radius: 0, owner: -1, source: '', element: 'kinetic' };
// Fire-mode-like rows for Damage.explode / Damage.apply (weapon key, element, splash), one per gadget.
const GADGET_MODES = CAT.gadgets.map((row) => ({ weapon: row.id, element: row.element, knockback: row.knockback ? 0 : 1, status: null,
  statusRange: 0, splash: { r: row.radius, dmg: row.damage, minFactor: 0.2 }, armorPen: 0.75, headMult: 1, legMult: 1, alwaysHead: false,
  family: null, fodderKill: false, falloff: null }));
const GADGET_RGB = pickupRgbTable(CAT.gadgets, (row) => row.color);
// Grenades in flight and in the hand and the 12d devices draw their 03r gear model (one per row by code) in the row colour.
const GADGET_MODELS = CAT.gadgets.map((row) => GEAR_MODELS.byId[row.code]);
const THROWN_SPIN = 6, THROWN_GLOW = 0.3;            // rad/s turn of a grenade in flight; its glow
const HELD_FORWARD = 0.6, HELD_LEFT = 0.26, HELD_DOWN = 0.24;   // m from the eye: the grenade in the first-person hand
const gadgetPose = makeModelPose();
// pose: position, yaw and glow set by the caller; the colour comes from the row.
function drawGadgetModel(batch, row, pose) {
  const offset = row.index * 3;
  pose.r = GADGET_RGB[offset]; pose.g = GADGET_RGB[offset + 1]; pose.b = GADGET_RGB[offset + 2];
  Models.draw(batch, GADGET_MODELS[row.index], pose);
}
const BLIND_INDEX = CAT.statusEffects.byId('blind').index;
const gadgetHit = makeHit();
const gadgetActorHit = makeActorHit();
const reachPoint = Vec.make();
const throwScratch = Vec.make();
const throwStart = Vec.make();
const previewScratch = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
// Reused instance records (batch.meshFrom): smoke blobs, the arc dots and its landing ring; float arguments would be boxed (PERF-006).
const smokeInstance = Object.assign(makeShapeInstance(), { sx: SMOKE_BLOB, sy: SMOKE_BLOB, sz: SMOKE_BLOB, emissive: 0.25 });
const previewDotInstance = Object.assign(makeShapeInstance(), { sx: 0.06, sy: 0.06, sz: 0.06, emissive: 1 });
const landingInstance = Object.assign(makeShapeInstance(), { sy: 0.05, b: 0.4, g: 0.9, emissive: 1 });

function gadgetRow(index) { return index >= 0 ? CAT.gadgets[index] : null; }
// A pop that hurts nobody: an 'explosion' of radius 0 (audio sting by element, bots hear it) plus a heard sound.
function emitGadgetPop(row, owner, x, y, z) {
  POP_EVENT.x = x; POP_EVENT.y = y; POP_EVENT.z = z; POP_EVENT.owner = owner; POP_EVENT.source = row.id; POP_EVENT.element = row.element;
  Bus.emit('explosion', POP_EVENT);
  emitSound(x, y, z, POP_NOISE, 'explosion', owner);
}
// True when an effect at (x, y, z) reaches the target's body: in radius, in line of sight, and an enemy of the owner
// (or the owner; allies only with friendly fire on).
function gadgetReaches(owner, target, x, y, z, radius) {
  if (!Actors.alive[target]) return false;
  if (owner >= 0 && target !== owner && !Actors.isEnemy(owner, target) && itemRule('friendlyFire', 0) <= 0) return false;
  Hitbox.point(target, ZONE.BODY, reachPoint);
  if (distanceSquared3(x, y, z, reachPoint.x, reachPoint.y, reachPoint.z) > radius * radius) return false;
  return World.lineClear(x, y, z, reachPoint.x, reachPoint.y, reachPoint.z);
}
// The fire mode of a 'weapon.fire' event when it is a ray (hitscan, beam, melee), else null.
function gadgetShotMode(event) {
  const weapon = CAT.weapons.byId(event.weapon);
  if (!weapon || event.mode === 'melee') return null;
  const mode = event.mode === 'alt' ? weapon.alt : weapon.primary;
  return mode.type === 'hitscan' || mode.type === 'beam' || mode.type === 'cone' ? mode : null;
}
// FireMode.repair (W30 beam): health one shot restores on a friendly device or the PvE core; 0 for other modes.
function repairPerShot(mode) { return mode && mode.repair > 0 ? mode.repair / mode.rate : 0; }
// Where a throw leaves the hand (THROW_FORWARD in front of the eye along the view): the throw and its preview arc.
function throwOrigin(id, out) {
  Vec.fromAngles(out, Actors.aimYaw[id], Actors.aimPitch[id]);
  return Vec.set(out, Actors.x[id] + out.x * THROW_FORWARD, Actors.eyeY(id) + out.y * THROW_FORWARD, Actors.z[id] + out.z * THROW_FORWARD);
}
// Overhand (GAD-002: 18 m/s + 5 up along the view) or underhand launch velocity into out.
function throwVelocity(id, underhand, out) {
  Vec.fromAngles(out, Actors.aimYaw[id], Actors.aimPitch[id]);
  const speed = underhand ? GADGET_TUNING.underhandSpeed : GADGET_TUNING.throwSpeed, lift = underhand ? GADGET_TUNING.underhandLift : GADGET_TUNING.throwLift;
  return Vec.set(out, out.x * speed, out.y * speed + lift, out.z * speed);
}

// ---- Smoke volumes (REN-007): one local occupancy grid per volume, filled by a flood from the centre that never enters solids ----
const Smoke = {
  active: new Uint8Array(SMOKE_CAP),
  x: new Float32Array(SMOKE_CAP), y: new Float32Array(SMOKE_CAP), z: new Float32Array(SMOKE_CAP), radius: new Float32Array(SMOKE_CAP),
  startTick: new Int32Array(SMOKE_CAP), endTick: new Int32Array(SMOKE_CAP),
  depth: new Uint8Array(SMOKE_CAP * SMOKE_CELLS),      // flood steps + 1 per cell (0 = no smoke can reach it)
  punched: new Int32Array(SMOKE_CAP * SMOKE_CELLS),    // Sim.tick until which a bullet or blast keeps the cell clear
  queue: new Int16Array(SMOKE_CELLS),
  count: 0,
  drawn: 0,                                            // blobs drawn this frame (SMOKE_DRAW_BUDGET)

  clear() { this.active.fill(0); this.count = 0; },
  spawn(row, owner, x, y, z) { return this.addVolume(x, y, z, row.radius, row.duration); },
  // A smoke curtain (A17 Veil Curtain and other walls of smoke): puffs of height/2 radius along the line of `width`
  // metres centred on (x, y, z), across the yaw direction; y is the floor under the curtain. Returns the puff count.
  add(x, y, z, width, height, seconds, yaw) {
    const radius = Math.min(SMOKE_LARGEST_RADIUS, height / 2), spacing = radius * 2 * CURTAIN_PUFF_SPACING;
    const puffs = Math.max(1, Math.ceil(width / spacing)), rightX = -Math.cos(yaw || 0), rightZ = Math.sin(yaw || 0);
    for (let puff = 0; puff < puffs; puff++) {
      const offset = (puff - (puffs - 1) / 2) * spacing;
      this.addVolume(x + rightX * offset, y + radius, z + rightZ * offset, radius, seconds);
    }
    return puffs;
  },
  addVolume(x, y, z, radius, seconds) {
    const volume = this.freeSlot();
    this.active[volume] = 1; this.x[volume] = x; this.y[volume] = y; this.z[volume] = z;
    this.radius[volume] = Math.min(SMOKE_LARGEST_RADIUS, radius); this.startTick[volume] = Sim.tick; this.endTick[volume] = Sim.tick + itemTicks(seconds);
    this.punched.fill(0, volume * SMOKE_CELLS, (volume + 1) * SMOKE_CELLS);
    this.flood(volume);
    this.recount();
    return volume;
  },
  freeSlot() { return oldestFreeSlot(this.active, this.endTick, SMOKE_CAP); },
  recount() { this.count = 0; for (let volume = 0; volume < SMOKE_CAP; volume++) this.count += this.active[volume]; },
  cellIndex(ix, iy, iz) { return (ix * SMOKE_DIM + iy) * SMOKE_DIM + iz; },
  // Breadth-first fill from the centre cell inside the radius, skipping cells whose centre is inside a brush (walls stop smoke).
  flood(volume) {
    const base = volume * SMOKE_CELLS, cells = this.depth, queue = this.queue;
    cells.fill(0, base, base + SMOKE_CELLS);
    const start = this.cellIndex(SMOKE_HALF, SMOKE_HALF, SMOKE_HALF);
    let head = 0, tail = 0;
    cells[base + start] = 1;
    queue[tail++] = start;
    while (head < tail) {
      const cell = queue[head++], grid = this.cellCoordinates(cell);
      tail = this.spread(volume, cells[base + cell] + 1, grid.x, grid.y, grid.z, tail);
    }
  },
  // Visits the 6 neighbours of a cell; returns the new queue tail.
  spread(volume, depth, ix, iy, iz, tail) {
    for (let n = 0; n < 6; n++) {
      const jx = ix + SMOKE_STEPS[n * 3], jy = iy + SMOKE_STEPS[n * 3 + 1], jz = iz + SMOKE_STEPS[n * 3 + 2];
      if (jx < 0 || jy < 0 || jz < 0 || jx >= SMOKE_DIM || jy >= SMOKE_DIM || jz >= SMOKE_DIM) continue;
      const cell = this.cellIndex(jx, jy, jz), slot = volume * SMOKE_CELLS + cell;
      if (this.depth[slot] || !this.cellFits(volume, jx, jy, jz)) continue;
      this.depth[slot] = Math.min(255, depth);
      this.queue[tail++] = cell;
    }
    return tail;
  },
  cellFits(volume, ix, iy, iz) {
    const dx = (ix - SMOKE_HALF) * SMOKE_CELL, dy = (iy - SMOKE_HALF) * SMOKE_CELL, dz = (iz - SMOKE_HALF) * SMOKE_CELL;
    if (dx * dx + dy * dy + dz * dz > this.radius[volume] * this.radius[volume]) return false;
    return !World.pointInside(this.x[volume] + dx, this.y[volume] + dy, this.z[volume] + dz);
  },
  // Grid coordinates (x, y, z = ix, iy, iz) of a cell index into cellGrid.
  cellCoordinates(cell) {
    return Vec.set(cellGrid, Math.floor(cell / (SMOKE_DIM * SMOKE_DIM)), Math.floor(cell / SMOKE_DIM) % SMOKE_DIM, cell % SMOKE_DIM);
  },
  // World centre of the cell (ix, iy, iz) of a volume into cellPoint.
  cellCentre(volume, ix, iy, iz) {
    const x = this.x[volume] + (ix - SMOKE_HALF) * SMOKE_CELL, y = this.y[volume] + (iy - SMOKE_HALF) * SMOKE_CELL;
    return Vec.set(cellPoint, x, y, this.z[volume] + (iz - SMOKE_HALF) * SMOKE_CELL);
  },
  // Radius the cloud has grown to (it expands over smokeExpandSeconds).
  grownRadius(volume) {
    const grown = (Sim.tick - this.startTick[volume]) / itemTicks(GADGET_TUNING.smokeExpandSeconds);
    return this.radius[volume] * Math.min(1, grown);
  },
  // Grid coordinate along one axis of a world offset from the volume centre.
  axisCell(offset) { return Math.round(offset / SMOKE_CELL) + SMOKE_HALF; },
  // Cell of a world point in a volume, or -1 outside its grid.
  cellAt(volume, x, y, z) {
    const ix = this.axisCell(x - this.x[volume]), iy = this.axisCell(y - this.y[volume]), iz = this.axisCell(z - this.z[volume]);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= SMOKE_DIM || iy >= SMOKE_DIM || iz >= SMOKE_DIM) return -1;
    return this.cellIndex(ix, iy, iz);
  },
  occupied(volume, cell, grown) {
    const slot = volume * SMOKE_CELLS + cell, depth = this.depth[slot];
    return depth > 0 && (depth - 1) * SMOKE_CELL <= grown && this.punched[slot] <= Sim.tick;
  },
  // True when the point is inside smoke (fire areas go out in smoke).
  covers(x, y, z) {
    for (let volume = 0; volume < SMOKE_CAP; volume++) {
      if (!this.active[volume]) continue;
      const cell = this.cellAt(volume, x, y, z);
      if (cell >= 0 && this.occupied(volume, cell, this.grownRadius(volume))) return true;
    }
    return false;
  },
  // Bots and aim assist: does the segment pass through at least SMOKE_BLOCK_METRES of smoke? viewer (optional actor id):
  // a hero with the smokeVision passive (H07) sees through smoke.
  lineBlocked(ax, ay, az, bx, by, bz, viewer) {
    if (!this.count) return false;
    if (viewer >= 0 && Abilities.passiveFlag(viewer, 'smokeVision')) return false;
    const dx = bx - ax, dy = by - ay, dz = bz - az, length = length3(dx, dy, dz);
    if (length < 1e-6) return false;
    const directionX = dx / length, directionY = dy / length, directionZ = dz / length;
    for (let volume = 0; volume < SMOKE_CAP; volume++) {
      if (!this.active[volume]) continue;
      if (this.smokeAlong(volume, ax, ay, az, directionX, directionY, directionZ, length) >= SMOKE_BLOCK_METRES) return true;
    }
    return false;
  },
  // Metres of occupied smoke of volume v along a ray segment.
  smokeAlong(volume, ox, oy, oz, dx, dy, dz, length) {
    const span = this.span(volume, ox, oy, oz, dx, dy, dz, length);
    if (!span) return 0;
    const grown = this.grownRadius(volume);
    let inside = 0;
    for (let distance = spanScratch.from; distance <= spanScratch.to; distance += SMOKE_SAMPLE) {
      const cell = this.cellAt(volume, ox + dx * distance, oy + dy * distance, oz + dz * distance);
      if (cell >= 0 && this.occupied(volume, cell, grown)) inside += SMOKE_SAMPLE;
    }
    return inside;
  },
  // Part of the segment inside the volume's sphere into spanScratch; false when it misses.
  span(volume, ox, oy, oz, dx, dy, dz, length) {
    const cx = this.x[volume] - ox, cy = this.y[volume] - oy, cz = this.z[volume] - oz, along = cx * dx + cy * dy + cz * dz;
    const miss = cx * cx + cy * cy + cz * cz - along * along, radius = this.radius[volume] + SMOKE_CELL;
    if (miss > radius * radius) return false;
    const half = Math.sqrt(radius * radius - miss);
    spanScratch.from = Math.max(0, along - half); spanScratch.to = Math.min(length, along + half);
    return spanScratch.from <= spanScratch.to;
  },
  // G02: bullets punch the cells along their path and blasts the cells around them for 2 s.
  punchRay(ox, oy, oz, dx, dy, dz, length) {
    const until = Sim.tick + itemTicks(GADGET_TUNING.smokePunchSeconds);
    for (let volume = 0; volume < SMOKE_CAP; volume++) {
      if (!this.active[volume] || !this.span(volume, ox, oy, oz, dx, dy, dz, length)) continue;
      for (let distance = spanScratch.from; distance <= spanScratch.to; distance += SMOKE_SAMPLE) {
        const cell = this.cellAt(volume, ox + dx * distance, oy + dy * distance, oz + dz * distance);
        if (cell >= 0) this.punched[volume * SMOKE_CELLS + cell] = until;
      }
    }
  },
  punchSphere(x, y, z, radius) {
    const until = Sim.tick + itemTicks(GADGET_TUNING.smokePunchSeconds);
    for (let volume = 0; volume < SMOKE_CAP; volume++) {
      if (!this.active[volume]) continue;
      if (distanceSquared3(x, y, z, this.x[volume], this.y[volume], this.z[volume]) > (radius + this.radius[volume]) ** 2) continue;
      for (let cell = 0; cell < SMOKE_CELLS; cell++) {
        if (this.cellDistance(volume, cell, x, y, z) <= radius) this.punched[volume * SMOKE_CELLS + cell] = until;
      }
    }
  },
  cellDistance(volume, cell, x, y, z) {
    const grid = this.cellCoordinates(cell), centre = this.cellCentre(volume, grid.x, grid.y, grid.z);
    return length3(centre.x - x, centre.y - y, centre.z - z);
  },
  onShot(event) {
    if (!this.count) return;
    const mode = gadgetShotMode(event);
    if (!mode) return;
    const range = mode.range || mode.reach || 0;
    const wall = World.raycast(event.x, event.y, event.z, event.dx, event.dy, event.dz, range, gadgetHit) ? gadgetHit.distance : range;
    this.punchRay(event.x, event.y, event.z, event.dx, event.dy, event.dz, wall);
  },
  step() {
    for (let volume = 0; volume < SMOKE_CAP; volume++) {
      if (this.active[volume] && Sim.tick >= this.endTick[volume]) { this.active[volume] = 0; this.recount(); }
    }
  },
  // Soft grey blobs on a coarse lattice of occupied cells, plus drifting smoke particles (cosmetic, Rng.fx).
  draw(batch) {
    this.drawn = 0;
    for (let volume = 0; volume < SMOKE_CAP; volume++) if (this.active[volume]) this.drawVolume(batch, volume);
  },
  drawVolume(batch, volume) {
    const grown = this.grownRadius(volume);
    for (let ix = SMOKE_DRAW_START; ix < SMOKE_DIM; ix += SMOKE_DRAW_STEP) {
      for (let iy = SMOKE_DRAW_START; iy < SMOKE_DIM; iy += SMOKE_DRAW_STEP) this.drawColumn(batch, volume, ix, iy, grown);
    }
    const cell = Rng.fx.int(0, SMOKE_CELLS - 1);
    if (!this.occupied(volume, cell, grown)) return;
    const grid = this.cellCoordinates(cell), centre = this.cellCentre(volume, grid.x, grid.y, grid.z);
    Fx.burst('smoke', centre.x, centre.y, centre.z, 0, 1, 0, 2, null);
  },
  drawColumn(batch, volume, ix, iy, grown) {
    for (let iz = SMOKE_DRAW_START; iz < SMOKE_DIM; iz += SMOKE_DRAW_STEP) {
      if (this.drawn >= SMOKE_DRAW_BUDGET || !this.occupied(volume, this.cellIndex(ix, iy, iz), grown)) continue;
      this.drawn++;
      const instance = smokeInstance, centre = this.cellCentre(volume, ix, iy, iz);
      instance.x = centre.x; instance.y = centre.y; instance.z = centre.z;
      instance.r = instance.g = instance.b = 0.5 + iy / SMOKE_DIM * 0.25;
      batch.meshFrom('sphere', instance);
    }
  },
};
const SMOKE_STEPS = new Int8Array([1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1]);
const spanScratch = { from: 0, to: 0 };
const cellGrid = Vec.make();
const cellPoint = Vec.make();

// ---- Timed areas left by grenades: fire, pull ----
const GadgetAreas = {
  active: new Uint8Array(AREA_CAP), row: new Int16Array(AREA_CAP), owner: new Int8Array(AREA_CAP),
  x: new Float32Array(AREA_CAP), y: new Float32Array(AREA_CAP), z: new Float32Array(AREA_CAP),
  startTick: new Int32Array(AREA_CAP), endTick: new Int32Array(AREA_CAP), clock: new Float32Array(AREA_CAP),
  steps: {},                                       // row effect -> fn(area, row, dt)

  clear() { this.active.fill(0); },
  spawn(row, owner, x, y, z, seconds) {
    const slot = oldestFreeSlot(this.active, this.endTick, AREA_CAP);   // full: the area that ends first gives way
    this.active[slot] = 1; this.row[slot] = row.index; this.owner[slot] = owner; this.x[slot] = x; this.y[slot] = y; this.z[slot] = z;
    this.startTick[slot] = Sim.tick; this.endTick[slot] = Sim.tick + itemTicks(seconds); this.clock[slot] = 0;
    return slot;
  },
  step(dt) {
    for (let area = 0; area < AREA_CAP; area++) {
      if (!this.active[area]) continue;
      const row = CAT.gadgets[this.row[area]];
      if (Sim.tick >= this.endTick[area]) { this.finish(area, row); continue; }
      this.steps[row.effect](area, row, dt);
    }
  },
  // Accumulates the area clock; true once per interval.
  due(area, dt, interval) { return intervalDue(this.clock, area, dt, interval); },
  finish(area, row) {
    this.active[area] = 0;
    if (row.effect === 'singularity') gadgetBlast(row, this.owner[area], this.x[area], this.y[area], this.z[area]);
  },
  // G04: HP/s ramps from fireRampFrom x peak to the peak; smoke puts it out.
  stepFire(area, row, dt) {
    if (!this.due(area, dt, AREA_TICK_SECONDS)) return;
    if (Smoke.covers(this.x[area], this.y[area] + 0.5, this.z[area])) { this.active[area] = 0; return; }
    const age = (Sim.tick - this.startTick[area]) / Math.max(1, this.endTick[area] - this.startTick[area]);
    const amount = row.damage * lerp(GADGET_TUNING.fireRampFrom, 1, age) * AREA_TICK_SECONDS;
    for (let id = 0; id < Actors.count; id++) if (this.inFire(area, row, id)) fireAreaHit(this.owner[area], id, amount, row, GADGET_MODES[row.index]);
    if (!Game.headless) Fx.burst('fire', this.x[area], this.y[area] + 0.1, this.z[area], 0, 1, 0, FIRE_FX_COUNT, null);
  },
  inFire(area, row, id) {
    if (!Actors.alive[id] || Math.abs(Actors.y[id] - this.y[area]) > FIRE_AREA_HEIGHT) return false;
    return (Actors.x[id] - this.x[area]) ** 2 + (Actors.z[id] - this.z[area]) ** 2 <= row.radius * row.radius;
  },
  // G09: everyone in reach is pulled to the centre (m/s^2), then the blast.
  stepPull(area, row, dt) {
    for (let id = 0; id < Actors.count; id++) {
      if (!gadgetReaches(this.owner[area], id, this.x[area], this.y[area], this.z[area], row.radius)) continue;
      const dx = this.x[area] - Actors.x[id], dy = this.y[area] - Actors.y[id], dz = this.z[area] - Actors.z[id], length = length3(dx, dy, dz) || 1;
      emitImpulse(id, dx / length * row.pull * dt, dy / length * row.pull * dt, dz / length * row.pull * dt);
    }
    if (!Game.headless && this.due(area, dt, AREA_TICK_SECONDS)) Fx.burst('energy', this.x[area], this.y[area], this.z[area], 0, 1, 0, 6, row.color);
  },
};
GadgetAreas.steps.fire = (area, row, dt) => GadgetAreas.stepFire(area, row, dt);
GadgetAreas.steps.singularity = (area, row, dt) => GadgetAreas.stepPull(area, row, dt);

// A blast of a gadget row through the single damage path.
function gadgetBlast(row, owner, x, y, z) {
  const blast = Damage.blast();
  blast.x = x; blast.y = y; blast.z = z; blast.owner = owner; blast.mode = GADGET_MODES[row.index]; blast.radius = row.radius;
  blast.damage = row.damage; blast.ownerSafe = row.ownerSafe; blast.weapon = row.id; blast.element = row.element;
  Damage.explode(blast);
}
// One damage tick of a fire area (G04, 12h burning oil) through the single damage path (team rules apply); the row's
// status lands only on a real hit. mode: the damage mode (null for rows that are not gadgets).
function fireAreaHit(owner, id, amount, row, mode) {
  const info = Damage.info();
  info.amount = amount; info.kind = 'dot'; info.mode = mode; info.weapon = row.id; info.element = row.element;
  info.x = Actors.x[id]; info.y = Actors.y[id] + 0.5; info.z = Actors.z[id];
  if (Damage.apply(owner, id, info) > 0 && row.status) Damage.addStatus(id, row.status, owner, row.statusSeconds, 1);
}
// Fire burns on the floor below where it went off (impact rows also go off on walls and bodies).
function fireFloorY(x, y, z) {
  if (!World.raycast(x, y + THROWN_RADIUS, z, 0, -1, 0, FIRE_FLOOR_PROBE + THROWN_RADIUS, gadgetHit)) return y;
  return gadgetHit.y;
}

// ---- Effects when a grenade goes off (row.effect -> fn(row, owner, x, y, z)) ----
const GadgetEffects = {
  explode: (row, owner, x, y, z) => gadgetBlast(row, owner, x, y, z),
  smoke: (row, owner, x, y, z) => { Smoke.spawn(row, owner, x, y, z); emitGadgetPop(row, owner, x, y, z); },
  fire: (row, owner, x, y, z) => { GadgetAreas.spawn(row, owner, x, fireFloorY(x, y, z) + 0.05, z, row.duration); emitGadgetPop(row, owner, x, y, z); },
  singularity: (row, owner, x, y, z) => { GadgetAreas.spawn(row, owner, x, y, z, row.duration); emitGadgetPop(row, owner, x, y, z); },
  flash: (row, owner, x, y, z) => {
    for (let id = 0; id < Actors.count; id++) gadgetFlash(row, owner, id, x, y, z);
    emitGadgetPop(row, owner, x, y, z);
    flashLight(x, y, z);
  },
  freeze: (row, owner, x, y, z) => {
    for (let id = 0; id < Actors.count; id++) if (gadgetReaches(owner, id, x, y, z, row.radius)) Damage.addStatus(id, row.status, owner, row.statusSeconds, 1);
    emitGadgetPop(row, owner, x, y, z);
    if (!Game.headless) Fx.burst('frost', x, y, z, 0, 1, 0, 30, null);
  },
  // G20 (also the merged Sap Field, P3-06): abilities, devices and regeneration are shut down and the suit energy bar is emptied.
  emp: (row, owner, x, y, z) => {
    for (let id = 0; id < Actors.count; id++) {
      if (!gadgetReaches(owner, id, x, y, z, row.radius)) continue;
      Gadgets.suppress(id, row.duration);
      if (id !== owner) Meters.energy[id] = 0;
    }
    Gadgets.empDevices(owner, x, y, z, row.radius, row.duration);
    emitGadgetPop(row, owner, x, y, z);
    if (!Game.headless) Fx.burst('shock', x, y, z, 0, 1, 0, 30, null);
  },
  // G07: knockback away from the centre (full at the centre, half at the edge), the owner too: a self-launch.
  impulse: (row, owner, x, y, z) => {
    gadgetBlast(row, owner, x, y, z);
    for (let id = 0; id < Actors.count; id++) {
      if (id !== owner && !gadgetReaches(owner, id, x, y, z, row.radius)) continue;
      if (id === owner && distanceSquared3(x, y, z, Actors.x[id], Actors.y[id] + 0.9, Actors.z[id]) > row.radius * row.radius) continue;
      const dx = Actors.x[id] - x, dy = Actors.y[id] + 0.9 - y, dz = Actors.z[id] - z, length = length3(dx, dy, dz) || 1;
      const speed = row.knockback * (1 - 0.5 * Math.min(1, length / row.radius));
      emitImpulse(id, dx / length * speed, Math.max(0.3, dy / length) * speed, dz / length * speed);
    }
  },
};
// G03: blind seconds = duration x view-angle share (facing it 1, facing away flashMinimumAngle) x distance share.
function flashSeconds(row, id, x, y, z) {
  const eyeY = Actors.eyeY(id), dx = x - Actors.x[id], dy = y - eyeY, dz = z - Actors.z[id], distance = length3(dx, dy, dz);
  if (distance > row.radius || !World.lineClear(x, y, z, Actors.x[id], eyeY, Actors.z[id])) return 0;
  Vec.fromAngles(throwScratch, Actors.yaw[id], Actors.pitch[id]);
  const facing = distance > 1e-3 ? (throwScratch.x * dx + throwScratch.y * dy + throwScratch.z * dz) / distance : 1;
  const angleShare = Math.max(GADGET_TUNING.flashMinimumAngle, (facing + 1) / 2);
  const distanceShare = lerp(1, GADGET_TUNING.flashMinimumDistance, distance / row.radius);
  return row.duration * angleShare * distanceShare;
}
function gadgetFlash(row, owner, id, x, y, z) {
  if (!Actors.alive[id] || (owner >= 0 && id !== owner && !Actors.isEnemy(owner, id) && itemRule('friendlyFire', 0) <= 0)) return;
  const seconds = flashSeconds(row, id, x, y, z);
  if (seconds > 0) Damage.addStatus(id, row.status, owner, seconds, 1);
}
function flashLight(x, y, z) {
  if (Game.headless) return;
  Fx.light(x, y, z, 0xffffff, 18, 0.25);
  Fx.burst('spark', x, y, z, 0, 1, 0, 20, 0xffffff);
}

// ---- Thrown bodies ----
const Thrown = {
  state: new Uint8Array(THROWN_CAP), row: new Int16Array(THROWN_CAP), owner: new Int8Array(THROWN_CAP),
  x: new Float32Array(THROWN_CAP), y: new Float32Array(THROWN_CAP), z: new Float32Array(THROWN_CAP),
  vx: new Float32Array(THROWN_CAP), vy: new Float32Array(THROWN_CAP), vz: new Float32Array(THROWN_CAP),
  fuseTick: new Int32Array(THROWN_CAP), attached: new Int8Array(THROWN_CAP).fill(-1),
  offsetX: new Float32Array(THROWN_CAP), offsetY: new Float32Array(THROWN_CAP), offsetZ: new Float32Array(THROWN_CAP),
  active: 0,

  clear() { this.state.fill(0); this.attached.fill(-1); this.active = 0; },
  // Launches a gadget row from (x, y, z); fuseTicks = ticks until it goes off (cooked grenades have less). Returns the slot.
  spawn(row, owner, x, y, z, vx, vy, vz, fuseTicks) {
    const slot = oldestFreeSlot(this.state, this.fuseTick, THROWN_CAP);   // THROWN_STATE.FREE is 0
    this.remove(slot);
    this.state[slot] = THROWN_STATE.FLYING; this.row[slot] = row.index; this.owner[slot] = owner;
    this.x[slot] = x; this.y[slot] = y; this.z[slot] = z; this.vx[slot] = vx; this.vy[slot] = vy; this.vz[slot] = vz;
    this.fuseTick[slot] = Sim.tick + fuseTicks; this.attached[slot] = -1;
    this.active++;
    return slot;
  },
  remove(slot) {
    if (this.state[slot] === THROWN_STATE.FREE) return;
    this.state[slot] = THROWN_STATE.FREE;
    this.active--;
  },
  step(dt) {
    if (!this.active) return;
    const gravity = bodyGravity();
    for (let slot = 0; slot < THROWN_CAP; slot++) {
      const state = this.state[slot];
      if (state === THROWN_STATE.FREE) continue;
      if (Sim.tick >= this.fuseTick[slot]) { this.detonate(slot); continue; }
      if (state === THROWN_STATE.FLYING) this.fly(slot, gravity, dt);
      else if (state === THROWN_STATE.ATTACHED) this.follow(slot);
    }
  },
  detonate(slot) {
    const row = CAT.gadgets[this.row[slot]], owner = this.owner[slot], x = this.x[slot], y = this.y[slot], z = this.z[slot];
    this.remove(slot);
    GadgetEffects[row.effect](row, owner, x, y, z);
  },
  fly(slot, gravity, dt) {
    this.vy[slot] -= gravity * dt;
    const speed = length3(this.vx[slot], this.vy[slot], this.vz[slot]);
    if (speed < 1e-6) return;
    const dx = this.vx[slot] / speed, dy = this.vy[slot] / speed, dz = this.vz[slot] / speed, length = speed * dt;
    const wallHit = World.raycast(this.x[slot], this.y[slot], this.z[slot], dx, dy, dz, length + THROWN_RADIUS, gadgetHit);
    const wall = wallHit ? Math.max(0, gadgetHit.distance - THROWN_RADIUS) : length;
    const target = World.raycastActors(this.x[slot], this.y[slot], this.z[slot], dx, dy, dz, wall, this.owner[slot], gadgetActorHit);
    if (target >= 0) { this.touchActor(slot, target); return; }
    this.x[slot] += dx * wall; this.y[slot] += dy * wall; this.z[slot] += dz * wall;
    if (wallHit) this.touchWorld(slot, speed);
  },
  touchActor(slot, target) {
    const row = CAT.gadgets[this.row[slot]];
    this.x[slot] = gadgetActorHit.x; this.y[slot] = gadgetActorHit.y; this.z[slot] = gadgetActorHit.z;
    if (row.impact && !row.stickActors) { this.detonate(slot); return; }
    if (!row.stickActors) { this.bounceOffActor(slot); return; }
    this.attach(slot, target);
    if (row.impact) this.detonate(slot);
  },
  // Rides on the body; the throw speed is gone, so it drops straight off a carrier who dies.
  attach(slot, target) {
    this.state[slot] = THROWN_STATE.ATTACHED;
    this.attached[slot] = target;
    this.vx[slot] = this.vy[slot] = this.vz[slot] = 0;
    this.offsetX[slot] = this.x[slot] - Actors.x[target];
    this.offsetY[slot] = this.y[slot] - Actors.y[target];
    this.offsetZ[slot] = this.z[slot] - Actors.z[target];
  },
  // Drops off a body: most speed lost, pushed out along the hit normal so the next sweep starts outside the hit volume.
  bounceOffActor(slot) {
    this.vx[slot] *= -ACTOR_BOUNCE_KEEP; this.vz[slot] *= -ACTOR_BOUNCE_KEEP; this.vy[slot] = Math.min(0, this.vy[slot]);
    this.x[slot] += gadgetActorHit.nx * THROWN_RADIUS * 2; this.z[slot] += gadgetActorHit.nz * THROWN_RADIUS * 2;
  },
  touchWorld(slot, speed) {
    const row = CAT.gadgets[this.row[slot]];
    if (row.stick || row.impact) { this.settle(slot, row); return; }
    const along = this.vx[slot] * gadgetHit.nx + this.vy[slot] * gadgetHit.ny + this.vz[slot] * gadgetHit.nz;
    this.vx[slot] = (this.vx[slot] - 2 * along * gadgetHit.nx) * row.bounce;
    this.vy[slot] = (this.vy[slot] - 2 * along * gadgetHit.ny) * row.bounce;
    this.vz[slot] = (this.vz[slot] - 2 * along * gadgetHit.nz) * row.bounce;
    if (speed > BOUNCE_TICK_SPEED) this.emitBounce(slot);
    if (gadgetHit.ny > THROWN_FLOOR_NORMAL && length3(this.vx[slot], this.vy[slot], this.vz[slot]) < THROWN_REST_SPEED) this.rest(slot);
  },
  // Sticks where it hit (or goes off on impact).
  settle(slot, row) {
    this.x[slot] = gadgetHit.x + gadgetHit.nx * THROWN_RADIUS;
    this.y[slot] = gadgetHit.y + gadgetHit.ny * THROWN_RADIUS;
    this.z[slot] = gadgetHit.z + gadgetHit.nz * THROWN_RADIUS;
    this.vx[slot] = this.vy[slot] = this.vz[slot] = 0;
    if (row.impact) { this.detonate(slot); return; }
    this.state[slot] = THROWN_STATE.STUCK;
  },
  rest(slot) {
    this.vx[slot] = this.vy[slot] = this.vz[slot] = 0;
    this.state[slot] = THROWN_STATE.RESTING;
  },
  follow(slot) {
    const target = this.attached[slot];
    if (target < 0 || !Actors.alive[target]) { this.state[slot] = THROWN_STATE.FLYING; this.attached[slot] = -1; return; }
    this.x[slot] = Actors.x[target] + this.offsetX[slot];
    this.y[slot] = Actors.y[target] + this.offsetY[slot];
    this.z[slot] = Actors.z[target] + this.offsetZ[slot];
  },
  emitBounce(slot) {
    BOUNCE_EVENT.x = this.x[slot]; BOUNCE_EVENT.y = this.y[slot]; BOUNCE_EVENT.z = this.z[slot]; BOUNCE_EVENT.source = this.owner[slot];
    Bus.emit('projectile.bounce', BOUNCE_EVENT);
    emitSound(this.x[slot], this.y[slot], this.z[slot], GRENADE_NOISE, 'grenade', this.owner[slot], CAT.gadgets[this.row[slot]].effect);
  },
  // G22 removes enemy throwables in flight.
  removeAt(slot) { this.remove(slot); if (!Game.headless) Fx.burst('spark', this.x[slot], this.y[slot], this.z[slot], 0, 1, 0, 8, null); },
  // W41 Graviton Lifter (WeaponSpecialState.grenadeHook): the nearest flying or resting grenade in the aim cone within range.
  grab(id, ox, oy, oz, dx, dy, dz, range, minCos) {
    let best = -1, bestDistance = range;
    for (let slot = 0; slot < THROWN_CAP; slot++) {
      if (this.state[slot] !== THROWN_STATE.FLYING && this.state[slot] !== THROWN_STATE.RESTING) continue;
      const tx = this.x[slot] - ox, ty = this.y[slot] - oy, tz = this.z[slot] - oz, distance = length3(tx, ty, tz);
      if (distance >= bestDistance || (tx * dx + ty * dy + tz * dz) / (distance || 1) < minCos) continue;
      best = slot; bestDistance = distance;
    }
    return best;
  },
  hold(slot, x, y, z) {
    if (this.state[slot] !== THROWN_STATE.FLYING && this.state[slot] !== THROWN_STATE.RESTING) return;
    this.state[slot] = THROWN_STATE.FLYING;
    this.x[slot] = x; this.y[slot] = y; this.z[slot] = z;
    this.vx[slot] = this.vy[slot] = this.vz[slot] = 0;
  },
  // Thrown back as the lifter holder's own grenade; the fuse keeps running.
  launch(slot, owner, vx, vy, vz) {
    if (this.state[slot] !== THROWN_STATE.FLYING) return;
    this.owner[slot] = owner;
    this.vx[slot] = vx; this.vy[slot] = vy; this.vz[slot] = vz;
  },
  draw(batch) {
    const pose = gadgetPose;
    pose.yaw = Sim.time * THROWN_SPIN; pose.emissive = THROWN_GLOW;
    for (let slot = 0; slot < THROWN_CAP; slot++) {
      if (!this.state[slot]) continue;
      pose.x = this.x[slot]; pose.y = this.y[slot]; pose.z = this.z[slot];
      drawGadgetModel(batch, CAT.gadgets[this.row[slot]], pose);
    }
  },
};

// ---- Carried grenades and the gadget slot ----
const Gadgets = {
  count: new Uint8Array(MAX_ACTORS * GADGET_COUNT),  // carried uses per row
  grenade: new Int8Array(MAX_ACTORS).fill(-1),       // current grenade row
  gadget: new Int8Array(MAX_ACTORS).fill(-1),        // gadget-slot row (placed / deployed)
  cooldownEnd: new Int32Array(MAX_ACTORS),           // the gadget slot recharges one use at this tick (rows with a cooldown)
  holdStart: new Int32Array(MAX_ACTORS).fill(-1),    // tick BTN.GRENADE went down with a grenade ready (-1 not holding)
  holdRow: new Int8Array(MAX_ACTORS).fill(-1),
  suppressedUntil: new Int32Array(MAX_ACTORS),       // G20: no grenades, gadgets, abilities or shield regen until this tick
  attackLocks: [],                                   // fn(id) -> true while the actor may not attack (12f: the NO_FIRE buff of A06 Phase Slip; 13f: a Blight infected)
  deployers: [],                                     // fn(id, row) -> true when 12d placed the gadget
  empHooks: [],                                      // fn(owner, x, y, z, radius, seconds): 12d disables devices
  cycleShown: -1,                                    // the grenade row the touch NADE face names, -1 none (syncCycleButton)
  loadoutGear: null,                                 // fn(id) -> { lethal, tactical, device } gadget keys, or null: the saved pickup loadout of the actor (13d)

  kit() { return CAT.gadgetKits.byId(itemRule('economy', 'pickups')) || CAT.gadgetKits.byId('pickups'); },
  countOf(id, key) { const row = CAT.gadgets.byId(key); return row ? this.count[id * GADGET_COUNT + row.index] : 0; },
  suppressed(id) { return Sim.tick < this.suppressedUntil[id]; },
  // G20: shield recharge (S11) and abilities (12e: active ones end) are held for the same time; health regeneration goes on.
  suppress(id, seconds) {
    this.suppressedUntil[id] = Math.max(this.suppressedUntil[id], Sim.tick + itemTicks(seconds));
    Damage.pauseShieldRegen(id, seconds);
    Abilities.suppress(id, seconds);
  },
  // Every EMP (G20, the A15 drone's end) reaches devices in the radius through the empHooks (12d switches them off).
  empDevices(owner, x, y, z, radius, seconds) {
    for (let i = 0; i < this.empHooks.length; i++) this.empHooks[i](owner, x, y, z, radius, seconds);
  },
  // Blind share 0..1 for the HUD flash overlay (G03 'blind' seconds left / its longest).
  blindAmount(id) { return clamp(Damage.statusTime[id * STATUS_COUNT + BLIND_INDEX] / CAT.statusEffects[BLIND_INDEX].seconds, 0, 1); },
  // Most of one thrown row this actor may carry under the kit (GAD-001).
  limitFor(row) {
    const kit = this.kit();
    if (kit.limits[row.id] !== undefined) return kit.limits[row.id];
    return kit.perType || row.carry;
  },
  // Thrown rows this actor carries at least one of (the touch NADE face names the type from two: a cycle needs a choice).
  grenadeTypes(id) {
    let types = 0;
    for (let rowIndex = 0; rowIndex < GADGET_COUNT; rowIndex++) if (CAT.gadgets[rowIndex].kind === 'thrown' && this.count[id * GADGET_COUNT + rowIndex]) types++;
    return types;
  },
  thrownTotal(id) {
    let total = 0;
    for (let rowIndex = 0; rowIndex < GADGET_COUNT; rowIndex++) if (CAT.gadgets[rowIndex].kind === 'thrown') total += this.count[id * GADGET_COUNT + rowIndex];
    return total;
  },
  // Adds uses of a row (economy buys, pickups, kits); thrown rows respect the kit limits, others take the gadget slot.
  // Returns how many were added.
  give(id, key, amount) {
    const row = CAT.gadgets.byId(key);
    if (!row) return 0;
    const slot = id * GADGET_COUNT + row.index, kit = this.kit();
    let room = (row.kind === 'thrown' ? this.limitFor(row) : row.carry) - this.count[slot];
    if (row.kind === 'thrown' && kit.total > 0) room = Math.min(room, kit.total - this.thrownTotal(id));
    const added = Math.max(0, Math.min(room, amount === undefined ? 1 : amount));
    this.count[slot] += added;
    if (row.kind !== 'thrown' && (added > 0 || this.gadget[id] < 0)) this.gadget[id] = row.index;
    if (row.kind === 'thrown' && added > 0 && (this.grenade[id] < 0 || !this.count[id * GADGET_COUNT + this.grenade[id]])) this.grenade[id] = row.index;
    return added;
  },
  select(id, key) {
    const row = CAT.gadgets.byId(key);
    if (!row || !this.count[id * GADGET_COUNT + row.index]) return false;
    if (row.kind === 'thrown') this.grenade[id] = row.index;
    else this.gadget[id] = row.index;
    return true;
  },
  // The next carried grenade row after the current one (when a type runs out).
  nextGrenade(id) {
    for (let step = 1; step <= GADGET_COUNT; step++) {
      const rowIndex = (Math.max(0, this.grenade[id]) + step) % GADGET_COUNT;
      if (CAT.gadgets[rowIndex].kind === 'thrown' && this.count[id * GADGET_COUNT + rowIndex]) return rowIndex;
    }
    return -1;
  },
  // BTN.CYCLE_GRENADE: the next carried grenade type becomes the one GRENADE throws.
  cycleGrenade(id) {
    const next = this.nextGrenade(id);
    if (next >= 0) this.grenade[id] = next;
  },
  resetActor(id) {
    this.count.fill(0, id * GADGET_COUNT, (id + 1) * GADGET_COUNT);
    this.grenade[id] = this.gadget[id] = -1;
    this.holdStart[id] = this.holdRow[id] = -1;
    this.cooldownEnd[id] = 0; this.suppressedUntil[id] = 0;
  },
  // A new life: the kit of the match economy (S12 resets cooldowns on actor.spawn).
  equip(id) {
    this.resetActor(id);
    const kit = this.kit(), gear = kit.loadout && this.loadoutGear ? this.loadoutGear(id) : null;
    if (gear) {
      for (const key of [gear.lethal, gear.tactical, gear.device]) this.give(id, key, CAT.gadgets.byId(key).carry);
      return;
    }
    for (const key in kit.grenades) this.give(id, key, kit.grenades[key]);
    if (kit.gadget) this.give(id, kit.gadget, 1);
  },
  // A class loadout (ECP04) brings its own lethal and tactical: the kit's grenades go, the gadget slot stays.
  clearGrenades(id) {
    for (let rowIndex = 0; rowIndex < GADGET_COUNT; rowIndex++) if (CAT.gadgets[rowIndex].kind === 'thrown') this.count[id * GADGET_COUNT + rowIndex] = 0;
    this.grenade[id] = -1;
  },
  // Hero kits (12e on spawn): the hero's gadget (G09, G20), plus one with the 'extraGrenade' passive (H05).
  equipHero(id, hero) {
    const row = CAT.gadgets.byId(hero.gadget);
    if (!row || !this.give(id, row.id, 1)) return;
    if (Abilities.passiveFlag(id, 'extraGrenade')) this.count[id * GADGET_COUNT + row.index] += HERO_EXTRA_GRENADES;
  },
  // Ammo caches give back one of each kit grenade (economies with refill), or of the loadout's lethal and tactical.
  refill(id) {
    const kit = this.kit();
    if (!kit.refill) return false;
    const gear = kit.loadout && this.loadoutGear ? this.loadoutGear(id) : null;
    let added = 0;
    for (const key of gear ? [gear.lethal, gear.tactical] : Object.keys(kit.grenades)) added += this.give(id, key, 1);
    return added > 0;
  },

  // ---- Input (Sim order 58): GRENADE hold / release, GADGET press ----
  step(dt) {
    for (let id = 0; id < Actors.count; id++) if (Actors.alive[id]) this.stepActor(id);
    Thrown.step(dt);
    GadgetAreas.step(dt);
    Smoke.step();
    this.syncCycleButton();
  },
  // The touch NADE face names the grenade type it throws while there is a choice (a swipe on NADE picks the next), on a change only.
  syncCycleButton() {
    const id = Game.playerId, row = id >= 0 && this.grenadeTypes(id) >= 2 ? this.grenade[id] : -1;
    if (row === this.cycleShown) return;
    this.cycleShown = row;
    TouchInput.setNote('grenade', row >= 0 ? CAT.gadgets[row].name.split(' ')[0] : '');
  },
  // One test for "cannot attack": grenades, gadgets and the offensive abilities (12e usable) all ask it.
  attackLocked(id) {
    for (let i = 0; i < this.attackLocks.length; i++) if (this.attackLocks[i](id)) return true;
    return false;
  },
  // Frozen, downed or jammed stops all gear; attackLocked (A06 Phase Slip) stops attacks only.
  stopped(id) { return (Actors.flags[id] & (ACTOR_FLAG.FROZEN | ACTOR_FLAG.DOWNED)) !== 0 || this.suppressed(id); },
  blocked(id) { return this.stopped(id) || this.attackLocked(id); },
  stepActor(id) {
    this.rechargeGadget(id);
    if (this.holdStart[id] >= 0) { this.stepHeld(id); return; }
    if (this.blocked(id)) return;
    if (Actors.pressed[id] & BTN.CYCLE_GRENADE) this.cycleGrenade(id);
    if (Actors.pressed[id] & BTN.GRENADE) this.startHold(id);
    if (Actors.pressed[id] & BTN.GADGET) this.useGadget(id);
  },
  grenadeReady(id) { return this.grenade[id] >= 0 && this.count[id * GADGET_COUNT + this.grenade[id]] > 0; },
  startHold(id) {
    if (!this.grenadeReady(id)) return;
    this.holdStart[id] = Sim.tick;
    this.holdRow[id] = this.grenade[id];
  },
  heldTicks(id) { return Sim.tick - this.holdStart[id]; },
  // A stopped thrower drops the held grenade; Phase Slip only puts it away (no risk-free drop while invulnerable).
  stepHeld(id) {
    if (this.stopped(id)) this.dropHeld(id);
    else if (this.attackLocked(id)) this.holdStart[id] = this.holdRow[id] = -1;
    else this.stepHold(id);
  },
  // Cookable rows burn their fuse while held (a full cook goes off in the hand); release throws.
  stepHold(id) {
    const row = CAT.gadgets[this.holdRow[id]], fuse = itemTicks(row.fuse);
    if (row.cook && this.heldTicks(id) >= fuse) { this.release(id, 0, false); return; }
    if (Actors.buttons[id] & BTN.GRENADE) return;
    this.release(id, row.cook ? fuse - this.heldTicks(id) : fuse, (Actors.buttons[id] & BTN.ALT) !== 0);
  },
  release(id, fuseTicks, underhand) {
    const row = CAT.gadgets[this.holdRow[id]];
    this.holdStart[id] = this.holdRow[id] = -1;
    this.spend(id, row);
    this.throwRow(id, row, fuseTicks, underhand);
  },
  spend(id, row) {
    const slot = id * GADGET_COUNT + row.index;
    if (this.count[slot]) this.count[slot]--;
    if (row.kind === 'thrown' && !this.count[slot]) this.grenade[id] = this.nextGrenade(id);
  },
  throwRow(id, row, fuseTicks, underhand) {
    throwVelocity(id, underhand, throwScratch);
    throwOrigin(id, throwStart);
    const slot = Thrown.spawn(row, id, throwStart.x, throwStart.y, throwStart.z, throwScratch.x, throwScratch.y, throwScratch.z, fuseTicks);
    this.emitUse(id, row);
    if (fuseTicks <= 0) Thrown.detonate(slot);
    return slot;
  },
  emitUse(id, row) {
    GADGET_USE_EVENT.id = id; GADGET_USE_EVENT.gadget = row.id; GADGET_USE_EVENT.kind = row.kind;
    Bus.emit('gadget.use', GADGET_USE_EVENT);
  },
  useGadget(id) {
    const row = gadgetRow(this.gadget[id]);
    if (!row || !this.count[id * GADGET_COUNT + row.index]) return false;
    let placed = false;
    for (let i = 0; i < this.deployers.length && !placed; i++) placed = this.deployers[i](id, row);
    if (!placed) return false;
    this.spend(id, row);
    if (row.cooldown > 0) this.cooldownEnd[id] = Sim.tick + this.rechargeTicks(id, row);
    this.emitUse(id, row);
    return true;
  },
  // A field upgrade's recharge for this actor, sped up by ECP04 Tune Up (Abilities.rechargeScale).
  rechargeTicks(id, row) { return itemTicks(row.cooldown / Abilities.rechargeScale[id]); },
  // Field-upgrade rows (cooldown > 0) regain their single use when the recharge is over.
  rechargeGadget(id) {
    const row = gadgetRow(this.gadget[id]);
    if (!row || row.cooldown <= 0 || this.count[id * GADGET_COUNT + row.index] || Sim.tick < this.cooldownEnd[id]) return;
    this.count[id * GADGET_COUNT + row.index] = 1;
  },
  // A grenade cooking in the hand of someone who dies, freezes, goes down or is jammed falls at their feet with the fuse it has left.
  dropHeld(id) {
    if (this.holdStart[id] < 0) return;
    const row = CAT.gadgets[this.holdRow[id]], fuseLeft = Math.max(1, itemTicks(row.fuse) - this.heldTicks(id));
    this.holdStart[id] = this.holdRow[id] = -1;
    if (!row.cook) return;
    this.spend(id, row);
    Thrown.spawn(row, id, Actors.x[id], Actors.y[id] + 1, Actors.z[id], 0, GADGET_TUNING.dropSpeed, 0, fuseLeft);
  },

  // ---- HUD and preview ----
  hudState(id, out) {
    const grenade = id >= 0 ? gadgetRow(this.grenade[id]) : null, gadget = id >= 0 ? gadgetRow(this.gadget[id]) : null;
    out.grenade = grenade ? grenade.name : ''; out.grenadeCount = grenade ? this.count[id * GADGET_COUNT + grenade.index] : 0;
    out.gadget = gadget ? gadget.name : ''; out.gadgetCount = gadget ? this.count[id * GADGET_COUNT + gadget.index] : 0;
    out.gadgetCooldown = gadget && gadget.cooldown > 0 && !out.gadgetCount ? clamp((this.cooldownEnd[id] - Sim.tick) / this.rechargeTicks(id, gadget), 0, 1) : 0;
    const held = id >= 0 && this.holdStart[id] >= 0 ? CAT.gadgets[this.holdRow[id]] : null;
    out.cook = held && held.cook ? clamp(this.heldTicks(id) / itemTicks(held.fuse), 0, 1) : 0;
    return out;
  },
  // The local player's throw arc while the grenade button is held (setting gameplay.grenadePreview).
  drawPreview(batch) {
    const id = Game.playerId;
    if (id < 0 || !Actors.alive[id] || this.holdStart[id] < 0 || !Settings.get('gameplay.grenadePreview')) return;
    throwVelocity(id, (Actors.buttons[id] & BTN.ALT) !== 0, throwScratch);
    throwOrigin(id, throwStart);
    const point = previewScratch, gravity = bodyGravity();
    point.x = throwStart.x; point.y = throwStart.y; point.z = throwStart.z;
    point.vx = throwScratch.x; point.vy = throwScratch.y; point.vz = throwScratch.z;
    const row = CAT.gadgets[this.holdRow[id]], steps = this.previewSteps(id, row);
    for (let step = 0; step < steps; step++) {
      if (this.previewStep(point, gravity)) { this.drawLanding(batch, point, row); return; }
      if (step % 2 !== 0) continue;
      previewDotInstance.x = point.x; previewDotInstance.y = point.y; previewDotInstance.z = point.z;
      batch.meshFrom('sphere', previewDotInstance);
    }
  },
  // The grenade the local player holds (cooking or about to throw), low in the left of the first-person view.
  drawHeld(batch) {
    const id = Game.playerId;
    if (id < 0 || !Actors.alive[id] || this.holdStart[id] < 0 || Render.view.overridden) return;
    const camera = Render.camera, pose = gadgetPose, yaw = camera.yaw, pitch = camera.pitch;
    const sinYaw = Math.sin(yaw), cosYaw = Math.cos(yaw), sinPitch = Math.sin(pitch), cosPitch = Math.cos(pitch);
    const forward = HELD_FORWARD, down = HELD_DOWN, left = HELD_LEFT;   // camera axes: forward, right = (-cos, 0, sin), up
    pose.x = camera.x + sinYaw * cosPitch * forward + cosYaw * left + sinPitch * sinYaw * down;
    pose.y = camera.y + sinPitch * forward - cosPitch * down;
    pose.z = camera.z + cosYaw * cosPitch * forward - sinYaw * left + sinPitch * cosYaw * down;
    pose.yaw = yaw; pose.emissive = THROWN_GLOW;
    drawGadgetModel(batch, CAT.gadgets[this.holdRow[id]], pose);
  },
  // Arc segments until the fuse would end (what is left of it for a cooking grenade).
  previewSteps(id, row) {
    const fuseTicks = row.cook ? itemTicks(row.fuse) - this.heldTicks(id) : itemTicks(row.fuse);
    return Math.min(PREVIEW_POINTS, Math.ceil(fuseTicks / TICK_RATE / PREVIEW_SECONDS));
  },
  // One preview segment; true (and the point on the surface) when it meets the world.
  previewStep(point, gravity) {
    const seconds = PREVIEW_SECONDS, drop = gravity * seconds * seconds / 2;
    const nx = point.vx * seconds, ny = point.vy * seconds - drop, nz = point.vz * seconds, length = length3(nx, ny, nz);
    point.vy -= gravity * seconds;
    if (World.raycast(point.x, point.y, point.z, nx / length, ny / length, nz / length, length, gadgetHit)) {
      point.x = gadgetHit.x; point.y = gadgetHit.y; point.z = gadgetHit.z;
      return true;
    }
    point.x += nx; point.y += ny; point.z += nz;
    return false;
  },
  drawLanding(batch, point, row) {
    const instance = landingInstance;
    instance.x = point.x; instance.y = point.y + 0.05; instance.z = point.z;
    instance.sx = instance.sz = Math.max(0.5, row.radius * 2);
    batch.meshFrom('ring', instance);
  },
  clear() { Thrown.clear(); GadgetAreas.clear(); Smoke.clear(); this.cycleShown = -1; },   // a new match names the grenade type again on its first step
};

// Aim assist (INP-008) never locks through smoke (a filter, so whoever fills Input.aimAssistTarget keeps it).
Input.aimAssistFilters.push((id, point) => !Smoke.lineBlocked(Actors.x[id], Actors.eyeY(id), Actors.z[id], point.x, point.y, point.z, id));
Items.extraAmmo.push((id) => Gadgets.refill(id));
// GAD-002: ALT is the underhand throw while a grenade is held (or its button goes down with one ready), not the weapon's alt.
WeaponSpecialState.grenadeHook = Thrown;
Weapons.altClaim = (id) => Gadgets.holdStart[id] >= 0 || ((Actors.buttons[id] & BTN.GRENADE) !== 0 && Gadgets.grenadeReady(id));
Settings.define('gameplay.grenadePreview', true, { label: 'Grenade arc preview', category: 'gameplay', options: [false, true], optionLabels: ['Off', 'On'] });
Sim.addSystem('gadgets', 58, (dt) => Gadgets.step(dt));
Render.addSource('thrown', (batch) => { Thrown.draw(batch); Gadgets.drawHeld(batch); Gadgets.drawPreview(batch); });
Render.addSource('smoke', (batch) => Smoke.draw(batch));
Bus.on('weapon.fire', (event) => Smoke.onShot(event));
Bus.on('explosion', (event) => { if (Smoke.count && event.radius > 0) Smoke.punchSphere(event.x, event.y, event.z, event.radius); });
Bus.on('kill', (event) => Gadgets.dropHeld(event.victim));
Bus.on('actor.spawn', (event) => Gadgets.equip(event.id));
Bus.on('actor.create', (id) => Gadgets.resetActor(id));
Bus.on('match.start', () => Gadgets.clear());
Bus.on('round', (event) => { if (event.phase === 'start') Gadgets.clear(); });
Bus.on('match.end', () => Gadgets.clear());
Bus.on('match.stop', () => Gadgets.clear());
TouchInput.needs.gadget = () => Game.playerId >= 0 && Gadgets.gadget[Game.playerId] >= 0;
TouchInput.needs.grenade = () => Game.playerId >= 0 && Gadgets.thrownTotal(Game.playerId) > 0;
