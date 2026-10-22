# Doom: The Dark Ages (2025): design notes for an original FPS clone

Method note: doomwiki.org was blocked (403); some facts come from search excerpts of guide pages. Unverified items are marked. Source numbers refer to the list at the end.

## Identity
- id Software, 2025. Single-player only, no multiplayer [1]. Deliberately heavier and more grounded than Doom 2016/Eternal; the Slayer is described as an "iron tank" [1]. Martin's comparison: an Abrams tank rather than an F-22 [3]. Tagline "Stand and Fight": the shield lets you hold ground and parry instead of constantly moving [4].
- Reception: Metacritic 83-85, OpenCritic about 86 average with 95% recommending; Steam user score 86% versus Eternal 91% and 2016 95% [1][6][7].

## Core loop
- Fight in larger, flatter arenas with more enemies and slow projectiles; you weave between projectiles while closing in [3]. The Shield Saw sits in the off hand and blocks, parries, and attacks while the other hand fires or swings melee [1][3].
- Parry rules [5]: only green projectiles and green melee attacks can be parried; red and blue must be dodged or blocked. Tap the shield at the last moment. A parried projectile re-aims at its sender. Parrying a single melee hit staggers the enemy; against combos each parry knocks it back. Parry window is adjustable in options [5][2].
- Melee: gauntlet, iron mace, flail, combined with shield attacks in combos [1][3]. Slow-motion glory-kill style finishers add control [1]. Reviewers say the absence of signature glory kills and a less impactful score were notable losses [1].
- Vehicles: first Doom with piloted sections, a cybernetic dragon and a 30-story Atlan mech [1].

## Movement
- Grounded: slower walk, strafing to aim, shield charge (shield-based dash; exact distance, cooldown unverified) [3]. No dash/double-jump of Eternal.

## Weapons and equipment
From Gamereactor guide [8]; upgrades are choice-based per weapon; three upgrade currencies [9]. Skull Crusher fires bone fragments [1]. Weapon count disagrees among sources: 11 guns with mastery [8][9], one source says 16 including melee/shield items [9].

| Weapon | Behaviour and notable upgrades | Mastery (as stated) |
|---|---|---|
| Combat Shotgun | Pump shotgun; burn-to-armor drops, 3-round burst, more pellets [8][9] | every pellet hits, 150 times |
| Super Shotgun | Reload cut, armor damage, pellets | every pellet hits, 50 times |
| Rail Spike Shredder | Rifle; rounds load demons for detonation, ricochet shots | damage 100 additional demons |
| Rail Spike Impaler | Single-shot marksman; ammo from Shield Saw actions, headshot refills melee | regen melee 100 times |
| Plasma Accelerator | Auto energy gun, strong vs plasma shields; charge raises fire rate; Overload | 1,000 Overload/Heatblast |
| Plasma Cycler | Dual barrel; shock arcs | 500 Overload/Lightning |
| Skullcrusher Pulverizer | Cone of skull fragments; kills build charge | 250 charged damage |
| Skullcrusher Ravager | Steady bone stream; drops health at max rate | 100 ammo pieces |
| Chainshot | Chained ball, heavy blunt; parry Hell Surge empowers; charged explodes | 100 Cosmic Breach |
| Grenade Launcher | Bouncing; cluster grenades | 100 Fragment/Cataclysm |
| Rocket Launcher | Parry Hell Surge; Cannibalism heals from self-damage | 50 Cannibalism heals |
- Crossbow is the one weapon without mastery [9].

## Abilities and items
- Shield Saw: block, parry, throw/saw (throw details unverified) [1].
- Health/armor: start 100 health and 50 armor; executing demonic leaders raises caps up to 200 and 150 (DoomWiki, search excerpt) [10].
- Resource Values slider scales pickups [2].

## Health and damage
- Slow enemy projectiles are the design tool [3]. Enemy damage scales via sliders [2][11].
- Preset effects [11]: Aspiring Slayer = more damage dealt, much less aggression, longer daze, bigger pickups, Enhanced Targeting and Empowered Attacks on. Hurt Me Plenty = default aggression/damage, generous parry. Ultra-Violence = double enemy damage, shorter daze. Nightmare = 250% enemy damage, max aggression, smaller pickups. Pandemonium = Nightmare with permadeath unless Life Sigils. Ultra-Nightmare = no second chances.

