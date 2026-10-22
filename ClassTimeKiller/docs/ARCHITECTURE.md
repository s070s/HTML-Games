# ClassTimeKiller - Architecture and contracts

Binding for all code. Companion to `SPECIFICATION.md` (what) and `IMPLEMENTATION-STEPS.md` (order). When this file and the code disagree, fix one of them in the same change.

## Source layout and build

- Source: `src/shell.html` (style + DOM shells) and `src/*.js`, joined by file name order into **one** script inside one IIFE: `(() => { 'use strict'; ... })()`.
- Build: `node tools/build.mjs` writes `ClassTimeKiller.html` (the shipped file; players never build). `--check` runs the checks only.
- Build checks (fail the build): a top-level name declared in two files; a block of 8 meaningful lines duplicated anywhere (DRY); network/eval APIs (`fetch`, XHR, WebSocket, `import()`, `eval`, `new Function`).
- Test: `node tools/selftest.mjs [--group <name>] [--eval "<js>"]` runs `__CTK.selfTest({headless:true})` in headless Chrome (software WebGL) and fails on any failed check or logged error.
- File names: `NN-name.js` for a one-file section; `NNa-name.js` = the section's base file, `NNb-…`, `NNc-…` = add-on files of that section (they sort after the base). Data catalogues: `03b-data-<area>.js` and later letters. Tests: `20b-test-<area>.js` and later letters.

| # | Section | Files | Global objects |
|---|---|---|---|
| S00 | style + DOM shells | `shell.html` | `#view` canvas, `#overlay` (DOM UI root), `#fatal`, `#version` |
| S01 | util / math / core | `01-core.js` | constants (incl. DATA-003 body sizes `STAND_HEIGHT ACTOR_RADIUS STEP_HEIGHT HEAD_/TORSO_/LEGS_*`, `ZONE`, `ZONE_NAMES`), `clamp lerp wrapAngle…`, `Vec`, `Mat4`, `ErrorLog`, `Bus`, `makePool`, `BTN`, `ACTOR_KIND`, `ACTOR_FLAG`, `Actors`, `Sim`, `Game` |
| S02 | RNG | `02-rng.js` | `makeRandom`, `hashString`, `Rng.{map,loot,bots,rules,fx,weapons,pve}` |
| S03 | data catalogues | `03a-data.js`, `03b…` | `Data.define`, `REQUIRED`, `CAT` |
| S04 | settings / save | `04-save.js` | `Save`, `Settings`, `makeMemoryStorage` |
| S05 | input | `05*` | `Input` |
| S06 | audio | `06*` | `Sound` (never `Audio`: that is a browser global) |
| S07 | renderer | `07*` | `Render`, `Fx`, `HudBatch` |
| S08 | world / collision | `08*` | `World`, `makeHit`, `Hitbox` |
| S09 | nav | `09*` | `Nav` |
| S10 | movement | `10*` | `Move` |
| S11 | weapons / projectiles / damage | `11*` | `Weapons`, `Projectiles`, `Damage` |
| S12 | abilities / items | `12*` | `Items`, `Gadgets`, `Abilities` |
| S13 | rules / modes | `13*` | `Rules`, `Modes`, `Economy`, `Mutators` |
| S14 | bots | `14*` | `Bots` |
| S15 | PvE (enemies, director, PvE modes, boss) | `14h..14k` (after the bots they reuse) | `Pve`, `PveBrains`, `PveAttacks`, `PveBoss` (docs/api/pve.md) |
| S16 | map gen | `16*` | `Maps`, `MapGen` |
| S17 | HUD | `17*` | `Hud` |
| S18 | UI | `18*` | `Ui`, `Progress` |
| S19 | game loop | `19-loop.js` | `Loop`, `Perf` |
| S20 | self-test | `20a-selftest.js`, `20b…` | `Test`, `DebugApi` (= `window.__CTK`) |
| S21 | bootstrap | `21-boot.js` | `Boot` |

