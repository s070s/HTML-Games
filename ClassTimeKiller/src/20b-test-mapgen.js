// Self-tests for the S16 map generator (group 'mapgen'). Debug hooks: __CTK.mapgen (MapGen plus sweep(count) and parts()).
// Timing: "generation" is the generator's own work (kit geometry + placement, MapGen.last.ms.build + place); the scan and the
// validator are the S16 checker's cost and are reported on their own (docs/api/mapgen.md "Timings").

const MAPGEN_TEST_BUDGET_MS = 100;            // generation of the largest size on a desktop (500 ms on a low-end phone)
const MAPGEN_TEST_SWEEP_SEEDS = 49;           // per grid generator (GN1..GN4) in the 200-seed sweep, all small
const MAPGEN_TEST_ISLAND_SEEDS = 4;           // GN5 seeds in the sweep (its validator run takes about 0.3 s)
const MAPGEN_TEST_MATCH_SECONDS = 4;
const MAPGEN_TEST_REPAIRED = { generator: 'GN2', seed: 3, size: 'medium', uncapped: true };   // a seed whose first build has long sightlines

const mapgenTestMs = (report) => report.ms.build + report.ms.place;
// Runs some of the validator's rules (MapCheck) on a map: the cheap ones, without the lane and sightline searches.
function mapgenTestRules(map, rules) {
  const ctx = { map, problems: [], counts: {}, stats: {}, scan: MapScan.of(map), loop: null, hit: makeHit() };
  ctx.add = (rule, text) => ctx.problems.push(rule + ': ' + text);
  ctx.loop = MapCheck.mainLoop(ctx);
  for (const rule of rules) MapCheck[rule](ctx);
  MapScan.release();
  return ctx.problems;
}

DebugApi.mapgen = Object.assign(Object.create(MapGen), {
  parts: () => ({ MapScan, MapCheck, MapGenPlace, MapGenKits }),     // for console debugging of a generated map
  // Validates `count` seeds spread over GN1..GN5 and every size: accepted / repaired / fallback counts and the slowest runs.
  sweep(count) {
    const total = count || 100, result = { total, accepted: 0, retried: 0, repaired: 0, fallback: 0, slowestMs: 0, slowest: '', slowestGenerationMs: 0, slowestScanMs: 0, failures: [] };
    for (let i = 0; i < total; i++) {
      const generator = CAT.generators[i % CAT.generators.length], size = CAT.mapSizes[Math.floor(i / CAT.generators.length) % CAT.mapSizes.length];
      const map = MapGen.generate({ generator: generator.code, seed: 1000 + i, size: size.id, uncapped: true });
      const report = MapGen.last;
      if (report.fallback) { result.fallback++; result.failures.push(generator.code + ' ' + size.id + ' seed ' + (1000 + i) + ': ' + report.problems.slice(0, 2).join(' | ')); }
      else result.accepted++;
      if (report.attempts > 1) result.retried++;
      if (report.repairs) result.repaired++;
      if (report.ms.total > result.slowestMs) { result.slowestMs = Math.round(report.ms.total); result.slowest = map.code + ' ' + size.id; }
      result.slowestGenerationMs = Math.max(result.slowestGenerationMs, Math.round(mapgenTestMs(report) / report.attempts));
      result.slowestScanMs = Math.max(result.slowestScanMs, Math.round(report.ms.scan / report.attempts));
    }
    return result;
  },
});

// Determinism (MAP-020): the same options give the same map, byte for byte; another seed gives another map.
Test.add('mapgen', (check) => {
  for (const generator of CAT.generators) {
    const options = { generator: generator.code, seed: 77, size: 'small', density: 'dense', trusted: generator.code === 'GN5' };   // GN5: placement only (its validation is slow)
    const first = JSON.stringify(MapGen.generate(options)), firstReport = MapGen.last;
    const second = JSON.stringify(MapGen.generate(options));
    check(generator.code + ': the same options give a byte-identical map', first === second && !firstReport.fallback, firstReport.problems.slice(0, 2).join(' | '));
    const other = JSON.stringify(MapGen.generate(Object.assign({}, options, { seed: 78 })));
    check(generator.code + ': another seed gives another map', other !== first);
  }
  const map = MapGen.generate({ generator: 'GN3', seed: 5, size: 'small', theme: 'foundry' });
  check('the map records how it was made', map.gen && map.gen.generator === 'GN3' && map.gen.theme === 'foundry' && map.gen.requestedSeed === 5 && map.seed === 5);
});

