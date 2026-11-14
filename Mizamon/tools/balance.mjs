// Balance script: simulates the port boss fight (Ο Λιμενάρχης Κώτσος) with an AI-played player team, then the Πειραιάς XP band and route 2, then Νότια, then Ανατολικά.
// Usage: node Mizamon/tools/balance.mjs [runs]   (default 500 runs per row)
// The player team is one random starter plus five random route creatures, all at the same level
// (or lagging two levels behind), played by the same AI as the opponent, with two Σουβλάκι to use.
import { loadRules, xpBand, notiaTeam, anatolikaTeam, bossWinRate, starterBossRate, bossBands } from './run-tests.mjs';

const R = loadRules();
const runs = Number(process.argv[2]) || 500;
const ROUTE_IDS = ['fakelakis', 'trolosavros', 'laikatzis', 'storoula', 'dimosio', 'eforaki', 'frapedoros', 'giagiaka'];
const ROUTE2_IDS = ROUTE_IDS.concat(['fakelarchis', 'efoplistakos']); // the creatures a player may carry after route 2

function buildTeam(rng, level, lag) {
  const starter = R.pickOne(rng, R.STARTERS);
  const team = [R.makeMon(starter, level)];
  const pool = ROUTE_IDS.slice();
  for (let i = 0; i < 5; i++) {
    const pick = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    team.push(R.makeMon(pick, Math.max(2, level - lag)));
  }
  return team;
}
function row(level, lag, size, items) {
  const rng = R.makeRng(1000 + level * 10 + lag + size);
  let wins = 0;
  let turns = 0;
  for (let i = 0; i < runs; i++) {
    const team = buildTeam(rng, level, lag).slice(0, size);
    const result = R.simulateBattle(team, R.buildTrainerTeam('kotsos', 'komma'), rng, { foeItems: R.TRAINERS.kotsos.items, playerItems: items });
    if (result.winner === 0) wins++;
    turns += result.turns;
  }
  return { wins: (100 * wins / runs).toFixed(1) + '%', turns: (turns / runs).toFixed(1) };
}
console.log('Boss fight, ' + runs + ' runs per row. Boss team: ' + R.TRAINERS.kotsos.team.map((m) => R.SPECIES[m.sp].n + ' L' + m.lv).join(', '));
console.log('level | team                       | win rate | avg turns');
for (const level of [10, 12, 14]) {
  for (const [label, lag, size, items] of [['6 at level', 0, 6, ['souvlaki', 'souvlaki']], ['6, 2 levels behind', 2, 6, ['souvlaki', 'souvlaki']], ['3 at level, no items', 0, 3, []]]) {
    const r = row(level, lag, size, items);
    console.log(String(level).padStart(5) + ' | ' + label.padEnd(26) + ' | ' + r.wins.padStart(8) + ' | ' + r.turns);
  }
}
// Typical fight length of ordinary battles (wild creatures against a same-level starter)
const rng = R.makeRng(7);
let total = 0;
let count = 0;
for (let i = 0; i < 600; i++) {
  const level = R.randInt(rng, 5, 12);
  const starter = R.makeMon(R.pickOne(rng, R.STARTERS), level);
  const wild = R.makeMon(R.pickOne(rng, ROUTE_IDS), Math.max(2, level - R.randInt(rng, 0, 3)));
  total += R.simulateBattle([starter], [wild], rng, { kind: 'wild' }).turns;
  count++;
}
console.log('Average length of a 1v1 wild fight: ' + (total / count).toFixed(2) + ' turns');

// ---- Πειραιάς (MZ-WORLD-02a): the XP band and the route 2 fights ----
console.log('');
const band = xpBand(R, 'peiraias');
console.log('Πειραιάς XP band (section 11.4): boss top level ' + band.top + ', XP needed for three creatures ' + band.need + ', XP of the ' + band.trainerIds.length + ' trainers ' + band.trainerXp +
  ' (' + (100 * band.trainerShare).toFixed(0) + '% of the need), a route 2 wild fight pays ' + band.wildXp.toFixed(0) + ' on average, wild fights still needed ' + band.wildFights + ' (limit 15)');
