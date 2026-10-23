// ==== S07 RENDERER ====
// WebGL2 forward renderer (REN-001..008). This file: context, shader programs, render targets, the frame pipeline,
// post pass, GPU timer, context loss (PLT-005) and the video settings. Add-on files: 07b static world + sky,
// 07c instanced shapes + actors, 07d effects (Fx), 07e camera, view model and quality control, 07f HUD batch.
// When Game.headless is set at boot or WebGL2 is missing nothing is created; every hook stays a cheap no-op.

const MAX_PROGRAMS = 8;                 // REN-003 / PERF-005
const MAX_DYNAMIC_LIGHTS = 8;           // REN-004 hard cap (the quality row's `lights` is the active cap)
const SHADOW_TEXTURE_UNIT = 1;          // the sun shadow map's texture unit (nothing else binds unit 1)
const LIGHT_SCALE = 2;                  // baked light is stored as light / LIGHT_SCALE in 8-bit vertex colours
const FOG_FULL_AT_VIEW = 2.375;         // exp2 fog factor reaches 98% at the view distance: sqrt(log2(50))
const TOUCH_DEVICE = window.matchMedia('(pointer: coarse)').matches;
const FOV_DEFAULT = TOUCH_DEVICE ? 80 : 90;
const RENDER_SCALE_OPTIONS = ['auto', 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const CONTEXT_OPTIONS = { alpha: false, antialias: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
const WEBGL_FATAL_TITLE = 'WebGL2 is required';
const WEBGL_FATAL_TEXT = 'ClassTimeKiller needs WebGL2. Turn on hardware acceleration in your browser settings '
  + '(Chrome / Edge: Settings > System > "Use graphics acceleration when available"; Firefox: Settings > Performance), '
  + 'restart the browser and reload this page. If it still fails, update your browser and graphics driver. '
  + 'iPhone / iPad: update iOS (16 or newer); with Lockdown Mode on, exclude this site in Settings > Privacy & Security > '
  + 'Lockdown Mode > Configure Web Browsing.';
// PLT-005: a lost context not back by then stays lost (GPU blocked, iOS memory pressure)
const CONTEXT_RESTORE_WAIT_MS = 5000;
const GRAPHICS_LOST_TITLE = 'The graphics stopped';
const GRAPHICS_LOST_TEXT = 'The graphics did not come back. Your progress is saved: reload the page.';

Settings.define('video.renderScale', 'auto', { label: 'Render scale', category: 'video', options: RENDER_SCALE_OPTIONS,
  optionLabels: ['Auto', '40%', '50%', '60%', '70%', '80%', '90%', '100%'] });
Settings.define('video.fov', FOV_DEFAULT, { label: 'Field of view', category: 'video', min: 60, max: 120, step: 1 });
Settings.define('video.viewmodelFov', 70, { label: 'Weapon field of view', category: 'video', min: 50, max: 100, step: 1 });
Settings.define('video.fxaa', true, { label: 'Smooth edges (FXAA)', category: 'video' });
Settings.define('video.outlines', true, { label: 'Character outlines', category: 'video' });
Settings.define('video.headBob', 0, { label: 'Head bob (%)', category: 'video', min: 0, max: 100, step: 5 });
Settings.define('video.maxDpr', 1.5, { label: 'Max pixel density', category: 'video', min: 1, max: 3, step: 0.25 });
Settings.define('video.autoLower', true, { label: 'Lower quality when slow', category: 'video' });

const Render = {
  // ---- Hooks used by later sections (docs/ARCHITECTURE.md, docs/api/render.md) ----
  sources: [],
  camera: { x: 0, y: 2, z: 0, yaw: 0, pitch: 0, roll: 0, fov: FOV_DEFAULT },
  cameraOverride: null,    // fn(camera) -> true when it placed the camera (spectate, killcam)
  viewModel: null,         // fn(out) fills { visible, shape, kick, reload, swap, ads, color, zoom }
  teamPalette: null,       // colour-blind team colours (array of 0xRRGGBB by team) instead of CAT.teamColors; null = the normal ones (18m)
  viewEffect: null,        // fn(camera, seconds) adds camera shake and FOV kick after the camera followed the player (18k)
  motion: { bob: 1, shake: 1, fovKick: 1 },   // 0..1 scales of view bob, shake and FOV kick: reduce motion and the sliders (ACC-005, 18k)
  actorStyle: null,        // fn(id, out) may change { r, g, b, emissive, scale, headScale, visible }; runs after the addActorStyle list
  actorStyles: [],         // fn(id, out) per section (powerups, abilities, mutators), run in load order
  addActorStyle(style) { this.actorStyles.push(style); },
  applyActorStyle(id, out) {
    for (let index = 0; index < this.actorStyles.length; index++) this.actorStyles[index](id, out);
    if (this.actorStyle) this.actorStyle(id, out);
  },
  worldQuery: null,        // S08 sets it to World: { brushes } (convex brushes with planes), read on 'world.load'
  addSource(name, draw) { this.sources.push({ name, draw }); },

  // ---- State ----
  gl: null,
  canvas: null,
  ready: false,
  lost: false,
  pausedForLoss: false,
  restoreTimer: 0,
  // The Reload screen for a lost context is up (a late restore hides it)
  gaveUp: false,
  // The wait for a restore before the Reload screen (a test shortens it)
  restoreWaitMs: CONTEXT_RESTORE_WAIT_MS,
  quality: null,           // the active CAT.quality row
  config: { renderScale: 'auto', fov: FOV_DEFAULT, viewmodelFov: 70, fxaa: true, outlines: true, headBob: 0, maxDpr: 1.5, autoLower: true, autoQuality: '',
    highContrast: false, particleScale: 1, viewmodelOffset: [0, 0, 0],   // these three are filled by the accessibility and view settings (18k, 18m)
    frameCapMs: 0 },   // the frame cap interval (0 = off), filled by S19 from video.frameCap
  stats: { drawCalls: 0, triangles: 0, renderMs: 0, gpuMs: 0, renderScale: 1, particles: 0, instances: 0, droppedInstances: 0 },
  size: { cssWidth: 1, cssHeight: 1, pixelRatio: 1, width: 1, height: 1, sceneWidth: 1, sceneHeight: 1, scale: 1, dirty: true },
  target: { framebuffer: null, texture: null, depth: null, msaaFramebuffer: null, msaaColor: null, msaaDepth: null, width: 0, height: 0, samples: 0, direct: true },
  programSpecs: [],
  programs: {},
  gpuParts: [],
  updates: [],
  prePasses: [],
  passes: [],
  finishers: [],
  frameStart: 0,
  maxSamples: 0,
  fullscreenVertexArray: null,
  // Per-frame values shared by every lit program (applyFrameUniforms).
  frame: {
    time: 0, view: Mat4.create(), projection: Mat4.create(), viewProjection: Mat4.create(),
    cameraPosition: new Float32Array(3), sunDirection: new Float32Array([0.4, 0.8, 0.4]), sunColor: new Float32Array([1, 0.95, 0.85]),
    ambientSky: new Float32Array([0.45, 0.5, 0.6]), ambientGround: new Float32Array([0.3, 0.28, 0.25]),
    fogColor: new Float32Array([0.7, 0.78, 0.85]), fogDensity: 0.015, lightCount: 0,
    lightPositions: new Float32Array(MAX_DYNAMIC_LIGHTS * 4), lightColors: new Float32Array(MAX_DYNAMIC_LIGHTS * 4),
    shadowMatrix: Mat4.create(), shadowOn: 0,
  },

  // A shader program by name; attributes = { name: location } bound before linking so vertex arrays never depend on the driver.
  defineProgram(name, vertex, fragment, attributes) {
    if (this.programSpecs.length >= MAX_PROGRAMS) throw new Error('REN-003: more than ' + MAX_PROGRAMS + ' shader programs');
    this.programSpecs.push({ name, vertex, fragment, attributes });
  },
  // create(gl) builds one module's GPU objects; it runs at init and again after a context restore (PLT-005).
  addGpuPart(name, create) { this.gpuParts.push({ name, create }); },
  // update(seconds, alpha) runs before drawing (camera, scale, lights); draw(gl) runs in order inside the scene target.
  addUpdate(order, update) { this.updates.push({ order, run: update }); this.updates.sort((a, b) => a.order - b.order); },
  addPass(order, draw) { this.passes.push({ order, run: draw }); this.passes.sort((a, b) => a.order - b.order); },
  // draw(gl) runs before the scene target is bound (instance uploads, the shadow map): a tile GPU binds and clears that
  // target once a frame, instead of loading it back after another target (R-154).
  addPrePass(draw) { this.prePasses.push(draw); },
  addFinish(finish) { this.finishers.push(finish); },   // finish(gl) runs after the canvas holds the frame
  countDraw(triangles) { this.stats.drawCalls++; this.stats.triangles += triangles; },

  init() {
    this.canvas = document.getElementById('view');
    const gl = this.canvas.getContext('webgl2', CONTEXT_OPTIONS);
    if (!gl) { showFatal(WEBGL_FATAL_TITLE, WEBGL_FATAL_TEXT, 'WebGL2 context creation failed.'); return false; }
    this.gl = gl;
    this.canvas.addEventListener('webglcontextlost', handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
    window.addEventListener('resize', () => { Render.size.dirty = true; });
    document.addEventListener('visibilitychange', armRestoreWait);
    try {
      createGpuResources(gl);
    } catch (error) {
      failGpuBuild('render.init', error);
      this.gl = null;
      return false;
    }
    this.ready = true;
    return true;
  },
  // Draws one complete frame now (the Loop 'render' hook calls it; tests and the demo call it directly).
  drawFrame(seconds, alpha) {
    const gl = this.gl;
    if (!gl || this.lost) return false;
    this.frameStart = performance.now();
    resetFrameStats();
    this.frame.time += seconds;
    // A resize first, so the camera's matrices already use the new aspect; the updates may change the scale or samples again.
    if (this.size.dirty) resizeTargets(gl);
    for (let i = 0; i < this.updates.length; i++) this.updates[i].run(seconds, alpha);
    if (this.size.dirty || this.target.samples !== this.wantedSamples()) resizeTargets(gl);
    GpuTimer.begin(gl);
    for (let i = 0; i < this.prePasses.length; i++) this.prePasses[i](gl);
    bindSceneTarget(gl);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (let i = 0; i < this.passes.length; i++) this.passes[i].run(gl);
    presentScene(gl);
    GpuTimer.end(gl);
    for (let i = 0; i < this.finishers.length; i++) this.finishers[i](gl);
    return true;
  },
  // MSAA samples the active preset asks for (REN-008), limited by the device.
  wantedSamples() { return this.gl ? Math.min(this.quality.msaa, this.maxSamples) : 0; },
};

// ---- Settings (read on every 'setting' event so the frame loop never calls Settings.get) ----
function readVideoSettings() {
  const config = Render.config;
  config.renderScale = Settings.get('video.renderScale');
  config.fov = Settings.get('video.fov');
  config.viewmodelFov = Settings.get('video.viewmodelFov');
  config.fxaa = Settings.get('video.fxaa');
  config.outlines = Settings.get('video.outlines');
  config.headBob = Settings.get('video.headBob');   // an old on/off save is turned into 0 or 100 on load (Settings.validValue)
  config.maxDpr = Settings.get('video.maxDpr');
  config.autoLower = Settings.get('video.autoLower');
  config.autoQuality = Settings.get('video.autoQuality');
  Render.quality = Quality.current();
  Render.size.dirty = true;
}
readVideoSettings();
Bus.on('setting', (key) => { if (key.startsWith('video.')) readVideoSettings(); });
Bus.on('quality.change', readVideoSettings);

// ---- Colour helpers: '#rrggbb' strings or 0xrrggbb numbers; strings are parsed once and cached ----
const colorCache = new Map();
function colorNumber(value) {
  if (typeof value === 'number') return value;
  let cached = colorCache.get(value);
  if (cached === undefined) {
    cached = typeof value === 'string' && value[0] === '#' ? parseInt(value.slice(1, 7), 16) || 0 : 0xffffff;
    colorCache.set(value, cached);
  }
  return cached;
}
// Writes the colour as three 0..1 floats into out[index..index+2].
function writeColor(out, index, value) {
  const number = colorNumber(value);
  out[index] = ((number >> 16) & 255) / 255;
  out[index + 1] = ((number >> 8) & 255) / 255;
  out[index + 2] = (number & 255) / 255;
}

// ---- Shared GLSL: rotation, lighting, tone curve and fog (one source for world, shapes and view model) ----
const GLSL_ROTATION = `
vec3 rotateYawPitch(vec3 v, float yaw, float pitch) {
  float cp = cos(pitch), sp = sin(pitch), cy = cos(yaw), sy = sin(yaw);
  vec3 r = vec3(v.x, v.y * cp + v.z * sp, -v.y * sp + v.z * cp);
  return vec3(r.x * cy + r.z * sy, r.y, -r.x * sy + r.z * cy);
}`;
const GLSL_LIGHTING = `
uniform vec3 uCameraPosition;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uAmbientSky;
uniform vec3 uAmbientGround;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform int uLightCount;
uniform vec4 uLightPositions[${MAX_DYNAMIC_LIGHTS}];
uniform vec4 uLightColors[${MAX_DYNAMIC_LIGHTS}];
uniform mat4 uShadowMatrix;
uniform float uShadowOn;
uniform highp sampler2DShadow uShadowMap;
// 0 = in the sun shadow of a moving object, 1 = lit (always 1 when the preset has no sun shadow map).
float sunShadow(vec3 position, vec3 normal) {
  if (uShadowOn < 0.5) return 1.0;
  vec3 coords = (uShadowMatrix * vec4(position + normal * 0.05, 1.0)).xyz * 0.5 + 0.5;
  if (any(lessThan(coords, vec3(0.0))) || any(greaterThan(coords, vec3(1.0)))) return 1.0;
  return texture(uShadowMap, vec3(coords.xy, coords.z - 0.0015));
}
vec3 dynamicLight(vec3 position, vec3 normal) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${MAX_DYNAMIC_LIGHTS}; i++) {
    if (i >= uLightCount) break;
    vec3 toLight = uLightPositions[i].xyz - position;
    float distance = length(toLight);
    float falloff = clamp(1.0 - distance / uLightPositions[i].w, 0.0, 1.0);
    float facing = max(dot(normal, toLight / max(distance, 0.001)), 0.0) * 0.8 + 0.2;
    sum += uLightColors[i].rgb * (falloff * falloff * facing);
  }
  return sum;
}
vec3 hemisphereLight(vec3 normal) { return mix(uAmbientGround, uAmbientSky, normal.y * 0.5 + 0.5); }
vec3 finishColor(vec3 color, vec3 position) {
  color = vec3(1.0) - exp(-color * 1.6);
  float distance = length(position - uCameraPosition) * uFogDensity;
  return mix(color, uFogColor, 1.0 - exp2(-distance * distance));
}`;
const GLSL_FULLSCREEN_VERTEX = `#version 300 es
out vec2 vClip;
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vClip = corner * 2.0 - 1.0;
  gl_Position = vec4(vClip, 1.0, 1.0);
}`;

// Sets the shared per-frame uniforms on a program that declares them (missing ones are skipped).
function applyFrameUniforms(gl, program, viewProjection) {
  const u = program.uniforms, frame = Render.frame;
  gl.uniformMatrix4fv(u.uViewProjection, false, viewProjection);
  if (u.uCameraPosition) gl.uniform3fv(u.uCameraPosition, frame.cameraPosition);
  if (u.uSunDirection) gl.uniform3fv(u.uSunDirection, frame.sunDirection);
  if (u.uSunColor) gl.uniform3fv(u.uSunColor, frame.sunColor);
  if (u.uAmbientSky) gl.uniform3fv(u.uAmbientSky, frame.ambientSky);
  if (u.uAmbientGround) gl.uniform3fv(u.uAmbientGround, frame.ambientGround);
  if (u.uFogColor) gl.uniform3fv(u.uFogColor, frame.fogColor);
  if (u.uFogDensity) gl.uniform1f(u.uFogDensity, frame.fogDensity);
  if (u.uShadowMap) gl.uniform1i(u.uShadowMap, SHADOW_TEXTURE_UNIT);
  if (u.uShadowOn) gl.uniform1f(u.uShadowOn, frame.shadowOn);
  if (u.uShadowMatrix) gl.uniformMatrix4fv(u.uShadowMatrix, false, frame.shadowMatrix);
  if (!u.uLightCount) return;
  gl.uniform1i(u.uLightCount, frame.lightCount);
  gl.uniform4fv(u.uLightPositions, frame.lightPositions);
  gl.uniform4fv(u.uLightColors, frame.lightColors);
}

// ---- Program compile / link ----
function compileShader(gl, type, source, name) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) || gl.isContextLost()) return shader;
  throw new Error('shader ' + name + ': ' + gl.getShaderInfoLog(shader));
}

