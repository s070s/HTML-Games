// Instanced procedural shapes (REN-003 "instanced actors/props") and the rigid-part humanoids (REN-002).
// Every shape lives in one static mesh buffer; a batch keeps one fixed instance region per shape, so a frame
// costs one upload + one instanced draw per used shape. Sources (Render.addSource) fill the props batch,
// actors are drawn from Actors with interpolation, code animation, 2 LODs (+ a static silhouette past lodFar),
// outlines, blob shadows (MIS-037) and, on presets with shadows 'sun', one sun shadow map (REN-004).

const SHAPES = ['box', 'sphere', 'cylinder', 'capsule', 'cone', 'wedge', 'ring', 'disc'];
const SHAPE_INDEX = {};
SHAPES.forEach((name, index) => { SHAPE_INDEX[name] = index; });
const ROUND_SIDES = 12;
const SPHERE_RINGS = 7;
const INSTANCE_FLOATS = 16;              // offset.xyz yaw | size.xyz pitch | rgb emissive | sun strength - -
const SHAPE_ATTRIBUTES = { aPosition: 0, aNormal: 1, aOffset: 2, aScale: 3, aColor: 4, aExtra: 5 };
const SHAPE_MODE = { lit: 0, shadow: 1, outline: 2 };
const OUTLINE_METERS = 0.025;
const OUTLINE_COLOR = [0.03, 0.03, 0.04];
const SHADOW_STRENGTH = 0.55;
const SHADOW_FADE_METERS = 6;
const SHADOW_PROBE_METERS = 20;
const STRENGTH_SLOT = 13;                // instance float the blob-shadow pass reads its strength from
const HIGHLIGHT_SLOT = 14;               // instance float: 1 = thick bright outline (high-contrast enemies, ACC-006)
const HIGHLIGHT_THICKNESS = 2;           // extra outline thickness factor of a highlighted instance
const HIGHLIGHT_COLOR = [1, 0.85, 0.1];

