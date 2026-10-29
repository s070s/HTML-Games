# ClassTimeKiller - Binding Design Specification

Version 1.0 (2026-10-22). Binding for implementation. Offline FPS vs local bots, one self-contained HTML file (plain JS + WebGL2). Normalizes the 28 notes in `research/`. Values marked **T** are tunable starting values chosen by this spec where sources disagree or were unverified; they describe our game, not the reference games. "Ref" columns name the archetype source only; Ref names must never appear in game text or data keys.

Conventions: "must" = mandatory, "should" = expected, "may" = optional. Requirement IDs `PREFIX-NNN` are stable and never reused. Catalogue entries use short codes (W01, G01, A01, PU01, M01, X01, D01, C01, T01, B01, E01, MP01) plus a code key in backticks that is used in code and saves.

## 1. Vision and pillars (VIS)

| ID | Requirement |
|---|---|
| VIS-001 | First-person shooter played offline against local bots. No network, accounts, telemetry, ads or monetization. |
| VIS-002 | Clone mechanics only: every weapon, ability, mode, mutator, enemy, map, character and bot has an original name. No reference assets, textures, audio, names, logos or story. |
| VIS-003 | All visuals procedural geometry/shaders; all audio synthesized with Web Audio. |
| VIS-004 | Breadth: selectable rule presets (movement, health, economy) plus catalogues: >= 38 weapons (P3-03: 46 before the merges), 17 gadgets (24), 38 abilities A01..A40 without A30 and A31 plus the 7 AX rewards (40), 16 powerups (20), 30 modes, 50 mutators, 10 difficulty presets, 24 cards. |
| VIS-005 | Bots are the core: every mode must be fun with bots only, with humanlike perception and reaction and no hidden-information cheating (BOT-040..049). |
| VIS-006 | Respect: pause anytime, quick match in <= 2 menu actions, remembered settings, no grind walls, no FOMO, all unlocks earned by play. |
| VIS-007 | Pillar priority when in conflict: 60 fps minimum > fair readable bots > fast menus > breadth > visual polish. |

## 2. Platform and constraints (PLT)

| ID | Requirement |
|---|---|
| PLT-001 | One self-contained `.html` file; plain JavaScript; WebGL2; no libraries, player-side build step, ES module imports, `fetch`/XHR, or external requests. Must run by double-click (`file://`). Phones: iOS Safari cannot run local HTML files and Android Chrome may open them as `content://` where storage can fail, so phones load the same file from a static web server. Serve it over HTTPS: iPhone and iPad Safari give gyro/motion, the screen wake lock, persistent storage and the Home Screen app only on a secure page, and a plain LAN `http://` address works for play but not for those. The game must behave the same over `http(s)://` and `file://`. Developers edit `src/` files that `tools/build.mjs` (no dependencies) joins into the shipped HTML (decision D01, see `ARCHITECTURE.md`). |
| PLT-002 | If WebGL2 is missing or context creation fails, show a full-screen message: "WebGL2 is required", with steps to enable hardware acceleration / update browser. Never a blank page. |
| PLT-003 | Saves and settings in `localStorage`, every access wrapped in try/catch; game must run (without persistence, with a one-line notice) if storage throws. |
| PLT-004 | Targets: low-spec phones (Android Chrome, iOS Safari 16+), low-end laptops with integrated graphics (Chrome, Edge, Firefox current). |
| PLT-005 | Context loss: pause, show "graphics restoring", rebuild GPU resources on restore. |
| PLT-006 | Pause on window blur, tab hidden, pointer-lock loss. Simulation stops fully while paused (offline). |
| PLT-007 | Import/export of saves and custom content may use a file input (FileReader) and Blob download; no other file access. |

## 3. Performance budgets (PERF)

| ID | Requirement |
|---|---|
| PERF-001 | Target 120 fps on 120 Hz displays (8.33 ms frame); hard minimum 60 fps (16.7 ms) on all targets at the auto-selected preset. Exception: iOS Safari caps pages at 60 fps on 120 Hz iPhones by default; there 60 fps is the target and higher rates are only recorded. |
| PERF-002 | CPU budget per frame at 120 fps: simulation step <= 2.0 ms (movement/collision 0.5, bot AI 1.0, projectiles/hitscan 0.3, game rules 0.2); render submission <= 1.5 ms; HUD <= 0.4 ms; audio scheduling <= 0.3 ms; slack >= 1.3 ms. Total main-thread JS <= 5.5 ms. |
| PERF-003 | GPU budget <= 6.0 ms at current render scale; dynamic resolution keeps it there. |
| PERF-004 | Draw calls per frame: Ultra 200, High 150, Medium 110, Low 80, Potato 50. Triangles: 600k / 400k / 250k / 120k / 60k. |
| PERF-005 | Shader programs <= 8 total (REN-003). GPU memory <= 64 MB (Potato 32 MB), estimated from tracked buffer and texture allocations (WebGL cannot report it). JS heap <= 150 MB, measured where the browser exposes it (Chrome), otherwise estimated from tracked allocations. |
| PERF-006 | Zero steady-state allocations in the sim and render loops (pools, typed arrays); GC pauses must not exceed 2 ms during a match. |
| PERF-007 | Dynamic resolution: render scale 0.5-1.0 (Potato 0.4-0.8), step 0.05, adjust when GPU or frame time exceeds budget for 0.5 s; raise after 2 s under 80% budget (hysteresis). Use `EXT_disjoint_timer_query_webgl2` when available, else frame-time heuristic. |
| PERF-008 | Quality presets: Potato, Low, Medium, High, Ultra, auto-selected on first run by a 3 s benchmark; changeable any time without reload. |
| PERF-009 | Bot count caps by preset: Ultra 23, High 19, Medium 15, Low 11, Potato 7 (plus PvE enemies cap 40 / 32 / 24 / 18 / 12). |
| PERF-010 | Effect scaling per preset: particles max 4096 / 2048 / 1024 / 512 / 256; decals 128 / 96 / 64 / 32 / 0; dynamic lights 8 / 4 / 2 / 0 / 0; destructible props active 32 / 24 / 16 / 8 / 4. |
| PERF-011 | AI LOD: bots beyond 40 m or not visible think at 5 Hz; others at 10-20 Hz staggered (BOT-090). |
| PERF-012 | Performance HUD (ARC-040) shows fps, frame ms, CPU sim/AI/render/HUD ms, GPU ms, draw calls, triangles, render scale, active bots/projectiles/particles, heap. |
| PERF-013 | If fps < 60 for 5 s, auto-lower one quality step (option, default on) and toast the change. |

## 4. Units and data schemas (DATA)

| ID | Requirement |
|---|---|
| DATA-001 | Units: metres, seconds, m/s, m/s^2, HP, degrees (radians only inside math), kg. Fire rate in shots/s (rps). Noise as radius in metres heard by an alert bot. Fractions stored as 0..1, multipliers as factors. |
| DATA-002 | Coordinates right-handed, Y up; yaw 0 looks +Z; positive pitch looks up (matches IronHorizon). |
| DATA-003 | Actor: capsule radius 0.40 m; height 1.80 stand / 1.10 crouch / 0.60 prone; eye 1.62 / 0.95 / 0.40; step 0.45 m; walkable slope <= 45 deg. Hit volumes: head sphere r 0.14 m; torso capsule r 0.30 (0.85-1.45 m); legs capsule r 0.22 (0.05-0.85 m). |
| DATA-004 | One canonical schema per entity type (tables below and in each section). Catalogue data are plain object literals following the schema; missing optional fields take defaults; self-test validates every entry (ARC-031). |
| DATA-005 | Code keys unique per catalogue, never renamed after release. |

Schemas (field: type, default). Full catalogue tables use these fields.

| Schema | Fields |
|---|---|
| Ruleset | id, name, move (MV key), health (HPP key), economy (ECP key), precision (`arena`/`standard`/`tactical`/`hero`), weaponSet, meter (`none`/`streak`/`boost`/`adrenaline`/`ultimate`/`energy`), friendlyFire 0, selfDamage 0.5, knockback 1, hitKnockback 1, gravityScale 1, respawn {delay 2, forced 10, protect 2, wave 0}, lives 0, itemRespawnScale 1, weaponStay false, dropOnDeath `held`, mutators [] |
| Weapon | id, name, class, slot 1-9, ref, moveMult 1, adsMoveMult 0.7, equipTime 0.4, readyTime 0.15, primary FireMode, alt FireMode, ammoType, mag, reserve, maxAmmo, pickupAmmo, price 0, killReward 300, rarityScale true, noise 60, botPref {range [min,max], value 0..1} |
| FireMode | type (`hitscan`/`projectile`/`beam`/`melee`/`spread`/`charge`/`zoom`/`lock`/`tool`), damage, rate (rps), pellets 1, spreadDeg, moveSpread, adsSpreadMult 0.4, recoil pattern key, falloff [startM, endM, minFactor], headMult 2, legMult 0.75, armorPen 0.75, pierce 0, range, projectile key, splash {r, dmg, minFactor 0.2}, charge {time, min, max}, ammoPerShot 1, heat, element `kinetic` |
| Projectile | id, speed, gravity 0, life, radius, bounce 0, fuse 0, stick false, homing 0 (deg/s), drag 0, arm distance 0, onHit (`explode`/`damage`/`pin`/`freeze`), poolSize |
| Gadget | id, name, ref, kind (`thrown`/`placed`/`deployed`), carry, cooldown or pickup, fuse, radius, duration, damage, effect, counter, botUse |
| Ability | id, name, category, activation (`instant`/`toggle`/`hold`/`channel`/`passive`/`ult`), resource (`cooldown`/`charges`/`energy`/`ultimate`), cost, cooldown, charges, duration, range, effect, counter, botUse, ref |
| Powerup / Item | id, name, effect, amount, duration, respawn, cap, stacking, ref |
| Mode | id, name, teams, sizeDefault, scoreLimit, timeLimit, roundRules, respawn, objective, tiebreak, ruleset default, ref |
| Mutator | id, name, param (type, range, default), effect, conflicts, ref |
| Bot profile | id, name, tier, traits T01..T16 (0..1), favoriteWeapon, chat style, color |
| Map | id, name, size m, modes, brushes [AABB/ramp/wedge with material], spawns, items, objectives, callout zones, nav hints, lights, seed (generated maps) |
| Difficulty | id, name, botTier mix, sliders (DIF-012), lives, assists |

## 5. Input and controls (INP)

| ID | Requirement |
|---|---|
| INP-001 | Keyboard+mouse: pointer lock on click; request `unadjustedMovement` (raw) when supported, fall back silently; no OS acceleration applied by the game; sensitivity shown also as cm/360 at a user-set DPI. |
| INP-002 | Every action rebindable (keyboard, mouse buttons, wheel, gamepad); conflicts flagged; reset to default; per-preset hold/toggle for crouch, sprint, Alt, walk. A toggled sprint on a controller (L3, default toggle) acts only where sprint is a run: it holds where sprint is a dash, charge or walk (Ravager, Knight, Tactical), and in Modern a click while running is the tactical sprint's second tap. A toggled sprint ends by itself when the run ends (a stop, a shot, no stamina). |
| INP-003 | Default KBM: WASD move, Space jump, C crouch/slide (not Ctrl: Ctrl+W/N/T close or open tabs), P prone, Shift sprint (walk in tactical), Alt walk, LMB fire, RMB Alt, R reload, E use, H heal item, Q ability 1, F ability 2, X ultimate, G grenade, N next grenade type, V melee, U gadget, Z ping (hold = wheel), 1-9/wheel weapons, Tab scoreboard, Esc pause, T comm wheel, B buy menu, Y card, F8 perf HUD, F9 bot debug view. Gamepad: cards Pad:8+5 (menu + right bumper), prone Pad:8+10, next grenade Pad:8+4. |
| INP-004 | Touch: floating left stick (move; sprint = push the stick to its edge twice within 0.4 s, setting Touch sprint: that, one push to the edge, or never; a single push held at the edge only walks), right-half drag to look, buttons fire, Alt, jump, crouch, prone, reload, weapon swap, grenade, abilities, ping, scoreboard, pause. Second fire button option on left. |
| INP-005 | Touch layout editor: drag, resize (50-200%), opacity (20-100%), hide; per-preset layouts; reset. |
| INP-006 | Touch options: auto-fire when crosshair is on a visible enemy (default on), tap-to-fire, look sensitivity and acceleration curve, optional gyro aim (DeviceOrientation/Motion; request permission on iOS; enable while Alt is held or always; needs HTTPS on iOS). Auto-fire follows the held weapon's trigger: automatic weapons hold the trigger, semi and burst weapons press and release on alternate ticks. |
| INP-007 | Gamepad (Standard mapping): two sticks, configurable deadzones (inner 0.1, outer 0.95), response curve (linear/classic/dynamic), separate X/Y sensitivity, invert Y, vibration (`vibrationActuator` if present). A pad with the standard mapping is chosen over a non-standard one; a stick let go inside the deadzone sets a new rest position. |
| INP-008 | Aim assist only for touch and gamepad, never mouse: slowdown 40% inside a 3 deg cone around a visible enemy hitbox, magnetism up to 1.5 deg/s pull, no snap; strength slider 0-100% (default 60 gamepad, 70 touch); disabled through smoke and on cloaked targets. |
| INP-009 | Input is sampled each frame and consumed by the next sim step; jump and fire presses are buffered 0.10 s. |
| INP-010 | All menus fully navigable by keyboard, gamepad and touch. |

## 6. Movement and rule presets (MOV)

### 6.1 Rule presets (bundles)

| ID | Requirement |
|---|---|
| MOV-001 | A match ruleset is built in order: mode defaults -> ruleset bundle or chosen presets -> mutators -> difficulty -> per-actor handicap. Frozen and validated at match start; shown in pause menu "Rules" panel. |
| MOV-002 | Users may save up to 50 named custom rulesets. |

| Code | Key | Name | Move | Health | Economy | Precision | Meter | Ref |
|---|---|---|---|---|---|---|---|---|
| RS01 | `classic` | Arena Classic | arena | stack | pickups | arena | none | Quake III, UT99 |
| RS02 | `tourney` | Arena Tournament | arena (+double jump, wall dodge) | stack | pickups | arena | adrenaline | UT2004, UT3 |
| RS03 | `tactical` | Tactical Breach | tactical | tactical | roundBuy | tactical | none | Counter-Strike, Valorant, CrossFire |
| RS04 | `modern` | Modern Ops | modern | regen | classes | standard | streak | CoD4, CoD MW2019, Battlefield |
| RS05 | `pilot` | Pilot Rush | agile | regen | classes | standard | boost | Titanfall, Apex Legends |
| RS06 | `vanguard` | Shield Wars | vanguard | shield | pickups | standard | ultimate | Halo, Halo 3 |
| RS07 | `ravager` | Ravager | ravager | ravager | pickups | standard | ultimate | Doom Eternal, Painkiller |
| RS08 | `knight` | Iron Bulwark | knight | ravager | pickups | standard | ultimate | Doom The Dark Ages |
| RS09 | `heroes` | Hero Squad | per hero | hero | heroKits | hero | ultimate | Overwatch, Valorant, Apex |
| RS10 | `royale` | Last Ring | agile | loot | loot | standard | ultimate | Fortnite, Apex Legends |
| RS11 | `suit` | Weave Suit | modern | suit | pickups | standard | energy | Crysis |
| RS12 | `frame` | Frame Runner | parkour | shield | classes | standard | energy | Warframe, Destiny 2 |

### 6.2 Shared controller rules

