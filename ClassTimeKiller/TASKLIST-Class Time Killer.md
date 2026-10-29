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

- [x] P5-01 - DECIDE: touch layout. Reduce the about 20 buttons to the essential set; context buttons only when usable (example: use, heal, ultimate when ready); group the rest (example: hold or swipe menus). Respect safe areas and thumb reach on phones in landscape.
  Done when: Appendix C has the layout for phone and tablet with the button list and sizes.
  Status (2026-10-29): decided, Appendix C "P5-01": essential set (stick, FIRE, ALT, JUMP, DUCK, LOAD, SWAP, look) plus context buttons that show only while usable; A1, A2 and TOOL stay dimmed while unusable (a tap is swallowed), ULT hidden until ready, BUY only in buy time; melee is a flick on LOAD; safe areas, 44 px floor and thumb reach checked on four phone sizes.
- [x] P5-02 - Implement the new touch layout and keep Standard / Compact / Left-handed variants (or replace them per P5-01). Migrate saved custom layouts.
  Done when: layout fits a 360x640 CSS px landscape screen without overlap and all actions are reachable.
  Status (2026-10-29): Standard / Compact / Left-handed presets on the new layout, saved custom layouts and bindings migrated once (controlsVersion; old chords no longer fire two actions); every preset passes no-overlap, 44 px and safe-area checks with and without a notch.
- [x] P5-03 - Review gamepad and keyboard / mouse layouts for the renamed and merged actions.
  Done when: every action is mapped without conflicts and the Controls screen matches.
  Status (2026-10-29): every action has a controller and keyboard / mouse path; previous weapon View + D-Left, buy menu View + D-Up (A-08 fixed); Quick buy on a key or button the menus read is flagged red.
- [x] P5-04 - Onboarding card per input type with the core actions only.
  Done when: shown on first play and available from the pause menu.
  Status (2026-10-29): a controls card per input type with the core actions, shown once per type in the first real match (never in spectate, killcam or a match without a player), reopenable from Help. Self-test 6565 / 6568: the 3 misses are timing checks (audio, nav big map) under machine load in code this phase did not touch; the implementer's full run before the last two small fixes passed 6567 / 6567; re-measure on a quiet machine in P9.

## Phase 6 - Animations

- [x] P6-01 - DECIDE: reload animation set per weapon class (magazine out / in, shell insert, cell swap, bolt / charge, launcher load), first-person and third-person, with timing that matches each weapon's reload time.
  Done when: Appendix C lists the animation per class and per special weapon.
  Status (2026-10-29): decided, Appendix C "P6-01": 14 reload sets mapped to all 38 weapons (6 never reload), phases as fractions of the live reload time ending on the refill step, partial / empty / shell-by-shell / cancel rules; first- and third-person layers.
- [x] P6-02 - Implement the reload animations from P6-01, including partial reload, empty reload and reload cancel.
  Done when: every weapon shows its reload animation and the animation end matches the ammo refill time.
  Status (2026-10-29): 14 reload sets on all 38 weapons, partial / empty / shell-by-shell / cancel, first and third person; anims tests check the animation end equals the refill step for every weapon; reload poses tilt about the magazine well and stay under 30 % of the screen and 0.12 m from the eye on every frame (review sheet checked by the coordinator). Self-test 6663 / 6663.
  Status (2026-10-29): implemented, not ticked; Appendix C "P6-02 to P6-04 - Implementation": 14 sets on all 32 weapons with a magazine, a self-test per weapon (partial and empty) proves the animation ends on the refill step; sim values unchanged.
- [x] P6-03 - DECIDE + implement better melee animations: per melee weapon and for the quick melee of guns (wind-up, strike, follow-through, hit reaction on the target), first-person and third-person.
  Done when: each melee weapon and the quick melee has a distinct animation that matches its hit timing.
  Status (2026-10-29): per-weapon melee and quick melee with wind-up, contact on the first frame after damage, follow-through ending when the weapon can act again, hit reaction on the target; strikes land toward the crosshair (tested per frame).
  Status (2026-10-29): implemented, not ticked; Appendix C "P6-02 to P6-04 - Implementation": 8 strike rows, contact pose on the first frame after the hit tick, end on the step the weapon may act again (self-tested for every melee weapon and the quick melee), hit reaction, stagger, hit-stop, surface impact.
- [x] P6-04 - Swap, ADS / alt, sprint and inspect motions reviewed so they do not conflict with the new reload and melee motions.
  Done when: no animation pops or overlaps in a live test of every weapon.
  Status (2026-10-29): priority swap > reload > melee > block > charge > aim > sprint > kick with blends; swap split 35 / 65 with equip time unchanged; pop test over every weapon and transition passes. Live device check LT-M-074 to LT-M-076 still to run; pose values are data rows the owner can retune.
  Status (2026-10-29): implemented, not ticked; Appendix C "P6-02 to P6-04 - Implementation": one layer rule with blends, swap split 35 / 65, a self-test that samples pose continuity across swap, reload, melee, ADS and sprint for all 38 weapons; the live test (LT-M-074 to LT-M-076) is written and not run.

## Phase 7 - Audiovisual feedback

- [x] P7-01 - DECIDE: feedback list. Examples to evaluate: hit markers and kill confirm, damage direction, per-surface impact effects and sounds, stronger muzzle flash and recoil kick, shell ejection, tail sounds by distance, low-health and low-ammo cues, ability ready cues, controller rumble, camera shake (with accessibility setting).
  Done when: Appendix C lists accepted items with trigger and performance cost.
  Status (2026-10-29): decided, Appendix C "P7-01": 15 items accepted (with trigger and cost; several are tuning of existing feedback), 7 rejected with reasons; new reduce settings for P7-03 (weapon motion, muzzle flash, vibration, heartbeat).
- [x] P7-02 - Implement P7-01 within the performance budget.
  Done when: each accepted item works and `node tools/perf.mjs` meets the P0-02 target.
  Status (2026-10-29): every accepted P7-01 item works (hit marker, kill confirm, damage direction, per-surface impacts and water splash, own-gun flash about 40 px with light, brass casing streaks, reload sound cues and particles, low-health and low-ammo cues, ability-ready cues, rumble, roll-only damage shake), A-09 fixed; gameplay values unchanged; perf.mjs A/B medians inside the P0-02 gate (Low render 3.23 to 2.77 ms) and the storm worst case adds no draw call; coordinator checked the review sheet. Self-test 6791 / 6793 (2 timing checks under load in untouched world / nav code).
  Status (2026-10-29): implemented, not ticked; Appendix C "P7-02 to P7-03 - Implementation": F01 to F13 work (F14 and F15 were P6-03), the P6 sound cues and the four P6 particles (R2 casings, the R4 round, the W36 vent, the W35 flare) are in, A-09 is fixed; 6793 self-tests run, all pass except two timing checks that flake under load on this host (nav big map, world ray query; untouched code, both pass on a rerun), the P0-02 gate: see the performance table there.
- [x] P7-03 - Settings to reduce intense effects (shake, flashes).
  Done when: each intense effect has an off / reduced option.
  Status (2026-10-29): weapon motion %, muzzle flash full / reduced (1 particle, half size, half alpha, no light) / off, vibration strength %, heartbeat on / off, camera shake %; photosensitivity turns the flash off above 3 shots / s; additive save keys with migration and clamping; reachable on touch, gamepad and keyboard.
  Status (2026-10-29): implemented, not ticked; Appendix C "P7-02 to P7-03 - Implementation": weapon motion %, muzzle flash full / reduced / off, vibration strength %, heartbeat on / off, and the camera shake slider that was there; each is a saved additive setting (an older save gets the defaults), each has a settings row reached by keyboard, touch and gamepad, each is self-tested (reduced really reduces, off really turns off).

## Phase 8 - Rebalance

- [x] P8-01 - Define balance targets (time-to-kill ranges per class already exist in `weaponClasses.ttk`; add pick-rate, win-rate and usage targets for weapons, equipment and abilities).
  Done when: targets are in Appendix C.
  Status (2026-10-30): decided, Appendix C "P8-01": 12 metrics with one definition each and a pass rule; per-class weapon bands (overall, home / away win rate, kill rate, held share) on top of the existing TTK bands; pick bands per slot; gadget, item, ability, hero and ability x class targets; 12 mode and ruleset fairness targets (side win share 45-55 % per map over mirrored pairs). From the data today: W21 fails the new reload rule, 8 guns are never a bot spawn pick, A15 is under its pick floor, W23 / W24 are 3 profiles' favourites, 10 rows never appear on a map.
- [x] P8-02 - For each weapon, equipment and ability write benefits, drawbacks and uses.
  Done when: Appendix C has the table, every row has at least one of each, and no two rows have the same profile.
  Status (2026-10-30): Appendix C "P8-02": 133 rows (38 weapons, 17 gadgets, 33 items, 45 abilities) from the current data, each with benefits, drawbacks and uses, no two alike; 7 overlaps flagged (O1-O7) with the distinguishing change for P8-04 (W26 burn, W21 reload, I02 / I06 respawn, AX5 vs PU04, A27 without downed, W40 / W45 text, AX6 name).
- [x] P8-03 - Smart testing plan (not every combination): headless bot matches with fixed seeds, one-factor-at-a-time changes, pairwise combinations for interactions (weapon x ruleset, ability x weapon class), extremes first.
  Done when: the plan lists every test case and the total count.
  Status (2026-10-30): Appendix C "P8-03": 715 cases (3,050 runs) in 14 families with every case ID, the follow-ups folded in (Harbor seeds 2-4 measured at 0 unperceived shots, W21 reload, open P8 notes), waves with stop rules; sample runs measured, estimate about 1.5 h wall on 4 workers; the missing tooling T1-T7 (forced loadouts, mirrors, metrics collector, overrides, batch runner, summary, static checks) specified for P8-04.
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

### P4-02 - Merged modes, curated list and defaults (decided 2026-10-29 by the coordinator; confirmed by the owner 2026-10-29)

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

### P4-03 - Menu flow (decided 2026-10-29 by the coordinator; confirmed by the owner 2026-10-29)

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

### P5-01 - Touch layout (decided 2026-10-29 by the coordinator; confirmed by the owner 2026-10-29: dimmed abilities, BUY button, melee flick)

**Inventory before (fact, `src/05b-input-touch.js` `TOUCH_CONTROLS`, 20 rows).** Always on (10): move stick, FIRE, ALT, JUMP, DUCK, LOAD, SWAP, PING, pause, MELEE. Shown only when usable (10): USE (the mode needs Use held, a revive, a skimmer board), HOLD breath (the scope sways), NADE (a grenade is carried), HEAL (a consumable is carried, or any loot ruleset, even at full health), A1, A2, ULT (the slot is filled, also while it cools down or is not paid for), TOOL (the gadget slot is filled), CARD (the match has cards), the second FIRE on the left (setting). Gestures that already existed: DUCK slide = prone, NADE slide = next grenade type, SWAP hold = previous weapon, PING hold = comm wheel, score panel hold = scoreboard, weapon box tap = slot. Faults found: 4 buttons under 44 css px (PING, pause and CARD 40, HEAL 42) and 10 more at 44-50; the floor for a crowded screen was 30 px; ability buttons showed on cooldown; HEAL showed with nothing to heal (any loot ruleset); PING showed in a free-for-all where nobody sees it; the Compact preset shrank every button to 80% (the small ones to 32-36 px).

**Decision.**

| Part | Decision |
|---|---|
| Essential set (always on, 8 incl. the stick) | stick, FIRE 88, ALT 56, JUMP 64, DUCK 52 (slide: prone), LOAD 52 (flick: melee), SWAP 52 (hold: previous weapon), pause 48 |
| Context buttons (12, each only while it can act) | USE 56, HOLD 48, HEAL 48 (an item would restore something), NADE 52 (a grenade; slide: next type), A1 and A2 52 (the kit has a pressable ability there: shown, and dimmed while it cannot be used; never a passive or the automatic Wrath Form), ULT 56 (hidden until ready), TOOL 52 (the kit has a gadget: shown, dimmed while no use is left or it is blocked), PING 48 (a match with teams; hold: comm wheel), CARD 48, BUY 48 (the buy time of a round-buy ruleset, in the buy zone), second FIRE 70 (setting) |
| Grouped (no button of their own) | MELEE = flick of 30 px on LOAD (a shorter slide, a thumb that slips, still reloads); previous weapon = hold SWAP; prone = slide DUCK; next grenade type = slide NADE; comm wheel = hold PING; scoreboard = hold the score panel; weapon slots = tap the weapon box; sprint = push the stick to its edge twice (P2-05); buy menu and loadout = pause menu; Quick buy = the button in the buy menu; developer views = four fingers |
| Count | 20 rows before, 20 now (MELEE gone, BUY added); always on 10 before, 8 now; at most 12 more on screen and only while usable, A1, A2 and TOOL dimmed instead of gone (a match with no kit shows exactly the 8) |
| Size floor | 44 css px: `TOUCH_MIN_DIAMETER` 30 -> 44 for the preset, the editor (`layoutOf` never returns a scale under 44 / size) and a crowded screen; every default size is 48 or more |
| Variants | keep three. Standard = the table. Compact = scale 0.85 (was 0.8): the stick, FIRE, ALT and JUMP shrink most (120 to 102, 88 to 75, 56 to 47.6, 64 to 54.4), the 52 px buttons go to 44.2 and the 48 px ones are held at the floor. Left-handed = x mirrored, the stick starts on the right, JUMP and SWAP have their own spot because the minimap and the vitals sit at the left. No new presets: they answer two different needs (phone size, hand) |
| Saved layouts | migrated once (`controlsVersion`, see P5-02 below) |

**Reach zones** (share of the safe area, the phone in two hands; px at 640x360 / 932x430, standard preset):

| Zone | Share (x, y) | px at 640x360 | px at 932x430 | Holds |
|---|---|---|---|---|
| Right thumb at rest, no lift | 0.78-1.0, 0.42-0.95 | 500-640, 150-340 | 727-932, 180-408 | FIRE (580,214 / 844,256), ALT (506,158 / 736,189), JUMP (525,299 / 764,357), BUY (605,320 / 881,383) |
| Right thumb stretch (one roll of the thumb) | 0.60-1.0, 0.20-1.0 | 384-640, 72-360 | 559-932, 86-430 | DUCK (451,319), LOAD (605,128), SWAP (541,92), USE (448,238), HOLD (448,151), HEAL (392,270), NADE (394,326) |
| Left thumb on the floating stick | 0-0.42, 0.40-0.85 | 0-269, 144-306 | 0-391, 172-366 | the stick (90,202 / 130,241), where the thumb lands inside the move zone |
| Left thumb above the stick | 0.06-0.40, 0.328 | 38-256, 118 | 56-373, 141 | A1 (56), A2 (122), ULT (186), TOOL (246) at 640 |
| Top centre (occasional, a hand shift) | 0.50-0.70, 0.233 | 320-448, 84 | 466-652, 100 | pause (320), PING (384), CARD (448) |
| Keep-out (never a button) | - | the aim zone (circle of 0.18 x the short side around the centre: 65 px / 77 px), the minimap (13,13 to 90,90), the vitals bottom left, the ammo panel and weapon bar bottom centre, the score header on top, the notch (47 px each side) and the home bar (inset bottom) | same, scaled | `placeAll` moves a button out of them; nothing needed to move on the three sizes |

Check on the three sizes (`controls` self-tests, standard, Compact and Left-handed, with a 47 px notch and without, essential set and all 20 buttons): no button under 44 px, none outside the safe area, none on another, and in the standard preset without a notch every button sits exactly on its layout spot. Left-handed puts every control but pause and BUY on the other half of the screen (the plain ones on the exact mirror spot); BUY has the same corner in both hands.

**Owner calls (decided 2026-10-29 by the coordinator; the owner can change any row).** (a) An ability that is cooling down, or unusable for any other reason (stun, suppression, no energy, carrying the flag), stays on screen dimmed instead of going away: A1, A2 and TOOL (the first version hid them; the HUD rings show why). A tap on a dimmed button does nothing and is swallowed, so it never reaches the stick or the look. ULT stays hidden until it is ready. (b) MELEE stays a flick on LOAD, not a button: the flick must be made inside the 150 ms window from the touch-down (a still finger has pressed the reload by then), a tap reloads on release so the reload lags the touch by up to 150 ms, and while spectating LOAD is VIEW and never melees; Help, the card and the docs call it a flick. (c) A context BUY button on touch (48 px, bottom right corner, the same place in both hands because the left bottom is the vitals): it shows only during the buy time of a round-buy ruleset, in the buy zone, and opens the buy menu; the pause menu entry stays for the loadout and the shop rulesets. Not tried on a device (P9-03); the screenshots of this phase are headless Chrome at 640x360 and 932x430.

### P5-02 - Touch layout implemented (2026-10-29)

