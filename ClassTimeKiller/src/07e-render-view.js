// Camera (REN-006 interpolation, FOV, head bob), frustum culling, the view-model pass (own FOV after a depth clear,
// so the weapon never clips into walls) and quality control: dynamic resolution (PERF-007), the first-run
// benchmark (PERF-008) and the automatic quality step-down (PERF-013).

const VIEW_NEAR = 0.05;
const VIEW_FAR_MARGIN = 1.15;            // far plane just behind the fog's full distance
const VIEWMODEL_NEAR = 0.01;
const VIEWMODEL_FAR = 8;
const EYE_SMOOTHING = 14;                // 1/s: crouch eye height eases instead of snapping
const HEAD_BOB_METERS = 0.035;
const BOB_STRIDE_METERS = 1.9;
const RUN_REFERENCE_SPEED = 7;
const ADS_ZOOM_DEFAULT = 1.15;           // FOV divisor at full aim unless Render.viewModel sets `zoom`
const VIEWMODEL_DARK = '#2b2f35';
const VIEWMODEL_SCALE = 0.62;            // shrinks the parts table around the weapon pivot (sets the on-screen size)
const HAND_RIGHT = 1, HAND_LEFT = -1;     // view-model side: the left hand mirrors the right one

const ViewState = {
  forward: new Float32Array(3), right: new Float32Array(3), up: new Float32Array(3),
  skyRight: new Float32Array(3), skyUp: new Float32Array(3),
  frustum: new Float32Array(24), overridden: false, eye: 1.62, bobPhase: 0,
  roll: Mat4.create(), rolledView: Mat4.create(), viewmodelProjection: Mat4.create(), viewmodelViewProjection: Mat4.create(),
};
Render.view = ViewState;
const viewModelState = { visible: false, shape: 'rifle', kick: 0, reload: 0, swap: 0, ads: 0, color: '#4a5058', zoom: ADS_ZOOM_DEFAULT,
  recoilPitch: 0, recoilYaw: 0, dual: false };

// video.fov is the horizontal FOV at 16:9 (Hor+): the vertical angle stays fixed, wider screens see more.
function verticalFov(horizontalDegrees) {
  return 2 * Math.atan(Math.tan(horizontalDegrees * DEG / 2) / (16 / 9));
}

function readViewModel() {
  const state = viewModelState;
  state.visible = false; state.shape = 'rifle'; state.kick = 0; state.reload = 0; state.swap = 0; state.ads = 0;
  state.color = '#4a5058'; state.zoom = ADS_ZOOM_DEFAULT; state.recoilPitch = 0; state.recoilYaw = 0; state.dual = false;
  if (!Render.viewModel || Game.playerId < 0 || ViewState.overridden || !Actors.alive[Game.playerId]) return;
  Render.viewModel(state);
}

// Places the camera at the local player's interpolated eye; aim angles are the freshest input (lowest latency).
// The weapon's recoil punch (degrees, positive pitch = up) kicks the view the same way it moves the shots.
function followPlayer(seconds, alpha) {
  const camera = Render.camera, id = Game.playerId;
  if (id < 0 || Actors.kind[id] === ACTOR_KIND.NONE) return;
  ViewState.eye += (Actors.eye[id] - ViewState.eye) * Math.min(1, seconds * EYE_SMOOTHING);
  camera.x = lerp(Actors.prevX[id], Actors.x[id], alpha);
  camera.y = lerp(Actors.prevY[id], Actors.y[id], alpha) + ViewState.eye + headBob(id, seconds);
  camera.z = lerp(Actors.prevZ[id], Actors.z[id], alpha);
  camera.yaw = Actors.aimYaw[id] + viewModelState.recoilYaw * DEG;
  camera.pitch = clamp(Actors.aimPitch[id] + viewModelState.recoilPitch * DEG, -MAX_LOOK_PITCH, MAX_LOOK_PITCH);
  camera.roll = 0;
  const ads = clamp(viewModelState.ads, 0, 1);
  camera.fov = Render.config.fov / lerp(1, Math.max(1, viewModelState.zoom), ads);
}

