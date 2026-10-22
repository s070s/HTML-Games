// Bot combat (BOT-030..BOT-036, BOT-040, BOT-093): target choice from perceived enemies only, the aim model (reaction
// time from 14b, smoothed error noise that settles while tracking, leading projectiles by aim skill, feet for splash,
// recoil control by spray trait, head aim from tier 4), firing only at a target in sight, hit-rate caps per tier,
// weapon choice by range and botPref, reload when safe, strafing and range keeping, projectile dodges, melee,
// grenades and ability triggers. Every action is a button or an aim angle (BOT-001).

const AIM_NOISE_PERIOD = 0.4;           // BOT-030 smoothed noise period (s)
const AIM_NOISE_SPREAD = 0.6;           // noise sample spread (fraction of the error)
const AIM_NOISE_LIMIT = 1.5;
const AIM_PITCH_SHARE = 0.6;            // vertical error is smaller than horizontal (people track side to side)
const AIM_SETTLE_SECONDS = 0.6;         // BOT-030: error shrinks over 0.6 s of tracking...
const AIM_SETTLE_EXTRA = 1;             // ...from 2x down to 1x
const AIM_TARGET_SPEED = 10, AIM_OWN_SPEED = 10;   // m/s that double the error
const AIM_LEAD_EXACT = 0.8, AIM_LEAD_LINEAR = 0.4, AIM_FEET_SKILL = 0.6;   // BOT-030 aim skill thresholds
const AIM_FEET_HEIGHT = 0.15;
const AIM_CHEST_HEIGHT = 1.1;           // a remembered (unseen) enemy is looked at here
const AIM_HEAD_MISS = 0.3;              // m: head aim (tier 4+) only while the aim error at the target's range stays this small
const RECOIL_CONTROL_MIN = 0.3;         // BT0 pulls against 30% of the punch, BT7 all of it...
const RECOIL_TRAIT_LOW = 0.75, RECOIL_TRAIT_RANGE = 0.5;   // ...times 0.75..1.25 by the spray-control trait
const FIRE_ALIGN_DEG = 2.5;             // fire when the view is this close to the wanted aim (plus a share of the error)
const FIRE_ALIGN_ERROR_SHARE = 0.3;
const FIRE_RANGE_SLACK = 1.6;           // shoot up to botPref max range x this
const FIRE_TAP_RECOIL = 1;              // deg: a tapped (semi / burst) shot waits until the uncontrolled punch is this small
const FIRE_HOLD_DEFAULT = 0.5;          // s a charge or release trigger is held
const CHARGE_KEEP_SECONDS = 1.5;        // a charge held without a shot this long is dropped by a weapon-switch tap
const GRENADE_AIM_SECONDS = 1;          // BOT-034: the throw waits (at most this long) until the view is on the solved arc...
const GRENADE_AIM_TOLERANCE = 3 * DEG;  // ...this close
const HIT_WINDOW = 30;                  // BOT-093: hit rates measured over 30 s windows (halved, not cleared, when full)
const HIT_MIN_SHOTS = 8;
const HIT_BOOST_UP = 0.03, HIT_BOOST_DOWN = 0.01, HIT_BOOST_MAX = 4, HIT_RELAX = 0.8;
const TARGET_VISIBLE_SCORE = 1, TARGET_KNOWN_SCORE = 0.4, TARGET_KEEP = 0.3, TARGET_KEEP_SWITCHER = 0.1;
const TARGET_DISTANCE_SCALE = 30;       // m: score halves at this distance
const TARGET_REVENGE_SECONDS = 3;
const TARGET_CARRIER_BONUS = 0.5;
const STRAFE_CHECK = 0.4;               // BOT-032: flip chance 6.5% per 0.4 s check
const STRAFE_FLIP = 0.065;
const RANGE_BACKOFF = 0.1;              // BOT-032: back off 10% inside the ideal range
const COMBAT_JUMP_CHANCE = 0.15;        // per strafe check x jumpiness (tiers with jumps)
const DODGE_RANGE = 20, DODGE_MISS = 2.5, DODGE_HORIZON = 0.8, DODGE_SECONDS = 0.35;
const WEAPON_CHECK_SECONDS = 1;
const SLOT_PRESS_INTERVAL = 0.25;
const RELOAD_FRACTION = 0.5;            // reload when safe below half a magazine
const RELOAD_PRESS_INTERVAL = 0.5;
const SAFE_SECONDS = 1.5;               // no enemy seen this long = safe to reload or switch (BOT-036)
const FAVORITE_BONUS = 0.2;             // BOT-036
const OUT_OF_RANGE_VALUE = 0.5, MELEE_OUT_OF_RANGE = 0.1;
const DEFAULT_ENGAGE_DISTANCE = 15;
const MELEE_DISTANCE = 1.8, MELEE_INTERVAL = 0.5;
const THROW_PITCH_TOP = 35 * DEG, THROW_SOLVE_STEPS = 16;   // the low arc rises up to here (18 m/s + 5 up: past 40 m)
const GRENADE_COOK_MARGIN = 0.3;        // s of fuse left at the landing (a cooked grenade goes off as it lands)
const GRENADE_RECENT = 3, GRENADE_CLUSTER = 4, GRENADE_INTERVAL = 4;   // s between throws at abilityUse 0.5...
const KIT_CHECK_INTERVAL = 0.5;         // ...and between kit checks (grenade, gadget, ability) while none is wanted
const GADGET_INTERVAL = 2;              // s after a placed / deployed gadget at abilityUse 0.5
const WEAPON_JUMP_RISE = 2.5, WEAPON_JUMP_REACH = 8;   // m: a goal this much higher and at most this far away is weapon-jumped to...
const WEAPON_JUMP_HEALTH = 0.6, WEAPON_JUMP_REST = 6;  // ...from above 60% health, at most once every 6 s
const WEAPON_JUMP_AIM_SECONDS = 0.6, WEAPON_JUMP_PITCH = 70 * DEG;   // the view turns down for at most 0.6 s; it fires below -70 degrees
const WEAPON_JUMP_DETOUR = 3;   // a walkable path this many times the straight line or longer is worth the jump's self-damage
const ABILITY_INTERVAL = 1.5;           // s after an ability press at abilityUse 0.5 (shorter with the trait)
const ABILITY_CLOSE = 10, ALLY_HURT = 0.5, SELF_HURT = 0.5, ALLY_RANGE = 15, DOWNED_ALLY_RANGE = 10;
const ABILITY_HOLD_SECONDS = 3;         // a 'hold' ability is held while its trigger lasts, at most this long
const ABILITY_KEEP_SECONDS = 4;         // a toggle or channel is pressed off once its trigger ends, at most this long after...
const ABILITY_MIN_ON = 0.5;             // ...and no sooner than this (one press on, a later press off); an off press that did
                                        // not take is tried again this long later (the button released in between)
const ABILITY_TRAVEL = 10;              // m: 'moving' abilities (glide, grapple, sprint) only on longer trips
const UNDER_FIRE_SECONDS = 1.5;         // hit this recently = under fire
const LOW_AMMO_SHARE = 0.25;
const DODGE_CHANCE_CAP = 0.6;           // BOT-033: no dodge is ever surer than 60%
const ONE_HIT_DODGE_SCALE = 1.5, ONE_HIT_DODGE_FLOOR = 0.2, ONE_HIT_DODGE_TIER = 2;   // MUT-003: one-shot rules raise dodge priority
const HAZARD_LOOKAHEAD = 5;             // m beyond a seen mine's trigger radius: a path that runs into it starts to bend...
const HAZARD_CLEARANCE = 1.2;           // ...to pass this far outside the trigger radius
const HAZARD_TANGENT_WEIGHT = 2;        // the sidestep outweighs the path direction (which still runs through the mine)
const HAZARD_PUSH_WEIGHT = 2;           // inside the clearance ring the bot is also pushed straight out
const ULTIMATE_TARGETS = 2;              // BOT-035: an ultimate goes when it reaches 2+ enemies (or the objective is contested)...
const ULTIMATE_ENEMY_TRIGGERS = ['enemyVisible', 'enemyClose', 'groupedEnemies'];   // ...if its botUse aims it at enemies
const PRESSABLE_SLOTS = SLOT.PASSIVE;   // ability slots a bot presses: ABILITY1, ABILITY2, ULTIMATE (the passive comes after them)

