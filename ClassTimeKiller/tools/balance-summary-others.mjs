// The families of the P8-01 comparison beyond the F2 weapon rows (called by balance-summary.mjs): F0 follow-ups, F3 rulesets, F5 gadgets,
// F6 powerups, F7 abilities, F8 ability x profile, F9 heroes, F10 fairness, and the fairness counter of every run (B12).
const GADGET_SLOT = {};
for (const code of 'G01 G04 G06'.split(' ')) GADGET_SLOT[code] = 'lethal';
for (const code of 'G02 G03 G07 G08 G09 G20'.split(' ')) GADGET_SLOT[code] = 'tactical';
for (const code of 'G10 G13 G15 G18 G21 G22 G23 G24'.split(' ')) GADGET_SLOT[code] = 'device';
const ASYMMETRIC = ['bomb', 'ghostops', 'rush', 'payload', 'infection', 'fiends', 'juggernaut', 'cursetag'];
const SPREAD_MIN_ENGAGEMENTS = 60;
const PACE_MODES = ['ffa', 'tdm', 'dom', 'hardpoint', 'attrition', 'oddball', 'juggernaut', 'cursetag', 'bearer', 'roulette'];   // the kill and zone modes B6 judges
const ARENA_MAPS = ['spire', 'skyyard'];
const PROFILES = { EP1: 'close burst', EP2: 'close sustained', EP3: 'mid precision', EP4: 'long precision', EP5: 'area' };

