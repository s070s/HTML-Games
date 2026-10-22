# Overwatch (Overwatch 1 and Overwatch 2) - design notes for an original first-person clone

Conventions: "[n]" = source number. "unverified" = weak/conflicting/not confirmed. Version context: Overwatch (2016, 6v6) -> Overwatch 2 (Oct 4 2022 early access; official release Aug 11 2023; 5v5) -> renamed back to "Overwatch" Feb 2026 (per Wikipedia) [1]. Numbers below are mostly launch-era; hero values change every patch.

## Identity

- Blizzard, 2016; team-based hero shooter, two teams, first-person. Original Overwatch had 6v6 (2 tank / 2 damage / 2 support after role queue in 2019). Overwatch 2 went free-to-play, 5v5 [1][2].
- Original: universal acclaim, Game of the Year at The Game Awards 2016, over $1 billion revenue in year one [2]. OW2: Metacritic PC 79, 35 million players in first month; Steam worst-rated within 48 hours of release; recovered to "Mixed" after Season 15 [1].
- Roles: Tank, Damage, Support. A June 2018 update merged Offense and Defense into Damage [2].
- Version differences: 6v6 to 5v5 (one tank); Assault (2CP) removed from standard play; Push, Flashpoint (Season 6, Aug 2023), Clash (Season 12, Aug 2024; per Wikipedia later removed from core modes in 2026) and Stadium (Season 16, Apr 2025) were added [1][3].

## Core loop

- Round structure: modes are objective-based rounds, best-of-three or timed attack/defense; heroes can be switched at spawn mid-match, which is the core strategy layer [2].
- Mode rules [3][4]:

| Mode | Rule | Overtime |
|---|---|---|
| Control | First team to 100% capture wins a round; best of three | Triggered when a team has 99% and point still contested |
| Escort | Attackers push payload to final checkpoint; ~3 checkpoints; checkpoint adds time; payload moves only when attackers are near and rolls back if they leave | Triggered if time ends while attackers contest payload |
| Hybrid | Capture point first, then payload spawns and is escorted | same as above |
| Push | Both teams push a robot that moves a barrier; furthest progress wins | If the team with less progress holds the robot at time end |
| Flashpoint | Multiple capture points unlocked one at a time; first to 3 points | capture-style |
| Clash | Capture/push hybrid, added Season 12 (rules not fetched; unverified) | |
| Assault (2CP) | Removed from competitive/standard in OW2; in custom games [3] | |

- Exact time limits, checkpoint time bonuses and overtime length: not found (unverified). A Blizzard event note shows one temporary rule: 70% of normal time in a limited Quick Play event [5].
- Competitive: both teams attack and defend in A/D modes, hero bans enabled, longer matches [4].
- Ultimate charge: heroes start each round with 0; passive charge about 5 points per second after doors open (unverified wiki-derived); combat charge roughly 1 point per damage dealt/healed; damage to overhealth gives half; damage to tanks about 40% less; costs vary by hero (e.g. Ana 1875, Sombra EMP 1250 in an old thread, unverified); ult costs raised by 25% across heroes in a patch [6].

## Movement

- Hero-specific movement kit rather than a shared sprint-slide-mantle set: base walk speed about 5.5 m/s (unverified), crouch, jump; all heroes have a jump, some have double-jump or fly.
- OW2 role passives (launch): Damage heroes move slightly faster (one source: +25% movement and reload speed for 2.5 s after an elimination); Tanks take reduced knockback and give less ultimate charge (30% knockback resistance, 50% less ult charge quoted at launch); Supports regenerate 15 HP/s after 1.5 s without damage [7][8]. Blizzard's announcement gives no numbers [8].
- Representative movement abilities: Tracer blink (3 charges) and recall; Genji dash/wall-climb; Pharah/Mercy flight; Winston jump pack; D.Va boosters; Wrecking Ball grapple; Sombra translocator; Lucio wall-ride; Doomfist slam; Echo glide. Counts/cooldowns unverified.
- Jump pads and teleporters exist on maps; no ziplines.
- FPS adaptation: give each class one signature mobility skill (blink, dash, glide) rather than a universal slide.

