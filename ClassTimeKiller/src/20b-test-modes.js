// Self-tests for the S13 mode framework and the core versus modes. Participants are practice dummies
// (setup.bots entries with dummy: true) moved by setting positions; deaths are simulated with 'kill' events.

DebugApi.modes = Modes;   // __CTK.modes: objectives, hudState(), per-actor stats

const testKill = { victim: -1, killer: -1, assister: -1, weapon: '', zone: 'body', element: 'kinetic', x: 0, y: 0, z: 0 };

function modesTestMap(extra) {
  return Object.assign({ id: 'modes-test', brushes: [TEST_FLOOR], spawns: [], objectives: [] }, extra);
}

// Loads the map and starts the mode with one dummy per entry of teams (a team index, or -1 for free-for-all).
function startModeTest(mode, map, teams, setup) {
  World.load(map);
  const bots = teams.map((team) => ({ dummy: true, team }));
  return Game.start(Object.assign({ mode, seed: 1, bots }, setup));
}

function killActor(victim, killer, assister) {
  Actors.alive[victim] = 0;
  testKill.victim = victim; testKill.killer = killer; testKill.assister = assister === undefined ? -1 : assister;
  Bus.emit('kill', testKill);
}

function placeActor(id, x, z) {
  Actors.place(id, x, 0, z);
}

function runSeconds(seconds) { Sim.run(Math.round(seconds * TICK_RATE)); }

// Records every payload of an event type (copied, since emitters reuse payload objects) until stop() is called.
function startEventLog(type) {
  const log = [];
  const handler = Bus.on(type, (payload) => log.push(Object.assign({ time: Sim.time }, payload)));
  log.stop = () => Bus.off(type, handler);
  return log;
}

function endModeTest() {
  Game.stop();
  World.clear();
}

const FFA_SPAWNS = [{ x: -40, y: 0, z: -40 }, { x: 40, y: 0, z: 40 }, { x: -40, y: 0, z: 40 }, { x: 40, y: 0, z: -40 }];
const TEAM_SPAWNS = [-5, 0, 5].flatMap((z) => [{ x: -45, y: 0, z, team: 0 }, { x: 45, y: 0, z, team: 1 }]);

// Spec section 13 numbers: id teams size scoreLimit timeLimit.
const EXPECTED_MODES = [
  'ffa 0 8 25 600', 'tdm 2 8 50 600', 'duel 0 2 0 600', 'ctf 2 10 3 900', 'oneflag 2 8 5 900', 'dom 2 8 200 600', 'conquest 2 16 0 1200',
  'hardpoint 2 8 150 600', 'oddball 0 8 100 600', 'control 2 10 0 0', 'bomb 2 10 0 0', 'elim 2 8 0 0', 'lms 0 8 0 600', 'royale 0 18 0 0', 'horde 1 4 0 0',
];
const CORE_MODES = ['ffa', 'tdm', 'duel', 'ctf', 'oneflag', 'dom', 'conquest', 'hardpoint', 'control', 'bomb', 'elim', 'lms'];

Test.add('modes', (check) => {
  check('31 modes M01..M31 in order (M31 = the MP11 puzzle chambers)', CAT.modes.length === 31 && CAT.modes.every((row, index) => row.code === 'M' + String(index + 1).padStart(2, '0')));
  for (const mode of CAT.modes) {
    const rules = Rules.build({ mode: mode.id });
    const roundsOk = !mode.rounds || (mode.rounds.winsNeeded > 0 && mode.rounds.limit >= mode.rounds.winsNeeded && mode.rounds.endDelay >= 0);
    check('mode ' + mode.code + ' ' + mode.id + ' row is valid and builds', [0, 1, 2].includes(mode.teams) && mode.sizeDefault > 0 && roundsOk
      && CAT.rulesets.byId(mode.ruleset) && ['normal', 'round', 'none'].includes(mode.respawn) && Rules.problems.length === 0, Rules.problems.join('; '));
  }
  const noGoal = CAT.modes.filter((mode) => !mode.goal || /\d/.test(mode.goal)).map((mode) => mode.id);
  check('every mode has a one-line goal text, with no number that lives in another field (fun-02)', noGoal.length === 0, noGoal.join());
  // One goal source per mode (regression-01): pause > Rules shows the row's goal, then its goalDetail with the {param} slots filled.
  const panelGoals = CAT.modes.filter((mode) => {
    const lines = modeGoalLines({ mode: mode.id, params: mode.params });
    return lines[0] !== mode.goal || lines.length !== (mode.goalDetail ? 2 : 1) || /\d/.test(mode.goalDetail) || lines.join().includes('{');
  }).map((mode) => mode.id);
  const roulette = modeGoalLines({ mode: 'roulette', params: { rotateEvery: 45 } }).join() + modeGoalLines({ mode: 'roulette' }).join();
  check('rules panel: the goal lines are the mode row goal and detail, numbers from the match params', typeof MODE_GOAL_TEXT === 'undefined' && panelGoals.length === 0
    && roulette.includes('every 45 s') && roulette.includes('every ' + CAT.modes.byId('roulette').params.rotateEvery + ' s'), panelGoals.join() + roulette);
  // Blight converts a human on any death after the outbreak (13f onKill), not on a hit; the range drill starts on the first shot (14j onFire).
  const blight = CAT.modes.byId('infection'), range = CAT.modes.byId('range');
  check('goal texts: Blight says a human who dies joins, the range says the first shot starts the drill', (blight.goal + blight.goalDetail).includes('dies') && !(blight.goal + blight.goalDetail).includes('hit')
    && range.goalDetail.includes('first shot') && (range.goal + range.goalDetail).includes('Quit to menu'), blight.goal + blight.goalDetail + range.goal + range.goalDetail);
  for (const line of EXPECTED_MODES) {
    const [id, teams, size, scoreLimit, timeLimit] = line.split(' ');
    const row = CAT.modes.byId(id);
    check('mode ' + id + ' numbers', row.teams === +teams && row.sizeDefault === +size && row.scoreLimit === +scoreLimit && row.timeLimit === +timeLimit);
  }
  const bomb = CAT.modes.byId('bomb');
  check('bomb rounds and timers (M13)', bomb.rounds.winsNeeded === 7 && bomb.rounds.switchAt === 6 && bomb.rounds.freeze === 15 && bomb.rounds.live === 100
    && bomb.params.plantTime === 4 && bomb.params.fuse === 40 && bomb.params.defuseTime === 7 && bomb.params.defuseCheckpoint === 3.5);
  const rush = CAT.modes.byId('rush');
  check('rush arm 4 s, fuse 30 s, disarm 5 s (M08)', rush.params.plantTime === 4 && rush.params.fuse === 30 && rush.params.defuseTime === 5 && rush.params.defuseCheckpoint === 0);
  check('bomb, rush and ghostops share the charge-timer keys', ['rush', 'ghostops'].every((id) => Object.keys(bomb.params).every((key) => key in CAT.modes.byId(id).params)));
  check('control capture builds on the shared capture params', CAT.modes.byId('control').params.captureStack === CAPTURE_PARAMS.captureStack && CAT.modes.byId('control').params.captureTime === 10);
  check('leadingTeam: level is a draw, else the team ahead', leadingTeam(0) === DRAW && leadingTeam(2) === 0 && leadingTeam(-0.5) === 1);
  const dom = CAT.modes.byId('dom'), conquest = CAT.modes.byId('conquest');
  check('dom capture 8 s, +1 per point per 2 s', dom.params.captureTime === 8 && dom.params.tickInterval === 2 && dom.params.tickPoints === 1);
  check('conquest 150 tickets, bleed 1/3 s at <= 2 points', conquest.params.tickets === 150 && conquest.params.bleedInterval === 3 && conquest.params.bleedHeld === 2 && conquest.params.deathCost === 1);
  check('hardpoint moves every 60 s, 1 pt/s', CAT.modes.byId('hardpoint').params.moveInterval === 60 && CAT.modes.byId('hardpoint').params.holdRate === 1);
  check('ctf flag returns after 20 s', CAT.modes.byId('ctf').params.returnTime === 20 && CAT.modes.byId('ctf').params.homeRequired === true);
  check('elim first to 5, 90 s, shrink last 30 s', CAT.modes.byId('elim').rounds.winsNeeded === 5 && CAT.modes.byId('elim').rounds.live === 90 && CAT.modes.byId('elim').params.shrinkTime === 30);
  check('lms 3 lives', Rules.build({ mode: 'lms' }).lives === 3);
  check('control best of 3', CAT.modes.byId('control').rounds.winsNeeded === 2 && CAT.modes.byId('control').rounds.limit === 3);
  check('core versus modes are playable', CORE_MODES.every((id) => Modes.isPlayable(id)));
  check('the PvE modes are playable (S14 14j)', ['horde', 'endless', 'bank', 'fiends', 'contract', 'attrition', 'range', 'puzzle'].every((id) => Modes.isPlayable(id)));
});