const aimPoint = Vec.make();
const perceived = Vec.make();

// Bot-use triggers (ABL-003, BOT-035): the `when` word of an ability's botUse or a BOT_GADGET_USE row names one of
// these; each tests only what the bot perceives (its target, its memory, its own state, team-mates it can see).
const BOT_USE_TRIGGERS = {
  always: () => true,
  enemyVisible: (id) => BotCombat.targetVisible(id),
  enemyClose: (id) => BotCombat.targetVisible(id) && BotCombat.targetDistance(id) < ABILITY_CLOSE,
  underFire: (id) => Sim.time - BotSense.attackedAt[id] < UNDER_FIRE_SECONDS,
  lowHealth: (id) => Actors.health[id] < Actors.maxHealth[id] * SELF_HURT,
  allyLow: (id) => BotCombat.hurtAllyNear(id),
  allyDowned: (id) => BotCombat.downedAllyNear(id),
  escape: (id) => Bots.state[id] === BOT_STATE.RETREAT || (BOT_USE_TRIGGERS.lowHealth(id) && BOT_USE_TRIGGERS.underFire(id)),
  moving: (id) => Bots.wishAmount[id] > 0.5 && BotCombat.target[id] < 0 && BotMove.distanceToDestination(id) > ABILITY_TRAVEL,
  groupedEnemies: (id) => BotCombat.visibleEnemies(id) >= ULTIMATE_TARGETS,
  objective: (id) => BotDecide.goal[id] === GOAL.OBJECTIVE && (BotDecide.contested(id) || BotCombat.targetVisible(id)),   // a fight at the point
  cover: (id) => BotCombat.targetInCover(id, Sim.time),
  coverOrHolding: (id) => BotCombat.targetInCover(id, Sim.time) || (BotCombat.target[id] >= 0 && BotDecide.holding(id)),
  holding: (id) => BotDecide.holding(id),
  lowAmmo: (id) => BotCombat.lowAmmo(id),
};

