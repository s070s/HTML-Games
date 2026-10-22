// ==== S16 MAP GENERATOR ====
// MapGen.generate(options) -> a map row in the authored map format (docs/ARCHITECTURE.md), made by one of the GN1..GN5 kits
// (16w-mapgen-kits.js) from the data in 03n-data-mapgen.js. Pipeline per seed: kit geometry -> scan (MapScan) -> trigger repair
// (jump pads and ladders the scan rejects are dropped) -> mode-aware placement on walkable cells of the main loop (spawns,
// items, objectives, nav hints) -> Maps.validate (MAP-023) -> sightline repair (pillars on long open lines) -> accepted, or
// the next seed (seed + 1, five seeds in all), then the generator's authored fallback map. Same options = the same map
// (MAP-020): every draw comes from makeRandom streams seeded by the options, never from Rng or the clock.
// Contract: docs/api/mapgen.md.

const MAPGEN_ATTEMPTS = 5;              // MAP-023: seed, seed + 1, ... seed + 4, then the fallback map
const MAPGEN_REPAIR_ROUNDS = 2;         // sightline repairs per seed before it is rejected
const MAPGEN_REPAIR_PILLARS = 48;       // more long lines than this in one round: reject the seed instead
const MAPGEN_SEED_RANGE = 0x7fffffff;
const MAPGEN_TRUSTED_SEED = 2;          // GN5 default seed: MP09 Ring Isle (the self-test proves it validates)
const MAPGEN_SPAWN_COUNTS = { free: 16, teams: 8, coop: 6, solo: 4, royale: 24 };
const MAPGEN_TEAM_SPAWN_GAP = 2.5;      // team spawns stand at least this far apart
const MAPGEN_LATTICE = 1.5;             // candidate spots are sampled on this lattice, metres
const MAPGEN_SPAWN_EDGE = 8;            // free spawns keep this far from the map edge: a spawn in a corner pocket leaves too few lanes (MAP-002)
const MAPGEN_SPAWN_LATTICES = 60;       // free spawn candidates: at most this many lattice steps across the map (2 m at least)
const MAPGEN_ROOMY = 1;                 // a spot needs floor of its own height this far around it in 8 directions
const MAPGEN_ROOMY_YES = 1, MAPGEN_ROOMY_NO = 2;
const MAPGEN_ROOMY_STEP = 0.3;            // height difference that still counts as the same floor
const MAPGEN_ROOMY_OFFSETS = Array.from({ length: 8 }, (unused, index) => [Math.cos(index * Math.PI / 4) * MAPGEN_ROOMY, Math.sin(index * Math.PI / 4) * MAPGEN_ROOMY]);
const MAPGEN_FACING_REACH = 12;         // spawn facing: free distance looked at in each direction
const MAPGEN_FACING_MIN = 3;            // a spawn must look at this much open space (the validator wants 2 m)
const MAPGEN_POWER_SPAWN_GAP = 10;      // power items stay this far (straight line) from free spawns: walking is never shorter
const MAPGEN_ITEM_GAP = 3;              // items stand this far apart (validator: 2 m)
const MAPGEN_POWER_EXPOSURE = 7;        // open directions of 16 a power item needs (validator: 6)
const MAPGEN_PILLAR_CLEARANCE = 2.2;    // a repair pillar keeps this far from other brushes and triggers
const MAPGEN_PILLAR_SIZE = 1;
const MAPGEN_HINTS = 8;
const MAPGEN_SHARE_PREFIX = 'CTKMAP';

const MAPGEN_DIRECTIONS = Array.from({ length: 8 }, (unused, index) => index * 45);
const mapgenKey = (parts) => parts.join(':');

