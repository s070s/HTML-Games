// Code-drawn models (03q weaponModels / projectileModels, with the 03b viewModels class rows as bases and fallbacks). Every row
// is resolved once at load into flat part lists per LOD; one generic builder draws any of them into any shape batch through one
// reused instance record (PERF-006: no allocation, no float arguments). Users: the view model (07e), the weapon an actor holds
// (07c actors, through the Render.heldWeapon hook), projectiles (11b) and weapon pickups (12a).

const MODEL_PALETTE = { dark: '#2b2f35', steel: '#8d959e', wood: '#7a5434', bone: '#e4d9bf' };
const MODEL_LOD = { full: 0, near: 1, far: 2 };   // full = the view model; near = without fine parts; far = the row's leading parts
const MODEL_COARSE_QUALITY = 'potato';             // this preset's view model skips the fine parts too
const MODEL_FALLBACK_POSE = 'rifle';
const HELD_MODEL_SCALE = 1.3;                      // metres per model unit for the weapon an actor holds (a rifle is about 0.85 m)
const HELD_GRIP_Z = 0.13;                          // model z at the centre of the actor's 'gun' part (the grip sits behind it)
const HELD_GRIP_Y = -0.07;                         // model y there: the weapon rides on top of the forearms, not inside them
const PICKUP_MODEL_SCALE = 1.4;                    // weapon pickups are drawn a little larger than held weapons
const PICKUP_MODEL_GLOW = 0.12, PICKUP_POWER_MODEL_GLOW = 0.45;   // a pickup's glow floor: plain, power weapon (parts keep their shading)
const MODEL_GLOW = 0.5;                            // self-lit share of glow parts: brighter washes their colour out to white
const modelTint = new Float32Array(3);

// S11 fills it: fn(id) -> the CAT.weapons index the actor holds (the one being raised while it swaps), -1 = none (a plain gun part).
Render.heldWeapon = null;

// One resolved part: model-unit centre and full size, pitch in radians (axis 'z' included), colour or `body` (the frame's colour).
// A constructor, not a literal, so the draw loop reads fixed float fields (see ShapeInstance).
function ModelPart(part, tints) {
  const tint = part.tint || 'body';
  this.shape = part.shape || 'box';
  this.x = part.offset[0]; this.y = part.offset[1]; this.z = part.offset[2];
  this.sx = part.size[0]; this.sy = part.size[1]; this.sz = part.size[2];
  this.pitch = ((part.pitch || 0) - (part.axis === 'z' ? 90 : 0)) * DEG;
  this.body = tint === 'body';
  writeColor(modelTint, 0, this.body ? 0 : tints[tint] || MODEL_PALETTE[tint] || tint);
  this.r = modelTint[0]; this.g = modelTint[1]; this.b = modelTint[2];
  this.emissive = tint === 'glow' || tint === 'shine' ? MODEL_GLOW : 0;
  this.fine = part.fine === true;
}

// Where a model sits in the world: the origin, angles, metres per model unit, mirror (-1 = model x right is actor-local -X,
// DATA-002), the model point (0, originY, originZ) placed at the origin, the body colour, an emissive floor and the ACC-006 highlight.
function ModelFrame() {
  this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.pitch = 0; this.scale = 1; this.mirror = -1; this.originY = 0; this.originZ = 0;
  this.r = 1; this.g = 1; this.b = 1; this.emissive = 0; this.highlight = 0;
}
const makeModelFrame = () => new ModelFrame();
const modelPoint = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
const modelInstance = makeShapeInstance();