const BotCombat = {
  target: new Int8Array(MAX_ACTORS).fill(-1), trackStart: new Float64Array(MAX_ACTORS),
  noiseStart: new Float64Array(MAX_ACTORS), noiseFromYaw: new Float32Array(MAX_ACTORS), noiseToYaw: new Float32Array(MAX_ACTORS),
  noiseFromPitch: new Float32Array(MAX_ACTORS), noiseToPitch: new Float32Array(MAX_ACTORS),
  errorDeg: new Float32Array(MAX_ACTORS), errorBoost: new Float32Array(MAX_ACTORS).fill(1),
  windowShots: new Float32Array(MAX_ACTORS), windowHits: new Float32Array(MAX_ACTORS), windowStart: new Float64Array(MAX_ACTORS),
  lastHitTick: new Int32Array(MAX_ACTORS).fill(-1), totalShots: new Uint32Array(MAX_ACTORS), totalHits: new Uint32Array(MAX_ACTORS),
  strafeSide: new Int8Array(MAX_ACTORS).fill(1), strafeCheckAt: new Float64Array(MAX_ACTORS),
  dodgeAt: new Float64Array(MAX_ACTORS), dodgeUntil: new Float64Array(MAX_ACTORS), dodgeSide: new Int8Array(MAX_ACTORS), dodgeSerial: new Uint32Array(MAX_ACTORS),
  fireToggle: new Uint8Array(MAX_ACTORS), overlaid: new Uint8Array(MAX_ACTORS), holdSince: new Float64Array(MAX_ACTORS).fill(-1),
  keptSince: new Float64Array(MAX_ACTORS).fill(-1),
  licenseUntil: new Float64Array(MAX_ACTORS).fill(-1), licenseTarget: new Int8Array(MAX_ACTORS).fill(-1),   // ARC-033 record
  throwYaw: new Float32Array(MAX_ACTORS), throwPitch: new Float32Array(MAX_ACTORS), throwUntil: new Float64Array(MAX_ACTORS),
  throwCook: new Float32Array(MAX_ACTORS), cookUntil: new Float64Array(MAX_ACTORS),   // s to hold a cookable grenade; 0 = not cooking
  weaponCheckAt: new Float64Array(MAX_ACTORS), wantedWeapon: new Int16Array(MAX_ACTORS).fill(-1), slotPressAt: new Float64Array(MAX_ACTORS),
  reloadPressAt: new Float64Array(MAX_ACTORS), meleeAt: new Float64Array(MAX_ACTORS), grenadeAt: new Float64Array(MAX_ACTORS), abilityAt: new Float64Array(MAX_ACTORS),
  gadgetAt: new Float64Array(MAX_ACTORS), holdSlot: new Int8Array(MAX_ACTORS).fill(-1), holdSlotUntil: new Float64Array(MAX_ACTORS),
  switchedOnAt: new Float64Array(MAX_ACTORS * PRESSABLE_SLOTS).fill(-1),   // when the bot switched a toggle / channel slot on (-1: off)
  switchRetryAt: new Float64Array(MAX_ACTORS * PRESSABLE_SLOTS),            // no off press again before this (the button is released)
  jumpUntil: new Float64Array(MAX_ACTORS), weaponJumpAt: new Float64Array(MAX_ACTORS).fill(-1e9),   // weapon jump: aiming until, last jump
  uses: { abilities: 0, grenades: 0, gadgets: 0, weaponJumps: 0 },   // presses by every bot this match (tests, soak report)
  playerShots: new Uint32Array(WEAPON_COUNT),            // the player's shots per weapon (B24's favourite = the most used)
  // ARC-033: every bot shot comes from a trigger decision made while its target was in sight (unperceived counts the
  // others; unknown = the target was not even remembered). Judged at the decision, so a shot that kills is not a breach.
  fairness: { shots: 0, unperceived: 0, unknown: 0 },

  reset(id) {
    this.target[id] = -1; this.errorBoost[id] = 1; this.windowShots[id] = 0; this.windowHits[id] = 0; this.windowStart[id] = Sim.time;
    this.holdSince[id] = -1; this.keptSince[id] = -1; this.licenseUntil[id] = -1; this.throwUntil[id] = 0; this.cookUntil[id] = 0; this.jumpUntil[id] = 0; this.wantedWeapon[id] = -1; this.weaponCheckAt[id] = 0; this.dodgeUntil[id] = 0; this.dodgeAt[id] = 0;
    this.noiseStart[id] = -1e9; this.trackStart[id] = Sim.time; this.strafeCheckAt[id] = 0;
    // Sim.time starts again at 0 every match: no clock of an earlier match may block this one.
    this.reloadPressAt[id] = 0; this.slotPressAt[id] = 0; this.meleeAt[id] = 0; this.grenadeAt[id] = 0; this.abilityAt[id] = 0;
    this.gadgetAt[id] = 0; this.holdSlot[id] = -1; this.weaponJumpAt[id] = -1e9;
    this.switchedOnAt.fill(-1, id * PRESSABLE_SLOTS, (id + 1) * PRESSABLE_SLOTS);
    this.switchRetryAt.fill(0, id * PRESSABLE_SLOTS, (id + 1) * PRESSABLE_SLOTS);
  },
  targetVisible(id) { const target = this.target[id]; return target >= 0 && BotSense.sees(id, target); },
  // Distance to where the bot believes its target is (BOT-040: a remembered target is judged by its last known place).
  targetDistance(id) {
    const target = this.target[id];
    if (target < 0) return Infinity;
    BotSense.perceivedPosition(id, target, perceived);
    return length3(perceived.x - Actors.x[id], perceived.y - Actors.y[id], perceived.z - Actors.z[id]);
  },
  hitRate(id) { return this.windowShots[id] > 0 ? this.windowHits[id] / this.windowShots[id] : 0; },

  update(id, dt, now) {
    if (Bots.lastPerceive[id] === now || !this.validTarget(id, this.target[id], now)) this.chooseTarget(id, now);
    const target = this.target[id];
    this.manageWeapon(id, now);
    this.useKit(id, now);
    if (now < this.throwUntil[id]) { this.aimThrow(id, now); return; }
    if (target < 0 && this.weaponJump(id, now)) return;
    if (target < 0) { this.lookAtThreat(id, now); this.keepCharge(id, now, false); return; }
    if (BotSense.sees(id, target)) this.engage(id, target, now);
    else this.watch(id, target, now);
    this.checkDodge(id, now);
  },

  // ---- Targets: only enemies the bot perceives or remembers (BOT-040) ----
  validTarget(id, target, now) {
    if (target < 0 || !Actors.alive[target] || !Actors.isEnemy(id, target)) return false;
    if (Actors.flags[target] & ACTOR_FLAG.PROTECTED) return false;          // BOT-040: spawn-protected targets are ignored
    if (Bots.inGrace(id, target)) return false;
    return BotSense.sees(id, target) || BotSense.knows(id, target, now);
  },
  chooseTarget(id, now) {
    let best = -1, bestScore = 0;
    for (let other = 0; other < Actors.count; other++) {
      if (!this.validTarget(id, other, now) || this.attackersFull(id, other)) continue;
      const score = this.targetScore(id, other, now);
      if (score > bestScore) { bestScore = score; best = other; }
    }
    if (best !== this.target[id]) { this.target[id] = best; this.trackStart[id] = now; }
  },
  targetScore(id, other, now) {
    const pair = BotSense.pair(id, other), visible = BotSense.visible[pair] === 1;
    const distance = length2(BotSense.knownX[pair] - Actors.x[id], BotSense.knownZ[pair] - Actors.z[id]);
    let score = (visible ? TARGET_VISIBLE_SCORE : TARGET_KNOWN_SCORE) / (1 + distance / TARGET_DISTANCE_SCALE);
    if (other === this.target[id]) score += Bots.tier(id).targetSwitch ? TARGET_KEEP_SWITCHER : TARGET_KEEP;
    if (BotSense.attacker[id] === other && now - BotSense.attackedAt[id] < TARGET_REVENGE_SECONDS) score += Bots.trait(id, TRAIT.vengefulness);
    if (BotDecide.carriesObjective(other) || huntedRole(other)) score += TARGET_CARRIER_BONUS;
    return score;
  },
  // DIF-002 max simultaneous attackers: bots beyond the limit leave the player alone (unless the player hits them).
  attackersFull(id, other) {
    if (Actors.kind[other] !== ACTOR_KIND.PLAYER || this.target[id] === other || BotSense.attacker[id] === other) return false;
    let attackers = 0;
    for (let bot = 0; bot < Actors.count; bot++) if (bot !== id && Bots.isBot(bot) && this.target[bot] === other) attackers++;
    return attackers >= Bots.maxAttackers();
  },
  visibleEnemies(id) {
    let count = 0;
    for (let other = 0; other < Actors.count; other++) if (BotSense.sees(id, other) && Actors.alive[other]) count++;
    return count;
  },
  hurtAllyNear(id) {
    for (let other = 0; other < Actors.count; other++) {
      if (other === id || !Actors.alive[other] || Actors.isEnemy(id, other) || Actors.health[other] >= Actors.maxHealth[other] * ALLY_HURT) continue;
      if (length2(Actors.x[other] - Actors.x[id], Actors.z[other] - Actors.z[id]) < ALLY_RANGE) return true;
    }
    return false;
  },
  downedAllyNear(id) {
    for (let other = 0; other < Actors.count; other++) {
      if (other === id || !Actors.alive[other] || Actors.isEnemy(id, other) || !(Actors.flags[other] & ACTOR_FLAG.DOWNED)) continue;
      if (length2(Actors.x[other] - Actors.x[id], Actors.z[other] - Actors.z[id]) < DOWNED_ALLY_RANGE) return true;
    }
    return false;
  },
  // BOT-034: the target hid in the last 3 s, or 2+ enemies the bot sees stand together.
  targetInCover(id, now) {
    const target = this.target[id];
    if (target < 0) return false;
    const pair = BotSense.pair(id, target);
    if (BotSense.visible[pair] === 1) return this.clusterAround(id, target) >= 2;
    return now - BotSense.seenAt[pair] < GRENADE_RECENT;
  },
  lowAmmo(id) {
    const ammo = Weapons.ammo(id), weapon = Weapons.currentWeapon(id);
    return !!ammo && !!weapon && !ammo.infinite && weapon.mag > 0 && ammo.reserve < Weapons.maxReserve(id, weapon) * LOW_AMMO_SHARE;
  },
  // Hit but nothing in sight: turn toward where the hit came from.
  lookAtThreat(id, now) {
    const attacker = BotSense.attacker[id];
    if (attacker < 0 || now - BotSense.attackedAt[id] > TARGET_REVENGE_SECONDS) return;
    const pair = BotSense.pair(id, attacker);
    Bots.lookAt(id, BotSense.knownX[pair], BotSense.knownY[pair] + AIM_CHEST_HEIGHT, BotSense.knownZ[pair]);
  },
  watch(id, target, now) {
    const pair = BotSense.pair(id, target);
    Bots.lookAt(id, BotSense.knownX[pair], BotSense.knownY[pair] + AIM_CHEST_HEIGHT, BotSense.knownZ[pair]);
    this.keepCharge(id, now, false);
  },

  // ---- Aim model (BOT-030) and the trigger ----
  engage(id, target, now) {
    const weapon = Weapons.currentWeapon(id);
    const error = this.aimError(id, target, now);
    this.aimPoint(id, target, weapon, error, aimPoint);
    const noise = this.noise(id, now);
    const dx = aimPoint.x - Actors.x[id], dy = aimPoint.y - Actors.eyeY(id), dz = aimPoint.z - Actors.z[id];
    const spray = recoilControl(id) * DEG;   // BOT-031 recoil control by tier and spray trait
    Bots.lookYaw[id] = Math.atan2(dx, dz) + error * noise.yaw * DEG - Weapons.recoilYaw[id] * spray;
    Bots.lookPitch[id] = Math.atan2(dy, length2(dx, dz)) + error * noise.pitch * AIM_PITCH_SHARE * DEG - Weapons.recoilPitch[id] * spray;
    if (this.mayFire(id, target, weapon, error, length3(dx, dy, dz), now)) this.pullTrigger(id, target, weapon, now);
    else this.keepCharge(id, now, true);
    if (weapon && length2(dx, dz) < MELEE_DISTANCE && weapon.class !== 'melee' && now >= this.meleeAt[id]) { Bots.press(id, BTN.MELEE); this.meleeAt[id] = now + MELEE_INTERVAL; }
  },
  // Head from tier 4 with precise weapons when the error is small enough at that range (BOT-031: a preference, so a bot
  // that would mostly miss the head aims at the body), feet for splash at aim skill > 0.6, lead for projectiles (BOT-030).
  aimPoint(id, target, weapon, error, out) {
    const mode = weapon ? weapon.primary : null, tier = Bots.tier(id), skill = Bots.trait(id, TRAIT.aimSkill);
    const precise = tier.headAim && mode && mode.type === 'hitscan' && !mode.splash;
    const head = headOnlyRules() || (precise && error * DEG * this.targetDistance(id) <= AIM_HEAD_MISS);   // MUT-003: body hits do nothing
    Hitbox.point(target, head ? ZONE.HEAD : ZONE.BODY, out);
    if (mode && mode.splash && skill > AIM_FEET_SKILL && !headOnlyRules()) out.y = Actors.y[target] + AIM_FEET_HEIGHT;
    const speed = mode ? this.leadSpeed(mode) : 0;
    if (!speed || !tier.lead || skill <= AIM_LEAD_LINEAR) return out;
    const passes = skill > AIM_LEAD_EXACT ? 2 : 1;   // exact: refine the flight time once; linear: one estimate
    const startX = out.x, startY = out.y, startZ = out.z;
    for (let pass = 0; pass < passes; pass++) {
      const time = length3(out.x - Actors.x[id], out.y - Actors.eyeY(id), out.z - Actors.z[id]) / speed;
      out.x = startX + Actors.vx[target] * time; out.z = startZ + Actors.vz[target] * time; out.y = startY + this.dropFor(mode, time);
    }
    return out;
  },
  // Flight speed of a shot to lead with: projectiles, and hitscan shots flying as X41 bullets (rules.fx.ballistics); 0 = instant.
  leadSpeed(mode) {
    if (Weapons.fliesAsBullet(mode)) return BALLISTIC_ROW.speed;
    return mode.type === 'projectile' ? this.projectileSpeed(mode) : 0;
  },
  projectileSpeed(mode) {
    if (mode.speed > 0) return mode.speed;
    const row = CAT.projectiles.byId(mode.projectile);
    return row ? row.speed : 0;
  },
  // Height the shot falls in `time` s (aim that much higher): the projectile row's gravity, or the X41 bullet gravity.
  dropFor(mode, time) {
    const row = CAT.projectiles.byId(mode.projectile);
    const gravity = Weapons.fliesAsBullet(mode) ? Weapons.ballistics().gravity || 0 : row ? row.gravity : 0;
    return 0.5 * gravity * time * time;
  },
  // error = tier error x (1 - accuracy x 0.5) x (1 + target speed/10) x (1 + own speed/10) x settle x difficulty x hit-cap boost.
  aimError(id, target, now) {
    const tier = Bots.tier(id);
    const targetSpeed = length2(Actors.vx[target], Actors.vz[target]), ownSpeed = length2(Actors.vx[id], Actors.vz[id]);
    const settle = 1 + AIM_SETTLE_EXTRA * (1 - clamp((now - this.trackStart[id]) / AIM_SETTLE_SECONDS, 0, 1));
    const error = tier.aimError * (1 - Bots.trait(id, TRAIT.accuracy) * 0.5) * (1 + targetSpeed / AIM_TARGET_SPEED) * (1 + ownSpeed / AIM_OWN_SPEED)
      * settle * Bots.aimErrorScale() * this.errorBoost[id];
    this.errorDeg[id] = error;
    return error;
  },
  // Value noise: a new seeded sample every 0.4 s, smoothly blended (no jitter, no snapping).
  noise(id, now) {
    if (now - this.noiseStart[id] >= AIM_NOISE_PERIOD) {
      const fresh = now - this.noiseStart[id] > AIM_NOISE_PERIOD * 2;
      this.noiseFromYaw[id] = fresh ? noiseSample() : this.noiseToYaw[id];
      this.noiseFromPitch[id] = fresh ? noiseSample() : this.noiseToPitch[id];
      this.noiseToYaw[id] = noiseSample(); this.noiseToPitch[id] = noiseSample();
      this.noiseStart[id] = now;
    }
    const t = smoothstep(0, 1, (now - this.noiseStart[id]) / AIM_NOISE_PERIOD);
    noiseOut.yaw = lerp(this.noiseFromYaw[id], this.noiseToYaw[id], t);
    noiseOut.pitch = lerp(this.noiseFromPitch[id], this.noiseToPitch[id], t);
    return noiseOut;
  },
  mayFire(id, target, weapon, error, distance, now) {
    if (!weapon || now < BotSense.reactAt[BotSense.pair(id, target)]) return false;   // BOT-006 reaction time
    if (!worthShooting(target, weapon)) return false;
    if (distance > weapon.primary.range || distance > weapon.botPref.range[1] * FIRE_RANGE_SLACK + MELEE_DISTANCE) return false;
    const yawOff = Math.abs(wrapAngle(Bots.lookYaw[id] - Actors.aimYaw[id])), pitchOff = Math.abs(Bots.lookPitch[id] - Actors.aimPitch[id]);
    if (length2(yawOff, pitchOff) > (FIRE_ALIGN_DEG + error * FIRE_ALIGN_ERROR_SHARE) * DEG) return false;
    return !tapped(weapon.primary) || length2(Weapons.recoilYaw[id], Weapons.recoilPitch[id]) * (1 - recoilControl(id)) <= FIRE_TAP_RECOIL;
  },
  // auto/beam: hold; semi/burst: press every other tick; charge/release: hold, then let go. Only called with the target
  // in sight and the aim on it, so the shots of this tick (and a burst's later rounds) are licensed for the fairness record.
  pullTrigger(id, target, weapon, now) {
    const mode = weapon.primary;
    if (mode.trigger === 'charge' || mode.trigger === 'release') { this.holdThenRelease(id, target, mode, now); return; }
    if (tapped(mode)) {
      this.fireToggle[id] ^= 1;
      if (this.fireToggle[id]) { Bots.press(id, BTN.FIRE); this.license(id, target, mode, now); }
      return;
    }
    Bots.press(id, BTN.FIRE);
    this.license(id, target, mode, now);
  },
  holdThenRelease(id, target, mode, now) {
    if (this.holdSince[id] < 0) this.holdSince[id] = now;
    this.keptSince[id] = -1;
    const hold = mode.charge ? mode.charge.time : mode.lock ? mode.lock.time : FIRE_HOLD_DEFAULT;
    if (now - this.holdSince[id] < hold) { Bots.press(id, BTN.FIRE); return; }
    this.holdSince[id] = -1;   // released this tick: the shot goes
    this.license(id, target, mode, now);
  },
  license(id, target, mode, now) {
    this.licenseTarget[id] = target;
    this.licenseUntil[id] = now + (mode.trigger === 'burst' ? mode.burst * mode.burstGap : 0);
  },
  // A charge or lock that cannot go now (aim off, target hidden) stays held: letting go would fire it at nothing. After
  // CHARGE_KEEP_SECONDS out of sight a weapon-switch tap drops it, like a player giving up; a bot with one weapon keeps it.
  keepCharge(id, now, seen) {
    if (this.holdSince[id] < 0) return;
    Bots.press(id, BTN.FIRE);
    if (seen) { this.keptSince[id] = -1; return; }
    if (this.keptSince[id] < 0) this.keptSince[id] = now;
    const other = Weapons.cycle(id, 1);
    if (now - this.keptSince[id] < CHARGE_KEEP_SECONDS || other < 0 || other === Weapons.current[id]) return;
    Bots.press(id, BTN.NEXT_WEAPON);   // the switch resets the charge (S11 resetFiring), so the release that follows is empty
    this.holdSince[id] = -1; this.keptSince[id] = -1;
  },

  // ---- Weapons: choice by range and botPref (BOT-036), switching only when safe or empty, reload when safe ----
  manageWeapon(id, now) {
    const safe = this.isSafe(id, now);
    if (now >= this.weaponCheckAt[id]) { this.weaponCheckAt[id] = now + WEAPON_CHECK_SECONDS; this.wantedWeapon[id] = this.bestWeapon(id); }
    const current = Weapons.currentWeapon(id), ammo = Weapons.ammo(id);
    const empty = !current || (ammo && !ammo.infinite && ammo.magazine === 0 && ammo.reserve === 0 && current.mag > 0);
    if ((safe || empty) && this.wantedWeapon[id] >= 0) this.switchTo(id, this.wantedWeapon[id], now);
    if (current && ammo && current.mag > 0 && (safe || ammo.magazine === 0)) this.reloadIfLow(id, current, ammo, now);   // an empty gun reloads in a fight too
  },
  isSafe(id, now) {
    const target = this.target[id];
    return target < 0 || now - BotSense.seenAt[BotSense.pair(id, target)] > SAFE_SECONDS;
  },
  bestWeapon(id) {
    const distance = this.target[id] >= 0 ? this.targetDistance(id) : DEFAULT_ENGAGE_DISTANCE;
    const favorite = BotDecide.favoriteWeapon(id);
    let best = -1, bestValue = -1;
    for (let index = 0; index < WEAPON_COUNT; index++) {
      const slot = Weapons.slotIndex(id, index), weapon = CAT.weapons[index];
      if (!Weapons.owned[slot] || !this.hasRounds(id, weapon, slot)) continue;
      const range = weapon.botPref.range, inRange = distance >= range[0] && distance <= range[1];
      let value = weapon.botPref.value * (inRange ? 1 : weapon.class === 'melee' ? MELEE_OUT_OF_RANGE : OUT_OF_RANGE_VALUE);
      if (weapon.id === favorite) value += FAVORITE_BONUS;
      if (value > bestValue) { bestValue = value; best = index; }
    }
    return best;
  },
  hasRounds(id, weapon, slot) {
    return weapon.mag === 0 || Weapons.magazine[slot] > 0 || Weapons.reserve[slot] > 0 || Weapons.infiniteReserve(weapon);
  },
  // Slot keys like a player: a one-step press, repeated (cycling a shared slot) until the wanted weapon is out.
  switchTo(id, index, now) {
    const current = Weapons.state[id] === WEAPON_STATE.SWAP ? Weapons.pending[id] : Weapons.current[id];
    if (current === index || now < this.slotPressAt[id]) return;
    this.slotPressAt[id] = now + SLOT_PRESS_INTERVAL;
    Bots.slotWanted[id] = CAT.weapons[index].slot;
  },
  reloadIfLow(id, weapon, ammo, now) {
    if (Weapons.state[id] !== WEAPON_STATE.IDLE || now < this.reloadPressAt[id]) return;
    if (ammo.magazine >= Weapons.magSize(id, weapon) * RELOAD_FRACTION || (ammo.reserve <= 0 && !ammo.infinite)) return;
    this.reloadPressAt[id] = now + RELOAD_PRESS_INTERVAL;
    Bots.press(id, BTN.RELOAD);
    BotTeam.bark(id, 'reloading', now);
  },

  // ---- Combat movement (BOT-032/033), applied over the path steering of 14c ----
  // Combat footwork replaces the path move while an enemy is in sight; overlaid marks it (no stuck check on it, 14c).
  overlayMovement(id, dt, now) {
    const target = this.target[id];
    this.overlaid[id] = 0;
    if (target < 0 || !BotSense.sees(id, target) || BotMove.ownsView(id)) return;
    const tier = Bots.tier(id);
    if (tier.combatMove === 'walk' && now >= this.dodgeUntil[id]) { Bots.wishAmount[id] *= 0.5; return; }
    this.overlaid[id] = 1;
    if (now < this.dodgeUntil[id]) { this.dodge(id, target); return; }
    if (tier.combatMove === 'stand') { if (Bots.state[id] === BOT_STATE.ENGAGE) Bots.wish(id, 0, 0, 0); return; }
    this.strafe(id, target, tier, now);
  },
  strafe(id, target, tier, now) {
    if (now >= this.strafeCheckAt[id]) this.strafeCheck(id, tier, now);
    const dx = Actors.x[target] - Actors.x[id], dz = Actors.z[target] - Actors.z[id], distance = length2(dx, dz) || 1;
    const towardX = dx / distance, towardZ = dz / distance;
    const weapon = Weapons.currentWeapon(id), range = weapon ? weapon.botPref.range : null;
    let along = -RANGE_BACKOFF;
    if (range && distance < range[0]) along = -1;
    else if (range && distance > range[1]) along = 1;
    const side = this.strafeSide[id] * (0.6 + 0.4 * Bots.trait(id, TRAIT.strafing));
    const engaging = Bots.state[id] === BOT_STATE.ENGAGE;
    const pathX = engaging && along <= 0 ? 0 : Bots.wishX[id] * Bots.wishAmount[id], pathZ = engaging && along <= 0 ? 0 : Bots.wishZ[id] * Bots.wishAmount[id];
    const reloading = Weapons.state[id] === WEAPON_STATE.RELOAD;
    const backX = reloading ? -towardX : engaging ? towardX * along : 0, backZ = reloading ? -towardZ : engaging ? towardZ * along : 0;
    const wanted = botWish;
    wanted.x = pathX + backX - towardZ * side; wanted.z = pathZ + backZ + towardX * side; wanted.amount = 1;
    Bots.wishFrom(id);
  },
  strafeCheck(id, tier, now) {
    this.strafeCheckAt[id] = now + STRAFE_CHECK;
    if (Rng.bots.chance(STRAFE_FLIP * (0.5 + Bots.trait(id, TRAIT.strafing)))) this.strafeSide[id] = -this.strafeSide[id];
    if (tier.jumps && !airborneOnlyRules() && Move.isGrounded(id) && Rng.bots.chance(COMBAT_JUMP_CHANCE * Bots.trait(id, TRAIT.jumpiness))) Bots.press(id, BTN.JUMP);
  },
  dodge(id, target) {
    const dx = Actors.x[target] - Actors.x[id], dz = Actors.z[target] - Actors.z[id], distance = length2(dx, dz) || 1;
    const wanted = botWish;
    wanted.x = -dz / distance * this.dodgeSide[id]; wanted.z = dx / distance * this.dodgeSide[id]; wanted.amount = 1;
    Bots.wishFrom(id);
  },
  // BOT-033: a seen enemy projectile on a near-miss course; after the reaction time, a tier chance (<= 60%) to dodge.
  checkDodge(id, now) {
    const chance = dodgeChance(id);
    if (chance <= 0 || Bots.lastPerceive[id] !== now) return;
    if (this.dodgeAt[id] > 0 && now >= this.dodgeAt[id]) this.rollDodge(id, chance, now);
    if (this.dodgeAt[id] > 0) return;
    for (let i = 0; i < PROJECTILE_CAP; i++) if (Projectiles.state[i] && this.threatens(id, i)) { this.planDodge(id, i, now); return; }
  },
  threatens(id, i) {
    const owner = Projectiles.owner[i];
    if (owner < 0 || owner === id || !Actors.isEnemy(id, owner) || Projectiles.serial[i] === this.dodgeSerial[id]) return false;
    const rx = Actors.x[id] - Projectiles.x[i], ry = Actors.eyeY(id) - 0.6 - Projectiles.y[i], rz = Actors.z[id] - Projectiles.z[i];
    const distance = length3(rx, ry, rz);
    if (distance > DODGE_RANGE) return false;
    const vx = Projectiles.vx[i], vy = Projectiles.vy[i], vz = Projectiles.vz[i], speed = length3(vx, vy, vz);
    const closing = (rx * vx + ry * vy + rz * vz) / Math.max(speed, 1e-6);
    if (closing <= 0 || closing / Math.max(speed, 1e-6) > DODGE_HORIZON) return false;
    const missSquared = distance * distance - closing * closing;
    if (missSquared > DODGE_MISS * DODGE_MISS) return false;
    const yaw = Actors.yaw[id], facing = -(Math.sin(yaw) * rx + Math.cos(yaw) * rz) / Math.max(length2(rx, rz), 1e-6);
    return facing >= Math.cos(Bots.tier(id).fov * DEG / 2);   // "only when the projectile is seen"
  },
  planDodge(id, i, now) {
    this.dodgeSerial[id] = Projectiles.serial[i];
    this.dodgeAt[id] = now + Bots.tier(id).reaction / 1000 * Bots.reactionScale();
    this.dodgeSide[id] = Rng.bots.sign();
  },
  rollDodge(id, chance, now) {
    this.dodgeAt[id] = 0;
    if (!Rng.bots.chance(chance)) return;
    this.dodgeUntil[id] = now + DODGE_SECONDS;
    if (Rng.bots.chance(Bots.trait(id, TRAIT.jumpiness)) && Move.isGrounded(id)) Bots.press(id, BTN.JUMP);
  },

  // ---- Weapon jumps (botTiers weaponJumps, trait T12 weaponJumper): out of a fight, a goal on a ledge just above is reached
  // with a splash weapon fired at the feet in the jump ----
  weaponJump(id, now) {
    if (this.aimingJump(id, now)) { this.aimJump(id, now); return true; }
    if (!this.wantsWeaponJump(id, now)) return false;
    this.jumpUntil[id] = now + WEAPON_JUMP_AIM_SECONDS;
    this.weaponJumpAt[id] = now;
    this.aimJump(id, now);
    return true;
  },
  aimingJump(id, now) { return now < this.jumpUntil[id]; },   // the view is the jump's (path following does not turn it)
  // A weapon jump being aimed, or one wanted now (the goal stays until it is tried).
  weaponJumpPending(id, now) { return this.aimingJump(id, now) || this.wantsWeaponJump(id, now); },
  wantsWeaponJump(id, now) {
    if (now - this.weaponJumpAt[id] < WEAPON_JUMP_REST || !Bots.tier(id).weaponJumps || Bots.trait(id, TRAIT.weaponJumper) <= BOT_TRAIT_NEUTRAL) return false;
    const weapon = Weapons.currentWeapon(id);
    if (!weapon || !weapon.primary.splash || !Move.isGrounded(id) || Actors.health[id] < Actors.maxHealth[id] * WEAPON_JUMP_HEALTH) return false;
    const rise = BotDecide.goalY[id] - Actors.y[id], reach = length2(BotDecide.goalX[id] - Actors.x[id], BotDecide.goalZ[id] - Actors.z[id]);
    return BotDecide.goal[id] !== GOAL.NONE && rise >= WEAPON_JUMP_RISE && reach <= WEAPON_JUMP_REACH && this.jumpBeatsWalking(id, length2(reach, rise));
  },
  // No walkable way up (the path failed or ends below the goal), or one WEAPON_JUMP_DETOUR times the straight line or
  // longer (stairs nearby win).
  jumpBeatsWalking(id, straight) {
    if (BotMove.failed(id)) return true;
    if (!BotMove.following(id)) return false;
    return !BotMove.pathEndsAt(id, BotDecide.goalY[id]) || BotMove.pathLeft(id) >= straight * WEAPON_JUMP_DETOUR;
  },
  // The view turns straight down (at the motor's rate) facing away from the goal, so the blast lands on the far side and
  // pushes the bot up and toward the ledge; there the bot jumps and fires in one step. The shot is licensed (ARC-033
  // counts shots at enemies the bot does not perceive; this one is at its own feet).
  aimJump(id, now) {
    Bots.lookYaw[id] = Math.atan2(Actors.x[id] - BotDecide.goalX[id], Actors.z[id] - BotDecide.goalZ[id]);
    Bots.lookPitch[id] = -BOT_PITCH_LIMIT;
    if (Actors.aimPitch[id] > -WEAPON_JUMP_PITCH) return;
    Bots.press(id, BTN.JUMP | BTN.FIRE);
    this.licenseTarget[id] = -1; this.licenseUntil[id] = now;
    this.jumpUntil[id] = 0;
    this.uses.weaponJumps++;
  },

  // ---- Grenades (BOT-034), gadgets and abilities (BOT-035): pressed like a player, only on perceived conditions ----
  // Each kind is checked on its own clock (faster with the abilityUse trait); a throw being aimed waits for nothing else.
  useKit(id, now) {
    this.keepHolding(id, now);
    this.switchOff(id, now);
    if (!Bots.tier(id).gadgets || now < this.throwUntil[id]) return;
    if (now >= this.abilityAt[id]) this.tryAbilities(id, now);
    if (now >= this.grenadeAt[id]) this.tryGrenade(id, now);
    if (now >= this.gadgetAt[id]) this.tryGadget(id, now);
  },
  // Thrown rows by BOT_GADGET_USE: at the target's believed place, or half way there for a screen.
  tryGrenade(id, now) {
    const pace = kitPace(id);
    this.grenadeAt[id] = now + KIT_CHECK_INTERVAL / pace;
    const target = this.target[id], row = carriedRow(id, Gadgets.grenade[id]);
    const use = row ? BOT_GADGET_USE[row.effect] : null;
    if (target < 0 || !use || !botUseWanted(id, use) || !BotTeam.takeGrenadeToken(id, now)) return;
    this.grenadeAt[id] = now + GRENADE_INTERVAL / pace;
    const pair = BotSense.pair(id, target), share = use.aim === 'between' ? 0.5 : 1;
    const dx = (BotSense.knownX[pair] - Actors.x[id]) * share, dz = (BotSense.knownZ[pair] - Actors.z[id]) * share;
    this.throwYaw[id] = Math.atan2(dx, dz);
    this.throwPitch[id] = solveThrowPitch(length2(dx, dz) - THROW_FORWARD, BotSense.knownY[pair] - Actors.eyeY(id));
    this.throwCook[id] = row.cook ? Math.max(0, row.fuse - throwFlight - GRENADE_COOK_MARGIN) : 0;
    this.throwUntil[id] = now + GRENADE_AIM_SECONDS;
  },
  // Two-phase throw: turn the view onto the solved arc (at the motor's turn rate); once it is there, hold GRENADE for
  // the cook time (the view stays on the arc) and release: the throw goes on the release.
  aimThrow(id, now) {
    Bots.lookYaw[id] = this.throwYaw[id];
    Bots.lookPitch[id] = this.throwPitch[id];
    if (this.cookUntil[id] > 0) { this.cookThrow(id, now); return; }
    if (Math.abs(wrapAngle(Actors.aimYaw[id] - this.throwYaw[id])) > GRENADE_AIM_TOLERANCE || Math.abs(Actors.aimPitch[id] - this.throwPitch[id]) > GRENADE_AIM_TOLERANCE) return;
    Bots.press(id, BTN.GRENADE);
    this.cookUntil[id] = now + this.throwCook[id] + TICK_SECONDS;
    this.throwUntil[id] = this.cookUntil[id] + TICK_SECONDS;
    this.uses.grenades++;
  },
  cookThrow(id, now) {
    if (now < this.cookUntil[id]) { Bots.press(id, BTN.GRENADE); return; }
    this.cookUntil[id] = 0;
    this.throwUntil[id] = 0;
  },
  clusterAround(id, target) {
    let count = 0;
    for (let other = 0; other < Actors.count; other++) {
      if (!BotSense.sees(id, other)) continue;
      if (length2(Actors.x[other] - Actors.x[target], Actors.z[other] - Actors.z[target]) < GRENADE_CLUSTER) count++;
    }
    return count;
  },
  // Placed and deployed gadgets (BTN.GADGET) by BOT_GADGET_USE; a gadget that finds no room is simply not placed.
  tryGadget(id, now) {
    const pace = kitPace(id);
    this.gadgetAt[id] = now + KIT_CHECK_INTERVAL / pace;
    const row = carriedRow(id, Gadgets.gadget[id]);
    if (!row || !botUseWanted(id, BOT_GADGET_USE[row.effect])) return;
    this.gadgetAt[id] = now + GADGET_INTERVAL / pace;
    Bots.press(id, BTN.GADGET);
    this.uses.gadgets++;
  },
  // Ability slots by their row's botUse { when, range, chance }; an ultimate aimed at enemies also by BOT-035 (2+ enemies
  // in sight, or the objective contested). Passive and self-firing (ult) rows need no press; ready() is false while one
  // runs, so a toggle or channel is never pressed off by mistake.
  tryAbilities(id, now) {
    const pace = kitPace(id);
    this.abilityAt[id] = now + KIT_CHECK_INTERVAL / pace;
    for (let slot = 0; slot < PRESSABLE_SLOTS; slot++) {
      const row = Abilities.row(id, slot);
      if (!row || row.activation === 'passive' || row.activation === 'ult' || !Abilities.ready(id, slot)) continue;
      if (row.activation === 'channel' && !BotDecide.holding(id)) continue;   // a channel roots the body: only where the bot stays
      if (!botUseWanted(id, row.botUse) && !(slot === SLOT.ULTIMATE && ultimateWanted(id, row.botUse))) continue;
      Bots.press(id, SLOT_BUTTONS[slot]);
      this.abilityAt[id] = now + ABILITY_INTERVAL / pace;
      this.uses.abilities++;
      if (row.activation === 'hold') { this.holdSlot[id] = slot; this.holdSlotUntil[id] = now + ABILITY_HOLD_SECONDS; }
      if (row.activation === 'toggle' || row.activation === 'channel') this.switchedOnAt[id * PRESSABLE_SLOTS + slot] = now;
      return;
    }
  },
  // True while a channel runs (the body is rooted: the bot stands still rather than push against it).
  channeling(id) {
    for (let slot = 0; slot < PRESSABLE_SLOTS; slot++) {
      const row = Abilities.row(id, slot);
      if (row && row.activation === 'channel' && Abilities.active[Abilities.index(id, slot)]) return true;
    }
    return false;
  },
  // Toggles and channels stay on until pressed again: off once their trigger ends, at most 4 s on (a channel roots the
  // body: a scout drone flown for ever is a bot standing still). An off press is one tick long; one that did not take is
  // pressed again 0.5 s later, so the button is released in between and every press is a new edge.
  switchOff(id, now) {
    for (let slot = 0; slot < PRESSABLE_SLOTS; slot++) {
      const i = id * PRESSABLE_SLOTS + slot, since = this.switchedOnAt[i];
      if (since < 0 || now - since < ABILITY_MIN_ON || now < this.switchRetryAt[i]) continue;
      const row = Abilities.row(id, slot);
      if (!row || !Abilities.active[Abilities.index(id, slot)]) { this.switchedOnAt[i] = -1; continue; }
      if (now - since < ABILITY_KEEP_SECONDS && triggerHolds(id, row.botUse)) continue;
      Bots.press(id, SLOT_BUTTONS[slot]);
      this.switchRetryAt[i] = now + ABILITY_MIN_ON;
    }
  },
  // A 'hold' ability stays on while its button is held: held while the trigger lasts (at most 3 s).
  keepHolding(id, now) {
    const slot = this.holdSlot[id];
    if (slot < 0) return;
    const row = Abilities.row(id, slot);
    if (now > this.holdSlotUntil[id] || !row || !triggerHolds(id, row.botUse)) { this.holdSlot[id] = -1; return; }
    Bots.press(id, SLOT_BUTTONS[slot]);
  },
  // A seen enemy mine is passed crouched when crouching keeps it quiet, else steered around; an enemy grenade heard
  // landing close is run from until its fuse is likely over (14b keeps both).
  avoidHazards(id, now) {
    if (BotMove.ownsView(id)) return;
    if (now < BotSense.dangerUntil[id]) { Bots.wish(id, Actors.x[id] - BotSense.dangerX[id], Actors.z[id] - BotSense.dangerZ[id], 1); return; }
    const device = BotSense.mine[id];
    if (device < 0 || !Devices.active[device]) return;
    const row = CAT.gadgets[Devices.row[device]], clear = row.trigger + HAZARD_CLEARANCE;
    const distance = Math.max(length2(Actors.x[id] - Devices.x[device], Actors.z[id] - Devices.z[device]), 1e-3);
    if (distance > row.trigger + HAZARD_LOOKAHEAD) return;
    if (row.crouchSafe) { if (distance <= clear) Bots.press(id, BTN.CROUCH); return; }
    this.steerAround(id, device, clear, distance);
  },
  // Bends a path that runs into the ring of `clear` m around a device: a sidestep along the ring that outweighs the path,
  // pushed out while inside the ring, until the path direction clears it. The side is the one the bot stands on as seen
  // from its destination (the path itself swings back to waypoints by the device, which would flip it every tick).
  steerAround(id, device, clear, distance) {
    const awayX = (Actors.x[id] - Devices.x[device]) / distance, awayZ = (Actors.z[id] - Devices.z[device]) / distance;
    const pathX = Bots.wishX[id] * Bots.wishAmount[id], pathZ = Bots.wishZ[id] * Bots.wishAmount[id];
    const toward = -(pathX * awayX + pathZ * awayZ), across = pathX * awayZ - pathZ * awayX;
    const inside = distance < clear;
    if (!inside && (toward <= 0 || Math.abs(across) * distance >= clear)) return;   // moving away, or the path clears the ring
    const goalX = BotMove.destX[id] - Actors.x[id], goalZ = BotMove.destZ[id] - Actors.z[id];
    const side = goalX * awayZ - goalZ * awayX >= 0 ? 1 : -1, push = inside ? HAZARD_PUSH_WEIGHT : 0;
    const tangentX = awayZ * side, tangentZ = -awayX * side;
    Bots.wish(id, pathX + tangentX * HAZARD_TANGENT_WEIGHT + awayX * push, pathZ + tangentZ * HAZARD_TANGENT_WEIGHT + awayZ * push, 1);
  },

  // ---- Bookkeeping from events: hit-rate caps (BOT-093), the fairness record (ARC-033), the player's weapon use ----
  onFire(event) {
    const id = event.id;
    if (id < 0 || id >= MAX_ACTORS) return;
    if (Actors.kind[id] === ACTOR_KIND.PLAYER) { const weapon = CAT.weapons.byId(event.weapon); if (weapon) this.playerShots[weapon.index]++; return; }
    if (!Bots.active[id] || event.mode === 'melee') return;
    this.recordFairness(id);
    const weapon = CAT.weapons.byId(event.weapon);
    if (!weapon || event.mode !== 'primary' || weapon.primary.type !== 'hitscan') return;
    this.totalShots[id]++;
    this.windowShots[id]++;
    this.rollWindow(id);
    this.adjustBoost(id);
  },
  recordFairness(id) {
    this.fairness.shots++;
    if (Sim.time <= this.licenseUntil[id] + TIME_EPSILON) return;
    this.fairness.unperceived++;
    const target = this.licenseTarget[id] >= 0 ? this.licenseTarget[id] : this.target[id];
    if (target < 0 || !BotSense.knows(id, target, Sim.time)) this.fairness.unknown++;
  },
  onDamage(event) {
    const id = event.source;
    if (id < 0 || id >= MAX_ACTORS || !Bots.active[id] || event.target === id || this.lastHitTick[id] === Sim.tick) return;
    const weapon = CAT.weapons.byId(event.weapon);
    if (!weapon || weapon.primary.type !== 'hitscan') return;
    this.lastHitTick[id] = Sim.tick;   // pellets of one shot count once
    this.totalHits[id]++;
    this.windowHits[id]++;
  },
  rollWindow(id) {
    if (Sim.time - this.windowStart[id] < HIT_WINDOW) return;
    this.windowShots[id] *= 0.5; this.windowHits[id] *= 0.5;
    this.windowStart[id] = Sim.time - HIT_WINDOW / 2;
  },
  // BOT-093: above the tier's cap the aim error grows until the rate is back under it; it relaxes slowly below.
  adjustBoost(id) {
    if (this.windowShots[id] < HIT_MIN_SHOTS) return;
    const rate = this.hitRate(id), cap = Bots.tier(id).hitCap;
    if (rate > cap) this.errorBoost[id] = Math.min(HIT_BOOST_MAX, this.errorBoost[id] + HIT_BOOST_UP);
    else if (rate < cap * HIT_RELAX) this.errorBoost[id] = Math.max(1, this.errorBoost[id] - HIT_BOOST_DOWN);
  },
  mostUsedPlayerWeapon() {
    let best = -1, shots = 0;
    for (let index = 0; index < WEAPON_COUNT; index++) if (this.playerShots[index] > shots) { shots = this.playerShots[index]; best = index; }
    return best >= 0 ? CAT.weapons[best].id : '';
  },
};

