# Painkiller (2004) + Battle Out of Hell: design notes for an original FPS clone

Method note: the Fandom wiki, GameFAQs, Giant Bomb and other sites stayed blocked (402/403). The official Gold Edition manual (Steam copy, text extracted) and a fan quick-reference table of all Black Tarot cards were read in full and are now the main sources for numbers. Anything not confirmed by a page I read is marked "unverified". Source numbers refer to the list at the end.

## Identity
- People Can Fly, 2004, PC. Five chapters of about five levels each, with boss levels; 24 levels in the base game (Special Edition has 12); Gold Edition manual counts 34 levels, which fits 24 plus the 10 of Battle Out of Hell [1][3][13]. Hero is Daniel Garner; goal is to kill five of Lucifer's generals [13]. Battle Out of Hell: 10-level extra chapter, two more weapons, new multiplayer modes, bosses, map editor [1][9][19]. Tone: Quake-like fast shooter with horror/metal setting. Scores: 82% GameRankings, 81 Metacritic [1].

## Core loop
- Level = chain of combat sections: go to a section, kill everything that moves, move on [3]. Mass battles lock exits, play heavy metal, and end at a checkpoint that auto-saves [1][13]. Enemies swarm almost immediately; ammo is plentiful [2]. A directional arrow points to the last enemy of a section and then to the checkpoint; it also shows whether an enemy is above or below you [13]. Secrets (ammo, health, armor) reward exploration [2].
- Destructible scenery: barrels explode, crates and urns hold armor, ammo, weapons and gold; items inside never break [13].
- Souls: each kill leaves a soul for several seconds after the body vanishes; walking through it gives 1 health [13]. Every 66 souls you morph into a demon [13][15]. One reviewer says about 67 [16]; the manual wins. Another count, 50, is the Dark Soul card value [14]. Details of the morph are in "Abilities and items".
- Black Tarot: complete a special level task to unlock a card; gold coins pay to place cards (see below) [1][3][13].
- Checkpoints also heal: full heal on Daydream, a small heal on Insomnia, none stated for harder levels [13].

## Movement
- Fast, strafe-based. The manual confirms host options "Allow Bunnyhopping" (also called strafe-jumping), "Allow Forward Rocket Jump", and keys for rocket jump, so both techniques are intended features in multiplayer; the server command names are allowbunnyhopping and allowforwardrj [13]. Exact speeds, jump heights, air-control values: unverified.
- Jump-based fast play fits the Quake lineage noted by reviewers [1][16].

## Weapons and equipment
Seven weapons in the Gold Edition, each with two fire modes (five in the base game, two added by Battle Out of Hell). Capacities are magazine/reserve limits from the manual [13]. Per-shot damage is not documented in the manual; marked unverified unless a source gives it.

| Weapon | Primary | Alternate | Ammo capacity [13] |
|---|---|---|---|
| Painkiller (start) | "Pain": rotating blades, short range, no ammo | "Killer": fires a bladed warhead through enemies; if it hits a wall it lodges and a light beam links it to you, cutting anything that crosses; press alt again to recall; in multiplayer it can knock a weapon out of an opponent's hand | none (only weapon without ammo) |
| Shotgun / Freezer | auto-loading double barrel, more damage the closer you are | super-cooled blast freezes; frozen enemies shatter from even minimal damage | 100 shotgun, 100 freezer |
| Stakegun / Grenade Launcher | wooden stakes pierce enemies, can pin an enemy to a wall or to another enemy; at long range stakes ignite before impact for more damage; slow rate of fire | 60 mm grenades in an arc, bounce several times, explode on direct hit | 100 stake, 100 grenade |
| Rocket Launcher / Chaingun | rocket with big blast radius, strong direct hit, hurts you at close range | hold-to-fire chaingun, burns ammo fast | 100 rocket, 500 chaingun |
| Electrodriver | "Driver": stream of shurikens | "Electro": continuous lightning that sticks to the target, drains charge fast | 250 driver, 250 electro |
| SMG / Flamethrower (Battle Out of Hell) | PK30 .45 submachine gun, explosive-tipped rounds, one or two bursts for most demons | under-barrel flamethrower, stuns then burns | capacity unverified |
| Boltgun / Heater (Battle Out of Hell) | 5 rods per trigger pull, scoped mode on middle mouse by default | 10 bounce-charges per shot with delayed explosion | capacity unverified |
- Combos: hold Painkiller primary and tap alt to release spinning blades that mow through groups [16]; a search snippet from the fan wiki says this kills anything it touches and puts the plain warhead hit at about 50 damage with the lodged beam at about 15 per tick (fan-wiki figures, unverified) [20]. Rocket knock-back followed by chaingun bursts and freeze then shatter are the manual's own tips [13]. Stake long-range plus grenade for close crowd control is another manual tip [13]. A SMG/Flamethrower plus rifle fuel-tank combo seen online belongs to a Doom-engine fan mod, not this game.
- Armor comes in three levels; damage hits armor first, then health [13].

