// Self-tests: PvE enemies, director, PvE modes and the boss (S14 14h..14k, group 'pve').

const PVE_TEST_TELL_SLACK = 2 * TICK_SECONDS;

// ARC-040 __CTK.pve: the PvE layers, and a showcase that lines every enemy row up in front of the player (visual checks).
DebugApi.pve = {
  pve: Pve, boss: PveBoss, hud: PVE_HUD,
  showcase(map) {
    World.load(map ? Maps.get(map) : pveTestMap());
    Game.start({ mode: 'ffa', seed: 1, player: { name: 'Viewer' }, bots: [] });
    const player = Game.playerId;
    Actors.flags[player] |= ACTOR_FLAG.GOD;
    CAT.enemies.forEach((row, index) => {
      const id = Pve.spawnEnemy(row, (index - CAT.enemies.length / 2) * 2.6, 0, 12, Math.PI, { team: NO_TEAM });
      if (id >= 0 && row.attackRows.length) Pve.startAttack(id, 0, player, Sim.time);   // show the tells
    });
    return Pve.aliveCount();
  },
  // The walked route of every MP11 chamber against its par: 'id seconds/gold-silver-bronze s steps/gold-silver-bronze'.
  chamberRoutes() {
    World.load(Maps.get('chambers'));
    Game.start({ mode: 'puzzle', seed: 1, bots: [{ dummy: true }] });
    const lines = PVE_CHAMBERS.map((row, index) => {
      const route = chamberRoute(index);
      return row.id + ' ' + route.seconds.toFixed(1) + '/' + row.par.time.join('-') + ' s ' + route.steps + '/' + row.par.steps.join('-') + ' ' + route.missing.join();
    });
    Game.stop();
    return lines;
  },
};
// Distance each attacking archetype starts from its dummy target (inside one of its attack ranges, outside keepRange[0]).
const PVE_TEST_START = { husk: 1.2, gunner: 12, brute: 2.5, phalanx: 1.8, stalker: 1.4, longeye: 20, mite: 1, bomber: 1.5, charger: 10,
  turret: 10, leaper: 7, overlord: 3, beast: 1.6, fireback: 10 };

function pveTestMap(extra) {
  return Object.assign({ id: 'pve-test', brushes: [TEST_FLOOR], spawns: [{ x: 0, y: 0, z: 0, yaw: 0 }], objectives: [], items: [] }, extra);
}

// One practice dummy (id 0) at the origin (map: extra pveTestMap fields); returns it.
function startPveTest(setup, map) {
  World.load(pveTestMap(map));
  Game.start(Object.assign({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: 0 }], difficulty: 'regular' }, setup));
  Modes.endProtection(0);   // spawn protection would swallow the first hits
  return 0;
}

// Spawns `key` at distance metres in front of the dummy (+z), facing it.
function spawnFacing(key, distance) {
  return Pve.spawnEnemy(key, 0, 0, distance, Math.PI);
}