Test.add('modes', (check) => {
  const spawns = startEventLog('actor.spawn');
  World.load(modesTestMap({ spawns: FFA_SPAWNS }));
  Game.start({ mode: 'ffa', seed: 1, player: { name: 'Tester', handicap: 0.5 }, bots: [{ profile: 'nobody' }, { name: 'Named', handicap: 0.75 }, { dummy: true }] });
  spawns.stop();
  check('player and bots become actors', Actors.count === 4 && Actors.kind[0] === ACTOR_KIND.PLAYER && Actors.kind[1] === ACTOR_KIND.BOT && Actors.kind[3] === ACTOR_KIND.DUMMY);
  check('Game.playerId is the player', Game.playerId === 0 && Actors.name[0] === 'Tester' && Actors.name[2] === 'Named' && Actors.name[1] === 'Bot 1');
  check('everyone spawned (actor.spawn per actor)', spawns.length === 4 && [0, 1, 2, 3].every((id) => Actors.alive[id] === 1 && Actors.spawnCount[id] === 1));
  check('free-for-all has no teams', [0, 1, 2, 3].every((id) => Actors.team[id] === NO_TEAM));
  check('an unknown bot profile key stores no profile', Actors.profile[1] === null);
  check('handicap per actor in Game.match.handicap', Game.match.handicap[0] === 0.5 && Game.match.handicap[2] === 0.75 && Game.match.handicap[1] === 1);
  check('nobody spawns inside another actor', [1, 2, 3].every((id) => Math.hypot(Actors.x[id] - Actors.x[0], Actors.z[id] - Actors.z[0]) > 1));
  check('spawn protection set on spawn', (Actors.flags[0] & ACTOR_FLAG.PROTECTED) !== 0);
  Bus.emit('weapon.fire', { id: 0 });
  check('firing ends spawn protection', (Actors.flags[0] & ACTOR_FLAG.PROTECTED) === 0);
  endModeTest();

  startModeTest('tdm', modesTestMap({ spawns: TEAM_SPAWNS }), [0, 0, 0, 0, 0, 0]);
  check('auto-balance splits 6 bots 3/3', Modes.teamSize(0) === 3 && Modes.teamSize(1) === 3);
  check('team spawns are used per side', [0, 1, 2, 3, 4, 5].every((id) => Math.sign(Actors.x[id]) === (Actors.team[id] === 0 ? -1 : 1)));
  endModeTest();

  World.load(modesTestMap({ spawns: TEAM_SPAWNS }));
  Game.start({ mode: 'tdm', seed: 1, player: { team: 1 }, bots: [{ dummy: true }, { dummy: true }, { dummy: true }] });
  check('requested player team kept, open slots fill the smaller team', Actors.team[0] === 1 && Modes.teamSize(0) === 2 && Modes.teamSize(1) === 2);
  endModeTest();

  World.load(modesTestMap({ spawns: FFA_SPAWNS }));
  Game.start({ mode: 'ffa', seed: 1, bots: Modes.defaultBots('ffa', false).concat(Array.from({ length: 30 }, () => ({ dummy: true }))) });
  check('bot count capped by the quality preset (PERF-009)', Actors.count === Quality.current().bots, Actors.count);
  check('default bots fill the mode size (MODE-002)', Modes.defaultBots('ffa', true).length === 7 && Modes.defaultBots('tdm', false).length === 8);
  endModeTest();

  World.load(modesTestMap({ spawns: FFA_SPAWNS }));
  Game.start({ mode: 'ffa', seed: 1, bots: [] });
  Actors.create(ACTOR_KIND.DUMMY, NO_TEAM, 'outsider');
  runSeconds(2);
  killActor(0, -1);
  check('a match without participants stays passive', !Modes.active && !Game.match.ended && Modes.suicides[0] === 0);
  endModeTest();
});

// One touch rule: withinTouch (a point) and withinTouchAt (coordinate arrays, 13g loot and beacons) agree at its edges.
Test.add('modes', (check) => {
  World.clear();
  const id = Actors.create(ACTOR_KIND.DUMMY, NO_TEAM, 'toucher'), xs = new Float32Array(3), ys = new Float32Array(3), zs = new Float32Array(3);
  Actors.x[id] = Actors.y[id] = Actors.z[id] = 0;
  xs[1] = TOUCH_RADIUS - 0.01; ys[2] = TOUCH_HEIGHT + 0.01; xs[0] = TOUCH_RADIUS + 0.01;
  const both = (index) => [withinTouchAt(id, xs, ys, zs, index, TOUCH_RADIUS), withinTouch(id, xs[index], ys[index], zs[index], TOUCH_RADIUS)].join();
  check('touch rule: inside the radius touches, past it or above the height window does not', both(1) === 'true,true' && both(0) === 'false,false' && both(2) === 'false,false',
    [0, 1, 2].map(both).join(' '));
  World.clear();
});

