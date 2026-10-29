# Class Time Killer - Complete Tasklist

Single tasklist for every item in the former `Ideas-Class Time Killer.txt` (deleted; its full text is kept in Appendix A).
Work top to bottom. Tick a box only when its "Done when" check passes.

## 0. How to use this file

- Phases are in dependency order. A later phase may rely on anything an earlier phase finished.
- Each task: `- [ ] ID - task` followed by `Done when:` (the acceptance check).
- `DECIDE` tasks produce a written decision. Record it in Appendix C (Decision log) before starting dependent tasks.
- `RESEARCH` tasks produce written notes. Record the result in Appendix B (Research log), with the source for each fact.
- Facts and proposals are kept apart: "Fact" = verified in the source (`src/`, VERSION '0.1.0') or the owner's answers. "Proposal" = a design option still to be confirmed by a DECIDE task.
- Edit `src/*.js` and `src/shell.html`, then build with `node tools/build.mjs`. Never edit `ClassTimeKiller.html` by hand.
- Every new file is UTF-8 with BOM. Use plain ASCII characters in code, data and text where possible.

## 1. Owner decisions (fact, from the planning questions)

| Topic | Decision |
|---|---|
| Weapon access across rulesets | Decided by a DECIDE task after research (P3-01). No target set now. |
| Weapon roster | Audit all 46 weapons, merge or cut near-duplicates (reskins), add new ones only for missing roles. Final count decided in P3-03. |
| Game modes | Merge overlapping modes; show a short curated list with good defaults; full configuration moves to an "Advanced / Custom" screen. |
| Git | Work on `main`, no extra branches. |
| Tasklist file | `ClassTimeKiller/TASKLIST-Class Time Killer.md` (this file). |

## 2. Current state (fact, read from `src/` and `docs/`)

- Source: 157 files in `src/` (about 70,900 lines), joined by `tools/build.mjs` into `ClassTimeKiller.html` (build fails above 3.5 MB). Tests: `node tools/selftest.mjs`; performance: `node tools/perf.mjs`. Docs: `docs/SPECIFICATION.md`, `docs/ARCHITECTURE.md`, `docs/api/*.md`, `docs/LIVE-TESTS.md`, `docs/PERFORMANCE.md`.
- Modes: 31 (M01 Frenzy to M31 Test Chambers), including free-for-all, team, objective, elimination, royale, PvE waves, party modes, firing range and puzzle.
- Rulesets: 12 (RS01 Arena Classic to RS12 Frame Runner). Each ruleset sets movement, health, economy, precision, meter and one weapon set.
- Weapons: 46 (W01-W46) in 13 classes. Weapon sets limit a match to a subset (examples: Arena 11 weapons, Knight 8, Exotic 9); `fullSet` and `matchSet` exist but are not tied to the main rulesets.
- Other catalogues (row counts): abilities file 59, gadgets file 31, items file 37, mutators 50, enemies 35, progress file 104 (medals, cards, unlocks, ladder, challenges, operations).
- Alt fire: the input action `alt` is labelled "Aim / alt fire" (`src/05a-input.js:58`); the touch button is labelled "Aim" with face text "AIM" (`src/05b-input-touch.js:65`).
- Shot origin: projectiles and the muzzle effect start at the eye position plus 0.45 m forward along the aim direction (`MUZZLE_FORWARD`, `src/11a-weapons.js:28`, `src/11b-projectiles.js:77,91`), not at the weapon model's muzzle.
- Touch sprint: the left stick sprints above 90 % push and stops below 80 % (`TOUCH_SPRINT_ON` / `TOUCH_SPRINT_OFF`, `src/05b-input-touch.js:10-11`). No setting changes these values.
- Touch controls: about 20 buttons (fire, fire left, aim, jump, crouch, reload, hold breath, swap, grenade, heal, ability 1, ability 2, ultimate, ping, pause, cards, use, melee, gadget) plus 3 layouts (Standard, Compact, Left-handed).
- Reload animation: the view model only dips and tilts the weapon by a sine curve (`src/07e-render-view.js:148-153`). No per-weapon reload motion.
- Spectate: the HUD shows "SPECTATING"; camera override hooks exist (`Render.cameraOverride`, `Sound.listenerSource`). Free cam / follow behaviour when no respawn is possible: to be reproduced (P1-03).
- Weapon pad respawn uses `respawn`, `respawnTeams`, `respawnPower` timers (`src/12a-items.js:218-220`). The "platform never cleared" bug: to be reproduced (P1-04).

## 3. Global rules for every phase

- Mobile first. Every feature must be playable on touch, gamepad and keyboard / mouse.
- No external dependencies. Output stays one HTML file, built from `src/`.
- Update the matching `docs/api/*.md`, `docs/SPECIFICATION.md` and `docs/LIVE-TESTS.md` in the same change as the code.
- Every phase ends with: `node tools/build.mjs` succeeds, `node tools/selftest.mjs` passes, the shipped file logs 0 errors (README command), `node tools/perf.mjs` not worse than the baseline unless a decision accepts it.

---

## Phase 0 - Baseline

- [x] P0-01 - Record the baseline: commit hash, build size, self-test result, perf numbers.
  Done when: recorded in Appendix C.
- [x] P0-02 - Define the low-spec mobile test method (device class, target frame rate, test maps and modes, metrics).
  Done when: method recorded in Appendix C.

## Phase 1 - Audit (Critical and High: features not working as intended)

- [x] P1-01 - Full functional audit of every mode, ruleset, weapon fire mode (primary and alt), ability, gadget, item, pickup, menu and control layout. Classify each finding Critical, High, Medium, Low or Informational. Main focus: Critical and High.
  Done when: Appendix D lists each finding with severity, location (file and function), reproduction steps and fix task ID.
