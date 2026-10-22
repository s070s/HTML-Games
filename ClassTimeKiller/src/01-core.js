// ==== S01 UTIL / MATH ====
// Shared constants, math helpers, event bus, actor store and the simulation system list.
// Rules for every later section: see docs/ARCHITECTURE.md (contracts, events, actor fields).

const VERSION = '0.1.0';
const TICK_RATE = 120;                 // simulation steps per second (ARC-010)
const TICK_SECONDS = 1 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 4;         // ARC-010: drop the remainder after 4 steps
const DEG = Math.PI / 180;
const GRAVITY = 20;                    // m/s^2 before the ruleset gravityScale (arena feel; presets scale it)
const MAX_ACTORS = 64;                 // ARC-011

// ---- Math (scalar helpers; vectors are plain {x,y,z} objects reused by callers, never created per frame) ----
const clamp = (value, low, high) => (value < low ? low : value > high ? high : value);
const lerp = (from, to, t) => from + (to - from) * t;
const wrapAngle = (radians) => { // into -PI..PI
  let a = radians % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const lerpAngle = (from, to, t) => from + wrapAngle(to - from) * t;
const smoothstep = (edge0, edge1, x) => { const t = clamp((x - edge0) / (edge1 - edge0), 0, 1); return t * t * (3 - 2 * t); };
const distanceSquared3 = (ax, ay, az, bx, by, bz) => { const dx = bx - ax, dy = by - ay, dz = bz - az; return dx * dx + dy * dy + dz * dz; };
// A player-typed name or label: control characters and angle brackets removed, trimmed, cut to `limit` characters.
const cleanLabel = (text, limit) => String(text).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, limit);

const Vec = {
  make: (x = 0, y = 0, z = 0) => ({ x, y, z }),
  set: (out, x, y, z) => { out.x = x; out.y = y; out.z = z; return out; },
  copy: (out, a) => { out.x = a.x; out.y = a.y; out.z = a.z; return out; },
  length: (a) => Math.hypot(a.x, a.y, a.z),
  normalize: (out, a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; out.x = a.x / l; out.y = a.y / l; out.z = a.z / l; return out; },
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  // Direction a yaw/pitch pair looks at (DATA-002: yaw 0 looks +Z, positive pitch looks up, Y up).
  fromAngles: (out, yaw, pitch) => {
    const c = Math.cos(pitch);
    out.x = Math.sin(yaw) * c; out.y = Math.sin(pitch); out.z = Math.cos(yaw) * c;
    return out;
  },
};

