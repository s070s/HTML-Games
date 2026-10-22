# Counter-Strike (1.6, Source, CS:GO, CS2) - design notes for an original offline FPS clone

Conventions: [n] = source number in Sources. "unverified" = not confirmed by a fetched source (author recall or single weak source). Tool access note: Liquipedia, Fandom and the Valve Developer wiki returned 403/402 to the fetcher, so some of them are cited only through search-result snippets (marked "snippet").

## Identity
- Tactical team shooter, 5v5, one side plants a bomb, the other stops it or eliminates the opponent. Lineage: 1.6 (GoldSrc, 2000-2003 era), Condition Zero (2004, first official bots in multiplayer) [13][15], Source (2004), CS:GO (2012), CS2 (2023, Source 2) [12].
- CS2 headline changes: "sub-tick" input timestamping, volumetric smokes that react to bullets and HE, new movement feel [12][9].
- Core fantasy: low time-to-kill, learnable recoil, economy that forces risk decisions each round.

## Core loop
- Round structure (CS2 competitive/Premier): MR12, two halves of up to 12 rounds, first to 13 wins, sides swap after round 12 [7]. Standard matchmaking can end 12-12 as draw; Premier and pro play go to overtime in MR3 sets (3 rounds per side, first to 4 in a set wins, 3-3 plays another set) with fixed overtime money (10,000 per player per source [1]) [7][1].
- Older CS:GO/1.6 format was MR15 (first to 16) - unverified for 1.6; [9] snippet mentions 16-round format.
- Round timer: about 1:55 live plus ~15 s freeze/buy time and 40 s bomb (CS:GO had 45 s) [S: bomb 40 s in CS2, via snippets of csdb defuse guides]. Round time/freeze values are unverified (author recall); sources fetched did not state them.
- Bomb: defuse 10 s, 5 s with kit ($400); kits not free by default [snippet, csdb defuse guide].
- Win conditions: T: eliminate CTs or detonate bomb; CT: eliminate Ts, defuse, or let the timer expire without a plant. CT win by timer is why Ts must commit.
- Economy (CS2) [1][10]:
  | Item | Value |
  |---|---|
  | Start of each half | $800 |
  | Max money | $16,000 |
  | Win by elimination/timer | $3,250 |
  | Win by bomb explode or defuse | $3,500 |
  | Loss bonus ladder | $1,400, $1,900, $2,400, $2,900, $3,400 (cap) |
  | After a win | loss counter steps down one (does not reset) [1]; sources conflict, a snippet claims full reset |
  | Round 13 pistol-round loss | counter starts one step up ($1,900) [1] |
  | Plant on lost round | +$800 each T; planter +$300 [1][10] |
  | Kill rewards | rifle/pistol/LMG/grenade $300; SMG $600 (P90 $300); shotgun $900 (XM1014 $600 per [10], $900 group per [1]); AWP/Zeus $100; knife $1,500; CZ75 $100 [1][10] |
  | Full buy target | ~$5,000 T, ~$6,000 CT [10] |
- Design insight: different kill reward per weapon class balances cheap, short-range guns against rifles; loss bonus keeps losers in the game; the cap stops hoarding.

## Movement
- Max speed 250 u/s (knife, bomb), grenades 245 [2]. Selected per-weapon run speeds (u/s) in CS2 [2]:
  | Weapon | Speed |
  |---|---|
  | Pistols (Glock/USP/P250/Tec-9/CZ/Five-SeveN) | 240 |
  | Desert Eagle 230, R8 180 | |
  | SMGs: MP9/MAC-10/Bizon 240, MP5-SD 235, P90/UMP 230, MP7 220 | |
  | M4A4/M4A1-S 225, AUG/FAMAS 220, AK-47/Galil 215, SG 553 210 | |
  | Shotguns: Mag-7 225, Nova 220, XM1014 215, Sawed-Off 210 | |
  | M249 195, Negev 150 | |
  | AWP 200 (scoped 100), SSG 08 230, SCAR-20/G3SG1 215 (scoped 120) | |
  | AUG/SG scoped | 150 |
