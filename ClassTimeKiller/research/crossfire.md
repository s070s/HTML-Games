# CrossFire (Smilegate, PC, 2007) - design notes for an original offline FPS clone

Conventions: [n] = source number. "unverified" = not backed by a fetched source (recall or single weak/fan source). "snippet" = search excerpt only. Research limits: Fandom, Giant Bomb, IMFDB and Liquipedia pages returned 402/403 to the fetcher, so per-weapon damage, RPM and prices were NOT obtainable; only class-level descriptions and a few excerpts. Mode rules come mostly from fan-wiki excerpts and vary by region/version.

## Identity
- Free-to-play Korean tactical/arcade FPS by Smilegate, launched 2007 in Korea, China 2008, North America 2009, Europe 2011; about 660 million players by 2018 and 1 billion registered with 6M concurrent (Feb 2020) per developer; revenue roughly $1.1B (2016), $1.4B (2017), $1.3B (2018), $1.4B (2019) per SuperData, mostly China [1][5].
- Two mercenary factions, Black List (terrorist-like) and Global Risk (counter-terror) [1][2]. Plays much like Counter-Strike with older graphics that run on weak PCs [5]. Wikipedia calls it a tactical shooter [1].
- CrossFire 2.0 (2015) added graphics refresh, ranked matches and an AI Bot Mode [13].
- Console spin-off CrossfireX (2022, Xbox) had modes Classic (bomb), Spectre (knife-only invisible attackers), Modern (two-point control); Metacritic 38, shut down May 2023 [6]. Cautionary tale: gunplay and controls called poor [6].

## Core loop
- Most modes: up to 16 players (8 per team); Mutation and Wave modes exceed this; Zombie co-op is 4 players [1][4][8].
- Search & Destroy (S&D): Black List plants C4 at a designated point or eliminates Global Risk; Global Risk wins by eliminating attackers before plant or defusing [11 snippet][15 snippet]. Round time and per-round economy: not found (gap).
- Elimination: like team deathmatch but in rounds with no respawn; on some maps players start with melee only and pick up guns placed in the map [15 snippet].
- Team Death Match (TDM): host picks a kill target (40, 60, 80, 100 or 150) or time limit (5, 8, 10 or 12 min); highest kills wins; respawn delay 0-10 s; some maps restrict weapons (a prison map allows only snipers and knives) [15 snippet].
- Earned XP gives ranks from Trainee First Class to Marshall [1][4].
- Between matches: spend GP (earned free) and real-money points on gear; in-match typically no per-round buying (inferred, unverified).
- Currency: Game Points (GP) free by playing and missions; GP mostly goes to weapon repair per one fan wiki; premium points via real money for modified weapons [1][4][9].

## Movement
- Not documented in fetched sources (gap). Recalled/unverified: CS-like walk/crouch/jump, fast arcade feel, no wall-run; mutants move faster. Characters mostly cosmetic, a few limited-edition ones have perks (better smoke vision; Viper has throwing knives and extra speed in Mutant and Zombie modes) [1][13].

## Weapons and equipment
- Real-world-based guns grouped by category: pistols, rifles, SMGs, shotguns, snipers, machine guns, melee, grenades; categories act like real counterparts (SMG fast and weak, shotgun strong only close) [1][9].
- Class notes (excerpts, fan-edited, version dependent):

  | Class | Role / notes | Src |
  |---|---|---|
  | Assault rifles | Balanced; AK47 high damage and accuracy, medium fire rate, high recoil, very loud, 30-round magazine with 60 or 90 reserve; its per-bullet damage beats the M4A1 | [9][11] |
  | Shotguns | Possible one-hit kill at close range, slow reload, long-range falloff; XM1014 semi-auto and fast; slug ammo shotguns added in 2.0 | [9][13] |
  | Snipers | Knight SR-25 often 2-hit kill; DSR-1 one-hit kill to chest, slow draw, small magazine; MSG90 usually 2 shots; VSK-94, SL8 as later additions | [9][12] |
  | SMGs | Faster fire, lower hit; hollow-point variants impair enemy vision and slow movement (2.0) | [1][13] |
  | Machine guns | M249 MINIMI, Colt M16A3 listed as LMG in one release note | [12] |
  | Pistols | Small caliber low damage; magnum high damage; least ammo | [9] |
  | Melee | Knife; paid axe with longer reach than default (one player report) | [10] |

- Premium/VIP weapons: reskins with better stats (e.g., faster reload) [1]; rental or permanent ownership; gold-bought guns considered weaker than premium/gamble ones by users [3]. IMFDB notes VVIP variants have drastically different looks and superior stats [11].
- Per-weapon damage, RPM, prices: unverified/not found.
- Mode-only items: Bio Grenades (hundreds of damage to mutants), Hero weapon (FAL with grenade launcher), Hypomeds and Revival Tokens in co-op Zombie [8][9].