- `TOUCH_CONTROLS` is the table above; `needs` read the game: `Abilities.pressable`, `Gadgets.gadgetReady`, `Items.healUsable`, ping needs teams (17g). A button under a finger stays until the finger lifts (`fingerOn`), so a press is never cut off by the cooldown it starts.
- Saved layouts: `Save.data.controlsVersion` (new, `CONTROLS_VERSION` 2; a save without it is generation 1). `migrateTouchLayouts` (05b) removes entries of controls that no longer exist (MELEE) and the values the old editor stored only because they were the defaults (it wrote every key on any edit): a spot within 2% of the first release's default (`TOUCH_LEGACY_SPOTS`), the old preset scale, opacity 0.7, `hidden: false`. A moved button keeps its spot and size; `placeAll` moves it only when it meets another. Idempotent; an import takes the same path.
- Tests: new group `controls` (`src/20b-test-controls.js`); changed: `input` (the MELEE button gone, Compact scale, the touch path list), `hudui` (the heal fixture needs a hurt player, MELEE out of the core buttons, the comm-wheel case with every button at 200% on the smallest phone may keep a callout under a button at the ring's floor, as the every-need case already did), `spectate` (MELEE out of the list).
- Result (after the review fixes): build OK (165 files, `ClassTimeKiller.html` 2210.1 KB); full self-test 6567 / 6567 in 40 groups, 188 s (HEAD before this phase: 6448 / 6448; the new `controls` group has 114 checks; the first Phase 5 run had one load-sensitive timing miss in `bots`, which passed alone); `controls` 114 / 114, `hudui` 117 / 117, `input` 330 / 330. Shipped file: `__CTK.log.errors().length` = 0. Not run: `tools/perf.mjs` (the touch layer adds a few reads per frame: `needBitsNow` calls `Abilities.pressable`, `Gadgets.gadgetReady`, `Items.healUsable` and a rules read, all plain array reads; the `perf` self-test group passes).

### P5-03 - Controller and keyboard / mouse review (2026-10-29)

| Item | Finding | Change |
|---|---|---|
| Alt | label and touch button already say Alt (P2-04) | a self-test fails an "Aim" label; Walk (default Left Alt, also the HOLD breath button) is now "Walk / hold breath" so it is not read as the Alt action |
| Quick buy (P3) | a key read by the buy screen itself (`KeyQ`), not an action: absent from the Controls screen, no controller or touch path, the button said "key Q" on every device | new action `quickBuy` (`menuOnly`: works only while a menu is open; Q and controller X by default; Q is ability 1 and X is reload in the match, no conflict is flagged for a menu-only row); the button names the key or button of the device in use, none on touch; a menu-only row on an input the menus read themselves (Esc, Enter, Space, Tab, arrows, B, 1-9; controller A, B, LB, RB, Start, alone or with View) is flagged red ("shares a key with the menus") |
| Tabs (P4) | LB / RB switch tabs in menus (`prev` / `next` commands), in a match they are grenade and ability 1 | unchanged, documented; no binding involved |
| Previous weapon, buy menu (A-08) | no controller default | View + D-Left, View + D-Up (free chords) |
| Abilities and gadgets after the Phase 3 roster | the actions `ability1`, `ability2`, `ultimate`, `gadget`, `grenade`, `grenadeNext`, `heal` are slot based, so the roster change needed no rebinding | none |
| Conflicts | none by default (self-test); the old touch reachability test read a field that does not exist (`longAction`, it is `holdAction`) | fixed; every action now has a touch path (`TOUCH_ACTION_PATHS`, `touchPathOf`) and a controller button or chord, or is listed as exempt (sticks, weapon slots, developer views) |
| Saved bindings | a saved action keeps its three slots, so an old save would never get a new default | `migrateBindings` (05a): an empty slot that gained a default is filled unless the player already uses that binding (an action never rebound whose default is taken gets an entry written with that slot empty, so no binding fires two actions); entries of unknown actions are dropped; idempotent |

### P5-04 - Controls card (2026-10-29)

One card per input type (touch, controller, keyboard and mouse), 8 or 9 core rows (move, look, fire, Alt, jump, reload, next weapon or sprint and crouch, pause; touch adds DUCK) and a one-to-two line note (touch: the three gestures and the context-button rule; controller: the View layer; keyboard: click to lock the mouse). Names come from the live bindings and from `touchPathOf`. Shown once per input type (`Save.data.tips.controlCards`), at the first match of that type or when the player picks up another type mid-match, only while the setting "Show short tips" is on, never while spectating, in a killcam or in a match with no local player (it stays due for the next real match); a type the card's switch shows counts as seen too; it pauses the match and "Got it", Esc or B resume. Open again from Help ("Show the controls card"), Settings > Controls ("Controls card") and the pause menu ("Controls card"); the card has a switch for the other types. An old save shows each card once. Headless runs never show it.

### P6-01 - Reload animation set (decided 2026-10-29 by the coordinator; the owner can change any row)

**Facts (read from `src/`).**
- Reload rules (`src/11a-weapons.js` `beginReload` / `stepReload`): the duration is `weapon.reload` x the RELOAD modifier (attachments `quickMag` 0.75, `extendedMag` 1.15, perks), kept in `Weapons.stateDuration`; a magazine is refilled in one step when `stateTime` reaches it. A partial and an empty reload take the same time; the sim has no chamber step. Class times: sidearm 1.4 s, SMG 1.8, shotgun 0.5, rifle 2.2, marksman 2.4, sniper 3.0, energy 2.0, heavy 4.0, explosive 2.5, exotic 2.5, power 3.0; row overrides W20 1.1, W24 3.6, W27 0.5.
- Shell by shell (`reloadShell`, W19 only): each shell is its own 0.5 s reload and the next starts in the same step; a FIRE press with at least one round loaded ends it (state IDLE, the shot comes on the next step).
- Cancels: a swap (`requestSwitch`) replaces the reload (a magazine gets nothing, shells already loaded stay); a quick melee (`quickMelee`) ends it the same way; FIRE does not cancel a magazine reload (the press is ignored); sprint does not cancel it (the reload runs on while sprinting); a stunned (FROZEN) or downed actor (`lowered`) stops `stateTime`, so the reload pauses. ADS falls to 0 in 0.2 s during a reload (`updateAds`). W40 / W43 detonate works during the reload (D-F01).
- Never reloads: mag 0 (W01, W02, W03, W41, W42, W44); no reserve (W45 4 / 0, W46 1 / 0) unless a ruleset makes the reserve infinite. Alt pools (W06 darts, W10 grenades, W26 incendiary stakes, W27 explosive arrows) are never reloaded.
- What exists: `Render.viewModel` gives `reload` 0..1 and `src/07e-render-view.js` `poseWeapon` dips the weapon 0.1 m and pitches it 0.5 rad on a sine; the first-person view draws the weapon model only (no hands); third person (`src/07c-render-actors.js`) has no reload motion; one `reload` sound at the start (pulses at 0 and 0.28 s, `src/06b-audio-recipes.js`); the HUD shows RELOADING and a progress bar (`src/17a-hud.js` `hudReadReload`).

**Decision.**

| Part | Decision |
|---|---|
| Timing | Every phase is a fraction f of the reload in progress (`stateTime / stateDuration`), so attachments and perks scale it. The last phase (RAISE or EXIT) ends at f = 1.0, the step the rounds are added, so the animation end matches the refill. The animation reads sim state only; it never changes `weapon.reload`, `stateDuration`, damage timing or recoil values. |
| Partial or empty | Decided once at the reload start (`magazine == 0`) and kept in a visual-only per-actor flag (`Weapons.reloadEmpty`, written in `beginReload`, read by nothing in the sim). The empty profile fits its extra chamber step into the same total by shortening the earlier phases. The HUD count still changes at f = 1.0. |
| First-person parts | (a) The moving part of the weapon model, tagged with a part `role` in the model rows (`mag`, `slide`, `bolt`, `pump`, `cyl`, `barrel`, `lid`, `cell`, `string`); a model without that role draws a spare procedural box of the set's size instead. (b) A procedural off-hand: one capsule forearm + one box hand in the worn colour (`Render.viewModel` `color`, else palette `cloth`), drawn only during a reload, a two-handed melee and a block. (c) The spare (new magazine, cell, shell, box) carried by the off-hand: the same part drawn a second time. At most 3 extra instances in the view-model batch. |
| Third-person parts | An action layer adds pitch and a small offset to `armL`, `armR`, `gun` and `torso` (actor parts can only pitch). The model's moving part detaches only at the near LOD on presets with `modelDetail` (not Potato); the far LOD keeps the arm and gun pitch; the distant LOD and killcam replay bodies (`pose.recorded`) get no action layer. |
| Weighting | Reload offsets are applied in the hip pose and weighted by (1 - ads), so the 0.2 s ADS fall at the start never shows a reload through the sights. |
| Sound | The local player hears phase cues at the marks below (new synthesized recipes `reloadOut`, `reloadIn`, `reloadRack`, `shellIn`, `cellCharge`; own priority, sfx bus) instead of the start sound. Other actors keep the one start sound (it tells the player an enemy reloads). |

Phase names: LOWER (tilt into the work pose), OUT (old ammo leaves), FETCH (off-hand to the belt and back with the spare), IN (spare seats), RACK (slide, handle, bolt, pump or crank; empty only unless the set says always), RAISE (back to the hold pose, ends at 1.0).

| Set | Partial: phases (f) | Empty: phases (f) | First person | Third person | Sound marks (f) |
|---|---|---|---|---|---|
| R1 Pistol magazine | LOWER 0-0.12, OUT 0.12-0.28, FETCH 0.28-0.50, IN 0.50-0.68, RAISE 0.68-1.0 | LOWER 0-0.10, OUT 0.10-0.24, FETCH 0.24-0.44, IN 0.44-0.60, RACK 0.60-0.78 (slide release), RAISE 0.78-1.0 | roll 20 deg inward, pitch -10 deg; mag drops 0.15 m and fades; the slide stays back while the magazine is 0 (from the last shot) and snaps forward in RACK. Dual W04: both pistols tilt inward, both mags drop at OUT, both spares rise from below at IN (no off-hand: both hands are full), both slides in RACK | gun pitch -20 deg; armL down to the belt (+45 deg) in FETCH, back to the gun at IN | out 0.14 / 0.12, in 0.66 / 0.58, rack - / 0.76 |
| R2 Revolver | LOWER 0-0.10 (cylinder swings out left), OUT 0.10-0.30 (muzzle up, spent casings fall: one per spent round), FETCH 0.30-0.50 (speed loader), IN 0.50-0.70, RACK 0.70-0.82 (cylinder flicks shut), RAISE 0.82-1.0 | same (a revolver has no chamber step) | cylinder part (`cyl`) swings 0.04 m left and back; 6 casings at most | gun pitch +30 deg in OUT (muzzle up), -15 deg in IN | out 0.12, in 0.68, rack 0.80 |
| R3 Long-gun magazine | LOWER 0-0.12, OUT 0.12-0.30, FETCH 0.30-0.50, IN 0.50-0.68, RAISE 0.68-1.0 | LOWER 0-0.10, OUT 0.10-0.25, FETCH 0.25-0.42, IN 0.42-0.58, RACK 0.58-0.80 (charging handle back 0.58-0.70, released 0.70-0.74, gun jolts), RAISE 0.80-1.0 | roll 15 deg right, pitch -10 deg, drop 3 cm; magazine out downward; a small upward bump at the seat | gun pitch -15 deg, drop 0.05 m; armL to the belt in FETCH; RACK: armL jerks back 15 deg | out 0.14 / 0.12, in 0.66 / 0.56, rack - / 0.72 |
| R4 Bolt + magazine | LOWER 0-0.10, RACK-open 0.10-0.20 (bolt up and back; a live round ejects), OUT 0.20-0.34, FETCH 0.34-0.52, IN 0.52-0.66, RACK-close 0.66-0.78, RAISE 0.78-1.0 | same phases, no live round at bolt open (the last shot already ejected its casing) | `bolt` part rotates 60 deg and slides 4 cm back; scope overlay drops with ADS | gun pitch -15 deg; armR jerks back at both bolt marks | bolt 0.12, out 0.22, in 0.64, bolt 0.76 |
| R5 Shell by shell | per-shell cycle, see "Shell by shell" below | first shell through the port + pump, see below | roll 30 deg, loading port up; shell from below into the port; `pump` part 6 cm back and forward | gun pitch -20 deg for the whole chain; armL pumps between gun and belt each shell | shellIn per shell at 0.70 of its cycle; rack (pump) on the empty first shell |
| R6 Break action | LOWER/OPEN 0-0.15 (barrels pivot down 35 deg), OUT 0.15-0.30 (spent shells pop up and back: 2 minus loaded), FETCH 0.30-0.45, IN 0.45-0.70, RACK-close 0.70-0.82 (snap shut, jolt), RAISE 0.82-1.0 | same | `barrel` part pivots at its rear | gun pitch -25 deg, then +10 deg at the snap | out 0.18, in 0.62, rack 0.76 |
| R7 Drum / canister | LOWER 0-0.15 (roll left 20 deg), OUT 0.15-0.32 (drum drops sideways), FETCH 0.32-0.50, IN 0.50-0.70, RACK 0.70-0.82 (drum twists 60 deg to lock), RAISE 0.82-1.0 | same | `mag` part (the drum); W21 plays the same fractions in 0.5 s (a snap) | gun pitch -15 deg; armL to the side in FETCH | out 0.18, in 0.68, rack 0.80 |
| R8 Cell swap | LOWER 0-0.12, OUT 0.12-0.35 (cell pops out 0.12-0.25, falls 0.25-0.35), FETCH 0.35-0.50, IN 0.50-0.66, RACK 0.66-0.86 (charge: glow parts ramp 20 % -> 100 %), RAISE 0.86-1.0 | same phases; the glow parts start at 0 % (the gun shows dark while its magazine is 0) and ramp 0 -> 100 % | `cell` part at the side (W07, W17, W23, W30, W36, W37, W39, W45) or on top (W12 needle pod, W38 disc stack); W36 vents 2 smoke particles at OUT (its heat value is untouched) | gun pitch -15 deg; armL to the side or top in FETCH | out 0.14, in 0.64, cellCharge 0.68 |
| R9 Top clip + crank | LOWER 0-0.12, OUT 0.12-0.28 (stake clip lifts off), FETCH 0.28-0.46, IN 0.46-0.64, RAISE 0.64-1.0 | LOWER 0-0.10, OUT 0.10-0.24, FETCH 0.24-0.40, IN 0.40-0.56, RACK 0.56-0.80 (crank lever turns once, string cocks), RAISE 0.80-1.0 | `mag` part on top, `string` part back in RACK | gun pitch -10 deg; armL over the top | out 0.14 / 0.12, in 0.62 / 0.54, rack - / 0.70 |
| R10 Nock | always empty (mag 1): reach 0-0.35 (off-hand to the quiver at the right shoulder), IN 0.35-0.75 (arrow on the rest, nocked), RAISE 0.75-1.0 | same | arrow model drawn in the off-hand, then on the bow; the string straight | armR over the shoulder (pitch -150 deg) 0-0.35, forward to the bow in IN | in 0.70 |
| R11 Belt box | LOWER 0-0.10 (roll 20 deg, drop 5 cm), OPEN 0.10-0.20 (`lid` up), OUT 0.20-0.35 (box drops), FETCH 0.35-0.55 (slower, heavy), IN 0.55-0.70, RACK 0.70-0.80 (belt laid in), close 0.80-0.88 (lid slam, jolt), RAISE 0.88-1.0 | same (belt fed: no chamber step) | `lid` and `mag` (box) parts | gun drop 0.12 m, torso pitch +8 deg; armL to the hip | out 0.22, in 0.68, rack 0.86 |
| R12 Tank | LOWER 0-0.10, OPEN 0.10-0.20 (valve turns 90 deg, hiss), OUT 0.20-0.35 (tank slides out), FETCH 0.35-0.55, IN 0.55-0.72, RACK 0.72-0.82 (valve back), prime 0.82-0.92 (W35: 1 fire particle at the pilot; W34: glow pulse), RAISE 0.92-1.0 | same | `cell` part (the tank) under or behind the gun | gun drop 0.10 m, torso pitch +8 deg | out 0.12, in 0.70, rack 0.80 |
| R13 Tube | LOWER 0-0.12 (muzzle up 25 deg, rear toward the off-hand), OPEN 0.12-0.22 (rear cap), OUT 0.22-0.32 (pod out the back), FETCH 0.32-0.52, IN 0.52-0.72 (4-rocket pod pushed in), close 0.72-0.82, RAISE 0.82-1.0 | same | `lid` (rear cap) and `mag` (pod) parts | gun pitch +25 deg, armL behind the shoulder | out 0.24, in 0.70, rack 0.80 |
| R14 Breech | LOWER 0-0.12, OPEN 0.12-0.24 (breech or side gate; glow off), FETCH 0.24-0.46, IN 0.46-0.66, close 0.66-0.78, charge 0.78-0.92 (glow ramps), RAISE 0.92-1.0 | same | the spare is the round itself: W40 a glowing orb, W43 a 3-drill cartridge, W46 the warhead | gun pitch -20 deg; armL to the hip | out 0.14, in 0.64, cellCharge 0.80 |

**Shell by shell (R5, W19).** Each shell is one sim reload of 0.5 s (x modifier); the cycle index and "last shell" are read at render time (last = `magazine + 1 >= magSize` or `reserve <= 1`, infinite reserve excluded); "first" = a visual-only flag set when the reload did not chain from the previous shell (`Weapons.reloadChained`, written in `stepReload`).

| Cycle | Phases (f of that shell) |
|---|---|
| First of several | ENTER 0-0.25 (roll to the port), INSERT 0.25-0.85 (shell click at 0.70), HOLD 0.85-1.0 |
| Middle | FETCH 0-0.35, INSERT 0.35-0.85 (click 0.70), HOLD 0.85-1.0 |
| Last of several | FETCH 0-0.30, INSERT 0.30-0.65 (click 0.60), EXIT 0.65-1.0 (hold pose at 1.0) |
| Only one shell | ENTER 0-0.20, INSERT 0.20-0.60 (click 0.55), EXIT 0.60-1.0 |
| Empty first shell (magazine 0) | ENTER 0-0.20, PORT-LOAD 0.20-0.60 (the shell goes in through the ejection port), RACK 0.60-0.85 (pump back and forward), HOLD 0.85-1.0; if it is also the last: RACK 0.60-0.80, EXIT 0.80-1.0 |
| Interrupted by FIRE (magazine > 0) | the pose blends to hold in 0.06 s of render time, the shell in the hand vanishes, the shot's kick plays on top; no pump (the rounds are already chambered) |

**Weapon map (every catalogue id).**

| Code | Weapon | Class | Mag | Reload (s) | Set | Note |
|---|---|---|---|---|---|---|
| W01 | Breaker Maul | melee | - | - | none | mag 0 (melee: P6-03) |
| W02 | Edge Tanto | melee | - | - | none | mag 0 |
| W03 | Bulwark Shield-Saw | melee | - | - | none | mag 0 |
| W04 | Warden Pistol | sidearm | 12 | 1.4 | R1 | dual variant on a second pickup |
| W05 | Verdict Magnum | sidearm | 6 | 1.4 | R2 | |
| W06 | Hush Pistol | sidearm | 10 | 1.4 | R1 | dart pool never reloads |
| W07 | Sparklock Pistol | sidearm | 24 | 1.4 | R8 | cell at the side |
| W09 | Wasp SMG | smg | 30 | 1.8 | R3 | |
| W10 | Hornet Carbine | smg | 45 | 1.8 | R3 | grenade pool never reloads |
| W12 | Needlethorn | smg | 30 | 1.8 | R8 | needle pod on top |
| W13 | Vanguard Rifle | rifle | 25 | 2.2 | R3 | |
| W15 | Ratchet Burst | rifle | 24 | 2.2 | R3 | |
| W17 | Coilcaster | energy | 20 | 2.0 | R8 | |
| W19 | Scattergun | shotgun | 6 | 0.5 per shell | R5 | pump between shots, see "Action cycles" |
| W20 | Hookjaw | shotgun | 2 | 1.1 | R6 | |
| W21 | Shardcaster | shotgun | 10 | 0.5 | R7 | full magazine in 0.5 s (data fact; P8 question) |
| W23 | Lancet Rail | marksman | 10 | 2.4 | R8 | capacitor whine in RACK |
| W24 | Heron Sniper | sniper | 5 | 3.6 | R4 | bolt between shots, see "Action cycles" |
| W25 | Kestrel DMR | marksman | 15 | 2.4 | R3 | |
| W26 | Stakedriver | marksman | 12 | 2.4 | R9 | incendiary pool never reloads |
| W27 | Talon Bow | marksman | 1 | 0.5 | R10 | explosive arrows never reload |
| W28 | Hailstorm | heavy | 150 | 4.0 | R11 | |
| W30 | Linker | energy | 70 | 2.0 | R8 | |
| W31 | Ramjet Launcher | explosive | 4 | 2.5 | R13 | |
| W32 | Pitcher Launcher | explosive | 6 | 2.5 | R7 | |
| W34 | Gloop Gun | explosive | 25 | 2.5 | R12 | goo canister |
| W35 | Kindler | heavy | 100 | 4.0 | R12 | fuel tank, pilot flare |
| W36 | Ember Repeater | energy | 50 | 2.0 | R8 | vent puff at OUT |
| W37 | Stormlash | energy | 100 | 2.0 | R8 | |
| W38 | Starthrower | energy | 50 | 2.0 | R8 | disc stack on top |
| W39 | Accelerator | energy | 20 | 2.0 | R8 | |
| W40 | Fusion Mortar | explosive | 1 | 2.5 | R14 | orb; detonate press during the reload = a 1 cm thumb jolt, the reload motion goes on |
| W41 | Graviton Lifter | tool | - | - | none | mag 0 |
| W42 | Twin-Gate Projector | tool | - | - | none | mag 0 |
| W43 | Skull Auger | exotic | 3 | 2.5 | R14 | 3-drill cartridge; detonate as W40 |
| W44 | Razorwind | exotic | - | - | none | mag 0 (ammo-free blade) |
| W45 | Daybreak Projector | power | 4 | 3.0 | R8 | reserve 0: only if a ruleset makes the reserve infinite |
| W46 | Halcyon Warhead | power | 1 | 3.0 | R14 | reserve 0: as W45 |

Data home: a `reloadAnims` catalogue (03b, one row per set: phases for partial and empty, first- and third-person key offsets, sound marks) and a `reloadAnim` field on `weaponClasses` with per-weapon overrides in the weapon rows (class defaults: sidearm R1, smg R3, rifle R3, marksman R3, sniper R4, shotgun R5, energy R8, heavy R11, explosive R13, exotic R14, power R8); the overrides are the rows above that differ from their class.

**Cancel and interruption.**

| Cause | Sim (unchanged) | Animation |
|---|---|---|
| Swap | the reload ends; a magazine gets nothing, loaded shells stay | the action pose blends into the swap lowering over 0.1 s of render time; the off-hand and the spare go down with the weapon; the moving part is back in its seat (the old magazine is still in) |
| Quick melee | the reload ends the same way | the action pose blends out in 0.05 s under the strike (P6-03) |
| FIRE, magazine reload | ignored | the reload motion goes on |
| FIRE, shell reload with a round loaded | ends at once, the shot fires next step | see the shell table (0.06 s blend, no pump) |
| Sprint | the reload goes on | the reload motion goes on at the hip; the sprint pose (P6-04) waits for the reload end |
| Stun, frozen, downed (`lowered`) | `stateTime` stops | the pose holds at its f and resumes with it |
| Death, match stop | - | nothing drawn |

**Action cycles between shots (bolt / pump) and charge motions.** Visual only, timed as fractions of the shot interval (`1 - nextShot / interval`), no fire-rate change. W19 pump: back 0.25-0.45, forward 0.45-0.60, red shell casing ejects at 0.42. W24 bolt: up 0.20-0.35, back 0.35-0.50 (casing at 0.45), forward 0.50-0.62, down 0.62-0.72; while scoped only a small scope bob. Charges read the charge fraction (`charge / mode.charge.time`; note: `Render.viewModel` `charge` is in seconds today): W27 string drawn back by the fraction and the bow cants 5 deg; W39 coils glow by level; W34 alt and W45 alt glow swell; W01 alt in P6-03.

### P6-03 - Melee animations (decided 2026-10-29 by the coordinator; the owner can change any row)

**Facts (hit timing, read from `src/11a-weapons.js`; not changed).**
- Every melee hit is decided in the sim step of the trigger: `fire` -> `fireShot` -> `deliverMelee` (a fat ray of `reach`, `MELEE_RADIUS` 0.25) for a melee weapon's primary (auto trigger: each swing at the step the cooldown allows), at the release step for a charge (W01 alt, `stepCharge` -> `releaseShot`), and in `quickMelee` at the MELEE press. There is no wind-up delay before damage: the hit tick is t = 0.
- The cycle T after the hit is the cooldown added to `nextShot`: `shotInterval` (1 / (rate x rateFactor)) for a melee weapon's own modes; exactly 1 / rate for the quick melee. Values: W01 primary 0.4 s, W01 alt 0.667 s, W02 primary 0.4 s, W02 alt 1.0 s, W03 bash 0.667 s, quick melee 0.833 s (30 damage, reach 1.4 m) or the owned melee weapon's primary.
- The quick melee uses the first melee weapon owned in catalogue order (`ownedMelee`) and its primary mode; without one, `QUICK_MELEE`. It ends a reload, is not blocked by sprint (`quickMelee` does not ask `Move.canFire`) and blocks gun fire until T (shared `nextShot`).
- A miss into a floor with W01's charged alt launches the user (`meleeMiss`); a melee miss emits no `impact` (no sound or dust on a wall).
- What exists: the view model only kicks (`kick`) on a melee swing; third person has no swing; the target shows a blood burst (`src/11c-damage.js`) and no body reaction; W03 stun 0.3 s is a status with no pose.

**Decision: timing rule.** The contact pose is drawn on the first rendered frame at or after the hit tick: the strike arc from the guard (or cocked) pose to contact is compressed into that one frame (a smear: at most one frame of 16.7 ms at 60 fps). Follow-through and recovery fill T and the last phase ends exactly at T, the moment the weapon may act again. A wind-up is shown only where the next hit is predictable: during a charge hold, and at the end of a cycle while the trigger of an auto melee stays held (the cocked pose the next contact starts from). All fractions below are of T as read at the hit (`Weapons.meleeCycle`, visual-only, written with `Weapons.meleeAt`, `meleeWeapon` (the striker) and `meleeKind` (primary, alt, quick) in `fire` and `quickMelee`).

| Weapon / mode | Trigger, damage, T | Wind-up | Contact (t = 0) | Follow-through | Recovery | First person | Third person |
|---|---|---|---|---|---|---|---|
| W01 Maul primary | auto, 50, 0.4 s | 0.80-1.0 T while FIRE held (head over the right shoulder) | diagonal chop, right to left; repeats alternate forehand / backhand | 0-0.30 T, head 12 deg past centre | 0.30-0.80 T to guard (or cocked when held) | two-handed: off-hand on the haft | armR and armL from -100 deg to +15 deg at contact, torso +10 deg |
| W01 Maul alt | charge 0-1.2 s, 30-120, T 0.667 s after release | the hold: head raised overhead by the charge fraction (0-0.6), then tightens; at full charge a 2 mm tremble (off with reduce motion) | vertical slam | 0-0.35 T (head to ground level; a floor hit shows dust and the launch keeps its existing FOV kick) | 0.35-1.0 T | two-handed | both arms raised -130 deg by the charge, slam to +20 deg |
| W02 Tanto primary | auto, 35, 0.4 s | 0.80-1.0 T while held | horizontal slash; repeats alternate direction | 0-0.25 T | 0.25-1.0 T | one hand, blade edge leads, roll 25 deg | armR sweeps 60 deg across (gun part offset sideways) |
| W02 Tanto alt | semi, 65 (150 from behind), 1.0 s | none | forward thrust, blade fully out at contact | 0-0.15 T (push 2 cm, twist 20 deg) | 0.15-0.60 T pull back, guard 0.60-1.0 T | the blade drives 0.18 m forward | armR to aim level, gun part +0.25 m forward |
| W03 bash | auto, 40 + stun 0.3 s, 0.667 s | 0.85-1.0 T while held (shield back 4 cm) | shield shove 0.12 m forward, saw spins up | 0-0.30 T | 0.30-1.0 T | shield centre screen | armL (shield arm) shoves forward 0.2 m |
| W03 block (alt hold) | sim `blocking` / `parryUntil` | - | - | - | - | shield to centre over 0.1 s while blocking; rim glows during the parry window; a reflect flashes the rim + 8 sparks + 1 cm jolt; each blocked hit jolts 2 cm; an empty pool sags the shield over 0.15 s | armL raised to chest height while blocking |
| Quick melee, no melee weapon owned | press, 30, 0.833 s | none | gun bash by class: sidearm pistol whip (sweep left 0.1 m, roll 40 deg); smg, rifle, marksman, sniper, shotgun, energy butt-stroke (yaw 35 deg, stock 0.15 m forward); heavy, explosive, power, exotic, tool shoulder shove (forward-left 0.1 m, pitch -10 deg) | 0-0.25 T | 0.25-1.0 T (the gun reaches its hold pose at T, when it may fire) | the held gun | gun part pitch +30 deg and 0.2 m forward |
| Quick melee, a melee weapon owned (striker not the held weapon) | press, the striker's primary damage and T | none | the striker's primary strike, compressed, from the off-hand side (its model mirrored left); the held gun dips 6 cm and rolls 15 deg out of the way | as the striker's primary | as the striker's primary; the striker model vanishes at T | striker model + held gun | armL does the striker's arm motion; no second held model in third person |
| Quick melee with the striker in hand | press | none | the held melee weapon's primary strike | as its primary | as its primary | - | as its primary |

No weapon held: no view model, so no motion (unchanged).

**Target hit reaction (every `damage` event with amount > 0, third person, in 07c).** A per-actor flinch (typed arrays, set by a render-side `damage` listener): torso and head pitch away from the hit direction relative to the victim's facing (from the front: lean back; from behind: lean forward), rise 0.05 s, recover 0.25 s. Amplitude: melee 12 deg (backstab 150, charged maul over 0.6 charge, W03 bash: 18 deg, recover 0.35 s); bullets and beams 0-6 deg by amount / 40; splash 10 deg. A stun (`ACTOR_FLAG.FROZEN`, set by the `stun` status: W03 bash 0.3 s, EMP, chargers) shows a stagger while the flag lasts: arms drop 30 deg, gun pitches down 20 deg. PvE bodies drawn through `drawActorPose` get the same layer (their tell glow, `src/14h-pve.js`, is unchanged). The local player as the target: the view model is knocked 2-4 cm down and pitched -4 deg (0.05 s in, 0.2 s out), scaled by the P7-03 weapon motion setting; the existing camera trauma stays (with the P7-01 F13 tuning).

**Contact feedback.** A melee hit the local player lands holds the view-model contact pose 0.03 s (hit-stop, visual only; the follow-through then runs faster so the cycle still ends at T); a melee hit or miss into a wall or floor within reach emits an `impact` at the ray's hit point (only the audio row and the effect code listen to `impact`: sound and dust, no sim effect); the maul slam on a floor adds 0.15 camera trauma. Sounds stay the existing `melee` / `stab` recipes at the hit tick; rumble in P7-01 F12.

### P6-04 - Motion priority and blend rules (decided 2026-10-29 by the coordinator; the owner can change any row)

**Facts.** Swap today: during a swap `Render.viewModel` shows the pending weapon and `swap` runs 1 -> 0, so the old weapon disappears at once and the new one rises (a pop); `Render.heldWeapon` does the same in third person. No sprint pose exists in the view model. No inspect action exists (no binding, no touch path). ADS needs IDLE (`updateAds`).

**Priority (highest first; a higher layer sets the weight of every lower one to 0 with the blend below).**

| # | Layer | Source (sim state, read only) | Blend in | Blend out |
|---|---|---|---|---|
| 1 | Swap | `state == SWAP` | from whatever pose is shown, 0.1 s (render time) | the raise ends at the swap end |
| 2 | Reload | `state == RELOAD` | from the shown pose over LOWER | RAISE ends at f = 1.0; a cancel blends out 0.05-0.1 s (P6-01) |
| 3 | Melee | `Sim.time - meleeAt < meleeCycle` | one-frame smear to contact | ends at T |
| 4 | Block (W03) | `blocking` | 0.1 s | 0.15 s |
| 5 | Charge / action cycle | `chargeMode >= 0`, pump / bolt interval | with the charge / cycle fraction | with it |
| 6 | ADS | `ads` 0..1 (0.2 s in the sim) | as the sim | as the sim |
| 7 | Sprint | `ACTOR_FLAG.SPRINTING` and IDLE and no melee cycle | 0.15 s (weapon lowered 4 cm, canted 25 deg, pitched -15 deg) | 0.12 s, inside the shortest sprint-to-fire wait (`sprintToFire` + `readyTime` = 0.15 s at least) |
| 8 | Kick, bob, sway, hit knock | always (additive on top, scaled by settings) | - | - |
| 9 | Inspect | not added | - | - |

**Rules.**
- Swap split (visual only, both views): the swap time `stateDuration` is split: 0-0.35 the current weapon lowers (`swap` 0 -> 1), 0.35-1.0 the pending weapon rises (1 -> 0). `Render.viewModel` and `Render.heldWeapon` show the current weapon in the first part and the pending one after; the sim switch at the end and every equip time are unchanged. A swap that changes target mid-way keeps the lowered state (no second lowering).
- Every layer exit blends in render time from the pose last drawn (07e keeps one pose record for the local player, 07c one blend timer per actor); no layer ever snaps.
- The reload layer runs at the hip: its offsets are weighted by (1 - ads); with ALT held through a reload, ADS rises after the refill (0.2 s, sim).
- Melee during a reload: the sim ends the reload; the reload pose blends out in 0.05 s under the strike, the moving part is back in its seat, the spare vanishes. Reload during a melee recovery (allowed: the state is IDLE): the reload takes over, the melee offsets blend out in 0.08 s.
- Quick melee while sprinting (allowed by the sim): the melee layer overrides the sprint pose; the sprint pose returns 0.15 s after T if still sprinting.
- Fire right after a reload, swap or melee: impossible before the layer ends (the sim gates it), so the shot's kick never lands on a half pose; the only overlap is the shell-reload interrupt (0.06 s blend, the kick added on top).
- W40 / W43 detonate during a reload: a 1 cm jolt added on top; the reload motion goes on.
- Muzzle (P2-03) and the self-test probe: every action, sprint and kick offset is 0 in the idle hold pose, so the muzzle arithmetic and the 2 mm view-model probe tests stay valid; tracers are drawn only from poses where the sim allows a shot.
- Inspect: not added. Reason: no free button on touch after P5-01 and no gameplay use; if the owner wants it later it is the lowest layer and any input ends it in 0.1 s.
- Live test (P6-04 "Done when"): every weapon cycles swap -> reload (partial, empty, cancel by swap and by melee) -> melee -> sprint -> ADS on keyboard, controller and touch; record in `docs/LIVE-TESTS.md`.

### P6-02 to P6-04 - Implementation (2026-10-29)

Built to the P6-01, P6-03 and P6-04 decisions above, with the coordinator's answers: sprint does not cancel a reload, no inspect action, the procedural off-hand is accepted, Shardcaster reload data untouched (Phase 8). Visual only: no reload time, damage time, recoil, equip time or any other gameplay value changed (the existing gameplay tests pass unchanged; the sim only gained write-only visual state). Files: `src/03b-data-animations.js` (new: `reloadAnims` R1 to R14, `meleeAnims`), `03c` (`reloadAnim` / `meleeAnim` on classes and rows, `linkWeaponAnims`), `03b-data-render` / `03q` (part `role`s, the `action` slot of the body parts), `07c-render-models` (roles, roll, glow, `drawLoose`), `07c-render-actors` (roll in the shape shader, action slots in `placeActorPart`), `07e` (layers into `fillViewModel`, swap split), `07g-render-weapon-anim.js` (new: samplers, `ViewAction`, `ActorAction`), `11a` / `11d` (visual state, `Render.viewModel` fields, `Render.actorAction`, `swapLook`, melee surface impact, `magShare`), `18k` (slam trauma), `20b-test-anims.js` (group `anims`, 92 checks), docs (ARCHITECTURE, api/render, api/weapons-damage, SPECIFICATION WPN-014 to WPN-016, LIVE-TESTS LT-M-074 to LT-M-076).

| Part | Result |
|---|---|
| Reload sets | 14 sets mapped to all 38 weapons (self-test against the Appendix C table; the six that never reload have none); phases, partial and empty variants and the five shell cycles with the exact fractions of P6-01; moving part roles added to the models (mag, slide, bolt, pump, cyl, barrel, lid, cell, string, arrow; new small parts on the heron, the energy guns' side cell, the hailstorm lid, the ramjet pod and lid, the auger cartridge) |
| End = refill | for all 32 weapons with a magazine, partial and empty, and with quickMag / extendedMag: the animation is still playing on the step before the rounds are added and ends on that step (fraction reaches 1.0) |
| Partial / empty / shells / cancel | an empty reload chambers inside the same total time (R1, R3, R9 and the W19 port and pump); W19 plays first, middle, last, only and empty-first cycles and chains without a pop; FIRE ends a shell reload with a 0.06 s blend; a swap (0.1 s) or a quick melee (0.05 s) cancels a reload and the part is back in its seat; sprint and FIRE do not cancel a magazine reload |
| Melee | 8 strike rows; the contact pose is drawn on the first frame after the hit tick, follow-through and recovery end on the step the weapon may act again (tested for the maul, maul alt, tanto, tanto alt, shield bash and the quick melee of a pistol, a rifle and a heavy gun, with and without a target), hit-stop 0.03 s, wind-up from a held trigger, forehand / backhand, off-hand striker for a quick melee by another melee weapon, block and parry flash, hit knock |
| Third person | arm, gun, torso and head layer for reload, strike and swap; the model's moving part detaches at the near LOD on presets with model detail; stagger of a stunned body; flinch of a hit body; no layer for killcam replay bodies or distant ones |
| Priority and blends | swap > reload > melee > block > charge or cycle > sprint, every layer blends from the pose last drawn; reload offsets weighted by 1 - ADS; swap 35 % lowering and 65 % raising with the equip time unchanged, a swap changed mid-way carries on from the weapon and level drawn; W19 pump, W24 bolt, W27 string and cant, W39 / W34 / W45 glow swell, W40 / W43 detonate jolt |
| Pop test | pose continuity sampled at 60 fps across swap, reload (partial, empty, cancelled by swap and by melee, sprint during it), melee, ADS and sprint for all 38 weapons: no frame moves the pivot more than 0.1 m or turns it more than 0.35 rad (the contact frame of a strike is a smear by design) |
| Muzzle | every offset is 0 in the idle hold pose for all 38 weapons in both views (self-tested); the muzzle and 2 mm probe tests pass unchanged |
| `charge` | `Render.viewModel` `charge` stays in seconds (it was documented as 0..1); `chargeFraction` = it over `charge.time`; docs corrected |
| Allocation | the layers, a whole view-model frame and the third-person layer allocate nothing per frame (self-tests with the heap counter). Found while doing it: a float passed to or returned from a function V8 does not inline, or a ternary of a float and an integer, boxes on the heap; ARCHITECTURE code rules say so now |

**Performance (P0-02 gate), `node tools/perf.mjs --scenes tdm --presets potato,low --throttle 4 --seconds 10 --no-boot`, the HEAD test build (A) against this build (B), alternating A / B and B / A, 6 runs each, medians (the machine was shared and noisy: single runs swung 2 to 10 times, so the median is what counts):**

| Cell (4x) | Metric | A (HEAD) | B (P6) | Difference |
|---|---|---|---|---|
| tdm Potato | render ms | 1.33 | 1.32 | -0.01 |
| tdm Potato | frame CPU @120 ms | 5.83 | 5.46 | -0.37 |
| tdm Potato | draw calls | 30.5 | 32 | +1.5 (cap 50) |
| tdm Low | render ms | 1.46 | 1.35 | -0.11 |
| tdm Low | frame CPU @120 ms | 5.63 | 5.73 | +0.10 |
| tdm Low | draw calls | 32 | 32 | 0 (cap 80) |

Both cells are inside the gate (no cell worse than +10 % and +0.3 ms) and the allocation rate is unchanged (about 2.9 MB/s Potato, 0.9 MB/s Low). An earlier balanced round with the first version (before the per-body fast path and the roll write skip) had Low render +0.47 ms and frame CPU +0.88 ms, over the gate: the third-person layer cleared its slots for every body every frame; a body with nothing to show now costs one hook call. The scene is the existing one: the followed bot reloads and the bots reload and fight naturally; a forced worst case (every body reloading in the near LOD) was not added to the scene and has not been measured. HEAD build for `--file`: `C:\Users\GS\AppData\Local\Temp\claude\ctk\head-ClassTimeKiller.test.html` (temp, not in the repo). Self-test: full suite 6660 / 6661; the one miss is the `nav` big-map build time (a timing check, 52 ms against 50 ms; HEAD misses the same kind of check on this machine) in code this work did not touch. Shipped file: `__CTK.log.errors().length` is 0.

**Deviations from Appendix C and what is left open.**
- Sound cues (reloadOut, reloadIn, reloadRack, shellIn, cellCharge) are not played: they belong to P7-02 (F11); the mark fractions are in the `reloadAnims` rows.
- Particles are not drawn: the spent casings of R2, the live round ejected by the R4 bolt, the W36 vent puffs, the W35 pilot flare (shared with the P7 `casing` kind, F06).
- Reload work poses are tuned per set (review round 2, after the first version swung the back end of long guns to the eye): each set says where its magazine well goes (a few cm toward the middle and up) and the gun tilts ABOUT the well with the muzzle rising and turning in (pitch + 5 to 25, yaw + 5 to 10, small roll), not about the grip as the P6-01 table's pitch, roll and drop numbers imply (P6-01 had the muzzle going down). A self-test bounds every frame of every reload and strike of all 38 weapons: at most 30 % of a 16:9 screen (worst now 25 %, the idle shield) and the nearest corner at least 0.12 m from the eye (worst now 0.14 m). Hand points, part moves, strike poses and third-person angles are still values read off screenshots: the owner's review will change numbers, which are all data rows. Contact sheets: `C:\Users\GS\AppData\Local\Temp\claude\ctk-p6tools\sheet-after.png`.
- A backhand (every second chop) mirrors yaw and roll only, not the position, so it starts from the same place on the screen (the first version mirrored the position into the bottom-right corner).
- The R1 slide stays back only through an empty reload, not while the gun is dry outside a reload.
- A part with its own pitch past 45 degrees (a forward barrel) ignores the weapon roll: it is round about that axis.
- A swap changed during the raise lowers the weapon drawn from its level again (no jump) instead of switching the model in mid-air.
- "Blocked hit jolts 2 cm" uses the general hit knock (2 to 4 cm by damage, down and pitched down).
- The P7-03 weapon motion setting does not exist yet: the offsets are not scaled by it (the charge tremble already honours reduce motion; `ViewAction.update` is the one place to scale).
- Two existing tests described the old swap and were changed to the swap split: `weapons` "a swap raises the new weapon..." and `render` "a swap starts lowered and rises".
- `weapon.fire` gained `magShare` (P7 F09) because the brief asked for the event table; no listener uses it yet.
- The live tests LT-M-074 to LT-M-076 are written and not run (they need devices). The tasks are not ticked.

### P7-01 - Feedback list (decided 2026-10-29 by the coordinator; the owner can change any row)

Budget: the P0-02 gate (no perf cell worse than +10 % and +0.3 ms against the baseline build, draw calls Potato 50 / Low 80, zero steady-state allocation, PERF-006). The Low and Potato presets have `lights: 0` and Potato `decals: 0`, so light and decal items cost nothing at the low-spec target. Estimated total for Phase 6 + 7 at 4x throttle, `tdm` Potato: render +0.05 to +0.10 ms (baseline 2.15), HUD +0.01 ms, sim +0 (a few visual-only stores per event), draw calls +0 to +2 (the off-hand capsule; casings share the particle pass), voices +0 per shot. P7-02 measures it back to back with the baseline build.

| ID | Item | Exists now (do not duplicate) | Decision | Trigger | Shows / plays | Cost (4x, Potato) | P7-03 setting |
|---|---|---|---|---|---|---|---|
| F01 | Hit markers, kill confirm | `src/17b-hud-combat.js` hit ticks 0.22 s (head gold), kill marker 0.5 s, damage numbers; sounds `hitTick`, `headshot`, `killConfirm` (`src/06b-audio-recipes.js`); melee counts (`ACCURACY_HIT_KINDS`) | accepted, small tuning | `kill` by the player with zone head | the kill marker in gold and `killConfirm` pitched x1.2 | 0 | HUD element `hitMarkers` (exists) |
| F02 | Damage direction | arcs (6 slots, 1.4 s), red hit tint 0.35 s (photosensitivity and reduce motion aware) | accepted as is | - | - | 0 | HUD element `damageArcs` (exists) |
| F03 | Per-surface impacts | sound per material (8 rows + aliases); visuals always 6 sparks + a `bullet` decal (`emitImpact`) | accepted | `impact` (11a `emitImpact`) and melee wall / floor hits (P6-03) | material -> effect, two fields on the `materials` rows: metal, plate, oil, hazard, trim, grip -> sparks + bullet decal; concrete, brick, rock, tile -> grey dust 5 + bullet; wood, crate -> brown dust 5 + bullet; sand, grass, moss, snow -> dust in the material colour 5 + bullet; glass, ice, light -> 6 white sparks + bullet; water -> 8 water particles, no decal. Sound aliases added: plate, oil, hazard, trim, grip -> metal; ice, light -> glass; moss -> dirt (today they fall back to concrete) | 0 (same particle count, no new decal) | particle intensity (exists) |
| F04 | Muzzle flash | `Fx.burst('muzzle', 3, family colour)` at the muzzle per shot; no light | accepted | `announceShot` | flash size and count per class (`weaponClasses.flash`: sidearm 1, smg 0.8, rifle 1, marksman 1.1, sniper 1.4, shotgun 1.5, heavy 1.3, explosive 1.2, energy 0.8 glow-coloured); W06 primary, W27, melee and tools flash 0. A 0.05 s dynamic light (radius 3 m x flash) on presets with 2 or more lights: own shots always, others within 25 m, one live muzzle light per actor (an automatic gun refreshes it), never taking a slot an explosion or a flashlight holds | < 0.01 ms; Low / Potato no light | new "Muzzle flash: full / reduced / off" (reduced = no light, half burst); photosensitivity forces reduced |
| F05 | Recoil kick (visual) | `kick` 1 -> 0 in 0.12 s: +1.2 cm up, -5 cm back, 6 deg pitch x the class `kick` | accepted | own shot | per-class profile on the `viewModels` rows (`kickBack`, `kickRoll` alternating +-2 deg from `Rng.fx`, `kickTime` 0.08-0.2 s, a spring with at most 5 % overshoot); third person: the held gun pitches up 2-6 deg by class for 0.1 s. Visual only: the camera recoil (`recoilPitch` / `recoilYaw`, WPN-004) stays the gameplay value | < 0.01 ms | new "Weapon motion (%)" (kick, reload roll, sprint cant, hit knock); reduce motion caps it at 40 % |
| F06 | Shell ejection | none | accepted | own shot of a kinetic gun; others' shots at the near LOD | new fx kind `casing` (brass, 1 particle, gravity 9.8, life 0.6-0.9 s, 2 cm), from the right side 40 % back from the muzzle (or a `port` part role); at most 10 per second per actor (fast guns eject every 2nd or 3rd shot); red shells from the W19 pump and the W20 break, 6 at most from the W05 cylinder (P6-01); energy guns none (W36 vents in its reload); launchers, bows, crossbow, melee none. Potato: own shots only | 1 particle per shot, pool-capped | particle intensity (exists) |
| F07 | Distance tail | distance low-pass (cutoff halves per 30 m), level roll-off, occlusion, rear shading (`src/06-audio.js`) | accepted | `weapon.fire` heard beyond 35 m | the same voice plays a far variant: decay x1 -> x2 from 35 to 120 m and the noise crack dropped, so distant fire reads as a boom; a `tail` factor per class (sniper, heavy, explosive, power longer) on the event row | 0 voices, a few multiplies per far shot | SFX volume (exists) |
| F08 | Low-health cues | vignette with pulse below 35 %, heart glyph pulse, `heartbeat` 1.0 -> 0.5 s (`Sound` heartbeat clock), red hit tint | accepted as is | - | - | 0 | new "Low-health heartbeat: on / off"; pulses already stop with reduce motion |
| F09 | Low-ammo cues | HUD LOW AMMO (<= 25 %), RELOAD, NO AMMO with blink; dry click `empty`, toast, auto switch (D-F03) | accepted, audio added | own shot with the magazine at or below 25 % | own shots rise in pitch x1.0 -> x1.08 as the magazine empties; the shot that empties the magazine adds a short `lastRound` ping. `weapon.fire` gains `magShare` (0..1, -1 for no magazine): a field added to a reused payload, listeners unchanged; ARCHITECTURE event table updated | 0 voices; 1 voice per emptied magazine | SFX volume (exists) |
| F10 | Ability ready cues | cooldown rings, ULT button shows when ready, gold meter; no sound; A-09: a target ability pressed with no target does nothing | accepted | a pressable slot (A1, A2, TOOL charges, ULT) of the local player turns ready after a cooldown of 3 s or more; at most one chime per 0.5 s | `abilityReady` two-note chime (UI bus), `ultReady` three notes; the slot's ring flashes 0.4 s (reduce motion: a static highlight). A-09: a target ability with no target plays the `empty` click and toasts "No target" once per press, the resource kept (same recipe as D-F04) | one HUD comparison per slot per frame; 1 UI voice per event | UI volume (exists) |
| F11 | Reload and action sound cues | one `reload` sound at the start | accepted | the P6-01 sound marks and the W19 pump / W24 bolt cycles, local player only | `reloadOut`, `reloadIn`, `reloadRack`, `shellIn`, `cellCharge` | +2 or 3 voices per own reload | SFX volume (exists) |
| F12 | Controller rumble | `Input.rumble`: damage (amount / 100, 160 ms), blasts in reach (240 ms), own heavy-class fire (0.35, 70 ms); controller dual-rumble and phone `navigator.vibrate`; switch `controls.vibration` | accepted, 3 sources added | own melee contact (0.4, 60 ms), a W03 parry (0.6, 90 ms), a charge reaching full (W01 alt, W27, W39, W34 alt, W45 alt: 0.2, 40 ms, controller only) | rumble | 0 | new "Vibration strength (%)" next to the switch |
| F13 | Camera shake | `ViewFx` (`src/18k-ui-crosshair.js`): explosions, damage, hard landings; FOV kick on dashes and impulses; sliders `video.shake`, `video.fovKick`; reduce motion silences them | accepted with tuning | damage to the local player | damage trauma becomes mostly roll: its yaw / pitch part is capped at 0.3 deg, because shots follow the aim, not the shaken camera, and the crosshair would leave the aim point by up to 2.6 deg; explosions keep their values; the maul slam adds 0.15 (P6-03) | 0 | shake slider and reduce motion (exist) |
| F14 | Target hit reaction | blood burst only | accepted (P6-03) | `damage` | body flinch and stun stagger; the local player's view-model knock | < 0.02 ms for 16 bots | weapon motion (F05) for the own knock |
| F15 | Melee hit-stop | none | accepted (P6-03) | own melee hit | 0.03 s view-model hold | 0 | - |

**Not accepted.**

| Item | Reason |
|---|---|
| Camera shake or FOV punch on own fire | moves the picture away from the aim point; the gameplay recoil already moves the view |
| Casing sounds and casing decals | voice budget (Potato 12 voices, AUD-002) and decal pool (Potato 0) |
| Muffled world audio at low health | hides footsteps the player needs (AUD-004) |
| Blood decals on walls behind a target, impact lights | decal pool and light caps; the existing blood burst stays |
| Damage blur, chromatic or desaturation post effects | shader program cap (REN-003: 7 of 8 used) and post is off on Low and Potato |
| White screen flashes on kills or hits | photosensitivity (ACC-005); the kill marker and sound are enough |
| Directional rumble | the Gamepad API drives a weak and a strong motor, not a left and a right one; the damage arcs give direction |

**Intense effects and their P7-03 setting.** Camera shake (slider, exists), FOV kick (slider, exists), screen flashes and the red hit tint (photosensitivity and reduce motion, exist), low-health pulse (reduce motion, exists), particles (slider, exists: covers casings and impacts), muzzle light flicker (new muzzle flash setting; photosensitivity forces reduced), view-model kick, reload roll, sprint cant and hit knock (new weapon motion slider; reduce motion caps it at 40 %), heartbeat (new on / off), vibration (new strength slider). New settings are defined with `Settings.define` and each is read (the settings self-test fails on a setting nobody reads).

**Where the implementer works (P6-02, P6-03, P6-04, P7-02, P7-03).** `src/11a-weapons.js` (`beginReload`, `stepReload`, `fire`, `quickMelee`, `announceShot`, `emitImpact`, `deliverMelee` / `meleeMiss`, `viewModel`, `Render.heldWeapon`, a new `Render.actorAction` hook for third person); `src/03c-data-weapons.js` (`reloadAnim` on classes and rows, `flash`); `src/03b-data-render.js` (`reloadAnims`, `meleeAnims`, `viewModels` kick fields, fx kind `casing`, `materials` impact fields, part `role` in `MODEL_SCHEMA` parts); `src/03q-data-models-weapons.js` (part roles); `src/07c-render-models.js` (roles compiled, `drawPart` offsets, `drawHeldWeapon`); `src/07e-render-view.js` (`readViewModel`, `poseWeapon`, `fillViewModel`: layers, off-hand, spare, blends, sprint pose, swap split); `src/07c-render-actors.js` (`animateActor`, `placeActorPart`: action layer, flinch); `src/07d-render-fx.js` (muzzle light slot rule); `src/06-audio.js` and `src/06b-audio-recipes.js` (new recipes, far variant, aliases, heartbeat setting); `src/05a-input.js` (`RUMBLE`, strength); `src/12e-abilities.js` (`tryActivate` no-target, A-09); `src/17a-hud.js`, `src/17b-hud-combat.js` (ready flash, gold kill marker); `src/18k-ui-crosshair.js` (`ViewFx` damage tuning, weapon motion and muzzle flash settings). Docs: `docs/ARCHITECTURE.md` (`Render.viewModel` fields, `Render.actorAction`, `weapon.fire` `magShare`), `docs/api/*.md`, `docs/SPECIFICATION.md` (WPN, UI-005, ACC-005, AUD-005, INP-007 rows), `docs/LIVE-TESTS.md`.

### P7-02 to P7-03 - Implementation (2026-10-29)

Nothing was ticked. The gameplay numbers are unchanged (the weapon, damage, ability and movement tests pass as they were; the only changes to old tests are the three listed under "Changed tests"). New code: `src/11f-weapons-feedback.js` (`ShotFx`), new self-tests `src/20b-test-feedback.js` (group `feedback`, 127 checks), the perf scene `storm` in `src/20b-test-perf.js`.

**The 15 items.**

| ID | Done in | Notes |
|---|---|---|
| F01 | 17b (`HudCombat.killHead`, gold kill marker), 06b (`pitchIf`: x1.2) | trigger: `kill` by the player with zone head |
| F02, F08 | - | as decided (F08 only gets its setting) |
| F03 | 03b (`materials.impact`, `IMPACT_EFFECTS`), 11f `ShotFx.surface`, 06b aliases | 20 materials, one field `impact` on the row (the effect row holds kind, count, colour and decal, which the P7-01 text called a second field); water makes a 14-drop `splash` in pale blue; wood throws pale chips (brown dust on a brown plank was invisible); a melee blow on a wall makes the same particles without the decal (metal now throws sparks, it threw dust) |
| F04 | 03c (`flash`), 11f `ShotFx.flash`, 07d `Fx.muzzleLight`, 18k setting | the burst starts 10 cm past the muzzle and is warm (it was the class body colour, near black on a rifle: invisible); the player's own flash is 0.4 of the kind's 14 cm (about 5 cm, 40 px at 1280 x 800), another body's keeps 14 cm; the particles of one flash share an alpha of 1.2 (none above 0.6) so they never burn to white; W06 and W27 flash 0 on both modes of the row, not on the primary only |
| F05 | 03b (`kickTime`, `kickBack`, `kickRoll` on the viewModels rows), 07g `kickLayer`, third person `thirdKick` | the spring replaced the linear kick of 07e; the sim `kick` and the camera recoil are untouched |
| F06 | 03b (`casing`), 03c (`casing`, `otherCasings` on quality), 11f | 8 guns eject at the shot; R2, R6 and the pump and bolt cycles eject at their marks; a casing is a hard-edged brass streak (2.5 cm x 0.8 cm, the fourth particle mode, 1.2 to 2 m/s) |
| F07 | 06 (`audioTail`), 06b (`gun` recipes, `SOUND_CLASS_TAIL`) | decay x1 to x(1 + tail) from 35 to 120 m, crack fades out; no extra voice |
| F09 | 06b (`soundPitch` low ammo, `lastRound`) | `magShare` was added in P6 |
| F10 | 12e (`watchReady`, `needsTarget`, `noTarget`), 17a (ring flash), 06b | events `ability.ready`, `ability.notarget`; A-09 fixed |
| F11 | 11a (`cueReload`, `cueCycle`, `emitCue`), 03b (`marks`, `fxKind`, `cueMarks`), 06b | event `weapon.cue`, local player only |
| F12 | 05a (three sources and the strength), 11a / 11d events `weapon.parry`, `weapon.chargeFull` | the charge pulse is the controller's only |
| F13 | 18k (`addDamageTrauma`) | yaw and pitch at most 0.3 degrees, roll up to 0.2 rad x strength |
| F14, F15 | P6-03 | - |

**P7-03 settings (all additive: an older save lacks the key and gets the default; SAVE_VERSION stays 1).**

| Setting | Key | Default | Reduced / off | Self-tested |
|---|---|---|---|---|
| Weapon motion (%) | `video.weaponMotion` (View group) | 100 | scales the reload, melee, cycle and sprint layers, the kick, the hit knock and the detonate jolt; reduce motion caps it at 40 %; the block pose, the maul's charge pose and the parts of a reload that move (a magazine leaving) are not scaled | 50 % is half, 0 % is none, for each of the five |
| Muzzle flash | `video.muzzleFlash` | full | reduced: ONE particle at half the size and half the alpha, no light; off: none; photosensitivity mode: off for a gun above 3 shots a second, reduced for a slower one | per class, per level, per preset, the drawn size and alpha, the photosensitivity rule for fast and slow guns |
| Vibration strength (%) | `controls.vibrationStrength` | 100 | multiplies every rumble, phone buzz length included; 0 = none | sources, 50 %, 0 %, the switch |
| Low-health heartbeat | `audio.heartbeat` | on | off = silent below 35 % | on / off |
| Camera shake (%) | `video.shake` | 100 | (was there) | 0 shakes nothing, 50 is half the roll |

Each key is checked to round trip, to load clean from an older save, to be sanitized when its stored value is wrong, to survive an export and import and a reload, and to have a settings row that the d-pad reaches and changes, the arrow keys change and a tap or drag changes (touch).

**Review round 2 (2026-10-30, the visual review of the first version).** (1) The own first-person flash is 5 cm instead of 14 cm and the particles share an alpha; (2) reduced is one particle at half the size and half the alpha, photosensitivity mode is off for a gun above 3 shots a second and reduced for a slower one, and the test checks the drawn size and alpha; (3) casings are hard-edged brass streaks (a fourth particle mode in the particle shader); (4) per-event allocation removed (below); (5) the third-person kick is only worked out for a near body while it is at least 0.2 degrees (the early exit is back for the rest of the 0.12 s and for far bodies); (6) wood dust is pale chips, water a 14-drop splash; (7) the vibration strength label. Sheet: `C:\Users\GS\AppData\Local\Temp\claude\ctk-p7tools\sheet-after.png`.

**Changed tests (3).** `uiacc` "a hit on you shakes the view a little" now reads the damage shake (`ViewFx.damageTrauma`); `muzzle` "every shot's muzzle flash is at the muzzle" now sees the flash as `Fx.burstAt`, 10 cm past the muzzle, and none for a flash-0 gun, with the setting at full; `anims` and `core` needed no change of text (the sniper's kick was tuned so that no frame moves the gun more than 10 cm).

**Allocation.** The per-frame layers (the kick spring, the weapon motion scale, the ready watch, the damage shake, the rumble sources) allocate nothing (heap counter). Spawning particles was measured at the real call sites (round 2: 60 to 130 bytes a shot, 85 to 120 a hit): the cause was numbers computed into the fields of the effect records, which V8 boxes (24 to 36 bytes a call, in every tier). The point, the spawn and the direction scratch are now Float64Arrays (`makeFxPoint`, `fxSpawn`, `fxDirection`), the random draws come from one call (`Rng.fx.fill`), the muzzle aim is the one `announceShot` already worked out, and `Math.sqrt(x) || 1` (a float or an integer: boxed) is `+ 1e-9`. The self-tests measure the same call with the feedback off (a gun without flash or casing, a headless hit) and require the difference to be under 16 bytes: a whole shot (`Weapons.announceShot`), a hit on a surface (`emitImpact`) and the flash alone all pass.

**Performance (P0-02 gate), `node tools/perf.mjs --scenes tdm --presets potato,low --throttle 4 --seconds 8 --no-boot`, HEAD 504e3f9 (A) against this build (B), alternating A / B and B / A, medians (the machine was shared and noisy: single runs of the same build differ by 30 %); first measured before the review round, re-measured after it:**

Round 2 (after the review fixes): 9 runs each, A and B alternating, the order swapped every run, medians; `tdm`, 4x throttle. Round 1 (11 runs each) was within noise as well (Potato frame CPU -1.25 ms, Low -1.85 ms). HEAD build for `--file`: `C:\Users\GS\AppData\Local\Temp\claude\ctk\head7-ClassTimeKiller.test.html`.

| Cell (4x) | Metric | A (HEAD 504e3f9) | B (P7, round 2) | Difference |
|---|---|---|---|---|
| tdm Potato | render ms | 3.25 | 3.23 | -0.02 |
| tdm Potato | frame CPU @120 ms | 11.91 | 11.43 | -0.48 |
| tdm Potato | sim ms per step | 4.36 | 4.35 | -0.01 |
| tdm Potato | HUD ms | 1.79 | 1.86 | +0.07 |
| tdm Potato | draw calls | 30 | 30 | 0 (cap 50) |
| tdm Potato | allocation KB/s | 3237 | 3369 | +132 |
| tdm Low | render ms | 3.23 | 2.77 | -0.46 |
| tdm Low | frame CPU @120 ms | 11.84 | 10.17 | -1.67 |
| tdm Low | sim ms per step | 4.83 | 4.02 | -0.81 |
| tdm Low | HUD ms | 1.61 | 1.74 | +0.13 |
| tdm Low | draw calls | 31 | 29 | -2 (cap 80) |
| tdm Low | allocation KB/s | 1021 | 912 | -109 |

No cell is worse than +10 % and +0.3 ms: the gate holds (the machine was shared, single runs of one build swung 8 to 23 ms, only the medians mean anything; the allocation rate difference is inside the run-to-run spread of 2200 to 4900 KB/s).

**Forced worst case, scene `storm` (the tdm scene plus 12 shots, 12 hits on surfaces and 12 blood bursts every frame, casing rate limit bypassed: about 40 times what the 16 bots fire), 3 runs, medians:** Potato render 2.52 ms (tdm B 3.23), frame CPU @120 15.3 ms, draw calls 30, allocation 3432 KB/s; Low render 2.21 ms (tdm B 2.77), frame CPU @120 14.2 ms, draw calls 32, allocation 1038 KB/s. The storm is over every per-system budget by design (an upper bound: the pools are capped by the quality rows, so it cannot grow), and in this run it is not measurably slower than tdm itself in render time, adds no draw call and no allocation growth; its frame CPU is dominated by the 36 effects' CPU writes and by noise (3 runs).

**Deviations and open items.**
- Reload particles (R2, R4, W36, W35) and the cycle casings are the local player's only (the sound cues are too, as decided); another body's reload shows its P6 body animation without particles. Other bodies' shots do eject casings (near LOD, not on Potato).
- A casing is a 2.5 cm streak as the review asked; its size is one number (`casing` in `fxKinds`).
- The vibration strength row says "controller only" where the phone cannot vibrate (iPhone), like the switch above it.
- The flash colour of a kinetic gun changed from the class body colour to warm (see F04). If the owner wants the old look: one line in `ShotFx.flash`.
- The weapon motion setting does not scale another body's gun kick (that is not the player's own motion).
- The live tests LT-M-077 to LT-M-079 are written and not run (they need devices and ears). The tasks are not ticked.
- Contact sheet of the visual effects (hit marker, kill confirm, damage direction, impacts on four surfaces and water, muzzle flash full and reduced and off, casings, low health): `C:\Users\GS\AppData\Local\Temp\claude\ctk-p6tools\sheet-p7.png`; `__CTK.feedbackDemo(scene)` makes each still.

### P8-01 - Balance targets (decided 2026-10-30 by the coordinator; the owner can change any row)

- **Fact (2026-10-30, HEAD 81a00f5)**: the only balance targets today are the time-to-kill bands of `weaponClasses.ttk` (`src/03c-data-weapons.js:11-22`), checked from the data for every primary by the `content` self-test (`src/20b-test-content.js:54-69`, with "only shotgun, marksman, sniper, power and melee rows one-shot 100 HP" and "every shotgun one-shots at 2 m and needs two shots at 15 m"). No pick, usage, win or side target exists. The one side check is `botsoak` "ctf: neither side wins every decided match" over 5 seeds (`src/20b-test-bots.js:1542-1567`); the one pace check is the hero kill pace over 4 seeds (`:1608-1625`).
- **Fact, how bots arm** (the only pick data the game has: it is offline, with no telemetry). Primary: the profile favourite when it fits the slot, else an even draw among guns whose `botPref.range` holds the bot's fight distance (25 % of the map's long side x a style factor, clamped to 8-60 m), never an exotic or a magazine under 4 (`src/13d-economy.js:385-445`). Secondary: W04 unless the favourite is a sidearm. Melee: the ruleset's `melee`. Lethal, tactical, device, ability and ultimate: weighted by the row's botUse chance from the bot's own hash stream (`src/13d-economy.js:409-430`, `BOT_GADGET_USE` `src/03g-data-bots.js:180-197`); G13 weighs 0 (a bot's own wall is not in the nav graph). So bot pick shares follow from the data and can be computed without a match.
- **Fact, exposure** (read from `CAT.maps` with `--eval`): hand-made maps place only two powerups (PU01 on spire, twinkeeps, harbor and gantry; PU03 on skyyard) and no power weapon; generated maps add PU02, PU05 and PU06 (`src/03n-data-mapgen.js:74`). PU04, PU09 to PU15, W45 and W46 reach a match only through editor maps, X17 Super Powerups or a mode.

