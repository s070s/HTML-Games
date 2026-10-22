# Renderer API (S07)

Files: `src/07a-render.js` (core, post, context loss, settings), `07b-render-world.js` (static world, sky), `07c-render-actors.js` (instanced shapes, actors), `07d-render-fx.js` (`Fx`), `07e-render-view.js` (camera, view model, quality control), `07f-render-hud.js` (`HudBatch`). Data: `src/03b-data-render.js`. Tests: `src/20b-test-render.js` (group `render`).

When `Game.headless` is true at boot, or WebGL2 is missing, nothing is created: every hook below stays a cheap no-op (`Fx.*` return at once when `Game.headless`). Missing WebGL2, a shader that fails to build, or a rebuild that fails after a context restore shows the PLT-002 fatal screen ("WebGL2 is required").

S07 never calls `World` (S08 is a later section): the static world arrives through the `Render.worldQuery` hook, and every ray the renderer needs (baked sun shadows, map lights, the blob-shadow ground probe) runs against its own brush grid built at bake time.

## Hooks for later sections

| Hook | Contract |
|---|---|
| `Render.worldQuery` | **S08 sets it to `World`** (one line in `08a-world.js`). The renderer reads only `Render.worldQuery.brushes` (convex brushes `{ material, minX..maxZ, planes, planeCount }`) on `world.load`. While it is `null` the world mesh is empty. |
| `boxVisible(minX, minY, minZ, maxX, maxY, maxZ)` / `boundsVisible(box)` | frustum test of an axis-aligned box; `boundsVisible` reads `minX..maxZ` from an object (world chunks: no float arguments, PERF-006) |
| `Render.addSource(name, fn(batch))` | Called once per rendered frame. Push shapes with `batch.mesh(shape, x, y, z, yaw, pitch, sx, sy, sz, r, g, b, emissive)`. `shape`: `box sphere cylinder capsule cone wedge ring` (unknown names are ignored). `(x, y, z)` is the centre, `sx sy sz` the full size in metres along the shape's local axes, angles in radians (yaw 0 looks +Z; positive pitch tips the local +Z axis up; local +Y tips forward with pitch -PI/2), `r g b` 0..1, `emissive` 0..1 (self-lit). Cylinder, cone, capsule and ring are built around their local Y axis. A wedge rises toward local +Z. A source that throws is logged once and switched off. Capacity: 1024 instances per shape per frame (extra ones are dropped and counted in `Render.stats.droppedInstances`). `mesh` returns the instance's float offset in `batch.data`, or -1 when the shape is unknown or the region is full. Zero-allocation form for hot callers (PERF-006: float arguments to a call that is not inlined are boxed on the heap): `o = batch.reserve(shape)` (offset or -1), write `batch.data[o..o+11]` = `x y z yaw sx sy sz pitch r g b emissive`, then `batch.light(o)`. Or keep one `instance = makeShapeInstance()` record (`x y z yaw pitch sx sy sz r g b emissive`), fill its fields and call `batch.meshFrom(shape, instance)` (same result and return value as `mesh`). Test doubles of `batch` that a source may receive should offer `meshFrom` too. |
| `Render.addActorStyle(fn(id, out))`, `Render.actorStyle` | Called per drawn actor: every `addActorStyle` function in load order, then the single `actorStyle` override (tests, debug). `out = { r, g, b, emissive, scale, visible }` arrives filled with the default look (team colour, else the profile `color`, else a palette colour by id; `visible` is false while `ACTOR_FLAG.INVISIBLE` is set). Change fields in place (powerup glow, cloak, giant mode). |
| `Render.camera` | `{ x, y, z, yaw, pitch, roll, fov }`. Each frame it follows `Game.playerId`: interpolated feet + smoothed `Actors.eye` (+ optional head bob), angles = `Actors.aimYaw / aimPitch` (the freshest input). `fov` = setting `video.fov` divided by the aim zoom. |
| `Render.cameraOverride = fn(camera)` | Return `true` after placing the camera (spectate, killcam, menu fly-by). While it returns true the local player's body is drawn and the view model is hidden. `roll` is applied. |
| `Render.viewModel = fn(out)` | Filled by S11. `out = { visible, shape, kick, reload, swap, ads, color, zoom, recoilPitch, recoilYaw, dual }` is reset every frame to `{ false, 'rifle', 0, 0, 0, 0, '#4a5058', 1.15, 0, 0, false }`. `recoilPitch` / `recoilYaw` = recoil punch in degrees (positive pitch = up), added to the camera's aim angles (view kick); `dual` draws a mirrored second gun in the left hand. `shape` = weapon class (`sidearm shotgun rifle smg lmg dmr sniper rail launcher energy heavy melee tool exotic power`, unknown = rifle). `kick`, `reload`, `swap`, `ads` are 0..1 animation amounts (kick 1 = full recoil this frame; reload 0 -> 1 over the reload; swap 1 = fully lowered). `color` = weapon body colour. `zoom` = FOV divisor at full `ads` (sniper scopes: e.g. 4). |
| `Fx.burst(kind, x, y, z, nx, ny, nz, count, colorHex)` | Particles from a point along the normal. `kind`: a `CAT.fxKinds` id (`spark smoke dust blood muzzle explosion energy water fire frost shock heal`, unknown = spark). `count <= 0` uses the kind's default. `colorHex` (`'#rrggbb'` or `0xrrggbb`) overrides the kind colour; omit or pass `null` to keep it. Pool size = quality `particles` (oldest reused). |
| `Fx.tracer(ax, ay, az, bx, by, bz, colorHex)` | A glowing streak from A to B for 0.09 s. |
| `Fx.decal(x, y, z, nx, ny, nz, kind)` | A mark on a surface. `kind`: a `CAT.decalKinds` id (`bullet scorch blood energy frost paint`). Ring buffer of quality `decals` (Potato 0 = none). |
| `Fx.light(x, y, z, colorHex, radius, seconds)` | A fading point light. 8 slots; the quality row's `lights` (8/4/2/0/0) are applied per frame. |
| `Fx.clear()` | Empties every pool (also on `match.stop`). |
| `HudBatch.addLayer(name, order, fn(hud, seconds))` / `removeLayer(name)` | S17 registers HUD layers; lower `order` draws first. Each layer is one draw call. A throwing layer is logged once and switched off. |
| `HudBatch.rect(x, y, w, h, colorHex, alpha)` | Filled rectangle. Coordinates are CSS pixels from the top-left; `hud.width` / `hud.height` give the screen size. |
| `HudBatch.text(string, x, y, sizePx, colorHex, align, alpha)` | `y` is the middle of the line; `align` `'left' | 'center' | 'right'`. Returns the width. `HudBatch.measure(string, sizePx)` returns the width without drawing. System font, ASCII plus `° × • – — … ← ↑ → ↓ ★ ♥ ▲ ▼ ●`. |
| `HudBatch.ring(x, y, radius, thickness, colorHex, alpha, start, end)` | Ring or arc; angles in radians, 0 = 12 o'clock, clockwise; omit start/end for a full ring. |
| `HudBatch.line(x1, y1, x2, y2, thickness, colorHex, alpha)` | A straight line. |

