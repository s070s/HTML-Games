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

- [ ] P0-01 - Record the baseline: commit hash, build size, self-test result, perf numbers.
  Done when: recorded in Appendix C.
- [ ] P0-02 - Define the low-spec mobile test method (device class, target frame rate, test maps and modes, metrics).
  Done when: method recorded in Appendix C.

## Phase 1 - Audit (Critical and High: features not working as intended)

- [ ] P1-01 - Full functional audit of every mode, ruleset, weapon fire mode (primary and alt), ability, gadget, item, pickup, menu and control layout. Classify each finding Critical, High, Medium, Low or Informational. Main focus: Critical and High.
  Done when: Appendix D lists each finding with severity, location (file and function), reproduction steps and fix task ID.
- [ ] P1-02 - Weapon fire audit: for each of the 46 weapons test primary fire and alt fire on touch, gamepad and keyboard / mouse. Known report: some weapons have working alt fire but non-working primary fire.
  Done when: Appendix D has one row per weapon with primary / alt result, and every failure has a fix task.
- [ ] P1-03 - Reproduce: after death with no respawn (elimination modes), the camera stays stationary and spectating does not work (no free cam, no follow).
  Done when: modes and steps that reproduce it are in Appendix D.
- [ ] P1-04 - Reproduce: pickup platforms (pads) are never cleared after the item is picked up.
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

## Appendix D - Audit findings

(Filled by P1-01 and P9-01. Columns: ID, severity, area, location, reproduction, fix task, status.)
