# Warframe - design notes for an original offline FPS

Evidence tags: [n] = source below. "unverified" = not confirmed in this pass. Researched 2026-10-22; Warframe updates constantly (Damage 3.0 / Update 36 rules used here).

## Identity
- Free-to-play third-person co-op action shooter by Digital Extremes, up to 4 players, biomechanical "Warframes" with 4 abilities each; also Archwing, Necramech, Railjack, and open-world zones (Plains of Eidolon, Orb Vallis, Cambion Drift, Duviri). [1]
- Factions: Grineer, Corpus, Infested, Sentients, Corrupted; later Murmur, Narmer, Anarchs. [1]
- 2025-26 content (per Wikipedia): Techrot Encore (Mar 2025), The Old Peace (Dec 2025), The Shadowgrapher (Mar 2026), Jade Shadows (Jun 2026), Iceblade of Narin (Sep 2026); Tau is scheduled for late 2026. [1]
- First-person adaptation: take the parkour, ability kit, mod build system, status stacks and tile-based levels. Drop third-person camera, melee-combo-centric combat, and the mastery/inventory sprawl.

## Core loop
- Pick a mission node, run a procedurally tiled map, kill enemies/complete the objective, extract, collect drops (mods, resources, blueprints), mod gear, repeat. [1][2][3]
- Mission types (wiki lists about 35) [2]:

| Type | Objective (verified from wiki unless noted) |
|---|---|
| Exterminate | Kill a set number of enemies (very linear tile layout) [2][3] |
| Capture | Find and capture a target; tiers Easy/Medium/Hard don't change reward [2] |
| Assassination | Kill a boss; fixed objective [2] |
| Defense | Endless; rewards each wave rotation; protect an objective; checkpoint every 3rd wave (reward pool) [2] |
| Mobile Defense | Defend a moving data console between points (unverified details) |
| Survival | Endless, life-support drains, enemies scale with time; maze-like tiles [2][3] |
| Spy | Hack data vaults quietly in vault rooms (objective tiles) [3] |
| Interception | Control points held against enemy team (details unverified) |
| Excavation | Defend a drill that yields power cells; endless [2] |
| Disruption | Defend conduits through rounds; level climbs per round [4] |
| Rescue, Sabotage, Hijack, Defection, others | exist; details unverified [2] |
- Endless-mission level scaling: spawn level rises each reward rotation, roughly exponentially to level 5000 (about 4 hours in Survival) then linearly; cap 9999 after 8+ hours. Disruption: increase per round L(x)=2.59*e^(0.139*round). Wiki warns the section is still being researched. [4]
- Loop shape worth copying: short run (~5-15 min, unverified), a clear objective type, and an "extract now or push on" choice in endless modes.

## Movement
| Move | Rule (numbers from wiki) [5] |
|---|---|
| Bullet jump | Crouch + Jump; launches toward the reticle at 14.5 m/s; 100 Blast damage with a guaranteed proc in 3 m; cannot repeat until landing or wall dash/latch |
| Double jump | Extra air jump; a bullet jump cannot follow a double jump, but ground-started bullet jump can be followed by one |
| Aim glide | Airborne + Aim; 3 s then fast fall; harder to hit; timer shared with wall latch; ~70% shorter with archgun |
| Wall latch | Wall dash + Aim; hold up to 6 s; allows some casts; prevents hard landing; shared timer with aim glide |
| Slide | Move + Crouch; friction slows (not on slopes); can fire; melee slide attack |
| Roll | Tap sprint; -75% damage, knockdown immunity; usable in mid-air once until you touch ground or wall latch |
| Hard landing | At about 20 m/s impact you are briefly immobile, no fall damage; prevented by double jump, roll, aim glide before impact |
- "Parkour 2.0" (2015) removed exploits like coptering while keeping speed. [1]
- Adaptation: in first person keep slide, bullet-jump toward crosshair (the camera is the aim vector), wall-latch to cling, and aim-glide as a hover while ADS. Camera shake from dash should be minimized.

## Weapons and equipment
- Weapon categories: primary (rifles, shotguns, snipers, bows, launchers), secondary (pistols, throwing), melee (stances and combos), exalted/archgun (unverified details). Each primary/secondary has 8 general mod slots plus one Exilus; melee adds a Stance slot. [6]
- Mods, capacity and polarity [6]:
  - Capacity = minimum 15 plus 1 per 2 Mastery Ranks (plus 1/legendary rank after MR 30); a Reactor/Catalyst doubles it.
  - Matching polarity halves a mod's drain (rounded up); mismatch adds about a quarter; Forma changes a slot polarity; Omni Forma is universal at half capacity.
  - Ranks up to 30 (40 for some items); mod max rank varies (Flawed 3, Primed/Galvanized/Archon 10); Endo costs double per rank.
  - No duplicate mods; nine rarity tiers.
