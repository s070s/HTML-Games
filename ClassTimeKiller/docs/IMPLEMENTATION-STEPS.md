# ClassTimeKiller - Implementation Steps (Table of Contents)

Status: plan only, no game code. Companion to `docs/SPECIFICATION.md` (requirements, IDs like `MOV-001`) and `docs/LIVE-TESTS.md` (live tests `LT-C/H/M/L-###`, critical/high/medium/low).

## How to read this plan

- Phases run in dependency order. A step may start only when every step in its "Depends" column is done.
- Every step ends with **done criteria**: new `__CTK` self-test checks are added and pass headless, and the named live-test groups pass by hand on the target devices.
- "Gate" means: the phase is not closed until that gate passes. A failed gate blocks the next phase.
- Spec references use section names and ID ranges (for example `WPN-*` = all weapon requirements). Where the spec lists exact numbers they are given as ranges.
- Live-test references use severity groups for the phase area (for example "LT-C movement" = all critical live tests about movement).
- Target devices for every gate use the LIVE-TESTS device codes: **P** = phones D1 (low-end Android, primary low-spec) and D2 (120 Hz Android), plus D3/D4 (iPhone) from Phase 16 on; **L** = laptops D5 (integrated graphics, Chrome) and D6 (120 Hz, Edge), plus D7 (Firefox); gamepad = D8. A desktop dev PC is reference only, never the only device.
- **Every phase gate also includes the LIVE-TESTS §7 smoke set** (about 20 minutes on D1 and D5, `__CTK.selfTest()` first). A smoke failure blocks the phase.

## Ground rules (apply to every step)

| Rule | What it means |
|---|---|
| One file | Players get one `ClassTimeKiller.html`: plain JS + WebGL2, no libraries, no network requests, works from `file://`. Developers edit `src/` files joined by `node tools/build.mjs` (D01, `ARCHITECTURE.md`). |
| Self-test first | Each feature ships with `__CTK` checks that run headless via `__CTK.selfTest({headless})` (render stub, fixed timestep, seeded random) and return `{total, failed, results[]}` (ARC-030). |
| Data over code | Weapons, presets, modes, mutators, maps, bots are data tables read by generic systems. New content = new rows, not new code paths. |
| Budget every frame | 8.3 ms per frame at 120 Hz, 16.6 ms hard floor (60 fps). Every phase re-measures on P and L. |
| Original names only | No real game, weapon, faction or brand names in code, UI or data. Reference shooters are design inspiration only. |
| Saves | `localStorage` key `ctk.save.v1` (backup `ctk.save.bak`), <= 1 MB, every access in try/catch, game runs if storage fails (PLT-003, ARC-020). |
| Deterministic sim | Fixed 120 Hz simulation tick (MOV-010), seeded PRNG; render interpolates. Needed for self-tests, replays and fair bots. |
| Spec codes in data | Data keys use the spec's backtick code keys (`arena`, `pitcher`, ...) and catalogue codes (W01, G01, A01, PU01, M01, X01, D01, C01, T01, B01, E01, MP01, RS01, MV01, HPP01). |

## Single-file layout (keep the file maintainable)

The built HTML file follows ARC-001: `<style>`, DOM shells (canvas, overlay, fatal screen), then one `'use strict'` script with banner-commented sections in this exact order. Each section is one or more `src/` files (naming and the dependency rule: `ARCHITECTURE.md`).

| # | Section banner | Contents | Prefix |
|---|---|---|---|
| S00 | `STYLE + DOM SHELLS` | CSS for overlay/menus, canvas, overlay root, fatal screen (PLT-002), version string | - |
| S01 | `UTIL / MATH` | constants, vec3/quat/mat4 on Float32Array, pools, event bus, registry helper, error ring (ARC-041) | `util` |
| S02 | `RNG` | seeded generators with separate streams: map gen, loot, bots, rules, cosmetic FX (ARC-012) | `rng` |
| S03 | `DATA CATALOGUES` | all tables: RS, MV, HPP, W, P, G, A, H, PU, I, ECP, M, X, D, BT, T, B, E, C, MP, MD, GN | `CAT_*` |
| S04 | `SETTINGS / SAVE` | `ctk.save.v1` load/save/migrate, backup `ctk.save.bak`, import/export (ARC-020, PLT-007) | `save` |
| S05 | `INPUT` | keyboard+mouse, touch, gamepad, bindings, action map | `inp` |
| S06 | `AUDIO` | Web Audio synth, voice pool, buses | `aud` |
| S07 | `RENDERER` | WebGL2 context, <= 8 programs, chunks, actors, effects, quality presets | `ren` |
| S08 | `WORLD / COLLISION` | brushes, BVH, spatial hash, sweeps, triggers, destructibles (ARC-013) | `world` |
| S09 | `NAV` | nav graph build, A*, path cache (BOT-010, BOT-011) | `nav` |
| S10 | `MOVEMENT` | shared controller and presets (MOV-010) | `mov` |
| S11 | `WEAPONS / PROJECTILES` | weapon state machine, hitscan (ARC-014), projectile pool, damage pipeline | `wpn`, `dmg` |
| S12 | `ABILITIES / ITEMS` | abilities, gadgets, grenades, pickups, powerups | `abl`, `itm` |
| S13 | `RULES / MODES` | ruleset build, modes, mutators, economy, scoring | `rules`, `mode`, `mut`, `eco` |
| S14 | `BOTS` | perception, navigation use, combat, decision, team, ping, personalities | `bot` |
| S15 | `PVE DIRECTOR` | enemy brains, encounters, spawn budgets | `npc`, `dir` |
| S16 | `MAP GEN` | generators GN1..GN5, validation, repair | `gen` |
| S17 | `HUD` | WebGL quad HUD layers (REN-005) | `hud` |
| S18 | `UI` | DOM menus, editors, settings, accessibility screens; progression screens | `ui`, `prg` |
| S19 | `GAME LOOP` | 120 Hz fixed step, max 4 steps per frame, interpolation, pause (ARC-010, PLT-006), perf HUD feed | `loop` |
| S20 | `SELF-TEST` | `__CTK.selfTest`, soak, perf benchmarks, all check blocks grouped by section | `__CTK` |
| S21 | `BOOTSTRAP` | feature checks, WebGL2 fallback screen, start | `boot` |

Naming: `camelCase` functions, `UPPER_SNAKE` constants, data IDs as lowercase strings (`'rifle_auto'`). One global object `CTK` holds the running game; `window.__CTK` exposes the debug and test API only.

## Checkpoints used across phases

