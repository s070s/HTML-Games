# IRON HORIZON: Arsenal, Bases and Targeting plan

Driving plan for one feature batch. Delete this file once the work has landed.
Game file: `Mech Flight Sim/IronHorizon.html` (single file, no assets, no libraries).

## Goals (from the Owner)
1. Skirmish: random own base (player spawn) and enemy base each battle.
2. More cities, skyscrapers and big structures, closer to spawns and bases.
3. Turrets defending both bases (friendly turrets at our base too).
4. Configurable lives (skirmish setup; missions via Settings; co-op uses the host's value).
5. 30 new regular weapons/equipment (52 in total) and a rebalance so every option has a use, a benefit and a drawback.
6. 100 distinct, overpowered superweapons for the player, unlocked permanently by missions, ranks, skirmish wins and career stats (some feats count inside the current match), fired from a charge meter.
7. Smarter lock/target picking (crosshair closeness first, then distance, threat, lockability).
8. Everything works in co-op (host-authoritative).

## Work split
| Part | Owner | Region in the file |
|---|---|---|
| Foundation: superweapon framework, toolkit, unlocks, career stats, HUD, input, hangar, Arsenal screen, co-op sync, lives, targeting, 6 starter superweapons | lead | many |
| W: 30 new weapons + rebalance + platform allow lists + AI loadouts | helper | WEAPONS table, projectile/beam/defense code, PLATFORMS, ARCH |
| A: superweapons 2-34 (minus starters) | helper | between `SUPER PART A BEGIN/END` markers |
| B: superweapons 35-67 (minus starters) | helper | between `SUPER PART B BEGIN/END` markers |
| C: superweapons 68-100 (minus starters) | helper | between `SUPER PART C BEGIN/END` markers |
| X: skirmish bases, turrets, random spawns, more/bigger cities | helper | skirmishDef, SCENERY/Scenery, TPL, populateWorld |

Starters built by the lead (unlocked from the start): 1 Orbital Lance, 3 Creeping Barrage, 12 Seismic Slam, 27 Crater Maker, 47 Plasma Halo, 85 Blink Strike.

## Superweapon rules
- Tiers: T1 Tactical (charge 45 s), T2 Strategic (90 s), T3 Apocalyptic (160 s). Each kill adds charge (T1 +6%, T2 +4%, T3 +2.5%). Training Range charges 8x faster.
- One Strategic slot per platform loadout (no weight). Key V (rebindable), pad RB, touch button SUPER.
- Aim kinds: `point` (crosshair ground point, clamped to `range`), `self` (centred on the user), `target` (locked/selected target, else crosshair point), `map` (picks targets itself).
- All damage goes through toolkit helpers, which do nothing on co-op guests; guests replay the visuals from a `sw` event.
- Overpowered by design, but never hurts the user or allies (friendly fire rules apply).

## Unlock requirement kinds
`start` · `mission:<id>` (complete) · `rank:<id>:<A|S>` · `missionsDone:<n>` · `missionsRank:<A|S>:<n>` · `skirmishWin:<size>` · `skirmishMap:<map>` · `career:<stat>:<n>` · `match:<stat>:<n>` (reached inside one match, counts forever) · `unlocked:<n>` (own n other superweapons).
Career stats: kills, structures, damage, damageTaken, deaths, playMin, airKills, groundKills, mechKills, infantryKills, wins, skirmishWins, waves, superUses, superKills. Match stats: kills, streak, flawless (kills with no platform lost), superKills.

## The 100 superweapons
Tier · aim · unlock. Each must play visibly differently from every other one.

### Part A: orbital, kinetic, explosive
1. Orbital Lance · T1 · point · start. Thin satellite laser column hits the point after 1.5 s and burns for 3 s.
2. Rods from God · T2 · point · mission:m1. Three tungsten rods hit in sequence along the view line; deep craters, huge structure damage.
3. Creeping Barrage · T1 · point · start. 24 shells walk forward from the point along the view direction.
4. Carpet Bombing · T2 · point · career:kills:150. A visible bomber line flies across the point, dropping a 300 m bomb carpet.
5. Tactical Nuke · T3 · point · missionsDone:8. 3 s countdown, flash, mushroom cloud, 140 m blast, 20 s radiation zone.
6. Orbital Cluster · T2 · point · mission:m2. One canister bursts at 200 m into 40 bomblets.
7. Mass Driver Salvo · T2 · target · rank:m1:A. Six hypersonic slugs from orbit, each piercing down through the target.
8. Bunker Nova · T2 · point · career:structures:100. Ground-penetrating charge: delayed underground blast collapses every building within 60 m.
9. Airburst Canopy · T1 · point · career:airKills:25. 12 airbursts at 40-90 m altitude: an anti-air umbrella.
10. Missile Rain · T2 · map · match:kills:20. 30 homing missiles from the sky, one per enemy within 400 m.
11. Thermobaric Bomb · T2 · point · mission:m5. Fuel cloud spreads for 3 s then ignites; damage ignores cover.
12. Seismic Slam · T1 · self · start. Radial ground wave throws ground enemies airborne and staggers them.
13. Orbital Drop Pod · T2 · point · mission:m3. Pod crushes the point and deploys 3 allied heavy mechs for 60 s.
14. Planet Cracker · T3 · point · rank:m8:S. Huge orbital beam you steer with the crosshair for 8 s.
15. Daisy Cutter · T2 · point · career:kills:300. One giant bomb levels trees and buildings in 90 m.
16. Chain Reaction · T1 · target · match:streak:5. Marks the target; its death blast jumps to nearby enemies, chaining up to 8 times.
17. ICBM Strike · T3 · point · skirmishWin:large. Launched from your base, visible arc, 12 s flight, 200 m city-killer.
18. Overwatch Satellite · T1 · map · career:mechKills:50. For 20 s, a precise orbital shot every 2 s at the most dangerous enemy within 500 m.
19. Ring of Fire · T1 · self · mission:m4. 16 shells land in a ring around you, then a second ring further out.
20. Tungsten Hail · T1 · point · career:kills:50. 200 flechettes rain over 50 m for 4 s.
21. Firewall · T1 · point · rank:m2:A. 120 m napalm line across the view; burns 15 s.
22. Earthquake · T2 · point · career:structures:300. 10 s quake in 250 m: ground units stagger, buildings crack each second and collapse.
23. Gunship Orbit · T2 · point · career:airKills:75. A gunship circles the point for 25 s firing heavy cannon at enemies.
24. Cobalt Bomb · T3 · point · rank:m8:A. Nuke plus fallout ring that grows for 60 s.
25. Hellfire Swarm · T1 · target · match:kills:10. 12 micro-missiles dive from above onto the enemies nearest the point.
26. Demolition Rain · T2 · point · rank:m5:A. Every building within 120 m gets a charge; staged collapse.
27. Crater Maker · T1 · point · start. One deep penetrator: big blast, big crater decal.
28. Shrapnel Star · T1 · self · career:infantryKills:100. 360 degree burst of piercing flechettes from you.
29. Orbital Shotgun · T2 · point · mission:m6. Nine lance strikes in a fan along the view.
30. MIRV · T3 · point · rank:m5:S. Six small nukes in a hexagon around the point.
31. Sky Hammer · T2 · target · career:kills:500. A steel pillar falls on the target and tracks it; enormous single-target damage.
32. Minefield Air-Drop · T1 · point · career:skirmishWins:1. 40 proximity mines scattered over 70 m.
33. Cruise Salvo · T2 · map · skirmishWin:medium. 8 cruise missiles from your base fly to the 8 strongest enemies.
34. Antimatter Charge · T3 · point · career:kills:1000. White flash; an implosion sphere deletes everything in 80 m.

### Part B: energy, storms, elements
35. Tesla Storm · T2 · point · rank:m3:A. Storm cloud for 15 s, chain lightning on enemies below every 0.3 s.
36. EMP Burst · T1 · self · career:deaths:10. 150 m: enemy weapons and mobility disabled 8 s, shields dropped, aircraft stall.
37. Ion Cannon · T2 · point · rank:m4:A. 3 s charging ring, then a 40 m wide vertical ion blast.
38. Solar Mirror Array · T3 · target · rank:m7:S. Focused sunlight auto-tracks the target 8 s, leaving fire zones.
39. Plasma Tornado · T2 · point · career:kills:200. Wandering tornado lifts and spins enemies.
40. Cryo Blizzard · T2 · point · skirmishMap:frost. Freezes the area: enemies slowed 80%, frozen ones shatter for bonus damage.
41. Meteor Shower · T2 · point · skirmishMap:ashfall. 30 meteors over 10 s across 150 m.
42. Volcanic Eruption · T3 · point · career:playMin:120. A vent erupts: lava bombs plus a burning pool for 25 s.
43. Arc Fence · T1 · point · mission:m3. Four pylons form an electrified square; crossers are stunned and burned.
44. Solar Flare · T1 · self · career:airKills:10. Blinds enemies within 300 m for 10 s: locks broken, AI aim ruined.
45. Microwave Emitter · T1 · self · career:infantryKills:30. Forward cone overheats enemy weapons and cooks infantry.
46. Photon Swarm · T2 · map · match:kills:30. 50 seeking light orbs drift onto enemies.
47. Plasma Halo · T1 · self · start. Expanding plasma ring from you out to 120 m.
48. Ball Lightning · T1 · point · career:kills:100. Five slow orbs roll forward zapping anything near.
49. Firestorm · T3 · point · rank:m2:S. 200 m inferno; fire spreads, buildings burn and collapse over time.
50. Acid Rain · T2 · point · career:damage:100000. 20 s corrosive rain strips armour to zero and dissolves structures.
51. Laser Grid · T2 · point · mission:m7. A 6x6 lattice of lasers sweeps across 100 m.
52. Hurricane · T3 · map · rank:m6:S. 20 s storm: enemy aircraft blown down, ground units pushed.
53. Thunder God · T2 · self · career:deaths:25. 12 s: every enemy that fires at you is struck by lightning.
54. Prism Array · T2 · point · career:mechKills:100. One orbital beam splits into 8 beams on the 8 nearest enemies.
55. Neutron Bomb · T3 · point · career:kills:750. Kills units within 150 m; structures untouched.
56. Sandstorm · T1 · point · skirmishMap:verdant. 25 s blinding storm: enemies inside cannot target; you see them outlined.
57. Frost Nova · T1 · self · mission:m8. Freezes enemies within 60 m for 4 s.
58. Plasma Rain · T2 · point · rank:m6:A. Plasma droplets fall over 80 m for 12 s.
59. Aurora Veil · T1 · self · career:skirmishWins:3. Allies within 120 m get a 300 shield and regeneration for 15 s.
60. Magma Lance · T2 · point · career:groundKills:100. A lava fissure races 300 m along the ground toward the point.
61. Storm Surge · T2 · self · match:streak:8. 20 s of automatic lightning arcs to enemies within 120 m.
62. Satellite Net · T3 · map · missionsRank:A:8. Every 3 s for 15 s, 5 satellites hit the 5 most valuable enemies on the map.
63. Phoenix Strike · T2 · point · career:superUses:25. A firebird sweeps a burning path through the point.
64. Ozone Hole · T2 · point · career:playMin:60. 50 m UV column; damage ramps the longer enemies stay.
65. Voltaic Dome · T2 · self · mission:m4. 40 m dome for 12 s deletes enemy projectiles entering it.
66. Glacier Wall · T1 · point · career:structures:50. A massive ice wall (destructible) blocks an 80 m line.
67. Skyfire Flak Field · T1 · point · mission:m6. Flak bursts fill the sky over 200 m for 10 s.

### Part C: gravity, time, exotic, summons
68. Black Hole · T3 · point · rank:m3:S. Singularity pulls everything within 150 m in, crushes it, then detonates.
69. Gravity Inversion · T2 · point · mission:m8. 100 m: gravity flips for 6 s; enemies float up then slam down.
70. Zero-G Field · T1 · point · career:kills:25. Enemies within 80 m float helplessly for 8 s.
71. Gravity Well · T1 · point · rank:m1:S. Pulls enemies toward the point for 10 s (sets up combos).
72. Repulsor Blast · T1 · self · career:mechKills:20. Flings everything within 100 m away; impact damage.
73. Chrono Stop · T3 · self · missionsRank:S:4. Enemies within 400 m frozen in time for 8 s.
74. Stasis Field · T1 · point · career:waves:30. 70 m bubble: enemies and their shots run at 20% speed for 10 s.
75. Overclock · T1 · self · career:kills:75. 15 s: double speed, fire rate and cooling.
76. Mind Hack · T2 · target · rank:m4:S. Target and its 3 nearest allies fight for you for 30 s.
77. Drone Swarm · T2 · self · career:airKills:50. 12 allied attack drones for 40 s.
78. Titan Drop · T3 · point · career:wins:10. A giant allied titan mech lands and fights for 60 s.
79. Mirror Squad · T2 · self · career:wins:5. Four AI clones of your platform for 45 s.
80. Wormhole · T2 · point · rank:m7:A. Portal pair: enemies near the point are thrown out high above the map.
81. Dimensional Rift · T3 · point · career:kills:1500. A rift deletes enemies who stay inside 60 m after 4 s.
82. Shrink Ray · T2 · target · career:mechKills:150. Target shrinks to 30% size, hull and damage, permanently.
83. Phantom Army · T1 · point · career:deaths:5. 15 hologram platforms draw enemy fire for 20 s.
84. Grey Goo · T3 · point · career:structures:1000. Nanite cloud grows for 20 s, consuming units and structures.
85. Blink Strike · T1 · point · start. Teleport to the point with a landing shockwave.
86. Aegis Protocol · T2 · self · match:flawless:15. 12 s invulnerability, reflecting half the damage.
87. Second Wind · T1 · self · mission:m7. Full repair, rearm, cooling and shield.
88. Magnetic Storm · T2 · point · career:groundKills:50. Drags vehicles together into collisions and bends shots away.
89. Orbital Tether Snap · T3 · point · rank:m6:A. A cable falls from space along a 600 m line, destroying everything on it.
90. Mirror Dome · T1 · self · career:damageTaken:20000. 10 s: enemy projectiles are reflected back.
91. Quantum Barrage · T2 · self · match:kills:40. 15 s: every shot you fire is echoed 5 times from random angles.
92. Earth Spikes · T1 · point · skirmishWin:small. Rock spikes erupt in a line, impaling enemies.
93. Hive Queen · T2 · point · career:playMin:240. Six allied spider mechs burst from the ground for 40 s.
94. Graviton Lance · T2 · target · career:airKills:150. Beam lifts the target 80 m up and drops it.
95. Rewind · T2 · self · career:deaths:40. Restores your hull, ammo and position from 10 s ago; nearby enemies stunned.
96. Starfall · T3 · map · career:wins:25. 100 shooting stars across the battlefield strike enemies.
97. Void Storm · T2 · point · career:superKills:100. Black lightning drains enemy energy and shields and heals you.
98. Orbital Fortress · T3 · point · career:superKills:300. A floating allied fortress bombards the area for 40 s.
99. Siege Railgun · T2 · point · career:skirmishWins:10. Five huge shells from your base, visible arcs.
100. Armageddon · T3 · map · unlocked:90. Meteors, lightning and nukes everywhere within 400 m for 15 s.

## The 30 new regular weapons (52 in total)
Primary (12): flamer Flamethrower (short cone, burn over time, no use past 60 m) · tesla Tesla Coil (beam chains to 3 enemies, short range) · gauss Gauss Rifle (fast heavy slug, slow rate, heavy) · lance Beam Lance (beam that ramps damage on one target, huge heat) · needler Needle Gun (flechettes stick and burst after 1 s) · slug Slug Cannon (one heavy close shot, big stagger) · ion Ion Cannon (EMP bolt: low damage, strips shields, disables weapons) · howitzer Howitzer (lobbed heavy shell, long reload) · vulcan Rotary Vulcan (air nose gun, very fast, very hot) · lmg Light Machine Gun (infantry, heavy sustained) · dmr Marksman Rifle (infantry, between rifle and sniper) · arcPistol Arc Pistol (infantry mini tesla).
Secondary (10): swarm Swarm Missiles (8 weak homing missiles, easy to flare) · cruise Cruise Missile (slow, huge blast, long range, APS can stop it) · mines Mine Layer (drops proximity mines behind, ground only) · cluster Cluster Rocket (splits into 8 bomblets) · atgm Wire-Guided ATGM (follows the crosshair, ignores flares) · napalm Napalm Bombs (air, leave a fire zone) · buster Bunker Buster (one huge anti-structure bomb) · satchel Satchel Charge (infantry, thrown, 3 s fuse, huge structure damage) · empGren EMP Grenade (lobbed, disables) · javelin Javelin (infantry, top-attack lock, bonus vs ground armour).
Utility (8): ecm ECM Jammer (breaks locks on you, spoofs nearby missiles) · smoke Smoke Launcher (cloud that blocks locks and spoils AI aim) · cloak Optical Camo (untargetable 6 s, firing breaks it) · overdrive Coolant Overdrive (dump heat, 5 s heat-free) · reactive Reactive Armor (charges that block big hits) · holo Holo Decoy (fake platform enemies shoot at) · drone Repair Drone (heals you and nearby allies) · barrier Deployable Barrier (destructible wall in front of you).

## Targeting score (auto-target and Cycle Target order)
score = crosshair angle (dominant, normalised by 0.35 rad) + 0.35 x distance / sensor range − 0.25 if it attacks or locks you − 0.15 if the current guided weapon can lock it (type and range) + 0.6 if no line of sight. Lowest first. Cycle steps through that order.

## Bases (skirmish)
Seeded random own and enemy base positions on opposite sides (900+ m apart, inside bounds, flat enough). Own base: command building (defend it), pad, 4 gun turrets + 2 AA (team 0), buildings. Enemy base: command building (destroying it wins), 4-6 turrets + 2-3 AA scaled by difficulty, garrison. Waves leave the enemy base and push toward our base and the player. Win: enemy command destroyed, all waves cleared, or time up. Loss: our command destroyed or all platforms lost. Cities: one district near each base, one central mega-district with new big templates; missions get one extra district near their start.

## Lives
Skirmish option (1, 3, 5, 10, 20, unlimited); Settings > Gameplay "Platforms per mission" for missions; co-op guests get the host's value.

## Testing
`node "<scratchpad>/selftest.mjs"` runs the built-in self-test in headless Chrome and prints failures. Every part adds its own checks inside its own `SELFTEST PART <x>` markers.
