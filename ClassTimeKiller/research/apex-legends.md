# Apex Legends - design notes for an original first-person clone

Conventions: "[n]" = source number. "unverified" = weak/conflicting/not confirmed. Version context: figures from Apex wiki (wiki.gg) pages and Wikipedia as of 2026; older systems (Evo Shield) were replaced in Season 20 (Dec 2024 per search sources); several values changed with the Resurrection patch (Season 18).

## Identity

- Respawn Entertainment / EA, launched 4 Feb 2019 (free-to-play), later Switch (2021), PS5/Xbox Series (2022), mobile (2022), Switch 2 (2025) [1].
- Hero-shooter battle royale: squads of 3 (duos also), 20 squads on a map; unique "Legends" with abilities; squads cannot pick the same Legend [1].
- First-person, high movement skill, strong teamwork tools. Reviews 88-89 Metacritic on PC/console; Switch 54. 25 million players week 1, 50 million month 1, ~100 million by April 2021; Steam peak 510,286 in Aug 2022; lost about 70% of Steam players Feb-Dec 2024 [1].
- Version differences: Evo Shield (damage-based leveling) removed Season 20, replaced by Shield Cores leveling with Evo and Legend Upgrades [2][3]. Arenas (3v3, Season 9) removed Season 16 [1].

## Core loop

1. Jumpmaster picks a drop path; squad skydives, lands, loots weapons, shields, heals, ammo [1].
2. Ring (zone) closes in rounds; damage ticks every 1.5 s outside it [4].
3. Knocked players crawl, can be revived; fully killed players drop a banner; a teammate carries the banner to a Respawn Beacon (5 s wait while locked in place; each squadmate can be respawned once per game; returns with 2 syringes, 2 shield cells, old helmet and shield tier, L1 knockdown shield, non-Supply weapons without attachments, 2 ammo stacks per weapon, abilities reset) [5].
4. Last squad wins ("Apex Champions") [1].

Ring schedule, Battle Royale (wiki.gg) [4]:

| Round | Wait | Close time | Damage per tick | Final diameter |
|---|---|---|---|---|
| 1 | 1:15 | ~4:20 | 3 | ~1200 m (map-dependent) |
| 2 | 2:00 | ~1:05 | 4 | 650 m |
| 3 | 1:30 | 0:45 | 10 | 400 m |
| 4 | 1:30 | 0:40 | 15 | 200 m |
| 5 | 1:15 | 0:50 | 20 | 100 m |
| 6 | 1:00 | 2:00 | 25 | ~0 m |

Arenas ring [4]: R1 0:45 wait / ~0:30 close / 10 dmg / 170 m; R2 0:35 / 0:25 / 15 / 75 m; R3 0:30 / 0:15 / 20 / 12.5 m; R4 0:15 / 0:03 / 25 / point. A search summary of the EA Resurrection (Season 18) patch notes states ring 2 damage 3 to 4, ring 4 damage 20 to 15, ring 1 radius +10%, and round 1 pre-shrink 90 s to 75 s; the wiki table already matches these, but treat the patch-note claims as relayed, unverified [6].

- Design takeaway: ring damage per tick ramps 3 -> 25 over six rounds; waits 60-120 s. For an offline 6-8 minute match, scale all times by about 0.3 and keep the damage ramp.
- Loot rarity tiers: white/blue/purple/gold(/red mythic for Supply Drop weapons); Mythic ammo for Supply Drop weapons cannot be replenished [7].

## Movement

Verified speeds from the wiki [8]:

| Quantity | Value |
|---|---|
| Walk | 5.07 m/s |
| Sprint | 7.59 m/s |
| Crouch walk | 2.34 m/s |
| Holding a weapon | -13% speed |
| Using a regen item | -40% speed, no sprint |
| Superglide start | 10.3 m/s |
| Max skydive | 25.1 m/s |
| Wall climb | hold jump at a vertical surface, about 6 m, mantle if reaching a ledge |
| Pathfinder zipline gun | zipline 66% faster than a standard zipline |

- Slide: crouch while moving fast; length from slope and entry speed; jumping out of a slide retains more momentum than from a sprint [8].
- Advanced: wall bounce (slide into wall, tap jump), superglide (jump+crouch at the top of a mantle, narrow window), tap-strafe (keyboard/mouse only) [8].
- Environmental traversal: ziplines, jump towers (launch a skydive), jump pads (Octane ultimate), Mobile Respawn Beacons, Holo-spray. Ring consoles show next ring [3].
- FPS adaptation: sprint/slide/mantle/slide-jump are cheap to implement in plain JS; add auto-mantle and a touch "slide/jump" button. Skip tap-strafe and superglide exploits or implement as hidden bonus.

## Weapons and equipment

