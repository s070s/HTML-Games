# Fortnite (Battle Royale, Zero Build, Save the World, Creative/UEFN) - design notes for an original first-person clone

Conventions: "[n]" = source number in Sources. "unverified" = single weak source, conflicting sources, or general knowledge not confirmed in this research pass. Fortnite is third-person; each section ends with "FPS adaptation" where useful. Version context: research reflects data up to roughly v41.x / Chapter 7 (2026); several sources are older (flagged).

## Identity

- Epic Games, 2017. One engine, several modes: Battle Royale (BR, Sept 2017, free), Save the World (STW, co-op PvE, paid early access 2017, free-to-play from 16 April 2026), Creative (Dec 2018), UEFN (March 2023, Unreal Editor for Fortnite) [1][2][3].
- BR variants: Zero Build (March 2022, permanent standalone Apr 2022), Ranked, Reload (40 players, respawns), OG, Blitz Royale (32 players, ~5 min), Party Royale (social). As of Sept 2026 the source counts 41 seasons / 7 chapters [1][2].
- Up to 100 players, solo or squads of 2-4. Trios were added Dec 2018, removed May 2023 with Ranked, then restored two weeks later for unranked [1].
- Perspective: third-person shoulder camera. Core appeal: improvised building (BR), chaotic/cartoony tone, constant content churn. Metacritic BR ~78-85 [1].
- Version differences: Build mode vs Zero Build are separate playlists; STW is a separate progression system. Ballistic (5v5 tactical shooter, Dec 2024) and some side games were removed 16 April 2026 [2].

## Core loop

Match flow (BR, 100 players):
1. Lobby / pre-game island, then a flying bus crosses the map; players jump at will and skydive/glide onto a fixed island with named landmarks [1].
2. Land with only a pickaxe, loot chests, floor loot and ground items; inventory is five item slots [1].
3. Safe zone ("eye of the storm") shrinks in phases; outside it a storm deals damage that ramps up. Last player or squad wins [1][4].
4. Squads: a downed teammate is incapacitated and can be revived; Reboot Vans (added Apr 2019) bring back eliminated squadmates but are scarce and exposed [1]. Solo players die when health reaches zero [1].

Storm table (Fortnite Wiki table as relayed by a guide, "current as of v41.20"; the guide itself says five cells conflict with the wiki change log, so treat as approximate) [4]:

| Phase | Wait | Shrink | Damage per second (% of max health, per guide) | Safe-zone radius |
|---|---|---|---|---|
| 0 | 1:00 | - | - | 1500 m |
| 1 | 1:50 | 1:25 | 1% | 950 m (log implies 1200 m) |
| 2 | 1:00 | 1:30 | 1% | 725 m |
| 3 | 1:10 | 1:50 | 1% | 500 m |
| 4 | 0:50 | 1:20 | 1% | 400 m |
| 5 | 0:30 | 1:05 | 1% | 225 m |
| 6 | 0:35 | 1:10 | 2% | 120 m |
| 7 | 0:35 | 1:10 | 5% | 60 m |
| 8 | 0:25 | 1:00 | 8% | 40 m |
| 9 | 0:10 | 1:00 | 10% | 20 m |
| 10 | 0:01 | 0:50 | 10% | 13.5 m |
| 11 | 0:01 | 0:50 | 10% | 10 m |
| 12 | 0:01 | 1:20 | 10% | 0 m |

- Another guide cited by search gives a different schedule (first circle 1:00, phase 2 at 1:30), so exact timings differ by version. Wiki change log: final circle travel distance +48% and shrink 45 s to 75 s in v7.40; max storm damage once reverted 8 to 10 (v7.10) [4][5-search-snippet].
- FPS adaptation: 12 phases is too long for a 3-5 minute offline match. A 6-phase version (wait 20-30 s, shrink 20-40 s, damage 1 -> 10 % per second) keeps the shape.

Loot rarity: seven rarities from Common to Exotic; higher tiers deal more damage [1]. Colour order (grey, green, blue, purple, gold, mythic) is general knowledge, unverified in this pass.

Sources of fun beyond BR: Save the World loop (see below), Creative rule-sets (see Modes), LTMs like Team Rumble (large team respawn deathmatch; rules unverified, fetch failed).

Save the World loop [3]: up to 4 players; gather materials, build fortifications around an objective, craft weapons/traps, survive waves of "husks" (zombie-like). Day: mostly passive; night: hunting bands. An AI director scales difficulty. Mission types: defend/fortify an objective, rescue survivors, radar towers, clear encampments, Storm Shield Defense (expands base shield, unlocks endless Endurance Mode). Four world regions: Stonewood, Plankerton, Canny Valley, Twine Peaks [3][6].

## Movement

