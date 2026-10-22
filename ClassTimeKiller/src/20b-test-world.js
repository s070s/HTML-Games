// Self-tests for S08 world (group 'world'): tree queries, hull sweeps, step/slope rules, random-move safety,
// trigger volumes, rigid bodies and destructible props. Uses the helpers from 20b-test-move.js.

// A deterministic field of boxes, ramps and cylinders on the test floor.
function randomBrushes(seed, count, spread) {
  const random = makeRandom(seed), brushes = [], shapes = ['box', 'box', 'ramp', 'cylinder'], dirs = ['+x', '-x', '+z', '-z'];
  for (let i = 0; i < count; i++) {
    const x = random.range(-spread, spread), z = random.range(-spread, spread), y = random.chance(0.3) ? random.range(0.5, 3) : 0;
    const width = random.range(0.3, 4), depth = random.range(0.3, 4), height = random.range(0.2, 3);
    brushes.push({ shape: random.pick(shapes), dir: random.pick(dirs), min: [x, y, z], max: [x + width, y + height, z + depth] });
  }
  return brushes;
}

// Reference answer: every brush, no tree.
function bruteRay(ox, oy, oz, dx, dy, dz, maxDistance) {
  let best = 1, found = null;
  const segment = { sx: ox, sy: oy, sz: oz, ex: ox + dx * maxDistance, ey: oy + dy * maxDistance, ez: oz + dz * maxDistance };
  for (const brush of World.brushes) {
    if (clipBrush(brush, segment, POINT_HULL, 0) && clipResult.fraction < best) { best = clipResult.fraction; found = brush; }
  }
  return found ? best * maxDistance : -1;
}

Test.add('world', (check) => {
  loadTestWorld(randomBrushes(11, 300, 50));
  const random = makeRandom(5), hit = makeHit();
  let mismatches = 0, detail = '';
  for (let i = 0; i < 2000; i++) {
    Vec.fromAngles(scratchDirection, random.range(-Math.PI, Math.PI), random.range(-1.2, 1.2));
    const ox = random.range(-55, 55), oy = random.range(0.1, 6), oz = random.range(-55, 55);
    const expected = bruteRay(ox, oy, oz, scratchDirection.x, scratchDirection.y, scratchDirection.z, 80);
    const got = World.raycast(ox, oy, oz, scratchDirection.x, scratchDirection.y, scratchDirection.z, 80, hit) ? hit.distance : -1;
    if (Math.abs(expected - got) > 1e-4) { mismatches++; detail = expected + ' vs ' + got; }
  }
  check('tree raycast matches brute force on 2000 rays (301 brushes)', mismatches === 0, mismatches + ' ' + detail);
  check('tree has nodes', World.tree.nodeCount > 100);
  const started = performance.now();
  for (let i = 0; i < 5000; i++) World.raycast(random.range(-50, 50), 1.5, random.range(-50, 50), 0.6, -0.1, 0.79, 40, hit);
  const microseconds = (performance.now() - started) * 1000 / 5000;
  check('ray query < 5 us on average (step 4.3)', microseconds < 5, microseconds.toFixed(2) + ' us');
});

const scratchDirection = Vec.make();