function routeTwoRow(trainerId, level, size) {
  const rng = R.makeRng(5000 + level * 10 + size);
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const starter = R.pickOne(rng, R.STARTERS);
    const team = [R.makeMon(starter, level)];
    const pool = ROUTE2_IDS.slice();
    for (let n = 1; n < size; n++) team.push(R.makeMon(pool.splice(Math.floor(rng() * pool.length), 1)[0], level));
    if (R.simulateBattle(team, R.buildTrainerTeam(trainerId, 'komma'), rng, { foeItems: R.TRAINERS[trainerId].items, playerItems: [] }).winner === 0) wins++;
  }
  return (100 * wins / runs).toFixed(1) + '%';
}
console.log('Route 2 trainer fights, ' + runs + ' runs per cell (player: a starter plus route creatures, all at the level shown, no items)');
console.log('trainer (team)                                        | level | 6 creatures | 3 creatures');
for (const trainerId of ['fan', 'ferrysailor']) {
  const label = R.TRAINERS[trainerId].name + ' (' + R.TRAINERS[trainerId].team.map((m) => R.SPECIES[m.sp].n + ' L' + m.lv).join(', ') + ')';
  for (const level of [11, 12, 13]) console.log(label.padEnd(53) + ' | ' + String(level).padStart(5) + ' | ' + routeTwoRow(trainerId, level, 6).padStart(11) + ' | ' + routeTwoRow(trainerId, level, 3).padStart(11));
}
// a wild Εφοπλιστάκος (L12-13) against one creature of the player's own level
const wildRng = R.makeRng(11);
for (const level of [12, 13]) {
  let wins = 0;
  for (let i = 0; i < runs; i++) wins += R.simulateBattle([R.makeMon(R.pickOne(wildRng, R.STARTERS), level)], [R.makeMon('efoplistakos', level)], wildRng, { kind: 'wild' }).winner === 0 ? 1 : 0;
  console.log('Wild Εφοπλιστάκος L' + level + ' against one starter at L' + level + ': the starter wins ' + (100 * wins / runs).toFixed(1) + '%');
}

// ---- Νότια (MZ-WORLD-02b): the XP band, the boss Ο Κύριος Μπουγάτσας, the seven trainers, the wild Καφενόβιος ----
console.log('');
const notiaBand = xpBand(R, 'notia');
console.log('Νότια XP band (section 11.4): boss top level ' + notiaBand.top + ', XP needed for three creatures ' + notiaBand.need + ', XP of the ' + notiaBand.trainerIds.length + ' trainers ' + notiaBand.trainerXp +
  ' (' + (100 * notiaBand.trainerShare).toFixed(0) + '% of the need), a route 4 wild fight pays ' + notiaBand.wildXp.toFixed(0) + ' on average, wild fights still needed ' + notiaBand.wildFights + ' (limit 10)');
const notiaBoss = R.TRAINERS.bougatsas;
console.log('Boss fight Νότια, ' + runs + ' runs per row. Boss team: ' + notiaBoss.team.map((m) => R.SPECIES[m.sp].n + ' L' + m.lv).join(', ') + ' (stat boost x' + notiaBoss.boost + ', one Σουβλάκι). Player: a starter in its middle form plus creatures of Νότια, all at the level shown, two Σουβλάκι');
console.log('level | team                       | win rate | band of the test');
const notiaTop = notiaBoss.team[notiaBoss.team.length - 1].lv;
for (const [label, offset, size, items, low, high] of bossBands(R, 'bougatsas')) {
  const rate = bossWinRate(R, 'bougatsas', notiaTop + offset, size, items === 2 ? ['souvlaki', 'souvlaki'] : [], runs, 5000);
  console.log(String(notiaTop + offset).padStart(5) + ' | ' + label.padEnd(26) + ' | ' + (100 * rate).toFixed(1).padStart(7) + '% | ' + (100 * low).toFixed(0) + '-' + (100 * high).toFixed(0) + '%');
}
console.log('Per starter, six creatures, two Σουβλάκι (' + runs + ' runs per cell; the test wants 75% or more at top plus 1 and a spread of 35 points or less at top minus 1)');
console.log('boss      | starter    | top plus 1 | top minus 1 | top minus 3');
for (const bossId of ['kotsos', 'bougatsas']) {
  const bossTeam = R.TRAINERS[bossId].team;
  const bossTop = bossTeam[bossTeam.length - 1].lv;
  for (const starter of R.STARTERS) {
    const cell = (offset) => (100 * starterBossRate(R, bossId, starter, bossTop + offset, 6, runs, 8000)).toFixed(1).padStart(9) + '%';
    console.log(bossId.padEnd(9) + ' | ' + starter.padEnd(10) + ' | ' + cell(1) + ' | ' + cell(-1) + ' | ' + cell(-3));
  }
}
console.log('Νότια trainer fights, ' + runs + ' runs per cell (player: a middle-form starter plus creatures of Νότια, all at the level shown, no items)');
console.log('trainer (team)                                                       | level | 6 creatures | 3 creatures');
for (const trainerId of notiaBand.trainerIds) {
  const label = R.TRAINERS[trainerId].name + ' (' + R.buildTrainerTeam(trainerId, 'komma').map((m) => R.SPECIES[m.sp].n + ' L' + m.lv).join(', ') + ')';
  for (const level of [16, 17, 18]) {
    const cell = (size) => {
      const rng = R.makeRng(6000 + level * 10 + size);
      let wins = 0;
      for (let i = 0; i < runs; i++) if (R.simulateBattle(notiaTeam(R, rng, level, size), R.buildTrainerTeam(trainerId, 'komma'), rng, { foeItems: R.TRAINERS[trainerId].items, playerItems: [] }).winner === 0) wins++;
      return (100 * wins / runs).toFixed(1) + '%';
    };
    console.log(label.padEnd(68) + ' | ' + String(level).padStart(5) + ' | ' + cell(6).padStart(11) + ' | ' + cell(3).padStart(11));
  }
}
const kafenoviosRng = R.makeRng(21);
for (const level of [17, 19]) {
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const starter = R.makeMon(R.pickOne(kafenoviosRng, R.STARTERS), level);
    R.evolveMon(starter);
    wins += R.simulateBattle([starter], [R.makeMon('kafenovios', level)], kafenoviosRng, { kind: 'wild' }).winner === 0 ? 1 : 0;
  }
  console.log('Wild Καφενόβιος L' + level + ' against one starter (middle form) at L' + level + ': the starter wins ' + (100 * wins / runs).toFixed(1) + '%');
}