**Metrics** (one definition each; the P8-03 runner works them out from the `fire`, `damage`, `kill`, `gadget.use`, `ability.cast` / `ability.end`, `pickup` and `score` events plus a held-weapon sample every tick)

| ID | Metric | Definition | Neutral value |
|---|---|---|---|
| M1 | Pick share | share of spawn loadouts (one per life) in a slot that hold the row (bots) | 1 / options |
| M2 | Held share | share of the carrier's alive time with the weapon drawn | - |
| M3 | Engagement win rate (EWR) | kills with the row / (kills with it + deaths of a holder while it is drawn) | 50 % |
| M4 | Kill rate index (KRI) | kills per minute drawn / the mean of every combat weapon in the same case | 1.0 |
| M5 | Use rate | gadget: uses per carrier life; ability: casts x cooldown / alive time with it (charges: per charge; energy: energy spent / energy gained); ultimate: share of ready ultimates cast within 20 s | 1.0 = used every time it is ready |
| M6 | Kill participation (KP5) | share of uses after which an enemy the use touched (damage, status, reveal, pull, push, freeze) dies to the user's side within 5 s | - |
| M7 | Carrier score index (CSI) | the carrier's final score rank as a percentile (0 last, 1 first), averaged over carriers | 0.5 |
| M8 | Side win share | side 0 wins / decided matches, over mirrored seed pairs (same bots, sides swapped) | 50 % |
| M9 | Score share | side 0 share of points, captures or rounds | 50 % |
| M10 | Pace | match length / time limit when it ends by score, else the leader's score projected to the time limit / score limit | - |
| M11 | Spawn deaths | share of deaths within 3 s after spawn protection ends | - |
| M12 | Comeback rate | share of team matches won by the side behind at half time | - |

