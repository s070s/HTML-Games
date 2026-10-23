// Self-tests for the body models (03s actorModels, 07c ActorModels, picked by 13d; group 'render') and the
// showActorModelGallery scene (visual checks, through __CTK.models.gallery).

const MODEL_TINTS = ['team', 'teamDark', 'model', 'modelDark', 'modelGlow', ...MODEL_PALETTE_NAMES];
const MODEL_MAX_ADDED_PARTS = 9;         // compact rows: a row adds at most this many parts to its base
const MODEL_MAX_NEAR_PARTS = 18;         // the closest LOD of any model
const MODEL_GALLERY_SPACING = 1.15;      // metres between the actors of the gallery line
const MODEL_GALLERY_Z = -8;              // the line stands on the open floor of the demo arena

// showActorModelGallery(kind, yaw, qualityId): the demo arena with every model of one kind ('' = all) in a line in front
// of a fixed camera, alternating teams; yaw turns them (default PI: facing the camera; 0 shows their backs). Returns the
// model ids from left to right.
function showActorModelGallery(kind, yaw, qualityId) {
  Benchmark.active = false; Benchmark.done = true;
  if (qualityId) Settings.set('video.quality', qualityId);
  Game.stop();
  Actors.clear();
  Render.worldQuery = Render.worldQuery || World;
  World.load(makeDemoArena());
  const rows = CAT.actorModels.filter((row) => !kind || row.kind === kind), half = (rows.length - 1) / 2;
  rows.forEach((row, index) => {
    const id = makeTestActor(ACTOR_KIND.BOT, index % 2, (half - index) * MODEL_GALLERY_SPACING, MODEL_GALLERY_Z);
    Actors.yaw[id] = Actors.prevYaw[id] = yaw === undefined ? Math.PI : yaw;
    ActorModels.set(id, row.kind, row.id);
  });
  Render.cameraOverride = (camera) => { camera.x = 0; camera.y = 1.5; camera.z = MODEL_GALLERY_Z - 5.6; camera.yaw = 0; camera.pitch = -0.06; camera.roll = 0; return true; };
  document.getElementById('overlay').style.display = 'none';
  Render.drawFrame(1 / 60, 1);
  return rows.map((row) => row.id);
}

// ---- Catalogue: every hero, preset class and dressed ruleset has its own valid, compact model ----
Test.add('render', (check) => {
  const find = (kind, id) => CAT.actorModels.find((row) => row.kind === kind && row.id === id);
  check('row 0 is the default body', CAT.actorModels[0].kind === 'default' && CAT.actorModels[0].index === 0 && ActorModels.lists[0][LOD.near].length === NEAR_PARTS.length);
  check('every hero has its own model', CAT.heroes.every((hero) => find('hero', hero.id)), CAT.heroes.filter((hero) => !find('hero', hero.id)).map((hero) => hero.id).join());
  check('every preset class has its own model', CAT.classes.every((row) => find('class', row.id)));
  check('ruleset models name real rulesets', CAT.actorModels.every((row) => row.kind !== 'ruleset' || CAT.rulesets.byId(row.id)));
  check('model kinds are known', CAT.actorModels.every((row) => ['default', 'hero', 'class', 'ruleset'].includes(row.kind)));
  const parts = [].concat(...CAT.actorModels.map((row) => row.parts));
  const triple = (value) => Array.isArray(value) && value.length === 3 && value.every((number) => Number.isFinite(number));
  check('model parts use known shapes and tints', parts.every((part) => SHAPE_INDEX[part.shape] !== undefined && MODEL_TINTS.includes(part.tint || 'team')));
  check('model parts have positive sizes and 3D offsets', parts.every((part) => triple(part.size) && part.size.every((size) => size > 0) && triple(part.offset) && triple(part.pivot)));
  check('model parts use only part fields', parts.every((part) => Object.keys(part).every((field) => field in ACTOR_PART_SCHEMA)));
  const baseOf = (row) => (row.base ? ActorModels.bodies[CAT.actorModels.byId(row.base).index] : NEAR_PARTS);
  const named = (row, id) => baseOf(row).some((part) => part.id === id);
  check('drops and changes name base parts', CAT.actorModels.every((row) => row.drop.every((id) => named(row, id)) && Object.keys(row.change).every((id) => named(row, id))));
  check('a base is an earlier row', CAT.actorModels.every((row) => !row.base || (CAT.actorModels.byId(row.base) && CAT.actorModels.byId(row.base).index < row.index)));
  check('rows stay compact', CAT.actorModels.every((row) => row.parts.length <= MODEL_MAX_ADDED_PARTS && ActorModels.bodies[row.index].length <= MODEL_MAX_NEAR_PARTS));
  check('every model but the default adds or changes parts', CAT.actorModels.every((row) => row.index === 0 || row.parts.length > 0));
  const lists = ActorModels.lists;
  check('LOD part counts shrink: near > plain or equal, far = 6 (REN-002), distant 4', lists.every((list) => list[LOD.near].length > list[LOD.far].length
    && list[MODEL_LIST_PLAIN].length <= list[LOD.near].length && list[LOD.far].length === 6 && list[LOD.distant].length === 4));
  const signature = (body) => JSON.stringify(body.map((part) => [part.shape, part.pivot, part.offset, part.size, part.tilt, part.tint]));
  const signatures = new Set(ActorModels.bodies.map(signature));
  check('every model has its own silhouette', signatures.size === CAT.actorModels.length);
});