const noiseOut = { yaw: 0, pitch: 0 };
// Share of the weapon's aim punch a bot pulls down against: grows with the tier, scaled by the spray-control trait.
function recoilControl(id) {
  const tierShare = Bots.tier(id).tier / Math.max(1, BOT_TIER_COUNT - 1);
  const share = lerp(RECOIL_CONTROL_MIN, 1, tierShare) * (RECOIL_TRAIT_LOW + RECOIL_TRAIT_RANGE * Bots.trait(id, TRAIT.sprayControl));
  return clamp(share, 0, 1);
}

// Triggers fired by separate presses (BOT-031 fire throttling: wait for the punch to settle between taps).
function tapped(mode) { return mode.trigger === 'semi' || mode.trigger === 'burst'; }

function noiseSample() { return clamp(Rng.bots.gauss() * AIM_NOISE_SPREAD, -AIM_NOISE_LIMIT, AIM_NOISE_LIMIT); }

// BOT-034 throw solver: the low-arc view pitch whose real overhand throw (GADGET_TUNING speed along the view plus lift,
// from the eye, under bodyGravity) lands `distance` m away and `rise` m higher. The flight of one pitch is closed-form
// (throwRange); the pitch is found by bisection, since the fixed upward lift leaves no closed form for it. The range
// rises with the pitch up to THROW_PITCH_TOP (the low arc); out of reach gives the top pitch. throwFlight keeps the
// flight time (the cook waits out the rest of the fuse).
let throwFlight = 0;
function solveThrowPitch(distance, rise) {
  let low = -THROW_PITCH_TOP, high = THROW_PITCH_TOP;
  if (throwRange(high, rise) < distance) return high;
  for (let step = 0; step < THROW_SOLVE_STEPS; step++) {
    const middle = (low + high) / 2;
    if (throwRange(middle, rise) < distance) low = middle;
    else high = middle;
  }
  throwRange(high, rise);
  return high;
}