| ID | Requirement |
|---|---|
| MOV-010 | Player and bots use identical movement code and preset values, inside the fixed 120 Hz sim step; nothing frame-rate dependent. |
| MOV-011 | Ground: friction `speed -= max(speed, stopSpeed)*friction*dt`, then accelerate `add = min(accel*wishSpeed*dt, wishSpeed - dot(vel,wishDir))` if > 0. |
| MOV-012 | Air: same formula with `airAccel` and wish speed capped at `airWishCap` (this projection rule produces strafe-jumping/air-strafing; no special-case code). |
| MOV-013 | No auto-repeat jump while held (unless mutator X25); jump buffered 0.10 s before landing. `bhopCap` clamps landing speed to cap x groundSpeed when set. |
| MOV-014 | Landing faster than 15 m/s locks jump 0.25 s; presets with `landingPenalty` scale speed 0.2 s. |
| MOV-015 | Fall damage: `fallMax*((v-fallSafe)/(fallLethal-fallSafe))^2` above fallSafe, to health only; fallLethal 0 = none. |
| MOV-016 | Crouch halves noise radius; uncrouch blocked without headroom. Walk in `silentWalk` presets is silent. |
| MOV-017 | Knockback `dv = 0.15*damage*knockbackScale/massFactor` m/s, cap 30 m/s; massFactor 1 actor, 2.5 heavy, 4 boss. Own explosions: full knockback, damage x selfDamage (0.5). Enables rocket/weapon jumps. The ruleset `knockback` scale is applied once, by S10, to every impulse (Damage.knockback no longer multiplies it); Tactical, Modern, Pilot, Last Ring and Weave Suit use 0.25. The ruleset `hitKnockback` scales only the push a hit gives another actor (Hero Squad 0.5: hero pools soak many hits, so full push threw most duels off ledges). |
| MOV-018 | Air-control assist (X24; default on for touch/gamepad in arena): airAccel +2 and auto-strafe toward look direction (avoids strafe-jump skill wall). |
| MOV-019 | Water: swim 50% speed, 12 s air then 2 HP/s rising 2/s to 15 HP/s ignoring armor. Ladders 3.0 m/s. Jump pads fly to designer apex; teleporters keep speed magnitude. |
| MOV-020 | Telefrag: arriving into another capsule kills the occupant (credit to arriver). Spawn logic prevents spawn telefrags (MAP-010, MAP-011). |
| MOV-021 | Weapon `moveMult` and `adsMoveMult` scale speed. Sprint stops on fire/aim; firing after sprint waits `sprintToFire` + weapon readyTime; a trigger pressed in that wait (even a one-frame tap) is kept and fires as soon as the wait ends. |
| MOV-022 | Mantle auto when moving into a ledge <= mantle height (0.35 s, weapon lowered); touch also via jump. |
| MOV-023 | Wall-run: airborne, >= minHeight above ground, speed >= 4 m/s, approach < 60 deg to a 85-95 deg wall; ends on jump, timer, or wall end; same wall not re-runnable until ground/other wall; auto on touch; <= 3 raycasts per actor per step. |
| MOV-024 | Extra jumps, glide, dash charges refill per preset rules exactly on first grounded step. |
| MOV-025 | Tactical accuracy (tactical preset): spread adds by speed fraction f: walk/f <= 0.34 +1.1 deg, crouch-move +0.8, run +5.0, air +10, landing +3 decaying 0.3 s. Counter-strafe (opposite key) must bring f <= 0.34 within 0.08 s. **T** |
| MOV-026 | Self-test verifies per preset: jump apex = jumpVel^2/(2g) within 2%, steady ground speed within 1%. |
| MOV-027 | Optional traversal board "Skimmer" (Ref UT3 hoverboard): large maps only, 13 m/s, no weapons, knocked off 2 s by any hit. |

### 6.3 Movement presets (values **T**)

| Field | MV01 `arena` | MV02 `tactical` | MV03 `modern` | MV04 `agile` | MV05 `ravager` | MV06 `knight` | MV07 `vanguard` | MV08 `parkour` |
|---|---|---|---|---|---|---|---|---|
| groundSpeed m/s | 9.0 | 6.0 | 4.8 | 5.1 | 8.0 | 6.5 | 6.8 | 6.5 |
| walk/crouch/prone | 0.5/0.25/- | 0.52/0.34/- | 0.5/0.5/0.25 | 0.5/0.45/- | 0.5/0.4/- | 0.5/0.5/- | 0.5/0.5/- | 0.5/0.5/- |
| accel/friction/stop | 10/6/3 | 5.5/5.2/2 | 12/8/2 | 12/6/2 | 14/8/2 | 10/8/2 | 11/7/2 | 12/6/2 |
| airAccel/airWishCap | 1.0/9.0 | 12/0.9 | 0.5/4.8 | 2.0/7.6 | 4.0/8.0 | 0.5/6.5 | 1.5/6.8 | 3.0/8.5 |
| bhopCap | none | 1.2 | 1.1 | none | none | 1.0 | none | none |
| gravity/jumpVel/apex | 24/8.1/1.37 | 20/6.3/0.99 | 15/5.0/0.83 | 16/6.4/1.28 | 22/7.4/1.24 | 20/5.5/0.76 | 13/6.0/1.38 | 16/6.0/1.13 |
| extra jumps | 0 (RS02: 1) | 0 | 0 | 1 @6.0 | 1 @7.0 | 0 | 0 | 1 @6.0 |
| sprint | - | - | 6.4, 5 s stamina, regen 1 s+2 s | 7.6 unlimited | - | - | - | 8.5 unlimited |
| tactical sprint | - | - | 7.6, 2.5 s, 1 charge, 8 s recharge | - | - | - | - | - |
| slide | - | - | entry 6.0, boost 8.0, 0.7 s, cd 0.6 | entry 6.0, +1.5 once/1.2 s, friction 1.5, downhill gain, slide-hop | - | - | - | as agile |
| dodge/dash | dodge double-tap 9.5+4.0 up, cd 0.7 | - | - | - | dash 7.5 m/0.15 s, 2 charges, 1.2 s each, ground-only recharge | shield charge 12 m @30 m/s to enemy <= 25 m, cd 4 s | - | roll 0.5 s -75% dmg |
| wall | - | - | - | wall-run 1.75 s @9.5, grav x0.25, jump-out 6.5+5.0 | climb grip surfaces 6 m | - | - | wall latch 6 s |
| climb/mantle m | 0/0 | 0/0 | 0/2.2 | 2.5/2.0 | 6/2.0 | 0/1.2 | 0/0 | 2.5/2.0 |
| special | strafe-jump, rocket-jump | counter-strafe, crouch-jump +0.3 m | prone optional | slide-hop momentum kept | air dash | block/parry | floaty, no sprint | bullet jump 14.5 m/s toward reticle; aim glide grav x0.15 for 3 s |
| landingPenalty | 1 | 0.7 | 0.85 | 1 | 1 | 0.9 | 1 | 1 |
| fall safe/lethal/max | >17: 5 HP, >21: 10 HP | 12.6/22/100 | 10/17/100 | none | none | 14/26/100 | 15/24/100 | none (>=20 m/s: 0.4 s stagger unless rolled) |
| sprintToFire s | 0 | 0 | 0.20 | 0.15 | 0 | 0 | 0 | 0.15 |
| Ref | Quake III, UT99/2004 | CS, Valorant | CoD4, MW2019, BF | Titanfall 2, Apex | Doom Eternal | Doom TDA | Halo CE/3 | Warframe, Destiny 2 |

## 7. Health, armor, shields, damage (HP)

| ID | Requirement |
|---|---|
| HP-001 | Damage pipeline order: friendly-fire scale -> attacker multipliers (powerup, handicap, perk, difficulty) -> hit zone x precision profile -> range falloff -> element vs shield -> victim reductions (powerup, slider, roll, block) -> overshield -> shield -> armor split -> health -> minimum 1 -> death/downed. |
| HP-002 | Precision profiles: `arena` head x1 (except weapons with headMult flagged `alwaysHead`, e.g. snipers x2); `standard` head = weapon headMult (default 2), legs 0.75; `tactical` head 4 (pistols 3.9), stomach 1.25, legs 0.75; `hero` head 2 for precision weapons, 1 otherwise. |
| HP-003 | Self splash x selfDamage; team damage x friendlyFire; minimum 1 HP per hit that passes. Gib below -40 HP (cosmetic burst). |
| HP-004 | Every damage event records source, weapon, zone, amount per layer, for kill feed, killcam-lite, medals and self-test. |
| HP-005 | Status effects (max 6 types, one stack table): Burn 10 HP/s 4 s; Chill -40% speed 4 s, 3 stacks = Freeze 3 s (frozen targets shatter: next hit x3, fodder dies); Shock stun 0.5 s (+chain); Bleed 5 HP/s 6 s bypasses armor; Toxin 6 HP/s 5 s bypasses shields; Blind (screen white/dark per ACC) <= 3.5 s. Wet floor + Shock = stun all in puddle; Oil floor + Burn = fire area 6 s. |
| HP-006 | Elements for PvE shields: kinetic, thermal, cryo, arc, toxin, void. Matching element vs coloured shield x1.5, mismatched x0.75 (NPC-004). |
| HP-007 | Downed state (squad modes): at 0 HP crawl at 1.2 m/s, bleed-out 30 s, revive 5 s by ally (bots revive per BOT-071); finished if damaged 100 HP while downed. |

| Code | Key | Name | Rules (values **T**) | Ref |
|---|---|---|---|---|
| HPP01 | `stack` | Arena Stack | Start 100 HP / 0 armor; normal cap 100; overheal to 200 and armor above 100 decay 1/s; armor cap 200, absorbs 2/3 of damage (ceil) while armor > 0. | Quake III, UT |
| HPP02 | `regen` | Regenerating | 100 HP; regen after 5 s without damage at 25 HP/s; red vignette + heartbeat below 35 HP; suppression (X44) delays regen. | CoD4, MW2019, BC2 |
| HPP03 | `shield` | Shield over Health | Shield 70 + health 50; shield recharge after 5 s, 17.5/s (4 s full); health regens in thirds (to 33/66/100%) after 8 s; head multiplier applies only to health damage. | Halo, Halo 3/Reach |
| HPP04 | `tactical` | Tactical One-Life | 100 HP, no regen; vest 100 (body), helmet (head); with armor: health takes dmg x armorPen, armor loses dmg x (1-armorPen) x 0.5; legs unprotected; lives per round = 1. | CS, Valorant |
| HPP05 | `hero` | Hero Pools | Per hero: health + armor (flat -5 per hit, max 50% reduction, not on beams/DoT) + shields (regen 30/s after 3 s); support role passive regen 15/s after 1.5 s. | Overwatch |
| HPP06 | `loot` | Loot Shields | 100 HP + shield 0-100 by armor rarity (50/75/100/125); heal by consumables (I13-I17); downed in squads. | Fortnite, Apex |
| HPP07 | `ravager` | Ravager Triangle | 100 HP / 50 armor, caps raised by Vital Shards to 200/150; armor absorbs 50%; kill resource triangle: finisher kill drops health, saw kill drops ammo, burning kill drops armor shards; ammo caps low. | Doom Eternal, Doom TDA |
| HPP08 | `suit` | Weave Suit | 100 HP regens after 6 s at 20/s; suit energy 100 recharges 25/s after 2 s; Bulwark weave (A01) routes damage into energy first. | Crysis |
| HPP09 | `limb` | Locational (mutator X49) | Head/torso/2 arms/2 legs pools 100 each mirrored to total; leg < 67% -10% speed, < 34% -25%, both destroyed: crawl; arm < 67% +0.1 deg spread, < 34% +0.2, destroyed +0.5; head/torso 0 = death. | Deus Ex |

## 8. Weapons (WPN)

