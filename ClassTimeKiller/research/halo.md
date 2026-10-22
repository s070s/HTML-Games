# Halo: Combat Evolved (2001) with series-wide notes

Confidence legend: [S#] = backed by numbered source below; "unverified" = from memory or not confirmed by a fetched page; "inference" = my design reasoning.

## Identity
- Bungie, Xbox launch title, Nov 2001. First-person shooter with vehicles; campaign of 10 levels, 13 multiplayer maps, 4-player split-screen, up to 16 on LAN, five competitive modes, no bots, no online at launch [S1][S2].
- Moved from third to first person during development; aim assist and input buffering were added for gamepad play; multiplayer was scrapped and rebuilt roughly four months before ship [S2].
- Reception: Metacritic 97 (Xbox), 83 (PC). Criticism: repetitive level design in the second half, no online or bots, weak PC port performance [S2].
- Design philosophy: Griesemer says the often-quoted "30 seconds of fun" is misread. The intent is a core moment repeated but varied by environment, weapons, vehicles and enemy mix, so no 30 seconds feel alike [S7]. He also describes layered timescales: AI decisions about 30 s, mission design about 3 min [S7].

## Core loop
- Campaign: arrive in an arena, fight a mixed squad encounter, push enemies back, mop up, advance; checkpoints on death [S2]. Canonical encounter (Isla, Halo 3 talk): enemies hold a territory, get pushed to a "fallback" point, then a "last stand" point; player breaks them then finishes them; spice added with snipers, turrets, dropships [S8].
- Designers script a sequence of "tasks" (territory + aggressiveness + rules of engagement + player following); inside a task the AI acts autonomously. Goal is the illusion of strategic intelligence [S8].
- Halo does not use dynamic difficulty, but enemies press when the player is reckless-aggressive and ease off when the player takes cover [S7].
- Multiplayer loop: spawn, grab map weapon, fight over power weapons and vehicles, shield recharge breaks the fight, retreat and re-engage.
- Sandbox "triangle" (idea from Bungie talks, unverified wording): guns / grenades / melee, plus vehicles, as three interlocking tools; grenades and melee work while a gun is held [S2].

## Movement
| Item | Value / behavior | Source |
|---|---|---|
| Fall damage | Fall faster than shield+health cap is fatal; vehicles can cancel it | [S1] |
| Jump height, speed, gravity | Not on fetched pages. Known feel: floaty low-gravity jump, no sprint, no crouch-jump tricks. Numeric values unverified | - |
| Sprint | Absent in CE; later Halos added sprint (Reach armor ability, Infinite sprint+slide) | [S11][S12] |
| Crouch | Exists (reduces profile and radar footprint, unverified) | - |
Inference: pick a jump apex of about 1.2-1.5 m with a 0.8x gravity feel; moderate run speed; no sprint for a CE-style clone, or sprint as an optional rule.

## Weapons and equipment
- Two-weapon carry limit, forcing trade-offs [S1][S2]. Separate grenade button; grenades are more significant as a result [S1].
- Frag grenade: bounces, short fuse. Plasma grenade: sticks to targets [S2].
- Melee kills a Grunt in one hit [S4]. Plasma pistol/needler Grunts strip shields fast [S4].
- Pistol (M6D): widely regarded as overpowered (zoom, high accuracy, headshots); fetched page for it was missing, so numbers unverified. Treat as a lesson: one sidearm out-competing power weapons collapses sandbox variety (Halo 2 battle rifle later replaced this role, [S10]).
- Vehicles: Warthog (driver, passenger, gunner; Vulcan chaingun; max 125 km/h; indestructible in CE, destructible from Halo 2) [S5]; Scorpion tank also indestructible in CE [S1]; Ghost and Banshee destructible [S1]. Pilot/gunner view third person, passengers first person [S2]. Griesemer tied Warthog turn rate to speed so it handles well fast and feels faster [S7].
- Halo 2 added dual wielding (no grenades/melee while dual wielding), battle rifle, energy sword, vehicle boarding and jacking [S10]. Halo 3 hits: equipment (see halo-3.md). Reach: armor abilities (Sprint, Active Camo, Hologram, Jetpack, Armor Lock, Drop Shield) [S11]. Infinite: equipment plus sprint and slide, grappleshot [S12].
- Tuning example of Bungie's precision: the Halo 3 sniper shot interval changed from 0.5 to 0.7 s, discussed in a GDC session title [S9].

## Abilities and items
- CE has few items: health packs, overshield and camo pickups (unverified detail), flashlight, grenades. Shield, not equipment, is the core "ability".
- Allies: UNSC marines follow, man turrets, ride Warthog; marines aggressive, crew cower; killing allies provokes retaliation [S2]. AI allies pick the player up when a vehicle encounter needs a vehicle (Halo 3 design) [S8].

## Health and damage
| Item | Value | Source |
|---|---|---|
| Shield / health (CE) | Page lists 75 each, flagged "citation needed"; treat as unverified | [S3] |
| Recharge delay | 5 s after last hit (standard) | [S3] |
| Full recharge time | about 4 s (standard); Easy difficulty about 8 s | [S3] |
| Health | Does not regenerate; health packs only; heartbeat at low health; no performance penalty | [S1] |
| Shield behavior | Weakens per hit, collapses, recharges after pause; fall also drops it | [S1] |
| Reach health | Health partly regenerates in 33/66/100% tiers; full needs pack or Drop Shield | [S11] |
Design idea: shield-pop then health makes "two-stage" kills (pop with burst, finish with headshot/melee).

## Modes and match options
- CE multiplayer: five competitive modes, 2-16 players, 13 maps, no bots, split-screen up to 4 [S2]. Typical modes: Slayer, Capture the Flag, King of the Hill, Oddball, Race (unverified list for CE).
- Later: Halo 2 matchmaking playlists, skill matching, host migration [S10]; Reach Firefight (10 maps, 34 MP maps total) and Invasion [S11]; Infinite Academy bots in 4 tiers (Recruit, Marine, ODST, Spartan) with settable difficulty, starting weapons, grenades and bot count [S12].
- Campaign difficulties: Easy, Normal, Heroic, Legendary (Legendary icon is an Elite skull) [S6]. Skulls: Halo 2 has one hidden per level (except Outskirts) [S6]; Halo 3 gold/silver [S6]. CE original skulls not on fetched page.

## Map design
- Campaign: large open combat arenas with multiple approach paths, vehicles optional; dropships bring reinforcements [S8]. Second-half repetition was the main CE complaint [S2].
- Multiplayer: Blood Gulch/Battle Creek style (big symmetric team maps with bases and vehicles) and small arenas. Details from memory, unverified.
- Inference: for low-end hardware, use a few large flat-shaded arenas with 2-3 elevation tiers and cover blocks; mirror layouts to guarantee fairness.

## Bots and AI
Backed by [S2][S4][S8][S9]:
- CE enemies: Elites with shields, Grunts that may flee when their leader dies (they regroup, sometimes arm two plasma grenades and suicide-rush) [S2][S4], Jackals with arm shields, Hunters, Flood, Sentinels [S2]. Enemies panic when a superior dies, dive from vehicles, take cover from explosives and suppression [S1].
- Grunt tiers: Minor (most likely to flee), Major (braver), Ultra, Heavy (plasma cannon crews), Special Ops (camo, less panic) [S4].
- Halo 2 architecture (Isla, GDC 2005): behavior tree with prioritized list of self-describing behaviors (hide, fight, search, idle, cover, grenade, melee, shoot, uncover, pursue, sleep); key point: the AI finds a distribution across choices, not a single hard choice [S8].
- Halo 3: declarative objectives system. Tree of prioritized tasks; each task has priority, activation conditions, capacity; squads "plinko" down to the most important task now; assignment by greedy minimum-cost matching with cost terms for distance, coordination, tree balance, and nearness to player; filters for task eligibility (leader, vehicle, sniper); a "broken" state when a leader dies stops redistribution so followers fall into broken behaviors [S8].
- Perception/morale (unverified detail): sight cones, hearing radius, memory of last known position; morale falls on leader death or heavy losses.
- Adaptation recipe: per bot a priority list evaluated every ~0.2-0.5 s (flee > dodge grenade > take cover when hurt > fight > pursue > idle); squad leader flag; on leader death set followers to "broken" 3-6 s; encounter task chain advance/fallback/last-stand tied to alive-percentage thresholds (>75%, >50% shown in the slides) [S8].

## Progression
- CE: none in campaign beyond unlocking skull/difficulty rewards; no ranks. Halo 2 introduced XP/skill ranks via matchmaking [S10]; Reach credits buy armor from The Armory [S11]; Halo 4 specializations and loadout unlocks [S13]; Infinite Battle Pass criticized as slow [S14].

## HUD and options
- Shield bar plus health bar, ammo, grenade counts, motion tracker (radar) with range; crosshair that turns red over enemies (unverified); low-shield beeps; heartbeat at low health [S1][S3].
- Options in later games: player speed, gravity, damage, shields (custom games, see halo-3.md).
- Accessibility: not documented in fetched sources; recommend aim assist, adjustable sensitivity, color-coded teams plus shapes.

## Best features to keep
1. Shield-over-health recharge: simple, supports the pace of fights [S1][S3].
2. Two weapons + grenades + melee independent: fast tactical choices [S2].
3. AI that reads as intelligent through squad roles, fleeing leaderless grunts, dodging and cover [S1][S4][S8].
4. Designer-authored encounter structure (fall back, last stand) layered over autonomous AI [S8].
5. Vehicle sandbox with tuned handling [S7].
6. Reasons: each creates readable, repeatable tactical moments.

## Mistakes to avoid
- Overpowered pistol dominating sandbox (CE community consensus; no numeric source fetched, unverified).
- Repetitive level reuse late in campaign [S2].
- Shipping without bots/online limited reach [S2]; here bots are the whole game.
- Halo 4 loadouts, perks and ordnance drops diluted equal-start sandbox [S13] (the fetched page only confirms the features exist; the "dilution" opinion is common community criticism, unverified here).
- Infinite: missing co-op, Forge at launch; slow Battle Pass [S12][S14].
- Halo 2 modding/cheating: not covered by fetched pages; unverified.

## Adaptation notes
- Offline bots only: spend effort on the priority-list AI and squad task tree; they are cheap CPU-wise (O(n^2 m) with small n,m, timesliced [S8]).
- Keep shield recharge numbers: delay 5 s, refill about 4 s [S3] but expose as options.
- Vehicles: ship one buggy and one flyer with simple raycast-spring physics; cap on-screen entities for 120 fps on phones.
- Controls: aim assist, input buffering for melee/grenade [S2]; touch needs large fire/grenade/melee/jump buttons.
- Procedural geometry: boxes/ramps; flat colors; fog; 1-2 draw calls per material.

## Sources
1. Halopedia, Halo: Combat Evolved - https://www.halopedia.org/Halo:_Combat_Evolved - wiki
2. Wikipedia, Halo: Combat Evolved - https://en.wikipedia.org/wiki/Halo:_Combat_Evolved - wiki
3. Halopedia, Energy shield - https://www.halopedia.org/Energy_shield - wiki
4. Halopedia, Grunt - https://www.halopedia.org/Grunt - wiki
5. Halopedia, M12 Warthog LRV - https://www.halopedia.org/M12_Warthog_LRV - wiki
6. Halopedia, Skull - https://www.halopedia.org/Skull - wiki
7. Engadget, Half-Minute Halo: Interview with Jaime Griesemer (2011) - https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html - official/interview
8. Damian Isla, Building a Better Battle: The Halo 3 AI Objectives System (slides) - https://web.cs.wpi.edu/~rich/courses/imgd4000-d11/lectures/halo3.pdf - talk
9. Halopedia, Jaime Griesemer / GDC sessions (via search result) - https://www.halopedia.org/Jaime_Griesemer - wiki
10. Halopedia, Halo 2 - https://www.halopedia.org/Halo_2 - wiki
11. Halopedia, Halo: Reach - https://www.halopedia.org/Halo:_Reach - wiki
12. Halopedia, Halo Infinite - https://www.halopedia.org/Halo_Infinite - wiki
13. Halopedia, Halo 4 - https://www.halopedia.org/Halo_4 - wiki
14. Wikipedia, Halo Infinite - https://en.wikipedia.org/wiki/Halo_Infinite - wiki

Gaps: CE pistol numbers, CE jump/speed values, CE skull list, CE weapon damage tables, Halo 2 modding sources, Elite behavior page (disambiguation hit), Halo 2 Isla GDC 2005 slide text (only second-hand).