- [x] P1-02 - Weapon fire audit: for each of the 46 weapons test primary fire and alt fire on touch, gamepad and keyboard / mouse. Known report: some weapons have working alt fire but non-working primary fire.
  Done when: Appendix D has one row per weapon with primary / alt result, and every failure has a fix task.
- [x] P1-03 - Reproduce: after death with no respawn (elimination modes), the camera stays stationary and spectating does not work (no free cam, no follow).
  Done when: modes and steps that reproduce it are in Appendix D.
- [x] P1-04 - Reproduce: pickup platforms (pads) are never cleared after the item is picked up.
  Done when: the cause is identified (render state, item state or respawn timer) and recorded in Appendix D.
- [ ] P1-05 - Fix every Critical and High finding that does not depend on a later redesign (P1-02, P1-03, P1-04 included).
  Done when: each is ticked in Appendix D, with a self-test or a `docs/LIVE-TESTS.md` entry covering it.

## Phase 2 - Immediate bug fixes from the ideas file

- [ ] P2-01 - Spectate after death: when the player cannot respawn, offer follow-cam on living players (cycle next / previous) and a free cam; works on touch, gamepad and keyboard / mouse; audio listener follows the spectated view.
  Done when: in every no-respawn mode the player can switch between follow and free cam and cycle targets until the round ends.
- [ ] P2-02 - Pickup pads: the pad shows the item only while it is available; after pickup it shows empty and a respawn indicator if the mode respawns items.
  Done when: in every mode with pads, a picked item disappears from its pad and reappears only after its respawn time.
- [ ] P2-03 - Shots from the muzzle: projectiles, tracers and muzzle effects start at the weapon model muzzle (view model in first person, world model for others) and travel to the point under the crosshair. DECIDE how to handle a muzzle blocked by a wall close to the player (proposal: test the eye-to-muzzle line and fire from the eye if blocked).
  Done when: tracers visibly leave the barrel for every weapon, shots still hit the crosshair point, and a wall directly in front does not let shots pass through.
- [ ] P2-04 - Rename alt fire: the action label "Aim / alt fire" and the touch button "Aim" / "AIM" become "Alt". Keep the ADS behaviour for weapons whose alt fire is aiming.
  Done when: all labels, help text, settings and docs say "Alt"; saved bindings still work.
- [ ] P2-05 - Touch sprint sensitivity: stop the stick from sprinting too easily. DECIDE method (proposals: higher threshold with a hold time, a separate sprint zone above the stick, double-tap to sprint, or a sprint toggle button) and add a setting.
  Done when: decision recorded; in a live test walking at full stick push does not sprint unless the chosen sprint gesture is made.

## Phase 3 - Weapons, equipment and abilities: access and distinct roster

- [ ] P3-01 - DECIDE: weapon / equipment / ability access across rulesets. Current: each ruleset locks one weapon set of about 8-12 weapons (the "gating by themes"; the owner can use about 3 weapons at a time). Options to evaluate: loadout from the full set in any ruleset; wider sets plus unlocks; per-mode restriction only where the mode needs it.
  Done when: Appendix C has the decision and the reason.
- [ ] P3-02 - Audit the 46 weapons for reskins: compare class, damage, rate, range, projectile, fire modes, recoil, ammo. Mark each as distinct, near-duplicate (merge candidate) or redundant.
  Done when: Appendix C has the comparison table.
- [ ] P3-03 - DECIDE: final weapon roster - which weapons merge, which are cut, which new ones fill missing roles. Each weapon gets one clear role and a unique mechanic (fire mode, projectile behaviour or alt fire).
  Done when: Appendix C has the final roster with role, benefits, drawbacks and uses per weapon, and no two weapons share the same profile.
- [ ] P3-04 - Implement the roster from P3-03 (data rows, models, sounds, effects, bot use). Migrate saves, unlocks, cards and challenges that reference removed weapons.
  Done when: every weapon fires primary and alt correctly (P1-02 check repeated), and old saves load without errors.
- [ ] P3-05 - Implement access from P3-01: loadout / set rules, menus, pickups, bots.
  Done when: in every ruleset the player can reach the weapons the decision allows.
- [ ] P3-06 - Same distinctness audit and decision for equipment (gadgets, items) and abilities: merge or cut duplicates, each with a clear role.
  Done when: Appendix C has the final lists and they are implemented.
- [ ] P3-07 - Acquisition and unlocks: make acquiring weapons, equipment and abilities clear and fast. DECIDE what is unlocked from the start and what is earned, and show the requirement for locked items in menus.
  Done when: a new save can use the decided starting set in its first match, and every locked item shows how to unlock it.

## Phase 4 - Game modes and configuration redesign

- [ ] P4-01 - Map overlaps between the 31 modes and 12 rulesets (same goal, different name).
  Done when: Appendix C has the overlap table.
- [ ] P4-02 - DECIDE: merged mode list (modes that become variants of another mode) and the short curated list shown first, each with good default settings.
  Done when: Appendix C has the curated list, the merge list and the defaults.
- [ ] P4-03 - DECIDE: menu flow. Proposal: Play -> curated mode cards -> Start (defaults); "Advanced / Custom" for ruleset, mutators, map, bots, limits. Breadcrumb or step indicator so the player always sees where they are.
  Done when: Appendix C has the screen flow, and every setting from the current menus has a place in it.
- [ ] P4-04 - Implement the merged modes and the new menu flow on touch, gamepad and keyboard / mouse.
  Done when: a new player can start any curated mode in 3 taps or fewer from the main menu, and custom matches still reach every option.
- [ ] P4-05 - Migrate saved custom matches, ladder progress and challenges referencing merged modes.
  Done when: old saves load and old references map to the new modes.

## Phase 5 - Controls and button layout (mobile first)