// PERF-002: line of sight stops its tree walk at the first brush it hits (anyHit) and the slab tests use 1 / direction.
Test.add('world', (check) => {
  loadTestWorld(randomBrushes(11, 300, 50));
  const random = makeRandom(9);
  let mismatches = 0, detail = '';
  for (let i = 0; i < 2000; i++) {
    const ax = random.range(-55, 55), ay = random.range(0.1, 6), az = random.range(-55, 55);
    const axis = i % 4, bx = axis === 1 ? ax : random.range(-55, 55), by = axis === 2 ? ay : random.range(0.1, 6), bz = axis === 3 ? az : random.range(-55, 55);
    const length = length3(bx - ax, by - ay, bz - az), expected = bruteRay(ax, ay, az, (bx - ax) / length, (by - ay) / length, (bz - az) / length, length) < 0;
    if (World.lineClear(ax, ay, az, bx, by, bz) !== expected) { mismatches++; detail = [ax, ay, az, bx, by, bz].join(' '); }
  }
  check('lineClear matches brute force on 2000 lines, a quarter of them parallel to an axis', mismatches === 0, mismatches + ' ' + detail);
  loadTestWorld([{ shape: 'box', min: [-6, 0, -2], max: [-5, 3, 2] }, { shape: 'box', min: [5, 0, -2], max: [6, 3, 2] }]);
  const hit = makeHit();
  check('raycast through two walls keeps the nearest', World.raycast(10, 1, 0, -1, 0, 0, 20, hit) && Test.near(hit.x, 6, 1e-4), hit.x);
  check('an axis-parallel ray starting exactly on a box face plane still hits the box (faces count as inside)', World.raycast(6, 5, 2, 0, -1, 0, 10, hit)
    && Test.near(hit.y, 3, 1e-4), hit.y);
  const blocked = !World.lineClear(10, 1, 0, -10, 1, 0);
  check('a sight line through two walls stops at the first wall its tree walk meets (the far one, left child first)', blocked && rayQuery.brush === World.brushes[1]
    && Test.near(rayQuery.fraction, 0.75, 1e-4), rayQuery.fraction);
});

Test.add('world', (check) => {
  loadTestWorld([{ shape: 'cylinder', min: [8, 0, -2], max: [12, 3, 2], sides: 12 }, { shape: 'wedge', min: [-6, 0, -2], max: [-2, 2, 2], dir: '+x' }]);
  const hit = makeHit();
  check('cylinder: side ray hits near the radius', World.raycast(0, 1, 0, 1, 0, 0, 30, hit) && Test.near(hit.x, 8, 0.05) && hit.nx < -0.95, hit.x);
  check('cylinder: corner of its box is empty', !World.pointInside(8.1, 1, 1.9));
  check('wedge is a ramp', World.raycast(-4, 5, 0, 0, -1, 0, 10, hit) && Test.near(hit.y, 1, 1e-3), hit.y);
  check('capsuleFits: free and blocked', World.capsuleFits(0, 0.01, 0, ACTOR_RADIUS, 1.8) && !World.capsuleFits(9.8, 0.01, 0, ACTOR_RADIUS, 1.8));
  check('floorBelow finds the floor', Test.near(World.floorBelow(0, 3, 0, 10), 0, 1e-4) && Number.isNaN(World.floorBelow(0, 3, 0, 2)));
  check('sphereTouches', World.sphereTouches(7.8, 1, 0, 0.3) && !World.sphereTouches(7, 1, 0, 0.3));
  check('sweepCapsule stops at the wall', World.sweepCapsule(0, 0.01, 0, 20, 0.01, 0, ACTOR_RADIUS, 1.8, Collide.trace) && Test.near(Collide.trace.x, 7.6, 0.05), Collide.trace.x);
});

// Long queries see every brush: 400 tiles under a 130 m sweep, then a wall at x = 60.
Test.add('world', (check) => {
  const tiles = [];
  for (let i = 0; i < 400; i++) tiles.push({ shape: 'box', min: [i * 0.3, -0.3, -1], max: [i * 0.3 + 0.25, 0.005, 1] });
  loadTestWorld(tiles.concat([{ shape: 'box', min: [60, 0, -5], max: [60.5, 4, 5] }]));
  const blocked = World.sweepCapsule(0, 0.02, 0, 130, 0.02, 0, ACTOR_RADIUS, 1.8, Collide.trace);
  check('sweepCapsule over 400 brushes stops at the wall behind them', blocked && Test.near(Collide.trace.x, 60 - ACTOR_RADIUS, 0.02), Collide.trace.x);
  const mover = makeMover();
  mover.y = 0.02; setCapsuleHull(mover.hull, ACTOR_RADIUS, 1.8);
  const logged = Test.expectErrors(() => Collide.gatherAround(mover, 100));
  const expected = World.brushes.filter((brush) => brush.minX <= 100 + ACTOR_RADIUS + GATHER_MARGIN).length;
  check('a gather past 256 brushes keeps every brush (never skips collision)', logged === 0 && Collide.candidateCount === expected && expected > CANDIDATE_START_SIZE,
    Collide.candidateCount + ' of ' + expected);
});

