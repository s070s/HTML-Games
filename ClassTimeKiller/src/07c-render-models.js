// Code-drawn static models: data rows of instanced shapes (MODEL_SCHEMA in 03b, no downloaded assets) compiled once at load
// into flat typed arrays and drawn by one generic function into any shape batch through one reused instance record
// (PERF-006: no allocation and no float arguments on the draw path). Users: gear (03r gearModels: 12a pickups, 12c grenades,
// 12d devices, 13g loot and beacons), weapons (03b viewModels and 03q weaponModels: the 07e view model, the weapon an actor
// holds, 12a weapon pickups) and projectiles (03q projectileModels, 11b). Animated actor bodies are rigs, not static models
// (07c-render-actors ActorModels); they share the LOD rule (LOD, lodFor there) and the palette and glow constants here.
//
// Part: { shape (default box), offset [x, y, z] centre, size [x, y, z] full size, rotation [yaw, pitch] degrees (+ pitch tips
// the front up), tint, lod, mirror: true (a second copy at -x), role (MODEL_ROLES, 03b-data-animations: the part a reload moves) }. Model space in metres: x = right, y = up, z = forward; the
// pose's mirror -1 turns it into shape space, where local +X is left (DATA-002).
// tint: body (the caller's colour, or the row's own color) | shade (body darkened) | accent (the row's accent colour, else
// body) | glow (the row's glow colour, else body; self-lit) | shine (accent, self-lit) | a MODEL_PALETTE name.
// lod: 2 = the silhouette, drawn at every distance; 1 = near and far (the default); 0 = near only (small details: presets
// without modelDetail, Potato, skip them even near).

// name: [colour, self-lit share]. Actor bodies (03b actorParts, 03s) use the same names.
const MODEL_PALETTE = {
  dark: ['#2a2e33', 0], steel: ['#8d959e', 0], metal: ['#a0a8b0', 0], white: ['#f2f2ee', 0], black: ['#141618', 0],
  red: ['#d83030', 0], brass: ['#d0a640', 0], wood: ['#7a5434', 0], bone: ['#e4d9bf', 0], skin: ['#d6b79a', 0],
  cloth: ['#6b6250', 0], visor: ['#9fe8ff', 0.8], lamp: ['#ff3a2a', 1], light: ['#fff2b0', 1], cyan: ['#6fe0ff', 1], flame: ['#ff8a2a', 1],
};
const MODEL_TINT = { body: -1, shade: -2, accent: -3, glow: -4, shine: -5 };   // palette tints are >= 0 (their MODEL_PALETTE index)
const MODEL_PALETTE_NAMES = Object.keys(MODEL_PALETTE);
const MODEL_PALETTE_INDEX = {};
const MODEL_PALETTE_RGB = new Float32Array(MODEL_PALETTE_NAMES.length * 4);   // r g b self-lit per palette entry
MODEL_PALETTE_NAMES.forEach((name, index) => {
  MODEL_PALETTE_INDEX[name] = index;
  writeColor(MODEL_PALETTE_RGB, index * 4, MODEL_PALETTE[name][0]);
  MODEL_PALETTE_RGB[index * 4 + 3] = MODEL_PALETTE[name][1];
});
const MODEL_SHADE = 0.55;                 // shade tint = body x this
const MODEL_GLOW = 0.7;                   // self-lit share of glow and shine parts (more washes their colour out to white)
const MODEL_PALETTE_GLOW_SHARE = 0.5;     // palette parts take this share of the caller's glow (details stay readable)
const MODEL_PART_FLOATS = 8;              // ox oy oz sx sy sz yaw pitch
const MODEL_COLOR = { body: 0, accent: 3, glow: 6 };   // offsets in a model's colors
const MODEL_MAX_FROM_DEPTH = 4;
const MODEL_MUZZLE_TIE = 0.004;           // parts whose front end is this close to the foremost one share the muzzle (twin barrels): its x and y are their mean
const MODEL_SHAPES = new Set(SHAPES);
const MODEL_NO_LOOK = { color: -1, accent: '', glow: '', pose: null };
const MODEL_ROLE_MOVE_FLOATS = 6;         // per role in ModelPose.roleMove: x y z (model units), pitch, roll (radians), hide (1 = not drawn)
const NO_ROLE_MOVE = new Float32Array(MODEL_ROLES.length * MODEL_ROLE_MOVE_FLOATS);   // all zero (the slot of role 0 stays zero for good): no part moves

