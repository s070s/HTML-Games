// Self-tests for the S16 map generator (group 'mapgen'). Debug hooks: __CTK.mapgen (MapGen plus sweep(count) and parts()).
// Timings (docs/api/mapgen.md "Timings"): generation = what one build round costs (kit geometry + scan + placement,
// MapGen.last.ms.build + scan + place per round); validation (Maps.validate) has its own budget; both per round, desktop.

const MAPGEN_TEST_BUDGET_MS = 100;            // generation per round at the largest size on a desktop (about 500 ms on a low-end phone)
const MAPGEN_TEST_VALIDATE_BUDGET_MS = 300;   // Maps.validate per round at the largest size on a desktop (the 300 m island: about 170 ms idle)
const MAPGEN_TEST_SPIKES = 0.02;              // share of sweep seeds allowed over a budget after one re-run (a busy machine); the largest-size test is strict
const MAPGEN_TEST_GRID_SEEDS = 48;            // per grid generator (GN1..GN4) in the 200-seed sweep
const MAPGEN_TEST_GRID_SIZES = ['small', 'small', 'medium', 'large'];
const MAPGEN_TEST_ISLAND_SIZES = ['small', 'small', 'small', 'small', 'small', 'medium', 'medium', 'large'];   // GN5 seeds of the sweep
const MAPGEN_TEST_MATCH_SECONDS = 4;
const MAPGEN_TEST_WALK_MIN = 3;               // metres every scripted walker must cover in the short match
const MAPGEN_TEST_REPATH_TICKS = 30;          // scripted walkers look up their nav path this often
const MAPGEN_TEST_FLOOR = -0.5;               // generated floors are at y = 0: an actor below this fell through
const MAPGEN_TEST_REPAIRED = { generator: 'GN2', seed: 3, size: 'medium', uncapped: true };   // a seed whose first build has long sightlines
const MAPGEN_TEST_NO_LIBM = ['Math.hypot', 'Math.sin', 'Math.cos', 'Math.atan2', 'Math.tan'];   // engine-dependent results (MAP-020 across devices)

// The budgets are desktop Chrome numbers. Another engine (or a slower machine) gets them scaled by how much slower it runs a fixed plain
// workload (typed-array and number work like the generator's), measured once: a 2x regression of the generator still fails everywhere.
const MAPGEN_TEST_SPEED_REFERENCE_MS = 6;   // the workload's best time on desktop Chrome (Firefox about 9 ms, Safari about 5 ms)
let mapgenTestSlowdown = 0;
function mapgenTestWorkload() {
  const cells = new Float32Array(4096);
  let sum = 0;
  for (let pass = 0; pass < 400; pass++) {
    for (let i = 0; i < cells.length; i++) { cells[i] = Math.sqrt(i + pass) * 0.5 + cells[(i + 7) & 4095]; sum += cells[i] > 100 ? 1 : 0; }
  }
  return sum;
}
function mapgenTestBudget(milliseconds) {
  if (!mapgenTestSlowdown) {
    let fastest = Infinity;
    for (let run = 0; run < 5; run++) { const started = performance.now(); mapgenTestWorkload(); fastest = Math.min(fastest, performance.now() - started); }
    mapgenTestSlowdown = Math.max(1, fastest / MAPGEN_TEST_SPEED_REFERENCE_MS);
  }
  return milliseconds * mapgenTestSlowdown;
}
// Per-round costs of the latest generate(): { generation, validation, total } in ms.
function mapgenTestCost(report) {
  const rounds = Math.max(1, report.rounds);
  return { generation: (report.ms.build + report.ms.scan + report.ms.place) / rounds, validation: report.ms.validate / rounds, total: report.ms.total };
}
function mapgenTestRules(map, rules) {
  const ctx = { map, problems: [], counts: {}, stats: {}, scan: MapScan.of(map), loop: null, hit: makeHit() };
  ctx.add = (rule, text) => ctx.problems.push(rule + ': ' + text);
  ctx.loop = MapCheck.mainLoop(ctx);
  for (const rule of rules) MapCheck[rule](ctx);
  MapScan.release();
  return ctx.problems;
}
// One fully validated generate() for the sweeps: adds to the tally { total, accepted, fallback, repaired, retried, slowest..., over, unreported }.
function mapgenTestSweepRun(tally, options) {
  const map = MapGen.generate(Object.assign({ uncapped: true }, options)), report = MapGen.last, cost = mapgenTestCost(report);
  const label = options.generator + ' ' + options.size + ' ' + options.seed;
  if (mapgenTestOver(cost)) mapgenTestRetime(cost, options);
  tally.total++;
  if (report.fallback) tally.fallback++;
  else tally.accepted++;
  if (report.repairs) tally.repaired++;
  if (report.attempts > 1) tally.retried++;
  if (report.fallback ? !map || map.gen : report.problems.length) tally.unreported.push(label + ': ' + report.problems.slice(0, 2).join(' | '));
  if (mapgenTestOver(cost)) tally.over.push(label);
  if (cost.generation > tally.slowestGeneration) { tally.slowestGeneration = cost.generation; tally.slowestGenerationMap = label; }
  if (cost.validation > tally.slowestValidation) { tally.slowestValidation = cost.validation; tally.slowestValidationMap = label; }
  if (cost.total > tally.slowestTotal) { tally.slowestTotal = cost.total; tally.slowestTotalMap = label; }
  return map;
}
const mapgenTestOver = (cost) => cost.generation > mapgenTestBudget(MAPGEN_TEST_BUDGET_MS) || cost.validation > mapgenTestBudget(MAPGEN_TEST_VALIDATE_BUDGET_MS);
// A seed over budget runs once more and keeps the faster costs: a pause of the machine (or a collection) is not the generator's.
function mapgenTestRetime(cost, options) {
  MapGen.generate(Object.assign({ uncapped: true }, options));
  const again = mapgenTestCost(MapGen.last);
  for (const key of ['generation', 'validation', 'total']) cost[key] = Math.min(cost[key], again[key]);
}
function mapgenTestTally() {
  return { total: 0, accepted: 0, fallback: 0, repaired: 0, retried: 0, slowestGeneration: 0, slowestGenerationMap: '', slowestValidation: 0, slowestValidationMap: '',
    slowestTotal: 0, slowestTotalMap: '', over: [], unreported: [] };
}

