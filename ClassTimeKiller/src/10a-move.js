// ==== S10 MOVEMENT ====
// One controller for players and bots (MOV-010), run by Sim at order 30 for every live actor from its input fields.
// All numbers come from the CAT.movement row named by Game.match.rules.move (fallback 'arena'); a mechanic is on when
// its preset fields are non-zero. Shared rules (MOV-011/012): ground friction then acceleration; air uses the same
// acceleration with airAccel and airWishCap, so strafe-jumping emerges from the projection rule.
// This file: state store, presets, input, stance, walk/air physics, jumping, landing, collision, events, public API.
// 10b-move-special.js adds the special states and actions (slide, dodge, dash, charge, mantle, wall-run, water...).

const STANCE = { STAND: 0, CROUCH: 1, PRONE: 2 };
const STANCE_HEIGHT = [STAND_HEIGHT, 1.10, 0.60]; // DATA-003
const STANCE_EYE = [1.62, 0.95, 0.40];
const MOVE_STATE = { WALK: 0, MANTLE: 1, DASH: 2, CHARGE: 3, WALL_RUN: 4, LATCH: 5, LADDER: 6, SWIM: 7 };
const JUMP_BUFFER_SECONDS = 0.10;                // MOV-013
const HARD_LANDING_SPEED = 15;                   // MOV-014: landing faster locks jumping...
const LANDING_LOCK_SECONDS = 0.25;               // ...for this long
const LANDING_PENALTY_SECONDS = 0.2;             // MOV-014 landingPenalty window
const GROUND_PROBE = 0.06;                       // metres looked down for floor while airborne
const SETTLE_REACH = STEP_HEIGHT + GROUND_PROBE;   // the settle and the floor probe look this far around the feet
const GROUND_LEAVE_SPEED = 0.25;                 // moving off the floor plane faster than this is airborne (jumps, pads)
const UNGROUND_SECONDS = 0.05;                   // after a jump or launch the floor probe pauses (no re-sticking)
const EYE_SPEED = 6;                             // m/s the eye follows stance changes
const KNOCKBACK_CAP = 30;                        // MOV-017 m/s
const SUB_STEP_DISTANCE = 0.4;                   // longest sweep per sub-step (one capsule radius)
const MAX_SUB_STEPS = 4;
const STRIDE_METRES = 1.6;                       // ground distance between footstep events
const FOOTSTEP_NOISE_RADIUS = 15;                // AUD-004: footsteps locatable at 15 m
const LANDING_NOISE_RADIUS = 20;
const NO_RECENT_LANDING = 1e6;                   // seconds: a fresh spawn has not just landed (no MOV-025 landing spread)
const STILL_FRACTION = 0.02;                     // MOV-025: slower than this fraction of ground speed counts as standing
const MOVE_SPREAD_DEGREES = 1;                   // WPN-003 without a MOV-025 table: + this x speed fraction f (x the mode's moveSpread)
const AIR_SPREAD_DEGREES = 1.5;                  // WPN-003 air term without a MOV-025 table
const AIR_ASSIST_ACCEL = 2;                      // MOV-018
const SPRINT_INPUT = 0.5;                        // forward input needed to sprint
const MOVE_FLAG_MASK = ACTOR_FLAG.ON_GROUND | ACTOR_FLAG.CROUCHED | ACTOR_FLAG.PRONE | ACTOR_FLAG.SPRINTING
  | ACTOR_FLAG.SLIDING | ACTOR_FLAG.WALL_RUN | ACTOR_FLAG.IN_WATER | ACTOR_FLAG.ON_LADDER;

// Countdown clocks (seconds) per actor, all lowered by dt every step.
const CLOCK = { JUMP_BUFFER: 0, JUMP_LOCK: 1, LAND_SLOW: 2, SLIDE_COOLDOWN: 3, DODGE_COOLDOWN: 4, CHARGE_COOLDOWN: 5, FIRE_DELAY: 6,
  STAGGER: 7, ROLL: 8, LADDER_BLOCK: 9, BOARD_BLOCK: 10, UNGROUND: 11, TAC_SPRINT: 12 };
const CLOCK_COUNT = 13;

const MOTION_FIELDS = ['state', 'stateTime', 'stance', 'proneWanted', 'grounded', 'groundNX', 'groundNY', 'groundNZ', 'sinceLanding', 'airTime',
  'jumpsLeft', 'jumpPressed', 'stamina', 'staminaWait', 'tacCharges', 'tacRecharge', 'sprinting', 'sliding', 'slideTime', 'slideBoostClock',
  'dashCharges', 'dirX', 'dirY', 'dirZ', 'fromX', 'fromY', 'fromZ', 'toX', 'toY', 'toZ', 'wallNX', 'wallNZ', 'climbed', 'glideUsed', 'liftUsed',
  'stepDistance', 'gliding', 'blocked', 'blockNX', 'blockNZ', 'board', 'medium', 'inputX', 'inputZ', 'tapClockX', 'tapClockZ', 'tapClockSprint',
  'tapSignX', 'tapSignZ', 'tapSignSprint', 'lastAxisX', 'lastAxisZ', 'lastAxisSprint', 'target', 'rays'];

