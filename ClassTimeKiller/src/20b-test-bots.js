// Self-tests for S14 bots (group 'bots') and the bot debug commands (BOT-091): __CTK.spawnBot(profile, team),
// __CTK.setTier(id, tier) and __CTK.soak(mode, map, minutes, botCount, seed, modeOptions), which plays a headless bot
// match and returns its stats.

const SOAK_BOTS = 16;
const SOAK_QUALITY = 'ultra';           // the medium preset caps a match at 15 bots (PERF-009)
const SOAK_SAMPLE_SECONDS = 1;
const SOAK_OPEN_MATCH = { timeLimit: 0, scoreLimit: 0 };   // soaks play on without an end
const SOAK_STUCK_LIMIT = 0.01, SOAK_NO_GOAL_LIMIT = 3;
const PERF_BOTS = 15, PERF_P95_LIMIT_MS = 1.0;
const SOAK_SKIPPED_FAMILIES = ['pve', 'solo'];   // PvE, range and puzzle modes have no versus objective: soak those maps in ffa

DebugApi.bots = { bots: Bots, sense: BotSense, move: BotMove, combat: BotCombat, decide: BotDecide, team: BotTeam, debug: BotDebug, difficulty: Difficulty };

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
DebugApi.setTier = (id, tier) => Bots.setTier(id, tier);

// Plays `minutes` of `mode` on `map` with 16 bots (or botCount), headless, with seed 1 (or seed), without a time or score
// limit (or with modeOptions), and returns the soak numbers (BOT-091 / ARC-033 / tests).
DebugApi.soak = (mode, map, minutes, botCount, seed, modeOptions) => {
  const headless = Game.headless, quality = Settings.get('video.quality');
  Game.headless = true;
  Settings.set('video.quality', SOAK_QUALITY);
  try { return runSoak(mode, map, minutes, botCount || SOAK_BOTS, seed === undefined ? 1 : seed, modeOptions || SOAK_OPEN_MATCH); } finally {
    Game.stop();
    Settings.set('video.quality', quality);
    Game.headless = headless;
  }
};

function runSoak(mode, map, minutes, botCount, seed, modeOptions) {
  const bots = [];
  for (let i = 0; i < botCount; i++) bots.push({});
  Game.start({ mode, map, seed, bots, modeOptions });
  const stats = { mode, map, bots: 0, seconds: 0, botSeconds: 0, stuckFraction: 0, maxStuck: 0, nan: 0, maxNoGoal: 0, aiP95: 0, aiMax: 0,
    kills: 0, shots: 0, unknownShots: 0, unperceivedShots: 0, objectivesTouched: 0, raysMax: 0,
    ended: false, winner: NOT_OVER, reason: '', teamCaptures: 0, actorCaptures: 0, holdPoints: 0 };
  for (let id = 0; id < Actors.count; id++) if (Bots.active[id]) stats.bots++;
  resetSoakCounters();
  const fairness = BotCombat.fairness, shotsBefore = fairness.shots, unknownBefore = fairness.unknown, unperceivedBefore = fairness.unperceived;
  const kills = startEventLog('kill'), scores = startEventLog('score'), timings = [];
  const ticks = Math.round(minutes * 60 * TICK_RATE), sampleTicks = Math.round(SOAK_SAMPLE_SECONDS * TICK_RATE);
  let played = 0;
  for (; played < ticks && Game.match && !Game.match.ended; played++) {
    Sim.run(1);
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
  const ids = startBotTest(botTestMap(false), 'ffa', { bots: [{ profile: 'pell' }, { tier: 'BT6' }, {}] });
  check('a named bot plays its roster tier, setup.tier wins', Bots.tier(ids[0]).tier === CAT.bots.byId('pell').tier && Bots.tier(ids[1]).tier === 6);
  check('a named bot keeps its profile row', Bots.profile[ids[0]] === CAT.bots.byId('pell') && Actors.profile[ids[0]] === CAT.bots.byId('pell'));
  check('setTier changes the tier', DebugApi.setTier(ids[2], 7) && Bots.tier(ids[2]).tier === 7);
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

function measureAccuracy(tier) {
  let shots = 0, hits = 0;
  for (const seed of ACCURACY_SEEDS) {
    const [bot, dummy] = startBotTest(botTestMap(false), 'ffa', { seed, bots: [{ tier }, { dummy: true }] });
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
  const [bot, dummy] = startBotTest(botTestMap(true, { items: [item] }));
  placeFacing(bot, 0, -10, 0);
  holdActor(dummy, 0, 10);
  Actors.health[bot] = Actors.maxHealth[bot] * 0.3;
  // Items are S12 stubs here (nothing is picked up), so the test watches the choice and the walk, not the pickup.
  let choseHealth = false, closest = Infinity;
  for (let tick = 0; tick < 4 * TICK_RATE; tick++) {
    holdActor(dummy, 0, 10);
    Actors.health[bot] = Math.min(Actors.health[bot], Actors.maxHealth[bot] * 0.3);
    Sim.run(1);
    if (BotDecide.goal[bot] === GOAL.COLLECT && BotDecide.goalTarget[bot] === 0) choseHealth = true;
    closest = Math.min(closest, Math.hypot(Actors.x[bot] - item.x, Actors.z[bot] - item.z));
  }
  check('a low-health bot picks the health item as its goal', choseHealth);
  check('and walks to it', closest < 1.5, closest.toFixed(2));
  endBotTest();
});

// ---- Team play: a defend ping is answered within 2 s ----
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
  check('the order is acknowledged in chat', barks.some((event) => event.category === 'orderAck' && event.time - pingedAt <= 2));
  runSeconds(4);
  check('the bots head for the pinged spot', takers.every((id) => Math.hypot(Actors.x[id] - 20, Actors.z[id] + 20) < 16));
  Settings.set('gameplay.chatter', 'off');
  const count = barks.length;
  Bus.emit('ping', { id: player, kind: 'go', x: -20, y: 0, z: -20, target: -1 });
  runSeconds(2);
  check('chatter off silences the barks', barks.length === count);
  barks.stop();
  endBotTest();
});

