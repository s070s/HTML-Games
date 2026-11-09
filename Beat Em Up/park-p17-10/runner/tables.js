// usage: node tables.js <game.js> [style ...]   prints each style's string tables with the damage, startup, reach of each step
const loadFast = require('./fast.js');
const [gamePath, ...want] = process.argv.slice(2);
const { ev } = loadFast(gamePath);
const styles = want.length ? want : ev('MOVE_STYLE_IDS');
for (const s of styles) {
  const out = ev(`(() => { const t = stringsFor(${JSON.stringify(s)}); const lines = [];
    for (const side of ['stand', 'crouch']) for (const keys in t[side]) lines.push((side === 'crouch' ? 'c' : '') + keys + ': ' + t[side][keys].map((id) => { const m = moveFor(${JSON.stringify(s)}, id); return m.name + '(' + m.dmg + '/' + m.startup + '+' + m.active + '+' + m.recovery + ' r' + m.reach + ' ' + m.h + (m.tier === 3 ? ' S' : '') + ')'; }).join(' > '));
    return lines; })()`);
  console.log('== ' + s + '\n' + out.join('\n'));
}