function linkProgram(gl, spec) {
  const handle = gl.createProgram();
  gl.attachShader(handle, compileShader(gl, gl.VERTEX_SHADER, spec.vertex, spec.name + ' vertex'));
  gl.attachShader(handle, compileShader(gl, gl.FRAGMENT_SHADER, spec.fragment, spec.name + ' fragment'));
  for (const attribute in spec.attributes) gl.bindAttribLocation(handle, spec.attributes[attribute], attribute);
  gl.linkProgram(handle);
  if (!gl.getProgramParameter(handle, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('program ' + spec.name + ': ' + gl.getProgramInfoLog(handle));
  const uniforms = {};
  const count = gl.getProgramParameter(handle, gl.ACTIVE_UNIFORMS) || 0;
  for (let i = 0; i < count; i++) {
    const name = gl.getActiveUniform(handle, i).name.replace('[0]', '');
    uniforms[name] = gl.getUniformLocation(handle, name);
  }
  return { name: spec.name, handle, uniforms };
}

// ---- Buffer and vertex-array helpers shared by every module ----
function makeBuffer(gl, target, data, usage) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage || gl.STATIC_DRAW);
  return buffer;
}

// layout rows: [location, components, type, normalized, byteOffset]; divisor 1 = per instance.
function bindAttributes(gl, buffer, layout, stride, divisor) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (let i = 0; i < layout.length; i++) {
    const [location, components, type, normalized, offset] = layout[i];
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, components, type, normalized, stride, offset);
    gl.vertexAttribDivisor(location, divisor);
  }
}

