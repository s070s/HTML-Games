// Nav add-on: A* on a binary heap over typed arrays, path cache, per-tick query budget (BOT-011, BOT-091),
// string pulling, reachability and map validation. Every buffer is sized when the graph is built: queries allocate nothing.

const NAV_QUERIES_PER_TICK = 4;         // BOT-091: path searches per sim tick; further requests wait in the queue
const NAV_SLOTS = MAX_ACTORS;           // request slots (bots use their actor id)
const NAV_SLOT_PATH = 1024;             // longest path a request slot keeps (nodes and smoothed points)
const NAV_CACHE_SIZE = 64;              // direct-mapped path cache entries (power of two)
const NAV_CACHE_PATH = 256;             // longer paths are not cached
const NAV_SMOOTH_LOOKAHEAD = 12;        // string pulling tests at most this many nodes ahead
const NAV_HEIGHT_TOLERANCE = 1e-3;      // link heights are float32
const NAV_STATUS = { NONE: 0, QUEUED: 1, DONE: 2, FAILED: 3 };
const NAV_DEFAULT_OPTIONS = {};
const NAV_KEY_JUMP_MAX = 1023;          // cache key fields: jump height in cm (10 bits), drop in dm (10 bits), crouch bit
const NAV_KEY_DROP_MAX = 1023;
const NAV_SMOOTHABLE = Uint8Array.from(NAV_LINK_ROWS, (row) => (row.smooth ? 1 : 0));

const navSearch = {
  generation: 0, cost: null, parentLink: null, seen: null, closed: null, heapNode: null, heapScore: null, heapSize: 0,
  path: null, pathType: null, teleportExitCost: null,
  goalX: 0, goalY: 0, goalZ: 0, allowJumpHeight: 0, maxDrop: 0, crouchOk: true, avoid: null, danger: null,
};
const navCache = {
  from: new Int32Array(NAV_CACHE_SIZE).fill(-1), to: new Int32Array(NAV_CACHE_SIZE), key: new Int32Array(NAV_CACHE_SIZE),
  length: new Int32Array(NAV_CACHE_SIZE), cost: new Float32Array(NAV_CACHE_SIZE),
  nodes: new Int32Array(NAV_CACHE_SIZE * NAV_CACHE_PATH), types: new Uint8Array(NAV_CACHE_SIZE * NAV_CACHE_PATH),
};
const navSlots = {
  from: new Int32Array(NAV_SLOTS), to: new Int32Array(NAV_SLOTS), status: new Uint8Array(NAV_SLOTS), inQueue: new Uint8Array(NAV_SLOTS),
  jump: new Float32Array(NAV_SLOTS), drop: new Float32Array(NAV_SLOTS), crouch: new Uint8Array(NAV_SLOTS),
  avoid: new Array(NAV_SLOTS).fill(null), danger: new Array(NAV_SLOTS).fill(null),
  queue: new Int32Array(NAV_SLOTS), queueHead: 0, queueCount: 0,
  nodeCount: new Int32Array(NAV_SLOTS), nodes: new Int32Array(NAV_SLOTS * NAV_SLOT_PATH), cost: new Float32Array(NAV_SLOTS),
  pointCount: new Int32Array(NAV_SLOTS), points: new Float32Array(NAV_SLOTS * NAV_SLOT_PATH * 3), pointTypes: new Uint8Array(NAV_SLOTS * NAV_SLOT_PATH),
};
const navSlotOptions = { allowJumpHeight: 0, maxDrop: 0, crouchOk: true, avoid: null, danger: null };

