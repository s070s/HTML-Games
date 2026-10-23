// Self-tests for S14 bots (group 'bots'; the long soaks, kit sweeps and full matches are in the slow group 'botsoak')
// and the bot debug commands (BOT-091): __CTK.spawnBot(profile, team), __CTK.setTier(id, tier) and
// __CTK.soak(mode, map, minutes, botCount, seed, modeOptions), which plays a headless bot match and returns its stats.

const SOAK_BOTS = 16;
const SOAK_QUALITY = 'ultra';           // the medium preset caps a match at 15 bots (PERF-009)
const SOAK_SAMPLE_SECONDS = 1;
const SOAK_OPEN_MATCH = { timeLimit: 0, scoreLimit: 0 };   // soaks play on without an end
const SOAK_STUCK_LIMIT = 0.01, SOAK_NO_GOAL_LIMIT = 3;
const PERF_BOTS = 15, PERF_P95_LIMIT_MS = 1.0;
const SOAK_SKIPPED_FAMILIES = ['pve', 'solo'];   // PvE, range and puzzle modes have no versus objective: soak those maps in ffa

DebugApi.bots = { bots: Bots, sense: BotSense, move: BotMove, combat: BotCombat, decide: BotDecide, team: BotTeam, debug: BotDebug, difficulty: Difficulty,
  flagPush: BOT_FLAG_PUSH };   // tuning: the flag raid numbers can be changed live

// Adds a bot to the running match (a CAT.bots key or row, or nothing for a generic bot) and spawns it; returns its id or -1.
DebugApi.spawnBot = (profile, team) => {
  if (!Game.match || !Modes.rules) return -1;
  const row = typeof profile === 'string' ? CAT.bots.byId(profile) : profile || null;
  const id = Modes.addParticipant(ACTOR_KIND.BOT, Modes.requestedTeam(team), row ? row.name : 'Bot ' + (Actors.count + 1), row);
  if (id < 0) return -1;
  Bots.assign(id, row, Bots.chooseTier(row, {}));
  Modes.spawnActor(id);
  return id;
};
DebugApi.setTier = (id, tier) => {
  if (Actors.kind[id] !== ACTOR_KIND.BOT) return false;
  Bots.tierRow[id] = CAT.botTiers[clamp(parseTier(tier), 0, BOT_TIER_COUNT - 1)];
  BotMove.configure(id);
  return true;
};

// Plays `minutes` of `mode` on `map` with 16 bots (or botCount), headless, with seed 1 (or seed), without a time or score
// limit (or with modeOptions), and returns the soak numbers (BOT-091 / ARC-033 / tests).
DebugApi.soak = (mode, map, minutes, botCount, seed, modeOptions) => playMatch({ mode, map, minutes, botCount: botCount || SOAK_BOTS,
  seed: seed === undefined ? 1 : seed, modeOptions: modeOptions || SOAK_OPEN_MATCH });

// One headless match at the soak quality, stopped afterwards whatever happens. run: { mode, map (an id, or a map
// object), ruleset, difficulty, balance, player (optional), minutes, botCount or bots (setup entries), seed, modeOptions, onTick(tick) after every tick,
// probe(stats) at the end while the match still runs }. Returns the soak numbers.
function playMatch(run) {
  const headless = Game.headless, quality = Settings.get('video.quality'), ownMap = typeof run.map !== 'string';
  Game.headless = true;
  Settings.set('video.quality', SOAK_QUALITY);
  try { return runSoak(run); } finally {
    Game.stop();
    if (ownMap) World.clear();
    Settings.set('video.quality', quality);
    Game.headless = headless;
  }
}

function runSoak(run) {
  const bots = run.bots || Array.from({ length: run.botCount }, () => ({}));
  Game.start({ mode: run.mode, map: run.map, ruleset: run.ruleset, seed: run.seed, bots, modeOptions: run.modeOptions, difficulty: run.difficulty,
    balance: run.balance, player: run.player });
  const stats = { mode: run.mode, map: typeof run.map === 'string' ? run.map : run.map.id, bots: 0, seconds: 0, botSeconds: 0, stuckFraction: 0, maxStuck: 0, nan: 0, maxNoGoal: 0, aiP95: 0, aiMax: 0,
    kills: 0, shots: 0, unknownShots: 0, unperceivedShots: 0, objectivesTouched: 0, raysMax: 0,
    ended: false, winner: NOT_OVER, reason: '', teamCaptures: 0, actorCaptures: 0, holdPoints: 0 };
  for (let id = 0; id < Actors.count; id++) if (Bots.active[id]) stats.bots++;
  resetSoakCounters();
  const fairness = BotCombat.fairness, shotsBefore = fairness.shots, unknownBefore = fairness.unknown, unperceivedBefore = fairness.unperceived;
  const kills = startEventLog('kill'), scores = startEventLog('score'), timings = [];
  const ticks = Math.round(run.minutes * 60 * TICK_RATE), sampleTicks = Math.round(SOAK_SAMPLE_SECONDS * TICK_RATE);
  let played = 0;
  for (; played < ticks && Game.match && !Game.match.ended; played++) {
    Sim.run(1);
    if (run.onTick) run.onTick(played);
    timings.push(Sim.timing.botThink || 0);
    if (played % sampleTicks === 0) sampleSoak(stats);
  }
  kills.stop(); scores.stop();
  finishSoak(stats, timings, played);
  finishMatch(stats, scores);
  stats.kills = kills.length;
  stats.shots = fairness.shots - shotsBefore;
  stats.unknownShots = fairness.unknown - unknownBefore;
  stats.unperceivedShots = fairness.unperceived - unperceivedBefore;
  if (run.probe) run.probe(stats);
  return stats;
}

// How the match went: its result, and the score the objectives gave (team captures, actor capture credits, hold points).
function finishMatch(stats, scores) {
  const results = Game.match ? Game.match.results : null;
  stats.ended = !!(Game.match && Game.match.ended);
  stats.winner = results ? results.winner : NOT_OVER;
  stats.reason = results ? results.reason : '';
  for (const event of scores) {
    if (event.reason === 'capture' && event.id < 0) stats.teamCaptures++;
    if (event.reason === 'capture' && event.id >= 0) stats.actorCaptures++;
    if (event.reason === 'hold' && event.points > 0) stats.holdPoints += event.points;
  }
}

function resetSoakCounters() {
  BotMove.stuckSeconds.fill(0); BotMove.longestStuck.fill(0);
  BotDecide.longestNoGoal.fill(0);
  Bots.stats.botTicks = 0;
  BotSense.stats.maxRaysPerTick = 0;
}

function sampleSoak(stats) {
  for (let id = 0; id < Actors.count; id++) {
    if (!Bots.active[id]) continue;
    const values = [Actors.x[id], Actors.y[id], Actors.z[id], Actors.aimYaw[id], Actors.aimPitch[id], Actors.moveX[id], Actors.moveZ[id]];
    if (!values.every(Number.isFinite)) stats.nan++;
  }
  for (const objective of Modes.objectives) if (objective.state === 'carried' || objective.owner >= 0 || objective.progress > 0) stats.objectivesTouched++;
}

function finishSoak(stats, timings, ticks) {
  let stuck = 0, longest = 0, noGoal = 0;
  for (let id = 0; id < Actors.count; id++) {
    stuck += BotMove.stuckSeconds[id];
    longest = Math.max(longest, BotMove.longestStuck[id]);
    noGoal = Math.max(noGoal, BotDecide.longestNoGoal[id]);
  }
  const botSeconds = Bots.stats.botTicks * TICK_SECONDS;
  stats.seconds = Math.round(ticks * TICK_SECONDS);
  stats.botSeconds = botSeconds;
  stats.stuckFraction = botSeconds > 0 ? stuck / botSeconds : 0;
  stats.maxStuck = longest;
  stats.maxNoGoal = noGoal;
  timings.sort((a, b) => a - b);
  stats.aiP95 = timings.length ? timings[Math.floor(timings.length * 0.95)] : 0;
  stats.aiMax = timings.length ? timings[timings.length - 1] : 0;
  stats.raysMax = BotSense.stats.maxRaysPerTick;
}

// The mode a soak plays on a map: its first versus mode with a behaviour and no 1 v 1 queue, else free-for-all.
function soakModeFor(map) {
  for (const id of map.modes || []) {
    const mode = CAT.modes.byId(id);
    if (mode && Modes.isPlayable(id) && !SOAK_SKIPPED_FAMILIES.includes(mode.family) && !mode.params.activePlayers) return id;
  }
  return 'ffa';
}

// ---- Small test arenas: a floor split in two by a wall (no way around), or open ----
const BOT_WALL = { shape: 'box', min: [-60, 0, -1], max: [60, 12, 1] };
// Walled test arenas a run can name as its map (arenaMap below): half sizes in metres. The room makes fights close.
const BOT_ARENA = 'bots-arena', BOT_ROOM = 'bots-room';
const BOT_ARENA_HALF = { [BOT_ARENA]: 60, [BOT_ROOM]: 16 };

function botTestMap(withWall, extra) {
  return Object.assign({ id: 'bots-test', brushes: withWall ? [TEST_FLOOR, BOT_WALL] : [TEST_FLOOR],
    spawns: [{ x: 0, y: 0, z: -10, yaw: 0 }, { x: 0, y: 0, z: 10, yaw: 180 }], objectives: [], items: [] }, extra);
}

// One brain-driven bot (id 0) and practice dummies; returns the ids.
function startBotTest(map, mode, setup) {
  World.load(map);
  const entries = (setup && setup.bots) || [{ tier: 3 }, { dummy: true }];
  Game.start(Object.assign({ mode: mode || 'ffa', seed: 1, bots: entries }, setup));
  const ids = [];
  for (let id = 0; id < Actors.count; id++) if (Modes.participant[id]) ids.push(id);
  return ids;
}

function placeFacing(id, x, z, yaw) {
  placeActor(id, x, z);
  Actors.yaw[id] = Actors.aimYaw[id] = yaw;
  if (Bots.active[id]) Bots.lookYaw[id] = yaw;
}

// Holds a dummy in place (bots only move bots; the test arena has no other forces).
function holdActor(id, x, z) { moveActor(id, x, z, 0, 0); }

// Puts an actor on a scripted path point with the path's velocity (what the aim model and the vision range read).
function moveActor(id, x, z, vx, vz) {
  Actors.x[id] = x; Actors.z[id] = z; Actors.vx[id] = vx; Actors.vz[id] = vz;
  Actors.health[id] = Actors.maxHealth[id];
}

function endBotTest() {
  Game.stop();
  World.clear();
}

// BOT-030 look spring: Bots.turn through the botLookSpring scratch follows the spring formulas step for step, and passes no
// float to a helper call (PERF-006: about 5 boxed floats per bot step before, with springVelocity, lookRate, wrapAngle, clamp).
Test.add('bots', (check) => {
  const [bot] = startBotTest(botTestMap(false));
  placeFacing(bot, 0, -10, 0);
  Bots.lookYaw[bot] = 170 * DEG; Bots.lookPitch[bot] = 2;   // past the pitch limit; later across the -PI..PI seam
  const dt = TICK_SECONDS, limit = Bots.tier(bot).turn * DEG;
  const rate = (change) => (Math.abs(change / dt) > limit ? 0 : change / dt);
  const spring = (velocity, error, feed) => {
    const relative = velocity - feed, next = relative + (BOT_AIM_SPRING * BOT_AIM_SPRING * error - 2 * BOT_AIM_SPRING * relative) * dt;
    return clamp(next + feed, -limit, limit);
  };
  let worst = 0;
  for (let step = 0; step < 90; step++) {
    if (step === 45) Bots.lookYaw[bot] = -170 * DEG;
    const lookPitch = clamp(Bots.lookPitch[bot], -BOT_PITCH_LIMIT, BOT_PITCH_LIMIT);
    const yawVelocity = spring(Bots.yawVelocity[bot], wrapAngle(Bots.lookYaw[bot] - Actors.aimYaw[bot]), rate(wrapAngle(Bots.lookYaw[bot] - Bots.lastLookYaw[bot])));
    const pitchVelocity = spring(Bots.pitchVelocity[bot], lookPitch - Actors.aimPitch[bot], rate(lookPitch - Bots.lastLookPitch[bot]));
    const yaw = wrapAngle(Actors.aimYaw[bot] + yawVelocity * dt), pitch = clamp(Actors.aimPitch[bot] + pitchVelocity * dt, -BOT_PITCH_LIMIT, BOT_PITCH_LIMIT);
    Bots.turn(bot, dt);
    worst = Math.max(worst, Math.abs(Actors.aimYaw[bot] - yaw), Math.abs(Actors.aimPitch[bot] - pitch), Math.abs(Bots.yawVelocity[bot] - yawVelocity));
  }
  check('the look spring follows the critically damped spring with the turn cap, step for step', worst < 1e-5, worst);
  check('the look spring passes no float to a helper call (botLookSpring scratch, wrapAngleAt)', !/springVelocity|lookRate|wrapAngle\(|clamp\(/.test(Bots.turn.toString()));
  endBotTest();
});

// ---- BOT-071 revive: a bot walks to a downed teammate and holds Use until it stands again ----
Test.add('bots', (check) => {
  const [bot, mate] = startBotTest(botTestMap(false), 'tdm', { ruleset: 'modern', balance: false, bots: [{ tier: 3, team: 0 }, { dummy: true, team: 0 }] });
  placeFacing(bot, 0, -10, 0);
  holdActor(mate, 6, 0);
  Actors.flags[mate] &= ~ACTOR_FLAG.PROTECTED;   // past spawn protection
  TestArena.hit(-1, mate, 1000);
  const downed = (Actors.flags[mate] & ACTOR_FLAG.DOWNED) !== 0;
  for (let tick = 0; tick < 15 * TICK_RATE && (Actors.flags[mate] & ACTOR_FLAG.DOWNED); tick++) Sim.run(1);
  check('BOT-071 a bot revives a downed teammate when no enemy is near', downed && Actors.alive[mate] === 1 && !(Actors.flags[mate] & ACTOR_FLAG.DOWNED), GOAL_NAMES[BotDecide.goal[bot]]);
  endBotTest();
});

// HP-007 + BOT-071: a downed bot holds still for its reviver instead of crawling after its own goal, so the revive finishes.
Test.add('bots', (check) => {
  const [bot, mate] = startBotTest(botTestMap(false), 'tdm', { ruleset: 'modern', balance: false, bots: [{ tier: 3, team: 0 }, { tier: 3, team: 0 }] });
  placeFacing(bot, 0, -4, 0);
  placeFacing(mate, 4, 0, 0);
  Actors.flags[mate] &= ~ACTOR_FLAG.PROTECTED;   // past spawn protection
  TestArena.hit(-1, mate, 1000);
  const downed = (Actors.flags[mate] & ACTOR_FLAG.DOWNED) !== 0, startX = Actors.x[mate], startZ = Actors.z[mate];
  let moved = 0;
  for (let tick = 0; tick < 8 * TICK_RATE && (Actors.flags[mate] & ACTOR_FLAG.DOWNED); tick++) {
    Sim.run(1);
    moved = Math.max(moved, Math.hypot(Actors.x[mate] - startX, Actors.z[mate] - startZ));
  }
  const revived = downed && Actors.alive[mate] === 1 && !(Actors.flags[mate] & ACTOR_FLAG.DOWNED);
  check('BOT-071 a bot revives a downed bot within 8 s (the downed bot holds still)', revived && moved < 0.5, 'moved ' + moved.toFixed(2) + ' m, goal ' + GOAL_NAMES[BotDecide.goal[bot]]);
  endBotTest();
});

// M20 squads put squad indices in Actors.team: every possible squad has its own bark clock and grenade token.
Test.add('bots', (check) => {
  check('team bark clocks cover every squad index', BotTeam.teamBarkAt.length >= MAX_ACTORS + 1 && BotTeam.grenadeAt.length >= 2 * MAX_ACTORS + 1, BotTeam.teamBarkAt.length);
});

// ---- Catalogues ----
Test.add('bots', (check) => {
  check('8 skill tiers BT0..BT7 in order', CAT.botTiers.length === 8 && CAT.botTiers.every((row, index) => row.tier === index && row.code === 'BT' + index));
  check('hit caps rise with the tier (BOT-093)', CAT.botTiers.every((row, index) => index === 0 || row.hitCap > CAT.botTiers[index - 1].hitCap));
  check('16 traits T01..T16', CAT.botTraits.length === 16 && CAT.botTraits.every((row, index) => row.code === 'T' + String(index + 1).padStart(2, '0')));
  check('24 named bots B01..B24', CAT.bots.length === 24 && CAT.bots.every((row, index) => row.code === 'B' + String(index + 1).padStart(2, '0')));
  const badFavorites = CAT.bots.filter((row) => row.favorite && row.favorite !== BOT_FAVORITE_PLAYER && !CAT.weapons.byId(row.favorite)).map((row) => row.id);
  check('every favourite weapon exists', badFavorites.length === 0, badFavorites.join());
  const badStyles = CAT.bots.filter((row) => !BOT_TRAIT_STYLES[row.style]).map((row) => row.id);
  check('every bot style exists', badStyles.length === 0, badStyles.join());
  const traitKeys = CAT.botTraits.map((row) => row.id);
  const badTraits = CAT.bots.filter((row) => Object.keys(row.traits).some((key) => !traitKeys.includes(key))).map((row) => row.id);
  check('bot trait overrides name real traits', badTraits.length === 0, badTraits.join());
  check('10 difficulty presets D01..D10 with a valid tier span', CAT.difficulty.length === 10 && CAT.difficulty.every((row, index) => row.code === 'D' + String(index + 1).padStart(2, '0') && row.tierMin <= row.tierMax && row.tierMax < 8));
  check('every bark category has lines and a known chat style', Object.values(BOT_BARKS).every((row) => row.lines.length > 0) && CAT.bots.every((row) => BOT_CHAT_CHANCE[row.chat] !== undefined));
  check('role splits leave attackers', Object.values(BOT_ROLE_SPLITS).every((split) => (split.defend || 0) + (split.escort || 0) < 1));
});

// ---- Difficulty rule stage and tiers ----
Test.add('bots', (check) => {
  startBotTest(botTestMap(false), 'ffa', { difficulty: 'veteran' });
  const veteran = CAT.difficulty.byId('veteran');
  check('the difficulty stage writes rules.botSkill from the preset', !veteran || Game.match.rules.botSkill.preset === 'veteran', Game.match.rules.botSkill.preset);
  endBotTest();
  const errors = Test.expectErrors(() => { startBotTest(botTestMap(false), 'ffa', { difficulty: 'nope' }); });
  check('an unknown preset logs once and falls back to regular', errors === 1 && Game.match.rules.botSkill.preset === BOT_DEFAULT_DIFFICULTY, errors);
  endBotTest();
  const custom = Difficulty.resolve({ preset: 'regular', reactionScale: 99, tierMin: 5, tierMax: 2 });
  const slider = DIFFICULTY_SLIDERS.find((row) => row.field === 'reactionScale');
  check('custom sliders clamp to DIF-002 and tierMax >= tierMin', (!slider || custom.reactionScale === slider.max) && custom.tierMax >= custom.tierMin);
  const ids = startBotTest(botTestMap(false), 'ffa', { difficulty: 'recruit', bots: [{ profile: 'pell' }, { tier: 'BT6' }, {}] });
  check('a named bot plays its roster tier (inside the difficulty range), setup.tier wins', Bots.tier(ids[0]).tier === CAT.bots.byId('pell').tier && Bots.tier(ids[1]).tier === 6);
  check('a named bot keeps its profile row', Bots.profile[ids[0]] === CAT.bots.byId('pell') && Actors.profile[ids[0]] === CAT.bots.byId('pell'));
  check('setTier changes the tier', DebugApi.setTier(ids[2], 7) && Bots.tier(ids[2]).tier === 7);
  check('setTier is a test command, not a Bots method', Bots.setTier === undefined);
  const extra = DebugApi.spawnBot('nyx7', -1);
  check('spawnBot adds a live brain-driven bot mid-match', extra >= 0 && Actors.alive[extra] && Bots.active[extra] && Bots.profile[extra] === CAT.bots.byId('nyx7'));
  endBotTest();
});

// ---- Perception: walls block sight, gunfire is heard, no shots at what a bot does not perceive (ARC-033) ----
Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(true));
  const shots = startEventLog('weapon.fire');
  const unknownBefore = BotCombat.fairness.unperceived;
  for (let tick = 0; tick < 3 * TICK_RATE; tick++) {
    if (tick === 0) placeFacing(bot, 0, -10, 0);
    holdActor(bot, 0, -10);
    holdActor(dummy, 0, 10);
    Sim.run(1);
  }
  check('a bot behind a wall does not see the enemy', !BotSense.sees(bot, dummy) && BotCombat.target[bot] < 0);
  check('no shot at an unperceived target', shots.filter((event) => event.id === bot).length === 0 && BotCombat.fairness.unperceived === unknownBefore);
  Bus.emit('sound', { x: Actors.x[dummy], y: 1, z: Actors.z[dummy], radius: 60, kind: 'gunfire', source: dummy });
  check('gunfire is heard within its radius (through the wall when close)', Sim.time - BotSense.heardAt[bot] < 0.01 && BotSense.knows(bot, dummy, Sim.time));
  const heardAt = BotSense.heardAt[bot];
  Bus.emit('sound', { x: Actors.x[bot] + 200, y: 1, z: Actors.z[bot], radius: 30, kind: 'gunfire', source: -1 });
  check('a shot far outside the radius is not heard', BotSense.heardAt[bot] === heardAt);
  shots.stop();
  endBotTest();

  const [open, target] = startBotTest(botTestMap(false));
  let seenAfter = -1;
  for (let tick = 0; tick < 4 * TICK_RATE && seenAfter < 0; tick++) {
    if (tick === 0) placeFacing(open, 0, -10, 0);
    holdActor(target, 0, 10);
    Sim.run(1);
    if (BotSense.sees(open, target)) seenAfter = tick * TICK_SECONDS;
  }
  check('in the open the same enemy is seen within the awareness time', seenAfter >= 0 && seenAfter <= 3, seenAfter);
  check('the perception ray budget holds (<= 96 per tick)', BotSense.stats.maxRaysPerTick <= SENSE_RAYS_PER_TICK, BotSense.stats.maxRaysPerTick);
  endBotTest();
});