- [ ] P5-01 - DECIDE: touch layout. Reduce the about 20 buttons to the essential set; context buttons only when usable (example: use, heal, ultimate when ready); group the rest (example: hold or swipe menus). Respect safe areas and thumb reach on phones in landscape.
  Done when: Appendix C has the layout for phone and tablet with the button list and sizes.
- [ ] P5-02 - Implement the new touch layout and keep Standard / Compact / Left-handed variants (or replace them per P5-01). Migrate saved custom layouts.
  Done when: layout fits a 360x640 CSS px landscape screen without overlap and all actions are reachable.
- [ ] P5-03 - Review gamepad and keyboard / mouse layouts for the renamed and merged actions.
  Done when: every action is mapped without conflicts and the Controls screen matches.
- [ ] P5-04 - Onboarding card per input type with the core actions only.
  Done when: shown on first play and available from the pause menu.

## Phase 6 - Animations

- [ ] P6-01 - DECIDE: reload animation set per weapon class (magazine out / in, shell insert, cell swap, bolt / charge, launcher load), first-person and third-person, with timing that matches each weapon's reload time.
  Done when: Appendix C lists the animation per class and per special weapon.
- [ ] P6-02 - Implement the reload animations from P6-01, including partial reload, empty reload and reload cancel.
  Done when: every weapon shows its reload animation and the animation end matches the ammo refill time.
- [ ] P6-03 - DECIDE + implement better melee animations: per melee weapon and for the quick melee of guns (wind-up, strike, follow-through, hit reaction on the target), first-person and third-person.
  Done when: each melee weapon and the quick melee has a distinct animation that matches its hit timing.
- [ ] P6-04 - Swap, ADS / alt, sprint and inspect motions reviewed so they do not conflict with the new reload and melee motions.
  Done when: no animation pops or overlaps in a live test of every weapon.

## Phase 7 - Audiovisual feedback

- [ ] P7-01 - DECIDE: feedback list. Examples to evaluate: hit markers and kill confirm, damage direction, per-surface impact effects and sounds, stronger muzzle flash and recoil kick, shell ejection, tail sounds by distance, low-health and low-ammo cues, ability ready cues, controller rumble, camera shake (with accessibility setting).
  Done when: Appendix C lists accepted items with trigger and performance cost.
- [ ] P7-02 - Implement P7-01 within the performance budget.
  Done when: each accepted item works and `node tools/perf.mjs` meets the P0-02 target.
- [ ] P7-03 - Settings to reduce intense effects (shake, flashes).
  Done when: each intense effect has an off / reduced option.

## Phase 8 - Rebalance

- [ ] P8-01 - Define balance targets (time-to-kill ranges per class already exist in `weaponClasses.ttk`; add pick-rate, win-rate and usage targets for weapons, equipment and abilities).
  Done when: targets are in Appendix C.
- [ ] P8-02 - For each weapon, equipment and ability write benefits, drawbacks and uses.
  Done when: Appendix C has the table, every row has at least one of each, and no two rows have the same profile.
- [ ] P8-03 - Smart testing plan (not every combination): headless bot matches with fixed seeds, one-factor-at-a-time changes, pairwise combinations for interactions (weapon x ruleset, ability x weapon class), extremes first.
  Done when: the plan lists every test case and the total count.
- [ ] P8-04 - Run the plan, fix outliers, re-run only affected cases. Retune bots for the new roster.
  Done when: all cases meet the P8-01 targets, results summarized in Appendix C.

## Phase 9 - Final audit and release

- [ ] P9-01 - Repeat the audit (P1-01 categories) on the final build.
  Done when: no Critical or High finding remains open in Appendix D.
- [ ] P9-02 - Save migration test from VERSION 0.1.0 (settings, bindings, touch layouts, progress, unlocks, custom matches).
  Done when: a 0.1.0 save loads with no errors and no lost progress.
- [ ] P9-03 - Device test: low-spec Android phone, iPhone (HTTPS and Home Screen app), desktop keyboard / mouse, desktop gamepad.
  Done when: each passes or has a recorded known issue.
- [ ] P9-04 - Update README, docs and in-game help; bump VERSION; rebuild and commit `ClassTimeKiller.html`.
  Done when: all texts match the final features and the shipped file logs 0 errors.

---

## Appendix A - Coverage map (every line of the former Ideas-Class Time Killer.txt)

| Idea | Tasks |
|---|---|
| Audit for Critical and High issues, features not working as intended | P1-01 to P1-05, P9-01 |
| Redesign all game modes and configuration (getting lost) | P4-01 to P4-05 |
| No-respawn death: camera stationary, no free cam / follow spectate | P1-03, P2-01 |
| Pickup platforms never cleared after pickup | P1-04, P2-02 |
| Hard to acquire weapons / equipment / abilities; gating by themes; similar weapons (reskins); complete set of distinct useful weapons | P3-01 to P3-07 |
| Some weapons: working alt fire, non-working regular fire | P1-02, P3-04 |
| Alt fire labelled Aim; "Alt" preferred | P2-04 |
| Redesign buttons and layout (mobile first) | P5-01 to P5-04 |
| Rebalance everything; benefits, drawbacks, uses for each weapon / ability / equipment | P8-01 to P8-04 |
| Weapons fire from the center to the crosshair, not from the muzzle | P2-03 |
| Improve audiovisual feedback | P7-01 to P7-03 |
| Reload animations | P6-01, P6-02 |
| Better melee animations | P6-03 |
| Analog on mobile goes to sprint too easily | P2-05 |

### Original text of Ideas-Class Time Killer.txt (verbatim)