Test.add('modes', (check) => {
  const scores = startEventLog('score');
  startModeTest('ffa', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1]);
  for (let i = 0; i < 24; i++) killActor(1, 0);
  Sim.step();
  check('ffa: 24 frags is not the limit', !Game.match.ended && Modes.score[0] === 24 && Modes.kills[0] === 24 && Modes.deaths[1] === 24);
  check('ffa: kill streak counted', Modes.streak[0] === 24 && Modes.bestStreak[0] === 24 && Modes.streak[1] === 0);
  killActor(2, -1);
  check('ffa: suicide is -1 (world kill)', Modes.score[2] === -1 && Modes.suicides[2] === 1 && Modes.kills[2] === 0);
  killActor(2, 2);
  check('ffa: self kill is -1', Modes.score[2] === -2);
  killActor(1, 0);
  Sim.step();
  scores.stop();
  const results = Game.match.results;
  check('ffa ends at the frag limit (25)', Game.match.ended && Game.match.winner === 0 && results.reason === 'score' && results.winnerId === 0);
  check('ffa results per player', results.players[0].id === 0 && results.players[0].kills === 25 && results.players.find((p) => p.id === 1).deaths === 25 && results.players.length === 3);
  check('score events emitted per kill', scores.filter((event) => event.reason === 'kill').length === 25 && scores.filter((event) => event.reason === 'suicide').length === 2);
  endModeTest();
});

Test.add('modes', (check) => {
  startModeTest('ffa', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1], { modeOptions: { timeLimit: 30 } });
  killActor(0, 1); killActor(2, 1); killActor(1, 0);
  runSeconds(30);
  check('ffa: running before the time limit', !Game.match.ended);
  Sim.step();
  check('ffa ends at the time limit with the leader', Game.match.ended && Game.match.winner === 1 && Game.match.results.reason === 'time');
  endModeTest();

  const announcements = startEventLog('announce');
  startModeTest('ffa', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1], { modeOptions: { timeLimit: 120 } });
  check('the match start announces the mode and its goal (fun-03)', announcements.length > 0 && announcements[0].kind === 'mode'
    && announcements[0].text === CAT.modes.byId('ffa').name + ': ' + CAT.modes.byId('ffa').goal, announcements.length && announcements[0].text);
  runSeconds(60.01);
  check('time warning at 1 minute', announcements.some((event) => event.text === '1 minute remaining'));
  runSeconds(60);
  Sim.step();
  check('tie at the time limit goes to sudden death', !Game.match.ended && Modes.overtime && announcements.some((event) => event.kind === 'overtime'));
  check('hud shows overtime time left', Test.near(Modes.hudState().timeLeft, OVERTIME_SECONDS, 0.05));
  killActor(0, 1);
  Sim.step();
  check('first lead in sudden death wins', Game.match.ended && Game.match.winner === 1 && Game.match.results.reason === 'overtime');
  check('lead change announced', announcements.some((event) => event.kind === 'lead' && event.text.startsWith(Actors.name[1])));
  announcements.stop();
  endModeTest();

  startModeTest('ffa', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1], { modeOptions: { timeLimit: 10 } });
  runSeconds(10 + OVERTIME_SECONDS - 0.1);
  check('sudden death lasts up to 3 minutes', !Game.match.ended);
  runSeconds(0.2);
  check('then the match is a draw', Game.match.ended && Game.match.winner === DRAW && Game.match.results.draw);
  endModeTest();
});

Test.add('modes', (check) => {
  startModeTest('tdm', modesTestMap({ spawns: TEAM_SPAWNS }), [0, 0, 1, 1], { modeOptions: { scoreLimit: 3 } });
  killActor(2, 0);
  killActor(3, 1);
  check('tdm: kills add to the team score', Modes.teamScore[0] === 2 && Modes.teamScore[1] === 0);
  killActor(1, 0);
  check('tdm: a team kill costs a point', Modes.teamScore[0] === 1 && Modes.score[0] === 0);
  killActor(2, 1, 0);
  check('tdm: assists counted (not for the killer)', Modes.assists[0] === 1 && Modes.assists[1] === 0);
  killActor(3, 0);
  Sim.step();
  const results = Game.match.results;
  check('tdm ends at the score limit with the team as winner', Game.match.ended && Game.match.winner === 0 && results.winnerTeam === 0 && results.winnerId === -1);
  check('tdm team totals', results.teams[0].score === 3 && results.teams[0].kills === 4 && results.teams[1].deaths === 4 && results.teams[0].deaths === 1);
  endModeTest();
});

Test.add('modes', (check) => {
  // Enemy at the origin; spawn A in the open 20 m away, B 15 m away behind a wall, C 5 m away.
  const wall = { shape: 'box', min: [-4, 0, 6], max: [4, 4, 8] };
  const map = modesTestMap({ brushes: [TEST_FLOOR, wall], spawns: [{ x: 20, y: 0, z: 0 }, { x: 0, y: 0, z: 15 }, { x: 5, y: 0, z: 0 }] });
  startModeTest('ffa', map, [-1, -1]);
  placeActor(0, -50, -50);
  placeActor(1, 0, 0);
  killActor(0, 1);
  runSeconds(2.01);
  check('respawn avoids enemy line of sight and the 12 m radius', Actors.alive[0] && Actors.x[0] === 0 && Actors.z[0] === 15, Actors.x[0] + ',' + Actors.z[0]);
  killActor(0, 1);
  placeActor(1, 0, 15.2);
  runSeconds(2.01);
  check('a spawn with an actor on it is never used', Actors.alive[0] && !(Actors.x[0] === 0 && Actors.z[0] === 15));
  endModeTest();

  const noCover = modesTestMap({ spawns: [{ x: 20, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }] });
  startModeTest('ffa', noCover, [-1, -1]);
  placeActor(1, 0, 0);
  killActor(0, 1);
  runSeconds(2.01);
  check('without a safe spawn the best unsafe one is used', Actors.alive[0] && Actors.x[0] === 20);
  endModeTest();

  // Team mode: both spawns are equally far from the enemy; the one next to a teammate wins.
  const teamMap = modesTestMap({ spawns: [{ x: -20, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }] });
  startModeTest('tdm', teamMap, [0, 0, 1]);
  placeActor(1, 22, 0);
  placeActor(2, 0, -50);
  killActor(0, 2);
  runSeconds(2.01);
  check('team modes prefer spawns near teammates', Actors.alive[0] && Actors.x[0] === 20);
  endModeTest();
});

