# Rules and modes (S13) - public API

Files: `src/03e-data-rules.js` (catalogue `rulesets`), `src/03f-data-modes.js` (catalogue `modes`), `src/13a-rules.js` (`Rules`), `src/13b-modes.js` (`Modes` framework), `src/13c-modes-core.js` (core versus behaviours). Tests: groups `rules` and `modes`.

## Catalogue `rulesets` (RS01..RS12, spec 6.1)

Ruleset schema (spec section 4) with defaults:

| Field | Default | Meaning |
|---|---|---|
| `id`, `code`, `name` | required | code key (`classic`), catalogue code (`RS01`), display name |
| `move` | `arena` | `CAT.movement` key |
| `health` | `stack` | `CAT.health` key |
| `economy` | `pickups` | `CAT.economy` key |
| `precision` | `arena` | `arena` / `standard` / `tactical` / `hero` |
| `weaponSet` | `arenaSet` | `CAT.weaponSets` key (`''` = loadout per hero/class) |
| `meter` | `none` | `none` / `streak` / `boost` / `adrenaline` / `ultimate` / `energy` |
| `friendlyFire` `selfDamage` `knockback` `gravityScale` | 0, 0.5, 1, 1 | factors |
| `respawn` | `{ delay: 2, forced: 10, protect: 2, wave: 0 }` | seconds; `wave` > 0 aligns respawns to waves counted from match start |
| `lives` | 0 | 0 = unlimited |
| `itemRespawnScale` `weaponStay` `dropOnDeath` | 1, false, `held` | `dropOnDeath`: `none` / `held` / `all` |
| `mutators` | `[]` | `{ id, value }` entries |
| `moveOverrides` | `{}` | fields laid over the movement preset row (RS02: `{ extraJumps: 1, wallDodge: true }`) |

`RULESET_ROWS` holds the raw rows: a bundle applies **only the fields its row writes**.

## Catalogue `modes` (M01..M30, spec 13)

| Field | Default | Meaning |
|---|---|---|
| `id`, `code`, `name` | required | `ffa`, `M01`, `Frenzy` |
| `teams` | 0 | 0 free-for-all, 1 one side (PvE), 2 two teams |
| `sizeDefault` | 8 | total participants (player + bots) |
| `scoreLimit`, `timeLimit` | 0, 600 | 0 = none; seconds |
| `scoreBy` | `kills` | `kills` / `objective` / `tickets` / `rounds` / `survival` / `pve` |
| `rounds` | null | `{ winsNeeded, limit, live, freeze, switchAt, endDelay }` (seconds; `live` 0 = no round clock; `switchAt` 0 = no side switch) |
| `respawn` | `normal` | `normal` (ruleset timers) / `round` (only at round start) / `none` |
| `rules` | `{}` | ruleset defaults applied at the mode stage (a bundle that writes the same field wins) |
| `objective` | `none` | map objective kind the mode creates (`flag` also creates `flagBase`) |
| `params` | `{}` | numbers for the behaviour (`captureTime`, `returnTime`, `plantTime`, ...); `params.economy` names an economy the mode brings itself (gungame `ladder`, horde `waveShop`) and wins over `rules.economy`; `params.activePlayers` limits who plays (duel), the rest queue; `params.spawnAtOwned` makes owned points spawn points |
| `scoring` | `{}` | merged over `MODE_SCORING` = `{ kill: 1, suicide: -1, teamKill: -1, capture: 5, return: 1, plant: 2, defuse: 2, hold: 1 }` (scoreboard points per actor) |
| `tiebreak` | `suddenDeath` | `suddenDeath` (MODE-001: play on until a lead, max 180 s, then draw) / `draw` |
| `ruleset` | `classic` | default bundle |
| `family` | `versus` | `versus` / `pve` / `solo` |

## Rules (`src/13a-rules.js`)