## Abilities and items
Black Tarot rules [13]:
- Two kinds: gold (activated with the Use Golden Cards key, lasts about 30 seconds, once per level unless a silver card allows more) and silver (active the whole level from the start).
- The Black Tarot board between levels has 3 gold slots and 2 silver slots; only placed cards count.
- Placing costs gold coins; removing a card refunds half. Coins come from crates, urns, coffins and barrels.
- Availability by difficulty: no cards on Daydream, a limited set on Insomnia and Nightmare, all cards only on Trauma.
- Unlock tasks are shown when you finish a level; all conditions below come from the fan quick-reference table, cross-checked with forum posts where noted [14][6][21].

Full card list (G = gold, S = silver; cost is gold coins to place):

| Level | Card | Type | Cost | Effect | Unlock condition |
|---|---|---|---|---|---|
| 1-1 Cemetery | Endurance | G | 100 | halves damage from falls and hits | finish the level |
| 1-2 Atrium Complex | Haste | G | 100 | world at 1/2 speed | destroy all objects |
| 1-3 Catacombs | Soul Keeper | S | 500 | souls last longer | kill all enemies |
| 1-4 Cathedral | Time Bonus | G | 100 | gold effects last +10 s | collect 500 gold |
| 1-5 Enclave | Blessing | S | 200 | start with 150 health | kill the Necrogiant in under 2:00 |
| 2-1 Prison | Replenish | S | 500 | ammo boxes hold double | use no explosive weapons |
| 2-2 Opera House | Speed | G | 100 | faster movement | collect at least 100 souls |
| 2-3 Asylum | Fury | G | 200 | double damage | use only the Painkiller |
| 2-4 Snowy Bridge | Dark Soul | S | 400 | demon morph every 50 souls | find all secrets |
| 2-5 Town | Double Haste | G | 300 | world at 1/4 speed | use only stakes |
| 2-6 Swamp | Dexterity | G | 300 | double rate of fire | kill Swamp Thing in under 4:00 |
| 3-1 Train Station | Soul Catcher | S | 500 | nearby souls fly to you | collect no souls |
| 3-2 Abandoned Factory | Forgiveness | S | 1000 | gold cards usable twice per level | kill 30 enemies during demon morph (forum: one session vs total is disputed [21]) |
| 3-3 Military Base | Greed | S | 2000 | double gold collected | kill all enemies (forum: five optional spawns, e.g. cargo plane, barracks, side lot [21]) |
| 3-4 Ruins | Iron Will | G | 666 | immune to attacks and falls | kill the Guardian in under 1:20 |
| 4-1 Castle | Rage | G | 500 | 4x damage | collect all holy items |
| 4-2 Palace | Vitality | S | 100 | base health 150 | collect no armor |
| 4-3 Babel | Double Time Bonus | G | 300 | gold effects +20 s | pick up all ammo |
| 4-4 Forest | Divine Intervention | S | 0 | cards can be placed free | use no tarot cards (forum: needs Trauma, 24th card [6][21]) |
| 4-5 Tower | Triple Haste | G | 500 | world at 1/8 speed | kill Alastor in under 5:00 |
| 5-1 City on the Water | Last Breath | S | 500 | revived with 33 health on death | find all secrets |
| 5-2 Docks | Confusion | G | 200 | enemies attack each other | morph into a demon 3 times |
| 5-3 Old Monastery | Soul Redeemer | S | 1000 | souls heal double | keep health above 50 |
| 5-4 Hell | Mercy | S | 2000 | gold cards usable three times | defeat Lucifer |
| BOOH-1 Orphanage | Weapon Modifier | G | 100 | enables the weapon-modifier power-up | take no damage |
| BOOH-2 Loony Park | Magic Gun | G | 300 | weapons use no ammo | kill no more than 88 enemies |
| BOOH-3 Lab | The Sceptre | G | 300 | enemies have 1 health | use only the Boltgun |
| BOOH-4 Pentagon | Health Regeneration | S | 1000 | health regrows to 75 at 3 per second | kill Panzer Spider in under 4:00 |
| BOOH-5 Dead City | Demon Morph | G | 666 | triggers demon mode on demand | finish in under 20 minutes |
| BOOH-6 Leningrad | Fear | S | 1000 | enemies start at 90% health | finish with over 200 health |
| BOOH-7 Colosseum | Rebirth | G | 400 | restores health and armor to base | morph into a demon exactly 5 times |
| BOOH-8 Underworld | 666 Ammo | S | 2000 | start each level with 666 ammo per weapon | kill all enemies |
| BOOH-9 Stone Pit | Armor Regeneration | S | 1000 | armor regrows to 75 at 3 per second | find all secrets |
| BOOH-10 Shadowland | Health Stealer | S | 2000 | 5% of damage dealt added to health | defeat Alastor in under 4:00 |
- The ludo.guide list agrees on costs and effects for the cards it names (Double Time Bonus 300, Triple Haste 500 and so on) [5]. A conflicting forum remark says Dexterity unlocks by replaying Swamp Thing with Fury equipped [6]; the table says a 4:00 kill. Treat the table as the main record and condition details as moderate confidence.
- Card-count rules: Insomnia alone gives 22 of the 24 stock cards; the 23rd is Prison on Nightmare, the 24th is Forest on Trauma with a blank loadout [6][7]. Cards persist across difficulty changes [6][7]; levels may re-lock after beating Lucifer [21].
- Souls and the demon morph: 66 souls triggers it; the view goes black and white, enemy bodies burn, normal attacks cannot hurt you, and everything you touch dies [13][15]. It lasts only a few seconds (exact seconds: unverified) [13][15]. Freak souls cost health instead of giving it [13]. Dark Soul lowers the threshold to 50 [14]. Demon Morph (gold) forces the state [14]. Many reviewers say the morph is wasted because few enemies remain [3][15].
- Multiplayer has no tarot cards; instead three power-ups: Immunity (like Iron Will), Rage (4x damage), Weapon Modifier (temporary weapon enhancement) [13].
- Armor and gold coins are pickups; mega-packs refill all ammo [13]; secret caches exist [2].