const Motion = { clocks: new Float32Array(MAX_ACTORS * CLOCK_COUNT), groundBrush: new Array(MAX_ACTORS).fill(null),
  wallBrush: new Array(MAX_ACTORS).fill(null), lastWallBrush: new Array(MAX_ACTORS).fill(null) };
for (const field of MOTION_FIELDS) Motion[field] = new Float32Array(MAX_ACTORS);

const getClock = (id, which) => Motion.clocks[id * CLOCK_COUNT + which];
const setClock = (id, which, seconds) => { Motion.clocks[id * CLOCK_COUNT + which] = seconds; };

// Match-wide movement settings, rebuilt when Game.match.rules changes (MOV-001: rules are frozen per match).
const MatchMove = { rules: undefined, preset: null, gravityScale: 1, knockback: 1, autoHop: false, airControl: false };

const Move = {
  presetOverride: new Array(MAX_ACTORS).fill(null),   // per-actor preset rows (hero kits); null = the match preset
  weaponSpeedScale: new Float32Array(MAX_ACTORS).fill(1), // written by S11: weapon moveMult x adsMoveMult (MOV-021)
  weaponReadyTime: new Float32Array(MAX_ACTORS),          // written by S11: the held weapon's readyTime, added to sprintToFire (MOV-021)
  statusSpeedScale: new Float32Array(MAX_ACTORS).fill(1), // written by S12 (Buffs only): slows and hastes
  gravityScale: new Float32Array(MAX_ACTORS).fill(1),     // per-actor gravity factor on top of the ruleset's (S12 Buffs: A11 glide)
  staminaScale: new Float32Array(MAX_ACTORS).fill(1),     // sprint stamina lasts this many times longer (S13: Marathon perk)
  footstepScale: new Float32Array(MAX_ACTORS).fill(1),    // footstep loudness factor, 0 = silent (S13: Quietstep perk)
  safeLanding: new Uint8Array(MAX_ACTORS),                // 1 = the next landing deals no fall damage, then cleared (S13: royale drop-in)
  states: [],             // MOVE_STATE -> fn(id, preset, gravity, dt); 10b fills the special states
  actions: [],            // fn(id, preset) run before the state step: start special moves from input (10b)
  landHooks: [],          // fn(id, preset, impactSpeed) run on landing (10b: roll, stagger, slide-hop)

  preset(id) { return this.presetOverride[id] || matchPreset(); },
  setPreset(id, presetId) { this.presetOverride[id] = presetId ? CAT.movement.byId(presetId) : null; },
  gravity(id) { matchPreset(); return actorGravity(id, this.preset(id)); },
  horizontalSpeed(id) { return length2(Actors.vx[id], Actors.vz[id]); },
  // Movement inaccuracy in degrees for weapons: the MOV-025 table where the preset has one, else WPN-003 f + air
  // (tableOnly: 0 without a table, for projectile modes that stay exact outside MOV-025).
  inaccuracy(id, tableOnly) {
    const table = this.preset(id).inaccuracy;
    if (!table) return tableOnly ? 0 : defaultInaccuracy(id);
    const sinceLanding = Motion.sinceLanding[id];
    const landing = sinceLanding < table.landTime ? table.land * (1 - sinceLanding / table.landTime) : 0;
    return movingInaccuracy(id, table) + landing;
  },
  // False while sprinting, during the sprint-to-fire delay (MOV-021), mantling (MOV-022), charging or on the board.
  canFire(id) {
    if (getClock(id, CLOCK.FIRE_DELAY) > 0 || Motion.sprinting[id] || Motion.board[id]) return false;
    return Motion.state[id] !== MOVE_STATE.MANTLE && Motion.state[id] !== MOVE_STATE.CHARGE;
  },
  damageScale(id) { return getClock(id, CLOCK.ROLL) > 0 ? this.preset(id).rollDamageScale : 1; },
  stamina: Motion.stamina,  // seconds of sprint left per actor (read-only)
  staminaFraction(id) { const full = this.preset(id).sprintStamina; return full > 0 ? Motion.stamina[id] / full : 1; },
  dashCharges(id) { return Math.floor(Motion.dashCharges[id]); },
  stateName(id) { return MOVE_STATE_NAMES[Motion.state[id]]; },
  isGrounded(id) { return Motion.grounded[id] === 1; },
};

const MOVE_STATE_NAMES = Object.keys(MOVE_STATE).map((name) => name.toLowerCase());

function matchPreset() {
  const rules = Game.match ? Game.match.rules : null;
  if (rules !== MatchMove.rules) buildMatchMove(rules);
  return MatchMove.preset;
}

// A ruleset lists mutators as { id, value }; hand-made test rules may list plain ids.
function hasMutator(list, id) { return list.some((entry) => entry === id || entry.id === id); }

function buildMatchMove(rules) {
  const row = CAT.movement.byId(rules && rules.move) || CAT.movement.byId('arena');
  const mutators = (rules && rules.mutators) || [];
  MatchMove.rules = rules;
  MatchMove.preset = rules && rules.moveOverrides ? Object.assign({}, row, rules.moveOverrides) : row;
  MatchMove.gravityScale = rules && rules.gravityScale !== undefined ? rules.gravityScale : 1;
  MatchMove.knockback = rules && rules.knockback !== undefined ? rules.knockback : 1;
  MatchMove.autoHop = hasMutator(mutators, 'autohop');        // X25: holding jump repeats
  MatchMove.airControl = hasMutator(mutators, 'aircontrol');  // X24: air-control assist for everyone
}

