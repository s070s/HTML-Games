// S11 special weapon behaviours: block and parry (W03), stance resist (W28), ally link (W30), chain arcs (W37),
// lodged blade recall (W44), guided warhead stand-still (W46), the Graviton Lifter (W41) and the Twin-Gate Projector (W42).
// Twin gates teleport (momentum magnitude kept, MOV-019) but draw as rings: there is no view through a gate.

const LINK_BOOST_SECONDS = 0.25;         // W30: an ally beam keeps the boost alive this long after the last tick
const PARRY_ARC_COS = Math.cos(70 * DEG);
const STANCE_FRONT_COS = Math.cos(60 * DEG);
const CHAIN_MAX = 8;
const LIFTER_PUSH_SPEED = 15;
const LIFTER_PULL_SPEED = 10;
const LIFTER_THROW_SPEED = 30;           // caught projectiles leave at this speed
const LIFTER_HOLD_DISTANCE = 1.6;
const LIFTER_CATCH_COS = Math.cos(30 * DEG);
const LIFTER_MAX_MASS = 150;             // kg a prop may weigh to be held (W41)
const LIFTER_DAMAGE_PER_MASS_SPEED = 0.5; // punted prop damage = 0.5 x mass x speed, capped (applied by the prop owner on impact)
const LIFTER_DAMAGE_CAP = 150;
const GATE_RADIUS = 0.9;
const GATE_DEPTH = 0.6;                  // an actor's middle this close in front of a gate enters it
const GATE_EXIT_OFFSET = 0.8;
const GATE_COOLDOWN = 0.3;               // seconds before the same actor can enter a gate again (no ping-pong)
const GATE_MIN_EXIT_SPEED = 2;
const GATE_FLAT_NY = 0.7;                // |normal.y| above this: a floor or ceiling gate
const GATE_CLEARANCE = 0.02;             // gap between the exiting capsule and the gate's surface
const ACTOR_MIDDLE = 0.9;
const GATE_COLORS = [0xffa040, 0x40a0ff];

const specialScratch = Vec.make();
const specialHit = makeHit();

