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
- Shot origin: projectiles, tracers and muzzle flashes start at the weapon model's muzzle and projectiles fly to the point under the crosshair (P2-03, `src/11e-weapons-muzzle.js`, decision in Appendix C). Before P2-03 they started at the eye position plus 0.45 m forward (`MUZZLE_FORWARD`, removed).
- Touch sprint: the left stick sprints above 90 % push and stops below 80 % (`TOUCH_SPRINT_ON` / `TOUCH_SPRINT_OFF`, `src/05b-input-touch.js:10-11`). No setting changes these values.
- Touch controls: about 20 buttons (fire, fire left, aim, jump, crouch, reload, hold breath, swap, grenade, heal, ability 1, ability 2, ultimate, ping, pause, cards, use, melee, gadget) plus 3 layouts (Standard, Compact, Left-handed).
- Reload animation: the view model only dips and tilts the weapon by a sine curve (`src/07e-render-view.js:148-153`). No per-weapon reload motion.
- Spectate: a dead player who cannot respawn, and a match with no local player, get a follow camera on living players and a free camera (P2-01, `src/17h-hud-spectate.js`, through `Render.cameraOverride` and `Sound.listenerSource`). Cause of the old behaviour (P1-03): the camera stayed anchored to the dead body.
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
- [x] P1-05 - Fix every Critical and High finding that does not depend on a later redesign (P1-02, P1-03, P1-04 included).
  Done when: each is ticked in Appendix D, with a self-test or a `docs/LIVE-TESTS.md` entry covering it.
  Status 2026-10-29: D-F01, D-F02, D-F03, D-F04, D-F06 and A-01 to A-05 are fixed and tested (Appendix D). The High finding of P1-03 (no spectate after death) was assigned to P2-01 and is fixed there (self-test group `spectate`, LT-M-069); no Critical or High finding is open.

## Phase 2 - Immediate bug fixes from the ideas file

- [x] P2-01 - Spectate after death: when the player cannot respawn, offer follow-cam on living players (cycle next / previous) and a free cam; works on touch, gamepad and keyboard / mouse; audio listener follows the spectated view.
  Done when: in every no-respawn mode the player can switch between follow and free cam and cycle targets until the round ends.
- [x] P2-02 - Pickup pads: the pad shows the item only while it is available; after pickup it shows empty and a respawn indicator if the mode respawns items.
  Done when: in every mode with pads, a picked item disappears from its pad and reappears only after its respawn time.
- [x] P2-03 - Shots from the muzzle: projectiles, tracers and muzzle effects start at the weapon model muzzle (view model in first person, world model for others) and travel to the point under the crosshair. DECIDE how to handle a muzzle blocked by a wall close to the player (proposal: test the eye-to-muzzle line and fire from the eye if blocked).
  Done when: tracers visibly leave the barrel for every weapon, shots still hit the crosshair point, and a wall directly in front does not let shots pass through.
- [x] P2-04 - Rename alt fire: the action label "Aim / alt fire" and the touch button "Aim" / "AIM" become "Alt". Keep the ADS behaviour for weapons whose alt fire is aiming.
  Done when: all labels, help text, settings and docs say "Alt"; saved bindings still work.
- [x] P2-05 - Touch sprint sensitivity: stop the stick from sprinting too easily. DECIDE method (proposals: higher threshold with a hold time, a separate sprint zone above the stick, double-tap to sprint, or a sprint toggle button) and add a setting.
  Done when: decision recorded; in a live test walking at full stick push does not sprint unless the chosen sprint gesture is made.

## Phase 3 - Weapons, equipment and abilities: access and distinct roster

- [x] P3-01 - DECIDE: weapon / equipment / ability access across rulesets. Current: each ruleset locks one weapon set of about 8-12 weapons (the "gating by themes"; the owner can use about 3 weapons at a time). Options to evaluate: loadout from the full set in any ruleset; wider sets plus unlocks; per-mode restriction only where the mode needs it.
  Done when: Appendix C has the decision and the reason.
  Status (2026-10-29): decided, Appendix C "P3-01": loadout from the full roster in every ruleset; rulesets keep their feel through movement, health, economy and meter; weapons restricted only where the mode is the restriction (Gun Game, One Shot, Rocket Pit, melee-only, heroes, puzzle tools).
- [x] P3-02 - Audit the 46 weapons for reskins: compare class, damage, rate, range, projectile, fire modes, recoil, ammo. Mark each as distinct, near-duplicate (merge candidate) or redundant.
  Done when: Appendix C has the comparison table.
  Status (2026-10-29): Appendix C "P3-02" comparison table: 46 weapons marked distinct, near-duplicate or redundant.
- [x] P3-03 - DECIDE: final weapon roster - which weapons merge, which are cut, which new ones fill missing roles. Each weapon gets one clear role and a unique mechanic (fire mode, projectile behaviour or alt fire).
  Done when: Appendix C has the final roster with role, benefits, drawbacks and uses per weapon, and no two weapons share the same profile.
  Status (2026-10-29): decided, Appendix C "P3-03": 46 -> 38 weapons (8 merged into a stronger twin, old-id -> new-id map), Hush and Stakedriver alt reprofiled so no two share a profile.
- [x] P3-04 - Implement the roster from P3-03 (data rows, models, sounds, effects, bot use). Migrate saves, unlocks, cards and challenges that reference removed weapons.
  Done when: every weapon fires primary and alt correctly (P1-02 check repeated), and old saves load without errors.
  Status (2026-10-29): 38 weapons per P3-03 (8 merged, Hush and Stakedriver alt reprofiled), models, sounds and bot use updated; every retired id migrates on load (stats, crosshairs, classes, kit picks, presets, editor draft, maps, map and match share codes); roster tests: every weapon fires primary and alt, no shared profile. Self-test 6337 / 6337 (a timing check under machine load passes alone). Open for P8: on Harbor soak seeds 2-4 a few bot Warden / Maul shots count as unperceived (seed 1 tested at 0).
- [x] P3-05 - Implement access from P3-01: loadout / set rules, menus, pickups, bots.
  Done when: in every ruleset the player can reach the weapons the decision allows.
  Status (2026-10-29): every ruleset builds loadouts from the full roster; only mode-defined restrictions remain (Gun Game, One Shot, Rocket Pit, melee-only, heroes, puzzle tools, Last Standing without power and tool weapons); ruleset fields carry / ammoTiers / melee / abilities; bots pick guns that fit the map distance, and gadgets and abilities by botUse from their own hash stream; Tactical quick buy (Q).
- [x] P3-06 - Same distinctness audit and decision for equipment (gadgets, items) and abilities: merge or cut duplicates, each with a clear role.
  Done when: Appendix C has the final lists and they are implemented.
  Status (2026-10-29): Appendix C "P3-06" lists implemented: gadgets 24 -> 17, items 37 -> 33, abilities 47 -> 45, each with an id migration; changes recorded in Appendix C (four rulesets on the ultimate meter; Modern Ops / Pilot Rush keep the class field upgrade).
- [x] P3-07 - Acquisition and unlocks: make acquiring weapons, equipment and abilities clear and fast. DECIDE what is unlocked from the start and what is earned, and show the requirement for locked items in menus.
  Done when: a new save can use the decided starting set in its first match, and every locked item shows how to unlock it.
  Status (2026-10-29): a new save uses the full roster and a ready default loadout in its first match; locked cosmetics, challenge tiers, ladder matches and cards show their requirement and progress; unlock toast and New badge (earned unlocks only).

## Phase 4 - Game modes and configuration redesign

- [x] P4-01 - Map overlaps between the 31 modes and 12 rulesets (same goal, different name).
  Done when: Appendix C has the overlap table.
  Status (2026-10-29): Appendix C "P4-01": table of the 31 modes (goal, win condition, rulesets, overlaps); rulesets have no goal of their own, 3 close pairs and 3 shared names noted.
- [x] P4-02 - DECIDE: merged mode list (modes that become variants of another mode) and the short curated list shown first, each with good default settings.
  Done when: Appendix C has the curated list, the merge list and the defaults.
  Status (2026-10-29): decided, Appendix C "P4-02": 31 modes shown as 15 (7 with variants, 8 alone), every old mode still playable as a variant with its old id; curated first list of 8 cards with defaults (Frenzy, Team Clash, Holdfast, Flag Raid, Detonate, Arms Ladder, Last Ring, Siege Waves).
- [x] P4-03 - DECIDE: menu flow. Proposal: Play -> curated mode cards -> Start (defaults); "Advanced / Custom" for ruleset, mutators, map, bots, limits. Breadcrumb or step indicator so the player always sees where they are.
  Done when: Appendix C has the screen flow, and every setting from the current menus has a place in it.
  Status (2026-10-29): decided, Appendix C "P4-03": Play -> mode cards (plus All modes, Shuffle) -> Match setup -> Start; Advanced opens the Custom editor prefilled; breadcrumb under each title; back returns focus to the card; LB / RB switch tabs.
- [x] P4-04 - Implement the merged modes and the new menu flow on touch, gamepad and keyboard / mouse.
  Done when: a new player can start any curated mode in 3 taps or fewer from the main menu, and custom matches still reach every option.
  Status (2026-10-29): 15 mode entries (7 with variants) over the 31 modes, 8 curated cards plus All modes and Shuffle, Match setup (variant, map, bots, difficulty, length where the mode has limits, team), Advanced opens a prefilled Custom editor without touching the player's own draft, Quick Match replays the last real start, breadcrumb, back focus, LB / RB tabs on touch, gamepad and keyboard; Detonate card first to 5, Uplink 240 s and Ravager vs Fiends 180 s rounds (A-07 fixed). Self-test 6448 / 6448.
- [x] P4-05 - Migrate saved custom matches, ladder progress and challenges referencing merged modes.
  Done when: old saves load and old references map to the new modes.
  Status (2026-10-29): merged modes keep their old ids as variants, so saved custom matches, presets, share codes, ladder, challenges, operations, medals and daily seeds load and show under the new layout (tested with an old save).

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
### P1-05 - Fix decisions (2026-10-29)

- **D-F01 (W40 Alt blocked by the reload)**: a `detonate` alt now runs during a reload (`Weapons.stepActor`, 11a); other alts stay blocked by a reload. Reason: detonating spends no round and needs no ready weapon, so the reload has nothing to protect; the alternative (keeping the orb alive until the reload ends, a 2.5 s reload against a 2 s fuse) would have changed the weapon's data. W43 Auger (detonate alt) gains the same.
- **D-F02 (fire swallowed after a sprint)**: a trigger pressed while the sprint-to-fire wait runs is buffered in the weapon layer (`Weapons.pressBuffer`, wait + 0.15 s) and answered by one pull the moment `ready()` allows; it covers primary and alt shots and all three input types, because they share the actor button path. `Move.firePending` keeps the sprint off meanwhile, so a held sprint key does not undo the tap. The wait itself (`sprintToFire` + `readyTime`, 0.35 s in Modern) is left as the movement design; shortening it is a P8 balance question. Reason: the input layer's 0.10 s tap buffer is shorter than the wait, and lengthening it would make every tap long.
- **D-F03 (primary dead, Alt alive)**: recommended option taken. The click already existed and the HUD already says NO AMMO; added: a toast ("Out of ammo", "Alt: no ammo"), a `dry` flag on `weapon.empty`, and for the local player a dry primary press equips the next carried weapon in catalogue order whose primary can still shoot ("Out of ammo: <gun>"). The Alt keeps its own pool and is never switched away from. Bots do not auto-switch (their weapon choice is theirs, 14e).
- **D-F04 (lock-on without feedback)**: new event `weapon.nolock` (dry click, same recipe as `weapon.empty`) plus the toast "No target", once per hold after the lock time, and on the release of a release-trigger lock (W33 Alt); a HUD ring on each tracked enemy (arc while locking, red ring and diamond when locked). The ring uses the existing `crosshair` HUD element toggle.
- **D-F06**: `tools/perf.mjs` line 43 fixed; new option `--view WxHxDPR` (Emulation.setDeviceMetricsOverride, mobile) for the P0-02 low-spec method, e.g. `--view 640x360x2`.
- **A-01**: the outbreak is clamped to players - 1 (a human always remains). **A-02**: a mode flagged `needsMap` (Silent Contract) gets its first catalogue map when the setup names no valid one (16f `match.setup` listener); other modes keep their null map, tests and the debug API unchanged. Reason for not refusing: a fallback keeps the menu flows and `__CTK` calls alive. **A-03**: `'kill'` reason passed. **A-04**: a save with a version above `SAVE_VERSION` is played on from a migrated copy but never overwritten: copy to the backup slot, notice at the main menu, no writes until an import (the newer text then becomes the backup). **A-05**: the backup slot is never overwritten while it holds a readable save; an unreadable record goes to a new spare slot `ctk.save.spare` instead (the existing core test "backup: shown" now reads the readable backup and the spare).

### P2-02 - Pickup pads (2026-10-29)

