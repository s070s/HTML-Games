### 6.18 M-18 Render (`src/18-render.js`, `FLM.Render`)

#### 6.18.1 Responsibilities and non-goals

Responsibilities: acquire the drawing surface (WebGL2, then WebGL1, then the 2D Abstract
tier on `canvas#flat`); own the quality tiers, their parameter table, the initial tier pick
and the automatic downgrade; provide an allocation-free math library (`vec3`, `quat`,
`mat4`); a scene graph of `Node` objects with dirty-flag world matrices; procedural
primitives (box, capsule, cylinder, sphere, plane, ring, quad); `Mesh`, `Material`,
`Texture`, `Camera` (perspective, critically damped follow spring) and `Light`; the two
shader programs (lit, unlit) in one GLSL ES 1.00 source set that runs on WebGL2 and WebGL1;
batched and instanced drawing (WebGL2 instanced arrays, `ANGLE_instanced_arrays` on WebGL1,
per-draw fallback); blob shadows; the persistent base resources (glyph atlas, blob texture,
unit meshes); context loss and restore with a 3,000 ms deadline; the RAF loop wrapper with
frame statistics (frame-time ring, p50, p95); GL object counters for leak checks;
`dispose()`; and `Flat2D`, the 2D drawing surface used by the Abstract tier for the
highway, the band columns and the visualizer.

Non-goals: no musical time (the loop receives audio time from an injected clock and passes
it on; M-18 never reads a Transport, never accumulates `dt` into any time value, S-01); no
text rendering in GL or 2D (all text is DOM, ADR-13); no imported models, no skinning
shaders (limbs are rigid primitives posed on the CPU by M-19), no shadow maps, no
post-processing; no stage content (M-21 composes the scene); no UI toasts (M-27 reacts to
`render.tier` and `render.contextRestored`). M-18 references only M-01 (Part 4.1) so it can
be tested without an AudioContext.

#### 6.18.2 Public API

```js
FLM.Render = {
  TIER_ORDER: ['High', 'Balanced', 'Low', 'Abstract'],   // downgrade order
  /** Deep-frozen tier parameter rows; exact values in 6.18.4.2. */
  TIERS: { High: TierParams, Balanced: TierParams, Low: TierParams, Abstract: TierParams },
  /** Glyph path data in a 24 x 24 box, identical to the SVG symbols of Part 3.2.5.
   *  Each entry is an array of commands: ['M',x,y] ['L',x,y] ['Z'] ['O',cx,cy,r] (circle). */
  GLYPHS: { lane0, lane1, lane2, lane3, left, down, up, right },
  /** Atlas layout of the persistent 256 x 256 texture (64 px cells, 6.18.4.10). */
  ATLAS: { size: 256, cell: 64, cells: { /* name -> [col,row] */ } },
  RESTORE_TIMEOUT_MS: 3000,

  /** Acquire a context and build base resources. Idempotent: a second call returns the
   *  first result unchanged. Never throws.
   *  @param {HTMLCanvasElement} view   canvas#view
   *  @param {HTMLCanvasElement} flat   canvas#flat
   *  @param {{tier:string, reason:string, auto:boolean}} pick   result of pickTier()
   *  @param {{glFactory?:(canvas:HTMLCanvasElement, api:string, attrs:object)=>object|null,
   *           bus?:Emitter, settings?:object}} [opts]   test injection; settings is the 5.11
   *           document (video.tier and video.resolutionScale are read from it at init)
   *  @returns {{tier:string, api:'webgl2'|'webgl1'|'none', reason:string, errors:string[]}}
   *  Emits: render.tier {reason:'initial' or 'url' or 'user'} once. */
  init(view, flat, pick, opts),

  /** Pure tier selection (6.18.4.2). urlTier is the ?tier= value or null; viewport defaults to
   *  {w: innerWidth, h: innerHeight} and is passed explicitly by tests.
   *  @param {CapsReport} caps  @param {object} settings (5.11 document)  @param {string|null} urlTier
   *  @param {{w:number, h:number}} [viewport]
   *  @returns {{tier:string, reason:'initial'|'user'|'url', auto:boolean}} */
  pickTier(caps, settings, urlTier, viewport),

  renderer() /* -> Renderer|null (null when api is 'none') */,
  api() /* -> 'webgl2'|'webgl1'|'none' */,
  tier() /* -> string */,
  tierParams() /* -> TierParams (frozen row of the active tier) */,
  /** Change tier. Clamped to the capability ceiling (6.18.4.2). Returns false when the
   *  name is unknown, equals the active tier after clamping, or a 3D tier is requested while
   *  the context is lost. Emits render.tier {tier, prev, reason, params}. */
  setTier(name, reason /* 'user'|'auto'|'contextLoss'|'url' */) /* -> boolean */,
  setAutoTier(enabled /* boolean */) /* -> void */,
  /** Suspend the auto-downgrade check for ms (M-28 calls holdAutoTier(3000) on mode enter). */
  holdAutoTier(ms) /* -> void */,
  autoTierState() /* -> {enabled, heldUntil, lastDowngradeAt, dialogsOpen} */,

  Math3: { vec3, quat, mat4 },     // function lists in 6.18.4.3
  Scene, Node, Mesh, Material, Texture, Camera, Light,   // classes listed below
  Primitives: {
    box(w, h, d) /* -> Mesh */, plane(w, d) /* XZ, +Y normal */, quad(w, h) /* XY, +Z normal */,
    sphere(r, lon, lat), cylinder(r, h, seg, caps /* boolean */),
    capsule(r, len /* distance between cap centers */, radial, hemiRings), ring(inner, outer, seg)
  },
  /** Cached, reference-counted geometry. params are quantized to 1 mm before keying.
   *  kind: 'box'|'capsule'|'cylinder'|'sphere'|'plane'|'quad'|'ring'. LOD segments come
   *  from the active tier unless params.seg is given. */
  geometry(kind, params) /* -> Mesh */,
  releaseGeometry(mesh) /* -> number refCount after release (0 disposes) */,
  /** Persistent base resources (created by init, part of the leak baseline). */
  base() /* -> {atlas:Texture, blob:Texture, unitQuad:Mesh, unitPlane:Mesh, unitBox:Mesh} */,

  /** Starts the RAF loop. frameFn(audioNow:number seconds, dtMs:number 0..100) runs once per
   *  frame inside a try block (error origin 'frame', Part 4.9). One loop at a time: a second
   *  call stops the first (Log.warn). clock.now() returns audio seconds (frozen values are
   *  allowed). owner tags the frame request for Core.raf.cancelOwner. */
  startLoop(frameFn, opts /* {clock:{now():number}, owner:any} */) /* -> void */,
  stopLoop() /* -> void */,
  loopRunning() /* -> boolean */,

  stats() /* -> RenderStats */,
  counters() /* -> GlCounters */,
  /** Size the drawing buffers from CSS size, DPR and the tier scale (6.18.4.2).
   *  Also called from the ui.layout listener. @returns {{w:number, h:number}} buffer px */
  resize(cssW, cssH, dpr) /* -> {w, h} */,
  /** Test and diagnostics fault hook called by FLM.debug.inject for names starting
   *  'render.' (6.18.4.15). Returns false for unknown names or when unsupported. */
  debugInject(name, args) /* -> boolean */,
  /** Disarms one fault armed by debugInject. */
  debugClear(name) /* -> void */,
  /** Full teardown: stops the loop, deletes every GL object, removes listeners,
   *  counters return to 0. Used by tests and pagehide; not by mode leave. */
  dispose() /* -> void */,

  Flat2D: {
    active() /* -> boolean (true while the Abstract tier is shown) */,
    resize(cssW, cssH, dpr) /* -> void */,
    begin(clearColor /* '#rrggbb' */) /* -> CanvasRenderingContext2D */,
    /** Draws a HighwayModel (produced by M-21 Highway.model()) into rect (CSS px). */
    drawHighway(model, rect /* {x,y,w,h} */) /* -> number shapes */,
    /** Draws visualizer items (M-20 Visualizer.items()) projected into rect. */
    drawVisualizer(items, rect) /* -> number shapes */,
    /** Band columns: one column per performer with activity level and note dots. */
    drawBand(columns /* [{slot, color, level 0..1, notes:[{pitch, alpha}]}] */, rect) /* -> number */,
    drawBeat(beat /* BeatState of 6.20 */, rect) /* -> void */,
    end() /* -> void */,
    clear() /* -> void (clears the canvas; keeps the context) */,
    stats() /* -> {shapes:number} last frame */
  }
};
```

Classes and record types (part of the public API):

```js
// TierParams (frozen) - columns of the table in 6.18.4.2
// { name, resolutionScale, dprCap, antialias, pointLights, blobShadows, capsuleSeg:[radial, hemiRings],
//   sphereSeg:[lon, lat], cylinderSeg, particlesCap, visualizerCap, performersAnimated,
//   animEveryNthFrame, highwayGlow, highwayMaxNotes, fog, stageDetail:'full'|'reduced'|'minimal'|'none',
//   maxDrawsPerFrame }

class Node {
  constructor(name /* string */);
  name; parent /* Node|null */; children /* Node[] */;
  position /* Float32Array(3) */; rotation /* Float32Array(4) quat */; scale /* Float32Array(3) */;
  local /* Float32Array(16) */; world /* Float32Array(16) */;
  visible /* boolean, default true */; mesh /* Mesh|null */; material /* Material|null */;
  layer /* integer 0..7, draw order for transparent buckets */;
  userData /* plain object */;
  add(child) /* -> child; detaches from previous parent */;
  remove(child) /* -> boolean */;
  setPosition(x, y, z) /* -> this; marks dirty */;
  setRotation(q /* quat */) /* -> this */;
  setRotationEuler(x, y, z /* radians, order YXZ */) /* -> this */;
  setScale(x, y, z) /* -> this; non-uniform scale only on nodes without children (asserted in test build) */;
  markDirty() /* -> void */;
  traverse(fn /* (node) => boolean|void; false skips the subtree */) /* -> void */;
  worldPosition(out /* vec3 */) /* -> out (updates world first) */;
  dispose() /* -> void: detaches, releases mesh reference (releaseGeometry), recursive */;
}

class Scene {
  constructor(name);
  root /* Node, not counted */; lights /* Light[] */;
  ambient /* Float32Array(3) */; fog /* {color:Float32Array(3), start:number, end:number, enabled:boolean} */;
  clearColor /* Float32Array(4) */;
  overlay /* Scene|null: the overlay scene owned by this scene (highway pass) */;
  add(node) /* -> node */; remove(node) /* -> boolean */;
  count() /* -> number of nodes below root, plus overlay.count() */;
  clear() /* -> void: disposes every node (and overlay nodes) */;
  updateWorld() /* -> number of world matrices recomputed */;
}

class Mesh {
  // Built by Primitives or geometry(); CPU arrays are kept for context restore.
  id /* integer */; kind /* primitive kind */; key /* cache key or null */;
  positions /* Float32Array */; normals /* Float32Array */; uvs /* Float32Array */; indices /* Uint16Array */;
  vertexCount; indexCount; radius /* bounding sphere radius around the origin */;
  refCount; gl /* {vbo, nbo, tbo, ibo, vao:{lit, unlit}} or null when not uploaded or lost */;
  dispose() /* -> void: deletes GL objects (counted) and drops arrays */;
}

class Material {
  constructor(opts /* {color:'#rrggbb'|[r,g,b], emissive:0..1, unlit:boolean, alpha:0..1,
                       blend:'opaque'|'alpha'|'additive', texture:Texture|null, uvRect:[u0,v0,u1,v1],
                       depthWrite:boolean} */);
  color /* Float32Array(3) linear 0..1 (sRGB hex values are used as-is, no gamma) */;
  emissive; unlit; alpha; blend; texture; uvRect /* Float32Array(4) */; depthWrite;
  setColor(hexOrRgb) /* -> this */;
}

class Texture {
  constructor(name, width, height, draw /* (ctx2d) => void, re-run on restore */);
  id; name; width; height; gl /* WebGLTexture|null */;
  dispose() /* -> void */;
}

class Camera {
  constructor(opts /* {fovYDeg:50, near:0.1, far:100} */);
  position /* vec3 */; target /* vec3 */; up /* vec3 (0,1,0) */;
  fovYDeg; near; far;
  view /* mat4 */; proj /* mat4 */; viewProj /* mat4 */;
  /** Spring goals; follow() moves position and target toward them. */
  goalPosition /* vec3 */; goalTarget /* vec3 */; omega /* rad/s, default 6 */;
  setGoal(pos, target, opts /* {instant:boolean} */) /* -> void */;
  follow(dtMs /* 0..100 */) /* -> void: critically damped spring step (6.18.4.8) */;
  update(aspect) /* -> void: recompute view, proj, viewProj */;
}

class Light {
  constructor(kind /* 'directional'|'point' */, opts /* {color:[r,g,b], intensity, direction|position, range} */);
  kind; color; intensity; direction /* vec3, directional */; position /* vec3, point */; range /* m, point */;
}

// Renderer (one per page; renderer() returns it)
// { gl, api, scene /* Scene: stage */, scene.overlay /* Scene: highway and sparks */,
//   caps:{instancing:'native'|'angle'|'none', vao:boolean, maxAttribs:number, maxTextureSize:number},
//   width() /* drawing buffer px */, height(), lost() /* boolean */,
//   beginFrame() /* resets per-frame stats */,
//   render(scene, camera, opts /* {viewport:[x,y,w,h] buffer px|null, clearColor:boolean,
//          clearDepth:boolean, depthTest:boolean (default true), cull:boolean, maxLights:number|null} */)
//          /* -> {draws, tris} */,
//   endFrame() /* -> {draws, tris, skippedDraws} */,
//   upload(mesh) /* -> boolean */, uploadTexture(tex) /* -> boolean */ }

// RenderStats { fps, p50, p95 /* ms over the last 5 s */, frames /* total since startLoop */,
//               draws, tris, skippedDraws /* last frame */, tier, api, downgraded /* boolean, any auto
//               downgrade this session */, lost /* boolean */, losses /* count this session */ }
// GlCounters { glBuffers, glTextures, glPrograms, glShaders, glVaos }
```

Events emitted (catalog 4.4): `render.tier {tier, prev, reason, params}` per change;
`render.contextLost {tier, at}`; `render.contextRestored {tier, ms, rebuilt:{buffers,
textures, programs}, fallback}`; `render.stats {fps, p50, p95, frames, draws, tris, tier,
downgraded}` at 1 Hz while the loop runs and `bus.listenerCount('render.stats') > 0`.

Events consumed: `settings.changed` for `video.tier` (user tier, disables auto when not
`auto`), `video.resolutionScale` (resize); `ui.layout` (resize with `width`, `height`,
`dpr`); `ui.dialog` (open dialog count, suspends the auto-downgrade check).

#### 6.18.3 Internal state

- `st = {api, gl, view, flat, ctx2d, tier, autoEnabled, heldUntil, lastDowngradeAt,
  downgraded, dialogsOpen, lost, lostAt, losses: number[] /* perf ms of each loss within
  60 s */, fellBack, restoreTimer, cssW, cssH, dpr}`.
- `programs = {lit, unlit}`: `{program, uniforms: Map<name, location>, attribs}`; both are
  rebuilt on restore from the source strings in 6.18.4.6.
- `ext = {instancing, vao, loseContext}`: extension objects (WebGL1) or null.
- `counters = {glBuffers, glTextures, glPrograms, glShaders, glVaos}`: incremented by the
  counted wrappers `glx.createBuffer()`, `glx.createTexture()`, `glx.createProgram()`,
  `glx.createShader()`, `glx.createVertexArray()` and decremented by the matching
  `glx.delete*`; zeroed (not decremented) when the context is lost because the objects no
  longer exist.
- `meshes: Set<Mesh>` of live uploaded meshes and `textures: Set<Texture>` (for eager
  re-upload on restore). `geoCache: Map<key, Mesh>` with `refCount`.
- `base = {atlas, blob, unitQuad, unitPlane, unitBox}`: created by `init`, never disposed
  until `dispose()`; part of the leak baseline (Part 4.7.3).
- Instance staging: `staging = {lit: Float32Array, unlit: Float32Array}` grown by doubling
  (initial 256 instances, cap 8,192 instances); one streaming `ARRAY_BUFFER` per program
  (`DYNAMIC_DRAW`).
- Frame statistics: `ring = Float32Array(300)` raw frame deltas in ms, `ringT =
  Float64Array(300)` RAF timestamps, write index, count; `frames` total; `lastStatsAt`;
  `fpsWindow` frame count in the current second.
- Loop: `{running, frameFn, clock, owner, frameId, lastRaf, frameErrors: number[]}`.
- Faults: `{slowFrames: {ms, left} | null, shaderFail: boolean}`.

Invariants: exactly one context per page life (restore reuses the same canvas and context
object); `counters` equal the number of live GL objects created through `glx`; a Node with
children has a uniform scale; `scene.count()` is 0 whenever no stage is built; every Mesh in
`meshes` has non-null CPU arrays; `TIERS` and `GLYPHS` are deep-frozen (S-07).

#### 6.18.4 Algorithms

6.18.4.1 Context acquisition (`init`)

1. If already initialized return the stored result.
2. `attrs = {alpha:false, antialias:TIERS[pick.tier].antialias === true, depth:true,
   stencil:false, premultipliedAlpha:false, preserveDrawingBuffer:false,
   powerPreference:'high-performance', failIfMajorPerformanceCaveat:false}` (ADR-03 decision 1).
   The `antialias` attribute is fixed for the context's life: a later tier change never
   recreates the context (one context per page, mobile browsers limit live contexts).
3. If `pick.tier === 'Abstract'` skip to step 7 with `api = 'none'` (a user or URL choice of
   Abstract never creates a GL context).
4. Try in order, each inside `try/catch`: `view.getContext('webgl2', attrs)` (api `webgl2`),
   `view.getContext('webgl', attrs)`, `view.getContext('experimental-webgl', attrs)` (api
   `webgl1`). The first non-null result wins.
5. With a context: query `MAX_VERTEX_ATTRIBS` (must be >= 8, else treat as failure),
   `MAX_TEXTURE_SIZE`; WebGL1 extensions `ANGLE_instanced_arrays` (instancing `'angle'`, else
   `'none'`), `OES_vertex_array_object` (vao); WebGL2 has both natively; `WEBGL_lose_context`
   (for the fault hook only). Compile and link the two programs (6.18.4.6). A compile or link
   failure reports `E-REN-002` with the info log (truncated to 500 chars) and drops directly
   to the Abstract tier (`api = 'none'`, the GL context is left unused). WebGL1 is not tried
   after a WebGL2 program failure because a canvas cannot switch context type once one is
   created, and the shaders use only GLSL ES 1.00 features, so this branch occurs only on
   broken drivers.
6. Create base resources: glyph atlas and blob textures (6.18.4.10), unit meshes (quad,
   plane, box), the streaming instance buffers, and install the context-loss listeners
   (6.18.4.11). A null from any `create*` reports `E-REN-005` and drops to Abstract.
7. No context, or step 5/6 failed: `api = 'none'`, tier `Abstract`, report `E-REN-001`
   (recoverable; class from 4.9 defaults) with `context.reason` naming the failed step.
8. Get the 2D context of `flat` (`getContext('2d', {alpha:false})`). If null and the tier is
   Abstract: `ErrorReporter.fatal('E-CAP-002', ...)` (the 2D canvas is a hard capability,
   Part 4.3 B4, so this only happens on a broken page).
9. Clamp the requested tier to the ceiling: `api === 'none'` -> Abstract; `api ===
   'webgl1'` -> at most Balanced. Apply visibility: Abstract shows `#flat` and hides
   `#view` (`hidden` attribute); 3D tiers the reverse. Call `resize()` with the current
   `#app` client size and `devicePixelRatio`.
10. Subscribe (owner `RENDER_OWNER`, a module-level symbol that is part of the boot baseline)
    to `settings.changed`, `ui.layout`, `ui.dialog`. Emit `render.tier {tier, prev:null,
    reason: pick.reason === 'url' ? 'url' : 'initial', params}`. Return the result.

6.18.4.2 Tier table, selection, downgrade and resolution

Normative tier rows (ADR-03 decision 2 values plus the module-level parameters decided
here):

| Parameter | High | Balanced | Low | Abstract |
|---|---|---|---|---|
| resolutionScale | 1.0 | 0.75 | 0.5 | 1.0 (2D canvas) |
| dprCap | 2 | 2 | 1.5 | 2 |
| antialias | true | true | false | n/a |
| pointLights | 4 | 2 | 0 | 0 |
| blobShadows | true | true | false | false |
| capsuleSeg [radial, hemiRings] | [16, 4] (16 x 8 total rings) | [10, 3] | [6, 2] | n/a |
| sphereSeg [lon, lat] | [16, 12] | [12, 8] | [8, 6] | n/a |
| cylinderSeg | 16 | 12 | 8 | n/a |
| particlesCap (sparks, beat pulses) | 256 | 96 | 0 | 0 |
| visualizerCap (informational items, 6.20) | 128 | 96 | 48 | 64 |
| performersAnimated | 5 | 5 | 3 | 0 (band columns only) |
| animEveryNthFrame | 1 | 1 | 2 | n/a |
| highwayGlow | true | true | false | false |
| highwayMaxNotes (visible note instances) | 400 | 300 | 200 | 200 |
| fog | true | true | true | n/a |
| stageDetail | full | reduced | minimal | none |
| maxDrawsPerFrame | 1200 | 900 | 600 | n/a |

Mapping to the five fallback levels of B 12.7: level 1 full stage and skeletal animation =
High; level 2 reduced geometry and lighting = Balanced; level 3 reduced animation
complexity = Low (3 animated performers, every second frame); level 4 simplified stage with
abstract visualizations = Low with `stageDetail: minimal` plus the abstract visualizer for
every performer that is not animated (6.20.4.10); level 5 lightweight non-3D visualization =
Abstract.

`pickTier(caps, settings, urlTier)`:

```js
function ceiling(caps) { return caps.webgl2 ? 'High' : caps.webgl1 ? 'Balanced' : 'Abstract'; }
function clampTier(name, ceil) {
  const order = TIER_ORDER;
  return order.indexOf(name) < order.indexOf(ceil) ? ceil : name;   // lower index = higher tier
}
function pickTier(caps, settings, urlTier) {
  const ceil = ceiling(caps);
  if (urlTier && TIERS[urlTier]) return { tier: clampTier(urlTier, ceil), reason: 'url', auto: false };
  const user = settings && settings.video && settings.video.tier;          // 'auto','high',...
  const NAMES = { high: 'High', balanced: 'Balanced', low: 'Low', abstract: 'Abstract' };
  if (user && user !== 'auto' && NAMES[user]) return { tier: clampTier(NAMES[user], ceil), reason: 'user', auto: false };
  let tier;
  if (caps.webgl2 && caps.maxTouchPoints === 0 && Math.min(innerWidth, innerHeight) >= 600) tier = 'High';
  else if (caps.webgl2) tier = 'Balanced';
  else if (caps.webgl1) tier = 'Low';
  else tier = 'Abstract';
  return { tier, reason: 'initial', auto: true };
}
```

`innerWidth` and `innerHeight` are read through a `viewport` argument in tests
(`pickTier(caps, settings, urlTier, {w, h})`, the fourth parameter defaults to the window).

Auto-downgrade (ADR-03 decision 4), run by the loop once per second (on the stats tick):

1. Skip when `!autoEnabled`, `Core.now() < heldUntil`, `dialogsOpen > 0`, `st.lost`,
   tier is Abstract, or `Core.now() - lastDowngradeAt < 10000`.
2. Window: the ring entries with `ringT >= now - 5000` and raw delta `<= 1000 ms` (a delta
   above 1 s is a hidden-tab or device-sleep gap, not a slow frame; it is still recorded for
   p95 statistics shown in diagnostics). Require at least 60 entries.
3. `p95 = sorted(window)[ceil(0.95 * n) - 1]`. If `p95 > 33` ms:
   `setTier(next lower tier, 'auto')`, `lastDowngradeAt = now`, `downgraded = true`,
   clear the ring. M-27 shows the toast "Graphics quality lowered to <tier> to keep the music
   smooth" on `render.tier` with `reason:'auto'`.
4. There is no automatic upgrade.

`autoEnabled` starts as `pick.auto`; `settings.changed` for `video.tier` sets it to
`value === 'auto'` and, for a concrete value, calls `setTier(<name>, 'user')`. The
`visibilitychange` gap is handled by step 2; additionally `resize` and `setTier` clear the
ring so a re-layout spike never counts.

`setTier(name, reason)`:

1. Unknown name -> `false`. `target = clampTier(name, ceilingFromApi())` where the ceiling
   is High for `webgl2`, Balanced for `webgl1`, Abstract for `none`.
2. `target === tier` -> `false`. 3D target while `st.lost` or `st.fellBack` and reason is
   not `'user'` -> `false`. A `'user'` request for a 3D tier after a fallback is allowed only
   when the context is not lost (`!gl.isContextLost()`); it clears `fellBack`.
3. `prev = tier; tier = target`. Canvas visibility per 6.18.4.1 step 9. `resize()` with the
   stored CSS size. Base unit meshes are rebuilt only when their segment counts depend on
   the tier (the unit sphere and cylinder are not base meshes; they are cached geometry
   that M-21 re-requests on `render.tier`).
4. Clear the frame ring; emit `render.tier {tier, prev, reason, params: TIERS[tier]}`;
   return `true`.

Resolution (`resize(cssW, cssH, dpr)`): `scale = settings video.resolutionScale > 0 ?
that value : TIERS[tier].resolutionScale`; `effDpr = Math.min(dpr, TIERS[tier].dprCap)`;
`bufW = Math.max(1, Math.round(cssW * effDpr * scale))`, same for height. For 3D tiers set
`view.width/height` to the buffer size (CSS size stays 100 percent through the stylesheet);
for Abstract set `flat.width/height = round(css * min(dpr, 2))` and
`ctx2d.setTransform(effDpr, 0, 0, effDpr, 0, 0)` so Flat2D draws in CSS px. Returns the
buffer size. Resize never touches musical state.

6.18.4.3 Math library (`Math3`)

Conventions: right-handed, +Y up, camera looks along -Z in view space; matrices are
column-major `Float32Array(16)` (GL order); quaternions are `Float32Array(4)` `[x, y, z,
w]`; angles in radians; every function writes into its first argument `out` and returns it
(no allocation in hot paths); module-level scratch arrays are used internally and never
returned.

