// Effects (PERF-010, REN-003 particle program): GPU particles, tracers and decals are instanced quads in fixed
// ring buffers. Motion is computed in the vertex shader from spawn data (origin, velocity, gravity, drag, birth time),
// so the CPU only writes a slot when something spawns. Caps come from the quality row (particles, decals, lights).

const PARTICLE_FLOATS = 18;              // origin xyz | velocity xyz | birth life size0 size1 | rgba | gravity drag mode seed
const PARTICLE_MODE = { billboard: 0, tracer: 1, decal: 2, streak: 3 };
const ADDITIVE_FLAG = 4;                 // added to the mode: premultiplied output with alpha 0 = glow
const TRACER_SECONDS = 0.09;
const TRACER_WIDTH = 0.025;
const TRACER_COLOR = '#ffe7a8';
const LIGHT_BOOST = 1.6;
const PARTICLE_ATTRIBUTES = { aCorner: 0, aOrigin: 1, aVelocity: 2, aTiming: 3, aColor: 4, aParams: 5 };
const maxOf = (field) => CAT.quality.reduce((most, row) => Math.max(most, row[field]), 1);

// A ring-buffer pool of particle slots; `cap` is the active size (quality), `capacity` the allocated maximum.
function makeParticlePool(name, capacity) {
  return { name, capacity, data: new Float32Array(capacity * PARTICLE_FLOATS), deathTime: new Float32Array(capacity),
    next: 0, used: 0, live: 0, lastDeath: 0, dirtyMin: capacity, dirtyMax: -1, buffer: null, vertexArray: null };
}
const particlePool = makeParticlePool('particles', maxOf('particles'));
const decalPool = makeParticlePool('decals', maxOf('decals'));
const fxColor = new Float32Array(3);
const fxDirection = new Float64Array(3);
// A point of an effect and its direction, a Float64Array (makeFxPoint; read it by FP_X FP_Y FP_Z, the normal FP_NX FP_NY FP_NZ, a size FP_SIZE (burst: a multiple of the kind's size; light: the radius in metres) and an alpha (burst: a multiple of the kind's). The callers of
// burstAt / decalAt / muzzleLight fill their own record, so no float travels as an argument (PERF-006); burst() fills this one.
// Float64 elements, not object fields: a number computed into an element is stored unboxed in every tier, one stored into a field may be boxed on the heap (PERF-006).
const FP_X = 0, FP_Y = 1, FP_Z = 2, FP_NX = 3, FP_NY = 4, FP_NZ = 5, FP_SIZE = 6, FP_ALPHA = 7;
function makeFxPoint() { return Float64Array.of(0, 0, 0, 0, 0, 0, 1, 1); }
const fxPoint = makeFxPoint();
const fxKindRows = {};
CAT.fxKinds.forEach((row) => { fxKindRows[row.id] = row; });
const decalKindRows = {};
CAT.decalKinds.forEach((row) => { decalKindRows[row.id] = row; });

// Takes the next slot of a pool (oldest is overwritten when the active cap is reached) and marks it for upload.
function takeSlot(pool, cap) {
  if (pool.next >= cap) pool.next = 0;
  const slot = pool.next++;
  if (slot >= pool.used) pool.used = slot + 1;
  if (slot < pool.dirtyMin) pool.dirtyMin = slot;
  if (slot > pool.dirtyMax) pool.dirtyMax = slot;
  return slot;
}

