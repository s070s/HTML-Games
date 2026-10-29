// Self-tests for S07 (group 'render') and the test-only DebugApi.renderDemo scene.
// CPU-side rules run everywhere; GPU checks run when the page has a WebGL2 context (headless Chrome: software WebGL).

// Sample arena: floor, walls, ramps, a platform, pillars, cover and light panels (DebugApi.renderDemo, tests).
function makeDemoArena(theme) {
  return { id: 'render-demo', theme: theme || 'foundry',
    lights: [{ pos: [-8, 3.2, 6], color: '#ffb066', radius: 9 }, { pos: [9, 2.5, 10], color: '#7fd8ff', radius: 7 }],
    brushes: [
      { shape: 'box', min: [-20, -1, -20], max: [20, 0, 20], material: 'concrete' },
      { shape: 'box', min: [-6, 0, -6], max: [6, 0.05, 6], material: 'plate' },
      { shape: 'box', min: [-20, 0, 19], max: [20, 5, 20], material: 'brick' },
      { shape: 'box', min: [-20, 0, -20], max: [-19, 5, 19], material: 'metal' },
      { shape: 'box', min: [19, 0, -20], max: [20, 5, 19], material: 'metal' },
      { shape: 'box', min: [-20, 0, -20], max: [20, 1.2, -19], material: 'concrete' },
      { shape: 'box', min: [6, 0, 8], max: [14, 3, 16], material: 'wood' },
      { shape: 'ramp', min: [2, 0, 8], max: [6, 3, 12], dir: '+x', material: 'hazard' },
      { shape: 'ramp', min: [-14, 0, 12], max: [-8, 2, 16], dir: '+z', material: 'tile' },
      { shape: 'box', min: [-14, 2, 16], max: [-8, 2.3, 19], material: 'tile' },
      { shape: 'box', min: [-9, 0, 2], max: [-8, 4.5, 3], material: 'trim' },
      { shape: 'box', min: [-3, 0, 12], max: [-2, 4.5, 13], material: 'trim' },
      { shape: 'box', min: [-8.4, 3.2, 2.9], max: [-8.1, 3.6, 3.05], material: 'light' },
      { shape: 'box', min: [-4, 0, 5], max: [-1, 1, 6], material: 'crate' },
      { shape: 'box', min: [1, 0, 3], max: [2.2, 1.2, 4.2], material: 'crate' },
      { shape: 'box', min: [12, 0, -8], max: [16, 0.3, -2], material: 'water' },
      { shape: 'box', min: [-16, 0, -12], max: [-10, 0.1, -4], material: 'grass' },
      { shape: 'box', min: [-17, 0, -14], max: [-15, 2.5, -12], material: 'rock' },
      { shape: 'box', min: [8, 0, 0], max: [9, 3, 5], material: 'glass' },
      { shape: 'box', min: [-2, 3.8, 11], max: [7, 4.1, 14], material: 'metal' },
    ] };
}

// Actors for the demo: two teams, walking / crouched / aiming / airborne, and one far away (far LOD).
const DEMO_ACTORS = [
  { team: 0, x: -3, z: 0, yaw: 0.5, speed: 6, flags: ACTOR_FLAG.ON_GROUND },
  { team: 1, x: 2.5, z: 1.5, yaw: Math.PI + 0.4, speed: 0, height: 1.1, eye: 0.95, flags: ACTOR_FLAG.ON_GROUND | ACTOR_FLAG.CROUCHED },
  { team: 1, x: 5, z: 6, yaw: Math.PI - 0.3, pitch: 0.4, speed: 3, flags: ACTOR_FLAG.ON_GROUND },
  { team: 0, x: -6, z: 7, yaw: 0.9, speed: 7, flags: ACTOR_FLAG.ON_GROUND },
  { team: 1, x: 0, y: 1.6, z: 4, yaw: Math.PI, speed: 4, flags: 0 },
  { team: 0, x: 9, y: 3, z: 12, yaw: -2.2, pitch: -0.3, speed: 0, flags: ACTOR_FLAG.ON_GROUND },
  { team: 1, x: -11, y: 2.3, z: 17.5, yaw: 2.6, speed: 2, flags: ACTOR_FLAG.ON_GROUND },
  { team: 0, x: 3, z: 18, yaw: Math.PI, speed: 0, flags: ACTOR_FLAG.ON_GROUND },
];

function spawnDemoActors() {
  const ids = [];
  for (const row of DEMO_ACTORS) {
    const id = Actors.create(ACTOR_KIND.BOT, row.team, 'demo');
    Actors.alive[id] = 1;
    Actors.place(id, row.x, row.y || 0, row.z);
    Actors.yaw[id] = Actors.prevYaw[id] = row.yaw; Actors.pitch[id] = Actors.prevPitch[id] = row.pitch || 0;
    Actors.vx[id] = Math.sin(row.yaw) * row.speed; Actors.vz[id] = Math.cos(row.yaw) * row.speed;
    Actors.height[id] = row.height || 1.8; Actors.eye[id] = row.eye || 1.62; Actors.flags[id] = row.flags;
    ids.push(id);
  }
  return ids;
}

function spawnDemoPlayer() {
  const id = Actors.create(ACTOR_KIND.PLAYER, 0, 'player');
  Actors.alive[id] = 1;
  Actors.place(id, 0, 0, -12);
  Actors.flags[id] = ACTOR_FLAG.ON_GROUND;
  Actors.aimYaw[id] = 0.08; Actors.aimPitch[id] = -0.06;
  Game.playerId = id;
  return id;
}

function emitDemoEffects() {
  Fx.burst('smoke', -12, 0.2, -8, 0, 1, 0, 6);
  Fx.burst('fire', -12, 0.2, -8, 0, 1, 0, 6);
  Fx.burst('spark', 1.6, 1.2, 3.6, 0, 1, -0.5, 8);
  Fx.burst('energy', 6, 1.5, 5, -1, 0.5, 0, 6);
  Fx.burst('heal', -3, 0.4, 0, 0, 1, 0, 4);
  Fx.tracer(0.15, 1.45, -11.5, 4.9, 1.4, 6);
  Fx.light(-12, 1, -8, '#ff7a2a', 7, 0.5);
}

const demo = { emitter: false, sinceEffects: 0, weapon: 'rifle' };
// Builds a sample scene with world, 8 actors, effects, a player view model and a HUD layer; returns frame stats.
DebugApi.renderDemo = (themeId, weapon, qualityId) => {
  Benchmark.active = false; Benchmark.done = true;
  if (qualityId) Settings.set('video.quality', qualityId);
  Game.stop();
  Actors.clear();
  Render.worldQuery = Render.worldQuery || World;
  World.load(makeDemoArena(themeId));
  spawnDemoActors();
  spawnDemoPlayer();
  demo.weapon = weapon || 'rifle';
  Render.viewModel = (out) => { out.visible = true; out.shape = demo.weapon; out.model = demo.weapon; out.color = '#56606b'; return out; };   // a class or a weapon id
  emitDemoEffects();
  if (!demo.emitter) {
    demo.emitter = true;
    Render.addUpdate(45, (seconds) => { demo.sinceEffects += seconds; if (demo.sinceEffects > 0.25 && World.map && World.map.id === 'render-demo') { demo.sinceEffects = 0; emitDemoEffects(); } });
    HudBatch.addLayer('render-demo', 0, (hud) => {
      if (!World.map || World.map.id !== 'render-demo') return;
      hud.rect(16, 16, 230, 64, '#0b0f14', 0.6);
      hud.text('ClassTimeKiller', 28, 36, 20, '#ffb547', 'left');
      hud.text(Perf.counters.drawCalls + ' draws  ' + Math.round(Perf.counters.triangles / 1000) + 'k tris', 28, 62, 14, '#e8eef5', 'left');
      hud.ring(hud.width / 2, hud.height / 2, 9, 2, '#ffffff', 0.85);
      hud.line(hud.width / 2 - 18, hud.height / 2, hud.width / 2 - 12, hud.height / 2, 2, '#ffffff', 0.9);
      hud.ring(hud.width - 60, hud.height - 60, 30, 6, '#5fd38d', 0.9, 0, Math.PI * 1.3);
    });
  }
  const started = performance.now();
  Render.drawFrame(1 / 60, 1);
  return { cpuMs: performance.now() - started, chunks: WorldMesh.chunks.length, worldTriangles: WorldMesh.triangles, bakeMs: WorldMesh.bakeMs,
    stats: Object.assign({}, Render.stats), scale: Render.size.scale, quality: Render.quality.id, programs: Render.programSpecs.length };
};

DebugApi.renderState = () => ({ render: Render, worldMesh: WorldMesh, hud: HudBatch });