| Namespace | Functions |
|---|---|
| `vec3` | `create(x?, y?, z?)`, `set(out, x, y, z)`, `copy(out, a)`, `add(out, a, b)`, `sub(out, a, b)`, `scale(out, a, s)`, `scaleAndAdd(out, a, b, s)`, `dot(a, b)`, `cross(out, a, b)`, `length(a)`, `distance(a, b)`, `normalize(out, a)` (zero vector stays zero), `lerp(out, a, b, t)`, `transformMat4(out, a, m)` (w = 1, with perspective divide), `transformQuat(out, a, q)`, `equals(a, b, eps = 1e-5)` |
| `quat` | `create()` (identity), `identity(out)`, `setAxisAngle(out, axis, rad)`, `fromEuler(out, x, y, z)` (order YXZ: yaw, then pitch, then roll), `multiply(out, a, b)` (a then b in parent-to-child order: `out = a * b`), `conjugate(out, a)`, `invert(out, a)`, `normalize(out, a)`, `dot(a, b)`, `slerp(out, a, b, t)` (shortest path; falls back to nlerp when `dot > 0.9995`), `nlerp(out, a, b, t)` (sign-corrected), `rotationTo(out, from, to)` (unit vectors; antiparallel picks an orthogonal axis), `getAngle(a, b)` (radians between two rotations) |
| `mat4` | `create()` (identity), `identity(out)`, `copy(out, a)`, `multiply(out, a, b)` (`out = a * b`), `fromRotationTranslationScale(out, q, v, s)`, `fromQuat(out, q)`, `invert(out, a)` (returns `null` when singular), `transpose(out, a)`, `perspective(out, fovY, aspect, near, far)` (GL clip space z in -1..1), `ortho(out, l, r, b, t, n, f)`, `lookAt(out, eye, center, up)` (degenerate up -> uses +Z), `getTranslation(out, m)`, `maxScale(m)` (largest column length, for bounding spheres), `normalFromMat4(out3, m)` (`Float32Array(9)`, inverse-transpose of the upper 3 x 3; used by tests to validate the shader's per-instance normal trick) |

6.18.4.4 Scene graph update

```text
Node.setPosition/setRotation/setScale: write the component, this.dirty = true
Scene.updateWorld():
  count = 0
  visit(root, parentChanged = false)
  visit(node, parentChanged):
    changed = parentChanged or node.dirty
    if node.dirty: mat4.fromRotationTranslationScale(node.local, node.rotation, node.position, node.scale); node.dirty = false
    if changed:
      if node.parent is root or null: copy(node.world, node.local) else multiply(node.world, node.parent.world, node.local)
      count++
    for child in node.children: visit(child, changed)
  overlay && overlay.updateWorld()
  return count
```

Invisible nodes are still updated (attachment points of hidden performers stay valid);
`traverseVisible` used by `render` skips invisible subtrees. `Node.add` detaches the child
from its old parent and marks it dirty. `Node.dispose()` recursively calls
`releaseGeometry(mesh)` for nodes whose mesh came from `geometry()` (meshes created by
`Primitives` directly are disposed with the node when `node.userData.ownsMesh === true`).

6.18.4.5 Primitive geometry (exact; every primitive is centered at the origin)

| Primitive | Vertices | Indices | Construction |
|---|---|---|---|
| `box(w, h, d)` | 24 (4 per face, flat normals) | 36 | faces +X, -X, +Y, -Y, +Z, -Z; uv (0,0)-(1,1) per face |
| `plane(w, d)` | 4 | 6 | XZ plane, normal +Y, uv u along +X, v along -Z |
| `quad(w, h)` | 4 | 6 | XY plane, normal +Z, uv (0,0) at bottom-left |
| `sphere(r, lon, lat)` | `(lon + 1) * (lat + 1)` | `lon * lat * 6` | `phi = PI * i / lat` from +Y pole, `theta = 2 PI j / lon`; `p = r * (sin phi cos theta, cos phi, sin phi sin theta)`; normal = p / r |
| `cylinder(r, h, seg, caps)` | side `(seg + 1) * 2`, plus caps `2 * (seg + 2)` | side `seg * 6`, plus caps `2 * seg * 3` | along Y from `-h/2` to `+h/2`; side normals radial; cap normals +Y and -Y with a center vertex |
| `capsule(r, len, radial, hemiRings)` | `(radial + 1) * 2 * (hemiRings + 1)` | `radial * (2 * hemiRings + 1) * 6` | top hemisphere rings `i = 0..hemiRings`: `phi = (PI / 2) * (1 - i / hemiRings)`, `y = len / 2 + r sin phi`, ring radius `r cos phi`; bottom rings `i = 0..hemiRings`: `phi = -(PI / 2) * i / hemiRings`, `y = -len / 2 + r sin phi`; normal `(cos phi cos theta, sin phi, cos phi sin theta)`; the band between the two equator rings is the cylinder section |
| `ring(inner, outer, seg)` | `(seg + 1) * 2` | `seg * 6` | XZ annulus, normal +Y, uv u = angle / 2 PI, v = 0 inner, 1 outer |

Triangles wind counter-clockwise seen from outside (front faces, `gl.CULL_FACE` with
`BACK`). `radius` is the farthest vertex distance from the origin. Reference counts for the
High-tier limb capsule `capsule(0.05, 0.3, 16, 4)`: 170 vertices, 864 indices, y range
-0.2..0.2. Geometry cache keys: `kind + ':' + quantized params joined by ':'` where lengths
are rounded to 1 mm (`Math.round(v * 1000)`) and segment counts are integers, so two
performers with equal body proportions share every limb mesh.

6.18.4.6 Shader sources (GLSL ES 1.00; the same text is compiled on WebGL2 and WebGL1)

Decision: one GLSL ES 1.00 source per program, no `#version 300 es` variant. WebGL2 accepts
ES 1.00 shaders, instancing is configured through the API (`vertexAttribDivisor`), and the
feature set needed (Lambert, 4 point lights, fog, one texture) has no ES 3.00 requirement.
This halves the shader surface and makes the WebGL1 path the tested path.

Attribute locations are bound before linking (`bindAttribLocation`): `aPos 0`, `aNormal 1`
(lit) or `aUV 1` (unlit), `aM0 2`, `aM1 3`, `aM2 4`, `aM3 5`, `aColor 6`, `aUVRect 7` (unlit
only). The lit program uses 7 attributes and the unlit program 8, within the WebGL1 minimum
`MAX_VERTEX_ATTRIBS = 8`. The per-instance model matrix arrives as four column attributes;
the `w` components of the first three columns (which are always 0 for an affine matrix)
carry the inverse squared scale of the node, so the normal matrix is reconstructed without
a ninth attribute: for `M = R S` (rigid parents, leaf scale `S`), `(M^-1)^T n = R S^-1 n =
M3 (S^-2 n)`.

Lit vertex shader:

```text
precision highp float;
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec4 aM0;
attribute vec4 aM1;
attribute vec4 aM2;
attribute vec4 aM3;
attribute vec4 aColor;               // rgb color, a = emissive strength 0..1
uniform mat4 uViewProj;
uniform mat4 uView;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vColor;
varying float vDepth;
void main() {
  mat4 m = mat4(vec4(aM0.xyz, 0.0), vec4(aM1.xyz, 0.0), vec4(aM2.xyz, 0.0), aM3);
  vec3 invS2 = vec3(aM0.w, aM1.w, aM2.w);
  vec4 world = m * vec4(aPos, 1.0);
  vNormal = mat3(m[0].xyz, m[1].xyz, m[2].xyz) * (aNormal * invS2);
  vWorld = world.xyz;
  vColor = aColor;
  vDepth = -(uView * world).z;
  gl_Position = uViewProj * world;
}
```

Lit fragment shader:

```text
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vNormal;
varying vec3 vWorld;
varying vec4 vColor;
varying float vDepth;
uniform vec3 uAmbient;
uniform vec3 uDirDir;                // normalized direction the light travels
uniform vec3 uDirColor;
uniform vec4 uPointPos[4];           // xyz position, w range in meters (unused lights: color 0)
uniform vec3 uPointColor[4];
uniform vec3 uFogColor;
uniform vec3 uFog;                   // x start, y end, z enabled (0 or 1)
void main() {
  vec3 n = normalize(vNormal);
  vec3 light = uAmbient + uDirColor * max(dot(n, -uDirDir), 0.0);
  for (int i = 0; i < 4; i++) {
    vec3 d = uPointPos[i].xyz - vWorld;
    float dist = length(d);
    float att = clamp(1.0 - dist / uPointPos[i].w, 0.0, 1.0);
    light += uPointColor[i] * max(dot(n, d / max(dist, 0.0001)), 0.0) * att * att;
  }
  vec3 c = vColor.rgb * light + vColor.rgb * vColor.a;
  float f = mix(1.0, clamp((uFog.y - vDepth) / (uFog.y - uFog.x), 0.0, 1.0), uFog.z);
  gl_FragColor = vec4(mix(uFogColor, c, f), 1.0);
}
```

Unlit vertex shader (highway, sprites, blob shadows, particles, visualizer items):

```text
precision highp float;
attribute vec3 aPos;
attribute vec2 aUV;
attribute vec4 aM0;
attribute vec4 aM1;
attribute vec4 aM2;
attribute vec4 aM3;
attribute vec4 aColor;               // rgba tint
attribute vec4 aUVRect;              // u0, v0, u1, v1 inside the atlas
uniform mat4 uViewProj;
varying vec2 vUV;
varying vec4 vColor;
void main() {
  mat4 m = mat4(vec4(aM0.xyz, 0.0), vec4(aM1.xyz, 0.0), vec4(aM2.xyz, 0.0), aM3);
  vUV = mix(aUVRect.xy, aUVRect.zw, aUV);
  vColor = aColor;
  gl_Position = uViewProj * (m * vec4(aPos, 1.0));
}
```

Unlit fragment shader:

```text
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUV;
varying vec4 vColor;
uniform sampler2D uTex;
uniform float uUseTex;               // 0 = solid tint, 1 = texture * tint
void main() {
  vec4 t = mix(vec4(1.0), texture2D(uTex, vUV), uUseTex);
  vec4 c = t * vColor;
  if (c.a < 0.01) discard;
  gl_FragColor = c;
}
```

Compilation (`compileProgram(vsText, fsText, attribNames)`): create both shaders through
`glx`, `shaderSource`, `compileShader`; if `getShaderParameter(COMPILE_STATUS)` is false
read the info log, delete both, report `E-REN-002` and return null; `createProgram`, attach,
`bindAttribLocation` for every name in order, `linkProgram`; on failure the same handling;
on success `detachShader` and `deleteShader` both (so `glShaders` returns to 0), cache
every uniform location by name. The `render.shaderFail` fault forces the next call to take
the failure branch.

6.18.4.7 Draw procedure (`Renderer.render(scene, camera, opts)`)

```text
render(scene, camera, opts):
  if st.lost or gl.isContextLost(): return {draws:0, tris:0}
  scene.updateWorld()
  vp = opts.viewport or [0, 0, bufW, bufH]; gl.viewport(...vp)
  if opts.viewport: enable SCISSOR_TEST with the same rect, else disable
  clear bits: COLOR if opts.clearColor (scene.clearColor), DEPTH if opts.clearDepth (default true)
  depth test enabled unless opts.depthTest === false (overlay passes draw strictly in layer order)
  camera.update(vp[2] / vp[3])
  items = []
  traverseVisible(scene.root): node with mesh and material ->
     if opts.cull !== false: sphere test (world translation, mesh.radius * mat4.maxScale(world))
        against the 6 frustum planes of camera.viewProj; outside -> skip
     items.push(node)
  bucket key = (material.unlit ? 'U' : 'L') + mesh.id + ':' + (texture ? texture.id : 0) + ':' + blend + ':' + layer
  opaque buckets (blend 'opaque'): sorted by program, then mesh id
  transparent buckets: sorted by layer ascending, then by the camera distance of the first item descending
  state: opaque -> depthMask true, BLEND off; alpha -> depthMask material.depthWrite (default false),
         blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA); additive -> blendFunc(SRC_ALPHA, ONE), depthMask false
  lights (lit program, uploaded once per pass): ambient, the first directional light, the
         point lights sorted by intensity descending truncated to min(TIERS[tier].pointLights,
         opts.maxLights ?? 4); unused slots get color 0 and range 1
  fog: uFog = (scene.fog.start, scene.fog.end, TIERS[tier].fog && scene.fog.enabled ? 1 : 0)
  fill staging: for each bucket, for each item, write 20 floats (lit: M columns with invS2 in w,
         color rgb + emissive) or 24 floats (unlit: M columns, rgba tint, uvRect); upload once per
         program per pass with bufferData(ARRAY_BUFFER, stagingView, DYNAMIC_DRAW)
  for each bucket:
     bind program (if changed), mesh attributes (VAO when available, else attribPointer calls)
     if caps.instancing !== 'none' and bucket.length >= 2:
        instance attribs: vertexAttribPointer at the bucket's byte offset, divisor 1
        drawElementsInstanced(TRIANGLES, mesh.indexCount, UNSIGNED_SHORT, 0, bucket.length); draws += 1
     else:
        disable instance attrib arrays; for each item: gl.vertexAttrib4f per instance attribute
        (constant attribute values), drawElements; draws += bucket.length
     tris += mesh.indexCount / 3 * bucket.length
     if draws > TIERS[tier].maxDrawsPerFrame and bucket.layer >= 3: skip the remaining buckets with
        layer >= 3 (decorative), skippedDraws += their item count
  restore: divisor 0 on instance attributes, disable scissor
  return {draws, tris}
```

Material color to instance color: lit `aColor = (r, g, b, emissive)`; unlit `aColor = (r,
g, b, alpha)`. `invS2` per item is `(1 / sx^2, 1 / sy^2, 1 / sz^2)` from the node's own
scale (ancestors are uniform by the Node invariant, so their scale only changes the normal
length, which the fragment shader normalizes). Draw layers used by the stage: 0 opaque
geometry, 1 blob shadows, 2 stage light cones and floor glows, 3 visualizer items, 4
sparks; in the overlay scene: 0 lanes and beat lines, 1 hold tails, 2 chord connectors, 3
note bodies, 4 glyphs, 5 hit line and receptors, 6 sparks.

6.18.4.8 Camera follow spring (critically damped, exact step)

```js
// one component; position and target vec3 run three of these each. omega in rad/s.
function springStep(x, v, goal, omega, dtSec) {
  const e = Math.exp(-omega * dtSec);
  const change = x - goal;
  const temp = (v + omega * change) * dtSec;
  const nv = (v - omega * temp) * e;
  const nx = goal + (change + temp) * e;
  return [nx, nv];
}
```

`Camera.follow(dtMs)` converts `dtMs` (clamped 0..100 by the loop) to seconds and steps the
six components with `omega = this.omega` (default 6 rad/s: 95 percent of a step settles in
about 0.8 s, no overshoot). This exact solution is unconditionally stable, so a 100 ms frame
never overshoots. `setGoal(pos, target, {instant:true})` sets position and target to the
goals and zeros the velocities (used for reduced motion, the first frame of a stage, and
when camera motion is disabled). The camera only smooths visuals; nothing reads its state
for timing (S-01).

6.18.4.9 Lights and blob shadows

- Default stage lighting (set by M-21, values decided here so the shaders' ranges are
  known): ambient `(0.30, 0.32, 0.38)`; one directional light, direction
  `normalize(-0.35, -1.0, -0.45)`, color `(0.85, 0.82, 0.78)`; up to 4 point lights with
  range 6 m and intensity 0..1.5 (beat pulses modulate intensity, 6.21.4.6).
- Blob shadows: a `unitPlane` node per performer and per large prop, scaled to the
  footprint (performer: `(2.2 * shoulderHalfWidth, 1, 0.7)`), at `y = floor + 0.004`,
  material unlit, texture `blob`, tint `(0, 0, 0, 0.55)`, blend alpha, layer 1, depthWrite
  false. Hidden when `TIERS[tier].blobShadows` is false.

6.18.4.10 Persistent textures

Glyph atlas (`base().atlas`, 256 x 256, 64 px cells), drawn on an offscreen 2D canvas and
uploaded with `CLAMP_TO_EDGE`, `LINEAR` min and mag filters, no mipmaps (valid for any size
on WebGL1), `UNPACK_PREMULTIPLY_ALPHA_WEBGL false`:

| Row | Col 0 | Col 1 | Col 2 | Col 3 |
|---|---|---|---|---|
| 0 | `lane0` circle | `lane1` triangle | `lane2` square | `lane3` diamond |
| 1 | `left` arrow | `down` arrow | `up` arrow | `right` arrow |
| 2 | `softDot` (radial gradient white alpha 1 -> 0) | `ring` (circle stroke 5 px) | `frame` (rounded rect, radius 12 px, white fill, 3 px white border at alpha 1, inner alpha 0.85) | `spark` (4-point star) |
| 3 | `holdBody` (vertical bar alpha 0.9 center, 0.6 edges) | `solid` (white) | `beatTick` (horizontal bar 8 px) | reserved (transparent) |

Glyph cells are filled white with a 3 px stroke `rgba(0, 0, 0, 0.85)`, path coordinates from
`GLYPHS` scaled by `64 / 24` with the cell origin at its top-left (Part 3.2.5 rule). UV
rectangles are inset by half a texel (`0.5 / 256`) to prevent bleeding. The texture `draw`
function is kept so the atlas is regenerated on restore. Blob texture (`base().blob`, 64 x 64):
radial gradient alpha 1 at the center to 0 at radius 32, color black.

6.18.4.11 Context loss and restore

```text
on 'webglcontextlost' (listener via Core.dom.on(view, ..., {passive:false}, RENDER_OWNER)):
  e.preventDefault()                       // required for a restore to be offered
  st.lost = true; st.lostAt = Core.now()
  st.losses = st.losses filtered to the last 60 s, then push lostAt
  for every Mesh in meshes and Texture in textures: obj.gl = null   (CPU arrays and draw fns kept)
  programs.* = null; staging buffers = null; counters.* = 0
  emit render.contextLost {tier, at: lostAt}; ErrorReporter.report('E-REN-003', null, {tier})  (recoverable, toast suppressed: M-28 shows the HUD note "Graphics paused")
  if st.losses.length >= 3: fallBack('repeated') and return
  st.restoreTimer = Core.timers.setTimeout(() => fallBack('timeout'), RESTORE_TIMEOUT_MS, RENDER_OWNER)

on 'webglcontextrestored':
  Core.timers.clearTimeout(st.restoreTimer)
  t0 = Core.now()
  rebuild: compile programs (6.18.4.6); re-create staging buffers; upload every Texture in textures
           (re-run its draw fn) and every Mesh in meshes (eager, so the first frame does not stall)
  if any step fails: report E-REN-004 and fallBack('rebuild') and return
  st.lost = false
  if st.fellBack: Log.info('render', 'restored after fallback; staying Abstract'); return   (no event: tier unchanged)
  emit render.contextRestored {tier, ms: Core.now() - t0, rebuilt:{buffers, textures, programs}, fallback:false}

fallBack(why):
  st.fellBack = true
  ErrorReporter.report('E-REN-004', null, {why, tier})
  setTier('Abstract', 'contextLoss')        // shows #flat; render.tier reason 'contextLoss'
  emit render.contextRestored {tier:'Abstract', ms: Core.now() - st.lostAt, rebuilt:{buffers:0, textures:0, programs:0}, fallback:true}
```

The loop keeps running during a loss: `frameFn` is called every frame (the stage keeps its
animation state current), `render()` returns immediately, so nothing is drawn until the
restore or the fallback. Transport, audio and scoring are never called by M-18 (S-15). A
restore that arrives after a fallback rebuilds GL objects silently and the tier stays
Abstract until the user chooses a 3D tier in SCR-Settings (no flip-flopping between
visual modes during a song).

6.18.4.12 Loop and statistics

```text
startLoop(frameFn, {clock, owner}):
  if loop.running: Log.warn('render', 'startLoop while running'); stopLoop()
  loop = {running:true, frameFn, clock, owner, lastRaf:null}; frames = 0
  loop.frameId = Core.raf.request(step, owner)
step(tRaf):
  if !loop.running: return
  raw = loop.lastRaf === null ? 16.7 : tRaf - loop.lastRaf
  dt = clamp(raw, 0, 100); loop.lastRaf = tRaf
  record(raw, tRaf); frames++
  if faults.slowFrames: busy-wait until Core.now() >= start + faults.slowFrames.ms; decrement left; clear at 0
  audioNow = loop.clock.now()
  renderer && renderer.beginFrame()
  try { loop.frameFn(audioNow, dt) }
  catch (e) { ErrorReporter.report('E-REN-008', e, {origin:'frame'}) }   // escalation rules of 4.9 live in M-01
  renderer && renderer.endFrame()
  if tRaf - lastStatsAt >= 1000: computeStats(); autoTierCheck(); maybe emit render.stats; lastStatsAt = tRaf
  loop.frameId = Core.raf.request(step, loop.owner)
stopLoop(): loop.running = false; Core.raf.cancel(loop.frameId)
computeStats(): window = ring entries with ringT >= now - 5000; p50 and p95 by sorting a copy
  (<= 300 values); fps = frames counted in the last 1,000 ms
```

The frame callback receives `audioNow` exactly as the injected clock reports it; M-18 never
modifies it and never derives musical time (S-01). A thrown frame skips that frame's drawing
only; the next frame runs normally.

6.18.4.13 Counters and disposal

Every GL object is created through `glx` (`createBuffer`, `createTexture`, `createProgram`,
`createShader`, `createVertexArray` mapped to `OES_vertex_array_object` on WebGL1) and
deleted through it; `counters()` returns a copy. `Mesh.dispose()` deletes its buffers and
VAOs and removes it from `meshes`; `releaseGeometry` decrements `refCount` and disposes at 0
(removing the cache entry). `Scene.clear()` disposes every node. `Render.dispose()` stops the
loop, clears both scenes, disposes every cached mesh, the base resources, staging buffers and
programs, removes the context listeners and bus subscriptions (owner `RENDER_OWNER`), and
leaves `counters()` all zero.

6.18.4.14 Flat2D (Abstract tier surface)

- Uses `canvas#flat` with the 2D context of 6.18.4.1 step 8; all coordinates are CSS px
  after the DPR transform. Glyphs are drawn from `GLYPHS` with `Path2D` (the `'O'` command
  maps to `arc`); `Path2D` objects are built once at init.
- `drawHighway(model, rect)`: draws, in order, the lane background strips (lane color at
  alpha 0.10), beat lines (1 px, alpha 0.25; bar lines 2 px alpha 0.45), loop shading
  (alpha 0.12 `#4cc3e6`), hold tails (lane color alpha 0.5, width 40 percent of the lane),
  chord connectors (white alpha 0.6, 4 px), note bodies (rounded rects in lane color), glyphs
  (white fill, black stroke, centered), the hit line (2 px white) and receptors (glyph outline
  in lane color, filled when `pressed` or flashing). Item coordinates come from the model in
  normalized units (`x` lane 0..3, `y` 0 at the hit line to 1 at the far end); `rect` maps them
  to pixels. Missed notes are drawn at alpha 0.35 with a gray `#68768a` body.
- `drawVisualizer(items, rect)`: each item `{kind, x, y, size, color, alpha}` in normalized
  stage coordinates (x -1..1 left to right, y 0..1 bottom to top): `note` filled circle,
  `ring` stroked circle, `pitch` vertical bar, `trail` polyline of up to 8 points.
- `drawBand(columns, rect)`: one column per performer (equal widths, 8 px gap), level drawn
  as a filled bar from the bottom, active notes as dots at height `(pitch - 24) / 84`.
- `drawBeat(beat, rect)`: a row of `numerator` dots, the current beat filled; the downbeat
  dot is larger. Shown in the Abstract tier only (3D tiers show beats on the highway and the
  stage lights).
- `clear()` fills `--c-bg` (`#0e1116`). Flat2D allocates no GL objects and is not counted.

6.18.4.15 Fault hooks (`debugInject(name, args)`, `debugClear(name)`)

| Name | Args | Effect |
|---|---|---|
| `render.contextLoss` | `{restoreAfterMs: number or null}` | calls `WEBGL_lose_context.loseContext()`; when `restoreAfterMs` is a number, schedules `restoreContext()` after that delay (owner `RENDER_OWNER`); returns false when the extension is missing or the api is `none` |
| `render.slowFrames` | `{ms: 300, frames: 100}` defaults | busy-waits `ms` inside each of the next `frames` frames, before `frameFn` |
| `render.shaderFail` | none | the next `compileProgram` call fails (used before `init` in tests) |

#### 6.18.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| No WebGL context (E-REN-001) | every `getContext` null or throwing | transport, audio, project untouched | no (per page) | no | Settings Video shows "3D stage unavailable in this browser; using the flat visualizer." (Part 4.3 B4 text) | Abstract tier (Flat2D) | n/a | UT-18-08 |
| Shader compile or link failure (E-REN-002) | `COMPILE_STATUS`/`LINK_STATUS` false | context unused, Flat2D | no | no | toast "Graphics were simplified to {tier} after a graphics error."; info log in diagnostics | Abstract | n/a | UT-18-10 |
| Context lost (E-REN-003) | `webglcontextlost` | every CPU-side mesh and texture description; transport and audio continue (S-15) | automatic restore | no | HUD note "Graphics paused" (M-28) | nothing drawn for up to 3 s | restore rebuild from CPU descriptions | UT-18-15 |
| Restore missing after 3 s, or 3 losses in 60 s, or rebuild failure (E-REN-004) | timer, loss counter, rebuild error | as above | user may select a 3D tier later in Settings | no | toast "Graphics could not be restored; using the flat visualizer." (M-27 on `render.tier` reason `contextLoss`) | Abstract for the session | `setTier` by the user | UT-18-16 |
| GPU resource creation returns null or `OUT_OF_MEMORY` (E-REN-005) | null from `glx.create*`; `getError()` checked after stage builds and resizes only (never per frame) | existing scene objects | no | no | toast via the `render.tier` auto path text | one tier lower (`setTier(next, 'auto')`) | next lower tier | UT-18-17 |
| Frame callback throws (E-REN-008) | try/catch in `step` | loop keeps running | next frame | no | per 4.9 origin rules (third error in 10 s -> returnToMenu by M-01) | frame skipped | next frame | UT-18-19 |
| Sustained slow frames | p95 > 33 ms over 5 s | everything | n/a | no | toast "Graphics quality lowered to <tier> to keep the music smooth" | lower tier | user raises the tier in Settings | UT-18-13 |
| 2D context unavailable (E-CAP-002) | `getContext('2d')` null in Abstract | none | reload | no | `#fatal` | none | reload | UT-18-09 |
| Leaked GL objects after a stage | `counters()` vs baseline in `assertClean` | n/a | n/a | no | diagnostics (E-MODE-001) | none | `Scene.clear()` and `releaseGeometry` | UT-18-18 |

#### 6.18.6 Limits and performance notes

- Draw-call caps per frame: 1,200 High, 900 Balanced, 600 Low (decorative layers >= 3 are
  dropped first). Instance staging cap 8,192 instances per pass (about 0.8 MB of floats);
  overflow items are skipped and counted in `skippedDraws`.
- Index buffers are `Uint16Array`; every primitive stays below 65,536 vertices (the largest,
  `sphere(r, 16, 12)`, has 221).
- CPU budget for `Scene.updateWorld()` plus bucket building: <= 2 ms per frame for 600 visible
  nodes on desktop (two stage passes). Matrix math allocates nothing per frame; `render`
  allocates no arrays except when the staging buffer grows.
- GPU memory: base resources about 0.3 MB (atlas 256 KB RGBA, blob 16 KB, unit meshes);
  a full five-performer stage about 1.5 MB of vertex data on High.
- `getError()` is never called inside the frame loop (it synchronizes the GPU pipeline).
- The frame-time ring holds 300 samples (5 s at 60 FPS); stats are computed once per second.

#### 6.18.7 Spec coverage

B 12.1 (camera, lighting, stage geometry support), B 12.6 (scene graph, camera system,
geometry and material management, lighting, asset loading as procedural generation, resource
disposal, render scaling, quality settings, capability detection), B 12.7 (fallback levels 1-5
mapped in 6.18.4.2), B 20.2, B 20.3 (GPU resources released), B 21.3 (resolution, shadows,
lighting, particles adapt per tier), B 22 (non-color glyph atlas), B 24 (rendering
initialization failure, insufficient performance), B 26.4 (reduced-quality modes preserve the
timeline; the renderer cannot advance time), E 1 (rendering never blocks scheduling: the loop
does no audio work), E 6.2 (WebGL failure, GPU exhaustion, sustained low frame rate, context
loss, repeated scene switches), E 10 items 2, 9, 13, E 11 (table above), I 1.3, I 12.1, I
12.2, I 13.1 (forced rendering interruption through `render.contextLoss`), P 7.1 (reduced
quality still intentional), P 14 (low-performance devices get appropriate settings), P 17
(graphics resources released, context-loss recovery, adaptive quality).

#### 6.18.8 Unit tests (group `render`, file `src/91-test-render.js`; GL tests run against the
headless SwiftShader context of Part 3.4.2 and call `t.skip('webgl unavailable')` when
`Caps.webgl1` is false)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-18-01 | mat4 multiply and invert | random TRS matrices (seeded Prng) | `multiply(m, invert(m))` within 1e-5 of identity; `invert` of a zero-scale matrix returns null |
| UT-18-02 | perspective and lookAt | `perspective(PI/2, 1, 1, 10)`, eye (0,0,5) looking at origin | point (0,0,0) projects to clip z/w in (-1,1) and x = y = 0; point at near plane maps to z/w = -1 within 1e-5 |
| UT-18-03 | quat slerp and euler | `fromEuler(0, PI/2, 0)` and identity | slerp at 0.5 equals a 45 degree yaw within 1e-5; shortest path when `dot < 0`; `rotationTo` of antiparallel vectors is a 180 degree rotation |
| UT-18-04 | normal trick equals inverse transpose | node scale (2, 0.5, 1) under a rotated parent | shader formula `M3 * (n * invS2)` normalized equals `normalFromMat4(M) * n` normalized within 1e-5 for 100 random normals |
| UT-18-05 | scene graph dirty propagation | 3-level chain; move the middle node | `updateWorld()` returns 2 (middle and leaf); leaf world translation equals the composed value; a second `updateWorld()` returns 0 |
| UT-18-06 | node add detaches and counts | add child to A then to B | A has no children; `scene.count()` unchanged at 2; `remove` returns false for a non-child |
| UT-18-07 | primitive vertex and index counts | each primitive with the High-tier segments | counts equal 6.18.4.5 (box 24/36, capsule(0.05, 0.3, 16, 4) 170/864, sphere(1,16,12) 221/1152); all indices < vertexCount; normals unit length within 1e-5 |
| UT-18-08 | tier pick table | `pickTier` with 8 caps and viewport combinations | desktop webgl2 1280x720 -> High; webgl2 touch -> Balanced; webgl2 500x800 -> Balanced; webgl1 only -> Low; none -> Abstract; `?tier=High` on webgl1 -> Balanced with reason 'url'; `video.tier:'low'` -> Low reason 'user' auto false; result for auto picks has auto true |
| UT-18-09 | abstract init without GL | `glFactory` returning null for every api | result `{api:'none', tier:'Abstract'}`; `E-REN-001` recorded; `#flat` visible and `#view` hidden; `renderer()` null; `counters()` all 0 |
| UT-18-10 | shader failure falls back | `debugInject('render.shaderFail')` before `init` | api `none`, tier Abstract, `E-REN-002` recorded, `glShaders === 0` and `glPrograms === 0` |
| UT-18-11 | both programs compile and link | real context | `glPrograms === 2`, `glShaders === 0` after init; lit uses 7 and unlit 8 attribute locations at the fixed indices |
| UT-18-12 | setTier clamping and events | init on webgl1 (forced through `glFactory` refusing webgl2) | `setTier('High','user')` sets Balanced and emits `render.tier {tier:'Balanced', reason:'user'}`; `setTier('Balanced','user')` again returns false and emits nothing |
| UT-18-13 | auto-downgrade from p95 | feed 300 synthetic frames of 40 ms through the stats hook with auto enabled and no hold | exactly one `render.tier {reason:'auto'}` from High to Balanced; a second check within 10 s does nothing; with `holdAutoTier(3000)` active nothing happens |
| UT-18-14 | hidden-tab gaps excluded | 299 frames of 16 ms plus one 5,000 ms delta | no downgrade; p95 computed from the window excludes the gap for the decision |
| UT-18-15 | context loss and restore rebuild | build 20 meshes, `debugInject('render.contextLoss', {restoreAfterMs:100})` | `render.contextLost` then `render.contextRestored {fallback:false}`; counters after restore equal counters before the loss; every mesh has non-null `gl` |
| UT-18-16 | restore timeout falls back | `debugInject('render.contextLoss', {restoreAfterMs:null})`, wait 3,100 ms (slow group) | `render.tier {tier:'Abstract', reason:'contextLoss'}` and `render.contextRestored {fallback:true}`; loop still running; a FakeClock-driven frameFn kept receiving frames |
| UT-18-17 | resource exhaustion downgrades | `glFactory` wrapper whose `createBuffer` returns null after 10 calls, then build 20 meshes | `E-REN-005` reported once; tier one step lower; no exception escapes |
| UT-18-18 | dispose returns counters to zero | init, build a stage-sized scene (200 nodes, 30 geometries), `scene.clear()`, `Render.dispose()` | after clear counters equal the post-init baseline; after dispose all counters 0 and `scene.count() === 0` |
| UT-18-19 | frame error isolation | frameFn throws on frame 3 only | frames 4 and later run; one `E-REN-008` record with `context.origin === 'frame'` |
| UT-18-20 | loop passes clock time untouched | FakeClock returning 1.0, 1.5, 9.0 on successive frames | frameFn receives exactly those values; dt values are clamped to 0..100 |
| UT-18-21 | instanced and per-draw paths agree | render 50 identical boxes with instancing, then with `caps.instancing` forced to 'none', read pixels | both images identical (readPixels compare, tolerance 1 per channel); draws 1 versus 50 |
| UT-18-22 | geometry cache sharing | `geometry('capsule', {r:0.0501, len:0.3})` twice and once with r 0.0504 | first two return the same Mesh (refCount 2; quantized key); the third differs; releasing all three disposes both meshes |
| UT-18-23 | camera spring settles without overshoot | goal 10 m away, step 2 s with dt 16 ms and once with dt 100 ms | position never passes the goal; distance after 1 s < 0.2 m in both runs; `instant:true` jumps exactly |
| UT-18-24 | Flat2D highway drawing | Abstract init, `drawHighway` of a model with 4 notes, 1 hold, 1 chord | returns shape count 4 bodies + 4 glyphs + 1 tail + 1 connector + lanes and receptors as listed in 6.18.4.14; pixel at a note center has the lane color |
| UT-18-25 | resolution scale and DPR cap | `resize(1000, 500, 3)` on High, Low, and with `video.resolutionScale 0.6` | High buffer 2000x1000; Low 750x375; user scale 0.6 on High 1200x600 |
| UT-18-26 | exported tables frozen | `TIERS`, `GLYPHS`, `ATLAS` | `Object.isFrozen` deep; values of the High row equal 6.18.4.2 |

