// Self-tests for S09 navigation on hand-built maps: doorway, ramp, ledge, tower with ladder, jump pad, teleporters,
// pool, crawl tunnel, pillar field (A* versus Dijkstra) and a 100 x 100 m benchmark map (ARC-034).

const NAV_TEST_BUILD_BUDGET_MS = 300;   // BOT-010 budget; headless desktop must stay well inside it
const navTestBox = (min, max) => ({ shape: 'box', min, max });
const navTestFloor = (minX, minZ, maxX, maxZ, top) => navTestBox([minX, top - 1, minZ], [maxX, top, maxZ]);
const navTestSpawn = (x, y, z) => ({ x, y, z, yaw: 0, team: -1, modes: [] });
const navTestNode = (x, y, z) => Nav.nearestNode(x, y, z);

function navTestLoad(brushes, extra) {
  const map = Object.assign({ id: 'navtest', brushes, spawns: [], items: [], objectives: [], triggers: [] }, extra || {});
  World.load(map);
  return map;
}

// Two 20 x 20 m rooms split by a 3 m wall along x at z = 0, optionally with a 1.6 m doorway at x 1.2..2.8.
function navTestRooms(withDoor) {
  const wall = withDoor
    ? [navTestBox([-10, 0, -0.15], [1.2, 3, 0.15]), navTestBox([2.8, 0, -0.15], [10, 3, 0.15])]
    : [navTestBox([-10, 0, -0.15], [10, 3, 0.15])];
  return navTestLoad([navTestFloor(-10, -10, 10, 10, 0)].concat(wall), { spawns: [navTestSpawn(-5, 0, -6), navTestSpawn(5, 0, 6), navTestSpawn(-6, 0, 7)] });
}

// The type of the link a -> b, or -1.
function navTestLinkType(a, b) {
  for (let link = Nav.linkStart[a]; link < Nav.linkStart[a + 1]; link++) if (Nav.linkTarget[link] === b) return Nav.linkType[link];
  return -1;
}

function navTestPathTypes(from, to, options) {
  const length = Nav.findPath(from, to, options), types = [];
  for (let i = 0; i < length - 1; i++) types.push(Nav.pathTypes[i]);
  return types;
}

// World.lineClear in both directions: a real wall blocks both; rayVersusBrush (S08) falsely reports a hit at distance 0
// for a ray that starts above a ramp slope and moves away from it, which only one direction can trigger.
const navTestLineClear = (ax, ay, az, bx, by, bz) => World.lineClear(ax, ay, az, bx, by, bz) || World.lineClear(bx, by, bz, ax, ay, az);

// Every walk-like link (and every smoothed straight move) must have a clear chest-height line.
function navTestLinksClear() {
  let bad = 0;
  for (let node = 0; node < Nav.nodeCount; node++) {
    for (let link = Nav.linkStart[node]; link < Nav.linkStart[node + 1]; link++) {
      const target = Nav.linkTarget[link], type = Nav.linkType[link];
      const height = type === NAV_LINK.CROUCH ? NAV_CROUCH_CHEST : NAV_CHEST;
      if (NAV_SMOOTHABLE[type] && !navTestLineClear(Nav.nodeX[node], Nav.nodeY[node] + height, Nav.nodeZ[node], Nav.nodeX[target], Nav.nodeY[target] + height, Nav.nodeZ[target])) bad++;
    }
  }
  return bad;
}

function navTestSmoothedClear(id) {
  const a = Vec.make(), b = Vec.make();
  for (let i = 0; i + 1 < Nav.resultPointCount(id); i++) {
    const type = Nav.resultPoint(id, i, a);
    Nav.resultPoint(id, i + 1, b);
    const height = type === NAV_LINK.CROUCH ? NAV_CROUCH_CHEST : NAV_CHEST;
    if (NAV_SMOOTHABLE[type] && !navTestLineClear(a.x, a.y + height, a.z, b.x, b.y + height, b.z)) return false;
  }
  return true;
}

function navTestServeAll() {
  for (let tick = 0; tick < 64 && Nav.pendingRequests() > 0; tick++) Nav.serveRequests();
}

