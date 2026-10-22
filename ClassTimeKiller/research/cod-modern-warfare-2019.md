# Call of Duty: Modern Warfare (2019 reboot) - design notes for an offline FPS clone

Evidence tags: [n] = numbered source below. "unverified" = background knowledge or weak source. Fandom wikis returned HTTP 402 to the fetch tool; per-weapon damage tables were not found (gap).

## Identity

- Infinity Ward, Activision. Released 25 Oct 2019 on PS4, Windows (Battle.net; Steam from 8 Mar 2023), Xbox One; on Game Pass from 17 Apr 2026 [1]. Metacritic about 80-81 [1]. Sales over 30M by Sep 2020, 41M by 2025 [1].
- Version notes: free seasonal content about every 8 weeks replaced paid map packs; 100-tier battle pass of cosmetics; Warzone (150 players, Gulag second-chance, cash-based loadouts) added in Season 2 [1]. Series later reused the "Modern Warfare" name again (MW4 beta, 2026) with a tactical sprint perk and sprint-to-fire changes [9].
- Pillars: realism-leaning tone, new engine, tactical sprint, door interaction, Gunsmith with deep attachments, no paid season pass.

## Core loop

- Campaign (grey-morality, grades by civilian casualties A-F per level) [1]: Price, Gaz, Alex, Farah vs Russian forces and Al-Qatala in Urzikstan; dialogue changes with choices [1]. Notable levels (names from the article's navigation and background): Clean House (night-vision raid; fast clear with civilians mixed in), Highway of Death, Going Dark (night vision/Snapshot), Hometown, "No Russian" naming appears among linked levels [2][1] - mission details beyond that are unverified.
- Campaign design patterns: moral choices, threat assessment grade, fail-state for civilian harm, Special Ops co-op: four large Operations for four players plus classic Special Ops; Survival was PS4-exclusive until Oct 2020 [1].
- Multiplayer loop: spawn in modes with kill-based Killstreaks (Pointman perk converts to Scorestreaks) [1], loadouts via Create-a-Class with Gunsmith, rank/weapon level progression, Field Upgrades recharge over time [3].

## Movement

Activision's own guide (qualitative) [4]:

| Move | Rule | Source |
|---|---|---|
| Sprint | Louder footsteps (unless Dead Silence field upgrade), slower ADS, no weapon use | [4] |
| Tactical sprint | Double-click then hold; fastest on-foot; cannot ADS without ending it; one per life unless refreshed by perk/field upgrade; weapon held up so readying is slower | [4] |
| Slide | Hold crouch while sprinting; short speed boost, lower profile, accuracy/recoil buffs; hold or tap configurable | [4] |
| Mantle | Press prompt near an edge; no weapons while mantling | [4] |
| Prone | Best accuracy/recoil, quietest, slowest | [4] |
| ADS | Slower after sprint; Lightweight Stock reduces penalty | [4] |

- Numbers (sprint speeds, ADS ms): not found for 2019. For the later MW3 (2023) one source reports 5.0 / 5.7 / 7.0 m/s (base / sprint / tactical sprint), later trimmed to 4.8 / 5.5 / 6.8 [8]; treat as unverified and not applicable to 2019.
- Lean and mount (doorframes/walls): present in 2019 per general knowledge; guide did not cover them [4] (unverified). Dolphin dive: not in 2019.
- Doors: open slowly or quickly; players can breach (unverified, background).

## Weapons and equipment

- Roster: Infinity Ward revealed M4A1, FR 5.56, MP5 among others at the press event; MP5 described as balanced, M4A1 as an all-purpose auto rifle [5]. Final list included Kilo 141, Grau 5.56 etc. (unverified in sources).
- Gunsmith: most guns have up to about 60 attachments, five equipable at once [1].
- Time-to-kill: described as faster than Black Ops 4 [6]; numeric TTK/damage tables: not found (gap). Community complaints about dominance of the 725 shotgun and M4A1 [10].
- Equipment (killstreak/field upgrade names from sources [3][7]):

| Streak | Cost | Notes |
|---|---|---|
| Shield Turret, Personal Radar | 3 kills (375 score) | [7] |
| UAV | 4 kills (500) | [7] |
| Counter UAV | 4 kills (500) | [7] |
| Cruise Missile | 5 kills (625) | player-controlled, boost [7] |
| Support Helo | 11 kills | [7] |
| Chopper Gunner | 8 and 10 kills (two variants) | pilot-style turret, about a minute [7] |
| White Phosphorus | 10 kills | criticised as heinous [1][2] |
| Advanced UAV, Gunship | 12 kills | [7] |
| Juggernaut | 15 kills | [7] |
| Nuke | 30 kills, no equip needed | [7] |

(Costs are kills; reported values from [7] were mixed - some entries conflict, check before copying.)

## Abilities and items

Perks (pre-release list, so final differs) [3]:

| Slot | Perk | Effect |
|---|---|---|
| 1 | Double Time | triples super sprint, refresh on kills |
| 1 | E.O.D. | less explosive/fire damage, hack enemy claymores, proximity mines, C4 |
| 1 | Scavenger | ammo from dead players |
| 1 | Tracker | enemy trails and death markers, +30% crouch speed |
| 1 | Tune Up | +50% field upgrade charge rate |
| 2 | Ghost | invisible to UAV, Radar Drone, Heartbeat Sensor, High Alert |
| 2 | Hardline | killstreaks cost 1 less |
| 2 | Kill Chain | credit streaks toward other streaks |
| 2 | Overkill | two primaries |
| 2 | Restock | equipment recharges over 30 s |
| 3 | Amped | faster weapon swap, launcher reload |
| 3 | Battle Hardened | weaker flash, stun, EMP |
| 3 | Cold-Blooded | invisible to AI targeting, thermal |
| 3 | High Alert | vision pulses when seen |
| 3 | Shrapnel | extra lethal; explosives delay regen |
| 3 | Spotter | see enemy gear and streaks through walls |

Field upgrades [3]: Munitions Box (medium), Recon Drone (slow), Stopping Power Rounds (slow), Trophy System (fast; destroys up to 3 projectiles), Tactical Insertion (fast), Deployable Cover (fast).

## Health and damage

- Regenerating health (series standard); Shrapnel delays regeneration [3]. Exact HP/regen: unverified (100 HP, about 5 s delay).
- Hardcore / Realism: Realism removes the HUD [1]; Hardcore details not in fetched sources.
- Damage: range-banded with hit multipliers; tables not retrieved (gap).
- Killstreak kill-based (not score-based) in launch version, which critics said encourages camping [10].

## Modes and match options

- Ground War: large player counts (article gives both "over 100" and 64) [1]. Gunfight: 2v2, 40-second rounds [1]. Realism: HUD removed [1]. Cyber Attack (Search-like with respawn) and others: unverified. Standard list (TDM, Domination, HQ, Search and Destroy, Hardpoint, etc.): unverified background.
- Special Ops co-op: four Operations, four players [1].
- Private matches: unverified details.

## Map design

- Criticism: dark, small maps; rooms and corners that fostered camping; lack of "flow" [10][11]. Mini-map was removed in beta, then restored without enemy red dots except under UAV [1]. Mein-MMO listed maps and campers among main complaints [12].
- Large Ground War maps and Gunfight arenas serve different scales [1].
- Spawn logic: not documented in sources (gap).

## Bots and AI

- Offline Special Ops: AI enemies in Operations [1]; Cold-Blooded perk hides you from AI targeting [3], which implies killstreak AI targeting rules.
- Combat training bots in private match: exist in the 2019 version (unverified; no source fetched).
- Campaign AI: grunts, snipers; moral-choice civilians (the article describes civilian-casualty grading) [1].

## Progression

- Ranks (player level to 55 then prestige/Master Prestige: unverified), weapon levels unlock attachments, 100-tier battle pass cosmetic only [1]. Challenges and camos: unverified.
- Offline-friendly: weapon XP and attachment unlock are good local rewards.

## HUD and options

- Minimap restored without red dots; Realism mode hides HUD [1].
- Accessibility (colour options, hold-to-toggle slide): the slide hold/tap setting is documented [4]. Others unverified.

## Best features to keep

1. Gunsmith: deep customization with a cap of five attachments avoids overload [1].
2. Tactical sprint as a limited resource: tempo and a cost [4].
3. Field Upgrades on a recharge timer, not a kill count: keeps all players in use of abilities [3].
4. Perk slots grouped by colour: easy to read [3].
5. Gunfight 2v2 short mode: tiny, replayable; good for bots [1].
6. Moral-choice campaign grading adds meaning [1].

## Mistakes to avoid

- SBMM that compresses all matches into similar skill: stress without payoff [13] "punishes you" feeling [11].
- Camping: loud footsteps, strong claymores, three claymores per life, 725 shotgun across the map [10][11].
- Kill-based streaks encourage camping [10].
- Review bombing over political depiction; avoid real factions [1].
- White phosphorus streak criticised [1][2].
- Small dark maps with campable corners [10][12].

## Adaptation notes

- Use 3-tier perk table above reduced to 6 perks; field upgrades: ammo box, trophy, deployable cover, tactical insertion.
- Tactical sprint: 1 per life, 3 s, cannot ADS, long weapon-ready delay (suggest 0.4 s) - tune numbers yourself (no source numbers).
- Slide: 0.6 s boost, then crouch; keep as animation-free camera dip.
- Bots: no SBMM; one difficulty slider (reaction time, aim error) is enough. Make bots obey sound and vision.
- Keep maps brighter with clear lanes; add periodic open sight lines; limit claymores to 1.
- Rendering: single-pass forward shader, instanced props, no shadow maps on phones.

## Sources

1. Call of Duty: Modern Warfare (2019) - Wikipedia. https://en.wikipedia.org/wiki/Call_of_Duty:_Modern_Warfare_(2019_video_game) (wiki)
2. Same article, references section (white phosphorus, review bombing). https://en.wikipedia.org/wiki/Call_of_Duty:_Modern_Warfare_(2019_video_game) (wiki)
3. Perks and field upgrades revealed - MP1st. https://mp1st.com/news/call-of-duty-modern-warfare-perks-list-and-field-upgrades-list-revealed (news; pre-release)
4. The Basics of CoD: Modern Warfare: Movement - Activision blog. https://blog.activision.com/call-of-duty/2019-10/The-Basics-of-Call-of-Duty-Modern-Warfare-Movement (official)
5. Weapons list - MP1st (search snippet). https://mp1st.com/news/call-of-duty-modern-warfare-2019-weapons-list-heres-every-primary-secondary-and-grenades (news)
6. Modern Warfare time to kill - GameRevolution (search snippet). https://www.gamerevolution.com/?p=612217 (review)
7. Complete killstreaks list - MP1st / Windows Central (search snippets). https://mp1st.com/news/call-of-duty-modern-warfare-complete-killstreaks-list ; https://www.windowscentral.com/every-killstreak-call-duty-modern-warfare (guide)
8. MW3 movement note - FinalBoss (low reliability, other game). https://finalboss.io/call-of-duty-modern-warfare-iii-movement-hipfire-gunsmith-kill-block-guide (guide)
9. MW4 beta movement changes - Insider Gaming (other game). https://insider-gaming.com/modern-warfare-4-beta-movement-changes/ (news)
10. Modern Warfare's biggest issue - Upcomer. https://upcomer.com/?p=38645 (review)
11. Does Modern Warfare have a camping problem? - GameRevolution. https://www.gamerevolution.com/?p=611063 (forum/review)
12. 7 Things CoD: MW Needs - Mein-MMO. https://mein-mmo.de/en/7-things-cod-modern-warfare-needs-now-to-get-better,440605 (review)
13. The real issue with SBMM in MW - Red Bull. https://www.redbull.com/in-en/the-real-issue-with-skill-based-matchmaking-in-call-of-duty-modern-warfare (review)
14. Camping problem - MP1st. https://mp1st.com/?p=116754 (forum/news)

Gaps: damage/TTK tables, sprint and ADS times, hardcore rules, map spawn logic, bot difficulty details, prestige structure.