```text
- Audit For Critical and High Issues with Features not working as intended
- Redesign all Game Modes, Game mode Configuration i get lost very easily
- When Dying where you cant respawn your camera stays stationary and cant spectate properly either free cam or follow others.
- Platforms for Pickups never get cleared after being picked up
- Very Hard to acquire Any of the Weapons,Equipment,Abilities. Lots of gating by themes etc (each time i can use 3 weapons approx). Weapons are probably very similar (reskins) i want a complete set of distinct useful weapons.
- Some cases of weapons have working alt fire and non working regular fire
- the Alt fire is labeled Aim. Alt is better i think.
- Redesign the buttons and the button layout (mobile first)
- Rebalance everything. Each Weapon Ability Equipment has its Benefits Drawbacks and Uses overall
- Weapons not firing from the muzzle but from the center to the crosshair.
- Improve Audiovisual Feedback
- Reload Animations
- Better Melee Animations
- Analog esp on mobile goes to sprint very easily its very sensitive
```

## Appendix B - Research log

(Filled by RESEARCH tasks. One entry per item: topic, finding, source, verified yes / no / unknown.)

## Appendix C - Decision log

(Filled by DECIDE tasks and measurement tasks. One entry per task ID: decision or numbers, reason, date.)

### P0-01 - Baseline (2026-10-29)

- Commit: `fec9b48` (main). `git status` of `ClassTimeKiller/` clean before and after the measurements.
- Build: `node tools/build.mjs` OK in 2 s, 156 files. `ClassTimeKiller.html` = 2152.7 KB (2,204,363 bytes; limit 3.5 MB). Test build 3598.2 KB (no limit). The rebuild is byte-identical to the committed `ClassTimeKiller.html` (SHA-256 `18c2a3b1125c443c90ad878d660bda1a48bb85dcd2b17122cbbdc14339d85ec4`).
- Self-test: `node tools/selftest.mjs` = **6018 / 6018 passed**, 0 skipped, 35 groups, 149 s (152 s wall), no failing names. One earlier run while other jobs shared the CPU gave 6017 / 6018: the timing check "nav / big map: 120 x 120 m build 66.0 ms warm under 50.0 ms" failed; alone, `--group nav` passes 134 / 134 (load-sensitive check, not a defect).
- Shipped file: `node tools/selftest.mjs --file ClassTimeKiller.html --no-selftest --eval "__CTK.log.errors().length"` prints **0**.
- Perf: **`tools/perf.mjs` does not run at this commit**: SyntaxError at line 43 (the end-of-line `//` comment swallows the closing `)` of `resolve(...)`; introduced by commit 771e310). The numbers below come from a scratch copy with only that line fixed (full default sweep: boot + 5 scenes x 3 presets x 4x / 6x, 490 s, test build, 1280 x 800 software WebGL, machine shared with other jobs: timings move up to 2x between runs; see `docs/PERFORMANCE.md` 2.3). Fix = add `)` before the comment (tools/ file, left unchanged here; tracked as D-F06 in Appendix D).
- Boot (navigation start to first menu frame, median of 3): 1x 560 ms, 4x 818 ms, 6x 1148 ms.
- 4x CPU throttle, means (budgets PERF-002: sim 2.0, render 1.5, HUD 0.4, frame CPU at 120 fps 5.5 ms; draws Potato 50 / Low 80):

| Scene | Preset | sim ms/step | frame CPU @120 ms | render ms | HUD ms | draws p95 | longest minor GC ms | heap MB |
|---|---|---|---|---|---|---|---|---|
| tdm | potato | 3.91 | 8.34 | 2.15 | 1.29 | 29 | 7.6 | 10.2 |
| tdm | low | 2.73 | 6.28 | 2.02 | 0.59 | 30 | 9.6 | 11.5 |
| horde | potato | 3.06 | 6.29 | 1.93 | 0.86 | 27 | 15.3 | 12.7 |
| horde | low | 3.09 | 6.60 | 1.65 | 1.26 | 27 | 9.6 | 13.2 |
| royale | potato | 3.32 | 5.61 | 1.31 | 0.64 | 40 | 6.8 | 13.9 |
| royale | low | 4.43 | 6.73 | 1.39 | 0.57 | 43 | 4.3 | 14.0 |
| generated | potato | 2.03 | 3.88 | 1.21 | 0.47 | 32 | 2.5 | 14.2 |
| generated | low | 3.34 | 5.13 | 1.23 | 0.41 | 35 | 6.5 | 14.4 |
| editor | potato | 0 | 2.89 | 1.91 | 0.06 | 9 | 2.5 | 14.7 |
| editor | low | 0 | 3.73 | 2.90 | 0.08 | 9 | 0.7 | 14.7 |

  Medium and 6x rows are in the scratch JSON (not committed; the 6x rows are not monotonic with 4x because of the throttle slices). Known state: at 4x every match scene misses the PERF-002 sim, AI and HUD budgets (already stated in `docs/PERFORMANCE.md` section 5); royale / generated Potato are closest. Draw calls are far below PERF-004 (27-43 of 50 / 80).
- Scratch copy of the baseline test build for `--file` before / after runs: `C:\Users\GS\AppData\Local\Temp\claude\ctk\baseline-ClassTimeKiller.test.html` (temp, not in the repo).

### P0-02 - Low-spec mobile test method (2026-10-29)

