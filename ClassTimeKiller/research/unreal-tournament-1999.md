# Unreal Tournament (1999, "UT99" / GOTY)

Source tags [Sn] refer to the list at the end. "unverified" = memory or snippet only.

## Identity
- Epic Games / Digital Extremes, Nov 1999, Unreal Engine 1. Arena FPS built for multiplayer; single player is a ladder of bot matches. [S1]
- Critic score: Metacritic 92 (PC); about 2 million copies by Nov 2001; four bonus packs added maps, characters and "relics". [S1]
- Every weapon has primary and alternate fire. Ports: PS2 (77), Dreamcast (dropped Assault). [S1]

## Core loop
- Spawn with Enforcer + Impact Hammer (Chainsaw via mutator). Collect weapons, armor, health, powerups; kill for frags. [S1][S3]
- Single player: tournament ladder up to the champion Xan Kriegor, with practice mode available. [S1]
- Frag limit and time limit adjustable. Default values, warmup length and overtime rules: not retrieved (unverified). The game ends on frag/time limit; CTF has a cap limit.
- Weapon Stay (weapons stay after pickup in DM; each player may pick each once) is an option widely used (unverified source).
- Deaths: respawn at random start points; telefrag kills a player who spawns on you (unverified source).

## Movement
- Moves: walk/run, crouch, jump, dodge (double-tap a direction), underwater swim. UT99 has dodge but no double jump or wall dodge in the base game; those arrived in UT2003. [S9][S10]
- Dodge: double-tap gives a quick horizontal leap with small upward boost; works even from standing. Dodge roll on landing exists in community docs. [S10][S12]
- Jump Boots powerup gives a boosted jump and multiple extra jumps (limited charges) (unverified numbers). [S1][S12]
- Impact Hammer jumps: fire at the ground mid-air for extra height; a charged shot gives more boost but hurts you. [S8]
- Translocator: instant-throw module, infinite charges, fires 0.5/s; telefrags enemies when it lands on them. [S11]
- Numbers: ground speed, gravity (a legacy value near 950 UU/s²) and jump Z (around 325) are unverified recollections; no sourced table found.
- Fall damage exists; lava/slime hurt; water has swimming. (unverified numbers)

## Weapons and equipment
Numbers from the Liandri Archives mirror. [S3]-[S9], [S15]
| Weapon | Primary | Alt | Ammo (weapon / pickup / max) | Notes |
|---|---|---|---|---|
| Impact Hammer | up to 135 charged, auto-release after 1.33 s | 30, 1.35/s | none | Used for hammer jumps |
| Enforcer | 25 per hit, 2.8/s, spread 0.5° | 25, 3.8/s, spread 1.1-9.6° | 30 / 20 or 50 / 199 | Second Enforcer = dual wield, doubles output |
| Bio Rifle | 60 max, 3.84/s | 112 max (1 ammo) charge, full in 4.1 s (10 ammo) | 25 / 25 / 100 | Sticky goo |
| Shock Rifle | 60 hitscan, 1.4/s | 82 max ball, under 1.4/s | 20 / 10 / 50 | Combo (shoot ball with primary) up to 247, costs 2 ammo |
| Pulse Gun | 30 plasma bolt, 6.1/s | beam about 108 dmg/s, 4.58 ammo/s, range 810 uu | 60 / 25 / 199 | Called Link Gun in later games |
| Ripper | 45 (157 headshot), 2.9/s | 51 explosive disc, 1.5/s, splash 180 uu | 15 / 25 / 75 | Ricocheting blades (3 or 6 bounces, sources differ) |
| Minigun | 15-21, 8.5/s | 15-21, 13.75/s | 50 / 50 / 199 | Rate varies with server tick |
| Flak Cannon | 24-192 shards (spread) | 225 max (105 impact + 5 shrapnel x 24) | 10 / 10 / 50 | Alt is lobbed shell |
| Rocket Launcher (Eightball) | 112, 1.2/s, splash 220 uu | 120 (grenade mode), splash 200 uu | 6 / 12 / 48 | Load up to 6 rockets |
| Sniper Rifle | 67 (150 headshot), 0.6/s | zoom up to 8x | 8 / 10 or 1 / 50 | Headshot scoring |
| Redeemer | 1500 damage, 1 shot, slow | guided mode | 1 / 1 / 2 | Nuke; can be steered |
- Weapon respawn and stay: unverified. Hitscan (Shock, Sniper, Enforcer) vs projectiles (Rocket, Pulse, Ripper, Flak) balance is deliberate. [S1]
- Headshots on sniper/ripper multiply damage as listed.
- Mutator "Instant Rockets" fires one rocket at a time. [S13]