#### 6.18.9 Implementation notes and browser quirks

- Listener and frame wrappers: M-18 uses `Core.raf.request`, `Core.raf.cancel`
  and `Core.timers.setTimeout` (6.1.2) and `Core.dom.on(el, type, fn, opts, owner)` (4.7.3)
  so `assertClean()` counts them. The context listeners and the bus subscriptions use
  `RENDER_OWNER`, which belongs to the boot baseline; the frame request uses the mode owner
  passed in `startLoop`.
- Safari (desktop and iOS) exposes WebGL2 from version 15; older iOS falls back to WebGL1
  with `ANGLE_instanced_arrays`, which is universally present there. Firefox on some Linux
  drivers reports `failIfMajorPerformanceCaveat` contexts as software; the attribute is
  false so a context is still obtained and the auto-downgrade handles slowness.
- iOS Safari loses WebGL contexts when the page is backgrounded under memory pressure; the
  restore path is exercised by returning to the tab. `preventDefault()` in the lost handler
  is mandatory, otherwise no restore event arrives.
- SwiftShader (headless tests) supports WebGL2 and `WEBGL_lose_context`; pixel comparisons in
  UT-18-21 use the same context for both draws so driver differences cancel out.
- `vertexAttrib4f` constant attributes are the per-draw fallback; location 0 (`aPos`) is
  always an enabled array (some desktop GL drivers misbehave when attribute 0 is a constant).
- WebGL1 VAO extension (`OES_vertex_array_object`) is optional; without it the renderer
  re-specifies attribute pointers per bucket (the `glVaos` counter then stays 0).
- Canvas sizes are set only when they change (setting `width` clears the drawing buffer).
- The `view` canvas keeps CSS `width: 100%; height: 100%` from Part 3.2.4; only the buffer
  size changes with the tier, so DOM layout never jumps on a tier change (P 2.2).

### 6.19 M-19 Rig (`src/19-rig.js`, `FLM.Rig`)

#### 6.19.1 Responsibilities and non-goals

Responsibilities: the humanoid skeleton shared by every performer (19 joints, fixed order and
hierarchy); default bone lengths and widths by body type and height scale; the seven
attachment points used by instrument props and accessories; the `Pose` representation
(local joint rotations, root offset, hand spread) with copy and blend; forward kinematics in
performer space; analytic two-bone IK for both arms with a pole vector; building the
procedural body, clothing, hair, face and accessory meshes from a resolved appearance
(capsule limbs, box torso, sphere head); applying appearance changes in place, where
rig-affecting changes recompute lengths and attachments and visual-only changes only
recolor or swap part groups; validation that the attachments a prop needs exist.

Non-goals: no knowledge of the `CharacterConfig` catalog, palettes or presets (M-22 resolves
a config into a `RigAppearance` and calls `applyConfig`, because M-19 cannot reference the
higher M-22); no instrument props and no stage placement (M-21); no gesture logic (M-20);
no skinning: each body part is a rigid mesh node parented to its joint node; no leg IK
(feet stay planted because standing controllers never translate the root horizontally,
6.20.4.2).

#### 6.19.2 Public API

```js
FLM.Rig = {
  /** Joint table in topological order (parents before children). */
  JOINTS: [ /* {index, name, parent} x 19, exact list in 6.19.3 */ ],
  JOINT: { hips:0, spine:1, chest:2, neck:3, head:4, shoulderL:5, shoulderR:6, upperArmL:7, upperArmR:8,
           foreArmL:9, foreArmR:10, handL:11, handR:12, upLegL:13, upLegR:14, legL:15, legR:16,
           footL:17, footR:18 },
  ATTACHMENTS: ['handL', 'handR', 'chest', 'mouth', 'head', 'hip', 'back'],
  /** Attachments each prop kind requires (prop kinds are M-21 PROPS ids). */
  ATTACHMENT_REQUIREMENTS: {
    drumKit: ['handL', 'handR'], keyboard: ['handL', 'handR'], guitar: ['hip', 'chest', 'handL', 'handR'],
    bass: ['hip', 'chest', 'handL', 'handR'], micStand: ['mouth'], horn: ['mouth', 'handL', 'handR'],
    bowed: ['chest', 'handL', 'handR'], mallets: ['handL', 'handR'], generic: ['handR']
  },
  /** Body width tables (6.19.4.1); deep-frozen. */
  BODY: { slim: BodyWidths, average: BodyWidths, broad: BodyWidths },
  /** @param {'slim'|'average'|'broad'} body  @param {number} heightScale 0.9..1.1 (clamped)
   *  @returns {RigLengths} */
  lengthsFor(body, heightScale),

  /** Builds a rig with meshes for the appearance. tierParams selects geometry LOD.
   *  @param {RigAppearance} appearance  @param {{tierParams:TierParams, seed:number}} opts
   *  @returns {Rig} with rig.root not yet attached to any scene */
  createRig(appearance, opts),

  /** @returns {{ok:boolean, missing:string[]}} missing = required attachments the rig lacks */
  validateAttachments(rig, propKind),

  Pose: {
    create() /* -> Pose identity (rest) */,
    copy(out, a) /* -> out */,
    identity(out) /* -> out */,
    /** Per joint nlerp (sign corrected), linear root and spread. t clamped 0..1. */
    blend(out, a, b, t) /* -> out */,
    setEuler(pose, joint /* index */, x, y, z /* radians, YXZ */) /* -> pose */,
    /** Multiplies an extra local rotation onto a joint: rot = rot * delta. */
    rotate(pose, joint, x, y, z) /* -> pose */,
    getRot(pose, joint, outQuat) /* -> outQuat */,
    /** Largest joint angle difference (radians), root distance (m), spread difference. */
    deviation(a, b) /* -> {angle:number, root:number, spread:number, joint:number} */
  }
};

// Rig instance
// {
//   root: Node,                  // performer root; M-21 positions and yaws it on the stage
//   joints: Node[19],            // joint nodes, children of root following JOINTS
//   lengths: RigLengths,         // current (rig-affecting) dimensions
//   appearance: RigAppearance,   // last applied appearance (copy)
//   restOffsets: Float32Array(57),   // joint translation from parent at rest, performer units (m)
//   setLengths(lengths) -> void,     // recompute rest offsets and attachments, rebuild body part meshes
//   pose() -> Pose,                  // copy of the last applied pose
//   setPose(pose) -> void,           // apply rotations, root offset and hand spread to the nodes
//   blend(a, b, t, out) -> out,      // FLM.Rig.Pose.blend
//   fk(pose, outMats /* Float32Array(19*16) */) -> outMats,   // joint matrices in performer space
//   jointPosition(pose, joint, outVec3) -> outVec3,           // FK position of one joint
//   /** Two-bone IK. target is the wrist (hand joint) position in performer space; pole is the
//    *  point the elbow points toward. Writes upperArm and foreArm rotations (and hand when
//    *  handRot is given, a performer-space quaternion) into pose. */
//   ikArm(pose, side /* 'L'|'R' */, target, pole, handRot /* quat|null */) -> {reached:boolean, distance:number},
//   /** Attachment point position (and orientation) in performer space for a pose. */
//   attachment(name, pose, outVec3, outQuat /* optional */) -> outVec3|null,  // null when missing
//   /** Node to which props and accessories for the attachment are parented, with its local offset. */
//   attachmentNode(name) -> {node:Node, offset:Float32Array(3)}|null,
//   buildMesh(appearance) -> number,  // (re)builds every part group, returns mesh node count
//   applyConfig(appearance) -> {rigAffecting:boolean, rebuiltGroups:string[]},
//   rebuildLod(tierParams) -> void,   // re-requests capsule, sphere, cylinder geometry at the tier's segments
//   restPose() -> Pose,               // identity pose (all rotations identity, root 0, spread 1)
//   dispose() -> void                 // root.dispose(): releases every geometry reference
// }

// RigAppearance (resolved by FLM.Character.applyTo; colors are '#rrggbb')
// { body, heightScale, skinColor, hairStyle /* effective style after the hat rule */, hairColor,
//   face /* 'face1'..'face4' */, top:{style, color}, bottom:{style, color}, shoes:{style, color},
//   accessories:[{id, color}], animationStyle }
// RigLengths { height, hipsY, spine1, spine2, chestLen, neckLen, headY, headR, clavicle, shoulderHalf,
//   upperArm, foreArm, hand, hipHalf, hipDrop, upLeg, leg, ankle, footLen, torsoW, torsoD, limbScale }
// Pose { rot: Float32Array(76) /* 19 quats x,y,z,w local, rest = identity */,
//        root: Float32Array(3) /* hips offset from rest, performer space */,
//        spread: Float32Array(2) /* hand spread factor L, R; rest 1.0, range 0.8..1.6 */ }
```

Events emitted: none. Events consumed: none (M-21 calls `applyConfig` on `character.changed`
and `rebuildLod` on `render.tier`).

#### 6.19.3 Internal state

Joint table (index, name, parent, rest offset from the parent in performer meters for an
`average` body at `heightScale 1.0`; `s` = heightScale; widths from `BODY`):

| Index | Name | Parent | Rest offset (x, y, z) |
|---|---|---|---|
| 0 | hips | none (root) | (0, hipsY, 0) with `hipsY = hipDrop + upLeg + leg + ankle = 1.00 s` |
| 1 | spine | hips | (0, spine1 = 0.11 s, 0) |
| 2 | chest | spine | (0, spine2 = 0.11 s, 0) |
| 3 | neck | chest | (0, chestLen = 0.25 s, 0) |
| 4 | head | neck | (0, neckLen = 0.10 s, 0) |
| 5 | shoulderL | chest | (+clavicle = 0.05 s, 0.20 s, 0) |
| 6 | shoulderR | chest | (-clavicle, 0.20 s, 0) |
| 7 | upperArmL | shoulderL | (+(shoulderHalf - clavicle), 0, 0) |
| 8 | upperArmR | shoulderR | (-(shoulderHalf - clavicle), 0, 0) |
| 9 | foreArmL | upperArmL | (0, -upperArm = -0.29 s, 0) |
| 10 | foreArmR | upperArmR | (0, -upperArm, 0) |
| 11 | handL | foreArmL | (0, -foreArm = -0.26 s, 0) |
| 12 | handR | foreArmR | (0, -foreArm, 0) |
| 13 | upLegL | hips | (+hipHalf, -hipDrop = -0.05 s, 0) |
| 14 | upLegR | hips | (-hipHalf, -hipDrop, 0) |
| 15 | legL | upLegL | (0, -upLeg = -0.45 s, 0) |
| 16 | legR | upLegR | (0, -upLeg, 0) |
| 17 | footL | legL | (0, -leg = -0.43 s, 0) |
| 18 | footR | legR | (0, -leg, 0) |

Coordinate rules: performer space is right-handed, +Y up, the performer faces +Z, so the
performer's left is +X. The rest pose has arms hanging along -Y; every bone points along
its joint's local -Y (arms and legs) or +Y (spine, neck), so identity rotations are the rest
pose. Other lengths: `ankle = 0.07 s` (ankle joint height above the floor), `footLen = 0.24
s`, `hand = 0.09 s`, `headY = 0.09 s` (head mesh center above the head joint), `headR = 0.11
s`. Standing height `height = hipsY + spine1 + spine2 + chestLen + neckLen + headY + headR =
1.77 s` m.

`BODY` widths (all multiplied by `s`):

| Body | shoulderHalf | hipHalf | torsoW | torsoD | limbScale (limb radii factor) |
|---|---|---|---|---|---|
| slim | 0.17 | 0.085 | 0.30 | 0.18 | 0.85 |
| average | 0.19 | 0.095 | 0.34 | 0.20 | 1.00 |
| broad | 0.22 | 0.110 | 0.42 | 0.25 | 1.25 |

Base limb radii at `limbScale 1` (times `s` and `limbScale`): upper arm 0.045, forearm 0.038,
upper leg 0.065, lower leg 0.050, neck 0.045.

