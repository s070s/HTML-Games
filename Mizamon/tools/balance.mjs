// Balance script: simulates the port boss fight (Ο Λιμενάρχης Κώτσος) with an AI-played player team.
// Usage: node Mizamon/tools/balance.mjs [runs]   (default 500 runs per row)
// The player team is one random starter plus five random route creatures, all at the same level
// (or lagging two levels behind), played by the same AI as the opponent, with two Σουβλάκι to use.
import { loadRules } from './run-tests.mjs';

const R = loadRules();
const runs = Number(process.argv[2]) || 500;
const ROUTE_IDS = ['fakelakis', 'trolosavros', 'laikatzis', 'storoula', 'dimosio', 'eforaki', 'frapedoros', 'giagiaka'];

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
