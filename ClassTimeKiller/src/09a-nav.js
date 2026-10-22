// ==== S09 NAVIGATION ====
// Nav graph built from the world brushes on 'world.load' (BOT-010). Build pipeline:
//   1. raster: 0.5 m columns; every walkable brush top (<= 45 deg) becomes a sample where the 0.40 m capsule fits
//      standing (1.80 m) or crouched (1.10 m) and has footing (edge margin); deep water adds swim samples at its surface.
//   2. nodes: one per 2 m cell and connected surface (the sample nearest the cell centre), plus one node in every
//      short standable run (doorways, gaps between crates) so narrow openings are never missed, plus trigger centres.
//   3. links: walk / crouch / swim (raster walk + chest-height line), jump (flagged with the height it needs),
//      drop (flagged with its height), ladder, jump pad (S08 target arc), teleporter; all tested against the brushes.
//   4. strongly connected components, cover points, node lookup grid.
// Pathfinding, cache, per-tick budget and smoothing live in 09b-nav-path.js. Public API: docs/api/nav.md.

const NAV_FINE = 0.5;                  // raster spacing (m): fine enough that a 1.6 m doorway always holds a standable column
const NAV_RASTER_BLOCK = 8;            // raster columns that share one brush gather
const NAV_CELL_SAMPLES = 4;            // raster columns per node cell side (one node per 2 m cell and surface)
const NAV_RADIUS = 0.4;                // DATA-003 capsule radius, heights, step and slope
const NAV_STAND_HEIGHT = 1.8;
const NAV_CROUCH_HEIGHT = 1.1;
const NAV_STEP = 0.45;
const NAV_MAX_SLOPE = 45 * DEG;
const NAV_MIN_FLOOR_NORMAL = Math.cos(NAV_MAX_SLOPE) - 1e-4;
const NAV_OPEN_RADIUS = 0.6;           // a walk passing only samples with this much free space around them needs no line test:
                                       // every point of its chest line is within 0.48 m of such a sample
const NAV_EDGE_MARGIN = 0.25;          // a sample keeps this much footing around its centre (capsule over a ledge)
const NAV_COLUMN_RISE = Math.max(NAV_STEP, NAV_FINE * Math.tan(NAV_MAX_SLOPE)) + 0.02; // height change between neighbouring columns: a step or a 45 deg ramp
const NAV_SCAN_STEP = NAV_FINE / 2;    // raster walk step: never skips a column
const NAV_INSIDE_EPSILON = 0.01;       // a point this deep inside a brush is buried (a surface covered by another brush)
const NAV_SURFACE_PROBE = 0.05;        // probe this far above a top face to see whether another brush covers it
const NAV_CHEST = 1.2;                 // line-test heights above the feet
const NAV_CROUCH_CHEST = 0.8;
const NAV_HEAD = 1.7;
const NAV_WALK_RADIUS = 2.9;           // longest walk link: reaches the 8 neighbouring cells (2 x sqrt 2 = 2.83)
const NAV_PASSAGE_MAX_SAMPLES = 4;     // a standable run this short (<= 2 m) between unstandable columns gets its own node
const NAV_PASSAGE_MERGE = 0.6;         // ...unless a node is already this close
const NAV_TRIGGER_NODE_MERGE = 0.3;
const NAV_CROUCH_PENALTY = 4;          // squared metres: a cell prefers a standing sample over a crouch-only one
const NAV_BRUSH_CELL = 4;              // brush lookup grid (m)
const NAV_NODE_CELL = 2;               // node lookup grid (m)
const NAV_JUMP_MARGIN = 0.15;          // a jump must clear the highest obstacle on its way by this much
const NAV_SWIM_DEPTH = 1.2;            // swimmer feet this far under the surface keep the head above water (eye 1.62)
const NAV_WATER_PROBE = 0.5;           // a sample is wet when this point above its feet is inside a water volume
const NAV_WATER_EXIT_RISE = NAV_SWIM_DEPTH + 0.5; // a swimmer climbs out onto a bank this high above its feet without a jump
const NAV_BAND_BELOW = 0.6;            // height band for finding the node at a trigger's floor
const NAV_BAND_ABOVE = 1.0;
const NAV_LADDER_TOP_BAND = 1.6;       // the ladder's top node may sit this far below the volume top
const NAV_TRIGGER_REACH = 2.5;         // horizontal search radius for trigger end nodes
const NAV_LANDING_SEARCH = 2.5;
const NAV_VERTICAL_WEIGHT = 2;         // nearestNode: one metre of height counts like two metres sideways
const NAV_NEAREST_RADIUS = 6;
const NAV_NEAREST_BELOW = 3;           // nodes up to this far under the point (a falling actor) or above it (a step)
const NAV_NEAREST_ABOVE = 1;
const NAV_RANDOM_ATTEMPTS = 8;         // randomReachableNode retries when it draws a trigger node
const NAV_COVER_WALL = 1.0;            // cover: a wall within this distance of the capsule...
const NAV_COVER_OPEN = 4;              // ...and open space this long on the other side
const NAV_COVER_LOW_HEIGHT = 0.9;      // blocked at this height but open at head height = crouch cover
const NAV_COVER = { NONE: 0, LOW: 1, FULL: 2 };
const NAV_REACH_MAX_COMPONENTS = 1024;  // reachability bit table up to this many components (128 KB); beyond: breadth-first search
const NAV_GRAPH_CACHE_SIZE = 4;        // graphs kept for maps that load again (rematch): BOT-010 "cached per map"
// Every build output that queries read; a cached graph restores exactly these Nav fields.
const NAV_GRAPH_FIELDS = ['nodeCount', 'nodeX', 'nodeY', 'nodeZ', 'nodeFlags', 'nodeSample', 'linkCount', 'linkStart', 'linkFrom',
  'linkTarget', 'linkType', 'linkCost', 'linkHeight', 'linkReach', 'heuristicSpeed', 'teleportCount', 'teleportEntry', 'teleportExit',
  'componentCount', 'component', 'componentStart', 'componentNodes', 'componentReach', 'componentWords', 'mainComponent', 'coverCount', 'coverNode', 'coverDirX', 'coverDirZ', 'coverLow'];
const NAV_DEBUG_STRIDE = 7;            // debugLines: ax, ay, az, bx, by, bz, link type

// Node and sample flags. TRIGGER: inside a jump pad or teleporter. NARROW: a solid lies within NAV_OPEN_RADIUS.
const NAV_NODE = { CROUCH: 1, WATER: 2, PASSAGE: 4, TRIGGER: 8, NARROW: 16 };
const NAV_LINK = { WALK: 0, CROUCH: 1, JUMP: 2, DROP: 3, LADDER: 4, JUMPPAD: 5, TELEPORT: 6, SWIM: 7 };
const NAV_LINK_NONE = 255;             // type of the last path point (no move follows)
// Travel time = length / (limits.referenceSpeed x speedFactor) + extraSeconds. smooth: string pulling may cut across it.
// twoWay: the build always adds the reverse link too (debug drawing shows one line).
const NAV_LINK_ROWS = [
  { key: 'walk', speedFactor: 1, extraSeconds: 0, smooth: true, twoWay: true },
  { key: 'crouch', speedFactor: 0.45, extraSeconds: 0.2, smooth: true, twoWay: true },
  { key: 'jump', speedFactor: 1, extraSeconds: 0.35, smooth: false, twoWay: false },
  { key: 'drop', speedFactor: 1, extraSeconds: 0.3, smooth: false, twoWay: false },     // + fall time
  { key: 'ladder', speedFactor: 1, extraSeconds: 0.5, smooth: false, twoWay: true },    // + climb / limits.ladderSpeed
  { key: 'jumppad', speedFactor: 1, extraSeconds: 0.2, smooth: false, twoWay: false },  // flight time + extra
  { key: 'teleport', speedFactor: 1, extraSeconds: 0.1, smooth: false, twoWay: false }, // extra only
  { key: 'swim', speedFactor: 0.5, extraSeconds: 0, smooth: true, twoWay: false },      // MOV-019: swim at 50 %
];

const navHit = makeHit(), navScratchHit = makeHit();
const navBrushGrid = { originX: 0, originZ: 0, cellsX: 1, cellsZ: 1, cellStart: null, cellItems: null,
  stamp: null, stampValue: 0, found: null, foundCount: 0, topPlane: null, walkable: null };
