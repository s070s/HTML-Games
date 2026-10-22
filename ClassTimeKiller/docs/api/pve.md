# PvE (S14 14h..14k) - enemies, director, PvE modes and the boss

Files: `src/03o-data-enemies.js` (enemy rows E01..E14 and range targets R01..R03, director, champion, wave, mode and chamber tables), `src/14h-pve.js` (framework `Pve`: spawning, perception, brains, attack phases, director, damage hooks, drawing), `src/14i-pve-enemies.js` (`PveMove`, `PveAttacks`, `PveBrains`: one generic function set per behaviour and attack kind), `src/14j-pve-modes.js` (mode behaviours, `PVE_HUD`), `src/14k-pve-boss.js` (`PveBoss`, E13 phases). Tests: `src/20b-test-pve.js` (group `pve`). Debug: `__CTK.pve` (`pve`, `boss`, `hud`, `showcase(mapId?)` lines every row up in front of a player). Spec: NPC-001..NPC-008, BOT-005, DIF-002, PERF-009, MAP-030, M21..M30, X50.

## Contract

- Enemies are `ACTOR_KIND.ENEMY` actors with `Actors.profile` = their `CAT.enemies` row. Only `Pve.spawnEnemy` makes them (spawning contract: placed, `alive = 1`, `actor.spawn` emitted, then the row's pools, size and movement preset override what S11 / S10 set). They are never `Modes.participant`; kills by participants credit the participant like any kill.
- They reuse the bot layers: view cone and line-of-sight ray (`BotSense.viewClass`, `BotSense.lineOpen`, memory arrays), path following (`BotMove`), and the motor (`Bots.motor`). They never run the bot brain (`Bots.active` stays 0), never call `BotSense.look` (no team pings or barks) and spend their own ray budget (`PVE_DIRECTOR.raysPerTick`, 24 per tick).
- Sim systems: `pveBrains` (order 11: think at 4 Hz staggered, attack phases, movement, motor), `pve` (order 80: director queue, corpses, champions, X50 wildlife), `pveBoss` (order 81: boss HUD).
- Enemy actors are hidden from the humanoid renderer (`Render.addActorStyle`) and drawn by the `pve` render source from the row `parts` (instanced shapes of the props batch). The `pveChambers` source draws the puzzle props.
- Per step no allocation: events reuse payload objects (copy what you keep), the damage infos come from the S11 pool.

## Enemy rows (`CAT.enemies`)

`{ id, code, name, role, brain, health, speed, shield, shieldElement, cruise, size, fodder, heavy, leader, beast, boss, target, cash, cost, sight, fov, turn, reaction, keepRange: [min, max], massFactor, flees, takesCover, cloaked, blink, heal, weakPoint, frontShield, group, drop, dropChance, meleeDrop, phases, endlessFrom, attacks, answers, parts, color, glow }`

- `attacks`: `{ id, kind, damage, range: [min, max], tell (s, >= 0.4), cooldown, recover, parry (green tell), unblockable (red tell), shots, gap, spreadDeg, radius, weapon (projectile attacks: a weapon row), splashScale, fanDeg, element, seconds, knockdown, summon, limit, searchSeconds }`; row order = priority. Defaults: `ENEMY_ATTACK_DEFAULTS` (14h).
- Attack kinds (`PveAttacks`): `melee` (one blow in reach and in front; parryable ones fail inside the parry window), `burst` (hitscan shots `gap` apart), `laser` (one exact shot, aim locks 0.3 s before; red beam during the tell), `projectile` (the weapon row's projectile, speed x `projectileSpeed`; `fanDeg` spreads `shots`), `slam` (ground shockwave: jump it), `explode` (bomber blast, also on death if not yet blown), `charge` (locked rush, knockdown on contact; a wall stuns the charger), `pounce` (ballistic leap), `summon` (rows of `summon`, at most `limit` alive).
- Behaviour kinds (`PveBrains`): `melee ranged heavy shielded sniper bomber beast leaper charger` (generic priority brain), `stalker` (cloaked; blinks beside its target after a 0.4 s shimmer), `support` (heals its team in `heal.radius`), `turret` (static; watches the last known place `searchSeconds`, then sweeps), `dummy` (range targets), `boss` (14k).
- `answers`: at least two counters per enemy (shown by UI / codex; the self-test checks the count).
- `parts`: `[shape, x, y, z, sx, sy, sz, tint, aim]` metres at size 1; tint `body | dark | glow | weak | eye`; `aim` 1 = the part pitches with the aim.
- `weakPoint.kind`: `back` (shots travelling along the facing x mult), `air` (x mult while airborne), `core` (boss head: x mult, drains `pool`; an empty pool disables the phase's signature attack for `seconds`). `frontShield`: hits from inside `arcDeg` x `factor`, except while attacking and `lowered` s after.

## Brain (NPC-001..NPC-006)

Priority at each think: flee (broken morale, or `flees` fodder outnumbered x2 within 20 m) > dodge a foe's grenade, mine or rocket within 4 m > cover when hurt below 40% (`takesCover`) > attack (seen target past its reaction time, a free attack token - `rules.botSkill.attackers` attackers per target, the boss exempt - and an attack in range off cooldown) > lure (X50 beasts) > pursue > search (stealth) > mode objective (`Pve.objectiveFor`) > idle (stealth guards patrol their home).

- Attack phases: `WINDUP` (the tell: `pve.tell` event, the body glows in the tell colour, green 0x40ff60 parryable, red 0xff2020 unblockable, orange otherwise) -> `ACTIVE` -> `RECOVER`. A stun (`ACTOR_FLAG.FROZEN`) or stagger cancels the attack.
- Parry: a parryable blow lands on nothing when its target pressed MELEE or ALT within `rules.botSkill.parry` s; the attacker staggers 1.2 s (`pve.parry`).
- Stagger: a hit of >= 25% of max health staggers 1.2 s (not the boss; unstoppable champions only by parries). Melee kills of staggered enemies drop a health pack (finisher); `meleeDrop` on other melee kills; else `drop` with `dropChance x resourceYield`.
- Morale: a `leader` dying breaks the fodder of its team within 20 m for 3..6 s.
- Stealth (`Pve.stealth`, M28, BOT-005): `Pve.awareness[id]` fills while the guard sees a foe (0.6 s near .. 2.5 s at view range, slower for still or crouched targets), decays after 6 s unseen; 0.3 suspicious, 0.6 searching, 1 alert (combat, `pve.alarm`, guards within 15 m alerted). Noises within 60% of their radius make a guard suspicious. A marker above the head shows the state.

## Difficulty (DIF-002, `rules.botSkill`)

`playerDamage` (enemy damage to everybody not an enemy), `enemyDamage` (damage to enemies), `attackers` (tokens), `parry` (window, s), `projectileSpeed`, `resourceYield` (drop chance), `aggression` (wave budgets), `lives` (0 = unlimited; set on every participant at a PvE start), `checkpoints` and `checkpointHeal` (wave retries), `gameSpeed` (through `rules.fx.timeScale`). Guardian Plate: `Pve.guardian[id] = 1` halves enemy damage to that participant.

## Director (NPC-007, NPC-008, PERF-009)

- `Pve.enqueue(key, side, scale, champion, wave)` queues a spawn; `Pve.serveQueue` spawns at most 2 per tick, a whole `group` (swarm) at once, only while `aliveCount + group <= Pve.cap()` (= `Quality.current().enemies`: 40 / 32 / 24 / 18 / 12), and not for 8 s after an intensity peak (damage taken by participants). Points: `Pve.spawnPoints` `{ x, y, z, yaw, side }` filled by the mode; the best is >= 18 m from the hunted players and out of their sight; a side without points uses a reachable nav node away from the players.
- `side`: -1 the co-op enemy side; 0 / 1 a team's PvE (M23) or minions (M29). `Pve.sideTeam(side)` / `Pve.sideHunt(side)` (set by the mode) give the spawned team and the hunted team.
- `scale` multiplies health and damage (endless). Champions (`PVE_CHAMPIONS`): barrier (shield, regenerates unless stunned), unstoppable (x1.3 health, no stagger), overload (health regenerates unless shocked).
- Corpses are removed 3 s after death (actor slots are freed).
- X50 Wildlife: `rules.fx.wildlife` E14 beasts (team -1, hostile to all, preferring whoever hurt them) on random reachable nodes >= 18 m from participants; killed beasts return after 30 s; explosions of `flash` / `incendiary` gadgets or `thermal` element lure beasts within 30 m for 6 s.

## API (`Pve`)

| Call | Does |
|---|---|
| `spawnEnemy(keyOrRow, x, y, z, yaw, { team, side, huntTeam, scale, champion, wave, summoner })` | id or -1 (cap, no slot, unknown key) |
| `enqueue(key, side, scale, champion, wave)` / `pending(side?)` | director queue; `pending` counts swarm members |
| `clearEnemies(filter?)` | frees enemy slots (and the queue when no filter) |
| `aliveCount(side?)` / `hostileCount(side?)` / `countBeasts()` | living enemies / without range targets and beasts / beasts |
| `isEnemy(id)` / `rowOf(id)` / `cap()` / `skill()` | |
| `setCore(x, y, z, health)` / `damageCore(amount, source)` / `core` | the M21 / M22 core (`{ active, x, y, z, health, max, shield }`) |
| `startAttack(id, index, target, now)` / `cancelAttack(id)` / `stagger(id, seconds)` | |
| `awareness[id]`, `awarenessState(id)` | stealth meter 0..1, `AWARENESS` |

Events: `pve.tell { id, attack, kind, seconds, color, target }`, `pve.parry { id, attack, kind, target }`, `pve.alarm { id, target }`, `pve.core { id, kind: 'destroyed' }`, `pve.wave { wave, kind: 'start'|'cleared' }`, `pve.boss { id, phase, phases, kind: 'phase'|'weak' }`, `pve.chamber { chamber, kind: 'enter'|'complete', medal }`. Payloads are reused.

## Boss (E13, 14k)

Phases from `row.phases` (`until` = health share): 1 slam; 2 barrage (green, parryable plasma fan) + slam; 3 summons (E01, E07) + barrage + slam. Crossing a threshold cancels the attack and makes the boss invulnerable for 2 s (`BOSS_TRANSITION_SECONDS`). The head is the core weak point (hit volume scaled by size 2.2). `PveBoss.hud { active, id, name, health (share), phase, phases, weakDisabled }`.

## Modes (14j)

| Mode | Rules |
|---|---|
| M21 `horde` | Core (map objective `core`, else the central spot) with `params.coreHealth`; 10 waves from `PVE_HORDE_WAVES` (budget x aggression x players; wave 5 an unstoppable brute, wave 10 the overlord). Shop open 20 s between waves (`Economy.setShopOpen`), wave bonus by `Economy.awardWave` (flawless when no participant died); buy item `coreShield` adds 1000 core shield. Lost wave (core down or every participant out of lives): retry from the wave start while `params.retries` are left and `checkpoints` is on (core back to its wave-start health, everyone revived and healed to `checkpointHeal`), else defeat. Win after wave 10. |
| M22 `endless` | Same loop; budget 10 + 4 per wave, enemies gated by `endlessFrom`; health and damage x (1 + 0.08 x (wave - 1)) up to x4; a champion brute every 10 waves; after every 5th wave the `extract` zone opens 20 s: a participant inside wins (`extracted`). No retries. |
| M23 `bank` | Each team fights its own PvE side (hostile to all, hunting that team) spawned at its base. Killing your side's enemies carries motes (fodder 1, heavy / leader 3, at most 15, lost on death); touching the team's `bank` objective banks them (team score). Deposits of 5 / 10 / 15 send a gunner / phalanx / brute to the other side; each 50 banked sends a barrier charger (invasion); 100 banked summons the team's overlord at 25% health; the first team to kill its boss wins. |
| M26 `fiends` | Ravager (the player, else the first participant, team 0, `ravagerHealth` / `ravagerArmor`) vs fiends (team 1). Fiends summon fodder every 8 s (4 alive each) and stand up 20 s after falling while a partner lives; rounds end on a team wipe. |
| M28 `contract` | Stealth: guards (E02) at the map's team-1 spawns; take the `relic` objective and reach `extract`. Score = 1000 - 2 / s - 150 / alarm - 50 / kill, + 500 without alarms, + 300 without kills. Defeat when out of lives. |
| M29 `attrition` | Minions (fodder, 15% heavies) per team walk to the enemy base; points: fodder 1, heavy 3, participant 5 (row `scoring.kill`; the behaviour pays the difference for minions). Score limit 300, time 900 s. |
| M30 `range` | Stations on the map's `dummy` hints cycle target / strafer / fire-back with shields 0, 0, 50, 100; killed dummies return after 2 s. Stats: shots, hits, headshots, damage, kills, accuracy. Drill: 10 kills ends the match (score from the drill time). |
| M31 `puzzle` | MP11 Test Chambers: one chamber at a time (`PVE_CHAMBERS`): `lock` none / button (USE within 1.5 m) / plate (the carried cube - USE to lift and drop - on it) / relay (a shot passing within 0.6 m) / all; a fizzle grid returns a carried cube. The exit objective `exitN` completes the chamber when unlocked; medal = the best of gold / silver / bronze whose time, footstep and portal (W42 shots) limits all hold (3 / 2 / 1 stars). The 12th exit wins. |

`Modes.hud.pve` (= `PVE_HUD`): `active mode state ('shop'|'fight'|'extract') stateTimeLeft wave waves (0 = endless) enemiesLeft lives retriesLeft coreHealth coreMax coreShield carried banked[2] alarms awareness relic score chamber chambers chamberTime steps portals parTime ([gold, silver, bronze] s) solved medal stars shots hits headshots damage kills accuracy drillKills drillTargets boss`. Co-op results: `winnerId` = the player (or first participant) on a win, `winner` DRAW and `reason: 'defeat'` on a loss; other reasons `victory`, `extracted`, `drill`, `objective`.
