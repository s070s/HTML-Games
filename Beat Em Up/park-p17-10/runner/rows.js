// usage: node rows.js <game.js>   per new row: damage per frame, on hit, on block against the band of the existing rows of its category (what the self-test allows)
const loadFast = require('./fast.js');
const { ev } = loadFast(process.argv[2]);
const out = ev(`(() => {
  const NEW = ['body_hook', 'bob_hook', 'lunge_punch', 'backfist', 'shoulder_bump', 'snap_down', 'collar_snap', 'headbutt', 'superman', 'palm_strike', 'switch_kick', 'side_kick', 'foot_sweep', 'stomp', 'armada', 'cartwheel', 'handstand_kick', 'leg_pick', 'guard_kick', 'groin_kick', 'axe_kick'];
  const base = ALL_MOVES.filter((m) => !NEW.includes(m.id) && !m.ctx && m.tier < 3 && m.type === 'strike' && !['chain_punch', 'trap_strike', 'teep', 'elbow_strike', 'spin_back_kick', 'jump_round', 'spin_heel', 'angle_one', 'angle_two', 'parry_strike', 'overhand'].includes(m.id));
  const pf = (m) => m.dmg / (m.startup + m.active + m.recovery);
  const band = {};
  for (const cat of ['punch', 'kick']) { const same = base.filter((b) => b.cat === cat); band[cat] = { pf: [Math.min(...same.map(pf)), Math.max(...same.map(pf))], hit: [Math.min(...same.map((b) => frameAdvantage(b).onHit)), Math.max(...same.map((b) => frameAdvantage(b).onHit))], blk: [Math.min(...same.map((b) => frameAdvantage(b).onBlock)), Math.max(...same.map((b) => frameAdvantage(b).onBlock))] }; }
  const rows = NEW.map((id) => { const m = ATTACKS[id], fa = frameAdvantage(m); return { id, cat: m.cat, h: m.h, tier: m.tier, su: m.startup, dmg: m.dmg, rec: m.recovery, pf: +pf(m).toFixed(3), hit: fa.onHit, blk: fa.onBlock, reach: m.reach }; });
  return { band, rows };
})()`);
console.log(JSON.stringify(out.band));
for (const r of out.rows) {
  const b = out.band[r.cat];
  console.log(r.id.padEnd(15), r.cat.padEnd(6), r.h, 'T' + r.tier, 'su' + r.su, 'd' + r.dmg, 'rec' + r.rec, 'pf', r.pf, '[' + b.pf.map((x) => x.toFixed(3)) + ']', 'hit', r.hit, '[' + b.hit + ']', 'blk', r.blk, '[' + b.blk + ']', 'reach', r.reach);
}