- Base BR: walk, sprint, crouch, jump, mantle-type vaulting, slide, glide/skydive from bus. Exact speed numbers: not found (unverified).
- Zero Build (since Mar 2022): building removed; a regenerating overshield and expanded movement (tactical sprint, mantle, slide) are the defensive/mobility substitute [1][7]. A May 2026 third-party summary of the v40.40 Zero Build overhaul says: sprint is unlimited with pickaxe, kills refill overshield, a Pocket Item slot replaced the Build button, start with pistol + small shield potion + pocket item, and lethal fall damage was disabled for that Act (temporary, per secondary guides, not Epic notes) [7][8].
- Building (optional mode idea): pickaxe harvests wood, stone, metal from almost any object. Pieces: wall, floor, ramp (stairs), roof. Lighter materials build fast and break easily; heavier build slower, are stronger [1]. Exact piece HP and costs: not found (unverified; commonly cited 10 mats per piece is general knowledge, unverified).
- Edits (reshaping a piece) exist in Build mode; not researched in detail.
- Vehicles, launch pads, rifts, zip/gliders are rotating map items; no sourced numbers.
- FPS adaptation: sprint + slide + mantle + glide-from-bus is enough. Auto-mantle on any waist-high ledge reads well on touch. Drop-in skydive can be a short scripted dive camera on a low-end device.

## Weapons and equipment

- Categories: assault rifles, SMGs, pumps/tactical/heavy shotguns, pistols, snipers, explosives, utility, mythic/boss weapons. Rotating loot pool each season (e.g. Chapter 6 Season 2 loot pool change) [9].
- Rarity scales damage. Example (Chapter 6 S2, pump shotgun): damage 91/95/101/106/111 across five rarity steps; a TwinMag AR was nerfed by 3 damage/shot [9]. Perk-style rarity bonuses of +10% (Common) to +30% (Legendary) appear on one wiki page for a related system, not base damage (unverified relevance) [search-snippet 10].
- Pump shotgun headshot multiplier 1.85x on one wiki page (version from Chapter 3, dated) [11]. Pump shotgun falloff has been tuned to short-range buckets with higher per-range damage in earlier seasons [11].
- Healing / shields (Creative documentation, official) [6]:

| Item | Effect | Notes |
|---|---|---|
| Bandage | +15 health | stacks to 15; heals only up to 75 (wiki); use time 3-4 s (sources differ) |
| Med Kit | +100 health | ~10 s use (wiki/guide) |
| Mini shield potion | +25 shield | ~2 s use; cannot use above 50 shield |
| Shield potion | +50 shield | ~5 s use; to max 100 |
| Slurp Juice | +75 health, overflow to shield (full health -> shield) | 2 s use; older version: +1 hp and +1 shield per second for 25 s |
| Chug Jug | health and shield to 100 | 15 s delay |
| Chug Splash | thrown, +20 health, overflow to shield | stack of six |
| Med-Mist | spray, total capacity 150, heals in steps of 5 | |
| Guzzle Juice | +2 health ticks until damaged | 2 s use, 5 s cooldown |

  (Where Creative doc and wikis disagree on use times, sources conflict; flagged.)
- Knockdown shield-like gear and ammo type tiers: Fortnite uses ammo classes (light, medium, heavy, shells, rockets); counts unverified.
- Grenades/utility: frag, impulse, shockwave, etc. exist; numbers unverified.
- FPS adaptation: keep 5 slots, simple rarity colour ladder, shield potions (25/50) plus medkit/bandage, and one fast "slurp"-style hybrid heal for pacing.

## Abilities and items

- Base BR has no hero abilities. "Abilities" are items: mobility (launch pad, glider redeploy, shockwave grenade, hover items), mythics (boss weapons/items), and augments in some seasons (not researched in detail).
- STW heroes use four classes - Soldier, Constructor, Ninja, Outlander - each with subclasses giving abilities, perks and squad bonuses [3][6]. Defenders can be summoned when fewer than four players are present; rescued Survivors form squads giving passive bonuses (attack, build speed, armor, health) [3].
- FPS adaptation: expose the same idea as 3-4 loadout classes with one active and one passive each; defenders become friendly bots.

## Health and damage

- 100 health and 100 shield maximum is the BR/Creative default (Creative Island Settings: Max Health 100, Max Shields 100; health/shield regen off by default; recharge delay 6.5 s, 1 per second if enabled; Allow Overshield default off, Overshield Max 50) [5].
- Storm damage is a percentage of max health per second (see table) [4].
- Weapon damage varies by rarity; headshot multipliers differ by weapon (1.85x quoted for one pump); falloff is per-weapon buckets [9][11].
- Creative offers "Down But Not Out" variants (Default, Classic, Off, Improved), "Health Granted on Elimination" (0 default; overflow goes to shield) and manual respawn toggles [5].

## Modes and match options

Creative/UEFN game rules (official Island Settings, defaults) [5]:

| Group | Option | Default / range |
|---|---|---|
| Structure | Max players | 16 (1-100) |
| Structure | Teams | Free for all, Cooperative, Custom, or 2-100 |
| Structure | Team size | Dynamic, Split Evenly, or 1-4 |
| Structure | Total rounds | 1-100 |
| Team | Friendly fire | No / Yes |
| Spawning | Respawn type | Individual / Wave |
| Spawning | Respawn time | 5 s |
| Spawning | Spawn immunity | 5 s (when overridden) |
| Spawning | Spawn limit | Infinite or N |
| Eliminations | Down But Not Out | Default / Classic / Off / Improved |
| Eliminations | Dead player's items | Drop / Keep / Delete |
| Eliminations | Health granted on kill | 0 |
| Scoring | Elimination / Assist score | 0 / 0 (set per mode) |
| End | Round time limit | 5 min (or none), count up/down |
| End | End triggers | eliminations, AI eliminations, objectives, items, stat value |
| Win | Condition | Most round wins or most score |
| Build | Player-built health multiplier | 1.0x |

- LTMs seen across seasons: Team Rumble, Reload (40 players, respawn), Blitz, OG, Ranked, Zero Build. Details beyond names: unverified.
- This table is a ready-made option list for an offline "custom match" menu.

## Map design

- Fixed named island with POIs (cities, landmarks); chests spawn in buildings, rarer in the open; seasonal map changes (chapters) rotate POIs [1].
- Loot distribution criticised as uneven by one reviewer [1].
- The shrinking zone makes permanent forts impractical (a design strength noted by reviewers) [1].
- Verticality: tall towers and hills for sniping; in Zero Build, terrain, ziplines/launch pads replace build-up.
- FPS adaptation: single 300-500 m island, 6-8 POIs, one tall landmark, two river/road chokepoints, loot chests with seeded rarity. All procedural boxes/rounded prisms.

## Bots and AI

- AI bots were added to regular matches so newer players can practice; hostile NPCs arrived Feb 2020 and friendly NPCs (sell items, heal, join as allies) Dec 2020 [1].
- After a season reset, early-level matches are mostly bot lobbies; commentary says difficulty jumps steeply around level 8-10 when real players appear, and that bot quality sets new-player expectations: too hard drives quitting, too easy leads to being crushed later [12][13].
- Bots broke in Chapter 3 Season 3 (a sportskeeda report) - a lesson to test bot behaviour on every map change [14].
- No official way to force bot lobbies; players used second accounts or disabled cross-play [12].
- STW has an AI director and husk types (Beehive, Lobber, Sploder, Pitcher, Zapper, Mimic, mini-bosses, Storm King) [3][6].
- FPS adaptation: three difficulty bands (aim error, reaction time, health-aware retreat), bots that loot, rotate with the storm, and build nothing. Ramp from bots-only in the first matches to tougher squads.

## Progression

- Battle Pass tied to BR seasons; progress shared across modes since late 2024; price history: 1,000 V-Bucks about $10 at launch, $7.99 per 1,000 in 2020 (direct), $8.99 in 2023, 800 V-Bucks per $10 in March 2026 with the pass still at 800 V-Bucks; players protested the 2026 price increase and threatened a boycott [2].
- STW: commander upgrade/research points, power level, hero/trap/weapon levelling, evolve and rarity caps [3]. STW loot llamas had undisclosed odds; 2019 class action settled 2021 with 1,000 V-Bucks credit [3] - a predatory-monetisation mistake.
- Offline fit: local account level, unlock-by-play cosmetics (procedural skins/colours), mastery challenges. No paid currency or randomised paid crates.

## HUD and options

- Standard BR HUD: health/shield bar, 5-slot item bar, compass/minimap, storm timer, kill feed, squad list.
- Accessibility (official FAQ): colour-blind mode, motion blur, aim-assist strength, and "Visualize Sound Effects" showing directional icons for footsteps, gunfire, chests, vehicles [15]. Early console versions muted real audio while it was on; later fixed (older report, treat as dated) [16].
- Zero Build overshield and pocket-item slot are new HUD elements [8].
- FPS adaptation: ship a sound visualizer (direction ring with icons for footsteps, shots, chests), colourblind palette presets, aim-assist slider, hold/toggle options, adjustable touch layout.

## Best features to keep

1. Shrinking zone with scaling percentage damage: reliable pacing, ends matches by itself [1][4].
2. Zero Build overshield and expanded movement: gunplay-focused, no build skill wall [1][7].
3. Visual sound cues and bot practice lobbies: inclusion and onboarding [1][15].
4. Island Settings style option set: one data-driven rule object for custom games [5].
5. Rarity ladder and quick consumables for readable loot decisions [1][6].
6. STW-style wave defence with AI director: a good offline PvE side mode [3].

## Mistakes to avoid