// Where and how one model is drawn: built by a constructor (see ShapeInstance), one record per caller, reused. originY /
// originZ = the model point placed at (x, y, z); r g b = the body colour; emissive = a glow floor; highlight = ACC-006; roll = the
// whole model turned about its forward axis (radians, + = top to the right seen from behind); glow = the share of the glow
// tints' self-light (P6 cell charge); roleMove = the moves of the parts with a role (see NO_ROLE_MOVE); only = a role: draw
// just the parts of that role (the spare magazine of a reload), 0 = all.
function ModelPose() {
  this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.pitch = 0; this.scale = 1; this.mirror = -1; this.originY = 0; this.originZ = 0;
  this.r = 1; this.g = 1; this.b = 1; this.emissive = 0; this.highlight = 0; this.roll = 0; this.glow = 1; this.only = 0; this.roleMove = NO_ROLE_MOVE;
}
const makeModelPose = () => new ModelPose();
const modelInstance = makeShapeInstance();
const modelTurn = new Float64Array(6);   // cos / sin of the pose yaw, pitch and roll, once per model (a typed array: no boxed floats)
const modelPoint = new Float64Array(3);  // placeModelPoint's input: the point in model units, the pose's origin already taken off

// ---- Load-time compile ----
const modelScaled = (values, scale, axis) => values.map((value, index) => value * (typeof scale === 'number' ? scale : scale[axis[index]]));
const MODEL_AXES = [0, 1, 2], MODEL_AXES_TURNED = [0, 2, 1];   // a part pitched past 45 degrees has its size y along z

function normalizeModelPart(part) {
  return { shape: part.shape || 'box', offset: part.offset || [0, 0, 0], size: part.size, rotation: part.rotation || [0, 0],
    tint: part.tint || 'body', lod: part.lod === undefined ? LOD.far : part.lod, mirror: part.mirror === true, role: part.role || '' };
}

// A copied part times the row's scale (a number or [x, y, z]) and with its tint swapped by recolor.
function copyModelPart(part, scale, recolor) {
  const turned = Math.abs(part.rotation[1]) > 45 && Math.abs(part.rotation[1]) < 135;
  return Object.assign({}, part, { offset: modelScaled(part.offset, scale, MODEL_AXES),
    size: modelScaled(part.size, scale, turned ? MODEL_AXES_TURNED : MODEL_AXES), tint: recolor[part.tint] || part.tint });
}

// The row's parts with `from` resolved: the from row's parts (minus drop indexes, scaled, recoloured), then its own.
function modelParts(row, source, depth) {
  if (depth > MODEL_MAX_FROM_DEPTH) throw new Error('model ' + row.id + ': from chain too deep');
  const from = source(row.from);
  if (row.from && !from) throw new Error('model ' + row.id + ': unknown from ' + row.from);
  const drop = row.drop || [], scale = row.scale || 1, recolor = row.recolor || {};
  const copied = from ? modelParts(from, source, depth + 1).filter((part, index) => !drop.includes(index)).map((part) => copyModelPart(part, scale, recolor)) : [];
  return copied.concat((row.parts || []).map(normalizeModelPart));
}

// A colour field from the row, else along its from chain; `none` when no row sets it.
function modelField(row, source, field, none) {
  for (let current = row; current; current = source(current.from)) if (current[field] !== undefined && current[field] !== none) return current[field];
  return none;
}