## Dependency rule

- Code may call **earlier** sections directly (S11 may call `World.raycast`).
- An earlier section reaches a later one only through (a) the event bus, (b) a hook or registry the earlier section exposes and the later one fills (`Render.addSource`, `Sim.addSystem`, `Loop.onFrame`, `Settings.define`, `Data.define`), or (c) the `Game.match` record.
- Never `typeof X !== 'undefined'` checks for other sections: if you need something later, add a hook.

## Code rules

- Beginner-readable: full-word names, early returns, max 2 nesting levels, short single-purpose functions, named constants, why-comments only.
- DRY: one source per rule, number and formula. Content = data rows read by generic systems; a new row never needs a new code path unless the framework step adds it with its own test.
- Zero steady-state allocation in sim and render loops (PERF-006): typed arrays, pools, reused payload/scratch objects. No closures or arrays created per step/frame in hot paths.
- The sim reads no wall-clock and no `Math.random`: only `Sim.tick/Sim.time` and `Rng.<stream>` (cosmetic-only code may use `Rng.fx`).
- Everything is an original name (spec VIS-002). The spec's `ref` schema fields and "Ref" columns are **not** copied into code or data: reference game names never appear anywhere in `src/` (the self-test scans for them).

## Simulation

- `Sim.step()` runs every registered system in order at 120 Hz: `Sim.addSystem(name, order, fn(dt))`.
  - 10 player input copy / bot brains, 20 abilities + status effects, 30 movement, 40 weapons, 50 projectiles, 60 items/pickups, 70 rules/modes/scoring, 80 PvE director, 90 bookkeeping.
- Before the systems run, `Sim.step` stores `prev*` (for render interpolation) and computes `Actors.pressed` (buttons that went down this step).
- Frame phases (`Loop.onFrame(phase, fn(seconds, alpha))`): `input` (before the sim steps) -> sim steps -> `render` -> `hud` -> `audio` -> `ui`.
- `Game.headless` is true in headless tests: renderer, DOM UI and audio do nothing. Every system must run without them.
- `Sim.timeScale` (S01, default 1): the loop feeds real seconds x `timeScale` to the 120 Hz steps and scales its step cap with it (game speed: mutators X02/X27).

## Actors (S01 `Actors`, ARC-011)

Index `0..MAX_ACTORS-1` (64), loop `for (let id = 0; id < Actors.count; id++)` and test `Actors.kind[id]` / `Actors.alive[id]`.
Core fields: `kind team flags x y z (feet) vx vy vz yaw pitch prevX/Y/Z prevYaw prevPitch height eye health armor shield maxHealth maxArmor maxShield name profile spawnCount`.
Input (BOT-001: player and bots write the same struct before each step): `moveX` (+1 = strafe right), `moveZ` (+1 = forward), `aimYaw`, `aimPitch` (desired view angles, radians), `buttons` (BTN bits held), `pressed` (computed), `slotRequest` (1-9, 0 none).
Sections keep their own per-actor typed arrays (e.g. `Move.stamina`) sized `MAX_ACTORS` and reset them on `actor.create`.

Conventions (DATA-002): metres, Y up, yaw 0 looks +Z, positive pitch looks up. Forward = `(sin yaw, 0, cos yaw)`, **right = `(-cos yaw, 0, sin yaw)`**. Eye position = `(x, y + eye, z)`. DATA-003 capsule: radius 0.40, height 1.80/1.10/0.60, eye 1.62/0.95/0.40, step 0.45, slope 45 deg. Hit volumes: head sphere r 0.14 centred at eye height + 0.04; torso cylinder r 0.30 from 0.85 to 1.45 m; legs cylinder r 0.22 from 0.05 to 0.85 m (scaled by height/1.8 when crouched). The numbers live once in S01; the ray tests live once in S08: `Hitbox.ray(id, ox, oy, oz, dx, dy, dz, maxDistance, inflate)` (zone in `Hitbox.zone`), `Hitbox.point(id, zone, out)` and `World.raycastActors` (which uses `Hitbox`).