## Health and damage
- Start health 100, raised by cards to 150 (Blessing, Vitality) [13][14]. Souls give +1 each; armor has three tiers [13]. Death means restart the level or load a save [13].
- Difficulty (four levels) [13]:
  - Daydream: always available, no tarot cards, checkpoints fully heal.
  - Insomnia: always available, limited cards, checkpoints give a small heal.
  - Nightmare: unlocks after collecting all 23 cards on Insomnia (manual wording).
  - Trauma: unlocks after beating the game on Nightmare; has no souls at all, all cards available, and some maps differ (forum: Forest and chapter five locked or reachable only in odd ways) [6][7][13][18]. Black Edition later unlocks Trauma from the start (forum) [7]. Beating Trauma gives a different ending; the first three levels share one [1][7][18][21].
  - Enemy health, damage and spawn scaling per difficulty: unverified.
- Forum view: Nightmare is the recommended first run; Battle Out of Hell Insomnia is about as hard as base Nightmare [21]. Hardest levels named by players: Leningrad, Docks, Babel, Forest, Hell and Damnation [18].

## Modes and match options
- LAN or Internet, 2-16 players, seven modes in the Gold Edition [13]:
  - Free-for-All: classic deathmatch with frag and time limit.
  - Team Deathmatch.
  - People Can Fly: only Rocket Launcher/Chaingun allowed, and you can damage opponents only while they are airborne; two special maps used only for this mode.
  - Voosh: everyone has the same infinite-ammo weapon, no pickups, and at preset intervals everyone swaps to another weapon (random or host-set order).
  - The Light Bearer: one never-expiring Quad Damage; whoever holds it when the limit hits wins; it drops on death.
  - Capture the Flag (Battle Out of Hell): team banners, first to the capture limit.
  - Last Man Standing: individual, life limit set by host (default 3), eliminated players spectate.