// ---- Aim: accuracy per tier against a strafing dummy stays in its band and under the BOT-093 cap ----
// The dummy strafes +-3 m at 15 m (peak 7.5 m/s, a running player), with its real velocity, over several seeds.
const ACCURACY_SECONDS = 15, ACCURACY_SEEDS = [1, 2, 3], ACCURACY_DISTANCE = 15, ACCURACY_STRAFE = 3, ACCURACY_STRAFE_RATE = 0.8;
const ACCURACY_BAND_LOW = 0.3, ACCURACY_BAND_SLACK = 0.08;   // band: 30% of the tier's hit cap .. the cap + 0.08
const ACCURACY_ORDER_SLACK = 0.05;
const ACCURACY_STILL_TABLE = { walkFraction: 0, walk: 0, crouch: 0, run: 0, air: 0, land: 0, landTime: 1 };   // a MOV-025 table that adds nothing

function measureAccuracy(tier) {
  let shots = 0, hits = 0;
  for (const seed of ACCURACY_SEEDS) {
    const [bot, dummy] = startBotTest(botTestMap(false), 'ffa', { seed, bots: [{ tier }, { dummy: true }] });
    Gadgets.resetActor(bot);   // aim alone: no grenade throws between the shots
    Move.presetOverride[bot] = Object.assign({}, Move.preset(bot), { inaccuracy: ACCURACY_STILL_TABLE });   // and no WPN-003 movement spread
    for (let tick = 0; tick < ACCURACY_SECONDS * TICK_RATE; tick++) {
      if (tick === 0) placeFacing(bot, 0, -ACCURACY_DISTANCE / 2, 0);
      holdActor(bot, 0, -ACCURACY_DISTANCE / 2);
      strafeDummy(dummy, tick * TICK_SECONDS);
      Sim.run(1);
    }
    shots += BotCombat.totalShots[bot]; hits += BotCombat.totalHits[bot];
    endBotTest();
  }
  return { shots, hits, rate: shots > 0 ? hits / shots : 0 };
}

// x = A sin(w t), so vx = A w cos(w t).
function strafeDummy(dummy, time) {
  const rate = ACCURACY_STRAFE_RATE * Math.PI;
  moveActor(dummy, Math.sin(time * rate) * ACCURACY_STRAFE, ACCURACY_DISTANCE / 2, Math.cos(time * rate) * ACCURACY_STRAFE * rate, 0);
}

Test.add('bots', (check) => {
  const results = CAT.botTiers.map((row) => measureAccuracy(row.tier));
  DebugApi.bots.lastAccuracy = results;
  const text = results.map((result, tier) => 'BT' + tier + ' ' + result.rate.toFixed(2) + ' (' + result.shots + ')').join(', ');
  check('every tier fires at a visible moving enemy', results.every((result) => result.shots >= 5), text);
  check('accuracy stays under the tier cap (+0.08 slack)', results.every((result, tier) => result.rate <= CAT.botTiers[tier].hitCap + ACCURACY_BAND_SLACK), text);
  check('accuracy reaches its band (>= 30% of the cap)', results.every((result, tier) => result.rate >= CAT.botTiers[tier].hitCap * ACCURACY_BAND_LOW), text);
  check('the top tier hits more often than the bottom tier', results[7].rate > results[0].rate, text);
  check('accuracy grows with the tier (no tier 0.05 under the one below)', results.every((result, tier) => tier === 0 || result.rate >= results[tier - 1].rate - ACCURACY_ORDER_SLACK), text);
});

// ---- Decisions: a hurt bot goes for health ----
Test.add('bots', (check) => {
  const item = { x: 12, y: 0, z: -10, item: 'healthpack', group: 'health' };
  const itemMap = botTestMap(true, { items: [item] });
  const [bot, dummy] = startBotTest(itemMap, 'ffa', { map: itemMap });   // setup.map: Items loads the map's items
  placeFacing(bot, 0, -10, 0);
  holdActor(dummy, 0, 10);
  Actors.health[bot] = Actors.maxHealth[bot] * 0.3;
  const pickups = startEventLog('pickup');
  let choseHealth = false, closest = Infinity;
  for (let tick = 0; tick < 4 * TICK_RATE && !pickups.some((event) => event.id === bot); tick++) {
    holdActor(dummy, 0, 10);
    Sim.run(1);
    if (BotDecide.goal[bot] === GOAL.COLLECT && BotDecide.goalTarget[bot] === 0) choseHealth = true;
    closest = Math.min(closest, Math.hypot(Actors.x[bot] - item.x, Actors.z[bot] - item.z));
  }
  pickups.stop();
  check('a low-health bot picks the health item as its goal', choseHealth);
  check('and walks to it', closest < 1.5, closest.toFixed(2));
  check('and picks it up (real items)', pickups.some((event) => event.id === bot && event.item === item.item), JSON.stringify(pickups));
  endBotTest();
});

// ---- Decisions: bots list only the item spots Items placed (Items.spotAllowed: PU20 shards need the Ravager health preset) ----
Test.add('bots', (check) => {
  const spire = CAT.maps.byId('spire');
  const shardKeys = (health) => {
    startBotTest(spire, 'ffa', { map: spire, ruleset: { health } });
    const keys = BotDecide.items.map((item) => item.key);
    const placed = Items.spotCount;
    endBotTest();
    return { listed: keys.filter((key) => key === 'vitalshard').length, items: keys.length, placed };
  };
  const stack = shardKeys('stack'), ravager = shardKeys('ravager');
  check('MP01 stack health: no bot item is a Vital Shard', stack.listed === 0 && stack.items === stack.placed, JSON.stringify(stack));
  check('MP01 Ravager health: the bots list the shard spots', ravager.listed === 2 && ravager.items === ravager.placed, JSON.stringify(ravager));
});

// ---- Team play: a defend ping is answered within 2 s and acknowledged by every taker; an enemy ping gets a reply ----
Test.add('bots', (check) => {
  const spawns = [-6, 0, 6].flatMap((x) => [{ x, y: 0, z: -10, team: 0 }, { x, y: 0, z: 10, team: 1 }]);
  // Two bots with the player against two dummies: 3 v 2 is balanced, so nobody changes sides.
  startBotTest(botTestMap(true, { spawns }), 'tdm', { player: { team: 0 }, bots: [{ team: 0 }, { team: 0 }, { team: 1, dummy: true }, { team: 1, dummy: true }] });
  const player = Game.playerId, barks = startEventLog('bark');
  runSeconds(1);
  const pingedAt = Sim.time;
  Bus.emit('ping', { id: player, kind: 'defend', x: 20, y: 0, z: -20, target: -1 });
  runSeconds(2);
  const takers = [];
  for (let id = 0; id < Actors.count; id++) if (Bots.active[id] && BotTeam.orderGivenAt[id] === pingedAt) takers.push(id);
  const answered = takers.filter((id) => BotTeam.answeredAt[id] >= pingedAt && BotTeam.answeredAt[id] - pingedAt <= 2);
  check('the team bots take the order', takers.length === 2, takers.length);
  check('a defend ping is answered within 2 s (goal: order)', answered.length === takers.length && takers.length > 0, answered.length);
  const acknowledged = takers.filter((id) => barks.some((event) => event.id === id && event.category === 'orderAck' && withinAckTime(event.time - pingedAt)));
  check('every taker acknowledges in chat within 0.5-1.5 s (BOT-051)', acknowledged.length === takers.length && takers.length > 0, acknowledged.length);
  runSeconds(4);
  check('the bots head for the pinged spot', takers.every((id) => Math.hypot(Actors.x[id] - 20, Actors.z[id] + 20) < 16));
  const enemy = firstOfTeam(1), spottedAt = Sim.time;
  Bus.emit('ping', { id: player, kind: 'enemy', x: Actors.x[enemy], y: Actors.y[enemy], z: Actors.z[enemy], target: enemy });
  runSeconds(2);
  check('an enemy ping from the player gets a reply within 1.5 s', barks.some((event) => event.category === 'pingReply' && withinAckTime(event.time - spottedAt)));
  const chatter = Settings.get('gameplay.chatter');
  Settings.set('gameplay.chatter', 'off');
  const count = barks.length;
  Bus.emit('ping', { id: player, kind: 'go', x: -20, y: 0, z: -20, target: -1 });
  runSeconds(2);
  check('chatter off silences the barks', barks.length === count);
  Settings.set('gameplay.chatter', chatter);   // later tests count barks
  barks.stop();
  endBotTest();
});

// ---- Comm wheel (BOT-061/062, INP-003): Ping tap vs hold, look picks a callout, follow / hold / regroup reach the whole team ----
Test.add('bots', (check) => {
  const spawns = [-6, 0, 6].flatMap((x) => [{ x, y: 0, z: -10, team: 0 }, { x, y: 0, z: 10, team: 1 }]);
  startBotTest(botTestMap(true, { spawns }), 'tdm', { player: { team: 0 }, balance: false, bots: [{ team: 0 }, { team: 0 }, { team: 0 }, { team: 1, dummy: true }, { team: 1, dummy: true }] });
  const player = Game.playerId, pings = startEventLog('ping'), pingAction = Input.actionIndex.ping;
  const mates = [];
  for (let id = 0; id < Actors.count; id++) if (Bots.active[id] && Actors.team[id] === 0) mates.push(id);
  runSeconds(1);
  const fromPlayer = () => pings.filter((event) => event.id === player);
  Actors.aimPitch[player] = BOTS_WHEEL_SKY;   // aimed at no bot: the wheel talks to the squad
  Input.effective[pingAction] = 1; CommWheel.frame(0.1);
  Input.effective[pingAction] = 0; CommWheel.frame(0.02);
  check('wheel: a short Ping tap pings at once, no wheel', fromPlayer().length === 1 && !CommWheel.open, fromPlayer().length);
  Input.effective[pingAction] = 1; CommWheel.frame(0.2); CommWheel.frame(0.2);
  check('wheel: holding Ping opens the wheel and sends nothing yet', CommWheel.open && fromPlayer().length === 1);
  Input.look.mouseX = 0.05;
  const yaw = Actors.aimYaw[player];
  CommWheel.frame(0.02);
  check('wheel: look picks the callout to the right (Follow me) and does not turn the view', COMM_CALLOUTS[CommWheel.selected].id === 'follow' && Input.look.mouseX === 0 && Actors.aimYaw[player] === yaw, CommWheel.selected);
  Input.effective[pingAction] = 0; CommWheel.frame(0.02);
  const follow = fromPlayer()[1];
  check('wheel: letting go sends the picked callout at the caller', !CommWheel.open && follow && follow.kind === 'follow' && follow.x === Actors.x[player], JSON.stringify(follow));
  check('follow me: every team bot takes it and tracks the caller', mates.every((id) => BotTeam.orderKind[id] === 'follow' && BotTeam.orderSource[id] === player), mates.map((id) => BotTeam.orderKind[id]).join());
  placeActor(player, 18, -18);
  runSeconds(6);
  const nearCaller = (id) => Math.hypot(Actors.x[id] - 18, Actors.z[id] + 18) < 8;   // a bot in a fight may fight first (combat outscores orders)
  check('follow me: the bots come to where the caller went', mates.some(nearCaller) && mates.every((id) => nearCaller(id) || BotCombat.target[id] >= 0), mates.map((id) => Math.hypot(Actors.x[id] - 18, Actors.z[id] + 18).toFixed(1) + ' goal ' + BotDecide.goal[id]).join());
  Actors.aimPitch[player] = BOTS_WHEEL_SKY;
  CommWheel.onComm(true);
  botsWheelPick('regroup');
  CommWheel.onComm(false);
  const regroup = fromPlayer()[2];
  check('wheel: the Comm key opens it too (Regroup)', regroup && regroup.kind === 'regroup' && regroup.to === -1, JSON.stringify(regroup));
  BotTeam.callout(player, botsCalloutIndex('hold'), -1);
  check('hold position: every bot defends the spot it stands on', mates.every((id) => BotTeam.orderKind[id] === 'defend' && Test.near(BotTeam.orderX[id], Actors.x[id], 1e-3) && Test.near(BotTeam.orderZ[id], Actors.z[id], 1e-3)));
  CommWheel.onComm(true);
  CommWheel.onComm(false);
  check('wheel: letting go with nothing picked sends nothing', fromPlayer().length === 4 && !CommWheel.open, fromPlayer().length);
  pings.stop();
  CommWheel.reset();
  endBotTest();
});

const BOTS_WHEEL_SKY = 1.2;   // radians of aim pitch: looking at the sky, so the wheel addresses no bot
function botsCalloutIndex(kind) { return COMM_CALLOUTS.findIndex((row) => row.id === kind); }
// Moves the wheel's pick point toward a callout (the first at the top, then clockwise).
function botsWheelPick(kind) {
  const angle = botsCalloutIndex(kind) / COMM_CALLOUTS.length * 2 * Math.PI;
  CommWheel.pick(Math.sin(angle) * COMM_WHEEL_REACH, -Math.cos(angle) * COMM_WHEEL_REACH);
}

// ---- Comm wheel: aimed at a team bot it addresses that bot only (Cover me); replies answer a ping and order nobody ----
Test.add('bots', (check) => {
  const spawns = [-6, 0, 6].flatMap((x) => [{ x, y: 0, z: -10, team: 0 }, { x, y: 0, z: 10, team: 1 }]);
  startBotTest(botTestMap(true, { spawns }), 'tdm', { player: { team: 0 }, balance: false, bots: [{ team: 0 }, { team: 0 }, { team: 0 }, { team: 1, dummy: true }, { team: 1, dummy: true }] });
  const player = Game.playerId, pings = startEventLog('ping'), mates = [];
  for (let id = 0; id < Actors.count; id++) if (Bots.active[id] && Actors.team[id] === 0) mates.push(id);
  runSeconds(1);
  const chosen = mates[0], others = mates.slice(1);
  placeActor(player, -20, -20); placeActor(chosen, -20, -12);
  others.forEach((id, index) => placeActor(id, 10 + index * 4, -20));
  Actors.aimYaw[player] = 0; Actors.aimPitch[player] = 0;   // straight at the chosen bot (+Z)
  CommWheel.onComm(true);
  check('wheel: opened while aiming at a team bot, it addresses that bot', CommWheel.addressee === chosen, CommWheel.addressee);
  botsWheelPick('cover');
  CommWheel.onComm(false);
  const cover = pings[pings.length - 1], givenAt = Sim.time;
  check('cover me: the ping is addressed to the aimed bot', cover && cover.kind === 'cover' && cover.to === chosen, JSON.stringify(cover));
  check('cover me: only that bot takes it, the squad does not', BotTeam.orderKind[chosen] === 'cover' && BotTeam.orderSource[chosen] === player
    && others.every((id) => BotTeam.orderUntil[id] <= givenAt), mates.map((id) => BotTeam.orderKind[id]).join());
  placeActor(player, -8, -26);
  runSeconds(5);
  const covering = length2(Actors.x[chosen] + 8, Actors.z[chosen] + 26) < COVER_RADIUS + 3;
  check('cover me: the bot comes to the caller and holds there (unless it fights)', covering || BotCombat.target[chosen] >= 0, length2(Actors.x[chosen] + 8, Actors.z[chosen] + 26).toFixed(1));
  Actors.aimPitch[player] = BOTS_WHEEL_SKY;
  CommWheel.onComm(true);
  check('wheel: aimed at no bot, it addresses the squad', CommWheel.addressee === -1);
  CommWheel.reset();
  Bus.emit('ping', { id: others[0], kind: 'go', x: 5, y: 0, z: 5, target: -1, to: -1 });
  const orders = BotTeam.stats.orders;
  CommWheel.onComm(true);
  botsWheelPick('dibs');
  CommWheel.onComm(false);
  const dibs = pings[pings.length - 1];
  check('reply: Dibs answers the newest teammate ping, at its spot and to its sender', dibs && dibs.kind === 'dibs' && dibs.id === player && dibs.x === 5 && dibs.z === 5 && dibs.to === others[0], JSON.stringify(dibs));
  check('reply: a reply orders nobody', BotTeam.stats.orders === orders, BotTeam.stats.orders - orders);
  check('reply: the wheel has Dibs, No and On my way', ['dibs', 'no', 'onMyWay'].every((kind) => COMM_CALLOUT_BY_KIND.get(kind).at === 'reply'));
  pings.stop();
  CommWheel.reset();
  endBotTest();
});