- `Rules.build(setup)` -> deep-frozen ruleset. Runs on `match.setup` and stores it in `Game.match.rules`. Order (MOV-001): `mode` -> `bundle` -> `mutators` -> `difficulty` -> `handicap`. Each stage runs its built-in step, then its modifiers.
  - `mode`: schema defaults, then the mode row (`mode`, `teams`, `sizeDefault`, `scoreLimit`, `timeLimit`, `scoreBy`, `rounds`, `objective`, `params`, `tiebreak`, `family`, `respawnMode`, `scoring`), then `setup.modeOptions` (custom match: any of those fields; objects merge one level deep), then the row's `rules`.
  - `bundle`: `setup.ruleset` = a bundle id, a custom ruleset id (`custom-N`) or a ruleset object; default = the mode's `ruleset`. Unknown fields and ids are reported.
  - `mutators`: `rules.mutators` = bundle mutators + `setup.mutators` (strings or `{ id, value }`), normalized to `{ id, value }`.
  - `difficulty`: `rules.difficulty` = `setup.difficulty` or `regular`.
  - `handicap`: `rules.handicap = { player, bots: [] }` (setup order, clamped 0.25..1, X22).
- `Rules.addModifier(stage, fn(rules, setup))` / `Rules.removeModifier(stage, fn)`: later sections (mutators S13 later batch, difficulty) change the ruleset in their stage; a modifier sees every earlier stage's values.
- Validation after the build: mode exists; `move`/`health`/`economy`/`weaponSet` exist **when** `CAT.movement`/`CAT.health`/`CAT.economy`/`CAT.weaponSets` exist; `precision`, `meter`, `dropOnDeath` are known values. Problems go to `Rules.problems` and `ErrorLog`.
- `Rules.stagesRun` lists the stages of the last build in order.
- `Rules.custom` (MOV-002, `Save.data.rulesets`, max 50): `list()`, `get(id)`, `save(ruleset)` -> stored copy of known ruleset fields with id `custom-N` (same id = replace) or `null` with `lastError`, `remove(id)`.

## Modes (`src/13b-modes.js`)

Setup fields read: `setup.player = { team, name, profile, handicap }` (absent = spectate/headless), `setup.bots = [{ profile, team, tier, name, handicap, dummy }]` (`dummy: true` creates an `ACTOR_KIND.DUMMY`; no auto-fill: the UI passes `Modes.defaultBots(modeId, withPlayer)` to fill every slot, MODE-002), capped by `Quality.current().bots` (PERF-009). A match with no participants leaves the framework passive.

Lifecycle: `match.start` -> participants created (`Actors.create`, `Game.playerId`), teams assigned (requested team or the smaller team) and auto-balanced (bots only), objectives built from `World.map.objectives` (`buildObjectives`: entries of the mode's `objective` kind and its companion whose `modes` list is empty or names the mode, the same `mapServesMode` filter spawns and items use, so a map's CTF flags do not appear in One Flag), spawn points from `World.map.spawns` (filtered by `spawn.modes`), `behaviour.start()`, then everyone spawns (or round 1 starts). System `rules` (order 70) runs respawns, protection, the round system, `behaviour.step`, the leader and time warnings, then `behaviour.isOver`.

