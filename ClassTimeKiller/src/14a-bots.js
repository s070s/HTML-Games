// ==== S14 BOTS ====
// Bot brains (BOT-001..BOT-100): perception (14b) -> memory -> decision (14e, utility goals with hysteresis) -> state
// execution -> motor (this file). 14c follows nav paths, 14d aims and fights, 14f plays as a team and talks, 14g is the
// F9 debug view. A bot writes ONLY the input fields of Actors (moveX moveZ aimYaw aimPitch buttons slotRequest), like the
// player's input layer (BOT-001), in the Sim system 'botThink' (order 10); every other system treats it like a human.
// Difficulty (DIF-001..DIF-003) builds rules.botSkill at the 'difficulty' rule stage. API: docs/api/bots.md.

const BOT_STATE = { DEAD: 0, SPAWN: 1, ROAM: 2, COLLECT: 3, ENGAGE: 4, CHASE: 5, RETREAT: 6, CAMP: 7, OBJECTIVE: 8, INVESTIGATE: 9, SEARCH: 10, FOLLOW: 11 };
const BOT_STATE_NAMES = Object.keys(BOT_STATE).map((name) => name.toLowerCase());
const TRAIT = {};
CAT.botTraits.forEach((row, index) => { TRAIT[row.id] = index; });
const TRAIT_COUNT = CAT.botTraits.length;
const BOT_TIER_COUNT = CAT.botTiers.length;
const BOT_DEFAULT_DIFFICULTY = 'regular';
const BOT_TRAIT_JITTER = 0.15;          // unnamed bots: seeded +-variation around neutral traits, so no two play alike
const BOT_SPAWN_SETTLE = 0.5;           // BOT-002 Spawn state: the first half second only looks around (no jumps, no shots)
const BOT_DECIDE_INTERVAL = 0.5;        // BOT-090 decision layer 2 Hz
const BOT_PERCEIVE_COMBAT = 1 / 20;     // BOT-090 perception 20 Hz in combat, 10 Hz otherwise...
const BOT_PERCEIVE_NORMAL = 1 / 10;
const BOT_PERCEIVE_FAR = 1 / 5;         // ...PERF-011: beyond 40 m of the player or out of the player's view: 5 Hz
const BOT_LOD_DISTANCE = 40;
const BOT_LOD_VIEW_COS = Math.cos(60 * DEG);   // "visible to the player": inside a 120 degree cone around the view
const BOT_AIM_SPRING = 14;              // rad/s natural frequency of the critically damped look spring (BOT-030)
const BOT_PITCH_LIMIT = 89 * DEG;
const BOT_GRACE_TIER = 2;               // BOT-042: tiers up to this give the player a grace period after a respawn
const BOT_PLAYER_GRACE = 1;             // seconds
const BOT_MIN_ATTACKERS = 1;

// Difficulty presets -> rules.botSkill (frozen with the ruleset). setup.difficulty: a preset id, or
// { preset, <slider field>: value, ... } (custom match, DIF-002 ranges). Live per-save multipliers come from the settings.
Settings.define('difficulty.botReaction', 1, { label: 'Bot reaction time', category: 'gameplay', min: 0.5, max: 2, step: 0.1 });
Settings.define('difficulty.botAimError', 1, { label: 'Bot aim error', category: 'gameplay', min: 0.5, max: 3, step: 0.1 });
Settings.define('difficulty.adaptive', false, { label: 'Adaptive bot skill (+-1 tier per match)', category: 'gameplay' });
Settings.define('difficulty.tierShift', 0, { label: 'Adaptive tier shift', category: 'developer' });   // internal: no min/max, no control
const ADAPTIVE_SHIFT_LIMIT = 3;