Test.add('nav', (check) => {
  navTestRooms(true);
  const a = navTestNode(-5, 0, -6), b = navTestNode(5, 0, 6);
  check('rooms: nodes on both sides', Nav.nodeCount > 100 && a >= 0 && b >= 0 && Nav.nodeZ[a] < 0 && Nav.nodeZ[b] > 0, Nav.nodeCount);
  check('rooms: node spacing about 1.5 m (one per cell and surface)', Nav.nodeCount < 400, Nav.nodeCount);
  check('rooms: no node inside the wall or within the capsule radius of it', navTestNodesClearOfWall());
  check('rooms: doorway connects the rooms (one component)', Nav.componentCount === 1 && Nav.reachable(a, b), Nav.componentCount);
  check('rooms: every walk link has a clear chest line', navTestLinksClear() === 0, navTestLinksClear());
  const length = Nav.findPath(a, b);
  check('rooms: path found through the doorway', length > 2 && navTestPathCrossesDoor(length), length);
  Nav.request(0, a, b);
  navTestServeAll();
  check('rooms: smoothed path never crosses the wall', Nav.result(0) === NAV_STATUS.DONE && navTestSmoothedClear(0));
  check('rooms: smoothing keeps fewer points than nodes', Nav.resultPointCount(0) >= 2 && Nav.resultPointCount(0) < Nav.resultNodeCount(0), Nav.resultPointCount(0) + ' / ' + Nav.resultNodeCount(0));
  check('rooms: validate passes on a connected map', Nav.validate(World.map).length === 0, Nav.validate(World.map).join('; '));
});

function navTestNodesClearOfWall() {
  for (let node = 0; node < Nav.nodeCount; node++) {
    const x = Nav.nodeX[node], z = Nav.nodeZ[node];
    const inDoor = x - NAV_RADIUS >= 1.2 && x + NAV_RADIUS <= 2.8;
    if (!inDoor && Math.abs(z) < 0.15 + NAV_RADIUS) return false;
  }
  return true;
}

function navTestPathCrossesDoor(length) {
  for (let i = 0; i + 1 < length; i++) {
    const from = Nav.pathNodes[i], to = Nav.pathNodes[i + 1];
    if (Math.sign(Nav.nodeZ[from]) === Math.sign(Nav.nodeZ[to])) continue;
    const t = Nav.nodeZ[from] / (Nav.nodeZ[from] - Nav.nodeZ[to]), x = Nav.nodeX[from] + (Nav.nodeX[to] - Nav.nodeX[from]) * t;
    if (x < 1.2 + NAV_RADIUS - 0.05 || x > 2.8 - NAV_RADIUS + 0.05) return false;
  }
  return true;
}

Test.add('nav', (check) => {
  navTestRooms(false);
  const a = navTestNode(-5, 0, -6), b = navTestNode(5, 0, 6);
  let crossing = 0;
  for (let link = 0; link < Nav.linkCount; link++) if (Math.sign(Nav.nodeZ[Nav.linkFrom[link]]) !== Math.sign(Nav.nodeZ[Nav.linkTarget[link]])) crossing++;
  check('wall: no link crosses a solid wall', crossing === 0, crossing);
  check('wall: the two rooms are separate components', Nav.componentCount === 2 && !Nav.reachable(a, b));
  check('wall: findPath fails', Nav.findPath(a, b) === 0 && Nav.pathCost === Infinity);
  check('wall: validate reports the unreachable spawn', Nav.validate(World.map).length > 0);
});

Test.add('nav', (check) => {
  // Ramp rising +x from y 0 to 2 over 6 m (18 deg), then a platform at 2 m.
  navTestLoad([navTestFloor(-10, -10, 10, 10, 0), { shape: 'ramp', min: [0, 0, -2], max: [6, 2, 2], dir: '+x' }, navTestBox([6, 0, -2], [10, 2, 2])]);
  const floor = navTestNode(-5, 0, 0), top = navTestNode(8, 2, 0);
  const onRamp = Array.from(Nav.nodeY).filter((y) => y > 0.4 && y < 1.6).length;
  check('ramp: nodes on the slope', onRamp >= 4, onRamp);
  check('ramp: platform node at 2 m', Test.near(Nav.nodeY[top], 2, 0.01), Nav.nodeY[top]);
  const up = navTestPathTypes(floor, top, { allowJumpHeight: 0 }), down = navTestPathTypes(top, floor, { allowJumpHeight: 0, maxDrop: 0 });
  check('ramp: walk up without jumping', up.length > 0 && up.every((type) => type === NAV_LINK.WALK), up.join(','));
  check('ramp: walk down without dropping', down.length > 0 && down.every((type) => type === NAV_LINK.WALK), down.join(','));
});

