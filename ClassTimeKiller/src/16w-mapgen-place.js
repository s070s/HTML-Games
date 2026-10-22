// ==== S16 MAP GENERATOR: PLACEMENT ====
// MapGenPlace.run(ctx) (13.3): spawns, items, objectives and nav hints on roomy walkable cells of the main loop of a scanned
// kit map. Every number that decides a spot is engine independent (MAP-020 across devices): directions come from fixed tables
// (no sin / cos / atan2), distances from Math.sqrt (correctly rounded everywhere, unlike Math.hypot). Contract: docs/api/mapgen.md.

const MAPGEN_SPAWN_COUNTS = { free: 16, teams: 8, coop: 6, solo: 4, royale: 24 };
const MAPGEN_TEAM_SPAWN_GAP = 2.5;      // team spawns stand at least this far apart
const MAPGEN_LATTICE = 1.5;             // candidate spots are sampled on this lattice, metres
const MAPGEN_SPAWN_EDGE = 8;            // free spawns keep this far from the map edge: a spawn in a corner pocket leaves too few lanes (MAP-002)
const MAPGEN_MIRROR_MARGIN = 1.5;       // free spawns of a mirrored map are picked this far west of the centre line (their mirrors go east)
const MAPGEN_SPAWN_LATTICES = 60;       // free spawn candidates: at most this many lattice steps across the map (2 m at least)
const MAPGEN_ROOMY = 1;                 // a spot needs floor of its own height this far around it in 8 directions
const MAPGEN_ROOMY_YES = 1, MAPGEN_ROOMY_NO = 2;
const MAPGEN_ROOMY_STEP = 0.3;          // height difference that still counts as the same floor
const MAPGEN_FACING_REACH = 12;         // spawn facing: free distance looked at in each direction
const MAPGEN_FACING_MIN = 3;            // a spawn must look at this much open space (the validator wants 2 m)
const MAPGEN_FACING_PULL = 4;           // weight of "faces the target" against free distance when a spawn yaw is chosen
const MAPGEN_POWER_SPAWN_GAP = 10;      // power items stay this far (straight line) from free spawns: walking is never shorter
const MAPGEN_ITEM_GAP = 3;              // items stand this far apart (validator: 2 m)
const MAPGEN_POWER_EXPOSURE = 7;        // open directions of 16 a power item needs (validator: 6)
const MAPGEN_EXPOSURE_REACH = 5;        // the exposure rays of the validator are this long
const MAPGEN_HINTS = 8;

