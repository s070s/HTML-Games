// Self-tests for S09 navigation on hand-built maps: doorway, ramp, ledge, tower with ladder, jump pad, teleporters,
// pool, crawl tunnel, low slab, pillar field (A* versus Dijkstra) and a 120 x 120 m benchmark map (ARC-034).

const NAV_TEST_PHONE_FACTOR = 6;        // a low-end phone runs this JavaScript about 4-8 x slower than the headless desktop
const NAV_TEST_BUILD_BUDGET_MS = 300 / NAV_TEST_PHONE_FACTOR; // BOT-010: 300 ms on Low, as desktop milliseconds
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

// Smoothed moves of slot id that pass over the xz rectangle: [all of them, those not of the expected type].
function navTestMovesOver(id, minX, minZ, maxX, maxZ, expectedType) {
  const a = Vec.make(), b = Vec.make(), counts = [0, 0];
  for (let i = 0; i + 1 < Nav.resultPointCount(id); i++) {
    const type = Nav.resultPoint(id, i, a);
    Nav.resultPoint(id, i + 1, b);
    if (!navTestSegmentOver(a, b, minX, minZ, maxX, maxZ)) continue;
    counts[0]++;
    if (type !== expectedType) counts[1]++;
  }
  return counts;
}

function navTestSegmentOver(a, b, minX, minZ, maxX, maxZ) {
  const steps = 100;
  for (let step = 0; step <= steps; step++) {
    const x = a.x + (b.x - a.x) * step / steps, z = a.z + (b.z - a.z) * step / steps;
    if (x > minX && x < maxX && z > minZ && z < maxZ) return true;
  }
  return false;
}

function navTestServeAll() {
  for (let tick = 0; tick < 64 && Nav.pendingRequests() > 0; tick++) Nav.serveRequests();
}

Test.add('nav', (check) => {
  navTestRooms(true);
  const a = navTestNode(-5, 0, -6), b = navTestNode(5, 0, 6);
  check('rooms: nodes on both sides', Nav.nodeCount > 100 && a >= 0 && b >= 0 && Nav.nodeZ[a] < 0 && Nav.nodeZ[b] > 0, Nav.nodeCount);
  check('rooms: node spacing about 2 m (one per cell and surface)', Nav.nodeCount < 400, Nav.nodeCount);
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
  // A 1.13 m ledge needs exactly 1.28 m (float32 1.27999997): request (stored options) and findPath must agree.
  navTestLoad([navTestFloor(-10, -10, 10, 10, 0), navTestBox([2, 0, -3], [8, 1.13, 3])]);
  const low = navTestNode(-4, 0, 0), high = navTestNode(5, 1.13, 0);
  Nav.request(0, low, high, { allowJumpHeight: 1.28 });
  Nav.request(1, low, high, { allowJumpHeight: Math.fround(1.28) });
  navTestServeAll();
  check('quantize: a float32 option keeps its centimetre', navQuantize(Math.fround(1.28), 100) === 1.28 && navQuantize(1.28, 100) === 1.28);
  check('quantize: request and findPath accept the exact jump height', Nav.result(0) === NAV_STATUS.DONE && Nav.result(1) === NAV_STATUS.DONE
    && Nav.findPath(low, high, { allowJumpHeight: 1.28 }) > 0 && Nav.findPath(low, high, { allowJumpHeight: 1.27 }) === 0);
});

