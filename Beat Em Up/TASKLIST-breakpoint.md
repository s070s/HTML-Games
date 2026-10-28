# BREAKPOINT - Complete Tasklist

Single tasklist for every item in the former `Ideas-breakpoint.txt` (deleted; its full text is kept in Appendix A).
Work top to bottom. Tick a box only when its "Done when" check passes.

## 0. How to use this file

- Phases are in dependency order. A later phase may rely on anything an earlier phase finished.
- Each task: `- [ ] ID - task` followed by `Done when:` (the acceptance check).
- `DECIDE` tasks produce a written decision. Record it in Appendix C (Decision log) before starting dependent tasks.
- `RESEARCH` tasks produce written notes. Record the result in Appendix B (Research log), with the source for each fact.
- Facts and proposals are kept apart: "Fact" = verified in `breakpoint.html` 1.0.0 or the owner's answers. "Proposal" = a design option still to be confirmed by a DECIDE task.
- Every new file is UTF-8 with BOM. Use plain ASCII characters in code, data and text where possible.

## 1. Owner decisions (fact, from the planning questions)

| Topic | Decision |
|---|---|
| Core direction | Hybrid: keep the 1v1 fighter modes (Versus, Tournament, Training, Free Fight) and add multi-opponent brawler levels for Arcade / story. Lock-on serves both. |
| Detail level | Phased tasks with "Done when" checks. |
| Online multiplayer | WebRTC peer-to-peer, signaling by copy-paste (optionally QR). No server, no external library. |
| Reference ideas | Sourced by a RESEARCH task during implementation (Phase 1), not chosen in this file. |
| Content counts | Decided in Phase 1 (styles, fighters, levels, countries, origins, goals, weapons, items). |
| Code structure | Keep editing `breakpoint.html` directly. No build step. |
| Player counts | Up to 4 online and up to 4 local. Tournament entrant count decided in Phase 1 (humans + AI fill). |
| Tasklist file | `Beat Em Up/TASKLIST-breakpoint.md` (this file). |

## 2. Current state (fact, read from `breakpoint.html`, VERSION '1.0.0', 9711 lines, 585241 bytes)

- One self-contained HTML file. WebGL renderer with instanced cube / sphere / cylinder / shard meshes. No texture sampling in the shaders (0 uses of `sampler2D`).
- Content-Security-Policy contains `connect-src 'none'` and `img-src data:`.
- Fixed 60 Hz simulation (`FIXED_DT = 1/60`), seeded RNG (`makeRng`).
- Modes: Arcade (5 opponents), Survival, Training, Free Fight, Versus (2 players, one screen).
- Roster: 6 fighters (4 unlocked by default). 7 move styles: boxer, kickboxer, karateka, wrestler, judoka, brawler, capoeira. 7 creator archetypes.
- Arenas: 3 (Industrial Warehouse, Traditional Dojo, Underground Pit). Destructible materials: wood, concrete, metal, glass, paper.
- Actions: up, down, left, right, punch, kick, strong (modifier), height (modifier), blockHigh, blockLow, jump, crouch, grapple, dash, pause. `dash` also does "quick recovery" (L3 on gamepad).
- Defense: high / low block with a perfect-block window (6 ticks). Sidestep state exists.
- Fighter states include DASH, SIDESTEP, CLINCH, GRAPPLE, THROWN, DOWN, GETUP, STUN.
- Creator: tabs Body, Head, Outfit, Style, Identity, Slots. 8 attributes (health, stamina, strength, speed, reach, defense, balance, recovery), 44-point budget, height scale 0.92-1.12, build 0.80-1.30, 8 custom slots, share code.
- Faces: procedural (eyes, brows, beard options). No photo, no expressions, no gender, no age.
- Not present: weapons, pickups, hazards, falling from heights, lock-on, multiple opponents at once, submissions, emotes / taunts, story, tournament, networking.
- Quality presets low / medium / high with auto quality from a pixel budget. Built-in self-test (`UI.runSelfTest`).
- Theme check needed: the creator option "Accent glow" may conflict with "Modern Urban, no sci-fi / fantasy" (see P1-07).

## 3. Global rules for every phase

- Theme: Modern Urban. No sci-fi, fantasy, magic or supernatural elements in content, visuals or story.
- Mobile first. Every feature must be playable on touch, gamepad and keyboard. No extra on-screen buttons unless a DECIDE task approves them.
- No external dependencies. Output stays one HTML file.
- Keep file size as small as possible: prefer data tables and shared generators over hand-written duplicates.
- Every phase ends with: self-test passes, no console errors, low-spec performance check (P0-04 method) not worse than the baseline unless a decision accepts it.

---

## Phase 0 - Baseline and audit

- [x] P0-01 - Create a tagged baseline commit of the current game before changes.
  Done when: the commit hash is recorded in Appendix C.
- [x] P0-02 - Full audit of the current build. Classify every finding as Critical, High, Medium, Low or Informational (bugs, crashes, input, accessibility, performance, memory, security / CSP, storage, save migration, mobile layout, gamepad, audio).
  Done when: Appendix D lists each finding with severity, location (line or function), reproduction and planned fix task ID.
- [x] P0-03 - Fix all Critical and High findings from P0-02 that do not depend on later phases.
  Done when: each fixed finding is ticked in Appendix D and the self-test passes.
- [x] P0-04 - Define the low-spec performance method: target device class, target frame rate, test scene (worst case arena + max fighters + max debris), metrics (frame time p50 / p95, JS heap, draw calls, load time, file size).
  Done when: the method and baseline numbers are recorded in Appendix C.
- [x] P0-05 - Add a developer performance overlay (frame time, draw calls, instance count, particle / debris count), hidden unless enabled in settings or a URL flag.
  Done when: the overlay shows the P0-04 metrics and is off by default.
- [x] P0-06 - Extend the self-test with a headless "AI vs AI" match runner using fixed seeds (used later by the balance phase).
  Done when: a seeded match runs to the end without rendering and returns winner, duration, damage dealt per move type.
- [x] P0-07 - Fix the findings routed to P0-07 in Appendix D (error screen with a gamepad, loop recovery after errors, self-test coverage and isolation, storage and input edge cases).
  Done when: each P0-07 row in Appendix D is ticked and the self-test passes.

## Phase 1 - Research and content decisions

- [x] P1-01 - RESEARCH: For each reference franchise / game, list mechanics relevant to this game: Tekken, Dead or Alive, Virtua Fighter 4 and 5, Mortal Kombat, Urban Reign, Ryu Ga Gotoku (Yakuza / Like a Dragon), The Warriors, Final Fight Streetwise, Beat Down: Fists of Vengeance, God Hand, Fighting Force, Dynamite Cop, The Bouncer, Midnight Fight Express, Sifu, Power Stone, Sleeping Dogs, Dynamite Deka EX, Crisis Beat, Die Hard Arcade, Crimson Tears, Mortal Kombat: Shaolin Monks, Def Jam: Fight for NY, Devil May Cry.
  Done when: Appendix B has one entry per game with mechanics and a source (official site, manual, or other reliable source). Unverifiable items are marked "unknown".
- [x] P1-02 - Normalize the research into one reference table: mechanic, which games use it, fits Modern Urban (yes / no), mobile complexity (low / medium / high), already in BREAKPOINT (yes / partial / no).
  Done when: the table is in Appendix B.
- [x] P1-03 - DECIDE: select the "best ideas not already implemented". Rule: accept only mechanics with Modern Urban fit = yes and mobile complexity low or medium, or that replace an existing mechanic without adding inputs.
  Done when: Appendix C lists accepted and rejected mechanics with one reason each, and each accepted one is mapped to a task in this file (add tasks if missing).
- [x] P1-04 - RESEARCH + DECIDE: list of real martial arts to cover "all martial arts styles" (striking, kicking, grappling, throwing, joint locks, weapon-based urban styles, hybrid / MMA, street fighting). Group into families that share animation where it makes sense (example from the ideas file: kickboxing punches and boxing punches).
  Done when: Appendix C has the final style list, each with family, signature traits, defense type default (block or sway, see P3-01) and which existing move style it replaces or extends.
- [ ] P1-05 - DECIDE: content counts - styles, preset fighters, levels / arenas, weapons, hazards, customization items per slot, countries, origins, goals, Tournament entrant counts (8 / 16).
  Done when: the counts are recorded in Appendix C with an estimated file size cost per item type.
- [ ] P1-06 - DECIDE: list of new preset fighters (one or more per style), each with name, style, country, origin, goal, body (height, fitness triangle point, age, gender) and role.
  Done when: Appendix C contains the full roster table.
- [x] P1-07 - Theme audit of existing content (names, arenas, creator options such as "Accent glow", effects, colors) against Modern Urban.
  Done when: each violation has a removal or rework task added to Phase 7, 8 or 9.
- [x] P1-08 - RESEARCH: Tournament format in Dragon Ball Budokai and Budokai Tenkaichi series (bracket size, eliminations, ring-out rules, rewards, multiplayer support).
  Done when: Appendix B has the verified rules with sources; unknown items marked "unknown".
- [x] P1-09 - RESEARCH: how other browser and console fighting games do online play (delay-based vs rollback, input delay values, peer count, desync handling).
  Done when: Appendix B has a summary with sources and a recommendation for P12-02.

## Phase 2 - Controls overhaul (mobile first)

- [ ] P2-01 - DECIDE: final action list. Required changes from the ideas file: remove `dash` completely; add `use` (pick up / drop / throw item); add `lock` (lock-on engage / disengage); replace block-high / block-low with one `defend` action whose meaning depends on the character (block or sway, P3-01). Decide what happens to: quick recovery (now on the dash input), `strong` and `height` modifiers, sidestep.
  Done when: Appendix C has the final action list for touch, gamepad and keyboard, with no action needing more than one simultaneous modifier on touch.
- [ ] P2-02 - Remove dash: DASH state, `DASH_COST`, transitions, AI use, touch DASH button, gamepad L3 mapping, keyboard binding, labels, help text, tutorials.
  Done when: searching the file for `dash` (case-insensitive) finds no game logic, and the self-test passes.
- [ ] P2-03 - Bump `KEYS_REVISION` and migrate saved key bindings (keyboard P1 and P2, gamepad) to the new action list without data loss for unchanged actions.
  Done when: a save from 1.0.0 loads with correct bindings and the new actions have defaults.
- [ ] P2-04 - Touch layout redesign: minimal buttons, no visual clutter, thumb reach on phones in landscape, safe areas respected. Context-sensitive buttons (example: `use` appears only when an item is in reach) only if approved in P2-01.
  Done when: layout fits a 360x640 CSS px landscape screen without overlap and all actions are reachable with two thumbs.
- [ ] P2-05 - Gamepad layout for the new action list (standard mapping), shown in the Controls screen.
  Done when: every action is mapped, no conflicts, labels updated.
- [ ] P2-06 - Keyboard layout for the new action list for P1 and P2 (shared keyboard).
  Done when: every action is mapped for both players with no key conflicts.
- [ ] P2-07 - Quick-start onboarding: a short first-play card per input type showing only the core actions.
  Done when: a new player can start a fight and see all core actions in one card per input type.
- [ ] P2-08 - Update Controls screen, help text, `ACTION_LABELS`, `GAMEPAD_LABELS`, `TOUCH_LABELS`.
  Done when: all labels match the new actions.
- [ ] P2-09 - Optional auto-assist input setting (off by default): repeated taps on Punch or Kick chain the fighter's next valid string move automatically; no new input, no new on-screen button.
  Done when: the setting exists in Settings and is saved; with it on, tapping Punch 3 times plays the style's 3-hit string on touch, gamepad and keyboard; with it off, behavior is unchanged; a self-test covers both.

## Phase 3 - Core combat rework

- [ ] P3-01 - Defense choice per character: each character has exactly one defense type, Block or Sway (an invincibility-frame dodge in the style of God Hand). Never both. Stored in preset data and in the creator (Style tab).
  Done when: the `defend` action performs only the character's defense type, AI uses the correct type, and the share code includes the defense type.
- [ ] P3-02 - Define Block rules (high / low coverage without a second button, perfect block, stamina cost, chip damage, guard break) and Sway rules (i-frame window, recovery, stamina cost, punish window, counter-attack follow-up).
  Done when: rules and values are in Appendix C and implemented; P0-06 runner shows neither type wins more than the balance target set in P14-01.
- [ ] P3-03 - Grab attacks: in a grab, Punch = elbow strike, Kick = knee strike. Distinct animations per style family where the style supports it.
  Done when: both strikes work from the grab on touch, gamepad and keyboard, with hit reactions and a strike limit per grab.
- [ ] P3-04 - DECIDE: submissions design with minimal inputs (proposal: start from a grab or a downed opponent with one existing input; escape by a short directional or mash contest that works on touch). Include which styles can submit.
  Done when: Appendix C has the design, inputs on all three control types, and rules for multi-opponent situations (other enemies can interrupt).
- [ ] P3-05 - Implement submissions per P3-04: states, animations, escape contest, damage / stamina effect, AI use and AI escape.
  Done when: submissions work in 1v1 and in multi-opponent levels and the self-test covers start, escape and finish.
- [ ] P3-06 - Optional heavy tackle: very heavy characters can charge through lighter ones by running into them with analog input only. DECIDE first whether to include, with the weight threshold.
  Done when: decision recorded; if included, the tackle triggers only by analog movement, only above the weight threshold, and has a counter.
- [ ] P3-07 - Falling: on unstable or elevated surfaces, a character with no support falls (gravity, fall damage, edge reactions such as teeter / grab ledge if approved).
  Done when: characters fall off edges and broken surfaces in every level that has them, and the AI avoids edges unless pushed.
- [ ] P3-08 - Re-tune hitstop, juggle limit, combo reset and frame data for the new action list.
  Done when: frame data shows in Training for every move and no move has an unintended infinite combo (checked by P0-06 runner).
- [ ] P3-09 - Automatic momentum boost: a gauge filled by landing hits, perfect blocks / sways and taking hits, giving a short stronger-damage state when full; same rules for AI; no extra input; shown on the fighter (pose / breathing, no glow, no sci-fi look) plus one thin bar.
  Done when: rules and values are in Appendix C; the boost triggers and ends as defined in the P0-06 headless runner; with it on, no style pair's win rate leaves the P14-01 target.

## Phase 4 - Multiple opponents and lock-on

- [ ] P4-01 - Support N fighters in one scene (players + enemies) for brawler levels; keep 1v1 path unchanged for 1v1 modes.
  Done when: a level runs with the P1-05 maximum enemy count at the P0-04 target frame rate on the low-spec test.
- [ ] P4-02 - Enemy group AI: attack tokens (limit how many attack at once), surround / flank positions, retreat, pick up weapons, use hazards.
  Done when: in a multi-enemy fight no more than the token count attack at the same time and enemies do not stack on one point.