function headBob(id, seconds) {
  const speed = Math.hypot(Actors.vx[id], Actors.vz[id]);
  const grounded = (Actors.flags[id] & ACTOR_FLAG.ON_GROUND) !== 0;
  ViewState.bobPhase = (ViewState.bobPhase + (grounded ? speed : 0) * seconds * (Math.PI * 2 / BOB_STRIDE_METERS)) % (Math.PI * 2);
  if (!Render.config.headBob || !grounded) return 0;
  return Math.sin(ViewState.bobPhase * 2) * HEAD_BOB_METERS * (Render.config.headBob / 100) * Render.motion.bob * Math.min(1, speed / RUN_REFERENCE_SPEED);
}

function updateCamera(seconds, alpha) {
  const camera = Render.camera;
  camera.fov = Render.config.fov;
  ViewState.overridden = !!Render.cameraOverride && Render.cameraOverride(camera) === true;
  readViewModel();
  if (!ViewState.overridden) {
    followPlayer(seconds, alpha);
    if (Render.viewEffect) Render.viewEffect(camera, seconds);
  }
  computeMatrices(camera);
}
Render.addUpdate(0, updateCamera);

function computeMatrices(camera) {
  const frame = Render.frame, size = Render.size, view = ViewState;
  const aspect = size.width / size.height, fovY = verticalFov(camera.fov);
  Mat4.perspective(frame.projection, fovY, aspect, VIEW_NEAR, Render.quality.viewDistance * VIEW_FAR_MARGIN);
  Mat4.firstPerson(frame.view, camera.x, camera.y, camera.z, camera.yaw, camera.pitch);
  const forward = view.forward, right = view.right, up = view.up;
  forward[0] = Math.sin(camera.yaw) * Math.cos(camera.pitch); forward[1] = Math.sin(camera.pitch); forward[2] = Math.cos(camera.yaw) * Math.cos(camera.pitch);
  right[0] = -Math.cos(camera.yaw); right[1] = 0; right[2] = Math.sin(camera.yaw);
  up[0] = right[1] * forward[2] - right[2] * forward[1]; up[1] = right[2] * forward[0] - right[0] * forward[2]; up[2] = right[0] * forward[1] - right[1] * forward[0];
  if (camera.roll) applyRoll(frame, camera.roll);
  Mat4.multiply(frame.viewProjection, frame.projection, frame.view);
  frame.cameraPosition[0] = camera.x; frame.cameraPosition[1] = camera.y; frame.cameraPosition[2] = camera.z;
  const tanY = Math.tan(fovY / 2), tanX = tanY * aspect;
  for (let i = 0; i < 3; i++) { view.skyRight[i] = right[i] * tanX; view.skyUp[i] = up[i] * tanY; }
  extractFrustum(frame.viewProjection, view.frustum);
}

// Roll about the view axis (killcam tilt, hit flinch): rotates the view matrix and the right/up basis together.
function applyRoll(frame, roll) {
  const c = Math.cos(roll), s = Math.sin(roll), view = ViewState, matrix = view.roll;
  Mat4.identity(matrix);
  matrix[0] = c; matrix[1] = s; matrix[4] = -s; matrix[5] = c;
  Mat4.multiply(view.rolledView, matrix, frame.view);
  frame.view.set(view.rolledView);
  for (let i = 0; i < 3; i++) {
    const r = view.right[i], u = view.up[i];
    view.right[i] = c * r - s * u; view.up[i] = s * r + c * u;
  }
}

// Six planes (a, b, c, d) from a column-major view-projection matrix; inside = a x + b y + c z + d >= 0.
function extractFrustum(m, out) {
  for (let plane = 0; plane < 6; plane++) {
    const row = plane >> 1, sign = plane & 1 ? -1 : 1;
    for (let column = 0; column < 4; column++) out[plane * 4 + column] = m[column * 4 + 3] + sign * m[column * 4 + row];
  }
}

// Frustum test for an axis-aligned box (the corner furthest along each plane normal must be inside).
function boxVisible(minX, minY, minZ, maxX, maxY, maxZ) {
  const f = ViewState.frustum;
  for (let i = 0; i < 24; i += 4) {
    const x = f[i] > 0 ? maxX : minX, y = f[i + 1] > 0 ? maxY : minY, z = f[i + 2] > 0 ? maxZ : minZ;
    if (f[i] * x + f[i + 1] * y + f[i + 2] * z + f[i + 3] < 0) return false;
  }
  return true;
}