// The particle being written: its fields are set by the caller, writeParticle copies them into the slot (a record instead of fifteen float arguments, PERF-006).
const SP_X = 0, SP_Y = 1, SP_Z = 2, SP_VX = 3, SP_VY = 4, SP_VZ = 5, SP_LIFE = 6, SP_SIZE0 = 7, SP_SIZE1 = 8, SP_ALPHA = 9, SP_GRAVITY = 10, SP_DRAG = 11, SP_MODE = 12;
const fxSpawn = new Float64Array(13);   // a Float64Array, not an object: a number computed into an element is never boxed
const FX_DRAWS = 7;                      // random draws a particle takes: three for the direction, speed, life, size, the turn of its quad (fxNoise[0..6])
const fxNoise = new Float64Array(FX_DRAWS);   // a particle's draws, taken in one call: a function that returns a number boxes it unless it is inlined
function writeParticle(pool, slot) {
  const d = pool.data, o = slot * PARTICLE_FLOATS, now = Render.frame.time, s = fxSpawn;
  d[o] = s[SP_X]; d[o + 1] = s[SP_Y]; d[o + 2] = s[SP_Z]; d[o + 3] = s[SP_VX]; d[o + 4] = s[SP_VY]; d[o + 5] = s[SP_VZ];
  d[o + 6] = now; d[o + 7] = s[SP_LIFE]; d[o + 8] = s[SP_SIZE0]; d[o + 9] = s[SP_SIZE1];
  d[o + 10] = fxColor[0]; d[o + 11] = fxColor[1]; d[o + 12] = fxColor[2]; d[o + 13] = s[SP_ALPHA];
  d[o + 14] = s[SP_GRAVITY]; d[o + 15] = s[SP_DRAG]; d[o + 16] = s[SP_MODE]; d[o + 17] = fxNoise[6] * Math.PI * 2;
  pool.deathTime[slot] = now + s[SP_LIFE];
  pool.lastDeath = Math.max(pool.lastDeath, now + s[SP_LIFE]);   // past it every slot is dead: the draw is skipped
}

// After a quality step-down the slots past the new cap are dropped: the draw and the live count stop at the cap.
function fitPool(pool, cap) {
  if (pool.used > cap) pool.used = cap;
  if (pool.next > cap) pool.next = 0;
}

// Live slots of a pool on the effects clock (counted once per frame for the stats and the triangle counter).
function countLive(pool) {
  const now = Render.frame.time;
  let live = 0;
  for (let i = 0; i < pool.used; i++) if (pool.deathTime[i] > now) live++;
  return live;
}

// Random direction around the normal of `point`: the kind's spread 0 = the normal, 1 = almost any direction (a zero normal = any direction).
function randomDirection(point, row) {
  const spread = row.spread;   // the draws are in fxNoise already
  const x = point[FP_NX] + (fxNoise[0] * 2 - 1) * spread * 2, y = point[FP_NY] + (fxNoise[1] * 2 - 1) * spread * 2, z = point[FP_NZ] + (fxNoise[2] * 2 - 1) * spread * 2;
  const length = Math.sqrt(x * x + y * y + z * z) + 1e-9;   // never 0 (a || 1 mixes a float with an integer and boxes the float, PERF-006)
  fxDirection[0] = x / length; fxDirection[1] = y / length; fxDirection[2] = z / length;
  return fxDirection;
}

