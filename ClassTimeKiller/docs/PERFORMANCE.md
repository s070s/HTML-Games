# ClassTimeKiller - Performance

Status: results of the plan phase 18 pass (steps 18.1-18.6) against `docs/SPECIFICATION.md` §3 PERF and §23 REN. Re-run `tools/perf.mjs` after any change to a hot path and update the tables here in the same change.

## 1. Tools

| Tool | What it does |
|---|---|
| `node tools/perf.mjs` | Headless Chrome (`tools/cdp.mjs`, shared with `tools/selftest.mjs`, no dependencies). Boot time at 1x / 4x / 6x CPU throttling, then every scene x preset x throttle rate. `--help` lists the options: `--scenes`, `--presets`, `--throttle`, `--seconds`, `--warmup`, `--alloc` / `--retained` / `--promoted` (top allocation sites), `--profile` (CPU self time), `--reaction` (dynamic resolution and step-down), `--bench` (sim cost per step from back-to-back steps, see 2.3), `--soak <minutes>` (heap after a forced GC every minute, step 18.4), `--json <file>`, `--file <html>` (another build, for before/after). Exit 0 even on a budget miss (the misses are printed). |
| `node tools/selftest.mjs --group perf` | Exact-number checks that hold on a busy machine: frame-cap pacing, the single rAF callback, boot time wiring, display-rate budget (editor, CPU-bound and GPU-bound menu frames are not taken as the display rate), time-based smoothing, the zero-allocation call forms against their argument forms, allocation probes of hot paths (heap bytes over 20 000 calls of `Hitbox.rayOf`, `Collide.gatherAround` + `sweepSegment`, `HudBatch.line`, `emitActorPart`; `performance.memory` is exact because `tools/selftest.mjs` starts Chrome with `--enable-precise-memory-info`), the PERF-009 / PERF-010 caps of every preset (catalogue rows, flooded particle / decal / light pools, bot and enemy caps, a 16-bot match on Potato), one brush-tree walk per actor step, pool and batch caps, the TDM perf scene end to end. |
| `node tools/build.mjs` | Size guard (D07): warns above 3.0 MB, fails above 3.5 MB. Release build now: 2.98 MB. Fails on `Math.hypot` in the per-frame / per-step files (07*, 08b, 08d, 10a, 11a, 11b, 14a-14d). |
| `__CTK.perf` (page) | `scenes()`, `scene(name, qualityId, { autoLower })`, `record(seconds)` (a Promise of the report), `report()` (last report), `info()`, `stop()`, `stats()` (frame ring, `loopStartMs`, `bootMs`), `simBench(steps, rounds)`, `hotPaths()` (the allocation probes). The recorder's sample arrays (about 1 MB) are made on the first `record()`. |

Per run `perf.mjs` prints: frame interval p50/p95/p99; frame CPU mean, `@120` (see 2.3) and p50/p95/p99; sim ms per 120 Hz step (mean, p95) and the PERF-002 groups (movement = `move bodies`, AI = `botThink pveBrains nav`, projectiles = `weapons projectiles weaponSpecials`, rules = `rules mutators pve pveBoss operationTickets`, from `Sim.timingTotal`); render and HUD CPU ms (mean, p50, p95); draw calls and instances (p95); render scale; minor / major GC count and longest pause (trace events); allocation rate (sampling heap profiler); heap after forced GCs and its growth over the run.

## 2. Scenes, presets, reading the numbers

### 2.1 Scenes (`PERF_SCENES` in `src/20b-test-perf.js`)

| Scene | Content |
|---|---|
| `tdm` | Harbor, 16 bots, every bot with an ability and gadget kit (meters kept full), a powerup for every bot every 8 s (10.8 worst case). |
| `horde` | First saved horde map, 3 bots, PvE enemies refilled to `Pve.cap()` every second. |
| `royale` | Ring Isle, 18 actors. |
| `generated` | GN5 large dense island (seed 4242, generated in full), 16 bots (GN5 large is medium+ only in menus; the scene passes `uncapped`). |
| `editor` | Arena template filled to 400 boxes (MAP-014), map editor open, camera turning. |

Match scenes start at Ultra and then switch to the measured preset, so the requested bot count survives the PERF-009 cap (Potato 7, Low 11). The camera and HUD follow a living bot, so the full view, view model and HUD are drawn. `video.autoLower` is off in budget runs (on in the reaction run).

### 2.2 Presets and throttling