Test.add('modes', (check) => {
  startModeTest('ffa', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1]);
  const spawns = startEventLog('actor.spawn');
  runSeconds(1);
  const deathTime = Sim.time;
  killActor(1, 0);
  check('dead actor waits for the respawn', Modes.respawnIn(1, Sim.time) === 2);
  runSeconds(2);
  check('no respawn before 2 s', !Actors.alive[1]);
  Sim.step();
  check('respawn exactly 2 s after death', Actors.alive[1] && spawns.length === 1 && Test.near(spawns[0].time - deathTime, 2, TIME_EPSILON), spawns.length && spawns[0].time - deathTime);
  check('spawn protection on respawn', (Actors.flags[1] & ACTOR_FLAG.PROTECTED) !== 0);
  Sim.run(TICK_RATE * 2 - 1);
  check('protection still on just before 2 s', (Actors.flags[1] & ACTOR_FLAG.PROTECTED) !== 0);
  Sim.step();
  check('protection ends exactly after 2 s', (Actors.flags[1] & ACTOR_FLAG.PROTECTED) === 0);
  Actors.flags[1] |= ACTOR_FLAG.GOD;
  killActor(1, 0);
  runSeconds(2.01);
  check('spawning keeps flags other sections own', Actors.alive[1] && (Actors.flags[1] & ACTOR_FLAG.GOD) !== 0 && (Actors.flags[1] & ACTOR_FLAG.PROTECTED) !== 0);
  spawns.stop();
  endModeTest();

  World.load(modesTestMap({ spawns: FFA_SPAWNS }));
  Game.start({ mode: 'ffa', seed: 1, player: {}, bots: [{ dummy: true }] });
  const player = Game.playerId;
  killActor(player, 1);
  runSeconds(1);
  Actors.buttons[player] = BTN.FIRE;
  runSeconds(2);
  check('a press before the delay does not respawn', !Actors.alive[player] && Modes.hudState().respawnIn === 0);
  Actors.buttons[player] = 0;
  Sim.step();
  Actors.buttons[player] = BTN.JUMP;
  Sim.step();
  check('a press after the delay respawns the player', Actors.alive[player] === 1);
  Actors.buttons[player] = 0;
  killActor(player, 1);
  runSeconds(10);
  check('no forced respawn before 10 s', !Actors.alive[player]);
  Sim.step();
  check('forced respawn at 10 s', Actors.alive[player] === 1);
  endModeTest();

  startModeTest('ffa', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1], { ruleset: { name: 'Waves', respawn: { wave: 5 } } });
  runSeconds(1);
  killActor(1, 0);
  runSeconds(4);
  check('wave respawn waits for the next 5 s wave', !Actors.alive[1]);
  Sim.step();
  check('wave respawn on the wave', Actors.alive[1] === 1);
  endModeTest();
});

Test.add('modes', (check) => {
  startModeTest('lms', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1]);
  check('lms: 3 lives each', Modes.lives[0] === 3 && Modes.hudState().teams === 0);
  killActor(1, 2); killActor(1, 2); killActor(0, 1);
  check('lms: rank by lives first, then score', Modes.rankOf(2) === 1 && Modes.rankOf(0) === 2 && Modes.rankOf(1) === 3, [0, 1, 2].map((id) => Modes.rankOf(id)).join());
  endModeTest();

  const lmsItems = [{ x: 5, y: 0, z: 5, item: 'healthpack' }, { x: 9, y: 0, z: 5, item: 'springboots' }];
  startModeTest('lms', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1]);
  Items.load(lmsItems, 'lms');
  const set = currentWeaponSet().weapons, lastWeapon = CAT.weapons.byId(set[set.length - 1]);
  const armed = set.every((key) => Weapons.owned[Weapons.slotIndex(0, CAT.weapons.byId(key).index)]);
  const fullReserve = Weapons.reserve[Weapons.slotIndex(0, lastWeapon.index)] === Weapons.maxReserve(0, lastWeapon);
  check('lms: every weapon of the set at full reserve and 100 armor on spawn (M15)', armed && fullReserve && Actors.armor[0] >= 100, set.length + ' ' + Actors.armor[0]);
  check('lms: no map pickups except the boots', Items.spotCount === 1 && Items.keyOf(0) === 'springboots', Items.spotCount);
  endModeTest();
  startModeTest('lms', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1], { ruleset: 'pilot' });
  check('lms: start armor stays within maxArmor (none in a ruleset without armor)', Actors.armor[0] <= Actors.maxArmor[0], Actors.armor[0] + ' / ' + Actors.maxArmor[0]);
  endModeTest();

  startModeTest('lms', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1]);
  for (let life = 0; life < 3; life++) { killActor(1, 0); runSeconds(2.1); }
  check('lms: out of lives means no respawn', !Actors.alive[1] && Modes.lives[1] === 0 && Modes.respawnIn(1, Sim.time) === -1);
  for (let life = 0; life < 2; life++) { killActor(2, 0); runSeconds(2.1); }
  check('lms: two left standing, match goes on', !Game.match.ended && Actors.alive[2] === 1);
  killActor(2, 0);
  Sim.step();
  check('lms: last one standing wins', Game.match.ended && Game.match.winner === 0 && Game.match.results.reason === 'eliminated');
  endModeTest();

  startModeTest('duel', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1], { modeOptions: { timeLimit: 20 } });
  check('duel: third player waits in the queue', Modes.queued[2] === 1 && !Actors.alive[2] && Actors.alive[0] && Actors.alive[1]);
  for (let i = 0; i < 30; i++) killActor(0, 1);
  Sim.step();
  check('duel: no frag limit', !Game.match.ended);
  runSeconds(20);
  check('duel: time limit decides, winner stays', Game.match.ended && Game.match.winner === 1 && Game.match.results.queue.join() === [Actors.name[1], Actors.name[2]].join());
  endModeTest();
});

const CTF_MAP = { spawns: TEAM_SPAWNS, objectives: [{ id: 'blueFlag', kind: 'flag', team: 0, x: -30, y: 0, z: 0 }, { id: 'redFlag', kind: 'flag', team: 1, x: 30, y: 0, z: 0 }] };

// HP-007: a carrier that goes down drops what it carries (a downed actor acts on no objective) and cannot take it back.
Test.add('modes', (check) => {
  startModeTest('ctf', modesTestMap(CTF_MAP), [0, 0, 1]);
  const redFlag = Modes.objectives[1];
  placeActor(1, -40, 40); placeActor(2, 40, -40);
  placeActor(0, 30.5, 0);
  Sim.step();
  const carried = redFlag.carrier === 0;
  placeActor(0, 10, 10);
  Damage.goDown(-1, 0);
  Sim.step();
  check('ctf: a carrier that goes down drops the flag', carried && redFlag.state === 'dropped' && redFlag.carrier === -1, redFlag.state + ' ' + redFlag.carrier);
  endModeTest();
});