// Flat distance a throw at view `pitch` covers until it is `rise` m above the eye on the way down (0 if never); sets throwFlight.
function throwRange(pitch, rise) {
  const speed = GADGET_TUNING.throwSpeed, gravity = bodyGravity();
  const up = Math.sin(pitch) * speed + GADGET_TUNING.throwLift, across = Math.cos(pitch) * speed;
  const reach = up * up - 2 * gravity * rise;
  throwFlight = reach < 0 ? 0 : (up + Math.sqrt(reach)) / gravity;
  return across * throwFlight;
}

// botUse { when, range [min, max], chance }: the trigger holds, the target (when the bot has one) is in range (max 0 = any),
// the bot's tier reaches the row's tier (when it has one), and the per-check chance passes.
function botUseWanted(id, use) {
  if (!use || use.chance <= 0 || (use.tierFlag && !Bots.tier(id)[use.tierFlag])) return false;
  if (!triggerHolds(id, use) || !inUseRange(id, use.range)) return false;
  return Rng.bots.chance(use.chance);
}

function triggerHolds(id, use) {
  const trigger = use ? BOT_USE_TRIGGERS[use.when] : null;
  return !!trigger && trigger(id);
}

function inUseRange(id, range) {
  if (!range || range[1] <= 0 || BotCombat.target[id] < 0) return true;
  const distance = BotCombat.targetDistance(id);
  return distance >= range[0] && distance <= range[1];
}