// ---- Character collision: tunnelling, step height, slopes, ceilings ----
Test.add('world', (check) => {
  loadTestWorld([{ shape: 'box', min: [10, 0, -30], max: [10.1, 30, 30] }]);
  useTestRules({ move: 'arena' });
  for (const speed of [50, 100, 300]) {
    const id = spawnTester(0, 5, 0);
    Actors.vx[id] = speed;
    stepSeconds(0.5);
    check('no tunnelling through a 0.1 m wall at ' + speed + ' m/s', Actors.x[id] < 10 - ACTOR_RADIUS + 0.01, Actors.x[id]);
    Actors.remove(id);
  }
  const spec = Bodies.spec;
  Object.assign(spec, { shape: BODY_SHAPE.SPHERE, kind: BODY_KIND.THROWN, x: 0, y: 5, z: 5, vx: 40, vy: 0, vz: 0, halfX: 0.1, mass: 1, owner: -1 });
  const body = Bodies.spawn(spec);
  stepSeconds(0.5);
  check('no tunnelling for a 40 m/s body', Bodies.x[body] < 10, Bodies.x[body]);
});

// A wall touched in an early sub-step is remembered with its own brush, even when later sub-steps touch nothing.
Test.add('world', (check) => {
  loadTestWorld([{ shape: 'box', min: [-1, 0, -30], max: [-0.5, 30, 30], material: 'metal' }]);
  useTestRules({ move: 'arena' });
  const id = spawnTester(0, 10, 0);
  Sim.step();
  Actors.vx[id] = -60; Actors.vz[id] = 60;
  Sim.step();
  check('fast glancing hit on a wall: blocked by that wall', Motion.blocked[id] === 1 && Test.near(Motion.blockNX[id], 1, 1e-4), Motion.blocked[id]);
  check('the wall brush is the wall, not another surface', Motion.wallBrush[id] && Motion.wallBrush[id].material === 'metal');
  Actors.remove(id);
});

Test.add('world', (check) => {
  loadTestWorld([
    { shape: 'box', min: [-1, 0, 4], max: [1, 0.45, 5] },
    { shape: 'box', min: [9, 0, 4], max: [11, 0.5, 5] },
    { shape: 'ramp', min: [19, 0, 3], max: [21, 3, 6], dir: '+z' },
    { shape: 'box', min: [19, 0, 6], max: [21, 3, 10] },
    { shape: 'ramp', min: [29, 0, 3], max: [31, 3.6, 6], dir: '+z' },
  ]);
  useTestRules({ move: 'arena' });
  const stepper = runForward(0, 0, 0.8), blocked = runForward(10, 0, 0.8);
  check('steps up 0.45 m', stepper.top > 0.44 && stepper.z > 5, stepper.top);
  check('0.5 m is too high to step', blocked.z < 4 - ACTOR_RADIUS + 0.01, blocked.z);
  const walkable = runForward(20, 0, 2.5), steep = runForward(30, 0, 2.5);
  check('walks up a 45 deg slope', walkable.top > 2.9, walkable.top);
  check('cannot walk up a 50 deg slope', steep.top < 1.5, steep.top);
});

// Holds forward (+Z) from (x, z) for some seconds; returns the furthest z and highest feet height.
function runForward(x, z, seconds) {
  const id = groundedTester(x, z);
  holdInput(id, 0, 1, 0, 0);
  let top = 0, furthest = z;
  for (let i = 0; i < Math.round(seconds * TICK_RATE); i++) { Sim.step(); top = Math.max(top, Actors.y[id]); furthest = Math.max(furthest, Actors.z[id]); }
  Actors.remove(id);
  return { top, z: furthest };
}