// Weapon gallery (07c-render-models): 16 models of a kind a page, side on in a grid on the demo arena, for a screenshot (tools/
// selftest.mjs --no-selftest --eval "__CTK.models.gallery('weapons', 'near', 0)" --screenshot <png>). kind: 'weapons' | 'classes' |
// 'projectiles'; lod: a LOD name ('near' = every part, the view model; 'far' = a held weapon close up; 'distant' = its
// silhouette). Returns the ids shown, left to right, top to bottom. A view model: renderDemo(theme, weapon id).
const GALLERY_COLUMNS = 4, GALLERY_PAGE = 16, GALLERY_STEP_X = 2.1, GALLERY_STEP_Y = 1.1, GALLERY_Z = -14, GALLERY_TURN = 0.4;
const modelGallery = { models: [], level: 0, scale: 1, pose: makeModelPose() };
function galleryCell(index, out) {
  out.x = ((GALLERY_COLUMNS - 1) / 2 - (index % GALLERY_COLUMNS)) * GALLERY_STEP_X;   // screen right = -x
  out.y = 0.7 + (Math.ceil(modelGallery.models.length / GALLERY_COLUMNS) - 1 - Math.floor(index / GALLERY_COLUMNS)) * GALLERY_STEP_Y; out.z = GALLERY_Z;
}
function drawModelGallery(batch) {
  const pose = modelGallery.pose;
  modelGallery.models.forEach((model, index) => {
    galleryCell(index, pose);
    Object.assign(pose, { yaw: GALLERY_TURN - Math.PI / 2, scale: modelGallery.scale, originZ: model.centerZ });
    Models.paint(pose, model);
    Models.drawLevel(batch, model, pose, modelGallery.level);
  });
}
// __CTK.models.gallery(kind, ...): the one debug view of the code-drawn models. 'weapons' | 'classes' | 'projectiles' (lod,
// page): this gallery; 'items' | 'powerups' | 'thrown' | 'devices' or a list of gear model ids (yaw, scale): showGearGallery;
// 'bodies' (actor model kind, '' = all; yaw; quality id): showActorModelGallery.
DebugApi.models = {
  gallery(kind, ...options) {
    if (kind === 'bodies') return showActorModelGallery(...options);
    if (Array.isArray(kind) || GEAR_GALLERY_GROUPS[kind]) return showGearGallery(kind, ...options);
    return showWeaponGallery(kind, ...options);
  },
};
function showWeaponGallery(kind, lod, page) {
  DebugApi.renderDemo('foundry');
  Actors.clear(); Render.viewModel = null; Game.playerId = -1;
  document.getElementById('overlay').style.display = 'none';
  placeCamera(0, 2.3, -19, 0, 0);
  if (!modelGallery.models.length) Render.addSource('modelGallery', drawModelGallery);
  const all = kind === 'projectiles' ? WeaponModels.projectile.filter(Boolean) : kind === 'classes' ? CAT.viewModels.map((row) => WeaponModels.byId[row.id]) : WeaponModels.weapon;
  Object.assign(modelGallery, { models: all.slice((page || 0) * GALLERY_PAGE, ((page || 0) + 1) * GALLERY_PAGE), level: LOD[lod || 'near'], scale: kind === 'projectiles' ? 3 : 2.4 });
  return modelGallery.models.map((model) => model.id);
}

// ---- Test helpers ----
// Runs a block with the renderer switched on (headless off, benchmark parked) and restores every hook afterwards.
async function withRenderer(run) {
  const wasHeadless = Game.headless, benchmarkActive = Benchmark.active, benchmarkDone = Benchmark.done;
  const renderScale = Render.size.scale, smoothedMs = ScaleControl.smoothedMs, worldQuery = Render.worldQuery;
  const timerExtension = GpuTimer.extension, timerMs = GpuTimer.lastMs;
  Game.headless = false; Benchmark.active = false; Benchmark.done = true; Render.worldQuery = World;
  try {
    return await run();
  } finally {
    Game.headless = wasHeadless; Benchmark.active = benchmarkActive; Benchmark.done = benchmarkDone; Render.worldQuery = worldQuery;
    Render.size.scale = renderScale; Render.size.dirty = true; ScaleControl.smoothedMs = smoothedMs; resetScaleCeiling(ScaleControl);
    GpuTimer.extension = timerExtension; GpuTimer.lastMs = timerMs; StepDown.slowSeconds = 0;
    Render.cameraOverride = null; Render.viewModel = MATCH_VIEW_MODEL; Render.actorStyle = null;
    Game.state = 'menu'; Game.paused = false; Game.playerId = -1;
    Actors.clear(); World.clear(); clearWorldMesh(); Fx.clear(); Settings.resetKeys(settingKeysStarting('video.'));
  }
}

function placeCamera(x, y, z, yaw, pitch) {
  Render.cameraOverride = (camera) => { camera.x = x; camera.y = y; camera.z = z; camera.yaw = yaw; camera.pitch = pitch; camera.roll = 0; return true; };
  updateCamera(1 / 60, 1);
}

function makeTestActor(kind, team, x, z) {
  const id = Actors.create(kind, team, 'test');
  Actors.alive[id] = 1;
  Actors.place(id, x, 0, z);
  Actors.flags[id] = ACTOR_FLAG.ON_GROUND;
  return id;
}

const MATCH_VIEW_MODEL = Render.viewModel;   // the real hook (S11, wrapped by S15): renderDemo and tests swap in stubs
const batchInstances = (batch) => batch.counts.reduce((sum, count) => sum + count, 0);
const instanceOffset = (batch, shape, index) => (SHAPE_INDEX[shape] * batch.capacity + index) * INSTANCE_FLOATS;
// The default body's part lists as drawn (07c ActorModels row 0).
const DEFAULT_FAR_PARTS = ActorModels.lists[0][LOD.far], DEFAULT_DISTANT_PARTS = ActorModels.lists[0][LOD.distant];

// 0..1 sun visibility near a point (1 outside the grid), through the renderer's own sunVisibilityAt (also the perf tests).
const sunProbePoint = new Float64Array(3);
function sampleSunVisibility(x, y, z) {
  sunProbePoint[0] = x; sunProbePoint[1] = y; sunProbePoint[2] = z;
  return sunVisibilityAt(sunProbePoint, 0) / SUN_LIT;
}

// Removes the HUD layers a test added (names starting with 'test-').
function removeTestHudLayers() {
  for (let i = HudBatch.layers.length - 1; i >= 0; i--) if (HudBatch.layers[i].name.startsWith('test-')) HudBatch.layers.splice(i, 1);
}
const sleepMs = (ms) => new Promise((done) => setTimeout(done, ms));
async function waitUntil(condition, timeoutMs) {
  for (let waited = 0; waited < timeoutMs && !condition(); waited += 20) await sleepMs(20);
  return condition();
}

// World mesh triangles for a hand-made brush list (CPU only).
function worldTriangles(brushes, theme) {
  World.load({ id: 'render-test', theme, brushes });
  buildWorldMesh(World.map, World.brushes);
  return WorldMesh.triangles;
}

// Area of the built world's up-facing triangles at height y (square metres), read back from the packed buffers.
function worldTopArea(y) {
  const floats = new Float32Array(WorldMesh.vertexBytes), indices = WorldMesh.indexData;
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) area += topTriangleArea(floats, indices[i], indices[i + 1], indices[i + 2], y);
  return area;
}

function topTriangleArea(floats, a, b, c, y) {
  const stride = WORLD_VERTEX_BYTES / 4, pa = a * stride, pb = b * stride, pc = c * stride;
  const flat = Math.abs(floats[pa + 1] - y) < 1e-3 && Math.abs(floats[pb + 1] - y) < 1e-3 && Math.abs(floats[pc + 1] - y) < 1e-3;
  if (!flat) return 0;
  const upward = (floats[pb + 2] - floats[pa + 2]) * (floats[pc] - floats[pa]) - (floats[pb] - floats[pa]) * (floats[pc + 2] - floats[pa + 2]);
  return Math.max(0, upward) / 2;
}

function topAreaOf(brushes, y) {
  worldTriangles(brushes);
  return worldTopArea(y);
}

// ---- Data and contracts ----
Test.add('render', (check) => {
  const themes = ['foundry', 'ruins', 'station', 'canal', 'overgrowth', 'glacier'];
  check('six map themes (MAP-022)', CAT.themes.length === 6 && themes.every((id) => CAT.themes.byId(id)));
  const classes = ['sidearm', 'shotgun', 'rifle', 'smg', 'lmg', 'dmr', 'sniper', 'rail', 'launcher', 'energy', 'heavy', 'melee', 'tool', 'exotic', 'power'];
  check('view-model parts for all 15 weapon classes', classes.every((id) => CAT.viewModels.byId(id) && CAT.viewModels.byId(id).parts.length > 0));
  check('view-model parts use known shapes', CAT.viewModels.every((row) => row.parts.every((part) => SHAPE_INDEX[part.shape] !== undefined)));
  const kinds = ['spark', 'smoke', 'dust', 'blood', 'muzzle', 'explosion', 'energy', 'water', 'fire', 'frost', 'shock', 'heal'];
  check('a particle row for every Fx kind', kinds.every((id) => CAT.fxKinds.byId(id)));
  check('far actor LOD = 6 parts, near LOD more (REN-002)', DEFAULT_FAR_PARTS.length === 6 && NEAR_PARTS.length > 6);
  check('test-only accessors live in the tests, not in Fx or HudBatch', !('liveParticles' in Fx) && !('removeLayer' in HudBatch));
  const detailLevel = Models.detailLevel, lists = ActorModels.lists[ActorModels.index[0]];
  Models.detailLevel = () => LOD.far;   // a preset rule that drops the near details: bodies follow the one rule
  const dropped = ActorModels.partsFor(0, LOD.near, { modelDetail: true });
  Models.detailLevel = detailLevel;
  check('body LOD follows Models.detailLevel (near without details = the plain list)', dropped === lists[MODEL_LIST_PLAIN] && ActorModels.partsFor(0, LOD.near, { modelDetail: true }) === lists[LOD.near]);
  check('actor parts use known shapes', CAT.actorParts.every((part) => SHAPE_INDEX[part.shape] !== undefined));
  check('all 7 contract shapes have geometry', ['box', 'sphere', 'cylinder', 'capsule', 'cone', 'wedge', 'ring'].every((name) => ShapeMesh.ranges[SHAPE_INDEX[name]].count > 0));
  check('at most 8 shader programs (REN-003)', Render.programSpecs.length <= MAX_PROGRAMS, Render.programSpecs.length);
  check('materials fit the uniform table', CAT.materials.length <= MAX_MATERIALS);
  check('material patterns are known', CAT.materials.every((row) => MATERIAL_PATTERNS.includes(row.pattern)));
  check('theme palettes name real materials', CAT.themes.every((theme) => Object.keys(theme.palette).every((id) => CAT.materials.byId(id))));
  const keys = ['video.renderScale', 'video.fov', 'video.viewmodelFov', 'video.fxaa', 'video.outlines', 'video.headBob', 'video.maxDpr', 'video.autoLower'];
  check('video settings have label and category', keys.every((key) => Settings.definitions.get(key).label && Settings.definitions.get(key).category === 'video'));
  check('FOV defaults to 90, 80 on touch devices', Settings.get('video.fov') === (TOUCH_DEVICE ? 80 : 90));
  check('render scale setting: auto or 0.4..1', RENDER_SCALE_OPTIONS[0] === 'auto' && RENDER_SCALE_OPTIONS[1] === 0.4 && RENDER_SCALE_OPTIONS[RENDER_SCALE_OPTIONS.length - 1] === 1);
});