Attachment table (joint, offset in the joint's local frame; `s`, widths and lengths as above):

| Attachment | Joint | Offset | Used for |
|---|---|---|---|
| handL | handL | (0, -0.045 s, 0) | sticks, mallets, bow, fretting hand |
| handR | handR | (0, -0.045 s, 0) | sticks, pick, bow, generic props, wristband reference |
| chest | chest | (0, 0.14 s, torsoD / 2 + 0.02 s) | guitar and bass strap point, violin rest, scarf end |
| mouth | head | (0, headY - 0.03 s, 0.95 headR) | mic, horn mouthpiece, glasses reference |
| head | head | (0, headY + headR, 0) | hat, headphones |
| hip | hips | (0, 0.02 s, torsoD / 2 + 0.03 s) | guitar and bass body anchor |
| back | chest | (0, 0.12 s, -(torsoD / 2 + 0.03 s)) | slung instrument when idle, hoodie hood reference |

Per-rig state: `joints[19]` Nodes; `parts: Map<group, Node[]>` with groups `body`,
`clothing`, `hair`, `face`, `accessories`; `materials: Map<partId, Material>`;
`current: Pose`; scratch `Float32Array(19 * 16)` for FK. Invariants: `joints[i].parent` is
`joints[JOINTS[i].parent]` or `root`; joint nodes have uniform scale 1; only part mesh nodes
carry non-uniform scale (Node invariant of 6.18.2); `attachment()` returns a value for all
seven names on every rig built by `createRig`.

#### 6.19.4 Algorithms

6.19.4.1 `lengthsFor(body, heightScale)`

1. `s = clamp(heightScale, 0.9, 1.1)`; unknown `body` -> `average`.
2. Lengths from the joint table times `s`; widths from `BODY[body]` times `s`; return a frozen
   `RigLengths`. Pure and deterministic.

6.19.4.2 Forward kinematics (`fk`)

```text
fk(pose, out):
  for i in 0..18:
    off = restOffsets[i*3..] ; if i == 0: off = off + pose.root
    local = fromRotationTranslationScale(pose.rot[i], off, (1,1,1))
    out[i] = i == 0 ? local : out[parent(i)] * local
  return out
```

`setPose(pose)` writes the same values into the joint nodes (`setPosition(off)`,
`setRotation(rot)`) and the hand part nodes' x scale (`handWidth * spread`), so the scene
graph's world matrices equal `rootNode.world * fk(...)`. Joint node updates cost 19 matrix
compositions per performer per animated frame.

6.19.4.3 Two-bone arm IK (`ikArm`)

```text
ikArm(pose, side, T, P, handRot):
  u = upperArm<side> index, f = foreArm<side>, h = hand<side>, sh = shoulder<side>
  fk(pose) for joints up to sh (hips, spine, chest, sh, u): S = position of u; Qp = world rotation of sh
  a = lengths.upperArm; b = lengths.foreArm
  D = T - S; d = |D|
  reached = d <= a + b - 1e-4
  d = clamp(d, abs(a - b) + 1e-4, a + b - 1e-4); dir = D / |D| (if |D| < 1e-6: dir = (0,-1,0))
  // pole projected onto the plane orthogonal to dir
  q = P - S; pp = q - dir * dot(q, dir)
  if |pp| < 1e-4: pp = (0,0,-1) - dir * dot((0,0,-1), dir)          // elbow back
  if |pp| < 1e-4: pp = (side=='L' ? 1 : -1, 0, 0) - dir * dot(...)   // elbow out
  pp = normalize(pp)
  cosA = (a*a + d*d - b*b) / (2*a*d); angA = acos(clamp(cosA, -1, 1))
  E = S + dir * (a * cos(angA)) + pp * (a * sin(angA))               // elbow, on the pole side
  W = S + dir * d                                                     // wrist (equals T when reached)
  uDir = normalize(E - S); fDir = normalize(W - E)
  // bone frames: local -Y along the bone, local +Z toward the bend (forearm side), X = Y x Z
  Yu = -uDir; Zu = normalize(fDir - uDir * dot(fDir, uDir)) (degenerate: Zu = (0,0,1) orthogonalized); Xu = cross(Yu, Zu)
  Yf = -fDir; Xf = Xu; Zf = cross(Xf, Yf)
  Qu = quatFromBasis(Xu, Yu, Zu); Qf = quatFromBasis(Xf, Yf, Zf)
  pose.rot[u] = conjugate(Qp) * Qu
  pose.rot[f] = conjugate(Qu) * Qf
  if handRot: pose.rot[h] = conjugate(Qf) * handRot
  return {reached, distance: |D|}
```

`quatFromBasis` converts the rotation matrix with columns `(X, Y, Z)` to a quaternion (the
standard trace method, normalized). Properties asserted by tests: when reached, the FK
wrist is within 1 mm of `T`; `|E - S| = a` and `|W - E| = b` within 1e-5; the elbow lies on
the pole side (`dot(E - S, pp) > 0`); unreachable targets give a straight arm pointing at
`T`. Default poles (used when a controller passes null): left `S + (0.25, -0.35, -0.30)`,
right `S + (-0.25, -0.35, -0.30)` (elbows down, back and out). The function is
allocation-free (module scratch vectors).

6.19.4.4 Mesh building (`buildMesh(appearance)`)

All parts are nodes parented to a joint node, positioned in the joint's local frame,
geometry from `Render.geometry(kind, params)` with the tier's segments, material lit with
`emissive 0` unless stated. `skin`, `top`, `bottom`, `shoe`, `hair` denote the appearance
colors. `lr` = limbScale, `s` = heightScale.

Body group (19 parts, always built):

| Part | Joint | Primitive (size) | Local position | Color |
|---|---|---|---|---|
| pelvis | hips | box (0.92 torsoW, 0.16 s, 0.95 torsoD) | (0, 0, 0) | bottom; `top` when top is `dress`; `skin` never |
| abdomen | spine | box (0.85 torsoW, 0.13 s, 0.90 torsoD) | (0, 0.055 s, 0) | top |
| torso | chest | box (torsoW, 0.95 chestLen, torsoD) | (0, 0.45 chestLen, 0) | top |
| neck | neck | capsule (r 0.045 s lr, len 0.06 s) | (0, 0.04 s, 0) | skin |
| head | head | sphere (r headR) | (0, headY, 0) | skin |
| upperArmL, R | upperArm | capsule (r 0.045 s lr, len upperArm - 2 r) | (0, -upperArm / 2, 0) | sleeve rule |
| foreArmL, R | foreArm | capsule (r 0.038 s lr, len foreArm - 2 r) | (0, -foreArm / 2, 0) | sleeve rule |
| handL, R | hand | box (0.075 s lr, hand, 0.035 s) | (0, -hand / 2, 0) | skin; x scale = spread |
| upLegL, R | upLeg | capsule (r 0.065 s lr, len upLeg - 2 r) | (0, -upLeg / 2, 0) | leg rule |
| legL, R | leg | capsule (r 0.050 s lr, len leg - 2 r) | (0, -leg / 2, 0) | leg rule |
| footL, R | foot | box (0.09 s, ankle, footLen) | (0, -ankle / 2, 0.3 footLen) | shoe rule |

Sleeve rule (upper arm, forearm): `tee` top, skin; `shirt`, `hoodie`, `jacket` top, top;
`tank`, `dress` skin, skin. Leg rule (upper leg, lower leg): `jeans` bottom, bottom; `shorts`
bottom, skin; `skirt` skin, skin; `none` skin, skin. Shoe rule: `sneakers` shoe color plus a
sole part (box 0.095 s x 0.02 s x 1.02 footLen, `#222222`, 0.01 s below the foot); `boots`
foot box height `ankle + 0.08 s` raised by 0.04 s, shoe color; `bare` skin.

Clothing group (built per style):

| Condition | Part | Joint | Primitive and placement | Color |
|---|---|---|---|---|
| bottom `skirt` | skirt | hips | cylinder r 0.60 torsoW, h 0.30 s, at (0, -0.12 s, 0) | bottom |
| top `dress` (bottom forced `none`) | dressSkirt | hips | cylinder r 0.62 torsoW, h 0.45 s, at (0, -0.18 s, 0) | top |
| top `hoodie` | hood | chest | sphere r 1.05 headR scaled (1, 0.6, 0.9) at (0, chestLen + 0.02 s, -0.45 torsoD) | top |
| top `jacket` | placket | chest | box (0.12 torsoW, 0.9 chestLen, 0.01 s) at (0, 0.45 chestLen, torsoD / 2 + 0.005 s) | top darkened 45 percent |
| top `shirt` | collar | chest | box (0.5 torsoW, 0.03 s, 0.6 torsoD) at (0, 0.95 chestLen, 0) | top lightened 20 percent |

Face group (eyes are spheres `#1a1a1a`; positions relative to the head center `(0, headY,
0)` in the head joint frame):

| Face | Eyes (radius, x half-spacing, y) | Extra parts |
|---|---|---|
| face1 | 0.014 s, 0.035 s, 0.010 s | none |
| face2 | 0.016 s, 0.040 s, 0.010 s | brows: boxes (0.03 s, 0.006 s, 0.01 s) at (+-0.04 s, 0.040 s, 0.90 headR), hair color |
| face3 | 0.012 s scaled y 0.6, 0.033 s, 0.010 s | mouth: box (0.035 s, 0.006 s, 0.01 s) at (0, -0.045 s, 0.93 headR), `#7a1f2b` |
| face4 | 0.015 s, 0.038 s, 0.012 s | nose: sphere r 0.016 s at (0, -0.010 s, 1.00 headR), skin darkened 10 percent |

Eyes sit at `z = 0.92 headR`.

Hair group (`appearance.hairStyle` is already the effective style; positions relative to the
head center):

| Style | Parts |
|---|---|
| none | no parts |
| short | cap: sphere r 1.06 headR scaled (1, 0.72, 1.02) at (0, 0.035 s, -0.005 s) |
| medium | cap plus back: box (1.8 headR, 1.1 headR, 0.6 headR) at (0, -0.02 s, -0.75 headR) |
| long | cap plus back: box (1.9 headR, 2.6 headR, 0.5 headR) at (0, -0.11 s, -0.80 headR) |
| curly | 7 spheres r 0.42 headR at distance 0.85 headR in directions: straight up, and 6 at elevation 35 degrees with azimuths 0, 60, ..., 300 degrees |
| mohawk | box (0.25 headR, 0.45 headR, 2.0 headR) at (0, 0.95 headR, -0.01 s) |

Accessories group (each parented to the joint of its attachment, offset added to the
attachment offset; color from `accessories[i].color`):

| Accessory | Attachment | Parts |
|---|---|---|
| hat | head | crown cylinder r 1.02 headR, h 0.10 s, at attachment offset + (0, -0.25 headR, 0); brim cylinder r 1.45 headR, h 0.012 s at attachment offset + (0, -0.45 headR, 0.01 s) |
| glasses | mouth | two rings (inner 0.016 s, outer 0.022 s, rotated 90 degrees about X to face +Z) at attachment offset + (+-0.038 s, 0.04 s, 0.02 headR); bridge box (0.03 s, 0.004 s, 0.004 s) between them |
| headphones | head | band box (2.1 headR, 0.02 s, 0.03 s) at attachment offset + (0, 0.02 headR, 0); two ear cups: cylinders r 0.035 s, h 0.03 s, axis X, at attachment offset + (+-1.0 headR, -1.0 headR, 0) |
| scarf | chest | wrap: cylinder r 0.07 s lr, h 0.06 s parented to the neck joint at (0, 0.02 s, 0); tail: box (0.05 s, 0.18 s, 0.015 s) at chest attachment offset + (0.05 s, -0.04 s, 0.01 s) |
| wristband | handR | cylinder r 0.043 s lr, h 0.04 s parented to foreArmR at (0, -foreArm + 0.03 s, 0) |

Node count: 19 body parts plus 2 shoe soles, up to 2 clothing, up to 4 face, up to 7 hair
and up to 9 accessory parts (hat and headphones are exclusive), at most 43 mesh nodes; the default appearance (`short` hair, `face1`, `tee`, `jeans`, `sneakers`, no
accessories) builds 19 + 0 + 2 + 1 + 2 sole parts = 24 mesh nodes. Building is deterministic:
the same appearance and tier produce the same node names in the same order.

6.19.4.5 `applyConfig(appearance)`

```text
applyConfig(next):
  prev = this.appearance
  rigAffecting = next.body !== prev.body or next.heightScale !== prev.heightScale
  if rigAffecting:
    keep = this.pose()                              // the current pose is preserved
    setLengths(lengthsFor(next.body, next.heightScale))   // new rest offsets and attachment offsets
    dispose every part group; buildMesh(next); setPose(keep)
    return {rigAffecting:true, rebuiltGroups:['body','clothing','hair','face','accessories']}
  groups = []
  if colors of skin, top, bottom or shoes changed and styles unchanged: recolor materials in place (no geometry change)
  if top.style, bottom.style or shoes.style changed: rebuild 'clothing' and recolor 'body'; groups += 'clothing'
  if hairStyle changed: rebuild 'hair'; groups += 'hair'   (hairColor alone: recolor)
  if face changed: rebuild 'face'; groups += 'face'
  if accessories changed (ids or colors): rebuild 'accessories'; groups += 'accessories'
  this.appearance = copy(next)
  return {rigAffecting:false, rebuiltGroups:groups}
```

Attachment positions change only on rig-affecting edits; props and accessories parented
through `attachmentNode` follow automatically because they are children of joint nodes and
their offsets are recomputed by `setLengths`. Nothing here touches the Transport, the audio
graph or the controllers (I 8: customization without a scene reload). Budget: a visual-only
change <= 2 ms, a rig-affecting change <= 8 ms on desktop.

6.19.4.6 `validateAttachments(rig, propKind)`

`required = ATTACHMENT_REQUIREMENTS[propKind] or ATTACHMENT_REQUIREMENTS.generic`; `missing =
required.filter(n => rig.attachmentNode(n) === null)`; returns `{ok: missing.length === 0,
missing}`. M-21 calls it for every performer at build and after every rig-affecting change;
a failure is reported once per performer as `E-REN-009` and the performer is shown as an
abstract visualizer instead of a humanoid (E 6.1: abstract visualization remains available).

6.19.4.7 `Pose.blend(out, a, b, t)`

For each joint: `d = dot(qa, qb)`; if `d < 0` negate `qb` in a scratch copy; `out = normalize(qa
+ (qb - qa) * t)` (nlerp). Root and spread are linear. `t <= 0` copies `a`; `t >= 1` copies
`b` exactly (tests compare by equality at the endpoints). nlerp instead of slerp: the blends
are between nearby poses (under 60 degrees), where nlerp's angular error is below 1 percent and
it costs no trigonometry.

#### 6.19.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Appearance field invalid (should not happen after M-22 normalization) | `buildMesh` checks enums; unknown style -> default style | rig with defaults for that part | no | no | none (logged `W-RIG-DEFAULTED` once per field) | default part | next valid `applyConfig` | UT-19-13 |
| Required attachment missing (E-REN-009) | `validateAttachments` | rig and pose | after the next rig-affecting change | no | none for the user; diagnostics log | performer drawn as abstract visualizer | rebuild with a valid config | UT-19-14 |
| IK target unreachable or degenerate pole | distance and projection checks | pose with a straight arm toward the target | every frame | no | none | arm fully extended | next reachable target | UT-19-07, UT-19-08 |
| NaN in a pose (controller defect) | `setPose` checks the first component of each quaternion with `Number.isFinite` | last valid pose | next frame | no | `Log.once('rig-nan-<id>')` | previous pose kept | next valid pose | UT-19-15 |
| Geometry creation fails (GL resource exhaustion) | `Render.geometry` reports `E-REN-005` | rig nodes without the failed mesh | after tier downgrade (`rebuildLod`) | no | toast from the tier change | part missing until rebuilt | `rebuildLod` at the lower tier | UT-19-17 |

#### 6.19.6 Limits and performance notes

- At most 5 rigs exist at once (stage slots) plus 1 preview rig in SCR-Characters; each rig
  holds at most 43 mesh nodes plus its 19 joint nodes; capsule geometries are shared through the cache when two
  performers have equal body and height.
- Per animated frame and performer: one `setPose` (19 compositions) plus at most two `ikArm`
  calls (each one partial FK of 5 joints, a few vector operations and two quaternion
  constructions); target <= 0.05 ms per performer on desktop.
- No allocation in `fk`, `ikArm`, `setPose`, `blend` (module scratch buffers).

#### 6.19.7 Spec coverage

B 12.2 (articulated skeleton with torso, head, neck, shoulders, upper and lower arms, hand
targets, hips, upper and lower legs, feet; procedural skeleton; one rig interface shared by
all instruments and appearances), B 13.3 (rig-affecting versus visual-only properties:
`body` and `heightScale` affect lengths and attachments, everything else is visual), E 6.1
(missing attachment point, customization changes body proportions), E 6.2 (character
customized during playback without reload), I 4.1 (consistent rig with attachment points,
procedural motion), I 8 (rig reused by the editor and the stage), P 7.2 (joints without
snapping through blending; hands attached to instruments through IK; feet do not slide), P 8
(accessories placed at attachment points to avoid intersections; avatar customization keeps
the rig valid).

#### 6.19.8 Unit tests (group `rig`, file `src/91-test-rig.js`; mesh tests need a GL
context and skip without one; math tests run in every tier)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-19-01 | joint table order | `JOINTS` | 19 entries in the order of 6.19.3; every parent index < child index; names match `JOINT` |
| UT-19-02 | lengths by body and height | `lengthsFor` for 3 bodies x {0.9, 1.0, 1.1} and heightScale 1.3 | `height === 1.77 * s` within 1e-6; shoulderHalf follows `BODY`; 1.3 is clamped to 1.1 |
| UT-19-03 | rest pose FK positions | average, s = 1, rest pose | head joint at (0, 1.57, 0); handL joint at (0.19, 0.87, 0); footR joint at (-0.095, 0.07, 0) within 1e-5 |
| UT-19-04 | attachment positions | average rig, rest pose | `attachment('mouth')` = (0, 1.63, 0.1045) within 1e-5; all 7 names non-null |
| UT-19-05 | blend endpoints and midpoint | poses A (rest) and B (chest pitched 40 degrees) | t 0 equals A, t 1 equals B exactly; t 0.5 chest angle 20 degrees within 0.5 degrees |
| UT-19-06 | IK reachable target | target 0.4 m in front of the right shoulder at chest height | FK wrist within 1 mm of target; upper and fore lengths preserved within 1e-5; `reached === true` |
| UT-19-07 | IK unreachable target | target 2 m away | `reached === false`; wrist on the segment toward the target at distance a + b within 1e-3 |
| UT-19-08 | IK pole side and degenerate pole | pole behind, then a pole on the shoulder-target line | elbow on the pole side; degenerate case uses the back fallback and stays finite |
| UT-19-09 | IK hand rotation | `handRot` = 30 degree roll | FK hand world rotation equals `handRot` within 1e-4 |
| UT-19-10 | setPose drives nodes | pose with chest yaw 20 degrees | after `scene.updateWorld()` the head node world position equals `root.world * fk(pose)` within 1e-5 |
| UT-19-11 | default appearance mesh count | `createRig(defaultAppearance)` | 24 mesh nodes; names in the documented order; deterministic across two builds |
| UT-19-12 | sleeve and leg rules | tee + shorts, then jacket + jeans | tee: upper arm top color, forearm skin; shorts: lower leg skin; jacket: placket present; jeans: both leg parts bottom color |
| UT-19-13 | unknown style defaults | appearance with `hairStyle:'spiky'` | builds the `short` cap; `W-RIG-DEFAULTED` logged once |
| UT-19-14 | validateAttachments | rig, then a rig whose `attachmentNode('hip')` is stubbed to null | ok for every prop kind; with the stub `guitar` reports `missing:['hip']` and `keyboard` is ok |
| UT-19-15 | NaN pose rejected | pose with NaN in handR | previous pose kept; one `Log.once` entry |
| UT-19-16 | rig-affecting change keeps pose and moves attachments | apply a pose, then `applyConfig` average -> broad | `rigAffecting:true`; pose deviation 0; `attachment('handR')` x moved outward by 0.03 within 1e-5 |
| UT-19-17 | visual-only change reuses geometry | change top color, then hair style | first call rebuilds no group and every mesh object is identical; second rebuilds only 'hair'; GL counters for body geometry unchanged |
| UT-19-18 | dispose releases geometry | create 2 rigs with equal bodies, dispose both | capsule cache refCount reaches 0; GL counters return to the pre-test values |
| UT-19-19 | LOD rebuild | `rebuildLod(TIERS.Low)` | limb capsule vertex count equals `(6 + 1) * 2 * (2 + 1) = 42` |

#### 6.19.9 Implementation notes and browser quirks

- Quaternion conventions follow `Math3.quat` (x, y, z, w); `quatFromBasis` must normalize its
  result because accumulated float error in the basis vectors otherwise grows over thousands of
  frames.
- The pose arrays are `Float32Array`; tests compare with tolerances (1e-5 for positions,
  1e-4 for quaternion components).
- Colors are applied as given (sRGB hex used directly as shader input); darken and lighten are
  multiplications of each channel by 0.55 and by `1 + 0.2 * (1 - c)`, clamped to 0..1.
- The rig never reads the clock: all time dependence is in M-20 controllers, so a rig in the
  customization preview and a rig on stage behave identically.

### 6.20 M-20 Animation (`src/20-animation.js`, `FLM.Animation`)

#### 6.20.1 Responsibilities and non-goals

Responsibilities: convert musical events into performer motion and abstract visuals. The
module owns the controller interface and ten per-instrument controllers (keys, guitar, bass,
drums, strings, winds, percussion, synth, vocal, abstract) with exact gesture rules; the
GM-program-to-controller table; the performer-space prop layouts the gestures aim at; the
anticipation model (gestures start up to 120 ms before a note sounds, using the scheduler's
lookahead); intensity from velocity and note density; idle breathing and the idle/playing
blend; the rule that rests are still; the `Mixer` that routes `sched.*` events to
controllers, keeps animation time continuous across pause and resume, applies tier and
reduced-motion limits and calls `Rig.setPose`; the abstract `Visualizer` (floating notes,
rings, pitch height, trails) with per-tier caps; the deterministic `StageDirector` (camera
cut plan); and `BeatIndicator` (beat, bar and section state derived from musical time).

Non-goals: no rendering and no meshes (M-21 draws visualizer items and the highway; M-19 owns
geometry); no camera math (M-21 maps director cuts to camera presets and M-18 springs the
camera); no audio and no scoring; no reading of `performance.now()`; the `dt` argument of
`update` is accepted for interface compatibility and is not used to compute any pose.
Animation never controls the Transport (B 19.2, S-01, S-03).

#### 6.20.2 Public API

```js
FLM.Animation = {
  ANTICIPATION_MS: 120,          // maximum gesture lead before a note's audio time
  LIVE_DIP_MS: 30,               // live (Free Play) notes: contact this long after the event time
  CHORD_GROUP_MS: 30,            // note-ons within this window form one gesture group
  INTENSITY: { velocityWeight: 0.6, densityWeight: 0.4, densityWindowS: 1.0, densityFull: 8 },
  STYLE_GAIN: { calm: 0.7, normal: 1.0, energetic: 1.3 },
  REDUCED_MOTION_GAIN: 0.7,      // instrument gestures are kept (information) but scaled
  CONTROLLERS: ['keys', 'guitar', 'bass', 'drums', 'strings', 'winds', 'percussion', 'synth', 'vocal', 'abstract'],
  PROFILE_BY_FAMILY: [ /* 16 entries, 6.20.4.1 */ ],
  PROFILE_OVERRIDES: { /* program -> profile, 6.20.4.1 */ },
  DRUM_MAP: { /* GM key -> {piece, limb}, 6.20.4.6 */ },
  /** Performer-space prop anchor layouts per profile as functions of RigLengths. */
  layoutFor(profile, lengths) /* -> PropLayout */,

  /** @param {{program:number, isDrums:boolean}|null} track  @returns {string} profile id
   *  ('abstract' for null tracks is not returned: a null track gets 'idle' handling by the Mixer) */
  controllerFor(track),
  /** Creates a controller instance (the class per profile implements Controller). */
  createController(profile, ctx /* {rig:Rig|null, lengths:RigLengths|null, layout:PropLayout,
                                    seed:number, style:'calm'|'normal'|'energetic', program:number} */) /* -> Controller */,
  /** Normalizes a sched.* payload (6.20.4.2). Returns null for payloads it cannot use. */
  readSched(topic, payload) /* -> SchedEvent|null */,

  Controller,      // interface below; base class with shared helpers
  Visualizer,      // class
  StageDirector,   // class
  BeatIndicator: {
    /** Beat state at a musical position (tick may be negative during the count-in). */
    at(meterMap, tick) /* -> BeatState */,
    /** Section marker in effect at tick, or null. */
    section(markers, tick) /* -> {index:number, label:string, tick:number}|null */
  },

  Mixer: {
    /** Bind to a transport and song for one mode (owner = the mode token). transport may be
     *  null (customize preview). Subscribes to the topics listed below with owner. */
    bind(opts /* {transport, song, owner, tierParams, reducedMotion:boolean, cameraMotion:boolean,
                  playerSlot:number|null, director:boolean} */) /* -> void */,
    /** Add a performer. rig null -> visualizer-only performer (abstract). */
    add(performer /* {id, slot, trackId:string|null, program, isDrums, rig:Rig|null, lengths,
                       characterId, style, layout:PropLayout|null} */) /* -> Controller|null */,
    remove(id) /* -> boolean */,
    /** Rig-affecting character edit: new lengths and prop layout for one performer; the
     *  controller keeps its stored events. */
    relayout(id, lengths, layout) /* -> boolean */,
    /** Once per frame from Stage.update. musicTick = Transport.positionAt(audioNow) (float). */
    update(musicTick, audioNow, dtMs) /* -> {animated:number, poses:number, items:number} */,
    animTime() /* -> number seconds (audio time minus accumulated paused time) */,
    beat() /* -> BeatState of the last update */,
    section() /* -> {index, label, tick}|null */,
    visualizer() /* -> Visualizer */,
    director() /* -> StageDirector|null */,
    performers() /* -> [{id, slot, profile, trackId, weight, intensity, animated}] */,
    setTier(tierParams) /* -> void */,
    setReducedMotion(on) /* -> void */,
    /** Customization preview: synthesizes a 2-bar 100 BPM pattern for the profile in animation
     *  time driven by audioNow = performance seconds passed by the caller (no transport). */
    preview(on, profile) /* -> void */,
    dispose() /* -> void: unsubscribes (owner), disposes controllers, clears the visualizer */
  }
};

// SchedEvent (normalized; times are animation time after the Mixer's pause offset)
// { type:'noteOn'|'noteOff'|'cc'|'bend'|'program', trackId, eventId, pitch, velocity, channel,
//   at, atOff /* noteOn only: planned release time; Infinity when unknown */, controller, value,
//   program, live:boolean, seen /* animation time when received */, index /* per-track arrival ordinal */ }

// Controller interface
// {
//   profile: string, id: string,
//   onEvent(evt /* SchedEvent */) -> void,       // inserts by `at` (binary insert; order of arrival is irrelevant)
//   onBeat(beat /* BeatState */) -> void,        // beat bookkeeping (bob phase reference)
//   /** Pure function of the stored events and the arguments (no frame-count state). */
//   update(musicTime /* ticks */, animNow /* s */, dtMs) -> Pose,
//   idlePose(animNow) -> Pose,
//   activity(animNow) -> {sounding:boolean, weight:number /* 0..1 idle->playing */, intensity:number /* 0..1 */},
//   reset(animNow, reason /* 'seek'|'stop'|'swap' */) -> void,   // drops events; pose eases to idle over 0.2 s
//   dispose() -> void
// }

// BeatState { bar, beat, phase /* 0..1 within the beat */, isDownbeat, numerator, denominator,
//             countIn:boolean, beatIndex /* monotonic integer: bar * 64 + beat */ }
// PropLayout { profile, anchors: { name -> Float32Array(3) performer space }, dirs: { name -> unit vec3 },
//              sizes: { name -> number } }   (anchor names per profile in 6.20.4.4)
// VisualItem { kind:'note'|'ring'|'pitch'|'trail', slot, trackId, x, y, z /* stage space m */, size,
//              color /* '#rrggbb' */, alpha, points /* trail only: [[x,y,z] x <= 4] */ }
// DirectorCut { bar, preset:'FullBand'|'Focus', slot:number|null, reason:'default'|'focus'|'section'|'user'|'reset' }
```

Events emitted: `director.cut {preset, slot, reason, at, tick}` (by the `StageDirector`
through the Mixer, at most one per 4 bars except `user` and `reset`).

Events consumed (subscribed in `Mixer.bind` with the mode owner): `sched.noteOn`,
`sched.noteOff`, `sched.cc`, `sched.program` and `sched.bend`;
`transport.state`, `transport.seek`; `render.tier`;
`settings.changed` for `video.reducedMotion` and `video.cameraMotion`. Beat and marker state
is derived from the Transport position each frame (`BeatIndicator`), so `sched.beat` and
`sched.marker` are not required by this module.

#### 6.20.3 Internal state

- Mixer: `{transport, song, owner, tier, reducedMotion, cameraMotion, playerSlot,
  performers: Map<id, Perf>, byTrack: Map<trackId, Perf[]>, pausedTotal, pausedAt (audio s or
  null), frozenAnim (s or null), frame (integer counter for animEveryNthFrame), lastBeat,
  visualizer, director, preview}`.
- `Perf = {id, slot, trackId, rig, lengths, layout, controller, profile, characterId, style,
  seed, swap: {at, controller, until} | null, lastPose: Pose, animated: boolean}`.
- Controller common state: `notes: SchedEvent[]` sorted by `at` (note-ons with their
  `atOff`, updated by matching note-offs), `controls: SchedEvent[]` sorted by `at` (cc and
  bend), `groups: Group[]` per hand or limb (chord groups, computed incrementally on insert),
  `resetAt`, `resetFrom: Pose`. Retention: events whose `max(at, atOff) < animNow - 2.5 s` are
  pruned at the start of `update`; at most 512 stored events per controller (oldest dropped,
  `Log.once('anim-cap-' + id)`).
- Visualizer: `events` ring of spawn records `{kind, at, life, slot, trackId, pitch, velocity,
  color, atOff}` sorted by `at`, capacity 1,024; `cap` from the tier; `reducedMotion`.
- StageDirector: `cuts: DirectorCut[]` (the plan), `index` of the cut in effect, `lastBar`,
  `enabled`, `user: {preset, slot}|null`.
- Invariants: controller output is a pure function of (stored events, `animNow`,
  `musicTime`, seed, style, reduced-motion flag); no controller reads a clock; `pausedTotal`
  only increases; `frozenAnim !== null` exactly while the transport is `paused` (the
  count-in runs animation time normally).

#### 6.20.4 Algorithms

6.20.4.1 Controller selection (`controllerFor`)

`isDrums` -> `drums`. Otherwise `PROFILE_OVERRIDES[program]` when present, else
`PROFILE_BY_FAMILY[program >> 3]`:

| Family (programs) | Profile | Family (programs) | Profile |
|---|---|---|---|
| 0 Piano (0-7) | keys | 8 Reed (64-71) | winds |
| 1 Chromatic Percussion (8-15) | percussion | 9 Pipe (72-79) | winds |
| 2 Organ (16-23) | keys | 10 Synth Lead (80-87) | synth |
| 3 Guitar (24-31) | guitar | 11 Synth Pad (88-95) | synth |
| 4 Bass (32-39) | bass | 12 Synth Effects (96-103) | synth |
| 5 Strings (40-47) | strings | 13 Ethnic (104-111) | guitar |
| 6 Ensemble (48-55) | strings | 14 Percussive (112-119) | percussion |
| 7 Brass (56-63) | winds | 15 Sound Effects (120-127) | abstract |

Overrides: 45 Pizzicato Strings -> `strings` with `pizzicatoAlways:true`; 46 Orchestral Harp
-> `guitar`; 47 Timpani -> `percussion`; 52 Choir Aahs, 53 Voice Oohs, 54 Synth Voice, 85
Lead 6 (voice), 91 Pad 4 (choir) -> `vocal`; 109 Bagpipe, 111 Shanai -> `winds`. The family
table equals the `animProfile` column of M-06 (6.6.3); the overrides are the animation
module's refinement and are authoritative for animation (UT-20-02 checks agreement for every
other program).

6.20.4.2 Event intake (`readSched`, `Mixer` routing)

`readSched(topic, p)` reads the payload fields of the topic catalog (Part 4.4: `at`, `atOff`,
`eventId`; one topic per control kind: `sched.cc`, `sched.program`, `sched.bend`):

```js
function readSched(topic, p) {
  const at = num(p.at); if (!Number.isFinite(at)) return null;
  const base = { trackId: p.trackId, channel: p.channel | 0, at, live: !!p.live };
  if (topic === 'sched.noteOn') return { ...base, type: 'noteOn', eventId: p.eventId,
      pitch: p.pitch, velocity: p.velocity, atOff: num(p.atOff, Infinity) };
  if (topic === 'sched.noteOff') return { ...base, type: 'noteOff', eventId: p.eventId, pitch: p.pitch };
  const kind = topic.slice(6);     // 'cc' | 'bend' | 'program'
  if (kind === 'cc') return { ...base, type: 'cc', controller: p.controller, value: p.value };
  if (kind === 'bend') return { ...base, type: 'bend', value: p.value };
  if (kind === 'program') return { ...base, type: 'program', program: p.program };
  return null;
}
// num(a, b, fallback) returns the first finite argument, else fallback (NaN when omitted)
```

The Mixer converts times to animation time (`at - pausedTotal`, same for `atOff`), sets
`seen = animTime()` and `index` (arrival ordinal per track), and routes by `trackId` to every
performer of that track (normally one). A `noteOff` updates the stored note-on with the same
`eventId` (or, without an id, the oldest open note of that pitch and channel) to `atOff =
min(atOff, at)`. Events for tracks without a performer go only to the visualizer's ensemble
area (6.20.4.10). `program` events schedule a controller swap (6.20.4.11).

6.20.4.3 Shared timing functions (all times in seconds, animation time)