function createGpuResources(gl) {
  // Handles from a lost context belong to no context any more: forget them instead of deleting them.
  Object.assign(Render.target, { framebuffer: null, texture: null, depth: null, msaaFramebuffer: null, msaaColor: null, msaaDepth: null, width: 0, samples: -1 });
  Render.programs = {};
  for (const spec of Render.programSpecs) Render.programs[spec.name] = linkProgram(gl, spec);
  Render.maxSamples = gl.getParameter(gl.MAX_SAMPLES) || 0;
  GpuTimer.create(gl);
  for (const part of Render.gpuParts) part.create(gl);
  Render.fullscreenVertexArray = gl.createVertexArray();
  resizeTargets(gl);
}

// ---- Canvas size, pixel-ratio cap and the scaled scene target ----
function resizeTargets(gl) {
  const size = Render.size;
  size.cssWidth = Math.max(1, Render.canvas.clientWidth || window.innerWidth);
  size.cssHeight = Math.max(1, Render.canvas.clientHeight || window.innerHeight);
  size.pixelRatio = Math.min(window.devicePixelRatio || 1, Render.config.maxDpr);
  size.width = Math.max(1, Math.round(size.cssWidth * size.pixelRatio));
  size.height = Math.max(1, Math.round(size.cssHeight * size.pixelRatio));
  if (Render.canvas.width !== size.width) Render.canvas.width = size.width;
  if (Render.canvas.height !== size.height) Render.canvas.height = size.height;
  size.sceneWidth = Math.max(1, Math.round(size.width * size.scale));
  size.sceneHeight = Math.max(1, Math.round(size.height * size.scale));
  size.dirty = false;
  const target = Render.target, samples = Render.wantedSamples();
  // Low/Potato at full scale draw straight into the canvas: no extra full-screen pass.
  const direct = !Render.quality.post && size.scale >= 0.999 && samples === 0;
  if (target.width === size.sceneWidth && target.height === size.sceneHeight && target.samples === samples && target.direct === direct) return;
  deleteSceneTargets(gl);
  target.width = size.sceneWidth; target.height = size.sceneHeight; target.samples = samples; target.direct = direct;
  if (direct) return;
  createSceneTargets(gl, target, samples);
}

