# Quake III Arena (1999) + Team Arena (2000)

Source tags like [S3] point to the numbered list at the end. Values marked "unverified" came from memory or a single weak snippet, not from a fetched source.

## Identity
- id Software arena FPS, Dec 1999, engine idTech 3. No story campaign: the "single player" is a bot-match ladder. [S1]
- Modes in the released source: Free For All, Tournament (1v1), Single Player, Team DM, CTF; Team Arena adds One-Flag CTF, Obelisk (Overload), Harvester. [S5][S6]
- Team Arena (Dec 2000) added Chaingun, Nailgun, Proximity Launcher, persistent "rune" powerups, and holdables (Kamikaze, Portal, Invulnerability). Bundled in "Quake III Gold" (2001). [S1][S9]
- Critical standing: PC aggregate about 84% on GameRankings; praised for speed and curved geometry; IGN found weapons "bland and predictable"; some multiplayer levels judged too crowded. [S1]

## Core loop
- Spawn with Gauntlet + Machinegun (100 health, 100 ammo on MG in practice; unverified). On death you drop the weapon you held for others to take. [S1]
- Control the map: weapons, armor, Mega Health, and timed powerups. Kill, take the item cycle, repeat.
- Defaults in the game code: fraglimit 20, timelimit 0 (off), capturelimit 8, warmup 20 s (when enabled), forced respawn after 20 s, friendly fire off. [S12]
- Ties: when scores are tied, time/frag/capture-limit checks are skipped, so play continues until someone leads (this is the whole "sudden death" implementation: no separate flag). [S12]
- Fraglimit applies to non-CTF modes; capturelimit to CTF-family modes. [S12]
- Intermission begins about 1 s after the end; single-player intermission about 5 s. [S8]
- Score: +1 for a kill; -1 for suicide, world death, or killing a teammate. [S7]
- Respawn: the dead player can respawn on pressing attack/use once the delay has passed, or automatically after the forced-respawn timer. [S4]

## Movement
Constants from the shipped source (units are Quake units). [S2][S10][S12]
| Item | Value |
|---|---|
| Run speed (g_speed) | 320 |
| Gravity | 800 |
| Jump velocity | 270 |
| Step height | 18 |
| Max walkable slope normal | 0.7 |
| Ground friction / stop speed | 6 / 100 |
| Ground acceleration | 10 |
| Air acceleration | 1 (very low) |
| Water accel / friction | 4 / 1 |
| Crouch speed | 25% of run |
| Swim speed | 50% |
| Hull | 30 wide, 56 tall standing (top 32 above origin), 40-ish crouched (top 16) |
| View height | 26 standing, 12 crouched |
| Haste | movement x1.3 [S4] |
| Water jump | 200 forward, 350 up |
- Strafe jumping: air movement caps only the projection of velocity on the wished direction, so turning in the air while holding strafe adds speed beyond 320. This is a left-in "bug" that became the skill core of the game. [S2]
- Holding jump does not auto-repeat; you must release (so no free bunny-hop by holding). Landing after a very fast fall locks jumping for 250 ms. [S2]
- Rocket jump: self damage is halved and applied after knockback, so rocket jumps work at a health cost. [S7]
- Knockback: equals damage (cap 200); velocity change = direction x g_knockback(1000) x knockback / 200 (unscaled by mass in code summary). [S7]
- Jump pads (trigger_push), teleporters, and the optional grapple hook exist. The personal teleporter and medkit are holdable items (60 s quantity listed as item value). [S3]
- Fall damage: fall speed squared x 0.0001 decides the landing event; actual damage is 5 (medium fall) or 10 (hard fall); battle suit blocks it. [S2][S4][S7]
- Drowning: 12 s of air; damage starts at 2 and rises 2 per second to 15; ignores armor. Lava 30/tick x level, slime 10/tick x level. Battle suit blocks both. [S4]
- Lift jumps and plasma/rocket climbs are standard map-flow techniques (design knowledge, unverified source).

