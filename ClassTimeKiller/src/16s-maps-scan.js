// ==== S16 MAPS: SCAN ====
// Turns a map's brushes into a walkable graph without any movement code: a 0.5 m grid of standing surfaces (nodes), step/drop
// links between neighbours, extra links for jump pads, teleporters and ladders, and flood fills over it. The validator
// (16v-maps-validate.js) and the map tests use it; nothing here runs during a match. Uses S08's makeBrush / rayVersusBrush.

const MAP_CELL = 0.5;               // grid spacing, metres
const MAP_STEP = 0.45;              // DATA-003 step height
const MAP_HEADROOM = 2.4;           // MAP-004 double doorway height: every route needs this much clear space above the feet
const MAP_CLEARANCE = 0.7;          // half of the 1.4 m minimum doorway width
const MAP_DROP_MAX = 6;             // longest walk-off drop treated as a link (BOT-010)
const MAP_DROP_REACH = 3;           // a drop may land up to this many cells out from the ledge
const MAP_BUCKET = 4;              // brush lookup grid, metres
const MAP_SAME_HEIGHT = 0.02;       // surfaces closer than this are one surface
const MAP_LINK_COSTS = { pad: 4, teleporter: 2, ladder: 3 };
const MAP_NEIGHBOUR_I = [1, -1, 0, 0, 1, 1, -1, -1];
const MAP_NEIGHBOUR_J = [0, 0, 1, -1, 1, -1, 1, -1];
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
  cache: new WeakMap(),

  // Scan result for a map row, built once (rows are frozen data).
  of(map) {
    let scan = this.cache.get(map);
    if (!scan) { scan = this.build(map); this.cache.set(map, scan); }
    return scan;
  },

  build(map) {
    const scan = this.makeShell(map);
    this.fillBuckets(scan);
    this.scanColumns(scan, map);
    this.linkTriggers(scan, map);
    this.buildAdjacency(scan);
    return scan;
  },

  makeShell(map) {
    const brushes = map.brushes.map((source) => makeBrush(source));
    const cols = Math.ceil(map.size[0] / MAP_CELL), rows = Math.ceil(map.size[2] / MAP_CELL);
    const bucketsX = Math.ceil(map.size[0] / MAP_BUCKET), bucketsZ = Math.ceil(map.size[2] / MAP_BUCKET);
    return {
      map, brushes, cols, rows, originX: -map.size[0] / 2, originZ: -map.size[2] / 2, bucketsX, bucketsZ,
      buckets: Array.from({ length: bucketsX * bucketsZ }, () => []), stamp: new Int32Array(brushes.length), stampId: 0,
      near: new Int32Array(MAP_MAX_BRUSH_HITS), heights: new Float64Array(32),
      nodeColumn: null, nodeY: null, nodeCount: 0, columnStart: null, links: [], pads: [], teleporters: [], ladders: [],
      forward: null, backward: null, hazardNodes: 0,
    };
  },

  bucketRange(scan, low, high, origin, count) {
    return [Math.max(0, Math.min(count - 1, Math.floor((low - origin) / MAP_BUCKET))), Math.max(0, Math.min(count - 1, Math.floor((high - origin) / MAP_BUCKET)))];
  },

  fillBuckets(scan) { scan.brushes.forEach((brush, index) => this.addToBuckets(scan, brush, index)); },
  addToBuckets(scan, brush, index) {
    const [i0, i1] = this.bucketRange(scan, brush.minX, brush.maxX, scan.originX, scan.bucketsX);
    const [j0, j1] = this.bucketRange(scan, brush.minZ, brush.maxZ, scan.originZ, scan.bucketsZ);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) scan.buckets[j * scan.bucketsX + i].push(index);
  },

  // Fills scan.near with the indices of brushes whose footprint, grown by radius, contains (x, z); returns the count.
  collect(scan, x, z, radius) {
    scan.stampId++;
    const [i0, i1] = this.bucketRange(scan, x - radius, x + radius, scan.originX, scan.bucketsX);
    const [j0, j1] = this.bucketRange(scan, z - radius, z + radius, scan.originZ, scan.bucketsZ);
    let count = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) count = this.addBucket(scan, scan.buckets[j * scan.bucketsX + i], x, z, radius, count);
    return count;
  },
  addBucket(scan, bucket, x, z, radius, count) {
    for (let k = 0; k < bucket.length; k++) {
      const id = bucket[k];
      if (scan.stamp[id] === scan.stampId) continue;
      scan.stamp[id] = scan.stampId;
      if (mapInsideRect(scan.brushes[id], x, z, radius) && count < MAP_MAX_BRUSH_HITS) scan.near[count++] = id;
    }
    return count;
  },

  // Standing surfaces at the point: heights (ascending) where a 1.4 m wide, 2.4 m tall body fits. Fills scan.heights, returns count.
  surfacesAt(scan, x, z) {
    const near = this.collect(scan, x, z, MAP_CLEARANCE);
    let count = 0;
    for (let a = 0; a < near; a++) {
      const brush = scan.brushes[scan.near[a]];
      if (!mapInsideRect(brush, x, z, 0)) continue;
      const top = mapBrushTop(brush, x, z);
      if (this.hasHeight(scan.heights, count, top) || !this.canStand(scan, near, x, z, top)) continue;
      scan.heights[count++] = top;
    }
    const sorted = Array.from(scan.heights.subarray(0, count)).sort((p, q) => p - q);
    for (let i = 0; i < count; i++) scan.heights[i] = sorted[i];
    return count;
  },
  hasHeight(heights, count, top) {
    for (let i = 0; i < count; i++) if (Math.abs(heights[i] - top) < MAP_SAME_HEIGHT) return true;
    return false;
  },
  // True when the body fits on a surface of height `top`: not inside solid, 2.4 m of air above, no wall within 0.7 m.
  canStand(scan, near, x, z, top) {
    let ceiling = Infinity;
    for (let a = 0; a < near; a++) {
      const brush = scan.brushes[scan.near[a]];
      if (mapInsideRect(brush, x, z, 0)) {
        const other = mapBrushTop(brush, x, z);
        if (brush.minY < top - MAP_SAME_HEIGHT && other > top + MAP_SAME_HEIGHT) return false;   // the point is buried in this brush
        if (brush.minY >= top - MAP_SAME_HEIGHT) ceiling = Math.min(ceiling, brush.minY);
      } else if (this.blocksSide(brush, x, z, top)) {
        return false;
      }
    }
    return ceiling - top >= MAP_HEADROOM;
  },
  // A brush within the body radius that is too tall to step onto and starts below head height.
  blocksSide(brush, x, z, top) {
    const px = Math.max(brush.minX, Math.min(brush.maxX, x)), pz = Math.max(brush.minZ, Math.min(brush.maxZ, z));
    if ((px - x) * (px - x) + (pz - z) * (pz - z) > MAP_CLEARANCE * MAP_CLEARANCE) return false;
    return mapBrushTop(brush, px, pz) > top + MAP_STEP + MAP_SAME_HEIGHT && brush.minY < top + MAP_HEADROOM - MAP_SAME_HEIGHT;
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
    const x = scan.originX + (i + 0.5) * MAP_CELL, z = scan.originZ + (j + 0.5) * MAP_CELL;
    const count = this.surfacesAt(scan, x, z);
    for (let k = 0; k < count; k++) {
      if (this.inDeadlyTrigger(map, x, scan.heights[k], z)) { scan.hazardNodes++; continue; }
      nodeColumn.push(j * scan.cols + i);
      nodeY.push(scan.heights[k]);
    }
  },
  inDeadlyTrigger(map, x, y, z) {
    return map.triggers.some((t) => (t.kind === 'hazard' || t.kind === 'killzone') && this.inBox(t, x, y, z, 0, 0.6));
  },
  inBox(trigger, x, y, z, marginXZ, marginY) {
    return x >= trigger.min[0] - marginXZ && x <= trigger.max[0] + marginXZ && z >= trigger.min[2] - marginXZ && z <= trigger.max[2] + marginXZ &&
      y >= trigger.min[1] - marginY && y <= trigger.max[1] + marginY;
  },

  // ---- Node lookups ----
  columnOf(scan, x, z) {
    const i = Math.floor((x - scan.originX) / MAP_CELL), j = Math.floor((z - scan.originZ) / MAP_CELL);
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
    const dx = scan.originX + (ci + 0.5) * MAP_CELL - x, dz = scan.originZ + (cj + 0.5) * MAP_CELL - z;
    let node = -1, score = Infinity;
    for (let n = scan.columnStart[column]; n < scan.columnStart[column + 1]; n++) {
      const dy = Math.abs(scan.nodeY[n] - y);
      if (dy <= maxDy && dy + Math.hypot(dx, dz) < score) { node = n; score = dy + Math.hypot(dx, dz); }
    }
    return { node, score };
  },
  nodeX(scan, node) { return scan.originX + ((scan.nodeColumn[node] % scan.cols) + 0.5) * MAP_CELL; },
  nodeZ(scan, node) { return scan.originZ + (((scan.nodeColumn[node] / scan.cols) | 0) + 0.5) * MAP_CELL; },
  // Nodes within `radius` metres (horizontally) and `height` metres (vertically) of a node, itself included.
  nodesAround(scan, node, radius, height) {
    const reach = Math.ceil(radius / MAP_CELL), column = scan.nodeColumn[node], ci = column % scan.cols, cj = (column / scan.cols) | 0, found = [];
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
  nodesInBox(scan, box, marginXZ, marginY) {
    const found = [];
    for (let n = 0; n < scan.nodeCount; n++) if (this.inBox(box, this.nodeX(scan, n), scan.nodeY[n], this.nodeZ(scan, n), marginXZ, marginY)) found.push(n);
    return found;
  },

  // ---- Links: walking, then the trigger links ----
  // Best neighbour node in column (i, j) reachable from `node` by stepping up <= 0.45 m or dropping <= MAP_DROP_MAX; -1 when none.
  stepTarget(scan, node, i, j) {
    if (i < 0 || j < 0 || i >= scan.cols || j >= scan.rows) return -1;
    const column = j * scan.cols + i;
    let best = -1;
    for (let n = scan.columnStart[column]; n < scan.columnStart[column + 1]; n++) {
      const dy = scan.nodeY[n] - scan.nodeY[node];
      if (dy > MAP_STEP + 1e-4 || dy < -MAP_DROP_MAX) continue;
      if (best < 0 || scan.nodeY[n] > scan.nodeY[best]) best = n;
    }
    return best;
  },
  // A walk-off drop may land a little way out: the cells right at the foot of a wall are too close to it to hold a body (1.4 m rule).
  dropTarget(scan, node, ci, cj, d) {
    const nextX = scan.originX + (ci + MAP_NEIGHBOUR_I[d] + 0.5) * MAP_CELL, nextZ = scan.originZ + (cj + MAP_NEIGHBOUR_J[d] + 0.5) * MAP_CELL;
    if (this.solidAtFoot(scan, nextX, nextZ, scan.nodeY[node])) return -1;
    for (let k = 2; k <= MAP_DROP_REACH; k++) {
      const target = this.stepTarget(scan, node, ci + MAP_NEIGHBOUR_I[d] * k, cj + MAP_NEIGHBOUR_J[d] * k);
      if (target >= 0 && scan.nodeY[target] < scan.nodeY[node] - MAP_STEP) return target;
    }
    return -1;
  },
  walkTargets(scan, node, out) {
    const column = scan.nodeColumn[node], ci = column % scan.cols, cj = (column / scan.cols) | 0;
    let count = 0;
    for (let d = 0; d < 8; d++) {
      let target = this.stepTarget(scan, node, ci + MAP_NEIGHBOUR_I[d], cj + MAP_NEIGHBOUR_J[d]);
      if (target < 0 && d < 4) target = this.dropTarget(scan, node, ci, cj, d);
      if (target < 0) continue;
      if (d >= 4 && (this.stepTarget(scan, node, ci + MAP_NEIGHBOUR_I[d], cj) < 0 || this.stepTarget(scan, node, ci, cj + MAP_NEIGHBOUR_J[d]) < 0)) continue;
      out[count++] = target;
    }
    return count;
  },

  addLink(scan, from, to, cost) { if (from >= 0 && to >= 0 && from !== to) scan.links.push({ from, to, cost }); },

  linkTriggers(scan, map) {
    for (const trigger of map.triggers) {
      if (trigger.kind === 'jumppad') this.linkPad(scan, trigger);
      else if (trigger.kind === 'teleporter') this.linkTeleporter(scan, trigger);
      else if (trigger.kind === 'ladder') this.linkLadder(scan, trigger);
    }
  },
  linkPad(scan, trigger) {
    const entries = this.nodesInBox(scan, trigger, 0, 0.6);
    const landing = this.padLanding(scan, trigger);
    scan.pads.push({ trigger, entries: entries.length, landing });
    for (const entry of entries) this.addLink(scan, entry, landing, MAP_LINK_COSTS.pad);
  },
  // Flies a body from the pad centre at the launch velocity under nominal gravity; returns the node it lands on, or -1.
  padLanding(scan, trigger) {
    const step = 1 / 60;
    let x = (trigger.min[0] + trigger.max[0]) / 2, y = trigger.max[1], z = (trigger.min[2] + trigger.max[2]) / 2;
    let vy = trigger.launch[1];
    for (let t = 0; t < 8; t += step) {
      const previousY = y;
      x += trigger.launch[0] * step; z += trigger.launch[2] * step; vy -= GRAVITY * step; y += vy * step;
      if (this.bodyInSolid(scan, x, y, z)) return -1;
      const node = vy < 0 ? this.landingNode(scan, x, z, previousY, y) : -1;
      if (node >= 0) return node;
    }
    return -1;
  },
  bodyInSolid(scan, x, y, z) {
    const near = this.collect(scan, x, z, 0);
    for (let a = 0; a < near; a++) if (pointInBrush(x, y + 0.9, z, scan.brushes[scan.near[a]], 0)) return true;
    return false;
  },
  landingNode(scan, x, z, fromY, toY) {
    const column = this.columnOf(scan, x, z);
    if (column < 0) return -1;
    let best = -1;
    for (let n = scan.columnStart[column]; n < scan.columnStart[column + 1]; n++) {
      if (scan.nodeY[n] <= fromY + 0.05 && scan.nodeY[n] >= toY - 0.05 && (best < 0 || scan.nodeY[n] > scan.nodeY[best])) best = n;
    }
    return best;
  },
  linkTeleporter(scan, trigger) {
    const entries = this.nodesInBox(scan, trigger, 0, 0.6);
    const exit = this.nodeNear(scan, trigger.exit[0], trigger.exit[1], trigger.exit[2], 0.5);
    scan.teleporters.push({ trigger, entries: entries.length, exit });
    for (const entry of entries) this.addLink(scan, entry, exit, MAP_LINK_COSTS.teleporter);
  },
  // A ladder joins the walkable cells around its foot with the cells around its top (both directions).
  linkLadder(scan, trigger) {
    const bottoms = this.nodesInBox(scan, { min: [trigger.min[0], trigger.min[1] - 0.5, trigger.min[2]], max: [trigger.max[0], trigger.min[1] + 0.5, trigger.max[2]] }, 1.2, 0);
    const tops = this.nodesInBox(scan, { min: [trigger.min[0], trigger.max[1] - 0.5, trigger.min[2]], max: [trigger.max[0], trigger.max[1] + MAP_STEP, trigger.max[2]] }, 1.2, 0);
    scan.ladders.push({ trigger, bottoms: bottoms.length, tops: tops.length });
    if (!bottoms.length || !tops.length) return;
    const topHub = tops[0], bottomHub = bottoms[0];
    for (const bottom of bottoms) this.addLink(scan, bottom, topHub, MAP_LINK_COSTS.ladder);
    for (const top of tops) this.addLink(scan, top, bottomHub, MAP_LINK_COSTS.ladder);
  },

  // Compressed adjacency for the whole graph: forward edges and the reverse graph (for strong-connectivity tests).
  buildAdjacency(scan) {
    const count = scan.nodeCount, targets = new Int32Array(8), from = [], to = [], cost = [];
    const extras = new Map();
    for (const link of scan.links) { if (!extras.has(link.from)) extras.set(link.from, []); extras.get(link.from).push(link); }
    for (let n = 0; n < count; n++) this.collectEdges(scan, n, targets, extras.get(n), from, to, cost);
    scan.forward = { start: this.compress(count, from), to: Int32Array.from(to), cost: Float64Array.from(cost) };
    scan.backward = this.reverseGraph(count, from, to, cost);
  },
  collectEdges(scan, node, targets, links, from, to, cost) {
    const walk = this.walkTargets(scan, node, targets);
    for (let k = 0; k < walk; k++) {
      from.push(node); to.push(targets[k]);
      cost.push(this.edgeLength(scan, node, targets[k]));
    }
    for (const link of links || []) { from.push(node); to.push(link.to); cost.push(link.cost); }
  },
  edgeLength(scan, a, b) {
    const columnA = scan.nodeColumn[a], columnB = scan.nodeColumn[b];
    const diagonal = columnA % scan.cols !== columnB % scan.cols && ((columnA / scan.cols) | 0) !== ((columnB / scan.cols) | 0);
    return diagonal ? MAP_CELL * Math.SQRT2 : MAP_CELL;
  },
  // Start offsets of edge groups: edges[e] holds the node that edge e belongs to (a prefix sum of the per-node counts).
  compress(count, keys) {
    const start = new Int32Array(count + 1);
    for (let e = 0; e < keys.length; e++) start[keys[e] + 1]++;
    for (let n = 0; n < count; n++) start[n + 1] += start[n];
    return start;
  },
  // The same edges pointing the other way (for "who can reach this node" questions).
  reverseGraph(count, from, to, cost) {
    const start = this.compress(count, to), fill = start.slice(0, count);
    const targets = new Int32Array(to.length), costs = new Float64Array(to.length);
    for (let e = 0; e < to.length; e++) {
      const slot = fill[to[e]]++;
      targets[slot] = from[e]; costs[slot] = cost[e];
    }
    return { start, to: targets, cost: costs };
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
  // way TO the sources (how far each node is from walking to them).
  distances(scan, sources, blocked, reverse) {
    const graph = reverse ? scan.backward : scan.forward;
    const dist = new Float64Array(scan.nodeCount).fill(Infinity), previous = new Int32Array(scan.nodeCount).fill(-1);
    const heap = [];
    for (const source of sources) if (source >= 0 && !(blocked && blocked[source])) { dist[source] = 0; mapHeapPush(heap, 0, source); }
    while (heap.length) {
      const [key, node] = mapHeapPop(heap);
      if (key > dist[node]) continue;
      this.relax(graph, node, key, dist, previous, heap, blocked);
    }
    return { dist, previous };
  },
  relax(graph, node, key, dist, previous, heap, blocked) {
    for (let e = graph.start[node]; e < graph.start[node + 1]; e++) {
      const next = graph.to[e], total = key + graph.cost[e];
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
  // Distance a horizontal ray travels before it hits a brush (Infinity when it leaves the map unhindered).
  rayLength(scan, ox, oy, oz, dx, dz, maxDistance, hit) {
    let best = Infinity;
    for (let i = 0; i < scan.brushes.length; i++) {
      const brush = scan.brushes[i];
      if (brush.material === 'glass' || !rayHitsBox(ox, oy, oz, dx, 0, dz, Math.min(best, maxDistance), brush)) continue;
      if (rayVersusBrush(ox, oy, oz, dx, 0, dz, Math.min(best, maxDistance), brush, hit)) best = hit.distance;
    }
    return best;
  },
  // True when no brush (glass included) lies between the two points.
  clearBetween(scan, ax, ay, az, bx, by, bz, hit) {
    const length = Math.hypot(bx - ax, by - ay, bz - az);
    if (length < 1e-6) return true;
    const dx = (bx - ax) / length, dy = (by - ay) / length, dz = (bz - az) / length;
    for (let i = 0; i < scan.brushes.length; i++) {
      if (rayHitsBox(ax, ay, az, dx, dy, dz, length, scan.brushes[i]) && rayVersusBrush(ax, ay, az, dx, dy, dz, length, scan.brushes[i], hit)) return false;
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
      if (mapInsideRect(brush, x, z, 0) && brush.minY < y + 1 && mapBrushTop(brush, x, z) > y + MAP_STEP) return true;
    }
    return false;
  },
};

// Binary min-heap on parallel [key, node] pairs (arrays only exist while a validation runs).
function mapHeapPush(heap, key, node) {
  heap.push([key, node]);
  let child = heap.length - 1;
  while (child > 0) {
    const parent = (child - 1) >> 1;
    if (heap[parent][0] <= heap[child][0]) break;
    const keep = heap[parent]; heap[parent] = heap[child]; heap[child] = keep;
    child = parent;
  }
}
function mapHeapPop(heap) {
  const top = heap[0], last = heap.pop();
  if (!heap.length) return top;
  heap[0] = last;
  let parent = 0;
  for (;;) {
    const left = parent * 2 + 1, right = left + 1;
    let smallest = parent;
    if (left < heap.length && heap[left][0] < heap[smallest][0]) smallest = left;
    if (right < heap.length && heap[right][0] < heap[smallest][0]) smallest = right;
    if (smallest === parent) return top;
    const keep = heap[parent]; heap[parent] = heap[smallest]; heap[smallest] = keep;
    parent = smallest;
  }
}