Test.add('nav', (check) => {
  // A 1.2 m ledge: needs a jump up, drops down.
  navTestLoad([navTestFloor(-10, -10, 10, 10, 0), navTestBox([2, 0, -3], [8, 1.2, 3])]);
  const floor = navTestNode(-4, 0, 0), ledge = navTestNode(5, 1.2, 0);
  let jumps = 0, wrongHeight = 0;
  for (let link = 0; link < Nav.linkCount; link++) {
    if (Nav.linkType[link] !== NAV_LINK.JUMP || Nav.nodeY[Nav.linkTarget[link]] < 1) continue;
    jumps++;
    if (!Test.near(Nav.linkHeight[link], 1.2 + NAV_JUMP_MARGIN, 0.01)) wrongHeight++;
  }
  check('ledge: jump-up links carry the required height (ledge + margin)', jumps > 0 && wrongHeight === 0, jumps + ' jumps, ' + wrongHeight + ' wrong');
  check('ledge: weaker jump (1.0 m) finds no way up', Nav.findPath(floor, ledge, { allowJumpHeight: 1.0 }) === 0);
  const up = navTestPathTypes(floor, ledge, { allowJumpHeight: 1.5 });
  check('ledge: 1.5 m jump goes up with one jump', up.filter((type) => type === NAV_LINK.JUMP).length === 1, up.join(','));
  const down = navTestPathTypes(ledge, floor, { allowJumpHeight: 0 });
  check('ledge: way down is a 1.2 m drop', down.includes(NAV_LINK.DROP) && !down.includes(NAV_LINK.JUMP), down.join(','));
  check('ledge: drop limit respected', Nav.findPath(ledge, floor, { allowJumpHeight: 0, maxDrop: 1 }) === 0);
  check('ledge: no node hangs over the edge', Array.from(Nav.nodeY).every((y, node) => y < 1 || (Nav.nodeX[node] >= 2 + NAV_EDGE_MARGIN && Nav.nodeX[node] <= 8 - NAV_EDGE_MARGIN)));
});

// A 5 m tower; the ladder volume sits against its -x face.
function navTestTower(withLadder) {
  const ladder = { kind: 'ladder', min: [1.4, 0, -0.5], max: [2, 6, 0.5] };
  return navTestLoad([navTestFloor(-10, -10, 10, 10, 0), navTestBox([2, 0, -2], [6, 5, 2])], { triggers: withLadder ? [ladder] : [] });
}

Test.add('nav', (check) => {
  navTestTower(false);
  let floor = navTestNode(-4, 0, 0), top = navTestNode(4, 5, 0);
  check('tower: top reachable from the floor only by dropping', Nav.reachable(top, floor) && !Nav.reachable(floor, top));
  check('tower: 5 m drop allowed by default, refused with maxDrop 4', Nav.findPath(top, floor) > 0 && Nav.findPath(top, floor, { maxDrop: 4 }) === 0);
  navTestTower(true);
  floor = navTestNode(-4, 0, 0); top = navTestNode(4, 5, 0);
  const up = navTestPathTypes(floor, top);
  check('ladder: climbs the tower', up.includes(NAV_LINK.LADDER), up.join(','));
  check('ladder: drop is faster than climbing down', navTestPathTypes(top, floor).includes(NAV_LINK.DROP));
  check('ladder: without big drops it climbs down', navTestPathTypes(top, floor, { maxDrop: 4 }).includes(NAV_LINK.LADDER));
  check('ladder: tower and floor in one component', Nav.component[floor] === Nav.component[top]);
});

