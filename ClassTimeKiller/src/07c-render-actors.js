// Instanced procedural shapes (REN-003 "instanced actors/props") and the rigid-part humanoids (REN-002).
// Every shape lives in one static mesh buffer; a batch keeps one fixed instance region per shape, so a frame
// costs one upload + one instanced draw per used shape. Sources (Render.addSource) fill the props batch,
// actors are drawn from Actors with interpolation, code animation, 2 LODs, outlines and blob shadows (MIS-037).

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
    const length = Math.hypot(nx, ny, nz); nx /= length; ny /= length; nz /= length;
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
      const around = (t / tube) * Math.PI * 2, nr = Math.cos(around), ny = Math.sin(around), length = Math.hypot(nr * flatten, ny);
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
function makeShapeBatch(name, capacity) {
  const batch = {
    name, capacity, counts: new Uint16Array(SHAPES.length), data: new Float32Array(SHAPES.length * capacity * INSTANCE_FLOATS),
    buffer: null, vertexArrays: [], lastOffset: 0,
    clear() { this.counts.fill(0); },
    // ARCHITECTURE contract: centre (x, y, z), yaw/pitch radians, full sizes in metres, colour 0..1, emissive 0..1.
    mesh(shape, x, y, z, yaw, pitch, sx, sy, sz, r, g, b, emissive) {
      const shapeIndex = SHAPE_INDEX[shape];
      if (shapeIndex === undefined) return;
      const count = this.counts[shapeIndex];
      if (count >= this.capacity) { Render.stats.droppedInstances++; return; }
      const o = (shapeIndex * this.capacity + count) * INSTANCE_FLOATS, d = this.data;
      d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = yaw;
      d[o + 4] = sx; d[o + 5] = sy; d[o + 6] = sz; d[o + 7] = pitch;
      d[o + 8] = r; d[o + 9] = g; d[o + 10] = b; d[o + 11] = emissive || 0;
      d[o + 12] = sampleSunVisibility(x, y, z); d[o + 13] = 1;
      this.counts[shapeIndex] = count + 1;
      this.lastOffset = o;
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

function useShapesProgram(gl, viewProjection) {
  const program = Render.programs.shapes;
  gl.useProgram(program.handle);
  applyFrameUniforms(gl, program, viewProjection);
  gl.uniform1f(program.uniforms.uOutline, OUTLINE_METERS);
  gl.uniform3fv(program.uniforms.uOutlineColor, OUTLINE_COLOR);
}

const SHAPES_VERTEX = `#version 300 es
precision highp float;
uniform mat4 uViewProjection;
uniform int uMode;
uniform float uOutline;
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
${GLSL_ROTATION}
void main() {
  vec3 local = aPosition * aScale.xyz;
  if (uMode == 2) local += aNormal * uOutline;
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
${GLSL_LIGHTING}
in vec3 vPosition;
in vec3 vNormal;
in vec4 vColor;
in vec2 vExtra;
in vec2 vLocal;
out vec4 outColor;
void main() {
  if (uMode == 1) {
    float radius = length(vLocal) * 2.0;
    outColor = vec4(0.0, 0.0, 0.0, clamp(1.0 - radius * radius, 0.0, 1.0) * vExtra.y);
    return;
  }
  if (uMode == 2) { outColor = vec4(uOutlineColor, 1.0); return; }
  vec3 normal = normalize(vNormal);
  float sun = max(dot(normal, uSunDirection), 0.0) * vExtra.x;
  vec3 light = hemisphereLight(normal) + uSunColor * sun + dynamicLight(vPosition, normal);
  float rim = pow(1.0 - max(dot(normal, normalize(uCameraPosition - vPosition)), 0.0), 3.0) * 0.25;
  vec3 color = vColor.rgb * (light + rim) + vColor.rgb * vColor.a * 2.0;
  outColor = vec4(finishColor(color, vPosition), 1.0);
}`;
Render.defineProgram('shapes', SHAPES_VERTEX, SHAPES_FRAGMENT, SHAPE_ATTRIBUTES);

// ---- Batches used in the world pass ----
const propBatch = makeShapeBatch('props', 1024);
const actorBatch = makeShapeBatch('actors', 512);
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
  uploadBatch(gl, propBatch);
  uploadBatch(gl, actorBatch);
  useShapesProgram(gl, Render.frame.viewProjection);
  drawBatch(gl, propBatch, SHAPE_MODE.lit);
  drawBatch(gl, actorBatch, SHAPE_MODE.lit);
  if (Render.config.outlines) {
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
const FAR_PARTS = CAT.actorParts.filter((part) => part.far);
const STAND_HEIGHT = 1.8;
const HIP_HEIGHT = 1.0;                  // parts with a pivot below this belong to the lower body
const LEG_LENGTH = 0.9;                  // lower-body height the crouch squash is measured against
const CROUCH_UPPER_SHARE = 0.75;         // share of the lost height the upper body sinks (the rest is a slight lean)
const RUN_SPEED = 7;
const STRIDE_METERS = 1.7;
const MAX_SWING = 0.75;                  // radians at full run
const AIR_SWING = 0.35;
const ACTOR_TINTS = { skin: '#d6b79a', visor: '#9fe8ff', accent: '#2a2e33' };
const actorPhase = new Float32Array(MAX_ACTORS);
const actorStyle = { r: 1, g: 1, b: 1, emissive: 0, scale: 1, visible: true };
const actorPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, swing: 0, drop: 0, legSquash: 1, lift: 0 };
const tintColor = new Float32Array(3);
const rotated = { x: 0, y: 0, z: 0 };
const shadowHit = { distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null };

// CPU twin of the GLSL rotateYawPitch (local +Z ends up along Vec.fromAngles(yaw, pitch)).
function rotateYawPitchInto(out, x, y, z, yaw, pitch) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const ry = y * cp + z * sp, rz = -y * sp + z * cp;
  out.x = x * cy + rz * sy; out.y = ry; out.z = -x * sy + rz * cy;
  return out;
}

// Team colour, else the profile colour, else a palette colour by id (free-for-all).
function actorBaseColor(id) {
  const team = Actors.team[id], profile = Actors.profile[id];
  if (team >= 0) return CAT.teamColors[team % CAT.teamColors.length].color;
  if (profile && profile.color) return profile.color;
  return CAT.teamColors[id % CAT.teamColors.length].color;
}

function readActorStyle(id) {
  writeColor(tintColor, 0, actorBaseColor(id));
  actorStyle.r = tintColor[0]; actorStyle.g = tintColor[1]; actorStyle.b = tintColor[2];
  actorStyle.emissive = 0; actorStyle.scale = 1; actorStyle.visible = (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) === 0;
  if (Render.actorStyle) Render.actorStyle(id, actorStyle);
  return actorStyle;
}

function readActorPose(id, seconds, alpha) {
  const pose = actorPose, speed = Math.hypot(Actors.vx[id], Actors.vz[id]);
  pose.x = lerp(Actors.prevX[id], Actors.x[id], alpha);
  pose.y = lerp(Actors.prevY[id], Actors.y[id], alpha);
  pose.z = lerp(Actors.prevZ[id], Actors.z[id], alpha);
  pose.yaw = lerpAngle(Actors.prevYaw[id], Actors.yaw[id], alpha);
  pose.pitch = lerp(Actors.prevPitch[id], Actors.pitch[id], alpha);
  actorPhase[id] = (actorPhase[id] + speed * seconds * (Math.PI * 2 / STRIDE_METERS)) % (Math.PI * 2);
  const grounded = (Actors.flags[id] & ACTOR_FLAG.ON_GROUND) !== 0;
  const amount = Math.min(1, speed / RUN_SPEED);
  pose.swing = grounded ? Math.sin(actorPhase[id]) * amount * MAX_SWING : AIR_SWING;
  pose.lift = grounded ? Math.abs(Math.cos(actorPhase[id])) * amount * 0.05 : 0;
  pose.drop = (1 - clamp(Actors.height[id] / STAND_HEIGHT, 0.3, 1)) * STAND_HEIGHT * CROUCH_UPPER_SHARE;
  pose.legSquash = clamp((LEG_LENGTH - pose.drop) / LEG_LENGTH, 0.2, 1);
  return pose;
}

function partColor(part, style) {
  if (part.tint === 'team') { tintColor[0] = style.r; tintColor[1] = style.g; tintColor[2] = style.b; return 0; }
  if (part.tint === 'dark') { tintColor[0] = style.r * 0.3 + 0.08; tintColor[1] = style.g * 0.3 + 0.08; tintColor[2] = style.b * 0.3 + 0.09; return 0; }
  writeColor(tintColor, 0, ACTOR_TINTS[part.tint] || ACTOR_TINTS.accent);
  return part.tint === 'visor' ? 0.8 : 0;
}

function emitActorPart(part, pose, style) {
  // Crouch: the lower body squashes, the upper body sinks by the same amount the hips drop.
  const scale = style.scale, lower = part.pivot[1] < HIP_HEIGHT, squash = lower ? pose.legSquash : 1;
  const pitch = part.hold * DEG + pose.pitch * part.aim + pose.swing * part.swing;
  rotateYawPitchInto(rotated, part.offset[0], part.offset[1] * squash, part.offset[2], 0, pitch);
  const localY = (lower ? part.pivot[1] * squash : part.pivot[1] - pose.drop) + rotated.y + pose.lift;
  const localX = part.pivot[0] + rotated.x, localZ = part.pivot[2] + rotated.z;
  rotateYawPitchInto(rotated, localX * scale, localY * scale, localZ * scale, pose.yaw, 0);
  const emissive = Math.max(partColor(part, style), style.emissive);
  actorBatch.mesh(part.shape, pose.x + rotated.x, pose.y + rotated.y, pose.z + rotated.z, pose.yaw, pitch,
    part.size[0] * scale, part.size[1] * squash * scale, part.size[2] * scale, tintColor[0], tintColor[1], tintColor[2], emissive);
}

// Blob shadow under every actor (the local player too, MIS-037); airborne actors probe the ground below.
function emitActorShadow(id, pose, scale) {
  let groundY = pose.y;
  if ((Actors.flags[id] & ACTOR_FLAG.ON_GROUND) === 0) {
    if (!World.raycast(pose.x, pose.y + 0.1, pose.z, 0, -1, 0, SHADOW_PROBE_METERS, shadowHit)) return;
    groundY = shadowHit.y;
  }
  const fade = 1 - clamp((pose.y - groundY) / SHADOW_FADE_METERS, 0, 1);
  if (fade <= 0) return;
  const size = 0.95 * scale * (0.6 + 0.4 * fade);
  shadowBatch.mesh('disc', pose.x, groundY + 0.02, pose.z, 0, 0, size, 1, size, 0, 0, 0, 0);
  shadowBatch.data[shadowBatch.lastOffset + 13] = SHADOW_STRENGTH * fade; // the shadow pass reads strength from this slot
}

function fillActors(seconds, alpha) {
  actorBatch.clear();
  shadowBatch.clear();
  const camera = Render.camera, quality = Render.quality;
  const nearSquared = quality.lodNear * quality.lodNear, viewSquared = quality.viewDistance * quality.viewDistance;
  for (let id = 0; id < Actors.count; id++) {
    if (Actors.kind[id] === ACTOR_KIND.NONE || !Actors.alive[id]) continue;
    const pose = readActorPose(id, seconds, alpha), style = readActorStyle(id);
    if (!style.visible) continue;
    const distanceSquared = distanceSquared3(pose.x, pose.y, pose.z, camera.x, camera.y, camera.z);
    if (distanceSquared > viewSquared) continue;
    emitActorShadow(id, pose, style.scale);
    if (id === Game.playerId && !Render.view.overridden) continue; // first person: no own body
    const parts = distanceSquared < nearSquared ? NEAR_PARTS : FAR_PARTS;
    for (let i = 0; i < parts.length; i++) emitActorPart(parts[i], pose, style);
  }
}
Render.addUpdate(30, fillActors);