## Weapons and equipment
Damage, speed, splash from game code [S3][S11]; fire interval from `bg_pmove` [S2]; lightning range 768, shotgun 11 pellets spread 700 [S10]; ammo cap 200 per type [S3].
| Weapon | Slot | Damage | Interval | Pickup ammo (weapon / box) | Notes |
|---|---|---|---|---|---|
| Gauntlet | 1 | 50 melee, reach 32 | 400 ms | none | Instant humiliation medal on kill [S7] |
| Machinegun | 2 | 7 (5 in team games) | 100 ms | 40 / 50 | Hitscan, spread 200 |
| Shotgun | 3 | 10 per pellet x 11 | 1000 ms | 10 / 10 | Hitscan, spread 700 |
| Grenade Launcher | 4 | 100 direct, 100 splash, radius 150 | 800 ms | 10 / 5 | Speed 700, gravity, bounces, 2.5 s fuse |
| Rocket Launcher | 5 | 100 direct, 100 splash, radius 120 | 800 ms | 10 / 5 | Speed 900, 15 s life |
| Lightning Gun | 6 | 8 per tick (160/s) | 50 ms | 100 / 60 | Hitscan beam, range 768 |
| Railgun | 7 | 100 | 1500 ms | 10 / 10 | Hitscan, passes through up to 4 targets; "Impressive" for 2 hits in a row |
| Plasma Gun | 8 | 20 direct, 15 splash, radius 20 | 100 ms | 50 / 30 | Speed 2000, 10 s life |
| BFG10K | 9 | 100 direct, 100 splash, radius 120 | 200 ms | 20 / 15 | Speed 2000; effectively a rapid rocket launcher [S1] |
| Grappling Hook | - | - | 400 ms | unlimited | Optional |
| Chaingun (TA) | - | 7 | 30 ms | 80 / 100 | Spread 600 |
| Nailgun (TA) | - | 20 per nail, 15 nails/shot | 1000 ms | 10 / 20 | Nail speeds random 555-2355, spread 500 |
| Prox Launcher (TA) | - | 100 splash, radius 150 | 800 ms | 5 / 10 | Sticks to surfaces/players; 2 s arming, 10 s fuse on player |
- Ammo use: 1 per shot; empty click adds 500 ms delay. Haste divides fire interval by 1.3. Quad multiplies damage x3 (g_quadfactor 3). [S2][S12]
- Role balance: Railgun long range, Lightning close/mid, Rocket Launcher all-purpose, BFG hidden power spot. Hitscan vs projectile is roughly 50/50. [S1]
- Weapon respawn: 5 s in FFA, 30 s in team modes (cvars). Weapons give ammo on pickup if you already own them. [S12]
- Q3 weapons have one fire mode each (no alt-fire). This is the main design difference versus UT.

## Abilities and items
| Item | Amount | Respawn |
|---|---|---|
| Armor shard | +5 armor | 25 s |
| Yellow armor | +50 | 25 s |
| Red armor | +100 | 25 s |
| Health (small) | +5, can go to 200 | 35 s |
| Health 25 | +25, caps at 100 | 35 s |
| Health 50 | +50, caps at 100 | 35 s |
| Mega Health | +100, up to 200 | 35 s per code (commented alternative 120; real maps often use 35 or timer-based) [S4] |
| Quad Damage | 30 s, x3 damage | 120 s |
| Battle Suit | 30 s, half damage, immune to splash/lava/slime/falling | 120 s |
| Haste | 30 s, x1.3 speed and fire rate | 120 s |
| Invisibility | 30 s | 120 s |
| Regeneration | 30 s; +15/s below max (cap 110%), +5/s above max up to 200 | 120 s |
| Flight | 60 s | 120 s |
| Personal Teleporter | holdable | 60 s |
| Medkit | holdable, health to max+25 | 60 s |
- Table sources: [S3][S4]. Armor and health values above max cap at 200 and both lose 1 point per second while above max. [S4][S12]
- First powerups spawn about 45 s (±15) after map start; dropped items vanish after 30 s. Item timing is the core of map control. [S4]
- TA persistent powerups: Scout, Guard, Doubler, Ammo Regen; holdables Kamikaze, Portal, Invulnerability. Guard doubles max health/armor; Scout halves health and gives speed/fire boost. [S3][S4]