```js
// anticipation actually available for a note (late scheduler ticks shorten it, never lengthen)
function lead(e) { return e.live ? 0 : clamp(e.at - Math.max(e.seen, e.at - 0.120), 0.030, 0.120); }
// strike: lift is 0 at contact time e.at, peaks at e.at - A/2, small rebound after contact
function strikeLift(t, e, A, amp) {
  if (e.live) {                                     // no lookahead: short dip from the hover height
    const c = e.at + 0.030;
    if (t < e.at || t > c + 0.20) return 0;
    if (t < c) return amp * 0.15 * (1 - smoothstep(e.at, c, t));
    return amp * 0.25 * Math.sin(Math.PI * (t - c) / 0.20);
  }
  if (t < e.at - A || t > e.at + 0.20) return 0;
  if (t < e.at - A / 2) return amp * smoothstep(e.at - A, e.at - A / 2, t);
  if (t < e.at) return amp * (1 - smoothstep(e.at - A / 2, e.at, t));
  return amp * 0.25 * Math.sin(Math.PI * (t - e.at) / 0.20);
}
// transition between successive targets of one hand: starts at the next group's lead
function approach(t, prevAt, prev, next, nextAt, A) {
  const t0 = Math.max(prevAt, nextAt - A), t1 = nextAt - 0.010;
  return lerp(prev, next, smoothstep(t0, Math.max(t0 + 1e-3, t1), t));
}
function amplitude(base, velocity, style, reduced) {
  return base * (0.35 + 0.65 * velocity / 127) * STYLE_GAIN[style] * (reduced ? REDUCED_MOTION_GAIN : 1);
}
```

Consecutive strikes on one limb: when a gesture's window `[at - A, at + 0.20]` would overlap
the previous gesture on that limb, `A` is reduced to `min(A, 0.9 * (at - prevAt))` and the
previous rebound is cut at the new raise start; the limb lift is the value of the gesture
whose window contains `t` (the later one wins in the overlap). Minimum visible gesture: a
note shorter than 60 ms is treated as 60 ms long for holds and dips (very short notes stay
visible, E 6.1).

Intensity (`INTENSITY`): `I(t) = clamp(0.6 * vLast / 127 + 0.4 * min(1, n / 8), 0, 1)` where
`vLast` is the velocity of the latest note with `at <= t` and `at > t - 2` (else 0) and `n`
the number of note-ons with `at` in `(t - 1, t]`.

Playing weight: `sounding(t)` is true when a stored note has `at <= t < max(atOff, at +
0.06)`. `w(t) = 1` when sounding; otherwise `w = max(rise, fall)` with `rise =
smoothstep(nextAt - lead(next), nextAt, t)` for the next known note-on and `fall = 1 -
smoothstep(lastOff + 0.5, lastOff + 1.0, t)` after the latest release. A rest longer than
1 s therefore reaches `w = 0` (idle) and stays there until the next note's anticipation.

Pose composition per controller (every profile):

```text
update(musicTime, t, dt):
  prune(t)
  idle = idlePose(t)                          // base posture + breathing
  play = copy(idle) + profile gestures(t)     // 6.20.4.5 to 6.20.4.9, IK to the gesture targets
  w = weight(t); I = intensity(t)
  if !reducedMotion and standing profile: bob = 0.012 * I * w * (1 + cos(2 PI * beatPhase)) / 2
       play.root.y -= bob; head pitch += 2 deg * I * w * (1 + cos(2 PI beatPhase)) / 2   (drums: chest pitch 2 deg instead)
  posture lean: play chest pitch += 4 deg * w (leaning into the instrument; reduced motion keeps it)
  out = play                                  // gesture offsets are zero during rests; w scales only bob and lean
  if resetAt is set and t < resetAt + 0.2: out = blend(resetFrom, out, smoothstep(resetAt, resetAt + 0.2, t))
  return out
```

`beatPhase` comes from the latest `onBeat` state, which the Mixer derives from `musicTime`
(not from frames). Breathing in `idlePose`: chest pitch `+0.8 deg * sin(2 PI (t / 4 +
phase))` with `phase = (fnv1a32(characterId) % 1000) / 1000`, so two performers never breathe
in unison (P 7.2 identical motion) and the same character always breathes the same way
(determinism). Breathing amplitude is 0.8 degrees in every tier and is the only motion during
rests (S-17 idle bounds: deviation from the idle reference 0; idle reference within 1 degree
of the base posture).

6.20.4.4 Prop layouts (`layoutFor(profile, L)`, performer space, `s = heightScale`)

| Profile | Anchors (meters) | Rest wrist targets (L, R) |
|---|---|---|
| keys, synth | `keys` = (0, L.hipsY - 0.02, 0.36 s); `keysWidth` 1.0 (61 keys, MIDI 36-96); `knob` = (-0.56, keys.y + 0.03, keys.z - 0.08); `wheel` = (+0.56, keys.y + 0.03, keys.z - 0.05) | (+0.20, keys.y + 0.05, keys.z - 0.02), (-0.20, same) |
| guitar | `bridge` = hip attachment + (0.03 s, 0, 0.06 s); `neckDir` = normalize(0.88, 0.40, 0.25); `scaleLen` 0.62; `nut` = bridge + neckDir * 0.62; `stringAxis` = normalize(cross(neckDir, (0, 0, 1))) | L: fret 5 position; R: bridge + (0, 0.04, 0.04) |
| bass | as guitar with `scaleLen` 0.76, neckDir normalize(0.80, 0.50, 0.25) | L: fret 5; R: bridge + (0.02, 0.03, 0.04) |
| strings | `body` = chest attachment + (0.10 s, 0.02 s, 0.05 s); `neckDir` = normalize(0.75, 0.10, 0.65); `neckLen` 0.33; `contact` = body + (-0.02, 0.03, 0.02); `bowAxis` = normalize(-1, 0, 0.3) | L: body + neckDir * 0.20; R: contact |
| winds | `mouthpiece` = mouth attachment + (0, 0, 0.02 s); `horn` = (0, mouth.y - 0.18 s, 0.28 s) | L: horn + (0, 0.06, 0); R: horn + (0, -0.08, 0.02) |
| percussion | `bar` = (0, L.hipsY - 0.05, 0.40 s); `barWidth` 0.9 | (+0.20, bar.y + 0.10, bar.z - 0.05), (-0.20, same) |
| drums (seated) | hips lowered to 0.55 s; pieces: `snare` (+0.18, 0.62, 0.38), `hihat` (+0.38, 0.85, 0.30), `tomHigh` (+0.12, 0.85, 0.55), `tomMid` (-0.15, 0.85, 0.55), `floorTom` (-0.42, 0.60, 0.35), `ride` (-0.55, 1.05, 0.40), `crash1` (+0.50, 1.20, 0.50), `crash2` (-0.45, 1.25, 0.60), `misc` (+0.05, 0.75, 0.30), `kickPedal` (-0.10, 0.02, 0.45), `hatPedal` (+0.25, 0.02, 0.40); all times `s` | L: snare + (0, 0.10, -0.12); R: hihat + (-0.05, 0.12, -0.12) |
| vocal | `mic` = mouth attachment + (0, -0.02 s, 0.10 s) | arms hanging (rest FK, no IK) |
| abstract | none | none (no rig) |

The performer's left is +X (6.19.3), so low keys, the guitar neck, the snare and the left
crash are on the +X side. M-21 builds its prop meshes at exactly these anchors (6.21.4.3).

6.20.4.5 Keys (and the keys part of synth)

1. Hand assignment: pitch < 60 -> left hand, >= 60 -> right hand (split at MIDI 60).
2. Key position: `x(p) = clamp((66 - p) * 0.0164, -0.49, 0.49)` relative to `keys.x` (low notes
   at +X).
3. Groups: note-ons of one hand within 30 ms of the group's first note form a group; group
   `x` = mean of its key positions; `spread = clamp(1 + (maxX - minX) / 0.30, 1, 1.6)` (chord
   density widens the fingers; a single note has spread 1).
4. Hand x at time t: `approach` from the previous group's x to the next group's x over the
   next group's lead; after 1 s without a group the hand eases back to its rest x over 0.4 s.
   Constraint: `xLeft >= xRight + 0.08` (hands never cross; the hand with the later group
   yields; for simultaneous groups the right hand yields).
5. Press dip (wrist y below the hover height `keys.y + 0.05`): `D = amplitude(0.015, v)`;
   `t in [at - 0.03, at]`: `D * smoothstep(at - 0.03, at, t)`; while sounding: `D * (0.5 + 0.5 *
   (1 - smoothstep(at, at + 0.08, t)))`; after release: `0.5 D * (1 - smoothstep(atOff, atOff +
   0.08, t))`. Several sounding groups in one hand: the deepest dip wins.
6. Wrist target = `(keys.x + x, keys.y + 0.05 - dip, keys.z - 0.02)`; `ikArm` with the default
   pole; hand rotation pitched -10 degrees (palm toward the keys). `pose.spread[hand] = spread`
   of the latest group with `at <= t + lead` while sounding, else eases to 1 over 0.2 s.

6.20.4.6 Drums (seated)

Limb and piece map (`DRUM_MAP`; keys not listed and keys outside 35-81 map to `misc` with
alternating hands by arrival parity):

| GM keys | Piece | Limb |
|---|---|---|
| 35, 36 | kickPedal | footR |
| 37, 38, 39, 40 | snare | handL |
| 42, 46 | hihat | handR |
| 44 | hatPedal | footL |
| 41, 43 | floorTom | handR |
| 45, 47 | tomMid | handR |
| 48, 50 | tomHigh | handL |
| 49, 55 | crash1 | nearest (left side) |
| 52, 57 | crash2 | nearest (right side) |
| 51, 53, 59 | ride | handR |
| 54, 56, 58, 60-81 | misc | alternate (handL for even arrival index, handR for odd) |

Rules:

1. Nearest hand: the hand on the cymbal's side, unless that hand has a gesture with `abs(at -
   other.at) < 0.06`, then the other hand; when both are busy, the side hand (the gestures
   merge).
2. Merge: two gestures on one limb with contact times closer than 40 ms become one strike at
   the earlier time with the higher velocity; its piece is the piece of the louder event
   (equal velocity: the lower GM key).
3. Hand target: piece position plus the stick offset `(0, 0.10, -0.12)` (wrist above and behind
   the contact point); between strikes the wrist moves to the next piece with `approach` during
   the raise phase. Vertical lift `strikeLift(t, e, A, amplitude(0.18, v))` is added to y.
   Stick angle: hand pitch `-20 deg - 40 deg * lift / amp` so the stick tip meets the piece at
   contact.
4. Feet: ankle (foot joint) pitch `+25 deg * strikeLift(t, e, A, 1)` (heel-down pivot: the toe
   rises in the raise phase and is down at contact); 46 open hat additionally lifts the left toe
   10 degrees during `[at, at + 0.25]`.
5. Seated base pose: root y offset `0.55 s - hipsY`; `upLegL/R` euler `(-1.48, 0, +-0.10)`
   rad; `legL/R` `(1.48, 0, 0)`; feet flat; chest pitch +6 degrees.

Assertable property (S-03): for a kick at `at = 2.000` with full lead, the right ankle pitch is
0 at `t = 2.000` and `25 deg * 1` at `t = 1.940` (the raise peak `at - A/2`), whatever the
number of `update` calls in between.

6.20.4.7 Guitar and bass

1. Groups: note-ons within 30 ms form a group; `size = notes in group`; anchor pitch = the
   lowest pitch.
2. String and fret: tuning guitar `[40, 45, 50, 55, 59, 64]`, bass `[28, 33, 38, 43]`. For the
   anchor pitch p: among strings with `p >= tuning[i]` pick the one minimizing `fret = p -
   tuning[i]` subject to `fret <= 15` (guitar) or `<= 12` (bass); if none (p below the lowest
   string) use string 0 fret 0; if p exceeds every string's range use the top string with
   `fret = min(p - top, 19)`.
3. Fret hand target: `nut - neckDir * fretMid(n) + stringAxis * (stringIndex - (count - 1) / 2) *
   0.008` with `fretX(n) = scaleLen * (1 - 2^(-n / 12))` and `fretMid(n) = n === 0 ?
   fretMid(previous) : (fretX(n) + fretX(n - 1)) / 2` (open strings keep the hand where it is).
   Transition with `approach` over the group's lead. Hand rotation: palm facing the neck
   (`rotationTo` from local +Z to `-stringAxis`).
4. Strum (guitar) or pluck (bass) hand: strum amplitude `S = amplitude(size >= 3 ? 0.08 :
   0.03, v)` (chords full strokes, single notes pick strokes); direction `dir = groupIndex % 2 ===
   0 ? +1 : -1` (down, up alternating); offset along `stringAxis` from the bridge: `y = dir * S *
   cos(PI * smoothstep(at - 0.04, at + 0.04, t))`, which crosses the strings exactly at `at`;
   between strokes the hand eases from the previous end point to the next start point with
   `approach`. Bass: instead of strokes, a pluck `strikeLift(t, e, A, amplitude(0.02, v))`
   toward the body (negative z), alternating x by `+-0.01` per note.
5. Vibrato: a note with `atOff - at > 0.5` adds to the fret hand along `neckDir`
   `0.004 * sin(2 PI * 5.5 * (t - at - 0.25)) * smoothstep(at + 0.25, at + 0.35, t)` for `t in [at
   + 0.25, atOff]`.
6. Harp (46) uses the guitar controller with the instrument prop `generic` and only the pluck
   rule (both hands alternate).

6.20.4.8 Strings, winds, percussion

Strings (bowed): left hand along `neckDir` at `0.04 + (clamp(p, 55, 100) - 55) / 45 * 0.22`
from the body; per note i: `dir = i % 2 === 0 ? +1 : -1`; stroke length `len = 0.15 + 0.35 *
min(1, (atOff - at) / 1.0)`; right wrist = `contact + bowAxis * dir * (k - 0.5) * len` with `k =
clamp((t - at) / max(0.15, min(atOff - at, 2.0)), 0, 1)`; between notes the hand holds its
last position and eases to the next start over the next note's lead. Pizzicato when `atOff -
at < 0.15` or `pizzicatoAlways` (program 45): right wrist at `contact + (0, 0.04, 0)` with
`strikeLift(t, e, A, amplitude(0.03, v))` toward the strings, no bow motion.

Winds and brass: hands at the horn anchors; breath posture while sounding: chest pitch `-3
deg * w_s` and shoulders roll `+2 deg * w_s` where `w_s = smoothstep(at, at + 0.10, t)` during a
note and `1 - smoothstep(atOff, atOff + 0.15, t)` after (torso expansion on sustain); inhale
before a phrase: when a note-on follows the previous release by more than 0.25 s, shoulders
rise 3 degrees and the chest pitches back 2 degrees during `[at - lead, at]`. Finger fidget:
on each note-on the left wrist y offset becomes `((p % 12) - 5.5) * 0.0012` m and the right
`(((p * 7) % 12) - 5.5) * 0.0012` m, reached over `[at - 0.04, at]`.

Percussion (mallets, chromatic percussion, timpani): `x(p) = clamp((72 - p) * 0.0125, -0.45,
0.45)` across the bar; hand by pitch (`p < 72` left, else right), two strikes on one hand within
40 ms -> the second goes to the other hand; strike `strikeLift(t, e, A, amplitude(0.12, v))`
with the wrist moved to the bar position over the lead. Timpani (47) maps `x` from MIDI 40-60
across the bar.

6.20.4.9 Synth, vocal, abstract

Synth: the keys rules (6.20.4.5) plus control gestures. CC 1 or CC 74 at `at` sets `knobUntil
= at + 0.4`; while `t < knobUntil` and the right hand has no group with `at` in `[t - 0.2, t +
lead]`, the right wrist targets `knob + (0, 0.05, 0)` (approach over 0.12 s, and back to the
keys over 0.12 s after `knobUntil`) and its roll is
`(value / 127 - 0.5) * 90 deg` using the latest CC 1 or 74 value with `at <= t`. Pitch bend
moves the left wrist to `wheel` the same way with wrist pitch `value / 8192 * 20 deg` while
`abs(value) > 256`. Other controllers produce no motion (no invented activity).

Vocal: the performer stands at the mic with arms at rest; each note-on nods the head `amplitude(3
deg, v)` over `[at - 0.05, at + 0.25]` (rise to peak at `at`, return by `at + 0.25`); the
visualizer spawns floating notes at the mouth (6.20.4.10). No other body motion.

Abstract (Sound Effects family, and any performer whose rig failed validation): no humanoid;
`update` returns null and the Mixer spawns visualizer rings and floating notes at the slot.

6.20.4.10 Visualizer

Spawn rules (every spawn is created when the event is received, stored with its audio-time
fields, and becomes visible only when `animNow >= at`, so nothing appears before its sound):

| Source | Item | Life | Geometry over age `a = t - at` |
|---|---|---|---|
| note-on of a `vocal` or `abstract` performer, or of a performer not animated in the current tier | `note` | `clamp(atOff - at, 0.25, 2.0) + 0.6` | x = slotX + ((p % 12) - 5.5) * 0.06; y = baseY + clamp((p - 36) / 60, 0, 1) * 1.6; z = slotZ; drift up `0.25 * a / life` m (none with reduced motion); size `0.06 + 0.06 * v / 127`; alpha 1 until `atOff`, then fades to 0 over 0.6 s |
| same, High tier only | `trail` attached to the note | as the note | 4 points at the note's positions for ages `a - 0.05 k`, k = 1..4, alpha `0.5 / k`; none with reduced motion |
| note-on of a track with no performer (ensemble area at the back of the stage, x by track index across -3..3 m) | `note` | as above | as above with the track color |
| drums kick (35, 36) or snare (38, 40) when `video.effectsLevel >= 1` | `ring` on the floor at the drum slot | 0.5 | radius 0.2 -> 1.0 m, alpha 0.8 -> 0 (reduced motion: radius fixed 0.6 m, alpha fade only) |
| any sounding note of a `vocal` or `abstract` performer | `pitch` bar at the slot | while sounding | height = mapped highest sounding pitch (same y mapping), width 0.05 m |

`items(t)` returns the alive items (`at <= t < at + life`) sorted by `at` then `eventId`,
truncated to the newest `cap` items (`TIERS[tier].visualizerCap`: 128, 96, 48, Abstract 64).
Items are computed from the stored spawn records at each call, so a frame drop never changes
which items exist at a given time. With no events there are no items (S-17). In the Abstract
tier M-21 converts the same items to normalized coordinates for `Flat2D.drawVisualizer`.

6.20.4.11 Mixer frame update, pause continuity, program changes and tier limits

```text
on transport.state p:
  if p.state == 'paused': pausedAt = p.audioTime; frozenAnim = pausedAt - pausedTotal
       for every controller: drop stored events with at > frozenAnim (they were scheduled but never sounded)
  if p.prev == 'paused' and p.state in ('playing','recording','countin'):
       pausedTotal += p.audioTime - pausedAt; pausedAt = null; frozenAnim = null
  if p.state == 'stopped': for every controller reset(animTime(), 'stop'); visualizer.clear(); frozenAnim = null
on transport.seek: every controller reset(animTime(), 'seek'); visualizer.clear(); director.resync(p.toTick)
animTime(audioNow) = frozenAnim !== null ? frozenAnim : audioNow - pausedTotal
update(musicTick, audioNow, dt):
  t = animTime(audioNow); frame++
  beat = BeatIndicator.at(transport.meterMap(), musicTick); if beat.beatIndex != lastBeat.beatIndex: controllers.onBeat(beat)
  director && director.update(musicTick, audioNow)          // may emit director.cut
  for perf in performers:
    if perf.swap and t >= perf.swap.at: start crossfade: old = perf.controller, perf.controller = perf.swap.controller,
         perf.swap = {from: old, until: t + 0.3}
    if not perf.animated (tier limit): rig.setPose(controller.idlePose(t)) once when it became non-animated; continue
    if frame % tier.animEveryNthFrame != 0: continue
    pose = perf.controller.update(musicTick, t, dt)
    if perf.swap.from: pose = blend(perf.swap.from.update(musicTick, t, dt), pose, smoothstep(until - 0.3, until, t)); dispose from at until
    perf.rig.setPose(pose)
  visualizer.update(t)
```

Paused animation time is frozen, so performers hold their pose while paused (no motion is
invented during a pause) and resume continuously: an event scheduled after the resume
arrives with an audio time that, minus the new `pausedTotal`, lies just after the frozen
time. Program change (`sched.program` at `at`): when `controllerFor({program, isDrums})`
differs from the current profile, a new controller is created with the same rig and layout
for the new profile and swapped in at `at` with a 0.3 s crossfade; M-21 swaps the prop at
the same animation time (6.21.4.3). Same profile: only the `program` field changes.

Tier limits: `performersAnimated` (5, 5, 3, 0). With fewer slots than performers, the animated
set is the player's slot (if any) plus the performers with the highest note-on count over the
last 2 s (ties by lower slot), recomputed at each bar boundary (not per frame, so the set does
not flicker); the others hold their idle pose and get `note` visualizer spawns instead. Abstract
tier: no poses at all; the band columns in Flat2D show each performer's intensity and sounding
pitches.

Reduced motion (`video.reducedMotion` `on`, or `system` with `prefers-reduced-motion:
reduce`): no beat bob, gestures scaled by 0.7, no visualizer drift or trails, ring radius
fixed, director disabled (camera stays on the selected preset). Instrument gestures remain
because they carry the event-to-visual relationship (ADR-13 decision 8).

Customization preview (`preview(on, profile)`): with `transport` null the Mixer synthesizes,
in animation time `t` = the caller's clock (performance seconds), a looping 2-bar pattern at 100
BPM: keys and synth alternate a C major triad (60, 64, 67) and a bass note 48 on every beat;
guitar and bass strum on beats 1 and 3 and pick on 2 and 4; drums kick on 1 and 3, snare on 2
and 4, hihat eighths; strings and winds one note per bar; percussion eighth notes; vocal one note
per beat. Events are generated one bar ahead with `seen = at - 0.120`, so preview gestures use
the same code path as a song.

6.20.4.12 StageDirector (deterministic cut plan)

```text
plan(song, meterMap, perfs /* [{slot, trackId}] */):
  bars = meterMap.barCount(song.durationTicks)
  notesPerBar[p] = Int32Array(bars) counting the NoteEvents of perfs[p].trackId by meterMap.barAt(tick).bar
  sectionBars = set of barAt(m.tick).bar for markers with kind 'section' and bar > 0
  cuts = [{bar:0, preset:'FullBand', slot:null, reason:'default'}]
  lastCut = 0; mode = 'FullBand'; focusUntil = -1; cooldown = {}; pendingSection = false
  for b in 1 .. bars - 1:
    if sectionBars.has(b): pendingSection = true
    if b - lastCut < 4: continue                                 // no cut more often than every 4 bars
    if mode == 'Focus' and b < focusUntil: continue              // a focus lasts 8 bars
    if pendingSection: push FullBand 'section' at b; pendingSection = false; continue
    dens[p] = sum(notesPerBar[p][b .. min(b + 7, bars - 1)]) / 8
    best = argmax dens (ties: lower slot); others = perfs with dens > 0 except best
    meanOthers = others empty ? 0 : mean(dens over others)
    if perfs.length >= 2 and dens[best] >= 1 and dens[best] > 2 * meanOthers and (cooldown[best] or 0) <= b:
       push Focus(slot of best) 'focus' at b; focusUntil = b + 8; cooldown[best] = b + 16
    else if mode == 'Focus': push FullBand 'default' at b
  (push sets mode and lastCut = b)
  return cuts
