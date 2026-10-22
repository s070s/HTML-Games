// Self-tests: PvE enemies, director, PvE modes and the boss (S14 14h..14k, group 'pve').

const PVE_TEST_TELL_SLACK = 2 * TICK_SECONDS;
// Distance each attacking archetype starts from its dummy target (inside one of its attack ranges, outside keepRange[0]).
const PVE_TEST_START = { husk: 1.2, gunner: 12, brute: 2.5, phalanx: 1.8, stalker: 1.4, longeye: 20, mite: 1, bomber: 1.5, charger: 10,
  turret: 10, leaper: 7, overlord: 3, beast: 1.6, fireback: 10 };

function pveTestMap(extra) {
  return Object.assign({ id: 'pve-test', brushes: [TEST_FLOOR], spawns: [{ x: 0, y: 0, z: 0, yaw: 0 }], objectives: [], items: [] }, extra);
}

// One practice dummy (id 0) at the origin; returns it.
function startPveTest(setup) {
  World.load(pveTestMap());
  Game.start(Object.assign({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: 0 }], difficulty: 'regular' }, setup));
  Modes.endProtection(0);   // spawn protection would swallow the first hits
  return 0;
}

// Spawns `key` at distance metres in front of the dummy (+z), facing it.
function spawnFacing(key, distance) {
  return Pve.spawnEnemy(key, 0, 0, distance, Math.PI);
}

function killEnemy(id) {
  const info = Damage.info();
  info.amount = Actors.health[id] + Actors.shield[id] + Actors.armor[id] + 1; info.kind = 'hit'; info.dx = 0; info.dy = 0; info.dz = -1;
  Damage.apply(0, id, info);
}

// Runs until the first damage from `id` reaches the dummy (or `seconds` pass); holds the dummy alive and in place; each() runs per tick.
function runUntilHit(id, dummy, seconds, each) {
  const hits = startEventLog('damage');
  const x = Actors.x[dummy], z = Actors.z[dummy];
  for (let tick = 0; tick < seconds * TICK_RATE; tick++) {
    Actors.health[dummy] = Actors.maxHealth[dummy];
    Actors.x[dummy] = x; Actors.z[dummy] = z; Actors.vx[dummy] = Actors.vz[dummy] = 0;
    if (each) each();
    Sim.run(1);
    if (hits.some((event) => event.source === id && event.target === dummy && event.amount > 0)) break;
  }
  hits.stop();
  return hits.find((event) => event.source === id && event.target === dummy && event.amount > 0) || null;
}

Test.add('pve', (check) => {
  check('14 enemy rows E01..E14 plus range targets', CAT.enemies.filter((row) => row.code[0] === 'E').length === 14);
  const shortTells = CAT.enemies.flatMap((row) => row.attackRows.filter((attack) => attack.tell < PVE_MIN_TELL).map((attack) => row.id + '.' + attack.id));
  check('every attack telegraphs >= 0.4 s (NPC-002)', shortTells.length === 0, shortTells.join());
  const fewAnswers = CAT.enemies.filter((row) => row.answers.length < 2).map((row) => row.id);
  check('every enemy has at least two answers', fewAnswers.length === 0, fewAnswers.join());
  const badBrains = CAT.enemies.filter((row) => !PveBrains[row.brain]).map((row) => row.id);
  check('every brain kind exists', badBrains.length === 0, badBrains.join());
  const badKinds = CAT.enemies.flatMap((row) => row.attackRows.filter((attack) => !PveAttacks[attack.kind]).map((attack) => row.id + '.' + attack.kind));
  check('every attack kind exists', badKinds.length === 0, badKinds.join());
  const badParts = CAT.enemies.filter((row) => row.parts.length === 0 || row.parts.some((part) => PART_TINTS[part[7]] === undefined)).map((row) => row.id);
  check('every enemy has procedural parts with known tints', badParts.length === 0, badParts.join());
  check('parryable tells are green, unblockable red', tellColor({ parry: true }) === 0x40ff60 && tellColor({ unblockable: true }) === 0xff2020);
});

