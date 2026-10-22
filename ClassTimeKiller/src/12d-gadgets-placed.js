// S12 placed and deployed gadgets (step 10.4, GAD-003): BTN.GADGET sets the gadget-slot row in front of the owner as a
// pooled device with health, owner, team, an arming delay and a lifetime. Behaviour per row.effect: mines, dome, barrier
// (a dynamic brush), lift pad, turret, heal and drain fields, jammer, scuttler drones, projectile snatcher, supply crate and
// rally beacon. Per-owner caps (row.max, perTeam), visible tells (enemy placed gadgets only glint within 8 m), destroyed
// by shots and blasts, disabled by EMP, removed on the owner's death and at match end. All harm goes through Damage.

const DEVICE_CAP = 64;
const DEVICE_REACH = 2;                 // placed up to this far in front of the eye
const DEVICE_FLOOR_PROBE = 3;           // and dropped this far at most to the floor
const DEVICE_WALL_GAP = 0.4;            // deployed devices keep this far from the wall they were aimed at
const DEVICE_HIT_MINIMUM = 0.3;         // smallest hit sphere radius of a device (shots and blasts)
const DEVICE_BLAST_DAMAGE = 100;        // blast damage to devices at the centre, falling to 0 at the radius
const DEVICE_DEFAULT_SHOT = 10;         // shot damage when a fire mode lists none
const DEVICE_TICK = 0.25;               // fields and supply act on this tick
const LAUNCH_FOOT_HEIGHT = 0.5;         // the lift pad pushes actors whose feet are this close to its top
const DRONE_HOVER = 0.3;
const DRONE_BLAST_SHARE = 0.5;          // a drone goes off when its target is within this share of its blast radius
const TURRET_MUZZLE = 0.7;
const TURRET_INVISIBLE_SHARE = 0.25;    // turrets see invisible enemies only within this share of their range
const TURRET_NOISE = 50;
const BEACON_OFFSET = 1;                // spawn this far from the beacon
const DEVICE_DRAW_GLINT = 0.08;
const CAPSULE_CHECK_HEIGHTS = [0.3, 0.9, 1.6];

const DEVICE_RGB = pickupRgbTable(CAT.gadgets, (row) => row.color);
const DEVICE_EVENT = { index: 0, gadget: '', owner: -1, x: 0, y: 0, z: 0 };
const deviceHit = makeHit();
const deviceActorHit = makeActorHit();
const deviceAim = Vec.make();
const devicePoint = Vec.make();
const deviceDirection = Vec.make();