const navRaster = { originX: 0, originZ: 0, columnsX: 0, columnsZ: 0, columnStart: null, sampleY: null, sampleFlags: null, sampleColumn: null };
const navNodeGrid = { originX: 0, originZ: 0, cellsX: 1, cellsZ: 1, cellStart: null, cellItems: null };
const navSearchState = { x: 0, y: 0, z: 0, yLow: 0, yHigh: 0, radiusSquared: 0, needSight: false, best: -1, score: 0 };
const navScanState = { stopFraction: 1 };         // where along the segment the last navScan broke (0..1)
const navVolumes = { water: [], trigger: [] };   // water volumes and jump pad / teleporter volumes of the loaded map
const navTarjan = { index: null, low: null, onStack: null, stack: null, stackSize: 0, callNode: null, callEdge: null, depth: -1, counter: 0 };
const navNeighbours = { items: null, count: 0, node: -1, radiusSquared: 0 };
const navGraphCache = [];   // { key, nav, raster, nodeGrid } of recent builds, most recently used last

const Nav = {
  // Build limits. Later sections may raise them before the map loads (e.g. from the jumpiest movement preset).
  limits: {
    jumpUp: 2.45,        // highest jump link built (MV04 agile: apex 1.28 + extra jump 1.13); bots pass their own allowJumpHeight
    jumpReach: 3.2,      // longest jump or drop link, horizontal (m)
    maxDrop: 12,         // deepest drop link built (presets without fall damage)
    safeDrop: 6,         // findPath default maxDrop (BOT-010)
    gravity: GRAVITY,    // jump pad arcs
    referenceSpeed: 6,   // m/s that turns link length into travel seconds
    ladderSpeed: 3,      // MOV-019
  },
  map: null, version: 0, buildMs: 0, buildPhases: {},   // build time in ms, total and per phase (ARC-034)
  lastBuildCached: false,                               // the last build reused a cached graph of the same map
  nodeCount: 0, nodeX: null, nodeY: null, nodeZ: null, nodeFlags: null, nodeSample: null,
  linkCount: 0, linkStart: null, linkFrom: null, linkTarget: null, linkType: null, linkCost: null, linkHeight: null, linkReach: null,
  heuristicSpeed: 6,
  teleportCount: 0, teleportEntry: null, teleportExit: null,
  componentCount: 0, component: null, componentStart: null, componentNodes: null, mainComponent: -1,
  componentReach: null, componentWords: 0,   // bit (to) of row (from): component from reaches component to; null = too many
  coverCount: 0, coverNode: null, coverDirX: null, coverDirZ: null, coverLow: null,

  build(map) {
    const started = performance.now(), triggers = map.triggers || [];
    this.map = map;
    this.clearGraph();
    const key = navGraphKey(map.brushes || [], triggers);
    this.lastBuildCached = World.brushes.length > 0 && navRestoreGraph(key);
    if (World.brushes.length && !this.lastBuildCached) {
      navBuildGraph(triggers);
      navStoreGraph(key);
    }
    this.version++;
    this.resetPaths();
    this.buildMs = performance.now() - started;
    return this.buildMs;
  },
  clearCache() { navGraphCache.length = 0; },
  clearGraph() {
    this.nodeCount = 0; this.linkCount = 0; this.teleportCount = 0; this.componentCount = 0; this.coverCount = 0; this.mainComponent = -1;
    const empty = new Int32Array(1);
    this.linkStart = empty; this.componentStart = empty;
  },
  nearestNode(x, y, z) {
    if (!this.nodeCount) return -1;
    let node = navSearchNodes(x, y, z, y - NAV_NEAREST_BELOW, y + NAV_NEAREST_ABOVE, NAV_NEAREST_RADIUS, true);
    if (node < 0) node = navSearchNodes(x, y, z, -Infinity, Infinity, NAV_NEAREST_RADIUS, false);
    return node >= 0 ? node : navNearestAnywhere(x, y, z);
  },
  nodePosition(node, out) { return Vec.set(out, this.nodeX[node], this.nodeY[node], this.nodeZ[node]); },
  // A node in the same strongly connected component (reachable and back), never a jump pad or teleporter node.
  randomReachableNode(from, rng) {
    if (from < 0 || from >= this.nodeCount) return -1;
    const component = this.component[from], first = this.componentStart[component];
    const size = this.componentStart[component + 1] - first;
    for (let attempt = 0; attempt < NAV_RANDOM_ATTEMPTS; attempt++) {
      const node = this.componentNodes[first + Math.floor(rng.next() * size)];
      if (!(this.nodeFlags[node] & NAV_NODE.TRIGGER)) return node;
    }
    return from;
  },
  // Cover point whose wall faces the threat and hides the cover from it; -1 when none within maxDistance.
  nearestCover(x, y, z, threatX, threatY, threatZ, maxDistance) {
    let best = -1, bestDistance = maxDistance * maxDistance;
    for (let cover = 0; cover < this.coverCount; cover++) {
      const distance = distanceSquared3(x, y, z, this.nodeX[this.coverNode[cover]], this.nodeY[this.coverNode[cover]], this.nodeZ[this.coverNode[cover]]);
      if (distance >= bestDistance || !navCoverHides(cover, threatX, threatY, threatZ)) continue;
      best = cover; bestDistance = distance;
    }
    return best;
  },
  // Fills out (Float32Array) with link segments, NAV_DEBUG_STRIDE floats each; returns the number written (F9 view, BOT-092).
  debugLines(out) {
    const limit = Math.floor(out.length / NAV_DEBUG_STRIDE);
    let count = 0;
    for (let node = 0; node < this.nodeCount && count < limit; node++) count = navDebugNode(out, node, count, limit);
    return count;
  },
};

Bus.on('world.load', (map) => Nav.build(map));

// ---- Graph cache: same brushes, triggers and limits give the same graph ----
function navGraphKey(brushes, triggers) {
  const text = JSON.stringify([brushes, triggers, Nav.limits]);
  return hashString(text) + ':' + text.length;
}

function navRestoreGraph(key) {
  const index = navGraphCache.findIndex((entry) => entry.key === key);
  if (index < 0) return false;
  const entry = navGraphCache.splice(index, 1)[0];
  navGraphCache.push(entry);
  NAV_GRAPH_FIELDS.forEach((field) => { Nav[field] = entry.nav[field]; });
  Object.assign(navRaster, entry.raster);
  Object.assign(navNodeGrid, entry.nodeGrid);
  navBuildBrushGrid(); // brush indices are the same; the grid holds the new World.brushes
  return true;
}

function navStoreGraph(key) {
  const nav = {};
  NAV_GRAPH_FIELDS.forEach((field) => { nav[field] = Nav[field]; });
  navGraphCache.push({ key, nav, raster: Object.assign({}, navRaster), nodeGrid: Object.assign({}, navNodeGrid) });
  if (navGraphCache.length > NAV_GRAPH_CACHE_SIZE) navGraphCache.shift();
}

// ---- Build pipeline ----
function navBuildGraph(triggers) {
  navVolumes.water = triggers.filter((trigger) => trigger.kind === 'water').map(navVolume);
  navVolumes.trigger = triggers.filter((trigger) => trigger.kind === 'jumppad' || trigger.kind === 'teleporter').map(navVolume);
  const phases = Nav.buildPhases;
  let mark = performance.now();
  const lap = (name) => { const now = performance.now(); phases[name] = now - mark; mark = now; };
  navBuildBrushGrid();
  navBuildRaster();
  lap('raster');
  const builder = { x: [], y: [], z: [], sample: [], flags: [], cells: new Map(), from: [], to: [], type: [], height: [], reach: [], seconds: [] };
  navPickCellNodes(builder);
  triggers.forEach((trigger) => navAddTriggerNode(builder, trigger));
  navAddPassageNodes(builder, 1, 0);
  navAddPassageNodes(builder, 0, 1);
  navFinishNodes(builder);
  lap('nodes');
  navLinkNeighbours(builder);
  triggers.forEach((trigger) => { if (NAV_TRIGGER_LINKS[trigger.kind]) NAV_TRIGGER_LINKS[trigger.kind](builder, trigger); });
  navFinishLinks(builder);
  lap('links');
  navLabelComponents();
  navFindCover();
  lap('components and cover');
}

function navVolume(trigger) {
  return { minX: trigger.min[0], minY: trigger.min[1], minZ: trigger.min[2], maxX: trigger.max[0], maxY: trigger.max[1], maxZ: trigger.max[2] };
}

function navInVolumes(volumes, x, y, z) {
  for (let i = 0; i < volumes.length; i++) {
    const v = volumes[i];
    if (x >= v.minX && x <= v.maxX && y >= v.minY && y <= v.maxY && z >= v.minZ && z <= v.maxZ) return true;
  }
  return false;
}