// Each attacking archetype telegraphs, then hurts its target no sooner than its tell; then it dies to damage.
Test.add('pve', (check) => {
  const failures = [];
  for (const key of Object.keys(PVE_TEST_START)) {
    const dummy = startPveTest();
    const tells = startEventLog('pve.tell');
    const id = spawnFacing(key, PVE_TEST_START[key]);
    const hit = runUntilHit(id, dummy, 8);
    tells.stop();
    const tell = tells.find((event) => event.id === id && event.kind !== 'blink');
    const row = CAT.enemies.byId(key);
    if (!hit || !tell) { failures.push(key + (tell ? ' no hit' : ' no tell') + ' id ' + id + ' ' + JSON.stringify(Pve.stats) + ' goal ' + Pve.goal[id] + ' t ' + Pve.target[id] + ' sees ' + BotSense.sees(id, 0) + ' alive ' + Actors.alive[id] + ' cap ' + Pve.cap() + ' pos ' + Actors.x[id].toFixed(1) + ',' + Actors.z[id].toFixed(1) + ' flags ' + Actors.flags[0] + ' ended ' + Game.match.ended + ' ' + Game.match.winner + ' time ' + Sim.time.toFixed(2) + ' nt ' + Pve.nextThink[id].toFixed(2) + ' active ' + Pve.active); Game.stop(); continue; }
    const attack = row.attackRows.find((entry) => entry.id === tell.attack);
    if (hit.time + PVE_TEST_TELL_SLACK < tell.time + attack.tell) failures.push(key + ' hit ' + (hit.time - tell.time).toFixed(2) + ' s after the tell');
    if (Actors.alive[id]) killEnemy(id);
    if (Actors.alive[id]) failures.push(key + ' survived');
    Game.stop();
  }
  check('every archetype attacks after its tell and dies', failures.length === 0, failures.join(', '));
});

// ---- Modes ----
const PVE_ENEMY_GATES = [{ x: 40, y: 0, z: 40, yaw: 180, team: 1 }, { x: -40, y: 0, z: 40, yaw: 180, team: 1 }, { x: 0, y: 0, z: -45, yaw: 0, team: 1 }];
const PVE_HOME = [{ x: 0, y: 0, z: 0, yaw: 0, team: 0 }, { x: 2, y: 0, z: 0, yaw: 0, team: 0 }];

// Starts a PvE mode on the open test floor with dummies (teams), immortal and unprotected.
function startPveMode(mode, teams, extra, setup) {
  World.load(pveTestMap(Object.assign({ spawns: PVE_HOME.concat(PVE_ENEMY_GATES) }, extra)));
  const bots = teams.map((team) => ({ dummy: true, team }));
  Game.start(Object.assign({ mode, seed: 1, bots, difficulty: 'regular' }, setup));
  const ids = [];
  for (let id = 0; id < Actors.count; id++) if (Modes.participant[id]) { ids.push(id); Modes.endProtection(id); }
  return ids;
}
function godMode(ids) { for (const id of ids) Actors.flags[id] |= ACTOR_FLAG.GOD; }
// Kills every living enemy passing the filter (the killer gets the credit); returns how many died.
function killAllEnemies(killer, filter) {
  let killed = 0;
  for (let id = 0; id < Actors.count; id++) {
    if (!Pve.isEnemy(id) || !Actors.alive[id] || (filter && !filter(id))) continue;
    const info = Damage.info();
    info.amount = 1e6; info.kind = 'hit'; info.dx = 0; info.dy = 0; info.dz = 1;
    Damage.apply(killer, id, info);
    killed++;
  }
  return killed;
}
// Runs the sim in 0.25 s slices until done() (or seconds pass); calls each(slice) between slices.
function runUntil(done, seconds, each) {
  for (let slice = 0; slice < seconds * 4; slice++) {
    if (done()) return true;
    Sim.run(TICK_RATE / 4);
    if (each) each(slice);
  }
  return done();
}
function withShortShop(run) {
  const shop = PVE_WAVE_RULES.shopSeconds, first = PVE_WAVE_RULES.firstWaveDelay;
  PVE_WAVE_RULES.shopSeconds = 1; PVE_WAVE_RULES.firstWaveDelay = 0.5;
  try { run(); } finally { PVE_WAVE_RULES.shopSeconds = shop; PVE_WAVE_RULES.firstWaveDelay = first; }
}

