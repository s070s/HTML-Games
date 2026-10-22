// Self-tests for S10 movement (group 'move'): MOV-026 per preset, frame-rate independence, every mechanic on test geometry.
// The helpers here (test worlds, test actors, stepping) are shared with 20b-test-world.js.


function loadTestWorld(brushes, extra) {
  World.load(Object.assign({ id: 'test', brushes: [TEST_FLOOR].concat(brushes || []) }, extra || {}));
}

// A hand-made match record so presets and rule scales can be chosen without starting a real match.
function useTestRules(rules) {
  Game.match = { setup: {}, rules: Object.assign({ move: 'arena', gravityScale: 1, knockback: 1, mutators: [] }, rules), map: null, ended: false, winner: null, startTick: 0 };
}

function spawnTester(x, y, z, presetId, team) {
  const id = Actors.create(ACTOR_KIND.DUMMY, team === undefined ? 0 : team, 'tester');
  Actors.alive[id] = 1; Actors.health[id] = Actors.maxHealth[id] = 100;
  Actors.x[id] = x; Actors.y[id] = y; Actors.z[id] = z;
  Move.setPreset(id, presetId || null);
  resetMotion(id);
  return id;
}

// Spawns on the floor and steps until the tester is grounded.
function groundedTester(x, z, presetId, team) {
  const id = spawnTester(x, 0.05, z, presetId, team);
  Sim.run(12);
  return id;
}

const stepSeconds = (seconds) => Sim.run(Math.round(seconds * TICK_RATE));

function holdInput(id, moveX, moveZ, buttons, yawDegrees) {
  Actors.moveX[id] = moveX; Actors.moveZ[id] = moveZ; Actors.buttons[id] = buttons || 0;
  if (yawDegrees !== undefined) Actors.aimYaw[id] = yawDegrees * DEG;
}

// Presses buttons for one step, then releases them.
function tapButtons(id, buttons) {
  Actors.buttons[id] |= buttons;
  Sim.step();
  Actors.buttons[id] &= ~buttons;
}

// Collects payload copies of the given events while run() executes.
function recordEvents(types, run) {
  const seen = [];
  const handlers = types.map((type) => Bus.on(type, (payload) => seen.push(Object.assign({ type }, payload))));
  try { run(); } finally { types.forEach((type, index) => Bus.off(type, handlers[index])); }
  return seen;
}

function highestPoint(id, seconds) {
  let top = Actors.y[id];
  for (let i = 0; i < Math.round(seconds * TICK_RATE); i++) { Sim.step(); top = Math.max(top, Actors.y[id]); }
  return top;
}

const testSpeed = (id) => Move.horizontalSpeed(id);

DebugApi.movement = {
  preset: (id) => Move.preset(id).id,
  setPreset: (id, presetId) => Move.setPreset(id, presetId),
  state: (id) => Move.stateName(id),
  inaccuracy: (id) => Move.inaccuracy(id),
};

// ---- Presets and MOV-026 ----
Test.add('move', (check) => {
  check('8 movement presets MV01..MV08', CAT.movement.length === 8 && CAT.movement.map((row) => row.code).join() === 'MV01,MV02,MV03,MV04,MV05,MV06,MV07,MV08');
  for (const row of CAT.movement) check(row.id + ': table jumpHeight = jumpVel^2/2g within 2%', Test.near(row.jumpVel ** 2 / (2 * row.gravity), row.jumpHeight, row.jumpHeight * 0.02));
  useTestRules({});
  check('no rules preset falls back to arena', Move.preset(0).id === 'arena');
  useTestRules({ move: 'tactical' });
  check('preset from Game.match.rules.move', Move.preset(0).id === 'tactical');
});

Test.add('move', (check) => {
  loadTestWorld();
  for (const row of CAT.movement) {
    useTestRules({ move: row.id });
    const id = groundedTester(0, 0);
    const startY = Actors.y[id];
    tapButtons(id, BTN.JUMP);
    const height = highestPoint(id, 1.5) - startY, expected = row.jumpVel ** 2 / (2 * row.gravity);
    check(row.id + ': jump height within 2% (MOV-026)', Test.near(height, expected, expected * 0.02), height.toFixed(3) + ' vs ' + expected.toFixed(3));
    Actors.remove(id);
    const runner = groundedTester(-40, -40);
    holdInput(runner, 0, 1, 0, 45);
    stepSeconds(3);
    check(row.id + ': steady ground speed within 1% (MOV-026)', Test.near(testSpeed(runner), row.groundSpeed, row.groundSpeed * 0.01), testSpeed(runner));
    Actors.remove(runner);
  }
});

// Same per-tick input at 30/60/120/144 Hz frame rates must give identical results (MOV-010, sim fixed at 120 Hz).
Test.add('move', (check) => {
  loadTestWorld([{ shape: 'box', min: [3, 0, -2], max: [4, 2, 6] }, { shape: 'ramp', min: [-6, 0, 2], max: [-2, 1, 6], dir: '+z' }]);
  const results = [30, 60, 120, 144].map((rate) => runScripted(rate));
  check('identical results at 30/60/120/144 Hz', results.every((result) => result === results[0]), results.join(' | '));
});

function runScripted(frameRate) {
  Actors.clear(); Sim.reset(); Loop.accumulator = 0;
  const id = spawnTester(0, 0.05, 0, 'arena');
  let snapshot = '';
  const script = { name: 'test-script', order: 10, step: () => {
    const tick = Sim.tick;
    holdInput(id, tick % 90 < 45 ? 1 : -0.5, 1, tick % 60 === 5 ? BTN.JUMP : 0, tick * 0.7);
    if (tick === 239) snapshot = [Actors.x[id], Actors.y[id], Actors.z[id], Actors.vx[id], Actors.vy[id]].map((v) => v.toFixed(5)).join();
  } };
  Sim.systems.push(script); Sim.systems.sort((a, b) => a.order - b.order);
  try { while (Sim.tick < 240) Loop.advance(1 / frameRate); } finally { Sim.systems.splice(Sim.systems.indexOf(script), 1); }
  return snapshot;
}