const Difficulty = {
  // Preset row merged with custom slider values (clamped to DIF-002). Unknown presets fall back to 'regular' (logged).
  resolve(choice) {
    const custom = choice && typeof choice === 'object' ? choice : null;
    const key = custom ? custom.preset || BOT_DEFAULT_DIFFICULTY : choice || BOT_DEFAULT_DIFFICULTY;
    let row = CAT.difficulty.byId(key);
    if (!row) { ErrorLog.add('difficulty', 'unknown difficulty ' + key + ', using ' + BOT_DEFAULT_DIFFICULTY); row = CAT.difficulty.byId(BOT_DEFAULT_DIFFICULTY); }
    const skill = Object.assign({}, row, { preset: row.id });
    if (custom) this.applySliders(skill, custom);
    if (skill.tierMax < skill.tierMin) skill.tierMax = skill.tierMin;
    return skill;
  },
  applySliders(skill, custom) {
    for (const slider of DIFFICULTY_SLIDERS) {
      if (typeof custom[slider.field] === 'number') skill[slider.field] = clamp(custom[slider.field], slider.min, slider.max);
    }
    if (typeof custom.tierMin === 'number') skill.tierMin = clamp(Math.round(custom.tierMin), 0, BOT_TIER_COUNT - 1);
    if (typeof custom.tierMax === 'number') skill.tierMax = clamp(Math.round(custom.tierMax), 0, BOT_TIER_COUNT - 1);
  },
  // DIF-003 (off by default): after a match against bots, +1 tier when the player won, -1 when the player lost (team
  // modes: the player's team won or lost, a draw changes nothing; free-for-all: first or last); shown on the results.
  adapt(match) {
    if (!Settings.get('difficulty.adaptive') || Game.playerId < 0 || !match.results) return 0;
    const change = matchOutcome(match.results, Game.playerId);
    const shift = clamp(Settings.get('difficulty.tierShift') + change, -ADAPTIVE_SHIFT_LIMIT, ADAPTIVE_SHIFT_LIMIT);
    Settings.set('difficulty.tierShift', shift);
    match.results.botTierChange = change;
    return change;
  },
  tierShift() { return Settings.get('difficulty.adaptive') ? Settings.get('difficulty.tierShift') : 0; },
};

// +1 won, -1 lost, 0 neither (a draw, the middle of a free-for-all ranking, or the player not in the results).
function matchOutcome(results, player) {
  const players = results.players, playerRow = players.findIndex((row) => row.id === player);
  if (playerRow < 0 || players.length < 2) return 0;
  if (results.teams.length > 0) {
    if (results.winnerTeam === NO_TEAM) return 0;
    return players[playerRow].team === results.winnerTeam ? 1 : -1;
  }
  return playerRow === 0 ? 1 : playerRow === players.length - 1 ? -1 : 0;
}

// The difficulty stage: rules.botSkill, and the DIF-002 game speed slider (an ACC-007 assist, every mode) multiplies the mutators' time scale.
Rules.addModifier('difficulty', (rules) => {
  rules.botSkill = Difficulty.resolve(rules.difficulty);
  if (rules.botSkill.gameSpeed === 1) return;
  rules.fx = rules.fx || {};
  rules.fx.timeScale = (rules.fx.timeScale === undefined ? 1 : rules.fx.timeScale) * rules.botSkill.gameSpeed;
});

// DIF-002 damage sliders through their own attacker scale (BOT-040: PvE only, never a bonus for versus bots): hits on
// the player by PvE enemies x playerDamage, hits on PvE enemies by anyone else x enemyDamage.
function difficultyDamageScale(source, target) {
  const skill = Bots.skill;
  if (!skill || source < 0 || source === target) return 1;
  const fromEnemy = Actors.kind[source] === ACTOR_KIND.ENEMY, onEnemy = Actors.kind[target] === ACTOR_KIND.ENEMY;
  if (fromEnemy && Actors.kind[target] === ACTOR_KIND.PLAYER) return skill.playerDamage;
  return onEnemy && !fromEnemy ? skill.enemyDamage : 1;
}
Damage.addAttackerScale(difficultyDamageScale);