Test.add('nav', (check) => {
  // A 1 m barrier across the whole floor: the only way over is a jump that clears its top.
  navTestLoad([navTestFloor(-10, -10, 10, 10, 0), navTestBox([-10, 0, -0.5], [10, 1, 0.5])]);
  const south = navTestNode(0, 0, -5), north = navTestNode(0, 0, 5);
  check('barrier: jump over it needs barrier height + margin', Nav.findPath(south, north, { allowJumpHeight: 1 + NAV_JUMP_MARGIN }) > 0 && Nav.findPath(south, north, { allowJumpHeight: 1 }) === 0);
  // Two platforms at 3 m with a 1.5 m gap and no floor below: a level gap jump.
  navTestLoad([navTestBox([-8, 2, -3], [-0.75, 3, 3]), navTestBox([0.75, 2, -3], [8, 3, 3])]);
  const west = navTestNode(-4, 3, 0), east = navTestNode(4, 3, 0), types = navTestPathTypes(west, east);
  check('gap: crossed with a low jump', types.includes(NAV_LINK.JUMP) && Nav.reachable(east, west), types.join(','));
  const gapHeight = navTestJumpMinimum(Nav.linkHeight), shortestJump = navTestJumpMinimum(Nav.linkReach);
  check('gap: a level gap needs only the jump margin', Test.near(gapHeight, NAV_JUMP_MARGIN, 0.01), gapHeight);
  check('gap: every link stores its horizontal length', navTestReachStored());
  // Level jump length = moveSpeed x 2 jumpVelocity / gravity: 6 x 2 x 8 / 20 = 4.8 m clears it, 4 x 2 x 4 / 20 = 1.6 m does not.
  const strong = { moveSpeed: 6, jumpVelocity: 8, gravity: 20 }, weak = { moveSpeed: 4, jumpVelocity: 4, gravity: 20 };
  check('gap: shortest jump is longer than the 1.6 m short jump', shortestJump > 1.6 && shortestJump <= Nav.limits.jumpReach, shortestJump);
  check('reach: a preset with a long jump crosses the gap', Nav.findPath(west, east, strong) > 0);
  check('reach: a preset with a short jump does not (and is not served from the cache)', Nav.findPath(west, east, weak) === 0 && !Nav.lastCacheHit);
  Nav.request(0, west, east, weak);
  Nav.request(1, west, east, strong);
  navTestServeAll();
  check('reach: request copies the reach options', Nav.result(0) === NAV_STATUS.FAILED && Nav.result(1) === NAV_STATUS.DONE);
  // An item sealed inside a closed box is reported by validate.
  const sealed = [navTestBox([4, 0, 4], [8, 3, 4.3]), navTestBox([4, 0, 7.7], [8, 3, 8]), navTestBox([4, 0, 4], [4.3, 3, 8]), navTestBox([7.7, 0, 4], [8, 3, 8])];
  const map = navTestLoad([navTestFloor(-10, -10, 10, 10, 0)].concat(sealed), { spawns: [navTestSpawn(-5, 0, -5)], items: [{ x: 6, y: 0, z: 6, item: 'armor', group: 'armor' }, { x: -2, y: 0, z: 2, item: 'health', group: 'health' }] });
  const problems = Nav.validate(map);
  check('validate: item inside a sealed box is unreachable, the open one is fine', problems.length === 1 && problems[0].includes('armor'), problems.join('; '));
});

// Smallest value of a per-link array over the jump links.
function navTestJumpMinimum(values) {
  let smallest = Infinity;
  for (let link = 0; link < Nav.linkCount; link++) if (Nav.linkType[link] === NAV_LINK.JUMP) smallest = Math.min(smallest, values[link]);
  return smallest;
}

function navTestReachStored() {
  for (let link = 0; link < Nav.linkCount; link++) {
    const from = Nav.linkFrom[link], to = Nav.linkTarget[link];
    if (!Test.near(Nav.linkReach[link], Math.hypot(Nav.nodeX[to] - Nav.nodeX[from], Nav.nodeZ[to] - Nav.nodeZ[from]), 1e-3)) return false;
  }
  return Nav.linkCount > 0;
}

function navTestReachableMatches() {
  const random = makeRandom(8);
  for (let pair = 0; pair < 300; pair++) {
    const a = random.int(0, Nav.nodeCount - 1), b = random.int(0, Nav.nodeCount - 1);
    if (Nav.reachable(a, b) !== navBreadthFirst(a, b)) return false;
  }
  return true;
}

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
  check('tower: running off covers the drop, a crawl off the edge does not', Nav.findPath(top, floor, { moveSpeed: 6, jumpVelocity: 0 }) > 0
    && Nav.findPath(top, floor, { moveSpeed: 0.1, jumpVelocity: 0 }) === 0);
  check('reachable: component bit table answers like a breadth-first search', Nav.componentReach !== null && Nav.componentCount > 1 && navTestReachableMatches());
  const table = Nav.componentReach;
  Nav.componentReach = null;
  check('reachable: falls back to breadth-first search without the table', navTestReachableMatches() && Nav.reachable(top, floor) && !Nav.reachable(floor, top));
  Nav.componentReach = table;
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