// Every shared helper works on the Devices store; behaviour functions get (d, row, dt).
const Devices = {
  active: new Uint8Array(DEVICE_CAP), row: new Int16Array(DEVICE_CAP), owner: new Int8Array(DEVICE_CAP), team: new Int8Array(DEVICE_CAP),
  x: new Float32Array(DEVICE_CAP), y: new Float32Array(DEVICE_CAP), z: new Float32Array(DEVICE_CAP), yaw: new Float32Array(DEVICE_CAP),
  health: new Float32Array(DEVICE_CAP), armTick: new Int32Array(DEVICE_CAP), endTick: new Int32Array(DEVICE_CAP),
  disabledUntil: new Int32Array(DEVICE_CAP), clock: new Float32Array(DEVICE_CAP), charges: new Int16Array(DEVICE_CAP),
  target: new Int8Array(DEVICE_CAP).fill(-1), brush: new Array(DEVICE_CAP).fill(null),
  count: 0,
  steps: {},                                  // row.effect -> fn(d, row, dt)

  clear() {
    for (let d = 0; d < DEVICE_CAP; d++) if (this.active[d]) this.remove(d, false);
    this.count = 0;
  },
  rowOf(d) { return CAT.gadgets[this.row[d]]; },
  ownedCount(owner, row) {
    let total = 0;
    for (let d = 0; d < DEVICE_CAP; d++) if (this.active[d] && this.owner[d] === owner && this.row[d] === row.index) total++;
    return total;
  },
  teamHas(team, row) {
    for (let d = 0; d < DEVICE_CAP; d++) if (this.active[d] && this.team[d] === team && this.row[d] === row.index) return true;
    return false;
  },
  // How many devices of the row the owner may still set (GAD-003 caps; perTeam rows: one per team).
  room(owner, row) {
    if (row.perTeam && Actors.team[owner] >= 0 && this.teamHas(Actors.team[owner], row)) return 0;
    return Math.max(0, row.max - this.ownedCount(owner, row));
  },
  // 12c deployer: sets the row in front of the owner; false (the use is kept) when there is no room or no floor.
  deploy(owner, row) {
    if (row.kind === 'thrown' || !this.room(owner, row) || !this.findSpot(owner, row)) return false;
    if (row.effect === 'barrier' && !barrierFits(row, devicePoint.x, devicePoint.z)) return false;
    const total = Math.min(row.count, this.room(owner, row));
    for (let k = 0; k < total; k++) this.spawn(row, owner, devicePoint.x + (k - (total - 1) / 2) * 0.6 * Math.cos(Actors.yaw[owner]), devicePoint.y, devicePoint.z - (k - (total - 1) / 2) * 0.6 * Math.sin(Actors.yaw[owner]));
    return true;
  },
  // Spot in front of the owner into devicePoint: sticking rows take the surface they are aimed at, others the floor below.
  findSpot(owner, row) {
    Vec.fromAngles(deviceAim, Actors.yaw[owner], Actors.pitch[owner]);
    const eyeY = Actors.eyeY(owner);
    const wall = World.raycast(Actors.x[owner], eyeY, Actors.z[owner], deviceAim.x, deviceAim.y, deviceAim.z, DEVICE_REACH, deviceHit);
    if (wall && row.stick) { Vec.set(devicePoint, deviceHit.x, deviceHit.y, deviceHit.z); return true; }
    const reach = wall ? Math.max(0, deviceHit.distance - DEVICE_WALL_GAP) : DEVICE_REACH;
    const x = Actors.x[owner] + deviceAim.x * reach, y = eyeY + deviceAim.y * reach, z = Actors.z[owner] + deviceAim.z * reach;
    if (!World.raycast(x, y, z, 0, -1, 0, DEVICE_FLOOR_PROBE + Math.max(0, y - Actors.y[owner]), deviceHit)) return false;
    Vec.set(devicePoint, deviceHit.x, deviceHit.y, deviceHit.z);
    return true;
  },
  freeSlot() {
    let oldest = 0;
    for (let d = 0; d < DEVICE_CAP; d++) {
      if (!this.active[d]) return d;
      if (this.endTick[d] < this.endTick[oldest]) oldest = d;
    }
    this.remove(oldest, false);
    return oldest;
  },
  spawn(row, owner, x, y, z) {
    const d = this.freeSlot();
    this.active[d] = 1; this.row[d] = row.index; this.owner[d] = owner; this.team[d] = owner >= 0 ? Actors.team[owner] : -1;
    this.x[d] = x; this.y[d] = y; this.z[d] = z; this.yaw[d] = owner >= 0 ? Actors.yaw[owner] : 0;
    this.health[d] = row.health; this.armTick[d] = Sim.tick + itemTicks(row.arm); this.endTick[d] = Sim.tick + itemTicks(row.duration || DEVICE_FOREVER_SECONDS);
    this.disabledUntil[d] = 0; this.clock[d] = 0; this.charges[d] = row.amount; this.target[d] = -1;
    if (row.effect === 'barrier') this.addBrush(d, row);
    this.count++;
    this.emit('gadget.place', d);
    return d;
  },
  remove(d, destroyed) {
    if (!this.active[d]) return;
    this.active[d] = 0;
    this.count = Math.max(0, this.count - 1);
    this.removeBrush(d);
    if (destroyed) this.emit('gadget.destroyed', d);
  },
  emit(name, d) {
    DEVICE_EVENT.index = d; DEVICE_EVENT.gadget = this.rowOf(d).id; DEVICE_EVENT.owner = this.owner[d];
    DEVICE_EVENT.x = this.x[d]; DEVICE_EVENT.y = this.y[d]; DEVICE_EVENT.z = this.z[d];
    Bus.emit(name, DEVICE_EVENT);
  },
  // G13: an axis-aligned brush (the footprint turns with the owner's facing, snapped to the nearest axis).
  addBrush(d, row) {
    const across = Math.abs(Math.sin(this.yaw[d])) > Math.SQRT1_2;
    const halfX = (across ? row.size[2] : row.size[0]) / 2, halfZ = (across ? row.size[0] : row.size[2]) / 2;
    const source = { min: [this.x[d] - halfX, this.y[d], this.z[d] - halfZ], max: [this.x[d] + halfX, this.y[d] + row.size[1], this.z[d] + halfZ], shape: 'box', material: 'metal' };
    this.brush[d] = makeBrush(source, -1);
    World.dynamic.push(this.brush[d]);
  },
  removeBrush(d) {
    const brush = this.brush[d];
    if (!brush) return;
    const index = World.dynamic.indexOf(brush);
    if (index >= 0) World.dynamic.splice(index, 1);
    this.brush[d] = null;
  },

  // ---- Step (Sim order 59) ----
  step(dt) {
    if (!this.count) return;
    for (let d = 0; d < DEVICE_CAP; d++) {
      if (!this.active[d]) continue;
      if (Sim.tick >= this.endTick[d]) { this.expire(d); continue; }
      if (this.working(d)) this.steps[this.rowOf(d).effect](d, this.rowOf(d), dt);
    }
  },
  working(d) { return Sim.tick >= this.armTick[d] && Sim.tick >= this.disabledUntil[d]; },
  // Drones that run out of time go off where they are; everything else just ends.
  expire(d) {
    const row = this.rowOf(d);
    this.remove(d, false);
    if (row.effect === 'drones') gadgetBlast(row, this.owner[d], this.x[d], this.y[d], this.z[d]);
  },
  due(d, dt, interval) {
    this.clock[d] += dt;
    if (this.clock[d] < interval - 1e-6) return false;
    this.clock[d] -= interval;
    return true;
  },
  // True for living enemies of the owner (what devices target, trigger on and block).
  enemyOf(d, id) {
    if (!Actors.alive[id] || id === this.owner[d]) return false;
    return this.team[d] < 0 || Actors.team[id] !== this.team[d];
  },
  // Enemies can break a device; teammates only with friendly fire on; the owner never.
  canHurt(d, source) {
    if (source < 0 || this.enemyOf(d, source)) return true;
    return source !== this.owner[d] && itemRule('friendlyFire', 0) > 0;
  },
  friendOf(d, id) { return Actors.alive[id] && (id === this.owner[d] || (this.team[d] >= 0 && Actors.team[id] === this.team[d])); },
  inSphere(d, id, radius) {
    Hitbox.point(id, ZONE.BODY, devicePoint);
    return distanceSquared3(this.x[d], this.y[d] + 0.5, this.z[d], devicePoint.x, devicePoint.y, devicePoint.z) <= radius * radius;
  },

  // G10 / G11: armed mines go off when an enemy body is within trigger range (and the cone); crouching passes crouchSafe rows.
  stepMine(d, row) {
    for (let id = 0; id < Actors.count; id++) {
      if (!this.enemyOf(d, id) || !this.mineSees(d, row, id)) continue;
      this.remove(d, false);
      gadgetBlast(row, this.owner[d], this.x[d], this.y[d] + 0.2, this.z[d]);
      return;
    }
  },
  mineSees(d, row, id) {
    if (row.crouchSafe && (Actors.flags[id] & (ACTOR_FLAG.CROUCHED | ACTOR_FLAG.PRONE))) return false;
    if (!this.inSphere(d, id, row.trigger)) return false;
    if (row.coneDeg < 360 && !this.inCone(d, row, devicePoint.x, devicePoint.z)) return false;
    return World.lineClear(this.x[d], this.y[d] + 0.2, this.z[d], devicePoint.x, devicePoint.y, devicePoint.z);
  },
  inCone(d, row, x, z) {
    const dx = x - this.x[d], dz = z - this.z[d], length = Math.hypot(dx, dz) || 1;
    return (dx * Math.sin(this.yaw[d]) + dz * Math.cos(this.yaw[d])) / length >= Math.cos(row.coneDeg / 2 * DEG);
  },
  // G12: enemy projectiles and grenades that cross into the dome are stopped; friends inside regain health and shield.
  stepDome(d, row, dt) {
    this.blockProjectiles(d, row, dt, false);
    for (let id = 0; id < Actors.count; id++) if (this.friendOf(d, id) && this.inSphere(d, id, row.radius)) deviceHeal(id, row.heal * dt, true);
  },
  // Removes enemy projectiles / thrown grenades inside the radius: the dome only those that came from outside this step,
  // the snatcher (G22) any, up to its charges. Returns how many it removed.
  blockProjectiles(d, row, dt, snatch) {
    let removed = 0;
    for (let i = 0; i < PROJECTILE_CAP; i++) {
      if (Projectiles.state[i] !== PROJECTILE_STATE.FLYING || !this.blocks(d, row, dt, snatch, Projectiles.owner[i], Projectiles.x[i], Projectiles.y[i], Projectiles.z[i], Projectiles.vx[i], Projectiles.vy[i], Projectiles.vz[i])) continue;
      Projectiles.remove(i);
      this.blockFx(Projectiles.x[i], Projectiles.y[i], Projectiles.z[i]);
      if (++removed >= this.charges[d] && snatch) return removed;
    }
    for (let slot = 0; slot < THROWN_CAP; slot++) {
      if (!Thrown.state[slot] || !this.blocks(d, row, dt, snatch, Thrown.owner[slot], Thrown.x[slot], Thrown.y[slot], Thrown.z[slot], Thrown.vx[slot], Thrown.vy[slot], Thrown.vz[slot])) continue;
      Thrown.removeAt(slot);
      if (++removed >= this.charges[d] && snatch) return removed;
    }
    return removed;
  },
  blocks(d, row, dt, snatch, owner, x, y, z, vx, vy, vz) {
    if (owner >= 0 && !this.enemyOf(d, owner)) return false;
    const radiusSquared = row.radius * row.radius;
    if (distanceSquared3(x, y, z, this.x[d], this.y[d], this.z[d]) > radiusSquared) return false;
    return snatch || distanceSquared3(x - vx * dt, y - vy * dt, z - vz * dt, this.x[d], this.y[d], this.z[d]) > radiusSquared;
  },
  blockFx(x, y, z) {
    if (!Game.headless) Fx.burst('energy', x, y, z, 0, 1, 0, 8, null);
  },
  // G22: removes the first `amount` enemy projectiles or grenades within its radius, then is spent.
  stepTrophy(d, row, dt) {
    this.charges[d] -= this.blockProjectiles(d, row, dt, true);
    if (this.charges[d] <= 0) this.remove(d, false);
  },
  // G14: anyone standing on the pad is thrown up to `launch` metres (the impulse makes up for the match knockback scale).
  stepLaunch(d, row) {
    const knockback = MatchMove.knockback || 1;
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id] || !(Actors.flags[id] & ACTOR_FLAG.ON_GROUND) || !this.onPad(d, row, id)) continue;
      const speed = Math.sqrt(2 * Move.gravity(id) * row.launch);
      emitGadgetImpulse(id, 0, (speed - Actors.vy[id]) / knockback, 0);
      emitGadgetSound(this.x[d], this.y[d], this.z[d], GRENADE_NOISE, 'jump', id);
    }
  },
  onPad(d, row, id) {
    if (Math.abs(Actors.y[id] - this.y[d] - row.size[1]) > LAUNCH_FOOT_HEIGHT) return false;
    return (Actors.x[id] - this.x[d]) ** 2 + (Actors.z[id] - this.z[d]) ** 2 <= row.radius * row.radius;
  },
  // G15: shoots the nearest seen enemy in range `rate` times a second (hitscan with a small spread).
  stepTurret(d, row, dt) {
    if (!this.due(d, dt, 1 / row.rate)) return;
    const target = this.turretTarget(d, row);
    this.target[d] = target;
    if (target >= 0) this.turretShot(d, row, target);
  },
  turretTarget(d, row) {
    let best = -1, bestDistance = row.range * row.range;
    const muzzleY = this.y[d] + TURRET_MUZZLE;
    for (let id = 0; id < Actors.count; id++) {
      if (!this.enemyOf(d, id)) continue;
      Hitbox.point(id, ZONE.BODY, devicePoint);
      const distance = distanceSquared3(this.x[d], muzzleY, this.z[d], devicePoint.x, devicePoint.y, devicePoint.z);
      if (distance < bestDistance && this.turretSees(d, row, id, distance)) { best = id; bestDistance = distance; }
    }
    return best;
  },
  turretSees(d, row, id, distanceSquared) {
    const seeRange = row.range * TURRET_INVISIBLE_SHARE;
    if ((Actors.flags[id] & ACTOR_FLAG.INVISIBLE) && distanceSquared > seeRange * seeRange) return false;
    const muzzleY = this.y[d] + TURRET_MUZZLE;
    if (!World.lineClear(this.x[d], muzzleY, this.z[d], devicePoint.x, devicePoint.y, devicePoint.z)) return false;
    return !Smoke.lineBlocked(this.x[d], muzzleY, this.z[d], devicePoint.x, devicePoint.y, devicePoint.z);
  },
  turretShot(d, row, target) {
    const x = this.x[d], y = this.y[d] + TURRET_MUZZLE, z = this.z[d], spread = GADGET_TUNING.turretSpreadDeg * DEG;
    Hitbox.point(target, ZONE.BODY, devicePoint);
    this.yaw[d] = Math.atan2(devicePoint.x - x, devicePoint.z - z);
    const pitch = Math.atan2(devicePoint.y - y, Math.hypot(devicePoint.x - x, devicePoint.z - z));
    Vec.fromAngles(deviceDirection, this.yaw[d] + Rng.weapons.range(-spread, spread), pitch + Rng.weapons.range(-spread, spread));
    const wall = World.raycast(x, y, z, deviceDirection.x, deviceDirection.y, deviceDirection.z, row.range, deviceHit) ? deviceHit.distance : row.range;
    const hit = World.raycastActors(x, y, z, deviceDirection.x, deviceDirection.y, deviceDirection.z, wall, this.owner[d], deviceActorHit);
    const reach = hit >= 0 ? deviceActorHit.distance : wall;
    if (hit >= 0 && this.enemyOf(d, hit)) deviceDamage(this.owner[d], hit, row, row.damage, 'hit', deviceActorHit);
    if (!Game.headless) Fx.tracer(x, y, z, x + deviceDirection.x * reach, y + deviceDirection.y * reach, z + deviceDirection.z * reach, null);
    emitGadgetSound(x, y, z, TURRET_NOISE, 'shot', this.owner[d]);
  },
  // G16: everyone inside (enemies too) regains health.
  stepHeal(d, row, dt) {
    for (let id = 0; id < Actors.count; id++) if (Actors.alive[id] && this.inSphere(d, id, row.radius)) deviceHeal(id, row.heal * dt, false);
  },
  // G17: enemy shields inside drain (through Damage.apply, never more than the shield left).
  stepDrain(d, row, dt) {
    if (!this.due(d, dt, DEVICE_TICK)) return;
    for (let id = 0; id < Actors.count; id++) {
      const amount = Math.min(row.drain * DEVICE_TICK, Actors.shield[id]);
      if (amount > 0 && this.enemyOf(d, id) && this.inSphere(d, id, row.radius)) deviceDamage(this.owner[d], id, row, amount, 'dot', null);
    }
  },
  // G21: each drone rolls to the nearest enemy within range and goes off next to it.
  stepDrone(d, row, dt) {
    const target = this.droneTarget(d, row);
    if (target < 0) return;
    Hitbox.point(target, ZONE.BODY, devicePoint);
    const dx = devicePoint.x - this.x[d], dz = devicePoint.z - this.z[d], length = Math.hypot(dx, dz);
    if (length <= row.radius * DRONE_BLAST_SHARE) { this.remove(d, false); gadgetBlast(row, this.owner[d], this.x[d], this.y[d] + DRONE_HOVER, this.z[d]); return; }
    const move = Math.min(length, row.speed * dt);
    if (World.raycast(this.x[d], this.y[d] + DRONE_HOVER, this.z[d], dx / length, 0, dz / length, move + 0.2, deviceHit)) return;
    this.x[d] += dx / length * move; this.z[d] += dz / length * move; this.yaw[d] = Math.atan2(dx, dz);
    this.followFloor(d);
  },
  droneTarget(d, row) {
    let best = -1, bestDistance = row.range * row.range;
    for (let id = 0; id < Actors.count; id++) {
      if (!this.enemyOf(d, id)) continue;
      const distance = distanceSquared3(this.x[d], this.y[d], this.z[d], Actors.x[id], Actors.y[id], Actors.z[id]);
      if (distance < bestDistance && World.lineClear(this.x[d], this.y[d] + DRONE_HOVER, this.z[d], Actors.x[id], Actors.eyeY(id), Actors.z[id])) { best = id; bestDistance = distance; }
    }
    return best;
  },
  followFloor(d) {
    if (World.raycast(this.x[d], this.y[d] + 1, this.z[d], 0, -1, 0, 1 + DEVICE_FLOOR_PROBE, deviceHit)) this.y[d] = deviceHit.y;
  },
  // G23: friends inside regain `amount` of each owned weapon's max ammo per second.
  stepSupply(d, row, dt) {
    if (!this.due(d, dt, 1)) return;
    for (let id = 0; id < Actors.count; id++) if (this.friendOf(d, id) && this.inSphere(d, id, row.radius)) deviceAmmo(id, row.amount);
  },
  // G24: a teammate who spawns while the beacon stands appears next to it (when a body fits there).
  onSpawn(id) {
    if (!this.count) return;
    for (let d = 0; d < DEVICE_CAP; d++) {
      if (!this.active[d] || this.rowOf(d).effect !== 'beacon' || !this.working(d) || !this.friendOf(d, id) || this.team[d] < 0) continue;
      if (this.moveToBeacon(d, id)) return;
    }
  },
  moveToBeacon(d, id) {
    const x = this.x[d] + Math.sin(this.yaw[d]) * BEACON_OFFSET, z = this.z[d] + Math.cos(this.yaw[d]) * BEACON_OFFSET, y = this.y[d];
    for (let k = 0; k < CAPSULE_CHECK_HEIGHTS.length; k++) if (World.pointInside(x, y + CAPSULE_CHECK_HEIGHTS[k], z)) return false;
    Actors.x[id] = x; Actors.y[id] = y; Actors.z[id] = z;
    return true;
  },
  // G18: true when an enemy jammer covers this actor (the HUD hides its radar).
  jammed(id) {
    if (!this.count) return false;
    for (let d = 0; d < DEVICE_CAP; d++) {
      if (this.active[d] && this.rowOf(d).effect === 'jammer' && this.working(d) && this.enemyOf(d, id) && this.inSphere(d, id, this.rowOf(d).radius)) return true;
    }
    return false;
  },
  // G20 hook: devices of other teams within the radius stop working for the given seconds.
  onEmp(owner, x, y, z, radius, seconds) {
    for (let d = 0; d < DEVICE_CAP; d++) {
      if (!this.active[d] || (owner >= 0 && !this.enemyOf(d, owner)) || distanceSquared3(x, y, z, this.x[d], this.y[d], this.z[d]) > radius * radius) continue;
      this.disabledUntil[d] = Math.max(this.disabledUntil[d], Sim.tick + itemTicks(seconds));
    }
  },

  // ---- Damage to devices ----
  damage(d, amount, source) {
    if (!this.active[d] || this.rowOf(d).health <= 0 || amount <= 0) return false;
    if (!this.canHurt(d, source)) return false;
    this.health[d] -= amount;
    if (this.health[d] > 0) return false;
    this.remove(d, true);
    if (!Game.headless) Fx.burst('spark', this.x[d], this.y[d] + 0.3, this.z[d], 0, 1, 0, 16, null);
    emitGadgetSound(this.x[d], this.y[d], this.z[d], POP_NOISE, 'break', source);
    return true;
  },
  hitRadius(d) { const size = this.rowOf(d).size; return Math.max(DEVICE_HIT_MINIMUM, Math.max(size[0], size[1], size[2]) / 2); },
  centreY(d) { return this.y[d] + this.rowOf(d).size[1] / 2; },
  // Shots (hitscan, beam, cone rays) hit the nearest device sphere in front of the first wall.
  onShot(event) {
    if (!this.count) return;
    const mode = gadgetShotMode(event);
    if (!mode) return;
    const range = mode.range || DEVICE_REACH;
    const wall = World.raycast(event.x, event.y, event.z, event.dx, event.dy, event.dz, range, deviceHit) ? deviceHit.distance : range;
    const d = this.rayDevice(event.x, event.y, event.z, event.dx, event.dy, event.dz, wall + 0.05);
    if (d >= 0) this.damage(d, (mode.damage || DEVICE_DEFAULT_SHOT) * mode.pellets, event.id);
  },
  rayDevice(ox, oy, oz, dx, dy, dz, maxDistance) {
    let best = -1, bestDistance = maxDistance;
    for (let d = 0; d < DEVICE_CAP; d++) {
      if (!this.active[d] || this.rowOf(d).health <= 0) continue;
      const distance = raySphere(ox, oy, oz, dx, dy, dz, this.x[d], this.centreY(d), this.z[d], this.hitRadius(d));
      if (distance >= 0 && distance < bestDistance) { best = d; bestDistance = distance; }
    }
    return best;
  },
  onExplosion(event) {
    if (!this.count || event.radius <= 0) return;
    for (let d = 0; d < DEVICE_CAP; d++) {
      if (!this.active[d]) continue;
      const distance = Math.sqrt(distanceSquared3(event.x, event.y, event.z, this.x[d], this.centreY(d), this.z[d]));
      if (distance < event.radius) this.damage(d, DEVICE_BLAST_DAMAGE * (1 - distance / event.radius), event.owner);
    }
  },
  onDeath(id) {
    if (!this.count) return;
    for (let d = 0; d < DEVICE_CAP; d++) if (this.active[d] && this.owner[d] === id) this.remove(d, false);
  },

  // ---- Visibility and drawing ----
  // Bots and the renderer: friends always see a device; enemy placed gadgets only show (a glint) within 8 m in sight.
  visibleTo(d, id) {
    if (!this.active[d]) return false;
    if (id < 0 || this.friendOf(d, id) || this.rowOf(d).kind !== 'placed') return true;
    const range = GADGET_TUNING.enemyGlintRange, eyeY = Actors.eyeY(id);
    if (distanceSquared3(Actors.x[id], eyeY, Actors.z[id], this.x[d], this.y[d], this.z[d]) > range * range) return false;
    return World.lineClear(Actors.x[id], eyeY, Actors.z[id], this.x[d], this.y[d] + 0.1, this.z[d]);
  },
  draw(batch) {
    if (!this.count) return;
    for (let d = 0; d < DEVICE_CAP; d++) if (this.active[d] && this.visibleTo(d, Game.playerId)) this.drawDevice(batch, d);
  },
  drawDevice(batch, d) {
    const row = this.rowOf(d), o = row.index * 3, size = row.size, armed = this.working(d);
    const glow = armed ? 0.35 + 0.25 * Math.sin(Sim.time * 6) : 0.05;
    batch.mesh(row.shape, this.x[d], this.y[d] + size[1] / 2, this.z[d], this.yaw[d], 0, size[0], size[1], size[2], DEVICE_RGB[o], DEVICE_RGB[o + 1], DEVICE_RGB[o + 2], glow);
    if (row.radius > 1 && row.effect !== 'mine' && row.effect !== 'drones') {
      batch.mesh('ring', this.x[d], this.y[d] + 0.03, this.z[d], 0, 0, row.radius * 2, 0.03, row.radius * 2, DEVICE_RGB[o], DEVICE_RGB[o + 1], DEVICE_RGB[o + 2], 0.6);
    }
    if (row.kind === 'placed' && Game.playerId >= 0 && !this.friendOf(d, Game.playerId)) {
      batch.mesh('sphere', this.x[d], this.y[d] + size[1] + 0.05, this.z[d], 0, 0, DEVICE_DRAW_GLINT, DEVICE_DRAW_GLINT, DEVICE_DRAW_GLINT, 1, 0.1, 0.1, 1);
    }
  },
};
const DEVICE_FOREVER_SECONDS = 3600;