Presets measured: Potato, Low, Medium. CDP `Emulation.setCPUThrottlingRate` 4x and 6x stand in for low-end phones; the host is an i5-9600K (6 cores, shared with other jobs: see 2.3).

### 2.3 How to read the numbers

- **Means, not percentiles, under throttling.** Chrome throttles by suspending the main thread in slices, so a frame that meets a slice grows by the whole slice: p95/p99 show the slices, the mean is the honest per-frame cost. Budgets are checked on means.
- **Throttled cost grows more than the rate.** At 4x the measured sim cost is 4-7x the 1x cost (the slices also land inside measured spans). The 1x numbers times the rate are the lower bound, the 4x numbers the upper bound.
- **Frame CPU @120.** PERF-002 budgets a 120 fps frame (one sim step). Headless frames run at about 30 fps (below), so a raw frame carries about 4 sim steps; `@120` = frame CPU without its steps plus one step.
- **Headless WebGL is software (SwiftShader).** It runs at about 30 ms a frame at 1280 x 800 whatever the scene, so the frame interval, dynamic resolution (always at the preset minimum) and render CPU spikes say nothing about a real GPU; the render and HUD p50 are the useful numbers. GPU time cannot be measured headless.
- **In-frame sim cost against back-to-back steps (`--bench`).** The recorder measures sim steps where they run, about 4 per frame between render work; `--bench` runs 4 rounds of 480 steps (4 s of game time) back to back inside one call, still throttled, and keeps the fastest round per system. Each round is long enough to meet its share of throttle slices (bench at 4x is 4-6x the bench at 1x), but it misses the slices and GC pauses that land between frames, and its caches stay warm. Even at 1x the in-frame cost is 2-3x the bench cost (0.49 against 0.21 ms per TDM step on a quiet machine). Real devices interleave steps with rendering too, so the in-frame numbers are the conservative ones; both are reported.
- **Shared machine.** These runs share the CPU with other test jobs (load up to 100%), which moves timings by up to 2x between runs. The allocation rate and GC counts are the stable numbers; for timings compare before/after runs made back to back (3.2).

## 3. Results

### 3.1 Boot (navigation start to the main menu's first drawn frame, `Perf.bootMs`, median of 3)

`Perf.bootMs` is stamped at the end of the first drawn frame: parse and boot of the whole file, the main menu built (`ready`) and the first frame with its shader compiles. `Perf.loopStartMs` keeps the loop start.

| Throttle | First menu frame | Loop start |
|---|---|---|
| 1x | 365 ms | 362 ms |
| 4x | 633 ms | 615 ms |
| 6x | 937 ms | 914 ms |

The menu build and the first frame add about 20 ms. Under the 2 s Potato load checkpoint at 6x, so no boot work was deferred.

### 3.2 Before / after of the first pass (TDM, Low, 10 s, back to back on the same machine)

Before = the build before this pass (commit 4948af7 plus the perf scene file); after = this pass.

| | Before 1x | After 1x | Before 4x | After 4x |
|---|---|---|---|---|
| Sim ms per step (mean) | 0.52 | 0.44 | 4.73 | 1.85 |
| Frame CPU @120 (mean) | 1.18 | 1.02 | 11.31 | 4.60 |
| Render CPU (mean) | 0.31 | 0.27 | 2.80 | 1.57 |
| HUD CPU (mean) | 0.26 | 0.22 | 2.26 | 0.73 |
| Allocation | 11.3 MB/s | 3.6 MB/s | 5.2 MB/s | 2.5 MB/s |
| Minor GCs in 10 s (longest) | 43 (57 ms) | 21 (26.5 ms) | 25 (123 ms) | 11 (2.8 ms) |

The allocation cut is the main win: fewer scavenges, and under throttling fewer GC pauses landing inside sim and render spans.

### 3.3 All scenes at 1x, Low, first pass (8 s; per-step ms, render / HUD p50)

| Scene | Sim | Move | AI | Proj | Rules | Render p50 | HUD p50 | CPU @120 | Alloc KB/s | Minor GCs |
|---|---|---|---|---|---|---|---|---|---|---|
| tdm | 0.86 | 0.28 | 0.36 | 0.06 | 0.01 | 0.3 | 0.2 | 2.41 | 3388 | 15 |
| horde (21 alive) | 0.28 | 0.09 | 0.13 | 0.02 | 0.01 | 0.3 | 0.1 | 0.76 | 2589 | 11 |
| royale | 0.26 | 0.07 | 0.12 | 0.01 | 0.02 | 0.2 | 0.1 | 0.57 | 1486 | 7 |
| generated | 0.25 | 0.08 | 0.12 | 0.01 | 0.01 | 0.2 | 0.1 | 0.56 | 1223 | 6 |
| editor | - | - | - | - | - | 0.3 | 0.0 | 0.58 | 425 | 3 |

