# Call of Duty 4: Modern Warfare (2007) - design notes for an offline FPS clone

Evidence tags: [n] = numbered source below. "unverified" = from background knowledge or a single weak/preliminary source; do not treat as fact. Fandom wikis (callofduty.fandom.com, battlefield.fandom.com) returned HTTP 402 to the fetch tool, so wiki facts come only from search-result snippets; this limits depth.

## Identity

- Developer Infinity Ward, publisher Activision. Released 5 Nov 2007 (NA) on Windows, PS3, Xbox 360; Mac 2008; Wii "Reflex Edition" 2009 [1].
- Set the series in modern day (British SAS + US Marines), leaving WWII. Metacritic: PC 92, PS3 94, X360 94, Wii 76 [1]. About 7M sold by Jan 2008, 15.7M by Nov 2013 [1].
- Version notes: a Remastered edition (2016) exists (changed perks/loadouts; not covered here). Console prestige: up to 10 repeats [1].
- Design pillars: tight 60 fps feel (console target), short scripted set-pieces, a fast rank-up/unlock loop in multiplayer, three-perk loadouts, kill-count rewards.

## Core loop

- Campaign: linear, objective-driven, checkpointed; HUD compass points to objectives, explosive plants, and enemy positions [1]. 30 hidden intel pieces unlock cheats/visual filters [1]. Epilogue "Mile High Club" is unlocked after finishing [1]. Critics called it short and linear [1].
- Mission order (18-ish levels; list from a walkthrough): F.N.G., Crew Expendable, Blackout, Charlie Don't Surf, The Bog, Hunted, Death From Above, War Pig, Shock and Awe, Safehouse, All Ghillied Up, One Shot One Kill, Sins of the Father [7].
- Best mission patterns to reuse:
  - **Death From Above (AC-130)**: player is a turret operator only; blinking icons mark friendlies you must not shoot; targets come in a scripted order (car heading to church, swarming soldiers, another car, then next village, soldiers near the landing zone, a hill with 3 RPG soldiers and a car, leftovers); helicopters land when the area is clear, ending the mission [5]. Pattern: no movement, thermal-style view, escalating target waves, friendly-fire rule, voice-over pacing.
  - **All Ghillied Up (sniper stealth)**: flashback; player as Price follows Captain MacMillan through patrolled roads, a house with dogs, a church, junkyard, container yard, gathering at vehicles, ending with a shot at the target [6]. Patterns: companion-paced progress, timed stealth (shoot when patrols cannot see each other), hide in shadow/lie still/crawl, tower guards spot you if you advance too far, disobeying orders triggers an alarm, a Stinger in the church is the fallback if a helicopter spots you [6]. Wind-adjusted final shot is not described in the source I read (unverified from this source).
  - Other set-pieces (unverified, background): Shock and Awe / Aftermath (nuke countdown, crawl), Crew Expendable (sinking ship), Charlie Don't Surf (urban streets). Achievements show Veteran difficulty variants exist for Shock and Awe and Crew Expendable [7].
- Multiplayer loop: spawn, fight, gain XP for kills, objective captures and calling support, rank up and unlock weapons, perks, custom class slots [1]. Killstreak rewards at 3/5/7 kills: UAV, airstrike, attack helicopter [1][10].
- Match flow (unverified, background): short rounds (about 10 min TDM, score limit), 6v6 typical on small-to-medium maps, 16-18 players max for the game.

## Movement

Source quality: no source I could fetch gives numbers. Everything numeric here is unverified background knowledge unless marked.

| Item | Rule | Status |
|---|---|---|
| Walk/run | Single sprint, limited by stamina; Extreme Conditioning perk extends sprint [2] | duration unverified (about 4 s base, perk about doubles) |
| Stance | Stand, crouch, prone; crouch/prone improve accuracy [1] | verified qualitatively |
| ADS | Hold to aim; moving while ADS slows you | time unverified |
| Jump | Plain jump; ledge mantle on some objects | unverified |
| Slide / dolphin dive / lean / mount | Not present in CoD4 (added later in the series) | unverified but widely known |
| Prone | Slower, quieter, steady aim; Dead Silence perk quiets footsteps [2] | partly verified |
| Hold breath | Sniper scope hold breath; Iron Lungs extends it [2] | verified (perk text) |

