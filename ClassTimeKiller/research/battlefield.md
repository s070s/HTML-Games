# Battlefield series - design notes (1942, Bad Company 2, 3, 4, 1, 2042, 6) for an offline FPS clone

Evidence tags: [n] = numbered source below. "unverified" = background knowledge or weak/aggregator source. Fandom wikis returned HTTP 402, so wiki facts rely on search snippets. Per-weapon stat tables for BF3/BF4/BF1 were not found; BF6 only qualitative.

## Identity

| Year | Title | Notes | Src |
|---|---|---|---|
| 2002 | Battlefield 1942 | WWII; introduced Conquest; Metacritic 89; 5 classes; up to 64 players; sold over 3M by mid-2004 | [1][2] |
| 2005 | Battlefield 2 | Modern; Metacritic 91; central stat tracking | [1] |
| 2008 | Bad Company | First campaign; Frostbite destruction | [1] |
| 2010 | Bad Company 2 | Modern 4-class set, Rush, destruction; Metacritic 87-88 | [1][3] |
| 2011 | Battlefield 3 | Jets return, prone, suppression; Metacritic 84-89; 5M sold week one | [4] |
| 2013 | Battlefield 4 | Levolution, Commander; launch bugs; Metacritic about 79-85 | [5] |
| 2016 | Battlefield 1 | WWI; Operations, behemoths; Metacritic 87-89; about 15M sold by Apr 2018 | [6] |
| 2021 | Battlefield 2042 | 128 players, Specialists, Portal; Metacritic 61-68 | [7] |
| 2025 | Battlefield 6 | Oct 10 2025; Metacritic 82-84; 7M+ in 3 days; seasons through at least Season 5 (2026) | [1][8] |

Pillars: combined arms with classes, large team play, vehicles, destructible scenery, objective-driven tickets rather than kills.

## Core loop

- Conquest: capture and hold control points (flags). Tickets act as shared respawn pool; a team loses tickets from deaths and from enemy holding more points; reach zero tickets and you lose [2]. Control points are also spawn points; a team with no spawn points cannot respawn and loses once its survivors die [2].
- Rush (Bad Company 2): attackers get limited tickets (75 per the Battlefield Wiki snippet; GameStar says typically 100 - sources conflict), defenders respawn without limit; attackers arm M-COM stations (pairs) by planting charges; destroying a station by collapsing a building also works [3][9]. Squad Rush: 4v4 with one M-COM station (snippet) or two per round per Wikipedia - conflict [3][9]. Medics can refund lost tickets by reviving [9].
- Operations (BF1): multi-map campaign; attackers have three battalions and lose one when tickets run out; win by clearing all maps; behemoths (zeppelin, armoured train, dreadnought, Char 2C) given to a team far behind [6].
- Breakthrough, Escalation (capture points shrink the map), Sabotage (alternating six-minute turns, destroy boxes) in BF6 [8].
- Round flow: choose class, spawn on squad mate, flag or beacon; vehicles queue from spawn points; squad of up to 4 (BF6) [8].
- Campaigns: BF3 critics called the campaign tactically linear with frustrating AI [4]; BF4 campaign "mini-sandbox" levels with Engage command and spotting, critics unimpressed [5]; BF1 War Stories: six Allied stories, short [6]; BF6 campaign (NATO vs Pax Armata, 2027-28) criticised for story; IGN scored 5/10 [8]. BC2 campaign: criticised as predictable; AI allies cannot complete objectives [3]. Best campaign pattern: mini-sandbox levels with vehicles [5].

## Movement

| Item | Detail | Src |
|---|---|---|
| Sprint, jump, crouch, prone | Standard; prone added in BF3 [4] | [4] |
| Lean | BF6 adds lean around cover [8] | [8] |
| Drag/hitchhike | BF6: drag fallen allies before reviving; ride on vehicles [8] | [8] |
| Slide, dive, mantle/vault | Sliding and vaulting exist in BF6 (background; slide numbers not found) | unverified |
| Weapon mobility stat | BF6 weapons have Mobility stat affecting speed, including ADS [10] | [10] |
| Speed numbers (m/s), ADS times | not found | gap |

## Weapons and equipment

