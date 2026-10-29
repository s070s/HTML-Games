# Iron Horizon - Complete Tasklist

Single tasklist for every item in the former `Ideas-iron horizon.txt` (deleted; its full text is kept in Appendix A).
Work top to bottom. Tick a box only when its "Done when" check passes.

## 0. How to use this file

- Phases are in dependency order. A later phase may rely on anything an earlier phase finished.
- Each task: `- [ ] ID - task` followed by `Done when:` (the acceptance check).
- `DECIDE` tasks produce a written decision. Record it in Appendix C (Decision log) before starting dependent tasks.
- `RESEARCH` tasks produce written notes. Record the result in Appendix B (Research log), with the source for each fact.
- Facts and proposals are kept apart: "Fact" = verified in `IronHorizon.html` or the owner's answers. "Proposal" / "Suspect" = not yet confirmed; a DECIDE or reproduce task confirms it.
- Every new file is UTF-8 with BOM. Use plain ASCII characters in code, data and text where possible.
- Git: work on `main`, no extra branches (owner decision for this repository).

## 1. Owner decisions (fact, from the planning questions)

| Topic | Decision |
|---|---|
| Missing weapons, utilities, items | Found by a role gap analysis: every platform kind against every combat role; add items only where a role has no tool. |
| Super hero platform | Unlocked through a setting; once unlocked, usable in every mode (campaign, skirmish, co-op, training). |
| Campaign | One campaign; story, structure and mission count decided in DECIDE tasks; existing missions reused, merged, cut or rewritten as needed. |
| Up to four teams | Skirmish and online co-op get 2-4 teams with alliance settings; campaign missions use extra teams only where a mission design asks for it. |
| Tasklist file | `Mech Flight Sim/TASKLIST-iron horizon.md` (this file). |

## 2. Current state (fact, read from `IronHorizon.html`: 33,949 lines, 2,392,277 bytes, `SAVE_VERSION = 1`)

- One self-contained HTML file, procedural models, no assets. No Content-Security-Policy meta tag.
- World: terrain +-1000 m (`WORLD_HALF`); ground platforms bounded at 930 m (`GROUND_BOUND`); aircraft steered back beyond 1080 m (`AIR_BOUND`); ceiling 420 m.
- Platforms: 17 playable / unit types plus 7 targets and support units. Mechs: Wraith LM-1, Bulwark MM-2, Colossus HM-3; on foot: Ranger IN-0 (infantry), Civilian; ground: Jackal RV-1, Bastion MBT-2, Specter HV-1, Thunder SPH-1, Hailstorm MRL-6, Pestle MC-2; air: Kestrel IN-1, Shrike SF-2, Behemoth HG-3; naval: Lancer FC-1, Trident DD-3, Skua ACV-2. Others: Target Dummy, Moving Target, Aerial Target, Supply Truck, Bomber, Gun Emplacement, AA Battery.
- Arsenal: 59 rows in `WEAPONS` (guns, missiles, bombs, utilities such as Energy Shield, Flares, ECM Jammer, Optical Camo, Repair Drone, plus naval and artillery weapons). Weapon slots: Primary A, Primary B, Secondary, Utility. Separate `MELEE` table and 100 superweapons (`defineSuper`).
- Maps: 13 (ashfall, verdant, frost, coast, archipelago, valley, alpine, canyon, jungle, volcano, tundra, metro, farmland). Hazards include wildfire, flood, avalanche, rockfall, lightning, tornado, sandstorm.
- Missions: 18 (m1 Heavy Hunter to m18 Eye of the Storm), each with objectives and optional goals. `MISSION_UNLOCK` ties weapon / melee / superweapon unlocks to mission wins. Training mode exists (`TRAINING_DEF`).
- Modes: missions, skirmish, training, and online co-op over WebRTC (host / join, optional STUN).
- Teams: three ids in use - 0 (player side), 1 (enemy), 2 (neutral, ignored by targeting). Team colours are fixed (`TEAM_ACCENT`). No team colour choice, no third or fourth fighting team.
- Spawning: `findSpawn`, `forwardSpawn`, `airportSpawn`, `respawnSite`, `spawnUnit`. Naval platforms have a `draft` (keel depth); the code comment says a ship is stopped when the water gets too shallow.
- Terrain: heightmap tiles cached (`TERRAIN_CACHE_SIZE = 4`). A separate rubble height grid exists (4 m cells, mound up to 2.2 m). The "Crater Maker" superweapon leaves a scorch decal and debris; no terrain lowering ("deform" appears 0 times).
- Fauna: 30 species, herds / flocks / schools per map, simulated and drawn. Quality limits: low draws within 260 m (max 32 drawn, 48 simulated), medium 380 m (64 / 96), high 520 m (100 / 150). The owner reports seeing no animals: cause unknown (P1-04).
- Loadout effect on visuals: not verified in this review (P1-05).

## 3. Global rules for every phase

- Every feature must work on touch, gamepad and keyboard / mouse, and in online co-op.
- No external dependencies. Output stays one HTML file.
- Bump `SAVE_VERSION` and migrate saves whenever saved data changes.
- Every phase ends with: no console errors, the built-in self-test passes, frame rate on the low preset not worse than the P0-02 baseline unless a decision accepts it.

---

## Phase 0 - Baseline

- [x] P0-01 - Record the baseline: commit hash, file size, frame times per quality preset on 3 maps (one land, one sea, one mixed).
  Done when: recorded in Appendix C.
  Status (2026-10-29): Appendix C "P0-01": commit de9c168, 2,392,277 bytes (LF), frame / JS-work table for ashfall (land), coast (sea), jungle (mixed) at low / medium / high (headless software rendering: JS work about 2 ms per frame at every preset); self-test 2651 / 2651 at 1280x800.
- [x] P0-02 - Define the low-spec mobile test method (device class, target frame rate, test scenes, metrics).
  Done when: recorded in Appendix C.
  Status (2026-10-29): Appendix C "P0-02": 640x360, CPU throttle 4, low preset, target 30 fps; pass rule JS p95 <= 16 ms, loop interval median <= 34 ms and p95 <= 51 ms, at most 15 percent worse than baseline; baseline JS p95 11.4-14.9 ms, interval median 33.4 ms.

## Phase 1 - Reproduce reported problems

- [x] P1-01 - Spawn audit: for every playable platform kind (mech, infantry, ground, air, naval, artillery) on every map and in every context (each mission, skirmish, co-op host / guest, training, respawn), log the spawn point, distance to the nearest objective and to the map bounds, water depth for naval, and whether the platform can move. Known reports: naval spawning far from the objective; aircraft spawning close to the map bounds.
  Done when: Appendix D has a table of all spawns with failures marked.
  Status (2026-10-29): Appendix D "P1-01": 1408 spawn runs; all 862 land spawns fine; aircraft fail in m2, m10, m13, m17 (6 warn); naval fails in every skirmish seed and in m12, m15, m17.
- [x] P1-02 - Naval stuck audit: list every map and water body (rivers included) where a naval platform can enter water shallower than its `draft` or get stuck on banks.
  Done when: Appendix D lists each place with map, coordinates and platform.
  Status (2026-10-29): Appendix D "P1-02": player ships never grounded in 144 shoreline trials; AI ships idle 20 s+ in 8 of 57 runs, one grounded (metro 451,-158); narrow rivers and the cut metro river listed.
- [x] P1-03 - General audit of features not working as intended in the areas this tasklist touches (spawns, naval movement, loadouts, teams, fauna, missions). Classify Critical, High, Medium, Low, Informational.
  Done when: Appendix D lists each finding with a fix task.
  Status (2026-10-29): Appendix D "P1-03": 25 findings (0 critical, 6 high, 11 medium, 2 low, 6 informational), each with a fix task.
- [x] P1-04 - Fauna not visible: reproduce on each map and quality preset. Suspects to check: draw distance against the camera height of aircraft and mechs, `faunaCap`, group placement far from where play happens, model scale, culling, the species list per map.
  Done when: the cause is recorded in Appendix D.
  Status (2026-10-29): Appendix D "P1-04": animals exist (24-147 per map) but few are in draw range and they are 1-3 px tall there; at medium none drawn at start on 10 of 13 maps; deer only on verdant and valley.
- [x] P1-05 - Check what a loadout changes on each platform model today (weapons drawn, pods, launchers, utilities).
  Done when: Appendix C has a table per platform: loadout item -> visible change (yes / no).
  Status (2026-10-29): Appendix C "P1-05": table per platform; models show only slot filled plus one barrel size class; jets draw no guns, Hailstorm never changes, utilities and superweapons never shown, hangar shows text only.
- [x] P1-06 - Ground route audit (owner, 2026-10-29): on every map, check that land units (mechs, infantry, ground vehicles, artillery) can reach every objective and enemy base from their spawns by land, bridge (natural land link or built) or shallow water they can ford. List every spawn on land cut off by water, and every place where AI land units get stuck on a river bank instead of going around.
  Done when: Appendix D lists each cut-off spawn and each stuck place with map, coordinates and platform kind.
  Status (2026-10-29): Appendix D "P1-06": only archipelago has cut-off land (skirmish bases unreachable for tank and infantry in all 3 seeds); 14 of 75 AI land runs stuck or drowned at rivers and lakes (AI probes one point ahead with six fixed turns).
- [x] P1-07 - Missile audit (owner, 2026-10-29: missiles are very hard to dodge and keep following even around buildings): for every missile weapon, record turn rate, speed, lifetime, seeker cone, lead, re-lock rules, what happens when line of sight is lost behind buildings or terrain, and the effect of flares / ECM; measure the hit rate against a dodging target and against a target breaking line of sight.
  Done when: Appendix D has a table per missile weapon with the measured hit rates and the cause of the persistence.
  Status (2026-10-29): Appendix D "P1-07": per-missile tuning table, 24 trials per cell; dodging target hit 67-100 percent; Guided Missile and Swarm track a target hidden behind a ridge for the whole flight: no line-of-sight, seeker-cone or lock-loss check after launch, only flares (50 percent per drop) and ECM break a chase.

## Phase 2 - Spawning and naval movement fixes

- [ ] P2-01 - DECIDE: spawn rules per platform kind: naval only in water deeper than draft plus margin and connected to the objective area by navigable water; aircraft at a minimum distance from `AIR_BOUND` / `GROUND_BOUND`, heading inward, at a safe altitude; ground and mechs on reachable, non-steep ground; maximum distance to the first objective per context.
  Done when: rules recorded in Appendix C.
- [ ] P2-02 - Implement the spawn rules in all spawn functions (mission start, respawn, co-op join, skirmish bases, training).
  Done when: the P1-01 audit re-run shows no failure.
- [ ] P2-03 - Navigable water: compute a navigation mask per platform draft (rivers, lakes, coast). DECIDE behaviour at shallow water (proposals: slow and stop with a warning before grounding, auto-reverse assist, AI path avoids it; hovercraft keep crossing land as today if that is the design).
  Done when: no naval platform gets permanently stuck in the P1-02 places; AI naval units route through navigable water only.