const mirrorModelPart = (part) => Object.assign({}, part, { offset: [-part.offset[0], part.offset[1], part.offset[2]], rotation: [-part.rotation[0], part.rotation[1]] });

// look: the defaults where the row and its from chain set nothing ({ color, accent, glow, pose }; MODEL_NO_LOOK). Every field is
// worked out (and every part checked) before the model record is made, so all records start with their final field types.
function compileModel(row, source, look) {
  const parts = modelParts(row, source, 0).flatMap((part) => (part.mirror ? [part, mirrorModelPart(part)] : [part]))
    .sort((a, b) => b.lod - a.lod);   // silhouette first: each LOD draws a prefix
  const tints = new Int8Array(parts.length), roles = new Uint8Array(parts.length);
  for (let index = 0; index < parts.length; index++) { tints[index] = modelTintCode(row.id, parts[index]); roles[index] = modelRoleCode(row.id, parts[index]); }
  const data = modelPartData(parts);
  const lodCounts = Uint8Array.of(parts.length, parts.filter((part) => part.lod >= LOD.far).length, parts.filter((part) => part.lod >= LOD.distant).length);
  const colors = new Float32Array(9), own = writeModelColors(colors, row, source, look), size = measureModel(data, lodCounts[LOD.far] || parts.length);
  return { id: row.id, parts, count: parts.length, shapes: parts.map((part) => part.shape), tints, roles, data, lodCounts, colors,
    ownColor: own.color, ownAccent: own.accent, ownGlow: own.glow, pose: look.pose, spin: row.spin || 0, tumble: row.tumble || 0,
    centerZ: size.centerZ, top: size.top, muzzle: measureMuzzle(row, data, lodCounts[LOD.far] || parts.length) };
}

// The muzzle (P2-03) in model space [x, y, z]: the row's own `muzzle`, else the front end of the foremost silhouette and far
// parts (the barrel tip; details with lod 0 such as sights stay out), twin barrels averaged. Only weapon rows read it.
function measureMuzzle(row, data, count) {
  if (row.muzzle) return Float32Array.from(row.muzzle);
  const fronts = new Float32Array(count);
  let front = -Infinity;
  for (let part = 0; part < count; part++) {
    const o = part * MODEL_PART_FLOATS, turned = Math.abs(data[o + 7]) > Math.PI / 4;
    fronts[part] = data[o + 2] + (turned ? data[o + 4] : data[o + 5]) / 2;
    front = Math.max(front, fronts[part]);
  }
  let x = 0, y = 0, tied = 0;
  for (let part = 0; part < count; part++) {
    if (fronts[part] < front - MODEL_MUZZLE_TIE) continue;
    x += data[part * MODEL_PART_FLOATS]; y += data[part * MODEL_PART_FLOATS + 1]; tied++;
  }
  return tied ? Float32Array.of(x / tied, y / tied, front) : new Float32Array(3);
}

// A part's tint code (MODEL_TINT, else its palette index); an unknown shape or tint throws.
function modelTintCode(id, part) {
  if (!MODEL_SHAPES.has(part.shape)) throw new Error('model ' + id + ': unknown shape ' + part.shape);
  const tint = MODEL_TINT[part.tint] !== undefined ? MODEL_TINT[part.tint] : MODEL_PALETTE_NAMES.indexOf(part.tint);
  if (tint === -1 && part.tint !== 'body') throw new Error('model ' + id + ': unknown tint ' + part.tint);
  return tint;
}

// A part's role code (its index in MODEL_ROLES); an unknown role throws.
function modelRoleCode(id, part) {
  const code = MODEL_ROLES.indexOf(part.role);
  if (code < 0) throw new Error('model ' + id + ': unknown role ' + part.role);
  return code;
}

function modelPartData(parts) {
  const data = new Float32Array(parts.length * MODEL_PART_FLOATS);
  parts.forEach((part, index) => {
    const o = index * MODEL_PART_FLOATS;
    data[o] = part.offset[0]; data[o + 1] = part.offset[1]; data[o + 2] = part.offset[2];
    data[o + 3] = part.size[0]; data[o + 4] = part.size[1]; data[o + 5] = part.size[2];
    data[o + 6] = part.rotation[0] * DEG; data[o + 7] = part.rotation[1] * DEG;
  });
  return data;
}

