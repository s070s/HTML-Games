# ClassTimeKiller - Performance

Status: results of the plan phase 18 pass (steps 18.1-18.6) against `docs/SPECIFICATION.md` §3 PERF and §23 REN. Re-run `tools/perf.mjs` after any change to a hot path and update the tables here in the same change.

## 1. Tools

| Tool | What it does |
|---|---|
| `node tools/perf.mjs` | Headless Chrome (`tools/cdp.mjs`, shared with `tools/selftest.mjs`, no dependencies). Boot time at 1x / 4x / 6x CPU throttling, then every scene x preset x throttle rate. `--help` lists the options: `--scenes`, `--presets`, `--throttle`, `--seconds`, `--warmup`, `--alloc` / `--retained` / `--promoted` (top allocation sites), `--profile` (CPU self time), `--reaction` (dynamic resolution and step-down), `--bench` (sim cost per step from back-to-back steps, see 2.3), `--soak <minutes>` (heap after a forced GC every minute, step 18.4), `--json <file>`, `--file <html>` (another build, for before/after), `--view WxHxDPR` (emulated phone screen, e.g. `640x360x2`; written to the JSON as `view`). An option that takes a value stops with exit 3 when the value is missing. Exit 0 even on a budget miss (the misses are printed). |
| `node tools/selftest.mjs --group perf` | Exact-number checks that hold on a busy machine: frame-cap pacing, the single rAF callback, boot time wiring, display-rate budget (editor, CPU-bound and GPU-bound menu frames are not taken as the display rate), time-based smoothing, the zero-allocation call forms against their argument forms, allocation probes of hot paths (heap bytes over 20 000 calls of `Hitbox.rayOf`, `Collide.gatherAround` + `sweepSegment`, `sweepActor` + `Collide.stepSlide` (an actor step into the floor and a wall), `navAStar` (a search to a linked node), `World.lineClearOf`, `HudBatch.line`, `emitActorPart`, `batch.meshFrom` with a shape instance record; `performance.memory` is exact because `tools/selftest.mjs` starts Chrome with `--enable-precise-memory-info`), the PERF-009 / PERF-010 caps of every preset (catalogue rows, flooded particle / decal / light pools, bot and enemy caps, a 16-bot match on Potato), one brush-tree walk per actor step, pool and batch caps, the TDM perf scene end to end. |
| `node tools/build.mjs` | Size guard (D07): warns above 3.0 MB, fails above 3.5 MB. Release build now: about 2.1 MB, without the self-test blocks (the test build `ClassTimeKiller.test.html` with them is about 3.5 MB and has no limit). The shipped file leaves out blank and comment-only lines and end-of-line `//` comments and indents with tabs (about 15% smaller, still readable). Also fails on `Math.hypot` outside the cold files (save, progress, maps, map generator, editor, menus and self-tests), on a comment stripper that cuts a known tricky line wrongly, and on a joined script that does not parse. |
| `__CTK.perf` (page) | `scenes()`, `scene(name, qualityId, { autoLower })`, `record(seconds)` (a Promise of the report), `report()` (last report), `info()`, `stop()`, `stats()` (frame ring, `loopStartMs`, `bootMs`), `simBench(steps, rounds)`, `hotPaths()` (the allocation probes). The recorder's sample arrays (about 1 MB) are made on the first `record()`. |

Per run `perf.mjs` prints: frame interval p50/p95/p99; frame CPU mean, `@120` (see 2.3) and p50/p95/p99; sim ms per 120 Hz step (mean, p95) and the PERF-002 groups (movement = `move bodies`, AI = `botThink pveBrains nav`, projectiles = `weapons projectiles weaponSpecials`, rules = `rules mutators pve pveBoss pveLevel operationTickets`, other = every system no group names, from `Sim.timingTotal`); render and HUD CPU ms (mean, p50, p95); draw calls and instances (p95); render scale; minor / major GC count and longest pause (trace events); allocation rate (sampling heap profiler); heap after forced GCs and its growth over the run.

## 2. Scenes, presets, reading the numbers

### 2.1 Scenes (`PERF_SCENES` in `src/20b-test-perf.js`)

| Scene | Content |
|---|---|
| `tdm` | Harbor, 16 bots, every bot with an ability and gadget kit (meters kept full), a powerup for every bot every 8 s (10.8 worst case). |
| `horde` | First saved horde map, 3 bots, PvE enemies refilled to `Pve.cap()` every second. |
| `royale` | Ring Isle, 18 actors. |
| `generated` | GN5 large dense island (seed 4242, generated in full), 16 bots (GN5 large is medium+ only in menus; the scene passes `uncapped`). |
| `editor` | Arena template filled to 400 boxes (MAP-014), map editor open, camera turning. |
| `storm` | P7 worst case: the `tdm` scene plus, every frame, 12 shots (muzzle flash, muzzle light, a casing; the casing rate limit is bypassed), 12 hits on every material (particles and decal) and 12 blood bursts, all in the real pooled effects (`perfStorm` in `src/20b-test-perf.js`). The most the P7 feedback can be asked for at once. |

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

The numbers below were measured on earlier builds of the project; the size line in section 1 is the current one. Re-run `tools/perf.mjs` to refresh a table after a change to a hot path.

