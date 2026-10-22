// S10 add-on: special moves, each enabled by its preset fields (one code path per mechanic).
// Actions (run every step before the state step) start moves from input; states move the actor while they last.
// Bindings: crouch while fast = slide; double-tap a direction = dodge; sprint key = dash or shield charge in presets
// without sprint, double-tap sprint = tactical sprint; jump into a ledge (or walk into it) = mantle; aim in the air =
// wall latch (next to a wall) or glide; jump while crouched or sliding = bullet jump.

const DOUBLE_TAP_SECONDS = 0.25;       // second tap of the same direction within this time
const TAP_THRESHOLD = 0.5;             // axis value that counts as a pressed direction
const WALL_REACH = 0.35;               // metres beyond the capsule a wall still counts as touching
const WALL_NORMAL_MAX_Y = Math.cos(85 * DEG); // MOV-023: walls are 85-95 deg from the floor
const WALL_RUN_MIN_SPEED = 4;          // MOV-023
const WALL_RUN_APPROACH_SIN = Math.sin(60 * DEG); // MOV-023: approach under 60 deg to the wall plane
const MANTLE_SECONDS = 0.35;           // MOV-022
const MANTLE_RISE_FRACTION = 0.6;      // share of the mantle spent rising before moving onto the ledge
const MANTLE_REACH = 0.3;              // how far in front of the capsule a ledge is looked for
const WATER_EXIT_HEIGHT = 1.6;         // ledge reach (feet to rim) in water in every preset: pools are never traps
const RAY_BUDGET = 3;                  // MOV-023: wall and ledge rays per actor per step
const WALL_FACING_COS = 0.7;           // looking this directly at a wall counts as facing it (climb, mantle)
const CLIMB_SPEED = 4.5;               // m/s up a climbable wall
const GRIP_MATERIAL = 'grip';          // climbGripOnly presets climb only brushes of this material
const LADDER_SPEED = 3.0;              // MOV-019
const LADDER_DOWN_PITCH = 30 * DEG;    // looking further down than this climbs down
const LADDER_PUSH_OFF = 4;             // m/s away from the ladder when jumping off
const LADDER_REGRAB_SECONDS = 0.3;
const SWIM_SPEED_FRACTION = 0.5;       // MOV-019: swim at 50% of ground speed
const WATER_FRICTION = 3;
const WATER_GRAVITY_SCALE = 0.1;       // slow sinking
const CHARGE_CONE_COS = Math.cos(25 * DEG); // shield charge locks onto enemies this close to the aim
const CHARGE_STOP_DISTANCE = 1.2;      // stop when this close to the charge target
const BULLET_JUMP_MIN_PITCH = 10 * DEG;
const AUTO_STRAFE_RATE = 2.5;          // MOV-018: rad/s the air velocity turns toward the view
const SKIMMER_SPEED = 13;              // MOV-027
const SKIMMER_KNOCKOFF_SECONDS = 2;
const SKIMMER_MIN_MAP_SIZE = 150;      // metres: only large maps allow the board
const SKIMMER_BOARD_RUN = 0.8;         // share of the ground speed an actor must run at to board with Use

const wallHit = makeHit();
const facing = { x: 0, y: 0, z: 0 };
const axes = { x: 0, z: 0 };

// ---- Shared helpers ----
// Takes `count` rays from this step's budget; false (and nothing taken) when they would pass RAY_BUDGET.
function spendRays(id, count) {
  if (Motion.rays[id] + count > RAY_BUDGET) return false;
  Motion.rays[id] += count;
  return true;
}

// Ray from the waist along (dirX, dirZ); fills wallHit and returns true for a near-vertical wall within reach.
function findWall(id, dirX, dirZ) {
  if (!spendRays(id, 1)) return false;
  const waist = Actors.y[id] + Actors.height[id] * 0.5;
  if (!World.raycast(Actors.x[id], waist, Actors.z[id], dirX, 0, dirZ, ACTOR_RADIUS + WALL_REACH, wallHit)) return false;
  return wallHit.distance > 0 && Math.abs(wallHit.ny) <= WALL_NORMAL_MAX_Y;
}

function findSideWall(id) {
  const yaw = Actors.yaw[id];
  return findWall(id, -Math.cos(yaw), Math.sin(yaw)) || findWall(id, Math.cos(yaw), -Math.sin(yaw));
}