- Server commands include powerups, weaponsstay, teamdamage, allowbunnyhopping, allowbrightskins, and gamemode ffa/tdm/pcf/tlb/voosh [13].
- Patch 1.61 (CPL era) added Capture the Flag and Last Man Standing, CPL-ready network features and new CPL dueling maps from Ritual Entertainment [17] (snippet only). The multiplayer demo shipped Free For All and The Light Bearer on two maps [17]. A GamesFirst review lists Free for All, Team Deathwatch, People Can Fly, Voosh and Light Bearer [15].
- Bots in multiplayer: unverified.

## Map design
- Level archetype: linear sequence of arenas with locked exits, checkpoints, secret nooks, and varied themed art [1][2][3]. Quick save anywhere is instant, quick load reloads the whole level (reviewer complaint) [15]. Multiplayer maps include two special People Can Fly maps [13].

## Bots and AI
- Enemy types change nearly every level; many are reskins (chargers, kamikaze) with a chapter twist such as temporary invincibility [3]. Manual samples: Evil Monk (throws or swings axes), Evil Samurai (flaming katana, fireballs, some pull you in with mind power, some die to empower others), Executioner (axe blades thrown like your own warhead, opens bodies to release spiders), Freak (explodes, bad soul), Ninjas (jump far, teleport), Templar Knights (shielded crossbow users; shoot when the shield moves away) [13]. Enemies cooperate: ranged-capable units hang back when allies fight up close, and Skulls use Hell Bikers as shields [13]. Vamp is reborn stronger if not fully destroyed; witches on broomsticks are tough; Masocommando [2]. Bosses are the Four Horsemen and other generals, large, with minions [2][13]. AI is weak and can be exploited against geometry [3]. Hell Wars (Xbox) had enemies stuck out of sight [1].

## Progression
- Coins buy tarot placement; cards unlock via level tasks; difficulty unlocks run Daydream/Insomnia, then Nightmare after 23 cards, then Trauma after Nightmare [2][6][13].

## HUD and options
- HUD: directional arrow, soul count, health, armor, primary and secondary ammo counters [13]. Scoreboard on Tab shows play time, difficulty, souls collected [13]. Card screen before each level [13]. Compass sometimes stops working (reviewer) [15]. Graphics benchmark references chapter 5 level 1 [13]. Other HUD details: unverified.

## Best features to keep
- Locked-exit arena with checkpoint after each: simple and readable [1][13].
- Alternate fire on every weapon, with combo logic (freeze then shatter, blade-plus-alt) [4][13].
- Time-limited power fantasy (demon morph) earned by play [2][13].
- Cards as small rule-bending modifiers, with silver (whole level) vs gold (activated) split, and unlocks tied to play-style constraints (only one weapon, no armor, time limits) [13][14].
- Multiplayer variants that change one rule: Voosh weapon rotation, Light Bearer, airborne-only damage [13].

## Mistakes to avoid
- Weak story; repetitive reskinned enemies and late levels [1][3]; cutscenes only after bosses [15].
- Souls delayed, despawning, only 1 health: unreliable healing; morph often wasted [3][15].
- Tedious tarot unlock tasks and modest rewards, trial-and-error card choice; coin costs high (up to 2000) [2][3][14].
- Lackluster bosses with unclear hit boxes [3].
- Frame rate dips in heavy combat on 2004 hardware [2].
- Soundtrack panned by IGN (4/10 as generic speed metal); aiming exercises thin; multiplayer called a Quake throwback with weaker depth than rivals; weapon variety thin next to UT2004; slightly exaggerated physics [1][16].
- Battle Out of Hell: bland stretches, longer loading, aggravating puzzles [19].
- Quick-load reloads the whole level; Trauma without souls strips the main recovery [7][15].

## Adaptation notes
- Arena sections as a state machine: spawn waves, lock doors, open on clear, checkpoint with a small heal on easy settings. Perfect for procedural rooms.
- Soul meter: bots drop a soul orb that homes to the player quickly (fix the criticism); at the threshold (66 in the original), a short demon-mode power state with a clear timer.
- Tarot: 6-10 cards as run modifiers chosen in a menu before a match, 3 gold plus 2 silver slots, unlocked by completing a challenge; half-refund on removal; constraint-based unlocks like "only stakes" are cheap to implement as per-level counters.
- Versus bots: free-for-all, People Can Fly (airborne-only damage flag), Voosh (timer swaps the weapon for everyone), Light Bearer (one carried pickup), Last Man Standing (lives counter).
- Freeze/shatter combo is cheap to implement (tint plus one-shot flag).