| Checkpoint | Limit | Measured where |
|---|---|---|
| File size | Plan targets (the spec sets no HTML size limit; saves <= 1 MB per ARC-020): Phase 0 < 60 KB · Slice (M1) < 400 KB · Phase 10 < 1.2 MB · M3 < 2.0 MB · Release <= 3.5 MB uncompressed (D07: the release target is 3.5 MB; `tools/build.mjs` warns above 3.0 MB and fails above 3.5 MB), readable code, no minifier (the build leaves out comment-only lines, D06) | `tools/build.mjs` size line + file system |
| Frame time | p95 <= 8.3 ms and p99 <= 12 ms on L and P at the phase's test scene; never a frame > 16.6 ms in a 60 s steady scene | perf HUD + `__CTK.perf.run(scene, seconds)` |
| Sim tick cost | p95 <= 2.0 ms (PERF-002: movement 0.5, AI 1.0, projectiles 0.3, rules 0.2) at the preset's bot cap (PERF-009) | `__CTK.perf.sim()` headless |
| GPU / draw calls | GPU <= 6.0 ms (PERF-003); draw calls and triangles per preset Ultra..Potato (PERF-004); <= 8 shader programs (PERF-005) | perf HUD (PERF-012) |
| Load time | cold start to menu < 2 s on P, < 1 s on L (no network, no assets) | perf HUD boot timer |
| Memory / GC | zero steady-state allocation in sim and render loops, GC pause <= 2 ms, JS heap <= 150 MB, GPU memory <= 64 MB (Potato 32 MB) (PERF-005, PERF-006) | `__CTK.perf.alloc()` + DevTools |
| Self-test run | full headless suite < 60 s on L; soak via `__CTK.soak` (ARC-033); micro-benchmarks via `__CTK.perf` (ARC-034) | `__CTK.selfTest({headless:true})` |

## Milestones

| ID | Name | Closes after | Meaning |
|---|---|---|---|
| M0 | Skeleton | 0.6 | Empty game boots from `file://`, harness runs, perf HUD shows frame time on P and L. |
| M1 | Vertical slice | 6.8 | One map, one movement preset, 5 weapons, deathmatch vs 3 bots, playable on P (touch) and L (keyboard+mouse) at 120 fps target, 60 fps floor. |
| M2 | Core game | 11.6 | All versus modes (PvE modes follow in Phase 14), full item/gadget/ability set, bots with personalities and difficulty. |
| M3 | Content complete | 15.8 | Custom match editor, procedural maps, PvE, single-player structures and progression. |
| M4 | Feature complete | 17.5 | Full HUD/UI/menus, accessibility, audio. |
| M5 | Release candidate | 19.6 | Performance pass and full regression + live-test sweep green. |
| M6 | Release | 20.5 | Shipped single HTML file, tagged. |

---

## Phase 0 - Skeleton, self-test harness, perf HUD

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 0.1 | File skeleton with section banners S00-S21 | ARC-001, PLT-001, PLT-002 | - | `ClassTimeKiller.html` with empty sections, version string, CSP meta `default-src none; script-src unsafe-inline; style-src unsafe-inline; img-src data: blob:; media-src data: blob:` (keywords quoted in the real tag; inline code allowed, all network blocked), fatal screen and WebGL2-missing screen | Opens from `file://` in Chrome, Firefox, Safari with zero console errors; DevTools Network tab shows no requests | Safari WebGL2 quirks: test early on a real iPhone |
| 0.2 | Core utilities: math, seeded RNG streams, typed-array pools, event bus, registry | ARC-011, ARC-012, ARC-015, DATA-001..DATA-005 | 0.1 | `core*` helpers, units fixed (1 unit = 1 m, seconds, degrees in data / radians in code) | Self-tests: PRNG same seed same sequence; vector/matrix identities; pool reuse does not allocate | Units drift later: freeze them here (DATA) |
| 0.3 | `__CTK` harness | ARC-030, ARC-031, ARC-040, ARC-041 | 0.2 | `window.__CTK = {selfTest, soak, perf, game, world, rules, catalogues, spawnBot, setTier, step(n)}` plus `version`; `check(name, ok, detail)` in grouped blocks that catch throws; Help > Run self-test; data validation of every catalogue | `__CTK.selfTest({headless:true})` returns `{total, failed, results[]}`; a deliberately failing check is reported, not thrown; global error ring works | Harness must never run by default; flag-gated |
| 0.4 | Fixed-step main loop + frame pacing | PERF-001, PERF-002, ARC-010, PLT-006, REN-006 | 0.2 | `requestAnimationFrame` loop, fixed sim tick with accumulator and clamp, render interpolation, pause on hidden tab | Self-test: 1000 sim steps give identical state from same seed; never more than 4 steps per frame (ARC-010); sim stops fully on blur/hidden/pointer-lock loss (PLT-006) | Spiral of death on slow phones: clamp + drop |
| 0.5 | Perf HUD | PERF-012, ARC-040, UI (debug overlay) | 0.4 | Toggle overlay: fps, frame ms (avg/p95/p99 over 2 s), sim ms, render ms, draw calls, triangles, heap if available, refresh-rate guess | Numbers update live; `__CTK.perf.run()` returns the same stats headless | `performance.now()` is coarsened on some browsers: average over windows |
| 0.6 | Save layer v1 | PLT-003, PLT-007, ARC-020, ARC-021 | 0.2 | `save.load/save/migrate` on `ctk.save.v1`, defaults, corrupt save backed up to `ctk.save.bak` with notice, text export/import | Self-tests: round-trip, corrupt JSON returns defaults, storage throwing (private mode) does not crash | **Gate M0:** LT-C platform/boot pass on P and L; file < 60 KB |

## Phase 1 - Renderer core and budgets

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 1.1 | WebGL2 context, resize, DPR control, context-loss recovery | REN-001, PLT-002, PLT-005 | 0.4 | Canvas setup, internal resolution scale (0.5-1.0), `webglcontextlost/restored` handlers | Forced context loss (`WEBGL_lose_context`) recovers without reload | iOS memory kills: keep GPU memory small |
| 1.2 | Shader library + procedural materials | REN-003 (<= 8 programs), PERF-005, REN (procedural visuals) | 1.1 | One uber-shader with defines (flat, vertex colour, triplanar noise, emissive), compile cache | All variants compile on P and L; total compile < 300 ms at boot | Mobile GLSL precision: `mediump` where safe |
| 1.3 | Mesh builder + static batching | REN-001, PERF-004 | 1.2 | Procedural brush builders (AABB, ramp, wedge, low-poly cylinder), static world merged per 16 m chunk per material, chunk frustum culling | Test map in <= 30 draw calls | Over-merging kills culling: merge per sector |
| 1.4 | Camera, FOV, view-model layer | REN (camera), INP (FOV) | 1.3 | First-person camera, separate weapon view-model pass with own FOV | FOV 60-120 works; view model never clips into walls | Motion sickness: FOV, head-bob options (ACC) |
| 1.5 | Lighting, shadows and fog on a budget | REN-004, PERF-010 | 1.3 | Baked vertex lighting + 1 directional light + capped dynamic point lights (muzzle, explosions), distance fog | Light cap per quality tier; shading cost measured | Too many dynamic lights on phones: hard cap |
| 1.6 | Culling and quality tiers | REN-008, PERF-003, PERF-004, PERF-007, PERF-008, PERF-010, PERF-013 | 1.3, 0.5 | Sector/grid frustum culling, presets Potato/Low/Medium/High/Ultra picked by a 3 s first-run benchmark, dynamic resolution 0.5-1.0 with hysteresis, auto step-down after 5 s under 60 fps | Test scene on P: p95 <= 8.3 ms at the auto preset; dynamic resolution lowers scale within 0.5 s of overload and raises after 2 s | **Gate:** frame-time checkpoint on P and L; LT-C rendering pass |
| 1.7 | Effects pool: decals, particles, tracers | REN-003 (particle program), PERF-006, PERF-010 | 1.3 | Pooled particle buffer, decal ring buffer, tracer lines, caps per preset | Preset caps (particles 4096..256, decals 128..0) hold budget on P and L | Overdraw on phones: small particles, few layers |
| 1.8 | Procedural actors | REN-002, REN-003 | 1.3 | Rigid-part humanoids (boxes/capsules) animated by code, instanced per archetype, 2 LODs, optional outline shell, blob shadow (MIS-037) | 24 actors + 40 enemies drawn within the preset draw-call cap | Animation cost on CPU: update far LOD at low rate |