## Match record and lifecycle

`Game.start(setup)` emits in order `match.setup` -> `match.load` -> `match.start`, then state `playing`. `Game.end(winner)` -> `match.end` (state `results`). `Game.stop()` -> `match.stop`.
`setup = { mode: 'ffa', map: 'mp01', ruleset: 'rs01' | {…}, mutators: [], bots: [{ profile, team, tier }], seed, difficulty, player: { team, loadout }, modeOptions, balance }`. `balance: false` keeps a custom team split (S13 auto-balance skips it).
`Game.match = { setup, rules, map, ended, winner, startTick, … }`. `rules` is the frozen built ruleset (Ruleset schema in spec §4, built by S13 `Rules.build`); every section reads its own fields from it (`CAT.movement.byId(Game.match.rules.move)`). Tests may assign a hand-made `rules` object.
Ruleset fields that cross sections: `rules.fx` = the mutator effect bag (S13 13h sets one key per active mutator, e.g. `darkness`, `ballistics { gravity, drag }`, `volatileAmmo`, `noItems`, `noPowerups`, `mirror`, `powers`, `superPowerups`; the reading section is listed in docs/api/mutators-custom.md); `rules.items` (false = no map pickups; S12 also skips them for `fx.noItems` and mode `params.pickups: false`); `rules.botSkill` = the resolved difficulty preset (S14), read by S11 for the player's aim assist (`aimAssist` 0..100, -1 keeps the setting); `rules.weaponSet: 'matchSet'` = the reserved `weaponSets` row the match fills from a weapon list (X08/X09/X10, custom matches): S11 loadouts and S12 weapon spots use its `weapons`.
Map loading: S16 puts the map row on `Game.match.map` at `match.setup`; S08 loads it with `World.load` on `match.load` (no map = the loaded world stays, e.g. a test world), so spawns, nav and the renderer follow `world.load` before `match.start`.
`Game.playerId` = the local player's actor id (-1 when spectating / headless).

## Event bus (ARC-015)

`Bus.on(type, fn)`, `Bus.emit(type, payload)`. Emitters reuse one payload object per event type: **listeners copy what they keep**. Listener errors are logged, never thrown.