const Bots = {
  active: new Uint8Array(MAX_ACTORS),          // 1 = this actor is driven by a brain (BOT kind that spawned)
  tierRow: new Array(MAX_ACTORS).fill(null),
  profile: new Array(MAX_ACTORS).fill(null),   // CAT.bots row or null (Actors.profile stays what S13 stored)
  traits: new Float32Array(MAX_ACTORS * TRAIT_COUNT).fill(BOT_TRAIT_NEUTRAL),
  state: new Uint8Array(MAX_ACTORS), stateSince: new Float64Array(MAX_ACTORS),
  spawnedAt: new Float64Array(MAX_ACTORS).fill(-1e9),   // every actor (BOT-042 grace after the player's respawn)
  nextPerceive: new Float64Array(MAX_ACTORS), nextDecide: new Float64Array(MAX_ACTORS), perceiveDue: new Uint8Array(MAX_ACTORS),
  lastPerceive: new Float64Array(MAX_ACTORS),
  // Execution layer output, turned into Actors input by motor(): wanted world move direction, look angles, buttons.
  wishX: new Float32Array(MAX_ACTORS), wishZ: new Float32Array(MAX_ACTORS), wishAmount: new Float32Array(MAX_ACTORS),
  lookYaw: new Float32Array(MAX_ACTORS), lookPitch: new Float32Array(MAX_ACTORS),
  yawVelocity: new Float32Array(MAX_ACTORS), pitchVelocity: new Float32Array(MAX_ACTORS),
  lastLookYaw: new Float32Array(MAX_ACTORS), lastLookPitch: new Float32Array(MAX_ACTORS),   // feed-forward of a moving aim point
  buttonsWanted: new Uint32Array(MAX_ACTORS), slotWanted: new Int8Array(MAX_ACTORS),
  setupCursor: 0,
  setupShift: 0,                                // Difficulty.tierShift() at match setup (a rematch adds only the later change, 18d)
  anyActive: false,
  skill: null,                                  // rules.botSkill of the match (or the default preset)
  config: { reactionScale: 1, aimErrorScale: 1 },
  stats: { ticks: 0, botTicks: 0 },

  trait(id, index) { return this.traits[id * TRAIT_COUNT + index]; },
  tier(id) { return this.tierRow[id] || CAT.botTiers[0]; },
  isBot(id) { return this.active[id] === 1 && Actors.alive[id] === 1; },
  setState(id, state) {
    if (this.state[id] === state) return;
    this.state[id] = state;
    this.stateSince[id] = Sim.time;
  },

  // ---- Lifecycle ----
  onMatchSetup(match) {
    this.setupCursor = 0;
    this.setupShift = Difficulty.tierShift();
    this.skill = (match.rules && match.rules.botSkill) || Difficulty.resolve(BOT_DEFAULT_DIFFICULTY);
  },
  onCreate(id) {
    this.active[id] = 0;
    this.resetLife(id);
    const kind = Actors.kind[id];
    if (kind !== ACTOR_KIND.BOT && kind !== ACTOR_KIND.DUMMY) return;
    const entry = this.takeSetupEntry();
    if (kind !== ACTOR_KIND.BOT) return;
    const row = rosterRow(Actors.profile[id]);
    this.assign(id, row, this.chooseTier(row, entry));
  },
  // Modes creates bot actors in setup.bots order (dummies included), so the n-th created bot is entry n.
  takeSetupEntry() {
    const setup = Game.match ? Game.match.setup : null;
    const list = setup && setup.bots ? setup.bots : [];
    const entry = this.setupCursor < list.length ? list[this.setupCursor] : null;
    this.setupCursor++;
    return entry || {};
  },
  chooseTier(row, entry) {
    const requested = parseTier(entry.tier);
    if (requested >= 0) return requested;
    if (row) return clamp(row.tier + Difficulty.tierShift(), 0, BOT_TIER_COUNT - 1);
    const skill = this.currentSkill(), span = skill.tierMax - skill.tierMin + 1;
    // Even tier mix over the bots, in pairs: unnamed bots join the two teams in turn, so each team gets the same mix.
    const spread = skill.tierMin + (Math.floor(Math.max(0, this.setupCursor - 1) / TEAM_COUNT) % span);
    return clamp(spread + Difficulty.tierShift(), 0, BOT_TIER_COUNT - 1);
  },
  currentSkill() {
    if (!this.skill) this.skill = Difficulty.resolve(BOT_DEFAULT_DIFFICULTY);
    return this.skill;
  },
  // Profile row (or null = neutral traits with seeded variety) and skill tier.
  assign(id, row, tier) {
    this.profile[id] = row;
    this.tierRow[id] = CAT.botTiers[clamp(tier, 0, BOT_TIER_COUNT - 1)];
    const base = id * TRAIT_COUNT, style = row ? BOT_TRAIT_STYLES[row.style] || {} : {};
    for (let index = 0; index < TRAIT_COUNT; index++) {
      const key = CAT.botTraits[index].id;
      let value = BOT_TRAIT_NEUTRAL + (row ? 0 : Rng.bots.range(-BOT_TRAIT_JITTER, BOT_TRAIT_JITTER));
      if (style[key] !== undefined) value = style[key];
      if (row && row.traits[key] !== undefined) value = row.traits[key];
      this.traits[base + index] = clamp(value, 0, 1);
    }
  },
  setTier(id, tier) {
    if (Actors.kind[id] !== ACTOR_KIND.BOT) return false;
    this.tierRow[id] = CAT.botTiers[clamp(parseTier(tier), 0, BOT_TIER_COUNT - 1)];
    BotMove.configure(id);
    return true;
  },
  onSpawn(id) {
    this.spawnedAt[id] = Sim.time;
    if (Actors.kind[id] !== ACTOR_KIND.BOT) return;
    if (!this.tierRow[id]) this.assign(id, null, this.chooseTier(null, {}));
    this.active[id] = 1;
    this.anyActive = true;
    this.resetLife(id);
    this.lookYaw[id] = this.lastLookYaw[id] = Actors.yaw[id];
    this.lookPitch[id] = this.lastLookPitch[id] = 0;
    this.setState(id, BOT_STATE.SPAWN);
    const stagger = (id % 8) / 8;   // BOT-090: spread the think ticks of the bots over time
    this.nextPerceive[id] = Sim.time + stagger * BOT_PERCEIVE_NORMAL;
    this.nextDecide[id] = Sim.time + BOT_SPAWN_SETTLE + stagger * BOT_DECIDE_INTERVAL;
    this.lastPerceive[id] = Sim.time;
    BotSense.resetBot(id);
    BotMove.reset(id);
    BotMove.configure(id);
    BotCombat.reset(id);
    BotDecide.reset(id);
  },
  resetLife(id) {
    this.wishX[id] = this.wishZ[id] = this.wishAmount[id] = 0;
    this.yawVelocity[id] = this.pitchVelocity[id] = 0;
    this.buttonsWanted[id] = 0; this.slotWanted[id] = 0; this.perceiveDue[id] = 0;
    this.state[id] = BOT_STATE.DEAD;
  },
  onRemove(id) {
    this.active[id] = 0;
    this.tierRow[id] = null;
    this.profile[id] = null;
  },
  onDeath(victim) {
    if (victim < 0 || !this.active[victim]) return;
    this.setState(victim, BOT_STATE.DEAD);
    Actors.buttons[victim] = 0; Actors.moveX[victim] = 0; Actors.moveZ[victim] = 0; Actors.slotRequest[victim] = 0;
  },
  onMatchStop() {
    this.active.fill(0);
    this.anyActive = false;
    this.skill = null;
  },

  // ---- The 'botThink' system (order 10): perception (budgeted), decisions, combat, navigation, motor ----
  step(dt) {
    if (!this.anyActive || (Game.match && Game.match.ended)) return;
    const now = Sim.time;
    this.stats.ticks++;
    this.markPerceptionDue(now);
    BotSense.serve(now);
    BotTeam.step(now);
    for (let id = 0; id < Actors.count; id++) {
      if (!this.isBot(id)) continue;
      this.stats.botTicks++;
      this.think(id, dt, now);
    }
  },
  markPerceptionDue(now) {
    for (let id = 0; id < Actors.count; id++) {
      if (this.isBot(id) && now + TIME_EPSILON >= this.nextPerceive[id]) this.perceiveDue[id] = 1;
    }
  },
  // Called by 14b after a bot's perception pass: schedules the next one by combat and level of detail (PERF-011).
  schedulePerception(id, now) {
    const combat = BotCombat.target[id] >= 0;
    const near = this.nearPlayer(id);
    const interval = combat ? (near ? BOT_PERCEIVE_COMBAT : BOT_PERCEIVE_NORMAL) : (near ? BOT_PERCEIVE_NORMAL : BOT_PERCEIVE_FAR);
    this.lastPerceive[id] = now;
    this.nextPerceive[id] = now + interval;
    this.perceiveDue[id] = 0;
  },
  // PERF-011: near = within 40 m of the local player and inside the player's view. Without a player (headless) every
  // bot counts as near while it fights, so bot-only matches still run combat at full rate.
  nearPlayer(id) {
    const player = Game.playerId;
    if (player < 0 || !Actors.alive[player]) return BotCombat.target[id] >= 0;
    const dx = Actors.x[id] - Actors.x[player], dy = Actors.y[id] - Actors.y[player], dz = Actors.z[id] - Actors.z[player];
    const distance = Math.hypot(dx, dy, dz);
    if (distance > BOT_LOD_DISTANCE) return false;
    if (distance < 1) return true;
    const forward = Math.sin(Actors.yaw[player]) * dx + Math.cos(Actors.yaw[player]) * dz;
    return forward / distance >= BOT_LOD_VIEW_COS;
  },
  think(id, dt, now) {
    this.buttonsWanted[id] = 0;
    this.slotWanted[id] = 0;
    if (this.state[id] === BOT_STATE.SPAWN && now - this.stateSince[id] < BOT_SPAWN_SETTLE) { this.settle(id, dt); return; }
    if (Actors.flags[id] & ACTOR_FLAG.FROZEN) { this.settle(id, dt); return; }   // freeze / buy time (S13): wait
    if (now + TIME_EPSILON >= this.nextDecide[id]) BotDecide.decide(id, now);
    BotCombat.update(id, dt, now);
    if (Actors.flags[id] & ACTOR_FLAG.DOWNED) { this.settle(id, dt); return; }   // HP-007: wait for the reviver, still aiming and firing
    BotMove.update(id, dt, now);
    BotCombat.overlayMovement(id, dt, now);
    BotCombat.avoidHazards(id, now);
    if (BotCombat.channeling(id)) this.wish(id, 0, 0, 0);
    BotDecide.act(id, dt, now);
    BotTeam.updateBot(id, now);
    this.motor(id, dt);
  },
  // Spawn state and frozen rounds: stand still and look along the facing; perception already runs.
  settle(id, dt) {
    this.wishAmount[id] = 0;
    this.motor(id, dt);
  },

  // ---- Motor: look spring with the tier's turn-rate cap (no instant turns, BOT-040), then the move axes ----
  motor(id, dt) {
    this.turn(id, dt);
    const yaw = Actors.aimYaw[id], amount = this.wishAmount[id] * this.tier(id).speed;
    const wx = this.wishX[id] * amount, wz = this.wishZ[id] * amount;
    // DATA-002: forward (sin yaw, 0, cos yaw), right (-cos yaw, 0, sin yaw)
    Actors.moveZ[id] = wx * Math.sin(yaw) + wz * Math.cos(yaw);
    Actors.moveX[id] = -wx * Math.cos(yaw) + wz * Math.sin(yaw);
    Actors.buttons[id] = this.buttonsWanted[id];
    Actors.slotRequest[id] = this.slotWanted[id];
  },
  turn(id, dt) {
    const limit = this.tier(id).turn * DEG;
    const lookPitch = clamp(this.lookPitch[id], -BOT_PITCH_LIMIT, BOT_PITCH_LIMIT);
    const yawError = wrapAngle(this.lookYaw[id] - Actors.aimYaw[id]), pitchError = lookPitch - Actors.aimPitch[id];
    const yawFeed = lookRate(wrapAngle(this.lookYaw[id] - this.lastLookYaw[id]), limit, dt), pitchFeed = lookRate(lookPitch - this.lastLookPitch[id], limit, dt);
    this.lastLookYaw[id] = this.lookYaw[id]; this.lastLookPitch[id] = lookPitch;
    this.yawVelocity[id] = springVelocity(this.yawVelocity[id], yawError, yawFeed, limit, dt);
    this.pitchVelocity[id] = springVelocity(this.pitchVelocity[id], pitchError, pitchFeed, limit, dt);
    Actors.aimYaw[id] = wrapAngle(Actors.aimYaw[id] + this.yawVelocity[id] * dt);
    Actors.aimPitch[id] = clamp(Actors.aimPitch[id] + this.pitchVelocity[id] * dt, -BOT_PITCH_LIMIT, BOT_PITCH_LIMIT);
  },
  // Look at a world point from the bot's eye (sets the wanted look angles; the motor turns toward them).
  lookAt(id, x, y, z) {
    const dx = x - Actors.x[id], dy = y - Actors.eyeY(id), dz = z - Actors.z[id];
    this.lookYaw[id] = Math.atan2(dx, dz);
    this.lookPitch[id] = Math.atan2(dy, Math.hypot(dx, dz));
  },
  press(id, bits) { this.buttonsWanted[id] |= bits; },
  // Wanted world-space move direction (normalized here) and amount 0..1.
  wish(id, dx, dz, amount) {
    const length = Math.hypot(dx, dz);
    if (length < 1e-6 || amount <= 0) { this.wishAmount[id] = 0; return; }
    this.wishX[id] = dx / length; this.wishZ[id] = dz / length; this.wishAmount[id] = Math.min(1, amount);
  },
  // The player-facing reaction / aim settings times the match difficulty (DIF-002).
  reactionScale() { return this.currentSkill().reactionScale * this.config.reactionScale; },
  aimErrorScale() { return this.currentSkill().aimErrorScale * this.config.aimErrorScale; },
  // BOT-042: low tiers give the player a short grace after the player's respawn.
  inGrace(id, target) {
    return Actors.kind[target] === ACTOR_KIND.PLAYER && this.tier(id).tier <= BOT_GRACE_TIER && Sim.time - this.spawnedAt[target] < BOT_PLAYER_GRACE;
  },
  maxAttackers() { return Math.max(BOT_MIN_ATTACKERS, this.currentSkill().attackers); },
  readSettings(key) {
    if (key === 'difficulty.botReaction') this.config.reactionScale = Settings.get(key);
    if (key === 'difficulty.botAimError') this.config.aimErrorScale = Settings.get(key);
  },
};