// ---- Static world build (REN-001) ----
Test.add('render', (check) => {
  const map = makeDemoArena('ruins');
  World.load(map);
  buildWorldMesh(map, World.brushes);
  check('demo arena in <= 30 world draw ranges (step 1.3)', WorldMesh.chunks.length > 0 && WorldMesh.chunks.length <= 30, WorldMesh.chunks.length);
  check('demo arena fits the Potato triangle budget', WorldMesh.triangles < CAT.quality.byId('potato').triangles, WorldMesh.triangles);
  check('chunks are 16 m cells', WorldMesh.chunks.every((c) => c.maxX - c.minX <= CHUNK_METERS + BAKE_CELL_MAX && c.maxZ - c.minZ <= CHUNK_METERS + BAKE_CELL_MAX));
  check('a lone box = 5 faces (lowest underside skipped)', worldTriangles([{ shape: 'box', min: [0, 0, 0], max: [1, 1, 1] }]) === 10, WorldMesh.triangles);
  const covered = topAreaOf([{ shape: 'box', min: [-2, -1, -2], max: [2, 0, 2] }, { shape: 'box', min: [0, 0, 0], max: [2, 1, 2] }], 0);
  check('floor under a box is culled, the rest kept', Test.near(covered, 12, 1e-3), covered);
  const thinWall = topAreaOf([{ shape: 'box', min: [-4, -1, -4], max: [4, 0, 4] }, { shape: 'box', min: [0.8, 0, -4], max: [1.2, 3, 4] }], 0);
  check('a thin wall off the bake grid hides only its own footprint (no holes)', Test.near(thinWall, 60.8, 1e-3), thinWall);
  const partial = topAreaOf([{ shape: 'box', min: [-2, -1, -2], max: [1.5, 0, 2] }, { shape: 'box', min: [0, -1, -2], max: [4, 0, 2] }], 0);
  check('partial coplanar overlap: the union drawn exactly once (no hole, no z-fighting)', Test.near(partial, 24, 1e-3), partial);
  const pillar = topAreaOf([{ shape: 'box', min: [-3, -1, -3], max: [3, 0, 3] }, { shape: 'box', min: [-0.37, 0, 0.21], max: [0.53, 2, 1.13] }], 0);
  check('an off-grid pillar cuts an exact hole', Test.near(pillar, 36 - 0.9 * 0.92, 1e-3), pillar);
  const alone = worldTriangles([{ shape: 'box', min: [-3, -1, -3], max: [3, 2, 3] }]);
  const buried = worldTriangles([{ shape: 'box', min: [-3, -1, -3], max: [3, 2, 3] }, { shape: 'box', min: [-1.3, 0.7, -1.3], max: [1.1, 1.3, 0.9] }]);
  check('a brush buried inside another adds nothing', buried === alone, buried + ' vs ' + alone);
  const ramp = worldTriangles([{ shape: 'ramp', min: [0, 0, 0], max: [4, 2, 2], dir: '+x' }]);
  check('a ramp has no zero-area end face', ramp > 0 && ramp <= 12, ramp);
  check('world indices fit 16 bits for small maps', WorldMesh.indexData instanceof Uint16Array);
  World.clear(); clearWorldMesh();
});

// ---- The world comes through the Render.worldQuery hook (S08 fills it; S07 never calls World) ----
Test.add('render', (check) => withRenderer(() => {
  const map = { id: 'render-hook', brushes: [{ shape: 'box', min: [0, 0, 0], max: [1, 1, 1] }] };
  Render.worldQuery = null;
  World.load(map);
  check('world.load builds nothing while the hook is empty', WorldMesh.triangles === 0, WorldMesh.triangles);
  Render.worldQuery = { brushes: World.brushes };
  World.load(map);
  check('world.load builds from Render.worldQuery.brushes', WorldMesh.triangles === 10, WorldMesh.triangles);
}));

// ---- Baked lighting (REN-004): AO, sun shadow rays, map lights ----
Test.add('render', (check) => {
  const brushes = [{ shape: 'box', min: [-20, -1, -20], max: [20, 0, 20] }, { shape: 'box', min: [10, 0, -20], max: [11, 4, 20] },
    { shape: 'box', min: [-14, 3, -3], max: [-6, 3.3, 3] }];
  const map = { id: 'light-test', theme: 'ruins', brushes, lights: [{ pos: [0, 2, -12], color: '#ffffff', radius: 6 }] };
  World.load(map);
  const bake = makeBake(map, World.brushes);
  const open = vertexLight(bake, 0, 0, 0, 0, 1, 0), corner = vertexLight(bake, 9.9, 0, 5, 0, 1, 0), roofed = vertexLight(bake, -10, 0, 0, 0, 1, 0);
  check('open floor sees the sun', open[4] > 0.5, open[4]);
  check('AO darkens the floor next to a wall', corner[3] < open[3] - 0.05, corner[3] + ' vs ' + open[3]);
  check('a roof blocks the sun (shadow ray)', roofed[4] === 0, roofed[4]);
  const lit = vertexLight(bake, 0, 0, -12, 0, 1, 0), unlit = vertexLight(bake, 0, 0, 12, 0, 1, 0);
  check('map lights add light', lit[0] > unlit[0] + 0.1, lit[0] + ' vs ' + unlit[0]);
  buildSunGrid(bake);
  check('sun grid: open air lit, under the roof shaded', sampleSunVisibility(0, 1, 0) === 1 && sampleSunVisibility(-10, 1, 0) === 0);
  check('bake ray: blocked by the wall', rayBlocked(bake, 0, 1, 0, 1, 0, 0, 30) && !rayBlocked(bake, 0, 1, 0, -1, 0, 0, 30));
  check('bake ray: stops above the world', !rayBlocked(bake, 0, 1, 0, 0, 1, 0, 300));
  check('bake ray: crosses grid cells diagonally', rayBlocked(bake, -9, 1, -9, Math.SQRT1_2, 0, Math.SQRT1_2, 40));
  buildWorldMesh(map, World.brushes);
  check('ground probe finds the floor and the roof top', Test.near(groundBelow(0, 5, 0, 20), 0, 1e-4) && Test.near(groundBelow(-10, 6, 0, 20), 3.3, 1e-4));
  check('ground probe misses past its range', groundBelow(0, 50, 0, 20) === -Infinity);
  World.clear(); clearWorldMesh();
});

// ---- Camera, culling, FOV (REN-006) ----
Test.add('render', (check) => withRenderer(() => {
  placeCamera(0, 2, 0, 0, 0);
  check('box in front is visible', boxVisible(-1, 0, 9, 1, 2, 11));
  check('box behind is culled', !boxVisible(-1, 0, -11, 1, 2, -9));
  check('box beyond the view distance is culled', !boxVisible(-1, 0, 400, 1, 2, 402));
  check('camera override places the camera', Render.view.overridden && Render.camera.y === 2);
  Render.cameraOverride = null;
  const id = makeTestActor(ACTOR_KIND.PLAYER, 0, 2, 4);
  Actors.prevX[id] = 0; Actors.prevZ[id] = 0; Actors.aimYaw[id] = 0.5; Game.playerId = id;
  updateCamera(1 / 60, 0.5);
  check('camera follows the interpolated player eye', Test.near(Render.camera.x, 1, 1e-6) && Test.near(Render.camera.z, 2, 1e-6) && Render.camera.y > 1.5, JSON.stringify(Render.camera));
  check('camera uses the aim angles', Render.camera.yaw === Actors.aimYaw[id]);
  Settings.set('video.fov', 100);
  updateCamera(1 / 60, 1);
  check('FOV setting applies', Render.camera.fov === 100);
  check('horizontal 90 at 16:9 = vertical ~58.7', Test.near(verticalFov(90) / DEG, 58.7, 0.1));
  // A portrait phone keeps the 4:3 horizontal view (Vert- below 4:3), not a 25 degree slit.
  const size = Render.size, saved = [size.width, size.height];
  const fovAt = (width, height) => { size.width = width; size.height = height; updateCamera(1 / 60, 1); return 2 * Math.atan(1 / Render.frame.projection[0]) / DEG; };
  Settings.set('video.fov', 80);
  const wide = fovAt(1600, 900), standard = fovAt(1024, 768), portrait = fovAt(390, 844);
  size.width = saved[0]; size.height = saved[1];
  check('portrait keeps the 4:3 horizontal view', Test.near(wide, 80, 0.01) && portrait >= standard - 0.01 && portrait > 60, [wide, standard, portrait]);
}));

