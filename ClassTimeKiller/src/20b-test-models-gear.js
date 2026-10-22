// Self-tests for the gear models (03r gearModels, 07c-render-models Models; group 'models'): every item, powerup, gadget and ammo type has
// its own valid model, LODs shrink, the draw allocates nothing. showGearGallery(group) shows a group's models in a row grid
// (through __CTK.models.gallery, 20b-test-render).

const GEAR_GALLERY_GROUPS = {
  items: () => CAT.items.map((row) => row.code).concat(CAT.gearModels.filter((row) => row.id.startsWith('ammo-')).map((row) => row.id)),
  powerups: () => CAT.powerups.map((row) => row.code),
  thrown: () => CAT.gadgets.filter((row) => row.kind === 'thrown').map((row) => row.code),
  devices: () => CAT.gadgets.filter((row) => row.kind !== 'thrown').map((row) => row.code),
};
// [model id, colour]: the colour of the item, powerup or gadget row with that code (ammo boxes have their own).
function gearGalleryEntry(id) {
  const row = CAT.items.concat(CAT.powerups, CAT.gadgets).find((candidate) => candidate.code === id);
  return [id, row ? row.color : 0xffffff];
}
const GEAR_GALLERY_COLUMNS = 6;
const gearGallery = { entries: [], spacing: 1, scale: 1, yaw: 0.6, floor: 0, registered: false };
const gearGalleryPose = makeModelPose();

function drawGearGallery(batch) {
  if (!World.map || World.map.id !== 'gear-gallery') return;
  const pose = gearGalleryPose, gallery = gearGallery;
  gallery.entries.forEach((entry, index) => {
    const column = index % GEAR_GALLERY_COLUMNS, row = Math.floor(index / GEAR_GALLERY_COLUMNS);
    pose.x = ((GEAR_GALLERY_COLUMNS - 1) / 2 - column) * gallery.spacing; pose.z = row * gallery.spacing;   // camera right = -x
    pose.y = gallery.floor; pose.yaw = gallery.yaw; pose.scale = gallery.scale; pose.emissive = 0.2;
    writeColor(tintColor, 0, entry[1]); pose.r = tintColor[0]; pose.g = tintColor[1]; pose.b = tintColor[2];
    Models.draw(batch, GEAR_MODELS.byId[entry[0]], pose);
  });
}

// Debug: a flat floor, the group's models (a group name or a list of model ids; x scale) in rows of 6 (left to right, near to far) and their ids printed per row on the HUD.
function showGearGallery(group, yaw, scale) {
  const devices = group === 'devices', gallery = gearGallery;
  gallery.entries = (Array.isArray(group) ? group : (GEAR_GALLERY_GROUPS[group] || GEAR_GALLERY_GROUPS.items)()).map(gearGalleryEntry);
  gallery.spacing = devices ? 2.6 : 1.4; gallery.scale = scale || (devices ? 1 : group === 'thrown' ? 3 : 1.4); gallery.floor = devices ? 0 : 0.5; gallery.yaw = yaw === undefined ? 1.2 : yaw;
  Benchmark.active = false; Benchmark.done = true;
  Game.stop(); Actors.clear();
  Render.worldQuery = Render.worldQuery || World;
  World.load({ id: 'gear-gallery', theme: 'station', brushes: [{ shape: 'box', min: [-30, -1, -10], max: [30, 0, 30], material: 'concrete' }] });
  const rows = Math.ceil(gallery.entries.length / GEAR_GALLERY_COLUMNS), depth = (rows - 1) * gallery.spacing;
  const cameraZ = -gallery.spacing * 2.8, cameraY = gallery.spacing * 2.6, pitch = -Math.atan2(cameraY - gallery.floor, depth / 2 - cameraZ);
  Render.cameraOverride = (camera) => { camera.x = 0; camera.y = cameraY; camera.z = cameraZ; camera.yaw = 0; camera.pitch = pitch; camera.roll = 0; return true; };
  if (!gallery.registered) {
    gallery.registered = true;
    Render.addSource('gearGallery', drawGearGallery);
    HudBatch.addLayer('gear-gallery', 0, (hud) => {
      if (!World.map || World.map.id !== 'gear-gallery') return;
      for (let row = 0; row * GEAR_GALLERY_COLUMNS < gallery.entries.length; row++) {
        const ids = gallery.entries.slice(row * GEAR_GALLERY_COLUMNS, (row + 1) * GEAR_GALLERY_COLUMNS).map((entry) => entry[0]).join('  ');
        hud.text('row ' + (row + 1) + ': ' + ids, 12, 16 + row * 18, 14, '#ffffff', 'left');
      }
    });
  }
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.style.display = 'none';
  return gallery.entries.map((entry) => entry[0]).join(' ');
}

