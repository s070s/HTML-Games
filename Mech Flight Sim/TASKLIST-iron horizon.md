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
- Fauna: 30 species, herds / flocks / schools per map, simulated and drawn. Quality limits: low draws within 300 m (max 32 drawn, 48 simulated), medium 420 m (64 / 96), high 520 m (100 / 150). The owner reported seeing no animals: cause found in P1-04, fixed in P3-01 to P3-03 (first herds placed where the player plays, far animals drawn larger, radar marks).
- Loadout effect on visuals: not verified in this review (P1-05).

## 3. Global rules for every phase

- Every feature must work on touch, gamepad and keyboard / mouse, and in online co-op.
- No external dependencies. Output stays one HTML file.
- Bump `SAVE_VERSION` and migrate saves whenever saved data changes.
- Every phase ends with: no console errors, the built-in self-test passes, frame rate on the low preset not worse than the P0-02 baseline unless a decision accepts it.
- Owner (2026-10-29): "Keep things balanced". Every new weapon, defence, unit or rule is measured against the existing ones (hit rates, time to kill, cost) before its task is ticked; the numbers go in Appendix C.

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

- [x] P2-01 - DECIDE: spawn rules per platform kind: naval only in water deeper than draft plus margin and connected to the objective area by navigable water; aircraft at a minimum distance from `AIR_BOUND` / `GROUND_BOUND`, heading inward, at a safe altitude; ground and mechs on reachable, non-steep ground; maximum distance to the first objective per context.
  Done when: rules recorded in Appendix C.
  Status (2026-10-29): Appendix C "P2-01".
- [x] P2-02 - Implement the spawn rules in all spawn functions (mission start, respawn, co-op join, skirmish bases, training).
  Done when: the P1-01 audit re-run shows no failure.
  Status (2026-10-29): Appendix D "P2 re-run": aircraft failures 8 -> 0 (guest aircraft 42 -> 0); no ship row breaks the P2-01 rules (keel 1.5 m, 200 m from the bound, skirmish harbour within 586 m of our base, was 927 m; guest ships within 112 m of the host, was 292 m; a respawn is seen only in m12, the known pond, D58 and D63; review 4 adds tundra (Trident) and alpine (Lancer) skirmish with hostiles watching the harbour: their only water is one lake or pond, same as before Phase 2, known exceptions like m12); by the old audit thresholds (nearest objective over 500 m, or no water within 150 m of it) ship rows failing go 59 -> 54: the rest are water that is physically that far from the objective (m15, m17, skirmish bases 230 to 440 m from any ship water), or m12's pond (D63). Self-test 2704 / 2704. Review 2026-10-30, m10 (D58): the naval start (444, 19, the water the Trident can sail nearest the start, found with the ships out) was in sight of the beach squad (rifleman at 400-460, -135 to -165; 152-184 m, inside his 227 m sight in the storm, a clear line) in 18 of 300 runs of the test (HEAD 20 of 300), a real placement bug and not a flake. Fix: the squad is placed after every ship is out and each rifleman a harbour of any ship class would see (distance, sight and a clear line, tested at his spot and at 8 and 16 m round it, since he walks up to 10 m in the first second) is placed again in the squad disc (M10_SQUAD); the start is unchanged and in good water. 300-run probe (m10b.js): 18 -> 0, repeated 0 of 300 and 0 of 600 with the other probe.