// The one builder: every part rotated by the frame's yaw and pitch about the frame origin. Pitches add because both turn
// about the same local X axis (the view model's own pitch rides on the camera pitch this way).
function drawModelParts(batch, parts, frame) {
  const point = modelPoint, instance = modelInstance, scale = frame.scale;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    point.x = part.x * scale * frame.mirror; point.y = (part.y - frame.originY) * scale; point.z = (part.z - frame.originZ) * scale;
    point.yaw = frame.yaw; point.pitch = frame.pitch;
    rotateInPlace(point);
    instance.x = frame.x + point.x; instance.y = frame.y + point.y; instance.z = frame.z + point.z;
    instance.yaw = frame.yaw; instance.pitch = frame.pitch + part.pitch;
    instance.sx = part.sx * scale; instance.sy = part.sy * scale; instance.sz = part.sz * scale;
    instance.r = part.body ? frame.r : part.r; instance.g = part.body ? frame.g : part.g; instance.b = part.body ? frame.b : part.b;
    instance.emissive = Math.max(part.emissive, frame.emissive);
    const offset = batch.meshFrom(part.shape, instance);
    if (offset >= 0 && frame.highlight) batch.data[offset + HIGHLIGHT_SLOT] = frame.highlight;
  }
}

// Near or far LOD by the camera distance (the preset's lodNear, as for actors).
function modelLodOf(frame) {
  const camera = Render.camera, near = Render.quality.lodNear;
  return distanceSquared3(frame.x, frame.y, frame.z, camera.x, camera.y, camera.z) < near * near ? MODEL_LOD.near : MODEL_LOD.far;
}

// ---- Load-time resolution ----
const modelBaseOf = (row, catalogue) => (row.base ? catalogue.byId(row.base) || CAT.viewModels.byId(row.base) : null);

// A part scaled by a row's stretch [x, y, z]; an axis 'z' part keeps its length in size[1] and its height in size[2].
function stretchModelPart(part, stretch) {
  if (!stretch) return part;
  const size = part.axis === 'z' ? [part.size[0] * stretch[0], part.size[1] * stretch[2], part.size[2] * stretch[1]]
    : [part.size[0] * stretch[0], part.size[1] * stretch[1], part.size[2] * stretch[2]];
  return Object.assign({}, part, { offset: part.offset.map((value, axis) => value * stretch[axis]), size });
}

const mirrorModelPart = (part) => Object.assign({}, part, { offset: [-part.offset[0], part.offset[1], part.offset[2]] });

// The base's parts first (minus `drop`, scaled by `stretch`), then the row's own.
function modelPartList(row, catalogue) {
  const base = modelBaseOf(row, catalogue);
  if (!base) return row.parts;
  const inherited = modelPartList(base, catalogue).filter((part, index) => !row.drop.includes(index));
  return inherited.map((part) => stretchModelPart(part, row.stretch)).concat(row.parts);
}

// The viewModels row giving hold / ADS / kick: the row's pose, else its base's, else the weapon class.
function modelPoseRow(row, catalogue, classId) {
  if (row.pose) return CAT.viewModels.byId(row.pose);
  const base = modelBaseOf(row, catalogue);
  if (base) return base.hold ? base : modelPoseRow(base, catalogue, classId);
  return CAT.viewModels.byId(classId) || CAT.viewModels.byId(MODEL_FALLBACK_POSE);
}

// accent / glow: the row's own, else its base chain's, else the pose's (projectiles: the projectile colour).
function modelTintField(row, catalogue, field, fallback) {
  for (let current = row; current; current = modelBaseOf(current, catalogue)) if (current[field]) return current[field];
  return fallback;
}

// classId null = no view pose (projectiles): accent and glow then default to the colour.
function makeModel(row, catalogue, classId, color) {
  const pose = classId === null ? null : modelPoseRow(row, catalogue, classId);
  const tints = { accent: modelTintField(row, catalogue, 'accent', pose ? pose.accent : color), glow: modelTintField(row, catalogue, 'glow', pose ? pose.glow : color) };
  tints.shine = tints.accent;
  const full = modelPartList(row, catalogue).flatMap((part) => (part.mirror ? [part, mirrorModelPart(part)] : [part])).map((part) => new ModelPart(part, tints));
  const near = full.filter((part) => !part.fine);
  writeColor(modelTint, 0, color);
  return { id: row.id, pose, lods: [full, near, near.slice(0, Math.max(1, row.far || 2))], spin: row.spin || 0, tumble: row.tumble || 0,
    centerZ: modelCenterZ(near), r: modelTint[0], g: modelTint[1], b: modelTint[2] };
}