Object.assign(Nav, {
  pathNodes: null,          // last findPath result: node indices 0..pathLength-1
  pathTypes: null,          // link type from pathNodes[i] to pathNodes[i + 1] (NAV_LINK_NONE on the last node)
  pathLength: 0,
  pathCost: Infinity,       // travel seconds of the last path
  lastCacheHit: false,
  cacheHits: 0, cacheMisses: 0, searches: 0, searchesThisTick: 0,
  slots: navSlots,

  // Called by build: sizes every search buffer once, empties the cache and the request queue.
  resetPaths() {
    const nodes = Math.max(1, this.nodeCount), heap = this.linkCount + nodes;
    const s = navSearch;
    s.generation = 0; s.cost = new Float32Array(nodes); s.parentLink = new Int32Array(nodes);
    s.seen = new Uint32Array(nodes); s.closed = new Uint32Array(nodes);
    s.heapNode = new Int32Array(heap); s.heapScore = new Float32Array(heap);
    s.path = new Int32Array(nodes); s.pathType = new Uint8Array(nodes); s.teleportExitCost = new Float32Array(this.teleportCount);
    this.pathNodes = s.path; this.pathTypes = s.pathType; this.pathLength = 0; this.pathCost = Infinity;
    navCache.from.fill(-1);
    navSlots.status.fill(NAV_STATUS.NONE); navSlots.inQueue.fill(0); navSlots.queueCount = 0;
    navSlots.avoid.fill(null); navSlots.danger.fill(null);
  },

  // Synchronous A* (unbudgeted: bots use request). options: { allowJumpHeight, maxDrop, crouchOk, avoid(node) -> extra seconds
  // (Infinity forbids), danger: Float32Array of extra seconds per node }. Returns the node count of the path (0 = none).
  findPath(from, to, options) {
    this.pathLength = 0; this.pathCost = Infinity; this.lastCacheHit = false;
    if (!navValidNode(from) || !navValidNode(to)) return 0;
    navReadOptions(options || NAV_DEFAULT_OPTIONS);
    const cacheable = !navSearch.avoid && !navSearch.danger, key = navOptionsKey();
    if (cacheable && navCacheRead(from, to, key)) return this.pathLength;
    this.searches++;
    if (navAStar(from, to)) navReconstruct(from, to);
    if (cacheable) navCacheWrite(from, to, key);
    return this.pathLength;
  },

  // Queues a path search for slot id (0..63, a bot uses its actor id); served by the 'nav' sim system, at most
  // NAV_QUERIES_PER_TICK searches per tick (cache hits are free). A new request replaces the slot's pending one.
  request(id, from, to, options) {
    if (id < 0 || id >= NAV_SLOTS) return false;
    const given = options || NAV_DEFAULT_OPTIONS, slots = navSlots;
    slots.from[id] = from; slots.to[id] = to;
    slots.jump[id] = navOption(given.allowJumpHeight, this.limits.jumpUp);
    slots.drop[id] = navOption(given.maxDrop, this.limits.safeDrop);
    slots.crouch[id] = given.crouchOk === false ? 0 : 1;
    slots.avoid[id] = given.avoid || null; slots.danger[id] = given.danger || null;
    slots.status[id] = NAV_STATUS.QUEUED;
    if (!slots.inQueue[id]) navEnqueue(id);
    return true;
  },
  result(id) { return navSlots.status[id]; },              // NAV_STATUS
  cancel(id) { navSlots.status[id] = NAV_STATUS.NONE; },
  resultCost(id) { return navSlots.cost[id]; },
  resultNodeCount(id) { return navSlots.nodeCount[id]; },
  resultNode(id, index) { return navSlots.nodes[id * NAV_SLOT_PATH + index]; },
  resultPointCount(id) { return navSlots.pointCount[id]; },
  // Writes smoothed point index into out {x, y, z}; returns the link type of the move that starts there.
  resultPoint(id, index, out) {
    const base = (id * NAV_SLOT_PATH + index) * 3;
    Vec.set(out, navSlots.points[base], navSlots.points[base + 1], navSlots.points[base + 2]);
    return navSlots.pointTypes[id * NAV_SLOT_PATH + index];
  },

  serveRequests() {
    this.searchesThisTick = 0;
    while (navSlots.queueCount > 0 && this.searchesThisTick < NAV_QUERIES_PER_TICK) {
      const id = navDequeue();
      if (navSlots.status[id] !== NAV_STATUS.QUEUED) continue;
      navServe(id);
      if (!this.lastCacheHit) this.searchesThisTick++;
    }
    return this.searchesThisTick;
  },
  pendingRequests() { return navSlots.queueCount; },

  // String pulling: keeps a node only when the corridor from the last kept node to the one after it is not walkable
  // in a straight line (raster walk + chest-height line) or when a jump, drop, ladder, pad or teleport starts there.
  // Writes points (x, y, z) at outPoints[(offset + i) * 3] and move types at outTypes[offset + i]; returns the count.
  smoothPath(nodes, types, length, outPoints, outTypes, offset) {
    let count = 0, anchor = 0;
    while (length > 0) {
      const next = anchor < length - 1 ? navFurthestVisible(nodes, types, anchor, length) : -1;
      navWritePoint(outPoints, outTypes, offset + count, nodes[anchor], next < 0 ? NAV_LINK_NONE : navMergedType(types, anchor, next));
      count++;
      if (next < 0) break;
      anchor = next;
    }
    return count;
  },

  // True when b can be reached from a over any links (ignores jump/drop options).
  reachable(a, b) {
    if (!navValidNode(a) || !navValidNode(b)) return false;
    if (this.component[a] === this.component[b]) return true;
    return navBreadthFirst(a, b);
  },

  // MAP-001 / MAP-023 check: every spawn reaches every other spawn and every item and objective, both ways.
  validate(map) {
    const problems = [], spawnNodes = (map.spawns || []).map((spawn) => this.nearestNode(spawn.x, spawn.y, spawn.z));
    spawnNodes.forEach((node, index) => { if (node < 0) problems.push('spawn ' + index + ' has no nav node'); });
    const targets = (map.items || []).map((item) => ['item ' + item.item, item]).concat((map.objectives || []).map((goal) => ['objective ' + goal.id, goal]));
    spawnNodes.forEach((node, index) => {
      if (node >= 0 && node !== spawnNodes[0] && !this.reachable(spawnNodes[0], node)) problems.push('spawn ' + index + ' unreachable from spawn 0');
      if (node >= 0 && spawnNodes[0] >= 0 && !this.reachable(node, spawnNodes[0])) problems.push('spawn ' + index + ' cannot reach spawn 0');
    });
    targets.forEach(([label, spot]) => {
      const node = this.nearestNode(spot.x, spot.y, spot.z);
      if (node < 0 || !spawnNodes.length || !this.reachable(spawnNodes[0], node) || !this.reachable(node, spawnNodes[0])) problems.push(label + ' unreachable');
    });
    return problems;
  },
});