// Lethal hits from killer (default the dummy 0); a boss takes one per phase, waiting out each phase transition.
function killEnemy(id, killer) {
  const source = killer === undefined ? 0 : killer;
  for (let blow = 0; blow < 4 && Actors.alive[id]; blow++) {
    const info = Damage.info();
    info.amount = Actors.health[id] + Actors.shield[id] + Actors.armor[id] + 1; info.kind = 'hit'; info.dx = 0; info.dy = 0; info.dz = -1;
    Damage.apply(source, id, info);
    if (Actors.alive[id] && Pve.rowOf(id).boss) runSeconds(BOSS_TRANSITION_SECONDS + 0.1);
  }
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
  startPveTest();
  const a = Pve.spawnEnemy('husk', 5, 0, 5, 0, { team: NO_TEAM }), b = Pve.spawnEnemy('gunner', 6, 0, 5, 0, { team: NO_TEAM });
  const hunter = Pve.spawnEnemy('husk', 7, 0, 5, 0, { team: NO_TEAM, side: 1, huntTeam: 0 });
  check('enemies of one side never pick each other', !Pve.isFoe(a, b) && !Pve.isFoe(b, a) && Pve.isFoe(a, 0));
  check('a hunter ignores other sides and other teams', !Pve.isFoe(hunter, a) && Pve.isFoe(hunter, 0) === (Actors.team[0] === 0));
  Game.stop();
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
function hitEnemy(source, target, amount, kind, zone) {
  const info = Damage.info();
  info.amount = amount; info.kind = kind; info.zone = zone; info.dx = 0; info.dy = 0; info.dz = 1;
  return Damage.apply(source, target, info);
}
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
  const cleared = waves.filter((event) => event.phase === 'end').length, results = Game.match.results;
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
  const hit = runUntilHit(id, dummy, 3, () => {
    Actors.yaw[dummy] = Math.atan2(Actors.x[id] - Actors.x[dummy], Actors.z[id] - Actors.z[dummy]);   // the target faces the claw (a parry needs the front arc)
    if (Pve.phase[id] === ATTACK_PHASE.WINDUP && Pve.phaseEndsAt[id] - Sim.time < 0.1) Pve.parryAt[dummy] = Sim.time;
  });
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

// AUD-006: a boss fight plays the boss music layer from the boss spawn until its defeat or the match end; the defeat reports the fight time.
Test.add('pve', (check) => {
  startPveTest();
  const weights = { calm: 0, combat: 0, boss: 0 }, events = startEventLog('pve.boss');
  const boss = spawnFacing('overlord', 30);
  check('a boss spawn brings the boss music layer in', SoundMusic.targetWeights(weights).boss === 1, SoundMusic.bosses);
  runSeconds(1);
  killEnemy(boss);
  events.stop();
  const defeated = events.find((event) => event.kind === 'defeated');
  check('the boss defeat takes it out again', SoundMusic.targetWeights(weights).boss === 0, SoundMusic.bosses);
  check('the defeat reports the fight time to the career log', !!defeated && defeated.seconds > 1 && RunLog.bossSeconds === defeated.seconds && RunLog.finalBossSeconds === (defeated.final ? defeated.seconds : PROGRESS_NEVER),
    RunLog.bossSeconds);
  spawnFacing('overlord', 30);
  Pve.clearEnemies();   // a failed wave 10 or a round clear removes the living boss without a kill
  check('a boss removed without a kill takes the boss layer out', SoundMusic.targetWeights(weights).boss === 0 && SoundMusic.bosses === 0, SoundMusic.bosses);
  spawnFacing('overlord', 30);
  check('the retry counts one boss fight', SoundMusic.bosses === 1, SoundMusic.bosses);
  Game.stop();
  check('the match end stops the boss layer', SoundMusic.bosses === 0);
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
  killEnemy(boss, blue);
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

// M30: stations from 'dummy' hints, a fire-back dummy shoots back, shots / hits / headshots counted once per shot, drills repeat.
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
  const target = RangeRun.stations[0].id, shotsBefore = RangeRun.shots;
  Bus.emit('weapon.fire', { id: shooter, weapon: 'tempest', weaponClass: 'rifle', mode: 'primary', x: 0, y: 1.6, z: 0, dx: 0, dy: 0, dz: 1 });
  hitEnemy(shooter, target, 30, 'hit', 'head');
  check('shots, hits and headshots are counted', RangeRun.shots === shotsBefore + 1 && RangeRun.hits === 1 && RangeRun.headshots === 1 && RangeRun.damage > 0, RangeRun.shots + ' ' + RangeRun.hits);
  Bus.emit('weapon.fire', { id: shooter, weapon: 'scattergun', weaponClass: 'shotgun', mode: 'primary', x: 0, y: 1.6, z: 0, dx: 0, dy: 0, dz: 1 });
  for (let pellet = 0; pellet < 6; pellet++) hitEnemy(shooter, target, 2, 'hit', 'body');
  hitEnemy(shooter, target, 2, 'splash', 'body');
  hitEnemy(shooter, target, 2, 'dot', 'body');
  check('six pellets, a splash and a burn of one shot count one hit', RangeRun.hits === 2 && RangeRun.shots === shotsBefore + 2, RangeRun.hits + ' / ' + RangeRun.shots);
  runSeconds(0.05);
  check('accuracy never passes 100%', PVE_HUD.accuracy > 0 && PVE_HUD.accuracy <= 1, PVE_HUD.accuracy);
  runUntil(() => RangeRun.drills >= 2, 120, () => { Actors.health[shooter] = Actors.maxHealth[shooter]; killAllEnemies(shooter); });
  check('every 10 kills completes a drill with a score, and the range goes on', Modes.active && RangeRun.drills >= 2 && RangeRun.drillBest > 0 && Modes.score[shooter] > 0,
    Modes.active + ' ' + RangeRun.drills + ' ' + RangeRun.kills + ' ' + Modes.score[shooter]);
  check('the drill counter restarts after a drill', RangeRun.drillKills < PVE_RANGE.drillTargets, RangeRun.drillKills);
  endModeTest();
});

// MP11: every exit, button, plate, cube and relay firing spot is reachable on the nav graph (pads, ladders, teleporters) from
// its chamber spawn; the walked route fits the par from data; a scripted run then unlocks and completes every chamber.
Test.add('pve', (check) => {
  World.load(Maps.get('chambers'));
  Game.start({ mode: 'puzzle', seed: 1, bots: [{ dummy: true }] });
  const id = 0, medals = startEventLog('pve.chamber');
  Modes.endProtection(id);
  const routes = PVE_CHAMBERS.map((row, index) => chamberRoute(index));
  const missing = routes.flatMap((route) => route.missing);
  check('every exit, button, cube, plate and relay firing spot is reachable from its chamber spawn', missing.length === 0, missing.join());
  // Gold time leaves room for turns and USE presses; footsteps on foot fit silver (chamber 11's gold needs the twin-gate shortcut).
  const overPar = [];
  PVE_CHAMBERS.forEach((row, index) => {
    const route = routes[index];
    if (route.seconds > row.par.time[0] || route.steps > row.par.steps[1]) overPar.push(row.id + ' ' + route.seconds.toFixed(1) + ' s ' + route.steps + ' steps');
  });
  check('every walked route fits the gold time and silver footstep par from data', overPar.length === 0, overPar.join(', '));
  const failures = [];
  for (let index = 0; index < PVE_CHAMBERS.length && Modes.active; index++) {
    if (!solveChamber(id, PVE_CHAMBERS[index])) failures.push(PVE_CHAMBERS[index].id + (chamberSolved() ? ' exit' : ' lock'));
  }
  medals.stop();
  const completed = medals.filter((event) => event.kind === 'complete').length;
  check('a scripted run unlocks and completes every chamber', failures.length === 0 && completed === PVE_CHAMBERS.length, failures.join() + ' completed ' + completed);
  check('the twelfth exit wins', !Modes.active && Game.match.results.reason === PVE_WIN);
  check('medal tiers come from the par data', chamberMedal(PVE_CHAMBERS[0], 1, 1, 0) === 0 && chamberMedal(PVE_CHAMBERS[0], 20, 1, 0) === 2 && chamberMedal(PVE_CHAMBERS[0], 99, 1, 0) === -1);
  endModeTest();
});
// The walked route of a chamber over the nav graph: spawn, then each button, cube, plate and relay firing spot in order,
// then the exit. seconds = nav travel time, steps = walked metres / stride; missing = legs without a route.
function chamberRoute(index) {
  const row = PVE_CHAMBERS[index], spawn = Modes.spawnPoints[index], route = { seconds: 0, metres: 0, steps: 0, missing: [] };
  const zone = World.map.zones.find((entry) => entry.name === row.zone);
  const centreX = (zone.min[0] + zone.max[0]) / 2, centreZ = (zone.min[2] + zone.max[2]) / 2;
  let at = Nav.nearestNode(spawn.x, spawn.y, spawn.z);
  for (const element of row.elements) {
    if (element.kind === 'fizzle') continue;
    const x = centreX + element.at[0], y = element.at[1], z = centreZ + element.at[2];
    const goal = element.kind === 'relay' ? relaySpot(at, zone, x, y, z) : nodeNear(x, y, z);
    at = walkLeg(route, at, goal, row.id + '.' + element.kind);
  }
  const exit = World.map.objectives.find((objective) => objective.id === 'exit' + (index + 1));
  walkLeg(route, at, exit ? nodeNear(exit.x, exit.y, exit.z) : -1, row.id + '.exit');
  route.steps = Math.ceil(route.metres / STRIDE_METRES);
  return route;
}
const CHAMBER_NODE_REACH = 2;            // m: an element counts as on the graph when a node lies this close
function nodeNear(x, y, z) {
  const node = Nav.nearestNode(x, y, z);
  return node >= 0 && Math.hypot(Nav.nodeX[node] - x, Nav.nodeZ[node] - z) <= CHAMBER_NODE_REACH ? node : -1;
}
// Adds the path from -> to (nav travel seconds, metres on foot); returns where the route now stands.
function walkLeg(route, from, to, label) {
  if (to < 0 || !Nav.reachable(from, to) || Nav.findPath(from, to) === 0) { route.missing.push(label); return from; }
  route.seconds += Nav.pathCost;
  for (let k = 0; k + 1 < Nav.pathLength; k++) {
    const type = Nav.pathTypes[k], a = Nav.pathNodes[k], b = Nav.pathNodes[k + 1];
    if (type === NAV_LINK.WALK || type === NAV_LINK.CROUCH) route.metres += Math.hypot(Nav.nodeX[b] - Nav.nodeX[a], Nav.nodeZ[b] - Nav.nodeZ[a]);
  }
  return to;
}
// The reachable node of the chamber nearest to `from` with a clear shot (eye height) at the relay within relay range.
function relaySpot(from, zone, x, y, z) {
  let best = -1, bestDistance = Infinity;
  for (let node = 0; node < Nav.nodeCount; node++) {
    const nx = Nav.nodeX[node], ny = Nav.nodeY[node], nz = Nav.nodeZ[node];
    if (nx < zone.min[0] || nx > zone.max[0] || nz < zone.min[2] || nz > zone.max[2] || !Nav.reachable(from, node)) continue;
    if (Math.hypot(x - nx, y - ny - SPAWN_EYE_HEIGHT, z - nz) > PVE_CHAMBER_RULES.relayRange || !World.lineClear(nx, ny + SPAWN_EYE_HEIGHT, nz, x, y, z)) continue;
    const distance = Math.hypot(nx - Nav.nodeX[from], nz - Nav.nodeZ[from]);
    if (distance < bestDistance) { bestDistance = distance; best = node; }
  }
  return best;
}
// Presses USE at buttons, carries the cube onto its plate, shoots relays, then walks onto the exit; true when the chamber completed.
function solveChamber(id, row) {
  const start = ChamberRun.index;
  for (const element of row.elements) {
    chamberElementAt(element, pveSpot);
    if (element.kind === 'button') useAt(id, pveSpot.x, pveSpot.y, pveSpot.z);
    else if (element.kind === 'cube') useAt(id, pveSpot.x, pveSpot.y, pveSpot.z);
    else if (element.kind === 'plate') { relocateActor(id, pveSpot.x, pveSpot.y, pveSpot.z - PVE_CHAMBER_RULES.carryAhead, 0); pressUse(id); }
    else if (element.kind === 'relay') shootAt(id, pveSpot);
  }
  const exit = ChamberRun.exits[start];
  relocateActor(id, exit.x, exit.y, exit.z, 0);
  Sim.run(2);
  return ChamberRun.index !== start || !Modes.active;
}
function useAt(id, x, y, z) { relocateActor(id, x, y, z - 0.5, 0); pressUse(id); }
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
  relocateActor(id, x, 0, z, 0);
  Bus.emit('weapon.fire', { id, weapon: 'tempest', weaponClass: 'rifle', mode: 'primary', x, y, z, dx: dx / length, dy: dy / length, dz: dz / length });
}