## Phase 2 - Input on all three devices

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 2.1 | Action map + binding layer | INP-001..INP-010 (actions, defaults INP-003) | 0.2 | Device-independent actions (move, look, fire, alt-fire, jump, crouch, sprint, slide, reload, use, swap, gadget, ability, ping, scoreboard, menu) in one DATA table | Self-test: synthetic events map to actions; rebinding saved and reloaded | Action list grows: one table only |
| 2.2 | Keyboard + mouse | INP (KBM, raw look, sensitivity) | 2.1 | Pointer lock, raw mouse delta, sensitivity (multiplier and cm/360), invert, ADS multiplier | Look is 1:1, no acceleration; pointer-lock exit/enter handled | Pointer lock needs a user gesture |
| 2.3 | Touch controls | INP-004, INP-005, INP-006, ACC-004 | 2.1, 0.5, 2.6 (layout editor needs the UI shell) | Floating left stick, right look zone, buttons (fire, jump, crouch, reload, ability), optional auto-fire, gyro aim if available | Playable on P; layout editor moves/resizes buttons and saves | Multi-touch ID mix-ups: test 3+ fingers |
| 2.4 | Gamepad | INP-007, INP-008 (aim assist touch/gamepad only, never mouse) | 2.1 | Standard mapping, inner/outer deadzone, response curve, tunable aim slowdown/magnetism with off option | Xbox-style and PlayStation-style pads work in Chrome and Firefox | Aim-assist strength vs bots: tune per difficulty |
| 2.5 | Input latency check | INP-009, PERF-001 | 2.2-2.4, 0.5 | Input sampled at frame start, applied to camera before render | Click-to-muzzle-flash <= 1 frame + display | **Gate:** LT-C and LT-H input pass on all three devices |
| 2.6 | UI shell (DOM overlay) | UI (framework), INP | 2.1 | Menu stack, focus handling for keyboard, gamepad and touch, pause menu, toast messages; used by every later screen | Self-test: open/close every registered screen; each device alone can navigate the debug menu | Built early so editors (12.3, 12.5) and settings never need a second UI system |

## Phase 3 - Player movement presets

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 3.1 | Movement controller core (flat test plane) | MOV-010..MOV-016, MOV-026, DATA (preset schema) | 2.1, 0.4 | Shared ground/air formulas (one projection rule gives strafe-jumping), jump buffer 0.10 s, landing lock, fall damage, crouch noise; all numbers from preset rows | MOV-026 self-test per preset: jump apex within 2%, ground speed within 1%; identical result at 30/60/120/144 Hz render | Tick-rate dependence: sim only at the 120 Hz tick |
| 3.2 | MV01 `arena` (slice preset) | MV01, MOV-012, MOV-013, MOV-017, MOV-018 | 3.1 | Strafe-jump, rocket-jump knockback, dodge double-tap, air-control assist for touch/gamepad | Self-test: strafe gain present; assist adds airAccel +2 when on | Strafe-jump skill wall on touch: assist default on (MOV-018) |
| 3.3 | MV02 `tactical` | MV02, MOV-025 | 3.1 | Walk, crouch, counter-strafe stop, bhopCap 1.2, movement-inaccuracy values | Self-test: spread adds by speed fraction exactly as MOV-025 | - |
| 3.4 | MV03 `modern` + sprint rules | MV03, MOV-021, MOV-022 | 3.1, 4.1 (mantle needs the collision world) | Stamina sprint, tactical sprint, slide, mantle, optional prone, sprintToFire delay | Self-tests: slide 0.7 s, cooldown 0.6 s; fire blocked for sprintToFire | Slide-cancel exploits: rule flags |
| 3.5 | MV04 `agile` + MV08 `parkour` | MV04, MV08, MOV-023, MOV-024 | 3.4, 4.1, 4.3 (wall-run needs collision and ray queries) | Double jump, wall-run (angle and speed rules), slide-hop, wall latch, refill on first grounded step | Self-test per mechanic on test geometry | Wall detection on generated maps (Phase 13) |
| 3.6 | MV05 `ravager`, MV06 `knight`, MV07 `vanguard`, hero per-hero moves, MOV-027 Skimmer | MV05..MV07, MOV-019, MOV-020, MOV-027 | 3.2-3.5, 4.5 (water, ladders, teleporters) | Air dash charges, shield charge, floaty no-sprint, water/ladder/telefrag rules, optional hoverboard | All presets pass MOV-026 self-tests | **Gate:** LT-C movement (MV01) on P and L; LT-H movement for MV01..MV08 |
| 3.7 | Rule bundles RS01..RS12 + build order | MOV-001, MOV-002, RS01..RS12 | 3.6, 0.6 | Ruleset built in order mode -> bundle/presets -> mutators -> difficulty -> handicap, then frozen; save up to 50 custom rulesets | Self-test: every bundle builds and freezes; order change is detected | Fields from later phases (economy, meter) are stubs until 10.x; stub list checked in 12.4 |

## Phase 4 - Collision and physics

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 4.1 | Collision world | ARC-013, MAP-001 (brush types) | 1.3, 3.1 | Static world as convex boxes/ramps in a uniform grid or BVH; capsule vs world sweep | Self-tests: no tunnelling at max speed; step-up height; slope limit | Fast dash tunnelling: swept tests, sub-steps |
| 4.2 | Character collide-and-slide | MOV (step, slope, crouch) | 4.1 | Slide along walls, step stairs, crouch under ceilings, stand-up check | Self-test: 10 000 random moves never end inside geometry | Corner snagging: depenetration pass |
| 4.3 | Ray and shape queries | ARC-014, WPN-002, BOT-091 (ray budget) | 4.1 | Ray, sphere and cone queries vs world and actor hitboxes (head/body/limbs) | Self-test: query cost < 5 µs median; hitbox zones return correct multiplier keys | Query count explodes with bots: budget per tick |
| 4.4 | Simple rigid bodies and destructibles | MAP-013, PERF-010, GAD (thrown items) | 4.1 | 6-20 sphere/box bodies, fixed step, sleep after 1 s, impulse by mass, impact damage clamped | Self-test: bodies come to rest; no explosion of energy | Stacking jitter: no stacking, no joints |
| 4.5 | Jump pads, teleporters, ladders, water, hazards | MOV-019, MOV-020, MAP (entities) | 4.2 | Trigger volumes with data-driven effects | Self-test per trigger type | **Gate:** LT-C and LT-H movement + collision pass on P and L |

## Phase 5 - Weapons framework, then the catalogue in batches