// Counting sort of items into grid cells (CSR). eachCell(index, visit) calls visit(cell) for every cell of one item.
function navBucket(itemCount, cellCount, eachCell) {
  const start = new Int32Array(cellCount + 1);
  for (let index = 0; index < itemCount; index++) eachCell(index, (cell) => { start[cell + 1]++; });
  for (let cell = 0; cell < cellCount; cell++) start[cell + 1] += start[cell];
  const fill = start.slice(0, cellCount), items = new Int32Array(start[cellCount]);
  for (let index = 0; index < itemCount; index++) eachCell(index, (cell) => { items[fill[cell]++] = index; });
  return { start, items };
}

const navCellIndex = (value, origin, size, cells) => clamp(Math.floor((value - origin) / size), 0, cells - 1);

// Calls visit(cell) for every cell of a lookup grid (navBrushGrid or navNodeGrid) that the xz rectangle overlaps.
// visit is a top-level function so queries allocate nothing; it may itself query the other grid.
function navForCells(grid, cellSize, minX, minZ, maxX, maxZ, visit) {
  const i0 = navCellIndex(minX, grid.originX, cellSize, grid.cellsX), i1 = navCellIndex(maxX, grid.originX, cellSize, grid.cellsX);
  const j0 = navCellIndex(minZ, grid.originZ, cellSize, grid.cellsZ), j1 = navCellIndex(maxZ, grid.originZ, cellSize, grid.cellsZ);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) visit(j * grid.cellsX + i);
  }
}

// ---- Brush lookup grid: build and query tests only touch nearby brushes ----
function navBuildBrushGrid() {
  const grid = navBrushGrid, brushes = World.brushes;
  grid.originX = World.boundsMin.x; grid.originZ = World.boundsMin.z;
  grid.cellsX = Math.max(1, Math.ceil((World.boundsMax.x - grid.originX) / NAV_BRUSH_CELL));
  grid.cellsZ = Math.max(1, Math.ceil((World.boundsMax.z - grid.originZ) / NAV_BRUSH_CELL));
  const bucket = navBucket(brushes.length, grid.cellsX * grid.cellsZ,
    (index, visit) => navForCells(grid, NAV_BRUSH_CELL, brushes[index].minX, brushes[index].minZ, brushes[index].maxX, brushes[index].maxZ, visit));
  grid.cellStart = bucket.start; grid.cellItems = bucket.items;
  grid.stamp = new Uint32Array(brushes.length); grid.stampValue = 0;
  grid.found = new Int32Array(brushes.length);
  grid.topPlane = Int32Array.from(brushes, navTopPlaneIndex);
  grid.walkable = Uint8Array.from(brushes, (brush, index) => (brush.planes[grid.topPlane[index] * 4 + 1] >= NAV_MIN_FLOOR_NORMAL ? 1 : 0));
}

// The plane facing most upward is the brush top (box top or ramp slope).
function navTopPlaneIndex(brush) {
  let best = 0;
  for (let i = 1; i < brush.planeCount; i++) if (brush.planes[i * 4 + 1] > brush.planes[best * 4 + 1]) best = i;
  return best;
}

// Collects the brushes whose grid cells overlap the xz rectangle into navBrushGrid.found (no duplicates); returns the count.
function navGatherBrushes(minX, minZ, maxX, maxZ) {
  const grid = navBrushGrid;
  grid.stampValue++;
  grid.foundCount = 0;
  navForCells(grid, NAV_BRUSH_CELL, minX, minZ, maxX, maxZ, navGatherCell);
  return grid.foundCount;
}

function navGatherCell(cell) {
  const grid = navBrushGrid;
  for (let k = grid.cellStart[cell]; k < grid.cellStart[cell + 1]; k++) {
    const brush = grid.cellItems[k];
    if (grid.stamp[brush] === grid.stampValue) continue;
    grid.stamp[brush] = grid.stampValue;
    grid.found[grid.foundCount++] = brush;
  }
}

// Nearest brush hit on the segment a -> b into hit (S08's per-brush ray test rayBrush, limited to nearby brushes:
// the build runs tens of thousands). A hit at distance 0 counts only when a really starts inside the brush (not
// merely touching its surface).
function navSegmentHit(ax, ay, az, bx, by, bz, hit) {
  navGatherBrushes(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz));
  return navSegmentHitGathered(ax, ay, az, bx, by, bz, hit);
}

const navSegmentClear = (ax, ay, az, bx, by, bz) => !navSegmentHit(ax, ay, az, bx, by, bz, navHit);
const navSegmentClearGathered = (ax, ay, az, bx, by, bz) => !navSegmentHitGathered(ax, ay, az, bx, by, bz, navHit);

// navSegmentHit against the brushes of the last navGatherBrushes call, which must cover the segment's xz rectangle.
function navSegmentHitGathered(ax, ay, az, bx, by, bz, hit) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, length = Math.hypot(dx, dy, dz), count = navBrushGrid.foundCount;
  if (length < 1e-6) return false;
  let best = length, found = false;
  for (let k = 0; k < count; k++) {
    const brush = World.brushes[navBrushGrid.found[k]];
    if (!navSegmentNearBox(ax, ay, az, bx, by, bz, brush) || !rayBrush(ax, ay, az, dx / length, dy / length, dz / length, best, brush, navScratchHit)) continue;
    if (navScratchHit.distance === 0 && !pointInBrush(ax, ay, az, brush, 0)) continue;
    best = navScratchHit.distance; found = true;
    Vec.set(hit, ax + dx / length * best, ay + dy / length * best, az + dz / length * best);
    hit.distance = best; hit.nx = navScratchHit.nx; hit.ny = navScratchHit.ny; hit.nz = navScratchHit.nz; hit.brush = brush;
  }
  return found;
}

function navSegmentNearBox(ax, ay, az, bx, by, bz, box) {
  return Math.max(ax, bx) >= box.minX && Math.min(ax, bx) <= box.maxX && Math.max(ay, by) >= box.minY
    && Math.min(ay, by) <= box.maxY && Math.max(az, bz) >= box.minZ && Math.min(az, bz) <= box.maxZ;
}

// The *Gathered tests below check only the brushes of the last navGatherBrushes call (one gather serves many tests).
function navBoxBlockedGathered(minX, minY, minZ, maxX, maxY, maxZ) {
  const count = navBrushGrid.foundCount;
  for (let k = 0; k < count; k++) {
    if (navBoxTouchesBrush(minX, minY, minZ, maxX, maxY, maxZ, World.brushes[navBrushGrid.found[k]])) return true;
  }
  return false;
}

// Box versus convex brush: separated when the brush box or one brush plane has the whole box in front of it.
function navBoxTouchesBrush(minX, minY, minZ, maxX, maxY, maxZ, brush) {
  if (maxX <= brush.minX || minX >= brush.maxX || maxY <= brush.minY || minY >= brush.maxY || maxZ <= brush.minZ || minZ >= brush.maxZ) return false;
  const p = brush.planes;
  for (let i = 0; i < brush.planeCount; i++) {
    const nx = p[i * 4], ny = p[i * 4 + 1], nz = p[i * 4 + 2];
    const deepest = nx * (nx > 0 ? minX : maxX) + ny * (ny > 0 ? minY : maxY) + nz * (nz > 0 ? minZ : maxZ); // box corner furthest behind the plane
    if (deepest >= p[i * 4 + 3] - 1e-4) return false;
  }
  return true;
}

function navPointBuriedGathered(x, y, z) {
  const count = navBrushGrid.foundCount;
  for (let k = 0; k < count; k++) {
    const brush = World.brushes[navBrushGrid.found[k]];
    if (navPointInBox(x, y, z, brush) && pointInBrush(x, y, z, brush, -NAV_INSIDE_EPSILON)) return true;
  }
  return false;
}

const navPointInBox = (x, y, z, box) => x > box.minX && x < box.maxX && y > box.minY && y < box.maxY && z > box.minZ && z < box.maxZ;

// Height of a brush's top surface at (x, z); NaN outside its footprint.
function navTopAt(brushIndex, x, z) {
  const brush = World.brushes[brushIndex];
  if (x < brush.minX || x > brush.maxX || z < brush.minZ || z > brush.maxZ) return NaN;
  const p = brush.planes, i = navBrushGrid.topPlane[brushIndex] * 4;
  return clamp((p[i + 3] - p[i] * x - p[i + 2] * z) / p[i + 1], brush.minY, brush.maxY);
}

// True when a walkable top lies within a step of height y at (x, z).
function navHasFootingGathered(x, y, z) {
  const count = navBrushGrid.foundCount;
  for (let k = 0; k < count; k++) {
    const brushIndex = navBrushGrid.found[k];
    if (navBrushGrid.walkable[brushIndex] && Math.abs(navTopAt(brushIndex, x, z) - y) <= NAV_STEP) return true;
  }
  return false;
}