// ---- View model: one generic builder reads the parts row of the weapon class (CAT.viewModels) ----
const viewModelBatch = makeShapeBatch('viewmodel', 24);
const viewModelRows = {};
CAT.viewModels.forEach((row) => { viewModelRows[row.id] = row; });
const weaponPose = { x: 0, y: 0, z: 0, pitch: 0 };
const viewLocal = { x: 0, y: 0, z: 0 };
const viewWorld = { x: 0, y: 0, z: 0 };
const viewTint = new Float32Array(3);

// Weapon pivot in view space (x right, y up, z forward) after ADS, kick, reload, swap and walk sway.
function poseWeapon(row, state) {
  const ads = clamp(state.ads, 0, 1), kick = clamp(state.kick, 0, 1) * row.kick;
  const reload = Math.sin(clamp(state.reload, 0, 1) * Math.PI), swap = clamp(state.swap, 0, 1);
  const sway = (1 - ads * 0.8) * Render.motion.bob, phase = ViewState.bobPhase, offset = Render.config.viewmodelOffset;
  weaponPose.x = lerp(row.hold[0], row.ads[0], ads) + Math.sin(phase) * 0.006 * sway - offset[0] * (1 - ads);
  weaponPose.y = lerp(row.hold[1], row.ads[1], ads) + kick * 0.012 - reload * 0.1 - swap * 0.25 + Math.abs(Math.cos(phase)) * 0.005 * sway + offset[1] * (1 - ads);
  weaponPose.z = lerp(row.hold[2], row.ads[2], ads) - kick * 0.05 + offset[2] * (1 - ads);
  weaponPose.pitch = kick * 6 * DEG - reload * 0.5 - swap * 0.6;
  return weaponPose;
}

function viewPartColor(part, row, state) {
  const tint = part.tint === 'body' ? state.color : part.tint === 'accent' ? row.accent : part.tint === 'glow' ? row.glow : VIEWMODEL_DARK;
  writeColor(viewTint, 0, tint);
  return part.tint === 'glow' ? 1 : 0;
}

function fillViewModel() {
  viewModelBatch.clear();
  const state = viewModelState;
  if (!state.visible) return;
  const row = viewModelRows[state.shape] || viewModelRows.rifle, pose = poseWeapon(row, state);
  addWeaponParts(row, pose, state, HAND_RIGHT);
  if (state.dual) addWeaponParts(row, pose, state, HAND_LEFT);   // W04 second pistol
}

function addWeaponParts(row, pose, state, hand) {
  const camera = Render.camera;
  for (let i = 0; i < row.parts.length; i++) {
    const part = row.parts[i];
    // View x is "right"; actor/shape local +X is left (DATA-002), hence the sign flips.
    rotateYawPitchInto(viewLocal, -part.at[0] * VIEWMODEL_SCALE * hand, part.at[1] * VIEWMODEL_SCALE, part.at[2] * VIEWMODEL_SCALE, 0, pose.pitch);
    rotateYawPitchInto(viewWorld, viewLocal.x - pose.x * hand, viewLocal.y + pose.y, viewLocal.z + pose.z, camera.yaw, camera.pitch);
    const emissive = viewPartColor(part, row, state);
    const pitch = camera.pitch + pose.pitch + (part.axis === 'z' ? -Math.PI / 2 : 0);
    viewModelBatch.mesh(part.shape, camera.x + viewWorld.x, camera.y + viewWorld.y, camera.z + viewWorld.z, camera.yaw, pitch,
      part.size[0] * VIEWMODEL_SCALE, part.size[1] * VIEWMODEL_SCALE, part.size[2] * VIEWMODEL_SCALE, viewTint[0], viewTint[1], viewTint[2], emissive);
  }
}
Render.addUpdate(60, fillViewModel);