Test.add('modes', (check) => {
  startModeTest('ctf', modesTestMap(CTF_MAP), [0, 1]);
  const [blueFlag, redFlag] = Modes.objectives;
  check('ctf: flags from the map', Modes.objectives.length === 2 && blueFlag.team === 0 && redFlag.state === 'home');
  placeActor(0, -30, 0);
  Sim.step();
  check('ctf: touching your own flag at home does nothing', blueFlag.state === 'home');
  placeActor(0, 30.5, 0);
  Sim.step();
  check('ctf: enemy flag picked up by touch', redFlag.state === 'carried' && redFlag.carrier === 0);
  placeActor(1, -30, 0);
  Sim.step();
  check('ctf: red carries the blue flag too', blueFlag.carrier === 1);
  placeActor(0, -30, 0.5);
  Sim.step();
  check('ctf: no capture while your own flag is away', Modes.teamScore[0] === 0 && redFlag.state === 'carried');
  placeActor(1, 10, 10);
  killActor(1, 0);
  Sim.step();
  check('ctf: carrier death drops the flag where it died', blueFlag.state === 'dropped' && blueFlag.x === 10 && blueFlag.z === 10);
  runSeconds(19.9);
  check('ctf: dropped flag waits', blueFlag.state === 'dropped');
  runSeconds(0.1);
  check('ctf: dropped flag returns after 20 s', blueFlag.state === 'home' && blueFlag.x === -30);
  check('ctf: capture with your flag home', Modes.teamScore[0] === 1 && redFlag.state === 'home' && Modes.objective[0] === 1);
  placeActor(0, 30, 0);
  Sim.step();
  placeActor(0, 0, 0);
  killActor(0, 1);
  Sim.step();
  placeActor(1, 0, 0.5);
  Sim.step();
  check('ctf: touching your own dropped flag returns it', redFlag.state === 'home' && Modes.objective[1] === 1);
  for (let capture = 0; capture < 2; capture++) {
    runSeconds(2.1);
    placeActor(0, 30, 0); Sim.step();
    placeActor(0, -30, 0); Sim.step();
  }
  check('ctf ends at 3 captures', Game.match.ended && Game.match.winner === 0 && Game.match.results.teams[0].objective === 3);
  endModeTest();

  const oneFlagMap = { spawns: TEAM_SPAWNS, objectives: [{ kind: 'flag', x: 0, y: 0, z: 0 }, { kind: 'flagBase', team: 0, x: -30, y: 0, z: 0 }, { kind: 'flagBase', team: 1, x: 30, y: 0, z: 0 }] };
  startModeTest('oneflag', modesTestMap(oneFlagMap), [0, 1]);
  const neutral = Modes.objectives[0];
  placeActor(1, 0, 0);
  Sim.step();
  check('oneflag: either team takes the neutral flag', neutral.carrier === 1);
  placeActor(1, 30, 0);
  Sim.step();
  check('oneflag: no score at your own base', Modes.teamScore[1] === 0);
  placeActor(1, -30, 0);
  Sim.step();
  check('oneflag: deliver to the enemy base', Modes.teamScore[1] === 1 && neutral.state === 'home');
  placeActor(0, 0, 0);
  Sim.step();
  Actors.remove(0);
  check('a removed carrier drops the flag', neutral.state === 'dropped' && neutral.carrier === -1);
  endModeTest();
});

Test.add('modes', (check) => {
  const domMap = { spawns: TEAM_SPAWNS, objectives: [{ id: 'A', kind: 'point', x: 0, y: 0, z: 0, radius: 5 }, { id: 'B', kind: 'point', x: 0, y: 0, z: 30, radius: 5 }] };
  startModeTest('dom', modesTestMap(domMap), [0, 0, 1]);
  const pointA = Modes.objectives[0], pointB = Modes.objectives[1];
  placeActor(0, 1, 0);
  Sim.run(8 * TICK_RATE - 1);
  check('dom: not captured just before 8 s', pointA.owner === NO_TEAM && pointA.capturingTeam === 0);
  Sim.step();
  check('dom: captured after exactly 8 s alone', pointA.owner === 0 && Modes.objective[0] === 1);
  check('dom: +1 per held point every 2 s', Modes.teamScore[0] === 1);
  runSeconds(2);
  check('dom: next tick', Modes.teamScore[0] === 2);
  placeActor(0, 0, 30); placeActor(1, 1, 30);
  Sim.run(Math.round(8 / 1.5 * TICK_RATE) - 1);
  check('dom: two capturers are faster (x1.5), not yet', pointB.owner === NO_TEAM);
  Sim.step();
  check('dom: two capturers take 8/1.5 s', pointB.owner === 0);
  placeActor(0, 0, 0); placeActor(1, 0, 0); placeActor(2, 1, 0);
  runSeconds(20);
  check('dom: a contested point does not flip', pointA.owner === 0 && pointA.progress === 0 && pointA.contested);
  placeActor(0, 40, 40); placeActor(1, 40, 40);
  runSeconds(4);
  check('dom: an enemy alone builds progress', pointA.capturingTeam === 1 && Test.near(pointA.progress, 0.5, 1e-6));
  placeActor(2, 40, 40);
  runSeconds(2);
  check('dom: an empty zone decays', Test.near(pointA.progress, 0.25, 1e-6));
  placeActor(0, 0, 0);
  runSeconds(2);
  check('dom: the owner undoes enemy progress', Test.near(pointA.progress, 0, 1e-6) && pointA.owner === 0);
  endModeTest();

  // HP-007: a downed actor in a zone neither captures nor contests, and no objective touch finds it.
  startModeTest('dom', modesTestMap(domMap), [0, 0, 1]);
  const point = Modes.objectives[0];
  placeActor(0, 1, 0); placeActor(1, 40, 40); placeActor(2, 0, 1);
  Damage.goDown(-1, 0);
  runSeconds(4);
  check('dom: a downed actor does not contest the point', !point.contested && point.capturingTeam === 1 && point.inside[0] === 0, point.inside.join());
  placeActor(2, -40, -40);
  runSeconds(9);
  check('dom: a downed actor alone does not capture', point.owner === NO_TEAM && point.capturingTeam === NO_TEAM, point.owner + ' ' + point.capturingTeam);
  check('objectives: findActorNear passes over a downed actor', Modes.findActorNear(1, 0, 0, 2, NO_TEAM, NEAR_ANY) === -1 && Modes.findActorNear(40, 0, 40, 2, NO_TEAM, NEAR_ANY) === 1);
  endModeTest();

  const hillMap = { spawns: TEAM_SPAWNS, objectives: [{ id: 'H1', kind: 'hill', x: 0, y: 0, z: 0 }, { id: 'H2', kind: 'hill', x: 0, y: 0, z: 30 }] };
  startModeTest('hardpoint', modesTestMap(hillMap), [0, 1], { modeOptions: { params: { moveInterval: 20 } } });
  const [hillOne, hillTwo] = Modes.objectives;
  placeActor(0, 0, 0);
  runSeconds(10);
  check('hardpoint: 1 point per second held alone', Modes.teamScore[0] === 10 && hillOne.owner === 0 && hillOne.active && !hillTwo.active, Modes.teamScore[0]);
  placeActor(1, 1, 0);
  runSeconds(5);
  check('hardpoint: contested scores nothing', Modes.teamScore[0] === 10 && Modes.teamScore[1] === 0);
  placeActor(1, 40, 40);
  runSeconds(5);
  check('hardpoint: holding resumes', Modes.teamScore[0] === 15);
  runSeconds(5);
  check('hardpoint: the zone moves on schedule', hillTwo.active && !hillOne.active && Modes.teamScore[0] === 15);
  endModeTest();
});

// Editor limits (R-130, R-136): a limit row shows only where the mode honours it; fewer rounds to win still reach the side switch.
Test.add('modes', (check) => {
  const shown = (key, mode) => EDITOR_FIELDS.find((field) => field.key === key).show(Object.assign(customDefaults(), { mode }));
  check('editor: Last Squad hides the time and score limits (rounds decide)', !shown('timeLimit', 'elim') && !shown('scoreLimit', 'elim'));
  check('editor: Arms Ladder and Convoy keep only the time limit', shown('timeLimit', 'gungame') && !shown('scoreLimit', 'gungame') && shown('timeLimit', 'payload') && !shown('scoreLimit', 'payload'));
  check('editor: Frenzy shows both limits, Siege Waves (its own end) none', shown('timeLimit', 'ffa') && shown('scoreLimit', 'ffa') && !shown('timeLimit', 'horde') && !shown('scoreLimit', 'horde'));
  const options = CustomMatch.modeOptions(Object.assign(customDefaults(), { mode: 'bomb', roundWins: 3 }), CAT.modes.byId('bomb'));
  check('editor: 3 rounds to win: at most 5 rounds, the sides switch after 2', options.rounds.winsNeeded === 3 && options.rounds.limit === 5 && options.rounds.switchAt === 2, JSON.stringify(options.rounds));
  startModeTest('bomb', modesTestMap(BOMB_MAP), [0, 1], { modeOptions: { rounds: Object.assign({}, options.rounds, { freeze: 1, endDelay: 1, live: 5 }) } });
  runSeconds(14.5);
  check('bomb to 3 wins: switched sides by round 3', Modes.round === 3 && Modes.swapped, Modes.round + ' ' + Modes.swapped);
  endModeTest();
});

