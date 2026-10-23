// HUD drawing layer (REN-005): rects, text, rings and lines become textured quads in one vertex buffer, drawn on
// top of the frame in the Loop 'hud' phase with one draw call per layer. S17 registers its layers with
// HudBatch.addLayer(name, order, draw). Coordinates are CSS pixels from the top-left; colours '#rrggbb' or 0xrrggbb.
// Text uses a glyph atlas generated at boot from a 2D canvas with the system font (no font files).

const HUD_MAX_QUADS = 8192;
const HUD_VERTEX_BYTES = 20;             // x y u v (f32) | rgba (u8)
const HUD_ATLAS_SIZE = 512;
const HUD_FONT_PX = 40;                  // glyph size in the atlas; text of any size scales from it
const HUD_CELL_PX = 50;                  // atlas row height (font + padding)
const HUD_FONT = '600 ' + HUD_FONT_PX + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const HUD_EXTRA_CHARACTERS = '°×•–—…←↑→↓★♥▲▼●';
const HUD_RING_SEGMENTS = 48;            // segments of a full circle (partial rings use a share)
const HUD_ATTRIBUTES = { aPosition: 0, aUv: 1, aColor: 2 };
const HUD_FALLBACK_ADVANCE = 0.55;       // em width per character before the atlas exists (headless)

