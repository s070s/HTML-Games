// Balance script: simulates the port boss fight (Ο Λιμενάρχης Κώτσος) with an AI-played player team.
// Usage: node Mizamon/tools/balance.mjs [runs]   (default 500 runs per row)
// The player team is one random starter plus five random route creatures, all at the same level
// (or lagging two levels behind), played by the same AI as the opponent, with two Σουβλάκι to use.
import { loadRules, xpBand } from './run-tests.mjs';

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