// Ten headless horde waves: kills each wave, never more enemies alive than the quality cap, the boss wave, then victory.
Test.add('pve', (check) => withShortShop(() => {
  const ids = startPveMode('horde', [0, 0]);
  godMode(ids);
  const behaviour = Modes.behaviour, cap = Pve.cap(), waves = startEventLog('pve.wave');
  let overCap = 0, sawBoss = false, sawChampion = false;
  runUntil(() => !Modes.active, 600, () => {
    if (Pve.aliveCount() > cap) overCap++;
    for (let id = 0; id < Actors.count; id++) {
      if (!Pve.isEnemy(id) || !Actors.alive[id]) continue;
      if (Pve.rowOf(id).boss) sawBoss = true;
      if (Pve.champion[id] >= 0) sawChampion = true;
    }
    if (behaviour.run.state === PVE_WAVE_STATE.FIGHT && (Pve.queue.count === 0 || Pve.aliveCount() >= cap / 2)) killAllEnemies(ids[0]);
  });
  waves.stop();
  const cleared = waves.filter((event) => event.kind === 'cleared').length, results = Game.match.results;
  check('10 horde waves cleared headless, then victory', cleared === 10 && results && results.reason === PVE_WIN && results.winnerId === ids[0],
    cleared + ' ' + (results && results.reason));
  check('the director stays within the quality enemy cap', overCap === 0 && Pve.stats.maxAlive <= cap, Pve.stats.maxAlive + ' / ' + cap);
  check('wave 5 brings a champion, wave 10 the overlord', sawChampion && sawBoss, sawChampion + ' ' + sawBoss);
  check('the party earned the wave bonus money', Economy.money(ids[1]) > 0, Economy.money(ids[1]));
  endModeTest();
}));

// The core falling with no retries left loses the run; with checkpoints the wave restarts.
Test.add('pve', (check) => withShortShop(() => {
  const ids = startPveMode('horde', [0], {}, { difficulty: 'ascendant' });
  check('ascendant: one life, no checkpoints', Modes.lives[ids[0]] === 1 && Modes.behaviour.run.retriesLeft === 0, Modes.lives[ids[0]]);
  check('the core stands with the mode health', Pve.core.active && Pve.core.health === 5000);
  Pve.core.shield = 0;
  check('the wave shop sells the core shield', Economy.grants.grant(ids[0], { kind: 'grant', key: 'coreShield' }) && Pve.core.shield === PVE_WAVE_RULES.coreShield);
  Pve.core.shield = 0;
  runUntil(() => Modes.behaviour.run.state === PVE_WAVE_STATE.FIGHT, 10);
  Pve.damageCore(1e6, -1);
  runSeconds(0.5);
  const results = Game.match.results;
  check('a destroyed core loses the run', !Modes.active && results && results.reason === PVE_LOSE && results.winner === DRAW, results && results.reason);
  endModeTest();
  const retry = startPveMode('horde', [0]);
  runUntil(() => Modes.behaviour.run.state === PVE_WAVE_STATE.FIGHT, 10);
  Pve.damageCore(1e6, -1);
  runSeconds(0.5);
  const run = Modes.behaviour.run;
  check('with checkpoints the wave restarts (retries 2)', Modes.active && run.retriesLeft === 1 && Pve.core.health > 0 && run.wave === 0, run.retriesLeft + ' ' + run.wave);
  check('the participants stand at the checkpoint', Actors.alive[retry[0]] === 1);
  endModeTest();
}));