// Highest gathered brush top at (x, z) that is not above limit (-Infinity when none). Infinity when a wall stands there:
// a brush reaching above limit whose bottom is below wallBelow (it fills the body height, so no jump passes it).
function navHighestTopGathered(x, z, limit, wallBelow) {
  let best = -Infinity;
  const count = navBrushGrid.foundCount;
  for (let k = 0; k < count; k++) {
    const brushIndex = navBrushGrid.found[k], top = navTopAt(brushIndex, x, z);
    if (top > limit && World.brushes[brushIndex].minY < wallBelow) return Infinity;
    if (top <= limit && top > best) best = top;
  }
  return best;
}

// ---- Raster of standable samples ----
function navBuildRaster() {
  const raster = navRaster;
  raster.originX = World.boundsMin.x; raster.originZ = World.boundsMin.z;
  raster.columnsX = Math.max(1, Math.ceil((World.boundsMax.x - raster.originX) / NAV_FINE));
  raster.columnsZ = Math.max(1, Math.ceil((World.boundsMax.z - raster.originZ) / NAV_FINE));
  const columnCount = raster.columnsX * raster.columnsZ, heights = [], flags = [], columns = [];
  raster.columnStart = new Int32Array(columnCount + 1);
  for (let column = 0; column < columnCount; column++) {
    navRasterColumn(column, heights, flags);
    for (let sample = columns.length; sample < heights.length; sample++) columns.push(column);
    raster.columnStart[column + 1] = heights.length;
  }
  raster.sampleY = Float32Array.from(heights);
  raster.sampleFlags = Uint8Array.from(flags);
  raster.sampleColumn = Int32Array.from(columns);
}

const navColumnX = (column) => navRaster.originX + (column % navRaster.columnsX + 0.5) * NAV_FINE;
const navColumnZ = (column) => navRaster.originZ + (Math.floor(column / navRaster.columnsX) + 0.5) * NAV_FINE;

function navColumnAt(x, z) {
  const i = Math.floor((x - navRaster.originX) / NAV_FINE), j = Math.floor((z - navRaster.originZ) / NAV_FINE);
  if (i < 0 || j < 0 || i >= navRaster.columnsX || j >= navRaster.columnsZ) return -1;
  return j * navRaster.columnsX + i;
}

// Columns run along x; one brush gather covers every sample test of the next NAV_RASTER_BLOCK columns.
function navRasterColumn(column, heights, flags) {
  const x = navColumnX(column), z = navColumnZ(column), first = heights.length, grid = navBrushGrid;
  if ((column % navRaster.columnsX) % NAV_RASTER_BLOCK === 0) {
    navGatherBrushes(x - NAV_OPEN_RADIUS, z - NAV_OPEN_RADIUS, x + (NAV_RASTER_BLOCK - 1) * NAV_FINE + NAV_OPEN_RADIUS, z + NAV_OPEN_RADIUS);
  }
  const count = grid.foundCount;
  for (let k = 0; k < count; k++) {
    if (grid.walkable[grid.found[k]]) navTrySample(x, navTopAt(grid.found[k], x, z), z, heights, flags, first, 0, grid.found[k]);
  }
  navTrySwimSamples(x, z, heights, flags, first);
}

// floorBrush: the brush whose top this is (-1 for a swim sample, which needs no footing).
function navTrySample(x, y, z, heights, flags, first, extraFlags, floorBrush) {
  if (Number.isNaN(y) || navColumnHasNear(heights, first, y) || navPointBuriedGathered(x, y + NAV_SURFACE_PROBE, z)) return;
  if (floorBrush >= 0 && !navFootprintHolds(floorBrush, x, z) && !navHasEdgeFooting(x, y, z)) return;
  const fitFlags = navFitFlags(x, y, z);
  if (fitFlags < 0) return;
  let sampleFlags = extraFlags | fitFlags;
  if (navInVolumes(navVolumes.water, x, y + NAV_WATER_PROBE, z)) sampleFlags |= NAV_NODE.WATER;
  if (navInVolumes(navVolumes.trigger, x, y + NAV_WATER_PROBE, z)) sampleFlags |= NAV_NODE.TRIGGER;
  heights.push(y);
  flags.push(sampleFlags);
}

function navColumnHasNear(heights, first, y) {
  for (let i = first; i < heights.length; i++) if (Math.abs(heights[i] - y) < NAV_SURFACE_PROBE) return true;
  return false;
}

function navHasEdgeFooting(x, y, z) {
  return navHasFootingGathered(x + NAV_EDGE_MARGIN, y, z) && navHasFootingGathered(x - NAV_EDGE_MARGIN, y, z)
    && navHasFootingGathered(x, y, z + NAV_EDGE_MARGIN) && navHasFootingGathered(x, y, z - NAV_EDGE_MARGIN);
}

// The sample's own brush gives all the footing when its footprint holds the edge margin on every side.
function navFootprintHolds(brushIndex, x, z) {
  const brush = World.brushes[brushIndex];
  return x - NAV_EDGE_MARGIN >= brush.minX && x + NAV_EDGE_MARGIN <= brush.maxX && z - NAV_EDGE_MARGIN >= brush.minZ && z + NAV_EDGE_MARGIN <= brush.maxZ;
}

// Flags for how the capsule fits (0 = standing in open space), -1 when it does not fit at all. The boxes start a step
// above the feet: steps and 45 deg slopes under the capsule never block. One wide box settles most samples.
function navFitFlags(x, y, z) {
  const open = NAV_OPEN_RADIUS, radius = NAV_RADIUS, bottom = y + NAV_STEP;
  if (!navBoxBlockedGathered(x - open, bottom, z - open, x + open, y + NAV_STAND_HEIGHT, z + open)) return 0;
  if (!navBoxBlockedGathered(x - radius, bottom, z - radius, x + radius, y + NAV_STAND_HEIGHT, z + radius)) return NAV_NODE.NARROW;
  if (!navBoxBlockedGathered(x - radius, bottom, z - radius, x + radius, y + NAV_CROUCH_HEIGHT, z + radius)) return NAV_NODE.NARROW | NAV_NODE.CROUCH;
  return -1;
}

// Water deeper than NAV_SWIM_DEPTH gets a sample at swimming depth (the floor below is too deep to wade).
function navTrySwimSamples(x, z, heights, flags, first) {
  for (let i = 0; i < navVolumes.water.length; i++) {
    const water = navVolumes.water[i], feet = water.maxY - NAV_SWIM_DEPTH;
    if (x < water.minX || x > water.maxX || z < water.minZ || z > water.maxZ || feet < water.minY) continue;
    if (navColumnHasBetween(heights, first, feet - NAV_STEP, water.maxY)) continue;
    navTrySample(x, feet, z, heights, flags, first, NAV_NODE.WATER, -1);
  }
}

function navColumnHasBetween(heights, first, low, high) {
  for (let i = first; i < heights.length; i++) if (heights[i] >= low && heights[i] <= high) return true;
  return false;
}

// Sample in the column (di, dj) away whose height is reachable from this sample by walking; -1 when none.
function navNeighbourSample(sample, di, dj) {
  const raster = navRaster, column = raster.sampleColumn[sample];
  const i = column % raster.columnsX + di, j = Math.floor(column / raster.columnsX) + dj;
  if (i < 0 || j < 0 || i >= raster.columnsX || j >= raster.columnsZ) return -1;
  const target = j * raster.columnsX + i, y = raster.sampleY[sample];
  let best = -1, bestRise = NAV_COLUMN_RISE;
  for (let other = raster.columnStart[target]; other < raster.columnStart[target + 1]; other++) {
    const rise = Math.abs(raster.sampleY[other] - y);
    if (rise <= bestRise) { best = other; bestRise = rise; }
  }
  return best;
}

// Walks the raster from a sample toward (toX, toZ) through neighbouring columns; returns the OR of the flags of every
// sample passed before the last one, or -1 when the walk meets a hole, a wall or does not end on toSample.
function navScan(fromSample, toX, toZ, toSample) {
  const column = navRaster.sampleColumn[fromSample], startX = navColumnX(column), startZ = navColumnZ(column);
  const steps = Math.ceil(Math.hypot(toX - startX, toZ - startZ) / NAV_SCAN_STEP);
  let current = fromSample, flags = 0;
  navScanState.stopFraction = 1;
  for (let step = 1; step <= steps && current >= 0; step++) {
    flags |= navRaster.sampleFlags[current];
    current = navScanStep(current, startX + (toX - startX) * step / steps, startZ + (toZ - startZ) * step / steps);
    if (current < 0) navScanState.stopFraction = step / steps;
  }
  if (steps === 0) flags = navRaster.sampleFlags[fromSample];
  return current === toSample ? flags : -1;
}