// 10 000 random moves (8 actors x 1250 steps, random input and launches) never end inside geometry (step 4.2).
Test.add('world', (check) => {
  loadTestWorld(randomBrushes(3, 160, 25));
  const random = makeRandom(99), testers = [];
  for (const preset of CAT.movement) testers.push(spawnTester(...freeSpot(random), preset.id));
  let inside = 0, detail = '';
  for (let step = 0; step < 1250; step++) {
    if (step % 30 === 0) testers.forEach((id) => randomize(id, random));
    Sim.step();
    for (const id of testers) {
      if (World.capsuleFits(Actors.x[id], Actors.y[id], Actors.z[id], ACTOR_RADIUS, Actors.height[id])) continue;
      inside++; detail = Move.preset(id).id + ' at ' + [Actors.x[id], Actors.y[id], Actors.z[id]].map((v) => v.toFixed(3)).join();
    }
  }
  check('10 000 random moves never end inside geometry', inside === 0, inside + ' ' + detail);
});

function freeSpot(random) {
  for (;;) {
    const x = random.range(-25, 25), z = random.range(-25, 25);
    if (World.capsuleFits(x, 0.05, z, ACTOR_RADIUS, 1.8)) return [x, 0.05, z];
  }
}

function randomize(id, random) {
  const buttons = [0, BTN.JUMP, BTN.CROUCH, BTN.SPRINT, BTN.JUMP | BTN.CROUCH, BTN.ALT, BTN.PRONE];
  holdInput(id, random.range(-1, 1), random.range(-1, 1), random.pick(buttons), random.range(-180, 180));
  if (random.chance(0.3)) { Actors.vx[id] += random.range(-40, 40); Actors.vy[id] += random.range(-10, 25); Actors.vz[id] += random.range(-40, 40); }
}

// ---- Trigger volumes (MOV-019, MOV-020) ----
Test.add('world', (check) => {
  loadTestWorld([], { triggers: [{ kind: 'jumppad', min: [-1, 0, -1], max: [1, 0.3, 1], target: [20, 0, 0], peak: 3 }] });
  useTestRules({ move: 'arena' });
  const id = spawnTester(0, 0.05, 0);
  const events = recordEvents(['world.trigger'], () => Sim.step());
  check('jump pad fires world.trigger', events.length === 1 && events[0].kind === 'jumppad' && events[0].id === id);
  let top = Actors.y[id];
  for (let i = 0; i < 3 * TICK_RATE && !(Motion.grounded[id] && Actors.x[id] > 5); i++) { Sim.step(); top = Math.max(top, Actors.y[id]); }
  check('jump pad arc tops out at the designer height', Test.near(top, 3.05, 0.1), top);
  check('jump pad lands on its target', Test.near(Actors.x[id], 20, 0.3) && Test.near(Actors.z[id], 0, 0.3), Actors.x[id]);
});

Test.add('world', (check) => {
  loadTestWorld([], { triggers: [{ kind: 'teleporter', min: [-1, 0, 4], max: [1, 2, 5], exit: [30, 0.05, 30], yaw: 90 }] });
  useTestRules({ move: 'arena' });
  const occupant = groundedTester(30, 30, null, 2);
  const id = groundedTester(0, 0, null, 1);
  Game.playerId = id;
  holdInput(id, 0, 1, 0, 0);
  stepSeconds(0.3);
  const requests = recordEvents(['damage.request'], () => { for (let i = 0; i < 120 && Actors.x[id] < 29; i++) Sim.step(); });
  check('teleporter moves to the exit', Test.near(Actors.x[id], 30, 1.5) && Test.near(Actors.z[id], 30, 0.5), Actors.x[id] + ',' + Actors.z[id]);
  check('exit yaw 90 deg', Test.near(Actors.yaw[id], 90 * DEG, 1e-4));
  check('MOV-019 the local player view turns to the exit yaw too', Test.near(Input.aim.yaw, 90 * DEG, 1e-4), Input.aim.yaw);
  Game.playerId = -1;
  check('speed kept, turned to the exit yaw', Actors.vx[id] > 4 && Math.abs(Actors.vz[id]) < 0.5, Actors.vx[id]);
  const telefrag = requests.find((r) => r.kind === 'telefrag');
  check('telefrag: occupant gets lethal damage credited to the arriver (MOV-020)', telefrag && telefrag.target === occupant && telefrag.source === id && telefrag.amount >= 1000);
});

