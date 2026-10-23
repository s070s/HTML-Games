# IRON HORIZON Living World - plan

_This file is the spec, not the status. Live state is kept in `living-world.ledger.md` next to it. To find an item, run `grep -n "^#### P<n>.<m> " living-world.plan.md` and read only that block. Both files are deleted when the program closes (owner rule)._

## 0. How to read this file

- **Game:** `Mech Flight Sim/IronHorizon.html`. It is a single-file WebGL 1 game with no assets or libraries.
  - Units are metres and Y points up. Forward is (sin yaw, cos yaw).
  - SelfTest is `__IH.selfTest()`. At the start of the program it ran 1301 checks, all green.
- **Branch:** `worktree-living-world` in the worktree `.claude/worktrees/living-world`. The base commit is `4948af7`.
  - Pushes go to `origin/main` with `git push origin HEAD:main`, and only after the phase gate in section 4.0 passes.
  - Merge `origin/main` in first, using the app's sync tool, because another session pushes ClassTimeKiller work to main.
- **Preview:** the dev server is `.claude/launch.json` → `games-living-world` on port 8766. This file is local to the worktree and is never committed.
- **Item IDs:** `P<phase>.<n>`. Decisions are numbered `D<n>`, and risks `R<n>`.

## 1. Supersessions

| Older rule | Superseded by | Where |
|---|---|---|
| The prompt suggested 7 phases (P1-P7) | 8 phases: missions get their own P7, and co-op, performance, review and cleanup move to P8 (D7, D13) | §4 |
| The prompt said "60 fps on Medium" was to be decided | 120 fps on High on this PC (D10) | §4.0, every item |
| Skirmish settings had fog and night checkboxes | Weather and Time selects; old saved configs are mapped (P1.5) | P1.5 |
| Push to main after each phase gate (program prompt) | Owner 2026-10-23: "Push after all is done and after my go": gates still run, but nothing is pushed until the program is finished and the owner says go (Breakpoint included) | §4.0 step 6 |
| Eject was air only and lost the platform | Every platform can exit; holding Use in the air ejects (D9, D31) | P4.4 |

## 2. Decisions