// normalize-05: one gait. Over one footstep (STRIDE_METRES, S10) the legs and the head bob each go half a walk cycle.
Test.add('render', (check) => withRenderer(() => {
  const id = Actors.create(ACTOR_KIND.BOT, 0, 'demo'), speed = 4, footstepSeconds = STRIDE_METRES / speed;
  Actors.alive[id] = 1; Actors.vx[id] = speed; Actors.vz[id] = 0; Actors.flags[id] = ACTOR_FLAG.ON_GROUND;
  actorPhase[id] = 0; ViewState.bobPhase = 0;
  animateActor(id, actorPose, footstepSeconds, LOD.near);
  headBob(id, footstepSeconds);
  check('one footstep = half a leg cycle and half a head-bob cycle', Test.near(actorPhase[id], Math.PI, 1e-4) && Test.near(ViewState.bobPhase, Math.PI, 1e-4),
    [actorPhase[id], ViewState.bobPhase]);
}));

// ---- Actors (REN-002): LODs, interpolation, style hook, shadows ----
Test.add('render', (check) => withRenderer(() => {
  placeCamera(0, 1.6, 0, 0, 0);
  SunShadow.active = false;   // blob shadows: a live frame on a sun-shadow preset (a slow boot's benchmark) may have left it on
  const near = makeTestActor(ACTOR_KIND.BOT, 1, 0, 5);
  const far = makeTestActor(ACTOR_KIND.BOT, 0, 0, Render.quality.lodNear + 10);
  makeTestActor(ACTOR_KIND.BOT, 0, 3, 5);
  Actors.alive[2] = 0;
  fillActors(1 / 60, 1);
  check('near LOD all parts + far LOD 6 parts, dead actors skipped', batchInstances(actorBatch) === NEAR_PARTS.length + DEFAULT_FAR_PARTS.length, batchInstances(actorBatch));
  check('a blob shadow per live actor (MIS-037)', shadowBatch.counts[SHAPE_INDEX.disc] === 2, shadowBatch.counts[SHAPE_INDEX.disc]);
  const behind = makeTestActor(ACTOR_KIND.BOT, 0, 0, -6);
  fillActors(1 / 60, 1);
  check('actors behind the camera are culled', batchInstances(actorBatch) === NEAR_PARTS.length + DEFAULT_FAR_PARTS.length && shadowBatch.counts[SHAPE_INDEX.disc] === 2);
  Actors.alive[behind] = 0;
  writeColor(tintColor, 0, CAT.teamColors[1].color);
  check('team colour on the torso', Test.near(actorBatch.data[instanceOffset(actorBatch, 'box', 0) + 8], tintColor[0], 1e-6));
  Actors.prevX[near] = -2; Actors.x[near] = 2;
  fillActors(1 / 60, 0.5);
  check('interpolated position (alpha 0.5)', Test.near(actorBatch.data[instanceOffset(actorBatch, 'box', 0)], 0, 1e-4));
  const standingHead = actorBatch.data[instanceOffset(actorBatch, 'sphere', 0) + 1];
  Actors.height[near] = 1.1;
  fillActors(1 / 60, 1);
  check('crouching lowers the head', actorBatch.data[instanceOffset(actorBatch, 'sphere', 0) + 1] < standingHead - 0.4);
  Render.actorStyle = (id, out) => { out.scale = id === far ? 1 : 2; out.visible = id !== far; };
  fillActors(1 / 60, 1);
  check('actorStyle scales and hides', Test.near(actorBatch.data[instanceOffset(actorBatch, 'box', 0) + 4], CAT.actorParts[0].size[0] * 2, 1e-5) && batchInstances(actorBatch) === NEAR_PARTS.length);
  Render.actorStyle = null;
  Render.cameraOverride = null;
  Game.playerId = near;
  updateCamera(1 / 60, 1);
  fillActors(1 / 60, 1);
  check('first person: no own body but own shadow', batchInstances(actorBatch) === DEFAULT_FAR_PARTS.length && shadowBatch.counts[SHAPE_INDEX.disc] === 2);
}));

// ---- Render.addSource (props batch) ----
Test.add('render', (check) => withRenderer(() => {
  const source = { name: 'test-pickups', draw: (batch) => batch.mesh('cylinder', 0, 1, 0, 0, 0, 1, 0.2, 1, 1, 0.8, 0.2, 0.5) };
  const broken = { name: 'test-broken', draw: () => { throw new Error('broken source'); } };
  Render.sources.push(source, broken);
  const logged = Test.expectErrors(() => { fillSources(); fillSources(); });
  check('sources fill the props batch every frame', propBatch.counts[SHAPE_INDEX.cylinder] === 1);
  check('a throwing source is logged once and switched off', logged === 1 && broken.failed === true);
  propBatch.mesh('no-such-shape', 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0);
  check('unknown shapes are ignored', batchInstances(propBatch) === 1);
  Render.sources.splice(Render.sources.indexOf(source), 2);
}));

// ---- Effects caps (PERF-010) ----
Test.add('render', (check) => withRenderer(() => {
  Settings.set('video.quality', 'potato');
  Fx.burst('spark', 0, 1, 0, 0, 1, 0, 1000);
  check('particles capped by quality (Potato 256)', particlePool.used === 256 && countLive(particlePool) === 256, particlePool.used);
  Fx.decal(0, 0, 0, 0, 1, 0, 'bullet');
  check('Potato keeps no decals', decalPool.used === 0);
  Fx.light(0, 1, 0, '#ffffff', 5, 1);
  updateLights();
  check('Potato has no dynamic lights', Render.frame.lightCount === 0);
  Settings.set('video.quality', 'medium');
  for (let i = 0; i < 3; i++) Fx.light(i, 1, 0, '#ffaa00', 5, 1);
  updateLights();
  check('Medium applies 2 dynamic lights', Render.frame.lightCount === 2);
  Fx.decal(0, 0, 0, 0, 1, 0, 'scorch');
  check('decal ring buffer fills on Medium', decalPool.used === 1);
  Fx.tracer(0, 1, 0, 0, 1, 10);
  const tracer = (particlePool.next - 1) * PARTICLE_FLOATS;
  check('tracer: segment + additive tracer mode', particlePool.data[tracer + 5] === 10 && particlePool.data[tracer + 16] === PARTICLE_MODE.tracer + ADDITIVE_FLAG);
  Render.frame.time += 10;
  check('particles expire on the GPU clock', countLive(particlePool) === 0);
  updateLights();
  check('lights fade out', Render.frame.lightCount === 0);
  Settings.set('video.quality', 'ultra');
  Fx.burst('spark', 0, 1, 0, 0, 1, 0, CAT.quality.byId('ultra').particles);
  Settings.set('video.quality', 'potato');
  updateLights();
  check('a quality step-down shrinks the drawn particle range to the new cap (render-07)', particlePool.used <= 256 && particlePool.next <= 256, particlePool.used);
}));

// ---- Dynamic resolution (PERF-007) ----
Test.add('render', (check) => {
  const control = makeScaleControl();
  let scale = 1;
  for (let i = 0; i < 4; i++) scale = stepRenderScale(control, 9, 6, 4.8, 0.1, scale, 0.5, 1);
  check('no change before 0.5 s over budget', scale === 1);
  scale = stepRenderScale(control, 9, 6, 4.8, 0.1, scale, 0.5, 1);
  check('lowers one 0.05 step after 0.5 s over budget', scale === 0.95, scale);
  for (let i = 0; i < 19; i++) scale = stepRenderScale(control, 4, 6, 4.8, 0.1, scale, 0.5, 1);
  check('no raise before 2 s under 80%', scale === 0.95, scale);
  scale = stepRenderScale(control, 4, 6, 4.8, 0.1, scale, 0.5, 1);
  check('raises after 2 s under 80% (hysteresis)', scale === 1, scale);
  for (let i = 0; i < 5; i++) scale = stepRenderScale(control, 9, 6, 4.8, 0.1, scale, 0.5, 1);
  check('a drop right after a raise sets a ceiling', control.ceiling === 0.95 && scale === 0.95, control.ceiling);
  for (let i = 0; i < 25; i++) scale = stepRenderScale(control, 4, 6, 4.8, 0.1, scale, 0.5, 1);
  check('no raise above the ceiling before its wait', scale === 0.95);
  for (let i = 0; i < 300 && scale === 0.95; i++) scale = stepRenderScale(control, 4, 6, 4.8, 0.1, scale, 0.5, 1);
  check('retries above the ceiling after 30 s', scale === 1 && control.sinceCeiling === 0 && control.retrying, control.sinceCeiling);
  for (let i = 0; i < 5; i++) scale = stepRenderScale(control, 9, 6, 4.8, 0.1, scale, 0.5, 1);
  check('a failed retry doubles the ceiling wait (no cap)', control.ceilingWait === 60 && scale === 0.95, control.ceilingWait);
  check('never below the preset minimum', stepRenderScale(control, 99, 6, 4.8, 0.6, 0.5, 0.5, 1) === 0.5);
  const quality = Quality.current();
  check('preset scale ranges (Potato 0.4-0.8)', CAT.quality.byId('potato').renderScaleMin === 0.4 && CAT.quality.byId('potato').renderScaleMax === 0.8 && quality.renderScaleMin === 0.5);
});

