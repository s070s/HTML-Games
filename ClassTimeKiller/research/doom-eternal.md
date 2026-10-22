# Doom Eternal (2020) + The Ancient Gods + BATTLEMODE: design notes for an original FPS clone

Method note: doomwiki.org, the Doom fandom wiki and id talks could not be fetched (403/402). Numbers come from guide sites and search excerpts; anything else is marked "unverified". Source numbers refer to the list at the end.

## Identity
- id Software, 2020. Sequel to Doom (2016). Pitch: a "brutal Nintendo game" (more Mario than Last of Us) according to creative director Hugo Martin [5]. Fast, resource-starved arena shooter where every resource is earned by a specific action.
- Campaign: 13 missions; a meter counts remaining combat encounters per level [1]. Ancient Gods Part 1 and 2 are the expansion campaigns [12][4]. BATTLEMODE is the asymmetric multiplayer [1][7]. Horde Mode was added in Oct 2021 [1]. Master Levels remix campaign missions with different enemy sets [1].
- Difficulty: five levels; higher means enemies attack more often and hit harder, but behaviour is the same [1].

## Core loop
- The "resource triangle" (all sources agree): stagger an enemy then Glory Kill it = health; chainsaw a (weak) enemy = ammo; ignite with flamethrower (Flame Belch) = armor [1]. Blood Punch (melee that breaks enemy armor) recharges from accumulating Glory Kills [1]. BFG and Crucible charges/ammo are only found as pickups inside arenas [1].
- Weapons hold less ammo than 2016, forcing weapon rotation plus chainsaw [1]. Marauder lesson per Martin: weapon swapping (a stagger long enough for one shot with most guns, two if you swap) [5].
- "Combat chess": prioritise targets by threat and kill order; enemies visibly show damage so you can read when a Glory Kill is available [1][10]. Encounters last about 2-5 minutes in the base game [4].
- Arena lock-in: arena fights are discrete encounters with waves. Waves trigger on killing specific enemies in Ancient Gods Part 1 (wrong kill summons reinforcements) versus after most big enemies are down in the base game and Part 2 [4]. Secret encounters (time-limited kills) and Slayer Gates (harder optional challenges) exist [1].
- Death: repeated deaths in one encounter offer a respawn with Sentinel Armor (big damage reduction) [1]. Extra Lives mode and Ultra-Nightmare: permadeath when lives run out; pickups can give extra lives [1]. A "berserker" pickup kills regular demons in one hit (not bosses) [1].
- Design idea: no single resource is ever free, so the player constantly switches between guns, melee and tools. This is the one feature to keep.

## Movement
- Double jump, omnidirectional dash, wall climbing, swing (monkey) bars, jump pads, portals [1]. Dash has a cooldown and does not recharge in mid-air, deliberately limiting it [6]. Two dash charges (via Praetor suit upgrade) is common knowledge but not confirmed in my sources: unverified. Meat Hook only grapples demons, not world geometry [6]. Levels were made bigger because movement is faster [6].
- Platforming sections break pace; critics call them frustrating or "mostly miss" [8][9]; some praised the variety [11].

## Weapons and equipment
Mods verified from TheGamer [2]; each weapon has two mods (Super Shotgun has the built-in Meat Hook). Mastery challenge kill counts mostly not in sources (one guide: Sticky Bomb mastery needs 25 Arachnotron turret kills with sticky bombs; Micro Missile mastery needs 15 triple-hit missiles) [3].