- `Modes.register(id, { start, step(dt, now), onKill(victim, killer, event), onScore(id, team, points, reason), onRound(phase), isOver(now), score(index) })` - missing hooks use the deathmatch defaults. `onRound(phase)`: `start` / `live` / `end` / `timeout` (for `timeout` return the round winner). `isOver` returns `NOT_OVER` (-2) or the winner. `score(index)` ranks a competitor (team index in team modes, actor id otherwise).
- `Modes.isPlayable(id)` - a behaviour is registered (core: ffa tdm duel ctf oneflag dom conquest hardpoint control bomb elim lms).
- Winner values: team index in team modes, actor id otherwise, `DRAW` (-1).
- Spawning (contract in ARCHITECTURE.md): `Modes.spawnActor(id)` picks a point (`pickSpawn`): rejects points inside another capsule; prefers points with no enemy within 12 m and no enemy line of sight (`World.lineClear` from the enemy eye) within 25 m (MAP-010); scores far from enemies (cap 60 m), near teammates (team modes), away from the last death, plus 2 m of seeded noise (`Rng.rules`). Team modes use spawns of the actor's side first (`spawn.team` = side; -1 = any); fallback: any free spawn, then the origin. Sets position/yaw, clears velocity and only the flags S13 owns (`PROTECTED`, `FROZEN`; other sections reset theirs on `actor.spawn`), `alive = 1`, `ACTOR_FLAG.PROTECTED` for `rules.respawn.protect` s (cleared by `weapon.fire` or time), emits `actor.spawn { id }`.
- Respawn (`respawnMode` `normal`): bots at death + `delay` (or the next wave); the player on FIRE/JUMP/USE after the delay, or at death + `forced`. Lives: `Modes.lives[id]` (-1 unlimited) drop per death; 0 = out. With `rules.lives` > 0 (and no rounds) the match ends when one competitor is still standing.
- Scoring: `kill` events -> deaths, streaks, kills/assists, suicide (killer < 0 or self) and team-kill points from `rules.scoring`; in kill-scored team modes the team score moves with its members' kill points. `Modes.awardPlayer(id, points, reason)`, `Modes.awardTeam(team, points, reason)`, `Modes.creditObjective(id, reason)` (objective counter + `rules.scoring[reason]`); each emits `score { id, team, points, reason }` (team awards have id -1).
- Limits: score limit (leader's `score`), time limit (`timeLimit` + `Modes.timeBonus` from match start; `timeBonus` = seconds a behaviour added, such as payload checkpoints, reset per match and included in the HUD clock; tie -> sudden death up to 180 s, then draw unless `tiebreak: 'draw'`). Announcements: `announce { text, kind: 'lead'|'time'|'overtime'|'round'|'capture'|'flag'|'bomb'|'objective', priority }`; warnings at 5 min, 1 min, 30 s, 10 s left.
- Rounds: phases `freeze` (actors get `ACTOR_FLAG.FROZEN`) -> `live` (round clock `roundEndsAt`) -> `roundEnd` (`endDelay`) -> next round (side switch after `switchAt`; `Modes.sideOf(team)`, `Modes.attackingTeam()` = side 0). `Modes.endRound(winner, reason)`; first to `winsNeeded`, or after `limit` rounds the side with more wins (else draw). Each round respawns everyone and refreshes lives; survivors of the last round count as dead while the new spawns are chosen, so they never block or unsafe a spawn. Emits `round { round, phase: 'start'|'live'|'end', winner, reason, attackers }` (economy hook).
- Objectives (`Modes.objectives`, MODE-004 finite state): `{ index, id, kind, team, x, y, z, homeX/Y/Z, radius, owner, capturingTeam, progress 0..1, contested, inside[2], active, state: 'home'|'carried'|'dropped'|'planted'|'defused'|'detonated', carrier, droppedAt, timer, holdTime, planter, detonateAt, path, stage, checkpoints, goals }` (`stage` and `checkpoints` come from the map entry: rush relay stage, payload checkpoint path indices; `goals` = the bot goal hints a behaviour sets, else null). Helpers: `findObjectives(kind, out)`, `addObjective(source)`, `zoneHolder(o)`, `countInside(o)`, `inZone(o, id)` (cylinder 1 m below to 3 m above, `radius`), `updateCapture(o, dt, params)` (meter over `captureTime`, x`(1 + (n-1)*captureStack)` up to `captureMax`; enemy progress is undone first; empty/owner zones decay; returns true on capture), `findActorNear(x, y, z, radius, team, NEAR_ANY|NEAR_TEAM|NEAR_ENEMY, buttons?, skipFlags?)` (with a `BTN` mask only actors holding one of those buttons count; actors with any `ACTOR_FLAG` in `skipFlags` are passed over: the relic and the flame skip `PROTECTED`, so a spawn-protected actor neither takes the prize nor blocks another actor on it), `zoneContaining(zones, id)`, `findToucher(o, relation, skipFlags?)`, `carrierNear(o, x, y, z)`, `pickUp`, `followCarrier`, `drop`, `returnHome`, `returnDue(o, now, seconds)`; carriers drop on death or removal.
- Charge timers (bomb, ghostops, rush; params `plantTime fuse defuseTime defuseCheckpoint defuseRange blastRadius`): `objective.timer` holds the hold-USE progress. `stepPlant(charge, sites, dt, params)` - the carrier holding USE inside a site for `plantTime` plants (returns true). `plantCharge(charge, id, fuse)` - plants in place (rush arms a relay this way): `state 'planted'`, `planter`, `detonateAt`; in a live round the fuse replaces the round clock (timeout reason `detonated`); credit `plant`. `stepDefuse(charge, team, dt, params)` - any living `team` member holding USE within `defuseRange` defuses in `defuseTime`; an interruption keeps `defuseCheckpoint` s once passed (0 = start over); credit `defuse`; returns the defuser or -1. `detonateCharge(charge, radius)` emits `explosion { source: 'bomb', radius, owner: planter }`. `advanceUse(o, using, dt, seconds, checkpoint)` is the shared timer step.
- `Modes.hudState()` - one reused object: `active mode phase timeLeft overtime round roundsToWin scoreLimit teams leader leaderScore playerId playerScore playerRank (non-team modes rank by `behaviour.score`, like the leader; team modes by personal score) playerLives respawnIn (-1 none coming) attackers teamScores teamRounds teamMeter objectives zoneX zoneZ zoneRadius` (the arrays are live references).
- `Game.match.results` (set before `match.end`): `{ mode, ruleset, winner, draw, reason: 'score'|'time'|'overtime'|'draw'|'eliminated'|'rounds'|'tickets', winnerTeam, winnerId, duration, rounds, players: [{ id, name, kind, team, kills, deaths, assists, suicides, score, objective, bestStreak, lives, queued }] (sorted), teams: [{ team, name, score, rounds, kills, deaths, objective }], queue: [names] (duel winner-stays) }`.
- `Game.match.handicap` - `Float32Array(MAX_ACTORS)` damage-dealt factor per actor id (X22), for S11.
- Markers: `Render.addSource('objectives', ...)` draws zones as rings (owner colour) and carriables (above the carrier when carried).
- Per-actor stats: `Modes.kills deaths assists suicides score objective streak bestStreak lives participant queued` (typed arrays by actor id).

## Core behaviours (`src/13c-modes-core.js`)

| Mode | Rules implemented |
|---|---|
| `ffa`, `tdm`, `duel` | defaults: frag/score and time limits, sudden death; duel: 2 active players, others queued, no frag limit |
| `lms` | 3 lives; ranked by lives left, then score |
| `ctf` | touch the enemy flag to take it; capture at your own flag while it is home; dropped flags return after `returnTime` s or on a teammate's touch |
| `oneflag` | neutral flag, deliver to the enemy `flagBase` |
| `dom` | `updateCapture` per point; +`tickPoints` per held point every `tickInterval` s |
| `conquest` | team score = tickets (`params.tickets`), -`deathCost` per death, bleed 1 per `bleedInterval` s for a team holding fewer points than the other team AND <= `bleedHeld` points (decision: nobody bleeds at 0-0 or on equal holdings); 0 tickets loses; owned points are spawn points |
| `hardpoint` | hills active in map order, moving every `moveInterval` s; `holdRate` points/s to the team alone in it |
| `control` | capture the point, then the owner's `teamMeter` fills over `progressTime` s while they own it; with an enemy on the point it stops at `overtimeAt` (99%) and `Modes.overtime` is set; 100% with no enemy inside wins the round (best of 3); round timeout -> higher meter |
| `bomb` | built on the framework charge timers; side 0 attacks; a random attacker carries the charge (attackers pick a dropped one up by touch); USE held `plantTime` s inside a bombsite plants (credit `plant`); the fuse (`fuse` s) replaces the round clock; any defender holding USE within `defuseRange` defuses in `defuseTime` (an interrupted defuse keeps `defuseCheckpoint` s once passed); detonation emits `explosion { source: 'bomb', radius: blastRadius }`; wipes end the round (attackers dead after the plant do not); round timeout without a plant goes to the defenders |
| `elim` | one life per round; team wipe wins; timeout -> side with more alive; last `shrinkTime` s: safe area from the map half-diagonal to `shrinkMinRadius`, outside actors get `damage.request { kind: 'hazard', amount: zoneDamage }` once per second |

## Events

Emitted: `actor.spawn`, `score`, `announce`, `round` (new), `explosion` (bomb), `damage.request` (elim safe area). Consumed: `match.setup`, `match.start`, `match.stop`, `actor.create`, `actor.remove`, `kill`, `weapon.fire`.

## Expectations on other sections

- S10 movement: hold actors with `ACTOR_FLAG.FROZEN` still; apply `rules.moveOverrides` over the movement preset.
- S11 damage: ignore damage to `ACTOR_FLAG.PROTECTED` actors; read `Game.match.handicap[id]`; set `alive = 0` before emitting `kill`.
- S12 economy (later): listen to `round` and `score` (`plant`, `kill`); use `rules.params.economy` when set.

## Add-on versus modes (`src/13e-modes-objective.js`, `src/13f-modes-party.js`, `src/13g-modes-royale.js`, tests: group `modes2`)

Each mode is a behaviour registered with `Modes.register` on the framework above; numbers are the mode row's `params` (all editable through `setup.modeOptions`, MODE-001).

### Shared add-on surface (13e)

- `ACTOR_ROLE` = `{ NONE, CARRIER, COLOSSUS, CURSED, INFECTED, BEARER, GHOST }`, names in `ACTOR_ROLE_NAMES` (`'' carrier colossus cursed infected bearer ghost`). `Modes.actorRole[id]` (Uint8Array) is the actor's role in the running mode; `Modes.setRole(id, role)` sets it (and `hud.role` for the player). Colossus and cursed actors get a marker sphere above the head (render source `modeExtras`, which also draws the convoy cart).
- Bot goal hints (BOT-080): `objective.goals` = two strings. Team modes index them by side (0 attackers, 1 defenders); free-for-all modes hold `[goal of the actor with the mode's role, goal of everyone else]`. `Modes.goalFor(objective, id)` -> `'arm' | 'defend' | 'guard' | 'disarm' | 'escort' | 'stop' | 'hold' | 'take' | 'reach' | ''` ('' = nothing to do there; inactive objectives give '').
- Extra behaviour hooks (called only while `Modes.active`): `onSpawn(id)` after every `actor.spawn` (after S11 gave health and the start loadout, so a mode can override them), `onDamage(event)` on every `damage` event, `onFire(shot)` on `weapon.fire`, `onJump(event)` on `move.jump`.
- `Modes.meleeHit[id]` = 1 when the last damage the actor took had `kind: 'melee'` (melee kills: the `damage` event comes before the `kill` event).
- Helpers: `holdLoadout(id, keys)` (drawing anything not in `keys` - a pickup, a buy - sets the loadout again), `meleeWeaponKey()` (the melee weapon of the weapon set's start loadout, else `maul`), `setVitality(id, health)` (health and its cap), `centralSpot(out)` (the spawn point nearest the world centre), `makePrizeBehaviour(prizeId, role, meleeParam, label)` (a carriable that scores per second held: relic and flame; a spawn-protected actor cannot take it).
- Framework parts the add-on modes use (documented under Modes above): `Modes.timeBonus`, the objective fields `stage`, `checkpoints` and `goals`, `findActorNear`'s `skipFlags`. A carried carriable is not drawn while its carrier has `ACTOR_FLAG.INVISIBLE` (the cloaked Ghost Ops charge carrier). Ghost Ops clears `INVISIBLE` only on actors it cloaked itself, so an ability's cloak (S12) is never ended by the mode.
- Shared helpers in 13c: `randomAliveMember(team, except)` (a random living participant on `team`, `NO_TEAM` = any team, other than `except`, with `Rng.rules`; -1 none), `worldSafeArea(out)` (writes the world centre `x`/`z` and half-diagonal `radius` into `out`, `SAFE_AREA_FALLBACK_RADIUS` 50 without bounds; used by `elim`, the royale ring and `centralSpot`).

### Rules

| Mode | Rules implemented |
|---|---|
| `rush` (M08) | side 0 attacks with `tickets` (75; -1 per attacker death, reason `death`), defenders unlimited. Relays = the map's `bombsite` objectives grouped by `stage` (else `perStage` per stage in map order, at most `stages`); only the open stage is `active`. An attacker holding USE inside a relay zone for `plantTime` arms it (`plantCharge`, credit `plant`); the `fuse` then runs; a defender holding USE within `defuseRange` for `defuseTime` disarms it (`defuseCheckpoint` 0: an interruption starts over) and the relay can be armed again; detonation (`explosion { source: 'bomb' }`) destroys it. Both relays of a stage destroyed open the next stage (`announce 'Stage N'`); the last stage destroyed wins (`objective`, no further stage is announced and `hud.stage` stays on the last). At 0 tickets with no relay armed the defenders win (`tickets`); a custom time limit makes a timeout a defender win (`time`). Score = relays destroyed (attackers). |
| `oddball` (M10) | one `relic` (the map's, else at the most central spawn); touching it picks it up (not while spawn-protected) (role `carrier`, melee only while `carrierMeleeOnly`); the carrier earns `scoring.hold` (1) every `1/holdRate` s; it drops on death and returns home after `returnTime` (30) s on the ground. Kills score 0 (`scoring` kill/suicide/teamKill 0); first to `scoreLimit` (100). |
| `payload` (M11) | side 0 escorts the map's `payloadPath` objective (the cart; `x/y/z` follow `path`). With attackers inside its zone and no defender it moves `speed` (1.2) m/s, +`pushStack` (0.25) per extra attacker up to `maxSpeed` (1.8); attackers and defenders both near = contested (it stops, no rollback). After `rollbackAfter` (10) s without an attacker it rolls back at `rollbackSpeed` (0.5) m/s, never behind the last checkpoint. `checkpoints` = path indices (else `checkpoints` evenly spaced; the path end is always the last one). A map without a `payloadPath` falls back to the standard limits with nothing kept from an earlier convoy. Each checkpoint: team score +1 (`checkpoint`), `capture` credit for the pushers, and before the end `checkpointTime` (120) s more on the clock (`Modes.timeBonus`). The end wins (`objective`). At the time limit an attacker at the cart means overtime (`Modes.overtime`, at most 180 s); otherwise the defenders win (`time` / `overtime`). |
| `ghostops` (M27) | the `bomb` behaviour of 13c (rounds, charge, plant, fuse, defuse) plus: attackers (role `ghost`) spawn with `attackerLoadout` (`tanto` + `warden`) and are held to it; they carry `ACTOR_FLAG.INVISIBLE` while still (horizontal and vertical speed <= `stillSpeed` 0.5 m/s, `cloakWhenStill`) except for `revealTime` (1) s after firing; the charge they carry is hidden with them. Footsteps are untouched (S06 still plays them). Goals: the sites hold `arm` / `defend` until the plant, then the charge holds `guard` / `disarm`. |
| `gungame` (M16) | `params.ladder` (18 keys; the last is the melee weapon); `params.tiers` (18) plays the first `tiers - 1` weapons plus the melee tier (`ladderTiers(params)`, `behaviour.ladder`). Loadout per tier: melee weapon + the tier weapon (drawn), held. A kill of an enemy climbs one tier (score +1, reason `advance`); a melee kill also drops the victim one tier (`meleeDemotes`, score -1, reason `demote`, never below tier 1); on the last tier only a melee kill counts and it wins (`score`). Time limit: the highest tier wins, a tie goes to sudden death. `behaviour.score(id)` = tier index. |
| `infection` (M17) | everyone starts on team 0 (humans). At `infectAfter` (20) s, `max(1, floor(players / infectedPerPlayers))` random humans become infected (team 1, role `infected`, `infectedHealth` 300 HP, melee only; a jump adds a leap impulse of `leapSpeed` 8 m/s forward + `leapLift` 3 m/s up). Any damage by an infected turns a human at once (the hit never kills; +1 `infect` for the infected); a human who dies respawns infected. Team scores = head counts (humans, infected). No humans left = infected win (`eliminated`); humans standing at the time limit win (`time`). No leader announcements. |
| `juggernaut` (M18) | the first kill makes the killer the Colossus (role `colossus`, `maxHealth x healthMult` 3 at full health, damage x `damageMult` 1.5 through `Damage.addAttackerScale`, marker); whoever kills the Colossus becomes it (a world or self kill leaves the role empty until the next kill). A killer already dead when credited (a late rocket) gets the role at once and the health on respawn (`onSpawn` re-applies it after every respawn of the Colossus). Only kills as the Colossus score (1 each); first to `scoreLimit` (15). |
| `cursetag` (M19) | a random actor is cursed (role `cursed`, `cursedHealth` 50 HP, no armor or shield, melee only while `meleeOnly`); killing the cursed scores 1 (other kills 0); the cursed stays cursed after respawning. The curse passes by reaching the `beacon` objective (radius `beaconRadius` 2, starts at the most central spawn; passes to a random other standing actor, then moves to the spawn point farthest from the new cursed; a spawn-protected cursed actor cannot use it). `passOnTag` (default false, for custom matches) also passes it by a melee hit (to the actor hit, who lives on with 50 HP). The one freed gets full health and the start loadout. |
| `bearer` (M24) | the prize rules of `oddball` with one `relic` objective with id `flame` at the most central spawn: the holder (role `bearer`) keeps its weapons, scores `holdRate` (1) per second plus 1 per kill, and hits x `damageMult` (3) (a never-expiring Fury Core, PU19); first to `scoreLimit` (120). |
| `roulette` (M25) | everyone carries the same single weapon, drawn with `Rng.rules` from the weapon set (no melee, tool or power class) every `rotateEvery` (30) s, never the same twice in a row (`announce 'Weapon: <name>'`), held; `infiniteAmmo` keeps the drawn weapon's reserve (and alt rounds) full. Kills to `scoreLimit` (25). `params.pickups: false` asks the items section to place no pickups. |
| `royale` (M20) | free for all, `respawn: 'none'`, RS10 bundle (agile, HPP06 `loot`, `lootSet` with rarity). Ring (`Modes.ring`): starts at the world centre with the half-diagonal of the world bounds; phase p waits `ringWait[p]` s, then shrinks over `ringShrink[p]` s to `ringScale[p]` x the start radius while the centre drifts to a random point (`Rng.rules`) that keeps the new circle inside the old one and the centre on the map; after the last phase it stays `closed`. Actors outside get `damage.request { kind: 'hazard', amount: ringDamage[p] }` once per second. Loot (`Modes.loot`): one spot per map item of group `weapon armor health ammo` (items whose `modes` exclude the mode are skipped), rarity rolled with `Rng.loot` by `rarityWeights` (common .. legendary, WPN-008); spots are touched at 10 Hz: a weapon spot gives its weapon (or a random gun of the set) with that rarity (`Weapons.give(id, key, rarity)`), with a full inventory only while USE is held, and the weapon pushed out (`Weapons.dropped`) stays on the spot with its own rarity (`Weapons.droppedRarity`; one swap per second); a copy of an owned gun is taken only when `give` adds ammo (or makes a pair), and the owned gun keeps the better of the two rarities; armor sets shield and max shield to `shieldByRarity[rarity]` (50/75/100/125/125) when that beats the current shield; health heals `lootHeal` (50) up to max; ammo adds pickup ammo for the drawn weapon. The last one standing wins (`eliminated`; nobody standing = draw). `behaviour.score(id)`: standing actors 1000 + kills, others by the order they went out. The bot count is the framework's PERF-009 cap. Render source `royale` draws the ring, the next circle and the loot boxes in rarity colours. |

### HUD fields (`Modes.hudState()` adds)

`role` (the player's role name), `special` (actor id of the relic carrier / flame bearer / Colossus / cursed, -1 none), `ladderTier` (the player's tier, 1-based) and `ladderTiers`, `weapon` (roulette weapon key) and `rotateIn` (s), `stage` / `stages` (rush), `payloadProgress` (0..1), `payloadCheckpoint` (reached) / `payloadCheckpoints`, `payloadState` (`idle moving contested rollback`), `survivors` / `infected`, `ringPhase` (1-based) / `ringPhases`, `ringState` (`wait shrink closed`), `ringTimeLeft` (s to the next ring change), `ringDamage` (HP/s outside), `ringNextX/Z/Radius`, `aliveCount` (royale); royale also writes the framework's `zoneX zoneZ zoneRadius` (the current ring). `teamScores` hold the rush tickets (attackers), payload checkpoints and the infection head counts. `timeLeft` includes `Modes.timeBonus`.

### What bots read

`Modes.objectives` with `goals` (rush relays, the convoy cart, Ghost Ops sites and planted charge, relic, flame, beacon), `Modes.actorRole` (carrier, Colossus, cursed, infected, ghosts), `Modes.ring` `{ phase, phases, state, x, z, radius, toX, toZ, toRadius, changeAt, damage }`, `Modes.loot` `{ count, x, y, z, group (0 weapon, 1 armor, 2 health, 3 ammo), weapon (CAT.weapons index), rarity, taken }` (typed arrays).

### Events

Emitted: `score` with the new reasons `advance demote infect checkpoint death hold`; `announce` (kind `objective`: stages, checkpoints, prize pickups, Colossus, curse, weapon rotation, ring closing); `impulse` (infected leap); `damage.request` (ring); `explosion` (rush relays). Consumed: `actor.spawn damage weapon.fire move.jump match.setup match.stop actor.create`.

### Not built yet

Royale squads (`squadSize`, the downed state with revive and `squadBeacons` respawn beacons; the framework scores at most two teams) and the drop-in start (actors start on the island's spawn points). Royale heals are direct (the I13-I17 consumables belong to the S12 items).