Sim.addSystem('nav', 15, () => Nav.serveRequests());   // after bot brains (10): requests made this tick are answered this tick

const navValidNode = (node) => node >= 0 && node < Nav.nodeCount;
const navOption = (value, fallback) => (value === undefined ? fallback : value);
const navQuantize = (value, steps) => (value === Infinity ? value : Math.floor(value * steps + 1e-6) / steps);

function navReadOptions(options) {
  const s = navSearch;
  // Quantized to the cache key resolution so a cached path always obeys the limits it was found with.
  s.allowJumpHeight = navQuantize(navOption(options.allowJumpHeight, Nav.limits.jumpUp), 100);
  s.maxDrop = navQuantize(navOption(options.maxDrop, Nav.limits.safeDrop), 10);
  s.crouchOk = options.crouchOk !== false;
  s.avoid = typeof options.avoid === 'function' ? options.avoid : null;
  s.danger = options.danger || null;
}

function navOptionsKey() {
  const s = navSearch;
  const jump = Math.min(NAV_KEY_JUMP_MAX, Math.round(s.allowJumpHeight * 100)), drop = Math.min(NAV_KEY_DROP_MAX, Math.round(s.maxDrop * 10));
  return jump | (drop << 10) | (s.crouchOk ? 1 << 20 : 0);
}

// ---- A* ----
function navAStar(from, to) {
  const s = navSearch;
  s.generation++;
  s.heapSize = 0;
  navPrepareHeuristic(to);
  s.seen[from] = s.generation; s.cost[from] = 0; s.parentLink[from] = -1;
  navHeapPush(from, navHeuristic(from));
  while (s.heapSize > 0) {
    const node = navHeapPop();
    if (s.closed[node] === s.generation) continue;
    if (node === to) return true;
    s.closed[node] = s.generation;
    navExpand(node);
  }
  return false;
}

function navExpand(node) {
  const s = navSearch, base = s.cost[node];
  for (let link = Nav.linkStart[node]; link < Nav.linkStart[node + 1]; link++) {
    const next = Nav.linkTarget[link];
    if (s.closed[next] === s.generation || !navLinkAllowed(link)) continue;
    const cost = base + Nav.linkCost[link] + navEnterCost(next);
    if (!(cost < Infinity) || (s.seen[next] === s.generation && cost >= s.cost[next])) continue;
    s.seen[next] = s.generation; s.cost[next] = cost; s.parentLink[next] = link;
    navHeapPush(next, cost + navHeuristic(next));
  }
}

function navLinkAllowed(link) {
  const s = navSearch, type = Nav.linkType[link];
  if (type === NAV_LINK.JUMP) return Nav.linkHeight[link] <= s.allowJumpHeight + NAV_HEIGHT_TOLERANCE;
  if (type === NAV_LINK.DROP) return Nav.linkHeight[link] <= s.maxDrop + NAV_HEIGHT_TOLERANCE;
  return type !== NAV_LINK.CROUCH || s.crouchOk;
}