| Event | Payload | Emitted by |
|---|---|---|
| `boot`, `ready` | null | S21 |
| `setting` | key | S04 |
| `world.load` | map | S08 |
| `match.setup/load/start/end/stop` | `Game.match` | S01 |
| `game.pause` / `game.resume` | reason / null | S01 |
| `actor.create` / `actor.remove` | id | S01 |
| `actor.spawn` | `{ id }` | S13 |
| `move.jump` `move.land` `move.step` `move.slide` `move.dash` `move.mantle` `move.wallrun` | `{ id, speed, surface, loudness }` (`loudness` on `move.step` = stance (1 standing, 0.5 crouched) x walk (0.5 walking, 1 running) x `Move.footstepScale[id]`, 0 = silent; 1 otherwise) | S10 |
| `weapon.fire` | `{ id, weapon, weaponClass, mode: 'primary'|'alt'|'melee' (MELEE button bash), x, y, z, dx, dy, dz }` | S11 |
| `weapon.reload` `weapon.switch` `weapon.empty` | `{ id, weapon }` | S11 |
| `impact` | `{ x, y, z, nx, ny, nz, material, weapon, owner }` | S11 |
| `explosion` | `{ x, y, z, radius, owner, source, element }` | S11/S12 |
| `damage` | `{ target, source, amount, absorbed, zone: 'head'|'body'|'legs'|'none', weapon, element, x, y, z, dx, dy, dz }` | S11 `Damage.apply` only |
| `kill` | `{ victim, killer, assister, weapon, zone, element, x, y, z }` | S11 |
| `damage.request` | `{ target, source, amount, kind: 'fall'|'hazard'|'telefrag'|'crush'|'drown', element, x, y, z }` (earlier sections ask S11 to apply damage) | S08, S10, S12 |
| `impulse` | `{ id, x, y, z }` velocity change in m/s (knockback, jump pads); S10 applies it | S08, S11, S12 |
| `world.break` | `{ prop, material, x, y, z }` a destructible prop broke (`prop` = `hit.brush.prop`) | S08 |
| `toast` | `{ text }` short UI message | any |
| `caption` | `{ text, x, y, z, kind }` sound caption / visual sound ring (ACC-002/003) | S06 |
| `ui.click` | `{ kind }` menu feedback sound | S18 |
| `sound` | `{ x, y, z, radius, kind, source }` (what bots can hear, BOT-005) | any |
| `pickup` | `{ id, item, x, y, z }` | S12 |
| `item.grant` | `{ id, item }` give an item, powerup or weapon key without a pickup (X17 Super Powerups); S12 `Items.giveKey` delivers it | S13 |
| `power.pick` | `{ id, ability }` give a random power in the first ability slot on spawn (X46 Powers for All); S12 `Abilities.setSlot` | S13 |
| `ability.cast` / `ability.end` | `{ id, ability, slot }` (`ability.end` adds `reason`: done, cancel, release, empty, stun, damage, fire, group, death, match, spawn, replace, suppressed) | S12 |
| `ability.teleport` | `{ id, x, y, z }` an ability with `balance.dropsObjective` (A12) moved an actor (S13 drops a carried objective) | S12 |
| `score` | `{ id, team, points, reason }` | S13 |
| `medal` | `{ id, medal }` | S13/S18 |
| `announce` | `{ text, kind, priority }` | any (HUD banner, audio sting) |
| `ping` | `{ id, kind, x, y, z, target }` | S05/S14 |
| `bark` | `{ id, team, category, text }` | S14 |
| `pve.tell` / `pve.parry` / `pve.alarm` / `pve.core` / `pve.wave` / `pve.boss` / `pve.chamber` / `pve.wrath` | see docs/api/pve.md | S14 PvE |

## Map data format (catalogue `maps`, generated maps use the same format)

```
{ id: 'mp01', code: 'MP01', name, size: [x, y, z] metres, theme (one of the 6 MAP-022 tilesets), modes: ['ffa', ...], sky,
  brushes: [{ shape: 'box' | 'ramp', min: [x,y,z], max: [x,y,z], dir: '+x'|'-x'|'+z'|'-z' (ramps), material }],
  spawns: [{ x, y, z, yaw (degrees), team: -1 any | 0 | 1, modes: [] (empty = all) }],
  items: [{ x, y, z, item: <items/powerups/weapons code key>, group: 'power'|'armor'|'health'|'weapon'|'ammo' }],
  objectives: [{ id, kind: 'flag'|'flagBase'|'point'|'hill'|'bombsite'|'payloadPath'|'relic'|'core'|'bank'|'extract', team, x, y, z, radius, path: [[x,y,z], ...] }],
  zones: [{ name, min, max }]  (callouts, MAP-012),
  triggers: [{ kind: 'jumppad'|'teleporter'|'ladder'|'water'|'hazard'|'killzone', min, max, ... }] (fields: docs/api/world-move.md),
  lights: [{ x, y, z, color: 0xRRGGBB, radius }], navHints: [{ x, y, z, kind }], seed (generated maps only),
  gen: { generator, size, theme, density, mode, requestedSeed, siteSeconds? } (generated maps only, docs/api/mapgen.md),
  ring: { x, z, radius } (optional: royale ring centre and start radius; without it the ring starts from the world bounds) }
```
Coordinates in metres, floor usually at y = 0, yaw in degrees in data (radians in code).

## Spawning contract