const Fx = {
  // kind: a CAT.fxKinds id; count <= 0 uses the kind's default; colorHex overrides the kind colour.
  burst(kind, x, y, z, nx, ny, nz, count, colorHex) {
    fxPoint[FP_X] = x; fxPoint[FP_Y] = y; fxPoint[FP_Z] = z; fxPoint[FP_NX] = nx; fxPoint[FP_NY] = ny; fxPoint[FP_NZ] = nz; fxPoint[FP_SIZE] = 1; fxPoint[FP_ALPHA] = 1;
    this.burstAt(kind, fxPoint, count, colorHex);
  },
  // The same from a record (makeFxPoint): the point, the normal and the size multiple of the kind (a muzzle flash of a big gun, a bigger casing).
  burstAt(kind, point, count, colorHex) {
    if (Game.headless) return;
    const row = fxKindRows[kind] || fxKindRows.spark, cap = Render.quality.particles, scale = point[FP_SIZE], s = fxSpawn, speed = row.speed, lifeRange = row.life;
    const total = Math.min(Math.ceil((count > 0 ? count : row.count) * Render.config.particleScale), cap);   // particleScale: ACC-005 intensity slider
    writeColor(fxColor, 0, colorHex === undefined || colorHex === null ? row.color : colorHex);
    const random = Rng.fx;
    s[SP_MODE] = (row.streak ? PARTICLE_MODE.streak : PARTICLE_MODE.billboard) + (row.additive ? ADDITIVE_FLAG : 0); s[SP_ALPHA] = row.alpha * point[FP_ALPHA]; s[SP_GRAVITY] = row.gravity; s[SP_DRAG] = row.drag;
    s[SP_X] = point[FP_X]; s[SP_Y] = point[FP_Y]; s[SP_Z] = point[FP_Z];
    for (let i = 0; i < total; i++) {
      random.fill(fxNoise, FX_DRAWS);
      const direction = randomDirection(point, row), pace = speed[0] + (speed[1] - speed[0]) * fxNoise[3];
      s[SP_LIFE] = lifeRange[0] + (lifeRange[1] - lifeRange[0]) * fxNoise[4];
      const grow = (0.8 + 0.4 * fxNoise[5]) * scale;
      s[SP_VX] = direction[0] * pace; s[SP_VY] = direction[1] * pace; s[SP_VZ] = direction[2] * pace;
      s[SP_SIZE0] = row.size[0] * grow; s[SP_SIZE1] = row.size[1] * grow;
      writeParticle(particlePool, takeSlot(particlePool, cap));
    }
  },
  tracer(ax, ay, az, bx, by, bz, colorHex) {
    if (Game.headless) return;
    writeColor(fxColor, 0, colorHex === undefined || colorHex === null ? TRACER_COLOR : colorHex);
    const slot = takeSlot(particlePool, Render.quality.particles), s = fxSpawn;
    Rng.fx.fill(fxNoise, FX_DRAWS);
    s[SP_X] = ax; s[SP_Y] = ay; s[SP_Z] = az; s[SP_VX] = bx - ax; s[SP_VY] = by - ay; s[SP_VZ] = bz - az;
    s[SP_LIFE] = TRACER_SECONDS; s[SP_SIZE0] = TRACER_WIDTH; s[SP_SIZE1] = TRACER_WIDTH * 0.5; s[SP_ALPHA] = 1; s[SP_GRAVITY] = 0; s[SP_DRAG] = 0; s[SP_MODE] = PARTICLE_MODE.tracer + ADDITIVE_FLAG;
    writeParticle(particlePool, slot);
  },
  // kind: a CAT.decalKinds id (bullet, scorch, blood, energy, frost, paint). Potato keeps no decals (cap 0).
  decal(x, y, z, nx, ny, nz, kind) {
    fxPoint[FP_X] = x; fxPoint[FP_Y] = y; fxPoint[FP_Z] = z; fxPoint[FP_NX] = nx; fxPoint[FP_NY] = ny; fxPoint[FP_NZ] = nz;
    this.decalAt(fxPoint, kind);
  },
  decalAt(point, kind) {
    const cap = Render.quality.decals;
    if (Game.headless || cap <= 0) return;
    Rng.fx.fill(fxNoise, FX_DRAWS);
    const row = decalKindRows[kind] || decalKindRows.bullet, size = row.size * (0.8 + 0.4 * fxNoise[0]), s = fxSpawn;
    writeColor(fxColor, 0, row.color);
    const length = Math.sqrt(point[FP_NX] * point[FP_NX] + point[FP_NY] * point[FP_NY] + point[FP_NZ] * point[FP_NZ]) + 1e-9;
    s[SP_X] = point[FP_X]; s[SP_Y] = point[FP_Y]; s[SP_Z] = point[FP_Z]; s[SP_VX] = point[FP_NX] / length; s[SP_VY] = point[FP_NY] / length; s[SP_VZ] = point[FP_NZ] / length;
    s[SP_LIFE] = row.life; s[SP_SIZE0] = size; s[SP_SIZE1] = size; s[SP_ALPHA] = row.alpha; s[SP_GRAVITY] = 0; s[SP_DRAG] = 0; s[SP_MODE] = PARTICLE_MODE.decal + (row.additive ? ADDITIVE_FLAG : 0);
    writeParticle(decalPool, takeSlot(decalPool, cap));
  },
  // A short-lived point light (muzzle flash, explosion); at most quality.lights are applied per frame (REN-004).
  light(x, y, z, colorHex, radius, seconds) {
    if (Game.headless) return;
    let slot = 0;
    for (let i = 1; i < MAX_DYNAMIC_LIGHTS; i++) if (fxLights.endTime[i] < fxLights.endTime[slot]) slot = i;
    const now = Render.frame.time;
    fxLights.position[slot * 4] = x; fxLights.position[slot * 4 + 1] = y; fxLights.position[slot * 4 + 2] = z; fxLights.position[slot * 4 + 3] = radius;
    writeColor(fxLights.color, slot * 3, colorHex);
    fxLights.startTime[slot] = now;
    fxLights.endTime[slot] = now + Math.max(0.01, seconds);
    fxLights.owner[slot] = -1;
  },
  // P7 F04: the muzzle light of one actor. A live light of the same owner is refreshed (an automatic gun keeps one); otherwise only a free slot is taken, so a
  // muzzle light never replaces a live explosion light, and updateLights applies the muzzle lights last. point[FP_SIZE] = the radius in metres.
  muzzleLight(owner, point, colorHex, seconds) {
    if (Game.headless) return false;
    const now = Render.frame.time;
    let slot = -1;
    for (let i = 0; i < MAX_DYNAMIC_LIGHTS; i++) if (fxLights.owner[i] === owner && fxLights.endTime[i] > now) { slot = i; break; }
    if (slot < 0) for (let i = 0; i < MAX_DYNAMIC_LIGHTS; i++) if (fxLights.endTime[i] <= now) { slot = i; break; }
    if (slot < 0) return false;
    fxLights.position[slot * 4] = point[FP_X]; fxLights.position[slot * 4 + 1] = point[FP_Y]; fxLights.position[slot * 4 + 2] = point[FP_Z]; fxLights.position[slot * 4 + 3] = point[FP_SIZE];
    writeColor(fxLights.color, slot * 3, colorHex);
    fxLights.startTime[slot] = now;
    fxLights.endTime[slot] = now + Math.max(0.01, seconds);
    fxLights.owner[slot] = owner;
    return true;
  },
  clear() {
    for (const pool of [particlePool, decalPool]) {
      pool.deathTime.fill(0); pool.data.fill(0);
      pool.next = 0; pool.used = 0; pool.live = 0; pool.lastDeath = 0; pool.dirtyMin = 0; pool.dirtyMax = pool.capacity - 1;
    }
    fxLights.endTime.fill(0); fxLights.owner.fill(-1);
  },
};
const fxLights = { position: new Float32Array(MAX_DYNAMIC_LIGHTS * 4), color: new Float32Array(MAX_DYNAMIC_LIGHTS * 3),
  startTime: new Float32Array(MAX_DYNAMIC_LIGHTS), endTime: new Float32Array(MAX_DYNAMIC_LIGHTS), owner: new Int16Array(MAX_DYNAMIC_LIGHTS).fill(-1) };   // owner: the actor of a muzzle light, -1 = any other light
