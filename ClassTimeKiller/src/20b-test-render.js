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
    Actors.x[id] = Actors.prevX[id] = row.x; Actors.y[id] = Actors.prevY[id] = row.y || 0; Actors.z[id] = Actors.prevZ[id] = row.z;
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
  Actors.x[id] = Actors.prevX[id] = 0; Actors.z[id] = Actors.prevZ[id] = -12;
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

const DEMO_WEAPONS = ['rifle', 'shotgun', 'sniper', 'rail', 'launcher', 'energy', 'heavy', 'smg'];
const demo = { emitter: false, sinceEffects: 0, weapon: 'rifle' };
// Builds a sample scene with world, 8 actors, effects, a player view model and a HUD layer; returns frame stats.
DebugApi.renderDemo = (themeId, weapon) => {
  Benchmark.active = false; Benchmark.done = true;
  Game.stop();
  World.load(makeDemoArena(themeId));
  spawnDemoActors();
  spawnDemoPlayer();
  demo.weapon = weapon || 'rifle';
  Render.viewModel = (out) => { out.visible = true; out.shape = demo.weapon; out.color = '#56606b'; return out; };
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

// ---- Test helpers ----
// Runs a block with the renderer switched on (headless off, benchmark parked) and restores every hook afterwards.
async function withRenderer(run) {
  const wasHeadless = Game.headless, benchmarkActive = Benchmark.active, benchmarkDone = Benchmark.done;
  Game.headless = false; Benchmark.active = false; Benchmark.done = true;
  try {
    return await run();
  } finally {
    Game.headless = wasHeadless; Benchmark.active = benchmarkActive; Benchmark.done = benchmarkDone;
    Render.cameraOverride = null; Render.viewModel = null; Render.actorStyle = null;
    Game.state = 'menu'; Game.paused = false; Game.playerId = -1;
    Actors.clear(); World.clear(); clearWorldMesh(); Fx.clear(); Settings.reset('video.');
  }
}

function placeCamera(x, y, z, yaw, pitch) {
  Render.cameraOverride = (camera) => { camera.x = x; camera.y = y; camera.z = z; camera.yaw = yaw; camera.pitch = pitch; camera.roll = 0; return true; };
  updateCamera(1 / 60, 1);
}

function makeTestActor(kind, team, x, z) {
  const id = Actors.create(kind, team, 'test');
  Actors.alive[id] = 1;
  Actors.x[id] = Actors.prevX[id] = x; Actors.z[id] = Actors.prevZ[id] = z;
  Actors.flags[id] = ACTOR_FLAG.ON_GROUND;
  return id;
}

const batchInstances = (batch) => batch.counts.reduce((sum, count) => sum + count, 0);
const instanceOffset = (batch, shape, index) => (SHAPE_INDEX[shape] * batch.capacity + index) * INSTANCE_FLOATS;
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

// ---- Data and contracts ----
Test.add('render', (check) => {
  const themes = ['foundry', 'ruins', 'station', 'canal', 'overgrowth', 'glacier'];
  check('six map themes (MAP-022)', CAT.themes.length === 6 && themes.every((id) => CAT.themes.byId(id)));
  const classes = ['sidearm', 'shotgun', 'rifle', 'smg', 'lmg', 'dmr', 'sniper', 'rail', 'launcher', 'energy', 'heavy', 'melee', 'tool', 'exotic', 'power'];
  check('view-model parts for all 15 weapon classes', classes.every((id) => CAT.viewModels.byId(id) && CAT.viewModels.byId(id).parts.length > 0));
  check('view-model parts use known shapes', CAT.viewModels.every((row) => row.parts.every((part) => SHAPE_INDEX[part.shape] !== undefined)));
  const kinds = ['spark', 'smoke', 'dust', 'blood', 'muzzle', 'explosion', 'energy', 'water', 'fire', 'frost', 'shock', 'heal'];
  check('a particle row for every Fx kind', kinds.every((id) => CAT.fxKinds.byId(id)));
  check('far actor LOD = 6 parts, near LOD more (REN-002)', FAR_PARTS.length === 6 && NEAR_PARTS.length > 6);
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
  const covered = worldTriangles([{ shape: 'box', min: [-2, -1, -2], max: [2, 0, 2] }, { shape: 'box', min: [0, 0, 0], max: [2, 1, 2] }]);
  check('faces covered by another brush are culled', covered === 32, covered);
  const overlap = worldTriangles([{ shape: 'box', min: [-2, -1, -2], max: [2, 0, 2] }, { shape: 'box', min: [0, -1, -2], max: [4, 0, 2] }]);
  check('coplanar overlapping faces are kept once (no z-fighting)', overlap === 32, overlap);
  const ramp = worldTriangles([{ shape: 'ramp', min: [0, 0, 0], max: [4, 2, 2], dir: '+x' }]);
  check('a ramp has no zero-area end face', ramp > 0 && ramp <= 12, ramp);
  check('world indices fit 16 bits for small maps', WorldMesh.indexData instanceof Uint16Array);
  World.clear(); clearWorldMesh();
});

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
  buildSunGrid(World.brushes);
  check('sun grid: open air lit, under the roof shaded', sampleSunVisibility(0, 1, 0) === 1 && sampleSunVisibility(-10, 1, 0) === 0);
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
}));