function drawViewModel(gl) {
  if (!viewModelState.visible) return;
  const view = ViewState, size = Render.size;
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  Mat4.perspective(view.viewmodelProjection, verticalFov(Render.config.viewmodelFov), size.width / size.height, VIEWMODEL_NEAR, VIEWMODEL_FAR);
  Mat4.multiply(view.viewmodelViewProjection, view.viewmodelProjection, Render.frame.view);
  uploadBatch(gl, viewModelBatch);
  useShapesProgram(gl, view.viewmodelViewProjection);
  drawBatch(gl, viewModelBatch, SHAPE_MODE.lit);
}
Render.addPass(70, drawViewModel);

// ---- Dynamic resolution (PERF-007) ----
const SCALE_STEP = 0.05;
const SCALE_LOWER_SECONDS = 0.5;
const SCALE_RAISE_SECONDS = 2;
const SCALE_RAISE_FRACTION = 0.8;
const SCALE_BACKOFF_WINDOW = 3;          // a drop this soon after a raise means the raise was too much
const SCALE_CEILING_WAIT_SECONDS = 30;   // first retry above such a scale; the wait doubles on every failed retry
const GPU_BUDGET_MS = 6;                 // PERF-003
const FRAME_BUDGET_MS = 1000 / 60;       // PERF-001 hard floor, used when no GPU timer exists
const FRAME_BUDGET_TOLERANCE = 1.08;     // a missed vsync shows up as > 8% over the interval
const FRAME_SMOOTHING_SECONDS = 0.1;     // time constant of the smoothed frame interval (the same response at 60, 90, 120 or 144 Hz)
const REFRESH_SAMPLE_FRAMES = 120;       // menu frames per display-interval measurement
const REFRESH_MIN_MS = 1000 / 240, REFRESH_MAX_MS = 1000 / 24;

// ---- Display interval (non-60 Hz screens): the menu is light, so its frames run at the display's own rate. A display
// slower than 60 Hz (50 Hz TVs, 30 Hz power-saving modes) can never show 60 fps: its own interval becomes the frame
// budget, so the scale and the preset are not lowered for frames no setting could make faster. ----
const DisplayRate = { samples: new Float32Array(REFRESH_SAMPLE_FRAMES), count: 0, intervalMs: 0 };

function measureDisplayRate(seconds) {
  if (Game.state !== 'menu' || Benchmark.active || Render.config.frameCapMs > 0 || !(seconds > 0)) return;   // capped frames show the cap
  const rate = DisplayRate;
  rate.samples[rate.count++] = seconds * 1000;
  if (rate.count < REFRESH_SAMPLE_FRAMES) return;
  rate.count = 0;
  rate.intervalMs = clamp(rate.samples.sort()[REFRESH_SAMPLE_FRAMES >> 1], REFRESH_MIN_MS, REFRESH_MAX_MS);
}

// The frame interval that still counts as on time: the 60 fps floor (PERF-001), or the display's own slower interval,
// or the frame cap's slower interval (the 30 fps battery saver).
function slowFrameMs() { return Math.max(FRAME_BUDGET_MS, DisplayRate.intervalMs, Render.config.frameCapMs) * FRAME_BUDGET_TOLERANCE; }

// Controller state. `ceiling` = the highest scale known to hold the budget for this preset and screen size.
function makeScaleControl() {
  return { overSeconds: 0, underSeconds: 0, sinceRaise: 1e9, smoothedMs: FRAME_BUDGET_MS, retrying: false,
    ceiling: 1, ceilingWait: SCALE_CEILING_WAIT_SECONDS, sinceCeiling: 0, quality: null, width: 0, height: 0 };
}
const ScaleControl = makeScaleControl();

// A new preset or screen size changes the cost of every pixel: forget the learned ceiling.
function resetScaleCeiling(control) {
  control.ceiling = 1; control.ceilingWait = SCALE_CEILING_WAIT_SECONDS; control.sinceCeiling = 0; control.retrying = false;
}

const roundScale = (scale) => Math.round(scale * 100) / 100;