Bus.on('match.stop', () => Fx.clear());

// Copies the active lights (fading out over their life) into the shared frame uniforms.
function updateLights() {
  const frame = Render.frame, cap = Math.min(Render.quality.lights, MAX_DYNAMIC_LIGHTS), now = frame.time;
  let count = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < MAX_DYNAMIC_LIGHTS && count < cap; i++) {   // pass 0: explosions and the like, pass 1: muzzle lights take what is left
    if (fxLights.endTime[i] <= now || (fxLights.owner[i] >= 0) !== (pass === 1)) continue;
    const fade = (fxLights.endTime[i] - now) / (fxLights.endTime[i] - fxLights.startTime[i]) * LIGHT_BOOST;
    for (let c = 0; c < 4; c++) frame.lightPositions[count * 4 + c] = fxLights.position[i * 4 + c];
    for (let c = 0; c < 3; c++) frame.lightColors[count * 4 + c] = fxLights.color[i * 3 + c] * fade;
    count++;
  }
  frame.lightCount = count;
  fitPool(particlePool, Render.quality.particles);
  fitPool(decalPool, Render.quality.decals);
  particlePool.live = countLive(particlePool);
  decalPool.live = countLive(decalPool);
  Render.stats.particles = particlePool.live;
}
Render.addUpdate(50, updateLights);

