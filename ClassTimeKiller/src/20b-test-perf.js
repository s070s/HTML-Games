// Performance scenes and the frame recorder behind tools/perf.mjs (plan phase 18, PERF-001..PERF-013, ARC-034), and the
// group 'perf' self-tests: budgets that hold headless without timing noise (pool caps, quality caps, allocation counters).
// __CTK.perf.scene(name, qualityId) starts a scripted worst case, __CTK.perf.record(seconds) resolves with the frame numbers
// of that many seconds of real frames, __CTK.perf.stop() ends the scene. Scenes: PERF_SCENES (docs/PERFORMANCE.md).

const PERF_RECORD_FRAMES = 240 * 120;     // two minutes at 240 fps: the recorder never grows while it runs
const PERF_KIT_SECONDS = 1;               // scene upkeep (meters, powerups, enemy refill, followed bot) once a second
const PERF_POWERUP_EVERY = 8;             // seconds between powerups for every bot (10.8 worst case: powerups always on)
const PERF_EDITOR_OBJECTS = 400;          // MAP-014 editor budget
const PERF_EDITOR_SPREAD = 2.5;           // metres between the editor scene's generated boxes
const PERF_GENERATED_SEED = 4242;         // a GN5 seed that is not the trusted Ring Isle seed (the generator runs in full)

// name: { mode, map (id or fn -> map), bots, kits, horde, editor, label } . bots = requested count (PERF worst cases go past the
// preset's bot cap on purpose: the scene starts at ultra and then switches to the measured preset).
const PERF_SCENES = {
  tdm: { label: '16-bot TDM, abilities + gadgets + powerups (10.8)', mode: 'tdm', map: 'harbor', bots: 16, kits: true },
  horde: { label: 'Horde at the PvE enemy cap', mode: 'horde', map: '', bots: 3, horde: true },
  royale: { label: 'Royale, 18 actors on Ring Isle', mode: 'royale', map: 'isle', bots: 18 },
  generated: { label: 'GN5 large generated island with bots', mode: 'royale', map: () => perfGeneratedMap(), bots: 16 },
  editor: { label: 'Map editor, 400 objects', editor: true },
};

const PerfScene = {
  name: '', row: null, follow: -1, kits: null, upkeep: 0, sincePowerup: 0, setupMs: 0, quality: '',
  handlers: null, toasts: 0,   // toasts since the scene started (a quality step-down toasts)
};
Bus.on('toast', () => { PerfScene.toasts++; });

// The sample arrays (about 1 MB) are made on the first recording: a player's device never pays for the tool.
const PerfRecorder = {
  active: false, skip: 0, count: 0, resolve: null, last: null, timer: 0, startTick: 0, startTime: 0, systemStart: {}, lastTick: 0, stepCount: 0,
  stepMs: null,   // sim ms per 120 Hz step in each frame (frames that ran no step are left out)
  frameMs: null, cpuMs: null, simMs: null, renderMs: null, hudMs: null, drawCalls: null, instances: null, triangles: null, scale: null,
};

function makeRecorderArrays(recorder) {
  if (recorder.frameMs) return;
  Object.assign(recorder, {
    stepMs: new Float32Array(PERF_RECORD_FRAMES), frameMs: new Float32Array(PERF_RECORD_FRAMES), cpuMs: new Float32Array(PERF_RECORD_FRAMES),
    simMs: new Float32Array(PERF_RECORD_FRAMES), renderMs: new Float32Array(PERF_RECORD_FRAMES), hudMs: new Float32Array(PERF_RECORD_FRAMES),
    drawCalls: new Uint16Array(PERF_RECORD_FRAMES), instances: new Uint16Array(PERF_RECORD_FRAMES), triangles: new Uint32Array(PERF_RECORD_FRAMES),
    scale: new Float32Array(PERF_RECORD_FRAMES),
  });
}

function perfGeneratedMap() {
  const started = performance.now();
  const map = MapGen.generate({ generator: 'GN5', seed: PERF_GENERATED_SEED, size: 'large', density: 'dense', mode: 'royale', uncapped: true });
  PerfScene.generateMs = performance.now() - started;
  return map;
}

function perfMapFor(row) {
  if (typeof row.map === 'function') return row.map();
  if (row.map) return row.map;
  const maps = Maps.savedForMode(row.mode);
  return maps.length ? maps[0].id : '';
}

// The match scenes: start at ultra (no bot cap below the requested count), then the measured preset.
function perfStartMatch(row, qualityId) {
  Settings.set('video.quality', 'ultra');
  Game.start({ mode: row.mode, map: perfMapFor(row), seed: 1, bots: Array.from({ length: row.bots }, () => ({})), modeOptions: { timeLimit: 0, scoreLimit: 0 } });
  Settings.set('video.quality', qualityId);
  if (row.kits) perfEquipKits();
  PerfScene.follow = -1;
  perfFollowBot();
}

function perfEquipKits() {
  const abilities = pressableAbilities(), gadgets = CAT.gadgets.filter((gadget) => BOT_GADGET_USE[gadget.effect]);
  const abilityKitList = abilityKits(abilities.slice(0, KIT_ROWS));
  const gadgetKitList = gadgetKits(gadgets.filter((gadget) => gadget.kind === 'thrown'), gadgets.filter((gadget) => gadget.kind !== 'thrown'));
  PerfScene.kits = abilityKitList.map((kit, index) => ({ abilities: kit.abilities, gadgets: gadgetKitList[index].gadgets }));
  for (let id = 0; id < Actors.count; id++) if (Actors.alive[id]) equipKit(id, PerfScene.kits);
  PerfScene.handlers = { 'actor.spawn': (event) => equipKit(event.id, PerfScene.kits) };
  Bus.on('actor.spawn', PerfScene.handlers['actor.spawn']);
}

// The camera (and the HUD) follow a living bot as if it were the player: the full view, view model and HUD are drawn.
function perfFollowBot() {
  if (PerfScene.follow >= 0 && Actors.alive[PerfScene.follow]) return;
  for (let id = 0; id < Actors.count; id++) {
    if (Actors.kind[id] !== ACTOR_KIND.BOT || !Actors.alive[id]) continue;
    PerfScene.follow = id;
    Game.playerId = id;
    return;
  }
}

function perfFillHorde() {
  const keys = CAT.enemies.filter((row) => !row.boss && !row.target && !row.beast && row.group === 1).map((row) => row.id);
  let room = Pve.cap() - Pve.aliveCount() - Pve.pending();
  for (let index = 0; room > 0; index++, room--) Pve.enqueue(keys[index % keys.length], NO_TEAM, 1, -1, 1);
}

function perfGivePowerups() {
  for (let id = 0; id < Actors.count; id++) {
    if (Actors.kind[id] !== ACTOR_KIND.BOT || !Actors.alive[id]) continue;
    Powerups.give(id, CAT.powerups[id % CAT.powerups.length], 0);
  }
}

function perfStartEditor() {
  Settings.set('video.quality', PerfScene.quality);
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  const materials = CAT.materials.map((row) => row.id);
  for (let index = 0; MapEditor.count() < PERF_EDITOR_OBJECTS; index++) {
    const x = (index % 20 - 10) * PERF_EDITOR_SPREAD, z = (Math.floor(index / 20) - 10) * PERF_EDITOR_SPREAD, height = 0.5 + (index % 4);
    MapEditor.add('brushes', { shape: 'box', min: [x, 0, z], max: [x + 1.5, height, z + 1.5], material: materials[index % materials.length] });
  }
  Ui.open('mapEditor');
  MapEditorTools.setHold('turnLeft', true);
}