- [ ] P2-04 - Recovery fallback: if a platform is stuck for a set time, offer a "reposition" action to the nearest valid spawn.
  Done when: works for every platform kind and in co-op.
- [ ] P2-05 - Ground pathfinding (owner, 2026-10-29: units get stuck on rivers instead of going around): AI land units route around rivers and lakes, using bridges, land links and water shallow enough for their platform kind to ford, and do not get stuck on banks.
  Done when: no AI land unit sticks at the P1-06 places, and AI land units reach objectives across rivers on every map.
- [ ] P2-06 - Land spawn connectivity: every land spawn (mission start, respawn, skirmish bases, co-op join, training) is connected to its objectives by land, bridge or fordable water; move the spawn or add a bridge / ford where it is not.
  Done when: the P1-06 re-run finds no cut-off land spawn on any map.

## Phase 3 - Fauna

- [ ] P3-01 - Fix the cause found in P1-04 so animals are visible during normal play on every map and quality preset.
  Done when: a live test sees animals on each map without searching for them.
- [ ] P3-02 - Check fauna placement and density against where the player plays (spawns, objectives, routes), within the performance budget.
  Done when: frame rate on low preset meets P0-02.
- [ ] P3-03 - Radar contacts for fauna and civilians (on foot and in vehicles), with their own neutral icons; they are never targets. They follow the detection rule from P5-05.
  Done when: animals and civilians within detection range show on the radar on every map, in co-op too.

## Phase 4 - Deformable terrain (if possible)

- [ ] P4-01 - RESEARCH + DECIDE feasibility: lower terrain heights where explosives hit (crater depth by blast size), update the terrain tiles, collision, water, flora, roads and structures above it; keep co-op in sync (send crater events, not heights). Measure cost on low-spec devices.
  Done when: Appendix C has the decision (implement / not implement) with the measured cost.
- [ ] P4-02 - If approved: implement craters (height change, tile rebuild in small parts, limits per frame and per match, save-free), physics and AI path update, co-op sync.
  Done when: explosions leave craters that units drive into, AI handles them, co-op peers see the same craters, and P0-02 targets hold.

## Phase 5 - Arsenal: role gap analysis and missing items

- [ ] P5-01 - Build the role matrix: rows = platform kinds (light / medium / heavy mech, infantry, wheeled, tracked, hover, artillery, air interceptor / strike / gunship, naval fast / destroyer / hovercraft); columns = combat roles (anti-armour, anti-air, anti-infantry, anti-ship, anti-structure, long range, close range, area denial, defence, mobility, support / repair, recon / detection, stealth / counter-stealth, electronic warfare). Fill each cell with the existing weapons, utilities, items and superweapons.
  Done when: the matrix is in Appendix C.
- [ ] P5-02 - DECIDE: list of new weapons, utilities and items for every empty or weak cell. Each with role, platform kinds, benefits, drawbacks and a distinct mechanic.
  Done when: Appendix C has the list.
- [ ] P5-03 - Implement the new items (data, models, effects, sounds, AI use, unlock rule).
  Done when: each item works for the player and AI on its platform kinds.
- [ ] P5-04 - Lock-on on objectives (owner, 2026-10-29): the player can lock on objective structures (radar towers, bases, depots and every other mission or skirmish objective structure) and cycle between them; the HUD and the radar show the locked target.
  Done when: every objective structure in every mission and skirmish can be locked on with keyboard / mouse, gamepad and touch, and lock-on weapons hit it.
- [ ] P5-05 - Radar detection (owner, 2026-10-29): the radar stops showing every unit. DECIDE the detection range per platform kind (aircraft longest, infantry shortest), whether allies share contacts, and a new utility module that extends detection by platform kind. The locked target always shows on the radar. Implement for the player, AI and co-op.
  Done when: Appendix C has the range table; the radar shows only detected contacts plus the lock; the detection module works for the player, AI and co-op peers.
- [ ] P5-06 - Missile balance from P1-07: DECIDE target hit rates against a dodging target and against a target that breaks line of sight, then tune turn rate, seeker cone, lost lock behind buildings and terrain, lifetime and flares / ECM.
  Done when: Appendix C has the targets, the measured hit rates meet them, and AI still uses missiles well.

## Phase 6 - Loadout visuals

- [ ] P6-01 - DECIDE: visual rule for each loadout slot and item (weapon models on hardpoints, pods, launch tubes, ammo boxes, shields, camo, armour plates), for every platform kind.
  Done when: Appendix C has the table extending P1-05.
- [ ] P6-02 - Implement: the platform model shows its loadout in the hangar, in play, for AI units and for co-op peers.
  Done when: every loadout item from P6-01 is visible, with no performance loss beyond the P0-02 budget.

## Phase 7 - Teams: up to four, colours, alliances

- [ ] P7-01 - Extend teams from (0 player side, 1 enemy, 2 neutral) to up to four fighting teams plus neutral. Separate team id from alliance: each pair of teams is allied or hostile.
  Done when: targeting, AI, friendly fire, scoring, radar and kill feed use the alliance table instead of fixed team ids.
- [ ] P7-02 - Each team has its own spawns and bases on the map. DECIDE how bases are placed per map for 2, 3 and 4 teams (flat, reachable, fair distances, naval access for sea maps).
  Done when: every map has valid base sets for 2-4 teams.
- [ ] P7-03 - Team colour selection: each team picks a colour from a palette that stays distinguishable (including colour-blind settings); replaces the fixed `TEAM_ACCENT`.
  Done when: chosen colours show on models, radar, HUD and kill feed.
- [ ] P7-04 - Skirmish setup: number of teams (2-4), alliance per team (allies, enemies, mixed), team colours, AI count per team.
  Done when: any combination can be set and played.
- [ ] P7-05 - Online co-op: players join any team; host settings sync teams, alliances and colours.
  Done when: a 4-team co-op match runs with peers on different teams.
- [ ] P7-06 - Save migration for skirmish records and settings that store team data.
  Done when: old saves load without errors.
- [ ] P7-07 - Allied AI offence (owner, 2026-10-29): allied AI units go on the attack when the headquarters is secure. DECIDE the rule (enough defenders near the headquarters, no enemy threat within a set range); otherwise they defend or fall back.
  Done when: in skirmish and in missions with an allied headquarters, allies attack while the headquarters keeps its defenders, and fall back when it is threatened.

## Phase 8 - Super hero platform

- [ ] P8-01 - DECIDE: the super hero platform design: body type, movement (which kinds it can switch between, if any), stats, and how "any configuration, loadout and specials at will" works in play (proposal: a quick menu to swap any weapon, utility, melee and superweapon at any time, with or without cooldowns).
  Done when: Appendix C has the design.
- [ ] P8-02 - Unlock through a setting (owner decision). DECIDE whether the setting needs a condition (example: campaign finished) or is available from the start.
  Done when: decision recorded and the setting implemented.
- [ ] P8-03 - Implement the platform: model, controls on touch / gamepad / keyboard, swap menu, AI behaviour if AI may use it.
  Done when: the platform plays in every mode (campaign, skirmish, co-op, training).
- [ ] P8-04 - Co-op rules: show other players when someone uses the super hero; DECIDE whether the host can disable it.
  Done when: works in co-op and the decision is recorded.

## Phase 9 - Single campaign

- [ ] P9-01 - Review the 18 missions: objectives, maps, platform kinds, what each teaches, unlocks, and which feel boring or cliche (with reasons).
  Done when: Appendix C has one row per mission.
- [ ] P9-02 - DECIDE: campaign story - setting, sides, main characters, conflict, turns, ending(s). Rule from the ideas file: not boring, not cliche. Write the reasons why each story beat avoids common cliches.
  Done when: Appendix C has the story outline.
- [ ] P9-03 - DECIDE: campaign structure - mission count, order, branches or choices (if any), platform kind variety, difficulty curve, unlock order (replaces `MISSION_UNLOCK`), where 3-4 team situations are used (owner decision: only where a mission asks for it).
  Done when: Appendix C has the mission list mapping each old mission to keep / merge / cut / rewrite / new.
- [ ] P9-04 - Implement the campaign: missions, briefings and debriefings, in-mission story events, progress save, chapter / mission select for replays.
  Done when: the campaign plays from start to end with no blocking bugs.
- [ ] P9-05 - Migrate mission progress and unlocks from the old missions to the campaign.
  Done when: an old save keeps its unlocked items.
- [ ] P9-06 - Co-op campaign: DECIDE whether every mission is co-op playable; implement accordingly.
  Done when: decision recorded and the co-op missions play to the end.

## Phase 10 - Final audit and release

- [ ] P10-01 - Repeat the P1-03 audit on the final build. Classify Critical, High, Medium, Low, Informational.
  Done when: no Critical or High finding remains open in Appendix D.
- [ ] P10-02 - Re-run P1-01 spawn and P1-02 naval audits.
  Done when: no failures.
- [ ] P10-03 - Device test: low-spec Android phone, iPhone, desktop keyboard / mouse, desktop gamepad, co-op with 2 and 4 peers.
  Done when: each passes or has a recorded known issue.
- [ ] P10-04 - Update in-game help and texts; bump the save version where needed.
  Done when: all texts match the final features.

---

## Appendix A - Coverage map (every line of the former Ideas-iron horizon.txt)

| Idea | Tasks |
|---|---|
| Problems with the start of platforms in various contexts and maps (naval far from objective, aircraft near map bounds) | P1-01, P2-01, P2-02, P10-02 |
| Naval platforms stuck in shallow water (rivers) | P1-02, P2-03, P2-04, P10-02 |
| Deformable terrain lowered by explosives, if possible | P4-01, P4-02 |
| Loadout affects the visual appearance of platform / unit | P1-05, P6-01, P6-02 |
| Team colour selection | P7-03 |
| Up to four teams, allies / enemies / mixed, each with own spawns and bases | P7-01, P7-02, P7-04, P7-05 |
| Super hero platform: any configuration, loadout and specials at will | P8-01 to P8-04 |
| Missing weapons, utilities, items in the arsenal | P5-01 to P5-03 |
| Cannot see fauna / animals | P1-04, P3-01, P3-02 |
| One campaign, not boring or cliche, well designed | P9-01 to P9-06 |
| Added 2026-10-29: pathfinding, units stuck on rivers; land spawns on cut-off land | P1-06, P2-05, P2-06, P10-02 |
| Added 2026-10-29: lock on specific objectives (radar towers, bases) | P5-04 |
| Added 2026-10-29: animals still not visible; show animals and civilians (on foot or in vehicles) on the radar | P1-04, P3-01, P3-03 |
| Added 2026-10-29: radar shows only detected units plus the lock; detection utility module with range by platform | P5-05 |
| Added 2026-10-29: missiles too hard to dodge, follow around buildings; evaluate and balance | P1-07, P5-06 |
| Added 2026-10-29: allied units attack when the headquarters is secure | P7-07 |