Takeaway: CoD4 movement is deliberately simple. Good for a low-end clone: fewer animation states, fewer edge cases.

## Weapons and equipment

Damage numbers below come from one guide and are given as max-min damage per bullet, with distances in game units, listed as max-min range (silenced in brackets) [3]. Health is 100 in CoD4 (unverified). Reload times are in seconds [3].

### Assault rifles [3]
| Weapon | Damage | Range | RPM | Reload | Attachments |
|---|---|---|---|---|---|
| M16A4 | 40-30 | 1500-2000 (500-1000) | 925 burst (about 450 effective) | 2 | Red dot |
| AK-47 | 40-30 (40-20 w/ red dot/silencer) | 1500-2000 | 700 | 2.5 | Grenade launcher |
| M4 | 30-20 | 1500-2000 | 850 | 2.03 | Red dot, silencer |
| G3 | 40-30 | 1500-2000 | semi, up to 1200 | 2.75 | GL, red dot |
| G36C | 30-20 | 1500-2000 | 750 | 2.1 | Red dot, ACOG |
| M14 | 50-40 | 1500-2000 | semi | 2.5 | Red dot |
| MP44 | 40-30 | 1500-2000 | 600 | 2.75 | none |

### SMGs [3]
| Weapon | Damage | Range | RPM | Reload | Attachments |
|---|---|---|---|---|---|
| MP5 | 40-20 | 750-1000 | 800 | 2.3 | Red dot, silencer |
| Skorpion | 50-20 | 200-400 | 850 | 2.4 | Silencer, ACOG |
| Mini Uzi | 30-20 | 750-1000 | 950 | 2.4 | Red dot, silencer |
| AK-74u | 40-20 | 750-1000 | 800 | 2.5 | none |
| P90 | 30-20 (50-round mag) | 750-1000 | 925 | 2.8 | Red dot, silencer |

### LMGs, shotguns, snipers, pistols [3]
| Weapon | Class | Damage | RPM | Reload | Notes |
|---|---|---|---|---|---|
| M249 SAW | LMG | 30 | 925 | 6.45 | red dot, grip |
| RPD | LMG | 40 | 700 | 9.7 | grip |
| M60 | LMG | 50-40 | 600 | 9.7 | range 1000-1500 |
| W1200 | Shotgun | 40-10 x8 pellets | 150 | 1 then 0.5/shell | range 300-500 |
| M1014 | Shotgun | 30-10 x8 | 300 | 1 then 0.5/shell | range 300-600 |
| M40 | Sniper (bolt) | 70 (75 ACOG) | up to 70 | 1.1 / 0.4 | |
| R700 | Sniper (bolt) | 70 | up to 70 | 1.1 / 0.4 | 50% more sway |
| M21, Dragunov, .50 cal | Sniper (semi) | 70 | semi | 2.5 / 2.75 / 4.1 | |
| M9 / USP / M1911 | Pistol | 40-20 | semi | 1.6 | USP range 450-1000 |
| Desert Eagle | Pistol | 50-30 | semi | 1.96 | range 350-1200 |

Note: Gamicus snippet confirms M16 and AK-47 damage 40-30 and RPM [4], matching [3].

### Equipment
- Frag grenades, flashbangs, smoke; special grenades (3 extra via perk) [2]; C4, claymore, RPG-7 as perk-1 extras [2]. Underbarrel grenade launcher on AK-47/G3/M16 (noob-tube complaint, see Mistakes) [3]. Frag count 1 by default (unverified).
- Killstreak rewards: UAV (3), airstrike (5), attack helicopter (7) [1][10].

## Abilities and items

Perks: three slots, one per tier, 3 perks per class [1][2]. List from a preliminary article [2] (the final game differs in Perk 1; see conflict note):

