# Single-player structures and progression (S15) - public API

Files:
- `src/03p-data-progress.js`: numbers and catalogues `medals`, `cards`, `unlocks`, `ladder`, `challenges`, `operations`, plus `PROGRESS_XP`, `PROGRESS_LEVELS`, `MEDAL_RULES`, `MASTERY_TIERS`, `CARD_*`, `OPERATION_*`, `DAILY_RULES`.
- `src/15a-progress.js`: `Progress` (profile, XP, levels, unlocks, stats, match finish, career retries), `RunLog` (per-match metrics of the local player), setting `progress.unlockAll`, the kill-style rules `isAirborne(id)` and `isLongShot(killer, killEvent)` (shared by the run metrics and the medals).
- `src/15b-medals.js`: `Medals` (MD01..MD20 detection, emits `medal`).
- `src/15c-ladder.js`: `Ladder`, `Challenges`, `Operations`, `OperationRun`, `Daily`.
- `src/15d-cards.js`: `Cards` (equip, Marks, unlocks), `CardRun` (the running match).
- `src/18j-ui-progress.js`: screens `career`, `profile`, `ladder`, `challenges`, `operations`, `daily`, `cards`, `cardUse` (pause entry "Cards" while the match has active cards; the `cards` action - Y, pad Home, the touch CARD button - opens it during play), `stats`; the career hub's `Solo` button, which opens the Solo screen (18o) where the PvE modes live; Range on the main menu (`ui.range`); the award panel on the results screen; the one-time Firing Range offer.

Tests: groups `progress` and `simwire` (PvE events, chamber records). Debug: `__CTK.progress` `{ Progress, RunLog, Medals, Ladder, Challenges, Operations, OperationRun, Daily, Cards, CardRun }`.

## Save layout

`Save.data.progression` (`Progress.profile()`), `Save.data.stats` (`Progress.stats()`: `weapons`, `modes` by mode id, `maps` by map id or `generated` / `custom` / `none`, `totals`), `Save.data.ladder` (`Progress.ladder()`). Each accessor migrates on first use: missing or broken fields are filled from `Progress.emptyProfile()` / `emptyStats()` / `emptyLadder()`, kept values stay (`Progress.migrate(data)`). Raise `PROGRESS_VERSION` when the layout changes.

## Match flow

1. A structure builds a `Game.start` setup tagged `setup.progress = { kind, ... }` (`ladder`, `challenge`, `operation`, `daily`); untagged matches only pay XP and stats.
2. On `match.end` `Progress.finishMatch(match)` runs once per match (idempotent; the results screen reads `Progress.lastAward`):
   pre-finishers (Ghost medal) -> `RunLog.measure` -> medals and XP breakdown -> stats -> the tag's handler -> finishers (card Marks and unlocks) -> XP, new unlocks, level-up lines.
3. Extension points: `Progress.addHandler(kind, fn(match, metrics, award))`, `addFinisher(fn)`, `addPreFinisher(fn)`, `addRetry(kind, fn(tag, setup) -> setup, label?)` (`label` names a retry that moves on instead of replaying, shown only when there is no next step), `addNext(kind, fn(tag) -> { label, build() } | null)`. `award = { xp, levelBefore, levelAfter, lines, unlocks, breakdown, medals }`.
4. Retry: `Progress.retrySetup(setup)` returns the setup "Play again" starts for a tagged match (null when untagged): a ladder match keeps its tier, match and difficulty; a room its trial; a daily its date seed; an operation moves on after every map, so its retry builds the next map (a finished one starts a new run). `PlayFlow.playAgain` (18d) uses it; `PlayFlow.nextMap` refuses tagged matches and the results screen hides "Next map" for them. `Progress.nextStep(setup)` gives a career's next step `{ label, build() }` after a pass (ladder "Next match", operation "Next map"; null when lost or nothing is left), the primary results button. `Progress.replayLabel(setup, outcome)` names the other button: "Retry" after a lost career match that replays itself, "Play again" otherwise, the retry's own label (operation "New run") only when there is no next step, else '' (no second button). After an operation map the screen offers no Retry or Play again.

XP (`Progress.matchXp(results, medalXp, difficulty)`): score x12 + objectives x30 + medal XP + finish 120 + win 160 (or podium 80) + 35 per minute (max 15), everything x the difficulty's factor (`PROGRESS_XP_DIFFICULTY`, 0.5 Stroll .. 1.5 Nightmare; an unlisted difficulty pays x1). Finish, win and podium pay in full from `PROGRESS_XP.bonusMinutes` (5) minutes played and a share of that before. Podium (`Progress.onPodium(results)`, shared with the ladder): top 3 of a free-for-all with more than 3 players; never in duels or team modes. Matches under 30 s and matches where the player took part in nothing (no score, objective, kill, assist or damage dealt) pay 0; `Progress.xpReason(results)` gives the line shown for those ('' when XP is paid). Levels 1..50; the step to the next level is 1000 + 55 x (level - 1). All level unlocks sit at level 30 or below (about 10 hours of typical play).