S13 picks the spawn point (MAP-010/011), sets the actor's position/yaw, `alive = 1`, clears velocity, then emits `actor.spawn { id }`. Every section resets its own per-actor state on `actor.spawn`: S11 sets health/armor/shield from the health preset and gives the loadout from `rules.weaponSet` / the player's loadout; S10 resets movement state and clears its own flags (ON_GROUND, CROUCHED, PRONE, SPRINTING ...); S08 resets trigger state; S12 resets cooldowns. S13 itself clears only `PROTECTED`/`FROZEN` (its own flags); every other flag belongs to the section that sets it. Death: S11 sets `alive = 0` and emits `kill`; S13 schedules the respawn from `rules.respawn`.

## Renderer hooks (S07)

- `Render.worldQuery` (filled by S08 with `World`): the renderer bakes `Render.worldQuery.brushes` on `world.load`; S07 never calls `World` itself.
- `Render.addSource(name, fn(batch))`: called inside every rendered frame; `fn` pushes instanced shapes with `batch.mesh(shape, x, y, z, yaw, pitch, sx, sy, sz, r, g, b, emissive)`, which returns the instance offset or -1 (unknown shape or batch full). Shapes are procedural: `box sphere cylinder capsule cone wedge ring`. Later sections draw pickups, projectiles, flags and deployables this way.
- Actors are drawn by S07 itself from `Actors` (team/profile colour, crouch, alive). `Render.addActorStyle(fn(id, out))` is the one way later sections change an actor's look: `out = { r, g, b, emissive, scale, headScale, visible }` (powerups, cloak, killcam, size mutators: `scale` x `Hitbox.sizeScale`, `headScale` x `Hitbox.headScale` grows the head and visor about their eye-height pivot); `Render.actorStyle` is a single override run after that list (tests, debug).
- Darkness (`rules.fx.darkness`, X37): S07 darkens the theme and fog, bakes no map lights, and each frame (render update 55, after the effect lights) gives the visible living actors nearest the camera one flashlight each, written straight into the frame lights up to the quality tier's `lights` (at least 1, so the player always has one); muzzle flashes and explosions keep 2 of those lights.
- Accessibility and view hooks (filled by S18, read by S07): `Render.viewEffect = fn(camera, seconds)` (camera shake and FOV kick after the camera followed the player), `Render.motion = { bob, shake, fovKick }` (0..1 scales: reduce motion and the sliders), `Render.teamPalette` (colour-blind team colours or `null`), `Render.config.highContrast` (thick bright enemy outlines), `Render.config.particleScale` (particle intensity), `Render.config.viewmodelOffset` (metres). `video.headBob` is a 0-100 slider. Details: `docs/api/accessibility.md`.
- `Render.camera` `{ x, y, z, yaw, pitch, roll, fov }` follows the player's interpolated eye by default; `Render.cameraOverride = fn(camera)` for spectate/killcam.
- `Render.viewModel = fn(out)` (filled by S11) returns `{ visible, shape: weapon class, kick, reload 0..1, swap 0..1, ads 0..1, color, zoom, recoilPitch, recoilYaw, dual }`: `recoilPitch`/`recoilYaw` = the recoil punch in degrees (positive pitch = up), added to the camera view (view kick); `dual` = two pistols drawn.
- `Fx`: `burst(kind, x, y, z, nx, ny, nz, count, colorHex)`, `tracer(ax, ay, az, bx, by, bz, colorHex)`, `decal(x, y, z, nx, ny, nz, kind)`, `light(x, y, z, colorHex, radius, seconds)`. Kinds: `spark smoke dust blood muzzle explosion energy water fire frost shock heal`. All capped by quality (PERF-010), pooled.
- `HudBatch` (used by S17): `rect(x, y, w, h, colorHex, alpha)`, `text(string, x, y, sizePx, colorHex, align)`, `ring(x, y, radius, thickness, colorHex, alpha, start, end)`, `line(...)`; one draw call per layer (REN-005).
- `Render.stats` feeds `Perf.counters` (draw calls, triangles, render ms, scale). S19 also copies `Sound.updateMs` to `Perf.counters.audioMs` after the frame phases.