## Health and damage
- Start 100 health, 0 armor; max 100 (200 with overheal); armor cap 200. [S4]
- Armor absorbs 66% of incoming damage (ARMOR_PROTECTION 0.66); armor soaks ceil(damage x 0.66), limited by remaining armor. [S10][S7]
- Minimum 1 damage per hit that gets through. Self-damage is halved. Team damage ignored unless friendly fire. [S7]
- Gib threshold: -40 health; suicide always gibs. [S10][S7]
- Telefrag: spawning into someone kills them (damage logic not in the game file; known behavior). [S7]
- Handicap: attacker damage scales with their max health / 100. Bots get a handicap at low skill: 50 (skill 1-2), 70 (2-3), 90 (3-4), none at 4+. [S7][S8]
- Medals: Excellent (2 kills in 3 s), Impressive (2 consecutive railgun hits), Humiliation (Gauntlet kill), plus Capture/Assist/Defend in CTF. [S7][S8]
- Knockback is not scaled by armor; low health plus rocket splash is how self-kills happen.

## Modes and match options
- FFA, 1v1 Tournament, Team DM (usually 4v4), CTF (symmetrical maps), plus TA modes. [S1]
- CTF scoring constants exist (capture, flag pickup, team bonus, flag return, carrier frag, flag defense, carrier protect, assists) but numeric values were not retrievable; the known set is capture 5 / team 10 / carrier kill 2 / return 1 etc. (unverified recollection). [S13]
- Options: fraglimit, timelimit, capturelimit, friendly fire, team force-balance, forced respawn, warmup, weapon respawn, knockback, quad factor, gravity, speed, handicap. [S12][S1]
- Bot fill: `bot_minplayers` (checked every 10 s) auto-adds/removes bots per team; capped at half of max clients minus 1 per team. [S8]
- Skill: `g_spSkill` 1-5, default bot skill 4 when none given. [S8]
- No mutators in the base game; mods did them. Instagib-style modes were mod territory (unverified).

## Map design
- Item-based control: Red armor + Mega Health on strong positions, rocket launcher and railgun contested, powerups on timers. [S4][S1]
- Maps are compact for 2-4 players (duel), larger for CTF. Verticality via jump pads, teleporters, and jump-friendly ledges.
- q3dm17 "The Longest Yard" (known fan-favorite): open sky arena with floating platforms and jump pads, railgun/Quad in risk spots (design recollection, unverified source).
- Curved surfaces and low-poly bevels give a "soft" feel; lifts, teleport loops and one-way flows reduce dead ends. [S1]
- CTF maps are mirrored with two flag rooms and mid routes.

