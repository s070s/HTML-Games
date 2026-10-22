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

Lifecycle: `match.start` -> participants created (`Actors.create`, `Game.playerId`), teams assigned (requested team or the smaller team) and auto-balanced (bots only), objectives built from `World.map.objectives`, spawn points from `World.map.spawns` (filtered by `spawn.modes`), `behaviour.start()`, then everyone spawns (or round 1 starts). System `rules` (order 70) runs respawns, protection, the round system, `behaviour.step`, the leader and time warnings, then `behaviour.isOver`.

- `Modes.register(id, { start, step(dt, now), onKill(victim, killer, event), onScore(id, team, points, reason), onRound(phase), isOver(now), score(index) })` - missing hooks use the deathmatch defaults. `onRound(phase)`: `start` / `live` / `end` / `timeout` (for `timeout` return the round winner). `isOver` returns `NOT_OVER` (-2) or the winner. `score(index)` ranks a competitor (team index in team modes, actor id otherwise).
- `Modes.isPlayable(id)` - a behaviour is registered (core: ffa tdm duel ctf oneflag dom conquest hardpoint control bomb elim lms).
- Winner values: team index in team modes, actor id otherwise, `DRAW` (-1).
- Spawning (contract in ARCHITECTURE.md): `Modes.spawnActor(id)` picks a point (`pickSpawn`): rejects points inside another capsule; prefers points with no enemy within 12 m and no enemy line of sight (`World.lineClear` from the enemy eye) within 25 m (MAP-010); scores far from enemies (cap 60 m), near teammates (team modes), away from the last death, plus 2 m of seeded noise (`Rng.rules`). Team modes use spawns of the actor's side first (`spawn.team` = side; -1 = any); fallback: any free spawn, then the origin. Sets position/yaw, clears velocity and only the flags S13 owns (`PROTECTED`, `FROZEN`; other sections reset theirs on `actor.spawn`), `alive = 1`, `ACTOR_FLAG.PROTECTED` for `rules.respawn.protect` s (cleared by `weapon.fire` or time), emits `actor.spawn { id }`.
- Respawn (`respawnMode` `normal`): bots at death + `delay` (or the next wave); the player on FIRE/JUMP/USE after the delay, or at death + `forced`. Lives: `Modes.lives[id]` (-1 unlimited) drop per death; 0 = out. With `rules.lives` > 0 (and no rounds) the match ends when one competitor is still standing.
- Scoring: `kill` events -> deaths, streaks, kills/assists, suicide (killer < 0 or self) and team-kill points from `rules.scoring`; in kill-scored team modes the team score moves with its members' kill points. `Modes.awardPlayer(id, points, reason)`, `Modes.awardTeam(team, points, reason)`, `Modes.creditObjective(id, reason)` (objective counter + `rules.scoring[reason]`); each emits `score { id, team, points, reason }` (team awards have id -1).
- Limits: score limit (leader's `score`), time limit (`timeLimit` from match start; tie -> sudden death up to 180 s, then draw unless `tiebreak: 'draw'`). Announcements: `announce { text, kind: 'lead'|'time'|'overtime'|'round'|'capture'|'flag'|'bomb'|'objective', priority }`; warnings at 5 min, 1 min, 30 s, 10 s left.
- Rounds: phases `freeze` (actors get `ACTOR_FLAG.FROZEN`) -> `live` (round clock `roundEndsAt`) -> `roundEnd` (`endDelay`) -> next round (side switch after `switchAt`; `Modes.sideOf(team)`, `Modes.attackingTeam()` = side 0). `Modes.endRound(winner, reason)`; first to `winsNeeded`, or after `limit` rounds the side with more wins (else draw). Each round respawns everyone and refreshes lives; survivors of the last round count as dead while the new spawns are chosen, so they never block or unsafe a spawn. Emits `round { round, phase: 'start'|'live'|'end', winner, reason, attackers }` (economy hook).
- Objectives (`Modes.objectives`, MODE-004 finite state): `{ index, id, kind, team, x, y, z, homeX/Y/Z, radius, owner, capturingTeam, progress 0..1, contested, inside[2], active, state: 'home'|'carried'|'dropped'|'planted'|'defused'|'detonated', carrier, droppedAt, timer, holdTime, planter, detonateAt, path }`. Helpers: `findObjectives(kind, out)`, `addObjective(source)`, `zoneHolder(o)`, `countInside(o)`, `inZone(o, id)` (cylinder 1 m below to 3 m above, `radius`), `updateCapture(o, dt, params)` (meter over `captureTime`, x`(1 + (n-1)*captureStack)` up to `captureMax`; enemy progress is undone first; empty/owner zones decay; returns true on capture), `findActorNear(x, y, z, radius, team, NEAR_ANY|NEAR_TEAM|NEAR_ENEMY, buttons?)` (with a `BTN` mask only actors holding one of those buttons count), `zoneContaining(zones, id)`, `findToucher(o, relation)`, `carrierNear(o, x, y, z)`, `pickUp`, `followCarrier`, `drop`, `returnHome`, `returnDue(o, now, seconds)`; carriers drop on death or removal.
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