Test.add('nav', (check) => {
  // Jump pad at the origin throws actors onto an 8 m platform (vy 20, flight 1.45 s under gravity 20, lands near x 13).
  const pad = { kind: 'jumppad', min: [-0.75, 0, -0.75], max: [0.75, 0.5, 0.75], launch: [8.98, 20, 0] };
  navTestLoad([navTestFloor(-10, -10, 20, 10, 0), navTestBox([10, 0, -3], [16, 8, 3])], { triggers: [pad] });
  const floor = navTestNode(-5, 0, 0), high = navTestNode(13, 8, 0), padNode = navTestNode(0, 0, 0);
  let padLinks = 0, landedOnTop = true;
  for (let link = 0; link < Nav.linkCount; link++) {
    if (Nav.linkType[link] !== NAV_LINK.JUMPPAD) continue;
    padLinks++;
    if (!Test.near(Nav.nodeY[Nav.linkTarget[link]], 8, 0.01) || Math.abs(Nav.nodeX[Nav.linkTarget[link]] - 13) > NAV_LANDING_SEARCH) landedOnTop = false;
  }
  check('jump pad: one link from the pad to the landing on the platform', padLinks === 1 && landedOnTop, padLinks);
  check('jump pad: pad centre node sits inside the pad', (Nav.nodeFlags[padNode] & NAV_NODE.TRIGGER) && Math.hypot(Nav.nodeX[padNode], Nav.nodeZ[padNode]) < 0.5);
  check('jump pad: nothing walks out of the pad node', Nav.linkStart[padNode + 1] - Nav.linkStart[padNode] === 1);
  check('jump pad: path up uses the pad', navTestPathTypes(floor, high).includes(NAV_LINK.JUMPPAD));
  check('jump pad: 8 m drop needs maxDrop >= 8', Nav.findPath(high, floor) === 0 && Nav.findPath(high, floor, { maxDrop: 10 }) > 0);
  check('jump pad: walking past the pad never cuts across it', navTestNoWalkThroughTrigger());
});

function navTestNoWalkThroughTrigger() {
  for (let link = 0; link < Nav.linkCount; link++) {
    const from = Nav.linkFrom[link];
    if ((Nav.nodeFlags[from] & NAV_NODE.TRIGGER) && NAV_SMOOTHABLE[Nav.linkType[link]]) return false;
  }
  return true;
}

// Two islands 20 m apart joined only by a pair of teleporters.
function navTestIslands() {
  const teleporter = (x, exitX) => ({ kind: 'teleporter', min: [x - 0.75, 0, -3.75], max: [x + 0.75, 2, -2.25], exit: [exitX, 0, 3] });
  return navTestLoad([navTestFloor(-20, -8, -10, 8, 0), navTestFloor(10, -8, 20, 8, 0)], {
    triggers: [teleporter(-15, 15), teleporter(15, -15)], spawns: [navTestSpawn(-17, 0, 5), navTestSpawn(17, 0, 5)],
  });
}

Test.add('nav', (check) => {
  navTestIslands();
  const west = navTestNode(-17, 0, 5), east = navTestNode(17, 0, 5);
  const types = navTestPathTypes(west, east);
  check('teleporter: two teleport links', Nav.teleportCount === 2, Nav.teleportCount);
  check('teleporter: islands form one component', Nav.componentCount === 1 && Nav.reachable(west, east) && Nav.reachable(east, west), Nav.componentCount);
  check('teleporter: path uses the teleporter', types.includes(NAV_LINK.TELEPORT), types.join(','));
  check('teleporter: A* cost equals Dijkstra through the teleporter', Test.near(Nav.pathCost, navTestDijkstra(west, east, null), 1e-3), Nav.pathCost);
  check('teleporter: validate passes', Nav.validate(World.map).length === 0, Nav.validate(World.map).join('; '));
});