const HudBatch = {
  layers: [],
  quads: 0,
  dropped: 0,              // quads refused at HUD_MAX_QUADS this session (the perf HUD shows it, the first one is logged)
  width: 1, height: 1,    // screen size in CSS pixels (layout for the layers)
  bytes: new ArrayBuffer(HUD_MAX_QUADS * 4 * HUD_VERTEX_BYTES),
  glyphIndex: new Map(),   // char code -> glyph slot
  glyphs: new Float32Array(128 * 6),     // u0 v0 u1 v1 advance width (atlas pixels)
  white: new Float32Array(2),            // uv of the white block used by untextured quads
  atlas: null, texture: null, buffer: null, indexBuffer: null, vertexArray: null,
  hudMs: 0,
  alphaScale: 1,           // every drawing call's alpha is multiplied by this (the HUD opacity setting, S17) in setHudPaint

  // draw(hud, seconds) is called every frame; layers draw in order (lower first). One draw call per layer.
  addLayer(name, order, draw) {
    this.layers.push({ name, order, draw, start: 0, count: 0, failed: false });
    this.layers.sort((a, b) => a.order - b.order);
  },
  removeLayer(name) {
    const index = this.layers.findIndex((layer) => layer.name === name);
    if (index >= 0) this.layers.splice(index, 1);
  },
  rect(x, y, w, h, colorHex, alpha) {
    const corners = hudCorners;
    corners[0] = x; corners[1] = y; corners[2] = x + w; corners[3] = y + h;
    setHudPaint(colorHex, alpha);
    pushHudBox();
  },
  line(x1, y1, x2, y2, thickness, colorHex, alpha) {
    const dx = x2 - x1, dy = y2 - y1, length = Math.sqrt(dx * dx + dy * dy) || 1, half = (thickness || 1) / 2;
    const px = -dy / length * half, py = dx / length * half, corners = hudCorners;
    corners[0] = x1 + px; corners[1] = y1 + py; corners[2] = x2 + px; corners[3] = y2 + py;   // straight into the scratch: eight
    corners[4] = x2 - px; corners[5] = y2 - py; corners[6] = x1 - px; corners[7] = y1 - py;   // float arguments would be boxed
    setHudPaint(colorHex, alpha);
    pushHudSolid();
  },
  // Angles in radians, 0 = 12 o'clock, clockwise (cooldown sweeps). start/end default to a full circle.
  ring(x, y, radius, thickness, colorHex, alpha, start, end) {
    const at = hudRingAt;
    at[0] = x; at[1] = y; at[2] = radius; at[3] = thickness; at[4] = start === undefined ? 0 : start; at[5] = end === undefined ? Math.PI * 2 : end;
    this.ringAt(colorHex, alpha);
  },
  // ring() at hudRingAt (x, y, radius, thickness, start, end): no float arguments (PERF-006).
  ringAt(colorHex, alpha) {
    const at = hudRingAt, x = at[0], y = at[1], radius = at[2], thickness = at[3], from = at[4], to = at[5];
    const segments = Math.max(1, Math.ceil(HUD_RING_SEGMENTS * Math.abs(to - from) / (Math.PI * 2)));
    const inner = radius - thickness / 2, outer = radius + thickness / 2, corners = hudCorners, step = (to - from) / segments;
    // One sine and cosine for the start edge and one for the step: each next edge is the last one turned by the step,
    // instead of four trig calls per segment (cooldown rings are most of the HUD's CPU on a phone).
    const stepSin = Math.sin(step), stepCos = Math.cos(step);
    let sb = Math.sin(from), cb = -Math.cos(from);   // (sin, -cos) of the edge: 12 o'clock, clockwise on screen
    setHudPaint(colorHex, alpha);
    for (let i = 0; i < segments; i++) {
      const sa = sb, ca = cb;
      sb = sa * stepCos - ca * stepSin; cb = ca * stepCos + sa * stepSin;
      corners[0] = x + sa * outer; corners[1] = y + ca * outer; corners[2] = x + sb * outer; corners[3] = y + cb * outer;
      corners[4] = x + sb * inner; corners[5] = y + cb * inner; corners[6] = x + sa * inner; corners[7] = y + ca * inner;
      pushHudSolid();
    }
  },
  // y is the middle of the line; align 'left' | 'center' | 'right'. Returns the width in CSS pixels.
  text(string, x, y, sizePx, colorHex, align, alpha) {
    const at = hudTextAt;
    at[0] = x; at[1] = y; at[2] = sizePx;
    this.textAt(string, colorHex, align, alpha);
    return at[3];
  },
  // text() at hudTextAt (x, y, size): no float arguments (PERF-006). Leaves the width in hudTextAt[3].
  textAt(string, colorHex, align, alpha) {
    const at = hudTextAt, text = String(string), x = at[0], y = at[1], sizePx = at[2], scale = sizePx / HUD_FONT_PX;
    this.measureAt(text);
    const width = at[3];
    let penX = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    if (!this.atlas) return;
    const top = y - (HUD_CELL_PX / 2) * scale, bottom = y + (HUD_CELL_PX / 2) * scale, g = this.glyphs, corners = hudCorners;
    setHudPaint(colorHex, alpha);
    for (let i = 0; i < text.length; i++) {
      const slot = this.glyphIndex.get(text.charCodeAt(i));
      if (slot === undefined) { penX += sizePx * HUD_FALLBACK_ADVANCE; continue; }
      const o = slot * 6, right = penX + g[o + 5] * scale;
      if (text.charCodeAt(i) !== 32) {
        corners[0] = corners[6] = penX; corners[1] = corners[3] = top; corners[2] = corners[4] = right; corners[5] = corners[7] = bottom;
        corners[8] = g[o]; corners[9] = g[o + 1]; corners[10] = g[o + 2]; corners[11] = g[o + 3];
        pushHudCorners();
      }
      penX += g[o + 4] * scale;
    }
  },
  measure(string, sizePx) {
    hudTextAt[2] = sizePx;
    this.measureAt(String(string));
    return hudTextAt[3];
  },
  // The width of text at size hudTextAt[2], into hudTextAt[3] (a returned float is boxed where the call is not inlined).
  measureAt(text) {
    const sizePx = hudTextAt[2], scale = sizePx / HUD_FONT_PX;
    if (!this.atlas) { hudTextAt[3] = text.length * sizePx * HUD_FALLBACK_ADVANCE; return; }
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      const slot = this.glyphIndex.get(text.charCodeAt(i));
      width += slot === undefined ? sizePx * HUD_FALLBACK_ADVANCE : this.glyphs[slot * 6 + 4] * scale;
    }
    hudTextAt[3] = width;
  },
};
const hudFloats = new Float32Array(HudBatch.bytes);
const hudColors = new Uint8Array(HudBatch.bytes);

// Appends one quad (corners clockwise on screen from top-left); full buffers drop the quad and count it.
// The drawing calls above fill hudCorners, set the paint once per call (setHudPaint) and call pushHudCorners per quad: a
// float passed to a call that is not inlined is boxed on the heap, a float written into a typed array is not (PERF-006: the
// HUD draws thousands of quads a frame, so no float goes to a call per glyph or ring segment).

// x0 y0 .. x3 y3 (corners), u0 v0 u1 v1 (texture rectangle) of the next quad.
const hudCorners = new Float32Array(12);
// x, y (middle of the line), size in pixels of the next text (HudBatch.textAt); [3] = the width after textAt or measureAt.
const hudTextAt = new Float64Array(4);
// x, y, radius, thickness, start and end angle of the next ring (HudBatch.ringAt).
const hudRingAt = new Float64Array(6);

// The colour (0xrrggbb) and alpha byte (0..255) of the next quads, set once per drawing call; the alpha is scaled by
// HudBatch.alphaScale here, so the pen passes its alpha through unchanged (a computed float argument is boxed, PERF-006).
// Math.min / max instead of clamp: clamp's float result is boxed when the call is not inlined.
const hudPaint = new Int32Array(2);
function setHudPaint(colorHex, alpha) {
  const scaled = (alpha === undefined ? 1 : alpha) * HudBatch.alphaScale;
  hudPaint[0] = colorNumber(colorHex);
  hudPaint[1] = Math.round(Math.min(1, Math.max(0, scaled)) * 255);
}

