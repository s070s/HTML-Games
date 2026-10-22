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
const RECOIL_CONTROL_MIN = 0.3;         // BT0 pulls against 30% of the punch, BT7 all of it...
const RECOIL_TRAIT_LOW = 0.75, RECOIL_TRAIT_RANGE = 0.5;   // ...times 0.75..1.25 by the spray-control trait
const FIRE_ALIGN_DEG = 2.5;             // fire when the view is this close to the wanted aim (plus a share of the error)
const FIRE_ALIGN_ERROR_SHARE = 0.3;
const FIRE_RANGE_SLACK = 1.6;           // shoot up to botPref max range x this
const FIRE_HOLD_DEFAULT = 0.5;          // s a charge or release trigger is held
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
const GRENADE_MIN = 8, GRENADE_MAX = 25, GRENADE_SPEED = 18, GRENADE_LIFT = 5;   // GAD-002 throw: 18 m/s + 5 up
const GRENADE_RECENT = 3, GRENADE_CLUSTER = 4, GRENADE_INTERVAL = 4;
const ABILITY_INTERVAL = 1.5;           // s between ability checks at abilityUse 0.5 (faster with the trait)
const ABILITY_CLOSE = 10, ALLY_HURT = 0.5, SELF_HURT = 0.5, ALLY_RANGE = 15;

const aimPoint = Vec.make();
const gadgetView = { grenade: '', grenadeCount: 0, gadget: '', gadgetCount: 0, gadgetCooldown: 0 };
const abilityView = { slots: [], meter: { kind: 'none', value: 0, ready: false } };
const ABILITY_BUTTONS = [BTN.ABILITY1, BTN.ABILITY2];

