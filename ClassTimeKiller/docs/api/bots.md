# Bots (S14) - bot brains, team play and difficulty

Files: `src/03g-data-bots.js` (tiers, traits, roster, barks, role splits), `src/03h-data-difficulty.js` (difficulty presets and slider ranges), `src/14a-bots.js` (lifecycle, think loop, motor, difficulty stage), `src/14b-bots-perception.js` (sight, hearing, damage, memory), `src/14c-bots-move.js` (paths, steering, links, stuck recovery), `src/14d-bots-combat.js` (targets, aim, fire, weapons, footwork, grenades, abilities), `src/14e-bots-decide.js` (utility goals, objective planners), `src/14f-bots-team.js` (roles, pings, orders, barks), `src/14g-bots-debug.js` (F9 view). Tests: `src/20b-test-bots.js` (group `bots`, about 8 s; the slow group `botsoak`, about 60 s, runs only with `node tools/selftest.mjs --slow` or `--group botsoak`: see Tests below). Spec: BOT-001..BOT-100, DIF-001..DIF-003, ARC-033, PERF-009, PERF-011.

## Contract

- A bot writes only the input fields of `Actors` (`moveX moveZ aimYaw aimPitch buttons slotRequest`), in the Sim system `botThink` (order 10), like the player's input layer. Every other system treats it like a person (BOT-001).
- A brain runs for an actor of kind `BOT` from its first `actor.spawn` on. Actors made with `Actors.create` and never spawned (tests, dummies) are not driven.
- Same seed, same match: at `match.setup` every typed array of `Bots BotSense BotMove BotCombat BotDecide BotTeam` goes back to its load-time contents (14f), so nothing an earlier match left behind steers the next one (a `bots` test plays a seed, another match, then the seed again).
- `Actors.profile` stays what S13 stored (the `CAT.bots` row or `null`); `Bots.profile[id]` holds the row the brain uses.
- No cheating (ARC-033): targets come only from perception (seen, heard, hurt by, pinged by a team-mate) and its memory. A target out of sight is judged by where the bot last perceived it (`BotSense.perceivedPosition`), for distance, aggression, retreat and cover. `BotCombat.fairness` counts every bot shot: `shots`, `unperceived` (the shot does not come from a trigger decision made with the target in sight and the aim on it; a burst's later rounds and the shot that kills count with their decision) and `unknown` (the target was not even remembered). The soak and the mode matches check both stay 0.

## Think loop (per tick, per living bot)

1. `BotSense.serve(now)`: perception passes that are due (20 Hz in combat near the player, 10 Hz otherwise, 5 Hz beyond 40 m or outside the player's view; staggered by id). Budget: 96 rays per tick over all bots for sight and hearing together, combat pairs first; sight leaves the last 16 for sounds (a sound beyond the through-wall radius needs a ray; none left = not heard).
2. `BotTeam.step(now)`: the commander (roles every 15 s). The player's ping button and comm wheel are read by `CommWheel` (17g).
3. Per bot: decision at 2 Hz (staggered), combat (target, aim, fire, weapon), navigation (path following), combat footwork (strafe, dodge), goal actions (hold, use), team updates (acknowledgements, barks), then the motor (look spring with the tier's turn cap, move axes, buttons).
- The first 0.5 s after a spawn the bot only looks along its facing (BOT-002 Spawn state). Frozen actors (`ACTOR_FLAG.FROZEN`, freeze time) wait the same way.

## Data

| Catalogue / constant | Rows | Notes |
|---|---|---|
| `CAT.botTiers` | BT0..BT7 | `speed fov turn reaction aimError hitCap combatMove jumps itemTiming lead dodgeChance headAim flashPeek weaponJumps flanks targetSwitch gadgets` |
| `CAT.botTraits` | T01..T16 | trait keys used in `traits` objects; value 0..1, neutral 0.5 |
| `BOT_TRAIT_STYLES` | 16 styles | trait presets the roster refers to by `style` |
| `CAT.bots` | B01..B24 | `{ id, code, name, tier, style, traits, favorite, color, chat }`; `favorite: 'player'` = the player's most used weapon |
| `BOT_BARKS` | 11 categories | `{ minimal, taunt, reply, lines }` per category; `reply` (orderAck, pingReply) = always spoken, chatter permitting |
| `BOT_CHAT_CHANCE` | quiet / normal / loud | chance a due bark is spoken |
| `BOT_ROLE_SPLITS` | per objective kind | share of a team's bots that defend / escort; the rest attack |
| `BOT_CAMP_HINTS` | `sniper cover guard` | map `navHints` kinds a camper holds |
| `BOT_FLAG_PUSH` | `rallyShare radius minimum wait seconds` | flag raids (two-flag modes): raiders gather at a nav node `rallyShare` of the way from their flag to the enemy's and push together once `minimum` are within `radius` m (or the first waited `wait` s), for `seconds` s or until the flag is taken. A raider farther from its own flag than the rally point (plus `radius`) is not sent back when a push ends; the rally is a meeting place (`ACTION.MOVE`), not a held spot |
| `BOT_OBJECTIVE_VERBS` | `arm disarm defend guard escort stop take reach hold` | what a `Modes.goalFor` verb means: `{ action: 'move'\|'hold'\|'use'\|'keep', share (arrival radius as a share of the objective radius), urgency }`; urgency above 1 outranks any fight |
| `BOT_HUNTED_ROLES` | `carrier colossus cursed bearer` | `Modes.actorRole` names whose marker everyone sees: bots know where they are (what a person sees on screen) |
| `BOT_GADGET_USE` | by gadget `effect` | `{ when (a BOT_USE_TRIGGERS word), range [min, max] m (max 0 = any), chance per check, aim: 'enemy'\|'between' (thrown rows), tier (lowest tier that uses it, optional: flash 3) }`; an effect missing here (launchpad) is never used by bots. Frags and fire use `coverOrHolding` (BOT-034: a target that hid, 2+ together, or any target while the bot holds its spot) |
| `BOT_FLEE_EFFECTS` | gadget effects | thrown effects a bot runs from when it hears one bounce within 6 m (`explode fire singularity impulse freeze`) |
| `CAT.difficulty` | D01..D10 | `tierMin tierMax playerDamage enemyDamage attackers aggression resourceYield parry aimAssist reactionScale aimErrorScale projectileSpeed gameSpeed lives checkpoints checkpointHeal`. S14 applies `tierMin tierMax attackers aggression reactionScale aimErrorScale` everywhere, and in PvE `playerDamage enemyDamage` (its own `Damage.addAttackerScale` hook: PvE enemy hits on the player, and anyone's hits on PvE enemies; never on versus bots) and `gameSpeed` (multiplies `rules.fx.timeScale` in the `difficulty` rule stage). The rest ride along in `rules.botSkill` for their owners: `aimAssist` (S10/S18), `projectileSpeed resourceYield parry lives checkpoints checkpointHeal` (S15) |
| `DIFFICULTY_SLIDERS` | slider ranges | DIF-002 clamps for custom matches |

## Match setup

- `setup.bots[n]`: `{ profile (CAT.bots key or row), team, tier (0..7, 'BT3' or 'skilled'), name, dummy }`. Tier: `entry.tier`, else the roster row's tier, else an even mix over the difficulty's `tierMin..tierMax`; then the adaptive shift.
- `setup.difficulty`: a preset id, or `{ preset, <slider field>: value, tierMin, tierMax }`. The `difficulty` rule stage writes `rules.botSkill` (the merged row, `preset` = its id). An unknown preset logs one error and plays `regular`.
- Settings: `difficulty.botReaction` (0.5..2) and `difficulty.botAimError` (0.5..3) scale every bot; `difficulty.adaptive` turns on DIF-003 (after a match against bots: +1 tier when the player won, -1 when the player lost; team modes judge the player's team by `results.winnerTeam`, a draw changes nothing; free-for-all: first or last; kept in `difficulty.tierShift`, shown as `match.results.botTierChange`); `gameplay.chatter` (`off minimal normal`), `gameplay.taunts`. The F9 view reads `developer.botDebug` (defined by S18).

## API

### Bots (14a)

- `Bots.isBot(id)`, `Bots.tier(id)` (the `CAT.botTiers` row), `Bots.trait(id, TRAIT.<key>)`, `Bots.state[id]` (`BOT_STATE`, names in `BOT_STATE_NAMES`), `Bots.profile[id]`.
- `Bots.setTier(id, tier)`: change a bot's tier now (number, code or key). Returns false for a non-bot.
- `Bots.lookAt(id, x, y, z)`, `Bots.wish(id, dx, dz, amount)`, `Bots.press(id, BTN.*)`: what the layers below use; the motor turns them into input.
- `Bots.reactionScale()`, `Bots.aimErrorScale()`, `Bots.maxAttackers()`, `Bots.inGrace(id, target)` (BOT-042).
- `Difficulty.resolve(choice)`, `Difficulty.adapt(match)`, `Difficulty.tierShift()`.

### Perception (14b)

- `BotSense.sees(bot, other)`, `BotSense.knows(bot, other, now)` (memory within 10 s), `BotSense.alerted(bot)`, `BotSense.viewRange(bot)` (against a standing, moving actor).
- `BotSense.perceivedPosition(bot, other, out)`: the live position while in sight, else the remembered one (BOT-040); fills and returns `out`.
- Per pair (`BotSense.pair(bot, other)`): `visible source seenAt knownAt knownX/Y/Z knownVX/VZ awareness reactAt`.
- Per bot: `heardAt heardX/Y/Z attacker attackedAt alert`.
- `BotSense.share(bot, other, x, y, z, now)`: a team-mate's information (enemy pings).
- `BotSense.stats`: `rays raysThisTick maxRaysPerTick deferred heard hearingRays` (`raysThisTick` runs from one sight pass to the next, so a tick's sounds count with it).
- Inputs: `sound` events (`radius` x (0.5 + hearing trait); farther than 60% of that needs a clear line), `damage` events (direction and rough distance of the attacker), `Smoke.lineBlocked` for sight, `kill` and `actor.remove` (forget).
- Smoke blocks sight like a wall. A cloaked actor (`ACTOR_FLAG.INVISIBLE`, `Items.perceptionScale`) is seen only much closer. A decoy's shot is a `sound` with the owner as `source`: the owner is remembered where the decoy stands.
- `BotSense.mine[bot]`: the nearest enemy placed gadget within 8 m that the bot sees (`Gadgets.visibleTo`, one budgeted ray each; friendly devices skipped), -1 none. An enemy `grenade` sound within 6 m sets `dangerUntil / dangerX / dangerZ` (run from it for 1.5 s) when the throwable is harmful: the bounce sound names no row, so the row is read from the `Thrown` slot at the sound's place (`BOT_FLEE_EFFECTS`; smoke, flash, decoys and darts are not run from).
- Actors in a `BOT_HUNTED_ROLES` role are remembered as pinged while the bot could see them (their marker is on everyone's screen).

### Navigation (14c)

- `BotMove.goTo(id, x, y, z, radius)`: follow a path there (a destination more than 2 m from where the current path was asked for gets a new path, at most every 0.75 s; a newer destination waits); `stop(id)`, `arrived(id)`, `failed(id)`, `distanceToDestination(id)`.
- `BotMove.configure(id)`: path options from the bot's movement preset and tier (jump height with extra jumps only for tiers with `jumps`, speed, gravity).
- Links: walk, crouch (holds CROUCH), jump (jumps again whenever grounded short of the landing, extra jump near the apex for high links), drop, ladder (walks into the ladder volume, then climbs facing the top), jump pad and teleporter (walk in), swim (rises, mantles out over a rim). Water exits are classified at match start: a land node linked from the water is blocked when a knee-height ray toward it finds no wall to mantle (a thin deck above the water), else open. A path from the water avoids blocked exits (1000 s extra); a swimmer whose goal is a blocked exit swims to the nearest open one first; an exit found blocked in play is marked and another taken. A bot that falls in re-plans from the water.
- Steering: on walk, crouch and swim segments the bot heads for a point 2 m ahead along the path (no grinding along door frames); a missed landing or a fall off a ramp edge re-plans at once.
- Stuck (BOT-012): progress is a path point reached, getting closer to the point ahead, or climbing a ladder. No progress for 1.5 s: alternate jump-and-strafe and backing off; 3 s: repath avoiding the node ahead; 6 s: give the goal up. `stuckSeconds`, `longestStuck`, `log` (last 16 give-ups).
- Trap memory (all bots): a node a bot had to repath around costs 30 s extra for 60 s; water nodes cost 4 s extra, so bots swim only when it saves real time.
- `BotMove.ownsView(id)`: on a ladder, a water exit or a jump up onto a ledge the movement owns the view and combat footwork waits.

### Combat (14d)

- `BotCombat.target[id]`, `BotCombat.errorDeg[id]`, `BotCombat.totalShots/totalHits[id]` (per match), `BotCombat.fairness`.
- Aim (BOT-030): the tier's `aimError` (x accuracy trait, target and own speed, 2x over the first 0.6 s of tracking, difficulty and settings), smooth value noise every 0.4 s, critically damped look spring with feed-forward of the moving aim point, capped by the tier's turn rate. Head aim from tier 4 with precise weapons, feet for splash with aim skill > 0.6, lead for projectiles (linear above 0.4 aim skill, refined above 0.8).
- Recoil control (BOT-031): pulls against 30% (BT0) to 100% (BT7) of the aim punch, x 0.75..1.25 by the spray-control trait.
- Hit cap (BOT-093): over a 30 s window the hit rate is held near the tier's `hitCap` by scaling the error.
- Weapons: best owned weapon for the distance by `botPref` (+ favourite bonus), switch when safe or empty, reload when safe or empty. Fire only when aligned with the wanted aim and after the reaction time. Head aim only when the expected miss at that range is under 0.3 m. Semi and burst triggers wait until the residual recoil (after recoil control) is under 1 deg.
- Charge and lock triggers: held until charged, released with the target in sight and the aim on it. Aim off or target hidden: the trigger stays held (letting go would fire at nothing); 1.5 s unseen, a weapon-switch tap drops the charge (a bot with one weapon keeps holding).
- Footwork: strafe (6.5% side change per 0.4 s check), keep the weapon's range, back off while reloading, dodge seen projectiles (tier `dodgeChance`, at most 60%). A seen enemy mine is passed crouched when crouching keeps it quiet (within its trigger + 1.2 m), else steered around: from 5 m beyond its trigger radius a path that runs into the ring of trigger + 1.2 m gets a sidestep along the ring (weight 2 against the path's 1, on the side the bot stands as seen from its destination) and, inside the ring, a push out, until the path direction clears the ring. A heard harmful grenade is run from.

### Kit use (14d: grenades, gadgets, abilities)

- `BOT_USE_TRIGGERS`: the `when` words (`always enemyVisible enemyClose underFire lowHealth allyLow allyDowned escape moving groupedEnemies objective cover coverOrHolding holding lowAmmo`). Each tests only what the bot perceives. An ability row's `botUse { when, range, chance }` and a `BOT_GADGET_USE` row both name one; a use goes when the trigger holds, the target (if any) is in `range` and the chance passes.
- Pacing: every 0.5 s while nothing is wanted; after a use, 4 s (grenade), 2 s (gadget) or 1.5 s (ability) at abilityUse 0.5, shorter with the trait. One grenade per team every 3 s (`BotTeam.takeGrenadeToken`).
- Grenades: the selected thrown row (there is no grenade-cycle input). The landing is where the bot believes its target is (`aim: 'enemy'`) or half way there (`'between'`, a screen). The throw solver finds the low-arc view pitch (up to 35 deg) for the real throw (`GADGET_TUNING.throwSpeed / throwLift`, gravity, from the eye): each pitch's flight is closed-form, the pitch itself is found by bisection (16 steps), since the fixed upward lift leaves no closed form for it (BOT-034 says "analytically"). The view turns onto the arc at the tier's turn rate; then GRENADE is held for the cook time (fuse minus flight minus 0.3 s, cookable rows only) and released.
- Gadgets (BTN.GADGET): placed and deployed rows by `BOT_GADGET_USE`. Mines, turrets, beacons and barriers go down only where the bot holds its spot (`BotDecide.holding`); the jammer goes down at an objective with a fight on it.
- Abilities: `passive` and `ult` rows need no press. `hold` rows are held while the trigger lasts (at most 3 s). A `channel` is started only where the bot holds its spot, and the bot stands still while it runs (`BotCombat.channeling(id)`). Toggles and channels are pressed off once their trigger ends (at most 4 s on; see the known limit below); an off press is one tick long and one that did not take is pressed again 0.5 s later (`switchRetryAt`), so every press is a new edge. An ultimate whose `botUse.when` aims it at enemies (`enemyVisible enemyClose groupedEnemies`) also goes with 2+ enemies in sight or a contested objective, within its own `range` (BOT-035); escape and self-buff ultimates keep their own trigger.
- `BotCombat.uses`: `{ abilities, grenades, gadgets }`, presses by all bots this match (reset at `match.setup`; a gadget press the gadget code refuses still counts).
- Mutators (MUT-003, `Mutators.fx`): head-only rules aim for the head; airborne-only rules fire at a grounded target only with splash; one-hit rules raise dodging (still capped at 60%); no fall damage lets paths drop from any height (14c); damage dealt / taken scale aggression (x0.7..1.3, 14e).
- Known limit: S12 `Abilities.step` reads no input while a slot is active, so the off press does nothing today; channels are therefore kept to held spots.

### Decisions (14e)

- `GOAL` (`NONE ROAM ATTACK CHASE RETREAT COLLECT OBJECTIVE CAMP INVESTIGATE ORDER`), names in `GOAL_NAMES`. `BotDecide.goal[id]`, `goalScore`, `goalX/Y/Z`, `goalAction` (`ACTION.MOVE HOLD USE`), `goalTarget`, `scores` (last score per goal, F9 view).
- Every goal scores 0..1; the best wins unless the current one is within 10% (BOT-020). A goal whose path failed rests for 5 s; with nothing wanted the bot holds and looks around (never without a goal).
- Aggression (BOT-021): 0 when health < 60% with armour < 40, or the enemy is 6 m higher; 0.7 with a powerup; else max(0.55, weapon `botPref.value`) x (0.5 + aggression trait) x (0.5 + difficulty aggression). Below 0.5 the bot retreats (to health, cover from `Nav.nearestCover`, or away) from its target while in sight, else from the enemy that hit it in the last 3 s, judged by where it believes that enemy is.
- Items (BOT-013): map `items` for the mode, valued by need (health by missing health, armour, unowned weapons, powerups, ammo when low), reachable only, taken spots skipped for 20 s; tiers with `itemTiming` and item focus > 0.5 arrive 1..3 s before a timed respawn (`Items.timers`).
- Objective planners, by `Modes.rules.objective` (BOT-080): `flag` (ctf / oneflag: take, carry home, return, escort, defend by role; raiders gather and push by `BOT_FLAG_PUSH`, a carrier outranks every fight), `point` and `hill` (spread over the zone, defenders hold owned ones), `bombsite` (carry and plant, escort, defuse), the elimination safe area and the royale ring. Then the add-on modes by their goal hints (`Modes.goalFor` -> `BOT_OBJECTIVE_VERBS`: relays, the convoy, relics, the flame, the curse beacon), and royale loot (`Modes.loot`) instead of map pickups. Bots sent to one spot spread over it (golden-angle offset by id). `BotDecide.registerPlanner(kind, fn(id, plan, now))` adds one.
- Camping (BOT-041): camper trait > 0.5 and a strong weapon; spots from `BOT_CAMP_HINTS` that see no enemy spawn within 50 m; 120 + 180 x camper seconds, then 60 s cooldown.
- `BotDecide.carriesObjective(actor)`, `contested(id)`, `favoriteWeapon(id)`, `hurry(id, now)`, `goalFailed(id, now)`.

### Team (14f)

- `ROLE` (`FREELANCE ATTACK DEFEND ESCORT`), `BotTeam.role[id]`; the bots with the most teamwork take the support roles.
- Orders (BOT-062): a `ping` from a person is an order by its `COMM_CALLOUTS` row (14f; a kind with no row = go): `attack`, `defend` and `go` at the spot are taken by the 2 nearest team bots; `follow` (follow the caller, 60 s or until they die), `hold` (defend where each bot stands) and `regroup` (go to the caller) by every team bot. Every taker acknowledges 0.5..1.5 s later (`orderAck` bark) and follows it as goal `ORDER` (`ORDER_SECONDS`: defend holds 45 s; attack / go 30 s or until there). `BotTeam.orderGivenAt / answeredAt / orderSource[id]`.
- Pings (BOT-063): a bot that spots an enemy pings it (`kind: 'enemy'`, at most once per 4 s per bot); enemy pings from anyone share the position with the pinger's team bots; the team bot nearest a person's enemy ping replies 0.5..1.5 s later (`pingReply` bark).
- Comm wheel (BOT-061, INP-003; `CommWheel` in 17g, an `Input` source): hold Comm (T) or hold Ping for 0.3 s; look input picks one of the 8 `COMM_CALLOUTS` (Attack, Defend, Follow me, Hold position, Regroup, Danger, Enemy, Go here) instead of turning the view; letting go sends `BotTeam.callout(player, index)`: a ping of that kind at the aimed spot (`at: 'aim'`; Enemy still tags an aimed enemy) or at the caller's feet (`at: 'self'`).
- The player's PING button (a tap shorter than 0.3 s, `BotTeam.playerPing`): an enemy within 4 deg of the aim line becomes an enemy ping; else the aimed spot (raycast, 120 m) becomes `defend` (own objective), `attack` (other objective) or `go`.
- `BotTeam.bark(id, category, now)`: at most one bark per bot per 5 s and per team per 1.5 s, spoken by the profile's chat chance; `reply` categories skip the chance and both limits; `chatter` off / minimal (only `minimal` categories) / normal; taunts off with `gameplay.taunts`. Returns true when spoken.
- `BotTeam.takeGrenadeToken(id, now)`.

### Debug view (14g)

- F9 (S18 toggles `developer.botDebug`): path points, destination and target markers (`Render.addSource('botDebug')`). On the HUD (`HudBatch.addLayer('botDebug', 90)`): the nav graph within 35 m of the camera (`Nav.debugLines` read once per map into a reused buffer, coloured by link type), each living bot's vision cone (the tier's field of view out to `viewRange`, orange once alerted), its alert meter and its awareness of the player as bars, and a label: name, tier, state / goal, role, the two best goal scores (text rebuilt 4 times a second).
- No allocation per frame; lines behind the camera are cut at the near limit. `BotDebug.stats` (`lines bars labels`) tells what the last pass drew.

## Events

| Event | Payload | When |
|---|---|---|
| `ping` (emits) | `{ id, kind: 'enemy'\|'defend'\|'attack'\|'go'\|a `COMM_CALLOUTS` id, x, y, z, target }` | a bot spots an enemy; the player taps PING or sends a comm wheel callout |
| `bark` (emits) | `{ id, team, category, text }` | a bot speaks (text chat line for the HUD) |
| listens | `match.setup match.start match.stop match.end actor.create actor.spawn actor.remove kill damage sound ping weapon.fire pickup setting` | |

## Debug commands (`__CTK`)

- `__CTK.bots`: `{ bots, sense, move, combat, decide, team, debug, difficulty }` plus `lastSoak` / `lastPerf` after the self-test.
- `__CTK.spawnBot(profile, team)`: adds and spawns a bot in the running match; returns its id or -1.
- `__CTK.setTier(id, tier)`.
- `__CTK.soak(mode, map, minutes, botCount = 16, seed = 1, modeOptions = { timeLimit: 0, scoreLimit: 0 })`: plays a headless match (Ultra quality for 16 bots) for `minutes` or until it ends, and returns `{ mode, map, bots, seconds, botSeconds, stuckFraction, maxStuck, nan, maxNoGoal, aiP95, aiMax, kills, shots, unknownShots, unperceivedShots, objectivesTouched, raysMax, ended, winner, reason, teamCaptures, actorCaptures, holdPoints }` (times in s, AI in ms per tick; `teamCaptures` = team `capture` points, `actorCaptures` = per-actor capture credits, `holdPoints` = team `hold` points).
- `__CTK.bots.lastAccuracy` holds the per-tier hit rates of the self-test.
- `__CTK.bots.kits`: `{ play(batch, seconds, round), abilityBatches(rows), gadgetBatches(rows) }`, the kit matches of the tests (each row given to bots, meters kept full; returns the uses per row). `__CTK.bots.flagPush` is `BOT_FLAG_PUSH` (tune it live).

## Tests

- `bots` (default suite): data cross-checks, perception (smoke, cloak, a crouch-safe mine passed crouched, a prox mine walked around, a real frag run from and a smoke canister not, a real decoy), a frag landing within 4 m at two enemies and none at a lone one, flash from tier 3, the BOT-035 ultimate rule, the toggle off retry, flag rally rules, mutator and difficulty hooks, a 60 s match with 8 abilities (60% cast) and one with gadgets, short objective matches, a 1-minute soak on two maps, the AI time budget.
- `botsoak` (slow: `--slow`, or `--group botsoak`): every ability and every gadget with a bot use is used at least once (sweeps over dom, the open test arena and a small room), all 15 modes for 120 s, CTF over 5 seeds (captures in 3+, both sides capture, neither side wins every match), and a 3-minute soak on every map.
