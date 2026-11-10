// usage: node pairrow.js <tag> <style> [style...]   win rate of the style against each other style at the four difficulties
const fs = require('fs');
const [tag, ...styles] = process.argv.slice(2);
const diffs = ['easy', 'normal', 'hard', 'expert'];
const data = {};
for (const d of diffs) { try { data[d] = JSON.parse(fs.readFileSync(__dirname + '/out-' + tag + '-' + d + '.json', 'utf8')); } catch (e) { /* not run */ } }
for (const s of styles) {
  console.log('== ' + s);
  const others = Object.keys(data[diffs.find((d) => data[d])].pooled).filter((o) => o !== s);
  for (const o of others) {
    const row = diffs.map((d) => {
      if (!data[d]) return '  - ';
      const direct = data[d].pair[s + '|' + o];
      const rate = direct !== undefined ? direct : 1 - data[d].pair[o + '|' + s];
      return String(Math.round(rate * 100)).padStart(3);
    });
    console.log(o.padEnd(10), row.join(' '));
  }
}
