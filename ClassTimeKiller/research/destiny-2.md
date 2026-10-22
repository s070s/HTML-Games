# Destiny 2 - design notes for an original offline FPS

Evidence tags: [n] = source number below. "unverified" = from general knowledge or a single weak/outdated source, not confirmed in this research pass. Research date 2026-10-22; Destiny 2 changes yearly, so every number is version-dependent.

## Identity
- Sci-fi looter-shooter by Bungie, free-to-play core with paid expansions. Console-first design, PC since 2017. Three classes (Hunter, Titan, Warlock), each with several elemental subclasses. [1][2]
- Expansion timeline: Curse of Osiris (Dec 2017), Warmind (May 2018), Forsaken (Sep 2018), Shadowkeep (2019), Beyond Light (Nov 2020), Witch Queen (2022), Lightfall (2023), Final Shape (Jun 2024), Edge of Fate (Jul 2025), Renegades (Dec 2025). [1]
- Version differences that matter: Beyond Light added Stasis, Lightfall added Strand, Final Shape added Prismatic (mixes elements, gives access to all class and movement abilities, 13 Fragments). [1][2][10] Edge of Fate (2025) reworked power levels and armor stats ("Armor 3.0") and added "the Portal" activity hub; it drew heavy criticism and Bungie patched in Renegades (patch 9.5.0). [7][8][9]
- Gunplay feel is the genre benchmark; the rest of the game is a content treadmill. That split is the main lesson.

## Core loop
- Loop: pick an activity, shoot enemy packs with weapons plus abilities, collect loot with random perks, tune a build, repeat at higher difficulty. [1]
- Activities: Patrol (free roam, public events, Lost Sectors = short solo dungeons with a boss and a chest), Strikes (3 players, ~15-25 min, unverified), Nightfall (hard strike with modifiers), Dungeons (3 players), Raids (6 players, puzzle-like encounter mechanics), Crucible PvP, Gambit PvPvE. [1][2]
- Raid encounter pattern (general knowledge, unverified): each boss room asks teams to split roles (call-outs, add control, a "relic" or buff carrier) then burn damage in a short window; failing a mechanic wipes the team.
- Crucible: started 4v4, later 6v6 Quickplay; Trials of the Nine rotates Countdown and Survival; Iron Banner turned off gear balancing after Forsaken. [1][2]
- Gambit: two teams of 4 kill AI enemies for motes, bank them; banking sends a "blocker" to the other side and fills toward a boss ("Primeval"); at set mote counts one player can "invade" the other arena. Numbers vary by patch: 75 motes for base Gambit, 100 for Gambit Prime; blocker tiers by 5/10/15 motes; invasion openings at 25/50(/75) originally, 40/80 after Forsaken rework. Dying drops carried motes. Killing the boss first wins. [11][12] Exact current values unverified.

## Movement
| Class | Air option | Variants | Notes |
|---|---|---|---|
| Hunter | Jump (extra air jump) | High, Strafe, Triple | Triple jump sustains air control with 2nd/3rd jump [9] |
| Titan | Lift (thruster burst) | High, Strafe, Catapult | Can be cancelled mid-use; one reactivation [9] |
| Warlock | Glide (hover) | Balanced, Burst, Strafe | Cancellable; refills on landing [9] |
- Shared rule: spent movement mode refills on touching solid ground. [9]
- Blink, slide, sprint: Blink exists as a Warlock/Hunter style ability only in older or subclass-specific forms; not confirmed in this research. Slide and sprint are base movement (general knowledge, unverified numbers). Prismatic lets any class pick any class/movement ability. [10]
- Design takeaway: air control is a per-class choice that refills on ground contact, so levels can be taller without breaking balance.

## Weapons and equipment
- Slot model: Kinetic (no element), Energy (Arc/Solar/Void/Stasis/Strand), Power (heavy). Special weapons returned later and the slot names were reworked (sources disagree on naming). [2][3]
- Ammo economy (three tiers): Primary = infinite; Special = rarer drops; Heavy = rarest, bricks dropped by enemies or earned. [3]
- Archetypes by ammo tier [3][4]:

| Tier | Archetypes | Role |
|---|---|---|
| Primary | Hand Cannon (140-180 RPM, precision), Auto Rifle (360-600 RPM, sustained), Pulse Rifle (bursts), Scout Rifle (slow, long range, precise), SMG (close, high RPM), Sidearm (tight range, high DPS), Combat Bow | Everyday damage |
| Special | Fusion Rifle, Glaive, Shotgun, Sniper, Trace Rifle, Breech Grenade Launcher | Burst or utility |
| Heavy | Rocket Launcher, Linear Fusion Rifle, Sword, Grenade Launcher, Machine Gun | Boss damage |
- RPM figures above come from one secondary guide [4]; other per-archetype damage tables not retrieved (unverified).
- Perks (general knowledge, unverified): each weapon rolls random trait perks, barrel/magazine stat changes, and can be crafted. Exotics: one per category equipped; each has a unique behavior perk.
- Stats influencing feel: range, precision/aim assist, recoil direction, handling, reload speed. Hidden aim-assist and bullet-magnetism exist; Bungie kept controller-style aim assist on PC. [14]
- Camera note from a Bungie animator GDC talk: crosshair slightly low to open peripheral view; one shared weapon-lowering animation reused for grenade throws to save animation work. [13]

