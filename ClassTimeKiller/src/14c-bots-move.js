// Bot navigation (BOT-010..BOT-012): paths from Nav.request (the nav system serves at most 4 queries per tick, BOT-091),
// steering along the smoothed points with the same move input as the player, link moves by type (jump with an extra jump
// when the link is higher than one jump, crouch, ladder, swim, pads and teleporters by walking in), local avoidance of other
// actors and stuck recovery: no progress 1.5 s -> jump and strafe, 3 s -> repath avoiding the node ahead, 6 s -> new goal.
// Jump and drop links are filtered by the bot's own movement preset (allowJumpHeight with mantle and climb, maxDrop by
// fall damage, reach, gravity); a ledge guard keeps grounded bots from walking, strafing or sliding off into a void.

const PATH = { NONE: 0, WAITING: 1, FOLLOW: 2, FAILED: 3, ARRIVED: 4 };
const MOVE_ARRIVE = 0.6;                // m: a path point counts as reached this close (horizontal)...
const MOVE_ARRIVE_HEIGHT = 1.6;         // ...and this close in height
const MOVE_LANDING_HEIGHT = 3;          // jump, drop and pad landings may be reached from higher up
const MOVE_SLOW_RADIUS = 1.2;           // slow down this close to the final destination
const MOVE_DIRECT_RADIUS = 4;           // after the last point, walk straight to a destination this close
const MOVE_REPATH_DISTANCE = 2;         // a destination moved further than this needs a new path...
const MOVE_REPATH_INTERVAL = 0.75;      // ...at most this often (moving targets: carriers, chased enemies)
const MOVE_OFF_PATH = 12;               // farther than this from the next point (knockback, teleport): new path
const MOVE_FELL_OFF = 1;                // m below the segment line (off a ramp edge, a missed landing): new path
const MOVE_LOOKAHEAD = 2;               // m: walk toward a point this far along the segment from the bot's place on it, so
                                        // a bot pushed off the line returns to it instead of grinding along a door frame
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
const followTarget = { x: 0, z: 0, distance: 0 };   // follow's target point and its flat distance (float arguments are boxed, PERF-006)
const rimHit = { distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null };
const WATER_EXIT_CHECK = 2.5;           // m from a water exit: look for the rim a swimmer climbs out over (S10 mantle)
const WATER_RIM_RAY = 3;
const MOVE_MANTLE_MARGIN = 0.2;         // m: ledges planned up to the preset's mantle height less this (link heights add NAV_JUMP_MARGIN)
const BOT_DROP_DAMAGE = 25;             // HP: a preset with fall damage drops at most as far as costs this (BOT-010: <= safeDrop)
const BOT_DROP_STEP = 0.5;              // m between the drop heights tried
const LEDGE_PROBE = 0.9;                // m ahead along the wanted move the ledge guard looks for floor...
const LEDGE_SLIDE_SPEED = 1.5;          // ...and, faster than this m/s with no move wanted (ice, knockback), along the slide...
const LEDGE_SLIDE_SECONDS = 0.4;        // ...as far as this many seconds of it (a wanted move looks this far ahead too)
const LEDGE_HOP_SECONDS = 0.7;          // s: how long a combat hop flies (the hop guard looks that far ahead)
const LEDGE_ALIGN = 0.7;               // cos: a jump link leaves the ground on purpose only while the move heads along it
const ledgeProbe = { x: 0, z: 0 };      // the guard's probe offset (float arguments are boxed, PERF-006)
const PAD_RIDE_SECONDS = 4;             // s: a jump pad flight lasts at most this long (S08 arcs are far shorter)