## Abilities and items
- No character abilities. Modifiers come from mode: ghost cloaking, mutant evolution, hero marker, bio grenades [9][6].
- Characters: cosmetic with minor limited-edition buffs [1].

## Health and damage
- Not documented numerically. Mutation mode HP numbers are version dependent: host mutants start very high (2000 in one wiki, 4000-6000 in another) [snippets, conflicting].
- Hero in Hero Mode becomes infected after more than two mutant attacks [14].
- JHP SMG ammo slows and blurs targets [13].
- Zombie mode: bosses Goliath and Nightmare; Challenge difficulty Easy/Medium/Hard/Expert/Nightmare, Easy 20 rounds, Medium 30 on most maps [8].

## Modes and match options
- Catalog (Dexerto / Giant Bomb lists): Team Death Match, Search & Destroy, Elimination, Ghost Mode, FFA, Mutation, Escape, Hero, Hero X, Zombie, Elite, Wave, Shadow, Biochemical Knight, Ghosts vs Mutants, RPG/Melee, Soccer, Light, Super Soldiers TD [4][7].
- Ghost Mode: conflicting descriptions. One: S&D variant where the terrorist side is cloaked and knife-only, win by detonation or elimination [15]. Another: both teams cloaked, visibility breaks on shooting, reloading or moving; standing still re-cloaks; footsteps audible [4 snippet].
- Mutation (zombie-like PvP): roughly 20 s for humans to spread, then 1-2 (sources say up to 3) players mutate depending on lobby size; one hit infects; mutants gain HP and evolve by infecting or absorbing dead mutants; soldiers win on timeout or all mutants dead; mutants win if all soldiers infected or dead [9][12 snippet].
- Hero Mode: one random player is the hero, marked on screen, carrying a rifle with grenade launcher against a mutant squad; longest-surviving hero earns most XP [14][9].
- Hero Mode X / Master Hero Mode X: Mutation variant with different supply-box contents; up to 30 players with up to 2 berserk mutants (snippet) [9].
- Zombie (PvE co-op): up to 4 players, waves, final bosses, Hypomed/Revival items, original maps Unearth and Biohazard (2011) [8]. Later Adventure Mode (cannot lose, seasonal) [9].
- Knife fight / melee-only rounds: no rules found (unverified); ghost and RPG/Melee modes exist in catalog [4].
- Elimination variants also appear with seasonal maps (Holiday Elimination) [12].
- Match options: host kill/time targets for TDM [15]; kick votes, FFA lacks kick [3]; ranked matches added in 2.0 [13].

## Map design
- Maps (nearly a dozen at launch per [3]): bomb maps with 2 sites, small arena maps for deathmatch, large PvE maps for zombie.
- Structure examples (fan excerpts) [16]:
  - Subway: wrecked station, second floor as hot zone, central vending machine and bricks to climb onto train cars; A site in a machine room, B site inside one train car with open doors.
  - Festival: Global Risk spawns near a small train by the A cargo; B cargo is near that spawn; flooded centre makes stealth hard; wall-bang crate alleys.
  - Black Widow: wide open layout inspired by Counter-Strike's Dust 2 with long alleys and sniper spots.
  - Sub Base and Compound: S&D maps; Compound has rooftop dishes and an antenna; competitive maps got retextured Oct 2016.
- 2.0 added new textures to Black Widow, Egypt and Ship [13].
- Design lesson from mode variety: one set of weapons/maps serves 10+ modes. Weapon-restricted map variants (snipers and knives only) reuse the same geometry [15].

## Bots and AI
- Zombie mode has bot zombies with difficulty levels (user comment) [3].
- CrossFire 2.0 press release: AI Bot Mode, a team of players against AI in "man vs. machine" format; no rules given [13]. No Hero Mode X bot option found (premise unverified). A third-party trainer (Refrag) offers bots that peek common angles with adjustable difficulty, not an official mode [snippet].
- PvE AI design to copy: simple melee chasers, ranged specials, boss with telegraphed attacks.

## Progression
- XP ranks to Marshall, GP unlocks standard items; users say standard weapons cost tens of thousands GP so matches earn slowly [3]. Fan wiki: new accounts now start with 200,000 GP instead of 40,000 because capsules and expensive GP guns are popular (may be outdated) [9].
- Capsules/gacha and weapon rentals; Vietnam version has the largest capsule system; anti-grind full XP only first 3 hours [snippet]. For offline: use unlock-by-play only.

## HUD and options
- Not covered by sources (gap). Recalled: CS-like HUD (radar, kill feed). Accessibility: low-spec friendly [5].

