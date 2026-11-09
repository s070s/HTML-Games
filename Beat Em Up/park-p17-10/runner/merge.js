// usage: node merge.js <out.json> <in1.json> [in2 ...]  (merges workers and pools seed ranges; prints a summary)
const fs = require('fs');
const [outPath, ...ins] = process.argv.slice(2);
const parts = ins.map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
const pairs = {};
for (const part of parts) for (const [k, r] of Object.entries(part.pairs)) {
  const t = pairs[k] || (pairs[k] = { a: r.a, b: r.b, aWins: 0, bWins: 0, none: 0, seconds: 0, n: 0 });
  for (const f of ['aWins', 'bWins', 'none', 'seconds', 'n']) t[f] += r[f];
}
const styles = [...new Set(Object.values(pairs).flatMap((r) => [r.a, r.b]))];
const rate = (r) => (r.aWins + 0.5 * r.none) / r.n;
const pooled = {}, pair = {};
for (const s of styles) {
  let sum = 0, cnt = 0;
  for (const r of Object.values(pairs)) {
    if (r.a === r.b) continue;
    if (r.a === s) { sum += rate(r); cnt++; } else if (r.b === s) { sum += 1 - rate(r); cnt++; }
  }
  pooled[s] = Math.round((sum / cnt) * 1000) / 10;
}
for (const [k, r] of Object.entries(pairs)) pair[k] = Math.round(rate(r) * 1000) / 1000;
const N = Math.max(...Object.values(pairs).map((r) => r.n));
const seconds = Math.round(parts.reduce((s, p) => s + p.ms, 0) / 1000);
const out = { diff: parts[0].difficulty, N, seconds, pooled, pair };
fs.writeFileSync(outPath, JSON.stringify(out));
const hard = out.diff === 'hard' || out.diff === 'expert';
const lo = hard ? 40 : 35, hi = hard ? 60 : 65;
console.log(out.diff, 'N=' + N, 'cpu-s=' + seconds, 'band', lo + '-' + hi);
console.log(styles.map((s) => s.padEnd(10) + pooled[s].toFixed(1) + (pooled[s] < lo || pooled[s] > hi ? '  OUT' : '')).join('\n'));
const sd = Math.sqrt(0.25 / N) * 100;
const bad = Object.entries(pairs).filter(([, r]) => r.a !== r.b).filter(([, r]) => { const p = rate(r) * 100; return p < lo - sd || p > hi + sd; }).map(([k, r]) => k + ' ' + (rate(r) * 100).toFixed(0));
console.log('pairs out by more than 1 sd (' + sd.toFixed(0) + ' pts):', bad.length ? bad.join(', ') : 'none');
const mir = Object.values(pairs).filter((r) => r.a === r.b).map((r) => rate(r));
console.log('mirror mean (seat A win rate):', (mir.reduce((s, x) => s + x, 0) / mir.length).toFixed(3));