// Every gear row of the game has its own model in the catalogue (no fallback shape is ever drawn).
Test.add('models', (check) => {
  const missing = [];
  CAT.items.concat(CAT.powerups, CAT.gadgets).forEach((row) => { if (!GEAR_MODELS.byId[row.code]) missing.push(row.code); });
  CAT.weapons.forEach((weapon) => { if (weapon.ammoType && !AMMO_MODELS[weapon.ammoType]) missing.push('ammo ' + weapon.ammoType); });
  check('every item, powerup, gadget and ammo type has a gear model', missing.length === 0, missing.join(', '));
  check('the pickup and gadget model tables are complete', PICKUP_MODELS.every((models) => models.every(Boolean)) && GADGET_MODELS.every(Boolean));
  check('the gear catalogue is valid data', Data.validate('gearModels').length === 0, Data.validate('gearModels').join(' / '));
});

// Compact, valid parts and shrinking LODs; no two models are the same.
Test.add('models', (check) => {
  const bad = [], seen = new Map();
  GEAR_MODELS.list.forEach((model) => {
    const counts = model.lodCounts, sizes = model.parts.every((part) => part.size.every((value) => value > 0 && value <= 2));
    if (model.id !== 'rune' && (model.count < 3 || model.count > 9)) bad.push(model.id + ': ' + model.count + ' parts');
    if (!(counts[0] >= counts[1] && counts[1] >= counts[2] && counts[2] >= 1)) bad.push(model.id + ': lod ' + counts.join('/'));
    if (!sizes || !model.shapes.every((shape) => SHAPES.includes(shape))) bad.push(model.id + ': part shape or size');
    const key = Array.from(model.data).join(',') + '|' + Array.from(model.tints).join(',');
    if (seen.has(key)) bad.push(model.id + ' = ' + seen.get(key));
    seen.set(key, model.id);
  });
  check('every gear model has 3-9 valid parts, LOD counts that shrink, and no copy', bad.length === 0, bad.slice(0, 6).join(', '));
  const dropsDetail = GEAR_MODELS.list.filter((model) => model.lodCounts[1] < model.lodCounts[0]).length;
  check('most models carry near-only detail parts', dropsDetail >= GEAR_MODELS.list.length / 2, dropsDetail);
  let refused = false;
  try { Models.compile([{ id: 'x', parts: [{ shape: 'teapot', size: [1, 1, 1] }] }]); } catch (error) { refused = true; }
  check('a part with an unknown shape is refused at compile time', refused);
  const heal = GEAR_MODELS.byId.I02, kit = GEAR_MODELS.byId.I14;
  check('a row built from another copies its parts with its own tints', kit.count === heal.count && Array.from(kit.data).join() === Array.from(heal.data).join() && kit.tints.join() !== heal.tints.join());
});

// LOD by distance and preset: near draws every part, far the far parts, past lodFar the silhouette, past the view nothing;
// Potato draws no detail even near.
Test.add('models', (check) => {
  const recorder = meshRecorder(), model = GEAR_MODELS.byId.G15, pose = makeModelPose(), camera = Render.camera, quality = Render.quality;
  const cameraX = camera.x, cameraY = camera.y, cameraZ = camera.z;
  const drawn = (distance, preset) => {
    Render.quality = CAT.quality.byId(preset);
    camera.x = 0; camera.y = 0; camera.z = 0; pose.x = distance; recorder.meshes.length = 0;
    Models.draw(recorder, model, pose);
    return recorder.meshes.length;
  };
  const high = CAT.quality.byId('high'), counts = [drawn(1, 'high'), drawn(high.lodNear + 1, 'high'), drawn(high.lodFar + 1, 'high'), drawn(high.viewDistance + 1, 'high'), drawn(1, 'potato')];
  Render.quality = quality; camera.x = cameraX; camera.y = cameraY; camera.z = cameraZ;
  check('the turret draws 8 / far / silhouette / 0 parts by distance', counts[0] === model.count && counts[1] === model.lodCounts[1] && counts[2] === model.lodCounts[2] && counts[3] === 0, counts.join(' '));
  check('Potato drops the detail parts near the camera', counts[4] === model.lodCounts[1] && counts[4] < counts[0], counts[4]);
});