Budget: 8192 HUD quads per frame (extra quads are dropped and counted in `HudBatch.dropped`). Zero-allocation quad (07f, PERF-006): `setHudCorners(x0, y0, x1, y1, x2, y2, x3, y3)` then `pushHudSolid(colorHex, alpha)` (or fill `hudCorners[8..11]` with a texture rectangle and call `pushHudCorners`); `pushHudQuad(14 arguments)` is the older argument form, kept for callers off the hot path. Text quads are one per visible glyph; a full ring is 48 quads.
- Actor style fields (`Render.addActorStyle(fn(id, out))`): `r g b emissive scale headScale visible`. `headScale` (default 1) grows the parts drawn around the head pivot (`head`, `visor`) about that pivot; 13h multiplies it by `Hitbox.headScale` (X14 Big Head).
- Darkness (`rules.fx.darkness`, X37): `applyTheme` dims sun and ambient light to 5 %, fog and sky go near black, the fog is full at 22 m, the light bake uses no map lights, and the visible living actors nearest the camera carry a flashlight each (3 m ahead along the view, 11 m radius). `updateFlashlights` (07d, render update 55, after `updateLights`) picks them without allocating (`Flashlights.ids/count`) and writes them straight into `Render.frame` lights after the effect lights, never through `Fx.light` slots: one light per actor, no stacking, no fading. They fill the tier's `lights` (at least 1, so the player in the dark is lit even on Low and Potato); muzzle flashes and explosions keep up to 2 of those lights.