// ---- X37 Lights Out flashlights (rules.fx.darkness) ----
// Each frame the actors nearest the camera get one flashlight each, written straight into the frame lights after the
// effect lights (no Fx slots, so nothing stacks or fades). Muzzle flashes and explosions keep FX_LIGHT_RESERVE lights.
const FLASHLIGHT_AHEAD = 3;              // the light sits this far in front of the eye along the view
const FLASHLIGHT_RADIUS = 11;
const FLASHLIGHT_COLOR = 0xfff0d8;
const FX_LIGHT_RESERVE = 2;
const FLASHLIGHT_MIN_LIGHTS = 1;         // even a tier without dynamic lights lights the nearest actor (the player) in the dark
const flashlightColor = new Float32Array(3);
const flashlightAim = Vec.make();
const Flashlights = { ids: new Int32Array(MAX_DYNAMIC_LIGHTS), distances: new Float32Array(MAX_DYNAMIC_LIGHTS), count: 0 };
writeColor(flashlightColor, 0, FLASHLIGHT_COLOR);

function carriesFlashlight(id) {
  return Actors.alive[id] && Actors.kind[id] !== ACTOR_KIND.NONE && !(Actors.flags[id] & ACTOR_FLAG.INVISIBLE);
}
// Inserts an actor into the short sorted list of the nearest ones, keeping at most `limit` (no allocation).
function keepNearest(id, distance, limit) {
  let at = Flashlights.count;
  while (at > 0 && Flashlights.distances[at - 1] > distance) at--;
  if (at >= limit) return;
  const last = Math.min(Flashlights.count, limit - 1);
  for (let i = last; i > at; i--) { Flashlights.ids[i] = Flashlights.ids[i - 1]; Flashlights.distances[i] = Flashlights.distances[i - 1]; }
  Flashlights.ids[at] = id; Flashlights.distances[at] = distance;
  Flashlights.count = Math.min(Flashlights.count + 1, limit);
}
function pickFlashlights(limit) {
  const camera = Render.frame.cameraPosition;
  Flashlights.count = 0;
  if (limit <= 0) return;
  for (let id = 0; id < Actors.count; id++) {
    if (!carriesFlashlight(id)) continue;
    const dx = Actors.x[id] - camera[0], dy = Actors.y[id] - camera[1], dz = Actors.z[id] - camera[2];
    keepNearest(id, dx * dx + dy * dy + dz * dz, limit);
  }
}
function writeFlashlight(frame, slot, id) {
  Vec.fromAngles(flashlightAim, Actors.yaw[id], Actors.pitch[id]);
  frame.lightPositions[slot * 4] = Actors.x[id] + flashlightAim.x * FLASHLIGHT_AHEAD;
  frame.lightPositions[slot * 4 + 1] = Actors.eyeY(id) + flashlightAim.y * FLASHLIGHT_AHEAD;
  frame.lightPositions[slot * 4 + 2] = Actors.z[id] + flashlightAim.z * FLASHLIGHT_AHEAD;
  frame.lightPositions[slot * 4 + 3] = FLASHLIGHT_RADIUS;
  for (let c = 0; c < 3; c++) frame.lightColors[slot * 4 + c] = flashlightColor[c] * LIGHT_BOOST;
}
function updateFlashlights() {
  if (!matchDarkness()) return;
  const frame = Render.frame;
  const cap = Math.max(FLASHLIGHT_MIN_LIGHTS, Math.min(Render.quality.lights, MAX_DYNAMIC_LIGHTS));
  pickFlashlights(cap - Math.min(frame.lightCount, FX_LIGHT_RESERVE));
  const start = Math.min(frame.lightCount, cap - Flashlights.count);
  for (let i = 0; i < Flashlights.count; i++) writeFlashlight(frame, start + i, Flashlights.ids[i]);
  frame.lightCount = start + Flashlights.count;
}
Render.addUpdate(55, updateFlashlights);   // after the effect lights are copied into the frame (50)