function findAnyWall(id) { return findWall(id, Math.sin(Actors.yaw[id]), Math.cos(Actors.yaw[id])) || findSideWall(id); }

// Returns +1 / -1 when the axis was pushed the same way twice within DOUBLE_TAP_SECONDS, else 0.
function doubleTap(id, value, clockField, signField, lastField) {
  const sign = value >= TAP_THRESHOLD ? 1 : value <= -TAP_THRESHOLD ? -1 : 0;
  const last = Motion[lastField][id];
  Motion[lastField][id] = sign;
  if (sign === 0 || sign === last) return 0;
  const isDouble = Motion[signField][id] === sign && Motion[clockField][id] <= DOUBLE_TAP_SECONDS;
  Motion[signField][id] = isDouble ? 0 : sign;
  Motion[clockField][id] = 0;
  return isDouble ? sign : 0;
}

function setHorizontalSpeed(id, speed) {
  const current = Move.horizontalSpeed(id);
  if (current < 1e-6) return;
  Actors.vx[id] *= speed / current; Actors.vz[id] *= speed / current;
}

function wallJumpOff(id, preset) {
  Actors.vx[id] += Motion.wallNX[id] * preset.wallJumpOut; Actors.vz[id] += Motion.wallNZ[id] * preset.wallJumpOut;
  Actors.vy[id] = preset.wallJumpUp;
  leaveWall(id);
  launch(id, 'move.jump');
}

function leaveWall(id) {
  Motion.lastWallBrush[id] = Motion.wallBrush[id];
  setState(id, MOVE_STATE.WALK);
}

function grabWall(id, state) {
  Motion.wallNX[id] = wallHit.nx; Motion.wallNZ[id] = wallHit.nz; Motion.wallBrush[id] = wallHit.brush;
  setState(id, state);
}

function inWalkState(id) { return Motion.state[id] === MOVE_STATE.WALK; }

// True when the view points into the wall the actor was blocked by last step (climb, walk-in mantle).
function facingBlockedWall(id) {
  const into = -(Math.sin(Actors.yaw[id]) * Motion.blockNX[id] + Math.cos(Actors.yaw[id]) * Motion.blockNZ[id]);
  return Motion.blocked[id] === 1 && into >= WALL_FACING_COS;
}

// A dash or shield charge ends: no faster than ground speed, back to walking.
function endBurst(id, preset) {
  setHorizontalSpeed(id, Math.min(Move.horizontalSpeed(id), preset.groundSpeed));
  setState(id, MOVE_STATE.WALK);
}

// ---- Media: ladders and water (MOV-019) ----
function selectMedium(id) {
  const state = Motion.state[id], medium = Motion.medium[id];
  if (state === MOVE_STATE.MANTLE || state === MOVE_STATE.DASH || state === MOVE_STATE.CHARGE) return;
  if ((medium & TRIGGER_MEDIUM.LADDER) && getClock(id, CLOCK.LADDER_BLOCK) <= 0) { if (state !== MOVE_STATE.LADDER) setState(id, MOVE_STATE.LADDER); return; }
  if (medium & TRIGGER_MEDIUM.WATER) { if (state !== MOVE_STATE.SWIM) setState(id, MOVE_STATE.SWIM); return; }
  if (state === MOVE_STATE.LADDER || state === MOVE_STATE.SWIM) setState(id, MOVE_STATE.WALK);
}

function ladderState(id, preset, gravity, dt) {
  if (Motion.jumpPressed[id]) {
    Actors.vx[id] = -Math.sin(Actors.yaw[id]) * LADDER_PUSH_OFF; Actors.vz[id] = -Math.cos(Actors.yaw[id]) * LADDER_PUSH_OFF;
    Actors.vy[id] = preset.jumpVel * 0.5;
    setClock(id, CLOCK.LADDER_BLOCK, LADDER_REGRAB_SECONDS);
    setState(id, MOVE_STATE.WALK);
    launch(id, 'move.jump');
    integrate(id, gravity, dt);
    return;
  }
  const direction = horizontalWish(id), climbSign = Actors.pitch[id] < -LADDER_DOWN_PITCH ? -1 : 1;
  Actors.vx[id] = direction.x * direction.amount * LADDER_SPEED; Actors.vz[id] = direction.z * direction.amount * LADDER_SPEED;
  Actors.vy[id] = (Actors.buttons[id] & BTN.CROUCH) ? -LADDER_SPEED : Motion.inputZ[id] * climbSign * LADDER_SPEED;
  integrate(id, 0, dt);
}