Test.add('nav', (check) => {
  // Pool: 8 x 8 m pit 3 m deep, water surface 0.2 m under the banks.
  navTestLoad([
    navTestFloor(-12, -12, -4, 12, 0), navTestFloor(4, -12, 12, 12, 0), navTestFloor(-4, 4, 4, 12, 0), navTestFloor(-4, -12, 4, -4, 0),
    navTestFloor(-4, -4, 4, 4, -3),
  ], { triggers: [{ kind: 'water', min: [-4, -3, -4], max: [4, -0.2, 4] }] });
  const surface = -0.2 - NAV_SWIM_DEPTH, centre = navTestNode(0, surface, 0), bank = navTestNode(-8, 0, 0);
  check('water: swim nodes at swimming depth', centre >= 0 && Test.near(Nav.nodeY[centre], surface, 0.01) && (Nav.nodeFlags[centre] & NAV_NODE.WATER), centre >= 0 && Nav.nodeY[centre]);
  const into = navTestPathTypes(bank, centre), out = navTestPathTypes(centre, bank);
  check('water: path into the pool ends swimming', into.length > 0 && into[into.length - 1] === NAV_LINK.SWIM, into.join(','));
  check('water: swimmer climbs out without a jump', out.length > 0 && !out.includes(NAV_LINK.JUMP), out.join(','));
  const bottom = navTestNode(0, -3, 0);
  check('water: pool floor nodes are wet', Test.near(Nav.nodeY[bottom], -3, 0.01) && (Nav.nodeFlags[bottom] & NAV_NODE.WATER), Nav.nodeY[bottom]);
});

Test.add('nav', (check) => {
  // Crawl tunnel 2 m wide and 1.4 m high through a 2 m thick wall.
  navTestLoad([navTestFloor(-10, -10, 10, 10, 0), navTestBox([-10, 0, -1], [-1, 3, 1]), navTestBox([1, 0, -1], [10, 3, 1]), navTestBox([-1, 1.4, -1], [1, 3, 1])]);
  const south = navTestNode(0, 0, -5), north = navTestNode(0, 0, 5);
  const types = navTestPathTypes(south, north);
  check('crouch: tunnel nodes are crouch-only', Array.from(Nav.nodeZ).some((z, node) => Math.abs(z) < 1 && (Nav.nodeFlags[node] & NAV_NODE.CROUCH)));
  check('crouch: path through the tunnel uses crouch links', types.includes(NAV_LINK.CROUCH), types.join(','));
  check('crouch: crouchOk false finds no way', Nav.findPath(south, north, { crouchOk: false }) === 0);
});

// Brute-force Dijkstra (O(n^2), no heap) with the same link filters as the default options.
function navTestDijkstra(from, to, danger) {
  const cost = new Float64Array(Nav.nodeCount).fill(Infinity), done = new Uint8Array(Nav.nodeCount);
  cost[from] = 0;
  for (let round = 0; round < Nav.nodeCount; round++) {
    let node = -1;
    for (let i = 0; i < Nav.nodeCount; i++) if (!done[i] && cost[i] < Infinity && (node < 0 || cost[i] < cost[node])) node = i;
    if (node < 0 || node === to) break;
    done[node] = 1;
    navTestRelax(node, cost, danger);
  }
  return cost[to];
}

function navTestRelax(node, cost, danger) {
  for (let link = Nav.linkStart[node]; link < Nav.linkStart[node + 1]; link++) {
    const type = Nav.linkType[link], target = Nav.linkTarget[link];
    if (type === NAV_LINK.DROP && Nav.linkHeight[link] > Nav.limits.safeDrop) continue;
    const next = cost[node] + Nav.linkCost[link] + (danger ? danger[target] : 0);
    if (next < cost[target]) cost[target] = next;
  }
}

// Pillar field with crates and a ledge: many equal-cost alternatives, jumps and drops.
function navTestPillars() {
  const random = makeRandom(5), brushes = [navTestFloor(-12, -12, 12, 12, 0), navTestBox([4, 0, 4], [10, 1.2, 10])];
  for (let i = 0; i < 30; i++) {
    const x = random.int(-10, 9), z = random.int(-10, 9), tall = random.chance(0.6);
    brushes.push(navTestBox([x, 0, z], [x + 1, tall ? 3 : 1, z + 1]));
  }
  return navTestLoad(brushes);
}