- [ ] P4-03 - Lock-on system: new `lock` action toggles engage / disengage. Target choice rules that never select a wrong target: only valid hostile, alive, not down (unless chosen), within range and view; prefer the enemy in the stick direction, then the nearest threat. Switch target by flick / direction. Auto-release when target is KO or out of range.
  Done when: Appendix C lists the target rules, and a scripted test of scenarios (crowd, behind player, behind wall, downed enemy, ally nearby, target KO) selects the expected target every time.
- [ ] P4-04 - Without lock-on: automatic soft facing that attacks the most likely target, using the same rules as P4-03.
  Done when: attacks without lock-on face a valid target in the P4-03 scenarios.
- [ ] P4-05 - Lock-on indicator: diegetic or minimal marker on the target only.
  Done when: the marker is visible on all quality presets and adds no UI panel.
- [ ] P4-06 - Camera for multiple fighters: keeps the player and the locked / nearest threats in view, handles walls and verticality.
  Done when: in all levels the player is never hidden behind geometry for more than a short moment and off-screen attackers are signalled.
- [ ] P4-07 - Local co-op (up to 4 players) in brawler levels: shared camera, friendly-fire rule (DECIDE), revive rule (DECIDE).
  Done when: 4 local players (keyboard + gamepads) can play a level together.

## Phase 5 - Martial arts styles and animations

- [ ] P5-01 - Build the style data model: per style move list, stance, guard, footwork, signature moves, grab strikes, throws, submission set, defense type default.
  Done when: all P1-04 styles exist as data entries and load in the creator.
- [ ] P5-02 - Animations per style: identifiable and distinct per style, with overlap only where the real styles share technique (P1-04 families).
  Done when: each style has a written list of shared vs unique moves in Appendix C, and in Training each style is identifiable by stance and signature moves.
- [ ] P5-03 - Rework the 7 existing move styles into the new style list (keep, merge or replace as decided in P1-04).
  Done when: old saves with an old style id map to the new style.
- [ ] P5-04 - New preset fighters from P1-06 (look, style, stats, story settings, unlock rule).
  Done when: all preset fighters are selectable or unlockable.
- [ ] P5-05 - Non-combat animations: emotes, poses, idle, taunts, victory / defeat, reactions for story beats (Phase 10).
  Done when: the list from P10-02 is implemented.

## Phase 6 - Character customization

- [ ] P6-01 - DECIDE: customization items per slot (tops, bottoms, shoes, gloves / wraps, headwear, accessories, hair, facial hair, tattoos / marks), Modern Urban only, distinct silhouettes.
  Done when: Appendix C has the item list with the counts from P1-05.
- [ ] P6-02 - Implement the items with shared mesh generators to limit file size.
  Done when: all items render on all body types without clipping in the preview poses.
- [ ] P6-03 - Fitness triangle: 2D picker, Y axis = Muscle, X axis = Weight. DECIDE whether it modifies stats or complements them (choose the most versatile setup, record the reason).
  Done when: the picker sets body shape in the preview and the gameplay effect follows the decision.
- [ ] P6-04 - Age slider: affects look (hair color, posture, face) and gameplay per the same DECIDE approach as P6-03.
  Done when: age changes preview and gameplay as decided.
- [ ] P6-05 - Gender option: affects body and look; gameplay effects (if any) decided in P14-02.
  Done when: selectable in the creator and saved in the share code.
- [ ] P6-06 - Face from photo: the player picks a local image; an oval crop tool (move / zoom) selects the face; the cropped image is projected on the character face. The image never leaves the device.
  Done when: works on mobile and desktop, cropped face stored locally in a size-limited form, CSP allows the needed image source (verify `img-src data:` / `blob:`), and renderer supports textured faces.
- [ ] P6-07 - Add texture support to the renderer for faces only (sampler, texture atlas or per-fighter texture), with a fallback for weak GPUs.
  Done when: a textured face renders on all quality presets; low preset falls back to procedural faces if needed.
- [ ] P6-08 - Pre-drawn faces: a set of procedural / pre-drawn face variations selectable instead of a photo.
  Done when: the count from P1-05 is available and selectable.
- [ ] P6-09 - Facial expression system: states hurt, tired, panting, rested, angry (plus others decided in P1-03). When an expression triggers, the face image swaps. For photo faces: DECIDE method (proposal: generated variations by warping eye / brow / mouth regions of the cropped photo, or overlays).
  Done when: expressions change in fights for pre-drawn and photo faces, triggered by game state (damage, stamina, round end).
- [ ] P6-10 - Story settings in the creator: Country, Origin (social status / upbringing), Goal (examples from the ideas file: lose weight, make friends, revenge, psychopath). Lists from P10-01.
  Done when: all three are selectable, saved and included in the share code.
- [ ] P6-11 - Bump share code version and custom store version; migrate old custom fighters and share codes.
  Done when: 1.0.0 custom fighters and share codes load correctly with defaults for new fields.

## Phase 7 - Weapons, items and hazards

- [ ] P7-01 - DECIDE: weapon and item list (Modern Urban only: example types bottle, pipe, bat, chair, hammer, chain, trash can lid; final list per P1-05), each with class (light / heavy / throwable / two-handed), durability, damage, reach, speed, special effect.
  Done when: Appendix C has the table and each weapon has a distinct use.
- [ ] P7-02 - Pick-up rule: crouch near an item to pick it up (as in the ideas file). DECIDE how items placed above the floor (tables, racks, walls) are picked up, because the owner dislikes "crouch to take a hammer from a table" (proposal: the same input plays a reach / grab animation matched to the item height).
  Done when: decision recorded; items at floor, table and wall height can be picked up with one input and a fitting animation.
- [ ] P7-03 - Use input: tap `use` = drop the held item; hold `use` = throw it (aim from lock-on target or facing).
  Done when: works on touch, gamepad and keyboard; throw hits the locked target in the P4-03 scenarios.
- [ ] P7-04 - Weapon combat: weapon move sets per class, durability and breaking, disarm on heavy hit, block / sway interaction.
  Done when: each weapon class has its move set and breaks or drops as defined.
- [ ] P7-05 - Hazards: environment dangers (DECIDE list, example types: electric panel, hot surface, open drop, breaking glass, falling objects) that players and AI can use.
  Done when: each hazard damages any character, can be triggered on purpose, and the AI uses at least one hazard per level that has them.
- [ ] P7-06 - Pick up hazards and objects where approved in P7-01 (the ideas file says "pickup weapons and other Hazards").
  Done when: pickable hazards follow the P7-02 / P7-03 rules.

## Phase 8 - Levels

- [ ] P8-01 - DECIDE: new level list (Modern Urban only), count from P1-05, each with layout, verticality, destructibles, weapon placements, hazards, unstable surfaces, mode use (brawler, 1v1, tournament).
  Done when: Appendix C has a sheet per level.
- [ ] P8-02 - Rework the 3 existing arenas (Warehouse, Dojo, Pit): bigger, more destructibles, realistic weapon placement (on tables, racks, walls, not only on the floor), hazards, verticality.
  Done when: each matches its P8-01 sheet.
- [ ] P8-03 - Build the new levels from P8-01.
  Done when: each matches its sheet and passes the P0-04 performance check.
- [ ] P8-04 - Verticality: scaffolds, stages, balconies, stairs; breakable floors / stages that collapse under weight or damage.
  Done when: at least the levels marked "vertical" in P8-01 have climbable and breakable elements, and P3-07 falling works on them.
- [ ] P8-05 - 1v1 variants of levels (bounded area, optional ring-out per Tournament rules from P1-08).
  Done when: every 1v1 mode can use every level marked "1v1" in P8-01.
- [ ] P8-06 - Debris and destructible budget per quality preset.
  Done when: the worst-case scene stays within the P0-04 target on the low preset.

## Phase 9 - Interactivity and emergence (immersive-sim style)

- [ ] P9-01 - DECIDE: system rules matrix - which materials, objects, hazards, characters and states interact (examples: thrown object breaks glass, broken floor drops characters, electric panel + water, crowd / bystander reactions). Keep rules generic so combinations emerge without special cases.
  Done when: Appendix C has the matrix and each rule has one implementation function, not per-level scripts.
- [ ] P9-02 - Implement the matrix as shared systems (material, physics impulse, damage type, state flags).
  Done when: every matrix rule can be triggered in at least one level and AI can cause it.
- [ ] P9-03 - Persistent state within a level (broken objects stay broken, dropped items stay, damage marks remain) within the performance budget.
  Done when: state persists for the whole level on all quality presets.
- [ ] P9-04 - Theme fixes from P1-07.
  Done when: no item in the P1-07 list remains.

## Phase 10 - Arcade story, progression and unlocks

- [ ] P10-01 - DECIDE: lists of Countries, Origins, Goals (counts from P1-05, varied), each with story effect.
  Done when: Appendix C has all three lists.
- [ ] P10-02 - DECIDE: Arcade story structure: shared stages plus beats / events that change by Country, Origin and Goal; mini cutscenes made with in-engine animations, emotes and poses (not attack animations). List every needed non-combat animation for P5-05.
  Done when: Appendix C has the beat table (setting -> beats) and the animation list.
- [ ] P10-03 - Implement the story system (data-driven beats, conditions on the three settings and on player choices / results).
  Done when: two characters with different settings get different beats in the same Arcade run.
- [ ] P10-04 - Mini cutscenes: in-engine, skippable, short, mobile readable text.
  Done when: every beat in P10-02 plays and can be skipped.
- [ ] P10-05 - Progression and unlocks: clear list of what unlocks what (fighters, styles, items, levels, faces, emotes, modes) and how; shown in a menu.
  Done when: an unlock screen shows locked items with the requirement, and `Progress` save migrates from 1.0.0.
- [ ] P10-06 - Arcade uses brawler levels (multi-opponent) and 1v1 boss / rival fights (hybrid direction).
  Done when: a full Arcade run mixes both fight types.
- [ ] P10-07 - Fight results grade: a letter or star grade from time, damage taken and move variety, shown on the results screen; no input; best grade per mode saved in Progress.
  Done when: the grade comes from one pure function, is shown on RESULTS, is saved and migrates from the 1.0.0 Progress, and a self-test checks three sample fights.

## Phase 11 - Tournament mode

- [ ] P11-01 - Tournament mode modeled on the Budokai / Budokai Tenkaichi tournaments (rules from P1-08): elimination bracket, entrant count from P1-05, AI fill for empty slots, rewards.
  Done when: a full tournament runs from bracket draw to champion.
- [ ] P11-02 - Tournament with multiple humans: local (up to 4) and online (up to 4, Phase 12); AI vs AI matches can be watched or simulated (P0-06 runner).
  Done when: a tournament with 2-4 humans runs locally and online.
- [ ] P11-03 - Bracket screen readable on mobile.
  Done when: the bracket fits a phone screen in landscape with scroll only if the count exceeds 8.

## Phase 12 - Online multiplayer

- [ ] P12-01 - Signaling by copy-paste: host creates an offer code, guest pastes it and returns an answer code. Compress codes. DECIDE whether to add QR display / scan (QR display needs an inline encoder; camera scan may not be possible on all browsers - verify).
  Done when: two devices on the same local network connect with copy-paste only, no server.
- [ ] P12-02 - Netcode per P1-09 recommendation (delay-based or rollback) on the fixed 60 Hz simulation; input sync, desync detection (state checksum), reconnect / leave handling.
  Done when: a 1v1 online match on LAN completes without desync in a 10-minute test.
- [ ] P12-03 - Up to 4 peers (host relays to guests, star topology).
  Done when: 4 devices play one brawler level or tournament round together.
- [ ] P12-04 - CSP update: allow only what WebRTC needs. Verify in current browsers whether `connect-src` affects WebRTC; keep everything else `'none'`.
  Done when: the CSP change is the minimum needed and documented in Appendix C.
- [ ] P12-05 - Determinism audit: all gameplay randomness through the seeded RNG, no frame-rate-dependent logic, no use of `Math.random` in simulation.
  Done when: two runs with the same seed and inputs give identical state checksums.
- [ ] P12-06 - Online lobby UI: create / join, player list, ready check, mode select, latency display.
  Done when: usable on touch and gamepad.
- [ ] P12-07 - Document limits: networks that block peer-to-peer (no TURN server) cannot connect; show a clear message.
  Done when: failed connections show the reason text.

## Phase 13 - Audiovisual feedback

- [ ] P13-01 - DECIDE: feedback list, strong and diegetic (on the characters and the world), keeping only obvious UI (health, stamina, timer). Examples to evaluate: bruises and swelling, sweat, torn clothes, breathing / panting, expression faces (P6-09), impact sound layers, camera shake / zoom, hitstop, slow-motion finishers, crowd / bystander reactions, debris, controller rumble.
  Done when: Appendix C lists accepted feedback with its trigger and cost.
- [ ] P13-02 - Implement P13-01 within the performance budget.
  Done when: each accepted item works and P0-04 check passes on low preset.
- [ ] P13-03 - Settings to reduce intense effects (shake, flashes) for accessibility.
  Done when: each intense effect has an off / reduced option.

## Phase 14 - Game design and balance

- [ ] P14-01 - Define the balance targets (example: win rate range between equal-skill AI per matchup, time-to-KO range).
  Done when: targets are in Appendix C.
- [ ] P14-02 - For every option that affects gameplay, write benefits, drawbacks and explicit use: each stat, each style, defense type (block / sway), height, fitness triangle (muscle, weight), age, gender, each weapon class, each pickup, each story setting if it affects gameplay.
  Done when: Appendix C has a table where every option has at least one benefit, one drawback and one explicit use, and no two options have the same profile.
- [ ] P14-03 - Smart testing plan (not every configuration): test extremes and corners (fitness triangle corners, age ends, height ends, stat extremes), one-factor-at-a-time sensitivity around a baseline, pairwise (orthogonal array) combinations for interactions, all style pairs once with seeded AI vs AI.
  Done when: the plan lists every test case and the total count.
- [ ] P14-04 - Run the plan with the P0-06 runner; fix outliers; re-run only affected cases.
  Done when: all cases meet the P14-01 targets, results summarized in Appendix C.
- [ ] P14-05 - Tune AI difficulty levels for 1v1 and groups.
  Done when: each difficulty meets its target win rate against a scripted reference player.

## Phase 15 - Performance and file size

- [ ] P15-01 - Profile with the P0-04 method after all content is in.
  Done when: numbers recorded in Appendix C.
- [ ] P15-02 - Optimize hot paths found in P15-01 (allocation per frame, draw calls, instance updates, AI per-enemy cost, audio voices).
  Done when: the low-spec target from P0-04 is met.