- Class structure by game:
  - BF1942: Scout, Assault, Anti-Tank, Medic, Engineer (5) [2][11].
  - BC2: Assault, Engineer, Medic, Recon; pistols and shotguns for all [3].
  - BF3: Assault (heals), Support (ammo, LMG), Engineer (vehicles), Recon (sniper, beacon) [4].
  - BF4: carbines for all kits; Assault must wait for defib recharge; Support remote mortar, XM25; Recon DMR, C-4, MAV, beacon [5].
  - BF1: Assault, Medic, Support, Scout, plus automatic Pilot and Tanker; Cavalry class with horse [6].
  - BF2042: Specialists replaced classes (10 at launch, later 14 total; Camila Blasco Season 4 last) [7]; class system restored in Update 3.2 in Season 3 [7].
  - BF6: Assault (ARs, grenade launchers, faster regen), Engineer (SMGs, vehicle repair/AT), Support (LMGs, ammo, makeshift cover, heal/revive), Recon (snipers; headshot kill prevents revive; hold breath) [8]. Any weapon can be used by any class but class perks tie to weapons [8].
- Vehicles: BF1942 35 vehicles incl tanks, jeeps, planes, ships, capital ships, submarines, carriers, coastal artillery, AA guns [2][11]. BC2 15 vehicles incl ATVs, tanks, helis, MQ-8 drone; vehicles spawn once flag is captured [3]. BF3 jets return, Armored Kill adds tanks, ATVs, mobile artillery [4]. BF4 adds attack boats, Type 99 tank, Z-10W heli [5]. BF1 zeppelin, armoured train, horses [6].
- Gadget stat system (BF6 weapons): Hipfire, Precision, Control, Mobility; plus Fire modes, Reload time, Muzzle velocity, ADS time, Headshot multiplier (headshot = body damage times multiplier, rounded up) [10]. 31 firearms in four classes (LMG, AR, SMG, CRB) tracked by a community dataset (TTK at 0/20/35/75 m, RPM, velocity) but the page shows no per-gun numbers [12].
- Attachments: weapon mods with attachment limit [8]; hit multipliers affected by hollow point and synthetic ammo [10].
- BF2042 gadgets: drones, turrets, vehicle air-drops [7].
- Destruction: BC2 most buildings partly destroyable and fences/walls yield to gunfire [3]; BF3 on Frostbite 2 reported by Joystiq as less extensive than BC2 [4]; BF4 Levolution skyscraper collapse, flooding, power cut [5]; BF6 demolish buildings with explosives or heavy vehicles, floors can be destroyed; intentionally not all buildings [8].

## Abilities and items

- BC2 medic equipment speeds regeneration; defib revive; ticket refund [3][9].
- BF4: Commander mode (RTS view, vehicle drops, missile strikes) [5]; BF3/4 Recon spawn beacon [4][5].
- BF1: Scout flare/periscope spot, Support limpet and mortar, Tanker hammer-wrench repair [6].
- BF6: Support makeshift cover, Engineer repair; Recon prevents revive [8].
- Perk analogue: BF6 class perks tied to weapon types [8]; BF2042 Specialist traits [7].

## Health and damage

- BC2: regenerating health rather than hit points; medic gear speeds recovery [3].
- Suppression (BF3): blurs vision, reduces accuracy, slows regen [4]; suppression cancels regeneration [13]; BF4 reduced suppression for most weapons, MGs and DMRs still strong [13][14].
- Bullet velocity/drag: BF3 suppressed snipers have lower muzzle velocity so more drop and lead [14]; BF6 update (Jun 2026 report) lowered velocity on most guns, most for SMGs, higher drag beyond about 150 m, bullet deviation after the first shot slightly up, limb and lower-torso damage reduced except shotguns and sidearms, close TTK for automatic primaries stays 200-300 ms (similar to BF3/BF4) [15].
- BF3 patch proposals changed min damage from 34 to 40 and drop-off start from 8 to 15 m (proposal, unverified final) [14].
- BF4 community test reduced suppression and damage to lengthen fights [14].
- Max HP and regen delay (100 HP, ~ regen after few seconds): unverified.
- Revive: defib (assault BF4, medic elsewhere); headshot kills stop revive in BF6 [8].
- Vehicle health/armor zones: not found (gap).

## Modes and match options

- BF1942: Conquest only core (plus single-player vs bots) [2][11].
- BC2: Conquest, Rush, Squad Rush, Squad Deathmatch (up to 4 squads, first to 50 kills), Onslaught co-op vs AI (not on PC) [3].
- BF3: Conquest, Rush, Squad Deathmatch, Squad Rush, TDM (first since 1942), later Conquest Domination, co-op missions [4]; hardcore returned [16].
- BF4: Conquest, Domination, Rush, TDM, SDM, Obliteration, Defuse, later Air Superiority, Carrier Assault; 64 players (PC/PS4/Xbox One) or 24 (old gen) [5].
- BF1: Conquest, Conquest Assault, Domination, Rush, Operations, TDM, War Pigeons, Frontlines, Supply Drop, Air Assault, Shock Operations, Back to Basics [6].
- BF2042: Conquest, Breakthrough, Portal, Hazard Zone (co-op vs AI, dropped after Season 1); 128 players on PC/PS5/Series (64 old gen); 128-player Breakthrough removed in Update 4.1 [7].
- BF6: Conquest, Breakthrough, Rush, TDM, Squad DM, Domination, King of the Hill, Escalation, Sabotage; Portal rebuilt on Godot engine [8]. Portal rules: health, loadouts etc. adjustable [7].
- Private options: Portal custom rules (BF2042/BF6) [7][8]; other settings unverified.

