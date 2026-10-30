// P8-01 comparison of the runs written by tools/balance.mjs: per case and per row, Wilson intervals for rates and a bootstrap over runs for
// indexes, against BALANCE_TARGETS (read from the test build). Prints only the fail, watch and no-data lines with a count per family and writes
// summary.json (every evaluation) next to the runs. A row fails when its whole 95 % interval lies outside the band, is "watch" when only the
// point value is outside, and is "no data" under the minimum sample (never a pass).
// Usage: node tools/balance.mjs --summary <runs.jsonl[,more.jsonl]> [--out <dir>] [--only <family,family>] [--all]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { openChrome } from './cdp.mjs';
import { homeMap } from './balance-plan.mjs';

const Z = 1.96;
const BOOTSTRAPS = 1000;
const RESAMPLE_SEED = 20261030;
const SPLIT_MIN = 40;           // engagements for the home / away split of a row

export function wilson(successes, total) {
  if (!total) return [0, 1];
  const p = successes / total, z2 = Z * Z, centre = (p + z2 / (2 * total)) / (1 + z2 / total);
  const half = Z * Math.sqrt(p * (1 - p) / total + z2 / (4 * total * total)) / (1 + z2 / total);
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}
function random(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);
export function bootstrap(values) {
  if (values.length < 2) return [mean(values), mean(values)];
  const next = random(RESAMPLE_SEED), means = [];
  for (let b = 0; b < BOOTSTRAPS; b++) { let sum = 0; for (let i = 0; i < values.length; i++) sum += values[Math.floor(next() * values.length)]; means.push(sum / values.length); }
  means.sort((a, b) => a - b);
  return [means[Math.floor(BOOTSTRAPS * 0.025)], means[Math.floor(BOOTSTRAPS * 0.975)]];
}

const inBand = (value, band) => !band || ((band[0] === null || value >= band[0]) && (band[1] === null || value <= band[1]));
// The verdict of one measure: ci = [low, high] in the same unit as value and band.
export function verdictOf(value, ci, band, n, minN) {
  if (n < minN) return 'nodata';
  if (inBand(value, band)) return 'pass';
  const outside = (band[1] !== null && ci[0] > band[1]) || (band[0] !== null && ci[1] < band[0]);
  return outside ? 'fail' : 'watch';
}

function loadRuns(paths) {
  const runs = new Map();
  for (const path of paths) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const entry = JSON.parse(line); if (entry.ok) runs.set(entry.key, entry); else runs.delete(entry.key); } catch (error) { /* torn line */ }
    }
  }
  const byCase = new Map();
  for (const entry of runs.values()) { if (!byCase.has(entry.case)) byCase.set(entry.case, []); byCase.get(entry.case).push(entry); }
  return byCase;
}

function sumRow(runs, key) {
  const total = { kills: 0, killsHome: 0, killsAway: 0, killDistance: Array(7).fill(0), deaths: 0, deathsHome: 0, deathsAway: 0, deathDistance: Array(7).fill(0), damage: 0, enemyDamage: 0,
    selfDamage: 0, teamDamage: 0, splashKills: 0, shots: 0, owned: 0, drawn: 0, uses: 0, usesForced: 0, kpUses: 0, kpUsesForced: 0, touched: 0, touchedForced: 0, picks: 0 };
  for (const run of runs) {
    const row = run.rec.rows[key];
    if (!row) continue;
    for (const field in total) {
      if (Array.isArray(total[field])) row[field].forEach((value, i) => { total[field][i] += value; });
      else total[field] += row[field] || 0;
    }
  }
  return total;
}
const bucketSum = (counts, range) => counts.slice(range[0], range[1] + 1).reduce((sum, v) => sum + v, 0);
const percentOf = (pair) => pair.map((v) => v * 100);