// ---- Ανατολικά (MZ-WORLD-02c): the XP band, the boss @influencεr_Φαίη, the seven trainers ----
console.log('');
const anatolikaBand = xpBand(R, 'anatolika');
console.log('Ανατολικά XP band (section 11.4): boss top level ' + anatolikaBand.top + ', XP needed for three creatures ' + anatolikaBand.need + ', XP of the ' + anatolikaBand.trainerIds.length + ' trainers ' + anatolikaBand.trainerXp +
  ' (' + (100 * anatolikaBand.trainerShare).toFixed(0) + '% of the need), a route 6 wild fight pays ' + anatolikaBand.wildXp.toFixed(0) + ' on average, wild fights still needed ' + anatolikaBand.wildFights + ' (limit 10)');
const faia = R.TRAINERS.faia;
console.log('Boss fight Ανατολικά, ' + runs + ' runs per row. Boss team: ' + faia.team.map((m) => R.SPECIES[m.sp].n + ' L' + m.lv).join(', ') + (faia.boost ? ' (stat boost x' + faia.boost + ')' : ' (no boost)') + ', one ' + faia.items.join('/') + '. Player: a starter in its middle form plus creatures of Ανατολικά, all at the level shown, two Σουβλάκι');
console.log('level | team                       | win rate | band of the test');
const faiaTop = faia.team.reduce((best, m) => Math.max(best, m.lv), 0);
for (const [label, offset, size, items, low, high] of bossBands(R, 'faia')) {
  const rate = bossWinRate(R, 'faia', faiaTop + offset, size, items === 2 ? ['souvlaki', 'souvlaki'] : [], runs, 5000);
  console.log(String(faiaTop + offset).padStart(5) + ' | ' + label.padEnd(26) + ' | ' + (100 * rate).toFixed(1).padStart(7) + '% | ' + (100 * low).toFixed(0) + '-' + (100 * high).toFixed(0) + '%');
}
console.log('Per starter, six creatures, two Σουβλάκι (' + runs + ' runs per cell; the test wants 75% or more at top plus 1 and a spread of 35 points or less at top minus 1)');
console.log('boss      | starter    | top plus 1 | top minus 1 | top minus 3');
for (const starter of R.STARTERS) {
  const cell = (offset) => (100 * starterBossRate(R, 'faia', starter, faiaTop + offset, 6, runs, 8000)).toFixed(1).padStart(9) + '%';
  console.log('faia'.padEnd(9) + ' | ' + starter.padEnd(10) + ' | ' + cell(1) + ' | ' + cell(-1) + ' | ' + cell(-3));
}
console.log('Ανατολικά trainer fights, ' + runs + ' runs per cell (player: a middle-form starter plus creatures of Ανατολικά, all at the level shown, no items)');
console.log('trainer (team)                                                       | level | 6 creatures | 3 creatures');
for (const trainerId of anatolikaBand.trainerIds) {
  const label = R.TRAINERS[trainerId].name + ' (' + R.buildTrainerTeam(trainerId, 'komma').map((m) => R.SPECIES[m.sp].n + ' L' + m.lv).join(', ') + ')';
  for (const level of [23, 24, 25]) {
    const cell = (size) => {
      const rng = R.makeRng(7000 + level * 10 + size);
      let wins = 0;
      for (let i = 0; i < runs; i++) if (R.simulateBattle(anatolikaTeam(R, rng, level, size), R.buildTrainerTeam(trainerId, 'komma'), rng, { foeItems: R.TRAINERS[trainerId].items, playerItems: [] }).winner === 0) wins++;
      return (100 * wins / runs).toFixed(1) + '%';
    };
    console.log(label.padEnd(68) + ' | ' + String(level).padStart(5) + ' | ' + cell(6).padStart(11) + ' | ' + cell(3).padStart(11));
  }
}
const monastiriakiRng = R.makeRng(23);
for (const level of [20, 22]) {
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const starter = R.makeMon(R.pickOne(monastiriakiRng, R.STARTERS), level);
    R.evolveMon(starter);
    wins += R.simulateBattle([starter], [R.makeMon('monastiriaki', level)], monastiriakiRng, { kind: 'wild' }).winner === 0 ? 1 : 0;
  }
  console.log('Wild Μοναστηριάκι L' + level + ' against one starter (middle form) at L' + level + ': the starter wins ' + (100 * wins / runs).toFixed(1) + '%');
}
