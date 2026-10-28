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
- [ ] P0-02 - Full audit of the current build. Classify every finding as Critical, High, Medium, Low or Informational (bugs, crashes, input, accessibility, performance, memory, security / CSP, storage, save migration, mobile layout, gamepad, audio).
  Done when: Appendix D lists each finding with severity, location (line or function), reproduction and planned fix task ID.
- [ ] P0-03 - Fix all Critical and High findings from P0-02 that do not depend on later phases.
  Done when: each fixed finding is ticked in Appendix D and the self-test passes.
- [x] P0-04 - Define the low-spec performance method: target device class, target frame rate, test scene (worst case arena + max fighters + max debris), metrics (frame time p50 / p95, JS heap, draw calls, load time, file size).
  Done when: the method and baseline numbers are recorded in Appendix C.
- [x] P0-05 - Add a developer performance overlay (frame time, draw calls, instance count, particle / debris count), hidden unless enabled in settings or a URL flag.
  Done when: the overlay shows the P0-04 metrics and is off by default.
- [x] P0-06 - Extend the self-test with a headless "AI vs AI" match runner using fixed seeds (used later by the balance phase).
  Done when: a seeded match runs to the end without rendering and returns winner, duration, damage dealt per move type.

## Phase 1 - Research and content decisions

- [ ] P1-01 - RESEARCH: For each reference franchise / game, list mechanics relevant to this game: Tekken, Dead or Alive, Virtua Fighter 4 and 5, Mortal Kombat, Urban Reign, Ryu Ga Gotoku (Yakuza / Like a Dragon), The Warriors, Final Fight Streetwise, Beat Down: Fists of Vengeance, God Hand, Fighting Force, Dynamite Cop, The Bouncer, Midnight Fight Express, Sifu, Power Stone, Sleeping Dogs, Dynamite Deka EX, Crisis Beat, Die Hard Arcade, Crimson Tears, Mortal Kombat: Shaolin Monks, Def Jam: Fight for NY, Devil May Cry.
  Done when: Appendix B has one entry per game with mechanics and a source (official site, manual, or other reliable source). Unverifiable items are marked "unknown".
- [ ] P1-02 - Normalize the research into one reference table: mechanic, which games use it, fits Modern Urban (yes / no), mobile complexity (low / medium / high), already in BREAKPOINT (yes / partial / no).
  Done when: the table is in Appendix B.
- [ ] P1-03 - DECIDE: select the "best ideas not already implemented". Rule: accept only mechanics with Modern Urban fit = yes and mobile complexity low or medium, or that replace an existing mechanic without adding inputs.
  Done when: Appendix C lists accepted and rejected mechanics with one reason each, and each accepted one is mapped to a task in this file (add tasks if missing).
- [ ] P1-04 - RESEARCH + DECIDE: list of real martial arts to cover "all martial arts styles" (striking, kicking, grappling, throwing, joint locks, weapon-based urban styles, hybrid / MMA, street fighting). Group into families that share animation where it makes sense (example from the ideas file: kickboxing punches and boxing punches).
  Done when: Appendix C has the final style list, each with family, signature traits, defense type default (block or sway, see P3-01) and which existing move style it replaces or extends.
- [ ] P1-05 - DECIDE: content counts - styles, preset fighters, levels / arenas, weapons, hazards, customization items per slot, countries, origins, goals, Tournament entrant counts (8 / 16).
  Done when: the counts are recorded in Appendix C with an estimated file size cost per item type.
- [ ] P1-06 - DECIDE: list of new preset fighters (one or more per style), each with name, style, country, origin, goal, body (height, fitness triangle point, age, gender) and role.
  Done when: Appendix C contains the full roster table.
- [ ] P1-07 - Theme audit of existing content (names, arenas, creator options such as "Accent glow", effects, colors) against Modern Urban.
  Done when: each violation has a removal or rework task added to Phase 7, 8 or 9.
- [ ] P1-08 - RESEARCH: Tournament format in Dragon Ball Budokai and Budokai Tenkaichi series (bracket size, eliminations, ring-out rules, rewards, multiplayer support).
  Done when: Appendix B has the verified rules with sources; unknown items marked "unknown".
- [ ] P1-09 - RESEARCH: how other browser and console fighting games do online play (delay-based vs rollback, input delay values, peer count, desync handling).
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

## Appendix D - Audit findings

(Filled by P0-02 and P16-01. Columns: ID, severity, area, location, reproduction, fix task, status.)