// Bot-use triggers (ABL-003, BOT-035): an ability or gadget row's botUse names one of these; each tests only what the bot perceives.
const BOT_USE_TRIGGERS = {
  always: () => true,
  selfHurt: (id) => Actors.health[id] < Actors.maxHealth[id] * SELF_HURT,
  enemyVisible: (id) => BotCombat.targetVisible(id),
  enemyClose: (id) => BotCombat.targetVisible(id) && BotCombat.targetDistance(id) < ABILITY_CLOSE,
  enemiesClustered: (id) => BotCombat.visibleEnemies(id) >= 2,
  allyHurt: (id) => BotCombat.hurtAllyNear(id),
  moving: (id) => Bots.wishAmount[id] > 0.5 && BotCombat.target[id] < 0,
  objective: (id) => BotDecide.goal[id] === GOAL.OBJECTIVE && BotDecide.contested(id),
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
  weaponCheckAt: new Float64Array(MAX_ACTORS), wantedWeapon: new Int16Array(MAX_ACTORS).fill(-1), slotPressAt: new Float64Array(MAX_ACTORS),
  reloadPressAt: new Float64Array(MAX_ACTORS), meleeAt: new Float64Array(MAX_ACTORS), grenadeAt: new Float64Array(MAX_ACTORS), abilityAt: new Float64Array(MAX_ACTORS),
  playerShots: new Uint32Array(WEAPON_COUNT),            // the player's shots per weapon (B24's favourite = the most used)
  fairness: { shots: 0, unperceived: 0, unknown: 0 },    // ARC-033: every bot shot is at an enemy it sees (unknown = never perceived)

  reset(id) {
    this.target[id] = -1; this.errorBoost[id] = 1; this.windowShots[id] = 0; this.windowHits[id] = 0; this.windowStart[id] = Sim.time;
    this.holdSince[id] = -1; this.wantedWeapon[id] = -1; this.weaponCheckAt[id] = 0; this.dodgeUntil[id] = 0; this.dodgeAt[id] = 0;
    this.noiseStart[id] = -1e9; this.trackStart[id] = Sim.time; this.strafeCheckAt[id] = 0;
    // Sim.time starts again at 0 every match: no clock of an earlier match may block this one.
    this.reloadPressAt[id] = 0; this.slotPressAt[id] = 0; this.meleeAt[id] = 0; this.grenadeAt[id] = 0; this.abilityAt[id] = 0;
  },
  targetVisible(id) { const target = this.target[id]; return target >= 0 && BotSense.sees(id, target); },
  targetDistance(id) {
    const target = this.target[id];
    return target < 0 ? Infinity : Math.hypot(Actors.x[target] - Actors.x[id], Actors.y[target] - Actors.y[id], Actors.z[target] - Actors.z[id]);
  },
  hitRate(id) { return this.windowShots[id] > 0 ? this.windowHits[id] / this.windowShots[id] : 0; },

  update(id, dt, now) {
    if (Bots.lastPerceive[id] === now || !this.validTarget(id, this.target[id], now)) this.chooseTarget(id, now);
    const target = this.target[id];
    this.manageWeapon(id, now);
    if (target < 0) { this.lookAtThreat(id, now); this.holdSince[id] = -1; return; }
    if (BotSense.sees(id, target)) this.engage(id, target, now);
    else this.watch(id, target);
    this.useGadgets(id, now);
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
    const distance = Math.hypot(BotSense.knownX[pair] - Actors.x[id], BotSense.knownZ[pair] - Actors.z[id]);
    let score = (visible ? TARGET_VISIBLE_SCORE : TARGET_KNOWN_SCORE) / (1 + distance / TARGET_DISTANCE_SCALE);
    if (other === this.target[id]) score += Bots.tier(id).targetSwitch ? TARGET_KEEP_SWITCHER : TARGET_KEEP;
    if (BotSense.attacker[id] === other && now - BotSense.attackedAt[id] < TARGET_REVENGE_SECONDS) score += Bots.trait(id, TRAIT.vengefulness);
    if (BotDecide.carriesObjective(other)) score += TARGET_CARRIER_BONUS;
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
      if (Math.hypot(Actors.x[other] - Actors.x[id], Actors.z[other] - Actors.z[id]) < ALLY_RANGE) return true;
    }
    return false;
  },
  // Hit but nothing in sight: turn toward where the hit came from.
  lookAtThreat(id, now) {
    const attacker = BotSense.attacker[id];
    if (attacker < 0 || now - BotSense.attackedAt[id] > TARGET_REVENGE_SECONDS) return;
    const pair = BotSense.pair(id, attacker);
    Bots.lookAt(id, BotSense.knownX[pair], BotSense.knownY[pair] + AIM_CHEST_HEIGHT, BotSense.knownZ[pair]);
  },
  watch(id, target) {
    const pair = BotSense.pair(id, target);
    Bots.lookAt(id, BotSense.knownX[pair], BotSense.knownY[pair] + AIM_CHEST_HEIGHT, BotSense.knownZ[pair]);
    this.holdSince[id] = -1;
  },

  // ---- Aim model (BOT-030) and the trigger ----
  engage(id, target, now) {
    const weapon = Weapons.currentWeapon(id);
    this.aimPoint(id, target, weapon, aimPoint);
    const error = this.aimError(id, target, now);
    const noise = this.noise(id, now);
    const dx = aimPoint.x - Actors.x[id], dy = aimPoint.y - Actors.eyeY(id), dz = aimPoint.z - Actors.z[id];
    const spray = recoilControl(id) * DEG;   // BOT-031 recoil control by tier and spray trait
    Bots.lookYaw[id] = Math.atan2(dx, dz) + error * noise.yaw * DEG - Weapons.recoilYaw[id] * spray;
    Bots.lookPitch[id] = Math.atan2(dy, Math.hypot(dx, dz)) + error * noise.pitch * AIM_PITCH_SHARE * DEG - Weapons.recoilPitch[id] * spray;
    if (this.mayFire(id, target, weapon, error, Math.hypot(dx, dy, dz), now)) this.pullTrigger(id, weapon, now);
    else this.holdSince[id] = -1;
    if (weapon && Math.hypot(dx, dz) < MELEE_DISTANCE && weapon.class !== 'melee' && now >= this.meleeAt[id]) { Bots.press(id, BTN.MELEE); this.meleeAt[id] = now + MELEE_INTERVAL; }
  },
  // Head from tier 4 with precise weapons (BOT-031), feet for splash at aim skill > 0.6, lead for projectiles (BOT-030).
  aimPoint(id, target, weapon, out) {
    const mode = weapon ? weapon.primary : null, tier = Bots.tier(id), skill = Bots.trait(id, TRAIT.aimSkill);
    Hitbox.point(target, tier.headAim && mode && mode.type === 'hitscan' && !mode.splash ? ZONE.HEAD : ZONE.BODY, out);
    if (mode && mode.splash && skill > AIM_FEET_SKILL) out.y = Actors.y[target] + AIM_FEET_HEIGHT;
    const speed = mode && mode.type === 'projectile' ? this.projectileSpeed(mode) : 0;
    if (!speed || !tier.lead || skill <= AIM_LEAD_LINEAR) return out;
    const passes = skill > AIM_LEAD_EXACT ? 2 : 1;   // exact: refine the flight time once; linear: one estimate
    const startX = out.x, startY = out.y, startZ = out.z;
    for (let pass = 0; pass < passes; pass++) {
      const time = Math.hypot(out.x - Actors.x[id], out.y - Actors.eyeY(id), out.z - Actors.z[id]) / speed;
      out.x = startX + Actors.vx[target] * time; out.z = startZ + Actors.vz[target] * time; out.y = startY + this.dropFor(mode, time);
    }
    return out;
  },
  projectileSpeed(mode) {
    if (mode.speed > 0) return mode.speed;
    const row = CAT.projectiles.byId(mode.projectile);
    return row ? row.speed : 0;
  },
  dropFor(mode, time) {
    const row = CAT.projectiles.byId(mode.projectile);
    return row ? 0.5 * row.gravity * time * time : 0;
  },
  // error = tier error x (1 - accuracy x 0.5) x (1 + target speed/10) x (1 + own speed/10) x settle x difficulty x hit-cap boost.
  aimError(id, target, now) {
    const tier = Bots.tier(id);
    const targetSpeed = Math.hypot(Actors.vx[target], Actors.vz[target]), ownSpeed = Math.hypot(Actors.vx[id], Actors.vz[id]);
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
    if (distance > weapon.primary.range || distance > weapon.botPref.range[1] * FIRE_RANGE_SLACK + MELEE_DISTANCE) return false;
    const yawOff = Math.abs(wrapAngle(Bots.lookYaw[id] - Actors.aimYaw[id])), pitchOff = Math.abs(Bots.lookPitch[id] - Actors.aimPitch[id]);
    return Math.hypot(yawOff, pitchOff) <= (FIRE_ALIGN_DEG + error * FIRE_ALIGN_ERROR_SHARE) * DEG;
  },
  // auto/beam: hold; semi/burst: press every other tick; charge/release: hold, then let go.
  pullTrigger(id, weapon, now) {
    const mode = weapon.primary;
    if (mode.trigger === 'charge' || mode.trigger === 'release') { this.holdThenRelease(id, mode, now); return; }
    if (mode.trigger === 'semi' || mode.trigger === 'burst') {
      this.fireToggle[id] ^= 1;
      if (this.fireToggle[id]) Bots.press(id, BTN.FIRE);
      return;
    }
    Bots.press(id, BTN.FIRE);
  },
  holdThenRelease(id, mode, now) {
    if (this.holdSince[id] < 0) this.holdSince[id] = now;
    const hold = mode.charge ? mode.charge.time : mode.lock ? mode.lock.time : FIRE_HOLD_DEFAULT;
    if (now - this.holdSince[id] < hold) { Bots.press(id, BTN.FIRE); return; }
    this.holdSince[id] = -1;   // released this tick: the shot goes
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
    if (target < 0 || !BotSense.sees(id, target) || BotMove.onLadder(id)) return;
    const tier = Bots.tier(id);
    if (tier.combatMove === 'walk' && now >= this.dodgeUntil[id]) { Bots.wishAmount[id] *= 0.5; return; }
    this.overlaid[id] = 1;
    if (now < this.dodgeUntil[id]) { this.dodge(id, target); return; }
    if (tier.combatMove === 'stand') { if (Bots.state[id] === BOT_STATE.ENGAGE) Bots.wish(id, 0, 0, 0); return; }
    this.strafe(id, target, tier, now);
  },
  strafe(id, target, tier, now) {
    if (now >= this.strafeCheckAt[id]) this.strafeCheck(id, tier, now);
    const dx = Actors.x[target] - Actors.x[id], dz = Actors.z[target] - Actors.z[id], distance = Math.hypot(dx, dz) || 1;
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
    Bots.wish(id, pathX + backX - towardZ * side, pathZ + backZ + towardX * side, 1);
  },
  strafeCheck(id, tier, now) {
    this.strafeCheckAt[id] = now + STRAFE_CHECK;
    if (Rng.bots.chance(STRAFE_FLIP * (0.5 + Bots.trait(id, TRAIT.strafing)))) this.strafeSide[id] = -this.strafeSide[id];
    if (tier.jumps && Move.isGrounded(id) && Rng.bots.chance(COMBAT_JUMP_CHANCE * Bots.trait(id, TRAIT.jumpiness))) Bots.press(id, BTN.JUMP);
  },
  dodge(id, target) {
    const dx = Actors.x[target] - Actors.x[id], dz = Actors.z[target] - Actors.z[id], distance = Math.hypot(dx, dz) || 1;
    Bots.wish(id, -dz / distance * this.dodgeSide[id], dx / distance * this.dodgeSide[id], 1);
  },
  // BOT-033: a seen enemy projectile on a near-miss course; after the reaction time, a tier chance (<= 60%) to dodge.
  checkDodge(id, now) {
    const chance = Bots.tier(id).dodgeChance;
    if (chance <= 0 || Bots.lastPerceive[id] !== now) return;
    if (this.dodgeAt[id] > 0 && now >= this.dodgeAt[id]) this.rollDodge(id, chance, now);
    if (this.dodgeAt[id] > 0) return;
    for (let i = 0; i < PROJECTILE_CAP; i++) if (Projectiles.state[i] && this.threatens(id, i)) { this.planDodge(id, i, now); return; }
  },
  threatens(id, i) {
    const owner = Projectiles.owner[i];
    if (owner < 0 || owner === id || !Actors.isEnemy(id, owner) || Projectiles.serial[i] === this.dodgeSerial[id]) return false;
    const rx = Actors.x[id] - Projectiles.x[i], ry = Actors.eyeY(id) - 0.6 - Projectiles.y[i], rz = Actors.z[id] - Projectiles.z[i];
    const distance = Math.hypot(rx, ry, rz);
    if (distance > DODGE_RANGE) return false;
    const vx = Projectiles.vx[i], vy = Projectiles.vy[i], vz = Projectiles.vz[i], speed = Math.hypot(vx, vy, vz);
    const closing = (rx * vx + ry * vy + rz * vz) / Math.max(speed, 1e-6);
    if (closing <= 0 || closing / Math.max(speed, 1e-6) > DODGE_HORIZON) return false;
    const missSquared = distance * distance - closing * closing;
    if (missSquared > DODGE_MISS * DODGE_MISS) return false;
    const yaw = Actors.yaw[id], facing = -(Math.sin(yaw) * rx + Math.cos(yaw) * rz) / Math.max(Math.hypot(rx, rz), 1e-6);
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

  // ---- Grenades (BOT-034) and abilities (BOT-035): pressed like a player, only on perceived conditions ----
  useGadgets(id, now) {
    if (!Bots.tier(id).gadgets) return;
    if (now >= this.abilityAt[id]) this.tryAbilities(id, now);
    if (now >= this.grenadeAt[id]) this.tryGrenade(id, now);
  },
  tryGrenade(id, now) {
    this.grenadeAt[id] = now + GRENADE_INTERVAL / (0.5 + Bots.trait(id, TRAIT.abilityUse));
    const target = this.target[id];
    if (target < 0 || Gadgets.hudState(id, gadgetView).grenadeCount <= 0) return;
    const pair = BotSense.pair(id, target), visible = BotSense.visible[pair] === 1;
    const distance = Math.hypot(BotSense.knownX[pair] - Actors.x[id], BotSense.knownZ[pair] - Actors.z[id]);
    const hidden = !visible && now - BotSense.seenAt[pair] < GRENADE_RECENT;
    const cluster = visible && this.clusterAround(id, target) >= 2;
    if (distance < GRENADE_MIN || distance > GRENADE_MAX || !(hidden || cluster) || !BotTeam.takeGrenadeToken(id, now)) return;
    Bots.lookYaw[id] = Math.atan2(BotSense.knownX[pair] - Actors.x[id], BotSense.knownZ[pair] - Actors.z[id]);
    Bots.lookPitch[id] = throwPitch(distance);
    Bots.press(id, BTN.GRENADE);
  },
  clusterAround(id, target) {
    let count = 0;
    for (let other = 0; other < Actors.count; other++) {
      if (!BotSense.sees(id, other)) continue;
      if (Math.hypot(Actors.x[other] - Actors.x[target], Actors.z[other] - Actors.z[target]) < GRENADE_CLUSTER) count++;
    }
    return count;
  },
  tryAbilities(id, now) {
    this.abilityAt[id] = now + ABILITY_INTERVAL / (0.5 + Bots.trait(id, TRAIT.abilityUse));
    Abilities.hudState(id, abilityView);
    const slots = abilityView.slots;
    for (let i = 0; i < slots.length && i < ABILITY_BUTTONS.length; i++) {
      if (slots[i].ready && abilityTriggered(id, slots[i].id)) { Bots.press(id, ABILITY_BUTTONS[i]); return; }
    }
    const ultimate = abilityView.meter.ready && (this.visibleEnemies(id) >= 2 || BOT_USE_TRIGGERS.objective(id));   // BOT-035
    if (ultimate) Bots.press(id, BTN.ULTIMATE);
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
    const target = this.target[id];
    this.fairness.shots++;
    if (target < 0 || !BotSense.sees(id, target)) this.fairness.unperceived++;
    if (target < 0 || (!BotSense.sees(id, target) && !BotSense.knows(id, target, Sim.time))) this.fairness.unknown++;
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

function noiseSample() { return clamp(Rng.bots.gauss() * AIM_NOISE_SPREAD, -AIM_NOISE_LIMIT, AIM_NOISE_LIMIT); }

// Low throw angle that lands a GAD-002 throw (18 m/s, +5 up) at a flat distance (falls back to 45 degrees out of reach).
function throwPitch(distance) {
  const speed = Math.hypot(GRENADE_SPEED, GRENADE_LIFT), sine = GRAVITY * distance / (speed * speed);
  const launch = sine >= 1 ? Math.PI / 4 : 0.5 * Math.asin(sine);
  return launch - Math.atan2(GRENADE_LIFT, GRENADE_SPEED);
}

function abilityTriggered(id, abilityId) {
  const row = CAT.abilities ? CAT.abilities.byId(abilityId) : null;
  const rule = row && typeof row.botUse === 'string' ? BOT_USE_TRIGGERS[row.botUse] : null;
  return rule ? rule(id) : false;
}

Bus.on('weapon.fire', (event) => BotCombat.onFire(event));
Bus.on('damage', (event) => BotCombat.onDamage(event));
Bus.on('match.setup', () => { BotCombat.playerShots.fill(0); BotCombat.totalShots.fill(0); BotCombat.totalHits.fill(0); });