// ---- Jumping rules (MOV-013, MOV-014, MOV-024) ----
Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'arena' });
  const id = groundedTester(0, 0);
  Actors.buttons[id] = BTN.JUMP;
  stepSeconds(1.5);
  const jumps = recordEvents(['move.jump'], () => stepSeconds(1.5));
  check('no auto-repeat jump while held', jumps.length === 0);
  Actors.buttons[id] = 0;
  useTestRules({ move: 'arena', mutators: ['autohop'] });
  holdInput(id, 0, 0, BTN.JUMP);
  check('autohop mutator repeats while held', recordEvents(['move.jump'], () => stepSeconds(1.5)).length >= 2);
  holdInput(id, 0, 0, 0);
  useTestRules({ move: 'arena' });
  stepSeconds(1);
  check('jump buffered 0.08 s before landing', bufferedJump(id, 0.08));
  check('jump pressed 0.15 s before landing is dropped', !bufferedJump(id, 0.15));
});

// Drops from 3 m and presses jump `early` seconds before touching down; true when the landing turns into a jump.
function bufferedJump(id, early) {
  stepSeconds(1);
  Actors.y[id] = 3; Actors.vy[id] = 0; Motion.grounded[id] = 0;
  const fallTime = Math.sqrt(2 * 3 / Move.gravity(id));
  stepSeconds(fallTime - early);
  tapButtons(id, BTN.JUMP);
  return recordEvents(['move.jump'], () => stepSeconds(early + 0.1)).length === 1;
}

Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'tactical' });
  const id = groundedTester(0, 0);
  Actors.y[id] = 2; Motion.grounded[id] = 0; Actors.vy[id] = -15.5; // lands at about 17.9 m/s
  const damage = recordEvents(['damage.request'], () => { while (!Motion.grounded[id]) Sim.step(); });
  check('hard landing locks jumping 0.25 s (MOV-014)', getClock(id, CLOCK.JUMP_LOCK) > 0.2);
  const lockedJumps = recordEvents(['move.jump'], () => tapButtons(id, BTN.JUMP));
  check('locked jump does not fire', lockedJumps.length === 0 && Actors.vy[id] < 1 && Motion.grounded[id] === 1, Actors.vy[id]);
  const preset = Move.preset(id), impact = damage.length ? damage[0] : null;
  check('fall damage kind fall', impact && impact.kind === 'fall' && impact.target === id);
  check('fall damage follows the MOV-015 curve', impact && Test.near(impact.amount, fallDamage(preset, Math.sqrt(15.5 ** 2 + 2 * 20 * 2)), 1.5), impact && impact.amount);
  check('MOV-015 curve: 12.6 safe, 22 lethal', fallDamage(preset, 12.6) === 0 && Test.near(fallDamage(preset, 22), 100, 1e-6) && Test.near(fallDamage(preset, 17.3), 25, 0.01));
  const arena = CAT.movement.byId('arena');
  check('arena fall steps: >17 5 HP, >21 10 HP', fallDamage(arena, 16.9) === 0 && fallDamage(arena, 17.5) === 5 && fallDamage(arena, 22) === 10);
  check('agile has no fall damage', fallDamage(CAT.movement.byId('agile'), 40) === 0);
  stepSeconds(0.3);
  Actors.vx[id] = 10; Actors.y[id] = 1; Motion.grounded[id] = 0;
  while (!Motion.grounded[id]) Sim.step();
  check('bhopCap clamps landing speed to 1.2 x 6.0', Test.near(testSpeed(id), 7.2, 0.15), testSpeed(id));
  check('landingPenalty slows for 0.2 s', getClock(id, CLOCK.LAND_SLOW) > 0.15 && Test.near(groundWishSpeed(id, preset), 6 * 0.7, 1e-4));
});

Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'agile' });
  const id = groundedTester(0, 0);
  tapButtons(id, BTN.JUMP);
  stepSeconds(0.2);
  tapButtons(id, BTN.JUMP);
  check('double jump sets extraJumpVel 6.0', Test.near(Actors.vy[id], 6.0, 0.25), Actors.vy[id]);
  stepSeconds(0.1);
  const before = Actors.vy[id];
  tapButtons(id, BTN.JUMP);
  check('only one extra jump in the air', Actors.vy[id] < before);
  while (!Motion.grounded[id]) Sim.step();
  check('extra jump refills on the first grounded step (MOV-024)', Motion.jumpsLeft[id] === 1);
  useTestRules({ move: 'arena', moveOverrides: { extraJumps: 1, extraJumpVel: 8.1 } });
  check('ruleset moveOverrides give arena a double jump (RS02)', Move.preset(id).extraJumps === 1 && Move.preset(id).id === 'arena');
});

// X25 autohop repeats ground jumps only: a held jump never spends the extra jump, wall jumps or mantles.
Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'agile', mutators: ['autohop'] });
  const id = groundedTester(0, 0);
  holdInput(id, 0, 0, BTN.JUMP);
  const quick = recordEvents(['move.jump'], () => stepSeconds(0.05));
  check('autohop + agile: holding jump 0.05 s is one jump', quick.length === 1 && Motion.jumpsLeft[id] === 1, quick.length + ' jumps');
  stepSeconds(0.5);
  check('autohop: no double jump while held in the air', Motion.jumpsLeft[id] === 1 && Motion.grounded[id] === 0);
  const hops = recordEvents(['move.jump'], () => stepSeconds(2));
  check('autohop: still hops again on every landing', hops.length >= 2 && hops.length <= 3, hops.length);
});

// ---- Air control: strafe-jump gain and the assist (MOV-012, MOV-018) ----
Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'arena' });
  const id = spawnTester(0, 200, -50);
  Actors.vz[id] = 9;
  holdInput(id, 1, 1, 0, 0);
  strafeInAir(id, 2);
  check('strafe-jumping gains speed beyond ground speed', testSpeed(id) > 9 * 1.2, testSpeed(id));
  const preset = Move.preset(id);
  Game.playerId = id;
  Settings.set('gameplay.airAssist', 'off');
  check('assist off for the player by setting', !airAssistOn(id, preset));
  Settings.set('gameplay.airAssist', 'on');
  check('assist on by setting', airAssistOn(id, preset));
  check('assist adds airAccel +2', airGain(id) > 0 && Test.near(airGain(id) / airGainWithout(id), (preset.airAccel + 2) / preset.airAccel, 0.01));
  Settings.set('gameplay.airAssist', 'auto');
  Input.device = 'touch';
  check('auto: on for touch in arena', airAssistOn(id, preset));
  Input.device = 'kbm';
  check('auto: off for keyboard', !airAssistOn(id, preset));
  Game.playerId = -1;
  check('bots get no assist', !airAssistOn(id, preset));
});