DebugApi.mapgen = Object.assign(Object.create(MapGen), {
  parts: () => ({ MapScan, MapCheck, MapGenPlace, MapGenKits }),     // for console debugging of a generated map
  // Validates `count` seeds (1000, 1001, ...) spread over GN1..GN5 and every size; counts and the slowest runs (ms per round).
  sweep(count) {
    const tally = mapgenTestTally();
    for (let i = 0; i < (count || 100); i++) {
      const generator = CAT.generators[i % CAT.generators.length], size = CAT.mapSizes[Math.floor(i / CAT.generators.length) % CAT.mapSizes.length];
      mapgenTestSweepRun(tally, { generator: generator.code, seed: 1000 + i, size: size.id });
    }
    return tally;
  },
});

// Determinism (MAP-020): the same options give the same map, byte for byte; another seed gives another map.
Test.add('mapgen', (check) => {
  for (const generator of CAT.generators) {
    const options = { generator: generator.code, seed: 77, size: 'small', density: 'dense', trusted: generator.code === 'GN5' };   // GN5: placement only (the sweep validates it)
    const first = JSON.stringify(MapGen.generate(options)), firstReport = MapGen.last;
    const second = JSON.stringify(MapGen.generate(options));
    check(generator.code + ': the same options give a byte-identical map', first === second && !firstReport.fallback, firstReport.problems.slice(0, 2).join(' | '));
    const other = JSON.stringify(MapGen.generate(Object.assign({}, options, { seed: 78 })));
    check(generator.code + ': another seed gives another map', other !== first);
  }
  const map = MapGen.generate({ generator: 'GN3', seed: 5, size: 'small', theme: 'foundry' });
  check('the map records how it was made', map.gen && map.gen.generator === 'GN3' && map.gen.theme === 'foundry' && map.gen.requestedSeed === 5 && map.seed === 5);
});