| ID | Requirement |
|---|---|
| WPN-001 | Every weapon has a primary and an alternate fire mode (alt may be zoom/aim only for precision weapons, marked "zoom"). |
| WPN-002 | Hitscan = ray vs static BVH then actor hit volumes via spatial hash; projectiles = pooled swept spheres per sim step. No hit result depends on frame rate. |
| WPN-003 | Spread (deg) = base + moveSpread x f + air + recoil bloom, x adsSpreadMult when aiming; first shot standing is exact for rifles/pistols. |
| WPN-004 | Recoil: fixed per-weapon spray pattern arrays (pitch/yaw kicks per shot, 30 entries, looped) plus small seeded jitter; recovers at the pattern's rate (8 deg/s by default, 6-9 by weapon class) after 0.25 s idle. Learnable, identical for bots. |
| WPN-005 | Falloff linear from startM to endM down to minFactor. Penetration tiers (low/med/high): thin cover (wood/metal sheet) passes at 0.5/0.7/0.85 damage. |
| WPN-006 | Weapon sets (ruleset field, P3-01): every ruleset uses `fullSet` (the whole roster, 38 weapons), so each player builds a loadout from the full roster (melee, primary, secondary, lethal, tactical, device, ability, ultimate; saved, with a ready default: Breaker Maul, Hornet Carbine, Warden Pistol, Frag Charge, Glare Shell, Barrier Deploy, Surge Dash, Rally Cry); restrictions only where the mode is the restriction (Gun Game, One Shot, Rocket Pit, melee-only, heroes, puzzle tools), power weapons W45 / W46 only on pads and tools W41 / W42 only in their mode or ability. Last Ring uses `lootSet` (every gun, rarity). The themed sets stay as presets for mutator X10 and the custom editor: `arenaSet` (W01,W04,W19,W21,W23,W30,W31,W32,W36,W37,W45 power), `tacticalSet` (W02,W04,W05,W06,W09,W13,W19,W24,W25,W28), `militarySet` (W02,W04,W05,W09,W10,W13,W15,W19,W24,W25,W28,W31), `sandboxSet` (W02,W05,W12,W15,W25,W17,W10,W23,W24,W31,W32,W35), `ravagerSet` (W01,W19,W20,W26,W28,W31,W36,W39,W44,W45), `knightSet` (W03,W19,W20,W26,W34,W36,W38,W40), `exoticSet` (W07,W12,W27,W34,W37,W38,W39,W43,W44); custom sets allowed (X10). Ruleset field `abilities`: `none` (RS01-RS03; mutator X46 switches the loadout on), `kit` (RS09 heroes, RS11 Weave Suit, and, as a recorded change to the decision, RS04 Modern Ops and RS05 Pilot Rush, whose ability slot is the class field upgrade: TASKLIST Appendix C P3-01), `loadout` (RS06, RS07, RS08, RS10, RS12: an ability and an ultimate of the player's choice; RS06, RS07, RS08 and RS10 run the `ultimate` meter so the ultimate has a cost). Round buy (RS03): spawn with melee and secondary, the buy menu lists every priced combat weapon and the loadout primary is the one-tap quick buy (key Q); classes (RS04, RS05, RS12) pick their primary and secondary from the whole roster; bots build a loadout from the roster by their favourite, the map's size and their style, with gadgets and abilities chosen by their botUse rules. A locked unlock shows its requirement and progress, and a new unlock gives a toast and a "New" badge until the profile is opened (P3-07). |
| WPN-007 | Ammo tiers when `ammoTiers` on (Destiny): primary infinite reserve, special scarce drops, heavy rarest. Arena: ammo cap per type, weapon pickup gives ammo if owned. |
| WPN-008 | Loot rarity (ECO) multiplies damage 1.00/1.05/1.10/1.16/1.22 and mag +0/0/10/20/30%. |
| WPN-009 | Weapon respawn 5 s FFA, 30 s team modes (x itemRespawnScale); weapon stay option. Power weapons (W45,W46) one per map, 120 s, announced 10 s before. |
| WPN-010 | Damage values below are for 100 HP baseline; precision profile applies (HP-002). Equip 0.4 s default; switching never faster than equipTime, except that equip attachments and perks may shorten a swap down to 0.8 x equipTime (EQUIP_SCALE_FLOOR). |
| WPN-011 | Underbarrel/explosive alt fires have arm distance >= 6 m and low reserves (avoid grenade-launcher spam). |
| WPN-013 | Shots leave the muzzle (P2-03): projectiles, tracers and muzzle flashes start at the weapon model's muzzle (the view model's in first person, the held model's for everyone else, bots included) and projectiles fly to the point under the crosshair (the nearest actor or wall on the eye ray, 120 m when there is none); lobbed projectiles (gravity) keep the eye direction. Hitscan damage is traced from the eye along the aim ray, so hit results do not change; only the tracer starts at the muzzle. When a wall lies between the eye and the muzzle, a wall or player stands within 1.5 m on the eye ray, or a wall is on the way from the muzzle to the aim point, the shot leaves the eye, so nothing passes a wall in front of the shooter and a player at arm's length is hit. |
| WPN-012 | Empty and no-target feedback: a dry trigger clicks and shows a message; a primary with no rounds and nothing to reload moves the player on to the next weapon that can shoot (the Alt keeps its own ammo pool); a detonate alt works during the reload of its own weapon (W40); a lock-on weapon rings the enemy it is locking, and says `No target` when it has none. |

Columns: Primary / Alt = type, damage, rate rps, notes. Ammo = mag/reserve. All numbers **T**. Reload rules: the shot that empties the magazine starts the reload automatically, even with the trigger held; an empty alt pool only clicks; charge and lock releases short of ammo click empty and reload; with no reserve a short magazine fires what is loaded (W20: one barrel). `militarySet` spawn loadout: W02, W04, W10.

| Code | Key | Name | Class | Primary | Alt | Ammo | Benefit / drawback | Ref |
|---|---|---|---|---|---|---|---|---|
| W01 | `maul` | Breaker Maul | melee | melee 50, 2.5, reach 1.6 m | charge 0-1.2 s: 30-120 dmg; ground hit launches self up 4.5 m, 10 self dmg | - | mobility + finisher / must close in | Q3 Gauntlet, UT Impact Hammer |
| W02 | `tanto` | Edge Tanto | melee | slash 35, 2.5 | heavy stab 65, 1.0 s; 150 from behind | - | full move speed, silent / tiny reach | CS knife, TF Data Knife |
| W03 | `bulwark` | Bulwark Shield-Saw | melee | bash 40 + stagger, 1.5 | hold block (frontal 120 deg arc, 150 shield pool); tap in 0.2 s window = parry, reflects green projectiles | - | defence, parry skill / slow | Doom TDA, UT2004 Shield Gun |
| W04 | `warden` | Warden Pistol | sidearm | hitscan 25, 4, spread 0.5, falloff 20-40 m 0.7 | 3-round burst 25 each, 1.5 bursts/s, falloff 10-25 m 0.6 | 12/48 | free, accurate; 2nd pickup = dual / weak | UT Enforcer, Valorant Classic, USP |
| W05 | `verdict` | Verdict Magnum | sidearm | hitscan 55, 2.2, head x2 | zoom 2x | 6/24 | one-tap head on low HP / heavy recoil (anti dominant-pistol) | Deagle, Sheriff, HL2 .357 |
| W06 | `hush` | Hush Pistol | sidearm | silent precision pistol (P3-03): hitscan 40, 2.5, head x2.5, no tracer, noise 6 m | sleep dart: target bot sleeps 8 s, non-lethal | 10/40 + 6 darts | stealth / low dmg | Deus Ex stealth pistol, Dishonored sleep dart |
| W07 | `sparklock` | Sparklock Pistol | sidearm | lock-on: 0.4 s lock per target, up to 3 targets in 12 deg/20 m cone, 12 x8 rps auto-aim | manual hip fire 12 | 24/72 | easy hits on fodder / weak vs fast bots | Titanfall Smart Pistol |
| W08 | `twinsting` | Twin Stinger | retired (P3-03): merged into W09 `wasp`; the code is never reused |
| W09 | `wasp` | Wasp SMG | smg | hitscan 18, 13, falloff 10-25 m 0.6 | toggle hollow rounds: -15% dmg, hits slow target 20% 1 s (from the retired W11) | 30/120 | mobility moveMult 1.0 / weak range | MP5, R-97, Spectre |
| W10 | `hornet` | Hornet Carbine | smg | hitscan 15, 12 | contact grenade 80 r3.5, arm 6 m | 45/180 + 3 | versatile / few grenades | HL2 MP7 |
| W11 | `riptide` | Riptide PDW | retired (P3-03): merged into W09 `wasp` (its alt); the code is never reused |
| W12 | `needlethorn` | Needlethorn | smg | homing needles 9, 10 rps, homing 35 deg/s, falloff 12-28 m 0.6; 9 stuck = burst 40 r2 | volley 5 needles (5 ammo), 1.25/s | 30/90 | forgiving aim / slow projectiles | Halo needler |
| W13 | `vanguard` | Vanguard Rifle | rifle | hitscan 34, 10, falloff 35-60 m 0.75, head one-taps in tactical | aim 1.3x | 25/75 | long-range one-tap / strong recoil | AK-47, Vandal |
| W14 | `tempest` | Tempest Rifle | retired (P3-03): merged into W13 `vanguard`; the code is never reused |
| W15 | `ratchet` | Ratchet Burst | rifle | 3-round burst 32 each, 3 bursts/s | scope 1.8x | 24/96 | burst TTK / misses waste burst | M16, Destiny pulse |
| W16 | `longshot` | Longshot Scout | retired (P3-03): merged into W25 `kestrel` (which takes its 15-round magazine); the code is never reused |
| W17 | `coilcaster` | Coilcaster | energy | hitscan beam 45, 1.4 | slow orb 55 r1.5 @12 m/s; hit orb with primary = combo 200 r4, costs 3 cells | 20/50 cells | skill combo / slow fire | UT Shock Rifle |
| W18 | `pulsecarbine` | Pulse Carbine | retired (P3-03): merged into W10 `hornet`; the fodder kill stays on W43; projectile P19 is retired too; the code is never reused |
| W19 | `scattergun` | Scattergun | shotgun | 10 x 12, 1.1, spread 5 | slug 55, aim 1.2x | 6/30 | burst close / pump | Q3, Nova, Fortnite pump |
| W20 | `hookjaw` | Hookjaw | shotgun | double barrel 8 x 20 (2 shells), 0.9, reload 1.1 | hook: pulls self to enemy <= 25 m, cd 6 s | 2/24 | gap closer / 2 shells | Doom Eternal super shotgun, HL2 SPAS |
| W21 | `shardcaster` | Shardcaster | shotgun | 9 bouncing shards x 12 @45 m/s | lobbed shell 100 impact + 6 shards | 10/40 | room clearing / falloff by spread | UT Flak Cannon |
| W22 | `frostbore` | Frostbore | retired (P3-03): merged into W19 `scattergun`; freezing stays on G08; the code is never reused |
| W23 | `lancet` | Lancet Rail | marksman | hitscan 100, 0.67, pierces 4, alwaysHead off | zoom 2.5x | 10/30 | one shot = 100 / slow, visible trail | Q3 Railgun, UT2004 Lightning Gun |
| W24 | `heron` | Heron Sniper | sniper | hitscan 115, 0.67, head x2.5, legs 0.75 | zoom 4x/8x, hold breath 4 s | 5/20 | one-shot body / scoped moveMult 0.5, no hipfire accuracy | AWP, Operator, UT sniper |
| W25 | `kestrel` | Kestrel DMR | marksman | semi 60, 3, head x2 | scope 3x | 15/45 | fast follow-up / mid dmg | Guardian, Marshal, BF DMR |
| W26 | `stakedriver` | Stakedriver | marksman | stake 90 @60 m/s, pins to wall; > 25 m ignites +30 burn | incendiary stake: 70, burns at any range (P3-03, replaces the lob grenade) | 12/36 + 6 | long-range punish / slow | Painkiller Stakegun, HL2 crossbow |
| W27 | `talonbow` | Talon Bow | marksman | hold draw 0.7 s: 50-110, silent, arrow drop | explosive arrow 80 r2.5 | 1/18 + 6 | silent, works underwater / drop | Turok Tek Bow, Crysis 3 bow |
| W28 | `hailstorm` | Hailstorm | heavy | hitscan 15, 18 after 0.2 s spin-up, high penetration (from the retired W29) | root as turret: rate x1.5, 30% frontal resist | 150/300 | suppression / slow move 0.75 | UT Minigun, Doom mobile turret, Turok War Horse |
| W29 | `anvil` | Anvil LMG | retired (P3-03): merged into W28 `hailstorm`; the code is never reused |
| W30 | `linker` | Linker | energy | bolts 22, 6 @40 m/s | beam 100 dps 30 m; on ally beam +50%; heals turrets/objectives 60/s | 70/140 cells | team synergy / tracking | UT Link Gun |
| W31 | `ramjet` | Ramjet Launcher | explosive | rocket 90 direct + 80 splash r3.5 @30 m/s, 1 | hold 1.2 s lock then 4 homing missiles 35 (from the retired W33; replaces the charged volley) | 4/20 | splash, rocket jump / slow | Q3/UT Rocket Launcher |
| W32 | `pitcher` | Pitcher Launcher | explosive | bouncing grenade 100 r4.5, 1.5, 2.5 s fuse | sticky mine 100 r4 (max 4): tap throws a mine on release; hold >= 0.35 s detonates all mines and throws none | 6/24 | area denial / indirect | Q3 GL, Doom sticky bombs |
| W33 | `kingfisher` | Kingfisher Pod | retired (P3-03): merged into W31 `ramjet` (its alt is the lock-on volley); the code is never reused |
| W34 | `gloop` | Gloop Gun | explosive | sticky blob 20 + 20/s puddle 3 s, 4 rps | charge 2 s: big glob 20-150 (5 ammo), splits in 3 | 25/75 | traps chokes / short arc | UT Bio Rifle |
| W35 | `kindler` | Kindler | heavy | cone 9 m 100 dps + Burn | napalm puddle 6 s, or airblast pushes projectiles | 100 fuel/200 | burns armor drops (ravager) / short range | Painkiller, Turok, Deus Ex flamethrower |
| W36 | `ember` | Ember Repeater | energy | bolt 16 + splash 10 r0.6 @60 m/s, 10 | heat blast cone 6 m, dmg = stored heat (max 120); stored heat vents 10/s after 1 s without a shot | 50/200 cells | fast DPS / projectile | Q3 Plasma, Doom plasma heat blast |
| W37 | `stormlash` | Stormlash | energy | beam 160 dps, range 24 m | chain arc: 30 to 3 targets within 6 m | 100/200 | tracking DPS / range cap | Q3 Lightning Gun, Painkiller Electrodriver |
| W38 | `starthrower` | Starthrower | energy | disc 18, 8, ricochet 2x | explosive disc 50 r1.8 | 50/150 | bank shots / predictable | UT Ripper, Painkiller driver |
| W39 | `accelerator` | Accelerator | energy | charge 3 levels: 40/90/160 (cells 2/4/8) | 360 deg shockwave r6: 60 + knockback (4 ammo) | 20/60 cells | flexible burst / charge time | Turok particle accelerator, shockwave |
| W40 | `fusionmortar` | Fusion Mortar | explosive | rolling orb, explodes 2 s: 300 r6, spares owner | detonate early | 1/1 (max 2) | room wipe / max 2 carried | Turok Fusion Cannon |
| W41 | `lifter` | Graviton Lifter | tool | punt held/near prop: dmg = 0.5 x mass x speed (cap 150) | pull and hold prop (mass <= 150 kg), catch grenades | infinite | props as ammo and shield / prop-dependent | HL2 gravity gun |
| W42 | `twingate` | Twin-Gate Projector | tool | place Dawn gate | place Dusk gate (2 max, momentum kept, puzzle modes) | infinite | puzzles / no damage | Portal |
| W43 | `auger` | Skull Auger | exotic | homing drill to nearest head 20 m, drills 2 s then 90 | none -> manual detonate | 3/9 | guaranteed kill / useless vs drones/turrets | Turok 2 Cerebral Bore |
| W44 | `razorwind` | Razorwind | exotic | returning blade 45 per pass | lodge blade in wall: laser line to you, 15/tick cuts crossers; alt again recalls | infinite | no ammo, line traps / short range | Painkiller weapon, Turok Razor Wind |
| W45 | `daybreak` | Daybreak Projector | power | slow orb 150 + splash 150 r6 @18 m/s; arcs 30/s to enemies within 8 m of orb | overcharge 2 s: x1.5 | 4 | map power item / one per map | Q3 BFG10K, Doom BFG |
| W46 | `halcyon` | Halcyon Warhead | power | slow warhead 300 r12 falloff | guided: steer by camera, user stands still | 1 | area denial / user vulnerable | UT Redeemer |

Prices/kill rewards (roundBuy, credits): sidearms 0-700 (W04 free, W05 700, W06 500, W07 600), SMG 1100-1500 (reward 600), shotguns 1100-1800 (reward 900), rifles 2400-2700 (reward 300), W24 4700 (reward 100), W25 1800, W28 4000, every other gun priced too (P3-04; 1500-4500, proposals for the Phase 8 rebalance), melee kill 1500. **T**

| Code | Projectile | Speed m/s | Gravity | Life s | Radius | Notes |
|---|---|---|---|---|---|---|
| P01 | rocket | 30 | 0 | 8 | 0.15 | explode on hit |
| P02 | grenade | 22 | 20 | 2.5 fuse | 0.10 | bounce 0.5 |
| P03 | sticky mine | 20 | 20 | 30 | 0.10 | stick |
| P04 | plasma bolt | 60 | 0 | 3 | 0.10 | small splash |
| P05 | shard | 45 | 6 | 2 | 0.05 | bounce 2x |
| P06 | energy orb | 12 | 0 | 6 | 0.40 | combo target |
| P07 | stake | 60 | 4 | 4 | 0.06 | pin |
| P08 | arrow | 40-70 by draw | 9 | 6 | 0.05 | draw sets speed |
| P09 | needle | 35 | 0 | 2 | 0.05 | homing 35 deg/s |
| P10 | goo blob | 28 | 15 | 8 | 0.20 | stick, puddle |
| P11 | disc | 35 | 0 | 3 | 0.15 | ricochet 2 |
| P12 | fusion orb | 6 rolling | 20 | 2 | 0.50 | owner-safe |
| P13 | warhead | 14 | 0 | 15 | 0.50 | guided |
| P14 | contact grenade | 30 | 15 | 5 | 0.10 | arm 6 m |
| P15 | missile | 28 | 0 | 6 | 0.12 | homing 120 deg/s |
| P16 | hook | 60 | 0 | 0.4 | 0.20 | pull |
| P17 | drill | 20 | 0 | 6 | 0.08 | homing 90 deg/s, drills 2 s |
| P18 | blade | 30 | 0 | 1.2 | 0.25 | pierces, returns |
| P19 | dark orb | retired (P3-03) with W18; the code is never reused | | | | |
| P20 | Daybreak orb | 18 | 0 | 6 | 0.50 | explode on hit |
| P21 | bullet | 320 | 0 | 1 | 0.02 | X41 ballistics pellet |

## 9. Grenades and gadgets (GAD)

| ID | Requirement |
|---|---|
| GAD-001 | Grenade button independent of held weapon; carry limits per economy (arena pickups, round buy max 4: 1 each type, 2 flash). |
| GAD-002 | Thrown gadgets: hold to cook (frag), release to throw 18 m/s +5 up; underhand on alt. Bots use same physics (BOT-065). |
| GAD-003 | Placed gadgets per actor limit 1 each type (claymore-spam mistake); enemy placed gadgets visible within 8 m (red glint). |

| Code | Key | Name | Effect (**T**) | Counter | Ref |
|---|---|---|---|---|---|
| G01 | `frag` | Frag Charge | 2.5 s fuse (cookable), 100 r5 falloff | throw back with W41 / run | Halo, CS HE |
| G02 | `smoke` | Veil Canister | sight-blocking volume r5, 18 s; bullets/explosions punch holes 2 s | wait / flank | CS2 smoke |
| G03 | `flash` | Glare Shell | blind <= 3.5 s by view angle/distance; option dark flash | turn away | CS flashbang, Halo flare |
| G04 | `incendiary` | Cinder Jar | fire area r3, 7 s, ramps to 40 HP/s; smoke extinguishes | smoke / avoid | CS molotov |
| G05 | `decoy` | Mimic Shell | retired (P3-06): merged into A33 Holo Double, which also plays the owner's weapon sound | - | - |
| G06 | `sticky` | Leech Charge | sticks to actors/surfaces, 1.5 s, 110 r3.5 | none once stuck | Halo plasma grenade |
| G07 | `impulse` | Kick Charge | knockback 18 m/s r4, 10 dmg, self-launch mobility | - | Fortnite impulse, Apex |
| G08 | `cryo` | Rime Bomb | Freeze 3 s r4, stops teleport/cloak | - | Doom ice bomb |
| G09 | `singularity` | Sink Charge | pull to centre 4 s r6 then 60 | dash out | Apex Horizon |
| G10 | `claymore` | Tripjaw Mine | proximity 2.5 m cone, 150, arm 1.5 s, max 1 | shoot it / crouch | CoD4 claymore, Halo trip mine |
| G11 | `prox` | Burr Mine | retired (P3-06): merged into G10 Tripjaw Mine | - | - |
| G12 | `bubble` | Dome Projector | retired (P3-06): A26 Aegis Dome keeps the effect | - | - |
| G13 | `cover` | Barrier Deploy | wall 2x1.2 m, 300 HP, 30 s | explosives | MW deployable cover, BF6 |
| G14 | `liftpad` | Lift Pad | retired (P3-06): A10 Updraft keeps the effect | - | - |
| G15 | `sentry` | Picket Turret | 150 HP, 12 dmg 5 rps, 25 m, 40 s | flank/explosive | TF2 sentry, Halo turret |
| G16 | `regen` | Mend Field | retired (P3-06): A25 Mender Drone keeps the effect | - | - |
| G17 | `drain` | Sap Field | retired (P3-06): merged into G20 Null Pulse, which also empties the suit energy | - | - |
| G18 | `jammer` | Static Jammer | scrambles enemy radar/minimap r20 30 s | destroy 50 HP | Halo 3 jammer, TF2 boost |
| G19 | `dart` | Echo Dart | retired (P3-06): A13 Echo Pulse keeps the effect (H08 Tamsin's gadget is G20) | - | - |
| G20 | `emp` | Null Pulse | disables gadgets/abilities/shields regen 4 s r6 | - | Deus Ex EMP |
| G21 | `ticks` | Scuttler | 2 seeking mini-drones 30 m, 80 each | shoot 20 HP | TF2 Ticks |
| G22 | `trophy` | Snatcher | destroys first 3 enemy projectiles within 6 m, 30 s | bullets | MW trophy |
| G23 | `ammobox` | Supply Crate | team ammo refill r3 20 s | - | MW munitions, BF support |
| G24 | `beacon` | Rally Beacon | team spawn point 1 per team, 60 s, 100 HP | destroy | BF spawn beacon, MW tac insert |

## 10. Abilities and powers (ABL)

| ID | Requirement |
|---|---|
| ABL-001 | Abilities are used through ruleset loadouts: hero kits (HERO table), class loadouts (1 tactical + 1 ultimate), suit modes (A01-A04 on one energy bar), or mutator X46 "Powers for all". |
| ABL-002 | Resources: cooldown, charges, energy (100, regen 5/s, orbs from kills +25), ultimate points (5/s passive + 1 per damage/heal dealt; cost 1000-2000). |
| ABL-003 | Each ability defines counterplay and a bot-use rule; bots use abilities only when the trigger condition is perceived (BOT-066). |
| ABL-004 | Time manipulation (A19) slows world but not the user only in single-player modes; in versus bot modes it becomes a local slow field r8. |
| ABL-005 | Wrath Form (A34) has a visible timer; soul orbs home to the player within 6 m (fixes despawning souls). |

| Code | Key | Name | Category | Activation / resource | Effect (**T**) | Ref |
|---|---|---|---|---|---|---|
| A01 | `bulwark` | Bulwark Weave | suit | toggle, energy | damage drains energy 1:1 before health; energy regen x2 while on | Crysis armor |
| A02 | `overdrive` | Overdrive Weave | suit | toggle, energy 20/s while sprinting | speed x1.5, sprint 10 m/s | Crysis speed |
| A03 | `colossusweave` | Colossus Weave | suit | toggle, energy per use 15 | jump x1.8, melee x2, throw props/bots, steady aim | Crysis strength |
| A04 | `phantasm` | Phantasm Weave | suit | toggle, 8/s moving, 2/s still | near-invisible; firing empties energy | Crysis cloak |
| A05 | `shadowstep` | Shadow Step | mobility | instant, energy 20% | teleport to aimed point <= 10 m (15 m upgraded), ledge grab | Dishonored Blink |
| A06 | `phaseslip` | Phase Slip | mobility | instant, cd 12 s | 2 s invulnerable, cannot fire, throw or use gadgets and offensive abilities (a cooked grenade is put away) | Titanfall phase shift |
| A07 | `grapnel` | Grapnel | mobility | instant, cd 10 s | hook geometry <= 30 m, pull 18 m/s; pulls enemies | TF2 grapple, Apex |
| A08 | `surge` | Surge Dash | mobility | 3 charges, 3 s each | 7 m blink-dash in input direction | Overwatch Tracer |
| A09 | `rewind` | Rewind Anchor | mobility | instant, cd 15 s | return to position/HP of 3 s ago | Tracer recall, TF2 phase rewind |
| A10 | `updraft` | Updraft | mobility | instant, cd 20 s | lift column 10 m 5 s, allies too | Apex Horizon, Valorant |
| A11 | `glidepack` | Glidepack | mobility | hold, fuel 3 s refills on ground | hover/glide, gravity x0.1 | Destiny glide, Halo jetpack |
| A12 | `relocator` | Relocator | mobility | throw beacon, 6 charges regen 1/s | teleport to beacon, telefrag; flag drops on use | UT Translocator |
| A13 | `echopulse` | Echo Pulse | recon | instant, cd 20 s | 3 pulses reveal enemies 15 m through walls 1 s each | TF pulse blade, active radar |
| A14 | `huntersight` | Hunter Sight | recon | toggle, energy 5/s | see actors and their vision cones through walls 30 m | Dishonored Dark Vision |
| A15 | `scoutdrone` | Scout Drone | recon | channel, cd 40 s | piloted drone 20 s; ends in EMP r5 | Apex Crypto, Deus Ex spy drone |
| A16 | `tracker` | Tracker Sense | recon | passive | enemy footprints visible 8 s, one ring per enemy, none for crouch-walk or quiet steps | Bloodhound, MW Tracker |
| A17 | `veil` | Veil Curtain | control | 2 charges, 30 s | smoke wall 12 m x 3 m, 15 s | Apex Bangalore, Valorant controller |
| A18 | `fence` | Static Fence | control | 4 charges, 15 s | node-link fence: 20 dmg + slow 60% 1.5 s | Apex Wattson |
| A19 | `timebend` | Time Bend | control | instant, energy 60% | world x0.25 for 6 s (SP) / slow field r8 (versus) | Dishonored Bend Time, Painkiller Haste |
| A20 | `gale` | Gale Push | control | instant, cd 8 s | cone 8 m knockback 20 m/s, deflects projectiles | Dishonored Windblast |
| A21 | `binding` | Binding Link | control | instant, cd 20 s | link 2 enemies 8 s: damage to one is shared | Dishonored Domino |
| A22 | `mesmer` | Mesmer Lure | control | instant, cd 25 s | 2 enemies within 15 m stare at a lure 6 s | Dishonored Mesmerize |
| A23 | `puppet` | Puppet Jump | control | instant, cd 40 s | control a fodder enemy/beast 10 s | Dishonored Possession |
| A24 | `frenzy` | Frenzy Hex | control | projectile, cd 30 s | target attacks its allies 8 s | BioShock Enrage, Painkiller Confusion |
| A25 | `mender` | Mender Drone | sustain | deploy, cd 30 s | heals allies in 6 m 20 HP/s 8 s | Apex Lifeline |
| A26 | `aegisdome` | Aegis Dome | sustain | instant, cd 30 s | dome r5 blocks bullets 12 s | Apex Gibraltar |
| A27 | `secondwind` | Second Wind | sustain | instant, cd 60 s | revive downed ally within 10 m remotely | Lifeline, Valorant Sage |
| A28 | `ampwall` | Amp Wall | sustain | deploy, cd 20 s | wall blocks incoming, own shots through it +25% | Titanfall A-Wall |
| A29 | `arcbolt` | Arc Bolt | offense | instant, energy 25 | 30 + Shock 1 s; wet = all in puddle | BioShock Electro Bolt |
| A30 | `ignite` | Ignite | offense | retired (P3-06): merged into A29 Arc Bolt; burn stays on G04 and W35 | - | - |
| A31 | `frostlance` | Frost Lance | offense | retired (P3-06): merged into A29 Arc Bolt; freezing stays on G08 | - | - |
| A32 | `swarm` | Swarm Cloud | offense | projectile, cd 25 s | swarm follows target 6 s, 8 HP/s, panics fodder | Devouring Swarm, Insect Swarm |
| A33 | `holodouble` | Holo Double | offense | instant, cd 15 s | decoy runs your last input 8 s; bots may be fooled per alertness | TF2 holo pilot, Apex Mirage |
| A34 | `wrath` | Wrath Form | ultimate | auto at 66 souls (or card) | 8 s invulnerable, any touch/hit kills non-boss | Painkiller demon morph |
| A35 | `lifterpower` | Graviton Grip | physics | hold, energy 10/s | telekinesis pick/throw (as W41) without weapon slot | HL2 gravity gun, BioShock Telekinesis |
| A36 | `gatepair` | Gate Pair | portal | instant, 2 gates | place gates on portal surfaces (puzzle/challenge only) | Portal |
| A37 | `overcore` | Overcore | ultimate | ult 1500 | damage x2 + fire rate x1.2 10 s | Titanfall Damage Core |
| A38 | `orbital` | Orbital Lance | ultimate | ult 1800 | marked 8 m circle, 2 s warning, 250 dmg | Apex artillery, Ion Painter |
| A39 | `rift` | Rift Gate | ultimate | ult 1500 | linked portals 60 m for team, 15 s | Apex Wraith |
| A40 | `rally` | Rally Cry | ultimate | ult 1200 | team +50 overshield (capped at a 100-point surplus, lost after 8 s), speed x1.2 8 s | Overwatch support ults |

Hero kits (RS09; each: weapon, passive, 2 abilities, ultimate):

| Code | Key | Name | Role | HP (health/armor/shield) | Weapon | Kit | Ref |
|---|---|---|---|---|---|---|---|
| H01 | `bastide` | Bastide | tank | 450/200/0 | W19 | passive knockback resist 30%; A26, W03 alt block; ult A38 | Overwatch tank, Gibraltar |
| H02 | `moraine` | Moraine | tank | 250/0/100 | W28 | passive shield regen 30/s after 2 s; A07, A28; ult A40 | Overwatch Orisa, TF Legion |
| H03 | `quill` | Quill | damage (duelist) | 200/0/0 | W13 | passive +25% speed 2.5 s after kill; A08, A09; ult A37 | Tracer, Valorant duelist |
| H04 | `tessaly` | Tessaly | damage (sniper) | 200/0/0 | W24 | passive scope info; A11, A13; ult A39 | Widowmaker, Vantage |
| H05 | `brask` | Brask | damage (demo) | 225/0/0 | W32 | passive extra grenade; A18, G09; ult A38 | Fuse, Junkrat |
| H06 | `lark` | Lark | support | 200/0/0 | W30 | passive regen 15/s after 1.5 s; A25, A27; ult A40 | Mercy, Lifeline |
| H07 | `mirelle` | Mirelle | support (controller) | 225/0/0 | W12 | passive smoke vision; A17, A22; ult A19 field | Valorant controller |
| H08 | `tamsin` | Tamsin | initiator | 200/0/0 | W25 | passive tracker A16; A15, G20; ult AX1 global pulse | Valorant initiator, Bloodhound |

## 11. Powerups and pickups (PWR)

| ID | Requirement |
|---|---|
| PWR-001 | Item timers: health 35 s, armor 25 s, powerups 120 s (first spawn 45 +/- 15 s after start), dropped items vanish after 30 s; x itemRespawnScale. Timers are exact so bots and players can time them. A picked spot shows an empty dark pad with a fill that grows as the item comes back; the item returns exactly at its timer. |
| PWR-002 | Powerup pickup and expiry announced (text + sting); 10 s warning before power items respawn. |
| PWR-003 | Carried powerup drops on death with remaining time (min 5 s). |

| Code | Key | Name | Effect (**T**) | Respawn | Ref |
|---|---|---|---|---|---|
| PU01 | `fury` | Fury Core | damage x3, 30 s | 120 s | Q3 Quad, UT UDamage |
| PU02 | `warding` | Warding Shell | damage taken x0.5, immune splash/fall/hazard, 30 s | 120 s | Q3 Battle Suit |
| PU03 | `quickening` | Quickening | speed and fire rate x1.3, 30 s | 120 s | Q3 Haste |
| PU04 | `ghostveil` | Ghostveil | shimmer invisibility 30 s (bots perceive at 25% range) | 120 s | Q3 Invisibility |
| PU05 | `renewal` | Renewal | +15 HP/s to 110, then +5/s to 200, 30 s | 120 s | Q3 Regeneration |
| PU06 | `skyward` | Skyward | free flight, 30 s | 120 s | Q3 Flight |
| PU07 | `surplus` | Surplus Orb | retired (P3-06): I04 Mega Cell stands in on maps; the surplus pool stays as A40 Rally Cry's effect | - | - |
| PU08 | `aegisbelt` | Aegis Belt | retired (P3-06): I07 Heavy Plate stands in | - | - |
| PU09 | `berserk` | Berserk Fist | melee kills fodder in 1 hit, melee x4, 20 s, heals to 100 | 120 s | Doom berserk, UT Berserk |
| PU10 | `sigil` | Invulnerability Sigil | invulnerable 10 s | 180 s | UT3, Q3TA, Painkiller Iron Will |
| PU11 | `bottomless` | Bottomless | no ammo use, 30 s | 120 s | Painkiller Magic Gun |
| PU12 | `vampfang` | Vampire Fang | 30% of damage dealt heals, 30 s | 120 s | Painkiller Health Stealer |
| PU13 | `seer` | Seer Orb | team sees enemies on minimap 15 s | 90 s | CoD UAV, TF Map Hack |
| PU14 | `springboots` | Spring Boots | 3 jumps x2 height, no fall damage | 60 s | UT Jump Boots |
| PU15 | `guardianrune` | Guardian Rune | persistent until death: max HP/armor x2, speed x0.9 | 60 s | Q3TA Guard |
| PU16 | `scoutrune` | Scout Rune | retired (P3-06): merged into PU03 Quickening | - | - |
| PU17 | `ammorune` | Ammo Rune | retired (P3-06): merged into PU11 Bottomless | - | - |
| PU18 | `soul` | Soul Shard | dropped by kills, +1 HP, 66 = Wrath Form (A34) | - | Painkiller souls |
| PU19 | `lightbearer` | Bearer Flame | never-expiring Fury Core for mode M24 | - | Painkiller Light Bearer |
| PU20 | `vitalshard` | Vital Shard | +25 max HP or +25 max armor (ravager caps) | map spots in Ravager health matches (HPP07) | Doom Sentinel crystal |

| Code | Item | Effect | Cap | Respawn |
|---|---|---|---|---|
| I01 | Health Vial | +5 | 200 | 35 s |
| I02 | Health Pack | +25 | 100 | 35 s |
| I03 | Health Crate | +50 | 100 | 35 s |
| I04 | Mega Cell | +100 | 200 | 35 s |
| I05 | Armor Shard | +5 | 200 | 25 s |
| I06 | Light Plate | +50 | 200 | 25 s |
| I07 | Heavy Plate | +100 | 200 | 25 s |
| I08 | Ammo box | 1 type, weapon-sized | maxAmmo | 25 s |
| I09 | Ammo cache | all types +50% | maxAmmo | 40 s |
| I10 | Weapon pad | weapon + ammo | - | 5/30 s |
| I11 | Helmet (tactical) | head armor | 1 | buy |
| I12 | Vest (tactical) | 100 body armor | 100 | buy |
| I13 | Patch (loot) | +15 HP, 3 s, to 75 | stack 10 | loot |
| I14 | Med Kit (loot) | full HP, 8 s | 3 | loot |
| I15 | Cell (loot) | +25 shield, 2.5 s | 6 | loot |
| I16 | Battery (loot) | full shield, 5 s | 3 | loot |
| I17 | Fizz Can (loot) | +75 HP overflow to shield, 2 s | 2 | loot |

## 12. Economy and loadouts (ECO)

| ID | Requirement |
|---|---|
| ECO-001 | Economy rules are shown in-game (buy menu panel shows loss ladder and next-round minimum). |
| ECO-002 | No currency persists between matches; offline unlocks never give stat advantages (anti pay-to-win). |
| ECO-003 | Meters: `streak` score-based (not kill-based) rewards at 300/500/800 points: Seer pulse, Strike call (A38), Picket swarm; `boost` TF-style meter fills by time+score, reward at 50/80%; `adrenaline` 0-100 (+5 kill, +10 spree, +25 cap), 4-tap combos Speed/Booster/Veil/Berserk 20 s; `ultimate` ABL-002; `energy` ABL-002. |

| Code | Key | Name | Rules (**T**) | Ref |
|---|---|---|---|---|
| ECP01 | `pickups` | Map Pickups | start W04 (+W01 melee); everything else from map items; weapon stay optional | Q3, UT, Halo |
| ECP02 | `roundBuy` | Round Buy | start 800 each half; max 9000; win 3000, loss ladder 1900/2400/2900 (resets after a win); kill 200 + class reward bonus (WPN prices table); plant +300 each attacker; buy phase 15 s; unspent carries over | CS, Valorant |
| ECP03 | `loot` | Loot Rarity | 5 slots, chests/floor loot, rarities common/uncommon/rare/epic/legendary (grey/green/blue/purple/gold) with WPN-008 scaling; ammo types light/heavy/shells/cells/rockets | Fortnite, Apex |
| ECP04 | `classes` | Classes and Perks | primary + secondary + 1 lethal + 1 tactical + 3 perks (1 per tier) + field upgrade (recharge 60-120 s); 6 preset classes + 10 custom | CoD4, MW2019, BF |
| ECP05 | `heroKits` | Hero Kits | pick hero at spawn, switch in spawn room | Overwatch |
| ECP06 | `ladder` | Weapon Ladder | fixed weapon per tier (gun game) | CS Arms Race, Apex Gun Run |
| ECP07 | `waveShop` | Wave Shop | cash per kill 10-100 by enemy, wave bonus 700, flawless +100; shop between waves (Amp ammo 100, Barrier 400, Turret 1200, Core shield 1200) | Titanfall Frontier Defense |

Perks (ECP04): Tier 1 Scavenger (ammo from bodies), Bandolier (+50% ammo), Hardline (streak -100 pts), Tune Up (+50% field upgrade); Tier 2 Hardened (-20% bullet dmg, cancelled by Stopping), Stopping (+20% bullet dmg), Ghost (hidden from Seer/minimap), Quickhands (reload x1.5); Tier 3 Marathon (sprint x2), Steady (hip spread -30%), Quietstep (silent), Last Stand (pistol while downed, team modes only). Field upgrades: G13, G22, G23, G24, Echo pulse A13.

## 13. Game modes (MODE)

| ID | Requirement |
|---|---|
| MODE-001 | Each mode lists exact defaults; all are editable in custom match. Ties: play on in sudden death until a lead exists (max +3 min then draw). |
| MODE-002 | All modes playable solo with bots filling every slot; team size default 4v4 unless stated, max by PERF-009. |
| MODE-003 | Scoreboard always available (UI-010). |
| MODE-004 | Objective logic is finite-state (capture meters 0-100, payload spline position, timers); bots read the same objective state (BOT-080). |
| MODE-005 | The menus list 15 modes: 31 rows stay (ids and codes never change), 16 of them are variants of a parent mode (`variantOf`, short `variant` label; table "Menu modes and variants" below). A variant plays with its own row defaults; every menu shows it as "<mode> - <variant>" (for example "Frenzy - Duel 1v1"). Saves, share codes, maps, the ladder and the daily seed keep the old ids: no migration. |
| MODE-006 | Eight curated cards are shown first (Frenzy, Team Clash, Holdfast, Flag Raid, Detonate, Arms Ladder, Last Ring, Siege Waves), each with a fixed map and the row's own defaults; Detonate's card plays first to 5 rounds (max 9, sides switch after 4) instead of 7. Every other mode is under Play > All modes. |

| Code | Key | Name | Rules and defaults (**T**) | Ref |
|---|---|---|---|---|
| M01 | `ffa` | Frenzy (FFA) | 8 players, frag limit 25, 10 min; +1 kill, -1 suicide; respawn 2 s / forced 10 s | Q3, UT, HL2DM |
| M02 | `tdm` | Team Clash | 4v4, 50 kills (15 in a hero ruleset), 10 min, FF 0 | all |
| M03 | `duel` | Duel | 1v1, 10 min, no frag limit; bot queue winner-stays; items on | Q3 Tournament, UT3 Duel |
| M04 | `ctf` | Flag Raid | 5v5, 3 caps, 15 min; own flag must be home to score; dropped flag auto-returns 20 s or on touch | Q3, UT, Halo |
| M05 | `oneflag` | Lone Flag | neutral flag at centre, deliver to enemy base, 5 caps | Q3 TA |
| M06 | `dom` | Holdfast | 3 points, capture 8 s uncontested (faster with more), +1 per held point per 2 s, 200 to win | UT Domination, CoD |
| M07 | `conquest` | Frontline | 8v8, 5 flags = spawn points, 150 tickets, -1 per death, bleed 1/3 s when holding <= 2 | Battlefield |
| M08 | `rush` | Breach Assault | attackers 75 tickets, 2 relays per stage x 3 stages; arm 4 s, fuse 30 s, disarm 5 s; defenders infinite | BF Rush |
| M09 | `hardpoint` | Hotpoint | one zone, moves every 60 s in fixed order, 1 pt/s uncontested, 150 to win | CoD HQ/Hardpoint, Halo KotH |
| M10 | `oddball` | Relic Run | hold relic: 1 pt/s; carrier melee only; first to 100 | Halo Oddball |
| M11 | `payload` | Convoy | attack/defend; cart moves 1.2 m/s with attackers near (more = faster to 1.8), rolls back after 10 s; 3 checkpoints; 4:00 + 2:00 per checkpoint; overtime while contested | Overwatch Escort |
| M12 | `control` | Uplink | single point, first to 100% wins round, best of 3, 240 s per round (the higher meter wins at the clock), overtime at 99% contested | Overwatch Control |
| M13 | `bomb` | Detonate | 5v5, rounds: buy 15 s, live 100 s, plant 4 s, fuse 40 s, defuse 7 s (half-progress kept at 3.5 s); first to 7 rounds, swap at 6 (the Play card: first to 5, swap at 4); one life | CS, Valorant |
| M14 | `elim` | Last Squad | team rounds, one life, first to 5 rounds, 90 s + shrinking safe area last 30 s | CrossFire Elimination, Gunfight |
| M15 | `lms` | Last Standing | FFA, 3 lives, all weapons max ammo, 100 armor, no pickups except boots | UT LMS, Painkiller |
| M16 | `gungame` | Arms Ladder | 12 tiers (11 guns + the maul; `params.tiers` only shortens it), kill to advance, melee kill demotes victim, final melee kill wins | CS Arms Race, Apex Gun Run |
| M17 | `infection` | Blight | 1 infected per 6 players (scaled by the square root of the walkable floor / 3000 m²) after 20 s; infected 320 HP melee only (no grenades, gadgets or attack abilities) + leap; not on Skyward Yard (open void edges), a human who dies after the outbreak turns infected; humans win at 5 min | CrossFire Mutation, Halo Infection |
| M18 | `juggernaut` | Colossus | first kill becomes Colossus (x3 HP, x1.5 dmg, marked); kill the Colossus to become it; 1 pt per kill as Colossus, 15 to win | Halo Juggernaut, CrossFire Hero, UT Mutant |
| M19 | `cursetag` | Curse Tag | cursed actor: 50 HP, melee only, must reach a beacon to pass curse; others score by killing them | Turok Frag Tag |
| M20 | `royale` | Last Ring | 18 actors (6 squads of 3 or solo); drop-in; 6 ring phases: wait 30/25/25/20/15/10 s, shrink 30/25/20/20/15/15 s, damage 2/4/8/12/16/20 HP/s; squads downed + one respawn beacon per squad | Fortnite, Apex |
| M21 | `horde` | Siege Waves | 4 actors (player + 3 bots) defend a core 5000 HP; 10 waves; mini-boss wave 5, boss wave 10; ECP07 shop; 2 retries | Titanfall FD, CrossFire Zombie |
| M22 | `endless` | Endless Hold | endless waves, scaling +8% HP/dmg per wave (cap x4); extract option every 5 waves | Warframe Defense/Survival |
| M23 | `bank` | Mote Rush | 2 teams of 4 vs separate PvE; kills drop motes; bank 5/10/15 sends blocker; 75 banked opens invasion; 250 summons boss; first boss kill wins | Destiny Gambit |
| M24 | `bearer` | Flame Bearer | one PU19; holder scores 1/s + kills; first to 120 | Painkiller Light Bearer |
| M25 | `roulette` | Roulette Arms | everyone same infinite-ammo weapon, rotates every 30 s, no pickups | Painkiller Voosh |
| M26 | `fiends` | Ravager vs Fiends | player (or bot) Ravager 175 HP/125 armor vs 2 fiend bots that summon fodder; fiend partner 20 s to revive; best of 5, 180 s per round (the side with more alive wins at the clock) | Doom BATTLEMODE |
| M27 | `ghostops` | Ghost Ops | bomb rounds; attackers cloaked when still, melee + pistol only; footsteps audible | CrossFire Ghost |
| M28 | `contract` | Silent Contract | stealth vs PvE guards; eliminate/steal target; score = time, alarms, kills; ghost/no-kill bonuses | Dishonored, Deus Ex |
| M29 | `attrition` | Attrition | team, AI fodder minions + bots; points fodder 1, heavy 3, bot 5; 300 to win | Titanfall Attrition |
| M30 | `range` | Firing Range | dummies (stand/strafe/shoot back, shield level, distance), strafe-jump lane, aim drills | Apex Range, Overwatch |

Menu modes and variants (MODE-005). The Variant choice lists the rows in data row order, the parent row first; Play lists the parents, Match setup and the Custom editor (Mode tab: Game mode + Variant) pick the row.

| Menu mode (parent) | Variants (row, label) | Play card |
|---|---|---|
| Frenzy `ffa` | `ffa` Classic, `duel` Duel 1v1, `lms` Lives (Last Standing), `gungame` Arms Ladder, `roulette` Roulette | Frenzy; Arms Ladder (variant `gungame`) |
| Team Clash `tdm` | `tdm` Classic, `elim` One-life rounds (Last Squad), `attrition` Minions (Attrition) | Team Clash |
| Flag Raid `ctf` | `ctf` Two flags, `oneflag` One flag (Lone Flag) | Flag Raid |
| Holdfast `dom` | `dom` Three points, `conquest` Tickets (Frontline), `hardpoint` Moving hill (Hotpoint), `control` Uplink rounds | Holdfast |
| Detonate `bomb` | `bomb` Classic, `rush` Stages and tickets (Breach Assault), `ghostops` Ghost attackers (Ghost Ops) | Detonate |
| Relic Run `oddball` | `oddball` Relic, `juggernaut` Colossus, `cursetag` Curse (Curse Tag), `bearer` Flame (Flame Bearer) | none |
| Siege Waves `horde` | `horde` Ten waves, `endless` Endless (Endless Hold) | Siege Waves |
| Convoy `payload`, Blight `infection`, Last Ring `royale`, Mote Rush `bank`, Ravager vs Fiends `fiends`, Silent Contract `contract`, Firing Range `range`, Test Chambers `puzzle` | none | Last Ring |

All modes groups the 15 menu modes: Versus (Frenzy, Team Clash, Flag Raid, Holdfast, Detonate, Convoy), Party (Relic Run, Blight, Last Ring, Mote Rush, Ravager vs Fiends), Co-op and solo (Siege Waves, Silent Contract, Firing Range, Test Chambers). The progress card `endless` (C21) is a card, not the mode `endless`.

## 14. Mutators and custom match (MUT)

| ID | Requirement |
|---|---|
| MUT-001 | Custom match editor: one screen with tabs Mode, Rules (presets), Weapons, Bots, Mutators, Map; every field has a reset; settings remembered. |
| MUT-002 | Mutators are data flags/parameters applied after presets; conflicts listed per mutator are auto-resolved (last chosen wins) with a toast. |
| MUT-003 | Bots must adapt to every mutator (e.g. instagib raises dodge priority, low gravity re-weights jump links). |
| MUT-004 | Presets of the editor can be saved and shared as text codes (copy/paste string, base64 JSON). |

| Code | Key | Name | Param / effect | Ref |
|---|---|---|---|---|
| X01 | `gravity` | Gravity | 25-300% | Halo 3, UT LowGrav |
| X02 | `gamespeed` | Game Speed | 50-200% | UT, Doom TDA |
| X03 | `playerspeed` | Player Speed | 25-300% | Halo 3 |
| X04 | `dmgout` | Damage Dealt | 25-400% | Halo 3, Portal (BF) |
| X05 | `dmgin` | Damage Taken | 25-400% | Doom TDA |
| X06 | `health` | Health | start/max 25-500 | BF Portal, Fortnite Creative |
| X07 | `shields` | Shields | off / 50-300% | Halo 3 |
| X08 | `oneshot` | One-Shot | everyone W23, infinite, 1 hit, no items | UT Instagib |
| X09 | `rocketpit` | Rocket Pit | W31 only, infinite | UT Instant Rockets, Painkiller PCF |
| X10 | `weaponset` | Weapon Set | any set or custom list; random | UT Arena, CS bot_*only |
| X11 | `weaponstay` | Weapon Stay | on/off | UT |
| X12 | `dropall` | Drop on Death | none/held/all | Q3, Fortnite |
| X13 | `vampire` | Vampire | 50% lifesteal | UT2004 |
| X14 | `bighead` | Big Head | head x2.5 size | UT, Halo |
| X15 | `infammo` | Infinite Ammo | on | all |
| X16 | `nopowerups` | No Powerups | on | UT |
| X17 | `superpowerups` | Super Powerups | random powerup every 60 s to everyone | UT3 |
| X18 | `regen` | Regeneration | all +5 HP/s | UT2004 |
| X19 | `noself` | No Self Damage | self 0, knockback kept | Q3 g_ options |
| X20 | `freejump` | Free Weapon Jumps | weapon jumps cost nothing | Painkiller allowforwardrj |
| X21 | `ff` | Friendly Fire | 0/50/100% | UT3, Fortnite |
| X22 | `handicap` | Handicap | per actor 25-100% damage dealt | Q3, UT3 |
| X23 | `knockback` | Knockback | 0-300% | Q3 |
| X24 | `aircontrol` | Air Control Assist | on/off | UT2004 Air Control |
| X25 | `autohop` | Auto-Hop | hold jump repeats | Painkiller bunnyhop |
| X26 | `multijump` | Multi-Jump | 0-4 extra jumps | UT2004 QuadJump |
| X27 | `slowmokills` | Kill Slow-Mo | 1.5 s x0.5 time after your kill | UT3 Kills Slow Time |
| X28 | `headonly` | Headshots Only | body hits 0 | CS community |
| X29 | `lastgift` | Last Gift | drop live G01 on death | CoD4 Martyrdom |
| X30 | `volatile` | Volatile Ammo | ammo pickups explode when shot | UT Volatile |
| X31 | `colossal` | Growth | each kill +5% size/HP (max +50%) | UT3 Titan |
| X32 | `lives` | Lives | 1-10 | UT LMS |
| X33 | `respawn` | Respawn Time | 0-15 s; wave respawn | Fortnite Creative |
| X34 | `protect` | Spawn Protection | 0-5 s (ends on fire) | all |
| X35 | `radar` | Motion Tracker | off/team/all, 10-50 m | Halo 3 |
| X36 | `hardcore` | Hardcore HUD | no HUD, FF 100%, 30% HP | CoD Hardcore, MW Realism |
| X37 | `darkness` | Lights Out | fog, flashlights only | BioShock/HL2 dark |
| X38 | `airborne` | Sky Duel | damage only to airborne targets | Painkiller People Can Fly |
| X39 | `shrinkhit` | Diminish | hits shrink target 5% (min 50%) | IronHorizon shrink ray idea |
| X40 | `mirror` | Mirror Match | bots copy your loadout/hero | Overwatch arcade |
| X41 | `ballistics` | Ballistics | hitscan becomes projectiles with drop 9.8 m/s^2 + drag | Battlefield |
| X42 | `tags` | Confirm Kills | kills drop tags; score on pickup | CoD Kill Confirmed |
| X43 | `adrenaline` | Combos | adrenaline meter on | UT2004 |
| X44 | `suppression` | Suppression | near misses blur + spread + delay regen | Battlefield 3 |
| X45 | `itemfrenzy` | Item Frenzy | item respawn x0.25 | UT |
| X46 | `powers` | Powers for All | pick 1 ability A05-A33 per life | Deus Ex augment draft, Dishonored |
| X47 | `triangle` | Resource Triangle | finisher=health, saw=ammo, burn=armor; ammo caps x0.5 | Doom Eternal |
| X48 | `cards` | Cards Allowed | enable C-cards in versus | Painkiller |
| X49 | `limbs` | Locational Damage | HPP09 overlay | Deus Ex |
| X50 | `wildlife` | Wildlife | 4 neutral beasts attack nearest actor; a flash or fire jar lures them | Turok 2008 |

## 15. Difficulty (DIF)

| ID | Requirement |
|---|---|
| DIF-001 | Ten presets set bot tier mix and PvE sliders; every slider adjustable per save and mid-match from pause (no achievements gated). |
| DIF-002 | Sliders: bot reaction x0.5-2, bot aim error x0.5-3, aggression 0-1, max simultaneous attackers 1-8, damage to player 25-400%, damage to enemies 25-400%, enemy projectile speed 50-150%, parry window 0.1-0.5 s, resource yield 50-200%, game speed 50-120%, aim assist 0-100%, lives 0-9, checkpoint heal 0-100%. |
| DIF-003 | Optional auto-adjust (off by default): +/-1 tier after each match vs you, shown on scoreboard (no hidden rubber-banding). |
| DIF-004 | Repeated deaths in one PvE encounter (3) offer a "Guardian Plate" retry (-50% damage) once. |

| Code | Key | Name | Bot tier | Damage to player | Attackers | Aggression | Pickups | Extras |
|---|---|---|---|---|---|---|---|---|
| D01 | `stroll` | Stroll | BT0 | 40% | 1 | 0.1 | 200% | parry 0.5 s, aim assist 100, checkpoint full heal |
| D02 | `recruit` | Recruit | BT0-1 | 60% | 2 | 0.25 | 150% | parry 0.4 |
| D03 | `novice` | Novice | BT1-2 | 75% | 2 | 0.35 | 125% | |
| D04 | `regular` | Regular | BT2-3 | 100% | 3 | 0.5 | 100% | default |
| D05 | `skilled` | Skilled | BT3-4 | 125% | 3 | 0.6 | 100% | |
| D06 | `veteran` | Veteran | BT4-5 | 150% | 4 | 0.7 | 90% | |
| D07 | `elite` | Elite | BT5-6 | 200% | 5 | 0.8 | 80% | parry 0.2 |
| D08 | `masterful` | Masterful | BT6 | 225% | 6 | 0.9 | 75% | |
| D09 | `nightmare` | Nightmare | BT7 | 250% | 7 | 1.0 | 70% | parry 0.15 |
| D10 | `ascendant` | Ascendant | BT7 | 250% | 8 | 1.0 | 70% | 1 life (PvE permadeath), no checkpoints |

Cards (Painkiller-style, PvE and X48): 3 Active slots (use once per level, 30 s) + 2 Passive slots (whole level); placing costs Marks (coins from crates/kills), removing refunds half; each unlocked by a play-style challenge.

| Code | Key | Name | Type | Cost | Effect | Unlock |
|---|---|---|---|---|---|---|
| C01 | `stoneskin` | Stoneskin | active | 100 | damage taken x0.5 | finish any PvE level |
| C02 | `slowtide` | Slowtide | active | 100 | world x0.5 | destroy all props in a level |
| C03 | `soulkeep` | Soulkeep | passive | 500 | souls last x3 | kill all enemies |
| C04 | `longwick` | Longwick | passive | 100 | active cards +10 s | collect 500 Marks |
| C05 | `blessing` | Hale Start | passive | 200 | start 150 HP | boss under 2:00 |
| C06 | `refill` | Deep Pockets | passive | 500 | ammo pickups x2 | no explosives in a level |
| C07 | `fleet` | Fleetfoot | active | 100 | speed x1.3 | 100 souls in a level |
| C08 | `fury2` | Twin Fury | active | 200 | damage x2 | melee-only level |
| C09 | `darkpact` | Dark Pact | passive | 400 | Wrath Form at 50 souls | find all secrets |
| C10 | `rapid` | Rapid Hands | active | 300 | fire rate x2 | boss under 4:00 |
| C11 | `magnet` | Soul Magnet | passive | 500 | souls fly to you 15 m | collect no souls in a level |
| C12 | `encore` | Encore | passive | 1000 | active cards usable twice | 30 kills in Wrath Form |
| C13 | `greed` | Greed | passive | 2000 | Marks x2 | all optional spawns killed |
| C14 | `ironwill` | Iron Will | active | 666 | invulnerable | boss under 1:20 |
| C15 | `rage` | Rage | active | 500 | damage x4 | all secrets + no deaths |
| C16 | `hardy` | Hardy | passive | 100 | base HP 150 | no armor pickups in a level |
| C17 | `freecards` | Patron | passive | 0 | cards placed at half price (hard difficulty only) | finish a level with no cards |
| C18 | `lastbreath` | Last Breath | passive | 500 | revive once at 33 HP | find all secrets on hard |
| C19 | `discord` | Discord | active | 200 | enemies fight each other 15 s | 3 Wrath Forms in a level |
| C20 | `redeemer` | Soul Feast | passive | 1000 | souls heal x2 | keep HP > 50 whole level |
| C21 | `endless` | Endless Clip | active | 300 | no ammo use | kill <= 88 enemies in a level |
| C22 | `onehp` | Brittle Foes | active | 300 | enemies 1 HP | single-weapon level |
| C23 | `regenhp` | Mending | passive | 1000 | HP regrows to 75 at 3/s | boss under 4:00 on hard |
| C24 | `thief` | Life Thief | passive | 2000 | 5% damage dealt heals | defeat final boss under 4:00 |

## 16. Bot AI (BOT)

Architecture: per bot = Perception -> Memory -> Decision (utility goals, re-scored 2 Hz staggered) -> State machine (execution) -> Motor (same input commands as player). Team layer: commander + squads. PvE layer: director (Section 17).

| ID | Requirement |
|---|---|
| BOT-001 | Bots produce the same input command struct as the player (move, look delta, buttons) and go through identical movement, weapon and ability code. |
| BOT-002 | States: Spawn, Roam/SeekGoal, Collect, Engage, Chase, Retreat, Camp/Hold, Objective, Investigate, Search, Downed, Revive, Follow, Dead. Transitions only from the decision layer or perception events. |
| BOT-003 | Perception: vision cone (tier FOV, BT table) x range `25 + 75 x alertness` m; LOS raycast budgeted (BOT-091); visibility factor = light x stance (crouch 0.7, prone 0.4) x movement (still 0.6) x cloak (0.25) x smoke (0); peripheral detection slower. |
| BOT-004 | Hearing: every sound event has noise radius (DATA-001); heard if within radius x hearing trait; position known with uncertainty = 15% of distance; through walls radius x0.6. |
| BOT-005 | Awareness states (stealth modes and PvE): Unaware -> Suspicious (meter 30) -> Searching (60) -> Alert/Combat (100). Meter fills by sight (closer, lit, moving = faster; 0.6-2.5 s to full **T**), noise, seen corpses; decays after 6 s unseen; alerts propagate to allies within 15 m by bark. Indicator above head (UI-014). Bots look up only when alerted (vertical cone +20 deg unaware, +60 alerted). |
| BOT-006 | Reaction time: first shot no earlier than tier reaction (BT table) + seeded jitter +/-20%, floor 150 ms; re-acquire after losing LOS uses 50% of it. |
| BOT-007 | Memory: last known position + velocity per enemy, decays 10 s; items with respawn times; damage sources (vengefulness). |
| BOT-010 | Navigation graph generated at map load from walkable surfaces: 1 m cell sampling -> merged regions -> nodes; links: walk, jump (gap <= preset reach, up <= apex), drop (<= 6 m or no-fall-damage presets more), jump pad, teleporter, ladder, wall-run (parallel wall pairs 3-5 m), rocket-jump (only if preset/trait allow), dash/double-jump. Cost = travel time per preset. Must finish < 300 ms on Low for a 120x120 m map, cached per map+preset. At match load the build runs in 6 ms slices per frame and the graph is empty until `nav.ready`. |
| BOT-011 | Pathing: A* on cluster graph then node graph, time-sliced (<= 4 queries per tick), path smoothing by string-pulling; dynamic avoidance (other actors, fire areas, mines seen). |
| BOT-012 | Stuck recovery: no progress 1.5 s -> jump/strafe; 3 s -> repath excluding the link; 6 s -> pick new goal; logged to debug. Self-test fails if any bot is stuck > 6 s in soak test (ARC-033). |
| BOT-013 | Item timing: bots with itemFocus trait > 0.5 schedule pickups using exact timers (PWR-001), arriving 1-3 s early. |
| BOT-020 | Goal scoring (utility, 0..1 each, x trait weights): attack visible enemy, chase, retreat (health < 40 or bad weapon), collect item (value / travel time), objective (mode weight), camp (camper trait, strong weapon), help ally (ping/request), revive, investigate sound, follow order. Highest wins with 10% hysteresis. |
| BOT-021 | Aggression formula: 0 if health < 60 (and armor < 40) or enemy 6 m+ above; 0.7 with Fury; else best-weapon table (power/rail 0.95, rocket 0.9, plasma 0.85, shotgun 0.5); x aggression trait. Retreat if < 0.5, chase if > 0.5. |
| BOT-030 | Aim model per tick: aim point = predicted target point (lead with aimSkill: exact > 0.8, linear > 0.4, none below; splash weapons aim at feet when aimSkill > 0.6) + error offset; error = tier error deg x (1 - accuracy x 0.5) x (1 + target speed/10) x (1 + own speed/10), smoothed noise (0.4 s period), shrinks over 0.6 s of tracking ("settle"). Turn rate capped by tier; critically damped spring smoothing. |
| BOT-031 | Bots obey spread, recoil patterns (control by spray trait), reload, and fire throttling. They prefer head aim only from tier 4. |
| BOT-032 | Combat movement: tier 0 stands; tier 1 walks; tier 2+ strafes (flip chance 6.5% per 0.4 s check), keeps ideal range per weapon botPref, back-off 10%; jumps/dodges per jumpiness; crouch peek per croucher trait; cover use: move to cover node when reloading or health < 50. |
| BOT-033 | Projectile dodge only when the projectile is seen, after reaction time, success chance <= 60% at BT7 (no perfect dodging). |
| BOT-034 | Grenades: throw at enemies behind cover/known position when 2+ clustered or holding a point; arc solved analytically; smoke on chokes when attacking site; flash before peek (tier 3+). |
| BOT-035 | Abilities: each ability has a trigger rule (e.g., heal when ally < 50% in range, dome when 2+ allies under fire, dash to cover when hurt); ultimate when >= 2 enemies affected or objective contested. |
| BOT-036 | Weapon choice: by range and botPref value x favoriteWeapon bonus 0.2; switch only out of combat or when empty. |
| BOT-040 | Fairness: bots never know positions they did not perceive or remember; no wallhack at any tier; no aim through smoke; no instant 360 turns; no perfect reaction; spawn-protected targets ignored; no damage bonus at any tier (difficulty damage sliders only affect PvE and are shown). |
| BOT-041 | Anti spawn-camp: bots do not hold positions with LOS to enemy spawns > 10 s. |
| BOT-042 | Easy-fragger rule: low tiers do not shoot players in menus/pause (game paused) and give a 1 s grace after the player respawns. |
| BOT-050 | Team commander (per bot team) assigns roles every 15 s: attack/defend/escort/freelance/hold, using mode splits (CTF both flags home 50% defend 40% attack 10% freelance; enemy flag taken 30% escort 60% defend). Player orders override for addressed bots. |
| BOT-051 | Player comm wheel orders: Attack, Defend, Hold here, Follow me, Freelance, Regroup, Cover me (smoke/suppress), Take point X; to one bot, squad or all. Bots acknowledge by bark within 0.5-1.5 s. |
| BOT-052 | Squads of 2-4 with a leader; followers detour <= 15 m for items; leader death -> followers "broken" 3-6 s (PvE) or regroup (versus). |
| BOT-053 | Tokens: team coordinator hands attack/grenade/flank tokens every 0.5 s so roles alternate (max 1 grenade token per 3 s per squad). |
| BOT-060 | Ping system (shared with player): tap = contextual ping (enemy, item, location, door, objective, danger) by raycast + 4 deg entity cone; hold = wheel: Enemy here, Going here, Attacking here, Defending here, Watching here, Looting here, Need help. Max 3 active pings per actor; enemy ping 4 s and follows last seen, others 8 s. |
| BOT-061 | Bots understand pings: pinged enemy enters memory as seen; pinged goal gets +0.4 utility for addressed/nearby bots; item pings claimed by "Dibs" reply. Bots issue pings when they spot an enemy first (max 1 per 4 s each), when taking an item, and on objective changes. |
| BOT-062 | Ping replies: Ok, No, On my way, Dibs, Thanks; shown as text + icon + synth chirp. |
| BOT-070 | Personalities: 16 traits (T table), 0..1; skill tier separate. Named roster of 24 bots for ladder. |
| BOT-071 | Revive: bots revive downed allies if no enemy within 10 m visible or with smoke cover. |
| BOT-080 | Mode brains: each mode registers goal generators (flags, points, payload, bomb sites, rings, cores) so bots play every objective; self-test runs each mode headless for 120 s and checks that score changes by objective, not only kills. |
| BOT-090 | Think rates: decision 2 Hz, perception 10 Hz (20 Hz in combat), motor every step; far/unseen bots 5 Hz. Staggered across ticks. |
| BOT-091 | Budget: <= 0.06 ms per bot per frame average, all bots <= 1.0 ms; LOS raycasts <= 96 per tick total (round-robin with priority to combat pairs); path queries <= 4 per tick. |
| BOT-093 | Hit-rate caps per tier (hitscan, vs a strafing player at 15 m, tunable, measured over 30 s windows): BT0 15%, BT1 20%, BT2 28%, BT3 35%, BT4 42%, BT5 50%, BT6 58%, BT7 65%; above the cap the bot raises its aim error until back under it. |
| BOT-092 | Debug view (F9): nav graph, paths, vision cones, awareness meters, current state/goal/scores. |
| BOT-100 | Chatter: text barks + synthesized radio blip; categories: spotted, reloading, need help, taking point, item grab, kill taunt, death, order ack, ping reply, low health, objective calls; max 1 bark per bot per 5 s, team-wide 1 per 1.5 s; "chatter" option off/minimal/normal; no insults toward the player beyond mild taunts (option to disable taunts). |

| Code | Tier | Speed | FOV deg | Turn deg/s | Reaction ms | Aim error deg | Behaviour |
|---|---|---|---|---|---|---|---|
| BT0 | Novice | 60% | 100 | 120 | 900 | 9 | no combat movement, no items timing |
| BT1 | Rookie | 70% | 110 | 160 | 700 | 7 | walks in combat |
| BT2 | Regular | 80% | 120 | 200 | 550 | 5 | strafes, uses relocator |
| BT3 | Skilled | 90% | 130 | 240 | 420 | 3.5 | jumps, double jump, item timing, flash before peek |
| BT4 | Adept | 100% | 140 | 280 | 330 | 2.5 | leads projectiles, dodges (BOT-033), head aim |
| BT5 | Masterful | 100% | 150 | 330 | 260 | 1.8 | weapon jumps, combos, flanks |
| BT6 | Inhuman | 100% | 160 | 380 | 210 | 1.3 | target switching, ability chaining |
| BT7 | Apex | 100% | 170 | 420 | 180 | 1.0 | all techniques; still no 360 vision |

| Code | Trait | Effect |
|---|---|---|
| T01 | accuracy | scales aim error |
| T02 | aimSkill | lead quality |
| T03 | reaction | scales reaction time |
| T04 | aggression | attack/chase weight |
| T05 | alertness | vision range, awareness fill |
| T06 | hearing | hearing radius |
| T07 | camper | camp weight/duration (120 + 180 x camper s) |
| T08 | jumpiness | jump/dodge frequency |
| T09 | strafing | combat movement quality |
| T10 | selfPreservation | retreat threshold |
| T11 | vengefulness | targets last attacker |
| T12 | weaponJumper | uses weapon jumps |
| T13 | teamwork | follows orders, pings, revives |
| T14 | itemFocus | item timing, power items |
| T15 | sprayControl | recoil compensation |
| T16 | abilityUse | ability/grenade frequency |

Named roster (tier / signature traits / favourite): B01 Pell (0, timid, W04), B02 Dovetail (0, camper, W24), B03 Grommet (1, jumpy, W19), B04 Ashby (1, aggressive, W09), B05 Lintel (1, teamwork, W30), B06 Mossa (2, item focus, W31), B07 Rook Varga (2, camper, W25), B08 Tilde (2, strafer, W13), B09 Corvan (3, vengeful, W21), B10 Nyx-7 (3, alert, W23), B11 Brindle (3, aggressive, W20), B12 Saffi (3, ability use, W17), B13 Halloran (4, accurate, W24), B14 Quarry (4, weapon jumper, W31), B15 Jessamy (4, item focus, W37), B16 Okoro (4, teamwork, W13), B17 Vantablue (5, flanker, W36), B18 Marrow (5, aggressive, W21), B19 Isolde Crane (5, accurate, W23), B20 Teodor (6, all-round, W17), B21 Wren Kasai (6, jumpy, W37), B22 Ostrava (6, camper, W24), B23 Calder Rhee (7, champion I, W23), B24 The Warden of Nine (7, final champion, favourite = player's most used weapon).

## 17. PvE enemies (NPC)

| ID | Requirement |
|---|---|
| NPC-001 | Enemy archetypes share bot perception/navigation but use a cheaper brain: priority list evaluated 4 Hz (flee > dodge grenade > cover when hurt > attack > pursue > idle). |
| NPC-002 | Readability: every enemy has a unique silhouette and colour; attacks telegraph >= 0.4 s; parryable attacks are green, unblockable red; weak points glow. |
| NPC-003 | Morale: leader death -> followers broken 3-6 s (flee or panic charge); fodder may flee when outnumbered. |
| NPC-004 | Elemental shields: colour = element; matching element x1.5 (HP-006). Champion tags: Barrier (shield heals unless stunned), Unstoppable (needs stagger), Overload (regen unless shocked). |
| NPC-005 | Attack tokens: max simultaneous attackers = difficulty slider; others reposition/flank/threaten. |
| NPC-006 | Visible damage: enemies show damage states at 66/33%; stagger window flash enables finisher (melee) for health drop (resource triangle). |
| NPC-007 | Director: encounters = task tree (priority, capacity, activation); squads assigned by min-cost (distance, coordination, near player); fallback at 75% losses, last stand at 25%; waves spawn out of sight >= 18 m from players; intensity rises/relaxes (relax 8 s after peak). |
| NPC-008 | No infinite respawn closets: each spawner has a finite budget per encounter; HUD shows remaining enemies count. |

| Code | Key | Name | Role | HP | Speed | Attack (**T**) | Weak point / counter | Ref |
|---|---|---|---|---|---|---|---|---|
| E01 | `husk` | Husk | fodder melee | 60 | 5.5 | claw 15 | any; drops ammo when sawed | Doom zombie, Fortnite husk |
| E02 | `gunner` | Gunner | fodder ranged | 80 | 4.5 | rifle 8 x 3 burst | head x2 | Halo Grunt, Combine soldier |
| E03 | `brute` | Brute | heavy | 600 | 3.5 | rockets 50 + stomp 40 | back vents x2 | Doom Mancubus, TF Reaper |
| E04 | `phalanx` | Phalanx | shielded | 250 + front shield | 4 | spear 30 | flank / shoot when shield lowers | Halo Jackal, Painkiller Templar |
| E05 | `stalker` | Stalker | flanker | 150 | 7 | blade 25, short teleport | track teleport arc; shock reveals | BioShock Houdini, Doom Prowler |
| E06 | `longeye` | Longeye | sniper | 100 | 4 | 70 shot, visible laser 1.5 s | break LOS, smoke | HL2 sniper, TF sniper spectre |
| E07 | `mite` | Mite Swarm | swarmer | 15 x 8 | 8 | bite 5 | splash | Halo Flood, HL2 antlion |
| E08 | `bomber` | Volt Bomber | suicide | 40 | 7.5 | explode 60 r3 | shoot at range (chain) | Painkiller Freak, TF Stalker |
| E09 | `warden` | Mender Warden | support | 200 | 4 | heals/shields allies 20/s | kill first | Warframe Eximus, Fallen Servitor |
| E10 | `charger` | Ramhorn | charger | 400 | 9 charge | charge 50 + knockdown | sidestep, stagger | Destiny Unstoppable, Doom Pinky |
| E11 | `turret` | Sentinel Turret | static | 150 | 0 | 12 x 5 rps, 3 s search | knock over, EMP | Portal turret |
| E12 | `leaper` | Leaper | flanker | 120 | 6 | pounce 30 | shoot mid-air | Turok Leaper, HL2 headcrab |
| E13 | `overlord` | Overlord | boss | 6000 | 3 | 3 phases: slam, projectile barrage (green parryable), summon E01/E07 | weak points disable attacks | Doom/Painkiller bosses, Big Daddy |
| E14 | `beast` | Wild Strider | neutral beast | 300 | 8 | bite 40 to nearest | lure with a Glare Shell or Cinder Jar | Turok 2008 dinosaurs |

## 18. Maps and procedural generator (MAP)

| ID | Requirement |
|---|---|
| MAP-001 | Map data = brushes (AABB, ramp, wedge, cylinder-low-poly) with material id, plus spawns, items, objectives, callout zones, nav hints, light probes; stored as compact arrays in the HTML. Validated at load (closed, no actor stuck, every spawn reaches every item). |
| MAP-002 | Lanes: every area offers >= 3 routes (left/mid/right "window pane"); no dead-end longer than 15 m without an item reason. |
| MAP-003 | Sightlines: max 60 m in arena maps, 90 m in large maps; long sightlines need cover every 15 m. |
| MAP-004 | Cover heights 1.0 m (crouch cover) and 1.8 m (full); doorways 1.6 m (single) / 2.4 m (double); ceilings >= 3.5 m (6 m in agile maps); wall-run gaps 3-5 m; jump gaps validated against active movement preset (reachability test per preset). |
| MAP-005 | Item placement: power items exposed/contested and roughly equidistant from spawns; >= 20 m apart; armor and health spread so no one room holds both top items. Target (tunable): in a 10-minute FFA against equal-tier bots no single player collects more than 50% of top-item pickups. |
| MAP-010 | Spawn safety: candidate rejected if an enemy has LOS within 25 m or is within 12 m; prefer near teammates/away from last death; spawn protection 2 s (ends on fire); never spawn inside another capsule. |
| MAP-011 | Team modes: spawn zones behind teams with 2+ exits not overlooked by enemy positions (AA/sniper spawn-kill mistake). |
| MAP-012 | Callouts: every zone has a name shown on HUD near the minimap and used in bot barks. |
| MAP-013 | Destructibles optional and budgeted (PERF-010): props break into 4-8 debris pieces that sleep after 1 s; "collapse" events swap meshes (no free rigid-body sim). |
| MAP-014 | Forge-lite editor: grid placement of brushes, spawns, item pads, objectives; object budget 400; save to localStorage; test-play button. |
| MAP-020 | Generator is seeded (ARC-012); same seed + generator + preset = identical map (hash checked in self-test). |
| MAP-021 | Generators: GN1 Tile Chain (themed room modules with matching door sockets: Start-Connector-Intermediate-Objective-Exit + dead ends, PvE), GN2 Lanes & Sites (3 lanes, 2 sites, mid, spawn-to-site 20-25 s, tactical), GN3 Mirror Arena (half generated then mirrored/rotated, symmetric items, arena/team), GN4 Vertical Towers (wall-run lanes, rooftops, ziplines, agile), GN5 Island (300 m ring map, 6 POIs, loot chests by rarity, BR-lite). |
| MAP-022 | Tilesets: Foundry, Ruins, Station, Canal, Overgrowth, Glacier (6 palettes x 12 modules each). |
| MAP-023 | Generated maps pass the same validation as authored maps; failure retries with seed+1 (max 5) then falls back to an authored map. |

| Code | Key | Name | Size m | Modes | Notes |
|---|---|---|---|---|---|
| MP01 | `spire` | Foundry Spire | 50x50 | duel, ffa | vertical, 3 levels, Fury core on exposed bridge |
| MP02 | `skyyard` | Skyward Yard | 70x70 | ffa, tdm | open floating platforms, jump pads, rail on risky ledge |
| MP03 | `twinkeeps` | Twin Keeps | 120x60 | ctf, oneflag, dom | mirrored, 3 routes, flag rooms |
| MP04 | `dustline` | Dustline | 110x90 | bomb, elim, ghostops | 3 lanes, sites A/B, mid |
| MP05 | `harbor` | Harbor Nine | 90x90 | tdm, hardpoint, attrition | docks, 3 lanes |
| MP06 | `gantry` | Gantry Run | 100x80 | all agile except Team Clash (long sight lines) | wall-run lanes, rooftops |
| MP07 | `cistern` | Cistern | 80x80 | horde, endless, fiends | core room + 4 spawn gates |
| MP08 | `convoyline` | Old Rail | 160x40 | payload, rush, conquest | linear, checkpoints |
| MP09 | `isle` | Ring Isle | 300x300 | royale | generated by GN5 default seed |
| MP10 | `provinggrounds` | Proving Grounds | 80x60 | range | lanes, dummies, strafe lane |
| MP11 | `chambers` | Test Chambers 1-12 | 20-40 | puzzle | one concept each (MAP-030) |
| MP12 | `manor` | Ash Manor | 90x90 | contract | rooftops, 3 entries, guards |

| ID | Requirement |
|---|---|
| MAP-030 | Puzzle chambers teach one element at a time (button, cube, gate, launch plate, light bridge, laser + relay, fizzle grid, slick/bounce surfaces), heavy hints early fading later; each chamber has par portals, par steps, par time for bronze/silver/gold. Portal view: render-to-texture 256-512 px on High+, warp flash on Low/Potato. |

## 19. Single-player structures and progression (PRG)

| ID | Requirement |
|---|---|
| PRG-001 | Quick Match: one tap from main menu; repeats the last start from Match setup or from the Custom editor (mode or variant, map, bot count, difficulty, match length; an editor start replays the editor draft); a new save starts the Frenzy card. The "Shuffle" tile on Play opens Match setup with a random valid mode (any of the 31 rows), map, bot count and difficulty. |
| PRG-002 | Custom Match: editor of MUT-001. |
| PRG-003 | Tournament Ladder: 8 tiers (BT0-BT7) of 3-4 matches each mixing FFA, Duel, TDM, CTF, Holdfast, Detonate; named bots B01-B24; win (top 3 in FFA, win in team) to advance; final duel vs B24; difficulty chosen per match. |
| PRG-004 | Challenge Rooms: 20 trials (time trial, kill chain, wave survival, drop kill, ghost run, accuracy course) with 1-3 stars (10,000 points per star) and Expert versions unlocked at 2 stars. |
| PRG-005 | Horde (M21/M22) and Puzzle Chambers (MP11) as menu entries: Career > Solo (with its own difficulty row and the chamber records) and Play > All modes (Siege Waves with its Endless variant, Test Chambers). |
| PRG-006 | Daily Seed: date-based seed picks generator, mode, ruleset and 2 mutators; local best score history only; replayable any time (no streak penalties). |
| PRG-007 | Operations: chain of 3 maps with tickets carried over and a comeback bonus (losing side gets a heavy bot unit). |
| PRG-008 | Firing Range is the first scene offered to new players (skippable). |
| PRG-010 | XP from play (score, objectives, medals); levels 1-50; every unlock reachable by level 30 (about 10 hours) or by a specific challenge; option "Unlock everything" in settings. |
| PRG-011 | Unlocks are sidegrades or cosmetics (procedural colours/patterns, crosshair styles, bot rosters, maps, cards, challenge rooms); never raw stat increases. |
| PRG-012 | No timers, daily logins, seasons, expiring content, gambling or random paid crates. |
| PRG-013 | Medals (text banner + sting): MD01 First Strike, MD02 Double (2 kills in 3 s), MD03 Multi (3), MD04 Spree (5 no death), MD05 Rampage (10), MD06 Unstoppable (15), MD07 Precise (2 consecutive rail hits), MD08 Humiliation (melee kill), MD09 Comeback, MD10 Defender, MD11 Capture, MD12 Assist, MD13 Revenge, MD14 Telefrag, MD15 Airborne kill, MD16 Long Shot (> 50 m), MD17 Ace (round wipe), MD18 Clutch (1vX), MD19 Ghost (no alarm), MD20 Flawless wave. |
| PRG-014 | Statistics per weapon/mode/map stored locally; challenge list (weapon mastery: kills, headshots) unlocks colours. |

## 20. HUD, UI, menus (UI)

| ID | Requirement |
|---|---|
| UI-001 | Menus: main menu = Quick Match, Play, Career (ladder, rooms, operations, daily, cards, profile, statistics, Solo), Custom, Range, Map editor, Settings, Help (no Solo or Generated map entry: the generated map is on Custom > Map). Quick Match starts in 1 action; Play (8 mode cards, All modes, Shuffle) -> Match setup (variant for a family, map, bots, difficulty, match length (modes with score or time limits), your team (team modes); Loadout; Advanced; Reset to card defaults) -> Start takes 3 taps for a card; Advanced opens the Custom editor filled with the setup and Back keeps its changes; every menu screen but the main menu, pause and results shows a tappable breadcrumb under its title that keyboard and gamepad focus skip; Back goes up one level and returns the focus to the control opened from; LB / RB switch tabs (Settings, Custom editor); results add Change mode; no screen takes > 1 s to open; last mode/settings remembered (UT3 console-UI mistake). |
| UI-002 | Pause any time (Esc/Start/touch button): resume, restart, rules panel, settings, quit. Sim fully stops. |
| UI-003 | HUD elements: health/armor/shield bars + numbers, ammo (mag/reserve), weapon bar, ability icons with cooldown rings, ultimate %, meter, minimap/compass, objective bar, timer, score, kill feed, hit markers, damage direction arcs, item timers (optional), medal banners. |
| UI-004 | Crosshair editor: style (cross, dot, circle, T, chevron), size, gap, thickness, outline, colour, dot, dynamic spread on/off, per-weapon override, scope overlay options. |
| UI-005 | Hit markers on/off; headshot marker; damage numbers on/off (stack per target); kill confirmation sound. |
| UI-006 | Minimap rules: shows teammates, pings, objectives; enemies only when firing unsuppressed (2 s red dot), under Seer/UAV effects, or motion tracker (moving enemies within range; crouch-walk hidden). |
| UI-010 | Scoreboard on Tab (touch button): all actors, score, kills, deaths, assists, objective stats, ping-free; also between rounds and at end with medals and per-weapon accuracy (BF2042 missing scoreboard mistake). |
| UI-011 | Killcam-lite: on death show killer name, weapon, remaining HP/armor, and a 2 s replay from the killer's recorded transforms (20 Hz ring buffer); skippable; option off. |
| UI-012 | Announcer: text banners + synthesized stings for countdown, lead changes, medals, objective events, power item respawn. |
| UI-013 | Bot names, team colours and shapes above heads (team icon shapes for colour-blind). |
| UI-014 | Stealth awareness indicator above enemy heads (fill = meter, colour white->amber->red). |
| UI-015 | HUD scale 50-150%, opacity, safe-area insets for notched phones, element toggles. |
| UI-017 | Spectate (P2-01): a dead player who cannot respawn (Detonate, Last Squad, Last Ring, Ghost Ops, Ravager vs Fiends until the next round, Last Standing after the last life), and a match without a local player, watch on: a follow camera behind and above a living player (their teammates first in team modes; everybody once none is left or in free-for-all; players and bots only) with Fire / Alt (touch NEXT / PREV) or the weapon cycle controls for next / previous, and a free camera (move along the look direction, Jump up, Crouch down, Sprint faster, kept inside the map bounds) with Reload (touch VIEW) switching between them. The audio listener follows the camera; the HUD names the player watched. It starts after the killcam and ends at a respawn, a new round or the end of the match. |
| UI-016 | FOV slider 60-120 deg horizontal (default 90 desktop, 80 phone); weapon viewmodel FOV and offset; bob and shake sliders. |

## 21. Accessibility (ACC)

| ID | Requirement |
|---|---|
| ACC-001 | Colour-blind modes: protanopia, deuteranopia, tritanopia palettes for teams, enemies, pings, markers; team icons also differ by shape. |
| ACC-002 | Subtitles for all announcer/bark text and sound captions ("[Footsteps left]", "[Rocket incoming]") with size and background options. |
| ACC-003 | Visual sound indicator ring: directional icons for footsteps, gunfire, explosions, items, voice barks; works with audio on. |
| ACC-004 | Hold/toggle for every hold action; aim assist slider; auto-fire (touch); one-tap ping; remappable everything. |
| ACC-005 | Reduce motion: camera shake, view bob, FOV kick, screen flashes (flashbang uses darken instead of white), particle intensity sliders; photosensitivity mode caps flashes to 3/s. |
| ACC-006 | High-contrast enemy outline option; UI scale; mono audio; separate volume sliders (master, SFX, UI, voice/announcer, music). |
| ACC-007 | Game speed, parry window, damage sliders (DIF-002) usable as assists without penalties. |
| ACC-008 | Readable fonts (system UI, min 14 px at 100% scale), keyboard focus outlines in menus. |

## 22. Audio (AUD)

| ID | Requirement |
|---|---|
| AUD-001 | Web Audio synth only; AudioContext resumed on first user gesture; message if blocked. On iOS 17+ request playback audio (`navigator.audioSession.type = "playback"`) so sound plays with the silent switch on; where unsupported, show a hint that the silent switch mutes sound. |
| AUD-002 | Voice pool 24 (Potato 12) with priority stealing (own weapon > close enemy fire > explosions > far sounds > ambience). |
| AUD-003 | Weapon sounds = noise burst + tonal body + filter envelope per class; distance low-pass and level; occlusion low-pass when no LOS. |
| AUD-004 | Footsteps per surface material, loud enough to locate enemies at 15 m (Apex "need headphones" mistake): stereo panning equal-power; HRTF on High+. |
| AUD-005 | Distinct synthesized cues: incoming rocket whistle, grenade bounce tick, power item respawn chime, low health heartbeat, shield break, hit marker tick, headshot ping, ping chirps, bark radio blips. |
| AUD-006 | Optional generative music with intensity layers (calm/combat/boss); the Music setting is Auto (off on Potato), On or Off. |
| AUD-007 | Audio scheduling <= 0.3 ms per frame; no node creation storm (pool and reuse buffers). |

## 23. Rendering (REN)

| ID | Requirement |
|---|---|
| REN-001 | WebGL2 forward renderer; static world merged per 16 m chunk per material into few VBOs; frustum culling per chunk; distance fog. |
| REN-002 | Characters: procedural rigid-part humanoids (boxes/capsules) animated by code; instanced draws per archetype; 2 LODs (far = 6-part); outlines via backface shell optional. |
| REN-003 | Shader programs <= 8: world lit (vertex colour + procedural material patterns + baked AO), instanced shapes (actors, props, viewmodel, outlines, blob shadows), depth-only sun shadow casters, particles (instanced billboards, tracers, decals), sky, HUD/UI quads, post (tone map, vignette, optional FXAA). Seven programs; there is no portal/stencil variant. |
| REN-004 | Lighting baked into vertex colours at map build; up to 8 dynamic point lights (muzzle/explosions) by preset; blob shadows on Medium, Low and Potato, one (not cascaded) sun shadow map on High/Ultra. |
| REN-005 | HUD drawn as batched WebGL quads (single draw call per layer); menus in DOM. |
| REN-006 | Render interpolation between the last two sim states (ARC-010). |
| REN-007 | Smoke volumes as instanced soft particles with an occupancy grid for LOS; bullet holes punch grid cells. |
| REN-008 | Quality preset table controls render scale range, shadows, lights, particles, decals, LOD distances, MSAA (off/2x), post effects. |

## 24. Architecture, saves, self-test (ARC)

| ID | Requirement |
|---|---|
| ARC-001 | One HTML file: `<style>`, DOM shells (canvas, overlay, fatal screen), one `'use strict'` script with sections in order: util/math, RNG, data catalogues, settings/save, input, audio, renderer, world/collision, nav, movement, weapons/projectiles, abilities/items, rules/modes, bots, PvE director, map gen, HUD, UI, game loop, self-test, bootstrap. Each section starts with a banner comment (IronHorizon convention). |
| ARC-010 | Fixed timestep 120 Hz with accumulator, as many steps per frame as fit 25 ms at the measured step cost, between 4 and 12 (drop the remainder and log), render interpolation. Sim never reads wall-clock. |
| ARC-011 | Entities in struct-of-arrays typed arrays: actors (max 64), projectiles (pool 512), pickups (256), particles (GPU pool), sound events ring (256). |
| ARC-012 | Seeded RNG (sfc32/mulberry32) with separate streams: map gen, loot, bots, rules, cosmetic FX. |
| ARC-013 | Spatial hash grid 4 m cells for dynamic entities; static BVH (AABB tree) for brushes; capsule vs AABB/convex sweep with Quake-style velocity clipping (3 planes), step-up, ground probe. |
| ARC-014 | Hitscan: ray vs BVH, then candidate actors from grid along the ray, then head sphere/torso/legs; projectiles swept per step. |
| ARC-015 | Damage, events and scoring through one event bus; HUD, audio, bots and stats subscribe. |
| ARC-020 | Save: key `ctk.save.v1` JSON {version, revision, settings, bindings, touchLayouts, progression, stats, rulesets, editorMaps, ladder, play, crosshairs, tips {matches, homeScreen, silentSwitch}, loadouts}; size <= 1 MB; migration by version (repairs nested records, drops bad list entries); corrupted save is backed up to `ctk.save.bak` and reset with a notice; the backup can be restored from the UI (Back up or restore save, which validates an import before it replaces anything); export/import as text. A write happens only when the save changed (dirty flag). A readable backup is never replaced by an unreadable save (that record goes to `ctk.save.spare`); a save written by a newer game version is backed up, announced and never overwritten. |
| ARC-021 | Settings apply instantly and persist on change (debounced 500 ms). |
| ARC-030 | Built-in self-test: Help > "Run self-test" and `__CTK.selfTest({headless})` in the test build (`ClassTimeKiller.test.html`; the shipped game leaves the test blocks out); headless runs without WebGL (render stub) and returns `{total, failed, results[]}` with `check(name, ok, detail)` entries, grouped test blocks that catch throws (IronHorizon pattern). |
| ARC-031 | Data validation: every catalogue entry follows its schema, keys unique, references resolve (weapon sets, hero weapons, unlocks), counts meet VIS-004, banned reference names absent from all display strings. |
| ARC-032 | Rule tests: movement apex/speed per preset (MOV-026), damage pipeline cases per health preset, armor/shield math, economy ladder, mode win conditions, mutator application, card effects, save round-trip, RNG determinism, map gen hash per seed, nav connectivity. |
| ARC-033 | Bot soak: headless N simulated minutes per mode at max speed; fail on NaN, stuck > 6 s, bot without goal > 3 s, fairness breach (bot fired at target never perceived), budget overrun. |
| ARC-034 | Perf micro-benchmarks: nav build time, 100k raycasts, 16-bot AI tick, reported in ms. |
| ARC-040 | Debug global `window.__CTK` (the shipped game keeps version, game, actors, world, catalogues, perf, step, seed, give, god, stress, log and save; the test build adds the rest) = {version, selfTest, soak, perf (incl. frame-time p50/p99), game, world, rules, catalogues, spawnBot, setTier, step(n), seed(n), map.check(), stress(level), give(id), god(on), save.dump(), save.corrupt(kind), log.errors()}; F8 perf HUD (PERF-012), F9 bot debug (BOT-092). On touch devices both views toggle from Options > Developer and by a four-finger tap on the look area (none of the fingers on the stick or a button). |
| ARC-041 | Global error handler collects errors into a ring shown in the perf HUD; a startup failure shows the fatal screen with the message. |

## 25. Out of scope

Online/LAN multiplayer, split-screen, human co-op, matchmaking, server leaderboards, voice/text chat; accounts, cloud saves, telemetry; any monetization (stores, premium currency, battle pass, loot boxes, ads); reference or real assets (textures, models, sound/music files, fonts beyond system fonts, logos, names, story, voice); story campaign with cutscenes; full vehicle sandbox (only optional Skimmer board, turrets); full rigid-body physics, ragdolls, real-time GI; full building mode; external mods/scripting; full theater replays; network text-to-speech.

## 26. Open questions

| # | Question | Default if no answer |
|---|---|---|
| Q1 | Final product name? | Keep "ClassTimeKiller". |
| Q2 | Blood/gore style? | Stylized sparks and colour bursts; blood colour option (none/green/red). |
| Q3 | Use browser `speechSynthesis` for announcer when available offline? | Off by default, option in Audio settings. |
| Q4 | Minimum iOS version? | iOS 16 (WebGL2 stable). |
| Q5 | Include Skimmer board (MOV-027) in v1? | Yes, large maps only. |

## Appendix A. Traceability (feature -> Ref -> note)

| Feature | Ref | Note |
|---|---|---|
| Strafe-jump air model, armor 2/3, overheal decay, item timers 25/35/120, bot characteristics and state machine | Quake III | research/quake-3-arena.md |
| Alt-fire for every weapon, dodge, translocator, mutators, bot skill ladder, auto-adjust | UT99 | research/unreal-tournament-1999.md |
| Double jump/wall dodge, adrenaline combos, link gun, bombing/double domination, bot FOV/turn table | UT2004 | research/unreal-tournament-2004.md |
| Duel queue, hoverboard, per-target damage, orb node idea, handicap/survival | UT3 | research/unreal-tournament-3.md |
| Round economy, loss ladder, spray patterns, counter-strafe, utility grenades, bot quota/difficulty | Counter-Strike | research/counter-strike.md |
| Accuracy tiers, spike timings, half-defuse, roles, ability kits | Valorant | research/valorant.md |
| Mutation/infection, ghost, hero modes, elimination, weapon-restricted maps | CrossFire | research/crossfire.md |
| Perk tiers, streaks, regen health, short set-pieces | CoD4 | research/cod4-modern-warfare-2007.md |
| Tactical sprint, slide, mantle, field upgrades, Gunfight | CoD MW 2019 | research/cod-modern-warfare-2019.md |
| Conquest tickets, rush, classes, suppression, spawn beacons, rule editor | Battlefield | research/battlefield.md |
| Storm ring, rarity, shields/heals, sound visualizer, island settings | Fortnite | research/fortnite.md |
| Ping system, ring schedule, slide/mantle speeds, respawn beacons, firing range | Apex Legends | research/apex-legends.md |
| Roles, objective modes with overtime, ultimate charge, practice vs AI | Overwatch | research/overwatch.md |
| Shield over health, two-stage kills, squad/morale AI, encounter fallback | Halo | research/halo.md |
| Equipment pickups, custom options ranges, Forge, task-tree objectives | Halo 3 | research/halo-3.md |
| Wall-run, slide-hop, smart pistol, boosts, Frontier Defense, attrition | Titanfall | research/titanfall.md |
| Ammo tiers, elemental shields, champions, class air moves, Gambit | Destiny 2 | research/destiny-2.md |
| Parkour verbs, tile generator, status effects, energy kits, endless scaling | Warframe | research/warframe.md |
| Suit modes on one energy bar, alert model | Crysis | research/crysis.md |
| Resource triangle, dash, weak points, BATTLEMODE, horde | Doom Eternal | research/doom-eternal.md |
| Granular difficulty sliders, parry, shield charge | Doom The Dark Ages | research/doom-the-dark-ages.md |
| Tarot cards, souls/demon form, Voosh, Light Bearer, PCF, LMS | Painkiller | research/painkiller.md |
| Charge weapons, gimmick weapons, frag tag, neutral beasts, hub keys | Turok | research/turok.md |
| Gravity tool, throw-back grenades, squad slots, captions | Half-Life 2 | research/half-life-2.md |
| Portal device, puzzle chambers, par medals, turret | Portal | research/portal.md |
| Plasmid + weapon combos, wet/oil, difficulty table, hacking | BioShock | research/bioshock.md |
| Augment slots and energy, locational damage, multi-path design, noise detection | Deus Ex | research/deus-ex.md |
| Blink/bend time/possession powers, awareness meter, challenge trials | Dishonored | research/dishonored.md |
| Self-test harness, debug global, section layout | IronHorizon (owner) | Mech Flight Sim/IronHorizon.html |

## Appendix B. Mistakes avoided (MIS)

| ID | Mistake | Ref | Our avoidance rule |
|---|---|---|---|
| MIS-001 | Steep skill barrier from strafe-jumping | Quake III | MOV-018 air assist, low ladder tiers |
| MIS-002 | Robotic perfect reactions | Quake III, UT | BOT-006 reaction floor + jitter |
| MIS-003 | 360 deg vision / instant turns at top tier | UT2004 | BT table FOV <= 170, turn caps, BOT-040 |
| MIS-004 | Perfect projectile dodging | UT99 | BOT-033 <= 60% |
| MIS-005 | Bots stuck on bad path data | UT, CS2 | BOT-010 generated nav + BOT-012 recovery + soak test |
| MIS-006 | Leader snowball on power items | Quake III | MAP-005 spread items, spawn rules |
| MIS-007 | Frame-rate dependent fire rates | UT99 | fixed 120 Hz sim (ARC-010) |
| MIS-008 | Console UI, settings not saving, forgets last mode | UT3 | UI-001, ARC-021 |
| MIS-009 | Dropped popular modes | UT3, Apex, Overwatch | all modes ship together, none removed |
| MIS-010 | Unclear economy rules | Counter-Strike | ECO-001 in-game panel, one documented rule |
| MIS-011 | Pay-to-win weapons, gambling | CrossFire, Apex, Fortnite | ECO-002, PRG-011/012 |
| MIS-012 | Grind and rentals | CrossFire, Destiny 2, Warframe | PRG-010 unlock by level 30, unlock-all option |
| MIS-013 | Noob-tube grenade spam | CoD4 | WPN-011 arm distance and low reserve |
| MIS-014 | Infinite respawn closets | CoD4 | NPC-008 finite budgets |
| MIS-015 | Kill-based streaks encourage camping | MW2019 | ECO-003 score-based streaks |
| MIS-016 | Dark small campable maps, claymore spam | MW2019 | MAP-002/003, GAD-003 limit 1 |
| MIS-017 | Missing scoreboard | Battlefield 2042 | UI-010 |
| MIS-018 | Spawn killing by snipers/AA | Battlefield 6 | MAP-010/011, BOT-041 |
| MIS-019 | Too-chaotic player counts | BF2042, Titanfall | PERF-009 caps, 4v4 defaults |
| MIS-020 | Building skill wall | Fortnite | no build mode (§25), Zero-Build style |
| MIS-021 | Bots too easy/hard or broken after updates | Fortnite, Apex | 10 presets + sliders, soak tests per mode |
| MIS-022 | Audio hard to locate | Apex | AUD-004 footstep rule, ACC-003 |
| MIS-023 | Overpowered sidearm collapses sandbox | Halo CE | W05 recoil/limits, data validation of TTK |
| MIS-024 | Loadout/perk dilution of equal starts | Halo 4 | pickup economy default in arena rulesets |
| MIS-025 | Timer-based titan made every mode deathmatch | Titanfall | BOT-080 objective scoring checks, objective weights |
| MIS-026 | Dumb grunts | Titanfall, Crysis indoors | NPC-001/005, grenades and flanking indoors |
| MIS-027 | Power-level resets, vaulting | Destiny 2 | no persistent stats, nothing removed |
| MIS-028 | Endless scaling to absurd numbers | Warframe | M22 cap x4 |
| MIS-029 | Onboarding overload | Warframe, Doom Eternal | PRG-008 range first, one concept per chamber |
| MIS-030 | Hardware demands lock out players | Crysis | PERF budgets, Potato preset |
| MIS-031 | Suit drain too fast | Crysis | A01-A04 rates **T** with energy regen 25/s |
| MIS-032 | Hard-counter gate enemy | Doom Eternal | NPC-002 readable counters, every enemy killable by any weapon |
| MIS-033 | Wrong-kill wave triggers, long restarts | Doom Eternal TAG1 | waves by remaining count, DIF-004 retry |
| MIS-034 | Souls despawn, morph wasted | Painkiller | ABL-005 homing souls |
| MIS-035 | Tedious card unlock tasks | Painkiller | cards unlock by single simple conditions, half refund |
| MIS-036 | Getting lost, heavy fog | Turok | objective arrow, minimap, fog only for perf |
| MIS-037 | Platforming without seeing feet | Turok, Doom Eternal | blob shadow under player, forgiving mantle |
| MIS-038 | Overstaying vehicle sections | Half-Life 2 | no vehicle sections |
| MIS-039 | Disorienting portal effects | Portal 2 | REN warp flash fallback, ACC-005 |
| MIS-040 | Vita-chamber removes tension | BioShock | lives/respawn tokens per difficulty |
| MIS-041 | Clumsy hacking minigames | BioShock | no hacking minigame (use/hold only) |
| MIS-042 | Erratic, late AI | Deus Ex | bots first in implementation order, soak tests |
| MIS-043 | Inconsistent detection (far yes, close no) | Dishonored | BOT-005 distance-weighted meter |
| MIS-044 | Ability clutter | Valorant | heroes 2 abilities + 1 ult, clear icons |
| MIS-045 | Weak practice bots/range | Valorant, Overwatch | M30 range with fire-back dummies |