// Column-major 4x4 matrices on Float32Array (WebGL layout).
const Mat4 = {
  create: () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  identity: (out) => { out.fill(0); out[0] = out[5] = out[10] = out[15] = 1; return out; },
  perspective: (out, fovYRadians, aspect, near, far) => {
    const f = 1 / Math.tan(fovYRadians / 2), rangeInverse = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect; out[5] = f; out[10] = (near + far) * rangeInverse; out[11] = -1; out[14] = 2 * near * far * rangeInverse;
    return out;
  },
  // View matrix for a first-person camera at (x,y,z) with yaw/pitch (DATA-002).
  firstPerson: (out, x, y, z, yaw, pitch) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // forward f = (sy*cp, sp, cy*cp); camera looks down -Z so the view Z axis is -f
    const fx = sy * cp, fy = sp, fz = cy * cp;
    const rx = -cy, ry = 0, rz = sy;                          // right = cross(forward, worldUp), normalized (yaw 0: right is -X)
    const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx; // up = cross(right, forward)
    out[0] = rx; out[1] = ux; out[2] = -fx; out[3] = 0;
    out[4] = ry; out[5] = uy; out[6] = -fy; out[7] = 0;
    out[8] = rz; out[9] = uz; out[10] = -fz; out[11] = 0;
    out[12] = -(rx * x + ry * y + rz * z); out[13] = -(ux * x + uy * y + uz * z); out[14] = fx * x + fy * y + fz * z; out[15] = 1;
    return out;
  },
  multiply: (out, a, b) => {
    for (let column = 0; column < 4; column++) {
      const b0 = b[column * 4], b1 = b[column * 4 + 1], b2 = b[column * 4 + 2], b3 = b[column * 4 + 3];
      out[column * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      out[column * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      out[column * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      out[column * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return out;
  },
};

// ---- Error ring (ARC-041): every caught error lands here; the perf HUD and __CTK.log.errors() read it ----
const ErrorLog = {
  size: 50,
  entries: [],
  add(where, error) {
    const text = where + ': ' + (error && error.stack ? String(error.stack).split('\n').slice(0, 3).join(' | ') : String(error));
    this.entries.push(text);
    if (this.entries.length > this.size) this.entries.shift();
  },
};

// ---- Event bus (ARC-015). Payload objects are reused by the emitter: listeners must copy what they keep. ----
const Bus = {
  listeners: new Map(),
  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
    return handler;
  },
  off(type, handler) {
    const list = this.listeners.get(type);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  },
  emit(type, payload) {
    const list = this.listeners.get(type);
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (error) { ErrorLog.add('event ' + type, error); }
    }
  },
};

// ---- Fixed-size pool of reusable objects (zero allocation after warm-up, PERF-006) ----
function makePool(size, create) {
  const items = [];
  for (let i = 0; i < size; i++) items.push(create(i));
  let next = 0;
  // Ring reuse: the oldest object is recycled when the pool wraps (documented per pool owner).
  return { items, take() { const item = items[next]; next = (next + 1) % size; return item; } };
}

// ---- Input buttons shared by player input, bots (BOT-001: same input struct) and replays ----
const BTN = {
  FIRE: 1 << 0, ALT: 1 << 1, JUMP: 1 << 2, CROUCH: 1 << 3, SPRINT: 1 << 4, RELOAD: 1 << 5, USE: 1 << 6,
  ABILITY1: 1 << 7, ABILITY2: 1 << 8, ULTIMATE: 1 << 9, GRENADE: 1 << 10, MELEE: 1 << 11, GADGET: 1 << 12,
  PING: 1 << 13, NEXT_WEAPON: 1 << 14, PREV_WEAPON: 1 << 15, WALK: 1 << 16, PRONE: 1 << 17,
  CYCLE_GRENADE: 1 << 18,     // the next carried grenade type (S12 Gadgets.cycleGrenade)
};

// ---- Body sizes (DATA-003): capsule, stances, step and hit volumes (head sphere, torso/legs cylinders scaled by height / STAND_HEIGHT) ----
const STAND_HEIGHT = 1.8;
const ACTOR_RADIUS = 0.40;
const STEP_HEIGHT = 0.45;
const HEAD_RADIUS = 0.14, HEAD_ABOVE_EYE = 0.04;
const TORSO_RADIUS = 0.3, TORSO_LOW = 0.85, TORSO_HIGH = 1.45, STOMACH_HIGH = 1.1;
const LEGS_RADIUS = 0.22, LEGS_LOW = 0.05, LEGS_HIGH = 0.85;
const ZONE = { NONE: 0, HEAD: 1, BODY: 2, LEGS: 3 };
const ZONE_NAMES = ['none', 'head', 'body', 'legs'];

const ACTOR_KIND = { NONE: 0, PLAYER: 1, BOT: 2, ENEMY: 3, DUMMY: 4 };
const ACTOR_FLAG = { ON_GROUND: 1 << 0, CROUCHED: 1 << 1, PRONE: 1 << 2, SPRINTING: 1 << 3, SLIDING: 1 << 4, WALL_RUN: 1 << 5,
  IN_WATER: 1 << 6, ON_LADDER: 1 << 7, PROTECTED: 1 << 8, INVISIBLE: 1 << 9, DOWNED: 1 << 10, GOD: 1 << 11, FROZEN: 1 << 12 };

// ---- Actor store (ARC-011): struct of arrays, index 0..MAX_ACTORS-1. Sections add their own per-actor arrays. ----
const Actors = {
  kind: new Uint8Array(MAX_ACTORS),
  alive: new Uint8Array(MAX_ACTORS),
  team: new Int8Array(MAX_ACTORS),          // -1 = no team (FFA)
  flags: new Uint32Array(MAX_ACTORS),
  x: new Float32Array(MAX_ACTORS), y: new Float32Array(MAX_ACTORS), z: new Float32Array(MAX_ACTORS),  // feet position
  vx: new Float32Array(MAX_ACTORS), vy: new Float32Array(MAX_ACTORS), vz: new Float32Array(MAX_ACTORS),
  yaw: new Float32Array(MAX_ACTORS), pitch: new Float32Array(MAX_ACTORS),
  prevX: new Float32Array(MAX_ACTORS), prevY: new Float32Array(MAX_ACTORS), prevZ: new Float32Array(MAX_ACTORS),
  prevYaw: new Float32Array(MAX_ACTORS), prevPitch: new Float32Array(MAX_ACTORS),
  height: new Float32Array(MAX_ACTORS), eye: new Float32Array(MAX_ACTORS),          // current capsule height / eye height
  health: new Float32Array(MAX_ACTORS), armor: new Float32Array(MAX_ACTORS), shield: new Float32Array(MAX_ACTORS),
  maxHealth: new Float32Array(MAX_ACTORS), maxArmor: new Float32Array(MAX_ACTORS), maxShield: new Float32Array(MAX_ACTORS),
  // Input written before each step by the player input layer or a bot brain, read by every system.
  moveX: new Float32Array(MAX_ACTORS), moveZ: new Float32Array(MAX_ACTORS),           // -1..1 strafe right / forward
  aimYaw: new Float32Array(MAX_ACTORS), aimPitch: new Float32Array(MAX_ACTORS),       // desired view angles (radians)
  buttons: new Uint32Array(MAX_ACTORS), pressed: new Uint32Array(MAX_ACTORS),         // held bits / bits that went down this step
  previousButtons: new Uint32Array(MAX_ACTORS),
  slotRequest: new Int8Array(MAX_ACTORS),                                             // weapon slot 1-9 wanted, 0 = none
  name: new Array(MAX_ACTORS).fill(''),
  profile: new Array(MAX_ACTORS).fill(null),   // bot profile row, enemy row or player profile
  spawnCount: new Uint32Array(MAX_ACTORS),
  count: 0,                                     // highest used index + 1 (loops run 0..count-1 and test alive/kind)

  create(kind, team, name, profile) {
    for (let id = 0; id < MAX_ACTORS; id++) {
      if (this.kind[id] !== ACTOR_KIND.NONE) continue;
      this.reset(id);
      this.kind[id] = kind; this.team[id] = team; this.name[id] = name || ''; this.profile[id] = profile || null;
      if (id >= this.count) this.count = id + 1;
      Bus.emit('actor.create', id);
      return id;
    }
    return -1;
  },
  remove(id) {
    if (this.kind[id] === ACTOR_KIND.NONE) return;
    Bus.emit('actor.remove', id);
    this.reset(id);
    while (this.count > 0 && this.kind[this.count - 1] === ACTOR_KIND.NONE) this.count--;
  },
  reset(id) {
    this.kind[id] = 0; this.alive[id] = 0; this.team[id] = -1; this.flags[id] = 0;
    this.x[id] = this.y[id] = this.z[id] = this.vx[id] = this.vy[id] = this.vz[id] = 0;
    this.yaw[id] = this.pitch[id] = this.aimYaw[id] = this.aimPitch[id] = 0;
    this.moveX[id] = this.moveZ[id] = 0; this.buttons[id] = this.pressed[id] = this.previousButtons[id] = 0;
    this.slotRequest[id] = 0; this.health[id] = this.armor[id] = this.shield[id] = 0; this.spawnCount[id] = 0;
    this.height[id] = 1.8; this.eye[id] = 1.62; this.name[id] = ''; this.profile[id] = null;
  },
  clear() {
    for (let id = 0; id < MAX_ACTORS; id++) if (this.kind[id] !== ACTOR_KIND.NONE) this.remove(id);
    this.count = 0;
  },
  isEnemy(a, b) { return a !== b && (this.team[a] < 0 || this.team[a] !== this.team[b]); },
  eyeY(id) { return this.y[id] + this.eye[id]; },
};

// ---- Simulation systems: each section registers its fixed-step function with an order number ----
// Order: 10 input/brains, 20 abilities+status, 30 movement, 40 weapons, 50 projectiles, 60 items, 70 rules/modes, 80 PvE director, 90 effects bookkeeping.
const Sim = {
  systems: [],
  tick: 0,          // steps since match start; the sim's only clock (ARC-010: never read wall-clock)
  timeScale: 1,     // game speed: the loop feeds real seconds x timeScale to the 120 Hz steps (mutators X02/X27, difficulty)
  time: 0,          // tick * TICK_SECONDS
  timing: {},       // last step cost per system in ms (perf HUD)
  addSystem(name, order, step) {
    this.systems.push({ name, order, step });
    this.systems.sort((a, b) => a.order - b.order);
  },
  step() {
    for (let id = 0; id < Actors.count; id++) {
      const held = Actors.buttons[id];
      Actors.pressed[id] = held & ~Actors.previousButtons[id];
      Actors.previousButtons[id] = held;
      Actors.prevX[id] = Actors.x[id]; Actors.prevY[id] = Actors.y[id]; Actors.prevZ[id] = Actors.z[id];
      Actors.prevYaw[id] = Actors.yaw[id]; Actors.prevPitch[id] = Actors.pitch[id];
    }
    for (let i = 0; i < this.systems.length; i++) {
      const system = this.systems[i];
      const started = performance.now();
      try { system.step(TICK_SECONDS); } catch (error) { ErrorLog.add('system ' + system.name, error); }
      this.timing[system.name] = performance.now() - started;
    }
    this.tick++;
    this.time = this.tick * TICK_SECONDS;
  },
  run(steps) { for (let i = 0; i < steps; i++) this.step(); },
  reset() { this.tick = 0; this.time = 0; },
};

// ---- Fatal screen (PLT-002, ARC-041): any section may call it when the game cannot continue ----
let fatalShown = false;
function showFatal(title, text, detail) {
  fatalShown = true;
  document.getElementById('fatal-title').textContent = title;
  document.getElementById('fatal-text').textContent = text;
  document.getElementById('fatal-detail').textContent = detail || '';
  document.getElementById('fatal').classList.add('show');
}

// ---- Match lifecycle (sections react through the match.* events listed in docs/ARCHITECTURE.md) ----
const Game = {
  state: 'menu',          // 'menu' | 'playing' | 'results'
  paused: false,
  pauseReason: '',
  match: null,            // { setup, rules, map, ended, winner, ... } filled by the match.* listeners
  playerId: -1,
  headless: false,        // true in headless self-tests: no WebGL, no DOM UI, no audio

  isRunning() { return this.state === 'playing' && !this.paused; },
  // setup: { mode, map, ruleset, mutators, bots, seed, difficulty, player } - each section reads the fields it owns.
  start(setup) {
    if (this.match) this.stop();
    Sim.reset();
    Actors.clear();
    this.match = { setup, rules: null, map: null, ended: false, winner: null, startTick: 0 };
    this.playerId = -1;
    Bus.emit('match.setup', this.match);
    Bus.emit('match.load', this.match);
    Bus.emit('match.start', this.match);
    this.state = 'playing';
    this.paused = false;
    return this.match;
  },
  // Called by the mode when a win condition is met.
  end(winner) {
    if (!this.match || this.match.ended) return;
    this.match.ended = true;
    this.match.winner = winner;
    this.state = 'results';
    Bus.emit('match.end', this.match);
  },
  stop() {
    if (!this.match) return;
    Bus.emit('match.stop', this.match);
    Actors.clear();
    this.match = null;
    this.state = 'menu';
    this.paused = false;
  },
  pause(reason) {
    if (this.state !== 'playing' || this.paused) return;
    this.paused = true;
    this.pauseReason = reason || 'menu';
    Bus.emit('game.pause', this.pauseReason);
  },
  resume() {
    if (!this.paused) return;
    this.paused = false;
    Bus.emit('game.resume', null);
  },
};