## Sources
1. Painkiller (video game) - Wikipedia - https://en.wikipedia.org/wiki/Painkiller_(video_game) - wiki
2. PC review of Painkiller - WorthPlaying - https://worthplaying.com/article/2004/4/26/reviews/16655-pc-review-painkiller/ - review
3. Painkiller: Black Edition review - KeenGamer - https://www.keengamer.com/articles/reviews/painkiller-black-edition-review/ - review
4. Painkiller game page (weapons) - Giant Bomb - https://giantbomb.com/wiki/Games/Painkiller - wiki (search excerpt)
5. Painkiller walkthrough part 10 (tarot cards) - ludo.guide - https://www.ludo.guide/guide/painkiller/painkiller-part-10 - guide
6. Painkiller discussion thread (tarot cards, difficulty) - AnandTech forum - https://forums.anandtech.com/threads/painkiller-is-in-the-bargain-bin.1511950/post-14352901 - forum
7. Painkiller: Black Edition discussion - Steam Community - https://steamcommunity.com/app/39530/discussions/0/135512625246166771 and https://steamcommunity.com/app/39530/discussions/0/1743358239831457665 - forum
8. Nixos Tarot Mod page - GamePressure - https://www.gamepressure.com/download/painkiller-black-edition-nixos-tarot-mod/z0fb4d - forum/mod (card stacking, mod-changed numbers, unreliable for stock rules)
9. Painkiller: Battle Out of Hell gone gold - overclockers.at - https://overclockers.at/spiele/gone_gold_painkiller_battle_out_of_hell_129072 - review (search excerpt)
10. Painkiller weapons forum posts - BigBruin / ZDoom - https://bigbruin.com/forum/about1923.html - forum
11. Painkiller 2025 weapons trailer - Push Square - https://www.pushsquare.com/news/2025/04/painkiller-ps5-reboot-shows-off-its-versatile-weaponry-in-new-gameplay-trailer - official/review (remake, context only)
12. Painkiller manuals at the Internet Archive (listing only; superseded by 13) - https://archive.org/advancedsearch.php?q=title%3Apainkiller+manual - manual
13. Painkiller Gold Edition instruction manual (PDF, text extracted: weapons, difficulty, tarot rules, souls, multiplayer modes, console commands) - Steam CDN - http://cdn.akamai.steamstatic.com/steam/apps/3200/manuals/manual.pdf - manual
14. Painkiller Black Tarot Card Quick Reference Table (all 34 cards with level, cost, effect, unlock) - duhvoodooman.com - http://www.duhvoodooman.com/misc/black_tarot-quickref.htm - guide
15. Painkiller review - The GamesFirst! Archive - https://gamesfirst.com/articles/2004/painkiller-2/ - review
16. Painkiller review - Gaming Nexus - https://www.gamingnexus.com/Article/527/Painkiller - review
17. Painkiller 1.61 CPL patch and multiplayer demo news - Neowin - https://www.neowin.net/news/painkiller-161-cpl-patch/ and https://www.neowin.net/news/painkiller-multiplayer-demo/ - news (search snippets)
18. Hardest levels thread - Steam Community - https://steamcommunity.com/app/39530/discussions/0/1644290549111884075 - forum
19. Painkiller: Battle Out of Hell - Wikipedia - https://en.wikipedia.org/wiki/Painkiller:_Battle_Out_of_Hell - wiki
20. Painkiller (Weapon) page, search excerpt only - Painkiller Fandom - https://painkiller.fandom.com/wiki/Painkiller_(Weapon) - wiki (blocked; figures unverified)
21. Painkiller tarot/difficulty discussion - AnandTech forum - https://forums.anandtech.com/threads/painkiller-is-in-the-bargain-bin.1511950/post-14421661 - forum
22. Painkiller (2025) alt-fire guide - NoobFeed - https://noobfeed.com/articles/painkiller-elemental-alt-fires-max-crowd-control-damage - guide (remake, context only)

Remaining gaps: per-shot damage and enemy health values; demon-mode duration in seconds; exact bots in multiplayer; scaling of enemy stats by difficulty; SMG and Boltgun ammo capacities; the Painkiller fan wiki was blocked.