## Frame pipeline (internal registries, usable by S07 files)

`Render.addUpdate(order, fn(seconds, alpha))` runs before drawing; `Render.addPass(order, fn(gl))` draws into the scene target; `Render.addFinish(fn(gl))` runs after the canvas holds the frame; `Render.addGpuPart(name, fn(gl))` creates GPU objects at init and again after a context restore; `Render.defineProgram(name, vertex, fragment, attributes)` (throws past 8 programs, REN-003).

Updates: -1 benchmark, 0 camera + view-model read, 2 dynamic resolution, 3 auto step-down, 5 fog, 6 sun shadow matrix, 30 actors + blob shadows, 40 sources, 50 lights + live particle counts, 60 view model. Passes: 10 sky, 15 instance upload + sun shadow map (High/Ultra) + its texture binding, 20 world, 30 shapes (props, actors, outline shells), 40 blob shadows, 50 decals + particles + tracers, 70 view model (after a depth clear, own FOV). Then the post pass (MSAA resolve, upscale, vignette, FXAA) and, in the Loop `hud` phase, the HUD layers.

Programs (7 of 8): `world`, `shapes` (props, actors, view model, outlines, blob shadows), `shadow` (depth-only sun shadow casters), `particles` (particles, tracers, decals), `sky`, `post`, `hud`. Texture unit 1 is reserved for the sun shadow map.

## Map data read by the renderer

- `map.theme`: a `CAT.themes` id (`foundry ruins station canal overgrowth glacier`), default the first row. Sets the material palette, sky, sun, ambient and fog.
- `map.lights` (optional): `[{ pos: [x, y, z], color: '#rrggbb', radius: 8, intensity: 1 }]`, baked into the world's vertex light with a shadow ray.
- Brush `material`: a `CAT.materials` id (unknown = concrete). Every convex brush is drawn from its planes (box, ramp, and any later convex shape S08 builds planes for).

On `world.load` the renderer builds the static mesh from `Render.worldQuery.brushes`: faces cut on a world-aligned 2-6 m grid, then each cell piece is split exactly by the planes of every brush overlapping it (only the parts no brush covers are kept, so off-grid walls leave no holes; coplanar overlaps are drawn once, by the lower brush index; faces touching face to face are dropped). Vertex light = hemisphere ambient x baked AO + sun (shadow ray) + map lights, with rays walked through the renderer's 8 m brush grid. Everything is merged into one buffer with one draw range per 16 m chunk (frustum-culled; the material is a per-vertex index into a uniform table). Chunks are packed in row order (z, then x), and visible chunks that touch in the index buffer are drawn as one range, so the 300 m island on Potato draws 29 calls a frame in all instead of 93 (PERF-004; `WorldMesh.indexBytes` gives the index size). A coarse 4 m sun-visibility grid shades moving objects. A 200 m map with 400 brushes bakes in about 0.1 s on a desktop CPU. On `match.stop` the mesh is freed.

## Data catalogues (src/03b-data-render.js)