- Status effects (Damage 3.0) [7]:

| Type | Status | Effect |
|---|---|---|
| Impact | Knockback | 1 s stagger; raises finisher threshold |
| Puncture | Weakened | Target deals 40% less damage, +5% crit chance taken; stacks to 80% |
| Slash | Bleed | 35% base damage per second for 6 s after 1 s; unlimited stacks; bypasses armor |
| Heat | Ignite | 50% base DPS 6 s; 4 s panic; strips up to 50% armor |
| Cold | Freeze | 50% slow 6 s; crit multiplier up; at 10 stacks 90% slow and 3 s freeze |
| Electricity | Tesla chain | 50% DPS within 3 m plus 3 s stun |
| Toxin | Poison | 50% base over 6 s, bypasses shields |
| Blast (Heat+Cold) | Detonate | 30% after 1.5 s; early detonation 300% base in 5 m |
| Radiation (Heat+Elec) | Confusion | Enemies attack allies 12 s; +100% damage to allies, stacks |
| Gas (Heat+Toxin) | Gas cloud | 50% DPS in 3 m, up to 6 m radius |
| Magnetic (Cold+Elec) | Disrupt | +100% damage to shields, blocks shield regen, up to +325% |
| Viral (Cold+Toxin) | Virus | +100% damage to health, up to +325% |
| Corrosive (Elec+Toxin) | Corrosion | -26% armor per stack for 8 s, max 80% |
- Faction modifiers since Update 36: vulnerable x1.5, resistant x0.5 (Grineer always vulnerable to Impact and Corrosive). [7]
- Melee combos and stance specifics: not retrieved; unverified.

## Abilities and items
- Each Warframe: 4 abilities, cost energy (base up to 100 each); energy does not regenerate by default; sources are orbs, auras, support frames, mods (Flow multiplies max energy; efficiency changes costs). Some frames use shields or cooldowns instead (Hildryn, Lavos). [8]
- Starting energy rises with unspent mod capacity: +5 per free capacity point. [8]
- Frame archetypes (design space, general knowledge, unverified): tank/crowd-control (Rhino-like), nuker (Excalibur/Ember-like), support (Trinity-like energy and heal), stealth (Ash/Loki), summoner, controller. Compact table for a clone:

| Archetype | Ability set example | Resource trick |
|---|---|---|
| Brawler | Charge, stomp, buff, shield | Shield grows from damage |
| Caster | Fire wave, sphere, nova, ultimate | Energy orbs |
| Support | Heal, energy share, buff aura, revive | Gives energy to team |
| Stealth | Cloak, decoy, teleport, shadow strike | Time-limited invisibility |
| Controller | Slow field, pull, magnet, ult | Debuff stacking |
- Duration, range, strength and efficiency mods give four build axes for abilities. [8]

## Health and damage
- Layers: shields (regen after delay), health, armor (damage reduction), Overguard on Eximus. [7][4]
- Armor: damage reduction capped at 90% (armor 2,700); Slash/True/Cinematic/Finisher bypass; Heat strips up to 50%; Corrosive strips up to 80%. [4][7]
- Eximus have base Overguard 12 and scaled units get level-based curves. [4]
- Enemy scaling: Current = Base x multiplier; health f1 = 1 + 0.015q^2.12 (low curve) blends with f2 = 1 + 10.7332q^0.72 (Grineer) between level 70 and 80, where q = level - base level. Shields: 1 + 0.02q^1.75 / 1 + 1.6q^0.75. Armor: 1 + 0.005q^1.75 / 1 + 0.4q^0.75. Damage: 1 + 0.015q^1.55. [4]
- Roll reduces damage 75%; aim-glide harder to hit. [5]
- Difficulty is mostly level: enemy level climbs with time or node.

## Modes and match options
- PvE mission nodes on a star chart, plus open-world and special modes; PvP Conclave exists but minor. [1][3]
- Mission modifier options: faction, level band, tileset. [3]
- Co-op 4 players; solo allowed (unverified).

## Map design
- Procedural tilesets are the key idea: each tileset has at least 30 tiles; maps are tree-structured chains of tiles with one route Start -> Objective -> Exit and dead-end side branches, no loops. [3]
- Tile types: Start, Connector (corridor-like), Intermediate (large combat rooms), Objective, Dead end (storage containers/lockers), Exit; plus cube map and skybox. [3]
- A level template per mission type and tileset gives which tiles, segment length, tile makeup and maximum branching depth. Exterminate = more connectors (linear); Survival = more intermediates (maze-like). [3]
- 25 Star Chart tilesets across factions (Grineer Galleon/Asteroid/Settlement/Shipyard..., Corpus Ship/Outpost/Ice Planet/Gas City, Infested ship, Orokin Tower/Derelict...). [3]
- GDC 2013 AI Summit session by Digital Extremes' Daniel Brewer covered procedural maps (only a Japanese summary found; details unverified). [9]
- Clone recipe: ~12 hand-authored room modules per theme, door sockets with matching ids, a generator that builds a path S-C-I-O-C-I-E plus dead ends, seeded for repeatability.