- Seven weapon categories: assault rifles, SMGs, LMGs, marksmen, snipers, shotguns, pistols; Mozambique doubles as shotgun/pistol; non-Mozambique shotguns have no hipfire spread [7].
- Ammo types: Light, Heavy, Energy, Sniper, Shotgun shells, plus Mythic ammo for Supply Drop weapons [7].
- Attachments: extended mags, stocks (reload, deploy, ADS), barrel stabilizers (recoil), laser sights (hipfire spread), optics, boosted loaders; Hop-Ups on some weapons. Attachment rarity: Common to Legendary [7].
- Headshot multiplier is generally above 1x but reduced by helmet level; leg multiplier at or below 1x. Example TTK: HAVOC Rifle about 0.45 s to kill 100 HP via body shots [7].
- Healing / shield items (wiki) [9]:

| Item | Effect | Use time |
|---|---|---|
| Syringe | +25 health (+50 with level-4 body shield) | 4 s |
| Med Kit | full health | 8 s |
| Phoenix Kit | full health and shield | 10 s |
| Shield Cell | +25 shield (+50 with gold armor) | 2.5 s |
| Shield Battery | full shield | 5 s |

- Shield HP (old Evo Shield): 50 / 75 / 100 / 125 by tier, Evo thresholds 200, 300, 750 points (1:1 damage, 25% from NPC damage); removed in Season 20 [2]. Season 6 notes list armour values 125/150/175/200 (older, gfinity), unverified for the current build [10]. Current Shield Core levels: unverified (page lacked numbers).
- Knockdown shield: downed player can raise it to block fire; level-4 knockdown shield revive gives 70 health and 50 shield [9].
- Grenades (frag, arc star, thermite), Gold Backpack/Helmet tiers: general knowledge, numbers unverified.
- Care packages and Supply Drops contain Mythic weapons; Replicators craft items for crafting materials (50 materials per Evo Points item) [2].

## Abilities and items

Class system (wiki) [3]: Assault (extra grenade/ammo capacity), Skirmisher (care-package reveal, health/shield on knockdowns), Recon (survey beacons, threat vision), Support (faster revives, mobile respawn beacons), Controller (ring console predictions, extra shield capacity). Representative table [11] (passive / tactical cooldown / ultimate cooldown):

| Legend | Class | Passive | Tactical (CD) | Ultimate (CD) | Archetype |
|---|---|---|---|---|---|
| Wraith | Skirmisher | warns of danger | Into the Void (25 s) | portals (180 s) | repositioning / safe escape |
| Pathfinder | Skirmisher | beacon reduces zip cooldown | grapple (10-30 s) | zipline gun (180 s) | traversal |
| Octane | Skirmisher | heals when not damaged | Stim (1 s) | Launch Pad (90 s) | speed |
| Bangalore | Assault | speed on hit | smoke wall (30 s, 2 charges) | artillery (210 s) | defensive offense |
| Fuse | Assault | extra grenades | cluster bomb (20 s) | fire ring (120 s) | area denial |
| Bloodhound | Recon | tracker clues | reveal (25 s) | enhanced tracking (240 s) | scouting |
| Crypto | Recon | shared drone view | drone (40 s) | EMP (180 s) | info/utility |
| Vantage | Recon | scope info | echo reposition (20 s) | marks (40 s) | long-range support |
| Lifeline | Support | D.O.C. revive | heal drone | halo (care packages) | healer |
| Gibraltar | Support | gun shield | dome (17 s) | mortar (180 s) | defence |
| Mirage | Support | cloak on beacons | decoy (15 s) | team decoys (60 s) | deception |
| Wattson | Controller | accelerants charge ultimate | fences (15 s, 4 charges) | pylon (180 s) | defence |
| Caustic | Controller | gas vision | gas traps (20 s) | gas grenade (180 s) | area control |
| Rampart | Controller | bigger LMG mags | cover walls | minigun | fortify |
| Revenant | Assault | highlights low-HP | pounce (25 s) | shroud (120 s) | assassin |
| Horizon | Skirmisher | air control | gravity lift (30 s) | black hole (210 s) | vertical |

Design space summary: each Legend = 1 passive + 1 tactical (15-40 s) + 1 ultimate (60-240 s). Roles: mobility, area denial, healing, recon, damage amplification. Representative abilities for a clone: dash/phase (Wraith), grapple (Pathfinder), smoke (Bangalore), heal drone (Lifeline), decoy (Mirage), fences (Wattson), drone (Crypto).
- Ultimate Accelerants and cooldown reductions exist [11]; ultimate charges over time and by action (exact economy unverified).
- FPS adaptation: ship 6-8 original archetypes (Dash, Grapple, Smoke, Heal, Decoy, Fence, Scan, Pad) with a shared 10-30 s tactical and 90-180 s ultimate; no cloning of names.

