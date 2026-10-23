// ==== S16 MAP GENERATOR ====
// MapGen.generate(options) -> a map row in the authored map format (docs/ARCHITECTURE.md), made by one of the GN1..GN5 kits
// (16w-mapgen-kits.js) from the data in 03n-data-mapgen.js. Pipeline per seed: kit geometry -> scan (MapScan) -> trigger repair
// (jump pads and ladders the scan rejects are dropped) -> mode-aware placement on walkable cells of the main loop (spawns,
// items, objectives, nav hints: MapGenPlace, 16w-mapgen-place.js) -> Maps.validate (MAP-023) -> sightline repair (pillars on long open lines) -> accepted, or
// the next seed (seed + 1, five seeds in all), then the generator's authored fallback map. Same options = the same map
// (MAP-020): every draw comes from makeRandom streams seeded by the options, never from Rng or the clock.
// Contract: docs/api/mapgen.md.

const MAPGEN_ATTEMPTS = 5;              // MAP-023: seed, seed + 1, ... seed + 4, then the fallback map
const MAPGEN_REPAIR_ROUNDS = 2;         // sightline repairs per seed before it is rejected
const MAPGEN_REPAIR_PILLARS = 48;       // more long lines than this in one round: reject the seed instead
const MAPGEN_DEFAULT_SIZE = 'medium';
const MAPGEN_TRUSTED_SEED = 2;          // GN5 default seed: MP09 Ring Isle (the self-test proves it validates)
const MAPGEN_PILLAR_CLEARANCE = 2.2;    // a repair pillar keeps this far from other brushes and triggers
const MAPGEN_PILLAR_SIZE = 1;
const MAPGEN_PILLAR_SHARES = [0.5, 0.38, 0.62, 0.26, 0.74, 0.15, 0.85];   // where along a long line a pillar is tried, middle first
const MAPGEN_SHARE_PREFIX = 'CTKMAP';
const mapgenKey = (parts) => parts.join(':');