## Other hooks

- Settings: `Settings.define(key, default, { label, category: 'video'|'controls'|'audio'|'gameplay'|'hud'|'accessibility'|'developer', min, max, step, options, optionLabels })`. The settings screen is generated from these definitions; nothing is written that is never read (self-test).
- Input: `Input.aimAssistTarget = fn(id, out)` (filled by S11/S14) returns the nearest valid hitbox point for aim assist (INP-008); `Input.aimAssistFilters` = list of `fn(id, point) -> false` that refuse a found point (S12: never through smoke); `Input.aimAssistOverride = fn() -> 0..100 | -1`: the aim assist floor (filled by S11 from `rules.botSkill.aimAssist`) replaces the device's strength setting, -1 keeps it. `Input.actions` is the single action table.
- Audio: `Sound.lineOfSight = fn(ax, ay, az, bx, by, bz)` (filled by S08 with `World.lineClear`) muffles sounds behind walls; `null` = no occlusion.
- Hooks are filled once at load and never reset by the section that owns them; the self-test restores them before every block.
- Parry (S11 owns W03): `WeaponSpecialState.parryHooks` (fn(target, projectile) -> true reflects a parryable projectile before the W03 block check); S14 fills it for PvE green projectiles.
- Movement hooks (S10 owns MOV-021/025, MV08): S11 asks `Move.canFire(id)` before a shot, writes `Move.weaponSpeedScale[id]` every step, adds `Move.inaccuracy(id)` to spread (the only MOV-025 table) and multiplies incoming damage by `Move.damageScale(id)`.
- Per-actor movement scales (S10 arrays, reset on `actor.create`): `Move.statusSpeedScale` and `Move.gravityScale` are written only by S12 `Buffs.applyScales(id)` (buffs SPEED x SLOW x the powerup factor; glide = a GRAVITY buff; status effects slow through S11's weapon speed scale instead); `Move.staminaScale` (sprint drain divisor) and `Move.footstepScale` (step noise and `move.step` loudness) are written by S13 economy perks.
- Fire rate: `Weapons.rateScale[id]` (S11) is the single fire-rate factor; only `Buffs.applyScales` writes it (RATE status x powerup rate).
- Shot blockers: `Weapons.rayBlockers` = list of `fn(ox, oy, oz, dx, dy, dz, maxDistance) -> distance | -1`; `Shot.trace` stops a hitscan ray at the nearest (S12 devices, ability domes) and emits an `impact` there facing the shooter. `Weapons.blockDistance(...)` runs them. Every device with health blocks, the shooter's own and allies' too (it is a solid object; friendly fire still decides whether it takes damage).
- X41 bullets: `Weapons.ballistics()` = the ruleset's `{ gravity, drag }` or null; `Weapons.fliesAsBullet(mode)` = a hitscan mode turned into 11b bullets. Sections that settle shots on `weapon.fire` with an instant ray (12d devices, 12a X30 ammo) skip such shots. Each bullet sweep step stops at `Weapons.blockDistance` like hitscan, and `Projectiles.bulletHits` = list of `fn(owner, mode, ox, oy, oz, dx, dy, dz, length)` runs for the part a bullet flew unstopped by bodies (12d: the device it stopped at takes one pellet; 12a: X30 ammo pickups on that part blow up).
- Shield regen: `Damage.pauseShieldRegen(id, seconds)` / `Damage.shieldRegenBlocked(id)` (S11): EMP and suppression pause shield and ability-shield regeneration.
- Hit volumes: `Hitbox.sizeScale[id]` (whole body) and `Hitbox.headScale[id]` (head sphere) (S08) scale the hit tests; the renderer draws them through `Render.addActorStyle`.
- Pickups (S12): `Items.givers[PICKUP_KIND]` = `fn(id, key)` gives a key without a pickup (`item.grant`); `Items.grantEffects[key]` = `fn(id, item)` delivers an economy 'grant' buy (unregistered keys are not on sale); S13 fills `Economy.grants.gadget` / `.grant` at the end of 13d (S12 cannot fill an S13 registry at load). `Smoke.add(x, y, z, width, height, seconds, yaw, owner)` lays a smoke curtain; `Smoke.lineBlocked(..., viewer)` is false for a viewer with the `smokeVision` passive.
- Ballistics: `Projectiles.spawnBallistic(owner, weapon, mode, modeIndex, direction, damage, { gravity, drag })` (S11 11b) flies one hitscan pellet as a `bullet` projectile (row P21) while `rules.fx.ballistics` is set.
- Shared world geometry (S08, one source per algorithm): `rayBrush(ox, oy, oz, dx, dy, dz, maxDistance, brush, hit)` is the per-brush ray test behind `World.raycast`, the nav build (S09) and the map scan (S16); `World.padArc(pad, startY, gravity)` is the jump pad arc used by S08 launches and S09 pad links.
- World media: `World.touchTriggers(id, gravity)` (called by S10 every step) returns `TRIGGER_MEDIUM` bits `WATER` (swim depth), `WADING` (touching water), `LADDER`, `HEAD_UNDER`, `MOVED` (docs/api/world-move.md).
- UI screens: `Ui.register(name, { build(root), onOpen, onClose })`, `Ui.open(name)`, `Ui.back()`, `Ui.toast(text)`. Settings screen hooks: `Ui.settingGroup(key)`, `Ui.settingsExtras[category | category + ':after']`, `Ui.settingsFooter`; `PlayFlow.setupHooks` adjust a built setup; `hudAddElement(row)` adds a hideable HUD element (S17).
- Fatal errors: `showFatal(title, text, detail)` (S01) shows the full-screen message (PLT-002); boot stops.
- Quality: `Quality.current()` (S04) is the active `CAT.quality` row; `Settings 'video.quality'` ('auto' or a preset id); the renderer's benchmark sets `video.autoQuality`.
- Input: `Input.device` = last used device `'kbm'|'touch'|'gamepad'`.
- Each helper documents its public API in `docs/api/<area>.md` (functions, data formats such as map entities, events it emits).
- Debug: test files add commands to `DebugApi` (e.g. `DebugApi.spawnBot = …`).

## Data catalogues

`Data.define(name, schema, rows)` once per catalogue; schema values are defaults or `REQUIRED`. `CAT.<name>` rows, `CAT.<name>.byId(id)`. Code keys are the spec's backtick keys (`warden`, `arena`), catalogue codes kept in a `code` field (`W04`). Catalogue names: `quality movement rulesets health weapons projectiles recoil weaponSets gadgets abilities heroes powerups items economy modes mutators difficulty cards botTiers botTraits bots enemies maps generators medals`.

## Self-test

`Test.add(group, (check) => { … check(name, ok, detail) … })`. Each block starts clean (`Test.isolate`: no match, memory storage, seed 1). A block that throws or logs an unexpected error fails; use `Test.expectErrors(fn)` for deliberate ones. Groups: one per area (`core`, `render`, `input`, `ui`, `audio`, `world`, `move`, `weapons`, `damage`, …). Run one group with `--group`.

Slow tests: `Test.add(group, fn, { slow: true })` marks a long soak (whole matches, sweeps over every row). The default run skips slow blocks so the full suite stays quick (about 30 s); `node tools/selftest.mjs --slow` adds them, and naming a group with `--group` always runs its slow blocks. Put a check in a slow block only when a short version of it stays in the default suite (the `botsoak` group backs up `bots`).

## Git for helpers

Work only in the files your brief names. Commit with clear messages; never commit `ClassTimeKiller.html` (the lead rebuilds it after merging): stage with `git add src tools docs`. Before every commit: `node tools/build.mjs` and `node tools/selftest.mjs` must pass.
