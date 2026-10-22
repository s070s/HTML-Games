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
// values[index] wrapped into -PI..PI in place: the form for per-step code, where a float argument or return of a call that is
// not inlined is boxed on the heap (PERF-006).
const wrapAngleAt = (values, index) => {
  let a = values[index] % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  values[index] = a;
};
const wrapAngleScratch = new Float64Array(1);
const wrapAngle = (radians) => { // into -PI..PI
  wrapAngleScratch[0] = radians;
  wrapAngleAt(wrapAngleScratch, 0);
  return wrapAngleScratch[0];
};
const lerpAngle = (from, to, t) => from + wrapAngle(to - from) * t;
const smoothstep = (edge0, edge1, x) => { const t = clamp((x - edge0) / (edge1 - edge0), 0, 1); return t * t * (3 - 2 * t); };
// Vector lengths for hot paths (use them instead of Math.hypot there): V8 runs Math.hypot as a built-in call that boxes its
// arguments and result on the heap every time, these inline to one square root (PERF-006).
const length2 = (x, z) => Math.sqrt(x * x + z * z);
const length3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const distanceSquared3 = (ax, ay, az, bx, by, bz) => { const dx = bx - ax, dy = by - ay, dz = bz - az; return dx * dx + dy * dy + dz * dz; };
// A player-typed name or label: control characters and angle brackets removed, trimmed, cut to `limit` characters.
const cleanLabel = (text, limit) => String(text).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, limit);