// Turns the view each step so forward+right wishes at the angle of best gain (a skilled strafe-jumper's input).
function strafeInAir(id, seconds) {
  const preset = Move.preset(id), add = preset.airAccel * preset.airWishCap * TICK_SECONDS;
  for (let i = 0; i < Math.round(seconds * TICK_RATE); i++) {
    const best = Math.acos(clamp((preset.airWishCap - add) / Math.max(testSpeed(id), 1e-3), -1, 1));
    Actors.aimYaw[id] = Math.atan2(Actors.vx[id], Actors.vz[id]) - best + 45 * DEG; // forward+right wishes 45 deg right of the view
    Sim.step();
  }
}

// Speed gained in one air step from rest when strafing (the assist changes airAccel only).
function airGain(id) {
  Actors.vx[id] = Actors.vz[id] = 0; Motion.grounded[id] = 0;
  Motion.inputX[id] = 1; Motion.inputZ[id] = 0; Actors.yaw[id] = 0;
  walkAir(id, Move.preset(id), TICK_SECONDS);
  return testSpeed(id);
}

function airGainWithout(id) {
  Settings.set('gameplay.airAssist', 'off');
  const gain = airGain(id);
  Settings.set('gameplay.airAssist', 'on');
  return gain;
}

// ---- Stance (MOV-016), walk, tactical accuracy (MOV-025) ----
Test.add('move', (check) => {
  loadTestWorld([{ shape: 'box', min: [-2, 1.3, 2], max: [2, 2, 6] }]);
  useTestRules({ move: 'tactical' });
  const id = groundedTester(0, 0);
  holdInput(id, 0, 0, BTN.CROUCH);
  stepSeconds(0.5);
  check('crouch height 1.10 and eye 0.95', Test.near(Actors.height[id], 1.1, 1e-6) && Test.near(Actors.eye[id], 0.95, 1e-4) && (Actors.flags[id] & ACTOR_FLAG.CROUCHED));
  holdInput(id, 0, 1, BTN.CROUCH, 0);
  stepSeconds(4);
  check('crouch speed = 0.34 x 6.0', Test.near(testSpeed(id), 6 * 0.34, 0.02), testSpeed(id));
  check('crouched under a 1.3 m ceiling', Actors.z[id] > 3);
  holdInput(id, 0, 0, 0);
  stepSeconds(0.3);
  check('cannot stand up without headroom', Motion.stance[id] === STANCE.CROUCH);
  holdInput(id, 0, -1, 0);
  stepSeconds(4);
  check('stands once there is room', Motion.stance[id] === STANCE.STAND && Test.near(Actors.height[id], 1.8, 1e-6));
  holdInput(id, 0, 1, BTN.WALK, 180);
  stepSeconds(2);
  check('walk speed = 0.52 x 6.0', Test.near(testSpeed(id), 3.12, 0.03), testSpeed(id));
});

// INP-003: Tactical has no sprint, so Shift (the sprint button) walks: walk speed, walk accuracy, no footsteps.
Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'tactical' });
  const id = groundedTester(-40, 0);
  holdInput(id, -1, 0, BTN.SPRINT, 0);
  stepSeconds(2);
  check('tactical: sprint walks at 0.52 x 6.0', Test.near(testSpeed(id), 3.12, 0.03), testSpeed(id));
  check('tactical: walking on sprint keeps the walk accuracy', Move.inaccuracy(id) === Move.preset(id).inaccuracy.walk);
  check('tactical: walking on sprint is silent', recordEvents(['move.step'], () => stepSeconds(1)).length === 0);
  check('tactical: the touch stick does not press sprint there', !TouchInput.stickSprints());
  useTestRules({ move: 'arena' });
  holdInput(id, -1, 0, BTN.SPRINT, 0);
  stepSeconds(2);
  check('arena: the sprint button never walks', testSpeed(id) > Move.preset(id).groundSpeed * 0.95 && TouchInput.stickSprints(), testSpeed(id));
});

Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'tactical' });
  const id = groundedTester(-40, 0);
  const table = Move.preset(id).inaccuracy;
  stepSeconds(0.4);
  check('standing still: no movement inaccuracy', Move.inaccuracy(id) === 0);
  holdInput(id, 1, 0, 0, 0);
  stepSeconds(2);
  check('running: +5.0 deg', Move.inaccuracy(id) === table.run);
  holdInput(id, -1, 0, 0);
  let ticks = 0;
  while (testSpeed(id) / 6 > 0.34 && ticks < 60) { Sim.step(); ticks++; }
  check('counter-strafe brings f <= 0.34 within 0.08 s', ticks * TICK_SECONDS <= 0.08, ticks * TICK_SECONDS);
  check('slow (f <= 0.34): +1.1 deg', Move.inaccuracy(id) === table.walk);
  holdInput(id, 1, 0, BTN.CROUCH);
  stepSeconds(1);
  check('crouch-moving: +0.8 deg', Move.inaccuracy(id) === table.crouch);
  holdInput(id, 0, 0, 0);
  stepSeconds(1);
  tapButtons(id, BTN.JUMP);
  check('airborne: +10 deg', Move.inaccuracy(id) === table.air);
  while (!Motion.grounded[id]) Sim.step();
  stepSeconds(0.05);
  holdInput(id, 0, 0, 0);
  const landed = Move.inaccuracy(id);
  stepSeconds(0.3);
  check('landing adds up to +3 decaying over 0.3 s', landed > 2 && landed <= 3 && Move.inaccuracy(id) < 0.1, landed);
  check('presets without a table report 0', CAT.movement.byId('arena').inaccuracy === null);
});