function createSceneTargets(gl, target, samples) {
  target.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, target.texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, target.width, target.height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  target.depth = makeRenderbuffer(gl, 0, gl.DEPTH_COMPONENT24, target.width, target.height);
  target.framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, target.depth);
  if (samples > 0) {
    target.msaaColor = makeRenderbuffer(gl, samples, gl.RGBA8, target.width, target.height);
    target.msaaDepth = makeRenderbuffer(gl, samples, gl.DEPTH_COMPONENT24, target.width, target.height);
    target.msaaFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.msaaFramebuffer);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, target.msaaColor);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, target.msaaDepth);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function makeRenderbuffer(gl, samples, format, width, height) {
  const buffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
  if (samples > 0) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, format, width, height);
  else gl.renderbufferStorage(gl.RENDERBUFFER, format, width, height);
  return buffer;
}

function deleteSceneTargets(gl) {
  const target = Render.target;
  gl.deleteFramebuffer(target.framebuffer); gl.deleteFramebuffer(target.msaaFramebuffer);
  gl.deleteTexture(target.texture);
  gl.deleteRenderbuffer(target.depth); gl.deleteRenderbuffer(target.msaaColor); gl.deleteRenderbuffer(target.msaaDepth);
  target.framebuffer = target.msaaFramebuffer = target.texture = target.depth = target.msaaColor = target.msaaDepth = null;
}