// An untextured quad: the corners and paint already set, the texture rectangle on the white block.
function pushHudSolid() {
  const corners = hudCorners, white = HudBatch.white;
  corners[8] = corners[10] = white[0]; corners[9] = corners[11] = white[1];
  pushHudCorners();
}

// An untextured axis-aligned rectangle: left, top, right, bottom in hudCorners[0..3], spread here to the four corners.
function pushHudBox() {
  const corners = hudCorners;
  corners[5] = corners[7] = corners[3];   // bottom
  corners[3] = corners[1];                // top right
  corners[4] = corners[2];
  corners[6] = corners[0];
  pushHudSolid();
}

function pushHudCorners() {
  if (HudBatch.quads >= HUD_MAX_QUADS) {
    if (!HudBatch.dropped++) console.info('HUD quad budget full (' + HUD_MAX_QUADS + '): quads dropped');
    return;
  }
  const color = hudPaint[0], a = hudPaint[1];
  const base = HudBatch.quads * 4;
  writeHudVertex(base, 0, 8, 9, color, a);
  writeHudVertex(base + 1, 2, 10, 9, color, a);
  writeHudVertex(base + 2, 4, 10, 11, color, a);
  writeHudVertex(base + 3, 6, 8, 11, color, a);
  HudBatch.quads++;
}

// One vertex from hudCorners: corner = index of its x, u / v = indices of its texture coordinates.
function writeHudVertex(vertex, corner, u, v, color, alpha) {
  const f = vertex * (HUD_VERTEX_BYTES / 4), b = vertex * HUD_VERTEX_BYTES + 16, corners = hudCorners;
  hudFloats[f] = corners[corner]; hudFloats[f + 1] = corners[corner + 1]; hudFloats[f + 2] = corners[u]; hudFloats[f + 3] = corners[v];
  hudColors[b] = (color >> 16) & 255; hudColors[b + 1] = (color >> 8) & 255; hudColors[b + 2] = color & 255; hudColors[b + 3] = alpha;
}

// ---- Glyph atlas (boot): white glyphs on transparent, plus a white block for rects and lines ----
function buildGlyphAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = HUD_ATLAS_SIZE;
  const context = canvas.getContext('2d');
  context.font = HUD_FONT;
  context.textBaseline = 'middle';
  context.fillStyle = '#ffffff';
  context.fillRect(HUD_ATLAS_SIZE - 8, HUD_ATLAS_SIZE - 8, 8, 8);
  HudBatch.white[0] = HudBatch.white[1] = (HUD_ATLAS_SIZE - 4) / HUD_ATLAS_SIZE;
  let penX = 2, penY = 0, slot = 0;
  const codes = [];
  for (let code = 32; code < 127; code++) codes.push(code);
  for (const character of HUD_EXTRA_CHARACTERS) codes.push(character.charCodeAt(0));
  for (const code of codes) {
    const character = String.fromCharCode(code), advance = context.measureText(character).width, cellWidth = Math.ceil(advance) + 4;
    if (penX + cellWidth > HUD_ATLAS_SIZE - 10) { penX = 2; penY += HUD_CELL_PX; }
    context.fillText(character, penX + 2, penY + HUD_CELL_PX / 2);
    const g = HudBatch.glyphs, o = slot * 6;
    g[o] = penX / HUD_ATLAS_SIZE; g[o + 1] = penY / HUD_ATLAS_SIZE; g[o + 2] = (penX + cellWidth) / HUD_ATLAS_SIZE; g[o + 3] = (penY + HUD_CELL_PX) / HUD_ATLAS_SIZE;
    g[o + 4] = advance; g[o + 5] = cellWidth;
    HudBatch.glyphIndex.set(code, slot++);
    penX += cellWidth;
  }
  HudBatch.atlas = canvas;
}

function createHudGpu(gl) {
  if (!HudBatch.atlas) buildGlyphAtlas();
  HudBatch.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, HudBatch.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, HudBatch.atlas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const indices = new Uint16Array(HUD_MAX_QUADS * 6);
  for (let quad = 0; quad < HUD_MAX_QUADS; quad++) indices.set([quad * 4, quad * 4 + 1, quad * 4 + 2, quad * 4, quad * 4 + 2, quad * 4 + 3], quad * 6);
  HudBatch.vertexArray = gl.createVertexArray();
  gl.bindVertexArray(HudBatch.vertexArray);
  HudBatch.buffer = makeBuffer(gl, gl.ARRAY_BUFFER, HudBatch.bytes.byteLength, gl.DYNAMIC_DRAW);
  bindAttributes(gl, HudBatch.buffer, [[HUD_ATTRIBUTES.aPosition, 2, gl.FLOAT, false, 0], [HUD_ATTRIBUTES.aUv, 2, gl.FLOAT, false, 8],
    [HUD_ATTRIBUTES.aColor, 4, gl.UNSIGNED_BYTE, true, 16]], HUD_VERTEX_BYTES, 0);
  HudBatch.indexBuffer = makeBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices);
  gl.bindVertexArray(null);
}
Render.addGpuPart('hud', createHudGpu);