- **Pass rule**: a row fails when its whole 95 % interval (Wilson for rates, a bootstrap over seeds for indexes) lies outside the band, and is "watch" when only the point value is outside. Under the minimum sample (150 engagements for M3, 40 uses for M5 / M6, 16 decided matches for M8) it is "no data" and gets more seeds, never a pass. A case with any bot shot at an unperceived target (`unperceivedShots` or `unknownShots` above 0, ARC-033) fails whatever its balance numbers say.

**Weapons** (36 combat rows; the tools W41 / W42 have no combat target). "Home" = inside the row's `botPref.range`, "away" = outside it. The TTK band is the existing `weaponClasses.ttk`, unchanged.

| Class | TTK band (s, exists) | EWR overall: per row; class mean | EWR home / away | KRI per row | Held share (carriers) | Class rule | Reason |
|---|---|---|---|---|---|---|---|
| melee | 0.3-1.5 | 35-55 %; 40-50 % | at 0-3 m 55 % or more / - | 0.6-1.5 | 3-20 % | melee kills 3-12 % of all kills (RS08 Iron Bulwark 10-25 %) | a backup slot that wins only at arm's length; RS08 is the melee ruleset |
| sidearm | 0.3-1.5 | 40-55 %; 42-50 % | 50 % or more / 50 % or less | 0.7-1.3 | 5-35 % | sidearm kills 25 % or less of all kills in RS01 | MIS-023: a sidearm that beats primaries collapses the sandbox |
| smg | 0.3-1.2 | 42-58 %; 45-55 % | 55 % or more / 45 % or less | 0.7-1.4 | 50 % or more | - | close-range primaries must lose at range (falloff) |
| shotgun | 0-1 | 42-58 %; 45-55 % | inside 8 m 60 % or more / past 15 m 40 % or less | 0.7-1.4 | 50 % or more | one-shot at 2 m, two shots at 15 m (exists) | the steepest range curve |
| rifle | 0.15-0.8 | 45-58 %; 47-55 % | 52 % or more / 48 % or less | 0.8-1.3 | 50 % or more | the reference class: the other bands are read against it | all-round guns keep only a small home edge |
| marksman | 0-1.2 | 42-58 %; 45-55 % | 55 % or more / 45 % or less | 0.7-1.4 | 50 % or more | - | precision is paid back at range |
| sniper | 0-0.5 | 40-58 % (one row) | past 25 m 58 % or more / inside 10 m 40 % or less | 0.6-1.4 | 50 % or more | sniper kills 20 % or less of the kills on any map | MIS-018: overwatch must not lock a map |
| energy | 0.15-1.6 | 42-58 %; 45-55 % | 55 % or more / 45 % or less | 0.7-1.4 | 50 % or more | - | six rows, six mechanics: each needs a home |
| heavy | 0.3-1.8 | 45-60 %; 47-57 % | 55 % or more / 45 % or less | 0.8-1.5 | 50 % or more | - | pays with move x0.75-0.85, so a slightly higher win is allowed |
| explosive | 0-1.2 | 42-58 %; 45-55 % | 55 % or more / 45 % or less | 0.7-1.4 | 40 % or more | self damage 15 % or less of the class's damage; splash kills 30 % or less of all kills in RS01 | MIS-013: no grenade-launcher spam |
| exotic | 0-2.5 | 40-58 % | 55 % or more / - | 0.6-1.4 | 40 % or more | W43 fodder kills count in PvE only | niche guns |
| power | 0-0.5 | holder K/D while held 2-6 | - | - | - | power weapon kills 5-15 % of all kills where a pad exists; the top scorer held it in 40 % of matches or fewer | MIS-006: a map prize, not a match decider |