## Weapons and equipment

- Hero weapons are fixed per hero: hitscan rifles (Soldier: 76), projectile (Pharah), beams (Zarya, Symmetra), melee (Reinhardt hammer), spreads (Reaper), snipers (Widowmaker, Ana). No loot, no ammo pickups; reload is per weapon [2].
- Equipment: no attachments; health packs on map and ultimate-based powers.
- Armour/shield items: Torbjorn's armour packs (not healable), barrier shields [9].
- FPS adaptation: each class has one primary + one alternate fire; no loot needed for hero modes.

## Abilities and items

Role design [7][8]:

| Role | Job | Representative heroes (original / OW2) | Typical ability archetypes |
|---|---|---|---|
| Tank | Absorb, create space; 1 per team in OW2 | Reinhardt, Winston, D.Va, Orisa, Zarya, Roadhog, Sigma, Junker Queen, Ramattra, Mauga, Hazard | barrier / shield, charge, bubble, hook, gravity, jump |
| Damage | Eliminate; 2 per team | Soldier: 76, Tracer, Genji, Pharah, Reaper, Hanzo, Widowmaker, Mei, Sojourn, Cassidy, Sombra, Bastion, Junkrat, Echo, Venture, Ashe | hitscan, projectile, burst, area denial, flank |
| Support | Heal/buff; 2 per team | Mercy, Ana, Lucio, Zenyatta, Moira, Baptiste, Brigitte, Kiriko, Lifeweaver, Illari, Juno | beam heal, grenade, aura, discord, resurrection, immortality |

- The roster lists 50+ heroes (Ana through Zenyatta, plus newer additions such as Freja, Hazard, Juno, Venture, Mizuki, Wuyang; names from the official heroes page) [10].
- Ultimates: one per hero, charged by passive time and combat output (see Core loop); typical examples: team heal burst, area damage, invulnerability, resurrect, speed boost, transformation. Cooldown/charge costs per hero: unverified.
- Cooldowns: abilities range from 1-s to 15-s cooldowns plus a signature ability (details vary and are unverified).
- Role design in OW2: tanks lean offensive (brawlers) with Winston secondary fire and Reinhardt changes; Mei's blaster slows but no longer freezes; Bastion reworked [8].
- Role queue (2019): 2-2-2 in OW1; 1-2-2 in OW2.

## Health and damage

- Layers: health (white, healed by healers/packs), armour (orange), shields (blue, regenerate after a delay), overhealth (bonus health) [9][11].
- Damage order: overhealth and shields/barriers first, then armour, then health [11].
- Armour rule is conflicting: wiki says 7 flat reduction capped at 50% of incoming damage, not on beams/damage-over-time (current-ish); older/PTR notes: 5 flat reduction for hits >= 10 and halved below 10; one forum says 5 per point (older); a percentage model (30%) also appears. Pick one for a clone and mark as design choice [11][12][9].
- Barriers block bullets and projectiles but not melee or Winston's beam [9].
- Headshot critical multiplier: x2 is general knowledge for hitscan heroes, not confirmed in this pass (unverified).
- Typical health pools (unverified here): damage/support about 200 (150-250 range), tanks about 450-650 (OW2 tank pools increased in later seasons).
- Damage falloff: per-weapon (e.g. hitscan falloff ranges); numbers unverified.
- Healing: many support heroes; Supports in OW2 passive regen (15 HP/s after 1.5 s) [7].

## Modes and match options

- Core: Quick Play, Competitive (role queue, bans), Unranked, Arcade (rotating: Deathmatch, Mystery Heroes, Team Deathmatch, etc.), Practice vs AI, Custom Games [4][13].
- Custom games and Workshop: original Overwatch added custom games with limited scripting; Workshop with a scripting editor later; community codes (workshop.codes) enable custom bot behaviours and aim trainers [2][14].
- Stadium (April 2025): separate mode; Blizzard announced in July 2026 it would stop adding new content [1].
- Hero bans in competitive [4].
- Custom option examples: team size, hero availability, cooldown scale, health multiplier, damage multiplier (Workshop; exact settings unverified).

