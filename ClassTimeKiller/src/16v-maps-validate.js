// ==== S16 MAPS: VALIDATOR ====
// Maps.validate(map) -> problem strings (empty = sound). Covers MAP-001..MAP-012 without any movement code: structure, spawns
// (floor, free space, spread, cross-team sight, counts per mode), items (MAP-005), objectives per mode, callout zones, triggers,
// connectivity (every spawn, item, objective and hint lies in one walkable loop), open edges, lanes, sightlines and lighting.
// Generated maps use the same validator (MAP-023).

const MAP_MAX_REPORTED = 5;          // problems listed per rule, the rest are summarised
const MAP_ZONE_COVERAGE = 0.97;      // share of walkable cells that must lie in a callout zone
const MAP_ROOF_HEIGHT = 10;          // a surface with a ceiling closer than this counts as indoors
const MAP_ROUTE_FREE = 6;            // metres around both route ends that the lane test never blocks
const MAP_ROUTE_BLOCK = 2.5;         // radius blocked around each found route before looking for the next
const MAP_ROUTE_BLOCK_HEIGHT = 3;    // only surfaces within this height of the route are blocked (a bridge does not block the floor under it)
const MAP_CHEST = 1.2;               // chest height used for spawn facing checks
const MAP_SPAWN_FACING = 2;          // free distance ahead of a spawn, metres
const MAP_SIGHT_DIRECTIONS = 16;
const MAP_SIGHT_SPACING = 4;         // sightline origins lie on a lattice this many metres apart
const MAP_TEAM_SPAWN_DISTANCE = 25;  // MAP-010: nearest enemy spawn must be at least this far
const MAP_BALANCE_LIMIT = 0.3;       // team maps: item distance to each team's spawns may differ by this share
const MAP_REQUIRED_LISTS = ['brushes', 'spawns', 'items', 'objectives', 'zones', 'triggers', 'lights', 'navHints'];   // every map row carries all of these
const MAP_LOCATE_TEXT = ['', 'has no standing floor (needs 1.4 m wide and 2.4 m high free space)', 'is not on the walkable grid', 'is cut off from the main play space'];
const MAP_MAX_ROUTES = 4;
const MAP_LIGHT_REACH = 2;           // a light this close to a zone box lights the zone
const MAP_NO_LANES = ['range', 'puzzle'];   // categories exempt from the three-lane rule (MAP-002)
const MAP_SPAWN_ZONES = 4;          // free-for-all spawns must cover at least this many callout zones
const MAP_FALL_MAX = 12;             // a fall this long is survivable in every movement preset; longer needs a kill zone (MOV-015)
const MAP_RAMP_DIRS = ['+x', '-x', '+z', '-z'];
const MAP_FORM_RULES = [['brushes', 'brushProblem'], ['triggers', 'triggerProblem'], ['lights', 'lightProblem'], ['items', 'itemKeyProblem'],
  ['objectives', 'objectiveKeyProblem'], ['navHints', 'hintKeyProblem'], ['props', 'propProblem']];   // map list, MapCheck form rule of one row

const mapGap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);                    // distance between two points that carry x, y, z
const mapPairs = (list) => list.flatMap((a, i) => list.slice(i + 1).map((b) => [a, b])); // every unordered pair
const mapCross = (listA, listB) => listA.flatMap((a) => listB.map((b) => [a, b]));      // every a-b pair