const BotMove = {
  state: new Uint8Array(MAX_ACTORS),
  destX: new Float32Array(MAX_ACTORS), destY: new Float32Array(MAX_ACTORS), destZ: new Float32Array(MAX_ACTORS),
  plannedX: new Float32Array(MAX_ACTORS), plannedZ: new Float32Array(MAX_ACTORS),   // the destination of the current path
  destRadius: new Float32Array(MAX_ACTORS), hasDest: new Uint8Array(MAX_ACTORS), requestedAt: new Float64Array(MAX_ACTORS).fill(-1e9),
  navVersion: new Int32Array(MAX_ACTORS), pending: new Uint8Array(MAX_ACTORS), pathSerial: new Uint32Array(MAX_ACTORS),
  samplePoint: new Int16Array(MAX_ACTORS), sampleSerial: new Uint32Array(MAX_ACTORS), sampleDistance: new Float32Array(MAX_ACTORS),
  pointIndex: new Int16Array(MAX_ACTORS), pointCount: new Int16Array(MAX_ACTORS),
  pointX: new Float32Array(MAX_ACTORS), pointY: new Float32Array(MAX_ACTORS), pointZ: new Float32Array(MAX_ACTORS),
  ladderX: new Float32Array(MAX_ACTORS), ladderZ: new Float32Array(MAX_ACTORS),   // climbing target of a ladder link
  exitChecked: new Uint8Array(MAX_ACTORS),
  segmentType: new Uint8Array(MAX_ACTORS), segmentHeight: new Float32Array(MAX_ACTORS), extraJumped: new Uint8Array(MAX_ACTORS),
  startX: new Float32Array(MAX_ACTORS), startY: new Float32Array(MAX_ACTORS), startZ: new Float32Array(MAX_ACTORS),   // segment start
  launched: new Uint8Array(MAX_ACTORS),        // the bot left the ground on this segment (jump, drop, pad)
  padRideUntil: new Float64Array(MAX_ACTORS),  // a jump pad threw the bot: no steering until it lands (or this time)
  sampleX: new Float32Array(MAX_ACTORS), sampleY: new Float32Array(MAX_ACTORS), sampleZ: new Float32Array(MAX_ACTORS), sampleAt: new Float64Array(MAX_ACTORS),
  stuckTime: new Float32Array(MAX_ACTORS), recoverUntil: new Float64Array(MAX_ACTORS), recoverSide: new Int8Array(MAX_ACTORS).fill(1),
  recoverAngle: new Float32Array(MAX_ACTORS),
  repathed: new Uint8Array(MAX_ACTORS), avoidNode: new Int32Array(MAX_ACTORS).fill(-1),
  fromWater: new Uint8Array(MAX_ACTORS),       // the last path was asked for from the water (blocked exits cost extra)
  viaExit: new Uint8Array(MAX_ACTORS),         // that path only leads out of the water (its destination is a blocked exit)
  stuckSeconds: new Float32Array(MAX_ACTORS), longestStuck: new Float32Array(MAX_ACTORS),
  options: [], avoidOptions: [], costs: [],
  log: makePool(STUCK_LOG_SIZE, () => ({ id: -1, x: 0, z: 0, time: 0 })), logCount: 0,

  init() {
    for (let id = 0; id < MAX_ACTORS; id++) {
      this.options.push({ allowJumpHeight: Nav.limits.jumpUp, maxDrop: Nav.limits.safeDrop, crouchOk: true, moveSpeed: Infinity, jumpVelocity: 0, gravity: GRAVITY,
        avoid: null, danger: null, dangerKey: -1 });
      this.costs.push((node) => blockedExitCost(id, node));                                   // closures per slot, made once at load
      const avoid = (node) => (node === this.avoidNode[id] ? Infinity : blockedExitCost(id, node));
      this.avoidOptions.push(Object.assign({}, this.options[id], { avoid }));
    }
  },
  reset(id) {
    this.state[id] = PATH.NONE; this.hasDest[id] = 0; this.stuckTime[id] = 0; this.recoverUntil[id] = 0; this.padRideUntil[id] = 0;
    this.takeSample(id, Sim.time);
    this.pointCount[id] = 0; this.pointIndex[id] = 0; this.avoidNode[id] = -1; this.requestedAt[id] = -1e9; this.pending[id] = 0;
    Nav.cancel(id);
  },
  // Path options from the bot's movement preset and tier (BOT-010 "preset-aware"): tiers without jumps skip extra jumps.
  // The preset already carries the match's moveOverrides and gravity scale (MUT-003: low gravity allows higher jump links).
  // A jump link is climbed by the jump apex (plus extra jumps and the crouch-jump lift), or by the S10 mantle or wall
  // climb the bot does while facing the ledge, whichever reaches higher (a grip-only climb is not planned: the graph does
  // not know the brush material).
  configure(id) {
    const preset = Move.preset(id), gravity = Move.gravity(id), tier = Bots.tier(id);
    const single = preset.jumpVel * preset.jumpVel / (2 * gravity);
    const extra = tier.jumps ? preset.extraJumps * preset.extraJumpVel * preset.extraJumpVel / (2 * gravity) : 0;
    const climb = preset.climbGripOnly ? 0 : preset.climbHeight;
    const reach = Math.max(single + extra + preset.crouchJumpLift, preset.mantleHeight - MOVE_MANTLE_MARGIN + NAV_JUMP_MARGIN, climb);
    const maxDrop = safeDropFor(preset, gravity);
    for (const options of [this.options[id], this.avoidOptions[id]]) {
      options.allowJumpHeight = reach;
      options.maxDrop = maxDrop;
      options.moveSpeed = preset.groundSpeed * tier.speed;
      options.jumpVelocity = preset.jumpVel;
      options.gravity = gravity;
    }
  },
  // Destination for the execution layer; a nearby change keeps the current path (moving targets repath at most 1.3 Hz).
  // The change is measured from where the path was asked for: a destination that creeps (the convoy cart) adds up.
  goTo(id, x, y, z, radius) {
    const moved = length2(x - this.plannedX[id], z - this.plannedZ[id]);
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
  following(id) { return this.state[id] === PATH.FOLLOW; },
  // Whether the path being followed ends at height y (nav ends a path to an unreachable ledge on the nearest node below).
  pathEndsAt(id, y) {
    if (this.pointCount[id] === 0) return true;   // already at the destination node
    Nav.resultPoint(id, this.pointCount[id] - 1, movePoint);
    return Math.abs(movePoint.y - y) < MOVE_ARRIVE_HEIGHT;
  },
  // Metres still to walk while following: to the next path point, then along the rest of the path.
  pathLeft(id) {
    let x = this.pointX[id], y = this.pointY[id], z = this.pointZ[id];
    let length = length3(x - Actors.x[id], y - Actors.y[id], z - Actors.z[id]);
    for (let index = this.pointIndex[id] + 1; index < this.pointCount[id]; index++) {
      Nav.resultPoint(id, index, movePoint);
      length += length3(movePoint.x - x, movePoint.y - y, movePoint.z - z);
      x = movePoint.x; y = movePoint.y; z = movePoint.z;
    }
    return length;
  },
  distanceToDestination(id) { return length2(this.destX[id] - Actors.x[id], this.destZ[id] - Actors.z[id]); },
  // Water and trap costs come from the shared extraCosts array, versioned by costEpoch, so those paths stay cacheable;
  // only a swimmer while some exit is blocked needs its own cost function (not cached).
  request(id, options) {
    this.fromWater[id] = inWater(id) ? 1 : 0;
    options.danger = sharedCosts(Sim.time); options.dangerKey = costEpoch;
    if (options === this.options[id]) options.avoid = this.fromWater[id] && blockedExits > 0 ? this.costs[id] : null;
    this.requestedAt[id] = Sim.time;
    this.pathSerial[id]++;
    this.pending[id] = 0;
    this.navVersion[id] = Nav.version;
    this.plannedX[id] = this.destX[id]; this.plannedZ[id] = this.destZ[id];
    const from = Nav.nearestNode(Actors.x[id], Actors.y[id], Actors.z[id]);
    const goal = Nav.nearestNode(this.destX[id], this.destY[id], this.destZ[id]);
    const to = this.fromWater[id] && goal >= 0 ? this.dryTarget(id, from, goal) : goal;
    if (!this.fromWater[id]) this.viaExit[id] = 0;
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
    const fellIn = inWater(id) && !this.fromWater[id] && now - this.requestedAt[id] >= MOVE_REPATH_INTERVAL;
    if (this.navVersion[id] !== Nav.version || due || fellIn) this.request(id, this.options[id]);   // a map reload, a newer destination, water
    if (this.state[id] === PATH.WAITING) this.collect(id);
    if (this.state[id] === PATH.FAILED || this.state[id] === PATH.WAITING) { Bots.wish(id, 0, 0, 0); return; }
    if (this.reachedDestination(id)) { this.state[id] = PATH.ARRIVED; Bots.wish(id, 0, 0, 0); return; }
    this.state[id] = PATH.FOLLOW;
    this.follow(id, now);
  },
  // From the water a destination on a rimless exit (a deck over the water) is reached over land: first out of the water.
  dryTarget(id, from, goal) {
    this.viaExit[id] = 0;
    if (!exitBlocked(goal) || from < 0) return goal;
    const exit = nearestExit(from, Actors.x[id], Actors.y[id], Actors.z[id]);
    if (exit < 0) return goal;
    this.viaExit[id] = 1;
    return exit;
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
    this.launched[id] = 0;
    if (index >= this.pointCount[id]) return;
    const type = index > 0 ? Nav.resultPoint(id, index - 1, movePoint) : NAV_LINK.WALK;
    this.startX[id] = index > 0 ? movePoint.x : Actors.x[id];
    this.startY[id] = index > 0 ? movePoint.y : Actors.y[id];
    this.startZ[id] = index > 0 ? movePoint.z : Actors.z[id];
    Nav.resultPoint(id, index, movePoint);
    this.pointX[id] = movePoint.x; this.pointY[id] = movePoint.y; this.pointZ[id] = movePoint.z;
    this.segmentType[id] = type;
    this.segmentHeight[id] = movePoint.y - this.startY[id];
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
      const distance = Math.min(length2(x - bottomX, z - bottomZ), length2(x - movePoint.x, z - movePoint.z));
      if (distance < best) { best = distance; this.ladderX[id] = x; this.ladderZ[id] = z; }
    }
  },
  // Walking to the ladder: below its top and not yet at the volume (on it, facing the top point climbs at full speed).
  climbing(id) {
    if (this.segmentType[id] !== NAV_LINK.LADDER || Actors.y[id] >= this.pointY[id] - LADDER_STEP_OFF) return false;
    return length2(this.ladderX[id] - Actors.x[id], this.ladderZ[id] - Actors.z[id]) > LADDER_REACH;
  },
  // Ladders, water exits and jumps up onto ledges are climbed by facing them (S10 climbs and mantles along the view),
  // so on those links the movement owns the view and combat footwork waits.
  // A swimmer climbs out by mantling over a rim; a thin deck above the water has none (the ray passes under it). The
  // graph check at match start (findExits) knows most of them; this check near the exit (one ray) catches the rest.
  // target = { x, z, distance }: the point swum toward and its flat distance (followTarget).
  waterExitBlocked(id, target) {
    const distance = target.distance;
    if (this.exitChecked[id] || !swimming(id, this.segmentType[id]) || distance > WATER_EXIT_CHECK || distance < 1e-3) return false;
    if (this.pointY[id] <= Actors.y[id] + STEP_HEIGHT) return false;
    this.exitChecked[id] = 1;
    const dx = target.x - Actors.x[id], dz = target.z - Actors.z[id];
    return !World.raycast(Actors.x[id], Actors.y[id] + STEP_HEIGHT + COLLISION_SKIN, Actors.z[id], dx / distance, 0, dz / distance, WATER_RIM_RAY, rimHit);
  },
  ownsView(id) {
    if (this.pointIndex[id] >= this.pointCount[id]) return false;
    const type = this.segmentType[id];
    if (type === NAV_LINK.LADDER) return true;
    return (type === NAV_LINK.JUMP || swimming(id, type)) && this.pointY[id] > Actors.y[id] + STEP_HEIGHT;
  },
  follow(id, now) {
    if (!Move.isGrounded(id)) this.launched[id] = 1;
    this.advance(id);
    const atEnd = this.pointIndex[id] >= this.pointCount[id];
    if (!atEnd && this.fellOff(id) && now - this.requestedAt[id] > MOVE_REPATH_INTERVAL) { this.request(id, this.options[id]); return; }
    if (atEnd && this.viaExit[id] && !inWater(id)) { this.request(id, this.options[id]); return; }   // out: on to the destination
    const direct = atEnd && !this.viaExit[id], climbing = !atEnd && this.climbing(id);
    const target = followTarget;
    target.x = direct ? this.destX[id] : climbing ? this.ladderX[id] : this.pointX[id];
    target.z = direct ? this.destZ[id] : climbing ? this.ladderZ[id] : this.pointZ[id];
    const tx = target.x, tz = target.z, distance = length2(tx - Actors.x[id], tz - Actors.z[id]);
    target.distance = distance;
    if (!atEnd && !climbing && groundSegment(this.segmentType[id])) this.carrot(id, movePoint); else { movePoint.x = tx; movePoint.z = tz; }
    const dx = movePoint.x - Actors.x[id], dz = movePoint.z - Actors.z[id];
    if (!atEnd && !climbing && distance > MOVE_OFF_PATH && now - this.requestedAt[id] > MOVE_REPATH_INTERVAL) { this.request(id, this.options[id]); return; }
    // Past the last point and the destination is still far: it lies off the graph, the end of the path is as close as it gets.
    if (direct && this.distanceToDestination(id) > MOVE_DIRECT_RADIUS) { this.state[id] = PATH.ARRIVED; Bots.wish(id, 0, 0, 0); return; }
    const amount = direct ? clamp(this.distanceToDestination(id) / MOVE_SLOW_RADIUS, 0.25, 1) : 1;
    if (!atEnd && this.waterExitBlocked(id, target)) { this.takeAnotherExit(id); return; }
    const wanted = botWish;
    wanted.x = dx; wanted.z = dz; wanted.amount = amount;
    this.steer(id, now);
    this.linkMove(id);
    if ((BotCombat.target[id] < 0 && !BotCombat.aimingJump(id, now)) || this.ownsView(id)) this.lookAlong(id, target);
  },
  advance(id) {
    for (let guard = 0; guard < 3 && this.pointIndex[id] < this.pointCount[id]; guard++) {
      if (!this.pointReached(id)) return;
      this.selectPoint(id, this.pointIndex[id] + 1);
    }
  },
  pointReached(id) {
    const flat = length2(this.pointX[id] - Actors.x[id], this.pointZ[id] - Actors.z[id]);
    const type = this.segmentType[id];
    const tall = type === NAV_LINK.JUMP || type === NAV_LINK.DROP || type === NAV_LINK.JUMPPAD || type === NAV_LINK.LADDER;
    if (tall && this.landed(id)) return true;
    return flat < MOVE_ARRIVE && Math.abs(this.pointY[id] - Actors.y[id]) < (tall ? MOVE_LANDING_HEIGHT : MOVE_ARRIVE_HEIGHT);
  },
  // Back on the ground after this segment's jump, drop or pad, past the middle and not below the landing: the move is
  // done even when the bot came down a little off the landing point (re-jumping to hit it exactly keeps it hopping).
  landed(id) {
    if (!this.launched[id] || !Move.isGrounded(id) || this.pointY[id] > Actors.y[id] + STEP_HEIGHT) return false;
    const toPoint = length2(this.pointX[id] - Actors.x[id], this.pointZ[id] - Actors.z[id]);
    return toPoint < length2(this.startX[id] - Actors.x[id], this.startZ[id] - Actors.z[id]);
  },
  // On the ground well below where the segment runs: walked off a ramp edge, or a drop or pad missed its landing.
  fellOff(id) {
    if (!Move.isGrounded(id) || inWater(id)) return false;
    const type = this.segmentType[id];
    if (type === NAV_LINK.DROP || type === NAV_LINK.JUMPPAD) return this.launched[id] === 1 && Actors.y[id] < this.pointY[id] - MOVE_FELL_OFF;
    if (type !== NAV_LINK.WALK && type !== NAV_LINK.CROUCH) return false;
    return Actors.y[id] < this.segmentY(id) - MOVE_FELL_OFF;
  },
  // Height of the segment line at the bot's place along it.
  segmentY(id) { return lerp(this.startY[id], this.pointY[id], this.along(id)); },
  // The bot's place along the segment, 0 at its start .. 1 at the point.
  along(id) {
    const ax = this.pointX[id] - this.startX[id], az = this.pointZ[id] - this.startZ[id], lengthSquared = ax * ax + az * az;
    if (lengthSquared < 1e-6) return 1;
    return clamp(((Actors.x[id] - this.startX[id]) * ax + (Actors.z[id] - this.startZ[id]) * az) / lengthSquared, 0, 1);
  },
  // The steering target on a walk or swim segment: MOVE_LOOKAHEAD metres past the bot's place on the line, at most the point.
  carrot(id, out) {
    const ax = this.pointX[id] - this.startX[id], az = this.pointZ[id] - this.startZ[id], length = length2(ax, az);
    const along = Math.min(1, this.along(id) + MOVE_LOOKAHEAD / Math.max(length, 1e-6));
    out.x = this.startX[id] + ax * along; out.z = this.startZ[id] + az * along;
    return out;
  },
  // The wanted move in botWish with local avoidance and, while recovering from a stuck spot, a sideways strafe.
  steer(id, now) {
    const wanted = botWish, length = length2(wanted.x, wanted.z) || 1;
    let x = wanted.x / length, z = wanted.z / length;
    if (now < this.recoverUntil[id]) {
      const angle = this.recoverAngle[id], c = Math.cos(angle), s = Math.sin(angle);
      const rx = x * c - z * s, rz = x * s + z * c;
      x = rx; z = rz;
    }
    wanted.x = x; wanted.z = z;
    const push = this.avoidance(id);
    wanted.x = x + push.x; wanted.z = z + push.z;
    Bots.wishFrom(id);
  },
  // Sideways push away from actors just ahead along the normalized direction in botWish.
  avoidance(id) {
    const forwardX = botWish.x, forwardZ = botWish.z;
    movePoint.x = 0; movePoint.z = 0;
    for (let other = 0; other < Actors.count; other++) {
      if (other === id || !Actors.alive[other]) continue;
      const ox = Actors.x[other] - Actors.x[id], oz = Actors.z[other] - Actors.z[id], distance = length2(ox, oz);
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
    else if (swimming(id, type)) this.swim(id);
  },
  // Jump links: jump again whenever back on the ground short of the landing (a press every other tick is a new press);
  // in the air below the landing a preset with a crouch-jump lift tucks its legs (S10), which configure() counts on.
  jumpLink(id) {
    const grounded = Move.isGrounded(id);
    if (grounded && (Sim.tick & 1) === 0) Bots.press(id, BTN.JUMP);
    if (!grounded && Move.preset(id).crouchJumpLift > 0 && this.pointY[id] > Actors.y[id]) Bots.press(id, BTN.CROUCH);
    this.extraJump(id);
  },
  // BOT-010 ledge guard, after every move layer (path, combat footwork, hazards): a grounded bot about to walk, strafe
  // or slide (ice) over an edge with no floor within its drop limit (a void, a killzone) brakes instead. A planned drop
  // lands within that limit; jump, pad and ladder links leave the ground on purpose while the move heads along them.
  guardLedge(id) {
    if (this.ridesPad(id)) return;
    if (!Move.isGrounded(id) || inWater(id) || this.leavesGround(id)) return;
    if ((Bots.buttonsWanted[id] & BTN.JUMP) && !BotCombat.weaponJumpPending(id, Sim.time)) this.guardHop(id);   // a weapon jump aims at its ledge
    const speed = length2(Actors.vx[id], Actors.vz[id]), probe = ledgeProbe, ahead = LEDGE_PROBE + speed * LEDGE_SLIDE_SECONDS;
    probe.x = Bots.wishX[id] * ahead; probe.z = Bots.wishZ[id] * ahead;
    const wishing = Bots.wishAmount[id] > 0 && this.unsafeAhead(id);
    if (!wishing && speed > LEDGE_SLIDE_SPEED) {
      probe.x = Actors.vx[id] * ahead / speed; probe.z = Actors.vz[id] * ahead / speed;
    }
    if (!wishing && (speed <= LEDGE_SLIDE_SPEED || !this.unsafeAhead(id))) return;
    const wanted = botWish;
    wanted.x = -Actors.vx[id]; wanted.z = -Actors.vz[id]; wanted.amount = speed > LEDGE_SLIDE_SPEED ? 1 : 0;   // push back against the slide
    Bots.wishFrom(id);
  },
  // A jump pad throws the actor onto its target (S08 arc): in that flight the bot does not steer, since its path or
  // footwork pulling another way brakes it over the void (BOT-010). The ride ends on landing.
  ridesPad(id) {
    if (this.padRideUntil[id] <= 0) return false;
    if (Sim.time >= this.padRideUntil[id] || (Move.isGrounded(id) && Actors.vy[id] <= 0)) { this.padRideUntil[id] = 0; return false; }
    Bots.wishAmount[id] = 0;
    Bots.buttonsWanted[id] &= ~BTN.JUMP;
    return true;
  },
  // A hop off no jump link (combat footwork) flies LEDGE_HOP_SECONDS at run speed or more: no floor that far along the
  // move (or the slide), no hop.
  guardHop(id) {
    const speed = length2(Actors.vx[id], Actors.vz[id]), wishing = Bots.wishAmount[id] > 0;
    if (!wishing && speed <= LEDGE_SLIDE_SPEED) return;   // a hop on the spot lands where it started
    const ahead = LEDGE_PROBE + Math.max(speed, this.options[id].moveSpeed) * LEDGE_HOP_SECONDS;
    const dx = wishing ? Bots.wishX[id] : Actors.vx[id] / speed, dz = wishing ? Bots.wishZ[id] : Actors.vz[id] / speed;
    ledgeProbe.x = dx * ahead; ledgeProbe.z = dz * ahead;
    if (this.unsafeAhead(id)) Bots.buttonsWanted[id] &= ~BTN.JUMP;
  },
  leavesGround(id) {
    if (!this.hasDest[id] || this.pointIndex[id] >= this.pointCount[id]) return false;
    const type = this.segmentType[id];
    if (type !== NAV_LINK.JUMP && type !== NAV_LINK.JUMPPAD && type !== NAV_LINK.LADDER && type !== NAV_LINK.TELEPORT) return false;
    const dx = this.pointX[id] - Actors.x[id], dz = this.pointZ[id] - Actors.z[id], length = length2(dx, dz);
    return length < STEP_HEIGHT || (Bots.wishX[id] * dx + Bots.wishZ[id] * dz) >= LEDGE_ALIGN * length;
  },
  // No floor under the point ledgeProbe (x, z) m away within the bot's drop limit (one ray down).
  unsafeAhead(id) {
    const fall = this.options[id].maxDrop + STEP_HEIGHT * 2;
    return !World.raycast(Actors.x[id] + ledgeProbe.x, Actors.y[id] + STEP_HEIGHT, Actors.z[id] + ledgeProbe.z, 0, -1, 0, fall, rimHit);
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
  lookAlong(id, target) {
    Bots.lookYaw[id] = Math.atan2(target.x - Actors.x[id], target.z - Actors.z[id]);
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
    if (this.sampleSerial[id] !== this.pathSerial[id]) return length2(Actors.x[id] - this.sampleX[id], Actors.z[id] - this.sampleZ[id]);
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
    return length2((atEnd ? this.destX[id] : this.pointX[id]) - Actors.x[id], (atEnd ? this.destZ[id] : this.pointZ[id]) - Actors.z[id]);
  },
  recover(id, now) {
    const stuck = this.stuckTime[id];
    if (stuck >= STUCK_GIVE_UP) { this.giveUp(id, now); return; }
    if (stuck >= this.repathAfter(id) && !this.repathed[id]) { this.repathAround(id); return; }
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
  // A jump with no climb in it (a hop around a corner or over a gap) that failed once is one the body does not fit:
  // jumping and strafing will not fix it, so the bot repaths at the first stuck mark instead of the second.
  repathAfter(id) {
    const levelJump = this.segmentType[id] === NAV_LINK.JUMP && this.pointY[id] <= this.startY[id] + STEP_HEIGHT;
    return levelJump ? STUCK_JUMP : STUCK_REPATH;
  },
  // A water exit without a rim: blocked for the rest of the match, the path leaves the water elsewhere.
  takeAnotherExit(id) {
    markBlockedExit(Nav.nearestNode(this.pointX[id], this.pointY[id], this.pointZ[id]));
    this.request(id, this.options[id]);
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

// BOT-010 drop limit: every drop link the graph has (Nav.limits.maxDrop) without fall damage (the preset's MOV-015 curve,
// or the MUT-003 mutator), else the deepest drop up to Nav.limits.safeDrop that costs at most BOT_DROP_DAMAGE.
function safeDropFor(preset, gravity) {
  const deepest = Nav.limits.maxDrop;
  if ((Mutators.fx && Mutators.fx.noFallDamage) || fallDamage(preset, Math.sqrt(2 * gravity * deepest)) <= 0) return deepest;
  let drop = Nav.limits.safeDrop;
  while (drop > BOT_DROP_STEP && fallDamage(preset, Math.sqrt(2 * gravity * drop)) > BOT_DROP_DAMAGE) drop -= BOT_DROP_STEP;
  return drop;
}

// Trap memory shared by all bots: nodes where a bot got stuck cost TRAP_COST extra seconds for TRAP_SECONDS, so the
// team routes around links that look fine on the graph but fail in play (a rim too thin to climb out over, say).
const TRAP_SLOTS = 32, TRAP_SECONDS = 60, TRAP_COST = 30;
const trapNodes = new Int32Array(TRAP_SLOTS).fill(-1), trapUntil = new Float64Array(TRAP_SLOTS);
let trapCursor = 0, trapCount = 0;

// Swimming is slow and its exits are hard (S10 mantle): bots go through water only when it saves real time.
const WATER_NODE_COST = 4;
const BLOCKED_EXIT_COST = 1000;         // s: a path from the water climbs out over a rimless exit only when nothing else exists
const EXIT = { NONE: 0, BLOCKED: 1, OPEN: 2 };
let mapHasWater = false;
let exitKind = new Uint8Array(0), exitVersion = -1;
let exitList = new Int32Array(0), exitCount = 0, blockedExits = 0;

// Extra seconds per nav node for every bot (water nodes, live traps): one array for Nav's danger channel, its version
// costEpoch bumped on every change so the path cache never serves a path found with other costs (BOT-091).
let extraCosts = new Float32Array(0), costVersion = -1, costEpoch = 0;

function markTrap(node, now) {
  if (node < 0) return;
  sharedCosts(now);
  if (trapNodes[trapCursor] >= 0) clearTrap(trapCursor);   // the ring is full: the oldest trap goes
  trapNodes[trapCursor] = node;
  trapUntil[trapCursor] = now + TRAP_SECONDS;
  extraCosts[node] += TRAP_COST;
  trapCount++; costEpoch++;
  trapCursor = (trapCursor + 1) % TRAP_SLOTS;
}

function clearTrap(slot) {
  extraCosts[trapNodes[slot]] -= TRAP_COST;
  trapNodes[slot] = -1;
  trapCount--; costEpoch++;
}

// The shared cost array for a path asked for now (expired traps dropped), or null when it would add nothing (no water,
// no trap): such paths need no danger channel at all.
function sharedCosts(now) {
  if (costVersion !== Nav.version) buildCosts();
  for (let slot = 0; slot < TRAP_SLOTS; slot++) if (trapNodes[slot] >= 0 && trapUntil[slot] <= now) clearTrap(slot);
  return mapHasWater || trapCount > 0 ? extraCosts : null;
}

// Water costs once per graph (the traps of an older graph are dropped with it).
function buildCosts() {
  costVersion = Nav.version; costEpoch++;
  if (extraCosts.length !== Nav.nodeCount) extraCosts = new Float32Array(Nav.nodeCount); else extraCosts.fill(0);
  trapNodes.fill(-1); trapCount = 0;
  findWater();
  for (let node = 0; node < Nav.nodeCount; node++) if (Nav.nodeFlags[node] & NAV_NODE.WATER) extraCosts[node] = WATER_NODE_COST;
}

// A swimmer's own extra cost: a rimless exit (the shared costs come through Nav's danger channel).
function blockedExitCost(id, node) { return BotMove.fromWater[id] && exitBlocked(node) ? BLOCKED_EXIT_COST : 0; }

function exitBlocked(node) { return exitVersion === Nav.version && node < exitKind.length && exitKind[node] === EXIT.BLOCKED; }

// Segments walked or swum along a line (links such as jumps and ladders are moves of their own).
function groundSegment(type) { return type === NAV_LINK.WALK || type === NAV_LINK.CROUCH || type === NAV_LINK.SWIM; }

function inWater(id) { return (Actors.flags[id] & ACTOR_FLAG.IN_WATER) !== 0; }

// A swim link, or any move while in the water (a bot knocked or fallen in swims to the next point).
function swimming(id, type) { return type === NAV_LINK.SWIM || (type !== NAV_LINK.LADDER && inWater(id)); }

function findWater() {
  mapHasWater = false;
  for (let node = 0; node < Nav.nodeCount && !mapHasWater; node++) mapHasWater = (Nav.nodeFlags[node] & NAV_NODE.WATER) !== 0;
}

// Water exits (land nodes linked from a water node) once per match. S09 links a swim exit only where a bank face stands
// at knee height (the S10 mantle), so every linked exit starts open; an exit is blocked only when a swimmer fails at it
// in play (markBlockedExit), and paths from the water then avoid it.
function findExits() {
  exitVersion = Nav.version;
  if (exitKind.length < Nav.nodeCount) { exitKind = new Uint8Array(Nav.nodeCount); exitList = new Int32Array(Nav.nodeCount); } else exitKind.fill(0);
  exitCount = 0; blockedExits = 0;
  if (!mapHasWater) return;
  for (let node = 0; node < Nav.nodeCount; node++) {
    if (!(Nav.nodeFlags[node] & NAV_NODE.WATER)) continue;
    for (let link = Nav.linkStart[node]; link < Nav.linkStart[node + 1]; link++) classifyExit(Nav.linkTarget[link]);
  }
  for (let node = 0; node < Nav.nodeCount; node++) if (exitKind[node] === EXIT.OPEN) exitList[exitCount++] = node;
}

function classifyExit(to) {
  if (!(Nav.nodeFlags[to] & NAV_NODE.WATER)) exitKind[to] = EXIT.OPEN;
}

// The open exit nearest a swimmer that the swimmer's node reaches, or -1.
function nearestExit(from, x, y, z) {
  let best = -1, bestDistance = Infinity;
  for (let i = 0; i < exitCount; i++) {
    const node = exitList[i];
    if (exitBlocked(node)) continue;   // a swimmer failed here: never sent back to it
    const distance = length3(Nav.nodeX[node] - x, Nav.nodeY[node] - y, Nav.nodeZ[node] - z);
    if (distance < bestDistance && Nav.reachable(from, node)) { bestDistance = distance; best = node; }
  }
  return best;
}

function markBlockedExit(node) {
  if (node < 0 || node >= exitKind.length || exitVersion !== Nav.version || exitKind[node] === EXIT.BLOCKED) return;
  exitKind[node] = EXIT.BLOCKED;
  blockedExits++;
}

BotMove.init();
Bus.on('match.start', () => { buildCosts(); findExits(); });
Bus.on('nav.ready', () => { buildCosts(); findExits(); });   // a sliced build finished after match start
Bus.on('world.trigger', (event) => { if (event.kind === 'jumppad' && Bots.active[event.id]) BotMove.padRideUntil[event.id] = Sim.time + PAD_RIDE_SECONDS; });