// ---- Sprint, stamina, tactical sprint, sprint-to-fire (MOV-021, MV03) ----
Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'modern' });
  const id = groundedTester(-55, -55);
  holdInput(id, 0, 1, BTN.SPRINT, 45);
  stepSeconds(1.5);
  check('sprint 6.4 m/s', Test.near(testSpeed(id), 6.4, 0.07) && (Actors.flags[id] & ACTOR_FLAG.SPRINTING), testSpeed(id));
  stepSeconds(3.6);
  check('stamina runs out after 5 s', Motion.sprinting[id] === 0 && Motion.stamina[id] === 0);
  holdInput(id, 0, 1, 0);
  stepSeconds(0.9);
  check('stamina waits 1 s before regenerating', Motion.stamina[id] === 0);
  stepSeconds(2.2);
  check('stamina full 2 s later', Test.near(Motion.stamina[id], 5, 1e-3), Motion.stamina[id]);
  holdInput(id, 0, 1, BTN.SPRINT);
  stepSeconds(0.5);
  holdInput(id, 0, 1, BTN.SPRINT | BTN.FIRE);
  Sim.step();
  check('firing stops sprint', Motion.sprinting[id] === 0 && !Move.canFire(id));
  stepSeconds(0.15);
  check('sprintToFire 0.20 s blocks firing', !Move.canFire(id));
  stepSeconds(0.06);
  check('can fire after sprintToFire', Move.canFire(id));
  Weapons.setLoadout(id, ['tempest']);
  holdInput(id, 0, 1, BTN.SPRINT);
  stepSeconds(0.5);
  holdInput(id, 0, 1, BTN.SPRINT | BTN.FIRE);
  Sim.step();
  const ready = CAT.weapons.byId('tempest').readyTime;
  stepSeconds(0.21);
  check('MOV-021 the held weapon adds its readyTime to sprintToFire', ready > 0 && !Move.canFire(id), ready);
  stepSeconds(ready);
  check('can fire after sprintToFire + readyTime', Move.canFire(id));
});

Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'modern' });
  const id = groundedTester(-55, -55);
  holdInput(id, 0, 1, BTN.SPRINT, 45);
  stepSeconds(1);
  holdInput(id, 0, 1, 0); Sim.step(); holdInput(id, 0, 1, BTN.SPRINT); Sim.step(); holdInput(id, 0, 1, 0); Sim.step();
  holdInput(id, 0, 1, BTN.SPRINT);
  stepSeconds(1);
  check('double-tap sprint: tactical sprint 7.6 m/s', Test.near(testSpeed(id), 7.6, 0.08) && Motion.tacCharges[id] === 0, testSpeed(id));
  stepSeconds(1.6);
  check('tactical sprint lasts 2.5 s', Test.near(testSpeed(id), 6.4, 0.1), testSpeed(id));
  check('one charge, recharging over 8 s', Motion.tacCharges[id] === 0 && Motion.tacRecharge[id] > 2);
  stepSeconds(6);
  check('charge back after 8 s', Motion.tacCharges[id] === 1);
});

// ---- Slide (MV03 modern; MV04 agile boost and slide-hop) ----
Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'modern' });
  const id = groundedTester(-55, -55);
  holdInput(id, 0, 1, BTN.SPRINT, 45);
  stepSeconds(1);
  const events = recordEvents(['move.slide'], () => { holdInput(id, 0, 1, BTN.SPRINT | BTN.CROUCH); Sim.step(); });
  check('crouch while sprinting starts a slide with boost 8.0', events.length === 1 && Test.near(events[0].speed, 8, 0.01) && (Actors.flags[id] & ACTOR_FLAG.SLIDING));
  let ticks = 1;
  while (Motion.sliding[id] && ticks < 240) { Sim.step(); ticks++; }
  check('slide lasts 0.7 s', Test.near(ticks * TICK_SECONDS, 0.7, 0.02), ticks * TICK_SECONDS);
  check('slide cooldown 0.6 s', Test.near(getClock(id, CLOCK.SLIDE_COOLDOWN), 0.6, 0.02));
  holdInput(id, 0, 1, BTN.SPRINT); stepSeconds(0.3);
  holdInput(id, 0, 1, BTN.SPRINT | BTN.CROUCH); Sim.step();
  check('no slide during the cooldown', !Motion.sliding[id]);
});

Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'agile' });
  const id = groundedTester(-55, -55);
  holdInput(id, 0, 1, BTN.SPRINT, 45);
  stepSeconds(1.5);
  holdInput(id, 0, 1, BTN.CROUCH); Sim.step();
  check('agile slide adds +1.5 m/s', Test.near(testSpeed(id), 7.6 + 1.5, 0.15), testSpeed(id));
  tapButtons(id, BTN.JUMP);
  holdInput(id, 0, 1, BTN.CROUCH);
  while (!Motion.grounded[id]) Sim.step();
  check('slide-hop: landing with crouch slides again at once', Motion.sliding[id] === 1);
  check('the +1.5 boost waits 1.2 s', testSpeed(id) < 7.6 + 3);
  check('slide-hop keeps momentum', testSpeed(id) > 7.6, testSpeed(id));
});

Test.add('move', (check) => {
  loadTestWorld([{ shape: 'box', min: [-2, 0.75, 3], max: [2, 2, 6] }]);
  useTestRules({ move: 'modern' });
  const id = groundedTester(0, 0);
  tapButtons(id, BTN.PRONE);
  stepSeconds(0.5);
  check('prone height 0.60, eye 0.40', Test.near(Actors.height[id], 0.6, 1e-6) && Test.near(Actors.eye[id], 0.4, 1e-4) && (Actors.flags[id] & ACTOR_FLAG.PRONE));
  holdInput(id, 0, 1, 0, 0);
  stepSeconds(4);
  check('prone speed 0.25 x 4.8', Test.near(testSpeed(id), 1.2, 0.02), testSpeed(id));
  tapButtons(id, BTN.PRONE);
  stepSeconds(0.2);
  check('cannot leave prone under a 0.75 m ceiling', Motion.stance[id] === STANCE.PRONE);
  const arena = groundedTester(20, 0, 'arena');
  tapButtons(arena, BTN.PRONE);
  check('arena has no prone', Motion.stance[arena] === STANCE.STAND);
});

// ---- Dodge (MV01), dash (MV05), shield charge (MV06) ----
Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'arena' });
  const id = groundedTester(0, 0);
  holdInput(id, 0, 0, 0, 0);
  const events = recordEvents(['move.dash'], () => doubleTapRight(id));
  check('double-tap right dodges 9.5 m/s + 4.0 up', events.length === 1 && Test.near(testSpeed(id), 9.5, 0.3) && Actors.vy[id] > 3, testSpeed(id) + ' / ' + Actors.vy[id]);
  check('dodge goes to the right (-X at yaw 0)', Actors.vx[id] < -9);
  stepSeconds(0.1);
  check('dodge cooldown 0.7 s', recordEvents(['move.dash'], () => doubleTapRight(id)).length === 0);
});