// BOT-035 for an ultimate whose botUse aims it at enemies (in its own range): 2+ enemies in sight, or the objective is
// contested. Escape and self-buff ultimates keep their own trigger.
function ultimateWanted(id, use) {
  if (!use || !ULTIMATE_ENEMY_TRIGGERS.includes(use.when) || !inUseRange(id, use.range)) return false;
  return BotCombat.visibleEnemies(id) >= ULTIMATE_TARGETS || BOT_USE_TRIGGERS.objective(id);
}

// Kit checks run faster with the abilityUse trait: 0.5x .. 1.5x the base pace.
function kitPace(id) { return 0.5 + Bots.trait(id, TRAIT.abilityUse); }

// The gadget row an actor carries at least one of (Gadgets.grenade / Gadgets.gadget index), else null.
function carriedRow(id, index) {
  if (index < 0) return null;
  const row = CAT.gadgets[index];
  return Gadgets.countOf(id, row.id) > 0 ? row : null;
}

// An actor every opponent hunts (BOT_HUNTED_ROLES: marked, or carrying a prize drawn for everyone).
const BOT_HUNTED_ROLE_FLAGS = Uint8Array.from(ACTOR_ROLE_NAMES, (name) => (BOT_HUNTED_ROLES.includes(name) ? 1 : 0));
function huntedRole(id) { return BOT_HUNTED_ROLE_FLAGS[Modes.actorRole[id]] === 1 && !(Actors.flags[id] & ACTOR_FLAG.INVISIBLE); }

