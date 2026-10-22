# Crysis (2007, with Warhead, Crysis 2, Crysis 3) - design notes for an original offline FPS

Evidence tags: [n] = source below. "unverified" = not confirmed. Exact numbers (drain rates, damage) were NOT found in retrievable sources; the official manual and Crysis Wiki (Fandom blocked, HTTP 402) could not be read. Researched 2026-10-22.

## Identity
- Crysis (Crytek, EA, Windows, 2007): FPS on the fictional Lingshan Islands; player is Delta Force soldier "Nomad" vs North Korean forces and alien machines. [1][2]
- Series: Warhead (standalone, shorter, more Korean encounters, improved AI and pacing, added grenade launcher, plasma cannon, mines), Crysis 2 (New York, simplified suit), Crysis 3. Metacritic PC: Crysis 91, Crysis 2 86, Crysis 3 76. Crysis 4 announced 2022, on hold since Q3 2024. Remasters: 2020, Trilogy 2021. [1][2][3][4]
- Meme: "But can it run Crysis?" - the game was a hardware benchmark. [1][2]

## Core loop
- Campaign of large open-ish levels: reach objectives by stealth or assault, using suit powers, vehicles and weapons; secondary objectives (camps, radar stations) change the main mission, e.g. reveal positions or pull forces away. [2][5]
- Enemy detection: soldiers react to noise and call reinforcements with flares. [2]
- Structure: day/night island section, a late frozen alien structure, a final set piece. Criticized final third. [2]
- Multiplayer (ended with GameSpy shutdown in 2014): Instant Action (free-for-all, pistol start, weapons on map) and Power Struggle (team mode; destroy enemy HQ with superweapons bought with Prestige Points; earn by kills, control points, alien crash sites; buy at bunkers/factories). 32 players. [2][7][8]

## Movement
- Nanosuit speed and strength modes shape movement:

| Mode | Movement effect |
|---|---|
| Speed | faster walking, running, swimming; sprint drains energy fast; jump longer [6] |
| Strength | higher jumps (taller not longer), steadier aim, reduced recoil [6] |
| Armor/Cloak | normal movement; cloak muffles movement noise [6] |
- Strength jump + grab: throw objects and enemies [2]. Sliding/vault in Crysis 2/3 (unverified); Crysis 2 added context-based enhancements (sprint, power jump) instead of explicit speed/strength modes. [1][9]
- Swimming and vehicle driving are core (ground and naval; limited aircraft; a VTOL mission in the first game). [2][10]

## Weapons and equipment
- Arsenal: pistols, SMGs, assault rifles, shotguns, sniper, gauss rifle, miniguns, rocket/missile launchers, alien MOAC ice gun, TAC nuke launcher; Warhead adds grenade launcher, plasma cannon, mines. [2][10]
- Real-time attachment customization: scopes, silencers, flashlight/laser, underbarrel launcher swapped on the fly while moving; many have multiple fire modes. [1][2][10]
- Grab/throw: Strength mode lets you pick up objects and enemies and throw them (used as a weapon; barrels, crates). [2]
- Destruction: falling trees, collapsing buildings, tires, fuel cans. [2][10]
- Stats (damage, ammo, rate of fire): not retrieved; unverified.

## Abilities and items
- Original suit: four modes drawing on one energy bar [1][2][6]:

| Mode | Rule | Cost |
|---|---|---|
| Armor | Hits drain suit energy instead of health; at zero energy health is lost; energy recharges to 100% when not threatened and recharges faster here | Energy per hit |
| Strength | Melee, throw, jump, steadier aim | Energy per use |
| Speed | Faster move; sprint drains energy fast; short bursts | Energy while sprinting |
| Cloak | Near invisibility; moving drains energy; firing breaks cloak and drains the meter completely | Energy while active |
- Reviewers say drain is quick, making speed/cloak feel limited; cloak still useful for escapes. Common tactic: cloak, advance, rest in cover to regenerate, repeat. [6][10]
- Crysis 2 "Nanosuit 2.0": armor toggled manually and drains constantly; speed/strength merged into Power; stealth remains; six modes/enhancements in some counts, some unlocked by leveling. [9][11]
- Crysis 3 adds a compound bow (unverified here; not retrieved).
- Suit mode switching was radial/quick menu in 2007 (unverified); Crysis 2 used context-sensitive hotkeys.

## Health and damage
- Nano suit energy acts as a combined shield/ability bar; armor mode converts hits to energy loss; once energy is out, health drains; health regenerates (suit auto-heals out of combat; unverified numbers). [6]
- KPA soldiers die easily; aliens are tougher and repetitive. [10]
- Difficulty levels (Easy to Delta; Delta is hardest) change enemy accuracy/health (unverified specifics).

## Modes and match options
- Single-player campaign; Instant Action and Power Struggle on 32-player maps; Crysis Wars was the multiplayer name for Warhead. [2][7][12]
- Options: graphics settings (very high only on future hardware), weapon customization toggles, difficulty. [1]

## Map design
- Open sandbox islands: broad corridor "a really broad path" with multiple routes (jungle, beach, base, valley, mountain), secondary objectives affect main one. [5]
- Crysis 2 shifted to New York streets and narrower levels, called more linear (a review compared them to on-rails shooters in places); Crysis 2 retrospective in 2026 says linearity is exaggerated against modern open-world shooters. [9][11][13]
- Level design lesson: give a hub area, 2-3 entry directions (stealth over cliff, frontal assault, vehicle), and a suit mode that matches each.