Test.add('world', (check) => {
  loadTestWorld([{ shape: 'box', min: [-1, 0, 2], max: [1, 8, 3] }, { shape: 'box', min: [-1, 0, 3], max: [1, 6, 6] }],
    { triggers: [{ kind: 'ladder', min: [-1, 0, 1.4], max: [1, 6.2, 2] }] });
  useTestRules({ move: 'arena' });
  const id = groundedTester(0, 1.2);
  holdInput(id, 0, 1, 0, 0);
  stepSeconds(0.3);
  const y0 = Actors.y[id];
  stepSeconds(1);
  check('ladder: flag ON_LADDER', (Actors.flags[id] & ACTOR_FLAG.ON_LADDER) !== 0);
  check('ladder climb 3.0 m/s', Test.near(Actors.y[id] - y0, 3, 0.1), Actors.y[id] - y0);
  tapButtons(id, BTN.JUMP);
  check('jump leaves the ladder', Motion.state[id] === MOVE_STATE.WALK && Actors.vz[id] < 0);
});

Test.add('world', (check) => {
  loadTestWorld([], { triggers: [{ kind: 'water', min: [-20, -1, -20], max: [20, 3, 20] }] });
  useTestRules({ move: 'arena' });
  const id = groundedTester(-15, 0);
  Actors.health[id] = Actors.maxHealth[id] = 1000;   // S11 applies the drown requests: 100 HP would drown before the cap is seen
  holdInput(id, 0, 1, 0, 90);
  stepSeconds(2);
  check('water: flag IN_WATER and swim state', (Actors.flags[id] & ACTOR_FLAG.IN_WATER) !== 0 && Motion.state[id] === MOVE_STATE.SWIM);
  check('swim at 50% of ground speed', Test.near(Math.hypot(Actors.vx[id], Actors.vy[id], Actors.vz[id]), 4.5, 0.1), testSpeed(id));
  holdInput(id, 0, 0, BTN.CROUCH);
  const requests = recordEvents(['damage.request'], () => stepSeconds(20));
  const drown = requests.filter((r) => r.kind === 'drown').map((r) => r.amount);
  // The head was already under for the 2 s swim: 22 s in all = 12 s of air + 10 requests.
  check('12 s of air, then drowning 2, 4, 6 ... up to 15 HP/s', drown.length === 10 && drown.join() === '2,4,6,8,10,12,14,15,15,15', drown.join());
  stepSeconds(2);
  check('drowning caps at 15 HP/s', recordEvents(['damage.request'], () => stepSeconds(1)).map((r) => r.amount).join() === '15');
  holdInput(id, 0, 0, BTN.JUMP);
  stepSeconds(3);
  check('surfacing refills the air', World.airLeft(id) === AIR_SECONDS);
});

Test.add('world', (check) => {
  loadTestWorld([], { triggers: [{ kind: 'hazard', min: [-2, 0, -2], max: [2, 1, 2], damage: 10, element: 'thermal' }, { kind: 'killzone', min: [10, 0, -2], max: [14, 1, 2] }] });
  useTestRules({ move: 'arena' });
  const id = spawnTester(0, 0.05, 0);
  const burns = recordEvents(['damage.request'], () => stepSeconds(1.05));
  check('hazard: 10 HP/s as 5 every 0.5 s, the first at once', burns.length === 3 && burns.every((r) => r.kind === 'hazard' && r.amount === 5 && r.element === 'thermal'), burns.length);
  const victim = spawnTester(12, 0.05, 0);
  const kills = recordEvents(['damage.request'], () => Sim.step()).filter((r) => r.target === victim);
  check('killzone: lethal hazard', kills.length === 1 && kills[0].amount >= 1000);
  Actors.remove(victim); Actors.remove(id);
  const faller = spawnTester(40, -40, 40);
  check('falling out of the world is lethal', recordEvents(['damage.request'], () => Sim.step()).some((r) => r.target === faller && r.amount >= 1000));
  check('unknown trigger kind is reported', Test.expectErrors(() => loadTestWorld([], { triggers: [{ kind: 'portal', min: [0, 0, 0], max: [1, 1, 1] }] })) === 1 && World.triggers.length === 0);
  const badRows = [{ kind: 'jumppad', min: [0, 0, 0], max: [1, 1, 1], target: [0, 0, 0], peak: 0 }, { kind: 'hazard', min: [2, 0, 0], max: [1, 1, 1] },
    { kind: 'teleporter', min: [0, 0, 0], max: [1, 1, 1], exit: [1, 2] }, { kind: 'water', min: [0, 0], max: [1, 1, 1] }];
  check('bad trigger rows are logged and skipped', Test.expectErrors(() => loadTestWorld([], { triggers: badRows })) === 4 && World.triggers.length === 0);
  World.clear();
  const floating = spawnTester(0, -500, 0);
  check('empty world: bounds reset and no fall-out damage', !Number.isFinite(World.boundsMin.y) && recordEvents(['damage.request'], () => Sim.step()).length === 0);
  Actors.remove(floating);
});