```

`update(tick, audioNow)`: `bar = meterMap.barAt(max(0, floor(tick))).bar`; when `bar !==
lastBar`, the cut with the greatest `bar <= current bar` is compared with the cut in effect; a
change emits `director.cut {preset, slot, reason, at: audioNow, tick: floor(tick)}`.
`resync(tick)` (after a seek) emits the cut in effect at the new bar with `reason:'reset'`.
`setUser(preset, slot)` emits `reason:'user'` immediately and disables the plan until
`setUser(null)`. The director is enabled only when `video.cameraMotion` is true, the user
camera preset is `FullBand` and reduced motion is off; otherwise it emits nothing and the
camera keeps the user's preset. The plan depends only on the song, the meter map and the slot
assignment, so the same song always produces the same camera direction (P 7.3).

6.20.4.13 BeatIndicator

```js
at(meterMap, tick) {
  if (tick < 0) {                                        // count-in: meter of the first entry
    const e = meterMap.entries[0], tpb = 960 * 4 / e.denominator;
    const bi = Math.floor(tick / tpb), beat = ((bi % e.numerator) + e.numerator) % e.numerator;
    return { bar: Math.floor(bi / e.numerator), beat, phase: (tick - bi * tpb) / tpb, isDownbeat: beat === 0,
             numerator: e.numerator, denominator: e.denominator, countIn: true, beatIndex: Math.floor(bi / e.numerator) * 64 + beat };
  }
  const b = meterMap.barAt(Math.floor(tick)), m = meterMap.entryAt(Math.floor(tick));
  return { bar: b.bar, beat: b.beat, phase: (b.tickInBeat + (tick - Math.floor(tick))) / b.ticksPerBeat,
           isDownbeat: b.beat === 0, numerator: m.numerator, denominator: m.denominator, countIn: false,
           beatIndex: b.bar * 64 + b.beat };
}
```

`section(markers, tick)` binary-searches the markers sorted by tick for the last `kind:
'section'` marker with `tick <= tick`. The HUD (M-26) and the stage light pulses (M-21) use
these values; they are music structure, not invented activity, so they continue during rests.

#### 6.20.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Controller throws in `update` (E-REN-010) | try/catch per performer in `Mixer.update` | other performers, transport, audio | after 5 s the controller is recreated once; a second failure keeps the fallback | no | diagnostics only | that performer shows its idle pose and visualizer spawns | recreation on the next `transport.seek` or mode enter | UT-20-30 |
| Events out of order or duplicated | binary insert by `at`; duplicate `eventId` ignored | stored event list | n/a | no | none | none | n/a | UT-20-21 |
| Unknown or malformed `sched.*` payload | `readSched` returns null | everything | n/a | no | `Log.once('anim-bad-payload')` | event ignored | n/a | UT-20-03 |
| Note-off missing (stuck) | `atOff` Infinity; notes older than 60 s are treated as released (scheduler `VOICE_MAX_S`) | pose | n/a | no | none | hold ends at 60 s | prune | UT-20-09 |
| Event storm (dense passages) | 512-event cap per controller | newest events | n/a | no | `Log.once('anim-cap-<id>')` | oldest gestures dropped | prune | UT-20-31 |
| Rig attachment missing for the profile | M-21 `validateAttachments` result passed as `rig:null` | performer slot | after a rig-affecting change | no | none | abstract visualizer at the slot | rebuild | UT-20-17 |
| Director plan on a song without meter entries | `meterMap.entries.length === 0` | default meter 4/4 used (M-03 guarantees an entry at tick 0) | n/a | no | none | FullBand only | n/a | UT-20-26 |

#### 6.20.6 Limits and performance notes

- Per frame: at most 5 controller updates (each O(events in the 2.5 s window), typically <= 50)
  and two IK solves per performer; target <= 0.5 ms total on desktop, <= 1.5 ms on mobile.
- Event intake: up to 2,000 `sched.noteOn` per second (Part 4.4); each insert is O(log n) with
  a 512-event cap; routing is a Map lookup.
- Visualizer: at most 1,024 stored spawns; `items()` is O(alive) with the tier cap.
- Director planning: O(total notes + bars), run once per bind; <= 20 ms for a 100,000-note song.
- No allocation per frame beyond the returned item array (reused buffer of `cap` objects).

#### 6.20.7 Spec coverage

B 12.3 (instrument-specific animation from actual events: keys hand position and chord
density, guitar fretting hand and strumming, drum limbs, strings bowing and plucking, winds
breath and hand gestures, percussion strikes, synth keyboard and control gestures; no generic
arm motion for every instrument), B 12.4 (floating notes, pitch indicators, rings, motion
trails, beat-synchronized effects source data), B 12.5 (polyphonic visualization without one
humanoid per note; intensity from density and velocity), B 12.6 (animation scheduler,
event-to-animation mapping), B 14.3 (shared timeline foundation used by M-23 choreography), B
26.4 (animations respond to actual events; several instruments at once), E 6.1 (simultaneous
notes, instrument change mid-song, long rests, very short and very long notes, camera switch,
hidden performer, missing rig, customization, out-of-order events, dropped frames), E 10
item 5, I 4.2, I 4.3 (performance director: emphasis on solos, reaction to sections,
deterministic and disableable), I 4.4 (beat and measure indicators, active-note and
velocity-responsive animation, never inventing activity during silence), P 7.2 (no snapping,
attached hands, still during rests, smooth idle/playing blends, distinct motion per musician,
correct under frame drops), P 7.3 (solo highlighting, deterministic direction, motion can be
reduced), P 12 and P 15 (reduced motion respected), P 21 (effects synchronized with music).

#### 6.20.8 Unit tests (group `animation`, file `src/91-test-animation.js`; controllers are tested
with a rig built without GL (`createRig` with a stub `Render.geometry` that returns CPU-only
meshes) and synthetic `SchedEvent` lists; times are animation seconds)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-20-01 | profile table | `controllerFor` for programs 0-127 and drums | values per 6.20.4.1 including every override; drums -> 'drums' |
| UT-20-02 | agrees with instrument definitions | `FLM.Instruments.definition(p).animProfile` for all p (test build) | equal to `PROFILE_BY_FAMILY[p >> 3]` for every program; overrides differ only for the listed programs |
| UT-20-03 | readSched maps the sched.* payloads | `sched.noteOn` and `sched.noteOff` payloads with `at/atOff/eventId`; `sched.cc`, `sched.bend` and `sched.program` payloads; payload without a time | SchedEvents of type noteOn, noteOff, cc, bend, program with the same fields; null for the last |
| UT-20-04 | drum kick contact and raise peak | kick `at = 2.0`, `seen = 1.88`, velocity 127 | right ankle pitch 0 at t 2.000; 25 degrees at t 1.940 within 0.1 degree; 0 at t 1.879 |
| UT-20-05 | drum limb map | one event per GM key 35-59 | limb per `DRUM_MAP`; keys 54 and 56 alternate hands by arrival parity |
| UT-20-06 | crash goes to the nearest free hand | snare (left) at 1.00 and crash 49 at 1.02 | crash assigned to handR; with no snare, crash 49 assigned to handL |
| UT-20-07 | same-limb merge | snare 38 v80 at 1.000 and 40 v100 at 1.030 | one left-hand strike at 1.000 with velocity 100 |
| UT-20-08 | keys split and position | notes 59 and 60 | 59 on the left hand at x = +0.1148; 60 on the right hand at x = +0.0984 relative to `keys.x`, then the crossing constraint moves the right hand to x <= left - 0.08 |
| UT-20-09 | keys press dip and hold | note 64 v127 at 1.0, atOff 2.0 | dip 0.015 m at t 1.0; 0.0075 m at t 1.5; 0 at t 2.08; with atOff Infinity the release is taken at 61.0 (60 s cap) and the dip is 0 at 61.08 |
| UT-20-10 | chord spread | right-hand groups (60, 64, 67), (60, 72) and (64) | triad spread 1 + 0.1148 / 0.30 = 1.3827 within 1e-4; wide dyad 1.6 (clamped); single note 1.0 |
| UT-20-11 | guitar fret choice and hand position | anchor pitches 40, 47, 64, 88 | (string, fret) = (0,0), (1,2), (5,0), (5,19 capped by top range rule); fret hand distance from the nut equals `fretMid` within 1e-4 |
| UT-20-12 | guitar strum alternation | 4 chord groups (3 notes) 0.5 s apart | strokes alternate down, up, down, up; the hand crosses the string plane exactly at each `at` within 1e-4 m |
| UT-20-13 | vibrato only on long notes | notes of 0.4 s and 1.0 s | no oscillation for the first; oscillation amplitude 0.004 m at 5.5 Hz between at + 0.35 and atOff for the second |
| UT-20-14 | bowing and pizzicato | strings notes of 1.0, 0.1, 1.0 s; program 45 notes of 1.0 s | bow directions +1, (pizz), -1 alternate by note index; short note produces a pluck without bow travel; program 45 never bows |
| UT-20-15 | winds sustain posture and finger offsets | brass note 1.0 s after 0.5 s of silence | chest pitch -3 degrees at mid-note; inhale shoulders +3 degrees during the lead; left wrist y offset for pitch 62 equals -0.0042 m |
| UT-20-16 | synth knob gesture | CC 74 value 127 at 1.0, no right-hand notes | right wrist at the knob by 1.12; roll +45 degrees; back at the keys rest position by 1.52 (knobUntil 1.4 plus the 0.12 s ease); CC 7 produces no motion |
| UT-20-17 | vocal and abstract | vocal note at 1.0; abstract track note at 1.0 | vocal head nod peaks 3 degrees at 1.0 and other joints stay idle; abstract controller returns null; visualizer has a note item from t 1.0 (none at t 0.99) |
| UT-20-18 | stillness during rests (S-17) | each controller, notes in bar 1, then a 4-bar rest at 120 BPM | from 1.0 s after the last release until the next note's lead, `deviation(pose, idlePose) === 0` and `deviation(idlePose(t), base) <= 1 degree`; root offset 0 |
| UT-20-19 | frame-count independence (S-03) | the same 8-bar drum and keys event list; poses sampled at 50 checkpoints with 10 and with 1,000 `update` calls in between | identical poses at every checkpoint (exact equality) |
| UT-20-20 | determinism and per-character variation | two Mixers fed identical events; then characterId changed | identical poses; a different characterId changes only the breathing phase |
| UT-20-21 | arrival order irrelevant | events delivered in reverse order (same `seen` values) | poses equal to in-order delivery; duplicate eventIds ignored |
| UT-20-22 | late arrival shortens anticipation; live dip | note with `seen = at - 0.05`; live note at 1.0 | raise starts at at - 0.05 (A = 0.05); live note contact at 1.030 with hover-to-contact dip only |
| UT-20-23 | pause holds pose, resume continuous | playing, pause at audio 5.0, resume at 9.0 (events after resume shifted by 4.0 s) | pose constant during the pause; animation time at resume equals the frozen value; no deviation jump > 1 degree across resume |
| UT-20-24 | seek eases to idle | sounding chord, `transport.seek` at t | pose reaches idle by t + 0.2 and stored events are empty |
| UT-20-25 | intensity | 8 notes in the last second with v 127; one note v 64 | I = 1.0; I = 0.6 * 64/127 + 0.4 * 1/8 = 0.3524 within 1e-4 |
| UT-20-26 | director plan rules | synthetic 64-bar song: drums dense throughout, a 16-bar keys solo from bar 20, section markers at bars 8 and 40 | plan begins FullBand; first focus is never earlier than bar 4; every gap between cuts >= 4 bars; the keys solo receives a Focus cut; section bars produce FullBand cuts (deferred to satisfy the 4-bar rule); same input -> identical plan |
| UT-20-27 | director enable rules and resync | `cameraMotion:false`; then enabled with a seek to bar 30; then `setUser('Side')` | no cuts when disabled; resync emits the cut in effect with reason 'reset'; user cut emitted immediately with reason 'user' and the plan is suspended |
| UT-20-28 | beat indicator | 4/4 then 3/4 from bar 2; count-in ticks -3840..-1 | beats and bars per 6.20.4.13; count-in beats 0..3 with `countIn:true`; phase 0.5 at the half beat |
| UT-20-29 | visualizer caps and reduced motion | 300 note spawns alive at once on High, Low; reduced motion on | 128 and 48 items (newest kept); reduced motion: y independent of age and no trail items; with no events `items(t)` is empty |
| UT-20-30 | controller failure isolation | a controller stub throwing in `update` | other performers update; failing performer holds its idle pose; `E-REN-010` recorded once |
| UT-20-31 | program change swaps controller | track starts program 0 (keys), `sched.program` 25 at 2.0 | profile 'keys' before 2.0, 'guitar' after; pose at 2.15 is the 50 percent crossfade within 1e-4; 600 events in 1 s keep at most 512 stored |
| UT-20-32 | low tier animated set | 5 performers, Low tier, playerSlot 0 | 3 animated (slot 0 plus the two busiest); others idle; poses updated on every second frame only |
| UT-20-33 | style gain | drum strike with calm, normal, energetic | peak lift ratios 0.7 : 1.0 : 1.3 |

#### 6.20.9 Implementation notes and browser quirks

- The Mixer depends only on `readSched`, so a change of the scheduler's payload names (Part 4.4)
  touches one function. UT-20-03 guards the field names.
- All gesture functions take `t` explicitly; the only state that depends on the frame
  sequence is the reset ease start (`resetFrom`), which is captured at a transport event, not
  per frame.
- `Math.sin` and `Math.cos` results are deterministic within one browser; cross-browser
  determinism is not required for animation (scoring determinism lives in M-09).
- Controllers never call `Rig.setPose`; only the Mixer does, once per animated frame, so
  skipped frames (Low tier) skip all pose work.
- The preview pattern in SCR-Characters uses performance time from the RAF timestamp passed by
  M-21's preview loop; it never creates a Transport or touches audio.

### 6.21 M-21 Stage (`src/21-stage.js`, `FLM.Stage`)

#### 6.21.1 Responsibilities and non-goals

Responsibilities: compose the visible performance for every mode that shows a stage: stage
geometry by detail level and theme; five performer slots and the rule that assigns tracks
and characters to them; instrument props per family built at the prop anchors of
`Animation.layoutFor`; effects (beat light pulses, instrument activity glow, perfect-judgment
sparks) with tier caps; camera presets (FullBand, Focus(slot), Side, Overhead, Player) and
the binding between director cuts, user choice and the camera spring; the note highway for
instrument and dance charts as one `HighwayModel` drawn in a 3D overlay pass in 3D tiers and
by `Flat2D` in the Abstract tier; live application of character edits; the frame update that
ties transport position, animation, effects, camera and drawing together; and disposal of
everything it created.

Non-goals: judgment text, combo, score and every other text is DOM (M-26 HUD); no input
handling (the screen controller tells the highway which lanes are pressed); no scoring (the
highway only displays `judge.result` outcomes); no audio; no character catalog (a resolver
function from M-22 is injected); Stage never writes musical time (S-01).

#### 6.21.2 Public API

```js
FLM.Stage = {
  /** Performer slots in stage space (meters, +Y up, audience at +Z). */
  SLOTS: [ /* 5 rows, 6.21.4.1 */ ],
  /** Prop definitions keyed by prop kind; each lists parts and its layout profile. */
  PROPS: { drumKit, keyboard, guitar, bass, micStand, horn, bowed, mallets, generic },
  PROP_FOR_PROFILE: { keys:'keyboard', synth:'keyboard', guitar:'guitar', bass:'bass', drums:'drumKit',
                      strings:'bowed', winds:'horn', percussion:'mallets', vocal:'micStand', abstract:null },
  CAMERA_PRESETS: ['FullBand', 'Focus', 'Side', 'Overhead', 'Player'],
  THEMES: { default, 'theme-neon', 'theme-club', 'theme-sunset' },   // colors, 6.21.4.2

  /** Pure slot assignment (6.21.4.1).
   *  @param {Track[]} tracks  @param {CharacterConfig[]} characters
   *  @param {{playerTrackId:string|null}} opts
   *  @returns {{performers:[{slot, trackId:string|null, characterId:string|null}], ensemble:string[] /* track ids */}} */
  assignSlots(tracks, characters, opts),

  /** Build the stage. renderer is FLM.Render.renderer() or null (Abstract tier).
   *  @param {Renderer|null} renderer
   *  @param {Array<{slot:number, trackId:string|null, character:CharacterConfig, isPlayer:boolean, peerId?:string}>} performers
   *  @param {{transport, song, owner, tier:string, tierParams, camera:'FullBand'|'Focus'|'Side'|'Overhead'|'Player',
   *           highway:{chart:Chart|DanceChart, kind:'instrument'|'dance', leadMs:number}|null,
   *           calibration:{audioLatencyMs:number, visualLeadMs:number}, settings:object /* 5.11 document */,
   *           resolve:(config:CharacterConfig)=>RigAppearance, theme:string, multiplayer:boolean,
   *           ensemble:string[], playerSlot:number|null, preview:boolean}} opts
   *  @returns {Stage} */
  build(renderer, performers, opts),

  /** Highway class (one instance per stage; also usable alone for tests). */
  Highway
};

// Stage instance
// {
//   addPerformer(p /* as in build */) -> string id,
//   removePerformer(id) -> boolean,
//   setPerformerVisible(id, visible) -> void,       // hidden performers are not drawn; their notes go to the visualizer
//   setCamera(preset, slot /* Focus only */, opts /* {instant:boolean} */) -> void,   // user choice
//   camera() -> {preset, slot, source:'director'|'user'},
//   highway() -> Highway|null,
//   effects() -> {sparksAlive:number, pulse:number, level:number},
//   update(audioNow, dtMs) -> {tick:number, drawn:'3d'|'flat'|'none'},   // the frame (6.21.4.7)
//   resize(layout /* ui.layout payload */, insets /* {bottom, right} CSS px covered by pads */) -> void,
//   setTheme(themeId) -> void,
//   performers() -> [{id, slot, trackId, characterId, profile, prop, visible}],
//   dispose() -> void
// }

// Highway instance
// {
//   setChart(chart, opts /* {kind:'instrument'|'dance', layout:'arrows'|'pads'} */) -> void,
//   setLead(ms /* 600..3000 */) -> void,
//   setLatency(ms /* calibration.audioLatencyMs */) -> void,
//   setPressed(lane, pressed) -> void,               // called by the screen controller from input.event
//   onJudge(result /* judge.result payload */) -> void,
//   setLoop(region /* {a, b, enabled} */) -> void,
//   update(audioNow) -> HighwayModel,                // builds the model for this frame (6.21.4.5)
//   model() -> HighwayModel,                         // last built model
//   rect() -> {x, y, w, h}                           // CSS px region (6.21.4.4)
//   clear() -> void                                  // forget chart and states (pool kept until dispose)
// }

// HighwayModel { kind, glyphSet:'lanes'|'arrows', direction:'down'|'up', leadMs,
//   items: [{type:'lane'|'beat'|'bar'|'loop'|'tail'|'chord'|'note'|'glyph'|'hit'|'receptor'|'spark',
//            lane:number|null, x0, x1 /* lane units 0..4 */, s0, s1 /* 0 hit line .. 1 far end; -0.15..0 past */,
//            state:'pending'|'active'|'hit'|'missed'|'broken'|null, color:'#rrggbb', alpha, glyph:string|null,
//            pressed:boolean}],
//   counts: {notes, tails, chords, dropped} }
```

Events emitted: none (performance outcomes are visual only).

Events consumed (owner = `opts.owner`): `chart.ready` (calls `highway.setChart` when the
payload `chartId` equals the bound chart's id after a regeneration), `judge.result`
(highway states, sparks, receptor flash), `sched.noteOn` (instrument activity glow),
`sched.program` (prop swap, through `Animation.readSched`), `director.cut` (camera when the
source is the director), `render.tier` (LOD and detail rebuild, highway pool size, Flat2D
switch), `render.contextRestored` (with `fallback:true` switch to the Flat2D path),
`settings.changed` (`calibration.visualLeadMs`, `calibration.audioLatencyMs`,
`video.effectsLevel`, `video.cameraPreset`, `video.cameraMotion`, `video.reducedMotion`,
`video.highContrast`, `accessibility.laneGlyphs`, `video.stageTheme`), `transport.loopSet`,
`character.changed` (live appearance), `net.peer` (multiplayer appearance and visibility of
player slots, only when `opts.multiplayer`).

#### 6.21.3 Internal state

- `stage = {renderer, transport, song, owner, tier, params, theme, camera:Camera,
  hwCamera:Camera, cameraState:{preset, slot, source}, performers: Map<id, Perf>, bySlot:
  Perf[5], ensemble: string[], highway, effects, layout, insets, settings snapshot,
  resolve, nodes: {static: Node[], lights: Light[]}, flatActive}`.
- `Perf = {id, slot, trackId, characterId, peerId, character, rig, prop: {kind, nodes},
  profile, visible, glow: {lastAt, velocity}, pendingProp: {at, kind}|null, marker: Node}`.
- Highway: `chart`, `kind`, `noteSec: Float64Array` (song seconds of each note's tick under
  the bound tempo map), `endSec: Float64Array` (hold ends), `states: Uint8Array` per note
  (0 pending, 1 active hold, 2 hit, 3 missed, 4 broken), `tempoMapRef` (identity of the map
  used to compute `noteSec`), `leadMs`, `latencyMs`, `pressed: [4 booleans]`, `flash:
  Float64Array(4)` (animation time of the last receptor flash), `loop`, pool of overlay nodes
  (6.21.4.6), `model`.
- Effects: `sparks` ring of `{bornAt, lane, seed, kind}` (capacity = `particlesCap`), `pulse`.
- Invariants: every node Stage creates is a descendant of `renderer.scene.root` or of
  `renderer.scene.overlay.root` (so `Scene.clear()` reaches it); one prop per performer; at
  most one performer per slot; the highway pool size equals the tier's
  `highwayMaxNotes * 2 + 512`; `noteSec` is recomputed whenever
  `transport.tempoMap()` returns a different object.

#### 6.21.4 Algorithms

6.21.4.1 Slots and assignment

| Slot | Position (x, y, z) | Yaw | Default role |
|---|---|---|---|
| 0 | (0, 0.40, 0.9) | 0 | front center: the player's track in gameplay modes |
| 1 | (+2.4, 0.40, 0.4) | -15 degrees | front, performer's left side of the stage |
| 2 | (-2.4, 0.40, 0.4) | +15 degrees | front, other side |
| 3 | (+2.0, 0.40, -1.5) | -10 degrees | back |
| 4 | (0, 0.70, -2.0) (drum riser) | 0 | drums |

Yaw is a rotation about +Y (positive turns +Z toward +X), so slots at +X turn toward the
center with a negative yaw.

```text
assignSlots(tracks, characters, {playerTrackId}):
  candidates = tracks with kind 'midi' and at least one NoteEvent, sorted by note count desc, ties by track order
  free = [0,1,2,3,4]; out = []
  drums = first candidate with isDrums -> take slot 4
  player = candidate with id playerTrackId (not drums) -> take slot 0
  for each character with instrument (track id) in candidates and slot free and track not yet placed: take character.slot
  for each remaining candidate in order: take the lowest free slot among [0,1,2,3] (slot 4 only for drums,
      unless no drums track exists, then slot 4 is free for any track); stop when no slot is free
  ensemble = candidates not placed (shown by the ensemble visualizer)
  characters: a slot's character is the project character with that slot, else the caller-supplied default
      (M-28 passes the roster band character 'band.<slot>' or FLM.Character.PRESETS[slot])
  return {performers: out sorted by slot, ensemble}
```

A song with no note tracks still gets one idle performer in slot 0 (Free Play and Studio show
the player's instrument there). Tracks of `kind:'audio'` never get a performer (they have no
note events, B 15.5).

6.21.4.2 Stage geometry, detail and themes

| Element | Primitive and placement | Detail levels | Theme color key |
|---|---|---|---|
| floor | plane 40 x 40 at y 0 | all | `floor` |
| platform | box 9.0 x 0.40 x 5.5 centered (0, 0.20, -0.75) (front edge z 2.0) | all | `platform` |
| drum riser | box 2.4 x 0.30 x 2.0 centered (0, 0.55, -2.1) | all | `platform` lightened 10 percent |
| front light strip | box 9.0 x 0.04 x 0.04 at (0, 0.42, 2.0), emissive (pulse) | full, reduced, minimal | `accent` |
| back wall | box 12 x 6 x 0.2 at (0, 3.0, -3.7) | full, reduced | `wall` |
| amps | 2 boxes 0.7 x 0.9 x 0.4 at (+-3.6, 0.85, -2.6) | full, reduced | `#202020` |
| truss | 2 cylinders r 0.08 h 4.5 at (+-4.2, 2.25, -3.2) and one cylinder r 0.08 h 8.4 (axis X) at (0, 4.5, -3.2) | full | `#9aa8b8` |
| spot cans | 4 cylinders r 0.12 h 0.25 on the truss at x -2.4, -0.8, 0.8, 2.4 | full | `#303030` |
| floor lights | 8 (full) or 4 (reduced) cylinders r 0.07 h 0.05 along the front edge, emissive (pulse) | full, reduced | spot colors in order |
| light cones | additive unlit cylinders r 0.6 h 3.8 from each spot can down to the platform, alpha 0.06 | High only | spot colors |
| slot markers | ring (inner 0.45, outer 0.52) at each occupied slot, y = slot y + 0.005, emissive by activity | full, reduced | track color |

Point lights: 4 spots at (0, 4.2, 1.5), (0, 4.4, -2.0), (+2.4, 4.2, 0.8), (-2.4, 4.2, 0.8) with
range 6 m and the theme spot colors; the renderer uses the first `pointLights` of them
(High 4, Balanced 2, Low 0).

Themes (`video.stageTheme`; an id that is not in `THEMES` falls back to `default`; locked
cosmetics are filtered by the caller, Stage only renders what it is given):

| Theme | floor | platform | wall | accent | spot colors |
|---|---|---|---|---|---|
| default | #12161c | #2a2f38 | #151a21 | #ff9f43 | #ff9f43, #4cc3e6, #ff6b6b, #5bd672 |
| theme-neon | #0b0716 | #1d1438 | #120b24 | #ff3ec8 | #ff3ec8, #3ef0ff, #9b5cff, #3eff8b |
| theme-club | #080808 | #222222 | #0b0b0b | #f5c84a | #f5c84a, #ffffff, #ff5c5c, #4cc3e6 |
| theme-sunset | #1a0e12 | #3a2430 | #2a1220 | #ff8a3d | #ff8a3d, #ffd24a, #ff5c8a, #c46bff |

Scene fog: color = theme `floor`, start 12 m, end 40 m; clear color = theme `floor`.

6.21.4.3 Performers and props

`addPerformer(p)`:
1. `profile = p.trackId ? Animation.controllerFor(track) : 'keys'` for the idle Free Play
   performer (Free Play passes the selected program as a pseudo track).
2. `appearance = opts.resolve(p.character)`; `rig = Rig.createRig(appearance, {tierParams,
   seed: fnv1a32(p.character.id)})`; place `rig.root` at the slot position with the slot yaw.
3. `propKind = PROP_FOR_PROFILE[profile]`; `Rig.validateAttachments(rig, propKind)`; on
   failure report `E-REN-009` once, dispose the rig and add the performer to the Mixer with
   `rig:null` (abstract visualizer at the slot).
4. `layout = Animation.layoutFor(profile, rig.lengths)`; build the prop parts (table below) as
   nodes under `rig.root` (world props such as the drum kit, keyboard and mic stand) or under
   attachment nodes (sticks, bow, mallets, generic object, guitar and bass bodies follow the
   `hip` attachment node so they stay attached when the torso moves).
5. Blob shadow node (6.18.4.9) and the slot marker ring; `Animation.Mixer.add({id, slot,
   trackId, program, isDrums, rig, lengths: rig.lengths, characterId, style:
   character.animationStyle, layout})`.

