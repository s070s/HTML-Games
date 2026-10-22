# Valorant (Riot Games, 2020) - design notes for an original offline FPS clone

Conventions: [n] = source number. "unverified" = not confirmed by a fetched source (recall, or single/old source). Numbers have changed across patches since 2020; Riot patch notes weren't directly fetchable.

## Identity
- Free-to-play 5v5 tactical hero shooter, released 2 June 2020 (PC; later consoles); borrows CS buy menu, spray patterns, movement inaccuracy; adds agents with abilities [3]. 29 agents as of May 2026 [3][10]. Built on Unreal Engine (UE5 move July 2025), tuned for low hardware (min spec Intel HD 4000 at 30 FPS) and 128-tick servers [3][12].
- Pillars: gunplay precision (accuracy punishes moving), economy, and abilities as utility not as aim substitutes.

## Core loop
- Attack/defense. Attackers plant the Spike; defenders stop or defuse. First to 13 rounds (best of 25), sides swap after 12 rounds; 12-12 triggers overtime (win-by-2 style, sources conflict; one says 3 additional rounds, one says sudden death) [4][8].
- Round timer 100 s; plant 4 s; Spike explodes 45 s after plant; full defuse 7 s, half-defuse checkpoint at 3.5 s banks progress [8].
- Economy [1][2]:
  | Item | Value |
  |---|---|
  | Pistol-round credits | 800 |
  | Round win | 3,000 each |
  | Loss | 1,900 first, 2,400 second, 2,900 third+ consecutive; resets after a win |
  | Kill | 200 (weapon independent) |
  | Spike plant | 300 each attacker (one source); no bonus for defuse |
  | Overtime / round 25 start | 5,000 [1] |
  | Max credits | 9,000 (unverified recall) |
  Unspent credits carry over, except at the half swap. Survivor-of-loss bonus: one source says 1,000 only for survivors, unverified.
- Purchase tiers: eco, half-buy, force, full buy (~4,500 credits with rifle, heavy shield and abilities) [1].
- Ultimate points: earned from kills, orbs, plants/defuses, rounds (recall, unverified); ultimates charge until used.

## Movement
- Walking (shift) silences footsteps and gives accuracy; run/walk/crouch accuracy "error" values (degrees) for rifles after patch 2.02: running 5.0 (from 3.75), walking 1.1 (from 0.8), crouch-moving 0.8 (from 0.3) [5][11]. Walking accuracy only applies while actually walking (patch 0.50 raised base walk to 0.8) [11]. Later patches (Ep.3) reduced run-and-gun accuracy again and tag-slow effects [11].
- Run speed 6.75 m/s knife-out ~ unverified; per-weapon equip speed multipliers exist (rifles slower than knife) - unverified.
- No bunny hop; jump has no air strafe beyond limited; stopping is near-instant with "stopping accuracy" rewarded. Agent movement abilities (dash, updraft, teleport) are the movement depth. Ladders exist (recall).

## Weapons and equipment
- Weapon prices and stats (first damage bracket, body/head/leg) from pre-release/older sources; verify against current patch:
  | Weapon | Class | Price | Dmg body/head/leg | Fire rate (rps) | Mag | Wall pen |
  |---|---|---|---|---|---|---|
  | Classic | Sidearm | free | 26/78/22 | 6.75 | 12 | Low [7] |
  | Shorty | Sidearm | 150-200 | 12/36/10 per pellet | 3.3 | 2 | Low [1][7] |
  | Frenzy | Sidearm | 450 | 26/78/22 | 10 | 13 | Low |
  | Ghost | Sidearm | 500 | 30/105/26 | 6.75 | 15 | Medium |
  | Sheriff | Sidearm | 800 | 55/160/47 | 4 | 6 | High |
  | Stinger | SMG | 950 | 27/67/23 | 18 | 20 | Low |
  | Spectre | SMG | 1,600 | 26/78/22 | 13.3 | 30 | Medium |
  | Bulldog | Rifle | 2,050 | 35/116/30 | 9.15 | 24 | Medium |
  | Guardian | Rifle | 2,250 | 65/195/49 | 6.5 | 12 | Medium |
  | Phantom | Rifle | 2,900 | 39/156/33 close; head 140 at 15-30 m, 124 at 30-50 m | 11 | 30 | Medium |
  | Vandal | Rifle | 2,900 | 39/156/33 no falloff (160 head older) | ~9.25-9.75 | 25 (unverified) | Medium |
  | Bucky | Shotgun | 850 | n/a | n/a | n/a | n/a |
  | Judge | Shotgun | 1,850 | 17/34/14 per pellet | 3.5 | 7 | Medium |
  | Marshal | Sniper | 950 | 101/202/85 | 1.5 | 5 | Medium |
  | Operator | Sniper | 4,700 | 150/255/127 | 0.75 | 5 | High |
  | Ares | Heavy | 1,600 | 30/72/25 | 10-13 ramp | 50 | High |
  | Odin | Heavy | 3,200 | 38/95/32 | 12-15.6 ramp | 100 | High |
  Prices from [1] (current-ish); damage from [7] (note: older, pre-release; price column in [7] differs: e.g., Guardian 2,700, Operator 4,500). Vandal vs Phantom differences: Vandal one-tap headshot at any range, Phantom less recoil/suppressed tracers [6][9].