function swimState(id, preset, gravity, dt) {
  applyFriction(id, WATER_FRICTION, preset.stopSpeed, dt, true);
  // Forward follows the view in 3D (pitch included); strafe stays level; jump and crouch swim straight up and down.
  const up = ((Actors.buttons[id] & BTN.JUMP) ? 1 : 0) - ((Actors.buttons[id] & BTN.CROUCH) ? 1 : 0);
  const forward = Motion.inputZ[id], pitch = Actors.pitch[id];
  yawToWorld(Actors.yaw[id], forward * Math.cos(pitch), Motion.inputX[id], axes);
  const y = Math.sin(pitch) * forward + up, length = Math.hypot(axes.x, y, axes.z);
  if (length > 1e-6) accelerate(id, axes.x / length, y / length, axes.z / length, preset.groundSpeed * SWIM_SPEED_FRACTION * Math.min(1, length), preset.accel, dt);
  integrate(id, gravity * WATER_GRAVITY_SCALE, dt);
}

// ---- Slide (MV03, MV04, MV08) ----
function updateSlide(id, preset) {
  if (preset.slideEntry <= 0) return;
  if (Motion.sliding[id]) { checkSlideEnd(id, preset); return; }
  if (!(Actors.pressed[id] & BTN.CROUCH) || !Motion.grounded[id] || !inWalkState(id) || Motion.board[id]) return;
  if (getClock(id, CLOCK.SLIDE_COOLDOWN) > 0 || Move.horizontalSpeed(id) < preset.slideEntry) return;
  startSlide(id, preset);
}

function startSlide(id, preset) {
  let speed = Math.max(Move.horizontalSpeed(id), preset.slideBoost);
  if (preset.slideBoostAdd > 0 && Motion.slideBoostClock[id] >= preset.slideBoostInterval) {
    speed += preset.slideBoostAdd;
    Motion.slideBoostClock[id] = 0;
  }
  setHorizontalSpeed(id, speed);
  Motion.sliding[id] = 1;
  Motion.slideTime[id] = 0;
  emitMove('move.slide', id, speed, surfaceOf(id));
}

function checkSlideEnd(id, preset) {
  Motion.slideTime[id] += TICK_SECONDS;
  const timeUp = preset.slideTime > 0 && Motion.slideTime[id] >= preset.slideTime;
  const tooSlow = Move.horizontalSpeed(id) < preset.groundSpeed * preset.crouchMult;
  if (Motion.grounded[id] && (Actors.buttons[id] & BTN.CROUCH) && !timeUp && !tooSlow) return;
  Motion.sliding[id] = 0;
  setClock(id, CLOCK.SLIDE_COOLDOWN, preset.slideCooldown);
}

// Downhill gain: gravity along the floor's slope speeds a slide up (MV04 "downhill gain").
function slideDownhill(id, preset, dt) {
  if (!preset.slideDownhill) return;
  const gravity = actorGravity(id, preset);
  Actors.vx[id] += Motion.groundNX[id] * gravity * dt; Actors.vz[id] += Motion.groundNZ[id] * gravity * dt;
}

// Slide-hop (MV04/MV08): landing with crouch held at slide speed slides at once, so the momentum is kept.
function slideHopLanding(id, preset) {
  if (!preset.slideHop || Motion.sliding[id] || !(Actors.buttons[id] & BTN.CROUCH)) return;
  if (Move.horizontalSpeed(id) >= preset.slideEntry) startSlide(id, preset);
}

// ---- Dodge (MV01) and tactical sprint (MV03): double taps ----
function tryDodge(id, preset) {
  const tapX = doubleTap(id, Motion.inputX[id], 'tapClockX', 'tapSignX', 'lastAxisX');
  const tapZ = doubleTap(id, Motion.inputZ[id], 'tapClockZ', 'tapSignZ', 'lastAxisZ');
  if (preset.dodgeSpeed <= 0 || (tapX === 0 && tapZ === 0) || getClock(id, CLOCK.DODGE_COOLDOWN) > 0 || !inWalkState(id)) return;
  yawToWorld(Actors.yaw[id], tapZ, tapX, axes);
  const length = Math.hypot(axes.x, axes.z), x = axes.x / length, z = axes.z / length;
  if (!Motion.grounded[id] && !(preset.wallDodge && findWall(id, -x, -z))) return;
  Actors.vx[id] = x * preset.dodgeSpeed; Actors.vz[id] = z * preset.dodgeSpeed; Actors.vy[id] = preset.dodgeUp;
  setClock(id, CLOCK.DODGE_COOLDOWN, preset.dodgeCooldown);
  launch(id, 'move.dash');
}