function withinAckTime(seconds) { return seconds >= ORDER_ACK_MIN - TIME_EPSILON && seconds <= ORDER_ACK_MAX + TICK_SECONDS; }

function firstOfTeam(team) {
  for (let id = 0; id < Actors.count; id++) if (Modes.participant[id] && Actors.team[id] === team) return id;
  return -1;
}

// ---- Hidden information (BOT-040): what a bot does not see, it judges by where it last perceived it ----
Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(true));
  placeFacing(bot, 0, -10, 0);
  holdActor(dummy, 0, 10);
  runSeconds(0.5);
  const pair = BotSense.pair(bot, dummy), point = Vec.make();
  BotSense.visible[pair] = 0;
  BotSense.knownX[pair] = 5; BotSense.knownY[pair] = 0; BotSense.knownZ[pair] = 3;
  BotSense.perceivedPosition(bot, dummy, point);
  check('an unseen enemy is where the bot last perceived it', point.x === 5 && point.z === 3, point.x + ',' + point.z);
  BotSense.visible[pair] = 1;
  BotSense.perceivedPosition(bot, dummy, point);
  check('a seen enemy is where it really is', point.x === Actors.x[dummy] && point.z === Actors.z[dummy]);
  BotSense.visible[pair] = 0;
  BotSense.knownY[pair] = Actors.y[bot] + AGGRESSION_HEIGHT + 1;
  check('fleeing reads the remembered height (the enemy is believed far above)', BotDecide.flees(bot, dummy));
  BotSense.knownY[pair] = Actors.y[bot];
  check('and not the real one', !BotDecide.flees(bot, dummy) && BotDecide.aggression(bot) > 0, BotDecide.aggression(bot));
  BotCombat.target[bot] = -1;
  BotSense.attacker[bot] = dummy; BotSense.attackedAt[bot] = Sim.time;
  check('a bot hit from out of sight retreats from its attacker', retreatThreat(bot, Sim.time) === dummy);
  check('until the hit is 3 s old', retreatThreat(bot, Sim.time + TARGET_REVENGE_SECONDS + 0.1) === -1);
  endBotTest();
});

// ---- Hearing shares the 96-ray budget: a sound beyond the through-wall radius needs a ray, and none is left over ----
Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(true));
  placeFacing(bot, 0, -10, 0);
  holdActor(dummy, 0, 10);
  Sim.run(1);
  // 20 m away with a radius the bot hears in the open but not at the through-wall 60%: only an open line lets it in.
  const reach = SENSE_HEARING_BASE + Bots.trait(bot, TRAIT.hearing), radius = 20 / reach / ((1 + SENSE_WALL_FACTOR) / 2);
  const sound = { x: 0, y: 1, z: 10, radius, kind: 'gunfire', source: dummy };
  const hearingRays = BotSense.stats.hearingRays, raysThisTick = BotSense.stats.raysThisTick;
  BotSense.raysLeft = 0;
  Bus.emit('sound', sound);
  check('out of rays, no ray is cast for the sound', BotSense.stats.hearingRays === hearingRays && BotSense.raysLeft === 0);
  BotSense.raysLeft = SENSE_HEARING_RESERVE;
  Bus.emit('sound', sound);
  check('the reserve vision leaves pays for it and counts in the tick', BotSense.stats.hearingRays === hearingRays + 1 && BotSense.raysLeft === SENSE_HEARING_RESERVE - 1 && BotSense.stats.raysThisTick === raysThisTick + 1);
  endBotTest();
});

// ---- Trigger discipline: a grenade waits until the view is on its arc; a charge is held, not fired at nothing ----
Test.add('bots', (check) => {
  const [bot] = startBotTest(botTestMap(true));
  placeFacing(bot, 0, -10, 0);
  runSeconds(0.2);
  const now = Sim.time;
  Bots.buttonsWanted[bot] = 0;
  BotCombat.throwYaw[bot] = Actors.aimYaw[bot] + 90 * DEG; BotCombat.throwPitch[bot] = Actors.aimPitch[bot];
  BotCombat.throwUntil[bot] = now + GRENADE_AIM_SECONDS;
  BotCombat.aimThrow(bot, now);
  check('no throw while the view is off the arc', (Bots.buttonsWanted[bot] & BTN.GRENADE) === 0 && BotCombat.throwUntil[bot] > now);
  Actors.aimYaw[bot] = BotCombat.throwYaw[bot];
  BotCombat.throwCook[bot] = 0.5;
  BotCombat.aimThrow(bot, now);
  const pressed = (Bots.buttonsWanted[bot] & BTN.GRENADE) !== 0;
  Bots.buttonsWanted[bot] = 0;
  BotCombat.aimThrow(bot, now + 0.25);
  const cooking = (Bots.buttonsWanted[bot] & BTN.GRENADE) !== 0;
  Bots.buttonsWanted[bot] = 0;
  BotCombat.aimThrow(bot, BotCombat.cookUntil[bot]);
  check('once the view is on it the grenade is held for its cook, then released', pressed && cooking && (Bots.buttonsWanted[bot] & BTN.GRENADE) === 0 && BotCombat.throwUntil[bot] === 0);
  Bots.buttonsWanted[bot] = 0;
  const heldSince = now - 0.2;
  BotCombat.holdSince[bot] = heldSince; BotCombat.keptSince[bot] = -1;
  BotCombat.keepCharge(bot, now, false);
  check('a charge with the target out of sight stays held', (Bots.buttonsWanted[bot] & BTN.FIRE) !== 0 && BotCombat.holdSince[bot] === heldSince);
  const other = Weapons.cycle(bot, 1), canSwitch = other >= 0 && other !== Weapons.current[bot];
  Bots.buttonsWanted[bot] = 0;
  BotCombat.keepCharge(bot, now + CHARGE_KEEP_SECONDS + 0.1, false);
  const dropped = (Bots.buttonsWanted[bot] & BTN.NEXT_WEAPON) !== 0 && BotCombat.holdSince[bot] < 0;
  check('after 1.5 s unseen a weapon switch drops it (a bot with one weapon keeps it)', canSwitch ? dropped : BotCombat.holdSince[bot] === heldSince);
  endBotTest();
});

// ---- Water exits: a swimmer leaves by a ramp, a ladder or a rim, never under a thin deck it cannot climb ----
Test.add('bots', (check) => {
  DebugApi.soak('ffa', 'harbor', 0.02, 2);
  let blocked = 0, open = 0;
  for (let node = 0; node < exitKind.length; node++) {
    if (exitKind[node] === EXIT.BLOCKED) blocked++;
    else if (exitKind[node] === EXIT.OPEN) open++;
  }
  // S09 links no rimless swim exit any more (navHasRim); the blocked kind stays for exits a bot fails at run time.
  check('harbor has open water exits and no rimless ones', open > 0 && blocked === 0 && exitCount > 0, open + ' open, ' + blocked + ' blocked');
  let water = -1;
  for (let node = 0; node < Nav.nodeCount && water < 0; node++) if (Nav.nodeFlags[node] & NAV_NODE.WATER) water = node;
  const first = nearestExit(water, Nav.nodeX[water], Nav.nodeY[water], Nav.nodeZ[water]);
  markBlockedExit(first);
  const second = nearestExit(water, Nav.nodeX[water], Nav.nodeY[water], Nav.nodeZ[water]);
  check('a blocked exit is never the nearest exit again', first >= 0 && second !== first, first + ' then ' + second);
});

// ---- BOT-010 over the void: a jump pad flight is ridden onto its target, and a dash or grapple never ends over the void ----
const BOT_PAD_ISLES = { id: 'bots-isles', brushes: [{ shape: 'box', min: [-10, -1, -10], max: [10, 0, 10] }, { shape: 'box', min: [-10, -1, 24], max: [10, 0, 34] }],
  spawns: [{ x: 0, y: 0, z: -6, yaw: 0 }, { x: 0, y: 0, z: -8, yaw: 0 }], objectives: [], items: [],
  triggers: [{ kind: 'jumppad', min: [-1.5, 0, 5], max: [1.5, 0.4, 8], target: [0, 0, 28], peak: 4 }] };

Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(BOT_PAD_ISLES, 'ffa', { ruleset: 'vanguard' });   // strong air control: steering against the throw stops it short
  Modes.endProtection(bot); Modes.endProtection(dummy);
  Actors.flags[bot] |= ACTOR_FLAG.GOD;
  for (let tick = 0; tick < TICK_RATE; tick++) { holdActor(dummy, FAR_DUMMY, FAR_DUMMY); Sim.run(1); }   // past the spawn settle: the brain steers
  placeFacing(bot, 0, 6.5, Math.PI);
  Bots.nextDecide[bot] = Infinity;   // the test gives the destination: back where it came from, against the pad's throw
  BotMove.goTo(bot, 0, 0, -8, 1);
  for (let tick = 0; tick < 3 * TICK_RATE; tick++) { holdActor(dummy, FAR_DUMMY, FAR_DUMMY); Sim.run(1); }
  check('a bot thrown by a jump pad lands on its target island', Actors.y[bot] > -0.5 && Actors.z[bot] > 24, Actors.x[bot].toFixed(1) + ' ' + Actors.y[bot].toFixed(1) + ' ' + Actors.z[bot].toFixed(1));
  const surge = CAT.abilities.byId('surge');
  placeFacing(bot, 0, 8, 0);
  Bots.wishX[bot] = 0; Bots.wishZ[bot] = 1;
  check('a dash out over the void is not used', !abilityLands(bot, surge));
  Bots.wishZ[bot] = -1;
  check('a dash along the floor is used', abilityLands(bot, surge));
  const glide = CAT.abilities.byId('glidepack');
  check('a glide along the floor is held', abilityLands(bot, glide));
  Bots.wishZ[bot] = 1;
  check('a glide out over the void is not held', !abilityLands(bot, glide));
  endBotTest();
});

// ---- DIF-003: the adaptive shift follows the player's team in team modes and the ranking in free-for-all ----
function outcomeRow(id, team) { return { id, team }; }
function teamOutcome(winnerTeam) { return { players: [outcomeRow(1, 1), outcomeRow(0, 0), outcomeRow(2, 1)], teams: [{}, {}], winnerTeam }; }

Test.add('bots', (check) => {
  check('team mode: the player team won -> +1', matchOutcome(teamOutcome(0), 0) === 1);
  check('team mode: lost -> -1, even at the top of the scoreboard', matchOutcome({ players: [outcomeRow(0, 0), outcomeRow(1, 1)], teams: [{}, {}], winnerTeam: 1 }, 0) === -1);
  check('team mode: a draw -> 0', matchOutcome(teamOutcome(NO_TEAM), 0) === 0);
  const ffa = { players: [outcomeRow(3, NO_TEAM), outcomeRow(0, NO_TEAM), outcomeRow(4, NO_TEAM)], teams: [], winnerTeam: NO_TEAM };
  check('free-for-all: first +1, middle 0, last -1', matchOutcome(ffa, 3) === 1 && matchOutcome(ffa, 0) === 0 && matchOutcome(ffa, 4) === -1);
  const openEnded = (mode) => ({ mode, players: [outcomeRow(0, 0)], teams: [], winnerTeam: NO_TEAM, winnerId: PVE_LOST, draw: false });
  check('an Endless Hold run or a Firing Range session (they only end lost) is neither a win nor a loss', matchOutcome(openEnded('endless'), 0) === 0 && matchOutcome(openEnded('range'), 0) === 0);
  const adaptive = Settings.get('difficulty.adaptive'), shift = Settings.get('difficulty.tierShift'), playerId = Game.playerId;
  Settings.set('difficulty.adaptive', true); Settings.set('difficulty.tierShift', 0);
  Game.playerId = 0;
  const match = { results: teamOutcome(1) };
  check('adapt: a team loss lowers the shift and shows on the results', Difficulty.adapt(match) === -1 && Settings.get('difficulty.tierShift') === -1 && match.results.botTierChange === -1);
  Settings.set('difficulty.tierShift', 0.5);
  check('a fractional saved shift reads as a whole tier', Difficulty.tierShift() === Math.round(0.5), Difficulty.tierShift());
  Settings.set('difficulty.tierShift', 1e9);
  check('an imported shift past the limit reads as the limit', Difficulty.tierShift() === ADAPTIVE_SHIFT_LIMIT, Difficulty.tierShift());
  Game.playerId = playerId;
  Settings.set('difficulty.tierShift', shift); Settings.set('difficulty.adaptive', adaptive);
});

// PERF-006: team play (14f) measures distances with length2; a bot pays the player's price (a helmet over a full vest
// costs the rest).
Test.add('bots', (check) => {
  const sources = Object.values(BotTeam).concat(Object.values(BotEconomy), [spotKind]).filter((value) => typeof value === 'function').map(String).join();
  check('team play uses no Math.hypot', !sources.includes('Math.hypot'));
  startBotTest(botTestMap(false), 'bomb', { bots: [{ tier: 3, team: 0 }, { tier: 3, team: 1 }] });
  const bot = 0, helmet = CAT.buyItems.find((item) => item.kind === 'helmet');
  Actors.armor[bot] = Actors.maxArmor[bot] = helmet.amount;
  Economy.setMoney(bot, Economy.priceFor(bot, helmet));
  const bought = BotEconomy.buyBest(bot, (id, item) => (item.id === helmet.id ? 1 : 0));
  check('a bot with a vest buys the helmet at the price for a vest owner', bought && Economy.money(bot) === 0, Economy.money(bot) + ' left of ' + Economy.priceFor(bot, helmet));
  endBotTest();
});

// ---- Debug view (BOT-091/092): the HUD pass draws the nav graph, cones, labels and bars, and only while on ----
function countingHud() {
  return { width: 800, height: 600, lines: 0, rects: 0, texts: 0, line() { this.lines++; }, rect() { this.rects++; }, text() { this.texts++; return 0; } };
}

Test.add('bots', (check) => {
  const [bot] = startBotTest(botTestMap(false));
  runSeconds(0.5);
  const matrix = Render.frame.viewProjection, saved = Float32Array.from(matrix);
  matrix.fill(0); matrix[0] = 1 / 60; matrix[9] = 1 / 60; matrix[15] = 1;   // top-down: the 120 m arena fills the screen
  const hud = countingHud();
  BotDebug.drawHud(hud);
  check('off: the debug view draws nothing', hud.lines + hud.rects + hud.texts === 0);
  BotDebug.enabled = true; BotDebug.navStale = true;
  BotDebug.drawHud(hud);
  const stats = BotDebug.stats, text = JSON.stringify(stats) + ' nav ' + BotDebug.navCount;
  check('on: the nav graph is read once into its buffer', BotDebug.navCount > 50 && !BotDebug.navStale, text);
  check('on: nav lines and the vision cone reach the HUD', stats.lines > BOT_DEBUG_CONE_SEGMENTS + 2 && hud.lines === stats.lines, text);
  check('on: a label and the alert bar per bot', stats.labels >= 1 && stats.bars >= stats.labels && hud.texts === stats.labels && hud.rects === stats.bars * 2, text);
  check('every nav link type has a colour', BOT_DEBUG_LINK_COLORS.length === NAV_LINK_ROWS.length && BOT_DEBUG_LINK_COLORS.every(Boolean));
  BotDebug.labelText[bot] = 'kept';
  check('the label text is reused between refreshes', BotDebug.labelFor(bot) === 'kept');
  BotDebug.labelAt[bot] = -1e9;
  check('and rebuilt after one', BotDebug.labelFor(bot) !== 'kept');
  matrix.fill(0); matrix[0] = 1; matrix[5] = 1; matrix[11] = 1;   // w = z: points with z < 0 are behind the camera
  const before = stats.lines;
  debugWorldLine(hud, 0, 0, 5, 0, 0, -5, '#ffffff', 1);
  debugWorldLine(hud, 0, 0, -1, 0, 0, -5, '#ffffff', 1);
  check('a line through the camera plane is cut, one behind it is skipped', stats.lines === before + 1 && Number.isFinite(debugLineEnd.x));
  matrix.set(saved);
  BotDebug.enabled = false;
  endBotTest();
});

// ---- Data cross-checks: every trigger word, objective goal and hunted role the bot data names exists ----
const BOT_GADGET_UNUSED = ['launchpad'];   // a launch pad needs a planned route through the air: bots leave it alone

Test.add('bots', (check) => {
  const badAbilities = CAT.abilities.filter((row) => row.botUse && !BOT_USE_TRIGGERS[row.botUse.when]).map((row) => row.id);
  check('every ability botUse.when is a BOT_USE_TRIGGERS word', badAbilities.length === 0, badAbilities.join());
  const badGadgets = Object.keys(BOT_GADGET_USE).filter((effect) => !BOT_USE_TRIGGERS[BOT_GADGET_USE[effect].when]);
  check('every BOT_GADGET_USE trigger exists', badGadgets.length === 0, badGadgets.join());
  const unplanned = CAT.gadgets.filter((row) => !BOT_GADGET_USE[row.effect] && !BOT_GADGET_UNUSED.includes(row.effect)).map((row) => row.id);
  check('every gadget effect has a bot use (or is listed as unused)', unplanned.length === 0, unplanned.join());
  const goalWords = Object.values(OBJECTIVE_GOALS).flat().filter(Boolean), badGoals = goalWords.filter((word) => !BOT_OBJECTIVE_VERBS[word]);
  check('every objective goal word has a bot verb', badGoals.length === 0, badGoals.join());
  const badRoles = BOT_HUNTED_ROLES.filter((name) => !ACTOR_ROLE_NAMES.includes(name));
  check('every hunted role is an actor role', badRoles.length === 0, badRoles.join());
});