function doubleTapRight(id) {
  holdInput(id, 1, 0, 0); Sim.step(); holdInput(id, 0, 0, 0); stepSeconds(0.08); holdInput(id, 1, 0, 0); Sim.step(); holdInput(id, 0, 0, 0);
}

Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'ravager' });
  const id = groundedTester(0, 0);
  holdInput(id, 0, 0, 0, 0);
  const startZ = Actors.z[id];
  tapButtons(id, BTN.SPRINT);
  stepSeconds(0.15);
  check('dash 7.5 m in 0.15 s', Test.near(Actors.z[id] - startZ, 7.5, 0.15), Actors.z[id] - startZ);
  check('dash uses a charge (2 total)', Move.dashCharges(id) === 1);
  tapButtons(id, BTN.SPRINT); stepSeconds(0.2);
  check('second charge', Move.dashCharges(id) === 0);
  tapButtons(id, BTN.SPRINT);
  check('no charge left: no dash', Motion.state[id] !== MOVE_STATE.DASH);
  Actors.y[id] = 40; Motion.grounded[id] = 0; Actors.vy[id] = 0;
  const inAir = Motion.dashCharges[id];
  stepSeconds(1.3);
  check('charges recharge on the ground only', Motion.dashCharges[id] === inAir);
  Actors.y[id] = 0.05; Actors.vy[id] = 0;
  stepSeconds(1.3);
  check('1.2 s per charge on the ground', Move.dashCharges(id) >= 1);
});

Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'knight' });
  const id = groundedTester(0, 0, null, 1);
  const enemy = groundedTester(4, 10, null, 2);
  holdInput(id, 0, 0, 0, 0);
  tapButtons(id, BTN.SPRINT);
  check('shield charge locks onto the enemy in the aim cone', Motion.target[id] === enemy && Motion.state[id] === MOVE_STATE.CHARGE);
  stepSeconds(0.5);
  check('charge stops at the target', Math.hypot(Actors.x[enemy] - Actors.x[id], Actors.z[enemy] - Actors.z[id]) < 1.6 && Motion.state[id] === MOVE_STATE.WALK);
  check('charge cooldown 4 s', getClock(id, CLOCK.CHARGE_COOLDOWN) > 3.4);
  Actors.remove(enemy);
  stepSeconds(4);
  const startZ = Actors.z[id];
  Actors.aimYaw[id] = 0;
  tapButtons(id, BTN.SPRINT);
  stepSeconds(0.6);
  check('charge without a target runs 12 m', Test.near(Actors.z[id] - startZ, 12, 1.0), Actors.z[id] - startZ);
});

// ---- Walls: mantle (MOV-022), climb, wall-run (MOV-023), latch ----
Test.add('move', (check) => {
  loadTestWorld([{ shape: 'box', min: [-3, 0, 2], max: [3, 1.5, 6] }, { shape: 'box', min: [10, 0, 2], max: [16, 2.5, 6] }]);
  useTestRules({ move: 'modern' });
  const id = groundedTester(0, 0);
  holdInput(id, 0, 1, 0, 0);
  let ticks = 0;
  const events = recordEvents(['move.mantle'], () => { while (Motion.state[id] !== MOVE_STATE.MANTLE && ticks++ < 120) Sim.step(); });
  check('walking into a 1.5 m ledge mantles (modern 2.2 m)', events.length === 1 && Motion.state[id] === MOVE_STATE.MANTLE);
  stepSeconds(0.1);
  check('weapon lowered while mantling', Motion.state[id] === MOVE_STATE.MANTLE && !Move.canFire(id));
  stepSeconds(0.5);
  check('ends standing on the ledge', Test.near(Actors.y[id], 1.5, 0.05) && Motion.grounded[id] === 1, Actors.y[id]);
  const tall = groundedTester(13, 0);
  holdInput(tall, 0, 1, 0, 0);
  check('2.5 m wall is above the mantle height', recordEvents(['move.mantle'], () => stepSeconds(1)).length === 0);
  useTestRules({ move: 'arena' });
  const arena = groundedTester(-1, -1);
  holdInput(arena, 0, 1, 0, 0);
  check('arena does not mantle', recordEvents(['move.mantle'], () => stepSeconds(1)).length === 0);
});

// Water exit: in every preset (with or without mantle) a swimmer climbs out over a rim level with the surface or a
// little above it. The pool is 2 m deep; the rim is the top of the block in front.
Test.add('move', (check) => {
  for (const rim of [2, 2.5]) {
    loadTestWorld([{ shape: 'box', min: [-10, 0, 5], max: [10, rim, 20] }], { triggers: [{ kind: 'water', min: [-10, 0, -10], max: [10, 2, 5] }] });
    for (const row of CAT.movement) {
      useTestRules({ move: row.id });
      const id = spawnTester(0, 0.05, 0);
      holdInput(id, 0, 1, BTN.JUMP, 0);
      for (let i = 0; i < 10 * TICK_RATE && !(Motion.grounded[id] && Actors.z[id] > 5); i++) Sim.step();
      check(row.id + ': swims out over a rim ' + (rim - 2) + ' m above the surface', Motion.grounded[id] === 1 && Actors.z[id] > 5 && Test.near(Actors.y[id], rim, 0.05),
        Move.stateName(id) + ' at ' + Actors.y[id].toFixed(2) + ',' + Actors.z[id].toFixed(2));
      Actors.remove(id);
    }
  }
});

Test.add('move', (check) => {
  loadTestWorld([{ shape: 'box', min: [-3, 0, 2], max: [3, 5, 6], material: 'grip' },{ shape: 'box', min: [10, 0, 2], max: [16, 5, 6] }]);
  useTestRules({ move: 'ravager' });
  const id = groundedTester(0, 0);
  holdInput(id, 0, 1, 0, 0);
  tapButtons(id, BTN.JUMP);
  const top = highestPoint(id, 2.5);
  check('ravager climbs a grip wall and mantles over (6 m)', top > 4.9, top);
  check('the grip material exists for MV05 climb walls', CAT.materials.byId('grip') !== undefined && CAT.materials.byId('grip') !== null);
  const plain = groundedTester(13, 0);
  holdInput(plain, 0, 1, 0, 0);
  tapButtons(plain, BTN.JUMP);
  stepSeconds(2.5);
  check('no climbing on plain walls', Actors.y[plain] < 1, Actors.y[plain]);
});

