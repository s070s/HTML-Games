// Effects (PERF-010, REN-003 particle program): GPU particles, tracers and decals are instanced quads in fixed
// ring buffers. Motion is computed in the vertex shader from spawn data (origin, velocity, gravity, drag, birth time),
// so the CPU only writes a slot when something spawns. Caps come from the quality row (particles, decals, lights).

const PARTICLE_FLOATS = 18;              // origin xyz | velocity xyz | birth life size0 size1 | rgba | gravity drag mode seed
const PARTICLE_MODE = { billboard: 0, tracer: 1, decal: 2 };
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
const fxDirection = { x: 0, y: 0, z: 0 };
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

function writeParticle(pool, slot, x, y, z, vx, vy, vz, life, sizeStart, sizeEnd, alpha, gravity, drag, mode) {
  const d = pool.data, o = slot * PARTICLE_FLOATS, now = Render.frame.time;
  d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz;
  d[o + 6] = now; d[o + 7] = life; d[o + 8] = sizeStart; d[o + 9] = sizeEnd;
  d[o + 10] = fxColor[0]; d[o + 11] = fxColor[1]; d[o + 12] = fxColor[2]; d[o + 13] = alpha;
  d[o + 14] = gravity; d[o + 15] = drag; d[o + 16] = mode; d[o + 17] = Rng.fx.next() * Math.PI * 2;
  pool.deathTime[slot] = now + life;
  pool.lastDeath = Math.max(pool.lastDeath, now + life);   // past it every slot is dead: the draw is skipped
}

// Live slots of a pool on the effects clock (counted once per frame for the stats and the triangle counter).
function countLive(pool) {
  const now = Render.frame.time;
  let live = 0;
  for (let i = 0; i < pool.used; i++) if (pool.deathTime[i] > now) live++;
  return live;
}

// Random direction around a normal: spread 0 = the normal, 1 = almost any direction (a zero normal = any direction).
function randomDirection(nx, ny, nz, spread) {
  const random = Rng.fx;
  let x = nx + (random.next() * 2 - 1) * spread * 2, y = ny + (random.next() * 2 - 1) * spread * 2, z = nz + (random.next() * 2 - 1) * spread * 2;
  const length = length3(x, y, z) || 1;
  fxDirection.x = x / length; fxDirection.y = y / length; fxDirection.z = z / length;
  return fxDirection;
}

const Fx = {
  // kind: a CAT.fxKinds id; count <= 0 uses the kind's default; colorHex overrides the kind colour.
  burst(kind, x, y, z, nx, ny, nz, count, colorHex) {
    if (Game.headless) return;
    const row = fxKindRows[kind] || fxKindRows.spark, cap = Render.quality.particles;
    const total = Math.min(Math.ceil((count > 0 ? count : row.count) * Render.config.particleScale), cap);   // particleScale: ACC-005 intensity slider
    writeColor(fxColor, 0, colorHex === undefined || colorHex === null ? row.color : colorHex);
    const mode = PARTICLE_MODE.billboard + (row.additive ? ADDITIVE_FLAG : 0), random = Rng.fx;
    for (let i = 0; i < total; i++) {
      const direction = randomDirection(nx, ny, nz, row.spread), speed = random.range(row.speed[0], row.speed[1]);
      const life = random.range(row.life[0], row.life[1]), grow = random.range(0.8, 1.2);
      writeParticle(particlePool, takeSlot(particlePool, cap), x, y, z, direction.x * speed, direction.y * speed, direction.z * speed,
        life, row.size[0] * grow, row.size[1] * grow, row.alpha, row.gravity, row.drag, mode);
    }
  },
  tracer(ax, ay, az, bx, by, bz, colorHex) {
    if (Game.headless) return;
    writeColor(fxColor, 0, colorHex === undefined || colorHex === null ? TRACER_COLOR : colorHex);
    const slot = takeSlot(particlePool, Render.quality.particles);
    writeParticle(particlePool, slot, ax, ay, az, bx - ax, by - ay, bz - az, TRACER_SECONDS, TRACER_WIDTH, TRACER_WIDTH * 0.5, 1, 0, 0, PARTICLE_MODE.tracer + ADDITIVE_FLAG);
  },
  // kind: a CAT.decalKinds id (bullet, scorch, blood, energy, frost, paint). Potato keeps no decals (cap 0).
  decal(x, y, z, nx, ny, nz, kind) {
    const cap = Render.quality.decals;
    if (Game.headless || cap <= 0) return;
    const row = decalKindRows[kind] || decalKindRows.bullet, size = row.size * Rng.fx.range(0.8, 1.2);
    writeColor(fxColor, 0, row.color);
    const length = length3(nx, ny, nz) || 1;
    writeParticle(decalPool, takeSlot(decalPool, cap), x, y, z, nx / length, ny / length, nz / length, row.life, size, size, row.alpha, 0, 0,
      PARTICLE_MODE.decal + (row.additive ? ADDITIVE_FLAG : 0));
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
  },
  clear() {
    for (const pool of [particlePool, decalPool]) {
      pool.deathTime.fill(0); pool.data.fill(0);
      pool.next = 0; pool.used = 0; pool.live = 0; pool.lastDeath = 0; pool.dirtyMin = 0; pool.dirtyMax = pool.capacity - 1;
    }
    fxLights.endTime.fill(0);
  },
  liveParticles() { return countLive(particlePool); },
};
const fxLights = { position: new Float32Array(MAX_DYNAMIC_LIGHTS * 4), color: new Float32Array(MAX_DYNAMIC_LIGHTS * 3),
  startTime: new Float32Array(MAX_DYNAMIC_LIGHTS), endTime: new Float32Array(MAX_DYNAMIC_LIGHTS) };
Bus.on('match.stop', () => Fx.clear());

// Copies the active lights (fading out over their life) into the shared frame uniforms.
function updateLights() {
  const frame = Render.frame, cap = Math.min(Render.quality.lights, MAX_DYNAMIC_LIGHTS), now = frame.time;
  let count = 0;
  for (let i = 0; i < MAX_DYNAMIC_LIGHTS && count < cap; i++) {
    if (fxLights.endTime[i] <= now) continue;
    const fade = (fxLights.endTime[i] - now) / (fxLights.endTime[i] - fxLights.startTime[i]) * LIGHT_BOOST;
    for (let c = 0; c < 4; c++) frame.lightPositions[count * 4 + c] = fxLights.position[i * 4 + c];
    for (let c = 0; c < 3; c++) frame.lightColors[count * 4 + c] = fxLights.color[i * 3 + c] * fade;
    count++;
  }
  frame.lightCount = count;
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
  float shape = mode == 1 ? (1.0 - vCorner.y * vCorner.y) * (1.0 - vCorner.x * vCorner.x * 0.6)
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