// 200 seeds over the generators: every one validates (after retries and repairs) or the fallback is reported, all within budget.
Test.add('mapgen', (check) => {
  const tally = { total: 0, accepted: 0, fallback: 0, repaired: 0, retried: 0, slowest: 0, unreported: [] };
  const run = (code, seed) => {
    const map = MapGen.generate({ generator: code, seed, size: 'small' }), report = MapGen.last;
    tally.total++;
    tally.slowest = Math.max(tally.slowest, mapgenTestMs(report) / report.attempts);
    if (report.repairs) tally.repaired++;
    if (report.attempts > 1) tally.retried++;
    if (report.fallback) tally.fallback++;
    else tally.accepted++;
    if (report.fallback ? !map || map.gen : report.problems.length) tally.unreported.push(code + ' ' + seed);
  };
  for (const code of ['GN1', 'GN2', 'GN3', 'GN4']) for (let seed = 0; seed < MAPGEN_TEST_SWEEP_SEEDS; seed++) run(code, 500 + seed * 37);
  for (let seed = 0; seed < MAPGEN_TEST_ISLAND_SEEDS; seed++) run('GN5', 900 + seed);
  check('sweep: 200 seeds', tally.total === 200, tally.total);
  check('sweep: every seed is accepted with zero problems or falls back to an authored map', tally.unreported.length === 0, tally.unreported.join(', '));
  check('sweep: at least 95% accepted without the fallback', tally.accepted >= tally.total * 0.95, JSON.stringify(tally));
  check('sweep: generation within ' + MAPGEN_TEST_BUDGET_MS + ' ms per seed', tally.slowest < MAPGEN_TEST_BUDGET_MS, tally.slowest.toFixed(1));
});

// The largest size of every generator stays within the budget (generation only; scan time is reported).
Test.add('mapgen', (check) => {
  for (const generator of CAT.generators) {
    MapGen.generate({ generator: generator.code, seed: 3, size: 'large', uncapped: true, trusted: true });
    const report = MapGen.last;
    check(generator.code + ' large: generation under ' + MAPGEN_TEST_BUDGET_MS + ' ms', mapgenTestMs(report) < MAPGEN_TEST_BUDGET_MS && !report.fallback,
      'build ' + report.ms.build.toFixed(1) + ' place ' + report.ms.place.toFixed(1) + ' scan ' + report.ms.scan.toFixed(1));
  }
});

// Mode-aware placement: every mode of every generator gets its spawns and required objectives (the validator's own rules).
Test.add('mapgen', (check) => {
  const failures = [];
  for (const generator of CAT.generators) {
    for (const mode of generator.modes) {
      const map = MapGen.generate({ generator: generator.code, seed: 11, size: 'small', mode, trusted: true });
      const problems = MapGen.last.fallback ? ['fell back'] : mapgenTestRules(map, ['spawns', 'objectives']);
      if (problems.length || map.modes.join() !== mode) failures.push(generator.code + ' ' + mode + ': ' + problems.slice(0, 2).join(' | '));
    }
  }
  check('every mode: spawns and required objectives placed', failures.length === 0, failures.slice(0, 4).join(' || '));
  for (const [code, mode] of [['GN2', 'payload'], ['GN3', 'ctf'], ['GN1', 'horde']]) {
    const map = MapGen.generate({ generator: code, seed: 4, size: 'small', mode });
    check(code + ' ' + mode + ': the full validator accepts the map', !MapGen.last.fallback && !MapGen.last.problems.length && map.gen.mode === mode, MapGen.last.problems.slice(0, 2).join(' | '));
  }
});