const MapGen = {
  last: null,          // report of the latest generate(): { requestedSeed, seed, attempts, fallback, repairs, problems, ms: { build, scan, place, validate, total } }
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
  // Normalised options: rows instead of keys, the seed as an integer, the size clamped to the tier cap (unless uncapped).
  resolve(options) {
    const input = options || {};
    const generator = this.generator(input.generator) || CAT.generators[0];
    const seed = Math.abs(Math.floor(Number(input.seed) || 0)) % MAPGEN_SEED_RANGE;
    const cap = input.uncapped ? CAT.mapSizes[CAT.mapSizes.length - 1] : this.sizeCap(input.quality);
    const wanted = CAT.mapSizes.byId(input.size) || CAT.mapSizes.byId('medium');
    const size = wanted.index > cap.index ? cap : wanted;
    const themeRow = CAT.mapTilesets.byId(input.theme);
    const theme = themeRow || CAT.mapTilesets[hashString('theme:' + generator.code + ':' + seed) % CAT.mapTilesets.length];
    const density = CAT.mapDensities.byId(input.density) || CAT.mapDensities.byId('normal');
    const mode = generator.modes.includes(input.mode) ? input.mode : '';
    return { generator, seed, size, theme, density, mode, modes: mode ? [mode] : generator.defaultModes.slice(), trusted: !!input.trusted };
  },
  // The share text of a set of options (13.4: plain text to copy and paste): CTKMAP-GN3-medium-foundry-normal-ffa-48213.
  shareCode(options) {
    const s = this.resolve(Object.assign({ uncapped: true }, options));
    return [MAPGEN_SHARE_PREFIX, s.generator.code, s.size.id, s.theme.id, s.density.id, s.mode || 'any', s.seed].join('-');
  },
  // Share text -> options, or null when the text is not a map code.
  parseShare(text) {
    const parts = String(text || '').trim().split('-');
    if (parts.length !== 7 || parts[0] !== MAPGEN_SHARE_PREFIX || !/^\d+$/.test(parts[6])) return null;
    const generator = this.generator(parts[1]);
    if (!generator || !CAT.mapSizes.byId(parts[2]) || !CAT.mapTilesets.byId(parts[3]) || !CAT.mapDensities.byId(parts[4])) return null;
    if (parts[5] !== 'any' && !generator.modes.includes(parts[5])) return null;
    return { generator: generator.code, size: parts[2], theme: parts[3], density: parts[4], mode: parts[5] === 'any' ? '' : parts[5], seed: Number(parts[6]) % MAPGEN_SEED_RANGE };
  },

  // ---- Driver (MAP-023) ----
  generate(options) {
    const settings = this.resolve(options);
    const started = performance.now();
    const report = { requestedSeed: settings.seed, seed: settings.seed, attempts: 0, fallback: false, repairs: 0, problems: [], ms: { build: 0, scan: 0, place: 0, validate: 0, total: 0 } };
    this.last = report;
    let map = null;
    for (let attempt = 0; attempt < MAPGEN_ATTEMPTS && !map; attempt++) {
      report.attempts = attempt + 1;
      report.seed = (settings.seed + attempt) % MAPGEN_SEED_RANGE;
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
      if (!this.repairSightlines(map, settings, pillars)) return null;
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
    for (let d = 0; d < MAP_SIGHT_DIRECTIONS; d++) {
      const angle = (d / MAP_SIGHT_DIRECTIONS) * Math.PI * 2, dx = Math.cos(angle), dz = Math.sin(angle);
      const free = Math.min(MapScan.rayLength(scan, x, y + MAP_EYE, z, dx, dz, limit + 1, hit), MapCheck.exitDistance(map, x, z, dx, dz));
      if (free > limit) return { x, y, z, dx, dz };
    }
    return null;
  },
  blocksLine(pillar, line, limit) {
    const along = (pillar.x - line.x) * line.dx + (pillar.z - line.z) * line.dz;
    const across = Math.abs((pillar.x - line.x) * line.dz - (pillar.z - line.z) * line.dx);
    return along > 0 && along < limit && across < MAPGEN_PILLAR_SIZE / 2 && pillar.top > line.y + MAP_EYE;
  },
  // A free spot on the line, away from other geometry so the pillar never narrows a passage below the 1.4 m door width.
  pillarFor(map, line, limit, added, settings) {
    for (const share of [0.5, 0.38, 0.62, 0.26, 0.74, 0.15, 0.85]) {
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
    return !added.some((pillar) => Math.hypot(pillar.x - x, pillar.z - z) < margin * 2);
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

// The match asks for MP09 (the placeholder row): it plays on the GN5 island instead. Runs after 16f's own match.setup listener.
Bus.on('match.setup', (match) => {
  if (match.map && match.map.placeholder && match.map.id === 'isle') match.map = MapGen.ringIsle();
});

// ---- Placement (13.3): spawns, items, objectives and hints on walkable cells of the main loop ----
const MapGenPlace = {
  run(ctx) {
    ctx.loop = this.mainLoop(ctx.scan, ctx.map, ctx.plan.centre);
    ctx.hit = makeHit();
    ctx.mirror = !!ctx.plan.mirror;
    ctx.taken = [];
    ctx.roomy = new Uint8Array(ctx.scan.nodeCount);      // per node: 0 not checked yet, MAPGEN_ROOMY_YES / _NO
    if (!this.spawns(ctx)) return false;
    this.objectives(ctx);
    this.items(ctx);
    this.hints(ctx);
    if (ctx.plan.ring) ctx.map.ring = ctx.plan.ring;
    return true;
  },
  // The largest walking loop that holds the plan centre (or the map centre).
  mainLoop(scan, map, centre) {
    const point = centre || { x: 0, z: 0 };
    for (const radius of [1, 3, 6, 10]) {
      const node = this.anyNodeNear(scan, point.x, point.z, radius);
      if (node >= 0) return MapScan.loopOf(scan, node);
    }
    return new Uint8Array(scan.nodeCount);
  },
  anyNodeNear(scan, x, z, radius) {
    const step = scan.cell;
    for (let r = 0; r <= radius; r += step) {
      for (let a = 0; a < 8; a++) {
        const column = MapScan.columnOf(scan, x + Math.cos(a * Math.PI / 4) * r, z + Math.sin(a * Math.PI / 4) * r);
        if (column >= 0 && scan.columnStart[column] < scan.columnStart[column + 1]) return scan.columnStart[column];
      }
    }
    return -1;
  },

  // ---- spots ----
  // A loop node with floor of its own height all around (no edge, no wall at arm's length), or -1.
  roomyNode(ctx, x, y, z) {
    const node = MapScan.nodeNear(ctx.scan, x, y, z, 0.3);
    return node >= 0 && this.roomy(ctx, node) ? node : -1;
  },
  roomy(ctx, node) {
    if (!ctx.roomy[node]) ctx.roomy[node] = this.isRoomy(ctx, node) ? MAPGEN_ROOMY_YES : MAPGEN_ROOMY_NO;
    return ctx.roomy[node] === MAPGEN_ROOMY_YES;
  },
  isRoomy(ctx, node) {
    const scan = ctx.scan, x = MapScan.nodeX(scan, node), y = scan.nodeY[node], z = MapScan.nodeZ(scan, node);
    if (!ctx.loop[node]) return false;
    for (const [dx, dz] of MAPGEN_ROOMY_OFFSETS) {
      if (!this.loopFloorAt(ctx, MapScan.columnOf(scan, x + dx, z + dz), y)) return false;
    }
    return true;
  },
  // A main-loop node of about this height in the column.
  loopFloorAt(ctx, column, y) {
    if (column < 0) return false;
    const scan = ctx.scan;
    for (let n = scan.columnStart[column]; n < scan.columnStart[column + 1]; n++) {
      if (ctx.loop[n] && Math.abs(scan.nodeY[n] - y) <= MAPGEN_ROOMY_STEP) return true;
    }
    return false;
  },
  // Roomy standing spots on a lattice inside a rect { x0, z0, x1, z1 } (every surface height of each lattice point).
  spotsIn(ctx, rect, step) {
    const scan = ctx.scan, spots = [], spacing = step || MAPGEN_LATTICE;
    for (let z = rect.z0 + spacing / 2; z < rect.z1; z += spacing) {
      for (let x = rect.x0 + spacing / 2; x < rect.x1; x += spacing) this.addSpots(ctx, scan, x, z, spots);
    }
    return spots;
  },
  addSpots(ctx, scan, x, z, spots) {
    const column = MapScan.columnOf(scan, x, z);
    if (column < 0) return;
    for (let node = scan.columnStart[column]; node < scan.columnStart[column + 1]; node++) {
      if (!this.roomy(ctx, node)) continue;
      const nx = MapScan.nodeX(scan, node), nz = MapScan.nodeZ(scan, node);
      if (!this.isTaken(ctx, nx, nz, 1)) spots.push({ x: nx, y: scan.nodeY[node], z: nz, node });
    }
  },
  // Nearest roomy spot to (x, z) within radius, lowest surface first; null when none.
  spotNear(ctx, x, z, radius, gap) {
    let best = null, bestScore = Infinity;
    for (const spot of this.spotsIn(ctx, { x0: x - radius, z0: z - radius, x1: x + radius, z1: z + radius }, 0.5)) {
      const score = Math.hypot(spot.x - x, spot.z - z) + spot.y * 0.25;
      if (score < bestScore && !this.isTaken(ctx, spot.x, spot.z, gap || 0)) { best = spot; bestScore = score; }
    }
    return best;
  },
  isTaken(ctx, x, z, gap) { return ctx.taken.some((point) => Math.hypot(point.x - x, point.z - z) < gap); },
  take(ctx, point) { ctx.taken.push({ x: point.x, z: point.z }); return point; },
  mirrorPoint(point) { return { x: -point.x, y: point.y, z: point.z }; },
  // Spawn facing (MAP-010 facing check): the open direction (8 choices) that best faces the target point; null when all are blocked.
  facing(ctx, spot, targetX, targetZ) {
    const toward = Math.atan2(targetX - spot.x, targetZ - spot.z);
    let bestYaw = null, bestScore = -Infinity;
    for (const yaw of MAPGEN_DIRECTIONS) {
      const radians = yaw * DEG, free = Math.min(MAPGEN_FACING_REACH, MapScan.rayLength(ctx.scan, spot.x, spot.y + MAP_CHEST, spot.z, Math.sin(radians), Math.cos(radians), MAPGEN_FACING_REACH, ctx.hit));
      const score = free + Math.cos(radians - toward) * 4;
      if (free >= MAPGEN_FACING_MIN && score > bestScore) { bestScore = score; bestYaw = yaw; }
    }
    return bestYaw;
  },

  // ---- spawns (MAP-010 / MAP-011) ----
  spawns(ctx) {
    const groups = new Set(ctx.settings.modes.map((mode) => MapRules.rule(mode)[0]));
    if (groups.has('free') || groups.has('solo')) this.freeSpawns(ctx, ctx.settings.modes.includes('royale') ? MAPGEN_SPAWN_COUNTS.royale : MAPGEN_SPAWN_COUNTS.free);
    if (groups.has('teams') && !this.teamSpawns(ctx)) return false;
    if (groups.has('coop') && !this.coopSpawns(ctx)) return false;
    const needed = [...groups].every((group) => MapRules.spawnRules[group].every(([team, minimum]) => ctx.map.spawns.filter((s) => s.team === team).length >= minimum));
    return needed;
  },
  addSpawn(ctx, spot, yaw, team) {
    ctx.map.spawns.push({ x: spot.x, y: spot.y, z: spot.z, yaw, team, modes: [] });
    this.take(ctx, spot);
  },
  // Free-for-all: farthest-point sampling over the whole loop (mirrored maps: over the west half, then mirrored).
  freeSpawns(ctx, count) {
    const edge = MAPGEN_SPAWN_EDGE, half = ctx.map.size[0] / 2 - edge, depth = ctx.map.size[2] / 2 - edge;
    const rect = { x0: -half, z0: -depth, x1: ctx.mirror ? -1.5 : half, z1: depth };
    const candidates = this.spotsIn(ctx, rect, Math.max(2, ctx.map.size[0] / MAPGEN_SPAWN_LATTICES));
    const gaps = this.firstGaps(candidates, ctx.mirror);
    const wanted = ctx.mirror ? Math.ceil(count / 2) : count;
    for (let placed = 0; placed < wanted;) {
      const index = this.farthest(gaps);
      if (index < 0) break;
      const next = candidates[index];
      gaps[index] = -1;
      const yaw = this.facing(ctx, next, 0, 0);
      if (yaw === null || (ctx.mirror && this.facing(ctx, this.mirrorPoint(next), 0, 0) === null)) continue;
      this.narrowGaps(candidates, gaps, next, ctx.mirror, placed === 0);
      placed++;
      this.addSpawn(ctx, next, yaw, -1);
      if (ctx.mirror) this.addSpawn(ctx, this.mirrorPoint(next), -yaw, -1);
    }
  },
  // Farthest-point sampling: gaps[i] = distance from candidate i to the nearest chosen spawn (and its mirror), -1 once used.
  // Before the first pick it is a small score that prefers the spot farthest from the centre (deterministic).
  firstGaps(candidates, mirror) {
    const gaps = new Float64Array(candidates.length);
    candidates.forEach((spot, index) => { gaps[index] = Math.hypot(spot.x, spot.z) * 0.01; });
    if (!mirror) return gaps;
    candidates.forEach((spot, index) => { gaps[index] = Math.min(gaps[index], Math.abs(spot.x) * 2); });
    return gaps;
  },
  narrowGaps(candidates, gaps, chosen, mirror, first) {
    for (let index = 0; index < candidates.length; index++) {
      if (gaps[index] < 0) continue;
      const spot = candidates[index];
      let gap = Math.hypot(spot.x - chosen.x, spot.z - chosen.z);
      if (mirror) gap = Math.min(gap, Math.hypot(spot.x + chosen.x, spot.z - chosen.z), Math.abs(spot.x) * 2);
      gaps[index] = first ? gap : Math.min(gaps[index], gap);
    }
  },
  farthest(gaps) {
    let best = -1, bestGap = -1;
    for (let index = 0; index < gaps.length; index++) {
      if (gaps[index] > bestGap) { best = index; bestGap = gaps[index]; }
    }
    return best;
  },
  // Team modes: 8 spawns per base, no enemy spawn within 25 m or in sight (mirrored maps: team 1 = the mirror of team 0).
  teamSpawns(ctx) {
    const bases = ctx.plan.bases, chosen = [[], []];
    for (const team of ctx.mirror ? [0] : [0, 1]) {
      const centre = this.rectCentre(bases[team][0]);
      const candidates = bases[team].flatMap((rect) => this.spotsIn(ctx, rect, MAPGEN_LATTICE));
      candidates.sort((a, b) => Math.hypot(a.x - centre.x, a.z - centre.z) - Math.hypot(b.x - centre.x, b.z - centre.z));
      for (const spot of candidates) {
        if (chosen[team].length >= MAPGEN_SPAWN_COUNTS.teams) break;
        if (this.teamSpotOk(ctx, spot, team, chosen)) chosen[team].push(spot);
      }
    }
    if (ctx.mirror) chosen[1] = chosen[0].map((spot) => this.mirrorPoint(spot));
    if (chosen[0].length < MAPGEN_SPAWN_COUNTS.teams || chosen[1].length < MAPGEN_SPAWN_COUNTS.teams) return false;
    for (const team of [0, 1]) for (const spot of chosen[team]) this.addSpawn(ctx, spot, this.facing(ctx, spot, 0, spot.z), team);
    return true;
  },
  teamSpotOk(ctx, spot, team, chosen) {
    if (chosen[team].some((other) => Math.hypot(other.x - spot.x, other.z - spot.z) < MAPGEN_TEAM_SPAWN_GAP)) return false;
    if (this.facing(ctx, spot, 0, spot.z) === null) return false;
    const enemies = ctx.mirror ? chosen[0].concat([spot]).map((other) => this.mirrorPoint(other)) : chosen[1 - team];
    return enemies.every((enemy) => this.spawnsSafe(ctx, spot, enemy));
  },
  spawnsSafe(ctx, a, b) {
    if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < MAP_TEAM_SPAWN_DISTANCE + 1) return false;
    return !MapScan.clearBetween(ctx.scan, a.x, a.y + 1.5, a.z, b.x, b.y + 1.5, b.z, ctx.hit);
  },
  // Co-op (MP07 rule): team 0 = the players in the start room, team 1 = the enemy gates spread over the gate rooms.
  coopSpawns(ctx) {
    for (const team of [0, 1]) {
      const rects = ctx.plan.bases[team], perRect = Math.ceil(MAPGEN_SPAWN_COUNTS.coop / rects.length);
      let placed = 0;
      for (const rect of rects) placed += this.fillRect(ctx, rect, perRect, team);
      if (placed < MapRules.spawnRules.coop[team][1]) return false;
    }
    return true;
  },
  fillRect(ctx, rect, count, team) {
    const centre = this.rectCentre(rect);
    let placed = 0;
    for (const spot of this.spotsIn(ctx, rect, 2)) {
      if (placed >= count || this.isTaken(ctx, spot.x, spot.z, MAPGEN_TEAM_SPAWN_GAP)) continue;
      const yaw = this.facing(ctx, spot, centre.x, centre.z + 50);
      if (yaw === null) continue;
      this.addSpawn(ctx, spot, yaw, team);
      placed++;
    }
    return placed;
  },
  rectCentre(rect) { return { x: (rect.x0 + rect.x1) / 2, z: (rect.z0 + rect.z1) / 2 }; },

  // ---- objectives (per mode, docs/api/maps.md "Objectives per mode") ----
  objectives(ctx) {
    for (const mode of ctx.settings.modes) {
      const place = MAPGEN_OBJECTIVES[mode];
      if (place) place(ctx, mode);
    }
  },
  // One objective at (x, z) (snapped to a roomy spot); its mirror for team objectives on mirrored maps.
  objective(ctx, row, x, z) {
    const spot = this.spotNear(ctx, x, z, 6, 2);
    if (!spot) return null;
    this.take(ctx, spot);
    const objective = MapKit.objective(Object.assign({ x: spot.x, y: spot.y, z: spot.z, radius: OBJECTIVE_RADIUS[row.kind] || DEFAULT_OBJECTIVE_RADIUS }, row));
    ctx.map.objectives.push(objective);
    return objective;
  },
  // A team pair: team 0 at (x, z); team 1 at the mirror (mirrored maps) or at its own point.
  teamPair(ctx, row, idWest, idEast, west, east) {
    const first = this.objective(ctx, Object.assign({ id: idWest, team: 0 }, row), west.x, west.z);
    if (!first) return;
    const point = ctx.mirror ? { x: -first.x, z: first.z } : east;
    const second = this.objective(ctx, Object.assign({ id: idEast, team: 1 }, row), point.x, point.z);
    if (second && ctx.mirror) Object.assign(second, { x: -first.x, y: first.y, z: first.z });
  },
  // Points spread along the map (dom, conquest, hardpoint): the plan's point spots in order.
  spread(ctx, mode, kind, count, prefix) {
    const spots = ctx.plan.points[count] || ctx.plan.points.default;
    spots.slice(0, count).forEach((spot, index) => this.objective(ctx, { id: prefix + (index + 1), kind, modes: [mode] }, spot.x, spot.z));
  },
  payload(ctx, mode) {
    const path = [];
    for (const point of ctx.plan.path) {
      const spot = this.spotNear(ctx, point.x, point.z, 4, 0);
      if (spot) path.push([spot.x, spot.y, spot.z]);
    }
    if (path.length < 4) return;
    const step = Math.floor(path.length / 4);
    ctx.map.objectives.push(MapKit.objective({ id: 'cart', kind: 'payloadPath', team: 0, x: path[0][0], y: path[0][1], z: path[0][2], radius: OBJECTIVE_RADIUS.payloadPath,
      modes: [mode], path, checkpoints: [step, step * 2, step * 3] }));
  },

  // ---- items (MAP-005) ----
  items(ctx) {
    const pickups = ctx.settings.modes.some((mode) => MapRules.rule(mode)[2]);
    const rows = pickups ? MAPGEN_PICKUP_ITEMS : ctx.plan.loot ? [] : MAPGEN_SUPPLY_ITEMS;
    if (pickups) this.topItems(ctx);
    if (ctx.plan.loot) for (const rect of ctx.plan.loot) this.lootSite(ctx, rect);
    for (const group of rows) this.itemPair(ctx, group);
  },
  // Power item and the top armor on the centre line (equal walking distance for both teams), open and away from spawns.
  topItems(ctx) {
    const spots = ctx.plan.topSpots.map((point) => this.spotNear(ctx, point.x, point.z, 3, MAPGEN_ITEM_GAP)).filter((spot) => spot && this.powerSpotOk(ctx, spot));
    const keys = [ctx.random.pick(MAPGEN_POWER_KEYS), ctx.random.pick(MapRules.topItemKeys)];
    keys.forEach((key, index) => { if (spots[index]) this.addItem(ctx, key, spots[index]); });
  },
  powerSpotOk(ctx, spot) {
    if (ctx.map.spawns.some((spawn) => spawn.team === -1 && Math.hypot(spawn.x - spot.x, spawn.z - spot.z) < MAPGEN_POWER_SPAWN_GAP)) return false;
    let open = 0;
    for (let d = 0; d < MAP_SIGHT_DIRECTIONS; d++) {
      const angle = (d / MAP_SIGHT_DIRECTIONS) * Math.PI * 2;
      if (MapScan.rayLength(ctx.scan, spot.x, spot.y + 1, spot.z, Math.cos(angle), Math.sin(angle), 5, ctx.hit) === Infinity) open++;
    }
    return open >= MAPGEN_POWER_EXPOSURE;
  },
  // A plain pickup at a seeded open spot (mirrored maps: the spot and its mirror).
  itemPair(ctx, group) {
    const spots = ctx.plan.itemSpots;
    for (let tries = 0; tries < spots.length; tries++) {
      const point = spots[ctx.random.int(0, spots.length - 1)];
      const spot = this.spotNear(ctx, point.x + ctx.random.range(-2, 2), point.z + ctx.random.range(-2, 2), 3, MAPGEN_ITEM_GAP);
      if (!spot || (ctx.mirror && (spot.x > -2 || this.roomyNode(ctx, -spot.x, spot.y, spot.z) < 0))) continue;
      const key = this.plainKey(ctx, group);
      this.addItem(ctx, key, spot);
      if (ctx.mirror) this.addItem(ctx, key, this.mirrorPoint(spot));
      return;
    }
  },
  plainKey(ctx, group) { return ctx.random.pick(MapRules.itemKeys[group].filter((item) => !MapRules.topItemKeys.includes(item))); },
  addItem(ctx, key, spot) {
    ctx.map.items.push(MapKit.item([key, spot.x, spot.y, spot.z]));
    this.take(ctx, spot);
  },
  // Royale loot site (GN5 POIs): weapons, armor, health and ammo spread inside the compound.
  lootSite(ctx, rect) {
    const spots = ctx.random.shuffle(this.spotsIn(ctx, rect, 1.5));
    for (const group of MAPGEN_LOOT_GROUPS) {
      const spot = spots.find((candidate) => !this.isTaken(ctx, candidate.x, candidate.z, MAPGEN_ITEM_GAP));
      if (spot) this.addItem(ctx, this.plainKey(ctx, group), spot);
    }
  },

  // ---- nav hints: chokes at doors, sniper spots on platforms, cover elsewhere ----
  hints(ctx) {
    for (const hint of ctx.plan.hints) {
      if (ctx.map.navHints.length >= MAPGEN_HINTS) break;
      const spot = this.spotNear(ctx, hint.x, hint.z, 2, 0);
      if (spot) ctx.map.navHints.push(MapKit.hint([hint.kind, spot.x, spot.y, spot.z]));
    }
    for (const point of ctx.plan.itemSpots) {
      if (ctx.map.navHints.length >= MAPGEN_HINTS) break;
      const spot = this.spotNear(ctx, point.x, point.z, 3, 0);
      if (spot) ctx.map.navHints.push(MapKit.hint(['cover', spot.x, spot.y, spot.z]));
    }
  },
};

const MAPGEN_POWER_KEYS = ['fury', 'warding', 'quickening', 'surplus', 'renewal', 'skyward'];
const MAPGEN_PICKUP_ITEMS = ['weapon', 'weapon', 'weapon', 'armor', 'armor', 'health', 'health', 'health', 'ammo', 'ammo'];
const MAPGEN_SUPPLY_ITEMS = ['health', 'health', 'ammo', 'armor'];
const MAPGEN_LOOT_GROUPS = ['weapon', 'weapon', 'weapon', 'armor', 'armor', 'health', 'health', 'ammo'];   // per loot site (6 sites: the 48 spots of MP09)

// Objective placement per mode (MapRules.modes lists what each needs). ctx.plan supplies the anchor points.
const MAPGEN_OBJECTIVES = {
  ctf: (ctx, mode) => {
    MapGenPlace.teamPair(ctx, { kind: 'flag', modes: [mode] }, 'flagWest', 'flagEast', ctx.plan.flags[0], ctx.plan.flags[1]);
    MapGenPlace.teamPair(ctx, { kind: 'flagBase', modes: [mode] }, 'baseWest', 'baseEast', ctx.plan.flags[0], ctx.plan.flags[1]);
  },
  oneflag: (ctx, mode) => {
    MapGenPlace.objective(ctx, { id: 'flagMid', kind: 'flag', team: -1, modes: [mode] }, ctx.plan.centre.x, ctx.plan.centre.z);
    MapGenPlace.teamPair(ctx, { kind: 'flagBase', modes: [mode] }, 'baseWest', 'baseEast', ctx.plan.flags[0], ctx.plan.flags[1]);
  },
  bank: (ctx, mode) => MapGenPlace.teamPair(ctx, { kind: 'bank', modes: [mode] }, 'bankWest', 'bankEast', ctx.plan.flags[0], ctx.plan.flags[1]),
  dom: (ctx, mode) => MapGenPlace.spread(ctx, mode, 'point', 3, 'dom'),
  conquest: (ctx, mode) => MapGenPlace.spread(ctx, mode, 'point', 5, 'flag'),
  hardpoint: (ctx, mode) => MapGenPlace.spread(ctx, mode, 'hill', 5, 'hill'),
  control: (ctx, mode) => MapGenPlace.objective(ctx, { id: 'uplink', kind: 'point', modes: [mode] }, ctx.plan.centre.x, ctx.plan.centre.z),
  oddball: (ctx, mode) => MapGenPlace.objective(ctx, { id: 'relic', kind: 'relic', modes: [mode] }, ctx.plan.centre.x, ctx.plan.centre.z),
  bomb: (ctx, mode) => ctx.plan.sites.forEach((site, index) => MapGenPlace.objective(ctx, { id: index ? 'siteB' : 'siteA', kind: 'bombsite', team: 1, modes: [mode] }, site.x, site.z)),
  ghostops: (ctx, mode) => MAPGEN_OBJECTIVES.bomb(ctx, mode),
  rush: (ctx, mode) => ctx.plan.stages.forEach((pair, stage) => pair.forEach((site, index) => MapGenPlace.objective(ctx,
    { id: 'rush' + (stage + 1) + (index ? 'b' : 'a'), kind: 'bombsite', team: 1, stage: stage + 1, modes: [mode] }, site.x, site.z))),
  payload: (ctx, mode) => MapGenPlace.payload(ctx, mode),
  horde: (ctx, mode) => MapGenPlace.objective(ctx, { id: 'core', kind: 'core', modes: [mode] }, ctx.plan.core.x, ctx.plan.core.z),
  endless: (ctx, mode) => {
    MapGenPlace.objective(ctx, { id: 'coreEndless', kind: 'core', modes: [mode] }, ctx.plan.core.x, ctx.plan.core.z);
    MapGenPlace.objective(ctx, { id: 'extract', kind: 'extract', modes: [mode] }, ctx.plan.exit.x, ctx.plan.exit.z);
  },
  contract: (ctx, mode) => {
    MapGenPlace.objective(ctx, { id: 'target', kind: 'relic', modes: [mode] }, ctx.plan.core.x, ctx.plan.core.z);
    MapGenPlace.objective(ctx, { id: 'extractContract', kind: 'extract', modes: [mode] }, ctx.plan.exit.x, ctx.plan.exit.z);
  },
};
