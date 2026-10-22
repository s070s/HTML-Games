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

// Runs until the first damage from `id` reaches the dummy (or `seconds` pass); holds the dummy alive and in place.
function runUntilHit(id, dummy, seconds) {
  const hits = startEventLog('damage');
  for (let tick = 0; tick < seconds * TICK_RATE; tick++) {
    Actors.health[dummy] = Actors.maxHealth[dummy];
    Actors.x[dummy] = 0; Actors.z[dummy] = 0; Actors.vx[dummy] = Actors.vz[dummy] = 0;
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