- Walk (shift) is roughly half run speed, silent footsteps, small accuracy penalty [3]. Crouch is slower than walking, lowers hitbox, small accuracy bonus [3]. Crouch spam has a stamina-like slowdown [3].
- Jump height about 54 units; crouch-jump reaches ~65 unit ledges [3]. Midair accuracy near zero; landing causes brief penalty [3].
- Counter-strafing: tap the opposite key to stop instantly and fire accurately; "accurate once under about 34% of max speed" is a single community claim (unverified) [snippet, refrag/cs.money]. CS2 sub-tick makes the window slightly wider [3].
- Bunny hopping/air strafe: competitive speed cap near 300 u/s in the guide [3]; 1.6 and CS:GO differ (1.6 allowed high-speed bhop chains; CS:GO capped via sv_enablebunnyhopping 0 and speed penalties) - unverified recall.
- Ladders: climb speed ~200 u/s - unverified recall; guide did not cover [3]. Fall damage exists (unverified recall).

## Weapons and equipment
- Damage/armor penetration/falloff (CS2 per [5]; base damage per bullet before multipliers):
  | Weapon | Dmg | Armor pen | Falloff note | Price (unverified recall unless stated) | RPM (unverified recall) |
  |---|---|---|---|---|---|
  | Glock-18 | 30 | 47% | 15% | $200 | 400 |
  | USP-S / P2000 | 35 | 50.5% | 9% | $200 | 352 |
  | P250 | 38 | 64% | 10% | $300 | 400 |
  | Five-SeveN / Tec-9 / CZ75 | 32/33/31 | 91/90.6/77.7% | 19/21/15% | $500 | 400/500/600 |
  | Desert Eagle | 53 | 93.2% | 15% | $700 | 267 |
  | R8 Revolver | 86 | 93.2% | 6% | $600 [snippet] | slow |
  | MAC-10 / MP9 | 29/26 | 57.5/60% | 20/13% | $1,050/$1,250 | 800/857 |
  | MP7 / UMP-45 / P90 / Bizon | 29/35/26/27 | 62.5/65/69/63% | 15/25/14/20% | $1,500/$1,200/$2,350/$1,400 | ~750/600/857/750 |
  | Nova / XM1014 / Mag-7 / Sawed-Off | 26/20/30/32 | 50/80/75/75% | 30/30/55/55% | $1,050/$2,000/$1,300/$1,100 | slow |
  | Galil / FAMAS | 30 | 77.5/70% | 2/4% | $1,800/$2,050 | ~666/600 |
  | AK-47 | 36 | 77.5% | 2% | $2,700 | 600 [snippet: keengamer] |
  | M4A4 / M4A1-S | 33/38 | 70% | 3/6% | $3,100/$2,900 | ~666/600 |
  | SG 553 / AUG | 30/28 | 100/90% | 2% | $3,000/$3,300 [SG $3,000 per snippet] | ~545/600 |
  | M249 / Negev | 32/35 | 80/71% | 3% | $5,200/$1,700 | 750/1000+ |
  | SSG 08 | 88 | 85% | 2% | $1,700 | bolt |
  | AWP | 115 | 97.5% | 1% | $4,750 [snippet, critfeed] | ~41 |
  | G3SG1 / SCAR-20 | 80 | 82.5% | 2% | $5,000/$5,000 | semi-auto |
  Prices not marked [source] are recalled values (unverified); damage/pen/falloff columns are from [5]. Prices change across patches (e.g., Incendiary $600 to $500 in May 2024 [6]).
- Multipliers [5]: head 4x (Deagle 3.9x, M4A1-S ~3.48x); stomach/pelvis 1.25x; legs ~0.75x; chest 1x (arms/chest unstated in source). Helmet/kevlar do not protect legs. Armor absorbs damage by (1 - armor-pen) share; HE reduced ~40% by armor [5]. Armor prices $650 kevlar, $1,000 with helmet (recall, unverified).
- Wallbangs: brick blocks, wood/plastic/thin metal reduce damage [5]. Penetration power varies by weapon (AWP/AK high) - recall.
- Recoil: each rifle has a fixed spray pattern (up then sway left/right); first shot is accurate if stationary, accuracy recovers after stopping. Spray patterns are learnable ("spray control") - widely reported design strength. Sub-tick CS2 "spray feels off" criticism [9].
- Utility [6]:
  | Item | Price | Notes |
  |---|---|---|
  | Smoke | $300 | ~20 s (CS:GO 18 s per snippet); bullets/HE punch holes in CS2 |
  | Flashbang | $200 | carry 2; blind up to ~5 s |
  | HE | $300 | ~98 unarmored / ~57 armored point blank; radius ~350 u; 2 stacked ~114 armored |
  | Molotov (T) | $400 | ~7 s fire, ~40 HP/s at full ramp [5] |
  | Incendiary (CT) | $500 | ~5.5 s fire; smoke extinguishes fire |
  | Decoy | $50 | fake gunfire of your main weapon ~15 s, tiny explosion |
  Carry limits: 4 grenades total, 1 smoke/HE/fire/decoy, 2 flashes [6].