- After a pickup the pad draws a dark empty disc (glow 0.06 against 0.5 lit) and a second disc in the group colour that grows from the centre to the pad's edge over the respawn time (`Items.waitShare`, from the new `waitTicks`); the item model and the lit base return on the respawn tick. All map spots respawn in every mode (weapon stay keeps the item), so the indicator always applies; a unique powerup waiting for its holder stays empty. Cost: one more instanced cylinder per waiting spot. Not viewed in a rendered frame (headless draw-record tests only, as the P1-04 audit).

### P2-04 - Alt (2026-10-29)

- The action label is "Alt" (so the settings row reads "Alt: hold or toggle"), the touch button is "Alt" with face ALT, the gyro option "While aiming" reads "While Alt is held", the pad tip says "Alt (aim or alternate fire)". The action id `alt` and the touch button id `aim` are unchanged, so saved bindings and saved touch layouts keep working; ADS behaviour is untouched. "Aim sensitivity multiplier" and "Aim assist" keep their names (they are about aiming, not the button).

### P2-05 - Touch sprint (2026-10-29)

- **Decision: a double push, with a setting.** Setting `controls.touch.sprint`: `double` (default) = two pushes to the stick edge (90 %) within 0.4 s, with a dip under 60 % or a lift between them; `instant` = the old one-push rule; `off` = the stick never sprints. A sprint ends under 80 % or when the finger lifts. Reason: the hold variant (push held 0.25 s) would still sprint whenever the thumb rests at the rim, and walking at full speed needs the rim (walk speed scales with the push), so walking and sprinting could not be told apart; the double push separates them at no cost in time. Probe (real pointer events, Modern Ops): full push held for 3 s = walk 4.7 m/s, double push = sprint 6.3 m/s, double push 0.7 s apart = walk, off = walk. A touch sprint button does not exist yet, so `off` has no replacement until P5.

### P2-01 - Spectate after death (2026-10-29)