- Build-fight skill gap: critics say building leads to a mechanics wall where those who can build win most fights; Epic's no-build mode was the response (Destructoid, KitGuru, Sportskeeda, TechRadar via search) [17].
- Loot-box odds hidden in STW, class action [3]; premium skin prices and social pressure to spend [1]; 2026 V-Bucks price rise backlash [2].
- Uneven loot placement [1]; building tutorials missing [1].
- Bots too easy or too hard; broken bots after updates [12][13][14].
- Mode churn and removal: Ballistic and others removed within about 16 months [2]; STW neglected relative to BR [3].
- Switch/low-end performance: 30 fps on Switch accepted but criticised for hard frame limits [1].

## Adaptation notes

- Targets: 120 fps on phones/iGPUs. Use instanced low-poly props, a single draw call per material, simple per-vertex lighting, distance-culled bots (update far bots at 10 Hz), 100 players is too many: use 16-24 total (teams of 4) with ring phases scaled.
- Match length 5-8 min. Keep: bus drop (short), 5 inventory slots, 3 rarity tiers (common/rare/epic), shield 50 + health 100 (Zero Build style overshield optional).
- Building mode as optional: one ramp, one wall, one floor, 10-second build timer; for touch devices, drop it by default.
- Controls: touch fire/aim-assist, gamepad aim-assist slider, ping button (borrow from Apex).
- Procedural audio: footsteps, shots, storm hum; visual sound ring doubles as accessibility.

## Sources

1. Fortnite Battle Royale - Wikipedia - https://en.wikipedia.org/wiki/Fortnite_Battle_Royale - wiki
2. Fortnite - Wikipedia - https://en.wikipedia.org/wiki/Fortnite - wiki
3. Fortnite: Save the World - Wikipedia - https://en.wikipedia.org/wiki/Fortnite_Save_the_World - wiki
4. Fortnite storm phases guide (relays Fortnite Wiki table, v41.20) - https://gamertagmythras.com/blog/fortnite/fortnite-storm-phases-guide - guide
5. Island Settings in UEFN - Epic Developer Docs - https://dev.epicgames.com/documentation/en-us/uefn/island-settings-in-unreal-editor-for-fortnite - official
6. Using healing items in Fortnite Creative - Epic Developer Docs - https://dev.epicgames.com/documentation/en-us/fortnite/using-healing-items-in-fortnite-creative - official
7. Zero Build vs Build overview (Sportskeeda/Twinfinite/PC Invasion results) - https://twinfinite.net/news/fortnites-no-building-modes-officially-named-zero-build/ - review
8. Zero Build overhaul v40.40 guide - https://allthings.how/fortnite-zero-build-overhaul-pocket-items-starting-loadout-and-no-lethal-fall-damage-v40-40/ - guide
9. Chapter 6 Season 2 loot pool update - https://www.esports.net/news/fortnite/fortnite-chapter-6-season-2-loot-pool-update/ - guide
10. Fortnite Fandom wiki (rarity perk bonuses, search snippet only; page returned HTTP 402) - https://fortnite.fandom.com/wiki/Rarity - wiki
11. Inverse, pump shotgun stats and rarity; Striker Pump wiki page - https://inverse.com/article/51282-fortnite-pump-shotgun-stats-rarity-and-damage - review
12. How to get bot lobbies in Fortnite - https://thespike.gg/fortnite/beginner-guides/how-to-get-bot-lobbies-in-fortnite - guide
13. Fortnite Season 6 bot lobby - https://sportskeeda.com/fortnite/fortnite-season-6-how-get-bot-lobby-easy-victory-royale - guide
14. Bots are broken in Chapter 3 Season 3 - https://sportskeeda.com/fortnite/fortnite-bots-broken-chapter-3-season-3 - review
15. Are there any accessibility settings for Fortnite? - Epic Help - https://www.epicgames.com/help/en-US/fortnite-battle-royale-c-202300000001636/gameplay-c-202300000001721/are-there-any-accessibility-settings-for-fortnite-a202300000015585 - official
16. How to see footsteps in Fortnite / visual sound effects - https://www.ggrecon.com/guides/how-to-see-footsteps-in-fortnite/ - guide
17. Fortnite players, no build mode origin and skill gap debate (Destructoid, TechRadar, KitGuru) - https://www.techradar.com/news/new-fortnite-mode-should-please-both-sides-in-community-rift - review
18. Fortnite Save the World explained - https://prosettings.net/blog/fortnite-save-the-world-explained/ - guide

Gaps: Fortnite Fandom wiki, Liquipedia and Epic patch notes were blocked (HTTP 402/403); weapon base damage, movement speeds, building piece HP/costs, Team Rumble rules and loot pool numbers are unverified. Several pages were read only through search-result summaries rather than full fetches (sources 7, 9-14, 16-18).