- [ ] P2-03 - Navigable water: compute a navigation mask per platform draft (rivers, lakes, coast). DECIDE behaviour at shallow water (proposals: slow and stop with a warning before grounding, auto-reverse assist, AI path avoids it; hovercraft keep crossing land as today if that is the design).
  Done when: no naval platform gets permanently stuck in the P1-02 places; AI naval units route through navigable water only.
  Status (2026-10-29), NOT ticked: Appendix C "P2-03": 7.5 m ship grids with clearance by hull (metro's river is water to a gunboat now: 397 open cells, was 0, so the metro check no longer skips), patrol loops built from the grid, astern at dead ends, a tow for a ship left aground; the 57 AI ship runs: still for 20 s or more 5 -> 1, aground 1 -> 0, none dead. Open: the metro gunboat at 260,-85 patrols (3 lane points, about 300 m in 60 s, never aground) but still stands about half the time (31 of 60 s still, 453 frames astern): the river is 44 m wide and a gunboat needs several astern-and-forward turns at each end. A ship bound for the other piece of the cut river waits afloat, as decided.
- [x] P2-04 - Recovery fallback: if a platform is stuck for a set time, offer a "reposition" action to the nearest valid spawn.
  Done when: works for every platform kind and in co-op.
  Status (2026-10-29): Appendix C "P2-04"; self-test: mech, vehicle, soldier, aircraft and ship offered after 6 s and put at a valid place; guest request refused without host-seen stuck, honoured with it; touch button, pad d-pad down, key H, pause menu entry; `NET_VERSION` 11.
- [x] P2-05 - Ground pathfinding (owner, 2026-10-29: units get stuck on rivers instead of going around): AI land units route around rivers and lakes, using bridges, land links and water shallow enough for their platform kind to ford, and do not get stuck on banks.
  Done when: no AI land unit sticks at the P1-06 places, and AI land units reach objectives across rivers on every map.
  Status (2026-10-29): same 103 runs (14 P1-06 places x 2 + 75 random), before -> after: reached 69 -> 88, drowned 6 -> 0, waded deeper than the ford for 11 s or more 5 -> 0, stuck on a bank or a tree 6 -> 0, slow 17 -> 1 (an alpine infantry run still walking at 150 s), and 14 runs whose goal lies across water no ford crosses (archipelago islands, alpine) wait on their shore afloat. The jungle tank the trees stopped (45,540 to -300,15) now arrives (the grid shuts the cells of trees and buildings; a unit that gains under 10 m in 5 s is given a route); the jungle place at -135,495 arrives in 30 of 30 extra runs.
- [x] P2-06 - Land spawn connectivity: every land spawn (mission start, respawn, skirmish bases, co-op join, training) is connected to its objectives by land, bridge or fordable water; move the spawn or add a bridge / ford where it is not.
  Done when: the P1-06 re-run finds no cut-off land spawn on any map.
  Status (2026-10-29): P1-06 re-run: archipelago skirmish, 3 seeds, no cut-off base (a built ford of 7 to 26 boxes); only m9, m10 and m16 targets remain unreachable by land, by design.
- [ ] P2-07 - Change platform (owner, 2026-10-29): in a fight and between the objectives of a mission. DECIDE where it is allowed (friendly base, depot or spawn point; at each objective completed), the time it takes, whether health and ammo carry over, and limits that keep it fair; works for the player, AI commanders and co-op peers.
  Done when: Appendix C has the rule; the player can switch platform in a fight and between objectives on touch, gamepad and keyboard, in missions, skirmish and co-op, and the swap cannot be used to dodge damage or refill for free.

## Phase 3 - Fauna

- [x] P3-01 - Fix the cause found in P1-04 so animals are visible during normal play on every map and quality preset.
  Done when: a live test sees animals on each map without searching for them.
  Status (2026-10-29, fixed again after the review): Appendix C "P3-01 and P3-02". Self-tests 'p3 fauna in view' (all 13 battlefields x Low / Medium / High x a ground pick, Bulwark, and an air pick, Kestrel, skirmish seed 11: an animal within draw range of the start, and one in view at 3 px or more in the best of 8 headings) and 'p3 fauna size and placement' (the range from the player, the fade); headless run of the P1-04 method: Bulwark in view straight ahead at the start on 13 / 13 maps at every preset (was 0 / 13) and turning round 13 / 13 (was 0 to 1); Kestrel ahead 12 / 13 at Low and 13 / 13 at Medium and High, turning round 13 / 13 at every preset (was 0 ahead, 1 round); missions m1 to m18 18 / 18 ahead and turning round at Low and Medium (was 1 / 18).
- [x] P3-02 - Check fauna placement and density against where the player plays (spawns, objectives, routes), within the performance budget.
  Done when: frame rate on low preset meets P0-02.
  Status (2026-10-29): Appendix C "P3-01 and P3-02". Along the 4 spots between the start and the enemy base an animal is in view at 58 / 75 / 79 percent of the spots for the Bulwark and 15 / 37 / 52 percent for the Kestrel (Low / Medium / High; was 12 / 13 / 13 and 0). Animal totals unchanged by design (the 48 / 96 / 150 cap stays). Low preset, P0-02 recipe (640x360, throttle 4, new and old build alternately, median of 3, same hour, run again after the review changes): JS p95 16.3 vs 19.6, 23.9 vs 22.5, 17.4 vs 19.5, 15.5 vs 16.1 ms (ashfall, coast, jungle, archipelago), at most 6 percent over the old build; the PC was busier than on the baseline day, so the old build's own figures are above the 16 ms line too (see the note in Appendix C).
- [x] P3-03 - Radar contacts for fauna and civilians (on foot and in vehicles), with their own neutral icons; they are never targets. They follow the detection rule from P5-05.
  Done when: animals and civilians within detection range show on the radar on every map, in co-op too.
  Status (2026-10-29): Appendix C "P3-03". Self-tests 'p3 radar neutrals' (metro: civilians on foot, cars under way, parked cars not shown, a herd; infantry range 180 m and 360 m with the Sensor Array; cycling the target never picks one; a neutral civilian vehicle platform is no hostile; the HUD disc really draws the green animal marks only while a herd is detected) and 'p3 radar on every battlefield' (13 battlefields: animal, civilian and car marks within range); co-op: each game builds its own picture ('p3 radar contacts': two peers 700 m apart see their own contacts) and a damaged sensor reaches the guest ('p3 co-op sensor state'). Appendix C lists the places that hard-code "team 2 is never a target" for P7-08 (notes only, nothing changed).

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
- [x] P5-04 - Lock-on on objectives (owner, 2026-10-29): the player can lock on objective structures (radar towers, bases, depots and every other mission or skirmish objective structure) and cycle between them; the HUD and the radar show the locked target.
  Done when: every objective structure in every mission and skirmish can be locked on with keyboard / mouse, gamepad and touch, and lock-on weapons hit it.
  Status (2026-10-30): Appendix C "P5-04". Cause found by probing every mission and skirmish battlefield: objective structures were in the target cycle but none could be locked (the line-of-sight ray ended inside the structure's own box: NO LINE OF SIGHT); `sightTo` fixes it for the lock, the cycle score and the new seekers; the reticle on a hostile objective auto-targets it; a guest now sees its structure lock (`lk` carries a structure index). Self-tests 'p5 lock-on to objectives' (line test with and without a wall, cycle key, gamepad and touch TGT each selecting the structure, auto-target, a 1 s lock, radar contact ringed and pinned to the rim, the missile homing and hitting, the AA seekers refusing), 'p5 every objective can be locked' (all 31 hostile objective structures of the 18 missions and 13 skirmish battlefields cycled to, locked from a clear spot and hit), 'p5 the AI locks on to objectives' (an AI mech locks a depot and its Guided Missile hits it; the AI jet does not try) and 'p5 co-op targets'. `NET_VERSION` 13, `SAVE_VERSION` 1.
- [x] P5-05 - Radar detection (owner, 2026-10-29): the radar stops showing every unit. DECIDE the detection range per platform kind (aircraft longest, infantry shortest), whether allies share contacts, and a new utility module that extends detection by platform kind. The locked target always shows on the radar. Implement for the player, AI and co-op.
  Done when: Appendix C has the range table; the radar shows only detected contacts plus the lock; the detection module works for the player, AI and co-op peers.
  Status (2026-10-29, review fixes in): Appendix C "P5-05" (table, module, reasons, balance numbers, the cycling and holding rule). Self-tests 'p3 detection table' (17 platforms' classes, ranges with and without the module, damaged sensors, all 16 armed platforms can mount it inside their weight limit), 'p3 radar contacts' (own range, module, ally sharing at 60 percent, the nearest allies kept when there are more than 24, dead and far allies, targeted and locked units always shown and ringed, camouflaged units hidden, co-op peers), 'p3 target cycling follows the radar' (cycling skips an undetected hostile, picks one detected only through the Sensor Array, one detected only by an ally, one in view with a clear line; a held target is kept inside the 1.15 margin and dropped beyond it; a hard lock keeps its own rules; the eye has a range: a jet does not pick a tank 2 km ahead in clear view, picks it at 750 m, does not where only 560 m is drawn, and drops a held one past the range) and 'p3 co-op sensor state' (a damaged sensor reaches the guest and halves its radar and what it shares; the host refuses a guest's pick of a unit that guest's sensors and eyes do not have, and drops a held one that leaves detection), 'p3 guest aircraft herds' (a guest's aircraft gets herds on arrival) and 'p3 sensor array and the AI' (AI sight x1.25 with the module, the AI sniper carries it); `NET_VERSION` 12 (a new weapon id in loadouts), `SAVE_VERSION` 1 (no new save key). Full suite 2803 / 2803 (run twice), no page errors.
- [x] P5-06 - Missile balance from P1-07: DECIDE target hit rates against a dodging target and against a target that breaks line of sight, then tune turn rate, seeker cone, lost lock behind buildings and terrain, lifetime and flares / ECM.
  Done when: Appendix C has the targets, the measured hit rates meet them, and AI still uses missiles well.
  Status (2026-10-30): Appendix C "P5-06": the targets (decided 2026-10-29 by the coordinator; the owner can change any row), the new seeker rules (view cone, line of sight, blind time, last-seen steering), the per-type numbers (turn rate, view, blind time, flare chance; flight times kept, with the reason), and the measured tables, HEAD c706b49 against this build, 40 launches per cell. Evading aircraft: 100% -> 50 to 53% for the AA Missile, Ship SAM, Guided Missile and Swarm; straight targets unchanged at 250 m on the ground and 400 m in the air, about a fifth fewer hits at 500 m on the ground; a missile whose target is hidden behind a building gives up within its blind time (29 to 39 of 40 launches, none before). The Javelin keeps its top attack through cover (open item). AI duel: 6.2 -> 5.3 missiles per fight, 92% -> 83% hits on an idle target, 87% -> 73% on a strafing one. Self-tests 'p5 homing seekers' and 'p5 homing hit rates'. Open: ground units cannot dodge by moving (a design fact, not a target); ECM stays 100%.
- [x] P5-07 - Shoot down missiles and rockets (owner, 2026-10-29): missiles and rockets can be hit and destroyed in flight by guns, flak and a point-defence utility; DECIDE their hit points and hit size per munition, and which weapons can target them (lock-on to an incoming missile included). AI uses it.
  Done when: a self-test shoots down each missile and rocket type with the weapons the decision allows; AI point defence works; the hit-rate targets from P5-06 still hold.
  Status (2026-10-30, review round 1 in): Appendix C "P5-07": hit points and hit size for 11 missile and rocket types, 16 guns (flak included) that may hit them, the AA Missile and Ship SAM that may lock and burst beside one, lock-on to an incoming projectile (Cycle Target lists them, HUD INCOMING, radar triangle, co-op `NET_PROJ_TG`), and the new Point Defence utility, REBALANCED after the review found it never missed: reach 140 m, hit chance 90% falling to 40%, lower against small fast rounds, 0.3 s slew, 12 bursts back one in 5 s, front half only on the ground, a seeded roll per unit. Reviewer's table (`pdbal.js`, share of damage through): a single missile 50% (38% when launched inside the reach), two at once 66%, four 81%, Swarm salvo of eight 45 to 50%, pod salvo 41%; Active Protection still the better answer to one heavy missile (0% through) and useless against a salvo. The allied tank and the enemy destroyer carry it (AI checked: 12 of 16 and 11 of 16 missiles stopped); the AI never aims guns at missiles (decided exception). A shoot-down is no longer an accuracy hit; missiles and rockets go into the co-op snapshot before plain rounds (known limit above 70 at once). Self-tests 'p5 intercepting projectiles', 'p5 point defence' (ranges, not exact counts: type stop rates, a seeded repeat, the slew, the arc, salvos), 'p5 the AI uses point defence', 'p5 co-op targets'. `NET_VERSION` 13, `SAVE_VERSION` 1. Round 2: the Point Defence of the gunship stopped 0% of AA Missiles and Ship SAMs; they are now light-skinned for it (pdSoft 1.8) and harder to hit (pdEvade 0.45): the gunship stops 39% of AA Missiles and 41% of Ship SAMs (aim 25 to 55%), Guided Missile 68% and Swarm salvo 37% unchanged, no ground or naval row moved; flares stay the better answer.
- [ ] P5-08 - DECIDE base defences (owner, 2026-10-29): a wider set of base defences: land and naval mines, more turret kinds, a missile silo that prepares for a long time with a clear warning and then strikes an enemy base (it can be found and destroyed during the preparation), and other special base weapons. Each with role, cost, counters and fair limits for 2-4 teams.
  Done when: Appendix C has the list with counters and limits.
- [ ] P5-09 - Implement the P5-08 base defences in skirmish and in the missions that have bases, with models, effects, sounds, warnings, AI use, AI counters (clearing mines, destroying the silo) and co-op sync.
  Done when: each defence works for every team, AI builds or uses and counters them, co-op peers see the same state, and balance numbers are in Appendix C.

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
- [ ] P7-08 - Police (owner, 2026-10-29): police among the civilians (on foot and in cars) respond when someone harms civilians and open fire on the attacker, whatever team. DECIDE their strength, response range, how long they stay hostile, and that in co-op police are host-authoritative (this supersedes D6 for police only).
  Done when: harming civilians brings a police response that fires on the attacker only, in missions, skirmish and co-op; police never attack someone who did not harm civilians; the numbers keep it fair (Appendix C).

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
| Added 2026-10-29: change platform in a fight and between objectives | P2-07 |
| Added 2026-10-29: shoot missiles and rockets out of the air | P5-07 |
| Added 2026-10-29: more base defences: mines, a long-preparing missile silo, special base weapons | P5-08, P5-09 |
| Added 2026-10-29: police fight people who harm civilians | P7-08 |
| Added 2026-10-29: keep things balanced | Section 3 rule |

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

### P2-01 - Spawn rules per platform kind (2026-10-29)

All thresholds are named constants in `IronHorizon.html` (`AIR_SPAWN_*`, `NAVAL_SPAWN_*`, `NAV_*`, `REPOSITION_*`).

- **Aircraft** (`airSpawn`): the start point is at least 400 m inside `AIR_BOUND` (a point beyond that is moved toward the middle); the heading is the context's own if it has 1000 m to fly before `AIR_BOUND` and is inward (within about 78 degrees of the way to the middle: a heading along the bound or across it is not), else toward the middle; when a respawn, or the first units of the battle, would see the start or the point a second on, the nearest inward heading that is not seen, and only where every inward heading is seen one that is not, up to 24 degrees outward of the line along the bound and always with at least 1000 m to the bound ahead (`airSeen`, `settleAir`: D58 wins over inward; m13 is such a case); the altitude is the larger of 160 m over the point and 90 m over the highest ground or water within 600 m ahead, at most 30 m under the ceiling (420 m). Co-op guests line up across the heading, 45 m apart and 15 m higher each. A parked aircraft on a runway is unchanged. AI aircraft spawn heading inward.
- **Ships** (`Naval.spot` with rules, `Naval.harbour`): in order of preference the spot is in a sheet of navigable water of at least 40,000 m2 (a cell of open water that is at least the hull's half beam plus 3 m from the shallows; draft + 0.6 m deep on the battlefield's own water, a flood left out), at least 1.5 m under the keel, at least 200 m inside the bound, with 40 m (else 4 m) of open water past the hull every way; where the battlefield has no such sheet (alpine's pond, m12) the old rule stands (0.6 m under the keel, any water). Nearest such spot to the start. Connected: a ship starts in the same sheet as the enemy fleet in a skirmish (`joins`; a spot asked to lie in a given sheet is looked for by the big-sheet rule only, the caller falls back), a co-op guest's ship within 120 m of the host's. Respawn (D58, `navalRespawn`): the harbour when no hostile sees it; else the nearest spot of the harbour's own sheet that none sees, first within 350 m of it, then anywhere in the sheet out to 1200 m (rings 90 m apart, each asking for a spot within 70 m); then, in the same sheet, the 200 m inset from the bound relaxed in three steps (D58 wins over the inset: with the skirmish's own hostiles and 4 tanks parked on the water at the harbour, the only unseen deep water of coast lies about 34 m from the bound): 100 m, then the hull's reach plus 40 m of room, last the hull's reach (17 m for the Trident, 9 m for the Lancer); the harbour itself only when there is none. Far rings carry a point every 80 m, not 12 points whatever the radius (12 left 380 m between points at 730 m and the unseen water between was never found), and a candidate a hostile sees is skipped inside the search, so the next one is tried (it used to end on the first). Self-test: coast (Trident) and jungle (Lancer), 4 tanks on the water 90 m round the harbour among the skirmish's own hostiles, the respawn unseen, in the harbour's sheet, in under 60 ms (here 37 ms on coast, 7 ms on jungle).
- **Land (mech, infantry, ground, artillery)**: mission starts are authored and stay (51 of 51 land starts unchanged); a respawn lands on ground that joins the start by land, bridge or ford for its class (`forwardSpawn`, once its route grid is ready); skirmish bases lie on ground a tank can drive between (P2-06).
- **Maximum distance to the first objective, per context**: missions: as authored for land (m1 1301 m, m2 1266 m, m8 1124 m are long approaches by design: D-006 closed); ships take the nearest big sheet of water to the start, whatever its distance from the objective (m15 and m17: the nearest navigable water is 561 m and 381 m from the objective, physical limits; m12: the pond, D63). Skirmish: land units in our base yard (72 m from our command centre); a ship pick lays our base within 450 m of ship water where a seeded base pair allows it (`SKIRMISH` layout, `NAVAL_SHORE_MAX`), the harbour then within about 600 m of the base (tundra's Trident: its one lake lies 330 m from the middle, the bases 500 to 600 m: about 790 m). Training: the nearest water.
- **Supersedes D58 for aircraft starts only, by the owner's later report quoted in P1-01** (aircraft spawning close to the map bounds): m2 (heading, was 524 m to the bound) and m4 (start moved 70 m inward, was 340 m from the bound) are the only m1-m8 aircraft starts that change; no land start of m1-m8 changes, and the rule that nothing hostile sees a respawn or a first spawn of m9-m18 still holds.
- **Aircraft starts turned inward: confirmed by the owner 2026-10-29** (answer "Keep"): the starts of m2, m10, m13, m17, m1, m4 and m9 that the rules turn toward the middle stay as they are.

### P2-02 - Where the rules are implemented (2026-10-29)

`Game.spawnPlayer`, `Net.spawnFor` (host and guests), `respawnSite`, `forwardSpawn`, `hiddenNear`, `spawnUnit` (AI ships and aircraft), `Naval.spot` / `harbour` / `deploy`, `skirmishLayoutWith`, `Reposition.site`. Co-op guests' positions stay host-authoritative. `Game.buildDef` copies the pick into the skirmish setup (the layout reads it).

### P2-03 - Navigable water and shallow-water behaviour (2026-10-29)

- Mask: `Nav` grids of 7.5 m cells, one per ship (draft and hull; `navSpecShip`), built from the battlefield's own water. A cell is open when depth at its middle is at least `max(draft, 1) + 0.6` m and a distance transform puts it at least the hull's half beam plus 3 m from the nearest shallows or the edge. So a river 44 m wide (metro) is water to a gunboat and a ship that does not fit a channel gets none of it.
- Patrol (`Naval.patrolLane`): the loop's points are open cells of the piece of water the ship is in (a narrow river: the farthest open points within 200 m); the AI takes the next point of the loop when one is reached, when the route to it ends short and the ship has got there, or after 20 s without getting 10 m nearer; a ship that has crept slower than 4 m/s for 1.5 s with its bow the wrong way (a river's dead end) goes astern with the rudder reversed. Route requests stop while the ship's own cell does not snap to an open cell.
- Shallow-water behaviour (DECIDED, unchanged where it already worked): a ship never enters water shallower than its draft + 0.6 m (`shoreBlocked`: the end leading the way may not go on; the bow does not swing up a beach); the player gets SHALLOW WATER, the AI uses the mask and its probes; a ship on dry ground after a flood is towed back. P1-02's 144 shoreline trials stay the regression (0 groundings). A hovercraft (Skua) keeps crossing land as today. Stuck for good is answered by Reposition (P2-04).
- AI ships: route search over the mask when the straight line is blocked (follow, target, advance); a goal in another sheet (metro's cut river) ends at the nearest reachable water and waits.

### P2-04 - Reposition (2026-10-29)

Stuck = asked to move (stick, rudder, throttle on the ground) and moved under 1.2 m/s for 6 s. Then the HUD shows STUCK? HOLD [key] TO REPOSITION; keyboard: H (rebindable action `reposition`), gamepad: d-pad down, touch: a REPOS button (left column, shown only while offered), every device: Reposition in the pause menu. Hold 0.8 s. The platform goes to the nearest valid place (land: dry, gentle, unblocked, in the start's ground; ship: a harbour-grade spot; aircraft: an air spawn, flying), safe for 2 s, 12 s cooldown. A place out of a hostile's sight is preferred only within 60 m (a move is no escape across the field); a platform that lost hull in the last 5 s gets the nearest valid place, no unseen preference and no protection. The prompt names the control now in use (touch REPOS, pad d-pad down, the key as rebound); where an old save lost H to another action it reads OPEN THE PAUSE MENU: REPOSITION. Co-op: the guest sends input edge bit 128 and waits 2 s for the answer (it stays offered until it has moved); the host moves it only if it saw it stuck for 3.6 s of the 6, at most once per 6 s, and answers a refusal with a notice (`NET_VERSION` 11).

### P2-05 - Ground routes and ford depths (2026-10-29)

- Ford depth per kind (the most a route uses, 80 % of what the platform takes): tracked and wheeled vehicles 0.96 m (they flood past 1.2 m), mechs 0.8 x 0.55 x height, infantry 0.96 m (they swim past 1.2 m but a route does not use that). Slope: the platform's climb limit, at most 0.85 (vehicles) or 1.1 (mechs), at the middle of a cell only (a slope is never deadly). A bridge deck under the middle of a cell opens it; a ford (water over 0.25 m) costs 3 times dry ground; cells beside blocked ones 1.7 times.
- Search: A* over the 15 m grid, 700 cells a tick, one search at a time, at most 24 queued, waypoints thinned by straight dry lines; a route is asked only when the straight line to the destination crosses a ford or blocked cells, laid again when the destination moves 60 m or after 15 s; a bridge is approached 26 m short, along its deck, and its waypoints sit on the deck's middle. The heap holds `NAV_EXPAND_MAX * 8` entries; a search whose heap is full ends as a partial route. Obstacle layer: a land cell is shut for routes when a building or a tree stands within 3 m of its middle (not a bridge's deck), though the pieces of ground (links, respawn, reposition) still count it, and a diagonal past a shut cell is allowed (a forest stays passable). Grids are built one row a tick on the host, per class and per world; a bridge shot down, or 12 structures destroyed since a land grid was built (at most every 15 s), starts the grid again beside the old, which serves until the new one is ready. Stuck is a progress test, not a timer: a unit that moved under 10 m of its own in 5 s, bound for a destination that moved under 5 m and not on its way to a new waypoint, closes the cell ahead for 40 s (never a ford or a deck) and is given a route even when the line looks clear; a unit on a long detour or chasing a target is moving and closes nothing (self-test). Only real fording is exempt: water deeper than 0.25 m (a ford) and at least 3 m moved in the window; a tank held in a hand's depth of water on a shallow bank is stuck like one on dry ground (the first version exempted everything wet, so such a tank sat there for good). A second test catches a unit that shuffles: over 3 windows (15 s) bound for a destination that stays put, it is stuck when at some window it was not 10 m nearer than at the first, by the way left along its route (a long detour measures the route, not the straight line; a way left that jumps up by over 20 m is a new route and starts the count again). Self-tests (40 s each): a tank held on dry ground, one held in 0.05 to 0.2 m of water, one put 12 m to and fro once a window on dry ground and in shallow water: each is given a route; the detour and chase tests still close 0 cells. A unit that stands in water deeper than it takes heads for the shallowest water (`escapeWater`). A goal across water no ford crosses ends at the nearest reachable cell and waits; a goal behind a cliff only is pushed at straight, as before.

### P2-06 - Land spawn connectivity (2026-10-29)

Chosen: bases stay opposite each other (layout unchanged on every battlefield but archipelago); the seeded base pair is the first pair on ground a tank can drive between, and where no pair is (archipelago: every pair lies on two islands) a built ford joins them: boxes of ground 0.7 m under the surface along the cheapest crossing (7 to 26 boxes). m10's gun islands, m9 and m16's convoys at sea stay unreachable by land by design.

### P2 - Cost and balance (2026-10-29)

- Low-spec check (P0-02 method: 640x360, throttle 4, Low; the new and the old build run alternately, three runs each, the PC busier than on the baseline day so every figure is higher). First comparison, ship pick (JS p95 ms, median of 3, new vs old the same hour; baseline in brackets): ashfall 15.4 vs 12.8 (11.6), coast 20.5 vs 17.7 (14.9), jungle 15.4 vs 15.3 (11.4): the coast +16 percent was NOT code cost: the skirmish layout depends on the ship pick (Trident: our base lies near the sea, the enemy fleet shares its water and the ships fight sooner), so the two builds did not draw the same scene. Honest re-run with a layout the same in both builds (a land pick, Bulwark, on coast, where the enemy fleet and the new ship routing still run; scene sk-coast-land): JS p95 11.0 (11, 12, 9.1) new vs 11.0 (10.3, 15.9, 11) old, tick p95 4.2 (4.2, 5.8, 2.7) new vs 5.1 (5.1, 6.6, 4.8) old, whole-frame p95 28.4 vs 28.0: no measurable cost. Ashfall (dry, none of the new code runs) differs by run to run noise alone (new 9.4, old 11.0). The pass rule (JS p95 at most 16 ms and 15 percent over the same-hour old build) holds on this scene. Startup on coast with the Trident 1.1 to 1.9 s (was 0.97 s): its ship grid is built before the first frame.
- Grid and search cost (measured, 20 world grids on the 10 battlefields with water): a land grid builds in 10 to 29 ms (125 rows, 0.08 to 0.23 ms a row), a ship grid in 5 to 36 ms (249 rows, 0.02 to 0.14 ms a row); one row is built a tick and the finishing of a grid (distance transform, costs, pieces) is four more ticks of one stage each; a route search expands 400 cells a tick (80 on a tick that built a row; a land goal no route reaches stops after 9000, a ship's after 30,000). Dearest `Nav.step` over 30 s of large skirmishes (jungle, coast, valley), median of 6 runs, first 10 s / after 10 s: before 3.6 / 2.0, 0.8 / 1.1, 1.3 / 0.2 ms (the early ones are the cold first builds: the pieces stage of a jungle grid 3.7 ms, a dense forest row 3 to 5); after the grids are built at load (`Nav.prewarm`: every class of living platform, once the first units stand, 60 to 90 ms more load time on jungle, 25 on coast and valley) 1.7 / 2.0, 1.1 / 0.5, 0.9 / 0.3 ms. The cold ticks are gone; what stays after 10 s is a land grid built anew after 12 destroyed structures (a dense-forest row of the jungle grid: 1 to 2.5 ms, the obstacle test of every cell). Tried and left out, since neither gave a lower worst tick on the same runs: marking the obstacles once with one walk over `W.structs` (identical cells, but a walk of 150 structures a tick cost 1.3 to 3 ms in play, more than the 0.1 to 0.3 ms a row of `Hash.query` calls costs), and building a row in two ticks (the worst tick stayed 1.5 to 3 ms). The once-a-second look at what was destroyed costs 0.1 to 0.2 ms. Stuck-test cells closed in 90 s battles: 0 (was 6 / 15 / 19 on jungle / coast / valley), the 600 m bridge detour takes 98 s (was 115 s with 9 cells closed).
- Balance: reposition is offered only to a platform that has stayed put under input for 6 s, protects for 2 s (not at all after hull was lost in the last 5 s), cools 12 s, and moves it to cover only within 60 m: it saves a stuck player, it is no escape (a platform that keeps moving never gets it; one that sits still for 6 s under fire gets the nearest valid place and no protection). AI land units stop drowning and wait on a shore they cannot leave, so a wave across an unfordable channel (archipelago) no longer dies there: the built ford gives skirmish waves a real road to our base, the intended difficulty. No weapon, defence or unit was added.

### P3-01 and P3-02 - Fauna in view (2026-10-29)

- Cause (P1-04, ranked) and what was done about each: (1) too few animals within draw range of where the player plays, (2) animals 1 to 3 px tall at the draw limit, (3) the first herd 143 to 577 m from the start, (4) Low and Medium thin the groups, (5) species lists leave out common animals. No culling bug was found, and none was added.
- Fix 1, placement (`Fauna.anchors`, `Fauna.attend`, P3-02): the first 5 herds and the first flock of a battle are placed where the player plays instead of anywhere: ahead of the start (70 to 170 m, within 52 degrees of the heading: in view from the first frame), all round it (150 to 260 m), toward the middle of the map when the start faces outward, 45 percent of the way to the goal when the goal is over 500 m away, and by the goal (110 to 220 m; the goal is the enemy base of a skirmish, else the nearest primary objective marker, as `forwardSpawn`). An aircraft pick: the start of a battle is not final until `settleAir` has turned it from the hostiles that would see it (D58), so `Fauna.attend` runs after that and moves the first three herds to rings along the aircraft's final heading (100 to 240 m, 220 to 380 m, 350 to 550 m, within 40 degrees) and the first flock to 100 to 240 m ahead (sea birds are taken inland for it); the review found the first version looked at the heading before it was final (8 of 13 maps ahead). Where sites or water cover the ground (many missions; coast), the search steps outward 60 m and widens 0.5 rad per 8 tries, and it is picky about meadow and forest edge only in the first half of each step, so the home is the nearest of any ground the species can stand on; it keeps 8 m plus its spread from every site (others keep 25 m), so no animal, bird included, stands on a site (existing test). Anchored herds are of animals 0.6 m tall or more when the battlefield has any, keep their full size on every preset (the Low share 0.5 thins the other groups only), and come first in the list, so the cap (`faunaSim` 48 / 96 / 150, unchanged) keeps them and the draw order starts with them. A co-op guest's aircraft gets the same on arrival (`Net.bindLocal` calls `Fauna.attend` for the first body of the game; the self-test binds an aircraft far from the herds and three of them move to 560 m ahead of it); each game runs its own animals (D6).
- Fix 2, size and fade (`Fauna.boost`, `Fauna.fade`): an animal draws larger than life from the distance where it would be under 5 px tall on an 800 px screen (110 m per metre of its height), at most 3 times: a deer 1.34 m tall at 85 percent of the Low range is 5.0 px (was 2.4 at the limit). Over the last 15 percent of the draw range the size is multiplied by a smooth ramp from 1 down to 0 (`FAUNA_FADE`), so a boosted elk grows in instead of popping in at about twice its size. Drawing only; hit boxes, shadows and the simulation are unchanged.
- Fix 3, range: the draw range is measured on the ground plane and from the player, not from the trailing camera (a herd 281 m from the mech, whose camera stands 303 m away, still draws on Low: self-test); with no living player the camera is used, as for a spectator. Low draws to 300 m (was 260), Medium to 420 m (was 380); High stays 520 m. The group test already used the ground plane; the animal test used the 3D distance, so a flier lost 100 m or more.
- Fix 4, species: metro (3 herds of fox and rabbit, a city that covers the ground) gets 5 herds and deer (weight 3). The other lists are unchanged (D-015: deer were already listed on coast, alpine and farmland, and sit on the land the anchors pick there).
- Numbers (headless Chrome 156 at 1280x800, skirmish seed 11 medium; HEAD -> now; "ahead" = in view at the start facing the heading, 3 px or more, with the fade; "round" = best of 8 headings): Bulwark: ahead Low 0 -> 13 of 13 maps, Medium 0 -> 13, High 0 -> 13; round Low 0 -> 13, Medium 1 -> 13, High 1 -> 13; median animals in view ahead Low 0 -> 10, Medium 0 -> 17, High 0 -> 20; along 4 spots between the start and the enemy base an animal is in view at Low 12 -> 58 percent, Medium 13 -> 75, High 13 -> 79. Kestrel (HEAD was measured at Medium only): ahead Medium 0 -> 13 of 13, now Low 12 / Medium 13 / High 13; round Medium 1 -> 13, now 13 at all three presets; along the route Medium 0 -> 37 percent. Missions m1 to m18 (start of the mission, Bulwark, Low / Medium): ahead 1 -> 18 of 18 both; round 1 -> 18 of 18 both.
- Performance (P0-02 recipe: 640x360, CPU throttle 4, Low, the new and the old build run alternately N1 O1 N2 O2 N3 O3, median of the 3 runs; run again after the review changes (cycling gate, fade, ground-plane range from the player, aircraft re-homing, nearest allies); the PC was shared and busier than on the baseline day, so every figure is higher than the baseline table and the old build misses the 16 ms line too). JS p95 ms new vs old on sk-ashfall, sea-coast, sk-jungle, sk-archipelago (the high-fauna map P0-02 asked for): 16.3 vs 19.6, 23.9 vs 22.5, 17.4 vs 19.5, 15.5 vs 16.1; run by run: 16.3/15.1/24 vs 18.5/22.5/19.6; 18/23.9/24.7 vs 17/26.1/22.5; 17.4/14.2/20.2 vs 24.9/13.5/19.5; 28.8/14.8/16.8/13.5/14.5/16.2 vs 13.8/13.3/17.5/14.7/18.9/32.7 (the first median of 3 read +22 percent on archipelago because of one 28.8 ms run on the busy PC, so that scene was run 3 more times each way: 6 runs each). Tick p95 5.7 vs 5.3, 7.7 vs 7, 5.3 vs 7.5, 5.55 vs 5.4; render p95 11.7 vs 14.6, 14.1 vs 17.1, 12.3 vs 14.9, 10.95 vs 11.75; whole frame p95 43.9 vs 45.8, 40.2 vs 39, 59.8 vs 64, 37.85 vs 40.599999999999994 (software GL, relative use only). The new build draws more animals (18 against 0, 4 against 6, 10 against 0, 7 against 0). The pass rule (at most 15 percent over the same-hour old build) holds on all four scenes (worst 6 percent); the absolute 16 ms line is not met by either build on this PC at this hour. Real-loop interval p50 / p95 ms new vs old: 33.4 / 83.3 vs 33.4 / 83.3; 16.7 / 66.7 vs 16.7 / 66.6; 50 / 100 vs 33.4 / 50.1; 33.3 / 75.05000000000001 vs 33.3 / 66.75.
- Open: (1) Kestrel at Low has an animal straight ahead at the start on 12 of 13 maps (all 13 turning round); a Kestrel crosses the map in seconds, so the route figure is lower (15 / 37 / 52 percent of spots). (2) Boosted animals are larger than life at a distance (up to 3 times, fading out over the last 15 percent of the range): a visual choice the owner can ask to lower by `FAUNA_BOOST_MAX`.
- Test isolation (second re-check): 'killing animals scores nothing' failed once in a full run. Cause found by running the block 24 times at Medium and High: with the first herds now by the start and the enemy base, the victim's blast (radius 4, 300 damage) could take a tree or a structure standing in the hash, and a destroyed one scores (`structures` 0 -> 1, 2 of 8 runs at Medium). The check is unchanged and as strict (every `W.stats` field equal); the block now clears other platforms and `W.structs` within 40 m of the victim, moves the player off if it stands there, puts the victim on ground with no structure within 10 m (`flora.free`), and prints which stat changed and what stood near if it ever fails again. 16 runs at Medium and High pass.

### P5-05 - Radar detection (decided 2026-10-29 by the coordinator; the owner can change any row)

- Owner's words: "do not show everyone on the radar. Add a utility module that can detect units in varying ranges according to the platform used (aircraft have more range compared to infantry)", and the locked target "is also displayed on the radar".
- Rule (`Detect`, `DETECT_RANGE`): the HUD radar shows (a) allies inside the disc (they are linked), (b) hostiles inside a sensor's range, (c) neutral platforms and the scenery (P3-03) inside a sensor's range, (d) the unit the player has targeted or locked, always, ringed, pinned to the rim when it is beyond the disc, (e) mission objective markers, pickups and hazards as before. A sensor is the player's platform (its own range) and every armed living ally in reach of the disc (`DETECT_SHARE` = 0.6 of its own range). Allies share: yes, at 60 percent, because sharing at full range would bring back the old picture of everything within 600 m in any squad fight (m17 and the skirmishes field allies), while 0 would leave the squad blind to what its own mech has in sight. A camouflaged unit (`noTarget`) is not detected unless it is targeted; dead units go; damaged sensors (`sub.sensors`) halve the range, as they halve the targeting range and the AI's sight; weather does not (a radar looks through fog). Missile locks keep their own rules (cone, line of sight, range), and a unit that is targeted or locked always shows.
- The disc spans the module range of the platform's class (was 500 m on the ground, 1400 m in the air); a dashed ring marks the platform's own range when it is shorter.
- Target cycling and holding (review fix; `Platform.senses`, `cycleTarget`, `updateLock`): the key no longer restores the old full radar. `cycleTarget` still searches only to the platform's targeting reach (`def.sensor`, 450 to 1500 m, x1.6 in an aircraft's forward cone), and lists a unit only if the platform `senses` it: inside a sensor of its radar picture (own range, or an ally's shared range: `Detect.sees`), or in view, meaning within 0.6 rad (34 degrees) of the aim, no farther than the eye range, and with a clear line (`hasLOS`). The eye range is the shorter of `TARGET_EYE_RANGE` (800 m) and `R.drawDist` (560 / 780 / 980 m on Low / Medium / High: nothing is drawn beyond it), so 560 / 780 / 800 m; the review found a Kestrel cycling to a tank 1360 m ahead on Low and 2040 m on High, where nothing is drawn; objective structures are always known (their markers show). A held target of a human-driven platform (`isPlayer`, or a guest's platform on the host: `netPeer`) is dropped, checked every tick, once it is beyond every sensor's range times 1.15 (`DETECT_KEEP`, the grace margin: 322 m for a mech's 280 m) and not in view with a clear line. A hard lock, meaning `lock.state` is locked (the guided secondary finished its lock), keeps its existing rules instead: the target stays while it is within 1.25 x the targeting reach (750 m for a Bulwark) and the lock itself ends as before by cone ('OFF BORE'), line of sight (0.4 s grace), jamming, smoke and range; a lock still being acquired is held by the radar rule. Auto-target (the unit under the reticle) is unchanged: a unit under the reticle is in view by definition. The old self-test 'the radar reaches farther ahead than behind' asserted that cycling picks a unit 1.4 times the wide range ahead of an aircraft (inside the x1.6 forward-cone reach); that is what the review forbids, so it now asserts that neither that unit nor one behind is picked (the reach is a ceiling, not a radar). On the host, a guest's new pick (`Net.applyCmd`, the `tg` field) is accepted only if `Platform.knows` says that guest's platform has the unit by the same rule (its sensors, its aim, the 1.15 margin for a picture a moment older); it is refused otherwise, and the hold rule above drops a held pick on the host as for the local player. AI units never use the cycling key, and the aim-assist magnetism is a visual aid, unchanged.
- Ally order (review fix): when more allies are in reach than `DETECT_NODES` (24 sensors with the player), the nearest 24 are kept, not the first 24 in the platform list: a full picture replaces its farthest ally with a nearer one, in the same fixed arrays (no allocation per frame; self-test with 30 far allies listed before the nearest).
- Co-op state (review fix): a sensor hit is `sub.sensors`, simulated on the host and sent to the guest in its snapshot (`selfState` / `applySelf`): a damaged sensor halves the guest's radar range and what it shares, and the repaired one restores both (self-test 'p3 co-op sensor state', host and guest platforms in one game). The Sensor Array has no hit points of its own: it works while the platform lives, and a destroyed platform is dead on the guest and shares nothing.

| Class | Platforms | Detects | With Sensor Array | Disc spans | Gain |
|---|---|---|---|---|---|
| foot | Ranger IN-0, Civilian | 180 m | 360 m | 360 m | x2.0 |
| mech | Wraith LM-1, Bulwark MM-2, Colossus HM-3 | 280 m | 450 m | 450 m | x1.6 |
| vehicle | Jackal RV-1, Bastion MBT-2, Specter HV-1 | 320 m | 500 m | 500 m | x1.6 |
| artillery | Thunder SPH-1, Hailstorm MRL-6, Pestle MC-2 | 260 m | 480 m | 480 m | x1.85 |
| naval | Lancer FC-1, Trident DD-3, Skua ACV-2 | 450 m | 800 m | 800 m | x1.8 |
| air | Kestrel IN-1, Shrike SF-2, Behemoth HG-3 | 700 m | 1100 m | 1100 m | x1.6 |

- Reasons for the numbers: infantry shortest and aircraft longest as the owner asked; the base range is about half of the platform's targeting range (`def.sensor`), so the radar no longer shows everything that can be shot at; the module range equals the AI's own sight (0.8 x `def.sensor`: foot 360, mech 450 to 520, vehicle 460 to 500, artillery 480 to 560, naval 640 to 1120, air 960 to 1200), so a player with the module sees on the radar about what the AI sees of the player; artillery sits between infantry and mechs because its crews are fed by spotters (`Arty.spotted`); the gain is highest for infantry, whose backpack set has the most to gain.
- The Sensor Array (`WEAPONS.sensor`, utility, passive): slot Utility (the only one of the loadout, so it replaces the shield, APS, repair, flares, ECM, smoke, camo, coolant, reactive armour, hologram, drone or barrier), weight 3 (as Nano Repair, Smoke and Flares; every armed platform stays inside its weight cap with it, tested), no charges, no cooldown, no button (the touch DEF button and the key label stay hidden, as for Reactive Armor: `passive`), no unlock (open from the start), not in any default loadout (the old loadouts and their balance are unchanged). Cost to the player: the utility slot. Benefit: the ranges above, and a human spotter with it spots 1.25 times as far for artillery (`Arty.spotted`). Mounts on all 16 armed playable platforms.
- AI: the AI does not read the radar; it keeps its own sight (`AIController.sightRange`, base 0.8 x `def.sensor`, difficulty, weather, alert, damaged sensors). The same rule applies to it through the module: an AI unit carrying it spots 1.25 times as far (`DETECT_AI_SIGHT`), and the same factor reaches its artillery spotting (`Arty.spotted`). The AI sniper (a spotter, base sight 360 m) carries it (450 m); no other archetype does, so the missions' balance moves only by those snipers. Artillery crews and AI turrets keep their sight.
- Balance numbers (mean hostile marks on the radar over 24 looks, 5 s apart, in the first 120 s of a medium skirmish, seed 11, veteran; old rule = every hostile within the targeting range; hostiles alive about 25 to 28): Ranger on ashfall 3.9 -> 1.6 (with the module 3.0), Bulwark on ashfall 3.3 -> 1.9 (2.3), Bastion on ashfall 6.4 -> 3.5 (5.5), Bulwark on verdant 7.1 -> 3.5 (5.3), Ranger on jungle 1.8 -> 1.5 (1.7), Trident on coast 26.7 -> 1.6 (3.1; the old 1400 m sensor showed the whole enemy fleet and base), Kestrel over the enemy base on ashfall 27.3 -> 26.9 (27.3), Kestrel on jungle 26.3 -> 20.1 (24.5). Reading: ground and sea platforms lose about half the contacts (a scouting reason to carry the module), aircraft keep nearly all of them because they fly into the middle of the fight.
- Co-op and saves: nothing is sent. Each game works out the picture of its own player from the platforms it holds (peers are platforms, so a peer's sensors share like an ally's), and the scenery is local to every game (D6). `NET_VERSION` 12: the Sensor Array is a new weapon id in loadouts (the host validates guests' loadouts, `WEAPON_IDS` shifts), no message changed. `SAVE_VERSION` stays 1: no new key; a saved loadout with the module is read as before. `TERRAIN_GOLDEN` unchanged (no terrain change; its test passes).

### P3-03 - Radar contacts for fauna and civilians (2026-10-29)

- Contacts (`Detect.scan` lists them, `HUD.drawRadar` draws them): animals (one mark per herd, flock or school, at its middle; a school only for sea mammals, which break the surface): a green cross; civilians on foot (not those indoors): a grey dot; civilian vehicles under way (cars, boats, aircraft in the air; not parked, not wrecked) and a civilian vehicle someone took (a team 2 platform): a grey square. Hostiles stay red diamonds, allies blue circles, objectives yellow squares, so no neutral icon looks like another side's.
- They follow the P5-05 rule: marked only inside a sensor's range (own, or an ally's at 60 percent). They are marks in a list, not platforms: they are not in `W.platforms`, target cycling, aim assist and locks never see them, and nothing in the radar code changes their state (D6). At most 400 marks per icon; each icon is drawn as one canvas path (a dense city has about 250 people).
- Cost: one pass over the platforms, the fauna groups (at most 28), the civilians of the zones within reach of the disc and the cars per frame; no allocation (a reused list). Not measurable in the P3-02 runs above.
- Notes for P7-08 (police), nothing changed: "team 2 is never a target" is hard-coded in these places (line numbers of this build). Targeting and sight: `Platform.validTarget` 14879 (target cycling, auto-target, locks), `AIController.perceive` 23092 (AI sight), `aimRay` 25519 (the HUD's hostile flag), `PC.assist` 25530 (aim assist) and `Detect.scan` 13329 (the radar draws a team 2 platform as a neutral civilian or vehicle); the aim-assist magnetism helper 3942; the artillery's `structInArc` 14062 and `pickTarget` 14076. Weapon effects: the projectile hit and retarget tests in `updateProjectiles` 16369 and 16419, chain lightning 16528, the payload area 16601, `burnArea` 16728, and the superweapon helpers `enemies` 17719, `fire` 19589 and `foeShots` 20092. Taking a civilian vehicle: `canEnter` 16978 and `enter` 17004 (taken only while team 2, then it becomes the driver's team) and `spawnRide` 11998 (makes the platform team 2). Police that turn on whoever harms civilians, whatever team, need an attacker-based rule at the targeting and sight places (`validTarget`, `perceive`, `aimRay`, `assist`, the radar) and none at the effect places, where team 2 only keeps area helpers from hitting civilians.

### P5-04 - Lock-on to objective structures (2026-10-29)

- What was wrong (found with a probe over every mission and skirmish battlefield, D-022): objective structures were already in the target cycle, but none could be locked. `Platform.lockSight` asked `hasLOS`, whose ray stops 1.5 m short of the target's middle, which is inside the box of any structure wider than 3 m, so the structure itself blocked the line and every lock ended in NO LINE OF SIGHT (`updateLock`, reason shown on the HUD). The same test gave every structure the "hidden" penalty when ranking targets. A guided missile fired anyway flew dumb.
- Fix: `sightTo(ax, ay, az, t, tp)` (next to `hasLOS`): for a structure the ray goes to its middle and the line is clear if the first thing it meets is the structure itself. `lockSight`, the cycling score and the new seeker (`seekerSees`) use it. Nothing else about cycling changes: objective structures stay "always known" (P5-05), listed only inside the platform's targeting reach, ranked like any target.
- Auto-target (the setting): a hostile objective structure under the reticle is taken when nothing else is held (`W.aimInfo.objective`, `PC.autoTarget`); platforms keep priority.
- Input: keyboard (cycle key), gamepad (Y) and touch (TGT) all end in `Platform.cycleTarget` through `PC.sample`; the self-test presses each. HUD: the target panel already shows OBJECTIVE, name, hull bar, distance and the lock state; the radar already draws a targeted structure as a ringed yellow square, pinned to the rim beyond the disc (tested).
- Weapons: every seeker that locks ground targets (`lock: any` or `ground`: Guided Missile, Swarm, Cruise, Javelin) locks and hits a structure; the anti-air seekers (AA Missile, Ship SAM) refuse it ("AIR TARGETS ONLY", they could not hit it); the wire missile needs no lock.
- Co-op: a guest already sent a structure pick as `-1 - index`; the host's lock state reached the guest without the target (`lk` held a platform id only), so a guest never saw its lock on a structure. `lk[3]` is now a platform id, `-1 - index` for a structure, or `NET_PROJ_TG + nid` for a projectile (P5-07). `NET_VERSION` 13.
- AI: an AI unit sent against a structure (`assault`) already took it as its target; with the lock fixed, a unit that carries a ground-capable seeker now locks it and fires (self-test: an AI medium mech locks a depot at 190 m and its Guided Missile hits it). The AI jet and every AA seeker still refuse structures (`canUseSecondary`). Balance note: AI missiles on objectives, measured in a skirmish with the player far away on Ashfall Ridge and Verdant Ridge (3 runs each of 6 minutes, medium, seed 11): the enemy took our command center down in the 3rd or 4th minute before (mean 3.5) and in the 4th or 5th now (mean 4.2), so locking structures did not speed the AI up (the enemy's missiles are also less accurate in this build, P5-06; the runs differ by a minute between themselves).
- Checked: all 31 hostile objective structures of the 18 missions and the 13 skirmish battlefields (self-test 'p5 every objective can be locked'): cycled to, locked from a clear spot within 60 to 260 m and hit by a Guided Missile (m8's Factory Core is shielded until the power nodes fall: the lock is made, the hit is soaked by design). Friendly objectives (m3, m6, m15, m17) are not targets, as before.

### P5-06 - Homing projectile tuning (decided 2026-10-29 by the coordinator; the owner can change any row)

- Owner's words: missiles "are very hard to dodge and keep following even around buildings". Causes found in P1-07 (Appendix D): no line-of-sight, view-cone or lock-loss rule after launch, turn rates above what any target can outturn, and flares (50% per drop) and ECM (100%) as the only ways out.
- New seeker rules (`seekerSees`, `updateProjectiles`; host only, guests only mirror the projectile). From 0.25 s after launch a homing projectile with a seeker view (`guide.fov`) must see its target: (1) the target must be inside a cone of `fov` radians round the missile's own nose, (2) the line from the missile to the target must be clear of terrain, buildings and other structures (a look every 0.12 s of flight; a ground unit is looked at over its shoulders, a third of its height above its middle; a structure does not hide behind itself). While it does not see the target the missile steers on the place it last saw it; after `guide.lose` seconds blind it drops the target and flies straight on at its last heading (`p.target = null`, `noGuide`). Seeing the target again before then clears the clock. Within 10 m the target is always seen (the fuse is about to go). Superweapon ordnance (`swMicro`, `swCruise`, `swSkyMissile`, Photon Orb ...) has no `fov`: unchanged. The wire-guided ATGM has no seeker (the owner steers it): unchanged.
- Decided target hit rates (direct hits per launch, a hit being within the target's radius + 2.5 m; 40 launches per cell unless said, so plus or minus 8 points of noise), with what was measured (HEAD c706b49 -> this build):

| Case | Target | Measured | Met |
|---|---|---|---|
| Target on a straight course, aircraft at 400 m | 80% or more (the AI keeps using missiles; a player who flies straight is still hit) | AA Missile, Ship SAM, Guided Missile, Swarm 100% -> 100% | yes |
| Target on a straight course, ground, 250 m | not below 80% of the old rate | Guided Missile 65% -> 65%, Swarm 65% -> 65%, Javelin 93% -> 90%, Cruise 63% -> 60% | yes |
| Target on a straight course, ground, 500 m | not below 80% of the old rate | Guided Missile 40% -> 32% and Swarm 43% -> 36% (100 launches each: 80% and 84% of the old rate), Javelin 100% -> 98%, Cruise 42% -> 36% (100 launches: 86%) | yes |
| Evading target: an aircraft that breaks hard (0.7 rad/s, about 8 g) 0.25 s after the missile comes within 350 m | 55% or less, every homing type (a hard break must beat about half of the shots, not all) | AA Missile 53% and 53% (400 m, 800 m), Ship SAM 53% and 53%, Guided Missile 50% (400 m), Swarm 53% (400 m), Cruise Missile 0% and 10% (was 100% for the first four) | yes |
| Evading target: a mech or vehicle on the ground that jinks at 18 m/s | no target: a ground unit cannot outturn a 110 m turn radius at 12 to 18 m/s whatever the cone | 68% -> 68% (Guided Missile, 250 m) and the like; unchanged | not asked |
| Target that breaks the line of sight behind a building, the building squarely between (Metro, 40 launches) | 5% or less hit, and the seeker gives up the chase instead of holding the target to the end; the Javelin excepted | hits 0% -> 0% (Guided Missile, Swarm, Cruise: the missile ends on the building in both builds); gave up: Guided Missile 29 of 40, Swarm 39, Cruise 35 (was 0 of 40: it held the target to the end); Javelin 70% -> 68% | yes; the Javelin is the exception |
| Target that breaks the line of sight from the launcher only (a ridge or a corner: the missile may still see it as it comes round) | no worse than before | Guided Missile 25% -> 25%, Swarm 20% -> 23%, Cruise 8% -> 8% (ridge); 43% -> 53%, 28% -> 40%, 15% -> 13% (city) | not worse, within noise except the city rise |
| Target dropping flares (800 m, weaving or breaking) | 40% or less (a flare must stay worth a charge) | AA Missile 28% -> 38% and 28% -> 13%, Guided Missile 28% -> 10% and 0%, Swarm 0% | yes |
| Target jamming (ECM) | 0% as before (three uses of 5 s: a design cost the owner can change, D-017) | 0% -> 0% in every cell | yes |

- What was changed, per missile (old -> new; `life` is kept: it is already the weapon's range over its mean speed, so a shorter flight would only cut the reach the AI fires at, 0.9 x range, and the new blind rule is what ends a chase):

| Missile | Turn rate (rad/s) | Seeker view (half angle) | Blind time | Flare chance | Flight time (s) and range (m) |
|---|---|---|---|---|---|
| Guided Missile | 2.0 -> 1.8 | none -> 0.85 rad (49 degrees) | none -> 0.5 s | 50% -> 50% | 5.5, 900 (unchanged) |
| AA Missile | 4.2 -> 2.2 | none -> 0.9 rad (52 degrees) | none -> 0.5 s | 50% -> 50% | 5, 1100 (unchanged) |
| Swarm Missiles | 3.2 -> 2.8 | none -> 0.8 rad (46 degrees) | none -> 0.4 s | 100% -> 90% | 4, 650 (unchanged) |
| Ship SAM | 3.6 -> 2.2 | none -> 0.9 rad | none -> 0.5 s | 50% -> 50% | 6, 1400 (unchanged) |
| Cruise Missile | 0.9 -> 0.9 | none -> 0.6 rad (34 degrees) | none -> 1.2 s | 50% -> 40% | 16, 1500 (unchanged) |
| Javelin | 3.0 -> 3.0 | none -> 1.6 rad (no cone: it climbs, then looks down) | none -> 1.5 s | 50% -> 50% | 7, 600 (unchanged) |
| Wire-guided ATGM | 2.4 (wire) unchanged | no seeker | no seeker | immune | 9, 900 (unchanged) |

- Reasons: the AA Missile and Ship SAM had turn radii of 69 to 83 m at top speed against a jet's 170 m at 8 g, so no break ever beat them; at 2.2 rad/s the radius is 130 m and a hard break at 350 m out beats about half of the shots, with the cone doing the rest. The Guided Missile (turn radius 100 m -> 111 m) and Swarm (69 -> 79 m) lose a little; they kept 100% against a straight aircraft. The Javelin turn rate stays: at 2.6 rad/s its dive from 35 m could not reach the target (self-test 'arsenal weapons' caught it) and it has a 1.6 rad view because it flies up before it looks down. Swarm flares: the old x2 multiplier made every drop work; 90% keeps them the missile flares fool most easily. Cruise flares 40%: its narrow view (0.6 rad) holds a flare in sight less often. The blind times are short because the missile flies 100 to 250 m/s: a blind half second is 50 to 100 m, enough to come round a corner on a target that stays visible and not enough to follow one round a building. Cruise (slow, 1.2 s: at 0.8 s it lost a quarter of its 500 m shots to dips in the ground, 42% -> 31% of 100) and Javelin (it climbs first, 1.5 s) get longer.
- Measured (the harness `p5m.mjs`: a fixed shooter at a clear spot on Ashfall Ridge, the Metro for the city, one launch at a locked, scripted target, 40 launches per cell, seeded; HEAD c706b49 against this build):

Ground target (Bulwark-sized dummy, 12 m/s), direct hits per launch, 40 launches per cell, before -> after
| Missile | Range | Straight | Weave (P1-07 dodge) | Break (jink 0.25 s after the missile is within 220 m) |
|---|---|---|---|---|
| missile | 250 m | 65% -> 65% | 63% -> 63% | 68% -> 68% |
| missile | 500 m | 50% -> 38% | 38% -> 40% | 48% -> 45% |
| swarm | 250 m | 65% -> 65% | 68% -> 65% | 75% -> 70% |
| swarm | 500 m | 53% -> 40% | 48% -> 48% | 53% -> 43% |
| javelin | 250 m | 93% -> 90% | 90% -> 93% | 88% -> 85% |
| javelin | 500 m | 100% -> 98% | 100% -> 98% | 100% -> 95% |
| cruise | 250 m | 63% -> 58% | 78% -> 75% | 85% -> 83% |
| cruise | 500 m | 45% -> 38% | 50% -> 43% | 48% -> 43% |
| atgm | 250 m | 78% -> 70% | 15% -> 15% | 0% -> 0% |
| atgm | 500 m | 50% -> 50% | 18% -> 18% | 0% -> 0% |

Air target (120 m/s crossing), same
| Missile | Range | Straight | Weave (0.5 rad/s S-turns) | Break (0.7 rad/s, 0.25 s after the missile is within 350 m) |
|---|---|---|---|---|
| aam | 400 m | 100% -> 100% | 100% -> 38% | 100% -> 53% |
| aam | 800 m | 100% -> 100% | 100% -> 100% | 100% -> 53% |
| shipSam | 400 m | 100% -> 100% | 100% -> 48% | 100% -> 53% |
| shipSam | 800 m | 100% -> 100% | 100% -> 98% | 100% -> 53% |
| missile | 400 m | 100% -> 100% | 100% -> 100% | 50% -> 50% |
| missile | 800 m | 0% -> 0% | 83% -> 80% | 0% -> 0% |
| swarm | 400 m | 100% -> 100% | 100% -> 100% | 100% -> 53% |
| swarm | 800 m | 0% -> 0% | 10% -> 10% | 0% -> 0% |
| cruise | 400 m | 15% -> 15% | 30% -> 30% | 0% -> 0% |
| cruise | 800 m | 10% -> 10% | 13% -> 13% | 10% -> 10% |

Cover (target hides after launch): direct hits, launches where the seeker was blind 0.3 s or more and still hit, launches blind 0.5 s or more, longest blind chase (s)
| Missile | Scenario | Hits before -> after | Still homing at the end (gave up: 0 before) | Hit while blind >= 0.3 s | Chased blind >= 0.5 s |
|---|---|---|---|---|---|
| missile | ground:ridge | 25% -> 25% | gave up 7/40 | 2/40 -> 2/40 | 25/40 -> 26/40 |
| swarm | ground:ridge | 20% -> 23% | gave up 7/40 | 1/40 -> 2/40 | 26/40 -> 24/40 |
| javelin | ground:ridge | 100% -> 98% | gave up 1/40 | 11/40 -> 10/40 | 6/40 -> 7/40 |
| cruise | ground:ridge | 8% -> 8% | gave up 7/40 | 1/40 -> 1/40 | 34/40 -> 35/40 |
| atgm | ground:ridge | 10% -> 8% | gave up 40/40 | 0/40 -> 0/40 | 0/40 -> 0/40 |
| missile | ground:city | 43% -> 53% | gave up 6/40 | 0/40 -> 3/40 | 10/40 -> 10/40 |
| swarm | ground:city | 28% -> 40% | gave up 12/40 | 0/40 -> 3/40 | 14/40 -> 10/40 |
| javelin | ground:city | 90% -> 90% | gave up 0/40 | 10/40 -> 10/40 | 12/40 -> 12/40 |
| cruise | ground:city | 15% -> 20% | gave up 16/40 | 3/40 -> 4/40 | 33/40 -> 32/40 |
| atgm | ground:city | 25% -> 25% | gave up 40/40 | 0/40 -> 0/40 | 0/40 -> 0/40 |

Countermeasures (air target, 800 m): flares / ECM, weave and break
| Missile | Flares weave | Flares break | ECM weave | ECM break |
|---|---|---|---|---|
| aam | 28% -> 38% | 28% -> 13% | 0% -> 0% | 0% -> 0% |
| missile | 28% -> 10% | 0% -> 0% | 0% -> 0% | 0% -> 0% |
| swarm | 0% -> 0% | 0% -> 0% | 0% -> 0% | 0% -> 0% |

Target carrying Point Defence (after the review rebalance; the dummy crosses the line of fire, so the shooter is on its flank, at the edge of the gun's front arc): ground straight, direct hits
| Missile | 250 m | 500 m |
|---|---|---|
| missile | 65% (no PD) -> 43% (PD) | 50% (no PD) -> 33% (PD) |
| swarm | 65% (no PD) -> 45% (PD) | 53% (no PD) -> 25% (PD) |
| javelin | 93% (no PD) -> 80% (PD) | 100% (no PD) -> 78% (PD) |
| cruise | 63% (no PD) -> 58% (PD) | 45% (no PD) -> 33% (PD) |

- Reading: against a straight target nothing changes at 250 m on the ground and at 400 m in the air; at 500 m on the ground the seekers lose about a fifth of the shots (half of those launches give up when a dip in the ground hides the target for half a second: the shot was mostly ending in the ground anyway, 54 to 60 of 100 launches in both builds). Against an aircraft that breaks hard the AA Missile, Ship SAM and Swarm fell from 100% to 53%, the Guided Missile stays at 50% (its slow turn already lost it), the Cruise Missile to 0 to 10%. A ground target that jinks is hit as before: its answer is cover, smoke, ECM, the Active Protection and Point Defence. The line-of-sight rule does what it was asked: a missile whose target is hidden behind a building gives up within its blind time (it held the target for the whole flight before: Guided Missile 29 of 40 now give up, Swarm 39, Cruise 35) and flies on into the building. Hit rates on cover did not move much, and that is a finding, not a pass: the old missile also flew into the cover, and where the cover only hides the target from the launcher the missile often sees it as it comes round, which is a real sighting. The Javelin keeps its top attack: it still hits a target behind a building (68%, and 25 of its 27 hits came after it had lost sight of the target for 0.3 s or more) and a target behind a ridge (98%); lowering `TOP_ATTACK_MAX` (60 m) or its blind time (1.5 s) would change that: the owner's call. Flares and ECM keep their rates.
- AI still uses missiles well: an AI medium mech (Guided Missile) fights a Bulwark about 300 m away on Ashfall Ridge for 40 s, 12 fights each (`p5ai.mjs`): against an idle target it fired 6.2 missiles per fight and 92% of them hit before, 5.3 and 83% now; against a target that strafes every 0.8 to 1.6 s 5.9 and 87% before, 5.5 and 73% now. The AI keeps firing, keeps locking and hits most of what it fires at, and a player who moves is hit about 14 points less often than one who stands.
- Co-op and saves: nothing is sent for the tuning (the host simulates projectiles; a guest mirrors them from snapshots). `SAVE_VERSION` stays 1.

### P5-07 - Intercepting projectiles in flight (decided 2026-10-29 by the coordinator; the owner can change any row)

- Owner's words: missiles and rockets "can be hit and destroyed in flight by guns, flak and a point-defence utility ... (lock-on to an incoming missile included). AI uses it."
- Rule (`Intercept`, host only; the host decides when a projectile is destroyed, guests mirror projectiles from snapshots, so a destroyed one stops arriving and the burst reaches them through `explode`): a missile or rocket (WEAPONS with `pdHp` hit points and `pdR` hit radius) is hurt by (1) a hostile direct-fire round of a weapon with `pdHit` that passes inside the hit radius (swept in the frame of the target, so nothing tunnels; the round is spent, a piercing round goes on), (2) a hostile proximity round (flak) that bursts when the rocket is within 60% of its 7 m fuse plus the hit radius, (3) the blast of a hostile blast round (Autocannon, Plasma, Naval Gun, flak, an AA seeker) by distance, with fragments counting double (`PD_BLAST_MULT`), (4) an anti-air seeker (AA Missile, Ship SAM) locked on it, which bursts within 4 m of it, (5) the Point Defence utility. At 0 hit points the projectile bursts (`PD_KILL_BLAST`, a 2.6 m burst, no damage: its warhead does not go off) and the shooter gets "SHOT DOWN: name". Your own and neutral projectiles are never touched. Reasons: guns already existed as the answer to everything and the owner asked for them; beams (Pulse Laser, Beam Lance, Tesla, Arc Pistol) are instant hits aimed by the beam code and would need a second hit model, lobbed shells, bombs, mines, flames, needles, EMP bolts and superweapon ordnance are not rockets, so none of those can be shot down or shoot them down.
- Hit points and hit size (m radius), per projectile: the hit points are roughly 0.4 x the warhead damage for the guided missiles, less for the small rockets, so one burst of a good gun kills a cheap rocket and a Cruise Missile needs a heavy round; the hit size is about the visible body plus a margin (they move at 120 to 300 m/s):

| Projectile | Warhead damage | Hit points | Hit radius | Reason |
|---|---|---|---|---|
| Rocket Pod rocket | 14 | 8 | 0.9 | small and unguided: one Autocannon round, two Chain MG rounds |
| Guided Missile | 75 | 30 | 1.4 | the reference: three Autocannon rounds, six Chain MG rounds |
| AA Missile | 70 | 20 | 1.1 | lean and fast: less skin than a Guided Missile |
| Swarm missile (each of 8) | 18 | 6 | 0.8 | one hit of nearly any gun |
| Ship SAM | 80 | 28 | 1.3 | a bit bigger than an AA Missile |
| Cruise Missile | 300 | 120 | 2.4 | the big one: only the railgun, Gauss, Slug and sniper kill it in a round or two, a machine gun needs 24 |
| Cluster Rocket | 20 | 18 | 1.1 | it bursts into bomblets 0.9 s out, so it must be hit early |
| Wire-guided ATGM | 150 | 30 | 1.1 | as the Guided Missile |
| Rocket Launcher rocket | 90 | 14 | 1.0 | a light unguided rocket |
| Javelin | 120 | 28 | 1.1 | as the Guided Missile |
| Rocket Artillery rocket | 70 | 24 | 1.3 | a heavier rocket |

- Which weapons may hit them (`pdHit`, 16 guns): Chain MG, Autocannon, Gatling Cannon, Scattergun (pellets), Railgun, Plasma Cannon, Flak Cannon, Gauss Rifle, Slug Cannon, Rotary Vulcan, Assault Rifle, Submachine Gun, Sniper Rifle, Light Machine Gun, Marksman Rifle, Naval Gun. Aim: by hand, as at any target, with the reticle on the rocket; the Point Defence aims itself; flak is the natural answer because it bursts near. Rounds needed, head-on, one round per tick (self-test 'p5 intercepting projectiles', every projectile with every gun, columns in this order: Chain MG, Autocannon, Gatling, Scattergun, Railgun, Plasma, Flak, Gauss, Slug, Vulcan, Rifle, SMG, Sniper, LMG, Marksman, Naval Gun):

| Projectile | Chain MG | Autocannon | Gatling | Scattergun | Railgun | Plasma | Flak | Gauss | Slug | Vulcan | Rifle | SMG | Sniper | LMG | Marksman | Naval Gun |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rocket Pod | 2 | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 1 | 2 | 1 | 1 |
| Guided Missile | 6 | 3 | 5 | 3 | 1 | 1 | 3 | 1 | 1 | 5 | 6 | 8 | 1 | 6 | 1 | 1 |
| AA Missile | 4 | 2 | 4 | 2 | 1 | 1 | 2 | 1 | 1 | 4 | 4 | 5 | 1 | 4 | 1 | 1 |
| Swarm missile | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 1 | 2 | 1 | 1 |
| Cruise Missile | 24 | 10 | 20 | 12 | 1 | 2 | 10 | 1 | 1 | 20 | 24 | 30 | 2 | 24 | 4 | 2 |
| Cluster Rocket | 4 | 2 | 3 | 2 | 1 | 1 | 2 | 1 | 1 | 3 | 4 | 5 | 1 | 4 | 1 | 1 |
| Wire ATGM | 6 | 3 | 5 | 3 | 1 | 1 | 3 | 1 | 1 | 5 | 6 | 8 | 1 | 6 | 1 | 1 |
| Rocket Launcher | 3 | 2 | 3 | 2 | 1 | 1 | 2 | 1 | 1 | 3 | 3 | 4 | 1 | 3 | 1 | 1 |
| Javelin | 6 | 3 | 5 | 3 | 1 | 1 | 3 | 1 | 1 | 5 | 6 | 7 | 1 | 6 | 1 | 1 |
| Ship SAM | 6 | 3 | 5 | 3 | 1 | 1 | 3 | 1 | 1 | 5 | 6 | 7 | 1 | 6 | 1 | 1 |
| Rocket Artillery | 5 | 2 | 4 | 3 | 1 | 1 | 2 | 1 | 1 | 4 | 5 | 6 | 1 | 5 | 1 | 1 |

- Lock-on to an incoming projectile: Cycle Target (key, pad, touch) now also lists the hostile missiles and rockets headed for your platform within 450 m (`Intercept.eachThreat`: homing on you, or on course to pass within 25 m + your radius inside 6 s; a missile warning, so no radar detection is needed), ranked first (`TARGET_INCOMING_BONUS`); auto-target after a kill never picks one. The HUD shows INCOMING, its name and its hull bar in a triangle; the radar draws a ringed triangle. The AA Missile and the Ship SAM may lock it (any other seeker says AIR TARGETS ONLY: a Guided Missile has no business with a rocket); the missile bursts within 4 m of it and kills any of the eleven (self-test: 10 types x 2 seekers; not the Cluster Rocket, which airbursts 0.9 s after launch, before a 0.7 s lock and a flight). Because a projectile slot is reused, a target projectile is held with its `nid` (`targetNid`, `tnid`). Co-op: a guest picks a projectile as `tg = NET_PROJ_TG + nid`; the host accepts it only if it is headed for that guest's platform. Superweapons never aim at a projectile.
- Point Defence (`WEAPONS.pdc`, utility, `def: 'pdc'`; rebalanced after the review, which found that the first version never missed and made its carrier almost immune): weight 8 (the Active Protection is 7, a shield 6, ECM 5), 12 bursts that come back one every 5 s, one burst every 0.2 s, 16 damage per round that hits, reach 140 m (was 230), a clear line (`hasLOS`) and a projectile headed for its carrier needed; on a ground platform or a mech only the front half (a 180 degree arc round the hull, or the torso for a mech; aircraft all round). Each round hits with a chance of 90% at 30 m or nearer falling in a line to 40% at 140 m, times the projectile's `pdEvade` (Swarm 0.65, Rocket Pod 0.6, AA Missile 0.45, Ship SAM 0.45, Rocket Launcher 0.5, Javelin 0.65, wire ATGM 0.7, the rest 1); a new target takes 0.3 s to find (`pdAcquire`; 0.15 s, `pdRetarget`, while the gun fired within the last half second), and a burst that finds a second and third target nearby may spray further rounds: a burst makes one round at the projectile that arrives first and up to three more at the next ones that a single hit kills (`pdSpray` 1, `pdCheap` 3). A miss still spends the burst. The roll is on the unit's own seeded stream (`makeRng`, seed = platform id xor `PD_SALT`), so a rerun, the self-tests and the co-op host see the same shots. It takes the one that arrives first, or the one you have targeted if it is inbound; the defense key arms and disarms it (touch DEF button, HUD line "ARMED n RDS"). What it is not: the Active Protection stops one heavy missile or shell per charge inside 30 m for certain, never a light rocket, and recharges a charge in 15 s; Point Defence reaches farther, takes light rockets too, but misses, needs time, and is thinned by a salvo. A Cruise Missile (120 hit points) cannot be stopped by it alone (the first round that hits comes too late for 8 hits). The two anti-air missiles (the AA Missile and the Ship SAM, about 290 m/s) cross its 140 m reach in about 0.5 s, which with the 0.3 s slew leaves one burst, and at 16 damage they would need two hits: against them it stopped nothing, on a gunship nothing in 40 runs (review round 2). They are light-skinned for it (`pdSoft` 1.8: a round that hits does 29 damage to them, enough to kill either with one hit) and a hard target for its gun (`pdEvade` 0.45), so one burst has a 20 to 60% chance and the gunship stops 39% of AA Missiles and 41% of Ship SAMs (100 runs each; a ground carrier 46% and 38%). The Cluster Rocket bursts before it is in reach: it is hardly ever stopped. Mounts on ten platforms: Bulwark, Colossus, Bastion, Behemoth, Lancer, Trident, Skua and the three artillery pieces (each inside its weight limit with its default loadout; tested); not on the light mech, infantry, jackal, specter or the two jets. No default player loadout carries it, so the old balance is unchanged, and it is open from the start (no unlock rule).
- Point Defence rebalance (the review's table, `pdbal.js`: a Bastion with the module against scripted attacks, damage that gets through as a share of the unprotected carrier's, 30 to 40 runs per row for the new column, 20 for the old; Active Protection for comparison). Aims set by the review: a single missile stopped about 50 to 65% of the time, a salvo of two lets one through, about half of a Swarm or Rocket Pod salvo gets through, and the Active Protection stays a real alternative. Starting values were 140 m reach, 90% falling to 40% hit chance, a 0.3 s slew, 12 bursts back one in 5 s; the damage per round became 16 (two hits kill a Guided Missile), and the spray and the evade numbers above were found by iterating this table (`pdSpray` 2 stopped two missiles too well, 33% through; 1 with three more rounds at one-hit rockets gives the figures below).

| Attack | Unprotected damage | Active Protection (share through) | Point Defence before (share through) | Point Defence after (share through) |
|---|---|---|---|---|
| 1 missile 450m | 56 | 0% | 0% | 50% |
| 1 missile 150m | 56 | 0% | 0% | 38% |
| 2 missiles together 450m (2 shooters) | 113 | 50% | 0% | 66% |
| 4 missiles together 450m (4 shooters) | 225 | 75% | 50% | 81% |
| 1 shooter full clip 4 missiles cd1.8 | 225 | 50% | 0% | 41% |
| swarm 8 450m | 108 | 100% | 13% | 45% |
| swarm 8 200m | 108 | 100% | 0% | 50% |
| rocket pod 6 300m | 63 | 100% | 0% | 41% |
| rpg 150m | 68 | 0% | 0% | 32% |
| javelin 450m | 126 | 0% | 0% | 60% |
| cruise 900m | 225 | 0% | 0% | 100% |
| mixed: pod 6 + missile same time 300m | 119 | 53% | 18% | 74% |
| mixed: swarm 8 + 2 missiles 400m | 221 | 74% | 50% | 80% |
| sustained: 2 shooters, missile each 1.8s for 30s | 1800 | 84% | 72% | 89% |

- Reading: a single missile is stopped about half the time from 450 m and a little more when launched inside the reach (the figure for 150 m is 38% through); two missiles at once lose about one (66% through); four at once, mostly through (81%); a salvo of eight Swarm missiles or six pod rockets loses about half (45 to 50% and 41% through); the Active Protection beats it against a single heavy missile or a Javelin (nothing through) and loses to it against a Swarm or a pod, where it does nothing; a sustained stream of missiles empties the 12 bursts (89% through, 1 left); the Cruise Missile is not stopped (100% through, damage 225), and the Javelin (60% through) and the Rocket Launcher (32% through) are stopped 40% and 68% of the time. Per-type stop rates from 450 m, one missile at a time, 24 fresh carriers each (self-test 'p5 point defence'): Rocket Pod 71%, Guided Missile 54%, AA Missile 46%, Swarm 83% (one missile), Cruise 0%, Cluster 0%, wire ATGM 75%, Rocket Launcher 83%, Javelin 46%, Ship SAM 38%, Rocket Artillery 92%.
- Gunship (Behemoth, review round 2: the first rebalance left it with no defence against the two anti-air missiles). The smallest change that works, chosen by measurement: not a shorter slew for aircraft (0.15 s took the gunship from 68% to 88% of Guided Missiles stopped, out of the aim, and the Ship SAM to 62%) but the two anti-air missiles themselves, which are light-skinned for Point Defence (`pdSoft` 1.8) and harder to hit (`pdEvade` 0.45, was 0.85 for the AA Missile and none for the Ship SAM). Probe `pdair.js` (a Behemoth with the module, one missile from 450 m, or a Swarm salvo of eight; 100 runs each), share stopped, before -> after:

| Attack on the gunship | Before | After | Aim |
|---|---|---|---|
| AA Missile | 0% | 39% | 25 to 55% |
| Ship SAM | 0% | 41% | 25 to 55% |
| Guided Missile | 68% | 68% | unchanged |
| Swarm missiles (salvo of eight) | 40% | 37% | unchanged |

  Flares stay the better answer to them: a flare spoofs 50% of AA Missiles and Ship SAMs each time it is dropped, the gunship carries eight, and against a jet at 800 m the AA Missile hits 100% (weaving) and 53% (breaking) without flares and 38% and 13% with them (P5-06 table); Point Defence leaves 61% of the AA Missiles through on its own. No ground or naval row of the reviewer's table (above) moved out of its range: none of its attacks uses the two anti-air missiles, and the Active Protection is untouched. Re-run after the change, 30 runs per row, share through: single missile 41% and 36% (was 50 and 38), two missiles 61% (66), four 84% (81), full clip 38% (41), Swarm salvo 48% and 50% (45, 50), pod salvo 54% (41), Rocket Launcher 28% (32), Javelin 63% (60), Cruise 100%, mixed pod and missile 80% (74), mixed swarm and two missiles 83% (80), sustained 89% (89): every row within the run noise of the earlier figure (the largest step is +13 points on the pod salvo). The ground carriers' per-type stop rates for the two anti-air missiles are in the line above, 46% and 38%. The tests: 'p5 point defence' now fails if either is 0% (bounds 15 to 80% from a ground carrier over 24 runs) and has a gunship check (20 to 65% over 30 runs each, Guided Missile 35 to 85%).
- AI: the AI uses Point Defence through the same path as the player (an armed utility fires by itself, on its own seeded stream): the allied tank (`ARCH.allyTank`) carries it, armed, and so does the enemy destroyer (`ARCH.destroyer`, the Trident of the naval missions, which had the Active Protection: the Active Protection is the stronger answer to one heavy missile and the weaker to a salvo, so the destroyer now trades one for the other; its weight is 1 more). Checked (self-test 'p5 the AI uses point defence', 16 fresh units each): an AI tank stops 12 of 16 Guided Missiles aimed at it and is hit by the other 4, and the destroyer stops 11 of 16. No other archetype carries it, so the missions' hit rates for the player's missiles change only against destroyers. Decided exception, the AI never aims its guns at an incoming missile: leading a 200 to 300 m/s target 1 to 2 m wide is a skill the AI would do too well (it has no aim error against a straight line) and too cheaply (it would make every AI unit with a gun nearly immune to missiles, the same finding as the first Point Defence), the AI's guns stay on platforms where they were tuned, and the Point Defence it carries is its answer; a unit that wants protection gets it by loadout, which is the rule for the player too. The self-test checks that `aimAtTarget` has no projectile target.
- The P5-06 hit rates still hold: Point Defence, flak and guns only act when a carrier or a shooter is there, so the harness cells without them are unchanged; the P5-06 tables were measured with this code in (the Point Defence cells were measured again after the rebalance). With Point Defence on the target the missile hit rates fall but stay well above zero (ground target, crossing, so the shooter is at the edge of the gun's arc): Guided Missile 65% -> 43% at 250 m and 50% -> 33% at 500 m, Swarm 65% -> 45% and 53% -> 25%, Javelin 93% -> 80% and 100% -> 78%, Cruise 63% -> 58% and 45% -> 33%. Facing the shooter the figures are the review's: a single missile 50% through.
- Co-op, net and saves: `NET_VERSION` 12 -> 13 (a new weapon id in loadouts and `WEAPON_IDS`, a new target id range in `in` `tg` and the host's `lk`); the snapshot already carries `team`-less projectile entries, so a guest takes the shooter's team for them (`pr.team`, `pr.hp`) to cycle to them. Snapshot room (review): a snapshot holds `SNAP_PROJS` (70) projectiles, shared by all guests; shells still go first, then every missile and rocket (those with hit points), then plain rounds, so a guest always has the missiles and rockets of the battle to cycle to unless more than 70 are up at once (tested with 90 bullets in flight). Known limit: with more than 70 missiles and rockets at once the snapshot is not sorted per guest (by whom they are headed for), so a guest may miss one; the host still decides everything, and the guest's own warning (the `inc` count and distance in the snapshot) is unaffected. `SAVE_VERSION` stays 1: no new save key, a saved loadout with the module reads as any other.
- Cost: the interception pre-pass (`Intercept.sweep`) runs once per tick over the 480 projectile slots and, only while some missile or rocket is up, against every direct-fire round: measured with `__IH.bench` on the Low preset, 5 scenes, three runs of each build alternating (this build, HEAD c706b49, this build, ...), each run the bench's median of three: median average frame ms, this build against HEAD: sk-ashfall 46.3 / 45.8, sk-verdant 47.3 / 47.7, air-ashfall 27.0 / 31.1, sk-jungle 72.1 / 75.4, sea-coast 30.8 / 30.5; median p95: 51.9 / 49.8, 51.1 / 53.5, 30.2 / 33.2, 75.9 / 79.0, 39.5 / 39.3. Between -13% and +4%, inside the noise of a shared PC (single runs of the same build differ by 5 to 10%, and HEAD had a 131 ms p95 spike in one air run); no scene is slower in a way the runs can tell from noise. After the review rebalance (the scan keeps its one pass over the projectile slots, now also sorting up to 6 candidates and rolling a seeded stream; a destroyer carries it): sea-coast and sk-ashfall, three alternating runs each, median average frame ms this build / HEAD 34.3 / 34.2 and 51.7 / 52.9, p95 45.5 / 44.7 and 58.7 / 62.4: unchanged.
- Accounting (review): a shoot-down is no longer counted as a hit in the shooter's accuracy figures (`Intercept.kill` no longer adds to `hits`; self-test). Not done / owner's call: the AI does not shoot rockets with its guns (decided exception above); beams cannot hit rockets; Point Defence does not protect allies; superweapon ordnance cannot be shot down; the two anti-air missiles are stopped by Point Defence only partly (39% and 41% on the gunship, about 40% of the time; see "Gunship" above). A platform has one utility slot, so a gunship has Point Defence or Flares, not both: its answers to a missile it cannot stop are the flares of another loadout, its gatling and cannon rounds (16 guns hit missiles), manoeuvre and the new seekers' limits (P5-06).

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
| D-014 | High | Fauna is rarely on screen | `QUALITY` 721; `Fauna.populate` 9244, `draw` 9770; map `fauna` fields | See P1-04 below. | P3-01, P3-02 | fixed (P3-01, P3-02: Appendix C) |
| D-015 | Medium | Species per map: deer on 2 maps only | map definitions (`fauna.species`) | Deer exist only on verdant (7 animals) and valley (5) at Medium. The owner saw a deer once, which fits. | P3-01 | improved (P3-01: herds now stand by the start, metro gets deer; the other lists are unchanged) |
| D-016 | High | Missiles keep tracking after line of sight is lost | `updateProjectiles` 16043; `steerProjectile` 15982; `projectileTargetPos` 15995 | See P1-07 below. | P5-06 | fixed (P5-06: Appendix C; `seekerSees`) |
| D-017 | Medium | Countermeasures are all or nothing | `deployFlares` 15043 (`FLARE_SPOOF` 0.5, swarm x2), `WPN.jam` 16303 | Flares turn 12 of 24 AA missiles away (hit rate 100% to 46%), ECM turns away 24 of 24 (hit rate 0%); a flare or ECM user is safe, a user without them cannot dodge. | P5-06 | improved (P5-06: a flare chance per seeker, 40 to 90%; ECM unchanged at 100%, the owner can change it) |
| D-018 | Medium | Loadout barely changes the model; no hangar preview | `drawMech` 15373 and the other `draw*` functions; `scr_hangar` 25983 | See P1-05 (Appendix C): jets draw no guns, most weapons in a slot look the same, Hailstorm never changes, the hangar shows text cards only. | P6-01, P6-02 | open |
| D-019 | Medium | Team ids are fixed in code | `TEAM_ACCENT` 15289 (3 entries); 40 lines test `team === 1` / `!== 1`, 42 lines `team === 0` / `!== 0`, 17 lines team 2; `hostileSees` 22627 counts only team 1; `forwardSpawn` 22657 only team 0 | A third fighting team or a team colour choice touches about 100 lines of code. | P7-01, P7-03 | open |
| D-020 | Medium | Co-op runs missions only | `Net.startCoop` (called with `Net.missionId`, 25826) | There is no skirmish or training co-op session, so 2-4 team skirmish co-op (P7-05) needs a new session type. | P7-05 | open |
| D-021 | Informational | File size figures | section 2 of this file | The 2,392,277 bytes in section 2 are the repository (LF) size; the Windows working copy is 2,426,226 bytes (CRLF). | - | open |
| D-022 | Informational | Objective structures can already be cycled as targets | `Platform.cycleTarget` 14596 (adds `W.structs` with `objective`); `validTarget` 14580 | Code only, not tested in play. Missile locks on structures refuse `lock: 'air'` weapons (`lockFit` 14625). Input for P5-04. | P5-04 | fixed (P5-04: Appendix C; the lock never completed on a structure, `sightTo`) |
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

### P2 re-run (2026-10-29, build after P2-01 to P2-06)

Same scripts as Phase 1 (`%TEMP%\claude\ih\`: spawn sweep `sweep.mjs`, AI ship runs `navalai3.mjs`, AI land runs `routes3.mjs`, ground audit `routes2.mjs audit`), 1408 spawn rows, 57 ship runs, 103 land runs (14 P1-06 places x 2, 75 random). The old build was run again with the same scripts on the same pairs where it could be.

| Audit | Before | After |
|---|---|---|
| Spawn sweep, aircraft scenarios failing (under 800 m to the bound ahead): missions and co-op | 8 (m2, m10, m13, m17 each in missions and co-op) | 0 |
| Aircraft rows with a heading outward or along the bound (inward cosine under 0) / under 400 m from the bound | 39 / 6 | 6 (m-scenarios where every inward heading is in a hostile's sight: D58 wins) / 0 |
| Guest aircraft under 800 m ahead | 42 of 153 | 0 |
| Land start rows that cannot move or sit in water | 0 | 0 (and 0 of 51 mission land starts moved) |
| Ship rows with the nearest objective over 500 m: skirmish / missions / training | 25 / 3 / 0 (farthest 927 m) | 12 / 3 / 0 (farthest 586 m in skirmish, 873 m in m15) |
| Skirmish ship rows with ship water over 450 m from the nearest base | 7 | 0 |
| Ship rows under 200 m from the bound | 7 | 0 |
| Co-op guest ships: farthest from the host ship | 292 m | 112 m |
| Respawns (all kinds) a hostile sees | 2 (m12 pond) | 3 (m12 pond, now the Skua too); watched harbour: self-test with 4 tanks parked on the water 90 m from it among the skirmish's own hostiles, on coast (Trident) and jungle (Lancer): unseen, inside the harbour's sheet, under 60 ms (coast's only unseen deep water lies 34 m from the bound) |
| Ship rows failing the old thresholds (over 500 m, or no water within 150 m of an objective) | 59 of 114 | 54 of 114 (physical or by design: see P2-02) |
| AI land runs, 103: reached / drowned / waded 11 s+ / stuck on a bank or a tree / slow / waiting on a shore across water | 69 / 6 / 5 / 6 / 17 / 0 | 88 / 0 / 0 / 1 (an alpine infantry run bound across a cliff the grid calls unreachable: it stands at the cliff, as before; not a P1-06 place) / 0 / 14 |
| AI ship runs, 57: still 20 s+ / aground / dead | 5 / 1 / 0 | 1 / 0 / 0 |
| P1-06 ground audit, cut-off skirmish spawns | archipelago x3 | 0 (m9, m10, m16 targets by design) |
| Self-test | 2651 / 2651, 73.5 s | 2711 / 2711, about 105 s (60 new checks; `selfTest('p2 ')` alone 25 s) |

Findings status: D-001 fixed (P2-02); D-002 improved (skirmish ships within 586 m of our base and in the enemy fleet's water; m15 and m17 are physical); D-003 fixed (a respawn ship comes back unseen in its harbour's own water); D-004 improved (harbours in big sheets first, ponds only where there is nothing else: alpine, m12); D-005 fixed; D-006 closed (by design, P2-01); D-007 kept; D-008 open; D-009 and D-010 fixed (P2-05); D-011 fixed (built ford); D-012 improved (P2-03: the metro gunboat patrols but stands about half the time).

Open after Phase 2: (1) tundra's Trident harbour is about 790 m from our base (its one lake); (2) canyon: on the 15 m grid a cliff band lies between the bases (the Phase 1 audit's 15 m centre sample found a pass); no ford can mend it and its units push straight on, as before; one canyon skirmish seed's layout changed (a linked pair was found); (3) the full-suite time rose about 31 s (73.5 to about 105 s; the new checks, 25 s of it the `p2` ones); (4) P2-03 stays open: the metro gunboat at 260,-85 patrols but stands about half the time; (5) an alpine infantry unit bound across a cliff the grid calls unreachable stands at the cliff (it pushes straight on, as before); (6) a land grid built anew after 12 destroyed structures costs 1 to 2.5 ms a row tick on a dense jungle (the cold first builds now happen at load: see "P2 - Cost and balance"); (7) an AI ship that creeps with its bow the wrong way now goes astern: a small change to ship AI behaviour in fights.