// The middle of the parts' forward extent: a spinning pickup turns about it.
function modelCenterZ(parts) {
  let min = Infinity, max = -Infinity;
  for (const part of parts) {
    const half = Math.abs(part.pitch) > Math.PI / 4 ? part.sy / 2 : part.sz / 2;
    min = Math.min(min, part.z - half); max = Math.max(max, part.z + half);
  }
  return parts.length ? (min + max) / 2 : 0;
}

// byId: view-model lookup by weapon id, else by class (the viewModels rows); weapon / projectile: by catalogue index.
const WeaponModels = { byId: {}, weapon: [], projectile: [] };
CAT.viewModels.forEach((row) => { WeaponModels.byId[row.id] = makeModel(row, CAT.viewModels, row.id, 0x56606b); });
CAT.weapons.forEach((weapon) => {
  const row = CAT.weaponModels.byId(weapon.id);
  const model = row ? makeModel(row, CAT.weaponModels, weapon.class, weapon.family.color) : WeaponModels.byId[weapon.class] || WeaponModels.byId[MODEL_FALLBACK_POSE];
  WeaponModels.byId[weapon.id] = model;
  WeaponModels.weapon[weapon.index] = model;
});
CAT.projectiles.forEach((projectile, index) => {
  const row = CAT.projectileModels.byId(projectile.id);
  WeaponModels.projectile[index] = row ? makeModel(row, CAT.projectileModels, null, projectile.color) : null;
});

// ---- Held weapons (third person) and weapon pickups ----
const HELD_GUN_PART = CAT.actorParts.byId('gun');
const heldFrame = makeModelFrame(), pickupFrame = makeModelFrame();

// The model of the weapon an actor holds, or null (no S11 hook, no weapon): the actor then draws its plain gun part.
function heldWeaponModel(id) {
  const index = Render.heldWeapon && HELD_GUN_PART ? Render.heldWeapon(id) : -1;
  return index >= 0 ? WeaponModels.weapon[index] || null : null;
}

// Drawn at the 'gun' actor part (its pivot, aim and crouch), near parts close up, the leading parts at the far LOD.
function drawHeldWeapon(model, pose, style, lod) {
  const frame = heldFrame;
  placeActorPart(HELD_GUN_PART, pose, style);
  frame.x = pose.x + rotated.x; frame.y = pose.y + rotated.y; frame.z = pose.z + rotated.z; frame.yaw = pose.yaw; frame.pitch = rotated.pitch;
  frame.scale = style.scale * HELD_MODEL_SCALE; frame.originY = HELD_GRIP_Y; frame.originZ = HELD_GRIP_Z;
  frame.r = model.r; frame.g = model.g; frame.b = model.b; frame.emissive = style.emissive; frame.highlight = actorHighlight;
  drawModelParts(actorBatch, model.lods[lod === LOD.near ? MODEL_LOD.near : MODEL_LOD.far], frame);
}

// A weapon pickup at a placed instance record (12a: position, spin yaw), turning about the model's middle; power = a power weapon.
function drawWeaponPickup(batch, weaponIndex, instance, power) {
  const model = WeaponModels.weapon[weaponIndex], frame = pickupFrame;
  if (!model) return;
  frame.x = instance.x; frame.y = instance.y; frame.z = instance.z; frame.yaw = instance.yaw; frame.pitch = 0;
  frame.scale = PICKUP_MODEL_SCALE; frame.originZ = model.centerZ;
  frame.r = model.r; frame.g = model.g; frame.b = model.b; frame.emissive = power ? PICKUP_POWER_MODEL_GLOW : PICKUP_MODEL_GLOW;
  drawModelParts(batch, model.lods[modelLodOf(frame)], frame);
}
