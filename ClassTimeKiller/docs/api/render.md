# Renderer API (S07)

Files: `src/07a-render.js` (core, post, context loss, settings), `07b-render-world.js` (static world, sky), `07c-render-actors.js` (instanced shapes, actors), `07d-render-fx.js` (`Fx`), `07e-render-view.js` (camera, view model, quality control), `07f-render-hud.js` (`HudBatch`). Data: `src/03b-data-render.js`. Tests: `src/20b-test-render.js` (group `render`).

When `Game.headless` is true at boot, or WebGL2 is missing, nothing is created: every hook below stays a cheap no-op (`Fx.*` return at once when `Game.headless`). Missing WebGL2 or a shader that fails to build shows the PLT-002 fatal screen ("WebGL2 is required").

## Hooks for later sections

| Hook | Contract |
|---|---|
| `Render.addSource(name, fn(batch))` | Called once per rendered frame. Push shapes with `batch.mesh(shape, x, y, z, yaw, pitch, sx, sy, sz, r, g, b, emissive)`. `shape`: `box sphere cylinder capsule cone wedge ring` (unknown names are ignored). `(x, y, z)` is the centre, `sx sy sz` the full size in metres along the shape's local axes, angles in radians (yaw 0 looks +Z; positive pitch tips the local +Z axis up; local +Y tips forward with pitch -PI/2), `r g b` 0..1, `emissive` 0..1 (self-lit). Cylinder, cone, capsule and ring are built around their local Y axis. A wedge rises toward local +Z. A source that throws is logged once and switched off. Capacity: 1024 instances per shape per frame (extra ones are dropped and counted in `Render.stats.droppedInstances`). |
| `Render.actorStyle = fn(id, out)` | Called per drawn actor. `out = { r, g, b, emissive, scale, visible }` arrives filled with the default look (team colour, else the profile `color`, else a palette colour by id; `visible` is false while `ACTOR_FLAG.INVISIBLE` is set). Change fields in place (powerup glow, cloak, giant mode). |
| `Render.camera` | `{ x, y, z, yaw, pitch, roll, fov }`. Each frame it follows `Game.playerId`: interpolated feet + smoothed `Actors.eye` (+ optional head bob), angles = `Actors.aimYaw / aimPitch` (the freshest input). `fov` = setting `video.fov` divided by the aim zoom. |
| `Render.cameraOverride = fn(camera)` | Return `true` after placing the camera (spectate, killcam, menu fly-by). While it returns true the local player's body is drawn and the view model is hidden. `roll` is applied. |
| `Render.viewModel = fn(out)` | Filled by S11. `out = { visible, shape, kick, reload, swap, ads, color, zoom }` is reset every frame to `{ false, 'rifle', 0, 0, 0, 0, '#4a5058', 1.15 }`. `shape` = weapon class (`sidearm shotgun rifle smg lmg dmr sniper rail launcher energy heavy melee tool exotic power`, unknown = rifle). `kick`, `reload`, `swap`, `ads` are 0..1 animation amounts (kick 1 = full recoil this frame; reload 0 -> 1 over the reload; swap 1 = fully lowered). `color` = weapon body colour. `zoom` = FOV divisor at full `ads` (sniper scopes: e.g. 4). |
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

Budget: 8192 HUD quads per frame (extra quads are dropped and counted in `HudBatch.dropped`). Text quads are one per visible glyph; a full ring is 48 quads.

## Frame pipeline (internal registries, usable by S07 files)

`Render.addUpdate(order, fn(seconds, alpha))` runs before drawing; `Render.addPass(order, fn(gl))` draws into the scene target; `Render.addFinish(fn(gl))` runs after the canvas holds the frame; `Render.addGpuPart(name, fn(gl))` creates GPU objects at init and again after a context restore; `Render.defineProgram(name, vertex, fragment, attributes)` (throws past 8 programs, REN-003).