## Unlocks (no stat changes)

`CAT.unlocks` kinds: `color`, `finish`, `title`, `challenge` (room block), `card`. A row opens by `level`, by `mastery` tier (`MASTERY_TIERS`: kills and headshots with one weapon; each tier row carries its `reward`, and the mastery unlock rows are built from it) or by its card's condition. `Progress.isUnlocked(row)`, `unlocked(kind)`, `setCosmetic(kind, id)`, `cosmetic(kind)`, `title()`. "Unlock everything" (`progress.unlockAll`) opens all. Cosmetics only reach what is drawn, never a rule or an actor stat: the body through `Render.addActorStyle`, and where no body is drawn `Progress.bodyColor(id, fallback)` (the worn colour for the local player, else `fallback`): the held weapon (15a wraps the S11 `Render.viewModel` hook), the player's scoreboard row (18e) and killcam figure (17e). The Profile screen shows a swatch of the worn colour with the finish as its glow. `Progress.look = { color, finish }` holds the worn look as plain numbers (`PROGRESS_NO_LOOK` = none), refreshed by `Progress.refreshLook()` on a cosmetic choice, the `progress.unlockAll` setting, `match.start` and every counted match; the per-frame style reads only these.

## Medals MD01..MD20

Emitted as `medal { id, medal }` for the local player only. Numbers: `MEDAL_RULES`. `RunLog.explosiveShots` counts only player-owned blasts with radius > 0 (radius-0 gadget pops such as smoke do not count). One kill may pay several different medals (Multi + Spree) but never one medal twice; chains pay Double and Multi once each, a life pays each streak medal once.

## Ladder, Challenge Rooms, Operations, Daily Seed

- `Ladder.start(tier, match, difficultyId?)`, `isOpen`, `setDifficulty`, `state()`, `passed(results)`, `matchCount()` (27). 8 tiers of 3-4 matches; free-for-all needs a podium place, duels and team modes a win; the last match is a duel against B24.
- `Challenges.start(id, expert)`, `starsFor(row, points)`, `record(id)`, `expertOpen(id)`. Points = `Progress.points(row.points, metrics, row.par)`; stars from `row.stars`; Expert opens at 2 stars and plays bots `expertTier` tiers up with the row's `expert` mutators, else its kind's `CHALLENGE_EXPERT_MUTATORS` (`Challenges.expertMutators(row)`). The `seconds` metric is the match duration, or the time the player lost their last life under lives rules (`RunLog.outSeconds`), so a player knocked out early stops earning survival points. Every room reaches 3 stars with a flawless run at half of par (self-test). XP only for newly gained stars. Rooms are fixed trials: they run no placed cards and unlock none. `underPar` pays only on a win, `won` pays only a credited win (`Progress.creditedWin`: the player took part, or had no ally), and `accuracy` counts in full only from `CHALLENGE_ACCURACY_HITS` (10) hits. New row field `waves`. PvE rooms: CR03 / CR10 / CR16 are Siege Waves (`horde`) on Cistern with `waves` 3 / 4 / 5; CR06 Quiet Manor, CR13 Shadow Manor and CR19 Phantom are Silent Contract on Ash Manor; CR05 Marksman Course is the Firing Range on Proving Grounds (90 s, Expert is head-only). `ChallengeRun` (15c) ends those rooms: a win after the room's waves, the range at its clock. Retry: start the same setup again.
- `Operations.start(id)`, `nextSetup(id, seed)`, `state(id)`, `carryTickets(left) = min(120, 60 + floor(0.5 x left))`. Each death costs one ticket; a side at 0 loses the map (`Modes.finish(..., 'tickets')`). The side that lost the previous map gets one heavy bot (`OPERATION_COMEBACK`).
- `Daily.dateKey(ms, offsetMinutes)`, `todayKey()`, `choiceFor(key)`, `setup(key)`, `start()`, `history()`. Seeded by `hashString('daily:' + key)`; picks a playable mode, a ruleset, 2 compatible mutators and a hand-made map from `CAT.maps` (never the editor's saved or generated maps, which differ per device), with a fixed `DAILY_RULES.bots` (5, inside the lowest quality preset's cap), so every device gets the same match. The match plays on a generated map: `choice.generator` is the id of a generator (GN row) whose `modes` include the daily mode, picked by the date seed ('' without the hook); only `setup(key)` builds the map, at `DAILY_RULES.mapSize` (small: every quality tier allows it, so every device builds the same map) through the hook `Daily.generateMap` (filled by 16w with `MapGen.generate`); a map that does not offer the mode is refused and the hand-made map plays. Best score per date, at most 60 days kept, no streaks.

## Cards C01..C24