// ---- Review fixes: game speed, readability, hit volumes, parries, champions, chambers, director ----
// Errors logged since a mark (ErrorLog keeps the last 50 entries).
function errorMark() { return { length: ErrorLog.entries.length, last: ErrorLog.entries[ErrorLog.entries.length - 1] }; }
function errorsSince(mark) {
  const entries = ErrorLog.entries;
  if (entries.length !== mark.length || entries[entries.length - 1] !== mark.last) return entries.slice(Math.min(mark.length, entries.length - 1));
  return [];
}
// A fake batch recording the meshes drawn (shape, height and colour of each).
function meshRecorder() {
  const meshes = [];
  return { meshes, mesh(shape, x, y, z, yaw, pitch, sx, sy, sz, r, g, b) { meshes.push({ shape, y, sz, r, g, b }); },
    meshFrom(shape, instance) { meshes.push({ shape, y: instance.y, sz: instance.sz, r: instance.r, g: instance.g, b: instance.b }); } };
}
function colorMatches(mesh, hex) {
  return Math.abs(mesh.r - ((hex >> 16) & 255) / 255) < 0.01 && Math.abs(mesh.g - ((hex >> 8) & 255) / 255) < 0.01 && Math.abs(mesh.b - (hex & 255) / 255) < 0.01;
}

// DIF-002 game speed reaches the sim through the ruleset (no write into the frozen rules), in PvE and versus alike (ACC-007).
Test.add('pve', (check) => withShortShop(() => {
  const mark = errorMark();
  const ids = startPveMode('horde', [0], {}, { difficulty: { preset: 'regular', gameSpeed: 0.8 } });
  check('a custom game speed 0.8 starts horde cleanly', !!Modes.behaviour.run && Pve.core.active && errorsSince(mark).length === 0, errorsSince(mark).join(' / '));
  check('the PvE game speed sets the sim time scale', Test.near(Sim.timeScale, 0.8, 1e-6) && Test.near(Game.match.rules.fx.timeScale, 0.8, 1e-6), Sim.timeScale);
  runSeconds(2);
  check('the horde step runs without errors at 0.8 speed', errorsSince(mark).length === 0 && Modes.active && ids.length === 1, errorsSince(mark).join(' / '));
  endModeTest();
  World.load(pveTestMap());
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true }], difficulty: { preset: 'regular', gameSpeed: 0.8 } });
  check('versus modes use the same assist speed (ACC-007)', Test.near(Sim.timeScale, 0.8, 1e-6), Sim.timeScale);
  Game.stop();
}));

// NPC-002: the stalker shows for its whole attack (tell, blow, recovery) and its tell is drawn.
Test.add('pve', (check) => {
  const dummy = startPveTest();
  const id = spawnFacing('stalker', 1.4);
  check('a stalker spawns cloaked', (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) !== 0);
  let windupVisible = true, sawWindup = false, drawnInWindup = false;
  runUntilHit(id, dummy, 4, () => {
    if (Pve.phase[id] !== ATTACK_PHASE.WINDUP || Sim.time <= Pve.tellStart[id]) return;
    sawWindup = true;
    if (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) windupVisible = false;
    const batch = meshRecorder();
    Pve.draw(batch);
    if (batch.meshes.some((mesh) => colorMatches(mesh, PVE_TELL_COLORS.parry))) drawnInWindup = true;
  });
  check('the stalker is visible during its whole wind-up', sawWindup && windupVisible);
  check('its green tell is drawn during the wind-up', drawnInWindup);
  Pve.revealedUntil[id] = 0;
  BLINK.readyAt[id] = 1e9;
  Pve.cooldown.fill(1e9, id * PVE_MAX_ATTACKS, (id + 1) * PVE_MAX_ATTACKS);
  runUntil(() => Pve.phase[id] === ATTACK_PHASE.IDLE, 3);
  Sim.run(1);
  check('after the attack it cloaks again', (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) !== 0);
  // R-204: a half-strength tell blends every channel of a plain part toward the tell colour, not only red
  Actors.flags[id] &= ~ACTOR_FLAG.INVISIBLE;
  Actors.health[id] = Actors.maxHealth[id];
  const tellGlow = Pve.tellGlow, row = Pve.rowOf(id), half = { amount: 0.5, progress: 0.5, r: 0, g: 1, b: 0 };
  const plain = row.parts.findIndex((part) => (PART_TINTS[part[7]] || 0) < PART_TINTS.glow), tint = PART_TINTS[row.parts[plain][7]] || 0;
  const blended = meshRecorder();
  Pve.tellGlow = () => half;
  try { Pve.drawEnemy(blended, id); } finally { Pve.tellGlow = tellGlow; }
  const part = blended.meshes[plain], drawn = [part.r, part.g, part.b], expected = [0, 1, 0].map((tell, channel) => lerp(row.colors[tint * 3 + channel], tell, 0.5));
  check('a half tell blends red, green and blue of a plain part', drawn.every((value, channel) => Test.near(value, expected[channel], 1e-4)), drawn + ' vs ' + expected);
  Game.stop();
});

// Clear hit boxes: weak points lie inside an S08 hit volume (the boss core in the head sphere), the silhouette on the volumes.
const PVE_PART_SLACK = 0.5;              // m at size 1: arms, weapons, horns and eyes may stand this far off a hit volume
const PVE_BODY_OVERHANG = 0.3;           // m at size 1: a 'body' part may reach this far past the torso radius
function partOffVolumes(row, part) {
  const x = part[1], y = part[2], z = part[3], flat = Math.hypot(x, z);
  const head = Math.max(0, Math.hypot(x, y - (STANCE_EYE[0] + HEAD_ABOVE_EYE), z) - HEAD_RADIUS * row.headScale);
  const cylinder = (low, high, radius) => Math.hypot(y < low ? low - y : y > high ? y - high : 0, Math.max(0, flat - radius));
  return Math.min(head, cylinder(TORSO_LOW, TORSO_HIGH, TORSO_RADIUS), cylinder(LEGS_LOW, LEGS_HIGH, LEGS_RADIUS));
}
Test.add('pve', (check) => {
  const loose = [], fat = [];
  for (const row of CAT.enemies) {
    for (const part of row.parts) {
      const off = partOffVolumes(row, part), limit = part[7] === 'weak' || part[7] === 'body' ? 0 : PVE_PART_SLACK;
      if (off > limit + 1e-6) loose.push(row.id + '.' + part[7] + ' ' + off.toFixed(2));
      if (part[7] === 'body' && Math.max(part[4], part[6]) / 2 > TORSO_RADIUS + PVE_BODY_OVERHANG + 1e-6) fat.push(row.id);
    }
  }
  check('weak and body part centres lie inside a hit volume, the rest within 0.5 m', loose.length === 0, loose.join(', '));
  check('no body part sticks out far past the torso volume', fat.length === 0, fat.join());
  startPveTest();
  const missed = [];
  for (const row of CAT.enemies) {
    const id = Pve.spawnEnemy(row, 0, 0, 30, 0, { team: NO_TEAM });
    for (const part of row.parts) if (part[7] === 'weak' && !rayHitsPart(id, row, part, row.weakPoint && row.weakPoint.kind === 'core')) missed.push(row.id);
    Actors.remove(id);
  }
  check('a shot at each glowing weak part hits its volume (the boss core: the head)', missed.length === 0, missed.join());
  const overlord = CAT.enemies.byId('overlord');
  check('the overlord has a glowing weak head', overlord.parts.some((part) => part[7] === 'weak' && partOffVolumes(overlord, part) === 0));
  Game.stop();
});
// A ray from 5 m outside (beside the part, away from the body axis) toward the part centre enters a volume by the centre.
function rayHitsPart(id, row, part, wantHead) {
  const size = row.size, x = Actors.x[id] + part[1] * size, y = Actors.y[id] + part[2] * size, z = Actors.z[id] + part[3] * size;
  const flat = Math.hypot(part[1], part[3]);
  const dirX = flat > 0.05 ? -part[1] / flat : 0, dirZ = flat > 0.05 ? -part[3] / flat : -1;
  const distance = Hitbox.ray(id, x - dirX * 5, y, z - dirZ * 5, dirX, 0, dirZ, 10, 0);
  return distance >= 0 && distance <= 5 + 1e-3 && (!wantHead || Hitbox.zone === ZONE.HEAD);
}