function navScanStep(current, x, z) {
  const column = navColumnAt(x, z), from = navRaster.sampleColumn[current], width = navRaster.columnsX;
  if (column === from) return current;
  if (column < 0) return -1;
  return navNeighbourSample(current, column % width - from % width, Math.floor(column / width) - Math.floor(from / width));
}

// ---- Nodes ----
function navCellCountX() { return Math.ceil(navRaster.columnsX / NAV_CELL_SAMPLES); }
function navCellOfColumn(column) {
  return Math.floor(Math.floor(column / navRaster.columnsX) / NAV_CELL_SAMPLES) * navCellCountX() + Math.floor((column % navRaster.columnsX) / NAV_CELL_SAMPLES);
}

function navAddNode(builder, sample, extraFlags) {
  const column = navRaster.sampleColumn[sample], index = builder.sample.length, cell = navCellOfColumn(column);
  builder.sample.push(sample);
  builder.x.push(navColumnX(column)); builder.y.push(navRaster.sampleY[sample]); builder.z.push(navColumnZ(column));
  builder.flags.push(navRaster.sampleFlags[sample] | extraFlags);
  if (!builder.cells.has(cell)) builder.cells.set(cell, []);
  builder.cells.get(cell).push(index);
}

function navPickCellNodes(builder) {
  const cellsX = navCellCountX(), cellsZ = Math.ceil(navRaster.columnsZ / NAV_CELL_SAMPLES), samples = [];
  for (let cell = 0; cell < cellsX * cellsZ; cell++) {
    navCollectCellSamples(cell % cellsX, Math.floor(cell / cellsX), samples);
    if (samples.length) navAddClusterNodes(builder, samples, cell % cellsX, Math.floor(cell / cellsX));
  }
}

function navCollectCellSamples(cellI, cellJ, samples) {
  const raster = navRaster;
  samples.length = 0;
  for (let offset = 0; offset < NAV_CELL_SAMPLES * NAV_CELL_SAMPLES; offset++) {
    const i = cellI * NAV_CELL_SAMPLES + offset % NAV_CELL_SAMPLES, j = cellJ * NAV_CELL_SAMPLES + Math.floor(offset / NAV_CELL_SAMPLES);
    if (i >= raster.columnsX || j >= raster.columnsZ) continue;
    const column = j * raster.columnsX + i;
    for (let sample = raster.columnStart[column]; sample < raster.columnStart[column + 1]; sample++) {
      if (!(raster.sampleFlags[sample] & NAV_NODE.TRIGGER)) samples.push(sample); // a node inside a pad would be a dead end
    }
  }
}

// Groups the cell's samples into walk-connected surfaces; each surface gets the node nearest the cell centre.
function navAddClusterNodes(builder, samples, cellI, cellJ) {
  const centreX = navRaster.originX + (cellI + 0.5) * NAV_CELL_SAMPLES * NAV_FINE, centreZ = navRaster.originZ + (cellJ + 0.5) * NAV_CELL_SAMPLES * NAV_FINE;
  if (navFlatFullCell(samples)) { navAddNode(builder, navBestSample(samples, centreX, centreZ), 0); return; } // open floor: one surface
  const parent = samples.map((sample, index) => index);
  for (let a = 0; a < samples.length; a++) {
    for (let b = a + 1; b < samples.length; b++) if (navSamplesTouch(samples[a], samples[b])) parent[navRoot(parent, a)] = navRoot(parent, b);
  }
  const best = new Map();
  samples.forEach((sample, index) => {
    const root = navRoot(parent, index), previous = best.get(root);
    if (previous === undefined || navCentreScore(sample, centreX, centreZ) < navCentreScore(previous, centreX, centreZ)) best.set(root, sample);
  });
  best.forEach((sample) => navAddNode(builder, sample, 0));
}

// Every column holds one sample and all are within a step of each other: they form one walk-connected surface.
function navFlatFullCell(samples) {
  if (samples.length !== NAV_CELL_SAMPLES * NAV_CELL_SAMPLES) return false;
  const y = navRaster.sampleY[samples[0]];
  return samples.every((sample) => Math.abs(navRaster.sampleY[sample] - y) <= NAV_STEP);
}

function navBestSample(samples, centreX, centreZ) {
  let best = samples[0];
  for (let i = 1; i < samples.length; i++) if (navCentreScore(samples[i], centreX, centreZ) < navCentreScore(best, centreX, centreZ)) best = samples[i];
  return best;
}

function navRoot(parent, index) {
  let root = index;
  while (parent[root] !== root) root = parent[root];
  parent[index] = root;
  return root;
}

function navSamplesTouch(a, b) {
  const raster = navRaster, columnA = raster.sampleColumn[a], columnB = raster.sampleColumn[b], width = raster.columnsX;
  const di = Math.abs(columnA % width - columnB % width), dj = Math.abs(Math.floor(columnA / width) - Math.floor(columnB / width));
  return di <= 1 && dj <= 1 && columnA !== columnB && Math.abs(raster.sampleY[a] - raster.sampleY[b]) <= NAV_COLUMN_RISE;
}

function navCentreScore(sample, centreX, centreZ) {
  const column = navRaster.sampleColumn[sample], dx = navColumnX(column) - centreX, dz = navColumnZ(column) - centreZ;
  return dx * dx + dz * dz + (navRaster.sampleFlags[sample] & NAV_NODE.CROUCH ? NAV_CROUCH_PENALTY : 0);
}

// Jump pads and teleporters get a node at their centre so bots step right onto them.
function navAddTriggerNode(builder, trigger) {
  if (trigger.kind !== 'jumppad' && trigger.kind !== 'teleporter') return;
  const column = navColumnAt(navVolumeCentreX(trigger), navVolumeCentreZ(trigger));
  if (column < 0) return;
  for (let sample = navRaster.columnStart[column]; sample < navRaster.columnStart[column + 1]; sample++) {
    const y = navRaster.sampleY[sample];
    if (y < trigger.min[1] - NAV_BAND_BELOW || y > trigger.min[1] + NAV_BAND_ABOVE || navNodeNear(builder, sample, NAV_TRIGGER_NODE_MERGE)) continue;
    navAddNode(builder, sample, 0);
    return;
  }
}

// A run of at most NAV_PASSAGE_MAX_SAMPLES standable columns along one axis is a doorway or a gap: its middle becomes a node.
function navAddPassageNodes(builder, stepI, stepJ) {
  const run = [];
  for (let sample = 0; sample < navRaster.sampleY.length; sample++) {
    if (navNeighbourSample(sample, -stepI, -stepJ) >= 0) continue; // not the start of a run
    run.length = 0;
    for (let current = sample; current >= 0 && run.length <= NAV_PASSAGE_MAX_SAMPLES; current = navNeighbourSample(current, stepI, stepJ)) run.push(current);
    const middle = run[(run.length - 1) >> 1];
    if (run.length <= NAV_PASSAGE_MAX_SAMPLES && !navNodeNear(builder, middle, NAV_PASSAGE_MERGE)) navAddNode(builder, middle, NAV_NODE.PASSAGE);
  }
}

function navNodeNear(builder, sample, distance) {
  const column = navRaster.sampleColumn[sample], x = navColumnX(column), y = navRaster.sampleY[sample], z = navColumnZ(column);
  const cell = navCellOfColumn(column), cellsX = navCellCountX(), limit = distance * distance;
  for (let offset = 0; offset < 9; offset++) {
    const list = builder.cells.get(cell + (offset % 3 - 1) + (Math.floor(offset / 3) - 1) * cellsX);
    if (list && list.some((node) => distanceSquared3(x, y, z, builder.x[node], builder.y[node], builder.z[node]) < limit)) return true;
  }
  return false;
}

function navFinishNodes(builder) {
  const grid = navNodeGrid;
  Nav.nodeCount = builder.sample.length;
  Nav.nodeX = Float32Array.from(builder.x); Nav.nodeY = Float32Array.from(builder.y); Nav.nodeZ = Float32Array.from(builder.z);
  Nav.nodeFlags = Uint8Array.from(builder.flags); Nav.nodeSample = Int32Array.from(builder.sample);
  grid.originX = navRaster.originX; grid.originZ = navRaster.originZ;
  grid.cellsX = Math.max(1, Math.ceil(navRaster.columnsX * NAV_FINE / NAV_NODE_CELL));
  grid.cellsZ = Math.max(1, Math.ceil(navRaster.columnsZ * NAV_FINE / NAV_NODE_CELL));
  const bucket = navBucket(Nav.nodeCount, grid.cellsX * grid.cellsZ, (node, visit) => visit(navNodeCell(Nav.nodeX[node], Nav.nodeZ[node])));
  grid.cellStart = bucket.start; grid.cellItems = bucket.items;
  navNeighbours.items = new Int32Array(Nav.nodeCount);
}

