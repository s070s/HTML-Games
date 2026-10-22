// Part models: data rows of instanced shapes (no downloaded assets) compiled once into flat typed arrays and drawn by one
// generic function into any batch. A part is { shape, offset [x y z], size [x y z], rotation [yaw, pitch] degrees, tint, lod }
// (the actorParts / viewModels part shape). Offsets are metres from the model origin, +z = the model's forward.
// tint: body (the caller's colour, or the row's own `color`) | shade (body darkened) | glow (body, self-lit) | a MODEL_PALETTE name.
// lod: 2 = drawn at every distance (the silhouette), 1 = near and far (default), 0 = near only (detail; Potato drops it).
// A row may start from another row's parts: from (row id), scale (x the copied parts), recolor { tint: tint }, add (more parts).

const MODEL_PALETTE = {
  dark: ['#2a2e33', 0], metal: ['#a0a8b0', 0], white: ['#f2f2ee', 0], red: ['#d83030', 0], brass: ['#d0a640', 0], black: ['#141618', 0],
  wood: ['#8a6438', 0], lamp: ['#ff3a2a', 1], light: ['#fff2b0', 1], cyan: ['#6fe0ff', 1], flame: ['#ff8a2a', 1],
};
const MODEL_TINT = { body: -1, shade: -2, glow: -3 };   // palette tints are >= 0 (their index in MODEL_PALETTE_RGB)
const MODEL_PALETTE_NAMES = Object.keys(MODEL_PALETTE);
const MODEL_PALETTE_RGB = new Float32Array(MODEL_PALETTE_NAMES.length * 4);
MODEL_PALETTE_NAMES.forEach((name, index) => { writeColor(MODEL_PALETTE_RGB, index * 4, MODEL_PALETTE[name][0]); MODEL_PALETTE_RGB[index * 4 + 3] = MODEL_PALETTE[name][1]; });
const MODEL_SHADE = 0.55;                 // shade tint = body x this
const MODEL_GLOW = 0.9;                   // emissive of glow parts
const MODEL_PALETTE_GLOW_SHARE = 0.5;     // palette parts take this share of the caller's glow (details stay readable)
const MODEL_PART_FLOATS = 9;              // ox oy oz sx sy sz yaw pitch tint
const MODEL_LOD = { near: 0, far: 1, distant: 2 };
const MODEL_DETAIL_OFF_PRESET = 'potato';  // this preset draws no lod-0 detail parts, even near
const MODEL_SHAPES = new Set(SHAPES);

// Where and how one model is drawn: built by a constructor (see ShapeInstance), one record per caller, reused.
function ModelPose() {
  this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.scale = 1; this.r = 1; this.g = 1; this.b = 1; this.emissive = 0;
}
const modelInstance = makeShapeInstance();

// The row's parts with `from` resolved (copied parts scaled and recoloured), lod defaults applied, silhouette parts first.
function modelParts(row, rowsById, depth) {
  if (depth > 4) throw new Error('model ' + row.id + ': from chain too deep');
  const base = row.from ? modelParts(rowsById[row.from], rowsById, depth + 1) : [];
  const scale = row.scale || 1, recolor = row.recolor || {};
  const copied = base.map((part) => Object.assign({}, part, {
    offset: part.offset.map((value) => value * scale), size: part.size.map((value) => value * scale), tint: recolor[part.tint] || part.tint }));
  const own = (row.parts || []).concat(row.add || []).map((part) => ({
    shape: part.shape || 'box', offset: part.offset || [0, 0, 0], size: part.size, rotation: part.rotation || [0, 0],
    tint: part.tint || 'body', lod: part.lod === undefined ? MODEL_LOD.far : part.lod }));
  return copied.concat(own);
}