const HUD_VERTEX = `#version 300 es
precision highp float;
uniform vec2 uScreen;
in vec2 aPosition;
in vec2 aUv;
in vec4 aColor;
out vec2 vUv;
out vec4 vColor;
void main() {
  vUv = aUv;
  vColor = aColor;
  gl_Position = vec4(aPosition.x / uScreen.x * 2.0 - 1.0, 1.0 - aPosition.y / uScreen.y * 2.0, 0.0, 1.0);
}`;
const HUD_FRAGMENT = `#version 300 es
precision mediump float;
uniform sampler2D uAtlas;
in vec2 vUv;
in vec4 vColor;
out vec4 outColor;
void main() { outColor = vec4(vColor.rgb, vColor.a * texture(uAtlas, vUv).a); }`;
Render.defineProgram('hud', HUD_VERTEX, HUD_FRAGMENT, HUD_ATTRIBUTES);

// Runs every layer, then uploads once and issues one draw call per non-empty layer.
function collectHudLayers(seconds) {
  HudBatch.quads = 0;
  HudBatch.width = Render.size.cssWidth;
  HudBatch.height = Render.size.cssHeight;
  const layers = HudBatch.layers;
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    layer.start = HudBatch.quads;
    if (!layer.failed) {
      try { layer.draw(HudBatch, seconds); } catch (error) { layer.failed = true; ErrorLog.add('hud layer ' + layer.name, error); }
    }
    layer.count = HudBatch.quads - layer.start;
  }
}

function drawHud(seconds) {
  if (!Render.ready || Render.lost || Game.headless) return;
  const started = performance.now(), gl = Render.gl;
  collectHudLayers(seconds);
  const before = Render.stats.drawCalls;
  if (HudBatch.quads) drawHudLayers(gl);
  HudBatch.hudMs = performance.now() - started;
  Perf.counters.hudMs = HudBatch.hudMs;
  Perf.counters.drawCalls += Render.stats.drawCalls - before;
}

function drawHudLayers(gl) {
  const program = Render.programs.hud;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, Render.size.width, Render.size.height);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(program.handle);
  gl.uniform2f(program.uniforms.uScreen, HudBatch.width, HudBatch.height);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, HudBatch.texture);
  gl.uniform1i(program.uniforms.uAtlas, 0);
  gl.bindVertexArray(HudBatch.vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, HudBatch.buffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, hudColors, 0, HudBatch.quads * 4 * HUD_VERTEX_BYTES);
  const layers = HudBatch.layers;
  for (let i = 0; i < layers.length; i++) {
    if (!layers[i].count) continue;
    gl.drawElements(gl.TRIANGLES, layers[i].count * 6, gl.UNSIGNED_SHORT, layers[i].start * 12);
    Render.countDraw(layers[i].count * 2);
  }
  gl.disable(gl.BLEND);
}

Bus.on('boot', () => {
  if (Render.ready) Loop.onFrame('hud', drawHud);
});

// GPU memory estimate (PERF-005: WebGL cannot report it) from the tracked buffer, texture and target sizes.
const MIPMAP_FACTOR = 4 / 3;
Render.gpuMemoryBytes = () => {
  const target = Render.target, size = Render.size;
  let bytes = ShapeMesh.vertices.byteLength + ShapeMesh.indices.byteLength + HudBatch.bytes.byteLength + HUD_MAX_QUADS * 12;
  bytes += HUD_ATLAS_SIZE * HUD_ATLAS_SIZE * 4 * MIPMAP_FACTOR;
  for (const batch of shapeBatches) bytes += batch.data.byteLength;
  bytes += particlePool.data.byteLength + decalPool.data.byteLength;
  bytes += SunShadow.size * SunShadow.size * 2;                         // 16-bit sun shadow depth map
  if (WorldMesh.vertexBytes) bytes += WorldMesh.vertexBytes.byteLength + WorldMesh.indexData.byteLength;
  bytes += size.width * size.height * 8;                                  // canvas colour + depth
  if (!target.direct) bytes += target.width * target.height * 8 * (1 + target.samples);
  return bytes;
};