// Scene upkeep once a second from the Loop 'input' phase (cheap: nothing runs between upkeeps).
function perfSceneFrame(seconds) {
  if (!PerfScene.row) return;
  PerfScene.upkeep += seconds;
  if (PerfScene.upkeep < PERF_KIT_SECONDS) return;
  PerfScene.upkeep = 0;
  if (PerfScene.row.editor) return;
  perfFollowBot();
  if (PerfScene.row.horde) perfFillHorde();
  if (!PerfScene.row.kits) return;
  fillMeters(0);
  PerfScene.sincePowerup += PERF_KIT_SECONDS;
  if (PerfScene.sincePowerup < PERF_POWERUP_EVERY) return;
  PerfScene.sincePowerup = 0;
  perfGivePowerups();
}

function perfStopScene() {
  if (PerfScene.handlers) for (const type in PerfScene.handlers) Bus.off(type, PerfScene.handlers[type]);
  if (PerfScene.row && PerfScene.row.editor) { MapEditorTools.setHold('turnLeft', false); Ui.closeAll(); MapEditorTools.detach(); }
  Object.assign(PerfScene, { name: '', row: null, follow: -1, kits: null, upkeep: 0, sincePowerup: 0, handlers: null });
  Game.stop();
}

// options: { autoLower } (default false: a CPU budget run keeps its preset; the quality reaction is measured on its own).
function perfStartScene(name, qualityId, options) {
  const row = PERF_SCENES[name];
  if (!row) throw new Error('unknown perf scene ' + name + ' (' + Object.keys(PERF_SCENES).join(', ') + ')');
  perfStopScene();
  Settings.set('video.autoLower', !!(options && options.autoLower));
  const started = performance.now();
  Object.assign(PerfScene, { name, row, quality: qualityId || 'low', generateMs: 0, toasts: 0 });
  if (row.editor) perfStartEditor();
  else perfStartMatch(row, PerfScene.quality);
  if (row.horde) perfFillHorde();
  PerfScene.setupMs = performance.now() - started;
  return perfSceneInfo();
}

function perfSceneInfo() {
  let bots = 0, enemies = 0, alive = 0;
  for (let id = 0; id < Actors.count; id++) {
    if (Actors.alive[id]) alive++;
    if (Actors.kind[id] === ACTOR_KIND.BOT) bots++;
    if (Actors.kind[id] === ACTOR_KIND.ENEMY) enemies++;
  }
  return { scene: PerfScene.name, label: PerfScene.row ? PerfScene.row.label : '', quality: Quality.current().id, actors: Actors.count, alive, bots, enemies,
    editorObjects: PerfScene.row && PerfScene.row.editor ? MapEditor.count() : 0, setupMs: PerfScene.setupMs, generateMs: PerfScene.generateMs || 0,
    map: Game.match && Game.match.map ? Game.match.map.id : '', renderScale: Render.size.scale, smoothedFrameMs: ScaleControl.smoothedMs,
    displayMs: DisplayRate.intervalMs, toasts: PerfScene.toasts };
}

// ---- Recorder: one sample per frame, read in the 'input' phase from the frame that just finished (Perf, Render.stats) ----
function perfRecordFrame() {
  const recorder = PerfRecorder;
  if (!recorder.active) return;
  if (recorder.skip > 0) { recorder.skip--; recorder.lastTick = Sim.tick; return; }   // the first frame after a start belongs to the frame before it
  const last = Perf.lastIndex(), slot = recorder.count, stats = Render.stats;
  recorder.frameMs[slot] = Perf.frameMs[last]; recorder.cpuMs[slot] = Perf.cpuMs[last]; recorder.simMs[slot] = Perf.simMs[last];
  recorder.renderMs[slot] = Perf.counters.renderMs; recorder.hudMs[slot] = Perf.counters.hudMs;
  recorder.drawCalls[slot] = Perf.counters.drawCalls; recorder.instances[slot] = stats.instances; recorder.triangles[slot] = Perf.counters.triangles;
  recorder.scale[slot] = Perf.counters.renderScale;
  const steps = Sim.tick - recorder.lastTick;
  recorder.lastTick = Sim.tick;
  if (steps > 0) recorder.stepMs[recorder.stepCount++] = Perf.simMs[last] / steps;
  recorder.count++;
  if (recorder.count >= PERF_RECORD_FRAMES) perfFinishRecording();
}

function perfFinishRecording() {
  const recorder = PerfRecorder;
  if (!recorder.active) return;
  recorder.active = false;
  clearTimeout(recorder.timer);
  recorder.last = perfReport();
  recorder.resolve(recorder.last);
}

function perfRecord(seconds) {
  const recorder = PerfRecorder;
  if (recorder.active) throw new Error('perf: a recording is already running');
  makeRecorderArrays(recorder);
  return new Promise((resolve) => {
    Object.assign(recorder, { active: true, skip: 1, count: 0, resolve, startTick: Sim.tick, lastTick: Sim.tick, stepCount: 0, startTime: performance.now(), systemStart: Object.assign({}, Sim.timingTotal) });
    recorder.timer = setTimeout(perfFinishRecording, seconds * 1000);
  });
}

function perfPercentiles(source, count) {
  const sorted = Array.from(source.subarray(0, count)).sort((a, b) => a - b);
  const at = (fraction) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] : 0);
  const mean = sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0;
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99), max: sorted.length ? sorted[sorted.length - 1] : 0, mean };
}

// Per-system milliseconds per sim step over the recording (Sim.timingTotal deltas / steps).
function perfSystems(steps) {
  const systems = {};
  for (const name in Sim.timingTotal) {
    const spent = Sim.timingTotal[name] - (PerfRecorder.systemStart[name] || 0);
    if (spent > 0) systems[name] = spent / Math.max(1, steps);
  }
  return systems;
}

function perfReport() {
  const recorder = PerfRecorder, count = recorder.count, steps = Sim.tick - recorder.startTick;
  const seconds = (performance.now() - recorder.startTime) / 1000;
  return {
    info: perfSceneInfo(), frames: count, seconds, steps, stepsPerFrame: count ? steps / count : 0,
    frameMs: perfPercentiles(recorder.frameMs, count), cpuMs: perfPercentiles(recorder.cpuMs, count), simMs: perfPercentiles(recorder.stepMs, recorder.stepCount), simFrameMs: perfPercentiles(recorder.simMs, count),
    renderMs: perfPercentiles(recorder.renderMs, count), hudMs: perfPercentiles(recorder.hudMs, count),
    drawCalls: perfPercentiles(recorder.drawCalls, count), instances: perfPercentiles(recorder.instances, count), triangles: perfPercentiles(recorder.triangles, count),
    renderScale: perfPercentiles(recorder.scale, count), systems: perfSystems(steps), droppedSteps: Perf.droppedSteps, bootMs: Perf.bootMs,
    quality: Quality.current().id, scaleNow: Render.size.scale, errors: ErrorLog.entries.length,
  };
}

// Sim cost per step with no frame in between: `rounds` rounds of `steps` steps run back to back, the fastest round per
// system (CDP throttling suspends the main thread in slices and a GC lands in some rounds only: the fastest round is the
// cost itself). Tool only (perf.mjs --bench).
function perfSimBench(steps, rounds) {
  const best = { stepMs: Infinity, systems: {} };
  for (let round = 0; round < rounds; round++) {
    const before = Object.assign({}, Sim.timingTotal), started = performance.now();
    Sim.run(steps);
    best.stepMs = Math.min(best.stepMs, (performance.now() - started) / steps);
    for (const name in Sim.timingTotal) {
      const perStep = (Sim.timingTotal[name] - (before[name] || 0)) / steps;
      best.systems[name] = name in best.systems ? Math.min(best.systems[name], perStep) : perStep;
    }
  }
  return best;
}

