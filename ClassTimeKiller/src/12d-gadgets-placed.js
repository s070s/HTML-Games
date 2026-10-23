// S12 placed and deployed gadgets (step 10.4, GAD-003): BTN.GADGET sets the gadget-slot row in front of the owner as a
// pooled device with health, owner, team, an arming delay and a lifetime. Behaviour per row.effect: mines, dome, barrier
// (a dynamic brush), lift pad, turret, heal and drain fields, jammer, scuttler drones, projectile snatcher, supply crate and
// rally beacon. Per-owner caps (row.max, perTeam), visible tells (enemy placed gadgets only glint within 8 m), destroyed
// by shots and blasts, disabled by EMP, removed on the owner's death and at match end. All harm goes through Damage.

const DEVICE_CAP = 64;
const DEVICE_REACH = 2;                 // placed up to this far in front of the eye
const DEVICE_FLOOR_PROBE = 3;           // and dropped this far at most to the floor
const DEVICE_WALL_GAP = 0.4;            // deployed devices keep this far from the wall they were aimed at
const DEVICE_ROW_GAP = 0.6;             // several devices of one use (G21) stand this far apart
const QUARTER_TURN = Math.PI / 2;
const DEVICE_HIT_MINIMUM = 0.3;         // smallest hit sphere radius of a device (shots and blasts)
const DEVICE_SHOT_SLACK = 0.05;         // a shot that meets a wall still hits a device sitting on it
const DEVICE_SPHERE_LIFT = 0.5;         // area spheres (heal, drain, jam, mines) are centred this high above the base
const DEVICE_BLAST_DAMAGE = 100;        // blast damage to devices at the centre, falling to 0 at the radius
const DEVICE_DEFAULT_SHOT = 10;         // shot damage when a fire mode lists none
const DEVICE_TICK = 0.25;               // fields and supply act on this tick
const LAUNCH_FOOT_HEIGHT = 0.5;         // the lift pad pushes actors whose feet are this close to its top
const DRONE_HOVER = 0.3;
const DRONE_BLAST_SHARE = 0.5;          // a drone goes off when its target is within this share of its blast radius
const DRONE_WALL_GAP = 0.2;             // a drone stops this far short of a wall in its way
const TURRET_MUZZLE = 0.7;
const DEVICE_INVISIBLE_SHARE = 0.25;    // turrets and drones see cloaked enemies only within this share of their range
const TURRET_NOISE = 50;
const BEACON_OFFSET = 1;                // spawn this far from the beacon
const DEVICE_DRAW_GLINT = 0.08;
const deviceMarkInstance = makeShapeInstance();   // a device's area ring and enemy glint (Devices.drawDevice)
const CAPSULE_CHECK_HEIGHTS = [0.3, 0.9, 1.6];

const DEVICE_EVENT = { index: 0, gadget: '', owner: -1, x: 0, y: 0, z: 0 };
const deviceHit = makeHit();
const deviceActorHit = makeActorHit();
const deviceAim = Vec.make();
const devicePoint = Vec.make();
// Turret and drone sight (nearestSeenEnemy): cloaked enemies only within DEVICE_INVISIBLE_SHARE of the range, smoke blocks.
const deviceSight = { row: null };
const DEVICE_SIGHT_RULE = {
  skip(device, id) { return !Devices.enemyOf(device, id); },
  point(id, out) { Hitbox.point(id, ZONE.BODY, out); },
  accept(device, id, dx, dy, dz, distance) {
    const cloakRange = deviceSight.row.range * DEVICE_INVISIBLE_SHARE;
    return distance <= cloakRange || !(Actors.flags[id] & ACTOR_FLAG.INVISIBLE);
  },
  blocked(x, y, z, point) { return Smoke.lineBlocked(x, y, z, point.x, point.y, point.z); },
};
const deviceDirection = Vec.make();