- Other: Zeus (taser, $200 recall), defuse kit $400, bomb carried by one T.

## Abilities and items
- No character abilities. Utility replaces abilities. Items: armor, helmet, defuse kit, Zeus, grenades. CS2 smokes are now dynamic volumes [12].

## Health and damage
- 100 HP, armor 100 points (recall). Armor ratio per weapon (armor pen above): damage to health reduced; armor points drained by half the absorbed damage (recall, unverified).
- Typical kills: AK headshot with helmet = 1-shot (4x36 x 0.775-ish) at any range; body 3-4 shots. AWP one-shot above ~115 dmg except legs.
- Fall damage, friendly fire (off in casual/wingman), team damage settings exist.

## Modes and match options
- Premier: 5v5 ranked, map veto, MR12, rating [9 snippet]. Competitive: 5v5 MR12, can draw 12-12 [7]. Wingman: 2v2, one site, short rounds (MR8 / first to 9 per snippets, conflicting) [9]. Casual: auto armor and defuse kits, no friendly fire/collision, 50% kill rewards [9]. Deathmatch: 10 min, instant respawn, free weapons [9]. Others over versions: Arms Race/Gun Game (progress through weapons), Demolition, Flying Scoutsman, Retakes (community/official), Danger Zone (BR, CS:GO) - recalled, unverified.
- Bot/server options: bot_quota, bot_difficulty 0-3, quota modes normal/fill/match, bot_knives_only/pistols_only/snipers_only, bot_chatter off/radio/minimal/normal, bot_eco_limit default 2000, bot_walk, sv_auto_adjust_bot_difficulty default on [4].

## Map design
- Two or three lane structure (long, mid, short/B) with tight chokepoints, two bomb sites on bombsite maps (A/B), rotation time as core constraint, spawn-to-site timing balanced so T needs ~25-30 s (recall). Famous examples as structure only: Dust2 (3 lanes, 2 sites, long/mid/tunnels), Mirage (open mid, windows), Inferno (narrow banana/apartments), Nuke (vertical two-tier sites), Italy/Office (hostage, tight) [14 snippet; recall].
- Principles: readable sightlines, shoulder-height cover, multiple angles per site, callouts for every area, pre-determined default positions, one-way flicks and boost spots as emergent depth.
- Hostage maps (cs_) exist in 1.6 through CS2 (recall); optional for a clone.

## Bots and AI
- Official bots arrived in Condition Zero as a multiplayer feature (shared with 1.6 later) and one reviewer called bot AI the highlight [13][15].
- Difficulty 0 easy, 1 normal, 2 hard, 3 expert; applies to newly joined bots only [4]. Bots use navigation meshes (.nav files per map, auto-named from the BSP) [snippet: Valve dev wiki, Z-Bot guide]. CS2 server cannot auto-generate nav meshes; meshes ship with maps [4 snippet].
- Bot personalities/profiles (botprofile) set skill, aggression, teamwork, weapon preference - recalled; Steam comment mentions a teamwork value [snippet].
- Buy logic: eco limit (bot_eco_limit default 2000), weapon-restriction cvars [4]. Chatter modes include radio commands [4].
- What players disliked: bots stuck on ladders/walls, poor Workshop-map nav, "dumber than CS:GO / CZ" [8]; predictable routes [8 snippet]; tag-on-spawn behavior and bots jumping in place fixed in 2014 changelog [snippet]. Valve says nav quality depends on mapper editing [8].
- What players liked: Condition Zero Tour of Duty with objectives and escalating bot skill [15 snippet].

## Progression
- CS2: Premier rating, Competitive wins ranks; XP/levels, weapon cases and skins (cosmetic only), trade economy. For offline game: skip cosmetics; keep optional "career" unlocks (CZ Tour of Duty) as inspiration [15].

## HUD and options
- Radar (minimap with callouts, teammate positions), health/armor bottom-left, money top/left, ammo bottom-right, kill feed top-right, round timer/bomb icon top-center, scoreboard on tab, buy menu with category keys. Crosshair customization: style, size, gap, thickness, outline, dot, dynamic vs static [recall]. Net_graph/FPS counter; viewmodel offset; sensitivity in cm/360 convention.