// Gravity of one actor: preset x ruleset gravityScale (X01) x the actor's own factor (glide).
function actorGravity(id, preset) { return preset.gravity * MatchMove.gravityScale * Move.gravityScale[id]; }

function resetMotion(id) {
  for (const field of MOTION_FIELDS) Motion[field][id] = 0;
  Motion.clocks.fill(0, id * CLOCK_COUNT, (id + 1) * CLOCK_COUNT);
  Motion.groundBrush[id] = Motion.wallBrush[id] = Motion.lastWallBrush[id] = null;
  Motion.target[id] = -1; Motion.sinceLanding[id] = NO_RECENT_LANDING;
  const preset = Move.preset(id);
  Motion.stamina[id] = preset.sprintStamina; Motion.tacCharges[id] = preset.tacSprintCharges; Motion.dashCharges[id] = preset.dashCharges;
  Motion.jumpsLeft[id] = preset.extraJumps; Motion.slideBoostClock[id] = preset.slideBoostInterval;
  Actors.height[id] = STANCE_HEIGHT[STANCE.STAND]; Actors.eye[id] = STANCE_EYE[STANCE.STAND];
}

// ---- Shared physics (MOV-011/012): one friction rule, one acceleration rule ----
function applyFriction(id, friction, stopSpeed, dt, includeVertical) {
  const vy = includeVertical ? Actors.vy[id] : 0;
  const speed = length3(Actors.vx[id], vy, Actors.vz[id]);
  if (speed < 1e-6) return;
  const newSpeed = Math.max(0, speed - Math.max(speed, stopSpeed) * friction * dt);
  const scale = newSpeed / speed;
  Actors.vx[id] *= scale; Actors.vz[id] *= scale;
  if (includeVertical) Actors.vy[id] *= scale;
}

function accelerate(id, wishX, wishY, wishZ, wishSpeed, accel, dt) {
  const current = Actors.vx[id] * wishX + Actors.vy[id] * wishY + Actors.vz[id] * wishZ;
  const add = Math.min(accel * wishSpeed * dt, wishSpeed - current);
  if (add <= 0) return;
  Actors.vx[id] += wishX * add; Actors.vy[id] += wishY * add; Actors.vz[id] += wishZ * add;
}

const wish = { x: 0, y: 0, z: 0, amount: 0 };

// World x/z of `forward` metres along the view yaw plus `strafe` to its right (not normalized).
// DATA-002: forward (sin yaw, 0, cos yaw), right (-cos yaw, 0, sin yaw).
function yawToWorld(yaw, forward, strafe, out) {
  out.x = Math.sin(yaw) * forward - Math.cos(yaw) * strafe;
  out.z = Math.cos(yaw) * forward + Math.sin(yaw) * strafe;
  return out;
}

// Horizontal wish direction (unit) and amount (0..1) from the input axes.
function horizontalWish(id) {
  yawToWorld(Actors.yaw[id], Motion.inputZ[id], Motion.inputX[id], wish);
  const length = length2(wish.x, wish.z);
  wish.amount = Math.min(1, length);
  wish.x = length > 1e-6 ? wish.x / length : 0; wish.y = 0; wish.z = length > 1e-6 ? wish.z / length : 0;
  return wish;
}

// A preset without sprint but with silent walking (MV02 Tactical) walks on the sprint button too: Shift walks (INP-003).
function sprintWalks(preset) { return preset.sprintSpeed === 0 && preset.silentWalk; }
function isWalking(id, preset) {
  const buttons = Actors.buttons[id];
  return (buttons & BTN.WALK) !== 0 || ((buttons & BTN.SPRINT) !== 0 && sprintWalks(preset));
}

// Top ground speed for the current stance, sprint, board and speed factors.
function groundWishSpeed(id, preset) {
  let speed = preset.groundSpeed;
  if (Motion.board[id]) speed = SKIMMER_SPEED;
  else if (getClock(id, CLOCK.TAC_SPRINT) > 0) speed = preset.tacSprintSpeed;
  else if (Motion.sprinting[id]) speed = preset.sprintSpeed;
  const stance = Actors.flags[id] & ACTOR_FLAG.DOWNED ? STANCE.STAND : Motion.stance[id];   // HP-007: S11's DOWNED_SPEED alone sets the crawl
  if (stance === STANCE.CROUCH) speed *= preset.crouchMult;
  else if (stance === STANCE.PRONE) speed *= preset.proneMult;
  else if (isWalking(id, preset)) speed *= preset.walkMult;
  if (getClock(id, CLOCK.LAND_SLOW) > 0) speed *= preset.landingPenalty;
  return speed * Move.weaponSpeedScale[id] * Move.statusSpeedScale[id];
}

function airAssistOn(id, preset) {
  if (MatchMove.airControl) return true;
  if (id !== Game.playerId) return false;
  const choice = Settings.get('gameplay.airAssist');
  return choice === 'on' || (choice === 'auto' && preset.airAssist && Input.device !== 'kbm');
}