Prop parts (positions relative to the named layout anchor; colors: `track` = the track
color, `wood` #6b4f3a, `metal` #9aa8b8, `brass` #d4b25a, `black` #1c1c1c):

| Prop | Parts |
|---|---|
| keyboard | body box 1.10 x 0.07 x 0.30 at keys + (0, -0.04, 0) black; key bed box 1.00 x 0.012 x 0.14 at keys + (0, 0, -0.06) #eeeeee; black-key band box 1.00 x 0.014 x 0.06 at keys + (0, 0.008, -0.09) black; two stand legs box 0.04 x 0.95 x 0.04 at keys.x +- 0.35, y keys.y / 2, rotated +-25 degrees about Z, metal; knob cylinder r 0.02 h 0.02 at knob track; wheel box 0.03 x 0.05 x 0.06 at wheel metal |
| guitar | body cylinder r 0.18 h 0.08 (axis Z) at bridge + (-0.02, -0.05, 0) track; neck box 0.62 x 0.05 x 0.025 centered at bridge + neckDir * 0.36, oriented `rotationTo(+X, neckDir)`, wood; headstock box 0.16 x 0.07 x 0.02 at nut + neckDir * 0.08 wood |
| bass | as guitar with body r 0.20 and neck length 0.76 |
| drumKit | kick cylinder r 0.28 h 0.40 (axis Z) at (kickPedal.x, 0.30, kickPedal.z + 0.35); snare r 0.18 h 0.14 at snare; toms r 0.14 h 0.16 at tomHigh and tomMid tilted 15 degrees toward the drummer; floor tom r 0.19 h 0.30 at floorTom (base on the riser); hihat two discs r 0.18 h 0.01 at hihat and hihat + (0, 0.02, 0) brass plus stand r 0.012 metal; ride disc r 0.26 h 0.01 at ride brass; crash discs r 0.22 h 0.01 at crash1 and crash2 tilted 12 degrees brass; throne cylinder r 0.18 h 0.06 at (0, 0.50 s, -0.05) black; shells track; sticks: cylinder r 0.008 h 0.40 under each hand attachment, pointing forward along the hand pitch, #e8d8b0 |
| micStand | base cylinder r 0.15 h 0.02 on the floor below mic; pole cylinder r 0.012 from floor to mic.y - 0.05 metal; mic sphere r 0.03 at mic black |
| horn | tube cylinder r 0.04 h 0.40 at horn brass; bell cylinder r 0.09 h 0.05 at horn + (0, -0.22, 0.03) brass; mouthpiece cylinder r 0.01 h 0.08 between horn top and mouthpiece brass |
| bowed | body sphere r 0.12 scaled (1, 0.45, 0.55) at body, oriented along neckDir, #7a3b1f; neck box 0.33 x 0.03 x 0.02 along neckDir black; bow cylinder r 0.005 h 0.65 under the handR attachment along bowAxis wood |
| mallets | bar box 0.90 x 0.06 x 0.30 at bar wood; two legs box 0.04 x bar.y x 0.04 metal; two mallets (cylinder r 0.006 h 0.30 plus sphere r 0.018 head) under the hand attachments |
| generic | box 0.20 x 0.12 x 0.08 under the handR attachment track |

Prop geometry uses `Render.geometry` and is released with the performer. Program change:
`sched.program` for a performer's track whose new profile differs schedules `pendingProp =
{at, kind}`; `update` swaps the prop meshes when the Mixer's animation time reaches `at` (the
Mixer swaps the controller at the same time, 6.20.4.11). Activity glow: each `sched.noteOn`
of the performer's track sets `glow = {lastAt: at, velocity}`; the slot marker and the
prop's track-colored parts get `emissive = 0.45 * (velocity / 127) * exp(-(t - lastAt) / 0.15)`
for `t >= lastAt` (instrument identity and active-note highlighting, I 4.4; nothing glows
before the note sounds or during rests).

Character edits (`character.changed {characterId, rigAffecting, config}`): the performer with
that `characterId` calls `rig.applyConfig(opts.resolve(config))`; when `rigAffecting`, the
attachments are re-validated, the layout is recomputed and passed to the Mixer
(`Animation.Mixer.relayout(id, rig.lengths, layout)`), and the prop nodes are rebuilt at the
new anchors. No other performer, the Transport, the audio graph or the highway is touched (I 8,
E 6.2). Multiplayer (`net.peer` when `opts.multiplayer`): the performer in `payload.slot` takes
`payload.avatar` through the same path and `visible = payload.joined`.

6.21.4.4 Camera presets and highway layout

Camera goals (stage space; `perfs` = visible performers; the stage camera has `fovYDeg 50`,
near 0.1, far 100):

| Preset | Target | Position |
|---|---|---|
| FullBand | `(cx, 1.3, cz - 0.3)` where `cx`, `cz` are the centers of the performer slot bounding box (all slots when none) | `target + (0, 1.6, d)` with `d = max(6.5, (halfWidth + 1.2) / tan(fovX / 2))`, `halfWidth` = half of the bounding box width, `fovX = 2 atan(tan(fovY / 2) * aspect)` |
| Focus(slot) | slot position + (0, 1.2, 0) (drum slot + (0, 1.0, 0)) | `target + R(yaw) (0, 0.3, 2.6)`, distance times 1.25 when the aspect is below 1 |
| Side | (0, 1.2, -0.8) | (7.5, 2.6, 3.0) |
| Overhead | (0, 0.4, -0.6) | (0, 9.0, 3.5) |
| Player | player slot + R(yaw) (0, 1.2, 3.0) | player slot + R(yaw) (0.4, 1.8, -1.4) (behind the player's performer) |

Camera source: when the director is enabled (6.20.4.12) its cuts choose FullBand or
Focus(slot); otherwise the user's `video.cameraPreset` (or `setCamera`) applies. `setCamera`
from the user marks `source:'user'` and calls `director.setUser`. Transitions use
`camera.setGoal(pos, target)` and the spring; `instant:true` when reduced motion is on,
`video.cameraMotion` is false, or on the first frame after build. Camera changes never call the
Transport or the Mixer (P 7.3: camera changes do not reset the song or the animation).

Highway region (CSS px, from `ui.layout` and the pad insets; `W`, `H` the canvas CSS size,
`safe` the safe-area insets):

| Layout | Width | Horizontal position | Top | Bottom |
|---|---|---|---|---|
| desktop (not compact) | `clamp(0.36 W, 360, 560)` | centered | `0.10 H` | `H - insets.bottom - safe.bottom - 8` |
| compact portrait | `W - 24 - safe.left - safe.right` | centered | `0.35 H` | `H - insets.bottom - safe.bottom - 8` |
| compact landscape, pads at the bottom | `min(0.45 W, 480)` | centered | `0.08 H` | `H - insets.bottom - safe.bottom - 8` |
| compact landscape, pads at the right | `min(0.45 W, 480)` | centered in `[safe.left, W - insets.right - safe.right]` | `0.08 H` | `H - safe.bottom - 8` |

The region never overlaps the pads (B 6.4, P 5.2: incoming notes not obscured). The 3D
highway pass uses this region as its viewport (converted to buffer px) with the instrument
camera at position (0, 4.2, 4.0) looking at (0, 0, -3.5), `fovYDeg 45`, so the hit line (z 0)
projects about 12 percent above the region's bottom and the far end (z -10) about 77 percent
up; the dance camera is orthographic (`mat4.ortho` over x -2.2..2.2 and the region aspect),
looking down -Z at the XY plane.

6.21.4.5 Highway model

```text
setChart(chart, {kind}):
  notes = kind == 'dance' ? chart.steps mapped to {id, tick, durTicks, lanes: directions, isHold} : chart.notes
  glyphSet = kind == 'dance' ? 'arrows' : 'lanes'; direction = kind == 'dance' ? 'up' : 'down'
  states = zeros; computeTimes()
computeTimes(): tm = transport.tempoMap(); for each note i: noteSec[i] = tm.ticksToSeconds(tick);
  endSec[i] = isHold ? tm.ticksToSeconds(tick + durTicks) : noteSec[i]; tempoMapRef = tm
update(audioNow):
  if transport.tempoMap() !== tempoMapRef: computeTimes()
  heardTick = transport.positionAt(audioNow - latencyMs / 1000)     // display time includes audio latency (5.12)
  nowSec = tempoMapRef.ticksToSeconds(heardTick); speed = transport.speed(); L = leadMs / 1000
  s(sec) = (sec - nowSec) / speed / L
  i0 = first index with endSec >= nowSec - 0.15 * L * speed (binary search); iterate while s(noteSec[i]) <= 1.0
  for each note in range (at most highwayMaxNotes; when exceeded the farthest are dropped, counts.dropped++):
    st = states[i]
    if st == hit (2): skip (consumed)
    head s0 = s(noteSec[i]); tail s1 = s(endSec[i])
    if isHold: tail item from max(s0, st == active ? 0 : s0) to min(s1, 1), state active, broken or pending
    if lanes.length >= 2 and st == pending: chord item spanning min lane .. max lane + 1 at s0
    if st != active: for each lane: note body (lane color, or #68768a when missed), glyph (when laneGlyphs or highContrast)
    missed notes stay visible until s0 < -0.15, alpha falling linearly from 1 at s0 = 0 to 0.35 at -0.15
  beat and bar lines: ticks of beats between secondsToTicks(nowSec - 0.15 L speed) and secondsToTicks(nowSec + L speed)
    from transport.meterMap() (bar lines 2x thickness)
  loop shading when loop.enabled: from s(a) to s(b) clamped to -0.15..1
  hit line at s 0 and 4 receptors (glyph outline in lane color; filled while pressed; flash alpha
    1 - (t - flash[lane]) / 0.15 after a judged hit, gray flash after a miss)
  sparks (6.21.4.6) appended last
  return model
```

`onJudge(r)`: `holdPhase` or `part` (both payload spellings) `'tail'` -> tail result: non-miss
-> `hit`, miss -> `broken`; head: non-miss -> `hit` for taps and `active` for holds, `miss` ->
`missed`; a `stray:true` result changes no note state and flashes the lane receptor gray. Notes
are matched by `noteId`; an unknown id is ignored. `transport.seek` and `restart` reset every
state to pending (the judge resets too, M-09). Because `s` derives from
`transport.positionAt` and song seconds, a tempo change, a speed change, a pause (frozen
position) or a loop wrap moves the notes exactly with the music; the highway never advances
anything by frame count (S-01). With `audioLatencyMs = 0` a note's head is at `s = 0` at the
audio time its sound is scheduled; with latency it reaches the hit line when the sound is heard.

Lane x mapping in the model: lane `k` spans `x0 = k`, `x1 = k + 1`; note bodies are 0.9 lanes
wide and 0.045 deep in `s` units (scaled to at least 6 CSS px), tails 0.4 lanes wide, chord
connectors 4 px thick behind the heads, glyphs 0.55 lanes square centered on the body.

6.21.4.6 Highway drawing and effects

3D tiers: a pool of overlay nodes (all `base().unitQuad`, unlit material with the atlas
texture, per-node material for color and `uvRect`) created at build with size
`highwayMaxNotes * 2 + 512`; each frame the first `n` nodes receive the model items (position,
scale, color, uvRect, layer by type: lane and beat 0, tail 1, chord 2, note 3, glyph 4,
hit line and receptors 5, sparks 6) and the rest are hidden. Instrument mapping: `x =
(x0 + x1) / 2 - 2`, `z = -s * 10`, quads rotated -90 degrees about X onto the lane plane; dance
mapping: `y = 4 - (1 - s) * 10` with `direction 'up'`, quads facing +Z. The overlay pass renders
with `depthTest:false`, `clearDepth:true`, `cull:false`, layers in order. Lanes are drawn at
alpha 0.18 so the stage stays visible behind; `highwayGlow` adds a second, wider receptor quad at
alpha 0.25 on High and Balanced.

Abstract tier: `Flat2D.drawHighway(model, rect)`; `y = rect.y + rect.h * 0.88 - s * rect.h *
0.85` for `direction 'down'` and mirrored for `'up'`. Both paths draw the same model, so the
highway content is identical across tiers (UT-21-13).

Beat light pulse: `pulse = (beat.isDownbeat ? 1.0 : 0.6) * exp(-4 * beat.phase)` while the
transport state is `countin`, `playing` or `recording`, else 0; `gain` = 0 at `video.effectsLevel
0`, 0.5 at level 1, 1 at level 2, times 0.3 with reduced motion. Front strip and floor lights:
`emissive = 0.3 + 0.7 * pulse * gain`; point light intensity `0.8 + 0.7 * pulse * gain`. The
pulse is a function of the musical position only.

Perfect sparks: on `judge.result` with judgment `perfect` (and `great` at effects level 2, half
count), spawn `count = 12` (perfect) or `6` (great) per lane of the result, halved at effects
level 1, none at level 0 or when `particlesCap` is 0; the ring keeps the newest `particlesCap`
sparks. Spark `k` of a spawn: `seed = fnv1a32(noteId + ':' + lane)`, `prng = new Prng(seed)`,
angle `2 PI (k + prng.next()) / count`, speed `1.5 + prng.next()` lane units per second, born at
the Mixer's animation time of receipt, life 0.4 s, gravity -3 units per s^2 in `s` direction,
size 0.06 lanes, additive, lane color lightened 40 percent, alpha `1 - age / 0.4`. Sparks are
positioned relative to the receptor at `s = 0` and never cover upcoming notes beyond `s = 0.12`.

6.21.4.7 Frame update

```text
update(audioNow, dt):
  tick = transport ? transport.positionAt(audioNow) : 0          // the only musical-time source (S-01)
  Animation.Mixer.update(tick, audioNow, dt)                    // poses, director, visualizer, beat
  t = Animation.Mixer.animTime(); beat = Animation.Mixer.beat()
  apply pendingProp swaps with at <= t; effects.update(beat, transport.state(), t)
  goal = goal for the current camera source; camera.follow(dt)
  hw = highway ? highway.update(audioNow) : null
  if tier != 'Abstract' and renderer and not renderer.lost():
     write visualizer items into the visualizer node pool (unit quads with softDot or ring cells, layer 3)
     renderer.render(renderer.scene, camera, {clearColor:true, clearDepth:true})
     if hw: write hw into the overlay pool; renderer.render(renderer.scene.overlay, hwCamera,
            {viewport: hwRectPx, clearColor:false, clearDepth:true, depthTest:false, cull:false})
     return {tick, drawn:'3d'}
  if tier == 'Abstract':
     Flat2D.begin(theme.floor); Flat2D.drawBand(columns from Mixer.performers(), bandRect)
     Flat2D.drawVisualizer(Mixer.visualizer().items(t), bandRect); hw && Flat2D.drawHighway(hw, hwRect)
     Flat2D.drawBeat(beat, beatRect); Flat2D.end(); return {tick, drawn:'flat'}
  return {tick, drawn:'none'}                                   // context lost: nothing drawn, state still advanced
```

`Stage.update` calls `Animation.Mixer.update` itself; the mode's frame callback (Part 4.7.1 step
9) calls `Stage.update`, `Input.pollGamepad()` and the HUD polling, and does not call the Mixer
separately. `bandRect` is the canvas area outside the highway region (above it in portrait,
both sides in landscape); `beatRect` a 24 px strip at the top of the band area.

6.21.4.8 Tier changes, context restore and disposal

- `render.tier`: rebuild static stage nodes for the new `stageDetail`, call `rig.rebuildLod`
  for every performer, rebuild prop geometry at the new segments, resize the highway pool,
  update `Mixer.setTier`; entering Abstract hides `#view` content (M-18 swaps canvases) and the
  update path switches to Flat2D; leaving Abstract rebuilds everything from the CPU state
  (performers, props, highway chart and states are kept, so nothing about the song changes).
- `render.contextRestored {fallback:false}`: nothing to do (M-18 re-uploaded every mesh);
  `{fallback:true}`: the next update draws through Flat2D.
- `resize(layout, insets)`: recompute the highway region and the camera aspect; called on
  `ui.layout` by the screen controller (orientation changes never pause or reset anything, E 6.2).
- `dispose()`: `Animation.Mixer.dispose()`; for each performer dispose prop nodes and
  `rig.dispose()`; dispose static nodes, lights, marker rings, the visualizer and highway pools;
  `renderer.scene.clear()` (stage and overlay); `bus.removeOwner(owner)` covers the
  subscriptions; `Flat2D.clear()`. Afterwards `scene.count() === 0` and `Render.counters()`
  equal the post-boot baseline (base resources only).

#### 6.21.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Stage build throws (E-REN-011) | try/catch in `build` | transport, audio, judge (built before the stage in 4.7.1) | no | no | toast "3D stage could not be built; showing the simplified view" | `setTier('Abstract','auto')` and a Flat2D-only stage | next mode enter at the stored tier | UT-21-19 |
| Prop attachment missing (E-REN-009) | `validateAttachments` | other performers | after a rig-affecting change | no | none (diagnostics) | abstract visualizer at the slot | rebuild | UT-21-03 |
| Character config invalid in `character.changed` | `opts.resolve` returns normalized data (M-22) | performer keeps the previous appearance on a resolver throw | next change | no | none | previous appearance | next valid change | UT-21-16 |
| Chart with notes beyond the pool | counts.dropped | nearest notes | n/a | no | diagnostics counter | farthest notes not drawn | next frame | UT-21-12 |
| Context lost mid-song | renderer.lost() | everything (state advances) | M-18 restore | no | HUD "Graphics paused" (M-28) | nothing drawn up to 3 s, then Flat2D | restore or fallback | UT-21-18 |
| Unknown theme id | lookup miss | default theme | n/a | no | none | default theme | n/a | UT-21-21 |
| Leaked nodes or GL objects after leave | `assertClean` counters | n/a | n/a | no | E-MODE-001 in diagnostics | none | dispose path | UT-21-17 |

#### 6.21.6 Limits and performance notes

- Nodes per stage: static <= 40 (full detail), performers 5 x (19 joints + <= 43 parts + <= 20
  prop parts), highway pool `highwayMaxNotes * 2 + 512` (High 1,312), visualizer pool equal to
  `visualizerCap`. Draw calls with instancing: about 60 (stage) plus 7 (overlay layers) on High.
- `Highway.update`: O(log n + visible) per frame; `noteSec` recomputation O(n) only when the tempo
  map object changes (tempo override toggles); for a 20,000-note chart <= 5 ms once.
- `Stage.update` CPU budget per frame (excluding GPU): <= 3 ms desktop, <= 6 ms mobile.
- 20 consecutive build and dispose cycles must leave counters and `scene.count()` at the
  baseline (Part 4.6 S-06).

#### 6.21.7 Spec coverage

B 7.5 (view the virtual band performing the arrangement), B 7.6 and B 14.2 (dance step
highway), B 9.1 to 9.3 (visual targets follow the musical timeline; judgments are displayed,
not computed), B 12.1 (stage with camera control, lighting, stage geometry, optional
environmental elements, musicians and instruments, visual effects, performance-reactive
elements; full-band and focused views), B 12.4 (beat-synchronized stage effects, instrument
motifs), B 12.5 (multiple performers; extra tracks visualized without extra humanoids), B 13.4
(remote avatars through `net.peer`), B 22 (non-color lane and direction identification,
high-contrast indicators, adjustable effects), B 26.4, E 2.2 (tempo changes, speed changes,
pause and loop move the highway exactly), E 4.2 (input before the target appears is still
judged; the highway shows the lead), E 6.1, E 6.2 (character customized during playback,
orientation change, repeated scene switches), E 7 (dance highway uses the shared timeline), I
2.3 (clear pressed state, immediate feedback), I 4.3 (camera changes never obscure targets:
separate overlay pass), I 4.4 (active-note highlighting, instrument identity, adjustable camera),
I 7 (distinct dance presentation), I 8 (no scene reload on customization), I 15, P 5.2 (readable
targets, chords and sustains distinguishable, not obscured), P 7.1, P 7.3, P 12 (dance targets
readable), P 14 (stage readable at mobile sizes), P 15, P 21.

#### 6.21.8 Unit tests (group `stage`, file `src/91-test-stage.js`; GL tests skip without a context;
highway model tests use a FakeClock transport and need no GL)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-21-01 | slot table | `SLOTS` | positions and yaws per 6.21.4.1; slot 4 y = 0.70 |
| UT-21-02 | slot assignment | 7 note tracks incl. drums, player track = track 3, one character bound to track 5 in slot 2 | drums slot 4; track 3 slot 0; track 5 slot 2; remaining by note count to slots 1 and 3; 2 tracks in `ensemble`; repeated call identical |
| UT-21-03 | prop requirements align with the rig | every `PROP_FOR_PROFILE` kind | each kind exists in `Rig.ATTACHMENT_REQUIREMENTS`; a rig stub missing 'hip' makes a guitar performer abstract with one `E-REN-009` |
| UT-21-04 | stage detail node counts | build an empty stage at full, reduced, minimal | static node counts 26 (High, full), 11 (reduced), 4 (minimal) per 6.21.4.2; Abstract builds no GL nodes |
| UT-21-05 | FullBand frames every performer | 5 performers, aspect 16:9 and 9:16 | every performer head projects into NDC x and y within [-0.9, 0.9] |
| UT-21-06 | Focus centers the slot | Focus(1) | slot 1 head projects within 0.1 of the NDC center |
| UT-21-07 | camera change leaves time and poses alone | playing FakeClock song; switch presets 5 times | `positionAt` sequence unchanged; Mixer poses equal to a run without switches |
| UT-21-08 | highway crossing time with latency | note at tick 1920 (1.0 s at 120 BPM), anchor at audio 10.0, latency 0 and 80 ms | head `s` = 0 at audio 11.0 (latency 0) and 11.08 (latency 80) within 1e-6 |
| UT-21-09 | lead time scaling | leadMs 1500 then 3000 | a note 0.75 s ahead has s 0.5 then 0.25 |
| UT-21-10 | judged states | tap hit, tap miss, hold head hit then tail miss | hit note absent; missed note gray and visible until s < -0.15; hold tail 'active' then 'broken'; `part` and `holdPhase` spellings both accepted |
| UT-21-11 | chords and glyphs | chord on lanes 0 and 2; `laneGlyphs` true, then false; high contrast on | one chord item spanning x 0..3; glyph items per lane when true; none when false; high contrast forces glyphs |
| UT-21-12 | pool cap drops farthest | 1,000 notes within the lead on Low (cap 200) | 200 note items, the nearest ones; `counts.dropped === 800` |
| UT-21-13 | same model in 3D and Abstract | same FakeClock frame rendered at High then at Abstract | `Highway.update` models deep-equal; Flat2D path draws `model.items.length` shapes |
| UT-21-14 | beat pulse from music position | FakeClock at beat phase 0 and 0.5; paused; effectsLevel 0 | pulse 1.0 at a downbeat phase 0; `exp(-2) * 0.6` at a non-downbeat half beat; 0 when paused; light emissive constant at level 0 |
| UT-21-15 | sparks deterministic and capped | 30 perfect results on Balanced; effects level 1; Low tier | 96 sparks alive (cap); same noteIds produce identical spark positions; level 1 spawns 6 per lane; Low spawns none |
| UT-21-16 | live character edit | playing song, `character.changed` color change then body change for slot 1 | only slot 1 rig changes; other rigs' mesh objects identical; transport state and position unchanged; after body change the prop anchors equal `layoutFor` of the new lengths |
| UT-21-17 | dispose returns to baseline | 20 build and dispose cycles with 5 performers and a highway | after each cycle `scene.count() === 0`, `Render.counters()` equal the baseline, `bus.listenerCount()` equals the baseline |
| UT-21-18 | context loss keeps state advancing | `debugInject('render.contextLoss')` during playback | `update` returns `drawn:'none'` with ticks still advancing; after the fallback `drawn:'flat'` and the highway model continues from the same tick |
| UT-21-19 | build failure falls back | `Rig.createRig` stub throwing | `E-REN-011`; `render.tier` Abstract; the stage still renders the highway through Flat2D |
| UT-21-20 | loop shading | `transport.loopSet {a:1920, b:3840, enabled:true}` | one loop item between s(a) and s(b); none after `enabled:false` |
| UT-21-21 | dance highway and themes | DanceChart with a jump (directions 0 and 3); theme 'theme-neon' then 'nope' | direction 'up', glyphSet 'arrows', chord item for the jump; neon colors applied; unknown id -> default colors |
| UT-21-22 | program change swaps the prop | keys track, `sched.program` 33 at 2.0 | prop kind 'keyboard' until animation time 2.0, 'bass' after; the old prop geometry references released |

#### 6.21.9 Implementation notes and browser quirks

- Lane colors are read once per build from the CSS tokens `--lane-0` to `--lane-3` and
  `--lane-outline` with `getComputedStyle(document.documentElement)`; `video.highContrast`
  changes re-read them (the class on `body` changes the token values, Part 3.2.2).
- The highway region is computed in CSS px and converted to buffer px with the same scale
  factor M-18 used for the canvas (`buffer / css`), so the overlay viewport matches the DOM pads
  exactly at every resolution scale.
- `Flat2D` and the overlay pass share `HighwayModel`; any visual rule (alpha of missed notes,
  glyph policy) lives once in `Highway.update`, never in a drawer.
- Free Play and Studio build the stage without a highway (`opts.highway === null`); the
  customization screen builds a one-performer stage with `opts.preview:true` (no transport, the
  Mixer preview pattern drives the rig, camera Focus(0) with a slow orbit of 8 degrees per second
  disabled under reduced motion).
- The pad insets are supplied by the screen controller from `UI.TouchPads.layout()`; when pads
  are hidden (desktop) the insets are 0.

### 6.22 M-22 Character (`src/22-character.js`, `FLM.Character`)

#### 6.22.1 Responsibilities and non-goals

Responsibilities: the `CharacterConfig` schema of Part 5.10 as code (create, validate,
normalize, version and migrate); the options catalog (every option with id, label,
category, rig-affecting flag and parameters) and the color palettes; the incompatible
combination rules; the registry of the 8 named presets (data shipped in M-30) and preset
application; seeded randomization within supported combinations; canonical serialization,
character file export and import (`.flmchar.json`); the multiplayer payload (<= 4 KB); the
split between rig-affecting and visual-only fields and the `diff` that tells the stage what to
rebuild; resolution of a config into the `RigAppearance` M-19 renders; the edit entry point
that emits `character.changed` for live preview without a scene reload; the user roster in
`flm.v1.characters` (band appearance per slot, the player's avatar, user presets); and the
project command that stores characters in the current project.

Non-goals: no rendering and no rig math (M-19); no editor UI (SCR-Characters in M-27); no
cosmetic unlock logic (M-25 decides which alternate colors and themes are offered; M-22 only
renders `x.accAlt` when present); no network transport (M-24 calls `forNet` and `validate`).

#### 6.22.2 Public API

```js
FLM.Character = {
  VERSION: 1,
  MAX_NET_BYTES: 4096,
  MAX_FILE_BYTES: 65536,
  CATEGORIES: [ /* {id, label} x 9: body Body, height Height, skin Skin, hair Hair, face Face,
                  top Top, bottom Bottom, shoes Shoes, accessory Accessories */ ],
  /** The options catalog (6.22.3): 44 frozen CatalogOption entries (shape in Part 5.10). */
  OPTIONS: [ /* CatalogOption */ ],
  PALETTES: { skin: { skin1: '#f6d7c3', /* ... 8 */ }, hair: [ /* 8 */ ], clothing: [ /* 12 */ ] },
  ACCESSORY_COLORS: { hat: {base, alt}, glasses: {base, alt}, headphones: {base, alt}, scarf: {base, alt}, wristband: {base, alt} },
  RULES: [ /* {id, when, effect, phase:'normalize'|'render'} x 5, 6.22.4.3 */ ],
  /** Registered presets (CharacterPreset of 5.10); M-30 registers the 8 built-in ones at load. */
  PRESETS: [ /* filled by registerPresets */ ],

  /** Registers built-in presets. Each entry is normalized; an invalid entry is skipped with
   *  W-CHR-PRESET-SKIPPED. Duplicate presetIds replace earlier ones. @returns {number} registered */
  registerPresets(list /* CharacterPreset[] */),
  /** New config with the defaults of Part 5.10. @returns {CharacterConfig} */
  create(opts /* {name?, slot?, instrument?, presetId?} */),
  /** Strict check, no mutation. @returns {{ok:boolean, errors:CharIssue[], warnings:CharIssue[]}} */
  validate(config),
  /** Repairing check (6.22.4.2). Never throws. @returns {{config:CharacterConfig, warnings:CharIssue[]}} */
  normalize(config, opts /* {slotHint?:number} */),
  /** v1 is the only version; newer -> {ok:false, error:'E-IMP-013'}. Never mutates the input. */
  migrate(doc) /* -> {ok:boolean, doc:object|null, error:string|null} */,
  /** Deterministic random appearance; keeps id, name, slot, instrument of base. */
  randomize(seed /* uint32 */, base /* CharacterConfig|null */) /* -> CharacterConfig */,
  /** Copies the preset's appearance into config, keeping id, slot, instrument. */
  applyPreset(config, presetId) /* -> {config, ok:boolean} */,
  /** Field-level differences. @returns {Array<{path:string, from:any, to:any, rigAffecting:boolean}>} */
  diff(a, b),
  isRigAffecting(path /* 'body'|'heightScale'|... */) /* -> boolean */,
  /** Apply one edit, normalize, emit character.changed (coalesced, 6.22.4.6).
   *  @returns {{config:CharacterConfig, warnings:CharIssue[], rigAffecting:boolean}} */
  edit(config, path, value),
  /** Resolve palette ids and render rules into the appearance M-19 draws. */
  resolve(config) /* -> RigAppearance */,
  /** rig.applyConfig(resolve(config)). @returns the applyConfig result */
  applyTo(rig, config),

  serialize(config) /* -> string canonical JSON (key order of 5.5 character definition) */,
  deserialize(textOrObject) /* -> {ok, config:CharacterConfig|null, warnings, error:string|null} */,
  exportPreset(config, presetId /* optional */) /* -> {fileName:string, text:string} */,
  importPreset(text) /* -> {ok, preset:CharacterPreset|null, warnings, error:string|null} */,
  /** Multiplayer payload: schema fields only, x reduced to {accAlt}. */
  forNet(config) /* -> {ok:boolean, config:CharacterConfig|null, bytes:number, error:string|null} */,

  // ---- roster (flm.v1.characters through FLM.Storage.get and set) ----
  loadRoster() /* -> Roster */,
  saveRoster(roster) /* -> {ok:boolean, error:object|null} */,
  /** Band character for a slot when the project has none (roster 'band.<slot>' or default preset). */
  bandCharacter(roster, slot) /* -> CharacterConfig */,
  playerCharacter(roster) /* -> CharacterConfig (roster 'player') */,

  /** Project command (Command shape of 6.15.2) that inserts or replaces a character by id;
   *  a slot already used by another character is swapped with the edited character's old slot. */
  projectCommand(project, config) /* -> Command */
};

// CharIssue { code:'W-CHR-...'|'E-CHR-...'|'E-IMP-013', path:string, message:string }
// Roster { version:1, presets:CharacterPreset[] /* user presets, <= 10 */, band:CharacterConfig[5], player:CharacterConfig }
```

Events emitted: `character.changed {characterId, option, rigAffecting, config}` from `edit`
(and from `applyPreset`/`randomize` when called through `edit(config, '*', newConfig)`).
Events consumed: none.

#### 6.22.3 Internal state

The options catalog (frozen; `rigAffecting` is true only for `body.*` and `height`; labels are
ASCII and at most 24 characters):

| Category | Option ids | Labels | Params |
|---|---|---|---|
| body | `body.slim`, `body.average`, `body.broad` | Slim, Average, Broad | `{widths: Rig.BODY[...]}` (by reference to the M-19 table) |
| height | `height` | Height | `{min:0.9, max:1.1, step:0.01}` |
| skin | `skin.skin1` .. `skin.skin8` | Tone 1 .. Tone 8 | `{color: PALETTES.skin[id]}` |
| hair | `hair.style.none`, `.short`, `.medium`, `.long`, `.curly`, `.mohawk`; `hair.color` | None, Short, Medium, Long, Curly, Mohawk; Hair color | style options `{style}`; color `{palette: PALETTES.hair}` |
| face | `face.face1` .. `face.face4` | Round eyes, Bold brows, Calm smile, Classic | `{face}` (geometry in 6.19.4.4) |
| top | `top.style.tee`, `.shirt`, `.hoodie`, `.jacket`, `.tank`, `.dress`; `top.color` | T-shirt, Shirt, Hoodie, Jacket, Tank top, Dress; Top color | `{style}`; `{palette: PALETTES.clothing}` |
| bottom | `bottom.style.jeans`, `.shorts`, `.skirt`, `.none`; `bottom.color` | Jeans, Shorts, Skirt, None (with dress); Bottom color | `{style}` (`none` has `{requires:'top.style.dress'}`); `{palette: PALETTES.clothing}` |
| shoes | `shoes.style.sneakers`, `.boots`, `.bare`; `shoes.color` | Sneakers, Boots, Barefoot; Shoe color | `{style}`; `{palette: PALETTES.clothing}` |
| accessory | `acc.hat`, `acc.glasses`, `acc.headphones`, `acc.scarf`, `acc.wristband` | Hat, Glasses, Headphones, Scarf, Wristband | `{attach, excludes, base, alt}`: hat `{attach:'head', excludes:['acc.headphones']}`, headphones `{attach:'head', excludes:['acc.hat']}`, glasses `{attach:'mouth'}`, scarf `{attach:'chest'}`, wristband `{attach:'handR'}` |

Palettes:

| Palette | Values |
|---|---|
| skin | skin1 #f6d7c3, skin2 #eac0a0, skin3 #d6a07a, skin4 #c08a5e, skin5 #a06a45, skin6 #7f5236, skin7 #5e3b26, skin8 #3f2719 |
| hair | #1b1410, #2b1d14, #5a3a22, #a8743f, #d9b46a, #b0452a, #c9c9c9, #3a6ea5 |
| clothing | #f2f2f2, #1c1c1c, #3a6ea5, #2d3a4a, #7a1f2b, #c0392b, #e67e22, #f1c40f, #27ae60, #16a085, #8e44ad, #6b4f3a |
| accessory base / alt | hat #222831 / #c0392b; glasses #111111 / #f1c40f; headphones #e0e0e0 / #3a6ea5; scarf #c0392b / #27ae60; wristband #f1c40f / #8e44ad |

Colors are stored as lowercase `#rrggbb`; validation accepts any such value (multiplayer peers
and older files may carry colors outside the palettes), while the editor and `randomize` only
offer palette values. The alternate accessory colors correspond to the cosmetics
`acc-color-<accessory>` of Part 5.13; a config uses them through `x.accAlt` (array of
accessory ids), which the editor writes only for unlocked cosmetics.

Built-in presets (data in `src/30-content.js` as `CHARACTER_PRESETS`, registered at load;
values normative here; every color is a palette value):

| presetId | Name | body | height | skin | hair (style, color) | face | top | bottom | shoes | accessories | style |
|---|---|---|---|---|---|---|---|---|---|---|---|
| nova | Nova | average | 1.00 | skin3 | long, #2b1d14 | face2 | tee #3a6ea5 | jeans #2d3a4a | sneakers #f2f2f2 | none | normal |
| rex | Rex | broad | 1.05 | skin6 | short, #1b1410 | face4 | tank #1c1c1c | jeans #2d3a4a | boots #6b4f3a | wristband | energetic |
| juno | Juno | slim | 0.96 | skin2 | curly, #b0452a | face1 | dress #8e44ad | none #2d3a4a | sneakers #1c1c1c | glasses | calm |
| kai | Kai | average | 1.02 | skin5 | mohawk, #3a6ea5 | face3 | jacket #1c1c1c | jeans #2d3a4a | boots #1c1c1c | scarf | energetic |
| mira | Mira | slim | 0.98 | skin4 | medium, #5a3a22 | face2 | hoodie #27ae60 | skirt #2d3a4a | sneakers #f2f2f2 | headphones | normal |
| otis | Otis | broad | 1.08 | skin7 | none, #1b1410 | face4 | shirt #f2f2f2 | jeans #1c1c1c | boots #6b4f3a | hat | calm |
| pip | Pip | slim | 0.92 | skin1 | short, #d9b46a | face1 | tee #e67e22 | shorts #16a085 | sneakers #c0392b | wristband | energetic |
| zuri | Zuri | average | 1.00 | skin8 | long, #1b1410 | face3 | shirt #7a1f2b | skirt #1c1c1c | sneakers #f2f2f2 | glasses, scarf | normal |

Default band (when neither the project nor the roster defines a slot): slot 0 nova, 1 kai, 2
mira, 3 juno, 4 rex; default player character: nova. If M-30 failed to register presets
(`PRESETS.length === 0`), `create()` defaults are used for every slot.

Module state: `presets: Map<presetId, CharacterPreset>`; `emitState: Map<characterId,
{lastAt, pending, timer}>` for coalescing; `CHAR_OWNER` symbol for coalescing timers (part of
the boot baseline; a pending timer fires within 33 ms and clears itself).

Invariants: every config returned by `create`, `normalize`, `randomize`, `applyPreset`,
`edit`, `deserialize` passes `validate`; `OPTIONS`, `PALETTES`, `ACCESSORY_COLORS`, `RULES` and
every registered preset are deep-frozen (S-07); `serialize(normalize(c).config)` is stable
(byte-identical for equal configs).

#### 6.22.4 Algorithms

6.22.4.1 `validate(config)` (strict; error codes)

| Check | Code |
|---|---|
| not a plain object | `E-CHR-002` |
| `version` missing | warning `W-CHR-NO-VERSION` (treated as 1) |
| `version` > 1 | `E-IMP-013` "This character file needs a newer version of Finger Lickin Music." |
| `id` not matching `^[A-Za-z0-9_.:-]{1,64}$` | `E-CHR-010` |
| `name` not a string of 1-24 chars after trimming, or containing code points below 0x20 | `E-CHR-011` |
| `body`, `skin`, `face`, `animationStyle`, `hair.style`, `top.style`, `bottom.style`, `shoes.style` outside the catalog | `E-CHR-012` with the path |
| `heightScale` not finite or outside 0.9-1.1 | `E-CHR-013` |
| any color not matching `^#[0-9a-f]{6}$` (case-insensitive) | `E-CHR-014` with the path |
| `accessories` not an array, more than 5, duplicates or unknown ids | `E-CHR-015` |
| `hat` and `headphones` together | `E-CHR-016` |
| `bottom.style === 'none'` while `top.style !== 'dress'` | `E-CHR-017` |
| `slot` not an integer 0-4 | `E-CHR-018` |
| `instrument` neither null nor an id string | `E-CHR-019` |
| unknown top-level fields (anything but the schema fields and `x`) | warning `W-CHR-UNKNOWN-FIELD` |
| `x` serialized larger than 1,024 bytes | warning `W-CHR-X-LARGE` |
| `serialize(config)` UTF-8 length > 4,096 bytes | `E-CHR-003` |

`ok` is true when no `E-` issue exists.

6.22.4.2 `normalize(config, {slotHint})`

1. Not an object -> start from `create({slot: slotHint})` with `W-CHR-NORMALIZED` on path `''`.
2. Copy only schema fields and `x`; unknown fields are dropped with `W-CHR-UNKNOWN-FIELD`.
3. `id` invalid -> `uid('chr')`; `name`: remove code points below 0x20, trim, truncate to 24;
   empty -> `"Performer " + (slot + 1)`.
4. Enums outside the catalog -> the 5.10 default of that field; `heightScale` -> clamp to
   0.9-1.1 and round to 0.01 (`NaN` -> 1.0); colors -> lowercase, invalid -> the field
   default; `slot` -> integer clamp 0-4, invalid -> `slotHint` or 0; `instrument` invalid ->
   null; `animationStyle` invalid -> `normal`; `version` -> 1.
5. Accessories: keep strings in the catalog, drop duplicates (first occurrence wins), apply
   rule R2 (6.22.4.3), truncate to 5.
6. Rule R4: `bottom.style === 'none'` and `top.style !== 'dress'` -> `bottom.style =
   'shorts'`.
7. `x`: kept when a plain object whose serialization is <= 1,024 bytes, else dropped with
   `W-CHR-X-LARGE`; `x.accAlt` filtered to ids present in `accessories`.
8. Every repair adds one `W-CHR-NORMALIZED` warning with its path (P 19: invalid settings are
   normalized predictably). `normalize` is idempotent: `normalize(normalize(c).config)` returns
   an equal config and no warnings.

6.22.4.3 Incompatible combination rules (`RULES`)

| Id | When | Effect | Phase |
|---|---|---|---|
| R1 | `hat` with hair `long`, `medium`, `mohawk` or `curly` | hair rendered as `short` under the hat (stored style kept) | render (`resolve`) |
| R2 | `hat` and `headphones` both present | the one later in the `accessories` array is kept, the earlier removed (`W-CHR-EXCLUSIVE`) | normalize |
| R3 | top `dress` | bottom rendered as `none` (stored bottom kept, so switching back restores it) | render |
| R4 | bottom `none` without top `dress` | stored as `shorts` | normalize |
| R5 | `headphones` with hair `mohawk` or `curly` | hair rendered as `short` (the band would cut through the hair) | render |

R1 and R5 make accessories not intersect the head geometry (P 8). The editor shows a one-line
note under the hair options when R1 or R5 is active: "Hidden under the hat" or "Flattened by
the headphones" (text owned by Part 7).

6.22.4.4 `resolve(config)` and `applyTo(rig, config)`

```text
resolve(c):
  n = normalize(c).config
  hair = n.hair.style
  if n.accessories includes 'hat' and hair in (long, medium, mohawk, curly): hair = 'short'      // R1
  if n.accessories includes 'headphones' and hair in (mohawk, curly): hair = 'short'           // R5
  bottomStyle = n.top.style == 'dress' ? 'none' : n.bottom.style                               // R3
  return { body: n.body, heightScale: n.heightScale, skinColor: PALETTES.skin[n.skin], hairStyle: hair,
           hairColor: n.hair.color, face: n.face, top: n.top, bottom: {style: bottomStyle, color: n.bottom.color},
           shoes: n.shoes,
           accessories: n.accessories.map(id => ({id, color: (n.x && n.x.accAlt || []).includes(id)
                                                  ? ACCESSORY_COLORS[id].alt : ACCESSORY_COLORS[id].base})),
           animationStyle: n.animationStyle }
applyTo(rig, c) = rig.applyConfig(resolve(c))
```

`resolve` is pure; the Stage receives it as the `opts.resolve` callback (M-21 cannot reference
M-22, Part 4.2), and SCR-Characters uses `applyTo` on its preview rig.

6.22.4.5 `randomize(seed, base)`

```text
p = new Prng(seed)
c = base ? normalize(base).config : create()
c.body = pick(p, ['slim','average','broad']); c.heightScale = round2(0.90 + p.int(21) * 0.01)
c.skin = 'skin' + (1 + p.int(8))
c.hair = {style: pick(p, HAIR_STYLES), color: pick(p, PALETTES.hair)}
c.face = 'face' + (1 + p.int(4))
c.top = {style: pick(p, TOP_STYLES), color: pick(p, PALETTES.clothing)}
c.bottom = {style: c.top.style == 'dress' ? c.bottom.style : pick(p, ['jeans','shorts','skirt']),
            color: pick(p, PALETTES.clothing)}
c.shoes = {style: pick(p, ['sneakers','boots','bare']), color: pick(p, PALETTES.clothing)}
k = p.int(3); acc = p.shuffle(['hat','glasses','headphones','scarf','wristband'].slice()).slice(0, k)
c.accessories = acc (rule R2 applied by normalize)
c.animationStyle = pick(p, ['calm','normal','energetic'])
c.x = base && base.x ? {...base.x, accAlt: []} : undefined
return normalize(c).config        // id, name, slot, instrument, version kept from base
```

`pick(p, arr) = arr[p.int(arr.length)]`. The draw order above is normative so that a seed
always produces the same character (the daily challenge and tests rely on it). A dress top
keeps the base bottom so R4 never fires on randomized output (a `none` bottom only occurs with
a dress).

6.22.4.6 `edit(config, path, value)` and coalescing

1. `path === '*'`: `value` is a complete config (preset or randomize result); otherwise set the
   field at `path` (`'hair.style'`, `'top.color'`, `'accessories'`, `'x.accAlt'`, ...) on a copy.
2. `next = normalize(copy).config`; `changes = diff(config, next)`; if empty return `{config:
   next, warnings, rigAffecting:false}` without an event.
3. `rigAffecting = changes.some(c => c.rigAffecting)`.
4. Emit `character.changed {characterId: next.id, option: path, rigAffecting, config: next}`
   immediately when the previous emit for that character was >= 33 ms ago; otherwise store
   it as pending and emit the latest pending payload when 33 ms have passed since the previous
   emit (one `Core.timers.setTimeout` with `CHAR_OWNER`), so slider drags produce at most 30
   events per second and the final value is always delivered. A pending rig-affecting change
   keeps `rigAffecting:true` even if a later coalesced change is visual only.
5. Return `{config: next, warnings, rigAffecting}`. The caller (SCR-Characters) stores the
   result: in the project through `projectCommand` (undoable), or in the roster through
   `saveRoster`.

6.22.4.7 Serialization, files and network payload

- `serialize(c)`: `JSON.stringify` of an object built in the key order `id, name, body,
  heightScale, skin, hair{style, color}, face, top{style, color}, bottom{style, color},
  shoes{style, color}, accessories, instrument, slot, animationStyle, version` and then `x` when
  present; no whitespace.
- `deserialize(input)`: string -> `JSON.parse` in try/catch (`E-CHR-001` "This is not a valid
  character file."); `migrate`; `normalize`; then the 4,096-byte check: if exceeded, drop `x`
  (`W-CHR-X-DROPPED`) and re-check; still exceeded -> `E-CHR-003`.
- `exportPreset(c, presetId)`: `{format:'flm-character', version:1, presetId: presetId ||
  'user-' + fnv1a32Hex(c.name + '|' + c.id), builtIn:false, character: c without id, slot and
  instrument}` serialized with 1-space indentation; `fileName = sanitize(c.name) +
  '.flmchar.json'` (Part 5.14 sanitizing); the caller downloads it with `Storage.download`.
- `importPreset(text)`: length > 65,536 -> `E-CHR-001` "This character file is too large.";
  parse; `format !== 'flm-character'` -> `E-CHR-001`; `version > 1` -> `E-IMP-013`; the
  character is normalized with a new `id`, `slot` 0 and `instrument` null; `builtIn` forced to
  false; returns the preset (the caller adds it to the roster).
- `forNet(c)`: `n = normalize(c).config`; copy schema fields; `x` reduced to `{accAlt}` when
  non-empty; `bytes = UTF-8 length of serialize(copy)`; above 4,096 drop `x` and recompute;
  still above -> `{ok:false, error:'E-CHR-003'}`. The largest valid config (24-character name,
  64-character id, four accessories, every color set) serializes to about 420 bytes, so the cap
  only guards malformed input (E 8.3 oversized avatar). Receivers run `validate` and then
  `normalize` before use (M-24).

6.22.4.8 Roster persistence

```text
loadRoster():
  doc = Storage.get('characters', null)          // key flm.v1.characters (Part 5.15)
  presets = doc && Array.isArray(doc.presets) ? doc.presets : []
  band[s] for s in 0..4: the preset with presetId 'band.' + s -> config with id 'chr_band' + s, slot s, instrument null;
         missing -> the default band preset of slot s (applyPreset on create({slot:s}))
  player: preset 'player' -> config id 'chr_player', slot 0; missing -> nova
  user presets: every other preset (at most 10 kept, newest first by array order)
  every character is normalized; a damaged document yields the defaults and W-CHR-ROSTER-RESET
saveRoster(r):
  doc = {version:1, presets: [band.0..band.4, player, ...r.presets.slice(0, 10)]} with builtIn:false
  text size must be <= 64 KB (it is about 5 KB at the maximum)
  result = Storage.set('characters', doc)        // safe write with read-back (6.16.4 A)
  return {ok: result.ok, error: result.error}       // never reports success on failure (E 11)
```

The roster supplies characters whenever no project is open or the project has no character
for a slot (Quick Play on built-in songs, Dance, Multiplayer avatar), which satisfies B 13.4
restoration on reopen; project characters are saved inside the project document (Part 5.5).

6.22.4.9 `projectCommand(project, config)`

Returns a Command (6.15.2 shape) with `type:'setCharacter'`, `label:'Edit character'`,
`coalesceKey: 'chr:' + config.id`, `params: {config}`. `apply(project)`: `undoData =
deepClone(project.characters)`; if another character occupies `config.slot`, it moves to the
edited character's previous slot (or the lowest free slot for a new character); replace the
entry with the same id or append; when 5 characters exist and the id is new, apply returns
`{ok:false, error:{code:'E-CHR-020', message:'A project can have at most 5 characters.'}}` and
changes nothing; on success the result is `changed:['characters']`. `revert(project)`: `project.characters =
undoData`. Coalescing merges slider drags within 500 ms into one undo entry (M-15 rule).

#### 6.22.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Invalid config from a project, file or peer | `validate` / `normalize` | the normalized config; the original document is not modified | n/a | no (repairs are reported) | `W-CHR-NORMALIZED` warnings listed in the import or load report | defaults for the bad fields | normalized config | UT-22-04 |
| Character file not JSON, wrong format or too large (E-CHR-001) | parse, format and size checks | roster and project untouched | user picks another file | no | dialog text "This is not a valid character file." or "This character file is too large." | none | n/a | UT-22-12 |
| Newer character version (E-IMP-013) | `version > 1` | as above | n/a | no | "This character file needs a newer version of Finger Lickin Music." | none | n/a | UT-22-12 |
| Oversized network avatar (E-CHR-003) | byte count | local config | n/a | no | peer receives `error E-NET-...` from M-24; local toast none | remote shown with a default character | default preset | UT-22-13 |
| Roster save fails (quota, storage unavailable) | `Storage.set` result | in-memory roster; previous stored roster intact (safe write) | next save | the latest edit only | toast "Character changes could not be saved. Export the character to keep it." with Export | memory-only roster | next successful save | UT-22-16 |
| Roster document damaged | parse or shape failure in `Storage.get` | defaults | n/a | old roster lost (the `.bak` is not kept for this key, Part 6.16) | toast "Saved characters were reset" (W-CHR-ROSTER-RESET) | defaults | defaults | UT-22-16 |
| Preset registration receives invalid data | `normalize` warnings or invalid shape | other presets | n/a | no | diagnostics (`W-CHR-PRESET-SKIPPED`) | fewer presets | n/a | UT-22-08 |
| Project already has 5 characters (E-CHR-020) | command apply | project unchanged | n/a | no | toast with the message | none | n/a | UT-22-18 |

#### 6.22.6 Limits and performance notes

- At most 5 characters per project, 10 user presets plus 6 reserved roster entries, 8 built-in
  presets. A config serializes to under 0.5 KB; the roster document to under 8 KB.
- `normalize` and `resolve` run in well under 0.1 ms; `edit` is called at most 30 times per
  second from the editor (coalescing), each followed by a rig update in M-21 (<= 2 ms visual,
  <= 8 ms rig-affecting, 6.19.4.5).
- No DOM, no GL; the module is fully testable without a context.

#### 6.22.7 Spec coverage

B 13.1 (body, skin, hair style and color, facial features, clothing, accessories, instrument
assignment, stage position, animation style, presets), B 13.2 (options as configuration data),
B 13.3 (rig-affecting versus visual-only fields; `isRigAffecting`, `diff`), B 13.4
(persistence in the project and the roster; multiplayer appearance within the payload limit),
B 15.6 (downloading character presets with a schema and a round trip), E 6.1 and E 6.2
(customization changes proportions and happens during playback without breaking the rig), E
8.3 (oversized avatar payloads rejected), E 11, I 8 (presets, body choices, color and
material customization, hair and clothing, accessories, instrument and stage position, saved
presets, preview, compatibility checks; no scene reload), I 9.3 (cosmetic alternate colors are
visual only), I 16.4 (versioned character data), P 8 (every option has a visible effect,
presets load, randomization stays within supported combinations, immediate preview,
persistence, rig compatibility, no intersecting accessories, invalid combinations handled,
multiplayer avatars within limits, no reload), P 19 (invalid data normalized predictably).

#### 6.22.8 Unit tests (group `character`, file `src/91-test-character.js`; no GL needed except
UT-22-07's rig check, which uses the CPU-only rig of 6.20.8)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-22-01 | catalog completeness | `OPTIONS` | 44 entries; ids unique; `rigAffecting` true exactly for the 3 body options and `height`; every label ASCII and <= 24 chars |
| UT-22-02 | create defaults | `create()` | equals the Part 5.10 defaults field by field; `validate` ok; `serialize` length < 512 |
| UT-22-03 | validate error codes | one config per row of 6.22.4.1 | each yields exactly the listed code at the listed path; a valid config yields none |
| UT-22-04 | normalize repairs and is idempotent | config with name of 40 chars plus a tab, heightScale 1.3, skin 'skin9', color '#FFF', 7 accessories | name 24 chars without control chars; 1.1; 'skin3'; color default; accessories trimmed and deduped; second normalize returns equal config and no warnings |
| UT-22-05 | hat and headphones exclusive | accessories ['hat', 'glasses', 'headphones'] | normalized to ['glasses', 'headphones'] with `W-CHR-EXCLUSIVE` |
| UT-22-06 | bottom and dress rules | bottom none with tee; dress with jeans | first stored as shorts; second keeps jeans stored, `resolve` gives bottom style 'none' |
| UT-22-07 | resolve render rules and colors | hat with long hair; headphones with mohawk; accAlt ['scarf'] with scarf | effective hair 'short' in both; skin color from the palette; scarf color #27ae60; applying to a rig builds the short cap |
| UT-22-08 | presets registered and valid | after M-30 load (test build) | 8 presets with the ids and names of 6.22.3; each validates; every color is a palette value; registering an invalid entry skips it with `W-CHR-PRESET-SKIPPED` |
| UT-22-09 | applyPreset keeps identity | config id 'chr_x', slot 3, instrument 't2'; apply 'rex' | appearance equals rex; id, slot, instrument unchanged |
| UT-22-10 | randomize deterministic and valid | seeds 1..1,000 | same seed twice -> identical config; all 1,000 validate; more than 950 distinct serializations; no config has both hat and headphones; no `none` bottom without a dress |
| UT-22-11 | serialize round trip | 50 random configs | `deserialize(serialize(c)).config` deep-equals c and re-serializes byte-identically; key order as specified |
| UT-22-12 | file errors | text 'not json'; format 'other'; version 2; 70 KB text | `E-CHR-001`, `E-CHR-001`, `E-IMP-013`, `E-CHR-001` (too large); nothing thrown |
| UT-22-13 | network payload limit | largest valid config; config with a 10 KB `x` | first `bytes <= 4096` and `x` absent unless accAlt; second drops `x` and stays ok; a forged object over the limit after dropping `x` returns `E-CHR-003` |
| UT-22-14 | diff and rig-affecting split | change body, then top color, then accessories | diff paths ['body'] rigAffecting true; ['top.color'] false; ['accessories'] false; `isRigAffecting('heightScale') === true` |
| UT-22-15 | edit emits and coalesces | 10 heightScale edits within 50 ms (FakeClock timers) | at most 2 `character.changed` events, the last carrying the final value with `rigAffecting:true`; a no-op edit emits nothing |
| UT-22-16 | roster load, save and failure | empty storage; then save; then `Storage.set` failing; then damaged document | defaults nova, kai, mira, juno, rex and player nova; saved document has presetIds band.0..band.4 and player; failing save returns ok false without throwing; damaged document -> defaults with `W-CHR-ROSTER-RESET` |
| UT-22-17 | preset file round trip | `exportPreset` then `importPreset` | file name ends with `.flmchar.json`; imported appearance equal; new id; slot 0; instrument null; builtIn false |
| UT-22-18 | project command | project with characters in slots 0 and 1; set a new character to slot 1; undo; add a sixth character | slot swap applied (old slot-1 character moves to the new one's slot); revert restores the array; sixth returns `E-CHR-020` with the project unchanged |
| UT-22-19 | frozen tables | `OPTIONS`, `PALETTES`, `ACCESSORY_COLORS`, `RULES`, `PRESETS` entries | deep-frozen |
| UT-22-20 | x extension handling | `x` of 2 KB; `x.accAlt` with an id not worn | `x` dropped with `W-CHR-X-LARGE`; accAlt filtered to worn accessories |

#### 6.22.9 Implementation notes and browser quirks

- UTF-8 byte length is computed with `new TextEncoder().encode(text).length` (available in every
  target browser); names are ASCII in the catalog but user names may contain any Unicode, which
  is allowed in data (only source files are ASCII).
- `uid('chr')` and `fnv1a32Hex` come from M-01; preset ids of user presets are derived
  deterministically so exporting the same character twice produces the same `presetId`.
- `edit` is the only function with a side effect (the event); every other function is pure and
  safe to call from tests, the network validator and the import path.
- The `Rig.BODY` reference in the body options keeps one source of truth for widths; the
  catalog test asserts the reference identity.
