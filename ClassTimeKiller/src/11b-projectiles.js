// S11 projectiles: one pooled struct-of-arrays store, swept every 120 Hz step against the world and actor hit volumes (WPN-002).
// Behaviour comes from the projectile row (gravity, bounce, fuse, stick, homing, drag, arm, roll) and the firing mode
// (splash, split, puddle, aura, stickCombo, guided, laser). A full pool recycles its oldest projectile.

const PROJECTILE_CAP = 256;
const PROJECTILE_STATE = { FREE: 0, FLYING: 1, STUCK: 2, RETURNING: 3, AREA: 4, ATTACHED: 5 };
const SPLIT_GRACE_SECONDS = 0.25;        // shards from a split start slightly aged so they do not re-trigger on the same spot
const AREA_TICK_SECONDS = 0.25;          // the one area tick: puddles, auras, laser lines, fire areas (12c), devices (12d), floors (12h)
const AREA_HEIGHT = 1.5;                 // puddles hurt actors whose feet are this close above or below
const ATTACH_SECONDS = 2;                // stuck needles and drills stay this long (drill fuse)
const HOMING_CONE_COS = Math.cos(45 * DEG);
const HOMING_RANGE = 40;
const DRILL_RANGE = 20;
const GUIDED_TURN_DEG = 120;
const RETURN_CATCH_DISTANCE = 1;
const COMBO_TARGET_PADDING = 0.3;        // hitscan combo shots get a slightly larger orb to aim at
const BOUNCE_MIN_SPEED = 2;              // slower bouncing projectiles stop bouncing and settle
const HOOK_PULL_SPEED = 20;
const HOOK_LIFT_SPEED = 3;
const INCOMING_RANGE = 25;               // m: an `incoming` row (rocket, missile) this close and closing in warns the local player once (AUD-005)

const PIN_WALL_REACH = 1.5;              // W26: a wall this close behind a stake's victim pins it there
const PIN_HEIGHT = 1;                    // the pin ray starts this high above the victim's feet

const sweepHit = makeHit();
const pinHit = makeHit();
const INCOMING_EVENT = { x: 0, y: 0, z: 0, kind: '', source: -1 };
const BALLISTIC_ROW = CAT.projectiles.byId('bullet');
const projectileScratch = Vec.make();
const homingAim = Vec.make();
const HOMING_RULE = {
  skip(owner, id) { return !Actors.alive[id] || !Actors.isEnemy(owner, id); },
  point(id, out) { Hitbox.point(id, ZONE.BODY, out); },
  accept(owner, id, dx, dy, dz, distance) { return (dx * homingAim.x + dy * homingAim.y + dz * homingAim.z) / distance >= HOMING_CONE_COS; },
};
const steerScratch = Vec.make();
const projectilePose = makeModelPose();   // model projectiles: scale 1, no glow floor
const PROJECTILE_FACING_SPEED = 0.5;      // m/s: slower (stuck, resting) projectiles keep their last facing
const projectileColors = new Float32Array(CAT.projectiles.length * 3);
const projectileInstance = makeShapeInstance();   // the glowing spheres and puddles (Projectiles.draw)
CAT.projectiles.forEach((row, index) => {
  row.index = index;
  projectileColors[index * 3] = (row.color >> 16 & 255) / 255;
  projectileColors[index * 3 + 1] = (row.color >> 8 & 255) / 255;
  projectileColors[index * 3 + 2] = (row.color & 255) / 255;
});