Loop.onFrame('input', perfRecordFrame);
Loop.onFrame('input', perfSceneFrame);

Object.assign(DebugApi.perf, {
  scenes: () => Object.keys(PERF_SCENES).map((name) => ({ name, label: PERF_SCENES[name].label })),
  scene: (name, qualityId, options) => perfStartScene(name, qualityId, options),
  record: (seconds) => perfRecord(seconds),
  report: () => PerfRecorder.last,   // the last finished recording (plan 18.1 report table), or null
  stop: () => { perfStopScene(); return true; },
  info: () => perfSceneInfo(),
  systems: () => Sim.systems,   // the registered sim systems in step order (allocation and cost probes)
  hotPaths: () => withRenderer(perfMeasureHotPaths),
  simBench: (steps, rounds) => perfSimBench(steps, rounds),   // heap bytes per hot path (the 'perf' allocation probes; perf.mjs --alloc-probes)
});

// ---- Self-tests (group 'perf'): exact numbers only, no timing budgets (a busy test machine would make those flaky) ----
const PERF_TEST_VSYNCS = 1440;   // ten seconds of 144 Hz vsyncs

// Drawn frames per second when the loop's cap pacing sees vsyncs at displayHz with the cap at capFps.
function perfPacedFps(displayHz, capFps) {
  const saved = { cap: Loop.frameCapMs, credit: Loop.capCreditMs }, vsyncMs = 1000 / displayHz;
  Loop.frameCapMs = capFps > 0 ? 1000 / capFps : 0;
  Loop.capCreditMs = 0;
  let drawn = 0, lastDrawn = 0;
  for (let vsync = 1; vsync <= PERF_TEST_VSYNCS; vsync++) {
    const now = vsync * vsyncMs;
    if (Loop.skipForCap(now - lastDrawn)) continue;
    lastDrawn = now;
    drawn++;
  }
  Loop.frameCapMs = saved.cap; Loop.capCreditMs = saved.credit;
  return drawn / (PERF_TEST_VSYNCS * vsyncMs / 1000);
}

Test.add('perf', (check) => {
  const near = (value, target) => Math.abs(value - target) < 1;
  check('frame cap 60 on a 144 Hz display averages 60 fps (not 48)', near(perfPacedFps(144, 60), 60), perfPacedFps(144, 60));
  check('frame cap 60 on a 60 Hz display drops no frame', near(perfPacedFps(60, 60), 60), perfPacedFps(60, 60));
  check('frame cap 90 on a 120 Hz display averages 90 fps', near(perfPacedFps(120, 90), 90), perfPacedFps(120, 90));
  check('frame cap off draws every vsync', near(perfPacedFps(144, 0), 144), perfPacedFps(144, 0));
  const savedCap = Settings.get('video.frameCap');
  Loop.capCreditMs = 5;
  Settings.set('video.frameCap', 90);
  check('the frame cap setting reaches the loop and resets the pacing credit', near(Loop.frameCapMs, 1000 / 90) && Loop.capCreditMs === 0, Loop.frameCapMs);
  check('battery saver: cap 30 on a 60 Hz display averages 30 fps', near(perfPacedFps(60, 30), 30), perfPacedFps(60, 30));
  Settings.set('video.frameCap', 30);
  const control = makeScaleControl();
  let scale = 1;
  for (let i = 0; i < 20; i++) scale = stepRenderScale(control, 1000 / 30, slowFrameMs(), slowFrameMs(), 0.1, scale, 0.5, 1);
  check('battery saver: capped 30 fps frames keep the render scale (the cap is the frame budget)', Render.config.frameCapMs === Loop.frameCapMs && scale === 1, scale);
  Settings.set('video.frameCap', savedCap);
  check('the cap budget clears with the cap', Render.config.frameCapMs === Loop.frameCapMs);
});

Test.add('perf', async (check) => {
  const callback = Loop.callback;
  await new Promise((resolve) => setTimeout(resolve, 100));
  check('the loop keeps one requestAnimationFrame callback across frames (no closure per frame)', typeof callback === 'function' && Loop.callback === callback);
  check('boot time is recorded at the first drawn frame, after the loop start, and reported', Perf.loopStartMs > 0 && Perf.bootMs > Perf.loopStartMs
    && Perf.bootMs <= performance.now() && Perf.stats().bootMs === Perf.bootMs && Perf.stats().loopStartMs === Perf.loopStartMs, [Perf.loopStartMs, Perf.bootMs]);
});

// Display-rate samples: `frames` menu frames of frameMs each, with the previous frame's triangles and CPU work given.
function perfFeedDisplayRate(frameMs, frames, triangles, cpuMs) {
  Perf.counters.triangles = triangles;
  Perf.cpuMs[Perf.lastIndex()] = cpuMs;
  for (let i = 0; i < frames; i++) measureDisplayRate(frameMs / 1000);
}