// ---- The walk state: ground and air movement, jumps ----
function walkState(id, preset, gravity, dt) {
  if (Motion.grounded[id] && tryJump(id, preset)) Motion.grounded[id] = 0;
  if (Motion.grounded[id]) walkGround(id, preset, dt);
  else walkAir(id, preset, dt);
  integrate(id, Motion.grounded[id] ? 0 : gravity * airGravityScale(id, preset), dt);
}

function walkGround(id, preset, dt) {
  const sliding = Motion.sliding[id] === 1;
  const direction = horizontalWish(id);
  const wishSpeed = sliding ? 0 : groundWishSpeed(id, preset) * direction.amount;
  // The stop speed never exceeds the speed asked for: otherwise slow stances (modern prone 1.2 m/s with stopSpeed 2
  // and friction 8) could never accelerate. Standing still and counter-strafing keep the full MOV-011 rule.
  const stopSpeed = wishSpeed > 0 ? Math.min(preset.stopSpeed, wishSpeed) : preset.stopSpeed;
  applyFriction(id, sliding ? preset.slideFriction : preset.friction, stopSpeed, dt, false);
  if (sliding) { slideDownhill(id, preset, dt); return; }
  accelerate(id, direction.x, 0, direction.z, wishSpeed, preset.accel, dt);
}

function walkAir(id, preset, dt) {
  if (tryAirJump(id, preset)) return;
  const direction = horizontalWish(id);
  const assisted = airAssistOn(id, preset);
  const wishSpeed = Math.min(groundWishSpeed(id, preset), preset.airWishCap) * direction.amount;
  accelerate(id, direction.x, 0, direction.z, wishSpeed, preset.airAccel + (assisted ? AIR_ASSIST_ACCEL : 0), dt);
  if (assisted) autoStrafe(id, dt);
  climbWall(id, preset, dt);
}

// Buffered ground jump (MOV-013): the press is remembered for 0.10 s; landing lock (MOV-014) blocks it.
function tryJump(id, preset) {
  if (getClock(id, CLOCK.JUMP_BUFFER) <= 0 || getClock(id, CLOCK.JUMP_LOCK) > 0) return false;
  setClock(id, CLOCK.JUMP_BUFFER, 0);
  Motion.jumpPressed[id] = 0; // this press is spent: no extra jump in the same step
  if (tryBulletJump(id, preset)) return true;
  Actors.vy[id] = preset.jumpVel;
  launch(id, 'move.jump');
  return true;
}

// Extra jumps in the air (double jump), refilled on the first grounded step (MOV-024).
function tryAirJump(id, preset) {
  if (!Motion.jumpPressed[id] || Motion.jumpsLeft[id] < 1) return false;
  Motion.jumpsLeft[id]--;
  setClock(id, CLOCK.JUMP_BUFFER, 0);
  Actors.vy[id] = preset.extraJumpVel;
  launch(id, 'move.jump');
  return true;
}

// Leaves the floor: no ground snapping for a moment, the event, the slide ends.
function launch(id, eventType) {
  unground(id);
  Motion.sliding[id] = 0;
  emitMove(eventType, id, Move.horizontalSpeed(id), surfaceOf(id));
}

function unground(id) {
  Motion.grounded[id] = 0;
  setClock(id, CLOCK.UNGROUND, UNGROUND_SECONDS);
}

// ---- Collision move: exact parabola (gravity averaged over the step), sub-stepped sweeps, step-up, ground probe ----
const actorMover = makeMover();
const groundTrace = makeTrace();
const groundPlane = { nx: 0, ny: 1, nz: 0, brush: null };   // the floor plane of followGround (addClipPlane reads an object)

function loadActorMover(id) {
  const mover = actorMover;
  mover.x = Actors.x[id]; mover.y = Actors.y[id]; mover.z = Actors.z[id];
  mover.vx = Actors.vx[id]; mover.vy = Actors.vy[id]; mover.vz = Actors.vz[id];
  mover.planeCount = 0; mover.lastBrush = null;
  setCapsuleHull(mover.hull, ACTOR_RADIUS, Actors.height[id]);
  return mover;
}

function integrate(id, gravity, dt) {
  const mover = loadActorMover(id);
  const wasGrounded = Motion.grounded[id] === 1;
  const endVY = mover.vy - gravity * dt;
  mover.vy = (mover.vy + endVY) / 2;
  if (wasGrounded) followGround(id, mover);
  sweepActor(id, mover, dt, wasGrounded ? STEP_HEIGHT : 0);
  if (gravity !== 0) { mover.vy = endVY; clipToTouchedPlanes(mover); }
  settle(id, mover);
  const impactSpeed = Math.max(0, -endVY);
  const nowGrounded = probeFloor(id, mover, wasGrounded);
  storeMover(id, mover);
  if (nowGrounded && !wasGrounded) land(id, impactSpeed);
}

// After the move the vertical speed is the end-of-step value, clipped again by every surface touched on the way.
function clipToTouchedPlanes(mover) {
  for (let i = 0; i < mover.planeCount; i++) clipVelocity(mover, mover.planes[i * 3], mover.planes[i * 3 + 1], mover.planes[i * 3 + 2]);
}