function tryTacticalSprint(id, preset) {
  const tap = doubleTap(id, (Actors.buttons[id] & BTN.SPRINT) ? 1 : 0, 'tapClockSprint', 'tapSignSprint', 'lastAxisSprint');
  if (tap !== 1 || preset.tacSprintCharges <= 0 || Motion.tacCharges[id] < 1 || !Motion.grounded[id]) return;
  Motion.tacCharges[id]--;
  setClock(id, CLOCK.TAC_SPRINT, preset.tacSprintTime);
}

// ---- Dash (MV05) and shield charge (MV06): the sprint key in presets without sprint ----
function tryDash(id, preset) {
  if (preset.dashCharges <= 0) return;
  if (Motion.grounded[id] || !preset.dashGroundRecharge) Motion.dashCharges[id] = Math.min(preset.dashCharges, Motion.dashCharges[id] + TICK_SECONDS / preset.dashRecharge);
  if (!(Actors.pressed[id] & BTN.SPRINT) || Motion.dashCharges[id] < 1 || !inWalkState(id)) return;
  Motion.dashCharges[id]--;
  const direction = horizontalWish(id);
  const yaw = Actors.yaw[id], aimed = direction.amount > 0;
  Motion.dirX[id] = aimed ? direction.x : Math.sin(yaw); Motion.dirZ[id] = aimed ? direction.z : Math.cos(yaw);
  setState(id, MOVE_STATE.DASH);
  emitMove('move.dash', id, preset.dashDistance / preset.dashTime, surfaceOf(id));
}

function dashState(id, preset, gravity, dt) {
  const speed = preset.dashDistance / preset.dashTime;
  Actors.vx[id] = Motion.dirX[id] * speed; Actors.vy[id] = 0; Actors.vz[id] = Motion.dirZ[id] * speed;
  integrate(id, 0, dt);
  if (Motion.stateTime[id] + dt < preset.dashTime) return;
  endBurst(id, preset);
}

function tryCharge(id, preset) {
  if (preset.chargeSpeed <= 0 || !(Actors.pressed[id] & BTN.SPRINT) || getClock(id, CLOCK.CHARGE_COOLDOWN) > 0 || !inWalkState(id)) return;
  Motion.target[id] = chargeTarget(id, preset.chargeRange);
  Motion.dirX[id] = Math.sin(Actors.yaw[id]); Motion.dirZ[id] = Math.cos(Actors.yaw[id]);
  setClock(id, CLOCK.CHARGE_COOLDOWN, preset.chargeCooldown);
  setState(id, MOVE_STATE.CHARGE);
  emitMove('move.dash', id, preset.chargeSpeed, surfaceOf(id));
}

// Nearest visible enemy within range and close to the aim direction, or -1.
function chargeTarget(id, range) {
  const forwardX = Math.sin(Actors.yaw[id]), forwardZ = Math.cos(Actors.yaw[id]), eyeY = Actors.eyeY(id);
  let best = -1, bestDistance = range;
  for (let other = 0; other < Actors.count; other++) {
    if (!Actors.alive[other] || !Actors.isEnemy(id, other)) continue;
    const dx = Actors.x[other] - Actors.x[id], dz = Actors.z[other] - Actors.z[id], distance = Math.hypot(dx, dz);
    if (distance >= bestDistance || distance < 1e-3 || (dx * forwardX + dz * forwardZ) / distance < CHARGE_CONE_COS) continue;
    if (!World.lineClear(Actors.x[id], eyeY, Actors.z[id], Actors.x[other], Actors.eyeY(other), Actors.z[other])) continue;
    best = other; bestDistance = distance;
  }
  return best;
}

function chargeState(id, preset, gravity, dt) {
  const target = Motion.target[id];
  if (target >= 0 && Actors.alive[target]) aimChargeAt(id, target);
  Actors.vx[id] = Motion.dirX[id] * preset.chargeSpeed; Actors.vz[id] = Motion.dirZ[id] * preset.chargeSpeed;
  integrate(id, Motion.grounded[id] ? 0 : gravity, dt);
  const travelled = (Motion.stateTime[id] + dt) * preset.chargeSpeed;
  const arrived = target >= 0 && Math.hypot(Actors.x[target] - Actors.x[id], Actors.z[target] - Actors.z[id]) <= CHARGE_STOP_DISTANCE;
  if (travelled < preset.chargeDistance && !arrived && !Motion.blocked[id]) return;
  endBurst(id, preset);
}