## Best features to keep
- Huge mode variety on one engine, esp. Mutation/Zombie, Ghost, Hero; praised by users [3][12].
- Simple controls, runs on low-end PCs [3][5].
- Permanent weapons praised over rentals [3].
- Co-op wave PvE with bosses.
- Marked-hero and round-based Elimination as cheap-to-build variants.

## Mistakes to avoid
- Pay-to-win: premium/VIP weapons with better stats, gambling-style capsules; reports of 50-100 euros spent on one gun [3][1][5].
- Critical essay: monthly rentals (a silenced M4A1-S rental about 10 RMB per month felt steadier than the free rifle), a longer-reach paid axe, paid weapons easing Zombie Mode, lotteries, holiday discounts, memberships and trial gear that is later taken away; author calls it more directly pay-to-win than Counter-Strike and proposes earnable stat weapons and visible odds [10].
- Industry brief (2015) says cash buys distinct weapon and armor advantages and about 90% of revenue came from China [snippet].
- Hackers/aimbots, unfair kick votes, toxic community, no kick in FFA, lag, anti-cheat false positives [3].
- Grindy GP prices; time-limited rentals; weapon repair taxing GP [3][9].
- CrossfireX: poor gunplay and controls (IGN 2/10 multiplayer) [6].

## Adaptation notes
- Keep: multi-mode design with shared core; Ghost (cloak when still), Mutation (host mutants), Hero (marked survivor), Elimination rounds, PvE waves with 2 bosses; ranks as unlock gate.
- Simplify: all weapons unlocked by rank, no currency; 4-6 weapons per class; zombie AI = chase+melee; mutation as bot-vs-player rounds.
- Use TDM options as a template: kill targets 40-150 and 5-12 min timers.
- Exact numbers unavailable - treat all stats as original design; tune for fun.

## Sources
1. Crossfire (2007 video game) - Wikipedia - https://en.wikipedia.org/wiki/Crossfire_(2007_video_game) - wiki
2. MMOBomb - CrossFire review - https://www.mmobomb.com/review/crossfire - review
3. MMOBomb user reviews on the same page (hackers, pay to win, permanent weapons) - https://www.mmobomb.com/review/crossfire - forum
4. Giant Bomb - Crossfire - https://giantbomb.com/wiki/Games/Crossfire - wiki (search excerpt; fetch 403)
5. MMOs.com - A Tale of Asian Shooters - https://mmos.com/editorials/a-tale-of-asian-shooters - review
6. CrossfireX - Wikipedia - https://en.wikipedia.org/wiki/CrossfireX - wiki
7. Dexerto game database - CrossFire - https://www.dexerto.com/gaming/db/game/crossfire/ - wiki
8. MMOBomb - Cross Fire Undead Update with co-op Zombie mode - https://www.mmobomb.com/news/cross-fire-undead-update-with-co-op-zombie-mode - official-news
9. CrossFire Wiki (Fandom) pages CrossFire, Rifle, Shotgun, Pistol, AK47, MSG90, Knight SR-25, Adventure Mode, Mutation - https://crossfirefps.fandom.com/wiki/CrossFire - wiki (search excerpts only; blocked)
10. Critical Play: Games of Chance and Addiction (Jinpu) - Mechanics of Magic - https://mechanicsofmagic.com/2026/05/22/critical-play-games-of-chance-addiction-jinpu/ - essay (fetched)
11. CrossFire (2007 VG) - IMFDB - https://imfdb.org/wiki/CrossFire_(2007_VG) - wiki (search excerpt; fetch 403)
12. CrossFire holiday/update announcement - Impulse Gamer - https://www.impulsegamer.com/wordpress/?p=17874 - official-news (fetched)
13. CrossFire 2.0 press release (AI Bot Mode, ranked, weapons) - Triple Point PR - https://pressreleases.triplepointpr.com/?p=17642 - official-news (fetched)
14. Time to blow up mutants in Crossfire Europe - Dread Central - https://www.dreadcentral.com/news/30423/time-to-blow-up-mutants-in-crossfire-europe/ - news (fetched)
15. Cross Fire - Gamicus (Fandom) - https://gamicus.fandom.com/wiki/Cross_Fire - wiki (search excerpt; fetch 402)
16. Subway, Festival, Black Widow, Sub Base, Compound map pages - Liquipedia CrossFire - https://liquipedia.net/crossfire/Sub_Base - wiki (search excerpts; fetch 403)
17. CrossFire - Refrag wiki (bot training, third-party) - https://wiki.refrag.gg/en/Crossfire - guide (search excerpt; fetch 404)
18. CrossfireX producer apology - Wccftech - https://wccftech.com/crossfirex-producer-apology-betrayed-trust-game-pass-not-working/amp/ - news (search excerpt, relates to spin-off only)

Gaps: no per-weapon damage/RPM/price numbers, no Knife Fight rules, no official AI Mode details or Hero Mode X bot option, no movement or HUD data, round timers and S&D economy not found.