Test.add('perf', (check) => {
  const last = Perf.lastIndex();
  const saved = { intervalMs: DisplayRate.intervalMs, count: DisplayRate.count, state: Game.state, benchmark: Benchmark.active, triangles: Perf.counters.triangles, cpuMs: Perf.cpuMs[last],
    extension: GpuTimer.extension, gpuMs: GpuTimer.lastMs, scale: Render.size.scale };
  Game.state = 'menu'; Benchmark.active = false; DisplayRate.count = 0;
  GpuTimer.extension = saved.extension || {}; GpuTimer.lastMs = 1;   // a GPU timer that shows an idle GPU
  perfFeedDisplayRate(1000 / 30, REFRESH_SAMPLE_FRAMES, 0, 1);
  check('the menu measures a 30 Hz display', Math.abs(DisplayRate.intervalMs - 1000 / 30) < 0.01, DisplayRate.intervalMs);
  const slowOn30 = slowFrameMs();
  const control = makeScaleControl();
  let scale = 1;
  for (let i = 0; i < 20; i++) scale = stepRenderScale(control, 1000 / 30, slowOn30, slowOn30, 0.1, scale, 0.5, 1);
  check('on a 30 Hz display frames at its own rate keep the render scale', scale === 1, scale);
  perfFeedDisplayRate(1000 / 120, REFRESH_SAMPLE_FRAMES, 0, 1);
  check('a 120 Hz display keeps the 60 fps floor as its budget', Math.abs(slowFrameMs() - FRAME_BUDGET_MS * FRAME_BUDGET_TOLERANCE) < 1e-6, slowFrameMs());
  scale = 1;
  for (let i = 0; i < 20; i++) scale = stepRenderScale(control, 1000 / 30, slowFrameMs(), slowFrameMs(), 0.1, scale, 0.5, 1);
  check('30 fps against the 60 fps floor lowers the render scale', scale < 1, scale);
  const budget = slowFrameMs();
  perfFeedDisplayRate(1000 / 30, REFRESH_SAMPLE_FRAMES, 40000, 4);
  check('slow map-editor frames (a world drawn in the menu state) are not taken as the display rate', slowFrameMs() === budget && DisplayRate.count === 0, DisplayRate.intervalMs);
  perfFeedDisplayRate(1000 / 30, REFRESH_SAMPLE_FRAMES, 0, 30);
  check('CPU-bound menu frames are not taken as the display rate', slowFrameMs() === budget && DisplayRate.count === 0, DisplayRate.intervalMs);
  perfFeedDisplayRate(37, REFRESH_SAMPLE_FRAMES, 0, 1);
  check('a GPU-bound 27 fps menu (no standard refresh rate) keeps the last display rate', slowFrameMs() === budget, DisplayRate.intervalMs);
  perfFeedDisplayRate(1000 / 60, REFRESH_SAMPLE_FRAMES * 3 / 4, 0, 1);
  perfFeedDisplayRate(1000 / 30, REFRESH_SAMPLE_FRAMES / 4, 0, 1);
  check('a quarter of late menu frames does not halve a 60 Hz display rate', Math.abs(DisplayRate.intervalMs - 1000 / 60) < 0.01, DisplayRate.intervalMs);
  Benchmark.active = true;
  perfFeedDisplayRate(1000 / 30, REFRESH_SAMPLE_FRAMES, 0, 1);
  check('the benchmark frames are not taken as the display rate', Math.abs(DisplayRate.intervalMs - 1000 / 60) < 0.01, DisplayRate.intervalMs);
  Benchmark.active = false; GpuTimer.lastMs = 25;
  perfFeedDisplayRate(1000 / 30, REFRESH_SAMPLE_FRAMES, 0, 1);
  check('GPU-bound menu frames at every second vsync (timer shows 25 ms) are not taken as a 30 Hz display', slowFrameMs() === budget && DisplayRate.count === 0, DisplayRate.intervalMs);
  GpuTimer.extension = null;
  perfFeedDisplayRate(1000 / 30, REFRESH_SAMPLE_FRAMES, 0, 1);
  check('without a GPU timer one 30 Hz window does not raise the budget', slowFrameMs() === budget, DisplayRate.intervalMs);
  Render.size.scale = saved.scale - SCALE_STEP;
  perfFeedDisplayRate(1000 / 30, REFRESH_SAMPLE_FRAMES, 0, 1);
  check('without a GPU timer 30 Hz across one render-scale step (a GPU-bound phone) does not raise it', slowFrameMs() === budget, DisplayRate.intervalMs);
  Render.size.scale = saved.scale * 0.7;
  perfFeedDisplayRate(1000 / 30, REFRESH_SAMPLE_FRAMES, 0, 1);
  check('without a GPU timer 30 Hz held while the pixel count halved is the display rate', Math.abs(DisplayRate.intervalMs - 1000 / 30) < 0.01, DisplayRate.intervalMs);
  Object.assign(DisplayRate, { intervalMs: saved.intervalMs, count: saved.count, candidateMs: 0, candidateScale: 0 });
  Object.assign(GpuTimer, { extension: saved.extension, lastMs: saved.gpuMs });
  Render.size.scale = saved.scale; Render.size.dirty = true;
  Game.state = saved.state; Benchmark.active = saved.benchmark; Perf.counters.triangles = saved.triangles; Perf.cpuMs[last] = saved.cpuMs;
});

// The smoothed frame interval follows time, not frames: 0.1 s of frames moves it by the same share at 100 or 200 fps.
function perfSmoothedAfter(startMs, frameMs, frames) {
  ScaleControl.smoothedMs = startMs;
  for (let i = 0; i < frames; i++) updateRenderScale(frameMs / 1000);
  return (ScaleControl.smoothedMs - frameMs) / (startMs - frameMs);
}

Test.add('perf', (check) => {
  const saved = { smoothed: ScaleControl.smoothedMs, scale: Render.size.scale, setting: Render.config.renderScale, intervalMs: DisplayRate.intervalMs, count: DisplayRate.count };
  Render.config.renderScale = 1;   // a fixed scale: only the smoothing runs
  const at100 = perfSmoothedAfter(40, 10, 10), at200 = perfSmoothedAfter(40, 5, 20);
  check('frame smoothing gives the same response at 100 and 200 fps', Math.abs(at100 - at200) < 0.01, [at100, at200]);
  check('frame smoothing keeps about 37% of a step after its 0.1 s time constant', Math.abs(at100 - Math.exp(-1)) < 0.01, at100);
  Object.assign(ScaleControl, { smoothedMs: saved.smoothed });
  Object.assign(DisplayRate, { intervalMs: saved.intervalMs, count: saved.count });
  Render.config.renderScale = saved.setting; Render.size.scale = saved.scale; Render.size.dirty = true;
});

// Zero-allocation call shapes give the same results as the argument forms they replace (the cylinder form is test-only).
function rayCylinder(ox, oy, oz, dx, dy, dz, cx, cz, y0, y1, radius) {
  setHitRay(ox, oy, oz, dx, dy, dz, 0, 0);
  const volume = hitVolume;
  volume.cx = cx; volume.cz = cz; volume.y0 = y0; volume.y1 = y1; volume.radius = radius;
  rayHitCylinder();
  return volume.distance;
}
Test.add('perf', (check) => {
  check('length2 / length3 match Math.hypot', length2(3, 4) === 5 && length3(2, 3, 6) === 7 && Math.abs(length3(0.1, -0.2, 0.3) - Math.hypot(0.1, -0.2, 0.3)) < 1e-15);
  const first = makeRandom(12345), last = makeRandom(0xffffffff);
  const draw = (random, count) => { let value = 0; for (let i = 0; i < count; i++) value = random.next(); return Math.round(value * 4294967296); };
  check('typed-array RNG state gives the same numbers as the closure words (seed 12345)', draw(first, 1) === 773969981 && draw(first, 999) === 940126096);
  check('typed-array RNG state gives the same numbers as the closure words (seed 2^32 - 1)', draw(last, 1) === 3199221271 && draw(last, 999) === 3695540032);
  check('slab test: entry distance, inside = 0, miss = -1', rayBoundsDistance(0, 0, -5, 0, 0, 1, 10, -1, -1, -1, 1, 1, 1) === 4
    && rayBoundsDistance(0, 0, 0, 0, 0, 1, 10, -1, -1, -1, 1, 1, 1) === 0 && rayBoundsDistance(0, 3, -5, 0, 0, 1, 10, -1, -1, -1, 1, 1, 1) === -1);
  check('hit volumes from the scratch ray: sphere and capped cylinder', raySphere(0, 0, -5, 0, 0, 1, 0, 0, 0, 1) === 4
    && rayCylinder(0, 5, 0, 0, -1, 0, 0, 0, 0, 2, 0.5) === 3 && rayCylinder(2, 1, -5, 0, 0, 1, 0, 0, 0, 2, 0.5) === -1);
  const system = Sim.systems[0], before = system.totalMs;
  system.ms = 0.25; system.totalMs = before + 1;
  check('Sim.timing / timingTotal read the system records (no float writes into a dictionary object)', Sim.timing[system.name] === 0.25 && Sim.timingTotal[system.name] === before + 1);
  system.totalMs = before;
});