- **Device class**: budget Android phone of about 2019 (4-8 weak ARM cores, 3 GB RAM, Adreno 5xx / Mali-G52 class GPU, 60 Hz, Chrome for Android), landscape about 640 x 360 CSS px at devicePixelRatio 2; second class: older iPhone in Safari (60 fps page cap, HTTPS + Home Screen app). The game auto-selects Potato or Low there (PERF-008).
- **Target**: 60 fps (16.7 ms; PERF-001 hard minimum) at the auto preset, no 4x-throttle regression. Headless gate = no cell of the baseline table above gets worse than +10 % and +0.3 ms (compared back to back with the baseline build, because the machine is noisy); the PERF-002 budgets remain the goal and the baseline misses are the known list. Absolute caps that never move: draw calls Potato 50 / Low 80 (PERF-004), shader programs 8, heap 150 MB, boot to the first menu frame at 6x under 2 s (baseline 1.15 s). GC pauses: goal 2 ms (PERF-006), baseline 2.5-15 ms minor, tracked not gated.
- **Test maps and modes** (the perf scenes, `src/20b-test-perf.js`): `tdm` Harbor with 16 bots, abilities and gadgets (worst case combat), `horde` PvE waves, `royale` Ring Isle 18 actors (largest map), `generated` GN5 dense island, `editor` 400 boxes. Presets Potato and Low (Medium for reference). New features (P2 / P6 / P7) are added to the `tdm` scene first (effects, animations, projectile origin).
- **Metrics** (all printed by `perf.mjs`): sim ms per 120 Hz step and groups (movement, AI, projectiles, rules), render and HUD CPU ms, frame CPU at 120 and at 60 fps (`cpu mean - sim in frame + N x sim step`, N = 1 / 2), draw calls and instances, GC count and longest pause, allocation KB/s, heap growth, boot ms, plus `--reaction` (dynamic resolution and preset step-down) and `--bench` (back-to-back sim cost). GPU time cannot be measured headless (SwiftShader about 30 ms per frame whatever the scene): draw calls and instances stand in for it; real GPU cost is checked on a device in P9-03.
- **Headless emulation**: `perf.mjs` already throttles the CPU through CDP `Emulation.setCPUThrottlingRate` (`--throttle 4,6`: 4x mid-low phone, 6x very low). Commands (after P0-01 fix of line 43): `node tools/perf.mjs --scenes tdm,horde,royale,generated --presets potato,low --throttle 4,6 --seconds 8 --bench [--file <test.html>] [--json <file>]`, `node tools/perf.mjs --reaction --no-scenes`, `node tools/selftest.mjs --group perf`. `perf.mjs` has **no viewport option** (scenes run at the 1280 x 800 window; only `--reaction` sets 480 x 270): a 3-line addition (`Emulation.setDeviceMetricsOverride` with width, height, deviceScaleFactor, mobile true after `openChrome`) was tried in a scratch copy and works (`--view 640x360x2`, tdm Potato 4x ran, 12 s); recommended as part of the perf.mjs fix. Run budget comparisons back to back with the baseline test build, one run at a time (no other jobs), and re-run a cell before calling a regression.
## Appendix D - Audit findings

(Filled by P1-01 and P9-01. Columns: ID, severity, area, location, reproduction, fix task, status.)

### Findings from P1-01 (2026-10-29)

Method: read every mode behaviour, rules build, save, abilities, gadgets, items, powerups, menus and bindings against the spec; probes on the test build through `tools/selftest.mjs --no-selftest --eval`: all 31 modes simulated 90 s with bots (no errors); all 47 abilities, 24 gadgets, 17 items and 20 powerups used (timers end, cooldowns refill, nothing left after `Game.stop`, no NaN); all 42 menu screens open and leave by Back / Esc / pad B; all 127 settings save at once; bindings have no default conflicts and rebinding saves, reloads and resets. Totals: Critical 0, High 0, Medium 1, Low 5, Informational 3. Not covered: bot use of each ability and gadget in live play; touch layout per screen size (the `hudui` self-test group covers it).

| ID | Severity | Area | Location | Reproduction | Fix task | Status |
|---|---|---|---|---|---|---|
| A-01 | Medium | M17 Blight outbreak size has no cap | `src/13f-modes-party.js` `outbreakSize()` l.78-82, `startOutbreak()` l.109-117 | On a large custom map (about 27,000 m2 walkable, 12 players) every human is infected at 20 s and the Blight wins at once. Authored maps are safe (1-4). | P1-05 (clamp to players - 1) | open |
| A-02 | Low | M28 Silent Contract with no map wins on tick 1 | `src/14j-pve-modes.js` `contract.start()` l.578-582 | `__CTK.game.start({ mode: 'contract', seed: 7, player: {}, bots: [] })`: relic and extract both at the origin. Only the debug API or a stale map id reach it. | P1-05 (refuse or pick a map when `match.map` is null) | open |
| A-03 | Low | M29 Attrition score events carry no reason | `src/14j-pve-modes.js` `attrition.onKill()` l.562 | `Modes.awardTeam(killerTeam, extra)` without a reason. | P1-05 (pass 'kill') | open |
| A-04 | Low | A save from a newer version is silently downgraded | `src/04-save.js` `load()` l.61-74, `migrate()` l.76-84 | A stored save with version above SAVE_VERSION loads and is re-stamped on the next write; `importText` refuses the same data. | P1-05 (back it up and tell the player) | open |
| A-05 | Low | A corrupt save overwrites the import backup | `src/04-save.js` `load()` l.68 | Two failures in a row lose the older good copy. | P1-05 (keep a parseable backup) | open |
| A-06 | Informational | Multi-tab save adopts the other tab's save | `src/04-save.js` `saveNow()` / `adoptNewer()` l.91-115 | By design (R-001); progress from the other tab is lost with a toast. | none (by design) | open |
| A-07 | Informational | M12 Uplink, M26 Ravager vs Fiends rounds have no clock | `src/03f-data-modes.js` rows control / fiends, `src/13b-modes.js` `stepRounds()` l.562-566 | A hiding side can stall a round; the player is never stuck. | P4-02 (mode defaults) | open |
| A-08 | Low | Gamepad defaults lack previous weapon and buy menu | `src/05a-input.js` ACTION_ROWS l.70-84 | Only Y cycles forward; buy menu only from pause. Every action can be bound to a View chord. | P5-03 | open |
| A-09 | Informational | Target ability pressed with no target gives no feedback | `src/12e-abilities.js` `tryActivate()` l.268-281 | bolt, link, swarm, frenzy: nothing happens, resource kept. | P7-01 | open |