const Vec = {
  make: (x = 0, y = 0, z = 0) => ({ x, y, z }),
  set: (out, x, y, z) => { out.x = x; out.y = y; out.z = z; return out; },
  copy: (out, a) => { out.x = a.x; out.y = a.y; out.z = a.z; return out; },
  length: (a) => length3(a.x, a.y, a.z),
  normalize: (out, a) => { const l = length3(a.x, a.y, a.z) || 1; out.x = a.x / l; out.y = a.y / l; out.z = a.z / l; return out; },
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
  total: 0,               // entries ever added (the list keeps only the last `size`)
  add(where, error) {
    const text = where + ': ' + (error && error.stack ? String(error.stack).split('\n').slice(0, 3).join(' | ') : String(error));
    this.total++;
    this.entries.push(text);
    if (this.entries.length > this.size) this.entries.shift();
  },
  // The entries added after ErrorLog.total was `count` (the kept ones).
  since(count) { return this.entries.slice(Math.max(0, this.entries.length - (this.total - count))); },
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

// Accumulates clock[index]; true once per interval (gadget areas, placed devices, mode timers, PU17 ammo regen).
function intervalDue(clock, index, dt, interval) {
  clock[index] += dt;
  if (clock[index] < interval - 1e-6) return false;
  clock[index] -= interval;
  return true;
}

// ---- The emitters every section shares (one reused payload each: listeners copy what they keep) ----
const SOUND_EVENT = { x: 0, y: 0, z: 0, radius: 0, kind: '', source: -1, effect: '' };   // effect: the gadget row's, for grenade bounces
const IMPULSE_EVENT = { id: 0, x: 0, y: 0, z: 0 };
const TOAST_EVENT = { text: '' };
// 'sound': what bots can hear (BOT-005); radius 0 = silent, nothing is sent.
function emitSound(x, y, z, radius, kind, source, effect) {
  if (radius <= 0) return;
  SOUND_EVENT.x = x; SOUND_EVENT.y = y; SOUND_EVENT.z = z; SOUND_EVENT.radius = radius; SOUND_EVENT.kind = kind; SOUND_EVENT.source = source;
  SOUND_EVENT.effect = effect || '';
  Bus.emit('sound', SOUND_EVENT);
}
// 'impulse': a velocity change in m/s that S10 applies (knockback, jump pads, leaps).
function emitImpulse(id, x, y, z) {
  IMPULSE_EVENT.id = id; IMPULSE_EVENT.x = x; IMPULSE_EVENT.y = y; IMPULSE_EVENT.z = z;
  Bus.emit('impulse', IMPULSE_EVENT);
}
// 'toast': a short UI message.
function emitToast(text) {
  TOAST_EVENT.text = text;
  Bus.emit('toast', TOAST_EVENT);
}

// ---- Fixed-size pool of reusable objects (zero allocation after warm-up, PERF-006) ----
function makePool(size, create) {
  const items = [];
  for (let i = 0; i < size; i++) items.push(create(i));
  let next = 0;
  // Ring reuse: the oldest object is recycled when the pool wraps (documented per pool owner).
  return { items, take() { const item = items[next]; next = (next + 1) % size; return item; } };
}

// ---- Lookup grids (ARC-013, one source): nav (S09), the render bake (S07) and the map scan (S16) bucket brushes by xz cell ----
// Lists per cell in compressed form: eachCell(index, visit) calls visit(cell) for every cell of item `index`. Returns { start, items }:
// the items of cell c are items[start[c]] .. items[start[c + 1] - 1], in item order.
function bucketByCell(itemCount, cellCount, eachCell) {
  const start = new Int32Array(cellCount + 1);
  for (let index = 0; index < itemCount; index++) eachCell(index, (cell) => { start[cell + 1]++; });
  for (let cell = 0; cell < cellCount; cell++) start[cell + 1] += start[cell];
  const fill = start.slice(0, cellCount), items = new Int32Array(start[cellCount]);
  for (let index = 0; index < itemCount; index++) eachCell(index, (cell) => { items[fill[cell]++] = index; });
  return { start, items };
}
const gridCellIndex = (value, origin, size, cells) => clamp(Math.floor((value - origin) / size), 0, cells - 1);

// A grid record: { originX, originZ, cellSize, cellsX, cellsZ, cellStart, cellItems } plus the query state { stamp, stampValue, found, foundCount }.
// Cell indices clamp to the edge cells, so a box past the rectangle is still found from the nearest edge cell; callers test found boxes exactly.
const BrushGrid = {
  // Fills `grid` (callers may keep their own per-box arrays on it) with boxes { minX, minZ, maxX, maxZ } over the xz rectangle.
  build(grid, boxes, cellSize, minX, minZ, maxX, maxZ) {
    this.shape(grid, cellSize, minX, minZ, maxX, maxZ);
    const lists = bucketByCell(boxes.length, grid.cellsX * grid.cellsZ, (index, visit) => {
      const box = boxes[index];
      this.forCells(grid, box.minX, box.minZ, box.maxX, box.maxZ, visit);
    });
    grid.cellStart = lists.start; grid.cellItems = lists.items;
    grid.stamp = new Uint32Array(boxes.length); grid.stampValue = 0;
    grid.found = new Int32Array(boxes.length); grid.foundCount = 0;
    return grid;
  },
  // Origin, cell size and cell counts of a grid over the xz rectangle (at least one cell per axis).
  shape(grid, cellSize, minX, minZ, maxX, maxZ) {
    grid.originX = minX; grid.originZ = minZ; grid.cellSize = cellSize;
    grid.cellsX = Math.max(1, Math.ceil((maxX - minX) / cellSize));
    grid.cellsZ = Math.max(1, Math.ceil((maxZ - minZ) / cellSize));
  },
  cellAt(grid, x, z) {
    return gridCellIndex(z, grid.originZ, grid.cellSize, grid.cellsZ) * grid.cellsX + gridCellIndex(x, grid.originX, grid.cellSize, grid.cellsX);
  },
  // Calls visit(cell) for every cell the xz rectangle overlaps; visit is a top-level function so queries allocate nothing.
  forCells(grid, minX, minZ, maxX, maxZ, visit) {
    const i0 = gridCellIndex(minX, grid.originX, grid.cellSize, grid.cellsX), i1 = gridCellIndex(maxX, grid.originX, grid.cellSize, grid.cellsX);
    const j0 = gridCellIndex(minZ, grid.originZ, grid.cellSize, grid.cellsZ), j1 = gridCellIndex(maxZ, grid.originZ, grid.cellSize, grid.cellsZ);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) visit(j * grid.cellsX + i);
    }
  },
  // A new pass: from here on every box counts once (a query or a ray walk that meets a box in several cells).
  beginPass(grid) { grid.stampValue++; grid.foundCount = 0; },
  firstVisit(grid, index) {
    if (grid.stamp[index] === grid.stampValue) return false;
    grid.stamp[index] = grid.stampValue;
    return true;
  },
  // The boxes of the cells the rectangle overlaps into grid.found[0 .. count - 1], each once, in cell then box order; returns count.
  query(grid, minX, minZ, maxX, maxZ) {
    this.beginPass(grid);
    const i0 = gridCellIndex(minX, grid.originX, grid.cellSize, grid.cellsX), i1 = gridCellIndex(maxX, grid.originX, grid.cellSize, grid.cellsX);
    const j0 = gridCellIndex(minZ, grid.originZ, grid.cellSize, grid.cellsZ), j1 = gridCellIndex(maxZ, grid.originZ, grid.cellSize, grid.cellsZ);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) this.gatherCell(grid, j * grid.cellsX + i);
    }
    return grid.foundCount;
  },
  gatherCell(grid, cell) {
    const stamp = grid.stamp, stampValue = grid.stampValue;
    for (let k = grid.cellStart[cell]; k < grid.cellStart[cell + 1]; k++) {
      const index = grid.cellItems[k];
      if (stamp[index] === stampValue) continue;
      stamp[index] = stampValue;
      grid.found[grid.foundCount++] = index;
    }
  },
  // 2D ray walk (Amanatides-Woo) over the cells a horizontal direction (dx, dz) crosses, in a reused record { i, j, stepI, stepJ,
  // nextI, nextJ, deltaI, deltaJ } (next* = ray distance to the next cell border per axis). Cell coordinates are not clamped.
  startWalk(grid, walk, ox, oz, dx, dz) {
    const size = grid.cellSize, movesX = Math.abs(dx) > 1e-9, movesZ = Math.abs(dz) > 1e-9;
    walk.i = Math.floor((ox - grid.originX) / size); walk.j = Math.floor((oz - grid.originZ) / size);
    walk.stepI = dx > 0 ? 1 : -1; walk.stepJ = dz > 0 ? 1 : -1;
    walk.deltaI = movesX ? size / Math.abs(dx) : Infinity;
    walk.deltaJ = movesZ ? size / Math.abs(dz) : Infinity;
    walk.nextI = movesX ? (grid.originX + (walk.i + (dx > 0 ? 1 : 0)) * size - ox) / dx : Infinity;
    walk.nextJ = movesZ ? (grid.originZ + (walk.j + (dz > 0 ? 1 : 0)) * size - oz) / dz : Infinity;
    return walk;
  },
  // Into the next cell along the ray; returns the ray distance at which the walk entered it.
  stepWalk(walk) {
    if (walk.nextI < walk.nextJ) {
      walk.i += walk.stepI; walk.nextI += walk.deltaI;
      return walk.nextI - walk.deltaI;
    }
    walk.j += walk.stepJ; walk.nextJ += walk.deltaJ;
    return walk.nextJ - walk.deltaJ;
  },
  // The cell the walk is in, or -1 outside the grid.
  walkCell(grid, walk) {
    if (walk.i < 0 || walk.j < 0 || walk.i >= grid.cellsX || walk.j >= grid.cellsZ) return -1;
    return walk.j * grid.cellsX + walk.i;
  },
};
function makeGridWalk() { return { i: 0, j: 0, stepI: 0, stepJ: 0, nextI: 0, nextJ: 0, deltaI: 0, deltaJ: 0 }; }