// Unit directions without trigonometry. Yaw table: yaw = index * 45 degrees, vector (sin yaw, cos yaw) as the validator's facing
// check uses it. Ring table: 16 directions at k * 22.5 degrees, vector (cos, sin), the first quadrant written out and turned.
const MAPGEN_HALF = Math.SQRT1_2;
const MAPGEN_YAWS = [[0, 1], [MAPGEN_HALF, MAPGEN_HALF], [1, 0], [MAPGEN_HALF, -MAPGEN_HALF], [0, -1], [-MAPGEN_HALF, -MAPGEN_HALF], [-1, 0], [-MAPGEN_HALF, MAPGEN_HALF]];
const MAPGEN_YAW_STEP = 45;
const MAPGEN_QUARTER = [[1, 0], [0.9238795325112867, 0.3826834323650898], [MAPGEN_HALF, MAPGEN_HALF], [0.3826834323650898, 0.9238795325112867]];
const MAPGEN_RING = [0, 1, 2, 3].flatMap((turn) => MAPGEN_QUARTER.map(([x, z]) => mapgenTurn(x, z, turn)));
const MAPGEN_EIGHT = MAPGEN_RING.filter((direction, index) => index % 2 === 0);      // 0, 45, ... 315 degrees as (cos, sin)
const MAPGEN_ROOMY_OFFSETS = MAPGEN_EIGHT.map(([x, z]) => [x * MAPGEN_ROOMY, z * MAPGEN_ROOMY]);
function mapgenTurn(x, z, quarters) {
  let a = x, b = z;
  for (let q = 0; q < quarters; q++) { const keep = a; a = -b; b = keep; }
  return [a, b];
}
const mapgenFlat = (ax, az, bx, bz) => Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz));
const mapgenSpace = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z));
const mapgenItemSet = (id) => CAT.mapItemSets.byId(id).list;

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
    for (let r = 0; r <= radius; r += scan.cell) {
      const node = this.nodeOnCircle(scan, x, z, r);
      if (node >= 0) return node;
    }
    return -1;
  },
  nodeOnCircle(scan, x, z, r) {
    for (const [dx, dz] of MAPGEN_EIGHT) {
      const column = MapScan.columnOf(scan, x + dx * r, z + dz * r);
      if (column >= 0 && scan.columnStart[column] < scan.columnStart[column + 1]) return scan.columnStart[column];
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
    return MAPGEN_ROOMY_OFFSETS.every(([dx, dz]) => this.loopFloorAt(ctx, MapScan.columnOf(scan, x + dx, z + dz), y));
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
    const spots = [], spacing = step || MAPGEN_LATTICE;
    for (let z = rect.z0 + spacing / 2; z < rect.z1; z += spacing) {
      for (let x = rect.x0 + spacing / 2; x < rect.x1; x += spacing) this.addSpots(ctx, x, z, spots);
    }
    return spots;
  },
  addSpots(ctx, x, z, spots) {
    const scan = ctx.scan, column = MapScan.columnOf(scan, x, z);
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
      const score = mapgenFlat(spot.x, spot.z, x, z) + spot.y * 0.25;
      if (score < bestScore && !this.isTaken(ctx, spot.x, spot.z, gap || 0)) { best = spot; bestScore = score; }
    }
    return best;
  },
  isTaken(ctx, x, z, gap) { return ctx.taken.some((point) => mapgenFlat(point.x, point.z, x, z) < gap); },
  take(ctx, point) { ctx.taken.push({ x: point.x, z: point.z }); return point; },
  // The mirror image across x = 0 (MapKit's mirror rule): a spot, or a spawn with its yaw.
  mirrorSpot(spot) {
    const [x, y, z] = MapKit.mirrorPoint([spot.x, spot.y, spot.z], 0);
    return { x, y, z };
  },
  mirrorYaw(spot, yaw) { return MapKit.mirrorSpawn([spot.x, spot.y, spot.z, yaw], true)[3]; },
  // Free distance (up to MAPGEN_FACING_REACH) at chest height from a spot along a yaw-table direction (mirrored: x flipped).
  freeToward(ctx, spot, index, mirrored) {
    const [dx, dz] = MAPGEN_YAWS[index];
    return MapScan.rayLength(ctx.scan, spot.x, spot.y + MAP_CHEST, spot.z, mirrored ? -dx : dx, dz, MAPGEN_FACING_REACH, ctx.hit);
  },
  // Spawn facing (MAP-010 facing check): the yaw-table index of the open direction that best faces the target; -1 when all are blocked.
  facing(ctx, spot, targetX, targetZ) {
    const length = mapgenFlat(targetX, targetZ, spot.x, spot.z), towardX = length ? (targetX - spot.x) / length : 0, towardZ = length ? (targetZ - spot.z) / length : 0;
    let best = -1, bestScore = -Infinity;
    for (let index = 0; index < MAPGEN_YAWS.length; index++) {
      const free = Math.min(MAPGEN_FACING_REACH, this.freeToward(ctx, spot, index, false));
      const score = free + (MAPGEN_YAWS[index][0] * towardX + MAPGEN_YAWS[index][1] * towardZ) * MAPGEN_FACING_PULL;
      if (free >= MAPGEN_FACING_MIN && score > bestScore) { bestScore = score; best = index; }
    }
    return best;
  },
  // A spot facing yaw-table index `index` whose mirror image (facing the mirrored way) is open too.
  mirrorFaces(ctx, spot, index) { return this.freeToward(ctx, this.mirrorSpot(spot), index, true) >= MAPGEN_FACING_MIN; },

  // ---- spawns (MAP-010 / MAP-011) ----
  spawns(ctx) {
    const groups = new Set(ctx.settings.modes.map((mode) => MapRules.rule(mode)[0]));
    if (groups.has('free') || groups.has('solo')) this.freeSpawns(ctx, ctx.settings.modes.includes('royale') ? MAPGEN_SPAWN_COUNTS.royale : MAPGEN_SPAWN_COUNTS.free);
    if (groups.has('teams') && !this.teamSpawns(ctx)) return false;
    if (groups.has('coop') && !this.coopSpawns(ctx)) return false;
    return [...groups].every((group) => MapRules.spawnRules[group].every(([team, minimum]) => ctx.map.spawns.filter((s) => s.team === team).length >= minimum));
  },
  addSpawn(ctx, spot, yaw, team) {
    ctx.map.spawns.push({ x: spot.x, y: spot.y, z: spot.z, yaw, team, modes: [] });
    this.take(ctx, spot);
  },
  // A spawn and, on mirrored maps, its mirror image (MapKit.mirrorSpawn: yaw to -yaw) for the other team (or free again).
  addSpawnPair(ctx, spot, index, team, mirrorTeam) {
    const yaw = index * MAPGEN_YAW_STEP;
    this.addSpawn(ctx, spot, yaw, team);
    if (ctx.mirror) this.addSpawn(ctx, this.mirrorSpot(spot), this.mirrorYaw(spot, yaw), mirrorTeam);
  },
  // Free-for-all: farthest-point sampling over the whole loop (mirrored maps: over the west half, then mirrored).
  freeSpawns(ctx, count) {
    const half = ctx.map.size[0] / 2 - MAPGEN_SPAWN_EDGE, depth = ctx.map.size[2] / 2 - MAPGEN_SPAWN_EDGE;
    const rect = { x0: -half, z0: -depth, x1: ctx.mirror ? -MAPGEN_MIRROR_MARGIN : half, z1: depth };
    const candidates = this.spotsIn(ctx, rect, Math.max(2, ctx.map.size[0] / MAPGEN_SPAWN_LATTICES));
    const gaps = this.firstGaps(candidates, ctx.mirror);
    const wanted = ctx.mirror ? Math.ceil(count / 2) : count;
    for (let placed = 0; placed < wanted;) {
      const index = this.farthest(gaps);
      if (index < 0) break;
      const next = candidates[index];
      gaps[index] = -1;
      const yaw = this.facing(ctx, next, 0, 0);
      if (yaw < 0 || (ctx.mirror && !this.mirrorFaces(ctx, next, yaw))) continue;
      this.narrowGaps(candidates, gaps, next, ctx.mirror, placed === 0);
      placed++;
      this.addSpawnPair(ctx, next, yaw, -1, -1);
    }
  },
  // Farthest-point sampling: gaps[i] = distance from candidate i to the nearest chosen spawn (and its mirror), -1 once used.
  // Before the first pick it is a small score that prefers the spot farthest from the centre (deterministic).
  firstGaps(candidates, mirror) {
    const gaps = new Float64Array(candidates.length);
    candidates.forEach((spot, index) => { gaps[index] = mapgenFlat(spot.x, spot.z, 0, 0) * 0.01; });
    if (!mirror) return gaps;
    candidates.forEach((spot, index) => { gaps[index] = Math.min(gaps[index], Math.abs(spot.x) * 2); });
    return gaps;
  },
  narrowGaps(candidates, gaps, chosen, mirror, first) {
    for (let index = 0; index < candidates.length; index++) {
      if (gaps[index] < 0) continue;
      const spot = candidates[index];
      let gap = mapgenFlat(spot.x, spot.z, chosen.x, chosen.z);
      if (mirror) gap = Math.min(gap, mapgenFlat(spot.x, spot.z, -chosen.x, chosen.z), Math.abs(spot.x) * 2);
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
    const chosen = [[], []];
    for (const team of ctx.mirror ? [0] : [0, 1]) this.chooseTeam(ctx, team, chosen);
    const full = (list) => list.length >= MAPGEN_SPAWN_COUNTS.teams;
    if (!full(chosen[0]) || (!ctx.mirror && !full(chosen[1]))) return false;
    for (const pick of chosen[0]) this.addSpawnPair(ctx, pick.spot, pick.yaw, 0, 1);
    if (!ctx.mirror) for (const pick of chosen[1]) this.addSpawn(ctx, pick.spot, pick.yaw * MAPGEN_YAW_STEP, 1);
    return true;
  },
  // The base spots nearest the base centre that pass teamSpotOk: chosen[team] gets { spot, yaw } picks.
  chooseTeam(ctx, team, chosen) {
    const rects = ctx.plan.bases[team], centre = this.rectCentre(rects[0]);
    const candidates = rects.flatMap((rect) => this.spotsIn(ctx, rect, MAPGEN_LATTICE));
    candidates.sort((a, b) => mapgenFlat(a.x, a.z, centre.x, centre.z) - mapgenFlat(b.x, b.z, centre.x, centre.z));
    for (const spot of candidates) {
      if (chosen[team].length >= MAPGEN_SPAWN_COUNTS.teams) return;
      const yaw = this.teamSpotYaw(ctx, spot, team, chosen);
      if (yaw >= 0) chosen[team].push({ spot, yaw });
    }
  },
  // The spawn yaw index for a team spot (facing along the map toward the other base), or -1 when the spot is unfit.
  teamSpotYaw(ctx, spot, team, chosen) {
    if (chosen[team].some((pick) => mapgenFlat(pick.spot.x, pick.spot.z, spot.x, spot.z) < MAPGEN_TEAM_SPAWN_GAP)) return -1;
    const yaw = this.facing(ctx, spot, 0, spot.z);
    if (yaw < 0 || (ctx.mirror && !this.mirrorFaces(ctx, spot, yaw))) return -1;
    const enemies = ctx.mirror ? chosen[0].map((pick) => pick.spot).concat([spot]).map((other) => this.mirrorSpot(other)) : chosen[1 - team].map((pick) => pick.spot);
    return enemies.every((enemy) => this.spawnsSafe(ctx, spot, enemy)) ? yaw : -1;
  },
  spawnsSafe(ctx, a, b) {
    if (mapgenSpace(a, b) < MAP_TEAM_SPAWN_DISTANCE + 1) return false;
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
      if (yaw < 0) continue;
      this.addSpawn(ctx, spot, yaw * MAPGEN_YAW_STEP, team);
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
    const point = ctx.mirror ? this.mirrorSpot(first) : east;
    const second = this.objective(ctx, Object.assign({ id: idEast, team: 1 }, row), point.x, point.z);
    if (second && ctx.mirror) Object.assign(second, this.mirrorSpot(first));
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
  // Bomb sites (MAP-021 GN2: spawn-to-site walk time in the generator's siteWalk window): of the plan's site columns, the pair whose
  // two sites miss the window by the fewest seconds of running from the attackers' (team 0) spawn; plans without columns use plan.sites.
  bombSites(ctx) {
    const window = ctx.settings.generator.siteWalk, options = ctx.plan.siteOptions;
    const start = ctx.map.spawns.find((spawn) => spawn.team === 0);
    if (!window || !options || !options.length || !start) return ctx.plan.sites;
    const { dist } = MapScan.distances(ctx.scan, [MapScan.nodeNear(ctx.scan, start.x, start.y, start.z, 0.5)], null, false);
    const speed = CAT.movement.byId(MAPGEN_SITE_PACE).groundSpeed;
    const seconds = options.map((pair) => pair.map((site) => this.walkTo(ctx, dist, site) / speed));
    const misses = seconds.map((pair) => this.windowMiss(pair[0], window) + this.windowMiss(pair[1], window));
    const best = misses.indexOf(Math.min(...misses));
    ctx.map.gen.siteSeconds = seconds[best].map((value) => Math.round(value * 10) / 10);
    return options[best];
  },
  // Walking metres from the distance field to the roomy spot an objective at the point would take (Infinity when unreachable).
  walkTo(ctx, dist, point) {
    const spot = this.spotNear(ctx, point.x, point.z, 6, 2);
    return spot ? dist[spot.node] : Infinity;
  },
  windowMiss(value, window) { return value < window[0] ? window[0] - value : value > window[1] ? value - window[1] : 0; },

  // ---- items (MAP-005) ----
  items(ctx) {
    const pickups = ctx.settings.modes.some((mode) => MapRules.rule(mode)[2]);
    const groups = pickups ? mapgenItemSet('pickups') : ctx.plan.loot ? [] : mapgenItemSet('supply');
    if (pickups) this.topItems(ctx);
    for (const rect of ctx.plan.loot || []) this.lootSite(ctx, rect);
    for (const group of groups) this.itemPair(ctx, group);
  },
  // Power item and the top armor on the centre line (equal walking distance for both teams), open and away from spawns.
  topItems(ctx) {
    const spots = ctx.plan.topSpots.map((point) => this.spotNear(ctx, point.x, point.z, 3, MAPGEN_ITEM_GAP)).filter((spot) => spot && this.powerSpotOk(ctx, spot));
    const keys = [ctx.random.pick(mapgenItemSet('power')), ctx.random.pick(MapRules.topItemKeys)];
    keys.forEach((key, index) => { if (spots[index]) this.addItem(ctx, key, spots[index]); });
  },
  powerSpotOk(ctx, spot) {
    if (ctx.map.spawns.some((spawn) => spawn.team === -1 && mapgenFlat(spawn.x, spawn.z, spot.x, spot.z) < MAPGEN_POWER_SPAWN_GAP)) return false;
    const open = MAPGEN_RING.filter(([dx, dz]) => MapScan.rayLength(ctx.scan, spot.x, spot.y + 1, spot.z, dx, dz, MAPGEN_EXPOSURE_REACH, ctx.hit) === Infinity).length;
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
      if (ctx.mirror) this.addItem(ctx, key, this.mirrorSpot(spot));
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
    for (const group of mapgenItemSet('loot')) {
      const spot = spots.find((candidate) => !this.isTaken(ctx, candidate.x, candidate.z, MAPGEN_ITEM_GAP));
      if (spot) this.addItem(ctx, this.plainKey(ctx, group), spot);
    }
  },

  // ---- nav hints: chokes at doors, sniper spots on platforms, cover elsewhere ----
  hints(ctx) {
    for (const hint of ctx.plan.hints) this.addHint(ctx, hint.kind, hint.x, hint.z, 2);
    for (const point of ctx.plan.itemSpots) this.addHint(ctx, 'cover', point.x, point.z, 3);
  },
  addHint(ctx, kind, x, z, radius) {
    if (ctx.map.navHints.length >= MAPGEN_HINTS) return;
    const spot = this.spotNear(ctx, x, z, radius, 0);
    if (spot) ctx.map.navHints.push(MapKit.hint([kind, spot.x, spot.y, spot.z]));
  },
};

const MAPGEN_SITE_PACE = 'tactical';    // movement preset whose run speed turns walking metres into the spawn-to-site seconds

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
  bomb: (ctx, mode) => MapGenPlace.bombSites(ctx).forEach((site, index) => MapGenPlace.objective(ctx, { id: index ? 'siteB' : 'siteA', kind: 'bombsite', team: 1, modes: [mode] }, site.x, site.z)),
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
