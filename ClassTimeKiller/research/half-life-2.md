# Half-Life 2 (with Episode One/Two notes)

Convention: facts tagged [n] come from the numbered Sources list. "unverified" = author recollection or single weak source, not confirmed by a fetched page.

## Identity
- Single-player FPS mixing combat, exploration, jumping and physics puzzles; story told through scripted in-engine sequences, no cutscenes [1].
- Dev began June 1999, team of 82 (about 100 with voice cast); Havok physics added for "presence"; Source engine built in parallel; shipped Oct 2004 [1].
- Metacritic 96 (PC). Episodes: One (2006), Two (2007); Lost Coast (2005) was a free HDR lighting showcase and the first Valve game with a developer-commentary mode [1][11].
- Takeaway for clone: the identity is "one tool (gravity gun) + physics objects + varied pacing", not weapon count.

## Core loop
- Linear chapters alternating combat arenas, physics puzzles and vehicle stretches; tutorial tasks hidden inside the story (player gets the gravity gun before the crowbar in Ep1) [3].
- Teach-test-twist: introduce a tool in a safe room, test it in a small puzzle, twist it in a combat arena (e.g. launch sawblades, catch grenades). Pattern inferred from [1][3]; Valve's own phrase not verified.
- Development method: level designers built grey placeholder maps for pathing and playtests before artists touched them; split design from art [10].
- Playtesting rule: Valve cuts liked features that tests reject (Ep1 power-box flashlight sequence dropped) [9]. Small art changes (a texture behind a ladder) can derail a test because players lose the route [9].
- Ep1: Alyx as AI companion; her code was described as "personality" code; she lights dark areas so the player saves ammo, gives covering fire, comments on player actions, and talks less at times to avoid intrusion; "hero moments" let the player act alone while she praises [3].
- Ep2: vehicle sections interleaved; Hunters; Magnusson devices stuck on Striders with the gravity gun [4].

## Movement
- Sprint uses suit aux power; crouch-jump, ladders, swimming, airboat and buggy exist [1]. Numbers (unverified, memory): walk about 150 u/s, sprint about 190 u/s, crouch-jump reaches higher ledges; aux power drains while sprinting/flashlight/underwater and recharges when idle.
- Vehicles: airboat (canal travel) and dune buggy (coast) [1]. Jet ski was replaced by airboat late (March 2004 build) [1].
- Ep2 expanded vehicle use in open areas; GameSpy and NYT found the opening of Ep2 weaker and less driven [4].

## Weapons and equipment
| Weapon | Damage | Mag | Reserve | Alt-fire | Src |
|---|---|---|---|---|---|
| Crowbar | 10 | - | inf | - | [8] |
| USP pistol | 5 | 18 | 150 | - | [8] |
| MP7 SMG | 4 | 45 | 225 | grenade launcher, 3 grenades | [8] |
| SPAS-12 | 8 per pellet (56 primary, 84 double) | 6 (unverified) | 30 (unverified) | double blast | [8] |
| .357 Python | 40 | 6 (unverified) | 12 (unverified) | - | [8] |
| Pulse rifle (OSIPR) | 8 per pulse | 30 | 60 | energy ball, 1000 dmg, 3 carried | [8] |
| Crossbow | 100 | 1 | 10 | - | [8] |
| RPG | 100 player / 50 NPC | 1 | 3 | laser guidance (unverified) | [8] |
| Frag grenade | up to 75 (vs. Combine) | - | 5 (unverified) | - | [6] |
| Bugbait / pheropods | none | - | inf | call antlions to the target; squeeze to recall | [8] |
- Gravity gun: infinite ammo; secondary pulls and holds light-to-medium objects, primary launches the held object or shoves distant ones; held item is consumed per launch; damage depends on the object (barrels and propane tanks can one-shot a soldier, plastic crates and pallets barely hurt) [5]. Grenades can be caught and thrown back; manhacks and scanners can be grabbed and punted; headcrabs shoved; antlions flipped [5]. Exploding barrels can backfire if shot while held [5].
- Supercharged gun (Citadel): glows blue; lifts heavy objects and Combine interfaces; primary fire kills a soldier instantly, secondary grab kills on contact; Ep1 fires at trigger speed [5].
- Ep2 gave no new guns; designers added easier ammo for the gravity gun (logs, half-height butane tanks) [4].

## Abilities and items
- HEV suit: flashlight, sprint, underwater air, armor; health and armor pickups plus wall chargers. Exact absorption percent (about 80% of damage to armor) unverified.
- Bugbait: antlion allies become a mini-squad you command [1].
- Magnusson devices (Ep2): gravity-gun-attached bombs; any shot detonates; hunters target them first [4].

## Health and damage
- Regenerating nothing: health via kits/chargers; armor absorbs a share of damage (unverified numbers). Difficulty scales damage and soldier toughness [6].
- Combine soldier health 50 [6]. Upper-body hits make soldiers crouch (can cause misses); leg hits make them back off while firing [6].
- Hunter flechettes kill a human soldier fast; unexploded flechettes detonate after a delay [4].

## Modes and match options
- HL2 Deathmatch (Nov 30 2004): DM and Team DM (Resistance vs Combine); instant respawn with 100 health and default weapons; weapons and ammo lost on death; weapons spawn at fixed points; sprint and flashlight kept; server-defined limits; self-kills cost points; team-kill penalty of one point [2]. Praised for gravity gun and fast pace [2].
- Ideas to convert: physics-weapon DM, "gravity gun only" mutator, prop-launch kill credit, Alyx-style bot ally mode.