// Every shared helper works on the Devices store; behaviour functions get (d, row, dt).
const Devices = {
  active: new Uint8Array(DEVICE_CAP), row: new Int16Array(DEVICE_CAP), owner: new Int8Array(DEVICE_CAP), team: new Int8Array(DEVICE_CAP),
  x: new Float32Array(DEVICE_CAP), y: new Float32Array(DEVICE_CAP), z: new Float32Array(DEVICE_CAP), yaw: new Float32Array(DEVICE_CAP),
  health: new Float32Array(DEVICE_CAP), armTick: new Int32Array(DEVICE_CAP), endTick: new Int32Array(DEVICE_CAP),
  disabledUntil: new Int32Array(DEVICE_CAP), clock: new Float32Array(DEVICE_CAP), charges: new Int16Array(DEVICE_CAP),
  target: new Int8Array(DEVICE_CAP).fill(-1), brush: new Array(DEVICE_CAP).fill(null),
  count: 0,
  betweenRounds: false,                   // from a round's end to the next start (no beacon spawns)
  rayDistance: 0,                         // distance of the last rayDevice hit
  steps: {},                                  // row.effect -> fn(d, row, dt)

  clear() {
    for (let device = 0; device < DEVICE_CAP; device++) if (this.active[device]) this.remove(device, false);
    this.count = 0;
    this.betweenRounds = false;
  },
  rowOf(device) { return CAT.gadgets[this.row[device]]; },
  ownedCount(owner, row) {
    let total = 0;
    for (let device = 0; device < DEVICE_CAP; device++) if (this.active[device] && this.owner[device] === owner && this.row[device] === row.index) total++;
    return total;
  },
  teamHas(team, row) {
    for (let device = 0; device < DEVICE_CAP; device++) if (this.active[device] && this.team[device] === team && this.row[device] === row.index) return true;
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
    const acrossX = Math.cos(Actors.yaw[owner]) * DEVICE_ROW_GAP, acrossZ = -Math.sin(Actors.yaw[owner]) * DEVICE_ROW_GAP;
    for (let k = 0; k < total; k++) {
      const shift = k - (total - 1) / 2;   // several devices of one use stand side by side across the view
      this.spawn(row, owner, devicePoint.x + shift * acrossX, devicePoint.y, devicePoint.z + shift * acrossZ);
    }
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
    const device = oldestFreeSlot(this.active, this.endTick, DEVICE_CAP);
    this.remove(device, false);
    return device;
  },
  spawn(row, owner, x, y, z) {
    const device = this.freeSlot(), yaw = owner >= 0 ? Actors.yaw[owner] : 0;
    this.active[device] = 1; this.row[device] = row.index; this.owner[device] = owner;
    this.team[device] = owner >= 0 ? Actors.team[owner] : -1;
    this.x[device] = x; this.y[device] = y; this.z[device] = z;
    this.yaw[device] = row.effect === 'barrier' ? snapToAxis(yaw) : yaw;   // the drawn box matches its axis-aligned brush
    this.health[device] = row.health; this.armTick[device] = Sim.tick + itemTicks(row.arm);
    this.endTick[device] = Sim.tick + itemTicks(row.duration || DEVICE_FOREVER_SECONDS);
    this.disabledUntil[device] = 0; this.clock[device] = 0; this.charges[device] = row.charges; this.target[device] = -1;
    if (row.effect === 'barrier') this.addBrush(device, row);
    this.count++;
    this.emit('gadget.place', device);
    return device;
  },
  remove(device, destroyed) {
    if (!this.active[device]) return;
    this.active[device] = 0;
    this.count = Math.max(0, this.count - 1);
    this.removeBrush(device);
    if (destroyed) this.emit('gadget.destroyed', device);
  },
  emit(name, device) {
    DEVICE_EVENT.index = device; DEVICE_EVENT.gadget = this.rowOf(device).id; DEVICE_EVENT.owner = this.owner[device];
    DEVICE_EVENT.x = this.x[device]; DEVICE_EVENT.y = this.y[device]; DEVICE_EVENT.z = this.z[device];
    Bus.emit(name, DEVICE_EVENT);
  },
  // G13: an axis-aligned brush (the footprint turns with the device yaw, which spawn snapped to an axis).
  addBrush(device, row) {
    const across = Math.abs(Math.sin(this.yaw[device])) > Math.SQRT1_2;
    const halfX = (across ? row.size[2] : row.size[0]) / 2, halfZ = (across ? row.size[0] : row.size[2]) / 2;
    const x = this.x[device], y = this.y[device], z = this.z[device];
    const source = { min: [x - halfX, y, z - halfZ], max: [x + halfX, y + row.size[1], z + halfZ], shape: 'box', material: 'metal' };
    this.brush[device] = makeBrush(source, -1);
    World.dynamic.push(this.brush[device]);
  },
  removeBrush(device) {
    const brush = this.brush[device];
    if (!brush) return;
    const index = World.dynamic.indexOf(brush);
    if (index >= 0) World.dynamic.splice(index, 1);
    this.brush[device] = null;
  },

  // ---- Step (Sim order 59) ----
  step(dt) {
    if (!this.count) return;
    for (let device = 0; device < DEVICE_CAP; device++) {
      if (!this.active[device]) continue;
      if (Sim.tick >= this.endTick[device]) { this.expire(device); continue; }
      if (this.working(device)) this.steps[this.rowOf(device).effect](device, this.rowOf(device), dt);
    }
  },
  working(device) { return Sim.tick >= this.armTick[device] && Sim.tick >= this.disabledUntil[device]; },
  // Drones that run out of time go off where they are; everything else just ends.
  expire(device) {
    const row = this.rowOf(device);
    if (row.effect === 'drones') { this.detonateDrone(device, row); return; }
    this.remove(device, false);
  },
  due(device, dt, interval) { return intervalDue(this.clock, device, dt, interval); },
  // True for living enemies of the owner (what devices target, trigger on and block).
  enemyOf(device, id) {
    if (!Actors.alive[id] || id === this.owner[device]) return false;
    return this.team[device] < 0 || Actors.team[id] !== this.team[device];
  },
  // Enemies can break a device; teammates only with friendly fire on; the owner never.
  canHurt(device, source) {
    if (source < 0 || this.enemyOf(device, source)) return true;
    return source !== this.owner[device] && itemRule('friendlyFire', 0) > 0;
  },
  friendOf(device, id) {
    if (!Actors.alive[id]) return false;
    return id === this.owner[device] || (this.team[device] >= 0 && Actors.team[id] === this.team[device]);
  },
  inSphere(device, id, radius) {
    Hitbox.point(id, ZONE.BODY, devicePoint);
    const centreY = this.y[device] + DEVICE_SPHERE_LIFT;
    return distanceSquared3(this.x[device], centreY, this.z[device], devicePoint.x, devicePoint.y, devicePoint.z) <= radius * radius;
  },

  // G10 / G11: armed mines go off when an enemy body is within trigger range (and the cone); crouching passes crouchSafe rows.
  stepMine(device, row) {
    for (let id = 0; id < Actors.count; id++) {
      if (!this.enemyOf(device, id) || !this.mineSees(device, row, id)) continue;
      this.remove(device, false);
      gadgetBlast(row, this.owner[device], this.x[device], this.y[device] + 0.2, this.z[device]);
      return;
    }
  },
  mineSees(device, row, id) {
    if (row.crouchSafe && (Actors.flags[id] & (ACTOR_FLAG.CROUCHED | ACTOR_FLAG.PRONE))) return false;
    if (!this.inSphere(device, id, row.trigger)) return false;
    if (row.coneDeg < 360 && !this.inCone(device, row, devicePoint.x, devicePoint.z)) return false;
    return World.lineClear(this.x[device], this.y[device] + 0.2, this.z[device], devicePoint.x, devicePoint.y, devicePoint.z);
  },
  inCone(device, row, x, z) {
    const dx = x - this.x[device], dz = z - this.z[device], length = length2(dx, dz) || 1;
    return (dx * Math.sin(this.yaw[device]) + dz * Math.cos(this.yaw[device])) / length >= Math.cos(row.coneDeg / 2 * DEG);
  },
  // G12: projectiles and grenades that cross the dome wall are stopped both ways, whoever fired them; friends inside regain
  // health and shield.
  stepDome(device, row, dt) {
    this.blockProjectiles(device, row, dt, false);
    for (let id = 0; id < Actors.count; id++) {
      if (this.friendOf(device, id) && this.inSphere(device, id, row.radius)) deviceHeal(id, row.heal * dt, true);
    }
  },
  // Removes projectiles and thrown grenades: the dome those that crossed its wall this step, the snatcher (G22) enemy ones
  // anywhere inside its radius, up to its charges. Returns how many it removed.
  blockProjectiles(device, row, dt, snatch) {
    let removed = 0;
    for (let i = 0; i < PROJECTILE_CAP; i++) {
      if (Projectiles.state[i] !== PROJECTILE_STATE.FLYING || !this.stops(device, row, dt, snatch, Projectiles, i)) continue;
      Projectiles.remove(i);
      this.blockFx(Projectiles.x[i], Projectiles.y[i], Projectiles.z[i]);
      if (++removed >= this.charges[device] && snatch) return removed;
    }
    for (let slot = 0; slot < THROWN_CAP; slot++) {
      if (!Thrown.state[slot] || !this.stops(device, row, dt, snatch, Thrown, slot)) continue;
      Thrown.removeAt(slot);
      if (++removed >= this.charges[device] && snatch) return removed;
    }
    return removed;
  },
  // store: Projectiles or Thrown (both keep owner, x/y/z and vx/vy/vz arrays); the step before is position - velocity x dt.
  stops(device, row, dt, snatch, store, index) {
    const x = store.x[index], y = store.y[index], z = store.z[index];
    const inside = this.insideRadius(device, row, x, y, z);
    if (snatch) return inside && (store.owner[index] < 0 || this.enemyOf(device, store.owner[index]));
    const wasInside = this.insideRadius(device, row, x - store.vx[index] * dt, y - store.vy[index] * dt, z - store.vz[index] * dt);
    return inside !== wasInside;
  },
  insideRadius(device, row, x, y, z) {
    return distanceSquared3(x, y, z, this.x[device], this.y[device], this.z[device]) <= row.radius * row.radius;
  },
  blockFx(x, y, z) {
    if (!Game.headless) Fx.burst('energy', x, y, z, 0, 1, 0, 8, null);
  },
  // G22: removes the first `amount` enemy projectiles or grenades within its radius, then is spent.
  stepTrophy(device, row, dt) {
    this.charges[device] -= this.blockProjectiles(device, row, dt, true);
    if (this.charges[device] <= 0) this.remove(device, false);
  },
  // G14: anyone standing on the pad is thrown up to `launch` metres (the impulse makes up for the match knockback scale).
  stepLaunch(device, row) {
    const knockback = MatchMove.knockback || 1;
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id] || !(Actors.flags[id] & ACTOR_FLAG.ON_GROUND) || !this.onPad(device, row, id)) continue;
      const speed = Math.sqrt(2 * Move.gravity(id) * row.launch);
      emitImpulse(id, 0, (speed - Actors.vy[id]) / knockback, 0);
      emitSound(this.x[device], this.y[device], this.z[device], GRENADE_NOISE, 'jump', id);
    }
  },
  onPad(device, row, id) {
    if (Math.abs(Actors.y[id] - this.y[device] - row.size[1]) > LAUNCH_FOOT_HEIGHT) return false;
    return (Actors.x[id] - this.x[device]) ** 2 + (Actors.z[id] - this.z[device]) ** 2 <= row.radius * row.radius;
  },
  // G15: shoots the nearest seen enemy in range `rate` times a second (hitscan with a small spread).
  stepTurret(device, row, dt) {
    if (!this.due(device, dt, 1 / row.rate)) return;
    const target = this.nearestSeen(device, row, TURRET_MUZZLE);
    this.target[device] = target;
    if (target >= 0) this.turretShot(device, row, target);
  },
  // Turrets and drones: the nearest enemy body within row.range seen from `height` above the device's base.
  nearestSeen(device, row, height) {
    deviceSight.row = row;
    return nearestSeenEnemy(device, this.x[device], this.y[device] + height, this.z[device], row.range, DEVICE_SIGHT_RULE);
  },
  turretShot(device, row, target) {
    const x = this.x[device], y = this.y[device] + TURRET_MUZZLE, z = this.z[device], spread = GADGET_TUNING.turretSpreadDeg * DEG;
    Hitbox.point(target, ZONE.BODY, devicePoint);
    this.yaw[device] = Math.atan2(devicePoint.x - x, devicePoint.z - z);
    const pitch = Math.atan2(devicePoint.y - y, length2(devicePoint.x - x, devicePoint.z - z));
    const direction = Vec.fromAngles(deviceDirection, this.yaw[device] + Rng.weapons.range(-spread, spread), pitch + Rng.weapons.range(-spread, spread));
    const wallHit = World.raycast(x, y, z, direction.x, direction.y, direction.z, row.range, deviceHit);
    const wall = wallHit ? deviceHit.distance : row.range;
    const hit = World.raycastActors(x, y, z, direction.x, direction.y, direction.z, wall, this.owner[device], deviceActorHit);
    const reach = hit >= 0 ? deviceActorHit.distance : wall;
    if (hit >= 0 && this.enemyOf(device, hit)) deviceDamage(this.owner[device], hit, row, row.damage, 'hit', deviceActorHit);
    if (!Game.headless) Fx.tracer(x, y, z, x + direction.x * reach, y + direction.y * reach, z + direction.z * reach, null);
    emitSound(x, y, z, TURRET_NOISE, 'shot', this.owner[device]);
  },
  // G16: everyone inside (enemies too) regains health.
  stepHeal(device, row, dt) {
    for (let id = 0; id < Actors.count; id++) {
      if (Actors.alive[id] && this.inSphere(device, id, row.radius)) deviceHeal(id, row.heal * dt, false);
    }
  },
  // G17: enemy shields inside drain (through Damage.apply, never more than the shield left).
  stepDrain(device, row, dt) {
    if (!this.due(device, dt, DEVICE_TICK)) return;
    for (let id = 0; id < Actors.count; id++) {
      const amount = Math.min(row.drain * DEVICE_TICK, Actors.shield[id]);
      if (amount <= 0 || !this.enemyOf(device, id) || !this.inSphere(device, id, row.radius)) continue;
      deviceDamage(this.owner[device], id, row, amount, 'dot', null);
    }
  },
  // G21: each drone picks the nearest seen enemy in range on the DEVICE_TICK clock (between picks it only checks that the
  // target still lives), rolls to it and goes off next to it.
  stepDrone(device, row, dt) {
    if (!this.enemyOf(device, this.target[device])) this.target[device] = -1;
    if (this.due(device, dt, DEVICE_TICK)) this.target[device] = this.nearestSeen(device, row, DRONE_HOVER);
    if (this.target[device] >= 0) this.rollTo(device, row, this.target[device], dt);
  },
  rollTo(device, row, target, dt) {
    Hitbox.point(target, ZONE.BODY, devicePoint);
    const dx = devicePoint.x - this.x[device], dz = devicePoint.z - this.z[device], length = length2(dx, dz);
    if (length <= row.radius * DRONE_BLAST_SHARE) { this.detonateDrone(device, row); return; }
    const move = Math.min(length, row.speed * dt), hoverY = this.y[device] + DRONE_HOVER;
    if (World.raycast(this.x[device], hoverY, this.z[device], dx / length, 0, dz / length, move + DRONE_WALL_GAP, deviceHit)) return;
    this.x[device] += dx / length * move; this.z[device] += dz / length * move;
    this.yaw[device] = Math.atan2(dx, dz);
    this.followFloor(device);
  },
  detonateDrone(device, row) {
    this.remove(device, false);
    gadgetBlast(row, this.owner[device], this.x[device], this.y[device] + DRONE_HOVER, this.z[device]);
  },
  followFloor(device) {
    const probe = 1 + DEVICE_FLOOR_PROBE;
    if (World.raycast(this.x[device], this.y[device] + 1, this.z[device], 0, -1, 0, probe, deviceHit)) this.y[device] = deviceHit.y;
  },
  // G23: friends inside regain `amount` of each owned weapon's max ammo per second.
  stepSupply(device, row, dt) {
    if (!this.due(device, dt, 1)) return;
    for (let id = 0; id < Actors.count; id++) {
      if (this.friendOf(device, id) && this.inSphere(device, id, row.radius)) addAmmoShare(id, row.amount);
    }
  },
  // G24: a teammate who spawns while the beacon stands appears next to it (when a body fits there).
  onSpawn(id) {
    if (!this.count || this.betweenRounds) return;
    for (let device = 0; device < DEVICE_CAP; device++) {
      if (this.beaconFor(device, id) && this.moveToBeacon(device, id)) return;
    }
  },
  beaconFor(device, id) {
    if (!this.active[device] || this.rowOf(device).effect !== 'beacon') return false;   // friendOf: the owner alone when the match has no teams
    return this.working(device) && this.friendOf(device, id);
  },
  moveToBeacon(device, id) {
    const x = this.x[device] + Math.sin(this.yaw[device]) * BEACON_OFFSET, y = this.y[device];
    const z = this.z[device] + Math.cos(this.yaw[device]) * BEACON_OFFSET;
    for (let k = 0; k < CAPSULE_CHECK_HEIGHTS.length; k++) if (World.pointInside(x, y + CAPSULE_CHECK_HEIGHTS[k], z)) return false;
    Actors.x[id] = Actors.prevX[id] = x; Actors.y[id] = Actors.prevY[id] = y; Actors.z[id] = Actors.prevZ[id] = z;   // no interpolation smear
    return true;
  },
  // G18: true when an enemy jammer covers this actor (the HUD hides its radar).
  jammed(id) {
    if (!this.count) return false;
    for (let device = 0; device < DEVICE_CAP; device++) {
      if (!this.active[device] || this.rowOf(device).effect !== 'jammer' || !this.working(device)) continue;
      if (this.enemyOf(device, id) && this.inSphere(device, id, this.rowOf(device).radius)) return true;
    }
    return false;
  },
  // G20 hook: devices of other teams within the radius stop working for the given seconds.
  onEmp(owner, x, y, z, radius, seconds) {
    const until = Sim.tick + itemTicks(seconds);
    for (let device = 0; device < DEVICE_CAP; device++) {
      if (!this.active[device] || (owner >= 0 && !this.enemyOf(device, owner))) continue;
      if (distanceSquared3(x, y, z, this.x[device], this.y[device], this.z[device]) > radius * radius) continue;
      this.disabledUntil[device] = Math.max(this.disabledUntil[device], until);
    }
  },

  // ---- Damage to devices ----
  damage(device, amount, source) {
    if (!this.active[device] || this.rowOf(device).health <= 0 || amount <= 0) return false;
    if (!this.canHurt(device, source)) return false;
    this.health[device] -= amount;
    if (this.health[device] > 0) return false;
    this.remove(device, true);
    if (!Game.headless) Fx.burst('spark', this.x[device], this.y[device] + 0.3, this.z[device], 0, 1, 0, 16, null);
    emitSound(this.x[device], this.y[device], this.z[device], POP_NOISE, 'break', source);
    return true;
  },
  hitRadius(device) {
    const size = this.rowOf(device).size;
    return Math.max(DEVICE_HIT_MINIMUM, Math.max(size[0], size[1], size[2]) / 2);
  },
  centreY(device) { return this.y[device] + this.rowOf(device).size[1] / 2; },
  // Shots (hitscan, beam, cone rays) hit the nearest device sphere in front of the first wall or body.
  onShot(event) {
    if (!this.count) return;
    const mode = gadgetShotMode(event);
    if (!mode || Weapons.fliesAsBullet(mode)) return;   // X41 bullets hit devices as they fly (bulletHit)
    const reach = this.shotReach(event, mode.range || DEVICE_REACH);
    const device = this.rayDevice(event.x, event.y, event.z, event.dx, event.dy, event.dz, reach);
    if (device < 0) return;
    if (mode.repair > 0 && this.friendOf(device, event.id)) { this.repair(device, repairPerShot(mode)); return; }
    this.damage(device, (mode.damage || DEVICE_DEFAULT_SHOT) * mode.pellets, event.id);
  },
  // FireMode.repair (W30 beam): a friendly device regains health up to its row's maximum.
  repair(device, amount) { this.health[device] = Math.min(this.rowOf(device).health, this.health[device] + amount); },
  // Projectiles.bulletHits: an X41 bullet hits the device it stopped at (Weapons.rayBlockers) with one pellet.
  bulletHit(owner, mode, ox, oy, oz, dx, dy, dz, length) {
    if (!this.count) return;
    const device = this.rayDevice(ox, oy, oz, dx, dy, dz, length + DEVICE_SHOT_SLACK);
    if (device >= 0) this.damage(device, mode.damage || DEVICE_DEFAULT_SHOT, owner);
  },
  // How far a shot flies: to the first wall (devices on it still count), or to a body in front, which shields what is behind.
  shotReach(event, range) {
    const wallHit = World.raycast(event.x, event.y, event.z, event.dx, event.dy, event.dz, range, deviceHit);
    const wall = wallHit ? deviceHit.distance + DEVICE_SHOT_SLACK : range;
    const body = World.raycastActors(event.x, event.y, event.z, event.dx, event.dy, event.dz, wall, event.id, deviceActorHit);
    return body >= 0 ? deviceActorHit.distance : wall;
  },
  // The nearest device hit sphere along the ray (its distance in rayDistance), or -1.
  rayDevice(ox, oy, oz, dx, dy, dz, maxDistance) {
    let best = -1, bestDistance = maxDistance;
    for (let device = 0; device < DEVICE_CAP; device++) {
      if (!this.active[device] || this.rowOf(device).health <= 0) continue;
      const distance = raySphere(ox, oy, oz, dx, dy, dz, this.x[device], this.centreY(device), this.z[device], this.hitRadius(device));
      if (distance >= 0 && distance < bestDistance) { best = device; bestDistance = distance; }
    }
    this.rayDistance = bestDistance;
    return best;
  },
  // Weapons.rayBlockers: hitscan stops at a device with health (the weapon.fire listener above deals the damage).
  blockShot(ox, oy, oz, dx, dy, dz, maxDistance) {
    if (!this.count) return -1;
    return this.rayDevice(ox, oy, oz, dx, dy, dz, maxDistance) >= 0 ? this.rayDistance : -1;
  },
  onExplosion(event) {
    if (!this.count || event.radius <= 0) return;
    for (let device = 0; device < DEVICE_CAP; device++) {
      if (!this.active[device]) continue;
      const distance = Math.sqrt(distanceSquared3(event.x, event.y, event.z, this.x[device], this.centreY(device), this.z[device]));
      if (distance < event.radius) this.damage(device, DEVICE_BLAST_DAMAGE * (1 - distance / event.radius), event.owner);
    }
  },
  // A dead owner's devices go, except the G24 beacon: the team (and the owner) still respawn on it.
  onDeath(id) {
    if (!this.count) return;
    for (let device = 0; device < DEVICE_CAP; device++) {
      if (this.active[device] && this.owner[device] === id && this.rowOf(device).effect !== 'beacon') this.remove(device, false);
    }
  },

  // ---- Visibility and drawing ----
  // The renderer: friends always see a device and enemies see deployed devices (walls hide them on screen), but enemy
  // placed gadgets only as a glint within 8 m in sight (the GAD-003 tell).
  shownTo(device, id) {
    if (!this.active[device]) return false;
    if (id < 0 || this.friendOf(device, id) || this.rowOf(device).kind !== 'placed') return true;
    const range = GADGET_TUNING.enemyGlintRange, eyeY = Actors.eyeY(id);
    if (distanceSquared3(Actors.x[id], eyeY, Actors.z[id], this.x[device], this.y[device], this.z[device]) > range * range) return false;
    return this.inSight(device, id, eyeY);
  },
  // Bots (Gadgets.visibleTo): what shownTo allows, and enemy deployed devices only in line of sight.
  visibleTo(device, id) {
    if (!this.shownTo(device, id)) return false;
    if (id < 0 || this.friendOf(device, id) || this.rowOf(device).kind === 'placed') return true;   // placed: sight checked
    return this.inSight(device, id, Actors.eyeY(id));
  },
  inSight(device, id, eyeY) {
    return World.lineClear(Actors.x[id], eyeY, Actors.z[id], this.x[device], this.centreY(device), this.z[device]);
  },
  draw(batch) {
    if (!this.count) return;
    for (let device = 0; device < DEVICE_CAP; device++) {
      if (this.active[device] && this.shownTo(device, Game.playerId)) this.drawDevice(batch, device);
    }
  },
  drawDevice(batch, device) {
    const row = this.rowOf(device), x = this.x[device], y = this.y[device], z = this.z[device], pose = gadgetPose;
    pose.x = x; pose.y = y; pose.z = z; pose.yaw = this.yaw[device];
    pose.emissive = this.working(device) ? 0.35 + 0.25 * Math.sin(Sim.time * 6) : 0.05;
    drawGadgetModel(batch, row, pose);
    // the area ring and the enemy glint go through one reused instance record (batch.meshFrom, PERF-006)
    const mark = deviceMarkInstance, hasArea = row.radius > 1 && row.effect !== 'mine' && row.effect !== 'drones';
    mark.x = x; mark.z = z;
    if (hasArea) {
      mark.y = y + 0.03; mark.sx = mark.sz = row.radius * 2; mark.sy = 0.03;
      mark.r = pose.r; mark.g = pose.g; mark.b = pose.b; mark.emissive = 0.6;
      batch.meshFrom('ring', mark);
    }
    if (row.kind !== 'placed' || Game.playerId < 0 || this.friendOf(device, Game.playerId)) return;
    mark.y = y + GADGET_MODELS[row.index].top + 0.05;   // on the model's top, not the collision box
    mark.sx = mark.sy = mark.sz = DEVICE_DRAW_GLINT;
    mark.r = 1; mark.g = mark.b = 0.1; mark.emissive = 1;
    batch.meshFrom('sphere', mark);
  },
};
const DEVICE_FOREVER_SECONDS = 3600;

