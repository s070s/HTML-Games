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
  dropped: 0,
  width: 1, height: 1,     // screen size in CSS pixels (layout for the layers)
  bytes: new ArrayBuffer(HUD_MAX_QUADS * 4 * HUD_VERTEX_BYTES),
  glyphIndex: new Map(),   // char code -> glyph slot
  glyphs: new Float32Array(128 * 6),     // u0 v0 u1 v1 advance width (atlas pixels)
  white: new Float32Array(2),            // uv of the white block used by untextured quads
  atlas: null, texture: null, buffer: null, indexBuffer: null, vertexArray: null,
  hudMs: 0,

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
    const u = this.white[0], v = this.white[1];
    pushHudQuad(x, y, x + w, y, x + w, y + h, x, y + h, u, v, u, v, colorHex, alpha);
  },
  line(x1, y1, x2, y2, thickness, colorHex, alpha) {
    const length = Math.hypot(x2 - x1, y2 - y1) || 1, half = (thickness || 1) / 2;
    const px = -(y2 - y1) / length * half, py = (x2 - x1) / length * half, u = this.white[0], v = this.white[1];
    pushHudQuad(x1 + px, y1 + py, x2 + px, y2 + py, x2 - px, y2 - py, x1 - px, y1 - py, u, v, u, v, colorHex, alpha);
  },
  // Angles in radians, 0 = 12 o'clock, clockwise (cooldown sweeps). start/end default to a full circle.
  ring(x, y, radius, thickness, colorHex, alpha, start, end) {
    const from = start === undefined ? 0 : start, to = end === undefined ? Math.PI * 2 : end;
    const segments = Math.max(1, Math.ceil(HUD_RING_SEGMENTS * Math.abs(to - from) / (Math.PI * 2)));
    const inner = radius - thickness / 2, outer = radius + thickness / 2, u = this.white[0], v = this.white[1];
    for (let i = 0; i < segments; i++) {
      const a = from + (to - from) * (i / segments), b = from + (to - from) * ((i + 1) / segments);
      const sa = Math.sin(a), ca = -Math.cos(a), sb = Math.sin(b), cb = -Math.cos(b);
      pushHudQuad(x + sa * outer, y + ca * outer, x + sb * outer, y + cb * outer, x + sb * inner, y + cb * inner, x + sa * inner, y + ca * inner, u, v, u, v, colorHex, alpha);
    }
  },
  // y is the middle of the line; align 'left' | 'center' | 'right'. Returns the width in CSS pixels.
  text(string, x, y, sizePx, colorHex, align, alpha) {
    const text = String(string), scale = sizePx / HUD_FONT_PX, width = this.measure(text, sizePx);
    let penX = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    if (!this.atlas) return width;
    const top = y - (HUD_CELL_PX / 2) * scale, bottom = y + (HUD_CELL_PX / 2) * scale, g = this.glyphs;
    for (let i = 0; i < text.length; i++) {
      const slot = this.glyphIndex.get(text.charCodeAt(i));
      if (slot === undefined) { penX += sizePx * HUD_FALLBACK_ADVANCE; continue; }
      const o = slot * 6, right = penX + g[o + 5] * scale;
      if (text.charCodeAt(i) !== 32) pushHudQuad(penX, top, right, top, right, bottom, penX, bottom, g[o], g[o + 1], g[o + 2], g[o + 3], colorHex, alpha);
      penX += g[o + 4] * scale;
    }
    return width;
  },
  measure(string, sizePx) {
    const text = String(string), scale = sizePx / HUD_FONT_PX;
    if (!this.atlas) return text.length * sizePx * HUD_FALLBACK_ADVANCE;
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      const slot = this.glyphIndex.get(text.charCodeAt(i));
      width += slot === undefined ? sizePx * HUD_FALLBACK_ADVANCE : this.glyphs[slot * 6 + 4] * scale;
    }
    return width;
  },
};
const hudFloats = new Float32Array(HudBatch.bytes);
const hudColors = new Uint8Array(HudBatch.bytes);

// Appends one quad (corners clockwise on screen from top-left); full buffers drop the quad and count it.
function pushHudQuad(x0, y0, x1, y1, x2, y2, x3, y3, u0, v0, u1, v1, colorHex, alpha) {
  if (HudBatch.quads >= HUD_MAX_QUADS) { HudBatch.dropped++; return; }
  const color = colorNumber(colorHex), a = Math.round(clamp(alpha === undefined ? 1 : alpha, 0, 1) * 255);
  const base = HudBatch.quads * 4;
  writeHudVertex(base, x0, y0, u0, v0, color, a);
  writeHudVertex(base + 1, x1, y1, u1, v0, color, a);
  writeHudVertex(base + 2, x2, y2, u1, v1, color, a);
  writeHudVertex(base + 3, x3, y3, u0, v1, color, a);
  HudBatch.quads++;
}

function writeHudVertex(vertex, x, y, u, v, color, alpha) {
  const f = vertex * (HUD_VERTEX_BYTES / 4), b = vertex * HUD_VERTEX_BYTES + 16;
  hudFloats[f] = x; hudFloats[f + 1] = y; hudFloats[f + 2] = u; hudFloats[f + 3] = v;
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