function navEnterCost(node) {
  const s = navSearch;
  return (s.danger ? s.danger[node] : 0) + (s.avoid ? s.avoid(node) : 0);
}

// Admissible: straight-line time at the fastest link speed, or the same through any teleporter.
function navPrepareHeuristic(goal) {
  const s = navSearch;
  s.goalX = Nav.nodeX[goal]; s.goalY = Nav.nodeY[goal]; s.goalZ = Nav.nodeZ[goal];
  for (let t = 0; t < Nav.teleportCount; t++) s.teleportExitCost[t] = navDistanceToGoal(Nav.teleportExit[t]) / Nav.heuristicSpeed;
}

function navDistanceToGoal(node) {
  const s = navSearch;
  return Math.sqrt(distanceSquared3(Nav.nodeX[node], Nav.nodeY[node], Nav.nodeZ[node], s.goalX, s.goalY, s.goalZ));
}

function navHeuristic(node) {
  const s = navSearch, speed = Nav.heuristicSpeed, teleportSeconds = NAV_LINK_ROWS[NAV_LINK.TELEPORT].extraSeconds;
  let best = navDistanceToGoal(node) / speed;
  for (let t = 0; t < Nav.teleportCount; t++) {
    best = Math.min(best, navNodeDistance(node, Nav.teleportEntry[t]) / speed + teleportSeconds + s.teleportExitCost[t]);
  }
  return best;
}

// Binary min-heap; a node may be pushed again with a better score (stale entries are skipped when popped).
function navHeapPush(node, score) {
  const s = navSearch;
  let index = s.heapSize++;
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (s.heapScore[parent] <= score) break;
    s.heapNode[index] = s.heapNode[parent]; s.heapScore[index] = s.heapScore[parent];
    index = parent;
  }
  s.heapNode[index] = node; s.heapScore[index] = score;
}

function navHeapPop() {
  const s = navSearch, top = s.heapNode[0];
  s.heapSize--;
  const lastNode = s.heapNode[s.heapSize], lastScore = s.heapScore[s.heapSize];
  let index = 0, child = 1;
  while (child < s.heapSize) {
    if (child + 1 < s.heapSize && s.heapScore[child + 1] < s.heapScore[child]) child++;
    if (s.heapScore[child] >= lastScore) break;
    s.heapNode[index] = s.heapNode[child]; s.heapScore[index] = s.heapScore[child];
    index = child; child = index * 2 + 1;
  }
  s.heapNode[index] = lastNode; s.heapScore[index] = lastScore;
  return top;
}

function navReconstruct(from, to) {
  const s = navSearch;
  let length = 1;
  for (let node = to; node !== from; node = Nav.linkFrom[s.parentLink[node]]) length++;
  let index = length - 1, node = to;
  s.path[index] = to; s.pathType[index] = NAV_LINK_NONE;
  while (node !== from) {
    const link = s.parentLink[node];
    node = Nav.linkFrom[link];
    index--;
    s.path[index] = node; s.pathType[index] = Nav.linkType[link];
  }
  Nav.pathLength = length; Nav.pathCost = s.cost[to];
}

// ---- Path cache: direct-mapped on (from, to, option key); also remembers "no path" ----
function navCacheSlot(from, to, key) {
  return (Math.imul(from, 73856093) ^ Math.imul(to, 19349663) ^ Math.imul(key, 83492791)) & (NAV_CACHE_SIZE - 1);
}

function navCacheRead(from, to, key) {
  const c = navCache, slot = navCacheSlot(from, to, key);
  if (c.from[slot] !== from || c.to[slot] !== to || c.key[slot] !== key) { Nav.cacheMisses++; return false; }
  const length = c.length[slot], base = slot * NAV_CACHE_PATH;
  for (let i = 0; i < length; i++) { navSearch.path[i] = c.nodes[base + i]; navSearch.pathType[i] = c.types[base + i]; }
  Nav.pathLength = length; Nav.pathCost = length ? c.cost[slot] : Infinity;
  Nav.cacheHits++; Nav.lastCacheHit = true;
  return true;
}

function navCacheWrite(from, to, key) {
  const c = navCache, slot = navCacheSlot(from, to, key), length = Nav.pathLength, base = slot * NAV_CACHE_PATH;
  if (length > NAV_CACHE_PATH) return;
  c.from[slot] = from; c.to[slot] = to; c.key[slot] = key; c.length[slot] = length; c.cost[slot] = Nav.pathCost;
  for (let i = 0; i < length; i++) { c.nodes[base + i] = navSearch.path[i]; c.types[base + i] = navSearch.pathType[i]; }
}