| Tier | Perk | Effect | Notes |
|---|---|---|---|
| 1 | Bomb Squad | detect enemy explosives (final); preview article lists extra explosives [2] | unlocked about level 14 (snippet, [8]) |
| 1 | C4 x2, Claymore x2, RPG-7 x2, Frag x3 | extra equipment | level 1 per snippet [8] |
| 1 | Special Grenades | 3 more flash/smoke | [2] |
| 1 | Bandolier | extra ammo | [2] |
| 2 | Juggernaut | extra survivability; one wiki says -25% bullet and explosive damage taken, cancelled by Stopping Power and Sonic Boom [8]; another source only says more health [2] | numbers conflict; "+60 health" unverified |
| 2 | Stopping Power | +40% bullet damage [8] | |
| 2 | Sonic Boom | +25% explosive damage [8] | |
| 2 | Sleight of Hand | faster reload [2] | |
| 2 | Double Tap | faster fire/pump (shotgun/bolt rechamber noted in [3]) | |
| 2 | UAV Jammer | hidden from UAV; unlock level 11 [8] | firing still shows you |
| 2 | Overkill | two primaries, no sidearm; level 38 [8] | |
| 3 | Extreme Conditioning | longer sprint [2] | |
| 3 | Steady Aim | steadier hip fire [2] | |
| 3 | Last Stand | pistol when downed; level 8 [8] | |
| 3 | Deep Impact | wall penetration damage [2][8] | |
| 3 | Dead Silence | quiet movement [2] | |
| 3 | Iron Lungs | longer breath hold [2] | |
| 3 | Eavesdrop | hear enemy chat [2] | |
| 3 | Martyrdom | drop live grenade on death [2] | |

Conflict note: CoD4's final tier-1 content cannot be confirmed from these sources [2][8]; Old School game variants referenced six perks (Juggernaut, Stopping Power, Sleight of Hand, Double Tap, Last Stand, Martyrdom) [8].

## Health and damage

- Regenerating health: take damage, red screen warns, recover if out of fire for a few seconds [1]. Delay and speed: unverified (about 5 s delay, background).
- Damage model: per-bullet damage with distance falloff [3]; hit areas (head, torso, limbs) multipliers: unverified.
- Penetration through thin walls with Deep Impact giving extra [2].
- Hardcore: fewer HUD elements, lower health, friendly fire on (all unverified here, background knowledge); sources I fetched do not describe it.
- No suppression, no revive.

## Modes and match options

- Verified: free-for-all, team modes, objective modes: deathmatch, control-point capture ("Domination") and planting explosives [1].
- Unverified (background): Free For All, Team Deathmatch, Domination, Headquarters (rotating HQ with timer), Search and Destroy (one life, bomb plant/defuse), Sabotage (single bomb), hardcore variants, Old School variant (referenced in [8]). Ground War, Gunfight, Cyber Attack did not exist in 2007.
- Private match options (unverified): time limit, score limit, friendly fire, killcam, hardcore flag.

## Map design

- Maps (names from background knowledge, unverified in these sources): Crash, Overgrown, Backlot, Strike, Vacant, Crossfire, Bog, Killhouse, Pipeline, Wet Work etc. Mostly compact 6v6 spaces, two to three main lanes with side flanks and sniper tower windows; one large countryside map (Overgrown).
- Spawn logic (unverified): spawn away from enemy line of sight and towards friendly spawn flags. Players complained about spawning in front of enemies on small maps (general knowledge; no source in this set).

## Bots and AI

- Campaign AI: scripted enemies with infinite respawn closets until the player crosses a trigger line - widely criticised as "closet spawners" (background knowledge, unverified in these sources). Keeping a cap on respawns per trigger and a visible spawn indicator is better.
- Multiplayer bots: none in the 2007 PC release (unverified); no combat training mode.
- Reception: campaign AI frustration is also a critique of later shooters (see battlefield.md, Battlefield 3 campaign).

## Progression

- XP for kills, captures and support calls; rank increases unlock weapons, perks, custom class slots [1].
- Max rank 55 then optional Prestige (reset in return for an insignia) [10][1]; console versions allow up to 10 Prestige repeats [1].
- Challenges (weapon kills, headshots) unlocked camos (unverified background).
- Offline suitability: use ranks/unlocks locally; skip online-only stats.

## HUD and options

