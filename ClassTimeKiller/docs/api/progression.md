# Single-player structures and progression (S15) - public API

Files:
- `src/03p-data-progress.js`: numbers and catalogues `medals`, `cards`, `unlocks`, `ladder`, `challenges`, `operations`, plus `PROGRESS_XP`, `PROGRESS_LEVELS`, `MEDAL_RULES`, `MASTERY_TIERS`, `CARD_*`, `OPERATION_*`, `DAILY_RULES`.
- `src/15a-progress.js`: `Progress` (profile, XP, levels, unlocks, stats, match finish, career retries), `RunLog` (per-match metrics of the local player), setting `progress.unlockAll`, the kill-style rules `isAirborne(id)` and `isLongShot(killer, killEvent)` (shared by the run metrics and the medals).
- `src/15b-medals.js`: `Medals` (MD01..MD20 detection, emits `medal`).
- `src/15c-ladder.js`: `Ladder`, `Challenges`, `Operations`, `OperationRun`, `Daily`.
- `src/15d-cards.js`: `Cards` (equip, Marks, unlocks), `CardRun` (the running match).
- `src/18j-ui-progress.js`: screens `career`, `profile`, `ladder`, `challenges`, `operations`, `daily`, `cards`, `cardUse` (pause entry "Cards"), `stats`; the award panel on the results screen; the one-time Firing Range offer.

Tests: group `progress`. Debug: `__CTK.progress` `{ Progress, RunLog, Medals, Ladder, Challenges, Operations, OperationRun, Daily, Cards, CardRun }`.

## Save layout

`Save.data.progression` (`Progress.profile()`), `Save.data.stats` (`Progress.stats()`), `Save.data.ladder` (`Progress.ladder()`). Each accessor migrates on first use: missing or broken fields are filled from `Progress.emptyProfile()` / `emptyStats()` / `emptyLadder()`, kept values stay (`Progress.migrate(data)`). Raise `PROGRESS_VERSION` when the layout changes.

## Match flow

1. A structure builds a `Game.start` setup tagged `setup.progress = { kind, ... }` (`ladder`, `challenge`, `operation`, `daily`); untagged matches only pay XP and stats.
2. On `match.end` `Progress.finishMatch(match)` runs once per match (idempotent; the results screen reads `Progress.lastAward`):
   pre-finishers (Ghost medal) -> `RunLog.measure` -> medals and XP breakdown -> stats -> the tag's handler -> finishers (card Marks and unlocks) -> XP, new unlocks, level-up lines.
3. Extension points: `Progress.addHandler(kind, fn(match, metrics, award))`, `addFinisher(fn)`, `addPreFinisher(fn)`, `addRetry(kind, fn(tag, setup) -> setup)`. `award = { xp, levelBefore, levelAfter, lines, unlocks, breakdown, medals }`.
4. Retry: `Progress.retrySetup(setup)` returns the setup "Play again" starts for a tagged match (null when untagged): a ladder match keeps its tier, match and difficulty; a room its trial; a daily its date seed; an operation plays its current map (a finished one starts a new run). `PlayFlow.playAgain` (18d) uses it; `PlayFlow.nextMap` refuses tagged matches and the results screen hides "Next map" for them.

XP (`Progress.matchXp(results, medalXp)`): score x12 + objectives x30 + medal XP + finish 120 + win 160 (or podium 80) + 35 per minute (max 15). Podium (`Progress.onPodium(results)`, shared with the ladder): top 3 of a free-for-all with more than 3 players; never in duels or team modes. Idle matches and matches under 30 s pay 0. Levels 1..50; the step to the next level is 1000 + 55 x (level - 1). All level unlocks sit at level 30 or below (about 10 hours of typical play).

## Unlocks (no stat changes)

`CAT.unlocks` kinds: `color`, `finish`, `title`, `challenge` (room block), `card`. A row opens by `level`, by `mastery` tier (`MASTERY_TIERS`: kills and headshots with one weapon) or by its card's condition. `Progress.isUnlocked(row)`, `unlocked(kind)`, `setCosmetic(kind, id)`, `cosmetic(kind)`, `title()`. "Unlock everything" (`progress.unlockAll`) opens all. Cosmetics only reach `Render.addActorStyle`; no rule or actor stat reads them. `Progress.look = { color, finish }` holds the worn look as plain numbers (`PROGRESS_NO_LOOK` = none), refreshed by `Progress.refreshLook()` on a cosmetic choice, the `progress.unlockAll` setting, `match.start` and every counted match; the per-frame style reads only these.

## Medals MD01..MD20

Emitted as `medal { id, medal }` for the local player only. Numbers: `MEDAL_RULES`. One kill may pay several different medals (Multi + Spree) but never one medal twice; chains pay Double and Multi once each, a life pays each streak medal once.