// Body: the row's own colour (it then wins over the caller's), else the look's (the default Models.paint copies); accent and glow
// likewise, else they follow the body colour at draw time. Returns which colours the model owns.
function writeModelColors(colors, row, source, look) {
  const color = modelField(row, source, 'color', -1), accent = modelField(row, source, 'accent', '') || look.accent, glow = modelField(row, source, 'glow', '') || look.glow;
  const own = { color: color >= 0, accent: accent !== '', glow: glow !== '' };
  if (own.color || look.color >= 0) writeColor(colors, MODEL_COLOR.body, own.color ? color : look.color);
  if (own.accent) writeColor(colors, MODEL_COLOR.accent, accent);
  if (own.glow) writeColor(colors, MODEL_COLOR.glow, glow);
  return own;
}

// centerZ = the middle of the first count parts' forward extent (a spinning pickup turns about it); top = their highest point
// (12d glint).
function measureModel(data, count) {
  let minZ = Infinity, maxZ = -Infinity, top = 0;
  for (let part = 0; part < count; part++) {
    const o = part * MODEL_PART_FLOATS, turned = Math.abs(data[o + 7]) > Math.PI / 4;
    const halfZ = (turned ? data[o + 4] : data[o + 5]) / 2, halfY = (turned ? data[o + 5] : data[o + 4]) / 2;
    minZ = Math.min(minZ, data[o + 2] - halfZ); maxZ = Math.max(maxZ, data[o + 2] + halfZ); top = Math.max(top, data[o + 1] + halfY);
  }
  return { centerZ: count ? (minZ + maxZ) / 2 : 0, top };
}