`materials` (pattern, scale, colours, emissive, shine), `themes` (sky, fog, sun, ambient, palette overrides), `teamColors`, `fxKinds`, `decalKinds`, `actorParts` (rigid-part humanoid: pivot, offset, size, hold, aim, swing, tint, `far` = kept in the far LOD, `distant` = kept past `lodFar`), `viewModels` (parts per weapon class; `axis: 'z'` turns a part's Y axis forward).

## Actors, LODs and shadows

- LODs by the quality row: closer than `lodNear` all 10 parts, animated every frame; up to `lodFar` the 6 `far` parts, walk cycle re-posed every 4th frame; up to `viewDistance` the 4 `distant` parts as a still silhouette; beyond that nothing.
- Shadows: presets with `shadows: 'sun'` (High, Ultra) render one 1024 x 1024 sun shadow map (48 m square ahead of the camera, texel-snapped) from props and actors; the world and shape shaders sample it, static geometry keeps its baked shadows. Actors inside the map lose their blob shadow; the local player always keeps one (MIS-037). Other presets bind a 1 x 1 map and use blob shadows only.
- Particles and decals take the same distance fog as the world (glows fade out in fog). A pool whose particles are all dead is not drawn; the triangle counter counts live particles.

## Settings

| Key | Default | Notes |
|---|---|---|
| `video.renderScale` | `'auto'` | `'auto'` = dynamic resolution within the preset's range, or a fixed 0.4-1.0 |
| `video.fov` | 90 (80 on touch) | horizontal FOV at 16:9 (Hor+), 60-120 |
| `video.viewmodelFov` | 70 | 50-100 |
| `video.fxaa` | true | only where the preset has `post` (off on Low/Potato) |
| `video.outlines` | true | backface outline shell on actors |
| `video.headBob` | false | |
| `video.maxDpr` | 1.5 | device-pixel-ratio cap, 1-3 |
| `video.autoLower` | true | PERF-013 step-down |
| `video.autoQuality` (S04) | `''` | written by the first-run benchmark |
| `video.frameCap` (S19) | 0 | Off / 30 (battery saver) / 60 / 90 / 120, paced from rAF timestamps with carried-over credit (60 on 144 Hz averages 60). S19 copies the interval to `Render.config.frameCapMs`: a capped frame counts as on time for dynamic resolution and the step-down, and the menu does not measure the display rate while capped |

## Quality control

- Dynamic resolution (PERF-007): scale steps of 0.05 inside the preset's `renderScaleMin..Max`; lowers after 0.5 s over budget, raises after 2 s under 80% (GPU timer: 6 ms budget). Without `EXT_disjoint_timer_query_webgl2` the smoothed frame interval (time constant 0.1 s, the same response at any refresh rate) is compared with `slowFrameMs()` = 1.08 x the 60 fps floor, or the display's own interval when it is slower (`DisplayRate.intervalMs`: a 30 or 50 Hz display is not lowered for frames no setting could make faster; a vsync-locked frame shows no headroom). The display interval is measured from 120 menu frames that the display paced: uncapped, no benchmark, the previous frame drew at most 256 triangles (no world: the map editor draws a whole map in the `menu` state) and its CPU work took under half its interval; the lower quartile of the samples is taken and kept only when it lies within 4% of a standard refresh rate (24 25 30 48 50 60 72 75 90 100 120 144 165 240 Hz), else the last value stays. So a slow editor map, a busy CPU or a GPU-bound menu never raises the budget and never switches off the scale drop or the step-down for the next match. The step-down uses the same limit. A drop within 3 s of a raise makes the scale it dropped to a ceiling: raising above it is retried only after 30 s, and each failed retry doubles that wait (no cap), so a GPU-bound phone settles instead of stuttering. A new preset or screen size forgets the ceiling.
- First-run benchmark (PERF-008): when `video.autoQuality` is empty, the menu draws a 3 s stress scene, syncs each frame with a 1-pixel read and maps the median frame cost to a preset (<= 3 ms ultra, 5 high, 8 medium, 13 low, else potato); emits `toast`.
- Step-down (PERF-013): while playing, under 60 fps for 5 s lowers one preset (`video.autoQuality` when quality is `auto`, else `video.quality`) and emits `toast`. The slow time is held back only while a lower render scale can still help: automatic scale above the preset's minimum and either no GPU timer or the GPU timer over its budget. A CPU-bound device (GPU timer within budget) steps down even at full scale.
- Context loss (PLT-005): `Game.pause('graphics')`, `toast` "Graphics restoring...", everything rebuilt from CPU copies on restore, then `Game.resume()` and a `toast`. If the rebuild throws, the PLT-002 fatal screen is shown instead of a frozen, paused frame.

## Events

Consumes `boot`, `setting` (`video.*`), `world.load`, `match.stop`. Emits `toast` `{ text }` (benchmark result, step-down, context loss / restore).

## Stats

`Render.stats` = `{ drawCalls, triangles, renderMs, gpuMs, renderScale, particles, instances, droppedInstances }`, copied every frame into `Perf.counters` (`drawCalls triangles renderMs gpuMs renderScale particles`; the HUD phase adds its draw calls and `hudMs`). `Render.gpuMemoryBytes()` estimates GPU memory (PERF-005; tested under 64 MB on High and 32 MB on Potato).

## Debug

`__CTK.renderDemo(themeId, weaponClass, qualityId)` (test file) fills `Render.worldQuery` if it is empty, loads a sample arena with 8 actors, effects, a player view model and a HUD layer, draws a frame and returns frame stats. `__CTK.renderState()` returns `{ render, worldMesh, hud }`.
