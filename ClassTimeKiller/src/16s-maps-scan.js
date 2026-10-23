// ==== S16 MAPS: SCAN ====
// Turns a map's brushes into a walkable graph without any movement code: a grid of standing surfaces (nodes, 0.5 m apart), step/drop
// links between neighbours, extra links for jump pads, teleporters and ladders, and flood fills over it. The validator
// (16v-maps-validate.js) and the map tests use it; nothing here runs during a match. Uses S08's makeBrush / rayBrush.

const MAP_CELL = 0.5;               // grid spacing, metres
const MAP_CELL_COARSE = 1;          // spacing on very large maps (the island): a quarter of the cells, the same rules
const MAP_COARSE_SIZE = 200;        // a map this long on either side uses the coarse grid
const MAP_HEADROOM = 2.4;           // MAP-004 double doorway height: every route needs this much clear space above the feet
const MAP_DOOR_WIDTH = 1.4;         // every route is at least this wide (walls on both sides leave this much room in total)
const MAP_HALF_DOOR = MAP_DOOR_WIDTH / 2;
const MAP_BODY_RADIUS = 0.4;        // DATA-003 capsule radius
const MAP_BODY_REACH = 0.42;        // radius plus skin: a wall never comes closer than this to the body
const MAP_BODY_CENTRE = 0.9;        // heights above the feet that must be free along a jump pad arc: the middle...
const MAP_BODY_TOP = 1.7;           // ...and the head
const MAP_GAP_EPSILON = 1e-6;
const MAP_DROP_MAX = 6;             // longest walk-off drop treated as a link (BOT-010)
const MAP_DROP_REACH = 3;           // a drop may land up to this many cells out from the ledge
const MAP_BUCKET = 4;              // brush lookup grid, metres
const MAP_SAME_HEIGHT = 0.02;       // surfaces closer than this are one surface
const MAP_FLOOR_TOLERANCE = 0.3;    // a spawn, item, objective or jump pad target sits on its floor within this
const MAP_PAD_GRAVITIES = [13, 20, 24];   // lowest preset, the nominal GRAVITY and highest preset: pad arcs are traced under each
const MAP_PAD_MIN_FLIGHT = 0.1;     // seconds, as in S08's jump pad launch
const MAP_ARC_STEP = 1 / 30;        // seconds between arc samples
// Edge kinds: how an edge costs. Walks cost one cell (a diagonal one cell times the square root of two), links a fixed time-like cost.
const MAP_EDGE = { straight: 0, diagonal: 1, pad: 2, teleporter: 3, ladder: 4 };
const MAP_LINK_COSTS = { [MAP_EDGE.pad]: 4, [MAP_EDGE.teleporter]: 2, [MAP_EDGE.ladder]: 3 };
const MAP_NEIGHBOUR_I = [1, -1, 0, 0, 1, 1, -1, -1];
const MAP_NEIGHBOUR_J = [0, 0, 1, -1, 1, -1, 1, -1];
const MAP_MAX_EDGES_PER_NODE = 8;
const MAP_MAX_BRUSH_HITS = 1024;

function mapInsideRect(brush, x, z, margin) {
  return x >= brush.minX - margin && x <= brush.maxX + margin && z >= brush.minZ - margin && z <= brush.maxZ + margin;
}

// Height of a brush's top face above (x, z): flat for boxes, the sloped plane for ramps (dir = the high side, as in S08 makeBrush).
function mapBrushTop(brush, x, z) {
  if (brush.shape !== 'ramp') return brush.maxY;
  const dir = brush.source.dir, rise = brush.maxY - brush.minY;
  if (dir === '+x') return brush.minY + (rise * (x - brush.minX)) / (brush.maxX - brush.minX);
  if (dir === '-x') return brush.minY + (rise * (brush.maxX - x)) / (brush.maxX - brush.minX);
  if (dir === '+z') return brush.minY + (rise * (z - brush.minZ)) / (brush.maxZ - brush.minZ);
  return brush.minY + (rise * (brush.maxZ - z)) / (brush.maxZ - brush.minZ);
}