// Announcements name objectives the way the HUD letters them, never by their map id (R-129).
Test.add('modes', (check) => {
  const announcements = startEventLog('announce');
  const labelMap = { spawns: TEAM_SPAWNS, objectives: [{ id: 'pointWest', kind: 'point', x: 0, y: 0, z: 0, radius: 5 }, { id: 'pointEast', kind: 'point', x: 0, y: 0, z: 30, radius: 5, name: 'the bridge' }] };
  startModeTest('dom', modesTestMap(labelMap), [0, 1], { modeOptions: { params: { captureTime: 1 } } });
  placeActor(0, 0, 30);
  runSeconds(1.1);
  placeActor(0, 1, 0);
  runSeconds(1.1);
  const captures = announcements.filter((event) => event.kind === 'capture').map((event) => event.text);
  check('dom: a capture names the HUD letter, or the map name for the point', captures.join() === 'Blue captured the bridge,Blue captured point A' && Modes.objectiveLetter(Modes.objectives, 1) === 1, captures.join());
  endModeTest();
  const hillMap = { spawns: TEAM_SPAWNS, objectives: [{ id: 'hill1', kind: 'hill', x: 0, y: 0, z: 0 }, { id: 'hill2', kind: 'hill', x: 0, y: 0, z: 30 }] };
  startModeTest('hardpoint', modesTestMap(hillMap), [0, 1], { modeOptions: { params: { moveInterval: 2 } } });
  runSeconds(2.1);
  check('hardpoint: the move announcement shows no map id', announcements.some((event) => event.kind === 'objective') && !announcements.some((event) => /hill\d/.test(event.text)),
    announcements.map((event) => event.text).join());
  announcements.stop();
  endModeTest();
});

Test.add('modes', (check) => {
  const conquestMap = { spawns: TEAM_SPAWNS, objectives: [{ id: 'A', kind: 'point', x: 0, y: 0, z: -20 }, { id: 'B', kind: 'point', x: 0, y: 0, z: 0 }, { id: 'C', kind: 'point', x: 0, y: 0, z: 20 }] };
  startModeTest('conquest', modesTestMap(conquestMap), [0, 1], { modeOptions: { params: { tickets: 10, captureTime: 1 } } });
  check('conquest: tickets as team score', Modes.teamScore[0] === 10 && Modes.teamScore[1] === 10);
  killActor(0, 1);
  check('conquest: a death costs one ticket', Modes.teamScore[0] === 9 && Modes.teamScore[1] === 10);
  runSeconds(3);
  check('conquest: nobody bleeds at 0-0', Modes.teamScore[0] === 9 && Modes.teamScore[1] === 10, Modes.teamScore[0] + '/' + Modes.teamScore[1]);
  placeActor(1, 0, 0);
  runSeconds(1);
  check('conquest: point captured', Modes.objectives[1].owner === 1);
  const pointSpawn = Modes.spawnPoints.find((point) => point.objective === Modes.objectives[1]);
  check('conquest: owned points are spawn points for the owner only', pointSpawn && Modes.spawnUsable(pointSpawn, 1, true) && !Modes.spawnUsable(pointSpawn, 0, true));
  placeActor(1, 50, 50);
  let blue = Modes.teamScore[0], red = Modes.teamScore[1];
  runSeconds(3);
  check('conquest: only the team holding fewer points (and <= 2) bleeds 1 per 3 s', Modes.teamScore[0] === blue - 1 && Modes.teamScore[1] === red, Modes.teamScore[0] + '/' + Modes.teamScore[1]);
  for (const point of Modes.objectives) point.owner = 1;
  blue = Modes.teamScore[0]; red = Modes.teamScore[1];
  runSeconds(3);
  check('conquest: holding 3 points stops the bleed', Modes.teamScore[0] === blue - 1 && Modes.teamScore[1] === red, Modes.teamScore[0] + '/' + Modes.teamScore[1]);
  for (let i = 0; i < 10; i++) killActor(0, 1);
  Sim.step();
  check('conquest: out of tickets loses', Game.match.ended && Game.match.winner === 1 && Game.match.results.reason === 'tickets');
  endModeTest();

  const controlMap = { spawns: TEAM_SPAWNS, objectives: [{ id: 'U', kind: 'point', x: 0, y: 0, z: 0 }] };
  const rounds = startEventLog('round');
  startModeTest('control', modesTestMap(controlMap), [0, 1], { modeOptions: { params: { captureTime: 1, progressTime: 5 }, rounds: { freeze: 1, endDelay: 1 } } });
  check('control: round 1 starts frozen', Modes.phase === PHASE.FREEZE && (Actors.flags[0] & ACTOR_FLAG.FROZEN) !== 0);
  runSeconds(1.01);
  check('control: live after the freeze', Modes.phase === PHASE.LIVE && (Actors.flags[0] & ACTOR_FLAG.FROZEN) === 0);
  placeActor(0, 0, 0);
  runSeconds(3);
  placeActor(1, 1, 0);
  runSeconds(1);
  check('control: the owner\'s meter keeps filling while contested', Test.near(Modes.teamMeter[0], 3 / 5, 0.01) && !Modes.overtime, Modes.teamMeter[0]);
  runSeconds(3);
  check('control: contested, the meter stops at 99% in overtime', Modes.teamMeter[0] === 0.99 && Modes.overtime && Modes.teamRounds[0] === 0 && Modes.phase === PHASE.LIVE, Modes.teamMeter[0]);
  placeActor(1, 40, 40);
  runSeconds(0.05);   // the last 1% of a 5 s meter
  check('control: 100% wins the round once the enemy leaves', Modes.teamRounds[0] === 1 && Modes.phase === PHASE.ROUND_END && !Modes.overtime);
  runSeconds(1.1);
  check('control: next round resets the meter', Modes.round === 2 && Modes.teamMeter[0] === 0 && Modes.objectives[0].owner === NO_TEAM);
  runSeconds(1);
  placeActor(0, 0, 0);
  runSeconds(6.1);
  rounds.stop();
  check('control: best of 3 ends 2-0', Game.match.ended && Game.match.winner === 0 && Game.match.results.reason === 'rounds');
  check('control: round events start/live/end', rounds.filter((event) => event.phase === 'end').length === 2 && rounds[0].phase === 'start' && rounds[1].phase === 'live');
  endModeTest();
});