// ---- Picking: the hero, else the class, else the ruleset's model, else the default body (13d on spawn) ----
Test.add('render', (check) => {
  const bots = [{ dummy: true, team: 0 }, { dummy: true, team: 1 }, { dummy: true, team: 1 }];
  const modelOf = (id) => CAT.actorModels[ActorModels.index[id]];
  const everyActor = (test) => { for (let id = 0; id < Actors.count; id++) if (Actors.kind[id] !== ACTOR_KIND.NONE && !test(id)) return false; return true; };
  Game.start({ mode: 'tdm', seed: 1, bots, player: { name: 'Me', team: 0 }, ruleset: 'heroes' });
  check('hero matches: everyone wears the model of their hero', everyActor((id) => modelOf(id).kind === 'hero' && modelOf(id).id === Abilities.hero[id].id));
  Economy.switchHero(Game.playerId, 'mirelle');
  check('a hero switch in the spawn room changes the body at once', modelOf(Game.playerId).id === Abilities.hero[Game.playerId].id);
  Game.stop();
  Game.start({ mode: 'tdm', seed: 1, bots, player: { name: 'Me', team: 0 }, ruleset: 'modern' });
  check('class matches: everyone wears the model of their class', everyActor((id) => modelOf(id).kind === 'class' && modelOf(id).id === classModelId(Loadouts.classFor(id))));
  Game.stop();
  check('a custom class wears the preset class of the same primary weapon class', classModelId({ id: 'class-1', primary: 'scattergun' }) === 'breacher'
    && classModelId({ id: 'class-2', primary: 'heron' }) === '');
  Game.start({ mode: 'tdm', seed: 1, bots, player: { name: 'Me', team: 0 }, ruleset: 'tactical' });
  check('dressed rulesets: everyone wears the ruleset model', everyActor((id) => modelOf(id).kind === 'ruleset' && modelOf(id).id === 'tactical'));
  Game.stop();
  Game.start({ mode: 'ffa', seed: 1, bots, player: { name: 'Me' }, ruleset: 'classic' });
  check('other rulesets: the default body', everyActor((id) => ActorModels.index[id] === 0));
  Game.stop();
});