Test.add('move', (check) => {
  loadTestWorld([{ shape: 'box', min: [-1.5, 0, -20], max: [-1, 8, 40] }]);
  useTestRules({ move: 'agile' });
  const id = groundedTester(-0.5, -15);
  holdInput(id, 0, 1, BTN.SPRINT, 0);
  stepSeconds(1.2);
  tapButtons(id, BTN.JUMP);
  holdInput(id, 0, 1, 0);
  const events = recordEvents(['move.wallrun'], () => stepSeconds(0.3));
  check('wall-run starts on a side wall', events.length === 1 && (Actors.flags[id] & ACTOR_FLAG.WALL_RUN));
  check('wall-run speed 9.5', Test.near(testSpeed(id), 9.5, 0.1), testSpeed(id));
  const vyBefore = Actors.vy[id]; Sim.step();
  check('wall-run gravity x0.25', Test.near(vyBefore - Actors.vy[id], 16 * 0.25 * TICK_SECONDS, 1e-3), vyBefore - Actors.vy[id]);
  tapButtons(id, BTN.JUMP);
  check('jump-out 6.5 off the wall + 5.0 up', Motion.state[id] === MOVE_STATE.WALK && Test.near(Actors.vy[id], 5, 0.25) && Actors.vx[id] > 5.5, Actors.vx[id] + ' / ' + Actors.vy[id]);
  holdInput(id, -1, 1, 0, 0);
  stepSeconds(0.2); holdInput(id, 0, 1, 0, 0);
  check('same wall not re-runnable before landing', recordEvents(['move.wallrun'], () => stepSeconds(0.5)).length === 0);
  while (!Motion.grounded[id]) Sim.step();
  const runner = groundedTester(-0.5, -15);
  holdInput(runner, 0, 1, BTN.SPRINT, 0); stepSeconds(1.2);
  tapButtons(runner, BTN.JUMP); holdInput(runner, 0, 1, 0);
  stepSeconds(2.2);
  check('wall-run ends after 1.75 s', Motion.state[runner] !== MOVE_STATE.WALL_RUN);
});

Test.add('move', (check) => {
  loadTestWorld([{ shape: 'box', min: [-3, 0, 2], max: [3, 8, 6] }]);
  useTestRules({ move: 'parkour' });
  const id = groundedTester(0, 1.4);
  tapButtons(id, BTN.JUMP);
  stepSeconds(0.2);
  tapButtons(id, BTN.ALT);
  Actors.buttons[id] = BTN.ALT;
  stepSeconds(3);
  check('wall latch holds still next to a wall', Motion.state[id] === MOVE_STATE.LATCH && testSpeed(id) === 0 && Actors.vy[id] === 0);
  stepSeconds(3.2);
  check('wall latch lasts 6 s', Motion.state[id] === MOVE_STATE.WALK);
  while (!Motion.grounded[id]) Sim.step();
  Actors.buttons[id] = 0;
  holdInput(id, 0, 0, 0, 180);
  stepSeconds(0.2);
  Actors.buttons[id] = BTN.CROUCH; stepSeconds(0.2);
  tapButtons(id, BTN.JUMP);
  check('bullet jump 14.5 m/s toward the reticle', Test.near(Math.hypot(Actors.vx[id], Actors.vy[id], Actors.vz[id]), 14.5, 0.3));
  Actors.buttons[id] = BTN.ALT;
  const vy = Actors.vy[id]; Sim.step();
  check('aim glide: gravity x0.15', Test.near(vy - Actors.vy[id], 16 * 0.15 * TICK_SECONDS, 1e-3), vy - Actors.vy[id]);
});

Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'parkour' });
  const id = groundedTester(0, 0);
  Actors.y[id] = 14; Motion.grounded[id] = 0; Actors.vy[id] = -12;
  while (!Motion.grounded[id]) Sim.step();
  check('hard landing (>= 20 m/s) staggers 0.4 s', getClock(id, CLOCK.STAGGER) > 0.35);
  stepSeconds(0.5);
  Actors.y[id] = 14; Motion.grounded[id] = 0; Actors.vy[id] = -12; Actors.buttons[id] = BTN.CROUCH;
  while (!Motion.grounded[id]) Sim.step();
  check('rolling avoids the stagger', getClock(id, CLOCK.STAGGER) === 0);
  check('roll takes 75% less damage for 0.5 s', Move.damageScale(id) === 0.25);
  stepSeconds(0.55);
  check('roll over', Move.damageScale(id) === 1);
});

// ---- Rules scales, events, flags, board ----
Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'arena', knockback: 0.5, gravityScale: 0.5 });
  const id = groundedTester(0, 0);
  Bus.emit('impulse', { id, x: 0, y: 10, z: 0 });
  check('impulse scaled by rules.knockback', Test.near(Actors.vy[id], 5, 0.01) && Motion.grounded[id] === 0);
  stepSeconds(2);
  Bus.emit('impulse', { id, x: 200, y: 0, z: 0 });
  check('knockback capped at 30 m/s', Test.near(Actors.vx[id], 30, 0.01));
  check('gravity = preset x rules.gravityScale', Test.near(Move.gravity(id), 12, 1e-6));
  Actors.aimYaw[id] = 1.25; Actors.aimPitch[id] = -0.5; Sim.step();
  check('yaw/pitch copied from aim each step', Test.near(Actors.yaw[id], 1.25, 1e-6) && Test.near(Actors.pitch[id], -0.5, 1e-6));
});

Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'arena' });
  const id = groundedTester(0, 0);
  holdInput(id, 0, 1, 0, 0);
  const events = recordEvents(['move.step', 'move.jump', 'move.land', 'sound'], () => { stepSeconds(1); tapButtons(id, BTN.JUMP); stepSeconds(1); });
  const types = new Set(events.map((event) => event.type));
  check('step, jump, land and sound events', types.has('move.step') && types.has('move.jump') && types.has('move.land') && types.has('sound'));
  check('event payload { id, speed, surface }', events.every((e) => e.type === 'sound' || (e.id === id && typeof e.speed === 'number' && e.surface === 'concrete')));
  check('flags: ON_GROUND while walking', (Actors.flags[id] & ACTOR_FLAG.ON_GROUND) !== 0);
  useTestRules({ move: 'tactical' });
  holdInput(id, 0, 1, BTN.WALK);
  check('silent walk emits no footsteps (tactical)', recordEvents(['move.step'], () => stepSeconds(2)).length === 0);
  holdInput(id, 0, 1, BTN.CROUCH);
  const crouchSteps = recordEvents(['sound'], () => stepSeconds(4)).filter((e) => e.kind === 'step');
  check('crouch halves footstep noise', crouchSteps.length > 0 && crouchSteps.every((e) => e.radius === FOOTSTEP_NOISE_RADIUS / 2));
});

