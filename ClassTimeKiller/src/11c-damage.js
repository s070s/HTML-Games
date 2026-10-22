// S11 damage: Damage.apply is the ONE path every damage takes (HP-001..HP-004, ARC-015, ARC-032).
// Order: friendly fire / self scale -> attacker multipliers -> hit zone x precision -> falloff -> shatter -> victim reductions
// -> surplus shield -> shield (element factor) -> armor -> health -> minimum 1 -> downed / death. Also: health presets HPP01..HPP09,
// regeneration, status effects (HP-005), elements (HP-006), downed state (HP-007), splash (Damage.explode) and kill/assist events.

const ASSIST_SECONDS = 5;                // the most recent other damager inside this window gets the assist
const MIN_HIT_DAMAGE = 1;                // HP-003: a hit that passes deals at least 1
const GIB_HEALTH = -40;
const DOWNED_HEALTH = 100;               // HP-007: finished after 100 more damage while downed
const DOWNED_BLEED_SECONDS = 30;
const DOWNED_SPEED = 0.2;                // crawl 1.2 m/s against the 6.4 m/s reference run speed
const REVIVE_HEALTH = 30;
const KNOCKBACK_PER_DAMAGE = 0.15;       // MOV-017
const KNOCKBACK_LIFT = 0.25;             // knockback pushes slightly upward so grounded targets leave the floor
const SPLASH_MIN_FACTOR = 0.2;
const SPLASH_TARGET_LIFT = 0.3;          // splash measures to the actor's body, at least this far above the feet
const SPLASH_CENTRE_DISTANCE = 0.05;
const TICK_EPSILON = 1e-4;               // float32 timers: a tick due within this much counts as due
const LIMB_COUNT = 6;                    // HPP09 pools: head, torso, left arm, right arm, left leg, right leg
const LIMB = { HEAD: 0, TORSO: 1, ARM_LEFT: 2, ARM_RIGHT: 3, LEG_LEFT: 4, LEG_RIGHT: 5 };
const LIMB_POOL = 100;
const LIMB_ARM_OFFSET = 0.18;            // torso hits this far to the side land on an arm
const LIMB_STEPS = [0.67, 0.34, 0];      // pool fractions: below each step the next penalty applies
const LIMB_LEG_SPEED = [1, 0.9, 0.75, DOWNED_SPEED];
const LIMB_ARM_SPREAD = [0, 0.1, 0.2, 0.5];
const STATUS_COUNT = CAT.statusEffects.length;
const INFO_RING = 16;                    // damage infos in flight at once (listeners may apply damage while one is processed)
CAT.statusEffects.forEach((row, index) => { row.index = index; });