// Teleporter pad centred on (x, -3) that sends actors to (exitX, 0, exitZ).
const navTestTeleporter = (x, exitX, exitZ) => ({ kind: 'teleporter', min: [x - 0.75, 0, -3.75], max: [x + 0.75, 2, -2.25], exit: [exitX, 0, exitZ] });

// Two islands 20 m apart joined only by a pair of teleporters.
function navTestIslands() {
  return navTestLoad([navTestFloor(-20, -8, -10, 8, 0), navTestFloor(10, -8, 20, 8, 0)], {
    triggers: [navTestTeleporter(-15, 15, 3), navTestTeleporter(15, -15, 3)], spawns: [navTestSpawn(-17, 0, 5), navTestSpawn(17, 0, 5)],
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
  // Chained teleporters (west -> middle island next to the second pad -> east) beside a long walkway joining all three:
  // the teleporter heuristic is admissible but not consistent here, A* must still match Dijkstra.
  navTestLoad([navTestFloor(-40, -8, -30, 8, 0), navTestFloor(-5, -8, 5, 8, 0), navTestFloor(30, -8, 40, 8, 0), navTestFloor(-40, 8, 40, 11, 0)], {
    triggers: [navTestTeleporter(-35, -1, -3), navTestTeleporter(2, 35, 3)],
  });
  const west = navTestNode(-37, 0, 5), east = navTestNode(37, 0, 5), types = navTestPathTypes(west, east);
  check('teleporter chain: west to east takes both teleporters', types.filter((type) => type === NAV_LINK.TELEPORT).length === 2, types.join(','));
  const random = makeRandom(21);
  let mismatches = 0, firstMismatch = '';
  for (let pair = 0; pair < 40; pair++) {
    const from = pair % 4 ? random.int(0, Nav.nodeCount - 1) : west, to = pair % 4 ? random.int(0, Nav.nodeCount - 1) : east;
    Nav.findPath(from, to, pair % 2 ? { allowJumpHeight: 0 } : undefined);
    const expected = navTestDijkstra(from, to, null);
    if (Nav.pathCost === expected || Test.near(Nav.pathCost, expected, 1e-4 * Math.max(1, expected))) continue;
    mismatches++;
    firstMismatch = firstMismatch || from + ' -> ' + to + ': ' + Nav.pathCost + ' vs ' + expected;
  }
  check('teleporter chain: A* cost equals Dijkstra on 40 pairs', mismatches === 0, mismatches + ' ' + firstMismatch);
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
  Nav.request(0, south, north);
  navTestServeAll();
  const tunnel = navTestMovesOver(0, -1, -1, 1, 1, NAV_LINK.CROUCH);
  check('crouch: smoothed moves through the tunnel are typed CROUCH', Nav.result(0) === NAV_STATUS.DONE && tunnel[0] > 0 && tunnel[1] === 0, tunnel.join(' / '));
});

// Footprint half size of a low slab where a standing capsule cannot be: slab + capsule radius, minus one raster
// column of tolerance (a straight line may clip a column corner between raster steps).
const NAV_TEST_UNDER_SLAB = 2 + NAV_RADIUS - NAV_FINE / 2;

Test.add('nav', (check) => {
  // A floating slab at 1.3..1.5 m (crouch-only underneath) in the middle of an open floor; the path passes beside it.
  navTestLoad([navTestFloor(-10, -10, 10, 10, 0), navTestBox([-2, 1.3, -2], [2, 1.5, 2])]);
  const from = navTestNode(-5, 0, 0.3), to = navTestNode(5, 0, -0.3), half = NAV_TEST_UNDER_SLAB;
  Nav.request(0, from, to, { crouchOk: false });
  Nav.request(1, from, to);
  navTestServeAll();
  const standing = navTestMovesOver(0, -half, -half, half, half, NAV_LINK.CROUCH), crouching = navTestMovesOver(1, -half, -half, half, half, NAV_LINK.CROUCH);
  check('smoothing: crouchOk false never cuts under a low slab', Nav.result(0) === NAV_STATUS.DONE && standing[0] === 0, standing.join(' / '));
  check('smoothing: a move under the slab is always typed CROUCH', Nav.result(1) === NAV_STATUS.DONE && crouching[1] === 0, crouching.join(' / '));
  check('smoothing: still smooths the open floor', Nav.resultPointCount(0) < Nav.resultNodeCount(0), Nav.resultPointCount(0) + ' / ' + Nav.resultNodeCount(0));
});

Test.add('nav', (check) => {
  // Shallow pool (0.6 m deep, wadeable floor) in the middle of an open floor: smoothing must not walk through it.
  navTestLoad([navTestFloor(-10, -10, 10, 10, 0)], { triggers: [{ kind: 'water', min: [-2, 0, -2], max: [2, 0.6, 2] }] });
  const from = navTestNode(-5, 0, 0.3), to = navTestNode(5, 0, -0.3);
  Nav.request(0, from, to);
  navTestServeAll();
  const wet = navTestMovesOver(0, -2, -2, 2, 2, NAV_LINK.SWIM);
  check('smoothing: a move through water is typed SWIM', Nav.result(0) === NAV_STATUS.DONE && wet[1] === 0, wet.join(' / '));
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
  Nav.clearCache();
  const map = navTestPillars(), nodes = Nav.nodeCount, links = Nav.linkCount, firstMs = Nav.buildMs;
  check('graph cache: first load builds', !Nav.lastBuildCached);
  const length = Nav.findPath(0, nodes - 1), cost = Nav.pathCost;
  navTestRooms(true);
  World.load(JSON.parse(JSON.stringify(map)));
  check('graph cache: same map again reuses the graph', Nav.lastBuildCached && Nav.nodeCount === nodes && Nav.linkCount === links && Nav.buildMs < firstMs, Nav.buildMs + ' vs ' + firstMs);
  check('graph cache: reused graph answers the same path', Nav.findPath(0, nodes - 1) === length && Test.near(Nav.pathCost, cost, 1e-6) && navTestLinksClear() === 0);
  map.brushes[1].max[1] = 2;
  World.load(map);
  check('graph cache: an edited map builds again', !Nav.lastBuildCached);
  const jumpUp = Nav.limits.jumpUp;
  Nav.limits.jumpUp = 1;
  World.load(map);
  check('graph cache: other limits build again', !Nav.lastBuildCached);
  Nav.limits.jumpUp = jumpUp;
  for (let i = 0; i < 6; i++) navTestLoad([navTestFloor(-5 - i, -5, 5, 5, 0)]);
  World.load(map);
  check('graph cache: holds only the last ' + NAV_GRAPH_CACHE_SIZE + ' maps', !Nav.lastBuildCached);
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
  // 64 bots asking for the same cached path at once (round start): smoothing still costs, so each counts.
  Nav.findPath(0, Nav.nodeCount - 1);
  for (let id = 0; id < NAV_SLOTS; id++) Nav.request(id, 0, Nav.nodeCount - 1);
  Nav.serveRequests();
  check('budget: cache hits count too (' + NAV_QUERIES_PER_TICK + ' served per tick)', Nav.servedThisTick === NAV_QUERIES_PER_TICK && Nav.searchesThisTick === 0
    && Nav.pendingRequests() === NAV_SLOTS - NAV_QUERIES_PER_TICK, Nav.servedThisTick + ' served, ' + Nav.pendingRequests() + ' pending');
  navTestServeAll();
  check('budget: all 64 answered after 16 ticks', Nav.pendingRequests() === 0 && Nav.result(NAV_SLOTS - 1) === NAV_STATUS.DONE);
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

// size x size m map (a multiple of 20): rooms of 20 m with a 2 m doorway in the middle of every wall, crates
// (0.006 per m^2: 60 on 100 x 100 m), and a raised platform with a ramp in every third room (ARC-034 benchmark).
const NAV_TEST_ROOM = 20;
const NAV_TEST_CRATES_PER_SQUARE_METRE = 0.006;
const NAV_TEST_BENCH_SIZE = 120;        // BOT-010: "< 300 ms on Low for a 120 x 120 m map"

function navTestBigMap(size) {
  const half = size / 2, rooms = size / NAV_TEST_ROOM, random = makeRandom(9), brushes = [navTestFloor(-half, -half, half, half, 0)], spawns = [];
  for (let line = -half + NAV_TEST_ROOM; line < half; line += NAV_TEST_ROOM) navTestWallLine(brushes, line, half);
  for (let i = 0; i < Math.round(NAV_TEST_CRATES_PER_SQUARE_METRE * size * size); i++) {
    const x = random.int(-half + 2, half - 3), z = random.int(-half + 2, half - 3);
    brushes.push(navTestBox([x, 0, z], [x + 1, 1, z + 1]));
  }
  for (let room = 0; room < rooms * rooms; room++) {
    const centreX = -half + (room % rooms + 0.5) * NAV_TEST_ROOM, centreZ = -half + (Math.floor(room / rooms) + 0.5) * NAV_TEST_ROOM;
    spawns.push(navTestSpawn(centreX + 3, 0, centreZ + 3));
    if (room % 3 !== 0) continue;
    brushes.push(navTestBox([centreX - 6, 0, centreZ - 8], [centreX - 2, 2, centreZ - 4]));
    brushes.push({ shape: 'ramp', min: [centreX - 2, 0, centreZ - 8], max: [centreX + 2, 2, centreZ - 6], dir: '-x' });
  }
  return { id: 'navbig' + size, brushes, spawns, items: [], objectives: [], triggers: [] };
}

// Walls along x at z = line and along z at x = line, split by a 2 m doorway in the middle of every room side.
function navTestWallLine(brushes, line, half) {
  for (let start = -half; start < half; start += NAV_TEST_ROOM) {
    const doorStart = start + NAV_TEST_ROOM / 2 - 1, doorEnd = doorStart + 2, end = start + NAV_TEST_ROOM;
    brushes.push(navTestBox([start, 0, line - 0.15], [doorStart, 3, line + 0.15]), navTestBox([doorEnd, 0, line - 0.15], [end, 3, line + 0.15]));
    brushes.push(navTestBox([line - 0.15, 0, start], [line + 0.15, 3, doorStart]), navTestBox([line - 0.15, 0, doorEnd], [line + 0.15, 3, end]));
  }
}

DebugApi.nav = Nav;
// ARC-034 benchmark: a real build (graph cache emptied first) of the given map or the 120 x 120 m test map.
DebugApi.perf.navBuild = (map) => { Nav.clearCache(); World.load(map || navTestBigMap(NAV_TEST_BENCH_SIZE)); return Nav.buildMs; };

function navTestPhases() {
  return Object.keys(Nav.buildPhases).map((phase) => phase + ' ' + Nav.buildPhases[phase].toFixed(1)).join(', ');
}

Test.add('nav', (check) => {
  const first = DebugApi.perf.navBuild(), warm = Math.min(DebugApi.perf.navBuild(), DebugApi.perf.navBuild(), DebugApi.perf.navBuild());
  check('big map: 120 x 120 m build ' + warm.toFixed(1) + ' ms warm (first ' + first.toFixed(1) + ' ms) under ' + NAV_TEST_BUILD_BUDGET_MS + ' ms = BOT-010 300 ms on a '
    + NAV_TEST_PHONE_FACTOR + ' x slower phone (' + Nav.nodeCount + ' nodes, ' + Nav.linkCount + ' links)', warm < NAV_TEST_BUILD_BUDGET_MS, navTestPhases());
  const problems = Nav.validate(World.map);
  check('big map: every spawn reaches every other spawn', problems.length === 0, problems.slice(0, 3).join('; '));
  check('big map: main component holds nearly all nodes', navComponentSize(Nav.mainComponent) > Nav.nodeCount * 0.95, navComponentSize(Nav.mainComponent) + ' / ' + Nav.nodeCount);
  check('big map: every walk link has a clear chest line', navTestLinksClear() === 0, navTestLinksClear());
  const spawns = World.map.spawns, count = spawns.length, a = navTestNode(spawns[0].x, 0, spawns[0].z), b = navTestNode(spawns[count - 1].x, 0, spawns[count - 1].z);
  Nav.request(5, a, b);
  navTestServeAll();
  check('big map: corner to corner path, smoothed path stays clear of walls', Nav.result(5) === NAV_STATUS.DONE && navTestSmoothedClear(5), Nav.result(5));
  const started = performance.now();
  for (let i = 0; i < 50; i++) Nav.findPath(navTestNode(spawns[i % count].x, 0, spawns[i % count].z), navTestNode(spawns[(i * 7 + 3) % count].x, 0, spawns[(i * 7 + 3) % count].z), { allowJumpHeight: i * 0.03 });
  const perQuery = (performance.now() - started) / 50;
  check('big map: A* query cost (' + perQuery.toFixed(2) + ' ms) fits 4 per tick', perQuery < 2, perQuery);
});