// A pad whose target is level with it still gives a finite arc (the flight time has a floor).
Test.add('world', (check) => {
  loadTestWorld([], { triggers: [{ kind: 'jumppad', min: [-1, 0, -1], max: [1, 0.3, 1], target: [0.1, 0.05, 0], peak: 0.001 }] });
  useTestRules({ move: 'arena' });
  const id = spawnTester(0, 0.05, 0);
  Sim.step();
  check('flat jump pad: finite velocity and position', [Actors.vx[id], Actors.vy[id], Actors.x[id], Actors.y[id]].every(Number.isFinite));
  Actors.remove(id);
});

// ---- Rigid bodies (step 4.4) ----
function throwBody(shape, x, y, z, vx, vy, vz, mass) {
  Object.assign(Bodies.spec, { shape, kind: BODY_KIND.THROWN, x, y, z, vx, vy, vz, halfX: 0.2, halfY: 0.2, halfZ: 0.2, mass, owner: -1, color: 0x888888 });
  return Bodies.spawn(Bodies.spec);
}

const bodyEnergy = (index) => 0.5 * (Bodies.vx[index] ** 2 + Bodies.vy[index] ** 2 + Bodies.vz[index] ** 2) + GRAVITY * Bodies.y[index];

Test.add('world', (check) => {
  loadTestWorld([{ shape: 'ramp', min: [5, 0, -2], max: [9, 1, 2], dir: '+x' }]);
  const ball = throwBody(BODY_SHAPE.SPHERE, 0, 5, 0, 2, 0, 1, 2), crate = throwBody(BODY_SHAPE.BOX, 7, 4, 0, 0, 3, 0, 4);
  let gained = 0, energy = bodyEnergy(ball);
  for (let i = 0; i < 6 * TICK_RATE; i++) {
    Sim.step();
    const now = bodyEnergy(ball);
    if (now > energy + 1e-3) gained++;
    energy = now;
  }
  check('bodies come to rest and sleep', Bodies.sleeping[ball] === 1 && Bodies.sleeping[crate] === 1);
  check('no energy is ever gained', gained === 0, gained);
  check('ball rests on the floor', Test.near(Bodies.y[ball], 0.2, 0.02), Bodies.y[ball]);
  Bodies.applyImpulse(ball, 10, 0, 0);
  check('impulse by mass: 10 / 2 kg = 5 m/s, wakes the body', Test.near(Bodies.vx[ball], 5, 1e-5) && Bodies.sleeping[ball] === 0);
  const hit = makeHit();
  check('ray hits a sphere body', Bodies.raycast(Bodies.x[ball] - 5, 0.2, Bodies.z[ball], 1, 0, 0, 20, hit) === ball && Test.near(hit.distance, 4.8, 1e-3) && hit.nx < -0.99);
  check('ray hits a box body', Bodies.raycast(Bodies.x[crate], 5, Bodies.z[crate], 0, -1, 0, 20, hit) === crate && hit.ny > 0.99);
  Bodies.clear();
  let made = 0;
  for (let i = 0; i < BODY_CAPACITY + 5; i++) if (throwBody(BODY_SHAPE.SPHERE, i - 10, 3, 10, 0, 0, 0, 1) >= 0) made++;
  check('20 bodies at most', made === BODY_CAPACITY && Bodies.count() === BODY_CAPACITY);
});