- [ ] P15-03 - Reduce file size: remove dead code and duplicated data, compact data tables, share generators, shorten repeated strings. Keep the file readable (no build step).
  Done when: final size recorded and compared to the baseline in Appendix C.

## Phase 16 - Final audit and release

- [ ] P16-01 - Repeat the full audit (same categories as P0-02) on the final build. Classify Critical, High, Medium, Low, Informational.
  Done when: Appendix D has the final audit; no Critical or High remain open.
- [ ] P16-02 - Save migration test: 1.0.0 settings, progress, bindings and custom fighters load correctly.
  Done when: self-test covers each store key migration.
- [ ] P16-03 - Device test matrix: low-spec Android phone, iPhone, desktop with keyboard, desktop with gamepad, online 2 and 4 peers.
  Done when: each row passes or has a recorded known issue.
- [ ] P16-04 - Update in-game help, About, credits; bump `VERSION`.
  Done when: all texts match the final features.

---

## Appendix A - Coverage map (every line of the former Ideas-breakpoint.txt)

| Idea (verbatim source text, shortened) | Tasks |
|---|---|
| Reference franchises / games list | P1-01, P1-02, P1-03 |
| Theme Modern Urban, no sci-fi / fantasy | Rule 3, P1-07, P9-04 |
| New distinct real martial arts | P1-04, P5-01, P5-02, P5-03 |
| New characters covering all martial arts styles | P1-06, P5-04 |
| New distinct customization items | P6-01, P6-02 |
| Face from photo (oval crop, projected) or pre-drawn faces | P6-06, P6-07, P6-08 |
| Facial expression system (hurt, tired, panting, rested, angry) | P6-09 |
| Distinct animations per style, overlap only when it makes sense | P5-02 |
| Weapons that can be picked up; crouch to pick up weapons and hazards; tap Use drop, hold Use throw | P2-01, P7-01 to P7-06 |
| Best ideas from the reference, no unnecessary complexity (mobile) | P1-03 |
| New distinct levels | P8-01, P8-03 |
| Rework all levels: bigger, destructibles, realistic weapon placement, hazards, verticality (scaffold, breaking stage) | P8-02, P8-04, P7-02 |
| Fall from unstable surfaces when nothing holds the player | P3-07, P8-04 |
| Multiple opponents and lock-on button that never locks on wrong targets; engage / disengage | P4-01 to P4-07 |
| Reduce file size, profile, optimize for low-spec mobile | P0-04, P0-05, P8-06, P15-01 to P15-03 |
| Fitness triangle (Y Muscle, X Weight) and Age slider, stats or complement | P6-03, P6-04, P14-02 |
| Knees (Kick) and Elbows (Punch) for grab attacks | P3-03 |
| Submissions without unnecessary complexity | P3-04, P3-05 |
| Rework gameplay balance; every option has benefits, drawbacks, explicit uses (incl. height, fitness, gender, age); smart minimal testing | P14-01 to P14-05 |
| Strong, diegetic audiovisual feedback, only obvious UI | P13-01 to P13-03 |
| Controls overhaul: mobile first, controller on PC, no clutter | P2-01 to P2-08 |
| Clear progression, unlocks | P10-05 |
| Country, Origin, Goal affect Arcade story, beats, non-attack animations, mini cutscenes; varied, many | P6-10, P10-01 to P10-04, P5-05 |
| Max state interactivity, emergence (immersive sims) | P9-01 to P9-03 |
| Online multiplayer, no dependencies, one HTML file; multiple player counts | P1-09, P12-01 to P12-07, P4-07 |
| Single choice per character: Block or i-frame Dodge / Sway, never both | P3-01, P3-02 |
| Dash removed completely | P2-01, P2-02 |
| Optional: heavy characters tackle smaller ones by moving through them (analog only) | P3-06 |
| Tournament mode like Budokai / Budokai Tenkaichi, playable multiplayer | P1-08, P11-01 to P11-03 |
| Overall audit Critical / High / Medium / Low / Informational | P0-02, P0-03, P16-01 |

### Original text of Ideas-breakpoint.txt (verbatim)

```text
from all entries in these Franchise
Tekken, Dead or Alive , Virtua Fighter 4 and 5, Mortal Kombat
Urban Reign,Ryu Ga Gotoku,The Warriors, Final Fight Streetwise,BeatDown Fists of Vengeance,Godhand,Fighting Force,Dynamite Cop,The Bouncer,Midnight Fight Express,Sifu,Power Stone,Sleeping Dogs,Dynamite Deka EX,Crisis Beat,DieHard Arcade,Crimson Tears,Mortal Kombat Shaolin Monks,Def Jam Fight for NY,Devil May Cry

Source Normalized Reference for (Theme is Modern Urban no Sci Fi,Fantasy etc)
- New Distinct Real Martial Arts
- New Characters Covering all Martial Arts Styles
- New Distinct Customization Items for Character Customization
- Set Your Face on a character from a photo (Oval that crops a photo and projects it on the face) or use variations of preDrawn Faces.
- Facial Expression System (actually when an expression is triggered like hurt,tired,panting,rested,angry the face image,projected face swaps)
- Identifiable Distinct Animations per style with overlap only when it makes sense (kickboxing punches and boxing punches)
- Distinct Weapons that can be Picked Up (Crouch to pickup weapons and other Hazards,Tap Use to Drop Hold Use to Throw.
- Best ideas not already implemented to incorporate from the reference without adding unecessary complexity (think mobile players).
- New Distinct Levels
- For all levels rework, bigger with more destructibles,weapons placed realistically not just on the ground (even though i dont like the semantics of using crouch to get a hammer from a table), hazards and verticality apart from horizontal space (scaffold,stage that breaks)
- In unstable surfaces, when nothing holds the player he/she can fall.
- If applicable and not complicating mobile controls. Multiple Opponents and a Perfect Lock On System with a new button that never Locks at Wrong Targets. Can engage lock or disengage lock.
- For the above, try to reduce the total size of the file as much as possible, profile and optimize performance when appropriate so that the game runs smooth in low spec mobile devices.
- For Character Customization Include Fitness Triangle (Y axis is Muscle X axis is Weight) either affected by stats or complementing stats (choose the most versatile setup). The same for an Age Slider
- Knees(Kick Button) and Elbows(Punch Button) for Grab Attacks.
- From the Reference Include Submissions even though i dont know how to do them without adding unecessary complexity.
- Game Design: Rework the Gameplay,Balancing Every Option (from stats,pickups,fighting style) should have its explicit uses. Each configuration (preauthored or from the character customization) that affects gameplay (including height fitness triangle and gender and age) should have its benefits,drawbacks and its explicit uses even though the player has options to customize. This Evaluation should not be approached by testing every possible configuration. Effective Results with as least and smartest testing as possible.
- Game Design Audiovisual Feedback: Make it as strong, potent, addictive and diegetic as possible keeping the obvious ui only.
- If needed overhaul,rework the controls so that the game can be quickly picked up and played effectively in mobile (mobile first) with a controller on a pc without problems and without confusing layout and without visual clutter from screen buttons.
- Clear Progression, Unlocks. Three approx Settings in Character Customization that affect the Arcade (each configuration of a player affects the story of the Arcade, the story beats/events and use of new animations,emotes,poses that are not related to the attacks like mini cutscenes. I was thinking Country, Origin (like the social status/upbringing), Goal(ex lose weight,make friends,revenge,psychopath). Keep them varied and have lots of them.
- Max State Interactivity,Emergence similar to Immersive Sims.
- Look at other games and plan the best option for including multiplayer over the internet (local network for example) with no dependencies (as close to one pure html file). If you manage the thing with multiple targets effectively  support multiple player counts.
-Single Choice for Block Button to either be a Block or an Iframe Dodge/Sway (like in Godhand) per character
never both. Dash is Removed completely.
-Optional: Maybe Characters who are very Heavy can rush/charge on smaller ones and tackle them by moving through them (analog only)?
-A new Tournament Mode that works like the ones in games like Dragon Ball Budokai and Budokai Tenkaichi Series (eliminations) that can be played multiplayer
-Overall audit that covers any Critical,High,Medium,Low,Informational Issues.
```

## Appendix B - Research log

(Filled by RESEARCH tasks. One entry per item: topic, finding, source, verified yes / no / unknown.)

## P1-01 - Reference games (researched 2026-10-28)

One entry per game or franchise: gameplay mechanics relevant to BREAKPOINT, in our own words. Items no source confirmed are marked "unknown".

#### Tekken
- Limb-per-button attacks: each of the four limbs has its own button instead of light/medium/heavy strength.
- Sidestep and 3D movement: sidesteps into/out of the screen from Tekken 3; Tekken 4 added uneven arenas with walls and obstacles.
- Neutral guard: from Tekken 2 standing/retreating auto-blocks high and mid, crouching blocks low; holding back gives a stronger active guard.
- Parries and reversals: some characters can catch and reverse incoming attacks.
- Throws and positional throws: throws exist; Tekken 4 made side and back throws hit harder to reward flanking.
- Recovery rolls: from Tekken 3 a downed fighter can roll to recover, risking a hit while rolling.
- Juggles, bounds, wall combos: airborne opponents can be kept in combos; later games added bound hits, power crushes (uninterruptible moves) and wall stun/bound.
- Rage / Heat: comeback damage boost near defeat (Tekken 6/7, Rage Arts super), Heat mode in Tekken 8 pushes aggression.
- Destructible stages: Tekken 6 breakable floors and walls; Tag 2 balcony breaks drop the fight to a lower level.
- Side modes: Tekken Force (side-scrolling brawler vs many enemies), Tekken Ball, Survival, Tag (2v2), Scenario Campaign playable online.
- Sources: https://en.wikipedia.org/wiki/Tekken
- Verified: partly (customization and detailed online systems unknown; only first 100k chars of the article read)

#### Dead or Alive
- Strike / throw / hold triangle: strikes beat throws, throws beat holds, holds beat strikes, forcing mixups.
- Four-button simplicity: punch, kick, throw (hold), guard keep inputs small.
- Counter holds: guard plus direction at the right moment catches an incoming strike; direction must match the attack height/type.
- Danger zones: ledges, walls, explosives and breakable structures add extra damage; can knock out a low-health fighter.
- Multi-level arenas: stages grew from rings to multi-level areas; falls down levels hurt.
- Free 3D movement: sidestepping makes most attacks dodgeable (DOA3).
- Tag mode: switch partners mid-combo, tag throws for pairs, 4-player tag; partner can strike on entry.
- Costume customization (DOA6), many alternate outfits.
- Online play early in the genre (Ultimate onward).
- Sources: https://en.wikipedia.org/wiki/Dead_or_Alive_(franchise)
- Verified: partly (progression/story structure and exact stun/critical-hit rules unknown; only first 100k chars read)

#### Virtua Fighter 4 and 5
- Three-button core: punch, kick, guard (plus directions); widely known as the franchise control scheme (not confirmed in the fetched article).
- Throws: startup lengthened (8 to 12 frames in VF5); zero-frame instant throws in guaranteed situations such as after an evade.
- Throw clash: timing a throw against an incoming attack cancels it and returns both to neutral.
- Evade and Offensive Move: Punch+Kick+Guard during an evade starts an angled forward dash; follow-ups can stagger/crumple for a guaranteed combo.
- Walls and rings: ring size, weight and walls vary per stage; wall breaks only on a strong hit against a breakable wall.
- Bound system (VF5 R onward): juggled opponents can be bounced off the ground to extend combos; depends on weight and stage.
- Ring-outs: not confirmed in fetched text (series known for them; unverified).
- Quest mode: arcade-hopping progression with unlockable items; details unknown.
- Customization: cosmetic items, mainly DLC and R.E.V.O. editions.
- Online: Xbox 360 only, 2 players; PS3 none at launch.
- Sources: https://en.wikipedia.org/wiki/Virtua_Fighter_5
- Verified: partly (three-button scheme, ring-outs, VF4 differences, Quest details unverified)

#### Mortal Kombat
- Dedicated block button: early cabs had high/low punch, high/low kick and block; MK3 added a run button.
- Finishers: character-specific fatalities, plus animalities, brutalities, babalities; Armageddon let players build their own.
- Stage fatalities: finishing by using the arena (spikes, acid pit); other arena interaction not confirmed.
- Weapon styles: Deadly Alliance to Deception gave each fighter 2 unarmed + 1 weapon style; Armageddon reduced to two.
- Style switching removed in MK vs DC for a larger special-move set.
- Konquest: free-roam action-adventure mode in Deception and Armageddon.
- Minigames: Chess Kombat, Puzzle Kombat, Motor Kombat.
- Create-a-finisher (Kreate-A-Fatality) as customization.
- X-ray / fatal blow, krypt, towers, kustomization, online: unknown (not in the read portion).
- Sources: https://en.wikipedia.org/wiki/Mortal_Kombat_(franchise)
- Verified: partly (X-ray moves, towers, krypt, kustomization, story mode structure, online unknown)

#### Urban Reign
- Multi-enemy brawling: AI and human fighters share the screen; one move can hit several foes.
- Grapples and counters: low, high and aerial grapples; counter and counter-of-counter animations per character.
- Combos: three quick presses, the third launches the target.
- One-button timed defense: well-timed press neutralizes an attack; dodge plus direction can reverse it.
- Weapons and environment: pick up weapons, throw objects, use surroundings.
- AI partners: player can issue orders to computer allies.
- Special arts: two-button super moves from a charged meter; cannot be countered except by another special; can be buffered.
- Multiplayer: up to 4 players, arcade-style modes; roster of 60 including Tekken guests.
- Story structure: brawler-for-hire clears gangs of Green Harbor to find a kidnapped member (details brief).
- Character creation, mission structure, full control scheme: unknown.
- Sources: https://en.wikipedia.org/wiki/Urban_Reign
- Verified: partly (character creation, mission structure, lock-on, controls unknown)

#### Ryu Ga Gotoku (Yakuza / Like a Dragon)
- Multiple fighting styles: some entries let you swap styles; Majima and Shinada use unbreakable signature weapons.
- Heat actions: filling a heat gauge unlocks context-sensitive finishers, some with quick-time events.
- Street objects as weapons: grab objects, take dropped weapons, buy weapons in shops.
- Random encounters: enemies approach while exploring and trigger a fight.
- XP progression: battles give experience that raises stats; side stories give extra XP.
- Crafting and gear: weapon/gear crafting, Coliseum tournaments.
- Mini-games: bowling, darts, arcade, gambling, karaoke, cabaret management, racing.
- Turn-based shift: Like a Dragon (2020) switched to turn-based RPG with party; Judgment spin-offs stay real-time.
- Lock-on: unknown (not in source).
- Sources: https://en.wikipedia.org/wiki/Yakuza_(franchise)
- Verified: partly (lock-on, multi-enemy handling specifics, controls unknown)