| Weapon | Mod 1 | Mod 2 | Mastery notes |
|---|---|---|---|
| Combat Shotgun | Sticky Bombs (grenade launcher; reload +20%, blast +45%) | Full Auto (recovery +50%, transform +50%, move +20%) | Five Spot: 5 bombs per reload; Slavo Extender: Full Auto kills drop shells [2] |
| Heavy Cannon | Precision Bolt (zoom, semi-auto, breaks weak points; move +15%, reload +20%) | Micro Missiles (seeking; recharge -35%, load -75%) | Headshot Blast; Bottomless Missiles [2][3] |
| Plasma Rifle | Heat Blast (release heat as blast) | Microwave Beam (lock on, target explodes on death; charge -66%, range +50%) | Power Surge; Concussive Blast [2] |
| Rocket Launcher | Remote Detonate (+flare, concussive blast) | Lock-On Burst (3 rockets at locked target; recharge -37.5%, lock -50%) | Explosive Array; Dual Lock [2] |
| Super Shotgun | Meat Hook (hook to demon; recharge -25%) | none (upgrade: reload -33%) | Flaming Hook: hooked enemies burn and drop armor [2] |
| Ballista | Arbalest (charged exploding bolt; move +30%, blast +60%) | Destroyer Blade (energy blade; charge -20%) | Instant Salvo; Incremental Blade [2] |
| Chaingun | Mobile Turret (turret, stalls on overheat; transform +50%) | Energy Shield (absorbs damage; recharge -37.5%) | Ultimate Cooling; Shield Launch [2] |
| BFG 9000, Crucible, Unmaykr | arena-pickup ammo/charge (BFG, Crucible per [1]); Unmaykr is Ancient Gods weapon (stats unverified) | | |
- Equipment: frag grenade, ice bomb (freezes; stops Prowler teleport, Spectre cloak) [1][3]; Blood Punch, Flame Belch, chainsaw; Ancient Gods Part 2 adds a Sentinel Hammer charged by 2 glory kills, which boosts freeze and flame resource drops and lengthens Marauder stun [4]. Slayer's Crucible blade and BFG: see above.

## Abilities and items
- Pickups (DoomWiki supplies page, via search excerpt) [7]: health potion 15, stimpack 25, medikit 50; armor shard 10, helmet 30, chestplate 50; soulsphere refills max health and armor. Start caps 100 health / 50 armor, raised by Sentinel Crystals (upgraded caps: unverified) [7].
- Runes (e.g. slow-mo on air aim), Praetor suit upgrades, extra-life and berserk pickups [1].

## Health and damage
- Enemies show visible damage; weak points strip attacks when destroyed [1]. Fast enemies dodge slow projectiles; heavy ones stomp at close range [1].
- Fodder drops (zombies) are the ammo faucet; Ancient Gods Part 1 had few fodder, making recovery hard [4].

## Modes and match options
- BATTLEMODE: 1 Slayer vs 2 demon players; five demons at launch with unique skills; demons summon AI allies the Slayer can use for health/ammo; when one demon falls the partner has 20 seconds to survive and trigger respawn, else round ends; 3 rounds, upgrade chosen after each [1]. Slayer starts with 175 health and 125 armor, best of five (patch era) [7]. Later empowered demons and Render mode [1]. Criticised for little content and not changing the core feel [1].
- Horde: Arena (waves, one weapon then random unlocks), Blitz (kill count in time limit), Traversal (platform challenges collecting coins) [1].
- Master Levels and Ultra-Nightmare/Extra Lives for replay [1].

## Map design
- Large arenas with verticality: jump pads, monkey bars, portals, wall-climb walls [1]. Secret encounters, Slayer Gates, collectibles unlock perks/modifiers; Fortress of Doom hub spends Sentinel Batteries [1].
- Ancient Gods Part 1 uses fewer, larger arenas with heavy stacking (often 2+ tyrants; one example 5 mancubi) and encounters over 5 minutes [4].

## Bots and AI
- Demon tiers (guide table [3b]): fodder (zombie, imp, soldiers, lost soul, gargoyle), mid (prowler, whiplash, revenant, cacodemon, carcass, pinky, spectre, pain elemental), heavy (mancubus, dread knight, Baron, archvile, doom hunter, tyrant), plus Marauder as "black belt" test [5].
- Weak points: Arachnotron back turret; Mancubus arm cannons; Revenant shoulder launchers; Cacodemon mouth (grenade -> glory kill); Maykr Drone head only; Doom Hunter sled; Archvile falters while summoning, fire shield broken by Blood Punch; Pain Elemental spawns lost souls (kill with ice/ballista) [3b].
- Marauder: shield-less body, summons a dog, eyes glow green = vulnerable to stagger; counter at medium range with Super Shotgun then BFG/Unmaykr [3b][5]. Martin says he is an efficiency check: clear the arena fast so you can reach him [5]. Criticised as the most frustrating enemy [8][12].
- Token system ("enemy tokens", cap on simultaneous attackers): not found in my sources; unverified. Recommended for bots anyway (see adaptation).