| # | Decision | Effect (IDs touched) |
|---|---|---|
| D1 | (owner 2026-10-22) Keep it one HTML file, with marked sections. | all |
| D2 | (owner) Flora means 30 plant species. Each map uses the species that suit its climate, arranged as forests, scrub and meadows. | P2.1 |
| D3 | (owner) Fauna means 30 species in total. Each map has its own biome mix, in herds and flocks. Animals are ambient, flee from danger and gib like infantry. | P2.2 |
| D4 | (owner) The hangar gains an "On foot" group with Infantry and Civilian. Choosing a platform starts you inside it. You can exit, walk, and enter any free vehicle. | P4.3, P4.4 |
| D5 | (owner) Infantry is armed and targeted. A civilian is unarmed (fists only) and ignored until they attack, enter a combat vehicle, or come within 60 m of an objective. | P4.3 |
| D6 | (owner) Traffic, flights and ships are local scenery for each player. Big events come from the host. | P6.* |
| D7 | (owner) The 10 new maps work in Skirmish, Training and co-op. Each also gets one mission (10 missions), and each mission gives one Arsenal unlock. | P2.3, P7.1 |
| D8 | (owner) On foot: fists always, plus one of knife, sword or HF katana chosen in the loadout. Mechs choose fists, sword or HF katana in their melee slot. All of them get new animations and are listed in the Arsenal. | P4.6 |
| D9 | (owner) The controls list is approved (6 points; see P4.1). | P4.1, P4.2 |
| D10 | (owner) The floor is 120 fps on High at 1080p on this PC. That means a synced frame time of 8.33 ms or less at p95 in the busiest bench scene. The baseline on 2026-10-22 was an average of 4.21 ms, p95 5.20 ms and max 25.9 ms (skirmish, large, ashfall, seed 11, High, 1920x1080). | §4.0, all |
| D11 | (owner) The plan and ledger live in `Mech Flight Sim/docs/` and are deleted at the end. | - |
| D12 | (owner) The strict deadline is 72 h of agent working time, split by phase: P1 8, P2 10, P3 6, P4 14, P5 8, P6 12, P7 8, P8 6. | §4 |
| D13 | (delegated) Missions are phase P7. Co-op, performance, review and cleanup are P8. | §4 |
| D14 | (delegated) Saves stay at `SAVE_VERSION` 1. All new keys are additive and filled by `sanitize`/`defaults`. The version is never bumped without a v1→v2 migration, because a mismatched version is discarded today. A frozen v1 save fixture must load in self-test after every phase. | P1.0, all |
| D15 | (delegated) Every phase that changes the wire format raises `NET_VERSION` by 1 (3 → 4 → ...). The value is recorded in the ledger. | P1.6, P3.3, P4.4, P5.*, P6.2 |
| D16 | (delegated) Ships get a new `kind:'naval'`. Artillery stays `kind:'ground'` with `style:'artillery'`. A human on foot uses the existing infantry style (`kind:'mech'`, `style:'infantry'`, like `ranger`). The civilian is a new def with the same style. | P4.3, P5.* |
| D17 | (delegated) The 3 existing maps keep identical terrain heights, because missions m1-m8 place things on them; a golden hash test enforces this. They gain weather, time of day, flora and fauna sets only. | P1.1-P1.3, P2.* |
| D18 | (delegated) All new procedural content uses seeded RNG, never `Math.random`, wherever the world must match between host and guest. A world-hash check is added to the co-op start. | all |
| D19 | (delegated) Every new system has quality caps and LOD, draws through instanced batches, and does no per-frame allocation (pools). | all |
| D20 | (delegated) Momentum damage uses kinetic energy (0.5·m·v², with mass from the platform's weight) against a per-material threshold. It extends `resolveWorld`. The existing wood speed damage becomes a special case of it. | P3.1 |
| D21 | (delegated) Weather states are clear, overcast, rain, storm, snow, fog and sandstorm. Time options are dawn, day, dusk, night and a cycle (24 game minutes per day). | P1.4, P1.5 |
| D22 | (delegated) The 10 hazards are wildfire, flood, avalanche, rockfall, lightning, tornado, sandstorm, earthquake, lava flow and toxic gas. | P3.3 |
| D23 | (delegated) The 10 maps are listed below, each with its signature hazard. | P2.3 |
| | | |
| | Map | Signature hazard |
| | Coastal city (harbour, sea) | flood |
| | Archipelago (ocean, islands) | storm, lightning |
| | River valley (river, bridges) | flood |
| | Alpine pass (mountains, snow) | avalanche |
| | Desert canyon | sandstorm, rockfall |
| | Jungle delta (dense flora, rain) | wildfire |
| | Volcanic island | lava flow, earthquake |
| | Tundra lake | avalanche, storm |
| | Megacity metro (skyscrapers, big airport) | earthquake, toxic gas |
| | Farmland plains | tornado, wildfire |
| D24 | (delegated) The naval platforms are a fast attack craft, a missile destroyer and an amphibious hovercraft. A hovercraft was chosen over a submarine because it needs no underwater rendering and works on both land and water. | P5.2 |
| D25 | (delegated) The artillery platforms are a tracked howitzer, a rocket truck and a mortar carrier. Each has a deploy mode on the stance key and an impact-predictor reticle. | P5.3 |
| D26 | (delegated) The 50 civilian vehicles are 36 road, 8 sea and 6 air. Road vehicles and boats can be entered anywhere; aircraft only when parked at an airport. On entry a scenery vehicle becomes a real Platform; in co-op the host spawns it. | P6.2 |
| D27 | (delegated) Airports do not stop aircraft from landing anywhere with the gear down; that behaviour stays. Landing and stopping on an airport apron repairs and rearms like a supply pad, and aircraft respawn at the airport. | P4.5 |
| D28 | (delegated) Exiting is free and leaves the platform parked and intact. The team is kept, and the AI never takes it over. Ejecting in the air still loses the platform; the stats behave as they do now. Dying on foot counts as a death. | P4.4 |
| D29 | (delegated) The society sim extends the existing `Civ` system. Professions are linked to building types, schedules follow the time of day, and first responders go to fires, collapses and casualties. | P6.5 |
| D30 | (delegated) Missions can now unlock weapon ids as well as superweapon ids. This is an additive change to `Save.data.unlocked`. | P7.1 |
| D32 | (delegated, P1.2; amended at the P1 review) `maxSlope` is a map field (default 32°). Infantry climb 40°, and a def may override the value. Slopes block uphill only, so a unit can never be trapped. Maps without a `mountains` spec (the 3 old maps) have no slope limit, so they keep their old movement (D17). | P1.2 |
| D33 | (delegated, P1.2) The site slope check runs only on maps with mountains, so old layouts are unchanged. Bases may sit on ≤12°, cities and districts on ≤8°, with 96 base placement tries. | P1.2, P2.3 |
| D34 | (delegated, P1.3) Water rules:<br>- Hovercraft ride over water.<br>- Infantry swim in water deeper than 1.2 m and never flood, while the AI treats that depth as blocked for soldiers.<br>- A flooded vehicle keeps 6% speed so it can back out.<br>- Drowning damage ignores shields and armour.<br>- Roads are a map field (`roads: [{pts, w}]`), and bridges are built from map data.<br>- Sites need a circle of radius + 70 m clear of water.<br>- Beams pass through water; projectiles splash.<br>- `TEST_WATER_MAP` has sea level -8. | P1.3, P2.3, P5 |
| D35 | (delegated, P1.4-1.6) Weather and time rules:<br>- Missions without `env` stay clear and day, with identical fog and light (tested).<br>- The cycle starts at 09:00 and runs 24 game minutes per day.<br>- Windows light gradually after mid-dusk.<br>- The HUD clock shows only in cycle mode.<br>- Guests derive weather and time from the mission time, seed and schedule (no new per-tick traffic).<br>- Storm flashes are seeded once per second; `Weather.onLightning` is the hook for P3.3.<br>- Precipitation checks cover for at most 120 particles per frame. | P1.4-1.6, P3.3 |
| D36 | (delegated, P1 review)<br>- No slope limit needs a map with neither mountains nor water; on such a map a def's `maxSlope` is ignored.<br>- `SITE_PAD` 15 m is used by every site check.<br>- Water maps get 320 skirmish layout tries.<br>- Banks are ≤ 0.75 × `maxSlope`, and beaches widen up to 400 m.<br>- `TIME_RELIGHT_BUDGET` is 2 buildings per frame.<br>- The fixed fallback layout ignores water. P2.3 must prove 0 fallbacks per new map over 1000 seeds, or make the fallback dry. | P1, P2.3 |
| D37 | (delegated, P2.1) Flora rules:<br>- Old maps get no new blocking trees. Their trees keep position, size and collision and only take a species look; they gain non-blocking bushes and cover, kept off mission sites.<br>- New trees are real tree structs on every quality level, with collision = 1.8 × trunk + 0.8 m, clamped to 1.4-5 m.<br>- Cover is local scenery, grown per 32 m cell from that cell's seed and drawn instanced within `coverR`.<br>- Near chunks bake 6000 vertices per frame; far plants are stand-ins.<br>- Without instancing, no cover is drawn. | P2.1, P2.3 |
| D38 | (delegated, IOS-1) iPhone Safari:<br>- Low and Medium get pixel caps of 0.8 and 1.6 MP (Medium shrinks on screens above 1080p).<br>- Tall menus start at the top on every device.<br>- The rotate overlay shows in battles only; menus in portrait show a one-line hint.<br>- `homeHintSeen` is an additive setting.<br>- Safe-area CSS variables plus `SafeArea` and `Device` helpers are the base for P4.2. | IOS-1, P4.2 |
| D39 | (delegated, P2.2) Fauna rules:<br>- Map field `fauna = { species, herds, flocks, schools, density }`, defaults `{ null, 8, 5, 6, 1 }`; `species: null` = every species tagged with the map's biome. No deep water = no schools.<br>- Caps Low/Medium/High: share 0.5/0.75/1, draw 260/380/520 m, simple model past 70/110/150 m, max 32/64/100 animals; quality changes group sizes only, never positions.<br>- Old maps get animals; animals block nothing and change no golden or world hash.<br>- Ground machines faster than the civilian crush speed kill animals; soldiers shove them.<br>- Groups beyond 600 m update every 4th tick and ignore machines.<br>- Birds keep 2.5 m above ground or water but do not steer around buildings or trees.<br>- Seals and crocodiles are ground animals that float; penguins and flamingos walk on two legs; a fish school is one animal drawn as several fish.<br>- Day species sleep and day birds roost when `Clock.look.night` > 0.5.<br>- Movement may use `Math.random` (local, D6); placement is seeded. | P2.2 |
| D40 | (delegated, IOS-1 review) A pen enables touch controls only on iOS (Apple Pencil). The rotate pause is for phones only (screen short side under 600 CSS px; 0 = unknown = not a phone), with co-op wording. An edge-clamped stick rests under the finger. The resolution drop starts from the scale in use. | IOS-1 |
| D41 | (delegated, P2.3-P2.4)<br>- Maps may carry `lift` and an `open` water type (sea all round, shores capped near 27°); sand colour is opt-in per map.<br>- `SCENERY` entries may list towns (villages with farmyards, districts, a mega-city), placed by missions and skirmish alike.<br>- When all 320 seeded tries fail, skirmish scans 72 opposite spots on the base ring before the fixed layout (0 fallbacks over 1000 seeds on every new map).<br>- Rivers end near ±760 m. Water under 5 cm at the waterline counts as dry. The existing `lanes` field is P6's sea lanes; `airport` stays empty until P4.5.<br>- The skirmish setup saves on every change.<br>- The co-op lobby chooses missions, so it names each mission's map and biome; co-op play on the new maps arrives with their missions in P7.1 (no co-op skirmish, no NET_VERSION change in P2).<br>- Training has no map choice today; per D7 a Training map choice (with targets placed per map) is added in P7.1. | P2.3, P2.4, P7.1 |
| D42 | (delegated, P2 review fixes; amends D37, D39, D41)<br>- Every tree species has a far stand-in. Full-detail flora is capped by `QUALITY.floraVerts` 75k/115k/140k, nearest chunks first, with a bias to last frame's set; farther chunks keep stand-ins and are not built. The cap applies only to maps with blocking new flora, so the 3 old maps draw as before (tested over several seeds and missions m1-m8).<br>- Cover cells beyond 2 × `coverR` are released (16 checked per frame, 64 pooled) and regrow identically.<br>- Grass, flowers and reeds bend under the 8 nearest ground units (local only); bushes do not, being part of the merged chunk meshes.<br>- `QUALITY.faunaSim` 48/96/150 caps animals placed and simulated: each group keeps its first members, then trailing groups drop; no group moves.<br>- A `SCENERY` city may set `kind: 'mega'`; metro uses it. | P2.1-P2.3 |
| D43 | (delegated, P3.1) Momentum collisions:<br>- Unit mass in tonnes = 8 × weight class²; soldiers 0.12 t.<br>- Material energy floor / kJ per hit point: wood 190/1, tree 190/2, brick 8000/50, concrete 8000/25, steel 8000/30.<br>- Wood and trees use full speed, other materials the speed into the surface; below 7 m/s nothing breaks.<br>- The hull takes damage only past 3000 kJ. Indestructible structures and rock are skipped. A new `ram` damage type ignores the per-material weapon multipliers. | P3.1 |
| D44 | (delegated, P3.2) Collapse debris:<br>- At most 240 falling chunks (fixed, not by quality, so host damage is the same everywhere); beyond the cap pieces turn straight into rubble.<br>- A chunk does 0.6 × tonnes × impact speed, from 6 m/s, once.<br>- Buildings of 8+ floors topple toward the walls they lost (fixed fallback direction), with a capped tilt.<br>- Rubble on a 4 m grid: ≤ 900 cells, ≤ 2.2 m high, halves ground speed from 1.2 m, hovercraft exempt; it slows and never lifts.<br>- A fallen piece is state 2 in the existing `st` structure update (NET_VERSION stays 4). Guests drop their own visual chunks and hurt only local civilians and animals. | P3.2 |
| D45 | (delegated, P3.3) Hazards:<br>- Skirmish option off/low/normal, default low. Low: first after 150 s, then every 240-420 s, at most 1 at a time. Normal: 70 s, every 110-200 s, at most 2.<br>- Old maps: ashfall sandstorm + wildfire, verdant wildfire + lightning, frost avalanche. Missions get none unless their def asks (default level normal).<br>- An explosion of radius ≥ 7 may start one by seeded chance, ≥ 40 s apart; storm flashes strike as lightning (share 0.35 low, 0.7 normal).<br>- One flood at a time, raising water inside a circle. Trees char and stay standing. Objectives and indestructibles take no hazard damage.<br>- `hz` state 4 = a strike (r = blast radius, level = struck height); otherwise level is per hazard (flood surface, lava cells, fire fuel, quake strength). NET_VERSION 5.<br>- Test aids: `Hazards.force`, a spot finder per hazard; `__IH.selfTest(name)` runs matching blocks only. | P3.3 |
| D46 | (delegated, P3 review fixes; amends D43, D45)<br>- Lightning never strikes aircraft more than 240 m above the ground. An aimed strike picks the same unit again only after 20 s. One strike takes at most 30% of a unit's hull and all lightning in a battle at most 40%, so a storm alone never kills a full-health unit.<br>- Floods raise water only while active and above the source level.<br>- Hazard sites are rounded on the host before building; rockfall `hz` carries boulder states in optional `p`; guests drop a silent hazard after 20 s (frozen while the host is stalled) and resume it silently.<br>- A scheduled gas leak needs a chemical plant or fuel source.<br>- Objective structures take no ram damage; convoy units and their escorts take no hull damage from what they break.<br>- Collapse deaths show "Collapse"; tower fall direction and height come from the host in `st`. | P3.1-P3.3 |
| D47 | (delegated, P4.1, P4.3, P4.4)<br>- Ejecting loses the platform as before (death, life, withdrawal); the pilot carries on on foot under a parachute, and the replacement arrives once they land and the redeploy timer runs. The pilot dying adds no second death; entering a vehicle cancels the replacement.<br>- A parked platform keeps its team and can be shot; stepping out stops it dead. A neutral (team 2) vehicle joins whoever enters (the P6 hook); enemy vehicles cannot be entered.<br>- Keys 1 and 2 are fixed weapon shortcuts unless bound to an action.<br>- Auto gear is for human pilots only and acts only when its wish changes, so a manual choice holds until then. Radar focus turns on when the target is within 0.7 rad of the nose.<br>- A provoked civilian stays provoked; hitting an objective counts; objectives that hunt units are skipped by the 60 m rule; civilians have no superweapon.<br>- Training replaces Tab switching with a parked row of every playable vehicle behind the start; a destroyed one returns after 4 s.<br>- In co-op, a player who climbs in disappears for other guests after the existing 0.8 s timeout. NET_VERSION 6 (`ctl`, `sp.driver`). | P4.1, P4.3, P4.4 |
| D48 | (delegated, P4.5, P4.6)<br>- The 3 old maps get no airfield (no naturally flat site), so m1-m8 keep their ground; archipelago gets none (islands too small); alpine gets a strip in about 1 battle in 10; metro gets the big airport.<br>- Skirmish lays bases and towns around a home airfield (up to 8 candidates); if none fits, the layout runs without one and an airfield is added afterwards. Missions place it after their towns. Roads stop at the airfield edge. Canyon gets fewer districts (about 0.4 per battle, was 2.0).<br>- On foot, a blade replaces the fists; a civilian always uses fists. The katana kills soldiers and light ground vehicles (mass ≤ 1.5, movable) outright.<br>- In co-op, a guest who steps out fights with fists (the guest's saved loadout describes the vehicle). NET_VERSION 7. | P4.5, P4.6 |
| D49 | (delegated, P4.2) Touch layout:<br>- A hidden button keeps its place and sizes are fitted with every button counted, so buttons never move under the thumb; only the HUD reserve follows the visible set.<br>- The radar counts as taken space; USE sits above TGT.<br>- No dead buttons: jump hides without a jump pack; Melee and Crouch hide under a parachute; FIRE, ALT, RLD, WPN, TGT, DEF and SUPER need what they act on.<br>- `touchScale` 0.8-1.4 (default 1), additive, in Settings > Display on touch screens only.<br>- Unit = 13.5% of the short side, 44-72 px, × scale, shrunk until everything fits. The move stick keeps 56 px. | P4.2 |
| D50 | (delegated, P5.1, P5.2) Ships:<br>- Skua is a new amphibious naval hovercraft; Specter stays a ground vehicle, so saves, loadouts and missions stay valid. The other ships are Lancer (fast attack craft) and Trident (missile destroyer).<br>- Ships are allowed on maps with a sea, an open sea, or a lake/river ≥ 4.5 m deep: coast, archipelago, jungle, volcano, alpine, tundra, metro (not ashfall, verdant, frost, valley, canyon, farmland). Dry maps: hangar cards disabled with a reason, launch refused, co-op refused per mission map, a direct start falls back to the Bulwark.<br>- Harbour = the nearest open water to the start by a fixed ring search, with keel clearance plus 40 m open water round the hull.<br>- Torpedoes run 0.8 m under the surface, die below 1.5 m depth, pass under hovercraft.<br>- Skirmish fleet: small 1 gunboat; medium + destroyer; large + hovercraft assault craft; scaled like other groups; not part of a wave. Ships patrol a loop of up to 6 points round their home until P6 adds sea lanes. No dock structs yet (normal world collision).<br>- At most 6 sinking wrecks, 16 s each; a ship killed in water under 2 m breaks up like a vehicle. Wake flag bit 4096; NET_VERSION 8 (weapon list order changed). | P5.1, P5.2, P6 |
| D51 | (delegated, P5.3) Artillery (Thunder SPH-1 howitzer, Hailstorm MRL-6 rocket truck, Pestle MC-2 mortar carrier):<br>- Spotting needs a non-artillery platform of the same side within its sight (≤ 600 m) with a clear line; a battery never fires on what only it sees or on whoever shot it.<br>- Host draws warning markers for enemy (team 1) shells only; guests mark any indirect shell not from their side.<br>- The arc switch is on the melee key and shows only where both arcs reach; the mortar is always high arc.<br>- A deployed gun cannot drive (touch hides BRAKE and BOOST). Howitzer elevation −0.1 to 1.35.<br>- Enemy batteries are garrison units 70 m behind the enemy base: a mortar on small maps, + howitzer on medium, + rockets on large; they may shell base turrets and parked vehicles.<br>- The predictor ignores structures and lands on ground or water under the aim point. NET_VERSION 9. | P5.3 |
| D52 | (delegated, P5 review fixes; amends D50, D51)<br>- A human's indirect fire does full damage to objective structures only where a friendly spotter (D51 rule; civilians and AI-ignored units do not spot) sees the aim point, else ×0.15, and unspotted damage to each objective is capped at 25% of its max hp per battle.<br>- The P5 water-scene cost (+0 to +0.4 ms p95 in noisy rounds; direct timing 0.05-0.1 ms per tick) is accepted by the gate review; a 0.7 ms single-tick battery search is accepted. Guns refuse to fire with no ground under the aim. AI batteries skip arcs through their own side's buildings.<br>- Ships are hit, blasted and pushed as an oriented hull box; the shore check probes bow and stern.<br>- The hangar offers a ship only where that ship can sail on the map (checked once per map and ship); the harbour is the nearest such water anywhere on the map with 40 m room, else 4 m; a fallback says so. Metro: no Trident.<br>- The enemy fleet starts ≥ 700 m from the player's base, start and harbour, or is skipped; one ship of each type up to Low 1 / Medium 2 / High 3.<br>- A ship on dry land for 2 s is towed to water within 200 m, else its harbour; AI ships plan in the map's own water.<br>- The player's harbour resupplies ships; a wreck pushes ships while afloat.<br>- Effects beyond 260/380/500 m (by quality) use lighter particles; no wakes there. | P5.1-P5.3 |
| D53 | (delegated, P6.2, P6.1)<br>- Each `VEHICLES` row becomes an unarmed civilian platform `cv_<id>` of its kind (road → ground, sea → naval, air → air); toughness from weight. Civilian aircraft can be taken only on an airfield.<br>- Parked and traffic vehicles are local scenery, the same on every game from the seed. A guest asks with `enterCiv`; each game removes its own copy by position (`claim`). NET_VERSION 10.<br>- Lanes: keep right; lanes stop 8 m short of a junction; one car at a time holds a junction; a road crossing is always a junction of both roads; long vehicles' tails block.<br>- Parked cars are obstacles civilians walk round. Lost, stuck or far cars respawn on a lane 60-450 m from the camera, out of view.<br>- Town streets get 3× the cars per metre of open roads. Boats moor at the water nearest each town (≤ 900 m). | P6.1, P6.2 |
| D54 | (delegated, P6.3, P6.4)<br>- Flights and ships are local scenery (D6). A broken-up airliner's chunks hurt platforms only in solo; in co-op they hurt only that game's civilians, animals and traffic and leave no rubble. A player's explosive shot goes off on an airliner only in solo.<br>- An airliner can be taken only at its gate; an airfield's aircraft take turns; maps without an airfield get crossings at altitude.<br>- Container ships and tankers can never be taken; the ferry, fishing boat and sailboat follow D26 (taken when slow or berthed).<br>- Ships stop for units in their way and sail through after 20 s stopped (for 10 s). A unit of ≥ half a ship's weight running into it sinks it; a lighter one at ≥ 3 m/s damages it.<br>- Ship routes are planned from the High list; each quality sails the first `QUALITY.ships`. NET_VERSION stays 10. | P6.3, P6.4 |
| D55 | (delegated, P6.5) Society:<br>- Police station, fire station, hospital and school are picked by hash from existing building types (no new models).<br>- The daily schedule runs only when the time of day runs; fixed-time missions keep the old routine (D35).<br>- Caps Low/Medium/High: 2/3/4 responder vehicles, 3/6/10 commuter cars. Commuters drive their parked cars; unseen long walks are skipped.<br>- Responders are local scenery; they route over each road network, skip junction stop lines, and run when shot at. | P6.5 |
| D56 | (owner 19:46: "Finish this faster without regressing or losing effectiveness") Independent work runs in parallel: P7 is split into two worktrees (m9-m13 with the Training map choice; m14-m18 with the Metro fix) and starts while P6's last fix round finishes. Every phase gate, review and verification stays. | P6, P7 |
| D31 | (delegated) Use (E) means: tap to enter, resupply or pick up; hold for 0.4 s to exit; hold in the air above 25 m to eject with a parachute. | P4.1, P4.4 |

## 3. Reconciliation map

Counts were re-derived on 2026-10-22 with `rg -n -i "known gap|still open|not done|deferred|TODO|FIXME" IronHorizon.html`. It returned 0 prose-only open items; the only matches were the `toDoor` method names. There is no previous program left over.

| Source | ID / text | Disposition |
|---|---|---|
| Prompt feature 1 | Momentum collisions destroy structures by weight | P3.1 |
| Prompt feature 2 | Collapse debris damages whoever it lands on | P3.2 |
| Prompt feature 3 | Water bodies (sea, lake, ocean, river) | P1.3 |
| Prompt feature 4 | Mountains, elevation | P1.2 |
| Prompt feature 5 | 30 flora | P2.1 |
| Prompt feature 6 | 30 fauna | P2.2 |
| Prompt feature 7 | 10 maps | P1.1, P2.3, P2.4, P7.1 |
| Prompt feature 8 | Traffic, flights, marine traffic | P6.1, P6.3, P6.4 |
| Prompt feature 9 | Exit or eject from all platforms, airports and strips | P4.4, P4.5 |
| Prompt feature 10 | 50 civilian vehicles | P6.2 |
| Prompt feature 11 | Society sim, routines, professions | P6.5 |
| Prompt feature 12 | Play as a human (civilian or infantry) and use other vehicles | P4.3, P4.4, P6.2 |
| Prompt feature 13 | 3 naval platforms | P5.1, P5.2 |
| Prompt feature 14 | 3 artillery platforms | P5.3 |
| Prompt feature 15 | Melee animations (sword, HF katana, fists, knife) | P4.6 |
| Prompt feature 16 | Controls rework and touch layout | P4.1, P4.2 |
| Prompt feature 17 | Weather, time of day | P1.4, P1.5 |
| Prompt feature 18 | 10 hazards | P3.3 |
| Prompt rule | Measure performance per phase | P1.0 + gate §4.0 |
| Prompt rule | Co-op per system, `NET_VERSION` | D15, each item's Co-op line, P8.1 |
| Prompt rule | Old saves load | D14, P1.0 fixture |
| Prompt rule | Self-test checks for everything | each item's Red test |
| Prompt rule | Live test in the pane | gate §4.0 |
| Prompt rule | Opus + high review before each phase is done | gate §4.0 |
| Prompt rule | Remove the plan and ledger at the end | P8.4 |
| Owner answer | 10 missions plus unlocks | P7.1 |

## 4. Phases

### 4.0 Phase gate (every phase, in order)

1. Self-test is all green, and the check count is recorded. No new console errors or warnings appear in a full live run.
2. Bench: `__IH.bench()` on every bench scene stays at p95 ≤ 8.33 ms and max ≤ 33 ms (High, 1920x1080), and the phase stays within its allowance.
   - Allowances on the p95 (baseline 5.20): P1 +0.6, P2 +0.8, P3 +0.2, P4 +0.2, P5 +0.2, P6 +0.8, P7 0, P8 optimise to ≤ 7.8 ms.
3. Live test in the browser pane: every item's acceptance lines are played by hand (mouse/keyboard, plus touch emulation at 375x812 from P4 on), with screenshots.
4. Old saves: the frozen v1 save fixture loads, settings and bindings survive, and missions m1-m8 start.
5. Independent review by an Opus + high agent of the phase diff. Every finding is fixed or recorded as a D-row.
6. Commit, merge `origin/main` with the sync tool, run self-test again, push with `git push origin HEAD:main`, and write a ledger entry.

### 4.1 Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | 120 fps leaves about 3.1 ms for everything new. | Per-phase allowances, instancing, LOD, quality caps (D19), and a bench at every gate. The pane may vsync below 120 Hz, so frame time is measured synced (readPixels), not through the rAF fps. |
| R2 | The file roughly doubles to ~30k lines. | Marked sections, constant tables at the top of each section, and small helpers that reuse existing ones. |
| R3 | Missions m1-m8 break if the old maps' terrain changes. | Golden height hash for ashfall, verdant and frost (D17). |
| R4 | Co-op worlds diverge. | Seeded RNG (D18), a world-hash check in `start`, and two-tab tests in P8.1. |
| R5 | `kind` branches miss the new naval kind (`kind === 'air'` appears 107 times). | P5.1 audits every `kind ===` site, and a self-test steps every kind through every system. |
| R6 | Save wipe. | D14; never bump `SAVE_VERSION` without a migration. |
| R7 | The other session pushes to main. | Merge `origin/main` before each push. It works in a different folder, so conflicts should be rare. |
| R8 | GC hitches (one 25.9 ms spike at baseline). | Pools; no new arrays or objects per frame in new systems. Max-frame budget of 33 ms. |
| R9 | Content volume (30 + 30 + 50 + 10 maps + 10 missions) against 72 h. | Recipe tables built from shared part primitives, so each species or vehicle is one data row plus a few parts, not custom code. |
| R10 | New terrain, water and mountains break site flattening, city and base placement. | Placement validators (dry land, slope, clearance) tested on 3 seeds per map. |
| R11 | Self-test gets slow. | New checks use short tick windows. Record the total self-test time at each gate. |

### P1 Terrain, water, weather, map framework (8 h)

#### P1.0 Bench, save fixture, golden terrain
- **Goal:** set up the measuring tools the gates depend on.
  - `__IH.bench(scenes?)` reports avg, p95 and max for a synced frame (tick + camera + render + 1-pixel readPixels) per scene.
  - A frozen v1 save fixture.
  - Golden height hashes for the 3 existing maps.
- **Files:** the SelfTest section and the `__IH` export.
- **Red test:** the fixture loads with its settings and bindings intact. The golden hash matches 400 sample points per old map. A tiny bench run returns finite numbers.
- **Conflicts/waits:** none.
- **Acceptance:** the baseline bench table is written to the ledger.

#### P1.1 Map framework
- **Goal:** add map fields `biome`, `water`, `mountains`, `flora`, `fauna`, `weather`, `hazards`, `airport` and `lanes`.
  - `mapDef(id)` fills defaults, so all code reads one shape.
  - The skirmish and lobby map lists are driven by `MAPS`.
  - A `SCENERY` default is used when a map has none.
- **Files:** `MAPS`, `SCENERY`, `Terrain.build`, the skirmish UI, the co-op lobby.
- **Red test:** every map resolves to a full def. The old maps still match their golden hash.
- **Co-op:** the map id is already in `cfg`.
- **Acceptance:** an extra placeholder map can be added with only a data row, and it starts in skirmish.

#### P1.2 Mountains and elevation
- **Goal:** per-map ridged mountain ranges and plateaus, with a height floor (sea bed).
  - `Terrain.slope(x,z)` is added. Slope and altitude colour the ground (rock, snow).
  - Ground units cannot climb more than `def.maxSlope` (default 32°). They slide or stop, and `steerAround` treats steep slopes as blocked.
  - Mechs can jump up ledges. Infantry climb up to 40°.
  - "PULL UP" and the radar altitude keep working.
- **Files:** `Terrain`, the ground stepper, `steerAround`, the terrain colour shader.
- **Red test:**
  - A tank driven at a 45° slope makes no progress, while a 20° slope is climbable.
  - The height matches between two builds with the same seed.
  - The old maps match their golden hash.
- **Edge cases:** sites and bases need flattening on mountain maps (validator from R10). Cities never sit on slopes above 8°.
- **Perf:** the terrain mesh count is unchanged, and no per-frame cost is added.
- **Acceptance:** a test map with a range is visible, drivable around, and flyable over.

#### P1.3 Water bodies
- **Goal:** a `Water` system with bodies of four types: sea and ocean (a map side below sea level), lakes (basins), and rivers (polylines carved into the terrain, with flow).
  - Functions: `Water.level(x,z)`, `Water.depth(x,z)`, `Water.at(x,z)`.
  - Rendering: one animated, translucent surface per chunk, shore foam, an underwater tint, and splash FX.
  - Physics:
    - Ground vehicles ford up to `def.ford` (default 1.2 m); deeper water stalls them and they take drowning damage over time.
    - Mechs wade slower, and water deeper than their hip height damages them.
    - Infantry and civilians swim slowly and cannot fire while swimming.
    - Aircraft hitting water are destroyed.
    - Projectiles hitting water splash, leave no crater and do reduced splash damage.
    - Debris and gibs sink.
    - Civilians and fauna avoid water. Roads cross rivers on bridges, which are destructible structs.
- **Files:** a new `Water` section, `Terrain.build` (carving), `drawWorld`, the steppers, `updateProjectiles`, `explode`, debris, `Civ.blocked`, and the `Scenery` roads.
- **Red test:**
  - Depth matches the expected values at sample points.
  - A tank in deep water stalls and takes damage.
  - A shell hitting water splashes with no crater.
  - Bridges exist where roads cross rivers.
  - The old maps have no water and match their golden hash.
- **Co-op:** deterministic from the map. A bridge destroyed on the host reaches guests through the existing `st` message.
- **Perf:** at most 1 draw per visible water chunk, plus +0.3 ms.
- **Acceptance:** a test lake, river and sea are each seen, driven into, swum in, and shot at.

#### P1.4 Weather
- **Goal:** the states clear, overcast, rain, storm, snow, fog and sandstorm (D21).
  - Instanced particles around the camera (streaks or flakes, capped by quality).
  - Sky, fog and light come through `R.setEnv`.
  - AI sight factors reuse the pattern of `FOG_SIGHT`.
  - Rain and snow reduce ground traction. A light wind drifts aircraft and smoke.
  - Weather changes over time when the option is on; storm lightning is added in P3.3.
- **Files:** `R.setEnv`, a new `Weather` section, FX, the AI sight code, the ground stepper.
- **Red test:** each state sets the expected fog density, AI sight factor and traction. Transitions go smoothly with no jump in fog density.
- **Co-op:** the weather seed and schedule travel in `cfg`. The current state is derived from the shared time in `ob`.
- **Perf:** particles take at most 2 draws and +0.2 ms.
- **Acceptance:** each state is seen in the pane and is readable at 120 fps.

#### P1.5 Time of day
- **Goal:** the sun angle follows the hour, and dawn, day, dusk and night are ramps built from each map's palette.
  - Night uses the existing night lights and window glow. The cycle option runs 24 game minutes per day.
  - Skirmish replaces the fog and night checkboxes with Weather and Time selects. Missions keep their own settings unless they specify otherwise.
- **Files:** `R.setEnv`, the skirmish UI and config, `SKIRMISH_DEFAULT`, `Save.sanitize`.
- **Red test:**
  - A saved skirmish config with `night:true, fog:true` loads as time night and weather fog.
  - The sun height at noon is greater than at dusk.
  - The cycle wraps from 24 to 0.
- **Co-op:** the time comes from the host through the existing `ob` time.
- **Acceptance:** a full day cycle is watched at 10x speed in the pane.

#### P1.6 P1 co-op and net glue
- **Goal:** weather, time and the world hash are added to `start`, and the guest leaves on a hash mismatch, just as it does for `ns` now. `NET_VERSION` goes to 4.
- **Red test:** two builds with the same seed produce the same world hash. A changed seed produces a different hash.
- **Acceptance:** a two-tab co-op start on a test map works.

### P2 Flora, fauna, 10 maps (10 h)

#### P2.1 Flora: 30 species
- **Goal:** a `FLORA` table of 30 species, each a part recipe with colour variance and biome tags.
  - Kinds: oak, birch, pine, snowy pine, spruce, palm, coconut palm, baobab, acacia, willow, cypress, redwood, bamboo, dead tree, burnt tree, jungle giant, mangrove, cactus saguaro, cactus prickly, joshua tree, shrub, berry bush, fern, tall grass, reeds, wildflowers, lavender, mushrooms, tundra moss, kelp (in water).
  - A density noise mask makes forests, groves, scrub and meadows. Plants avoid roads, buildings, bases, water (except reeds and kelp) and steep rock.
  - LOD: near plants are merged meshes per chunk (reusing `Chunks`). Far plants are cheap cones or impostors. Grass is instanced near the camera only. Quality caps the numbers.
  - Large trunks block ground units (circle in the hash) and break under momentum (P3.1). Bushes and grass bend or flatten under platforms.
- **Files:** the vegetation section, `Chunks`, `Hash`, the ground stepper.
- **Red test:**
  - All 30 species build without errors.
  - No plant sits inside a building, road, base or deep water.
  - The per-chunk count respects the quality cap.
  - The old maps keep the same tree layout unless flagged (a separate seed stream).
- **Co-op:** deterministic. Flattened grass is local only.
- **Perf:** +0.5 ms on the jungle map.
- **Acceptance:** a forest, a meadow and a desert are each seen, driven through and flown over.

#### P2.2 Fauna: 30 species
- **Goal:** a `FAUNA` table of 30 species, each with a part recipe, size, speed, group size, biome, and type (ground, air or water).
  - Species: deer, elk, reindeer, boar, wolf, fox, bear, polar bear, rabbit, cow, horse, sheep, goat, camel, crocodile, monkey, penguin, seal, flamingo, seagull, crow, eagle, vulture, parrot, duck, pigeon, fish school, dolphin, whale, lizard.
  - Herds graze and wander, and flee using the hearing of `Civ.alarm`. Birds fly in light boid flocks above the terrain. Fish and dolphins stay in water.
  - They gib in species colours, reusing the gib path.
- **Files:** a new `Fauna` section (patterned on `Civ`), the draw passes.
- **Red test:**
  - Each species draws.
  - A herd flees from an explosion.
  - Birds stay above the terrain, and fish stay inside water.
  - A kill produces gibs.
  - The counts respect the quality caps.
- **Co-op:** local (D6).
- **Perf:** +0.3 ms.
- **Acceptance:** each biome's mix is seen in the pane.

#### P2.3 10 new maps
- **Goal:** add the 10 maps from D23, each with its biome, terrain recipe, water, mountains, flora and fauna sets, weather table, towns and cities (a `SCENERY` entry), and slots for an airport, hazards and sea lanes that later phases fill.
- **Files:** `MAPS`, `SCENERY`, `skirmishLayout`.
- **Red test:** for every new map on 3 seeds:
  - Both bases are on dry land with slope ≤ 8°.
  - No building sits in water.
  - The session starts, and the player is not inside geometry.
  - Bridges exist on river crossings.
- **Acceptance:** each map is played in skirmish for 2 minutes in the pane with no errors.

#### P2.4 Map choice UI
- **Goal:** the skirmish and co-op lobby show all 13 maps with their name, biome and description, and the saved choice survives.
- **Red test:** a saved skirmish map id that is unknown falls back to `ashfall`.
- **Acceptance:** every map can be picked, and its choice is remembered.

### P3 Destruction and hazards (6 h)

#### P3.1 Momentum collisions
- **Goal:** kinetic energy (0.5·m·v²) against per-material thresholds (wood, brick, concrete, steel, tree) breaks pieces, props and trees in proportion to the energy (D20).
  - The platform loses speed and takes damage from the energy left over.
  - Slow pushes do nothing. Aircraft crash rules are unchanged.
- **Files:** `resolveWorld`, `Bld`, the vegetation code.
- **Red test:**
  - A boosting heavy mech breaks a brick wall.
  - Infantry at full sprint does not.
  - A lighter vehicle at the same speed breaks fewer pieces.
  - A wood fence still breaks as it does now.
- **Co-op:** host only. Results reach guests through `st`.
- **Acceptance:** a heavy mech rams a house, a tank rams a fence, and a jet hits a tower.

#### P3.2 Collapse debris damage
- **Goal:** collapsing pieces become falling physical chunks (pooled debris with a `hurt` mass).
  - Damage is mass times impact speed, on platforms, infantry, civilians and fauna.
  - Tall towers topple in one direction and leave a debris field.
  - Rubble mounds become low collision that slows ground units.
  - `crush()` gets damage based on the falling chunks.
- **Files:** `Bld` collapse, debris, `crush`, `Civ.hurt`, `Fauna`.
- **Red test:**
  - A tower collapse kills infantry below and damages a mech below.
  - A unit 60 m away takes no damage.
  - Rubble slows a tank.
- **Co-op:** host damage only. Guests see the visuals through `st` and `x`.
- **Acceptance:** a skyscraper is brought down onto units in the pane.

#### P3.3 10 hazards
- **Goal:** a `HAZARDS` table (D22). Each hazard has a trigger (schedule, weather, or explosion), a warning (HUD alert and sound), an effect zone, and an end.
  - Wildfire spreads over flora and wood.
  - Flood raises a river or the sea level in low areas.
  - Avalanche and rockfall slide down slopes.
  - Lightning comes with storms.
  - Tornado is a moving vortex that throws light units and debris.
  - Sandstorm lowers sight and wears aircraft.
  - Earthquake shakes the world and collapses weak buildings.
  - Lava flow uses path cells.
  - Toxic gas comes from a chemical plant leak.
  - Skirmish gets a Hazards option: off, low or normal. Each map lists its hazards.
- **Files:** a new `Hazards` section, the HUD alerts, Snd, the `Weather` link.
- **Red test:** each hazard, forced by a test hook:
  - damages a dummy inside its zone and not outside;
  - ends within its duration;
  - is disabled by the "off" option.
- **Co-op:** host authoritative, with a new message `hz` {id, type, state, x, z, r, level}. `NET_VERSION` +1.
- **Perf:** +0.2 ms with one hazard active.
- **Acceptance:** each hazard is seen on its signature map.

### P4 Controls, on foot, enter/exit/eject, airports, melee (14 h)

#### P4.1 Controls rework (D9, D31)
- **Goal:**
  1. Weapon 1 and Weapon 2 become one "Switch weapon" action (`switchWeapon`, default `KeyZ`, D-pad left). The keys 1 and 2 and the mouse wheel become fixed direct shortcuts.
  2. The eject key is removed; holding Use exits, and holding it in the air ejects.
  3. Switch platform (Tab) is removed; you walk to vehicles and enter them.
  4. The gear key is removed. Gear is automatic near the ground, the air Stance key toggles it by hand, and radar wide/focus becomes automatic.
  5. Use means enter, exit, resupply or pick up.
  6. Touch changes are handled in P4.2.
  - The controls screen, help text, tutorials and gamepad text are updated.
- **Files:** `ACTIONS`, `PAD_LABELS`, `TOUCH_LABELS`, `Input`, `PC.sample`, the controls UI, the tutorials.
- **Red test:**
  - A v1 bindings fixture with `weapon1`, `weapon2`, `gear`, `eject` and `switchPlatform` loads and drops the removed ids.
  - If `KeyZ` was taken, `switchWeapon` is left unbound.
  - Holding Use for 0.4 s exits, and a tap enters.
  - Automatic gear goes down under 60 m below 90 m/s.
- **Acceptance:** each platform kind is played with keyboard and mouse and with the pad labels.

#### P4.2 Touch layout
- **Goal:**
  - Context buttons (Enter/Exit, Gear, Eject, Melee, Use) appear only when they can be used.
  - Sizes come from vmin with safe-area insets, plus a new `touchScale` setting (0.8-1.4).
  - The HUD reserve is computed from the real layout.
- **Files:** `TouchControls`, CSS, `SETTING_SCHEMA`, `HUD.touchReserve`.
- **Red test:** at 375x812, 812x375, 1024x768 and 1920x1080, no two visible buttons overlap and every button stays inside the viewport.
- **Acceptance:** played with touch emulation on foot, in a mech, in the air and in a boat.

#### P4.3 Human on foot (D4, D5, D16)
- **Goal:**
  - The hangar's "On foot" group offers Infantry (armed, ranger style) and Civilian (a new def with fists only).
  - The player human steps like infantry and swims (P1.3).
  - Rule for the civilian: AI ignores them until they attack, enter a combat vehicle, or come within 60 m of an objective.
  - The HUD and camera use the infantry settings that already exist.
- **Files:** `PLATFORMS`, the hangar UI, the AI targeting filter.
- **Red test:**
  - The AI never selects a passive civilian player.
  - It selects them after they hit something.
  - Loadout validation fails if a civilian is given a gun.
- **Acceptance:** a skirmish is played on foot as both choices.

#### P4.4 Enter, exit, eject for every platform (D28, D31)
- **Goal:**
  - Tapping Use near a free vehicle (your own parked one, an empty friendly one, or a civilian one from P6) enters it. A free vehicle has no driver and is within 6 m for small units or within its radius plus 4 m.
  - Holding Use exits. The platform stays parked, with its team kept and no AI. You become your on-foot choice and step out to a free spot nearby (searched in a ring; water means swimming).
  - Holding Use in the air ejects with a parachute; the platform is lost as it is now.
  - HP, ammo, heat and cooldowns persist across exit and enter.
  - Dying on foot counts as a death.
  - Aircraft respawn at an airport if there is one (P4.5).
- **Files:** `Platform`, `PC`, `Game.spawnPlayer`, `Cam`, HUD, net.
- **Red test:**
  - Exit leaves the platform alive and still, and the human is not inside any geometry.
  - Entering again restores the same hp and ammo.
  - Ejecting at 300 m lands safely on foot.
  - Exiting while blocked on all sides falls back to the roof, top or ejecting upward.
  - When two players try to enter in the same tick, the first one wins.
- **Co-op:** a new host message `ctl` {pid} rebinds the guest's controlled platform. `sp` carries `driver`. `NET_VERSION` +1.
- **Acceptance:** exit and enter tested in the pane for every kind (mech, ground, air, and naval after P5).

#### P4.5 Airports and airstrips (D27)
- **Goal:**
  - A generator places an airport on the flattest large site. It has a 900 m runway, taxiway, apron, terminal, tower, hangars and fuel tanks; the fuel tanks are hazard sources.
  - Smaller maps get a 500 m strip instead.
  - Old maps get a strip only if a flat site exists outside the mission areas, kept by the golden hash rule (terrain is untouched; only structs are placed in free space).
  - Landing and stopping on the apron resupplies.
- **Files:** `Scenery` and the site code, structs, pads, `Game.spawnPlayer`.
- **Red test:**
  - The runway height varies by less than 0.5 m along its length.
  - The runway lies inside the map with no structs on it.
  - An aircraft placed on approach with gear down lands and resupplies on the apron.
- **Acceptance:** take off, land and resupply in the pane.

#### P4.6 Melee weapons and animations (D8)
- **Goal:**
  - A `MELEE` table: fists, knife, sword and HF katana, each with damage, reach, arc, speed and combo.
  - Infantry gets pose keyframes in `drawInfantry` (wind-up, swing, recover) with weapon models.
  - Mechs get weapon-specific swings and blade models.
  - Hits reuse the cone of `doMelee`.
  - The HF katana cuts infantry into gibs and slices light vehicles.
  - A loadout melee slot is added for on-foot and mechs, with Arsenal entries.
- **Files:** `MELEE`, `doMelee`, `drawInfantry`, the mech draw, `Loadout`, `Arsenal`.
- **Red test:**
  - Each weapon hits a dummy inside its reach and arc and misses outside them.
  - A civilian has fists only.
  - The old mech loadouts still validate, defaulting to fists.
- **Acceptance:** every weapon is used in the pane, and the animations are reviewed in screenshots.

### P5 Naval and artillery (8 h)

#### P5.1 Naval kind
- **Goal:** add `kind:'naval'`.
  - Buoyancy follows the water level and waves, and the hull bobs and rolls.
  - Turning depends on speed. Ships stop at the shore unless amphibious.
  - Collisions with docks, shore and pairs.
  - HUD shows speed, heading and depth under the keel. The camera follows.
  - AI profile: patrol lanes and engage. A destroyed ship sinks.
  - Every `kind ===` site is audited (R5).
- **Files:** the `Platform` steppers, `resolveWorld`, `resolvePairs`, the draw switch, `ARCH`, AI, HUD, `Cam`, net flags.
- **Red test:**
  - A naval platform stays at the water level.
  - It stops at the shore.
  - It sinks on death.
  - Every kind is stepped through every system without errors.
- **Acceptance:** driven on a lake and on the sea.

#### P5.2 3 naval platforms (D24)
- **Goal:** fast attack craft, missile destroyer and amphibious hovercraft.
  - Weapons: naval gun, torpedo (runs in the water), ship SAM.
  - Loadouts, and a hangar group "Naval" that is disabled with a reason on maps without water.
  - Enemy naval units appear in skirmish on water maps, and the player starts at a harbour.
- **Red test:**
  - Torpedoes only travel in water.
  - The hovercraft crosses a beach.
  - Hangar availability follows the map's water.
- **Co-op:** existing `sp` and snapshot paths, plus a new flags bit for wake. `NET_VERSION` +1 only if the format changes.
- **Acceptance:** each platform is played on the coastal map.

#### P5.3 3 artillery platforms (D25)
- **Goal:** indirect fire.
  - A ballistic arc solver, a minimum range, and an impact-predictor reticle.
  - The stance key deploys and stabilises the platform for accuracy.
  - Platforms: tracked howitzer, rocket truck and mortar carrier.
  - Enemy artillery fires with a telegraph (impact markers).
- **Red test:**
  - The solver lands within 3 m at 200-1200 m on flat ground and on slopes.
  - The minimum range is enforced.
  - Deployed spread is smaller than undeployed.
- **Acceptance:** each platform is played, and a shell duel is seen in the pane.

### P6 Traffic, flights, shipping, vehicles, society (12 h)

#### P6.1 Road traffic
- **Goal:** build a lane graph from the `Scenery` streets and the roads between towns. A `Traffic` system then runs the cars:
  - They follow lanes with following distance and give way at junctions.
  - They react to combat: brake, flee, or abandon the car (the driver becomes a `Civ`).
  - Wrecks burn.
  - Traffic is local, capped by quality, and drawn instanced.
- **Red test:**
  - Cars stay on lanes.
  - There are no overlaps after 60 s.
  - An explosion makes nearby drivers flee.
  - A crushed car becomes a wreck.
- **Perf:** +0.3 ms on the megacity.

#### P6.2 50 civilian vehicles (D26)
- **Goal:** a `VEHICLES` table: 36 road, 8 sea and 6 air vehicles, built as part recipes with colour sets.
  - When a human enters one (P4.4) it becomes a real Platform with a `civilian` def and no weapons.
  - In co-op, the guest sends `enterCiv` {def, x, z, yaw}, and the host spawns it.
- **Red test:**
  - All 50 vehicles build.
  - Entering one gives a drivable Platform that matches its kind.
  - An airliner can only be entered when parked at an airport.
- **Co-op:** a new `enterCiv` message. `NET_VERSION` +1.

#### P6.3 Commercial flights
- **Goal:** airliners take off and land at the map's airports, or cross the map at altitude when there is no airport.
  - They follow flight paths and can be shot down, crashing as P3.2 debris.
  - The AI ignores them. The traffic is local.
- **Red test:**
  - A flight completes its takeoff, cruise and landing cycle.
  - A shot-down flight crashes and its debris deals damage.

#### P6.4 Marine traffic
- **Goal:** container ships, tankers, ferries between docks, fishing boats and sailboats follow sea lanes and leave wakes. The traffic is local.
- **Red test:**
  - Ships never touch land.
  - Ferries complete a dock-to-dock cycle.

#### P6.5 Society sim (D29)
- **Goal:** add 12 professions to `Civ`: office worker, shopkeeper, factory worker, police, firefighter, medic, construction worker, driver, pilot, sailor, farmer, student.
  - Workplaces come from building templates (office, shop, factory, police, fire station, hospital, school, farm, port, airport).
  - The daily schedule follows the time of day: home, work, lunch, home, and indoors at night.
  - People commute on foot or as traffic drivers.
  - First responders go to fires, collapses and casualties. Police set up a cordon and flee if attacked.
- **Red test:**
  - At 08:00 most workers are heading to work.
  - At 23:00 most people are inside.
  - A fire dispatches a fire truck.
- **Perf:** +0.2 ms.

### P7 10 missions (8 h)

#### P7.1 One mission per new map, each with an unlock (D7, D30)
- **Goal:** one mission per new map:
  - Coastal city: naval escort.
  - Archipelago: amphibious assault.
  - River valley: evacuation during a flood.
  - Alpine pass: convoy through avalanches.
  - Desert canyon: artillery duel.
  - Jungle delta: on-foot infiltration.
  - Volcanic island: extraction under lava and quakes.
  - Tundra lake: ice-lake convoy in a storm.
  - Megacity metro: airport defence during a quake.
  - Farmland plains: tornado rescue.
  - Each mission unlocks one new item (weapon or superweapon) chosen from the new content.
- **Files:** `MISSIONS`, objectives, the briefing UI, `Save.data.unlocked`, `Arsenal`.
- **Red test:**
  - Each mission starts and its objectives exist.
  - A forced completion grants the unlock.
  - Missions m1-m8 start unchanged.
  - Old unlock saves load.
- **Acceptance:** every mission is played to a win in the pane (a test hook may speed up the waits).

### P8 Co-op, performance, review, cleanup (6 h)

#### P8.1 Co-op pass
- **Goal:** two-tab host and guest in the pane on every new map: world hash, water, enter and exit, hazards, naval, artillery, missions and unlocks.
- **Acceptance:** no desync, and both sides have no console errors.

#### P8.2 Performance pass
- **Goal:** bench every map at High and 1080p and optimise hotspots.
- **Acceptance:** p95 ≤ 7.8 ms and max ≤ 33 ms.

#### P8.3 Final review
- **Goal:** an Opus + high review of the full program diff, with every finding fixed.

#### P8.4 Docs and close-out
- **Goal:**
  - Update the in-game help and controls text.
  - Move durable lessons into memory.
  - Write the final `CLOSED` ledger entry.
  - Delete this plan and the ledger, and push.

## 6. Traceability checklists

Each line is ticked with evidence (SHA, test name and result) when its phase passes the gate.

- **P1:**
  - [ ] bench and fixture (P1.0)
  - [ ] map framework (P1.1)
  - [ ] mountains (P1.2)
  - [ ] water (P1.3)
  - [ ] weather (P1.4)
  - [ ] time of day (P1.5)
  - [ ] co-op hash, NET 4 (P1.6)
  - [ ] gate 1-6
- **P2:**
  - [ ] 30 flora (P2.1)
  - [ ] 30 fauna (P2.2)
  - [ ] 10 maps (P2.3)
  - [ ] map UI (P2.4)
  - [ ] gate 1-6
- **P3:**
  - [ ] momentum (P3.1)
  - [ ] collapse damage (P3.2)
  - [ ] 10 hazards (P3.3)
  - [ ] gate 1-6
- **P4:**
  - [ ] controls (P4.1)
  - [ ] touch (P4.2)
  - [ ] on foot (P4.3)
  - [ ] enter, exit, eject (P4.4)
  - [ ] airports (P4.5)
  - [ ] melee (P4.6)
  - [ ] gate 1-6
- **P5:**
  - [ ] naval kind (P5.1)
  - [ ] 3 naval (P5.2)
  - [ ] 3 artillery (P5.3)
  - [ ] gate 1-6
- **P6:**
  - [ ] traffic (P6.1)
  - [ ] 50 vehicles (P6.2)
  - [ ] flights (P6.3)
  - [ ] ships (P6.4)
  - [ ] society (P6.5)
  - [ ] gate 1-6
- **P7:**
  - [ ] 10 missions and unlocks (P7.1)
  - [ ] gate 1-6
- **P8:**
  - [ ] co-op (P8.1)
  - [ ] perf (P8.2)
  - [ ] review (P8.3)
  - [ ] close-out (P8.4)
- **Done means** (from the prompt):
  - [ ] solo and co-op per decision
  - [ ] self-test green
  - [ ] no console errors
  - [ ] fps floor
  - [ ] old saves load
  - [ ] everything pushed