## Map design

- Maps follow the mode: symmetrical control arenas, linear payload lanes with side flanks, "choke" doors at spawn exits, high ground and health packs on flanks [3]. Examples from the OW2 reveal: Rio (Escort), New York City (Hybrid), Rome (Push), Monte Carlo (Escort) [8].
- Design principles (unverified, general knowledge): clear lanes, three route options at each stage, spawn rooms with long exits, vertical flanks for mobility heroes.
- FPS adaptation: three 2-3-lane maps with a shared prop kit (crates, pillars) and a single objective type per map.

## Bots and AI

- Practice vs AI: team of 5 humans vs AI heroes; difficulty tiers Casual, Hard, Lethal; higher tiers raise damage, accuracy, ability use, movement (the last claim "citation needed") [15].
- Practice Range: objective-free map with 4 friendly and 11 hostile training bots that stand, shoot or move [15].
- Workshop bots add configurable count, respawn, reaction time, pathfinding and movement logic (community code) [14][15]. A 2021 thread says bots spawn only in objective modes (may be outdated) [15].
- Reception: Practice vs AI useful for beginners, but players asked for lower-difficulty and better pathfinding; evidence is forum-based (unverified).

## Progression

- OW1: loot boxes (cosmetics only; Belgian regulators investigated them as possible gambling); level-ups give boxes [2].
- OW2: loot boxes removed for a seasonal battle pass and shop; backlash especially over the hero Kiriko behind the first battle pass; Season 15 (Feb 2025) returned earned-only loot boxes [1].
- Offline fit: per-hero mastery challenges, cosmetic recolours unlocked by play, no premium currency.

## HUD and options

- Hero-specific HUD with ability icons, ultimate percentage ring, team health, kill feed and objective bar [2].
- Ping/communication: contextual ping and quick chat existed in OW1; OW2 added a ping system (details not found in the checked Blizzard post; unverified) [8].
- Accessibility: customisable controls praised for letting a player with cerebral palsy play; colourblind mode (red/blue shield tint) and subtitles exist (general knowledge, unverified) [2].
- Play of the Game / highlights was a signature feature and also criticised [2].
- GDC 2017 talk "Overwatch Gameplay Architecture and Netcode" (Timothy Ford, GDC Vault, paywalled): ECS with components for state and systems for behaviour, singleton components for shared state, authoritative server, client prediction and rollback replay, fixed 16 ms command frames (7 ms in tournament mode), prediction of abilities and projectiles by default; ~46 systems and ~103 component types (secondary summaries) [16][17].

## Best features to keep

1. Role-based team structure and the hero switching layer [2][7].
2. Short, readable ability kits with clear counterplay [2].
3. Objective modes with overtime and comeback mechanics (Control, Escort, Push) [3][4].
4. Practice range and AI practice with tiered difficulty [15].
5. Custom games/Workshop as a content engine [2][14].
6. ECS architecture for simple deterministic gameplay code [16].

## Mistakes to avoid

- PvE Hero mode cancelled (May 2023), later all PvE dropped; a paid 3-mission story pack sold poorly (Bloomberg, March 2024); fans reacted harshly to the lack of early communication [1][18][19].
- Monetisation: loot boxes (investigated as gambling), then battle pass with paywalled hero Kiriko, high cosmetic prices; Steam review-bombing [1][2].
- Launch failures: DDoS attacks and mandatory SMS verification locking out prepaid-phone players [1].
- Game-mode churn: Clash removed (2026), Stadium content halted [1].
- Reviews: chasing trends and questioning Blizzard's handling of the predecessor [1].
- OW1: toxicity, matchmaking, specific hero balance (McCree) [2].

## Adaptation notes