const BOMB_MAP = { spawns: TEAM_SPAWNS, objectives: [{ id: 'siteA', kind: 'bombsite', x: 20, y: 0, z: 0, radius: 4 }] };
const BOMB_OPTIONS = { modeOptions: { rounds: { freeze: 1, endDelay: 1, live: 30 } } };

function startBombTest() {
  startModeTest('bomb', modesTestMap(BOMB_MAP), [0, 1], BOMB_OPTIONS);
  runSeconds(1.01);   // the 1 s freeze ends in the step at t = 1 s
}

function holdUseFor(id, seconds) {
  Actors.buttons[id] = BTN.USE;
  runSeconds(seconds);
  Actors.buttons[id] = 0;
}

// swap-02: Use held to plant or defuse on a dropped gun at the carry limit (and on after it) keeps the held gun; a
// fresh Use on the gun still swaps.
Test.add('modes', (check) => {
  startBombTest();
  const fill = (id) => { Weapons.setLoadout(id, []); for (const key of ['vanguard', 'verdict', 'hush', 'hornet']) if (!Weapons.atCarryLimit(id)) Weapons.give(id, key, 0); };
  fill(0); fill(1);
  placeActor(0, 20, 0); placeActor(1, 20, 1.2);
  Items.drop('tempest', 20, 0, 0); Items.drop('wasp', 20, 0, 1.2);
  holdUseFor(0, 5);
  check('bomb: Use held to plant on a gun at the carry limit swaps nothing', Modes.objectives[1].state === 'planted' && Weapons.atCarryLimit(0) && !Weapons.has(0, 'tempest'));
  Sim.step();   // Use let go
  holdUseFor(0, 0.1);
  check('bomb: a fresh Use on the gun after the plant swaps', Weapons.has(0, 'tempest'));
  holdUseFor(1, 7.5);
  check('bomb: Use held to defuse on a gun swaps nothing', Modes.objectives[1].state === 'defused' && Weapons.atCarryLimit(1) && !Weapons.has(1, 'wasp'));
  endModeTest();
});

Test.add('modes', (check) => {
  startBombTest();
  const charge = Modes.objectives[1];
  check('bomb: an attacker carries the charge', Modes.attackingTeam() === 0 && charge.carrier === 0);
  placeActor(0, 20, 0);
  holdUseFor(0, 3);
  Sim.step();
  check('bomb: releasing USE resets the plant', charge.timer === 0 && charge.state === 'carried');
  Actors.buttons[0] = BTN.USE;
  Sim.run(4 * TICK_RATE - 1);
  check('bomb: not planted before 4 s', charge.state === 'carried');
  Sim.step();
  Actors.buttons[0] = 0;
  check('bomb: planted after exactly 4 s', charge.state === 'planted' && Modes.objective[0] === 1);
  check('bomb: the fuse replaces the round clock', Test.near(Modes.hudState().timeLeft, 40, 0.01));
  killActor(0, 1);
  runSeconds(1);
  check('bomb: attackers dead after the plant: round goes on', Modes.phase === PHASE.LIVE);
  placeActor(1, 20, 1);
  holdUseFor(1, 4);
  Sim.step();
  check('bomb: an interrupted defuse keeps 3.5 s', charge.timer === 3.5);
  Actors.buttons[1] = BTN.USE;
  Sim.run(Math.round(3.5 * TICK_RATE) - 1);
  check('bomb: not defused yet', Modes.phase === PHASE.LIVE);
  Sim.step();
  Actors.buttons[1] = 0;
  check('bomb: defused after 7 s in total', Modes.teamRounds[1] === 1 && Modes.roundReason === 'defused' && Modes.objective[1] === 1 && charge.state === 'defused');
  endModeTest();

  // Two defenders at the charge: only the higher id holds USE, and it still defuses.
  startModeTest('bomb', modesTestMap(BOMB_MAP), [0, 1, 1], BOMB_OPTIONS);
  runSeconds(1.01);
  placeActor(0, 20, 0);
  holdUseFor(0, 4);
  placeActor(1, 20, 0.5); placeActor(2, 20, -0.5);
  holdUseFor(2, 7);
  check('bomb: any defender holding USE in range defuses', Modes.teamRounds[1] === 1 && Modes.roundReason === 'defused' && Modes.objective[2] === 1 && Modes.objective[1] === 0);
  endModeTest();

  startBombTest();
  const blasts = startEventLog('explosion');
  placeActor(0, 20, 0);
  holdUseFor(0, 4);
  runSeconds(40 - 1 / TICK_RATE - 0.01);
  check('bomb: fuse still burning', Modes.phase === PHASE.LIVE);
  runSeconds(0.02);
  blasts.stop();
  check('bomb: detonation after 40 s wins for the attackers', Modes.teamRounds[0] === 1 && Modes.roundReason === 'detonated' && blasts.length === 1 && blasts[0].radius === 15 && blasts[0].owner === 0);
  endModeTest();

  startBombTest();
  runSeconds(30);
  check('bomb: time out without a plant goes to the defenders', Modes.teamRounds[1] === 1 && Modes.roundReason === 'time');
  endModeTest();

  startBombTest();
  killActor(1, 0);
  Sim.step();
  check('bomb: defenders wiped before the plant', Modes.teamRounds[0] === 1 && Modes.roundReason === 'eliminated');
  runSeconds(1);
  check('bomb: next round, everyone alive and frozen', Modes.round === 2 && Actors.alive[1] === 1 && (Actors.flags[1] & ACTOR_FLAG.FROZEN) !== 0);
  endModeTest();

  startModeTest('bomb', modesTestMap(BOMB_MAP), [0, 1], { modeOptions: { rounds: { freeze: 1, endDelay: 1, live: 30, switchAt: 1, winsNeeded: 2 } } });
  runSeconds(1.01);
  killActor(1, 0);
  Sim.step();
  check('bomb: no respawn inside a round', !Actors.alive[1] && Modes.respawnIn(1, Sim.time) === -1);
  runSeconds(1.1);
  check('bomb: sides switch after the switch round', Modes.swapped && Modes.attackingTeam() === 1 && Modes.objectives[1].carrier === 1);
  runSeconds(1);
  killActor(1, 0);
  Sim.step();
  check('bomb: first to the round wins ends the match', Game.match.ended && Game.match.winner === 0 && Game.match.results.rounds === 2);
  endModeTest();
});

Test.add('modes', (check) => {
  const hazards = startEventLog('damage.request');
  startModeTest('elim', modesTestMap({ spawns: TEAM_SPAWNS }), [0, 0, 1], { modeOptions: { rounds: { freeze: 1, endDelay: 1, live: 40, winsNeeded: 2 } } });
  runSeconds(1.01);
  placeActor(1, 0, 0); placeActor(2, 59, 59);
  runSeconds(9);
  check('elim: safe area idle until the last 30 s', Modes.hud.zoneRadius === 0 && hazards.length === 0);
  runSeconds(15);
  check('elim: safe area shrinks', Modes.hud.zoneRadius > 5 && Modes.hud.zoneRadius < Math.hypot(120, 120) / 2);
  check('elim: outside the safe area hurts once per second', hazards.length >= 12 && hazards.every((event) => event.target === 2 && event.kind === 'hazard' && event.amount === 5), hazards.length);
  placeActor(2, 1, 1);
  runSeconds(16);
  check('elim: time out goes to the side with more alive', Modes.teamRounds[0] === 1 && Modes.roundReason === 'time');
  runSeconds(2.1);
  killActor(0, 2);
  Sim.step();
  check('elim: one life per round', !Actors.alive[0] && Modes.respawnIn(0, Sim.time) === -1 && Modes.phase === PHASE.LIVE);
  killActor(2, 1);
  Sim.step();
  hazards.stop();
  check('elim: wiping a team wins the round and the match', Game.match.ended && Game.match.winner === 0 && Game.match.results.teams[0].rounds === 2);
  endModeTest();
});