## Map design
- Grey-box first, art later; "orange map" pathing playtests [10]. Lighting and texture cues guide routes; one altered texture changed tester routing [9].
- Lost Coast + 2024 anniversary update added 3.5 hours of developer commentary (explains design choices) [10 snippet].
- Ep1 reduced pacing risk by interleaving combat, puzzle, and exploration; Ep2 alternated open vehicle areas with linear indoor fights [3][4].
- Source: Combine Citadel and City 17 were visually modified to show the player's impact [3].

## Bots and AI
- Combine Overwatch soldier: squads of about 4-6, flank, give covering fire, throw grenades to scatter and force cover-leaving, melee when adjacent, seek cover when hurt or reloading, radio chatter (voice leaks past helmets) [6]. AI Learning page confirms squad "slots" (attack, grenade) that let squadmates take turns (search snippet; page itself blocked) [12].
- Variants: shotgunner, elite, prison guard, sniper with visible blue laser who shoots anything that moves [6].
- Ep1 soldiers crouch under fire; later patches adjusted pain sounds [3][6].
- Antlions: blind, track vibration; startle when walking on non-sand; avoid water, drown if lured in; castes soldier, spitter, worker, guard, guardian [7]. Antlion claws instantly kill soldiers, so factions fight each other [6].
- Hunters: packs, strong, flee-then-counter design, explosives and the pulse energy ball best [4].
- Perception design hints for bots: squad token system (limit simultaneous attackers/grenadiers), cover seek on low health or reload, crouch on upper-body hit, back off on leg hit.

## Progression
- Weapons and ammo found linearly chapter by chapter; no XP. Ep1/Ep2 add no new guns, only new uses and enemies [3][4].

## HUD and options
- Closed captions with sound-effect captions were a Source feature (key idea for accessibility); described in task brief; page text not verified in fetched sources.
- HUD: health, armor, ammo, aux power bar, minimal clutter; difficulty selection (easy, normal, hard).

## Best features to keep
- Gravity-gun-style tool: one verb set (pull, hold, launch) that reuses every prop as ammo and shield [5].
- Throw-back grenades [5].
- Squad bots with slots, flanking, chatter [6].
- Ally NPC personality code (Alyx) [3].
- Grey-box then art; commentary mode [10].

## Mistakes to avoid
- Vehicle stretches that overstay: Ep2's opening and vehicle segments drew weak-start and lack-of-drive complaints [4]; Ep1 criticized for 4-6 hour length and few new weapons or locations [3]. Broader "vehicle sections overstay" opinion unverified in fetched sources.
- Required login/registration friction hurt launch reception [1].
- Frame-rate issues on console ports [1].
- Testing: unannounced art tweaks break routing [9].

## Adaptation notes
- Physics: 6-20 simple rigid bodies (sphere/box, no stacking, no joints) with fixed timestep and sleep after 1 s; launch impulse scaled by mass; damage = speed x mass clamped. (design suggestion, no source)
- Gravity gun: raycast pick, spring-to-target hold, mass cap; super variant = no cap + kill on touch as pickup/mutator.
- Bot squads: central coordinator hands out "attack", "grenade" and "flank" tokens each 0.5 s; cheap navmesh or waypoint graph.
- Vehicles: a single arena buggy with arcade physics; keep bounded sections.
- Mobile: skip HDR; use baked vertex-color lighting; cap dynamic objects.

## Sources
1. Half-Life 2 - Wikipedia - https://en.wikipedia.org/wiki/Half-Life_2 - wiki
2. Half-Life 2: Deathmatch - Wikipedia - https://en.wikipedia.org/wiki/Half-Life_2:_Deathmatch - wiki
3. Half-Life 2: Episode One - Wikipedia - https://en.wikipedia.org/wiki/Half-Life_2:_Episode_One - wiki
4. Half-Life 2: Episode Two - Wikipedia - https://en.wikipedia.org/wiki/Half-Life_2:_Episode_Two - wiki
5. Gravity Gun - Combine OverWiki - https://combineoverwiki.net/wiki/Gravity_Gun - wiki
6. Overwatch Soldier - Combine OverWiki - https://combineoverwiki.net/wiki/Overwatch_Soldier - wiki
7. Antlion - Combine OverWiki - https://combineoverwiki.net/wiki/Antlion - wiki
8. HL2 Weapons Guide - gamertagmythras - https://gamertagmythras.com/blog/half-life-2/half-life-2-weapons-guide - guide
9. Valve's Faliszek: Playtesters Aren't Idiots - Game Developer - https://www.gamedeveloper.com/game-platforms/valve-s-faliszek-playtesters-aren-t-idiots-it-s-you - talk
10. Half-Life 2 Interview (Doug Lombardi) - Shacknews - https://www.shacknews.com/article/28100/half-life-2-interview - review (search snippet only)
11. Half-Life 2: Lost Coast - Wikipedia - https://en.wikipedia.org/wiki/Half-Life_2:_Lost_Coast - wiki (search snippet only)
12. AI Learning: CombineSoldier - Valve Developer Community - https://developer.valvesoftware.com/wiki/AILearn_CombineSoldier - wiki (search snippet only; fetch returned 403)

Gaps: Fandom, VDC, StrategyWiki fetches were blocked (402/403); aux power, sprint speed, suit absorption, and several ammo/mag values are unverified.