// ---- Perception: smoke blocks sight, a cloak shrinks it, an enemy mine is seen and passed crouched (or walked around),
// a frag heard landing close is run from (a smoke canister is not), a decoy's shot is remembered as its owner ----
const SMOKE_ROW = 'smoke', CLOAK_POWERUP = 'ghostveil', CROUCH_MINE = 'claymore', STEER_MINE = 'prox', DECOY_ROW = 'decoy';
const CLOAK_DISTANCE = 20, MINE_AHEAD = 3, GRENADE_HEARD_AT = 3, DECOY_X = 15, DECOY_ERROR = 5;
const DROP_HEIGHT = 1.5, DROP_SPEED = -4, DROP_FUSE = 5, HEAR_SECONDS = 1;   // a throwable dropped next to the bot bounces at once
const MINE_WALK_FROM = -10, MINE_WALK_TO = 12, MINE_WALK_SECONDS = 8, MINE_WALK_ARRIVED = 2, FAR_DUMMY = -50;

// Drops a gadget row owned by `owner` next to the bot (it bounces on the floor: the bounce sound of S12) and runs until
// the bot runs from it, at most HEAR_SECONDS; returns whether it ran.
function dropNextTo(bot, owner, rowId) {
  BotSense.dangerUntil[bot] = 0;
  Thrown.spawn(CAT.gadgets.byId(rowId), owner, Actors.x[bot] + GRENADE_HEARD_AT, DROP_HEIGHT, Actors.z[bot], 0, DROP_SPEED, 0, itemTicks(DROP_FUSE));
  const ran = runHeld(HEAR_SECONDS, () => holdActor(owner, 0, 10), () => BotSense.dangerUntil[bot] > Sim.time);
  if (ran) Sim.run(1);
  return ran;
}

// Runs up to `seconds`, calling hold() before every tick, until until() is true; returns whether it became true.
function runHeld(seconds, hold, until) {
  for (let tick = 0; tick < seconds * TICK_RATE; tick++) {
    hold();
    Sim.run(1);
    if (until && until()) return true;
  }
  return false;
}

Test.add('bots', (check) => {
  let [bot, dummy] = startBotTest(botTestMap(false));
  placeFacing(bot, 0, -10, 0);
  const holdBoth = () => { holdActor(bot, 0, -10); holdActor(dummy, 0, 10); };
  check('in the open the enemy is seen', runHeld(3, holdBoth, () => BotSense.sees(bot, dummy)));
  Smoke.spawn(CAT.gadgets.byId(SMOKE_ROW), -1, 0, 1, 0);
  const lost = runHeld(3, holdBoth, () => !BotSense.sees(bot, dummy));
  check('smoke between them blocks the line (Smoke.lineBlocked)', Smoke.lineBlocked(0, Actors.eyeY(bot), -10, 0, 1, 10));
  check('and the bot loses sight', lost);
  endBotTest();

  [bot, dummy] = startBotTest(botTestMap(false));
  placeFacing(bot, 0, -CLOAK_DISTANCE / 2, Math.PI);   // facing away for the first tick (the cloak is given after it)
  Sim.run(1);
  const given = Powerups.give(dummy, CAT.powerups.byId(CLOAK_POWERUP), 0);   // 0: the row's own duration
  placeFacing(bot, 0, -CLOAK_DISTANCE / 2, 0);
  const holdApart = () => { holdActor(bot, 0, -CLOAK_DISTANCE / 2); holdActor(dummy, 0, CLOAK_DISTANCE / 2); };
  check('a cloaked enemy 20 m ahead is not seen in 3 s', !runHeld(3, holdApart, () => BotSense.sees(bot, dummy)), BotSense.range(bot, dummy).toFixed(2));
  check('the cloak scales perception (Items.perceptionScale)', Items.perceptionScale(dummy) < 1, given + ' ' + Powerups.flags[dummy] + ' ' + Items.perceptionScale(dummy));
  endBotTest();

  [bot, dummy] = startBotTest(botTestMap(false));
  placeFacing(bot, 0, -10, 0);
  const mine = Devices.spawn(CAT.gadgets.byId(CROUCH_MINE), dummy, 0, 0, -10 + MINE_AHEAD);
  let noticed = false, crouched = false;
  runHeld(2, () => holdActor(dummy, 0, 10), () => {
    noticed = noticed || BotSense.mine[bot] === mine;
    crouched = crouched || (noticed && (Actors.buttons[bot] & BTN.CROUCH) !== 0);
    return crouched;
  });
  check('an enemy mine in sight is noticed (Gadgets.visibleTo)', noticed);
  check('and passed crouched (crouch-safe)', crouched);
  Devices.remove(mine, false);
  check('a frag heard landing close is run from', dropNextTo(bot, dummy, THROW_ROW) && Bots.wishX[bot] < 0, Bots.wishX[bot]);
  Thrown.clear();
  check('a smoke canister landing close is not (a harmless screen)', !dropNextTo(bot, dummy, SMOKE_ROW));
  Thrown.clear();
  endBotTest();

  // A real decoy (the row's effect, as when the thrown shell goes off) behind the wall, owned by the dummy.
  [bot, dummy] = startBotTest(botTestMap(true));
  placeFacing(bot, 0, -10, 0);
  holdActor(dummy, 0, 10);
  Sim.run(1);
  const decoy = CAT.gadgets.byId(DECOY_ROW), pair = BotSense.pair(bot, dummy);
  GadgetEffects[decoy.effect](decoy, dummy, DECOY_X, 0.1, 10);
  const heard = runHeld(1 / decoy.rate + 1, () => holdActor(dummy, 0, 10), () => BotSense.knows(bot, dummy, Sim.time));
  check('a decoy shot is remembered as its owner, where the decoy is', heard && Math.abs(BotSense.knownX[pair] - DECOY_X) < DECOY_ERROR, BotSense.knownX[pair]);
  endBotTest();
});

// A prox mine does not spare a crouched body: the bot walks around it (its path runs straight through it).
Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(false), 'ffa', { bots: [{ tier: 6 }, { dummy: true }] });
  placeFacing(bot, 0, MINE_WALK_FROM, 0);
  const mine = Devices.spawn(CAT.gadgets.byId(STEER_MINE), dummy, 0, 0, (MINE_WALK_FROM + MINE_WALK_TO) / 2);
  Devices.armTick[mine] = Sim.tick;    // armed at once
  Bots.nextDecide[bot] = Infinity;     // the test gives the destination
  BotMove.goTo(bot, 0, 0, MINE_WALK_TO, 1);
  let noticed = false;
  const passed = runHeld(MINE_WALK_SECONDS, () => holdActor(dummy, FAR_DUMMY, FAR_DUMMY), () => {
    noticed = noticed || BotSense.mine[bot] === mine;
    return Actors.z[bot] > MINE_WALK_TO - MINE_WALK_ARRIVED;
  });
  check('a prox mine on the path is noticed', noticed);
  check('and walked around: the bot gets past without setting it off', passed && Devices.active[mine] === 1 && Actors.alive[bot],
    Actors.x[bot].toFixed(2) + ',' + Actors.z[bot].toFixed(2) + ' mine ' + Devices.active[mine]);
  endBotTest();
});

// Item 37: a bot that runs up to a Use goal (loot, arm, disarm) on a large map stops and presses Use without boarding.
const USE_GOAL_MAP_SIZE = 200, USE_GOAL_Z = 15, USE_GOAL_RADIUS = 3, USE_GOAL_SECONDS = 6;

Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(false, { size: USE_GOAL_MAP_SIZE }), 'ffa', { bots: [{ tier: 6 }, { dummy: true }] });
  placeFacing(bot, 0, -10, 0);
  Bots.nextDecide[bot] = Infinity;     // the test gives the goal
  Object.assign(bestPlan, { goal: GOAL.OBJECTIVE, x: 0, y: 0, z: USE_GOAL_Z, radius: USE_GOAL_RADIUS, action: ACTION.USE, target: -1, score: 1 });
  BotDecide.apply(bot, Sim.time);
  let speedBefore = 0, pressSpeed = 0, boarded = false;
  const hold = () => { holdActor(dummy, FAR_DUMMY, FAR_DUMMY); speedBefore = Math.hypot(Actors.vx[bot], Actors.vz[bot]); };
  const pressed = runHeld(USE_GOAL_SECONDS, hold, () => {
    boarded = boarded || Move.onBoard(bot);
    if (Actors.pressed[bot] & BTN.USE) pressSpeed = speedBefore;   // the speed boarding reads in the Use step
    return pressSpeed > 0;
  });
  const runSpeed = Move.preset(bot).groundSpeed * SKIMMER_BOARD_RUN;
  check('a running bot reaches the Use goal and presses Use', pressed && pressSpeed >= runSpeed, pressSpeed.toFixed(2) + ' vs ' + runSpeed.toFixed(2));
  check('and stays off the Skimmer (it can still fire)', !boarded && !Move.onBoard(bot) && Move.canFire(bot));
  endBotTest();
});

// ---- Grenades on the solved arc (real Gadgets): two enemies together draw a frag that lands among them ----
const THROW_ROW = 'frag', THROW_DISTANCE = 15, THROW_LANDING = 4, THROW_SECONDS = 8;

const LONE_SECONDS = 4, ESCAPE_ULTIMATE = 'rift', STRIKE_ULTIMATE = 'orbital';

Test.add('bots', (check) => {
  const [bot, first, second] = startBotTest(botTestMap(false), 'ffa', { bots: [{ tier: 6 }, { dummy: true }, { dummy: true }] });
  placeFacing(bot, 0, -THROW_DISTANCE / 2, 0);
  Gadgets.give(bot, THROW_ROW, 2);
  const explosions = startEventLog('explosion');
  const hold = () => { holdActor(bot, 0, -THROW_DISTANCE / 2); holdActor(first, -1, THROW_DISTANCE / 2); holdActor(second, 1, THROW_DISTANCE / 2); };
  let ultimates = null;   // BOT-035 with both enemies in sight: an ultimate aimed at enemies goes, an escape one does not
  runHeld(THROW_SECONDS, hold, () => {
    if (!ultimates && BotCombat.visibleEnemies(bot) >= ULTIMATE_TARGETS && BotCombat.target[bot] >= 0) {
      ultimates = [ultimateWanted(bot, CAT.abilities.byId(STRIKE_ULTIMATE).botUse), ultimateWanted(bot, CAT.abilities.byId(ESCAPE_ULTIMATE).botUse)];
    }
    return explosions.some((event) => event.owner === bot);
  });
  explosions.stop();
  const blast = explosions.find((event) => event.owner === bot), miss = blast ? Math.hypot(blast.x, blast.z - THROW_DISTANCE / 2) : Infinity;
  check('a bot throws a grenade at two enemies together', BotCombat.uses.grenades > 0, BotCombat.uses.grenades);
  check('and it lands among them (within 4 m)', miss < THROW_LANDING, miss.toFixed(2));
  check('2+ enemies in sight: a strike ultimate is wanted, an escape ultimate is not', !!ultimates && ultimates[0] && !ultimates[1], String(ultimates));
  endBotTest();
});

// BOT-034: a lone enemy in the open, seen the whole time, draws no frag (no cover, no cluster, no held spot); a flash
// is thrown only from tier 3. uses counts this match only.
Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(false), 'ffa', { bots: [{ tier: 6 }, { dummy: true }] });
  placeFacing(bot, 0, -THROW_DISTANCE / 2, 0);
  Gadgets.give(bot, THROW_ROW, 2);
  check('kit use counts start at 0 every match', BotCombat.uses.grenades === 0 && BotCombat.uses.gadgets === 0 && BotCombat.uses.abilities === 0);
  let seen = true;
  runHeld(LONE_SECONDS, () => { holdActor(bot, 0, -THROW_DISTANCE / 2); holdActor(dummy, 0, THROW_DISTANCE / 2); }, () => {
    if (Sim.time > 1) seen = seen && BotSense.sees(bot, dummy);
    return false;
  });
  check('a lone enemy in the open draws no frag', seen && BotCombat.uses.grenades === 0 && Gadgets.countOf(bot, THROW_ROW) === 2, BotCombat.uses.grenades + ' seen ' + seen);
  const flashAnywhere = Object.assign({}, BOT_GADGET_USE.flash, { when: 'always', range: [0, 0], chance: 1 });
  const tierSix = botUseWanted(bot, flashAnywhere);
  DebugApi.setTier(bot, BOT_GADGET_USE.flash.tier - 1);
  check('flash before a peek only from tier 3', tierSix && !botUseWanted(bot, flashAnywhere));
  endBotTest();
});

// A toggle pressed off that did not take is pressed again 0.5 s later, released in between (every press a new edge).
const TOGGLE_ROW = 'bulwark', TOGGLE_WATCH_SECONDS = 1.3;

Test.add('bots', (check) => {
  const [bot] = startBotTest(botTestMap(false), 'ffa', { bots: [{ tier: 6 }, { dummy: true }] });
  runSeconds(0.2);
  Abilities.setSlot(bot, 0, CAT.abilities.byId(TOGGLE_ROW));
  const index = Abilities.index(bot, 0), presses = [];
  BotCombat.switchedOnAt[bot * PRESSABLE_SLOTS] = 0;   // switched on at the start; its trigger (under fire) does not hold
  for (let tick = 0; tick < TOGGLE_WATCH_SECONDS * TICK_RATE; tick++) {
    Abilities.active[index] = 1;   // every off press "does not take"
    Sim.run(1);
    if (Actors.buttons[bot] & BTN.ABILITY1) presses.push(tick);
  }
  Abilities.active[index] = 0;
  const separate = presses.every((tick, i) => i === 0 || tick - presses[i - 1] >= ABILITY_MIN_ON * TICK_RATE - 1);
  check('an off press that did not take is retried every 0.5 s, released in between', presses.length >= 2 && presses.length <= 3 && separate, presses.join());
  endBotTest();
});

// ---- BOT-050 CTF splits: enemy flag home 20% defend, 20% escort, the rest attack; enemy flag taken 60% defend, 30%
// escort (from the next commander round). BOT-002: a chase on stale memory is the Search state ----
Test.add('bots', (check) => {
  playMatch({ mode: 'ctf', map: 'twinkeeps', minutes: 1 / 60, botCount: 10, seed: 1, modeOptions: SOAK_OPEN_MATCH, probe: () => {
    const team = [], roles = () => team.map((id) => ROLE_NAMES[BotTeam.role[id]]).sort().join();
    for (let id = 0; id < Actors.count; id++) if (Bots.active[id] && Actors.team[id] === 0) team.push(id);
    BotTeam.assignRoles();
    check('ctf, flags home: 1 defend, 1 escort, 3 attack of 5', team.length === 5 && roles() === 'attack,attack,attack,defend,escort', roles());
    const enemyFlag = Modes.objectives.find((o) => o.kind === 'flag' && o.team === 1);
    enemyFlag.carrier = team[0];
    BotTeam.assignRoles();
    check('ctf, enemy flag taken: 3 defend, 2 escort', roles() === 'defend,defend,defend,escort,escort', roles());
    enemyFlag.carrier = -1;
    const chaser = team[0], target = Actors.count - 1, pair = BotSense.pair(chaser, target), plan = { goal: GOAL.CHASE, target };
    BotSense.knownAt[pair] = Sim.time - 1;
    const fresh = BotDecide.goalState(chaser, plan, Sim.time);
    BotSense.knownAt[pair] = Sim.time - 3;
    check('a chase on fresh memory is Chase, on memory older than 2 s Search', fresh === BOT_STATE.CHASE && BotDecide.goalState(chaser, plan, Sim.time) === BOT_STATE.SEARCH);
  } });
});

// ---- BOT-070 / BOT-034 tier flags and T12: flanks (a far chase goes round by a flank hint), weaponJumps with weaponJumper
// (a splash shot at the feet in a jump up to a goal on a ledge), flashPeek (the flash grenade's tier gate) ----
Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(false, { navHints: [{ kind: 'flank', x: 12, y: 0, z: 10 }] }), 'ffa', { bots: [{ tier: 5 }, { dummy: true }] });
  const plan = { score: 0, x: 0, y: 0, z: 0, radius: 1, action: ACTION.MOVE, target: -1 }, pair = BotSense.pair(bot, dummy);
  placeFacing(bot, 0, -10, 0); placeFacing(dummy, 0, 20, Math.PI);
  BotSense.knownAt[pair] = Sim.time; BotSense.knownX[pair] = 0; BotSense.knownY[pair] = 0; BotSense.knownZ[pair] = 20;
  BotCombat.target[bot] = dummy;
  GOAL_SCORERS[GOAL.CHASE](bot, plan, Sim.time);
  check('a flanking tier chases a far target round by the flank hint', BotDecide.flankSpot[bot] === 0 && plan.x === 12 && plan.z === 10, plan.x + ',' + plan.z);
  BotDecide.flankedAt[bot] = Sim.time;
  GOAL_SCORERS[GOAL.CHASE](bot, plan, Sim.time);
  check('right after a flank the chase goes straight', BotDecide.flankSpot[bot] === -1 && plan.z === 20);
  giveWeaponJumper(bot);
  BotCombat.target[bot] = -1;
  Motion.grounded[bot] = 1; Actors.health[bot] = Actors.maxHealth[bot];
  BotDecide.goal[bot] = GOAL.ROAM; BotDecide.goalX[bot] = 0; BotDecide.goalY[bot] = 3; BotDecide.goalZ[bot] = -5;
  BotMove.state[bot] = PATH.FAILED;   // no way to walk there (the ledge tests below cover walkable paths)
  check('a weapon jumper with a launcher wants to jump to a goal 3 m up with no way to walk there', BotCombat.wantsWeaponJump(bot, Sim.time));
  Actors.aimPitch[bot] = -80 * DEG;
  Bots.buttonsWanted[bot] = 0;
  BotCombat.weaponJump(bot, Sim.time);
  const pressed = Bots.buttonsWanted[bot];
  check('looking down it jumps and fires in one step', (pressed & BTN.JUMP) !== 0 && (pressed & BTN.FIRE) !== 0 && BotCombat.uses.weaponJumps === 1, pressed);
  check('one weapon jump at a time (6 s rest)', !BotCombat.wantsWeaponJump(bot, Sim.time + 1));
  Bots.traits[bot * TRAIT_COUNT + TRAIT.weaponJumper] = BOT_TRAIT_NEUTRAL;
  check('a bot without the weapon jumper trait does not', !BotCombat.wantsWeaponJump(bot, Sim.time + WEAPON_JUMP_REST + 1));
  check('the flash grenade is gated by the flashPeek tier flag', BOT_GADGET_USE.flash.tierFlag === 'flashPeek' && CAT.botTiers.every((row) => row.flashPeek === row.tier >= 3));
  endBotTest();
});