// Endless: budgets and enemy scale grow per wave (capped), extraction opens after wave 5 and wins.
Test.add('pve', (check) => withShortShop(() => {
  const ids = startPveMode('endless', [0], { objectives: [{ id: 'extract', kind: 'extract', x: 10, y: 0, z: 0, radius: 3, modes: ['endless'] }] });
  godMode(ids);
  ENDLESS_PLAN.enqueue(1);
  const first = Pve.queue.count, firstScale = Pve.queue.scale[Pve.queue.head];
  Pve.queue.count = 0;
  ENDLESS_PLAN.enqueue(6);
  const sixth = Pve.queue.count, sixthScale = Pve.queue.scale[Pve.queue.head];
  Pve.queue.count = 0;
  check('endless budgets grow with the wave', sixth > first, first + ' -> ' + sixth);
  check('endless scale +8% per wave', Test.near(firstScale, 1, 1e-6) && Test.near(sixthScale, 1.4, 1e-5), firstScale + ' ' + sixthScale);
  ENDLESS_PLAN.enqueue(60);
  check('endless scale caps at x4', Test.near(Pve.queue.scale[Pve.queue.head], 4, 1e-6));
  Pve.queue.count = 0;
  const run = Modes.behaviour.run;
  runUntil(() => run.wave >= 5 && run.state === PVE_WAVE_STATE.EXTRACT, 400, () => { if (run.state === PVE_WAVE_STATE.FIGHT && Pve.queue.count === 0) killAllEnemies(ids[0]); });
  check('extraction opens after wave 5', run.state === PVE_WAVE_STATE.EXTRACT && run.wave === 5, run.state + ' ' + run.wave);
  placeActor(ids[0], 10, 0);
  runSeconds(0.25);
  check('standing in the extract zone wins the run', !Modes.active && Game.match.results.reason === 'extracted');
  endModeTest();
}));

// Parry: a green melee blow landing inside the parry window after the target's MELEE press does nothing and staggers.
Test.add('pve', (check) => {
  const dummy = startPveTest();
  const id = spawnFacing('husk', 1.2), parries = startEventLog('pve.parry');
  const hit = runUntilHit(id, dummy, 3, () => { if (Pve.phase[id] === ATTACK_PHASE.WINDUP && Pve.phaseEndsAt[id] - Sim.time < 0.1) Pve.parryAt[dummy] = Sim.time; });
  parries.stop();
  check('a parried claw deals no damage and staggers the husk', !hit && parries.length > 0 && Sim.time < Pve.staggerUntil[id] + 3, parries.length);
  Game.stop();
  const later = startPveTest({ difficulty: 'nightmare' });
  check('the parry window comes from the difficulty (nightmare 0.15 s)', Pve.skill().parry === 0.15 && later === 0);
  const brute = spawnFacing('brute', 2.5);
  check('difficulty playerDamage scales enemy hits on the party', Test.near(Pve.attackerScale(brute, 0), 2.5, 1e-6), Pve.attackerScale(brute, 0));
  check('enemyDamage scales the party hits on enemies', Test.near(Pve.attackerScale(0, brute), 1, 1e-6));
  Game.stop();
});