- 6v6 or 5v5 with bots: 5 humans/bots per side is the cheapest for CPU (10 agents) at 120 fps on phones.
- Use 8-10 hero archetypes, one tank, two damage, two support; implement armour as flat reduction with a cap (design choice).
- Objective logic is finite-state: capture meter (0-100), payload position on a spline, overtime timer; no physics needed.
- Ultimate charge: 5 points/s passive + 1:1 damage/heal; cost 1000-2000.
- Netcode lessons are moot offline, but fixed 60 Hz simulation steps and ECS-like arrays give determinism for replays and bots.
- Procedural audio for ultimate voice stings; HUD uses large readable ult ring.

## Sources

1. Overwatch 2 (2023 video game) - Wikipedia - https://en.wikipedia.org/wiki/Overwatch_2 - wiki
2. Overwatch (video game) - Wikipedia - https://en.wikipedia.org/wiki/Overwatch_(video_game) - wiki
3. Overwatch Gamemodes Explained - ProSettings - https://prosettings.net/blog/overwatch-gamemodes-explained/ - guide
4. Overwatch (Wikipedia) and comp mode rules (search results) - https://guildorder.com/ru/games/overwatch/wiki/comp-mode-rules - guide
5. Blizzard, Quick Play: Hacked - Quicker Play - https://overwatch.blizzard.com/en-us/news/24021898/this-weekend-only-jump-into-quick-play-hacked-quicker-play/ - official
6. Overwatch Wiki, Ultimate ability (search snippet; fandom pages return HTTP 402) - https://overwatch.fandom.com/wiki/Ultimate_ability - wiki
7. God is a Geek, 7 most impactful OW2 changes - https://www.godisageek.com/2022/05/overwatch-2-the-7-most-impactful-changes-and-what-they-mean-for-the-game - review
8. Blizzard, First look at PvP changes in Overwatch 2 - https://overwatch.blizzard.com/en-us/news/23663245/ - official
9. Over.gg, Health types and how they work - https://over.gg/25/health-types-and-how-they-work - forum
10. Overwatch heroes page - https://overwatch.blizzard.com/en-us/heroes/ - official
11. Overwatch Wiki, Hit points (search snippet) - https://overwatch.fandom.com/wiki/Hit_points - wiki
12. Blizzard forums, What does armor do exactly? - https://us.forums.blizzard.com/en/overwatch/t/how-do-different-health-bars-work/850387 - forum
13. Overwatch Wiki, Practice vs. AI (search snippet) - https://overwatch.fandom.com/wiki/Practice_vs._AI - wiki
14. Workshop.codes, Advanced Practice Range - https://workshop.codes/ATJZQ - guide
15. Blizzard forum / wiki: Practice Range and bots (How can I 1v1 bots?) - https://us.forums.blizzard.com/en/overwatch/t/how-can-i-1v1-bots/554739 - forum
16. GDC Vault, Overwatch Gameplay Architecture and Netcode - https://gdcvault.com/play/1024001/-Overwatch-Gameplay-Architecture-and - official
17. Edgegap, Game backend deep dive - Overwatch netcode - https://edgegap.com/blog/game-backend-deep-dive-overwatch-2016-netcode-architecture-rollback - review
18. Nintendo Life, Blizzard cancels OW2 PvE Hero Mode - https://www.nintendolife.com/news/2023/05/blizzard-cancels-overwatch-2s-long-awaited-pve-hero-mode - review
19. KitGuru, OW2 PvE campaign cancelled / MP1st Bloomberg report - https://www.kitguru.net/gaming/matthew-wilson/overwatch-2s-big-pve-campaign-has-been-cancelled/ - review

Gaps: Overwatch Wiki (Fandom, wiki.gg) and Liquipedia could not be fetched (HTTP 401/402/403) so hero base health, ability cooldowns, ult costs, falloff and headshot values are unverified; round time limits and overtime lengths missing; ping system details for OW2 not found; Wikipedia's 2026 claims (rename, Clash removal, Stadium end) come from one source. Several sources read only through search summaries (4, 6, 9, 11-15, 17-19).