const Projectiles = {
  state: new Uint8Array(PROJECTILE_CAP), type: new Uint8Array(PROJECTILE_CAP), owner: new Int8Array(PROJECTILE_CAP),
  weapon: new Int16Array(PROJECTILE_CAP), modeIndex: new Uint8Array(PROJECTILE_CAP), child: new Uint8Array(PROJECTILE_CAP), lodge: new Uint8Array(PROJECTILE_CAP),
  x: new Float32Array(PROJECTILE_CAP), y: new Float32Array(PROJECTILE_CAP), z: new Float32Array(PROJECTILE_CAP),
  vx: new Float32Array(PROJECTILE_CAP), vy: new Float32Array(PROJECTILE_CAP), vz: new Float32Array(PROJECTILE_CAP),
  age: new Float32Array(PROJECTILE_CAP), life: new Float32Array(PROJECTILE_CAP), travelled: new Float32Array(PROJECTILE_CAP),
  damage: new Float32Array(PROJECTILE_CAP), multiplier: new Float32Array(PROJECTILE_CAP), bounces: new Int8Array(PROJECTILE_CAP),
  target: new Int8Array(PROJECTILE_CAP), attached: new Int8Array(PROJECTILE_CAP), offsetX: new Float32Array(PROJECTILE_CAP),
  offsetY: new Float32Array(PROJECTILE_CAP), offsetZ: new Float32Array(PROJECTILE_CAP), timer: new Float32Array(PROJECTILE_CAP),
  hitLow: new Uint32Array(PROJECTILE_CAP), hitHigh: new Uint32Array(PROJECTILE_CAP), serial: new Uint32Array(PROJECTILE_CAP),
  gravity: new Float32Array(PROJECTILE_CAP), drag: new Float32Array(PROJECTILE_CAP),   // the row's, or X41's for ballistic bullets
  warned: new Uint8Array(PROJECTILE_CAP),  // 1 once 'projectile.incoming' went out for this projectile
  faceYaw: new Float32Array(PROJECTILE_CAP), facePitch: new Float32Array(PROJECTILE_CAP),   // drawn facing: the last flight direction (a stuck one keeps it)
  flightTime: new Float32Array(PROJECTILE_CAP),   // seconds moving: model spin and tumble turn only in flight
  guiding: new Uint8Array(MAX_ACTORS),     // actors steering a guided projectile right now (they stand still)
  bulletHits: [],                          // fn(owner, mode, ox, oy, oz, dx, dy, dz, length): an X41 bullet flew this far unstopped by bodies (S12 devices, X30 ammo)
  active: 0,
  nextSerial: 1,
  comboDistance: 0,

  row(i) { return CAT.projectiles[this.type[i]]; },
  modeOf(i) { const weapon = CAT.weapons[this.weapon[i]]; return this.modeIndex[i] ? weapon.alt : weapon.primary; },
  clear() { this.state.fill(0); this.guiding.fill(0); this.active = 0; },

  // ---- Spawning ----
  // From a weapon: starts at its muzzle (the eye when a wall is in between) and flies to the point under the crosshair, which
  // `direction` (the eye ray) hits; a lobbed projectile (gravity of LOB_MIN_GRAVITY or more) flies the arc through that point, a slightly dropping one keeps the direction. Speed 0 = mode or row speed.
  spawnFromWeapon(owner, weapon, mode, modeIndex, direction, damage, multiplier, speed, target) {
    const row = CAT.projectiles.byId(mode.projectile);
    const launch = speed || mode.speed || row.speed, start = Muzzle.launch(owner, weapon, direction, !row.gravity);
    if (row.gravity >= LOB_MIN_GRAVITY) Muzzle.solveLob(owner, direction, launch, row.gravity);   // P8-04: a lob lands on the crosshair point
    const i = this.spawn(row, owner, weapon.index, modeIndex, start.x, start.y, start.z, start.dx * launch, start.dy * launch, start.dz * launch, damage * multiplier);
    if (mode.life) this.life[i] = mode.life;
    if (mode.bounces > -2) this.bounces[i] = mode.bounces;
    this.multiplier[i] = multiplier;
    this.lodge[i] = mode.special === 'lodgeBlade' ? 1 : 0;
    this.target[i] = target >= 0 ? target : this.acquireTarget(owner, row, direction);
    if (mode.maxActive && mode.activeRule === 'recycle') this.limitOwned(owner, weapon.index, row.index, mode.maxActive);
    return i;
  },
  // X41 Ballistics (rules.fx.ballistics { gravity, drag }): one hitscan pellet as a bullet that keeps its firing mode (damage,
  // falloff by distance flown, headshots) and flies at most the mode's range.
  spawnBallistic(owner, weapon, mode, modeIndex, direction, damage, ballistics) {
    const row = BALLISTIC_ROW, speed = row.speed, start = Muzzle.launch(owner, weapon, direction, true);   // a bullet (320 m/s) drops little: it converges on the crosshair point like a hitscan shot hits it
    const i = this.spawn(row, owner, weapon.index, modeIndex, start.x, start.y, start.z, start.dx * speed, start.dy * speed, start.dz * speed, damage);
    this.life[i] = mode.range / speed;
    this.gravity[i] = ballistics.gravity || 0;
    this.drag[i] = ballistics.drag || 0;
    return i;
  },
  spawn(row, owner, weaponIndex, modeIndex, x, y, z, vx, vy, vz, damage) {
    const i = this.freeSlot(row);
    if (this.state[i] === PROJECTILE_STATE.FREE) this.active++;
    this.state[i] = PROJECTILE_STATE.FLYING; this.type[i] = row.index; this.owner[i] = owner; this.weapon[i] = weaponIndex; this.modeIndex[i] = modeIndex;
    this.x[i] = x; this.y[i] = y; this.z[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.age[i] = 0; this.life[i] = row.life; this.travelled[i] = 0; this.damage[i] = damage; this.multiplier[i] = 1;
    this.bounces[i] = row.bounces; this.target[i] = -1; this.attached[i] = -1; this.timer[i] = 0; this.child[i] = 0; this.lodge[i] = 0;
    this.hitLow[i] = this.hitHigh[i] = 0; this.warned[i] = 0;
    this.gravity[i] = row.gravity; this.drag[i] = row.drag;
    this.faceYaw[i] = 0; this.facePitch[i] = 0; this.flightTime[i] = 0;
    this.faceFlight(i);
    this.serial[i] = this.nextSerial++;
    return i;
  },
  // A free slot; at the row's poolSize or a full pool the oldest projectile (of that row first) is recycled.
  freeSlot(row) {
    let free = -1, oldestOfRow = -1, oldest = 0, ofRow = 0;
    for (let i = 0; i < PROJECTILE_CAP; i++) {
      if (this.state[i] === PROJECTILE_STATE.FREE) { if (free < 0) free = i; continue; }
      if (this.serial[i] < this.serial[oldest] || this.state[oldest] === PROJECTILE_STATE.FREE) oldest = i;
      if (this.type[i] !== row.index) continue;
      ofRow++;
      if (oldestOfRow < 0 || this.serial[i] < this.serial[oldestOfRow]) oldestOfRow = i;
    }
    if (ofRow >= row.poolSize) return oldestOfRow;
    return free >= 0 ? free : oldest;
  },
  remove(i) {
    if (this.state[i] === PROJECTILE_STATE.FREE) return;
    this.state[i] = PROJECTILE_STATE.FREE;
    this.active--;
  },
  // True when projectile i belongs to owner and weapon (and, when typeIndex >= 0, is that projectile row).
  isOwned(i, owner, weaponIndex, typeIndex) {
    if (!this.state[i] || this.owner[i] !== owner || this.weapon[i] !== weaponIndex) return false;
    return typeIndex < 0 || this.type[i] === typeIndex;
  },
  countOwned(owner, weaponIndex, typeIndex = -1) {
    let count = 0;
    for (let i = 0; i < PROJECTILE_CAP; i++) if (this.isOwned(i, owner, weaponIndex, typeIndex)) count++;
    return count;
  },
  // maxActive with activeRule 'recycle' (W32 mines): the oldest extra projectile of that row is detonated (grenades are not counted).
  limitOwned(owner, weaponIndex, typeIndex, limit) {
    while (this.countOwned(owner, weaponIndex, typeIndex) > limit) this.detonate(this.oldestOwned(owner, weaponIndex, typeIndex));
  },
  oldestOwned(owner, weaponIndex, typeIndex) {
    let found = -1;
    for (let i = 0; i < PROJECTILE_CAP; i++) {
      if (!this.isOwned(i, owner, weaponIndex, typeIndex)) continue;
      if (found < 0 || this.serial[i] < this.serial[found]) found = i;
    }
    return found;
  },
  detonateOwned(owner, weaponIndex, projectileKey) {
    const row = CAT.projectiles.byId(projectileKey);
    let count = 0;
    for (let i = 0; i < PROJECTILE_CAP; i++) {
      if (!this.isOwned(i, owner, weaponIndex, row ? row.index : -1)) continue;
      this.detonate(i);
      count++;
    }
    return count;
  },
  // Homing rows pick the nearest visible enemy near the launch direction (drills: within 20 m).
  acquireTarget(owner, row, direction) {
    if (!row.homing) return -1;
    const range = row.onHit === 'drill' ? DRILL_RANGE : HOMING_RANGE;
    Vec.set(homingAim, direction.x, direction.y, direction.z);
    return nearestSeenEnemy(owner, Actors.x[owner], Actors.eyeY(owner), Actors.z[owner], range, HOMING_RULE);
  },

  // ---- The per-step update ----
  step(dt) {
    this.guiding.fill(0);
    for (let i = 0; i < PROJECTILE_CAP; i++) {
      if (this.state[i] === PROJECTILE_STATE.FREE) continue;
      this.age[i] += dt;
      this.stepOne(i, dt);
    }
  },
  stepOne(i, dt) {
    const state = this.state[i];
    if (state === PROJECTILE_STATE.AREA) { this.stepArea(i, dt); return; }
    if (state === PROJECTILE_STATE.ATTACHED) { this.stepAttached(i); return; }
    if (state === PROJECTILE_STATE.STUCK) { this.stepStuck(i, dt); return; }
    if (this.age[i] >= this.life[i]) { this.expire(i); return; }
    this.steer(i, dt);
    this.accelerate(i, dt);
    this.stepAura(i, dt);
    this.sweep(i, dt);
    if (this.faceFlight(i)) this.flightTime[i] += dt;
    if (this.state[i] === PROJECTILE_STATE.FLYING) this.warnIncoming(i);
  },
  // The drawn facing follows the velocity while the projectile moves; true then (a resting or stuck one keeps its facing).
  faceFlight(i) {
    const vx = this.vx[i], vy = this.vy[i], vz = this.vz[i], flat = length2(vx, vz);
    if (flat + Math.abs(vy) <= PROJECTILE_FACING_SPEED) return false;
    this.faceYaw[i] = Math.atan2(vx, vz); this.facePitch[i] = Math.atan2(vy, flat);
    return true;
  },
  // AUD-005 / ACC-002: a rocket or missile of anyone but the local player and allies, within 25 m and closing in:
  // 'projectile.incoming' once (S06 plays the whistle and the "[Rocket incoming]" caption).
  warnIncoming(i) {
    const player = Game.playerId, owner = this.owner[i];
    if (this.warned[i] || player < 0 || !Actors.alive[player] || !this.row(i).incoming) return;
    if (owner === player || (owner >= 0 && !Actors.isEnemy(owner, player))) return;
    const dx = Actors.x[player] - this.x[i], dy = Actors.eyeY(player) - this.y[i], dz = Actors.z[player] - this.z[i];
    if (dx * dx + dy * dy + dz * dz > INCOMING_RANGE * INCOMING_RANGE || dx * this.vx[i] + dy * this.vy[i] + dz * this.vz[i] <= 0) return;
    this.warned[i] = 1;
    INCOMING_EVENT.x = this.x[i]; INCOMING_EVENT.y = this.y[i]; INCOMING_EVENT.z = this.z[i];
    INCOMING_EVENT.kind = this.row(i).id; INCOMING_EVENT.source = owner;
    Bus.emit('projectile.incoming', INCOMING_EVENT);
  },
  accelerate(i, dt) {
    const row = this.row(i);
    if (row.roll && World.raycast(this.x[i], this.y[i], this.z[i], 0, -1, 0, row.radius + 0.05, sweepHit)) { this.vy[i] = Math.max(0, this.vy[i]); return; }
    this.vy[i] -= this.gravity[i] * dt;
    if (!this.drag[i]) return;
    const keep = Math.max(0, 1 - this.drag[i] * dt);
    this.vx[i] *= keep; this.vy[i] *= keep; this.vz[i] *= keep;
  },
  // Homing toward the target, guided toward the owner's view, or flying back to the owner (returning blades).
  steer(i, dt) {
    const row = this.row(i), mode = this.modeOf(i), owner = this.owner[i];
    if (row.returning && this.state[i] === PROJECTILE_STATE.FLYING && this.age[i] >= this.life[i] * 0.5) this.startReturn(i);
    if (this.state[i] === PROJECTILE_STATE.RETURNING) { this.steerReturn(i); return; }
    if (mode.guided && Actors.alive[owner]) { this.guiding[owner] = 1; Vec.fromAngles(steerScratch, Actors.yaw[owner], Actors.pitch[owner]); turnVelocity(i, steerScratch, GUIDED_TURN_DEG * DEG * dt); return; }
    const target = this.target[i];
    if (!row.homing || target < 0 || !Actors.alive[target]) return;
    Hitbox.point(target, row.onHit === 'drill' ? ZONE.HEAD : ZONE.BODY, steerScratch);
    Vec.set(steerScratch, steerScratch.x - this.x[i], steerScratch.y - this.y[i], steerScratch.z - this.z[i]);
    Vec.normalize(steerScratch, steerScratch);
    turnVelocity(i, steerScratch, row.homing * DEG * dt);
  },
  startReturn(i) {
    this.state[i] = PROJECTILE_STATE.RETURNING;
    this.hitLow[i] = this.hitHigh[i] = 0;   // a returning blade cuts everyone again on its way back
    this.life[i] = this.age[i] + this.row(i).life * 2;
  },
  steerReturn(i) {
    const owner = this.owner[i], speed = this.row(i).speed;
    if (!Actors.alive[owner]) { this.remove(i); return; }
    const dx = Actors.x[owner] - this.x[i], dy = Actors.eyeY(owner) - 0.4 - this.y[i], dz = Actors.z[owner] - this.z[i];
    const distance = length3(dx, dy, dz);
    if (distance < RETURN_CATCH_DISTANCE) { this.remove(i); return; }
    this.vx[i] = dx / distance * speed; this.vy[i] = dy / distance * speed; this.vz[i] = dz / distance * speed;
  },

  // Moves along the velocity for one step: world ray first, then actor volumes (inflated by the radius) in front of it.
  sweep(i, dt) {
    if (this.state[i] === PROJECTILE_STATE.FREE) return;
    const speed = length3(this.vx[i], this.vy[i], this.vz[i]);
    if (speed < 1e-6) return;
    const length = speed * dt, dx = this.vx[i] / speed, dy = this.vy[i] / speed, dz = this.vz[i] / speed, row = this.row(i);
    const wallHit = World.raycast(this.x[i], this.y[i], this.z[i], dx, dy, dz, length + row.radius, sweepHit);
    const worldWall = wallHit ? Math.max(0, sweepHit.distance - row.radius) : length;
    const blocker = this.type[i] === BALLISTIC_ROW.index ? Weapons.blockDistance(this.x[i], this.y[i], this.z[i], dx, dy, dz, worldWall) : -1;
    const wall = blocker >= 0 ? blocker : worldWall;
    if (this.sweepActors(i, row, dx, dy, dz, wall)) return;
    if (this.type[i] === BALLISTIC_ROW.index) this.passBullet(i, dx, dy, dz, wall);
    this.x[i] += dx * wall; this.y[i] += dy * wall; this.z[i] += dz * wall;
    this.travelled[i] += wall;
    if (blocker >= 0) { this.stopAtBlocker(i, dx, dy, dz); return; }
    if (wallHit) this.touchWorld(i, row, sweepHit);
  },
  // X41 bullets meet what hitscan meets: devices and domes stop them (Weapons.rayBlockers), bulletHits deal the hit.
  passBullet(i, dx, dy, dz, length) {
    const mode = this.modeOf(i);
    for (let k = 0; k < this.bulletHits.length; k++) this.bulletHits[k](this.owner[i], mode, this.x[i], this.y[i], this.z[i], dx, dy, dz, length);
  },
  stopAtBlocker(i, dx, dy, dz) {
    emitBlockedImpact(this.x[i], this.y[i], this.z[i], dx, dy, dz, this.modeOf(i).weapon, this.owner[i]);
    this.remove(i);
  },
  // Returns true when an actor contact ended or stopped this projectile.
  sweepActors(i, row, dx, dy, dz, wall) {
    // Projectiles never strike their owner directly (they start inside the owner); own splash still applies.
    const limit = row.pierce ? 4 : 1;
    const count = RayHits.collect(this.owner[i], this.x[i], this.y[i], this.z[i], dx, dy, dz, wall, limit, row.radius, currentRules().friendlyFire > 0);
    for (let k = 0; k < count; k++) {
      const target = RayHits.ids[k];
      if (this.alreadyHit(i, target)) continue;
      const distance = RayHits.distances[k];
      const x = this.x[i] + dx * distance, y = this.y[i] + dy * distance, z = this.z[i] + dz * distance;
      if (this.touchActor(i, row, target, RayHits.zones[k], x, y, z, dx, dy, dz)) return true;
    }
    return false;
  },
  alreadyHit(i, target) { return target < 32 ? (this.hitLow[i] >>> target & 1) === 1 : (this.hitHigh[i] >>> (target - 32) & 1) === 1; },
  markHit(i, target) {
    if (target < 32) this.hitLow[i] |= 1 << target;
    else this.hitHigh[i] |= 1 << (target - 32);
  },

  // ---- Contacts ----
  // A plain or pinning projectile fired by a mode with splash (explosive arrow, explosive disc) explodes instead.
  onHitKind(i, row) {
    if ((row.onHit === 'damage' || row.onHit === 'pin') && this.modeOf(i).splash) return 'explode';
    return row.onHit;
  },
  // WPN-011: closer than the arm distance of its row or its fire mode, it cannot explode yet.
  // The mode arm covers the explosive itself only: split shards inherit the mode but never arm.
  unarmed(i, row) {
    const modeArm = this.child[i] || this.onHitKind(i, row) !== 'explode' ? 0 : this.modeOf(i).arm;
    const arm = Math.max(row.arm, modeArm);
    return arm > 0 && this.travelled[i] < arm;
  },
  touchActor(i, row, target, zone, x, y, z, dx, dy, dz) {
    if (row.parryable && WeaponSpecialState.tryParry(target, i)) return true;
    if (this.unarmed(i, row)) { this.dud(i, x, y, z); return true; }
    const kind = this.onHitKind(i, row);
    if (kind === 'explode') { this.explodeAt(i, x, y, z, target, zone); return true; }
    if (kind === 'pull') { this.pullOwner(i, target); return true; }
    if (kind === 'drill') { this.attach(i, target, x, y, z); return true; }
    this.hitTarget(i, target, zone, x, y, z, dx, dy, dz);
    if (kind === 'pin') this.pinToWall(i, target, dx, dy, dz);
    if (kind === 'puddle') { this.becomeArea(i, Actors.x[target], Actors.y[target] + 0.05, Actors.z[target]); return true; }
    if (row.pierce) { this.markHit(i, target); return false; }
    if (row.stickActor) { this.attach(i, target, x, y, z); return true; }
    this.remove(i);
    return true;
  },
  // W26 stake: a survivor with a wall just behind it along the flight is pinned there (the 'pinned' status roots it).
  pinToWall(i, target, dx, dy, dz) {
    if (!World.raycast(Actors.x[target], Actors.y[target] + PIN_HEIGHT, Actors.z[target], dx, dy, dz, PIN_WALL_REACH, pinHit)) return;
    Damage.addStatus(target, 'pinned', this.owner[i]);
  },
  hitTarget(i, target, zone, x, y, z, dx, dy, dz) {
    const mode = this.modeOf(i);
    const info = Damage.info();
    info.amount = this.damage[i]; info.zone = ZONE_NAMES[zone]; info.mode = mode; info.weapon = mode.weapon; info.kind = 'hit';
    info.element = mode.element; info.distance = this.travelled[i]; info.knockback = mode.knockback;
    info.x = x; info.y = y; info.z = z; info.dx = dx; info.dy = dy; info.dz = dz;
    return Damage.apply(this.owner[i], target, info);
  },
  touchWorld(i, row, hit) {
    if (row.roll) { reflectVelocity(i, hit, 0.6); return; }
    if (this.state[i] === PROJECTILE_STATE.RETURNING) return;
    if (this.bounces[i] !== 0 && this.bounceOff(i, row, hit)) return;
    if (this.unarmed(i, row)) { this.dud(i, hit.x, hit.y, hit.z); return; }   // bounces still happen before it arms
    if (row.returning && !this.lodge[i]) { this.startReturn(i); return; }
    if (row.stick || this.lodge[i]) { this.stickTo(i, row, hit); return; }
    if (this.onHitKind(i, row) === 'explode') { this.explodeAt(i, hit.x + hit.nx * 0.1, hit.y + hit.ny * 0.1, hit.z + hit.nz * 0.1, -1, ZONE.NONE); return; }
    emitImpact(hit, this.modeOf(i).weapon, this.owner[i]);
    damagePropAt(hit, this.damage[i], this.owner[i]);
    this.remove(i);
  },
  bounceOff(i, row, hit) {
    reflectVelocity(i, hit, row.bounce || 1);
    if (this.bounces[i] > 0) this.bounces[i]--;
    if (length3(this.vx[i], this.vy[i], this.vz[i]) >= BOUNCE_MIN_SPEED) return true;
    this.vx[i] = this.vy[i] = this.vz[i] = 0;   // settled: grenades wait for their fuse on the floor
    return true;
  },
  stickTo(i, row, hit) {
    this.x[i] = hit.x + hit.nx * row.radius; this.y[i] = hit.y + hit.ny * row.radius; this.z[i] = hit.z + hit.nz * row.radius;
    this.vx[i] = this.vy[i] = this.vz[i] = 0;
    if (this.modeOf(i).puddle) { this.becomeArea(i, this.x[i], this.y[i], this.z[i]); return; }
    this.state[i] = PROJECTILE_STATE.STUCK;
    if (this.lodge[i]) this.life[i] = this.age[i] + 1e6;   // a lodged blade stays until recalled
  },
  attach(i, target, x, y, z) {
    this.state[i] = PROJECTILE_STATE.ATTACHED;
    this.attached[i] = target;
    this.offsetX[i] = x - Actors.x[target]; this.offsetY[i] = y - Actors.y[target]; this.offsetZ[i] = z - Actors.z[target];
    this.life[i] = this.age[i] + ATTACH_SECONDS;
    const combo = this.modeOf(i).stickCombo;
    if (combo) this.checkStickCombo(i, target, combo);
  },
  // W12: enough needles of one owner stuck in one target burst together.
  checkStickCombo(i, target, combo) {
    let stuck = 0;
    for (let k = 0; k < PROJECTILE_CAP; k++) if (this.isStuckSibling(k, i, target)) stuck++;
    if (stuck < combo.count) return;
    for (let k = 0; k < PROJECTILE_CAP; k++) if (this.isStuckSibling(k, i, target)) this.remove(k);
    Hitbox.point(target, ZONE.BODY, projectileScratch);
    const blast = Damage.blast();
    blast.x = projectileScratch.x; blast.y = projectileScratch.y; blast.z = projectileScratch.z; blast.owner = this.owner[i];
    blast.mode = this.modeOf(i); blast.radius = combo.radius; blast.damage = combo.damage;
    Damage.explode(blast);
  },
  isStuckSibling(k, i, target) {
    return this.state[k] === PROJECTILE_STATE.ATTACHED && this.attached[k] === target && this.owner[k] === this.owner[i] && this.type[k] === this.type[i];
  },
  stepAttached(i) {
    const target = this.attached[i];
    if (!Actors.alive[target]) { this.remove(i); return; }
    this.x[i] = Actors.x[target] + this.offsetX[i]; this.y[i] = Actors.y[target] + this.offsetY[i]; this.z[i] = Actors.z[target] + this.offsetZ[i];
    if (this.age[i] < this.life[i]) return;
    if (this.row(i).onHit === 'drill') { this.finishDrill(i); return; }
    this.remove(i);
  },
  // W43: the drill's damage lands when its 2 s are over (or on manual detonation).
  finishDrill(i) {
    const target = this.attached[i];
    this.remove(i);
    if (target < 0 || !Actors.alive[target]) return;
    this.hitTarget(i, target, ZONE.NONE, this.x[i], this.y[i], this.z[i], 0, -1, 0);
  },
  stepStuck(i, dt) {
    if (this.age[i] >= this.life[i]) { this.expire(i); return; }
    const mode = this.modeOf(i);
    if (this.lodge[i] && mode.laser) this.stepLaser(i, mode, dt);
  },
  // W44 lodged blade: a cutting line from the blade to its owner. Walls stop it (R-006): no line while anything solid
  // stands between the blade and the owner.
  stepLaser(i, mode, dt) {
    const owner = this.owner[i];
    if (!Actors.alive[owner] || !this.tickDue(i, dt, mode.laser.interval)) return;
    const eyeY = Actors.eyeY(owner) - 0.3, dx = Actors.x[owner] - this.x[i], dy = eyeY - this.y[i], dz = Actors.z[owner] - this.z[i];
    const length = length3(dx, dy, dz);
    if (length < 0.5 || !World.lineClear(this.x[i], this.y[i], this.z[i], Actors.x[owner], eyeY, Actors.z[owner])) return;
    const count = RayHits.collect(owner, this.x[i], this.y[i], this.z[i], dx / length, dy / length, dz / length, length, 8, 0, false);
    for (let k = 0; k < count; k++) this.areaDamage(i, RayHits.ids[k], mode.laser.damage, mode, 'hit');
    if (!Game.headless) Fx.tracer(this.x[i], this.y[i], this.z[i], Actors.x[owner], eyeY, Actors.z[owner], 0xff4040);
  },
  // Accumulates the area timer; true once per interval.
  tickDue(i, dt, interval) {
    this.timer[i] += dt;
    if (this.timer[i] < interval) return false;
    this.timer[i] -= interval;
    return true;
  },
  areaDamage(i, target, amount, mode, kind) {
    const info = Damage.info();
    info.amount = amount * this.multiplier[i]; info.mode = mode; info.weapon = mode.weapon; info.kind = kind; info.element = mode.element;
    info.x = Actors.x[target]; info.y = Actors.y[target]; info.z = Actors.z[target];
    return Damage.apply(this.owner[i], target, info);
  },
  // W45: arcs from a flying orb to enemies near it.
  stepAura(i, dt) {
    const aura = this.modeOf(i).aura;
    if (!aura || !this.tickDue(i, dt, aura.interval)) return;
    const owner = this.owner[i], radiusSquared = aura.radius * aura.radius;
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id] || !Actors.isEnemy(owner, id)) continue;
      Hitbox.point(id, ZONE.BODY, projectileScratch);
      if (distanceSquared3(this.x[i], this.y[i], this.z[i], projectileScratch.x, projectileScratch.y, projectileScratch.z) > radiusSquared) continue;
      if (!World.lineClear(this.x[i], this.y[i], this.z[i], projectileScratch.x, projectileScratch.y, projectileScratch.z)) continue;
      this.areaDamage(i, id, aura.damage, this.modeOf(i), 'beam');
      if (!Game.headless) Fx.tracer(this.x[i], this.y[i], this.z[i], projectileScratch.x, projectileScratch.y, projectileScratch.z, 0x9cff9c);
    }
  },
  // Puddles (W34 goo, W35 napalm): damage everyone standing in them on each area tick.
  becomeArea(i, x, y, z) {
    const puddle = this.modeOf(i).puddle;
    if (!puddle) { this.remove(i); return; }
    this.state[i] = PROJECTILE_STATE.AREA;
    this.x[i] = x; this.y[i] = y; this.z[i] = z; this.vx[i] = this.vy[i] = this.vz[i] = 0;
    this.life[i] = this.age[i] + puddle.seconds;
    this.timer[i] = 0;
    if (this.modeOf(i).split && !this.child[i]) this.spawnSplit(i, this.modeOf(i), x, y + 0.2, z);
  },
  stepArea(i, dt) {
    if (this.age[i] >= this.life[i]) { this.remove(i); return; }
    const mode = this.modeOf(i), puddle = mode.puddle;
    if (!this.tickDue(i, dt, AREA_TICK_SECONDS)) return;
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id] || Math.abs(Actors.y[id] - this.y[i]) > AREA_HEIGHT) continue;
      if ((Actors.x[id] - this.x[i]) ** 2 + (Actors.z[id] - this.z[i]) ** 2 > puddle.radius * puddle.radius) continue;
      // The status rides on accepted damage only, so friendly fire and spawn protection rules cover it too.
      const dealt = this.areaDamage(i, id, puddle.damage, mode, 'splash');
      if (dealt > 0 && puddle.status) Damage.addStatus(id, puddle.status.id, this.owner[i], puddle.status.seconds, 1);
    }
  },

  // ---- Endings ----
  expire(i) {
    const row = this.row(i);
    if (this.onHitKind(i, row) === 'explode' && !this.unarmed(i, row)) { this.explodeAt(i, this.x[i], this.y[i], this.z[i], -1, ZONE.NONE); return; }
    if (row.onHit === 'puddle') { this.becomeArea(i, this.x[i], this.y[i], this.z[i]); return; }
    this.remove(i);
  },
  detonate(i) {
    if (i < 0 || !this.state[i]) return;
    if (this.state[i] === PROJECTILE_STATE.ATTACHED && this.row(i).onHit === 'drill') { this.finishDrill(i); return; }
    this.explodeAt(i, this.x[i], this.y[i], this.z[i], -1, ZONE.NONE);
  },
  dud(i, x, y, z) {
    if (!Game.headless) Fx.burst('dust', x, y, z, 0, 1, 0, 4, 0x999999);
    this.remove(i);
  },
  // Direct damage to the struck actor, splash around (excluding that actor when the direct hit dealt damage), then shards.
  explodeAt(i, x, y, z, target, zone) {
    const mode = this.modeOf(i), row = this.row(i);
    const direct = target >= 0 && this.damage[i] > 0;
    if (direct) this.hitTarget(i, target, zone, x, y, z, this.vx[i], this.vy[i], this.vz[i]);
    this.remove(i);
    if (mode.splash) {
      const blast = Damage.blast();
      blast.x = x; blast.y = y; blast.z = z; blast.owner = this.owner[i]; blast.mode = mode; blast.radius = mode.splash.r;
      blast.damage = mode.splash.dmg * this.multiplier[i]; blast.exclude = direct ? target : -1; blast.ownerSafe = row.ownerSafe;
      Damage.explode(blast);
    }
    if (mode.split && !this.child[i]) this.spawnSplit(i, mode, x, y, z);
  },
  // Shards or goo that burst out of an impact (W21 alt, W34 alt), spread over a fixed fan (no random draw).
  spawnSplit(i, mode, x, y, z) {
    const split = mode.split, row = CAT.projectiles.byId(split.projectile);
    for (let k = 0; k < split.count; k++) {
      const angle = k / split.count * Math.PI * 2;
      const child = this.spawn(row, this.owner[i], this.weapon[i], this.modeIndex[i], x, y + 0.1, z, Math.cos(angle) * row.speed * 0.5, row.speed * 0.4, Math.sin(angle) * row.speed * 0.5, split.damage);
      this.child[child] = 1;
      this.age[child] = SPLIT_GRACE_SECONDS;
    }
  },
  // W20 hook: pulls the owner toward the struck actor.
  pullOwner(i, target) {
    const owner = this.owner[i];
    this.remove(i);
    const dx = Actors.x[target] - Actors.x[owner], dz = Actors.z[target] - Actors.z[owner], length = length2(dx, dz) || 1;
    emitImpulse(owner, dx / length * HOOK_PULL_SPEED, HOOK_LIFT_SPEED, dz / length * HOOK_PULL_SPEED);
  },
  // Parry (W03): the projectile flies back along the parrying actor's view and now belongs to them.
  reflect(i, newOwner) {
    const speed = length3(this.vx[i], this.vy[i], this.vz[i]);
    Vec.fromAngles(projectileScratch, Actors.yaw[newOwner], Actors.pitch[newOwner]);
    this.vx[i] = projectileScratch.x * speed; this.vy[i] = projectileScratch.y * speed; this.vz[i] = projectileScratch.z * speed;
    this.owner[i] = newOwner;
    this.age[i] = 0;
  },

  // W17 combo: the nearest energy orb a hitscan ray meets before maxDistance (its distance in comboDistance), or -1.
  comboTarget(ox, oy, oz, dx, dy, dz, maxDistance) {
    let best = -1, bestDistance = maxDistance;
    for (let i = 0; i < PROJECTILE_CAP; i++) {
      if (this.state[i] !== PROJECTILE_STATE.FLYING || !this.row(i).comboTarget) continue;
      const distance = raySphere(ox, oy, oz, dx, dy, dz, this.x[i], this.y[i], this.z[i], this.row(i).radius + COMBO_TARGET_PADDING);
      if (distance >= 0 && distance < bestDistance) { best = i; bestDistance = distance; }
    }
    this.comboDistance = bestDistance;
    return best;
  },
  // The shot reached the orb: it goes off as the big combo blast.
  detonateCombo(i, shooter, mode) {
    const blast = Damage.blast();
    blast.x = this.x[i]; blast.y = this.y[i]; blast.z = this.z[i]; blast.owner = shooter; blast.mode = mode;
    blast.radius = mode.combo.radius; blast.damage = mode.combo.damage;
    this.remove(i);
    Weapons.spendExtra(shooter, mode, mode.combo.ammo - mode.ammoPerShot);
    Damage.explode(blast);
  },

  // Render source: a projectile with a model (03q projectileModels) faces its flight, the rest are glowing spheres; puddles are flat discs.
  draw(batch) {
    for (let i = 0; i < PROJECTILE_CAP; i++) {
      if (!this.state[i]) continue;
      const row = this.row(i), type = this.type[i], model = WeaponModels.projectile[type];
      if (model && this.state[i] !== PROJECTILE_STATE.AREA) { this.drawModel(batch, i, model); continue; }
      // one reused instance record (batch.meshFrom): float arguments would be boxed (PERF-006)
      const instance = projectileInstance, area = this.state[i] === PROJECTILE_STATE.AREA;
      const size = area ? this.modeOf(i).puddle.radius * 2 : Math.max(0.08, row.radius * 2 * row.scale);
      instance.x = this.x[i]; instance.y = this.y[i]; instance.z = this.z[i];
      instance.sx = instance.sz = size; instance.sy = area ? 0.04 : size; instance.emissive = area ? 0.6 : 1;
      instance.r = projectileColors[type * 3]; instance.g = projectileColors[type * 3 + 1]; instance.b = projectileColors[type * 3 + 2];
      batch.meshFrom(area ? 'cylinder' : 'sphere', instance);
    }
  },
  drawModel(batch, i, model) {
    const pose = projectilePose, flight = this.flightTime[i];
    pose.x = this.x[i]; pose.y = this.y[i]; pose.z = this.z[i];
    pose.yaw = this.faceYaw[i] + flight * model.spin; pose.pitch = this.facePitch[i] + flight * model.tumble;
    Models.paint(pose, model);
    Models.draw(batch, model, pose);
  },
};