// Boss: phase 2 below 66%, phase 3 below 33%, invulnerable while switching; head hits drain the weak-point pool.
Test.add('pve', (check) => {
  startPveTest();
  const boss = spawnFacing('overlord', 30), events = startEventLog('pve.boss');
  const hurt = (amount, zone) => { const info = Damage.info(); info.amount = amount; info.kind = 'hit'; info.zone = zone || 'body'; info.dx = 0; info.dy = 0; info.dz = 1; return Damage.apply(0, boss, info); };
  check('the boss starts in phase 1 (slam only)', PveBoss.phase[boss] === 0 && !PveBrains.boss.allows(boss, Pve.rowOf(boss).attackRows[1], Sim.time));
  hurt(Actors.maxHealth[boss] * 0.35);
  Sim.run(1);
  check('below 66% the boss enters phase 2 (barrage allowed)', PveBoss.phase[boss] === 1 && PveBrains.boss.allows(boss, Pve.rowOf(boss).attackRows[1], Sim.time), PveBoss.phase[boss]);
  check('the phase switch is invulnerable', hurt(500) === 0 && PveBoss.inTransition(boss));
  runSeconds(BOSS_TRANSITION_SECONDS + 0.1);
  hurt(Actors.health[boss] - Actors.maxHealth[boss] * 0.3);
  Sim.run(1);
  check('below 33% the boss enters phase 3 (summons)', PveBoss.phase[boss] === 2 && PveBrains.boss.allows(boss, Pve.rowOf(boss).attackRows[2], Sim.time));
  check('each switch is announced', events.filter((event) => event.kind === 'phase').length === 2);
  runSeconds(BOSS_TRANSITION_SECONDS + 0.1);
  const before = Actors.health[boss], dealt = hurt(100, 'head');
  check('head hits on the core count double', Test.near(before - Actors.health[boss], dealt, 1e-3) && dealt >= 199, dealt);
  hurt(400, 'head');
  check('an emptied weak-point pool disables the signature attack', Sim.time < Pve.disabledUntil[boss] && !PveBrains.boss.allows(boss, Pve.rowOf(boss).attackRows[2], Sim.time));
  check('the HUD shows the boss bar', PveBoss.hud.active && PveBoss.hud.phase === 3 && PveBoss.hud.phases === 3);
  events.stop();
  const summons = startEventLog('actor.spawn');
  Pve.startAttack(boss, 2, 0, Sim.time);
  runSeconds(1.2);
  summons.stop();
  check('the summon calls husks and mites', summons.some((event) => Pve.rowOf(event.id) && Pve.rowOf(event.id).id === 'mite') && countSummons(boss) > 0);
  Game.stop();
});

// X50: rules.fx.wildlife beasts appear on reachable nodes away from players, attack, and a flash blast lures them.
Test.add('pve', (check) => {
  World.load(pveTestMap());
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true }], mutators: ['wildlife'] });
  runSeconds(6);
  const beasts = Pve.countBeasts();
  check('X50 keeps 4 beasts alive', beasts === 4, beasts);
  let beast = -1;
  for (let id = 0; id < Actors.count; id++) if (Pve.isEnemy(id) && Pve.rowOf(id).beast) beast = id;
  Bus.emit('explosion', { x: Actors.x[beast] + 5, y: 0, z: Actors.z[beast], radius: 4, owner: 0, source: 'flash', element: 'kinetic' });
  check('a flash blast lures the beasts', Sim.time < Pve.lureUntil[beast] && Test.near(Pve.lureX[beast], Actors.x[beast] + 5, 1e-3));
  killAllEnemies(0);
  runSeconds(PVE_CORPSE_SECONDS + 0.5);
  check('killed beasts wait before they return', Pve.countBeasts() === 0);
  Game.stop();
});

// M23: kills of your own side's PvE give motes, banking scores and sends blockers, 100 banked summons the boss, its kill wins.
Test.add('pve', (check) => {
  const [blue, red] = startPveMode('bank', [0, 1], { spawns: PVE_HOME.concat([{ x: 30, y: 0, z: 30, yaw: 0, team: 1 }]) });
  godMode([blue, red]);
  runSeconds(1);
  check('both sides get their fodder', Pve.hostileCount(0) > 0 && Pve.hostileCount(1) > 0, Pve.hostileCount(0) + ' ' + Pve.hostileCount(1));
  killAllEnemies(blue, (id) => Pve.side[id] === 0);
  check('kills on your side carry motes', BankRun.carried[blue] > 0, BankRun.carried[blue]);
  const carried = BankRun.carried[blue], bank = BankRun.banks[0];
  placeActor(blue, bank.x, bank.z);
  runSeconds(0.1);
  check('banking scores the team', BankRun.banked[0] === carried && BankRun.carried[blue] === 0 && Modes.teamScore[0] === carried);
  check('a 5+ deposit sends a blocker to the other side', carried < 5 || Pve.pending(1) + Pve.hostileCount(1) > PVE_BANK.fodderAlive);
  BankRun.banked[0] = Modes.rules.params.bossAt - 1;
  BankRun.carried[blue] = 3;
  runSeconds(0.1);
  const boss = BankRun.boss[0];
  check('100 banked summons the side boss at a quarter health', boss >= 0 && Pve.rowOf(boss).boss && Test.near(Actors.maxHealth[boss], 6000 * PVE_BANK.bossHealthShare, 1));
  killAllEnemies(blue, (id) => id === boss);
  runSeconds(0.1);
  check('the first boss kill wins the match', !Modes.active && Game.match.results.winnerTeam === 0, Game.match.results && Game.match.results.winnerTeam);
  endModeTest();
});