Batches add data rows only. If a batch needs new code, that code goes into the framework step first (5.1-5.4) with its own self-test.

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 5.1 | Weapon data schema + state machine | WPN-001, WPN-010, DATA (weapon + projectile schema) | 4.3, 2.1 | Idle/fire/cooldown/reload/swap/ADS states; fire modes (semi, auto, burst, charge, beam, spin-up) from data | Self-test: rounds-per-minute exact over 10 s; reload interrupt rules; swap times | Edge cases: reload during swap, fire on empty |
| 5.2 | Hitscan + projectile core | WPN-002, WPN-005, projectiles P01..P16, DATA (projectile schema) | 5.1, 4.3 | Hitscan with spread/recoil/penetration hooks; pooled projectiles (speed, gravity, bounce, splash, homing) | Self-tests: falloff curve, splash radius/self-damage scale, projectile tunnelling | Many projectiles: pool cap + oldest-first recycle |
| 5.3 | Spread, recoil, ADS, first-shot accuracy | WPN-003, WPN-004, MOV-025 | 5.2, 3.3 | Pattern recoil (fixed + random), movement/air inaccuracy multipliers, ADS zoom + sensitivity scaling | Self-test: seeded spray pattern is identical across runs | Recoil readability on touch: auto-compensation option |
| 5.4 | Alt-fire modes, rarity and weapon modifiers | WPN-001, WPN-008, WPN-011 | 5.3 | Secondary mode per weapon, attachment slots that modify stat rows | Self-test: stats with attachments = base + modifier table | Stat explosion: modifiers are additive/multiplicative only |
| 5.5 | Slice batch: 5 weapons | W04 `warden`, W19 `scattergun`, W23 `lancet`, W31 `ramjet`, W36 `ember` (all in `arenaSet`) | 5.1-5.3 | Sidearm, shotgun, rail, rocket launcher, energy repeater with primary + alt fire | Each weapon has damage/time-to-kill self-test vs base health | **Feeds M1** |
| 5.6 | Catalogue batch A: arena, ravager, knight weapons | rest of `arenaSet`, `ravagerSet`, `knightSet` (WPN-006) incl. melee W01..W03 | 5.4, 5.5 | All rows of those sets with alt-fires | TTK table self-test; each alt-fire works | Balance: TTK band per family set in spec |
| 5.7 | Catalogue batch B: tactical, military, sandbox weapons | rest of `tacticalSet`, `militarySet`, `sandboxSet` (WPN-006) | 5.4 | Rifles, SMGs, LMGs, DMRs, snipers, pistols, knives with penetration and recoil patterns | TTK and penetration self-tests | Over-similar guns: each must differ in one key stat |
| 5.8 | Catalogue batch C: exotic, tools, power weapons | `exoticSet`, tools W41 `lifter` + W42 `twingate`, power W45-W46, all remaining W01..W46 rows | 5.4, 4.4 | Exotic fire modes, gravity tool (needs 4.4 props), paired-gate tool, power weapons | Self-test: every W01..W46 row is in exactly one batch and passes its behaviour check | Twin-gate tool needs view-through-gate rendering and teleport collision: budget it in 1.6, cut to plain teleport if over budget (log in spec Open questions) |
| 5.9 | Weapon sets, ammo tiers, respawn, wheel and slots | WPN-006, WPN-007, WPN-009, INP (wheel) | 5.6-5.8 | Melee lunge/parry hook, slot rules per mode (2-weapon carry vs full arsenal) | Self-test: carry limits enforced per rule preset | **Gate:** LT-C weapons on P and L; LT-H weapons for batches done |

## Phase 6 - Health presets, damage, and the vertical slice

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 6.1 | Health / armor / shield presets | HPP01..HPP09, HP-005, HP-006, HP-007 | 5.2 | Stack, regen, shield, tactical, hero, loot, ravager, suit, limb presets; status effects table; elements; downed state | Self-tests: damage order shield -> armor -> health; regen delay exact | Mixing presets per mode: one active preset per match; HPP08 uses an A01 stub until 10.7 |
| 6.2 | Damage pipeline | HP-001..HP-004, ARC-015, ARC-032 (damage cases per preset), MUT hooks | 6.1 | One `applyDamage(source, target, info)` path: hit zone, falloff, armor, mutator scale, events | Self-test: every damage source goes through one function (count check) | Side paths bypass armor: grep check in self-test |
| 6.3 | Death, respawn, spawn protection, kill feed events | HP-003, HP-004, MOV-020, MAP-010, MAP-011 | 6.2 | Death state, respawn timer, spawn selection scoring (distance from enemies, line of sight), short spawn protection | Self-test: never spawn in enemy line of sight when an alternative exists | Spawn killing (known mistake) |
| 6.4 | Slice map (hand-made) | MAP (data format, one hand-made arena) | 4.5 | One small arena map as data: geometry, spawns, item spots, hand-placed nav nodes | Loads in < 200 ms on P; 30 draw calls or fewer | Becomes the regression map for all later phases |
| 6.5 | Slice bot (minimal; bots come early on purpose, MIS-042) | BOT-001 (same input struct as player), subset of BOT-003, BOT-006, BOT-011, BOT-030, BOT-040 | 6.4, 5.5 | Bot sees (view cone + ray), walks the hand nav graph, aims with reaction delay and error, shoots | Self-test: 3 bots + player 5 min headless, no stuck bot > 5 s | Minimal bot must be the real layer code, not a throwaway |
| 6.6 | Slice deathmatch + minimal HUD | M01 `ffa`, MODE-001, MODE-002, UI (crosshair, health, ammo, score) | 6.3, 6.5 | Free-for-all to frag/time limit, results screen, crosshair, health/ammo, kill feed | Self-test: match ends at limit; score is correct | - |
| 6.7 | Slice sound (placeholder synth) | AUD (minimum) | 6.6 | Gunshot, hit, footstep, death blips via Web Audio | Audio starts after first user gesture | Autoplay policy: unlock on first input |
| 6.8 | **Milestone M1 - vertical slice** | VIS (pillars check), PERF-*, PLT-* | 6.4-6.7 | Deathmatch vs 3 bots, arena preset, 5 weapons, on P (touch) and L (keyboard+mouse), gamepad on L | P and L: p95 <= 8.3 ms, never > 16.6 ms in 60 s; file < 400 KB; full `__CTK.selfTest()` green | **Gate M1:** all LT-C tests for boot, input, movement, weapons, damage, slice deathmatch pass on P and L. Fail = fix before Phase 7 |

## Phase 7 - Maps as data + navigation graph

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 7.1 | Final map data schema | MAP-001, DATA | 6.4 | Pieces, sectors, spawns per team/mode, item spots, objective spots, lights, theme, version field | Self-test: schema validator rejects bad maps with clear messages | Schema changes later break saved custom maps: version + migrate |
| 7.2 | Automatic nav graph | BOT-010 | 7.1, 4.2 | Build walkable nodes/links from geometry at load (walk, jump, drop, ladder, jump-pad, teleport links) | Self-test: every spawn reaches every item and objective; build < 300 ms on P | Weak bot navigation (CS mistake): validate links by simulated walks |
| 7.3 | Hand-made map set | MAP-002..MAP-005, MP01..MP08, MP10, MP12 | 7.1 | All hand-made maps in the spec as data (arena, tactical, large, PvE spaces) | Each map: validator + reachability + draw-call and frame-time check | Small dark campable maps (CoD mistake): sightline review |
| 7.4 | Map themes and procedural decoration | MAP-022 (6 tilesets), REN-003 | 7.3, 1.2 | Theme palettes, trim, props placed by rule | Theme swap never changes collision | - |
| 7.5 | Map tactical metadata | MAP-012 (callouts), BOT-020 inputs | 7.2 | Cover points, sniper spots, choke points, callout names per zone | Self-test: each map has callouts for every sector | **Gate:** LT-C and LT-H maps pass on P and L; frame-time checkpoint on the largest map |