## Progression
- Praetor suit points, Sentinel Crystals (health/armor/ammo caps), weapon points (spend on mods and mastery), runes, Fortress batteries [1]. Mastery is tied to specific challenges [1].
- Critics: progression layers made the game "bloated" [1].

## HUD and options
- Codex lists demon weak points in-game [3b]. Five difficulties plus Extra Lives; no fine granular sliders (contrast Dark Ages) [1]. HUD details beyond health/armor/ammo/lives: unverified.

## Best features to keep
- The three-way resource triangle (melee = health, chainsaw = ammo, fire = armor): forces aggression and variety [1].
- Visible enemy damage, readable stagger flash, and weak points that disable attacks: legible combat [1][10].
- Enemies that demand specific weapons (weapon-swap pressure) [5].
- Dash with limited air use and Meat Hook limited to demons: fast but controllable [6].
- Sentinel-armor soft landing after repeated deaths [1].

## Mistakes to avoid
- Platforming and slow sections that kill flow [8][9].
- Marauder: hard counter that feels like a gate; a pain to fight [8][12]; Martin defends it, so weigh as design tension not bug [5].
- Too many systems and tutorials (progression bloat, weak-point homework) [1].
- Ancient Gods Part 1 escalation without flow: encounters over 5 min, long restarts, trigger waves that punish wrong kills; fewer than 10% of Steam players finished it [4].
- Unclear counters (ghost-possession needs the microwave mod) without a tutorial [4].

## Adaptation notes
- Offline bot game on low-end hardware: keep arena lock-in with 10-30 simple enemy types made of boxes; use few simultaneous active attackers.
- Resource triangle is cheap to implement: each action sets a pickup drop (melee kill = health, saw-type kill = ammo, burn kill = armor). Pickups are small pooled meshes.
- Versus bots: BATTLEMODE maps to 1 player vs 2 AI-controlled demons (reverse: player demon vs AI Slayer); horde = wave counter with random weapon unlocks; Blitz = timed kill count.
- Movement: one dash charge with cooldown plus double jump is enough for 120 fps phones; mobile needs a dash button and aim assist.
- Attack-token cap (my recommendation, not sourced): e.g. max 3 enemies attacking at once.

## Sources
1. Doom Eternal - Wikipedia - https://en.wikipedia.org/wiki/Doom_Eternal - wiki
2. Doom Eternal weapon mods and mastery - TheGamer - https://www.thegamer.com/doom-eternal-weapon-mods-guide-upgrades-mastery/ - guide
3. Doom Eternal weapon mods search results (Inverse, Red Bull, Prima) - https://inverse.com/gaming/doom-eternal-weapon-mods-upgrades-mastery-guide - guide (excerpt only)
3b. Doom Eternal bestiary and weaknesses - Gameranx - https://gameranx.com/features/id/194847/article/doom-eternal-the-best-way-to-beat-every-monster-bestiary-weaknesses-guide/ - guide
4. The Two Sides of Doom Eternal (Ancient Gods design analysis) - Game Developer - https://www.gamedeveloper.com/design/the-two-sides-of-doom-eternal - talk/analysis
5. Doom Eternal director says the Marauder is good - PC Gamer - https://www.pcgamer.com/uk/doom-eternals-director-says-the-marauder-is-good-actually/ - review/interview (search excerpt)
6. id Software on the Slayer 2.0 - Stevivor - https://stevivor.com/features/interviews/id-software-on-the-slayer-2-0-in-doom-eternal - official interview (search excerpt)
7. DoomWiki Supplies (Doom Eternal) and Battlemode - https://doomwiki.org/wiki/Supplies_(Doom_Eternal) , https://doomwiki.org/wiki/Battlemode - wiki (search excerpt)
8. Doom Eternal review - GamesRadar - https://gamesradar.com/doom-eternal-review - review
9. Doom Eternal review - PCWorld - https://www.pcworld.com/article/3533052/doom-eternal-review.html - review
10. Doom Eternal review - Bloody Disgusting - https://bloody-disgusting.com/reviews/3610873/review-incredible-blood-spattered-combat-doom-eternal-helps-rise-many-issues/ - review
11. Doom Eternal review - Wireframe - https://wireframe.raspberrypi.com/articles/doom-eternal-review-rip-and-tear-like-and-share - review
12. Ancient Gods Part One - Push Square - https://pushsquare.com/reviews/ps4/doom_eternal_the_ancient_gods_-_part_one - review
