// usage: node diag.js <game.js> <difficulty> <seeds> <style> <out.json> [seedFrom=1]
// One style against the 15 others (seats swapped on even seeds): wins, and for both sides damage per source (move identity, throw, hold),
// strike starts per identity, blocked / hit counts, so a weak style's problem shows (which moves land, which get blocked, how often it is thrown).
const fs = require('fs');
const loadFast = require('./fast.js');
const [gamePath, difficulty, seedsArg, style, outPath, seedFromArg] = process.argv.slice(2);
const seeds = +seedsArg, seedFrom = +(seedFromArg || 1);
const { ev } = loadFast(gamePath);
if (process.env.PRELUDE) ev(fs.readFileSync(__dirname + '/lib.js', 'utf8') + '\n' + fs.readFileSync(process.env.PRELUDE, 'utf8')); // experiment: code evaluated in the game closure before the runs
const styles = ev('MOVE_STYLE_IDS');
ev(`for (const s of MOVE_STYLE_IDS) ROSTER_BY_ID['sp_' + s] = Object.assign({}, ROSTER_BY_ID.kai, { id: 'sp_' + s, name: s.toUpperCase(), moveStyle: s, defense: undefined });`);
ev(`globalThis.__diag = (a, b, seed, swap, difficulty) => {
  const side = () => ({ dmg: {}, starts: {}, hits: {}, blocks: {}, total: 0 });
  const t = [side(), side()];
  const bump = (o, k, v) => { o[k] = (o[k] || 0) + v; };
  const listeners = {
    hit: (e) => { const k = e.kind === 'ground' ? 'ground' : e.mv.id + '@' + (e.mv.look || e.mv.anim); bump(t[e.att.index].dmg, k, e.dmg); bump(t[e.att.index].hits, k, 1); t[e.att.index].total += e.dmg; },
    block: (e) => { if (e.att && e.mv) bump(t[e.att.index].blocks, e.mv.id + '@' + (e.mv.look || e.mv.anim), 1); },
    throw: (e) => { bump(t[e.att.index].dmg, 'throw:' + e.name, e.dmg); t[e.att.index].total += e.dmg; },
    submissionEnd: (e) => { bump(t[e.att.index].dmg, 'hold', e.damage); t[e.att.index].total += e.damage; },
    attackStart: (e) => { if (e.mv) bump(t[e.f.index].starts, e.mv.id + '@' + (e.mv.look || e.mv.anim), 1); },
  };
  const r = SimRunner.run({ playerId: 'sp_' + (swap ? b : a), opponentId: 'sp_' + (swap ? a : b), seed, difficulty, listeners });
  return { winner: r.winner, seconds: r.seconds, t: swap ? [t[1], t[0]] : t };
};`);
const out = { difficulty, style, seeds, wins: 0, n: 0, mine: { dmg: {}, starts: {}, hits: {}, blocks: {}, total: 0 }, theirs: { dmg: {}, starts: {}, hits: {}, blocks: {}, total: 0 }, vs: {} };
const add = (to, from) => { for (const f of ['dmg', 'starts', 'hits', 'blocks']) for (const k in from[f]) to[f][k] = (to[f][k] || 0) + from[f][k]; to.total += from.total; };
for (const other of styles) {
  if (other === style) continue;
  let w = 0, n = 0;
  for (let seed = seedFrom; seed < seedFrom + seeds; seed++) {
    const swap = seed % 2 === 0;
    const r = ev(`globalThis.__diag(${JSON.stringify(style)}, ${JSON.stringify(other)}, ${seed}, ${swap}, ${JSON.stringify(difficulty)})`);
    n++;
    if ((r.winner === 0) !== swap && r.winner >= 0) w++;
    add(out.mine, r.t[0]); add(out.theirs, r.t[1]);
  }
  out.vs[other] = w / n; out.wins += w; out.n += n;
}
fs.writeFileSync(outPath, JSON.stringify(out));
const top = (o, k = 8) => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, k).map(([a, b]) => a + ' ' + Math.round(b)).join(', ');
console.log(style, difficulty, 'win', (out.wins / out.n).toFixed(3), 'damage dealt', Math.round(out.mine.total / out.n), 'taken', Math.round(out.theirs.total / out.n), '(per match)');
console.log(' dealt by:', top(out.mine.dmg));
console.log(' taken by:', top(out.theirs.dmg));
console.log(' my starts:', top(out.mine.starts), '| my blocked:', top(out.mine.blocks, 5));