// One controller step: returns the new scale. Over budget for 0.5 s lowers one step; under the raise limit for
// 2 s raises one step (hysteresis), but never above the ceiling until its wait has passed.
function stepRenderScale(control, measuredMs, budgetMs, raiseBelowMs, seconds, scale, low, high) {
  control.sinceRaise += seconds;
  control.sinceCeiling += seconds;
  const over = measuredMs > budgetMs;
  control.overSeconds = over ? control.overSeconds + seconds : 0;
  control.underSeconds = !over && measuredMs <= raiseBelowMs ? control.underSeconds + seconds : 0;
  if (control.overSeconds >= SCALE_LOWER_SECONDS) return lowerScale(control, scale, low);
  const ceilingOpen = scale + 1e-4 < control.ceiling || control.sinceCeiling >= control.ceilingWait;
  if (control.underSeconds >= SCALE_RAISE_SECONDS && scale < high && ceilingOpen) return raiseScale(control, scale, high);
  return clamp(scale, low, high);
}

// Without a GPU timer a frame that holds vsync shows no headroom, so the only sign of a raise that was too much
// is a drop right after it: that scale becomes the ceiling, retried after a wait that doubles on each failure
// (no cap), so a GPU-bound phone settles instead of stuttering in a raise/drop loop.
function lowerScale(control, scale, low) {
  control.overSeconds = 0;
  const lowered = Math.max(low, roundScale(scale - SCALE_STEP));
  if (control.sinceRaise < SCALE_BACKOFF_WINDOW) {
    if (control.retrying) control.ceilingWait *= 2;
    control.ceiling = lowered;
    control.sinceCeiling = 0;
  }
  control.retrying = false;
  return lowered;
}

function raiseScale(control, scale, high) {
  const raised = Math.min(high, roundScale(scale + SCALE_STEP));
  control.underSeconds = 0;
  control.sinceRaise = 0;
  control.retrying = raised > control.ceiling + 1e-4;
  if (control.retrying) { control.ceiling = raised; control.sinceCeiling = 0; }
  return raised;
}

function updateRenderScale(seconds) {
  const control = ScaleControl, size = Render.size, quality = Render.quality, config = Render.config;
  measureDisplayRate(seconds);
  const blend = 1 - Math.exp(-seconds / FRAME_SMOOTHING_SECONDS);
  control.smoothedMs = lerp(control.smoothedMs, seconds * 1000 || FRAME_BUDGET_MS, blend); // seconds = frame interval
  if (control.quality !== quality || control.width !== size.width || control.height !== size.height) {
    resetScaleCeiling(control);
    control.quality = quality; control.width = size.width; control.height = size.height;
  }
  let scale = size.scale;
  const low = quality.renderScaleMin, high = quality.renderScaleMax;
  if (Benchmark.active) scale = 1;
  else if (config.renderScale !== 'auto') scale = config.renderScale;
  else if (GpuTimer.extension) scale = stepRenderScale(control, GpuTimer.lastMs, GPU_BUDGET_MS, GPU_BUDGET_MS * SCALE_RAISE_FRACTION, seconds, scale, low, high);
  else scale = stepRenderScale(control, control.smoothedMs, slowFrameMs(), slowFrameMs(), seconds, scale, low, high);
  if (Math.abs(scale - size.scale) < 1e-4) return;
  size.scale = scale;
  size.dirty = true;
}
Render.addUpdate(2, updateRenderScale);

// ---- Automatic step-down (PERF-013): under 60 fps for 5 s while playing lowers one preset and toasts it ----
const STEP_DOWN_SECONDS = 5;
const StepDown = { slowSeconds: 0 };

function lowerQualityStep() {
  const index = CAT.quality.indexOf(Render.quality);
  if (index < 0 || index >= CAT.quality.length - 1) return false;
  const next = CAT.quality[index + 1];
  Settings.set(Settings.get('video.quality') === 'auto' ? 'video.autoQuality' : 'video.quality', next.id);
  toastText('Quality lowered to ' + next.name + ' to keep the game smooth');
  return true;
}

// With automatic render scale the cheaper fix (lower resolution) is used up before a whole preset drops, but only
// while it can still help: when the GPU timer shows the GPU within budget the device is CPU-bound.
function scaleHeadroomLeft() {
  if (Render.config.renderScale !== 'auto' || Render.size.scale <= Render.quality.renderScaleMin + 1e-4) return false;
  return !GpuTimer.extension || GpuTimer.lastMs > GPU_BUDGET_MS;
}