// ---- MUT-003: the mutator rules bots adapt to (Mutators.fx = rules.fx, null without mutators) ----
function headOnlyRules() { return !!(Mutators.fx && Mutators.fx.headOnly); }
function airborneOnlyRules() { return !!(Mutators.fx && Mutators.fx.airborneOnly); }
// Sky duel: shots only hurt airborne targets, so a bot fires at a grounded one only with splash (the blast lifts it).
function worthShooting(target, weapon) {
  if (!airborneOnlyRules() || !(Actors.flags[target] & ACTOR_FLAG.ON_GROUND)) return true;
  return !!weapon.primary.splash;
}
// One-shot rules: every hit kills, so dodging matters more (still capped at 60%, BOT-033).
function dodgeChance(id) {
  const tier = Bots.tier(id);
  if (!(Mutators.fx && Mutators.fx.oneHit)) return tier.dodgeChance;
  const floor = tier.tier >= ONE_HIT_DODGE_TIER ? ONE_HIT_DODGE_FLOOR : 0;
  return Math.min(DODGE_CHANCE_CAP, Math.max(floor, tier.dodgeChance * ONE_HIT_DODGE_SCALE));
}

Bus.on('weapon.fire', (event) => BotCombat.onFire(event));
Bus.on('damage', (event) => BotCombat.onDamage(event));
Bus.on('match.setup', () => {
  BotCombat.playerShots.fill(0); BotCombat.totalShots.fill(0); BotCombat.totalHits.fill(0);
  BotCombat.uses.abilities = 0; BotCombat.uses.grenades = 0; BotCombat.uses.gadgets = 0; BotCombat.uses.weaponJumps = 0;
});
