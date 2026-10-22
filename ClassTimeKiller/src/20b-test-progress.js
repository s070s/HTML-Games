// Self-tests for single-player structures and progression (group 'progress', steps 15.1-15.7): catalogues, the XP formula and
// level curve, the unlock pace (headless XP simulation), unlocks never touching a stat, save migration, every medal on its
// scripted event and only then, the ladder from start to end, challenge stars, operation tickets, the daily seed and every card.

DebugApi.progress = { Progress, RunLog, Medals, Ladder, Challenges, Operations, OperationRun, Daily, Cards, CardRun, open: (screen) => Ui.open(screen) };

const PROGRESS_TEST_TYPICAL = { duration: 600, score: 10, objective: 0, medals: 4, winEvery: 4, podiumEvery: 2 };   // one 10-minute match
const PROGRESS_TEST_HOURS_TO_30 = [8, 13];          // "about 10 hours" to level 30 (PRG-010)
const PROGRESS_TEST_DAY = Date.UTC(2026, 9, 22, 12, 0);
const PROGRESS_TEST_HOUR_MS = 3600000;

// A results record as S13 builds it, with the local player at `rank` (1-based) among `others` + 1 free-for-all players.
function progressTestResults(fields) {
  const options = Object.assign({ duration: 600, score: 10, objective: 0, kills: 10, rank: 1, others: 3, teams: false, won: true }, fields);
  const players = [];
  for (let index = 0; index < options.others + 1; index++) players.push({ id: index + 1, name: 'Bot', kind: ACTOR_KIND.BOT, team: -1, kills: 0, deaths: 0, assists: 0, suicides: 0, score: 0, objective: 0, bestStreak: 0, lives: -1, queued: false });
  players[options.rank - 1] = { id: Game.playerId, name: 'You', kind: ACTOR_KIND.PLAYER, team: options.teams ? 0 : -1, kills: options.kills, deaths: 2, assists: 0, suicides: 0, score: options.score, objective: options.objective, bestStreak: 3, lives: -1, queued: false };
  const winnerId = options.won ? Game.playerId : players[0].id === Game.playerId ? players[1].id : players[0].id;
  return { mode: 'ffa', ruleset: 'classic', winner: winnerId, draw: false, reason: 'score', winnerTeam: options.teams ? (options.won ? 0 : 1) : -1,
    winnerId: options.teams ? -1 : winnerId, duration: options.duration, rounds: 0, players, teams: options.teams ? [{ team: 0 }, { team: 1 }] : [], queue: [] };
}
// Runs fn with a fake local player id (no match), restoring the real one afterwards.
function progressWithPlayer(fn) {
  const saved = Game.playerId;
  Game.playerId = 0;
  Actors.team[0] = 0;
  try { return fn(); } finally { Game.playerId = saved; }
}
// Medals emitted while fn runs (copies of the reused payload).
function progressMedals(fn) {
  const list = [];
  const listener = Bus.on('medal', (event) => list.push(event.medal));
  try { fn(); } finally { Bus.off('medal', listener); }
  return list;
}
// A scripted kill at the killer's spot (extra overrides fields; extra.air = the killer is in the air), victim revived after.
function progressKill(victim, killer, extra) {
  const at = killer >= 0 ? killer : victim, options = extra || {};
  if (killer >= 0) progressGround(killer, !options.air);
  Actors.alive[victim] = 0;
  const event = Object.assign({ victim, killer, assister: -1, weapon: 'warden', zone: 'body', element: 'kinetic', x: Actors.x[at], y: Actors.y[at], z: Actors.z[at] }, options);
  Bus.emit('kill', event);
  Actors.alive[victim] = 1;
  if (killer >= 0) progressGround(killer, true);
}
function progressGround(id, grounded) {
  if (grounded === false) Actors.flags[id] &= ~(ACTOR_FLAG.ON_GROUND | ACTOR_FLAG.IN_WATER | ACTOR_FLAG.ON_LADDER);
  else Actors.flags[id] |= ACTOR_FLAG.ON_GROUND;
}
// Moves the sim clock without stepping any system (medal chains read Sim.time only; no physics drift in scripted tests).
function progressAdvance(seconds) {
  Sim.tick += Math.round(seconds / TICK_SECONDS);
  Sim.time = Sim.tick * TICK_SECONDS;
}
function progressDamage(source, target, kind, weapon) {
  return { target, source, amount: 30, absorbed: 0, zone: 'body', weapon, element: 'kinetic', kind, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
}
// A team match with the player on team 0, one dummy team-mate and three dummy enemies (balance kept).
function progressTeamMatch(mode, map) {
  Game.start({ mode, map, seed: 3, balance: false, player: { team: 0, name: 'You' },
    bots: [{ dummy: true, team: 0 }, { dummy: true, team: 1 }, { dummy: true, team: 1 }, { dummy: true, team: 1 }] });
  const ids = { player: Game.playerId, mate: -1, enemies: [] };
  for (let id = 0; id < Actors.count; id++) {
    if (id === ids.player) continue;
    if (Actors.team[id] === 0) ids.mate = id; else ids.enemies.push(id);
  }
  for (let id = 0; id < Actors.count; id++) { Actors.alive[id] = 1; Actors.flags[id] &= ~ACTOR_FLAG.PROTECTED; progressGround(id); Actors.x[id] = id; Actors.y[id] = 0; Actors.z[id] = 0; }
  return ids;
}

// The metrics of a flawless but human-paced room run: every kill the score limit allows (or every bot life in a lives room),
// each one an airborne headshot in one streak, no misses, no damage, no deaths, a win, at PROGRESS_TEST_PAR_SHARE of par
// (rooms without par: of the time limit).
const PROGRESS_TEST_PAR_SHARE = 0.5;
function progressBestRun(row) {
  const lives = row.mutators.find((mutator) => mutator && mutator.id === 'lives');
  const kills = row.options.scoreLimit || row.bots * (lives ? lives.value : 1);
  const seconds = (row.par || row.options.timeLimit) * PROGRESS_TEST_PAR_SHARE;
  return { kills, headshots: kills, airKills: kills, bestStreak: kills, accuracy: 1, damageTaken: 0, deaths: 0, won: 1, seconds };
}

// ---- Catalogues (VIS-004 counts for this area) ----
Test.add('progress', (check) => {
  for (const name of ['medals', 'cards', 'unlocks', 'ladder', 'challenges', 'operations']) check('catalogue ' + name + ' validates', Data.validate(name).length === 0, Data.validate(name).join('; '));
  check('medals: MD01..MD20 in order', CAT.medals.length === 20 && CAT.medals.every((row, index) => row.code === 'MD' + String(index + 1).padStart(2, '0')));
  check('cards: C01..C24 with the spec types and costs', CAT.cards.length === 24 && CAT.cards.every((row, index) => row.code === 'C' + String(index + 1).padStart(2, '0'))
    && CAT.cards.byId('stoneskin').cost === 100 && CAT.cards.byId('thief').cost === 2000 && CAT.cards.byId('ironwill').cost === 666 && CAT.cards.byId('freecards').cost === 0
    && CAT.cards.filter((row) => row.type === 'active').length === 10);
  check('cards: every card has one simple unlock condition with a text (MIS-035)', CAT.cards.every((row) => row.unlock && typeof row.unlock.metric === 'string' && CARD_COMPARE[row.unlock.op] && row.unlock.text));
  check('ladder: 8 tiers BT0..BT7 of 3-4 matches', CAT.ladder.length === 8 && CAT.ladder.every((row, tier) => row.code === 'BT' + tier && row.matches.length >= 3 && row.matches.length <= 4));
  const ladderModes = new Set(), ladderBots = new Set();
  let ladderValid = true;
  for (const row of CAT.ladder) for (const entry of row.matches) {
    ladderModes.add(entry.mode);
    entry.bots.forEach((id) => ladderBots.add(id));
    ladderValid = ladderValid && CAT.maps.byId(entry.map).modes.includes(entry.mode) && entry.bots.every((id) => !!CAT.bots.byId(id)) && !!CAT.difficulty.byId(row.difficulty);
  }
  check('ladder: every match is a map that serves its mode, with roster bots', ladderValid);
  check('ladder: mixes FFA, Duel, TDM, CTF, Holdfast and Detonate', ['ffa', 'duel', 'tdm', 'ctf', 'dom', 'bomb'].every((mode) => ladderModes.has(mode)));
  check('ladder: the named roster B01..B24 all appear', ladderBots.size === 24);
  const last = CAT.ladder[7].matches[CAT.ladder[7].matches.length - 1];
  check('ladder: the final is a duel against B24', last.final && last.mode === 'duel' && last.bots.length === 1 && CAT.bots.byId(last.bots[0]).code === 'B24');
  check('challenges: 20 rooms covering the 6 trial kinds', CAT.challenges.length === 20 && CHALLENGE_KINDS.every((kind) => CAT.challenges.some((row) => row.kind === kind)));
  check('challenges: stars at 10,000 points each', CAT.challenges.every((row) => row.stars.join() === '10000,20000,30000'));
  check('operations: chains of 3 maps that serve their team modes', CAT.operations.length >= 1 && CAT.operations.every((row) => row.stages.length === 3
    && row.stages.every((stage) => CAT.maps.byId(stage.map).modes.includes(stage.mode) && CAT.modes.byId(stage.mode).teams === 2)));
});

// ---- XP formula and level curve (PRG-010) ----
Test.add('progress', (check) => progressWithPlayer(() => {
  const win = Progress.matchXp(progressTestResults({ duration: 600, score: 10, objective: 2, rank: 1 }), 120);
  check('xp: score x12 + objectives x30 + medals + finish 120 + win 160 + 35 per minute', win.score === 120 && win.objective === 60 && win.medals === 120 && win.finish === 120
    && win.win === 160 && win.podium === 0 && win.time === 350 && win.total === 930, JSON.stringify(win));
  const podium = Progress.matchXp(progressTestResults({ rank: 3, won: false }), 0);
  check('xp: a podium place pays 80 instead of the win', podium.win === 0 && podium.podium === 80 && podium.total === 120 + 120 + 80 + 350);
  check('xp: fourth place pays no podium', Progress.matchXp(progressTestResults({ rank: 4, won: false }), 0).podium === 0);
  check('xp: the loser of a duel (2 of 2) gets no podium XP', Progress.matchXp(progressTestResults({ rank: 2, others: 1, won: false }), 0).podium === 0
    && !Progress.onPodium(progressTestResults({ rank: 2, others: 1, won: false })));
  check('xp: a 3-player field has no podium (last place is not paid)', Progress.matchXp(progressTestResults({ rank: 3, others: 2, won: false }), 0).podium === 0);
  check('xp: team modes pay no podium', !Progress.onPodium(progressTestResults({ teams: true, won: false })));
  check('xp: minutes are capped at 15', Progress.matchXp(progressTestResults({ duration: 3600 }), 0).time === 15 * 35);
  check('xp: an idle match pays nothing (no farming)', Progress.matchXp(progressTestResults({ score: 0, kills: 0, objective: 0 }), 0).total === 0);
  check('xp: a match under 30 s pays nothing', Progress.matchXp(progressTestResults({ duration: 20 }), 0).total === 0);
  check('xp: a spectated match pays nothing', Progress.matchXp(null, 0).total === 0);
  check('levels: level 1 needs 0 XP, the next costs 1000 + 55 per level', Progress.xpForLevel(1) === 0 && Progress.xpToNext(1) === 1000 && Progress.xpToNext(2) === 1055);
  const thirty = Progress.xpForLevel(30);
  check('levels: the curve maps XP to levels at the boundaries', Progress.levelOf(thirty) === 30 && Progress.levelOf(thirty - 1) === 29 && Progress.levelOf(0) === 1);
  check('levels: capped at 50', Progress.levelOf(1e9) === 50 && Progress.levelOf(Progress.xpForLevel(50)) === 50);
}));

// ---- Unlock pace: headless XP simulation of typical matches (MIS-012 grind check) ----
Test.add('progress', (check) => progressWithPlayer(() => {
  const typical = PROGRESS_TEST_TYPICAL;
  let xp = 0, matches = 0;
  while (Progress.levelOf(xp) < PROGRESS_LEVELS.unlockCap && matches < 1000) {
    const won = matches % typical.winEvery === 0, rank = won ? 1 : matches % typical.podiumEvery === 0 ? 2 : 5;
    xp += Progress.matchXp(progressTestResults({ duration: typical.duration, score: typical.score, rank, won, others: 5 }), typical.medals * MEDAL_XP).total;
    matches++;
  }
  const hours = matches * typical.duration / 3600;
  check('pace: level 30 after about 10 hours of typical play', hours >= PROGRESS_TEST_HOURS_TO_30[0] && hours <= PROGRESS_TEST_HOURS_TO_30[1], hours.toFixed(1) + ' h, ' + matches + ' matches');
  Save.data.progression.xp = xp;
  const byLevel = CAT.unlocks.filter((row) => !row.card && !row.mastery);
  check('pace: every level unlock is at level 30 or below and unlocked by then', byLevel.every((row) => row.level <= PROGRESS_LEVELS.unlockCap && Progress.isUnlocked(row)));
  check('pace: every other unlock names one challenge (a mastery tier or the card condition)', CAT.unlocks.filter((row) => row.card || row.mastery)
    .every((row) => (row.card && !!CAT.cards.byId(row.card)) || MASTERY_TIERS.some((tier) => tier.id === row.mastery)));
  check('pace: every card has its unlock row', CAT.cards.every((card) => CAT.unlocks.some((row) => row.card === card.id)));
  Save.data.progression.xp = 0;
  check('unlocks: a fresh profile has only the level 1 looks and the first room block', Progress.unlocked('color').length === 1 && Progress.roomGroup() === 1 && !Progress.isUnlocked(CAT.unlocks.byId('titleLegend')));
  Settings.set('progress.unlockAll', true);
  check('unlocks: "Unlock everything" opens every unlock, card and room', CAT.unlocks.every((row) => Progress.isUnlocked(row)) && Cards.isUnlocked('thief') && Progress.roomGroup() === 4 && Ladder.isOpen(7, 2));
  Settings.set('progress.unlockAll', false);
  check('unlocks: a locked cosmetic cannot be chosen, an unlocked one can', !Progress.setCosmetic('color', 'colorRoyal') && Progress.setCosmetic('color', 'colorSlate') && Progress.cosmetic('color') === 0x7d8a99);
}));

// ---- No unlock changes a stat (PRG-011) ----
Test.add('progress', (check) => {
  check('unlocks: only cosmetic and content kinds', CAT.unlocks.every((row) => UNLOCK_KINDS.includes(row.kind)));
  const valueOk = (row) => (row.kind === 'color' && Number.isInteger(row.value)) || (row.kind === 'finish' && row.value >= 0 && row.value <= 1)
    || (row.kind === 'title' && typeof row.value === 'string') || (row.kind === 'challenge' && Number.isInteger(row.value)) || (row.kind === 'card' && !!CAT.cards.byId(row.value));
  check('unlocks: every value is a colour, glow, title, room block or card id (no stat field)', CAT.unlocks.every(valueOk));
  const setup = () => ({ mode: 'ffa', map: 'spire', seed: 5, player: { name: 'You' }, bots: [{ dummy: true }] });
  const snapshot = () => {
    Game.start(setup());
    const id = Game.playerId;
    const record = JSON.stringify(Game.match.rules) + '|' + [Actors.maxHealth[id], Actors.health[id], Actors.armor[id], Actors.maxArmor[id], Actors.maxShield[id], Actors.height[id]].join();
    Game.stop();
    return record;
  };
  const locked = snapshot();
  Settings.set('progress.unlockAll', true);
  Progress.setCosmetic('color', 'colorGoldMastery'); Progress.setCosmetic('finish', 'finishMasterGlow'); Progress.setCosmetic('title', 'titleLegend');
  const unlocked = snapshot();
  check('unlocks: rules, health and size are identical with everything unlocked and worn', locked === unlocked);
  const style = { r: 0.5, g: 0.5, b: 0.5, emissive: 0, scale: 1, visible: true };
  Game.start(setup());
  for (const apply of Render.actorStyles) apply(Game.playerId, style);
  check('unlocks: the chosen colour and finish are drawn on the player body', Test.near(style.r, 0xe8 / 255, 0.01) && style.emissive >= 0.65);
  check('look: the worn colour and finish are resolved once into plain numbers', Progress.look.color === 0xe8c250 && Progress.look.finish === 0.65);
  Settings.set('progress.unlockAll', false);
  check('look: turning Unlock everything off drops looks that are no longer unlocked', Progress.look.color === PROGRESS_NO_LOOK && Progress.look.finish === PROGRESS_NO_LOOK);
  const plain = { r: 0.5, g: 0.5, b: 0.5, emissive: 0, scale: 1, visible: true };
  for (const apply of Render.actorStyles) apply(Game.playerId, plain);
  check('look: without a worn look the body keeps its default colour', plain.r === 0.5 && plain.emissive === 0);
  Progress.setCosmetic('color', 'colorSlate');
  check('look: choosing a colour refreshes the drawn look at once', Progress.look.color === 0x7d8a99);
  check('mastery: an unknown tier id opens nothing', !Progress.masteryReached('nope'));
  Game.stop();
});

// ---- Save migration (ARC-020) ----
Test.add('progress', (check) => {
  Save.data = Save.migrate(JSON.parse('{"version":1,"settings":{},"bindings":{}}'));
  const profile = Progress.profile();
  check('migration: a save from before progression gets every field', profile.version === PROGRESS_VERSION && profile.xp === 0 && Array.isArray(profile.cards.active)
    && profile.cards.marks === 0 && Progress.stats().totals.matches === 0 && Progress.ladder().tier === 0 && Progress.level() === 1);
  Save.data = Save.migrate(JSON.parse('{"version":1,"settings":{},"progression":{"xp":5000,"medals":{"spree":2}},"stats":{"weapons":{"warden":{"kills":30}}},"ladder":{"tier":2}}'));
  check('migration: kept values survive, missing ones are added', Progress.profile().xp === 5000 && Progress.profile().medals.spree === 2 && Progress.ladder().tier === 2
    && Progress.ladder().match === 0 && Progress.stats().weapons.warden.kills === 30 && isPlainRecord(Progress.profile().cosmetics) && Progress.stats().totals.wins === 0);
  check('migration: weapon records gain their missing counters on first use', Progress.masteryOf('warden') === 0 && statRecord(Progress.stats().weapons, 'warden', WEAPON_STAT_FIELDS).headshots === 0);
  Save.data = Save.migrate(JSON.parse('{"version":1,"progression":[1,2],"stats":"broken","ladder":null}'));
  check('migration: broken progress fields are replaced, not crashed on', Progress.profile().xp === 0 && isPlainRecord(Progress.stats().weapons) && Progress.ladder().done === false);
  Save.data = Save.emptySave();
  check('migration: an empty save migrates lazily on first use', Progress.profile().version === PROGRESS_VERSION && Save.data.progression.version === PROGRESS_VERSION);
  Save.data.progression.xp = 'lots';
  Save.data.progression.version = 0;
  check('migration: an older progress version is brought up to date', Progress.profile().version === PROGRESS_VERSION && Progress.profile().xp === 0);
});

// ---- Medals MD01..MD16: each on its scripted event and only then ----
Test.add('progress', (check) => {
  const ids = progressTeamMatch('tdm', 'skyyard'), player = ids.player, [a, b, c] = ids.enemies;
  const step = () => progressAdvance(0.1);                                  // inside a chain
  const pause = () => progressAdvance(MEDAL_RULES.chainSeconds + 0.5);     // breaks a chain
  const fresh = () => { progressKill(player, -1); pause(); };              // a fall: the streak starts over
  check('medals: no medal without an event', progressMedals(() => Sim.run(10)).length === 0);
  let got = progressMedals(() => progressKill(a, player));
  check('medals: MD01 First Strike on the first kill only', got.join() === 'firstStrike', got.join());
  pause();
  got = progressMedals(() => progressKill(b, player));
  check('medals: a plain grounded close kill pays nothing else', got.length === 0, got.join());
  fresh();
  got = progressMedals(() => { progressKill(a, player); pause(); progressKill(b, player); pause(); progressKill(c, player); step(); });
  check('medals: kills apart are no chain', got.length === 0, got.join());
  got = progressMedals(() => progressKill(a, player));
  check('medals: kill 2 within 3 s pays MD02 Double', got.join() === 'double', got.join());
  step();
  got = progressMedals(() => progressKill(b, player));
  check('medals: kill 3 of the chain is also kill 5 of the life: MD03 Multi and MD04 Spree, once each', got.sort().join() === 'multi,spree', got.join());
  step();
  got = progressMedals(() => progressKill(c, player));
  check('medals: a 4th chain kill repeats neither Double nor Multi', got.length === 0, got.join());
  got = progressMedals(() => { for (let kill = 0; kill < 4; kill++) { pause(); progressKill(a, player); } });
  check('medals: MD05 Rampage at 10 kills without dying', got.join() === 'rampage', got.join());
  got = progressMedals(() => { for (let kill = 0; kill < 5; kill++) { pause(); progressKill(b, player); } });
  check('medals: MD06 Unstoppable at 15', got.join() === 'unstoppable', got.join());
  got = progressMedals(() => { progressKill(player, a); pause(); progressKill(a, player); });
  check('medals: dying resets the streak; MD13 Revenge on your last killer', got.join() === 'revenge', got.join());
  pause();
  got = progressMedals(() => progressKill(a, player));
  check('medals: Revenge is paid once per death', got.length === 0, got.join());
  got = progressMedals(() => { for (let death = 0; death < MEDAL_RULES.comebackDeaths; death++) { pause(); progressKill(player, b); } pause(); progressKill(b, player); });
  check('medals: MD09 Comeback after 3 deaths in a row (here also Revenge)', got.sort().join() === 'comeback,revenge', got.join());
  fresh();
  got = progressMedals(() => {
    Bus.emit('damage', progressDamage(player, a, 'melee', 'maul'));
    progressKill(a, player, { weapon: 'maul' });
  });
  check('medals: MD08 Humiliation on a melee kill', got.join() === 'humiliation', got.join());
  pause();
  got = progressMedals(() => {
    Bus.emit('damage', progressDamage(player, b, 'telefrag', ''));
    progressKill(b, player, { weapon: '' });
  });
  check('medals: MD14 Telefrag on a telefrag kill', got.join() === 'telefrag', got.join());
  pause();
  got = progressMedals(() => progressKill(a, player));
  check('medals: an old melee or telefrag hit does not style a later kill', got.length === 0, got.join());
  pause();
  got = progressMedals(() => progressKill(c, player, { air: true }));
  check('medals: MD15 Airborne on a kill in the air', got.join() === 'airborne', got.join());
  const airBefore = RunLog.airKills;
  pause();
  got = progressMedals(() => { Actors.flags[player] |= ACTOR_FLAG.IN_WATER; Actors.flags[player] &= ~ACTOR_FLAG.ON_GROUND; Bus.emit('kill', { victim: c, killer: player, assister: -1, weapon: 'warden', zone: 'body', element: 'kinetic', x: Actors.x[player], y: Actors.y[player], z: Actors.z[player] }); progressGround(player, true); Actors.flags[player] &= ~ACTOR_FLAG.IN_WATER; });
  Actors.alive[c] = 1;
  check('medals: a kill while swimming is not airborne, for the medal and the run metric alike', !got.includes('airborne') && RunLog.airKills === airBefore, got.join());
  fresh();
  got = progressMedals(() => { progressKill(a, player, { x: Actors.x[player] + 49 }); pause(); progressKill(b, player, { x: Actors.x[player] + 51 }); });
  check('medals: MD16 Long Shot beyond 50 m only', got.join() === 'longShot', got.join());
  got = progressMedals(() => { progressKill(c, ids.mate, { assister: player }); progressKill(ids.mate, a, { assister: player }); });
  check('medals: MD12 Assist when you helped a team-mate (not on a team-mate death)', got.join() === 'assist', got.join());
  const shot = (hit) => {
    if (hit) Bus.emit('damage', progressDamage(player, a, 'hit', 'lancet'));
    Bus.emit('weapon.fire', { id: player, weapon: 'lancet', weaponClass: 'marksman', mode: 'primary', x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 1 });
  };
  got = progressMedals(() => { shot(true); shot(false); shot(true); });
  check('medals: a rail miss breaks the pair', got.length === 0, got.join());
  got = progressMedals(() => shot(true));
  check('medals: MD07 Precise on 2 rail hits in a row', got.join() === 'precise', got.join());
  got = progressMedals(() => shot(true));
  check('medals: Precise needs a fresh pair', got.length === 0, got.join());
  got = progressMedals(() => { Bus.emit('score', { id: player, team: 0, points: 1, reason: 'hold' }); Bus.emit('score', { id: player, team: 0, points: 5, reason: 'capture' }); Bus.emit('score', { id: -1, team: 0, points: 5, reason: 'capture' }); });
  check('medals: MD11 Capture on your own capture only', got.join() === 'capture', got.join());
  Modes.addObjective({ kind: 'flagBase', team: 0, x: 40, y: 0, z: 0, radius: 3 });
  got = progressMedals(() => { pause(); Actors.x[b] = 45; progressKill(b, player); Actors.x[c] = 70; pause(); progressKill(c, player); });
  check('medals: MD10 Defender for a kill near your own objective', got.join() === 'defender', got.join());
  got = progressMedals(() => progressKill(ids.mate, player));
  check('medals: a team kill pays nothing', got.length === 0, got.join());
  got = progressMedals(() => progressKill(a, a));
  check('medals: a suicide pays nothing', got.length === 0, got.join());
  Game.stop();
});

// ---- Medals MD17..MD20 (rounds, PvE waves, stealth) ----
Test.add('progress', (check) => {
  const ids = progressTeamMatch('elim', 'dustline'), player = ids.player, [a, b, c] = ids.enemies;
  let got = progressMedals(() => { Actors.alive[a] = 0; progressKill(a, player); Actors.alive[a] = 0; Actors.alive[b] = 0; progressKill(b, player); Actors.alive[b] = 0; });
  check('medals: no Ace while an enemy still stands', !got.includes('ace'), got.join());
  got = progressMedals(() => progressKill(c, player));
  check('medals: MD17 Ace when you took down the whole enemy team this round', got.includes('ace'), got.join());
  Bus.emit('round', { round: 2, phase: 'start', winner: -1, reason: '', attackers: 0 });
  for (const id of [a, b, c]) Actors.alive[id] = 1;
  got = progressMedals(() => { Actors.alive[ids.mate] = 0; progressKill(ids.mate, a); Actors.alive[ids.mate] = 0; });
  check('medals: being left alone is not yet a clutch', !got.includes('clutch'), got.join());
  got = progressMedals(() => Bus.emit('round', { round: 2, phase: 'end', winner: 0, reason: 'eliminated', attackers: 0 }));
  check('medals: MD18 Clutch when your side wins the round you held alone against 2+', got.join() === 'clutch', got.join());
  got = progressMedals(() => Bus.emit('round', { round: 3, phase: 'end', winner: 0, reason: 'eliminated', attackers: 0 }));
  check('medals: Clutch is paid once', got.length === 0, got.join());
  Bus.emit('round', { round: 4, phase: 'start', winner: -1, reason: '', attackers: 0 });
  Actors.alive[ids.mate] = 1;
  progressKill(ids.mate, -1);
  Actors.alive[ids.mate] = 0;
  got = progressMedals(() => Bus.emit('round', { round: 4, phase: 'end', winner: 0, reason: 'eliminated', attackers: 0 }));
  check('medals: Clutch also counts when the team-mate fell (no killer)', got.join() === 'clutch', got.join());
  got = progressMedals(() => { Bus.emit('pve.wave', { wave: 1, phase: 'start' }); Bus.emit('pve.wave', { wave: 1, phase: 'end' }); });
  check('medals: MD20 Flawless Wave on a wave cleared without damage', got.join() === 'flawlessWave', got.join());
  got = progressMedals(() => {
    Bus.emit('pve.wave', { wave: 2, phase: 'start' });
    Bus.emit('damage', { target: player, source: a, amount: 5, absorbed: 0, zone: 'body', weapon: 'warden', element: 'kinetic', kind: 'hit', x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 });
    Bus.emit('pve.wave', { wave: 2, phase: 'end' });
  });
  check('medals: no Flawless Wave after taking damage', got.length === 0, got.join());
  Game.stop();
  const ghostRun = (alarm, stealth) => progressMedals(() => {
    Game.start({ mode: 'ffa', map: 'spire', seed: 2, modeOptions: { family: 'solo', params: { stealth } }, player: { name: 'You' }, bots: [{ dummy: true }] });
    if (alarm) Bus.emit('pve.alarm', { id: -1 });
    Modes.finish(Game.playerId);
  });
  check('medals: MD19 Ghost when a stealth level is won with no alarm', ghostRun(false, true).join() === 'ghost' && Progress.profile().medals.ghost === 1);
  check('medals: no Ghost after an alarm', ghostRun(true, true).length === 0);
  check('medals: no Ghost for a won solo level without stealth (Test Chambers, Firing Range)', ghostRun(false, false).length === 0
    && CAT.modes.filter((mode) => mode.params.stealth).map((mode) => mode.id).join() === 'contract');
  Game.stop();
});

// ---- Match end: XP, stats, medals counted once ----
Test.add('progress', (check) => {
  Game.start({ mode: 'ffa', map: 'spire', seed: 4, player: { name: 'You' }, bots: [{ dummy: true }] });
  const player = Game.playerId;
  Sim.run(60 * 120);
  Modes.score[player] = 5; Modes.kills[player] = 5;
  LocalPlayerStats.shots[CAT.weapons.byId('warden').index] = 10; LocalPlayerStats.hits[CAT.weapons.byId('warden').index] = 4;
  LocalPlayerStats.kills[CAT.weapons.byId('warden').index] = 5; LocalPlayerStats.medals.set('spree', 1);
  Modes.finish(player);
  const award = Progress.lastAward;
  check('end: the match pays its XP into the profile', award && award.xp > 0 && Progress.profile().xp === award.xp && Progress.profile().matches === 1, award && award.xp);
  check('end: medals are counted and paid', Progress.profile().medals.spree === 1 && award.breakdown.medals === CAT.medals.byId('spree').xp);
  check('end: stats per weapon, mode and map', Progress.stats().weapons.warden.kills === 5 && Progress.stats().weapons.warden.shots === 10 && Progress.stats().modes.ffa.played === 1
    && Progress.stats().modes.ffa.wins === 1 && Progress.stats().maps.spire.played === 1 && Progress.stats().totals.matches === 1);
  check('end: asking again (results screen) does not pay twice', Progress.finishMatch(Game.match) === award && Progress.profile().matches === 1);
  Progress.stats().weapons.warden.kills = 75; Progress.stats().weapons.warden.headshots = 15;
  check('mastery: kills and headshots reach a tier that opens its colour', Progress.masteryOf('warden') === 1 && Progress.isUnlocked(CAT.unlocks.byId('colorSilverMastery')) && !Progress.isUnlocked(CAT.unlocks.byId('colorGoldMastery')));
  Game.stop();
});

// ---- Tournament Ladder: start to end in a headless run (scripted results) ----
Test.add('progress', (check) => {
  check('ladder: a fresh ladder opens only its first match', Ladder.isOpen(0, 0) && !Ladder.isOpen(0, 1) && !Ladder.start(1, 0));
  let played = 0, setupsValid = true, namedBots = true;
  const winFor = (entry) => (CAT.modes.byId(entry.mode).teams === TEAM_COUNT ? 0 : Game.playerId);
  Ladder.start(0, 0);
  const rival = Game.playerId === 0 ? 1 : 0;
  for (let id = 0; id < Actors.count; id++) if (id !== Game.playerId) Modes.score[id] = 50;   // the player places last
  Modes.finish(rival);
  check('ladder: a lost match does not advance', Ladder.state().tier === 0 && Ladder.state().match === 0 && !Ladder.state().cleared['0.0']);
  while (!Ladder.state().done && played < 40) {
    const state = Ladder.state(), entry = Ladder.entry(state.tier, state.match);
    const match = Ladder.start(state.tier, state.match);
    setupsValid = setupsValid && !!match && Game.match.map.id === entry.map && Game.match.rules.mode === entry.mode;
    for (let id = 0; id < Actors.count; id++) if (Actors.kind[id] === ACTOR_KIND.BOT && (!Actors.profile[id] || !entry.bots.includes(Actors.profile[id].id))) namedBots = false;
    Modes.score[Game.playerId] = 99;
    Modes.finish(winFor(entry));
    played++;
  }
  check('ladder: all ' + Ladder.matchCount() + ' matches cleared in order, then champion', Ladder.state().done && played === Ladder.matchCount() && Ladder.clearedCount() === Ladder.matchCount(), played + ' played, ' + Ladder.clearedCount() + ' cleared, ' + JSON.stringify(Ladder.state()).slice(0, 200));
  check('ladder: every match ran its mode on its map with its named bots', setupsValid && namedBots);
  check('ladder: progress is saved in the save record', Save.data.ladder.done === true && Object.keys(Save.data.ladder.cleared).length === Ladder.matchCount());
  check('ladder: every match stays replayable', Ladder.isOpen(3, 1) && Ladder.isOpen(0, 0));
  const easy = Ladder.setup(7, 2, 'novice', 1);
  check('ladder: the difficulty is chosen per match and holds bot tiers in its range', easy.difficulty === 'novice' && easy.bots[0].tier === 2 && Ladder.setup(7, 2, 'nightmare', 1).bots[0].tier === 7);
  check('ladder: the B24 final duel names the Warden of Nine', easy.bots[0].profile === 'wardenofnine' && easy.mode === 'duel');
  check('ladder: free-for-all needs the podium, duels a win', progressWithPlayer(() => Ladder.passed(progressTestResults({ rank: 3, won: false }))
    && !Ladder.passed(progressTestResults({ rank: 4, won: false })) && !Ladder.passed(progressTestResults({ rank: 2, others: 1, won: false }))
    && Ladder.passed(progressTestResults({ rank: 1, others: 1, won: true }))));
  check('ladder: setting an unknown difficulty is refused', !Ladder.setDifficulty(0, 0, 'nope') && Ladder.setDifficulty(0, 0, 'regular') && Ladder.difficultyFor(0, 0) === 'regular');
  Game.stop();
});

// ---- Challenge Rooms: stars from data, Expert at 2 stars, instant retry ----
Test.add('progress', (check) => {
  let valid = true;
  for (const row of CAT.challenges) {
    const setup = Challenges.setup(row.id, true, 1);
    Rules.build(setup);
    valid = valid && Rules.problems.length === 0 && CAT.maps.byId(row.map).modes.includes(row.mode) && setup.bots.length === row.bots && setup.bots[0].tier === Math.min(7, row.tier + row.expertTier);
  }
  check('rooms: every room and its Expert version build valid rules on a map serving the mode', valid);
  const row = CAT.challenges.byId('sprint');
  check('rooms: stars come from the data thresholds', Challenges.starsFor(row, 9999) === 0 && Challenges.starsFor(row, 10000) === 1 && Challenges.starsFor(row, 29999) === 2 && Challenges.starsFor(row, 30000) === 3);
  const metrics = { kills: 5, seconds: 100 };
  check('rooms: points are weight x metric, underPar = seconds left of par', Progress.points(row.points, metrics, row.par) === 5 * row.points.kills + 50 * row.points.underPar
    && Progress.points({ damageTaken: -30, kills: 100 }, { damageTaken: 10, kills: 1 }, 0) === 0 && Progress.points({ damageTaken: -30, kills: 100 }, { damageTaken: 2, kills: 1 }, 0) === 40);
  const short = CAT.challenges.filter((room) => Challenges.starsFor(room, Progress.points(room.points, progressBestRun(room), room.par)) < CHALLENGE_STARS.length);
  check('rooms: a flawless run at half of par (or of the time limit) reaches 3 stars in every room', short.length === 0,
    short.map((room) => room.code + ' ' + Progress.points(room.points, progressBestRun(room), room.par)).join(', '));
  const award = () => ({ xp: 0, lines: [] });
  const fake = (expert) => ({ setup: { progress: { kind: 'challenge', id: 'sprint', expert } } });
  const onePoints = 5 * row.points.kills, twoStars = { kills: 5, seconds: 100 };
  check('rooms: Expert is locked at first', !Challenges.expertOpen('sprint') && !Challenges.start('sprint', true));
  const first = award();
  Challenges.onResult(fake(false), { kills: 5, seconds: row.par }, first);
  check('rooms: a result keeps the best and the stars, new stars pay XP', Challenges.record('sprint').best === onePoints && Challenges.record('sprint').stars === 1 && first.xp === PROGRESS_XP.challengeStar);
  const again = award();
  Challenges.onResult(fake(false), { kills: 5, seconds: row.par + 10 }, again);
  check('rooms: the same stars again pay no extra XP (no grind)', again.xp === 0 && Challenges.record('sprint').best === onePoints && Challenges.record('sprint').plays === 2);
  Challenges.onResult(fake(false), twoStars, award());
  check('rooms: 2 stars open the Expert version', Challenges.record('sprint').stars === 2 && Challenges.expertOpen('sprint'));
  Challenges.onResult(fake(true), twoStars, award());
  check('rooms: Expert keeps its own best and stars', Challenges.record('sprint').expertStars === 2 && Challenges.record('sprint').stars === 2);
  check('rooms: rooms past the first block wait for their level', !Challenges.isOpen(CAT.challenges.byId('phantom')) && Challenges.isOpen(CAT.challenges.byId('markYard')));
  const match = Challenges.start('sprint', false);
  check('rooms: a room starts its trial (mode, map, limits, bots)', match && Game.match.rules.mode === 'ffa' && Game.match.map.id === 'spire' && Game.match.rules.scoreLimit === 5 && Modes.countParticipants() === 4);
  const firstMatch = Game.match;
  Game.start(Game.match.setup);
  check('rooms: instant retry restarts the same trial at once (pause Restart / Play again)', Game.match !== firstMatch && Game.match.setup.progress.id === 'sprint' && Game.state === 'playing');
  Game.stop();
});

// ---- PRG-004 wave survival: time pays only while the player still has lives ----
Test.add('progress', (check) => {
  const survive = (outAfter, endAfter) => {
    Challenges.start('holdout', false);
    const player = Game.playerId, rival = player === 0 ? 1 : 0, lives = Modes.lives[player];
    progressAdvance(outAfter);
    for (let life = 0; outAfter < endAfter && life < lives; life++) progressKill(player, rival);
    progressAdvance(endAfter - outAfter);
    Modes.finish(rival);
    return RunLog.measure(Game.match).seconds;
  };
  const early = survive(20, 220);
  check('survival: a player out of lives early stops earning seconds', Math.abs(early - 20) < 0.1 && Game.match.results.duration > 200, early);
  const full = survive(60, 60);
  check('survival: a player still in counts the whole match', Math.abs(full - Game.match.results.duration) < 0.01 && full >= 60, full);
  Game.stop();
});

// ---- Operations: ticket carry-over math, comeback unit, three maps ----
Test.add('progress', (check) => {
  check('tickets: base + half of what is left, capped', Operations.carryTickets(0) === 60 && Operations.carryTickets(37) === 78 && Operations.carryTickets(55) === 87 && Operations.carryTickets(500) === 120 && Operations.carryTickets(-5) === 60);
  Operations.start('ironcoast');
  check('operation: map 1 starts with base tickets on both sides', OperationRun.active && OperationRun.tickets[0] === 60 && OperationRun.tickets[1] === 60 && Game.match.map.id === 'skyyard');
  const enemy = Array.from({ length: Actors.count }, (unused, id) => id).find((id) => Actors.team[id] === 1);
  for (let death = 0; death < 5; death++) progressKill(enemy, Game.playerId);
  check('operation: each death costs its side one ticket', OperationRun.tickets[1] === 55 && OperationRun.tickets[0] === 60);
  Modes.finish(0);
  const state = Operations.state('ironcoast');
  check('operation: the left tickets carry over and the loser gets the comeback unit', state.stage === 1 && state.tickets[0] === 90 && state.tickets[1] === 87 && state.comeback === 1 && state.wins[0] === 1);
  const setup = Operations.setup('ironcoast', 1);
  const heavy = setup.bots.find((bot) => bot.profile === OPERATION_COMEBACK.profile);
  check('operation: map 2 adds one heavy bot on the losing side', heavy && heavy.team === 1 && heavy.tier === OPERATION_COMEBACK.tier && setup.bots.length === 2 * CAT.operations.byId('ironcoast').bots);
  Operations.start('ironcoast');
  check('operation: map 2 starts with the carried tickets', OperationRun.tickets[0] === 90 && OperationRun.tickets[1] === 87 && Game.match.map.id === 'twinkeeps');
  OperationRun.tickets[0] = 1;
  const mine = Game.playerId;
  progressKill(mine, enemy);
  Sim.run(2);
  check('operation: a side out of tickets loses the map', Game.match.ended && Game.match.results.winnerTeam === 1 && Game.match.results.reason === 'tickets');
  check('operation: the winner of map 2 carries its tickets, the empty side gets base and the heavy unit', state.stage === 2 && state.tickets[0] === 60 && state.comeback === 0);
  Operations.start('ironcoast');
  Modes.finish(0);
  check('operation: three maps complete the operation, 2 - 1 wins it', state.done && state.result === 'won' && state.wins[0] === 2 && state.wins[1] === 1 && state.completed === 1);
  Operations.start('ironcoast');
  check('operation: starting a finished operation begins a new run', Operations.state('ironcoast').stage === 0 && Operations.state('ironcoast').completed === 1 && OperationRun.tickets[0] === 60);
  Game.stop();
});

// ---- Daily Seed: same local date -> same setup (time zone pinned), best history, no streaks ----
Test.add('progress', (check) => {
  check('daily: the date key follows the pinned offset', Daily.dateKey(Date.UTC(2026, 9, 22, 23, 30), 0) === '2026-10-22' && Daily.dateKey(Date.UTC(2026, 9, 22, 23, 30), 60) === '2026-10-23'
    && Daily.dateKey(Date.UTC(2026, 9, 22, 0, 30), -60) === '2026-10-21');
  const morning = Daily.dateKey(PROGRESS_TEST_DAY - 3 * PROGRESS_TEST_HOUR_MS, 0), evening = Daily.dateKey(PROGRESS_TEST_DAY + 9 * PROGRESS_TEST_HOUR_MS, 0);
  check('daily: the same date gives the same match setup', morning === evening && JSON.stringify(Daily.setup(morning)) === JSON.stringify(Daily.setup(evening)));
  const seen = new Set();
  let valid = true;
  for (let day = 0; day < 14; day++) {
    const choice = Daily.choiceFor(Daily.dateKey(PROGRESS_TEST_DAY + day * 24 * PROGRESS_TEST_HOUR_MS, 0));
    seen.add(JSON.stringify([choice.mode, choice.ruleset, choice.mutators, choice.map]));
    valid = valid && Modes.isPlayable(choice.mode) && CAT.maps.byId(choice.map).modes.includes(choice.mode) && !!CAT.rulesets.byId(choice.ruleset)
      && choice.mutators.length === DAILY_RULES.mutatorCount && !Mutators.conflicts(choice.mutators[0], choice.mutators[1]);
  }
  check('daily: each day picks a playable mode, a bundle, 2 compatible mutators and a map serving the mode', valid);
  check('daily: different dates give different setups', seen.size >= 10, seen.size);
  const setup = Daily.setup('2026-10-22');
  Rules.build(setup);
  check('daily: the setup builds valid rules with the date seed', Rules.problems.length === 0 && setup.seed === hashString('daily:2026-10-22') && setup.mutators.length === 2);
  const lowestBots = Math.min(...CAT.quality.map((row) => row.bots));
  check('daily: a fixed bot count inside the lowest quality preset, so every device plays the same match', DAILY_RULES.bots <= lowestBots && setup.bots.length === DAILY_RULES.bots);
  const award = () => ({ xp: 0, lines: [] });
  const fake = { setup: { progress: { kind: 'daily', key: '2026-10-22' } } };
  const first = award();
  Daily.onResult(fake, { kills: 4, score: 4 }, first);
  Daily.onResult(fake, { kills: 1, score: 1 }, award());
  check('daily: the best score per date is kept, replaying is free', Progress.profile().daily['2026-10-22'] === 2400 && first.xp === PROGRESS_XP.daily);
  for (let day = 0; day < DAILY_RULES.historyDays + 5; day++) Daily.onResult({ setup: { progress: { kind: 'daily', key: Daily.dateKey(PROGRESS_TEST_DAY + day * 24 * PROGRESS_TEST_HOUR_MS, 0) } } }, { kills: 1 }, award());
  check('daily: the history is local and bounded; skipped days cost nothing', Object.keys(Progress.profile().daily).length === DAILY_RULES.historyDays && Daily.history()[0].best > 0);
});

// ---- PRG-008: the one-time Firing Range offer waits for a build that has the range ----
Test.add('progress', (check) => {
  const savedHeadless = Game.headless, savedConfirm = Ui.confirm, hadScreen = Ui.screens.get(CAREER_RANGE_MODE);
  let offers = 0;
  Ui.confirm = () => { offers++; };
  Game.headless = false;
  try {
    Ui.screens.delete(CAREER_RANGE_MODE);
    if (!careerRangeAvailable()) {
      careerOfferRange();
      check('range: no range yet -> no offer, and the offer is kept for later', offers === 0 && Progress.profile().rangeOffered === false);
    }
    Ui.screens.set(CAREER_RANGE_MODE, hadScreen || { build() {} });
    careerOfferRange();
    careerOfferRange();
    check('range: once the range exists it is offered exactly once', offers === 1 && Progress.profile().rangeOffered === true);
  } finally {
    Game.headless = savedHeadless; Ui.confirm = savedConfirm;
    if (hadScreen) Ui.screens.set(CAREER_RANGE_MODE, hadScreen); else Ui.screens.delete(CAREER_RANGE_MODE);
  }
});

// ---- Play again and Next map for career matches (results screen) ----
Test.add('progress', (check) => {
  Ladder.setDifficulty(0, 0, 'novice');
  Ladder.start(0, 0);
  Modes.finish(Game.playerId);
  PlayFlow.playAgain();
  const tag = Game.match.setup.progress;
  check('retry: a ladder match replays the same tier, match and difficulty', tag.kind === 'ladder' && tag.tier === 0 && tag.match === 0 && Game.match.setup.difficulty === 'novice'
    && Game.match.map.id === Ladder.entry(0, 0).map);
  check('retry: Next map is refused for a career match', PlayFlow.nextMap() === null && Game.match.setup.progress.kind === 'ladder');
  Challenges.start('sprint', false);
  PlayFlow.playAgain();
  check('retry: a challenge room replays its own trial', Game.match.setup.progress.id === 'sprint' && Game.match.rules.scoreLimit === 5 && Game.match.map.id === 'spire');
  Daily.start('2026-10-22');
  const dailySeed = Game.match.setup.seed;
  PlayFlow.playAgain();
  check('retry: a daily replays the date setup with its seed', Game.match.setup.seed === dailySeed && dailySeed === hashString('daily:2026-10-22') && Game.match.setup.progress.key === '2026-10-22');
  Operations.start('highline');
  Modes.finish(0);
  PlayFlow.playAgain();
  const stage = CAT.operations.byId('highline').stages[1];
  check('retry: after an operation map, Play again plays the next map of the run', Game.match.setup.progress.stage === 1 && Game.match.map.id === stage.map && Game.match.rules.mode === stage.mode);
  check('retry: an untagged match has no career retry', Progress.retrySetup({ mode: 'ffa' }) === null);
  Game.stop();
});

// ---- Cards: equip rules, Marks, unlock conditions ----
Test.add('progress', (check) => {
  check('cards: a locked card cannot be placed', !Cards.equip('stoneskin') && Cards.equipProblem('stoneskin') === CAT.cards.byId('stoneskin').unlock.text);
  Settings.set('progress.unlockAll', true);
  check('cards: placing needs the Marks', !Cards.equip('stoneskin') && Cards.equipProblem('stoneskin').startsWith('Needs'));
  Cards.addMarks(1000);
  check('cards: placing pays the cost', Cards.equip('stoneskin') && Cards.marks() === 900 && Cards.isEquipped('stoneskin'));
  check('cards: a card is placed once', !Cards.equip('stoneskin'));
  Cards.equip('fleet'); Cards.equip('fury2');
  check('cards: 3 active slots', Cards.equipped('active').length === 3 && Cards.equipProblem('rapid') === 'No free active slot.');
  check('cards: removing refunds half', Cards.unequip('fury2') && Cards.marks() === 900 - 100 - 200 + 100);
  Cards.equip('freecards');
  const before = Cards.marks();
  check('cards: with Patron placed, cards are placed for free and refund nothing', Cards.equip('rapid') && Cards.marks() === before && Cards.unequip('rapid') && Cards.marks() === before);
  Cards.equip('hardy');
  check('cards: 2 passive slots', Cards.equipped('passive').length === 2 && Cards.equipProblem('thief') === 'No free passive slot.');
  Settings.set('progress.unlockAll', false);
  const base = { pveFinished: 1, kills: 10, deaths: 0, hard: false, propsLeft: 3, enemiesLeft: 2, marks: 0, bossSeconds: PROGRESS_NEVER, finalBossSeconds: PROGRESS_NEVER,
    explosiveShots: 2, souls: 20, rangedKills: 5, secretsLeft: 1, wrathKills: 0, optionalLeft: 1, armorPickups: 2, cardsEquipped: 1, wrathForms: 0, lowestHealth: 20, weaponsUsed: 3 };
  const meets = { stoneskin: {}, slowtide: { propsLeft: 0 }, soulkeep: { enemiesLeft: 0 }, longwick: { marks: 500 }, blessing: { bossSeconds: 119 }, refill: { explosiveShots: 0 },
    fleet: { souls: 100 }, fury2: { rangedKills: 0 }, darkpact: { secretsLeft: 0 }, rapid: { bossSeconds: 239 }, magnet: { souls: 0 }, encore: { wrathKills: 30 },
    greed: { optionalLeft: 0 }, ironwill: { bossSeconds: 79 }, rage: { secretsLeft: 0 }, hardy: { armorPickups: 0 }, freecards: { cardsEquipped: 0 }, lastbreath: { secretsLeft: 0, hard: true },
    discord: { wrathForms: 3 }, redeemer: { lowestHealth: 51 }, endless: { kills: 88 }, onehp: { weaponsUsed: 1 }, regenhp: { bossSeconds: 239, hard: true }, thief: { finalBossSeconds: 239 } };
  let exact = true;
  const wrong = [];
  for (const row of CAT.cards) {
    const lone = Object.assign({}, base, meets[row.id]);
    const ok = cardConditionMet(row.unlock, lone) && (row.id === 'stoneskin' || !cardConditionMet(row.unlock, Object.assign({}, base, row.id === 'endless' ? { kills: 89 } : {})));
    if (!ok) { exact = false; wrong.push(row.id); }
  }
  check('cards: each card unlocks on its own condition and not without it', exact, wrong.join());
  check('cards: hard-mode and no-death conditions are checked', !cardConditionMet(CAT.cards.byId('lastbreath').unlock, Object.assign({}, base, { secretsLeft: 0 }))
    && !cardConditionMet(CAT.cards.byId('rage').unlock, Object.assign({}, base, { secretsLeft: 0, deaths: 1 })));
  check('cards: unmeasured PvE numbers never unlock', !cardConditionMet(CAT.cards.byId('slowtide').unlock, Object.assign({}, base, { propsLeft: PROGRESS_NOT_REACHED })));
  const award = { lines: [] };
  Cards.unlockFromRun(null, Object.assign({}, base, { pveFinished: 0, propsLeft: 0 }), award);
  check('cards: nothing unlocks outside a finished PvE level', !Cards.record().unlocked.slowtide);
  Cards.unlockFromRun(null, Object.assign({}, base, { propsLeft: 0 }), award);
  check('cards: a finished level unlocks the cards whose conditions held', Cards.record().unlocked.slowtide && Cards.record().unlocked.stoneskin && Cards.record().unlocked.endless
    && !Cards.record().unlocked.soulkeep && award.lines.length === 3, award.lines.join('; '));
});

// ---- Cards: every effect applies in a match ----
function progressCardMatch(cards, extra) {
  Game.start(Object.assign({ mode: 'ffa', map: 'spire', seed: 6, modeOptions: { family: 'pve' }, player: { name: 'You' }, bots: [{ dummy: true }], cards }, extra || {}));
  const player = Game.playerId, other = player === 0 ? 1 : 0;
  for (const id of [player, other]) { Actors.flags[id] &= ~ACTOR_FLAG.PROTECTED; Actors.alive[id] = 1; }
  return { player, other };
}
function progressHit(source, target, amount) {
  const info = Damage.info();
  info.amount = amount; info.zone = 'none'; info.kind = 'hit';
  return Damage.apply(source, target, info);
}
function progressSlot(id) { return CardRun.slots.findIndex((slot) => slot.id === id); }
// The match rules are frozen: a test swaps in a copy with its own fields.
function progressRules(fields) { Game.match.rules = Object.assign({}, Game.match.rules, fields); }
// A PU18 soul dropped by a PvE enemy's death (the S12 drop path); returns its pickup slot.
function progressDropSoul(victim) {
  Items.dropSoul(victim);
  for (let slot = PICKUP_CAP - 1; slot >= Items.spotCount; slot--) {
    if (Items.state[slot] === PICKUP_STATE.READY && Items.kind[slot] === PICKUP_KIND.POWERUP && Items.rowOf(slot).id === CARD_SOUL_ITEM) return slot;
  }
  return -1;
}
function progressSoulSeconds(slot) { return slot < 0 ? 0 : (Items.despawnTick[slot] - Sim.tick) / TICK_RATE; }
// C09 Dark Pact (souls needed) and the Wrath Form run metrics on the real A34 ability, which casts itself once affordable.
function progressWrathChecks(check, ids, cost, label) {
  progressRules({ meter: 'energy' });   // the souls pay for Wrath (an ultimate meter would pay instead)
  Abilities.setSlot(ids.player, SLOT.ULTIMATE, CAT.abilities.byId('wrath'));
  Meters.souls[ids.player] = cost - 1;
  Sim.step();
  check(label + ': Wrath Form waits below ' + cost + ' souls', !Abilities.isActive(ids.player, 'wrath') && RunLog.wrathForms === 0);
  Meters.souls[ids.player] = cost;
  Sim.step();
  check(label + ': Wrath Form at ' + cost + ' souls counts one form', Abilities.isActive(ids.player, 'wrath') && RunLog.inWrath && RunLog.wrathForms === 1);
  const victim = Actors.create(ACTOR_KIND.ENEMY, 1, 'Fiend', null);
  progressKill(victim, ids.player);
  Bus.emit('pve.wrath', { id: ids.player, active: true });
  Sim.run((CAT.abilities.byId('wrath').duration + 1) * 120);
  check(label + ': kills in Wrath Form count, the form ends with the ability, a PvE report of the same form is not a second one',
    RunLog.wrathKills === 1 && !RunLog.inWrath && RunLog.wrathForms === 1);
}
// C03 Soulkeep (x3 life), C11 Soul Magnet (15 m reach, both soul kinds), C20 Soul Feast (x2 heal), C09 Dark Pact (50 souls).
function progressSoulChecks(check, ids, fiend) {
  progressRules({ params: Object.assign({}, Game.match.rules.params, { souls: true }) });
  Actors.alive[fiend] = 1;
  const slot = progressDropSoul(fiend);
  check('cards: C03 Soulkeep: souls last x3', slot >= 0 && Test.near(progressSoulSeconds(slot), ITEM_TIMING.droppedSeconds * 3, 0.05), progressSoulSeconds(slot));
  Actors.x[ids.other] = Actors.x[ids.player] - 40;
  Items.x[slot] = Actors.x[ids.player] + 10; Items.z[slot] = Actors.z[ids.player];
  Items.homeSoul(slot, 0.1);
  check('cards: C11 Soul Magnet: a soul 10 m away flies to you', Items.x[slot] < Actors.x[ids.player] + 10 - 0.5);
  Meters.dropSoul(ids.player, Actors.x[ids.player] + 10, Actors.y[ids.player], Actors.z[ids.player]);
  const orb = Meters.soulAlive.indexOf(1), orbStart = Meters.soulX[orb];
  Meters.stepSoul(orb, 0.1);
  check('cards: C11 Soul Magnet also pulls Wrath souls from 10 m', orb >= 0 && Meters.soulX[orb] < orbStart - 0.5);
  Meters.clearSouls();
  Actors.health[ids.player] = 50;
  Items.take(ids.player, slot);
  check('cards: C20 Soul Feast: a soul heals twice as much', Actors.health[ids.player] === 50 + 2 * CARD_SOUL_ROW.instant.heal, Actors.health[ids.player]);
  progressWrathChecks(check, ids, 50, 'cards: C09 Dark Pact');
}
Test.add('progress', (check) => {
  let ids = progressCardMatch(['stoneskin', 'fury2', 'fleet']);
  check('cards: the match runs with its cards (rules.cards)', Game.match.rules.cards.ids.join() === 'stoneskin,fury2,fleet' && CardRun.holder === ids.player && CardRun.slots.length === 3);
  const plainIn = progressHit(ids.other, ids.player, 10), plainOut = progressHit(ids.player, ids.other, 10);
  check('cards: active cards do nothing before they are used', plainIn > 0 && plainOut > 0);
  CardRun.activate(progressSlot('stoneskin'));
  check('cards: C01 Stoneskin halves damage taken', Test.near(progressHit(ids.other, ids.player, 10), plainIn * 0.5, 0.01));
  CardRun.activate(progressSlot('fury2'));
  check('cards: C08 Twin Fury doubles damage dealt', Test.near(progressHit(ids.player, ids.other, 10), plainOut * 2, 0.01));
  CardRun.activate(progressSlot('fleet'));
  check('cards: C07 Fleetfoot speeds you x1.3', Test.near(Buffs.get(ids.player, BUFF.SPEED), 1.3, 0.001));
  check('cards: an active card is used once per level', !CardRun.activate(progressSlot('fleet')) && CardRun.slots[progressSlot('fleet')].usesLeft === 0);
  Sim.run((CARD_ACTIVE_SECONDS + 1) * 120);
  check('cards: an active card lasts 30 s', Test.near(progressHit(ids.other, ids.player, 10), plainIn, 0.01) && !Buffs.has(ids.player, BUFF.SPEED));

  ids = progressCardMatch(['rage', 'fury2']);
  const base = progressHit(ids.player, ids.other, 5);
  CardRun.activate(progressSlot('rage'));
  Sim.run(10 * 120);
  CardRun.activate(progressSlot('fury2'));
  check('cards: Twin Fury during Rage keeps Rage at x4', Test.near(progressHit(ids.player, ids.other, 5), base * 4, 0.01));
  Sim.run((CARD_ACTIVE_SECONDS - 10 + 1) * 120);
  check('cards: Rage ends on its own timer, Twin Fury keeps x2 to its end', Test.near(progressHit(ids.player, ids.other, 5), base * 2, 0.01) && Buffs.has(ids.player, BUFF.DAMAGE));

  ids = progressCardMatch(['rage', 'ironwill', 'rapid', 'longwick', 'encore']);
  check('cards: C04 Longwick adds 10 s, C12 Encore allows two uses', CardRun.activeSeconds() === 40 && CardRun.slots.every((slot) => slot.usesLeft === 2));
  const plain = progressHit(ids.player, ids.other, 5);
  CardRun.activate(progressSlot('rage'));
  check('cards: C15 Rage x4', Test.near(progressHit(ids.player, ids.other, 5), plain * 4, 0.01));
  CardRun.activate(progressSlot('ironwill'));
  check('cards: C14 Iron Will makes you invulnerable', progressHit(ids.other, ids.player, 50) === 0);
  CardRun.activate(progressSlot('rapid'));
  check('cards: C10 Rapid Hands doubles the fire rate', Buffs.get(ids.player, BUFF.RATE) === 2);

  ids = progressCardMatch(['slowtide', 'onehp', 'discord', 'endless']);
  CardRun.activate(progressSlot('slowtide'));
  check('cards: C02 Slowtide slows the world around you x0.5', Buffs.get(ids.other, BUFF.SLOW) === 0.5 && Buffs.get(ids.other, BUFF.RATE) === 0.5 && Buffs.get(ids.player, BUFF.SLOW) === 1);
  const enemy = Actors.create(ACTOR_KIND.ENEMY, 1, 'Fiend', null);
  Actors.alive[enemy] = 1;
  CardRun.activate(progressSlot('discord'));
  check('cards: C19 Discord turns PvE enemies on each other', Actors.team[enemy] === HOSTILE_TO_ALL);
  Sim.run(16 * 120);
  check('cards: Discord ends after 15 s', Actors.team[enemy] === 1);
  CardRun.activate(progressSlot('onehp'));
  progressHit(ids.player, ids.other, 1);
  check('cards: C22 Brittle Foes: any hit kills', Actors.alive[ids.other] === 0);
  Weapons.give(ids.player, 'warden');
  const warden = CAT.weapons.byId('warden'), slot = Weapons.slotIndex(ids.player, warden.index);
  Weapons.setLoadout(ids.player, ['warden']);
  CardRun.activate(progressSlot('endless'));
  Weapons.magazine[slot] = 2;
  Bus.emit('weapon.fire', { id: ids.player, weapon: 'warden', weaponClass: warden.class, mode: 'primary', x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 1 });
  check('cards: C21 Endless Clip: shots use no ammo', Weapons.magazine[slot] === Weapons.magSize(ids.player, warden));

  ids = progressCardMatch(['hardy', 'blessing']);
  check('cards: C16 Hardy (base 150) and C05 Hale Start (start 150) apply on spawn', Actors.maxHealth[ids.player] === 150 && Actors.health[ids.player] >= 150);
  ids = progressCardMatch(['lastbreath', 'thief']);
  progressHit(ids.other, ids.player, 1000);
  check('cards: C18 Last Breath survives one lethal hit at 33 HP', Actors.alive[ids.player] === 1 && Actors.health[ids.player] === 33);
  Actors.health[ids.player] = 40;
  Bus.emit('damage', { target: ids.other, source: ids.player, amount: 100, absorbed: 0, zone: 'body', weapon: 'warden', element: 'kinetic', kind: 'hit', x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 });
  check('cards: C24 Life Thief heals 5% of the damage dealt', Test.near(Actors.health[ids.player], 45, 0.01));
  progressHit(ids.other, ids.player, 1000);
  check('cards: Last Breath works once', Actors.alive[ids.player] === 0);

  ids = progressCardMatch(['regenhp', 'refill']);
  Actors.health[ids.player] = 40;
  Sim.run(120);
  check('cards: C23 Mending regrows HP at 3 per second', Test.near(Actors.health[ids.player], 43, 0.1), Actors.health[ids.player]);
  Sim.run(20 * 120);
  check('cards: Mending stops at 75', Actors.health[ids.player] === 75 || (Actors.health[ids.player] > 75 && Actors.health[ids.player] <= 75.01));
  let grants = 0;
  const realGrant = Items.grant;
  Items.grant = (id, key) => { grants++; return realGrant.call(Items, id, key); };
  Bus.emit('pickup', { id: ids.player, item: 'ammobox', group: 'ammo', x: 0, y: 0, z: 0 });
  Bus.emit('pickup', { id: ids.player, item: 'healthpack', group: 'health', x: 0, y: 0, z: 0 });
  Items.grant = realGrant;
  check('cards: C06 Deep Pockets doubles ammo pickups only', grants === 1);

  ids = progressCardMatch(['greed', 'soulkeep', 'darkpact', 'magnet', 'redeemer']);
  const fx = Game.match.rules.cards.fx;
  check('cards: C03 / C09 / C11 / C20 put their soul numbers in rules.cards.fx', fx.soulLife === 3 && fx.wrathAt === 50 && fx.soulMagnet === 15 && fx.soulHeal === 2);
  const fiend = Actors.create(ACTOR_KIND.ENEMY, 1, 'Fiend', null);
  progressSoulChecks(check, ids, fiend);
  const marksBefore = RunLog.marks;
  progressKill(fiend, ids.player);
  Bus.emit('pve.crate', { id: ids.player });
  check('cards: Marks per PvE kill and crate, C13 Greed doubles them', RunLog.marks - marksBefore === 2 * (MARKS_RULES.perKill + MARKS_RULES.perCrate));
  Modes.finish(ids.player);
  check('cards: the Marks of a level reach the profile', Cards.marks() === RunLog.marks);

  ids = progressCardMatch([]);
  const plainFiend = Actors.create(ACTOR_KIND.ENEMY, 1, 'Fiend', null);
  progressRules({ params: Object.assign({}, Game.match.rules.params, { souls: true }) });
  Actors.alive[plainFiend] = 1;
  const plainSoul = progressDropSoul(plainFiend);
  check('cards: without Soulkeep a soul lasts the usual time', Test.near(progressSoulSeconds(plainSoul), ITEM_TIMING.droppedSeconds, 0.05));
  progressWrathChecks(check, ids, 66, 'cards: without Dark Pact');

  progressCardMatch(['stoneskin', 'slowtide'], { modeOptions: {} });
  check('cards: versus without Cards Allowed runs no cards', Game.match.rules.cards.ids.length === 0 && CardRun.holder === CARD_NO_HOLDER);
  progressCardMatch(['stoneskin', 'slowtide'], { modeOptions: {}, mutators: ['cards'] });
  check('cards: versus with X48 runs only the versus cards', Game.match.rules.cards.ids.join() === 'stoneskin');
  Game.stop();
});