function compileModel(row, rowsById) {
  if (row.from && !rowsById[row.from]) throw new Error('model ' + row.id + ': unknown from ' + row.from);
  const parts = modelParts(row, rowsById, 0).sort((a, b) => b.lod - a.lod);
  const model = { id: row.id, parts, count: parts.length, lodCounts: new Uint8Array(3), shapes: parts.map((part) => part.shape),
    data: new Float32Array(parts.length * MODEL_PART_FLOATS), color: new Float32Array(3), ownColor: row.color >= 0 };
  if (model.ownColor) writeColor(model.color, 0, row.color);
  parts.forEach((part, index) => {
    const o = index * MODEL_PART_FLOATS, d = model.data;
    if (!MODEL_SHAPES.has(part.shape)) throw new Error('model ' + row.id + ': unknown shape ' + part.shape);
    const tint = MODEL_TINT[part.tint] !== undefined ? MODEL_TINT[part.tint] : MODEL_PALETTE_NAMES.indexOf(part.tint);
    if (tint === -1 && part.tint !== 'body') throw new Error('model ' + row.id + ': unknown tint ' + part.tint);
    d[o] = part.offset[0]; d[o + 1] = part.offset[1]; d[o + 2] = part.offset[2];
    d[o + 3] = part.size[0]; d[o + 4] = part.size[1]; d[o + 5] = part.size[2];
    d[o + 6] = part.rotation[0] * DEG; d[o + 7] = part.rotation[1] * DEG; d[o + 8] = tint;
  });
  // Parts are sorted silhouette first, so each LOD draws a prefix: near all, far lod >= 1, distant lod 2.
  model.lodCounts[MODEL_LOD.near] = parts.length;
  model.lodCounts[MODEL_LOD.far] = parts.filter((part) => part.lod >= MODEL_LOD.far).length;
  model.lodCounts[MODEL_LOD.distant] = parts.filter((part) => part.lod >= MODEL_LOD.distant).length;
  return model;
}

const Models = {
  // rows (a Data.define catalogue of { id, color, from, scale, recolor, parts, add }) -> { byId: { id: model } }.
  compile(rows) {
    const rowsById = {}, byId = {};
    rows.forEach((row) => { rowsById[row.id] = row; });
    rows.forEach((row) => { byId[row.id] = compileModel(row, rowsById); });
    return { byId, list: rows.map((row) => byId[row.id]) };
  },
  // The LOD a model at (x, y, z) gets from the camera and the quality preset; -1 = past the view distance (not drawn).
  levelAt(x, y, z) {
    const camera = Render.camera, quality = Render.quality, distanceSquared = distanceSquared3(camera.x, camera.y, camera.z, x, y, z);
    if (distanceSquared > quality.viewDistance * quality.viewDistance) return -1;
    if (distanceSquared >= quality.lodFar * quality.lodFar) return MODEL_LOD.distant;
    if (distanceSquared >= quality.lodNear * quality.lodNear || quality.id === MODEL_DETAIL_OFF_PRESET) return MODEL_LOD.far;
    return MODEL_LOD.near;
  },
  // Draws the model at the pose (yaw turns it about its origin, scale multiplies it). Allocation-free: floats stay local.
  draw(batch, model, pose) {
    const level = this.levelAt(pose.x, pose.y, pose.z);
    if (level < 0) return;
    const count = model.lodCounts[level];
    for (let part = 0; part < count; part++) this.drawPart(batch, model, part, pose);
  },
  drawPart(batch, model, part, pose) {
    const d = model.data, o = part * MODEL_PART_FLOATS, scale = pose.scale, yaw = pose.yaw;
    const cos = Math.cos(yaw), sin = Math.sin(yaw), x = d[o] * scale, z = d[o + 2] * scale;
    const instance = modelInstance;
    instance.x = pose.x + x * cos + z * sin; instance.y = pose.y + d[o + 1] * scale; instance.z = pose.z - x * sin + z * cos;
    instance.sx = d[o + 3] * scale; instance.sy = d[o + 4] * scale; instance.sz = d[o + 5] * scale;
    instance.yaw = yaw + d[o + 6]; instance.pitch = d[o + 7];
    this.tintPart(model, d[o + 8], pose);
    batch.meshFrom(model.shapes[part], instance);
  },
  tintPart(model, tint, pose) {
    const instance = modelInstance, own = model.ownColor, color = model.color;
    if (tint >= 0) {
      const p = tint * 4;
      instance.r = MODEL_PALETTE_RGB[p]; instance.g = MODEL_PALETTE_RGB[p + 1]; instance.b = MODEL_PALETTE_RGB[p + 2];
      instance.emissive = Math.max(MODEL_PALETTE_RGB[p + 3], pose.emissive * MODEL_PALETTE_GLOW_SHARE);
      return;
    }
    const share = tint === MODEL_TINT.shade ? MODEL_SHADE : 1;
    instance.r = (own ? color[0] : pose.r) * share; instance.g = (own ? color[1] : pose.g) * share; instance.b = (own ? color[2] : pose.b) * share;
    instance.emissive = tint === MODEL_TINT.glow ? Math.max(MODEL_GLOW, pose.emissive) : pose.emissive;
  },
};
const makeModelPose = () => new ModelPose();