// A headless short match per generator: the world loads it, the nav graph builds and reaches everything, actors play without errors.
Test.add('mapgen', (check) => {
  for (const generator of CAT.generators) {
    const mode = generator.defaultModes[0];
    const map = generator.code === 'GN5' ? MapGen.ringIsle() : MapGen.generate({ generator: generator.code, seed: 21, size: 'small', mode });
    Game.start({ mode, map, seed: 1, bots: [{}, {}, {}, {}] });
    check(generator.code + ' ' + mode + ': the match plays on the generated map', Game.match.map === map && World.map === map && World.brushes.length > 0);
    check(generator.code + ': the nav graph builds and reaches every spawn, item and objective', Nav.nodeCount > 0 && Nav.validate(map).length === 0, Nav.validate(map).slice(0, 3).join(' | '));
    const ids = [];
    for (let id = 0; id < Actors.count; id++) if (Modes.participant[id]) ids.push(id);
    map.spawns.forEach((spawn, index) => {          // scripted actors (no bot brains yet): walk the spawns in turn
      const id = ids[index % ids.length];
      Actors.x[id] = spawn.x; Actors.y[id] = spawn.y; Actors.z[id] = spawn.z;
      Sim.step();
    });
    Sim.run(Math.round(MAPGEN_TEST_MATCH_SECONDS * TICK_RATE));
    check(generator.code + ': participants spawned and the match ran', ids.length > 0 && Sim.tick > 0 && (Modes.active || Game.match.ended), ids.length);
    Game.stop();
  }
});

// Registration: generated maps are found by id, offered for their modes and playable by id; the registry stays bounded.
Test.add('mapgen', (check) => {
  const map = MapGen.generate({ generator: 'GN3', seed: 31, size: 'small', mode: 'ffa' });
  check('runtime: Maps.get finds the generated map by id', Maps.get(map.id) === map);
  check('runtime: Maps.forMode offers it', Maps.forMode('ffa').includes(map) && !Maps.forMode('ctf').includes(map));
  Game.start({ mode: 'ffa', map: map.id, seed: 1 });
  check('runtime: Game.start({ map: id }) plays it', Game.match.map === map);
  Game.stop();
  for (let seed = 0; seed < MAPS_RUNTIME_KEEP + 2; seed++) MapGen.generate({ generator: 'GN3', seed: 40 + seed, size: 'small', mode: 'duel' });
  MapGen.generate({ generator: 'GN3', seed: 31, size: 'small', mode: 'ffa' });
  const trusted = MapGen.generate({ generator: 'GN3', seed: 60, size: 'small', mode: 'duel', trusted: true });
  check('runtime: the registry keeps the latest maps only, one entry per id', Maps.runtime.length <= MAPS_RUNTIME_KEEP && new Set(Maps.runtime.map((row) => row.id)).size === Maps.runtime.length);
  check('runtime: hand-made maps are untouched', Maps.get('spire') === CAT.maps.byId('spire') && !CAT.maps.some((row) => row.gen));
  check('runtime: trusted runs (the MP09 island) are not registered', !Maps.runtime.includes(trusted) && Maps.get(trusted.id) !== trusted);
});