## Bots and AI
Architecture: bot library with AAS area navigation (precomputed area graph from the BSP) plus game-side state machine and fuzzy goal scoring, written by J. P. van Waveren (Mr. Elusive), who also did the Quake II Gladiator bot. [S1][S14][S15]
- **Skill levels:** 5 (I Can Win, Bring It On, Hurt Me Plenty, Hardcore, Nightmare). Each bot defines characteristic sets for skills 1, 4, 5; 2 and 3 are interpolated. [S16]
- **Characteristics (all 0..1 floats unless noted):** attack_skill (0 stands still; mid retreats while aiming; high circle-strafes), view_factor, view_maxchange (1-360), reaction_time (0-5 s), aim_accuracy (+ per-weapon), aim_skill (prediction/leading, per-weapon for rockets/grenades/plasma/BFG), firethrottle, croucher, jumper, walker, weaponjumping, grapple_user, aggression, self_preservation, vengefulness, camper, easy_fragger, alertness, plus chat tendencies (insult, misc, start/end, enter/exit, kill, death, enemy suicide, hit talking, hit no death, hit no kill, random, reply, typing speed CPM 1-4000). Also weapon-weight and item-weight files per bot. [S16]
- **Aggression logic:** fixed 70 with Quad; 0 if enemy 200+ units above, health below 60, or health under 80 with armor under 40. Else best weapon decides: BFG (>7) 100, Rail (>5) 95, Lightning (>50) and Rocket (>5) 90, Plasma (>40) 85, Grenade (>10) 80, Shotgun (>10) 50. [S17]
- **Retreat** if aggression <50 (or carrying flag/cubes); **chase** if aggression >50 or enemy has your flag; "feeling bad" scores (health <40 = 100, <60 = 80) trigger fleeing. [S17]
- **Camping:** needs camper >= 0.1, aggression >= 50 and a strong weapon (10+ rockets/slugs/BFG); camp time 120 + 180 x camper (+ up to 15 s) s, unlimited at camper >0.99; cooldown about 60 s + up to 300 s. [S17]
- **Combat movement:** ideal distance 140 ±40 units; attack_skill <0.2 no movement; <=0.4 simple walk; above 0.4 strafing, flip chance ~6.5% per check, check every 0.4+(1-skill)x0.2 s; 10% back-off; jump cooldown 1 s; crouch up to croucher x 5 s. [S17]
- **Rocket jump** only if cvar on, rocket launcher, 3+ rockets, no Quad, health >=60 (armor >=40 if health <90), weaponjumper >=0.5. [S17]
- **Perception:** range^2 = (900 + alertness x 4000)^2; FOV 360° if hurt, else ~180° at 810 units down to ~90° at point blank; water halves visibility; invisible targets ignored unless shooting; easy-fragger <0.5 ignores chatting players; after teleports, enemies near exit ignored 3 s. [S17]
- **Aiming:** aim_skill >0.95 waits half reaction time; velocity sampled every 0.5 s; exact prediction above 0.8, linear above 0.4; splash weapons aim at floor in front above 0.6; accuracy adds random error x (1-accuracy). [S17]
- **State machine:** Stand, Respawn (1-2 s), Observer, Seek LTG (long-term goal, 20 s timer, nearby-item check every 0.5 s), Seek NBG (nearest better goal), Battle Fight / Chase (10 s) / Retreat (leave if enemy unseen 4 s) / NBG. Stuck handling clears avoid-reach data and re-picks goals. Carrying flag shrinks item search range to 50-80 units. [S18]
- **Teamwork:** one team leader (human if present, else bots negotiate after 5-15 s). Orders: defend, get flag, return flag, harvest, accompany (escort), camp, patrol. CTF role split by teammates sorted by travel time; examples: both flags home passive = about 50% defend / 40% attack; enemy flag away = 60% defend / 30% escort; strategy flips passive/aggressive with 40% chance every 240 s if no capture. Orders re-issue: TDM 5 s then every 120 s; CTF 3 s after change; Harvester/Obelisk every 30 s. Decision cooldown 5 s. [S19]
- **Bot management:** `bots.txt` entries have name, funname, model, headmodel, gender, color1/2, aifile; roster picks randomly without duplicates; bots are queued with 1.5 s spacing. [S8]
- **Taunts/chat:** scripted lines by R. A. Salvatore and others; replies to certain typed phrases. [S1]
- **Fairness:** Bots have no wallhack but can react perfectly; skill 5 bots are unchallenging for strong players yet punishing for newcomers (S1 plus forum opinion). Xaero is modelled on the Gladiator bot "Zero". [S1]
- Bot roster tiers: Crash (Tier 0) through Xaero (Tier 7). [S1]

## Progression
- Single player: 8 tiers (0-7), each a group of arenas, with FFA/Tournament/CTF variants; difficulty chosen before each match; win to unlock the next tier; final opponent Xaero. [S1][S20]
- No unlockable weapons; only maps/tiers. No XP.

## HUD and options
- Minimal HUD: health, armor, ammo, weapon bar, scoreboard; medals with sprite shown 2 s; carnage window 3 s for Excellent. [S9]
- Announcer voice: "First blood/Frag limit" style calls, countdown, "You have taken the lead"; medal icons. (Voice lines not documented in sources.)
- Options: FOV, crosshair choice and size, weapon auto-switch and bob toggles, handicap. [S1]

