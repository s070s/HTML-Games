# Halo 3 (2007), including Forge and Theater

Legend: [S#] numbered source below; "unverified" = not confirmed by a fetched page; "inference" = my reasoning.

## Identity
- Bungie, Xbox 360, Sept 2007. Metacritic about 94; record $170M US first day, over $300M worldwide first week; 14.5M sold by 2012 per Microsoft; best-selling US game of 2007 [S2].
- Campaign supports 4-player co-op (Chief, Arbiter, two Elites; same abilities) over Live or System Link [S2]. Multiplayer up to 16 players [S2]. 24 maps at launch (27 in MCC) [S1].
- Criticism: short campaign, weak plot, poor ally AI, some textures [S2].

## Core loop
- Campaign: big-battle encounters driven by Isla's objectives system (see Bots and AI) [S6].
- Multiplayer: playlist matchmaking (Ranked, Social, Hardcore, Community, DLC, Tournaments, Double EXP weekends) with TrueSkill ranking; 10-second veto vote after map load, majority changes map and gametype [S1][S2].
- Fight loop: shield break, finish, grab map power weapon/equipment on timers, hold power positions. Weapon spawns and equipment are map-fixed (no loadouts), which is the sandbox's strength.

## Movement
- No sprint (introduced in Reach as armor ability) [S8]. Gravity custom setting 4 levels 50%-200%; player speed 10 settings 25%-300% [S1].
- Jump/crouch/melee-lunge numbers: unverified (not on fetched pages).
- Vehicles: collision damage depends on size, mass and speed; Brute Chopper can destroy a Warthog head-on; Ghost head-on crash can kill the driver [S1].

## Weapons and equipment
- About 21 usable UNSC weapons (2 MCC-only) plus Covenant (plasma rifle, plasma pistol, needler, energy sword...) [S1].
- Two-weapon limit; dual wielding from Halo 2 (no grenade/melee while dual wielding) [S7]; Halo 3 retains it for some weapons (unverified list).
- Grenades: frag (bounce), plasma (stick), spike, firebomb (Spike/Fire from Halo 3: spike grenade and firebomb exist in Halo 3 - unverified here).
- Sniper fire interval retuned from 0.5 s to 0.7 s for Halo 3 (GDC session title by Griesemer) [S5].
- Equipment (one carried at a time) [S1][S2]:

| Item | Effect (high level) | Source |
|---|---|---|
| Bubble Shield | Dome blocks projectiles; lets allies/you inside regen | [S1] list; detail unverified |
| Power Drain | Drains shields/vehicle power in radius | [S1] list |
| Trip Mine | Placed explosive | [S1] list |
| Portable Gravity Lift | Lifts players/vehicles | [S1] list |
| Radar Jammer | Scrambles enemy radar | [S1] list |
| Flare | Blinds | [S1] list |
| Regenerator | Heals/regens nearby | [S1] list |
| Deployable Cover | Wall barrier | [S1] list |
| Invincibility, Cloaking | Campaign/special | [S1] list |
| Automated Turret | Placed turret | [S1] list |
Radar Jammer and Flare were removed on some maps (Guardian, Narrows) [S1]. Equipment is single-use pickup, not a loadout.
- Turret weapons are used at slower, third-person pace [S1].

## Abilities and items
- Equipment above; power-ups (overshield, camo) on timers (timer lengths unverified).
- Skulls (campaign): gold amplify score, silver are comic-effect; only on Normal, Heroic, Legendary; all collected unlocks the Hayabusa armor [S3]. Skulls, difficulty and speed multiply score [S2]. Example skull: Blind hides HUD [S3].
- Ally Elites and marines; poor ally AI criticized [S2].

## Health and damage
| Item | Value | Source |
|---|---|---|
| Health | 45 | [S4] |
| Shield | 70 | [S4] |
| Recharge | delay about 5 s, refill about 4 s in CE standard; H3 multiplayer values unverified | [S4] |
Custom options allow shield/damage scaling (specific tiers unverified). Melee damage figure unverified.

## Modes and match options
- 9 standard gametypes: Slayer, Oddball, King of the Hill, CTF, Assault, Territories, Juggernaut, Infection, VIP [S1]. Custom games award no EXP [S1].
- Custom options with known ranges: player speed 10 settings (25%-300%); gravity 4 (50%-200%); motion tracker range 5 settings (10 m-150 m); vehicle use 3 (Full, Passenger only, None); 10 base colors x 3 shades [S1]. Other options (shields, damage, weapons on map, traits, respawn time) exist; values unverified.
- Firefight arrives in ODST/Reach: Reach has 10 Firefight maps [S8].

## Map design
- Symmetric arenas (Guardian, Narrows, The Pit - examples named in sources only for Guardian/Narrows [S1]); big team maps with vehicles (Valhalla - from memory, unverified).
- Forge: in-game object editor to place weapons, vehicles, objects, spawn points, teleporters; real-time add/remove/move; a budget limits placed objects; less freedom than PC editors [S1][S2].
- Theater: replays rebuilt from game data, small files (about 5 MB for 15 min multiplayer); 25 most recent films on 360 per [S1] (up to 100 saved per [S2] - sources conflict); share via website; campaign films cannot be rewound or clipped [S1].

## Bots and AI
- Declarative objectives (Isla, "Building a Better Battle") [S6]:
  - Encounter = tree of prioritized tasks; squads flow down ("plinko"); tasks self-describe priority, activation script, capacity; higher-priority activation pulls squads up, deactivation pushes them down.
  - Squad assignment: greedy minimum-cost pairing under capacity constraints; costs include distance, coordination, tree balance, nearness to player; filters for leader/vehicle/sniper roles.
  - Leadership case study: leaders give structure; leader death sets the task to "broken" and followers use broken behaviors (flee/panic).
  - Player pickup case study: allies drive to collect the player when a vehicle encounter needs one.
  - Perf: small n and m, cache H(s,t), timeslice trees [S6].
- Halo 2 behavior tree base (prioritized list, self-describing behaviors) [S6].
- Brute berserk and Elite dodge/cover: from memory, unverified in fetched pages; Grunt flee on leader death confirmed in CE page [S9].
- Multiplayer has no bots in Halo 3 (Infinite later added bot Academy) [S10].

## Progression
- EXP and Skill ranks; officer ranks require skill level (example: Major with 200 EXP needs skill 35 to reach grade 2 at 300 EXP) [S1]. Armor permutations unlocked via ranks and achievements (Hayabusa for all skulls [S3]).

## HUD and options
- Motion tracker with custom range [S1]; equipment icon; shield/health bars; score multiplier display for skulls [S2].
- Blind skull removes weapon/HUD [S3].
- Accessibility: not documented in sources.

## Best features to keep
1. Equipment as map pickups: situational tools without loadouts [S1].
2. Forge for fast custom arenas (sandbox object budget) [S2].
3. Theater: replay from compact event data (about 5 MB / 15 min) [S1].
4. Custom game options: huge replay value from few knobs (speed, gravity, vehicles) [S1].
5. Declarative AI tasks for large battles [S6].
6. Skull modifiers for score and replay [S3].

## Mistakes to avoid
- Short campaign and weak plot [S2].
- Poor ally AI [S2].
- Forge limited freedom [S1].
- Later-series drift: Halo 4 added loadouts, perks and ordnance drops [S11] (dilution argument is community opinion, unverified here); Infinite launched without co-op/Forge and with slow Battle Pass [S10][S12].

## Adaptation notes
- Store replays as seed + input log or event stream (small) for a Theater feature; deterministic sim needed (inference).
- Forge-lite: grid placement of boxes, spawn points, weapon pads with budget cap; save to localStorage/JSON.
- Equipment: ship bubble shield, trip mine, regenerator, grav lift, power drain first (cheap geometry/shader).
- Bots fill custom game modes (Slayer, CTF, KotH, Oddball, Juggernaut); costs must stay timesliced.
- Expose custom options as numeric sliders with the ranges above.

## Sources
1. Halopedia, Halo 3 - https://www.halopedia.org/Halo_3 - wiki
2. Wikipedia, Halo 3 - https://en.wikipedia.org/wiki/Halo_3 - wiki
3. Halopedia, Skull - https://www.halopedia.org/Skull - wiki
4. Halopedia, Energy shield - https://www.halopedia.org/Energy_shield - wiki
5. Halopedia, Jaime Griesemer (GDC session titles) - https://www.halopedia.org/Jaime_Griesemer - wiki
6. Damian Isla, Building a Better Battle (Halo 3 AI Objectives) - https://web.cs.wpi.edu/~rich/courses/imgd4000-d11/lectures/halo3.pdf - talk
7. Halopedia, Halo 2 - https://www.halopedia.org/Halo_2 - wiki
8. Halopedia, Halo: Reach - https://www.halopedia.org/Halo:_Reach - wiki
9. Halopedia, Grunt - https://www.halopedia.org/Grunt - wiki
10. Halopedia, Halo Infinite - https://www.halopedia.org/Halo_Infinite - wiki
11. Halopedia, Halo 4 - https://www.halopedia.org/Halo_4 - wiki
12. Wikipedia, Halo Infinite - https://en.wikipedia.org/wiki/Halo_Infinite - wiki
13. Engadget, Griesemer interview - https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html - official/interview

Gaps: exact Halo 3 weapon stats, equipment durations, power-up timers, spawn timers, custom shield/damage tiers, Brute/Elite behavior pages, grenade damage values.