// ---- The one builder ----
const Models = {
  // rows (a MODEL_SCHEMA catalogue) -> { byId, list }. bases: a catalogue `from` may also name (null = none); lookOf(row): the
  // look defaults (MODEL_NO_LOOK when left out).
  compile(rows, bases, lookOf) {
    const rowsById = {}, byId = {};
    rows.forEach((row) => { rowsById[row.id] = row; });
    const source = (id) => (id ? rowsById[id] || (bases && bases.byId(id)) || null : null);
    rows.forEach((row) => { byId[row.id] = compileModel(row, source, lookOf ? lookOf(row) : MODEL_NO_LOOK); });
    return { byId, list: rows.map((row) => byId[row.id]) };
  },
  // The level a model at the pose gets from the camera and the quality preset (lodFor); -1 = past the view distance.
  levelOf(pose) {
    const camera = Render.camera, quality = Render.quality, dx = camera.x - pose.x, dy = camera.y - pose.y, dz = camera.z - pose.z;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    if (distanceSquared > quality.viewDistance * quality.viewDistance) return -1;
    return this.detailLevel(lodFor(distanceSquared, quality), quality);
  },
  // Near without the preset's modelDetail draws the far parts (no lod-0 details).
  detailLevel(level, quality) { return level === LOD.near && !quality.modelDetail ? LOD.far : level; },
  // The pose takes the model's default body colour (the weapon family or projectile colour, or the row's own).
  paint(pose, model) { pose.r = model.colors[0]; pose.g = model.colors[1]; pose.b = model.colors[2]; },
  // Draws the model at the pose by its distance.
  draw(batch, model, pose) {
    const level = this.levelOf(pose);
    if (level >= 0) this.drawLevel(batch, model, pose, level);
  },
  // Draws one LOD of the model: the pose's yaw and pitch turn it about (originY, originZ), scale multiplies it. Pitches add
  // because both turn about the same local X axis (exact for parts without a yaw of their own, which no pitched pose has).
  drawLevel(batch, model, pose, level) {
    const count = model.lodCounts[level];
    this.turnFor(pose);
    for (let part = 0; part < count; part++) this.drawPart(batch, model, part, pose);
  },
  turnFor(pose) {
    modelTurn[0] = Math.cos(pose.yaw); modelTurn[1] = Math.sin(pose.yaw); modelTurn[2] = Math.cos(pose.pitch); modelTurn[3] = Math.sin(pose.pitch);
    modelTurn[4] = Math.cos(pose.roll); modelTurn[5] = Math.sin(pose.roll);
  },
  // A part with a role also takes the pose's move of that role (a magazine dropping out, a slide going back, or hidden).
  drawPart(batch, model, part, pose) {
    const d = model.data, o = part * MODEL_PART_FLOATS, scale = pose.scale, mirror = pose.mirror, instance = modelInstance;
    const role = model.roles[part], moves = pose.roleMove, m = role * MODEL_ROLE_MOVE_FLOATS;
    if (pose.only !== 0 && role !== pose.only) return;
    if (moves[m + 5] !== 0) return;
    modelPoint[0] = d[o] + moves[m]; modelPoint[1] = d[o + 1] + moves[m + 1] - pose.originY; modelPoint[2] = d[o + 2] + moves[m + 2] - pose.originZ;
    placeModelPoint(pose);
    instance.sx = d[o + 3] * scale; instance.sy = d[o + 4] * scale; instance.sz = d[o + 5] * scale;
    instance.yaw = pose.yaw + d[o + 6] * mirror; instance.pitch = pose.pitch + d[o + 7] + moves[m + 3];
    this.tintPart(model, part, pose);
    const offset = batch.meshFrom(model.shapes[part], instance);
    if (!(offset >= 0)) return;   // -1 = refused (a test's stub batch returns nothing)
    if (pose.highlight) batch.data[offset + HIGHLIGHT_SLOT] = pose.highlight;
    if (role === 0 && pose.roll === 0) return;   // nothing rolls or moves: the slot is 0 already
    if (Math.abs(d[o + 7]) > Math.PI / 4) batch.data[offset + ROLL_SLOT] = moves[m + 4];   // a part turned to point forward is round about that axis: only its own roll (a spin) counts
    else batch.data[offset + ROLL_SLOT] = pose.roll + moves[m + 4];
  },
  // A shape that belongs to no model row (the off-hand, a spare with no part to copy): `loose` is a LooseShape (x y z in model units,
  // sizes in model units, yaw / pitch / roll radians in the model's frame, colour). turnFor(pose) ran for this pose already.
  drawLoose(batch, pose, loose) {
    const instance = modelInstance, scale = pose.scale;
    modelPoint[0] = loose.x; modelPoint[1] = loose.y - pose.originY; modelPoint[2] = loose.z - pose.originZ;
    placeModelPoint(pose);
    instance.sx = loose.sx * scale; instance.sy = loose.sy * scale; instance.sz = loose.sz * scale;
    instance.yaw = pose.yaw + loose.yaw * pose.mirror; instance.pitch = pose.pitch + loose.pitch;
    instance.r = loose.r; instance.g = loose.g; instance.b = loose.b; instance.emissive = loose.emissive;
    const offset = batch.meshFrom(loose.shape, instance);
    if (offset >= 0) batch.data[offset + ROLL_SLOT] = loose.roll;
  },
  tintPart(model, part, pose) {
    const instance = modelInstance, tint = model.tints[part];
    if (tint >= 0) {
      const p = tint * 4;
      instance.r = MODEL_PALETTE_RGB[p]; instance.g = MODEL_PALETTE_RGB[p + 1]; instance.b = MODEL_PALETTE_RGB[p + 2];
      instance.emissive = Math.max(MODEL_PALETTE_RGB[p + 3], pose.emissive * MODEL_PALETTE_GLOW_SHARE);
      return;
    }
    const lit = tint === MODEL_TINT.glow || tint === MODEL_TINT.shine, share = tint === MODEL_TINT.shade ? MODEL_SHADE : 1;
    const source = modelColorSource(model, tint), colors = model.colors;
    if (source < 0) { instance.r = pose.r * share; instance.g = pose.g * share; instance.b = pose.b * share; }
    else { instance.r = colors[source] * share; instance.g = colors[source + 1] * share; instance.b = colors[source + 2] * share; }
    instance.emissive = lit ? Math.max(MODEL_GLOW * pose.glow, pose.emissive) : pose.emissive;
  },
};