- Shields: Light 400, Heavy 1,000 (25 / 50 shield points, recall unverified) [1]. Regen Shield (650, 25 HP + 50 regen pool) existed in a patch [snippet vlr.gg].
- Recoil: Vandal climbs then sways left-right; Phantom very similar slightly better; ADS reduces recoil [6]. First bullet accurate when standing/walking. Rifle/sniper scope as secondary fire; Operator is slow, one-shot above ~150 body-damage with armor taken into account (recall).
- No grenades in standard buy; utility comes from agent abilities.

## Abilities and items
- Roles [10][3]:
  | Role | Job | Typical ability types |
  |---|---|---|
  | Duelist | Self-sufficient entry; signature recharges via kills | self-flash, dash, heal on kills, reposition |
  | Initiator | Info and disruption | recon darts/drones, flash, stun, tag/reveal |
  | Controller | Vision denial | smokes (usually 2-3 charges), walls, area-denial gas, global map smokes |
  | Sentinel | Lock down sites | traps, tripwires, turrets, cams, barriers, revive |
- Kit structure: 1 passive/signature (free, recharges), 2 basic buys (credits), 1 ultimate (points). Ultimates examples by type: rocket/area damage, sniper bow with recon, revive, massive vision, team buff. Roster 5 free agents, rest unlocked by Kingdom Credits [3].
- Ability design space (categories): vision block (smoke/wall), information (recon/dart/sonar), blind/stun/slow (flash/concussion), trap/zone denial (molotov-like, mines), mobility (dash, jump, teleport, grapple), sustain (heal, revive), summon (turret, drone), buff (speed/damage). Design principle from sources: roles are guidance not rules [10]; some agents are ambiguous (Clove) [10].

## Health and damage
- 100 HP; shield absorbs 50% of damage to health up to shield points (recall, unverified). Damage multipliers: head ~3x body baseline (e.g., 39/156 = 4x for rifles), legs ~0.85x body [7]. Damage falloff only for certain weapons (Phantom, SMGs, pistols) [9].
- Wall penetration: weapon-rated Low/Medium/High; surfaces rated; destructible doors e.g. Haven garage [snippet]. Some cases reportedly deal full damage unexpectedly (unconfirmed) [snippet].

## Modes and match options
- Unrated, Competitive (Iron to Radiant), Premier, Swiftplay (first to 5 rounds), Spike Rush (best of 7, first to 4, random loadouts, ult charges faster, orbs), Deathmatch (first to 40 kills or ~9 minutes), Team Deathmatch, Escalation (12-weapon gun-game), Skirmish, limited modes; Replication removed in 7.0 [3][8].
- Custom games with cheats toggle; practice Range with bots (shooting tests, strafing bots) - plant/defuse practice removed in patch 9.02; Range AI weak [14].

## Map design
- Examples: Ascent (open mid, sliding doors, 2 sites), Bind (no mid, teleporters), Haven (three sites, defenders spread thin), 1-3 sites per map [map sources 9]. Principles: sites with multiple entrances, chokes, mid for rotation, one-way vision, ability-aware geometry (e.g., ropes, doors). Callouts per area.