## Abilities and items
- Every class has grenade, melee, class ability (dodge, barricade, rift), super, movement mode. Aspects and Fragments (from Light 3.0 era, 2023+) modify them; Prismatic mixes. [1][10]
- Subclass elements: Solar, Arc, Void, Stasis, Strand, Prismatic. [1][2]
- Compact archetype table (design space, element status effects are the ability hooks) [5][6]:

| Element | Signature effect | Anti-champion use |
|---|---|---|
| Solar | Burn, Radiant (damage buff), healing Restoration | Radiant vs Barrier; Ignition vs Unstoppable |
| Arc | Jolt, Blind, speed/Amplified | Jolt vs Overload; Blind vs Unstoppable |
| Void | Weaken, Volatile, Overshield, Suppress, Invisibility | Volatile vs Barrier; Suppress vs Overload |
| Stasis | Slow, Freeze, Shatter | Slow vs Overload; Shatter vs Unstoppable |
| Strand | Unravel, Suspend, Tangle, grapple | Unravel vs Barrier; Suspend vs Unstoppable |
- Supers (general knowledge, unverified): charge slowly through kills and ability use; a 10-20 s power window. Good for a clone: one super per frame, fills with damage dealt.

## Health and damage
- Model: shield-and-health with regeneration after a delay out of combat (general knowledge, unverified numbers). Player and PvE damage scale with Power level vs enemy level.
- Enemy shields are colored by element (Arc/Solar/Void); with "Match Game" modifier, only the same-element weapon breaks them quickly. [11]
- Champions: three types with specific counters [5][6]: Barrier (shield pops at about half health, heals back if not stunned), Unstoppable (tank pursuer; needs stagger), Overload (regenerates when damaged; needs stun). Since Lightfall, subclass status effects and anti-champion weapon rounds both count; before that only seasonal artifact mods did. [5]
- Difficulty modifiers: Nightfall style modifiers (Match Game, Surge, Champions, burn types) - concept only, specifics unverified.
- Power level: gear average power; old soft/hard caps and infusion. Edge of Fate: soft cap 200, seasonal range above it, reset each season; Bungie later allowed reaching the cap straight through Renegades activities and changed catch-up to drops. [7][8][9]

## Modes and match options
- PvE: Strike, Nightfall, Dungeon, Raid, Patrol, Lost Sector. PvP: Control, Clash, Supremacy, Countdown, Survival, Trials, Iron Banner. PvPvE: Gambit. [1][2]
- Options relevant to a clone: player counts 3/4/6, difficulty ladders with modifiers, and a hybrid mode (bots race to bank resources while a rival team spawns pressure). Match-flow ideas: warm-up, capture zones, timer, win-by-score.

## Map design
- Patrol zones: open hubs with loops, public events at fixed spots, hidden Lost Sector entrances. [1][2]
- Lost Sector (general knowledge): short combat gauntlet, legend/master variants add modifiers and a better chest.
- Crucible maps: small, readable lanes, three-lane symmetric design (unverified).
- Strikes: linear arena chains ending in a boss; raids: multi-room puzzle arenas.

## Bots and AI
- Enemy design by faction and role (roles matter more than faction art) [11][15]:

| Faction | Roles and traits |
|---|---|
| Fallen | Pack hunters led by Captains; Dregs rush, Vandals shoot, Captains carry shields (Arc shields), Servitors support [11] |
| Hive | Thrall rushers, Acolyte shooters, Knight bruisers, Ogre heavies; Wizards and Shriekers (details sparse in sources) |
| Vex | Goblins swarm; weak to abdomen power cores, not headshots; Hobgoblin, Minotaur, Hydra, Harpy [11] |
| Cabal | Incendior ignites the floor; War Beasts gallop in; Legionaries in line; Phalanx shield (details partly unverified) [11] |
| Taken | Blights spawn from Acolytes; Knights, Ogres, Minotaurs shielded, Wizard/Acolyte void shields; can teleport [11] |
| Scorn | Aggressive, erratic; Ravagers have flails that are critical spots [11] |
- Role set to copy: Rusher (melee closes distance), Shooter (cover fire), Sniper (long telegraphed line), Shield bearer (front immunity, flank to kill), Bruiser (heavy melee, slow), Support/Healer, Mini-boss (elite shield + champion trait), Boss with phases.
- Gambit blockers: scale with bank deposit size, stay near the enemy bank and must be killed to unlock it. [12]
- Enemy shield color tells weapon choice - good readable AI design.

