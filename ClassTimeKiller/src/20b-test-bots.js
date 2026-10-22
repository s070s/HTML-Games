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
  check('every taker acknowledges in chat within 0.5-1.5 s (BOT-062)', acknowledged.length === takers.length && takers.length > 0, acknowledged.length);
  runSeconds(4);
  check('the bots head for the pinged spot', takers.every((id) => Math.hypot(Actors.x[id] - 20, Actors.z[id] + 20) < 16));
  const enemy = firstOfTeam(1), spottedAt = Sim.time;
  Bus.emit('ping', { id: player, kind: 'enemy', x: Actors.x[enemy], y: Actors.y[enemy], z: Actors.z[enemy], target: enemy });
  runSeconds(2);
  check('an enemy ping from the player gets a reply within 1.5 s', barks.some((event) => event.category === 'pingReply' && withinAckTime(event.time - spottedAt)));
  Settings.set('gameplay.chatter', 'off');
  const count = barks.length;
  Bus.emit('ping', { id: player, kind: 'go', x: -20, y: 0, z: -20, target: -1 });
  runSeconds(2);
  check('chatter off silences the barks', barks.length === count);
  barks.stop();
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
  check('aggression reads the remembered height (0: the enemy is believed far above)', BotDecide.aggression(bot, dummy) === 0);
  BotSense.knownY[pair] = Actors.y[bot];
  check('and not the real one', BotDecide.aggression(bot, dummy) > 0, BotDecide.aggression(bot, dummy));
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
  BotCombat.aimThrow(bot);
  check('no throw while the view is off the arc', (Bots.buttonsWanted[bot] & BTN.GRENADE) === 0 && BotCombat.throwUntil[bot] > now);
  Actors.aimYaw[bot] = BotCombat.throwYaw[bot];
  BotCombat.aimThrow(bot);
  check('the throw goes once the view is on it', (Bots.buttonsWanted[bot] & BTN.GRENADE) !== 0 && BotCombat.throwUntil[bot] === 0);
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
  check('harbor has open water exits and blocked rimless ones', open > 0 && blocked > 0 && exitCount > 0, open + ' open, ' + blocked + ' blocked');
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
  const adaptive = Settings.get('difficulty.adaptive'), shift = Settings.get('difficulty.tierShift'), playerId = Game.playerId;
  Settings.set('difficulty.adaptive', true); Settings.set('difficulty.tierShift', 0);
  Game.playerId = 0;
  const match = { results: teamOutcome(1) };
  check('adapt: a team loss lowers the shift and shows on the results', Difficulty.adapt(match) === -1 && Settings.get('difficulty.tierShift') === -1 && match.results.botTierChange === -1);
  Game.playerId = playerId;
  Settings.set('difficulty.tierShift', shift); Settings.set('difficulty.adaptive', adaptive);
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

// ---- Headless matches (BOT-080): 120 s per mode with its score limit; the match ends and the objectives score ----
// A tie at the time limit goes to sudden death, so the run covers the overtime too (it stops when the match ends).
const MATCH_SECONDS = 120, MATCH_RUN_MINUTES = (MATCH_SECONDS + OVERTIME_SECONDS) / 60 + 0.1;

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