// The point in modelPoint (model units) as it lands in the world at the pose: scale, mirror, roll about the model's forward axis, then pitch about local X and yaw
// (rotateInPlace) into modelInstance.x y z.
function placeModelPoint(pose) {
  const scale = pose.scale, cy = modelTurn[0], sy = modelTurn[1], cp = modelTurn[2], sp = modelTurn[3], cr = modelTurn[4], sr = modelTurn[5];
  const sideways = modelPoint[0] * scale * pose.mirror, upward = modelPoint[1] * scale, z = modelPoint[2] * scale;
  const x = sideways * cr - upward * sr, y = sideways * sr + upward * cr;
  const turnedY = y * cp + z * sp, turnedZ = -y * sp + z * cp;
  modelInstance.x = pose.x + x * cy + turnedZ * sy; modelInstance.y = pose.y + turnedY; modelInstance.z = pose.z - x * sy + turnedZ * cy;
}

// One loose shape for Models.drawLoose, built by a constructor like ShapeInstance (its float fields stay unboxed).
function LooseShape() {
  this.shape = 'box'; this.x = 0; this.y = 0; this.z = 0; this.sx = 0.1; this.sy = 0.1; this.sz = 0.1; this.yaw = 0; this.pitch = 0; this.roll = 0;
  this.r = 1; this.g = 1; this.b = 1; this.emissive = 0;
}
const makeLooseShape = () => new LooseShape();

// The model colour a tint reads (a MODEL_COLOR offset), -1 = the pose's colour.
function modelColorSource(model, tint) {
  if (tint === MODEL_TINT.glow && model.ownGlow) return MODEL_COLOR.glow;
  if ((tint === MODEL_TINT.accent || tint === MODEL_TINT.shine) && model.ownAccent) return MODEL_COLOR.accent;
  return model.ownColor ? MODEL_COLOR.body : -1;
}

// ---- Weapon and projectile models (03b viewModels class rows, 03q) ----
const MODEL_FALLBACK_POSE = 'rifle';
const CLASS_MODEL_COLOR = 0x56606b;                // the class rows' body colour (a weapon without its own model row)
const HELD_MODEL_SCALE = 1.3;                      // metres per model unit for the weapon an actor holds (a rifle is about 0.85 m)
const HELD_GRIP_Z = 0.13;                          // model z at the centre of the actor's 'gun' part (the grip sits behind it)
const HELD_GRIP_Y = -0.07;                         // model y there: the weapon rides on top of the forearms, not inside them
const PICKUP_MODEL_SCALE = 1.4;                    // weapon pickups are drawn a little larger than held weapons
const PICKUP_MODEL_GLOW = 0.12, PICKUP_POWER_MODEL_GLOW = 0.45;   // a pickup's glow floor: plain, power weapon (parts keep their shading)

// S11 fills it: fn(id) -> the CAT.weapons index the actor holds (the one being raised while it swaps), -1 = none (a plain gun part).
Render.heldWeapon = null;