function bindSceneTarget(gl) {
  const target = Render.target;
  if (target.direct) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, Render.size.width, Render.size.height);
    return;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.msaaFramebuffer || target.framebuffer);
  gl.viewport(0, 0, target.width, target.height);
}

// ---- Post pass: MSAA resolve, then upscale + vignette + optional FXAA into the canvas (REN-003) ----
const POST_FRAGMENT = `#version 300 es
precision mediump float;
uniform sampler2D uScene;
uniform vec2 uTexel;
uniform float uFxaa;
uniform float uVignette;
in vec2 vClip;
out vec4 outColor;
float luma(vec3 color) { return dot(color, vec3(0.299, 0.587, 0.114)); }
vec3 fxaa(vec2 uv) {
  vec3 center = texture(uScene, uv).rgb;
  vec3 a = texture(uScene, uv + vec2(-uTexel.x, -uTexel.y)).rgb;
  vec3 b = texture(uScene, uv + vec2(uTexel.x, -uTexel.y)).rgb;
  vec3 c = texture(uScene, uv + vec2(-uTexel.x, uTexel.y)).rgb;
  vec3 d = texture(uScene, uv + vec2(uTexel.x, uTexel.y)).rgb;
  float la = luma(a), lb = luma(b), lc = luma(c), ld = luma(d), lm = luma(center);
  float low = min(lm, min(min(la, lb), min(lc, ld))), high = max(lm, max(max(la, lb), max(lc, ld)));
  if (high - low < max(0.06, high * 0.15)) return center;
  vec2 direction = vec2(-((la + lb) - (lc + ld)), (la + lc) - (lb + ld));
  float reduce = max((la + lb + lc + ld) * 0.03125, 0.0078);
  direction = clamp(direction / (min(abs(direction.x), abs(direction.y)) + reduce), -8.0, 8.0) * uTexel;
  vec3 near = 0.5 * (texture(uScene, uv - direction * 0.1667).rgb + texture(uScene, uv + direction * 0.1667).rgb);
  vec3 far = near * 0.5 + 0.25 * (texture(uScene, uv - direction * 0.5).rgb + texture(uScene, uv + direction * 0.5).rgb);
  float farLuma = luma(far);
  return farLuma < low || farLuma > high ? near : far;
}
void main() {
  vec2 uv = vClip * 0.5 + 0.5;
  vec3 color = uFxaa > 0.5 ? fxaa(uv) : texture(uScene, uv).rgb;
  float edge = dot(vClip, vClip);
  color *= 1.0 - uVignette * edge * edge * 0.25;
  outColor = vec4(color, 1.0);
}`;
const VIGNETTE_STRENGTH = 0.9;
Render.defineProgram('post', GLSL_FULLSCREEN_VERTEX, POST_FRAGMENT, {});