#### The Warriors (2005)
- Gang rumbles with allies: one to eight AI Warriors fight alongside you; you control one per mission.
- Light/heavy/grab/throw combos: 2-3 input strings; pause menu lists techniques (combos, wall smashes, charges, counters, weapon attacks).
- Grab and grapple gauge: grabs trigger character power moves; a gauge drains while grabbing or mounting.
- Rage meter: fills over time; when full gives stronger combos, finishers and brief invincibility.
- Flash item: heals and revives knocked-out allies.
- Weapons and loot: enemy drops, shops for knives, spray cans; gear upgrades (brass knuckles, boots).
- Fixed-order missions: beating up gangs, stealing, chases; hub at Coney Island for training and talking.
- Crime and police: mugging, graffiti, cops respond; stealth takedowns of rival scouts who call backup.
- Checkpoint failure: health out fails the mission; resume from checkpoint.
- Multiplayer: 2-player co-op and Rumble Mode free-for-all; lock-on unknown.
- Sources: https://en.wikipedia.org/wiki/The_Warriors_(video_game)
- Verified: partly (lock-on and button layout unknown)

#### Final Fight: Streetwise
- 3D beat 'em up in Metro City with story mode and a simpler arcade mode.
- Arcade mode: 1-2 players, stripped-down brawler without upgrades, counters or instinct moves; ends when life bar empties.
- Gym training upgrades: story mode Kyle trains at gyms to expand his moveset.
- Money economy: earned from pit fights and side missions to pay for training.
- Instinct system: counter enemy attacks and strengthen own (single unsourced claim).
- Roaming the city for investigation; mechanics of roaming unknown.
- Story minigames: ten, including arm-wrestling, slide puzzles, shooting contests.
- Checkpoint saves.
- Grapples, weapons, lock-on, environment interaction: unknown (not in source).
- Sources: https://en.wikipedia.org/wiki/Final_Fight:_Streetwise
- Verified: partly (grapples, weapons, lock-on, environment unknown)

#### Beat Down: Fists of Vengeance
- Negotiation: after wearing a target down (low health/pride, weapon or taunt helps), the player can talk instead of fight; success ends the fight.
- Recruiting: nearly any NPC can be recruited into the crew, in conversation or mid-fight; failure can start a fight.
- Crew in missions: recruited NPCs join missions and unlock minigames based on their skills.
- Rob / interrogate options: out of fights the player can swindle or ask NPCs, or interrogate defeated enemies for information; refusal can lead to a fight.
- Combat range: unarmed combat, melee weapons, later firearms; combos are learned from NPCs for cash or at a skill level.
- Street fights lock the area so the player cannot chase enemies away.
- Group battles and vs. fighting are separate formats (review called both only okay).
- Dodge/block/grapple detail: unknown.
- Sources: https://en.wikipedia.org/wiki/Beat_Down:_Fists_of_Vengeance; https://gameinformer.com/b/features/archive/2018/06/01/replay-beat-down-fists-of-vengeance
- Verified: partly (defense, grapple, lock-on, multiplayer unknown)

#### God Hand
- Customizable move set: over a hundred moves, player assigns attacks to face buttons to build own combos.
- God Reel (roulette): chosen special moves cost 1-3 orbs; orbs found via Skull Cards; wheel opens with a shoulder button, slows time, and is cancelled if the player is hit.
- Orb capacity: two at start, upgradable by purchase; max is 5 or 6 depending on source (unverified which).
- Right-stick dodge: four directional evasive moves on the right analog stick.
- Tension gauge: filled by hits, taunts, and dodges; at full the player enters God Hand mode (invincible, stronger and faster attacks).
- Lock-on target: roulette use forces facing the locked target (multi-enemy handling).
- Move shop/economy: moves bought and upgraded (shop detail not source-checked).
- Taunting as a risk/reward mechanic: gives gauge but exposes player.
- Regional differences: some moves differ between JP and western versions (gore).
- Sources: https://en.wikipedia.org/wiki/God_Hand; https://godhandcapcom.fandom.com/wiki/File:RWOrbs.jpg
- Verified: partly (orb cap, shop details, enemy difficulty scaling unknown)

#### Fighting Force
- Four playable characters, each with different strengths and one health-costing special move.
- Pick-up objects: street posts and railings can be torn out and used as weapons.
- Breakables: car trunks can be hit open to drop weapons; many objects are destructible and yield parts to attack with.
- Weapon variety: knives, guns, chairs, trash cans, tires, cans (cars also listed).
- Simple three-button control scheme similar to Die Hard Arcade (per a 1997 preview).
- Crowd density: up to six enemies on screen at once.
- Branching paths: some levels offer multiple route choices (counts disagree between sources).
- Multiplayer co-op: unknown (not confirmed in results).
- Grapple/throw detail: unknown.
- Sources: https://en.wikipedia.org/wiki/Fighting_Force; https://www.mobygames.com/game/3191
- Verified: partly (grapples, block, co-op, lock-on unknown)

#### Dynamite Cop (Dynamite Deka 2)
- Simple controls: punch, kick, grab, plus a 360 spin attack that hits all surrounding enemies (other buttons not verified).
- Grab leads into a chain of submission/throw moves; grabbing is central.
- Environment weapons: firearms and everyday items; chairs, urinals, even other enemies can be used.
- Power-up combo: collecting six power-ups or one super power-up grants a temporary strong attack chain.
- Harder Showdown mode unlocked as extra content.
- Short length noted as a main flaw by reviewers (pacing lesson).
- VMU hint: handheld sound when near hidden illustrations (collectible hint idea).
- Block/dodge, co-op, character select: unknown.
- Sources: https://planetdc.segaretro.org/games/reviews/dynamitecop/; https://www.hardcoregaming101.net/dynamite-cop/
- Verified: partly (button count, block, multiplayer unknown)

#### The Bouncer
- Pressure-sensitive attacks: face buttons map to high/mid/low; tap gives weak blow, hold/mash gives slower stronger blow.
- Ragdoll physics: enemies launch into the air, enabling juggles.
- Bouncer Points: awarded after clearing areas; spent on power/life/defense stats or new special moves.
- Three playable characters with distinct styles; player picks one after each cutscene and story branches accordingly.
- Short segments between cutscenes (very cinematic structure; reviewers cited short length and camera problems).
- Versus/multiplayer modes: unknown (not confirmed here).
- Block/grapple/lock-on detail: unknown.
- Sources: https://en.wikipedia.org/wiki/The_Bouncer_(video_game); https://www.gamespot.com/reviews/the-bouncer-review/1900-2692332/
- Verified: partly (defense, grapples, multiplayer unknown)

#### Midnight Fight Express
- Simple core inputs: one attack button and one dodge button; block and counter are timing based.
- Parry and counter skills: parry followed by counterattack, some with kick or knockdown follow-ups.
- Skill tree: one upgrade point per level completed, each upgrade costs one point, about 40 upgrades; points not refundable but skills can be toggled/assigned.
- Gated trees: rope and secondary gun trees unlock later in story.
- Grab and chain-finisher skills exist.
- Weapons and secondary guns: gun ammo can carry effects such as electric stun.
- Rolling away from gunfire is a key defensive tactic.
- Mission scoring and ratings; challenges unlock cosmetics (customization).
- Practice mode: test moves against chosen enemies and weapons.
- Some missions add obstacles breaking up the brawling.
- Sources: https://www.thegamer.com/midnight-fight-express-skills-upgrades-explained-guide/; https://checkpointgaming.net/reviews/2022/08/midnight-fight-express-review-the-john-wick-experience/
- Verified: partly (lock-on, co-op, environment destruction details unknown)

#### Sifu
- Structure bar (posture): hits and blocked hits fill enemy bar; when full the enemy breaks and can be finished. Player bar fills when blocking and recovers over time or by evasion.
- Defense set: block, dodge, parry, and deflect (lean/duck high or low hits without moving, can recover structure).
- Perfect parry stuns enemy and opens a counter.
- Focus: spendable resource for special attacks and guard-breaks (least-detailed, partly verified).
- Aging on death: each death ages the character and raises death count; sources disagree on age effects (health loss vs. unlocking skills), and some skills tie to age.
- Permanent skill unlocks: experience is gained by dying; linear run of levels.
- Stance/style system and emphasis on dodging as the main differentiator.
- Enemies block most attacks, forcing learned combos and dodging.
- Multi-enemy handling, weapons, environment: unknown (not in results).
- Sources: https://steventus.substack.com/p/deep-design-dive-sifu; https://gamingtrend.com/previews/sifu-preview-float-like-a-butterfly-sting-like-an-old-man
- Verified: partly (focus, age effect disputed; weapons/environment/lock-on unknown)

#### Power Stone / Power Stone 2
- Arena brawling: 2 players (PS1) to 4 players (PS2) free-for-all in 3D arenas.
- Item pickups: guns, swords, hammers, bombs offensive; food, shields, invisibility, wings defensive.
- Power Stones: three collected from item boxes give a short super-powered transformation.
- Heavy objects: only some characters lift heavy objects normally; others must transform first.
- Interactive stages: arenas change during a match (e.g. airship falling apart into a skydive).
- Simplified controls in PS2: one Attack button plus an Action button for grabbing items.
- Adventure mode with unlockable items and cards; item crafting and trading add over 100 items.
- Top-down-ish camera framing multiple fighters (described as top-down in one source).
- Block/dodge, grapple/throw detail: unknown.
- Sources: https://en.wikipedia.org/wiki/Power_Stone_2; https://powerstone.fandom.com/wiki/Power_Stone_(video_game)
- Verified: partly (PS1 vs PS2 differences, defense, grapples unknown)

#### Sleeping Dogs
- Three-command melee: attack, grapple and counter are the core buttons, chained with movement; fights work with or without weapons.
- Counter from any side: the counter button answers enemies attacking from any direction (defense is timing-based, not a dodge roll).
- Grapple into environment: grabbing an enemy lets you drag them to scenery (hazards, objects) for environmental takedowns.
- Environmental kills feed the face meter faster: rewards spectacle over plain hitting.
- Breakable melee weapons: knives, tire irons, pans etc. wear out and break after extended use.
- Scarce guns with cover and slow-motion shooting: firearms are limited, usually one carried, shooting is secondary to melee.
- Three XP tracks: Triad XP (violence) unlocks combat upgrades, Face XP (civilian/side missions) unlocks cosmetics and the face meter, Police XP (low casualties/damage) unlocks gun skills.
- Face meter: a full meter grants bonuses such as regeneration and higher damage.
- Clothing/accessory customization: gear changes NPC reactions and can affect XP gain, damage, or heat (police attention).
- Collectible-gated combos: collecting jade statuettes and returning them to a dojo unlocks new combos.
- Sources: https://en.wikipedia.org/wiki/Sleeping_Dogs_(video_game)
- Verified: partly (control scheme not verified; lock-on/multi-enemy targeting rules unknown; only first 100k chars of article read)

#### Dynamite Deka EX (Asian Dynamite)
- Item-based transformation: picking up items changes the character into different fighters with their own styles (series trait, from search summary).
- Wield-anything weapons: series lets the player use many available objects as weapons.
- Revised power-up system: EX is a revamped Dynamite Deka 2 with an upgraded power-up system and new graphics.
- Three playable characters (Hong Kong setting): character roster differs from Deka 2.
- Arcade only (Naomi), no home port: relevant only as a design reference.
- Grab/throw, block, dodge, QTE, multi-enemy handling: unknown for EX specifically (parent series Die Hard Arcade has combined co-op moves and QTEs, see that entry).
- Sources: https://www.hardcoregaming101.net/dynamite-deka-ex-asian-dynamite/ (search snippet only, page itself was down); https://gemubaka.com/2022/09/24/the-third-dynamite-deka-game-ex/ (snippet only)
- Verified: partly (only search-snippet level; combat, grapple, defense details unknown)

#### Crisis Beat
- Waves-of-enemies stages: each stage is a set of enemy waves in full 3D; clear all to advance.
- Hand-to-hand focus: fists, feet and scenery objects are used against enemies.
- Four playable characters, two-player mode available.
- Adaptive boss pick: the game picks a boss intended to counter the chosen character (per a secondary summary).
- Unlockables: a harder difficulty and a story-less free mode.
- Stealth/strategy element: only mentioned in publisher blurb; details unknown.
- Special moves, grapples, defense, weapons: unknown.
- Sources: https://en.wikipedia.org/wiki/Crisis_Beat
- Verified: partly (structure only; move set, defense, weapons unknown)

#### Die Hard Arcade (Dynamite Deka)
- Rooms of minions then boss: each level is several rooms of enemy groups followed by a boss, with cutscenes between.
- Pick-up weapons: weapons come from defeated enemies or the environment, from household items to heavy guns.
- Item combining: items can be merged (spray plus lighter gives a flamethrower).
- Weapon lifetime: most weapons vanish at the end of each action scene; handguns stay while they have ammo.
- Quick time events between scenes: failing costs health or adds an extra action scene (a light branching/consequence mechanic).
- Two-player co-op with combined special moves and combos.
- Versus ending: if both players survive, they fight each other for the finale.
- Fists and feet combat with a move set richer than typical beat-em-ups; grab/throw buttons not confirmed in sources read.
- Sources: https://en.wikipedia.org/wiki/Die_Hard_Arcade
- Verified: partly (button layout, throws/grabs, health model unknown)

#### Crimson Tears
- Dungeon-crawler structure: real-time combat in levels generated from templates, flat layouts.
- Weapon-based beat-em-up with RPG elements: reader review describes it as beat-em-up merged with RPG.
- Three playable characters with distinct abilities and combat styles.
- Diverse weapon types (retail listing only; details unknown).
- Criticized as repetitive (reception note).
- Combos, lock-on, tag/switching, item use, leveling, customization: unknown (not found in sources).
- Sources: https://en.wikipedia.org/wiki/Crimson_Tears; https://www.giantbomb.com/games/3030-2700/
- Verified: partly (structure only; combat details unknown)

#### Mortal Kombat: Shaolin Monks
- Multi-directional combat: attack any surrounding enemy; combos carry across several enemies.
- Juggles: strong attacks or throws launch enemies and combos continue in the air.
- XP upgrades: experience from kills improves combos and special moves; combo count multiplies XP gain.
- Environment hazards: pits and spiked rotating wheels are instant kills; destroying objects drives puzzles and secrets.
- Fatality meter: landing combos fills a meter; when full, a Fatality can be done regardless of enemy health.
- Multalities: unlockable finishers that hit multiple enemies at once.
- Brutalities: grant stronger attacks for a limited time.
- Two-player co-op (some areas/items need it), plus a versus mode in some arenas.
- Controls and defense (block/dodge): unknown from sources read.
- Sources: https://en.wikipedia.org/wiki/Mortal_Kombat:_Shaolin_Monks
- Verified: partly (controls, block, lock-on unknown)