Test.add('perf', (check) => {
  const savedQuads = HudBatch.quads, bytes = new Uint8Array(HudBatch.bytes), vertexBytes = 4 * HUD_VERTEX_BYTES;
  HudBatch.quads = 0;
  const white = HudBatch.white;
  hudCorners.set([1, 2, 30, 4, 28, 40, 3, 38, white[0], white[1], white[0], white[1]]);   // the reference: every field by hand
  setHudPaint(0x336699, 0.5);
  pushHudCorners();
  hudCorners.set([1, 2, 30, 4, 28, 40, 3, 38, 0, 0, 0, 0]);
  pushHudSolid();
  let same = HudBatch.quads === 2;
  for (let i = 0; i < vertexBytes; i++) if (bytes[i] !== bytes[vertexBytes + i]) same = false;
  check('an untextured quad (pushHudSolid) writes the same vertices as the hand-filled corner scratch', same);
  HudBatch.quads = 0;
  HudPen.quad(1, 2, 30, 4, 28, 40, 3, 38, 0x336699, 0.5 / Hud.opacity);
  let samePen = HudBatch.quads === 1;
  for (let i = 0; i < vertexBytes; i++) if (bytes[i] !== bytes[vertexBytes + i]) samePen = false;
  check('the pen\'s quads and triangles fill the corner scratch (no fourteen-argument pushHudQuad call)', samePen && !/pushHudQuad/.test(HudPen.quad.toString()));
  const scale = HudBatch.alphaScale;
  HudBatch.alphaScale = 0.5;
  setHudPaint(0xffffff, 1);
  const halfByte = hudPaint[1];
  HudBatch.alphaScale = scale;
  const passThrough = ['rect', 'line', 'ring', 'text', 'quad'].every((name) => !/opacity/.test(HudPen[name].toString()));
  check('the HUD opacity scales the alpha once, in setHudPaint; the pen passes its alpha through (no boxed product per call)',
    halfByte === 128 && passThrough && !/clamp\(/.test(setHudPaint.toString()), halfByte);
  check('a HUD line writes its corners into the scratch (no eight-float call)', !/setHudCorners|pushHudQuad/.test(HudBatch.line.toString()));
  HudBatch.quads = HUD_MAX_QUADS;
  const dropped = HudBatch.dropped;
  HudPen.rect(0, 0, 4, 4, 0xffffff, 1);
  check('a full HUD batch drops and counts instead of growing', HudBatch.quads === HUD_MAX_QUADS && HudBatch.dropped === dropped + 1);
  HudBatch.quads = savedQuads;
});

// Draw paths a live frame showed allocating (PERF-006; the probes above run them inlined, where they did not): the sun lookup
// takes the instance array and an offset and returns the grid byte, and the PvE part loops are index loops (for-of made an
// iterator result per part in the frame's own compiled code).
Test.add('perf', (check) => {
  const point = new Float32Array([1.5, 2, -3.25]), byte = sunVisibilityAt(point, 0);
  check('the sun lookup returns the grid byte at the point in the float array (an integer, not a boxed float)',
    Number.isInteger(byte) && byte >= 0 && byte <= SUN_LIT && sampleSunVisibility(1.5, 2, -3.25) === byte / SUN_LIT, byte);
  const forOf = /for \(const \w+ of /;
  check('the PvE part and shield ring loops are index loops', !forOf.test(Pve.drawEnemy.toString()) && !forOf.test(drawShieldShell.toString()));
});

// A HUD ring turns each segment edge from the last one: two sine / cosine pairs per ring instead of four calls per segment.
Test.add('perf', (check) => {
  const savedQuads = HudBatch.quads, sin = Math.sin, cos = Math.cos, from = 0.5, to = 5.5, x = 100, y = 80, outer = 22;
  let trigCalls = 0;
  HudBatch.quads = 0;
  Math.sin = (angle) => { trigCalls++; return sin(angle); };
  Math.cos = (angle) => { trigCalls++; return cos(angle); };
  try { HudBatch.ring(x, y, 20, 4, 0xffffff, 1, from, to); } finally { Math.sin = sin; Math.cos = cos; }
  const segments = HudBatch.quads, corners = hudCorners;
  HudBatch.quads = savedQuads;
  check('a partial HUD ring has its share of the segments', segments === Math.ceil(HUD_RING_SEGMENTS * (to - from) / (Math.PI * 2)), segments);
  check('a HUD ring calls sine and cosine twice each, not per segment', trigCalls === 4, trigCalls);
  check('the last segment ends on the end angle', Math.abs(corners[2] - (x + sin(to) * outer)) < 1e-3 && Math.abs(corners[3] - (y - cos(to) * outer)) < 1e-3,
    corners[2] + ', ' + corners[3]);
});

// HUD drawing that a live frame showed boxing floats (PERF-006: the once-per-frame drawers run in the middle compiler tier
// for most of a match, which boxes every float argument of a call it does not inline): shapes, bars, weapon icons, labels,
// map dots and crosshair arms fill the scratch arrays (hudCorners, hudShapeAt, hudTextAt) instead of calling the pen again.
Test.add('perf', (check) => {
  const savedQuads = HudBatch.quads, floats = new Float32Array(HudBatch.bytes), stride = HUD_VERTEX_BYTES / 4;
  const corner = (quad, vertex) => [floats[(quad * 4 + vertex) * stride], floats[(quad * 4 + vertex) * stride + 1]].join(',');
  HudBatch.quads = 0;
  HudPen.shape('circle', 50, 60, 20, 0xffffff, 1);
  const disc = HudBatch.quads === 2 && corner(0, 0) === '42.5,52.5' && corner(0, 2) === '57.5,67.5' && corner(1, 0) === '50,' + Math.fround(60 - 10.8);
  HudBatch.quads = 0;
  HudPen.shape('triangle', 50, 60, 20, 0xffffff, 1);
  const triangle = HudBatch.quads === 1 && corner(0, 0) === '50,50' && corner(0, 1) === '60,70' && corner(0, 2) === '40,70' && corner(0, 3) === '40,70';
  HudBatch.quads = 0;
  HudPen.bar(10, 20, 100, 8, 0.25, 0xffffff, 1);
  const bar = HudBatch.quads === 2 && corner(1, 2) === '35,28';
  HudBatch.quads = 0;
  const width = HudBatch.text('AB 12', 0, 0, 20, 0xffffff, 'left', 1);
  HudBatch.quads = savedQuads;
  check('a pen disc is two quads around its centre, a triangle one, a quarter bar a track and a quarter fill', disc && triangle && bar);
  check('text returns its measured width', width === HudBatch.measure('AB 12', 20) && width > 0, width);
  const pen = HudPen.shapeAt.toString() + HudPen.bar.toString() + HudPen.weaponIcon.toString() + HudPen.label.toString();
  check('pen shapes, bars, icons and labels write the scratch, not more pen calls with float arguments', !/this\.(rect|quad|text|triangle|octagon)\(/.test(pen));
  check('map dots and crosshair arms go through the scratch', !/pen\.(shape|rect)\(/.test(hudMapDot.toString() + hudDrawArms.toString()));
});

// The every-frame drawers of the main layer place their numbers in the scratch arrays and call the pen's *At forms: a live
// tdm / horde frame after 60 s of play went from 4.8 KB to about 1 KB of garbage in this layer (PERFORMANCE.md 3.7).
Test.add('perf', (check) => {
  const drawers = [hudDrawVitalBar, hudDrawVitals, hudDrawAmmo, hudDrawWeaponBar, hudDrawGadgets, hudDrawConsumables, hudDrawAbilities, hudDrawMeter,
    hudDrawMoney, hudDrawPowerups, hudDrawTeamScore, hudDrawTime, hudDrawScoreLimit, hudDrawHeader, hudDrawFeedRow, hudDrawKillFeed, hudDrawBarks,
    hudDrawMinimap, hudMapEnemies, hudMapAllies, hudMapObjectives, hudMapPings];
  const argumentForm = /pen\.(text|label|rect|panel|bar|shape|octagon|ring|weaponIcon|triangle|quad)\(/;
  const offenders = drawers.filter((drawer) => argumentForm.test(drawer.toString())).map((drawer) => drawer.name);
  check('the main layer\'s every-frame drawers pass no float to the pen (scratch arrays and the *At forms)', offenders.length === 0, offenders.join(', '));
  // The PvE status (17g: about 0.5 KB per horde frame before) and the world markers, name tags, timers and captions (17d).
  const more = [hudPveStat, hudPveStatRight, hudPveTotal, hudPveFraction, hudPveTableRow, hudPveRowPanel, hudPveCoreBar, hudPveBossBar, hudPveTableHeader,
    hudPveChamberTable, hudPveRangeTable, hudPveNoteRect, hudPveCentreNote, hudDrawPve, hudDrawTickets, ...Object.values(HUD_PVE_ROWS),
    hudDrawEdgeArrow, hudDrawMarker, hudDrawPingMarkers, hudDrawNameTags, hudDrawItemTimers, hudDrawCaptions, hudDrawSoundRing];
  const moreOffenders = more.filter((drawer) => argumentForm.test(drawer.toString()) || /HudBatch\.measure\(|clamp\(/.test(drawer.toString())).map((drawer) => drawer.name);
  check('the PvE status and world marker drawers pass no float to the pen and measure through the scratch', moreOffenders.length === 0, moreOffenders.join(', '));
  check('the PvE status rows and boss bar read and move the row y in hudPveAt (no y argument or return)',
    Object.values(HUD_PVE_ROWS).every((row) => row.length === 3) && hudPveBossBar.length === 3 && hudPveStat.length === 5, hudPveBossBar.length);
  check('the crosshair arms read their geometry from the scratch', hudFillArms.length === 1);
  const benchmark = Render.sources.find((source) => source.name === 'benchmark'), wasActive = Benchmark.active;
  Benchmark.active = true;
  propBatch.clear();
  benchmark.draw(propBatch);
  const drawn = propBatch.counts.reduce((sum, count) => sum + count, 0);
  Benchmark.active = wasActive;
  propBatch.clear();
  check('the menu benchmark draws its grid through the instance record (no batch.mesh with float arguments)',
    !/\.mesh\(/.test(benchmark.draw.toString()) && drawn === BENCHMARK_GRID * BENCHMARK_GRID, drawn);
  const savedQuads = HudBatch.quads, ring = hudRingAt;
  HudBatch.quads = 0;
  ring[0] = 100; ring[1] = 80; ring[2] = 20; ring[3] = 4;
  hudDrawCooldownRingAt(HudPen, 0.25, 0xffffff);
  const quads = HudBatch.quads;
  HudBatch.quads = savedQuads;
  check('a cooldown ring from the scratch draws the full track and three quarters of the arc', quads === HUD_RING_SEGMENTS + Math.ceil(HUD_RING_SEGMENTS * 0.75), quads);
});

Test.add('perf', (check) => {
  const batch = actorBatch, saved = batch.counts.slice(), d = batch.data, shape = SHAPES[0];
  batch.clear();
  const meshed = batch.mesh(shape, 1, 2, 3, 0.5, 0.25, 1, 2, 3, 0.1, 0.2, 0.3, 0.4);
  const reserved = batch.reserve(shape);
  d[reserved] = 1; d[reserved + 1] = 2; d[reserved + 2] = 3; d[reserved + 3] = 0.5;
  d[reserved + 4] = 1; d[reserved + 5] = 2; d[reserved + 6] = 3; d[reserved + 7] = 0.25;
  d[reserved + 8] = 0.1; d[reserved + 9] = 0.2; d[reserved + 10] = 0.3; d[reserved + 11] = 0.4;
  batch.light(reserved);
  let same = meshed >= 0 && reserved === meshed + INSTANCE_FLOATS;
  for (let i = 0; i < INSTANCE_FLOATS; i++) if (d[meshed + i] !== d[reserved + i]) same = false;
  check('batch reserve + light writes the same instance as mesh()', same);
  const instance = Object.assign(makeShapeInstance(), { x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0.25, sx: 1, sy: 2, sz: 3, r: 0.1, g: 0.2, b: 0.3, emissive: 0.4 });
  const fromRecord = batch.meshFrom(shape, instance);
  let sameRecord = fromRecord === reserved + INSTANCE_FLOATS;
  for (let i = 0; i < INSTANCE_FLOATS; i++) if (d[meshed + i] !== d[fromRecord + i]) sameRecord = false;
  check('batch.meshFrom(shape, instance record) writes the same instance as mesh()', sameRecord);
  batch.counts[SHAPE_INDEX[shape]] = batch.capacity;
  const droppedBefore = Render.stats.droppedInstances;
  check('a full shape region refuses and counts instead of growing', batch.reserve(shape) === -1 && Render.stats.droppedInstances === droppedBefore + 1);
  batch.counts.set(saved);
});

// World draw runs (PERF-004 on large maps): visible chunks next to each other in the index buffer share one draw call.
Test.add('perf', (check) => withRenderer(() => {
  if (!Render.gl) { check('no WebGL2 context on this page: world draw runs skipped', true); return; }
  const gl = Render.gl;
  Settings.set('video.quality', 'potato');
  World.load(Maps.get('isle'));
  placeCamera(0, 30, -140, 0, -0.3);
  Render.drawFrame(1 / 60, 1);
  const chunks = WorldMesh.chunks;
  let visible = 0, triangles = 0, packed = true;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i], previous = chunks[i - 1];
    if (previous && chunk.offset !== previous.offset + previous.count * WorldMesh.indexBytes) packed = false;
    if (!boxVisible(chunk.minX, chunk.minY, chunk.minZ, chunk.maxX, chunk.maxY, chunk.maxZ)) continue;
    visible++;
    triangles += chunk.count / 3;
  }
  const drawsBefore = Render.stats.drawCalls, trianglesBefore = Render.stats.triangles;
  drawWorld(gl);
  const draws = Render.stats.drawCalls - drawsBefore, drawn = Render.stats.triangles - trianglesBefore;
  check('world chunks are packed back to back in row order', packed);
  check('a large map draws its visible chunks in merged runs with the same triangles', visible > 10 && draws * 2 < visible && drawn === triangles, { visible, draws, drawn, triangles });
  check('no GL error after the merged world draw', gl.getError() === gl.NO_ERROR);
}));

// ---- Allocation probes (PERF-006): the heap bytes a hot path allocates over many calls, read from performance.memory, which is
// exact with Chrome's --enable-precise-memory-info (tools/selftest.mjs starts Chrome with it). One boxed float per call shows
// as PERF_ALLOC_CALLS x 12 bytes or more; the limit leaves room for stray engine work. A GC inside the window shrinks the heap,
// so a round with a negative reading counts as allocating: a path that allocates enough to start a GC in every round must
// not read as free. ----
const PERF_ALLOC_CALLS = 20000;
const PERF_ALLOC_WARMUP_CALLS = 20000;    // first: the optimizing compiler must have compiled the path (the interpreter boxes every float)
const PERF_ALLOC_LIMIT_BYTES = 48 * 1024;
const PERF_ALLOC_ROUNDS = 3;
const PERF_PROBE_ACTORS = 8;
const PERF_MOVER_ID = PERF_PROBE_ACTORS;  // the actor the movement-step probe steps (past the hitscan probe's actors)
const perfMoverSpot = { x: 1.25, y: 0, z: -0.25 };    // y: the floor there, found by perfPlaceMover
const PERF_FLOOR_SEARCH = 100;            // m: perfPlaceMover looks for the floor from this high down to as far below
const PERF_ALLOC_PROBE_OBJECTS = 20000;   // the probe's self-check: this many small objects must show up

const perfShapeInstance = makeShapeInstance();   // the meshFrom probe's record (a match keeps one per caller the same way)
const perfHeapBytes = () => (performance.memory ? performance.memory.usedJSHeapSize : 0);

// The fewest bytes of PERF_ALLOC_ROUNDS measured rounds: the optimized code is compiled on another thread and may arrive
// during a round, while a path that really allocates does so in every round. Infinity = a GC ran in every round.
function perfAllocatedBytes(run) {
  for (let i = 0; i < PERF_ALLOC_WARMUP_CALLS; i++) run(i);
  let fewest = Infinity;
  for (let round = 0; round < PERF_ALLOC_ROUNDS; round++) {
    const before = perfHeapBytes();
    for (let i = 0; i < PERF_ALLOC_CALLS; i++) run(i);
    const allocated = perfHeapBytes() - before;
    fewest = Math.min(fewest, allocated < 0 ? Infinity : allocated);
  }
  return fewest;
}

// True when the heap counter sees a known allocation (a browser without the precise flag rounds and caches the counter).
function perfHeapCounterWorks() {
  const kept = new Array(PERF_ALLOC_PROBE_OBJECTS), before = perfHeapBytes();
  for (let i = 0; i < PERF_ALLOC_PROBE_OBJECTS; i++) kept[i] = { index: i };
  return perfHeapBytes() - before >= PERF_ALLOC_PROBE_OBJECTS * 12 && kept.length === PERF_ALLOC_PROBE_OBJECTS;
}

// The hot paths under test. Each run(i) passes only small integers (an argument the probe itself boxes would count), so the
// floats are made inside the path, as in a match.
function perfHotPaths() {
  const mover = makeMover(), trace = makeTrace(), sight = makeLine(), parts = LOD_PARTS[LOD.near], pose = actorPose, style = actorStyle;
  navReadOptions(NAV_DEFAULT_OPTIONS);
  Object.assign(mover.hull, { radius: 0.4, halfX: 0.4, halfZ: 0.4, bottom: 0, top: 1.8 });
  Object.assign(pose, { x: 1.25, y: 0.5, z: -2.75, yaw: 0.3, pitch: 0.1, swing: 0.2, drop: 0.05, legSquash: 0.9, lift: 0.01 });
  Object.assign(style, { r: 0.4, g: 0.5, b: 0.6, emissive: 0, scale: 1.05, headScale: 1, visible: true });
  for (let id = 0; id < PERF_PROBE_ACTORS; id++) {   // standing in the probe ray's path: rayOf runs every hit volume and records a hit
    Actors.x[id] = 0.75 + id * 0.25; Actors.y[id] = 0; Actors.z[id] = id * 1.5; Actors.height[id] = STAND_HEIGHT; Actors.eye[id] = 1.6;
  }
  setHitRay(0.5, 1.25, -3.5, 0.1, -0.05, 0.99, 50.5, 0.1);
  perfPlaceMover();
  return {
    'Hitbox.rayOf (hitscan against an actor)': (i) => { Hitbox.rayOf(i % PERF_PROBE_ACTORS); },
    'Collide.gatherAround + sweepSegment (a mover trace)': (i) => {
      mover.x = 0.5 + (i & 3); mover.y = 1.5; mover.z = -0.25;
      Collide.gatherAround(mover, 3);
      const segment = sweepQuery;
      segment.sx = mover.x; segment.sy = mover.y; segment.sz = mover.z; segment.ex = mover.x + 2.5; segment.ey = mover.y - 4.5; segment.ez = mover.z + 0.75;
      Collide.sweepSegment(mover.hull, trace);
    },
    'sweepActor + Collide.stepSlide (an actor step into the floor and a wall)': (i) => {
      mover.x = 0.5 + (i & 3); mover.y = 1.5; mover.z = -0.25; mover.vx = 40; mover.vy = -60; mover.vz = 9; mover.planeCount = 0;
      sweepActor(0, mover, TICK_SECONDS, true);
    },
    'stepActor (an actor step: state call, triggers, flags)': (i) => {
      Motion.stateTime[PERF_MOVER_ID] = 0; Actors.aimYaw[PERF_MOVER_ID] = (i & 7) * 0.25;
      stepActor(PERF_MOVER_ID, TICK_SECONDS);
    },
    'navAStar (an A* search to a linked node)': (i) => {
      const from = (i * 7) % Nav.nodeCount, linked = Nav.linkStart[from] < Nav.linkStart[from + 1];
      navAStar(from, linked ? Nav.linkTarget[Nav.linkStart[from]] : from);
    },
    'World.lineClearOf (a bot sight line)': (i) => {
      sight.ax = 0.5 + (i & 3); sight.ay = 1.5; sight.az = -3.5; sight.bx = -2.5; sight.by = 1.25 + (i & 1); sight.bz = 30.5;
      World.lineClearOf(sight);
    },
    'HudBatch.line (HUD quads)': (i) => { HudBatch.quads = 0; HudBatch.line(i & 255, 7, 300, 211, 3, 0xffffff, 1); },
    'emitActorPart (actor parts)': (i) => { actorBatch.clear(); emitActorPart(parts[i % parts.length], pose, style); },
    'batch.meshFrom (a shape instance record)': (i) => {
      const instance = perfShapeInstance;
      instance.x = 0.5 + (i & 7) * 0.25; instance.y = 1.5 - (i & 3) * 0.5; instance.z = (i & 15) * 0.125 - 0.75; instance.yaw = (i & 7) * 0.1;
      propBatch.clear();
      propBatch.meshFrom('box', instance);
    },
  };
}

function perfAllocationDetail(bytes) {
  if (bytes === Infinity) return 'a GC ran in every round of ' + PERF_ALLOC_CALLS + ' calls (it allocates heavily)';
  return Math.round(bytes / 1024) + ' KB over ' + PERF_ALLOC_CALLS + ' calls';
}

// The probe actor mantles in place on the floor at perfMoverSpot: the probe restarts the mantle every call, so each step runs
// the step driver (the indirect state call, triggers, eye, flags, footsteps) with no collision move. The collision move has
// its own probe (sweepActor); a whole walking step boxes floats only in V8's mid tier (docs/PERFORMANCE.md section 5).
function perfPlaceMover() {
  const id = PERF_MOVER_ID, spot = perfMoverSpot;
  spot.y = World.floorBelow(spot.x, PERF_FLOOR_SEARCH, spot.z, 2 * PERF_FLOOR_SEARCH);
  resetMotion(id);
  Move.setPreset(id, null);
  Actors.x[id] = Motion.fromX[id] = Motion.toX[id] = spot.x;
  Actors.y[id] = Motion.fromY[id] = Motion.toY[id] = spot.y;
  Actors.z[id] = Motion.fromZ[id] = Motion.toZ[id] = spot.z;
  Actors.height[id] = STAND_HEIGHT;
  Motion.grounded[id] = 1;
  holdInput(id, 0, 1, 0);
  setState(id, MOVE_STATE.MANTLE);
}

// Heap bytes per hot path over PERF_ALLOC_CALLS calls (on a loaded map: the mover step meets real brushes). Run with the renderer on.
function perfMeasureHotPaths() {
  const savedQuads = HudBatch.quads, bytes = {};
  World.load(Maps.get('isle'));
  const paths = perfHotPaths();
  for (const name in paths) bytes[name] = perfAllocatedBytes(paths[name]);
  HudBatch.quads = savedQuads;
  actorBatch.clear();
  propBatch.clear();
  return bytes;
}

Test.add('perf', (check) => withRenderer(() => {
  if (!perfHeapCounterWorks()) { check('no exact heap counter on this page (Chrome without --enable-precise-memory-info): allocation probes skipped', true); return; }
  const bytes = perfMeasureHotPaths();
  check('the mover probe traces against real brushes of the loaded map', Collide.candidateCount > 0, Collide.candidateCount);
  check('the hitscan probe hits its actor', Hitbox.rayOf(0) && Hitbox.distance > 0, Hitbox.distance);
  check('the movement probe actor stays mantling on the floor', Motion.state[PERF_MOVER_ID] === MOVE_STATE.MANTLE && Test.near(Actors.y[PERF_MOVER_ID], perfMoverSpot.y, 1e-4), Actors.y[PERF_MOVER_ID]);
  for (const name in bytes) check('allocation-free hot path: ' + name, bytes[name] < PERF_ALLOC_LIMIT_BYTES, perfAllocationDetail(bytes[name]));
}));

// ---- Quality caps per tier (PERF-009 bots and PvE enemies, PERF-010 particles, decals, dynamic lights) ----
const PERF_TIER_CAPS = {
  ultra: { bots: 23, enemies: 40, particles: 4096, decals: 128, lights: 8 },
  high: { bots: 19, enemies: 32, particles: 2048, decals: 96, lights: 4 },
  medium: { bots: 15, enemies: 24, particles: 1024, decals: 64, lights: 2 },
  low: { bots: 11, enemies: 18, particles: 512, decals: 32, lights: 0 },
  potato: { bots: 7, enemies: 12, particles: 256, decals: 0, lights: 0 },
};
const PERF_CAP_FLOOD = 5000;   // spawns per pool: more than the largest cap

// Floods the effect pools at the active preset and returns what they hold.
function perfFloodEffects() {
  Fx.clear();
  for (let i = 0; i < PERF_CAP_FLOOD / 50; i++) Fx.burst('spark', i, 1, 0, 0, 1, 0, 50);
  for (let i = 0; i < PERF_CAP_FLOOD; i++) Fx.decal(i, 0, 0, 0, 1, 0, 'bullet');
  for (let i = 0; i < MAX_DYNAMIC_LIGHTS * 2; i++) Fx.light(i, 1, 0, 0xffffff, 4, 10);
  updateLights();
  return { particles: particlePool.used, decals: decalPool.used, lights: Render.frame.lightCount };
}

Test.add('perf', (check) => withRenderer(() => {
  const savedScale = Render.config.particleScale;
  Render.config.particleScale = 1;
  for (const id in PERF_TIER_CAPS) {
    const caps = PERF_TIER_CAPS[id];
    Settings.set('video.quality', id);
    const row = Quality.current();
    check(id + ': the preset row carries the PERF-009 / PERF-010 caps', row.id === id && Object.keys(caps).every((field) => row[field] === caps[field]),
      Object.keys(caps).map((field) => field + ' ' + row[field]).join(', '));
    const held = perfFloodEffects();
    check(id + ': flooded particle, decal and light pools stay at the preset caps', held.particles === caps.particles && held.decals === caps.decals
      && held.lights === Math.min(caps.lights, MAX_DYNAMIC_LIGHTS), held);
    check(id + ': bot and PvE enemy counts are capped by the preset', Modes.defaultBots('royale', false).length <= caps.bots && Pve.cap() === Math.min(caps.enemies, MAX_ACTORS));
  }
  Render.config.particleScale = savedScale;
}));

Test.add('perf', (check) => {
  try {
    Settings.set('video.quality', 'potato');
    Game.start({ mode: 'tdm', map: 'harbor', seed: 1, bots: Array.from({ length: 16 }, () => ({})), modeOptions: { timeLimit: 0, scoreLimit: 0 } });
    let bots = 0;
    for (let id = 0; id < Actors.count; id++) if (Actors.kind[id] === ACTOR_KIND.BOT) bots++;
    check('a 16-bot match on Potato fills only the preset\'s 7 bot slots (PERF-009)', bots === PERF_TIER_CAPS.potato.bots, bots);
  } finally {
    Game.stop();
    Settings.reset('video.');
  }
});

// One actor step walks the brush tree about once: the settle and floor probe reuse the sweep's gathered list.
const PERF_GATHER_STEPS = 120;
const PERF_GATHER_WALKS_PER_ACTOR_STEP = 1.5;   // was 2 or more (sweep, settle) before the reuse

Test.add('perf', (check) => {
  try {
    Settings.set('video.quality', 'potato');
    Game.start({ mode: 'tdm', map: 'harbor', seed: 3, bots: Array.from({ length: 7 }, () => ({})), modeOptions: { timeLimit: 0, scoreLimit: 0 } });
    Sim.run(PERF_GATHER_STEPS);   // spawn protection and the first decisions out of the way
    let actorSteps = 0;
    const walksBefore = GatherCache.walks;
    for (let step = 0; step < PERF_GATHER_STEPS; step++) {
      for (let id = 0; id < Actors.count; id++) if (Actors.alive[id]) actorSteps++;
      Sim.run(1);
    }
    const perActorStep = (GatherCache.walks - walksBefore) / Math.max(1, actorSteps);
    check('an actor step walks the brush tree about once (gathered lists reused within the step)', actorSteps > 0 && perActorStep < PERF_GATHER_WALKS_PER_ACTOR_STEP, perActorStep.toFixed(2));
  } finally {
    Game.stop();
    Settings.reset('video.');
  }
});

// The TDM perf scene end to end: bots past the preset cap, kits on every bot, a followed bot, system time totals, a short
// recording through real frames, and a clean stop.
Test.add('perf', async (check) => {
  try {
    const info = perfStartScene('tdm', 'low');
    check('the TDM scene keeps its 16 bots past the low preset cap', info.bots === 16 && Quality.current().id === 'low' && Quality.current().bots < 16, info);
    check('the camera follows a living bot', Game.playerId >= 0 && Actors.kind[Game.playerId] === ACTOR_KIND.BOT);
    const kitted = Game.playerId, kit = PerfScene.kits ? PerfScene.kits[kitted % KIT_BOTS] : null;
    const firstAbility = () => (Abilities.row(kitted, 0) ? Abilities.row(kitted, 0).id : '');
    const equipped = !!kit && kit.abilities.length > 0 && firstAbility() === kit.abilities[0].id;
    Abilities.setSlot(kitted, 0, null);
    const respawn = PerfScene.handlers ? PerfScene.handlers['actor.spawn'] : null;
    if (respawn) respawn({ id: kitted });
    const listening = !!respawn && Bus.listeners.get('actor.spawn').indexOf(respawn) >= 0;
    check('every bot gets its scene kit, also after a respawn', equipped && listening && firstAbility() === kit.abilities[0].id, firstAbility());
    const before = Object.assign({}, Sim.timingTotal);
    Sim.run(20);
    let grown = 0, named = 0;
    for (const name in Sim.timingTotal) grown += Sim.timingTotal[name] - (before[name] || 0);
    for (const system of Sim.systems) if (Sim.timingTotal[system.name] !== undefined) named++;
    check('Sim.timingTotal sums the system times of every step', grown > 0 && named === Sim.systems.length, [grown, named]);
    check('the auto quality step-down is off in a budget run', Settings.get('video.autoLower') === false);
    const lazy = PerfRecorder.frameMs === null || PerfRecorder.last !== null;   // only an earlier recording may have made them
    const report = await perfRecord(0.3);
    check('the recorder arrays are made on the first recording, not at load', lazy && PerfRecorder.frameMs.length === PERF_RECORD_FRAMES);
    check('a recording returns frames, percentiles and per-system times', report.frames > 0 && report.cpuMs.p50 >= 0 && Object.keys(report.systems).length > 0, { frames: report.frames, steps: report.steps });
    check('__CTK.perf.report() returns the last recording', DebugApi.perf.report() === report);
  } finally {
    perfStopScene();
    Settings.reset('video.');
  }
  check('stopping the scene ends the match and clears its kits', !Game.isRunning() && PerfScene.row === null && PerfScene.kits === null);
});