// The green barrage is parried by MELEE / ALT inside the difficulty window with any weapon: the bolts fly back.
function fireBarrage(parry) {
  const dummy = startPveTest();
  const boss = spawnFacing('overlord', 14), hits = startEventLog('damage'), parries = startEventLog('pve.parry');
  Pve.startAttack(boss, Pve.rowOf(boss).attackRows.findIndex((attack) => attack.id === 'barrage'), dummy, Sim.time);
  let reflected = 0;
  for (let tick = 0; tick < 3 * TICK_RATE; tick++) {
    if (parry) Pve.parryAt[dummy] = Sim.time;
    Actors.health[dummy] = Actors.maxHealth[dummy];
    for (let i = 0; i < PROJECTILE_CAP; i++) if (Projectiles.state[i] && Projectiles.owner[i] === dummy) reflected++;
    Sim.run(1);
  }
  hits.stop();
  parries.stop();
  const result = { hurt: hits.filter((event) => event.source === boss && event.target === dummy && event.amount > 0).length, parries: parries.length, reflected };
  Game.stop();
  return result;
}
Test.add('pve', (check) => {
  const open = fireBarrage(false), parried = fireBarrage(true);
  check('an unparried barrage hits the dummy', open.hurt > 0 && open.parries === 0, JSON.stringify(open));
  check('MELEE inside the parry window reflects the barrage bolts', parried.hurt === 0 && parried.parries > 0 && parried.reflected > 0, JSON.stringify(parried));
});

// NPC-004: unstoppable ignores damage staggers and knockback (parries still stagger); champion ring and element shell drawn.
Test.add('pve', (check) => {
  startPveTest();
  const tough = Pve.spawnEnemy('brute', 0, 0, 10, Math.PI, { champion: championIndex('unstoppable') });
  const plain = Pve.spawnEnemy('brute', 6, 0, 10, Math.PI);
  hitEnemy(0, tough, Actors.maxHealth[tough] * 0.3, 'hit', 'body');
  hitEnemy(0, plain, Actors.maxHealth[plain] * 0.3, 'hit', 'body');
  Sim.run(2);
  check('a big hit staggers a brute but not an unstoppable one', Sim.time < Pve.staggerUntil[plain] && Sim.time >= Pve.staggerUntil[tough], Pve.staggerUntil[tough]);
  const pushed = Math.hypot(Actors.vx[plain], Actors.vz[plain]), held = Math.hypot(Actors.vx[tough], Actors.vz[tough]);
  check('damage pushes a brute but not an unstoppable one (it only walks)', pushed > 3 && held < 1, pushed + ' ' + held);
  Pve.stagger(tough, PVE_DIRECTOR.staggerSeconds, STAGGER_CAUSE.PARRY);
  check('a parry still staggers the unstoppable champion', Sim.time < Pve.staggerUntil[tough]);
  const chance = PVE_CHAMPION_RULES.shieldElementChance;
  PVE_CHAMPION_RULES.shieldElementChance = 1;
  const shielded = Pve.spawnEnemy('gunner', -6, 0, 10, Math.PI, { champion: championIndex('barrier') });
  PVE_CHAMPION_RULES.shieldElementChance = chance;
  const element = CAT.elements[Damage.shieldElement[shielded] - 1];
  check('a barrier champion can carry an element shield (x1.5 for its element)', !!element && Actors.shield[shielded] > 0 && shieldElementFactor(shielded, element.id) === ELEMENT_MATCH_FACTOR,
    Damage.shieldElement[shielded]);
  const batch = meshRecorder();
  Pve.draw(batch);
  const rings = batch.meshes.filter((mesh) => mesh.shape === 'ring');
  const tagged = (key) => rings.some((mesh) => colorMatches(mesh, PVE_CHAMPIONS[championIndex(key)].glow));
  check('champions stand on a ring in their tag colour', tagged('unstoppable') && tagged('barrier'));
  check('a coloured shield is drawn in its element colour', !!element && rings.filter((mesh) => colorMatches(mesh, element.color)).length === PVE_SHELL_HEIGHTS.length);
  Game.stop();
});

const PVE_PROBE_LASER_LENGTH = 10;   // m: a box longer than any enemy part is the laser tell (the sniper stands ~24 m away)
// PERF-006: drawing enemies with their champion ring, element shield, awareness mark, heal beam and laser tell allocates
// nothing per frame.
Test.add('pve', (check) => {
  if (!perfHeapCounterWorks()) { check.skip('PvE drawing allocation probe', 'no exact heap counter on this page'); return; }
  World.load(Maps.get('isle'));   // a full nav build first, as in a match (its builder literal once boxed the record's x, y, z)
  startPveTest();
  const chance = PVE_CHAMPION_RULES.shieldElementChance;
  PVE_CHAMPION_RULES.shieldElementChance = 1;
  const shielded = Pve.spawnEnemy('gunner', -6, 0, 10, Math.PI, { champion: championIndex('barrier') });
  PVE_CHAMPION_RULES.shieldElementChance = chance;
  ['husk', 'leaper', 'brute'].forEach((key, index) => Pve.spawnEnemy(key, index * 3, 0, 14, Math.PI));
  const healer = Pve.spawnEnemy('warden', 6, 0, 20, Math.PI), healed = Pve.spawnEnemy('husk', 8, 0, 20, Math.PI);
  Actors.health[healed] = Actors.maxHealth[healed] / 2;   // hurt inside the warden's radius: a heal beam per frame
  const sniper = Pve.spawnEnemy('longeye', -8, 0, 24, Math.PI);   // held in its laser windup: the laser tell per frame
  Pve.phase[sniper] = ATTACK_PHASE.WINDUP; Pve.attack[sniper] = 0; Pve.tellStart[sniper] = Sim.time; Pve.phaseEndsAt[sniper] = Sim.time + 1;
  Pve.aimX[sniper] = Actors.x[0]; Pve.aimY[sniper] = Actors.eyeY(0); Pve.aimZ[sniper] = Actors.z[0];
  Pve.stealth = true;
  const recorder = meshRecorder();   // two batch kinds, as over a session (tests, killcam): the draw calls are not inlined
  let calls = 0, recorded = 0;   // counted here: run(i) restarts i in every measured round, and the recorder allocates its records
  const bytes = perfAllocatedBytes(() => {
    if (calls++ < PERF_ALLOC_WARMUP_CALLS / 2) { recorder.meshes.length = 0; Pve.draw(recorder); recorded++; return; }
    fillSources();   // the frame's own path: each render source runs its own compiled code, as in a match
  });
  check('the probe draws into the allocating recorder in the warmup only', recorded === PERF_ALLOC_WARMUP_CALLS / 2, recorded);
  check('the probe draws a shielded champion', Actors.shield[shielded] > 0 && Pve.champion[shielded] >= 0);
  recorder.meshes.length = 0;
  Pve.draw(recorder);
  const colors = Pve.rowOf(healer).colors, slot = HEAL_BEAM_SLOT * 3, longest = PVE_PROBE_LASER_LENGTH;
  const beams = recorder.meshes.filter((mesh) => mesh.shape === 'box' && mesh.r === colors[slot] && mesh.g === colors[slot + 1]).length;
  const lasers = recorder.meshes.filter((mesh) => mesh.shape === 'box' && mesh.sz > longest && colorMatches(mesh, PVE_TELL_COLORS.unblockable)).length;
  check('the probe draws a heal beam and a laser tell', beams === 1 && lasers === 1, beams + ' beams, ' + lasers + ' lasers');
  check('drawing PvE enemies allocates nothing once the hot loop is fully compiled', bytes < PERF_ALLOC_LIMIT_BYTES, Math.round(bytes / 1024) + ' KB over ' + PERF_ALLOC_CALLS + ' frames');
  propBatch.clear();
  Game.stop();
});