(The tdm row of this run was disturbed by load: the back-to-back run in 3.2 measured 0.44 ms per step.)

### 3.4 All scenes at 4x on the final build (8 s, means; budgets: sim 2.0, move 0.5, AI 1.0, proj 0.3, rules 0.2, render 1.5, HUD 0.4, frame 5.5)

Measured after every change of the review pass (bot steering scratch, world sight lines, gather reuse, draws through `meshFrom`, chunk frustum test), on a quiet machine (load under 20% before and after). Sim columns are the in-frame cost per step; Bench = `--bench` (fastest of 4 back-to-back rounds of 480 steps, still at 4x) as sim / movement / AI.

| Scene | Preset | Sim | Move | AI | Proj | Rules | Bench sim / move / AI | Render (p50) | HUD (p50) | CPU @120 | Draws | Alloc KB/s | GCs (longest ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tdm | potato | 3.42 | 0.80 | 1.90 | 0.22 | 0.05 | 1.33 / 0.32 / 0.52 | 1.97 (0.5) | 1.57 (0.3) | 7.77 | 26 | 3330 | 15 (4.7) |
| tdm | low | 3.37 | 0.85 | 1.59 | 0.37 | 0.06 | 0.92 / 0.23 / 0.37 | 2.59 (1.4) | 1.96 (0.9) | 9.53 | 28 | 1070 | 5 (0.9) |
| horde | potato | 1.76 | 0.46 | 0.79 | 0.13 | 0.13 | 0.60 / 0.18 / 0.20 | 1.75 (0.4) | 1.04 (0.2) | 5.00 | 25 | 1543 | 7 (9.9) |
| horde | low | 3.16 | 0.82 | 1.41 | 0.22 | 0.12 | 0.65 / 0.22 / 0.22 | 3.15 (1.2) | 1.35 (0.5) | 8.25 | 26 | 1286 | 10 (7.4) |
| royale | potato | 2.79 | 0.75 | 1.27 | 0.17 | 0.08 | 0.63 / 0.20 / 0.24 | 1.82 (0.6) | 0.54 (0.1) | 5.53 | 28 | 999 | 4 (1.4) |
| royale | low | 3.40 | 0.93 | 1.62 | 0.23 | 0.09 | 0.86 / 0.26 / 0.28 | 2.55 (1.1) | 0.79 (0.2) | 7.29 | 32 | 797 | 4 (80.8) |
| generated | potato | 2.59 | 0.88 | 1.01 | 0.09 | 0.10 | 0.52 / 0.15 / 0.21 | 2.24 (0.8) | 0.83 (0.1) | 6.10 | 29 | 819 | 4 (10.7) |
| generated | low | 2.05 | 0.59 | 0.85 | 0.11 | 0.13 | 0.52 / 0.15 / 0.20 | 1.76 (0.3) | 0.57 (0.1) | 4.76 | 33 | 809 | 4 (5.6) |
| editor | potato | - | - | - | - | - | - | 2.75 (0.9) | 0.03 (0.0) | 5.00 | 9 | 1781 | 16 (9.8) |
| editor | low | - | - | - | - | - | - | 2.22 (0.3) | 0.05 (0.0) | 3.54 | 9 | 1539 | 14 (15.0) |

**Budget result (for the lead to decide).** With the in-frame means the PERF-002 budgets are **not met at 4x** in most match scenes on Potato and Low: sim 1.8-3.4 ms per step (budget 2.0; only horde Potato is under), movement 0.46-0.93 (0.5; only horde Potato is under), AI 0.79-1.90 (1.0; under only in horde Potato and generated Low), render mean 1.8-3.2 (1.5), HUD mean 0.5-2.0 (0.4), frame CPU @120 4.8-9.5 (5.5; under only in horde Potato and generated Low). The editor misses the render mean (2.2-2.8). Projectiles (0.09-0.37) and rules (0.05-0.13) are within budget except projectiles in TDM Low (0.37). The render and HUD p50 (0.1-1.4 ms) are inside their budgets: the means carry the throttle slices (2.3). With the bench cost every match scene meets every sim budget at 4x (sim 0.52-1.33, movement 0.15-0.32, AI 0.20-0.52). The cost on a phone lies between the two; only the LT pass on real devices (D1-D4) can settle it.

Between runs of the same build the throttled means move by up to 2x (TDM Low measured 3.5 ms per step in one sweep and 4.2 in the next), so this pass's before/after in throttled means is within noise. Its exact effects are the allocation probes, one brush-tree walk per actor step instead of two (`perf` test: 2.00 -> 1.00 walks per actor step) and the allocation sites listed in 4.

### 3.5 Dynamic resolution and step-down under throttling (`--reaction`)

TDM at Medium with `autoLower` on, 480 x 270, sampled every second: 6 s at 1x, 14 s at 6x, 12 s at 1x.

- At 6x the smoothed frame time rose from 17 to 84 ms within 4 s; the preset stepped down Medium -> Low after 5 s and Low -> Potato 4 s later (two toasts), and the scale went to the Potato minimum 0.4.
- Back at 1x the frame time returned to 17-19 ms at once. The scale did not climb back within 12 s: software WebGL still has 23-71 ms frames every few seconds, and any frame over the limit restarts the 2 s raise wait. The raise logic itself is covered by the render self-tests (raise after 2 s under 80 %, ceiling and back-off).
- Rerun on the final build of the review pass: the same reaction (Medium -> Low after 5 s at 6x, Low -> Potato 5 s later, scale to the Potato minimum 0.4), and back at 1x steady 17 ms frames for 12 s without a raise. Headless Chrome's software GL offers `EXT_disjoint_timer_query_webgl2`, so the controller compares the software GPU time with the 6 ms GPU budget, which software rendering never meets: the scale cannot climb headless whatever the frame interval. The raise path is covered by the render self-tests; recovery on a real GPU needs the device pass.
- Non-60 Hz screens (fixed in this pass): the smoothed frame time now uses a 0.1 s time constant (the same response at 60, 90, 120 and 144 Hz; before, it was 15 % per frame), and a display slower than 60 Hz or a frame cap below 60 is taken as the frame budget, so a 50 Hz TV or the 30 fps battery saver is not stepped down for frames no setting could make faster. A 120 Hz screen without a GPU timer keeps the 60 fps floor on purpose.
- The display interval is measured only from menu frames the display paced (review fix): uncapped, no benchmark, the previous frame drew at most 256 triangles and its CPU work took under half its interval; the lower quartile of 120 such frames counts only when it lies within 4% of a standard refresh rate. The map editor draws a whole map in the `menu` state, so before this fix a 25-30 fps editor map on a weak phone raised the frame budget to 36-43 ms and switched off the scale drop and the step-down for the next match (a slow main menu did the same). `perf` tests feed editor-like, CPU-bound, 27 fps GPU-bound and partly late menu frames and check that the budget stays.

### 3.6 Heap

After forced GCs the heap stays at 8.5-12 MB in every scene (PERF-005 limit 150 MB).

10-minute soak (step 18.4: `perf.mjs --no-scenes --soak 10 --scenes tdm --presets low`, 1x; heap after a forced GC at the end of each minute; the machine was at 100% outside load during the first two minutes):

| Minute | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Heap (MB) | 9.78 | 10.04 | 10.24 | 10.39 | 10.50 | 10.57 | 10.69 | 10.72 | 10.81 | 10.86 |
| Growth (KB) | +4346 | +263 | +205 | +155 | +111 | +71 | +130 | +33 | +90 | +52 |
| Longest GC pause (ms) | 348 | 101 | 2.0 | 2.3 | 2.2 | 2.6 | 2.1 | 1.9 | 2.0 | 1.7 |

The growth falls from 263 to 33-90 KB per minute but has not stopped after 10 minutes (+1.1 MB from minute 1 to 10). A `--retained` run (60 s after 60 s of warm-up) puts the whole retained 7 KB/s on the frame loop callback (`Loop.frame` with what is inlined into it), with no game data structure among the sites; it is most likely engine-side (compiled code, feedback, inline caches), but that is not proven. Once the outside load ended, the longest pause per minute was 1.7-2.6 ms (PERF-006: 2 ms or less).

## 4. Changes in this pass

Review pass (after the first results):

- Allocation (PERF-006), float arguments and returns boxed per step or per frame: bot steering writes its move into `botWish` and calls `Bots.wishFrom` (14a, 14c `steer` / `avoidance`, 14d strafe and dodge); bot sight and hearing rays fill `senseLine` and call the new `World.lineClearOf` (14b, 08a `castQuery`), and the smoke test runs only while smoke exists; `clipBrush` leaves its fraction in `clipResult` instead of returning a float (08a, 08b: one box per brush tested); royale loot touch reads the spot arrays (13g `lootInTouch`); pickups, royale loot and PvE enemy parts are drawn through `batch.meshFrom` (12a, 13g, 14h); world chunks are frustum-tested from the chunk object (`boundsVisible`); `Math.hypot` -> `length2` / `length3` in 07*, 08d, 11a, 11b, 14a, and `tools/build.mjs` fails on `Math.hypot` in the hot files.
- Movement CPU: a mover's gathered brush list is reused within the sim step while the new box lies inside the gathered one (08b `GatherCache`); `sweepActor` gathers at least the settle reach past its travel (10a `SETTLE_REACH`), so one actor step walks the brush tree once instead of twice.
- Display rate measured only on display-paced menu frames (3.5); boot time stamped at the first drawn frame (3.1); the recorder's 1 MB of sample arrays made on first use; `perf.mjs` per-site allocation rates divided by the measured duration; `--bench` and `--soak`.
- Tests (group `perf`): allocation probes, per-tier quality caps, a 16-bot Potato match capped at 7, brush-tree walks per actor step, the display-rate cases (section 1).

First pass:

- Allocation (PERF-006): float arguments to calls that are not inlined are boxed on the heap, so the hot paths now pass rays, segments and quads through reused objects and typed arrays: HUD quads (`setHudCorners` + `pushHudSolid`), world rays (`rayBrushOf`, a ray query object), collision sweeps (`setSweepSegment` + `Collide.sweepSegment`, `clipBrush` with a segment object), hit volumes (`setHitRay` + `Hitbox.rayOf`), actor parts (`batch.reserve` + `batch.light`, rotation in place), blob shadows and view-model parts (`batch.meshFrom` with a reused instance record), RNG state in an `Int32Array`, `length2` / `length3` instead of `Math.hypot` in the hot sections, one rAF callback, and `Sim.timing` / `timingTotal` as views over the system records (an object with ~30 keyed names is in dictionary mode, where each float write allocates).
- Frame pacing (18.5): the frame cap is paced from rAF timestamps with carried-over credit (60 on a 144 Hz screen averages 60 instead of 48); new 30 fps battery-saver cap.
- Dynamic resolution / step-down on non-60 Hz screens (above).
- Draw calls (PERF-004): world chunks are packed in row order and visible chunks that touch in the index buffer share one draw call (royale and generated on Potato: 93 -> 29 draws, tdm 54 -> 26).
- Size guard in `tools/build.mjs` (D07).
- Measurement: `Sim.timingTotal`, `Perf.bootMs`, the perf scenes and recorder, `tools/perf.mjs`.

## 5. Remaining risks

- **PERF-002 at 4x (explicit budget failure, 3.4).** In-frame means miss the sim, movement, AI, render, HUD and frame-CPU budgets in most match scenes at 4x on Potato and Low; the back-to-back bench meets every sim budget. CDP throttling is a coarse stand-in for a phone; the decision needs the LT pass on the D1-D4 devices. If a real low-end phone confirms the in-frame numbers, the next steps are a lower bot think rate on Potato (perception and decisions every second or third step), fewer sight rays per step, and a second look at `turn` and `follow` (75-235 KB/s of boxing each at 1x before this pass; this pass removed the steering and sight-line arguments).
- **PERF-006 not fully met.** Allocation is 0.8-3.3 MB/s at 4x (the editor 1.5-1.8 MB/s, mostly its tools' own drawing, not changed here). Under outside load single scavenges of 10-80 ms show up in throttled runs; unloaded at 1x the longest pause per minute was 1.7-2.6 ms, about the 2 ms limit. Remaining boxed sites include `Collide.slide` (12 bytes per call: the hot-path probe covers `sweepSegment`, not the whole slide), the RNG `next` return value, nav search and audio spatial updates.
- **Long sessions.** The heap still grows 33-130 KB per minute after 10 minutes of TDM (3.6); the retained sites point at the frame callback, not at game data. A 30-minute soak on a quiet machine would show whether it levels off.
- **HUD and render means at 4x** carry the throttle slices and SwiftShader uploads; their p50 is inside budget. Not measurable headless without them.
- **GPU side** (PERF-003 6 ms, overdraw, shader cost, render scale recovery) is not measurable headless; it needs the live tests on the D1-D4 devices.