export function evaluateOthers(context) {
  const { runsOf, caseIds, targets, add, sumRow, evals, bootstrap, wilson, mean, percentOf } = context;
  const sum = (runs, pick) => runs.reduce((total, run) => total + pick(run.rec), 0);
  const pct = (k, n) => (n ? k / n * 100 : 0);

  // ---- B12 and the fairness counter, every run ----
  for (const family of ['F0', 'F2', 'F2b', 'F3a', 'F3b', 'F3c', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10']) {
    const runs = caseIds.filter((id) => id.startsWith(family + '-')).flatMap((id) => runsOf(id)).filter((run) => run.rec.stats);
    if (!runs.length) continue;
    const bad = runs.filter((run) => run.rec.stats.unperceivedShots > 0 || run.rec.stats.unknownShots > 0);
    add(family, 'B12 all runs', 'runs with an unperceived or unknown bot shot', bad.length, [bad.length, bad.length], [0, 0], runs.length, 1, { runs: bad.slice(0, 5).map((run) => run.key) });
  }

  // ---- F3: weapons in the other rulesets (35-65 % per row, class means within 20 points per ruleset) ----
  const spreadByRuleset = {};
  for (const id of caseIds) {
    const match = /^(F3[abc])-(W\d+|[a-z]+)-(RS\d+|X41)$/.exec(id);
    if (!match) continue;
    const [, family, subject, ruleset] = match, runs = runsOf(id);
    let kills = 0, deaths = 0, weaponClass = subject;
    if (family === 'F3a') { const row = sumRow(runs, 'weapon:' + subject); kills = row.kills; deaths = row.deaths; weaponClass = targets.weaponClassOf[subject]; }
    else {
      for (const run of runs) for (const key in run.rec.rows) if (key.startsWith('weapon:') && targets.weaponClassOf[key.slice(7)] === subject && (run.rec.forcedTotals.actors > 0)) {
        kills += run.rec.rows[key].kills; deaths += run.rec.rows[key].deaths;
      }
    }
    add(family, id, subject + ' EWR % in ' + ruleset, pct(kills, kills + deaths), percentOf(wilson(kills, kills + deaths)), targets.rulesetEwr, kills + deaths, targets.rule.minEngagements);
    if (kills + deaths < SPREAD_MIN_ENGAGEMENTS) continue;   // a row with a handful of engagements says nothing about its class
    const bucket = (spreadByRuleset[ruleset] = spreadByRuleset[ruleset] || {});
    (bucket[weaponClass] = bucket[weaponClass] || []).push(pct(kills, kills + deaths));
  }
  for (const ruleset in spreadByRuleset) {
    const means = Object.entries(spreadByRuleset[ruleset]).map(([cls, values]) => [cls, mean(values)]);
    if (means.length < 3) continue;
    const high = Math.max(...means.map((pair) => pair[1])), low = Math.min(...means.map((pair) => pair[1]));
    add('F3a', ruleset, 'class mean EWR spread (points) in ' + ruleset, high - low, [high - low, high - low], [null, targets.rulesetClassSpread], means.length, 3, { means: Object.fromEntries(means.map(([c, v]) => [c, +v.toFixed(1)])) });
  }

  // ---- F5 gadgets, F7 abilities, F8 ability x profile, F9 heroes, F6 powerups: the carriers of a forced row ----
  const carrier = (runs) => {
    const percentile = runs.map((run) => run.rec.forcedTotals.percentile).filter((v, i) => runs[i].rec.forcedTotals.actors > 0);
    const kills = sum(runs, (rec) => rec.forcedTotals.kills), deaths = sum(runs, (rec) => rec.forcedTotals.deaths);
    return { csi: mean(percentile), ci: bootstrap(percentile), n: percentile.length, kills, deaths, spawns: sum(runs, (rec) => rec.forcedTotals.spawns), alive: sum(runs, (rec) => rec.forcedTotals.alive) };
  };
  // The carriers are always bots 0, 2 and 4 of a seed's roster, so an index is judged against the typical row of its family: 0.5 + (carrier - median of the family).
  // (A dedicated control case has only 4 runs and moved by +-0.1 between runs; the median of 30 rows is steadier and is the "no must-pick, no dead pick" rule itself.)
  const median = (values) => { const sorted = values.slice().sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0.5; };
  const familyMedian = (pattern) => median(caseIds.filter((id) => pattern.test(id) && runsOf(id).length).map((id) => carrier(runsOf(id)).csi));
  const medians = { 'F5-tdm': familyMedian(/^F5-G\d+-tdm$/), 'F5-dom': familyMedian(/^F5-G\d+-dom$/), F7: familyMedian(/^F7-A\d+$/) };
  for (const profile in PROFILES) medians['F8-' + profile] = familyMedian(new RegExp('^F8-A\\d+-' + profile + '$'));
  const control = (id) => { const key = id.startsWith('F5-CTRL-') ? 'F5-' + id.slice(8) : id.startsWith('F8-CTRL-') ? 'F8-' + id.slice(8) : 'F7'; return { csi: medians[key], kills: 0, deaths: 0 }; };
  const adjust = (c, ctrl) => (ctrl ? { ...c, csi: c.csi - ctrl.csi + 0.5, ci: c.ci.map((v) => v - ctrl.csi + 0.5), ctrl } : c);
  for (const id of caseIds) {
    const runs = runsOf(id), match = /^F5-(G\d+)-(tdm|dom)$/.exec(id);
    if (!match) continue;
    const code = match[1], slot = GADGET_SLOT[code], band = targets.gadgets[slot], key = 'gadget:' + code, row = sumRow(runs, key);
    const c = adjust(carrier(runs), control('F5-CTRL-' + match[2]));
    add('F5', id, code + ' carrier CSI (control-adjusted)', c.csi, c.ci, targets.csi, c.n, 3);
    add('F5', id, code + ' uses per life', row.usesForced / Math.max(1, c.spawns), [row.usesForced / Math.max(1, c.spawns)], [band.use, null], c.spawns, 20);
    add('F5', id, code + ' KP5 %', pct(row.kpUsesForced, row.usesForced), percentOf(wilson(row.kpUsesForced, row.usesForced)), band.kp, row.usesForced, targets.rule.minUses);
    if (slot === 'lethal') {
      const perUse = row.usesForced ? row.enemyDamage / row.uses : 0, own = row.damage ? (row.selfDamage + row.teamDamage) / row.damage * 100 : 0;
      add('F5', id, code + ' enemy damage per use', perUse, [perUse, perUse], targets.gadgets.lethalDamage[{ G01: 'frag', G04: 'incendiary', G06: 'sticky' }[code]], row.uses, targets.rule.minUses);
      add('F5', id, code + ' own damage % of its damage', own, [own, own], [null, targets.gadgets.ownDamageMax], Math.round(row.damage), 100);
    }
    if (slot === 'tactical') add('F5', id, code + ' enemies touched per use', row.uses ? row.touchedForced / row.usesForced : 0, [0, 0], [targets.gadgets.tacticalTouched, null], row.usesForced, targets.rule.minUses);
  }
  for (const id of caseIds) {
    const match = /^F6-(PU\d+)$/.exec(id);
    if (!match) continue;
    const runs = runsOf(id), code = match[1], kills = sum(runs, (rec) => rec.grant.kills), deaths = sum(runs, (rec) => rec.grant.deaths);
    const ctrlRuns = runsOf('F6-CTRL'), ctrlKd = ctrlRuns.length ? sum(ctrlRuns, (rec) => rec.grant.kills) / Math.max(1, sum(ctrlRuns, (rec) => rec.grant.deaths)) : 1;   // K/D of the same bots with nothing granted
    const wide = targets.powerups.wide.includes({ PU01: 'fury', PU10: 'sigil' }[code]);
    if (!['PU18', 'PU19', 'PU20'].includes(code)) {
      // Revised 2026-10-30 (coordinator): damage and defence powerups keep the 1.3-3.0 K/D band; PU10 (no deaths while it runs, K/D has no meaning) is judged by kills per
      // activation; utility powerups (invisible, flight, melee, free ammo, reveal, boots) only have to leave the holder no worse off than the control (0.9 or more).
      const utility = ['PU04', 'PU06', 'PU09', 'PU11', 'PU13', 'PU14'].includes(code), spawns = sum(runs, (rec) => rec.forcedTotals.spawns);
      if (code === 'PU10') add('F6', id, code + ' kills per activation', kills / Math.max(1, spawns), [kills / Math.max(1, spawns)], [1.5, 6], spawns, 20);
      else add('F6', id, code + ' holder K/D while active (relative to the control)', (kills / Math.max(1, deaths)) / ctrlKd, [(kills / Math.max(1, deaths)) / ctrlKd], utility ? [0.9, null] : wide ? targets.powerups.kdWide : targets.powerups.kd, kills + deaths, targets.rule.minEngagements / 3);
      const tops = runs.filter((run) => run.rec.actors.some((a) => a.forced && a.percentile === 1)).length;
      // The harness grants the powerup at every spawn to 3 of 12 bots, so the holders top a match far more often than a map pickup would let them: judged against 75 %
      // (the control tops about 25-50 %), not the 35 % of the P8-01 text, which is about one pickup per two minutes.
      add('F6', id, code + ' holder tops the match % of matches', pct(tops, runs.length), percentOf(wilson(tops, runs.length)), [null, 75], runs.length, 4);
    }
  }
  const abilityMeta = targets.abilityCategoryOf;
  const abilityRows = new Map();
  for (const id of caseIds) {
    const match = /^F7-((?:FR-)?A\d+)$/.exec(id);
    if (!match) continue;
    const code = match[1].replace('FR-', ''), runs = runsOf(id), [category, cooldown, resource] = abilityMeta[code], ctrl = control('F7-CTRL'), c = adjust(carrier(runs), ctrl), row = sumRow(runs, 'ability:' + code);
    const control7 = runsOf('F7-CTRL').length ? carrier(runsOf('F7-CTRL')) : null, shift = control7 ? pct(control7.kills, control7.kills + control7.deaths) - 50 : 0;
    add('F7', id, code + ' carrier CSI (control-adjusted)', c.csi, c.ci, targets.csi, c.n, 3);
    add('F7', id, code + ' carrier EWR % (control-adjusted)', pct(c.kills, c.kills + c.deaths) - shift, percentOf(wilson(c.kills, c.kills + c.deaths)).map((v) => v - shift), targets.abilityEwr, c.kills + c.deaths, targets.rule.minEngagements);
    if (category === 'ultimate') {
      const per10 = c.alive ? row.usesForced / (c.alive / 600) : 0;
      add('F7', id, code + ' casts per 10 min per player', per10, [per10, per10], [1, 3], Math.round(c.alive), 600);
    } else if (['mobility', 'recon', 'control', 'sustain', 'offense'].includes(category) && resource === 'cooldown' && cooldown > 0 && code !== 'A16') {
      const rate = c.alive ? row.usesForced * cooldown / c.alive : 0;
      add('F7', id, code + ' use rate (casts x cooldown / alive)', rate, [rate, rate], targets.abilities.use, Math.round(c.alive), 300);
    }
    // revised 2026-10-30 (coordinator): recon rows turn what they reveal into kills at up to 60 % (reveals land on enemies the team is already fighting)
    const kpBand = category === 'recon' ? [15, 60] : targets.abilities.kp[category];
    if (kpBand) add('F7', id, code + ' KP5 %', pct(row.kpUsesForced, row.usesForced), percentOf(wilson(row.kpUsesForced, row.usesForced)), kpBand, row.usesForced, targets.rule.minUses);
    abilityRows.set(id, { code, csi: c.csi });
  }
  const byProfile = {};
  for (const id of caseIds) {
    const match = /^F8-(A\d+)-(EP\d)$/.exec(id);
    if (!match) continue;
    const runs = runsOf(id), c = adjust(carrier(runs), control('F8-CTRL-' + match[2]));
    add('F8', id, match[1] + ' carrier CSI with ' + match[2] + ' (control-adjusted)', c.csi, c.ci, [0.38, 0.62], c.n, 3);
    (byProfile[match[2]] = byProfile[match[2]] || []).push([match[1], c.csi]);
  }
  for (const profile in byProfile) {
    const values = byProfile[profile].map((pair) => pair[1]).sort((a, b) => a - b), median = values[Math.floor(values.length / 2)], best = values[values.length - 1];
    if (values.length >= 8) add('F8', profile, 'best CSI minus median (' + PROFILES[profile] + ')', best - median, [best - median, best - median], [null, targets.profileCsiSpread], values.length, 8,
      { best: byProfile[profile].find((pair) => pair[1] === best)[0] });
  }
  const roles = {};
  for (const id of caseIds) {
    const match = /^F9-(H\d+)$/.exec(id);
    if (!match) continue;
    const runs = runsOf(id), c = carrier(runs);
    add('F9', id, match[1] + ' carrier CSI', c.csi, c.ci, targets.heroCsi, c.n, 3);
    add('F9', id, match[1] + ' carrier EWR %', pct(c.kills, c.kills + c.deaths), percentOf(wilson(c.kills, c.kills + c.deaths)), targets.heroEwr, c.kills + c.deaths, targets.rule.minEngagements / 2);
    const role = targets.heroRole[match[1]];
    (roles[role] = roles[role] || { kills: 0, deaths: 0 }).kills += c.kills;
    roles[role].deaths += c.deaths;
  }
  for (const role in roles) add('F9', role, role + ' role EWR %', pct(roles[role].kills, roles[role].kills + roles[role].deaths), percentOf(wilson(roles[role].kills, roles[role].kills + roles[role].deaths)),
    targets.heroRoleMean, roles[role].kills + roles[role].deaths, targets.rule.minEngagements);

  // ---- F10 fairness ----
  const fair = targets.fairness, symmetric = [], teamCases = [];
  for (const id of caseIds) {
    if (!id.startsWith('F10-')) continue;
    const runs = runsOf(id), spec = runs[0].rec.spec, mode = spec.mode, ruleset = spec.ruleset;
    const decided = runs.filter((run) => run.rec.match.winner === 0 || run.rec.match.winner === 1), team0 = decided.filter((run) => run.rec.match.winner === 0).length;
    const isTeam = runs[0].rec.match.teams === 2, isSym = isTeam && !ASYMMETRIC.includes(mode) && !/^F10-RS/.test(id);
    const tolerance = (value, ci) => {
      const inside = value >= fair.sideWin[0] && value <= fair.sideWin[1];
      const verdict = inside ? 'pass' : (ci[1] < fair.sideWinTolerance[0] || ci[0] > fair.sideWinTolerance[1]) ? 'fail' : 'watch';
      return verdict;
    };
    if (isSym && decided.length >= 1) {
      const share = pct(team0, decided.length), ci = percentOf(wilson(team0, decided.length));
      add('F10', id, 'B1 side 0 win share %', share, ci, fair.sideWin, decided.length, targets.rule.minDecided);
      const last = evals[evals.length - 1];
      if (last.verdict !== 'nodata') last.verdict = tolerance(share, ci);
      symmetric.push(share);
      const rounds = runs.some((run) => run.rec.match.rounds > 0 && run.rec.match.teamRounds[0] + run.rec.match.teamRounds[1] > 0);
      const points = runs.map((run) => (rounds ? run.rec.match.teamRounds : run.rec.match.teamScore));
      const side0 = points.reduce((total, p) => total + p[0], 0), all = points.reduce((total, p) => total + p[0] + p[1], 0);
      add('F10', id, 'B2 side 0 score share %', pct(side0, all), percentOf(wilson(side0, all)), fair.scoreShare, all, 60);
    }
    if (isTeam && runs.some((run) => run.rec.half)) {
      const behind = runs.filter((run) => run.rec.half && run.rec.half.scores[0] !== run.rec.half.scores[1] && (run.rec.match.winner === 0 || run.rec.match.winner === 1));
      const comeback = behind.filter((run) => { const h = run.rec.half.scores; return run.rec.match.winner === (h[0] < h[1] ? 0 : 1); }).length;
      teamCases.push([comeback, behind.length]);
    }
    const deaths = sum(runs, (rec) => rec.totals.deaths), spawnDeaths = sum(runs, (rec) => rec.totals.spawnDeaths), arena = ARENA_MAPS.includes(spec.map);
    add('F10', id, 'B7 spawn deaths % of deaths', pct(spawnDeaths, deaths), percentOf(wilson(spawnDeaths, deaths)), [null, arena ? fair.spawnDeathShareArena : fair.spawnDeathShare], deaths, 150);
    if (!isTeam) {
      const points = {};
      for (const run of runs) for (const point in run.rec.spawnPoints) points[point] = (points[point] || 0) + run.rec.spawnPoints[point];
      const counts = Object.values(points);
      if (counts.length >= 4) { const avg = mean(counts), worst = Math.max(...counts); add('F10', id, 'B8 worst spawn point deaths / map mean', worst / avg, [worst / avg, worst / avg], [null, fair.spawnPointMax], counts.length, 4); }
    }
    const limit = runs[0].rec.match.timeLimit, scoreLimit = runs[0].rec.match.scoreLimit;
    if (PACE_MODES.includes(mode) && limit > 0 && scoreLimit > 0 && !runs[0].rec.match.rounds) {
      const good = runs.filter((run) => {
        const m = run.rec.match, byScore = m.ended && m.reason !== 'time' && m.duration / m.timeLimit >= fair.paceScoreEnd[0] && m.duration / m.timeLimit <= 1.001;
        const leader = Math.max(...(m.teams === 2 ? m.teamScore : run.rec.actors.map((a) => a.score)));
        return byScore || (scoreLimit > 0 && leader >= fair.paceLeader * scoreLimit);
      }).length;
      add('F10', id, 'B6 runs with a good pace % (by score in 50-100 % of the clock, or leader at 80 %)', pct(good, runs.length), percentOf(wilson(good, runs.length)), [50, null], runs.length, 4);
    }
  }
  if (symmetric.length >= 5) add('F10', 'B1 mean', 'B1 mean side 0 win share over symmetric cases %', mean(symmetric), bootstrap(symmetric), [47, 53], symmetric.length, 5);
  const [won, total] = teamCases.reduce((acc, pair) => [acc[0] + pair[0], acc[1] + pair[1]], [0, 0]);
  if (total) add('F10', 'B9 all team cases', 'B9 comeback: matches won by the side behind at half time %', pct(won, total), percentOf(wilson(won, total)), fair.comeback, total, 30);
  const rsCases = caseIds.filter((id) => /^F10-RS\d+$/.test(id));
  const durations = rsCases.map((id) => ({ id, value: mean(runsOf(id).map((run) => run.rec.match.duration)) }));
  if (durations.length >= 6) {
    const sorted = durations.map((d) => d.value).sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
    for (const d of durations) if (d.id !== 'F10-RS09') add('F10', d.id, 'B10 tdm harbor length / median of the rulesets', d.value / median, [d.value / median, d.value / median], fair.rulesetPace, runsOf(d.id).length, 4);
  }
}