### 3.1 Boot (navigation start to the main menu's first drawn frame, `Perf.bootMs`, median of 3; re-measured on the merged build, 3.11 MB)

`Perf.bootMs` is stamped at the end of the first drawn frame: parse and boot of the whole file, the main menu built (`ready`) and the first frame with its shader compiles. `Perf.loopStartMs` keeps the loop start.

| Throttle | First menu frame | Loop start |
|---|---|---|
| 1x | 458 ms | 455 ms |
| 4x | 643 ms | 624 ms |
| 6x | 912 ms | 868 ms |

The menu build and the first frame add about 20 ms. Under the 2 s Potato load checkpoint at 6x, so no boot work was deferred.

### 3.2 Before / after of the first pass (TDM, Low, 10 s, back to back on the same machine; measured before the merge)

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

### 3.3 All scenes at 1x, Low, first pass (8 s; per-step ms, render / HUD p50; measured before the merge, without the audit fixes, the sim wiring and the PvE HUD)

| Scene | Sim | Move | AI | Proj | Rules | Render p50 | HUD p50 | CPU @120 | Alloc KB/s | Minor GCs |
|---|---|---|---|---|---|---|---|---|---|---|
| tdm | 0.86 | 0.28 | 0.36 | 0.06 | 0.01 | 0.3 | 0.2 | 2.41 | 3388 | 15 |
| horde (21 alive) | 0.28 | 0.09 | 0.13 | 0.02 | 0.01 | 0.3 | 0.1 | 0.76 | 2589 | 11 |
| royale | 0.26 | 0.07 | 0.12 | 0.01 | 0.02 | 0.2 | 0.1 | 0.57 | 1486 | 7 |
| generated | 0.25 | 0.08 | 0.12 | 0.01 | 0.01 | 0.2 | 0.1 | 0.56 | 1223 | 6 |
| editor | - | - | - | - | - | 0.3 | 0.0 | 0.58 | 425 | 3 |

(The tdm row of this run was disturbed by load: the back-to-back run in 3.2 measured 0.44 ms per step.)

### 3.4 All scenes at 4x on the merged build (8 s, means; budgets: sim 2.0, move 0.5, AI 1.0, proj 0.3, rules 0.2, render 1.5, HUD 0.4, frame 5.5)

Re-measured on the merged build (final review fixes included) with `perf.mjs --scenes tdm,horde,royale,generated,editor --presets potato,low --throttle 4 --seconds 8 --bench`, while another test run shared the machine, so the means carry the noise described below; the earlier table of the perf pass (before the merge) gave the same picture. Sim columns are the in-frame cost per step; Bench = `--bench` (fastest of 4 back-to-back rounds of 480 steps, still at 4x) as sim / movement / AI.