Test.add('nav', (check) => {
  navTestPillars();
  const random = makeRandom(11), danger = new Float32Array(Nav.nodeCount);
  for (let node = 0; node < Nav.nodeCount; node++) danger[node] = random.chance(0.2) ? random.range(0, 2) : 0;
  let worst = 0, mismatches = 0, compared = 0;
  for (let pair = 0; pair < 40; pair++) {
    const from = random.int(0, Nav.nodeCount - 1), to = random.int(0, Nav.nodeCount - 1), useDanger = pair % 2 === 1;
    const expected = navTestDijkstra(from, to, useDanger ? danger : null);
    Nav.findPath(from, to, useDanger ? { danger } : undefined);
    if (expected === Infinity && Nav.pathCost === Infinity) continue;
    compared++;
    const error = Math.abs(Nav.pathCost - expected) / Math.max(1, expected);
    worst = Math.max(worst, error);
    if (error > 1e-4) mismatches++;
  }
  check('A*: optimal versus brute-force Dijkstra (with and without danger weights)', compared >= 30 && mismatches === 0, compared + ' compared, worst ' + worst);
  check('A*: path cost is the sum of its links', navTestCostMatches());
  check('A*: avoid() returning Infinity forbids nodes', navTestAvoidWorks());
  check('pillars: every walk link has a clear chest line', navTestLinksClear() === 0, navTestLinksClear());
});

function navTestCostMatches() {
  const from = 0, to = Nav.nodeCount - 1, length = Nav.findPath(from, to);
  let sum = 0;
  for (let i = 0; i + 1 < length; i++) sum += Nav.linkCost[navTestLinkIndex(Nav.pathNodes[i], Nav.pathNodes[i + 1], Nav.pathTypes[i])];
  return length > 1 && Test.near(sum, Nav.pathCost, 1e-3);
}

function navTestLinkIndex(a, b, type) {
  let best = -1;
  for (let link = Nav.linkStart[a]; link < Nav.linkStart[a + 1]; link++) {
    if (Nav.linkTarget[link] === b && Nav.linkType[link] === type && (best < 0 || Nav.linkCost[link] < Nav.linkCost[best])) best = link;
  }
  return best;
}

function navTestAvoidWorks() {
  const from = 0, to = Nav.nodeCount - 1, length = Nav.findPath(from, to);
  if (length < 3) return false;
  const banned = Nav.pathNodes[1];
  const detour = Nav.findPath(from, to, { avoid: (node) => (node === banned ? Infinity : 0) });
  for (let i = 0; i < detour; i++) if (Nav.pathNodes[i] === banned) return false;
  return true;
}

Test.add('nav', (check) => {
  navTestPillars();
  const from = 0, to = Nav.nodeCount - 1;
  Nav.findPath(from, to);
  const missesBefore = Nav.cacheMisses;
  const length = Nav.findPath(from, to);
  check('cache: second identical query is a hit', Nav.lastCacheHit && Nav.cacheMisses === missesBefore && length > 0);
  Nav.findPath(from, to, { allowJumpHeight: 0.5 });
  check('cache: other options are a different entry', !Nav.lastCacheHit);
  Nav.findPath(from, to, { danger: new Float32Array(Nav.nodeCount) });
  check('cache: danger-weighted queries bypass the cache', !Nav.lastCacheHit);
  const version = Nav.version;
  navTestPillars();
  Nav.findPath(from, to);
  check('cache: rebuilding the graph invalidates it', Nav.version === version + 1 && !Nav.lastCacheHit);
});