## Phase 8 - Bot AI layers

Order is fixed: each layer only uses the layers above it in this table.

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 8.1 | Perception | BOT-003..BOT-007, BOT-040, BOT-042 | 6.5, 7.2 | View cone, line-of-sight rays (budgeted per tick), sound events heard by distance, short memory of last seen positions | Self-test: bot behind wall does not see; hears gunfire within radius | Ray cost: round-robin bots per tick |
| 8.2 | Navigation | BOT-011..BOT-013 | 8.1, 7.2 | A* on nav graph with cached paths, steering, stuck detection and recovery, use of jumps/pads/teleports, preset-aware moves (slide, wall-run) | Self-test: 16 bots on every map 10 min, stuck < 1% of time | Movement presets change reachability: per-preset link flags |
| 8.3 | Combat | BOT-030..BOT-036, MIS-002, MIS-004 | 8.2, 5.9 | Aim model (reaction time, tracking error, recoil control), weapon choice by range and ammo, strafing/dodging, grenade use | Self-test: accuracy per difficulty within target band vs a moving dummy | Aimbot feel: always human-like error |
| 8.4 | Decision | BOT-002, BOT-020, BOT-021, BOT-041, BOT-080 | 8.3 | Utility AI: fight, retreat, get health/armor/weapons, objectives, hunt, camp limits | Self-test: low-health bot picks health when reachable | Oscillation: hysteresis on goals |
| 8.5 | Team play and ping | BOT-050..BOT-053, BOT-060..BOT-062, BOT-071, BOT-100 | 8.4 | Roles (attack, defend, escort, roam), squad orders from player, ping wheel (enemy, go here, item) both ways | Self-test: bots respond to "defend here" ping within 2 s | - |
| 8.6 | Personalities and difficulty | BOT-070, traits T01..T16, tiers BT0..BT7, DIF-001..DIF-004, D01..D10 | 8.5 | Personality rows (aggressive, careful, sniper, rusher, support), difficulty tiers + adaptive option, bot names (original) | Self-test: kill rate per tier within spec bands in headless 1v1 runs | Too easy/too hard bots (Fortnite mistake): tune with headless matches |
| 8.7 | Bot budget + debug view | PERF-009, PERF-011, BOT-090..BOT-092 | 8.1-8.6 | AI tick spread, level-of-detail thinking for far bots | 15 bots: sim p95 <= 2 ms on P | **Gate:** LT-C and LT-H bots pass on P and L |

## Phase 9 - Core game modes

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 9.1 | Mode framework | MODE-001..MODE-004 | 6.6, 8.4 | Mode = data + small rule hooks; round system, overtime, team assignment, balance | Self-test: every mode row validates; round/overtime transitions | Rule hooks multiply: max few hook points |
| 9.2 | Team deathmatch and duel | M02 `tdm`, M03 `duel`, X21 `ff` | 9.1 | Team scoring, team colours, friendly-fire option, 1v1 duel rules | Self-test: score and win | - |
| 9.3 | Capture the flag | M04 `ctf`, M05 `oneflag` | 9.1, 8.5 | Flags, return/capture rules, bot roles for CTF | Headless 4v4 bot match captures both ways | Bots must carry and escort |
| 9.4 | Control-point modes | M06 `dom`, M07 `conquest`, M09 `hardpoint`, M12 `control` | 9.1, 8.5 | Point capture timer, ticket or score drain | Headless bot match contests all points | - |
| 9.5 | Round-based bomb mode | M13 `bomb`, ECO (round economy hook) | 9.1, 8.5 | Plant/defuse, round win rules, side switch | Headless rounds finish with all win conditions seen | Economy arrives in 10.5 |
| 9.6 | Scoreboard and match results | MODE-003, UI-010 | 9.2-9.5 | Scoreboard per mode, results with stats | **Gate:** LT-C and LT-H for core modes pass on P and L | Missing scoreboard (BF2042 mistake) |

## Phase 10 - Items: powerups, pickups, gadgets, abilities, economy

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 10.1 | Pickup framework | PWR-001, items I01..I17, WPN-009 | 6.1, 7.1 | Item spots from map data, respawn timers, pickup rules per preset (stack, cap, overheal decay) | Self-test: respawn time exact; caps enforced | Timer readability: optional item timers HUD (ACC) |
| 10.2 | Powerups | PU01..PU20, PWR-002, PWR-003 | 10.1, 6.2 | Timed powerup effects as stacked modifiers with clear visuals/sounds | Self-test: modifiers apply and expire exactly; no permanent leak after death | Modifier leak after death or mode end |
| 10.3 | Grenades and throwables | GAD-001, GAD-002, thrown rows of G01..G24, REN-007 (smoke grid) | 4.4, 6.2 | Throw arcs with preview option, cook timer, effects (blind, smoke volume blocks bot sight) | Self-test: smoke blocks perception rays; flash scales with angle | Smoke + bots: perception must respect volumes |
| 10.4 | Gadgets and deployables | GAD-003, placed rows of G01..G24 | 10.3, 8.1 | Deployables as small actors with health and owner | Self-test: per-player caps; cleanup on death/mode end | Camping with mines (MW2019 mistake): caps + visible tells |
| 10.5 | Economy presets, loadouts and meters | ECO-001..ECO-003, ECP01..ECP07 | 9.5, 5.9 | Buy menu, round money rules (one documented loss-bonus rule), custom loadouts saved | Self-test: money after win/loss sequence matches spec table | Unclear economy (CS mistake): show next-round money in HUD |
| 10.6 | Abilities framework + hero kits | ABL-001, ABL-002, ABL-003, heroes H01..H08 | 6.2, 2.1 | Ability slots, cooldown/charge/meter rules, cast states, interrupt rules | Self-test: cooldowns and meter gain exact | Too many systems at once: one framework, data rows |
| 10.7 | Ability catalogue in batches | A01..A40, ABL-004, ABL-005 | 10.6, 8.3 | Abilities as data + small effect functions; bot usage hints per ability | Self-test per ability; bots use each at least once in headless runs | Blink-style power too strong (Dishonored mistake): balance flags |
| 10.8 | Item budget check | PERF | 10.1-10.7 | Worst-case scene: 16 actors with abilities, gadgets and powerups | **Gate:** frame-time checkpoint on P and L; file < 1.2 MB; LT-C and LT-H items/gadgets/abilities pass | - |