function makeDamageInfo() {
  return { amount: 0, zone: 'none', stomach: false, mode: null, weapon: '', kind: 'hit', element: 'kinetic', distance: 0, knockback: 1,
    bypassArmor: false, bypassShield: false, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
}
function makeBlast() { return { x: 0, y: 0, z: 0, owner: -1, mode: null, radius: 0, damage: 0, exclude: -1, ownerSafe: false, weapon: '', element: '' }; }

const DAMAGE_EVENT = { target: 0, source: -1, amount: 0, absorbed: 0, zone: 'none', weapon: '', element: 'kinetic', kind: 'hit',
  shieldDamage: 0, armorDamage: 0, healthDamage: 0, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
const KILL_EVENT = { victim: 0, killer: -1, assister: -1, weapon: '', zone: 'none', element: 'kinetic', x: 0, y: 0, z: 0 };
const EXPLOSION_EVENT = { x: 0, y: 0, z: 0, radius: 0, owner: -1, source: '', element: 'kinetic' };
const LAYERS = { surplus: 0, shield: 0, armor: 0, health: 0 };
const splashPoint = Vec.make();

const Damage = {
  applyCount: 0,                                    // self-test: every damage passes here (count check)
  lastDamageTime: new Float32Array(MAX_ACTORS).fill(-1e9),
  lastAttacker: new Int8Array(MAX_ACTORS).fill(-1), lastAttackTime: new Float32Array(MAX_ACTORS),
  previousAttacker: new Int8Array(MAX_ACTORS).fill(-1), previousAttackTime: new Float32Array(MAX_ACTORS),
  surplus: new Float32Array(MAX_ACTORS),            // surplus shield, filled by powerups (S12); spent before the shield
  shieldElement: new Uint8Array(MAX_ACTORS),        // PvE coloured shield: CAT.elements index + 1 (0 = plain)
  helmet: new Uint8Array(MAX_ACTORS),               // HPP04: armor also protects the head
  downedTime: new Float32Array(MAX_ACTORS), downedBy: new Int8Array(MAX_ACTORS).fill(-1),
  limbs: new Float32Array(MAX_ACTORS * LIMB_COUNT),
  statusTime: new Float32Array(MAX_ACTORS * STATUS_COUNT), statusStacks: new Uint8Array(MAX_ACTORS * STATUS_COUNT),
  statusTick: new Float32Array(MAX_ACTORS * STATUS_COUNT), statusSource: new Int8Array(MAX_ACTORS * STATUS_COUNT).fill(-1),
  stunSet: new Uint8Array(MAX_ACTORS),              // FROZEN was set by a status (so only then is it cleared here)
  frozenTick: new Int32Array(MAX_ACTORS).fill(-1),  // Sim.tick of the last freeze (no shatter within that same step)
  attackerScales: [],                               // fn(source, target, info) -> factor (powerups, handicap, perks, difficulty)
  reducers: [],                                     // fn(source, target, amount, info) -> amount (block, bulwark, sliders)
  poolOverride: null,                               // fn(id, out {health, armor, shield}) for per-hero pools (S12)
  roleOf: null,                                     // fn(id) -> role for HPP05 role regen (S12: the hero's role)
  infos: makePool(INFO_RING, makeDamageInfo),
  blasts: makePool(4, makeBlast),

  info() { return Object.assign(this.infos.take(), DEFAULT_DAMAGE_INFO); },
  blast() { return Object.assign(this.blasts.take(), DEFAULT_BLAST); },
  addAttackerScale(scale) { this.attackerScales.push(scale); },
  addReducer(reducer) { this.reducers.push(reducer); },
  preset() { return CAT.health.byId(currentRules().health) || CAT.health.byId('stack'); },

  // ---- The single damage path ----
  apply(source, target, info) {
    this.applyCount++;
    if (!this.canBeDamaged(target, info)) return 0;
    const rules = currentRules(), kind = CAT.damageKinds.byId(info.kind) || CAT.damageKinds[0];
    const attackerScale = this.attackerScale(source, target, info);
    if (source === target) this.knockback(target, info.amount * attackerScale, info, rules);
    const relation = this.relationScale(source, target, kind, rules);
    if (relation <= 0) return 0;
    let amount = info.amount * attackerScale * relation;
    if (amount <= 0) { this.applyHitStatus(source, target, info); return 0; }
    // HP-001: zone x precision first; HPP03 applies the head multiplier only to what reaches health (see takeLayers).
    const zoneFactor = zoneMultiplier(rules, info), lateZone = this.preset().shieldIgnoresZone ? zoneFactor : 1;
    amount *= falloffFactor(info) * zoneFactor / lateZone;
    amount = this.shatter(target, amount, kind);
    if (info.mode && info.mode.fodderKill && isFodder(target)) amount = Actors.health[target] + Actors.armor[target] + Actors.shield[target] + 1;
    amount = this.reduce(source, target, amount, info);
    if (amount <= 0) return 0;
    const dealt = kind.lethal ? this.takeEverything(target) : this.takeLayers(target, amount, lateZone, kind, info);
    this.afterDamage(source, target, info, kind, dealt, rules, attackerScale);
    return dealt;
  },
  canBeDamaged(target, info) {
    if (target < 0 || !Actors.alive[target]) return false;
    const flags = Actors.flags[target];
    if (flags & ACTOR_FLAG.GOD) return false;
    return !(flags & ACTOR_FLAG.PROTECTED) || info.kind === 'telefrag' || info.kind === 'crush';
  },
  // HP-003: own splash x selfDamage, team damage x friendlyFire.
  relationScale(source, target, kind, rules) {
    if (source === target) return kind.selfScale ? rules.selfDamage : 1;
    if (source >= 0 && kind.friendly && !Actors.isEnemy(source, target)) return rules.friendlyFire;
    return 1;
  },
  attackerScale(source, target, info) {
    let scale = 1;
    for (let i = 0; i < this.attackerScales.length; i++) scale *= this.attackerScales[i](source, target, info);
    return scale;
  },
  reduce(source, target, amount, info) {
    for (let i = 0; i < this.reducers.length; i++) amount = this.reducers[i](source, target, amount, info);
    return amount;
  },
  // HP-005: a frozen target takes x3 from the next hit and fodder shatters outright. Hits in the step that froze the
  // target (the other pellets of the W22 freeze blast) do not count: the shatter needs a follow-up hit.
  shatter(target, amount, kind) {
    const freeze = CAT.statusEffects.byId('freeze'), slot = target * STATUS_COUNT + freeze.index;
    if (kind.id === 'dot' || this.statusTime[slot] <= 0 || this.frozenTick[target] === Sim.tick) return amount;
    this.clearStatus(target, freeze.index);
    return isFodder(target) ? Actors.health[target] + Actors.armor[target] + Actors.shield[target] + 1 : amount * freeze.shatter;
  },
  takeEverything(target) {
    LAYERS.surplus = this.surplus[target]; LAYERS.shield = Actors.shield[target]; LAYERS.armor = Actors.armor[target];
    LAYERS.health = Math.max(0, Actors.health[target]);
    this.surplus[target] = 0; Actors.shield[target] = 0; Actors.armor[target] = 0; Actors.health[target] = 0;
    return LAYERS.surplus + LAYERS.shield + LAYERS.armor + LAYERS.health;
  },
  // Surplus shield -> shield -> armor -> health. lateZone is the zone multiplier still to apply after the shields (HPP03), else 1.
  takeLayers(target, amount, lateZone, kind, info) {
    const preset = this.preset();
    LAYERS.surplus = LAYERS.shield = LAYERS.armor = LAYERS.health = 0;
    if (Actors.flags[target] & ACTOR_FLAG.DOWNED) return this.takeHealth(target, Math.max(MIN_HIT_DAMAGE, amount * lateZone));
    let remaining = Math.max(MIN_HIT_DAMAGE, amount);
    if (!kind.bypassShield && !info.bypassShield) remaining = this.takeShields(target, remaining, info.element);
    remaining *= lateZone;
    if (preset.limbs) return LAYERS.surplus + LAYERS.shield + this.takeLimb(target, remaining, info);
    if (!kind.bypassArmor && !info.bypassArmor) remaining = this.takeArmor(target, remaining, preset, kind, info);
    return LAYERS.surplus + LAYERS.shield + LAYERS.armor + this.takeHealth(target, remaining);
  },
  takeHealth(target, amount) {
    Actors.health[target] -= amount;
    LAYERS.health = amount;
    return amount;
  },
  takeShields(target, amount, element) {
    const over = Math.min(this.surplus[target], amount);
    this.surplus[target] -= over;
    LAYERS.surplus = over;
    const factor = shieldElementFactor(target, element), wanted = (amount - over) * factor;
    const taken = Math.min(Actors.shield[target], wanted);
    Actors.shield[target] -= taken;
    LAYERS.shield = taken;
    return amount - over - taken / factor;
  },
  takeArmor(target, amount, preset, kind, info) {
    const armor = Actors.armor[target];
    if (armor <= 0 || preset.armorMode === 'none') return amount;
    if (preset.armorMode === 'tactical') return this.takeTacticalArmor(target, amount, info);
    const reduced = preset.armorMode === 'flat' && kind.flatArmor ? amount - Math.min(preset.armorFlat, amount * preset.armorFlatMax) : amount;
    const wanted = preset.armorMode === 'absorb' ? Math.ceil(reduced * preset.armorAbsorb) : reduced;
    const taken = Math.min(armor, wanted);
    Actors.armor[target] -= taken;
    LAYERS.armor = taken;
    return reduced - taken;
  },
  // HPP04: health takes damage x armorPen, armor loses damage x (1 - armorPen) x 0.5; legs and (without helmet) the head are open.
  takeTacticalArmor(target, amount, info) {
    if (info.zone === 'legs' || (info.zone === 'head' && !this.helmet[target])) return amount;
    const penetration = info.mode ? info.mode.armorPen : DEFAULT_ARMOR_PEN;
    const wanted = amount * (1 - penetration) * 0.5, taken = Math.min(Actors.armor[target], wanted);
    const covered = wanted > 0 ? taken / wanted : 1;
    Actors.armor[target] -= taken;
    LAYERS.armor = taken;
    return amount * penetration * covered + amount * (1 - covered);
  },
  // HPP09: the hit goes into one limb pool; health mirrors the average, head or torso at 0 kills.
  takeLimb(target, amount, info) {
    const limb = limbFor(target, info), base = target * LIMB_COUNT;
    const taken = Math.min(this.limbs[base + limb], amount);
    this.limbs[base + limb] -= taken;
    let total = 0;
    for (let k = 0; k < LIMB_COUNT; k++) total += this.limbs[base + k];
    const vitalLost = this.limbs[base + LIMB.HEAD] <= 0 || this.limbs[base + LIMB.TORSO] <= 0;
    Actors.health[target] = vitalLost ? 0 : total / LIMB_COUNT * Actors.maxHealth[target] / LIMB_POOL;
    LAYERS.health = taken;
    return taken;
  },

  afterDamage(source, target, info, kind, dealt, rules, attackerScale) {
    this.lastDamageTime[target] = Sim.time;
    this.recordAttacker(source, target);
    this.wake(target);
    this.applyHitStatus(source, target, info);
    if (source !== target) this.knockback(target, info.amount * attackerScale, info, rules);
    this.emitDamage(source, target, info, kind, dealt);
    if (!Game.headless) Fx.burst('blood', info.x, info.y, info.z, -info.dx, -info.dy, -info.dz, Math.min(12, 2 + dealt / 10), 0xa01818);
    if (Actors.health[target] > 0) return;
    if (this.shouldGoDown(target)) { this.goDown(source, target); return; }
    this.kill(source, target, info);
  },
  recordAttacker(source, target) {
    if (source < 0 || source === target) return;
    if (source !== this.lastAttacker[target]) { this.previousAttacker[target] = this.lastAttacker[target]; this.previousAttackTime[target] = this.lastAttackTime[target]; }
    this.lastAttacker[target] = source;
    this.lastAttackTime[target] = Sim.time;
  },
  // MOV-017: dv = 0.15 x damage x rules.knockback x mode factor / mass factor, capped; own explosions push at full strength.
  knockback(target, amount, info, rules) {
    const length = Math.hypot(info.dx, info.dy, info.dz);
    if (length < 1e-6 || amount <= 0) return;
    const profile = Actors.profile[target], mass = profile && profile.massFactor ? profile.massFactor : 1;
    const speed = Math.min(KNOCKBACK_CAP, KNOCKBACK_PER_DAMAGE * amount * rules.knockback * info.knockback / mass);
    emitImpulse(target, info.dx / length * speed, (info.dy / length + KNOCKBACK_LIFT) * speed, info.dz / length * speed);
  },
  emitDamage(source, target, info, kind, dealt) {
    const event = DAMAGE_EVENT;
    event.target = target; event.source = source; event.amount = dealt; event.absorbed = LAYERS.surplus + LAYERS.shield + LAYERS.armor;
    event.zone = info.zone; event.weapon = info.weapon; event.element = info.element; event.kind = kind.id;
    event.shieldDamage = LAYERS.surplus + LAYERS.shield; event.armorDamage = LAYERS.armor; event.healthDamage = LAYERS.health;
    event.x = info.x; event.y = info.y; event.z = info.z; event.dx = info.dx; event.dy = info.dy; event.dz = info.dz;
    Bus.emit('damage', event);
  },

  // ---- Death, downed (HP-007) and kill credit ----
  shouldGoDown(target) {
    if (!this.preset().downed || (Actors.flags[target] & ACTOR_FLAG.DOWNED) || Actors.team[target] < 0) return false;
    for (let id = 0; id < Actors.count; id++) if (id !== target && Actors.alive[id] && Actors.team[id] === Actors.team[target] && !(Actors.flags[id] & ACTOR_FLAG.DOWNED)) return true;
    return false;
  },
  goDown(source, target) {
    Actors.flags[target] |= ACTOR_FLAG.DOWNED;
    Actors.health[target] = DOWNED_HEALTH;
    this.downedTime[target] = DOWNED_BLEED_SECONDS;
    this.downedBy[target] = source;
  },
  revive(id) {
    if (!Actors.alive[id] || !(Actors.flags[id] & ACTOR_FLAG.DOWNED)) return false;
    Actors.flags[id] &= ~ACTOR_FLAG.DOWNED;
    Actors.health[id] = REVIVE_HEALTH;
    this.lastDamageTime[id] = Sim.time;
    return true;
  },
  kill(source, target, info) {
    const recent = this.recentAttacker(target, -1);
    const killer = (source < 0 || source === target) && recent >= 0 ? recent : source;
    Actors.alive[target] = 0;
    Actors.flags[target] &= ~(ACTOR_FLAG.DOWNED | ACTOR_FLAG.FROZEN);
    this.clearAllStatuses(target);
    const event = KILL_EVENT;
    event.victim = target; event.killer = killer; event.assister = this.recentAttacker(target, killer);
    event.weapon = info.weapon; event.zone = info.zone; event.element = info.element;
    event.x = Actors.x[target]; event.y = Actors.y[target]; event.z = Actors.z[target];
    Bus.emit('kill', event);
    if (!Game.headless && Actors.health[target] < GIB_HEALTH) Fx.burst('blood', Actors.x[target], Actors.y[target] + 1, Actors.z[target], 0, 1, 0, 24, 0xa01818);
  },
  // Most recent damager of target other than `except` within ASSIST_SECONDS, or -1.
  recentAttacker(target, except) {
    const now = Sim.time;
    if (this.lastAttacker[target] >= 0 && this.lastAttacker[target] !== except && now - this.lastAttackTime[target] <= ASSIST_SECONDS) return this.lastAttacker[target];
    if (this.previousAttacker[target] >= 0 && this.previousAttacker[target] !== except && now - this.previousAttackTime[target] <= ASSIST_SECONDS) return this.previousAttacker[target];
    return -1;
  },

  // ---- Splash (WPN-005 falloff to minFactor, line-of-sight occlusion, self damage via rules.selfDamage) ----
  explode(blast) {
    const mode = blast.mode, minFactor = mode && mode.splash && mode.splash.minFactor !== undefined ? mode.splash.minFactor : SPLASH_MIN_FACTOR;
    const weapon = blast.weapon || (mode ? mode.weapon : ''), element = blast.element || (mode ? mode.element : 'kinetic');
    this.announceExplosion(blast, weapon, element);
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id] || id === blast.exclude || (blast.ownerSafe && id === blast.owner)) continue;
      const distance = splashDistance(blast, id);
      if (distance > blast.radius || !World.lineClear(blast.x, blast.y, blast.z, splashPoint.x, splashPoint.y, splashPoint.z)) continue;
      this.splashOne(blast, id, distance, minFactor, weapon, element);
    }
  },
  splashOne(blast, id, distance, minFactor, weapon, element) {
    const info = this.info(), length = distance || 1;
    info.amount = blast.damage * lerp(1, minFactor, blast.radius > 0 ? distance / blast.radius : 0);
    info.kind = 'splash'; info.zone = 'none'; info.mode = blast.mode; info.weapon = weapon; info.element = element;
    info.knockback = blast.mode ? blast.mode.knockback : 1;
    info.x = splashPoint.x; info.y = splashPoint.y; info.z = splashPoint.z;
    info.dx = (splashPoint.x - blast.x) / length; info.dy = (splashPoint.y - blast.y) / length; info.dz = (splashPoint.z - blast.z) / length;
    if (distance < SPLASH_CENTRE_DISTANCE) { info.dx = 0; info.dy = 1; info.dz = 0; }   // a blast at the feet pushes straight up
    this.apply(blast.owner, id, info);
  },
  announceExplosion(blast, weapon, element) {
    const event = EXPLOSION_EVENT;
    event.x = blast.x; event.y = blast.y; event.z = blast.z; event.radius = blast.radius; event.owner = blast.owner; event.source = weapon; event.element = element;
    Bus.emit('explosion', event);
    emitSound(blast.x, blast.y, blast.z, EXPLOSION_NOISE_BASE + blast.radius * EXPLOSION_NOISE_PER_METRE, 'explosion', blast.owner);
    if (Game.headless || blast.radius <= 0) return;
    Fx.burst('explosion', blast.x, blast.y, blast.z, 0, 1, 0, 10 + Math.round(blast.radius * 4), 0xffa040);
    Fx.light(blast.x, blast.y, blast.z, 0xffa040, blast.radius * 2, 0.3);
    Fx.decal(blast.x, blast.y, blast.z, 0, 1, 0, 'scorch');
  },

  // ---- Health presets ----
  resetHealth(id) {
    const preset = this.preset();
    POOLS.health = preset.health; POOLS.armor = preset.armor; POOLS.shield = preset.shield;
    if (this.poolOverride) this.poolOverride(id, POOLS);
    Actors.health[id] = POOLS.health; Actors.maxHealth[id] = Math.max(preset.maxHealth, POOLS.health);
    Actors.armor[id] = POOLS.armor; Actors.maxArmor[id] = Math.max(preset.armorCap, POOLS.armor);
    Actors.shield[id] = POOLS.shield; Actors.maxShield[id] = Math.max(preset.shieldCap, POOLS.shield);
    this.helmet[id] = preset.helmet ? 1 : 0;
    this.surplus[id] = 0; this.downedTime[id] = 0; this.downedBy[id] = -1;
    this.lastDamageTime[id] = -1e9; this.lastAttacker[id] = this.previousAttacker[id] = -1;
    this.limbs.fill(LIMB_POOL, id * LIMB_COUNT, (id + 1) * LIMB_COUNT);
    Actors.flags[id] &= ~ACTOR_FLAG.DOWNED;
    this.clearAllStatuses(id);
  },
  step(dt) {
    const preset = this.preset();
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id]) continue;
      for (let s = 0; s < STATUS_COUNT; s++) if (this.statusTime[id * STATUS_COUNT + s] > 0) this.stepStatus(id, s, dt);
      if (Actors.flags[id] & ACTOR_FLAG.DOWNED) { this.stepDowned(id, dt); continue; }
      this.stepRegen(id, preset, dt);
    }
  },
  stepRegen(id, preset, dt) {
    const since = Sim.time - this.lastDamageTime[id];
    if (Actors.health[id] > Actors.maxHealth[id]) Actors.health[id] = Math.max(Actors.maxHealth[id], Actors.health[id] - preset.overhealDecay * dt);
    if (preset.armorDecayAbove && Actors.armor[id] > preset.armorDecayAbove) Actors.armor[id] = Math.max(preset.armorDecayAbove, Actors.armor[id] - preset.armorDecay * dt);
    if (preset.shieldRate && since >= preset.shieldDelay) Actors.shield[id] = Math.min(Actors.maxShield[id], Actors.shield[id] + preset.shieldRate * dt);
    if (preset.regenRate && since >= preset.regenDelay) this.regenerate(id, preset.regenRate * dt, regenCap(id, preset));
    const role = preset.roleRegen;
    if (role && since >= role.delay && actorRole(id) === role.role) this.regenerate(id, role.rate * dt, Actors.maxHealth[id]);
  },
  regenerate(id, amount, cap) {
    if (Actors.health[id] >= cap) return;
    Actors.health[id] = Math.min(cap, Actors.health[id] + amount);
  },
  stepDowned(id, dt) {
    this.downedTime[id] -= dt;
    if (this.downedTime[id] > 0) return;
    const info = this.info();
    info.kind = 'dot'; info.weapon = 'bleedout';
    Actors.health[id] = 0;
    this.kill(this.downedBy[id], id, info);
  },

  // ---- Status effects (HP-005) ----
  addStatus(id, key, source, seconds, stacks) {
    const row = CAT.statusEffects.byId(key);
    if (!row || !Actors.alive[id]) return false;
    const slot = id * STATUS_COUNT + row.index;
    this.statusStacks[slot] = Math.min(row.maxStacks, this.statusStacks[slot] + (stacks || 1));
    this.statusTime[slot] = Math.max(this.statusTime[slot], seconds || row.seconds);
    this.statusSource[slot] = source;
    if (row.stacksTo && this.statusStacks[slot] >= row.stacksTo) { this.clearStatus(id, row.index); return this.addStatus(id, row.becomes, source, 0, 1); }
    if (row.stun) this.setStun(id, true);
    if (row.shatter) this.frozenTick[id] = Sim.tick;
    return true;
  },
  hasStatus(id, key) { const row = CAT.statusEffects.byId(key); return !!row && this.statusTime[id * STATUS_COUNT + row.index] > 0; },
  applyHitStatus(source, target, info) {
    const status = hitStatus(source, info);
    if (!status || info.kind === 'dot' || info.distance < info.mode.statusRange) return;
    this.addStatus(target, status.id, source, status.seconds || 0, status.stacks || 1);
  },
  stepStatus(id, index, dt) {
    const row = CAT.statusEffects[index], slot = id * STATUS_COUNT + index;
    this.statusTime[slot] -= dt;
    this.statusTick[slot] += dt;
    if (row.dps > 0 && this.statusTick[slot] >= row.tickSeconds - TICK_EPSILON) {
      this.statusTick[slot] -= row.tickSeconds;
      this.statusDamage(id, row, slot);
    }
    if (this.statusTime[slot] <= 0) this.clearStatus(id, index);
  },
  statusDamage(id, row, slot) {
    const info = this.info();
    info.amount = row.dps * row.tickSeconds; info.kind = 'dot'; info.element = row.element; info.weapon = row.id;
    info.bypassArmor = row.bypassArmor; info.bypassShield = row.bypassShield;
    info.x = Actors.x[id]; info.y = Actors.y[id] + 1; info.z = Actors.z[id];
    this.apply(this.statusSource[slot], id, info);
  },
  clearStatus(id, index) {
    const slot = id * STATUS_COUNT + index;
    this.statusTime[slot] = 0; this.statusStacks[slot] = 0; this.statusTick[slot] = 0;
    if (CAT.statusEffects[index].stun) this.setStun(id, this.anyStun(id));
  },
  clearAllStatuses(id) {
    const base = id * STATUS_COUNT;
    this.statusTime.fill(0, base, base + STATUS_COUNT); this.statusStacks.fill(0, base, base + STATUS_COUNT); this.statusTick.fill(0, base, base + STATUS_COUNT);
    this.setStun(id, false);
  },
  anyStun(id) {
    for (let s = 0; s < STATUS_COUNT; s++) if (CAT.statusEffects[s].stun && this.statusTime[id * STATUS_COUNT + s] > 0) return true;
    return false;
  },
  // Stuns use ACTOR_FLAG.FROZEN (movement and weapons stop); a FROZEN flag set by another section is left alone.
  setStun(id, stunned) {
    if (stunned) { if (!(Actors.flags[id] & ACTOR_FLAG.FROZEN)) { Actors.flags[id] |= ACTOR_FLAG.FROZEN; this.stunSet[id] = 1; } return; }
    if (!this.stunSet[id]) return;
    Actors.flags[id] &= ~ACTOR_FLAG.FROZEN;
    this.stunSet[id] = 0;
  },
  wake(id) {
    for (let s = 0; s < STATUS_COUNT; s++) if (CAT.statusEffects[s].wakeOnDamage && this.statusTime[id * STATUS_COUNT + s] > 0) this.clearStatus(id, s);
  },
  // Movement multiplier from statuses, crippled legs (HPP09) and the downed crawl.
  statusSpeed(id) {
    if (Actors.flags[id] & ACTOR_FLAG.DOWNED) return DOWNED_SPEED;
    let speed = 1;
    for (let s = 0; s < STATUS_COUNT; s++) if (this.statusTime[id * STATUS_COUNT + s] > 0) speed *= CAT.statusEffects[s].speed;
    if (!this.preset().limbs) return speed;
    const base = id * LIMB_COUNT, legs = Math.min(this.limbs[base + LIMB.LEG_LEFT], this.limbs[base + LIMB.LEG_RIGHT]);
    const bothGone = this.limbs[base + LIMB.LEG_LEFT] <= 0 && this.limbs[base + LIMB.LEG_RIGHT] <= 0;
    return speed * (bothGone ? LIMB_LEG_SPEED[3] : LIMB_LEG_SPEED[limbStep(legs)]);
  },
  // Extra spread in degrees from damaged arms (HPP09).
  limbSpread(id) {
    if (!this.preset().limbs) return 0;
    const base = id * LIMB_COUNT;
    return LIMB_ARM_SPREAD[limbStep(Math.min(this.limbs[base + LIMB.ARM_LEFT], this.limbs[base + LIMB.ARM_RIGHT]))];
  },
};

