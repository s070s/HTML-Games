// Bot navigation (BOT-010..BOT-012): paths from Nav.request (the nav system serves at most 4 queries per tick, BOT-091),
// steering along the smoothed points with the same move input as the player, link moves by type (jump with an extra jump
// when the link is higher than one jump, crouch, ladder, swim, pads and teleporters by walking in), local avoidance of other
// actors and stuck recovery: no progress 1.5 s -> jump and strafe, 3 s -> repath avoiding the node ahead, 6 s -> new goal.
// Jump links are filtered by the bot's own movement preset (allowJumpHeight, reach, gravity).

const PATH = { NONE: 0, WAITING: 1, FOLLOW: 2, FAILED: 3, ARRIVED: 4 };
const MOVE_ARRIVE = 0.6;                // m: a path point counts as reached this close (horizontal)...
const MOVE_ARRIVE_HEIGHT = 1.6;         // ...and this close in height
const MOVE_LANDING_HEIGHT = 3;          // jump, drop and pad landings may be reached from higher up
const MOVE_SLOW_RADIUS = 1.2;           // slow down this close to the final destination
const MOVE_DIRECT_RADIUS = 4;           // after the last point, walk straight to a destination this close
const MOVE_REPATH_DISTANCE = 2;         // a destination moved further than this needs a new path...
const MOVE_REPATH_INTERVAL = 0.75;      // ...at most this often (moving targets: carriers, chased enemies)
const MOVE_OFF_PATH = 12;               // farther than this from the next point (knockback, teleport): new path
const MOVE_SAMPLE_SECONDS = 0.5;        // stuck check period
const MOVE_PROGRESS = 0.3;              // m moved per sample that counts as progress
const MOVE_INTENT = 0.3;                // wish amount above which no progress counts as stuck
const STUCK_JUMP = 1.5, STUCK_REPATH = 3, STUCK_GIVE_UP = 6;   // BOT-012 seconds
const STUCK_STRAFE_SECONDS = 0.6;
const STUCK_STRAFE_ANGLE = 70 * DEG;
const STUCK_BACK_ANGLE = Math.PI;       // every second attempt backs away from the obstacle
const MOVE_EXTRA_JUMP_RISE = 0.5;       // m/s: an extra jump is pressed near the apex of the first
const MOVE_AVOID_RADIUS = 1.1;          // m: another capsule this close ahead pushes the bot sideways
const MOVE_AVOID_AHEAD = 0.3;           // cosine: only actors in front
const MOVE_AVOID_PUSH = 0.8;
const BOT_LADDER_UP_PITCH = 40 * DEG, BOT_LADDER_DOWN_PITCH = -50 * DEG;   // S10: looking down > 30 deg descends a ladder
const MOVE_SWIM_RISE = 0.5;
const LADDER_SEARCH = 4;                // m: the ladder volume of a ladder link lies this close to its bottom point
const LADDER_STEP_OFF = 0.6;            // m below the top point: leave the volume and walk onto the top
const LADDER_REACH = 0.8;               // m from the volume's middle: on the ladder
const STUCK_LOG_SIZE = 16;

const movePoint = Vec.make();
const rimHit = { distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null };
const WATER_EXIT_CHECK = 2.5;           // m from a water exit: look for the rim a swimmer climbs out over (S10 mantle)
const WATER_RIM_RAY = 3;