const MapGen = {
  last: null,          // report of the latest generate(): { requestedSeed, seed, attempts, fallback, repairs, problems, sizeCut, rounds (builds), ms: { build, scan, place, validate, repair, total } }
  islandCache: null,   // MP09 Ring Isle made by GN5 with the default seed (built on first use)

  generator(key) {
    if (!CAT.generators) return null;
    return CAT.generators.byId(key) || CAT.generators.find((row) => row.code === key) || null;
  },
  // The largest map size the active quality preset allows (13.4: size cap per quality tier).
  sizeCap(qualityId) {
    const tier = qualityId || Quality.current().id;
    const allowed = CAT.mapSizes.filter((row) => row.tiers.includes(tier));
    return allowed.length ? allowed[allowed.length - 1] : CAT.mapSizes[0];
  },
  // The size row a request gets: the wanted size (default medium), cut to the tier cap unless uncapped.
  cappedSize(sizeId, qualityId, uncapped) {
    const cap = uncapped ? CAT.mapSizes[CAT.mapSizes.length - 1] : this.sizeCap(qualityId);
    const wanted = CAT.mapSizes.byId(sizeId) || CAT.mapSizes.byId(MAPGEN_DEFAULT_SIZE);
    return wanted.index > cap.index ? cap : wanted;
  },
  // Normalised options: rows instead of keys, the seed as an integer, the size clamped to the tier cap (unless uncapped).
  resolve(options) {
    const input = options || {};
    const generator = this.generator(input.generator) || CAT.generators[0];
    const seed = Math.abs(Math.floor(Number(input.seed) || 0)) % SEED_RANGE;
    const size = this.cappedSize(input.size, input.quality, input.uncapped);
    const themeRow = CAT.mapTilesets.byId(input.theme);
    const theme = themeRow || CAT.mapTilesets[hashString('theme:' + generator.code + ':' + seed) % CAT.mapTilesets.length];
    const density = CAT.mapDensities.byId(input.density) || CAT.mapDensities.byId('normal');
    const mode = generator.modes.includes(input.mode) ? input.mode : '';
    const sizeCut = (CAT.mapSizes.byId(input.size) || size) !== size;
    return { generator, seed, size, sizeCut, theme, density, mode, modes: mode ? [mode] : generator.defaultModes.slice(), trusted: !!input.trusted };
  },
  // The share text of the settings a generate() with these options uses (13.4: plain text to copy and paste), the size already cut to
  // the tier cap, so the code always names the map this device makes: CTKMAP-GN3-medium-foundry-normal-ffa-48213.
  shareCode(options) {
    const s = this.resolve(options);
    return [MAPGEN_SHARE_PREFIX, s.generator.code, s.size.id, s.theme.id, s.density.id, s.mode || 'any', s.seed].join('-');
  },
  // Share text -> options, or null when the text is not a map code.
  parseShare(text) {
    const parts = String(text || '').trim().split('-');
    if (parts.length !== 7 || parts[0] !== MAPGEN_SHARE_PREFIX || !/^\d+$/.test(parts[6])) return null;
    const generator = this.generator(parts[1]);
    if (!generator || !CAT.mapSizes.byId(parts[2]) || !CAT.mapTilesets.byId(parts[3]) || !CAT.mapDensities.byId(parts[4])) return null;
    if (parts[5] !== 'any' && !generator.modes.includes(parts[5])) return null;
    return { generator: generator.code, size: parts[2], theme: parts[3], density: parts[4], mode: parts[5] === 'any' ? '' : parts[5], seed: Number(parts[6]) % SEED_RANGE };
  },

  // ---- Driver (MAP-023) ----
  generate(options) {
    const settings = this.resolve(options);
    const started = performance.now();
    const report = { requestedSeed: settings.seed, seed: settings.seed, attempts: 0, rounds: 0, fallback: false, repairs: 0, problems: [], sizeCut: settings.sizeCut,
      ms: { build: 0, scan: 0, place: 0, validate: 0, repair: 0, total: 0 } };
    this.last = report;
    let map = null;
    for (let attempt = 0; attempt < MAPGEN_ATTEMPTS && !map; attempt++) {
      report.attempts = attempt + 1;
      report.seed = (settings.seed + attempt) % SEED_RANGE;
      map = this.attempt(settings, report.seed, report);
    }
    if (!map) map = this.fallback(settings, report);
    else if (!settings.trusted) Maps.addRuntime(map);
    report.ms.total = performance.now() - started;
    return map;
  },
  fallback(settings, report) {
    report.fallback = true;
    const own = Maps.get(settings.generator.fallback);
    const served = settings.modes.map((mode) => Maps.forMode(mode).find((row) => !row.gen)).find((row) => row);
    return own && settings.modes.every((mode) => own.modes.includes(mode)) ? own : served || own;
  },
  // One seed: build, place, validate, repair sightlines; the accepted map or null.
  attempt(settings, seed, report) {
    const pillars = [];
    for (let round = 0; round <= MAPGEN_REPAIR_ROUNDS; round++) {
      const map = this.build(settings, seed, pillars, report);
      if (!map) return null;
      if (settings.trusted) { MapScan.release(); return map; }
      const problems = this.timed(report, 'validate', () => Maps.validate(map));
      report.problems = problems;
      if (!problems.length) return map;
      if (round === MAPGEN_REPAIR_ROUNDS || !problems.every((problem) => problem.startsWith('sightline:'))) return null;
      if (!this.timed(report, 'repair', () => this.repairSightlines(map, settings, pillars))) return null;
      report.repairs++;
    }
    return null;
  },
  timed(report, phase, run) {
    const started = performance.now();
    const result = run();
    report.ms[phase] += performance.now() - started;
    return result;
  },

  // Geometry from the kit (plus repair pillars), the scan, the trigger repair and the placement. Leaves the scan as MapScan.last
  // so the validator that follows reuses it.
  build(settings, seed, pillars, report) {
    const key = mapgenKey([settings.generator.code, seed, settings.size.id, settings.theme.id, settings.density.id, settings.modes.join('+')]);
    report.rounds++;
    const plan = this.timed(report, 'build', () => MapGenKits[settings.generator.kit](this.context(settings, seed, key)));
    plan.def.brushes.push(...pillars);
    let map = this.assemble(settings, seed, plan);
    let scan = this.timed(report, 'scan', () => MapScan.of(map));
    if (this.dropBadTriggers(plan, scan)) {
      map = this.assemble(settings, seed, plan);
      scan = this.timed(report, 'scan', () => MapScan.of(map));
    }
    const placed = this.timed(report, 'place', () => MapGenPlace.run({ map, scan, plan, settings, random: makeRandom(hashString(key + ':place')) }));
    return placed ? map : null;
  },
  context(settings, seed, key) {
    const generator = settings.generator, dims = generator.cells[settings.size.index];
    return { settings, generator, tileset: settings.theme, density: settings.density, random: makeRandom(hashString(key)), cols: dims[0], rows: dims[1], cell: generator.cell };
  },
  assemble(settings, seed, plan) {
    const generator = settings.generator, s = settings;
    const map = MapKit.make({
      id: 'gn' + generator.code.slice(2) + s.size.id[0] + s.theme.id.slice(0, 2) + s.density.id[0] + seed + (s.mode || 'all'),
      code: generator.code + '-' + seed, name: s.theme.name + ' ' + generator.name + ' ' + seed, size: plan.size, theme: s.theme.id, category: generator.category,
      modes: s.modes.slice(), sky: Object.assign({}, s.theme.sky), blurb: generator.blurb, seed, placeholder: false, version: MapRules.version,
      brushes: plan.def.brushes, spawns: [], zones: plan.def.zones, lights: plan.def.lights, triggers: plan.def.triggers.map((t) => JSON.parse(JSON.stringify(t))),
    });
    map.gen = { generator: generator.code, size: s.size.id, theme: s.theme.id, density: s.density.id, mode: s.mode, requestedSeed: s.seed };
    return map;
  },
  // 13.2 repair: jump pads whose arc or landing the scan rejects and ladders without a foot or a top are removed.
  dropBadTriggers(plan, scan) {
    const bad = new Set();
    for (const pad of scan.pads) if (!pad.entries || pad.landing < 0 || !pad.firm || pad.open < pad.entries) bad.add(pad.trigger);
    for (const ladder of scan.ladders) if (!ladder.bottoms || !ladder.tops) bad.add(ladder.trigger);
    if (!bad.size) return false;
    const map = scan.map;
    plan.def.triggers = plan.def.triggers.filter((trigger, index) => !bad.has(map.triggers[index]));
    return true;
  },

  // ---- Sightline repair (13.2, MAP-003): a pillar on every open line longer than the category limit ----
  repairSightlines(map, settings, pillars) {
    const scan = MapScan.of(map), loop = MapCheck.mainLoop({ scan, map, stats: {} }), limit = Maps.sightLimit(map);
    const lines = this.longLines(map, scan, loop, limit);
    MapScan.release();
    if (!lines.length || lines.length > MAPGEN_REPAIR_PILLARS) return false;
    const added = [];
    for (const line of lines) {
      if (added.some((pillar) => this.blocksLine(pillar, line, limit))) continue;
      const pillar = this.pillarFor(map, line, limit, added, settings);
      if (!pillar) return false;
      added.push(pillar);
    }
    pillars.push(...added.map((pillar) => pillar.row));
    return true;
  },
  // The validator's lattice of eye positions (MapCheck.sightlines): one long line per origin at most.
  longLines(map, scan, loop, limit) {
    const lattice = Math.round(MAP_SIGHT_SPACING / scan.cell), hit = makeHit(), lines = [];
    for (let n = 0; n < scan.nodeCount; n++) {
      const column = scan.nodeColumn[n];
      if (!loop[n] || (column % scan.cols) % lattice !== 0 || ((column / scan.cols) | 0) % lattice !== 0) continue;
      const line = this.longLineAt(map, scan, n, limit, hit);
      if (line) lines.push(line);
    }
    return lines;
  },
  longLineAt(map, scan, n, limit, hit) {
    const x = MapScan.nodeX(scan, n), z = MapScan.nodeZ(scan, n), y = scan.nodeY[n];
    for (const [dx, dz] of MAPGEN_RING) {               // the validator's 16 directions (MAP_SIGHT_DIRECTIONS), from the fixed table
      const free = Math.min(MapScan.rayLength(scan, x, y + STAND_EYE, z, dx, dz, limit + 1, hit), MapCheck.exitDistance(map, x, z, dx, dz));
      if (free > limit) return { x, y, z, dx, dz };
    }
    return null;
  },
  blocksLine(pillar, line, limit) {
    const along = (pillar.x - line.x) * line.dx + (pillar.z - line.z) * line.dz;
    const across = Math.abs((pillar.x - line.x) * line.dz - (pillar.z - line.z) * line.dx);
    return along > 0 && along < limit && across < MAPGEN_PILLAR_SIZE / 2 && pillar.top > line.y + STAND_EYE;
  },
  // A free spot on the line, away from other geometry so the pillar never narrows a passage below the 1.4 m door width.
  pillarFor(map, line, limit, added, settings) {
    for (const share of MAPGEN_PILLAR_SHARES) {
      const x = line.x + line.dx * limit * share, z = line.z + line.dz * limit * share;
      if (!this.pillarFits(map, x, z, added)) continue;
      const floor = this.floorUnder(map, x, z, line.y);
      const top = floor + settings.theme.wallHeight;
      const half = MAPGEN_PILLAR_SIZE / 2;
      return { x, z, top, row: [settings.theme.pillar, x - half, floor, z - half, x + half, top, z + half] };
    }
    return null;
  },
  pillarFits(map, x, z, added) {
    const margin = MAPGEN_PILLAR_CLEARANCE, edge = MapRules.limits.shellThickness;
    if (Math.abs(x) > map.size[0] / 2 - edge || Math.abs(z) > map.size[2] / 2 - edge) return false;
    const floorTop = this.floorUnder(map, x, z, Infinity);
    const near = (box) => x > box.min[0] - margin && x < box.max[0] + margin && z > box.min[2] - margin && z < box.max[2] + margin;
    if (map.brushes.some((brush) => brush.max[1] > floorTop + 0.05 && near(brush))) return false;
    if (map.triggers.some((trigger) => trigger.kind !== 'killzone' && near(trigger))) return false;
    return !added.some((pillar) => mapgenFlat(pillar.x, pillar.z, x, z) < margin * 2);
  },
  // Highest brush top under the point at or below y (the floor a pillar stands on).
  floorUnder(map, x, z, y) {
    let best = 0;
    for (const brush of map.brushes) {
      if (x < brush.min[0] || x > brush.max[0] || z < brush.min[2] || z > brush.max[2] || brush.shape !== 'box') continue;
      if (brush.max[1] <= y + 0.05 && brush.max[1] > best) best = brush.max[1];
    }
    return best;
  },

  // MP09 Ring Isle: GN5 with the default seed replaces the hand-built placeholder whenever a match asks for it (spec MP09).
  ringIsle() {
    if (this.islandCache) return this.islandCache;
    const map = this.generate({ generator: 'GN5', seed: MAPGEN_TRUSTED_SEED, size: 'large', theme: 'overgrowth', density: 'normal', mode: 'royale', uncapped: true, trusted: true });
    if (map.placeholder) return map;
    const placeholder = Maps.get('isle');
    Object.assign(map, { id: placeholder.id, code: placeholder.code, name: 'Ring Isle', blurb: placeholder.blurb });
    this.islandCache = map;
    return map;
  },
};

// The Daily Seed (15c, an earlier section) builds its map through this hook.
Daily.generateMap = (options) => MapGen.generate(options);

// The match asks for MP09 (the placeholder row): it plays on the GN5 island instead. Runs after 16f's own match.setup listener.
Bus.on('match.setup', (match) => {
  if (match.map && match.map.placeholder && match.map.id === 'isle') match.map = MapGen.ringIsle();
});