## Bots and AI
- No official AI team mode. Range bots: stationary/strafing targets, difficulty options; criticized as poor for learning angles and ability use [14]. Opportunity space for clones: use CS bot ideas.

## Progression
- Agents unlocked via Kingdom Credits or VP; battle pass, cosmetic weapon skins; rank. 28-day exclusivity of new agents [3]. For offline: unlock agents by wins.

## HUD and options
- Radar minimap with agent icons, ability bar bottom (C, Q, E, X), credit counter, shield/health bar, spike indicator, economy shown at buy phase; crosshair editor with center dot, inner/outer lines, outlines, firing error toggle, per-scope settings (recall). Colorblind modes for enemy outline color (recall).

## Best features to keep
- Clear economy values with weapon-independent kill reward [1][2].
- Spike half-defuse checkpoint and timing structure [8].
- Accuracy-while-moving rules to preserve tactical gunplay [5][11].
- Roles for team composition; limited charges; ult economy [10].
- Low-spec friendliness [12].

## Mistakes to avoid
- Smurfing and matchmaking frustrations (Riot: less common than perceived) [13].
- Ability clutter: no source found; commonly argued bloat with 29 agents (unverified).
- Toxic voice chat (79-80% report harassment) [3]; kernel anti-cheat privacy concerns [3].
- Run-and-gun metas, which Riot repeatedly patched [5][11].
- Weak practice bots/range regressions [14].

## Adaptation notes
- Keep exact: round/spike timings, economy ladder, run/walk/crouch accuracy tiers, no-falloff Vandal-type rifle, wall pen tiers (3 levels).
- Simplify: 4-6 original agents (one per role) with 3 abilities + ult; 2-3 smoke charges as billboard spheres/volumetric-lite; flash as screen whiteout; walls as extruded boxes; no map-wide ult complexity.
- Bots: reuse CS-style waypoint bots with ability triggers (smoke on choke, flash on peek, simple trap).
- Performance: ability VFX use instancing and few particles; shader-light, flat-shaded stylized look suits low-end.

## Sources
1. OneEsports - Valorant economy guide - https://www.oneesports.gg/valorant/valorant-economy-guide - guide
2. Upcomer - How does the Valorant economy system work - https://www.upcomer.com/how-does-valorant-economy-system-work-money/ - guide (snippet)
3. Wikipedia - Valorant - https://en.wikipedia.org/wiki/Valorant - wiki
4. TheDonutWhole - How many rounds are in Valorant - https://www.thedonutwhole.com/how-many-rounds-are-in-valorant/ - guide (snippet)
5. Upcomer - Valorant patch 2.02 rifle movement accuracy - https://upcomer.com/valorant-addresses-rifle-movement-accuracy-in-patch-2-02 - news
6. Inven Global - Valorant weapon guide: the Vandal - https://www.invenglobal.com/valorant/articles/11138/valorant-weapon-guide-the-vandal - guide
7. GINX - Valorant weapons guide - https://www.ginx.tv/en/valorant-weapons-guide - guide (pre-release data)
8. Metabot.gg - Spike plant, defuse, post-plant - https://metabot.gg/en/valorant/guides/valorant-spike-plant-defuse-postplant - guide
9. Prosettings / HighGround maps guides - https://prosettings.net/blog/valorant-maps/ , https://www.highgroundgaming.com/valorant-maps-guide/ - guide (snippets)
10. esports.gg - Entry Frag part four, agents; Valorant Wiki Agents page - https://esports.gg/guides/valorant/entry-frag-part-four-a-rundown-of-all-valorant-agents - guide (snippet)
11. Dexerto / Twinfinite - run-and-gun accuracy nerfs - https://www.dexerto.com/valorant/valorant-run-gun-accuracy-nerfed-episode-3-1598481/ - news (snippet)
12. Riot - VALORANT system requirements - https://playvalorant.com/en-us/specs/ - official
13. Riot - Ask VALORANT, May 6 (smurfing) - https://playvalorant.com/en-us/news/dev/ask-valorant-may-6 - official
14. The Spike - Opinion: How can the Range be improved - https://www.thespike.gg/news/opinion-how-can-the-range-be-improved/402 - review (snippet)
15. NoPing - Valorant game modes explained - https://noping.com/blog/valorant-game-modes-explained - guide (snippet)