function aimChargeAt(id, target) {
  const dx = Actors.x[target] - Actors.x[id], dz = Actors.z[target] - Actors.z[id], distance = Math.hypot(dx, dz);
  if (distance < 1e-3) return;
  Motion.dirX[id] = dx / distance; Motion.dirZ[id] = dz / distance;
}

// ---- Mantle (MOV-022), water exit and climb ----
function tryMantle(id, preset) {
  const reach = mantleReach(id, preset);
  if (reach <= 0 || Motion.stance[id] === STANCE.PRONE || Motion.board[id]) return;
  if (!Motion.jumpPressed[id] && !(Motion.inputZ[id] > 0 && facingBlockedWall(id))) return;
  if (!findLedge(id, reach)) return;
  Motion.fromX[id] = Actors.x[id]; Motion.fromY[id] = Actors.y[id]; Motion.fromZ[id] = Actors.z[id];
  Actors.vx[id] = Actors.vy[id] = Actors.vz[id] = 0;
  Motion.jumpPressed[id] = 0; setClock(id, CLOCK.JUMP_BUFFER, 0);
  setState(id, MOVE_STATE.MANTLE);
  emitMove('move.mantle', id, Motion.toY[id] - Actors.y[id], surfaceOf(id));
}

// How high a ledge the actor can mantle: the preset's mantleHeight on foot; in or at the water at least
// WATER_EXIT_HEIGHT, so swimmers climb out over a rim at or just above the surface in every preset. 0 = no mantle.
function mantleReach(id, preset) {
  const state = Motion.state[id];
  if (state !== MOVE_STATE.WALK && state !== MOVE_STATE.SWIM) return 0;
  const inWater = state === MOVE_STATE.SWIM || (Motion.medium[id] & TRIGGER_MEDIUM.WADING) !== 0;
  return inWater ? Math.max(preset.mantleHeight, WATER_EXIT_HEIGHT) : preset.mantleHeight;
}

// A wall in front at knee height, walkable floor on top within reach, room to stand there and to rise to it (2 rays).
function findLedge(id, maxHeight) {
  if (!spendRays(id, 2)) return false;
  const x = Actors.x[id], y = Actors.y[id], z = Actors.z[id], forwardX = Math.sin(Actors.yaw[id]), forwardZ = Math.cos(Actors.yaw[id]);
  if (!World.raycast(x, y + STEP_HEIGHT + COLLISION_SKIN, z, forwardX, 0, forwardZ, ACTOR_RADIUS + MANTLE_REACH, wallHit)) return false;
  if (Math.abs(wallHit.ny) > WALL_NORMAL_MAX_Y || wallHit.distance <= 0) return false;
  const ledgeX = wallHit.x + forwardX * (ACTOR_RADIUS + COLLISION_SKIN * 4), ledgeZ = wallHit.z + forwardZ * (ACTOR_RADIUS + COLLISION_SKIN * 4);
  const top = y + maxHeight + COLLISION_SKIN;
  const ledgeY = World.floorBelow(ledgeX, top, ledgeZ, maxHeight - STEP_HEIGHT, wallHit);
  if (!(ledgeY > y + STEP_HEIGHT) || wallHit.distance <= 0) return false;
  const standY = ledgeY + COLLISION_SKIN * 2;
  if (!World.capsuleFits(ledgeX, standY, ledgeZ, ACTOR_RADIUS, Actors.height[id])) return false;
  if (World.sweepCapsule(x, y, z, x, standY, z, ACTOR_RADIUS, Actors.height[id], Collide.trace)) return false;
  Motion.toX[id] = ledgeX; Motion.toY[id] = standY; Motion.toZ[id] = ledgeZ;
  return true;
}