const DEFAULT_DAMAGE_INFO = Object.freeze(makeDamageInfo());
const DEFAULT_BLAST = Object.freeze(makeBlast());
const DEFAULT_ARMOR_PEN = 0.75;
const EXPLOSION_NOISE_BASE = 40;
const EXPLOSION_NOISE_PER_METRE = 10;
const POOLS = { health: 0, armor: 0, shield: 0 };

// Penalty step of a limb pool: 0 healthy, 1 below 67 %, 2 below 34 %, 3 destroyed.
function limbStep(pool) {
  if (pool <= 0) return 3;
  if (pool < LIMB_STEPS[1] * LIMB_POOL) return 2;
  return pool < LIMB_STEPS[0] * LIMB_POOL ? 1 : 0;
}
// Which HPP09 pool a hit lands in: head, legs by side, torso or an arm by how far to the side it struck.
function limbFor(target, info) {
  if (info.zone === 'head') return LIMB.HEAD;
  const side = (info.x - Actors.x[target]) * -Math.cos(Actors.yaw[target]) + (info.z - Actors.z[target]) * Math.sin(Actors.yaw[target]);
  if (info.zone === 'legs') return side > 0 ? LIMB.LEG_RIGHT : LIMB.LEG_LEFT;
  if (info.zone !== 'body' || Math.abs(side) < LIMB_ARM_OFFSET) return LIMB.TORSO;
  return side > 0 ? LIMB.ARM_RIGHT : LIMB.ARM_LEFT;
}
// The status a hit carries: its mode's own, or the toggled stance's (W11 hollow rounds) for the weapon's primary.
function hitStatus(source, info) {
  const mode = info.mode;
  if (!mode) return null;
  if (mode.status) return mode.status;
  const weapon = source >= 0 && mode.weapon ? CAT.weapons.byId(mode.weapon) : null;
  if (!weapon || weapon.primary !== mode || !weapon.alt.toggle || !Weapons.toggled[source]) return null;
  return weapon.alt.toggle.status || null;
}
// The role HPP05 regen checks: Damage.roleOf when a section fills it, else the bot profile's role.
function actorRole(id) {
  if (Damage.roleOf) return Damage.roleOf(id);
  const profile = Actors.profile[id];
  return profile ? profile.role : '';
}
function isFodder(id) { const profile = Actors.profile[id]; return Actors.kind[id] === ACTOR_KIND.ENEMY && !!profile && profile.fodder === true; }