## Modes and match options
- Single player campaign only [1]. Granular modifiers, adjustable per save [2]:
  Parry Window, Enhanced Targeting (auto-aim assist), Empowered Attacks (more stopping power), Damage to Player, Damage to Demons, Enemy Aggression, Game Speed, Daze Duration, Enemy Projectile Speed, Resource Values. Numeric ranges not published in the pages I read: unverified. Enemy Aggression is described differently (frequency of attacks vs number of simultaneous attackers) [2][12]. A third-party source claims the lowest preset parries by just blocking: unverified [12].

## Map design
- Larger levels and flat, dense arenas; slower pace [3][6]. Mech and dragon set pieces. Gold is found in levels; about 6,557 Gold in total, full upgrade costs 5,925 (one guide) [9].

## Bots and AI
- Enemies throw color-coded attacks (green parryable) and slow projectiles; more enemies on screen than before, possibly no hard cap [3]. Exact enemy roster: unverified.

## Progression
- Sentinel Shrines: upgrades cost Gold first, Rubies for rarer, and one Wraithstone for the final upgrade per weapon [9]. Choice-based upgrade trees and weapon mastery [8].

## HUD and options
- Parry window and the sliders above are the key accessibility idea: independent control of speed, aggression, damage, and timing windows, plus assists [2][5].

## Best features to keep
- Color-coded parry (green) gives readable telegraphs and skill expression [5].
- Granular modifiers instead of one difficulty ladder [2].
- Shield as both defense and tool (stagger, ammo rewards) [8].
- Heavy, readable combat: slow projectiles you can dodge or deflect [3].

## Mistakes to avoid
- Slower and more repetitive than Eternal; late repetition; set pieces and story that do not land [6][7].
- Parry/stand-still play can reduce skill needed (player opinion) [7].
- Weaker kill animations and less impactful music [1][7].
- Story-heavy cutscene bias [1]. Vehicle/dragon sections criticism: I found no source specifically; unverified.

## Adaptation notes
- Parry fits a bot game: bots fire green-tinted orbs; tap block window (e.g. 0.2 s, adjustable) reflects them at the shooter. Cheap: tinted spheres, no new assets.
- Expose 6-8 sliders (speed, damage in/out, aggression, parry window, projectile speed, pickup yield) and presets; trivial to implement, great for touch players with aim assist.
- Versus bots: arena survival with ramping waves; shield charge on a button for touch.

## Sources
1. Doom: The Dark Ages - Wikipedia - https://en.wikipedia.org/wiki/Doom:_The_Dark_Ages - wiki
2. Custom gameplay modifiers - Bethesda Slayers Club - https://slayersclub.bethesda.net/en-AU/news/doom-the-dark-ages-gameplay-modifiers - official
3. Slower action, more enemies - GamingBolt - https://gamingbolt.com/doom-the-dark-ages-will-have-more-enemies-larger-arenas-and-slower-action-creative-director - review/interview
4. Dark Ages preview - Gamereactor (excerpt) - https://embed.gamereactor.eu/doom-the-dark-ages-preview-the-ultimate-one-man-army-embarks-on-its-most-explosive-crusade-yet-1521933/ - review
5. How to parry - Shacknews - https://www.shacknews.com/article/144239/how-to-parry-doom-the-dark-ages - guide
6. Critics roundup - Pure Xbox - https://www.purexbox.com/news/2025/05/roundup-heres-what-the-critics-think-of-xboxs-doom-the-dark-ages - review
7. OpenCritic and Steam reception - https://opencritic.com/game/18023/-  and https://80.lv/articles/doom-the-dark-ages-shows-a-slow-start-on-steam - review
8. Weapon and mastery guide - Gamereactor - https://www.gamereactor.eu/doom-the-dark-ages-guide-what-does-each-weapon-do-and-how-to-complete-its-mastery-challenge-1541793/ - guide
9. Upgrade/gold guides (Gfinity, Destructoid, Deltias, PowerPyx; search excerpts) - https://www.gfinityesports.com/article/doom-the-dark-ages-what-are-the-best-gun-upgrades - guide
10. DoomWiki Supplies (Dark Ages) - https://doomwiki.org/wiki/Supplies_(Doom:_The_Dark_Ages) - wiki (search excerpt)
11. All difficulty settings - Method.gg - https://www.method.gg/doom-the-dark-ages/doom-the-dark-ages-all-difficulty-settings-explained - guide
12. Slider reports - VGC, Sportskeeda, Beebom - https://videogameschronicle.com/news/doom-the-dark-ages-will-change-game-speed-and-other-difficulty-sliders - review (search excerpt)