## Abilities and items
| Item | Value | Respawn |
|---|---|---|
| Health Vial | +5, up to 199 | 18.2 s |
| Health Pack | +20, up to 100 | 18.2 s |
| Big Keg O' Health | +100, up to 199 | 90.9 s |
| Thigh Pads | 50 armor, absorbs 50% | 27.3 s |
| Body Armor | 100 armor, absorbs 75% | 27.3 s |
| Shield Belt | 150 armor, absorbs 100% | 54.5 s |
| Damage Amplifier | x3 damage, 27 s | 109.1 s |
| Others | Invisibility, Jump Boots | unverified |
- Pads and Body Armor combine; Shield Belt replaces everything; total armor cap 150. [S14]
- Health displayed max 100 for normal packs, 199 for super items (does not decay as in Q3; health page mentions no decay). [S16]
- Redeemer is the superweapon pickup (limit 1 per map typically).

## Health and damage
- Start 100 health. Normal cap 100, super cap 199. [S16]
- Armor absorption as table above. [S14]
- Headshots (sniper, enforcer?) multiply damage; Ripper headshot 157 as listed. [S9]
- Self-damage and splash: radius figures only for rockets (220/200 uu) and Ripper alt (180 uu). [S5][S6]
- Telefrag via translocator. [S11]

## Modes and match options
- Deathmatch, Team Deathmatch (up to 4 teams), CTF, Domination (3 points on standard maps; 1 point per 5 s per held point), Assault (attack/defend objectives in order, swap, compare times), Last Man Standing (equal lives, all weapons at max, 100 armor, only pickup antigrav boots), plus Challenge/Tournament. [S1][S2][S17][S18]
- Assault objectives: Destroy and Reach types; round 5-15 min. [S18]
- CTF: dropped flag resets after 15 s untouched (UT); cannot return your own flag while yours is stolen. [S19]
- Mutators: Arena, Chainsaw Melee, FatBoy, Instagib DM, Instant Rockets, Jump Match, Low Gravity, No Redeemer, No Powerups, Relics, Stealth, Team Beacon, Volatile Ammo, Volatile Weapon. [S13]
- Bots can be given orders in team games. [S1]

## Map design
- Standard categories: DM-, CTF-, DOM-, AS-. Mix of space ships, outposts, castles, monasteries; elevators, teleporters, water, lava. [S1]
- Classic DM maps (Deck16, Morpheus, Tempest): vertical, multi-level, dodge-friendly, with big item spots (Shield Belt, UDamage, Keg) (unverified; DM-Deck17 shown in UT2004 only).
- CTF maps are symmetric with two flag rooms, ramps and jump-boot shortcuts.

## Bots and AI
- 8 skill levels: Novice, Average, Experienced, Skilled, Adept, Masterful, Inhuman, Godlike. [S20]
- Config per bot (UnrealScript ChallengeBotInfo): up to 32 bots; arrays for Name, Skill offset, Accuracy, CombatStyle (float -1 camp/defend ... +1 aggressive), Alertness (e.g. -0.3 to 0.4), Camping (0..1), BotJumpy (flag), FavoriteWeapon (e.g. Flak, Eightball, Sniper, Pulse, Minigun, Shock), plus voice and skin. Default examples: accuracy 0.2 to 1.0; style -1.0 to 1.0; names start with "Archon" and end with "Kragoth". [S21]
- Auto-adjust: `bAdjustSkill` default true; AdjustSkill raises/lowers a bot's skill after each win or loss versus the player; difficulty added to each bot's own skill; saved when it changes by at least 1. [S21]
- Behaviors by level (UT2004 wiki, but said to carry across UT): Novice 60% speed, doesn't move in combat, 30° FOV, aim off up to 30°; Average 70% speed; Experienced 80% speed, strafes, uses translocator; Skilled 90%, double jump (2004 only); Adept full speed, dodges, leads shots; Masterful uses hammer jumps and combos; Godlike 360° view, aim within 1°. Bots dodge projectiles instantly; spawns and item locations are treated as safe. [S20]
- Squads: volunteers join a leader; followers can briefly detour. [S20]
- Reception: PC Zone called the bots very intelligent; Adept+ bots are disliked for unhuman aim (excellent with flak/minigun/link at close range, weak with others). [S1][S20]
- Taunts/voices exist as voice packs (unverified detail).

## Progression
- Tournament ladder in separate gametypes: DM, DOM, CTF, Assault, Challenge; win to progress to Xan. Difficulty selectable. [S1][S21]
- Unlockables: characters/skins (unverified).

## HUD and options
- Minimal HUD with health, armor, ammo, weapon bar; mutators and settings in menus; weapon priority list configurable; sniper zoom up to 8x. [S1][S9]
- Announcer voice: "Killing Spree", "Rampage", "Godlike" ladder, "Double Kill", "Headshot" (known; no fetched source). Console ports differ in HUD.