// On the floor the velocity follows the floor plane with its speed kept (walking up a slope is not slower).
function followGround(id, mover) {
  const speed = length3(mover.vx, mover.vy, mover.vz), plane = groundPlane;
  plane.nx = Motion.groundNX[id]; plane.ny = Motion.groundNY[id]; plane.nz = Motion.groundNZ[id]; plane.brush = Motion.groundBrush[id];
  addClipPlane(mover, plane);
  clipVelocity(mover, plane.nx, plane.ny, plane.nz);
  const clipped = length3(mover.vx, mover.vy, mover.vz);
  if (clipped < 1e-6) return;
  mover.vx *= speed / clipped; mover.vy *= speed / clipped; mover.vz *= speed / clipped;
}

// Each piece gathers at least the settle reach past its travel, so the settle and floor probe after it reuse that brush
// list (Collide.gatherAround) instead of walking the brush tree again. The piece time goes through slideClock (slideMover,
// stepSlideMover): a computed float passed as an argument would be boxed every step (PERF-006).
function sweepActor(id, mover, dt, stepHeight) {
  const travel = length3(mover.vx, mover.vy, mover.vz) * dt;
  const pieces = clamp(Math.ceil(travel / SUB_STEP_DISTANCE), 1, MAX_SUB_STEPS);
  const firstPlanes = mover.planeCount;
  Motion.blocked[id] = 0;
  for (let i = 0; i < pieces; i++) {
    mover.planeCount = Math.min(mover.planeCount, firstPlanes);
    Collide.gatherAround(mover, travel / pieces + Math.max(stepHeight, SETTLE_REACH));
    slideClock.seconds = dt / pieces;
    const hit = stepHeight > 0 ? Collide.stepSlideMover(mover, stepHeight) : Collide.slideMover(mover);
    if (hit) recordWall(id, mover);
  }
}

// Remembers a wall the actor pushed against in any sub-step, with that plane's own brush (mantle, climb and wall
// checks read it next step). Floors and ceilings are not walls.
function recordWall(id, mover) {
  for (let i = 0; i < mover.planeCount; i++) {
    if (Math.abs(mover.planes[i * 3 + 1]) >= WALKABLE_NORMAL_Y) continue;
    Motion.blocked[id] = 1; Motion.blockNX[id] = mover.planes[i * 3]; Motion.blockNZ[id] = mover.planes[i * 3 + 2];
    Motion.wallBrush[id] = mover.planeBrushes[i];
  }
}

// Leaves geometry if the move ended inside it; when that fails the actor goes back to where the step began.
function settle(id, mover) {
  Collide.gatherAround(mover, SETTLE_REACH);
  if (Collide.depenetrate(mover)) return;
  mover.x = Actors.x[id]; mover.y = Actors.y[id]; mover.z = Actors.z[id];
  mover.vx = mover.vy = mover.vz = 0;
  Collide.gatherAround(mover, SETTLE_REACH);
}

// Floor under the feet: snaps down stairs (up to the step height) while walking, never right after a launch.
function probeFloor(id, mover, wasGrounded) {
  if (getClock(id, CLOCK.UNGROUND) > 0) return setAirborne(id);
  const trace = groundTrace;
  if (!Collide.probeGround(mover, wasGrounded ? STEP_HEIGHT + GROUND_PROBE : GROUND_PROBE, trace)) return setAirborne(id);
  if (mover.vx * trace.nx + mover.vy * trace.ny + mover.vz * trace.nz > GROUND_LEAVE_SPEED) return setAirborne(id);
  mover.y = trace.y;
  clipVelocity(mover, trace.nx, trace.ny, trace.nz);
  Motion.grounded[id] = 1;
  Motion.groundNX[id] = trace.nx; Motion.groundNY[id] = trace.ny; Motion.groundNZ[id] = trace.nz;
  Motion.groundBrush[id] = trace.brush;
  return true;
}

function setAirborne(id) {
  Motion.grounded[id] = 0;
  return false;
}

function storeMover(id, mover) {
  Actors.x[id] = mover.x; Actors.y[id] = mover.y; Actors.z[id] = mover.z;
  Actors.vx[id] = mover.vx; Actors.vy[id] = mover.vy; Actors.vz[id] = mover.vz;
}

// ---- Landing (MOV-013..015, MOV-024) ----
function land(id, impactSpeed) {
  const preset = Move.preset(id);
  const damage = Move.safeLanding[id] ? 0 : fallDamage(preset, impactSpeed);
  Move.safeLanding[id] = 0;
  if (damage > 0) requestDamage(id, -1, damage, 'fall', 'none');
  if (impactSpeed > HARD_LANDING_SPEED) setClock(id, CLOCK.JUMP_LOCK, LANDING_LOCK_SECONDS);
  if (preset.landingPenalty < 1) setClock(id, CLOCK.LAND_SLOW, LANDING_PENALTY_SECONDS);
  if (preset.bhopCap > 0) capHorizontalSpeed(id, preset.bhopCap * preset.groundSpeed);
  Motion.jumpsLeft[id] = preset.extraJumps; Motion.glideUsed[id] = 0; Motion.liftUsed[id] = 0; Motion.climbed[id] = 0;
  Motion.lastWallBrush[id] = null; Motion.sinceLanding[id] = 0;
  for (let i = 0; i < Move.landHooks.length; i++) Move.landHooks[i](id, preset, impactSpeed);
  emitMove('move.land', id, impactSpeed, surfaceOf(id));
  emitNoise(id, LANDING_NOISE_RADIUS * (Motion.stance[id] === STANCE.STAND ? 1 : 0.5), 'land');
}