## Health and damage

- 100 health per Legend; shields are a second layer (Shield Core / body shield) [9].
- Damage chain: shield first, then health; helmet reduces headshot bonus [7].
- Ring damage percent: see ring table.
- Knockdown: downed state with crawl; knockdown shield; revive 100% of squad players cooperatively [5][9].
- FPS adaptation: 100 HP + 50-125 shield; headshot x1.5-2.0 (unverified typical) reduced by helmet; downed state with bleed-out timer is optional.

## Modes and match options

Permanent modes (wiki) [12]:

| Mode | Teams | Win condition | Notes |
|---|---|---|---|
| Battle Royale Trios | 20 squads of 3 | last squad | map rotates every 90 min |
| Duos | 15 squads of 2 | last squad | accelerated |
| Ranked | 20 squads of 3 | last squad | daily map |
| Wildcard | 10 squads of 3 | last squad, with respawns | |
| Bot Royale | 1-5 player squads, bots fill | standard BR | Season 22 [13] |
| Control (Mixtape) | 2 squads of 9 | capture three zones / 1000 points | respawn waves from linked zones [14] |
| Gun Run (Mixtape) | 4 squads of 3 | first to a kill with every weapon (25 weapons) | knife kill ends [14] |
| Team Deathmatch (Mixtape) | 2 squads of 6 | first to 40 kills (sources say 30/40/50) | no downed state, fast respawn |
| Lockdown | 4 squads of 3 | capture zones | |
| Training / Firing Range | solo | none | |

- Arenas (3v3, buy phase, first to 3 points with 2-point lead; 2021-2023) [1].
- Mixtape rotates mode and map every 15 minutes [12].

## Map design

- Large maps with named POIs, ring-adjacent drop edges, jump towers and zipline highways; loot tied to POI tier (not researched with numbers; unverified). Verticality via mantle/slide, buildings with multiple entrances. Supply drops and care packages as third-party hotspots.
- Weapon/ammo spread: kit-in-your-lap loot per room to speed looting.
- FPS adaptation: 6 POIs on a compact map, zipline between two high points, a central tower, loot rooms placed near spawn edges.

## Bots and AI

- Firing Range overhaul (Season 17, May 2023): new map, dummies that fire back, adjustable shield, behaviour and distance, duelling pit, agility course, training ground with combat simulations [15].
- Bot Royale added in Season 22 replaces orientation matches; XP not earned past level 10 [13]. Earlier players saw bot-heavy lobbies in orientation matches; Season 20 matchmaking overhaul removed bot-lobby workarounds [13][16].
- Reception: bot lobbies are popular for new players but players disliked them replacing real matches and as undisclosed lobbies (gfinity, search summary) [16].
- FPS adaptation: build Firing Range as the starting scene with configurable dummies (stand/strafe/shoot), plus a full bot match.

## Progression

- Battle pass per season with new Legend/weapon; account level; Apex Packs (loot-box style); Iron Crown event (Aug 2019) locked the top cosmetic behind loot boxes and an extra purchase, total about $170, and drew heavy backlash; Respawn apologised [1]. Monsters Within event (Oct 2021) criticised for bundling and bugs [1].
- Offline fit: local level, unlock-by-playing Legends and weapon skins, challenge list. No loot boxes.

## HUD and options

- Contextual ping system (key design asset) [17][18][19]:
  - Tap = default ping; its meaning and voice line change with target (loot, door, bin, care package, zipline, enemy ability, map features) [17].
  - Hold = ping wheel with 7 fixed options: Enemy Here, Looting Here, Attacking Here, Going Here, Defending Here, Watching Here, Someone's Been Here [17].
  - Vocal pings: reply (OK, No, I Can't, I'll Join You, Dibs), thanks, request items by pinging inventory, ping ultimate icon to say it is ready [17].
  - Legend-specific pings (Bloodhound clues, Mirage decoy, Wattson fences, Ash marks, Vantage lens) [17].
  - Respawn reportedly banned voice chat during internal testing; critics credit the ping system for accessibility and low-friction teamwork; builds on Battlefield's Q-to-mark [18][19].
  - I did not find the Respawn GDC talk; GDC Vault search recommended.
- Other HUD: shield bar (segmented by tier), ability icons, squad panel, compass, ring timer, inventory with auto-pickup.
- Accessibility: colourblind options, audio cues; bad audio was a complaint (see Mistakes).
- FPS adaptation: implement the same contextual ping with 3 layers (tap, wheel, response); for bots, let them react to pings.

## Best features to keep