const MapCheck = {
  run(map) {
    const ctx = { map, problems: [], counts: {}, stats: {}, scan: null, loop: null, hit: makeHit() };
    ctx.add = (rule, text) => {
      ctx.counts[rule] = (ctx.counts[rule] || 0) + 1;
      if (ctx.counts[rule] <= MAP_MAX_REPORTED) ctx.problems.push(rule + ': ' + text);
    };
    this.structure(ctx);
    if (!ctx.problems.length) this.analyse(ctx);
    MapScan.release();
    for (const rule in ctx.counts) if (ctx.counts[rule] > MAP_MAX_REPORTED) ctx.problems.push(rule + ': ... and ' + (ctx.counts[rule] - MAP_MAX_REPORTED) + ' more');
    return { id: map.id, problems: ctx.problems, stats: ctx.stats };
  },

  analyse(ctx) {
    ctx.scan = MapScan.of(ctx.map);
    ctx.loop = this.mainLoop(ctx);
    this.stats(ctx);
    this.spawns(ctx);
    this.items(ctx);
    this.objectives(ctx);
    this.hints(ctx);
    this.zones(ctx);
    this.triggers(ctx);
    this.openEdges(ctx);
    this.lanes(ctx);
    this.sightlines(ctx);
  },

  // ---- helpers ----
  fmt(x, y, z) { return '(' + x.toFixed(1) + ', ' + y.toFixed(1) + ', ' + z.toFixed(1) + ')'; },
  finite(list, length) { return Array.isArray(list) && list.length === length && list.every((n) => typeof n === 'number' && isFinite(n)); },
  // Node for a point (cached), or a negative code explaining why there is none: -1 no floor, -2 off grid, -3 cut off.
  locate(ctx, x, y, z) {
    const scan = ctx.scan, count = MapScan.surfacesAt(scan, x, z);
    let floor = false;
    for (let k = 0; k < count; k++) if (Math.abs(scan.heights[k] - y) <= MAP_FLOOR_TOLERANCE) floor = true;
    if (!floor) return -1;
    const node = MapScan.nodeNear(scan, x, y, z, 0.5);
    if (node < 0) return -2;
    return ctx.loop[node] ? node : -3;
  },
  // locate() plus the standard problem message; returns the node or -1.
  place(ctx, rule, label, x, y, z) {
    const node = this.locate(ctx, x, y, z);
    if (node < 0) ctx.add(rule, label + ' at ' + this.fmt(x, y, z) + ' ' + MAP_LOCATE_TEXT[-node]);
    return node;
  },
  // The spawns of any of the modes for one team, each listed once.
  spawnsOfModes(map, modes, team) { return Array.from(new Set(modes.flatMap((mode) => Maps.spawnList(map, mode, team)))); },

  // ---- structure (MAP-001) ----
  structure(ctx) {
    const map = ctx.map;
    for (const text of this.headerProblems(map)) ctx.add('structure', text);
    if (!Array.isArray(map.modes) || !map.modes.length) ctx.add('structure', 'no modes listed');
    if (!this.finite(map.size, 3)) return;
    const missing = MAP_REQUIRED_LISTS.filter((key) => !Array.isArray(map[key]));
    for (const key of missing) ctx.add('structure', key + ' list is missing');
    if (missing.length) return;
    map.triggers.forEach((trigger, index) => this.report(ctx, 'triggers', 'trigger #' + index + ' ' + trigger.kind + ': ', this.triggerProblem(trigger)));
    if (map.brushes.length > MapRules.limits.brushes) ctx.add('budget', map.brushes.length + ' brushes, limit ' + MapRules.limits.brushes);
    map.brushes.forEach((brush, index) => this.report(ctx, 'brush', '#' + index + ' ', this.brushProblem(brush) || this.brushLimitProblem(map, brush)));
    if (map.lights.length > MapRules.limits.lights) ctx.add('budget', map.lights.length + ' lights, limit ' + MapRules.limits.lights);
    map.lights.forEach((light, index) => this.report(ctx, 'light', '#' + index + ' ', this.lightProblem(light)));
    (map.props || []).forEach((prop, index) => this.report(ctx, 'props', '#' + index + ' ', this.propProblem(prop)));
  },
  report(ctx, rule, label, text) { if (text) ctx.add(rule, label + text); },

  // ---- form rules: one checker for every map row (hand-made, generated, and the editor's saved maps and codes, 16x) ----
  // Each returns '' or the problem text. Design limits (budgets, ramp slopes, map bounds, placement) are not form rules.
  // The first form problem of a map row ('' = well formed): the editor refuses a code or saved map that has one.
  formProblem(map) {
    const header = this.headerProblems(map);
    if (header.length) return header[0];
    for (const [list, rule] of MAP_FORM_RULES) {
      const rows = map[list] || [];
      for (let i = 0; i < rows.length; i++) {
        const text = this[rule](rows[i]);
        if (text) return list + ' #' + i + ' ' + text;
      }
    }
    return '';
  },
  // The header: id, name, size, theme, category, sky and known modes (an empty mode list is a design problem: unfinished editor maps have one).
  headerProblems(map) {
    const problems = [];
    if (typeof map.id !== 'string' || !map.id || typeof map.name !== 'string' || !map.name) problems.push('id and name are required');
    if (!this.finite(map.size, 3) || map.size.some((n) => n <= 0)) problems.push('size must be [x, y, z] metres');
    if (!MapRules.themes.includes(map.theme)) problems.push('unknown theme ' + map.theme);
    if (!mapOwnKey(MapRules.sightLimits, map.category)) problems.push('unknown category ' + map.category);
    if (!map.sky || !mapColorIs(map.sky.top) || !mapColorIs(map.sky.horizon)) problems.push('sky needs top and horizon colours');
    for (const mode of Array.isArray(map.modes) ? map.modes : []) if (!MapRules.rule(mode)) problems.push('unknown mode ' + mode);
    return problems;
  },
  brushProblem(brush) {
    if (brush.shape !== 'box' && brush.shape !== 'ramp') return 'shape must be box or ramp';
    if (!this.finite(brush.min, 3) || !this.finite(brush.max, 3)) return 'min and max must be three numbers';
    for (let axis = 0; axis < 3; axis++) if (brush.max[axis] - brush.min[axis] < 0.05) return 'min must be below max on every axis';
    if (!MapRules.materials.includes(brush.material)) return 'unknown material ' + brush.material;
    return brush.shape === 'ramp' && !MAP_RAMP_DIRS.includes(brush.dir) ? 'ramp needs dir +x, -x, +z or -z' : '';
  },
  lightProblem(light) {
    return this.finite([light.x, light.y, light.z, light.radius], 4) && light.radius > 0 && mapColorIs(light.color) ? '' : 'is invalid';
  },
  itemKeyProblem(item) {
    const group = MapRules.groupOf(item.item);
    if (!group) return 'is not a map item key';
    return group === item.group ? '' : 'belongs to group ' + group + ', not ' + item.group;
  },
  objectiveKeyProblem(o) { return MapRules.objectiveKinds.includes(o.kind) && typeof o.id === 'string' ? '' : 'has no valid id or kind'; },
  // A breakable prop (S08 Props): a box with min below max, the material (optional) a map material.
  propProblem(prop) {
    const box = this.finite(prop.min, 3) && this.finite(prop.max, 3) && prop.min.every((v, i) => v < prop.max[i]);
    return box && (prop.material === undefined || MapRules.materials.includes(prop.material)) ? '' : 'is invalid';
  },
  hintKeyProblem(hint) { return MapRules.hintKinds.includes(hint.kind) ? '' : 'has unknown kind ' + hint.kind; },
  triggerProblem(t) {
    if (!MapRules.triggerKinds.includes(t.kind)) return 'unknown kind';
    if (!this.finite(t.min, 3) || !this.finite(t.max, 3) || t.min.some((v, i) => v >= t.max[i])) return 'min must be below max';
    if (t.kind === 'jumppad' && (!this.finite(t.target, 3) || !(t.peak > 0))) return 'target [x, y, z] and peak > 0 needed';
    if (t.kind === 'teleporter' && (!this.finite(t.exit, 3) || typeof t.yaw !== 'number')) return 'exit [x, y, z] and yaw needed';
    if (t.kind === 'hazard' && !(t.damage > 0 && MapRules.elements.includes(t.element))) return 'hazard needs damage > 0 and an element (' + MapRules.elements.join('/') + ')';
    return '';
  },
  brushLimitProblem(map, brush) { return (brush.shape === 'ramp' && this.rampProblem(brush)) || this.boundsProblem(map, brush); },
  rampProblem(brush) {
    const run = brush.dir.endsWith('x') ? brush.max[0] - brush.min[0] : brush.max[2] - brush.min[2];
    const degrees = Math.atan2(brush.max[1] - brush.min[1], run) / DEG;
    return degrees > MapRules.limits.rampMaxDegrees ? 'ramp slope ' + degrees.toFixed(1) + ' deg is steeper than ' + MapRules.limits.rampMaxDegrees : '';
  },
  boundsProblem(map, brush) {
    const shell = MapRules.limits.shellThickness, half = [map.size[0] / 2 + shell, map.size[2] / 2 + shell];
    const outside = brush.min[0] < -half[0] || brush.max[0] > half[0] || brush.min[2] < -half[1] || brush.max[2] > half[1] || brush.max[1] > map.size[1] + shell || brush.min[1] < -10;
    return outside ? 'lies outside the map size' : '';
  },

  // ---- connectivity ----
  // The largest strongly connected walkable region found from a few spawn points (every point of interest must lie in it).
  mainLoop(ctx) {
    const scan = ctx.scan, spawns = ctx.map.spawns;
    const step = Math.max(1, Math.floor(spawns.length / 4));
    let best = new Uint8Array(scan.nodeCount), bestSize = -1;
    for (let i = 0; i < spawns.length; i += step) {
      const node = MapScan.nodeNear(scan, spawns[i].x, spawns[i].y, spawns[i].z, 0.5);
      if (node < 0 || best[node]) continue;                     // already in the best loop: its loop is that same loop
      const loop = MapScan.loopOf(scan, node), size = loop.reduce((sum, v) => sum + v, 0);
      if (size > bestSize) { best = loop; bestSize = size; }
    }
    ctx.stats.loopCells = bestSize;
    return best;
  },
  stats(ctx) {
    const map = ctx.map, s = ctx.stats;
    s.brushes = map.brushes.length; s.nodes = ctx.scan.nodeCount; s.spawns = map.spawns.length; s.items = map.items.length;
    s.zones = map.zones.length; s.hash = Maps.hash(map); s.hazardCells = ctx.scan.hazardNodes;
    s.loopShare = ctx.stats.loopCells / Math.max(1, ctx.scan.nodeCount);
  },

  // ---- spawns (MAP-010, MAP-011) ----
  spawns(ctx) {
    const map = ctx.map;
    map.spawns.forEach((spawn, index) => {
      if (!this.finite([spawn.x, spawn.y, spawn.z, spawn.yaw], 4) || ![-1, 0, 1].includes(spawn.team)) return ctx.add('spawn', '#' + index + ' has bad numbers or team');
      for (const mode of mapModesOf(spawn)) if (!map.modes.includes(mode)) ctx.add('spawn', '#' + index + ' lists mode ' + mode + ' the map does not offer');
      if (this.place(ctx, 'spawn', '#' + index + ' (team ' + spawn.team + ')', spawn.x, spawn.y, spawn.z) >= 0) this.facing(ctx, spawn);
    });
    this.spawnCounts(ctx);
    this.spawnSpacing(ctx);
    this.teamSpawnSafety(ctx);
  },
  // A spawn must not look straight at a wall: some open space (MAP_SPAWN_FACING) lies ahead at chest height.
  facing(ctx, spawn) {
    const yaw = spawn.yaw * DEG;
    const hit = MapScan.rayLength(ctx.scan, spawn.x, spawn.y + MAP_CHEST, spawn.z, Math.sin(yaw), Math.cos(yaw), MAP_SPAWN_FACING, ctx.hit);
    if (hit < MAP_SPAWN_FACING) ctx.add('spawn-facing', 'spawn at ' + this.fmt(spawn.x, spawn.y, spawn.z) + ' faces a wall ' + hit.toFixed(1) + ' m away');
  },
  spawnCounts(ctx) {
    for (const mode of ctx.map.modes) {
      for (const [team, minimum] of MapRules.spawnRules[MapRules.rule(mode)[0]]) {
        const have = Maps.spawnList(ctx.map, mode, team).length;
        if (have < minimum) ctx.add('spawn-count', mode + ' needs ' + minimum + ' spawns for team ' + team + ', has ' + have);
      }
    }
  },
  // Free-for-all spawns: no two closer than 5 m, and spread over several callout zones.
  spawnSpacing(ctx) {
    const free = ctx.map.spawns.filter((spawn) => spawn.team === -1);
    for (const [a, b] of mapPairs(free)) {
      if (mapGap(a, b) < MapRules.limits.ffaSpawnSpacing) ctx.add('spawn-spread', 'free spawns at ' + this.fmt(a.x, a.y, a.z) + ' and ' + this.fmt(b.x, b.y, b.z)
          + ' are closer than ' + MapRules.limits.ffaSpawnSpacing + ' m');
    }
    const zones = new Set(free.map((spawn) => Maps.zoneAt(ctx.map, spawn.x, spawn.y, spawn.z)).filter((zone) => zone).map((zone) => zone.name));
    ctx.stats.spawnZones = zones.size;
    if (free.length && zones.size < Math.min(MAP_SPAWN_ZONES, Math.floor(ctx.map.zones.length / 2))) ctx.add('spawn-spread', 'free spawns cover only ' + zones.size + ' callout zones');
  },
  // MAP-010/011: opposing team spawns at least 25 m apart and never in sight of each other.
  teamSpawnSafety(ctx) {
    const teamModes = ctx.map.modes.filter((mode) => MapRules.rule(mode)[0] === 'teams');
    if (!teamModes.length) return;
    const side = [0, 1].map((team) => this.spawnsOfModes(ctx.map, teamModes, team));
    for (const [a, b] of mapCross(side[0], side[1])) this.spawnPair(ctx, a, b);
  },
  spawnPair(ctx, a, b) {
    const distance = mapGap(a, b);
    if (distance < MAP_TEAM_SPAWN_DISTANCE) ctx.add('spawn-safety', 'enemy spawns ' + this.fmt(a.x, a.y, a.z) + ' and ' + this.fmt(b.x, b.y, b.z) + ' are only '
        + distance.toFixed(0) + ' m apart');
    else if (MapScan.clearBetween(ctx.scan, a.x, a.y + 1.5, a.z, b.x, b.y + 1.5, b.z, ctx.hit)) ctx.add('spawn-safety', 'enemy spawns ' + this.fmt(a.x, a.y, a.z)
        + ' and ' + this.fmt(b.x, b.y, b.z) + ' see each other');
  },

  // ---- items (MAP-005) ----
  items(ctx) {
    const map = ctx.map, items = map.items;
    const wanted = map.modes.some((mode) => MapRules.rule(mode)[2]);
    if (wanted && items.length < MapRules.limits.pickupItems) ctx.add('items', 'pickup modes need at least ' + MapRules.limits.pickupItems + ' item spots');
    const nodes = items.map((item, index) => this.itemProblem(ctx, item, index));
    if (wanted) for (const group of ['health', 'armor', 'weapon']) if (!items.some((item) => item.group === group)) ctx.add('items', 'no ' + group + ' item');
    this.itemSpacing(ctx);
    this.topItems(ctx, nodes);
  },
  itemProblem(ctx, item, index) {
    const label = 'item #' + index + ' ' + item.item;
    if (!this.finite([item.x, item.y, item.z], 3)) { ctx.add('items', label + ' has bad numbers'); return -1; }
    this.report(ctx, 'items', label + ' ', this.itemKeyProblem(item));
    for (const mode of mapModesOf(item)) if (!ctx.map.modes.includes(mode)) ctx.add('items', label + ' lists mode ' + mode + ' the map does not offer');
    return this.place(ctx, 'items', label, item.x, item.y, item.z);
  },
  itemSpacing(ctx) {
    const limits = MapRules.limits;
    for (const [a, b] of mapPairs(ctx.map.items)) {
      const distance = mapGap(a, b);
      if (distance < limits.itemSpacing) ctx.add('items', a.item + ' and ' + b.item + ' are ' + distance.toFixed(1) + ' m apart (minimum ' + limits.itemSpacing + ')');
      if (a.group === 'power' && b.group === 'power' && distance < limits.powerSpacing) ctx.add('items', 'power items ' + a.item + ' and ' + b.item + ' are '
          + distance.toFixed(1) + ' m apart (minimum ' + limits.powerSpacing + ')');
    }
  },
  isTopItem(item) { return item.group === 'power' || MapRules.topItemKeys.includes(item.item); },
  // Power items and the top armor / health: one per zone, exposed, away from spawns, balanced between teams, shared out between spawns.
  topItems(ctx, nodes) {
    const tops = [];
    ctx.map.items.forEach((item, index) => { if (this.isTopItem(item) && nodes[index] >= 0) tops.push({ item, node: nodes[index] }); });
    ctx.stats.topItems = tops.length;
    const zoneSeen = new Map();
    for (const top of tops) this.topItemZone(ctx, top, zoneSeen);
    for (const top of tops) if (top.item.group === 'power') this.exposure(ctx, top);
    this.topItemBalance(ctx, tops);
  },
  topItemZone(ctx, top, zoneSeen) {
    const zone = Maps.zoneAt(ctx.map, top.item.x, top.item.y, top.item.z);
    if (!zone) return;
    if (zoneSeen.has(zone.name)) ctx.add('items', 'zone ' + zone.name + ' holds two top items: ' + zoneSeen.get(zone.name) + ' and ' + top.item.item);
    zoneSeen.set(zone.name, top.item.item);
  },
  exposure(ctx, top) {
    const scan = ctx.scan, item = top.item;
    let open = 0;
    for (let d = 0; d < MAP_SIGHT_DIRECTIONS; d++) {
      const angle = (d / MAP_SIGHT_DIRECTIONS) * Math.PI * 2;
      if (MapScan.rayLength(scan, item.x, item.y + 1, item.z, Math.cos(angle), Math.sin(angle), 5, ctx.hit) === Infinity) open++;
    }
    if (open < MapRules.limits.minExposure) ctx.add('items', 'power item ' + item.item + ' is boxed in (' + open + ' of ' + MAP_SIGHT_DIRECTIONS
        + ' directions open, needs ' + MapRules.limits.minExposure + ')');
  },
  topItemBalance(ctx, tops) {
    const map = ctx.map;
    const teamMode = map.modes.find((mode) => MapRules.rule(mode)[0] === 'teams' && MapRules.rule(mode)[2]);
    const freeSpawns = this.spawnsOfModes(map, map.modes.filter((mode) => MapRules.rule(mode)[2]), -1);
    const nearest = new Map();
    for (const top of tops) {
      const { dist } = MapScan.distances(ctx.scan, [top.node], null, true);    // walking distance from every node TO the item
      if (teamMode) this.teamBalance(ctx, top, dist, teamMode);
      this.countNearest(ctx, top, dist, freeSpawns, nearest);
    }
    this.shareCheck(ctx, tops.length, nearest);
  },
  pathToSpawns(ctx, dist, spawns) {
    let sum = 0, count = 0;
    for (const spawn of spawns) {
      const node = MapScan.nodeNear(ctx.scan, spawn.x, spawn.y, spawn.z, 0.5);
      if (node >= 0 && isFinite(dist[node])) { sum += dist[node]; count++; }
    }
    return count ? sum / count : Infinity;
  },
  teamBalance(ctx, top, dist, teamMode) {
    const a = this.pathToSpawns(ctx, dist, Maps.spawnList(ctx.map, teamMode, 0)), b = this.pathToSpawns(ctx, dist, Maps.spawnList(ctx.map, teamMode, 1));
    if (Math.abs(a - b) / Math.max(a, b) > MAP_BALANCE_LIMIT) ctx.add('items', top.item.item + ' is ' + a.toFixed(0) + ' m from team 0 spawns but ' + b.toFixed(0)
        + ' m from team 1 (limit ' + MAP_BALANCE_LIMIT * 100 + '% difference)');
  },
  countNearest(ctx, top, dist, spawns, nearest) {
    let bestIndex = -1, bestDistance = Infinity;
    spawns.forEach((spawn, index) => {
      const node = MapScan.nodeNear(ctx.scan, spawn.x, spawn.y, spawn.z, 0.5);
      if (node >= 0 && dist[node] < bestDistance) { bestDistance = dist[node]; bestIndex = index; }
    });
    if (bestIndex < 0) return;
    nearest.set(bestIndex, (nearest.get(bestIndex) || 0) + 1);
    if (top.item.group === 'power' && bestDistance < MapRules.limits.ffaSpawnSpacing + 3) ctx.add('items', 'power item ' + top.item.item + ' is only '
        + bestDistance.toFixed(0) + ' m from a spawn');
  },
  // MAP-005 target: no single spawn is the closest one to more than half of the top items.
  shareCheck(ctx, total, nearest) {
    let most = 0;
    for (const count of nearest.values()) most = Math.max(most, count);
    ctx.stats.topItemShare = total ? most / total : 0;
    if (total >= 3 && ctx.stats.topItemShare > MapRules.limits.topItemShare) ctx.add('items', 'one spawn is closest to ' + Math.round(ctx.stats.topItemShare * 100)
        + '% of the top items (limit ' + MapRules.limits.topItemShare * 100 + '%)');
  },

  // ---- objectives ----
  objectives(ctx) {
    const map = ctx.map;
    map.objectives.forEach((objective, index) => this.objectiveProblem(ctx, objective, index));
    for (const mode of map.modes) {
      for (const [kind, minimum] of MapRules.rule(mode)[1]) {
        const have = Maps.objectivesFor(map, mode, kind).length;
        if (have < minimum) ctx.add('objectives', mode + ' needs ' + minimum + ' ' + kind + ' objective(s), has ' + have);
      }
    }
    this.teamObjectives(ctx);
  },
  objectiveProblem(ctx, o, index) {
    const label = 'objective ' + o.id + ' (' + o.kind + ')';
    const formText = this.objectiveKeyProblem(o);
    if (formText) return ctx.add('objectives', '#' + index + ' ' + formText);
    if (!this.finite([o.x, o.y, o.z, o.radius], 4) || o.radius <= 0) return ctx.add('objectives', label + ' has bad numbers');
    for (const mode of mapModesOf(o)) if (!ctx.map.modes.includes(mode)) ctx.add('objectives', label + ' lists mode ' + mode + ' the map does not offer');
    this.place(ctx, 'objectives', label, o.x, o.y, o.z);
    if (o.kind === 'payloadPath') this.pathProblem(ctx, o, label);
  },
  pathProblem(ctx, o, label) {
    if (!Array.isArray(o.path) || o.path.length < 4) return ctx.add('objectives', label + ' path needs at least 4 points');
    o.path.forEach((p, i) => {
      if (!this.finite(p, 3)) ctx.add('objectives', label + ' path point ' + i + ' is invalid');
      else this.place(ctx, 'objectives', label + ' path point ' + i, p[0], p[1], p[2]);
    });
    for (const index of o.checkpoints || []) if (!(index > 0 && index < o.path.length)) ctx.add('objectives', label + ' checkpoint ' + index + ' is not a path index');
  },
  // Capture-the-flag style modes need one object / base per team.
  teamObjectives(ctx) {
    const map = ctx.map;
    for (const [mode, kind, teams] of [['ctf', 'flag', [0, 1]], ['ctf', 'flagBase', [0, 1]], ['oneflag', 'flagBase', [0, 1]], ['oneflag', 'flag', [-1]], ['bank', 'bank', [0, 1]]]) {
      if (!map.modes.includes(mode)) continue;
      const have = Maps.objectivesFor(map, mode, kind).map((o) => o.team);
      for (const team of teams) if (!have.includes(team)) ctx.add('objectives', mode + ' has no ' + kind + ' for team ' + team);
    }
  },

  // ---- nav hints ----
  hints(ctx) {
    const hints = ctx.map.navHints;
    if (hints.length < MapRules.limits.hints) ctx.add('hints', 'only ' + hints.length + ' nav hints (minimum ' + MapRules.limits.hints + ')');
    hints.forEach((hint, index) => {
      const formText = this.hintKeyProblem(hint);
      if (formText) ctx.add('hints', '#' + index + ' ' + formText);
      else this.place(ctx, 'hints', 'hint #' + index + ' ' + hint.kind, hint.x, hint.y, hint.z);
    });
  },

  // ---- callout zones (MAP-012) and lighting ----
  zones(ctx) {
    const map = ctx.map, names = new Set();
    if (map.zones.length < MapRules.limits.zones) ctx.add('zones', 'only ' + map.zones.length + ' callout zones');
    for (const zone of map.zones) {
      if (names.has(zone.name)) ctx.add('zones', 'duplicate zone name ' + zone.name);
      names.add(zone.name);
      if (!this.finite(zone.min, 3) || !this.finite(zone.max, 3) || zone.min.some((v, i) => v >= zone.max[i])) ctx.add('zones', zone.name + ' has an invalid box');
    }
    this.zoneCoverage(ctx);
    this.zonePoints(ctx);
  },
  zonePoints(ctx) {
    const map = ctx.map;
    const points = [].concat(map.spawns.map((p) => ['spawn', p]), map.items.map((p) => ['item', p]), map.objectives.map((p) => ['objective ' + p.id, p]),
        map.navHints.map((p) => ['hint', p]));
    for (const [label, p] of points) if (!Maps.zoneAt(map, p.x, p.y, p.z)) ctx.add('zones', label + ' at ' + this.fmt(p.x, p.y, p.z) + ' is in no callout zone');
  },
  // Every walkable cell belongs to a zone; zones that are mostly indoors need a light.
  zoneCoverage(ctx) {
    const scan = ctx.scan, tally = new Map();
    let total = 0, covered = 0;
    for (let n = 0; n < scan.nodeCount; n++) {
      if (!ctx.loop[n]) continue;
      total++;
      const x = MapScan.nodeX(scan, n), z = MapScan.nodeZ(scan, n), y = scan.nodeY[n];
      const zone = Maps.zoneAt(ctx.map, x, y, z);
      if (!zone) continue;
      covered++;
      this.tallyRoof(tally, zone, MapScan.ceilingAbove(scan, x, z, y) - y < MAP_ROOF_HEIGHT);
    }
    ctx.stats.zoneCoverage = total ? covered / total : 0;
    if (ctx.stats.zoneCoverage < MAP_ZONE_COVERAGE) ctx.add('zones', 'only ' + Math.round(ctx.stats.zoneCoverage * 100) + '% of the walkable area lies in a callout zone');
    this.lighting(ctx, tally);
  },
  tallyRoof(tally, zone, roofed) {
    const entry = tally.get(zone) || { total: 0, roofed: 0 };
    entry.total++;
    if (roofed) entry.roofed++;
    tally.set(zone, entry);
  },
  lighting(ctx, tally) {
    for (const [zone, entry] of tally) {
      if (entry.total < 20 || entry.roofed / entry.total < 0.25) continue;
      const lit = ctx.map.lights.some((light) => mapInBox(zone, light.x, light.y, light.z, MAP_LIGHT_REACH, MAP_LIGHT_REACH));
      if (!lit) ctx.add('lights', 'indoor zone ' + zone.name + ' has no light (no dark campable corners)');
    }
  },

  // ---- triggers ----
  triggers(ctx) {
    const scan = ctx.scan;
    for (const pad of scan.pads) this.padProblem(ctx, pad);
    for (const tele of scan.teleporters) this.teleporterProblem(ctx, tele);
    for (const ladder of scan.ladders) this.ladderProblem(ctx, ladder);
  },
  // Where a trigger box starts, for messages.
  corner(trigger) { return this.fmt(trigger.min[0], trigger.min[1], trigger.min[2]); },
  ladderProblem(ctx, ladder) {
    if (ladder.bottoms && ladder.tops) return;
    ctx.add('triggers', 'ladder at ' + this.corner(ladder.trigger) + ' has ' + ladder.bottoms + ' foot cells and ' + ladder.tops + ' top cells');
  },
  padProblem(ctx, pad) {
    const where = this.corner(pad.trigger);
    if (!pad.entries) ctx.add('triggers', 'jump pad at ' + where + ' has no floor to stand on');
    if (pad.landing < 0) return ctx.add('triggers', 'jump pad at ' + where + ' lands on nothing walkable');
    if (!ctx.loop[pad.landing]) ctx.add('triggers', 'jump pad at ' + where + ' lands in a cut-off place');
    else if (!pad.firm) ctx.add('triggers', 'jump pad at ' + where + ' lands less than ' + ACTOR_RADIUS + ' m from the edge of its floor');
    if (pad.open < pad.entries) ctx.add('triggers', 'jump pad at ' + where + ': the arc from ' + (pad.entries - pad.open) + ' of ' + pad.entries + ' start cells hits geometry');
  },
  teleporterProblem(ctx, tele) {
    const where = this.corner(tele.trigger);
    if (!tele.entries) ctx.add('triggers', 'teleporter at ' + where + ' has no floor to stand on');
    if (tele.exit < 0) ctx.add('triggers', 'teleporter at ' + where + ' exits onto nothing walkable');
    else if (!ctx.loop[tele.exit]) ctx.add('triggers', 'teleporter at ' + where + ' exits into a cut-off place');
  },

  // ---- open edges: a ledge the player can walk off must end on a floor within 6 m or in a kill zone (MAP-001) ----
  openEdges(ctx) {
    const scan = ctx.scan;
    const targets = new Int32Array(8);
    for (let n = 0; n < scan.nodeCount; n++) {
      if (!ctx.loop[n]) continue;
      this.edgeNode(ctx, n, targets);
    }
  },
  edgeNode(ctx, n, targets) {
    const scan = ctx.scan, column = scan.nodeColumn[n], ci = column % scan.cols, cj = (column / scan.cols) | 0;
    for (let d = 0; d < 4; d++) {
      if (MapScan.stepTarget(scan, n, ci + MAP_NEIGHBOUR_I[d], cj + MAP_NEIGHBOUR_J[d]) >= 0) continue;
      const x = scan.originX + (ci + MAP_NEIGHBOUR_I[d] + 0.5) * scan.cell, z = scan.originZ + (cj + MAP_NEIGHBOUR_J[d] + 0.5) * scan.cell;
      this.dropProblem(ctx, x, scan.nodeY[n], z);
    }
  },
  dropProblem(ctx, x, y, z) {
    const scan = ctx.scan;
    if (MapScan.solidAtFoot(scan, x, z, y)) return;
    const below = MapScan.topBelow(scan, x, z, y + STEP_HEIGHT);
    if (y - below <= MAP_FALL_MAX) return;
    const covered = ctx.map.triggers.some((t) => t.kind === 'killzone' && mapInBox(t, x, y, z, 0, Infinity) && t.max[1] < y);
    if (!covered) ctx.add('open-edge', 'walking off the edge at ' + this.fmt(x, y, z) + ' falls ' + (below === -Infinity ? 'into the void' : (y - below).toFixed(0)
        + ' m') + ' with no kill zone');
  },

  // ---- lanes (MAP-002): at least 3 separate routes between the two ends of the map ----
  lanes(ctx) {
    if (MAP_NO_LANES.includes(ctx.map.category)) return;       // training and puzzle spaces are single-purpose, not lane maps
    const ends = this.laneEnds(ctx);
    if (!ends) return;
    ctx.stats.routes = this.countRoutes(ctx, ends[0], ends[1]);
    if (ctx.stats.routes < MapRules.limits.routes) ctx.add('lanes', 'only ' + ctx.stats.routes + ' separate route(s) between the far ends of the map (needs ' + MapRules.limits.routes + ')');
  },
  // Team maps: from the spawn nearest the middle of team 0's spawns to the one nearest the middle of team 1's.
  // Others: between the two ground-level free-for-all spawns farthest apart.
  laneEnds(ctx) {
    const map = ctx.map, scan = ctx.scan;
    const teamMode = map.modes.find((mode) => MapRules.rule(mode)[0] === 'teams');
    const pair = teamMode ? this.teamEnds(map, teamMode) : this.farthestFreePair(map);
    const nodes = pair && pair.map((s) => MapScan.nodeNear(scan, s.x, s.y, s.z, 0.5));
    return nodes && nodes[0] >= 0 && nodes[1] >= 0 ? nodes : null;
  },
  teamEnds(map, mode) {
    const ends = [0, 1].map((team) => Maps.spawnList(map, mode, team));
    if (!ends[0].length || !ends[1].length) return null;
    return ends.map((list) => {
      const cx = list.reduce((sum, s) => sum + s.x, 0) / list.length, cz = list.reduce((sum, s) => sum + s.z, 0) / list.length;
      return list.reduce((best, s) => (Math.hypot(s.x - cx, s.z - cz) < Math.hypot(best.x - cx, best.z - cz) ? s : best));
    });
  },
  farthestFreePair(map) {
    let pool = map.spawns.filter((s) => s.team === -1);
    const floorY = Math.min(...pool.map((s) => s.y)), ground = pool.filter((s) => s.y <= floorY + 0.5);
    if (ground.length >= 4) pool = ground;
    const flatGap = ([a, b]) => Math.hypot(a.x - b.x, a.z - b.z), pairs = mapPairs(pool);
    return pairs.length ? pairs.reduce((best, pair) => (flatGap(pair) > flatGap(best) ? pair : best)) : null;
  },
  countRoutes(ctx, from, to) {
    const scan = ctx.scan, blocked = new Uint8Array(scan.nodeCount);
    let routes = 0;
    while (routes < MAP_MAX_ROUTES) {
      const { dist, previous } = MapScan.distances(scan, [from], blocked, false, to);
      if (!isFinite(dist[to])) break;
      routes++;
      this.blockRoute(scan, MapScan.pathTo(previous, to), from, to, blocked);
    }
    return routes;
  },
  flatGap(scan, a, b) { return Math.hypot(MapScan.nodeX(scan, a) - MapScan.nodeX(scan, b), MapScan.nodeZ(scan, a) - MapScan.nodeZ(scan, b)); },
  blockRoute(scan, path, from, to, blocked) {
    for (const node of path) {
      if (this.flatGap(scan, node, from) < MAP_ROUTE_FREE || this.flatGap(scan, node, to) < MAP_ROUTE_FREE) continue;
      for (const near of MapScan.nodesAround(scan, node, MAP_ROUTE_BLOCK, MAP_ROUTE_BLOCK_HEIGHT)) blocked[near] = 1;
    }
  },

  // ---- sightlines (MAP-003) ----
  sightlines(ctx) {
    if (ctx.map.placeholder) return;                             // stand-in maps (the island until GN5) are exempt: a flat 300 m field cannot meet MAP-003
    const scan = ctx.scan, limit = Maps.sightLimit(ctx.map), lattice = Math.round(MAP_SIGHT_SPACING / scan.cell);
    let longest = 0;
    for (let n = 0; n < scan.nodeCount; n++) {
      const column = scan.nodeColumn[n];
      if (!ctx.loop[n] || (column % scan.cols) % lattice !== 0 || (((column / scan.cols) | 0) % lattice) !== 0) continue;
      longest = Math.max(longest, this.nodeSight(ctx, n, limit));
    }
    ctx.stats.longestSight = Math.round(longest);
  },
  nodeSight(ctx, n, limit) {
    const scan = ctx.scan, x = MapScan.nodeX(scan, n), z = MapScan.nodeZ(scan, n), eye = scan.nodeY[n] + STAND_EYE;
    let longest = 0;
    for (let d = 0; d < MAP_SIGHT_DIRECTIONS; d++) {
      const angle = (d / MAP_SIGHT_DIRECTIONS) * Math.PI * 2, dx = Math.cos(angle), dz = Math.sin(angle);
      const free = Math.min(MapScan.rayLength(scan, x, eye, z, dx, dz, limit + 1, ctx.hit), this.exitDistance(ctx.map, x, z, dx, dz));
      longest = Math.max(longest, free);
      if (free > limit) { ctx.add('sightline', 'open line of ' + free.toFixed(0) + ' m (limit ' + limit + ') from ' + this.fmt(x, scan.nodeY[n], z) + ' toward '
          + Math.round(angle / DEG) + ' deg'); break; }
    }
    return longest;
  },
  exitDistance(map, x, z, dx, dz) {
    const tx = dx > 0 ? (map.size[0] / 2 - x) / dx : dx < 0 ? (-map.size[0] / 2 - x) / dx : Infinity;
    const tz = dz > 0 ? (map.size[2] / 2 - z) / dz : dz < 0 ? (-map.size[2] / 2 - z) / dz : Infinity;
    return Math.min(tx, tz);
  },
};