function presentScene(gl) {
  const target = Render.target;
  if (target.direct) return;
  if (target.msaaFramebuffer) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.msaaFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.framebuffer);
    gl.blitFramebuffer(0, 0, target.width, target.height, 0, 0, target.width, target.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, Render.size.width, Render.size.height);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  const program = Render.programs.post, post = Render.quality.post;
  gl.useProgram(program.handle);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, target.texture);
  gl.uniform1i(program.uniforms.uScene, 0);
  gl.uniform2f(program.uniforms.uTexel, 1 / target.width, 1 / target.height);
  gl.uniform1f(program.uniforms.uFxaa, post && Render.config.fxaa ? 1 : 0);
  gl.uniform1f(program.uniforms.uVignette, post ? VIGNETTE_STRENGTH : 0);
  drawFullscreen(gl);
}

function drawFullscreen(gl) {
  gl.bindVertexArray(Render.fullscreenVertexArray);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  Render.countDraw(1);
}

// ---- GPU timer (PERF-007): EXT_disjoint_timer_query_webgl2 when present, results read a few frames later ----
const GPU_QUERY_COUNT = 4;
const GpuTimer = {
  extension: null,
  queries: [],
  pending: new Uint8Array(GPU_QUERY_COUNT),
  index: 0,
  active: false,
  lastMs: 0,
  fresh: false,            // true on frames where a new result arrived (read by the scale controller)
  create(gl) {
    this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.queries.length = 0;
    this.pending.fill(0);
    if (!this.extension) return;
    for (let i = 0; i < GPU_QUERY_COUNT; i++) this.queries.push(gl.createQuery());
  },
  begin(gl) {
    this.fresh = false;
    if (!this.extension) return;
    this.poll(gl);
    this.active = this.pending[this.index] === 0;
    if (this.active) gl.beginQuery(this.extension.TIME_ELAPSED_EXT, this.queries[this.index]);
  },
  end(gl) {
    if (!this.active) return;
    gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.pending[this.index] = 1;
    this.index = (this.index + 1) % GPU_QUERY_COUNT;
    this.active = false;
  },
  poll(gl) {
    const disjoint = gl.getParameter(this.extension.GPU_DISJOINT_EXT);
    for (let i = 0; i < GPU_QUERY_COUNT; i++) {
      if (!this.pending[i] || !gl.getQueryParameter(this.queries[i], gl.QUERY_RESULT_AVAILABLE)) continue;
      this.pending[i] = 0;
      if (disjoint) continue;
      this.lastMs = gl.getQueryParameter(this.queries[i], gl.QUERY_RESULT) / 1e6;
      this.fresh = true;
    }
  },
};