## Phase 11 - More game modes

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 11.1 | Elimination and last-man-standing | M14 `elim`, M15 `lms`, X32 `lives` | 9.1 | Rounds without respawn, lives option | Headless bot rounds finish | - |
| 11.2 | Objective modes: assault, payload, relic | M08 `rush`, M10 `oddball`, M11 `payload` | 9.4, 8.5 | Moving objective, attack/defend sides | Bots push and defend in headless runs | Payload path on generated maps (Phase 13) |
| 11.3 | Weapon-rotation and party modes | M16 `gungame`, M25 `roulette`, M24 `bearer` | 9.2, 5.9 | Weapon ladder, special rule packs | Self-test: ladder advance and demote | - |
| 11.4 | Asymmetric and hunted modes | M17 `infection`, M18 `juggernaut`, M19 `cursetag`, M27 `ghostops` | 9.2, 10.6 | Team switch on death, special class stats | Headless match ends with a winner | - |
| 11.5 | Shrinking-ring survival | M20 `royale`, HPP06 `loot`, RS10 | 10.1, 7.3 | Shrinking ring, loot spots, rarity (WPN-008), bot count within PERF-009 | Frame-time on P with full count | MP09 `isle` comes from GN5 (13.1): test on a hand-built 300 m placeholder now, re-gate on MP09 in 13.4 |
| 11.6 | Mode menu + **Milestone M2** | MODE-001..MODE-004, all versus modes of M01..M30 (PvE modes follow in 14.3-14.4), UI (mode select) | 11.1-11.5, 10.8 | Every versus mode selectable with defaults | **Gate M2:** every versus mode has a headless bot match green; LT-C-024 (every mode starts) for those modes; LT-C and LT-H for all modes pass on P and L | Mode churn (Apex/Overwatch mistake): no mode ships unfinished |

## Phase 12 - Mutators and custom match editor

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 12.1 | Mutator framework | MUT-002, MUT-003 | 6.2, 9.1 | Mutators as modifier sets on rule, movement, health, weapon and item tables; conflict list | Self-test: every pair of mutators either stacks or is refused with a message | Combination explosion: conflict table + random sample tests |
| 12.2 | Mutator catalogue | X01..X50 | 12.1 | All spec mutators as data | Self-test per mutator; random 3-mutator combos 200 runs without errors | - |
| 12.3 | Custom match editor | MUT-001, MUT-004, MOV-002 | 12.2, 11.6, 2.6 | Pick mode, map, movement preset, health preset, weapons allowed, items, bots (count, team, personality, difficulty), limits, mutators | Saved/loaded custom presets; share as text code (copy/paste, no network) | Share code size: compress + version |
| 12.4 | Rule bundles in the editor | RS01..RS12, MOV-001 | 12.3, 3.7 | All 12 rule bundles selectable as one-click starts; stubs from 3.7 replaced by real fields | Each pack loads and plays headless | **Gate:** LT-C and LT-H mutators/custom match pass |
| 12.5 | Forge-lite map editor | MAP-014 | 12.3, 7.2, 2.6 | Grid placement of brushes, spawns, item pads, objectives; object budget 400; saved locally; nav graph rebuilt on save | Self-test: edited map passes the 7.1 validator and 7.2 reachability; over-budget placement refused | Touch editing is fiddly: snap grid + large handles |

## Phase 13 - Procedural map generator

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 13.1 | Generators GN1..GN5 (seeded) | MAP-020, MAP-021, MAP-022, MP09 | 7.1, 7.2 | Tile Chain, Lanes and Sites, Mirror Arena, Vertical Towers, Island; output in the same map data format | Self-test: same seed -> byte-identical map; generation < 500 ms on P | Generator outputs unplayable maps: validate everything |
| 13.2 | Validation and repair | MAP-023, MAP-002..MAP-005, MAP-010, BOT-010 | 13.1 | Reachability, spawn fairness (team distance balance), sightline limits, stuck spots fixed or seed rejected | Self-test: 1000 seeds, every accepted map passes validator | Rejection loops: retry seed+1 up to 5 times, then fallback (MAP-023) |
| 13.3 | Mode-aware placement | MAP (mode spots), MODE | 13.2, 11.6 | Flags, points, bomb sites, payload paths, item spots placed per mode | Headless bot match on 50 random seeds per mode | - |
| 13.4 | Generator settings UI + seed share | MAP-021, PRG-006 (daily seed input), UI | 13.3, 12.3 | Size, style, theme, density, seed field | **Gate:** frame-time checkpoint on 20 largest generated seeds on P; LT-C and LT-H generator pass | Large maps blow budget: size cap per quality tier |

## Phase 14 - PvE enemies, horde and challenge modes

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 14.1 | PvE enemy framework | NPC-001..NPC-008, MIS-014, MIS-026 | 8.2, 6.2 | Enemy archetypes as data reusing bot perception and navigation | Self-test: each archetype attacks and dies | - |
| 14.2 | Enemy catalogue | E01..E12, E14 | 14.1 | All spec enemies, procedural shapes, readable tells | Self-test per enemy; parry-able attacks marked by colour if in spec | Hard-counter enemies that gate flow (Doom mistake): always 2+ answers |
| 14.3 | Horde, endless and PvE team modes | M21 `horde`, M22 `endless`, M23 `bank`, M26 `fiends`, M29 `attrition`, NPC (spawning) | 14.2, 9.1 | Waves, scaling, between-wave shop or upgrades | Headless 10 waves finish; enemy count stays within budget | Large hordes on phones: cap + instanced rendering |
| 14.4 | Stealth, range and puzzle chambers | M28 `contract`, M30 `range`, MP11 chambers, MAP-030, W42 `twingate`, BOT-005 | 14.3, 5.8 | Stealth contract on MP12, firing range with fire-back dummies, 12 puzzle chambers with bronze/silver/gold par | Self-test: par thresholds from data; every chamber solvable by a scripted run | - |
| 14.5 | Boss encounters | E13 `overlord`, NPC-002, NPC-006 | 14.2 | Multi-phase bosses with clear hit boxes | **Gate:** frame-time with max enemies on P; LT-C and LT-H PvE pass | Unclear boss hit boxes (Painkiller mistake) |

## Phase 15 - Single-player structures and progression

No story campaign (spec section 25). Structures are built from modes, maps and rulesets that already exist.

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 15.1 | Profile, XP and unlocks | PRG-010, PRG-011, PRG-012, ECO-002, ARC-020 | 0.6, 12.3 | XP from score/objectives/medals, levels 1-50, unlock tables (sidegrades and cosmetics only), "Unlock everything" option | Self-test: every unlock reachable by level 30 or one named challenge; no unlock changes a stat; old save migrates | Grind (MIS-012): unlock pace checked by a headless XP simulation |
| 15.2 | Quick Match, Custom entry, Range first | PRG-001, PRG-002, PRG-005, PRG-008, UI-001 | 15.1, 14.4 | One-tap Quick Match with last settings and Shuffle; Horde and Puzzle Chambers menu entries; Firing Range offered first to new players | Quick Match starts in <= 2 actions (LT-C-034) | Onboarding overload (MIS-029) |
| 15.3 | Tournament Ladder | PRG-003, bots B01..B24, BT0..BT7 | 15.1, 11.6 | 8 tiers of 3-4 matches, named bot roster, final duel vs B24 | Ladder completes start to end in a headless run | - |
| 15.4 | Challenge Rooms and Operations | PRG-004, PRG-007 | 15.1, 14.4 | 20 trials with 1-3 stars and Expert versions; 3-map Operations with ticket carry-over and comeback bonus | Self-test: star thresholds from data; ticket carry-over math | Long restarts kill flow (MIS-033): instant retry |
| 15.5 | Daily Seed | PRG-006, MAP-020 | 13.4 | Date-based seed picks generator, mode, ruleset and 2 mutators; local best history | Self-test: same date gives same match setup; time zone pinned in tests | No streak penalties (PRG-012) |
| 15.6 | Medals, stats and mastery | PRG-013 (MD01..MD20), PRG-014, UI-012 | 15.1, 9.6 | All 20 medals with banner + sting, per weapon/mode/map stats, weapon mastery colours | Self-test: each medal fires on a scripted event and only then | Double-award edge cases (multi + spree on one kill) |
| 15.7 | Cards (run modifiers) | C01..C24, X48 `cards`, MIS-035 | 15.1, 12.1 | 24 cards, single simple unlock conditions, equip rules | Self-test per card | Tedious unlock tasks (MIS-035) |
| 15.8 | **Milestone M3 - content complete** | VIS-004 (catalogue counts) | 12.5, 13.4, 14.5, 15.1-15.7 | Every catalogue row of the spec implemented | **Gate M3:** `__CTK.selfTest()` green incl. catalogue counts of VIS-004; file-size checkpoint; frame-time checkpoints on P and L; LT-C and LT-H for Phases 12-15 pass | Scope creep: anything new goes into the spec first |

