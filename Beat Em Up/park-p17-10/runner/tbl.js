// usage: node tbl.js <tag> -> markdown table of the pooled rates of the four difficulties, '*' = out of band, '~' = within 3 points of an edge; then the pairs more than 12 points out of band
const fs = require('fs');
const tag = process.argv[2];
const diffs = ['easy', 'normal', 'hard', 'expert'];
const data = diffs.map((d) => JSON.parse(fs.readFileSync(__dirname + '/out-' + tag + '-' + d + '.json', 'utf8')));
const band = (d) => (d === 'hard' || d === 'expert' ? [40, 60] : [35, 65]);
const styles = Object.keys(data[0].pooled);
const lines = ['| Style | Easy | Normal | Hard | Expert |', '|---|---|---|---|---|'];
for (const s of styles) {
  const cells = diffs.map((d, i) => {
    const v = data[i].pooled[s], [lo, hi] = band(d);
    return v.toFixed(1) + (v < lo || v > hi ? ' *' : (v < lo + 3 || v > hi - 3 ? ' ~' : ''));
  });
  lines.push('| ' + s + ' | ' + cells.join(' | ') + ' |');
}
console.log(lines.join('\n'));
console.log('N per pair ' + data[0].N);
for (let i = 0; i < 4; i++) {
  const [lo, hi] = band(diffs[i]);
  const far = Object.entries(data[i].pair).filter(([k, v]) => k.split('|')[0] !== k.split('|')[1] && (v * 100 < lo - 12 || v * 100 > hi + 12)).map(([k, v]) => k + ' ' + Math.round(v * 100));
  console.log(diffs[i] + ' pairs more than 12 points past the band: ' + (far.length ? far.join(', ') : 'none'));
}