| Scene | Preset | Sim | Move | AI | Proj | Rules | Bench sim / move / AI | Render (p50) | HUD (p50) | CPU @120 | Draws | Alloc KB/s | GCs (longest ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tdm | potato | 1.91 | 0.46 | 0.74 | 0.16 | 0.03 | 1.06 / 0.28 / 0.39 | 1.77 (0.4) | 0.87 (0.3) | 5.29 | 28 | 3653 | 16 (5.3) |
| tdm | low | 1.26 | 0.32 | 0.66 | 0.06 | 0.01 | 0.81 / 0.19 / 0.31 | 1.78 (0.3) | 1.07 (0.2) | 4.42 | 29 | 1379 | 6 (1.3) |
| horde | potato | 1.49 | 0.35 | 0.70 | 0.09 | 0.06 | 0.40 / 0.13 / 0.14 | 2.38 (0.7) | 1.06 (0.2) | 5.33 | 25 | 1588 | 7 (8.2) |
| horde | low | 1.83 | 0.65 | 0.70 | 0.18 | 0.10 | 0.64 / 0.18 / 0.18 | 2.84 (0.5) | 1.33 (0.2) | 6.51 | 26 | 1102 | 9 (10.5) |
| royale | potato | 2.62 | 0.72 | 1.31 | 0.14 | 0.12 | 0.81 / 0.22 / 0.29 | 2.10 (0.4) | 0.76 (0.1) | 5.78 | 33 | 970 | 5 (8.4) |
| royale | low | 2.27 | 0.82 | 1.01 | 0.14 | 0.06 | 0.60 / 0.14 / 0.21 | 2.19 (0.3) | 0.62 (0.1) | 5.50 | 36 | 582 | 5 (0.4) |
| generated | potato | 2.38 | 0.53 | 1.19 | 0.13 | 0.10 | 0.56 / 0.14 / 0.18 | 2.11 (0.4) | 0.87 (0.1) | 5.72 | 26 | 703 | 4 (13.1) |
| generated | low | 1.98 | 0.55 | 0.90 | 0.10 | 0.13 | 0.76 / 0.17 / 0.23 | 2.29 (0.3) | 0.80 (0.1) | 5.35 | 28 | 647 | 3 (1.9) |
| editor | potato | - | - | - | - | - | - | 1.93 (1.0) | 0.02 (0.0) | 3.64 | 9 | 1793 | 16 (3.0) |
| editor | low | - | - | - | - | - | - | 1.76 (0.8) | 0.05 (0.0) | 3.24 | 9 | 1530 | 14 (8.8) |

**Budget result (for the lead to decide; ranges from the pre-merge table, the merged table above shows the same misses).** With the in-frame means the PERF-002 budgets are **not met at 4x** in most match scenes on Potato and Low: sim 1.8-3.4 ms per step (budget 2.0; only horde Potato is under), movement 0.46-0.93 (0.5; only horde Potato is under), AI 0.79-1.90 (1.0; under only in horde Potato and generated Low), render mean 1.8-3.2 (1.5), HUD mean 0.5-2.0 (0.4), frame CPU @120 4.8-9.5 (5.5; under only in horde Potato and generated Low). The editor misses the render mean (2.2-2.8). Projectiles (0.09-0.37) and rules (0.05-0.13) are within budget except projectiles in TDM Low (0.37). The render and HUD p50 (0.1-1.4 ms) are inside their budgets: the means carry the throttle slices (2.3). With the bench cost every match scene meets every sim budget at 4x (sim 0.52-1.33, movement 0.15-0.32, AI 0.20-0.52). The cost on a phone lies between the two; only the LT pass on real devices (D1-D4) can settle it.

Between runs of the same build the throttled means move by up to 2x (TDM Low measured 3.5 ms per step in one sweep and 4.2 in the next), so this pass's before/after in throttled means is within noise. Its exact effects are the allocation probes, one brush-tree walk per actor step instead of two (`perf` test: 2.00 -> 1.00 walks per actor step) and the allocation sites listed in 4.

### 3.5 Dynamic resolution and step-down under throttling (`--reaction`)

The step-down lowers one preset for this session only (`Quality.sessionId`, never saved): every PERF-009 cap (bots, enemies, props, voices) and the particle and decal pools follow `Quality.current()` at once, and the next launch retries the saved preset. Choosing a preset or finishing the benchmark ends it.

TDM at Medium with `autoLower` on, 480 x 270, sampled every second: 6 s at 1x, 14 s at 6x, 12 s at 1x.

- At 6x the smoothed frame time rose from 17 to 84 ms within 4 s; the preset stepped down Medium -> Low after 5 s and Low -> Potato 4 s later (two toasts), and the scale went to the Potato minimum 0.4.
- Back at 1x the frame time returned to 17-19 ms at once. The scale did not climb back within 12 s: software WebGL still has 23-71 ms frames every few seconds, and any frame over the limit restarts the 2 s raise wait. The raise logic itself is covered by the render self-tests (raise after 2 s under 80 %, ceiling and back-off).
- Rerun on the final build of the review pass: the same reaction (Medium -> Low after 5 s at 6x, Low -> Potato 5 s later, scale to the Potato minimum 0.4), and back at 1x steady 17 ms frames for 12 s without a raise. Headless Chrome's software GL offers `EXT_disjoint_timer_query_webgl2`, so the controller compares the software GPU time with the 6 ms GPU budget, which software rendering never meets: the scale cannot climb headless whatever the frame interval. The raise path is covered by the render self-tests; recovery on a real GPU needs the device pass.
- Non-60 Hz screens (fixed in this pass): the smoothed frame time now uses a 0.1 s time constant (the same response at 60, 90, 120 and 144 Hz; before, it was 15 % per frame), and a display slower than 60 Hz or a frame cap below 60 is taken as the frame budget, so a 50 Hz TV or the 30 fps battery saver is not stepped down for frames no setting could make faster. A 120 Hz screen without a GPU timer keeps the 60 fps floor on purpose.
- The display interval is measured only from frames the display paced (review fix): light menu frames and idle running match frames, uncapped, no benchmark, CPU work under half the interval (and timed GPU work too, where the GPU timer exists); the lower quartile of 120 such frames counts only when it lies within 4% of a standard refresh rate. Without a GPU timer an interval slower than 60 Hz counts only after it held while the pixel count halved (or at the preset's minimum scale). The map editor draws a whole map in the `menu` state, so before this fix a 25-30 fps editor map on a weak phone raised the frame budget to 36-43 ms and switched off the scale drop and the step-down for the next match (a slow main menu did the same). `perf` tests feed editor-like, CPU-bound, 27 fps GPU-bound and partly late menu frames and check that the budget stays.

### 3.6 Heap

After forced GCs the heap stays at 8.5-12 MB in every scene (PERF-005 limit 150 MB).

10-minute soak (step 18.4: `perf.mjs --no-scenes --soak 10 --scenes tdm --presets low`, 1x; heap after a forced GC at the end of each minute; the machine was at 100% outside load during the first two minutes):

| Minute | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Heap (MB) | 9.78 | 10.04 | 10.24 | 10.39 | 10.50 | 10.57 | 10.69 | 10.72 | 10.81 | 10.86 |
| Growth (KB) | +4346 | +263 | +205 | +155 | +111 | +71 | +130 | +33 | +90 | +52 |
| Longest GC pause (ms) | 348 | 101 | 2.0 | 2.3 | 2.2 | 2.6 | 2.1 | 1.9 | 2.0 | 1.7 |

The growth falls from 263 to 33-90 KB per minute but has not stopped after 10 minutes (+1.1 MB from minute 1 to 10). A `--retained` run (60 s after 60 s of warm-up) puts the whole retained 7 KB/s on the frame loop callback (`Loop.frame` with what is inlined into it), with no game data structure among the sites; it is most likely engine-side (compiled code, feedback, inline caches), but that is not proven. Once the outside load ended, the longest pause per minute was 1.7-2.6 ms (PERF-006: 2 ms or less).

### 3.7 PERF-002 sim pass (before / after)

Before = the merged build b3bf9f4, after = this pass, measured back to back on the same machine while eight other helpers' builds and test runs shared it (the load changed from minute to minute).

Exact numbers (allocation probes, `perf` group, heap bytes over 20 000 calls after warm-up, fewest of 3 rounds; a round in which a GC ran counts as allocating, since its reading goes negative; before = the current probes built on b3bf9f4):

| Probe | Before | After |
|---|---|---|
| `sweepActor` + `Collide.stepSlide` (one actor step into the floor and a wall) | 2555 KB (about 130 B, 10 boxed floats per call) | 0 KB |
| `navAStar` (search to a linked node) | 232 KB (the first reading hid it: a GC in every round read as negative) | 0 KB |
| `stepActor` (one actor step through the indirect state call, triggers, eye, flags and footsteps; a mantle restarted every call) | 469 KB (2 boxed floats per step: the gravity argument to the state and to `World.touchTriggers`) | 0 KB |
| `Collide.gatherAround` + `sweepSegment`, `World.lineClearOf` | 0 KB | 0 KB |

Back-to-back sim cost per step at 1x, Low (`simBench`, 3 x 480 steps per sample, 4 samples per build taken alternately, fastest kept; ms):

| Scene | Sim before / after | Movement | AI | Items |
|---|---|---|---|---|
| tdm | 0.269 / 0.235 | 0.065 / 0.057 | 0.104 / 0.105 | 0.015 / 0.006 |
| royale | 0.206 / 0.242 | 0.048 / 0.051 | 0.088 / 0.128 | 0.004 / 0.001 |
| horde | 0.186 / 0.181 | 0.056 / 0.060 | 0.051 / 0.051 | 0.003 / 0.002 |
| generated | 0.170 / 0.166 | 0.039 / 0.039 | 0.085 / 0.096 | 0.003 / 0.001 |

Only the items column changes beyond the noise: 1.5-4x less (the touch loop scanned all 256 pickup slots for every actor every step). The other columns move both ways by up to 45% between samples of the same build (an earlier A/B of the same kind, taken under heavier load, had AI 5-30% lower after in three scenes and royale movement higher), so the CPU effect of the sight-line and allocation changes is below what this shared machine resolves; their exact effect is the allocation probes above (fewer scavenges, PERF-006). The 4x sweep of 3.4 rerun before and after on the loaded machine gave in-frame means two to five times those of 3.4 for both builds (TDM Potato sim 11.5 / 9.0 ms, horde Potato 8.5 / 19.3 ms): no before/after can be read from it, and the budget result of 3.4 stands until a quiet-machine or device run (5).

### 3.8 Render and HUD garbage per frame (final review pass, live frames)

Heap bytes per frame of each render update and HUD layer in a running match (Potato, 1x): a wrapper around the step reads `performance.memory` before and after it, over about 70 frames after 4 s of play; median per frame (frames with a GC inside dropped). The `hotPaths` probes cannot show these sites: their loop compiles the path into one function, where the floats never leave registers. Before = b3bf9f4, after = this pass, run back to back.

| Scene | Props sources (`fillSources`) | of which PvE enemies | Actors and shadows (`fillActors`) | HUD `main` layer | HUD `world` layer |
|---|---|---|---|---|---|
| tdm | 2008 -> 16 | - | 4468 -> 796 | 8828 -> 8216 | 4888 -> 2992 |
| royale | 3772 -> 304 | - | 988 -> 52 | 2992 -> 3544 | 424 -> 376 |
| generated | 3772 -> 304 | - | 856 -> 64 | 2176 -> 2080 | 400 -> 376 |
| horde | 7380 -> 1048 | 5508 -> 160 | 3232 -> 2656 | 11788 -> 10380 | 1636 -> 2344 |

The render side (props and actors) dropped from 4.6-10.6 KB to 0.4-3.7 KB per frame: 130-210 KB/s less garbage at 30 fps, twice that at 60. The HUD layers are now the largest render-side source (2-10 KB per frame, about the same as before within run-to-run noise): their drawers pass floats to pen calls that are not inlined (5).

Compiler tiers (final review round, `--js-flags=--allow-natives-syntax`, `%GetOptimizationStatus`): the table above was taken 4 s into the match, while the once-per-frame functions (the HUD drawers, `Render.drawFrame`) still run in the baseline tier, which boxes every float it computes. After 60 s they run in the middle tier (Maglev), which keeps floats unboxed inside a function but boxes every float argument of a call it does not inline; it did not inline even a pen method with no calls of its own. The hot-loop probes reach the top tier (TurboFan), which inlines those calls, so they see none of this. The numbers below are taken after 60 s of play (`scratchpad/pr/livedrawers.js` wraps every HUD drawer at once), before = cd812b9, after = this round, back to back:

| Scene (Potato) | HUD `main` layer | minimap | crosshair | kill feed | header | `world` markers | PvE enemies (props) |
|---|---|---|---|---|---|---|---|
| tdm | 6484 -> 3088 | 1444 -> 280 | 556 -> 256 | 892 -> 208 | 376 -> 232 | 1696 -> 1024 | - |
| horde | 5136 -> 2892 | 724 -> 160 | 124 -> 124 | 700 -> 16 | 532 -> 256 | 1120 -> 232 | 616 -> 16 |

The PvE column is the `pve` render source with its heal beams and laser tells (horde has wardens and longeyes). The "after" column above is the pen's internal fix alone (shapes, bars, icons, labels, text and ring internals). What it left was 3-4 boxed floats per pen call at the drawers' call sites, so the main layer's every-frame drawers (17a vitals, ammo, weapons, gadgets, abilities, money, powerups; 17b crosshair; 17c header, kill feed; 17f minimap, barks) now fill the scratch arrays and call the `*At` forms. The two layers alone (no drawer wrappers), after 90 s, two runs each, back to back:

| Scene (Potato) | `main` before (cd812b9) | `main` after | `world` before | `world` after |
|---|---|---|---|---|
| tdm | 5144, 4604 | 1724, 404 | 2116, 2416 | 496, 556 |
| horde | 3796, 3916 | 988, 724 | 2108, 1588 | 316, 244 |

The 1.7 KB run had a drawer still in the baseline tier at 90 s (tiering is not deterministic); the other runs are 0.4-1.0 KB per frame. What was left after that round, the `pve` drawer (17g-hud-pve, about 0.5 KB in horde) and the world markers and name tags (17d), now go through the scratch forms too (the leftover round below); still left are single boxes for fading alphas and number labels (`hudNumber(value)` of a float) and the three float arguments of `Hud.project`.

Leftover round (after 681cca3): the PvE drawing probe (`pve` group, `fillSources` over 20000 frames) read about 17100 KB. That was the probe, not the frame: `perfAllocatedBytes` calls `run(i)` with `i` from 0 again in every measured round, so `i < PERF_ALLOC_WARMUP_CALLS / 2` sent half of every round to the test's mesh recorder, which pushes a new record per mesh (about 1.7 KB per draw). It passed before only because a GC round read negative; since the sim pass a GC round counts as allocating. The probe now counts its own calls (the recorder runs in the warmup only) and reads 0 KB. The menu benchmark grid (07e) was the one render source still calling `batch.mesh` with 13 float arguments; it never draws in a match or a headless test, and now uses an instance record too. Bot look spring (14a `turn`): in `perf.mjs --alloc` (horde, Potato, 4x) it was the top site at 90 KB/s before; after it is not in the top 15 sites (under about 25 KB/s) in two runs of horde and tdm. The HUD changes of this round were checked for identical output: the quads of the PvE status in all six PvE modes, three states, desktop and phone layouts, and of markers, edge arrows, pings and name tags, hash the same before and after.

Whole runs at 4x (`perf.mjs --scenes tdm,royale,generated,horde --presets potato,low --throttle 4 --seconds 8`, before then after, back to back on the loaded machine): render / HUD mean (p50) ms per frame, allocation of the whole page (sim included), minor GCs in 8 s.

| Scene | Preset | Render before | Render after | HUD before | HUD after | Alloc KB/s before -> after | GCs before -> after |
|---|---|---|---|---|---|---|---|
| tdm | potato | 2.35 (0.6) | 2.43 (0.5) | 1.24 (0.3) | 1.17 (0.2) | 3298 -> 3622 | 14 -> 15 |
| tdm | low | 1.82 (0.4) | 2.74 (0.3) | 1.32 (0.2) | 0.95 (0.2) | 1265 -> 1276 | 6 -> 5 |
| royale | potato | 2.18 (0.5) | 2.10 (0.4) | 0.63 (0.1) | 0.74 (0.1) | 1113 -> 862 | 5 -> 4 |
| royale | low | 1.98 (0.3) | 2.30 (0.3) | 0.61 (0.1) | 1.31 (0.1) | 650 -> 481 | 5 -> 2 |
| generated | potato | 2.38 (0.9) | 1.88 (0.3) | 0.73 (0.1) | 0.50 (0.1) | 704 -> 717 | 3 -> 4 |
| generated | low | 2.88 (0.5) | 2.47 (0.4) | 0.58 (0.1) | 0.67 (0.1) | 633 -> 475 | 3 -> 2 |
| horde | potato | 2.66 (0.5) | 2.66 (1.0) | 0.98 (0.2) | 1.21 (0.2) | 1502 -> 1243 | 7 -> 5 |
| horde | low | 2.34 (0.6) | 2.39 (0.4) | 1.87 (0.2) | 1.38 (0.2) | 1192 -> 1014 | 10 -> 8 |

The throttled means stay inside the run-to-run noise of 2.3 (the slices dominate them); the p50s are equal or lower in 7 of 8 rows for render and in all rows for the HUD. The whole-page allocation fell 15-26% in royale, generated Low and horde; TDM is dominated by the sim's own sites (`turn`, `follow`, `depenetrate`, `rayOf`, 5) and stayed within noise. The render and HUD budgets of 3.4 are still missed on the means at 4x. The cooldown rings' CPU (`abilities` and `gadgets` drawers, 1x, tdm Low): 23 and 11 us per frame before, 10 and 4 us after.

### 3.9 All scenes at 4x after round 2 (quiet machine, 8 s, `--bench`)

Measured on the merged round 2 build with nothing else running (`perf.mjs --scenes tdm,horde,royale,generated --presets potato,low --throttle 4 --seconds 8 --no-boot --bench`). In-frame means per step (ms), render / HUD means per frame, and the back-to-back bench sim per step:

| Scene | Preset | Sim | Move | AI | Render | HUD | Alloc KB/s | Bench sim |
|---|---|---|---|---|---|---|---|---|
| tdm | potato | 2.81 | 0.66 | 1.39 | 1.93 | 1.22 | 2749 | 1.17 |
| tdm | low | 2.52 | 0.55 | 1.28 | 1.85 | 1.04 | 805 | 0.96 |
| horde | potato | 2.08 | 0.55 | 0.89 | 1.18 | 0.91 | 1004 | 0.52 |
| horde | low | 2.39 | 0.75 | 0.89 | 1.85 | 0.66 | 602 | 0.60 |
| royale | potato | 1.12 | 0.33 | 0.46 | 1.06 | 0.32 | 569 | 0.74 |
| royale | low | 1.17 | 0.30 | 0.52 | 0.91 | 0.28 | 363 | 0.72 |
| generated | potato | 1.37 | 0.41 | 0.63 | 0.91 | 0.38 | 412 | 0.62 |
| generated | low | 1.98 | 0.60 | 0.92 | 1.47 | 0.30 | 357 | 0.63 |

Royale and generated meet every PERF-002 budget at 4x except generated Low movement (0.60 > 0.5). TDM and horde still miss the in-frame sim, movement, AI, render and HUD means; their p50s are in budget (render 0.2-0.5, HUD 0.1-0.3) and the back-to-back bench meets every sim budget, so the misses are the throttle slices landing inside measured spans (2.3). The real-device pass (LIVE-TESTS LT-C-006, LT-C-029 on D1-D4) decides.

## 4. Changes in this pass

Leftover round (3.8):

- Tests: the PvE drawing allocation probe counts its own calls, so the allocating mesh recorder runs in the warmup only (`run(i)` restarts `i` in every measured round); a check counts the recorder draws. 17.1 MB -> 0 KB over 20000 frames.
- HUD (17g): the PvE status rows read and move the row y in `hudPveAt` (y, left and right edge; `hudPvePlaceRows`, `hudPveRowPanel`, `hudPvePlaceTable`) instead of taking and returning a float y; the stat, total, fraction and table-row helpers place their text from `hudTextAt` and call `textAt`, the bars `barAt`, the panels `panelAt`, the boss bar `labelAt` / `rectAt`; the note width is measured with `measureAt`; the Operations tickets use `textAt`. `hudPveTop` is replaced by `hudPvePlaceRows`.
- HUD (17d): markers, edge arrows (corners straight into `hudCorners`), ping labels, name tags, item timers, captions and the sound ring fill `hudShapeAt` / `hudTextAt` / `hudBoxAt` and call `shapeAt`, `textAt`, `labelAt`, `rectAt`; widths through `measureAt`; the marker clamp is `Math.min` / `max`.
- Bots (14a): the look spring runs one axis at a time through the `botLookSpring` scratch (`springStep`, which also takes the feed rate from the look point's move); angles wrap in place with `wrapAngleAt` (01, which `wrapAngle` now uses); the pitch caps are `Math.min` / `max`. `springVelocity` and `lookRate` are gone.
- Render (07e): the menu benchmark grid draws through `benchmarkInstance` and `batch.meshFrom`.
- Tests: `perf` lists the 17g and 17d drawers in the "no float to the pen" check (with `HudBatch.measure(` and `clamp(`), checks the rows take no y, and the benchmark source by source and instance count; `bots` checks the look spring against the spring formulas step for step and by source; `hudui` reads the rows' top from `hudPveAt`.

PERF-002 sim pass (3.7):

- AI: line of sight (`World.lineClearOf`, bot sight and hearing) is an any-hit query: the brush-tree walk stops at the first brush hit instead of searching for the nearest (`rayQuery.anyHit`; `World.raycast` still returns the nearest). Every ray slab test (tree nodes and brush boxes, `rayCrossesBox`) multiplies by a `1 / direction` computed once per ray (`setRayInverse`) instead of dividing twice per axis and box, and passes no floats as arguments.
- AI: the A* heap push reads its score from `navSearch.pushScore` (a float argument was boxed per pushed node); bot path following (14c `follow`) passes its target point as an object.
- Movement (PERF-006 remaining site `Collide.slide`): the per-step forms `Collide.slideMover` / `stepSlideMover` read the piece time from `slideClock` (the computed `dt / pieces` was boxed per call), `addClipPlane` takes a `{ nx ny nz brush }` object (a trace, or the floor plane), the step-up sweeps write the sweep query in place instead of six float arguments, and the end-of-step vertical speed is set before `clipToTouchedPlanes`.
- Items: the pickup loops (step, touch, volatile ammo ray, draw) stop at `Items.usedEnd` instead of `PICKUP_CAP`.
- Tests: `world` lineClear against brute force on 2000 lines (a quarter axis-parallel) and the first-hit stop; `items` usedEnd; `perf` probes for `sweepActor` + `stepSlide`, `navAStar` and `lineClearOf`.
- Second round: the actor step passes its gravity and start position through `moveStep` (10a; the states are `fn(id, preset, dt)`, `integrate(id, gravityScale, dt)`) and `World.triggerStep.gravity` (08c, `World.touchTriggers(id)`); `sweepActor` takes a step-up flag and the floor probe one constant reach per call (a STEP_HEIGHT-or-0 argument was a boxed float). A line of sight the static tree already blocks skips the dynamic brushes; the unique-powerup wait (`Items.dropExists`) stops at `Items.usedEnd`. The allocation probes count a round with a GC as allocating, and `perf` has a `stepActor` probe.


Final review round (render and HUD, 3.8):

- PvE heal beams and laser tells (14i) go through the parts' instance record (`placeSegment` fills it from two Vec scratch ends, `batch.meshFrom`), not `batch.mesh` with 13 float arguments; `brain.draw(batch, id, row)` and `drawTell(batch, id, attack)` get no time or progress argument (the tell's progress is read from `pveTellGlow`).
- HUD (07f, 17a, 17b, 17c, 17f): the main layer's every-frame drawers place their numbers in scratch arrays (`hudBoxAt`, `hudShapeAt`, `hudTextAt`, `hudRingAt`, `hudCross`) and call the pen's `*At` forms; pen shapes (square, diamond, triangle, disc), bars, weapon icons and labels write the scratch arrays instead of calling the pen again with computed floats; `HudBatch.text` / `measure` run through `textAt` / `measureAt`, which take no float and return none; `HudBatch.line` writes its corners directly; the HUD opacity is applied once in `setHudPaint` (`HudBatch.alphaScale`), so the pen passes its alpha through; minimap dots and crosshair arms fill the scratch directly. `pushHudQuad` and `setHudCorners` (the argument forms, used only by a test) are removed.
- Tests: `pve` group checks the PvE draw hooks by their source (no `batch.mesh`, no float argument) because the allocation probe runs in the top tier and passed on the old code too; the probe now also draws a heal beam and a laser tell. `perf` group: the pen's shapes, bar and text against their expected quads, the scratch forms by source, and the opacity applied once.

Final review pass (render and HUD, 3.8):

- Shape instance records (`makeShapeInstance`, 07c) come from a constructor. As object literals they shared V8 field types with every other 12-key literal starting with `x, y, z`; the nav builder's `{ x: [], y: [], z: [], ... }` (09a) made those fields generic once any map loaded, so every `x`, `y`, `z` store of every pickup, royale loot item, shadow disc, view-model part and PvE enemy part boxed a float.
- The per-instance sun term is read through `sunVisibilityAt(batch.data, offset)` (07b), which returns the grid byte: `sampleSunVisibility(x, y, z)` (now only a test helper) took three floats and returned one, four boxes per instance wherever the call was not inlined.
- PvE drawing (14h): champion rings, element shield rings and the awareness mark go through the parts' instance record (`batch.meshFrom`) with integer arguments only; `Sim.time` and the shield share are read inside the helpers, not passed; the part and ring loops are index loops (`for-of` made an iterator result per part, and boxed each float of `PVE_SHELL_HEIGHTS`, in the frame's own compiled code). `pickAttack` counts the hostiles for the last stand once per pick, not once per attack row.
- HUD (07f, 17a): the colour and alpha byte are set once per drawing call (`setHudPaint`) instead of passing a float alpha to `pushHudCorners` for every glyph and ring segment; `HudPen.quad` / `triangle` fill the corner scratch instead of calling the 14-argument `pushHudQuad`; `HudBatch.rect` writes its corners directly; rings turn each segment edge from the last one (one sine / cosine pair for the start and one for the step instead of four trig calls per segment: the cooldown rings were most of the HUD's CPU).
- Measuring: the inlined allocation probes (`hotPaths`) missed these sites, because a probe loop compiles the path into one function; the live numbers in 3.8 wrap each render source and HUD layer in a running match and take the median heap bytes per frame.
- Tests: `perf` group probes for `batch.meshFrom` after a full nav build, the sun lookup contract, index loops in the PvE draw path, the HUD ring (4 trig calls, end on the end angle) and the pen quads; `pve` group: PvE drawing through `fillSources` allocates nothing, `lastStand` counted once per `pickAttack`.

Review pass (after the first results):

- Allocation (PERF-006), float arguments and returns boxed per step or per frame: bot steering writes its move into `botWish` and calls `Bots.wishFrom` (14a, 14c `steer` / `avoidance`, 14d strafe and dodge); bot sight and hearing rays fill `senseLine` and call the new `World.lineClearOf` (14b, 08a `castQuery`), and the smoke test runs only while smoke exists; `clipBrush` leaves its fraction in `clipResult` instead of returning a float (08a, 08b: one box per brush tested); royale loot and beacon touch read the spot arrays through the one touch rule (13b `withinTouchAt`, which `withinTouch` calls too); pickups, royale loot and PvE enemy parts are drawn through `batch.meshFrom` (12a, 13g, 14h); world chunks are frustum-tested from the chunk object (`boundsVisible`); `Math.hypot` -> `length2` / `length3` in 07*, 08c, 08d, 11a, 11b, 14a, 14e, 14h, 14i and the HUD (17b, 17d, 17f, 17g), and `tools/build.mjs` fails on `Math.hypot` in the hot files.
- Movement CPU: a mover's gathered brush list is reused within the sim step while the new box lies inside the gathered one (08b `GatherCache`); `sweepActor` gathers at least the settle reach past its travel (10a `SETTLE_REACH`), so one actor step walks the brush tree once instead of twice.
- Display rate measured only on display-paced light menu and idle match frames (3.5); boot time stamped at the first drawn frame (3.1); the recorder's 1 MB of sample arrays made on first use; `perf.mjs` per-site allocation rates divided by the measured duration; `--bench` and `--soak`.
- Tests (group `perf`): allocation probes, per-tier quality caps, a 16-bot Potato match capped at 7, brush-tree walks per actor step, the display-rate cases (section 1).

First pass:

- Allocation (PERF-006): float arguments to calls that are not inlined are boxed on the heap, so the hot paths now pass rays, segments and quads through reused objects and typed arrays: HUD quads (`setHudCorners` + `pushHudSolid`), world rays (`rayBrushOf`, a ray query object), collision sweeps (`setSweepSegment` + `Collide.sweepSegment`, `clipBrush` with a segment object), hit volumes (`setHitRay` + `Hitbox.rayOf`), actor parts (`batch.reserve` + `batch.light`, rotation in place), blob shadows and view-model parts (`batch.meshFrom` with a reused instance record), RNG state in an `Int32Array`, `length2` / `length3` instead of `Math.hypot` in the hot sections, one rAF callback, and `Sim.timing` / `timingTotal` as views over the system records (an object with ~30 keyed names is in dictionary mode, where each float write allocates).
- Frame pacing (18.5): the frame cap is paced from rAF timestamps with carried-over credit (60 on a 144 Hz screen averages 60 instead of 48); new 30 fps battery-saver cap.
- Dynamic resolution / step-down on non-60 Hz screens (above).
- Draw calls (PERF-004): world chunks are packed in row order and visible chunks that touch in the index buffer share one draw call (royale and generated on Potato: 93 -> 29 draws, tdm 54 -> 26).
- Size guard in `tools/build.mjs` (D07).
- Measurement: `Sim.timingTotal`, `Perf.bootMs`, the perf scenes and recorder, `tools/perf.mjs`.

## 5. Remaining risks

The simulation runs as many 120 Hz steps per frame as fit 25 ms at the measured step cost, between 4 and 12 (ARC-010), so a slow frame does not drop game time at once. A match load builds the nav graph in 6 ms slices per frame (`NAV_SLICE_MS`); the graph is empty until `nav.ready`. The self-test speed factor is one `testSpeedFactor()` (a fixed loop, capped at 3, times an engine pace table for Chromium, Firefox and WebKit), not per-test reference workloads.

- **PERF-002 at 4x (explicit budget failure, 3.4; the sim pass of 3.7 cut the pickup loop and the movement and A* allocations and stops sight lines at their first hit, but its timing could not be checked against the budget on the shared machine).** In-frame means miss the sim, movement, AI, render, HUD and frame-CPU budgets in most match scenes at 4x on Potato and Low; the back-to-back bench meets every sim budget. CDP throttling is a coarse stand-in for a phone; the decision needs the LT pass on the D1-D4 devices. If a real low-end phone confirms the in-frame numbers, the next steps are a lower bot think rate on Potato (perception and decisions every second or third step), fewer sight rays per step, and a second look at `turn` and `follow` (75-235 KB/s of boxing each at 1x before this pass; this pass removed the steering and sight-line arguments).
- **PERF-006 not fully met.** Allocation is 0.8-3.3 MB/s at 4x (the editor 1.5-1.8 MB/s, mostly its tools' own drawing, not changed here). Under outside load single scavenges of 10-80 ms show up in throttled runs; unloaded at 1x the longest pause per minute was 1.7-2.6 ms, about the 2 ms limit. On the HUD side (3.8) what is left are `Hud.project(x, y, z)` (17b, 17d, 17f), `hudNumber` of a float, the PvE side-table and note layout helpers (`hudPveSideLeft`, `hudPveSideTop`, `hudPveNoteX`, `hudPveNoteY`: a few floats per frame, Test Chambers and Firing Range only) and the downed-state labels (17d, only while someone is down). Remaining sim boxed sites include the wall-run and glide gravity scales (a preset field passed to `integrate`, only in those states), the RNG `next` return value and audio spatial updates; `Collide.slide`, the A* search and the step driver are allocation-free since the PERF-002 sim pass (3.7). A whole walking step (`integrate` with the floor follow and probe) reads 0 B under V8's optimizing tier but about 36 B (3 floats) in headless Chrome, where `integrate` stays in the mid tier (Maglev), which inlines fewer helpers; it reads 0 with `--no-maglev` or `--no-maglev-inlining`, so the probe covers the step driver and the collision move separately.
- **Long sessions.** The heap still grows 33-130 KB per minute after 10 minutes of TDM (3.6); the retained sites point at the frame callback, not at game data. A 30-minute soak on a quiet machine would show whether it levels off.
- **HUD and render means at 4x** carry the throttle slices and SwiftShader uploads; their p50 is inside budget. Not measurable headless without them.
- **GPU side** (PERF-003 6 ms, overdraw, shader cost, render scale recovery) is not measurable headless; it needs the live tests on the D1-D4 devices.