// ---- Benchmark (PERF-008) and auto step-down (PERF-013) ----
Test.add('render', (check) => withRenderer(() => {
  check('benchmark thresholds', pickBenchmarkQuality(2) === 'ultra' && pickBenchmarkQuality(4) === 'high' && pickBenchmarkQuality(7) === 'medium'
    && pickBenchmarkQuality(12) === 'low' && pickBenchmarkQuality(40) === 'potato');
  Benchmark.samples.fill(4, 0, 9); Benchmark.count = 9;
  finishBenchmark();
  check('benchmark writes video.autoQuality', Settings.get('video.autoQuality') === 'high' && Render.quality.id === 'high' && Benchmark.done);
  let toast = '';
  const listener = Bus.on('toast', (payload) => { toast = payload.text; });
  Game.state = 'playing';
  GpuTimer.extension = null;             // frame-time path: the scale floor is used up first
  ScaleControl.smoothedMs = 40;
  Render.size.scale = 1;
  for (let i = 0; i < 6; i++) updateStepDown(1);
  check('no step-down while dynamic resolution can still lower the scale', Render.quality.id === 'high');
  Render.size.scale = Render.quality.renderScaleMin;
  for (let i = 0; i < 4; i++) updateStepDown(1);
  check('no step-down before 5 s under 60 fps', Render.quality.id === 'high');
  updateStepDown(1);
  check('5 s under 60 fps lowers one preset for this session and toasts', Render.quality.id === 'medium' && Settings.get('video.autoQuality') === 'high' && toast.includes('Medium'), toast);
  check('the session step also lowers the PERF-009 caps', Quality.current().id === 'medium' && Pve.cap() === CAT.quality.byId('medium').enemies, Quality.current().id);
  Settings.set('video.autoLower', false);
  for (let i = 0; i < 6; i++) updateStepDown(1);
  check('the option turns the step-down off; the session step stays', Render.quality.id === 'medium' && Quality.current().id === 'medium');
  Settings.set('video.quality', 'potato');
  check('a chosen preset ends the session step; no step below Potato', Quality.current().id === 'potato' && !lowerQualityStep());
  Settings.set('video.quality', 'high');
  check('an explicit preset steps down itself, unsaved', lowerQualityStep() && Render.quality.id === 'medium' && Settings.get('video.quality') === 'high');
  Bus.off('toast', listener);
  ScaleControl.smoothedMs = FRAME_BUDGET_MS;
}));

// PERF-013 on a 30 Hz phone (iOS Low Power Mode, no GPU timer): idle 30 Hz match frames are the display's pace, not
// slowness; a CPU-bound 30 fps still steps down (for this session only: the block above).
function feedMatchFrames(cpuMs, seconds) {
  Object.assign(DisplayRate, { count: 0, intervalMs: 0, candidateMs: 0, candidateScale: 0 });
  Render.size.scale = 1; ScaleControl.smoothedMs = FRAME_BUDGET_MS; resetScaleCeiling(ScaleControl);
  for (let frame = 0; frame < seconds * 30; frame++) {
    Perf.cpuMs[Perf.lastIndex()] = cpuMs;
    updateRenderScale(1 / 30);
    updateStepDown(1 / 30);
  }
  return Render.quality.id + ' ' + Settings.get('video.autoQuality');
}
Test.add('render', (check) => withRenderer(() => {
  const savedRate = Object.assign({}, DisplayRate), triangles = Perf.counters.triangles;
  Settings.set('video.quality', 'auto'); Settings.set('video.autoQuality', 'high');
  GpuTimer.extension = null; Game.state = 'playing';
  // A match frame draws a world.
  Perf.counters.triangles = 50000;
  const idle = feedMatchFrames(8, 30);
  check('idle 30 Hz match frames: no step-down', idle === 'high high' && Math.abs(DisplayRate.intervalMs - 1000 / 30) < 0.01, idle);
  const busy = feedMatchFrames(30, 12);
  check('CPU-bound 30 fps match frames step down, unsaved', busy === 'medium high', busy);
  Object.assign(DisplayRate, savedRate); Perf.counters.triangles = triangles;
}));

// ---- View model (step 1.4) ----
Test.add('render', (check) => withRenderer(() => {
  const id = makeTestActor(ACTOR_KIND.PLAYER, 0, 0, 0);
  Game.playerId = id;
  const state = { shape: 'rifle', ads: 0 };
  Render.viewModel = (out) => { out.visible = true; out.shape = state.shape; out.ads = state.ads; return out; };
  const built = CAT.viewModels.every((row) => {
    state.shape = row.id;
    updateCamera(1 / 60, 1);
    fillViewModel();
    return batchInstances(viewModelBatch) === row.parts.length;
  });
  check('every weapon class builds its parts', built);
  state.shape = 'no-such-class';
  updateCamera(1 / 60, 1); fillViewModel();
  check('unknown class falls back to the rifle', batchInstances(viewModelBatch) === CAT.viewModels.byId('rifle').parts.length);
  state.shape = 'rifle';
  const hip = Math.abs(poseWeapon(CAT.viewModels.byId('rifle'), viewModelState).x);
  state.ads = 1;
  updateCamera(1 / 60, 1);
  check('aiming moves the weapon to the centre', Math.abs(poseWeapon(CAT.viewModels.byId('rifle'), viewModelState).x) < hip * 0.2);
  check('aiming zooms the camera', Render.camera.fov < Render.config.fov);
  state.ads = 0;
  Render.viewModel = (out) => { out.visible = true; out.shape = 'sidearm'; out.recoilPitch = 2; out.recoilYaw = -1; out.dual = true; return out; };
  updateCamera(1 / 60, 1); fillViewModel();
  check('the recoil punch kicks the view (degrees, up = positive pitch)', Test.near(Render.camera.pitch, Actors.aimPitch[id] + 2 * DEG, 1e-6)
    && Test.near(Render.camera.yaw, Actors.aimYaw[id] - DEG, 1e-6), Render.camera.pitch);
  check('dual pistols draw two guns', batchInstances(viewModelBatch) === 2 * CAT.viewModels.byId('sidearm').parts.length, batchInstances(viewModelBatch));
  placeCamera(0, 2, 0, 0, 0);
  fillViewModel();
  check('no view model while the camera is overridden', batchInstances(viewModelBatch) === 0);
}));

// ---- Weapon and projectile models (03q, 07c-render-models) ----
const MODEL_WORLD_PARTS = [3, 9], MODEL_VIEW_PARTS_MAX = 14;
const modelValid = (model) => model.shapes.every((shape) => SHAPE_INDEX[shape] !== undefined) && Array.from(model.data).every(Number.isFinite)
  && model.parts.every((part) => part.size.every((size) => size > 0 && size < 2)) && Array.from(model.colors).every((value) => value >= 0 && value <= 1);
Test.add('render', (check) => {
  const own = CAT.weapons.filter((weapon) => CAT.weaponModels.byId(weapon.id) && WeaponModels.weapon[weapon.index].id === weapon.id);
  check('every weapon has its own model row (no class fallback; 38 weapons)', own.length === CAT.weapons.length && CAT.weapons.length === 38, own.length);
  check('every model row names a weapon or a projectile', CAT.weaponModels.every((row) => CAT.weapons.byId(row.id))
    && CAT.projectileModels.every((row) => CAT.projectiles.byId(row.id)));
  check('the visible launcher projectiles have models', ['rocket', 'grenade', 'mine', 'stake', 'disc', 'arrow', 'missile', 'warhead'].every((id) => WeaponModels.projectile[CAT.projectiles.byId(id).index]));
  const models = WeaponModels.weapon.concat(WeaponModels.projectile.filter(Boolean), Object.values(WeaponModels.byId));
  check('model parts use known shapes, finite offsets, sizes 0..2 m and 0..1 colours', models.every(modelValid));
  const sizes = WeaponModels.weapon.map((model) => Array.from(model.lodCounts));
  check('weapon world models have 3..9 parts and view models at most 14', sizes.every(([all, world]) => all <= MODEL_VIEW_PARTS_MAX && world >= MODEL_WORLD_PARTS[0] && world <= MODEL_WORLD_PARTS[1]), JSON.stringify(sizes));
  check('LOD part counts shrink: distant < far <= near, distant keeps at least one', models.every((model) => model.lodCounts[LOD.distant] >= 1
    && model.lodCounts[LOD.distant] < model.lodCounts[LOD.far] && model.lodCounts[LOD.far] <= model.lodCounts[LOD.near]));
  check('weapon models take the view pose of their class row', WeaponModels.byId.heron.pose === CAT.viewModels.byId('sniper') && WeaponModels.byId.ramjet.pose === CAT.viewModels.byId('launcher'));
  const silhouette = (id) => { const model = WeaponModels.byId[id]; return Array.from(model.data.slice(0, model.lodCounts[LOD.distant] * MODEL_PART_FLOATS)).join(','); };
  const rifles = ['vanguard', 'ratchet', 'kestrel', 'wasp'].map(silhouette);
  check('the rifles and the SMG keep distinct distant silhouettes (render-04)', new Set(rifles).size === rifles.length);
  const twin = WeaponModels.byId.hailstorm.parts, mirrored = twin.filter((part) => part.shape === 'cylinder' && part.size[0] < 0.03);
  check('a mirrored part draws twice, on both sides', mirrored.length === 4 && Test.near(mirrored[0].offset[0], -mirrored[1].offset[0], 1e-9), mirrored.length);
  const projectileModel = (id) => WeaponModels.projectile[CAT.projectiles.byId(id).index], scaled = projectileModel('missile').parts[0];
  check('a scaled from row scales offsets and sizes (missile = 0.75 rocket)', Test.near(scaled.size[1], projectileModel('rocket').parts[0].size[1] * 0.75, 1e-6));
  check('the weapon and gear rows are valid data', ['viewModels', 'weaponModels', 'projectileModels'].every((name) => Data.validate(name).length === 0),
    ['viewModels', 'weaponModels', 'projectileModels'].map((name) => Data.validate(name).join(' / ')).join(' '));
});