- **Static rules** (from the data, no match; P8-04 adds them as a `balance` self-test group):
  - R1 (exists): every primary inside its class TTK band.
  - R2: a whole-magazine reload (not shell by shell) of a magazine over 2 rounds takes 1.0 s or more. Reason: the reload is the price of a magazine. **Fails now: W21 Shardcaster, 10 rounds in 0.5 s** (the shotgun class default of 0.5 s is meant per shell; W21 does not reload by shell), so it fires 10 close one-shots and needs half a second for the next 10.
  - R3 (read from the F3 RS03 cases): in round buy, price follows power: within a class a dearer gun has the higher home EWR, and no gun above 4000 credits passes 62 % EWR.
- **Weapon x ruleset** (P8-03 F3): per row 35-65 % EWR in every ruleset; per ruleset the spread of the class means (best minus worst) is 20 points or less. Reason: P3-01 opened the whole roster in every ruleset, and the health, movement and precision presets move both ranges and TTK.
- **Bot skill** (P8-03 F2b): per row the EWR with every bot at the lowest and at the highest tier stays within 15 points of its mixed-tier EWR. Reason: a gun that only works for perfect aim, or only against poor aim, is a trap for one group of players.

**Pick shares (M1, bots).** Band per row: 0.4x to 2.5x the slot's fair share. Reason: bots are what the player meets; a row bots never carry is a row the player never learns to fight.