// ---- Stats (Perf.counters feeds the perf HUD, PERF-012 / ARC-040) ----
function resetFrameStats() {
  const stats = Render.stats;
  stats.drawCalls = 0; stats.triangles = 0; stats.instances = 0; stats.droppedInstances = 0;
}

function publishStats() {
  const stats = Render.stats, counters = Perf.counters;
  stats.gpuMs = GpuTimer.lastMs;
  stats.renderScale = Render.size.scale;
  counters.drawCalls = stats.drawCalls;
  counters.triangles = stats.triangles;
  counters.renderMs = stats.renderMs;
  counters.gpuMs = stats.gpuMs;
  counters.renderScale = stats.renderScale;
  counters.particles = stats.particles;
}

function renderFrameHook(seconds, alpha) {
  // A match started during the loss waits for the restore (no blind play)
  if (Render.lost && Game.isRunning()) pauseForLoss();
  if (!Render.ready || Render.lost || Game.headless) return;
  const started = performance.now();
  Render.drawFrame(seconds, alpha);
  Render.stats.renderMs = performance.now() - started;
  publishStats();
}

// ---- Context loss (PLT-005): pause, tell the player, rebuild everything on restore; no restore in time -> Reload ----

function handleContextLost(event) {
  event.preventDefault();
  Render.lost = true;
  pauseForLoss();
  emitToast('Graphics restoring...');
  armRestoreWait();
}