function navNodeCell(x, z) {
  const grid = navNodeGrid;
  return navCellIndex(z, grid.originZ, NAV_NODE_CELL, grid.cellsZ) * grid.cellsX + navCellIndex(x, grid.originX, NAV_NODE_CELL, grid.cellsX);
}

// ---- Node queries (allocation-free) ----
// Best node by horizontal distance + weighted height difference inside a height band; needSight: visible from the point.
function navSearchNodes(x, y, z, yLow, yHigh, radius, needSight) {
  const state = navSearchState;
  state.x = x; state.y = y; state.z = z; state.yLow = yLow; state.yHigh = yHigh; state.radiusSquared = radius * radius;
  state.needSight = needSight; state.best = -1; state.score = Infinity;
  navForCells(navNodeGrid, NAV_NODE_CELL, x - radius, z - radius, x + radius, z + radius, navSearchCell);
  return state.best;
}

function navSearchCell(cell) {
  const state = navSearchState, grid = navNodeGrid;
  for (let k = grid.cellStart[cell]; k < grid.cellStart[cell + 1]; k++) {
    const node = grid.cellItems[k], nodeY = Nav.nodeY[node];
    if (nodeY < state.yLow || nodeY > state.yHigh) continue;
    const dx = Nav.nodeX[node] - state.x, dz = Nav.nodeZ[node] - state.z, horizontal = dx * dx + dz * dz;
    const score = horizontal + (nodeY - state.y) * (nodeY - state.y) * NAV_VERTICAL_WEIGHT * NAV_VERTICAL_WEIGHT;
    if (horizontal > state.radiusSquared || score >= state.score) continue;
    if (state.needSight && !navSegmentClear(state.x, state.y + NAV_CROUCH_CHEST, state.z, Nav.nodeX[node], nodeY + NAV_CROUCH_CHEST, Nav.nodeZ[node])) continue;
    state.best = node; state.score = score;
  }
}

function navNearestAnywhere(x, y, z) {
  let best = -1, bestDistance = Infinity;
  for (let node = 0; node < Nav.nodeCount; node++) {
    const distance = distanceSquared3(x, y, z, Nav.nodeX[node], Nav.nodeY[node], Nav.nodeZ[node]);
    if (distance < bestDistance) { best = node; bestDistance = distance; }
  }
  return best;
}

// Fills navNeighbours.items with the nodes within a horizontal radius of a node (itself excluded).
function navCollectNeighbours(node, radius) {
  const x = Nav.nodeX[node], z = Nav.nodeZ[node], found = navNeighbours;
  found.count = 0; found.node = node; found.radiusSquared = radius * radius;
  navForCells(navNodeGrid, NAV_NODE_CELL, x - radius, z - radius, x + radius, z + radius, navCollectCell);
  return found.count;
}

function navCollectCell(cell) {
  const grid = navNodeGrid, found = navNeighbours;
  for (let k = grid.cellStart[cell]; k < grid.cellStart[cell + 1]; k++) {
    const other = grid.cellItems[k];
    if (other !== found.node && navHorizontalSquared(found.node, other) <= found.radiusSquared) found.items[found.count++] = other;
  }
}

function navHorizontalSquared(a, b) {
  const dx = Nav.nodeX[b] - Nav.nodeX[a], dz = Nav.nodeZ[b] - Nav.nodeZ[a];
  return dx * dx + dz * dz;
}

function navNodeDistance(a, b) {
  return Math.sqrt(distanceSquared3(Nav.nodeX[a], Nav.nodeY[a], Nav.nodeZ[a], Nav.nodeX[b], Nav.nodeY[b], Nav.nodeZ[b]));
}

function navLinkLineClear(a, b, height) {
  return navSegmentClear(Nav.nodeX[a], Nav.nodeY[a] + height, Nav.nodeZ[a], Nav.nodeX[b], Nav.nodeY[b] + height, Nav.nodeZ[b]);
}

// ---- Links ----
function navLinkSeconds(type, length) {
  const row = NAV_LINK_ROWS[type];
  return length / (Nav.limits.referenceSpeed * row.speedFactor) + row.extraSeconds;
}

function navAddLink(builder, from, to, type, height, seconds) {
  builder.from.push(from); builder.to.push(to); builder.type.push(type); builder.height.push(height); builder.seconds.push(seconds);
  builder.reach.push(Math.sqrt(navHorizontalSquared(from, to)));
}

// Move type of a straight walk over samples with these flags: swim when any is wet, else crouch when any is crouch-only.
const navWalkType = (flags) => (flags & NAV_NODE.WATER ? NAV_LINK.SWIM : flags & NAV_NODE.CROUCH ? NAV_LINK.CROUCH : NAV_LINK.WALK);
const navChestHeight = (type) => (type === NAV_LINK.CROUCH ? NAV_CROUCH_CHEST : NAV_CHEST);

// Walk links first; then jump/drop/swim-exit links only between nodes that walking does not already join.
function navLinkNeighbours(builder) {
  for (let node = 0; node < Nav.nodeCount; node++) navLinkWalks(builder, node);
  const walks = navBucket(builder.from.length, Nav.nodeCount, (link, visit) => visit(builder.from[link]));
  const marks = new Int32Array(Nav.nodeCount).fill(-1);
  for (let node = 0; node < Nav.nodeCount; node++) navLinkAirs(builder, node, walks, marks);
}

function navLinkWalks(builder, node) {
  const count = navCollectNeighbours(node, NAV_WALK_RADIUS);
  for (let k = 0; k < count; k++) {
    const other = navNeighbours.items[k];
    if (other > node) navTryWalk(builder, node, other);
  }
}

function navLinkAirs(builder, node, walks, marks) {
  for (let k = walks.start[node]; k < walks.start[node + 1]; k++) marks[builder.to[walks.items[k]]] = node;
  const count = navCollectNeighbours(node, Nav.limits.jumpReach);
  for (let k = 0; k < count; k++) {
    const other = navNeighbours.items[k];
    if (other > node && !navWalkJoined(builder, other, walks, marks, node)) navLinkAir(builder, node, other);
  }
}

// marks[n] === node for every walk neighbour of node: joined when other is one of them or shares one.
function navWalkJoined(builder, other, walks, marks, node) {
  if (marks[other] === node) return true;
  for (let k = walks.start[other]; k < walks.start[other + 1]; k++) if (marks[builder.to[walks.items[k]]] === node) return true;
  return false;
}

function navLinkAir(builder, a, b) {
  if (navScan(Nav.nodeSample[a], Nav.nodeX[b], Nav.nodeZ[b], Nav.nodeSample[b]) >= 0) return; // walkable via nearer nodes
  navGatherBrushes(Math.min(Nav.nodeX[a], Nav.nodeX[b]), Math.min(Nav.nodeZ[a], Nav.nodeZ[b]), Math.max(Nav.nodeX[a], Nav.nodeX[b]), Math.max(Nav.nodeZ[a], Nav.nodeZ[b]));
  const highest = navHighestBetween(a, b, navScanState.stopFraction); // the same obstacles stand in both directions
  if (highest === Infinity) return;
  navTryAir(builder, a, b, highest);
  navTryAir(builder, b, a, highest);
}

// Walk, crouch or swim link both ways. Nothing walks out of a jump pad or teleporter (it launches you first).
function navTryWalk(builder, a, b) {
  const distance = Math.sqrt(navHorizontalSquared(a, b)), rise = Math.abs(Nav.nodeY[b] - Nav.nodeY[a]);
  if (distance > NAV_WALK_RADIUS || rise > distance * Math.tan(NAV_MAX_SLOPE) + NAV_STEP) return false;
  const forward = navScan(Nav.nodeSample[a], Nav.nodeX[b], Nav.nodeZ[b], Nav.nodeSample[b]);
  if (forward < 0) return false;
  const backward = (forward | Nav.nodeFlags[b]) & NAV_NODE.TRIGGER ? navScan(Nav.nodeSample[b], Nav.nodeX[a], Nav.nodeZ[a], Nav.nodeSample[a]) : forward;
  const flags = forward | Nav.nodeFlags[b], type = navWalkType(flags);
  if ((flags & NAV_NODE.NARROW) && !navLinkLineClear(a, b, navChestHeight(type))) return false;
  const seconds = navLinkSeconds(type, navNodeDistance(a, b));
  if (navWalkEntersTrigger(forward, a, b)) navAddLink(builder, a, b, type, 0, seconds);
  if (backward >= 0 && navWalkEntersTrigger(backward, b, a)) navAddLink(builder, b, a, type, 0, seconds);
  return true;
}