function updateStepDown(seconds) {
  if (!Game.isRunning() || !Render.config.autoLower || ScaleControl.smoothedMs <= slowFrameMs() || scaleHeadroomLeft()) { StepDown.slowSeconds = 0; return; }
  StepDown.slowSeconds += seconds;
  if (StepDown.slowSeconds < STEP_DOWN_SECONDS) return;
  StepDown.slowSeconds = 0;
  lowerQualityStep();
}
Render.addUpdate(3, updateStepDown);

// ---- First-run benchmark (PERF-008): 3 s of a fixed stress scene in the menu picks video.autoQuality ----
const BENCHMARK_SECONDS = 3;
const BENCHMARK_WARMUP_SECONDS = 0.5;
const BENCHMARK_GRID = 22;               // shapes per side of the stress field
const BENCHMARK_BURST_SECONDS = 0.1;
// Median milliseconds per stress frame (CPU submit + GPU finish) at full scale -> preset; slower = potato.
const BENCHMARK_LIMITS = [['ultra', 3], ['high', 5], ['medium', 8], ['low', 13]];
const Benchmark = { active: false, done: false, elapsed: 0, sinceBurst: 0, samples: new Float32Array(1024), count: 0, result: '', pixel: new Uint8Array(4) };

function pickBenchmarkQuality(medianMs) {
  for (const [id, limit] of BENCHMARK_LIMITS) if (medianMs <= limit) return id;
  return 'potato';
}

function benchmarkMedian() {
  const view = Benchmark.samples.subarray(0, Benchmark.count).sort();
  return view.length ? view[Math.floor(view.length / 2)] : Infinity;
}

function finishBenchmark() {
  Benchmark.active = false;
  Benchmark.done = true;
  Benchmark.result = pickBenchmarkQuality(benchmarkMedian());
  Settings.set('video.autoQuality', Benchmark.result);
  toastText('Graphics quality set to ' + CAT.quality.byId(Benchmark.result).name);
}

function updateBenchmark(seconds) {
  if (!Benchmark.active) {
    if (Benchmark.done || Render.config.autoQuality || Game.state !== 'menu' || Game.headless) return;
    Object.assign(Benchmark, { active: true, elapsed: 0, sinceBurst: 0, count: 0 });
  }
  if (Game.state !== 'menu') { Benchmark.active = false; Benchmark.done = true; return; } // a match started: retry next launch
  Benchmark.elapsed += seconds;
  Benchmark.sinceBurst += seconds;
  const camera = Render.camera;
  camera.x = 0; camera.y = 3; camera.z = -2; camera.yaw = Benchmark.elapsed * 0.3; camera.pitch = -0.25; camera.roll = 0;
  if (Benchmark.sinceBurst >= BENCHMARK_BURST_SECONDS) { Benchmark.sinceBurst = 0; Fx.burst('explosion', Math.sin(Benchmark.elapsed) * 6, 1, 8, 0, 1, 0, 0); }
  if (Benchmark.elapsed >= BENCHMARK_SECONDS) finishBenchmark();
}
Render.addUpdate(-1, updateBenchmark);

Render.addSource('benchmark', (batch) => {
  if (!Benchmark.active) return;
  const half = BENCHMARK_GRID / 2, time = Benchmark.elapsed;
  for (let i = 0; i < BENCHMARK_GRID * BENCHMARK_GRID; i++) {
    const gx = (i % BENCHMARK_GRID) - half, gz = Math.floor(i / BENCHMARK_GRID) - half, shape = SHAPES[i % 7];
    batch.mesh(shape, gx * 2, 0.6 + Math.sin(time * 2 + i) * 0.3, gz * 2, time + i, 0, 1, 1, 1, 0.4 + (i % 5) * 0.12, 0.5, 0.9 - (i % 3) * 0.2, 0);
  }
});

// Sync point after the frame: reading one pixel waits for the GPU, so the sample is the true frame cost.
Render.addFinish((gl) => {
  if (!Benchmark.active || Benchmark.elapsed < BENCHMARK_WARMUP_SECONDS || Benchmark.count >= Benchmark.samples.length) return;
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, Benchmark.pixel);
  Benchmark.samples[Benchmark.count++] = performance.now() - Render.frameStart;
});