// The I08 box shows the local player's held weapon's ammo type; pickups, grenades and devices draw their models.
Test.add('models', (check) => {
  ItemArena.start({}, [ItemArena.spot('ammobox', 3, 0), ItemArena.spot('healthpack', 6, 0)]);
  const id = ItemArena.actor(0, -6, 0), weapon = CAT.weapons.find((row) => row.ammoType === 'shells');
  Weapons.give(id, weapon.id); Weapons.current[id] = weapon.index;
  Game.playerId = id;
  const heldModel = weapon && AMMO_MODELS[weapon.ammoType] ? AMMO_MODELS[weapon.ammoType] : GEAR_MODELS.byId.I08;
  check('the ammo box shows the held weapon ammo type', !!weapon && weapon.ammoType !== '' && ammoModelFor(id) === heldModel, weapon && weapon.id);
  check('without a player the ammo box shows its own model', ammoModelFor(-1) === GEAR_MODELS.byId.I08);
  const recorder = meshRecorder(), camera = Render.camera, cameraX = camera.x, cameraY = camera.y, cameraZ = camera.z;
  camera.x = 0; camera.y = 1.6; camera.z = 0;
  Items.draw(recorder);
  camera.x = cameraX; camera.y = cameraY; camera.z = cameraZ;
  const levelAt = (x) => Models.levelOf({ x, y: 0.5, z: 0 });
  const expected = 2 + heldModel.lodCounts[levelAt(3)] + GEAR_MODELS.byId.I02.lodCounts[levelAt(6)];   // two base discs and the two models
  check('pickups draw their gear models', recorder.meshes.length === expected, recorder.meshes.length + ' / ' + expected);
  Game.playerId = -1;
});

// Royale armor, heal and ammo loot spots draw the vest, the consumable they give and the held weapon's ammo box.
Test.add('models', (check) => {
  const recorder = meshRecorder(), instance = makeShapeInstance(), camera = Render.camera, cameraX = camera.x, cameraY = camera.y, cameraZ = camera.z;
  camera.x = 0; camera.y = 1.6; camera.z = 0;
  royaleAmmoModel = ammoModelFor(-1);
  const groups = [LOOT_GROUP.ARMOR, LOOT_GROUP.HEALTH, LOOT_GROUP.AMMO], medkit = CAT.items.byId('medkit');
  groups.forEach((group, spot) => { RoyaleLoot.group[spot] = group; RoyaleLoot.rarity[spot] = LOOT_CONSUMABLES.indexOf('medkit'); });
  groups.forEach((group, spot) => drawLootModel(recorder, spot, instance));
  camera.x = cameraX; camera.y = cameraY; camera.z = cameraZ;
  const expected = LOOT_ARMOR_MODEL.count + GEAR_MODELS.byId[medkit.code].count + GEAR_MODELS.byId.I08.count;
  check('royale loot spots draw their gear models', recorder.meshes.length === expected, recorder.meshes.length + ' / ' + expected);
});

// PERF-006: drawing models allocates nothing once compiled (integer arguments only, one reused pose).
Test.add('models', (check) => {
  if (!perfHeapCounterWorks()) { check.skip('model allocation probe', 'no exact heap counter on this page'); return; }
  const pose = makeModelPose(), list = GEAR_MODELS.list;
  const bytes = perfAllocatedBytes((i) => {
    if (i % 16 === 0) propBatch.clear();
    pose.x = i % 7; pose.yaw = i % 5;
    Models.draw(propBatch, list[i % list.length], pose);
  });
  propBatch.clear();
  check('drawing gear models allocates nothing', bytes < PERF_ALLOC_LIMIT_BYTES, Math.round(bytes / 1024) + ' KB');
});