// Jump (over a gap, onto a ledge, over an obstacle), drop, or climbing out of water, from one node to another.
// highestBetween: navHighestBetween of the pair (the brushes around the pair are still gathered).
function navTryAir(builder, from, to, highestBetween) {
  const limits = Nav.limits, rise = Nav.nodeY[to] - Nav.nodeY[from];
  if (rise > limits.jumpUp || -rise > limits.maxDrop || (Nav.nodeFlags[from] & NAV_NODE.TRIGGER)) return;
  const lift = Math.max(highestBetween, Nav.nodeY[to]) - Nav.nodeY[from], type = navAirType(from, rise, lift);
  const height = type === NAV_LINK.DROP ? -rise : type === NAV_LINK.SWIM ? 0 : lift + NAV_JUMP_MARGIN;
  if (type === NAV_LINK.JUMP && height > limits.jumpUp) return;
  const apex = Nav.nodeY[from] + (type === NAV_LINK.JUMP ? height : Math.max(0, lift));
  if (!navArcClear(from, to, apex)) return;
  const fallSeconds = type === NAV_LINK.DROP ? Math.sqrt(2 * height / limits.gravity) : 0;
  navAddLink(builder, from, to, type, height, navLinkSeconds(type, navNodeDistance(from, to)) + fallSeconds);
}

// A walk may touch a trigger volume only when it ends on that trigger's node (stepping onto the pad on purpose).
function navWalkEntersTrigger(flags, from, to) {
  if (!(flags & NAV_NODE.TRIGGER)) return true;
  return !(Nav.nodeFlags[from] & NAV_NODE.TRIGGER) && (Nav.nodeFlags[to] & NAV_NODE.TRIGGER) !== 0;
}

function navAirType(from, rise, lift) {
  if ((Nav.nodeFlags[from] & NAV_NODE.WATER) && lift <= NAV_WATER_EXIT_RISE) return NAV_LINK.SWIM;
  if (lift <= NAV_STEP && rise < -NAV_STEP) return NAV_LINK.DROP;
  return NAV_LINK.JUMP;
}

// Highest gathered brush top on the line between two nodes (Infinity: a wall), which a jump either way must pass.
// firstFraction: where the raster walk broke; the check looks there first (usually the wall).
function navHighestBetween(a, b, firstFraction) {
  const ax = Nav.nodeX[a], az = Nav.nodeZ[a], bx = Nav.nodeX[b], bz = Nav.nodeZ[b];
  const base = Math.max(Nav.nodeY[a], Nav.nodeY[b]), limit = base + Nav.limits.jumpUp + NAV_JUMP_MARGIN, wallBelow = base + NAV_STAND_HEIGHT;
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / NAV_SCAN_STEP);
  let highest = navHighestTopGathered(ax + (bx - ax) * firstFraction, az + (bz - az) * firstFraction, limit, wallBelow);
  for (let step = 0; step <= steps && highest < Infinity; step++) {
    highest = Math.max(highest, navHighestTopGathered(ax + (bx - ax) * step / steps, az + (bz - az) * step / steps, limit, wallBelow));
  }
  return highest;
}

// Rise above the start, cross at apex height (chest and head lines), come down onto the target. Every line stays
// inside the pair's xz rectangle, whose brushes are gathered.
function navArcClear(from, to, apex) {
  const ax = Nav.nodeX[from], ay = Nav.nodeY[from], az = Nav.nodeZ[from], bx = Nav.nodeX[to], by = Nav.nodeY[to], bz = Nav.nodeZ[to];
  return navSegmentClearGathered(ax, ay + NAV_CHEST, az, ax, apex + NAV_HEAD, az)
    && navSegmentClearGathered(ax, apex + NAV_CHEST, az, bx, apex + NAV_CHEST, bz)
    && navSegmentClearGathered(ax, apex + NAV_HEAD, az, bx, apex + NAV_HEAD, bz)
    && navSegmentClearGathered(bx, apex + NAV_CHEST, bz, bx, by + NAV_CHEST, bz);
}

// Trigger volume -> link builder (map trigger fields: docs/api/nav.md).
const NAV_TRIGGER_LINKS = {
  ladder: navLinkLadder,
  jumppad: navLinkJumpPad,
  teleporter: navLinkTeleporter,
};

const navVolumeCentreX = (trigger) => (trigger.min[0] + trigger.max[0]) / 2;
const navVolumeCentreZ = (trigger) => (trigger.min[2] + trigger.max[2]) / 2;

function navFloorNodeOf(trigger) {
  const floor = trigger.min[1];
  return navSearchNodes(navVolumeCentreX(trigger), floor, navVolumeCentreZ(trigger), floor - NAV_BAND_BELOW, floor + NAV_BAND_ABOVE, NAV_TRIGGER_REACH, false);
}

function navLinkLadder(builder, trigger) {
  const x = navVolumeCentreX(trigger), z = navVolumeCentreZ(trigger), top = trigger.max[1];
  const bottomNode = navFloorNodeOf(trigger);
  const topNode = navSearchNodes(x, top, z, top - NAV_LADDER_TOP_BAND, top + NAV_BAND_ABOVE, NAV_TRIGGER_REACH, false);
  if (bottomNode < 0 || topNode < 0 || Nav.nodeY[topNode] - Nav.nodeY[bottomNode] <= NAV_STEP) return;
  if (!navSegmentClear(x, Nav.nodeY[bottomNode] + NAV_CHEST, z, x, Nav.nodeY[topNode] + NAV_CHEST, z)) return;
  const climb = Nav.nodeY[topNode] - Nav.nodeY[bottomNode];
  const seconds = climb / Nav.limits.ladderSpeed + navLinkSeconds(NAV_LINK.LADDER, Math.sqrt(navHorizontalSquared(bottomNode, topNode)));
  navAddLink(builder, bottomNode, topNode, NAV_LINK.LADDER, climb, seconds);
  navAddLink(builder, topNode, bottomNode, NAV_LINK.LADDER, climb, seconds);
}

// Pad fields as S08 reads them (docs/api/world-move.md): target [x, y, z] landing point and peak; the flight time is
// S08's own arc (World.padArc) under limits.gravity.
function navLinkJumpPad(builder, trigger) {
  const padNode = navFloorNodeOf(trigger), target = trigger.target;
  if (padNode < 0 || !Array.isArray(target)) return;
  const landing = navSearchNodes(target[0], target[1], target[2], target[1] - NAV_BAND_BELOW, target[1] + NAV_BAND_BELOW, NAV_LANDING_SEARCH, true);
  if (landing < 0 || landing === padNode) return;
  const seconds = World.padArc(trigger, Nav.nodeY[padNode], Nav.limits.gravity).time;
  navAddLink(builder, padNode, landing, NAV_LINK.JUMPPAD, 0, seconds + NAV_LINK_ROWS[NAV_LINK.JUMPPAD].extraSeconds);
}

// Teleporter fields: exit [x, y, z] (feet position after the jump).
function navLinkTeleporter(builder, trigger) {
  const exit = trigger.exit, entry = navFloorNodeOf(trigger);
  if (!Array.isArray(exit) || entry < 0) return;
  const target = navSearchNodes(exit[0], exit[1], exit[2], exit[1] - NAV_BAND_ABOVE, exit[1] + NAV_BAND_ABOVE, NAV_TRIGGER_REACH, true);
  if (target < 0 || target === entry) return;
  navAddLink(builder, entry, target, NAV_LINK.TELEPORT, 0, NAV_LINK_ROWS[NAV_LINK.TELEPORT].extraSeconds);
}

function navFinishLinks(builder) {
  const count = builder.from.length;
  const bucket = navBucket(count, Nav.nodeCount, (link, visit) => visit(builder.from[link]));
  const order = bucket.items;
  const pick = (list, Type) => { const sorted = new Type(count); for (let k = 0; k < count; k++) sorted[k] = list[order[k]]; return sorted; };
  Nav.linkCount = count; Nav.linkStart = bucket.start;
  Nav.linkFrom = pick(builder.from, Int32Array); Nav.linkTarget = pick(builder.to, Int32Array);
  Nav.linkType = pick(builder.type, Uint8Array); Nav.linkHeight = pick(builder.height, Float32Array); Nav.linkCost = pick(builder.seconds, Float32Array);
  Nav.linkReach = pick(builder.reach, Float32Array);
  const teleports = [];
  Nav.heuristicSpeed = Nav.limits.referenceSpeed;
  for (let link = 0; link < count; link++) {
    if (Nav.linkType[link] === NAV_LINK.TELEPORT) { teleports.push(link); continue; }
    Nav.heuristicSpeed = Math.max(Nav.heuristicSpeed, navNodeDistance(Nav.linkFrom[link], Nav.linkTarget[link]) / Nav.linkCost[link]);
  }
  Nav.teleportCount = teleports.length;
  Nav.teleportEntry = Int32Array.from(teleports, (link) => Nav.linkFrom[link]);
  Nav.teleportExit = Int32Array.from(teleports, (link) => Nav.linkTarget[link]);
}