// The nearest of 0, 90, 180 and -90 degrees (barrier brushes are axis-aligned).
function snapToAxis(yaw) { return Math.round(yaw / QUARTER_TURN) * QUARTER_TURN; }

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
// Device harm through the single damage path (hit = the actor hit of a shot, or null for fields).
function deviceDamage(owner, target, row, amount, kind, hit) {
  const info = Damage.info();
  info.amount = amount; info.kind = kind; info.mode = GADGET_MODES[row.index]; info.weapon = row.id; info.element = row.element;
  if (hit) { info.zone = hit.zone; info.x = hit.x; info.y = hit.y; info.z = hit.z; info.distance = hit.distance; }
  else { info.x = Actors.x[target]; info.y = Actors.y[target] + 1; info.z = Actors.z[target]; }
  return Damage.apply(owner, target, info);
}

Devices.steps.mine = (device, row) => Devices.stepMine(device, row);
Devices.steps.dome = (device, row, dt) => Devices.stepDome(device, row, dt);
Devices.steps.barrier = () => {};
Devices.steps.launchpad = (device, row) => Devices.stepLaunch(device, row);
Devices.steps.turret = (device, row, dt) => Devices.stepTurret(device, row, dt);
Devices.steps.heal = (device, row, dt) => Devices.stepHeal(device, row, dt);
Devices.steps.drain = (device, row, dt) => Devices.stepDrain(device, row, dt);
Devices.steps.jammer = () => {};
Devices.steps.drones = (device, row, dt) => Devices.stepDrone(device, row, dt);
Devices.steps.trophy = (device, row, dt) => Devices.stepTrophy(device, row, dt);
Devices.steps.supply = (device, row, dt) => Devices.stepSupply(device, row, dt);
Devices.steps.beacon = () => {};

Gadgets.deployers.push((id, row) => Devices.deploy(id, row));
Weapons.rayBlockers.push((ox, oy, oz, dx, dy, dz, maxDistance) => Devices.blockShot(ox, oy, oz, dx, dy, dz, maxDistance));
Projectiles.bulletHits.push((owner, mode, ox, oy, oz, dx, dy, dz, length) => Devices.bulletHit(owner, mode, ox, oy, oz, dx, dy, dz, length));
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
// The next round's spawns come before its 'start' event: from the 'end' on, no beacon pulls them, and 'start' clears the gear.
Bus.on('round', (event) => { Devices.betweenRounds = event.phase === 'end'; if (event.phase === 'start') Devices.clear(); });
Bus.on('match.end', () => Devices.clear());
Bus.on('match.stop', () => Devices.clear());