### Findings from P1-02 / P1-03 / P1-04 and the baseline (2026-10-29)

| ID | Severity | Area | Location | Reproduction | Fix task | Status |
|---|---|---|---|---|---|---|
| D-F01 | High | W40 Fusion Mortar alt (Detonate) never works with the normal loadout | `src/11a-weapons.js:518-522` (a reload returns before `stepAltMode`), `:487-489` (`reloadIfEmpty` starts the reload at once), `src/03c-data-weapons.js:258` (W40 `mag: 1`, `reserve: 1`; reload 2.5 s), orb fuse 2 s (`:87`) | Any ruleset: give W40, fire (primary), press Alt within 1 s: no explosion; the single round empties the magazine, the auto reload (state RELOAD, 2.5 s) blocks the alt, the orb blows by its fuse about 1.2 s after the shot. With 30000 rounds it works. | P1-05 | open |
| D-F02 | High | Primary fire is swallowed after sprinting; Alt types that are not shots (zoom, toggle, block) still act at once. Likely source of the owner's "alt works, fire does not" on touch, where the stick sprints above 90 % push | `src/10a-move.js:86-88` (`Move.canFire` false while `FIRE_DELAY`), `:447` (FIRE or ALT cancels the sprint), `:454` (delay = `sprintToFire` + weapon `readyTime`), `src/03b-data-movement.js:37,42,57` (`sprintToFire` 0.20 / 0.15 / 0.15), `src/03c-data-weapons.js` (`readyTime` 0.15 on all 46), `src/11a-weapons.js:666` (`ready`), `:531-535` and `:568-576` (ADS, toggle, block are not gated by `canFire`), `src/05b-input-touch.js:329` (stick above 90 % sprints), `src/05a-input.js:7` (tap buffer only 0.10 s) | In a sprint-capable ruleset (RS04, RS05, RS09, RS10, RS11, RS12 = modern / agile / parkour): hold forward + sprint (Shift / L3 / stick past 90 %) for 1 s, then press Fire: first shot after 21 frames of 1/60 s (0.35 s); a one-frame tap never fires. Measured in the `modern` movement preset for all 46 weapons on keyboard / mouse, gamepad and touch (138 rows, identical; agile and parkour were not run, their `sprintToFire` is 0.15, so 0.30 s). Alt: zoom / toggle act at once; shot alts have the same 0.35 s delay. Rulesets with no sprint (RS01-RS03, RS06-RS08) are not affected. | P1-05 (with P2-05) | open |
| D-F03 | High (owner report) | Primary dead while Alt still fires: 9 weapons use an Alt pool or no ammo for Alt, so when magazine and reserve are empty the primary only clicks and Alt keeps firing: W06, W08, W10, W18, W20, W22, W26, W27, W36 | `src/11a-weapons.js:455-460` (`hasAmmo`), `:481-485` (`reportEmpty`), `src/03c-data-weapons.js` (`altAmmo`, Alt `ammo: 'alt'` or `ammoPerShot: 0`) | Give the weapon, spend the magazine and reserve (or set both to 0), hold Fire: only `weapon.empty` clicks; hold Alt: shots leave (W06 6, W08 4, W10 3, W18 2, W22 20 alt rounds; W20 and W36 Alt cost no ammo). Keyboard / mouse tested, same code for all inputs. Whether the HUD shows the empty state was not checked. | P1-05 | open |
| D-F04 | Medium | Lock-on weapons give no shot and no cue without a target: W07 primary (needs a 0.4 s lock; its Alt fires freely) and W33 Alt | `src/11a-weapons.js:600` (`LockOn.update`), `:669` (`ready` needs a lock) | Fire W07 with nothing in front: 0 shots (Alt: 12 shots in 1.5 s). W33 Alt: 0 shots without a lock. | P1-05 (feedback) | open |
| D-F05 | Informational | Working as designed, listed so they are not re-reported: W24 hip fire (spread 8 deg) missed at 8 m; W27 and W39 charge primaries fire on release (a tap does nothing visible); W29 stance Alt refused on open ground (needs a ledge); W36 heat blast needs stored heat (damage is heat x 120); in rulesets with a shield or hero health model damage lands on shield / armor before health | - | - | - | no fix |
| D-F06 | High | `tools/perf.mjs` is not valid JavaScript: SyntaxError at line 43 (the `//` comment eats the closing `)` of `resolve(`); `node tools/perf.mjs` exits at once, so the Phase gate "perf not worse than the baseline" (Section 3) cannot be run | `tools/perf.mjs:43` (commit 771e310) | `node tools/perf.mjs` | P1-05 (one character; tools/ file) | open |

#### P1-02 - Weapon fire audit (46 weapons, primary and alt, three input devices)

Method. A probe script (scratch, outside the repo, run in headless Chrome on the test build) drives only the input layer and the real sim: keyboard / mouse = `PointerEvent` on `window` (Mouse:0 Fire, Mouse:2 Alt); gamepad = a fake Gamepad polled by `PadInput` (RT = Fire, LT = Alt); touch = pointer events on the `fire` and `aim` buttons of `TouchInput`. `Input.frame` writes the actor buttons, then 2 sim steps per 1/60 s frame. Scene: flat arena, weapon set `fullSet`, movement `arena`, a 100000 HP dummy 8 m ahead (melee 1.2 m, cones inside their range), aim set through `Input.setAim` (ballistic lift for lobbed shots). Per weapon and device: primary held 1.5 s (charge: charge time + 0.1 s) and, for semi / burst primaries, a one-frame tap; Alt by type (zoom: ADS reached; toggle: stance flips; block: damage reduced; detonate: primary then Alt; shots: fire event + damage). Run twice: default loadout ammo and 30000 rounds. Pass = a `weapon.fire` of that mode, damage when the mode deals damage, no logged error. 552 weapon / device / ammo rows, plus a sweep of all 12 rulesets x 46 weapons x primary / alt (keyboard / mouse, default ammo, 552 rows), plus sprint (138 rows) and empty-ammo (40 weapons) scenarios. Result: **no weapon fails primary or alt on any device in the baseline scene**; the only failing case is W40 Alt (D-F01). Across all 12 rulesets only W40 Alt failed (the hero ruleset's W36 heat blast showed 0 damage on the probe's dummy: not investigated further). The failure that matches the owner's report is not device or weapon-data specific but situational: D-F02 (sprint), D-F03 (empty pools), D-F04 (lock-on).