// Rotates a projectile's velocity toward a unit direction by at most maxAngle radians, keeping its speed.
function turnVelocity(i, direction, maxAngle) {
  const speed = length3(Projectiles.vx[i], Projectiles.vy[i], Projectiles.vz[i]);
  if (speed < 1e-6) return;
  const fx = Projectiles.vx[i] / speed, fy = Projectiles.vy[i] / speed, fz = Projectiles.vz[i] / speed;
  const angle = Math.acos(clamp(fx * direction.x + fy * direction.y + fz * direction.z, -1, 1));
  const t = angle <= maxAngle ? 1 : maxAngle / angle;
  const nx = lerp(fx, direction.x, t), ny = lerp(fy, direction.y, t), nz = lerp(fz, direction.z, t), length = length3(nx, ny, nz) || 1;
  Projectiles.vx[i] = nx / length * speed; Projectiles.vy[i] = ny / length * speed; Projectiles.vz[i] = nz / length * speed;
}
function reflectVelocity(i, hit, keep) {
  const along = Projectiles.vx[i] * hit.nx + Projectiles.vy[i] * hit.ny + Projectiles.vz[i] * hit.nz;
  Projectiles.vx[i] = (Projectiles.vx[i] - 2 * along * hit.nx) * keep;
  Projectiles.vy[i] = (Projectiles.vy[i] - 2 * along * hit.ny) * keep;
  Projectiles.vz[i] = (Projectiles.vz[i] - 2 * along * hit.nz) * keep;
}

Weapons.spendExtra = (id, mode, rounds) => {
  const weapon = CAT.weapons.byId(mode.weapon);
  if (!weapon || rounds <= 0) return;
  const slot = Weapons.slotIndex(id, weapon.index);
  Weapons.magazine[slot] = Math.max(0, Weapons.magazine[slot] - rounds);
};

Sim.addSystem('projectiles', 50, (dt) => Projectiles.step(dt));
Render.addSource('projectiles', (batch) => Projectiles.draw(batch));
Bus.on('match.start', () => Projectiles.clear());
Bus.on('match.stop', () => Projectiles.clear());