## Bots and AI
- Outdoors: soldiers back off during firefights and advance when they have numbers and firepower; squads use snipers, vehicles and emplacements. [5][10]
- Indoors: AI reverts to simple behavior - pop-up shooting, no grenades or flanking, can get stuck behind bodies; spotted from far while allies ignore gunfire; cloaked player can walk near enemies. Compared unfavorably with F.E.A.R. [5]
- Alert model: forum report that a silenced shot at long range alerts only the shot soldier, while misses make nearby soldiers search as a group; alert bar rises (single anecdote). [14]
- Developers aimed for realistic opponents; because levels are free-roaming, AI "does the same as you do" (2006 interview). [15]
- CryEngine docs list a later AI framework with behavior trees, navigation mesh, tactical point system, perception ("AI awareness"); last used in Crysis 3. Internals not retrieved. [16]
- Aliens: Troopers, Scouts, Hunters (and Guardian Troopers, Orange Scouts in Warhead): repetitive. [10]
- Clone design: states Idle -> Suspicious (investigate noise/last seen) -> Alert (squad call-out, flare) -> Combat (cover-to-cover, retreat if outnumbered) -> Search (sweep last known position for ~10-20 s, unverified time). Alert level raised by noise, light and visibility.

## Progression
- Single-player: no XP; progress is mission-based; weapons found, suit fixed. [2]
- Crysis 2 added upgrade nanocatalyst points for suit modules (general knowledge, unverified).
- Power Struggle: rank grants more Prestige per spawn; forum numbers 100 for private to 1000 for general (unverified); rank resets each match. [8]
- Offline fit: no persistent progression needed; unlock attachments per mission.

## HUD and options
- Compact suit-energy bar and current mode icon, minimal crosshair, weapon attachment quick-menu; flares and radio chatter as feedback (partially unverified). [2]
- Minimal accessibility notes in sources; gap.

## Best features to keep
1. Suit-mode choice as one energy economy: stealth vs armor vs speed vs strength, each tied to a clear tactic. [1][6]
2. Approach freedom with secondary objectives that alter the main fight. [5]
3. Real-time weapon attachments. [2]
4. Grab-and-throw physics. [2]
5. Destructible props and day/night variety. [2][10]

## Mistakes to avoid
- Performance demands that locked out most hardware - "can it run Crysis" became a scandal-meme. [1][2]
- Crysis 2 linearity, weaker/simplified suit, loss of speed/strength modes. [9][11][13]
- Repetitive alien enemies and a weak final third; shorter Warhead; minimal improvements. [1][2][10]
- Inconsistent AI (indoors weak, allied AI poor). [5]
- Suit drain so fast that stealth feels tedious. [10]

## Adaptation notes
- Reduce to 3-4 modes sharing one energy meter; armor converts damage to energy loss; cloak breaks on firing.
- Levels: use a compact "island" of 3 zones with a single large open yard; LOD billboards for foliage; no volumetric lighting.
- Bots: tuned alertness meter (0-100) with noise events, plus squad flare; ensure indoor AI uses grenades and flanking to avoid reviewers' criticism.
- Attachments as an in-hand toggle menu with 3 slots (optic, muzzle, under); implement with a small stat modifier table.
- Mobile: tap buttons for mode swap; auto-armor on low energy.

## Sources
1. Crysis (series) - Wikipedia, https://en.wikipedia.org/wiki/Crysis, wiki
2. Crysis (video game) - Wikipedia, https://en.wikipedia.org/wiki/Crysis_(video_game), wiki
3. Crysis Warhead and reception notes - same as [1], wiki
4. Crysis 2 remastered review - The Xbox Hub, https://www.thexboxhub.com/crysis-2-remastered-review/, review
5. Review: Crysis PC, page 3 - HEXUS, https://www.hexus.net/gaming/reviews/pc/10414-crysis-pc/?page=3, review
6. Nanosuit search results (Wikipedia, StrategyWiki, Giant Bomb snippets): https://strategywiki.org/wiki/Crysis/Nanosuit (HTTP 403, snippet only), guide
7. Crysis Power Struggle - Crysis Wiki, https://crysis.fandom.com/wiki/Power_Struggle (snippet only), wiki
8. Crysis multiplayer review - Game Critics, https://gamecritics.com/mike-doolittle/crysis-multiplayer-review/, review
9. Crysis 2 reviews: Giant Bomb user review https://giantbomb.com/user-reviews/id/82769/crysis-2-review ; GamesRadar https://www.gamesradar.com/crysis-2-review ; PC Gamer https://pcgamer.com/crysis-2-review-2, review
10. Crysis and Crysis Warhead review - Gaming Pastime, https://gamingpastime.com/crysis-pc-review, review
11. Crysis 2 forum review - Xisto, https://xisto.com/discuss/topic/98057-crysis-2-review/, forum
12. Crysis Wars - Crysis Wiki mirror, https://breezewiki.discard.no/crysis/wiki/Crysis_Wars, wiki
13. Crysis' highs and lows - GamesRadar, https://www.gamesradar.com/crysis-highs-and-lows/3, review
14. Silenced sniper alert discussion - HardForum, https://hardforum.com/posts/1032223996/, forum
15. Crysis Crytek talk (2006 interview) - HEXUS, https://hexus.net/gaming/features/pc/7449-crysis-crytek-talk/?page=2, talk
16. CryEngine 5 AI documentation, https://cryengine.com/docs/static/engines/cryengine-5/categories/23756813/pages/23306452, official