// ---- Input buttons shared by player input, bots (BOT-001: same input struct) and replays ----
const BTN = {
  FIRE: 1 << 0, ALT: 1 << 1, JUMP: 1 << 2, CROUCH: 1 << 3, SPRINT: 1 << 4, RELOAD: 1 << 5, USE: 1 << 6,
  ABILITY1: 1 << 7, ABILITY2: 1 << 8, ULTIMATE: 1 << 9, GRENADE: 1 << 10, MELEE: 1 << 11, GADGET: 1 << 12,
  PING: 1 << 13, NEXT_WEAPON: 1 << 14, PREV_WEAPON: 1 << 15, WALK: 1 << 16, PRONE: 1 << 17, HEAL: 1 << 18,
  CYCLE_GRENADE: 1 << 19,     // the next carried grenade type (S12 Gadgets.cycleGrenade)
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
  // Read-only views by system name: last step cost in ms (perf HUD) and the summed cost since load (tools/perf.mjs). The
  // numbers live in each system's record (ms, totalMs): an object with ~30 names added by key falls back to dictionary
  // mode, where every write of a float would allocate a heap number (twice per system per step, PERF-006).
  timing: {},
  timingTotal: {},
  addSystem(name, order, step) {
    const system = { name, order, step, ms: 0, totalMs: 0 };
    this.systems.push(system);
    this.systems.sort((a, b) => a.order - b.order);
    Object.defineProperty(this.timing, name, { get: () => system.ms, enumerable: true, configurable: true });
    Object.defineProperty(this.timingTotal, name, { get: () => system.totalMs, enumerable: true, configurable: true });
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
      const spent = performance.now() - started;
      system.ms = spent;
      system.totalMs += spent;
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
  setupHooks: [],         // fn(setup) later sections push to adjust every setup before match.setup (18l: the player's assist sliders)

  isRunning() { return this.state === 'playing' && !this.paused; },
  // setup: { mode, map, ruleset, mutators, bots, seed, difficulty, player } - each section reads the fields it owns.
  start(setup) {
    if (this.match) this.stop();
    for (const adjust of this.setupHooks) adjust(setup);   // every start path (play, career, custom, generated, restart) gets them
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