// ---- BOT-052 squads (versus): role squads of up to 3 led by the most teamwork, a broken-off follower regroups, a fallen
// leader hands the squad on. BOT-053 tokens: two bots close in on one target, one flanks per team. BOT-002 Search, Downed ----
Test.add('bots', (check) => {
  const map = botTestMap(false, { navHints: [{ kind: 'flank', x: 12, y: 0, z: 10 }] }), tier5 = { tier: 5, team: 0 };
  const ids = startBotTest(map, 'tdm', { ruleset: 'modern', balance: false, bots: [tier5, tier5, tier5, tier5, { dummy: true, team: 1 }] });
  const enemy = ids[4], plan = { score: 0, x: 0, y: 0, z: 0, radius: 1, action: ACTION.MOVE, target: -1 };
  BotTeam.assignRoles();
  const attackers = ids.filter((id) => Bots.active[id] && BotTeam.role[id] === ROLE.ATTACK), leader = BotTeam.squadLeader[attackers[0]];
  const followers = attackers.filter((id) => id !== leader), teamwork = (id) => Bots.trait(id, TRAIT.teamwork);
  check('BOT-052 the 3 attackers form one squad led by the one with the most teamwork', attackers.length === 3 && followers.length === 2
    && attackers.every((id) => BotTeam.squadLeader[id] === leader && teamwork(id) <= teamwork(leader)), attackers.map((id) => BotTeam.squadLeader[id]).join());
  placeFacing(leader, 0, -10, 0); placeFacing(followers[0], 20, -10, 0);
  const far = GOAL_SCORERS[GOAL.SQUAD](followers[0], plan, Sim.time);
  const toLeader = plan.x === Actors.x[leader] && plan.z === Actors.z[leader] && plan.radius === BOT_SQUAD.keep;
  placeFacing(followers[0], 3, -10, 0);
  const near = GOAL_SCORERS[GOAL.SQUAD](followers[0], plan, Sim.time);
  check('BOT-052 a broken-off follower regroups (it scores above keeping with the leader, which beats roaming)', toLeader && far > near && near > ROAM_SCORE,
    far.toFixed(2) + ' / ' + near.toFixed(2));
  check('BOT-052 the leader has no squad goal', GOAL_SCORERS[GOAL.SQUAD](leader, plan, Sim.time) === 0);
  Actors.flags[leader] &= ~ACTOR_FLAG.PROTECTED;
  TestArena.hit(-1, leader, 1000); TestArena.hit(-1, leader, 1000);   // downed, then finished
  const heir = BotTeam.squadLeader[followers[0]];
  check('BOT-052 a fallen leader hands the squad to its next follower', !Actors.alive[leader] && heir === followers[0]
    && BotTeam.squadLeader[followers[1]] === heir && BotTeam.squadLeader[leader] === heir, heir);

  const [first, second, third] = ids.filter((id) => Bots.active[id] && Actors.alive[id]), now = Sim.time;
  for (const id of [first, second, third]) BotDecide.goal[id] = GOAL.ATTACK;
  const both = BotTeam.takeAttackToken(first, enemy, now) && BotTeam.takeAttackToken(second, enemy, now);
  const blocked = !BotTeam.takeAttackToken(third, enemy, now), renewed = BotTeam.takeAttackToken(first, enemy, now + 1);
  const lapsed = BotTeam.takeAttackToken(third, enemy, now + 1 + 0.5);   // the second let its hold (BOT_TOKENS.hold) run out
  check('BOT-053 two bots close in on one target, a third waits until a holder lets its token lapse', both && blocked && renewed && lapsed);
  const weapon = Weapons.currentWeapon(second), range = weapon.botPref.range[1];
  BotTeam.takeAttackToken(first, enemy, now + 1.5); BotTeam.takeAttackToken(third, enemy, now + 1.5);
  holdActor(enemy, 0, 20); placeFacing(second, 0, 20 - range - 10, 0);
  BotSense.visible[BotSense.pair(second, enemy)] = 1; BotCombat.target[second] = enemy;
  const score = GOAL_SCORERS[GOAL.ATTACK](second, plan, now + 1.5);
  BotSense.visible[BotSense.pair(second, enemy)] = 0; BotCombat.target[second] = -1;
  check('BOT-053 without a token a bot comes no nearer than its weapon range', score > 0 && plan.radius === range && weapon.class !== 'melee', score.toFixed(2) + ' r ' + plan.radius);

  const later = now + 5, flanks = [];
  for (const id of [first, third]) {
    const pair = BotSense.pair(id, enemy);
    placeFacing(id, 0, -10, 0);
    BotSense.knownAt[pair] = later; BotSense.knownX[pair] = 0; BotSense.knownY[pair] = 0; BotSense.knownZ[pair] = 20;
    BotCombat.target[id] = enemy; BotDecide.goal[id] = GOAL.CHASE;
    GOAL_SCORERS[GOAL.CHASE](id, plan, later);
    flanks.push(BotDecide.flankSpot[id]);
  }
  check('BOT-053 one bot of a team flanks at a time (the other chases straight)', flanks[0] === 0 && flanks[1] === -1 && plan.z === 20, flanks.join());

  const pair = BotSense.pair(first, enemy), spots = [];
  BotDecide.goalTarget[first] = enemy; BotDecide.searchLeft[first] = SEARCH_SPOTS;
  BotSense.knownAt[pair] = Sim.time; BotSense.knownX[pair] = 0; BotSense.knownZ[pair] = 5;
  for (let spot = 0; spot < SEARCH_SPOTS; spot++) {
    BotDecide.searched(first);
    spots.push(BotSense.knows(first, enemy, Sim.time) ? BotSense.knownX[pair].toFixed(1) + ',' + BotSense.knownZ[pair].toFixed(1) : 'lost');
  }
  BotDecide.searched(first);
  check('BOT-002 a search looks at 2 nearby spots past the last known position, then gives up', !spots.includes('lost') && spots[0] !== '0.0,5.0'
    && !BotSense.knows(first, enemy, Sim.time), spots.join(' '));
  Actors.flags[first] |= ACTOR_FLAG.DOWNED;
  const downed = BotDecide.goalState(first, { goal: GOAL.ROAM, target: -1 }, Sim.time);
  Actors.flags[first] &= ~ACTOR_FLAG.DOWNED;
  check('BOT-002 Downed and Revive states', downed === BOT_STATE.DOWNED && BotDecide.goalState(first, { goal: GOAL.REVIVE, target: -1 }, Sim.time) === BOT_STATE.REVIVE);
  endBotTest();
});

// BOT-002 Search in play: a bot chasing stale memory (the enemy is behind the wall) walks on to a nearby spot after the
// last known one, instead of skipping both spots on the ticks after its arrival.
const SEARCH_TEST_SPOT = [10, -6], SEARCH_TEST_STALE = 3, SEARCH_TEST_REACH = 2.5, SEARCH_TEST_WALK = 3;
Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(true));
  placeFacing(bot, 0, -10, 0);
  holdActor(dummy, 0, 10);
  const pair = BotSense.pair(bot, dummy), spots = [];
  BotSense.knownAt[pair] = Sim.time - SEARCH_TEST_STALE;
  BotSense.knownX[pair] = SEARCH_TEST_SPOT[0]; BotSense.knownY[pair] = 0; BotSense.knownZ[pair] = SEARCH_TEST_SPOT[1];
  let lastX = SEARCH_TEST_SPOT[0], lastZ = SEARCH_TEST_SPOT[1];
  for (let tick = 0; tick < SENSE_MEMORY * TICK_RATE && BotSense.knows(bot, dummy, Sim.time); tick++) {
    holdActor(dummy, 0, 10);
    Sim.run(1);
    const x = BotSense.knownX[pair], z = BotSense.knownZ[pair], away = length2(x - Actors.x[bot], z - Actors.z[bot]);
    if (x !== lastX || z !== lastZ) { spots.push({ x, z, away, nearest: away }); lastX = x; lastZ = z; }
    for (const spot of spots) spot.nearest = Math.min(spot.nearest, length2(spot.x - Actors.x[bot], spot.z - Actors.z[bot]));
  }
  const walked = spots.filter((spot) => spot.away > SEARCH_TEST_WALK && spot.nearest < SEARCH_TEST_REACH);
  check('BOT-002 a searching bot walks to a nearby spot past the last known position before it gives up', walked.length > 0,
    spots.map((spot) => spot.away.toFixed(1) + '->' + spot.nearest.toFixed(1)).join(' '));
  endBotTest();
});

// A rocket launcher in hand and the weapon jumper trait (T12).
function giveWeaponJumper(bot) {
  const launcher = CAT.weapons.find((weapon) => weapon.primary.splash && weapon.primary.projectile === 'rocket');
  Weapons.give(bot, launcher.id); Weapons.current[bot] = launcher.index; Weapons.state[bot] = WEAPON_STATE.IDLE;
  Bots.traits[bot * TRAIT_COUNT + TRAIT.weaponJumper] = 0.95;
}

// ---- BOT-034 smoke at chokes: an attacking bot smokes the choke hint on its way to its target (not one off the way,
// not one right at the target, and not while it only roams), once per CHOKE_SMOKE_REST s ----
const CHOKE_SMOKE_ROW = 'smoke', CHOKE_ON_WAY = { kind: 'choke', x: 0, y: 0, z: 0 }, CHOKE_OFF_WAY = { kind: 'choke', x: 15, y: 0, z: 0 };

Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(false, { navHints: [CHOKE_OFF_WAY, CHOKE_ON_WAY, { kind: 'flank', x: 9, y: 0, z: 9 }] }));
  const pair = BotSense.pair(bot, dummy);
  let now = Sim.time + GRENADE_TOKEN_INTERVAL;
  placeFacing(bot, 0, -10, 0);
  Gadgets.give(bot, CHOKE_SMOKE_ROW, 2); Gadgets.select(bot, CHOKE_SMOKE_ROW);
  BotCombat.target[bot] = dummy;
  BotSense.knownAt[pair] = Sim.time; BotSense.knownX[pair] = 0; BotSense.knownY[pair] = 0; BotSense.knownZ[pair] = 14;
  check('the match reads the choke hints', BotDecide.chokeSpots.length === 2);
  BotDecide.goal[bot] = GOAL.ROAM;
  BotCombat.tryGrenade(bot, now);
  check('a roaming bot smokes no choke', BotCombat.throwUntil[bot] < now);
  BotDecide.goal[bot] = GOAL.CHASE;
  BotCombat.tryGrenade(bot, now);
  const pitch = solveThrowPitch(10 - THROW_FORWARD, CHOKE_ON_WAY.y - Actors.eyeY(bot));
  check('chasing, it throws the smoke at the choke on its way', BotCombat.throwUntil[bot] > now && Math.abs(BotCombat.throwYaw[bot]) < 1e-6
    && Math.abs(BotCombat.throwPitch[bot] - pitch) < 1e-6, BotCombat.throwYaw[bot] + ' ' + BotCombat.throwPitch[bot]);
  BotCombat.throwUntil[bot] = 0; now += GRENADE_TOKEN_INTERVAL;
  BotCombat.tryGrenade(bot, now);
  check('one choke smoke per rest', BotCombat.throwUntil[bot] === 0);
  now += CHOKE_SMOKE_REST; BotDecide.goal[bot] = GOAL.ATTACK; BotSense.knownZ[pair] = 2;
  BotCombat.tryGrenade(bot, now);
  check('a target right past the choke draws no choke smoke', BotCombat.throwUntil[bot] === 0);
  endBotTest();
});

// A class loadout gives the lethal first, so the frag is selected: the chasing bot presses CYCLE_GRENADE (one honest
// input edge through the sim), and at its next kit check throws the smoke at the choke.
Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(false, { navHints: [CHOKE_ON_WAY] }));
  const pair = BotSense.pair(bot, dummy), smoke = CAT.gadgets.byId(CHOKE_SMOKE_ROW);
  const now = Sim.time + GRENADE_TOKEN_INTERVAL;
  const aimAtTarget = () => {
    BotDecide.goal[bot] = GOAL.CHASE; BotCombat.target[bot] = dummy;
    BotSense.knownAt[pair] = Sim.time; BotSense.knownX[pair] = 0; BotSense.knownY[pair] = 0; BotSense.knownZ[pair] = 14;
  };
  placeFacing(bot, 0, -10, 0);
  Gadgets.clearGrenades(bot); Gadgets.give(bot, 'frag', 1); Gadgets.give(bot, CHOKE_SMOKE_ROW, 1);
  check('frag then smoke: the frag is the selected type', Gadgets.grenade[bot] === CAT.gadgets.byId('frag').index);
  aimAtTarget();
  BotCombat.tryGrenade(bot, now);
  check('the chasing bot presses CYCLE_GRENADE and plans no throw yet', (Bots.buttonsWanted[bot] & BTN.CYCLE_GRENADE) !== 0
    && BotCombat.throwUntil[bot] < now);
  Actors.buttons[bot] = Bots.buttonsWanted[bot];
  Sim.run(1);
  check('the press selects the smoke', Gadgets.grenade[bot] === smoke.index);
  aimAtTarget();
  BotCombat.tryGrenade(bot, now);
  const towardChoke = Math.atan2(CHOKE_ON_WAY.x - Actors.x[bot], CHOKE_ON_WAY.z - Actors.z[bot]);
  check('at the next check it throws the smoke at the choke', BotCombat.throwUntil[bot] > now && BotCombat.chokeSmokedAt[bot] === now
    && Math.abs(wrapAngle(BotCombat.throwYaw[bot] - towardChoke)) < 1e-6, BotCombat.throwYaw[bot] + ' ' + towardChoke);
  Actors.buttons[bot] = 0; Sim.run(1);   // the earlier press is let go, so the next one is a new press
  Bots.buttonsWanted[bot] = 0; BotCombat.throwUntil[bot] = -1e9;   // the smoke has left the hand
  aimAtTarget();
  BotCombat.tryGrenade(bot, now + KIT_CHECK_INTERVAL);
  Actors.buttons[bot] = Bots.buttonsWanted[bot];
  Sim.run(1);
  check('after the choke it cycles back to the frag it had selected (frags are thrown again)', Gadgets.grenade[bot] === CAT.gadgets.byId('frag').index, Gadgets.grenade[bot]);
  endBotTest();
});

// ---- M20 squads (audit 12): a squadmate far from its leader goes back to it; with a squadmate out, a bot holds Use at
// the squad's beacon until the beacon brings it back (the ring wins over a beacon outside it) ----
const SQUAD_ENTRIES = [{ dummy: true }, { dummy: true }, { tier: 3 }, { dummy: true }, { dummy: true }, { dummy: true }];
const SQUAD_DROP_SECONDS = 3, SQUAD_FAR = 30, SQUAD_MIDDLE = 18, SQUAD_NEAR = 5, ENEMY_BEHIND_WALL = 20;

Test.add('bots', (check) => {
  const [leader, enemy, bot, enemy2, mate, enemy3] = startBotTest(botTestMap(true), 'royale', { bots: SQUAD_ENTRIES });
  const squads = Modes.squads, plan = { score: 0, x: 0, y: 0, z: 0, radius: 1, action: ACTION.MOVE, target: -1 };
  runSeconds(SQUAD_DROP_SECONDS);   // the drop-in lands
  check('six actors make two squads of three', squads.count === 2 && Actors.team[bot] === 0 && Actors.team[leader] === 0 && Actors.team[mate] === 0);
  BotTeam.assignRoles();
  check('M20 squads are the only squads: no versus role squads (BOT-052) on top', [leader, bot, mate].every((id) => BotTeam.squadLeader[id] === -1));
  const side = Math.sign(squads.beaconZ[0]) || 1, beaconX = squads.beaconX[0], beaconZ = squads.beaconZ[0];
  placeActor(leader, beaconX, beaconZ); placeActor(bot, beaconX + SQUAD_FAR, beaconZ);
  check('a squadmate far from its leader goes back to it', planSquad(bot, plan) && plan.x === Actors.x[leader] && plan.z === Actors.z[leader]
    && plan.action === ACTION.MOVE && plan.score === SQUAD_FOLLOW_URGENCY, JSON.stringify(plan));
  placeActor(bot, beaconX + SQUAD_MIDDLE, beaconZ); BotCombat.target[bot] = -1;
  const followsFree = planSquad(bot, plan);
  BotCombat.target[bot] = enemy;
  check('in between, it goes back only without a fight (a target keeps it up to SQUAD_FIGHT_KEEP m)', followsFree && !planSquad(bot, plan));
  BotCombat.target[bot] = -1;
  placeActor(bot, beaconX + SQUAD_NEAR, beaconZ);
  check('near its leader it is free, and the leader follows nobody', !planSquad(bot, plan) && !planSquad(leader, plan));
  Actors.alive[mate] = 0;
  runSeconds(LOOT_CHECK_INTERVAL * 2);   // the beacon tallies its squads at 10 Hz
  check('the ring area is known', Modes.hud.zoneRadius > 0 && insideSafeArea(beaconX, beaconZ));
  check('a squadmate out: the bot goes to hold Use at the squad beacon', planSquad(bot, plan) && plan.action === ACTION.USE
    && plan.x === beaconX && plan.z === beaconZ && plan.score === BEACON_URGENCY, JSON.stringify(plan));
  squads.beaconX[0] = Modes.hud.zoneX + Modes.hud.zoneRadius * 2;
  check('a beacon the ring left outside is not gone to (near its leader the bot is free)', !planSquad(bot, plan));
  squads.beaconX[0] = beaconX;
  const hold = () => { for (const id of [enemy, enemy2, enemy3]) holdActor(id, 0, -side * ENEMY_BEHIND_WALL); };
  runHeld(BEACON_SECONDS + 2, hold, () => Actors.alive[mate] === 1);
  check('the bot brings its squadmate back at the beacon', Actors.alive[mate] === 1 && squads.beaconUses[0] === Game.match.rules.params.squadBeacons - 1,
    'goal ' + GOAL_NAMES[BotDecide.goal[bot]] + ' at ' + Actors.x[bot].toFixed(1) + ',' + Actors.z[bot].toFixed(1));
  endBotTest();
});