| Slot | Options | Fair share | Band | Result from the data (2026-10-30) |
|---|---|---|---|---|
| primary | the non-exotic primaries with a magazine of 4 or more whose range holds the fight distance | 1 / options per map | 0.4x-2.5x | fail: W20, W27, W40, W43, W44 are never drawn (W20 only as B11's favourite) |
| secondary | 4 sidearms | 25 % | 10-62 % | fail: W04 100 %; W05, W06, W07 0 % (no profile's favourite is a sidearm except B01's W04) |
| melee | the ruleset's field | - | exempt (the ruleset is the choice) | - |
| lethal | 3 | 33 % | 13-83 % | pass: G01 35 %, G04 30 %, G06 35 % |
| tactical | 6 | 16.7 % | 6.7-42 % | pass: G09 22 %, G03 19 % (tier 3 and up only), G02 17 %, G08 17 %, G07 14 %, G20 11 % |
| device | 8 | 12.5 % | 5-31 % | pass except G13 0 % (recorded exception: nav); G10, G15, G18, G23 17.5 %, G21, G22 10.5 %, G24 9 % |
| ability (loadout kit) | 26 | 3.8 % | 1.5-9.6 % | fail: A15 Scout Drone 0.8 %; lowest passing A07, A11, A14 1.6 %; highest A16, A27 7.9 % |
| ultimate | 4 | 25 % | 10-62 % | pass: A37 30 %, A38 30 %, A40 26 %, A39 15 % |
| favourite weapon | 23 profiles with a fixed favourite | - | a weapon is the favourite of 2 profiles at most; every class bots may draw has one | fail: W23 and W24 are the favourite of 3 profiles each; heavy (W28, W35) has none |

- **Exposure**: every combat row is met in normal play (a spawn pick, a pad on a hand-made or generated map, or its own mode) in at least one curated card's default setup. Fails now: W45, W46, PU04, PU09, PU10, PU11, PU12, PU13, PU14, PU15. Reason: a row that only exists in the editor cannot be balanced by play.

**Equipment** (gadgets; for every row CSI 0.42-0.58: no gadget decides a match)

| Slot | Use rate (M5) | KP5 (M6) | Row value | Reason |
|---|---|---|---|---|
| lethal: G01, G04, G06 | 0.6 or more uses per life | 20-50 % | enemy damage per use G01 40-100, G04 30-90, G06 50-110; own-team and self damage 10 % or less of it | a thrown kill tool must hurt, not decide alone |
| tactical: G02, G03, G07, G08, G09, G20 | 0.5 or more per life | 15-45 % | 1.0 or more enemies affected per use (G02: 3 or more enemy shots blocked per use) | utility pays through the team's next kill |
| device: G10, G13, G15, G18, G21, G22, G23, G24 | 0.7 or more placed per life where it applies (holding, objective, team) | 10-40 % | G10 triggers on 25 % or more of placements; G13 absorbs 100 HP or more; G15 deals 60-250 per deployment; G18 jams 1 or more enemy pulse or drone per deployment; G21 hits with 30 % or more of drones; G22 stops 1 or more projectile; G23 hands out 30 % or more of a max ammo; G24 gives 1 or more team respawn | each device has one job; the number says it did it |

**Items**

| Group | Target | Reason |
|---|---|---|
| health and armour pickups I01-I07 | taken on 60 % or more of their spawns in pickup rulesets; top items I04, I07 on 85 % or more | a pickup nobody takes is noise; top items must be contested (MAP-005) |
| ammo I08, I09 | taken on 40 % or more of their spawns; a carrier's "no ammo" switches at most 1 per 3 minutes | ammo is a backup, not a route |
| weapon pads I10 | each pad's gun taken within 20 s of its respawn in 50 % or more of cases | pads are map control points |
| bought protection I11, I12 | bought in 40 % or more of the rounds where it is affordable (RS03) | the buy menu offers real choices |
| loot consumables I13-I17 | 50 % or more of carried units used; each row 10-35 % of all heal and shield uses | the speed against amount trade is real |
| powerups PU01-PU06, PU09-PU15 | holder K/D while active 1.3-3.0 (PU01, PU10 up to 4.0); the holder tops the match in 35 % or fewer of the free-for-all matches it is taken in | MIS-006: leader snowball |
| mode resources PU18-PU20 | judged by their mode's pace (B6, B11) | - |

**Abilities** (for every row CSI 0.42-0.58 and carrier EWR 45-55 %: no must-pick, no dead pick)

| Category | Use rate (M5) | Row value | Reason |
|---|---|---|---|
| mobility A05-A12 | 0.3-1.0 | escape tools (A06, A08, A09, A12): alive 5 s after a cast under fire in 55 % or more; movers (A05, A07, A10, A11): 3 m of height or 8 m of distance or more per cast | mobility is paid in time; it must buy survival or position |
| recon A13-A16 | 0.3-1.0 (A16 passive: exempt) | 0.8 or more enemies revealed per cast; KP5 of revealed enemies 15-40 % | information must turn into kills |
| control A17-A24 | 0.3-1.0 | 1.0 or more enemies affected per cast (A19, A21, A22, A24: 1.5 or more, they trigger on groups); KP5 20-50 % | control sets kills up, it does not kill alone |
| sustain A25-A28 | 0.3-1.0 | 60 HP or more healed or stopped per cast; A27 0.9 or more revives per cast where downed exists | - |
| offense A29, A32, A33 | 0.4-1.0 | KP5 20-50 %; A33: 5 or more enemy shots at the double per cast | - |
| ultimates A37-A40 | ready 1-3 times per 10 minutes per player on the `ultimate` meter; cast within 20 s of ready in 70 % or more | KP5 30-70 % (A39: 1 or more ally through the rift) | the meter pace sets how often a match has its big moments |
| suit A01-A04 (RS11) | each weave on for 10-50 % of alive time | - | one energy bar, four uses: none may starve the others |
| meter rewards AX1-AX7 | earned 0.5-3 times per 10 minutes per player; used within 20 s in 70 % or more | as their ability twin | - |
| PvE A23, A34; tools A35, A36 | judged by PvE pace (B11) and the tools' function tests | - | not versus balance |

- **Ability x weapon class** (P8-03 F8): CSI 0.38-0.62 per pair; in each engagement profile the best ability's CSI is at most 0.15 above that profile's median ability. Reason: a must-pick combo (a gap closer with a shotgun, for example) removes the choice.
- **Heroes** (RS09): each hero CSI 0.40-0.60 and EWR 40-60 %; each role's mean (tank, damage, support, initiator) 45-55 %.

**Modes and rulesets (fairness)**

| ID | Target | Band | Measured by | Reason |
|---|---|---|---|---|
| B1 | side win share M8, per symmetric team mode x map | 45-55 % target, 40-60 % tolerance; the mean over all those cases 47-53 % | 8 mirrored seed pairs per case | the spawn side or map half must not pick the winner |
| B2 | score share M9, per symmetric case | 45-55 % | the same runs (more samples than wins) | catches a small side edge that 16 results cannot show |
| B3 | attacker round share in bomb and ghostops | 42-58 % | 8 matches, rounds as samples | sides switch, so the match is fair; each round must be too |
| B4 | attacker match wins in rush and payload | 35-65 % | 8 matches | stage modes swing harder |
| B5 | asymmetric roles | infection humans win 30-60 %; fiends Ravager wins 35-65 % of rounds; juggernaut and cursetag: the marked player's score share at most 2x the fair share | 8 matches | asymmetric by design, still winnable both ways |
| B6 | pace M10 | kill and zone modes end by score in 50-100 % of the time limit, or the leader reaches 80 % or more of the limit (as the hero pace check); a round lasts 40-100 % of its clock | every F10 case | no mode that always times out or ends in a minute |
| B7 | spawn deaths M11 | 5 % of deaths or less (arena maps 8 % or less) | every match case | MIS-018: spawn kills |
| B8 | free-for-all spawn points | deaths within 5 s of a spawn at one point at most 2x the map mean | free-for-all cases | no bad spawn point |
| B9 | comeback M12 | 15-40 % in team kill and zone modes | symmetric cases | too low = snowball; too high = the first half does not matter |
| B10 | ruleset pace | tdm on harbor ends in 0.6-1.6x the median time of the 12 rulesets (heroes keep their 0.3 limit scale) | F10 ruleset cases | a ruleset changes the feel, not the match length |
| B11 | PvE | horde clears 10 waves at Regular in 60 % or more of runs with the default 2 retries, at Hard in 60 % or fewer; endless reaches wave 10 at Regular in 50 % or more | F10 PvE cases | the co-op card must be winnable and the hard step must bite |
| B12 | bot fairness (ARC-033) | 0 unperceived and 0 unknown bot shots | every match case | a balance number from cheating bots is worthless |

### P8-02 - Benefits, drawbacks and uses (decided 2026-10-30 by the coordinator; the owner can change any row)

One row per catalogue row: 38 weapons, 17 gadgets, 33 items (17 pickups, 16 powerups) and 45 abilities = 133 rows. Numbers are the current data (`src/03c`, `03i`, `03j`, `03k`), not the P3-03 proposals. A profile is the row's benefits + drawbacks + uses together; no two rows share one. Rows whose data overlaps today carry an O-number (table below the list); the change is applied in P8-04, not now.

**Weapons**

| Code | Name | Benefits | Drawbacks | Uses |
|---|---|---|---|---|
| W01 | Breaker Maul | 2-hit kill in 0.4 s, no ammo, charged slam 30-120 launches the user 4.5 m | 1.6 m reach, 10 self damage per launch | finish a hurt foe, jump to ledges, the arena start melee |
| W02 | Edge Tanto | silent (noise 0), backstab 150 kills at once, full move speed | 1.2 m reach, 3 hits from the front (0.8 s) | flank kills, Silent Contract, the tactical start melee |
| W03 | Bulwark Shield-Saw | 120 deg block (pool 150), a 0.2 s parry sends projectiles back, hits stun 0.3 s | move x0.9, 3 hits to kill (1.33 s) | hold a doorway, return rockets, the Iron Bulwark start melee |
| W04 | Warden Pistol | free, 12-round semi (0.75 s TTK) or 3-round burst (0.67 s), dual on a second pickup | 4 hits to kill, falloff from 20 m (burst from 10 m) | backup after a reload, Last Stand, every bot's sidearm |
| W05 | Verdict Magnum | 55 damage: 2 hits in 0.45 s out to 25 m, penetrates, 2x zoom | 6 rounds, heavy kick, 700 credits | mid-range pick-offs from the sidearm slot, shots through thin cover |
| W06 | Hush Pistol | no tracer and noise 6, head x2.5 (a 100 headshot), sleep dart 8 s (6 darts) | 3 body hits (0.8 s) at 2.5 shots/s | unheard picks, put a guard to sleep, ambushes |
| W07 | Sparklock Pistol | locks up to 3 targets in 0.4 s inside 20 m: hits without fine aim | 9 hits to kill (1.4 s), cover breaks the lock, 20 m cap | fodder crowds, touch players, chip several foes at once |
| W09 | Wasp SMG | fastest close kill (6 hits in 0.38 s), full move speed, hollow-point toggle slows | falloff 10-25 m to 60 %, 30 rounds last 2.3 s | rush rooms, chase a fleeing foe |
| W10 | Hornet Carbine | 45 rounds, reach to 28 m, 3 contact grenades (80, r3.5) | 0.50 s TTK: slower than W09 close and W13 mid, move x0.97 | the default primary, flush cover, all-round play |
| W12 | Needlethorn | needles home at 35 deg/s; 9 stuck needles burst for 40 | 1.1 s TTK, slow needles (35 m/s), falloff from 12 m | strafing targets, touch aim, Mirelle's gun |
| W13 | Vanguard Rifle | best mid-range kill (3 hits in 0.20 s), penetrates | heaviest rifle kick (zigzag), move x0.92, 2700 credits | hold a mid lane; the rifle reference |
| W15 | Ratchet Burst | 3-round bursts with no falloff, tight spread | a missed burst costs 0.33 s, 4 hits needed | duels past the range where falloff bites, controlled fire on touch |
| W17 | Coilcaster | shooting its own orb makes a 200 r4 combo; 45 hitscan to long range | 1.4 shots/s, the orb flies 12 m/s, the combo needs timing | chokes and doors, arena skill shots |
| W19 | Scattergun | one shot kills inside 8 m; the slug alt (55) reaches 45 m | pump 1.1 shots/s, reload 0.5 s per shell | corners and doorways, the slug as a second range |
| W20 | Hookjaw | 160 point blank; the hook pulls the user to a foe within 25 m (6 s cooldown) | 2 shells = one shot per 1.1 s reload, falloff 8-18 m | close the gap and kill in one, aggressive engages |
| W21 | Shardcaster | shards bounce twice round corners; splitting shell (100 + 6 shards) | shards fly 45 m/s with drop, the alt arms at 6 m (reload: O2) | rooms and corridors, hits behind a corner |
| W23 | Lancet Rail | exact hip fire, 100 damage, pierces 4 | 0.67 shots/s, the trail shows the shooter | long lanes, lined-up foes, sniping without a scope |
| W24 | Heron Sniper | one-shot body (115), 4x / 8x scope, 4 s breath hold, high penetration | 8 deg hip spread, scoped move x0.5, 3.6 s reload, 4700 credits | overwatch on large maps, deny an objective from afar |
| W25 | Kestrel DMR | 2 body hits in 0.33 s, a headshot kills, 15 rounds | semi only, needs precision | mid-long picks, quick follow-up shots |
| W26 | Stakedriver | a 90 stake pins a foe to a wall within 1.5 m; the incendiary alt burns at any range (6) | 60 m/s with drop, 1.2 shots/s (burn on both modes: O1) | punish foes near walls, burn a retreating foe |
| W27 | Talon Bow | silent (noise 0), a full draw (110) kills a 100 HP body, works underwater, 6 explosive arrows | 0.7 s draw, one arrow per reload, drop | silent long-range kills, stealth levels |
| W28 | Hailstorm | 270 dps (405 rooted), 150 rounds, high penetration | move x0.75, 0.2 s spin-up, cannot move while rooted, 4 s reload | lock a lane, PvE waves, fire through thin walls |
| W30 | Linker | the only gun that repairs friendly devices (60/s) and links allies; plasma 132 dps | 0.67 s TTK with travel time, beam 30 m | team modes, core defence, keep turrets and barriers up |
| W31 | Ramjet Launcher | 90 + 80 splash (r3.5), rocket jumps; the alt locks 1.2 s for 4 homing missiles | 2 hits to kill, self damage, 4 rounds, move x0.88 | groups, heavies, height and mobility |
| W32 | Pitcher Launcher | a 100 r4.5 blast that bounces round cover; 4 remote mines | 2.5 s fuse, lob arc, no direct hit | chokes, objective rooms, mine traps |
| W34 | Gloop Gun | goo puddles burn 3 s where they land; a charged blob splits in 3 | 20 direct damage, short arc (28 m/s), 1.0 s TTK | deny a floor, flag rooms, punish campers |
| W35 | Kindler | a 9 m cone hits everyone in it and burns 4 s; the airblast pushes and deflects | 9 m range, move x0.85, 4 s reload | close quarters, PvE crowds, deflect rockets |
| W36 | Ember Repeater | 160 dps with splash; stored heat releases as a 120 cone blast | 60 m/s travel, the heat vents when it stops firing | mid-close pressure, burst a pushed corner |
| W37 | Stormlash | continuous beam at 160 dps; the alt arcs to 3 foes within 6 m | 24 m cap, rewards only steady tracking | close-mid tracking, chain a group |
| W38 | Starthrower | discs bounce twice for bank shots; a splash disc alt | predictable 35 m/s travel | corridors, hits round cover |
| W39 | Accelerator | charge levels 40 / 90 / 160; a 360 deg shockwave ring (60 + knockback) | 1.5 s to a full charge, 20 cells | duel opener, get-off-me ring |
| W40 | Fusion Mortar | rolling orb 300 r6, harmless to its owner, detonate on demand | 1 round, 0.5 shots/s, move x0.85, 4500 credits | clear a room or a stairwell before an objective push |
| W43 | Skull Auger | the drill homes on the head (90 deg/s), kills PvE fodder at once, detonate on demand | 3 rounds and 9 in reserve, 0.8 shots/s | PvE elites, campers behind cover |
| W44 | Razorwind | no ammo, a piercing returning blade; a lodged blade is a laser tripwire | one blade out at a time, 3 hits to kill, about 18 m | PvE, tripwires across doors |
| W45 | Daybreak Projector | 150 + 150 splash r6, with an 8 m aura (30/s) along the orb's flight | pad only (one per map), slow orb 18 m/s, move x0.85 | win a power-pad fight, deny a route for the orb's flight |
| W46 | Halcyon Warhead | a camera-guided warhead, 300 r12 | the user stands still while guiding, 1 round, 120 s pad respawn | break a defended objective from afar |
| W41 | Graviton Lifter | holds and punts props as ammo or a shield | needs props, no damage of its own, takes the hands | physics puzzles, prop fights |
| W42 | Twin-Gate Projector | two linked gates up to 60 m apart | no damage | Test Chambers routes |

**Gadgets**

| Code | Name | Benefits | Drawbacks | Uses |
|---|---|---|---|---|
| G01 | Frag Charge | 100 r5, cook up to 2.5 s, 2 carried | the fuse warns (bots run), bounces off the target | flush cover, punish a cluster |
| G02 | Veil Canister | smoke sphere r5 for 18 s | blocks your own side's sight too; shots punch 2 s holes | cover a plant, a revive or a crossing |
| G03 | Glare Shell | blinds up to 20 m for 3.5 s, 2 carried | looking away keeps part of the sight, 1.5 s fuse | blind a holder before a push or a peek |
| G04 | Cinder Jar | fire area r3 for 7 s up to 40 HP/s, plus burn | starts at a quarter of its damage: little burst | deny a doorway, flush a camper |
| G06 | Leech Charge | sticks to a body, 110 r3.5 | must hit the actor, 1.5 s fuse, small radius | a sure kill on a tank or a carrier |
| G07 | Kick Charge | 18 m/s knockback r4, launches its owner unharmed | 10 damage only | shove foes off a point or an edge, launch yourself |
| G08 | Rime Bomb | freezes everyone within 4 m for 3 s | no damage of its own | stop a push, set up a sure kill |
| G09 | Sink Charge | pulls a group together (14 m/s2, r6) and deals 60 | short of a kill alone, 1 s fuse | gather foes for a frag or a rocket |
| G10 | Tripjaw Mine | a 150 directional (60 deg) proximity blast | crouch-safe, 1.5 s arm, seen within 8 m | guard a flank or a flag room |
| G13 | Barrier Deploy | instant 300 HP cover (2 x 1.2 m) for 30 s | 60 s cooldown, blocks your own team's paths (bots never pick it) | cover in the open, cover for a plant |
| G15 | Picket Turret | an auto turret, 12 x 5/s out to 25 m, for 40 s | 150 HP, 120 s cooldown, does not move | guard a point while you push |
| G18 | Static Jammer | scrambles radar within 20 m for 30 s | no damage, 50 HP | hide an objective from pulses and drones |
| G20 | Null Pulse | shuts devices, abilities and regen within 6 m for 4 s | no damage | break a dome, a turret or an ultimate push |
| G21 | Scuttler | 2 seeking drones, 80 r2.5 each, out to 30 m | 20 HP each, 6 m/s, 90 s cooldown | dig a foe out of cover |
| G22 | Snatcher | stops 3 incoming projectiles within 6 m (30 s) | nothing against hitscan, 40 HP | hold a point against rockets and grenades |
| G23 | Supply Crate | team ammo: 20 % of max per second within 3 m, 20 s | no health, no damage | long holds, heavy and explosive guns |
| G24 | Rally Beacon | a team spawn point for 60 s (one per team) | 100 HP, 120 s cooldown, team modes only | forward respawns for an attack |

**Items**

| Code | Name | Benefits | Drawbacks | Uses |
|---|---|---|---|---|
| I01 | Health Vial | +5 health up to 200 | a tiny amount each | route rewards that push health past 100 |
| I02 | Health Pack | +25 health up to 100 | no overheal; same respawn as I03 (O3) | a quick top-up between fights |
| I03 | Health Crate | +50 health up to 100 | no overheal; costs no more than I02 (O3) | recover after a lost trade |
| I04 | Mega Cell | +100 health up to 200 | the map's prize: contested and timed by rivals | win item control: the top health item |
| I05 | Armor Shard | +5 armour up to 200 | a tiny amount each | route rewards that build armour |
| I06 | Light Plate | +50 armour | the small armour step; same respawn as I07 (O3) | refill armour between fights |
| I07 | Heavy Plate | +100 armour, a top item | contested, its spot is known | item control: the top armour item |
| I08 | Ammo Box | refills the held weapon's ammo type | only the held type | keep one favourite gun firing |
| I09 | Ammo Cache | +50 % of max ammo for every weapon | 40 s respawn | restock the whole arsenal |
| I10 | Weapon Pad | the map's weapon; respawn 5 s free-for-all, 30 s team, 120 s power | a fixed, known spot | weapon control points |
| I11 | Helmet | head protection against the tactical x4 head multiplier | costs credits each round | round buy against headshots |
| I12 | Vest | 100 body armour | costs credits, no head cover | round buy against body shots |
| I13 | Patch | 15 health up to 75 in 3 s, 10 carried | stops at 75 | patch up between fights in Last Ring |
| I14 | Med Kit | full health in 8 s, 3 carried | 8 s of using it | a full heal in a safe spot |
| I15 | Cell | 25 shield in 2.5 s, 6 carried | a small amount | a shield top-up in a lull |
| I16 | Battery | full shield in 5 s, 3 carried | 5 s of using it | a full shield before a push |
| I17 | Fizz Can | 75 health, the overflow goes into the shield, in 2 s | only 2 carried | the fast heal inside a fight |
| PU01 | Fury Core | damage x3 for 30 s | announced, drops on death, everyone hunts it | turn a match, break a hold |
| PU02 | Warding Shell | damage taken x0.5 and immune to splash, falls and hazards for 30 s | adds no offence | survive explosives, take a held point |
| PU03 | Quickening | speed and fire rate x1.3 for 30 s | no protection | chase, rotate, out-trade at the same TTK |
| PU04 | Ghostveil | invisible for 30 s (bots see it at 25 % of their range) | drops with its time left on death; shots and steps are still heard (O4) | flank, steal a flag |
| PU05 | Renewal | regen 15/s to 110, then 5/s to 200, for 30 s | slow against burst damage | outlast a long fight |
| PU06 | Skyward | flight at 8 m/s, no fall damage, 30 s | exposed in the air | reach vantage points, cross gaps |
| PU09 | Berserk Fist | melee x4 and heal to 100 for 20 s; melee kills fodder | only melee gains | a melee rampage, PvE fodder |
| PU10 | Invulnerability Sigil | invulnerable for 10 s | short, 180 s respawn, announced | win a decisive fight, a plant or a capture |
| PU11 | Bottomless | free ammo for 30 s | no damage boost | heavy and explosive spam |
| PU12 | Vampire Fang | heals 30 % of the damage dealt, for 30 s | needs hits to heal | long fights, sustained guns |
| PU13 | Seer Orb | reveals the holder's enemies for 15 s | 90 s respawn, no combat stat | team information, hunt hiders |
| PU14 | Spring Boots | 3 double-height jumps, no fall damage | 3 jumps, never dropped for others | shortcuts and high ground |
| PU15 | Guardian Rune | health and armour pools x2 until death | move x0.9, one rune at a time | tank, hold a point |
| PU18 | Soul Shard | +1 heal and a soul | PvE only | fuel A34 Wrath Form |
| PU19 | Bearer Flame | damage x3 until death; the Flame Bearer prize | the bearer is everyone's target, one in the match | score in Flame Bearer |
| PU20 | Vital Shard | +25 max health (to 200), then max armour (to 150) | Ravager health matches and the campaign only | Ravager progression |

**Abilities**

| Code | Name | Benefits | Drawbacks | Uses |
|---|---|---|---|---|
| A01 | Bulwark Weave | suit armour mode, energy regen x2 | holds the suit's one weave slot | soak a fight in Weave Suit |
| A02 | Overdrive Weave | sprint x1.5 | sprint only, drains 20 energy/s | escape, rotate fast |
| A03 | Colossus Weave | jump x1.8, melee x2, prop throws | 15 energy per use | brawl, reach high ground |
| A04 | Phantasm Weave | cloak (8 energy/s moving, 2 standing still) | firing or a stun ends it | ambush, flag steal |
| A05 | Shadow Step | blink 10 m to the aimed point, ledge grab | 20 energy, needs line of sight, weapons lowered 0.3 s, not with an objective | vertical repositioning |
| A06 | Phase Slip | invulnerable for 2 s | cannot fire meanwhile, 12 s cooldown | dodge a burst or an ultimate |
| A07 | Grapnel | pulls the user at 18 m/s to a surface up to 30 m away | a straight, readable line, 10 s cooldown | reach heights, cross gaps |
| A08 | Surge Dash | 3 dashes of 7 m in the input direction | 3 s per charge | dodge in duels |
| A09 | Rewind Anchor | returns the user to where it stood 3 s ago | 15 s cooldown, must be timed | undo a bad peek |
| A10 | Updraft | a 10 m lift zone for allies, 5 s | 20 s cooldown, a visible column | team high ground, escape |
| A11 | Glidepack | glide at gravity x0.1 on 3 s of fuel | slow and exposed | long glides to vantage points |
| A12 | Relocator | teleport to its beacon within 25 m, telefrag, 6 charges | drops a carried objective | escape routes, flank traps |
| A13 | Echo Pulse | 3 reveal pulses within 15 m, 20 s cooldown | 15 m only | clear a room before entry; the class field upgrade |
| A14 | Hunter Sight | sees enemies through cover within 30 m (toggle) | 5 energy/s | track through walls |
| A15 | Scout Drone | a remote drone for 20 s that reveals and pulses an EMP r5 | the user stands defenceless, damage ends it, 40 s cooldown | scout a site before a push |
| A16 | Tracker Sense | passive: enemy trails for 8 s within 30 m | nothing to press | hunt and chase |
| A17 | Veil Curtain | a 12 m wide smoke wall for 15 s, 2 charges | blocks your own sight too | cut a long sightline |
| A18 | Static Fence | up to 4 posts linked 12 m: 20 damage and 40 % slow for 1.5 s, 60 s life | low damage | zone a route or a flank |
| A19 | Time Bend | time x0.25 within 8 m for 6 s | 60 energy, small radius | catch a group at a door |
| A20 | Gale Push | a 30 deg push at 20 m/s that deflects projectiles | 8 m reach, 8 s cooldown | push foes off edges, swat rockets |
| A21 | Binding Link | links the target with the enemies within 8 m of it for 8 s | needs a target and a group, 20 s cooldown | burst a group through one target |
| A22 | Mesmer Lure | lures up to 2 enemies within 15 m for 6 s | 25 s cooldown | pull foes out of cover |
| A23 | Puppet Jump | possesses a fodder or beast enemy for 10 s | PvE only, damage ends it | turn a PvE enemy against its wave |
| A24 | Frenzy Hex | the target fights its own side for 8 s | needs a target, 30 s cooldown | break a group from inside |
| A25 | Mender Drone | a heal zone r6 at 20/s for 8 s, allies included | a static zone, 30 s cooldown | team heal after a fight |
| A26 | Aegis Dome | a dome r5 for 12 s that stops every shot both ways | you cannot shoot out either, 30 s cooldown | revive, plant or regroup |
| A27 | Second Wind | revives a downed ally within 10 m | 60 s cooldown; no use where nobody goes down (O5) | squad revives |
| A28 | Amp Wall | a 4 x 2 m wall stops shots from the front; own shots through it x1.25, 15 s | fixed facing, 20 s cooldown | win a lane duel from cover |
| A29 | Arc Bolt | 30 damage and a 1 s shock at 30 m | 25 energy, low damage | finish a foe, interrupt a channel |
| A32 | Swarm Cloud | 8 damage/s for 6 s on one target | slow damage, needs a target | flush a hider, chip a foe |
| A33 | Holo Double | a decoy for 8 s that plays the owner's weapon sound | readable once a player knows it | draw fire, fake a flank |
| A34 | Wrath Form | invulnerable for 8 s, kills on touch, homing (66 souls) | PvE only | wipe a wave |
| A35 | Graviton Grip | the lifter's pull and punt without a weapon slot | 10 energy/s while held | prop fights with your gun kept |
| A36 | Gate Pair | two gates from the ability button, 2 charges | solo puzzle modes only | puzzles without the tool in hand |
| A37 | Overcore | damage x2 and fire rate x1.2 for 10 s | 1500 meter points for 10 s | win a fight, break a hold |
| A38 | Orbital Lance | a 250 r8 strike after a 2 s warning, out to 60 m | the warning lets foes leave, 1800 points | wipe a held point |
| A39 | Rift Gate | a two-way rift for 15 s within 60 m | no damage, 1500 points | team flank, escape |
| A40 | Rally Cry | team +50 surplus health and speed x1.2 for 8 s | 8 s, 1200 points | start a team push |
| AX1 | Seer Pulse | 3 map-wide reveal pulses | earned at a 300 streak (or H08's ultimate) | map-wide information before a push |
| AX2 | Picket Swarm | 12 damage/s on up to 3 enemies map-wide for 6 s | an 800 streak or 80 boost | soften several foes at once |
| AX3 | Speed Rush | speed x1.4 for 20 s | the FFFF combo costs 100 adrenaline | rotate across the map |
| AX4 | Booster | regen 5/s for 20 s | weak against burst, 100 adrenaline | sustain between fights |
| AX5 | Veil | invisible for 20 s | 100 adrenaline (O4) | escape or flank |
| AX6 | Berserk | fire rate x1.5 for 20 s | 100 adrenaline (name: O7) | out-trade in a duel |
| AX7 | Amped Rounds | damage x1.25 for 30 s | a 50 boost reward, a small bonus | carry a team push |

**Rows that overlap today, and the distinguishing change** (applied in P8-04; each has an A / B case in P8-03 F0)

| ID | Rows | Overlap in the current data | Proposed change | P8-03 case |
|---|---|---|---|---|
| O1 | W26 primary / W26 alt | the primary already burns 3 s inside 25 m (`statusRange: 25`), so the incendiary alt adds only range and 1 s of burn | the primary pins without burning; the alt is the only burn (4 s, any range) | F0-09 / F0-10 |
| O2 | W21 / the shotgun class | the 10-round magazine reloads in 0.5 s (R2): the reload drawback is missing | reload 2.0 s for the whole magazine (the R7 phases are fractions of the live reload time, so the animation follows) | F0-07 / F0-08 |
| O3 | I02 / I03, I06 / I07 | same effect, cap and respawn; only the amount differs, so the bigger row costs nothing more | the small steps come back sooner: I02 35 -> 25 s, I06 25 -> 20 s (I03 and I07 keep 35 / 25 s) | F0-14 / F0-15 |
| O4 | PU04 Ghostveil / AX5 Veil | both are full invisibility (30 s / 20 s) | AX5 ends when its user fires (an escape combo); PU04 stays the attacking invisibility | F0-16 / F0-17 |
| O5 | A27 Second Wind | no use where no teammate can go down: RS06, RS07, RS08 (the loadout kit) and every free-for-all, yet bots pick it 7.9 % of the time | in those matches the loadout shows it restricted with the reason "Needs downed teammates" (the P3-01 rule) and bots weigh it 0 | F0-18 / F0-19 |
| O6 | W40 / W45 | P3-03 gave both the use "room wipe" | resolved by this table (W45: a pad fight with an aura along the flight; W40: a one-round room clear); no data change | - |
| O7 | AX6 Berserk / PU09 Berserk Fist | the name only (fire rate against melee) | AX6 shows "Rapid Fire" (the id `berserkcombo` stays) | - |

- **Close pairs checked and kept** (they differ in trigger, slot or source): W07 / W12 (lock in the sidearm slot against homing in the primary), W30 / W36 (support beam against heat blast), G02 / A17 (sphere against wall), G07 / A20 (thrown launch against cone push with deflect), G22 / A26 (3 projectiles with own shots passing, against every shot both ways), PU01 / PU19 (timed pickup against the mode's hunted prize), PU03 / AX3 / AX6 (both modifiers against one each), A13 / AX1 and A32 / AX2 (local against map-wide), A06 / PU10 (2 s without firing against 10 s with firing), A35 / W41 and A36 / W42 (a button with the gun kept against the tool in hand).
- **Not a profile overlap, recorded for the tooling**: two ids are shared across catalogues, `bulwark` (W03 and A01) and `ammobox` (G23 and I08), measured with `--eval`; damage and kill events carry only the id, so the P8-03 runner keys its statistics by catalogue and code.
- **Bot pick gaps** (P8-01 pick table, for the P8-04 bot retune): primaries W20, W27, W40, W43, W44 and sidearms W05, W06, W07 are never spawn picks; A15 is picked 0.8 %; W23 and W24 are 3 profiles' favourites each; no profile favours a heavy gun.

### P8-03 - Smart test plan (decided 2026-10-30 by the coordinator; the owner can change any row)

- **Principles.** (1) Headless bot matches through `playMatch` (`src/20b-test-bots.js:45`) with fixed seeds 1-4; team cases use mirrored pairs (the same bot list, sides swapped). (2) One factor at a time against a fixed baseline: RS01 Arena Classic, Regular difficulty, seeded mixed profiles, the pickup loadout, 12 bots (team cases 10), 3 simulated minutes, no time or score limit (fairness cases: the mode's own limits); the factor is forced on 3 bots (team cases: 3 bots on side A, mirrored), the rest arm as drawn. (3) Pairwise only where the decisions say rows interact: weapon x ruleset and ability x weapon class; a class or an engagement profile stands in for its rows where the row level would only repeat the answer. (4) Extremes first: each family starts with its most extreme settings (extreme rulesets, bot tiers and engagement profiles, and the rows furthest outside a static band); later waves run only where the extremes miss.
- **Not every combination**: 34 weapons x 12 rulesets x 30 abilities x 8 versus maps x 4 seeds would be 391,680 runs; this plan has 3,050.
- **Rosters named in case IDs.** WP, the 34 combat weapons a loadout or pad gives (36 minus the pad-only W45 / W46): W01 W02 W03 W04 W05 W06 W07 W09 W10 W12 W13 W15 W17 W19 W20 W21 W23 W24 W25 W26 W27 W28 W30 W31 W32 W34 W35 W36 W37 W38 W39 W40 W43 W44. CL, the 11 combat classes: melee, sidearm, smg, shotgun, rifle, marksman, sniper, energy, heavy, explosive, exotic. AB, the 30 loadout abilities: A05-A22, A24-A29, A32, A33 (26) and the ultimates A37-A40. EP, 5 engagement profiles: EP1 close burst (melee, shotgun), EP2 close sustained (smg, heavy), EP3 mid precision (rifle, sidearm, energy), EP4 long precision (marksman, sniper), EP5 area (explosive, exotic).
- **Maps.** Close = MP01 spire (50 m), mid = MP02 skyyard (70 m), long = MP06 gantry (100 x 80 m), all `ffa`; team cases MP05 harbor (`tdm`) and MP03 twinkeeps (`dom`). A weapon's home map follows its `botPref.range` maximum (20 m or less spire, 21-50 m skyyard, over 50 m gantry): spire W01 W02 W03 W07 W09 W10 W19 W20 W21 W34 W35 W43 W44; skyyard W04 W05 W06 W12 W15 W28 W30 W31 W32 W36 W37 W38 W39 W40; gantry W13 W17 W23 W24 W25 W26 W27.

**Case list** (every case is one ID from its pattern; runs = cases x seeds, mirrored pairs counted as two runs)

| Family | Case IDs | Factor | Fixed | Runs per case | Cases | Runs | Est. s |
|---|---|---|---|---|---|---|---|
| F0 follow-ups | F0-01 to F0-19 (listed below) | known open items | per case | 1 or 4 | 19 | 54 | 245 |
| F1 static | F1-S1 to F1-S7 (below) | the data | no match | 0 | 7 | 0 | 5 |
| F2 weapon OFAT | F2-<WP>-<spire, skyyard, gantry> | weapon on 3 of 12 bots | RS01, ffa, 3 min | 4 seeds | 102 | 408 | 1,714 |
| F2b bot skill | F2b-<WP>-T1, F2b-<WP>-T6 | all 12 bots at tier 1, then tier 6 | home map, RS01 | 4 | 68 | 272 | 1,142 |
| F3a weapon x extreme ruleset | F3a-<WP>-<RS03, RS07, RS02, RS04> | ruleset (run in this order: one life and head x4; fast with the armour triangle; fastest with the extra jump; slowest with regen) | home map, ffa | 4 | 136 | 544 | 2,285 |
| F3b class x other ruleset | F3b-<CL>-<RS05, RS06, RS08, RS10, RS11, RS12> | ruleset; the 3 bots draw a seeded gun of the class | skyyard, ffa (RS01 is F2; RS09 heroes are F9) | 4 | 66 | 264 | 1,109 |
| F3c class x X41 Ballistics | F3c-<CL>-X41 | mutator X41 (hitscan flies as a bullet) | RS01, skyyard | 4 | 11 | 44 | 185 |
| F4 power weapons | F4-W45-skyyard, F4-W46-gantry | a pad the harness places on the top item spot | RS01, ffa | 4 | 2 | 8 | 34 |
| F5 gadgets | F5-<G01 ... G24>-tdm, -dom | the gadget in its slot on 3 bots of side A (17 rows) | RS01; tdm harbor, dom twinkeeps; mirrored | 4 | 34 | 136 | 449 |
| F6 powerups | F6-<PU01-PU06, PU09-PU15> (13); F6-PU18 horde cistern; F6-PU19 bearer spire; F6-PU20 RS07 ffa skyyard | granted to 3 bots at every spawn (PU18-PU20 in their own mode) | RS01, ffa skyyard | 4 | 16 | 64 | 269 |
| F7 abilities OFAT | F7-<AB> (30) in RS06 tdm harbor; F7-<A01-A04> RS11; F7-FR-<A05, A06, A08, A11, A14, A19, A20, A29, A35> RS12; F7-A23, F7-A34 horde cistern; F7-M-<RS02, RS04, RS05> (the meters' AX1-AX7 and A38 rewards) | the ability on 3 bots of side A (meter cases: as earned) | tdm harbor 10 bots, mirrored | 4 | 48 | 192 | 634 |
| F8 ability x engagement profile | F8-<AB>-<EP1 ... EP5> | the ability with a seeded gun of the profile on 3 bots of side A | RS06 tdm harbor, mirrored | 4 | 150 | 600 | 1,980 |
| F9 heroes | F9-<H01 ... H08> | the hero on 2 bots of side A | RS09 tdm harbor, mirrored | 4 | 8 | 32 | 106 |
| F10 fairness | 48 cases (below) | mode x map, ruleset | the mode's default size, ruleset and limits | 4, 8 or 16 | 48 | 432 | 5,255 |
| **Total** | | | | | **715** | **3,050** | **15,412** |

- **F0 follow-ups** (the known open items folded in):
  - F0-01 to F0-03: the Harbor soak at seeds 2, 3 and 4 (tdm, 16 bots, 3 minutes, open match: the `botsoak` setting). Measured 2026-10-30 on this build: 0 unperceived and 0 unknown shots in each (3,438, 4,540 and 3,134 shots), so the P3-04 note no longer reproduces; the cases stay as regressions. (The counter, `BotCombat.recordFairness` `src/14d-bots-combat.js:772-778`, counts a bot shot fired after the sight licence for its target ran out; melee swings are not counted.)
  - F0-04 to F0-06: the same three seeds with every bot on W01 + W04 only, the two guns the note named.
  - F0-07 / F0-08: W21 reload 0.5 s (now) / 2.0 s (O2), F2 setting on spire.
  - F0-09 / F0-10: W26 primary burn on (now) / off (O1), on gantry.
  - F0-11 / F0-12: W31 magazine 4 (now; a lock volley takes 2) / 6, the "P8: magazine size" note at `src/03c-data-weapons.js:208`, on skyyard.
  - F0-13 (static probe): W32 and W34 primaries, the W21 alt and W27 fired at the crosshair point 10, 20 and 30 m away on the test floor: the miss distance (P2-03 left an exact lob as "a ballistic solve, left for P8 if wanted"); the owner decides with the numbers (proposal: solve it if the miss passes 1 m at 20 m).
  - F0-14 / F0-15: I02 / I06 respawn as now / 25 s and 20 s (O3), ffa spire.
  - F0-16 / F0-17: AX5 as now / ending on fire (O4), RS02 ffa skyyard.
  - F0-18 / F0-19: A27 in RS06 tdm harbor (no downed: expected 0 casts, the O5 finding) / in RS04 with X46 Powers for All (downed on).
  - The W06 Hush and W26 Stakedriver numbers that P3-03 left "for P8" are judged by their F2, F2b and F3a cases; no extra case.
- **F1 static** (one page load, under 5 s): S1 the TTK bands (exists in `content`); S2 rule R2 (reload); S3 the M1 pick shares per slot from the botUse weights; S4 the favourite rule; S5 exposure; S6 statistics keys unique by catalogue and code; S7 the bot primary pool per map and style (which guns each map can draw).
- **F10 fairness cases**: symmetric, 16 runs each (8 mirrored pairs): F10-tdm-skyyard, F10-tdm-twinkeeps, F10-tdm-harbor, F10-ctf-twinkeeps, F10-oneflag-twinkeeps, F10-dom-twinkeeps, F10-dom-gantry, F10-hardpoint-harbor, F10-hardpoint-gantry, F10-conquest-convoyline, F10-control-harbor, F10-elim-dustline, F10-attrition-harbor (13). Asymmetric, 8 runs: F10-bomb-dustline, F10-ghostops-dustline, F10-rush-convoyline, F10-payload-convoyline, F10-infection-spire, F10-infection-gantry, F10-fiends-cistern, F10-juggernaut-skyyard, F10-cursetag-spire (9). Free-for-all pace and spawn points, 4 runs: F10-ffa-spire, F10-ffa-skyyard, F10-ffa-gantry, F10-duel-spire, F10-lms-gantry, F10-gungame-gantry, F10-roulette-spire, F10-oddball-gantry, F10-bearer-spire (9). PvE, 4 runs: F10-horde-cistern-Regular, F10-horde-cistern-Hard, F10-endless-cistern-Regular, F10-bank-cistern (4). Royale, 4 runs: F10-royale-isle (18 bots, squads of 3) (1). Rulesets, 8 runs (4 mirrored pairs): F10-RS01 to F10-RS12 on tdm harbor, 10 bots (12). Silent Contract (solo stealth) and the solo tool modes stay with their function tests.
- **Waves (extremes first) and stop rules.**
  - Wave 0 (about 2 minutes): F1, F0-13 and F0-01 to F0-06. A failing S6 or any unperceived shot stops the plan: tooling or bots are fixed first.
  - Wave 1: F2 on each weapon's home map (34 cases), F3a RS03 and RS07, F2b, F8 EP1 and EP4 (60 cases), the 13 symmetric F10 cases and the F0 A / B pairs.
  - Wave 2: the rest of F2, F3a RS02 and RS04, F3b, F3c, F4 to F7, F9 and the rest of F10.
  - Wave 3: F8 EP2, EP3 and EP5 (90 cases) only for abilities whose wave 1 CSI lies outside 0.44-0.56 (half the tolerance) or whose F7 case failed; expected about a third, which saves about 250 runs.
  - P8-04 re-runs only the cases whose factors include a changed row, ruleset or mode, plus a seeded 10 % sample of the passing cases as a regression guard.
- **Measured sample** (2026-10-30, this PC, i5-9600K; the test build of HEAD 81a00f5; `node tools/selftest.mjs --no-selftest --eval "__CTK.soak(...)"`):

| Run | Wall time | Result |
|---|---|---|
| ffa spire, 8 bots, 1 min, seed 1 | 1.74 s | 26 kills, 818 shots |
| tdm harbor, 16 bots, 3 min, seed 2 (the first match in the page) | 15.8 s | 92 kills, 3,438 shots, 0 unperceived |
| tdm harbor, 16 bots, 3 min, seed 3 | 7.0 s | 99 kills, 4,540 shots, 0 unperceived |
| tdm harbor, 16 bots, 3 min, seed 4 | 5.9 s | 89 kills, 3,134 shots, 0 unperceived |
| tdm skyyard, 8 bots, 3 min, seed 1 | 2.2 s | 64 kills, 2,167 shots |
| ffa harbor, 8 bots, 3 min, seed 1 | 2.8 s | 118 kills, 3,659 shots |
| Chrome start and page load per `selftest.mjs` call | about 8.5 s | a call with 17.6 s of matches took 26 s |

- **Estimate.** Cost per simulated minute: 8 bots about 0.85 s, 10 bots 1.1 s, 12 bots 1.4 s, 16 bots 2.2 s (10 and 12 interpolated); the first match in a page adds about 9 s. F10 runs use the full limits (on average about 12 simulated minutes for symmetric cases, 11 asymmetric, 10 for the rest). Total 15,412 s of matches (4.3 hours) on one worker, about 4.6 hours with page starts and warm-ups; with 4 workers (6 cores, at most 4 heavy jobs) and a 1.3 load factor about **1.5 hours wall**, about 1.3 hours with the wave 3 stop rule. P8-04 re-runs: expect 20-30 % of that.
- **Tooling that exists**: `__CTK.soak(mode, map, minutes, botCount, seed, modeOptions)` (match totals: kills, shots, winner, captures, hold points, stuck time, unperceived and unknown shots); `playMatch` with ruleset, difficulty, bots, balance, player, `onTick` and `probe` (`src/20b-test-bots.js:39-80`); kit matches `__CTK.bots.kits.play` (ability and gadget use counts); the slow `botsoak` group; `selftest.mjs --eval` (one script per Chrome start, 480 s default timeout).
- **Tooling missing for P8-04** (test build only: a new `src/20b-test-balance.js` with group `balance`, and `tools/balance.mjs`; the shipped `ClassTimeKiller.html` does not change):
  - T1 **Forced loadouts and grants.** Setup bot entries gain `loadout: { melee, secondary, primary, lethal, tactical, device, ability1, ability2, ultimate, hero }`, read at one override point by `Loadouts.startKeys`, `Loadouts.gear` and `Loadouts.botAbility`, and by the class, round-buy (the forced gun is bought first, or given when unaffordable), loot (spawn with it) and hero paths. `grant: [keys]` gives powerups at every spawn (F6). `pads: [{ item, at: 'topItem' }]` adds a pad (F4). Today a profile's `favorite` forces only a primary in pickup economies, and nothing forces gadgets, abilities or heroes.
  - T2 **Rosters and mirrors.** The bot list (profile, tier, team) is drawn once per seed; `mirror: true` swaps every team; `tier: n` sets every bot's tier (F2b).
  - T3 **Metrics collector.** Bus listeners on `fire`, `damage`, `kill` (reads the victim's drawn weapon inside the listener), `gadget.use`, `ability.cast` / `ability.end`, `pickup`, `score` and `match.end`; per tick, the drawn weapon and alive time per actor in typed arrays (no allocation); spawn times; "touched by" marks per actor (row, side, time) from damage, statuses (a test-build wrapper of `Damage.addStatus`: reveal, freeze, blind, sleep), pulls and pushes, for KP5. Keys are `<catalogue>:<code>` because ids collide (`bulwark`, `ammobox`). One record per run: case id, seed, mirror, setup, overrides, the raw counts for M1-M12, the fairness counters and the wall time.
  - T4 **A / B overrides.** `overrides: { 'weapons.shardcaster.reload': 2 }` sets a catalogue row (and its linked fire modes) before `Game.start` and restores it after; recorded in the run record. P8-04 tunes without rebuilding, then writes the winning values into `src/`.
  - T5 **Batch runner** `tools/balance.mjs`: `--plan <families or case glob> --wave 0-3 --workers 1-4 --out <temp dir> --resume --run-timeout 120`. It builds the case list from one plan table (`tools/balance-plan.mjs`, the families above), keeps one Chrome page per worker for up to 200 runs (then restarts it), orders a worker's runs by map (one warm-up per map), writes one JSON line per run to `<temp>/ctk-balance/<date>/runs.jsonl`, skips done (case, seed, mirror) keys on `--resume`, prints a progress line every 25 runs, and exits 0 / 1 / 2 / 3 like `selftest.mjs`.
  - T6 **Summary** `tools/balance.mjs --summary <runs.jsonl>`: aggregates per case and per row, works out the Wilson and bootstrap intervals, compares them with `BALANCE_TARGETS` (one data table in `src/20b-test-balance.js` that mirrors P8-01; the page returns it), prints only the fail, watch and no-data lines with a count per family, and writes `summary.json` for the P8-04 results in Appendix C.
  - T7 **Static checks** S1-S7 as fast blocks of the `balance` group, so the default self-test catches a data change that breaks R2, the pick bands, the favourite rule or exposure.

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
| A-08 | Low | Gamepad defaults lack previous weapon and buy menu | `src/05a-input.js` ACTION_ROWS l.70-84 | Only Y cycles forward; buy menu only from pause. Every action can be bound to a View chord. | P5-03 | fixed (Phase 5: previous weapon View + D-Left, buy menu View + D-Up in `src/05a-input.js`; controls tests) |
| A-09 | Informational | Target ability pressed with no target gives no feedback | `src/12e-abilities.js` `tryActivate()` l.268-281 | bolt, link, swarm, frenzy: nothing happens, resource kept. | P7-02 | fixed (P7-02: rows with `needsTarget` click like a dry gun and toast "No target" once per press, nothing spent; `feedback` tests) |

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