1. Contextual ping + vocal responses: communication without voice [17][18][19].
2. Legend class abilities with short tactical cooldowns [3][11].
3. Respawn banners and beacons: a comeback loop that keeps squads active [5].
4. Movement: sprint, slide, mantle, zip [8].
5. Ring escalation: damage ramp and wait times [4].
6. Mixtape modes: 15-minute rotation and quick-fire modes (Control, Gun Run, TDM) [12][14].
7. Firing range with fire-back dummies [15].

## Mistakes to avoid

- Loot-box event pricing and bundling (Iron Crown, Monsters Within) [1].
- Audio problems: players say they must wear quality headphones to hear enemies; a Season 10 bug muted all audio [20][21].
- Server/performance issues: slow match starts, hit-registration, engine limits as player complaint [20][21].
- Matchmaking frustration (SBMM) and stale meta [20][22].
- Bots hidden in lobbies / conflicting messaging about bots [13][16].
- Modes removed (Arenas) and communication gaps [1][20].
- Balance of vertical movement skills widening skill gap (general; unverified).

## Adaptation notes

- Keep match to 8-10 minutes with 6 squads of 3 (18 actors), ring in 5 steps.
- Use cheap frustum culling and a single skinned-capsule rig for characters; at most 12 bots updated each frame, others at 15 Hz.
- Ping as billboard icons with synthesized chimes; ping wheel for touch with long-press.
- Procedural audio: footsteps with direction-based panning, ring warning tone.
- Controls: gamepad with aim-assist, touch virtual stick + slide button + ability buttons.

## Sources

1. Apex Legends - Wikipedia - https://en.wikipedia.org/wiki/Apex_Legends - wiki
2. Evo Shield - Apex Legends Wiki (wiki.gg) - https://apexlegends.wiki.gg/wiki/Evo_Shield - wiki
3. Legend - Apex Legends Wiki - https://apexlegends.wiki.gg/wiki/Legend - wiki
4. Ring - Apex Legends Wiki - https://apexlegends.wiki.gg/wiki/Ring - wiki
5. Respawn Beacon - Apex Legends Wiki - https://apexlegends.wiki.gg/wiki/Respawn_Beacon - wiki
6. EA, Resurrection patch notes (via search summary) - https://www.ea.com/news/resurrection-patch-notes - official
7. Weapons - Apex Legends Wiki - https://apexlegends.wiki.gg/wiki/Weapons - wiki
8. Movement - Apex Legends Wiki - https://apexlegends.wiki.gg/wiki/Movement - wiki
9. Health - Apex Legends Wiki - https://apexlegends.wiki.gg/wiki/Health - wiki
10. Season 6 armour meta - https://www.gfinityesports.com/article/apex-legends-season-6-patch-notes-armour-meta-evo-shield-health-damage-requirements-pc-origin-xbox-one-ps4 - review
11. Abilities - Apex Legends Wiki - https://apexlegends.wiki.gg/wiki/Abilities - wiki
12. Gamemode - Apex Legends Wiki - https://apexlegends.wiki.gg/wiki/Gamemode - wiki
13. Apex adds Bot Royale in Season 22 - https://esports.gg/news/apex-legends/apex-adds-bot-royale-mode-in-season-22 - review
14. How Apex Legends' new game mode Control works - https://upcomer.com/how-apex-legends-new-game-mode-control-works/ - guide
15. Apex Legends Firing Range (Season 17 overhaul) - https://insider-gaming.com/apex-legends-firing-range/ - review
16. Apex Legends bot lobbies - https://www.gfinityesports.com/article/apex-legends-bot-lobbies - review
17. Ping - Apex Legends Wiki - https://apexlegends.wiki.gg/wiki/Ping - wiki
18. Apex Legend's "ping" system - gaming UX done right - https://uxdesign.cc/apex-legends-ping-system-gaming-ux-done-right-4661cd94954c - review
19. PC Gamer, ping system a tiny miracle - https://www.pcgamer.com/au/apex-legends-ping-system-is-a-tiny-miracle-for-fps-teamwork-and-communication/ - review
20. EA forums, Apex feedback threads - https://forums.ea.com/discussions/apex-legends-feedback-en/the-core-engine--technical-bottlenecks-that-will-never-be-fixed/13710323 - forum
21. Dexerto, Season 10 audio bug - https://www.dexerto.com/apex-legends/major-apex-legends-season-10-bug-mute-audio-1668092 - review
22. Gfinity, biggest gripes before Season 18 - https://www.gfinityesports.com/article/apex-legends-biggest-gripes-discussion - review

Gaps: Respawn GDC ping talk not found; current Shield Core numbers, legend base-weapon damage tables, loot density, Liquipedia (HTTP 403) and Fandom wiki (HTTP 402) not fetched; several articles read only via search summaries (6, 10, 13, 16, 19-22).