const WeaponSpecialState = {
  blockPool: new Float32Array(MAX_ACTORS).fill(Infinity), blocking: new Uint8Array(MAX_ACTORS), parryUntil: new Float32Array(MAX_ACTORS),
  linkUntil: new Float32Array(MAX_ACTORS), linkFactor: new Float32Array(MAX_ACTORS).fill(1),
  heldProjectile: new Int16Array(MAX_ACTORS).fill(-1), heldProp: new Int32Array(MAX_ACTORS).fill(-1),
  gateOpen: new Uint8Array(MAX_ACTORS * 2), gateCooldown: new Float32Array(MAX_ACTORS),
  gateX: new Float32Array(MAX_ACTORS * 2), gateY: new Float32Array(MAX_ACTORS * 2), gateZ: new Float32Array(MAX_ACTORS * 2),
  gateNx: new Float32Array(MAX_ACTORS * 2), gateNy: new Float32Array(MAX_ACTORS * 2), gateNz: new Float32Array(MAX_ACTORS * 2),
  // Physics props are provided by a later section: { grab(id, ox, oy, oz, dx, dy, dz, range, maxMass) -> handle | -1,
  // hold(handle, x, y, z), launch(handle, vx, vy, vz, damagePerMassSpeed, damageCap) }.
  propHook: null,

  reset(id) {
    this.blockPool[id] = Infinity; this.blocking[id] = 0; this.parryUntil[id] = 0; this.linkUntil[id] = 0;
    this.heldProjectile[id] = -1; this.heldProp[id] = -1; this.gateOpen[id * 2] = this.gateOpen[id * 2 + 1] = 0; this.gateCooldown[id] = 0;
  },
  speedFactor(id) { return Projectiles.guiding[id] ? 0 : 1; },

  // ---- W03 block (frontal pool) and parry (tap window reflects parryable projectiles) ----
  stepBlock(id, mode, held, dt) {
    const block = mode.block;
    this.blockPool[id] = Math.min(this.blockPool[id], block.pool);
    if (Actors.pressed[id] & BTN.ALT) this.parryUntil[id] = Sim.time + block.parryWindow;
    this.blocking[id] = held && this.blockPool[id] > 0 ? 1 : 0;
    if (!held) this.blockPool[id] = Math.min(block.pool, this.blockPool[id] + block.regen * dt);
  },
  // Swaps, deaths and respawns drop the guard (Weapons.resetFiring calls this).
  stopBlock(id) { this.blocking[id] = 0; this.parryUntil[id] = 0; },
  // Block and parry only count while a block weapon is drawn and idle; the block also needs ALT still held.
  blockDrawn(id) {
    const weapon = Weapons.currentWeapon(id);
    return Actors.alive[id] === 1 && !!weapon && weapon.alt.type === 'block' && Weapons.state[id] === WEAPON_STATE.IDLE;
  },
  isGuarding(id) { return this.blockDrawn(id) && (Actors.buttons[id] & BTN.ALT) !== 0; },
  blockReducer(source, target, amount, info) {
    if (!this.blocking[target] || !this.isGuarding(target) || !comesFromFront(target, info.dx, info.dz, PARRY_ARC_COS)) return amount;
    const absorbed = Math.min(this.blockPool[target], amount);
    this.blockPool[target] -= absorbed;
    return amount - absorbed;
  },
  tryParry(target, projectile) {
    if (Sim.time > this.parryUntil[target] || !this.blockDrawn(target)) return false;
    if (!comesFromFront(target, Projectiles.vx[projectile], Projectiles.vz[projectile], PARRY_ARC_COS)) return false;
    Projectiles.reflect(projectile, target);
    return true;
  },
  // W28 rooted stance: frontal damage resist while toggled.
  stanceReducer(source, target, amount, info) {
    const weapon = Weapons.currentWeapon(target);
    if (!weapon || !Weapons.toggled[target] || !weapon.alt.toggle || !weapon.alt.toggle.frontResist) return amount;
    if (!comesFromFront(target, info.dx, info.dz, STANCE_FRONT_COS)) return amount;
    return amount * (1 - weapon.alt.toggle.frontResist);
  },

  // ---- W30 ally link: an ally hit by the link beam deals more damage for a moment ----
  link(ally, mode) {
    this.linkUntil[ally] = Sim.time + LINK_BOOST_SECONDS;
    this.linkFactor[ally] = mode.allyLink;
  },
  linkScale(source) { return source >= 0 && Sim.time < this.linkUntil[source] ? this.linkFactor[source] : 1; },

  // ---- W37 chain arc: jumps from the first target to the nearest unhit enemies within the radius ----
  chain(shooter, first, mode, damage) {
    let from = first, chainedLow = first < 32 ? 1 << first : 0, chainedHigh = first >= 32 ? 1 << (first - 32) : 0;
    for (let jump = 0; jump < Math.min(CHAIN_MAX, mode.chain.targets); jump++) {
      const next = nearestChainTarget(shooter, from, mode.chain.radius, chainedLow, chainedHigh);
      if (next < 0) return;
      if (next < 32) chainedLow |= 1 << next; else chainedHigh |= 1 << (next - 32);
      Hitbox.point(next, ZONE.BODY, specialScratch);
      applyShotDamage(shooter, next, CAT.weapons.byId(mode.weapon), mode, damage, ZONE.NONE, 0, specialScratch.x, specialScratch.y, specialScratch.z, 0, 0, 0, 0);
      if (!Game.headless) Fx.tracer(Actors.x[from], Actors.y[from] + 1.1, Actors.z[from], specialScratch.x, specialScratch.y, specialScratch.z, 0xfff27a);
      from = next;
    }
  },

  // ---- W41 Graviton Lifter: punt (primary) and pull/hold (alt); catches projectiles, pulls and pushes actors ----
  lifterPunt(id, weapon, mode) {
    Vec.fromAngles(specialScratch, Actors.yaw[id], Actors.pitch[id]);
    if (this.throwHeld(id)) return;
    const target = actorInFront(id, mode.range);
    if (target >= 0) emitImpulse(target, specialScratch.x * LIFTER_PUSH_SPEED, specialScratch.y * LIFTER_PUSH_SPEED + 3, specialScratch.z * LIFTER_PUSH_SPEED);
  },
  throwHeld(id) {
    const projectile = this.heldProjectile[id], prop = this.heldProp[id];
    this.heldProjectile[id] = -1; this.heldProp[id] = -1;
    if (projectile >= 0 && Projectiles.state[projectile]) {
      Projectiles.owner[projectile] = id;
      Projectiles.vx[projectile] = specialScratch.x * LIFTER_THROW_SPEED; Projectiles.vy[projectile] = specialScratch.y * LIFTER_THROW_SPEED; Projectiles.vz[projectile] = specialScratch.z * LIFTER_THROW_SPEED;
      return true;
    }
    if (prop < 0 || !this.propHook) return false;
    this.propHook.launch(prop, specialScratch.x * LIFTER_THROW_SPEED, specialScratch.y * LIFTER_THROW_SPEED, specialScratch.z * LIFTER_THROW_SPEED, LIFTER_DAMAGE_PER_MASS_SPEED, LIFTER_DAMAGE_CAP);
    return true;
  },
  lifterPull(id, weapon, mode) {
    if (this.heldProjectile[id] >= 0 || this.heldProp[id] >= 0) return;
    Vec.fromAngles(specialScratch, Actors.yaw[id], Actors.pitch[id]);
    this.heldProjectile[id] = catchableProjectile(id, mode.range);
    if (this.heldProjectile[id] >= 0) return;
    if (this.propHook) this.heldProp[id] = this.propHook.grab(id, Actors.x[id], Actors.eyeY(id), Actors.z[id], specialScratch.x, specialScratch.y, specialScratch.z, mode.range, LIFTER_MAX_MASS);
    if (this.heldProp[id] >= 0) return;
    const target = actorInFront(id, mode.range);
    if (target >= 0) emitImpulse(target, -specialScratch.x * LIFTER_PULL_SPEED, 1, -specialScratch.z * LIFTER_PULL_SPEED);
  },
  // Keeps held objects in front of the holder while the alt button is held; letting go drops them.
  stepHeld(id) {
    if (this.heldProjectile[id] < 0 && this.heldProp[id] < 0) return;
    const holding = (Actors.buttons[id] & BTN.ALT) && Actors.alive[id] && Weapons.currentWeapon(id) === CAT.weapons.byId('lifter');
    if (!holding) { this.heldProjectile[id] = -1; this.heldProp[id] = -1; return; }
    Vec.fromAngles(specialScratch, Actors.yaw[id], Actors.pitch[id]);
    const x = Actors.x[id] + specialScratch.x * LIFTER_HOLD_DISTANCE, y = Actors.eyeY(id) + specialScratch.y * LIFTER_HOLD_DISTANCE, z = Actors.z[id] + specialScratch.z * LIFTER_HOLD_DISTANCE;
    const projectile = this.heldProjectile[id];
    if (this.heldProp[id] >= 0 && this.propHook) this.propHook.hold(this.heldProp[id], x, y, z);
    if (projectile < 0 || !Projectiles.state[projectile]) return;
    Projectiles.x[projectile] = x; Projectiles.y[projectile] = y; Projectiles.z[projectile] = z;
    Projectiles.vx[projectile] = Projectiles.vy[projectile] = Projectiles.vz[projectile] = 0;
  },

  // ---- W42 Twin-Gate Projector ----
  placeGate(id, mode, gate) {
    Vec.fromAngles(specialScratch, Actors.yaw[id], Actors.pitch[id]);
    if (!World.raycast(Actors.x[id], Actors.eyeY(id), Actors.z[id], specialScratch.x, specialScratch.y, specialScratch.z, mode.range, specialHit)) return;
    const slot = id * 2 + gate;
    this.gateX[slot] = specialHit.x + specialHit.nx * 0.05; this.gateY[slot] = specialHit.y + specialHit.ny * 0.05; this.gateZ[slot] = specialHit.z + specialHit.nz * 0.05;
    this.gateNx[slot] = specialHit.nx; this.gateNy[slot] = specialHit.ny; this.gateNz[slot] = specialHit.nz;
    this.gateOpen[slot] = 1;
  },
  stepGates(dt) {
    for (let id = 0; id < Actors.count; id++) this.gateCooldown[id] = Math.max(0, this.gateCooldown[id] - dt);
    for (let owner = 0; owner < Actors.count; owner++) {
      if (!this.gateOpen[owner * 2] || !this.gateOpen[owner * 2 + 1]) continue;
      for (let id = 0; id < Actors.count; id++) if (Actors.alive[id] && this.gateCooldown[id] === 0) this.tryGates(owner, id);
    }
  },
  tryGates(owner, id) {
    for (let gate = 0; gate < 2; gate++) {
      if (!insideGate(owner * 2 + gate, id)) continue;
      this.teleport(id, owner * 2 + (1 - gate));
      return;
    }
  },
  // Moves the actor out of the exit gate along its normal, keeping the speed magnitude (MOV-019).
  teleport(id, exit) {
    const speed = Math.max(GATE_MIN_EXIT_SPEED, Math.hypot(Actors.vx[id], Actors.vy[id], Actors.vz[id]));
    const nx = this.gateNx[exit], ny = this.gateNy[exit], nz = this.gateNz[exit];
    const lateral = Math.abs(ny) > GATE_FLAT_NY ? 0 : GATE_EXIT_OFFSET;
    Actors.x[id] = Actors.prevX[id] = this.gateX[exit] + nx * lateral;
    Actors.y[id] = Actors.prevY[id] = this.exitFeetY(exit, id);
    Actors.z[id] = Actors.prevZ[id] = this.gateZ[exit] + nz * lateral;
    Actors.vx[id] = nx * speed; Actors.vy[id] = ny * speed; Actors.vz[id] = nz * speed;
    this.gateCooldown[id] = GATE_COOLDOWN;
  },
  // Floor gates put the feet just above the floor, ceiling gates the head just below the ceiling, wall gates the middle on the gate.
  exitFeetY(exit, id) {
    const gateY = this.gateY[exit], ny = this.gateNy[exit];
    if (ny > GATE_FLAT_NY) return gateY + GATE_CLEARANCE;
    if (ny < -GATE_FLAT_NY) return gateY - Actors.height[id] - GATE_CLEARANCE;
    return gateY - Actors.height[id] * 0.5;
  },
  step(dt) {
    for (let id = 0; id < Actors.count; id++) this.stepHeld(id);
    this.stepGates(dt);
  },
  drawGates(batch) {
    for (let slot = 0; slot < Actors.count * 2; slot++) {
      if (!this.gateOpen[slot]) continue;
      const color = GATE_COLORS[slot % 2], yaw = Math.atan2(this.gateNx[slot], this.gateNz[slot]), pitch = Math.asin(clamp(this.gateNy[slot], -1, 1));
      batch.mesh('ring', this.gateX[slot], this.gateY[slot], this.gateZ[slot], yaw, pitch, GATE_RADIUS * 2, GATE_RADIUS * 2, 0.1, (color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255, 1);
    }
  },
};

// True when a push along (dx, dz) hits the target's front (within the arc whose cosine is given).
function comesFromFront(target, dx, dz, arcCos) {
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return false;
  return -(dx * Math.sin(Actors.yaw[target]) + dz * Math.cos(Actors.yaw[target])) / length >= arcCos;
}
function nearestChainTarget(shooter, from, radius, chainedLow, chainedHigh) {
  let best = -1, bestDistance = radius * radius;
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id] || !Actors.isEnemy(shooter, id) || (id < 32 ? chainedLow >>> id & 1 : chainedHigh >>> (id - 32) & 1)) continue;
    const distance = distanceSquared3(Actors.x[from], Actors.y[from], Actors.z[from], Actors.x[id], Actors.y[id], Actors.z[id]);
    if (distance >= bestDistance || !World.lineClear(Actors.x[from], Actors.y[from] + 1.1, Actors.z[from], Actors.x[id], Actors.y[id] + 1.1, Actors.z[id])) continue;
    best = id; bestDistance = distance;
  }
  return best;
}
function actorInFront(id, range) {
  const eyeY = Actors.eyeY(id);
  const wall = World.raycast(Actors.x[id], eyeY, Actors.z[id], specialScratch.x, specialScratch.y, specialScratch.z, range, specialHit) ? specialHit.distance : range;
  return RayHits.collect(id, Actors.x[id], eyeY, Actors.z[id], specialScratch.x, specialScratch.y, specialScratch.z, wall, 1, 0.4, true) ? RayHits.ids[0] : -1;
}
// Nearest flying projectile in front of the holder (W41 catches grenades, rockets, orbs).
function catchableProjectile(id, range) {
  let best = -1, bestDistance = range;
  const eyeY = Actors.eyeY(id);
  for (let i = 0; i < PROJECTILE_CAP; i++) {
    if (Projectiles.state[i] !== PROJECTILE_STATE.FLYING) continue;
    const dx = Projectiles.x[i] - Actors.x[id], dy = Projectiles.y[i] - eyeY, dz = Projectiles.z[i] - Actors.z[id], distance = Math.hypot(dx, dy, dz);
    if (distance >= bestDistance || (dx * specialScratch.x + dy * specialScratch.y + dz * specialScratch.z) / (distance || 1) < LIFTER_CATCH_COS) continue;
    best = i; bestDistance = distance;
  }
  return best;
}
function insideGate(slot, id) {
  const state = WeaponSpecialState;
  const px = Actors.x[id] - state.gateX[slot], py = Actors.y[id] + ACTOR_MIDDLE - state.gateY[slot], pz = Actors.z[id] - state.gateZ[slot];
  const depth = px * state.gateNx[slot] + py * state.gateNy[slot] + pz * state.gateNz[slot];
  if (depth < -0.2 || depth > GATE_DEPTH) return false;
  const lateralSquared = px * px + py * py + pz * pz - depth * depth;
  return lateralSquared <= GATE_RADIUS * GATE_RADIUS;
}