// ---- Drawing: LOD lists, Potato detail, tints, first person ----
Test.add('render', (check) => withRenderer(() => {
  placeCamera(0, 1.6, 0, 0, 0);
  const row = CAT.actorModels.byId('bastide'), lists = ActorModels.lists[row.index];
  const near = makeTestActor(ACTOR_KIND.BOT, 1, 0, 5);
  ActorModels.set(near, 'hero', 'bastide');
  fillActors(1 / 60, 1);
  check('a model draws its near part list', batchInstances(actorBatch) === lists[LOD.near].length, batchInstances(actorBatch));
  writeColor(tintColor, 0, CAT.teamColors[1].color);
  check('the torso keeps the team colour', Test.near(actorBatch.data[instanceOffset(actorBatch, 'box', 0) + 8], tintColor[0], 1e-6));
  const palette = Render.teamPalette;
  Render.teamPalette = ['#000000', '#ffffff'];
  fillActors(1 / 60, 1);
  check('colour-blind palettes reach the torso', Test.near(actorBatch.data[instanceOffset(actorBatch, 'box', 0) + 8], 1, 1e-6));
  Render.teamPalette = palette;
  const colors = new Float32Array(3);
  writeColor(colors, 0, row.color);
  const modelTinted = lists[LOD.near].filter((part) => part.tint === 'model' && part.shape === 'box').length;
  let found = 0;
  for (let i = 0; i < actorBatch.counts[SHAPE_INDEX.box]; i++) if (Test.near(actorBatch.data[instanceOffset(actorBatch, 'box', i) + 8], colors[0], 1e-6)) found++;
  check('model-tinted parts wear the row colour', modelTinted > 0 && found >= modelTinted, found + ' of ' + modelTinted);
  Settings.set('video.quality', 'potato');
  fillActors(1 / 60, 1);
  check('Potato skips the detail parts', batchInstances(actorBatch) === lists[MODEL_LIST_PLAIN].length && lists[MODEL_LIST_PLAIN].length < lists[LOD.near].length);
  Settings.set('video.quality', 'medium');
  Actors.z[near] = Actors.prevZ[near] = Render.quality.lodNear + 10;
  fillActors(1 / 60, 1);
  check('the far LOD draws the 6 far parts', batchInstances(actorBatch) === 6);
  Actors.z[near] = Actors.prevZ[near] = 5;
  Game.playerId = near;
  Render.cameraOverride = null;
  updateCamera(1 / 60, 1);
  fillActors(1 / 60, 1);
  check('first person: the local body model is not drawn into its own camera', batchInstances(actorBatch) === 0 && shadowBatch.counts[SHAPE_INDEX.disc] === 1);
}));

// R-210: a frame of every body model on High fits the actor and shadow batches (nothing dropped).
Test.add('render', (check) => withRenderer(() => {
  Settings.set('video.quality', 'high');
  placeCamera(0, 1.6, 0, 0, 0);
  CAT.actorModels.forEach((row, index) => ActorModels.set(makeTestActor(ACTOR_KIND.BOT, index % 2, (index % 6) - 3, 4 + Math.floor(index / 6) * 2), row.kind, row.id));
  Render.stats.droppedInstances = 0;
  fillActors(1 / 60, 1);
  check('every body model fits one frame of the batches', Render.stats.droppedInstances === 0 && batchInstances(actorBatch) > CAT.actorModels.length, Render.stats.droppedInstances);
  Settings.set('video.quality', 'medium');
}));

// PERF-006: drawing every body model allocates nothing per frame.
Test.add('render', (check) => withRenderer(() => {
  if (!perfHeapCounterWorks()) { check.skip('body model allocation probe', 'no exact heap counter on this page'); return; }
  placeCamera(0, 1.6, 0, 0, 0);
  CAT.actorModels.forEach((row, index) => {
    const id = makeTestActor(ACTOR_KIND.BOT, index % 2, (index % 6) - 3, 4 + Math.floor(index / 6) * 2);
    Actors.vx[id] = 3;
    ActorModels.set(id, row.kind, row.id);
  });
  const bytes = perfAllocatedBytes(() => fillActors(1 / 60, 1));
  check('drawing every body model allocates nothing', bytes < PERF_ALLOC_LIMIT_BYTES, Math.round(bytes / 1024) + ' KB over ' + PERF_ALLOC_CALLS + ' frames');
}));