// G13 is refused where its footprint (the larger side in both directions) would close on a body.
function barrierFits(row, x, z) {
  const reach = Math.max(row.size[0], row.size[2]) / 2 + ACTOR_RADIUS;
  for (let id = 0; id < Actors.count; id++) {
    if (Actors.alive[id] && Math.abs(Actors.x[id] - x) < reach && Math.abs(Actors.z[id] - z) < reach) return false;
  }
  return true;
}
// Healing devices: health up to the maximum; the dome also tops up shields once health is full.
function deviceHeal(id, amount, shields) {
  const room = Math.max(0, Actors.maxHealth[id] - Actors.health[id]);
  Actors.health[id] += Math.min(room, amount);
  if (shields && amount > room) Actors.shield[id] = Math.min(Actors.maxShield[id], Actors.shield[id] + amount - room);
}
function deviceAmmo(id, share) {
  for (let w = 0; w < WEAPON_COUNT; w++) {
    const weapon = CAT.weapons[w];
    if (weapon.mag > 0 && Weapons.owned[Weapons.slotIndex(id, w)]) Weapons.addWeaponAmmo(id, weapon, Math.max(1, Math.round(Weapons.maxReserve(id, weapon) * share)));
  }
}
// Device harm through the single damage path (hit = the actor hit of a shot, or null for fields).
function deviceDamage(owner, target, row, amount, kind, hit) {
  const info = Damage.info();
  info.amount = amount; info.kind = kind; info.mode = GADGET_MODES[row.index]; info.weapon = row.id; info.element = row.element;
  if (hit) { info.zone = hit.zone; info.x = hit.x; info.y = hit.y; info.z = hit.z; info.distance = hit.distance; }
  else { info.x = Actors.x[target]; info.y = Actors.y[target] + 1; info.z = Actors.z[target]; }
  return Damage.apply(owner, target, info);
}