// W44 alt: with a blade lodged in a wall, the alt button recalls it; while any blade is out, nothing new is thrown.
Weapons.specials.lodgeBlade = (id, weapon) => {
  for (let i = 0; i < PROJECTILE_CAP; i++) {
    if (!Projectiles.state[i] || Projectiles.owner[i] !== id || Projectiles.weapon[i] !== weapon.index) continue;
    if (Projectiles.state[i] === PROJECTILE_STATE.STUCK) Projectiles.startReturn(i);
    return true;
  }
  return false;
};
Weapons.tools.lifterPunt = (id, weapon, mode) => WeaponSpecialState.lifterPunt(id, weapon, mode);
Weapons.tools.lifterPull = (id, weapon, mode) => WeaponSpecialState.lifterPull(id, weapon, mode);
Weapons.tools.gateDawn = (id, weapon, mode) => WeaponSpecialState.placeGate(id, mode, 0);
Weapons.tools.gateDusk = (id, weapon, mode) => WeaponSpecialState.placeGate(id, mode, 1);

Damage.addAttackerScale((source) => WeaponSpecialState.linkScale(source));
Damage.addReducer((source, target, amount, info) => WeaponSpecialState.blockReducer(source, target, amount, info));
Damage.addReducer((source, target, amount, info) => WeaponSpecialState.stanceReducer(source, target, amount, info));
Sim.addSystem('weaponSpecials', 45, (dt) => WeaponSpecialState.step(dt));
Render.addSource('gates', (batch) => WeaponSpecialState.drawGates(batch));
Bus.on('actor.create', (id) => WeaponSpecialState.reset(id));
Bus.on('actor.spawn', (event) => WeaponSpecialState.reset(event.id));
Bus.on('kill', (event) => WeaponSpecialState.stopBlock(event.victim));