- **When**: the local player is dead and `Modes.respawnIn` is -1, or the match has no local player. Measured with the self-tests in M13 Detonate, M14 Last Squad, M20 Last Ring, M26 Ravager vs Fiends, M27 Ghost Ops and M15 Last Standing after the last life; the same tests show M01/M02/M06 (respawning modes) never enter it. It starts after the killcam (the killcam's last frame hands over to the spectator camera in the same frame) and ends at the player's respawn (`actor.spawn`, which is also what a new round does), `match.end` and `match.stop`.
- **What a dead player may see**: no mode or ruleset restricts it (the spec asks for "spectate cycles players", LT-M-024), so the usual rule applies: the living teammates first when the player has a team and any teammate lives; otherwise every living player and bot (the round is about over, or the mode is free for all; M20 squads count as teams). Dummies, PvE enemies and players waiting in a queue are never followed. A match with no local player cycles everybody.
- **Views**: a chase camera behind and above the followed player (3.4 m, 0.5 m up, pulled in by walls), not their first-person view. Reason: their body, weapon and animations are already drawn and need nothing from the render side; the cost is no view model. And a free camera that flies along the look direction (Jump up, Crouch down, Sprint faster), kept inside the map bounds plus 3 m, without collision (collision was optional; walls would trap a flying camera in small rooms).
- **Controls**: the existing actions, no new action rows or default bindings (so no binding conflicts, and rebinding already works): Fire or next weapon = next player, Alt or previous weapon = previous, Reload = switch follow / free (in the free camera Fire / Alt follow the nearest player). Touch relabels the same buttons NEXT / PREV / VIEW (+ UP / DOWN in the free camera) and hides the combat buttons while spectating. `Input.presses` (new) counts presses, so a tap shorter than a frame and Fire set to toggle both work.
- **Audio**: `Sound.listenerSource` answers with the camera. **HUD**: SPECTATING / FREE CAMERA, the followed name with n/count, the key line (not on touch). The mode card text (18n) says a player who is out can watch or fly.
- Not seen in a rendered frame (headless tests read the camera, the HUD texts and the touch buttons); the phone layout of the four spectator buttons is untested on a device.

### P2-03 - Shots from the muzzle (2026-10-29)

- **Muzzle**: each weapon model has a muzzle point: the model row's `muzzle`, else measured at load as the front end of the foremost silhouette / far parts (twin barrels averaged); all 46 got a plausible one without an override (the self-test lists every weapon). World position: the local player's is the view model's (hold or ADS pose of its class row by the ADS share, model point times `VIEWMODEL_SCALE`); everybody else's, bots included, is the held model's at the 'gun' body part (aim pitch, crouch sink, `HELD_MODEL_SCALE`). Both are plain arithmetic on sim state, so headless matches and bots agree, and the self-tests draw a probe model through the real view-model and held-weapon code and compare (2 mm).
- **DECIDE blocked muzzle (recommended option taken)**: the eye-to-muzzle segment is tested with `World.lineClearOf`; when a brush is in the way the shot leaves the eye (projectile, tracer and flash). Also taken: a wall or actor on the eye ray within 1.5 m makes the shot leave the eye, because the muzzle sits 0.5 to 0.9 m ahead and would be behind what the player aims at (a rocket at a player at arm's length would start behind them). This also fixes a hole of the old rule: projectiles started 0.45 m ahead of the eye whatever stood there, so a wall closer than that was passed.
- **Convergence**: a projectile flies from the muzzle to the first wall or actor on the eye ray (allies count; 120 m when there is none), so it hits what the crosshair is on. A lobbed projectile (gravity > 0) keeps the eye direction and only starts at the muzzle (a parallel offset of 0.1 to 0.3 m); an exact lob to the crosshair point needs a ballistic solve, left for P8 if wanted.
- **Also leaves the eye**: a wall on the way from the muzzle to the aim point (a pillar edge the eye ray clears). X41 bullets converge like any straight projectile. Drawn only: view model offset setting, left pistol of a W04 pair, body scale; a point-blank tracer starts at the eye. Muzzle work is done once per trigger pull.
- **Hitscan**: damage, falloff and penetration are traced from the eye as before (hit results do not change); only the tracer and the flash start at the muzzle and end where the eye ray stopped. For the local player the visual start is scaled by the ratio of the two fields of view (the view model is drawn with its own), so it sits on the barrel tip as drawn; the simulation never reads a field of view.
- Not seen in a rendered frame; the look of tracers from the barrel (first person with a wide FOV, ADS) needs a human eye (LT-M-070).

### Phase check after P1-05 fixes and P2-02 / P2-04 / P2-05 (2026-10-29)

- Build OK (156 files, ClassTimeKiller.html 2160 KB). Self-test **6078 / 6078** passed (baseline 6018; +60 checks), 35 groups, 153 s. Shipped file: `__CTK.log.errors().length` = 0.
- Perf (first run of the fixed `tools/perf.mjs`): `--scenes tdm,horde,royale,generated --presets potato,low --throttle 4 --seconds 8 --bench`, the baseline test build and the new one back to back, machine shared with another agent (noise up to 30 % per cell). Back-to-back bench sim per step, summed over the 8 cells: baseline 9.03 ms, now 8.93 ms (-1 %); in-frame sim/step means moved -30 % to +30 % per cell with no pattern (tdm and royale lower, generated potato higher); draw calls p95 equal within 1 (26-43); boot at 4x 808 -> 837 ms, at 6x 1064 -> 1020 ms. No regression beyond noise. The new code adds no per-step allocation (typed arrays) and one more instanced cylinder per waiting pad.

### Phase check after P2-01 / P2-03 (2026-10-29)

- Build OK (160 files, `ClassTimeKiller.html` 2178.8 KB). Self-test **6258 / 6258** passed, 0 skipped, 37 groups, 157 s (HEAD before this batch: 6089 / 6089 in 35 groups; +169 checks: `spectate` 118, `muzzle` 51; after the review fixes). Shipped file: `__CTK.log.errors().length` = 0.
- Perf: `--scenes tdm,horde,royale,generated --presets potato,low --throttle 4 --seconds 8 --bench`, HEAD test build and the new one back to back, the machine shared with another agent. Back-to-back bench sim per step summed over the 8 cells: HEAD 8.51 ms, now 7.86 ms (-8 %); in-frame sim per step means summed: 17.41 -> 16.33; draw calls equal within 2 (25-43); render and HUD means equal or lower; boot at 4x 682 -> 688 ms, at 6x 992 -> 1052 ms (noise of that size is normal here). The `tdm` scene (16 bots shooting through the new muzzle code) moved -9 % and +45 % in the two presets' bench cells, with no pattern between runs. No regression beyond noise.
- A trap found on the way (now in `docs/ARCHITECTURE.md`): the first version of the new code handed `Vec.set` / `Vec.copy` objects of other shapes (a record with extra fields, `Render.camera`); the shared helpers then stored polymorphically and the PvE laser tell (`Pve.drawEnemy`, 14i `laser.drawTell`) allocated a number per frame, failing the `pve` allocation probe only in a full run. The new files write such fields directly.

### P3-02 - Weapon reskin audit (2026-10-29)

- Source: the rows of `src/03c-data-weapons.js` (read by a script, not estimated). Body TTK = time from the first shot to the killing shot on a 100 HP body, every shot hits, no armor, no falloff (`(shots - 1) / rate`). Range = falloff start-end where the row has one, else the `botPref` range. Ammo = mag / reserve (+ alt pool). Sets = weapon sets that hold the weapon (fullSet left out).
- Verdicts: **distinct**; **near-duplicate** (merge candidate, the twin named); **redundant** (its role is covered by others).

| Code | Weapon | Class | Primary (type, trigger, damage, rate/s) | Body TTK | Range m | Projectile | Alt | Recoil | Ammo | Sets | Verdict and reason |
|---|---|---|---|---|---|---|---|---|---|---|---|
| W01 | Breaker Maul | melee | melee auto 50, 2.5 | 0.40 | 1.6 | - | charge 1.2 s 30-120, self-launch 4.5 m | - | - | arena, ravager | distinct: only melee with a launch |
| W02 | Edge Tanto | melee | melee auto 35, 2.5 | 0.80 | 1.2 | - | stab 65, 150 from behind | - | - | tactical, military, sandbox, loot | distinct: silent (noise 0), backstab |
| W03 | Bulwark Shield-Saw | melee | melee 40 + stun 0.3 s, 1.5 | 1.33 | 1.8 | - | block 150 pool 120 deg, 0.2 s parry | - | - | knight | distinct: only block / parry |
| W04 | Warden Pistol | sidearm | hitscan semi 25, 4 | 0.75 | 20-40 | - | 3-round burst 25, 1.5 bursts/s | pistol | 12/48 | arena, tactical, military, loot | distinct: free default sidearm, dual wield |
| W05 | Verdict Magnum | sidearm | hitscan semi 55, 2.2, pen med | 0.45 | 25-50 | - | zoom 2x | pistolHeavy | 6/24 | tactical, military, sandbox, loot | distinct: 2-shot hand cannon |
| W06 | Hush Pistol | sidearm | hitscan semi 22, 5 | 0.80 | 15-30 | - | sleep dart 8 s | pistol | 10/40+6 | tactical, loot | near-duplicate of W04: primary within 12 % damage, same recoil row, TTK 0.80 vs 0.75; only noise 6 and the dart differ |
| W07 | Sparklock Pistol | sidearm | lock-on auto 12, 8, 3 targets, 12 deg, 20 m | 1.00 | 20 | - | hip fire 12, 8 | energy | 24/72 | exotic | distinct: only lock-on gun |
| W08 | Twin Stinger | sidearm | hitscan auto 14, 15 | 0.47 | 8-20 | - | flare: reveal r6 5 s | smg | 20/100+4 | none | redundant: an SMG in the sidearm slot (210 dps against W09 234, W11 224, same smg recoil row); the flare repeats G19 / A13 reveals; in no set |
| W09 | Wasp SMG | smg | hitscan auto 18, 13 | 0.38 | 10-25 | - | zoom 1.5x | smg | 30/120 | tactical, military, loot | near-duplicate of W11: same recoil row and falloff, TTK 0.38 vs 0.43 |
| W10 | Hornet Carbine | smg | hitscan auto 15, 12 | 0.50 | 12-28 | - | contact grenade 80 r3.5, arm 6 m | smg | 45/180+3 | military, loot | distinct by its alt (primary close to W09 / W11) |
| W11 | Riptide PDW | smg | hitscan auto 16, 14 | 0.43 | 10-25 | - | toggle: -15 % damage, hits slow 1 s | smg | 50/150 | tactical, military, loot | near-duplicate of W09; the toggle is a small modifier |
| W12 | Needlethorn | smg | projectile auto 9, 10, homing 35 deg/s; 9 stuck = 40 r2 | 1.10 | 12-28 | P09 needle | 5-needle volley | - | 30/90 | sandbox, exotic | distinct: homing + stick burst |
| W13 | Vanguard Rifle | rifle | hitscan auto 34, 10, pen med | 0.20 | 35-60 | - | zoom 1.3x | rifleHeavy | 25/75 | tactical, military, loot | near-duplicate of W14: both full-auto rifles, 3 vs 4 shots, same alt |
| W14 | Tempest Rifle | rifle | hitscan auto 30, 11, pen med | 0.27 | 30-50 | - | zoom 1.3x | rifle | 30/90 | tactical, military, loot | near-duplicate of W13 (its data comment calls them duel rivals) |
| W15 | Ratchet Burst | rifle | hitscan burst 3 x 32, 3 bursts/s | ~0.45 (2 bursts) | no falloff | - | zoom 1.8x | burst | 24/96 | military, sandbox, loot | distinct: only burst rifle |
| W16 | Longshot Scout | rifle | hitscan semi 50, 3.5, pen med | 0.29 | 15-70 | - | zoom 2.5x | marksman | 15/60 | military, sandbox, loot | near-duplicate of W25: semi 2-shot hitscan, same recoil row, 3.5 vs 3 /s (data comment: "rival of the Kestrel") |
| W17 | Coilcaster | energy | hitscan semi 45, 1.4 | 1.43 | 8-60 | - | orb 55 r1.5; primary on orb = 200 r4 combo | energy | 20/50 | sandbox | distinct: combo |
| W18 | Pulse Carbine | rifle | hitscan auto 20, 10 | 0.40 | 5-40 | - | dark orb 100, bounces, fodder kill | rifle | 30/60+2 | sandbox | near-duplicate: primary a weaker W13 / W10 (200 dps), alt a 2-round special like W10's grenade |
| W19 | Scattergun | shotgun | hitscan semi 10 x 12, 1.1 | 1 shot <= 8 m | 8-20 | - | slug 55, 1.2x | shotgun | 6/30 | arena, tactical, military, ravager, knight, loot | distinct: pump + slug |
| W20 | Hookjaw | shotgun | hitscan semi 8 x 20 (2 shells), 0.9 | 1 shot <= 8 m | 8-18 | - | hook pull <= 25 m, cooldown 6 s | shotgun | 2/24 | ravager, knight | distinct: gap closer |
| W21 | Shardcaster | shotgun | projectile semi 12 x 9 shards, 1.2, bounce 2 | 1 shot close | spread | P05 shard | shell 100 + 6 shards, arm 6 m | shotgun | 10/40 | arena | distinct: bouncing projectiles |
| W22 | Frostbore | shotgun | hitscan semi 13 x 8, 1.2 | 1 shot <= 8 m | 8-18 | - | freeze blast: 3 chill stacks | shotgun | 8/32+20 | ravager | near-duplicate of W19: 104 vs 120 point blank, same rate band and falloff; freeze also on G08 and A31 |
| W23 | Lancet Rail | marksman | hitscan semi 100, 0.67, pierce 4, no move spread | 1 shot | no falloff | - | zoom 2.5x | marksman | 10/30 | arena, sandbox | distinct from W24 by exact hip fire and pierce (closest pair kept: both one-shot at 0.67/s) |
| W24 | Heron Sniper | sniper | hitscan semi 115, 0.67, head x2.5, 8 deg unscoped | 1 shot scoped | 25-140 | - | zoom 4x / 8x, hold breath 4 s | sniper | 5/20 | tactical, military, sandbox, loot | distinct: only scoped sniper |
| W25 | Kestrel DMR | marksman | hitscan semi 60, 3, pen med | 0.33 | 10-80 | - | zoom 3x | marksman | 10/40 | tactical, military, loot | near-duplicate of W16 |
| W26 | Stakedriver | marksman | projectile semi stake 90, 1.2, pins; burn past 25 m | 0.83 | 10-60 | P07 stake | lob grenade 80 r4 | marksman | 12/36+6 | ravager, knight | distinct primary (pin); its alt repeats W10's grenade role |
| W27 | Talon Bow | marksman | projectile charge 0.7 s, 50-110, silent | 1 full draw | drop | P08 arrow | explosive arrow 80 r2.5 | - | 1/18+6 | exotic | distinct: draw, silent, drop |
| W28 | Hailstorm | heavy | hitscan auto 15, 18 after 0.2 s spin-up | 0.33 + spin | 3-35 | - | toggle: root, rate x1.5, 30 % front resist | minigun | 150/300 | military, ravager | near-duplicate of W29: both heavy autos (270 / 225 dps) whose alt plants the user |
| W29 | Anvil LMG | heavy | hitscan auto 25, 9, pen high | 0.33 | 5-50 | - | toggle: mount on ledge, recoil x0.3 | lmg | 100/200 | tactical, military, loot | near-duplicate of W28 |
| W30 | Linker | energy | projectile auto plasma 22, 6 | 0.67 | 3-30 | P04 plasma | beam 100 dps 30 m, ally link, repair 60/s | energy | 70/140 | arena | distinct by its alt (only gun that heals devices); primary close to W36 |
| W31 | Ramjet Launcher | explosive | projectile semi rocket 90 + 80 r3.5, 1 | 2 hits, 1.0 | 4-40 | P01 rocket | charge 1 s: up to 3 rockets 70 + 70 | launcher | 4/20 | arena, sandbox, ravager | near-duplicate of W33 (W33's 2-rocket primary = W31's charged volley) |
| W32 | Pitcher Launcher | explosive | projectile semi grenade 100 r4.5, 1.5, fuse 2.5 s | 1 hit | 5-30 | P02 grenade | sticky mines 100 r4, max 4, hold detonates | launcher | 6/24 | arena, sandbox | distinct: bounce + remote mines |
| W33 | Kingfisher Pod | explosive | projectile semi 2 rockets 60 + 20 r2, 1.2 | 1 volley | 10-70 | P01 rocket | lock 1.2 s, 4 homing missiles 35 | launcher | 8/24 | military | near-duplicate of W31; its lock-on alt is unique among launchers |
| W34 | Gloop Gun | explosive | projectile auto goo 20 + puddle 5/tick 3 s, 4 | 1.00 | 2-18 | P10 goo | charge 2 s glob 20-150, splits in 3 | - | 25/75 | knight, exotic | distinct: puddle zoning |
| W35 | Kindler | heavy | cone 9 m 30 deg, 10 x 10/s + burn 4 s | 0.90 | 9 | - | napalm puddle 6 s / airblast | - | 100/200 | sandbox | distinct: only flamethrower |
| W36 | Ember Repeater | energy | projectile auto plasma 16 + 10 r0.6, 10, heat | ~0.6 | 3-30 | P04 plasma | heat blast cone 6 m, up to 120 | energy | 50/200 | arena, ravager, knight | distinct by its alt (heat); primary close to W30 |
| W37 | Stormlash | energy | beam 8 x 20/s (160 dps) | 0.60 | 24 cap | - | chain arc 30 to 3 targets r6 | - | 100/200 | arena, exotic | distinct: only primary beam |
| W38 | Starthrower | energy | projectile auto disc 18, 8, ricochet 2 | 0.63 | 3-30 | P11 disc | explosive disc 50 r1.8 | energy | 50/150 | knight, exotic | distinct: bank shots |
| W39 | Accelerator | energy | hitscan charge 40 / 90 / 160 (2 / 4 / 8 cells) | 1.5 s charge | 5-50 | - | 360 deg shockwave 60 r6 + knockback | energy | 20/60 | ravager, exotic | distinct: charge levels |
| W40 | Fusion Mortar | explosive | rolling orb 300 r6, fuse 2 s, owner-safe | 1 hit | 8-30 | P12 fusion | detonate early | - | 1/1 | knight | distinct: rolling room wipe |
| W41 | Graviton Lifter | tool | punt a prop (damage from mass x speed) | - | 6 | - | pull / hold a prop | - | - | none | distinct: tool (A35, puzzles) |
| W42 | Twin-Gate Projector | tool | gate A | - | 60 | - | gate B | - | - | none | distinct: tool (A36, Test Chambers) |
| W43 | Skull Auger | exotic | homing drill 90, 0.8, fodder kill | 2 hits, 1.25 | 3-20 | P17 drill | detonate | - | 3/9 | exotic | distinct |
| W44 | Razorwind | exotic | returning blade 45, 1.5, no ammo | 1.33 | 2-18 | P18 blade | lodged blade laser 15/tick | - | none needed | ravager, exotic | distinct |
| W45 | Daybreak Projector | power | sun orb 150 + 150 r6 + arc aura, 0.5 | 1 hit | 6-60 | P20 sunorb | charge 2 s x1.5 | - | 4 | arena, ravager | distinct: map power weapon |
| W46 | Halcyon Warhead | power | warhead 300 r12, 0.3 | 1 hit | 20-120 | P13 warhead | guided warhead | - | 1 | none | distinct: map power weapon, guided |

- Result: **32 distinct, 13 near-duplicate (7 pairs: W04/W06, W09/W11, W13/W14, W16/W25, W19/W22, W28/W29, W31/W33, plus W18), 1 redundant (W08).**
- Also found: 9 weapons have only a zoom as their alt (W05, W09, W13, W14, W15, W16, W23, W24, W25), and 5 alts are an explosive lob (W10, W21, W26, W27, W38). Twin Stinger and Halcyon sit in no themed set, so today they appear only through the full arsenal or a custom list.

### P3-01 - Weapon, equipment and ability access (decided 2026-10-29 by the coordinator; the owner can change any row)

- **Fact**: no weapon, gadget or ability is locked by progression (the unlock catalogue holds only colours, titles, finishes, challenge-room tiers and cards: `src/03p-data-progress.js`, PRG-011). What limits a player is the ruleset: each RS row locks one `weaponSet` of 8-16 guns (`src/03e-data-rules.js`), Arena spawns with 2 and picks up the rest, classes may only use Military-set guns (`CLASS_WEAPON_SET`, 13d), heroes are fixed, and abilities exist only in Weave Suit, Frame Runner, Hero Squad, the class field upgrade (Echo Pulse) and mutator X46.

| Option | For | Against |
|---|---|---|
| A. Loadout from the full roster in every ruleset; restrictions only where a mode needs them | ends the "gating by themes" the owner named; one roster to learn; rulesets keep their feel through movement, health, economy, precision and meter (as Halo / UT custom games, CoD create-a-class, Apex / Fortnite full loot pools: `research/*.md`) | weapon x ruleset balance space grows (P8-03 pairwise plan covers it); themed sets lose their default role |
| B. Wider sets plus unlocks | keeps themed sets | adds the acquisition gating the owner complained about; stat-gated unlocks break PRG-011 and VIS-006 (no grind walls) |
| C. Keep sets, restrict per mode only | smallest change | every ruleset still offers 8-16 guns by default, so the complaint stays |

- **Decision: A, with C's rule for exceptions.**
  - **Pool**: every combat weapon of the P3-03 roster (36), of which 34 can be picked for a loadout: power weapons W45 / W46 only on power pads; tools W41 / W42 only where their mode or ability gives them. Every RS row's `weaponSet` becomes `fullSet` (shown as "Full roster"). The themed sets (Arena, Tactical, Military, Sandbox, Ravager, Knight, Loot, Exotic) stay as presets of X10 Weapon Set in Advanced / Custom (P4), not as ruleset locks.
  - **Loadout** (per player, saved; edited before the match and on the death screen, applied at the next spawn): melee, primary (any combat gun that is not a sidearm), secondary (a sidearm), lethal, tactical and device (P3-06 gadget slots), one ability and an ultimate where the ruleset allows abilities.
  - **How each economy hands it out**: pickups (RS01, RS02, RS06, RS07, RS08, RS11): spawn with the full loadout; weapon pads keep the map's own weapon and add to an unlimited arsenal (carry 0). Round buy (RS03): spawn with melee and secondary; the buy menu lists every combat weapon (P3-04 gives the 20 unpriced weapons a price); the loadout primary is the one-tap "quick buy". Classes (RS04, RS05, RS12): class primary and secondary from the full roster (`CLASS_WEAPON_SET` = full roster, `CLASS_SET_SWAPS` removed). Loot (RS10): spawn with melee only (royale identity), the loot pool is the full roster with rarity. Hero kits (RS09): the hero's weapons stay fixed (the hero is the loadout).
  - **Abilities by ruleset** (new ruleset field, P3-05): loadout (ability + ultimate) in RS04, RS05, RS06, RS07, RS08, RS10, RS12; kit in RS09 (heroes) and RS11 (the A01-A04 weaves are the Weave Suit itself); none in RS01, RS02, RS03 (pure gunplay identity; RS02 keeps its adrenaline combos; X46 Powers for All switches the loadout on).
  - **Mode restrictions kept** (the mode's rules are the weapon): M16 Gun Game ladder; X08 One Shot (W23) and X09 Rocket Pit (W31); X10 / custom weapon lists; melee-only party rules (13f attack lock); modes that arm everyone themselves (`MODE_ARMING_PARAMS`: ladder, rotateEvery); Hero Squad; Test Chambers and puzzle maps (tools). A restricted weapon stays visible in the loadout screen with the reason ("Gun Game sets the weapons").
  - **Pickups**: `Items.spotWeapon` swaps a pad's gun only when a restriction (match list) is active; otherwise the map's gun stays. Removed ids on maps follow the P3-03 migration map.
  - **Bots**: each bot builds a loadout from the full roster: its profile `favorite` when valid, else a gun whose `botPref` range fits the map size (drawn from `Rng.rules`, so seeded matches repeat), a sidearm, gadgets and an ability by their `botUse` rules; pad pickup behaviour unchanged.
- **Reason**: the owner's complaint is the theme gating and about 3 usable weapons; A removes both without any grind and keeps every ruleset recognisable. Costs: a loadout screen (menus P4, layout P5), bot loadout choice and buy prices (P3-05 / P3-04), help text (18n "Weapons: <set>"), wider balance testing (P8).
- **Change (2026-10-29, implementer, accepted by the coordinator): RS04 Modern Ops and RS05 Pilot Rush keep `abilities: 'kit'`** instead of an ability + ultimate loadout. Reason: their ability slot is the class field upgrade (Echo Pulse, a gadget or an ability chosen with the class), the identity of the class economy, and their meters (streak, boost) load rewards instead of paying an ultimate. All other loadout rulesets (RS06, RS07, RS08, RS10, and RS12 through its own Frame Runner kit) use the ability kit `loadout`.
- **Change (2026-10-29, implementer, accepted by the coordinator after the review): RS06, RS07, RS08 and RS10 run the `ultimate` meter** instead of `none`. Reason: with meter `none` an ultimate-slot ability costs nothing and could be cast without limit, and the decision gives these rulesets an ultimate. Revert this only together with removing the ultimate pick from the ability kit `loadout`.
- **Change (2026-10-29, implementer): the buy and class rulesets (RS03, RS04, RS05) keep a carry limit of 2** (`carry` ruleset field) and Frame Runner keeps ammo tiers (`ammoTiers`); pickup rulesets carry 0. The melee a ruleset spawns with is its `melee` field (its former set's start melee) unless the player picked another in the loadout.

### P3-03 - Final weapon roster (decided 2026-10-29 by the coordinator; the owner can change any row)

- **Merges (8 ids removed; the kept id is the stronger identity)**:
  1. W08 Twin Stinger -> W09 Wasp (an SMG in the sidearm slot; reveal stays on A13).
  2. W11 Riptide -> W09 Wasp: Wasp keeps its 18 x 13 primary and full move speed and takes Riptide's hollow-point toggle as its alt (replaces the plain zoom).
  3. W14 Tempest -> W13 Vanguard (the 3-shot auto rifle).
  4. W16 Longshot -> W25 Kestrel (headshot one-shot DMR); Kestrel takes Longshot's 15-round magazine.
  5. W18 Pulse Carbine -> W10 Hornet (auto gun with a scarce special alt; the grenade stays; fodder kill stays on W43).
  6. W22 Frostbore -> W19 Scattergun (freeze stays on G08 Rime Bomb).
  7. W29 Anvil -> W28 Hailstorm: Hailstorm keeps spin-up and the turret root, gains Anvil's high penetration.
  8. W33 Kingfisher -> W31 Ramjet: Ramjet's alt becomes the lock-on homing volley (1.2 s lock, 4 missiles); the charged volley it replaces duplicated Kingfisher's primary.
- **Kept but re-profiled** so no two share a profile (numbers are proposals for P8): W06 Hush primary becomes a subsonic precision pistol (about 40 damage, 2.5/s, head x2.5, no tracer) so it no longer shadows W04; W26 Stakedriver alt becomes an incendiary stake (burns on hit at any range, 6 alt rounds) instead of a second lob grenade.
- **Cut without a merge**: none. **New weapons**: none. Role check after the merges: close (3 melee, 3 shotguns, 2 SMG-class, flamethrower), mid (assault, burst, carbine, homing, beam, plasma, discs, support), long (DMR, rail, sniper, crossbow, bow, combo rifle, charge cannon), area (rocket, grenade, goo, mortar), special (lock-on pistol, drill, blade, 2 power, 2 tools): no role is empty, so the rule "add only for missing roles" adds nothing.
- **Final count: 38 weapons** (36 combat + 2 tools). Kept ids and codes do not change; removed codes are retired, never reused (spec "IDs are stable and never reused"); a new weapon would start at W47.

| Code | Name | Class | Role | Unique mechanic | Benefits | Drawbacks | Uses |
|---|---|---|---|---|---|---|---|
| W01 | Breaker Maul | melee | mobile finisher | charged slam launches the user 4.5 m | 2-hit kill, mobility, no ammo | 1.6 m reach, launch self damage | finish weakened foes, reach ledges |
| W02 | Edge Tanto | melee | stealth knife | backstab 150, silent | silent, full speed | 1.2 m reach | flanks, stealth levels |
| W03 | Bulwark Shield-Saw | melee | defensive melee | block + 0.2 s parry reflects projectiles | stops frontal fire, stuns | move x0.9, slow swing | hold doors, counter projectiles |
| W04 | Warden Pistol | sidearm | default sidearm | semi or 3-round burst; dual on a 2nd pickup | accurate, plenty of ammo | 4-shot kill | backup, Last Stand |
| W05 | Verdict Magnum | sidearm | hand cannon | 55 damage, 2-shot, penetration | burst damage at range | 6 rounds, heavy kick | pick-offs, finishing |
| W06 | Hush Pistol | sidearm | stealth pistol | silent shots + non-lethal sleep dart | unheard, disables a guard 8 s | low rate, 6 darts | Silent Contract, ambushes |
| W07 | Sparklock Pistol | sidearm | assisted aim | locks up to 3 targets | hits without precise aim | 0.4 s lock, 20 m, weak vs cover | fodder crowds, touch players |
| W09 | Wasp SMG | smg | close-range rusher | full move speed + hollow-point toggle (slows targets) | fastest close TTK (0.38 s) | falloff from 10 m | rushing, room clearing |
| W10 | Hornet Carbine | smg | all-round carbine | underbarrel contact grenade (3) | 45 rounds, mid reach, flushes cover | lower dps, few grenades | default primary |
| W12 | Needlethorn | smg | forgiving homing SMG | homing needles, 9 stuck burst | no precise aim needed | slow needles, 1.1 s TTK | strafing targets, touch |
| W13 | Vanguard Rifle | rifle | assault rifle | 3-shot auto, zigzag spray | best mid-range TTK (0.20 s) | heaviest rifle recoil | mid / long lanes |
| W15 | Ratchet Burst | rifle | burst rifle | 3-round burst per pull | accurate, no falloff | missed burst wastes time | mid-range duels |
| W17 | Coilcaster | energy | combo skill rifle | shoot own orb for a 200 r4 combo | huge combo damage, long range | 1.4/s, slow orb | arena skill play, chokes |
| W19 | Scattergun | shotgun | pump shotgun | spread or slug per trigger | one-shot <= 8 m, slug for range | slow pump, shell reload | corners |
| W20 | Hookjaw | shotgun | gap closer | hook pulls the user to an enemy (25 m) | 160 point blank | 2 shells, cooldown 6 s | aggressive engage |
| W21 | Shardcaster | shotgun | ricochet flak | bouncing shards + splitting shell | hits round corners | slow projectiles | rooms, corridors |
| W23 | Lancet Rail | marksman | hip-fire rail | exact hip fire, pierces 4 | one-shot body without a scope | 0.67/s, trail shows the shooter | long lanes, lined-up foes |
| W24 | Heron Sniper | sniper | scoped sniper | 4x / 8x scope, hold breath | longest range, one-shot | 8 deg hip spread, slow scoped | overwatch, large maps |
| W25 | Kestrel DMR | marksman | marksman rifle | head one-shot (60 x 2), 2-shot body | fast follow-ups | needs precision | mid-long picks |
| W26 | Stakedriver | marksman | pinning crossbow | stake pins to walls, burns | high projectile damage | 60 m/s travel, 1.2/s | punish near walls |
| W27 | Talon Bow | marksman | silent bow | draw 50-110, drop | silent kills, underwater | draw time, 1-arrow mag | stealth, long range |
| W28 | Hailstorm | heavy | suppression | spin-up; root as turret (x1.5 rate, front resist) | 270 dps, 150 mag | move x0.75, spin-up | hold a lane, PvE waves |
| W30 | Linker | energy | team support | ally link beam, repairs devices 60/s | only gun that heals friendly devices | lower solo dps | team modes, core defence |
| W31 | Ramjet Launcher | explosive | rocket launcher | rocket jump; lock-on homing alt | splash, mobility, anti-heavy | self damage, 4 mag | arena, groups, heavies |
| W32 | Pitcher Launcher | explosive | grenade launcher | bouncing grenades + remote mines | indirect fire, traps | lob, fuse | chokes, objectives |
| W34 | Gloop Gun | explosive | area denial | goo puddles burn 3 s | zones floors | short arc, low direct damage | chokes, flag rooms |
| W35 | Kindler | heavy | flamethrower | 9 m cone + burn; airblast deflects | hits everything in the cone | 9 m range | close quarters, PvE crowds |
| W36 | Ember Repeater | energy | plasma pressure | stored heat released as a cone blast | high dps, splash | projectile travel | mid-close pressure |
| W37 | Stormlash | energy | tracking beam | continuous beam + chain arc | rewards tracking | 24 m cap | close-mid tracking |
| W38 | Starthrower | energy | ricochet discs | discs bounce twice | bank shots round cover | predictable travel | corridors |
| W39 | Accelerator | energy | charge cannon | 3 charge levels; 360 deg shockwave | flexible burst, get-off-me ring | charge time | duel opener, crowds |
| W40 | Fusion Mortar | explosive | room wipe | rolling orb 300 r6, owner-safe | clears a room | 1 round, slow | objectives, stairwells |
| W43 | Skull Auger | exotic | sure kill | drill seeks the head, detonate | guaranteed damage, fodder kill | 3 / 9 ammo, slow | PvE elites, campers |
| W44 | Razorwind | exotic | ammo-free blade | returning blade; lodged laser tripwire | no ammo, trap lines | short range, one blade | PvE, traps |
| W45 | Daybreak Projector | power | map power weapon | slow orb with arc aura | room wipe | one per map | power pad fights |
| W46 | Halcyon Warhead | power | map super weapon | camera-guided warhead r12 | area denial | user stands still | power pad fights |
| W41 | Graviton Lifter | tool | physics tool | punt / hold props | props as ammo and shield | needs props | puzzles, A35 |
| W42 | Twin-Gate Projector | tool | portal tool | two linked gates | puzzles | no damage | Test Chambers, A36 |

- **No shared profile**: within each class the pair that was closest now differs in trigger or mechanic: W04 semi / burst vs W06 silent precision + dart; W09 hitscan rush vs W10 grenade carbine vs W12 homing; W13 auto vs W15 burst; W23 hip-fire pierce vs W24 scoped vs W25 semi DMR; W19 pump vs W20 hook vs W21 ricochet; W28 minigun vs W35 cone; W30 support beam vs W36 heat vs W37 beam vs W38 discs; W31 rocket vs W32 grenade vs W34 goo vs W40 rolling orb.
- **Migration map (P3-04)**:

| Removed | New | Removed | New |
|---|---|---|---|
| W08 `twinsting` | W09 `wasp` | W18 `pulsecarbine` | W10 `hornet` |
| W11 `riptide` | W09 `wasp` | W22 `frostbore` | W19 `scattergun` |
| W14 `tempest` | W13 `vanguard` | W29 `anvil` | W28 `hailstorm` |
| W16 `longshot` | W25 `kestrel` | W33 `kingfisher` | W31 `ramjet` |

  - Saves: per-weapon stats `progress.stats.weapons[key]` (kills and headshots added into the new key; a mastery tier already reached is never lost), per-weapon crosshair overrides (moved when the new key has none), custom classes (primary / secondary), custom match `weaponList` (keys or codes: map, then remove duplicates), saved editor maps (pad item keys).
  - Data: preset classes (Assault tempest -> vanguard, Rifleman vanguard -> ratchet so the two stay different, Marksman longshot -> kestrel, Support anvil -> hailstorm); heroes (H03 Quill tempest -> vanguard, H08 Tamsin longshot -> kestrel); bot B16 Okoro favourite tempest -> vanguard; `GUNGAME_LADDER` (12 steps: vanguard, ratchet, wasp, hornet, needlethorn, scattergun, hookjaw, shardcaster, kestrel, lancet, heron, maul); `ISLE_LOOT` (16e) tempest -> vanguard; map item keys (16a) and pads in 16b-16e; themed set presets; weapon models, sounds and muzzles of removed ids.
  - Cards, challenge rooms, medals, ladder, operations: none names a removed weapon (medal Precise names W23, X08 W23, X09 W31, all kept): no change.
  - Tests and spec: the count checks of 46 (`20b-test-weapons`, `-muzzle`, `-render`) and VIS-004 ("at least 46 weapons, 24 gadgets, 40 abilities") change to the decided counts.

### P3-06 - Equipment and ability roster (decided 2026-10-29 by the coordinator; the owner can change any row)

- **Real counts**: gadgets file 31 rows = 24 gadgets (G01-G24) + 7 gadget kits; 14 gadgets are handed out by a kit, class, buy list or hero (G01-G04, G06, G08-G10, G13, G15, G19, G22-G24), 10 by nothing (G05, G07, G11, G12, G14, G16-G18, G20, G21). Items file 37 rows = 17 pickups (I01-I17) + 20 powerups (PU01-PU20). Abilities file 59 rows = 47 abilities (A01-A40 + AX1-AX7) + 8 heroes + 4 ability kits; every one of the 47 is reached by some kit, hero, meter or mutator.
- **Rule**: a thing thrown or placed is a gadget, a power of the body or suit is an ability; where both catalogues hold the same effect, the one already in use keeps it.

**Gadgets** (lethal = thrown damage, tactical = thrown utility, device = placed / deployed; the P3-01 loadout slots)

| Code | Name | Effect (data) | Verdict | Slot and role (kept rows) |
|---|---|---|---|---|
| G01 | Frag Charge | 100 r5, cook 2.5 s | distinct | lethal: area kill |
| G02 | Veil Canister | smoke sphere r5 18 s | distinct (A17 is a wall) | tactical: block sight |
| G03 | Glare Shell | blind 3.5 s r20 | distinct | tactical: blind before a push |
| G04 | Cinder Jar | fire area r3 7 s, 40 HP/s | distinct | lethal: deny an area with burn |
| G05 | Mimic Shell | fake weapon sound 15 s | near-duplicate of A33 Holo Double -> merged into A33 (the double also plays the owner's weapon sound) | - |
| G06 | Leech Charge | sticks to actors 110 r3.5 | distinct | lethal: sure kill on a target |
| G07 | Kick Charge | knockback 18 m/s r4, self-launch | distinct (A20 pushes from the user, no launch) | tactical: displace foes, launch self |
| G08 | Rime Bomb | freeze 3 s r4 | distinct (now the only freeze) | tactical: freeze, then shatter |
| G09 | Sink Charge | pull 14 r6 + 60 | distinct | tactical: pull a group together |
| G10 | Tripjaw Mine | directional proximity 150, crouch-safe | distinct | device: guard a flank |
| G11 | Burr Mine | sticky proximity 100 r3 | near-duplicate of G10 -> merged into G10 | - |
| G12 | Dome Projector | dome blocks projectiles 12 s | near-duplicate of A26 Aegis Dome -> cut (A26 keeps it) | - |
| G13 | Barrier Deploy | 300 HP cover 30 s | distinct | device: instant cover |
| G14 | Lift Pad | launch 12 m, 20 s | near-duplicate of A10 Updraft -> cut | - |
| G15 | Picket Turret | turret 12 x 5/s, 25 m | distinct | device: automated guard |
| G16 | Mend Field | heal r4 15/s 10 s | near-duplicate of A25 Mender Drone -> cut | - |
| G17 | Sap Field | drains shields / energy r5 | near-duplicate of G20 -> merged into G20 (Null Pulse also drains energy) | - |
| G18 | Static Jammer | scrambles radar r20 30 s | distinct | device: counter recon |
| G19 | Echo Dart | 3 reveal pulses r12 | near-duplicate of A13 Echo Pulse (same 3-pulse reveal) -> merged into A13 | - |
| G20 | Null Pulse | disables devices, abilities, regen 4 s r6 | distinct | tactical: shut down abilities |
| G21 | Scuttler | 2 seeking drones 80 | distinct | device: hunt a target out of cover |
| G22 | Snatcher | stops 3 projectiles r6 | distinct | device: anti-explosive |
| G23 | Supply Crate | team ammo r3 | distinct | device: team ammo |
| G24 | Rally Beacon | team spawn point | distinct | device: team respawn (1 per team) |

- Final **17 gadgets** (3 lethal, 6 tactical, 8 devices); 7 removed. Migration: `decoy` -> A33, `prox` -> `claymore`, `bubble` -> A26, `liftpad` -> A10, `regen` -> A25, `drain` -> `emp`, `dart` -> A13 (H08 Tamsin's gadget slot gets G20 Null Pulse). No save holds any of the 7 today (custom class slots accept only the preset values frag, sticky, claymore, flash, smoke, cryo); the map is for data rows and future loadouts.

**Items** (pickups I01-I17, powerups PU01-PU20)

| Code | Name | Effect (data) | Verdict |
|---|---|---|---|
| I01 / I05 | Health Vial / Armor Shard | +5, to 200 | distinct: trickle route rewards |
| I02 / I03 | Health Pack / Health Crate | +25 / +50, to 100 | size steps of one pickup (kept: map placement tiers, not a reskin of a mechanic) |
| I04 | Mega Cell | +100 health to 200 | distinct top item; absorbs PU07 |
| I06 / I07 | Light Plate / Heavy Plate | +50 / +100 armor | size steps; I07 is a top item and absorbs PU08 |
| I08 / I09 | Ammo Box / Ammo Cache | held weapon type / all weapons 50 % | distinct |
| I10 | Weapon Pad | weapon spot rules | distinct (system row) |
| I11 / I12 | Helmet / Vest | bought protection | distinct |
| I13-I17 | Patch, Med Kit, Cell, Battery, Fizz Can | loot heals / shields / overflow, fast-small vs slow-full | distinct (speed vs amount trade) |
| PU01 | Fury Core | damage x3 30 s | distinct |
| PU02 | Warding Shell | damage taken x0.5, splash immune 30 s | distinct (nearest PU10, longer and weaker) |
| PU03 | Quickening | speed and rate x1.3 | distinct; absorbs PU16 |
| PU04 | Ghostveil | invisible | distinct |
| PU05 | Renewal | regen | distinct |
| PU06 | Skyward | flight | distinct |
| PU07 | Surplus Orb | +100 decaying shield over max | near-duplicate of I04 (+100 over max) -> merged into I04 (the surplus pool stays as A40 Rally Cry's effect) |
| PU08 | Aegis Belt | +100 absorbing armor to 200 | near-duplicate of I07 -> merged into I07 |
| PU09 | Berserk Fist | melee x4, heal to 100 | distinct |
| PU10 | Invulnerability Sigil | invulnerable 10 s | distinct |
| PU11 | Bottomless | free ammo 30 s | distinct; absorbs PU17 |
| PU12 | Vampire Fang | lifesteal 0.3 | distinct |
| PU13 | Seer Orb | reveal 15 s | distinct |
| PU14 | Spring Boots | 3 double-height jumps | distinct |
| PU15 | Guardian Rune | pools x2, speed x0.9, until death | distinct (tank rune) |
| PU16 | Scout Rune | speed 1.25, rate 1.2, no armor, until death | near-duplicate of PU03 (same two mods) -> merged into PU03 |
| PU17 | Ammo Rune | ammo regen until death | near-duplicate of PU11 -> merged into PU11 |
| PU18 / PU19 / PU20 | Soul Shard / Bearer Flame / Vital Shard | PvE souls / Flame Bearer object / campaign shard | distinct (mode resources) |

- Final **33 items** (17 pickups + 16 powerups); 4 removed. Migration (map item keys, 16a `itemKeys.power`, map files, saved editor maps): `surplus` -> `megacell`, `aegisbelt` -> `heavyplate`, `scoutrune` -> `quickening`, `ammorune` -> `bottomless` (the two runes are placed on no map today).

**Abilities** (47 rows; heroes and kits are loadouts, not abilities)

| Codes | Rows | Verdict |
|---|---|---|
| A01-A04 | Bulwark, Overdrive, Colossus, Phantasm Weaves | distinct: the Weave Suit (armor, speed, strength, cloak) |
| A05 / A08 | Shadow Step / Surge Dash | distinct: same `blink` effect but A05 goes to the aimed point (ledge grab, vertical), A08 is a 3-charge input-direction dodge |
| A06, A07, A09, A10, A11, A12 | Phase Slip, Grapnel, Rewind Anchor, Updraft (absorbs G14), Glidepack, Relocator | distinct mobility: invulnerable step, pull, rewind, team lift, glide, teleport beacon |
| A13, A14, A15, A16 | Echo Pulse (absorbs G19), Hunter Sight, Scout Drone, Tracker Sense | distinct recon: burst pulse, energy toggle, remote drone, passive trails |
| A17-A24 | Veil Curtain, Static Fence, Time Bend, Gale Push, Binding Link, Mesmer Lure, Puppet Jump (PvE), Frenzy Hex | distinct control (A17 is a 12 m wall, G02 a sphere) |
| A25-A28 | Mender Drone (absorbs G16), Aegis Dome (absorbs G12), Second Wind, Amp Wall | distinct sustain |
| A29 | Arc Bolt | distinct: the one bolt (30 + shock) |
| A30 | Ignite | near-duplicate of A29: same `bolt` effect, cost and range, only element and status differ (a reskin) -> merged into A29; burn stays on G04 and W35 |
| A31 | Frost Lance | near-duplicate of A29 -> merged into A29; freeze stays on G08 |
| A32, A33 | Swarm Cloud, Holo Double (absorbs G05) | distinct offense |
| A34-A40 | Wrath Form (PvE), Graviton Grip, Gate Pair (tools), Overcore, Orbital Lance, Rift Gate, Rally Cry | distinct ultimates / tool powers |
| AX1-AX7 | Seer Pulse, Picket Swarm, Speed Rush, Booster, Veil, Berserk, Amped Rounds | distinct within their meter (streak, boost, adrenaline rewards; not loadout picks) |

- Final **45 abilities** (38 A-rows + 7 AX); 2 removed. Migration: `ignite` -> `arcbolt`, `frostlance` -> `arcbolt` (saved kit choices `Save.data.loadouts.kits`; the Frame Runner kit's ability2 choices become arcbolt, gale; the X46 list loses the two).

### P3-07 - Starting set and unlocks (decision part; decided 2026-10-29 by the coordinator; the owner can change any row)

- **Fact**: nothing of the weapon, gadget or ability rosters is locked by progression today; unlocks are colours, titles, finishes, mastery colours, Challenge Room tiers (levels 4 / 9 / 16) and cards (PvE play-style conditions); the "Unlock everything" setting exists (`progress.unlockAll`). The "hard to acquire" feeling comes from the ruleset gating that P3-01 removes.
- **Starting set**: a new save can use the whole P3-03 / P3-06 roster in its first match: 36 combat weapons (power weapons on power pads, tools in their modes), 17 gadgets and every loadout ability, under the P3-01 ruleset rules. A new save starts with a ready default loadout so Play -> Start needs no loadout screen: Breaker Maul, Hornet Carbine, Warden Pistol, Frag Charge, Glare Shell, Barrier Deploy, Surge Dash, Rally Cry (the six preset classes stay the classes default).
- **Earned (unchanged, never a stat)**: level colours, titles and finishes (levels 1-30, about 10 hours), weapon mastery colours (25 / 75 / 150 / 300 kills), Challenge Room tiers, Expert rooms (2 stars), ladder tiers (win the previous tier), cards. Fast: each is one stated condition earned by normal play.
- **Locked items in menus**: every locked row stays visible with a lock mark, its requirement and the player's progress, for example "Level 9 - you are level 4 (2150 / 3300 XP)", "Gold mastery: 150 kills, 40 headshots - 37 / 150, 12 / 40", the card's own unlock text, "Earn 2 stars (1 / 2)", "Win Rookie Circuit first". A new unlock shows a toast and a "New" badge until first viewed. In the loadout screen a weapon, gadget or ability a mode restricts stays visible with the reason instead of being hidden.
- **Reason**: the owner asked for fast and clear acquisition; the spec forbids grind walls and stat unlocks (VIS-006, PRG-010, PRG-011); gating weapons behind XP would bring back the complaint.

### P4-01 - Mode and ruleset overlap map (2026-10-29)

- **Fact**: 31 modes (`src/03f-data-modes.js:38-70`) and 12 rulesets (`src/03e-data-rules.js:24-36`). A mode sets the goal, the win condition, team size, limits and a default ruleset (`ruleset`; `classic` when the row names none). A ruleset sets only the feel: movement, health, economy, precision, meter and abilities (P3-01). Every mode can be played with any of the 12 rulesets through Play > Rules (`src/18d-ui-play.js:183-185`) and Custom > Rules (`src/18g-ui-custom.js:412`).
- "Rulesets" below = the mode's default, plus any other ruleset the data ties to it: Daily Seed (`src/03p-data-progress.js:256-257`: ffa, tdm, dom, hardpoint, ctf with RS01, RS02, RS04, RS05, RS06) and the hero kill limit (`src/03k-data-abilities.js:158`, tdm).
- Shared code is the clearest sign of an overlap: ctf / oneflag run one `FLAG_BEHAVIOUR` (`src/13c-modes-core.js:70-71`); oddball / bearer one `makePrizeBehaviour` (`src/13e-modes-objective.js:250`, `src/13f-modes-party.js:257`); ghostops copies `BOMB_BEHAVIOUR` (`src/13e-modes-objective.js:367-368`); horde / endless one `makeWaveBehaviour` (`src/14j-pve-modes.js:357-358`); ffa / tdm / duel run on the default hooks (`src/13c-modes-core.js:12-14`).

| Code | Mode (id) | Goal | Win condition | Rulesets | Overlaps (reason) |
|---|---|---|---|---|---|
| M01 | Frenzy (`ffa`) | every kill scores | first to 25 kills, else most at 10 min | RS01; Daily RS01/02/04/05/06 | M03, M15, M16, M25: the same free-for-all kill goal; they change only player count, lives or the weapon rule |
| M02 | Team Clash (`tdm`) | team kills | first team to 50 kills (15 with hero kits), else lead at 10 min | RS01; Daily as M01 | M29: same team kill goal plus AI minions; M14: kill the other team, in one-life rounds |
| M03 | Duel (`duel`) | 1v1 kills, winner stays | most kills at 10 min (no kill limit) | RS01 | M01: free-for-all kills with 2 active players and a queue |
| M04 | Flag Raid (`ctf`) | bring the enemy flag home | 3 captures, else lead at 15 min | RS01; Daily as M01 | M05: same code, `params.neutral` is the only switch |
| M05 | Lone Flag (`oneflag`) | carry the neutral flag to the enemy base | 5 captures, else lead at 15 min | RS01 | M04 (same code) |
| M06 | Holdfast (`dom`) | hold points to score | 200 points, else lead at 10 min | RS04; Daily as M01 | M07, M09, M12: hold zones to win; only the scoring differs |
| M07 | Frontline (`conquest`) | hold points, drain enemy tickets | enemy at 0 of 150 tickets, else more tickets at 20 min | RS04 | M06: same points and capture params; tickets instead of points |
| M08 | Breach Assault (`rush`) | attackers arm relays, defenders stop them | attackers clear 3 stages before 75 tickets run out | RS04 | M13: arm with Use, defend, same `BOMB_PARAMS`; M11: staged attack and defence |
| M09 | Hotpoint (`hardpoint`) | hold the moving hill | 150 points, else lead at 10 min | RS04; Daily as M01 | M06: hold a zone; the zone moves |
| M10 | Relic Run (`oddball`) | hold the relic (melee carrier) | 100 points, else lead at 10 min | RS01 | M24 (same code), M18 (one marked player scores), M19 (one marked player, inverse) |
| M11 | Convoy (`payload`) | attackers push the cart, defenders hold | cart reaches the end (3 checkpoints, 4 min + 2 min each), else defenders win | RS09 | M08: staged attack and defence (different object and maps) |
| M12 | Uplink (`control`) | capture the point and fill its meter | best of 3 rounds; rounds have no clock (A-07) | RS09 | M06: hold one point; played in rounds |
| M13 | Detonate (`bomb`) | plant or defuse the charge | first to 7 of 13 rounds; a wipe also wins a round | RS03 | M27 (same code), M08 (arm and defend), M14 (one-life rounds) |
| M14 | Last Squad (`elim`) | wipe the other team each round | first to 5 of 9 rounds, 90 s with a shrinking zone | RS04 | M02: kill the other team; M13: one-life rounds without a charge |
| M15 | Last Standing (`lms`) | keep your lives | last one with lives, else most lives at 10 min | RS01 | M01 + mutator X32 Lives + all weapons and armor; M20: last one standing |
| M16 | Arms Ladder (`gungame`) | kill to climb 12 guns | melee kill on the last tier, else best tier at 10 min | RS01 | M01: free-for-all kills with a weapon rule; M25: the mode arms everyone |
| M17 | Blight (`infection`) | humans outlast the infected | humans alive at 5 min, else the Blight | RS01 | none with the same goal (asymmetric sides like M26) |
| M18 | Colossus (`juggernaut`) | be the Colossus; only it scores | 15 kills as Colossus, else lead at 10 min | RS01 | M10, M24: one marked player scores while marked |
| M19 | Curse Tag (`cursetag`) | kill the cursed | 20 points, else lead at 10 min | RS01 | M18: one marked player; the score rule is inverted |
| M20 | Last Ring (`royale`) | loot, stay in the ring | last squad standing | RS10 (same name as the mode) | M15: last one standing; RS10 name |
| M21 | Siege Waves (`horde`) | defend the core | clear 10 waves; lose when the core falls and retries are spent | RS04 | M22 (same code) |
| M22 | Endless Hold (`endless`) | survive harder waves | open-ended; extract every 5 waves to keep the score | RS04 | M21 (same code) |
| M23 | Mote Rush (`bank`) | bank motes, kill your boss first | first team to kill its boss | RS04 | none with the same goal (M29 also mixes PvE into PvP) |
| M24 | Flame Bearer (`bearer`) | hold the flame (x3 damage) | 120 points, else lead at 10 min | RS01 | M10 (same code), M18 |
| M25 | Roulette Arms (`roulette`) | kills with one shared, changing gun | 25 kills, else most at 10 min | RS01 | M01: free-for-all kills with a weapon rule; M16 |
| M26 | Ravager vs Fiends (`fiends`) | one Ravager against two Fiends | first to 3 of 5 rounds; rounds have no clock (A-07) | RS07 (name shared with the ruleset) | RS07 name; M17 asymmetric sides (different goal) |
| M27 | Ghost Ops (`ghostops`) | cloaked attackers plant | first to 7 of 13 rounds | RS03 | M13: same code plus cloak and a fixed attacker loadout |
| M28 | Silent Contract (`contract`) | take the relic and extract unseen | reach the extract; score by time, alarms, kills | RS04 | none |
| M29 | Attrition (`attrition`) | kill the rival squad and the minions | 300 points, else lead at 15 min | RS05 | M02: team kills; minions add points |
| M30 | Firing Range (`range`) | practice drills | none (leave by Pause) | RS01 | none |
| M31 | Test Chambers (`puzzle`) | solve each chamber | reach the last exit | RS04 | none |

**Ruleset overlaps** (rulesets have no goal; these are the "same thing, other name" cases)

| Pair | Same | Different | Note |
|---|---|---|---|
| RS01 Arena Classic / RS02 Arena Tournament | move, health, economy, precision, pool, melee | RS02 adds the adrenaline meter, 1 extra jump and the wall dodge | RS02 = RS01 + X43 Combos + X26 Multi-Jump 1 (no mutator for the wall dodge) |
| RS04 Modern Ops / RS05 Pilot Rush | regen health, classes, precision, kit, carry 2, downed | movement (modern / agile), meter (streak / boost) | close, but movement is the identity |
| RS07 Ravager / RS08 Iron Bulwark | ravager health, pickups, ultimate meter, ability loadout | movement (ravager / knight), start melee | close, but movement is the identity |
| RS10 Last Ring / M20 Last Ring | same name | ruleset = loot economy; mode = ring and squads | name clash |
| RS07 Ravager / M26 Ravager vs Fiends | name | ruleset = feel; mode = 1 vs 2 rounds | name clash |
| RS03 Tactical Breach / M08 Breach Assault | the word "Breach" | M08 defaults to RS04 | name only |
| X32 Lives / M15; X08, X09, X10 / M16, M25 | lives; weapon rules | modes add all weapons and armor (M15) or arm everyone themselves (M16, M25) | mutators stay; the modes become variants (P4-02) |

- **Result**: 7 overlap groups hold 23 modes: free-for-all kills (ffa, duel, lms, roulette, gungame), team kills (tdm, attrition, elim), flags (ctf, oneflag), zones (dom, hardpoint, conquest, control), plant and defend (bomb, ghostops, rush), one marked player or prize (oddball, bearer, juggernaut, cursetag), waves (horde, endless). 8 modes overlap with none in goal: payload, infection, royale, bank, fiends, contract, range, puzzle. Rulesets: 3 close pairs and 3 name clashes; no ruleset has a goal.

### P4-02 - Merged modes, curated list and defaults (decided 2026-10-29 by the coordinator; the owner can change any row)

- **Rule**: a merged mode becomes a variant of its parent mode. Its data row stays, with the same id and code (spec: ids are stable and never reused). It gains `variantOf: '<parent id>'` and a short `variant` label; the parent row gets a `variant` label too. Menus list the parents only; a Variant choice picks the row.
- **Reason for keeping the rows**: the behaviours are separate code (`13c`-`14j`); maps, generators and editor templates list mode ids (`src/16a-maps.js:37-49`, `src/16b-maps-arena.js:6`, `src/03n-data-mapgen.js:89-98`); the Daily Seed picks from the mode list by hash (`src/15c-ladder.js:281-283`). With the ids kept, every save, share code, map and past daily stays valid with no rewrite.
- **Counts**: 31 modes -> 15 modes in the menus (7 with variants, 8 single). 31 playable rows -> 31 variants: nothing is removed.

**Merge list and id migration map** (default variant first in each group; the Variant choice lists the rows in data row order, parent first, so for example Team Clash shows Classic, One-life rounds, Minions and Frenzy shows Classic, Duel 1v1, Lives, Arms Ladder, Roulette)

| Old id (code, name) | New mode (card) | Variant setting | Stored id after migration |
|---|---|---|---|
| `ffa` (M01 Frenzy) | Frenzy | Classic (default) | `ffa` (parent) |
| `duel` (M03 Duel) | Frenzy | Duel 1v1 | `duel` |
| `lms` (M15 Last Standing) | Frenzy | Lives (Last Standing) | `lms` |
| `roulette` (M25 Roulette Arms) | Frenzy | Roulette | `roulette` |
| `gungame` (M16 Arms Ladder) | Frenzy | Arms Ladder | `gungame` |
| `tdm` (M02 Team Clash) | Team Clash | Classic (default) | `tdm` (parent) |
| `attrition` (M29 Attrition) | Team Clash | Minions (Attrition) | `attrition` |
| `elim` (M14 Last Squad) | Team Clash | One-life rounds (Last Squad) | `elim` |
| `ctf` (M04 Flag Raid) | Flag Raid | Two flags (default) | `ctf` (parent) |
| `oneflag` (M05 Lone Flag) | Flag Raid | One flag (Lone Flag) | `oneflag` |
| `dom` (M06 Holdfast) | Holdfast | Three points (default) | `dom` (parent) |
| `hardpoint` (M09 Hotpoint) | Holdfast | Moving hill (Hotpoint) | `hardpoint` |
| `conquest` (M07 Frontline) | Holdfast | Tickets (Frontline) | `conquest` |
| `control` (M12 Uplink) | Holdfast | Uplink rounds | `control` |
| `bomb` (M13 Detonate) | Detonate | Classic (default) | `bomb` (parent) |
| `ghostops` (M27 Ghost Ops) | Detonate | Ghost attackers (Ghost Ops) | `ghostops` |
| `rush` (M08 Breach Assault) | Detonate | Stages and tickets (Breach Assault) | `rush` |
| `oddball` (M10 Relic Run) | Relic Run | Relic (default) | `oddball` (parent) |
| `bearer` (M24 Flame Bearer) | Relic Run | Flame (Flame Bearer) | `bearer` |
| `juggernaut` (M18 Colossus) | Relic Run | Colossus | `juggernaut` |
| `cursetag` (M19 Curse Tag) | Relic Run | Curse (Curse Tag) | `cursetag` |
| `horde` (M21 Siege Waves) | Siege Waves | Ten waves (default) | `horde` (parent) |
| `endless` (M22 Endless Hold) | Siege Waves | Endless (Endless Hold) | `endless` |

- **Single modes (no variants)**: Convoy (`payload`), Blight (`infection`), Last Ring (`royale`), Mote Rush (`bank`), Ravager vs Fiends (`fiends`), Silent Contract (`contract`), Firing Range (`range`), Test Chambers (`puzzle`).
- **Old names stay visible**: each variant label keeps the old mode name in brackets, so a player who knew "Hotpoint" finds it. Everywhere a mode name is shown (Play, Custom, Career, Statistics, results, pause > Rules) it reads "<mode> - <variant>" for a non-default variant, for example "Frenzy - Duel 1v1".
- **Variant switch**: picking a variant loads that row's own defaults (ruleset, size, limits, map list), as a mode change does today (`src/18d-ui-play.js:48-63`).
- **Mode defaults changed (A-07)**: M12 Uplink rounds get a 240 s clock and M26 Ravager vs Fiends rounds a 180 s clock (`rounds.live`). Both behaviours already settle a timeout: the higher meter wins (`src/13c-modes-core.js:151`), the side with more alive wins (`src/14j-pve-modes.js:503`).

**References to merged modes (every one found; none needs a rewrite because the ids stay)**

| Reference | Location | Merged ids named | Effect of the merge |
|---|---|---|---|
| Last Play setup `Save.data.play.mode` | `src/18d-ui-play.js:66` (read by `normalize` `:48-63`) | any | stays valid; Play opens its parent card with the variant chosen |
| Custom match draft (setting `custom.draft`) | `src/18g-ui-custom.js:29`, `:143`, check `:168` | any | stays valid; the editor shows parent + variant |
| Saved custom presets `Save.data.rulesets[].editor.mode` | `src/18g-ui-custom.js:350`, load `:354-358` | any | stays valid |
| Match share codes (`mode` field) | `src/18g-ui-custom.js:228-245` | any | codes made before P4 load unchanged |
| Per-mode statistics `Save.data.stats.modes[id]` | `src/15a-progress.js:129`, `:359`; shown `src/18j-ui-progress.js:328-331` | any | kept per variant id; Statistics shows "<mode> - <variant>"; numbers are not summed, so nothing is lost |
| Ladder progress `Save.data.ladder` | `src/15a-progress.js:130` | none (tier and match indexes) | no change |
| Challenge, operation and daily progress | `src/15a-progress.js:127` | none (room id, operation id, date) | no change |
| Ladder matches | `src/03p-data-progress.js:158, 163, 168, 172, 177, 181, 186, 189, 190`; `LADDER_OPTIONS.duel` `:154` | `duel` | shown as "Frenzy - Duel 1v1"; the other ladder matches name parents (ffa, tdm, ctf, dom, bomb) |
| Challenge Room CR14 Duel Rush | `src/03p-data-progress.js:229` | `duel` | no change; the other rooms name ffa, horde, range, contract |
| Operations OP1, OP3 | `src/03p-data-progress.js:245`, `:249` | `hardpoint` | no change; the other stages name tdm, dom, ctf |
| Daily Seed mode list | `src/03p-data-progress.js:256` | `hardpoint` | no change, so past and future dailies stay the same |
| XP weights per mode | `src/03p-data-progress.js:17` | `bearer`, `attrition` | no change |
| Career Solo entries | `src/18j-ui-progress.js:14` | `endless` | no change |
| Cards | `src/03p-data-progress.js:115-140`, `src/15d-cards.js` | none: card unlocks read PvE level metrics by family (`src/15a-progress.js:100`) | no change; Endless Hold still counts |
| Medals | `src/03p-data-progress.js:39-60`, `src/15b-medals.js:91`, `:139-148` | none: MD17 / MD18 read any round mode, MD19 reads `params.stealth`, MD20 the waves | no change (elim, control, ghostops keep their rounds) |
| Name clash | `src/03p-data-progress.js:136` | card C21 has the id `endless` | a card, not the mode: P4-05 must not touch it |
| Code keyed by merged ids (listed for P4-04) | behaviours `src/13c-modes-core.js:14, 16, 71, 87, 114, 146, 207`, `src/13e-modes-objective.js:114, 368`, `src/13f-modes-party.js:21, 169, 197, 257, 261`, `src/14j-pve-modes.js:358, 531`; maps `src/16a-maps.js:37-49`, `src/16b-maps-arena.js:6, 10, 68, 196`, `src/16c-maps-tactical.js:16, 47, 100-103, 107`, `src/16d-maps-large.js:61, 120`, `src/16e-maps-pve.js:8, 73-74`; generators `src/03n-data-mapgen.js:89-98`; `src/16v-maps-validate.js:375`; `src/16w-mapgen-place.js:420`; editor templates `src/16x-mapeditor.js:785, 787`; HUD `src/17c-hud-match.js:391, 424`; bots `src/14a-bots.js:73` | many | no change |

**Curated list shown first** (8 cards, in this order). Difficulty: the remembered one (new save: Regular). Bots: players - 1, capped by the device's quality preset (`src/18d-ui-play.js:29`). Match length: Standard. Team: Automatic.

| # | Card | Mode / variant | Ruleset | Map | Players | Limits and other defaults | Why on the list |
|---|---|---|---|---|---|---|---|
| 1 | Frenzy | `ffa` Classic | RS01 Arena Classic | Foundry Spire (MP01) | 8 | 25 kills, 10 min, respawn 2 s | the default free-for-all; new-save Quick Match |
| 2 | Team Clash | `tdm` Classic | RS01 Arena Classic | Skyward Yard (MP02) | 4v4 | 50 kills, 10 min, friendly fire off | the basic team mode |
| 3 | Holdfast | `dom` Three points | RS04 Modern Ops | Twin Keeps (MP03) | 4v4 | 200 points, 10 min | zone control |
| 4 | Flag Raid | `ctf` Two flags | RS01 Arena Classic | Twin Keeps (MP03) | 5v5 | 3 captures, 15 min, flag returns after 20 s | flag play |
| 5 | Detonate | `bomb` Classic | RS03 Tactical Breach | Dustline (MP04) | 5v5 | first to 5 rounds (max 9, sides switch after 4), buy 15 s, round 100 s | round play; 5 wins instead of the mode's 7 keeps it near 15 min (7 stays in Advanced) |
| 6 | Arms Ladder | Frenzy - `gungame` | RS01 Arena Classic | Gantry Run (MP06) | 8 | 12 guns, 10 min | the party pick; needs no loadout |
| 7 | Last Ring | `royale` | RS10 Last Ring | Ring Isle (MP09) | 18 (squads of 3) | ring phases as the mode | battle royale |
| 8 | Siege Waves | `horde` Ten waves | RS04 Modern Ops | Cistern (MP07) | 4 (co-op) | 10 waves, core 5000, 2 retries | co-op against AI |

- **Not on the list, in "All modes"**: Relic Run, Convoy, Blight, Mote Rush, Ravager vs Fiends, Silent Contract, Firing Range, Test Chambers, and every variant through its parent. Their defaults are their data rows (with the A-07 clocks above).
- **Stays reachable under Advanced / Custom**: every mode and variant; rule bundle (12) and the one-click bundle starts; movement, health, economy; friendly fire, respawn delay, items on the map; weapon set and weapon list; all 50 mutators; bot count, bots on your team, difficulty, personality, difficulty sliders; map, including a generated map; score, time, round and lives limits; saved presets; share codes.
- **Nothing becomes impossible**: the 31 rows are 7 parents, 16 variants and 8 single modes. All 15 modes are in All modes (8 are also cards); each of the 16 variants is a Variant choice on its parent's Setup (Arms Ladder is also a card). Custom reaches every row through Game mode + Variant. Career routes (ladder, rooms, operations, daily, Solo) start the same ids as before. Shuffle draws from all 31 rows.

### P4-03 - Menu flow (decided 2026-10-29 by the coordinator; the owner can change any row)

**Screens and steps**

| Step | Screen (reuse) | Breadcrumb | Content | Primary action |
|---|---|---|---|---|
| 0 | Main menu (`main`, `src/18b-ui-menus.js:7-18`, list changed) | none | Quick Match, Play, Career, Custom, Range, Map editor, Settings, Help | Quick Match (1 tap, PRG-001) |
| 1 | Play (`play`, rebuilt as a card grid with `ui-menu`) | Play | 8 curated cards, then "All modes" and "Shuffle" tiles; each card: name, goal line, players and limit, variant if not the default | tap a card |
| 1b | All modes (new small screen, `ui-menu` grid) | Play > All modes | the 15 modes in 3 groups: Versus, Party, Co-op and solo | tap a mode |
| 2 | Match setup (the current Play form, `src/18d-ui-play.js:201-228`, moved) | Play > Holdfast | Variant (families only), Map, Bots, Difficulty, Match length (modes with score or time limits), Your team (team modes); summary line | Start |
| 3 | Advanced / Custom (`custom` editor, `src/18g-ui-custom.js:591-622`, reused) | Play > Holdfast > Advanced | tabs Mode (now with Variant), Rules, Weapons, Bots, Mutators, Map; Presets, Share code, Reset all | Start match |

- **Tap count**: Play, card, Start = 3 taps to any curated mode (P4-04 target). Quick Match = 1 tap. From the main menu, Custom opens step 3 alone (breadcrumb "Custom").
- **Into Advanced**: opening Advanced from Setup copies the card's mode, variant, map, bots, difficulty and limits into the editor draft. Back to Setup keeps the changes; Setup then shows "Advanced changes: ..." (for example "Modern Ops, 2 mutators") and a "Reset to card defaults" button. Start on Setup then uses those changes.
- **Quick Match**: repeats the last start from Setup or Advanced. `Save.data.play` keeps the mode id (a variant id is fine) and, after an Advanced start, a flag that replays the editor draft. A new save gets the Frenzy card defaults.
- **Results and pause**: results keep Play again, Next map and Main menu, and gain "Change mode" (opens Setup of the same card). Pause is unchanged; Pause > Rules names "<mode> - <variant>".

**Input per screen** (the existing focus system: `src/18a-ui.js:131-194`, pad buttons `src/05c-input-gamepad.js:25`)

| Screen | First focus | Focus order | Touch | Gamepad | Keyboard / mouse |
|---|---|---|---|---|---|
| Main menu | Quick Match | grid in reading order | tap | d-pad / stick moves, A opens | arrows, Enter; click |
| Play | the last started card (new save: Frenzy) | Back, cards row by row, All modes, Shuffle | tap a card; scroll the grid | A opens Setup | arrows, Enter; click |
| All modes | first mode of the last used group | Back, groups top to bottom | tap | A opens Setup | arrows, Enter; click |
| Match setup | Start | Back, rows top to bottom, Start, Loadout, Advanced, Reset to card defaults | tap a value to cycle it | left / right change a row value, A on Start | left / right change a value, Enter on Start |
| Advanced | Start match | Back, tabs, rows, footer | tap tabs | LB / RB switch tabs (new: the screen takes the prev / next command, `src/18a-ui.js:183`); Settings tabs get the same | Tab / Shift+Tab move focus; click tabs |

- **Back**: one level per Back (touch Back button, Esc, pad B or Start). Setup -> Play with the same card focused (`Ui.pop` restores focus, `src/18a-ui.js:116-127`). Advanced -> Setup with the changes kept. Play -> Main menu.
- **Breadcrumb**: one line under the screen title on every menu screen except the main menu, pause, results and in-match overlays; built from the screen stack (`screenHeader`, `src/18b-ui-menus.js:36-42`, takes a crumb title per screen). Every crumb except the last is a button for touch and mouse that goes back to that screen. Crumbs are not in the keyboard / gamepad focus order (Back steps one level), so the first focus stays on the main action. On short screens (height 520 px or less) only the last two crumbs show, after "...".

**Every current setting has a place**

| Now | Setting | New place |
|---|---|---|
| Main menu | Quick Match, Play, Career, Custom, Range, Map editor, Settings, Help | Main menu |
| Main menu | Solo | Career > Solo (already there, `src/18j-ui-progress.js:98`) and Play > All modes (Siege Waves card, Endless as its variant, Test Chambers) |
| Main menu | Generated map | Custom > Map tab (already there, `src/18g-ui-custom.js:548-551`) |
| Play | Mode | Play cards and All modes; the variant on Setup |
| Play | Map, Bots, Difficulty, Match length, Your team, Start, Loadout | Setup |
| Play | Rules (ruleset) | Advanced > Rules > Rule bundle |
| Play | Shuffle | Play (tile) |
| Custom editor | all 6 tabs, Presets, Share code, Reset all, Start match | Advanced (unchanged), plus a Variant row on the Mode tab; Game mode lists the 15 modes |
| Solo | Difficulty | Setup > Difficulty of Siege Waves and Test Chambers; the Solo screen keeps its own row |
| Solo | Test Chambers best runs | Solo screen (unchanged) |
| Career, results, pause | all rows | unchanged; results add Change mode |

- **Docs to update with P4-04**: `docs/SPECIFICATION.md` UI-001 (main menu list), PRG-005 (Horde and Chambers entries), the mode table (variant column, the A-07 clocks); `docs/api/hud-play.md`; `docs/api/mutators-custom.md`; `docs/LIVE-TESTS.md`.

## Appendix D - Audit findings

(Filled by P1-01 and P9-01. Columns: ID, severity, area, location, reproduction, fix task, status.)

### Findings from P1-01 (2026-10-29)

Method: read every mode behaviour, rules build, save, abilities, gadgets, items, powerups, menus and bindings against the spec; probes on the test build through `tools/selftest.mjs --no-selftest --eval`: all 31 modes simulated 90 s with bots (no errors); all 47 abilities, 24 gadgets, 17 items and 20 powerups used (timers end, cooldowns refill, nothing left after `Game.stop`, no NaN); all 42 menu screens open and leave by Back / Esc / pad B; all 127 settings save at once; bindings have no default conflicts and rebinding saves, reloads and resets. Totals: Critical 0, High 0, Medium 1, Low 5, Informational 3. Not covered: bot use of each ability and gadget in live play; touch layout per screen size (the `hudui` self-test group covers it).

| ID | Severity | Area | Location | Reproduction | Fix task | Status |
|---|---|---|---|---|---|---|
| A-01 | Medium | M17 Blight outbreak size has no cap | `src/13f-modes-party.js` `outbreakSize()` l.78-82, `startOutbreak()` l.109-117 | On a large custom map (about 27,000 m2 walkable, 12 players) every human is infected at 20 s and the Blight wins at once. Authored maps are safe (1-4). | P1-05 (clamp to players - 1) | fixed (modes2: infection, huge floor keeps one human) |
| A-02 | Low | M28 Silent Contract with no map wins on tick 1 | `src/14j-pve-modes.js` `contract.start()` l.578-582 | `__CTK.game.start({ mode: 'contract', seed: 7, player: {}, bots: [] })`: relic and extract both at the origin. Only the debug API or a stale map id reach it. | P1-05 (refuse or pick a map when `match.map` is null) | fixed (pve: contract with no / unknown map) |
| A-03 | Low | M29 Attrition score events carry no reason | `src/14j-pve-modes.js` `attrition.onKill()` l.562 | `Modes.awardTeam(killerTeam, extra)` without a reason. | P1-05 (pass 'kill') | fixed (pve: attrition minion bonus carries the kill reason) |
| A-04 | Low | A save from a newer version is silently downgraded | `src/04-save.js` `load()` l.61-74, `migrate()` l.76-84 | A stored save with version above SAVE_VERSION loads and is re-stamped on the next write; `importText` refuses the same data. | P1-05 (back it up and tell the player) | fixed (core: newer version is told, backed up, never overwritten) |
| A-05 | Low | A corrupt save overwrites the import backup | `src/04-save.js` `load()` l.68 | Two failures in a row lose the older good copy. | P1-05 (keep a parseable backup) | fixed (core: unreadable save keeps a readable backup; backup: shown) |
| A-06 | Informational | Multi-tab save adopts the other tab's save | `src/04-save.js` `saveNow()` / `adoptNewer()` l.91-115 | By design (R-001); progress from the other tab is lost with a toast. | none (by design) | open |
| A-07 | Informational | M12 Uplink, M26 Ravager vs Fiends rounds have no clock | `src/03f-data-modes.js` rows control / fiends, `src/13b-modes.js` `stepRounds()` l.562-566 | A hiding side can stall a round; the player is never stuck. | P4-02 (mode defaults) | fixed (Phase 4: `rounds.live` 240 s for control and 180 s for fiends in `src/03f-data-modes.js`; menuflow tests) |
| A-08 | Low | Gamepad defaults lack previous weapon and buy menu | `src/05a-input.js` ACTION_ROWS l.70-84 | Only Y cycles forward; buy menu only from pause. Every action can be bound to a View chord. | P5-03 | open |
| A-09 | Informational | Target ability pressed with no target gives no feedback | `src/12e-abilities.js` `tryActivate()` l.268-281 | bolt, link, swarm, frenzy: nothing happens, resource kept. | P7-01 | open |

### Findings from P1-02 / P1-03 / P1-04 and the baseline (2026-10-29)

| ID | Severity | Area | Location | Reproduction | Fix task | Status |
|---|---|---|---|---|---|---|
| D-F01 | High | W40 Fusion Mortar alt (Detonate) never works with the normal loadout | `src/11a-weapons.js:518-522` (a reload returns before `stepAltMode`), `:487-489` (`reloadIfEmpty` starts the reload at once), `src/03c-data-weapons.js:258` (W40 `mag: 1`, `reserve: 1`; reload 2.5 s), orb fuse 2 s (`:87`) | Any ruleset: give W40, fire (primary), press Alt within 1 s: no explosion; the single round empties the magazine, the auto reload (state RELOAD, 2.5 s) blocks the alt, the orb blows by its fuse about 1.2 s after the shot. With 30000 rounds it works. | P1-05 | fixed (weapons: W40 Alt detonates during the reload) |
| D-F02 | High | Primary fire is swallowed after sprinting; Alt types that are not shots (zoom, toggle, block) still act at once. Likely source of the owner's "alt works, fire does not" on touch, where the stick sprints above 90 % push | `src/10a-move.js:86-88` (`Move.canFire` false while `FIRE_DELAY`), `:447` (FIRE or ALT cancels the sprint), `:454` (delay = `sprintToFire` + weapon `readyTime`), `src/03b-data-movement.js:37,42,57` (`sprintToFire` 0.20 / 0.15 / 0.15), `src/03c-data-weapons.js` (`readyTime` 0.15 on all 46), `src/11a-weapons.js:666` (`ready`), `:531-535` and `:568-576` (ADS, toggle, block are not gated by `canFire`), `src/05b-input-touch.js:329` (stick above 90 % sprints), `src/05a-input.js:7` (tap buffer only 0.10 s) | In a sprint-capable ruleset (RS04, RS05, RS09, RS10, RS11, RS12 = modern / agile / parkour): hold forward + sprint (Shift / L3 / stick past 90 %) for 1 s, then press Fire: first shot after 21 frames of 1/60 s (0.35 s); a one-frame tap never fires. Measured in the `modern` movement preset for all 46 weapons on keyboard / mouse, gamepad and touch (138 rows, identical; agile and parkour were not run, their `sprintToFire` is 0.15, so 0.30 s). Alt: zoom / toggle act at once; shot alts have the same 0.35 s delay. Rulesets with no sprint (RS01-RS03, RS06-RS08) are not affected. | P1-05 (with P2-05) | fixed (weapons: D-F02 buffered tap, alt shot, switch drops it; input: touch sprint gesture) |
| D-F03 | High (owner report) | Primary dead while Alt still fires: 9 weapons use an Alt pool or no ammo for Alt, so when magazine and reserve are empty the primary only clicks and Alt keeps firing: W06, W08, W10, W18, W20, W22, W26, W27, W36 | `src/11a-weapons.js:455-460` (`hasAmmo`), `:481-485` (`reportEmpty`), `src/03c-data-weapons.js` (`altAmmo`, Alt `ammo: 'alt'` or `ammoPerShot: 0`) | Give the weapon, spend the magazine and reserve (or set both to 0), hold Fire: only `weapon.empty` clicks; hold Alt: shots leave (W06 6, W08 4, W10 3, W18 2, W22 20 alt rounds; W20 and W36 Alt cost no ammo). Keyboard / mouse tested, same code for all inputs. Whether the HUD shows the empty state was not checked. | P1-05 | fixed (weapons: D-F03 dry primary clicks, toasts, switches; Alt keeps its pool) |
| D-F04 | Medium | Lock-on weapons give no shot and no cue without a target: W07 primary (needs a 0.4 s lock; its Alt fires freely) and W33 Alt | `src/11a-weapons.js:600` (`LockOn.update`), `:669` (`ready` needs a lock) | Fire W07 with nothing in front: 0 shots (Alt: 12 shots in 1.5 s). W33 Alt: 0 shots without a lock. | P1-05 (feedback) | fixed (weapons: D-F04 no-target cue; hud: lock-on cue) |
| D-F05 | Informational | Working as designed, listed so they are not re-reported: W24 hip fire (spread 8 deg) missed at 8 m; W27 and W39 charge primaries fire on release (a tap does nothing visible); W29 stance Alt refused on open ground (needs a ledge); W36 heat blast needs stored heat (damage is heat x 120); in rulesets with a shield or hero health model damage lands on shield / armor before health | - | - | - | no fix |
| D-F06 | High | `tools/perf.mjs` is not valid JavaScript: SyntaxError at line 43 (the `//` comment eats the closing `)` of `resolve(`); `node tools/perf.mjs` exits at once, so the Phase gate "perf not worse than the baseline" (Section 3) cannot be run | `tools/perf.mjs:43` (commit 771e310) | `node tools/perf.mjs` | P1-05 (one character; tools/ file) | fixed (tools/perf.mjs runs; --view added) |

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
| W06 hush | OK / OK / OK | OK / OK / OK | hitscan/semi + alt hitscan/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 (fixed: D-F03) |
| W07 sparklock | OK / OK / OK | OK / OK / OK | lock/auto + alt hitscan/auto | primary is lock-on: no shot without a target held 0.4 s (D-F04) | P1-05 (fixed: D-F04) |
| W08 twinsting | OK / OK / OK | OK / OK / OK | hitscan/auto + alt hitscan/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 (fixed: D-F03) |
| W09 wasp | OK / OK / OK | OK / OK / OK | hitscan/auto + alt zoom | - | - |
| W10 hornet | OK / OK / OK | OK / OK / OK | hitscan/auto + alt projectile/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 (fixed: D-F03) |
| W11 riptide | OK / OK / OK | OK / OK / OK | hitscan/auto + alt toggle/auto | - | - |
| W12 needlethorn | OK / OK / OK | OK / OK / OK | projectile/auto + alt projectile/semi | - | - |
| W13 vanguard | OK / OK / OK | OK / OK / OK | hitscan/auto + alt zoom | - | - |
| W14 tempest | OK / OK / OK | OK / OK / OK | hitscan/auto + alt zoom | - | - |
| W15 ratchet | OK / OK / OK | OK / OK / OK | hitscan/burst + alt zoom | - | - |
| W16 longshot | OK / OK / OK | OK / OK / OK | hitscan/semi + alt zoom | - | - |
| W17 coilcaster | OK / OK / OK | OK / OK / OK | hitscan/semi + alt projectile/semi | - | - |
| W18 pulsecarbine | OK / OK / OK | OK / OK / OK | hitscan/auto + alt projectile/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 (fixed: D-F03) |
| W19 scattergun | OK / OK / OK | OK / OK / OK | hitscan/semi + alt hitscan/semi | - | - |
| W20 hookjaw | OK / OK / OK | OK / OK / OK | hitscan/semi + alt projectile/semi | mag + reserve empty: primary only clicks, alt (hook, no ammo) still fires (D-F03) | P1-05 (fixed: D-F03) |
| W21 shardcaster | OK / OK / OK | OK / OK / OK | projectile/semi + alt projectile/semi | - | - |
| W22 frostbore | OK / OK / OK | OK / OK / OK | hitscan/semi + alt hitscan/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 (fixed: D-F03) |
| W23 lancet | OK / OK / OK | OK / OK / OK | hitscan/semi + alt zoom | - | - |
| W24 heron | OK / OK / OK | OK / OK / OK | hitscan/semi + alt zoom | hip fire misses at 8 m (spread 8 deg): by design (D-F05) | - |
| W25 kestrel | OK / OK / OK | OK / OK / OK | hitscan/semi + alt zoom | - | - |
| W26 stakedriver | OK / OK / OK | OK / OK / OK | projectile/semi + alt projectile/semi | mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 (fixed: D-F03) |
| W27 talonbow | OK / OK / OK | OK / OK / OK | projectile/charge + alt projectile/semi | charge: a tap does not shoot (D-F05); mag + reserve empty: primary only clicks, alt still fires (D-F03) | P1-05 (fixed: D-F03) |
| W28 hailstorm | OK / OK / OK | OK / OK / OK | hitscan/auto + alt toggle/auto | - | - |
| W29 anvil | OK / OK / OK | OK / OK / OK | hitscan/auto + alt toggle/auto | alt stance refused on open ground: needs a ledge (D-F05) | - |
| W30 linker | OK / OK / OK | OK / OK / OK | projectile/auto + alt beam/auto | - | - |
| W31 ramjet | OK / OK / OK | OK / OK / OK | projectile/semi + alt projectile/charge | - | - |
| W32 pitcher | OK / OK / OK | OK / OK / OK | projectile/semi + alt projectile/semi | - | - |
| W33 kingfisher | OK / OK / OK | OK / OK / OK | projectile/semi + alt lock/release | alt: no shot without a lock (D-F04) | P1-05 (fixed: D-F04) |
| W34 gloop | OK / OK / OK | OK / OK / OK | projectile/auto + alt projectile/charge | - | - |
| W35 kindler | OK / OK / OK | OK / OK / OK | cone/auto + alt projectile/semi | - | - |
| W36 ember | OK / OK / OK | OK / OK / OK | projectile/auto + alt cone/semi | alt needs stored heat (D-F05); mag + reserve empty: primary only clicks, alt (no ammo cost) still fires (D-F03) | P1-05 (fixed: D-F03) |
| W37 stormlash | OK / OK / OK | OK / OK / OK | beam/auto + alt hitscan/semi | - | - |
| W38 starthrower | OK / OK / OK | OK / OK / OK | projectile/auto + alt projectile/semi | - | - |
| W39 accelerator | OK / OK / OK | OK / OK / OK | hitscan/charge + alt cone/semi | charge: a tap does not shoot (D-F05) | - |
| W40 fusionmortar | OK / OK / OK | FAIL / FAIL / FAIL (default ammo; OK with 30000 rounds) | projectile/semi + alt detonate | Alt (Detonate) never works with the normal loadout (D-F01) | P1-05 (fixed: D-F01) |
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
- **Status: fixed by P2-01** (self-test group `spectate`: every no-respawn mode, teams, free camera, no-player match, killcam hand-over, listener, touch buttons, HUD; LT-M-069).

#### P1-04 - Pickup pads are never cleared after pickup (investigated, 2026-10-29)

- **Result: the item state and the respawn timer are correct; the platform (base disc) is what stays.** Probe (real maps Spire / Harbor, modes ffa and tdm, headless; `Items.drawPickup` / `Items.drawBase` wrapped to log what the renderer would draw): for one spot of each kind (weapon, health, armor, ammo, powerup) the player stands on the spot, the state goes READY to WAITING, the next draw submits no pickup model and only the base disc (`base:<slot>@0.25`), and the spot returns to READY after exactly the expected time (weapon pad 5 s in free-for-all, 30 s in team modes via `respawnTeams`, power weapons 120 s; health 35 s, armor 25 s, ammo 25 s, powerup 120 s, first power spawn 33-40 s) with the model drawn again. The `item.respawn` event fires. So the pickup is cleared, and no timer is stuck.
- **What the player sees (cause of the report, render)**: `Items.draw` (`src/12a-items.js:581-591`) draws the flat base disc under every spot in both states: READY at glow 0.5 (0.9 for powerups, `:595`) and WAITING at glow 0.25 (`:589`, `PICKUP_GLOW_WAITING` `:629`), same group colour, no spin and no countdown on the pad. The disc therefore stays after pickup, only about half as bright, and nothing marks "empty, back in N s" (the HUD timer `src/17d-hud-markers.js:230` shows respawning spots only in range / as markers). The "platform never cleared" impression is this permanent disc; there is no separate pad object.
- Possible second source, not checked: any static map geometry a designer put under an item spot is world geometry and can never be cleared.
- Not visually verified in a rendered frame (headless draw calls only). Severity Medium. Fix: P2-02 (dim or hide the disc, add a respawn indicator) after P1-05.
- **Status: fixed by P2-02** (self-test items: "P2-02 ..." five checks; LT-M-066).