// Rise first, then move onto the ledge; the weapon is lowered (Move.canFire) for MANTLE_SECONDS.
function mantleState(id, preset, gravity, dt) {
  const progress = Math.min(1, (Motion.stateTime[id] + dt) / MANTLE_SECONDS);
  const rise = smoothstep(0, MANTLE_RISE_FRACTION, progress), across = smoothstep(MANTLE_RISE_FRACTION, 1, progress);
  Actors.x[id] = lerp(Motion.fromX[id], Motion.toX[id], across);
  Actors.y[id] = lerp(Motion.fromY[id], Motion.toY[id], rise);
  Actors.z[id] = lerp(Motion.fromZ[id], Motion.toZ[id], across);
  Actors.vx[id] = Actors.vy[id] = Actors.vz[id] = 0;
  if (progress < 1) return;
  setState(id, MOVE_STATE.WALK);
  integrate(id, gravity, dt); // settles onto the ledge and finds the floor
}

// Climbing up a wall while pushing into it (MV04/MV08 2.5 m, MV05 6 m on grip surfaces); the mantle takes over at the top.
function climbWall(id, preset, dt) {
  if (preset.climbHeight <= 0 || !facingBlockedWall(id) || Motion.inputZ[id] <= 0 || Motion.climbed[id] >= preset.climbHeight) return;
  const brush = Motion.wallBrush[id];
  if (preset.climbGripOnly && (!brush || brush.material !== GRIP_MATERIAL)) return;
  Actors.vy[id] = Math.max(Actors.vy[id], CLIMB_SPEED);
  Motion.climbed[id] += CLIMB_SPEED * dt;
}

// ---- Wall-run (MOV-023, MV04) and wall latch (MV08) ----
function tryWallRun(id, preset) {
  if (preset.wallRunTime <= 0 || !inWalkState(id) || Motion.grounded[id] || Motion.inputZ[id] <= 0) return;
  const speed = Move.horizontalSpeed(id);
  if (speed < WALL_RUN_MIN_SPEED || !findSideWall(id) || wallHit.brush === Motion.lastWallBrush[id]) return;
  if (Math.abs(Actors.vx[id] * wallHit.nx + Actors.vz[id] * wallHit.nz) / speed > WALL_RUN_APPROACH_SIN) return;
  if (!spendRays(id, 1) || !Number.isNaN(World.floorBelow(Actors.x[id], Actors.y[id], Actors.z[id], preset.wallRunMinHeight))) return;
  grabWall(id, MOVE_STATE.WALL_RUN);
  Actors.vy[id] = Math.max(Actors.vy[id], 0);
  emitMove('move.wallrun', id, speed, Motion.wallBrush[id] ? Motion.wallBrush[id].material : 'concrete');
}

function wallRunState(id, preset, gravity, dt) {
  if (Motion.jumpPressed[id]) { wallJumpOff(id, preset); integrate(id, gravity, dt); return; }
  const stillOnWall = findWall(id, -Motion.wallNX[id], -Motion.wallNZ[id]);
  if (Motion.stateTime[id] >= preset.wallRunTime || Motion.inputZ[id] <= 0 || !stillOnWall) { leaveWall(id); integrate(id, gravity, dt); return; }
  const into = Actors.vx[id] * Motion.wallNX[id] + Actors.vz[id] * Motion.wallNZ[id];
  Actors.vx[id] -= Motion.wallNX[id] * into; Actors.vz[id] -= Motion.wallNZ[id] * into;
  setHorizontalSpeed(id, preset.wallRunSpeed);
  integrate(id, gravity * preset.wallRunGravity, dt);
  if (Motion.grounded[id]) setState(id, MOVE_STATE.WALK);
}

function tryLatch(id, preset) {
  if (preset.wallLatchTime <= 0 || !inWalkState(id) || Motion.grounded[id] || !(Actors.pressed[id] & BTN.ALT)) return;
  if (!findAnyWall(id)) return;
  grabWall(id, MOVE_STATE.LATCH);
  Actors.vx[id] = Actors.vy[id] = Actors.vz[id] = 0;
}

function latchState(id, preset, gravity, dt) {
  if (Motion.jumpPressed[id]) { wallJumpOff(id, preset); integrate(id, gravity, dt); return; }
  if (!(Actors.buttons[id] & BTN.ALT) || Motion.stateTime[id] >= preset.wallLatchTime) { leaveWall(id); integrate(id, gravity, dt); return; }
  Actors.vx[id] = Actors.vy[id] = Actors.vz[id] = 0;
}

// ---- Air extras: glide (MV08), auto-strafe assist (MOV-018), bullet jump (MV08) ----
function updateGlide(id, preset) {
  const gliding = preset.glideTime > 0 && !Motion.grounded[id] && inWalkState(id) && (Actors.buttons[id] & BTN.ALT) && Motion.glideUsed[id] < preset.glideTime;
  Motion.gliding[id] = gliding ? 1 : 0;
  if (gliding) Motion.glideUsed[id] += TICK_SECONDS;
}