const BotMove = {
  state: new Uint8Array(MAX_ACTORS),
  destX: new Float32Array(MAX_ACTORS), destY: new Float32Array(MAX_ACTORS), destZ: new Float32Array(MAX_ACTORS),
  destRadius: new Float32Array(MAX_ACTORS), hasDest: new Uint8Array(MAX_ACTORS), requestedAt: new Float64Array(MAX_ACTORS).fill(-1e9),
  navVersion: new Int32Array(MAX_ACTORS), pending: new Uint8Array(MAX_ACTORS), pathSerial: new Uint32Array(MAX_ACTORS),
  samplePoint: new Int16Array(MAX_ACTORS), sampleSerial: new Uint32Array(MAX_ACTORS), sampleDistance: new Float32Array(MAX_ACTORS),
  pointIndex: new Int16Array(MAX_ACTORS), pointCount: new Int16Array(MAX_ACTORS),
  pointX: new Float32Array(MAX_ACTORS), pointY: new Float32Array(MAX_ACTORS), pointZ: new Float32Array(MAX_ACTORS),
  ladderX: new Float32Array(MAX_ACTORS), ladderZ: new Float32Array(MAX_ACTORS),   // climbing target of a ladder link
  exitChecked: new Uint8Array(MAX_ACTORS),
  segmentType: new Uint8Array(MAX_ACTORS), segmentHeight: new Float32Array(MAX_ACTORS), extraJumped: new Uint8Array(MAX_ACTORS),
  sampleX: new Float32Array(MAX_ACTORS), sampleY: new Float32Array(MAX_ACTORS), sampleZ: new Float32Array(MAX_ACTORS), sampleAt: new Float64Array(MAX_ACTORS),
  stuckTime: new Float32Array(MAX_ACTORS), recoverUntil: new Float64Array(MAX_ACTORS), recoverSide: new Int8Array(MAX_ACTORS).fill(1),
  recoverAngle: new Float32Array(MAX_ACTORS),
  repathed: new Uint8Array(MAX_ACTORS), avoidNode: new Int32Array(MAX_ACTORS).fill(-1),
  stuckSeconds: new Float32Array(MAX_ACTORS), longestStuck: new Float32Array(MAX_ACTORS),
  options: [], avoidOptions: [],
  log: makePool(STUCK_LOG_SIZE, () => ({ id: -1, x: 0, z: 0, time: 0 })), logCount: 0,

  init() {
    for (let id = 0; id < MAX_ACTORS; id++) {
      this.options.push({ allowJumpHeight: Nav.limits.jumpUp, maxDrop: Nav.limits.safeDrop, crouchOk: true, moveSpeed: Infinity, jumpVelocity: 0, gravity: GRAVITY, avoid: null });
      const avoid = (node) => (node === this.avoidNode[id] ? Infinity : extraCost(node));   // one closure per slot, made once at load
      this.avoidOptions.push(Object.assign({}, this.options[id], { avoid }));
    }
  },
  reset(id) {
    this.state[id] = PATH.NONE; this.hasDest[id] = 0; this.stuckTime[id] = 0; this.recoverUntil[id] = 0;
    this.takeSample(id, Sim.time);
    this.pointCount[id] = 0; this.pointIndex[id] = 0; this.avoidNode[id] = -1; this.requestedAt[id] = -1e9; this.pending[id] = 0;
    Nav.cancel(id);
  },
  // Path options from the bot's movement preset and tier (BOT-010 "preset-aware"): tiers without jumps skip extra jumps.
  configure(id) {
    const preset = Move.preset(id), gravity = Move.gravity(id), tier = Bots.tier(id);
    const single = preset.jumpVel * preset.jumpVel / (2 * gravity);
    const extra = tier.jumps ? preset.extraJumps * preset.extraJumpVel * preset.extraJumpVel / (2 * gravity) : 0;
    for (const options of [this.options[id], this.avoidOptions[id]]) {
      options.allowJumpHeight = single + extra;
      options.moveSpeed = preset.groundSpeed * tier.speed;
      options.jumpVelocity = preset.jumpVel;
      options.gravity = gravity;
    }
  },
  // Destination for the execution layer; a nearby change keeps the current path (moving targets repath at most 1.3 Hz).
  goTo(id, x, y, z, radius) {
    const moved = Math.hypot(x - this.destX[id], z - this.destZ[id]);
    this.destRadius[id] = radius;
    if (this.hasDest[id] && moved < MOVE_REPATH_DISTANCE && this.state[id] !== PATH.FAILED) {
      this.destX[id] = x; this.destY[id] = y; this.destZ[id] = z;
      return;
    }
    this.destX[id] = x; this.destY[id] = y; this.destZ[id] = z;
    // A new path at most every 0.75 s: a newer destination waits for update() to ask for it.
    if (this.hasDest[id] && this.state[id] !== PATH.FAILED && Sim.time - this.requestedAt[id] < MOVE_REPATH_INTERVAL) { this.pending[id] = 1; return; }
    this.hasDest[id] = 1;
    this.avoidNode[id] = -1;
    this.request(id, this.options[id]);
  },
  stop(id) { this.hasDest[id] = 0; this.state[id] = PATH.NONE; Nav.cancel(id); },
  arrived(id) { return this.hasDest[id] === 1 && this.state[id] === PATH.ARRIVED; },
  failed(id) { return this.state[id] === PATH.FAILED; },
  distanceToDestination(id) { return Math.hypot(this.destX[id] - Actors.x[id], this.destZ[id] - Actors.z[id]); },
  request(id, options) {
    if (options === this.options[id]) options.avoid = mapHasWater || trapsActive(Sim.time) ? extraCost : null;   // else paths stay cacheable
    this.requestedAt[id] = Sim.time;
    this.pathSerial[id]++;
    this.pending[id] = 0;
    this.navVersion[id] = Nav.version;
    const from = Nav.nearestNode(Actors.x[id], Actors.y[id], Actors.z[id]);
    const to = Nav.nearestNode(this.destX[id], this.destY[id], this.destZ[id]);
    this.pointCount[id] = 0;
    if (from < 0 || to < 0) { this.state[id] = PATH.FAILED; return; }
    this.state[id] = PATH.WAITING;
    Nav.request(id, from, to, options);
  },

  // ---- Per tick: path state, steering, link moves, stuck recovery ----
  update(id, dt, now) {
    this.checkStuck(id, now);
    if (!this.hasDest[id]) { Bots.wish(id, 0, 0, 0); return; }
    const due = this.pending[id] && Sim.time - this.requestedAt[id] >= MOVE_REPATH_INTERVAL;
    if (this.navVersion[id] !== Nav.version || due) this.request(id, this.options[id]);   // the map reloaded, or a newer destination
    if (this.state[id] === PATH.WAITING) this.collect(id);
    if (this.state[id] === PATH.FAILED || this.state[id] === PATH.WAITING) { Bots.wish(id, 0, 0, 0); return; }
    if (this.reachedDestination(id)) { this.state[id] = PATH.ARRIVED; Bots.wish(id, 0, 0, 0); return; }
    this.state[id] = PATH.FOLLOW;
    this.follow(id, now);
  },
  collect(id) {
    const status = Nav.result(id);
    if (status === NAV_STATUS.FAILED || status === NAV_STATUS.NONE) { this.state[id] = PATH.FAILED; return; }
    if (status !== NAV_STATUS.DONE) return;
    this.pointCount[id] = Nav.resultPointCount(id);
    this.state[id] = PATH.FOLLOW;
    this.selectPoint(id, this.pointCount[id] > 1 ? 1 : this.pointCount[id]);
  },
  reachedDestination(id) {
    const dy = Math.abs(this.destY[id] - Actors.y[id]);
    return this.distanceToDestination(id) <= this.destRadius[id] && dy < MOVE_ARRIVE_HEIGHT && (this.pointIndex[id] >= this.pointCount[id] - 1);
  },
  // Point index i is the next target; the move toward it is the type stored at point i - 1.
  selectPoint(id, index) {
    this.pointIndex[id] = index;
    this.extraJumped[id] = 0;
    this.exitChecked[id] = 0;
    if (index >= this.pointCount[id]) return;
    const type = index > 0 ? Nav.resultPoint(id, index - 1, movePoint) : NAV_LINK.WALK;
    const startY = index > 0 ? movePoint.y : Actors.y[id];
    Nav.resultPoint(id, index, movePoint);
    this.pointX[id] = movePoint.x; this.pointY[id] = movePoint.y; this.pointZ[id] = movePoint.z;
    this.segmentType[id] = type;
    this.segmentHeight[id] = movePoint.y - startY;
    if (type === NAV_LINK.LADDER) this.findLadder(id, index);
    if (type === NAV_LINK.JUMP) Bots.press(id, BTN.JUMP);   // the bot stands at the take-off point now
  },
  // The ladder volume (S08 trigger) next to the link's bottom point: the bot climbs by walking into its middle.
  findLadder(id, index) {
    Nav.resultPoint(id, index - 1, movePoint);
    const bottomX = movePoint.x, bottomZ = movePoint.z;
    Nav.resultPoint(id, index, movePoint);
    this.ladderX[id] = movePoint.x; this.ladderZ[id] = movePoint.z;
    let best = LADDER_SEARCH;
    for (const trigger of World.triggers) {
      if (trigger.kind !== 'ladder') continue;
      const x = (trigger.minX + trigger.maxX) / 2, z = (trigger.minZ + trigger.maxZ) / 2;
      const distance = Math.min(Math.hypot(x - bottomX, z - bottomZ), Math.hypot(x - movePoint.x, z - movePoint.z));
      if (distance < best) { best = distance; this.ladderX[id] = x; this.ladderZ[id] = z; }
    }
  },
  // Walking to the ladder: below its top and not yet at the volume (on it, facing the top point climbs at full speed).
  climbing(id) {
    if (this.segmentType[id] !== NAV_LINK.LADDER || Actors.y[id] >= this.pointY[id] - LADDER_STEP_OFF) return false;
    return Math.hypot(this.ladderX[id] - Actors.x[id], this.ladderZ[id] - Actors.z[id]) > LADDER_REACH;
  },
  // Ladders, water exits and jumps up onto ledges are climbed by facing them (S10 climbs and mantles along the view),
  // so on those links the movement owns the view and combat footwork waits.
  // A swimmer climbs out by mantling over a rim; a thin deck above the water has none (the ray passes under it), so
  // that exit is marked as a trap and the bot routes to another one. Checked once per exit, near it (one ray).
  waterExitBlocked(id, dx, dz, distance) {
    if (this.exitChecked[id] || this.segmentType[id] !== NAV_LINK.SWIM || distance > WATER_EXIT_CHECK || distance < 1e-3) return false;
    if (this.pointY[id] <= Actors.y[id] + STEP_HEIGHT) return false;
    this.exitChecked[id] = 1;
    return !World.raycast(Actors.x[id], Actors.y[id] + STEP_HEIGHT + COLLISION_SKIN, Actors.z[id], dx / distance, 0, dz / distance, WATER_RIM_RAY, rimHit);
  },
  ownsView(id) {
    if (this.pointIndex[id] >= this.pointCount[id]) return false;
    const type = this.segmentType[id];
    if (type === NAV_LINK.LADDER) return true;
    return type === NAV_LINK.JUMP && this.pointY[id] > Actors.y[id] + STEP_HEIGHT;
  },
  follow(id, now) {
    this.advance(id);
    const atEnd = this.pointIndex[id] >= this.pointCount[id], climbing = !atEnd && this.climbing(id);
    const tx = atEnd ? this.destX[id] : climbing ? this.ladderX[id] : this.pointX[id];
    const tz = atEnd ? this.destZ[id] : climbing ? this.ladderZ[id] : this.pointZ[id];
    const dx = tx - Actors.x[id], dz = tz - Actors.z[id], distance = Math.hypot(dx, dz);
    if (!atEnd && !climbing && distance > MOVE_OFF_PATH && now - this.requestedAt[id] > MOVE_REPATH_INTERVAL) { this.request(id, this.options[id]); return; }
    // Past the last point and the destination is still far: it lies off the graph, the end of the path is as close as it gets.
    if (atEnd && this.distanceToDestination(id) > MOVE_DIRECT_RADIUS) { this.state[id] = PATH.ARRIVED; Bots.wish(id, 0, 0, 0); return; }
    const amount = atEnd ? clamp(this.distanceToDestination(id) / MOVE_SLOW_RADIUS, 0.25, 1) : 1;
    if (!atEnd && this.waterExitBlocked(id, dx, dz, distance)) { this.repathAround(id); return; }
    this.steer(id, dx, dz, amount, now);
    this.linkMove(id);
    if (BotCombat.target[id] < 0 || this.ownsView(id)) this.lookAlong(id, tx, tz);
  },
  advance(id) {
    for (let guard = 0; guard < 3 && this.pointIndex[id] < this.pointCount[id]; guard++) {
      if (!this.pointReached(id)) return;
      this.selectPoint(id, this.pointIndex[id] + 1);
    }
  },
  pointReached(id) {
    const flat = Math.hypot(this.pointX[id] - Actors.x[id], this.pointZ[id] - Actors.z[id]);
    const type = this.segmentType[id];
    const tall = type === NAV_LINK.JUMP || type === NAV_LINK.DROP || type === NAV_LINK.JUMPPAD || type === NAV_LINK.LADDER;
    return flat < MOVE_ARRIVE && Math.abs(this.pointY[id] - Actors.y[id]) < (tall ? MOVE_LANDING_HEIGHT : MOVE_ARRIVE_HEIGHT);
  },
  // Wanted direction with local avoidance and, while recovering from a stuck spot, a sideways strafe.
  steer(id, dx, dz, amount, now) {
    let x = dx, z = dz;
    const length = Math.hypot(x, z) || 1;
    x /= length; z /= length;
    if (now < this.recoverUntil[id]) {
      const angle = this.recoverAngle[id], c = Math.cos(angle), s = Math.sin(angle);
      const rx = x * c - z * s, rz = x * s + z * c;
      x = rx; z = rz;
    }
    const push = this.avoidance(id, x, z);
    Bots.wish(id, x + push.x, z + push.z, amount);
  },
  avoidance(id, forwardX, forwardZ) {
    movePoint.x = 0; movePoint.z = 0;
    for (let other = 0; other < Actors.count; other++) {
      if (other === id || !Actors.alive[other]) continue;
      const ox = Actors.x[other] - Actors.x[id], oz = Actors.z[other] - Actors.z[id], distance = Math.hypot(ox, oz);
      if (distance > MOVE_AVOID_RADIUS || distance < 1e-3 || Math.abs(Actors.y[other] - Actors.y[id]) > STAND_HEIGHT) continue;
      if ((ox * forwardX + oz * forwardZ) / distance < MOVE_AVOID_AHEAD) continue;
      const side = forwardX * oz - forwardZ * ox > 0 ? 1 : -1;   // pass on the side away from the other actor
      movePoint.x += -forwardZ * side * MOVE_AVOID_PUSH; movePoint.z += forwardX * side * MOVE_AVOID_PUSH;
    }
    return movePoint;
  },
  // Buttons and pitch for the link being crossed.
  linkMove(id) {
    const type = this.segmentType[id];
    if (type === NAV_LINK.CROUCH) Bots.press(id, BTN.CROUCH);
    else if (type === NAV_LINK.JUMP) this.jumpLink(id);
    else if (type === NAV_LINK.LADDER) Bots.lookPitch[id] = this.pointY[id] > Actors.y[id] ? BOT_LADDER_UP_PITCH : BOT_LADDER_DOWN_PITCH;
    else if (type === NAV_LINK.SWIM) this.swim(id);
  },
  // Jump links: jump again whenever back on the ground short of the landing (a press every other tick is a new press).
  jumpLink(id) {
    if (Move.isGrounded(id) && (Sim.tick & 1) === 0) Bots.press(id, BTN.JUMP);
    this.extraJump(id);
  },
  // A jump link higher than one jump (only built for tiers with extra jumps): jump again near the apex.
  extraJump(id) {
    if (this.extraJumped[id] || Move.isGrounded(id) || Actors.vy[id] > MOVE_EXTRA_JUMP_RISE) return;
    if (this.pointY[id] - Actors.y[id] < STEP_HEIGHT || Move.preset(id).extraJumps <= 0) return;
    this.extraJumped[id] = 1;
    Bots.press(id, BTN.JUMP);
  },
  swim(id) {
    const rise = this.pointY[id] - Actors.y[id];
    if (rise > MOVE_SWIM_RISE && (Sim.tick & 1) === 0) Bots.press(id, BTN.JUMP);   // up, and out over the rim (mantle)
    else if (rise < -MOVE_SWIM_RISE) Bots.press(id, BTN.CROUCH);
  },
  lookAlong(id, tx, tz) {
    Bots.lookYaw[id] = Math.atan2(tx - Actors.x[id], tz - Actors.z[id]);
    if (this.segmentType[id] !== NAV_LINK.LADDER) Bots.lookPitch[id] = 0;
  },

  // ---- BOT-012 stuck detection and recovery (sampled every 0.5 s on the movement actually asked for) ----
  checkStuck(id, now) {
    if (this.stuckTime[id] >= STUCK_JUMP) this.stuckSeconds[id] += TICK_SECONDS;
    if (now - this.sampleAt[id] < MOVE_SAMPLE_SECONDS) return;
    const progress = this.progress(id);
    const trying = this.hasDest[id] && this.state[id] === PATH.FOLLOW && Bots.wishAmount[id] > MOVE_INTENT && !BotCombat.overlaid[id];
    this.takeSample(id, now);
    if (!trying || progress >= MOVE_PROGRESS) { this.stuckTime[id] = 0; this.repathed[id] = 0; return; }
    this.stuckTime[id] += MOVE_SAMPLE_SECONDS;
    this.longestStuck[id] = Math.max(this.longestStuck[id], this.stuckTime[id]);
    this.recover(id, now);
  },
  // Progress since the last sample: a path point reached, metres closer to the point ahead, or metres climbed on a
  // ladder. Moving around without getting closer (jumping, strafing along a wall) is not progress. After a new path the
  // points differ, so plain movement counts once.
  progress(id) {
    if (this.sampleSerial[id] !== this.pathSerial[id]) return Math.hypot(Actors.x[id] - this.sampleX[id], Actors.z[id] - this.sampleZ[id]);
    if (this.pointIndex[id] !== this.samplePoint[id]) return Infinity;
    const climbed = this.segmentType[id] === NAV_LINK.LADDER ? Math.abs(Actors.y[id] - this.sampleY[id]) : 0;
    return Math.max(climbed, this.sampleDistance[id] - this.distanceAhead(id));
  },
  takeSample(id, now) {
    this.sampleX[id] = Actors.x[id]; this.sampleY[id] = Actors.y[id]; this.sampleZ[id] = Actors.z[id]; this.sampleAt[id] = now;
    this.samplePoint[id] = this.pointIndex[id]; this.sampleSerial[id] = this.pathSerial[id]; this.sampleDistance[id] = this.distanceAhead(id);
  },
  distanceAhead(id) {
    const atEnd = this.pointIndex[id] >= this.pointCount[id];
    return Math.hypot((atEnd ? this.destX[id] : this.pointX[id]) - Actors.x[id], (atEnd ? this.destZ[id] : this.pointZ[id]) - Actors.z[id]);
  },
  recover(id, now) {
    const stuck = this.stuckTime[id];
    if (stuck >= STUCK_GIVE_UP) { this.giveUp(id, now); return; }
    if (stuck >= STUCK_REPATH && !this.repathed[id]) { this.repathAround(id); return; }
    if (stuck < STUCK_JUMP) return;
    // Attempts alternate: jump while strafing to one side, back off, jump to the other side, ...
    const attempt = Math.round((stuck - STUCK_JUMP) / MOVE_SAMPLE_SECONDS);
    this.recoverUntil[id] = now + STUCK_STRAFE_SECONDS;
    if (attempt === 0) this.recoverSide[id] = Rng.bots.sign();
    if (attempt % 2 === 1) { this.recoverAngle[id] = STUCK_BACK_ANGLE; return; }
    this.recoverSide[id] = -this.recoverSide[id];
    this.recoverAngle[id] = STUCK_STRAFE_ANGLE * this.recoverSide[id];
    Bots.press(id, BTN.JUMP);
  },
  // Repath excluding the node nearest the point the bot could not reach.
  repathAround(id) {
    this.repathed[id] = 1;
    const ahead = this.pointIndex[id] < this.pointCount[id];
    this.avoidNode[id] = ahead ? Nav.nearestNode(this.pointX[id], this.pointY[id], this.pointZ[id]) : -1;
    markTrap(this.avoidNode[id], Sim.time);
    this.request(id, this.avoidNode[id] >= 0 ? this.avoidOptions[id] : this.options[id]);
  },
  giveUp(id, now) {
    const entry = this.log.take();
    entry.id = id; entry.x = Actors.x[id]; entry.z = Actors.z[id]; entry.time = now;
    this.logCount++;
    this.stuckTime[id] = 0;
    this.repathed[id] = 0;
    this.stop(id);
    BotDecide.goalFailed(id, now);
  },
};

