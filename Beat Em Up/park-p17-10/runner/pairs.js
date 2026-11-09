// usage: node pairs.js <game.js> <difficulty> <seeds> <workerIndex> <workerCount> <out.json> [seedFrom=1] [pairFilter "a,b;c,d"]
// All 136 style pairs (mirrors included): KAI's body with the move style swapped (the style's own default defense), AI vs AI
// at one difficulty on the Warehouse (SimRunner.run, evenDamage, 60 s timer, 2 wins), seeds seedFrom..seedFrom+n-1, seats swapped on even seeds.
const fs = require('fs');
const loadFast = require('./fast.js');
const [gamePath, difficulty, seedsArg, wi, wc, outPath, seedFromArg, filterArg] = process.argv.slice(2);
const seeds = +seedsArg, workerIndex = +wi, workerCount = +wc, seedFrom = +(seedFromArg || 1);
const { ev } = loadFast(gamePath);
if (process.env.PRELUDE) ev(fs.readFileSync(__dirname + '/lib.js', 'utf8') + '\n' + fs.readFileSync(process.env.PRELUDE, 'utf8')); // experiment: code evaluated in the game closure before the runs
const styles = ev('MOVE_STYLE_IDS');
ev(`for (const s of MOVE_STYLE_IDS) ROSTER_BY_ID['sp_' + s] = Object.assign({}, ROSTER_BY_ID.kai, { id: 'sp_' + s, name: s.toUpperCase(), moveStyle: s, defense: undefined });`);
const all = [];
for (let i = 0; i < styles.length; i++) for (let j = i; j < styles.length; j++) all.push([styles[i], styles[j]]);
let list = all.filter((_, k) => k % workerCount === workerIndex);
if (filterArg) { const want = filterArg.split(';').map((p) => p.split(',').join('|')); list = all.filter((p) => want.includes(p.join('|'))).filter((_, k) => k % workerCount === workerIndex); }
const out = { difficulty, seeds, seedFrom, pairs: {} };
const t0 = Date.now();
for (const [a, b] of list) {
  const row = { a, b, aWins: 0, bWins: 0, none: 0, seconds: 0, n: 0 };
  for (let seed = seedFrom; seed < seedFrom + seeds; seed++) {
    const swap = seed % 2 === 0;
    const r = ev(`(() => { const r = SimRunner.run({ playerId: 'sp_${swap ? b : a}', opponentId: 'sp_${swap ? a : b}', seed: ${seed}, difficulty: '${difficulty}' }); return { winner: r.winner, seconds: r.seconds, error: r.error }; })()`);
    if (r.error) throw new Error(r.error);
    row.n++;
    if (r.winner < 0) row.none++; else if ((r.winner === 0) !== swap) row.aWins++; else row.bWins++;
    row.seconds += r.seconds;
  }
  out.pairs[a + '|' + b] = row;
}
out.ms = Date.now() - t0;
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('worker', workerIndex, 'done', list.length, 'pairs', out.ms, 'ms');