function airGravityScale(id, preset) { return Motion.gliding[id] ? preset.glideGravity : 1; }

// Turns the air velocity toward the view while flying forward, speed unchanged.
function autoStrafe(id, dt) {
  if (Motion.inputZ[id] <= 0 || Math.abs(Motion.inputX[id]) > 0.1) return;
  const speed = Move.horizontalSpeed(id);
  if (speed < 1) return;
  const velocityYaw = Math.atan2(Actors.vx[id], Actors.vz[id]);
  const turned = velocityYaw + clamp(wrapAngle(Actors.yaw[id] - velocityYaw), -AUTO_STRAFE_RATE * dt, AUTO_STRAFE_RATE * dt);
  Actors.vx[id] = Math.sin(turned) * speed; Actors.vz[id] = Math.cos(turned) * speed;
}

function tryBulletJump(id, preset) {
  if (preset.bulletJumpSpeed <= 0 || (!Motion.sliding[id] && Motion.stance[id] !== STANCE.CROUCH)) return false;
  Vec.fromAngles(facing, Actors.yaw[id], Math.max(Actors.pitch[id], BULLET_JUMP_MIN_PITCH));
  Actors.vx[id] = facing.x * preset.bulletJumpSpeed; Actors.vy[id] = facing.y * preset.bulletJumpSpeed; Actors.vz[id] = facing.z * preset.bulletJumpSpeed;
  launch(id, 'move.jump');
  return true;
}

// ---- Landing extras: roll (-75% damage) and hard-landing stagger (MV08) ----
function rollOrStagger(id, preset, impactSpeed) {
  if (preset.rollTime > 0 && (Actors.buttons[id] & BTN.CROUCH)) { setClock(id, CLOCK.ROLL, preset.rollTime); return; }
  if (preset.staggerSpeed > 0 && impactSpeed >= preset.staggerSpeed) setClock(id, CLOCK.STAGGER, preset.staggerTime);
}

// ---- Skimmer board (MOV-027): large maps only, 13 m/s, no weapons, knocked off for 2 s by any hit ----
function mapSize(map) {
  if (!map || map.size === undefined) return 0;
  return Array.isArray(map.size) ? Math.max(...map.size) : map.size;
}

Move.setBoard = function setBoard(id, on) {
  if (!on) { Motion.board[id] = 0; return true; }
  if (getClock(id, CLOCK.BOARD_BLOCK) > 0 || mapSize(World.map) < SKIMMER_MIN_MAP_SIZE) return false;
  Motion.board[id] = 1;
  return true;
};
Move.onBoard = (id) => Motion.board[id] === 1;
// Boarding (Q5): Use while running on the ground (at least SKIMMER_BOARD_RUN of the preset's ground speed) deploys the board,
// which keeps it apart from Use on objectives and loot (done standing or walking); Use while riding steps off.
function toggleBoard(id, preset) {
  if (!(Actors.pressed[id] & BTN.USE)) return;
  if (Motion.board[id]) { Move.setBoard(id, false); return; }
  const running = Math.hypot(Actors.vx[id], Actors.vz[id]) >= preset.groundSpeed * SKIMMER_BOARD_RUN;
  if (running && Motion.grounded[id]) Move.setBoard(id, true);
}

Bus.on('damage', (event) => {
  if (!Motion.board[event.target]) return;
  Motion.board[event.target] = 0;
  setClock(event.target, CLOCK.BOARD_BLOCK, SKIMMER_KNOCKOFF_SECONDS);
});

Move.states[MOVE_STATE.MANTLE] = mantleState;
Move.states[MOVE_STATE.DASH] = dashState;
Move.states[MOVE_STATE.CHARGE] = chargeState;
Move.states[MOVE_STATE.WALL_RUN] = wallRunState;
Move.states[MOVE_STATE.LATCH] = latchState;
Move.states[MOVE_STATE.LADDER] = ladderState;
Move.states[MOVE_STATE.SWIM] = swimState;
Move.actions.push(selectMedium, tryMantle, tryDodge, tryTacticalSprint, tryDash, tryCharge, updateSlide, tryWallRun, tryLatch, updateGlide, toggleBoard);
Move.landHooks.push(rollOrStagger, slideHopLanding);