// ---- GPU ----
const CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
function createPoolGpu(gl, pool, cornerBuffer) {
  pool.vertexArray = gl.createVertexArray();
  gl.bindVertexArray(pool.vertexArray);
  bindAttributes(gl, cornerBuffer, [[PARTICLE_ATTRIBUTES.aCorner, 2, gl.FLOAT, false, 0]], 8, 0);
  pool.buffer = makeBuffer(gl, gl.ARRAY_BUFFER, pool.data, gl.DYNAMIC_DRAW);
  bindAttributes(gl, pool.buffer, [[PARTICLE_ATTRIBUTES.aOrigin, 3, gl.FLOAT, false, 0], [PARTICLE_ATTRIBUTES.aVelocity, 3, gl.FLOAT, false, 12],
    [PARTICLE_ATTRIBUTES.aTiming, 4, gl.FLOAT, false, 24], [PARTICLE_ATTRIBUTES.aColor, 4, gl.FLOAT, false, 40], [PARTICLE_ATTRIBUTES.aParams, 4, gl.FLOAT, false, 56]],
  PARTICLE_FLOATS * 4, 1);
  gl.bindVertexArray(null);
  pool.dirtyMin = pool.capacity; pool.dirtyMax = -1;
}
Render.addGpuPart('fx', (gl) => {
  const cornerBuffer = makeBuffer(gl, gl.ARRAY_BUFFER, CORNERS);
  createPoolGpu(gl, particlePool, cornerBuffer);
  createPoolGpu(gl, decalPool, cornerBuffer);
});

function uploadPool(gl, pool) {
  if (pool.dirtyMax < pool.dirtyMin) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, pool.buffer);
  const first = pool.dirtyMin * PARTICLE_FLOATS;
  gl.bufferSubData(gl.ARRAY_BUFFER, first * 4, pool.data, first, (pool.dirtyMax - pool.dirtyMin + 1) * PARTICLE_FLOATS);
  pool.dirtyMin = pool.capacity; pool.dirtyMax = -1;
}