## Phase 16 - HUD, UI, menus, accessibility

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 16.1 | UI framework completion | UI-001, UI-002, UI-015 | 2.6 | Main menu layout of UI-001, pause menu of UI-002, transitions, back-button rules, safe-area insets | Every screen opens in < 1 s and is reachable and leavable with each device alone | Gamepad focus traps |
| 16.2 | Full HUD | UI-003, UI-005, UI-006, UI-013, UI-014, REN-005 | 16.1, 11.6, 10.8 | All HUD elements as batched WebGL quads (one draw call per layer), toggles, scale 50-150%, opacity | Self-test: each element can be hidden; HUD <= 0.4 ms (PERF-002) | HUD cost on phones: no DOM HUD |
| 16.3 | Crosshair editor, FOV and view settings | UI-004, UI-016 | 16.2 | Crosshair styles, per-weapon override, scope overlays; FOV 60-120 (default 90 desktop, 80 phone), viewmodel FOV/offset, bob and shake | Settings round-trip and apply instantly (ARC-021) | - |
| 16.4 | Scoreboard, killcam-lite, announcer banners | UI-010, UI-011, UI-012 | 16.2, 9.6 | Full scoreboard with per-weapon accuracy, 2 s killcam from a 20 Hz transform ring buffer (skippable, option off), announcer banners | Self-test: ring buffer has no per-frame allocation; killcam skips cleanly | Ring buffer memory: fixed size per actor |
| 16.5 | Settings screens and wiring check | ARC-021, INP-*, REN-008, AUD-*, DIF-002 | 16.1 | Video, controls, audio, gameplay, HUD, accessibility tabs; reset to defaults; debounced save | Self-test: every setting key is both written and read (no one-ended settings) | Settings written but never read (MIS-008) |
| 16.6 | Accessibility | ACC-001..ACC-008 | 16.5, 16.2 | Colour-blind palettes + shape icons, captions, visual sound ring, hold/toggle for every hold action, reduce motion and photosensitivity cap 3 flashes/s, high-contrast outlines, mono audio, readable fonts | Self-test per ACC setting; contrast check on HUD colours | Flash effects (MIS-039): darken instead of white |
| 16.7 | Help and in-game rules panel | UI-002 (rules panel), ECO-001, VIS-006 | 16.1 | Short optional help, rules panel per ruleset, economy panel | New player reaches a match in < 60 s | **Gate:** LT-C and LT-H UI and accessibility pass on D1..D8 |

## Phase 17 - Audio

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 17.1 | Synth engine and voice pool | AUD-001, AUD-002, AUD-007 | 6.7 | Context resumed on first gesture with blocked message, 24 voices (Potato 12) with priority stealing, buffer reuse | Self-test: voice cap and stealing order; scheduling <= 0.3 ms per frame | Node creation storms on phones |
| 17.2 | Weapon, impact and explosion sounds | AUD-003 | 17.1, 5.9 | Noise burst + tonal body + filter envelope per weapon class; distance and occlusion low-pass | Self-test: every W01..W46 row resolves to a sound recipe | Same-sounding guns |
| 17.3 | Footsteps and spatial cues | AUD-004, ACC-003 | 17.1 | Footsteps per surface, locatable at 15 m, equal-power panning, HRTF on High+ | Footsteps audible at 15 m on phone speakers | MIS-022 audio hard to locate |
| 17.4 | Distinct cues, barks and announcer stings | AUD-005, UI-012, BOT-100, Q3 (speechSynthesis option) | 17.1 | Rocket whistle, grenade tick, power item chime, heartbeat, shield break, hit ticks, ping chirps, radio blips | Each cue mapped to its event; captions present (ACC-002) | - |
| 17.5 | Generative music | AUD-006 | 17.1 | Calm/combat/boss layers, off by default on Potato | Music fits the AUD-007 budget | **Gate:** LT-C and LT-H audio pass on P and L |

## Phase 18 - Performance pass on low-end targets

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 18.1 | Profile worst cases | PERF-001..PERF-013, ARC-034 | 17.5, 16.7 | Perf runs: largest map, 16 actors, max effects, horde max, generator large seeds | Report table in `__CTK.perf.report()` | - |
| 18.2 | Render optimisation | REN, PERF | 18.1 | Fix top costs: draw calls, overdraw, shader branches, resolution scaling tuning | p95 <= 8.3 ms on P and L in all worst cases at Auto quality | Thermal throttling on phones: 10 min soak test |
| 18.3 | Sim and AI optimisation | BOT, PERF | 18.1 | Fix top costs in collision, rays, AI tick, projectiles | Sim p95 <= 2 ms with full bot count on P | - |
| 18.4 | Garbage and memory | PERF-005, PERF-006, ARC-011 | 18.1 | Remove hot-path allocations; pool audit | Heap flat over 10 min; no GC pause > 4 ms | - |
| 18.5 | Battery and 60 Hz screens | PERF-001, PERF-013, PLT-004 | 18.2 | Frame cap options (60/90/120/uncapped), low-power mode | 60 Hz devices hold 60 fps; cap respected | Frame pacing jitter: pace from rAF timestamps |
| 18.6 | Size pass | PERF (file size), ARC | 18.1 | Remove dead code, compact data tables, keep code readable (no minifier) | File within release size checkpoint | **Gate:** all frame-time, size, load-time and memory checkpoints green on P and L; LT-C and LT-H performance pass |

## Phase 19 - Full regression and live-test sweep

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 19.1 | Self-test coverage review | ARC-030..ARC-034, Appendix A | 18.6 | Every spec requirement ID mapped to at least one `__CTK` check or LT test | Traceability table complete, no unmapped ID | - |
| 19.2 | Headless soak | ARC-033, BOT-040, MODE-002 | 19.1 | Every mode x 5 maps x 3 presets, random mutators, headless at max speed | Zero errors, zero stuck bots > 5 s, zero NaN positions | Long runs on L: max 4 parallel tabs |
| 19.3 | LT-C sweep | all | 19.1 | Every LT-C test on D1..D8, incl. max stress LT-C-030 and 60-min soak LT-C-031 on D1 and D5 | 100% pass | A single LT-C fail blocks release |
| 19.4 | LT-H sweep + mistake regressions | all, MIS-* | 19.3 | Every LT-H test on D1..D8; every LIVE-TESTS §9 regression test | 100% pass | - |
| 19.5 | LT-M and LT-L sweep | all | 19.4 | Every LT-M and LT-L test | LT-M 100% pass or written waiver; LT-L issues logged | - |
| 19.6 | **Milestone M5 - release candidate** | MIS-* (mistakes avoided check) | 19.2-19.5 | Mistakes-avoided checklist reviewed item by item; results table saved (LIVE-TESTS §8 item 6) | **Gate M5:** LIVE-TESTS §8 release gate items 1-6 all true on the same build | - |