export async function summarize(runsArg, outDir, file) {
  const paths = runsArg.split(',').map((p) => p.trim());
  const byCase = loadRuns(paths);
  const targets = await readTargets(outDir, file);
  const evals = [];
  const add = (family, caseId, metric, value, ci, band, n, minN, extra) => {
    evals.push({ family, case: caseId, metric, value: +value.toFixed(3), ci: ci.map((v) => +v.toFixed(3)), band, n, verdict: verdictOf(value, ci, band, n, minN), ...(extra || {}) });
  };
  const only = (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '').split(',').filter(Boolean);
  const runsOf = (id) => byCase.get(id) || [];
  const caseIds = [...byCase.keys()].sort();
  const classOfKey = new Map();
  for (const id of caseIds) for (const run of runsOf(id)) for (const key in run.rec.rows) if (key.startsWith('weapon:')) classOfKey.set(key, null);

  // ---- weapons (F2, F2b, F3a): the forced gun of each case ----
  const weaponClassOf = targets.weaponClassOf;
  const forcedWeapon = (runs) => { const f = runs[0].rec.spec.forced || {}; return f.melee || f.secondary || f.primary || null; };
  const rowMeasures = (family, id, runs, code) => {
    const key = 'weapon:' + code, cls = weaponClassOf[code], band = targets.weapons[cls];
    if (!band || !band.ewr) return;
    const row = sumRow(runs, key), n = row.kills + row.deaths;
    add(family, id, code + ' EWR %', n ? row.kills / n * 100 : 0, percentOf(wilson(row.kills, n)), band.ewr, n, targets.rule.minEngagements);
    const homeKills = band.homeBuckets ? bucketSum(row.killDistance, band.homeBuckets) : row.killsHome, homeDeaths = band.homeBuckets ? bucketSum(row.deathDistance, band.homeBuckets) : row.deathsHome;
    const awayKills = band.awayBuckets ? bucketSum(row.killDistance, band.awayBuckets) : row.killsAway, awayDeaths = band.awayBuckets ? bucketSum(row.deathDistance, band.awayBuckets) : row.deathsAway;
    // Range edge (revised 2026-10-30, coordinator): no row loses at home (home EWR at least rangeEdge.homeMin) and none does better away than at home (home minus away at
    // least 0 points); the class pooled gap is judged below. The old "home 55 % or more, away 45 % or less" cannot hold for every row (both sides of a fight are measured).
    if (band.home) {
      const homeN = homeKills + homeDeaths, awayN = awayKills + awayDeaths, home = homeN ? homeKills / homeN * 100 : 0, away = awayN ? awayKills / awayN * 100 : 0;
      add(family, id, code + ' home EWR %', home, percentOf(wilson(homeKills, homeN)), [targets.rangeEdge.homeMin, null], homeN, SPLIT_MIN);
      if (band.away) {
        const se = Math.sqrt((homeN ? home * (100 - home) / homeN : 0) + (awayN ? away * (100 - away) / awayN : 0));
        add(family, id, code + ' range edge (home - away, points)', home - away, [home - away - Z * se, home - away + Z * se], [targets.rangeEdge.rowMin, null], Math.min(homeN, awayN), SPLIT_MIN);
      }
    }
    const caseRate = (() => { let k = 0, d = 0; for (const r of runs) for (const rk in r.rec.rows) if (rk.startsWith('weapon:')) { k += r.rec.rows[rk].kills; d += r.rec.rows[rk].drawn; } return d ? k / d : 0; })();
    const perRun = runs.map((r) => { const x = r.rec.rows[key]; if (!x || !x.drawn) return null; let k = 0, d = 0; for (const rk in r.rec.rows) if (rk.startsWith('weapon:')) { k += r.rec.rows[rk].kills; d += r.rec.rows[rk].drawn; } return d ? (x.kills / x.drawn) / (k / d) : null; }).filter((v) => v !== null);
    if (band.kri && caseRate) add(family, id, code + ' KRI', mean(perRun), bootstrap(perRun), band.kri, perRun.length, 3);
    const heldRule = targets.heldShare, homeMapOnly = family !== 'F2' || !heldRule || !heldRule.homeOnly || homeMap(code) === id.split('-')[2];
    const heldBand = heldRule && heldRule.shortMagazine.includes(code) ? heldRule.shortMagazineBand : band.held;
    if (heldBand && homeMapOnly && row.owned > 0) add(family, id, code + ' held %', row.drawn / row.owned * 100, [row.drawn / row.owned * 100, row.drawn / row.owned * 100], heldBand, Math.round(row.owned), 120);
  };
  for (const id of caseIds) {
    const runs = runsOf(id);
    if (/^F2-W\d+-/.test(id)) rowMeasures('F2', id, runs, id.split('-')[1]);
    if (/^F2b-/.test(id)) {
      const code = id.split('-')[1], home = caseIds.find((c) => c.startsWith('F2-' + code + '-') && runsOf(c).length && runsOf(c)[0].rec.spec.map === runs[0].rec.spec.map);
      if (!home) continue;
      const a = sumRow(runs, 'weapon:' + code), b = sumRow(runsOf(home), 'weapon:' + code), na = a.kills + a.deaths, nb = b.kills + b.deaths;
      const pa = na ? a.kills / na : 0, pb = nb ? b.kills / nb : 0, se = Math.sqrt((na ? pa * (1 - pa) / na : 0) + (nb ? pb * (1 - pb) / nb : 0));
      const gap = (pa - pb) * 100;
      add('F2b', id, code + ' EWR gap to mixed tiers (points)', gap, [gap - Z * se * 100, gap + Z * se * 100], [-targets.skillGap, targets.skillGap], Math.min(na, nb), targets.rule.minEngagements);
    }
  }

  // ---- class rules over the F2 runs (RS01): kill shares, self damage, splash kills ----
  const f2 = caseIds.filter((id) => id.startsWith('F2-')).flatMap((id) => runsOf(id));
  if (f2.length) {
    const share = (classes, runsList) => {
      let kills = 0, all = 0;
      for (const run of runsList) { all += run.rec.totals.kills; for (const key in run.rec.rows) if (key.startsWith('weapon:') && classes.includes(weaponClassOf[key.slice(7)])) kills += run.rec.rows[key].kills; }
      return [kills, all];
    };
    const cr = targets.classRules;
    const byHand = f2.reduce((total, run) => total + (run.rec.totals.meleeKills || 0), 0), allKills = f2.reduce((total, run) => total + run.rec.totals.kills, 0);
    if (f2.some((run) => run.rec.totals.meleeKills !== undefined)) add('F2', 'class rules', 'kills by hand % (melee weapons and the quick melee, RS01)', allKills ? byHand / allKills * 100 : 0, percentOf(wilson(byHand, allKills)), cr.meleeKillShare, allKills, 150);
    for (const [cls, label, band] of [...(f2.some((run) => run.rec.totals.meleeKills !== undefined) ? [] : [['melee', 'melee kill share % (RS01)', cr.meleeKillShare]]), ['sidearm', 'sidearm kill share % (RS01)', [null, cr.sidearmKillShareMax]]]) {
      const [k, n] = share([cls], f2);
      add('F2', 'class rules', label, n ? k / n * 100 : 0, percentOf(wilson(k, n)), band, n, 150);
    }
    for (const map of ['spire', 'skyyard', 'gantry']) {
      const [k, n] = share(['sniper'], f2.filter((r) => r.rec.spec.map === map));
      add('F2', 'class rules', 'sniper kill share % on ' + map, n ? k / n * 100 : 0, percentOf(wilson(k, n)), [null, cr.sniperKillShareMax], n, 150);
    }
    let selfDamage = 0, damage = 0, splash = 0, kills = 0;
    for (const run of f2) { kills += run.rec.totals.kills; for (const key in run.rec.rows) if (key.startsWith('weapon:') && weaponClassOf[key.slice(7)] === 'explosive') { const r = run.rec.rows[key]; selfDamage += r.selfDamage; damage += r.damage; splash += r.splashKills; } }
    add('F2', 'class rules', 'explosive self damage % of class damage', damage ? selfDamage / damage * 100 : 0, percentOf(wilson(selfDamage, damage)), [null, cr.explosiveSelfDamageMax], Math.round(damage), 500);
    add('F2', 'class rules', 'splash kills % of all kills (RS01)', kills ? splash / kills * 100 : 0, percentOf(wilson(splash, kills)), [null, cr.splashKillShareMax], kills, 150);
    // the class gap: pooled home EWR minus pooled away EWR over the rows of a class (revised range-edge rule)
    const edge = {};
    for (const run of f2) for (const key in run.rec.rows) {
      if (!key.startsWith('weapon:')) continue;
      const cls = weaponClassOf[key.slice(7)], band = targets.weapons[cls], r = run.rec.rows[key];
      if (!band || !band.home) continue;
      const slot = (edge[cls] = edge[cls] || { hk: 0, hd: 0, ak: 0, ad: 0 });
      slot.hk += band.homeBuckets ? bucketSum(r.killDistance, band.homeBuckets) : r.killsHome; slot.hd += band.homeBuckets ? bucketSum(r.deathDistance, band.homeBuckets) : r.deathsHome;
      slot.ak += band.awayBuckets ? bucketSum(r.killDistance, band.awayBuckets) : r.killsAway; slot.ad += band.awayBuckets ? bucketSum(r.deathDistance, band.awayBuckets) : r.deathsAway;
    }
    for (const cls in edge) {
      const e = edge[cls], hn = e.hk + e.hd, an = e.ak + e.ad;
      if (!hn || !an) continue;
      const home = e.hk / hn * 100, away = e.ak / an * 100, se = Math.sqrt(home * (100 - home) / hn + away * (100 - away) / an);
      add('F2', 'class edge', cls + ' class range edge (pooled home - away, points)', home - away, [home - away - Z * se, home - away + Z * se], [targets.rangeEdge.classMinBy && targets.rangeEdge.classMinBy[cls] !== undefined ? targets.rangeEdge.classMinBy[cls] : targets.rangeEdge.classMin, null], Math.min(hn, an), 60);
    }
    // class means of the row EWRs
    const byClass = {};
    for (const e of evals) if (e.family === 'F2' && e.metric.endsWith(' EWR %') && e.n >= targets.rule.minEngagements) { const cls = weaponClassOf[e.metric.split(' ')[0]]; (byClass[cls] = byClass[cls] || []).push(e.value); }
    for (const cls in byClass) if (targets.weapons[cls].mean) add('F2', 'class mean', cls + ' class mean EWR %', mean(byClass[cls]), bootstrap(byClass[cls]), targets.weapons[cls].mean, byClass[cls].length, 2);
  }

  // ---- everything else is added by family modules as the waves bring data ----
  const { evaluateOthers } = await import('./balance-summary-others.mjs').catch(() => ({ evaluateOthers: null }));
  if (evaluateOthers) evaluateOthers({ byCase, runsOf, caseIds, targets, add, sumRow, evals, bootstrap, wilson, mean, percentOf });

  // ---- report ----
  const families = {};
  for (const e of evals) { const f = families[e.family] = families[e.family] || { pass: 0, watch: 0, fail: 0, nodata: 0 }; f[e.verdict]++; }
  const shown = evals.filter((e) => (e.verdict !== 'pass') && (!only.length || only.includes(e.family)));
  const label = { fail: 'FAIL ', watch: 'WATCH', nodata: 'NODATA' };
  if (process.argv.includes('--all')) for (const e of evals) shown.push(e);
  for (const e of shown.filter((x) => x.verdict !== 'nodata' || process.argv.includes('--nodata'))) {
    console.log(label[e.verdict].padEnd(6) + e.family.padEnd(4) + e.case.padEnd(18) + e.metric.padEnd(38) + String(e.value).padStart(8) + ' [' + e.ci.join(', ') + '] band ' + JSON.stringify(e.band) + ' n=' + e.n);
  }
  console.log('families: ' + Object.entries(families).map(([f, c]) => f + ' pass ' + c.pass + ' watch ' + c.watch + ' fail ' + c.fail + ' nodata ' + c.nodata).join(' | '));
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ families, evals }, null, 1));
  return Object.values(families).some((c) => c.fail) ? 1 : 0;
}

async function readTargets(outDir, file) {
  const cache = join(outDir, 'targets.json');
  const session = await openChrome({ flags: [] });
  try {
    await session.open(file);
    const targets = await session.evaluate('JSON.stringify(Object.assign({}, __CTK.balance.targets(), { weaponClassOf: Object.fromEntries(__CTK.catalogues.weapons.map((w) => [w.code, w.class])), '
      + 'abilityCategoryOf: Object.fromEntries(__CTK.catalogues.abilities.map((a) => [a.code, [a.category, a.cooldown, a.resource]])), abilityModes: Object.fromEntries(__CTK.catalogues.abilities.map((a) => [a.code, a.modes])), '
      + 'heroRole: Object.fromEntries(__CTK.catalogues.heroes.map((h) => [h.code, h.role])) }))');
    writeFileSync(cache, targets);
    return JSON.parse(targets);
  } finally { await session.close(); }
}