Test.add('render', (check) => withRenderer(() => {
  const id = makeTestActor(ACTOR_KIND.PLAYER, 0, 0, 0), heron = WeaponModels.byId.heron;
  Game.playerId = id;
  Render.viewModel = (out) => { out.visible = true; out.shape = 'sniper'; out.model = 'heron'; return out; };
  Settings.set('video.quality', 'high');
  updateCamera(1 / 60, 1); fillViewModel();
  check('the view model draws the weapon\'s own model', batchInstances(viewModelBatch) === heron.count, batchInstances(viewModelBatch));
  Settings.set('video.quality', 'potato');
  updateCamera(1 / 60, 1); fillViewModel();
  check('Potato drops the lod-0 view-model details', heron.lodCounts[LOD.far] < heron.count && batchInstances(viewModelBatch) === heron.lodCounts[LOD.far], batchInstances(viewModelBatch));
  Settings.set('video.quality', 'high');
  Game.playerId = -1; Actors.alive[id] = 0;   // only the two bots below are drawn
  placeCamera(0, 1.6, -4, 0, 0);
  const near = makeTestActor(ACTOR_KIND.BOT, 1, 0, 2), far = makeTestActor(ACTOR_KIND.BOT, 1, 0, Render.quality.lodNear + 5), heldIndex = CAT.weapons.byId('heron').index;
  Render.heldWeapon = (actor) => (actor === near || actor === far ? heldIndex : -1);
  fillActors(1 / 60, 1);
  const expected = NEAR_PARTS.length - 1 + heron.lodCounts[LOD.far] + DEFAULT_FAR_PARTS.length + heron.lodCounts[LOD.distant];
  check('a held weapon replaces the gun part, one LOD coarser than its actor', batchInstances(actorBatch) === expected, batchInstances(actorBatch) + ' / ' + expected);
  Render.heldWeapon = () => -1;
  fillActors(1 / 60, 1);
  check('no held weapon keeps the plain gun part', batchInstances(actorBatch) === NEAR_PARTS.length + DEFAULT_FAR_PARTS.length, batchInstances(actorBatch));
  propBatch.clear();
  const instance = makeShapeInstance();
  instance.z = 2;
  drawWeaponPickup(propBatch, heldIndex, instance, false);
  check('a weapon pickup draws its model (every part close up)', batchInstances(propBatch) === heron.count, batchInstances(propBatch));
  propBatch.clear();
  Projectiles.clear();
  const rocket = CAT.projectiles.byId('rocket'), slot = Projectiles.spawn(rocket, near, 0, 0, 0, 1, 2, 30, 0, 0, 10);
  Projectiles.draw(propBatch);
  check('a rocket draws its model, facing its flight from launch', batchInstances(propBatch) === WeaponModels.projectile[rocket.index].count && Test.near(Projectiles.faceYaw[slot], Math.PI / 2, 1e-6));
  const disc = CAT.projectiles.byId('disc'), resting = Projectiles.spawn(disc, near, 0, 0, 0, 1, 2, 0, 0, 0, 10);
  check('a still projectile spawns facing 0', Projectiles.faceYaw[resting] === 0 && Projectiles.facePitch[resting] === 0);
  Projectiles.flightTime[resting] = 0; Projectiles.stepOne(resting, 0.1);
  check('spin turns only in flight (a resting disc keeps its turn)', Projectiles.flightTime[resting] === 0, Projectiles.flightTime[resting]);
  Projectiles.clear(); propBatch.clear();
}));

// PERF-006: drawing models (view model, held weapons, pickups, projectiles) allocates nothing once compiled.
Test.add('render', (check) => withRenderer(() => {
  if (!perfHeapCounterWorks()) { check.skip('model drawing allocation probe', 'no exact heap counter on this page'); return; }
  const weapons = WeaponModels.weapon, ids = CAT.weapons.map((weapon) => weapon.id), instance = makeShapeInstance(), state = viewModelState;
  Object.assign(actorPose, { x: 1.25, y: 0.5, z: -2.75, yaw: 0.3, pitch: 0.1, swing: 0.2, drop: 0.05, legSquash: 0.9, lift: 0.01 });
  Object.assign(actorStyle, { r: 0.4, g: 0.5, b: 0.6, emissive: 0, scale: 1.05, headScale: 1, visible: true });
  Object.assign(state, { visible: true, color: '#56606b', ads: 0, kick: 0, reload: 0, swap: 0, dual: false });
  Projectiles.clear();
  CAT.projectileModels.forEach((row, index) => Projectiles.spawn(CAT.projectiles.byId(row.id), 0, 0, 0, 0.5 + index, 1.5, 2, 3, 1, 4, 10));
  const bytes = {
    view: perfAllocatedBytes((i) => { state.model = ids[i % ids.length]; fillViewModel(); }),
    held: perfAllocatedBytes((i) => { actorBatch.clear(); drawHeldWeapon(weapons[i % weapons.length], actorPose, actorStyle, i & 1 ? LOD.near : LOD.far); }),
    pickup: perfAllocatedBytes((i) => { propBatch.clear(); instance.yaw = i & 7; drawWeaponPickup(propBatch, i % weapons.length, instance, (i & 1) === 1); }),
    projectiles: perfAllocatedBytes(() => { propBatch.clear(); Projectiles.draw(propBatch); }),
  };
  for (const name in bytes) check('drawing models allocates nothing: ' + name, bytes[name] < PERF_ALLOC_LIMIT_BYTES, perfAllocationDetail(bytes[name]));
  Projectiles.clear(); propBatch.clear(); actorBatch.clear(); viewModelBatch.clear();
}));

