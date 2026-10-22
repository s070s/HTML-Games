# Single-player structures and progression (S15) - public API

Files:
- `src/03p-data-progress.js`: numbers and catalogues `medals`, `cards`, `unlocks`, `ladder`, `challenges`, `operations`, plus `PROGRESS_XP`, `PROGRESS_LEVELS`, `MEDAL_RULES`, `MASTERY_TIERS`, `CARD_*`, `OPERATION_*`, `DAILY_RULES`.
- `src/15a-progress.js`: `Progress` (profile, XP, levels, unlocks, stats, match finish), `RunLog` (per-match metrics of the local player), setting `progress.unlockAll`.
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
3. Extension points: `Progress.addHandler(kind, fn(match, metrics, award))`, `addFinisher(fn)`, `addPreFinisher(fn)`. `award = { xp, levelBefore, levelAfter, lines, unlocks, breakdown, medals }`.

XP (`Progress.matchXp(results, medalXp)`): score x12 + objectives x30 + medal XP + finish 120 + win 160 (or podium 80 in non-team modes) + 35 per minute (max 15). Idle matches and matches under 30 s pay 0. Levels 1..50; the step to the next level is 1000 + 55 x (level - 1). All level unlocks sit at level 30 or below (about 10 hours of typical play).

## Unlocks (no stat changes)

`CAT.unlocks` kinds: `color`, `finish`, `title`, `challenge` (room block), `card`. A row opens by `level`, by `mastery` tier (`MASTERY_TIERS`: kills and headshots with one weapon) or by its card's condition. `Progress.isUnlocked(row)`, `unlocked(kind)`, `setCosmetic(kind, id)`, `cosmetic(kind)`, `title()`. "Unlock everything" (`progress.unlockAll`) opens all. Cosmetics only reach `Render.addActorStyle`; no rule or actor stat reads them.

## Medals MD01..MD20

Emitted as `medal { id, medal }` for the local player only. Numbers: `MEDAL_RULES`. One kill may pay several different medals (Multi + Spree) but never one medal twice; chains pay Double and Multi once each, a life pays each streak medal once.

## Ladder, Challenge Rooms, Operations, Daily Seed

- `Ladder.start(tier, match, difficultyId?)`, `isOpen`, `setDifficulty`, `state()`. 8 tiers of 3-4 matches; free-for-all needs a podium place, duels and team modes a win; the last match is a duel against B24.
- `Challenges.start(id, expert)`, `starsFor(row, points)`, `record(id)`, `expertOpen(id)`. Points = `Progress.points(row.points, metrics, row.par)`; stars from `row.stars`; Expert opens at 2 stars. XP only for newly gained stars. Retry: start the same setup again.
- `Operations.start(id)`, `state(id)`, `carryTickets(left) = min(120, 60 + floor(0.5 x left))`. Each death costs one ticket; a side at 0 loses the map (`Modes.finish(..., 'tickets')`). The side that lost the previous map gets one heavy bot (`OPERATION_COMEBACK`).
- `Daily.dateKey(ms, offsetMinutes)`, `todayKey()`, `choiceFor(key)`, `setup(key)`, `start()`, `history()`. Seeded by `hashString('daily:' + key)`; picks a playable mode, a ruleset, 2 compatible mutators and a hand-made map. When a `MapGen` section exists, `MapGen.generate({ seed, mode })` is offered as `choice.generated`. Best score per date, at most 60 days kept, no streaks.

## Cards C01..C24

`Cards.equip(id)`, `unequip(id)` (refunds half), `equipProblem(id)`, `marks()`, `addMarks(n)`, `equipped(type)`. 3 active and 2 passive slots; Patron (C17) makes placing free. Cards run in PvE matches, and in versus only with the X48 mutator (`rules.fx.cards`) and only rows with `versus: true`. `setup.cards` overrides the equipped list. Active cards: `CardRun.activate(slotIndex)` (30 s, once per level; Encore twice; Longwick +10 s).

`Game.match.rules.cards = { ids, fx }`. Contract for the PvE section: `fx.soulLife` (seconds souls stay), `fx.wrathAt` (souls needed for wrath), `fx.soulMagnet` (pickup radius in metres), `fx.soulHeal` (HP per soul). Absent keys mean the default.

## Events the PvE section is asked to emit (contract)

| Event | Payload | Read by |
|---|---|---|
| `pve.wave` | `{ wave, phase: 'start' \| 'end' }` | MD20 Flawless Wave |
| `pve.alarm` | `{ id }` | MD19 Ghost (no alarm) |
| `pve.wrath` | `{ id, active }` | card unlocks (wrath forms, wrath kills) |
| `pve.boss` | `{ seconds, final }` | card unlocks (boss times) |
| `pve.secret` | `{ id }` | run metrics |
| `pve.crate` | `{ id }` | Marks per crate |

`match.results.pve = { enemiesLeft, propsLeft, secretsLeft, optionalLeft }` at the end of a PvE level; missing numbers count as not measured (`PROGRESS_NOT_REACHED`) and never unlock a card. A finished PvE level is a won match whose `rules.family` is not `versus`.