Test.add('move', (check) => {
  loadTestWorld([], { size: 100 });
  useTestRules({ move: 'arena' });
  const id = groundedTester(0, 0);
  check('no board on small maps', !Move.setBoard(id, true));
  loadTestWorld([], { size: [200, 180] });
  check('board on large maps', Move.setBoard(id, true) && Move.onBoard(id) && !Move.canFire(id));
  holdInput(id, 0, 1, 0, 0);
  stepSeconds(3);
  check('board speed 13 m/s', Test.near(testSpeed(id), 13, 0.13), testSpeed(id));
  Bus.emit('damage', { target: id, source: -1, amount: 1 });
  check('any hit knocks the rider off for 2 s', !Move.onBoard(id) && !Move.setBoard(id, true));
  stepSeconds(2.05);
  check('can board again after 2 s', Move.setBoard(id, true));
});

// Q5 boarding: Use while running deploys the Skimmer on a large map (never on a small one, never standing); Use again steps off.
Test.add('move', (check) => {
  loadTestWorld([], { size: 100 });
  useTestRules({ move: 'arena' });
  const id = groundedTester(0, 0);
  holdInput(id, 0, 1, 0);
  stepSeconds(0.5);
  holdInput(id, 0, 1, BTN.USE);
  stepSeconds(0.1);
  check('no boarding on a small map', !Move.onBoard(id));
  loadTestWorld([], { size: [200, 180] });
  const rider = groundedTester(0, 0);
  holdInput(rider, 0, 0, BTN.USE);
  stepSeconds(0.1);
  check('Use while standing does not board (objectives and loot use it)', !Move.onBoard(rider));
  holdInput(rider, 0, 1, 0);
  stepSeconds(0.5);
  holdInput(rider, 0, 0, BTN.USE);
  Sim.step();
  check('stop-and-Use in one step does not board (bots at Use goals)', !Move.onBoard(rider) && Move.canFire(rider));
  holdInput(rider, 0, 1, 0);
  stepSeconds(0.5);
  holdInput(rider, 0, 1, BTN.USE);
  stepSeconds(0.1);
  check('Use while running boards on a large map', Move.onBoard(rider));
  holdInput(rider, 0, 1, 0);
  stepSeconds(0.1);
  holdInput(rider, 0, 1, BTN.USE);
  stepSeconds(0.1);
  check('Use while riding steps off', !Move.onBoard(rider));
});

// PERF-002: movement and collision for 24 actors on a 400-brush field stay well inside 0.5 ms per step.
Test.add('move', (check) => {
  loadTestWorld(randomBrushes(21, 400, 50));
  useTestRules({ move: 'agile' });
  const random = makeRandom(4), testers = [];
  for (let i = 0; i < 24; i++) testers.push(spawnTester(...freeSpot(random)));
  let total = 0;
  for (let step = 0; step < 600; step++) {
    if (step % 40 === 0) testers.forEach((id) => holdInput(id, random.range(-1, 1), 1, random.chance(0.3) ? BTN.JUMP : BTN.SPRINT, random.range(-180, 180)));
    Sim.step();
    if (step >= 100) total += Sim.timing.move;
  }
  check('24 actors move in < 0.5 ms per step on average', total / 500 < 0.5, (total / 500).toFixed(3) + ' ms');
});

// MOV-023: at most 3 world rays per actor per step, in every preset, during random moves among walls and ledges.
Test.add('move', (check) => {
  loadTestWorld(randomBrushes(8, 160, 25));
  const random = makeRandom(17), original = World.raycast;
  let rays = 0, worst = 0, worstPreset = '';
  World.raycast = function countedRaycast(...args) { rays++; return original.apply(this, args); };
  try {
    for (const row of CAT.movement) {
      useTestRules({ move: row.id });
      const id = spawnTester(...freeSpot(random));
      for (let step = 0; step < 600; step++) {
        if (step % 20 === 0) randomize(id, random);
        rays = 0;
        Sim.step();
        if (rays > worst) { worst = rays; worstPreset = row.id; }
      }
      Actors.remove(id);
    }
  } finally { World.raycast = original; }
  check('no more than 3 rays per actor per step (MOV-023)', worst <= RAY_BUDGET && worst > 0, worst + ' in ' + worstPreset);
});

// ---- Smaller rules: crouch-jump lift (MV02), wall dodge (RS02), auto-strafe (MOV-018), downhill slide (MV04) ----
Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'tactical' });
  const id = groundedTester(0, 0);
  const startY = Actors.y[id];
  tapButtons(id, BTN.JUMP);
  stepSeconds(0.1);
  Actors.buttons[id] = BTN.CROUCH;
  const top = highestPoint(id, 1) - startY;
  check('crouch-jump lifts the feet 0.3 m', Test.near(top, 6.3 ** 2 / 40 + 0.3, 0.03), top);
});

Test.add('move', (check) => {
  loadTestWorld([{ shape: 'box', min: [0.5, 0, -10], max: [1, 10, 10] }]);
  useTestRules({ move: 'arena', moveOverrides: { wallDodge: true } });
  const id = spawnTester(0, 3, 0);
  holdInput(id, 0, 0, 0, 0);
  Sim.step();
  check('wall dodge: double-tap away from a wall in the air', recordEvents(['move.dash'], () => doubleTapRight(id)).length === 1 && Actors.vx[id] < -9);
  useTestRules({ move: 'arena' });
  const plain = spawnTester(-20, 3, 0);
  holdInput(plain, 0, 0, 0, 0);
  Sim.step();
  check('no air dodge without wallDodge', recordEvents(['move.dash'], () => doubleTapRight(plain)).length === 0);
});

Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'arena' });
  const assisted = airTurn('on'), unassisted = airTurn('off');
  check('auto-strafe turns the air velocity toward the view', assisted > unassisted + 0.5 && assisted > 1, assisted + ' vs ' + unassisted);
});