Test.add('nav', (check) => {
  navTestPillars();
  for (let id = 0; id < 10; id++) Nav.request(id, id, Nav.nodeCount - 1 - id * 3);
  Nav.request(3, 3, Nav.nodeCount - 10);   // re-request while queued: replaces, not queued twice
  check('budget: ten requests queued', Nav.pendingRequests() === 10, Nav.pendingRequests());
  Sim.step();
  const done = () => [...Array(10).keys()].filter((id) => Nav.result(id) === NAV_STATUS.DONE || Nav.result(id) === NAV_STATUS.FAILED).length;
  check('budget: one tick serves at most 4 searches (BOT-091)', Nav.searchesThisTick === NAV_QUERIES_PER_TICK && done() === 4, done());
  Sim.step(); Sim.step();
  check('budget: the rest are served on the next ticks', done() === 10 && Nav.pendingRequests() === 0, done());
  check('budget: replaced request answered with the new goal', Nav.resultNode(3, Nav.resultNodeCount(3) - 1) === Nav.nodeCount - 10);
  Nav.request(20, 0, 1);
  Nav.cancel(20);
  Nav.serveRequests();
  check('budget: cancelled request is skipped', Nav.result(20) === NAV_STATUS.NONE);
  check('budget: bad slot id refused', !Nav.request(NAV_SLOTS, 0, 1) && !Nav.request(-1, 0, 1));
  Nav.request(21, 0, -5);
  navTestServeAll();
  check('budget: invalid node fails the request', Nav.result(21) === NAV_STATUS.FAILED);
});

Test.add('nav', (check) => {
  navTestPillars();
  const buffers = [navSearch.cost, navSearch.heapNode, navSearch.heapScore, navSearch.path, navSearch.seen, navCache.nodes];
  const random = makeRandom(3);
  for (let i = 0; i < 300; i++) Nav.findPath(random.int(0, Nav.nodeCount - 1), random.int(0, Nav.nodeCount - 1), i % 3 ? undefined : { allowJumpHeight: random.range(0, 2) });
  const same = [navSearch.cost, navSearch.heapNode, navSearch.heapScore, navSearch.path, navSearch.seen, navCache.nodes].every((buffer, index) => buffer === buffers[index]);
  check('allocation: 300 queries reuse the same typed buffers (no growth)', same && navSearch.heapNode.length === Nav.linkCount + Nav.nodeCount);
  check('allocation: heap never exceeded its capacity', navSearch.heapSize <= navSearch.heapNode.length);
});

Test.add('nav', (check) => {
  navTestRooms(true);
  const near = navTestNode(-3, 0, -0.7);
  check('nearestNode: picks a node on the same side of the wall', near >= 0 && Nav.nodeZ[near] < 0, near >= 0 && Nav.nodeZ[near]);
  check('nearestNode: from mid-air picks the floor below', Nav.nodeY[navTestNode(-5, 2, -5)] === 0);
  check('nearestNode: empty graph returns -1', (() => { const keep = Nav.nodeCount; Nav.nodeCount = 0; const none = Nav.nearestNode(0, 0, 0); Nav.nodeCount = keep; return none === -1; })());
  const rng = makeRandom(4), start = navTestNode(-5, 0, -6);
  let sameComponent = true;
  for (let i = 0; i < 50; i++) if (Nav.component[Nav.randomReachableNode(start, rng)] !== Nav.component[start]) sameComponent = false;
  check('randomReachableNode: stays in the reachable component', sameComponent);
  check('randomReachableNode: bad start gives -1', Nav.randomReachableNode(-1, rng) === -1);
  const out = new Float32Array(NAV_DEBUG_STRIDE * 4000), lines = Nav.debugLines(out);
  check('debugLines: writes link segments', lines > 100 && out[6] >= 0 && out[6] < NAV_LINK_ROWS.length, lines);
  check('debugLines: respects the buffer size', Nav.debugLines(new Float32Array(NAV_DEBUG_STRIDE * 5)) === 5);
});

Test.add('nav', (check) => {
  // Cover along both faces of the room wall; a crate gives low cover.
  navTestLoad([navTestFloor(-10, -10, 10, 10, 0), navTestBox([-10, 0, -0.15], [6, 3, 0.15]), navTestBox([-6, 0, -6], [-5, 1, -5])]);
  check('cover: points found along the wall', Nav.coverCount > 10, Nav.coverCount);
  let lowCover = false;
  for (let cover = 0; cover < Nav.coverCount; cover++) if (Nav.coverLow[cover] && Math.abs(Nav.nodeX[Nav.coverNode[cover]] + 5.5) < 2) lowCover = true;
  check('cover: the crate gives crouch cover', lowCover);
  const cover = Nav.nearestCover(-3, 0, -3, -3, 1.6, 6);
  check('cover: hides from a threat across the wall', cover >= 0 && Nav.nodeZ[Nav.coverNode[cover]] < 0 && Nav.coverDirZ[cover] === 1, cover);
  check('cover: nothing hides from a threat standing next to us in the open', Nav.nearestCover(3, 0, -5, 3, 1.6, -7, 1.5) === -1);
});