## Bots and AI
- Enemies are faction squads of cheap units (Lancer-style rifleman, Bombard rocket infantry, heavy gunners) with elite Eximus modifiers (stat-buffed with Overguard and auras). [10]
- Corrupted units are normal units with twice the HP under neural sentry control. [10]
- Most Infested are melee rushers with little ranged ability. [10]
- Nullifier bubbles, shield drainers and ancients as counter-ability roles: details unverified (not retrieved).
- Spawn behavior: enemies spawn in rooms ahead and behind, level rising with time; no formal "director" doc found - flagged gap.
- Adapt: 5-6 unit templates per faction: rusher, rifleman, heavy, sniper, support/shield-dispenser, elite modifier (adds an aura and Overguard).

## Progression
- Mastery Rank: unlock by leveling gear; mod capacity grows with it. [6]
- Credits (earned) and Platinum (premium, tradable); Nightwave gives free rewards; devs claim everything non-cosmetic can be earned. [1]
- Riven mods have random stats with negatives; Arcanes, Valence fusion. [1]
- Offline fit: use mod cards with capacity budget, a few polarities, fixed loot tables, no trading, no real-time timers, no gates behind long crafting.

## HUD and options
- Health/shield/energy bars, ability icons 1-4, enemy level nameplates and health/shield tint, minimap with objective ping, damage numbers colored by type. (General knowledge, unverified.)
- A 2020 update reworked the tutorial with a cinematic intro. [1]

## Best features to keep
1. Movement: bullet jump, slide, wall latch, aim glide as combinable verbs. [5]
2. Procedural tile levels for replay value at tiny memory cost. [3]
3. Mod capacity/polarity as a puzzle-like build budget. [6]
4. Combined elements and status stacks as clear readable effects. [7]
5. Four-ability kits with energy as the economy. [8]

## Mistakes to avoid
- New-player onboarding: information overload, little in-game tutorial, weak early gear, fast veterans and chat culture; devs examined the first 2 hours and admitted open-world hubs can overwhelm. [11][12]
- Heavy grind for frames, with the main blueprint sometimes behind an unrelated quest. [11]
- Sprawling systems (PC Gamer called the growth incoherent but charming). [1]
- Endless scaling that reaches level 9999 - meaningless numbers, balance extremes. [4]

## Adaptation notes
- Keep missions short; guarantee extract; tile count 10-12 per theme, and merge geometry to few draw calls.
- Use 4 abilities on keys 1-4, touch buttons that fit; energy orbs from kills.
- Flat shading and instancing for rooms; baked lighting via vertex colors; no real-time shadows.
- Cap simultaneous enemies at ~14; use shield/health/armor three-bar model with 6 combined statuses at most for performance.
- Replace the star chart with a fixed list of 10 nodes; scale enemy level with the wiki-style formula (clamped to a modest range).

## Sources
1. Warframe - Wikipedia, https://en.wikipedia.org/wiki/Warframe, wiki
2. Mission - Warframe Wiki, https://wiki.warframe.com/w/Mission, wiki
3. Tileset - Warframe Wiki, https://wiki.warframe.com/w/Tileset, wiki
4. Enemy Level Scaling - Warframe Wiki, https://wiki.warframe.com/w/Enemy_Level_Scaling, wiki
5. Parkour - Warframe Wiki, https://wiki.warframe.com/w/Parkour, wiki
6. Mod - Warframe Wiki, https://wiki.warframe.com/w/Mod, wiki
7. Damage - Warframe Wiki, https://wiki.warframe.com/w/Damage, wiki
8. Energy - Warframe Wiki, https://wiki.warframe.com/w/Energy, wiki
9. GDC 2013 Vol.5 procedural map generation - GameBusiness.jp, https://www.gamebusiness.jp/article/2013/03/26/7689.html, talk (not fully read)
10. Eximus 2.0 / Corrupted - Warframe Wiki, https://wiki.warframe.com/w/Eximus_2.0 and https://wiki.warframe.com/Corrupted, wiki (search snippets)
11. Improving the new player experience - Warframe forums, https://forums.warframe.com/topic/897190-improving-the-new-player-experience/?page=0, forum
12. Despite all criticism, Warframe plans more open-world maps - mein-mmo, https://mein-mmo.de/en/despite-all-criticism-warframe-plans-more-open-world-maps,187929/, review
13. Steam discussion on Warframe new player experience, https://steamcommunity.com/app/230410/discussions/0/2913220877914545356, forum