// The weapon jump on real paths: to a ledge 3 m up with no way to walk there, the blast (on the far side of the bot) lifts
// it up and toward the goal; with a ramp up beside it the bot walks instead (no self-damage for nothing).
const JUMP_LEDGE = { shape: 'box', min: [-4, 0, -4], max: [4, 3, 0] }, JUMP_RAMP = { shape: 'ramp', dir: '+z', min: [1, 0, -10], max: [4, 3, -4] };
const JUMP_FROM = [-2, -8], JUMP_GOAL_Z = -2, JUMP_SECONDS = 3;

function runLedgeGoal(brushes) {
  const [bot, dummy] = startBotTest(botTestMap(false, { brushes: [TEST_FLOOR, ...brushes] }), 'ffa', { bots: [{ tier: 5 }, { dummy: true }] });
  placeFacing(bot, JUMP_FROM[0], JUMP_FROM[1], 0);
  giveWeaponJumper(bot);
  Bots.nextDecide[bot] = Infinity;     // the test gives the goal
  Object.assign(bestPlan, { goal: GOAL.ROAM, x: 0, y: JUMP_LEDGE.max[1], z: JUMP_GOAL_Z, radius: 1, action: ACTION.MOVE, target: -1, score: 1 });
  BotDecide.apply(bot, Sim.time);
  const result = { startDistance: Math.abs(JUMP_GOAL_Z - Actors.z[bot]), closest: Infinity, topY: 0, jumps: 0, health: 0 };
  runHeld(JUMP_SECONDS, () => holdActor(dummy, FAR_DUMMY, FAR_DUMMY), () => {
    result.topY = Math.max(result.topY, Actors.y[bot]); result.closest = Math.min(result.closest, Math.abs(JUMP_GOAL_Z - Actors.z[bot]));
    return false;
  });
  result.jumps = BotCombat.uses.weaponJumps; result.health = Actors.health[bot];
  endBotTest();
  return result;
}

Test.add('bots', (check) => {
  const ledge = runLedgeGoal([JUMP_LEDGE]);
  check('a weapon jump lifts the bot up to the ledge and toward its goal', ledge.jumps === 1 && ledge.topY >= JUMP_LEDGE.max[1] && ledge.closest < ledge.startDistance - 1,
    JSON.stringify(ledge));
  const ramp = runLedgeGoal([JUMP_LEDGE, JUMP_RAMP]);
  check('with a ramp up there the bot walks (no weapon jump)', ramp.jumps === 0 && ramp.topY >= JUMP_LEDGE.max[1] - 0.1, JSON.stringify(ramp));
});


// ---- Flag raids: the rally is a meeting place (no held spot), and a raider already past it keeps going ----
Test.add('bots', (check) => {
  const plan = { score: 0, x: 0, y: 0, z: 0, radius: 1, action: ACTION.MOVE, target: -1 };
  playMatch({ mode: 'ctf', map: 'twinkeeps', minutes: 1 / 60, botCount: 4, seed: 1, modeOptions: SOAK_OPEN_MATCH, probe: () => {
    let raider = -1;
    for (let id = 0; id < Actors.count && raider < 0; id++) if (Bots.active[id] && Actors.team[id] === 0) raider = id;
    const own = Modes.objectives.find((o) => o.kind === 'flag' && o.team === 0), enemy = Modes.objectives.find((o) => o.kind === 'flag' && o.team === 1);
    BotTeam.role[raider] = ROLE.ATTACK;
    BotTeam.pushUntil[0] = 0;
    placeActor(raider, own.homeX, own.homeZ);
    planFlags(raider, plan);
    const atRally = plan.target === -1 && Math.hypot(plan.x - BotTeam.rallyX[0], plan.z - BotTeam.rallyZ[0]) <= BOT_FLAG_PUSH.radius;
    check('a raider at home goes to the rally point', BotTeam.hasRally(0) && atRally, plan.target + ' ' + plan.x.toFixed(1) + ',' + plan.z.toFixed(1));
    check('the rally is not a held spot (no mines, turrets or channels there)', plan.action === ACTION.MOVE);
    placeActor(raider, lerp(own.homeX, enemy.homeX, 0.8), lerp(own.homeZ, enemy.homeZ, 0.8));
    planFlags(raider, plan);
    check('a raider past the rally keeps going for the enemy flag when no push runs', plan.target === enemy.index, plan.target);
  } });
});

// ---- MUT-003: bots adapt to the mutator rules ----
function withMutator(id, value, read) {
  const ids = startBotTest(botTestMap(false), 'ffa', { bots: [{ tier: 6 }, { dummy: true }], mutators: id ? [{ id, value }] : [] });
  runSeconds(0.2);
  try { return read(ids[0], ids[1]); } finally { endBotTest(); }
}

Test.add('bots', (check) => {
  const point = Vec.make(), head = Vec.make();
  const plainGun = CAT.weapons.find((row) => row.primary && row.primary.type === 'hitscan' && !row.primary.splash);
  const aimsAtHead = withMutator('headonly', true, (bot, dummy) => {
    BotCombat.aimPoint(bot, dummy, plainGun, 30, point);
    Hitbox.point(dummy, ZONE.HEAD, head);
    return point.y === head.y;
  });
  check('headshots only: even a poor aim goes for the head', aimsAtHead);
  check('sky duel: no shots at a grounded target without splash', withMutator('airborne', true, (bot, dummy) => !worthShooting(dummy, plainGun)));
  const normalDodge = withMutator('', 0, (bot) => dodgeChance(bot)), oneHitDodge = withMutator('oneshot', true, (bot) => dodgeChance(bot));
  const moreDodge = oneHitDodge > normalDodge || normalDodge >= DODGE_CHANCE_CAP;
  check('one-shot: dodging matters more (still capped)', moreDodge && oneHitDodge >= ONE_HIT_DODGE_FLOOR && oneHitDodge <= DODGE_CHANCE_CAP, normalDodge + ' -> ' + oneHitDodge);
  const normalDrop = withMutator('', 0, (bot) => BotMove.options[bot].maxDrop), freeDrop = withMutator('freejump', true, (bot) => BotMove.options[bot].maxDrop);
  check('no fall damage: paths may drop as far as the nav allows', normalDrop === Nav.limits.safeDrop && freeDrop === Nav.limits.maxDrop);
  const normalJump = withMutator('', 0, (bot) => BotMove.options[bot].allowJumpHeight), lowJump = withMutator('gravity', 50, (bot) => BotMove.options[bot].allowJumpHeight);
  check('low gravity: higher jump links are allowed', lowJump > normalJump * 1.5, normalJump.toFixed(2) + ' -> ' + lowJump.toFixed(2));
  check('more damage dealt: fights are worth more', withMutator('dmgout', 200, () => mutatorRisk()) > 1);
  check('more damage taken: fights are worth less', withMutator('dmgin', 200, () => mutatorRisk()) < 1);
});

// ---- Difficulty: the game speed through rules.fx (the PvE damage sliders: group 'simwire') ----
Test.add('bots', (check) => {
  const fast = { preset: BOT_DEFAULT_DIFFICULTY, gameSpeed: 1.2 };
  const pve = Rules.build({ mode: 'horde', difficulty: fast }), versus = Rules.build({ mode: 'ffa', difficulty: fast });
  check('game speed slider scales rules.fx.timeScale in PvE and versus (ACC-007 assist)', pve.fx.timeScale === 1.2 && versus.fx.timeScale === 1.2, pve.fx.timeScale + ' / ' + versus.fx.timeScale);
  check('the default game speed leaves the time scale alone', (Rules.build({ mode: 'ffa' }).fx || {}).timeScale === undefined);
  startBotTest(botTestMap(false, { spawns: TEAM_SPAWNS }), 'tdm', { difficulty: 'skilled', bots: [{}, {}, {}, {}, {}, {}] });
  const teamTiers = [0, 0];
  for (let id = 0; id < Actors.count; id++) if (Bots.active[id]) teamTiers[Actors.team[id]] += Bots.tier(id).tier;
  check('tiers are spread in pairs: both teams get the same tier mix', teamTiers[0] === teamTiers[1], teamTiers.join(' v '));
  endBotTest();
});

// ---- Kit use (abilities, grenades, gadgets) in headless matches: bot k carries kit k every life ----
// Rounds: dom on twinkeeps (objectives to hold and contest), team deathmatch in the open arena and in the room (close fights).
const KIT_ROUNDS = [{ mode: 'dom', map: 'twinkeeps', seed: 1 }, { mode: 'tdm', map: BOT_ARENA, seed: 2 }, { mode: 'tdm', map: BOT_ROOM, seed: 3 },
  { mode: 'dom', map: 'twinkeeps', seed: 4 }];
const KIT_QUICK_ROUND = KIT_ROUNDS[1];
const KIT_BOTS = 8, KIT_TIER = 6, KIT_SLOTS = 2, KIT_GRENADES = 3, KIT_METER_FILL = 1e4;
const KIT_ROWS = KIT_BOTS, KIT_GADGET_ROWS = KIT_BOTS / 2;   // ability rows / thrown and other gadget rows per match
const DOWNED_RULESET = 'royale';
const KIT_SKIPPED_ACTIVATIONS = ['passive', 'ult'];   // these run by themselves: there is nothing to press

// Abilities a bot presses (rows limited to a family no versus mode has are left to that family's matches).
function pressableAbilities() { return CAT.abilities.filter((row) => !KIT_SKIPPED_ACTIVATIONS.includes(row.activation) && row.modes === 'any'); }

// Kits for one match: every row on two bots (bot k: rows[k % n] in slot 0, rows[(k + 1) % n] in slot 1). Fights are
// short; two carriers give each row more chances to meet its trigger.
function abilityKits(rows) {
  return Array.from({ length: KIT_BOTS }, (_, k) => ({ abilities: [rows[k % rows.length], rows[(k + 1) % rows.length]], gadgets: [] }));
}

// Bot k gets thrown[k % count] and placed[k % count]: every row on two bots.
function gadgetKits(thrown, placed) {
  return Array.from({ length: KIT_BOTS }, (_, k) => ({ abilities: [], gadgets: [thrown[k % thrown.length], placed[k % placed.length]].filter(Boolean) }));
}

function equipKit(id, kits) {
  const kit = Actors.kind[id] === ACTOR_KIND.BOT ? kits[id % KIT_BOTS] : null;
  if (!kit) return;
  kit.abilities.forEach((row, slot) => Abilities.setSlot(id, slot, row));
  for (const row of kit.gadgets) {
    Gadgets.give(id, row.id, row.kind === 'thrown' ? KIT_GRENADES : 1);
    Gadgets.select(id, row.id);   // bots throw the selected grenade type (they cycle only to smoke a choke)
  }
}

// Abilities pay with energy or the match meter; a sweep keeps both full so every row gets its chance.
function fillMeters(tick) {
  if (tick % TICK_RATE !== 0) return;
  const energy = CAT.meters.byId('energy').max;
  for (let id = 0; id < Actors.count; id++) { Meters.energy[id] = energy; Meters.points[id] = KIT_METER_FILL; }
}

function tally(table, key) { table[key] = (table[key] || 0) + 1; }

// Plays one kit match (batch: { kits, ruleset }) and returns { abilities: { id: casts }, gadgets: { id: uses }, placed }.
function playKitMatch(batch, seconds, round) {
  const kits = batch.kits;
  const used = { abilities: {}, gadgets: {}, placed: 0 };
  const handlers = {
    'actor.spawn': (event) => equipKit(event.id, kits),
    'ability.cast': (event) => { if (Bots.active[event.id]) tally(used.abilities, event.ability); },
    'gadget.use': (event) => { if (Bots.active[event.id]) tally(used.gadgets, event.gadget); },
    'gadget.place': () => { used.placed++; },
  };
  for (const type in handlers) Bus.on(type, handlers[type]);
  try {
    playMatch({ mode: round.mode, map: mapFor(round.map), ruleset: batch.ruleset, minutes: seconds / 60, bots: Array.from({ length: KIT_BOTS }, () => ({ tier: KIT_TIER })),
      seed: round.seed, modeOptions: SOAK_OPEN_MATCH, onTick: fillMeters });
  } finally {
    for (const type in handlers) Bus.off(type, handlers[type]);
  }
  return used;
}

// Every row in matches of KIT_BOTS bots (batchesOf(rows) lists the kits of each match), round after round
// (KIT_ROUNDS) for the rows nobody used yet. Returns { counts: { row id: uses }, unused: [row ids] }.
function kitSweep(rows, batchesOf, seconds) {
  const counts = {}, unused = () => rows.filter((row) => !(counts[row.id] > 0));
  for (const round of KIT_ROUNDS) {
    for (const batch of batchesOf(unused())) {
      const used = playKitMatch(batch, seconds, round);
      for (const table of [used.abilities, used.gadgets]) for (const key in table) counts[key] = (counts[key] || 0) + table[key];
    }
  }
  return { counts, unused: unused().map((row) => row.id) };
}

// Rows that wait for a downed ally play with the one ruleset whose health preset downs players (HPP06 loot shields).
function abilityBatches(rows) {
  const batches = [];
  for (const downed of [false, true]) {
    const group = rows.filter((row) => (row.botUse && row.botUse.when === 'allyDowned') === downed);
    for (let start = 0; start < group.length; start += KIT_ROWS) batches.push({ kits: abilityKits(group.slice(start, start + KIT_ROWS)), ruleset: downed ? DOWNED_RULESET : '' });
  }
  return batches;
}

function gadgetBatches(rows) {
  const thrown = rows.filter((row) => row.kind === 'thrown'), placed = rows.filter((row) => row.kind !== 'thrown'), batches = [];
  for (let start = 0; start < Math.max(thrown.length, placed.length); start += KIT_GADGET_ROWS) {
    batches.push({ kits: gadgetKits(thrown.slice(start, start + KIT_GADGET_ROWS), placed.slice(start, start + KIT_GADGET_ROWS)), ruleset: '' });
  }
  return batches;
}

const KIT_QUICK_SECONDS = 60, KIT_QUICK_SHARE = 0.6, KIT_SWEEP_SECONDS = 60;

Test.add('bots', (check) => {
  const rows = pressableAbilities().slice(0, KIT_ROWS);
  const used = playKitMatch({ kits: abilityKits(rows), ruleset: '' }, KIT_QUICK_SECONDS, KIT_QUICK_ROUND);
  const casts = rows.filter((row) => used.abilities[row.id] > 0).length, text = casts + '/' + rows.length + ' ' + JSON.stringify(used.abilities);
  check('bots cast most of an 8-ability sample in 60 s', casts >= rows.length * KIT_QUICK_SHARE, text);
  const gadgets = playKitMatch(gadgetBatches(CAT.gadgets.filter((row) => BOT_GADGET_USE[row.effect]))[0], KIT_QUICK_SECONDS, KIT_QUICK_ROUND);
  const usedKinds = Object.keys(gadgets.gadgets).map((key) => CAT.gadgets.byId(key).kind);
  check('bots throw grenades and place gadgets in a match', usedKinds.includes('thrown') && usedKinds.filter((kind) => kind !== 'thrown').length >= 2 && gadgets.placed > 0, JSON.stringify(gadgets));
});

Test.add('botsoak', (check) => {
  const abilities = pressableAbilities(), abilitySweep = kitSweep(abilities, abilityBatches, KIT_SWEEP_SECONDS);
  DebugApi.bots.lastAbilitySweep = abilitySweep;
  check('every pressable ability is used by bots (' + abilities.length + ' rows)', abilitySweep.unused.length === 0, 'unused: ' + abilitySweep.unused.join());
  const gadgets = CAT.gadgets.filter((row) => BOT_GADGET_USE[row.effect]), gadgetSweep = kitSweep(gadgets, gadgetBatches, KIT_SWEEP_SECONDS);
  DebugApi.bots.lastGadgetSweep = gadgetSweep;
  check('every grenade and gadget with a bot use is used (' + gadgets.length + ' rows)', gadgetSweep.unused.length === 0, 'unused: ' + gadgetSweep.unused.join());
}, { slow: true });

// ---- Objective play in headless matches (BOT-080): the objective scores; every shot at an enemy in sight ----
// A run: { mode, map (an id, or a test arena: BOT_ARENA), bots, and the sign of objective play: reason (a
// 'score' event reason), touched (an objective carried or owned), cart (the payload moved), loot (royale loot taken),
// hunted (a fair share of the hits land on the hunted role) }; ends: the match must end within the run.
const ARENA_WALL = 2, ARENA_WALL_HEIGHT = 4, ARENA_COVER = 1 / 7.5, ARENA_SPAWN = 2 / 3, ARENA_SIDE_ROWS = [-0.2, -1 / 15, 1 / 15, 0.2];
const HUNTED_HIT_FAIR = 1.2;   // the hunted actor gets more hits than its fair share (1 / players): bots go for it

function mapFor(name) { return BOT_ARENA_HALF[name] ? arenaMap(name) : name; }

// Four walls, a low cross of cover in the middle, a ring of free-for-all spawns and a row of spawns per team side.
function arenaMap(id) {
  const half = BOT_ARENA_HALF[id], inner = half - ARENA_WALL, cover = half * ARENA_COVER, spawn = half * ARENA_SPAWN;
  const boxes = [[-half, -half, half, -inner], [-half, inner, half, half], [-half, -inner, -inner, inner], [inner, -inner, half, inner], [-cover, -1, cover, 1], [-1, -cover, 1, cover]];
  const walls = boxes.map(([x0, z0, x1, z1]) => ({ shape: 'box', min: [x0, 0, z0], max: [x1, ARENA_WALL_HEIGHT, z1] }));
  const ring = Array.from({ length: 8 }, (_, index) => ({ x: Math.sin(index * Math.PI / 4) * spawn, y: 0, z: Math.cos(index * Math.PI / 4) * spawn }));
  const sides = [-spawn, spawn].flatMap((x, team) => ARENA_SIDE_ROWS.map((row) => ({ x, y: 0, z: row * half, team })));
  return botTestMap(false, { id, brushes: [TEST_FLOOR, ...walls], spawns: ring.concat(sides) });
}

function playObjective(run, seconds) {
  const result = { reasons: {}, loot: 0, cart: 0, hits: 0, huntedHits: 0, stats: null };
  const onScore = Bus.on('score', (event) => tally(result.reasons, event.reason));
  const onDamage = Bus.on('damage', (event) => {
    if (event.source < 0 || event.source === event.target) return;
    result.hits++;
    if (huntedRole(event.target)) result.huntedHits++;
  });
  const probe = () => {
    for (let item = 0; item < Modes.loot.count; item++) result.loot += Modes.loot.taken[item];
    result.cart = Modes.hud.payloadProgress;
  };
  try {
    result.stats = playMatch({ mode: run.mode, map: mapFor(run.map), minutes: seconds / 60, botCount: run.bots, seed: 1,
      modeOptions: { timeLimit: MATCH_SECONDS }, probe });
  } finally { Bus.off('score', onScore); Bus.off('damage', onDamage); }
  return result;
}