Updates: -1 benchmark, 0 camera + view-model read, 2 dynamic resolution, 3 auto step-down, 5 fog, 30 actors + blob shadows, 40 sources, 50 lights + particle count, 60 view model. Passes: 10 sky, 20 world, 30 shapes (props, actors, outline shells), 40 blob shadows, 50 decals + particles + tracers, 70 view model (after a depth clear, own FOV). Then the post pass (MSAA resolve, upscale, vignette, FXAA) and, in the Loop `hud` phase, the HUD layers.

Programs (6 of 8): `world`, `shapes` (props, actors, view model, outlines, blob shadows), `particles` (particles, tracers, decals), `sky`, `post`, `hud`.

## Map data read by the renderer

- `map.theme`: a `CAT.themes` id (`foundry ruins station canal overgrowth glacier`), default the first row. Sets the material palette, sky, sun, ambient and fog.
- `map.lights` (optional): `[{ pos: [x, y, z], color: '#rrggbb', radius: 8, intensity: 1 }]`, baked into the world's vertex light with a shadow ray.
- Brush `material`: a `CAT.materials` id (unknown = concrete). Every convex brush is drawn from its planes (box, ramp, and any later convex shape S08 builds planes for).

On `world.load` the renderer builds the static mesh from `World.brushes`: faces cut on a world-aligned 2-6 m grid, faces covered by another brush culled, coplanar overlaps kept once, vertex light = hemisphere ambient x baked AO + sun (shadow ray via `World.raycast`) + map lights, merged into one buffer with one draw range per 16 m chunk (frustum-culled; the material is a per-vertex index into a uniform table). A coarse 4 m sun-visibility grid shades moving objects. On `match.stop` the mesh is freed.

## Data catalogues (src/03b-data-render.js)

`materials` (pattern, scale, colours, emissive, shine), `themes` (sky, fog, sun, ambient, palette overrides), `teamColors`, `fxKinds`, `decalKinds`, `actorParts` (rigid-part humanoid: pivot, offset, size, hold, aim, swing, tint, far-LOD flag), `viewModels` (parts per weapon class; `axis: 'z'` turns a part's Y axis forward).

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

## Quality control

- Dynamic resolution (PERF-007): scale steps of 0.05 inside the preset's `renderScaleMin..Max`; lowers after 0.5 s over budget, raises after 2 s under 80% (GPU timer: 6 ms budget). Without `EXT_disjoint_timer_query_webgl2` the frame interval is compared with the 60 fps floor, and a drop right after a raise doubles the wait before the next raise (up to 16 s).
- First-run benchmark (PERF-008): when `video.autoQuality` is empty, the menu draws a 3 s stress scene, syncs each frame with a 1-pixel read and maps the median frame cost to a preset (<= 3 ms ultra, 5 high, 8 medium, 13 low, else potato); emits `toast`.
- Step-down (PERF-013): while playing, under 60 fps for 5 s lowers one preset (`video.autoQuality` when quality is `auto`, else `video.quality`) and emits `toast`.
- Context loss (PLT-005): `Game.pause('graphics')`, `toast` "Graphics restoring...", everything rebuilt from CPU copies on restore, then `Game.resume()` and a `toast`.

## Events

Consumes `boot`, `setting` (`video.*`), `world.load`, `match.stop`. Emits `toast` `{ text }` (benchmark result, step-down, context loss / restore).

## Stats

`Render.stats` = `{ drawCalls, triangles, renderMs, gpuMs, renderScale, particles, instances, droppedInstances }`, copied every frame into `Perf.counters` (`drawCalls triangles renderMs gpuMs renderScale particles`; the HUD phase adds its draw calls and `hudMs`). `Render.gpuMemoryBytes()` estimates GPU memory (PERF-005).

## Debug

`__CTK.renderDemo(themeId, weaponClass)` (test file) loads a sample arena with 8 actors, effects, a player view model and a HUD layer, draws a frame and returns frame stats. `__CTK.renderState()` returns `{ render, worldMesh, hud }`.