// PERF-006 regression guard for the probe above: its hot loop reaches the top compiler tier, which inlines the draw calls, so
// it cannot see float arguments. A live frame runs these hooks in the middle tier, which boxes each one (horde Potato:
// 616 B per frame with the old heal beam and laser calls, 16 B now). So the hooks are checked by their source.
Test.add('pve', (check) => {
  const hooks = [Pve.drawEnemy, PveBrains.support.draw, PveAttacks.laser.drawTell, drawHealBeam, drawAwareness, drawChampionRing, drawShieldShell];
  check('the PvE draw hooks draw through the instance record (no batch.mesh with float arguments)', hooks.every((hook) => !/\.mesh\(/.test(String(hook))));
  const enemy = String(Pve.drawEnemy);
  check('brain.draw and drawTell get no float argument (the tell progress is read from pveTellGlow)',
    enemy.includes('brain.draw(batch, id, row);') && enemy.includes('.drawTell(batch, id, attack);') && PveAttacks.laser.drawTell.length === 2);
  check('the heal beam reads the two actor ids, not six coordinates', drawHealBeam.length === 4);
});

// Boss phases cannot be skipped: one huge hit stops at the threshold; a frozen boss still switches phase.
Test.add('pve', (check) => {
  startPveTest();
  const boss = spawnFacing('overlord', 30), row = Pve.rowOf(boss);
  hitEnemy(0, boss, Actors.maxHealth[boss] * 0.9, 'hit', 'body');
  check('one huge hit stops at the 66% threshold', Test.near(Actors.health[boss], Actors.maxHealth[boss] * row.phases[0].until, 1e-3), Actors.health[boss]);
  Sim.run(1);
  check('and the boss enters phase 2, not 3', PveBoss.phase[boss] === 1);
  runSeconds(BOSS_TRANSITION_SECONDS + 0.1);
  Actors.flags[boss] |= ACTOR_FLAG.FROZEN;
  hitEnemy(0, boss, Actors.maxHealth[boss], 'hit', 'body');
  Sim.run(1);
  check('a frozen boss still switches phase at the threshold', PveBoss.phase[boss] === 2 && Actors.alive[boss] === 1, PveBoss.phase[boss]);
  Game.stop();
});

// Director: a queue entry stays queued when no actor slot is free; summoned swarms come as a whole group.
Test.add('pve', (check) => {
  startPveTest();
  const spawnEnemy = Pve.spawnEnemy;
  Pve.spawnPoints.push({ x: 30, y: 0, z: 30, yaw: 0, side: NO_TEAM });
  Pve.enqueue('husk', NO_TEAM, 1, -1, 1);
  try { Pve.spawnEnemy = () => -1; Pve.serveQueue(Sim.time); } finally { Pve.spawnEnemy = spawnEnemy; }
  check('a spawn without a free slot keeps its queue entry', Pve.queue.count === 1);
  Pve.serveQueue(Sim.time);
  check('it spawns once a slot is free', Pve.queue.count === 0 && Pve.hostileCount() === 1);
  const boss = spawnFacing('overlord', 30), spawns = startEventLog('actor.spawn');
  PveAttacks.summon.begin(boss, Pve.rowOf(boss).attackRows.find((attack) => attack.id === 'summon'));
  spawns.stop();
  const mites = spawns.filter((event) => Pve.rowOf(event.id) && Pve.rowOf(event.id).id === 'mite').length;
  check('the summon brings a whole mite swarm', mites === CAT.enemies.byId('mite').group && countSummons(boss) === 2 + mites, mites + ' ' + countSummons(boss));
  Game.stop();
});

// A bomber spawned into a slot where another one blew up still blasts when killed early.
Test.add('pve', (check) => {
  startPveTest();
  const first = spawnFacing('bomber', 20);
  Pve.hitDone[first] = 1;
  Actors.remove(first);
  const second = spawnFacing('bomber', 20), blasts = startEventLog('explosion');
  killEnemy(second);
  blasts.stop();
  check('the reused slot starts with no blast done', second === first && blasts.length === 1, second + ' ' + first + ' ' + blasts.length);
  Game.stop();
});

// NPC-007 fallback: 75% of the encounter dead with reinforcements queued sends the rest back to their spawn.
Test.add('pve', (check) => {
  startPveTest();
  Pve.beginEncounter();
  const ids = [];
  for (let k = 0; k < 8; k++) ids.push(Pve.spawnEnemy('gunner', -14 + k * 4, 0, 20, Math.PI));
  Pve.enqueue('gunner', NO_TEAM, 1, -1, 1);
  Pve.peakAt = Sim.time;   // the director relaxes: the reinforcement waits
  for (let k = 0; k < 6; k++) killEnemy(ids[k]);
  const survivor = ids[7];
  Pve.nextThink[survivor] = Sim.time;
  Sim.run(1);
  check('survivors of a 75% loss fall back while reinforcements wait', Pve.goal[survivor] === PVE_GOAL.FALLBACK && Pve.goalZ[survivor] === Pve.homeZ[survivor], Pve.goal[survivor]);
  Pve.queue.count = 0;
  Pve.nextThink[survivor] = Sim.time;
  Sim.run(1);
  check('with nothing queued they make a last stand instead', Pve.goal[survivor] !== PVE_GOAL.FALLBACK, Pve.goal[survivor]);
  Game.stop();
});

// DIF-004: three party deaths in one wave offer the Guardian Plate; the next lost wave retries with damage taken halved.
Test.add('pve', (check) => withShortShop(() => {
  const ids = startPveMode('horde', [0, 0]);
  const run = Modes.behaviour.run;
  runUntil(() => run.state === PVE_WAVE_STATE.FIGHT, 10);
  for (let death = 0; death < PVE_DIRECTOR.guardianDeaths; death++) {
    killActor(ids[0], -1);
    runSeconds(0.1);
    if (!Actors.alive[ids[0]]) Modes.spawnActor(ids[0]);
  }
  runSeconds(0.1);
  check('three deaths in the wave offer the plate', run.plateOffered && PVE_HUD.guardianOffer, run.deaths);
  const retries = run.retriesLeft;
  Pve.damageCore(1e6, -1);
  runSeconds(0.5);
  check('the lost wave retries with the plate (no checkpoint retry spent)', Modes.active && run.plateUsed && run.retriesLeft === retries && Pve.guardian[ids[0]] === 1 && PVE_HUD.guardian, run.retriesLeft);
  const enemy = Pve.spawnEnemy('husk', 20, 0, 20, 0);
  check('the plate halves enemy damage', Test.near(Pve.attackerScale(enemy, ids[0]), Pve.skill().playerDamage * PVE_DIRECTOR.guardianTaken, 1e-6), Pve.attackerScale(enemy, ids[0]));
  godMode(ids);
  runUntil(() => run.wave >= 1 && run.state === PVE_WAVE_STATE.SHOP, 120, () => { if (run.state === PVE_WAVE_STATE.FIGHT && Pve.queue.count === 0) killAllEnemies(ids[1]); });
  runSeconds(0.1);
  check('a cleared wave takes the plate off', run.state === PVE_WAVE_STATE.SHOP && Pve.guardian[ids[0]] === 0 && !PVE_HUD.guardian, run.state + ' ' + run.wave);
  endModeTest();
}));

// DIF-004 choice (Pve.answerGuardian, the 18o pause row): accept keeps the plate for the retry, refuse drops it for the wave.
function offerGuardianPlate(answer) {
  const ids = startPveMode('horde', [0]), run = Modes.behaviour.run;
  runUntil(() => run.state === PVE_WAVE_STATE.FIGHT, 10);
  run.plateOffered = true;
  runSeconds(0.1);
  const offered = PVE_HUD.guardianOffer && guardianChoiceOpen() && hudPveGuardianText(PVE_HUD) === HUD_PVE_GUARDIAN_CHOICE;
  const answered = Pve.answerGuardian(answer);
  runSeconds(0.1);
  const after = { offered, answered, accepted: PVE_HUD.guardianAccepted, offer: PVE_HUD.guardianOffer, again: Pve.answerGuardian(answer) };
  Pve.damageCore(1e6, -1);
  runSeconds(0.5);
  after.worn = Pve.guardian[ids[0]] === 1;
  endModeTest();
  return after;
}
Test.add('pve', (check) => withShortShop(() => {
  const worn = offerGuardianPlate(true);
  check('an offered plate asks the player (pause row, CHOICE prompt)', worn.offered);
  check('accept: guardianAccepted, the offer stays, the retry wears the plate', worn.answered && worn.accepted && worn.offer && worn.worn, JSON.stringify(worn));
  const refused = offerGuardianPlate(false);
  check('refuse: no offer for the rest of the wave and no plate at the retry', refused.answered && !refused.accepted && !refused.offer && !refused.again && !refused.worn, JSON.stringify(refused));
  check('a new match clears the answer', !PVE_HUD.guardianAccepted && Pve.answerGuardian(true) === false);
}));

// M23 reads its mode params: custom deposit sizes and invasion step change the blockers and invasions.
function queuedOnSide(side, key) {
  const queue = Pve.queue;
  let count = 0;
  for (let k = 0; k < queue.count; k++) {
    const slot = (queue.head + k) % queue.row.length;
    if (queue.side[slot] === side && CAT.enemies[queue.row[slot]].id === key) count++;
  }
  return count;
}
Test.add('pve', (check) => {
  const params = { blockerAt: [2, 4, 6], invasionAt: 10, bossAt: 100 };
  const [blue] = startPveMode('bank', [0, 1], { spawns: PVE_HOME.concat([{ x: 30, y: 0, z: 30, yaw: 0, team: 1 }]) }, { modeOptions: { params } });
  godMode([blue]);
  check('the custom params reach the ruleset', Modes.rules.params.blockerAt[1] === 4 && Modes.rules.params.invasionAt === 10);
  Pve.queue.count = 0;
  BankRun.carried[blue] = 4;
  Modes.behaviour.bankMotes(blue, 0);
  check('a deposit of 4 sends the second blocker (custom blockerAt)', queuedOnSide(1, PVE_BANK.blockers[1]) === 1, queuedOnSide(1, PVE_BANK.blockers[1]));
  BankRun.carried[blue] = 6;
  Modes.behaviour.bankMotes(blue, 0);
  check('crossing the custom invasion step sends an invader', BankRun.invasions[0] === 1 && queuedOnSide(1, PVE_BANK.invader) === 1, BankRun.banked[0] + ' ' + BankRun.invasions[0]);
  endModeTest();
});

// MAP-030 hints are shown on entering a chamber; a fizzle grid with clears 'gates' closes the crosser's twin gates.
Test.add('pve', (check) => {
  World.load(Maps.get('chambers'));
  const announces = startEventLog('announce');
  Game.start({ mode: 'puzzle', seed: 1, bots: [{ dummy: true }] });
  const id = 0;
  check('the first chamber hint is in the HUD and announced', PVE_HUD.hint === PVE_CHAMBERS[0].hint && announces.some((event) => event.text === PVE_CHAMBERS[0].hint));
  const index = PVE_CHAMBERS.findIndex((row) => row.elements.some((element) => element.kind === 'fizzle' && element.clears === 'gates'));
  enterChamber(index);
  placeInChamber(id, index);
  chamberElementAt(PVE_CHAMBERS[index].elements.find((element) => element.kind === 'fizzle'), pveSpot);
  WeaponSpecialState.gateOpen[id * 2] = WeaponSpecialState.gateOpen[id * 2 + 1] = 1;
  Sim.run(1);
  check('gates stay open away from the grid', WeaponSpecialState.gateOpen[id * 2] === 1);
  relocateActor(id, pveSpot.x, pveSpot.y, pveSpot.z, 0);
  Sim.run(1);
  check('crossing the fizzle grid closes both twin gates', WeaponSpecialState.gateOpen[id * 2] === 0 && WeaponSpecialState.gateOpen[id * 2 + 1] === 0);
  enterChamber(PVE_CHAMBERS.findIndex((row) => !row.hint));
  check('late chambers have no hint', PVE_HUD.hint === '');
  announces.stop();
  endModeTest();
});

// One soul counter (Powerups.souls, fed by PU18 pickups) and A34 Wrath Form as the soul modes' automatic ultimate (ABL-005).
function soulPickupSlot() {
  for (let slot = PICKUP_CAP - 1; slot >= Items.spotCount; slot--) {
    if (Items.state[slot] === PICKUP_STATE.READY && Items.kind[slot] === PICKUP_KIND.POWERUP && Items.rowOf(slot).id === 'soul') return slot;
  }
  return -1;
}
Test.add('pve', (check) => withShortShop(() => {
  const player = startPveMode('horde', [0])[0], ultimate = Abilities.row(player, SLOT.ULTIMATE);
  check('a soul mode gives A34 Wrath Form as the ultimate', ultimate && ultimate.id === SOUL_ULTIMATE, ultimate && ultimate.id);
  check('one soul counter: the meters keep no souls or orbs of their own', Meters.souls === undefined && Meters.dropSoul === undefined);
  const enemy = Pve.spawnEnemy('husk', Actors.x[player], Actors.y[player], Actors.z[player] + 3, Math.PI);
  killEnemy(enemy, player);
  const slot = soulPickupSlot(), before = Powerups.souls[player];
  check('a PvE kill in a soul mode drops a PU18 soul', slot >= 0);
  if (slot >= 0) Items.take(player, slot);
  check('the soul counts in Powerups.souls', Powerups.souls[player] === before + 1, Powerups.souls[player]);
  Meters.addPoints(player, Meters.row().max);
  const kept = Abilities.row(player, SLOT.ULTIMATE);
  check('streak rewards leave Wrath Form in the ultimate slot of a soul mode', kept && kept.id === SOUL_ULTIMATE && !Abilities.rewardLoaded[player], kept && kept.id);
  const savedPlayer = Game.playerId;
  Game.playerId = player;   // the run log follows the local player
  Powerups.souls[player] = CAT.abilities.byId(SOUL_ULTIMATE).cost;
  Sim.step();
  check('Wrath Form casts itself once the souls pay for it and spends them', Abilities.isActive(player, SOUL_ULTIMATE) && Powerups.souls[player] === 0);
  check('the run log counts the Wrath Form from ability.cast', RunLog.wrathForms === 1 && RunLog.inWrath, RunLog.wrathForms);
  Sim.run((CAT.abilities.byId(SOUL_ULTIMATE).duration + 0.5) * TICK_RATE);
  check('and its end from ability.end', RunLog.wrathForms === 1 && !RunLog.inWrath);
  Game.playerId = savedPlayer;
  endModeTest();
}));

// NPC-007 / NPC-008: a hurt enemy takes cover once per sighting and never in a last stand, so a wave never stalls on it.
const PVE_TEST_WALL = { shape: 'box', min: [-4, 0, 12], max: [4, 3, 12.3] };   // cover for an enemy 10 m in front of the dummy
Test.add('pve', (check) => {
  const dummy = startPveTest({}, { brushes: [TEST_FLOOR, PVE_TEST_WALL] });
  const gunner = spawnFacing('gunner', 10), row = Pve.rowOf(gunner);
  const others = [40, 45, 50, 55].map((distance) => spawnFacing('husk', distance)), leaper = spawnFacing('leaper', 30), leaperRow = Pve.rowOf(leaper);
  const closeIn = leaperRow.attackRows[0].range[0] / 2;   // inside the pounce's minimum range
  check('a leaper does not pounce inside its minimum range', Pve.pickAttack(leaper, leaperRow, closeIn, Sim.time) === -1);
  const countLastStand = Pve.lastStand, twoPounces = { brain: leaperRow.brain, attackRows: [leaperRow.attackRows[0], leaperRow.attackRows[0]] };
  let lastStandCalls = 0;
  Pve.lastStand = function () { lastStandCalls++; return countLastStand.call(this); };
  try { Pve.pickAttack(leaper, twoPounces, closeIn, Sim.time); } finally { Pve.lastStand = countLastStand; }
  check('pickAttack counts the hostiles for the last stand once, not once per attack row', lastStandCalls === 1, lastStandCalls);
  Pve.target[gunner] = dummy;
  BotSense.remember(BotSense.pair(gunner, dummy), SENSE.SEEN, Actors.x[dummy], Actors.y[dummy], Actors.z[dummy], Sim.time);
  Actors.health[gunner] = Actors.maxHealth[gunner] * 0.2;
  Pve.decide(gunner, row, Sim.time);
  check('a hurt gunner takes cover', Pve.goal[gunner] === PVE_GOAL.COVER, Pve.goal[gunner]);
  Pve.coverUntil[gunner] = 0;
  Pve.decide(gunner, row, Sim.time);
  check('its cover time over, it does not hide again from the same target', Pve.goal[gunner] !== PVE_GOAL.COVER, Pve.goal[gunner]);
  for (const id of others) killEnemy(id);
  Pve.coverTaken[gunner] = 0;
  Pve.decide(gunner, row, Sim.time);
  check('in a last stand it never takes cover', Pve.lastStand() && Pve.goal[gunner] !== PVE_GOAL.COVER, Pve.goal[gunner]);
  check('in a last stand a cornered leaper pounces at any range', Pve.pickAttack(leaper, leaperRow, closeIn, Sim.time) === 0);
  // BOT-040 / BOT-091 for PvE: spawn-protected actors are no foes; the enemy rays come out of the bots' budget.
  Actors.flags[dummy] |= ACTOR_FLAG.PROTECTED;
  const protectedFoe = Pve.isFoe(gunner, dummy);
  Actors.flags[dummy] &= ~ACTOR_FLAG.PROTECTED;
  check('PvE enemies ignore a spawn-protected actor', !protectedFoe && Pve.isFoe(gunner, dummy));
  Pve.stepBrains(TICK_SECONDS);
  BotSense.serve(Sim.time);
  check('the bots get the per-tick ray budget minus the PvE share', BotSense.raysLeft <= SENSE_RAYS_PER_TICK - PVE_DIRECTOR.raysPerTick, BotSense.raysLeft);
  Game.stop();
  check('without PvE the bots get the whole budget back', BotSense.reservedRays === 0);
  World.clear();
});

// NPC-007: the last enemies of a wave (nothing queued) are pinged to the co-op bots, which then know where to hunt them.
Test.add('pve', (check) => withShortShop(() => {
  const bot = startPveMode('horde', [], { brushes: [TEST_FLOOR, { shape: 'box', min: [-10, 0, 20], max: [10, 4, 20.5] }] }, { bots: [{ team: 0 }] })[0];
  runUntil(() => Modes.behaviour.run.state === PVE_WAVE_STATE.FIGHT, 10);
  Pve.queue.count = 0;
  Pve.clearEnemies();
  const enemy = Pve.spawnEnemy('husk', 0, 0, 30, Math.PI);
  Actors.flags[enemy] |= ACTOR_FLAG.FROZEN;   // stays behind the wall
  runSeconds(PVE_WAVE_RULES.huntPingSeconds + 0.5);
  const pair = BotSense.pair(bot, enemy);
  check('the bot knows where the last enemy hides without seeing it', Bots.isBot(bot) && BotSense.knows(bot, enemy, Sim.time) && !BotSense.sees(bot, enemy)
    && BotSense.source[pair] === SENSE.PINGED, BotSense.source[pair]);
  const knife = CAT.weapons.byId('tanto');
  check('an out-of-ammo bot walks inside its knife reach to attack', attackRadius(knife) < knife.primary.reach, attackRadius(knife));
  endModeTest();
}));

// ECP07 at the wave break: a bot whose gun ran low buys a refill in the shop through Economy.buy, like the player.
Test.add('pve', (check) => withShortShop(() => {
  const bot = startPveMode('horde', [], {}, { bots: [{ team: 0 }] })[0];
  runUntil(() => Modes.behaviour.run.state === PVE_WAVE_STATE.FIGHT, 10);
  Pve.queue.count = 0;
  Pve.clearEnemies();
  const weapon = Weapons.currentWeapon(bot), slot = Weapons.slotIndex(bot, weapon.index);
  Weapons.reserve[slot] = 0;
  runUntil(() => Modes.behaviour.run.state === PVE_WAVE_STATE.SHOP, 10);
  runSeconds(BOT_BUY_CHECK + TICK_SECONDS);   // the bot looks into an open shop every BOT_BUY_CHECK s (14f BotEconomy)
  const item = CAT.buyItems.find((row) => row.kind === 'ammo' && row.buy === 'shop'), bought = Economy.bought[bot * CAT.buyItems.length + item.index];
  check('a bot restocks its emptied gun at the wave shop', bought === 1 && Weapons.reserve[slot] === Weapons.maxReserve(bot, weapon), bought + ' bought, reserve ' + Weapons.reserve[slot]);
  endModeTest();
}));

// Soak (backs up the two blocks above): Siege Waves on Cistern with an idle player and three bots never stalls in a wave.
const PVE_SOAK_MINUTES = 40, PVE_SOAK_WAVE_MINUTES = 6;
Test.add('pvesoak', (check) => {
  Game.start({ mode: 'horde', map: 'cistern', seed: 11, player: { team: 0 }, bots: [{ team: 0 }, { team: 0 }, { team: 0 }], difficulty: 'regular' });
  const waves = startEventLog('pve.wave');
  runUntil(() => !Modes.active, PVE_SOAK_MINUTES * 60);
  waves.stop();
  const cleared = waves.filter((event) => event.phase === 'end').length, results = Game.match.results, seconds = [];
  for (let i = 1; i < waves.length; i++) if (waves[i].phase === 'end' && waves[i - 1].phase === 'start') seconds.push(Math.round(waves[i].time - waves[i - 1].time));
  check('every Siege Waves wave clears with an idle player', !Modes.active && cleared === PVE_HORDE_WAVES.length && results && results.reason === PVE_WIN,
    cleared + ' cleared, ' + (results && results.reason));
  check('no wave fights longer than ' + PVE_SOAK_WAVE_MINUTES + ' minutes', seconds.length === cleared && Math.max(...seconds) < PVE_SOAK_WAVE_MINUTES * 60, seconds.join(' ') + ' s');
  endModeTest();
}, { slow: true });

// ---- P08 audit pass (pve-01..15) ----
// Runs `body` on a quality tier (Potato: enemy cap 12) and restores the setting.
function withQuality(tier, body) {
  const saved = Settings.get('video.quality');
  Settings.set('video.quality', tier);
  try { body(); } finally { Settings.set('video.quality', saved); }
}
function fillEnemyCap() {
  let guard = 0;
  while (Pve.spawnEnemy('mite', 20 + guard * 0.1, 0, 20, 0, { team: NO_TEAM }) >= 0 && guard++ < 100) { /* until the cap says no */ }
}

// Mote Rush: the Overlord waits for a free slot instead of being lost, and only the boss's own side can win with it.
Test.add('pve', (check) => withQuality('potato', () => {
  const [blue, red] = startPveMode('bank', [0, 1], { spawns: PVE_HOME.concat([{ x: 30, y: 0, z: 30, yaw: 0, team: 1 }]) });
  godMode([blue, red]);
  fillEnemyCap();
  check('the enemy cap is full', Pve.aliveCount() >= Pve.cap(), Pve.aliveCount() + ' / ' + Pve.cap());
  BankRun.banked[0] = Modes.rules.params.bossAt - 1;
  BankRun.carried[blue] = 3;
  placeActor(blue, BankRun.banks[0].x, BankRun.banks[0].z);
  runSeconds(2);
  check('a full enemy cap does not lose the Overlord', BankRun.boss[0] >= 0 && Actors.alive[BankRun.boss[0]] === 1, BankRun.boss[0]);
  killEnemy(BankRun.boss[0], red);
  runSeconds(0.1);
  check('the other side killing our Overlord decides nothing', Modes.active && BankRun.result === NOT_OVER);
  runSeconds(1);
  check('the Overlord comes back after a foreign kill', BankRun.boss[0] >= 0 && Actors.alive[BankRun.boss[0]] === 1, BankRun.boss[0]);
  killEnemy(BankRun.boss[0], blue);
  runSeconds(0.1);
  check('our own side killing it wins', !Modes.active && Game.match.results.winnerTeam === 0);
  endModeTest();
}));

// The boss bar follows the player's side.
Test.add('pve', (check) => {
  const [blue, red] = startPveMode('bank', [0, 1], { spawns: PVE_HOME.concat([{ x: 30, y: 0, z: 30, yaw: 0, team: 1 }]) });
  godMode([blue, red]);
  Modes.behaviour.summonBoss(0);
  Modes.behaviour.summonBoss(1);
  const saved = Game.playerId;
  Game.playerId = red;
  PveBoss.updateHud();
  check('the boss bar shows the player\'s side boss', PveBoss.hud.id === BankRun.boss[1] && BankRun.boss[1] >= 0, PveBoss.hud.id + ' ' + BankRun.boss[1]);
  Game.playerId = blue;
  PveBoss.updateHud();
  check('...and the other one for the other side', PveBoss.hud.id === BankRun.boss[0], PveBoss.hud.id + ' ' + BankRun.boss[0]);
  Game.playerId = saved;
  endModeTest();
});

// Difficulty lives belong to the co-op modes: practice and team modes never strand a player on Ascendant.
Test.add('pve', (check) => {
  const failures = [];
  const probe = (mode, ids) => {
    if (Modes.lives[ids[0]] !== LIVES_UNLIMITED) failures.push(mode + ' lives ' + Modes.lives[ids[0]]);
    killActor(ids[0], -1);
    runSeconds(15);
    if (Modes.active && !Actors.alive[ids[0]]) failures.push(mode + ' stays dead');
    endModeTest();
  };
  probe('range', startPveMode('range', [0], {}, { difficulty: 'ascendant' }));
  probe('bank', startPveMode('bank', [0, 1], {}, { difficulty: 'ascendant' }));
  probe('attrition', startPveMode('attrition', [0, 1], {}, { difficulty: 'ascendant' }));
  World.load(Maps.get('chambers'));
  Game.start({ mode: 'puzzle', seed: 1, bots: [{ dummy: true }], difficulty: 'ascendant' });
  Modes.endProtection(0);
  probe('puzzle', [0]);
  check('puzzle, range, bank and attrition ignore Ascendant lives and respawn the player', failures.length === 0, failures.join(', '));
  const ids = startPveMode('horde', [0], {}, { difficulty: 'ascendant' });
  check('horde keeps the Ascendant life', Modes.lives[ids[0]] === 1);
  endModeTest();
});

// Endless pays the wave bonus and opens the shop (its own economy row and core health); horde's shop is open before wave 1.
Test.add('pve', (check) => withShortShop(() => {
  const horde = startPveMode('horde', [0]);
  check('the horde shop is open before the first wave', Economy.shopOpen === true && Economy.buyBlock(horde[0]) !== 'closed', Economy.buyBlock(horde[0]));
  endModeTest();
  const ids = startPveMode('endless', [0]);
  godMode(ids);
  const run = Modes.behaviour.run;
  check('endless uses the wave shop economy and its own core health', Economy.preset().id === 'waveShop' && Pve.core.max === Modes.rules.params.coreHealth && Pve.core.max > 0, Economy.preset().id + ' ' + Pve.core.max);
  runUntil(() => run.wave >= 1 && run.state === PVE_WAVE_STATE.SHOP, 200, () => { if (run.state === PVE_WAVE_STATE.FIGHT && Pve.queue.count === 0) killAllEnemies(ids[0]); });
  check('endless wave 1 pays money and opens the shop', Economy.money(ids[0]) > 0 && Economy.shopOpen, Economy.money(ids[0]) + ' ' + run.state);
  endModeTest();
}));

// A burst fires along the turn-rate-limited look: a target that moved behind the enemy is not hit while it still faces away.
Test.add('pve', (check) => {
  const dummy = startPveTest(), turret = spawnFacing('turret', 10);
  const hits = startEventLog('damage');
  for (let tick = 0; tick < 600 && Pve.phase[turret] !== ATTACK_PHASE.ACTIVE; tick++) Sim.run(1);
  check('the turret reached its burst', Pve.phase[turret] === ATTACK_PHASE.ACTIVE);
  placeActor(dummy, 0, 18);
  let behind = 0, ticks = 0;
  const facingAway = () => Math.cos(Actors.aimYaw[turret] - Math.atan2(Actors.x[dummy] - Actors.x[turret], Actors.z[dummy] - Actors.z[turret])) < 0;
  while (ticks++ < 120 && Pve.phase[turret] === ATTACK_PHASE.ACTIVE && facingAway()) {
    const before = hits.length;
    Actors.health[dummy] = Actors.maxHealth[dummy];
    Sim.run(1);
    if (facingAway()) behind += hits.slice(before).filter((event) => event.source === turret && event.target === dummy && event.amount > 0).length;
  }
  hits.stop();
  check('burst shots do not follow a target behind the enemy', behind === 0 && ticks > 2, behind + ' hits in ' + ticks + ' ticks');
  endModeTest();
});

// The last few enemies of a wave are shown to the player; a boss phase change reads as shielded; a melee parry needs the front arc.
Test.add('pve', (check) => withShortShop(() => {
  for (const stopMatch of [false, true]) {   // the marker goes when its enemy dies, and with a stopped match
    const ids = startPveMode('horde', [0]);
    godMode(ids);
    runUntil(() => Modes.behaviour.run.state === PVE_WAVE_STATE.FIGHT, 20);
    Pve.queue.count = 0;
    killAllEnemies(ids[0]);
    const last = Pve.spawnEnemy('husk', 30, 0, 30, 0, { team: NO_TEAM });
    runSeconds(0.1);
    if (stopMatch) { endModeTest(); check('a stopped match leaves no hunted markers behind', pveHunted.length === 0, pveHunted.length); continue; }
    check('one enemy left: the player gets a marker for it', pveHunted.length === 1 && pveHunted[0] === last, pveHunted.length);
    killAllEnemies(ids[0]);
    runSeconds(0.1);
    check('no marker once it is dead', pveHunted.length === 0, pveHunted.length);
    endModeTest();
  }
}));
Test.add('pve', (check) => {
  const dummy = startPveTest(), boss = spawnFacing('overlord', 3);
  hitEnemy(dummy, boss, Actors.maxHealth[boss] * 0.5, 'hit', 'body');
  runSeconds(0.1);
  check('the boss HUD says shielded during the phase change', PveBoss.hud.active && PveBoss.hud.shielded === true, PveBoss.hud.phase);
  runSeconds(BOSS_TRANSITION_SECONDS + 0.2);
  check('...and not afterwards', PveBoss.hud.shielded === false);
  endModeTest();
});
Test.add('pve', (check) => {
  const dummy = startPveTest(), husk = spawnFacing('husk', 1.2), claw = { parry: true, id: 'claw', kind: 'melee' };
  const saved = Game.playerId;
  Game.playerId = dummy;
  Pve.parryAt[dummy] = Sim.time;
  Actors.yaw[dummy] = Math.PI;
  check('a melee blow from behind is not parried', !Pve.parried(husk, dummy, claw) && PVE_HUD.parryAt < Sim.time);
  Actors.yaw[dummy] = 0;
  check('a melee blow from the front is parried and flashes the HUD', Pve.parried(husk, dummy, claw) && PVE_HUD.parryAt === Sim.time);
  Game.playerId = saved;
  endModeTest();
});

// Range: every station fills on Potato (static targets skip the enemy cap); the drill clock starts at the first shot.
Test.add('pve', (check) => withQuality('potato', () => {
  const hints = [];
  for (let index = 0; index < 20; index++) hints.push({ kind: 'dummy', x: (index % 10) * 2 - 9, y: 0, z: 12 + Math.floor(index / 10) * 3 });
  World.load(pveTestMap({ spawns: [{ x: 0, y: 0, z: 0, yaw: 0, modes: ['range'] }], navHints: hints }));
  Game.start({ mode: 'range', seed: 1, bots: [{ dummy: true }], difficulty: 'regular' });
  Modes.endProtection(0);
  runSeconds(0.5);
  check('all 20 stations are filled on Potato', RangeRun.stations.length === 20 && RangeRun.stations.every((station) => station.id >= 0), RangeRun.stations.filter((station) => station.id >= 0).length);
  check('the drill clock is idle before a shot', RangeRun.drillStart < 0);
  Bus.emit('weapon.fire', { id: 0, weapon: 'tempest', weaponClass: 'rifle', mode: 'primary', x: 0, y: 1.6, z: 0, dx: 0, dy: 0, dz: 1 });
  check('the drill clock starts at the first shot', RangeRun.drillStart === Sim.time);
  endModeTest();
}));