function objectivePlayed(run, result) {
  if (run.reason) return result.reasons[run.reason] > 0;
  if (run.touched) return result.stats.objectivesTouched > 0;
  if (run.cart) return result.cart > 0;
  if (run.loot) return result.loot > 0;
  return result.hits > 0 && result.huntedHits / result.hits >= HUNTED_HIT_FAIR / run.bots;
}

function objectiveText(result) {
  return matchText(result.stats) + ', score ' + JSON.stringify(result.reasons) + ', loot ' + result.loot + ', cart ' + result.cart.toFixed(2) +
    ', hunted hits ' + result.huntedHits + '/' + result.hits;
}

// The time limit; a tie goes to sudden death, so the full run covers the overtime too (it stops when the match ends).
const MATCH_SECONDS = 120, MATCH_RUN_SECONDS = MATCH_SECONDS + OVERTIME_SECONDS + 6;

function matchText(stats) {
  return stats.mode + ' ' + stats.map + ': ended ' + stats.ended + ' (' + stats.reason + ', winner ' + stats.winner + '), kills ' + stats.kills +
    ', captures ' + stats.teamCaptures + '/' + stats.actorCaptures + ', hold ' + stats.holdPoints + ', shots ' + stats.shots +
    ' (unperceived ' + stats.unperceivedShots + ', unknown ' + stats.unknownShots + ')';
}

function checkObjectiveRuns(check, runs, seconds) {
  const summary = [];
  for (const run of runs) {
    const result = playObjective(run, run.seconds || seconds), text = objectiveText(result), name = run.mode + ' on ' + run.map;
    summary.push(text);
    check(name + ': bots play the objective', objectivePlayed(run, result), text);
    check(name + ': every shot at an enemy in sight', result.stats.unperceivedShots === 0 && result.stats.unknownShots === 0, text);
    if (run.ends) check(name + ': the match ends with a result', result.stats.ended && result.stats.winner !== NOT_OVER, text);
  }
  return summary;
}

const QUICK_OBJECTIVE_RUNS = [
  { mode: 'ffa', map: 'spire', bots: 6, seconds: 40, reason: 'kill' },
  { mode: 'dom', map: 'twinkeeps', bots: 8, seconds: 40, reason: 'hold' },
  { mode: 'ctf', map: 'twinkeeps', bots: 8, seconds: 60, touched: true },
  { mode: 'payload', map: 'convoyline', bots: 8, seconds: 45, cart: true },
  { mode: 'oddball', map: BOT_ARENA, bots: 6, seconds: 30, reason: 'hold' },
  { mode: 'royale', map: 'isle', bots: 12, seconds: 30, loot: true },
];

const OBJECTIVE_RUNS = [
  { mode: 'ffa', map: 'spire', bots: 6, reason: 'kill', ends: true },
  { mode: 'tdm', map: 'harbor', bots: 8, reason: 'kill', ends: true },
  { mode: 'ctf', map: 'twinkeeps', bots: 8, reason: 'capture', ends: true },
  { mode: 'dom', map: 'twinkeeps', bots: 8, reason: 'hold', ends: true },
  { mode: 'rush', map: 'convoyline', bots: 8, reason: 'plant' },
  { mode: 'payload', map: 'convoyline', bots: 8, reason: 'checkpoint' },
  { mode: 'oddball', map: 'gantry', bots: 6, reason: 'hold', ends: true },
  { mode: 'gungame', map: 'gantry', bots: 6, reason: 'advance', ends: true },
  { mode: 'ghostops', map: 'dustline', bots: 8, reason: 'plant' },
  { mode: 'infection', map: BOT_ARENA, bots: 8, reason: 'infect', ends: true },
  { mode: 'juggernaut', map: BOT_ARENA, bots: 6, hunted: true },
  { mode: 'cursetag', map: BOT_ARENA, bots: 6, hunted: true },
  { mode: 'bearer', map: BOT_ARENA, bots: 6, reason: 'hold', ends: true },
  { mode: 'roulette', map: BOT_ARENA, bots: 6, reason: 'kill', ends: true },
  { mode: 'royale', map: 'isle', bots: 12, loot: true, ends: true },
];

Test.add('bots', (check) => { DebugApi.bots.lastQuickModes = checkObjectiveRuns(check, QUICK_OBJECTIVE_RUNS, KIT_QUICK_SECONDS); });
Test.add('botsoak', (check) => { DebugApi.bots.lastModes = checkObjectiveRuns(check, OBJECTIVE_RUNS, MATCH_RUN_SECONDS); }, { slow: true });

// ---- Flag Raid at its default size (5 v 5, the Play screen's 9 bots and the player): a 5-bot team raids with 3, so
// every 15-minute match sees flags captured (an odd team used to keep 2 home and stall at 0-0) ----
const CTF_DEFAULT_SIZE_SEEDS = [1, 2, 3, 4], CTF_DEFAULT_SIZE_BOTS = 10, CTF_DEFAULT_SIZE_MINUTES = 15, CTF_DEFAULT_SIZE_CAPTURES = 2;

Test.add('botsoak', (check) => {
  const captures = CTF_DEFAULT_SIZE_SEEDS.map((seed) => DebugApi.soak('ctf', 'twinkeeps', CTF_DEFAULT_SIZE_MINUTES, CTF_DEFAULT_SIZE_BOTS, seed,
    { timeLimit: CTF_DEFAULT_SIZE_MINUTES * 60 }).teamCaptures);
  check('ctf 5 v 5: every match captures flags', captures.every((count) => count >= CTF_DEFAULT_SIZE_CAPTURES), captures.join(', '));
}, { slow: true });

// ---- CTF attack play: 8 bots on twinkeeps capture in normal time, and neither side always wins (5 seeds) ----
const CTF_SEEDS = [1, 2, 3, 4, 5], CTF_CAPTURE_MATCHES = 3;

Test.add('botsoak', (check) => {
  const captures = [0, 0], wins = [0, 0];
  let matchesWithCapture = 0;
  for (const seed of CTF_SEEDS) {
    const scores = startEventLog('score');
    const stats = DebugApi.soak('ctf', 'twinkeeps', MATCH_RUN_SECONDS / 60, 8, seed, { timeLimit: MATCH_SECONDS });
    scores.stop();
    const teamCaptures = scores.filter((event) => event.reason === 'capture' && event.id < 0);
    for (const event of teamCaptures) captures[event.team]++;
    if (teamCaptures.length > 0) matchesWithCapture++;
    if (stats.winner === 0 || stats.winner === 1) wins[stats.winner]++;
  }
  const text = 'matches with a capture ' + matchesWithCapture + '/' + CTF_SEEDS.length + ', captures ' + captures.join(' v ') + ', wins ' + wins.join(' v ');
  DebugApi.bots.lastCtf = text;
  check('ctf: flags are captured in normal time in most matches', matchesWithCapture >= CTF_CAPTURE_MATCHES, text);
  const decided = wins[0] + wins[1];
  check('ctf: both sides capture', captures[0] > 0 && captures[1] > 0, text);
  check('ctf: neither side wins every decided match', decided < 2 || (wins[0] > 0 && wins[1] > 0), text);
}, { slow: true });

// ---- Soak (ARC-033): 16 bots on a map; per map: stuck < 1% of the bot time, nobody stuck > 6 s, no NaN, never without
// a goal for 3 s, the ray budget held, every shot at an enemy in sight. 'bots': 1 minute on two maps; 'botsoak': 3
// minutes on every hand-made map ----
const SOAK_QUICK_MAPS = ['twinkeeps', 'harbor'], SOAK_QUICK_MINUTES = 1, SOAK_TEST_MINUTES = 3;

function checkSoaks(check, maps, minutes) {
  const summary = [];
  for (const map of maps) {
    const stats = DebugApi.soak(soakModeFor(map), map.id, minutes);
    const text = map.id + ' ' + stats.mode + ': ' + JSON.stringify(stats);
    summary.push(map.id + ' ' + (stats.stuckFraction * 100).toFixed(2) + '%');
    check('soak ' + map.id + ': 16 bots play', stats.bots === SOAK_BOTS, text);
    check('soak ' + map.id + ': no NaN, stuck < 1% of the time', stats.nan === 0 && stats.stuckFraction < SOAK_STUCK_LIMIT, text);
    check('soak ' + map.id + ': nobody stuck > 6 s, nobody without a goal > 3 s', stats.maxStuck <= STUCK_GIVE_UP && stats.maxNoGoal <= SOAK_NO_GOAL_LIMIT, text);
    check('soak ' + map.id + ': perception rays within the budget', stats.raysMax <= SENSE_RAYS_PER_TICK, text);
    check('soak ' + map.id + ': every shot at an enemy in sight (ARC-033)', stats.unknownShots === 0 && stats.unperceivedShots === 0, text);
  }
  return summary;
}

Test.add('bots', (check) => { DebugApi.bots.lastQuickSoak = checkSoaks(check, SOAK_QUICK_MAPS.map((id) => CAT.maps.byId(id)), SOAK_QUICK_MINUTES); });
Test.add('botsoak', (check) => { DebugApi.bots.lastSoak = checkSoaks(check, CAT.maps.filter((map) => !map.placeholder), SOAK_TEST_MINUTES); }, { slow: true });

// ---- Same seed, same match: nothing an earlier match left in the bot modules steers the next one ----
const REPLAY_SECONDS = 12, REPLAY_SEED = 1, REPLAY_OTHER_SEED = 2;

// Where every actor stands at the end of a short ctf match on twinkeeps.
function replayPositions(seed) {
  const positions = [];
  const probe = () => { for (let id = 0; id < Actors.count; id++) positions.push(Actors.x[id].toFixed(3), Actors.z[id].toFixed(3)); };
  playMatch({ mode: 'ctf', map: 'twinkeeps', minutes: REPLAY_SECONDS / 60, botCount: 8, seed, modeOptions: SOAK_OPEN_MATCH, probe });
  return positions.join(',');
}

Test.add('bots', (check) => {
  const first = replayPositions(REPLAY_SEED);
  replayPositions(REPLAY_OTHER_SEED);
  check('the same seed plays the same match, after another match', replayPositions(REPLAY_SEED) === first);
});

// ---- Performance: 15 bots, AI p95 <= 1.0 ms per tick ----
Test.add('bots', (check) => {
  const stats = DebugApi.soak('tdm', 'harbor', 0.5, PERF_BOTS);
  check('15 bots: AI p95 <= 1.0 ms per tick', stats.bots === PERF_BOTS && stats.aiP95 <= PERF_P95_LIMIT_MS, 'p95 ' + stats.aiP95.toFixed(3) + ' ms, max ' + stats.aiMax.toFixed(3) + ' ms');
  DebugApi.bots.lastPerf = stats;
});
DebugApi.bots.kits = { play: playKitMatch, abilityBatches, gadgetBatches };   // __CTK.bots.kits: kit matches from the console

// ---- Holding bots sweep their view slowly over an arc (BOT-040: no spinning, no 360 degree vision) ----
const HOLD_SWEEP_SETTLE = 40, HOLD_SWEEP_SECONDS = 6, HOLD_SWEEP_RATE_LIMIT = 60, HOLD_SWEEP_RANGE_LIMIT = 130, HOLD_OUTWARD_LIMIT = 45;   // s, s, deg/s, deg, deg
Test.add('bots', (check) => {
  const settleTicks = HOLD_SWEEP_SETTLE * TICK_RATE, turned = new Float64Array(MAX_ACTORS), held = new Uint32Array(MAX_ACTORS);
  const yaw = new Float64Array(MAX_ACTORS), low = new Float64Array(MAX_ACTORS), high = new Float64Array(MAX_ACTORS), last = new Float64Array(MAX_ACTORS);
  const onTick = (tick) => {
    for (let id = 0; id < Actors.count; id++) {
      const step = wrapAngle(Actors.aimYaw[id] - last[id]);
      last[id] = Actors.aimYaw[id];
      if (tick < settleTicks || !Bots.isBot(id) || !BotDecide.holding(id) || BotCombat.target[id] >= 0) continue;
      turned[id] += Math.abs(step); held[id]++;
      yaw[id] += step; low[id] = Math.min(low[id], yaw[id]); high[id] = Math.max(high[id], yaw[id]);
      const zone = BotDecide.goal[id] === GOAL.OBJECTIVE ? Modes.objectives[BotDecide.goalTarget[id]] : null;
      if (!zone || length2(Actors.x[id] - zone.x, Actors.z[id] - zone.z) < 1.5 || Number.isNaN(BotDecide.holdYaw[id])) continue;
      outwardOff += Math.abs(wrapAngle(BotDecide.holdYaw[id] - Math.atan2(Actors.x[id] - zone.x, Actors.z[id] - zone.z))); outwardSamples++;
    }
  };
  let outwardOff = 0, outwardSamples = 0;
  playMatch({ mode: 'dom', map: 'twinkeeps', minutes: (HOLD_SWEEP_SETTLE + HOLD_SWEEP_SECONDS) / 60, seed: 1, balance: false, onTick,
    bots: [{ team: 0, tier: 0 }, { team: 0, tier: 3 }, { team: 0, tier: 7 }, { team: 0, tier: 5 }] });
  let fastest = 0, widest = 0, holders = 0;
  for (let id = 0; id < MAX_ACTORS; id++) {
    if (held[id] < TICK_RATE) continue;
    holders++;
    fastest = Math.max(fastest, turned[id] / DEG / (held[id] * TICK_SECONDS));
    widest = Math.max(widest, (high[id] - low[id]) / DEG);
  }
  check('holding bots sweep their view slowly (no spin)', holders > 0 && fastest < HOLD_SWEEP_RATE_LIMIT, holders + ' holders, fastest ' + fastest.toFixed(0) + ' deg/s');
  check('and only over an arc (no 360 degree vision)', holders > 0 && widest <= HOLD_SWEEP_RANGE_LIMIT, 'widest ' + widest.toFixed(0) + ' deg');
  const outward = outwardSamples > 0 ? outwardOff / outwardSamples / DEG : 180;
  check('a bot holding a point sweeps around the way out of it', outward < HOLD_OUTWARD_LIMIT, outward.toFixed(0) + ' deg off on average');
});

// ---- BOT-021: easy bots still fight (worse), they do not run from most fights ----
const FIGHT_MIX_SECONDS = 90, FIGHT_MIX_SAMPLE = 12, FIGHT_ATTACK_MIN = 0.3, FIGHT_RETREAT_MAX = 0.35;
Test.add('bots', (check) => {
  for (const difficulty of ['stroll', 'recruit', 'novice']) {
    let targeted = 0, attacking = 0, retreating = 0;
    const onTick = (tick) => {
      if (tick % FIGHT_MIX_SAMPLE) return;
      for (let id = 0; id < Actors.count; id++) {
        if (!Bots.isBot(id) || BotCombat.target[id] < 0) continue;
        targeted++;
        if (BotDecide.goal[id] === GOAL.ATTACK) attacking++;
        if (BotDecide.goal[id] === GOAL.RETREAT) retreating++;
      }
    };
    playMatch({ mode: 'ffa', map: 'spire', minutes: FIGHT_MIX_SECONDS / 60, botCount: 6, seed: 3, difficulty, onTick });
    const attackShare = attacking / Math.max(1, targeted), retreatShare = retreating / Math.max(1, targeted);
    check(difficulty + ': bots with a target attack at least 30% of the time and retreat at most 35%', targeted > 0 && attackShare >= FIGHT_ATTACK_MIN && retreatShare <= FIGHT_RETREAT_MAX,
      'attack ' + (attackShare * 100).toFixed(0) + '%, retreat ' + (retreatShare * 100).toFixed(0) + '%');
  }
});

// ---- BOT-071: a safe, close downed teammate (the player too) outranks the objective ----
// Over 36 seeds bots revive 31-32% of the downed (under 2% without revive goals), and one match swings from 16% to 47%:
// three seeds gave 26-39% (5 of 12 such sets under 30%), six seeds 27-36%. So six seeds against a 25% floor.
const REVIVE_SOAK_SECONDS = 180, REVIVE_SOAK_SEEDS = [1, 2, 3, 4, 5, 6], REVIVE_SHARE_MIN = 0.25, REVIVE_PLAYER_SECONDS = 12;
Test.add('bots', (check) => {
  const downed = new Uint8Array(MAX_ACTORS);
  let downs = 0, revives = 0;
  const onTick = () => {
    for (let id = 0; id < Actors.count; id++) {
      const now = Actors.alive[id] && (Actors.flags[id] & ACTOR_FLAG.DOWNED) ? 1 : 0;
      if (now && !downed[id]) downs++;
      if (!now && downed[id] && Actors.alive[id]) revives++;
      downed[id] = now;
    }
  };
  for (const seed of REVIVE_SOAK_SEEDS) {   // one match swings a lot (who is downed where): the share is over six
    downed.fill(0);
    playMatch({ mode: 'dom', map: 'twinkeeps', ruleset: 'modern', minutes: REVIVE_SOAK_SECONDS / 60, botCount: 10, seed, onTick });
  }
  check('Modern Holdfast: bots revive at least 25% of the downed', downs > 0 && revives / downs >= REVIVE_SHARE_MIN, revives + ' of ' + downs);
});
Test.add('bots', (check) => {
  Game.headless = true;
  Game.start({ mode: 'dom', map: 'twinkeeps', ruleset: 'modern', seed: 1, balance: false, player: { team: 0 }, bots: [{ team: 0, tier: 3 }, { team: 1, dummy: true }] });
  const player = Game.playerId, bot = player === 0 ? 1 : 0;
  runSeconds(1);
  placeActor(player, Actors.x[bot] + 4, Actors.z[bot]);
  Actors.flags[player] &= ~ACTOR_FLAG.PROTECTED;
  TestArena.hit(-1, player, 1000);
  const wasDowned = (Actors.flags[player] & ACTOR_FLAG.DOWNED) !== 0;
  for (let tick = 0; tick < REVIVE_PLAYER_SECONDS * TICK_RATE && (Actors.flags[player] & ACTOR_FLAG.DOWNED); tick++) Sim.run(1);
  check('a bot playing the objective revives the downed player next to it', wasDowned && Actors.alive[player] === 1 && !(Actors.flags[player] & ACTOR_FLAG.DOWNED), GOAL_NAMES[BotDecide.goal[bot]]);
  endModeTest();
});
// A downed enemy that cannot shoot neither draws fire from a standing enemy nor keeps a revive away.
Test.add('bots', (check) => {
  const [bot, ally, downedEnemy, enemy] = startBotTest(botTestMap(false), 'tdm', { ruleset: 'modern', balance: false,
    bots: [{ team: 0, tier: 3 }, { team: 0, dummy: true }, { team: 1, dummy: true }, { team: 1, dummy: true }] });
  placeFacing(bot, 0, 0, 0); placeActor(ally, 0, 3); placeActor(downedEnemy, 3, 8); placeActor(enemy, -8, 12);
  for (const id of [ally, downedEnemy, enemy]) Actors.flags[id] &= ~ACTOR_FLAG.PROTECTED;
  TestArena.hit(-1, ally, 1000); TestArena.hit(-1, downedEnemy, 1000);
  runSeconds(1);
  check('a bot shoots a standing enemy before a downed one nearer it', BotCombat.target[bot] === enemy, BotCombat.target[bot] + ' (enemy ' + enemy + ')');
  placeActor(enemy, -40, -40);
  let revived = false;
  for (let tick = 0; tick < REVIVE_PLAYER_SECONDS * TICK_RATE && !revived; tick++) { Sim.run(1); revived = !(Actors.flags[ally] & ACTOR_FLAG.DOWNED); }
  check('a bot revives an ally beside a downed enemy that cannot shoot', revived && Actors.alive[ally] === 1, GOAL_NAMES[BotDecide.goal[bot]]);
  endBotTest();
});