const MapScan = {
  last: null,

  // Scan of a map row. Only the latest scan is kept (the island's graph is tens of megabytes) and it is tied to the row object:
  // clone a row before editing it. MapCheck.run releases it when a validation ends.
  of(map) {
    if (!this.last || this.last.map !== map) this.last = this.build(map);
    return this.last;
  },
  release() { this.last = null; },

  build(map) {
    const scan = this.makeShell(map);
    this.findOutside(scan);
    this.scanColumns(scan, map);
    this.linkTriggers(scan, map);
    this.buildAdjacency(scan);
    return scan;
  },

  makeShell(map) {
    // Props are solid boxes until they break (S08), so the scan counts them as boxes: the validator checks the map as it starts.
    const propBoxes = (map.props || []).map((prop) => ({ shape: 'box', min: prop.min, max: prop.max }));
    const brushes = map.brushes.concat(propBoxes).map((source) => makeBrush(source));
    const coarse = map.size[0] >= MAP_COARSE_SIZE || map.size[2] >= MAP_COARSE_SIZE, cell = coarse ? MAP_CELL_COARSE : MAP_CELL;
    const cols = Math.ceil(map.size[0] / cell), rows = Math.ceil(map.size[2] / cell);
    const need = Math.max(MAP_HALF_DOOR - cell / 2, MAP_BODY_REACH);     // the body may stand half a cell off the cell centre
    const originX = -map.size[0] / 2, originZ = -map.size[2] / 2;
    return {
      map, brushes, cell, cols, rows, originX, originZ, need, wallReach: MAP_DOOR_WIDTH - need,
      grid: BrushGrid.build({}, brushes, MAP_BUCKET, originX, originZ, originX + map.size[0], originZ + map.size[2]),
      near: new Int32Array(MAP_MAX_BRUSH_HITS), heights: new Float64Array(32), gaps: new Float64Array(4), steps: new Int32Array(4), flight: { rise: 0, time: 0 },
      outside: [], ray: { ox: 0, oy: 0, oz: 0, dx: 0, dz: 0, limit: 0, best: Infinity, hit: null },
      walk: makeGridWalk(),
      edgeCosts: Float64Array.of(cell, cell * Math.SQRT2, MAP_LINK_COSTS[MAP_EDGE.pad], MAP_LINK_COSTS[MAP_EDGE.teleporter], MAP_LINK_COSTS[MAP_EDGE.ladder]),
      nodeColumn: null, nodeY: null, nodeCount: 0, columnStart: null, links: [], pads: [], teleporters: [], ladders: [],
      forward: null, backward: null, hazardNodes: 0,
    };
  },

  // Brushes reaching past the bucket grid are also listed in scan.outside: a ray that leaves the grid still meets them.
  findOutside(scan) {
    scan.outside = scan.brushes.map((brush, index) => index).filter((index) => this.pastGrid(scan, scan.brushes[index]));
  },
  pastGrid(scan, brush) {
    const right = scan.originX + scan.grid.cellsX * MAP_BUCKET, far = scan.originZ + scan.grid.cellsZ * MAP_BUCKET;
    return brush.minX < scan.originX || brush.minZ < scan.originZ || brush.maxX > right || brush.maxZ > far;
  },

  // Fills scan.near with the indices of brushes whose footprint, grown by radius, contains (x, z); returns the count.
  collect(scan, x, z, radius) {
    const found = BrushGrid.query(scan.grid, x - radius, z - radius, x + radius, z + radius);
    let count = 0;
    for (let k = 0; k < found && count < MAP_MAX_BRUSH_HITS; k++) {
      const id = scan.grid.found[k];
      if (mapInsideRect(scan.brushes[id], x, z, radius)) scan.near[count++] = id;
    }
    return count;
  },

  // Standing surfaces at the point: heights (ascending) where a body fits (see canStand). Fills scan.heights, returns count.
  surfacesAt(scan, x, z) {
    const near = this.collect(scan, x, z, scan.wallReach);
    let count = 0;
    for (let a = 0; a < near; a++) {
      const brush = scan.brushes[scan.near[a]];
      if (!mapInsideRect(brush, x, z, 0)) continue;
      const top = mapBrushTop(brush, x, z);
      if (this.hasHeight(scan.heights, count, top) || !this.canStand(scan, near, x, z, top)) continue;
      scan.heights[count++] = top;
    }
    this.sortHeights(scan.heights, count);
    return count;
  },
  // Insertion sort, ascending: a column holds a handful of surfaces and this runs for every cell of the map.
  sortHeights(heights, count) {
    for (let i = 1; i < count; i++) {
      const value = heights[i];
      let j = i - 1;
      for (; j >= 0 && heights[j] > value; j--) heights[j + 1] = heights[j];
      heights[j + 1] = value;
    }
  },
  hasHeight(heights, count, top) {
    for (let i = 0; i < count; i++) if (Math.abs(heights[i] - top) < MAP_SAME_HEIGHT) return true;
    return false;
  },
  // True when the body fits on a surface of height `top`: not inside solid, 2.4 m of air above, and room between the walls (gapsFit).
  canStand(scan, near, x, z, top) {
    let ceiling = Infinity;
    scan.gaps.fill(Infinity);
    for (let a = 0; a < near; a++) {
      const brush = scan.brushes[scan.near[a]];
      if (!mapInsideRect(brush, x, z, 0)) { this.noteWall(scan, brush, x, z, top); continue; }
      const other = mapBrushTop(brush, x, z);
      if (brush.minY < top - MAP_SAME_HEIGHT && other > top + MAP_SAME_HEIGHT) return false;   // the point is buried in this brush
      if (brush.minY >= top - MAP_SAME_HEIGHT) ceiling = Math.min(ceiling, brush.minY);
    }
    return ceiling - top >= MAP_HEADROOM && this.gapsFit(scan);
  },
  // A brush too tall to step onto that starts below head height.
  isWall(brush, x, z, top) {
    const px = Math.max(brush.minX, Math.min(brush.maxX, x)), pz = Math.max(brush.minZ, Math.min(brush.maxZ, z));
    return mapBrushTop(brush, px, pz) > top + STEP_HEIGHT + MAP_SAME_HEIGHT && brush.minY < top + MAP_HEADROOM - MAP_SAME_HEIGHT;
  },
  // Records the free distance to the nearest wall on each side of the point: gaps = [x low, x high, z low, z high]. A wall counts on an
  // axis when it lies within the body's width on the other axis.
  noteWall(scan, brush, x, z, top) {
    if (!this.isWall(brush, x, z, top)) return;
    const gaps = scan.gaps;
    if (brush.minZ <= z + MAP_BODY_RADIUS && brush.maxZ >= z - MAP_BODY_RADIUS) {
      if (brush.maxX <= x) gaps[0] = Math.min(gaps[0], x - brush.maxX);
      else if (brush.minX >= x) gaps[1] = Math.min(gaps[1], brush.minX - x);
    }
    if (brush.minX <= x + MAP_BODY_RADIUS && brush.maxX >= x - MAP_BODY_RADIUS) {
      if (brush.maxZ <= z) gaps[2] = Math.min(gaps[2], z - brush.maxZ);
      else if (brush.minZ >= z) gaps[3] = Math.min(gaps[3], brush.minZ - z);
    }
  },
  // The body stands anywhere in its cell, so a cell fits when on each axis both gaps leave room for the body (scan.need) and together
  // they leave 1.4 m: a 1.4 m doorway passes at any offset on the grid, a 1.2 m one never does.
  gapsFit(scan) {
    for (let axis = 0; axis < 4; axis += 2) {
      const low = scan.gaps[axis], high = scan.gaps[axis + 1];
      if (low < scan.need - MAP_GAP_EPSILON || high < scan.need - MAP_GAP_EPSILON || low + high < MAP_DOOR_WIDTH - MAP_GAP_EPSILON) return false;
    }
    return true;
  },

  scanColumns(scan, map) {
    const nodeColumn = [], nodeY = [];
    scan.columnStart = new Int32Array(scan.cols * scan.rows + 1);
    for (let j = 0; j < scan.rows; j++) for (let i = 0; i < scan.cols; i++) {
      scan.columnStart[j * scan.cols + i] = nodeY.length;
      this.addColumnNodes(scan, map, i, j, nodeColumn, nodeY);
    }
    scan.columnStart[scan.cols * scan.rows] = nodeY.length;
    scan.nodeColumn = Int32Array.from(nodeColumn);
    scan.nodeY = Float32Array.from(nodeY);
    scan.nodeCount = nodeY.length;
  },
  addColumnNodes(scan, map, i, j, nodeColumn, nodeY) {
    const x = scan.originX + (i + 0.5) * scan.cell, z = scan.originZ + (j + 0.5) * scan.cell;
    const count = this.surfacesAt(scan, x, z);
    for (let k = 0; k < count; k++) {
      if (this.inDeadlyTrigger(map, x, scan.heights[k], z)) { scan.hazardNodes++; continue; }
      nodeColumn.push(j * scan.cols + i);
      nodeY.push(scan.heights[k]);
    }
  },
  inDeadlyTrigger(map, x, y, z) {
    for (let i = 0; i < map.triggers.length; i++) {
      const trigger = map.triggers[i];
      if ((trigger.kind === 'hazard' || trigger.kind === 'killzone') && mapInBox(trigger, x, y, z, 0, 0.6)) return true;
    }
    return false;
  },

  // ---- Node lookups ----
  columnOf(scan, x, z) {
    const i = Math.floor((x - scan.originX) / scan.cell), j = Math.floor((z - scan.originZ) / scan.cell);
    return i < 0 || j < 0 || i >= scan.cols || j >= scan.rows ? -1 : j * scan.cols + i;
  },
  // Node whose surface is closest in height to y within maxDy, looking at the cell and its 8 neighbours; -1 when none.
  nodeNear(scan, x, y, z, maxDy) {
    const column = this.columnOf(scan, x, z);
    if (column < 0) return -1;
    const ci = column % scan.cols, cj = (column / scan.cols) | 0;
    let best = -1, bestScore = Infinity;
    for (let d = -1; d < 8; d++) {
      const i = d < 0 ? ci : ci + MAP_NEIGHBOUR_I[d], j = d < 0 ? cj : cj + MAP_NEIGHBOUR_J[d];
      if (i < 0 || j < 0 || i >= scan.cols || j >= scan.rows) continue;
      const found = this.bestInColumn(scan, j * scan.cols + i, y, maxDy, x, z);
      if (found.node >= 0 && found.score + (d < 0 ? 0 : 0.3) < bestScore) { best = found.node; bestScore = found.score + (d < 0 ? 0 : 0.3); }
    }
    return best;
  },
  bestInColumn(scan, column, y, maxDy, x, z) {
    const ci = column % scan.cols, cj = (column / scan.cols) | 0;
    const dx = scan.originX + (ci + 0.5) * scan.cell - x, dz = scan.originZ + (cj + 0.5) * scan.cell - z;
    let node = -1, score = Infinity;
    for (let n = scan.columnStart[column]; n < scan.columnStart[column + 1]; n++) {
      const dy = Math.abs(scan.nodeY[n] - y);
      if (dy <= maxDy && dy + Math.hypot(dx, dz) < score) { node = n; score = dy + Math.hypot(dx, dz); }
    }
    return { node, score };
  },
  nodeX(scan, node) { return scan.originX + ((scan.nodeColumn[node] % scan.cols) + 0.5) * scan.cell; },
  nodeZ(scan, node) { return scan.originZ + (((scan.nodeColumn[node] / scan.cols) | 0) + 0.5) * scan.cell; },
  // Nodes within `radius` metres (horizontally) and `height` metres (vertically) of a node, itself included.
  nodesAround(scan, node, radius, height) {
    const reach = Math.ceil(radius / scan.cell), column = scan.nodeColumn[node], ci = column % scan.cols, cj = (column / scan.cols) | 0, found = [];
    for (let j = Math.max(0, cj - reach); j <= Math.min(scan.rows - 1, cj + reach); j++) {
      for (let i = Math.max(0, ci - reach); i <= Math.min(scan.cols - 1, ci + reach); i++) this.addNear(scan, j * scan.cols + i, node, radius, height, found);
    }
    return found;
  },
  addNear(scan, column, node, radius, height, found) {
    const x = this.nodeX(scan, node), z = this.nodeZ(scan, node);
    for (let m = scan.columnStart[column]; m < scan.columnStart[column + 1]; m++) {
      if (Math.abs(scan.nodeY[m] - scan.nodeY[node]) < height && Math.hypot(this.nodeX(scan, m) - x, this.nodeZ(scan, m) - z) <= radius) found.push(m);
    }
  },
  // Collects the nodes under a trigger box (grown by margins) into a list.
  // Only the columns under the box are visited (one cell of slack on each side); the list stays in node order.
  nodesInBox(scan, box, marginXZ, marginY) {
    const found = [], cell = scan.cell;
    const i0 = Math.max(0, Math.floor((box.min[0] - marginXZ - scan.originX) / cell) - 1), i1 = Math.min(scan.cols - 1, Math.floor((box.max[0] + marginXZ - scan.originX) / cell) + 1);
    const j0 = Math.max(0, Math.floor((box.min[2] - marginXZ - scan.originZ) / cell) - 1), j1 = Math.min(scan.rows - 1, Math.floor((box.max[2] + marginXZ - scan.originZ) / cell) + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.addInBox(scan, j * scan.cols + i, box, marginXZ, marginY, found);
    return found;
  },
  addInBox(scan, column, box, marginXZ, marginY, found) {
    for (let n = scan.columnStart[column]; n < scan.columnStart[column + 1]; n++) {
      if (mapInBox(box, this.nodeX(scan, n), scan.nodeY[n], this.nodeZ(scan, n), marginXZ, marginY)) found.push(n);
    }
  },

  // ---- Links: walking, then the trigger links ----
  // Best neighbour node in column (i, j) reachable from `node` by stepping up <= 0.45 m or dropping <= MAP_DROP_MAX; -1 when none.
  stepTarget(scan, node, i, j) {
    if (i < 0 || j < 0 || i >= scan.cols || j >= scan.rows) return -1;
    const column = j * scan.cols + i;
    let best = -1;
    for (let n = scan.columnStart[column]; n < scan.columnStart[column + 1]; n++) {
      const dy = scan.nodeY[n] - scan.nodeY[node];
      if (dy > STEP_HEIGHT + 1e-4 || dy < -MAP_DROP_MAX) continue;
      if (best < 0 || scan.nodeY[n] > scan.nodeY[best]) best = n;
    }
    return best;
  },
  // A walk-off drop may land a little way out: the cells right at the foot of a wall are too close to it to hold a body (1.4 m rule).
  dropTarget(scan, node, ci, cj, d) {
    const nextX = scan.originX + (ci + MAP_NEIGHBOUR_I[d] + 0.5) * scan.cell, nextZ = scan.originZ + (cj + MAP_NEIGHBOUR_J[d] + 0.5) * scan.cell;
    if (this.solidAtFoot(scan, nextX, nextZ, scan.nodeY[node])) return -1;
    for (let k = 2; k <= MAP_DROP_REACH; k++) {
      const target = this.stepTarget(scan, node, ci + MAP_NEIGHBOUR_I[d] * k, cj + MAP_NEIGHBOUR_J[d] * k);
      if (target >= 0 && scan.nodeY[target] < scan.nodeY[node] - STEP_HEIGHT) return target;
    }
    return -1;
  },
  // A diagonal step needs both straight steps beside it: the four straight results (scan.steps, by MAP_NEIGHBOUR index) are reused.
  // kinds (optional) gets the edge kind of each target: diagonal for the last four directions, straight for steps and drops.
  walkTargets(scan, node, out, kinds) {
    const column = scan.nodeColumn[node], ci = column % scan.cols, cj = (column / scan.cols) | 0, steps = scan.steps;
    let count = 0;
    for (let d = 0; d < 8; d++) {
      let target = this.stepTarget(scan, node, ci + MAP_NEIGHBOUR_I[d], cj + MAP_NEIGHBOUR_J[d]);
      if (d < 4) steps[d] = target;
      if (target < 0 && d < 4) target = this.dropTarget(scan, node, ci, cj, d);
      if (target < 0) continue;
      if (d >= 4 && (steps[MAP_NEIGHBOUR_I[d] > 0 ? 0 : 1] < 0 || steps[MAP_NEIGHBOUR_J[d] > 0 ? 2 : 3] < 0)) continue;
      if (kinds) kinds[count] = d >= 4 ? MAP_EDGE.diagonal : MAP_EDGE.straight;
      out[count++] = target;
    }
    return count;
  },

  addLink(scan, from, to, kind) { if (from >= 0 && to >= 0 && from !== to) scan.links.push({ from, to, kind }); },

  linkTriggers(scan, map) {
    for (const trigger of map.triggers) {
      if (trigger.kind === 'jumppad') this.linkPad(scan, trigger);
      else if (trigger.kind === 'teleporter') this.linkTeleporter(scan, trigger);
      else if (trigger.kind === 'ladder') this.linkLadder(scan, trigger);
    }
  },
  // A pad (docs/api/world-move.md) throws whoever steps on it, from wherever it stands, along an arc onto `target`. Every start cell in
  // the pad box gets a link when the arc is free; the arc is the same under every gravity, only the flight time changes.
  linkPad(scan, trigger) {
    const entries = this.nodesInBox(scan, trigger, 0, 0.6), target = trigger.target;
    const landing = this.nodeNear(scan, target[0], target[1], target[2], MAP_FLOOR_TOLERANCE);
    const open = landing < 0 ? [] : entries.filter((entry) => this.arcFree(scan, entry, trigger));
    scan.pads.push({ trigger, entries: entries.length, landing, open: open.length, firm: landing >= 0 && this.floorAround(scan, target[0], target[1], target[2]) });
    for (const entry of open) this.addLink(scan, entry, landing, MAP_EDGE.pad);
  },
  // True when the body flying from the start cell to the pad target hits nothing, under every gravity in MAP_PAD_GRAVITIES.
  arcFree(scan, node, trigger) {
    const x = this.nodeX(scan, node), y = scan.nodeY[node], z = this.nodeZ(scan, node);
    for (const gravity of MAP_PAD_GRAVITIES) if (!this.arcClear(scan, x, y, z, trigger, gravity)) return false;
    return true;
  },
  // The flight S08's touchJumpPad gives: up to `peak` m above the higher of start and target, then down onto the target. Fills
  // out.rise (the launch speed upward, m/s) and out.time (seconds in the air).
  padFlight(out, startY, trigger, gravity) {
    const peakY = Math.max(startY, trigger.target[1]) + trigger.peak;
    out.rise = Math.sqrt(2 * gravity * (peakY - startY));
    out.time = Math.max(MAP_PAD_MIN_FLIGHT, out.rise / gravity + Math.sqrt((2 * (peakY - trigger.target[1])) / gravity));
  },
  arcClear(scan, startX, startY, startZ, trigger, gravity) {
    const flight = scan.flight, target = trigger.target;
    this.padFlight(flight, startY, trigger, gravity);
    const vx = (target[0] - startX) / flight.time, vz = (target[2] - startZ) / flight.time;
    for (let t = MAP_ARC_STEP; t < flight.time; t += MAP_ARC_STEP) {
      if (this.bodyHitsSolid(scan, startX + vx * t, startY + flight.rise * t - 0.5 * gravity * t * t, startZ + vz * t)) return false;
    }
    return true;
  },
  // Middle and head of the body (with the capsule radius as margin) inside a brush. The feet are left out: they start on a floor.
  bodyHitsSolid(scan, x, y, z) {
    const near = this.collect(scan, x, z, MAP_BODY_REACH);
    for (let a = 0; a < near; a++) {
      const brush = scan.brushes[scan.near[a]];
      if (pointInBrush(x, y + MAP_BODY_CENTRE, z, brush, MAP_BODY_REACH) || pointInBrush(x, y + MAP_BODY_TOP, z, brush, MAP_BODY_REACH)) return true;
    }
    return false;
  },
  // True when floor of the same level lies at least one capsule radius out from the point in every direction (a landing, not an edge).
  floorAround(scan, x, y, z) {
    for (let d = 0; d < 8; d++) {
      const reach = d < 4 ? MAP_BODY_RADIUS : MAP_BODY_RADIUS * Math.SQRT1_2;
      if (this.topBelow(scan, x + MAP_NEIGHBOUR_I[d] * reach, z + MAP_NEIGHBOUR_J[d] * reach, y + STEP_HEIGHT) < y - STEP_HEIGHT) return false;
    }
    return true;
  },
  linkTeleporter(scan, trigger) {
    const entries = this.nodesInBox(scan, trigger, 0, 0.6);
    const exit = this.nodeNear(scan, trigger.exit[0], trigger.exit[1], trigger.exit[2], 0.5);
    scan.teleporters.push({ trigger, entries: entries.length, exit });
    for (const entry of entries) this.addLink(scan, entry, exit, MAP_EDGE.teleporter);
  },
  // A ladder joins the walkable cells around its foot with the cells around its top (both directions).
  linkLadder(scan, trigger) {
    const bottoms = this.nodesInBox(scan, { min: [trigger.min[0], trigger.min[1] - 0.5, trigger.min[2]], max: [trigger.max[0], trigger.min[1] + 0.5, trigger.max[2]] }, 1.2, 0);
    const tops = this.nodesInBox(scan, { min: [trigger.min[0], trigger.max[1] - 0.5, trigger.min[2]], max: [trigger.max[0], trigger.max[1] + STEP_HEIGHT, trigger.max[2]] }, 1.2, 0);
    scan.ladders.push({ trigger, bottoms: bottoms.length, tops: tops.length });
    if (!bottoms.length || !tops.length) return;
    const topHub = tops[0], bottomHub = bottoms[0];
    for (const bottom of bottoms) this.addLink(scan, bottom, topHub, MAP_EDGE.ladder);
    for (const top of tops) this.addLink(scan, top, bottomHub, MAP_EDGE.ladder);
  },

  // Compressed adjacency for the whole graph: forward edges and the reverse graph (for strong-connectivity tests). Edges are an
  // Int32 target and a Uint8 kind (scan.edgeCosts holds the cost of each kind), written straight into pre-sized arrays.
  buildAdjacency(scan) {
    const count = scan.nodeCount, targets = new Int32Array(MAP_MAX_EDGES_PER_NODE), kinds = new Uint8Array(MAP_MAX_EDGES_PER_NODE), extras = new Map();
    for (const link of scan.links) {
      if (!extras.has(link.from)) extras.set(link.from, []);
      extras.get(link.from).push(link);
    }
    const capacity = count * MAP_MAX_EDGES_PER_NODE + scan.links.length;
    const start = new Int32Array(count + 1), to = new Int32Array(capacity), kind = new Uint8Array(capacity);
    let edges = 0;
    for (let n = 0; n < count; n++) {
      start[n] = edges;
      edges = this.collectEdges(scan, n, targets, kinds, extras.get(n), to, kind, edges);
    }
    start[count] = edges;
    scan.forward = { start, to: to.subarray(0, edges), kind: kind.subarray(0, edges) };
    scan.backward = this.reverseGraph(scan.forward, count);
  },
  collectEdges(scan, node, targets, kinds, links, to, kind, edges) {
    const walk = this.walkTargets(scan, node, targets, kinds);
    for (let k = 0; k < walk; k++, edges++) {
      to[edges] = targets[k];
      kind[edges] = kinds[k];
    }
    if (!links) return edges;
    for (const link of links) { to[edges] = link.to; kind[edges++] = link.kind; }
    return edges;
  },
  // The same edges pointing the other way (for "who can reach this node" questions).
  reverseGraph(graph, count) {
    const edges = graph.to.length, start = new Int32Array(count + 1);
    for (let e = 0; e < edges; e++) start[graph.to[e] + 1]++;
    for (let n = 0; n < count; n++) start[n + 1] += start[n];
    const fill = start.slice(0, count), to = new Int32Array(edges), kind = new Uint8Array(edges);
    for (let n = 0; n < count; n++) {
      for (let e = graph.start[n]; e < graph.start[n + 1]; e++) {
        const slot = fill[graph.to[e]]++;
        to[slot] = n; kind[slot] = graph.kind[e];
      }
    }
    return { start, to, kind };
  },

  // ---- Flood fills ----
  // Nodes reachable from `sources` (forward) or that can reach them (reverse = true); returns a Uint8Array mask.
  reach(scan, sources, reverse, blocked) {
    const seen = new Uint8Array(scan.nodeCount), queue = new Int32Array(scan.nodeCount);
    const { start, to } = reverse ? scan.backward : scan.forward;
    let head = 0, tail = 0;
    for (const source of sources) if (source >= 0 && !seen[source] && !(blocked && blocked[source])) { seen[source] = 1; queue[tail++] = source; }
    while (head < tail) {
      const node = queue[head++];
      for (let e = start[node]; e < start[node + 1]; e++) {
        const next = to[e];
        if (seen[next] || (blocked && blocked[next])) continue;
        seen[next] = 1; queue[tail++] = next;
      }
    }
    return seen;
  },
  // The nodes you can walk from `source` and walk back from: the part of the map that is one connected playable space.
  loopOf(scan, source) {
    const forward = this.reach(scan, [source], false, null), backward = this.reach(scan, [source], true, null);
    for (let n = 0; n < scan.nodeCount; n++) forward[n] = forward[n] & backward[n];
    return forward;
  },
  // Path-length distances (metres) from `sources` with predecessors; Infinity where unreachable. reverse = true measures the
  // way TO the sources (how far each node is from walking to them). With a target the search stops once the target is settled:
  // its distance and the path to it are final, the other nodes' values may be partial.
  distances(scan, sources, blocked, reverse, target) {
    const graph = reverse ? scan.backward : scan.forward;
    const dist = new Float64Array(scan.nodeCount).fill(Infinity), previous = new Int32Array(scan.nodeCount).fill(-1);
    const heap = mapMakeHeap(scan.nodeCount);
    for (const source of sources) if (source >= 0 && !(blocked && blocked[source])) { dist[source] = 0; mapHeapPush(heap, 0, source); }
    while (heap.size) {
      mapHeapPop(heap);
      const key = heap.topKey, node = heap.topNode;
      if (key > dist[node]) continue;
      if (node === target) break;
      this.relax(scan, graph, node, key, dist, previous, heap, blocked);
    }
    return { dist, previous };
  },
  relax(scan, graph, node, key, dist, previous, heap, blocked) {
    for (let e = graph.start[node]; e < graph.start[node + 1]; e++) {
      const next = graph.to[e], total = key + scan.edgeCosts[graph.kind[e]];
      if ((blocked && blocked[next]) || total >= dist[next]) continue;
      dist[next] = total; previous[next] = node;
      mapHeapPush(heap, total, next);
    }
  },
  pathTo(previous, target) {
    const path = [];
    for (let n = target; n >= 0; n = previous[n]) path.push(n);
    return path.reverse();
  },

  // ---- Geometry queries on the map's own brushes (no World state) ----
  // Distance a horizontal ray travels before it hits a brush (Infinity when it leaves the map unhindered). Glass does not stop it.
  // The ray walks the brush buckets front to back and stops at the first bucket that begins beyond its nearest hit, so it tests only
  // the brushes along its way; the brushes past the grid are tested when it leaves the grid.
  rayLength(scan, ox, oy, oz, dx, dz, maxDistance, hit) {
    const ray = scan.ray, grid = scan.grid;
    ray.ox = ox; ray.oy = oy; ray.oz = oz; ray.dx = dx; ray.dz = dz; ray.limit = maxDistance; ray.best = Infinity; ray.hit = hit;
    BrushGrid.beginPass(grid);
    const walk = BrushGrid.startWalk(grid, scan.walk, ox, oz, dx, dz);
    if (BrushGrid.walkCell(grid, walk) < 0) return this.rayAll(scan, ray);   // starts outside the grid
    for (let cell = BrushGrid.walkCell(grid, walk); cell >= 0; cell = BrushGrid.walkCell(grid, walk)) {
      this.rayCell(scan, ray, cell);
      if (Math.min(walk.nextI, walk.nextJ) > Math.min(ray.best, maxDistance)) return ray.best;
      BrushGrid.stepWalk(walk);
    }
    this.rayList(scan, ray, scan.outside);
    return ray.best;
  },
  rayCell(scan, ray, cell) {
    const grid = scan.grid;
    for (let k = grid.cellStart[cell]; k < grid.cellStart[cell + 1]; k++) this.rayTest(scan, ray, grid.cellItems[k]);
  },
  rayList(scan, ray, list) { for (let k = 0; k < list.length; k++) this.rayTest(scan, ray, list[k]); },
  rayAll(scan, ray) {
    for (let id = 0; id < scan.brushes.length; id++) this.rayTest(scan, ray, id);
    return ray.best;
  },
  // One brush against the ray (once per ray: brushes span several buckets); a nearer hit shortens the ray.
  rayTest(scan, ray, id) {
    if (!BrushGrid.firstVisit(scan.grid, id)) return;
    const brush = scan.brushes[id];
    if (brush.material !== 'glass' && rayBrush(ray.ox, ray.oy, ray.oz, ray.dx, 0, ray.dz, Math.min(ray.best, ray.limit), brush, ray.hit)) ray.best = ray.hit.distance;
  },
  // True when no brush (glass included) lies between the two points.
  clearBetween(scan, ax, ay, az, bx, by, bz, hit) {
    const length = Math.hypot(bx - ax, by - ay, bz - az);
    if (length < 1e-6) return true;
    const dx = (bx - ax) / length, dy = (by - ay) / length, dz = (bz - az) / length;
    for (let i = 0; i < scan.brushes.length; i++) {
      if (rayBrush(ax, ay, az, dx, dy, dz, length, scan.brushes[i], hit)) return false;
    }
    return true;
  },
  // Highest brush top at or below y over the point; -Infinity when nothing lies under it.
  topBelow(scan, x, z, y) {
    const near = this.collect(scan, x, z, 0);
    let best = -Infinity;
    for (let a = 0; a < near; a++) {
      const top = mapBrushTop(scan.brushes[scan.near[a]], x, z);
      if (top <= y && top > best) best = top;
    }
    return best;
  },
  // Lowest underside above the feet (Infinity under open sky).
  ceilingAbove(scan, x, z, y) {
    const near = this.collect(scan, x, z, 0);
    let ceiling = Infinity;
    for (let a = 0; a < near; a++) {
      const brush = scan.brushes[scan.near[a]];
      if (mapInsideRect(brush, x, z, 0) && brush.minY > y + 1 && brush.minY < ceiling) ceiling = brush.minY;
    }
    return ceiling;
  },
  // True when a brush fills the column at foot height (a wall rather than empty air).
  solidAtFoot(scan, x, z, y) {
    const near = this.collect(scan, x, z, 0);
    for (let a = 0; a < near; a++) {
      const brush = scan.brushes[scan.near[a]];
      if (mapInsideRect(brush, x, z, 0) && brush.minY < y + 1 && mapBrushTop(brush, x, z) > y + STEP_HEIGHT) return true;
    }
    return false;
  },
};

// Binary min-heap of (key, node) pairs in parallel typed arrays that double when full (one heap per distances() call, no
// per-push arrays). mapHeapPop leaves the smallest pair in heap.topKey / heap.topNode.
function mapMakeHeap(capacity) { return { keys: new Float64Array(Math.max(16, capacity)), nodes: new Int32Array(Math.max(16, capacity)), size: 0, topKey: 0, topNode: -1 }; }
function mapHeapGrow(heap) {
  const keys = new Float64Array(heap.keys.length * 2), nodes = new Int32Array(heap.keys.length * 2);
  keys.set(heap.keys); nodes.set(heap.nodes);
  heap.keys = keys; heap.nodes = nodes;
}
function mapHeapSwap(heap, a, b) {
  const key = heap.keys[a], node = heap.nodes[a];
  heap.keys[a] = heap.keys[b]; heap.nodes[a] = heap.nodes[b];
  heap.keys[b] = key; heap.nodes[b] = node;
}
function mapHeapPush(heap, key, node) {
  if (heap.size === heap.keys.length) mapHeapGrow(heap);
  let child = heap.size++;
  heap.keys[child] = key; heap.nodes[child] = node;
  while (child > 0) {
    const parent = (child - 1) >> 1;
    if (heap.keys[parent] <= heap.keys[child]) break;
    mapHeapSwap(heap, parent, child);
    child = parent;
  }
}
function mapHeapPop(heap) {
  heap.topKey = heap.keys[0]; heap.topNode = heap.nodes[0];
  heap.size--;
  if (!heap.size) return;
  heap.keys[0] = heap.keys[heap.size]; heap.nodes[0] = heap.nodes[heap.size];
  let parent = 0;
  for (;;) {
    const left = parent * 2 + 1, right = left + 1;
    let smallest = parent;
    if (left < heap.size && heap.keys[left] < heap.keys[smallest]) smallest = left;
    if (right < heap.size && heap.keys[right] < heap.keys[smallest]) smallest = right;
    if (smallest === parent) return;
    mapHeapSwap(heap, parent, smallest);
    parent = smallest;
  }
}