// MOV-015 curve fallMax*((v-safe)/(lethal-safe))^2 above fallSafe, plus the highest exceeded fallSteps entry.
function fallDamage(preset, speed) {
  let damage = 0;
  for (let i = 0; i < preset.fallSteps.length; i++) if (speed > preset.fallSteps[i][0]) damage = Math.max(damage, preset.fallSteps[i][1]);
  if (preset.fallLethal > 0 && speed > preset.fallSafe) damage += preset.fallMax * ((speed - preset.fallSafe) / (preset.fallLethal - preset.fallSafe)) ** 2;
  return damage;
}

function capHorizontalSpeed(id, cap) {
  const speed = Move.horizontalSpeed(id);
  if (speed <= cap) return;
  Actors.vx[id] *= cap / speed; Actors.vz[id] *= cap / speed;
}

// ---- Stance: crouch (held), prone (toggled), stand-up only with headroom (MOV-016) ----
function updateStance(id, preset) {
  if ((Actors.pressed[id] & BTN.PRONE) && preset.proneMult > 0) Motion.proneWanted[id] = Motion.proneWanted[id] ? 0 : 1;
  const crouching = (Actors.buttons[id] & BTN.CROUCH) !== 0 || Motion.sliding[id] === 1;
  const lying = Motion.proneWanted[id] || (Actors.flags[id] & ACTOR_FLAG.DOWNED) !== 0;   // HP-007: the downed crawl prone
  let wanted = lying && Motion.grounded[id] ? STANCE.PRONE : crouching ? STANCE.CROUCH : STANCE.STAND;
  if (Motion.board[id] || Motion.state[id] === MOVE_STATE.SWIM || Motion.state[id] === MOVE_STATE.LADDER) wanted = STANCE.STAND;
  const current = Motion.stance[id];
  if (wanted === current) return;
  if (STANCE_HEIGHT[wanted] > STANCE_HEIGHT[current] && !headroom(id, STANCE_HEIGHT[wanted])) return;
  if (wanted === STANCE.CROUCH && !Motion.grounded[id]) crouchJumpLift(id, preset);
  Motion.stance[id] = wanted;
  Actors.height[id] = STANCE_HEIGHT[wanted];
}

function headroom(id, height) {
  const mover = loadActorMover(id);
  setCapsuleHull(mover.hull, ACTOR_RADIUS, height);
  Collide.gatherAround(mover, 0);
  return !Collide.overlaps(mover.x, mover.y, mover.z, mover.hull);
}

// MOV-002 tactical "crouch-jump +0.3 m": tucking the legs in the air lifts the feet once per jump.
function crouchJumpLift(id, preset) {
  if (preset.crouchJumpLift <= 0 || Motion.liftUsed[id]) return;
  Motion.liftUsed[id] = 1;
  const mover = loadActorMover(id);
  setCapsuleHull(mover.hull, ACTOR_RADIUS, STANCE_HEIGHT[STANCE.CROUCH]);
  Collide.gatherAround(mover, preset.crouchJumpLift);
  Collide.sweep(mover.x, mover.y, mover.z, mover.x, mover.y + preset.crouchJumpLift, mover.z, mover.hull, groundTrace);
  if (!groundTrace.allSolid) Actors.y[id] = groundTrace.y;
}

// ---- Sprint, stamina, tactical sprint (MOV-021, MV03) ----
function updateSprint(id, preset, dt) {
  const wasSprinting = Motion.sprinting[id] === 1;
  const held = (Actors.buttons[id] & BTN.SPRINT) !== 0, shooting = (Actors.buttons[id] & (BTN.FIRE | BTN.ALT)) !== 0;
  const canStart = Motion.grounded[id] || wasSprinting;
  const hasStamina = preset.sprintStamina <= 0 || Motion.stamina[id] > 0;
  const sprinting = preset.sprintSpeed > 0 && held && !shooting && canStart && hasStamina && Motion.inputZ[id] >= SPRINT_INPUT
    && Motion.stance[id] === STANCE.STAND && !Motion.sliding[id] && Motion.state[id] === MOVE_STATE.WALK && !Motion.board[id];
  Motion.sprinting[id] = sprinting ? 1 : 0;
  if (!sprinting) setClock(id, CLOCK.TAC_SPRINT, 0);
  if (wasSprinting && !sprinting) setClock(id, CLOCK.FIRE_DELAY, preset.sprintToFire + Move.weaponReadyTime[id]);
  updateStamina(id, preset, sprinting, dt);
  updateTacticalCharges(id, preset, dt);
}

function updateStamina(id, preset, sprinting, dt) {
  if (preset.sprintStamina <= 0) return;
  if (sprinting) { Motion.stamina[id] = Math.max(0, Motion.stamina[id] - dt / Move.staminaScale[id]); Motion.staminaWait[id] = 0; return; }
  Motion.staminaWait[id] += dt;
  if (Motion.staminaWait[id] < preset.staminaRegenDelay) return;
  Motion.stamina[id] = Math.min(preset.sprintStamina, Motion.stamina[id] + preset.sprintStamina / preset.staminaRegenTime * dt);
}