## Best features to keep
- Tight deterministic movement with learnable skill (strafe jump), but optional so newcomers can still play.
- Overheal decay (1/s) forces item routing and prevents hoarding. [S4]
- Armor 66% absorption: simple, readable.
- Short weapon list with a clear role each and timed powerups on a 120 s clock.
- Bot characteristics file design: a small number of 0..1 traits drive everything and create distinct personalities cheaply. [S16]
- Item respawn timers 25/35/120 s give a fixed rhythm for bots to schedule.

## Mistakes to avoid
- Steep skill barrier: strafe jumping and aim demands made newcomers feel crushed by Nightmare bots and online players. Offer a gentler low-end ladder and an "air control" assist option. [S1] (review and community opinion)
- Hardcore bots can feel "robotic" with perfect reactions; give bots reaction jitter and misses. [S1]
- Spawn kills and map-control snowball: the leader keeps taking Red armor and Mega Health; counter with catch-up spawns and weapon drops. (Genre-wide criticism, unverified.)
- Weapon variety called bland by IGN; Team Arena was seen as late and already done by mods. [S1]
- Crowded multiplayer levels. [S1]
- PS2/console version issues (load times, no mouse) show the cost of ignoring input design. [S1]

## Adaptation notes
- Use fixed tick physics (the Q3 pmove is built for 125 Hz style fixed steps) with the numbers above; implement strafe jumping with the "project wish speed" rule and air accel 1 for a Quake feel. On touch/gamepad, add an optional auto-strafe/air-assist.
- Hitscan with simple raycasts against a small capsule/box scene is cheap; keep projectile count low (rocket/plasma pools). Splash falloff linear within radius (design choice).
- Replace the AAS system with a hand-authored waypoint graph or a coarse navmesh grid with travel-time weights; keep long-term goal, nearby goal, and combat states exactly as in the state machine above.
- Bot traits: implement the characteristic set above; compute aggression from health/armor/weapon table; item schedule uses known timers (25/35/120).
- Sudden death = simply play on until a lead exists. Team orders via a leader that issues defend/attack/escort with percentage splits.
- Keep draw cost low: flat-shaded or vertex-coloured geometry, no real-time shadows, simple particle quads.

## Sources
1. Quake III Arena (Wikipedia) - https://en.wikipedia.org/wiki/Quake_III_Arena - reference/review
2. bg_pmove.c, Quake III source - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/bg_pmove.c - source-code
3. bg_misc.c item table - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/bg_misc.c - source-code
4. g_active.c - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/g_active.c - source-code
5. g_items.c - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/g_items.c - source-code
6. bg_public.h - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/bg_public.h - source-code
7. g_combat.c - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/g_combat.c - source-code
8. g_bot.c - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/g_bot.c - source-code
9. g_local.h - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/g_local.h - source-code
10. bg_local.h - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/bg_local.h - source-code
11. g_missile.c and g_weapon.c - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/g_missile.c - source-code
12. g_main.c - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/g_main.c - source-code
13. g_team.c - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/g_team.c - source-code
14. Fabien Sanglard, Quake 3 AI source review - https://fabiensanglard.net/quake3/a.i.php - guide
15. J. M. P. van Waveren, "The Quake III Arena Bot" thesis (2001) - https://www.cs.rochester.edu/u/brown/242/docs/QuakeIII.pdf - official (could not open; cited via search listing only)
16. GtkRadiant Bot Manual, characteristics - https://icculus.org/gtkradiant/documentation/bot_manual/characteristics.html - manual
17. ai_dmq3.c - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/ai_dmq3.c - source-code
18. ai_dmnet.c - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/ai_dmnet.c - source-code
19. ai_team.c - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/ai_team.c - source-code
20. Quake Wiki difficulty / StrategyWiki weapons (search-snippet only) - https://quakewiki.org/wiki/Difficulty , https://strategywiki.org/wiki/Quake_III_Arena/Weapons - wiki
21. chars.h - https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/chars.h - source-code
22. justgamesretro review (snippet only) - https://www.justgamesretro.com/win/quake-iii-arena - review

Gaps: CTF numeric bonuses, Mega Health actual timer, Team Arena mode rules, medal timings, and the thesis text were not retrieved; skill-barrier criticism has no direct fetched source.