### Original text of Ideas-iron horizon.txt (verbatim)

```text
- Problems with Start of various platforms in various contexts,maps
Example Naval Starting at specific spawn far away from the objective or aircraft spawning close to map bounds.
- Naval Platforms getting stuck due to shallow water (ex in rivers)
- If possible.Add deformable terrain that lowers when hit with explosives.
- Loadout Further Affects Visual Appearance of Platform,Unit
- Selection of Color for Teams.
- Up to Four Teams either allies enemies or mixed Each on its own spawns, bases on the map.
- A special Platform,Unit that is a super Hero can use any configuration Loadout and Specials at will
-Include missing Weapons ,Utilities, Items in the Arsenal
-I cant see fauna,Animals
- Reorganize the Missions into a single Campaign. It shouldn't be boring,cliche. Rework it make it well designed.
```

## Appendix B - Research log

(Filled by RESEARCH tasks. One entry per item: topic, finding, source, verified yes / no / unknown.)

## Appendix C - Decision log

(Filled by DECIDE tasks and measurement tasks. One entry per task ID: decision or numbers, reason, date.)

### P0-01 - Baseline (2026-10-29)

- Commit `de9c168` (main). `IronHorizon.html`: 2,392,277 bytes in the repository (LF, `git cat-file -s`), 2,426,226 bytes in the Windows working copy (CRLF), 33,949 lines. `SAVE_VERSION = 1`.
- Self-test (`__IH.selfTest()`, headless Chrome 156, window 1280x800): 2651 checks, 0 failed, 73.5 s, no page errors, `Game.errors` empty. The 4 "iphone" touch-stick checks pass in a real 1280x800 window (the 0x0 hidden-viewport case was not run).
- Method: node script over the Chrome DevTools protocol, headless Chrome 156 with software rendering (SwiftShader, no GPU), i5-9600K, 32 GB, window 1280x800, device pixel ratio 1. Scene = the same set-up as `SelfTest.benchScene` (skirmish, large size, seed 11, clear weather, day, hazards off, veteran, 600 warm-up ticks, 10 untimed frames, 150 timed frames), with the timers split. Quality is set as the settings screen does (`S.quality`, `R.scaleCap`, `FX.budget`, resize). Every cell was run twice and the two runs are averaged (p50 and p95) or the larger value kept (max).
- Maps chosen: land = ashfall (a dry basin without water, Bulwark, scene `sk-ashfall`); sea = coast (a Trident at the harbour and the enemy fleet on the water, scene `sea-coast`); mixed = jungle (the densest forest, three rivers and the sea, Bulwark, scene `sk-jungle`; the heaviest battlefield in `BENCH_SCENES`).
- How to read the numbers: "JS work" = simulation tick + camera + render submit, in the page (CPU: JS / simulation). "Whole frame" = JS work plus a 1-pixel read that waits for the GPU; here the GPU is a CPU software rasteriser, so whole-frame times are pessimistic and are only for comparing runs on this PC. "Real loop" = the game's own frame loop over 10 s (frame intervals from `requestAnimationFrame`). Frame size follows the preset (`scale` 0.6 / 0.8 / 1.0).

| Scene | Preset | Frame size | JS work p50 / p95 / max (ms) | Whole frame p50 / p95 / max (ms) | Real loop fps (p95 interval) |
|---|---|---|---|---|---|
| sk-ashfall | low | 768x480 | 1.3 / 1.9 / 7.5 | 43.7 / 47.9 / 55.4 | 16.1 (66.8 ms) |
| sk-ashfall | medium | 1024x640 | 1.4 / 1.8 / 2.2 | 58.7 / 61 / 70.7 | 13.3 (91.8 ms) |
| sk-ashfall | high | 1280x800 | 1.6 / 1.9 / 2.7 | 97.7 / 103.6 / 118.6 | 9.9 (116.9 ms) |
| sea-coast | low | 768x480 | 1.5 / 1.9 / 3.1 | 38.9 / 44.5 / 47.1 | 14.6 (83.5 ms) |
| sea-coast | medium | 1024x640 | 1.6 / 2.1 / 2.7 | 63 / 77.2 / 85 | 12.4 (100.1 ms) |
| sea-coast | high | 1280x800 | 1.9 / 2.3 / 3.1 | 92.7 / 112.6 / 120.5 | 9.1 (133.5 ms) |
| sk-jungle | low | 768x480 | 1.3 / 1.6 / 2.3 | 70 / 73.5 / 79.3 | 12.1 (100.1 ms) |
| sk-jungle | medium | 1024x640 | 1.6 / 2.2 / 2.6 | 140.2 / 147.4 / 163.6 | 7.8 (150.2 ms) |
| sk-jungle | high | 1280x800 | 1.9 / 2.5 / 5.7 | 214.9 / 227.9 / 257.9 | 4.5 (250.3 ms) |

- Reading: on this PC the JS side is light (about 2 ms per frame at every preset, 41 to 42 platforms); the whole-frame time is the software rasteriser filling pixels (it grows with frame size and with the forest of the jungle). Real GPUs will be far faster; the JS column is the figure that carries over. JS heap about 61 to 73 MB; startup (`Game.startSession`) 72 to 265 ms.

### P0-02 - Low-spec mobile test method and baseline (2026-10-29)

- Device class: low-spec Android phone, about 4 times slower single-thread JS than this desktop (i5-9600K), weak GPU, Chrome, landscape.
- Target frame rate: 30 fps on the Low preset (the game steps its simulation at 1/60 s, so 2 steps per frame).
- Test scenes: the three P0-01 scenes (`sk-ashfall`, `sea-coast`, `sk-jungle`) on the Low preset, started and warmed up as in P0-01. Later phases add their own worst case here (P3 fauna: a high-fauna map such as archipelago; P4 craters; P6 loadout visuals; P7 four teams at the maximum AI count).
- Metrics: JS work per frame (tick, camera, render submit; p50 / p95 / max); whole frame with GPU wait (software GL, relative use only); real-loop frame interval (p50 / p95 and mean fps over 10 s); JS heap; startup time; file size (bytes of `IronHorizon.html`, LF in the repository). Fauna, particles, debris and platform counts are logged beside them (`W.fauna.count`, `W.platforms.length`, `W.debris.length`).
- Emulation recipe (repeatable on a desktop): headless Chrome through the DevTools protocol; `Emulation.setDeviceMetricsOverride` 640x360, device pixel ratio 1; `Emulation.setCPUThrottlingRate` 4; set quality 'low' (`S.quality`, `R.scaleCap = 1`, `FX.budget`, `UI.needResize`); the game then renders 384x216 (scale 0.6, `maxPx` 800000 not reached). Software GL stays on (no GPU in headless), so the whole-frame column is a CPU rasteriser and is not a phone GPU. A real-phone row is added in P10-03.
- Pass rule: JS work p95 at most 16 ms (half of a 33 ms frame, the rest is for the GPU and the browser); real-loop median interval at most 34 ms (30 fps) and p95 at most 51 ms; and no regression against the baseline: JS p95 and whole-frame p95 each at most 15% above the baseline row (same PC, median of 3 runs). A decision may accept a miss.
- Baseline (median of 3 runs, commit `de9c168`, Chrome 156):

| Scene | Frame size | JS work p50 / p95 / max (ms) | tick p95 / render p95 (ms) | Whole frame p50 / p95 / max (ms) | Real loop: mean fps, interval p50 / p95 (ms) | Heap MB | Startup ms |
|---|---|---|---|---|---|---|---|
| sk-ashfall | 384x216 | 5.7 / 11.6 / 28.6 | 3.2 / 8.7 | 30.4 / 36.1 / 50.7 | 29.0, 33.4 / 50.1 | 61 | 509 |
| sea-coast | 384x216 | 8.6 / 14.9 / 26.8 | 5.9 / 9.9 | 29.5 / 38.5 / 46.6 | 27.7, 33.4 / 50.1 | 61 | 970 |
| sk-jungle | 384x216 | 7.1 / 11.4 / 17 | 4.1 / 7.9 | 39.1 / 44.5 / 48.8 | 26.3, 33.4 / 50.1 | 61 | 933 |

- Baseline result: all three scenes pass the pass rule, with little room (JS p95 11.4 to 14.9 ms against 16 ms; median interval 33.4 ms; p95 50.1 ms). Run-to-run spread of JS p95 was 8.7 to 16.7 ms in the ashfall scene (other programs on the PC), so a regression needs the median of 3 runs to count. File size baseline: 2,392,277 bytes.

### P1-05 - What a loadout changes on the model today (2026-10-29)

- Source: the draw functions in `IronHorizon.html` (`drawPlatformBody` 15310 and `drawMech` 15373, `drawInfantry` 15494, `drawWheeled` 15590, `drawTracked` 15614, `drawHover` 15639, `drawBoat` 15676, `drawDestroyer` 15693, `drawAcv` 15714, `drawSpg` 15742, `drawMrl` 15769, `drawMortarApc` 15793, `drawJet` 15863, `drawGunship` 15888); the allowed items per platform from `PLATFORMS[id].allow`; weights from `WEAPONS`. Drawing is from `p.wslots`, so AI units show what the player shows (co-op peers: not checked in play). Past 380 m (`lod`) arms, secondary pods and small barrels are not drawn.
- General finding: a model shows only whether a slot is filled, plus one size class (weapon weight over 10 gives a thicker, longer barrel on mechs and the Bastion's main gun; the Ranger's Sniper Rifle gets a longer barrel). Two different weapons of the same size class look the same. Utilities and superweapons never change the model; shield, flares, smoke, ECM, camouflage and drones appear only as effects while in use (`drawPlatformOverlay` 15347 draws the shield bubble). Melee blades show on mechs and infantry. The hangar (`scr_hangar` 25983) shows text cards and bars, no model.
- Table per platform (yes = the item changes the picture; "no" = same picture as its neighbours; "empty" = the slot left empty):

**Wraith LM-1 (mech, drawMech)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A (right arm) / B (left arm) | empty -> any gun (a barrel appears); size class: slug (weight over 10) draws a thick long barrel | all others share one small barrel: mg, laser, shotgun, acannon, flamer, tesla, needler, ion; the active arm gets a light | one barrel per filled arm |
| Secondary | empty -> any weapon (a shoulder pod with two tubes) | every secondary looks the same: rockets, missile, mortar, swarm, cluster, atgm, mines, empGren | pod hidden past 380 m |
| Utility | shield only while raised (bubble) | all items: shield, nano, cloak, smoke, overdrive, holo, ecm | effects at use only (smoke, ECM, camo, drone, barrier, hologram) |
| Melee | sword, katana (blade in hand or on the back) | fists | blade on the back when idle |