// ---- Strongly connected components (iterative Tarjan): same component = reachable both ways ----
function navLabelComponents() {
  const count = Nav.nodeCount, t = navTarjan;
  t.index = new Int32Array(count).fill(-1); t.low = new Int32Array(count); t.onStack = new Uint8Array(count);
  t.stack = new Int32Array(count); t.callNode = new Int32Array(count); t.callEdge = new Int32Array(count);
  t.stackSize = 0; t.depth = -1; t.counter = 0;
  Nav.component = new Int32Array(count);
  for (let root = 0; root < count; root++) if (t.index[root] < 0) navStrongConnect(root);
  const bucket = navBucket(count, Nav.componentCount, (node, visit) => visit(Nav.component[node]));
  Nav.componentStart = bucket.start; Nav.componentNodes = bucket.items;
  Nav.mainComponent = 0;
  for (let id = 1; id < Nav.componentCount; id++) if (navComponentSize(id) > navComponentSize(Nav.mainComponent)) Nav.mainComponent = id;
  navComponentReach();
}

// Reachability between components as one bit row per component (Nav.reachable in O(1)). Tarjan numbers a component
// only after every component it links to, so one pass in id order sees each successor's row complete.
function navComponentReach() {
  const count = Nav.componentCount, words = Math.ceil(count / 32);
  Nav.componentWords = words;
  Nav.componentReach = null;
  if (count > NAV_REACH_MAX_COMPONENTS) return;
  const reach = new Uint32Array(count * words);
  for (let id = 0; id < count; id++) {
    reach[id * words + (id >> 5)] |= 1 << (id & 31);
    for (let k = Nav.componentStart[id]; k < Nav.componentStart[id + 1]; k++) navMergeReach(reach, words, id, Nav.componentNodes[k]);
  }
  Nav.componentReach = reach;
}

function navMergeReach(reach, words, id, node) {
  for (let link = Nav.linkStart[node]; link < Nav.linkStart[node + 1]; link++) {
    const other = Nav.component[Nav.linkTarget[link]];
    if (other === id) continue;
    for (let word = 0; word < words; word++) reach[id * words + word] |= reach[other * words + word];
  }
}

const navComponentSize = (id) => Nav.componentStart[id + 1] - Nav.componentStart[id];

function navStrongConnect(root) {
  const t = navTarjan;
  navTarjanVisit(root);
  while (t.depth >= 0) {
    const node = t.callNode[t.depth], edge = t.callEdge[t.depth];
    if (edge < Nav.linkStart[node + 1]) navTarjanFollow(node, edge);
    else navTarjanFinish(node);
  }
}

function navTarjanVisit(node) {
  const t = navTarjan;
  t.index[node] = t.low[node] = t.counter++;
  t.stack[t.stackSize++] = node; t.onStack[node] = 1;
  t.depth++; t.callNode[t.depth] = node; t.callEdge[t.depth] = Nav.linkStart[node];
}

function navTarjanFollow(node, edge) {
  const t = navTarjan, next = Nav.linkTarget[edge];
  t.callEdge[t.depth]++;
  if (t.index[next] < 0) { navTarjanVisit(next); return; }
  if (t.onStack[next]) t.low[node] = Math.min(t.low[node], t.index[next]);
}

function navTarjanFinish(node) {
  const t = navTarjan;
  if (t.low[node] === t.index[node]) navTarjanPop(node);
  t.depth--;
  if (t.depth >= 0) t.low[t.callNode[t.depth]] = Math.min(t.low[t.callNode[t.depth]], t.low[node]);
}

function navTarjanPop(node) {
  const t = navTarjan, id = Nav.componentCount++;
  let member = -1;
  while (member !== node) {
    member = t.stack[--t.stackSize];
    t.onStack[member] = 0;
    Nav.component[member] = id;
  }
}

// ---- Cover points (BOT-032): a wall close on one side, open space on the other ----
const NAV_COVER_DIRECTIONS = [0, 1, 2, 3, 4, 5, 6, 7].map((step) => [Math.sin(step * Math.PI / 4), Math.cos(step * Math.PI / 4)]); // 8 compass rays

function navFindCover() {
  const nodes = [], dirX = [], dirZ = [], low = [], best = { kind: NAV_COVER.NONE, direction: 0 };
  for (let node = 0; node < Nav.nodeCount; node++) {
    if (Nav.nodeFlags[node] & (NAV_NODE.CROUCH | NAV_NODE.WATER | NAV_NODE.TRIGGER) || !navNearWall(node)) continue;
    navBestCover(node, best);
    if (best.kind === NAV_COVER.NONE) continue;
    nodes.push(node); dirX.push(NAV_COVER_DIRECTIONS[best.direction][0]); dirZ.push(NAV_COVER_DIRECTIONS[best.direction][1]);
    low.push(best.kind === NAV_COVER.LOW ? 1 : 0);
  }
  Nav.coverCount = nodes.length;
  Nav.coverNode = Int32Array.from(nodes); Nav.coverDirX = Float32Array.from(dirX); Nav.coverDirZ = Float32Array.from(dirZ); Nav.coverLow = Uint8Array.from(low);
}

// Full cover beats crouch cover; the first direction wins a tie.
function navBestCover(node, best) {
  best.kind = NAV_COVER.NONE; best.direction = 0;
  for (let index = 0; index < NAV_COVER_DIRECTIONS.length && best.kind !== NAV_COVER.FULL; index++) {
    const kind = navCoverKind(node, NAV_COVER_DIRECTIONS[index][0], NAV_COVER_DIRECTIONS[index][1]);
    if (kind > best.kind) { best.kind = kind; best.direction = index; }
  }
}

function navNearWall(node) {
  const x = Nav.nodeX[node], y = Nav.nodeY[node], z = Nav.nodeZ[node], reach = NAV_RADIUS + NAV_COVER_WALL;
  navGatherBrushes(x - reach, z - reach, x + reach, z + reach);
  return navBoxBlockedGathered(x - reach, y + NAV_STEP, z - reach, x + reach, y + NAV_HEAD, z + reach);
}

function navCoverKind(node, dx, dz) {
  const x = Nav.nodeX[node], y = Nav.nodeY[node], z = Nav.nodeZ[node], reach = NAV_RADIUS + NAV_COVER_WALL;
  if (navSegmentClear(x, y + NAV_COVER_LOW_HEIGHT, z, x + dx * reach, y + NAV_COVER_LOW_HEIGHT, z + dz * reach)) return NAV_COVER.NONE;
  if (!navSegmentClear(x, y + NAV_CHEST, z, x - dx * NAV_COVER_OPEN, y + NAV_CHEST, z - dz * NAV_COVER_OPEN)) return NAV_COVER.NONE;
  return navSegmentClear(x, y + NAV_HEAD, z, x + dx * reach, y + NAV_HEAD, z + dz * reach) ? NAV_COVER.LOW : NAV_COVER.FULL;
}

// The threat sits on the wall side and has no line to the hidden body height (crouched behind low cover).
function navCoverHides(cover, threatX, threatY, threatZ) {
  const node = Nav.coverNode[cover], x = Nav.nodeX[node], y = Nav.nodeY[node], z = Nav.nodeZ[node];
  if ((threatX - x) * Nav.coverDirX[cover] + (threatZ - z) * Nav.coverDirZ[cover] <= 0) return false;
  const hidden = y + (Nav.coverLow[cover] ? NAV_CROUCH_CHEST : NAV_CHEST);
  return !navSegmentClear(threatX, threatY, threatZ, x, hidden, z);
}

function navDebugNode(out, node, count, limit) {
  for (let link = Nav.linkStart[node]; link < Nav.linkStart[node + 1] && count < limit; link++) {
    const target = Nav.linkTarget[link], type = Nav.linkType[link];
    if (target < node && NAV_LINK_ROWS[type].twoWay) continue;
    const base = count * NAV_DEBUG_STRIDE;
    out[base] = Nav.nodeX[node]; out[base + 1] = Nav.nodeY[node]; out[base + 2] = Nav.nodeZ[node];
    out[base + 3] = Nav.nodeX[target]; out[base + 4] = Nav.nodeY[target]; out[base + 5] = Nav.nodeZ[target];
    out[base + 6] = type;
    count++;
  }
  return count;
}