`Cards.equip(id)`, `unequip(id)` (refunds half), `equipProblem(id)`, `marks()`, `addMarks(n)`, `equipped(type)`. 3 active and 2 passive slots; Patron (C17) makes placing cost x0.5 (`placementScale`) and unlocks only for a level finished on a hard difficulty with no cards; when it is taken off, `Cards.chargeCheapPlacements()` charges the rest of the price. Cards run in PvE matches, and in versus only with the X48 mutator (`rules.fx.cards`) and only rows with `versus: true`. `setup.cards` overrides the equipped list. Active cards: `CardRun.activate(slotIndex)` (30 s, once per level; Encore twice; Longwick +10 s).

Effects go through existing systems: Twin Fury / Rage are `BUFF.DAMAGE` and Iron Will `BUFF.INVULNERABLE` (S12 Buffs: the strongest live damage buff wins, each keeps its own timer, the actor glows), Fleetfoot / Rapid Hands / Slowtide are speed / rate / slow buffs, Mending heals through `Damage.regenerate` and Life Thief through `Damage.lifesteal`, Stoneskin / Brittle Foes / Last Breath are one `Damage.addReducer`.

`Game.match.rules.cards = { ids, fx }`; `fx` holds the soul cards for the local player (absent keys mean the default). S12 reads them through `soulCardFx(id, key, fallback)` (12a), only for `Game.playerId`:

| Key | Card | Meaning | Read by |
|---|---|---|---|
| `soulLife` | C03 Soulkeep | multiplier: PU18 souls stay `soulLife` x 30 s | `Items.dropSoul` (12a) |
| `soulMagnet` | C11 Soul Magnet | metres: souls home to the player from this far (PU18, the only souls) | `soulHomingRange` (12a) |
| `wrathAt` | C09 Dark Pact | souls Wrath Form costs instead of its row's 66 | `Abilities.canAfford` (12e) |
| `soulHeal` | C20 Soul Feast | multiplier: a soul heals `soulHeal` x its PU18 heal | `Powerups.healScale` (12b, the PU18 instant heal) |

## Events from the PvE section (S14, docs/api/pve.md)

| Event | Payload | Read by |
|---|---|---|
| `pve.wave` | `{ wave, phase: 'start' \| 'end' }` (end = cleared) | MD20 Flawless Wave |
| `pve.alarm` | `{ id, ... }` | MD19 Ghost (no alarm; only in a mode with `params.stealth`, M28), M25 contract alarm count |
| `pve.boss` | `{ id, phase, phases, kind: 'start' \| 'phase' \| 'weak' \| 'defeated' \| 'gone', seconds, final }` | kind `defeated` only is a boss time: `RunLog.bossSeconds` / `finalBossSeconds` (card unlocks; S14 14k) |
| `pve.crate` | `{ id, prop }` (a participant broke a prop) | Marks per crate (15d) |
| `pve.secret` | `{ id, secret }` (a participant found a secret hint) | nothing in S15 (the count reaches it through `results.pve.secretsLeft`); HUD and audio may listen |
| `pve.chamber` | `{ chamber, kind: 'enter' \| 'complete', medal, stars, seconds }` | kind `complete`: `Progress.recordChamber` |

`enemiesLeft` (C03 Soulkeep) = living plus queued PvE enemies when the level ends (14j `enemiesLeft()`, while `Pve.active`); outside a PvE match it is not measured (`PROGRESS_NOT_REACHED`) and never unlocks a card. Every card condition reads a metric a finished level measures (self-test).

`match.results.pve = { propsLeft, secretsLeft, optionalLeft }` is written by `PveLevel.report` on `match.end` (S14 listens before S15; `RunLog.measure` reads it through `pveReported`). Only numbers the level can measure are present (no breakable prop: no `propsLeft`; no secret hint: no `secretsLeft`; no optional enemy: no `optionalLeft`); missing numbers count as not measured (`PROGRESS_NOT_REACHED`) and never unlock a card. Readers (spec card table): `propsLeft` C02 Slowtide (destroy all props), `secretsLeft` C09 Dark Pact (find all secrets), C15 Rage (with no deaths) and C18 Last Breath (on hard), `optionalLeft` C13 Greed (all optional enemies: the Silent Contract guards on Ash Manor, X50 beasts). Cistern and Ash Manor have the crates and secrets; the self-test checks that Siege Waves on Cistern and the contract on Ash Manor together measure every card metric. A finished PvE level is a won match whose `rules.family` is not `versus`.

## Chamber records (MP11 Test Chambers)

`Save.data.progression.chambers = { '1'..'12': { medal, stars, seconds } }` (`PROGRESS_VERSION` 2; a version 1 save gains an empty list on first use). `Progress.recordChamber(event)` keeps the best run of a chamber: more stars, or as many stars in less time (seconds rounded to 0.1). `Progress.chamberRecord(chamber)` returns the record or null; `Progress.chamberStars()` sums the kept stars. A run that sets a record adds the results line "Chamber records: N (stars kept: S)".