// ---- Ledges: bots stay on the map, and plan with the reach their preset has ----
const VOID_SOAK_SECONDS = 90, VOID_SOAK_SEEDS = [1, 2, 3], VOID_DEATH_SHARE_MAX = 0.1;
Test.add('bots', (check) => {
  const kills = startEventLog('kill');
  for (const seed of VOID_SOAK_SEEDS) playMatch({ mode: 'ffa', map: 'skyyard', minutes: VOID_SOAK_SECONDS / 60, botCount: 7, seed, difficulty: 'regular' });   // one match has 20-25 kills: one fall is 4-5%
  kills.stop();
  const selfInflicted = kills.filter((event) => event.killer < 0 || event.killer === event.victim).length;
  check('Skyward Yard: at most 10% of kills are bots falling off with no attacker', kills.length > 0 && selfInflicted <= kills.length * VOID_DEATH_SHARE_MAX, selfInflicted + ' of ' + kills.length);
});
// Hero and Frame Runner bots (glide, grapple, blink, knockback) on Skyward Yard: hazard deaths stay at what the bot
// landing checks reach (knocked off by hits is most of the rest), and downed enemies in sight are finished off, so few
// kills are bleed-outs.
const SKY_KIT_RULESETS = ['heroes', 'frame'], SKY_KIT_SEEDS = [1, 2], SKY_KIT_MINUTES = 3, SKY_KIT_BOTS = 10;
const SKY_KIT_HAZARD_SHARE_MAX = 0.5, BLEED_OUT_SHARE_MAX = 0.2;
Test.add('botsoak', (check) => {
  for (const ruleset of SKY_KIT_RULESETS) {
    const kills = startEventLog('kill');
    for (const seed of SKY_KIT_SEEDS) playMatch({ mode: 'tdm', map: 'skyyard', ruleset, minutes: SKY_KIT_MINUTES, botCount: SKY_KIT_BOTS, seed, difficulty: 'regular' });
    kills.stop();
    const hazard = kills.filter((event) => event.weapon === 'hazard').length, bleedOut = kills.filter((event) => event.weapon === 'bleedout').length;
    check(ruleset + ' on Skyward Yard: at most half the kills are hazards', kills.length > 0 && hazard <= kills.length * SKY_KIT_HAZARD_SHARE_MAX, hazard + ' of ' + kills.length);
    check(ruleset + ' on Skyward Yard: under 20% of kills are bleed-outs', kills.length > 0 && bleedOut < kills.length * BLEED_OUT_SHARE_MAX, bleedOut + ' of ' + kills.length);
  }
}, { slow: true });
Test.add('bots', (check) => {
  const [bot] = startBotTest(botTestMap(false));
  Motion.tapSignX[bot] = 1; Motion.tapClockX[bot] = 0.1; Motion.lastAxisX[bot] = 0; Actors.moveX[bot] = 1;
  Bots.keepUnderTap(bot, Actors.moveX, Motion.tapSignX, Motion.tapClockX, Motion.lastAxisX);
  const held = Actors.moveX[bot];
  Motion.tapClockX[bot] = DOUBLE_TAP_SECONDS + 0.1; Actors.moveX[bot] = 1;
  Bots.keepUnderTap(bot, Actors.moveX, Motion.tapSignX, Motion.tapClockX, Motion.lastAxisX);
  check('a bot\'s second tap of a direction stays under the tap threshold (no double-tap dodge off a ledge), later ones pass',
    held > 0 && held < TAP_THRESHOLD && Actors.moveX[bot] === 1, held + ' / ' + Actors.moveX[bot]);
  endBotTest();
});
const MANTLE_CRATE = { shape: 'box', min: [-3, 0, 2], max: [3, 2, 8] };
Test.add('bots', (check) => {
  const [bot] = startBotTest(botTestMap(false, { brushes: [TEST_FLOOR, MANTLE_CRATE] }), 'ffa', { ruleset: 'modern' });
  // The bot's own limits, without the danger costs its last path request (a match before this one) left in its options.
  const from = Nav.nearestNode(0, 0, -6), to = Nav.nearestNode(0, 2, 5), options = Object.assign({}, BotMove.options[bot], { danger: null, avoid: null });
  check('a Modern bot (jump 0.83 m, mantle 2.2 m) plans the 2 m mantle link onto a crate', Move.preset(bot).id === 'modern' && Nav.findPath(from, to, options) > 0
    && Nav.nodeY[Nav.pathNodes[Nav.pathLength - 1]] > 1.5, 'jump limit ' + options.allowJumpHeight.toFixed(2) + ' m');
  endBotTest();
  startBotTest(botTestMap(false), 'ffa', { ruleset: 'pilot' });
  check('an Agile bot (no fall damage) uses drops deeper than 8 m', Move.preset(0).id === 'agile' && BotMove.options[0].maxDrop >= 8, BotMove.options[0].maxDrop);
  endBotTest();
  startBotTest(botTestMap(false), 'ffa', { ruleset: 'modern' });
  const drop = BotMove.options[0].maxDrop, speed = Math.sqrt(2 * Move.gravity(0) * drop);
  check('a Modern bot drops only as far as costs it a quarter of its health at most', fallDamage(Move.preset(0), speed) <= BOT_DROP_DAMAGE + 1e-6 && drop >= 4, drop.toFixed(1) + ' m');
  endBotTest();
});

// ---- BOT-036: an empty magazine in a fight switches to a loaded gun; a much better gun is drawn in a fight too ----
Test.add('bots', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(false));
  placeFacing(bot, 0, -10, 0);
  holdActor(dummy, 0, 2);
  Actors.flags[dummy] = (Actors.flags[dummy] | ACTOR_FLAG.GOD) & ~ACTOR_FLAG.PROTECTED;   // a target for the whole test
  Weapons.give(bot, 'stormlash', 0);
  const pistol = CAT.weapons.byId('warden'), rifle = CAT.weapons.byId('stormlash');
  Weapons.give(bot, 'warden', 0);
  Weapons.current[bot] = pistol.index;
  for (let tick = 0; tick < 2 * TICK_RATE && !BotSense.sees(bot, dummy); tick++) { holdActor(dummy, 0, 2); Sim.run(1); }
  Weapons.current[bot] = pistol.index; Weapons.state[bot] = WEAPON_STATE.IDLE;
  Weapons.magazine[Weapons.slotIndex(bot, pistol.index)] = 0;
  const pressedAt = Sim.time;
  let switchedAfter = -1;
  for (let tick = 0; tick < TICK_RATE && switchedAfter < 0; tick++) {
    holdActor(dummy, 0, 2);
    Sim.run(1);
    if (Weapons.current[bot] === rifle.index || Weapons.pending[bot] === rifle.index) switchedAfter = Sim.time - pressedAt;
  }
  check('a bot whose pistol magazine runs dry in a fight draws its loaded rifle within 0.5 s', BotSense.sees(bot, dummy) && switchedAfter >= 0 && switchedAfter <= 0.5,
    switchedAfter.toFixed(2) + ' s, holding ' + Weapons.currentWeapon(bot).id);
  // The rest between fight switches starts with the slot press: a press still waiting (SLOT_PRESS_INTERVAL) does not use it up.
  Weapons.current[bot] = pistol.index; Weapons.state[bot] = WEAPON_STATE.IDLE; Weapons.pending[bot] = -1;
  Weapons.magazine[Weapons.slotIndex(bot, pistol.index)] = pistol.mag;
  BotCombat.weaponCheckAt[bot] = 0; BotCombat.combatSwitchAt[bot] = 0; BotCombat.slotPressAt[bot] = Sim.time + SLOT_PRESS_INTERVAL;
  const inFight = !BotCombat.isSafe(bot, Sim.time);
  for (let tick = 0; tick < TICK_RATE; tick++) { holdActor(dummy, 0, 2); Sim.run(1); }
  check('a bot in a fight draws a much better gun once its slot press is free', inFight && (Weapons.current[bot] === rifle.index || Weapons.pending[bot] === rifle.index),
    'in a fight ' + inFight + ', holding ' + Weapons.currentWeapon(bot).id);
  endBotTest();
});

// ---- Bot economy (BOT-001: decided in S14): round buys, and heals pressed through BTN.HEAL ----
const BUY_TEST_MONEY = 3000, BUY_TEST_SECONDS = 2;
Test.add('bots', (check) => {
  Game.headless = true;
  Game.start({ mode: 'bomb', map: 'dustline', seed: 2, bots: Array.from({ length: 10 }, () => ({})) });
  for (let id = 0; id < Actors.count; id++) if (Bots.active[id]) Economy.setMoney(id, BUY_TEST_MONEY);
  runSeconds(BUY_TEST_SECONDS);
  const empty = [];
  for (let id = 0; id < Actors.count; id++) {
    if (!Bots.active[id]) continue;
    const primary = CAT.weapons.some((weapon) => weapon.price > 0 && weapon.class !== 'sidearm' && weapon.class !== 'melee' && Weapons.has(id, weapon.id));
    if (!primary && Actors.armor[id] <= 0) empty.push(id);
  }
  check('Detonate: every bot with $3000 at the buy time owns a bought primary or armour', empty.length === 0, empty.join());
  endModeTest();
});
Test.add('bots', (check) => {
  const [bot] = startBotTest(botTestMap(false), 'ffa', { bots: [{ tier: 0 }] });
  placeFacing(bot, 0, -10, 0);
  Items.grant(bot, 'patch');
  Actors.health[bot] = Actors.maxHealth[bot] * 0.4;
  Damage.lastDamageTime[bot] = Sim.time;
  let pressedHurt = false, pressedCalm = false;
  for (let tick = 0; tick < TICK_RATE; tick++) { Damage.lastDamageTime[bot] = Sim.time; Sim.run(1); pressedHurt = pressedHurt || (Actors.buttons[bot] & BTN.HEAL) !== 0; }
  for (let tick = 0; tick < 6 * TICK_RATE && Items.useProgress(bot) < 0; tick++) { Sim.run(1); pressedCalm = pressedCalm || (Actors.buttons[bot] & BTN.HEAL) !== 0; }
  check('a hurt bot under fire keeps its consumable', !pressedHurt && Items.consumableCount(bot) === 1);
  check('a hurt calm bot presses heal and uses its consumable', pressedCalm && Items.useProgress(bot) >= 0);
  check('the heal decision lives in the bot brain, not in the items section', typeof Items.botWantsHeal !== 'function');
  // One worth rule for drawing, picking up and buying a gun; the group buy limit is Economy.limitReason's alone.
  check('one weapon worth rule (BotCombat.weaponValue), no bot copy of the buy limits', typeof BotCombat.weaponValue === 'function'
    && typeof gunValue === 'undefined' && typeof boughtInGroup === 'undefined');
  endBotTest();
});

// ---- BOT-110 tiers: a Custom personality never overrides the difficulty's tier range ----
Test.add('bots', (check) => {
  startBotTest(botTestMap(false), 'ffa', { difficulty: 'recruit', bots: [{ profile: 'halloran' }, { profile: 'calderrhee' }] });
  const recruit = CAT.difficulty.byId('recruit'), tiers = [Bots.tier(0).tier, Bots.tier(1).tier];
  check('Recruit with Veteran-or-better personalities: every bot stays in the Recruit tier range', tiers.every((tier) => tier >= recruit.tierMin && tier <= recruit.tierMax), tiers.join());
  endBotTest();
});

// ---- BOT-061 / BOT-100: objective barks, item pings and Dibs, takingPoint only when the objective wins ----
Test.add('bots', (check) => {
  const barks = startEventLog('bark'), announces = startEventLog('announce'), pings = startEventLog('ping');
  let wrongPoint = 0;
  const handler = Bus.on('bark', (event) => { if (event.category === 'takingPoint' && BotDecide.goal[event.id] !== GOAL.OBJECTIVE) wrongPoint++; });
  playMatch({ mode: 'dom', map: 'twinkeeps', minutes: 1, botCount: 8, seed: 1 });
  Bus.off('bark', handler); barks.stop(); announces.stop(); pings.stop();
  const captures = announces.filter((event) => event.kind === 'capture').length, objective = barks.filter((event) => event.category === 'objective').length;
  check('bots call out objective events (the objective bark is said)', captures > 0 && objective > 0, objective + ' objective barks, ' + captures + ' captures');
  // Twin Keeps points: x -32, 0 and 32 on z 0. No player plays, so every attack / defend ping is a bot's.
  const objectivePings = pings.filter((event) => (event.kind === 'attack' || event.kind === 'defend') && event.z === 0 && [-32, 0, 32].includes(event.x)).length;
  check('bots ping the objective on objective events, at most one per team every OBJECTIVE_PING_INTERVAL s', objectivePings > 0
    && objectivePings <= 2 * Math.ceil(60 / OBJECTIVE_PING_INTERVAL), objectivePings + ' objective pings, ' + captures + ' captures');
  check('"Taking the point" only from bots whose chosen goal is the objective', wrongPoint === 0, wrongPoint);
});
Test.add('bots', (check) => {
  const items = [{ x: 0, y: 0, z: 6, item: 'health', group: 'health' }];
  const [bot] = startBotTest(botTestMap(false, { items }), 'tdm', { player: { team: 0 }, balance: false, bots: [{ team: 0, tier: 3 }, { team: 1, dummy: true }] }).filter((id) => Bots.active[id]);
  const player = Game.playerId;
  placeFacing(bot, 0, -10, 0);
  const pings = startEventLog('ping');
  Bus.emit('ping', { id: player, kind: 'go', x: 0.6, y: 0, z: 6.4, target: -1, to: -1 });
  runSeconds(ORDER_ACK_MAX + 0.2);
  check('a bot answers a player\'s ping on an item with Dibs', pings.some((event) => event.id === bot && event.kind === 'dibs'), pings.map((event) => event.id + ':' + event.kind).join());
  pings.length = 0;
  Actors.health[bot] = Actors.maxHealth[bot] * 0.3;
  BotTeam.orderUntil[bot] = 0;
  runSeconds(6);
  check('a bot taking an item pings it for the team', pings.some((event) => event.id === bot && event.kind === 'dibs'), pings.map((event) => event.id + ':' + event.kind).join());
  pings.stop();
  endBotTest();
});
Test.add('bots', (check) => {
  const items = [{ x: 40, y: 0, z: 40, item: 'health', group: 'health' }];
  const [leader, follower] = startBotTest(botTestMap(false, { items }), 'tdm', { balance: false, bots: [{ team: 0, tier: 3 }, { team: 0, tier: 3 }, { team: 1, dummy: true }] });
  placeFacing(leader, -40, -40, 0);
  placeFacing(follower, 20, 20, 0);
  Actors.health[follower] = Actors.maxHealth[follower] * 0.3;
  BotTeam.squadLeader[leader] = leader; BotTeam.squadLeader[follower] = leader;
  const squadScore = GOAL_SCORERS[GOAL.COLLECT](follower, goalPlan, Sim.time);
  BotTeam.squadLeader[follower] = -1;
  const soloScore = GOAL_SCORERS[GOAL.COLLECT](follower, goalPlan, Sim.time);
  check('a squad follower leaves items farther than BOT_SQUAD.regroup from its leader (a lone bot takes them)', squadScore === 0 && soloScore > 0, squadScore + ' / ' + soloScore);
  endBotTest();
});

// ---- Nav cost cache: water and trap costs keep paths cacheable (and the same as uncached) ----
const NAV_CACHE_SOAK_SECONDS = 30, NAV_CACHE_SHARE_MIN = 0.6;
Test.add('bots', (check) => {
  let cacheable = 0, bots = 0;
  const probe = () => {
    for (let id = 0; id < Actors.count; id++) {
      if (!Bots.isBot(id)) continue;
      bots++;
      const options = BotMove.options[id];
      if (!options.avoid && (!options.danger || options.dangerKey >= 0)) cacheable++;
    }
  };
  playMatch({ mode: 'tdm', map: 'harbor', minutes: NAV_CACHE_SOAK_SECONDS / 60, botCount: 12, seed: 1, probe });
  check('Harbor (water): most bot paths stay cacheable', bots > 0 && cacheable / bots >= NAV_CACHE_SHARE_MIN, cacheable + ' of ' + bots);
  const [bot] = startBotTest(botTestMap(false), 'ffa');
  const from = Nav.nearestNode(-20, 0, -20), to = Nav.nearestNode(20, 0, 20), costs = new Float32Array(Nav.nodeCount);
  costs[Nav.nearestNode(0, 0, 0)] = 30;
  const plain = Nav.findPath(from, to, { danger: costs }) && Array.from(Nav.pathNodes.slice(0, Nav.pathLength)).join();
  Nav.findPath(from, to, { danger: costs, dangerKey: 7 });
  const cached = Nav.findPath(from, to, { danger: costs, dangerKey: 7 }) && Nav.lastCacheHit && Array.from(Nav.pathNodes.slice(0, Nav.pathLength)).join();
  check('a keyed extra-cost path is cached and equals the uncached one', bot >= 0 && cached === plain, String(cached));
  endBotTest();
});