## Ladder, Challenge Rooms, Operations, Daily Seed

- `Ladder.start(tier, match, difficultyId?)`, `isOpen`, `setDifficulty`, `state()`, `passed(results)`, `matchCount()` (27). 8 tiers of 3-4 matches; free-for-all needs a podium place, duels and team modes a win; the last match is a duel against B24.
- `Challenges.start(id, expert)`, `starsFor(row, points)`, `record(id)`, `expertOpen(id)`. Points = `Progress.points(row.points, metrics, row.par)`; stars from `row.stars`; Expert opens at 2 stars. The `seconds` metric is the match duration, or the time the player lost their last life under lives rules (`RunLog.outSeconds`), so a player knocked out early stops earning survival points. Every room reaches 3 stars with a flawless run at half of par (self-test). XP only for newly gained stars. Retry: start the same setup again.
- `Operations.start(id)`, `nextSetup(id, seed)`, `state(id)`, `carryTickets(left) = min(120, 60 + floor(0.5 x left))`. Each death costs one ticket; a side at 0 loses the map (`Modes.finish(..., 'tickets')`). The side that lost the previous map gets one heavy bot (`OPERATION_COMEBACK`).
- `Daily.dateKey(ms, offsetMinutes)`, `todayKey()`, `choiceFor(key)`, `setup(key)`, `start()`, `history()`. Seeded by `hashString('daily:' + key)`; picks a playable mode, a ruleset, 2 compatible mutators and a hand-made map from `CAT.maps` (never the editor's saved or generated maps, which differ per device), with a fixed `DAILY_RULES.bots` (5, inside the lowest quality preset's cap), so every device gets the same match. When a `MapGen` section exists, `MapGen.generate({ seed, mode })` is offered as `choice.generated`. Best score per date, at most 60 days kept, no streaks.

## Cards C01..C24

`Cards.equip(id)`, `unequip(id)` (refunds half), `equipProblem(id)`, `marks()`, `addMarks(n)`, `equipped(type)`. 3 active and 2 passive slots; Patron (C17) makes placing free. Cards run in PvE matches, and in versus only with the X48 mutator (`rules.fx.cards`) and only rows with `versus: true`. `setup.cards` overrides the equipped list. Active cards: `CardRun.activate(slotIndex)` (30 s, once per level; Encore twice; Longwick +10 s).

Effects go through existing systems: Twin Fury / Rage are `BUFF.DAMAGE` and Iron Will `BUFF.INVULNERABLE` (S12 Buffs: the strongest live damage buff wins, each keeps its own timer, the actor glows), Fleetfoot / Rapid Hands / Slowtide are speed / rate / slow buffs, Mending and Life Thief heal through `Damage.regenerate`, Stoneskin / Brittle Foes / Last Breath are one `Damage.addReducer`.

`Game.match.rules.cards = { ids, fx }`; `fx` holds the soul cards for the local player (absent keys mean the default). S12 reads them through `soulCardFx(id, key, fallback)` (12a), only for `Game.playerId`:

| Key | Card | Meaning | Read by |
|---|---|---|---|
| `soulLife` | C03 Soulkeep | multiplier: PU18 souls stay `soulLife` x 30 s | `Items.dropSoul` (12a) |
| `soulMagnet` | C11 Soul Magnet | metres: souls home to the player from this far (PU18 and Wrath souls) | `soulHomingRange` (12a), `Meters.stepSoul` (12g) |
| `wrathAt` | C09 Dark Pact | souls Wrath Form costs instead of its row's 66 | `Abilities.canAfford` (12e) |
| `soulHeal` | C20 Soul Feast | multiplier: a soul heals `soulHeal` x its PU18 heal | 15d on `pickup` with `item: 'soul'` |

## Events the PvE section is asked to emit (contract)

| Event | Payload | Read by |
|---|---|---|
| `pve.wave` | `{ wave, phase: 'start' \| 'end' }` | MD20 Flawless Wave |
| `pve.alarm` | `{ id }` | MD19 Ghost (no alarm) |
| `pve.wrath` | `{ id, active }` | optional: a Wrath Form outside the A34 ability (the A34 `ability.cast` / `ability.end` events already count wrath forms and wrath kills; a report of the same form is not counted twice) |
| `pve.boss` | `{ seconds, final }` | card unlocks (boss times) |
| `pve.crate` | `{ id }` | Marks per crate |

`match.results.pve = { enemiesLeft, propsLeft, secretsLeft, optionalLeft }` at the end of a PvE level; missing numbers count as not measured (`PROGRESS_NOT_REACHED`) and never unlock a card. A finished PvE level is a won match whose `rules.family` is not `versus`.