Cell format: keyboard / mouse - gamepad - touch.

| Weapon | Primary (kbm / pad / touch) | Alt (kbm / pad / touch) | Fire types | Note | Fix task |
|---|---|---|---|---|---|
| W01 maul | OK / OK / OK | OK / OK / OK | melee/auto + alt melee/charge | - | - |
| W02 tanto | OK / OK / OK | OK / OK / OK | melee/auto + alt melee/semi | - | - |
| W03 bulwark | OK / OK / OK | OK / OK / OK | melee/auto + alt block/auto | - | - |
| W04 warden | OK / OK / OK | OK / OK / OK | hitscan/semi + alt hitscan/burst | - | - |
| W05 verdict | OK / OK / OK | OK / OK / OK | hitscan/semi + alt zoom | - | - |
| W06 hush | OK / OK / OK | OK / OK / OK | hitscan/semi + alt hitscan/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 |
| W07 sparklock | OK / OK / OK | OK / OK / OK | lock/auto + alt hitscan/auto | primary is lock-on: no shot without a target held 0.4 s (D-F04) | P1-05 |
| W08 twinsting | OK / OK / OK | OK / OK / OK | hitscan/auto + alt hitscan/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 |
| W09 wasp | OK / OK / OK | OK / OK / OK | hitscan/auto + alt zoom | - | - |
| W10 hornet | OK / OK / OK | OK / OK / OK | hitscan/auto + alt projectile/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 |
| W11 riptide | OK / OK / OK | OK / OK / OK | hitscan/auto + alt toggle/auto | - | - |
| W12 needlethorn | OK / OK / OK | OK / OK / OK | projectile/auto + alt projectile/semi | - | - |
| W13 vanguard | OK / OK / OK | OK / OK / OK | hitscan/auto + alt zoom | - | - |
| W14 tempest | OK / OK / OK | OK / OK / OK | hitscan/auto + alt zoom | - | - |
| W15 ratchet | OK / OK / OK | OK / OK / OK | hitscan/burst + alt zoom | - | - |
| W16 longshot | OK / OK / OK | OK / OK / OK | hitscan/semi + alt zoom | - | - |
| W17 coilcaster | OK / OK / OK | OK / OK / OK | hitscan/semi + alt projectile/semi | - | - |
| W18 pulsecarbine | OK / OK / OK | OK / OK / OK | hitscan/auto + alt projectile/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 |
| W19 scattergun | OK / OK / OK | OK / OK / OK | hitscan/semi + alt hitscan/semi | - | - |
| W20 hookjaw | OK / OK / OK | OK / OK / OK | hitscan/semi + alt projectile/semi | mag + reserve empty: primary only clicks, alt (hook, no ammo) still fires (D-F03) | P1-05 |
| W21 shardcaster | OK / OK / OK | OK / OK / OK | projectile/semi + alt projectile/semi | - | - |
| W22 frostbore | OK / OK / OK | OK / OK / OK | hitscan/semi + alt hitscan/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 |
| W23 lancet | OK / OK / OK | OK / OK / OK | hitscan/semi + alt zoom | - | - |
| W24 heron | OK / OK / OK | OK / OK / OK | hitscan/semi + alt zoom | hip fire misses at 8 m (spread 8 deg): by design (D-F05) | - |
| W25 kestrel | OK / OK / OK | OK / OK / OK | hitscan/semi + alt zoom | - | - |
| W26 stakedriver | OK / OK / OK | OK / OK / OK | projectile/semi + alt projectile/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 |
| W27 talonbow | OK / OK / OK | OK / OK / OK | projectile/charge + alt projectile/semi | charge: a tap does not shoot (D-F05); mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 |
| W28 hailstorm | OK / OK / OK | OK / OK / OK | hitscan/auto + alt toggle/auto | - | - |
| W29 anvil | OK / OK / OK | OK / OK / OK | hitscan/auto + alt toggle/auto | alt stance refused on open ground: needs a ledge (D-F05) | - |
| W30 linker | OK / OK / OK | OK / OK / OK | projectile/auto + alt beam/auto | - | - |
| W31 ramjet | OK / OK / OK | OK / OK / OK | projectile/semi + alt projectile/charge | - | - |
| W32 pitcher | OK / OK / OK | OK / OK / OK | projectile/semi + alt projectile/semi | - | - |
| W33 kingfisher | OK / OK / OK | OK / OK / OK | projectile/semi + alt lock/release | alt: no shot without a lock (D-F04) | P1-05 |
| W34 gloop | OK / OK / OK | OK / OK / OK | projectile/auto + alt projectile/charge | - | - |
| W35 kindler | OK / OK / OK | OK / OK / OK | cone/auto + alt projectile/semi | - | - |
| W36 ember | OK / OK / OK | OK / OK / OK | projectile/auto + alt cone/semi | alt needs stored heat (D-F05); mag + reserve empty: primary only clicks, alt (no ammo cost) still fires (D-F03) | P1-05 |
| W37 stormlash | OK / OK / OK | OK / OK / OK | beam/auto + alt hitscan/semi | - | - |
| W38 starthrower | OK / OK / OK | OK / OK / OK | projectile/auto + alt projectile/semi | - | - |
| W39 accelerator | OK / OK / OK | OK / OK / OK | hitscan/charge + alt cone/semi | charge: a tap does not shoot (D-F05) | - |
| W40 fusionmortar | OK / OK / OK | FAIL / FAIL / FAIL (default ammo; OK with 30000 rounds) | projectile/semi + alt detonate | Alt (Detonate) never works with the normal loadout (D-F01) | P1-05 |
| W41 lifter | OK / OK / OK | OK / OK / OK | tool/semi + alt tool/auto | fire event only (no props in the scene) | - |
| W42 twingate | OK / OK / OK | OK / OK / OK | tool/semi + alt tool/semi | fire event only | - |
| W43 auger | OK / OK / OK | OK / OK / OK | projectile/semi + alt detonate/auto | - | - |
| W44 razorwind | OK / OK / OK | OK / OK / OK | projectile/semi + alt projectile/semi | - | - |
| W45 daybreak | OK / OK / OK | OK / OK / OK | projectile/semi + alt projectile/charge | `maxAmmo: 0`: ammo pickups add nothing after the 4 rounds (not a fire fault) | - |
| W46 halcyon | OK / OK / OK | OK / OK / OK | projectile/semi + alt projectile/semi | `maxAmmo: 0`: one round, no refill (not a fire fault) | - |