// ---- Actors (REN-002): LODs, interpolation, style hook, shadows ----
Test.add('render', (check) => withRenderer(() => {
  placeCamera(0, 1.6, 0, 0, 0);
  const near = makeTestActor(ACTOR_KIND.BOT, 1, 0, 5);
  const far = makeTestActor(ACTOR_KIND.BOT, 0, 0, Render.quality.lodNear + 10);
  makeTestActor(ACTOR_KIND.BOT, 0, 3, 5);
  Actors.alive[2] = 0;
  fillActors(1 / 60, 1);
  check('near LOD all parts + far LOD 6 parts, dead actors skipped', batchInstances(actorBatch) === NEAR_PARTS.length + FAR_PARTS.length, batchInstances(actorBatch));
  check('a blob shadow per live actor (MIS-037)', shadowBatch.counts[SHAPE_INDEX.disc] === 2);
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
  check('first person: no own body but own shadow', batchInstances(actorBatch) === FAR_PARTS.length && shadowBatch.counts[SHAPE_INDEX.disc] === 2);
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
  check('particles capped by quality (Potato 256)', particlePool.used === 256 && Fx.liveParticles() === 256, particlePool.used);
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
  check('particles expire on the GPU clock', Fx.liveParticles() === 0);
  updateLights();
  check('lights fade out', Render.frame.lightCount === 0);
}));

// ---- Dynamic resolution (PERF-007) ----
Test.add('render', (check) => {
  const control = { overSeconds: 0, underSeconds: 0, raiseWait: 2, sinceRaise: 1e9, smoothedMs: 16 };
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
  check('a drop right after a raise doubles the raise wait', control.raiseWait === 4 && scale === 0.95, control.raiseWait);
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
  ScaleControl.smoothedMs = 40;
  for (let i = 0; i < 4; i++) updateStepDown(1);
  check('no step-down before 5 s under 60 fps', Render.quality.id === 'high');
  updateStepDown(1);
  check('5 s under 60 fps lowers one preset and toasts', Settings.get('video.autoQuality') === 'medium' && toast.includes('Medium'), toast);
  Settings.set('video.autoLower', false);
  for (let i = 0; i < 6; i++) updateStepDown(1);
  check('the option turns the step-down off', Render.quality.id === 'medium');
  Settings.set('video.quality', 'potato');
  check('no step below Potato', !lowerQualityStep());
  Settings.set('video.quality', 'high');
  check('an explicit preset steps down itself', lowerQualityStep() && Settings.get('video.quality') === 'medium');
  Bus.off('toast', listener);
  ScaleControl.smoothedMs = FRAME_BUDGET_MS;
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
  placeCamera(0, 2, 0, 0, 0);
  fillViewModel();
  check('no view model while the camera is overridden', batchInstances(viewModelBatch) === 0);
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
  HudBatch.removeLayer('test-a'); HudBatch.removeLayer('test-b');
  check('layers can be removed', !HudBatch.layers.some((layer) => layer.name.startsWith('test-')));
  HudBatch.quads = 0;
});

// ---- GPU frame: budgets, render scale, direct mode (needs a WebGL2 context) ----
Test.add('render', (check) => withRenderer(() => {
  if (!Render.gl) { check('no WebGL2 context on this page: GPU checks skipped', true); return; }
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
  check('no GL error after resizing targets', gl.getError() === gl.NO_ERROR);
  check('GPU memory estimate under 64 MB (PERF-005)', Render.gpuMemoryBytes() < 64 * 1024 * 1024, Render.gpuMemoryBytes());
}));

// ---- Context loss and restore (PLT-005) ----
Test.add('render', (check) => withRenderer(async () => {
  const extension = Render.gl && Render.gl.getExtension('WEBGL_lose_context');
  if (!extension) { check('no WEBGL_lose_context: context-loss checks skipped', true); return; }
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
}));