#### Def Jam: Fight for NY
- Five fighting styles (Streetfighting, Kickboxing, Martial Arts, Wrestling, Submissions); players use one to three; each has its own knockout finisher.
- Controls: punch, kick, weak and strong grapple, timed block; grapple button also grabs weapons from floor/crowd, so you can pick up an item by accident (Cubed3, GameCube version).
- Momentum meter: built by successful moves, countering and taunting; rate depends on Charisma stat, which gear (clothing, tattoos, jewelry) raises.
- Blazin' Taunt and Blazin' Move: full meter unlocks a special move; created fighters can learn all but equip only four.
- Two health bars: consciousness drains faster than physical wellness; low state triggers a knockout danger (red) state.
- Submission holds wear down one body part's health bar; matches end by knockout or submission.
- Environment: slam opponents into walls, doors, gates; crowd shoves fighters back, holds them, or offers weapons; stage hazards like a passing subway train.
- Double-teaming: crowd members can help you or the opponent.
- Career mode: cash for clothing, haircuts, tattoos, jewelry; development points at the gym raise skills and unlock moves/styles.
- Customization: preset faces or custom eyes, nose, hair, voice; Cubed3 says no body editing and that created fighters are not carried through story mode (conflicts with Wikipedia's career description; treat as unverified). Multiplayer up to four players per Cubed3.
- Sources: https://en.wikipedia.org/wiki/Def_Jam:_Fight_for_NY; https://www.cubed3.com/review/138/1/def-jam-fight-for-new-york-nintendo-gamecube.html
- Verified: partly (character creation scope and multiplayer count rest on a single review)

#### Devil May Cry (series)
- Style rank D to S: graded on stylish play, time, currency and consumables; later games require varied attacks to keep rank.
- Devil Trigger: temporary boosted form with more speed and damage, slow health regen, powers tied to the current weapon.
- Weapon swapping: DMC2 added cycling ranged weapons; DMC3 added melee weapons and free swapping of weapons and styles; DMC5 has swappable Devil Breaker arms.
- DMC3 styles: Trickster (dodging: dash upgrades, wall run, teleport), Swordmaster, Gunslinger, Royal Guard (timed block that stores energy for retaliation); style does not change base moves, it changes approach; styles level up through use.
- Lock-on: DMC3 holds a shoulder button to lock on and a stick-click to change target (GameRevolution FAQ, default PS2 controls).
- Devil Bringer (DMC4): pulls enemy to Nero or Nero to enemy, grapple points, context attacks and parries.
- Aerial combos and dedicated evasion buttons from DMC2.
- Red Orbs: currency for upgrades; DMC3 styles also gain separate experience.
- Bloody Palace: arena survival/endurance mode (DMC2 onward).
- DMC5 auto mode: simplified input that helps perform combos (accessibility option).
- Sources: https://en.wikipedia.org/wiki/Devil_May_Cry; https://en.wikipedia.org/wiki/Devil_May_Cry_3:_Dante%27s_Awakening; https://www.gamerevolution.com/?p=30277
- Verified: partly (lock-on behavior with multiple enemies and exact style-switch rules by game not verified; rest of Wikipedia article beyond 100k chars unread)

## P1-08 and P1-09 - Tournament format and online play (researched 2026-10-28)

#### P1-08 Budokai / Budokai Tenkaichi tournaments
- Budokai 1 World Tournament bracket: tree-style elimination with between 8 and 20 competitors depending on setting; same rules as the anime tournament (source: https://en.wikipedia.org/wiki/Dragon_Ball_Z:_Budokai_(video_game), seen via search snippet) [verified, Wikipedia only]
- Budokai 1 difficulty: three levels, Novice (3 rounds), Adept (4 rounds), Advanced (5 rounds); each must be cleared to unlock the next (source: Wikipedia Budokai page; https://thenortherner.com/news/2003/01/14/fight-to-the-finish-with-dragonball-z-budokai) [verified]
- Budokai 1 rewards: prize money by finishing place (1st or 2nd), spent in the shop on capsules for customizing characters (source: https://www.gamingnexus.com/Article/401/Dragon-Ball-Z-Budokai-; Wikipedia Budokai page confirms money from tournament wins buys custom-fighter abilities) [verified]
- Budokai 1 ring-outs: reviews say reaching the ring edge risks a ring-out loss (source: gamingnexus review above) [verified, review level only; exact rule detail unknown]
- Budokai 3 World Tournament: player fights computer opponents for prizes/cash; three difficulty levels with different opponent counts and better prizes at higher levels (source: https://en.wikipedia.org/wiki/Dragon_Ball_Z:_Budokai_3) [verified; exact counts and prize values unknown]
- Budokai 3 human players: up to 8 humans can join, but with more than one human no prizes are awarded (source: same Wikipedia page, flagged there as needing citations) [verified, weak source]
- Budokai 3 Cell Games: separate tournament in the Cell ring, no ring-outs, fusions allowed (source: same page) [verified]
- Budokai 3 regular tournament ring-out rule: not stated in sources found [unknown]
- Budokai 2 tournament: has a tournament mode and money spent in an item shop; bracket size, difficulty, ring-out, human count [unknown] (source: Wikipedia Budokai page; Giant Bomb page returned 403)
- Budokai Tenkaichi 3: tournaments (Cell Games, World Tournament, Otherworld Tournament) sit inside the Dragon World Tour mode, are unlocked by an in-game clock, and the player cannot pick their difficulty; a guide says the World Tournament uses ring-outs (source: https://worthplaying.com/article/2007/11/3/previews/46455-ps2wii-preview-dragon-ball-z-budokai-tenkaichi-3/ and https://www.supercheats.com/playstation2/dragon-ball-z-budokai-tenkaichi-3/31086/easy-world-tournament/, via search snippets) [verified, low depth]
- Budokai Tenkaichi 1, 2, 3: bracket size, time limit, judging on time-out, prize money, human-player count, AI fill [unknown] (no accessible source; Fandom and Giant Bomb were blocked)
- Budokai 1/2/3 time limit and time-out judging [unknown]
- Canon (anime/manga) tournament rules, useful as design model: loss by touching ground outside the ring, a ten-count knockout, or giving up; preliminary mini-tournaments use one-minute matches decided by points (source: https://www.kanzenshuu.com/wiki/21st_Tenka'ichi_Bud%C5%8Dkai and https://smashbroslawlorigins.fandom.com/wiki/World_Martial_Arts_Tournament, via search snippets) [verified for canon, not for the games]

#### P1-09 Online play for fighting games in the browser
- Delay-based netcode: holds local input back so it lines up with remote input; the sim cannot advance until all inputs for a frame arrive, so high latency causes freezes (source: https://en.wikipedia.org/wiki/Netcode) [verified]
- Rollback netcode: local input runs at once, remote input is predicted (usually "same as last tick"); on a wrong guess the state is restored and re-simulated; some games add a small fixed input delay to cut visible jumps (source: https://en.wikipedia.org/wiki/Netcode) [verified]
- GGPO: predicts the remote input, advances immediately, and rolls back and re-simulates when the real input differs; rollback frames are not drawn; GGPO's own text puts the no-prediction lag at about 1 to 9 frames at 60 fps (5 to 150 ms) (source: https://github.com/pond3r/ggpo/blob/master/doc/README.md) [verified]
- GGPO sync test: a mode that checks your save/step code is deterministic (source: same README) [verified]
- GGPO desync detection: only via mismatch of predicted vs real input; no checksum exchange described in the README (source: same README) [verified]; typical checksum practice (peers exchange a state hash every N frames) [unknown, not sourced]
- Typical input delay and rollback-window frames in shipped games (for example 2 frames delay, 7-8 frame max rollback) [unknown, not sourced]
- Rollback games listed on Wikipedia: Street Fighter V, Killer Instinct, Mortal Kombat 11, Guilty Gear Strive, Street Fighter 6, Tekken 8, Dragon Ball FighterZ (source: https://en.wikipedia.org/wiki/Netcode) [verified]
- Skullgirls skips one frame every seven so drifting machines resynchronize (source: same page) [verified]
- Peer count / spectators in fighting games: [unknown, not sourced]. Fighting games are normally 2 peers; spectators not covered by sources found.
- RTCDataChannel unreliable/unordered: createDataChannel with ordered:false plus maxRetransmits:0 (or maxPacketLifeTime) gives unordered, no-resend delivery; only one of the two limits may be set or a SyntaxError is thrown (source: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel) [verified]
- CSP connect-src scope: MDN lists fetch, XHR, WebSocket, EventSource, sendBeacon, ping, fetchLater; RTCPeerConnection is not listed (source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src) [verified]
- CSP3 spec defines a `webrtc` directive (values 'allow' / 'block', section 6.2.1) and a pre-connect check, but it is still draft (source: https://www.w3.org/TR/CSP3/) [verified for existence]; spec text of the directive was not read
- webrtc directive browser support: one third-party doc site says Chrome, Firefox and Safari do not implement it, and that data channels bypass connect-src (source: https://next.centralcsp.com/en/docs/web-security/policies/content-security-policy/directives/webrtc; 2018 W3C thread https://lists.w3.org/Archives/Public/public-webrtc/2018Jan/0109.html agrees connect-src does not cover data channels) [verified, weak: single secondary source]; MDN page for the directive returned 404
- Practical consequence: a strict page CSP with connect-src 'none' should not block WebRTC today, but this may change if `webrtc` ships [partly verified, see above]
- Host candidates need no STUN: they come from binding local interface addresses (source: https://www.rfc-editor.org/rfc/rfc8445, section 5.1.1.1) [verified]
- mDNS host candidates: browsers replace local IPs with random UUID.local names; the remote peer resolves them via multicast DNS, so same-LAN peers can connect directly; if mDNS is blocked or resolution fails, ICE falls back to NAT hairpinning or TURN; the draft's own tests all configured a STUN server, so the no-STUN case is not directly confirmed (source: https://datatracker.ietf.org/doc/html/draft-ietf-rtcweb-mdns-ice-candidates) [verified; no-STUN LAN case inferred]
- Without TURN: peers behind symmetric NAT or UDP-blocking firewalls generally cannot connect; with only host candidates it works on the same network only (source: MDN connectivity page https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity covers candidate types; the failure statements are general knowledge and not stated there) [partly verified]
- Copy-paste signaling: no source needed; offer/answer SDP is plain text, but trickle ICE must be waited out (gather all candidates before copying) [unknown, not sourced]
- Recommendation for P12-02: use delay-based lockstep first. With 60 Hz deterministic sim, a star topology of 2-4 peers and LAN first, one-way latency is about 1-5 ms, so a fixed input delay of 2-3 frames (about 33-50 ms), raised automatically to 4-6 frames for WAN, is enough and avoids storing/restoring state for up to 4 fighters. The host collects inputs for frame N+delay from every peer, relays the full set, and each peer steps only when it has all inputs; stall the sim if one is missing. Send inputs redundantly (last few frames in each packet) over an ordered:false, maxRetransmits:0 data channel so loss costs nothing. Exchange a state checksum every ~60 frames to detect desync early. Rollback is a later upgrade only if the sim exposes cheap save/restore, because with 3-4 peers the prediction misses multiply.

## P1-02 - Normalized reference table (2026-10-28)

One row per distinct mechanic from the P1-01 entries; mechanics marked unknown there are left out.

Built only from the Appendix B research log (24 games) and the BREAKPOINT "Current state" section, plus a search of breakpoint.html for the "In BREAKPOINT" column. 45 distinct mechanics. Mechanics marked unknown in the log are not rows. Game names are shortened: DOA = Dead or Alive, VF = Virtua Fighter 4/5, MK = Mortal Kombat, DMC = Devil May Cry, MFE = Midnight Fight Express, DHA = Die Hard Arcade, Deka EX = Dynamite Deka EX, Streetwise = Final Fight: Streetwise, Budokai = Dragon Ball Budokai / Budokai Tenkaichi series (from P1-08).

| Mechanic | Games | Modern Urban fit (yes/no) | Mobile complexity (low/medium/high) | In BREAKPOINT (yes/partial/no) |
|---|---|---|---|---|
| Small attack button set (punch, kick, grab, guard; 3-4 buttons, no extra layers) | Tekken, DOA, VF, Fighting Force, Dynamite Cop, Power Stone 2, Sleeping Dogs, MFE, Def Jam | yes | low | yes |
| Tap = weak / hold = strong attack, with the button choosing attack height (high / mid / low) | The Bouncer | yes | medium | partial (strong and height exist as modifier inputs) |
| Knockdown flow: launchers, air juggles with a limit, recovery roll / quick rise | Tekken, VF, The Bouncer, Shaolin Monks, Urban Reign | yes | low | yes (JUGGLE_LIMIT 3, launch moves, quick rise) |
| Sidestep / free 3D evade | Tekken, DOA, VF, Urban Reign | yes | low | yes (SIDESTEP state) |
| Invincibility-frame dodge or lean / duck deflect instead of blocking (God Hand right-stick dodge, Sifu dodge and deflect, MFE dodge, DMC evasion, Trickster dodge core) | God Hand, Sifu, MFE, DMC | yes | medium | partial (sidestep exists; no i-frame sway) |
| Dedicated block with a timed perfect block / parry window | MK, VF, DOA, Tekken, Urban Reign, MFE, Sifu, Sleeping Dogs, DMC (Royal Guard) | yes | medium | yes (blockHigh / blockLow, 6-tick perfect block) |
| Auto-guard: standing guard covers high and mid, crouch covers low (no separate high / low buttons) | Tekken | yes | low | partial (two separate block buttons today) |
| Counter-attack opened by a timed defense (parry or counter, then a free hit) | Tekken, DOA, Urban Reign, MFE, Sifu, Sleeping Dogs | yes | medium | partial (perfect block exists, AI punishes blocked attacks; no player counter follow-up) |
| Direction-matched counter hold (guard + direction must match the attack height / type) | DOA, Tekken | yes | high | no |
| Guard break / break bar: blocked hits wear the defender's guard down until it breaks | Sifu (structure bar), Def Jam (second health bar) | yes | low | partial (gb-flagged attacks and stamina exist; no break bar) |
| Combo-extender and armor properties: bound, wall bound, power crush (uninterruptible move) | Tekken, VF | yes | low | partial (juggle and wall slam exist; no bound or armor) |
| Strike / throw / guard triangle with a throw escape or clash window | DOA, VF | yes | low | yes (grapple, escape window, block) |
| Grip-dependent throws (front / rear / low, flank harder) and throws into scenery or walls | Tekken, Urban Reign, Sleeping Dogs, Def Jam, Dynamite Cop, DOA | yes | low | yes (front / rear / low grips, wall slam, AI throws into walls and objects) |
| Grab strikes (elbow, knee) and grab chains | Dynamite Cop, The Warriors | yes | low | yes (CLINCH_MOVES knee / elbow, CLINCH_STRIKE_MAX 2) |
| Submission holds that wear down one body part, ending in submit or escape | Def Jam, Dynamite Cop | yes | medium | no |
| Automatic boost state: comeback damage boost near defeat, or a meter filled by hits, counters and dodges that gives a short stronger state; also pickup-fed power-up chain | Tekken (Rage / Heat), The Warriors (rage meter), God Hand (tension gauge, non-supernatural core), Dynamite Cop (power-up chain) | yes | low | no |
| Resource-spent specials and context finishers (heat actions with quick-time events, Blazin moves, two-button special arts, taunt-for-meter, health-costing special) | Yakuza, Def Jam, Urban Reign, God Hand, Fighting Force | yes | high | no |
| Knockout / break finisher cinematic (per-style finisher, slow motion) | Def Jam, Sifu | yes | low | no |
| Multi-enemy brawling in waves or rooms ending in a boss (up to about 6 on screen) | Urban Reign, The Warriors, Fighting Force, Crisis Beat, DHA, Shaolin Monks, Dynamite Cop | yes | low | no |
| Lock-on with target switch | God Hand, DMC | yes | medium | no |
| Area attack and combos that hit or carry across several enemies (360 spin, multi-hit) | Dynamite Cop, Urban Reign, Shaolin Monks | yes | medium | partial (wide sweep kicks; no crowd-clearing move) |
| 2-4 player co-op and free-for-all in one scene | Urban Reign, The Warriors, Power Stone, DHA, Crisis Beat, Shaolin Monks, Def Jam | yes | low | partial (Versus, 2 players, one screen) |
| Partner systems: AI allies with orders, tag partner switching | Urban Reign, The Warriors, Beat Down, DOA, Tekken | yes | high | no |
| Camera that frames several fighters | Power Stone, Urban Reign | yes | low | partial (camera frames two fighters) |
| Pick up, drop and throw objects and weapons | Urban Reign, The Warriors, Fighting Force, Dynamite Cop, MFE, Power Stone, Def Jam, Sleeping Dogs, DHA, Crisis Beat, Yakuza | yes | medium | no |
| Weapons with their own move sets and limited durability (breaking, vanishing) | Sleeping Dogs, DHA, MK (weapon styles), Urban Reign, Yakuza, Crimson Tears | yes | low | no |
| Destructible props yield weapons or parts (tear out posts, open car trunks) | Fighting Force, Dynamite Cop | yes | low | no (objects break into debris, no weapon yield) |
| Restorative pickups (food, shield, flash heal / revive) | Power Stone, The Warriors | yes | low | no |
| Carried-item management: firearms with aim and fire, item combining, swapping weapons or styles mid-fight | Sleeping Dogs, MFE, Fighting Force, Dynamite Cop, DHA, DMC, Def Jam, Yakuza | yes | high | no |
| Stage hazards (danger zones, instant-kill pits, passing train, explosives) | DOA, Shaolin Monks, Def Jam, Sleeping Dogs | yes | low | no |
| Multi-level arenas with falls and fall damage, floors and balconies that break or collapse | DOA, Tekken (6, Tag 2), Power Stone, VF (breakable wall) | yes | low | no |
| Destructible walls and arena objects | Tekken, VF, DOA, Fighting Force, Shaolin Monks | yes | low | yes (wood, concrete, metal, glass, paper) |
| Ring-out loss by leaving the ring | Budokai series | yes | low | no |
| Crowd and bystander reactions (shove back, hold, offer weapons) | Def Jam | yes | low | no |
| Elimination-bracket tournament with tiers and prize rewards | Budokai series, Yakuza (Coliseum) | yes | low | no |
| Survival / endurance and practice modes | DMC (Bloody Palace), Tekken, MFE | yes | low | yes (Survival, Training) |
| Story structure: branches by chosen character or route, consequences, rival or boss chosen to counter the player | The Bouncer, Fighting Force, DHA, Beat Down, Crisis Beat | yes | low | no (fixed Arcade ladder) |
| Unlockables earned by play (fighters, items, modes, difficulty, cosmetics) | Dynamite Cop, Crisis Beat, VF, Sleeping Dogs, Power Stone, MFE | yes | low | partial (2 fighters unlock) |
| Progression economy: XP or skill points, shop, gym training, gear with stat effects, move assignment | Final Fight Streetwise, God Hand, MFE, The Bouncer, Sleeping Dogs, Def Jam, Shaolin Monks, Yakuza | yes | high | no |
| Costume customization (cosmetic outfits) | DOA, VF, Def Jam, Sleeping Dogs, MFE | yes | low | partial (Outfit tab in the creator) |
| Performance grade / style rank after a fight or mission | DMC, MFE | yes | low | no |
| Auto-assist input option (simplified combos) | DMC | yes | low | no |
| Side systems: quick-time events, mini-games, negotiation and recruiting, open-world crime / hub / random encounters | DHA, Yakuza, Streetwise, Beat Down, The Warriors, Sleeping Dogs | yes | high | no |
| Aging on death (character ages with each defeat; effects disputed in sources) | Sifu | yes | low | no |
| Supernatural powers and gore finishers: roulette / orb special moves, power-up transformations, demon forms, teleport and wall-run, pull powers, fatalities / animalities / brutalities | God Hand, Power Stone, DMC, Dynamite Deka EX, MK | no | high | no |

## Appendix C - Decision log

(Filled by DECIDE tasks and measurement tasks. One entry per task ID: decision or numbers, reason, date.)

### P0-01 - Baseline commit (2026-10-28)

- Baseline = commit `c760489` (main), annotated tag `breakpoint-1.0.0-baseline`. `breakpoint.html` there is VERSION '1.0.0', 585241 bytes in the repository (LF), 594996 bytes in the Windows working copy (CRLF).
- Reason: every later change can be compared with, or rolled back to, this tag.

### P0-04 - Low-spec performance method and baseline (2026-10-28)

- Target device class: low-spec Android phone (about 4x slower CPU than a desktop i5-9600K, weak GPU), landscape 640x360 CSS px, browser Chrome.
- Target frame rate: 60 fps. Pass rule: frame interval p95 <= 18 ms and main-thread work p95 <= 8 ms (half the 16.7 ms frame, leaves room for the GPU and the browser).
- Test scene: `BREAKPOINT.benchmark(seconds)` from the main menu (default 10 s plus 1 s warm-up). It picks the arena with the most destructible objects (now `warehouse`), runs two Expert AI fighters (current maximum: 2) and smashes every object again every 2 s so debris stays at the quality cap. Real rendering, real HUD.
- Metrics returned: frame interval p50 / p95 / max, main-thread work per frame p50 / p95 / max (simulation start to render submit; not capped by vsync), draw calls, instances, debris, particles (peaks), JS heap (Chrome only), startup time, quality level, render scale, resolution. File size: bytes of `breakpoint.html` on disk.
- Low-spec emulation (repeatable on a desktop): Playwright Chrome, viewport 640x360, CDP `Emulation.setCPUThrottlingRate` 4, setting `quality: 'low'`. A real-device row is added in P16-03.
- Baseline (Chrome 156, i5-9600K, after the P0-05 / P0-06 additions, which do not run during play):

| Run | Frame p50 / p95 / max (ms) | Work p50 / p95 / max (ms) | Draws | Instances | Debris | Particles | Heap (MB) | Startup (ms) | Quality / scale / resolution |
|---|---|---|---|---|---|---|---|---|---|
| Desktop 1280x720, auto quality | 16.7 / 16.8 / 17.0 | 1.1 / 1.7 / 3.7 | 12 | 476 | 79 | 233 | 10.4 | 87 | high / 1.0 / 1280x720 |
| Low-spec emulation | 16.7 / 16.8 / 16.9 | 3.2 / 4.5 / 13.0 | 10 | 262 | 60 | 140 | 9.9 | 162 | low / 0.6 / 384x216 |

- File size baseline: 585241 bytes (LF, repository). Headless AI vs AI simulation speed: one 38 s match in 35 ms.

### P0-05 - Performance overlay (2026-10-28)

- The existing overlay (setting "Performance overlay", `showStats`) now also shows frame time p50 / p95 over the last 240 frames. The URL flag `?perf` or `#perf` shows it without changing the saved setting. Off by default.

### P0-06 - Headless AI vs AI runner (2026-10-28)

- `BREAKPOINT.simulate(opts)` from the main menu (code: `SimRunner.run`). Options: `playerId`, `opponentId`, `arenaId`, `difficulty` (both sides) or `difficulty1` / `difficulty2`, `seed`, `winsNeeded`, `timer`. Both sides deal unscaled damage (`evenDamage`), so the result shows the fighters, not the CPU difficulty bonus.
- Returns winner (0 / 1, -1 if the 15-minute cap is reached), seconds, ticks, rounds, wins, health left and damage dealt per move type per side (`punch`, `kick`, `heavy`, clinch categories, `ground`, `throw`, `other` = walls, objects, chip).
- Runs with no rendering, sound, effects or HUD (event listeners are swapped out for the run). Self-test case "Headless AI vs AI runner" checks a seeded match ends with a winner and the same seed gives the same result.

### P1-03 - Best ideas not already implemented (2026-10-28)

- Rule (owner): accept only mechanics with Modern Urban fit = yes and mobile complexity low or medium, or that replace an existing mechanic without adding inputs. Mechanics already fully in BREAKPOINT are not listed again.
- Notes: grab knee / elbow strikes already exist (CLINCH_MOVES, 2 strikes per clinch), so P3-03 only adds per-style animations. Two rejections are judgment calls (bound / wall-bound duplicates the juggle limit and wall slam; aging on death duplicates the Age slider P6-04). The three new tasks add systems: the owner may drop them.

Rule applied: accept = fit yes AND mobile low or medium, OR replaces an existing mechanic without adding inputs. "Already in" = In BREAKPOINT is yes. Overlaps resolved: accept one, reject the other.

Already in (not accepted again): small attack set, knockdown flow (juggles, launchers, quick rise), sidestep, block with perfect-block window, strike / throw / guard triangle with escape, grip throws and throws into scenery, grab strikes (knee / elbow, 2 per clinch), destructible walls and objects, survival and practice modes.

Accepted:

| Mechanic | Reason (one line) | Task |
|---|---|---|
| Tap / hold strength with button-set height | Replaces the strong and height modifier inputs without adding an input. | P2-01 |
| Invincibility-frame dodge / lean deflect = Sway | Fits, one `defend` input, replaces dash and the second block button; lean deflect is folded into sway. | P3-01, P3-02 |
| Auto-guard: stand = high + mid, crouch = low | Replaces blockHigh / blockLow with one `defend` without adding inputs. | P2-01, P3-02 |
| Counter-attack after a timed defense | Fits, uses existing inputs; direction-matched counter hold is not taken. | P3-02 |
| Guard break via stamina and the existing gb attacks | Fits, no new input; no extra bar, the stamina bar is the break resource. | P3-02 |
| Submission holds | Fits, medium (grab + escape contest on existing inputs); owner asked for submissions. | P3-04, P3-05 |
| Automatic boost state (comeback / momentum) | Fits, low (automatic, no input); taunt and meter-spent specials are rejected as duplicates. | NEW P3-09 |
| Knockout / break finisher cinematic | Fits, low (plays on the final KO, no input); belongs to the diegetic feedback list. | P13-01, P13-02 |
| Multi-enemy waves / rooms ending in a boss | Fits, low; core of the hybrid direction. | P4-01, P4-02, P10-06 |
| Lock-on with target switch | Fits, medium (one new `lock` input already planned). | P4-03, P4-04, P4-05 |
| Area attack hitting several enemies | Fits, medium; needed to deal with crowds; one wide-arc signature move per style. | P5-01 |
| 2-4 player co-op and free-for-all | Fits, low; already an owner requirement (up to 4 local and online). | P4-07, P11-02, P12-03 |
| Camera framing several fighters | Fits, low; required once N fighters share a scene. | P4-06 |
| Pick up, drop and throw objects | Fits, medium (one `use` input already planned). | P7-02, P7-03 |
| Weapon move sets with durability | Fits, low (same attack buttons). | P7-01, P7-04 |
| Destructible props yield weapons | Fits, low; gives realistic weapon placement. | P7-06, P8-02 |
| Restorative pickups | Fits, low (walk over to take); heals / revive are part of the item list. | P7-01 |
| Stage hazards | Fits, low; triggered by throws and hits, no input. | P7-05 |
| Falls, breakable floors, collapsing stages | Fits, low; owner asked for falling and breaking stages. | P3-07, P8-04 |
| Ring-out | Fits, low; optional rule for 1v1 tournament levels. | P8-05, P11-01 |
| Crowd and bystander reactions | Fits, low; automatic, no input. | P9-01, P13-01 |
| Elimination tournament with tiers and rewards | Fits, low; owner asked for a Budokai-style tournament. | P11-01 |
| Story branches and rival chosen against the player | Fits, low; matches Country / Origin / Goal beats. | P10-03, P10-06 |
| Unlockables earned by play | Fits, low; owner asked for clear unlocks. | P10-05 |
| Cosmetic costume customization | Fits, low; owner asked for new customization items. | P6-01, P6-02 |
| Performance grade after a fight | Fits, low (result screen only, no input). | NEW P10-07 |
| Auto-assist input option | Fits, low; helps phone players with no extra on-screen button (setting only). | NEW P2-09 |

Rejected:

| Mechanic | Reason (one line) |
|---|---|
| Direction-matched counter hold | Mobile complexity high (direction and timing together); duplicate of counter-attack after a timed defense. |
| Bound, wall bound, power crush | Duplicate of the juggle limit and wall slam already in; adds tuning load without a new decision for the player. |
| Resource-spent specials, heat finishers, taunt-for-meter | Mobile complexity high (extra input or quick-time events); duplicate of the automatic boost state; taunt as an emote stays in P5-05. |
| Partner systems: AI allies with orders, tag switching | Mobile complexity high (orders or switch input); duplicate of 2-4 player co-op, where AI can fill slots. |
| Carried-item management: firearms, item combining, weapon / style swap | Mobile complexity high (aim, fire, combine or cycle input); one held item with `use` is the design. |
| Progression economy: XP, shop, gym, gear stats, move assignment | Mobile complexity high (menus, move-assign UI); duplicate of unlockables and adds a balance axis. |
| Side systems: quick-time events, mini-games, negotiation, open-world crime and hub | Mobile complexity high (timed prompts, extra menus); outside the fighter / brawler scope. |
| Aging on death | Duplicate of the Age slider (P6-04) and Arcade continues; sources disagree on the effect. |
| Supernatural powers and gore finishers | Fails Modern Urban fit (sci-fi / fantasy / supernatural). |

New tasks proposed:
- P2-09 (added to its phase) - Optional auto-assist input setting (off by default): repeated taps on Punch or Kick chain the fighter's next valid string move automatically; no new input, no new on-screen button. / Done when: the setting exists in Settings and is saved; with it on, tapping Punch 3 times plays the style's 3-hit string on touch, gamepad and keyboard; with it off, behavior is unchanged; a self-test covers both.
- P3-09 (added to its phase) - Automatic momentum boost: a gauge filled by landing hits, perfect blocks / sways and taking hits, giving a short stronger-damage state when full; same rules for AI; no extra input; shown on the fighter (pose / breathing, no glow, no sci-fi look) plus one thin bar. / Done when: rules and values are in Appendix C; the boost triggers and ends as defined in the P0-06 headless runner; with it on, no style pair's win rate leaves the P14-01 target.
- P10-07 (added to its phase) - Fight results grade: a letter or star grade from time, damage taken and move variety, shown on the results screen; no input; best grade per mode saved in Progress. / Done when: the grade comes from one pure function, is shown on RESULTS, is saved and migrates from the 1.0.0 Progress, and a self-test checks three sample fights.

### P1-04 - Martial arts styles (2026-10-28)

- The 7 existing style ids stay (old saves and share codes keep working); 9 styles are added. Block / Sway defaults are design choices, balanced later in P3-02 and P14-04. Savate and Silat are the first candidates if more styles are wanted.

#### P1-04 style list (decision)

Decision: 16 styles in 7 families. The 7 existing move styles are all kept (same ids, so old saves keep working) and 9 are new. Defense type below is only the DEFAULT for a new character of that style; the creator may change it (P3-01), a character still has exactly one.

| Style | Family | Signature traits (own words) | Default defense + reason | Replaces / extends existing | Shared animations with |
|---|---|---|---|---|---|
| Boxing (boxer) | Hand striking | Hands-only; tight high guard and tucked chin; jab-cross-hook-uppercut strings; bounce on the balls of the feet; head movement (slip, bob, weave) instead of kicks | Sway - real boxers defend mostly by slipping and bobbing | Extends `boxer` (keep id) | Western punch set shared with Kickboxing, Muay Thai, MMA, Street Brawler, Krav Maga |
| Wing Chun | Hand striking | Narrow, high stance with elbows in; guards the centre line; fast chain punches; traps and pins the opponent's arms at very short range; low, quick kicks only | Block - parry-and-strike deflection is its core defense | NEW | Chain punch is its own; shares straight-punch base with Boxing; traps shared with Kali (live hand) and Hapkido |
| Kickboxing (kickboxer) | Clinch kickboxing | Upright long guard; boxing punches blended with karate-style and Thai-style kicks; rhythmic lead-leg bounce; body knees and short clinches | Block - raised guard and shin cover both punches and kicks | Extends `kickboxer` (keep id, stays the default style) | Punches from Boxing; round kick from Karate/Muay Thai; knee strike from Muay Thai |
| Muay Thai | Clinch kickboxing | "Eight limbs": fists, elbows, knees, shins; neck clinch with knee strikes; push-kick (teep) to hold distance; round kick with the shin; blocks round kicks by lifting the shin | Block - shin check and forearm cover are its signature defense | NEW | Punches from Boxing; clinch/knee/elbow set shared with Kickboxing, MMA, Krav Maga; grab knee/elbow (P3-03) is its showcase |
| Karate (karateka) | Kicking arts | Long, low, still stances; sharp straight punches (reverse punch); crisp front, round and side kicks; hard blocks (uke) then counter; full-contact Kyokushin flavour | Block - hard blocking is the defining karate defense | Extends `karateka` (keep id) | Linear kick set shared with Taekwondo; blocks shared with Kickboxing |
| Taekwondo | Kicking arts | Kicks are the main weapon, hands support; head-height kicks; fast jumping and spinning kicks; light bouncing footwork and distance control | Sway - it avoids by distance and angle rather than blocking | NEW | Linear kicks shared with Karate; spinning/jump kicks shared with Capoeira (variant pivot) |
| Capoeira | Kicking arts | Constant rocking step (ginga); dodges low and to the side (esquiva); low spinning kicks; handstands, cartwheels and inverted moves; almost no hand strikes | Sway - evasion is the whole art | Extends `capoeira` (keep id) | Round kick base shared with Taekwondo; low sweep with Judo/Wrestling takedown family only as a trip |
| Wrestling (wrestler) | Throws and takedowns | Low level, wide base, hands up hunting for ties; single/double-leg takedowns and body-lift throws; pins and top control; no strikes in the sport | Block - hand fighting and sprawling absorb and stop attacks | Extends `wrestler` (keep id) | Takedown and lift set shared with Judo, Sambo, MMA; ground control shared with BJJ |
| Judo (judoka) | Throws and takedowns | Upright relaxed stance; grip fighting on collar and sleeve; off-balance then throw (hip, shoulder, foot sweep, sacrifice); hold-downs, chokes and arm locks on the ground | Sway - judo uses body shifting to dodge and set up counter throws | Extends `judoka` (keep id) | Throw set shared with Wrestling, Sambo, Hapkido (judo-derived); newaza shared with BJJ |
| Sambo | Throws and takedowns | Soviet military/police origin; wrestling-judo mix in a jacket; throws then ground control; leg locks and heel hooks; combat version adds strikes | Block - tough, forward, stand-your-ground military style | NEW | Throws from Judo/Wrestling; leg locks shared with BJJ; combat strikes from Boxing/Kickboxing |
| Brazilian Jiu-Jitsu | Locks and submissions | Fights well from the back (guard); sweeps to reverse position; pins (side control, mount, back); chokes and joint locks to make the opponent tap; pulls guard instead of throwing | Sway - guard retention and hip movement slip pressure rather than blocking | NEW | Submission set shared with Hapkido (arm/wrist locks) and Sambo (leg locks); ground states shared with Wrestling, Judo, MMA |
| Hapkido | Locks and submissions | Korean self-defense mix; wrist and elbow locks; judo-style throws; low sweeping and spinning heel kicks; circular movement redirects force; cane as a training weapon | Sway - circular evasion and redirection | NEW | Wrist/elbow locks with BJJ and Krav Maga; throws with Judo; kicks with Taekwondo |
| Kali / Eskrima | Weapon styles | Philippine art built on the rattan stick (baston); numbered angles of attack; fast double-stick weaving (sinawali) and flow drills; the empty "live hand" traps, locks and disarms; same movement with empty hands and improvised tools | Sway - uses footwork and body angle to take the body off the line of the strike | NEW | Stick moves = weapon move set (P7); live-hand traps shared with Wing Chun; disarms shared with Krav Maga |
| Krav Maga | Hybrid and street | Israeli military self-defense; blocks and counter-strikes in one motion; very aggressive finish once a fight starts; hits vulnerable targets (eyes, throat, groin, knees); defends against weapons; uses nearby objects as weapons | Block - "defend and strike at once" is its core idea | NEW | Punch set (Boxing), knee/elbow (Muay Thai), disarms (Kali), wrist locks (Hapkido), object use (P7) |
| MMA | Hybrid and street | Cage sport mixing striking and grappling; uses takedowns, clinch work, submissions; ground-and-pound (strikes on a downed foe); fighter switches between ranges | Block - a high guard plus sprawl suits the all-range mixed game | NEW | Punch set (Boxing), kicks (Kickboxing), takedowns (Wrestling), submissions (BJJ); mostly reuses, few unique moves |
| Street Brawler (brawler) | Hybrid and street | Unsanctioned, unschooled fighting: loose square stance, heavy looping swings, shoves, headbutt-style closing, wild and slow to recover; no formal technique | Block - instinctive covering up and taking hits | Extends `brawler` (keep id) | Looser version of the Boxing punch set; shove/grapple from Wrestling |

Old-save mapping (P5-03): boxer -> Boxing, kickboxer -> Kickboxing, karateka -> Karate, wrestler -> Wrestling, judoka -> Judo, brawler -> Street Brawler, capoeira -> Capoeira. Creator archetypes keep their current default style (balanced=kickboxer, striker=boxer, kicker=karateka, brawler=brawler, grappler=wrestler, counter=judoka, speedster=capoeira).

Default defense counts: Sway 7 (Boxing, Taekwondo, Capoeira, Judo, BJJ, Hapkido, Kali), Block 9 (the rest). Both types are well represented for the P3-02 balance test.

#### Families

| Family | Styles | Shared animation set |
|---|---|---|
| Hand striking | Boxing, Wing Chun | Punch set: jab, cross, hook, uppercut (Boxing); Wing Chun adds chain punch, trap, pin. This punch set is also reused by Kickboxing, Muay Thai, MMA, Krav Maga, Street Brawler (Street Brawler uses a looser, slower variant) |
| Clinch kickboxing | Kickboxing, Muay Thai | Boxing punches + round kick + knee + elbow + neck clinch; Muay Thai adds shin check and teep (push kick) |
| Kicking arts | Karate, Taekwondo, Capoeira | Kick set: front, round, side, hook, spinning; per-style variants of chamber, pivot and height (Karate crisp and linear, Taekwondo high/jumping, Capoeira low/inverted) |
| Throws and takedowns | Wrestling, Judo, Sambo | Grip/tie-up entry, off-balance, hip throw, shoulder throw, leg takedown, sweep, pin; Wrestling = leg shots and lifts, Judo = collar-sleeve throws and sacrifice throws, Sambo = both plus a leg lock finish |
| Locks and submissions | Brazilian Jiu-Jitsu, Hapkido | Submission set (P3-04): arm lock, wrist lock, choke, leg lock; ground states (guard, mount, side control, back); BJJ = ground-first, Hapkido = standing wrist/elbow locks and throw-lock combinations |
| Weapon styles | Kali / Eskrima | Stick set: numbered angle strikes (forehand/backhand diagonals, thrusts), block-and-strike, double-stick weave if two sticks are held, disarm; same footwork empty-handed |
| Hybrid and street | Krav Maga, MMA, Street Brawler | Mostly reuses other families: punch set, knee/elbow, takedown, ground strike (ground-and-pound), improvised-object strike; few unique animations (Krav Maga defend-and-strike, MMA sprawl) |

Family count: 7. Each style belongs to exactly one family (its primary one); the "Shared animations with" column in the style table lists the cross-family reuse.

#### Sources
- Boxing: https://en.wikipedia.org/wiki/Boxing
- Muay Thai: https://en.wikipedia.org/wiki/Muay_Thai
- Kickboxing: https://en.wikipedia.org/wiki/Kickboxing
- Karate: https://en.wikipedia.org/wiki/Karate
- Taekwondo: https://en.wikipedia.org/wiki/Taekwondo
- Wing Chun: https://en.wikipedia.org/wiki/Wing_Chun
- Wrestling: https://en.wikipedia.org/wiki/Freestyle_wrestling
- Judo: https://en.wikipedia.org/wiki/Judo ; https://www.ijf.org/history (International Judo Federation)
- Brazilian Jiu-Jitsu: https://en.wikipedia.org/wiki/Brazilian_jiu-jitsu
- Sambo: https://en.wikipedia.org/wiki/Sambo_(martial_art)
- Hapkido: https://en.wikipedia.org/wiki/Hapkido
- Kali / Eskrima: https://en.wikipedia.org/wiki/Eskrima
- Krav Maga: https://en.wikipedia.org/wiki/Krav_Maga
- Capoeira: https://en.wikipedia.org/wiki/Capoeira
- MMA: https://en.wikipedia.org/wiki/Mixed_martial_arts
- Street Brawler: https://en.wikipedia.org/wiki/Street_fighting (general definition only; techniques are the game's own caricature)
- Rejected styles checked: https://en.wikipedia.org/wiki/Savate ; https://en.wikipedia.org/wiki/Pencak_silat ; https://en.wikipedia.org/wiki/Jeet_Kune_Do
- Not confirmed by the pages fetched (written from general knowledge, flagged): Wrestling single/double-leg shots and sprawl; Wing Chun is only partly "hand striking" because trapping is grappling-like; defense defaults are design judgments, not facts about the arts.

#### Notes
- Savate (French boot kicking + boxing): rejected, overlaps Kickboxing (boxing punches plus kicks); could become a Kickboxing variant later.
- Pencak Silat (Indonesian strikes, sweeps, locks, weapons): rejected for count; its sweeps/locks are covered by Hapkido and Capoeira, its blades fail the "urban, non-lethal" weapon limit.
- Jeet Kune Do: rejected as a separate style; it is a concept (Wing Chun + boxing + fencing), covered by MMA/Wing Chun/Boxing.
- Aikido: rejected, overlaps Hapkido (joint locks and redirection) and has no sport or competitive use.
- Sumo: rejected, heavy-push tackle belongs to P3-06 and the Wrestling family, not a street style.
- Greco-Roman / catch / folk wrestling, Kyokushin / Shotokan / Kenpo, Taekkyon, Lethwei, Dutch kickboxing: merged into Wrestling, Karate, Taekwondo, Muay Thai, Kickboxing respectively (same technique family).
- Kendo, swords, nunchaku, knives, firearms: rejected, not Modern Urban fit or lethal weapon training (consistent with P1-03 rejection of carried-item management).
- Bartitsu (cane/umbrella), police baton systems: rejected as separate styles; Kali already teaches stick, Krav Maga improvised objects (bottle, chair) and defense against weapons, so they cover the P7 improvised-weapon moves.
- Bokator, Pankration, Systema, Tai Chi, Baguazhang, Kyudo: rejected; low recognition or low fit for fast mobile fights.
- Weapons rule: only Kali carries a stick as its own style item; Krav Maga and Street Brawler use improvised objects through the shared `use` pickup (P7), not their own weapon animations.
- Budget note: the 9 new styles are mostly data rows reusing shared set animations (about 4 genuinely new animation groups: Wing Chun traps, Taekwondo/Capoeira jump-spin variants, BJJ ground set, Kali stick set); this keeps file size low per the global rule.

### P1-07 - Theme audit of existing content (2026-10-28)

- Every item below is reworked by the task in its last column (P9-04 theme fixes, P8-02 arena rework). Share codes store the glow option and titles by position: rename or retire entries without changing array order or length.

#### P1-07 theme audit

Audited breakpoint.html 1.0.0. Rule: "Modern Urban. No sci-fi, fantasy, magic or supernatural elements."
Severity: V = violation, B = borderline (decision needed, default fix given).

| Item | Where (symbol) | Why it conflicts | Fix | Task |
|---|---|---|---|---|
| V. Creator option "Accent glow" (off/on) | LOOK_CHOICES.glow (line ~4416); Fighter.accentGlow (~3226); creator UI row `choiceRow('glow')` (~7952); randomizer `look.glow` (~4623); SHARE_LOOK_KEYS (~4647, index 11 of share code); resolveLook `glow` (~4492); default look `glow:'off'` (~4549); self-test uses `glow:'on'` (~9436) | Makes clothing emit light: glowing belt/sash/headband/mask reads as energy aura / sci-fi cyber-suit, not street clothing. | Remove the option and the `accentGlow` emission. Keep the share-code slot so old BP1 codes still decode: keep index 11 as a reserved field that is read and ignored (append-only rule), or bump SHARE_VERSION. Randomizer: drop the 25% glow roll. Update tests (~9436) and the "Auto-harmony/accent" help text. | P9-04 |
| V. Emissive clothing parts | Fighter.draw: belt `part(... col.accent, glow ...)` (~3891), sash (~3893); drawHead headband (~3941), half mask (~3949), full mask `Math.max(0.25, this.accentGlow)` (~3927) | The `em` argument makes these parts self-lit even with glow off (full mask always emits 0.25). Light-emitting fabric is non-real-world. | Pass em = 0 for all clothing parts (matte/cloth roughness only). Do together with the glow option removal. | P9-04 |
| V. Title "The Phoenix" | TITLES[6] (~4446) | Mythical fantasy creature (rebirth, fire). Selectable in creator and used by random fighters (title index in share code). | Replace with a street/gym nickname, e.g. "The Veteran". Keep array length and order (share-code stores the index). | P9-04 |
| V. Title "The Specter" | TITLES[15] | Supernatural (ghost). | Replace, e.g. "The Closer". Keep index. | P9-04 |
| V. Roster title "The Ghost" (YUKI) | ROSTER[yuki].title (~2726) | Supernatural title. Not a share-code item, safe to rename. | Rename to a skill-based nickname, e.g. "The Slipper" or "The Counter". | P9-04 |
| B. Title "The Titan" | TITLES[12] | Greek-myth giant; mild. | Replace with "The Bruiser" (or keep if owner accepts mythic nicknames). | P9-04 |
| B. Titles "The Storm", "The Cyclone", "The Comet" | TITLES[3], [8], [11] | Weather/space metaphors; common real boxing nicknames, no supernatural meaning. | Keep. Only change if the owner wants strictly mundane nicknames. | P9-04 |
| V. Sci-fi / cosmic / mythic name ideas | NAME_IDEAS: NOVA, XENON, VOLT, UMBRA, HALO, ORION, ZEPHYR (~4448) | Sci-fi/cosmic/video-game-hero tone (xenon, nova, halo, umbra) or wind-god/constellation names. Offered as creator suggestions and used by the random-fighter generator. | Replace with real first names / street nicknames, e.g. DIEGO, TANK, RIZ, MOE, BISHOP, CRUZ, DEACON. Keep list length (index not stored, name is stored as text, safe). | P9-04 |
| B. Name ideas JUNO, IRIS, EMBER, ECHO, ONYX, RAVEN | NAME_IDEAS | Real given names (Iris, Juno) or plain nicknames; EMBER/ECHO/ONYX/RAVEN lean fantasy-gamer. | Replace EMBER, ECHO, ONYX, RAVEN with real names in the same pass; JUNO and IRIS may stay. | P9-04 |
| B. Block / clinch / escape rings | Effects 'block', 'clinch', 'escape' handlers -> `FX.ring` (~6057, 6065, 6067); FX.ring (~2603) | An additive expanding cyan/gold ring on a block reads as an energy shield / force-field pulse, not an impact. Perfect block adds a gold flash. | Replace the ring with a short white impact flash plus a few grey/white sparks and dust at the contact point; for perfect block use a brighter white flash, no ring. Cyan (#9ee7ff) -> white. | P9-04 |
| B. Strike trails | Fighter limb trail `FX.trail(... '#bfe8ff' / '#ffd27a')` (~3632); FX.trail (~2604) | Glowing cyan/gold light streak following fists and feet looks like ki/energy slashes. | Make the trail a faint white/grey motion smear (low alpha, non-additive, shorter), or remove it on light attacks and keep only on heavy attacks. | P9-04 |
| B. Cyan block sparks | Effects 'block' `FX.sparks(... '#9ee7ff')` (~6056) | Blue-cyan sparks suggest electricity/energy; ordinary impact sparks are white/orange. | White sparks (orange-gold already used for guard break is fine). | P9-04 |
| B. ZERO final boss look | ROSTER[zero] (~2734); `hairStyle:'mask'` (legacy full mask), skin #3a3340 (grey-violet), gold #d4af37 accents, all-black outfit | Dark violet-grey skin tone with an always-glowing gold full-face mask can read as a robot/villain/masked-supernatural boss. Name ZERO itself is fine (a fighter alias). | Keep the masked-luchador idea but give a normal skin tone from SKIN_SWATCHES, matte cloth mask (no emission, see item 2), black/gold gym wear. Do not add cyborg/robot lore in Phase 10 story. | P9-04 |
| B. Fluorescent swatches | OUTFIT_SWATCHES: #34dcff cyan, #6dff9c mint, #ff5c93 hot pink, #7d4fd6 violet (~4388); HAIR_SWATCHES #2f6fdd blue, #2fbf71 green (~4387) | Real sportswear and dyed hair come in these colours, so they are not violations alone. They only become sci-fi when combined with glow. | Keep. (Optionally rename none; swatches have no names.) | P9-04 |
| B. Menu/HUD UI palette | CSS :root `--a1:#34dcff; --a2:#ff5c93; --ok:#6dff9c` and panel look (~line 17) | Cyan/magenta neon-on-dark UI chrome has a cyber/synthwave feel. Not game content, but the rule says visuals. | Keep for now; owner decision. If tightened: move to a street-poster palette (white/black/red/yellow) in Phase 13/16. | P9-04 |
| B. Dojo arena | ARENAS.dojo (~1982): shoji paper screens, paper lanterns (orange emissive spheres) | Real-world gym/dojo, not fantasy. Only the "traditional temple" feel could drift toward fantasy Japan if extended. | Keep. In P8-02 rework make it a modern martial-arts gym/dojo (mirrors, mats, lockers, fluorescent lights) so it reads Modern Urban. | Phase 8 |
| B. Pit arena crowd and fire barrels | buildProps 'pit' (~2047): silhouette crowd, barrels with flickering orange spheres | Underground fight-club crowd and burn barrels are real urban. Only watch that the lighting stays warm/orange. | Keep. | Phase 8 |

#### Clean
- Checked and fine: move names (defAttack, CLINCH_MOVES, THROW_SETS), MOVE_STYLE labels and descriptions, VICTORY_POSES (hips, arms, fist, bow, flex, ginga), ARCHETYPES labels/descriptions, other roster names (KAI, MARA "The Viper", BRUTUS "The Wall", DMITRI "The Grappler", KAI "The Balanced"), hair/beard/headband/top/legs/hands/belt/footwear creator options, warehouse arena, MATERIALS and debris, MODE_INFO and menu texts, hit sparks/flash/dust/KO flash (read as impact), sound and music (plain Web Audio synth, scale names only: minor/pentatonic/phrygian, no sci-fi cues), HUD texts and stats, fighter states.

## Appendix D - Audit findings

(Filled by P0-02 and P16-01. Columns: ID, severity, area, location, reproduction, fix task, status.)

### P0-02 - Audit of 1.0.0 (2026-10-28)

Method: four read-only auditors, one per area (input / storage / UI; renderer / world / performance; fighters / combat / AI / roster; game flow / audio / creator / self-test / CSP), each with the severity scale above. Every Critical and High was re-checked against the code before fixing, and each fix was checked in Chrome (self-test plus scripted key, mouse and menu runs). Raw count: 1 Critical, 4 High, 21 Medium, 31 Low, 6 Informational. Functions are named because line numbers move.

| ID | Sev | Area | Location | Reproduction | Fix task | Status |
|---|---|---|---|---|---|---|
| D01 | Critical | Input / rebind | `UI.update`, `UI.startRebind` | Gamepad only: Controls > Rebind: menu frozen. Mouse: Rebind > Back > fight: first key rebinds silently | P0-03 | [x] fixed: pad back cancels; any screen change cancels |
| D02 | High | Input / rebind | `Inputs.onKeyDown` + `UI.onKey` | Esc cancels and also closes Controls; Enter restarts a rebind | P0-03 | [x] fixed: capture stops propagation |
| D03 | High | Accessibility | `UI.optRow` | Screen reader reads an unnamed "spin button" in Settings | P0-03 | [x] fixed: aria-label, aria-valuetext, aria-keyshortcuts |
| D04 | High | Game flow / creator | `CreatorUI.exit` | Char select > Create > Fight preview > Quit > Back > Confirm: MENU -> COUNTDOWN rejected, frozen match | P0-03 | [x] fixed: exit restores CHARSEL |
| D05 | High | Performance / quality | `Quality.adapt` | 50 Hz screen or 30 fps cap (iPhone Low Power Mode): render scale drops to 0.6 with an idle GPU | P0-03 | [x] fixed: judged against the display pace; self-test added |
| D06 | Medium | Quality | `Quality.apply` | Auto lowers scale, then pick High: stays at 60 % | P0-03 | [x] fixed |
| D07 | Medium | Animation | `Fighter.computePose` (walk, run), `VICTORY_POSES.flex` | Code merged into end-of-line comments: arms never swing when walking, right arm frozen when running | P0-03 | [x] fixed (3 lines) |
| D08 | Medium | Determinism | `Combat.landHit` (hitstop halved by Reduced motion) | Same seed, different result with Reduced motion on | P12-05 | open; `SimRunner` pins the setting meanwhile |
| D09 | Medium | Benchmark | `UI.runBenchmark` | Quit during a benchmark: objects keep breaking in the next match | P0-03 | [x] fixed: stops when paused or left |
| D10 | Medium | Creator | `CreatorUI.importCode` | Import over unsaved edits loses them without asking | P0-03 | [x] fixed: unsaved-changes guard |
| D11 | Medium | Accessibility | `Settings.reset` | OS reduced motion on, Reset: Reduced motion off for good | P0-03 | [x] fixed |
| D12 | Medium | Touch / overlay | `#diag` CSS | `?perf` on a phone: overlay blocks the touch stick | P0-03 | [x] fixed: click-through while touch controls show |
| D13 | Medium | Training input | `UI.onKey` | Jump bound to Digit1: each jump reloads scenario 1 | P0-03 | [x] fixed |
| D14 | Medium | Settings UI | `UI.rerender` | Click an arrow in a row: focus and scroll jump to the first row | P0-03 | [x] fixed |
| D15 | Medium | Onboarding | `applyTouchVisibility`, `onboardTouch` | Touchscreen laptop with keyboard: one-time card shows touch help | P2-07 | open |
| D16 | Medium | Error screen | `UI.update`, `showFatal` | Error with only a gamepad: "Return to main menu" unreachable; menu behind overlay still focusable | P0-07 | [x] fixed: pad confirm / back and keyboard work the error screen only |
| D17 | Medium | Colliders | `Arena.breakObject` -> `addRubble` | Pit barrier breaks: 2.7-3 m invisible rubble collider pushes fighters | P8-02 | open |
| D18 | Medium | Object damage | `Arena.damageObject` (`lastSrc`) | Two overlapping attacks on one crate: damage every tick | P9-02 | open |
| D19 | Medium | Throws | `Fighter.startThrow` | Strong throw at 0 stamina keeps x1.5 damage | P3-08 | open |
| D20 | Medium | Loop / errors | `Game.fail` (`errorCount`) | 9th caught error in a session stops the loop for good | P0-07 | [x] fixed: Return to main menu resets the count and restarts the loop |
| D21 | Medium | Self-test health | real matchEnd -> VICTORY -> RESULTS path, preview return | Tests set states directly, so D04 passed 114/114 | P0-07 | [x] fixed: two self-tests (real knock-out to RESULTS; preview return to CHARSEL); the About screen keeps the results |
| D22 | Low | Input / storage | `KeyBindings.load`, `Store.set`, `Progress.save`, `pollPad`, onboarding card, `touchStrike` | Unbound fallback key; one failed write disables storage for the session; two tabs overwrite saves; non-standard pad toast repeats; pad cannot close the controls card; two touch attacks in one tick drop one | P0-07; two tabs: P10-05; touch: P2-04 | [x] fixed for P0-07: unbound key list, write retry with one warning, toast once per pad, pad closes the card. Open: two tabs (P10-05), touch (P2-04) |
| D23 | Low | HUD / a11y | `#warn` under touch stick; `user-scalable=no`; spinbutton Up/Down move focus | Low-stamina warning hidden on touch; no pinch zoom in menus | P2-04, P2-08 | open |
| D24 | Low | Renderer | `WEAK_GPU`, `R.push` culling uses `proj[5]`, shader `vN` precision, per-frame arrays | Strong Linux / Mac GPUs rated low; props vanish at the screen edge in portrait; paper debris shading breaks on 16-bit GPUs; GC churn | P15-02 | open |
| D25 | Low | Combat | `resolveCombat` trade order, `tryEscape` one-tick bias, `blockHit` hp floor, impact / attack id overlap, per-tick allocations | Grab vs strike on the same tick favours P1; P1 gets one more escape tick; block at hp 0.6 sets hp 1 | P3-08 (allocations: P15-02) | open |
| D26 | Low | Storage | `CustomRoster.init` | Corrupt custom data is overwritten by the next save | P6-11 | open |
| D27 | Low | Game flow | `onNextRound` order, `errmenu` skips `quitToMenu`, preview clears the Versus score, menu shows the smashed arena, self-test leaks 4 matches and plays sounds | Auditor notes per item | P0-07; self-test sounds: P16-01 | [x] fixed: round order, error path uses quitToMenu, Versus score kept, menu arena rebuilt, self-test matches disposed. Open: the self-test still plays sounds, because some tests need the live listeners (P16-01) |
| D28 | Low | Benchmark / runner | benchmark used up the onboarding card and left the menu arena; unknown arena threw | `BREAKPOINT.benchmark()` on a new profile | P0-03 | [x] fixed |
| D29 | Info | Various | KO -> IDLE log comes from a deliberate self-test; decider tie goes to P1; share-code trimming is silent; style index in share codes must stay append-only; quick rise uses the dash input; grunt nodes not disconnected; CSP `frame-ancestors` needs an HTTP header if hosted | - | P2-02 (quick rise), P5-03 (style ids), P14-04 (tie), P12-04 (CSP) | noted |