Devices.steps.mine = (d, row) => Devices.stepMine(d, row);
Devices.steps.dome = (d, row, dt) => Devices.stepDome(d, row, dt);
Devices.steps.barrier = () => {};
Devices.steps.launchpad = (d, row) => Devices.stepLaunch(d, row);
Devices.steps.turret = (d, row, dt) => Devices.stepTurret(d, row, dt);
Devices.steps.heal = (d, row, dt) => Devices.stepHeal(d, row, dt);
Devices.steps.drain = (d, row, dt) => Devices.stepDrain(d, row, dt);
Devices.steps.jammer = () => {};
Devices.steps.drones = (d, row, dt) => Devices.stepDrone(d, row, dt);
Devices.steps.trophy = (d, row, dt) => Devices.stepTrophy(d, row, dt);
Devices.steps.supply = (d, row, dt) => Devices.stepSupply(d, row, dt);
Devices.steps.beacon = () => {};

Gadgets.deployers.push((id, row) => Devices.deploy(id, row));
Gadgets.empHooks.push((owner, x, y, z, radius, seconds) => Devices.onEmp(owner, x, y, z, radius, seconds));
Gadgets.jammed = (id) => Devices.jammed(id);
Gadgets.visibleTo = (index, id) => Devices.visibleTo(index, id);
Gadgets.damageDevice = (index, amount, source) => Devices.damage(index, amount, source);
Sim.addSystem('deployables', 59, (dt) => Devices.step(dt));
Render.addSource('deployables', (batch) => Devices.draw(batch));
Bus.on('weapon.fire', (event) => Devices.onShot(event));
Bus.on('explosion', (event) => Devices.onExplosion(event));
Bus.on('kill', (event) => Devices.onDeath(event.victim));
Bus.on('actor.spawn', (event) => Devices.onSpawn(event.id));
Bus.on('match.start', () => Devices.clear());
Bus.on('match.end', () => Devices.clear());
Bus.on('match.stop', () => Devices.clear());