// M26: the ravager alone against two fiends; fiends summon and revive; downing both fiends wins the round.
Test.add('pve', (check) => {
  const ids = startPveMode('fiends', [0, 0, 1], { spawns: PVE_HOME.concat([{ x: 20, y: 0, z: 20, team: 1 }, { x: 22, y: 0, z: 20, team: 1 }]) });
  const ravager = ids[0], fiends = ids.slice(1);
  godMode([ravager]);
  check('one ravager on team 0, two fiends on team 1', Actors.team[ravager] === 0 && fiends.every((id) => Actors.team[id] === 1));
  runSeconds(5.2);
  check('the ravager has its own health and armour', Actors.maxHealth[ravager] === 175 && Actors.armor[ravager] === 125, Actors.maxHealth[ravager]);
  runSeconds(PVE_FIENDS.summonEvery + 0.5);
  check('fiends summon fodder that hunts the ravager', Pve.hostileCount() > 0);
  killActor(fiends[0], ravager);
  runSeconds(Modes.rules.params.reviveTime + 0.5);
  check('a fallen fiend revives while its partner lives', Actors.alive[fiends[0]] === 1);
  for (let round = 0; round < 3 && Modes.active; round++) {
    runUntil(() => Modes.phase === PHASE.LIVE, 10);
    for (const id of fiends) { Actors.health[id] = 1; hitActor(id, ravager, 50, 'hit'); }
    runSeconds(0.2);
    runUntil(() => Modes.phase !== PHASE.ROUND_END, 10);
  }
  check('three rounds won by the ravager win the match', !Modes.active && Game.match.results.winnerTeam === 0, Modes.teamRounds[0] + ' ' + Modes.phase);
  endModeTest();
});

// M29: minions on both teams; fodder 1, heavies 3, participants 5 points; the score limit ends it.
Test.add('pve', (check) => {
  const [blue, red] = startPveMode('attrition', [0, 1], { spawns: PVE_HOME.concat([{ x: 40, y: 0, z: 40, team: 1 }]) });
  runSeconds(1);
  check('each team fields its minions', Pve.hostileCount(0) > 0 && Pve.hostileCount(1) > 0);
  const before = Modes.teamScore[0];
  let fodder = -1;
  for (let id = 0; id < Actors.count; id++) if (Pve.isEnemy(id) && Pve.side[id] === 1 && !Pve.rowOf(id).heavy && Actors.alive[id]) fodder = id;
  killAllEnemies(blue, (id) => id === fodder);
  check('a fodder minion is worth 1 point', Modes.teamScore[0] === before + 1, Modes.teamScore[0] - before);
  killActor(red, blue);
  check('a player or bot kill is worth 5 points', Modes.teamScore[0] === before + 6, Modes.teamScore[0] - before);
  Modes.teamScore[0] = 299;
  killAllEnemies(blue, (id) => Pve.side[id] === 1);
  runSeconds(0.1);
  check('the score limit wins', !Modes.active && Game.match.results.winnerTeam === 0);
  endModeTest();
});