Test.add('modes', (check) => {
  const oneSpawnEach = modesTestMap({ spawns: [{ x: -45, y: 0, z: 0, team: 0 }, { x: 45, y: 0, z: 0, team: 1 }] });
  startModeTest('elim', oneSpawnEach, [0, 1], { modeOptions: { rounds: { freeze: 0, endDelay: 1, live: 5 } } });
  placeActor(1, -45, 0);   // a survivor standing on the enemy spawn when the round ends
  runSeconds(6.01);
  check('round start: survivors of the last round do not block spawns', Modes.round === 2 && Actors.x[0] === -45 && Actors.x[1] === 45, Actors.x[0] + ',' + Actors.x[1]);
  endModeTest();

  startModeTest('elim', modesTestMap({ spawns: TEAM_SPAWNS }), [0, 1], { modeOptions: { rounds: { freeze: 0, endDelay: 1, live: 5, limit: 2 } } });
  runSeconds(5.01);
  check('round time out with equal survivors is a drawn round', Modes.teamRounds[0] === 0 && Modes.teamRounds[1] === 0 && Modes.round === 1 && Modes.roundWinner === DRAW);
  runSeconds(6.01);
  check('after the last round with no lead the match is a draw', Game.match.ended && Game.match.winner === DRAW && Game.match.results.rounds === 2);
  endModeTest();
});

Test.add('modes', (check) => {
  startModeTest('ctf', modesTestMap(CTF_MAP), [0, 1]);
  const first = Modes.hudState(), second = Modes.hudState();
  check('hud state is one reused object', first === second && first.teamScores === Modes.teamScore && first.objectives === Modes.objectives);
  check('hud state fields', first.mode === 'ctf' && first.teams === 2 && first.scoreLimit === 3 && Test.near(first.timeLeft, 900, 0.01) && first.phase === PHASE.LIVE);
  let meshes = 0;
  Modes.draw({ meshFrom: () => { meshes++; } });
  check('one marker per objective (Render source)', meshes === Modes.objectives.length);
  endModeTest();
});

// Every mode starts, spawns and runs on a map with every objective kind (unregistered modes use the defaults).
const ALL_OBJECTIVE_KINDS = ['flag', 'flagBase', 'point', 'hill', 'bombsite', 'payloadPath', 'relic', 'core', 'bank', 'extract'];
const ALL_OBJECTIVES_MAP = { spawns: TEAM_SPAWNS, objectives: ALL_OBJECTIVE_KINDS.map((kind, index) => ({ kind, team: index % 2, x: -25 + index * 5, y: 0, z: 20 })) };

Test.add('modes', (check) => {
  for (const mode of CAT.modes) {
    startModeTest(mode.id, modesTestMap(ALL_OBJECTIVES_MAP), mode.teams === 2 ? [0, 1, 0, 1] : [-1, -1, -1, -1]);
    const spawned = Actors.alive[0] === 1 && Number.isFinite(Actors.x[0]);
    killActor(1, 0);
    runSeconds(20);
    check('mode ' + mode.code + ' ' + mode.id + ' starts and runs', spawned && Game.match.rules.mode === mode.id && (Modes.active || Game.match.ended));
    endModeTest();
  }
});

// Integration (spawning contract): a real ffa match on the smallest hand-made map spawns everyone ready to fight, and the dead return.
Test.add('modes', (check) => {
  Game.start({ mode: 'ffa', map: 'spire', seed: 1, bots: [{}, {}, {}] });
  check('the match map is loaded into the world', World.map && World.map.id === 'spire' && World.brushes.length > 0);
  const ids = [];
  for (let id = 0; id < Actors.count; id++) if (Modes.participant[id]) ids.push(id);
  const health = Damage.preset().health;
  check('3 participants', ids.length === 3, ids.length);
  check('everyone spawns alive with the preset health', ids.every((id) => Actors.alive[id] && Actors.health[id] === health), ids.map((id) => Actors.health[id]).join());
  check('everyone spawns with a weapon in hand', ids.every((id) => Weapons.currentWeapon(id) !== null));
  runSeconds(0.5);
  check('everyone stands on the floor', ids.every((id) => (Actors.flags[id] & ACTOR_FLAG.ON_GROUND) && Actors.alive[id]), ids.map((id) => Actors.y[id].toFixed(2)).join());
  runSeconds(Game.match.rules.respawn.protect);   // spawn protection (S13) ignores damage until it ends
  const victim = ids[0], delay = Game.match.rules.respawn.delay;
  TestArena.hit(ids[1], victim, 100000);
  check('a lethal hit kills', !Actors.alive[victim]);
  Sim.run(Math.round(delay * TICK_RATE) - 2);
  check('no respawn before rules.respawn.delay', !Actors.alive[victim]);
  Sim.run(4);
  check('respawned after rules.respawn.delay with health and a weapon', Actors.alive[victim] && Actors.health[victim] === health && Weapons.currentWeapon(victim) !== null);
  Game.stop();
});

// PERF-006: the per-step mode code measures with length2 / length3, never the boxing Math.hypot (normalize-07).
Test.add('modes', (check) => {
  const perStep = [Modes.rateSpawn, Modes.inZone, Economy.buyBlock, chooseNextCircle, centralSpot];
  const boxed = perStep.filter((fn) => /Math\.hypot/.test(String(fn))).map((fn) => fn.name);
  check('spawn rating, zone tests, the buy zone and the ring use no Math.hypot', perStep.every((fn) => typeof fn === 'function') && boxed.length === 0, boxed.join());
});

// Objective markers use the team colours of the bodies and the HUD, colour-blind palette included (normalize-02).
Test.add('modes', (check) => {
  const drawn = [], palette = Render.teamPalette, flag = makeObjective({ kind: 'flag', team: 1 }, 0);
  const recorder = { meshFrom(shape, shown) { drawn.push(Math.round(shown.r * 255) * 65536 + Math.round(shown.g * 255) * 256 + Math.round(shown.b * 255)); } };
  Render.teamPalette = [0x0072b2, 0xffb000];
  drawObjective(recorder, flag);
  Render.teamPalette = null;
  drawObjective(recorder, flag);
  drawObjective(recorder, makeObjective({ kind: 'point' }, 1));
  Render.teamPalette = palette;
  check('markers: team colours with and without the colour-blind palette, neutral when unowned', drawn.join() === [0xffb000, colorNumber(CAT.teamColors[1].color), 0xd9d9d9].join(), drawn.join());
});