## Map design

- BF1942: real WWII battles; Wake Island and El Alamein examples [2].
- BF2042: Breakaway is the largest map in the series; extreme weather [7].
- BF6: nine maps at launch; each with smaller Combat Zones for close-quarters [8]. Criticism: some maps too small; Empire State described as run spawn-to-spawn in under 15 s [17]; Blackwell Fields long sight lines; EA is reworking New Sobek City and Blackwell Fields (April 2026) [17][18].
- Spawn killing: BF6 anti-air guns and snipers killing respawning players, and AA shooting down jets after spawn [17].
- Map size by mode: infantry-only modes use small zones; Conquest uses large maps [8].

## Bots and AI

- BF1942: single player is multiplayer against bots, intro to maps [11]. Difficulty levels: unverified.
- BC2: Onslaught is the only mode with AI enemies (not on PC) [3].
- BF2042: Conquest and Breakthrough could be played with or against AI-controlled players ("AI soldiers") [7]; fans disliked bot use after BF2042 [19].
- BF6: bots announced to fill servers; DICE then said AI only appears in Training Grounds playlists in the open beta [19][20]; a later report mentions bots returning on servers with verified experiences after Portal XP nerf (search snippet, uncertain) [20]. Forum demand for solo play vs 64 AI bots [19].
- Campaign AI: BF3 frustrating AI [4]; BF4 minor [5].
- Design lesson: bots should be class-aware and objective-aware (capture flags, drive vehicles) to feel like Battlefield; sources do not describe actual bot behaviours (gap).

## Progression

- BC2: XP unlocks items; 50 ranks; per-class levelling; kit upgrades add pins, awards, camos [3].
- Central stat tracking from BF2 [1]; dog tags from 2142 [1].
- BF2042 Hazard Zone credits; BF6 battle pass seasons [7][8].
- Offline: per-class XP, unlocks, and medals are cheap and fit well.

## HUD and options

- BF2042 launch had no in-game scoreboard and no voice chat (voice about six months later); the squad-only scoreboard hid others' stats [21].
- BF6 squads can voice chat; team/lobby chat is text only [8].
- Spotting introduced in BF4 campaign; Recon MAV; BF6 Support cover [5][8].
- Accessibility settings: not found (gap).

## Best features to keep

1. Conquest ticket + flag loop: clear objectives and scoreboard-free tension [2].
2. Four-class kit with distinct jobs and revive/heal/ammo/repair: forces cooperation [3][4].
3. Rush M-COM pairs: attack-defend with escalating map [3].
4. Operations meta-structure for a bot campaign [6].
5. Partial destruction: collapsing buildings, breakable walls [3][8].
6. Behemoth comeback mechanic [6].
7. Suppression: rewards covering fire [4].
8. Portal-style rule editor: simple knobs (health, loadouts, ticket count) [7].
9. Commander drops, beacon respawn [5].

## Mistakes to avoid

- BF2042 launch: Specialists seen as hero-shooter dilution; no scoreboard, no voice; bugs; thin features; sinking player counts; one of the worst-rated games on Steam [7][21].
- BF4 launch: crashes and server problems; Polygon dropped score from 7.5 to 4 [5].
- 128-player Breakthrough too chaotic; removed [7].
- Spawn kills with AA/snipers around spawns; small maps feeling like CoD [17].
- Campaign story weakness and campaign length complaints [3][6][8].
- BF1942 bots minimal; rushing bots to fill servers resented [19].
- Too-short fights vs too-long fights: BF4 testing adjusted [14].

## Adaptation notes