// Same map on every engine: placement and the kits never call the engine-dependent maths functions, and the fixed direction
// tables match the trigonometry they replace.
Test.add('mapgen', (check) => {
  const sources = [MapGenPlace, MapGenKits, MapGen].flatMap((part) => Object.values(part).filter((value) => typeof value === 'function').map(String))
    .concat([mapgenEach, mapgenProp, mapgenRamp, mapgenBorder, mapgenCellProps, mapgenEmitFloorRow].map(String));
  const used = MAPGEN_TEST_NO_LIBM.filter((name) => sources.some((source) => source.includes(name)));
  check('engines: no hypot, sin, cos, atan2 or tan in the generator', used.length === 0, used.join());
  const ringOk = MAPGEN_RING.every(([x, z], index) => Math.abs(x - Math.cos(index * Math.PI / 8)) < 1e-15 && Math.abs(z - Math.sin(index * Math.PI / 8)) < 1e-15);
  const yawOk = MAPGEN_YAWS.every(([x, z], index) => Math.abs(x - Math.sin(index * Math.PI / 4)) < 1e-15 && Math.abs(z - Math.cos(index * Math.PI / 4)) < 1e-15);
  check('engines: the 16 ring directions and the 8 spawn yaws match the trigonometry', ringOk && yawOk && MAPGEN_RING.length === MAP_SIGHT_DIRECTIONS);
});

// 200 seeds over the generators and the sizes, every one through the whole pipeline: validated with zero problems (after retries
// and repairs) or reported as the fallback, and within the generation and validation budgets.
Test.add('mapgen', (check) => {
  const tally = mapgenTestTally();
  for (const code of ['GN1', 'GN2', 'GN3', 'GN4']) {
    for (let i = 0; i < MAPGEN_TEST_GRID_SEEDS; i++) mapgenTestSweepRun(tally, { generator: code, seed: 500 + i * 37, size: MAPGEN_TEST_GRID_SIZES[i % MAPGEN_TEST_GRID_SIZES.length] });
  }
  MAPGEN_TEST_ISLAND_SIZES.forEach((size, i) => mapgenTestSweepRun(tally, { generator: 'GN5', seed: 900 + i, size }));
  const summary = JSON.stringify(Object.assign({}, tally, { unreported: tally.unreported.length, over: tally.over.length }));
  check('sweep: 200 seeds, all sizes', tally.total === 200, tally.total);
  check('sweep: every seed passes Maps.validate with zero problems or falls back to an authored map', tally.unreported.length === 0, tally.unreported.slice(0, 3).join(' || '));
  check('sweep: at least 95% accepted without the fallback', tally.accepted >= tally.total * 0.95, summary);
  check('sweep: generation under ' + MAPGEN_TEST_BUDGET_MS + ' ms and validation under ' + MAPGEN_TEST_VALIDATE_BUDGET_MS + ' ms per round',
    tally.over.length <= tally.total * MAPGEN_TEST_SPIKES, tally.over.join(', ') + ' ' + summary);
});