// Size caps per quality tier, options and the share code.
Test.add('mapgen', (check) => {
  check('caps: potato offers small only', MapGen.sizeCap('potato').id === 'small');
  check('caps: low offers medium', MapGen.sizeCap('low').id === 'medium');
  check('caps: medium and up offer large', ['medium', 'high', 'ultra'].every((tier) => MapGen.sizeCap(tier).id === 'large'));
  check('caps: a large request on potato is cut to small', MapGen.resolve({ generator: 'GN1', size: 'large', quality: 'potato' }).size.id === 'small');
  check('caps: uncapped keeps the size', MapGen.resolve({ generator: 'GN1', size: 'large', quality: 'potato', uncapped: true }).size.id === 'large');
  const options = { generator: 'GN4', seed: 4242, size: 'medium', theme: 'glacier', density: 'sparse', mode: 'tdm' };
  const code = MapGen.shareCode(options);
  const parsed = MapGen.parseShare(code);
  check('share: the code reads back as the same options', code === 'CTKMAP-GN4-medium-glacier-sparse-tdm-4242' && Object.keys(options).every((key) => parsed[key] === options[key]), code);
  check('share: any mode reads back as no mode', MapGen.parseShare('CTKMAP-GN1-small-glacier-normal-any-9').mode === '');
  check('share: broken codes are refused', ['', 'CTKMAP-GN9-small-glacier-normal-any-9', 'CTKMAP-GN1-huge-frost-normal-any-9', 'CTKMAP-GN1-small-glacier-normal-ctf-9',
    'CTKMAP-GN1-small-glacier-normal-any-x', 'MAP-GN1-small-glacier-normal-any-9'].every((text) => MapGen.parseShare(text) === null));
  check('options: unknown values fall back to the defaults', MapGen.resolve({ generator: 'nope', size: 'huge', density: 'x', mode: 'nope', uncapped: true }).generator === CAT.generators[0]);
  check('options: a missing theme is picked from the seed', MapGen.resolve({ generator: 'GN2', seed: 9 }).theme === MapGen.resolve({ generator: 'GN2', seed: 9 }).theme);
});

// Sightline repair: a seed whose first build has long open lines gets pillars and then validates.
Test.add('mapgen', (check) => {
  const map = MapGen.generate(MAPGEN_TEST_REPAIRED), report = MapGen.last;
  const plain = MapGen.generate(Object.assign({ trusted: true }, MAPGEN_TEST_REPAIRED));
  check('repair: pillars were added and the map validates', report.repairs > 0 && !report.fallback && report.attempts === 1 && !report.problems.length, JSON.stringify(report.problems.slice(0, 2)));
  check('repair: the repaired map has more brushes than the first build', map.brushes.length > plain.brushes.length);
});

// The fallback: when no seed can be placed, the generator's authored map (or one for the mode) is served and reported.
Test.add('mapgen', (check) => {
  const run = MapGenPlace.run;
  MapGenPlace.run = () => false;
  let map = null, report = null;
  try {
    map = MapGen.generate({ generator: 'GN3', seed: 1, size: 'small', mode: 'ffa' });
    report = MapGen.last;
  } finally {
    MapGenPlace.run = run;
  }
  check('fallback: five seeds tried, then the authored map', report.fallback && report.attempts === MAPGEN_ATTEMPTS && map === Maps.get('spire') && !map.gen, map && map.id);
  MapGenPlace.run = () => false;
  try { map = MapGen.generate({ generator: 'GN3', seed: 1, size: 'small', mode: 'ctf' }); } finally { MapGenPlace.run = run; }
  check('fallback: a mode the authored map lacks gets another authored map that offers it', map && map.modes.includes('ctf') && !map.gen, map && map.id);
});

// MP09 Ring Isle is GN5 with the default seed: it validates clean and replaces the placeholder in a royale match.
Test.add('mapgen', (check) => {
  const isle = MapGen.ringIsle(), problems = Maps.validate(isle);
  check('MP09: the island keeps the catalogue id and code', isle.id === 'isle' && isle.code === 'MP09' && !isle.placeholder && isle.gen.generator === 'GN5');
  check('MP09: the trusted default island validates with zero problems', problems.length === 0, problems.slice(0, 3).join(' | '));
  check('MP09: 48 loot spots and the royale ring', isle.items.length >= 48 && isle.ring && isle.ring.radius > 0, isle.items.length);
  check('MP09: the same island every time', MapGen.ringIsle() === isle);
  Game.start({ mode: 'royale', map: 'isle', seed: 1, bots: [{}, {}] });
  check('MP09: a royale match on the placeholder plays the island', Game.match.map === isle && World.map === isle);
  Game.stop();
});