## Best features to keep
- Fixed, learnable spray patterns and low TTK (skill ceiling, fairness) [3][5].
- Economy with loss bonus: comeback pacing, strategic eco rounds [1][10].
- Utility depth with simple rules; CS2 smokes reacting to bullets praised [9 snippet].
- Counter-strafe and run-speed-by-weapon system: weapon weight matters [2][3].
- Per-weapon kill rewards balance cheap guns.
- Bots as practice (offline), with bot_quota-style options [4].

## Mistakes to avoid
- Weak bot navigation (ladders, custom maps) [8]; ship hand-authored nav data with the map.
- Sub-tick/hit reg inconsistency, peeker's advantage at launch (online only) [9]; offline game avoids but keep hit scanning deterministic.
- Loss-bonus rules unclear across guides (reset vs step down) [1][snippet]: choose one and document it in-game.
- Overcomplicated economy shown without HUD aid.
- Draw rule 12-12 in competitive criticized as unsatisfying (recall).

## Adaptation notes
- Keep exact: round times, bomb 40 s/defuse 10 s or 5 s kit, economy ladder, loss bonus, weapon speeds in relative terms, 4x headshot, armor pen concept, spray pattern table per weapon (store as arrays), counter-strafe accuracy rule.
- Simplify: ~12-16 weapons; melee/Zeus optional; replace volumetric smoke with N particle blobs and a cheap 3D grid of occupancy (e.g., 16x16x8 voxel fill) with bullet-carve optional; 5 grenade types are enough; 2 maps; MR6-MR8 default for short sessions.
- Bots: nav graph of waypoints (not full mesh), A* on ~200 nodes, three skill levels as aim error (deg), reaction time (ms), spray-control skill; buy with simple budget rules; radio-style 5 chatter lines; fall back on "stuck for 2 s -> re-path / jump / re-route".
- Performance: hitscan with spatial grid; AABB colliders; instanced procedural geometry; limit decals; audio synth via WebAudio with a small voice pool; touch controls need aim assist and auto-fire toggle; gamepad aim acceleration.

## Sources
1. csdb.gg - Counter-Strike 2 Economy Guide - https://csdb.gg/economy-guide - guide
2. profilerr.net - How to show velocity in CS2 (weapon speed table) - https://profilerr.net/how-to-show-velocity-in-cs2/ - guide
3. csdb.gg - Movement Mechanics Guide - https://csdb.gg/guides/movement-guide/ - guide
4. GameServerKings - CS2 bot commands - https://www.gameserverkings.com/knowledge-base/counter-strike-2/bot-commands.md - guide
5. profilerr.net - Weapon damage in CS2 - https://profilerr.net/weapon-damage-in-cs2/ - guide
6. csdb.gg - Grenades & Utility Guide - https://csdb.gg/guides/grenade-guide/ - guide
7. csdb.gg - How Many Rounds in CS2 (MR12) - https://csdb.gg/guides/how-many-rounds-cs2/ - guide
8. Steam Community CS2 discussion on bot AI - https://steamcommunity.com/app/730/discussions/0/4351113999764287112 - forum
9. ExitLag - CS2 Game Modes Explained - https://www.exitlag.com/blog/cs2-game-modes/ - guide (plus snippets from WePC, Liquipedia CS2 page)
10. ProSettings.net - Ultimate CS2 Economy Guide - https://prosettings.net/blog/cs2-economy-guide/ - guide
11. KeenGamer - CS2 economy / best guns - https://keengamer.com/articles/guides/a-guide-to-how-the-cs2-economy-works-in-counter-strike-2/ - guide (search snippet)
12. Valve Developer Community - CS2 - https://developer.valvesoftware.com/wiki/Cs2 - wiki (snippet)
13. Valve Developer Community - Condition Zero - https://developer.valvesoftware.com/wiki/Counter-Strike:_Condition_Zero - wiki (snippet)
14. WeCoach - All CS2 maps - https://wecoach.gg/blog/article/all-19-cs2-maps-and-what-makes-each-one-noteworthy - guide (snippet)
15. GameSpot - Counter-Strike: Condition Zero review - https://gamespot.com/reviews/counter-strike-condition-zero/1900-6092063/ - review (snippet)