// Trap memory shared by all bots: nodes where a bot got stuck cost TRAP_COST extra seconds for TRAP_SECONDS, so the
// team routes around links that look fine on the graph but fail in play (a rim too thin to climb out over, say).
const TRAP_SLOTS = 32, TRAP_SECONDS = 60, TRAP_COST = 30;
const trapNodes = new Int32Array(TRAP_SLOTS).fill(-1), trapUntil = new Float64Array(TRAP_SLOTS);
let trapCursor = 0;

function markTrap(node, now) {
  if (node < 0) return;
  trapNodes[trapCursor] = node;
  trapUntil[trapCursor] = now + TRAP_SECONDS;
  trapCursor = (trapCursor + 1) % TRAP_SLOTS;
}

function trapsActive(now) {
  for (let i = 0; i < TRAP_SLOTS; i++) if (trapUntil[i] > now) return true;
  return false;
}

// Swimming is slow and its exits are hard (S10 mantle): bots go through water only when it saves real time.
const WATER_NODE_COST = 4;
let mapHasWater = false;

function extraCost(node) {
  return trapCost(node) + ((Nav.nodeFlags[node] & NAV_NODE.WATER) ? WATER_NODE_COST : 0);
}

function findWater() {
  mapHasWater = false;
  for (let node = 0; node < Nav.nodeCount && !mapHasWater; node++) mapHasWater = (Nav.nodeFlags[node] & NAV_NODE.WATER) !== 0;
}

function trapCost(node) {
  for (let i = 0; i < TRAP_SLOTS; i++) if (trapNodes[i] === node && trapUntil[i] > Sim.time) return TRAP_COST;
  return 0;
}

BotMove.init();
Bus.on('match.start', () => { trapUntil.fill(0); trapNodes.fill(-1); findWater(); });