Test.add('world', (check) => {
  loadTestWorld();
  const id = groundedTester(5, 0);
  const rock = throwBody(BODY_SHAPE.SPHERE, 0, 1, 0, 30, 0, 0, 100);
  const hits = recordEvents(['damage.request'], () => stepSeconds(0.4)).filter((r) => r.kind === 'crush');
  check('fast heavy body: impact damage clamped to 40', hits.length === 1 && hits[0].target === id && hits[0].amount === BODY_IMPACT_MAX_DAMAGE, hits.length && hits[0].amount);
  check('crush damage comes from the body position', hits.length === 1 && hits[0].x < Actors.x[id]);
  const slowTarget = groundedTester(-5, 10);
  throwBody(BODY_SHAPE.SPHERE, -5, 0.21, 9.4, 0, 0, 5, 100); // rolls through the target at 5 m/s or less
  const slowHits = recordEvents(['damage.request'], () => stepSeconds(0.4)).filter((r) => r.kind === 'crush' && r.target === slowTarget);
  check('impact ignored below 6 m/s', slowHits.length === 0, JSON.stringify(slowHits));
  Bus.emit('explosion', { x: Bodies.x[rock] - 1, y: Bodies.y[rock], z: Bodies.z[rock], radius: 4, owner: -1, source: 'test', element: 'kinetic' });
  check('explosions push bodies away', Bodies.vx[rock] > 0 && Bodies.sleeping[rock] === 0);
});

// ---- Destructible props (MAP-013, PERF-010) ----
function propRow(x, z) { return { min: [x, 0, z], max: [x + 1, 1, z + 1], health: 50, debris: 6, material: 'wood' }; }

Test.add('world', (check) => {
  Settings.set('video.quality', 'potato');
  loadTestWorld([], { props: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18].map((x) => propRow(x, 5)) });
  const hit = makeHit();
  check('every prop is solid whatever the quality', World.dynamic.length === 10 && World.raycast(18.5, 0.5, 0, 0, 0, 1, 20, hit) && hit.brush.prop === 9);
  Props.damage(9, 1000);
  check('props past the quality budget (potato 4) do not break', Props.isStanding(9) && World.dynamic.length === 10);
  Props.damage(0, 1000); Props.damage(1, 1000);
  check('props within the budget break', !Props.isStanding(0) && !Props.isStanding(1) && World.dynamic.length === 8);
  check('live debris capped by quality (potato 4)', Bodies.debrisCount() === 4, Bodies.debrisCount());
  Settings.set('video.quality', 'high');
  Bodies.clear();
  for (let i = 0; i < 6; i++) throwBody(BODY_SHAPE.SPHERE, i, 3, 0, 0, 0, 0, 1);
  Bodies.debrisLimit = 2;
  Object.assign(Bodies.spec, { kind: BODY_KIND.DEBRIS });
  Bodies.spawn(Bodies.spec); Bodies.spawn(Bodies.spec);
  Bodies.remove(0); Bodies.remove(1);
  Bodies.spawn(Bodies.spec); Bodies.spawn(Bodies.spec);
  check('debris cap holds when free slots sit below live debris', Bodies.debrisCount() === 2 && Bodies.count() === 6, Bodies.debrisCount());
  Bodies.debrisLimit = BODY_CAPACITY;
});

Test.add('world', (check) => {
  Settings.set('video.quality', 'high');
  loadTestWorld([], { props: [propRow(0, 5), propRow(-5, 5)] });
  const hit = makeHit();
  check('props block rays and report their index', World.raycast(0.5, 0.5, 0, 0, 0, 1, 20, hit) && hit.brush.prop === 0 && Test.near(hit.z, 5, 1e-4));
  const walker = groundedTester(-4.5, 3);
  holdInput(walker, 0, 1, 0, 0);
  stepSeconds(1);
  check('props block actors', Actors.z[walker] < 5 - ACTOR_RADIUS + 0.01, Actors.z[walker]);
  Props.damage(0, 20);
  check('damage below health keeps the prop', Props.isStanding(0));
  const breaks = recordEvents(['world.break'], () => Props.damage(0, 40));
  check('breaks at 0 health with world.break { prop, material }', breaks.length === 1 && breaks[0].prop === 0 && breaks[0].material === 'wood' && !Props.isStanding(0));
  const debris = Bodies.count();
  check('breaks into 4-8 debris bodies', debris >= DEBRIS_MIN_PIECES && debris <= DEBRIS_MAX_PIECES, debris);
  check('rays pass where the prop was', !World.raycast(0.5, 0.5, 0, 0, 0, 1, 20, hit));
  stepSeconds(1.05);
  check('debris sleeps after 1 s', Bodies.active.every((on, i) => !on || Bodies.sleeping[i] === 1));
  stepSeconds(3);
  check('debris is gone after lingering', Bodies.count() === 0);
  Bus.emit('explosion', { x: -4.5, y: 0.5, z: 4, radius: 3, owner: -1, source: 'test', element: 'kinetic' });
  check('explosions break props', !Props.isStanding(1));
});