Not covered by the probe (open for P1-01 / P1-05 follow-up): HUD empty-ammo cue, weapons picked up from pads in a live map, dual-wield W04, attachments, the auto-fire / tap-to-fire touch settings, real device touch latency.

#### P1-03 - After death with no respawn the camera is stuck and there is no spectate (reproduced, 2026-10-29)

- **Modes (measured with a player and 3 bots, the player killed through the damage path, respawn timer read from `Modes.hudState().respawnIn`, -1 = no respawn will come)**: M13 Detonate (`bomb`), M14 Last Squad (`elim`), M20 Last Ring (`royale`), M27 Ghost Ops (`ghostops`): no respawn for the rest of the round / match; M26 Ravager vs Fiends (`fiends`): none until the next round; M15 Last Standing (`lms`): none after the last life (3rd death with the default 2 lives). All other modes respawn within the delay (1 s measured). In rulesets with `downed: true` (RS04, RS05, RS09, RS12) the player first goes down and must bleed out before this state is reached.
- **Steps**: start any of those modes with at least one bot (menu Play, or `__CTK.stress`-like setup), let the player die. The HUD shows ELIMINATED (`src/17c-hud-match.js:410`) and, after the 2 s killcam (`src/17e-hud-killcam.js`) ends, the camera sits at the corpse and stays there; the player's position did not change over 20 s (measured). Nothing lets the player pick another view until the round ends.
- **Cause (code)**: no spectate or free camera exists. `followPlayer` (`src/07e-render-view.js:46-58`) always anchors the camera to the actor of `Game.playerId`, alive or not, so it stays at the death point. `Render.cameraOverride` (`src/07a-render.js:41`) and `Sound.listenerSource` (`src/06-audio.js:117,363`) are documented spectate hooks, but only the killcam, the A23 puppet and the map editor set them. The only spectate artefact is the label "SPECTATING" (`src/17c-hud-match.js:398`), drawn when `Game.playerId < 0` (custom match started without a player, `src/18g-ui-custom.js:319-326`); there `followPlayer` returns at `:46` and the camera is not driven at all. `Modes.respawnIn` returns -1 when `respawnAt` is Infinity (`src/13b-modes.js:833-837`). The look direction still follows the mouse (by code reading: `Input.writeActor`, `src/05a-input.js:603-621`, does not check the actor is alive); position does not move.
- Severity High (the owner's report, every elimination mode). Fix: P2-01 (follow cam on living players, free cam, audio listener) after P1-05 decides the minimum.

#### P1-04 - Pickup pads are never cleared after pickup (investigated, 2026-10-29)

- **Result: the item state and the respawn timer are correct; the platform (base disc) is what stays.** Probe (real maps Spire / Harbor, modes ffa and tdm, headless; `Items.drawPickup` / `Items.drawBase` wrapped to log what the renderer would draw): for one spot of each kind (weapon, health, armor, ammo, powerup) the player stands on the spot, the state goes READY to WAITING, the next draw submits no pickup model and only the base disc (`base:<slot>@0.25`), and the spot returns to READY after exactly the expected time (weapon pad 5 s in free-for-all, 30 s in team modes via `respawnTeams`, power weapons 120 s; health 35 s, armor 25 s, ammo 25 s, powerup 120 s, first power spawn 33-40 s) with the model drawn again. The `item.respawn` event fires. So the pickup is cleared, and no timer is stuck.
- **What the player sees (cause of the report, render)**: `Items.draw` (`src/12a-items.js:581-591`) draws the flat base disc under every spot in both states: READY at glow 0.5 (0.9 for powerups, `:595`) and WAITING at glow 0.25 (`:589`, `PICKUP_GLOW_WAITING` `:629`), same group colour, no spin and no countdown on the pad. The disc therefore stays after pickup, only about half as bright, and nothing marks "empty, back in N s" (the HUD timer `src/17d-hud-markers.js:230` shows respawning spots only in range / as markers). The "platform never cleared" impression is this permanent disc; there is no separate pad object.
- Possible second source, not checked: any static map geometry a designer put under an item spot is world geometry and can never be cleared.
- Not visually verified in a rendered frame (headless draw calls only). Severity Medium. Fix: P2-02 (dim or hide the disc, add a respawn indicator) after P1-05.