**Bulwark MM-2 (mech, drawMech)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A / B | empty -> any gun; plasma, rail, gatling, gauss, lance, slug (weight over 10) draw a thick long barrel | all others share one small barrel: mg, acannon, laser, flamer, tesla, needler, ion; the active arm gets a light | one barrel per filled arm |
| Secondary | empty -> any weapon (a shoulder pod with two tubes) | every secondary looks the same: rockets, missile, mortar, swarm, cluster, atgm, mines, empGren | pod hidden past 380 m |
| Utility | shield only while raised (bubble) | all items: shield, aps, nano, ecm, smoke, overdrive, reactive, holo, drone, barrier | effects at use only |
| Melee | sword, katana | fists | |

**Colossus HM-3 (mech, drawMech)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A / B | empty -> any gun; gatling, plasma, rail, gauss, lance, slug, howitzer (weight over 10) draw a thick long barrel | all others share one small barrel: acannon, laser, flak, ion, flamer; the active arm gets a light | one barrel per filled arm |
| Secondary | empty -> any weapon (a shoulder pod with two tubes) | every secondary looks the same: missile, rockets, mortar, aam, cruise, cluster, swarm, atgm, mines | pod hidden past 380 m |
| Utility | shield only while raised (bubble) | all items: shield, aps, nano, reactive, barrier, drone, overdrive, ecm, smoke | effects at use only |
| Melee | sword, katana | fists | |

**Ranger IN-0 (infantry, drawInfantry); the Civilian is unarmed and shows nothing**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary (the held weapon only) | sniper (barrel 1.5 long against 0.9) | every other primary: rifle, smg, mg, lmg, dmr, arcPistol, flamer | switching weapons changes the picture only between sniper and the rest |
| Secondary | empty -> any (a launcher tube on the shoulder) | every secondary looks the same: rpg, grenade, satchel, empGren, javelin, mines | hidden past 380 m |
| Utility | none | all: nano, smoke, cloak, drone | effects at use only |
| Melee | knife (belt), sword, katana (back) | fists | |

**Jackal RV-1 (wheeled, drawWheeled)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A / B | empty -> any gun (two fixed barrels, right and left) | all items share the same barrel: mg, acannon, laser, shotgun, flamer, tesla, needler, slug | barrels hidden past 380 m |
| Secondary | empty -> any (a box on the turret) | all alike: rockets, missile, mines, swarm, cluster, atgm | |
| Utility | none | all: nano, smoke, ecm, overdrive, cloak | effects at use only |

**Bastion MBT-2 (tracked, drawTracked)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A (main gun) | empty -> any gun; plasma, rail, gatling, gauss, slug, howitzer, lance (weight over 10) draw a thicker barrel (0.7 against 0.5) | the rest share one barrel: acannon, mg, flak, ion | the main gun is drawn at any distance |
| Primary B | empty -> any (a small side barrel) | all alike | hidden past 380 m |
| Secondary | empty -> any (a box with a light) | all alike: missile, rockets, mortar, aam, atgm, cruise, cluster, mines, swarm | |
| Utility | none | all: aps, nano, reactive, smoke, ecm, barrier, drone | effects at use only |

**Specter HV-1 (hover, drawHover)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A / B | empty -> any gun (two fixed barrels) | all alike: laser, mg, shotgun, acannon, tesla, needler, ion, flamer | |
| Secondary | none (nothing is drawn for it) | all: missile, rockets, swarm, atgm, empGren, mines | no missile or rocket is ever shown |
| Utility | none | all: shield, nano, cloak, smoke, ecm, overdrive, holo | effects at use only |

**Kestrel IN-1 and Shrike SF-2 (jets, drawJet)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A / B | none (guns are not drawn at all) | all: mg, acannon, laser, vulcan (Kestrel); acannon, mg, gatling, laser, vulcan, ion (Shrike) | a jet never shows its guns |
| Secondary | empty -> any (one pale ventral pod; hidden past 380 m) | every secondary looks the same, bombs, napalm and bunker buster included: aam, missile, rockets, bombs, swarm, cluster, napalm, buster, atgm | no bomb is drawn under a Shrike |
| Utility | none | all: flares, ecm, overdrive, reactive | flares show as decoys when dropped |

**Behemoth HG-3 (gunship, drawGunship)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A / B | empty -> any gun (two chin barrels; A thicker than B) | all alike: gatling, acannon, plasma, flak, laser, vulcan, lance, ion | |
| Secondary | empty -> any (pods on both wings) | all alike: rockets, missile, bombs, aam, mortar, swarm, cluster, napalm, buster, cruise, atgm | hidden past 380 m |
| Utility | none | all: flares, nano, ecm, reactive, drone, overdrive | effects at use only |

**Lancer FC-1 (boat, drawBoat)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A | empty -> any gun (bow turret, one barrel) | all alike: acannon, navalGun, mg, flak, gatling | |
| Primary B | empty -> any (aft twin-barrel turret; hidden past 380 m) | all alike | |
| Secondary | empty -> any (two launch tubes at the stern) | torpedo, missile, rockets and SAM look the same | |
| Utility | none | all: smoke, flares, ecm, nano, aps | effects at use only |

**Trident DD-3 (destroyer, drawDestroyer)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A | empty -> any gun (forward turret, one big barrel) | all alike: navalGun, flak, acannon, gatling, howitzer, rail | |
| Primary B | empty -> any (aft turret, two barrels) | all alike | |
| Secondary | empty -> any (a lit cell cover and two torpedo tubes) | all alike, even a SAM or a cruise missile: shipSam, missile, torpedo, cruise, swarm, aam | the tubes are torpedo tubes whatever is mounted |
| Utility | none | all: aps, flares, ecm, smoke, nano, reactive, drone | effects at use only |

**Skua ACV-2 (hovercraft, drawAcv)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A / B | A empty -> any gun (a turret; with B filled the turret gets two barrels) | which gun does not matter: gatling, acannon, mg, flak, flamer | B alone adds no part |
| Secondary | empty -> any (a box on the deck; hidden past 380 m) | all alike: rockets, missile, mortar, atgm, shipSam | |
| Utility | none | all: smoke, nano, aps, flares, ecm | effects at use only |

**Thunder SPH-1 (howitzer, drawSpg)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A | none (the long barrel is always drawn) | artyGun, mg, acannon, gatling | even a machine gun in slot A shows the howitzer barrel |
| Primary B | empty -> any (a small coaxial barrel; hidden past 380 m) | all alike | |
| Secondary, Utility | none | all (atgm, missile, rockets, mines; smoke, aps, nano, reactive, ecm, drone) | |

**Hailstorm MRL-6 (rocket truck, drawMrl)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Every slot | none (the rocket pod and tubes are fixed) | all | the loadout never changes the model |

**Pestle MC-2 (mortar carrier, drawMortarApc)**

| Slot | Visible change: yes | No visible change | Notes |
|---|---|---|---|
| Primary A | none (the mortar tube is always drawn) | artyMortar, mg, lmg | |
| Primary B | empty -> any (a small side barrel; hidden past 380 m) | all alike | |
| Secondary, Utility | none | all | |

## Appendix D - Audit findings

(Filled by Phase 1 and P10-01. Columns: ID, severity, area, location, reproduction, fix task, status.)

### How the Phase 1 audits were run (2026-10-29)