// The wait for the restore counts visible time only: phones drop a background tab's context and give it back on return.
function armRestoreWait() {
  clearTimeout(Render.restoreTimer);
  if (Render.lost && !document.hidden) Render.restoreTimer = setTimeout(giveUpRestore, Render.restoreWaitMs);
}

// Only a running match is paused for the loss, so only that pause is lifted on restore.
function pauseForLoss() {
  Render.pausedForLoss = Game.state === 'playing' && !Game.paused;
  Game.pause('graphics');
}

// A frozen, paused screen has no way out: write the save and show the PLT-002 screen with a Reload button.
function giveUpRestore() {
  if (!Render.lost) return;
  // A restore after this screen must not resume a match nobody can see.
  Render.pausedForLoss = false;
  if (Save.data) Save.saveNow();
  Render.gaveUp = true;
  showFatal(GRAPHICS_LOST_TITLE, GRAPHICS_LOST_TEXT, '');
  if (document.getElementById('fatal-reload')) return;
  const button = makeElement('button', 'ui-button primary', 'Reload');
  button.id = 'fatal-reload';
  button.addEventListener('click', () => location.reload());
  document.querySelector('#fatal .box').appendChild(button);
}

// A GPU build that threw (at start or on a restore) would leave a blank or frozen screen: the PLT-002 WebGL2 message instead.
function failGpuBuild(where, error) {
  ErrorLog.add(where, error);
  showFatal(WEBGL_FATAL_TITLE, WEBGL_FATAL_TEXT, String(error && error.message || error));
}

function handleContextRestored() {
  clearTimeout(Render.restoreTimer);
  try {
    createGpuResources(Render.gl);
  } catch (error) {
    Render.ready = false;
    failGpuBuild('render.restore', error);
    return;
  }
  Render.lost = false;
  if (Render.pausedForLoss && Game.pauseReason === 'graphics') Game.resume();
  Render.pausedForLoss = false;
  if (Render.gaveUp) hideGraphicsLost();
  emitToast('Graphics restored');
}

// A late restore takes the Reload screen away again; the match stays paused behind the pause menu.
function hideGraphicsLost() {
  Render.gaveUp = false;
  hideFatal();
}
Input.resumeBlocked = () => Render.lost;   // the pause menu's Resume waits for the restore (PLT-005)
// A quit during the loss: a later match's pause is the player's.
Bus.on('match.stop', () => { Render.pausedForLoss = false; });

Bus.on('boot', () => {
  if (Game.headless || !Render.init()) return;
  Loop.onFrame('render', renderFrameHook);
});