const PARTICLE_VERTEX = `#version 300 es
precision highp float;
uniform mat4 uViewProjection;
uniform vec3 uCameraPosition;
uniform vec3 uCameraRight;
uniform vec3 uCameraUp;
uniform float uTime;
uniform float uFogDensity;
in vec2 aCorner;
in vec3 aOrigin;
in vec3 aVelocity;
in vec4 aTiming;
in vec4 aColor;
in vec4 aParams;
out vec2 vCorner;
out vec4 vColor;
out float vFog;
flat out int vMode;
void main() {
  float age = uTime - aTiming.x;
  if (age < 0.0 || age >= aTiming.y) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } // dead slot: clipped away
  float t = age / aTiming.y;
  float size = mix(aTiming.z, aTiming.w, t);
  int packed = int(aParams.z + 0.5);
  int mode = packed & 3;
  vec3 center, axisA, axisB;
  float fade = 1.0 - t;
  if (mode == 1) {
    center = aOrigin + aVelocity * 0.5;
    axisA = aVelocity * 0.5;
    axisB = normalize(cross(aVelocity, uCameraPosition - center)) * size;
  } else if (mode == 2) {
    vec3 normal = aVelocity;
    vec3 tangent = normalize(cross(normal, abs(normal.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
    vec3 bitangent = cross(normal, tangent);
    float c = cos(aParams.w), s = sin(aParams.w);
    center = aOrigin + normal * 0.01;
    axisA = (tangent * c + bitangent * s) * size;
    axisB = (bitangent * c - tangent * s) * size;
    fade = 1.0 - smoothstep(0.85, 1.0, t);
  } else if (mode == 3) { // a streak (a casing): a hard-edged quad stretched along the way it is moving, solid until the end of its life
    float drag = aParams.y;
    float fall = drag > 0.0 ? (1.0 - exp(-drag * age)) / drag : age;
    center = aOrigin + aVelocity * fall - vec3(0.0, 0.5 * aParams.x * age * age, 0.0);
    vec3 velocity = aVelocity * exp(-drag * age) - vec3(0.0, aParams.x * age, 0.0);
    vec3 along = normalize(velocity + vec3(0.0, 0.0001, 0.0));
    axisA = along * size;
    axisB = normalize(cross(along, uCameraPosition - center)) * size * 0.32;
    fade = 1.0 - smoothstep(0.8, 1.0, t);
  } else {
    float drag = aParams.y;
    vec3 travel = drag > 0.0 ? aVelocity * ((1.0 - exp(-drag * age)) / drag) : aVelocity * age;
    center = aOrigin + travel - vec3(0.0, 0.5 * aParams.x * age * age, 0.0);
    axisA = uCameraRight * size;
    axisB = uCameraUp * size;
    fade *= min(1.0, t * 12.0);
  }
  vCorner = aCorner;
  vMode = packed;
  vColor = vec4(aColor.rgb, aColor.a * fade);
  vec3 position = center + axisA * aCorner.x + axisB * aCorner.y;
  float fogDistance = length(position - uCameraPosition) * uFogDensity;
  vFog = 1.0 - exp2(-fogDistance * fogDistance); // the same curve as finishColor
  gl_Position = uViewProjection * vec4(position, 1.0);
}`;
const PARTICLE_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec3 uFogColor;
in vec2 vCorner;
in vec4 vColor;
in float vFog;
flat in int vMode;
out vec4 outColor;
void main() {
  int mode = vMode & 3;
  float shape = mode == 3 ? 1.0 : mode == 1 ? (1.0 - vCorner.y * vCorner.y) * (1.0 - vCorner.x * vCorner.x * 0.6)
    : 1.0 - smoothstep(mode == 2 ? 0.6 : 0.3, 1.0, length(vCorner));
  float alpha = vColor.a * clamp(shape, 0.0, 1.0);
  if (alpha < 0.004) discard;
  bool additive = vMode >= ${ADDITIVE_FLAG};
  vec3 color = additive ? vColor.rgb * (1.0 - vFog) : mix(vColor.rgb, uFogColor, vFog); // glows fade out in fog
  outColor = vec4(color * alpha, additive ? 0.0 : alpha);
}`;
Render.defineProgram('particles', PARTICLE_VERTEX, PARTICLE_FRAGMENT, PARTICLE_ATTRIBUTES);

function drawPool(gl, pool) {
  if (!pool.used) return;
  uploadPool(gl, pool);
  if (Render.frame.time >= pool.lastDeath) return; // every slot is dead: no instances to run
  const program = Render.programs.particles, u = program.uniforms, view = Render.view;
  gl.useProgram(program.handle);
  applyFrameUniforms(gl, program, Render.frame.viewProjection);
  gl.uniform3fv(u.uCameraRight, view.right);
  gl.uniform3fv(u.uCameraUp, view.up);
  gl.uniform1f(u.uTime, Render.frame.time);
  gl.bindVertexArray(pool.vertexArray);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, pool.used);
  Render.countDraw(pool.live * 2);
}

function drawEffects(gl) {
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false); gl.disable(gl.CULL_FACE);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -4);
  drawPool(gl, decalPool);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  drawPool(gl, particlePool);
  gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
}
Render.addPass(50, drawEffects);