## Phase 20 - Release

| # | Step | Spec | Depends | Deliverable | Done criteria | Risk |
|---|---|---|---|---|---|---|
| 20.1 | Original-names and content audit | VIS-002, VIS-003, section 25 | 19.6 | Search code, data and UI for reference-game names and brands | Zero hits (self-test with a banned-words list) | - |
| 20.2 | Offline and privacy check | VIS-001, PLT-001, PLT-007 | 19.6 | Confirm no network requests, no tracking, only `ctk.save.v1` / `ctk.save.bak` storage keys | Network tab empty over a full session | - |
| 20.3 | Browser matrix | PLT-004 (iOS 16+, Q4) | 19.6 | Chrome, Edge, Firefox, Safari (desktop and iOS) on D1..D8 | LT-C pass on each | Safari pointer-lock and audio differences |
| 20.4 | Readme and in-game credits/version | ARC, UI | 20.1 | Short README next to the HTML: how to run, controls, debug flags | Version string matches tag | - |
| 20.5 | **Milestone M6 - release** | all | 20.1-20.4 | Tagged commit with the final single HTML file | Final `__CTK.selfTest()` green on the tagged build | - |

---

## Completion checklist (every spec section -> steps that implement it)

Tick a row only when every listed step is done and its gates passed on P and L. Section numbers are those of `docs/SPECIFICATION.md`.

| Spec section | Requirement IDs / catalogues | Implemented in steps | Verified in |
|---|---|---|---|
| [ ] 1 Vision and pillars (VIS) | VIS-001..VIS-007 | 6.8, 15.8 (VIS-004 counts), 16.7, 20.1, 20.2 | M1, M3, M6 |
| [ ] 2 Platform and constraints (PLT) | PLT-001..PLT-007 | 0.1, 0.4, 0.6, 1.1, 18.5, 20.2, 20.3 | M0, M6 |
| [ ] 3 Performance budgets (PERF) | PERF-001..PERF-013 | 0.4, 0.5, 1.2-1.8, 2.5, 8.7, 10.8, 16.2, 18.1-18.6 | every phase gate, M5 |
| [ ] 4 Units and data schemas (DATA) | DATA-001..DATA-005 | 0.2, 0.3 (validation), 3.1, 5.1, 5.2, 7.1 | M1 |
| [ ] 5 Input and controls (INP) | INP-001..INP-010 | 2.1-2.6, 5.9, 16.5 | Phase 2 gate, M4 |
| [ ] 6 Movement and rule presets (MOV) | MOV-001..MOV-027, RS01..RS12, MV01..MV08 | 3.1-3.7, 4.1, 4.2, 4.5, 12.4 | Phase 3-4 gates, M2 |
| [ ] 7 Health, armor, shields, damage (HP) | HP-001..HP-007, HPP01..HPP09 | 6.1-6.3 | Phase 6 gate, M1 |
| [ ] 8 Weapons (WPN) | WPN-001..WPN-011, W01..W46, P01..P16 | 5.1-5.9, 17.2 | Phase 5 gate, M2 |
| [ ] 9 Grenades and gadgets (GAD) | GAD-001..GAD-003, G01..G24 | 4.4, 10.3, 10.4 | Phase 10 gate |
| [ ] 10 Abilities and powers (ABL) | ABL-001..ABL-005, A01..A40, H01..H08 | 10.6, 10.7 | Phase 10 gate |
| [ ] 11 Powerups and pickups (PWR) | PWR-001..PWR-003, PU01..PU20, I01..I17 | 10.1, 10.2 | Phase 10 gate |
| [ ] 12 Economy and loadouts (ECO) | ECO-001..ECO-003, ECP01..ECP07 | 9.5, 10.5, 15.1 | Phase 10 gate |
| [ ] 13 Game modes (MODE) | MODE-001..MODE-004, M01..M30 | 6.6, 9.1-9.6, 11.1-11.6, 14.3, 14.4 | M1, M2, M3 |
| [ ] 14 Mutators and custom match (MUT) | MUT-001..MUT-004, X01..X50 | 6.2 (hooks), 12.1-12.5 | Phase 12 gate |
| [ ] 15 Difficulty (DIF) | DIF-001..DIF-004 (and later IDs), D01..D10 | 8.6, 14.3, 15.3, 16.5 | Phase 8 gate, M3 |
| [ ] 16 Bot AI (BOT) | BOT-001..BOT-100, BT0..BT7, T01..T16, B01..B24 | 6.5, 8.1-8.7, 15.3, 18.3 | Phase 8 gate, M5 |
| [ ] 17 PvE enemies (NPC) | NPC-001..NPC-008, E01..E14 | 14.1, 14.2, 14.5 | Phase 14 gate |
| [ ] 18 Maps and procedural generator (MAP) | MAP-001..MAP-030, MP01..MP12, GN1..GN5 | 4.1, 4.4, 6.3, 6.4, 7.1-7.5, 11.5, 12.5, 13.1-13.4, 14.4 | Phase 7 and 13 gates |
| [ ] 19 Single-player structures and progression (PRG) | PRG-001..PRG-014, MD01..MD20, C01..C24 | 15.1-15.8 | M3 |
| [ ] 20 HUD, UI, menus (UI) | UI-001..UI-016 | 0.5, 2.6, 6.6, 9.6, 12.3, 16.1-16.5, 16.7 | M4 |
| [ ] 21 Accessibility (ACC) | ACC-001..ACC-008 | 2.3, 16.6, 17.3, 17.4 | M4 |
| [ ] 22 Audio (AUD) | AUD-001..AUD-007 | 6.7, 17.1-17.5 | M4 |
| [ ] 23 Rendering (REN) | REN-001..REN-008 | 0.4, 1.1-1.8, 7.4, 10.3, 16.2, 18.2 | Phase 1 gate, M5 |
| [ ] 24 Architecture, saves, self-test (ARC) | ARC-001..ARC-041 | 0.1-0.6, 4.1, 4.3, 15.1, 16.5, 18.4, 19.1, 19.2, 20.4 | every phase gate, M6 |
| [ ] 25 Out of scope | online play, monetization, story campaign, vehicles beyond the Skimmer, full physics, building mode, reference assets | Not built. 20.1 audits that none slipped in. | M6 |
| [ ] 26 Open questions | Q1..Q5 | Defaults apply unless answered before the step that needs them: Q1 name (20.4), Q2 gore style (1.7), Q3 speech announcer (17.4), Q4 iOS 16+ (20.3), Q5 Skimmer (3.6) | phase start reviews |
| [ ] Appendix A Traceability | feature -> reference table | 19.1 maps every requirement ID to a `__CTK` check or an LT test | M5 |
| [ ] Appendix B Mistakes avoided (MIS) | MIS-001..MIS-045 | Risk notes across steps; LIVE-TESTS §9 regressions in 19.4; item-by-item review in 19.6 | M5 |

## Counts

21 phases (0-20), 132 steps, 7 milestones (M0-M6).