// M28: guards fill an awareness meter (slower far away), raise alarms; relic + extract wins with the stealth score.
Test.add('pve', (check) => {
  const [thief] = startPveMode('contract', [0], { spawns: PVE_HOME.concat([{ x: 0, y: 0, z: 8, yaw: 180, team: 1 }, { x: 40, y: 0, z: -40, yaw: 0, team: 1 }]),
    objectives: [{ id: 'relic', kind: 'relic', x: 20, y: 0, z: -20, radius: 1.5, modes: ['contract'] }, { id: 'exit', kind: 'extract', x: -20, y: 0, z: -20, radius: 3, modes: ['contract'] }] });
  check('stealth guards start unaware', Pve.stealth && Pve.hostileCount() === 2);
  let guard = -1;
  for (let id = 0; id < Actors.count; id++) if (Pve.isEnemy(id) && Actors.z[id] > 0 && Actors.z[id] < 10) guard = id;
  godMode([thief]);
  const alarms = startEventLog('pve.alarm');
  const hold = () => {
    placeActor(thief, 0, 2); Actors.vx[thief] = 1;
    placeActor(guard, 0, 8); BotMove.stop(guard);
    Actors.yaw[guard] = Actors.aimYaw[guard] = Bots.lookYaw[guard] = Math.PI;
  };
  hold();
  runUntil(() => Sim.time >= 0.5, 1, hold);
  const early = Pve.awareness[guard];
  runUntil(() => Pve.awareness[guard] >= 1, 4, hold);
  alarms.stop();
  check('a close guard fills its meter in about 0.6..2.5 s (not at once)', early > 0 && early < 1 && Pve.awareness[guard] >= 1, early);
  check('a full meter raises the alarm', alarms.length === 1 && ContractRun.alarms === 1);
  placeActor(thief, 20, -20);
  runSeconds(0.1);
  check('touching the relic takes it', ContractRun.holder === thief);
  placeActor(thief, -20, -20);
  runSeconds(0.1);
  check('reaching the exit with the relic wins', !Modes.active && Game.match.results.reason === PVE_WIN && Modes.score[thief] > 0, Game.match.results && Game.match.results.reason);
  check('an alarm costs the ghost bonus', Modes.score[thief] < PVE_CONTRACT.base + PVE_CONTRACT.ghostBonus, Modes.score[thief]);
  endModeTest();
});

// M30: stations from 'dummy' hints, a fire-back dummy shoots back, shots / hits / headshots counted, the drill wins.
Test.add('pve', (check) => {
  const hints = [{ kind: 'dummy', x: 0, y: 0, z: 12 }, { kind: 'dummy', x: 4, y: 0, z: 12 }, { kind: 'dummy', x: -4, y: 0, z: 12 }];
  World.load(pveTestMap({ spawns: [{ x: 0, y: 0, z: 0, yaw: 0, modes: ['range'] }], navHints: hints }));
  Game.start({ mode: 'range', seed: 1, bots: [{ dummy: true }], difficulty: 'regular' });
  const shooter = 0;
  Modes.endProtection(shooter);
  runSeconds(0.2);
  const kinds = RangeRun.stations.map((station) => station.id >= 0 ? Pve.rowOf(station.id).id : '');
  check('range stations cycle target / strafer / fire-back', kinds.join() === 'target,strafer,fireback', kinds.join());
  const fireback = RangeRun.stations[2].id;
  const hit = runUntilHit(fireback, shooter, 6);
  check('the fire-back dummy shoots back', !!hit);
  Bus.emit('weapon.fire', { id: shooter, weapon: 'tempest', weaponClass: 'rifle', mode: 'primary', x: 0, y: 1.6, z: 0, dx: 0, dy: 0, dz: 1 });
  const target = RangeRun.stations[0].id, info = Damage.info();
  info.amount = 30; info.kind = 'hit'; info.zone = 'head'; info.dx = 0; info.dy = 0; info.dz = 1;
  Damage.apply(shooter, target, info);
  check('shots, hits and headshots are counted', RangeRun.shots >= 1 && RangeRun.hits === 1 && RangeRun.headshots === 1 && RangeRun.damage > 0, RangeRun.shots + ' ' + RangeRun.hits);
  runUntil(() => !Modes.active, 120, () => { Actors.health[shooter] = Actors.maxHealth[shooter]; killAllEnemies(shooter); });
  check('the drill ends after 10 kills with a score', !Modes.active && Game.match.results.reason === 'drill' && RangeRun.kills >= PVE_RANGE.drillTargets && Modes.score[shooter] > 0, Modes.active + ' ' + RangeRun.kills + ' ' + (Game.match.results && Game.match.results.reason) + ' ' + Modes.score[shooter]);
  endModeTest();
});