// HP-002: head / stomach / legs multiplier of the match's precision profile for this fire mode.
function zoneMultiplier(rules, info) {
  const mode = info.mode;
  if (!mode || info.zone === 'none') return 1;
  const profile = CAT.precision.byId(rules.precision) || CAT.precision.byId('standard');
  if (info.zone === 'body') return info.stomach ? profile.stomach : 1;
  if (info.zone === 'legs') return profile.legs || mode.legMult;
  return headMultiplier(profile, mode);
}
function headMultiplier(profile, mode) {
  const family = mode.family;
  if (profile.arenaHead) return mode.alwaysHead ? mode.headMult : profile.head;
  if (profile.pistolHead && family && family.pistol) return profile.pistolHead;
  if (profile.precisionHead) return family && family.precision ? profile.precisionHead : profile.head;
  return profile.head || mode.headMult;
}
// WPN-005: linear from startM to endM down to minFactor (splash has its own radius falloff).
function falloffFactor(info) {
  const falloff = info.mode && info.mode.falloff;
  if (!falloff || info.kind === 'splash') return 1;
  if (info.distance <= falloff[0]) return 1;
  if (info.distance >= falloff[1]) return falloff[2];
  return lerp(1, falloff[2], (info.distance - falloff[0]) / (falloff[1] - falloff[0]));
}
// HP-006: matching element vs a coloured shield x1.5, any other element x0.75.
function shieldElementFactor(target, element) {
  const coloured = Damage.shieldElement[target];
  if (!coloured) return 1;
  return CAT.elements[coloured - 1].id === element ? ELEMENT_MATCH_FACTOR : ELEMENT_MISMATCH_FACTOR;
}
// HPP03 thirds: health regenerates only up to the next step boundary above its current value.
function regenCap(id, preset) {
  const max = Actors.maxHealth[id];
  if (preset.regenSteps <= 1) return max;
  const step = max / preset.regenSteps;
  return Math.min(max, Math.ceil(Actors.health[id] / step - 1e-6) * step);
}
// Distance from a blast to the nearest point of the actor's body (feet + lift .. eye); leaves the point in splashPoint.
function splashDistance(blast, id) {
  const low = Actors.y[id] + SPLASH_TARGET_LIFT, high = Actors.eyeY(id);
  Vec.set(splashPoint, Actors.x[id], clamp(blast.y, low, high), Actors.z[id]);
  const horizontal = Math.max(0, Math.hypot(splashPoint.x - blast.x, splashPoint.z - blast.z) - TORSO_RADIUS);
  return Math.hypot(horizontal, splashPoint.y - blast.y);
}

Sim.addSystem('status', 20, (dt) => Damage.step(dt));
Damage.addReducer((source, target, amount) => amount * Move.damageScale(target));   // HP-001 victim reductions: MV08 roll
Bus.on('actor.spawn', (event) => Damage.resetHealth(event.id));
Bus.on('actor.create', (id) => { Damage.resetHealth(id); Damage.shieldElement[id] = 0; });
// Earlier sections (fall damage, hazards, telefrags, drowning) ask for damage; it still goes through Damage.apply.
Bus.on('damage.request', (request) => {
  const info = Damage.info();
  info.amount = request.amount; info.kind = request.kind || 'hazard'; info.element = request.element || 'kinetic'; info.weapon = info.kind;
  info.x = request.x || 0; info.y = request.y || 0; info.z = request.z || 0;
  Damage.apply(request.source === undefined ? -1 : request.source, request.target, info);
});