function updateTacticalCharges(id, preset, dt) {
  if (Motion.tacCharges[id] >= preset.tacSprintCharges) { Motion.tacRecharge[id] = 0; return; }
  Motion.tacRecharge[id] += dt;
  if (Motion.tacRecharge[id] < preset.tacSprintRecharge) return;
  Motion.tacRecharge[id] = 0;
  Motion.tacCharges[id]++;
}

// ---- Input, clocks and double taps ----
function isDowned(id) { return (Actors.flags[id] & ACTOR_FLAG.DOWNED) !== 0; }

function readInput(id) {
  const stopped = (Actors.flags[id] & ACTOR_FLAG.FROZEN) !== 0 || getClock(id, CLOCK.STAGGER) > 0 || Motion.state[id] === MOVE_STATE.MANTLE;
  Motion.inputX[id] = stopped ? 0 : clamp(Actors.moveX[id], -1, 1);
  Motion.inputZ[id] = stopped ? 0 : clamp(Actors.moveZ[id], -1, 1);
  const noJump = stopped || isDowned(id);   // HP-007: a downed actor crawls but never jumps
  const pressed = !noJump && (Actors.pressed[id] & BTN.JUMP) !== 0;
  const held = !noJump && (Actors.buttons[id] & BTN.JUMP) !== 0;
  // jumpPressed stays a fresh press: air jumps, wall jumps, ladder push-offs and mantles never repeat while held.
  Motion.jumpPressed[id] = pressed ? 1 : 0;
  // X25 autohop: a held jump keeps the ground-jump buffer full, so only ground jumps repeat.
  if (pressed || (MatchMove.autoHop && held)) setClock(id, CLOCK.JUMP_BUFFER, JUMP_BUFFER_SECONDS);
}

function updateClocks(id, dt) {
  const base = id * CLOCK_COUNT;
  for (let i = 0; i < CLOCK_COUNT; i++) Motion.clocks[base + i] = Math.max(0, Motion.clocks[base + i] - dt);
  Motion.stateTime[id] += dt; Motion.sinceLanding[id] += dt; Motion.slideBoostClock[id] += dt;
  Motion.tapClockX[id] += dt; Motion.tapClockZ[id] += dt; Motion.tapClockSprint[id] += dt;
  Motion.airTime[id] = Motion.grounded[id] ? 0 : Motion.airTime[id] + dt;
}

function setState(id, state) {
  Motion.state[id] = state;
  Motion.stateTime[id] = 0;
}

// ---- Per-step driver ----
function stepMovement(dt) {
  matchPreset();
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id] || Actors.kind[id] === ACTOR_KIND.NONE) continue;
    stepActor(id, dt);
  }
}

function stepActor(id, dt) {
  const preset = Move.preset(id);
  const gravity = actorGravity(id, preset);
  const startX = Actors.x[id], startZ = Actors.z[id];
  Actors.yaw[id] = Actors.aimYaw[id]; Actors.pitch[id] = Actors.aimPitch[id];
  Motion.rays[id] = 0; // MOV-023 wall/ledge ray budget of this step (10b spendRays)
  updateClocks(id, dt);
  readInput(id);
  updateStance(id, preset);
  // HP-007: no slide, dash, mantle or wall-run while downed
  if (!isDowned(id)) for (let i = 0; i < Move.actions.length; i++) Move.actions[i](id, preset);
  updateSprint(id, preset, dt);
  (Move.states[Motion.state[id]] || walkState)(id, preset, gravity, dt);
  afterMove(id, preset, gravity, startX, startZ);
}

function afterMove(id, preset, gravity, startX, startZ) {
  const verticalBefore = Actors.vy[id];
  Motion.medium[id] = World.touchTriggers(id, gravity);
  if (Actors.vy[id] > verticalBefore + GROUND_LEAVE_SPEED) unground(id); // launched by a jump pad
  updateEye(id);
  writeFlags(id);
  if (Motion.medium[id] & TRIGGER_MEDIUM.MOVED) { Motion.stepDistance[id] = 0; return; } // teleported: no stride across the map
  countSteps(id, preset, startX, startZ);
}

function updateEye(id) {
  const target = STANCE_EYE[Motion.stance[id]], current = Actors.eye[id], change = EYE_SPEED * TICK_SECONDS;
  Actors.eye[id] = current < target ? Math.min(target, current + change) : Math.max(target, current - change);
}

function writeFlags(id) {
  let flags = Actors.flags[id] & ~MOVE_FLAG_MASK;
  if (Motion.grounded[id]) flags |= ACTOR_FLAG.ON_GROUND;
  if (Motion.stance[id] === STANCE.CROUCH) flags |= ACTOR_FLAG.CROUCHED;
  if (Motion.stance[id] === STANCE.PRONE) flags |= ACTOR_FLAG.PRONE;
  if (Motion.sprinting[id]) flags |= ACTOR_FLAG.SPRINTING;
  if (Motion.sliding[id]) flags |= ACTOR_FLAG.SLIDING;
  if (Motion.state[id] === MOVE_STATE.WALL_RUN) flags |= ACTOR_FLAG.WALL_RUN;
  if (Motion.medium[id] & TRIGGER_MEDIUM.WATER) flags |= ACTOR_FLAG.IN_WATER;
  if (Motion.state[id] === MOVE_STATE.LADDER) flags |= ACTOR_FLAG.ON_LADDER;
  Actors.flags[id] = flags;
}