// ---- Actor hit volumes and area queries (DATA-003, ARC-014) ----
Test.add('world', (check) => {
  Actors.clear();
  loadTestWorld([]);
  const target = groundedTester(0, 5);
  const shooter = groundedTester(0, 0);
  const hit = makeActorHit(), found = [];
  const headY = Actors.eye[target] + HEAD_ABOVE_EYE;
  check('head ray hits the head sphere', World.raycastActors(0, headY, 0, 0, 0, 1, 50, shooter, hit) === target && hit.zone === 'head' && Test.near(hit.distance, 5 - HEAD_RADIUS, 1e-3), hit.zone + ' ' + hit.distance);
  check('chest ray hits the body', World.raycastActors(0, 1.2, 0, 0, 0, 1, 50, shooter, hit) === target && hit.zone === 'body' && Test.near(hit.distance, 5 - TORSO_RADIUS, 1e-3), hit.zone);
  check('knee ray hits the legs', World.raycastActors(0, 0.4, 0, 0, 0, 1, 50, shooter, hit) === target && hit.zone === 'legs' && Test.near(hit.distance, 5 - LEGS_RADIUS, 1e-3), hit.zone);
  check('rays beside or too short miss', World.raycastActors(0.5, 1.2, 0, 0, 0, 1, 50, shooter, hit) < 0 && World.raycastActors(0, 1.2, 0, 0, 0, 1, 4, shooter, hit) < 0);
  check('a vertical ray reaches the head from above', World.raycastActors(0, 5, 5, 0, -1, 0, 10, -1, hit) === target && hit.zone === 'head', hit.zone);
  check('the ignored actor is skipped', World.raycastActors(0, 1.2, -1, 0, 0, 1, 50, -1, hit) === shooter && World.raycastActors(0, 1.2, -1, 0, 0, 1, 50, shooter, hit) === target);
  check('sphere query finds touching actors only', World.actorsInSphere(0, 1, 4.5, 0.2, found) === 1 && found[0] === target && World.actorsInSphere(0, 1, 3, 0.5, found) === 0);
  check('cone query respects angle and range', World.actorsInCone(0, 1, 0, 0, 0, 1, Math.cos(0.2), 10, shooter, found) === 1 && found[0] === target
    && World.actorsInCone(0, 1, 0, 0, 0, 1, Math.cos(0.2), 3, shooter, found) === 0 && World.actorsInCone(0, 1, 0, 1, 0, 0, Math.cos(0.2), 10, shooter, found) === 0);
  Actors.alive[target] = 0;
  check('dead actors are not hit', World.raycastActors(0, 1.2, 0, 0, 0, 1, 50, shooter, hit) < 0 && World.actorsInSphere(0, 1, 4.5, 0.2, found) === 0);
});

// Hooks S08 fills for earlier sections at load (integration: without them the world is not drawn and walls never muffle sound).
Test.add('world', (check) => {
  loadTestWorld([{ shape: 'box', min: [-1, 0, 4], max: [1, 3, 5] }]);
  check('Render.worldQuery is the world (S07 bakes its brushes)', Render.worldQuery === World && Render.worldQuery.brushes.length === 2);
  check('Sound.lineOfSight follows World.lineClear', !Sound.lineOfSight(0, 1.6, 0, 0, 1.6, 10) && Sound.lineOfSight(0, 1.6, 0, 10, 1.6, 0));
});