// Critically damped spring toward the error (BOT-030 "critically damped spring smoothing"), speed capped by the turn rate.
// The spring works on the speed relative to the moving look point (feed), so a tracked target does not trail behind.
function springVelocity(velocity, error, feed, limit, dt) {
  const relative = velocity - feed;
  const next = relative + (BOT_AIM_SPRING * BOT_AIM_SPRING * error - 2 * BOT_AIM_SPRING * relative) * dt;
  return clamp(next + feed, -limit, limit);
}

// How fast the wanted look angle moves (rad/s); a jump faster than the turn cap (a new target) is no motion to follow.
function lookRate(change, limit, dt) {
  const rate = change / dt;
  return Math.abs(rate) > limit ? 0 : rate;
}

// The roster row behind an actor profile (S13 stores the CAT.bots row of setup.bots[n].profile), else null.
function rosterRow(profile) {
  if (!profile || typeof profile !== 'object') return null;
  return CAT.bots.byId(profile.id) === profile ? profile : null;
}

// Tier from a number (0..7), a code ('BT3') or a key ('skilled'); -1 when not given or unknown.
function parseTier(value) {
  if (typeof value === 'number' && value >= 0) return clamp(Math.round(value), 0, BOT_TIER_COUNT - 1);
  if (typeof value !== 'string') return -1;
  const row = CAT.botTiers.find((tier) => tier.code === value || tier.id === value);
  return row ? row.tier : -1;
}

Bus.on('match.setup', (match) => Bots.onMatchSetup(match));
Bus.on('match.stop', () => Bots.onMatchStop());
Bus.on('match.end', (match) => Difficulty.adapt(match));
Bus.on('actor.create', (id) => Bots.onCreate(id));
Bus.on('actor.spawn', (event) => Bots.onSpawn(event.id));
Bus.on('actor.remove', (id) => Bots.onRemove(id));
Bus.on('kill', (event) => Bots.onDeath(event.victim));
Bus.on('setting', (key) => Bots.readSettings(key));
Sim.addSystem('botThink', 10, (dt) => Bots.step(dt));
