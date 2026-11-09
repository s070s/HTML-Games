// usage: node rowof.js <out.json> <style>  -> win rate of the style against each other style
const d = require(process.argv[2]), s = process.argv[3];
const res = [];
for (const [k, v] of Object.entries(d.pair)) { const [a, b] = k.split('|'); if (a === b) continue; if (a === s) res.push([b, v]); else if (b === s) res.push([a, 1 - v]); }
console.log(s, d.diff, res.sort((x, y) => y[1] - x[1]).map(([o, v]) => o + ' ' + Math.round(v * 100)).join(', '));