// ---- Shape geometry (unit size, centred on the origin; sizes passed to batch.mesh are full sizes) ----
// Surface of revolution around Y from rings { r, y, nr, ny } (radius, height, normal radial / vertical part).
function latheShape(rings, sides, vertices, indices) {
  const base = vertices.length / 6;
  for (const ring of rings) {
    for (let s = 0; s <= sides; s++) {
      const angle = (s / sides) * Math.PI * 2, c = Math.cos(angle), sn = Math.sin(angle);
      vertices.push(ring.r * c, ring.y, ring.r * sn, ring.nr * c, ring.ny, ring.nr * sn);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < sides; s++) {
      const a = base + r * (sides + 1) + s, b = a + sides + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
}

// Flat polygon faces: each face = list of [x, y, z] corners counter-clockwise from outside.
function faceShape(faces, vertices, indices) {
  for (const corners of faces) {
    const base = vertices.length / 6;
    const [a, b, c] = corners;
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const length = length3(nx, ny, nz); nx /= length; ny /= length; nz /= length;
    for (const corner of corners) vertices.push(corner[0], corner[1], corner[2], nx, ny, nz);
    for (let i = 1; i < corners.length - 1; i++) indices.push(base, base + i, base + i + 1);
  }
}

const H = 0.5;
const BOX_FACES = [
  [[H, -H, -H], [H, H, -H], [H, H, H], [H, -H, H]], [[-H, -H, H], [-H, H, H], [-H, H, -H], [-H, -H, -H]],
  [[-H, H, -H], [-H, H, H], [H, H, H], [H, H, -H]], [[-H, -H, H], [-H, -H, -H], [H, -H, -H], [H, -H, H]],
  [[H, -H, H], [H, H, H], [-H, H, H], [-H, -H, H]], [[-H, -H, -H], [-H, H, -H], [H, H, -H], [H, -H, -H]],
];
// Wedge: a ramp rising toward +Z (full height at z = +0.5).
const WEDGE_FACES = [
  [[-H, -H, H], [-H, -H, -H], [H, -H, -H], [H, -H, H]], [[H, -H, H], [H, H, H], [-H, H, H], [-H, -H, H]],
  [[-H, -H, -H], [-H, H, H], [H, H, H], [H, -H, -H]], [[H, -H, -H], [H, H, H], [H, -H, H]], [[-H, -H, H], [-H, H, H], [-H, -H, -H]],
];

function sphereRings(centerY, radiusY, fromAngle, toAngle, steps) {
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const angle = lerp(fromAngle, toAngle, i / steps);
    rings.push({ r: H * Math.cos(angle), y: centerY + radiusY * Math.sin(angle), nr: Math.cos(angle), ny: Math.sin(angle) });
  }
  return rings;
}

const flatCap = (y, ny) => [{ r: 0, y, nr: 0, ny }, { r: H, y, nr: 0, ny }];
const SHAPE_BUILDERS = {
  box: (v, i) => faceShape(BOX_FACES, v, i),
  sphere: (v, i) => latheShape(sphereRings(0, H, -Math.PI / 2, Math.PI / 2, SPHERE_RINGS), ROUND_SIDES, v, i),
  cylinder: (v, i) => latheShape([...flatCap(-H, -1), { r: H, y: -H, nr: 1, ny: 0 }, { r: H, y: H, nr: 1, ny: 0 }, ...flatCap(H, 1).reverse()], ROUND_SIDES, v, i),
  capsule: (v, i) => latheShape([...sphereRings(-H / 2, H / 2, -Math.PI / 2, 0, 3), ...sphereRings(H / 2, H / 2, 0, Math.PI / 2, 3)], ROUND_SIDES, v, i),
  cone: (v, i) => latheShape([...flatCap(-H, -1), { r: H, y: -H, nr: 0.894, ny: 0.447 }, { r: 0.001, y: H, nr: 0.894, ny: 0.447 }], ROUND_SIDES, v, i),
  wedge: (v, i) => faceShape(WEDGE_FACES, v, i),
  ring: (v, i) => ringShape(v, i),
  disc: (v, i) => latheShape(flatCap(0, 1).reverse(), ROUND_SIDES, v, i),
};

// Torus around Y: outer diameter 1, height 1 (an elliptic tube, so scale Y sets the thickness like every other shape).
function ringShape(vertices, indices) {
  const major = 0.4, minor = 0.1, tube = 6, base = vertices.length / 6, flatten = H / minor;
  for (let s = 0; s <= ROUND_SIDES * 2; s++) {
    const angle = (s / (ROUND_SIDES * 2)) * Math.PI * 2, c = Math.cos(angle), sn = Math.sin(angle);
    for (let t = 0; t <= tube; t++) {
      const around = (t / tube) * Math.PI * 2, nr = Math.cos(around), ny = Math.sin(around), length = length2(nr * flatten, ny);
      vertices.push((major + minor * nr) * c, H * ny, (major + minor * nr) * sn, (nr * flatten / length) * c, ny / length, (nr * flatten / length) * sn);
    }
  }
  for (let s = 0; s < ROUND_SIDES * 2; s++) {
    for (let t = 0; t < tube; t++) {
      const a = base + s * (tube + 1) + t, b = a + tube + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
}

// One static buffer with every shape; ranges[shape] = { offset (bytes), count, triangles }.
const ShapeMesh = { vertices: null, indices: null, ranges: [], buffer: null, indexBuffer: null };
(function buildShapeMesh() {
  const vertices = [], indices = [];
  for (const name of SHAPES) {
    const first = indices.length;
    SHAPE_BUILDERS[name](vertices, indices);
    ShapeMesh.ranges.push({ offset: first * 2, count: indices.length - first, triangles: (indices.length - first) / 3 });
  }
  ShapeMesh.vertices = new Float32Array(vertices);
  ShapeMesh.indices = new Uint16Array(indices);
})();

// ---- Instance batches ----
const shapeBatches = [];
let shapeOverflows = 0;   // this session's refused instances (only the first is logged)
// One shape instance for batch.meshFrom (fill the fields, then call it; keep one record per caller and reuse it).
// Built by a constructor, not an object literal: V8 shares the field types of literals with the same property count and
// first keys (09a's nav builder { x: [], y: [], z: [], ... } also has 12), and a field that once held an array boxes every
// float stored into it, three per part drawn (PERF-006). The constructor's records share fields with no other object.
function ShapeInstance() {
  this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.pitch = 0; this.sx = 1; this.sy = 1; this.sz = 1;
  this.r = 1; this.g = 1; this.b = 1; this.emissive = 0;
}
// r, g, b from a 0xRRGGBB integer (an integer argument is never boxed)
ShapeInstance.prototype.setColor = function (color) {
  this.r = (color >> 16 & 255) / 255; this.g = (color >> 8 & 255) / 255; this.b = (color & 255) / 255;
};
// r, g, b from an [r, g, b] list of 0..1 values
ShapeInstance.prototype.setRgb = function (rgb) { this.r = rgb[0]; this.g = rgb[1]; this.b = rgb[2]; };
const makeShapeInstance = () => new ShapeInstance();
function makeShapeBatch(name, capacity) {
  const batch = {
    name, capacity, counts: new Uint16Array(SHAPES.length), data: new Float32Array(SHAPES.length * capacity * INSTANCE_FLOATS),
    buffer: null, vertexArrays: [],
    clear() { this.counts.fill(0); },
    // ARCHITECTURE contract: centre (x, y, z), yaw/pitch radians, full sizes in metres, colour 0..1, emissive 0..1.
    // Returns the instance's float offset in `data`, or -1 when the shape is unknown or the region is full.
    mesh(shape, x, y, z, yaw, pitch, sx, sy, sz, r, g, b, emissive) {
      const o = this.reserve(shape), d = this.data;
      if (o < 0) return -1;
      d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = yaw;
      d[o + 4] = sx; d[o + 5] = sy; d[o + 6] = sz; d[o + 7] = pitch;
      d[o + 8] = r; d[o + 9] = g; d[o + 10] = b; d[o + 11] = emissive || 0;
      this.light(o);
      return o;
    },
    // The hot S07 callers (actor parts) skip mesh(): reserve(shape) returns the instance offset (or -1), they write
    // data[o..o+11] (x y z yaw | sx sy sz pitch | r g b emissive) themselves and call light(o). Thirteen float
    // arguments to a call that is not inlined would be boxed on the heap for every part of every actor (PERF-006).
    reserve(shape) {
      const shapeIndex = SHAPE_INDEX[shape];
      if (shapeIndex === undefined) return -1;
      const count = this.counts[shapeIndex];
      if (count >= this.capacity) {
        // the perf HUD shows the count per frame; the first overflow of a session is logged
        if (!shapeOverflows++) console.info('shape batch ' + this.name + ' full (' + this.capacity + ' ' + shape + '): instances dropped');
        Render.stats.droppedInstances++;
        return -1;
      }
      const o = (shapeIndex * this.capacity + count) * INSTANCE_FLOATS, d = this.data;
      d[o + STRENGTH_SLOT] = 1; d[o + HIGHLIGHT_SLOT] = 0;
      this.counts[shapeIndex] = count + 1;
      return o;
    },
    light(o) {
      const d = this.data;
      d[o + 12] = sunVisibilityAt(d, o) / SUN_LIT;   // the centre d[o..o+2] in, a byte out: no boxed floats (PERF-006)
    },
    // mesh() from a reused instance record (makeShapeInstance): the zero-allocation form for sources that draw many
    // parts a frame. Same result and return value as mesh().
    meshFrom(shape, instance) {
      const o = this.reserve(shape), d = this.data;
      if (o < 0) return -1;
      d[o] = instance.x; d[o + 1] = instance.y; d[o + 2] = instance.z; d[o + 3] = instance.yaw;
      d[o + 4] = instance.sx; d[o + 5] = instance.sy; d[o + 6] = instance.sz; d[o + 7] = instance.pitch;
      d[o + 8] = instance.r; d[o + 9] = instance.g; d[o + 10] = instance.b; d[o + 11] = instance.emissive;
      this.light(o);
      return o;
    },
  };
  shapeBatches.push(batch);
  return batch;
}

function createShapeGpu(gl) {
  ShapeMesh.buffer = makeBuffer(gl, gl.ARRAY_BUFFER, ShapeMesh.vertices);
  ShapeMesh.indexBuffer = makeBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, ShapeMesh.indices);
  for (const batch of shapeBatches) createBatchGpu(gl, batch);
}

// One vertex array per shape region: WebGL2 has no base-instance, so each region gets its own attribute offsets.
function createBatchGpu(gl, batch) {
  batch.buffer = makeBuffer(gl, gl.ARRAY_BUFFER, batch.data.byteLength, gl.DYNAMIC_DRAW);
  batch.vertexArrays.length = 0;
  const stride = INSTANCE_FLOATS * 4;
  for (let shape = 0; shape < SHAPES.length; shape++) {
    const vertexArray = gl.createVertexArray(), region = shape * batch.capacity * stride;
    gl.bindVertexArray(vertexArray);
    bindAttributes(gl, ShapeMesh.buffer, [[SHAPE_ATTRIBUTES.aPosition, 3, gl.FLOAT, false, 0], [SHAPE_ATTRIBUTES.aNormal, 3, gl.FLOAT, false, 12]], 24, 0);
    bindAttributes(gl, batch.buffer, [[SHAPE_ATTRIBUTES.aOffset, 4, gl.FLOAT, false, region], [SHAPE_ATTRIBUTES.aScale, 4, gl.FLOAT, false, region + 16],
      [SHAPE_ATTRIBUTES.aColor, 4, gl.FLOAT, false, region + 32], [SHAPE_ATTRIBUTES.aExtra, 4, gl.FLOAT, false, region + 48]], stride, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ShapeMesh.indexBuffer);
    batch.vertexArrays.push(vertexArray);
  }
  gl.bindVertexArray(null);
}
Render.addGpuPart('shapes', createShapeGpu);

function uploadBatch(gl, batch) {
  gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
  for (let shape = 0; shape < SHAPES.length; shape++) {
    const count = batch.counts[shape];
    if (!count) continue;
    const first = shape * batch.capacity * INSTANCE_FLOATS;
    gl.bufferSubData(gl.ARRAY_BUFFER, first * 4, batch.data, first, count * INSTANCE_FLOATS);
  }
}

// Draws every used shape of a batch with the shapes program (already in use, uniforms set).
function drawBatch(gl, batch, mode) {
  gl.uniform1i(Render.programs.shapes.uniforms.uMode, mode);
  drawBatchInstances(gl, batch);
}

// One instanced draw per used shape with whatever program is in use (shapes or the shadow-map program).
function drawBatchInstances(gl, batch) {
  for (let shape = 0; shape < SHAPES.length; shape++) {
    const count = batch.counts[shape];
    if (!count) continue;
    const range = ShapeMesh.ranges[shape];
    gl.bindVertexArray(batch.vertexArrays[shape]);
    gl.drawElementsInstanced(gl.TRIANGLES, range.count, gl.UNSIGNED_SHORT, range.offset, count);
    Render.countDraw(range.triangles * count);
    Render.stats.instances += count;
  }
}

// The outline shell is 1 for every character when 'Character outlines' is on, else 0: high contrast alone then outlines only the
// highlighted enemies (ACC-006), not teammates or your own team.
function baseOutlineAmount() { return Render.config.outlines ? 1 : 0; }
function outlinePassNeeded() { return Render.config.outlines || Render.config.highContrast; }

function useShapesProgram(gl, viewProjection) {
  const program = Render.programs.shapes;
  gl.useProgram(program.handle);
  applyFrameUniforms(gl, program, viewProjection);
  gl.uniform1f(program.uniforms.uOutline, OUTLINE_METERS);
  gl.uniform1f(program.uniforms.uBaseOutline, baseOutlineAmount());
  gl.uniform3fv(program.uniforms.uOutlineColor, OUTLINE_COLOR);
  gl.uniform3fv(program.uniforms.uHighlightColor, HIGHLIGHT_COLOR);
}

const SHAPES_VERTEX = `#version 300 es
precision highp float;
uniform mat4 uViewProjection;
uniform int uMode;
uniform float uOutline;
uniform float uBaseOutline;
in vec3 aPosition;
in vec3 aNormal;
in vec4 aOffset;
in vec4 aScale;
in vec4 aColor;
in vec4 aExtra;
out vec3 vPosition;
out vec3 vNormal;
out vec4 vColor;
out vec2 vExtra;
out vec2 vLocal;
out float vHighlight;
${GLSL_ROTATION}
void main() {
  vec3 local = aPosition * aScale.xyz;
  vHighlight = aExtra.z;
  if (uMode == 2) local += aNormal * uOutline * (uBaseOutline + vHighlight * (${HIGHLIGHT_THICKNESS}.0 - uBaseOutline));
  vPosition = aOffset.xyz + rotateYawPitch(local, aOffset.w, aScale.w);
  vNormal = rotateYawPitch(aNormal / max(aScale.xyz, vec3(0.001)), aOffset.w, aScale.w);
  vColor = aColor;
  vExtra = aExtra.xy;
  vLocal = aPosition.xz;
  gl_Position = uViewProjection * vec4(vPosition, 1.0);
}`;
const SHAPES_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform int uMode;
uniform vec3 uOutlineColor;
uniform vec3 uHighlightColor;
${GLSL_LIGHTING}
in vec3 vPosition;
in vec3 vNormal;
in vec4 vColor;
in vec2 vExtra;
in vec2 vLocal;
in float vHighlight;
out vec4 outColor;
void main() {
  if (uMode == 1) {
    float radius = length(vLocal) * 2.0;
    outColor = vec4(0.0, 0.0, 0.0, clamp(1.0 - radius * radius, 0.0, 1.0) * vExtra.y);
    return;
  }
  if (uMode == 2) { outColor = vec4(mix(uOutlineColor, uHighlightColor, vHighlight), 1.0); return; }
  vec3 normal = normalize(vNormal);
  float sun = max(dot(normal, uSunDirection), 0.0) * vExtra.x * sunShadow(vPosition, normal);
  vec3 light = hemisphereLight(normal) + uSunColor * sun + dynamicLight(vPosition, normal);
  float rim = pow(1.0 - max(dot(normal, normalize(uCameraPosition - vPosition)), 0.0), 3.0) * 0.25;
  vec3 color = vColor.rgb * (light + rim) + vColor.rgb * vColor.a * 2.0;
  outColor = vec4(finishColor(color, vPosition), 1.0);
}`;
Render.defineProgram('shapes', SHAPES_VERTEX, SHAPES_FRAGMENT, SHAPE_ATTRIBUTES);

// ---- Batches used in the world pass ----
const propBatch = makeShapeBatch('props', 1024);
const actorBatch = makeShapeBatch('actors', 768);   // 64 near actors with up to 6 boxes of a held weapon model each
const shadowBatch = makeShapeBatch('shadows', 96);

// Render.addSource callbacks fill the props batch; a source that throws is logged once and switched off.
function fillSources() {
  propBatch.clear();
  const sources = Render.sources;
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (source.failed) continue;
    try { source.draw(propBatch); } catch (error) { source.failed = true; ErrorLog.add('render source ' + source.name, error); }
  }
}
Render.addUpdate(40, fillSources);

function drawShapes(gl) {
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  useShapesProgram(gl, Render.frame.viewProjection);
  drawBatch(gl, propBatch, SHAPE_MODE.lit);
  drawBatch(gl, actorBatch, SHAPE_MODE.lit);
  if (outlinePassNeeded()) {
    gl.cullFace(gl.FRONT);
    drawBatch(gl, actorBatch, SHAPE_MODE.outline);
    gl.cullFace(gl.BACK);
  }
}
Render.addPass(30, drawShapes);

function drawShadows(gl) {
  if (!shadowBatch.counts[SHAPE_INDEX.disc]) return;
  uploadBatch(gl, shadowBatch);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
  useShapesProgram(gl, Render.frame.viewProjection);
  drawBatch(gl, shadowBatch, SHAPE_MODE.shadow);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.depthMask(true); gl.disable(gl.BLEND);
}
Render.addPass(40, drawShadows);

// ---- Actors (REN-002): rigid parts, code animation, LODs, style hook ----
const NEAR_PARTS = CAT.actorParts.slice();
const LOD = { near: 0, far: 1, distant: 2 };   // distant = past the preset's lodFar: a still silhouette
const FAR_ANIMATION_STRIDE = 4;          // the far LOD re-poses its walk cycle every 4th frame (plan step 1.8)
const HIP_HEIGHT = 1.0;                  // parts with a pivot below this belong to the lower body
const LEG_LENGTH = 0.9;                  // lower-body height the crouch squash is measured against
const CROUCH_UPPER_SHARE = 0.75;         // share of the lost height the upper body sinks (the rest is a slight lean)
const MAX_SWING = 0.75;                  // radians at full run
const AIR_SWING = 0.35;
const TEAM_DARK_SHARE = 0.3, TEAM_DARK_LIFT = 0.08;   // teamDark = team colour x share + lift (a black team stays visible)
const ACTOR_CULL_HALF_WIDTH = 1.2, ACTOR_CULL_HEIGHT = 2.4;
const actorPhase = new Float32Array(MAX_ACTORS);
const actorPendingSeconds = new Float32Array(MAX_ACTORS);   // walk time not yet applied (low-rate far LOD)
const actorStyle = { r: 1, g: 1, b: 1, emissive: 0, scale: 1, headScale: 1, visible: true };
const actorPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, swing: 0, drop: 0, legSquash: 1, lift: 0, recorded: false, speed: 0, height: STAND_HEIGHT, grounded: true };   // recorded: a killcam pose carries its own speed, height and grounded
const tintColor = new Float32Array(4);   // r g b and the self-lit share of the part being emitted (partColor)
// placeActorPart's result: the part centre (from the feet) and pitch, and the size factors it used (squash: crouched legs, grow: head scale).
const rotated = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, squash: 1, grow: 1 };
const ActorFrame = { count: 0 };

// CPU twin of the GLSL rotateYawPitch (local +Z ends up along Vec.fromAngles(yaw, pitch)). In place on
// { x y z yaw pitch }: the per-part hot path passes no float arguments (they would be boxed on the heap, PERF-006).
function rotateInPlace(point) {
  const pitch = point.pitch, yaw = point.yaw, x = point.x, y = point.y, z = point.z;
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const ry = y * cp + z * sp, rz = -y * sp + z * cp;
  point.x = x * cy + rz * sy; point.y = ry; point.z = -x * sy + rz * cy;
  return point;
}

// Team colour (in the HUD's colour slot), else the profile colour, else a palette colour by id (free-for-all).
function actorBaseColor(id) {
  const team = Actors.team[id], profile = Actors.profile[id];
  if (team >= 0) {
    const slot = Render.teamSlot ? Render.teamSlot(team) : team;
    return Render.teamPalette ? Render.teamPalette[slot % Render.teamPalette.length] : CAT.teamColors[slot % CAT.teamColors.length].color;
  }
  if (profile && profile.color) return profile.color;
  return CAT.teamColors[id % CAT.teamColors.length].color;
}

function readActorStyle(id) {
  writeColor(tintColor, 0, actorBaseColor(id));
  actorStyle.r = tintColor[0]; actorStyle.g = tintColor[1]; actorStyle.b = tintColor[2];
  actorStyle.emissive = 0; actorStyle.scale = 1; actorStyle.headScale = 1; actorStyle.visible = Render.replayPose !== null || (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) === 0;   // a replay hides by its recording
  Render.applyActorStyle(id, actorStyle);
  return actorStyle;
}

// Interpolated feet position and body angles (Loop alpha between the previous and the current sim step).
function readActorPosition(id, alpha) {
  const pose = actorPose;
  pose.x = lerp(Actors.prevX[id], Actors.x[id], alpha);
  pose.y = lerp(Actors.prevY[id], Actors.y[id], alpha);
  pose.z = lerp(Actors.prevZ[id], Actors.z[id], alpha);
  pose.yaw = lerpAngle(Actors.prevYaw[id], Actors.yaw[id], alpha);
  pose.pitch = lerp(Actors.prevPitch[id], Actors.pitch[id], alpha);
  pose.recorded = false;
  return pose;
}

function lodFor(distanceSquared, quality) {
  if (distanceSquared < quality.lodNear * quality.lodNear) return LOD.near;
  return distanceSquared < quality.lodFar * quality.lodFar ? LOD.far : LOD.distant;
}

// Walk cycle from speed, crouch from height. The far LOD applies its walk time in steps; distant actors stand still.
function animateActor(id, pose, seconds, lod) {
  const recorded = pose.recorded, speed = recorded ? pose.speed : length2(Actors.vx[id], Actors.vz[id]);
  actorPendingSeconds[id] = lod === LOD.distant ? 0 : actorPendingSeconds[id] + seconds;
  if (lod === LOD.near || (ActorFrame.count + id) % FAR_ANIMATION_STRIDE === 0) {
    actorPhase[id] = (actorPhase[id] + speed * actorPendingSeconds[id] * (Math.PI * 2 / WALK_CYCLE_METRES)) % (Math.PI * 2);
    actorPendingSeconds[id] = 0;
  }
  const grounded = recorded ? pose.grounded : (Actors.flags[id] & ACTOR_FLAG.ON_GROUND) !== 0;
  const amount = lod === LOD.distant ? 0 : Math.min(1, speed / RUN_REFERENCE_SPEED);
  pose.swing = grounded ? Math.sin(actorPhase[id]) * amount * MAX_SWING : AIR_SWING;
  pose.lift = grounded ? Math.abs(Math.cos(actorPhase[id])) * amount * 0.05 : 0;
  pose.drop = (1 - clamp((recorded ? pose.height : Actors.height[id]) / STAND_HEIGHT, 0.3, 1)) * STAND_HEIGHT * CROUCH_UPPER_SHARE;
  pose.legSquash = clamp((LEG_LENGTH - pose.drop) / LEG_LENGTH, 0.2, 1);
}

// The part colour and self-lit share into tintColor (stored, not returned: a returned float would be boxed, PERF-006).
// Palette tints read the one model palette (07c-render-models).
function partColor(part, style) {
  const tint = part.tint;
  tintColor[3] = 0;
  if (tint === 'team') { tintColor[0] = style.r; tintColor[1] = style.g; tintColor[2] = style.b; return; }
  if (tint === 'teamDark') {
    tintColor[0] = style.r * TEAM_DARK_SHARE + TEAM_DARK_LIFT; tintColor[1] = style.g * TEAM_DARK_SHARE + TEAM_DARK_LIFT;
    tintColor[2] = style.b * TEAM_DARK_SHARE + TEAM_DARK_LIFT;
    return;
  }
  if (tint === 'model' || tint === 'modelDark' || tint === 'modelGlow') { modelPartColor(tint); return; }
  const p = (MODEL_PALETTE_INDEX[tint] || 0) * 4;
  tintColor[0] = MODEL_PALETTE_RGB[p]; tintColor[1] = MODEL_PALETTE_RGB[p + 1]; tintColor[2] = MODEL_PALETTE_RGB[p + 2]; tintColor[3] = MODEL_PALETTE_RGB[p + 3];
}
function modelPartColor(tint) {
  const colors = ActorModels.colors, o = actorModelRow * 3, shade = tint === 'modelDark' ? MODEL_SHADE : 1;
  tintColor[0] = colors[o] * shade; tintColor[1] = colors[o + 1] * shade; tintColor[2] = colors[o + 2] * shade;
  if (tint === 'modelGlow') tintColor[3] = MODEL_GLOW;
}

// A part's centre relative to the feet and its pitch, left in `rotated` (a returned float would be boxed, PERF-006). Crouch: the lower body squashes, the upper
// body sinks by the same amount the hips drop. 07c-render-models places the held weapon at the 'gun' part this way.
function placeActorPart(part, pose, style) {
  const scale = style.scale, lower = part.pivot[1] < HIP_HEIGHT, squash = lower ? pose.legSquash : 1;
  const pitch = part.hold * DEG + pose.pitch * part.aim + pose.swing * part.swing, head = part.head ? style.headScale : 1;
  const point = rotated;
  point.squash = squash; point.grow = head;
  point.x = part.offset[0] * head; point.y = part.offset[1] * squash * head; point.z = part.offset[2] * head; point.yaw = 0; point.pitch = pitch;
  rotateInPlace(point);
  const localY = (lower ? part.pivot[1] * squash : part.pivot[1] - pose.drop) + point.y + pose.lift;
  const localX = part.pivot[0] + point.x, localZ = part.pivot[2] + point.z;
  point.x = localX * scale; point.y = localY * scale; point.z = localZ * scale; point.yaw = pose.yaw; point.pitch = 0;
  rotateInPlace(point);
  point.pitch = pitch;
}

// placeActorPart, then the part's size (times the squash and head factors it left in `rotated`), colour and highlight.
function emitActorPart(part, pose, style) {
  placeActorPart(part, pose, style);
  const point = rotated, scale = style.scale * point.grow, o = actorBatch.reserve(part.shape), d = actorBatch.data;
  if (o < 0) return;
  partColor(part, style);
  d[o] = pose.x + point.x; d[o + 1] = pose.y + point.y; d[o + 2] = pose.z + point.z; d[o + 3] = pose.yaw;
  d[o + 4] = part.size[0] * scale; d[o + 5] = part.size[1] * point.squash * scale; d[o + 6] = part.size[2] * scale; d[o + 7] = point.pitch + part.tilt * DEG;
  d[o + 8] = tintColor[0]; d[o + 9] = tintColor[1]; d[o + 10] = tintColor[2]; d[o + 11] = Math.max(tintColor[3], style.emissive);
  d[o + HIGHLIGHT_SLOT] = actorHighlight;
  actorBatch.light(o);
}

// ACC-006: with high-contrast outlines the local player's enemies get a thick bright outline (set per actor before its parts are emitted).
let actorHighlight = 0;
function highlightFor(id) {
  const player = Game.playerId;
  return Render.config.highContrast && player >= 0 && Actors.isEnemy(player, id) ? 1 : 0;
}

// Blob shadow under an actor (MIS-037); airborne actors probe the ground below in the renderer's brush grid.
function emitActorShadow(id, pose, scale) {
  const airborne = (Actors.flags[id] & ACTOR_FLAG.ON_GROUND) === 0;
  const groundY = airborne ? groundBelow(pose.x, pose.y + 0.1, pose.z, SHADOW_PROBE_METERS) : pose.y;
  const fade = 1 - clamp((pose.y - groundY) / SHADOW_FADE_METERS, 0, 1);
  if (fade <= 0) return;
  const size = 0.95 * scale * (0.6 + 0.4 * fade), instance = shadowInstance;
  instance.x = pose.x; instance.y = groundY + 0.02; instance.z = pose.z; instance.sx = size; instance.sz = size;
  const slot = shadowBatch.meshFrom('disc', instance);
  if (slot >= 0) shadowBatch.data[slot + STRENGTH_SLOT] = SHADOW_STRENGTH * fade;
}
const shadowInstance = Object.assign(makeShapeInstance(), { r: 0, g: 0, b: 0 });   // flat black disc; position and size per actor

// A loose box around the body and its blob shadow; actors outside the view cost nothing
function actorInView(pose, scale) {
  const half = ACTOR_CULL_HALF_WIDTH * scale;
  return boxVisible(pose.x - half, pose.y - 1, pose.z - half, pose.x + half, pose.y + ACTOR_CULL_HEIGHT * scale, pose.z + half);
}

function fillActors(seconds, alpha) {
  actorBatch.clear();
  shadowBatch.clear();
  ActorFrame.count++;
  const replay = Render.replayPose;
  for (let id = 0; id < Actors.count; id++) {
    if (Actors.kind[id] === ACTOR_KIND.NONE) continue;
    if (replay) { if (replay(id, actorPose)) drawActorPose(id, actorPose, seconds); } else if (Actors.alive[id]) drawActor(id, seconds, alpha);
  }
}
Render.addUpdate(30, fillActors);

// ---- Body models (03s actorModels): one generic builder resolves every row into part lists per LOD at load ----
// A row starts from its base row (or the actorParts body), drops and changes base parts by id and adds its own parts.
const MODEL_LIST_PLAIN = 3;              // lists per row: near, far, distant (LOD order), plain = near without detail parts
const ActorModels = {
  index: new Uint8Array(MAX_ACTORS),     // per actor: the actorModels row worn this life (0 = the default body)
  bodies: [],                            // per row: every resolved part
  lists: [],                             // per row: [near, far, distant, plain] part lists
  colors: new Float32Array(CAT.actorModels.length * 3),
  // S13 sets the model on spawn: the row of this kind and id, else the default body.
  set(id, kind, modelId) {
    this.index[id] = 0;
    for (let i = 0; i < CAT.actorModels.length; i++) if (CAT.actorModels[i].kind === kind && CAT.actorModels[i].id === modelId) this.index[id] = i;
  },
  // The level rule is Models.detailLevel's: when it drops the near details, the body keeps its near parts without them.
  partsFor(id, lod, quality) {
    actorModelRow = this.index[id];
    const level = Models.detailLevel(lod, quality);
    return this.lists[actorModelRow][level === lod ? lod : MODEL_LIST_PLAIN];
  },
};
let actorModelRow = 0;                   // the model row of the actor being emitted (partColor reads its colour)

function resolveModelBody(row) {
  const baseRow = row.base ? CAT.actorModels.byId(row.base) : null;
  if (row.base && !(baseRow && baseRow.index < row.index)) throw new Error('actorModels ' + row.id + ': base must be an earlier row');
  const base = baseRow ? ActorModels.bodies[baseRow.index] : NEAR_PARTS;
  const kept = base.filter((part) => !row.drop.includes(part.id));
  const changed = kept.map((part) => (row.change[part.id] ? Object.assign({}, part, row.change[part.id]) : part));
  return changed.concat(row.parts.map((part) => Data.normalize(ACTOR_PART_SCHEMA, part)));
}
CAT.actorModels.forEach((row) => {
  const body = resolveModelBody(row);
  ActorModels.bodies.push(body);
  ActorModels.lists.push([body, body.filter((part) => part.far), body.filter((part) => part.distant), body.filter((part) => !part.detail)]);
  writeColor(ActorModels.colors, row.index * 3, row.color);
});
Bus.on('actor.create', (id) => { ActorModels.index[id] = 0; });

// The local player always keeps a blob shadow (MIS-037: no feet in first person); other actors get one
// unless the sun shadow map already covers them.
function drawActor(id, seconds, alpha) { drawActorPose(id, readActorPosition(id, alpha), seconds); }
// drawActor at given feet position and body angles in `pose` (a replay's recorded ones, Render.replayPose).
function drawActorPose(id, pose, seconds) {
  const style = readActorStyle(id);
  if (!style.visible) return;
  const camera = Render.camera, quality = Render.quality;
  const distanceSquared = distanceSquared3(pose.x, pose.y, pose.z, camera.x, camera.y, camera.z);
  if (distanceSquared > quality.viewDistance * quality.viewDistance || !actorInView(pose, style.scale)) return;
  const lod = lodFor(distanceSquared, quality);
  animateActor(id, pose, seconds, lod);
  const firstPerson = id === Game.playerId && !Render.view.overridden;
  if (firstPerson || !SunShadow.covers(distanceSquared)) emitActorShadow(id, pose, style.scale);
  if (firstPerson) return;
  const parts = ActorModels.partsFor(id, lod, quality), held = lod === LOD.distant ? null : heldWeaponModel(id);   // the weapon model replaces the gun part
  actorHighlight = highlightFor(id);
  for (let i = 0; i < parts.length; i++) if (!held || parts[i] !== HELD_GUN_PART) emitActorPart(parts[i], pose, style);
  if (held) drawHeldWeapon(held, pose, style, lod);
}

// ---- Sun shadow map (REN-004: one sun shadow on presets with shadows 'sun', High/Ultra) ----
// Props and actors cast into one depth map around the camera; the world and shape shaders sample it (sunShadow in
// GLSL_LIGHTING). Static geometry keeps its baked shadows. Other presets bind a 1x1 map and use blob shadows only.
const SHADOW_MAP_SIZE = 1024;
const SHADOW_HALF_METERS = 24;           // half width of the square the map covers
const SHADOW_DEPTH_HALF_METERS = 40;     // casters up to this far toward the sun are kept
const SHADOW_AHEAD_SHARE = 0.4;          // the map centre sits this share of the half width ahead of the camera
const SHADOW_COVER_METERS = SHADOW_HALF_METERS * (1 - SHADOW_AHEAD_SHARE); // always inside the map
const SunShadow = {
  active: false, size: 0, texture: null, framebuffer: null, frames: 0,
  covers(distanceSquared) { return this.active && distanceSquared < SHADOW_COVER_METERS * SHADOW_COVER_METERS; },
};

function createSunShadowGpu(gl) {
  SunShadow.texture = gl.createTexture();
  SunShadow.framebuffer = gl.createFramebuffer();
  SunShadow.size = 0;
  sizeSunShadow(gl, 1);
}
Render.addGpuPart('sunShadow', createSunShadowGpu);

// (Re)allocates the depth map: full size while active, 1x1 otherwise (the shadow sampler always needs a depth texture).
function sizeSunShadow(gl, size) {
  if (SunShadow.size === size) return;
  SunShadow.size = size;
  gl.bindTexture(gl.TEXTURE_2D, SunShadow.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  gl.bindFramebuffer(gl.FRAMEBUFFER, SunShadow.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, SunShadow.texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// Orthographic sun view around a point ahead of the camera, snapped to whole texels so shadow edges do not crawl.
function updateSunShadow() {
  SunShadow.active = Render.quality.shadows === 'sun';
  Render.frame.shadowOn = SunShadow.active ? 1 : 0;
  if (!SunShadow.active) return;
  const sun = Render.frame.sunDirection, camera = Render.camera, m = Render.frame.shadowMatrix;
  const fx = -sun[0], fy = -sun[1], fz = -sun[2];             // light travel direction
  const flat = length2(fz, fx) || 1;
  const rx = -fz / flat, ry = 0, rz = fx / flat;                // right = cross(travel, up), normalized
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const ahead = SHADOW_HALF_METERS * SHADOW_AHEAD_SHARE, texel = (SHADOW_HALF_METERS * 2) / SHADOW_MAP_SIZE;
  const cx = camera.x + Math.sin(camera.yaw) * ahead, cy = camera.y, cz = camera.z + Math.cos(camera.yaw) * ahead;
  const alongRight = Math.round((rx * cx + ry * cy + rz * cz) / texel) * texel;
  const alongUp = Math.round((ux * cx + uy * cy + uz * cz) / texel) * texel;
  const half = SHADOW_HALF_METERS, depth = SHADOW_DEPTH_HALF_METERS;
  m[0] = rx / half; m[4] = ry / half; m[8] = rz / half; m[12] = -alongRight / half;
  m[1] = ux / half; m[5] = uy / half; m[9] = uz / half; m[13] = -alongUp / half;
  m[2] = fx / depth; m[6] = fy / depth; m[10] = fz / depth; m[14] = -(fx * cx + fy * cy + fz * cz) / depth;
  m[3] = 0; m[7] = 0; m[11] = 0; m[15] = 1;
}
Render.addUpdate(6, updateSunShadow);

const SHADOW_VERTEX = `#version 300 es
precision highp float;
uniform mat4 uViewProjection;
in vec3 aPosition;
in vec4 aOffset;
in vec4 aScale;
${GLSL_ROTATION}
void main() {
  gl_Position = uViewProjection * vec4(aOffset.xyz + rotateYawPitch(aPosition * aScale.xyz, aOffset.w, aScale.w), 1.0);
}`;
const SHADOW_FRAGMENT = `#version 300 es
precision mediump float;
void main() {}`;
Render.defineProgram('shadow', SHADOW_VERTEX, SHADOW_FRAGMENT, SHAPE_ATTRIBUTES);

// Pre-pass (before the scene target is bound): uploads the prop and actor instances, renders the shadow map when active
// and binds it to its texture unit for the lit programs.
function drawSunShadowPass(gl) {
  uploadBatch(gl, propBatch);
  uploadBatch(gl, actorBatch);
  sizeSunShadow(gl, SunShadow.active ? SHADOW_MAP_SIZE : 1);
  if (SunShadow.active) renderSunShadow(gl);
  gl.activeTexture(gl.TEXTURE0 + SHADOW_TEXTURE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, SunShadow.texture);
  gl.activeTexture(gl.TEXTURE0);
}
Render.addPrePass(drawSunShadowPass);

function renderSunShadow(gl) {
  const program = Render.programs.shadow;
  gl.bindFramebuffer(gl.FRAMEBUFFER, SunShadow.framebuffer);
  gl.viewport(0, 0, SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3);
  gl.useProgram(program.handle);
  gl.uniformMatrix4fv(program.uniforms.uViewProjection, false, Render.frame.shadowMatrix);
  drawBatchInstances(gl, propBatch);
  drawBatchInstances(gl, actorBatch);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  SunShadow.frames++;
}