- Build: commit `de9c168`, `IronHorizon.html` 2,392,277 bytes (repository, LF). Headless Chrome 156 (software GL), 1280x800, scripts driving `__IH`. No game code was changed. Scripts and raw results (JSON lines) are outside the repository, in `%TEMP%\claude\ih\` (`sweep-all.jsonl` has all 1408 spawn rows).
- Fixes are not part of Phase 1. The "Fix task" column points at the planned task that should remove the finding; "NEW" means no planned task covers it yet (proposal given).
- Severity: Critical = blocks play or loses data; High = a reported problem confirmed, or a common failure in normal play; Medium = a wrong or unfair situation in some modes or maps; Low = rare or cosmetic; Informational = a fact the later phases need.

### P1-01 - Spawn audit

- Scope: 16 playable platforms (Wraith, Bulwark, Colossus, Ranger, Jackal, Bastion, Specter, Kestrel, Shrike, Behemoth, Lancer, Trident, Skua, Thunder, Hailstorm, Pestle; Civilian is not a deployable pick) x 18 missions, 18 co-op missions (host plus 3 guest slots), 13 maps x 3 skirmish seeds (11, 777, 4242; medium size), 13 training maps = 1408 spawn runs. Each run starts the session through `Game.startSession`, records the player platform, then drives it forward for 3 s (mission, training and skirmish seed 11) and calls `respawnSite` once. Co-op is missions only in this build (`Net.startCoop` takes a mission id), so there is no skirmish or training co-op context.
- Logged per spawn: position, heading, distance to the nearest active primary objective marker (in a skirmish: own or enemy command centre), distance to the map bound along the heading, altitude, slope, water depth, ship depth minus draft, water route to the objective (flood fill on a 20 m grid), whether the platform moved, respawn site and whether a hostile sees it.
- Results by kind: land platforms (mech, infantry, ground, artillery): 862 of 862 land spawns are on dry ground below the slope limit (431 of them also driven for 3 s: all move); none of the 864 co-op guest rows is in water or on steep ground. Aircraft: 4 of 18 missions fail and 5 more warn (the table below). Ships: 3 of the 6 missions with ships fail, and every skirmish map with ships fails (21 of 21 rows). See D-001 to D-007.
- Rules used for FAIL / WARN: air FAIL = less than 800 m (about 5 s of flight) to `AIR_BOUND` along the heading; air WARN = faces away from the map centre or starts less than 500 m from `AIR_BOUND`. Ship FAIL = nearest objective more than 500 m away ("far"), or no navigable water within 150 m of any objective ("gap" = metres from the water the ship can reach to the nearest objective), or less than 0.6 m of water under the keel. Ship WARN = harbour more than 500 m from the start on respawn ("resp"), a respawn site a hostile sees, less than 1.5 m under the keel, or less than 150 m from the bound ("edge"). Obj = metres to the nearest primary objective marker. "Land start" is the Bulwark; other land platforms start within 14 m of it.
- Fallbacks (not failures): a ship pick on a map without ship water deploys as a Bulwark (`Naval.deploy`, 13324) with the notice NO HARBOUR HERE: ashfall, verdant, frost, valley, canyon, farmland (Lancer, Trident, Skua) and metro (Trident). m14 sends every platform in as infantry by design. Missions with no ship water (m1 to m8, m11, m13, m14, m18) deploy ships as Bulwark.

**Missions (solo host)**

| Scenario | Land start (bulwark) | Aircraft (Kestrel; Shrike / Behemoth same start) | Ships L=Lancer T=Trident S=Skua | Notes |
|---|---|---|---|---|
| m1 | -560,-640 obj 1301 m | -560,-640 yaw 0.7 bound ahead 2249 m WARN | - | start 1301 m from the objective |
| m2 | 620,-660 obj 1266 m | 620,-660 yaw 2.5 bound ahead 524 m FAIL | - | start 1266 m from the objective |
| m3 | -20,-90 obj 92 m | -20,-90 yaw 0 bound ahead 1170 m ok | - | - |
| m4 | -740,440 obj 82 m | -740,440 yaw 1.2 bound ahead 1766 m WARN | - | - |
| m5 | -150,-620 obj 844 m | -150,-620 yaw 0.2 bound ahead 1735 m WARN | - | - |
| m6 | 0,-140 obj -1 m | 0,-140 yaw 0 bound ahead 1220 m ok | - | no marker (hunt objective) |
| m7 | -300,-300 obj -1 m | -300,-300 yaw 0.8 bound ahead 1924 m ok | - | no marker |
| m8 | -520,-420 obj 1124 m | -520,-420 yaw 0.9 bound ahead 2043 m ok | - | start 1124 m from the objective |
| m9 | 260,-560 obj 566 m | 260,-560 yaw 1.6 bound ahead 820 m WARN | L 604,-483 obj 334 clear 10 ok; T 624,-437 obj 363 clear 12.6 ok; S 598,-460 obj 356 ok | harbour 352 to 384 m from the start |
| m10 | 480,240 obj 401 m | 480,240 yaw 1.6 bound ahead 600 m FAIL | L 637,104 obj 323 clear 17.5 ok; T 670,121 obj 357 clear 20.9 ok; S 652,123 obj 347 ok | Trident respawn site 224 m from start, other side of the bay |
| m11 | -460,-380 obj 117 m | -460,-380 yaw 0.6 bound ahead 1769 m ok | - | - |
| m12 | -320,-280 obj 149 m | -320,-280 yaw -0.3 bound ahead 1424 m ok | L 169,53 obj 275 clear 2.3 FAIL gap 177; T 216,39 obj 252 clear 3.1 FAIL gap 191; S 216,39 obj 252 WARN resp 646 | ships start in a 0.014 km2 pond; respawn 592 to 646 m from start; Lancer and Trident respawn site seen by a hostile |
| m13 | -280,360 obj 362 m | -280,360 yaw 0 bound ahead 720 m FAIL | - | - |
| m14 | foot -430,-20 | - | - | everything deploys as infantry |
| m15 | -560,-60 obj 704 m | -560,-60 yaw 1.8 bound ahead 1677 m ok | L -812,-13 obj 960 clear 13.4 FAIL far 960 gap 561; T -828,-13 obj 976 clear 14.9 FAIL far 976 gap 561; S -812,-13 obj 960 FAIL far 960 | ships start 118 m from the bound, 960 m from the objective |
| m16 | 100,60 obj 446 m | 100,60 yaw 0 bound ahead 1020 m WARN | L -206,200 obj 126 clear 2.8 ok; T -246,227 obj 97 clear 3.6 ok; S -206,200 obj 126 ok | river harbour, 2.8 m under the Lancer's keel |
| m17 | 560,-305 obj 274 m | 560,-305 yaw 3.1 bound ahead 775 m FAIL | L 560,-177 obj 402 clear 3.2 FAIL gap 381; S 560,-177 obj 402 ok | Trident falls back to Bulwark |
| m18 | 40,240 obj 199 m | 40,240 yaw 1.9 bound ahead 1092 m ok | - | - |

**Co-op: the host spawns as in the mission row; guests (slots 1-3) differ only as listed**

- m2, m13: each of the 9 guest aircraft (3 platforms x 3 slots) has less than 800 m to the bound ahead (same start and heading as the host, `Net.spawnFor`, 33260).
- m9: 6 of 9 guest aircraft under 800 m; guest ships up to 146 m from the host ship.
- m10: 9 of 9 guest aircraft under 800 m; guest ships up to 292 m from the host ship (a second harbour spot is taken, `Naval.spot` with avoid = true).
- m12: guest ships up to 58 m from the host ship. m16: up to 88 m.
- m15: 6 guest ships more than 500 m from the objective; up to 185 m from the host ship.
- m17: 9 of 9 guest aircraft under 800 m; guest ships up to 144 m from the host ship.

**Skirmish (medium; seeds 11, 777, 4242 as separate rows; obj 72 m is the own command centre; the enemy command centre is 900 m or more away by the layout rule)**

| Scenario | Land start (bulwark) | Aircraft (Kestrel; Shrike / Behemoth same start) | Ships L=Lancer T=Trident S=Skua | Notes |
|---|---|---|---|---|
| ashfall#11 | 155,479 obj 72 m | 155,479 yaw -2.7 bound ahead 1728 m ok | - | - |
| ashfall#777 | 356,353 obj 72 m | 356,353 yaw -2.4 bound ahead 1868 m ok | - | - |
| ashfall#4242 | -260,384 obj 72 m | -260,384 yaw 2.5 bound ahead 1776 m ok | - | - |
| verdant#11 | 155,479 obj 72 m | 155,479 yaw -2.7 bound ahead 1728 m ok | - | - |
| verdant#777 | 356,353 obj 72 m | 356,353 yaw -2.4 bound ahead 1868 m ok | - | - |
| verdant#4242 | -260,384 obj 72 m | -260,384 yaw 2.5 bound ahead 1776 m ok | - | - |
| frost#11 | 155,479 obj 72 m | 155,479 yaw -2.7 bound ahead 1728 m ok | - | - |
| frost#777 | 356,353 obj 72 m | 356,353 yaw -2.4 bound ahead 1868 m ok | - | - |
| frost#4242 | -260,384 obj 72 m | -260,384 yaw 2.5 bound ahead 1776 m ok | - | - |
| coast#11 | -184,517 obj 72 m | -184,517 yaw 3 bound ahead 1619 m ok | L 340,178 obj 666 clear 4.2 FAIL far 666 gap 559; T 388,196 obj 694 clear 6.9 FAIL far 694 gap 576; S 340,178 obj 666 FAIL far 666 | - |
| coast#777 | 65,-461 obj 72 m | 65,-461 yaw 0 bound ahead 1542 m ok | L 605,-395 obj 557 clear 9.5 FAIL far 557 gap 493; T 624,-443 obj 567 clear 12.9 FAIL far 567 gap 504; S 601,-372 obj 560 FAIL far 560 | - |
| coast#4242 | 19,-480 obj 72 m | 19,-480 yaw 0.1 bound ahead 1566 m ok | L 605,-391 obj 607 clear 9.4 FAIL far 607 gap 388; T 626,-432 obj 618 clear 13 FAIL far 618 gap 394; S 595,-462 obj 583 FAIL far 583 | - |
| archipelago#11 | -331,-327 obj 72 m | -331,-327 yaw 0.8 bound ahead 1891 m ok | L -284,-43 obj 308 clear 19.2 FAIL gap 258; T -260,-48 obj 314 clear 17.7 FAIL gap 267; S -261,-64 obj 299 ok | - |
| archipelago#777 | 356,353 obj 72 m | 356,353 yaw -2.4 bound ahead 1868 m ok | L 427,41 obj 391 clear 10.2 FAIL gap 242; T 427,25 obj 407 clear 10.6 FAIL gap 242; S 427,41 obj 391 ok | - |
| archipelago#4242 | 423,337 obj 72 m | 423,337 yaw -2.4 bound ahead 1992 m ok | L 470,37 obj 375 clear 11.5 FAIL gap 269; T 446,18 obj 392 clear 12.1 FAIL gap 269; S 470,37 obj 375 ok | - |
| valley#11 | -424,-294 obj 72 m | -424,-294 yaw 0.9 bound ahead 1897 m ok | - | - |
| valley#777 | 422,-321 obj 72 m | 422,-321 yaw -1 bound ahead 1801 m ok | - | - |
| valley#4242 | 439,-314 obj 72 m | 439,-314 yaw -0.9 bound ahead 1906 m ok | - | - |
| alpine#11 | -331,-327 obj 72 m | -331,-327 yaw 0.8 bound ahead 1891 m ok | L 221,56 obj 386 clear 5.5 FAIL gap 323; T 216,35 obj 407 clear 3 FAIL gap 339; S 221,56 obj 386 WARN resp 624 | harbour is a 0.014 km2 pond |
| alpine#777 | 356,353 obj 72 m | 356,353 yaw -2.4 bound ahead 1868 m ok | L 216,47 obj 403 clear 5.3 FAIL gap 326; T 240,72 obj 372 clear 2.7 FAIL gap 345; S 216,47 obj 403 ok | pond |
| alpine#4242 | -363,-348 obj 72 m | -363,-348 yaw 0.7 bound ahead 1835 m ok | L 223,41 obj 419 clear 5 FAIL gap 338; T 223,41 obj 419 clear 3.2 FAIL gap 358; S 223,41 obj 419 ok | pond |
| canyon#11 | 155,479 obj 72 m | 155,479 yaw -2.7 bound ahead 1728 m ok | - | - |
| canyon#777 | -210,-501 obj 72 m | -210,-501 yaw 0.4 bound ahead 1752 m ok | - | - |
| canyon#4242 | 275,-408 obj 72 m | 275,-408 yaw -0.5 bound ahead 1713 m ok | - | - |
| jungle#11 | -473,268 obj 72 m | -473,268 yaw 1.9 bound ahead 1622 m ok | L 5,-108 obj 539 clear 2.6 FAIL far 539 gap 367; T -318,-630 obj 927 clear 9.7 FAIL far 927 gap 534; S 5,-108 obj 539 FAIL far 539 | Trident harbour 912 m from the start |
| jungle#777 | -480,-163 obj 72 m | -480,-163 yaw 1.4 bound ahead 1575 m ok | L -408,-590 obj 449 clear 2.7 FAIL gap 303; T -315,-631 obj 524 clear 9.9 FAIL far 524 gap 437; S -408,-590 obj 449 ok | - |
| jungle#4242 | -462,-49 obj 72 m | -462,-49 yaw 1.3 bound ahead 1611 m ok | L -2,-109 obj 535 clear 2.5 FAIL far 535 gap 371; T -297,-635 obj 631 clear 10.3 FAIL far 631 gap 551; S -2,-109 obj 535 FAIL far 535 | - |
| volcano#11 | -200,413 obj 72 m | -200,413 yaw 2.7 bound ahead 1655 m ok | L -381,715 obj 293 clear 12.4 FAIL gap 229; T -403,720 obj 310 clear 10.5 FAIL gap 240; S -361,708 obj 275 ok | harbour 210 to 222 m from the bound |
| volcano#777 | 355,-341 obj 72 m | 355,-341 yaw -0.5 bound ahead 1652 m ok | L 723,-335 obj 376 clear 9.8 FAIL gap 229; T 739,-335 obj 392 clear 8.8 FAIL gap 243; S 723,-335 obj 376 ok | 191 to 207 m from the bound |
| volcano#4242 | -260,384 obj 72 m | -260,384 yaw 2.5 bound ahead 1776 m ok | L -399,707 obj 287 clear 13 FAIL gap 227; T -400,724 obj 303 clear 10.1 FAIL gap 238; S -399,707 obj 287 ok | - |
| tundra#11 | -98,-471 obj 72 m | -98,-471 yaw 0.3 bound ahead 1630 m ok | L -287,173 obj 595 clear 4.1 FAIL far 595 gap 362; T -264,213 obj 555 clear 3.9 FAIL far 555 gap 381; S -241,169 obj 558 FAIL far 558 | - |
| tundra#777 | 1,-460 obj 72 m | 1,-460 yaw 0.2 bound ahead 1569 m ok | L -233,170 obj 529 clear 3 FAIL far 529 gap 336; T -256,213 obj 524 clear 3.7 FAIL far 524 gap 355; S -233,170 obj 529 FAIL far 529 | - |
| tundra#4242 | -363,-348 obj 72 m | -363,-348 yaw 0.7 bound ahead 1835 m ok | L -363,180 obj 600 clear 2.5 FAIL far 600 gap 438; T -339,211 obj 632 clear 2.2 FAIL far 632 gap 457; S -363,180 obj 600 FAIL far 600 | - |
| metro#11 | 435,316 obj 72 m | 435,316 yaw -2.1 bound ahead 1730 m ok | L 387,-113 obj 446 clear 3.2 FAIL gap 374; S 387,-113 obj 446 ok | - |
| metro#777 | -477,-185 obj 72 m | -477,-185 yaw 1.2 bound ahead 1688 m ok | L -429,148 obj 354 clear 3 FAIL gap 343; S -429,148 obj 354 ok | - |
| metro#4242 | -422,-358 obj 72 m | -422,-358 yaw 0.9 bound ahead 1850 m ok | L -351,116 obj 496 clear 3.1 FAIL gap 441; S -281,84 obj 491 ok | - |
| farmland#11 | -200,413 obj 72 m | -200,413 yaw 2.7 bound ahead 1655 m ok | - | - |
| farmland#777 | 65,-461 obj 72 m | 65,-461 yaw 0 bound ahead 1542 m ok | - | - |
| farmland#4242 | 19,-480 obj 72 m | 19,-480 yaw 0.1 bound ahead 1566 m ok | - | - |

**Training**

| Scenario | Land start (bulwark) | Aircraft (Kestrel; Shrike / Behemoth same start) | Ships L=Lancer T=Trident S=Skua | Notes |
|---|---|---|---|---|
| ashfall | 0,-150 | 0,-150 yaw 0 bound ahead 1230 m ok | - | - |
| verdant | 0,-150 | 0,-150 yaw 0 bound ahead 1230 m ok | - | - |
| frost | 0,-150 | 0,-150 yaw 0 bound ahead 1230 m ok | - | - |
| coast | 40,-150 | 40,-150 yaw 0 bound ahead 1230 m ok | L 349,79 clear 6.3 ok; T 367,80 clear 5.5 ok; S 349,79 ok | harbour 384 to 400 m from the start |
| archipelago | 360,210 | 360,210 yaw 0 bound ahead 870 m WARN | L 440,36 clear 11.2 ok; T 418,27 clear 10.5 ok; S 418,44 ok | aircraft faces the east edge (720 m from the bound) |
| valley | 0,-470 | 0,-470 yaw 0 bound ahead 1550 m ok | - | - |
| alpine | -160,-310 | -160,-310 yaw 0 bound ahead 1390 m ok | L 224,53 clear 5.4 ok; T 220,33 clear 2.8 WARN resp 518; S 224,53 ok | harbour 480 to 518 m from the start |
| canyon | 0,-150 | 0,-150 yaw 0 bound ahead 1230 m ok | - | - |
| jungle | -400,-190 | -400,-190 yaw 0 bound ahead 1270 m ok | L -8,-113 clear 1.7 ok; T -329,-632 clear 10 ok; S -8,-113 ok | Lancer harbour in a river, 1.7 m under the keel |
| volcano | -400,-70 | -400,-70 yaw 0 bound ahead 1150 m ok | L -793,-205 clear 20.1 WARN edge 137; T -796,-244 clear 19.9 WARN edge 134; S -775,-250 ok | ships start 134 to 155 m from the bound |
| tundra | 0,-510 | 0,-510 yaw 0 bound ahead 1590 m ok | L -235,171 clear 3.1 WARN resp 736; T -258,213 clear 3.7 WARN resp 784; S -235,171 WARN resp 736 | harbour 736 to 784 m from the start |
| metro | -40,-430 | -40,-430 yaw 0 bound ahead 1510 m ok | L 187,-44 clear 2.8 ok; S 187,-44 ok | - |
| farmland | -40,-110 | -40,-110 yaw 0 bound ahead 1190 m ok | - | - |

Why the spawns fail (code): `Game.spawnPlayer` (24445) and `Net.spawnFor` (33260) put every platform at the mission's `start` with the mission's heading; an aircraft only gets `AIR_START_ALT` (160 m) added (24452, 33270). Nothing checks the heading or the distance to `AIR_BOUND`. A ship goes to `Naval.harbour` (13314): the nearest water it can sail to the start, searched out to `NAVAL_HARBOUR_REACH` = 2000 m (13148), with no test of the objective or of a water route to it.

### P1-02 - Naval stuck audit

- Ship water on the 13 maps (from the map definitions; ships are offered only where `Naval.mapOk` is true: a sea, an open sea, or water 4.5 m deep). Need under the keel = draft + 0.6 m: Lancer 1.8 m, Trident 3.6 m. The Skua is a hovercraft and crosses land by design (not audited here).

| Map | Water body (depth, width) | Lancer | Trident | Ships offered |
|---|---|---|---|---|
| coast | sea east (26 m); harbour lake r 150 m (12 m); river (3 m, 24 m wide) | sea and lake yes; river: every sample narrower than 18 m (the Lancer's turning room), narrowest 9 m | sea and lake yes; river blocked (3 m < 3.6 m) | yes |
| archipelago | open sea (34 m) | yes | yes | yes |
| alpine | lake r 80 m (7 m), 0.014 km2 | yes, but only 160 m across | yes, 160 m across | yes |
| jungle | sea south (22 m); river 1 (4 m, 42 m); rivers 2, 3 (3 m, 26 m) | river 1 yes (narrowest 29 m); rivers 2, 3 narrower than 18 m on 25 of 34 and 23 of 34 samples (narrowest 13 m) | river 1: narrower than 34 m on 55 of 59 samples (narrowest 10 m); rivers 2, 3 blocked | yes |
| volcano | open sea (32 m) | yes | yes | yes |
| tundra | lake r 210 m (8 m); river (2.5 m, 22 m) | lake yes; river: 10 of 40 samples blocked, 29 narrower than 18 m | lake yes; river blocked | yes |
| metro | river (4.5 m, 44 m), two ship-deep pieces of 0.02 km2 each | river has no deep-enough water between about (-125,30) and (175,-5), 300 m: it is cut in two | cut in two as well (13 samples blocked, 50 narrower than 34 m) | Lancer yes, Trident no (falls back) |
| valley | river (3.5 m, 34 m) | 9 of 68 samples blocked | blocked | no (needs 4.5 m) |
| canyon | river (2.5 m, 18 m) | 20 of 63 blocked, 43 narrower than 18 m | blocked | no |
| farmland | river (2.5 m, 22 m); lakes (4 m, 3.5 m) | river narrowest 7 m | blocked | no |
| ashfall, verdant, frost | none | - | - | no |

- Player ships (Lancer on 7 maps, Trident on 6): 144 shoreline drive trials, each starting 30 to 90 m from a shore or shallow edge of the largest water bodies, runs full ahead 30 s, then astern 12 s, then forward with the rudder over 12 s. Result: 0 groundings (depth never below draft), 0 trials stuck for good (every run backed out 48 to 79 m), lowest clearance 0.0 m once and under the 0.6 m margin in 3 of 144 runs. The game warns SHALLOW WATER (143 of 144). In 5 runs the rudder alone did not turn the ship away from the shore while it was blocked ahead: the player must go astern (`shoreBlocked`, 14183: the end leading the way may not go on where the water is no deeper). Code: no way to enter water below the draft was found.
- AI ships (gunboat = Lancer, destroyer = Trident): 57 runs of 60 to 150 s on 7 maps, a goal marker to follow or the patrol lane. 8 runs sat still for 20 s or longer; one ran aground. Places (map, platform, coordinates where it stopped, still time):

| Map | Platform | Where | Note |
|---|---|---|---|
| metro | gunboat (Lancer) | 451,-158 | aground (depth minus draft -0.5 m), still 134 s; route from 410,-130 toward 650,-190 |
| metro | gunboat | 568,-162 | still 114 s; route from 690,-210 toward 330,-90 |
| metro | gunboat | 472,-153 | still 135 s; route from 650,-210 toward 270,-70 |
| metro | gunboat patrol | 260,-85 | still 54 s (patrol loop at the harbour) |
| volcano | gunboat | 508,-630 | still 131 s; route from 330,-810 toward 730,-270 |
| volcano | gunboat patrol | -799,-97 | still 51 s (west edge of the map) |
| archipelago | gunboat | 113,-637 | still 24 s; route from 210,-830 toward 750,-750 |
| jungle | gunboat patrol | 3,-204 | still 25 s (patrol loop in the river, 0.6 m under the keel at its worst point) |

- Cause in code: AI ships steer with `steerOpen` (22296): one probe 2.5 radii plus 10 m ahead and six fixed turn angles, no route search. A bend, a bridge pier or a shallow tongue stops them. `runNaval` (22215) also replaces any goal by the patrol lane (22219 to 22222) unless the ship follows a unit.
- Places that trap a ship (for the Phase 2 tests): the alpine pond (harbour for both ships, 0.014 km2); the metro river cut at (-125,30) to (175,-5); the narrow rivers listed above (a Lancer cannot turn in coast, farmland, canyon, tundra and jungle rivers 2 and 3); the jungle river harbour at (-8,-113) (Lancer, 1.7 m under the keel); the m12 pond (169,53) and m16 river (-206,200).

### P1-03 - General audit (findings)

Reproduce a spawn with the console: `__IH.Game.startSession({mode:'mission', missionId:'m2', platformId:'kestrel', loadout:__IH.Loadout.forPlatform('kestrel'), difficulty:'veteran'}); const p = __IH.W().player; [p.x, p.z, p.yaw]`. Skirmish: `mode:'skirmish'` with `skirmish: Object.assign({}, __IH.SKIRMISH_DEFAULT, {map:'coast', seed:11, random:false, platformId:'trident'})`. Training: `mode:'training', map:'coast'`. Totals: Critical 0, High 6, Medium 11, Low 2, Informational 6.

| ID | Severity | Area | Location | Evidence / reproduction | Fix task | Status |
|---|---|---|---|---|---|---|
| D-001 | High | Spawn: aircraft near the bound, heading outward | `spawnPlayer` 24445; `Net.spawnFor` 33260; mission `start` yaw | m2 (620,-660 yaw 2.5): 524 m to `AIR_BOUND` ahead; a Kestrel covers 510 m in 3 s and ends 12 m from the bound. m10 600 m, m13 720 m, m17 775 m. Warn: m1, m4, m5, m9, m16, training archipelago (870 m). Guests in co-op copy it (9 of 9 guest aircraft under 800 m in m2, m10, m13, m17). | P2-01, P2-02 | open |
| D-002 | High | Spawn: ships far from the objective, no water route | `Naval.harbour` 13314; `Naval.deploy` 13324; `NAVAL_HARBOUR_REACH` 13148 | Skirmish: 47 of 60 ship spawns are more than 500 m from the nearest objective or have no water within 150 m of it (all 21 map-seed rows fail). Examples: coast#11 Trident 694 m from the objective, jungle#11 Trident 927 m; m15 ships 960 m away and 118 m from the bound; m17 Lancer has no water within 381 m of the objective. | P2-01, P2-02, P2-03 | open |
| D-003 | Medium | Respawn: harbour far from the start, or seen by a hostile | `respawnSite` 16893; `hiddenNear` 22666 (falls back to the start after 8 rings) | Respawn harbours 128 to 912 m from the start (jungle#11 Trident 912 m, tundra training 736 to 784 m, alpine 480 to 663 m). m12 Lancer and Trident respawn sites are seen by a hostile. | P2-02 | open |
| D-004 | Medium | Spawn: ship harbour in a tiny water body | `Naval.spot` 13287 (`NAVAL_SPOT_ROOM_MIN` 4 m fallback, 13147) | Alpine pond (0.014 km2) holds the harbour of both ships in every alpine skirmish seed and in m12; room round the Lancer's spot is 10 m, the Trident's 25 m. Metro harbour (208,-57) room 10 m. Jungle river harbour 1.7 m under the keel. | P2-01, P2-03 | open |
| D-005 | Medium | Co-op: guest spawns | `Net.spawnFor` 33260 | Guest ships take other harbour spots: up to 292 m from the host ship in m10, 185 m in m15 (6 guest ships over 500 m from the objective). Guest aircraft copy the host's heading and altitude. | P2-02 | open |
| D-006 | Medium | Spawn: land start far from the first objective | mission `start` data | m1 start is 1301 m, m2 1266 m, m8 1124 m, m5 844 m, m15 704 m from the nearest objective marker. | P2-01 | open |
| D-007 | Informational | Ship picks fall back to the Bulwark | `Naval.deploy` 13324; `Naval.fellBack` 13359 | Ashfall, verdant, frost, valley, canyon, farmland (all ships) and metro (Trident) deploy a Bulwark with a notice; the hangar disables the card with a reason. 174 of 1408 spawn rows fell back (ships and m14). | P2-01 (keep the rule) | open |
| D-008 | Low | Spawn code is not seeded | `findSpawn` 22587, `spawnUnit` 22681 (`Math.random`, 240 uses in the file) | The same session gives different spawn spots and AI paths each run, so audits (and the P2 re-run) need many samples or a seeded random stream. | P2-02 | open |
| D-009 | High | AI ground units have no route planning | `AIController.steerAround` 22285, `steerOpen` 22296, `STEER_ANGLES` 22047 | 75 AI runs across water: 14 failed (tank 7 of 25, infantry 6 of 25, medium mech 1 of 25); table under P1-06. Same code as the owner's report. | P2-05 | open |
| D-010 | High | AI tanks drown | `steerOpen` 22306 (probe only 2.5 radii ahead), `Platform.updateWater` 14392, `DROWN_RATE` 13123 | In the first run 4 of the 7 failed tanks were dead at the end (archipelago x2, jungle, metro). In a re-run of the 14 failed routes 2 tanks died with the kill-feed cause Drowned (archipelago at 66 s, jungle at 145 s) and 3 more spent 11 to 15 s deeper than their 1.2 m ford depth. | P2-05 | open |
| D-011 | Medium | Land spawn cut off by water | Archipelago layout (`skirmishLayout` 23784), m10 | Archipelago skirmish, all 3 seeds: the enemy command centre (e.g. seed 11 at 430,381) cannot be reached by tank or infantry from the start (the start side holds 29 to 70% of the dry ground). Mechs wade across (ford 5.5 m). m10 guns on the islands: unreachable by land by design. | P2-06 | open |
| D-012 | Medium | AI ships stall or run aground | `runNaval` 22215, `steerOpen` 22299 | 8 of 57 runs still for 20 s or more, 1 aground (-0.5 m), see the P1-02 table. | P2-03 | open |
| D-013 | Informational | Player ships never ground | `shoreBlocked` 14183, `stepNaval` 14131 | 144 shore trials, 0 groundings, none stuck for good. Keep these trials as the P2-03 regression test. | - | closed |
| D-014 | High | Fauna is rarely on screen | `QUALITY` 721; `Fauna.populate` 9244, `draw` 9770; map `fauna` fields | See P1-04 below. | P3-01, P3-02 | open |
| D-015 | Medium | Species per map: deer on 2 maps only | map definitions (`fauna.species`) | Deer exist only on verdant (7 animals) and valley (5) at Medium. The owner saw a deer once, which fits. | P3-01 | open |
| D-016 | High | Missiles keep tracking after line of sight is lost | `updateProjectiles` 16043; `steerProjectile` 15982; `projectileTargetPos` 15995 | See P1-07 below. | P5-06 | open |
| D-017 | Medium | Countermeasures are all or nothing | `deployFlares` 15043 (`FLARE_SPOOF` 0.5, swarm x2), `WPN.jam` 16303 | Flares turn 12 of 24 AA missiles away (hit rate 100% to 46%), ECM turns away 24 of 24 (hit rate 0%); a flare or ECM user is safe, a user without them cannot dodge. | P5-06 | open |
| D-018 | Medium | Loadout barely changes the model; no hangar preview | `drawMech` 15373 and the other `draw*` functions; `scr_hangar` 25983 | See P1-05 (Appendix C): jets draw no guns, most weapons in a slot look the same, Hailstorm never changes, the hangar shows text cards only. | P6-01, P6-02 | open |
| D-019 | Medium | Team ids are fixed in code | `TEAM_ACCENT` 15289 (3 entries); 40 lines test `team === 1` / `!== 1`, 42 lines `team === 0` / `!== 0`, 17 lines team 2; `hostileSees` 22627 counts only team 1; `forwardSpawn` 22657 only team 0 | A third fighting team or a team colour choice touches about 100 lines of code. | P7-01, P7-03 | open |
| D-020 | Medium | Co-op runs missions only | `Net.startCoop` (called with `Net.missionId`, 25826) | There is no skirmish or training co-op session, so 2-4 team skirmish co-op (P7-05) needs a new session type. | P7-05 | open |
| D-021 | Informational | File size figures | section 2 of this file | The 2,392,277 bytes in section 2 are the repository (LF) size; the Windows working copy is 2,426,226 bytes (CRLF). | - | open |
| D-022 | Informational | Objective structures can already be cycled as targets | `Platform.cycleTarget` 14596 (adds `W.structs` with `objective`); `validTarget` 14580 | Code only, not tested in play. Missile locks on structures refuse `lock: 'air'` weapons (`lockFit` 14625). Input for P5-04. | P5-04 | open |
| D-023 | Informational | Self-test | `SelfTest.run` 26572 | 2651 checks, 0 failed (1280x800 window, 73.5 s). Not run: the 0x0 hidden-viewport case. | - | closed |
| D-024 | Low | Mission start data: three missions have no marker | m6, m7 (no primary marker: hunt objectives) | The spawn audit has no objective distance for them; a spawn rule per context must use the mission `start` and the first wave instead. | P2-01 | open |
| D-025 | Informational | No Content-Security-Policy meta tag | document head | Fact from section 2, unchanged. | - | open |

### P1-04 - Fauna not visible (cause)

- The animals exist. 13 maps x 3 quality presets at skirmish seed 11 (player starts in the own base yard): Low 24 to 46 animals (median 39), Medium 36 to 93 (median 64), High 47 to 147 (median 86); 12 to 28 groups (herds, flocks, schools) per map on a field of about 3.1 km2 (+-880 m). Default quality is Medium (`S.quality`).
- But too few are within draw range of where play happens. `Fauna.draw` (9770) draws an animal only within `faunaDraw` of the camera: Low 260 m, Medium 380 m, High 520 m (`QUALITY`, 722 to 724), and at most `faunaCap` (32 / 64 / 100).
  - Start position, animals inside the draw radius: none on 8 of 13 maps at Low, 3 of 13 at Medium, 1 of 13 at High. Median nearest herd to the start is 332 m (143 to 577 m), farther than the Low radius on 8 maps.
  - Drawn on screen at the start (camera at spawn, forward view): Low 0 of 13 maps, Medium 0 on 10 of 13 maps (the others 6, 9, 3 animals), High 0 on 3 of 13. Looking round (best of 8 headings): Medium still 0 on 6 of 13 maps. The same for a Kestrel at 160 m: Medium 0 on 11 of 13 maps (airborne cameras gain nothing; the draw radius is measured on the ground plane).
  - Along the way to the enemy base (every 50 m): Medium has an animal in range on a median 95% of points (86% for a ground herd), Low 73% (50% for a herd); but the range counts all round, the view cone only a quarter of it. Along the way the median count in range is 11 at Medium.
  - Missions at Medium: 4 of 18 starts (m3, m4, m6, m14) have no animal in range; the nearest animal to the start is 82 to 698 m away (m4: 698 m, m14: 391 m, m3 and m6: 385 m).
- Size on screen (field of view 72 degrees, 800 px high): a deer (1.34 m tall) is 7 px at 100 m, 3 px at 260 m, 2 px at 380 m, 1 px at 520 m; a rabbit or crow (0.29 m) is under 2 px beyond 100 m; a cow 2 px at 380 m. Past `faunaLod` (70 / 110 / 150 m) animals use the simple model. A herd drawn at the limit is a few dots.
- Species per map at Medium: ashfall only goats (22) and camels (2) on the ground, canyon goats (14) and camels (8), metro 3 foxes, archipelago monkeys (18) and flamingos (4). Deer exist on verdant (7) and valley (5) only (D-015).
- Cause (ranked): 1. low density against a short draw radius on the default presets (12 to 28 groups of all kinds over 3.1 km2; the radius is 260 to 380 m on Low and Medium); 2. animals are 1 to 3 px tall at that radius, so even in range they are hard to see; 3. the first herd lies 143 to 577 m from the start (median 332 m), and several maps have none within the Medium radius; 4. Low and Medium also cut the number placed (`fauna` share 0.5 / 0.75 of High) and the total (`faunaSim` 48 / 96); 5. the species lists leave common animals out of some maps. No culling bug was found: `Fauna.draw` draws what is in range and in view (up to 25 animals at High on archipelago).
- Reproduce: `__IH.S.quality = 'medium'; __IH.Game.startSession({mode:'skirmish', platformId:'bulwark', loadout:__IH.Loadout.forPlatform('bulwark'), difficulty:'veteran', skirmish:Object.assign({}, __IH.SKIRMISH_DEFAULT, {map:'ashfall', seed:11, random:false})})`, then `__IH.W().fauna.groups`, and after a few frames `__IH.W().fauna.drawn`.

### P1-06 - Ground route audit

- Method: flood fill of cells a land platform can stand on (15 m grid over +-930 m; slope limit of the platform, ford depth 1.2 m for tracked and wheeled vehicles, 0.55 x height for mechs, 1.2 m for infantry the AI would choose, a bridge deck counts when the approach is within `BRIDGE_STEP`). Start = the player start of 57 scenarios (13 maps x 3 skirmish seeds plus 18 missions). Targets = every active primary objective marker, plus the enemy base in a skirmish. Buildings are not modelled (they can be destroyed or driven round).
- Cut-off spawns: only the archipelago. In all 3 skirmish seeds the tank and infantry cannot reach the enemy command centre (seed 11: 430,381; seed 777: -322,-426; seed 4242: -374,-437): the start island holds 29% (seeds 777, 4242) or 70% (seed 11) of the dry land. The Bulwark reaches it by wading (5.5 m). m10 (archipelago): the three gun sites (330,-170; 450,-160; 560,-220) are cut off for tank and infantry by design (amphibious mission). m9 and m16 targets (a convoy at sea or on the river) are unreachable by land for mechs and infantry by design. Every other scenario (51 of 57) is fully connected; jungle, valley, metro, tundra, farmland and the others are joined by fords or bridges.
- Stuck AI land units: 75 runs (3 random start/goal pairs per map across water, 150 s each, other units removed; tank, medium mech, infantry). 61 arrived; 14 did not. Tank 7 of 25, infantry 6 of 25, medium mech 1 of 25. (The run is random: a second run of the same 14 pairs gave different details; the picture is the same.)

| Map | Platform | From | Goal | Stopped at | Note |
|---|---|---|---|---|---|
| archipelago | tank | 405,405 | 165,45 | 184,113 | drowned (depth 1.5 m) |
| archipelago | tank | 360,495 | -45,30 | 139,143 | drowned (depth 2.1 m) |
| valley | tank | 0,-165 | 390,180 | 235,-31 | on the bank, 248 m from the goal |
| valley | infantry | 0,-165 | 390,180 | 246,-21 | still for 102 s on the bank |
| alpine | medium mech | 585,-105 | 0,165 | 246,93 | in 4.1 m of water, 255 m from the goal |
| canyon | infantry | -825,120 | -255,-60 | -271,-17 | 46 m from the goal |
| jungle | tank | -135,495 | 285,135 | -42,134 | river bank, 326 m from the goal |
| jungle | infantry | -135,495 | 285,135 | -48,137 | same bank |
| jungle | tank | 45,540 | -300,15 | 1,57 | river bank |
| jungle | infantry | 45,540 | -300,15 | -4,137 | river bank |
| jungle | tank | -240,465 | -15,675 | -129,668 | drowned (depth 1.3 m) |
| metro | tank | -885,150 | -270,270 | -347,99 | drowned (depth 1.4 m) |
| metro | infantry | -885,150 | -270,270 | -337,88 | bank |
| metro | infantry | -810,375 | -615,150 | -613,228 | bank |

- Cause: `steerOpen` (22296) tests only a point `radius x 2.5 + 10` m ahead, `steerAround` (22285) then tries six fixed turn angles (+-0.5, +-1.0, +-1.6 rad) and otherwise backs out. There is no route search, so a unit goes to the bank in a straight line, turns, drowns (D-010) or idles ("still" 100+ s). Bridges and fords are used only when the straight heading happens to cross them. Infantry swim (`SWIM_DEPTH` 1.2) but the AI refuses water deeper than 1.2 m.
- Fix tasks: P2-05 (pathfinding), P2-06 (connected spawn; the archipelago needs a bridge, a ford or a different base placement).

### P1-07 - Missile audit

- Method: a fixed shooter (9 m eye height) on ashfall at the open spot (-200,500) fires one missile per trial at a locked target (dummy ground target 12 m/s or dummy aircraft 120 m/s at 150 m) with a seeded random start bearing, 24 trials per cell; the target path is scripted. "Dodge" = the target reverses sideways every 0.8 to 1.6 s (ground) or turns S-curves of 0.5 rad/s (aircraft, about 6 g). Hit = the missile ends within the target's radius + 2.5 m. The wire missile is steered by a crosshair that lags the target by 0.3 s. Flare and ECM runs use the AI jet's own flares or ECM (it drops them when a missile is inbound). LOS runs: the target walks behind a ridge starting 0.4 s after launch (24 ridges found by search); "tracks blind" = the missile still has its target while the shooter has no line of sight. The scripted dodge is mild, not the best a player could do; see the kinematic argument below.

| Missile | Speed m/s (start - max) | Life s | Range m | Turn rad/s | Turn radius at max speed | Seeker (lock, time, cone) | Lead | Re-lock after launch | Flare chance | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| missile (Guided Missile) | 140 - 200 | 5.5 | 900 | 2.0 | 100 m | any, 1.0 s, 0.28 rad | none (pure pursuit) | none | 50% | |
| aam (AA Missile) | 190 - 290 | 5.0 | 1100 | 4.2 | 69 m | air, 0.7 s, 0.5 rad | none | none | 50% | |
| swarm (Swarm Missiles, 8 per salvo) | 100 - 220 | 4.0 | 650 | 3.2 | 69 m | any, 0.8 s, 0.4 rad | none | none | 100% | |
| shipSam (Ship SAM) | 160 - 300 | 6.0 | 1400 | 3.6 | 83 m | air, 0.8 s, 0.9 rad | none | none | 50% | |
| cruise (Cruise Missile) | 55 - 125 | 16 | 1500 | 0.9 | 139 m | any, 2.0 s, 0.2 rad | none | none | 50% | |
| javelin | 45 - 160 | 7.0 | 600 | 3.0 | 53 m | ground, 1.5 s, 0.3 rad, top attack (climbs up to 60 m, dives within 35 m) | none | none | 50% | |
| atgm (wire) | 70 - 125 | 9.0 | 900 | 2.4 | 52 m | none: follows the crosshair | the player aims | the owner must keep aiming | immune | |

- What the code does after launch (`updateProjectiles`, 16021): from 0.25 s on, a guided missile turns toward the target's current position by at most `turn x dt` each tick (`steerProjectile` 15982), as long as the target is alive (`projectileTargetPos` 15995). It never tests line of sight, never tests the seeker cone, has no gimbal limit (it can turn through 180 degrees), and does not lose the target behind a building or a hill. It ends on impact with terrain (16074), a structure (16091) or a building (`rayBuildings` 16099), on its lifetime, on a flare (`deployFlares` 15043: each drop turns each inbound missile with 50% chance, swarm 100%), on ECM (`WPN.jam` 16303: every missile within 80 m or locked on the user loses guidance, always), on camouflage (`WPN.lose` 16313) or when the target dies (the missile then flies on straight). Lock-on needs line of sight and the cone only at the moment of firing (`updateLock` 14633, `lockSight` 14617 with a 0.4 s grace); a missile fired without a lock is dumb-fired.
- Measured hit rates (24 trials per cell unless a smaller n is shown; ground cells at 500 m: n 14 to 16 because of the open-ground limit; hit = direct):

| Missile | Ground target, straight | Ground, dodging | Air, straight | Air, dodging | Target hides behind a ridge | With flares (air, dodging, 800 m) | With ECM |
|---|---|---|---|---|---|---|---|
| missile | 250 m 71%, 500 m 86% | 250 m 67%, 500 m 100% | 400 m 100%, 800 m 0% (runs out of life) | 400 m 100%, 800 m 75% | 33% (15 of 24 hit the ridge, 23 tracked blind) | 21% (12 spoofed) | 0% |
| aam | - | - | 400 m 100%, 800 m 100% | 400 m 100%, 800 m 100% | - | 46% (12 spoofed) | 0% |
| swarm | 250 m 71%, 500 m 86% | 250 m 71%, 500 m 100% | 400 m 100%, 800 m 0% | 400 m 100%, 800 m 17% | 25% (19 of 24 hit the ridge) | 0% (24 spoofed) | 0% |
| shipSam | - | - | 100% / 100% | 100% / 100% | - | not run | not run |
| javelin | 250 m 79%, 500 m 100% | 250 m 83%, 500 m 100% | - | - | 92% (all 24 tracked blind; none hit the ridge) | - | - |
| cruise | 250 m 71%, 500 m 79% | 250 m 88%, 500 m 94% | 400 m 29%, 800 m 21% | 400 m 13%, 800 m 13% | 0% (all 24 hit the ridge) | - | - |
| atgm (aim lag 0.3 s) | 250 m 71%, 500 m 71% | 250 m 0%, 500 m 31% | - | - | 8% | immune | immune |

- Reading of the numbers: the scripted dodge barely changes the hit rate. Against a dodging ground target the Guided Missile and Swarm hit 67 to 100%, the Javelin 83 to 100%, the Cruise Missile 88 to 94%; against a dodging aircraft within 400 m the AA Missile, Ship SAM, Guided Missile and Swarm hit 100%, the AA Missile and Ship SAM also at 800 m. What lowers it: flares (about 50% per drop), ECM (always), a missile's lifetime (the Guided Missile and Swarm fired at 800 m at a crossing aircraft run out of life: 0%), the Cruise Missile's slow turn against aircraft (13 to 29%), and the 0.3 s crosshair lag of the wire missile. The Javelin hits a target behind a ridge in 22 of 24 runs because it climbs and keeps tracking; the Guided Missile and Swarm hit the ridge in 15 and 19 of 24 runs but still follow the hidden target for the whole flight in 23 and 24 of 24. Cover does not end a chase; only countermeasures or the lifetime do (D-017).
- Kinematic argument for "hard to dodge": the turn radius at top speed (53 to 139 m) is below what a vehicle or an aircraft can turn in (mechs and ground vehicles move 10 to 50 m/s; an aircraft needs about 120 m at 1 rad/s and 120 m/s), and a missile that is faster than its target always closes a pure-pursuit chase. The seeker cone, the lock time and the lack of lead matter only at launch.
- Cause of the persistence (to remove in P5-06): missile guidance has no line-of-sight test, no seeker-cone or gimbal limit, no lock-loss timer, and the 50% flare chance and the 100% ECM chance are the only rules that end a chase. Terrain and building collisions end a missile, but only where the straight chase happens to hit them. Fix task: P5-06 (and P5-05 for detection).

Limits of the Phase 1 audits: the AI route and ship tests are random (`findSpawn` and AI use `Math.random`), so a second run differs in detail; the scripted dodge is mild, not the best a player could do; no test was run in a real browser with a GPU or on a phone; only mission co-op spawns were audited (the only co-op mode); hovercraft over land (Skua) and the flood hazard were not tested for P1-02; superweapon homing munitions (`swMicro`, `swCruise`) were not measured for P1-07; frame times in Appendix C are headless software rendering.