// The largest size of every generator, fully validated, within both budgets (the faster of two runs: the budget is not a load test).
Test.add('mapgen', (check) => {
  for (const generator of CAT.generators) {
    const runs = [0, 1].map(() => {
      MapGen.generate({ generator: generator.code, seed: 3, size: 'large', uncapped: true });
      return Object.assign(mapgenTestCost(MapGen.last), { fallback: MapGen.last.fallback, problems: MapGen.last.problems.length });
    });
    const generation = Math.min(runs[0].generation, runs[1].generation), validation = Math.min(runs[0].validation, runs[1].validation);
    check(generator.code + ' large: generation under ' + MAPGEN_TEST_BUDGET_MS + ' ms and validation under ' + MAPGEN_TEST_VALIDATE_BUDGET_MS + ' ms per round',
      generation < mapgenTestBudget(MAPGEN_TEST_BUDGET_MS) && validation < mapgenTestBudget(MAPGEN_TEST_VALIDATE_BUDGET_MS) && !runs[0].fallback && !runs[0].problems,
      'generation ' + generation.toFixed(1) + ' validation ' + validation.toFixed(1) + ' total ' + runs[1].total.toFixed(1));
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

// Mirrored maps: every team 0 spawn has a team 1 spawn at its mirror image facing the mirrored way (MapKit.mirrorSpawn), and
// every free spawn of a mirrored free-for-all map has its mirror too.
Test.add('mapgen', (check) => {
  for (const [code, mode] of [['GN3', 'tdm'], ['GN4', 'ctf'], ['GN2', 'bomb'], ['GN3', 'ffa']]) {
    const map = MapGen.generate({ generator: code, seed: 8, size: 'small', mode, trusted: true });
    const teamOf = (spawn) => (spawn.team === -1 ? -1 : 1 - spawn.team);
    const mirrored = (spawn) => map.spawns.some((other) => other !== spawn && other.team === teamOf(spawn) && other.x === -spawn.x && other.y === spawn.y && other.z === spawn.z
      && Math.abs(Math.sin(other.yaw * DEG) + Math.sin(spawn.yaw * DEG)) < 1e-9 && Math.abs(Math.cos(other.yaw * DEG) - Math.cos(spawn.yaw * DEG)) < 1e-9);
    const lonely = map.spawns.filter((spawn) => !mirrored(spawn));
    check(code + ' ' + mode + ': every spawn has its mirror image with the mirrored yaw', map.spawns.length > 0 && lonely.length === 0, lonely.length + ' of ' + map.spawns.length);
    const facing = mapgenTestRules(map, ['spawns']).filter((problem) => problem.startsWith('spawn-facing'));
    check(code + ' ' + mode + ': no spawn faces a wall', facing.length === 0, facing.slice(0, 2).join(' | '));
  }
});

// GN2 (MAP-021): spawn-to-site run time in the generator's window on the large map; smaller maps get the column nearest it.
Test.add('mapgen', (check) => {
  const window = MapGen.generator('GN2').siteWalk, speed = CAT.movement.byId(MAPGEN_SITE_PACE).groundSpeed;
  const inWindow = [], near = [];
  for (let seed = 1; seed <= 4; seed++) {
    const large = MapGen.generate({ generator: 'GN2', seed, size: 'large', mode: 'bomb', uncapped: true, trusted: true });
    inWindow.push(large.gen.siteSeconds.every((value) => value >= window[0] && value <= window[1]) ? '' : 'large ' + seed + ' ' + large.gen.siteSeconds);
    const medium = MapGen.generate({ generator: 'GN2', seed, size: 'medium', mode: 'ghostops', uncapped: true, trusted: true });
    near.push(medium.gen.siteSeconds.every((value) => value >= window[0] - 1.5) ? '' : 'medium ' + seed + ' ' + medium.gen.siteSeconds);
  }
  check('GN2 large: both sites ' + window.join('-') + ' s of running from the attackers spawn', inWindow.join('') === '', inWindow.join(' '));
  check('GN2 medium: both sites within 1.5 s of the window', near.join('') === '', near.join(' '));
  const small = MapGen.generate({ generator: 'GN2', seed: 2, size: 'small', mode: 'bomb', trusted: true });
  const sites = small.objectives.filter((objective) => objective.kind === 'bombsite'), lastColumn = MapGen.generator('GN2').cells[0][0] - 2;
  const columnX = -small.size[0] / 2 + (lastColumn + 0.5) * MapGen.generator('GN2').cell;
  check('GN2 small: too short for the window, so the sites use the farthest column short of the defender base',
    sites.length === 2 && sites.every((site) => Math.abs(site.x - columnX) < 6) && small.gen.siteSeconds[0] < window[0], JSON.stringify(small.gen.siteSeconds));
  check('GN2: the run time uses the tactical run speed', speed > 0 && Number.isFinite(small.gen.siteSeconds[0]));
});

// A headless short match per generator: the world loads it, the nav graph builds and reaches everything, and scripted walkers
// (no bot brains here) follow nav paths across the map without getting stuck or falling through the floor.
Test.add('mapgen', (check) => {
  for (const generator of CAT.generators) {
    const mode = generator.code === 'GN2' ? 'tdm' : generator.defaultModes[0];        // tdm: bomb rounds start frozen for the buy time
    const map = generator.code === 'GN5' ? MapGen.ringIsle() : MapGen.generate({ generator: generator.code, seed: 21, size: 'small', mode });
    Game.start({ mode, map, seed: 1, bots: [{}, {}, {}, {}] });
    check(generator.code + ' ' + mode + ': the match plays on the generated map', Game.match.map === map && World.map === map && World.brushes.length > 0);
    check(generator.code + ': the nav graph builds and reaches every spawn, item and objective', Nav.nodeCount > 0 && Nav.validate(map).length === 0, Nav.validate(map).slice(0, 3).join(' | '));
    const walk = mapgenTestWalk(map);
    check(generator.code + ': ' + walk.walkers + ' scripted walkers each cover ' + MAPGEN_TEST_WALK_MIN + ' m', walk.walkers > 0 && walk.stuck.length === 0, walk.stuck.join(', '));
    check(generator.code + ': nobody falls through the floor and the match keeps running', walk.lowest > MAPGEN_TEST_FLOOR && Sim.tick > 0 && (Modes.active || Game.match.ended), walk.lowest.toFixed(2));
    Game.stop();
  }
});
// Every participant but the player walks along nav paths toward a far point of interest for MAPGEN_TEST_MATCH_SECONDS.
function mapgenTestWalk(map) {
  const ids = [], travelled = [], goals = [], targets = map.items.concat(map.objectives, map.spawns);
  for (let id = 0; id < Actors.count; id++) if (Modes.participant[id] && Actors.alive[id] && id !== Game.playerId) ids.push(id);
  ids.forEach((id, index) => { goals.push(targets[(index * 7 + 3) % targets.length]); travelled.push(0); });
  let lowest = Infinity;
  for (let tick = 0; tick < Math.round(MAPGEN_TEST_MATCH_SECONDS * TICK_RATE); tick++) {
    if (tick % MAPGEN_TEST_REPATH_TICKS === 0) ids.forEach((id, index) => mapgenTestSteer(id, goals[index]));
    const before = ids.map((id) => [Actors.x[id], Actors.z[id]]);
    Sim.step();
    ids.forEach((id, index) => { travelled[index] += Math.hypot(Actors.x[id] - before[index][0], Actors.z[id] - before[index][1]); lowest = Math.min(lowest, Actors.y[id]); });
  }
  const stuck = [];
  ids.forEach((id, index) => { if (travelled[index] < MAPGEN_TEST_WALK_MIN) stuck.push('actor ' + id + ' ' + travelled[index].toFixed(1) + ' m'); });
  return { walkers: ids.length, stuck, lowest };
}
// Points the actor at the next nav path node toward the goal and walks forward.
function mapgenTestSteer(id, goal) {
  const from = Nav.nearestNode(Actors.x[id], Actors.y[id], Actors.z[id]), to = Nav.nearestNode(goal.x, goal.y, goal.z);
  const length = Nav.findPath(from, to);
  const next = length > 1 ? Nav.pathNodes[Math.min(2, length - 1)] : to;
  if (next < 0) return;
  Actors.aimYaw[id] = Math.atan2(Nav.nodeX[next] - Actors.x[id], Nav.nodeZ[next] - Actors.z[id]);
  Actors.moveX[id] = 0;
  Actors.moveZ[id] = 1;
}

// Registration: generated maps are found by id, offered for their modes and playable by id; the registry stays bounded.
Test.add('mapgen', (check) => {
  const map = MapGen.generate({ generator: 'GN3', seed: 31, size: 'small', mode: 'ffa' });
  check('runtime: Maps.get finds the generated map by id', Maps.get(map.id) === map);
  check('runtime: Maps.forMode offers it, Maps.savedForMode does not', Maps.forMode('ffa').includes(map) && !Maps.forMode('ctf').includes(map)
    && !Maps.savedForMode('ffa').includes(map) && Maps.savedForMode('ffa').length === CAT.maps.filter((row) => row.modes.includes('ffa')).length);
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

// The custom match lists and picks hand-made maps only: a generated map in the registry never shows up there, and a saved draft
// that names one renders and falls back to a random hand-made map.
Test.add('mapgen', (check) => {
  const map = MapGen.generate({ generator: 'GN3', seed: 5, size: 'small', mode: 'ffa' });
  const draft = Object.assign(customDefaults(), { mode: 'ffa', map: '' });
  check('custom: the map picker lists hand-made maps only', !editorMapOptions(draft).values.includes(map.id) && editorMapOptions(draft).values.length === Maps.savedForMode('ffa').length + 1);
  const picks = Array.from({ length: 40 }, (unused, seed) => CustomMatch.mapFor(draft, seed));
  check('custom: a random map is always a hand-made one', picks.every((id) => !!CAT.maps.byId(id)), picks.filter((id) => !CAT.maps.byId(id)).join());
  check('custom: a saved draft naming a generated map is refused on load', CustomMatch.validate({ mode: 'ffa', map: map.id }).draft.map === '');
  check('custom: the summary names a generated map without failing', editorSummary(Object.assign({}, draft, { map: map.id })).includes(map.name));
  const errorsBefore = ErrorLog.entries.length;
  uiWith(() => {
    Settings.set('custom.draft', '');
    Ui.open('custom');
    const root = Ui.root.querySelector('.ui-custom');
    uiClickButton(root, 'Map');
    const cycle = root.querySelector('.cm-list .ui-cycle');
    for (let step = 0; cycle && step < editorMapOptions(EDITOR_STATE.draft).values.length + 1; step++) cycle._adjust(1);
    const picked = EDITOR_STATE.draft.map;
    check('custom: the Map tab renders and cycles every map after a map was generated', !!cycle && ErrorLog.entries.length === errorsBefore && (!picked || !!CAT.maps.byId(picked)), picked);
    Settings.set('custom.draft', '');
  });
});

// Size caps per quality tier, options and the share code.
Test.add('mapgen', (check) => {
  check('caps: potato offers small only', MapGen.sizeCap('potato').id === 'small');
  check('caps: low offers medium', MapGen.sizeCap('low').id === 'medium');
  check('caps: medium and up offer large', ['medium', 'high', 'ultra'].every((tier) => MapGen.sizeCap(tier).id === 'large'));
  check('caps: a large request on potato is cut to small and reported', MapGen.resolve({ generator: 'GN1', size: 'large', quality: 'potato' }).size.id === 'small'
    && MapGen.resolve({ generator: 'GN1', size: 'large', quality: 'potato' }).sizeCut && !MapGen.resolve({ generator: 'GN1', size: 'small', quality: 'potato' }).sizeCut);
  check('caps: uncapped keeps the size', MapGen.resolve({ generator: 'GN1', size: 'large', quality: 'potato', uncapped: true }).size.id === 'large');
  const options = { generator: 'GN4', seed: 4242, size: 'medium', theme: 'glacier', density: 'sparse', mode: 'tdm', quality: 'high' };
  const code = MapGen.shareCode(options);
  const parsed = MapGen.parseShare(code);
  check('share: the code reads back as the same options', code === 'CTKMAP-GN4-medium-glacier-sparse-tdm-4242' && ['generator', 'seed', 'size', 'theme', 'density', 'mode'].every((key) => parsed[key] === options[key]), code);
  check('share: the code names the size the tier really makes', MapGen.shareCode(Object.assign({}, options, { size: 'large', quality: 'potato' })) === 'CTKMAP-GN4-small-glacier-sparse-tdm-4242');
  check('share: a random theme is written as the theme the seed picked', MapGen.shareCode({ generator: 'GN2', seed: 9, quality: 'high' }).split('-')[3] === MapGen.resolve({ generator: 'GN2', seed: 9 }).theme.id);
  check('share: any mode reads back as no mode', MapGen.parseShare('CTKMAP-GN1-small-glacier-normal-any-9').mode === '');
  check('share: broken codes are refused', ['', 'CTKMAP-GN9-small-glacier-normal-any-9', 'CTKMAP-GN1-huge-frost-normal-any-9', 'CTKMAP-GN1-small-glacier-normal-ctf-9',
    'CTKMAP-GN1-small-glacier-normal-any-x', 'MAP-GN1-small-glacier-normal-any-9'].every((text) => MapGen.parseShare(text) === null));
  check('options: unknown values fall back to the defaults', MapGen.resolve({ generator: 'nope', size: 'huge', density: 'x', mode: 'nope', uncapped: true }).generator === CAT.generators[0]);
  check('options: a missing theme is picked from the seed', MapGen.resolve({ generator: 'GN2', seed: 9 }).theme === MapGen.resolve({ generator: 'GN2', seed: 9 }).theme);
  check('data: the power list names power items and the item sets name item groups', mapgenItemSet('power').every((key) => MapRules.itemKeys.power.includes(key))
    && ['pickups', 'supply', 'loot'].every((id) => mapgenItemSet(id).every((group) => MapRules.itemGroups.includes(group))));
});

// Kits (audit 28): the bunker module's block is a grip climb wall up to the wall height, so MV05 Ravagers climb it in generated maps.
Test.add('mapgen', (check) => {
  check('kits: the bunker block is a climb prop and every tileset climbs on grip', CAT.mapModules.byId('bunker').props[0][0] === 'climb'
    && CAT.mapTilesets.every((tileset) => tileset.climb === 'grip') && MapRules.materials.includes('grip'));
  let grip = null;
  for (let seed = 1; seed <= 12 && !grip; seed++) {
    const map = MapGen.generate({ generator: 'GN1', seed, size: 'small', theme: 'foundry', trusted: true, uncapped: true });
    grip = map.brushes.find((brush) => brush.material === 'grip') || null;
  }
  const wallHeight = CAT.mapTilesets.byId('foundry').wallHeight;
  check('kits: a generated bunker room has a grip climb wall as tall as the walls', !!grip && grip.max[1] === wallHeight, grip && grip.max[1]);
});

// Items (audit 28): generated maps carry their own Vital Shard pair (12a shows it only in Ravager health matches), never one drawn as a plain health pickup.
Test.add('mapgen', (check) => {
  const arena = MapGen.generate({ generator: 'GN3', seed: 2, size: 'small', modes: ['ffa'], trusted: true, uncapped: true });
  const pve = MapGen.generate({ generator: 'GN1', seed: 2, size: 'small', trusted: true, uncapped: true });
  const shards = (map) => map.items.filter((item) => item.item === 'vitalshard').length;
  check('items: a generated arena and a fiends map each have a Vital Shard pair of their own', shards(arena) === 2 && shards(pve) >= 1, shards(arena) + ' / ' + shards(pve));
  const placedShards = (health) => {
    World.load(arena);
    Game.start({ mode: 'ffa', seed: 1, map: arena, ruleset: { health }, bots: [{ dummy: true }] });
    let count = 0;
    for (let slot = 0; slot < Items.spotCount; slot++) if (Items.keyOf(slot) === 'vitalshard') count++;
    Game.stop();
    return count;
  };
  const ravager = placedShards('ravager'), stack = placedShards('stack');
  check('items: a generated map started with Ravager health places its shard spots, other presets none', ravager === 2 && stack === 0, ravager + ' / ' + stack);
});

// Sightline repair: a seed whose first build has long open lines gets pillars and then validates.
Test.add('mapgen', (check) => {
  const map = MapGen.generate(MAPGEN_TEST_REPAIRED), report = MapGen.last;
  const plain = MapGen.generate(Object.assign({ trusted: true }, MAPGEN_TEST_REPAIRED));
  check('repair: pillars were added and the map validates', report.repairs > 0 && !report.fallback && report.attempts === 1 && !report.problems.length && report.rounds === report.repairs + 1,
    JSON.stringify(report.problems.slice(0, 2)));
  check('repair: the repaired map has more brushes than the first build, and the repair time is reported', map.brushes.length > plain.brushes.length && report.ms.repair > 0);
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

// The generated map screen: the model (settings, seed, share code, size clamp, Game.start setup) and the screen itself.
Test.add('mapgen', async (check) => {
  const saved = Object.assign({}, MapGenMenu.state), sizeCap = MapGen.sizeCap;
  try {
    Object.assign(MapGenMenu.state, { generator: 'GN2', mode: 'bomb', size: 'small', theme: 'canal', density: 'dense', seed: 12, map: null, report: null, notice: '' });
    check('menu: the share code follows the settings', MapGenMenu.shareCode() === 'CTKMAP-GN2-small-canal-dense-bomb-12', MapGenMenu.shareCode());
    MapGenMenu.set('generator', 'GN3');
    check('menu: a generator without the chosen mode drops it', MapGenMenu.state.mode === '' && MapGenMenu.state.map === null);
    check('menu: a seed must be a whole number', !MapGenMenu.setSeedText('12a') && MapGenMenu.setSeedText(' 345 ') && MapGenMenu.state.seed === 345);
    MapGen.sizeCap = () => CAT.mapSizes.byId('small');               // as on the potato tier
    MapGenMenu.state.size = 'medium';
    check('menu: a size the tier does not offer is cut to the largest it does', MapGenMenu.clampSize() && MapGenMenu.state.size === 'small' && !MapGenMenu.clampSize());
    check('menu: a pasted large code on a small tier is cut and the player is told', MapGenMenu.usePaste('CTKMAP-GN4-large-station-sparse-tdm-77') && MapGenMenu.state.size === 'small'
      && MapGenMenu.state.notice.includes('cut') && MapGenMenu.describe().startsWith(MapGenMenu.state.notice) && MapGenMenu.shareCode() === 'CTKMAP-GN4-small-station-sparse-tdm-77');
    MapGen.sizeCap = sizeCap;
    check('menu: a pasted code sets every option', MapGenMenu.usePaste('CTKMAP-GN4-small-station-sparse-tdm-77') && MapGenMenu.state.generator === 'GN4' && MapGenMenu.state.mode === 'tdm'
      && MapGenMenu.state.seed === 77 && MapGenMenu.state.notice === '');
    check('menu: a broken code changes nothing', !MapGenMenu.usePaste('CTKMAP-GN4') && MapGenMenu.state.generator === 'GN4');
    const setup = MapGenMenu.setup();
    check('menu: Play starts the mode on the generated map with the player on team 0', setup.mode === 'tdm' && setup.map === MapGenMenu.state.map && setup.player.team === 0 && Array.isArray(setup.bots));
    check('menu: the status says what was made', MapGenMenu.describe().includes(MapGenMenu.state.map.name));
    check('menu: sizes stop at the tier cap', MapGenMenu.sizes().every((row) => row.index <= MapGen.sizeCap().index));
    const leaveUi = uiEnter();
    try {
      Ui.open('custom');
      uiClickButton(Ui.root.querySelector('.ui-custom'), 'Map');
      check('screen: the custom match Map tab opens it', uiClickButton(Ui.root.querySelector('.ui-custom'), 'Generate a map') && Ui.current() === 'mapgen');
      const root = Ui.root.querySelector('.ui-mapgen');
      check('screen: generator, mode, size, theme, density, seed, share and paste rows', root && root.querySelectorAll('.ui-row').length === 8, root && root.querySelectorAll('.ui-row').length);
      root.querySelector('.ui-cycle')._adjust(1);
      check('screen: the generator cycle steps with the pad and arrows', MapGenMenu.state.generator === 'GN5' && root.querySelector('.ui-cycle').textContent.startsWith('GN5'));
      root.querySelector('.ui-cycle')._adjust(-1);
      MapGenMenu.state.map = null;
      uiClickButton(root, 'Generate');
      check('screen: Generate first says so and holds the buttons, then the work runs', root.querySelector('.mg-status').textContent === MAPGEN_MENU_BUSY_TEXT && !MapGenMenu.state.map
        && Array.from(root.querySelectorAll('.ui-foot button')).every((button) => button.disabled));
      await uiWait(50);
      check('screen: Generate shows the result', root.querySelector('.mg-status').textContent.includes('Made in') && MapGenMenu.state.map.gen.generator === 'GN4'
        && Array.from(root.querySelectorAll('.ui-foot button')).every((button) => !button.disabled));
      uiClickButton(root, 'Play');
      check('screen: Play says Generating first', Ui.current() === 'mapgen' && !Game.match);
      await uiWait(50);
      check('screen: Play starts the match on the shown map', Game.match && Game.match.map === MapGenMenu.state.map && !Ui.current());
    } finally {
      leaveUi();
    }
  } finally {
    MapGen.sizeCap = sizeCap;
    Object.assign(MapGenMenu.state, saved);
    Game.stop();
  }
});

Test.add('mapgen', (check) => {
  const before = Maps.runtime.slice();
  Maps.registerRuntime({ id: 'test-editor-keep', modes: ['ffa'] });
  for (let index = 0; index <= MAPS_RUNTIME_KEEP; index++) Maps.addRuntime({ id: 'test-generated-' + index, modes: ['ffa'], gen: {} });
  const generated = Maps.runtime.filter((row) => row.gen && row.id.startsWith('test-generated-'));
  check('runtime maps: generating past the limit drops the oldest generated map only', generated.length <= MAPS_RUNTIME_KEEP && !Maps.get('test-generated-0'));
  check('runtime maps: an editor map stays listed for its mode', Maps.forMode('ffa').some((row) => row.id === 'test-editor-keep'));
  Maps.runtime = before;
});