// MP11: every chamber solved by a scripted run (button presses, cube carries, relay shots) earns gold with par from data.
Test.add('pve', (check) => {
  World.load(Maps.get('chambers'));
  Game.start({ mode: 'puzzle', seed: 1, bots: [{ dummy: true }] });
  const id = 0, medals = startEventLog('pve.chamber');
  Modes.endProtection(id);
  const failures = [];
  for (let index = 0; index < PVE_CHAMBERS.length && Modes.active; index++) {
    if (!solveChamber(id, PVE_CHAMBERS[index])) failures.push(PVE_CHAMBERS[index].id + (chamberSolved() ? ' exit' : ' lock'));
  }
  medals.stop();
  const golds = medals.filter((event) => event.kind === 'complete' && event.medal === 'gold').length;
  check('every chamber is solvable with gold by a scripted run', failures.length === 0 && golds === PVE_CHAMBERS.length, failures.join() + ' golds ' + golds);
  check('the twelfth exit wins with 36 stars', !Modes.active && Game.match.results.reason === PVE_WIN && ChamberRun.stars === 36, ChamberRun.stars);
  check('medal tiers come from the par data', chamberMedal(PVE_CHAMBERS[0], 1, 1, 0) === 0 && chamberMedal(PVE_CHAMBERS[0], 20, 1, 0) === 2 && chamberMedal(PVE_CHAMBERS[0], 99, 1, 0) === -1);
  endModeTest();
});
// Presses USE at buttons, carries the cube onto its plate, shoots relays, then walks onto the exit; true when the chamber completed.
function solveChamber(id, row) {
  const start = ChamberRun.index;
  for (const element of row.elements) {
    chamberElementAt(element, pveSpot);
    if (element.kind === 'button') useAt(id, pveSpot.x, pveSpot.y, pveSpot.z);
    else if (element.kind === 'cube') useAt(id, pveSpot.x, pveSpot.y, pveSpot.z);
    else if (element.kind === 'plate') { teleportActor(id, pveSpot.x, pveSpot.y, pveSpot.z - PVE_CHAMBER_RULES.carryAhead, 0); pressUse(id); }
    else if (element.kind === 'relay') shootAt(id, pveSpot);
  }
  const exit = ChamberRun.exits[start];
  teleportActor(id, exit.x, exit.y, exit.z, 0);
  Sim.run(2);
  return ChamberRun.index !== start || !Modes.active;
}
function useAt(id, x, y, z) { teleportActor(id, x, y, z - 0.5, 0); pressUse(id); }
function pressUse(id) {
  Actors.buttons[id] = BTN.USE;
  Sim.run(1);
  Actors.buttons[id] = 0;
  Sim.run(1);
}
// Shoots the relay from 5 m toward the room centre.
function shootAt(id, point) {
  const towardX = ChamberRun.centreX - point.x, towardZ = ChamberRun.centreZ - point.z, flat = Math.hypot(towardX, towardZ) || 1;
  const x = point.x + towardX / flat * 5, z = point.z + towardZ / flat * 5, y = 1.6;
  const dx = point.x - x, dy = point.y - y, dz = point.z - z, length = Math.hypot(dx, dy, dz);
  teleportActor(id, x, 0, z, 0);
  Bus.emit('weapon.fire', { id, weapon: 'tempest', weaponClass: 'rifle', mode: 'primary', x, y, z, dx: dx / length, dy: dy / length, dz: dz / length });
}