// Footsteps every STRIDE_METRES on the floor; crouching halves the noise, walking is quieter (silent in silentWalk presets);
// Move.footstepScale scales both the bot noise and the 'move.step' loudness (0 = silent, the event still marks the stride).
function countSteps(id, preset, startX, startZ) {
  if (!Motion.grounded[id] || Motion.sliding[id]) return;
  Motion.stepDistance[id] += length2(Actors.x[id] - startX, Actors.z[id] - startZ);
  if (Motion.stepDistance[id] < STRIDE_METRES) return;
  Motion.stepDistance[id] = 0;
  const walking = isWalking(id, preset);
  if (walking && preset.silentWalk) return;
  const loudness = (Motion.stance[id] === STANCE.STAND ? 1 : 0.5) * (walking ? 0.5 : 1) * Move.footstepScale[id];
  moveEvents['move.step'].loudness = loudness;
  emitMove('move.step', id, Move.horizontalSpeed(id), surfaceOf(id));
  emitNoise(id, FOOTSTEP_NOISE_RADIUS * loudness, 'step');
}

// WPN-003: MOVE_SPREAD_DEGREES x speed fraction f (capped at 1, 0 standing) + AIR_SPREAD_DEGREES off the ground.
function defaultInaccuracy(id) {
  const fraction = Math.min(1, Move.horizontalSpeed(id) / Move.preset(id).groundSpeed);
  const moving = fraction < STILL_FRACTION ? 0 : MOVE_SPREAD_DEGREES * fraction;
  return Motion.grounded[id] ? moving : moving + AIR_SPREAD_DEGREES;
}
function movingInaccuracy(id, table) {
  if (!Motion.grounded[id] || Motion.state[id] !== MOVE_STATE.WALK) return table.air;
  const preset = Move.preset(id), fraction = Move.horizontalSpeed(id) / preset.groundSpeed;
  if (fraction < STILL_FRACTION) return 0;
  if (Motion.stance[id] !== STANCE.STAND) return table.crouch;
  if (isWalking(id, preset) || fraction <= table.walkFraction) return table.walk;
  return table.run;
}

// ---- Events (reused payloads: listeners copy what they keep) ----
const moveEvents = {};
for (const type of ['move.jump', 'move.land', 'move.step', 'move.slide', 'move.dash', 'move.mantle', 'move.wallrun']) moveEvents[type] = { id: 0, speed: 0, surface: '', loudness: 1 };
function emitMove(type, id, speed, surface) {
  const payload = moveEvents[type];
  payload.id = id; payload.speed = speed; payload.surface = surface;
  Bus.emit(type, payload);
}

function emitNoise(id, radius, kind) {
  emitSound(Actors.x[id], Actors.y[id], Actors.z[id], radius, kind, id);
}

function surfaceOf(id) {
  const brush = Motion.grounded[id] ? Motion.groundBrush[id] : Motion.wallBrush[id];
  return brush ? brush.material : 'concrete';
}

// Knockback and launches from S08/S11/S12 (MOV-017): scaled by the ruleset's knockback, capped at 30 m/s.
function onImpulse(event) {
  const id = event.id;
  if (id < 0 || id >= MAX_ACTORS || !Actors.alive[id]) return;
  matchPreset();
  let x = event.x * MatchMove.knockback, y = event.y * MatchMove.knockback, z = event.z * MatchMove.knockback;
  const size = length3(x, y, z);
  if (size > KNOCKBACK_CAP) { x *= KNOCKBACK_CAP / size; y *= KNOCKBACK_CAP / size; z *= KNOCKBACK_CAP / size; }
  Actors.vx[id] += x; Actors.vy[id] += y; Actors.vz[id] += z;
  if (y > GROUND_LEAVE_SPEED) unground(id);
}

Settings.define('gameplay.airAssist', 'auto', { label: 'Air control assist', category: 'gameplay', options: ['auto', 'on', 'off'],
  optionLabels: ['Touch and gamepad', 'On', 'Off'] });
Sim.addSystem('move', 30, stepMovement);
TouchInput.stickSprints = () => !sprintWalks(matchPreset());   // a full touch-stick push in Tactical runs instead of walking
Bus.on('impulse', onImpulse);
Bus.on('actor.create', (id) => {
  Move.presetOverride[id] = null;
  Move.weaponSpeedScale[id] = Move.statusSpeedScale[id] = Move.gravityScale[id] = Move.staminaScale[id] = Move.footstepScale[id] = 1;
  Move.weaponReadyTime[id] = 0; Move.safeLanding[id] = 0;
  resetMotion(id);
});
Bus.on('actor.spawn', (event) => { resetMotion(event.id); Actors.flags[event.id] &= ~MOVE_FLAG_MASK; });   // S10 clears its own flags