## Progression
- Light/Power loop: drops raise power, infusion keeps favorite gear usable, vault stores items. Content vaulting (older content removed): Bungie stopped vaulting expansion content in August 2022, but seasonal content is still vaulted. [1]
- Offline fit: gear tiers with random perk rolls, crafting by repeating, subclass unlocks; skip seasons, FOMO and power resets.
- Flags: FOMO events, weekly gating and power-reset (see mistakes).

## HUD and options
- Minimal HUD: center reticle with hit markers, bottom-left health/shield and ability cooldown ring, super meter, ammo count by slot color (white/green/purple), radar for PvP. (general knowledge, unverified)
- Strong aim-assist, FOV slider, and colorblind modes exist; controller-first input design. [14]

## Best features to keep
1. Gunfeel: distinct weapon archetypes with readable handling stats; precision hit markers; aim assist that rewards skill. [13][14]
2. Three-tier ammo economy forces slot swapping and gives power weapons scarcity. [3]
3. Elemental damage plus shield-color matching and champion types: simple rock-paper-scissors that adds decision-making. [5][11]
4. Class movement with ground-refill air modes: cheap to implement, strong feel. [9]
5. Subclass slots (grenade, melee, class ability, super, aspects, fragments) as a modular build system. [10]

## Mistakes to avoid
- Content vaulting and loss of paid content (stopped for expansions in 2022). [1]
- Power-level grind and resets (Edge of Fate Portal tiers, Armor 3.0 stat bugs, loss of value of old gear). [7][8][9]
- Confusing, fragmented story and new-player onboarding (general reputation; also noted in a Steam thread comparing it unfavorably with Warframe). [forum in warframe.md]
- Seasonal FOMO and weekly gating of rewards.
- Over-complex stat/perk menus; unclear guides that go stale per patch (one champion source warns about dated guides). [5]

## Adaptation notes
- Offline bots only: replace raids with a 3-4 room boss gauntlet using "call-out" mechanics bots execute by script; Gambit can be re-created as a two-bot-team resource race with blockers and invasions.
- Implement ~8 weapon archetypes with different spread, recoil patterns, headshot multiplier and RPM from the table; three ammo tiers with drops.
- Shields by element on enemies with a simple 1.5x / 0.5x multiplier table; 3 champion-style tags with two counters each.
- Low-end target: cap active enemies at ~12-16, use billboards/low-poly, no per-pixel shadows; hitscan for most guns, projectile only for rockets.
- Keep one super per character class and cooldown-based grenade/melee; avoid persistent power-level math.
- Touch: auto-fire, aim assist boosted; gamepad: reuse the aim assist cone (slows reticle near target).

## Sources
1. Destiny 2 - Wikipedia, https://en.wikipedia.org/wiki/Destiny_2, wiki
2. Destiny 2 - Destinypedia, https://www.destinypedia.com/Destiny_2, wiki
3. Destiny 2 Weapons Types - Blueberries, https://www.blueberries.gg/weapons/destiny-2-weapons-types/, guide
4. Weapon archetypes - Guild Order, https://guildorder.com/ko/games/destiny2/wiki/weapon-archetypes, guide
5. Changes to Champions in Lightfall - GGRecon, https://www.ggrecon.com/guides/destiny-2-champions-lightfall-changes/, guide
6. How to defeat Barrier, Overload, Unstoppable Champions - GameSpot, https://gamespot.com/articles/destiny-2-champions-how-to-defeat-barrier-overload-and-unstoppable-champions/1100-6508246/, guide
7. Bungie: Edge of Fate was the wrong path - The Game Post, https://thegamepost.com/bungie-edge-of-fate-was-the-wrong-path-destiny-2-power-tier-grind/, review
8. Destiny 2: The Edge of Fate - Wikipedia, https://en.wikipedia.org/wiki/Destiny_2:_The_Edge_of_Fate, wiki
9. Destiny 2 Basic Actions (Jump, Lift, Glide) - Prima Games eGuide, https://primagames.com/eguides/destiny-2-eguide/field-manual/basic-actions, guide
10. Every Prismatic Aspect and Fragment - GGRecon, https://www.ggrecon.com/guides/destiny-2-prismatic-subclass-supers-aspects-abilities/, guide
11. All enemy shield types - Shacknews, https://shacknews.com/article/124647/all-enemy-shield-types-destiny-2, guide
12. Gambit guides: mein-mmo https://mein-mmo.de/en/2-important-rules-to-easily-win-gambit-in-destiny-2,659374 ; PCGamesN https://www.pcgamesn.com/destiny-2/gambit-rework, guide
13. Why does Destiny play so well? (Bungie animator GDC talk summary) - mein-mmo, https://mein-mmo.de/en/warum-spielt-sich-destiny-so-gut-die-tricks-entwickler-153,33071, talk
14. Destiny 2 will keep aim assist on the PC - PC Gamer, https://www.pcgamer.com/uk/destiny-2-will-keep-aim-assist-on-the-pc, review
15. Enemy types - Maxroll, https://maxroll.gg/destiny-2/resources/enemy-types, guide
16. Bungie admit they messed up Destiny 2 - The Sixth Axis, https://www.thesixthaxis.com/?p=465987, review