- Compass pointing to objectives; damage direction indicators; minimap with UAV red dots (UAV scan reveals enemies) [1].
- Intel items unlock cheats/filters [1]. Accessibility settings: not documented in sources (gap).

## Best features to keep

1. Three-perk custom classes: cheap to implement, large build variety (see tiers above) [1][2].
2. Streaks at 3/5/7 kills: easy tension curve, clear goals [10].
3. Short, authored set-pieces: AC-130 turret sequence and ghillie stealth show how little movement code is needed for strong moments [5][6].
4. Regenerating health with visual warning: clear feedback and pace [1].
5. Per-weapon feel from simple stats: damage range, RPM, reload [3].

## Mistakes to avoid

- Underbarrel grenade launchers (noob tubes) dominated close maps (background; no source in this set).
- Infinite respawning enemies in campaign (background).
- Short, linear campaign was a stated critique [1].
- Preliminary perk lists conflicting with final ones: freeze numbers early [2][8].
- Camping on small maps; spawn trapping (background).

## Adaptation notes

- Keep 100 HP, one hit zone multiplier set, fall-off table based on [3] but normalise: 2 range bands per weapon (e.g. near/far) to save per-frame cost.
- Procedural low-poly maps: three-lane layout, 12-20 sight lines max; bots navigate by waypoint graph.
- Killstreak UAV = temporarily enable minimap enemy dots (cheap).
- AC-130 mission = 2D-style fixed camera, instanced billboards for targets.
- Stealth mission = vision cones + noise radius per stance (prone smallest).
- Touch/gamepad: ADS toggle, sprint auto when stick pushed fully, aim assist modest slowdown on targets.
- Keep audio synthesized: weapon sound = noise burst + tonal body per class.

## Sources

1. Call of Duty 4: Modern Warfare - Wikipedia. https://en.wikipedia.org/wiki/Call_of_Duty_4:_Modern_Warfare (wiki)
2. Call of Duty 4 perks revealed - PSU. https://www.psu.com/news/call-of-duty-4-perks-revealed/ (review/news; preliminary list)
3. Call of Duty 4 weapons guide - Cyberly. https://www.cyberly.org/game-cheats/pc-walkthroughs/call-of-duty-4-weapons-guide.html (guide)
4. Weapons (Call of Duty 4) - Gamicus (search snippet only). https://gamicus.fandom.com/Weapons_(Call_of_Duty_4) (wiki)
5. Mission 7 Death From Above - PortForward. https://portforward.com/games/walkthroughs/Call-of-Duty-4-Modern-Warfare/Mission-7-Death-From-Above.htm (walkthrough)
6. All Ghillied Up - GamePressure. https://www.gamepressure.com/callofduty4modernwarfare/all-ghillied-up/zcf1e (walkthrough)
7. Call of Duty 4 FAQ/Walkthrough and achievements - GameRevolution (search snippet only). https://www.gamerevolution.com/?p=39319 (walkthrough)
8. Juggernaut (perk) and perk pages - Call of Duty Wiki (search snippets only). https://callofduty.fandom.com/wiki/Juggernaut_(perk) (wiki)
9. StrategyWiki CoD4 Perk 2 (search snippet only; page returned 403). https://strategywiki.org/wiki/Call_of_Duty_4:_Modern_Warfare/Perk_2 (wiki)
10. GameSpot user review of CoD4 (max level 55, killstreaks 3/5/7; search snippet). https://gamespot.com/call-of-duty-4-modern-warfare/user-reviews/2200-529613/ (review)
11. Killstreak: A Call of Duty multiplayer timeline - Shacknews (search listing only). https://www.shacknews.com/article/85963/killstreak-a-call-of-duty-multiplayer-timeline-part-1 (review)
12. RSBandB forum thread on CoD4 M4 (anecdotal). https://www.rsbandb.com/forums/viewtopic.php?p=570966 (forum)
13. Modern Warfare 2019 movement blog (for series comparison only). https://blog.activision.com/call-of-duty/2019-10/The-Basics-of-Call-of-Duty-Modern-Warfare-Movement (official)

Gaps: official manual scan, health/regen numbers, sprint/ADS timing, hardcore rules, map list, spawn logic and bot details were not found in fetchable sources; marked unverified above.