// The viewModels row giving hold / ADS / kick: the row's pose, else its from row's, else the weapon class.
function weaponPoseRow(row, classId) {
  if (row.pose) return CAT.viewModels.byId(row.pose);
  const from = row.from ? CAT.weaponModels.byId(row.from) || CAT.viewModels.byId(row.from) : null;
  if (from) return from.hold ? from : weaponPoseRow(from, classId);
  return CAT.viewModels.byId(classId) || CAT.viewModels.byId(MODEL_FALLBACK_POSE);
}
function weaponLook(row) {
  const weapon = CAT.weapons.byId(row.id), pose = weaponPoseRow(row, weapon ? weapon.class : MODEL_FALLBACK_POSE);
  return { color: weapon ? weapon.family.color : CLASS_MODEL_COLOR, accent: pose.accent, glow: pose.glow, pose };
}
function projectileLook(row) {
  const projectile = CAT.projectiles.byId(row.id);
  return { color: projectile ? projectile.color : CLASS_MODEL_COLOR, accent: '', glow: '', pose: null };
}

// byId: view-model lookup by weapon id, else by class (the viewModels rows); weapon / projectile: by catalogue index.
const WeaponModels = { byId: {}, weapon: [], projectile: [] };
const CLASS_MODELS = Models.compile(CAT.viewModels, null, (row) => ({ color: CLASS_MODEL_COLOR, accent: '', glow: '', pose: row }));
const OWN_WEAPON_MODELS = Models.compile(CAT.weaponModels, CAT.viewModels, weaponLook);
const PROJECTILE_MODELS = Models.compile(CAT.projectileModels, null, projectileLook);
Object.assign(WeaponModels.byId, CLASS_MODELS.byId);
CAT.weapons.forEach((weapon) => {
  const model = OWN_WEAPON_MODELS.byId[weapon.id] || CLASS_MODELS.byId[weapon.class] || CLASS_MODELS.byId[MODEL_FALLBACK_POSE];
  WeaponModels.byId[weapon.id] = model;
  WeaponModels.weapon[weapon.index] = model;
});
CAT.projectiles.forEach((projectile, index) => { WeaponModels.projectile[index] = PROJECTILE_MODELS.byId[projectile.id] || null; });

// ---- Held weapons (third person) and weapon pickups ----
const HELD_GUN_PART = CAT.actorParts.byId('gun');
const heldPose = makeModelPose(), weaponPickupPose = makeModelPose();

// The model of the weapon an actor holds, or null (no S11 hook, no weapon): the actor then draws its plain gun part.
function heldWeaponModel(id) {
  const index = Render.heldWeapon && HELD_GUN_PART ? Render.heldWeapon(id) : -1;
  return index >= 0 ? WeaponModels.weapon[index] || null : null;
}

// Drawn at the 'gun' actor part (its pivot, aim and crouch). A held weapon is small: one LOD coarser than its actor.
function drawHeldWeapon(model, pose, style, lod) {
  const held = heldPose;
  placeActorPart(HELD_GUN_PART, pose, style);
  held.x = pose.x + rotated.x; held.y = pose.y + rotated.y; held.z = pose.z + rotated.z; held.yaw = pose.yaw; held.pitch = rotated.pitch;
  held.scale = style.scale * HELD_MODEL_SCALE; held.originY = HELD_GRIP_Y; held.originZ = HELD_GRIP_Z;
  Models.paint(held, model);
  held.emissive = style.emissive; held.highlight = actorHighlight;
  held.roleMove = ActorAction.moving ? ActorAction.roleMove : NO_ROLE_MOVE;   // a reload moves the weapon's magazine on near bodies (07g)
  Models.drawLevel(actorBatch, model, held, lod + 1);
}

// A weapon pickup at a placed instance record (12a: position, spin yaw), turning about the model's middle; power = a power weapon.
function drawWeaponPickup(batch, weaponIndex, instance, power) {
  const model = WeaponModels.weapon[weaponIndex], pose = weaponPickupPose;
  if (!model) return;
  pose.x = instance.x; pose.y = instance.y; pose.z = instance.z; pose.yaw = instance.yaw;
  pose.scale = PICKUP_MODEL_SCALE; pose.originZ = model.centerZ;
  Models.paint(pose, model);
  pose.emissive = power ? PICKUP_POWER_MODEL_GLOW : PICKUP_MODEL_GLOW;
  Models.draw(batch, model, pose);
}