- Target 16-24 actors total (bots) on low-end: one Conquest map with 3-5 flags, 2-3 vehicles (jeep, tank, helicopter) as simplified arcade physics; avoid full rigid-body destruction; use pre-scored "collapse" events (a few buildings swap to rubble mesh) like Levolution [5].
- Tickets: 100-150 per team, 1 per death, bleed when one side holds more flags (reasonable default; sources describe the mechanism not numbers [2]).
- Rush: attackers 75 tickets (source [9]); 2 M-COMs, 3-4 stages.
- Suppression: cheap screen blur + spread penalty, cancel regen [4][13].
- Bullet physics: projectile with gravity and drag only for snipers and rockets; hitscan for rest (cost). BF6 reference: drag effects beyond 150 m [15].
- Class set: Assault/Engineer/Support/Recon with one gadget each plus any-weapon rule per BF6 [8].
- Bot AI states: capture, defend, revive, repair, snipe; limited senses; difficulty = reaction delay and aim error.
- Touch: contextual button for revive/enter vehicle; auto spot with tap.

## Sources

1. Battlefield (video game series) - Wikipedia. https://en.wikipedia.org/wiki/Battlefield_(video_game_series) (wiki)
2. Battlefield 1942 - Wikipedia. https://en.wikipedia.org/wiki/Battlefield_1942 (wiki)
3. Battlefield: Bad Company 2 - Wikipedia. https://en.wikipedia.org/wiki/Battlefield:_Bad_Company_2 (wiki)
4. Battlefield 3 - Wikipedia. https://en.wikipedia.org/wiki/Battlefield_3 (wiki)
5. Battlefield 4 - Wikipedia. https://en.wikipedia.org/wiki/Battlefield_4 (wiki)
6. Battlefield 1 - Wikipedia. https://en.wikipedia.org/wiki/Battlefield_1 (wiki)
7. Battlefield 2042 - Wikipedia. https://en.wikipedia.org/wiki/Battlefield_2042 (wiki)
8. Battlefield 6 - Wikipedia. https://en.wikipedia.org/wiki/Battlefield_6 (wiki)
9. Rush - Battlefield Wiki (search snippet only). https://battlefield.fandom.com/wiki/Rush (wiki); GameStar modes page (conflicting ticket number) https://www.gamestar.de/spieletipps/spielmodi,3241.html (guide)
10. Weapon stats explained, Battlefield 6 - Shacknews. https://www.shacknews.com/article/146372/weapon-stats-explained-bf6 (guide)
11. Battlefield 1942 - Giant Bomb (search snippet). https://www.giantbomb.com/games/3030-12716/ (wiki)
12. bf6_guns dataset - GitHub. https://github.com/bdeland/bf6_guns (guide)
13. Suppression - Battlefield Wiki (search snippet). https://battlefield.fandom.com/wiki/Suppression (wiki)
14. Battlefield 4 CTE damage and suppression - MP1st; BF3 weapon tweaks - MP1st. https://mp1st.com/news/incoming-battlefield-4-cte-improvements-may-tweak-game-damage-model-reduce-suppression ; https://mp1st.com/news/list-of-tentative-weapon-tweaks-planned-for-next-battlefield-3-patch-2nd-edition (news)
15. Battlefield 6 gunplay changes - AltChar (Jun 2026). https://www.altchar.com/game-news/battlefield-6-details-major-gunplay-changes-ahead-of-next-update-ajOf56Z8oTIj (news)
16. Battlefield 3 game modes detailed - PC Gamer. https://www.pcgamer.com/uk/battlefield-3-game-modes-detailed-hardcore-mode-will-return (review)
17. Battlefield 6 spawn-kill complaints - VGC. https://www.videogameschronicle.com/news/battlefield-6-players-complain-that-its-new-map-lets-snipers-and-anti-aircraft-guns-kill-respawning-players (review)
18. EA reworking BF6 maps - Gfinity. https://www.gfinityesports.com/article/ea-is-reworking-battlefield-6s-worst-maps-and-new-sobek-city-is-first (news)
19. Bots in BF6 - Gfinity; EA forum request for solo AI. https://www.gfinityesports.com/article/battlefield-6-will-use-bots-if-not-enough-players-join ; https://forums.ea.com/discussions/battlefield-6-general-discussion-en/please-dice-bring-back-solo-pve-with-64-ai-bots-/13596290 (review/forum)
20. DICE clarifies bots in BF6 beta - Insider Gaming. https://insider-gaming.com/dice-clarifies-how-bots-work-in-battlefield-6-beta/ (news)
21. Battlefield 2042 review: Aimless and shameless - Shacknews; launch reasons - Sportskeeda. https://shacknews.com/article/127744/battlefield-2042-review-aimless-and-shameless ; https://sportskeeda.com/esports/5-reasons-battlefield-2042-failed-good-live-service-game (review)

Gaps: BF1942 manual, per-weapon tables for BF3/BF4/BF1, movement speeds, bot AI behaviour/difficulty details, vehicle stats, official patch notes, GDC talks.