// 100 x 100 m map: 5 x 5 rooms of 20 m with 2 m doorways, crates, and raised platforms with ramps (ARC-034 benchmark).
function navTestBigMap() {
  const random = makeRandom(9), brushes = [navTestFloor(-50, -50, 50, 50, 0)], spawns = [];
  for (let line = -30; line <= 30; line += 20) navTestWallLine(brushes, line);
  for (let i = 0; i < 60; i++) {
    const x = random.int(-48, 47), z = random.int(-48, 47);
    brushes.push(navTestBox([x, 0, z], [x + 1, 1, z + 1]));
  }
  for (let room = 0; room < 25; room++) {
    const centreX = -40 + (room % 5) * 20, centreZ = -40 + Math.floor(room / 5) * 20;
    spawns.push(navTestSpawn(centreX + 3, 0, centreZ + 3));
    if (room % 3 !== 0) continue;
    brushes.push(navTestBox([centreX - 6, 0, centreZ - 8], [centreX - 2, 2, centreZ - 4]));
    brushes.push({ shape: 'ramp', min: [centreX - 2, 0, centreZ - 8], max: [centreX + 2, 2, centreZ - 6], dir: '-x' });
  }
  return { id: 'navbig', brushes, spawns, items: [], objectives: [], triggers: [] };
}

// Wall segments along x at z = line and along z at x = line, with a 2 m doorway at each room centre (-40, -20, ... 40).
function navTestWallLine(brushes, line) {
  for (let door = -50; door < 50; door += 20) {
    const start = door === -50 ? -50 : door + 1, end = Math.min(50, door + 19);
    brushes.push(navTestBox([start, 0, line - 0.15], [end, 3, line + 0.15]));
    brushes.push(navTestBox([line - 0.15, 0, start], [line + 0.15, 3, end]));
  }
}

DebugApi.nav = Nav;
DebugApi.perf.navBuild = (map) => { World.load(map || navTestBigMap()); return Nav.buildMs; };

Test.add('nav', (check) => {
  const milliseconds = DebugApi.perf.navBuild();
  check('big map: build under ' + NAV_TEST_BUILD_BUDGET_MS + ' ms (' + milliseconds.toFixed(1) + ' ms, ' + Nav.nodeCount + ' nodes, ' + Nav.linkCount + ' links)',
    milliseconds < NAV_TEST_BUILD_BUDGET_MS, milliseconds);
  const problems = Nav.validate(World.map);
  check('big map: every spawn reaches every other spawn', problems.length === 0, problems.slice(0, 3).join('; '));
  check('big map: main component holds nearly all nodes', navComponentSize(Nav.mainComponent) > Nav.nodeCount * 0.95, navComponentSize(Nav.mainComponent) + ' / ' + Nav.nodeCount);
  check('big map: every walk link has a clear chest line', navTestLinksClear() === 0, navTestLinksClear());
  const spawns = World.map.spawns, a = navTestNode(spawns[0].x, 0, spawns[0].z), b = navTestNode(spawns[24].x, 0, spawns[24].z);
  Nav.request(5, a, b);
  navTestServeAll();
  check('big map: corner to corner path, smoothed path stays clear of walls', Nav.result(5) === NAV_STATUS.DONE && navTestSmoothedClear(5), Nav.result(5));
  const started = performance.now();
  for (let i = 0; i < 50; i++) Nav.findPath(navTestNode(spawns[i % 25].x, 0, spawns[i % 25].z), navTestNode(spawns[(i * 7 + 3) % 25].x, 0, spawns[(i * 7 + 3) % 25].z), { allowJumpHeight: i * 0.03 });
  const perQuery = (performance.now() - started) / 50;
  check('big map: A* query cost (' + perQuery.toFixed(2) + ' ms) fits 4 per tick', perQuery < 2, perQuery);
});