// ---- Headless matches (BOT-080): 120 s per mode with its score limit; the match ends and the objectives score ----
const MATCH_SECONDS = 120, MATCH_RUN_MINUTES = 2.1;   // the run is a little longer than the time limit

function playMode(mode, map, botCount) { return DebugApi.soak(mode, map, MATCH_RUN_MINUTES, botCount, 1, { timeLimit: MATCH_SECONDS }); }

function matchText(stats) {
  return stats.mode + ' ' + stats.map + ': ended ' + stats.ended + ' (' + stats.reason + ', winner ' + stats.winner + '), kills ' + stats.kills +
    ', captures ' + stats.teamCaptures + '/' + stats.actorCaptures + ', hold ' + stats.holdPoints + ', shots ' + stats.shots +
    ' (unperceived ' + stats.unperceivedShots + ', unknown ' + stats.unknownShots + ')';
}

Test.add('bots', (check) => {
  const ffa = playMode('ffa', 'spire', 6);
  check('ffa on spire: the match ends with a result, bots fight', ffa.ended && ffa.reason !== '' && ffa.kills > 0, matchText(ffa));
  check('ffa on spire: every shot at an enemy in sight', ffa.shots > 0 && ffa.unperceivedShots === 0 && ffa.unknownShots === 0, matchText(ffa));
  const tdm = playMode('tdm', 'harbor', 8);
  check('tdm on harbor: the match ends with a result, bots fight', tdm.ended && tdm.winner !== NOT_OVER && tdm.kills > 0, matchText(tdm));
  const ctf = playMode('ctf', 'twinkeeps', 8);
  check('ctf on twinkeeps: the match ends and flags are captured', ctf.ended && ctf.winner !== NOT_OVER && ctf.teamCaptures >= 1, matchText(ctf));
  const dom = playMode('dom', 'twinkeeps', 8);
  check('dom on twinkeeps: the match ends, points are captured and held', dom.ended && dom.winner !== NOT_OVER && dom.actorCaptures >= 1 && dom.holdPoints > 0, matchText(dom));
});

// ---- Soak (ARC-033): 16 bots, 3 simulated minutes on every hand-made map; per map: stuck < 1% of the bot time, nobody
// stuck > 6 s, no NaN, never without a goal for 3 s, the ray budget held, every shot at an enemy in sight ----
const SOAK_TEST_MINUTES = 3;

Test.add('bots', (check) => {
  const maps = CAT.maps.filter((map) => !map.placeholder);
  const summary = [];
  for (const map of maps) {
    const stats = DebugApi.soak(soakModeFor(map), map.id, SOAK_TEST_MINUTES);
    const text = map.id + ' ' + stats.mode + ': ' + JSON.stringify(stats);
    summary.push(map.id + ' ' + (stats.stuckFraction * 100).toFixed(2) + '%');
    check('soak ' + map.id + ': 16 bots play', stats.bots === SOAK_BOTS, text);
    check('soak ' + map.id + ': no NaN, stuck < 1% of the time', stats.nan === 0 && stats.stuckFraction < SOAK_STUCK_LIMIT, text);
    check('soak ' + map.id + ': nobody stuck > 6 s, nobody without a goal > 3 s', stats.maxStuck <= STUCK_GIVE_UP && stats.maxNoGoal <= SOAK_NO_GOAL_LIMIT, text);
    check('soak ' + map.id + ': perception rays within the budget', stats.raysMax <= SENSE_RAYS_PER_TICK, text);
    check('soak ' + map.id + ': every shot at an enemy in sight (ARC-033)', stats.unknownShots === 0 && stats.unperceivedShots === 0, text);
  }
  DebugApi.bots.lastSoak = summary;
});

// ---- Performance: 15 bots, AI p95 <= 1.0 ms per tick ----
Test.add('bots', (check) => {
  const stats = DebugApi.soak('tdm', 'harbor', 0.5, PERF_BOTS);
  check('15 bots: AI p95 <= 1.0 ms per tick', stats.bots === PERF_BOTS && stats.aiP95 <= PERF_P95_LIMIT_MS, 'p95 ' + stats.aiP95.toFixed(3) + ' ms, max ' + stats.aiMax.toFixed(3) + ' ms');
  DebugApi.bots.lastPerf = stats;
});