// render-03: hip-fired, every weapon shows on a 16:9 screen beside the HUD ammo panel (keyboard and mouse layout).
const VIEWMODEL_TEST_SIZE = [1280, 720];
const VIEWMODEL_MIN_SHOWN = 0.5;         // share of a weapon's part centres on screen and clear of the ammo panel
// Whether one view-model part's centre lands on screen outside the panel (camera at the origin, yaw 0: view right = world -x).
function viewModelPartShown(offset, panel) {
  const d = viewModelBatch.data, size = Render.size, tanHalf = Math.tan(verticalFov(Render.config.viewmodelFov) / 2);
  const x = (-d[offset] / d[offset + 2] / (tanHalf * size.width / size.height) + 1) / 2 * size.width;
  const y = (1 - d[offset + 1] / d[offset + 2] / tanHalf) / 2 * size.height;
  const onScreen = x >= 0 && x <= size.width && y >= 0 && y <= size.height;
  return onScreen && !(x >= panel.left && y >= panel.top);
}
function viewModelShownShare(panel) {
  let parts = 0, shown = 0;
  SHAPES.forEach((shape) => {
    for (let i = 0; i < viewModelBatch.counts[SHAPE_INDEX[shape]]; i++) {
      parts++;
      if (viewModelPartShown(instanceOffset(viewModelBatch, shape, i), panel)) shown++;
    }
  });
  return shown / Math.max(1, parts);
}
// fillViewModel from viewModelState on a 16:9 keyboard-and-mouse screen; returns the share of parts shown.
function viewModelShownAt16x9() {
  const size = Render.size, saved = { width: size.width, height: size.height, device: Input.device, camera: Object.assign({}, Render.camera) };
  size.width = VIEWMODEL_TEST_SIZE[0]; size.height = VIEWMODEL_TEST_SIZE[1]; Input.device = 'kbm';
  Object.assign(Render.camera, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  const layout = Object.assign({}, Hud.layout);
  updateHudLayout(layout, size.width, size.height);
  fillViewModel();
  const share = viewModelShownShare({ left: layout.ammoRight - layout.ammoWidth, top: layout.bottom - layout.ammoHeight });
  size.width = saved.width; size.height = saved.height; Input.device = saved.device; Object.assign(Render.camera, saved.camera);
  viewModelBatch.clear();
  return share;
}
Test.add('render', (check) => withRenderer(() => {
  const hidden = [];
  CAT.weapons.map((weapon) => weapon.id).concat(CAT.viewModels.map((row) => row.id)).forEach((id) => {
    Object.assign(viewModelState, { visible: true, model: id, shape: id, ads: 0, kick: 0, reload: 0, swap: 0, dual: false });
    const share = viewModelShownAt16x9();
    if (share < VIEWMODEL_MIN_SHOWN) hidden.push(id + ' ' + share.toFixed(2));
  });
  check('hip pose: every weapon shows on screen, clear of the ammo panel (render-03)', hidden.length === 0, hidden.join(', '));
}));

// render-01/02: the match hook (S11 Weapons.viewModel, wrapped by S15) through updateCamera and poseWeapon. An idle held
// weapon is fully raised (swap 0) and on screen; mid-swap the incoming weapon rises (swap falls from 1 towards 0).
Test.add('render', (check) => withRenderer(() => {
  Game.headless = true;   // the match starts as in the weapons tests (no pointer lock request), then renders
  TestArena.start({});
  Game.headless = false;
  const id = TestArena.actor(1, 0, 0);
  Weapons.setLoadout(id, ['vanguard', 'warden']);
  Game.playerId = id;
  Render.viewModel = MATCH_VIEW_MODEL;
  updateCamera(1 / 60, 1);
  const idleSwap = viewModelState.swap, share = viewModelShownAt16x9();
  check('a held weapon in a match is raised and on screen (render-01)', viewModelState.visible && idleSwap === 0 && share >= VIEWMODEL_MIN_SHOWN, [idleSwap, share]);
  Game.playerId = -1;
  Actors.buttons[id] = BTN.NEXT_WEAPON; Sim.step(); Actors.buttons[id] = 0;
  Game.playerId = id;
  updateCamera(1 / 60, 1);
  check('a swap starts at the hold pose', Weapons.state[id] === WEAPON_STATE.SWAP && viewModelState.swap < 0.1, viewModelState.swap);   // P6-04: the old weapon lowers first
  Game.playerId = -1;
  Sim.run(Math.ceil(Weapons.stateDuration[id] * SWAP_LOWER_SHARE * TICK_RATE));
  Game.playerId = id;
  updateCamera(1 / 60, 1);
  check('a swap lowers the old weapon, then rises', viewModelState.swap > 0.9, viewModelState.swap);
  Game.playerId = -1;
  TestArena.finish();
}));

// ---- HUD batch (REN-005) ----
Test.add('render', (check) => {
  HudBatch.quads = 0;
  HudBatch.rect(0, 0, 10, 10, '#ffffff', 1);
  check('rect = 1 quad', HudBatch.quads === 1);
  HudBatch.line(0, 0, 10, 10, 2, 0xff0000, 1);
  check('line = 1 quad', HudBatch.quads === 2);
  HudBatch.ring(50, 50, 10, 2, '#00ff00', 1);
  check('full ring = 48 segments', HudBatch.quads === 2 + HUD_RING_SEGMENTS);
  HudBatch.quads = 0;
  HudBatch.ring(50, 50, 10, 2, '#00ff00', 1, 0, Math.PI);
  check('half ring = 24 segments', HudBatch.quads === HUD_RING_SEGMENTS / 2);
  HudBatch.quads = 0;
  const width = HudBatch.text('A B', 0, 0, 20, '#ffffff', 'left');
  check('text: one quad per visible glyph', HudBatch.quads === (HudBatch.atlas ? 2 : 0), HudBatch.quads);
  check('text width scales with size', Test.near(HudBatch.measure('A B', 40), width * 2, 1e-3));
  check('colour bytes packed', hudColors[16] === 255 && hudColors[19] === 255);
  HudBatch.quads = HUD_MAX_QUADS;
  HudBatch.dropped = 0;
  HudBatch.rect(0, 0, 1, 1, '#ffffff', 1);
  check('full buffer drops quads instead of overflowing', HudBatch.dropped === 1 && HudBatch.quads === HUD_MAX_QUADS);
  const order = [];
  HudBatch.addLayer('test-b', 20, (hud) => { order.push('b'); hud.rect(0, 0, 1, 1, '#fff', 1); });
  HudBatch.addLayer('test-a', 10, (hud) => { order.push('a'); hud.rect(0, 0, 1, 1, '#fff', 1); hud.rect(0, 0, 1, 1, '#fff', 1); });
  collectHudLayers(1 / 60);
  const layerA = HudBatch.layers.find((layer) => layer.name === 'test-a'), layerB = HudBatch.layers.find((layer) => layer.name === 'test-b');
  check('layers draw in order with their own ranges', order.join('') === 'ab' && layerA.count === 2 && layerB.count === 1 && layerB.start === layerA.start + 2);
  removeTestHudLayers();
  check('layers can be removed', !HudBatch.layers.some((layer) => layer.name.startsWith('test-')));
  HudBatch.quads = 0;
});

// ---- GPU frame: budgets, render scale, direct mode (needs a WebGL2 context) ----
Test.add('render', (check) => withRenderer(() => {
  if (!Render.gl) { check.skip('GPU checks', 'no WebGL2 context on this page'); return; }
  const gl = Render.gl, result = DebugApi.renderDemo('glacier');
  const quality = Render.quality;
  check('demo frame within the draw-call cap', result.stats.drawCalls > 0 && result.stats.drawCalls <= quality.drawCalls, result.stats.drawCalls);
  check('demo frame within the triangle cap', result.stats.triangles > 0 && result.stats.triangles <= quality.triangles, result.stats.triangles);
  check('no GL error after a frame', gl.getError() === gl.NO_ERROR);
  Settings.set('video.renderScale', 0.5);
  Render.drawFrame(1 / 60, 1);
  check('render scale sizes the scene target', Render.target.width === Math.max(1, Math.round(Render.size.width * 0.5)) && !Render.target.direct);
  Settings.set('video.quality', 'low');
  Settings.set('video.renderScale', 1);
  Render.drawFrame(1 / 60, 1);
  check('Low at full scale draws straight to the canvas (no post pass)', Render.target.direct);
  renderFrameHook(1 / 60, 1);
  check('Perf counters filled', Perf.counters.drawCalls > 0 && Perf.counters.triangles > 0 && Perf.counters.renderScale === 1);
  Settings.set('video.quality', 'high');
  Render.drawFrame(1 / 60, 1);
  check('High uses MSAA when the device has it (REN-008)', Render.target.samples === Math.min(2, Render.maxSamples) && !Render.target.direct);
  // R-154: the sun shadow map renders before the scene target is bound, so a tile GPU binds (and loads) the target once a frame
  const sceneTarget = Render.target.msaaFramebuffer || Render.target.framebuffer, bind = gl.bindFramebuffer;
  let sceneBinds = 0;
  gl.bindFramebuffer = function (kind, framebuffer) { if (framebuffer === sceneTarget && kind !== gl.READ_FRAMEBUFFER) sceneBinds++; return bind.call(this, kind, framebuffer); };
  try { Render.drawFrame(1 / 60, 1); } finally { delete gl.bindFramebuffer; }
  check('High binds the scene target once a frame', SunShadow.active && sceneBinds === 1, sceneBinds);
  check('no GL error after resizing targets', gl.getError() === gl.NO_ERROR);
  check('GPU memory estimate under 64 MB (PERF-005)', Render.gpuMemoryBytes() < 64 * 1024 * 1024, Render.gpuMemoryBytes());
  // A resize or a rotation: the very next frame already projects with the new aspect (no stretched frame).
  const resized = (css) => { Render.canvas.style.cssText = css; Render.size.dirty = true; Render.drawFrame(1 / 60, 1); return Render.frame.projection[5] / Render.frame.projection[0]; };
  const aspect = resized('width:400px;height:200px');
  resized('');
  check('a resize reaches the same frame', Test.near(aspect, 2, 0.02), aspect);
}));

// ---- Context loss and restore (PLT-005) ----
Test.add('render', (check) => withRenderer(async () => {
  check('the WebGL2 screen has an iPhone line', /iOS.*Lockdown Mode/.test(WEBGL_FATAL_TEXT));
  const extension = Render.gl && Render.gl.getExtension('WEBGL_lose_context');
  if (!extension) { check.skip('context-loss checks', 'no WEBGL_lose_context'); return; }
  World.load(makeDemoArena('station'));
  let toasts = 0;
  const listener = Bus.on('toast', () => { toasts++; });
  Game.state = 'playing';
  extension.loseContext();
  check('context loss pauses the game and toasts', await waitUntil(() => Render.lost, 3000) && Game.paused && toasts === 1);
  check('a lost context draws nothing', Render.drawFrame(1 / 60, 1) === false);
  extension.restoreContext();
  check('restore rebuilds GPU resources and resumes', await waitUntil(() => !Render.lost, 5000) && !Game.paused && toasts === 2);
  check('world mesh re-uploaded after restore', WorldMesh.vertexArray !== null && Render.drawFrame(1 / 60, 1) && Render.gl.getError() === Render.gl.NO_ERROR);
  Bus.off('toast', listener);
  // No restore in time: the save is written and the fatal screen offers Reload. A quit during the loss forgets its pause,
  // a match started during it waits, and a restore after the Reload screen leaves the match paused behind it.
  const fatal = document.getElementById('fatal'), waitMs = Render.restoreWaitMs, saveNow = Save.saveNow;
  let writes = 0;
  Save.saveNow = function () { writes++; return saveNow.call(this); };
  // Long enough for the quit below to finish before the wait ends, even under load.
  Render.restoreWaitMs = 1000;
  const setHidden = (value) => { Object.defineProperty(document, 'hidden', { value, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); };
  try {
    // Phones drop a background tab's context and give it back on return: the wait counts visible time only.
    setHidden(true);
    extension.loseContext();
    await waitUntil(() => Render.lost, 3000);
    await new Promise((resolve) => setTimeout(resolve, Render.restoreWaitMs + 300));
    check('a hidden page waits for the restore', !fatal.classList.contains('show'));
    setHidden(false);
    // Quit without the menu screens.
    Game.headless = true;
    Bus.emit('match.stop', null);
    Game.state = 'menu'; Game.paused = false; writes = 0;
    check('a quit during the loss forgets its pause', !Render.pausedForLoss);
    Game.state = 'playing';
    renderFrameHook(1 / 60, 1);
    check('a match started during the loss waits', Game.paused && Game.pauseReason === 'graphics' && Render.pausedForLoss);
    check('no restore in time: save written, Reload screen', await waitUntil(() => fatal.classList.contains('show'), 3000) && writes > 0 && !!fatal.querySelector('button'), writes);
    extension.restoreContext();
    check('a late restore hides the Reload screen, keeps the pause', await waitUntil(() => !Render.lost, 5000) && Game.paused && Game.pauseReason === 'graphics'
      && !fatal.classList.contains('show') && !document.getElementById('fatal-reload'));
  } finally {
    delete document.hidden;
    Save.saveNow = saveNow; Render.restoreWaitMs = waitMs;
    hideGraphicsLost();
  }
}));

// ---- Frame-time dynamic resolution without a GPU timer (PERF-007 hysteresis on GPU-bound phones) ----
// Simulated device: vsync holds at scale <= 0.7, every higher scale misses it (33 ms frames).
Test.add('render', (check) => withRenderer(() => {
  GpuTimer.extension = null;
  Settings.set('video.quality', 'medium');
  Render.size.scale = 0.7;
  updateRenderScale(1 / 60);
  let drops = 0, secondsAbove = 0, previous = Render.size.scale;
  for (let frame = 0; frame < 600 * 60; frame++) {
    const interval = Render.size.scale > 0.7 + 1e-4 ? 1 / 30 : 1 / 60;
    if (interval > 1 / 60) secondsAbove += interval;
    updateRenderScale(interval);
    if (Render.size.scale < previous) drops++;
    previous = Render.size.scale;
  }
  check('raise/drop oscillation settles (at most 6 stutters in 10 minutes)', drops >= 1 && drops <= 6, drops);
  check('the scale settles at the highest one that holds vsync', Test.near(Render.size.scale, 0.7, 1e-4), Render.size.scale);
  check('time spent missing vsync stays small', secondsAbove < 8, secondsAbove);
  Settings.set('video.quality', 'low');
  updateRenderScale(1 / 60);
  check('a preset change forgets the ceiling', ScaleControl.ceiling === 1 && ScaleControl.ceilingWait === SCALE_CEILING_WAIT_SECONDS);
}));

// ---- Step-down (PERF-013) on a CPU-bound device that has the GPU timer ----
Test.add('render', (check) => withRenderer(() => {
  Game.state = 'playing';
  Settings.set('video.autoQuality', 'high');
  GpuTimer.extension = GpuTimer.extension || { TIME_ELAPSED_EXT: 0 };
  GpuTimer.lastMs = 2;                    // GPU well within budget: a lower scale cannot help
  Render.size.scale = 1;
  ScaleControl.smoothedMs = 40;
  for (let i = 0; i < 5; i++) updateStepDown(1);
  check('CPU-bound with the GPU timer: steps down even above the scale floor', Render.quality.id === 'medium', Render.quality.id);
  GpuTimer.lastMs = 9;                    // GPU over budget: lowering the resolution comes first
  Render.size.scale = 1;
  for (let i = 0; i < 6; i++) updateStepDown(1);
  check('GPU-bound with the GPU timer: resolution is lowered first', Render.quality.id === 'medium', Render.quality.id);
  ScaleControl.smoothedMs = FRAME_BUDGET_MS;
}));

// ---- Actor LOD tiers, low-rate far animation, blob shadows and the sun shadow map split ----
Test.add('render', (check) => withRenderer(() => {
  Settings.set('video.quality', 'medium');
  placeCamera(0, 1.6, 0, 0, 0);
  const quality = Render.quality;
  const distant = makeTestActor(ACTOR_KIND.BOT, 0, 0, quality.lodFar + 5);
  fillActors(1 / 60, 1);
  check('past lodFar: a still 4-part silhouette', batchInstances(actorBatch) === DEFAULT_DISTANT_PARTS.length && DEFAULT_DISTANT_PARTS.length === 4, batchInstances(actorBatch));
  Actors.alive[distant] = 0;
  const far = makeTestActor(ACTOR_KIND.BOT, 0, 0, quality.lodNear + 5);
  Actors.vz[far] = 5;
  let changes = 0;
  for (let i = 0; i < FAR_ANIMATION_STRIDE * 3; i++) {
    const before = actorPhase[far];
    fillActors(1 / 60, 1);
    if (actorPhase[far] !== before) changes++;
  }
  check('far LOD animates at a low rate (every 4th frame)', changes === 3, changes);
  Actors.alive[far] = 0;
  const near = makeTestActor(ACTOR_KIND.BOT, 1, 0, 5);
  fillActors(1 / 60, 1);
  check('Medium: blob shadow, no sun shadow map', shadowBatch.counts[SHAPE_INDEX.disc] === 1 && Render.frame.shadowOn === 0);
  Settings.set('video.quality', 'high');
  updateSunShadow();
  fillActors(1 / 60, 1);
  check('High: actors inside the sun shadow map drop the blob', SunShadow.active && Render.frame.shadowOn === 1 && shadowBatch.counts[SHAPE_INDEX.disc] === 0);
  Game.playerId = near;
  Render.cameraOverride = null;
  updateCamera(1 / 60, 1);
  fillActors(1 / 60, 1);
  check('High: the local player keeps a blob shadow (MIS-037)', shadowBatch.counts[SHAPE_INDEX.disc] === 1);
  shadowBatch.clear();
  for (let i = 0; i < shadowBatch.capacity; i++) shadowBatch.mesh('disc', 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0);
  const lastSlot = instanceOffset(shadowBatch, 'disc', shadowBatch.capacity - 1);
  shadowBatch.data[lastSlot + STRENGTH_SLOT] = 0.5;
  check('a full batch returns -1', shadowBatch.mesh('disc', 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0) === -1);
  emitActorShadow(near, readActorPosition(near, 1), 1);
  check('a dropped blob shadow never overwrites another instance', shadowBatch.data[lastSlot + STRENGTH_SLOT] === 0.5);
  Actors.flags[near] = 0;
  Actors.y[near] = Actors.prevY[near] = 50;
  shadowBatch.clear();
  emitActorShadow(near, readActorPosition(near, 1), 1);
  check('no ground below in range: no blob shadow', shadowBatch.counts[SHAPE_INDEX.disc] === 0);
}));

// ---- Particle pools: dead pools are skipped, live counts drive the stats ----
Test.add('render', (check) => withRenderer(() => {
  Fx.burst('spark', 0, 1, 0, 0, 1, 0, 10);
  updateLights();
  check('live particles counted per frame', particlePool.live === 10 && Render.stats.particles === 10);
  check('the pool remembers its last death time', particlePool.lastDeath > Render.frame.time);
  Render.frame.time = particlePool.lastDeath + 1;
  updateLights();
  check('after the last death nothing is live', particlePool.live === 0 && particlePool.used === 10);
}));

// ---- GPU: sun shadow pass only on presets with shadows 'sun', Potato memory, failed restore ----
Test.add('render', (check) => withRenderer(() => {
  if (!Render.gl) { check.skip('GPU checks', 'no WebGL2 context on this page'); return; }
  const gl = Render.gl;
  DebugApi.renderDemo('ruins');
  Settings.set('video.quality', 'high');
  const before = SunShadow.frames;
  Render.drawFrame(1 / 60, 1);
  check('High renders the sun shadow map (REN-004)', SunShadow.frames === before + 1 && SunShadow.size === SHADOW_MAP_SIZE && gl.getError() === gl.NO_ERROR);
  Settings.set('video.quality', 'medium');
  Render.drawFrame(1 / 60, 1);
  check('Medium skips it and frees the map', SunShadow.frames === before + 1 && SunShadow.size === 1 && gl.getError() === gl.NO_ERROR);
  Settings.set('video.quality', 'potato');
  Render.drawFrame(1 / 60, 1);
  check('GPU memory estimate under 32 MB on Potato (PERF-005)', Render.gpuMemoryBytes() < 32 * 1024 * 1024, Render.gpuMemoryBytes());
  Fx.clear();
  Fx.burst('spark', 0, 1, 0, 0, 1, 0, 10);
  let draws = Render.stats.drawCalls;
  drawPool(gl, particlePool);
  check('a pool with live particles is drawn', Render.stats.drawCalls === draws + 1);
  Render.frame.time += 100;
  draws = Render.stats.drawCalls;
  drawPool(gl, particlePool);
  check('a pool whose particles are all dead costs no draw call', Render.stats.drawCalls === draws && gl.getError() === gl.NO_ERROR);
}));

Test.add('render', (check) => withRenderer(() => {
  if (!Render.gl) { check.skip('restore-failure check', 'no WebGL2 context on this page'); return; }
  const failing = { name: 'test-failing', create: () => { throw new Error('restore failed'); } };
  Render.gpuParts.push(failing);
  const logged = Test.expectErrors(() => handleContextRestored());
  Render.gpuParts.splice(Render.gpuParts.indexOf(failing), 1);
  const fatal = document.getElementById('fatal');
  check('a failed restore shows the WebGL2 message instead of a frozen screen (PLT-002)', logged === 1 && fatalShown && fatal.classList.contains('show') && !Render.ready);
  hideFatal();
  createGpuResources(Render.gl);
  Render.ready = true;
}));

// ---- Bake cost on a big map: 200 m, 400 random boxes and ramps (cells are clipped locally, so cost stays linear) ----
const STRESS_BAKE_MS = 1500;             // about 120 ms on a desktop CPU; the margin covers slow phones and CI
Test.add('render', (check) => {
  const random = makeRandom(7), brushes = [{ shape: 'box', min: [-100, -1, -100], max: [100, 0, 100] }];
  for (let i = 0; i < 400; i++) {
    const x = random.range(-95, 95), z = random.range(-95, 95);
    const max = [x + random.range(0.3, 6), random.range(0.5, 6), z + random.range(0.3, 6)];
    brushes.push({ shape: random.next() < 0.2 ? 'ramp' : 'box', dir: '+z', min: [x, 0, z], max, material: 'metal' });
  }
  const triangles = worldTriangles(brushes, 'canal');
  check('a 400-brush map bakes in bounded time', WorldMesh.bakeMs < STRESS_BAKE_MS, Math.round(WorldMesh.bakeMs) + ' ms, ' + triangles + ' triangles');
  check('a 400-brush map fits the Low triangle budget', triangles < CAT.quality.byId('low').triangles, triangles);
  World.clear(); clearWorldMesh();
});