## Best features to keep
- Alt-fire per weapon doubles tactical depth with the same slot count.
- Shock combo (primary-hits-secondary), flak/rocket split roles. [S4][S5]
- Dodging and translocator as light movement tools that are easy to learn.
- Mutator system: Instagib, Low Gravity, Arena, Vampire-like toys with almost no code. [S13]
- Large number of modes sharing one engine; Last Man Standing / Domination are cheap for bots.
- Bot configuration of accuracy/combat style/alertness/camping/favorite weapon per bot and auto-adjusting skill. [S21]

## Mistakes to avoid
- High-skill bots with inhuman aim and instant projectile reactions feel unfair; avoid perfect dodging. [S20]
- Bots stuck due to bad path data, retrying forever. [S20]
- Console ports: slow frame rates, sluggish gameplay, dropped modes (Dreamcast); high system requirements and menu UI criticized on Mac. [S1]
- Player model variety low (Game Revolution) and music criticized (PC Zone). [S1]
- Lots of randomness in minigun rate vs tick; avoid frame-rate dependent rates (use fixed timing). [S6]

## Adaptation notes
- Keep all weapons within the hitscan/projectile budget: 2-3 projectile types on screen is fine on integrated GPUs.
- Translocator = teleport capsule with 0.5/s throw; telefrag on land.
- Armor system: store one number plus absorption; Shield Belt replaces. Respawn timers as above make bots' item timing simple.
- Bot AI: use the ChallengeBotInfo parameter set (accuracy, style, alertness, camping, jumpy, favorite weapon) and map the skill ladder to speed %, FOV, turn rate and aim error from the table above.
- Auto skill adjust: simple +/- after each match.
- Mutators as boolean flags in a rules object.

## Sources
1. Unreal Tournament (Wikipedia) - https://en.wikipedia.org/wiki/Unreal_Tournament - reference/review
2. Liandri Archives (Unreal Archive mirror) Ripper - https://unrealarchive.org/wikis/the-liandri-archives/Ripper.html - wiki
3. Shock Rifle - https://unrealarchive.org/wikis/the-liandri-archives/Shock_Rifle.html - wiki
4. Flak Cannon - https://unrealarchive.org/wikis/the-liandri-archives/Flak_Cannon.html - wiki
5. Rocket Launcher - https://unrealarchive.org/wikis/the-liandri-archives/Rocket_Launcher.html - wiki
6. Minigun - https://unrealarchive.org/wikis/the-liandri-archives/Minigun.html - wiki
7. Sniper Rifle - https://unrealarchive.org/wikis/the-liandri-archives/Sniper_Rifle.html - wiki
8. Impact Hammer - https://unrealarchive.org/wikis/the-liandri-archives/Impact_Hammer.html - wiki
9. Enforcer - https://unrealarchive.org/wikis/the-liandri-archives/Enforcer.html - wiki
10. Dodging - https://unrealarchive.org/wikis/the-liandri-archives/Dodging.html - wiki
11. Translocator - https://unrealarchive.org/wikis/the-liandri-archives/Translocator.html - wiki
12. Movement Mechanics (Unreal Tournament) - https://unrealcommunity.wiki/movement-mechanics-(unreal-tournament)-pp55nh62 - wiki
13. Mutators by game - https://unrealarchive.org/wikis/the-liandri-archives/Mutator.html - wiki
14. Armor - https://unrealarchive.org/wikis/the-liandri-archives/Armor.html - wiki
15. Bio Rifle, Link/Pulse Gun, Redeemer pages - https://unrealarchive.org/wikis/the-liandri-archives/Bio_Rifle.html , .../Link_Gun.html , .../Redeemer.html - wiki
16. Health - https://unrealarchive.org/wikis/the-liandri-archives/Health.html - wiki
17. Domination and Last Man Standing - https://unrealarchive.org/wikis/the-liandri-archives/Domination.html , .../Last_Man_Standing.html - wiki
18. Assault - https://unrealarchive.org/wikis/the-liandri-archives/Assault.html - wiki
19. Capture the Flag - https://unrealarchive.org/wikis/the-liandri-archives/Capture_the_Flag.html - wiki
20. Bot (Liandri Archives) - https://www.unrealarchive.org/wikis/the-liandri-archives/Bot.html - wiki
21. Botpack.ChallengeBotInfo (UT99 UnrealScript docs, CMU archive) - https://project-archives.etc.cmu.edu/2001/fall/coyote210/Docs/undox/Botpack.ChallengeBotInfo.html - source-code/docs
22. Damage Amplifier - https://unrealarchive.org/wikis/the-liandri-archives/Damage_Amplifier.html - wiki

Gaps: UT99 movement constants, frag/time defaults, weapon respawn, Jump Boots/Invisibility values, announcer list, and tournament ladder details were not found in fetchable sources (Liandri and Unreal Wiki direct domains returned 403).