// ---- Request queue (ring of slot ids, each slot at most once) ----
function navEnqueue(id) {
  const slots = navSlots;
  slots.queue[(slots.queueHead + slots.queueCount) % NAV_SLOTS] = id;
  slots.queueCount++;
  slots.inQueue[id] = 1;
}

function navDequeue() {
  const slots = navSlots, id = slots.queue[slots.queueHead];
  slots.queueHead = (slots.queueHead + 1) % NAV_SLOTS;
  slots.queueCount--;
  slots.inQueue[id] = 0;
  return id;
}

function navServe(id) {
  const slots = navSlots, options = navSlotOptions;
  options.allowJumpHeight = slots.jump[id]; options.maxDrop = slots.drop[id]; options.crouchOk = slots.crouch[id] === 1;
  options.avoid = slots.avoid[id]; options.danger = slots.danger[id];
  const length = Nav.findPath(slots.from[id], slots.to[id], options);
  slots.nodeCount[id] = 0; slots.pointCount[id] = 0; slots.cost[id] = Nav.pathCost;
  if (length === 0 || length > NAV_SLOT_PATH) { slots.status[id] = NAV_STATUS.FAILED; return; }
  for (let i = 0; i < length; i++) slots.nodes[id * NAV_SLOT_PATH + i] = navSearch.path[i];
  slots.nodeCount[id] = length;
  slots.pointCount[id] = Nav.smoothPath(navSearch.path, navSearch.pathType, length, slots.points, slots.pointTypes, id * NAV_SLOT_PATH);
  slots.status[id] = NAV_STATUS.DONE;
}

// ---- Smoothing helpers ----
function navFurthestVisible(nodes, types, anchor, length) {
  let best = anchor + 1;
  const last = Math.min(length - 1, anchor + NAV_SMOOTH_LOOKAHEAD);
  if (!NAV_SMOOTHABLE[types[anchor]]) return best;
  for (let candidate = anchor + 2; candidate <= last; candidate++) {
    if (!NAV_SMOOTHABLE[types[candidate - 1]] || !navCorridorClear(nodes[anchor], nodes[candidate])) break;
    best = candidate;
  }
  return best;
}

function navCorridorClear(a, b) {
  const scan = navScan(Nav.nodeSample[a], Nav.nodeX[b], Nav.nodeZ[b], Nav.nodeSample[b]), flags = scan | Nav.nodeFlags[b];
  if (scan < 0 || (scan & NAV_NODE.TRIGGER)) return false;
  return !(flags & NAV_NODE.NARROW) || navLinkLineClear(a, b, flags & NAV_NODE.CROUCH ? NAV_CROUCH_CHEST : NAV_CHEST);
}

// Type of the straight move that replaces links first..last-1: crouch or swim when any of them is, else that link's type.
function navMergedType(types, first, last) {
  let merged = types[first];
  for (let i = first + 1; i < last; i++) if (types[i] === NAV_LINK.CROUCH || types[i] === NAV_LINK.SWIM) merged = types[i];
  return merged;
}

function navWritePoint(outPoints, outTypes, index, node, type) {
  outPoints[index * 3] = Nav.nodeX[node]; outPoints[index * 3 + 1] = Nav.nodeY[node]; outPoints[index * 3 + 2] = Nav.nodeZ[node];
  outTypes[index] = type;
}

// Breadth-first search over all links, reusing the A* buffers (heapNode as the queue, seen as the visited marks).
function navBreadthFirst(from, to) {
  const s = navSearch;
  s.generation++;
  let head = 0, tail = 0;
  s.heapNode[tail++] = from; s.seen[from] = s.generation;
  while (head < tail) {
    const node = s.heapNode[head++];
    if (node === to) return true;
    tail = navQueueTargets(node, tail);
  }
  return false;
}

// Appends the unvisited link targets of a node to the breadth-first queue; returns the new queue end.
function navQueueTargets(node, tail) {
  const s = navSearch;
  for (let link = Nav.linkStart[node]; link < Nav.linkStart[node + 1]; link++) {
    const next = Nav.linkTarget[link];
    if (s.seen[next] === s.generation) continue;
    s.seen[next] = s.generation;
    s.heapNode[tail++] = next;
  }
  return tail;
}
