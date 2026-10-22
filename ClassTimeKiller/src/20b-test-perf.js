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
  handlers: null,
};

const PerfRecorder = {
  active: false, skip: 0, count: 0, resolve: null, timer: 0, startTick: 0, startTime: 0, systemStart: {}, lastTick: 0, stepCount: 0,
  stepMs: new Float32Array(PERF_RECORD_FRAMES),   // sim ms per 120 Hz step in each frame (frames that ran no step are left out)
  frameMs: new Float32Array(PERF_RECORD_FRAMES), cpuMs: new Float32Array(PERF_RECORD_FRAMES), simMs: new Float32Array(PERF_RECORD_FRAMES),
  renderMs: new Float32Array(PERF_RECORD_FRAMES), hudMs: new Float32Array(PERF_RECORD_FRAMES), drawCalls: new Uint16Array(PERF_RECORD_FRAMES),
  instances: new Uint16Array(PERF_RECORD_FRAMES), triangles: new Uint32Array(PERF_RECORD_FRAMES), scale: new Float32Array(PERF_RECORD_FRAMES),
};

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
  Object.assign(PerfScene, { name, row, quality: qualityId || 'low', generateMs: 0 });
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
    map: Game.match && Game.match.map ? Game.match.map.id : '' };
}

// ---- Recorder: one sample per frame, read in the 'input' phase from the frame that just finished (Perf, Render.stats) ----
function perfRecordFrame() {
  const recorder = PerfRecorder;
  if (!recorder.active) return;
  if (recorder.skip > 0) { recorder.skip--; recorder.lastTick = Sim.tick; return; }   // the first frame after a start belongs to the frame before it
  const last = (Perf.index + FRAME_HISTORY - 1) % FRAME_HISTORY, slot = recorder.count, stats = Render.stats;
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
  recorder.resolve(perfReport());
}

function perfRecord(seconds) {
  const recorder = PerfRecorder;
  if (recorder.active) throw new Error('perf: a recording is already running');
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


Loop.onFrame('input', perfRecordFrame);
Loop.onFrame('input', perfSceneFrame);

Object.assign(DebugApi.perf, {
  scenes: () => Object.keys(PERF_SCENES).map((name) => ({ name, label: PERF_SCENES[name].label })),
  scene: (name, qualityId, options) => perfStartScene(name, qualityId, options),
  record: (seconds) => perfRecord(seconds),
  stop: () => { perfStopScene(); return true; },
  info: () => perfSceneInfo(),
  systems: () => Sim.systems,   // the registered sim systems in step order (allocation and cost probes)
});