// Flies +Z at 9 m/s looking +X with forward held for 0.4 s; returns how far the velocity turned (radians).
function airTurn(assist) {
  const id = spawnTester(0, 30, 0);
  Game.playerId = id;
  Settings.set('gameplay.airAssist', assist);
  Actors.vz[id] = 9;
  holdInput(id, 0, 1, 0, 90);
  stepSeconds(0.4);
  Game.playerId = -1;
  const turned = Math.atan2(Actors.vx[id], Actors.vz[id]);
  Actors.remove(id);
  return turned;
}

Test.add('move', (check) => {
  loadTestWorld([{ shape: 'ramp', min: [-3, 0, 0], max: [3, 6, 20], dir: '-z' }]);
  useTestRules({ move: 'agile' });
  const sloped = spawnTester(0, 5.6, 1.5), flat = groundedTester(20, 0);
  Sim.run(6);
  for (const id of [sloped, flat]) { Actors.vz[id] = 7.6; holdInput(id, 0, 1, BTN.CROUCH, 0); }
  stepSeconds(0.5);
  check('slides gain speed downhill (MV04)', Motion.sliding[sloped] === 1 && testSpeed(sloped) > testSpeed(flat) + 1, testSpeed(sloped) + ' vs ' + testSpeed(flat));
  useTestRules({ move: 'parkour' });
  const glider = spawnTester(-30, 40, 0);
  Actors.buttons[glider] = BTN.ALT;
  stepSeconds(3.1);
  const vy = Actors.vy[glider]; Sim.step();
  check('glide lasts 3 s per jump', Test.near(vy - Actors.vy[glider], 16 * TICK_SECONDS, 1e-3), vy - Actors.vy[glider]);
});

// HP-007: a downed actor crawls but never jumps or air-jumps.
Test.add('move', (check) => {
  loadTestWorld();
  useTestRules({ move: 'agile' });
  const id = groundedTester(0, 0), ally = groundedTester(-20, -20);
  Actors.flags[id] |= ACTOR_FLAG.DOWNED; Damage.downedTime[id] = DOWNED_BLEED_SECONDS;
  const startY = Actors.y[id];
  holdInput(id, 0, 1, BTN.JUMP);
  const rise = highestPoint(id, 0.5) - startY;
  check('a downed actor does not jump (HP-007)', Actors.alive[id] === 1 && rise < 0.05, rise.toFixed(3));
  Actors.flags[id] &= ~ACTOR_FLAG.DOWNED;
  Actors.remove(id); Actors.remove(ally);
});

// nearestSeenEnemy: the nearest enemy that passes the rule's cone test and has a clear line; walls hide the nearer one.
Test.add('move', (check) => {
  loadTestWorld([{ shape: 'box', min: [-1, 0, 4], max: [1, 4, 5] }]);
  useTestRules({ move: 'arena' });
  const me = spawnTester(0, 0, 0, null, 0), hidden = spawnTester(0, 0, 8, null, 1), near = spawnTester(6, 0, 3, null, 1), far = spawnTester(-9, 0, 2, null, 1);
  const rule = { skip: (who, id) => !Actors.alive[id] || !Actors.isEnemy(who, id), point: (id, out) => { out.x = Actors.x[id]; out.y = Actors.eyeY(id); out.z = Actors.z[id]; },
    accept: (who, id, dx, dy, dz, distance) => distance > 0 };
  const eyeY = Actors.eyeY(me);
  check('nearestSeenEnemy: the nearest visible enemy wins, a wall hides the one behind it', nearestSeenEnemy(me, 0, eyeY, 0, 50, rule) === near);
  check('nearestSeenEnemy: nothing beyond the range', nearestSeenEnemy(me, 0, eyeY, 0, 2, rule) === -1);
  rule.accept = (who, id) => id === far;
  check('nearestSeenEnemy: the rule can reject candidates', nearestSeenEnemy(me, 0, eyeY, 0, 50, rule) === far);
  Actors.remove(me); Actors.remove(hidden); Actors.remove(near); Actors.remove(far);
});

// The shield charge measures range and the nearest enemy flat (2D): a raised enemy inside the flat range still locks.
Test.add('move', (check) => {
  loadTestWorld([]);
  useTestRules({ move: 'arena' });
  const me = spawnTester(0, 0, 0, null, 0), raised = spawnTester(0, 5, 24.6, null, 1);
  Actors.yaw[me] = 0;
  check('charge: an enemy 5 m up at 24.6 m flat locks with range 25', chargeTarget(me, 25) === raised);
  Actors.remove(raised);
  const high = spawnTester(1, 10, 15, null, 1), ground = spawnTester(-1, 0, 16, null, 1);
  check('charge: the flat-nearest enemy wins over the 3D-nearest one', chargeTarget(me, 25) === high);
  Actors.remove(me); Actors.remove(high); Actors.remove(ground);
});

// Homing rows lock the nearest visible enemy inside the 45-degree cone; a wall hides one, non-homing rows lock nothing.
Test.add('move', (check) => {
  loadTestWorld([{ shape: 'box', min: [-1, 0, 4], max: [1, 4, 5] }]);
  useTestRules({ move: 'arena' });
  const me = spawnTester(0, 0, 0, null, 0), walled = spawnTester(0, 0, 7, null, 1), aside = spawnTester(6, 0, 2, null, 1);
  const inCone = spawnTester(4, 0, 10, null, 1), forward = Vec.make();
  Vec.set(forward, 0, 0, 1);
  const locked = Projectiles.acquireTarget(me, CAT.projectiles.byId('missile'), forward);
  check('homing: the nearest visible enemy inside the cone', locked === inCone, locked);
  check('homing: a non-homing row locks nothing', Projectiles.acquireTarget(me, CAT.projectiles.byId('bullet'), forward) === -1);
  Actors.remove(me); Actors.remove(walled); Actors.remove(aside); Actors.remove(inCone);
});
