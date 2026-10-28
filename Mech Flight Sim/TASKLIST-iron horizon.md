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

- [ ] P0-01 - Record the baseline: commit hash, file size, frame times per quality preset on 3 maps (one land, one sea, one mixed).
  Done when: recorded in Appendix C.
- [ ] P0-02 - Define the low-spec mobile test method (device class, target frame rate, test scenes, metrics).
  Done when: recorded in Appendix C.

## Phase 1 - Reproduce reported problems

- [ ] P1-01 - Spawn audit: for every playable platform kind (mech, infantry, ground, air, naval, artillery) on every map and in every context (each mission, skirmish, co-op host / guest, training, respawn), log the spawn point, distance to the nearest objective and to the map bounds, water depth for naval, and whether the platform can move. Known reports: naval spawning far from the objective; aircraft spawning close to the map bounds.
  Done when: Appendix D has a table of all spawns with failures marked.
- [ ] P1-02 - Naval stuck audit: list every map and water body (rivers included) where a naval platform can enter water shallower than its `draft` or get stuck on banks.
  Done when: Appendix D lists each place with map, coordinates and platform.
- [ ] P1-03 - General audit of features not working as intended in the areas this tasklist touches (spawns, naval movement, loadouts, teams, fauna, missions). Classify Critical, High, Medium, Low, Informational.
  Done when: Appendix D lists each finding with a fix task.
- [ ] P1-04 - Fauna not visible: reproduce on each map and quality preset. Suspects to check: draw distance against the camera height of aircraft and mechs, `faunaCap`, group placement far from where play happens, model scale, culling, the species list per map.
  Done when: the cause is recorded in Appendix D.
- [ ] P1-05 - Check what a loadout changes on each platform model today (weapons drawn, pods, launchers, utilities).
  Done when: Appendix C has a table per platform: loadout item -> visible change (yes / no).

## Phase 2 - Spawning and naval movement fixes

- [ ] P2-01 - DECIDE: spawn rules per platform kind: naval only in water deeper than draft plus margin and connected to the objective area by navigable water; aircraft at a minimum distance from `AIR_BOUND` / `GROUND_BOUND`, heading inward, at a safe altitude; ground and mechs on reachable, non-steep ground; maximum distance to the first objective per context.
  Done when: rules recorded in Appendix C.
- [ ] P2-02 - Implement the spawn rules in all spawn functions (mission start, respawn, co-op join, skirmish bases, training).
  Done when: the P1-01 audit re-run shows no failure.
- [ ] P2-03 - Navigable water: compute a navigation mask per platform draft (rivers, lakes, coast). DECIDE behaviour at shallow water (proposals: slow and stop with a warning before grounding, auto-reverse assist, AI path avoids it; hovercraft keep crossing land as today if that is the design).
  Done when: no naval platform gets permanently stuck in the P1-02 places; AI naval units route through navigable water only.
- [ ] P2-04 - Recovery fallback: if a platform is stuck for a set time, offer a "reposition" action to the nearest valid spawn.
  Done when: works for every platform kind and in co-op.

## Phase 3 - Fauna

- [ ] P3-01 - Fix the cause found in P1-04 so animals are visible during normal play on every map and quality preset.
  Done when: a live test sees animals on each map without searching for them.
- [ ] P3-02 - Check fauna placement and density against where the player plays (spawns, objectives, routes), within the performance budget.
  Done when: frame rate on low preset meets P0-02.

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

## Appendix D - Audit findings

(Filled by Phase 1 and P10-01. Columns: ID, severity, area, location, reproduction, fix task, status.)
