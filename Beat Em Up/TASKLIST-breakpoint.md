# BREAKPOINT - Complete Tasklist

Single tasklist for every item in the former `Ideas-breakpoint.txt` (deleted; its full text is kept in Appendix A).
Work the Path (after section 3) top to bottom. Tick a box only when its "Done when" check passes.

## 0. How to use this file

- Work the Path section (after section 3) top to bottom: it holds every task not started on 2026-11-03, in one order, in numbered stages. A later stage may rely on anything an earlier stage finished. The phases keep the done work and the history; in each phase, one line names the tasks that moved to the Path.
- Each task: `- [ ] ID - Title: what to do.` followed by an optional `Fact:` line, an optional `DECIDE:` line and `Done when:` (the acceptance check).
- `DECIDE` tasks produce a written decision. Record it in Appendix C (Decision log) before starting dependent tasks. A `DECIDE:` line names the choice and the recommended option; the coordinator picks the recommended option (or a better one with a reason) and records it, except where the task says the owner picks or approves.
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
| Code structure | Keep editing `breakpoint.html` directly. No build step. The self-tests are the one exception: they live in `breakpoint-tests.js` next to it (owner decision 2026-10-29, Appendix C "Self-tests in their own file"). |
| Player counts | Up to 4 online and up to 4 local. Tournament entrant count decided in Phase 1 (humans + AI fill). |
| Tasklist file | `Beat Em Up/TASKLIST-breakpoint.md` (this file). |
| Self-test file | `Beat Em Up/breakpoint-tests.js`: the game's self-tests, loaded only when a run is asked for. Resume prompt: `Beat Em Up/HANDOFF-breakpoint.md`. |

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
- Owner (2026-10-29): "Keep things balanced". Every new or changed option, move, weapon or mode is measured with the P0-06 runner against the P14-01 targets before its task is ticked.

## Path - the open tasks in order (2026-11-03)

Work this section top to bottom. It holds every task that was not started on 2026-11-03, in one order, in 18 numbered stages. Task IDs are unchanged: commits, tests and Appendix C cite them. The reasons for the order and for every rewrite are in Appendix C, "Path reorder (2026-11-03)".

- Not repeated here: tasks done in code that wait for the owner's check, and tasks partly done. They stay in their phase: P4-08, P6-06, P11-02 (its online part is finished with P12-03 and P12-06), P15-03 (its final pass is pointed at in Stage 17), P17-03, P17-04, P17-05, P17-07 and P17-08.
- Task shape: `- [ ] ID - Title: what to do.` then an optional `Fact:` line, an optional `DECIDE:` line and one `Done when:` line.
- A `DECIDE:` line names what to choose between and the recommended option. The coordinator picks the recommended option (or a better one with a reason) and records it in Appendix C before the steps that depend on it. Where a task says the owner picks or approves, the owner does.
- When a stage finds new work (an audit, a research or a decision that adds tasks), the new tasks are added at the end of that stage.
- Why a stage stands where it does is in its purpose line.

### Stage 1 - Critical fixes

Purpose: a mode or choice that cannot be used blocks every playtest, so it comes first.

- [x] P18-39 - Tournament fighter choice (Critical): in Tournament mode the player cannot pick the fighter they enter with (owner, 2026-11-03 19:56). Find the cause, then add the pick for every human entrant before the bracket starts, for every playable and custom fighter, with the picker the other modes use.
  Fact: the Tournament plan (Appendix C, "Tournament (P11-01 plan)") says each human picks an unlocked preset or a custom fighter on the seat screen, so the pick is missing or cannot be reached. Record the cause in Appendix D.
  Done when: each human entrant picks a fighter on keyboard, gamepad and touch; the bracket and every bout use that fighter; a self-test drives the pick and checks the first bout's fighter.
  Status (2026-11-03): done. With nobody joined (touch, mouse) the join screen's Start now opens the normal fighter screen (custom fighters, the locked check, Back to the join screen), and its confirm draws the bracket with that fighter; joined keyboards and gamepads pick with left and right on their seat card, a tap on a card steps to the next fighter; every pick reaches the bracket and that person's bouts. 3 self-tests in 'Tournament pick (P18-39)' (the first two fail on the old code; the third guards the joined path, which already worked). 495/495 browser self-tests. Owner (2026-11-04 00:30): joined devices get the full fighter screen too, on mobile as in every mode; that is P18-41.
- [x] P18-41 - Tournament fighter screen for everyone (Critical): every human entrant, joined keyboards and gamepads included, picks their fighter on the same fighter screen as the other modes (grid, custom fighters, locked check, Back), one entrant after another, and it works on touch and on a phone screen as in every other mode (owner, 2026-11-04 00:30). This replaces the left and right step on the seat card.
  Fact (2026-11-04): with nobody joined the touch pick already works on a phone screen, checked in Chrome at 390x844 and 844x390 with touch: the join screen's Start opens the fighter screen (32 fighters, Back and Confirm in reach), two taps on a fighter draw the bracket with it. What is missing is the full screen for joined devices.
  Status (2026-11-04): done. Start on the Tournament join screen (button now "Choose fighters") opens the normal fighter screen for each joined entrant in seat order ("Player N: choose your fighter" in the seat colour, with the device), each confirm moves to the next, the last draws the bracket; Back steps to the previous entrant, from the first to the join screen with the seats kept; the seat cards no longer step with left and right in Tournament (Co-op brawl keeps them; the saved-bracket resume is unchanged). Opus review found a lost pick when the creator's fight preview empties the seats mid-pick: fixed (the pick restarts at seat 1). 5 self-tests in 'Tournament pick (P18-41)' (the third P18-39 test, which tested the old seat-card pick, was replaced). Chrome 497/497; touch pick checked at 390x844.
  Done when: each human entrant picks on the full fighter screen on keyboard, gamepad and touch at a phone viewport; Back from the first pick returns to the join screen; the bracket and every bout use each pick; self-tests drive two joined entrants and a touch pick at a phone viewport.
- [ ] P18-40 - Critical issue sweep: play every mode's whole flow (menu, setup, pick, fight, results, back) on keyboard, gamepad and touch and list every Critical issue (a mode or choice that cannot be used, a soft lock, lost progress, a crash), as P18-39 was one; fix each one.
  Done when: Appendix D lists every Critical issue found, each fixed with a self-test, and a repeat of the sweep finds none.

### Stage 2 - Owner priority: stamina

Purpose: the owner's own Easy Arcade run is the first thing to feel right (owner, 2026-11-03 19:40: the next task after P18-39 and P18-40). The group sizes it measures are the current ones, before the later brawl work.

- [ ] P18-33 - Stamina rebalance across the game: in Arcade on Easy, with any fighter, stamina runs out very fast and group fights leave no moment to rest and recover (owner, 2026-11-03). Step 1: measure stamina use and recovery today (per move, block, sway, run, item, per style and weight) and how long a player is out of stamina in a 1v1 and in each group size, per difficulty and mode. Step 2: set new numbers for the whole game (cost, recovery rate and delay, what recovers it, how many CPUs attack at once and how long they wait at each difficulty) so a fight has a rhythm of pressing and recovering. Easy is forgiving.
  Fact (as of P3-02 and P4-02, 2026-10-28): a sway costs 10 stamina; attack tokens per target (`BRAWL_ATTACK_TOKENS`) are Easy 1, Normal 2, Hard 2, Expert 3, with `TOKEN_GRANT_GAP_TICKS` and `TOKEN_REST_TICKS` by difficulty.
  DECIDE: the largest share of a group fight a player-like script may spend out of stamina, per difficulty. The coordinator sets it from the step 1 measurement, with Easy the lowest, and records it in Appendix C.
  Done when: Appendix C has the before and after numbers per difficulty and group size and the reason for each change; a headless run shows a player-like script out of stamina for at most the decided share of a group fight on Easy and Normal; the P14-01 targets and style balance pass; the owner's Easy Arcade run is the final check.

### Stage 3 - Bugs

Purpose: fix what is visibly wrong before more content is built on top of it.

- [ ] P18-38 - Submissions on the ground: in a ground armbar the attacker floats above the floor (owner, 2026-11-03 19:56). Check every submission and ground hold of every style (attacker and held fighter), find why the bodies leave the floor, and fix the poses so both lie on it.
  Done when: a self-test runs every submission and ground hold and finds every body part of both fighters within 3 cm above the floor and never below it; before and after screenshots of the armbar are in the report.
- [ ] P18-25 + P18-32 - Thrown fighters hit others: a thrown enemy flies through the other enemies without touching them (owner, 2026-11-03: "when throwing an enemy the thrown enemy cant hit other enemies"). Step 1: decide the rule. Step 2: implement it. The thrown body meets every fighter in its path, with a hit, knockdown or stagger by its speed and weight, sound and flash, on the fixed sim; the CPU uses it (it throws towards a group when it can). Merged: P18-25 was the check and the decision, P18-32 the implementation.
  Check first: whether a thrown body hurts anyone today, across every throw, grapple and team setup (allies included). The owner's line covers enemies only: a thrown enemy does not hit other enemies. Appendix C (P4-01) says damage goes only to another team and CPU enemies never hurt each other, friendly fire or not.
  DECIDE: (1) who is hurt: every fighter in the path that is hostile to the thrower, which includes the thrown fighter's own teammates (this replaces "CPU enemies never hurt each other" for thrown bodies only), and the thrower's own team only when Friendly fire is on; "no effect" is out because the owner asked for an effect. (2) the effect and its numbers: recommended a stagger below a speed threshold and a knockdown above it, with small damage that grows with speed and weight; the coordinator sets the threshold and the damage and records them in Appendix C.
  Done when: Appendix C has what the check found and the rule with its reason; a self-test throws a fighter into one and into two standing enemies, an ally and a downed fighter, on every throw that sends a body flying, and each gets the chosen result once; replays and online determinism hold; fingerprints that change are re-recorded with the reason; the P14-01 targets pass.
- [ ] P18-36 - Crowd camera and body stacking: in some seeded brawls the camera stays hidden behind a prop far too long and two bodies squeeze closer than 0.3 m. Found during P18-34.
  Fact (as of P18-34, 2026-11-03): Brawl camera, seeds 3 and 8 before P18-34 and 5 and 7 after: warehouse 141 ticks, limit 54; 1v6 brawl, seed 2 before and 5 and 9 after: bodies closer than 0.3 m. Both tests now run on seed 6, which passes old and new.
  Done when: the Brawl camera and 1v6 brawl tests pass on seeds 1 to 12, not one chosen seed.

### Stage 4 - Audits and polish from the owner's playtest (Phase 17)

Purpose: find and fix the animation, hit and style problems of the 2026-10-31 playtest before any new move or ability is added. P17-02 runs before P17-10, so the new style moves must pass its hit check.

- [ ] P17-01 - Audit the whole game for the issues the owner listed on 2026-10-31 and others of the same kind (animation scale, attacks that miss visually, defence timing, menus, controls on mobile, props, level bounds, style identity). Classify each Critical, High, Medium, Low or Informational. P17-03 to P17-08 are done in code: audit the game as it is now. Critical issues that P18-40 fixed are listed as fixed.
  Done when: Appendix D lists each finding with a fix task: P17-02, P17-09, P17-10, or a new task added at the end of this stage.
- [ ] P17-02 - Animations: tone down exaggerated poses and swings overall; every attack's limb reaches its hit volume at the active frames, so no attack visibly hits the air (owner's example: a Yuki kick).
  Fact (as of P3-11, 2026-10-30): the drawn fist reaches about 0.9 to 1.1 m from the striker's root while the sim reach is 1.2 to 1.65 m plus the 0.34 m body radius, so a strike can register from further away than it is drawn.
  DECIDE: for each move that fails, a longer drawn reach or a shorter sim reach. Recommended: a longer drawn reach made by the stride and the shoulder with calmer swing angles, because the sim reach values are balanced (P14-01) and changing them re-runs every balance row. The coordinator records any exception in Appendix C.
  Done when: a self-test checks, for every move of every style against a standing opponent at the move's range, that the striking limb tip lies within the opponent's hit volume on the active frames; the Yuki kick passes; P0-06 results stay within the P14-01 targets.
- [ ] P17-09 - DECIDE: make styles distinct. Each style gets its own signature moves and motion (owner's example: Capoeira has no acrobatic moves and the styles look very similar). Styles share moves only where the real arts do (owner's example: kickboxing and boxing punches). This replaces the P1-04 rule that a family shares animation (for example the linear kick set of Karate and Taekwondo) wherever the real arts do not share it.
  Done when: Appendix C has a table per style with its signature moves and its shared moves with the reason for each share.
- [ ] P17-10 - Implement P17-09: moves, animations and AI use for every style.
  Done when: no two styles share a move outside the P17-09 share list (self-test); every new move passes the P17-02 hit check; every style meets the P14-01 targets with the P0-06 runner.

### Stage 5 - Combat timing and speed

Purpose: one timing rule for blocks, stun and combos, and the new movement speed, decided before abilities, group attacks and difficulty are built on them. Fingerprints move here on purpose and are re-recorded once per task.

- [ ] P18-02 - DECIDE the combat timing rules in one place: hit stun, block stun, what makes a combo true, when a chain can be escaped, the perfect block, and whether a combo break is added (owner, 2026-11-01: clearer combo breaks, animations and perfect block; timing consistent and intuitive).
  Fact (as of P3-02 and P4-02): the game has no combo break; a perfect block is a 6-tick window (`PERFECT_BLOCK_TICKS`, 0.1 s) after pressing Defend with a 30-tick cooldown and opens one counter; a perfect sway is a strike that would have hit in the last 6 ticks of the 12-tick dodge; combos are counted per attacker (a hit by another attacker ends the open combo).
  DECIDE: (1) combo break: option A adds one (a defender input during hit stun that costs stamina and has its own flash and sound); option B adds none and makes the existing ways out of a chain readable. Recommended B, because P1-03 accepts nothing that adds an input, unless the P0-06 runner shows chains with no way out, then A. (2) the window and cooldown: recommended unchanged unless the P18-03 test finds exceptions.
  Done when: Appendix C has the rule table, and the choice on the combo break with its reason.
- [ ] P18-03 + P18-04 - Implement P18-02 and make the timing readable: the same press timing gives the same result on every move, style, weapon and CPU level; a perfect block, a late block and (when P18-02 chose option A) a combo break each have their own clear flash and sound; Training shows too early or too late by how many ticks; the help and the move list explain combos, stun and the perfect block in plain words. Merged: P18-04 is the readable half of P18-03.
  Done when: a self-test presses Defend at each tick before the hit, for every attack of every style, and finds the same perfect-block window everywhere (exceptions listed in Appendix C); P0-06 results stay within the P14-01 targets; each outcome can be told apart by sight alone and by sound alone; a Training run shows the early / late reading on touch, gamepad and keyboard; the text passes the P17-05 scan (no design notes).
- [ ] P18-01 - Movement speed: the owner wants fighters a little faster (2026-11-01).
  Fact (as of 2026-11-03): walk forward 2.2 m/s, back 1.6, side 1.8, run 4.6 (`WALK_FORWARD`, `RUN_SPEED`).
  DECIDE: the new speeds. Recommended start: 10 percent faster on all four (walk forward 2.4, back 1.8, side 2.0, run 5.1), then tuned until ranges and the AI's spacing work.
  Done when: Appendix C has the old and new numbers with the reason; ranges and the AI's spacing still work; P0-06 results stay within the P14-01 targets; the fingerprints are re-recorded on purpose.

### Stage 6 - Modes and difficulty

Purpose: settle the mode list first, then give every mode the same difficulty choice (P18-05 comes after the merge because it lists the modes the merge removes).

- [ ] P18-18 - DECIDE the merge: Versus, Brawl, Co-op Brawl and Free Fight become one mode named Free Fight, with all the options of the four (owner, 2026-11-01; again 2026-11-04 05:40: "Free Fight Brawl and CoOp Brawl collapse into Free Fight"). It builds on P4-08's lineup (slots, teams, Even teams, clock). Tournament (P11) and online (P12) use the same setup.
  Fact (recorded decisions that stay): Friendly fire is a setting, off by default (owner, P4-07); a knocked-out player sits out until the fight ends and the fight is lost when every player is out (owner, P4-07); a 1v1 of two people keeps rounds, the round timer and the Versus score across rematches (P4-08).
  DECIDE: where each option of the four modes sits on the setup screen so it stays short on a phone. Recommended: the first screen holds Players and teams, Level and Difficulty; every other option sits under one "More options" row.
  Done when: Appendix C has the option list with each old mode's option mapped to its new place; nothing a player could set before is lost without a recorded reason.
- [ ] P18-19 - Implement P18-18: one Free Fight on the mode list, old saves and settings moved over, help and text updated, including the Unlocks screen.
  Done when: every setup the four old modes allowed can be started from Free Fight on touch, gamepad and keyboard; the mode list has no Versus, Brawl or Co-op Brawl; old saves load with their settings; the fingerprints pass.
- [ ] P18-05 - Difficulty in every mode with a CPU: one difficulty choice before the game starts (owner, 2026-11-01), not only at the end of Character Select in Arcade.
  Fact: today it sits on three screens with three names ("Arcade difficulty" on fighter select, "CPU level" in match setup, "Difficulty" in fight options). Modes with no CPU do not show it.
  DECIDE: the step. Recommended: the first setup screen of the mode, before fighter select, with one name, "Difficulty".
  Done when: Arcade, Survival, Free Fight (any lineup with a CPU) and Tournament all offer the same control, named "Difficulty", at the same step before the fight, on touch, gamepad and keyboard; the choice is saved per mode; old saves load with their current level.
- [ ] P18-42 - DECIDE the Free Fight fight rules: any kind of fight can be set up in Free Fight (owner, 2026-11-04 05:40): the area (the open level or the square ring of that level, P8-05), ring-out on or off, weapons and items on or off, breakables on or off, and every other match setting (rounds, round time, health, difficulty, teams, friendly fire, start side), so any fight of the game (an Arcade duel, a brawl, a Tournament bout, a Survival wave) can be recreated.
  Fact: every level has a `ring` row (centre, half sizes, ring-out flag) used by the 1v1 modes (P8-05, Appendix C "Levels"); P18-18 places the options on the setup screen, P18-42 sets which rules exist.
  DECIDE: the rule list, each rule's values and default, and which combinations are refused (for example ring-out with the open level). Recommended: defaults equal today's Free Fight; ring-out is offered only with the ring; the rules sit under P18-18's "More options" row with one "Rules preset" row (Default, Arcade duel, Tournament bout, Brawl, Survival wave, Custom) that sets them all at once.
  Done when: Appendix C has the rule list with values, defaults, refused combinations and the presets, each preset matching the mode it copies.
- [ ] P18-43 - Implement P18-42 in Free Fight: every rule works in every lineup (1v1, teams, crowds, people and CPUs) and is saved with the Free Fight settings.
  Done when: each rule changes the fight as set (the ring bounds and ring-outs, no items or no breakables in the level, the round and health numbers) on touch, gamepad and keyboard; each preset starts a fight with the rules of the mode it copies; self-tests cover every rule and preset; old saves load with the defaults; the fingerprints pass.

### Stage 7 - Arcade and Survival brawls, goons and allies

Purpose: the brawl rules, the Arcade goons and the allies are decided together, because the Arcade half (goons, bosses, story allies) and the Survival half share one balance table. They come before the story text (Stage 12) and the balance pass (Stage 15).

- [ ] P18-20 + P18-37 - DECIDE Arcade and Survival brawls and the Arcade goons: brawls against several CPUs or with ally CPUs, balanced by difficulty (owner, 2026-11-01); and in Arcade the brawls use themed goons made with the character creator, themed after the character you fight in the end, weaker than a main fighter because they come in groups (owner, 2026-11-03 19:56); each stage's boss brings their own goons (owner, 2026-11-04 00:30, replaces "the character you fight in the end"). Merged: P18-37 is the Arcade half of P18-20; Survival is the rest.
  Fact: a run has 7 stages, 4 brawls and 3 duels; its main-fighter opponents are rival A (stage 2, and stage 6 after "Walk away"), rival B (leads the last wave of stage 3), the boss (stage 4) and ZERO (stage 7; MARA when the player is ZERO) (Appendix C, "Arcade story structure"). P1-03 rejected AI allies with orders and tag switching, so allies get no orders.
  DECIDE: (1) Arcade allies come from the story (owner, 2026-11-03 19:56: "depending on the story you might get cpu allies too"), not from a player setting; Survival allies are a player setting (owner, 2026-11-01). (2) Each brawl uses the goon theme of its stage's boss, the main fighter that stage ties to (owner, 2026-11-04 00:30); the task maps every brawl to its boss in Appendix C, and the final opponent keeps the P10-02 rule (ZERO; MARA when the player is ZERO). (3) The cap of 3 main-fighter bosses per run (today 4): recommended that rival B stops being a main fighter and leads the last wave of stage 3 as the strongest goon of the theme. (4) The goon variants per theme: at least 3; the coordinator picks the count the size budget allows. Goons are creator characters with less health, damage and stamina than a main fighter, with numbers per difficulty. (5) For Survival: the options, how many allies and enemies at each difficulty, how allies change the enemy count and the rewards, and the record rule; recommended: records are kept apart for runs with allies.
  Done when: Appendix C has the goon themes, variants and numbers per difficulty, the boss cap rule, the ally rule, the Survival table per difficulty and the record rule.
- [ ] P18-21 - Implement P18-20 + P18-37 with AI for allies and enemies.
  Done when: Arcade and Survival run with and without allies at every difficulty (Arcade allies only where the story gives them); every Arcade brawl uses the goons of its stage's boss; no run has more than 3 main-fighter bosses; self-tests cover the theme pick, the variant count, the boss cap and the allies; a headless run of each difficulty keeps the group fights inside the P14-01 targets with the P0-06 runner; the P0-04 performance check passes with the most fighters allowed.

### Stage 8 - Unique abilities and the ultimate

Purpose: abilities build on the distinct styles of Stage 4 and the timing of Stage 5. The ultimate comes after the abilities so its charge and input fit them.

- [ ] P18-06 - DECIDE unique abilities per fighter: each of the 32 preset fighters gets a few abilities on top of its style's moves (owner, 2026-11-01: "a few unique abilities"), so two fighters of one style still play differently. Inputs use existing buttons only (P2-01, P17-06: no new on-screen button).
  DECIDE: (1) the count, the same for every fighter: 2 or 3; recommended 2 (64 abilities instead of 96: less file size and balance load). (2) how custom fighters get theirs; recommended: they pick from the same list in the creator, paid from the 44-point budget.
  Done when: Appendix C has a table of every fighter with each ability's input, cost and counter; no two fighters share an ability unless the table says why.
- [ ] P18-07 - Implement P18-06: moves, animations, AI use, move list entries, and custom fighters (the ability field is appended to the share code and the custom store like Age and Gender; old codes and saves load with the default).
  Done when: a self-test finds every ability in the data, reachable by its input and used by the CPU in P0-06 runs; every fighter meets the P14-01 targets; old codes and saves load.
- [ ] P18-08 - DECIDE the ultimate ability: charged before use (owner, 2026-11-01). This replaces the P1-03 rejection of resource-spent specials, because the owner asked for it later.
  Fact: the Momentum gauge (0 to 100) already exists; it fills from damage dealt and taken and from perfect defence, and a full gauge starts a 5 s boost of x1.15 damage (Appendix C, P3-09).
  DECIDE: (1) the charge: recommended that the Momentum gauge charges it (no second bar, no clutter) and the player spends the full gauge on the ultimate instead of the automatic boost; the other option is a new, slower gauge. (2) one per style or one per fighter: recommended per style (16 instead of 32 animations; custom fighters get their style's with no new creator row). (3) the input on touch, gamepad and keyboard from existing buttons only; recommended Punch and Kick pressed together. (4) how it can be avoided, and what it costs.
  Done when: Appendix C has the rule, the input per device and the damage cap against a round's health.
- [ ] P18-09 - Implement P18-08: charge display, activation, a short readable effect on the fixed sim, AI use, Training demo.
  Done when: it works on touch, gamepad and keyboard; a full gauge cannot end a full-health round alone; the CPU uses it in P0-06 runs; every fighter meets the P14-01 targets; the P0-04 performance check passes.

### Stage 9 - Group attacks

Purpose: team attacks need the ally and enemy groups of Stage 7 and the timing of Stage 5.

- [ ] P18-22 - RESEARCH Urban Reign's group special attacks: how two fighters attack one target together, one holding the target while the other hits it, how they are triggered, how they can be stopped, and what enemies and partners do (owner, 2026-11-01).
  Done when: Appendix B has the notes with a source for each fact.
- [ ] P18-23 - DECIDE our group attack system from P18-22, in our own design. The attack list has at least these two: one fighter grabs the target and the other hits it; both strike one target. Anyone can start one: people, CPU allies and CPU enemies.
  DECIDE: the input on touch, gamepad and keyboard (existing buttons only, P17-06's no-clutter rule), the cost, how the target breaks out, the damage cap, and any further attack that P18-22 shows fits.
  Done when: Appendix C has the attack list with the input per device, the counter and the numbers.
- [ ] P18-24 - Implement P18-23: moves, paired animation (hands really meet the target), AI use for allies and enemies, move list, Training demo.
  Done when: every group attack works in Free Fight, Arcade and Survival on touch, gamepad and keyboard, a self-test starts and escapes each one, no attack hits the air (P17-02's check), and the P14-01 targets pass.

### Stage 10 - Environment, start side and menu selection

Purpose: level and menu work that needs the final mode list (Stage 6) and the final fight rules.

- [ ] P18-12 - DECIDE more environment interaction: the owner likes the new levels and the object interaction and wants it taken further (2026-11-01). Go level by level through the 8 levels and list new things to do with objects and the room (builds on P9-02 to P9-04, P17-07, P17-08).
  Done when: Appendix C has at least 2 new interactions per level, each with what triggers it, how a CPU uses it and how it stays fair to both sides.
- [ ] P18-13 - Implement P18-12.
  Done when: each interaction works on touch, gamepad and keyboard and in 1v1, wave and Brawl fights; a self-test triggers each one; the CPU uses them; the P14-01 targets and the P0-04 performance check pass.
- [ ] P18-16 - Start side: let the player choose left or right as the side they start on in a level (owner, 2026-11-01).
  Fact (as of P17-08, 2026-11-03): every 1v1 except Training draws the first fighter's start side from the match seed and swaps it every round (`cfg.sides`, `MatchSim.sideFor`), with or without a ring, because levels favour one seat; Arcade duels do the same; brawls and Training start the player on the left.
  DECIDE: recommended: the choice is offered in Free Fight, Arcade duels and Training; "Random" stays the default so the seat balance of P9 holds; a chosen side holds for round 1 and swaps every round as now; when two people pick the same side, player 1 keeps it and player 2 gets the other; the CPU takes the other side.
  Done when: Appendix C has the rule; the choice works on touch, gamepad and keyboard in every mode that offers it; "Random" stays the default so the seat balance of P9 holds; the fingerprints pass unchanged when nobody picks a side.
- [ ] P18-17 - Audit menu selection: find every place where more than the current item looks selected or the look is wrong (owner's example: an outline on items other than the current one).
  Fact: hover, keyboard focus and the `.sel` class all draw the same outline on buttons, options and cards, so a mouse-over and a focused item can both show it, and so can a remembered pick.
  Done when: Appendix D lists each finding; on every screen exactly one item looks current with mouse, keyboard, gamepad and touch; a remembered pick has its own different look; a self-test checks the rule on each menu screen.

### Stage 11 - Fighter looks

Purpose: the model details come after the fight rules, so they are made once and checked against the part limit.

- [ ] P18-11 - Giorgi (the owner's "Giorgiy"): add a Soviet-style ushanka to the headwear (today 10: none, headband, half mask, full mask, cap, beanie, hood, bandana, boxing headgear, balaclava), wear it on Giorgi in every mode and offer it in the creator. It is appended at the end of the headwear list, because share codes store the index.
  Done when: Giorgi wears it in every mode, it follows the head without clipping through hair or shoulders in any animation, and a custom fighter can pick it.
- [ ] P18-10 - Fighter models: review all 32 preset fighters side by side and give each one or two carefully made details (silhouette, headwear, gear) so each is recognisable at phone size (owner, 2026-11-01). Stay inside the 40-part worst case.
  Done when: Appendix C lists each fighter's added detail; a contact sheet of all fighters shows no two with the same silhouette and colours; the P0-04 performance check passes.

### Stage 12 - Story text

Purpose: the story is written last among the content, once the rival, boss, goon and ally rules of Stage 7 are fixed, so the text is written once.

- [ ] P18-35 - Story dialogue: the owner finds the story beats cheesy, as if an AI wrote them, and without cohesion, even after the rewrite of baae2b5 (2026-11-03). Write it again with one method: one plain voice, short lines, people who talk like people (no slogans, no grand speeches), and one through-line per run so every beat follows from the one before (the rival, the goal and the setbacks keep coming back, and the ending answers the opening). The rows follow the cast and ally rules of P18-20 + P18-37.
  Step 1: write the full text of one run (all 16 beats for one origin and goal) and show it to the owner. Stop and wait for the owner's OK; this is the only owner gate in the task. Step 2: after the OK, rewrite the rest.
  Done when: the owner approves the sample run; every origin, goal, rival, boss, setback and epilogue line is rewritten to that sample's standard; the story limits of the self-tests still pass; Appendix C lists the method and the old and new lines.

### Stage 13 - Research and identity

Purpose: research and decisions that feed later work. P18-27 runs before P18-14 because it is one of the options P18-14 weighs, and P18-26 runs before P18-15 because its result feeds the price estimate. Tasks that these add are placed at the end of this stage, so they run before the balance pass.

- [ ] P18-27 - DECIDE accessibility as part of the game's identity: the friend (2026-11-02) sees potential if the game is easier to get into than games like Tekken. List what a new player must learn today before a first win (inputs, defence, strings, stamina), compare with how Tekken and other 3D fighters teach and simplify it, and choose what to change from: a first-fight guide, simpler defaults, assisted inputs, a clearer move list. Tips keep the show-once rule. The game stays 3D (owner, 2026-11-02).
  Done when: Appendix C has the list, the comparison with sources in Appendix B and the chosen changes as tasks added at the end of this stage.
- [ ] P18-14 - RESEARCH and DECIDE the X-factor: one genuinely unique feature that gives the game its own identity (owner, 2026-11-01). Check what the closest games in the genre already do, then write 3 to 5 options with what each costs to build; P18-27's result is one of them.
  DECIDE: the owner picks from the options (the owner's wording of 2026-11-01); the coordinator gives a recommended one.
  Done when: the options and their sources are in Appendix B; the pick and its reason are in Appendix C, with new tasks for it added at the end of this stage.
- [ ] P18-26 - RESEARCH a mobile release and free-to-play: the friend (2026-11-02) sees it as a mobile game, would download it if free, and would pay about EUR 3-5 for one that caught their interest. Compare ways to put the one-file HTML game on phones (an installable web app, an app-store wrapper), their costs and store rules, and free-to-play models that sell nothing that wins fights (P1-03 rejected an in-game economy) against a one-off price. Feed the result into P18-15. The game does not change in this task.
  Done when: Appendix B has the options with their sources and costs; Appendix C has a recommendation the owner can pick from, with no change to the game yet.
- [ ] P18-15 - RESEARCH the Steam price: an honest estimate of what people would pay for the game as it stands today, judged on its current content and quality and not dismissed for being unfinished; a low figure is fine (owner, 2026-11-01). Compare with similar paid games on Steam (price, reviews, content) and judge the owner's first idea of EUR 2.99, and EUR 5 if the game is polished enough. This is a market estimate, not a plan to sell it now.
  Fact: informal opinions the owner gathered (not market research) said EUR 3-5 for a smaller indie game and EUR 5-10 depending on quality and content; the friend (2026-11-02) said EUR 3-5 and sees it more as a mobile game (P18-26).
  Done when: Appendix B has the comparison with sources, a likely price range with the reasoning, and a clear answer on EUR 2.99, EUR 5 and the EUR 5-10 opinion; the owner has read it, and the price itself stays the owner's choice.

### Stage 14 - Audio and visual

Purpose: feedback, sound and graphics after the content and the X-factor are in, so each is built and checked once. P13-02 builds the audio rows 12 and 13 of the feedback list, so the sound audit (P18-28) finds them already there.

- [ ] P13-02 - Implement the feedback list of P13-01 (Appendix C, "Feedback list (P13-01)") within the performance budget: the rows marked new or partly existing: 4 KO finisher, 5 bruise tint, 6 sweat sheen, 7 dust and scuffs, 8 breathing and panting, 9 hurt posture, 11 weapon wear, 12 layered impact sound, 13 low-health heartbeat, 16 lamp sway and prop jolt, 17 touch vibration. Add the four settings P13-03 left for these features: Slow-motion finisher, Camera cuts, Wear marks and Low-health heartbeat (On / Off).
  Fact: cost per the list is about 7,000 bytes of new code, no new parts and no new draw calls; everything is drawn or played outside the simulation.
  Done when: each listed item works and has its setting where the list gives one; the P0-04 check passes on the low preset.
- [ ] P18-28 - Sound design pass: audit every sound in the game (all made in code with the Web Audio API, no sound files), including hits, blocks, footsteps, objects, menus, crowd and music (friend, 2026-11-02). Find what is missing, repeats too much or sounds thin, then decide the changes.
  Done when: Appendix C has the sound list with each sound's trigger, its problem and the fix.
- [ ] P18-29 - Implement P18-28 within the performance budget: at most 12 impact voices at once (the oldest stops), as P13-01 row 12 sets.
  Done when: each listed fix is in; the volume and mute settings still cover every sound; the P0-04 performance check passes.
- [ ] P18-30 - Graphics polish pass (3D): review lighting, shadows, materials and colour, level detail, effects and menus side by side on phone and desktop, beyond P18-10's fighter details (friend, 2026-11-02). List what looks unfinished, then decide the changes for each quality preset.
  Done when: Appendix C has the list with before screenshots and the chosen fix per item.
- [ ] P18-31 - Implement P18-30.
  Done when: each fix is in on every quality preset; before and after screenshots are in the report; the P0-04 performance check passes on the low preset.

### Stage 15 - Balance

Purpose: balance runs after all content and rules are in, so each case is measured once. The bands are in Appendix C, "Balance targets (P14-01)".

- [ ] P14-02 - For every option that affects gameplay, write benefits, drawbacks and explicit use: each stat, each style, defense type (block / sway), height, fitness triangle (muscle, weight), each weapon class, each pickup, and the abilities, the ultimate, the group attacks and the goon variants added in Stages 7 to 9.
  Fact: age and gender change the look only (decisions P6-04, P6-05; no gameplay effect is planned), and the story settings never change a stat or a fight rule (Appendix C, "Story lists"). The table lists age and gender as "look only" and they are exempt from the unique-profile rule.
  Done when: Appendix C has a table where every other option has at least one benefit, one drawback and one explicit use, and no two options have the same profile.
- [ ] P14-03 - Smart testing plan (not every configuration): test extremes and corners (fitness triangle corners, age ends, height ends, stat extremes), one-factor-at-a-time sensitivity around a baseline, pairwise (orthogonal array) combinations for interactions, all style pairs once with seeded AI vs AI.
  Done when: the plan lists every test case and the total count.
- [ ] P14-04 - Run the plan with the P0-06 runner; fix outliers by data (attributes, frame data, AI weights), never a special case per matchup; re-run only the affected cases.
  Fact (as of P10-03, 2026-10-29): the brawl-stage band is not met by the old waves; the Hard AI cleared 0 of 8 seeds on the full Garage and Subway waves.
  Done when: all cases meet the P14-01 targets, results summarized in Appendix C.
- [ ] P14-05 - Tune AI difficulty levels for 1v1 and groups, with the one-sided damage bonus option on `simulate` that the P14-01 table says P14-05 adds.
  Done when: against the scripted reference player (the Normal AI without a bonus) the CPU wins a 1v1 Easy 20-30 %, Normal 45-55 %, Hard 65-75 %, Expert 80-90 % (n 400 each), and the reference player wins against 3 CPU enemies Easy 85 % or more, Normal 50-70 %, Hard 25-45 %, Expert 10-25 % (n 100 each).

### Stage 16 - Online multiplayer

Purpose: online comes after the determinism and timing work. P12-05 and P12-04 run first because the netcode needs a deterministic sim and the connection must be tested under the real CSP. The decisions are in Appendix C, "Online signaling (P12-01) and netcode choice (P12-02)".

- [ ] P12-05 - Determinism audit: all gameplay randomness through the seeded RNG, no frame-rate-dependent logic, no use of `Math.random` in simulation, no viewer setting that changes the sim.
  Fact: Reduced motion no longer shortens hitstop (P13-03, 2026-11-02), so Appendix D row D08 is fixed in code; this task proves it with a test and closes the row.
  Done when: two runs with the same seed and inputs give identical state checksums, also with Reduced motion on and off.
- [ ] P12-04 - CSP: run the real CSP under WebRTC in current browsers. No change is expected, because the stream uses `srcObject` and no URL. Change nothing unless a test fails; then add only what WebRTC needs and keep everything else `'none'`.
  Done when: the CSP is the minimum needed and documented in Appendix C.
- [ ] P12-01 - Signaling by copy-paste, no server: the host makes one offer code per open seat, the guest pastes it and returns an answer code. Codes are packed binary in base64url with the prefixes BPO- (offer) and BPA- (answer), `iceServers: []`, ICE gathering ends when complete or after 3 s, and a deflate-raw fallback covers an SDP the packer cannot express. QR display is in (an inline encoder, error correction L, versions 1 to 13; a longer code shows text only). QR scan is offered only where `BarcodeDetector` lists `qr_code`, `getUserMedia` exists and `isSecureContext` is true; elsewhere the player pastes.
  Done when: two devices on the same local network connect with copy-paste only, no server; the packed form is proven between Chrome, Firefox and Safari (Android, iPhone, desktop) before it is the default; the QR round trip works where scan exists.
- [ ] P12-02 - Netcode: delay-based lockstep on the fixed 60 Hz simulation, relayed by the host. Input delay is 2 frames on a LAN; in the lobby and between rounds the host sets it to clamp(ceil(RTT / 2 / 16.7 ms) + 1, 2, 6) from 20 ping samples. Inputs go on an unordered channel with the last 8 frames in each packet; the lobby, the match config, pings and checksums go on a reliable channel. A state checksum (FNV-1a 32) every 60 frames; a mismatch stops the match with "Out of sync" and offers a rematch. A missing input stalls the sim, "Waiting for P3..." shows after 0.5 s, and the peer is dropped after 10 s (a 1v1 ends, a brawl seats it out, a tournament match is lost). Rollback only later, if saving and restoring the sim becomes cheap.
  Done when: a 1v1 online match on LAN completes without desync in a 10-minute test.
- [ ] P12-03 - Up to 4 peers (the host relays to guests, star topology, one connection per guest).
  Done when: 4 devices play one brawl level or tournament round together.
- [ ] P12-06 - Online lobby UI: create / join, player list, ready check, mode select, latency display. Online slots join the lineup row of P4-08 here.
  Done when: usable on touch, gamepad and keyboard.
- [ ] P12-07 - Document limits: networks that block peer-to-peer (no TURN server) cannot connect; show a clear message.
  Done when: failed connections show the reason text.

Pointer (not a task): P11-02 stays in Phase 11. Its online part (a tournament with 2 to 4 humans online) is finished and ticked after P12-03 and P12-06.

### Stage 17 - Performance and size

Purpose: profile and trim after all content is in.

- [ ] P15-01 - Profile with the P0-04 method after all content is in.
  Fact: the P0-04 benchmark 1v1 has the whole room since P17-08 (2026-11-03), so compare only with runs made after that date.
  Done when: numbers recorded in Appendix C.
- [ ] P15-02 - Optimize the hot paths found in P15-01 (allocation per frame, draw calls, instance updates, AI per-enemy cost, audio voices).
  Done when: the low-spec target from P0-04 is met.

Pointer (not a task): P15-03 stays in Phase 15 (first pass done, not ticked). Run its final size pass here, after P15-02 and before Stage 18, then tick it.

### Stage 18 - Final audit and release

Purpose: the last checks on the final build (Phase 16).

- [ ] P16-01 - Repeat the full audit (same categories as P0-02) on the final build. Classify Critical, High, Medium, Low, Informational.
  Done when: Appendix D has the final audit; no Critical or High remain open.
- [ ] P16-02 - Save migration test: 1.0.0 settings, progress, bindings and custom fighters load correctly.
  Done when: a self-test covers each store key migration.
- [ ] P16-03 - Device test matrix: low-spec Android phone, iPhone, desktop with keyboard, desktop with gamepad, online 2 and 4 peers.
  Done when: each row passes or has a recorded known issue.
- [ ] P16-04 - Update in-game help, About and credits; bump `VERSION`.
  Done when: all texts match the final features.

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
- [x] P1-05 - DECIDE: content counts - styles, preset fighters, levels / arenas, weapons, hazards, customization items per slot, countries, origins, goals, Tournament entrant counts (8 / 16).
  Done when: the counts are recorded in Appendix C with an estimated file size cost per item type.
- [x] P1-06 - DECIDE: list of new preset fighters (one or more per style), each with name, style, country, origin, goal, body (height, fitness triangle point, age, gender) and role.
  Done when: Appendix C contains the full roster table.
- [x] P1-07 - Theme audit of existing content (names, arenas, creator options such as "Accent glow", effects, colors) against Modern Urban.
  Done when: each violation has a removal or rework task added to Phase 7, 8 or 9.
- [x] P1-08 - RESEARCH: Tournament format in Dragon Ball Budokai and Budokai Tenkaichi series (bracket size, eliminations, ring-out rules, rewards, multiplayer support).
  Done when: Appendix B has the verified rules with sources; unknown items marked "unknown".
- [x] P1-09 - RESEARCH: how other browser and console fighting games do online play (delay-based vs rollback, input delay values, peer count, desync handling).
  Done when: Appendix B has a summary with sources and a recommendation for P12-02.

## Phase 2 - Controls overhaul (mobile first)

- [x] P2-01 - DECIDE: final action list. Required changes from the ideas file: remove `dash` completely; add `use` (pick up / drop / throw item); add `lock` (lock-on engage / disengage); replace block-high / block-low with one `defend` action whose meaning depends on the character (block or sway, P3-01). Decide what happens to: quick recovery (now on the dash input), `strong` and `height` modifiers, sidestep.
  Done when: Appendix C has the final action list for touch, gamepad and keyboard, with no action needing more than one simultaneous modifier on touch.
- [x] P2-02 - Remove dash: DASH state, `DASH_COST`, transitions, AI use, touch DASH button, gamepad L3 mapping, keyboard binding, labels, help text, tutorials.
  Done when: searching the file for `dash` (case-insensitive) finds no game logic, and the self-test passes.
- [x] P2-03 - Bump `KEYS_REVISION` and migrate saved key bindings (keyboard P1 and P2, gamepad) to the new action list without data loss for unchanged actions.
  Done when: a save from 1.0.0 loads with correct bindings and the new actions have defaults.
- [x] P2-04 - Touch layout redesign: minimal buttons, no visual clutter, thumb reach on phones in landscape, safe areas respected. Context-sensitive buttons (example: `use` appears only when an item is in reach) only if approved in P2-01.
  Done when: layout fits a 360x640 CSS px landscape screen without overlap and all actions are reachable with two thumbs.
- [x] P2-05 - Gamepad layout for the new action list (standard mapping), shown in the Controls screen.
  Done when: every action is mapped, no conflicts, labels updated.
- [x] P2-06 - Keyboard layout for the new action list for P1 and P2 (shared keyboard).
  Done when: every action is mapped for both players with no key conflicts.
- [x] P2-07 - Quick-start onboarding: a short first-play card per input type showing only the core actions.
  Done when: a new player can start a fight and see all core actions in one card per input type.
- [x] P2-08 - Update Controls screen, help text, `ACTION_LABELS`, `GAMEPAD_LABELS`, `TOUCH_LABELS`.
  Done when: all labels match the new actions.
- [x] P2-09 - Optional auto-assist input setting (off by default): repeated taps on Punch or Kick chain the fighter's next valid string move automatically; no new input, no new on-screen button.
  Done when: the setting exists in Settings and is saved; with it on, tapping Punch 3 times plays the style's 3-hit string on touch, gamepad and keyboard; with it off, behavior is unchanged; a self-test covers both.
- [x] P2-10 - Attack strings on every device: Punch / Kick fire on press; the Fighter keeps its string state and picks the move from one STRINGS table (Appendix C, P2-01); crouch held at the press gives the low version. Remove the `strong` action and intent field, the touch hold (TOUCH_CHARGE_MS, charge, `charged` button look), strong throws, the strong key of MOVE_BY_INPUT and the hand / foot alternation of nextInString. The AI and the Training dummy use the same strings. Move list shows the strings; self-tests that use `strong` are rewritten.
  Done when: every row of the P2-01 string table plays the listed moves on keyboard, gamepad and touch (a self-test per device); no code reads `strong` from input; the AI and the dummy reach the 8 strong moves only through strings; the self-test suite passes.

## Phase 3 - Core combat rework

- [x] P3-01 - Defense choice per character: each character has exactly one defense type, Block or Sway (an invincibility-frame dodge in the style of God Hand). Never both. Stored in preset data and in the creator (Style tab).
  Done when: the `defend` action performs only the character's defense type, AI uses the correct type, and the share code includes the defense type.
- [x] P3-02 - Define Block rules (high / low coverage without a second button, perfect block, stamina cost, chip damage, guard break) and Sway rules (i-frame window, recovery, stamina cost, punish window, counter-attack follow-up).
  Done when: rules and values are in Appendix C and implemented; P0-06 runner shows neither type wins more than the balance target set in P14-01.
  Status (2026-10-28): done in P3-08 by AI tuning only (new per-difficulty `swayRead` / `swayAim`; no rule number changed). Block vs Sway wins, same fighter, 600 matches per level: Easy 51/49, Normal 48/52, Hard 49/51, Expert 51/50 (60-match samples vary by about ±6). Note: Easy's Sway CPU reads a wind-up slightly sooner than Normal's (8 vs 10 ticks), so the two can be balanced against their Block CPUs. Preset pairs shift with it (Sway presets gain at Hard): P14-01 / P14-04 rebalance them.
- [x] P3-03 - Grab attacks: in a grab, Punch = elbow strike, Kick = knee strike. Distinct animations per style family where the style supports it.
  Done when: both strikes work from the grab on touch, gamepad and keyboard, with hit reactions and a strike limit per grab.
- [x] P3-04 - DECIDE: submissions design with minimal inputs (proposal: start from a grab or a downed opponent with one existing input; escape by a short directional or mash contest that works on touch). Include which styles can submit.
  Done when: Appendix C has the design, inputs on all three control types, and rules for multi-opponent situations (other enemies can interrupt).
- [x] P3-05 - Implement submissions per P3-04: states, animations, escape contest, damage / stamina effect, AI use and AI escape.
  Done when: submissions work in 1v1 and in multi-opponent levels and the self-test covers start, escape and finish.
- [x] P3-06 - Optional heavy tackle: very heavy characters can charge through lighter ones by running into them with analog input only. DECIDE first whether to include, with the weight threshold.
  Done when: decision recorded; if included, the tackle triggers only by analog movement, only above the weight threshold, and has a counter.
- [x] P3-07 - Falling: on unstable or elevated surfaces, a character with no support falls (gravity, fall damage, edge reactions such as teeter / grab ledge if approved).
  Done when: characters fall off edges and broken surfaces in every level that has them, and the AI avoids edges unless pushed.
- [x] P3-08 - Re-tune hitstop, juggle limit, combo reset and frame data for the new action list.
  Done when: frame data shows in Training for every move and no move has an unintended infinite combo (checked by P0-06 runner).
- [x] P3-09 - Automatic momentum boost: a gauge filled by landing hits, perfect blocks / sways and taking hits, giving a short stronger-damage state when full; same rules for AI; no extra input; shown on the fighter (pose / breathing, no glow, no sci-fi look) plus one thin bar.
  Done when: rules and values are in Appendix C; the boost triggers and ends as defined in the P0-06 headless runner; with it on, no style pair's win rate leaves the P14-01 target.
  Status (2026-10-28): implemented, rules in Appendix C, self-tests cover start / end / reset / AI. Balance open: the all-pairs win-rate check waits for P14-01 (Block vs Sway at Hard moved 73/27 to 77/23 with the boost on).
  Status (2026-10-30): balance checked against P14-01, boost values unchanged (Appendix C, "Balance check (P3-09 / P3-10 / P3-11)" in the P3-10 section). Final run on fresh seeds, all 136 pairs at the four difficulties, 196-1,400 pooled matches per pair, boost on, and all pairs at Hard with the boost off (600 matches each way, same seeds): the boost moves a pair by 0.6 points on average (absolute 2.0), no pair changes its class; 1.0 to 1.1 boosts per fighter per round (band 0.5-2). Block vs Sway with and without the boost: Easy 51 / 49 and 49 / 51, Normal 46 / 54 and 46 / 54, Hard 48 / 52 (1,800 matches; 50 / 50 over 600) and 50 / 50 (600, boost off), Expert 54 / 46 and 54 / 46 (1,800 matches); Hard and Expert after the perfect-block chances went from 0.2 to 0.25 and from 0.35 to 0.3 (P14-01; a perfect block adds 20 to the gauge, so the Hard comparison was redone after the change). Coordinator check (2026-10-30): browser self-test 346 / 346.
- [x] P3-10 - Combo audit and redesign for balance: for every attack string and buffered chain measure damage, stamina, frame advantage on hit and on block, guard break, knockdown / launch and juggle follow-ups; give each style family (P1-04) its own strings where the style needs them; make strong string enders punishable on block and keep any one string from dominating. Runs after P3-08.
  Done when: Appendix C has the final string table per style family with frame data and damage per string; the P0-06 runner (AI vs AI, every style pair) shows every string in use, no single string above 35% of a fighter's damage (threshold may be revised in Appendix C with a reason), no unintended infinite or guaranteed loop, and win rates inside the P14-01 target.
  Status (2026-10-28): implemented, measurements and the final tables are in Appendix C ("P3-10 combo audit"). Worst string 25% (limit 35%), punch share 38-40%, strong enders -7 or less on block, per-style rows for 5 move styles, no loop. Open: the all-pairs win-rate check waits for P14-01 (Hard 37-63%, Expert 42-60%; Normal was already lopsided and is unchanged).
  Status (2026-10-30): the all-pairs check ran three times (136 pairs x 4 difficulties) and found 50 / 31 / 20 / 28 pairs beyond noise at Hard / Easy / Normal / Expert in the old data, almost all from Judo, BJJ, Hapkido, Wing Chun and Muay Thai (rows of P5-01 / P5-02 that were never measured). Fixed by data (judoka-family P P / K K rows, the judo family's P K row back to the default Heavy Body Kick, which Hapkido inherits, Wing Chun chain / trap numbers, the teep as the front kick with its own block push, Hard and Expert perfect-block chances 0.2 to 0.25 and 0.35 to 0.3 with the Hard fingerprint re-recorded). The review of the first two passes showed that re-running only the out-of-band pairs was the wrong method (Muay Thai at Easy was still 66 % against three styles on fresh seeds); the final run pools every pair over fresh seeds (200 to 1,400 matches, more for the ones near an edge): no pair is out, 136 / 136 inside at Easy and Normal, 132 / 136 (Hard) and 119 / 136 (Expert) with the interval inside and the rest near an edge (Appendix C, "P14-01 all-pairs check"). Muay Thai's signature Shin Round Kick is reachable again (K K K) and a new self-test checks that every signature strike is thrown by one of the style's own rows (it also found Sambo's unreachable Sweep, now Low Kick). Worst string 27 % (limit 35 %), every row in use, strong enders -7 or less, no loop, Block vs Sway 48 / 52 at Hard (1,800 matches) and 54 / 46 at Expert. Open for P14-04, not this task: Expert's time-outs (1.2 % of matches never end, 11 rounds per match). Seat fairness (600 matches per mirror, no seat swap): seat 1 wins 50.9 / 51.0 / 51.5 / 49.9 % at Easy / Normal / Hard / Expert, at most about 1 point and none at Expert, so the update order and spawn sides stay as they are (decided by the coordinator; the owner can change it). Coordinator check (2026-10-30): browser self-test 346 / 346.
- [x] P3-11 - Sway that looks right (owner, 2026-10-29: the character looks hit because it did not sway far enough out of the way): the sway pose moves the head and body clearly out of the strike line for the whole avoid window, the window matches what is drawn, and a swayed strike visibly passes by (no hit flash, no reaction).
  Done when: Training captures of a sway against each attack height and style family show the strike missing the body by a visible gap; a self-test checks the drawn head / torso stays outside the attack hit volume during the avoid window; Block / Sway balance stays inside the P14-01 targets.
  Status (2026-10-30): implemented, rules, numbers and the Training setup in Appendix C ("P3-11 sway pose"). The pose now covers the i-frame window (full lean from the first tick to the last, upright 3 ticks after) and leans back 0.9 rad plus 0.28 m; a plain sway shows no ring, spark or flash at the body. Self-tests "Sway pose" (3): the drawn head, torso and (low strikes) feet stay at least 0.10 m of air from the drawn strike on every i-frame tick, for the longest strike of each height of all 16 styles, leaning back, left and right (worst: head 0.77 m, torso 0.44 m, feet 0.36 m, against 0.32 / 0.35 / 0.30 m); the old pose fails all three. The pose and the effects do not change Block / Sway balance (they are visual); the Hard figure moved later because of P14-01's Hard perfect-block chance: Block 48.2 % over 1,800 matches after it (47.3 % over 600 before). Coordinator check (2026-10-30): browser self-test 346 / 346; Training captures against MARA (Dummy "Sway at each strike", close scenario 2) with Kickboxing, Muay Thai, Wing Chun, Street Brawler and MMA attackers, high / mid / low strike each (Jab or Chain Punch, Front Kick or Teep, Low Kick): all 15 read "Result: swayed", no damage, and the strike passes the body with a visible gap.

## Phase 4 - Multiple opponents and lock-on

- [x] P4-01 - Support N fighters in one scene (players + enemies) for brawler levels; keep 1v1 path unchanged for 1v1 modes.
  Done when: a level runs with the P1-05 maximum enemy count at the P0-04 target frame rate on the low-spec test.
  Status (2026-10-28): done. Low-spec benchmark (640x360, CPU throttle 4, Warehouse with every object smashed, quality high): 1 player + 6 enemies main-thread work p95 5.3 ms (rule <= 8 ms), 1v1 3.2 ms; frame interval p95 18.2 ms in both, set by the test display. Combo counters per attacker-defender pair: done in P4-02.
- [x] P4-02 - Enemy group AI: attack tokens (limit how many attack at once), surround / flank positions, retreat, pick up weapons, use hazards.
  Done when: in a multi-enemy fight no more than the token count attack at the same time and enemies do not stack on one point.
  Status (2026-10-28): done (tokens, ring, retreat, per-attacker combos; Appendix C). Picking up weapons and using hazards are stubs (`considerPickup`, `considerHazard`) until P7 adds weapons and hazards.
- [x] P4-03 - Lock-on system: new `lock` action toggles engage / disengage. Target choice rules that never select a wrong target: only valid hostile, alive, not down (unless chosen), within range and view; prefer the enemy in the stick direction, then the nearest threat. Switch target by flick / direction. Auto-release when target is KO or out of range.
  Done when: Appendix C lists the target rules, and a scripted test of scenarios (crowd, behind player, behind wall, downed enemy, ally nearby, target KO) selects the expected target every time.
  Status (2026-10-28): implemented, rules and constants in Appendix C ("Lock-on and soft facing"). Self-tests "Lock-on: ..." cover the six scenarios plus range edges, glass / crate scenery, analog flick and tap switching, keyboard and held-stick movement never switching, release (also in a clinch), and the 1v1 case. Not yet tried by hand on a keyboard, pad or touch screen.
- [x] P4-04 - Without lock-on: automatic soft facing that attacks the most likely target, using the same rules as P4-03.
  Done when: attacks without lock-on face a valid target in the P4-03 scenarios.
  Status (2026-10-28): implemented (`MatchSim.softFace`, called when a human fighter's attack begins). Self-tests "Soft facing: ..." run the P4-03 scenarios with a punch instead of a lock press; the attack faces the expected enemy within 0.02 rad. Only in scenes with more than one enemy; a 1v1 is unchanged.
- [x] P4-05 - Lock-on indicator: diegetic or minimal marker on the target only.
  Done when: the marker is visible on all quality presets and adds no UI panel.
  Status (2026-10-28): implemented as a gold border and a chevron on the locked enemy's existing name tag (`.tag.lk`, `UI.tagMarker`); no new element. It is HUD, so no render-quality preset touches it; the self-test "Lock-on marker" checks that only the locked enemy's tag is marked, that no preset has a setting beyond render budgets, and (in the browser run) that the style rule exists and no rule hides tags. No marker in a 1v1 or Versus. Seen on screen in a 4-enemy Dojo brawl (gold border and chevron on the locked tag).
- [x] P4-06 - Camera for multiple fighters: keeps the player and the locked / nearest threats in view, handles walls and verticality.
  Done when: in all levels the player is never hidden behind geometry for more than a short moment and off-screen attackers are signalled.
  Status (2026-10-28): implemented, rules and constants in Appendix C ("Brawl camera"). Self-tests "Brawl camera: ..." (7): a scripted brawl in each of the three arenas walks the player to the spot as close behind every tall prop as a body can stand and measures the longest stretch the camera's own line test finds the player hidden (worst 0.63 s in the Dojo, under the 0.9 s limit; the run does hide the player in every arena, so it is not empty); a locked enemy 8.5 m away stays on screen; the enter / leave band; the player stays on screen with enemies all round and in each corner; a 1 m and a 3 m height difference; the edge arrow for an attacker behind the camera or beside the view and none for an on-screen or idle one; and the 1v1 / Versus camera output equals the recorded output of the old code. Not yet seen on screen: the arrow's look and the steeper view the camera takes when a prop hides the player were judged from numbers only. Not ticked.
- [x] P4-07 - Local co-op (up to 4 players) in brawler levels: shared camera, friendly-fire rule (DECIDE), revive rule (DECIDE).
  Done when: 4 local players (keyboard + gamepads) can play a level together.
  Status (2026-10-28): implemented, rules in Appendix C ("Local co-op (P4-07)"). Self-tests "Co-op ..." (13) cover the seats (also a pad returning in another slot) and join screen devices (also a button held when the screen reopens), the match set-up, four devices each driving only their own fighter, friendly fire off / on, the sit-out rule (lost when all are out, won when every enemy is out), the stage-start revive hook (unit level, no stages exist), the camera with a knocked-out lead, the setting and its save, the menu flow and the HUD / results strings. Not yet tried by hand: the join screen and the co-op HUD have not been seen on screen (360 x 640 and 1280 x 720 were designed from the CSS only) and nothing was played with real gamepads. Not ticked.
- [ ] P4-08 - Match setup (owner, 2026-10-29): choose the number of opponents, whether each slot is AI or human (local device now, online peer after Phase 12) and which team each slot is on (free-for-all or teams), in Versus, Free Fight and Brawl, within the P1-05 maximum. DECIDE how uneven teams stay fair (for example a handicap or a team-size cap) and record it in Appendix C.
  Done when: any allowed mix of AI and human slots and teams can be set and played on touch, gamepad and keyboard, and the P0-06 runner shows the uneven-team rule keeps win rates inside the P14-01 targets.
  Status (2026-10-31): implemented, rules, handicap numbers and measurements in Appendix C ("Match setup (P4-08)"). Free Fight and Versus setup screens have a Players and teams button, Brawl is a new mode; 2 to 8 fighters, each slot a player or the CPU, free-for-all or Teams A to D; one player plays on keyboard, gamepad or touch, two split keyboard and pads as Versus, three or four take keyboard 1 and gamepads. Uneven-team win rates (the smaller side, n 300, five shapes per level, within the P14-01 style-pair band: 40-60% at Hard and Expert, 35-65% at Easy and Normal): Easy 41.7-62.0%, Normal 36.7-60.3%, Hard 44.3-57.0%, Expert 48.0-55.7%. Self-tests "Lineup: ..." (14; the last one, the menu flow, needs the main menu, so the headless run fails it with the 16 browser-only ones). Self-test 377 / 377 in headless Chrome. Not ticked: the only thing left is the owner trying it on touch, gamepad and keyboard (the seats were driven with stubbed pads and the screens seen in headless Chrome at 1280 x 800 and 375 px wide, as with P4-07 and P6-06). A gamepad unplugged during a fight leaves its fighter idle, the same as in co-op today.
- [x] P4-09 - Camera never leaves the room (owner, 2026-10-29: when fighters move to the edge of the workshop the camera goes out and clips into the wall, only the outer wall is visible): on every level, in 1v1, brawl, co-op and replays, the camera stays inside the playable room (collides with or pulls in from walls, raises or tightens instead of passing through); walls between the camera and the fighters fade or cut away so the fighters stay visible.
  Done when: a self-test sweeps fighter positions along every wall and corner of every level and asserts the camera position is inside the room bounds and the fighters are on screen and not hidden by a wall; screenshots at a wall and in a corner on Warehouse and one other level show the fighters.
  Status (2026-10-29): verified by the coordinator in the browser: Warehouse left wall and back corner, Parking Garage right wall and corner, eye inside the room, both fighters in view, the pillar between camera and fighter fades; browser self-test 343 / 343.
  Status (2026-10-29): implemented. Root cause: `Camera.eyeAt` let the eye sit up to 5 m beyond the side walls (and 3 m beyond the back wall), and the aim was pulled in to 0.8 of the half size of the room, so with fighters at a side wall the camera swung sideways and stood about 1.5 m outside the wall, looking at its outer face. Now the eye stays CAMERA_WALL_MARGIN (0.6 m) inside the side and back walls; where the pose would cross a side wall the camera keeps its distance and turns toward straight on, and the aim may go out to 0.95 of the half size, so the fighters at the wall stay in the picture. The front is open (no front wall is drawn), so the camera still looks in over it. With the eye and the fighters inside the room no wall lies between them, so nothing needs to fade. Self-test "Camera (P4-09)": every level, 20 spots along the four walls and the corners, the pair standing along the wall and in from it, a 1v1, a brawl and a 2-seat co-op, on 1280 x 720, 800 x 360 and 390 x 844: the eye is inside the room, the 1v1 pair and the party are on screen. The same test fails on the old code (eye 1.5 m outside the wall). Not yet seen on screen. Not ticked.

## Phase 5 - Martial arts styles and animations

- [x] P5-01 - Build the style data model: per style move list, stance, guard, footwork, signature moves, grab strikes, throws, submission set, defense type default.
  Done when: all P1-04 styles exist as data entries and load in the creator.
  Status (2026-10-29): implemented, data model and rules in Appendix C ("Style data model (P5-01, P5-03)"). All 16 styles are rows of `MOVE_STYLE`; the creator's Movement row cycles all 16 (label, family, description, default defense); self-tests "Styles: ..." (6) cover the fields, the P1-04 families and defaults, share codes, random seeds, the creator, the Move list and an all-pairs AI smoke. Not yet seen on screen (the longer names "Brazilian Jiu-Jitsu" and "Kali / Eskrima" in the Movement row were not looked at on a 360 px phone). Not ticked.
- [x] P5-02 - Animations per style: identifiable and distinct per style, with overlap only where the real styles share technique (P1-04 families).
  Done when: each style has a written list of shared vs unique moves in Appendix C, and in Training each style is identifiable by stance and signature moves.
  Status (2026-10-29): implemented, table and rules in Appendix C ("Style animations (P5-02)"). 11 new attacks (Chain Punch, Trap Strike, Teep, Elbow, Spinning Back Kick, Jump Round Kick, Spinning Heel Kick, Angle 1 / 2, Parry Strike, Overhand) with 11 new strike pose builders, 2 style throws (Sambo Hip Throw, Guard Pull), 3 new hold poses (leg lock, armbar, wrist lock), tuned stances for Muay Thai, Taekwondo, Sambo and Hapkido, and the Training panel names the style and signature moves of both fighters. Self-tests: 4 new "Styles: ..." tests (frame-data band and ownership of the new moves, stance / pose / throw distinctness, AI use of every own move, style throws and hold poses); kept-style fingerprints, string shares and Block / Sway balance (47 / 54 at Hard over 300 seeds) are unchanged. Not seen on screen: the new poses were checked by joint numbers and key-point heights only. Open: BJJ ground game, MMA sprawl, Kali stick and triangle step, a real block-counter for Krav Maga (see Appendix C). Not ticked.
- [x] P5-03 - Rework the 7 existing move styles into the new style list (keep, merge or replace as decided in P1-04).
  Done when: old saves with an old style id map to the new style.
  Status (2026-10-29): implemented (`styleFor`, `LEGACY_STYLE_MAP`; identity for the 7 kept ids), tested with old share codes, old saves and the old-seed random fighters. Not ticked.
- [x] P5-04 - New preset fighters from P1-06 (look, style, stats, story settings, unlock rule).
  Done when: all preset fighters are selectable or unlockable.
  Status (2026-10-29): implemented, data and rules in Appendix C ("Preset roster (P5-04)"). 32 presets (6 kept unchanged + 26 new rows), unlock rule per non-starter, 5-bout Arcade ladder with rivals and bosses after the first clear, save migration. Self-tests "Presets: ..." (7) cover the fields and counts (2 per style, 16 F / 16 M, 16 Block / 16 Sway, roles 10 / 12 / 6 / 3 / 1), the kept six pinned to hard-coded values, costs / bodies / looks / theme words, the unlock simulation (all 32 reachable in 4 clears plus a streak of 8), the old-save migration, the picker markup and an AI match for each new preset against KAI. Seen on screen at 1280 x 720 and 360 x 640: the 33 cards scroll in the panel with Back / Confirm pinned; the hint line and the Arcade difficulty row now sit below the grid (scroll), and arrow / pad navigation steps one card at a time (a later UI task), no face art (P6-06), no per-fighter balance check beyond the AI smoke (P14-01), the bosses have no `bossAttrs`. Not ticked.
- [x] P5-05 - Non-combat animations: emotes, poses, idle, taunts, victory / defeat, reactions for story beats (Phase 10).
  Done when: the list from P10-02 is implemented.
  Status (2026-11-02): done: 28 poses plus the 6 victory poses play through `Fighter.storyPose`; contact poses are solved so hands reach what they touch for every roster build; each fighter's Intro emote plays for 1.2 s in the countdown and changes nothing in the fight (a seeded match is identical with and without it). Not used yet in character select, the creator preview, results or the Tournament elimination turn-away. `idle_stretch` holds one arm across the chest instead of alternating arms.
- [x] P5-06 - Attack animation audit and rework (owner, 2026-10-29: attacks look generic and similar for all styles): for every style, compare each attack's key poses (chamber, strike, recovery), hip and shoulder turn, footwork and timing against the real technique; give each style family its own look per P5-02, and fix moves that share one animation without reason.
  Done when: Appendix C lists the reworked moves per style; side-by-side Training captures show each style's attacks are distinct; frame data and hit boxes match the new poses, and the P3-10 / P14 balance runs still pass.
  Status (2026-10-30): implemented, reworked after the coordinator's review of the first captures (differences too small at the fight camera), audit table and rules in Appendix C ("Attack animation audit (P5-06)"). Every style now throws its hands and legs its own way at a size that reads at the fight camera: a technique row per style (`STYLE_TECH`: guard hand, stance legs, support leg, lean, turn, roll, chin, level, step, wind-up, turn on the support foot) on top of the shared strike poses, plus two own poses (`roundThai`, `roundTkd`); poses only, every gameplay field is pinned by a fingerprint taken before P5-06. Self-tests: 6 "Technique: ..." tests, among them one at the fight camera (key points projected at the measured camera: every style at least 28 px from its plain pose and 24 px from every other style on the cross and the round kick; measured minimums 29 and 27 px at 133 px a metre). Seen on screen at the fight camera (before / after for 16 styles and all 16 crosses and round kicks on one sheet, `%TEMP%\claude\bp5\p506b-*.png`). Browser self-test 363 / 363, headless 347 / 363 (the same 16 browser-only failures as before the change). Open: footwork between strikes and the walk of each style were not reworked.
- [x] P5-07 - Weapon attack animations (owner, 2026-10-29: weapon attack animations are wrong): per weapon class (one-hand swing, two-hand swing, thrust, overhead, chain / flexible, carried crate), a grip-correct swing arc from the hand, the weapon's own reach and a hit box that follows the drawn weapon; throws use the item's real release point.
  Done when: every weapon from P7-01 has a matching animation, its hit box follows the drawn weapon in a self-test, and Training captures show no weapon clipping through the body or swinging from the wrong hand.
  Status (2026-10-30): implemented, rules in Appendix C ("Weapon attack animations (P5-07)"); reworked after review (a gameplay leak and loose limits). Item steps no longer borrow the bare-hand hook / straight / overhand: 8 swing shapes (poke, forehand, backhand, chop, two-handed swing / chop / poke, low sweep) with wind-up, contact and follow-through key poses solved on the skeleton, so at contact the far end of the item (new key points 21-23) lands within 0.15 m short of the move's reach (0.12 m over at most), at the height the move hits; two-handed items keep both hands on the shaft (0.05 to 0.4 m apart on the key poses); the bike chain is 1.0 m long and bends; a crate is carried in both hands and pushed away; every throw releases with the hand within 0.3 m of the point the item appears. A worn-out item now breaks at a point in front of the fighter that no longer depends on the animation (the glass of a bottle is a real hazard: `breakHeld` used the drawn hand). Hit boxes, reach and frame data untouched. The one gameplay change is the bottle glass: it now breaks 0.3 m in front of the fighter instead of at the drawn hand. A fingerprint of every gameplay field (attack rows, item rows, items, string tables, throws, style fields, submission constants) is pinned. Self-tests: 7 "Weapons: ..." tests. Seen on screen (`p507-*.png`). Browser self-test 363 / 363, headless 347 / 363 (the same 16 browser-only failures as before the change). Open: the few ticks between two key poses are a joint-space blend (the left hand can drift 0.7 m off the shaft for a tick or two); no weapon clipping check beyond the captures.
- [x] P5-08 - Submissions made clear (owner, 2026-10-29, asked how submissions work): a prompt near a knocked-down opponent when the fighter's style can submit, a visible hold / escape contest meter, a Move list and Help entry per style, and a Training scenario. DECIDE whether styles without submissions get a basic hold.
  Done when: a new player can find, start, hold and escape a submission from the on-screen prompts alone (scripted check of the prompts and the Training scenario), and submission win rates stay inside the P14-01 targets.
  Status (2026-10-30): implemented, rules in Appendix C ("Submissions made clear (P5-08)"); reworked after review. A prompt over the foe a Grapple press would act on (the fighter's target) for every human fighter whose style can hold, Versus P2 included (HOLD with the button and the hold's name when free and in reach, STEP CLOSER up to 2.7 m, FOE ON ANOTHER LEVEL, TOO TIRED; nothing while the fighter is in a hit reaction, an attack or a throw), a meter over every hold in progress (escape bar, seconds left, hold name, one line per tap instruction; fits 375 px), a "Holds on a downed opponent" section with one line for each of the 16 styles in the Move list and in About & Help, and Training scenario 6 (dummy on the floor within reach and kept down at every dummy level, key 6; it can still tap to escape a hold). Decided: styles without holds get no basic hold. No rule changed (SUBMIT_* untouched, in the fingerprint), so the P3-10 / P14-01 win rates stand. Self-tests: 4 "Submission prompt / meter / Training scenario 6 / help" tests. Seen on screen (`p508-*.png`, 1280 x 720 and 375 x 667). Browser self-test 363 / 363, headless 347 / 363 (the same 16 browser-only failures as before the change).

## Phase 6 - Character customization

- [x] P6-01 - DECIDE: customization items per slot (tops, bottoms, shoes, gloves / wraps, headwear, accessories, hair, facial hair, tattoos / marks), Modern Urban only, distinct silhouettes.
  Done when: Appendix C has the item list with the counts from P1-05.
  Status (2026-10-29): decided, list and rules in Appendix C ("Customization items (P6-01)"): 91 items in 9 slots (31 exist, 60 new), Modern Urban only, distinct silhouettes, nothing that glows. Documentation only; P6-02 implements the 60 new items. Not ticked.
- [x] P6-02 - Implement the items with shared mesh generators to limit file size.
  Done when: all items render on all body types without clipping in the preview poses.
  Status (2026-10-29): all 60 new items are implemented as data rows (Appendix C, "Customization items built (P6-02)"); the self-tests cover rows, drawing on 8 body extremes in the 4 preview poses, clipping geometry, the 40-part worst case and share codes. Browser self-test 268 / 268; looked at on screen (balaclava, cap, hood, beanie with long hair, hoodie, cargo, work boots, backpack, bomber): no clipping seen, so ticked.
- [x] P6-03 - Fitness triangle: 2D picker, Y axis = Muscle, X axis = Weight. DECIDE whether it modifies stats or complements them (choose the most versatile setup, record the reason).
  Done when: the picker sets body shape in the preview and the gameplay effect follows the decision.
  Status (2026-10-29): implemented, decision (fitness complements stats), mapping and share-code fields in Appendix C ("Body, age and gender (P6-03 to P6-05)"). The Body tab has a square picker (drag or tap with mouse / touch) and Weight / Muscle rows (arrows, pad, keys); muscle shapes arms, chest and legs, weight sets the build, the build still gives the weight class. Self-tests "Body: ..." (4) cover the picker, monotone shape, stats, share codes, old codes and saves, random seeds and the kept presets. Not seen on screen (headless only). Not ticked.
- [x] P6-04 - Age slider: affects look (hair color, posture, face) and gameplay per the same DECIDE approach as P6-03.
  Done when: age changes preview and gameplay as decided.
  Status (2026-10-29): implemented (Age row, 16 to 70, default 28). Decision: age changes the look only, no stat (Appendix C). From 46 hair greys toward 85 percent at 70, the body leans forward up to 8 degrees, and from 55 a thin line is drawn on each cheek (below the hair, so every hair style shows it); up to 45 the look is exactly the old one. The 26 new presets use their `age`. Self-test "Body: age greys ..." covers it. Not seen on screen. Not ticked.
- [x] P6-05 - Gender option: affects body and look; gameplay effects (if any) decided in P14-02.
  Done when: selectable in the creator and saved in the share code.
  Status (2026-10-29): implemented (Gender row: Male, Female, Neutral). Shapes the body only (chest, arms, hips); no gameplay effect until P14-02 decides. Saved in the share code (appended field) and in the custom store; older codes and saves take Male, the original body. The 26 new presets use their `gender`. Not seen on screen. Not ticked.
- [ ] P6-06 - Face from photo: the player picks a local image; an oval crop tool (move / zoom) selects the face; the cropped image is projected on the character face. The image never leaves the device.
  Done when: works on mobile and desktop, cropped face stored locally in a size-limited form, CSP allows the needed image source (verify `img-src data:` / `blob:`), and renderer supports textured faces.
  Status (2026-10-29): implemented, decisions in Appendix C ("Photo faces and expressions (P6-06, P6-09)"). The Head tab has a "Photo" row (hidden when no face texture can be made): it opens the phone's camera / gallery or a file picker, an oval crop screen (drag, Zoom slider, Left / right and Up / down rows for keys and pad) cuts a 64 x 64 square, and a small JPEG data URL (at most 6,000 characters, 2,115 for the test picture) is kept in the fighter's save, never in a share code. The CSP is unchanged (data: is enough, no blob:). Seen on screen at 1280 x 800 and 390 x 844 (GPU Chrome, a synthetic picture through the real crop and save path); browser self-test 275 / 275. Not tried with a real camera or phone, and a pad button may not count as the tap a browser needs to open the picker. Not ticked: waits for a check on a real phone (camera / gallery pick, crop by touch).
- [x] P6-07 - Add texture support to the renderer for faces only (sampler, texture atlas or per-fighter texture), with a fallback for weak GPUs.
  Done when: a textured face renders on all quality presets; low preset falls back to procedural faces if needed.
  Status (2026-10-29): implemented, texture path and fallback in Appendix C ("Faces (P6-07, P6-08)"). One 512 x 512 face atlas on texture unit 0; a face is one opaque shell part over the head in the solid layer, so the part count never grows. It renders the same on low, medium and high (one part, one texture read: no preset needed the fallback, and one line in `FaceTex.cellOf` would add a low-preset rule); without a 2D canvas, after a failed upload or refill, or a GL error, the procedural eyes and brows stay (self-tests "Faces: ..."). Looked at on a GPU (NVIDIA, D3D11, Chrome and Edge) through the full creator flow; a "plain skin" report on another setup turned out to be a view of the back of the head; rechecked on the owner setup (Playwright Chrome, GPU): Face 3 draws from the front with brows below the hair, browser self-test 273 / 273. Ticked.
- [x] P6-08 - Pre-drawn faces: a set of procedural / pre-drawn face variations selectable instead of a photo.
  Done when: the count from P1-05 is available and selectable.
  Status (2026-10-29): implemented: 24 faces (the P1-05 count) from 24 compact rows (20 digits each, no per-face code), a "Face" row at the top of the Creator's Head tab (Classic, Face 1 to Face 24; Eyes and Brows then read "From the face"), saved in the share code and the custom store. Classic stays the default and draws exactly as before. Browser self-test 273 / 273, faces looked at on screen. Ticked.
- [x] P6-09 - Facial expression system: states hurt, tired, panting, rested, angry (plus others decided in P1-03). When an expression triggers, the face image swaps. For photo faces: DECIDE method (proposal: generated variations by warping eye / brow / mouth regions of the cropped photo, or overlays).
  Done when: expressions change in fights for pre-drawn and photo faces, triggered by game state (damage, stamina, round end).
  Status (2026-10-29): implemented, decisions in Appendix C ("Photo faces and expressions (P6-06, P6-09)"). Seven looks (rested / neutral, hurt, tired, panting, angry, win, shocked) chosen at draw time from fighter state; pre-drawn faces repaint from their own row with changed brow tilt, eye height, mouth curve and opening; photo faces get overlays (dark lids, brows, eye bags, open mouth) on the photo. Classic faces keep their procedural eyes and brows (no expression). Self-tests "Expressions: ..." and "Photo faces: ..." cover the state machine, the pool cells, and an identical fight with faces on and off; the seven looks of one pre-drawn face and of a synthetic photo looked at on a GPU. Not seen in a real fight on screen; the seeded fight test proves the looks change with game state (hurt appears, the sim is unchanged), so ticked.
- [x] P6-10 - Story settings in the creator: Country, Origin (social status / upbringing), Goal (examples from the ideas file: lose weight, make friends, revenge, psychopath). Lists from P10-01.
  Done when: all three are selectable, saved and included in the share code.
  Note (2026-10-29, from P10-01 / P10-05; the owner can change it): no new picker UI. Four rows in the Identity tab, cycled like every creator row (Left / Right one step, Up / Down next row): Country (64, in list order; the hint line shows city and region), Origin and Goal (24 each; the hint shows the one line, and the goal's motive), Intro (the intro emote, unlocked ones only). Saved as ids in the custom store; share code appends 4 fields after the face (country 0-63, origin 0-23, goal 0-23, intro emote 0-11; `SHARE_FIELD_COUNT_STORY` = 47); older codes and saves get CA, gymkid, title and the tone's intro emote. Lists, ids and defaults: Appendix C "Story lists (P10-01)"; emotes: "Arcade story structure (P10-02)".
  Status (2026-10-31): selectable, saved and defaulted, NOT in the share code yet, so not ticked. The Identity tab has Country (64), Origin (24), Goal (24) and Intro (12 emotes) rows with the one-line hints (city and region, origin line, goal line and motive) and a "Preview story" button; Randomize draws them from their own stream (`randomStory`). Stored as four additive fields on the custom record (`country`, `origin`, `goal`, `intro`, ids, after `look`): old saves, old stores and share codes load with CA, gymkid, title and the origin's tone intro (`storyFields`); an unknown or hostile value takes the default too, so a bad story field never costs a fighter. The share code (`SHARE_VERSION`, `SHARE_FIELD_COUNT_FACE` fields) and `CUSTOM_STORE_VERSION` are unchanged on purpose: the batch order puts the four share-code fields and both version bumps in P6-11, which also closes this task ("included in the share code"). Tests "Story settings (P6-10): ..." (3).
- [x] P6-11 - Bump share code version and custom store version; migrate old custom fighters and share codes.
  Done when: 1.0.0 custom fighters and share codes load correctly with defaults for new fields.
  Status (2026-11-01): done, this also ends P6-10's "not in the share code yet". Share code and custom store are version 2, with 47 fields; version 1 codes keep their six old field counts and load with defaults for `country`, `origin`, `goal`, `intro`. A store of another version still loads its valid fighters, and any store that cannot be fully used is copied to a backup key first (D26); nothing reads that copy back yet. Old codes and records compared identical to the previous build over 1,800 codes and 40 records; 40,860 hostile codes did not throw. "Skip stage" exists in the story engine only (2 lost tries, counts as a continue, the run can no longer be flawless); its button comes with the story play screen.

## Phase 7 - Weapons, items and hazards

- [x] P7-01 - DECIDE: weapon and item list (Modern Urban only: example types bottle, pipe, bat, chair, hammer, chain, trash can lid; final list per P1-05), each with class (light / heavy / throwable / two-handed), durability, damage, reach, speed, special effect.
  Done when: Appendix C has the table and each weapon has a distinct use.
  Status (2026-10-29): decided, Appendix C "Weapons, items and hazards" (14 items, each with a distinct use).
- [x] P7-02 - Pick-up rule: crouch near an item to pick it up (as in the ideas file). DECIDE how items placed above the floor (tables, racks, walls) are picked up, because the owner dislikes "crouch to take a hammer from a table" (proposal: the same input plays a reach / grab animation matched to the item height).
  Done when: decision recorded; items at floor, table and wall height can be picked up with one input and a fitting animation.
  Status (2026-10-29): implemented: one Use press, three grab poses by height, raised items reachable from any side within 1.0 m; self-tests "Items: ...".
- [x] P7-03 - Use input (owner decision, Phase 3: no hold): Use near an item while empty-handed = pick up; tap `use` while holding = throw it (aim from lock-on target or facing); Crouch + `use` = drop it.
  Done when: works on touch, gamepad and keyboard; throw hits the locked target in the P4-03 scenarios.
  Status (2026-10-29): implemented on keyboard, gamepad and touch (USE shows only near or holding an item; the press is buffered 12 ticks); throws go to the lock-on target.
- [x] P7-04 - Weapon combat: weapon move sets per class, durability and breaking, disarm on heavy hit, block / sway interaction.
  Done when: each weapon class has its move set and breaks or drops as defined.
  Status (2026-10-29): implemented: class strings (Kali stick 4 steps), durability and breaking, disarm on a strong step, knockdown, down state and throws, 1.5x block cost, specials; thrown items can be blocked (Appendix C). Poses and hand placement checked on screen only in the Warehouse brawl.
- [x] P7-05 - Hazards: environment dangers (DECIDE list, example types: electric panel, hot surface, open drop, breaking glass, falling objects) that players and AI can use.
  Done when: each hazard damages any character, can be triggered on purpose, and the AI uses at least one hazard per level that has them.
  Status (2026-10-29): 7 hazards (wet floor removed by the owner) from one shared handler; placed in the 3 current arenas, drop and train ready for P8; CPUs strike posts from safe spots, lure targets in and leave active zones; an unscripted seeded match per arena shows a CPU-triggered hazard. Self-test 312 / 312.
- [x] P7-06 - Pick up hazards and objects where approved in P7-01 (the ideas file says "pickup weapons and other Hazards").
  Done when: pickable hazards follow the P7-02 / P7-03 rules.
  Status (2026-10-29): the extinguisher, crate, bottle and brick follow the pick-up and Use rules; CPUs pick up floor items and throw.
- [x] P7-07 - Weapon models rework (owner, 2026-10-29: weapon models look bad): real proportions, recognisable silhouettes, material colours, and a grip point that lines up with the hand, for every item from P7-01, in the hand, on the floor and on tables / racks.
  Done when: a capture sheet of every item (floor, held, rack) shows recognisable shapes with the grip in the hand, within the P0-04 draw-call budget.
  Status (2026-10-31): implemented, visual only (Appendix C, "Weapon models (P7-07)"). All 14 items are rebuilt at real size from existing box and cylinder meshes in material colours, each with a grip part in the fist (the fist is within 0.04 m of the item through the first swing; exceptions: the two-handed chair, skateboard and broom and the carried crate, where both fists are within 0.065 m, and the crate is held by its sides, not a handle; the extinguisher is held by its carry handle with the canister leading); draw calls stay 9 (no new mesh or layer), triangles of the 14 items held 2,184 -> 3,424 (one item at most 512), a frame with a held bat and 12 loose items draws 476 -> 556 instances (408 with none loose); the loose chain is chunky enough to show at the low preset (640 x 360); reach, hit boxes, timings and both fingerprints are unchanged. 3 new self-tests (real size, grip in the hand through the first swing, loose items on the floor and a table); 380 / 380 in the browser. Capture sheets before and after: floor, held, swing, table and rack for every item (kept in the work folder, not in the repo).

## Phase 8 - Levels

- [x] P8-01 - DECIDE: new level list (Modern Urban only), count from P1-05, each with layout, verticality, destructibles, weapon placements, hazards, unstable surfaces, mode use (brawler, 1v1, tournament).
  Done when: Appendix C has a sheet per level.
  Status (2026-10-29): decided, Appendix C "Levels (P8-01, ...)": 8 level sheets (3 reworked, 5 new), shared deck / stair / scaffold data shape.
- [x] P8-02 - Rework the 3 existing arenas (Warehouse, Dojo, Pit): bigger, more destructibles, realistic weapon placement (on tables, racks, walls, not only on the floor), hazards, verticality.
  Done when: each matches its P8-01 sheet.
  Status (2026-10-29): Warehouse, City Fight Gym (id dojo, glass-block windows instead of shoji, sheet updated) and Pit rebuilt to their P8-01 sheets: larger, decks / stairs / scaffolds, items on tables, racks and wall brackets, hazards placed; CPUs route up and down every deck by a walking map; 4 new materials. Self-test 328 / 328 (browser). 1v1 fingerprints re-recorded for the new layouts (72:1phwk8i, 103:mtun1h, 80:1dpzzwv), old values kept in an engine-neutrality test on old-layout fixtures. Block / Sway 284 / 316 (47.3 percent). Follow-up for P14-05: a CPU can still be caught by a Pit steam jet's second activation (500+ ticks after the first) and by the Warehouse load at hard from one start position.
- [x] P8-03 - Build the new levels from P8-01.
  Done when: each matches its sheet and passes the P0-04 performance check.
  Status (2026-10-29): verified by the coordinator: browser self-test 343 / 343, no console errors; P0-04 check (low, 640x360, 4x CPU throttle, rooftop) work p95 12.8 ms with 6 enemies and 19.0 ms 1v1 on a machine loaded by three other test runs (earlier quiet-ish run 9.0 / 5.3 ms), accepted pending the quiet re-measure in P15-01.
  Status (2026-10-29): implemented, sheets and changes in Appendix C ("Levels", "P8-03 changes"). City Rooftop, Subway Station, Parking Garage, Construction Site and Night Club are in `ARENAS` / `ARENA_ORDER` (the arena select lists all 8) with the sheet counts of destructibles, items and hazards, their decks, stairs, scaffolds, ramp and collapses from the P8-04 generators, the `drop` and `train` hazards placed, 5 new floor patterns, 4 new box looks (car, kiosk, chair, ATM) and the bus-stop glass look, and their props. Brawl waves (rows `[count, x, z, rival, second entry]`, new code: `MatchSim.stepWaves`) on the 5 new levels and the Warehouse: the first wave stands at its entry, the next is called when at most 1 enemy is up, at most 6 are up, the last wave is led by `cfg.rival`, an entry waits (at most 300 ticks) while its spot is in a live hazard zone, then takes the other door. CPUs: a Hard CPU may bait its target toward a strike hazard (never a panel; at most once per 1,800 ticks, `hazardBait`, its own seeded stream) and never steps into an open drop; a collapse and what rests on it throw one piece budget; throws and item hits use the standard body height (size is cosmetic). Self-tests "Levels (P8-03): ..." and "Hazards (P8-03): ..." (arena list and select screen, waves, entries and door waits, drawing, drops / train / glass with the CPU unhurt, bait cost and spots, SimRunner waves) and the extended per-arena tests (build limits, stairs, CPU legs to every deck, strike hazards, ordinary matches in which a CPU uses a hazard in at least 3 of 12 seeds, 15 percent of 24 for the Club; the Gym and the Subway are exempt, panel only). Headless runner 327 / 343 (the 16 failures need the browser). Block / Sway at Hard, 300 seeds: 284 / 316 (47.3 percent), the 1v1 fingerprints and the engine-neutrality test unchanged. Bait cost, 40 seeds x 8 levels, CPU damage taken from a plain chaser: 7,408 off, 6,896 on (-6.9 percent), no level worse by two standard errors. Sim speed in the runner about 0.25 ms per tick on every level, as before; the P0-04 browser performance check and the look of the levels on screen are not done. Not ticked.
- [x] P8-04 - Verticality: scaffolds, stages, balconies, stairs; breakable floors / stages that collapse under weight or damage.
  Done when: at least the levels marked "vertical" in P8-01 have climbable and breakable elements, and P3-07 falling works on them.
  Status (2026-10-29): decks, stairs and scaffolds climbable in all 3 reworked arenas; decks collapse under damage or weight with fall damage for riders, crush for those below (up to 4 objects, deterministic); P3-07 falling and edge holds work on them; CPUs climb ledges up to 1.05 m.
- [x] P8-05 - 1v1 variants of levels (bounded area, optional ring-out per Tournament rules from P1-08).
  Done when: every 1v1 mode can use every level marked "1v1" in P8-01.
  Status (2026-10-29): verified by the coordinator: browser self-test 343 / 343 with the ring and 1v1 area tests.
  Status (2026-10-29): implemented, rules in Appendix C ("Levels", 1v1 areas). Every level has a `ring` row (centre, half sizes, ring-out flag); `Game.beginMatch` gives every 1v1 mode (Versus, Free Fight, Training, Survival, Arcade) the ring as its bounds (`Arena.setArea`: walls at the ring, or 1.5 m beyond it with ring-out on); fighters start at the ring centre; items and hazards outside the ring are not placed; the nav map and the CPU (cornered checks, throws into the edge, bait spots) use the ring as the wall. Setting "Ring-out" (off by default; Versus and Free Fight only, not Arcade, on the 4 levels marked yes): a fighter standing anywhere outside the ring (on the floor or on any footing, not in the air) loses the round with the reason `ringout`; the CPU does not step, run, sidestep, jump or lunge out of it (`holdAtRing`). `SimRunner.run` takes `ring` and `ringOut` for the Tournament simulation. Without the `ring` option a 1v1 plays on the whole floor, so the recorded fingerprints are unchanged. Self-tests "1v1 areas (P8-05): ..." (walls and start points of every ring with and without ring-out, items and hazards inside the ring, ring-out on the floor / in the air / on a deck, sofa and step, CPU never walks out in 24 edge and corner set-ups, seeded CPU against CPU 1v1 on all 8 rings with and without ring-out and repeating exactly). Not done: the Tournament itself (P11), a ring-out option on the match setup screen (the setting is in Options), and the browser flows were not run. Not ticked. [Superseded by P17-08 (2026-11-03): a 1v1 now has the whole room; the ring is the fighting area only with the Ring-out setting on (Free Fight, Versus) or in a Tournament bout. See Appendix C "P17-08 arena bounds".]
- [x] P8-06 - Debris and destructible budget per quality preset.
  Done when: the worst-case scene stays within the P0-04 target on the low preset.
  Status (2026-10-29): per-preset debris and rubble caps (hidden heaps over budget drawn as one block). Low-spec benchmark (640x360, CPU throttle 4, quality low, Warehouse): 1v1 frame p95 18.3 ms, work p95 5.9 ms (rule 8 ms). 1 + 6 enemies, A/B against the previous build on the same busy machine: work p95 9.1-9.6 ms vs 7.7-8.8 ms (about +0.5 ms p50 from the larger levels and the walking map); re-measure on a quiet machine after P8-03.

## Phase 9 - Interactivity and emergence (immersive-sim style)

- [x] P9-01 - DECIDE: system rules matrix - which materials, objects, hazards, characters and states interact (examples: thrown object breaks glass, broken floor drops characters, electric panel + water, crowd / bystander reactions). Keep rules generic so combinations emerge without special cases.
  Done when: Appendix C has the matrix and each rule has one implementation function, not per-level scripts.
  Status (2026-10-29): decided, Appendix C "System rules matrix (P9-01, ...)": 9 materials x 6 damage types, 5 states, 9 rules each mapped to one function (built in P9-02).
- [x] P9-02 - Implement the matrix as shared systems (material, physics impulse, damage type, state flags).
  Done when: every matrix rule can be triggered in at least one level and AI can cause it.
  Status (2026-10-31): built, Appendix C "P9-02 as built" (function per rule, where each triggers, how a CPU causes it, three coordinator DECIDEs). Tests "Rules R1" to "Rules R9". Follow-up (2026-10-31): the 1v1 seat bias of the rings is fixed (start side drawn per match and swapped every round), Appendix C "1v1 seat balance (P9 follow-up)".
- [x] P9-03 - Persistent state within a level (broken objects stay broken, dropped items stay, damage marks remain) within the performance budget.
  Done when: state persists for the whole level on all quality presets.
  Status (2026-10-31): objects, rubble, cracks and items persist (they always did; now tested over 40 s and a new round); new fixed pool of 32 floor marks (scorch, glass, dust), the newest 10 / 20 / 32 drawn on low / medium / high; test "P9-03". Numbers in Appendix C "P9-02 as built".
- [x] P9-04 - Theme fixes from P1-07.
  Done when: no item in the P1-07 list remains.
  Status (2026-10-31): every V and every B row with a fix is done (list under the P1-07 audit); the B rows marked Keep stay by decision. Test "Theme (P9-04)".

## Phase 10 - Arcade story, progression and unlocks

- [x] P10-01 - DECIDE: lists of Countries, Origins, Goals (counts from P1-05, varied), each with story effect.
  Done when: Appendix C has all three lists.
  Status (2026-10-29): decided, Appendix C "Story lists (P10-01)".
- [x] P10-02 - DECIDE: Arcade story structure: shared stages plus beats / events that change by Country, Origin and Goal; mini cutscenes made with in-engine animations, emotes and poses (not attack animations). List every needed non-combat animation for P5-05.
  Done when: Appendix C has the beat table (setting -> beats) and the animation list.
  Status (2026-10-29): decided, Appendix C "Arcade story structure (P10-02, ...)" with the beat table and the 34-entry pose list for P5-05.
- [x] P10-03 - Implement the story system (data-driven beats, conditions on the three settings and on player choices / results).
  Done when: two characters with different settings get different beats in the same Arcade run.
  Status (2026-10-31): implemented as the story engine, decisions in Appendix C "Story system (P6-10, P10-03)". Tables for the 64 countries / 10 regions, 24 origins, 24 goals, 6 motives, 3 tones, 16 beats and 40 text rows (`STORY_*`), one `Story` object: `start` (a run: rivals, boss, levels, all plain values), `cfg` (the MatchSim / `Game.beginMatch` config of each of the 7 stages), `moment` / `beat` (the boxes of a beat, chosen by conditions on settings, choice, result and continues), `win` / `retry` / `choose`, `cast` (scene positions from the match start side). Story fights are ordinary matches: the Arcade 1v1 (2 wins, 60 s, no ring-out, ZERO's boss tuning) and the level's waves, three new optional match fields (`keepSeed`, `waveKeep`, `waveCut`), no combat rule touched. A "Preview story" screen in the creator lists the 7 stages and every beat for a fighter, with the choice, result, tries and clears switches (keys, pad and touch, 375 px phone checked). Self-tests (6 "Story (P10-03): ..."): data and texts (every row reachable, at most 90 characters with the longest tokens), two fighters get different beats, rivals / boss / levels for every fighter and country, wave shaping and start side, stage configs, and a whole run through real headless matches (7 stages, all 16 beats). Open: the Arcade menu still plays the old 5-bout ladder until P10-06 uses `Story`; the scenes (and the pause at the last wave entry of stage 3, beat B7) are P10-04; goals cleared and the reward toast are P10-05; the region's sign hue is stored (`Story.signHue`) but not painted on the level posters, billboard and kiosk faces yet.
- [x] P10-04 - Mini cutscenes: in-engine, skippable, short, mobile readable text.
  Done when: every beat in P10-02 plays and can be skipped.
  Status (2026-11-02): done for the creator's "Preview story": all 16 beats play alone or in order and can be skipped on touch, gamepad and keyboard; B5 asks its question as two cards. Checked by eye at phone width. There is no story play screen yet, so these wait for P10-06: B7's pause in the fight (the match already sends `waveBeat`), the "Skip stage" button, and the "Story scenes" (Full, Short, Off) and "Auto-advance" settings.
- [x] P10-05 - Progression and unlocks: clear list of what unlocks what (fighters, styles, items, levels, faces, emotes, modes) and how; shown in a menu.
  Done when: an unlock screen shows locked items with the requirement, and `Progress` save migrates from 1.0.0.
  Status (2026-11-02): done: an Unlocks button on the main menu lists the 22 fighters to earn, open or locked, with each rule and the progress towards it; a line says the starters, arenas, modes, styles, items, faces and intro emotes are open from the start, because the game has no locks for those yet (the Appendix C `UNLOCKS` plan is not built). `Progress` needed no new fields for this screen.
- [x] P10-06 - Arcade uses brawler levels (multi-opponent) and 1v1 boss / rival fights (hybrid direction).
  Done when: a full Arcade run mixes both fight types.
  Status (2026-11-02): done: Arcade plays the 7-stage story run (brawl, 1v1, brawl, 1v1, brawl, brawl, 1v1) with its scenes. A loss offers Retry, and "Skip stage" from the second loss of a stage (a continue, scores 0 in the run grade, credits no win or unlock), never on the last stage, so a clear needs a real win of the champion. B7 pauses the fight at stage 3's last wave and leaves the fight identical; "Story scenes" (Full, Short, Off) and "Auto-advance" are in Settings. `ARCADE_ARENAS`, `ARCADE_STAGES` and `arcadeDifficulty` are now used by tests only (P15-03 can remove them). Quitting loses the run until P10-08.
- [x] P10-07 - Fight results grade: a letter or star grade from time, damage taken and move variety, shown on the results screen; no input; best grade per mode saved in Progress.
  Done when: the grade comes from one pure function, is shown on RESULTS, is saved and migrates from the 1.0.0 Progress, and a self-test checks three sample fights.
  Status (2026-11-02): done: `fightGrade` scores time 40, damage 35, variety 25, a loss gets "-"; the best letter per mode is saved in `Progress.grades`. Arcade saves one grade for a cleared run; Free Fight, Survival, Brawl and Co-op save theirs (lineups under `brawl` or `free`); Training and Versus get none; the Tournament key waits for P11.
- [x] P10-08 - Continue Arcade: save the story run in `Progress` (`arcadeRun` in Appendix C) so quitting does not lose it, and offer "Continue Arcade" on the main menu.
  Done when: a run quit at any stage continues at that stage with its continues, flawless state and B5 answer; a finished run offers no continue; old saves load.
  Status (2026-11-02): done: "Continue Arcade" is the first main menu item while a run is saved. A lost or left fight counts as a spent retry, and stage scores are kept for the run grade. Known gap: closing the page in the middle of a fight costs nothing, so Continue is then a free retry.

## Phase 11 - Tournament mode

- [x] P11-01 - Tournament mode modeled on the Budokai / Budokai Tenkaichi tournaments (rules from P1-08): elimination bracket, entrant count from P1-05, AI fill for empty slots, rewards.
  Done when: a full tournament runs from bracket draw to champion.
  Status (2026-11-02): done: 1-4 people join on the seat screen, CPUs fill an 8 or 16 bracket, CPU fights are simulated one per tick with progress shown, and the bracket is saved so the Tournament menu offers "Continue tournament". Closing the page in a fight counts as a loss. A single person's wins, best finish and grade are saved; 2-4 people earn nothing, and the join screen says so. Not built yet from Appendix C: tiers, the rules screen, the separate save key, Face rewards and the rooftop final.
- [ ] P11-02 - Tournament with multiple humans: local (up to 4) and online (up to 4, Phase 12); AI vs AI matches can be watched or simulated (P0-06 runner).
  Done when: a tournament with 2-4 humans runs locally and online.
  Status (2026-11-02): local part done: each person's fighter reads only that person's controller or keys. Continue on a saved bracket with 2 or more people still in sends them through the seat screen, with their fighters locked on the cards. A CPU fight that fails ends the work with a toast, and an open two-person fight is settled when the bracket opens, not on the menu. Open: online (Phase 12) and watching CPU fights.
- [x] P11-03 - Bracket screen readable on mobile.
  Done when: the bracket fits a phone screen in landscape with scroll only if the count exceeds 8.
  Status (2026-11-02): done: at 640 x 360, 8 fighters fit with no scroll (40 px cards, one-line round headers and status). With 16, only the first-round column scrolls, to the next match. A browser self-test draws the bracket and checks the fit at the window size of the run.

## Phase 12 - Online multiplayer

Not started on 2026-11-03: moved to the Path section (P12-01, P12-02, P12-03, P12-04, P12-05, P12-06, P12-07).

## Phase 13 - Audiovisual feedback

- [x] P13-01 - DECIDE: feedback list, strong and diegetic (on the characters and the world), keeping only obvious UI (health, stamina, timer). Examples to evaluate: bruises and swelling, sweat, torn clothes, breathing / panting, expression faces (P6-09), impact sound layers, camera shake / zoom, hitstop, slow-motion finishers, crowd / bystander reactions, debris, controller rumble.
  Done when: Appendix C lists accepted feedback with its trigger and cost.
  Status (2026-10-29): decided, Appendix C "Feedback list (P13-01) ...".
Not started on 2026-11-03: moved to the Path section (P13-02).
- [x] P13-03 - Settings to reduce intense effects (shake, flashes) for accessibility.
  Done when: each intense effect has an off / reduced option.
  Status (2026-11-02): done: Camera shake (0 to 1, it also scales the field-of-view pulse) and Reduced motion were there; new are Flashes and Controller rumble (Full, Reduced, Off) and Strike trails (On, Off). Turning Reduced motion on sets those three once, and each can be changed after. Reduced motion no longer shortens hitstop, so it cannot change a fight. No club strobe, slow-motion finisher or heartbeat exists to cover. Defaults keep today's look.

## Phase 14 - Game design and balance

- [x] P14-01 - Define the balance targets (example: win rate range between equal-skill AI per matchup, time-to-KO range).
  Done when: targets are in Appendix C.
  Status (2026-10-29): decided, Appendix C "Balance targets (P14-01)".
Not started on 2026-11-03: moved to the Path section (P14-02, P14-03, P14-04, P14-05).

## Phase 15 - Performance and file size

Not started on 2026-11-03: moved to the Path section (P15-01, P15-02).
- [ ] P15-03 - Reduce file size: remove dead code and duplicated data, compact data tables, share generators, shorten repeated strings. Keep the file readable (no build step).
  Done when: final size recorded and compared to the baseline in Appendix C.
  Status (2026-11-03): first pass done, not ticked (the final pass comes after all content is in): `breakpoint.html` 1,199,913 -> 1,157,562 bytes (LF, BOM counted), 42,351 freed with no change to play; comments, 15 dead names and nothing else. Numbers, removed symbols and what was kept: Appendix C, "P15-03 first size pass (2026-11-03)".
  Final pass: listed in the Path, Stage 17 (after P15-02, before the final audit).

## Phase 17 - Owner playtest feedback (added 2026-10-31; do it before Phase 16)

Numbered after the other phases because it was added later; Phase 16 checks the result. Owner's text verbatim in Appendix A.

Not started on 2026-11-03: moved to the Path section (P17-01, P17-02).
- [ ] P17-03 - Sway: sway sideways (left and right) as well as back; reduce the spine angle; make the sway window easy to time against enemy attacks. DECIDE the directions, window length and what each direction avoids.
  Owner (2026-11-02): the spine still goes too far back, and a side sway must lean towards its own side instead of tipping back. Fact: `SWAY_POSE` leans the torso back 0.9 rad (about 52 degrees) with the head 0.4 rad further back, and a sideways sway adds roll 0.5 but "still tips back". The 'Sway pose' self-test needs head and torso 0.1 m clear of every style's strikes, so a smaller lean needs more root or hip movement to stay clear. This look is visual only and the i-frames stay the same.
  Owner (2026-11-02): pair the spine and head with other movement (backsteps, sidesteps, lowering the torso); the coordinator suggests the joints and applies them. Proposal, modelled on boxing slips and the lay-back; the angles are starting values to tune against the 'Sway pose' self-test:
    - **Back sway (lay-back):** a half backstep (root back about 0.25-0.3 m, weight onto the rear foot), torso back only about 15-20 degrees, knees bent about 0.2, and the chin tucked (the head tilts slightly forward against the torso, never further back). The clearance comes from the step, not the spine.
    - **Side sway (slip):** no backward tilt at all. The torso bends sideways about 15-20 degrees towards the slip side and turns about 20 degrees, the root shifts sideways about 0.25 m with a small sidestep onto that side's leg, and the knees drop the root about 0.08-0.12 m. The head moves outside the strike line and stays level, with the eyes on the opponent (the neck counter-rolls).
    - **Optional duck (bob) against high strikes:** knees bend so the root drops about 0.15-0.2 m, the hips hinge forward about 20 degrees, and the head stays up. Decide in P17-03 whether it is its own direction or part of the side slip.
    - The pose is reached on the first i-frame tick and back upright SWAY_POSE_RETURN_TICKS after them, as today; the feet slide with the root shift so they do not skate.
  Done when: Appendix C has the rule; sway left / right / back works on touch, gamepad and keyboard; sway fighters meet the P14-01 targets with the P0-06 runner.
  Status (2026-11-03, open): the pose is reworked as the proposal above (back step with a 17 degree lay-back and a tucked chin; side slip with a 17 degree bend, a 20 degree torso turn, a 0.25 m shift, a 0.2 m step back and a 0.08 m knee drop, head held at its guard stance; the root offsets ease back over the recovery); numbers and clearance in Appendix C "P17-03 sway pose (2026-11-03)". Verified: the pose by the headless self-tests (441 of 458 pass headless (the 17 browser-only checks), 458 of 458 in the browser; the 17 failures are the known 16 "needs the main menu" plus "blank faces" of the stubbed browser; the AI fingerprints are unchanged because the sim is). Not verified, still open: the timing window and the three directions on touch, gamepad and keyboard on a device, the P14-01 targets with the P0-06 runner (the sim is untouched, so they should not move), and the side-sway clearance (6 listed style / strike combinations on a `swayDir` -1 slip and 1 sweep on `swayDir` +1 are still 0.00-0.10 m short of the 0.1 m gap, Appendix C). Known limit: the drawn step is clamped to the ring walls (`swayRoom`) but not to other fighters or props. The optional duck (bob) is decided as not added for now: it needs its own input direction and AI rule (a sim change, not a pose), and a root drop makes the low-kick clearance of the slip worse (measured: a deeper drop made the clearance worse), so it stays a later option.
- [ ] P17-04 - Move list: one move list for the current fighter and style only, showing only moves that fighter can do now (shared moves included where they apply).
  Done when: the move list in every mode shows only the current fighter's style and its shared moves, with inputs for the active device (touch, gamepad, keyboard), readable at phone width.
  Status (2026-11-03): done in code, awaiting the owner's look on a phone. The Move list now shows one fighter: in a paused fight the fighter of the person who paused (the seat in Versus, a lineup, a bracket or a co-op; a watched fight with no person in it uses the picked fighter), from the menus the fighter picked last (KAI when none). It lists the strings that fighter has now (an item in hand replaces the style's Punch steps with its own; a crate in the arms leaves the kick strings and the grab only), the moves every fighter has, the clinch strikes, the throws the fighter really has, the tackle only for a heavy fighter and the holds only for a hold style, with the buttons of the device in use. Details in Appendix C "P17-04 move list (2026-11-03)". Verified by the headless self-tests (449 of 466 pass; the 17 failures are the known 16 "needs the main menu" plus "blank faces"). Not verified: how it reads on a real phone, and the widths: the width test lays the Move list and nine other menu screens out in frames of 375 x 667, 640 x 360 and 1280 x 720, which only a browser run can do (the headless stub passes it as "skipped"; a browser that measures nothing fails it). A browser run found a 2 px sideways scroll of every screen at 375 px; the cause and fix are in Appendix C.
- [ ] P17-05 - Remove design and developer notes from all player-facing text (example: "Strong moves cost more stamina....of the attack strings below" in the moves menu). Code comments are not player-facing and stay.
  Done when: a scan of every menu, hint, tooltip and help string finds no design or developer notes; Appendix C lists what was removed or rewritten.
  Status (2026-11-03): done in code, awaiting the owner's read. Every string literal of the game was listed and read (not only the screens); 14 texts were removed or rewritten, listed old and new in Appendix C "P17-05 player text (2026-11-03)". The 'Player-facing text (P17-05)' self-test scans every screen the tests can open (menus, mode screens, Controls, Move list, Settings, Unlocks, About, Pause, results, Story, the creator tabs, the Training panel) and the label / description tables for a task id (`/\bP\d{1,2}-\d{2}\b/`) and a list of design words.
- [x] P17-06 - Crouch and context-sensitive actions are hard to use, especially on mobile. DECIDE a simpler scheme (pick up, use, throw, crouch) that keeps P2-01's no-clutter rule.
  Done when: Appendix C has the scheme; every context action works on touch, gamepad and keyboard without crouching to reach a table item; a phone-width playtest of pick up, use and throw succeeds every time.
  Status (2026-11-03): done; ticked 19:40 after The owner said at 19:36, verbatim: "1.,3.,4. select the correct option among the options" (the hold question was one of them: the hold is kept, see Appendix C). The 375 px self-tests stand in for the phone playtest; the owner's own phone look is still welcome. Scheme in Appendix C "P17-06 context actions (2026-11-03)": Use alone takes the ringed item (in front, else the nearest within 1.4 m on any side, floor to shelf, never through a wall); a short Use throws when the finger lifts; a held Use (0.5 s) puts the item down; no item action needs Crouch, on touch, gamepad or keyboard; no new button. The CPU's reading and every fingerprint are unchanged. Headless 473 of 490; the 17 failures are the known 16 "needs the main menu" plus "blank faces". Self-tests: seven 'Use (P17-06)' tests (every kind on every placement row on the three devices; throw and set down; walls and reach; several items; the ring; 375 px phone width; the Controls and Move list text). Not verified: how it plays on a real phone, and the sound and look of the ring in a browser. Owner to confirm: set down is now a hold of Use (P7-03 said "no hold"; the throw stays a tap).
- [ ] P17-07 - Items placed on tables and other surfaces sink into them (example: the Construction site).
  Done when: a self-test places every prop on every level and finds each resting on its surface, not intersecting it; same after a throw lands on a table.
  Status (2026-11-03): done in code, awaiting the owner's look in a browser. Cause and fix in Appendix C "P17-07 items on surfaces (2026-11-03)": tables, benches, barriers and the kiosk were drawn 3-4.5 cm above the height the items rest at, and an item thrown or dropped onto a low table fell through or was pushed aside. Self-tests: 'Items on surfaces (P17-07)' (every placement row of every level; every table, bench, crate, kiosk and kerb dropped and thrown onto).
- [ ] P17-08 - Arena bounds: remove restrictive bounds (Night Club; the yellow borders on the Construction site) so levels feel free to explore and destroy. DECIDE the new bounds per level.
  Done when: Appendix C has the bounds per level; each level can be walked to its real walls and its destructibles reached; the camera stays inside the room (P4-09 rule); AI and multi-opponent fights still work; P0-04 check passes.
  Status (2026-11-03): done in code, awaiting the owner's look in a browser and the P0-04 frame check. Cause and the decision per level in Appendix C "P17-08 arena bounds (2026-11-03)". What boxed a 1v1 in was the level's ring (the Construction slab with its yellow tape, the Night Club dance floor, the Gym mat, the Rooftop helipad), not the level bounds: every plain 1v1 fought inside it. Now a 1v1 (Free Fight, Versus, Arcade, Survival, Training) has the whole room, and the ring fences Free Fight and Versus in only when the Ring-out setting is on (on a level with a ring edge); the Tournament too (owner, 2026-11-03 15:11: "use the whole room for tournament": its live bouts and its simulated CPU fights are set up like every other 1v1; a saved bracket carries no ring data, so it continues). The first fighter's start side is still drawn from the seed and swapped every round for every 1v1 but Training (`cfg.sides`, set by `Game.beginMatch`; it was lost for a moment with the ring, and the reviewer measured Garage 70%, Construction 26.7%, Rooftop 38.3% and Subway 36.7% without it, Appendix C). The cutscene cast of an Arcade duel stands on that start side. The eight bounds stay as they are (every object stands flush against them, which the 'Levels' test requires); the drawn walls that stood 0.2 to 0.8 m behind them now stand 0.1 m behind, so a fighter walks up to the wall. Self-tests: 'Arena bounds (P17-08)' (10: walls and corners, every destructible reachable by a walking path, camera, spawns / hazards / items / wave entries, CPU 1v1 and brawl on every level, the ring default in five modes and its restart, wall decoration on its wall, the Tournament bout, the drawn start side, the drawn opening spot of a SimRunner 1v1) and the Story start-side test now plays every stage through `Game.beginMatch`. Headless 459 of 476; the 17 failures are the known 16 "needs the main menu" plus "blank faces". No fingerprint changed (none covers an Arcade fight) and the balance runs are identical before and after (the sim never had the ring in them). Not verified: how the nearer walls and the open Night Club and Construction 1v1 look and play in a browser; P0-04.
Not started on 2026-11-03: moved to the Path section (P17-09, P17-10).
- [x] P17-11 - Sway polish (review lows of 9e796fe): the head snaps for one tick when a slip is hit on recovery tick 12-13; the torso correction is exact only at the target pose, not on the way in and out; `swayRoom` keeps the drawn sway inside the walls but not inside ring ropes or props. Owner (2026-11-03 13:21, on the 7 `shortSlips` of P17-03, verbatim "Yes, add it" to the coordinator's advice): the other 6 short slips are accepted (4-10 cm of air, like a real slip), but the Hapkido heavy roundhouse slip (swayDir -1, about 0 cm of air, the kick visibly touches the chest) must be fixed with a deeper step back or a small duck for curving strikes only.
  Done when: the Hapkido heavy roundhouse slip leaves at least 4 cm of air between the drawn kick and the torso, its `shortSlips` floor is raised to match, and the other 6 entries stay at or above their floors; a self-test hits a slip on every recovery tick and finds no head jump over one tick's normal motion; the torso stays level with the target bend and turn through the whole sway (self-test on the in-between ticks); no drawn sway passes a ring rope or a solid prop on any level (self-test); fingerprints unchanged.
  Status (2026-11-03): done in code, not ticked until the owner's look. All four points are fixed and each has a self-test that fails on the old code; cause, fix and numbers in Appendix C "P17-11 sway polish (2026-11-03)". The Hapkido heavy roundhouse slip now leaves 8.1 cm of air (was 0); the other 6 short slips are untouched; no fingerprint changed. A hit on a slip no longer snaps the head, the torso is exactly level on every tick (a tilt off by up to 1.3 degrees on the first tick before), and a slip is stopped by props and ropes as it was by walls (it used to go up to 27 cm into them).
- [x] P17-12 - Sofa: items placed on or dropped onto a sofa rest 0.29 m above its seat, because the collider is the sofa's full height.
  Done when: items rest on the drawn seat within 1 cm (and on the back or arms where they land there); the 'Items on surfaces (P17-07)' self-test covers the sofa.
  Status (2026-11-03): done in code, awaiting the owner's look in a browser. A loose item now lies on the highest drawn part under it (cushion, back, arm), not on the sofa's full-height collider; the review fixes (an invisible edge in front of the sofa, drops beside the back and arms) are in too. Cause and fix in Appendix C "P17-12 and P17-13 (2026-11-03)"; self-test 'Items on surfaces (P17-12, P17-13)'.
- [x] P17-13 - Items thrown at car roofs and racks drop beside them instead of landing on top.
  Done when: an item thrown or dropped onto a car roof or a rack shelf comes to rest on it within 1 cm, and one that hits a side drops to the floor (self-test on every level that has them); thrown-item hits on fighters unchanged.
  Status (2026-11-03): done in code, awaiting the owner's look in a browser. Car roofs, bonnets, boots and the top rack shelf now hold an item that lands on them; an item thrown at a side still drops to the floor; the review fixes (an invisible edge in front of the car, drops beside the windscreen) are in too. Cause and fix in Appendix C "P17-12 and P17-13 (2026-11-03)"; self-test 'Items on surfaces (P17-12, P17-13)'. A lower rack shelf only holds the items placed on it; one thrown into the open bay under the top shelf counts as a side hit.
- [x] P17-14 - Move list: the "carrying" hint for a crate does not say that Use throws it.
  Done when: the carrying hint names Use (throw) and Grapple (drop and grab) with the active device's buttons; the 'Move list (P17-04)' tests check it.
  Status (2026-11-03): done in code. The crate hint now reads "Use [button] throws it; Grapple [button] drops it and grabs." with the buttons of the device in use. Details in Appendix C "P17-14 and P17-16 (2026-11-03)".
- [x] P17-15 - Self-test runner: a test whose detail starts with 'skipped: ' counts as a pass, and the summary line does not count skips, so a hidden browser pane can skip a check unseen.
  Done when: the summary shows passed, failed and skipped counts; the browser runs list each skipped test by name; no test that a real browser can run is skipped there (check in headless Chrome).
  Status (2026-11-03): done; the coordinator's Chrome run (Playwright, 1280 x 720) gave 483 passed, 0 failed, 0 skipped, and the guard passed. The summary now reads "N passed, N failed, N skipped (of N)" and lists each skipped test by name (on screen and in the console); a new last self-test fails if anything was skipped where a real layout engine exists. Details and the two tests that can skip in Appendix C "P17-15 skipped self-tests (2026-11-03)".
- [x] P17-16 - Simulated Arcade fights (`Story.simOpts`) never pass items or hazards, so a stage simulated headless plays bare-handed while the live stage follows the settings (review low of P17-08, older than it).
  Done when: `Story.simOpts` passes the same items and hazards options as the live stage; a self-test compares the options of a live and a simulated stage on every Arcade stage; story and balance tests pass.
  Status (2026-11-03): done in code. `Story.simOpts` now passes `items` and `hazards` from the Options, as `Game.beginMatch` does for the live stage. Details in Appendix C "P17-14 and P17-16 (2026-11-03)".

## Phase 18 - Owner feedback of 2026-11-01 (do it before Phase 16)

Numbered after the other phases because it was added later; it follows Phase 17 (abilities build on P17-09's distinct styles) and Phase 16 checks the result. Owner's text verbatim in Appendix A.

Not started on 2026-11-03: moved to the Path section (P18-01, P18-02, P18-03, P18-04, P18-05, P18-06, P18-07, P18-08, P18-09, P18-10, P18-11, P18-12, P18-13, P18-14, P18-15, P18-16, P18-17, P18-18, P18-19, P18-20, P18-21, P18-22, P18-23, P18-24, P18-25, P18-26, P18-27, P18-28, P18-29, P18-30, P18-31, P18-32, P18-33).

Where the tasks came from (owner text verbatim in Appendix A): P18-01 to P18-25 from the owner feedback of 2026-11-01; P18-26 to P18-31 from the friend feedback of 2026-11-02; P18-32 to P18-35 from the Arcade playtest of 2026-11-03; P18-36 found during P18-34; P18-37 to P18-40 from the owner ideas of 2026-11-03 19:56. P18-41 from the owner answers of 2026-11-04 00:30; P18-42 and P18-43 from the owner tasks of 2026-11-04 05:40. The game stays 3D (owner, 2026-11-02).

- [x] P18-34 - CPU item throws: the CPU throws pickable items very often. Measure throws per minute per difficulty and mode today, DECIDE a rate that keeps items a treat (a cooldown, a chance by distance and situation, a cap per fight, fewer on Easy), and apply it to enemies and allies.
  Done when: Appendix C has the before and after rates; a self-test over seeded fights keeps each difficulty inside its decided rate; the CPU still picks up and uses items (P7 tests pass).
  Status (2026-11-03): done in code. A team's CPUs fetch a throwable or a crate only once per rest window (Easy 90 s, Normal 60 s, Hard 45 s, Expert 40 s, `AI_TOSS_REST_TICKS`), enemies and allies alike, no random number; brawl throws per minute fell 39 to 54 percent and the most in one fight from 4 or 5 to 1 to 3. Before and after rates, the decision and the rejected ideas are in Appendix C "P18-34 CPU item throws (2026-11-03)". Self-tests "CPU item throws (P18-34)" (2). Two hazards-and-items fingerprints re-recorded and the Brawl camera and 1v6 brawl tests moved from seed 5 to 6 (reasons in Appendix C; a camera weakness and bodies squeezed in a crowd, both seen on other seeds of the old code, stay open).
Not started on 2026-11-03: moved to the Path section (P18-35, P18-36, P18-37, P18-38, P18-39, P18-40).

## Phase 16 - Final audit and release

Not started on 2026-11-03: moved to the Path section (P16-01, P16-02, P16-03, P16-04).

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
| Added 2026-10-29: select number of opponents, AI or human, and team | P4-08 |
| Added 2026-10-29: weapon models look bad | P7-07 |
| Added 2026-10-29: attacks look generic and similar for all styles; weapon attack animations wrong | P5-06, P5-07 |
| Added 2026-10-29: how do submissions work (make them clear) | P5-08 |
| Added 2026-10-29: keep things balanced | Section 3 rule, P14-01 to P14-05 |
| Added 2026-10-29: sway looks implausible (the character still looks hit) | P3-11 |
| Added 2026-10-29: camera goes outside the room at the edge of the workshop (only the outer wall visible) | P4-09 |
| Added 2026-10-31: audit the whole app for these and other issues | P17-01 |
| Added 2026-10-31: exaggerated animations; attacks that visually hit the air (a Yuki kick) | P17-02 |
| Added 2026-10-31: sway only goes back, spine angle exaggerated, hard to time | P17-03 |
| Added 2026-11-02: sway spine goes way too far back; side sways should lean to their side, not back | P17-03 |
| Added 2026-10-31: move list confusing; one conditional list for the current fighter and style | P17-04 |
| Added 2026-10-31: remove design / dev comments from the app (moves menu example) | P17-05 |
| Added 2026-10-31: crouch and context-sensitive actions hard to use, especially on mobile | P17-06 |
| Added 2026-10-31: items on tables clip into the table (Construction site) | P17-07 |
| Added 2026-10-31: restrictive arena bounds (Night Club, Construction yellow borders) | P17-08 |
| Added 2026-10-31: styles not distinct enough (Capoeira has no acrobatic moves); share only real shared techniques | P17-09, P17-10 |
| Added 2026-11-03: open review lows of the P17-03 to P17-07 work (sway head, torso and room; sofa; car roofs and racks; crate hint; skipped tests) and of P17-08 (simulated Arcade stages without items) | P17-11 to P17-16 |
| Added 2026-11-01: faster character movement | P18-01 |
| Added 2026-11-01: clearer combo breaks and animations, perfect block; consistent, intuitive timing | P18-02, P18-03 + P18-04 |
| Added 2026-11-01: difficulty selection in all modes, before starting | P18-05 |
| Added 2026-11-01: a few unique abilities per character | P18-06, P18-07 |
| Added 2026-11-01: an ultimate ability that needs charging | P18-08, P18-09 |
| Added 2026-11-01: refined character models, small details; ushanka for Giorgi | P18-10, P18-11 |
| Added 2026-11-01: develop environment interaction further | P18-12, P18-13 |
| Added 2026-11-01: an X-factor, one unique feature | P18-14 |
| Added 2026-11-01: honest Steam price estimate for the current state (EUR 2.99 in mind) | P18-15 |
| Added 2026-11-01: choose the side you start on in a level | P18-16 |
| Added 2026-11-01: audit menu selection issues (outline on items other than the current one) | P18-17 |
| Added 2026-11-01: Co-op Brawl, Brawl, Versus and Free Fight become one Free Fight with all their options | P18-18, P18-19 |
| Added 2026-11-01: Arcade and Survival brawls against CPUs or with ally CPUs, balanced by difficulty | P18-20 + P18-37, P18-21 |
| Added 2026-11-01: group special attacks like Urban Reign (two on one, one grabs and one attacks) | P18-22, P18-23, P18-24 |
| Added 2026-11-01: does throwing a fighter onto others cause damage; choose what is better | P18-25 + P18-32 |
| Added 2026-11-02 (friend): more of a mobile game; would download it if free-to-play, pay about EUR 3-5 | P18-26, P18-15 |
| Added 2026-11-02 (friend): its own identity, easier to get into than games like Tekken | P18-27, P18-14 |
| Added 2026-11-02 (friend): sound design needs work | P18-28, P18-29 |
| Added 2026-11-02 (friend): graphics need work to feel polished | P18-30, P18-31, P18-10 |
| Added 2026-11-02 (friend): "2D fighting genre" | none: the owner said the game stays 3D |
| Added 2026-11-03: a thrown enemy cannot hit other enemies | P18-25 + P18-32 |
| Added 2026-11-03: Arcade on Easy drains stamina very fast with any fighter, no rest in group fights; rebalance for the whole game | P18-33 |
| Added 2026-11-03: the CPU throws pickable items very often | P18-34 |
| Added 2026-11-03: story beat dialogue is cheesy, reads as AI-made, no cohesion | P18-35 |
| Added 2026-11-03 (found in P18-34): crowd camera hides too long, bodies can stack in some seeded brawls | P18-36 |
| Added 2026-11-03 19:56: Arcade brawls use themed goons after the final boss, weaker, several variants; at most 3 main fighters as bosses; CPU allies by story | P18-20 + P18-37 |
| Added 2026-11-03 19:56: ground armbar floats above the floor | P18-38 |
| Added 2026-11-03 19:56: fix all critical issues, for example no fighter choice in Tournament | P18-39, P18-40 |
| Added 2026-11-04 00:30: each stage's boss brings their own goons | P18-20 + P18-37 |
| Added 2026-11-04 00:30: Tournament fighter choice works on mobile as in all other modes | P18-41 |
| Added 2026-11-04 05:40: Free Fight, Brawl and Co-op Brawl collapse into Free Fight | P18-18, P18-19 |
| Added 2026-11-04 05:40: Free Fight sets up any fight: open level or square ring, ring-out, weapons, breakables, all settings | P18-42, P18-43 |
| Added 2026-11-03 19:56: reorder the tasks not started and make them one path without uncertainties | done in the Path section (2026-11-03) |

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

### Owner playtest feedback of 2026-10-31 (verbatim, from `Breakpoint.txt`)

```text
Audit and Address App wide related to these and other issues
- Exaggerated animations overall,attacks that visually "hit the air" (ex some kick of Yuki when i tested)
- Cant sway sideways only back, the angle of the spine is exaggerated,cant time sway easily with the enemy attacks
-Move List is Confusing/Convoluted. I want one conditionaly moves list for the current fighter and his style
-Remove app wide the design,dev comments like for example "Strong moves cost more stamina....of the attack strings below" on the moves menu.
- I think the use of crouch and the context sensitive actions is hard to use especially on mobile.
-Some Items on Tables (ex the Construction Site) dive in clipping in the table.
-Arena Bounds on Levels like Night Club,Yellow Borders on Construction Site are restrictive.The levels should feel free to explore and destroy.
-I dont think that styles feel distinct enough. for example Capoeira doesn't have acrobatic moves. Styles look very similar to each other.Only Exception should be shared techniques like Kickboxing,Boxing punches.
```

### Owner feedback of 2026-11-01 (verbatim)

```text
Overall, I'm quite happy with the game so far. There are a few areas, however, where I think some improvements could make a significant difference.

1. Movement and Combat

* I'd like the character movement to be a little faster.
* I'd appreciate a clearer understanding of how combo breaks and animations work, particularly when trying to perform a perfect block.
* The timing and mechanics should feel consistent and intuitive.

2. Difficulty Selection

* Difficulty selection should be available in all game modes, not just at the end of Character Select in Arcade Mode.
* Ideally, the player should be able to choose the difficulty before starting the game, regardless of the selected mode.

3. Character Abilities and Uniqueness

* I think each character could benefit from having a few unique abilities.
* An ultimate ability that requires charging before it can be used would also be a good addition.
* Some character models could use further refinement to stand out visually.
* For Giorgiy, for example, a Soviet-style hat (ushanka) could be a fun visual addition.
* Even small, carefully refined details could help give each character more personality and a stronger identity.

4. Levels and Environment Interaction

* I really like the new levels.
* I also particularly enjoy the interaction with objects in the environment.
* I'd like to see this aspect developed further, as it adds another layer to the gameplay.

5. A Unique Selling Point

* The main thing I feel is currently missing is an X-factor: one genuinely unique feature that gives the game its own identity.
* Something memorable that makes it stand out from other games in the genre.

6. Steam Pricing and Market Perception

* I'd like to get an honest assessment of what people would realistically be willing to pay for the game in its current state.
* I initially had around EUR 2.99 in mind, but wanted to get some outside opinions before settling on a price.
* I understand that the game is still unfinished, but I'd prefer an estimate based on the content and quality already available rather than simply dismissing it because it is unfinished.
* Even a low estimate would be useful. The goal is to understand its current market value, not to suggest that anyone should pay for it.

Overall Impression

I'm enjoying the direction the game is taking, particularly the new levels, environmental interactions and character variety. I think the biggest opportunities for improvement are refining the combat mechanics, adding more character-specific abilities, making difficulty selection accessible across all modes, and introducing a distinctive feature that gives the game a recognizable identity.
```

### Owner note on pricing of 2026-11-01 (verbatim)

```text
Regarding the game's potential Steam price, I asked a few people for their honest opinions.

The estimates varied, but the general feedback was that EUR 3-5 could be reasonable for a smaller indie game, while another opinion suggested that EUR 5-10 might be achievable depending on the overall quality and content.

Personally, I was initially thinking of EUR 2.99, but I'm open to considering EUR 5 if the game delivers a sufficiently polished experience.

Of course, none of these opinions comes from professional market research or extensive experience with Steam games, so I would treat them as rough estimates rather than definitive valuations.

The main reason I asked was to get an idea of how people perceive the game's current value and what they would realistically be willing to pay for it.
```

### Owner's added tasks of 2026-11-01 (verbatim)

```text
-Select which side you start on the level(right left)
-Audit for issues related on selections in the menu (example outline on items apart from the one currently selected)
-Co-Op Brawl,Brawl ,Versus and Free Fight collapse into one mode named Free Fight with all the options of the four of them. Arcade and Survival can have brawls vs cpus or with ally cpus (configurable,balanced according to difficulty)
-Design and integrate a system to recreate the group special attacks of urban reign (search on it) where for example two people attack one target,one person grabs the target and the other attacks the target.
-Evaluate if throwing fighters on other participants causes damage and if not then choose which is better to do
```

### Owner sway feedback of 2026-11-02 (verbatim)

```text
Also when swaying in breakpoint the spine goes way too back
Also for side sways its unnatural for the spine to move back it should lean to the direction
```

### Friend's feedback of 2026-11-02, passed on by the owner (verbatim)

The owner's instruction with it (2026-11-02, verbatim): "Exclude the 2d fighting thing the game stays 3d".

```text
Personally, I see it more as a mobile game, since I don't really spend much time gaming on Steam. I would definitely download it if it were free-to-play, and I would be willing to pay around EUR 3-5 for something that genuinely caught my interest.

That said, I'm not sure how valuable my opinion is from a business perspective, since I'm not very familiar with the gaming market, its audience, or how monetization works in this industry.

In terms of gameplay, if it can establish its own identity within the 2D fighting genre, perhaps with a more accessible approach compared to games like Tekken, I think there could be potential. However, I believe it still needs some work, particularly in terms of sound design and graphics, to feel more polished and complete.
```

### Owner's Arcade playtest of 2026-11-03 (verbatim)

```text
new tasks
-when throwing an enemy the thrown enemy cant hit other enemies
-In arcade on easy difficulty regardless of whom you choose stamina is drained very fast and im left fighting groups without being able to rest replenish stamina.Rebalance this according to the whole game. Also cpu throws pickables very frequently.The dialog in story beats is cheesy and definitely reads as AI made it and without cohesion
```

### Owner's ideas of 2026-11-03 19:56 (verbatim)

```text
For breakpoint i have some ideas
-In Arcade the brawls use themed goons that utilize the character creator.They are themed according to the character you fight in the end (one of the existing playable characters). Goons have several variants and due to them being fought at groups they are weaker (balance things out).
The main characters used as bosses can be at max 3 and depending on the story you might get cpu allies too.

-Submissions look wrong. On a ground armbar i float above the ground for some reason.

-Fix all critical issues like the following
On Tournament mode i cant select the character with which i participate

Also for the tasks not yet started reorder logically and normalize them to follow one path without uncertainties and instructions that are x here and y there
```

### Owner's answers of 2026-11-04 00:30 (verbatim)

```text
-each stage's boss bring their own goons!
-Tournament char selection should work on mobile too as in all other game modes
```

### Owner tasks of 2026-11-04 05:40 (verbatim)

```text
Free Fight Brawl and CoOp Brawl collapse into Free Fight
Any kind of fight can be configured there incl if the level is open or constrained to the square ring also an option for ring out existence of weapons and breakables and overall settings to recreate any kind of fight
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

P9-04 status (2026-10-31): glow option (UI, randomizer, emission; the share-code slot 11 is read and ignored), emissive cloth (all em 0), titles Phoenix / Specter / Titan -> The Veteran / The Closer / The Bruiser, YUKI's title (The Slipper, done earlier), the 11 name ideas (BENNY, TANK, RIZ, MOE, BISHOP, ABEL, ELI, MARCUS, DANTE, NINA, LENA; none is a roster name), block / clinch / escape / tackle rings (white impact flash + dust; `FX.ring` removed), cyan block sparks (white), strike trails (faint grey, heavy strikes only), ZERO's look (skin #c98c68, matte mask). Kept by the audit's own decision: Storm / Cyclone / Comet, the fluorescent swatches, the cyan / magenta menu palette (owner decision), Dojo and Pit arenas (reworked in P8). Not part of the list: bosses other than ZERO have no `bossAttrs` (unchanged).

#### Clean
- Checked and fine: move names (defAttack, CLINCH_MOVES, THROW_SETS), MOVE_STYLE labels and descriptions, VICTORY_POSES (hips, arms, fist, bow, flex, ginga), ARCHETYPES labels/descriptions, other roster names (KAI, MARA "The Viper", BRUTUS "The Wall", DMITRI "The Grappler", KAI "The Balanced"), hair/beard/headband/top/legs/hands/belt/footwear creator options, warehouse arena, MATERIALS and debris, MODE_INFO and menu texts, hit sparks/flash/dust/KO flash (read as impact), sound and music (plain Web Audio synth, scale names only: minor/pentatonic/phrygian, no sci-fi cues), HUD texts and stats, fighter states.

### P1-05 and P1-06 - Content counts and preset roster (2026-10-28)

- Size note: 585241 bytes is the 1.0.0 file in the repository (LF); the agent measured the Windows working copy (CRLF) after the Phase 0 additions. Projections use the working-copy figure, so they are slightly pessimistic.
- Gender is M / F until the creator gender option is defined (P6-05). DMITRI keeps Wrestling so his tuned numbers stay valid.

#### P1-05 content counts

| Content type | Count | Bytes per item (measured how) | Projected bytes | Reason |
|---|---|---|---|---|
| Martial arts styles | 16 (7 kept + 9 new) | avg about 1,750. Measured: MOVE_STYLE entry 584 (4,090 B / 7), defAttack line 262 (5,755 / 22), STRIKE_BUILDERS entry 172 (1,893 / 11). Mocked: style-model row 245. 7 kept styles +1,000 each (model row + 2 signature attacks + 1 builder); 5 data-light new styles (Muay Thai, Sambo, Hapkido, Krav Maga, MMA) 1,100 each; 4 animation-heavy new styles 1,000 each plus 11,000 shared for the 4 new animation groups (Wing Chun traps, Taekwondo / Capoeira jump-spin, BJJ ground set, Kali stick set; the 4 groups named in the P1-04 budget note) | +27,500 | P1-04 decision: 16 styles in 7 families. Data rows plus shared animation groups keep it cheap; only 4 groups need new hand-written poses. |
| Preset fighters | 32 (6 kept + 26 new), 2 per style | about 430. Measured: ROSTER entry 472 average (5 normal entries; ZERO 876 with bossAttrs). Mocked compact new entry (country, origin, goal, age, sex, muscle, weight, defense, role, face): 413, +17 for title / unlock | +12,000 | Cheapest content per unit of variety. 32 fills a 16-entrant bracket twice, gives every style two body / age / gender profiles for the P14 option table, and covers rivals, bosses and unlocks. |
| Brawler enemy templates | 10 | about 170. Measured: ARCHETYPES row 318 (2,225 / 7); a template only picks an archetype, a look palette and a name pool | +1,700 | Grunts for multi-opponent levels are generated, not authored. Named rivals and bosses come from the preset roster. Max 6 enemies at once (8 fighters in the scene in total), more arrive as waves. |
| Levels / arenas (gross) | 8 (3 reworked + 5 new) | about 8,500. Measured: ARENAS entry 1,636 average (header + env + audio about 700, objects 108-117 each), buildProps branch 1,040 average (about 100 per propBox line). Reworked level = 24 objects (2,640) + 28 prop lines (2,800) + header 700 + 8 platforms / stairs (800) + 14 weapon spawns at 40 (560) + 4 hazard placements at 112 (450) + 8 waves at 70 (560) | +68,000 | Owner wants new distinct levels. New: Rooftop, Subway Station, Parking Garage, Construction Site (scaffold / collapse), Night Club (breaking stage). Reworked: Warehouse, Gym (was Dojo, P1-07), Pit. Hand-written props are the most expensive content, so the count stays at 8; all 8 are 1v1 and Tournament capable, 6 are brawler levels. |
| Levels: bytes replaced | 3 existing | measured 1,636 + 1,040 = 2,676 each (7,812 total) | -7,812 | The 3 old arenas are rewritten, so their current bytes leave the file. |
| Destructible object looks | 14 new | about 450. Measured draw code: crate 620, bench 330, barrier 400 (drawBox lines 2365-2376); the shells box / column / rail / panel are reused | +6,300 | Dumpster, parked car, vending machine, market stall, speaker stack, table, chair, shipping container, scaffold section, sofa, lockers, ATM, bus-stop glass, fire door. Each look is a few R.put calls on the 4 existing shells. |
| Materials | 4 new | 171 measured (MATERIALS 854 / 5) | +684 | Brick, plastic, tile, sheet metal (car body). Table rows only; debris code already works by data. |
| Weapons | 14 | about 420. Mocked data row 134 + mesh of 2-3 parts about 290 (propBox lines measured 80-110 each) | +5,880 | Bottle, brick, bin lid, stick (Kali), bat, steel pipe, hammer, pipe wrench, bike chain, folding chair, skateboard, broom (two-handed), crate (heavy carry), fire extinguisher. Each has a distinct use (P7-01). |
| Weapon class move sets | 4 classes (light, heavy, two-handed, throwable) | about 1,400: 4 defAttack lines at 262 + 2 builders at 172 | +5,600 | Moves belong to the class, not the weapon, so 14 weapons do not need 14 move sets. |
| Restorative pickups + reach poses | 4 pickups + 3 reach poses (floor, table, wall) | about 300 each (pose via makePose data; pickup row + mesh) | +2,100 | Water, energy drink, snack, first-aid kit; one reach pose per height for P7-02. |
| Hazards | 8 | about 1,250: instance row 112 (mock) + type row 150 + visual 350 + effect handler 300 + glue; train and falling load cost more | +10,000 | Electric panel, steam pipe, open drop, glass wall, falling load, passing train, fire barrel, wet floor. Placements are counted in the level rows. Rules run through the P9 shared matrix, so no per-hazard script. |
| Customization: tops | 12 | about 100: parameter row 64 (mock) + option / label 36 | +1,200 | Bare, tank, tee, gi (kept) + hoodie, jersey, track jacket, bomber, polo, vest, leather jacket, compression shirt. One shared garment generator. |
| Customization: bottoms | 10 | about 100 (same as tops) | +1,000 | Shorts, pants (kept) + track pants, jeans, cargo pants, board shorts, gi pants, long fight shorts, tights, sweatpants. |
| Customization: shoes | 8 | about 100 (height, sole, colour rule) | +800 | Shoes, boots, barefoot (kept) + high-tops, runners, wrestling boots, slides, work boots. |
| Customization: gloves / wraps | 8 | about 100 | +800 | Gloves, wraps (kept) + MMA gloves, fingerless, bag gloves, tape, leather gloves, none. |
| Customization: headwear | 10 | about 190: 1-3 part() lines about 130 + option / label 30 + order slot (hair cases measured 104 each) | +1,900 | None, headband, half mask, full mask (kept) + cap, beanie, hood, bandana, boxing headgear, balaclava. |
| Customization: accessories | 10 | about 190 (same method) | +1,900 | None, chain, sunglasses, scarf, wristbands, towel, earrings, glasses, face tape, backpack. |
| Customization: hair | 16 | about 140: hair switch case 104 measured (940 / 9) + option / label 36 | +2,240 | 10 kept + 6 new (cornrows, locs, curly top, bob, undercut, fade). |
| Customization: facial hair | 7 | about 140 (beard cases measured 110-150) | +980 | None, stubble, goatee, full (kept) + mustache, soul patch, chinstrap. |
| Customization: tattoos / marks | 10 | about 130: decal part 68 (mock) + option / label 30 + placement | +1,300 | None, sleeve, forearm band, chest piece, neck script, eyebrow scar, cheek scar, knuckle marks, face-tape mark, eye black. Plain graphic marks only. |
| Customization: shared generators | 6 (garment, shoe, glove, attach point, hair, decal) | about 770 each: 4,600 total, estimated from drawHead + drawHair (2,846 B) and the skeleton clothing lines (2,142 B) | +4,600 | Keeps per-item cost to a parameter row. Per-fighter part count must stay at or under 40 (the self-test limit is 38 since P6-04). 91 items in 9 slots in total. |
| Pre-drawn faces | 24 | 111 (mocked row: eye, gap, brow, nose, mouth, jaw, ear) | +2,664 | 24 = 3 rows of 8 in the picker. Presets reuse faces with different hair / beard / skin, so 24 serve 32 presets. |
| Face expressions + face rig code | 8 expressions (neutral, hurt, tired, panting, rested, angry, win, shocked) | about 60 per expression + about 3,500 once for nose / mouth / ear parts and expression blending | +3,980 | Photo-face texture support (P6-06 / P6-07) is code, counted in the system code below. |
| Countries | 64 (about 10 regions) | 30 (mocked row: name, city, region) | +1,920 | Owner asked for "lots". Story beats key on the 10 regions, so 64 countries do not need 64 scripts. |
| Origins | 24 | 62 (mocked row: name, one line, tone tag) | +1,488 | Social status / upbringing. |
| Goals | 24 | 92 (mocked row: name, one line, motive tag, arc hint) | +2,208 | Includes lose weight, make friends, revenge and a thrill-seeking goal (the ideas-file "psychopath", kept non-gory). |
| Story beat text (P10-02) | 10 region lines + 24 origin lines + 24 goal arcs + 16 beats x 3 variants | about 100 per line, goal arcs about 200 (MODE_INFO entries measured about 160) | +13,000 | Tag-based variants: 26 groups x 16 beats would be 400+ lines; this is 106. |
| Non-combat poses / emotes | 28 | about 350 (makePose data); VICTORY_POSES measured 752 average because they are code | +9,800 | Taunts, greetings, tired / stretch idles, kneel, plead, argue, victory / defeat for the P10-02 cutscenes. |
| Cutscene scripts | 16 beats | about 120 (camera, pose ids, timing) | +1,920 | In-engine, skippable. |
| Tournament entrant counts | 8 and 16 (both) | about 0 per count; the bracket is a formula; prize / tier table about 500 once | +500 | Both sizes cost the same. 8 = quick (3 rounds), 16 = full (4 rounds; P1-08 found 8-20 in Budokai). 1-4 humans, AI fills the rest from the 32 presets. |
| TOTAL content (net) | | | +186,152 | |

- Budget: final `breakpoint.html` <= 1,200,000 bytes (LF, as stored in the repository; the Windows CRLF copy is about 1.6 percent larger), target about 1,050,000, hard stop 1,300,000 unless a later decision accepts it. Reason: parse cost is small (V8 compile of the current 579,419-character script measured 13 ms on the desktop, so about 27 ms at 1.2 MB, about 110 ms under the 4x CPU throttle of P0-04, on top of the 162 ms baseline startup); the gzip ratio measured 3.5 to 1 (602,057 -> 173,357 bytes; brotli 141,383), so 1.2 MB is about 345 KB over the wire, once, then cached. The real limits on low-spec phones are per frame (instances, draw calls, AI cost), not file size, so the budget is about twice today's file instead of a tighter number that would cut variety. If over budget, cut in this order: QR encoder, 2 of the 5 new levels, 8 of the 28 emotes, 8 of the 24 faces, countries 64 -> 40 (together about 45 KB).
  - Counts `breakpoint.html` only (owner decision 2026-10-29): the self-tests moved to `breakpoint-tests.js`, which is not part of the game file and is not counted. The stored (LF) game file went from 1,194,076 to 765,075 bytes (see Appendix C, "Self-tests in their own file"). The projection below still includes the self-test bytes, so it now overstates the game file.
- Total projected file size: 602,057 (current HEAD, LF) + 186,152 (content above) + 224,000 (system code) = 1,012,209 bytes (about 1.01 MB); with a 15 percent estimation reserve 1,164,209 bytes (about 1.16 MB), inside the 1.2 MB budget. P15-03 (dead code, shared generators) should win back 5 to 10 percent, so the expected final size is about 0.95 to 1.1 MB. System code estimate (not content; scaled from measured module sizes INPUT 25,229; WORLD 39,633; FIGHTER 46,699; AI 23,937; MATCH 40,924; CREATOR 24,259; CREATOR UI 33,836; UI 76,624; SELF-TEST + BOOT 126,120): Controls overhaul (P2) 3,000; Block / Sway, submissions, grab strikes, falling, boost (P3) 16,000; Multi-opponent, group AI, lock-on, camera, co-op (P4) 22,000; Style engine hooks (P5) 6,000; Creator UI expansion + fitness / age / gender / story pickers (P6) 14,000; Photo face + face texture in the renderer (P6-06 / P6-07) 9,000; Weapon, pickup, hazard systems (P7) 14,000; Level systems: verticality, breakable floors, 1v1 variants (P8) 10,000; Interactivity matrix (P9) 9,000; Story, progression, unlock screen, cutscenes, grade (P10) 20,000; Tournament (P11) 9,000; Online: WebRTC, code compression, lobby, lockstep, checksum (P12) 30,000; Audiovisual feedback (P13) 10,000; Balance tables (P14) 4,000; Self-test additions: about 40 new checks at 1,200 B (existing 126,120 B for about 100 checks) 48,000; system code total 224,000.
- Method: a Node script read `breakpoint.html` (HEAD working copy, CRLF converted to LF, 602,057 bytes) and summed UTF-8 bytes (Buffer.byteLength) of line ranges: ROSTER 3,553 for 6 entries, ARENAS 4,907 for 3 (objects 883-974 for 8-9 each), buildProps 3,428 for 3 branches, MATERIALS 854, defAttack lines 5,755 for 22, THROW_SETS 2,341 for 12, CARRY_PATHS 1,111 for 7, THROW_POSES 3,443 for 8, STRIKE_BUILDERS 1,893 for 11, MOVE_STYLE 4,090 for 7, VICTORY_POSES 3,762 for 5, ARCHETYPES 2,225 for 7, LOOK_CHOICES 1,744, drawHead + drawHair 2,846, section sizes from the "====" headers. New rows (fighter, face, weapon, hazard, country, origin, goal, tattoo, style row) were drafted in the same format and measured the same way; they are drafts, so expect +-25 percent. Gzip, brotli and V8 compile times were measured with Node zlib and vm.Script. Note: HEAD is 602,057 bytes now (the 585,241 baseline plus the P0 work).

#### P1-06 preset roster

32 fighters: 6 kept (KAI, MARA, BRUTUS, YUKI, DMITRI, ZERO; same ids, so Progress and saves keep working) + 26 new, exactly 2 per style (16 styles). Gender 16 F / 16 M. Defense 16 Block / 16 Sway (P1-04 defaults, 6 overrides listed below). Roles: 10 starter, 12 unlock, 6 rival, 3 boss, 1 champion. Fitness = (muscle, weight) on the 0-1 triangle.

| Id | Name | Style | Country | Origin | Goal | Height | Fitness (muscle, weight) | Age | Gender | Role | Defense |
|---|---|---|---|---|---|---|---|---|---|---|---|
| kai | KAI | Kickboxing | Canada | Gym kid | Win the title | 1.00 | 0.55, 0.50 | 26 | M | starter | Block |
| mara | MARA | Capoeira | Brazil | Single parent | Provide for family | 0.96 | 0.55, 0.30 | 28 | F | starter | Sway |
| brutus | BRUTUS | Street Brawler | South Africa | Port town | Pay a debt | 1.10 | 0.80, 0.85 | 42 | M | starter | Block |
| yuki | YUKI | Boxing | Japan | Small town | Prove them wrong | 0.98 | 0.40, 0.25 | 22 | F | starter | Sway |
| dmitri | DMITRI | Wrestling | Kazakhstan | Working class | Make family proud | 1.08 | 0.75, 0.75 | 37 | M | unlock | Block |
| zero | ZERO | Karate | Spain | Wealthy family | Stay undefeated | 1.04 | 0.70, 0.50 | 33 | M | champion | Block |
| deacon | DEACON | Boxing | Ireland | Night-shift worker | One last title | 1.04 | 0.70, 0.70 | 41 | M | rival | Block |
| rosa | ROSA | Wing Chun | Argentina | Restaurant family | Protect family | 0.94 | 0.45, 0.30 | 34 | F | starter | Block |
| hao | HAO | Wing Chun | China | Martial arts family | Leave a legacy | 0.96 | 0.45, 0.40 | 57 | M | boss | Block |
| femke | FEMKE | Kickboxing | Netherlands | Sports family | Beat the champion | 1.04 | 0.55, 0.40 | 27 | F | rival | Sway |
| pranee | PRANEE | Muay Thai | Thailand | Big-city street | Earn respect | 0.96 | 0.60, 0.30 | 25 | F | starter | Block |
| lars | LARS | Muay Thai | Sweden | Office worker | Lose weight | 1.06 | 0.35, 0.80 | 36 | M | unlock | Block |
| amara | AMARA | Karate | Nigeria | Police family | Defend the neighborhood | 1.00 | 0.60, 0.40 | 31 | F | starter | Sway |
| sora | SORA | Taekwondo | South Korea | College dropout | Make friends | 1.00 | 0.45, 0.30 | 24 | F | starter | Sway |
| diego | DIEGO | Taekwondo | Colombia | Delivery rider | Fame | 1.02 | 0.55, 0.35 | 20 | M | rival | Sway |
| tiago | TIAGO | Capoeira | Portugal | Teacher's child | Teach the kids | 1.02 | 0.55, 0.40 | 39 | M | unlock | Sway |
| kelsey | KELSEY | Wrestling | USA | Boarding school | Redemption | 1.00 | 0.70, 0.60 | 29 | F | rival | Block |
| elise | ELISE | Judo | France | Foster care | Escape the past | 0.98 | 0.55, 0.45 | 33 | F | starter | Sway |
| naran | NARAN | Judo | Mongolia | Farm family | Prove worth | 1.12 | 0.70, 0.70 | 27 | M | unlock | Block |
| giorgi | GIORGI | Sambo | Georgia | Military family | Revenge | 1.04 | 0.70, 0.60 | 29 | M | rival | Block |
| armine | ARMINE | Sambo | Armenia | Orphanage | Find a lost sibling | 0.98 | 0.60, 0.45 | 35 | F | unlock | Block |
| reid | REID | Brazilian Jiu-Jitsu | Australia | Immigrant family | Honor a mentor | 1.02 | 0.35, 0.60 | 44 | M | unlock | Sway |
| camila | CAMILA | Brazilian Jiu-Jitsu | Chile | Famous parents | Get fit | 0.96 | 0.40, 0.40 | 26 | F | unlock | Sway |
| vikram | VIKRAM | Hapkido | India | Bouncer family | Defend the neighborhood | 1.00 | 0.55, 0.45 | 38 | M | unlock | Sway |
| lucia | LUCIA | Hapkido | Italy | Restaurant family | Make family proud | 0.98 | 0.50, 0.35 | 31 | F | unlock | Sway |
| marlon | MARLON | Kali / Eskrima | Philippines | Port town | Earn respect | 1.00 | 0.50, 0.45 | 49 | M | boss | Sway |
| nia | NIA | Kali / Eskrima | Jamaica | Single parent | Find a lost sibling | 0.92 | 0.40, 0.25 | 19 | F | unlock | Sway |
| yoav | YOAV | Krav Maga | Israel | Military family | Protect family | 1.04 | 0.65, 0.50 | 34 | M | boss | Block |
| kasia | KASIA | Krav Maga | Poland | Single parent | Provide for family | 0.96 | 0.45, 0.55 | 46 | F | unlock | Block |
| cruz | CRUZ | MMA | Mexico | Gym kid | Beat the champion | 1.02 | 0.65, 0.50 | 28 | M | starter | Block |
| tessa | TESSA | MMA | New Zealand | Farm family | Win the title | 1.06 | 0.60, 0.55 | 31 | F | unlock | Sway |
| roxy | ROXY | Street Brawler | UK | Foster care | Thrill seeking | 0.98 | 0.50, 0.35 | 23 | F | rival | Sway |

- Defense overrides (all others use the P1-04 default): DEACON Block (Boxing default is Sway; veteran with a tight cross-guard); FEMKE Sway (Kickboxing default is Block; counter-puncher who slips and returns); AMARA Sway (Karate default is Block; distance-based point fighter); NARAN Block (Judo default is Sway; heavy judoka who stands his ground); TESSA Sway (MMA default is Block; slips and shoots); ROXY Sway (Street Brawler default is Block; dodges first, swings wild). Reason for all six: both defense types end up with 16 fighters each for the P3-02 / P14 balance runs, and every style pair test has both types.
- Kept fighters: KAI = Kickboxing (the default style), MARA = Capoeira, BRUTUS = Street Brawler, YUKI = Boxing, DMITRI = Wrestling, ZERO = Karate. These match their old move styles one to one (P1-04 old-save mapping), so the tuned AI numbers and ZERO's bossAttrs stay valid. Theme fixes from P1-07 apply when P5-04 touches them: YUKI title "The Ghost" -> "The Slipper"; ZERO keeps the masked look with a normal skin tone from SKIN_SWATCHES, a matte cloth mask and no glow; ZERO stays the Arcade final (rank 5). Alternative if the owner prefers: DMITRI as Sambo (Russian-school name) and a new wrestler; not chosen because it changes a tuned fighter.
- Roles: starter = unlocked on first launch (KAI, MARA, BRUTUS, YUKI as today + ROSA, PRANEE, AMARA, SORA, ELISE, CRUZ); rival = named Arcade opponent picked by the player's Goal / Origin (P10-06), unlocked when beaten; boss = Arcade stage boss (HAO, MARLON, YOAV), unlocked when beaten; champion = ZERO, unlocked on Arcade clear as today; unlock = earned by Arcade / Tournament milestones (P10-05).
- Body notes: height spans the full 0.92-1.12 (NIA 0.92, NARAN 1.12); ages 19-57; triangle corners covered (slim: YUKI, NIA, SORA; heavy soft: LARS; heavy muscled: BRUTUS, DMITRI; lean muscled: PRANEE, AMARA, CRUZ). Names are plain A-Z, 3-6 letters, none a real famous person. Each style has one fighter from the art's home region at most; the other is from elsewhere, so country never decides the style.
- Gender: the table uses M / F. P6-05 defined the creator option as Male, Female or Neutral (N, a half-way body shape, for custom fighters only), so the table stays as it is: the 32 presets are still 16 M / 16 F.
- Countries used (32): Canada, Brazil, South Africa, Japan, Kazakhstan, Spain, Ireland, Argentina, China, Netherlands, Thailand, Sweden, Nigeria, South Korea, Colombia, Portugal, USA, France, Mongolia, Georgia, Armenia, Australia, Chile, India, Italy, Philippines, Jamaica, Israel, Poland, Mexico, New Zealand, UK. All belong in the 64-country P10-01 list; the other 32 are chosen there.
- Origins used (24 of 24): Gym kid, Single parent, Port town, Small town, Working class, Wealthy family, Night-shift worker, Restaurant family, Martial arts family, Sports family, Big-city street, Office worker, Police family, College dropout, Delivery rider, Teacher's child, Boarding school, Foster care, Farm family, Military family, Orphanage, Immigrant family, Famous parents, Bouncer family. Proposed P10-01 origin list (24): Gym kid, Working class, Wealthy family, Immigrant family, Military family, Foster care, Small town, Big-city street, Sports family, College dropout, Office worker, Police family, Martial arts family, Single parent, Night-shift worker, Delivery rider, Farm family, Restaurant family, Bouncer family, Boarding school, Orphanage, Port town, Teacher's child, Famous parents.
- Goals used (24 of 24): Win the title, Provide for family, Pay a debt, Prove them wrong, Make family proud, Stay undefeated, One last title, Protect family, Leave a legacy, Beat the champion, Earn respect, Lose weight, Defend the neighborhood, Make friends, Fame, Teach the kids, Redemption, Escape the past, Prove worth, Revenge, Find a lost sibling, Honor a mentor, Get fit, Thrill seeking. Proposed P10-01 goal list (24): Lose weight, Make friends, Revenge, Win the title, Prove worth, Protect family, Pay a debt, Honor a mentor, Redemption, Fame, Escape the past, Thrill seeking, Stay undefeated, Defend the neighborhood, Beat the champion, Teach the kids, One last title, Get fit, Provide for family, Make family proud, Prove them wrong, Earn respect, Find a lost sibling, Leave a legacy.

### P2-01 - Final action list (2026-10-28)

- Owner decisions: no hold-to-strengthen on any device (attacks fire on press); strong attacks are kept only as steps of fixed attack strings, with a combo balance audit (P3-10). Overrides the P1-03 "tap / hold strength" row.
- Still a hold: USE tap = drop, hold = throw comes from the owner's ideas file and is kept until the owner says otherwise.

Basis (fact, read from breakpoint.html 1.0.0): ACTIONS has 15 entries (breakpoint.html:574). Touch has a stick plus 8 buttons (PUNCH, KICK, BLOCK, GRAB, JUMP, DUCK, DASH, II; buildTouch, :7332). Touch already uses tap / hold for strength (TOUCH_CHARGE_MS = 220, :770) and picks height automatically (touchAttackChoice, :784). `dash` is also the back double-tap (:1082) and quick recovery (Fighter.updateDown :3504). Crouch is already the "low" modifier for Grapple (low grab, :3281).

#### P2-01 final action list (decision)

13 actions. Same list on every device. Owner decision (2026-10-28): no hold-to-strengthen on any device; attacks fire on press. Strong moves are reached only as steps of fixed attack strings (see "Attack strings" below). The intent no longer carries `strong`; `height` is derived from crouch held at the press.

| Action | Purpose | Keyboard P1 | Keyboard P2 | Gamepad (standard mapping) | Touch | Notes |
|---|---|---|---|---|---|---|
| up | Move toward opponent (Settings: up the screen) | W, ArrowUp | ArrowUp | Left stick up / D-pad up | Stick up | Unchanged. P1 spare arrows switch off in Versus (unchanged). |
| down | Move away (Settings: down the screen) | S, ArrowDown | ArrowDown | Left stick down / D-pad down | Stick down | Unchanged. Double-tap down no longer does anything (back-dash removed). |
| left | Circle left | A, ArrowLeft | ArrowLeft | Left stick left / D-pad left | Stick left | Unchanged. Double-tap left = sidestep (gesture, see Decisions). |
| right | Circle right | D, ArrowRight | ArrowRight | Left stick right / D-pad right | Stick right | Unchanged. Double-tap right = sidestep. |
| punch | Punch | J | Numpad4 | X / Square (button 2) and Y / Triangle (button 3) | PUNCH | Fires on press, every device. The move comes from the attack string so far (table below). Crouch held at the press = body / low variant (replaces `height`). In a grab: elbow strike. |
| kick | Kick | K | Numpad5 | A / Cross (button 0) and B / Circle (button 1) | KICK | As punch. Crouch held at the press = low kick family. In a grab: knee strike. |
| defend | Block or Sway, by the character's defense type (P3-01) | L | Numpad6 | R1 (button 5) | DEFEND | Hold = guard (Block) or press = sway (Sway); P3-02 sets the numbers. Standing = high + mid cover. Crouch held + defend = low cover (no second button). Press while knocked down (tick 14 or later) = quick recovery. |
| jump | Jump | Space | Numpad0 | Firm quick tap up on stick / D-pad | JUMP | Unchanged. Jump + crouch together cancel (unchanged). |
| crouch | Crouch. Also the single modifier for low guard, low attacks and low grab | C | NumpadDecimal | Tap down, then hold down | DUCK | Unchanged input. New roles: defend + crouch = low guard; punch / kick + crouch = low variant; grapple + crouch = low grab (already). |
| grapple | Grab, throw, escape | G | Numpad3 | R2 (button 7), R3 (button 11), right-stick flick | GRAB | Grab near opponent. In a clinch: attacker presses it to throw (direction = aim), defender presses it to escape. Kick no longer throws (kick = knee, P3-03). |
| use | Pick up, drop, throw an item (P7-02, P7-03) | E | Numpad1 | L2 (button 6) | USE (context-sensitive, approved) | Empty-handed near an item: pick up, fires on press. Holding an item: tap = drop, hold 220 ms or more then release = throw (aim at the locked target, else facing). Replaced by P17-06 (owner to confirm): a short press throws on release, holding Use 0.5 s sets the item down. Nothing in reach and empty-handed: does nothing. |
| lock | Lock-on engage / disengage (P4-03) | Q | Numpad2 | L1 (button 4) | LOCK (context-sensitive, approved) | Toggle. Recommendation for P4-03: tap with the stick pushed toward another enemy switches target instead of toggling. Harmless in 1v1 (no visible effect). |
| pause | Pause / back | Escape, P | NumpadEnter | Start (button 9) | II (small, top right) | Unchanged. |

Menu-only inputs (not actions, not remappable, never used in a fight):

| Input | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Confirm | Enter / Space / click | A / Cross (button 0) | Tap |
| Back | Escape | B / Circle (button 1) | Back button |
| Creator tab previous / next | click / existing keys | L1 / R1 (buttons 4 / 5) | Tap tabs |
| Creator preview turn left / right | existing | L2 / R2 (buttons 6 / 7) | Drag |
| Training reset | existing | Hold Select (button 8) | Menu item |

These pad menu buttons are read from raw buttons 4 to 7. MENU_PAD_BUTTONS (:1132) must stop using the action names strong / blockHigh / height / blockLow (P2-02 / P2-08 job).

Key conflict check (P1 and P2 share one keyboard):
- P1 keys: W A S D, ArrowUp/Down/Left/Right (spare, off in Versus), J, K, L, Space, C, G, E, Q, Escape, P.
- P2 keys: ArrowUp/Down/Left/Right, Numpad4, Numpad5, Numpad6, Numpad0, NumpadDecimal, Numpad3, Numpad1, Numpad2, NumpadEnter.
- The only overlap is the P1 spare arrows, which are already switched off in Versus. No Shift, Ctrl or Alt used (browser shortcut clashes avoided, as in revision 2).
- Freed keys: P1 O, F (and L, Q, E reused); P2 Numpad9, NumpadAdd.
- Pad check: every standard button 0 to 7, 9 and 11 has one meaning in a fight; L3 (10) is unused on purpose (it was dash; keeping it free avoids accidental stick-click presses). R3 (11) is a grapple alias, as today.

Touch check: 7 permanent buttons (PUNCH, KICK, DEFEND, GRAB, JUMP, DUCK, II) plus 2 context-sensitive (USE, LOCK). Old layout had 8 permanent buttons. 1v1 modes show 7 (8 when USE is up).

#### Removed / merged

| Old action | Fate | Reason |
|---|---|---|
| dash | Removed completely (state DASH, DASH_COST, back double-tap, side dash, pad L3, key F, touch DASH, AI plan 'dash'). Its i-frame job moves to Sway. Its quick-recovery job moves to `defend`. | Owner requirement. Sway gives the evasive step; sidestep stays for positioning. |
| blockHigh | Merged into `defend` (stand = high + mid). | One defend action (P1-03 auto-guard). |
| blockLow | Merged into `defend` + `crouch` (crouch + defend = low guard). | No second guard button; crouch already exists and is the low modifier everywhere. |
| strong | Removed as an input and as an intent field, on every device. The touch hold (TOUCH_CHARGE_MS, touchStrike charge, `charged` button look) is removed too. The 8 strong moves stay, reachable only as attack-string steps. Strong throws are removed (every throw uses the normal values). | Owner decision 2026-10-28: no hold anywhere; strong attacks live in combos. Overrides the P1-03 "tap / hold strength" row. |
| height | Removed as an input. Replaced by `crouch` held at the press (all devices). The intent keeps a derived `height` boolean. Touch keeps its existing automatic height choice when DUCK is not held. | P1-03 "button-set height": the button plus the crouch state set the height. Uses an existing action, no new input. |
| sidestep (gesture, not an action) | Kept as a double-tap gesture on left / right. Not in the action list. | See Decisions. |
| quick recovery (part of dash) | Moved to `defend`. | See Decisions. |

#### Decisions

- quick recovery: pressing `defend` (a fresh press, not a held one) while knocked down, at tick 14 or later and with at least 8 stamina, gets up quickly. Same numbers as now (DOWN state, 8 stamina, 0.6 getup scale). Reason: the player's thumb or finger is already on DEFEND, it works for Block and Sway characters alike, and it needs no extra button. Implementation note: Fighter keeps the previous `defend` value and tests the rising edge; the AI sets `defend` for one tick instead of `dash`. Rejected: jump (a rise-and-jump reads as a second meaning of Jump), grapple (a grab press while downed is already used for escapes in clinches).
- strong / height modifiers: both removed as actions on all devices (owner decision 2026-10-28: "ditch the hold overall"; strong attacks are kept only inside combos, and the combos get a balance audit).
  - Strength: no hold. Punch and Kick fire on press. Strong moves come only from attack strings (next section).
  - Height: Punch or Kick with crouch held at the press = the low/body version. Standing = the high/mid version.
  - In a grab: Punch = elbow, Kick = knee (P3-03); the elbow no longer needs strong. Throws are on `grapple` only, and strong throws are removed.
  - New task: P2-10 (attack strings on every device). New task: P3-10 (combo audit and redesign for balance).

#### Attack strings (default set; audited by P3-10, unchanged; the move styles' own rows are in the P3-10 section below)

Rules:
- The move is picked at the moment of each press from the presses so far; no waiting and no hold. So P then K already gives the strong kick of the P K P string.
- A press continues the string only when it comes within ATTACK_STRING_SECONDS (0.8 s) of the previous string press and the previous string move made contact (hit or block). A whiffed move, a gap, a hit taken, or a finished 3-step string starts a new string from step 1.
- Strings are at most 3 steps. Crouch is read at each press; the crouch strings below need crouch held for every step, otherwise the standing table is used from that step.
- Inside a string the step order is fixed by the table, so a string may go from a strong move to a lighter one (P K P). Outside strings the existing tier rule (Combat.canChain: never from stronger to lighter) stays for buffered chains.
- Strong steps keep their costs: more stamina, longer recovery and the whiff penalty (whiffExtra).
- Owner rule (2026-10-28): every strong string step breaks a block outright (stun), whatever the defender's stamina; only a perfect block stops it. Normal moves still break a guard only by draining stamina. P3-02 and P3-10 tune the stun length and damage around this (P3-10 kept the 80 ticks).
- Counter, running (Running Lunge), air and grab moves are unchanged and are not part of strings.
- The AI and the Training dummy press the same strings (no more `it.strong`), so players and AI have the same move set.
- Implementation direction (P2-10): the input layer sends punch / kick plus height; the Fighter keeps its own string state (it knows whether the last move made contact) and picks the move from one STRINGS table. This replaces MOVE_BY_INPUT's strong key and the hand / foot alternation of nextInString.

| Input (standing) | Steps | Strong step and its role |
|---|---|---|
| P | Jab | none |
| P P | Jab, Cross | none (same as today) |
| P P P | Jab, Cross, Hook | Hook: wide stagger, string ender |
| P K | Jab, Heavy Body Kick | Heavy Body Kick: guard break (owner example P K P) |
| P K P | Jab, Heavy Body Kick, Cross | Cross follows the guard break |
| P P K | Jab, Cross, Push Kick | Push Kick: guard break, pushes away, ender |
| K | Front Kick | none |
| K K | Front Kick, Roundhouse | none (same as today) |
| K K K | Front Kick, Roundhouse, Heavy Roundhouse | Heavy Roundhouse: knockdown, ender |
| K P | Front Kick, Jab | none |
| K P P | Front Kick, Jab, Heavy Uppercut | Heavy Uppercut: big launch, ender (owner example K P P) |
| K K P | Front Kick, Roundhouse, Power Jab | Power Jab: stagger, ender |

| Input (crouch held) | Steps | Strong step and its role |
|---|---|---|
| P, P P | Body Jab, Uppercut | none (same as today) |
| P P P | Body Jab, Uppercut, Gut Punch | Gut Punch: stagger on a juggled opponent, ender |
| K, K K | Low Kick, Body Kick | none (same as today) |
| K K K | Low Kick, Body Kick, Sweep | Sweep: the only low knockdown, ender |

Every one of the 8 strong moves has exactly one string. Standing mixed pairs (P K, K P) change: today they give Jab then Front Kick and Front Kick then Jab with the other limb rules; now they follow the table.

#### P3-10 combo audit (2026-10-28)

Implemented. Not ticked: the all-pairs win-rate target waits for P14-01 (win rates are listed below).

- Method:
  - Damage share: `SelfTest.stringShare(seeds, opts)` plays AI vs AI (`SimRunner.run`, new `listeners` option) over the 15 pairs of the six presets, seats swapped on even seeds, and counts each hit under the string step that threw it (`P K` = step 2 of the P K string, crouch rows start with `c`; moves outside the strings and throws count under their own name). Share = that damage / the fighter's total damage. Punch / kick = share of strike damage thrown with a Punch or Kick button (clinch elbow = punch, knee = kick). Share columns below: 24 seeds at Normal and Hard, pooled; headless call `ev('SelfTest.stringShare(24, { difficulty: "hard" })')`.
  - Row data: each row played by a scripted fighter against an idle and a full-stamina Block defender kept in reach. Dmg = damage to the idle defender (combo scaling and the fighter's damage stat included), Foe locked = longest stretch the idle defender could not act, Against a full block = what the Block defender took. Frame advantage = `frameAdvantage()`, the numbers of the Move list and the Training panel.
- Findings before the change:
  - AI vs AI damage was 70-78 % kicks (punch share 30 / 27 / 22 / 23 % at Easy / Normal / Hard / Expert). Worst single string: the `K` opener (Front Kick) at 33 % of a fighter's damage at Hard and Expert, two points under the limit. Cause: kicks reach 1.45-1.65 m and punches 1.2-1.35 m, and the AI stopped 0.35 m beyond its preferred range, a distance where only kicks reach.
  - P K P was never played by the AI (it ended every chain on a strong move); K P P and the crouch P P P / K K K were rare.
  - Every strong move already had a block advantage of -7 or less (the jab starts in 5), so the data was punishable. Because every strong step breaks a non-perfect block (owner rule), the punish is real only after a perfect block (the attacker staggers 26 f and the defender gets a counter), a sway or a whiff; a broken block leaves the defender stunned 80 f (92 f in the table below, with the hit reaction) and the attacker free. The stun length stays 80.
  - No loops: longest foe-locked stretch 207 f (limit 240), most health taken in one combo 41 % of a bar (49 % for BRUTUS with the boost on), at most 3 juggle hits (JUGGLE_LIMIT).
- Changes (every number has a why-comment in the code):

| What | Before | After | Why |
|---|---|---|---|
| Jab / Body Jab reach | 1.25 / 1.2 m | 1.4 / 1.35 m | punches were out-ranged by every kick (70-78 % kick damage) |
| Cross reach | 1.35 m | 1.5 m | same; still shorter than the kicks |
| Jab / Body Jab damage | 4 | 5 | the jab is the most-thrown punch; +1 adds 2-3 points of punch share without a longer reach |
| AI approach (`AI_APPROACH_SLACK`) | stops 0.35 m beyond its preferred range | 0.1 m | at 0.35 m only kicks reach; 0 made every grab throw the same way (a test caught it) |
| AI string chain (`thinkChain`) | stopped after any strong step | may press the next string step | P K P and the other strong-then-light rows are played |
| Strings per move style (`STYLE_STRINGS`) | one table | boxer, karateka, capoeira, wrestler, judoka override rows (below) | style identity: punch-heavy, kick-heavy, short strings into grabs |
| Block vs Sway AI (`swayRead` / `swayAim`) | Normal 0.7 / 0.05, Hard 0.2 / 0.85, Expert 0.2 / 0.85 | Normal 1.3 / 0.05, Hard 0.2 / 0.7, Expert 0.1 / 1 | the new reach and spacing moved Block / Sway to 36 / 65 (Normal), 41 / 59 (Hard) and 59 / 41 (Expert); back to 45-55 |
| Combo damage limit in the loop test | 60 % of a bar | 55 % | worst measured 49 % |

- Result (AI vs AI, 24 seeds, all 15 pairs):

| Difficulty | Punch share before / after | Worst string before / after |
|---|---|---|
| Easy | 30 / 40 % | 21 % (K K) / 23 % (P K, Dmitri) |
| Normal | 27 / 38 % | 20 % (K) / 19 % (P K, Dmitri) |
| Hard | 22 / 38 % | 33 % (K, Dmitri) / 24 % (K, Zero) |
| Expert | 23 / 40 % | 33 % (K, Brutus) / 25 % (K, Dmitri) |

  - Win rate per fighter, all other presets, both seats (before / after): Hard KAI 43 / 49, MARA 63 / 63, BRUTUS 43 / 55, YUKI 67 / 50, DMITRI 38 / 37, ZERO 47 / 45. Expert KAI 44 / 53, MARA 76 / 55, BRUTUS 42 / 48, YUKI 58 / 60, DMITRI 36 / 42, ZERO 43 / 42. Normal was already lopsided and stays so (KAI 12 / 10, MARA 41 / 43, BRUTUS 84 / 79, YUKI 64 / 65, DMITRI 87 / 87, ZERO 12 / 16): P14-01 owns the target. Matches are shorter (Hard 51 s to 41 s, Expert 70 s to 57 s).
  - Block vs Sway (300 seeds, both seats): Easy 51 / 49, Normal 49 / 51, Hard 47 / 53, Expert 52 / 48.
  - Every row of every preset is thrown at some difficulty in 24 seeds; a few rare rows (K P P, K K P, Crouch P P P) miss one difficulty (for example KAI's K P P at Hard).
  - The style tables shift the strong moves (boxer: 4 of 7 are punches, default 4 of 8; karateka and capoeira: 2-3 punches less), but a preset's punch share still follows its AI style weights (YUKI 0.45 punch / 0.55 kick: 37 %). Giving YUKI more punch weight raised her win rate to 83-88 % at Hard, so the weights stay; a more punch-heavy boxer needs P3-10 follow-up tuning together with P14-01.
- P14-01 all-pairs check (2026-10-30, final numbers of the third pass). Method (P14-01 row "Style pairs"): the 16 move styles on KAI's body, attributes, AI weights and range, each with its style's default defense (7 Sway, 9 Block), AI vs AI at one difficulty on the Warehouse (`SimRunner.run`, `evenDamage`, 60 s timer, 2 wins), 136 pairs (mirrors included), seats swapped on even seeds (so half the matches per seat; a mirror measures the seat bias); bands 35-65 % at Easy and Normal, 40-60 % at Hard and Expert. Pooling (the review of 2026-10-30 showed that accepting a re-run of the out-of-band pairs alone was wrong: those pairs had been picked for being extreme, and on fresh seeds Muay Thai at Easy was still 66 % against three styles): every number below is pooled over FRESH seeds, 1001 and up, that no tuning step used. Every pair plays 200 matches (Hard: 600); every pair whose rate is not at least 7 points inside its band then plays 400 more (seeds 1201-1600; skipped at Hard, where those seeds are already inside the first 600, so no match is pooled twice); every pair within 4 points of an edge after that plays 800 more (seeds 1601-2400); all matches of a pair are pooled (196 to 1,400 per pair). A pair is "in" when its pooled 95 % interval (rate +- 1.96 sqrt(p (1 - p) / n)) lies inside the band, "near an edge" when the rate is inside and the interval crosses the edge, and "out" when the rate is outside (more than half of the interval outside). The runs also tally each hit under the string step that threw it and count `boostStart`. Tools: the session runner (scratch, not in the repo), an all-pairs driver over the harness; it loads the game script in a plain function instead of a vm context, which runs the same seeded matches (identical tick counts) about 4 times faster.
  - Before (the data of P5-01 / P5-02, boost on): 77 / 94 / 98 / 95 of 136 pairs inside at Hard / Easy / Normal / Expert. Judo, BJJ and Hapkido won 24-34 % at Easy, Normal and Hard (their strings had no strong step in P P and K K, and the AI throws and holds in under 1 % of its damage, so their strike damage decides); Wing Chun 28-33 % at Hard and Expert; Muay Thai 73 % at Expert (the teep starts a tick before the front kick, a Sway AI cannot read it in time: a 1-tick change of the teep moved Muay Thai 20 points). Worst string 33 % (Muay Thai K at Expert). Every row was thrown. History of the fixes: pass 1 changed the judo-family P P / K K rows, Hapkido's Crouch K K, the Muay Thai K K row and the teep, Wing Chun's chain and trap and Expert's perfect-block chance; pass 2 chased the 9 pairs that stayed out (the P K push kick of Judo, BJJ and Hapkido went back to the default Heavy Body Kick; Hard perfect-block chance 0.2 to 0.25 with the Hard fingerprint re-recorded); the review then found Muay Thai at Easy still 66 % against three styles on fresh seeds and its signature Shin Round Kick unreachable, and pass 3 gave Muay Thai its plain rows back (K K K ends on the Heavy Roundhouse again) and made the teep the front kick (start 9, recovery 15, push 0.6; it keeps its own block push 1.0). Before pass 3: Muay Thai with a strong K K step (Heavy Roundhouse, then Push Kick) won 61-63 % against the Block strikers at Expert or 41 % overall at Easy, where three-step strong enders are 7 % of the damage; with a push of 0.65 and a 14-tick recovery it won 60-66 % against the Sway styles at Expert (the Sway AI cannot punish a teep that recovers a tick sooner); push 0.7 or 0.8 left it 40-46 % at Hard. The teep push moved Muay Thai about 6 points per 0.1 at Hard, so reach (a step: 1.5 moved it 15 points, 1.55 not at all) was not used.
  - Changes (three passes of the same day; data and two AI numbers; every fighter that is not one of these styles plays exactly as before. The Easy and Expert fingerprints hold; the Hard one (KAI vs MARA) was re-recorded, with the replay hash of the same match on the pre-P8 layouts, because the Hard perfect-block chance changed on purpose; the code before P8-02 from a git copy, with only that number changed, gives the same replay hash, so the neutrality guard still holds at Hard):

| What | Before | After | Why |
|---|---|---|---|
| Judoka rows (BJJ and Hapkido inherit them) | P P and K K: the default Jab, Cross / Front Kick, Roundhouse; P K = Jab, Push Kick | P P = Jab, Hook; K K = Front Kick, Heavy Roundhouse (the Wrestler's); P K back to the default Jab, Heavy Body Kick (second pass) | no strong step in the two most thrown strings: 25-35 % at every level; the push kick (12 damage) left them 5-10 points behind at Easy, where strong second steps are most of the damage (Judo vs Brawler 30 %, Karate over Judo 66 %); now 46-53 % at every level |
| Hapkido | K K = Front Kick, Spinning Heel | Crouch K K = Low Kick, Spinning Heel (replaces the Sweep) | the light heel kick as a standing step: 30 % |
| Muay Thai rows | the default table with the teep as K step 1 and the elbow in P P P (K K = Teep, Roundhouse; K K K = Teep, Roundhouse, Heavy Roundhouse; K K P ends on the Power Jab) | unchanged: passes 1 and 2 tried a strong K K step (Heavy Roundhouse, then Push Kick, with K K K removed or ending on the Heavy Roundhouse) and pass 3 took it back | Muay Thai at Easy lacked the three-step strong enders (7 % of the damage there) and still won 61-63 % against the Block strikers at Expert with a strong K K; the signature Shin Round Kick has to stay reachable (new self-test) |
| Teep | 8 / 3 / 14, push 1.0, reach 1.6 | 9 / 3 / 15, push 0.6, reach 1.6, block push 1.0 (the front kick's start, recovery and push, -2 / -8) | a teep that starts a tick before the front kick, recovers a tick sooner and pushes further beat the Sway styles 80-90 % (Easy to Hard) and 60-66 % at Expert; this is what the signature kick can be without out-playing the front kick |
| Chain Punch | 5 / 2 / 8, 4 damage, reach 1.3, +3 / -3 | 5 / 2 / 10, 5 damage, reach 1.4, hitstun 14, blockstun 8, +3 / -3 | Wing Chun 33 % at Hard; stays inside the damage-per-frame and advantage band of the existing punches |
| Trap Strike | 7 / 3 / 12, 6 damage, reach 1.3, +1 / -6 | 6 / 3 / 12, 6 damage, reach 1.5, hitstun 17, blockstun 10, +3 / -4 | same |
| Expert perfect-block chance (`DIFFICULTY.expert.parry`) | 0.35 | 0.30 | Block won 56.8 % of 1,800 Expert matches with or without the boost; now 53.8 % (boost on) and 54.1 % (off); the fingerprints do not change |
| Hard perfect-block chance (`DIFFICULTY.hard.parry`, second pass) | 0.20 | 0.25 | Sway was ahead at Hard (Block 47.3 %) and Boxing and Capoeira beat the Block strikers 61-67 %; now Block 50.3 % (600 matches) and 48.2 % (1,800), the Boxing and Capoeira pairs 52-60 % at 600 matches; the Hard fingerprint changes (re-recorded) |

  - Result, final run (boost on; matches per pair as in the method; "in" = the pooled 95 % interval lies inside the band, "near an edge" = rate inside, interval crosses the edge, "out" = rate outside). Before: the old data, 200 matches per pair, pairs inside the band; boost off at Hard is below:

| Difficulty | Band | Before (old data, 200 matches) | Matches per pair | In | Near an edge | Out |
|---|---|---|---|---|---|---|
| Easy | 35-65 % | 94 / 136 inside; worst Kickboxing over Hapkido 86 % | 200-1,400 | 136 | 0 | 0 |
| Normal | 35-65 % | 98 / 136; worst Wrestling over Judo 83 % | 200-600 | 136 | 0 | 0 |
| Hard | 40-60 % | 77 / 136; worst Muay Thai over BJJ 95 % | 600-1,400 | 132 | 4 | 0 |
| Expert | 40-60 % | 95 / 136; worst Muay Thai over Wing Chun 91 % | 196-1,398 | 119 | 17 | 0 |

  - Of 544 pairs, 0 are out: 523 have their whole interval inside the band and 21 are near an edge (listed below). Boost off, Hard, the same 600 matches per pair on the final build: 122 in, 14 near an edge, 0 out (boost on, the same matches: 120 in, 16 near an edge, 0 out), mean shift on - off -0.6 points, mean absolute shift 2.0, no pair changes class, 1.06 boosts per fighter per round. Normal, Easy and Expert were not run with the boost off in this pass; the boost feeds on perfect blocks and perfect sways (+20 each), so the Hard (0.2 to 0.25) and Expert (0.35 to 0.3) perfect-block chances do reach it, which is why the Hard comparison was redone after them.

  - Overall win rate per style against the other 15, before / after (final run, boost on, pooled matches):

| Style | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Boxing | 56 / 52 | 52 / 45 | 60 / 55 | 48 / 46 |
| Kickboxing | 61 / 56 | 55 / 51 | 56 / 47 | 50 / 48 |
| Karate | 59 / 55 | 55 / 52 | 55 / 50 | 52 / 52 |
| Wrestling | 50 / 44 | 58 / 51 | 56 / 49 | 51 / 54 |
| Judo | 29 / 43 | 33 / 51 | 34 / 53 | 43 / 50 |
| Street Brawler | 60 / 57 | 56 / 51 | 56 / 47 | 51 / 47 |
| Capoeira | 57 / 54 | 56 / 51 | 59 / 53 | 53 / 52 |
| Wing Chun | 50 / 54 | 48 / 50 | 33 / 49 | 28 / 54 |
| Muay Thai | 44 / 51 | 48 / 49 | 53 / 46 | 73 / 48 |
| Taekwondo | 55 / 49 | 53 / 47 | 54 / 48 | 50 / 46 |
| Sambo | 51 / 46 | 57 / 49 | 57 / 50 | 52 / 53 |
| BJJ | 29 / 43 | 33 / 52 | 34 / 55 | 43 / 51 |
| Hapkido | 24 / 44 | 30 / 50 | 30 / 51 | 47 / 49 |
| Kali | 57 / 50 | 56 / 50 | 54 / 49 | 53 / 53 |
| Krav Maga | 60 / 54 | 55 / 52 | 55 / 50 | 54 / 48 |
| MMA | 60 / 53 | 56 / 52 | 53 / 46 | 53 / 48 |

  - Pairs near an edge in the final run (none is out), the first-named style wins the rate given. Hard (4, 1,400 matches each): Judo over Kickboxing 57.6, BJJ over Kickboxing 57.6, BJJ over Street Brawler 57.6, BJJ over Muay Thai 57.5. Expert (17): Wrestling over Street Brawler 59.8, over Muay Thai 59.0 and over Krav Maga 58.8, Sambo over Krav Maga 58.9 (1,391 matches each; they were 60.4-62.2 at 600 matches and moved in with 800 fresh ones), Judo over Wrestling 56.9, BJJ over Sambo 56.9 and over Wrestling 56.9, Sambo over Muay Thai 56.7, Kali over Hapkido 56.6, Muay Thai over Taekwondo 56.6, MMA over Boxing 56.5, Wrestling over Kickboxing 56.4, Karate over Street Brawler 56.3 and over Taekwondo 56.3, Sambo over Kickboxing and over Street Brawler 56.2, and the Boxing mirror 43.3 (a mirror's rate counts the first-named side, which is seat 0 on odd seeds and seat 1 on even ones, so this is noise, not seat bias: the seat-1 win rate of the Boxing mirror at Expert is 48.6 % over 593 matches, see "Seat fairness" below); about 595 matches each unless given. Pairs that looked out after the first 200 matches and came back inside once pooled: Easy Wrestling vs Street Brawler 32.0, now 38.9 over 1,400 matches, and Karate over BJJ 65.5 and Judo 64.5, now 58.6 over 1,400; Expert Muay Thai over Hapkido and BJJ 66.0 / 65.0 with the old teep, now 49.7 / 50.3 with the final one. Watch list for P14-04: the judo family is up to 7 points ahead of Wrestling and Sambo at Expert and ahead of Kickboxing and Brawler at Hard, Wrestling and Sambo are 5-6 points ahead of some Block strikers at Expert, Boxing is the strongest style at Hard (55 %) and Judo, BJJ, Hapkido and Wrestling the lightest at Easy (43-44 %).
  - Strings: worst share of a fighter's damage 27 % (Wing Chun K at Expert; limit 35 %), most styles' K (Front Kick) 17-24 %; every row of every style is thrown at some difficulty (all four difficulties together, final run); the strong-ender and loop self-tests pass (all strong enders -7 or less on block, no loop).
  - Time to KO (P14-01 row, for P14-04): mean match 37 s at Hard (2.5 rounds of 15 s), 46 s at Normal, 94 s at Easy, 145 s at Expert; Expert has 11 rounds per match and 1.2 % of its matches (331 of 27,200; 295 before) run to the 15-minute cap with no winner: the Expert AI draws rounds and sometimes never finishes one. Not caused by this task and not tuned here.
- Balance check (P3-09 / P3-10 / P3-11), Block vs Sway (same fighter, only the defense differs, both seats, 300 seeds = 600 matches unless noted), Block / Sway wins:

| Difficulty | Boost on | Boost off |
|---|---|---|
| Easy | 305 / 295 (50.8 / 49.2) | 294 / 306 (49.0 / 51.0) |
| Normal | 276 / 324 (46.0 / 54.0) | 278 / 322 (46.3 / 53.7) |
| Hard, before the parry change | 284 / 316 (47.3 / 52.7) | 275 / 325 (45.8 / 54.2) |
| Hard, parry 0.25 | 600 matches 302 / 298 (50.3 / 49.7); 1,800 matches 868 / 932 (48.2 / 51.8) | 600 matches 297 / 303 (49.5 / 50.5) |
| Expert, before the parry change | 329 / 265 (55.4 / 44.6); 1,800 matches 1,016 / 774 (56.8 / 43.2) | 337 / 255 (56.9 / 43.1); 1,800 matches 1,010 / 771 (56.7 / 43.3) |
| Expert, parry 0.30 | 600 matches 311 / 283 (52.4 / 47.6); 1,800 matches 963 / 827 (53.8 / 46.2) | 1,800 matches 964 / 817 (54.1 / 45.9) |

  - The boost does not move it (-1.5 to +1.8 points, inside the noise); Expert was 1.8 points over the band with or without the boost, which is why the perfect-block chance changed (0.25 gave 49.8 %). Normal 276 / 324 is as before (the first-pass Hard re-run gave 284 / 316 before the Hard parry change above). The sway pose and effects of P3-11 are visual and never enter the fight's rules, so they change nothing here. One old exception: `MatchSim.breakHeld` puts the glass of a breaking bottle (and other item debris) at the drawn hand point (`Fighter.pts`), so pose blending, the sway pose included, can move where those shards lie by a few centimetres; it is deterministic (a seeded match plays the same every time) and changes no hit, damage or result. The perfect-sway ring follows the floor under the swayer (`def.y + 0.05`), so it also shows on a raised deck.
  - Boost on against off, all pairs: first pass (old data, 200 matches each) Hard mean shift +0.5 points, mean absolute shift 3.1, Normal +0.7 and 2.7; final build (Hard, 600 matches each way on the same fresh seeds): mean shift -0.6, mean absolute shift 2.0, no pair changes class (in / near an edge / out), 1.06 boosts per fighter per round. Two independent runs of one pair differ by about 3-5 points, so a shift of 2 is noise. The boost is not what puts any pair near an edge, and its values stay (gauge 1.6 per damage, 20 per perfect block or sway, 5 s, x1.15).
- Seat fairness (measured 2026-10-30, nothing changed): the engine updates seat 0 before seat 1 and seat 0 spawns at -x on the asymmetric Warehouse, so each style played itself with no seat swap (the same body and AI on both sides, 600 matches per mirror, fresh seeds 3001-3600, boost on) and the seat-1 win rate was counted. Pooled over the 16 mirrors: Easy 50.9 % (95 % interval 49.9-51.9), Normal 51.0 % (50.0-52.0), Hard 51.5 % (50.5-52.5), Expert 49.9 % (48.9-50.9). Seat 1 is above 50 % in 10, 11, 12 and 8 of the 16 mirrors, so it is not consistently above: a point at most at Hard and Normal, nothing at Expert. Outliers: the Wrestling and Sambo mirrors at Normal 58.0 / 58.3 %, Krav Maga 55.8 % at Hard, 54.2 % at Easy and 54.2 % at Expert; no other mirror is more than 2 points beyond the noise of 600 matches (about 4 points). The style-pair runs swap the seats on every second seed, so a pair's rate carries no seat effect on average. (These mirrors ran without a ring; a 1v1 in a ring draws the start side since the P9 follow-up, Appendix C "1v1 seat balance".)
- Moves in the strings (frame data is nominal; Training shows the same numbers):

| Move | Tier | Start / Active / Recover | Dmg | Stam | Reach | Adv hit / block | Effect |
|---|---|---|---|---|---|---|---|
| Jab | 1 | 5 / 3 / 9 | 5 | 3 | 1.4 | +3 / -3 | - |
| Body Jab | 1 | 6 / 3 / 10 | 5 | 3 | 1.35 | +2 / -4 | - |
| Power Jab | 3 strong | 10 / 3 / 17 | 9 | 9 | 1.4 | +3 / -7 | stagger, guard break |
| Gut Punch | 3 strong | 11 / 3 / 19 | 10 | 10 | 1.25 | +3 / -8 | stagger, guard break |
| Cross | 2 | 8 / 3 / 13 | 7 | 5 | 1.5 | +1 / -6 | - |
| Hook | 3 strong | 12 / 4 / 21 | 13 | 9 | 1.2 | -2 / -11 | stagger, guard break |
| Uppercut | 2 | 10 / 3 / 17 | 8 | 6 | 1.1 | -1 / -9 | launch |
| Heavy Uppercut | 3 strong | 16 / 4 / 27 | 15 | 12 | 1.1 | -6 / -16 | launch, guard break |
| Front Kick | 1 | 9 / 3 / 15 | 6 | 5 | 1.6 | -2 / -8 | - |
| Push Kick | 3 strong | 15 / 4 / 25 | 12 | 11 | 1.65 | -4 / -14 | stagger, guard break |
| Low Kick | 1 | 8 / 3 / 12 | 6 | 4 | 1.45 | 0 / -6 | - |
| Sweep | 3 strong | 12 / 4 / 26 | 11 | 10 | 1.5 | -9 / -17 | knockdown, guard break |
| Roundhouse | 2 | 11 / 4 / 19 | 11 | 7 | 1.5 | -2 / -11 | - |
| Heavy Roundhouse | 3 strong | 17 / 5 / 30 | 18 | 13 | 1.55 | -8 / -19 | knockdown, guard break |
| Body Kick | 2 | 11 / 4 / 19 | 9 | 7 | 1.45 | -2 / -11 | - |
| Heavy Body Kick | 3 strong | 17 / 5 / 30 | 16 | 13 | 1.5 | -8 / -19 | stagger, guard break |

- Default string table (Kickboxer and Brawler; the rows are unchanged by P3-10), measured with KAI:

| Input | Steps | Dmg | Stam | Foe locked (f) | Against a full block | Share % |
|---|---|---|---|---|---|---|
| P | Jab | 4.8 | 3 | 19 | 1 blocked | 9.4 |
| P P | Jab, Cross | 12.4 | 8 | 36 | 2 blocked | 9.1 |
| P P P | Jab, Cross, Hook | 25.4 | 17 | 66 | 2 blocked, step 3 breaks it (foe stunned 92f) | 3.3 |
| P K | Jab, Heavy Body Kick | 22.6 | 16 | 38 | 1 blocked, step 2 breaks it (foe stunned 92f) | 15.4 |
| P K P | Jab, Heavy Body Kick, Cross | 29.4 | 21 | 39 | 1 blocked, step 2 breaks it (foe stunned 45f), then 1 hit | 2.5 |
| P P K | Jab, Cross, Push Kick | 23 | 19 | 70 | 2 blocked, step 3 breaks it (foe stunned 92f) | 7.3 |
| K | Front Kick | 5.7 | 5 | 20 | 1 blocked | 17.3 |
| K K | Front Kick, Roundhouse | 17.6 | 12 | 43 | 2 blocked | 7.6 |
| K K K | Front Kick, Roundhouse, Heavy Roundhouse | 35.6 | 25 | 149 | 2 blocked, step 3 breaks it (foe stunned 92f) | 1.9 |
| K P | Front Kick, Jab | 10.5 | 8 | 29 | 2 blocked | 3.1 |
| K P P | Front Kick, Jab, Heavy Uppercut | 25.5 | 20 | 131 | 2 blocked, step 3 breaks it (foe stunned 92f) | 0.3 |
| K K P | Front Kick, Roundhouse, Power Jab | 25.5 | 21 | 66 | 2 blocked, step 3 breaks it (foe stunned 92f) | 0.8 |
| Crouch + P | Body Jab | 4.8 | 3 | 19 | hits through (mid) | 8.1 |
| Crouch + P P | Body Jab, Uppercut | 13.7 | 9 | 126 | hits through (mid) | 1.3 |
| Crouch + P P P | Body Jab, Uppercut, Gut Punch | 22.5 | 19 | 146 | hits through (mid) | 0.3 |
| Crouch + K | Low Kick | 5.7 | 4 | 19 | 1 blocked | 5.3 |
| Crouch + K K | Low Kick, Body Kick | 15.4 | 11 | 43 | 1 blocked, 1 hit | 1.5 |
| Crouch + K K K | Low Kick, Body Kick, Sweep | 25.1 | 21 | 143 | 1 blocked, 2 hit | 0.2 |

- Per-style rows (a style plays the default table with these changes; a removed row means that press starts a new string):

- boxer (measured with yuki): changed rows below; rows removed: K K K.

| Input | Steps | Dmg | Stam | Foe locked (f) | Against a full block | Share % |
|---|---|---|---|---|---|---|
| P K P | Jab, Heavy Body Kick, Power Jab | 30.5 | 25 | 52 | 1 blocked, step 2 breaks it (foe stunned 58f), then 1 hit | 2.4 |
| K K P | Front Kick, Roundhouse, Jab | 21.9 | 15 | 46 | 3 blocked | 1.3 |

- karateka (measured with zero): no changed row; rows removed: P P P, K P P.

- capoeira (measured with mara): changed rows below; rows removed: P P P, K P P.

| Input | Steps | Dmg | Stam | Foe locked (f) | Against a full block | Share % |
|---|---|---|---|---|---|---|
| K K P | Front Kick, Roundhouse, Jab | 21.9 | 15 | 46 | 3 blocked | 0.5 |

- wrestler (measured with dmitri): changed rows below; rows removed: P P P, P K P, P P K, K K K, K P P, K K P, Crouch + P P P, Crouch + K K K.

| Input | Steps | Dmg | Stam | Foe locked (f) | Against a full block | Share % |
|---|---|---|---|---|---|---|
| P P | Jab, Hook | 21.1 | 12 | 51 | 1 blocked, step 2 breaks it (foe stunned 92f) | 10.5 |
| K K | Front Kick, Heavy Roundhouse | 28.3 | 18 | 107 | 1 blocked, step 2 breaks it (foe stunned 92f) | 13.1 |
| K P | Front Kick, Power Jab | 16 | 14 | 48 | 1 blocked, step 2 breaks it (foe stunned 92f) | 6.3 |

- judoka (measured with a KAI copy, no preset fighter; BJJ plays the same rows, Hapkido the same rows except Crouch K K): changed rows below, final table after P14-01 (2026-10-30: P P and K K added); rows removed: P P P, P K P, P P K, K K K, K P P, K K P, Crouch + P P P, Crouch + K K K. Dmg, Stam and the block column re-measured on 2026-10-30 with the same method as the tables above (the old P K / K P / Crouch K K figures agree within 1.4 damage and 3 f); Share % = share of the fighter's damage over the 136-pair runs at Hard and Normal, 200 matches per pair.

| Input | Steps | Dmg | Stam | Foe locked (f) | Against a full block | Share % |
|---|---|---|---|---|---|---|
| P P | Jab, Hook | 18.8 | 12 | 50 | 1 blocked, step 2 breaks it (foe stunned 92f) | 6.7 |
| K K | Front Kick, Heavy Roundhouse | 25.1 | 18 | 110 | 1 blocked, step 2 breaks it (foe stunned 92f) | 9.2 |
| K P | Front Kick, Power Jab | 14.2 | 14 | 47 | 1 blocked, step 2 breaks it (foe stunned 92f) | 4.3 |
| Crouch + K K | Low Kick, Sweep | 16.1 | 14 | 127 | 1 blocked, step 2 breaks it (foe stunned 92f) | 2.8 |

  (P K is the default row, Jab, Heavy Body Kick: 22.1 damage, 16 stamina, foe locked 37 f, 13.1 % of the damage.)

- hapkido (the judoka rows, BJJ's and Judo's, with one change; measured with a KAI copy): Crouch K K = Low Kick, Spinning Heel Kick replaces the Judo sweep (a light move: no knockdown, no guard break); rows removed as for the judoka. Wing Chun and Muay Thai below were measured the same way.

| Input | Steps | Dmg | Stam | Foe locked (f) | Against a full block | Share % |
|---|---|---|---|---|---|---|
| Crouch + K K | Low Kick, Spinning Heel Kick | 14.3 | 10 | 40 | 2 blocked | 2.0 |

- muaythai (the default table with the teep as K step 1 and the elbow ending P P P; P14-01 pass 3 gave the original rows back, final numbers):

| Input | Steps | Dmg | Stam | Foe locked (f) | Against a full block | Share % |
|---|---|---|---|---|---|---|
| K | Teep | 5.7 | 5 | 19 | 1 blocked | 18.1 |
| K K | Teep, Roundhouse | 17.6 | 12 | 42 | 2 blocked | 6.1 |
| K K K | Teep, Roundhouse, Heavy Roundhouse | 35.1 | 25 | 152 | 2 blocked, step 3 breaks it (foe stunned 92f) | 1.7 |
| K P | Teep, Jab | 10.5 | 8 | 28 | 2 blocked | 2.6 |
| K P P | Teep, Jab, Heavy Uppercut | 25.1 | 20 | 134 | 2 blocked, step 3 breaks it (foe stunned 92f) | 0.2 |
| K K P | Teep, Roundhouse, Power Jab | 25.3 | 21 | 65 | 2 blocked, step 3 breaks it (foe stunned 92f) | 0.6 |
| P P P | Jab, Cross, Elbow | 19.2 | 14 | 50 | 3 blocked | 0.8 |

- wingchun (Boxing's rows as the base; standing rows listed, the crouch rows are the default ones; K K K is removed as for Boxing):

| Input | Steps | Dmg | Stam | Foe locked (f) | Against a full block | Share % |
|---|---|---|---|---|---|---|
| P | Chain Punch | 4.8 | 2 | 18 | 1 blocked | 9.6 |
| P P | Chain Punch, Trap Strike | 11.3 | 6 | 34 | 2 blocked | 6.0 |
| P P P | Chain Punch, Trap Strike, Power Jab | 19 | 15 | 60 | 2 blocked, step 3 breaks it (foe stunned 92f) | 3.3 |
| P K | Chain Punch, Heavy Body Kick | 22.1 | 15 | 37 | 1 blocked, step 2 breaks it (foe stunned 92f) | 10.1 |
| P K P | Chain Punch, Heavy Body Kick, Trap Strike | 27.9 | 19 | 38 | 1 blocked, step 2 breaks it (foe stunned 43f), then 1 hit | 1.9 |
| P P K | Chain Punch, Trap Strike, Push Kick | 21.6 | 17 | 67 | 2 blocked, step 3 breaks it (foe stunned 92f) | 4.4 |
| K P | Front Kick, Chain Punch | 10.5 | 7 | 28 | 2 blocked | 2.8 |
| K P P | Front Kick, Chain Punch, Trap Strike | 16.3 | 11 | 44 | 3 blocked | 0.9 |
| K K P | Front Kick, Roundhouse, Chain Punch | 21.9 | 14 | 46 | 3 blocked | 0.5 |
  - Boxer: punch-heavy. The P K P string ends on the Power Jab, the Heavy Roundhouse (K K K) is gone, and K K P ends on a plain jab: strong punches Hook, Power Jab, Heavy Uppercut, Gut Punch; strong kicks Heavy Body Kick, Push Kick, Sweep.
  - Karateka: kick-heavy. No Hook (P P P) and no Heavy Uppercut (K P P); the strong kicks (Heavy Body Kick, Push Kick, Heavy Roundhouse, Sweep) and the Power Jab and Gut Punch remain.
  - Capoeira: kick-heavy and flowing. No Hook, no Heavy Uppercut and no Power Jab (K K P ends on a plain jab); the strong kicks and the Gut Punch / Sweep crouch rows remain.
  - Wrestler and Judoka: strings of two moves at most, ending on a stagger or a knockdown so a grab or a hold (both styles can hold a downed foe) follows. Wrestler: P P = Jab, Hook; K K = Front Kick, Heavy Roundhouse (knockdown); K P = Front Kick, Power Jab; P K keeps the Heavy Body Kick. Judoka: K P = Front Kick, Power Jab; Crouch K K = Low Kick, Sweep (knockdown); P K = Jab, Heavy Body Kick (the default row; it was Jab, Push Kick until P14-01's second pass on 2026-10-30); since P14-01 (2026-10-30) also P P = Jab, Hook and K K = Front Kick, Heavy Roundhouse like the Wrestler (with plain P P / K K rows Judo, BJJ and Hapkido won 25-35 % at every difficulty, the all-pairs check in "P14-01 all-pairs check" below). The two-move Hook row stands in for the lost three-move rows; without it DMITRI fell from 37 % to 20-30 % at Hard.
  - Move styles without a preset (Judoka) were measured with a KAI copy. Styles the game does not have yet (the rest of the 16 in P1-04) use the default table until they get rows in `STYLE_STRINGS`.
- Strong enders: all 8 strong moves have a block advantage between -7 (Power Jab) and -19 (Heavy Roundhouse, Heavy Body Kick), at least the jab's 5 startup. A self-test checks every strong move of every table.
- Launch, knockdown and juggle: launchers are the Uppercut (Crouch P P step 2) and the Heavy Uppercut (K P P step 3); knockdowns are the Heavy Roundhouse (K K K, and K K for the Wrestler, Sambo, Judoka, BJJ and Hapkido), the Sweep (Crouch K K K, and Crouch K K for the Judoka and BJJ; Hapkido's Crouch K K ends on the light Spinning Heel Kick, so Hapkido has no sweep) and the counter kick. A launched foe is juggled: the next step can hit him (Gut Punch after the Uppercut lands, the foe is locked 146 f), the juggle count ends at JUGGLE_LIMIT 3, and a knockdown (down 107-149 f, then the 6 f wake-up grace) ends it.
- Chains outside strings: a Punch or Kick press that does not continue the string is step 1 of a new one, so the only buffered chain left is a step 1 pressed in the chain window of the previous move; `Combat.canChain` allows it from the same or a lower tier only, a strong move ends the chain, tier-1 repeats are limited and 4 chained moves are the most. The looped-press self-tests (every row of every style, standing, guarding, juggled) cover them.

#### Decisions (continued)

- sidestep: stays, as a gesture, not an action: double-tap left or right (relative to the opponent or lock target, as today). 6 stamina, 18 ticks, no i-frames, unchanged values. Double-tap toward the opponent still arms run. Double-tap away does nothing now. Reason: sidestep is movement, needs no button, and gives Block characters a way to leave a line without an i-frame dodge; Sway keeps the i-frame identity. Remove the `rel === 'back'` branch (breakpoint.html:1082) and the `Events.emit('dash')` name in startSidestep (:3380; rename the event, update sound/FX listeners).
- context-sensitive touch buttons: approved for exactly two.
  - USE: visible only while an item is within pick-up reach or is being held. Reason: items exist only in some arenas and moments; a permanent button would be dead weight most of the time. It takes a fixed reserved slot (the old DASH slot over GRAB), so nothing shifts when it appears. Hidden = no pointer events, no tab stop.
  - LOCK: visible only while 2 or more hostile fighters are alive (brawler levels). Reason: in the four 1v1 modes the opponent is always the target, so the button would do nothing. Fixed reserved slot, same rules.
  - Not approved: any other hide / show button, any button whose label changes meaning (for example turning GRAB into TAKE), and any auto-hiding of PUNCH, KICK, DEFEND, GRAB, JUMP, DUCK, II. Reason for the label rule: a swap would stop the player from grabbing an enemy that stands next to an item.
  - P2-04 places them; constraint: both reachable by the right thumb without leaving the PUNCH / KICK cluster, both small size, both inside safe areas.
- touch modifier check (rule: no action needs more than one simultaneous modifier; a held stick direction is movement, not a modifier button):
  - Move, run (stick held toward target), sidestep (double flick): stick only, 0 modifiers.
  - PUNCH / KICK press (strings are sequential presses): 0 modifiers.
  - DUCK + PUNCH / KICK (low variant and crouch strings): 1 modifier (DUCK).
  - Touch with DUCK not held: automatic height as today (keeps touch playable one-thumb); DUCK held overrides it.
  - DEFEND hold or press: 0 modifiers. DEFEND + stick direction (sway direction): stick is movement, 0 modifier buttons.
  - DUCK + DEFEND (low guard): 1 modifier (DUCK).
  - DEFEND tap while down (quick recovery): 0 modifiers.
  - GRAB: 0 modifiers; DUCK + GRAB (low grab): 1 modifier; stick direction aims a throw (movement).
  - In a clinch: PUNCH (elbow), KICK (knee), GRAB (throw / escape): 0 modifiers each.
  - JUMP: 0; in-air PUNCH / KICK: sequential, 0.
  - USE tap (drop), USE hold-release (throw), USE press (pick up): 0 modifiers.
  - LOCK tap: 0; LOCK + stick direction (switch target, recommended): stick only.
  - II: 0.
  - Result: the maximum is 2 simultaneous buttons (DUCK plus one other), so no action needs more than one modifier. No combo needs 3 buttons or 2 modifiers. No combo needs the left thumb on the stick and DUCK at the same time, so DUCK combos are done standing still.

#### Migration notes for P2-03

- Bump KEYS_REVISION from 3 to 4 (key `breakpoint.v1.keys` and `breakpoint.v1.keys2`, `revision` field). Order of migrations on load: revision below 3 -> existing mergeAttackKeys; revision below 4 -> the new step below. The revision-2 step (strong / height / dash off Shift, Ctrl, Alt) and OLD_DEFAULT_KEYS become dead code: delete them, since those actions no longer exist. Update the self-tests at breakpoint.html:8747-8750 that name strong / height / dash.
- load() already ignores any saved action not in ACTIONS, so these old entries simply disappear on load: strong, height, dash, blockLow. Their keys become free.
- Unchanged actions keep their saved keys exactly: up, down, left, right, punch, kick, jump, crouch, grapple, pause.
- blockHigh -> defend:
  - Saved list equals the old default (P1 ['KeyQ'], P2 ['Numpad1']) or is missing: defend takes the new default (P1 KeyL, P2 Numpad6), unless a kept binding already uses it (then load() falls back to the next free key, as it does today).
  - Saved list differs from the old default (the player chose it): defend takes that list as is, subject to the normal validity and duplicate checks in load().
- blockLow: dropped (no equivalent; crouch + defend replaces it). If the player customized only blockLow and left blockHigh at default, defend still takes the new default. Documented, not migrated.
- New actions use and lock get their defaults (P1 E and Q, P2 Numpad1 and Numpad2) when those keys are free; a key a player moved onto Q, E, Numpad1 or Numpad2 for another action always wins, and the new action takes the next free fallback key. Same-key reuse note: an untouched 1.0.0 layout has Q = old high block and E = old low block; after migration Q = lock and E = use. Show one toast on first load after migration: "Controls changed: see Controls".
- P2 (breakpoint.v1.keys2): same rules; P2 still never takes P1's main keys (existing `used` set).
- Gamepad: no saved mapping exists (the map is hard-coded in pollPad, :969), so nothing to migrate. Replace the map with: punch [2,3], kick [0,1], defend [5], lock [4], use [6], grapple [7,11] (plus right-stick flick), pause [9], reset on Select hold. Remove strong, height, blockHigh, blockLow, dash entries. Menu buttons read raw 4 to 7.
- Touch: nothing saved. Replace the block button with `defend`, remove `dash`, add `use` and `lock` (hidden by default). Remove the special `touchHeld.block` branch (:1074); `defend` is a normal action and `crouch` + `defend` is handled in fillIntent.
- Intent fields (makeIntent / clearIntent): remove blockH, blockL, dash; add `defend` (held), `use` ('', 'press', 'tap', 'hold') and `lock` (one-tick pulse). Keep `strong`, `height`, `sidestep`, `grapple`, `crouch`, `jump`, lp / rp / lk / rk. `strong` and `height` become derived (hold time at release; crouch held at release or touch auto-height). Fighter reads `defend` + `crouch` where it read blockH / blockL (updateFree :3452, perfect-block timing, AI plans 'guard', dummy modes 'block' / 'blockLow' :5151-5152).
- Progress: add a controls revision so the first-match controls card shows again once (set Progress.seenControls to false when the stored controls revision is below 4). Recommendation for P2-07.
- Labels to rewrite (P2-08): ACTIONS (:574), ACTION_LABELS (:575), DEFAULT_KEYS (:581), FALLBACK_KEYS (:587), DEFAULT_KEYS_P2 (:590), GAMEPAD_LABELS and TOUCH_LABELS (:6411-6412), showOnboarding (:6508-6521), layoutText (:6943), Controls screen hint text and movement text (:6961-6968, remove the back-dash and "Dash while knocked down" sentences), Move list input column (:6976, replace "+ Strong" / "+ Height" with "hold" / "+ Crouch") and clinch text (:6986), clinch hint (:7273-7275).

### Phase 3 owner decisions (2026-10-28)

- P3-02 Block and Sway ("balanced defaults"):
  - Block: hold Defend; standing covers high + mid, Crouch + Defend covers low. Perfect block = the existing window (PERFECT_BLOCK_TICKS after the press, with the existing cooldown) and opens one counter. Stamina drain as today. Strong attack-string moves break any non-perfect block (stun 80 ticks); strong moves also deal small chip damage (8% of their damage, never the last point of health).
  - Sway: press Defend = a 0.2 s dodge (12 ticks) with invincibility to strikes (not to grabs), 10 stamina, 0.25 s recovery (15 ticks) in which the fighter can be hit; a held Defend does not repeat. Stick direction picks the lean (back by default, left / right). A strike that would have hit during the last 6 ticks of the dodge counts as a perfect sway and opens one counter (same counter window and moves as a perfect block). Sway cannot be guard-broken; its risk is the recovery and the stamina.
  - Balance target until P14-01 sets one: in the P0-06 runner, Block vs Sway fighters of equal stats win 45-55% each.
- P3-11 sway pose (2026-10-30; visual only, the sim window, travel, costs and AI are unchanged):
  - Cause (owner: the fighter looks hit because it did not sway enough): the old pose ramped its lean in over 4 ticks and the drawn pose followed at blend 0.5, so on i-frame ticks 0-3 it was 13 / 31 / 53 / 77 % there while the sim already ignored the strike; the lean was 0.6 rad back and the fighter had travelled 0.14 m by tick 3. Measured with a strike that goes active on the first i-frame tick and the foe's chest on the fist: the drawn torso point was 0.10 m from the fist path (head 0.47 m), the strike went through the chest. Sideways leans never tipped the torso back and their root shift pointed the wrong way (against the sim travel). The 'block' effect also drew a cyan ring at the body height on every sway.
  - Pose (`SWAY_POSE`, `SWAY_POSE_BLEND`, `SWAY_POSE_RETURN_TICKS`; `Fighter.computePose`, case SWAY): full lean from the first i-frame tick (blend 0.9 for every fighter: the sway ignores the speed-based pose blend, which gave the slowest Creator body only 0.81 on the first tick) to the last (tick 11), upright 3 ticks after the i-frames end (the fighter can be hit again from tick 12). Lean back 0.9 rad, head 0.4 rad, root 0.28 m back, knees +0.3 rad; a sideways lean adds torso roll 0.5 rad, root shift 0.25 m (now the way the sim moves the fighter) and wider hips, and still tips back so the strike on the near side is cleared too. The sim travel is unchanged (3 m/s fading over the i-frames, 0.3 m).
  - Effects: a plain sway shows no ring, spark or flash at the body (the 'SWAY' text and the stats still count it); a perfect sway marks the floor under the fighter with the gold ring (no flash; the ring height follows the floor, so it shows on raised decks). A swayed strike never flashes the fighter (`flash` stays 0) or starts a reaction.
  - Gap, as measured by the self-tests "Sway pose": the drawn head and torso (`Fighter.pts`, the skeleton the renderer draws) must stay at least 0.10 m of air from the drawn striking limb: point-to-tip-path distance at least head 0.12 + 0.10 + 0.10 = 0.32 m, torso 0.15 + 0.10 + 0.10 = 0.35 m (head sphere, chest depth, fist or foot radius 0.10, gap 0.10); for a low strike the feet too (0.10 + 0.10 + 0.10 = 0.30 m). The foe stands where the unswayed torso is on the furthest plane the tip reaches (the strike lands on the chest), the strike goes active on the first and on the last i-frame tick, the sway leans back, left and right, for the longest strike of each height (High, Mid, Low) of all 16 styles (288 trials). Another self-test checks the drawn lean covers the window (at least 85 % of the peak on every i-frame tick, at most 15 % three ticks after) for every style and lean, for KAI's body and for the slowest legal Creator body (speed 2; with the old speed-scaled blend that body reached only 73 % on the first tick and the test fails). A third checks the swayed strike: no damage, no flash, only the allowed floor ring.
  - Result, over every strike of every style (651 moves, 3 leans, 2 timings = 1,302 trials): worst head 0.77 m, worst torso 0.44 m, worst foot (low strikes) 0.36 m, against 0.32 / 0.35 / 0.30 m needed; with the old pose the worst torso clearance was 0.10 m and the three tests fail (checked). Block / Sway balance is unchanged because only the pose and the effects changed: see "Balance check (P3-09 / P3-10 / P3-11)" in the P3-10 section.
  - Known limit (open): the drawn fist reaches about 0.9-1.1 m from the striker's root while the sim reach is 1.2-1.65 m plus the 0.34 m body radius, so a strike can register from further away than it is drawn (it passes by even without a sway). P5 / P3-10 follow-up (hit boxes match the poses).
  - Check in Training (the captures of P3-11's "Done when"): Play, Training, any fighter, then a Sway fighter as the sparring partner (arena any). Starters with Sway from the start: YUKI (Boxing, hand), MARA (Capoeira) and SORA / AMARA (kicking), ELISE (Judo, throws); the others (Kickboxing FEMKE for clinch, Hapkido VIKRAM and BJJ REID for locks, Kali NIA for weapon, MMA TESSA and Brawler ROXY for hybrid) are unlock or rival presets, or a Creator fighter with the style and Defense: Sway. In the fight press Esc, click the Dummy row once ("Sway at each strike": the dummy sways once per strike, the strike going active 3 ticks into its dodge; click again for "Sway at each strike (low too)"), Resume. Key 2 loads the close scenario (1.1 m apart, the hardest case), key 1 the neutral one. Strikes (default keys): High = J (Jab) or K K (Roundhouse), Mid = K (Front Kick) or hold C and press J (Body Jab), Low = hold C and press K (Low Kick). The frame data panel then reads "Result: swayed" and the dummy shows the "SWAY" text with no ring or flash. Take the capture within about 0.3 s of the press (the sway lasts 27 ticks, 12 of them out of the line); there is no console call for it (`BREAKPOINT` has no Training entry), the keys are the way. Seen once on screen with KAI against MARA: the dummy leans back out of the jab, the fist ends short of the chest, no effect on the body.
- P3-04 submissions: only on a downed opponent. Grapple next to a knocked-down opponent starts a hold (styles: Brazilian Jiu-Jitsu, Hapkido, Judo, Wrestling, MMA; Sambo added in P5-01 for its leg-lock finish per P1-04). Escape contest: the victim taps Defend, the attacker taps Grapple; stamina tips the contest; damage builds while the hold lasts, at most 4 s. Inputs: keyboard Grapple / Defend keys, gamepad R2 / R1, touch GRAB / DEFEND taps. Multi-opponent: any hit on the attacker breaks the hold; no third fighter can join a hold.
- P3-06 heavy tackle: included. Only when the running fighter is at least 2 weight classes heavier, triggered by running (analog or run) into the lighter one, no button; the lighter one is knocked back. Counter: a Block stops it (blocker pushed back, no damage), a Sway or sidestep makes the tackler run past.
- Implemented values (P3-05 / P3-06, 2026-10-28):
  - Submissions: styles that could submit at P3-05 were Wrestling and Judo; since P5-01 also Sambo, BJJ, Hapkido and MMA (see "Style data model (P5-01, P5-03)"). A hold needs the holder within 1.3 m and is allowed once per knockdown. It deals about 22 damage over the full 4 s. Escape taps and hold taps are scaled by stamina, and the holder's lead is capped, so mashing never makes escape impossible. A hold that ends without an escape leaves the victim down 20 more ticks and locks the holder 12 ticks.
  - Weight classes (P6-03: the creator's fitness picker now sets the build; the classes still come from the body): 0-4 from body scale x build, bounds 0.92 / 1.04 / 1.2 / 1.36. Today Yuki and Mara are class 0, Kai 1, Zero 2, Dmitri 3 and Brutus 4.
  - Tackle: 12 damage plus a heavy stagger. A blocked tackle locks the tackler's run for 24 ticks. The first contact of a run decides the outcome.
- Momentum boost (P3-09, 2026-10-28):
  - Gauge: 0-100. Damage dealt adds 1.6 per point and damage taken adds half that. A perfect block or perfect sway adds 20. Submission holds add nothing.
  - Boost: a full gauge starts a 5 s boost with x1.15 damage, on strikes, ground hits, clinch strikes, throws and the tackle.
  - Refill and reset: the gauge stays empty during the boost. Both reset at every round start.
  - Display: shoulders up and faster breathing, plus a thin bar under the stamina bar that turns amber during the boost.
  - Balance check (2026-10-30): values unchanged (gauge 1.6 per damage dealt, 0.8 taken, 20 for a perfect block or sway; 5 s; x1.15). Measured with the style-pair runs and the Block vs Sway runs, boost on against a build where the gauge never fills: see "Balance check (P3-09 / P3-10 / P3-11)" in the P3-10 section for the tables. The boost starts 1.02-1.14 times per fighter per round (Easy 1.14, Normal 1.03, Hard 1.06, Expert 1.02; band 0.5-2).
- Clinch strikes (P3-03): elbow and knee poses per style family:
  - Thai plum for Kickboxing;
  - uppercut elbow and low knee for Boxing;
  - collar tie for Wrestling and Judo;
  - wild knee and headbutt lunge for the Brawler;
  - the default pair for the rest.
- USE: no hold. Tap Use = throw the held item at the target; Crouch + Use = drop it; Use near an item while empty-handed = pick up.
- P3-10: the 35% limit stays.
- P4-07 co-op (owner, 2026-10-28): friendly fire is a co-op setting, off by default. A knocked-out player sits out until the next stage, and the level is lost only when every player is out.
- N fighters (P4-01): `MatchSim.fighters` holds any number of fighters (a brawl: the player and 1 to 6 enemies, `BRAWL_MAX_ENEMIES`); a 1v1 mode is two teams of one and runs the same code, so seeded 1v1 results, event logs and the Block / Sway balance are unchanged (guarded by three recorded fingerprints in the self-test).
  - Teams: `Fighter.team` 0 = players (`fighters[0]` is the human player), 1 = enemies. Damage, grabs and tackles go only to another team (`MatchSim.canHurt`); the `friendlyFire` match flag (default false, set by `cfg.friendlyFire`) is the P4-07 setting and lets only the players' team (team 0) hurt each other; CPU enemies never hurt each other, flag or not (coordinator decision, 2026-10-28; the owner can change it). Bodies push apart for every pair, teammates included; a clinched pair is carried by its grab and never pushed, and in a brawl the knocked-out do not block.
  - Target (`MatchSim.targetFor`, assigned once per tick before the AI and `Fighter.update` run; the one function P4-03 / P4-04 replace): the clinch or hold partner while locked in one; otherwise the nearest living hostile that is not KO / victory / defeat, ties to the lower index; otherwise the nearest hostile of any kind (a finished 1v1 round still faces the knocked-out opponent). Every enemy uses the existing `AIController` against its target; group tactics (tokens, flanking) are P4-02.
  - Combat pairs: each attacker meets every hostile in reach in index order; the first attacker rotates with the tick (2 fighters: the old odd / even rule). A strike can hit several fighters; a grab takes only the nearest one. Nobody can grab a fighter that is in a clinch, grapple or hold (P3-05 rule) and a held (pinned) fighter cannot be struck by anyone but its holder, so a third fighter can neither join a clinch or a hold nor stomp the victim; two grabs on one defender in the same tick make one clinch.
  - Brawl (`mode: 'brawl'`, `cfg.enemies` = a count or a list of roster ids, no rounds): the players win when no enemy is alive, lose when no player is alive; both out on the same tick, or the optional clock (`cfg.timer`, default none) running out, counts as a loss. Result: `winner` 0 = players, 1 = enemies; `enemies` and `enemiesDown` in the results. Debug entries: URL flag `?brawl=N`, `BREAKPOINT.brawl(N, { arena, difficulty })` from the main menu, `BREAKPOINT.simulate({ enemies: N, ... })` (AI player, headless) and `BREAKPOINT.benchmark(seconds, { enemies: 6 })` (the P0-04 scene with 1 player + 6 enemies, health refilled each frame so the whole crowd fights for the run).
  - Camera (brawl): frames the player and every living enemy within 6.5 m (the nearest one if none is that close); P4-06 refined it (next bullets). HUD: the player's bars as before, the right bar is all enemies together ("n / N UP"), each enemy has a name tag with a small health bar.
- Group AI (P4-02): whenever two or more AI fighters share one target (a brawl with at least two enemies up), `CrowdDirector` (one per match, updated once a tick before the AIs think) hands out attack tokens and ring spots; a 1v1, a lone enemy and the last enemy standing never use any of it (no random number is drawn, so the three 1v1 fingerprints hold). **Tokens** (per target, `BRAWL_ATTACK_TOKENS`: easy 1, normal 2, hard 2, expert 3): only a holder starts a strike, grab, jump kick, hold or charging run on the shared target; the oldest waiter gets the next free token (ties to the lower index), not sooner than `TOKEN_GRANT_GAP_TICKS` after the last grant and not while resting (`TOKEN_REST_TICKS`, both by difficulty). A holder gives it back when its attack is over (no ATTACK / GRAPPLE / SUBMIT state and no pressed attack in the input buffer), when it is hit, or after `TOKEN_PATIENCE_TICKS` (90) if it never started; it chains at most `TOKEN_CHAIN_LIMIT` steps (easy / normal / hard 0, expert 1). **Ring**: the others stand on a circle `RING_MARGIN` (0.6 m) outside the target's longest reach, evenly spread with the empty gap in front (its sides and back), re-dealt every 45 ticks or when the group changes; they shuffle, feint a step in, or guard, keep 1.1 m from each other, and stand their ground (never back off) while the target chases or attacks them. **Retreat**: a waiting fighter under 30% health or low on stamina takes its spot 1.5 m farther out for 120 to 300 ticks and gets no token meanwhile. `AIController.considerPickup` and `considerHazard` are the P7 hooks (they return null now). **Combos are per attacker**: the defender keeps `gotHits`, `gotDamage` and `comboFoe`; a hit by another attacker ends the open combo (`comboEnd` for its owner, with the defender's own counts) and starts a new one, so counters and damage scaling restart; `Fighter.comboHits` / `comboDamage` stay the attacker's display counters. The pace constants were tuned with `BREAKPOINT.simulate({ enemies: N, difficulty })` (the player is an AI of the same difficulty that reads only its nearest foe, so it cannot guard against the second attacker): three equal Normal enemies are beaten in about a third of 20 seeded fights, six are not; Hard is much harder. Tests: "Group AI: ..." in the self-test.
- Lock-on and soft facing (P4-03..P4-05): one function decides a human fighter's target, `MatchSim.targetFor`, with the priority clinch / hold partner, then the lock, then the enemy a running attack was aimed at, then the nearest living hostile as before (P4-01). Only controllers marked `human` (P1, and P2 in Versus) use any of it; AI, dummy and training fighters are untouched. **Valid enemy** (`lockValid`): another team (an ally is never picked, friendly fire or not), alive, not KO / victory / defeat, not lying down (`S.DOWN`), within `LOCK_RANGE` (8 m), and in line of sight. **Line of sight** (`Arena.sightBlocked`): the straight line between the two bodies is cut by an active obstacle whose top is above `LOCK_SIGHT_HEIGHT` (1.2 m) over the higher fighter's feet, glass excepted; so columns, posts and paper screens hide an enemy, crates, benches, barriers, rails and glass do not, and a fighter standing on a high ledge is not hidden by the ledge itself. **Choice** (`pickTarget`): with the stick pushed (length at least `LOCK_STICK_MIN` 0.5) the valid enemy with the lowest score = distance + (1 - cos of the angle off the stick) x `LOCK_ANGLE_WEIGHT` (6 m), among those within 60 degrees (`LOCK_STICK_COS`) of the stick direction, wherever they stand (the stick overrides the view); with no stick, or nobody that way, the nearest valid enemy in the view, 100 degrees to each side of where the fighter faces (`LOCK_VIEW_COS`); nobody valid means no pick. Ties go to the lower index. The stick is the intent's forward / side turned into a world direction, so it works the same for the relative and the screen movement modes and for keys, pad and touch. **Lock** (`updateLock`, once a tick after the intent is read): a Lock press with no lock picks as above; a press with a lock moves it to the best enemy in the stick direction if that one lies closer to the stick than the locked one (the action table's "tap toward another enemy switches"), otherwise lets go. The switch takes the best-scoring enemy among those closer to the stick direction than the locked one. A flick does the same without the button, but only from an analog stick (gamepad stick or touch stick; the intent carries `stickAnalog`, false for keys and the d-pad): out past `LOCK_FLICK_MAG` 0.75 and back under `LOCK_FLICK_REST` 0.35 within `LOCK_FLICK_TICKS` (8), switching on the return along the direction it went, at most once per `LOCK_SWITCH_COOLDOWN` (12 ticks). Plain movement never changes the lock: keys, a held stick, circling or backing off do nothing. **Hold and release** (`lockHolds`): a locked enemy stays locked while it is hostile, alive and not finished, and within `LOCK_RELEASE_RANGE` (9 m, the extra metre stops flicker at the edge); it stays locked when it goes down (the "unless chosen" case) or behind scenery; the lock is checked every tick, also during a clinch or hold, and ends when the enemy is knocked out, leaves the range, or its team changes, when the player is knocked out, when the fight ends, and at a round start. **Soft facing** (`softFace`): when a human fighter's attack begins (a first press, each string step, a grab) in a scene where the fighter has two or more hostiles (`hostileCount`), it is turned at once to the locked enemy, or else to the `pickTarget` result with the stick of that tick, and keeps that target (`Fighter.aim`) until the attack ends; a later step of the same string keeps the aim while it is still a valid pick, so a combo does not swing round, and picks again when it is not; with nobody valid it keeps the usual target. A 1v1 and a brawl with one enemy play exactly as before (soft facing is skipped; the three 1v1 fingerprints hold). **Marker**: the locked enemy's name tag gets a gold border and a chevron under it; no other element, HUD only, only while the lock holds and the locker has two or more hostiles (so a 1v1 and Versus show none). Touch: the context LOCK button (shown while at least two other fighters are up) presses `lock`; gamepad L1, keyboard Q / Numpad2. Tests: "Lock-on: ..." and "Soft facing: ..." in the self-test.
- Brawl camera (P4-06): `Camera.followGroup` (brawl only; 1v1, Versus and Training keep `Camera.follow`, and the shared `frame` gives the same numbers without its new `group` argument; a test pins that against the old output). Everything is outside the simulation and allocation-free. **Frame** (`frameFighters`): every living fighter of the lead's team (up to `CAMERA_MAX_PLAYERS` 4, the lead even when out; co-op in P4-07 only has to add players), every living enemy within `CAMERA_THREAT_RANGE` 6.5 m of any of them (once framed it stays until `CAMERA_THREAT_LEAVE` 7.5 m, so an enemy on the edge does not flicker in and out; the existing smoothing does the rest), the enemy each player has locked at any distance (the lock lets go at 9 m anyway), or the nearest enemy when none is close. The camera aims between the lowest feet and the highest head (`CAMERA_FIGHTER_HEIGHT` 2 m), looks across the line from the players to the average threat (azimuth within `CAMERA_AZ_LIMIT` 0.55 rad of straight on plus `CAMERA_AZ_BIAS` 0.18), and backs off to fit the spread plus any height difference beyond `CAMERA_VERT_SLACK` 1 m, inside the arena's minDist / maxDist as before. **Safe zone** (`keepInFrame`, after the smoothing, 4 passes): the feet and head of every player and every locked enemy stay inside `CAMERA_SAFE_X` 0.8 / `CAMERA_SAFE_Y` 0.72 of the screen half-size; if they do not fit, the camera first pulls back (up to maxDist), then moves along its own right and up axes; if they still cannot all fit, the lead player stays in and the others give way. Normally idle: the smoothed framing already keeps everyone in. **Hidden player** (`updateOcclusion`): the line from the eye as drawn (clamps included) to each player's chest (`CAMERA_CHEST` 1.3 m) is tested against the active colliders in 3D (`Arena.rayBlocked`: the line crosses a prop's footprint lower than its top; glass never blocks; a prop lower than the line, like a crate, never does). Hidden for `CAMERA_OCCLUSION_GRACE` 0.3 s: the camera tries, in the order of `CAMERA_OCCLUSION_TRIES`, azimuth +-0.25 and +-0.5 (inside the azimuth limits), a steeper pitch (+0.3, +0.7, up to `CAMERA_ELEV_MAX` 1.15 rad, 66 degrees), and then the same aimed straight at the players, and takes the first pose from which the chest is seen along three lines (the centre and the eye moved `CAMERA_EYE_SPREAD` 0.3 m to each side, so a view that only just clears an edge does not count); it keeps its current swing while that still works. A swing follows faster than a drift (pitch 8, aim 10, azimuth 5.5 per second) and is undone once the normal view has been clear for `CAMERA_OCCLUSION_RELEASE` 0.6 s, which also stops it flipping back and forth beside a prop. Cost: one line per player per frame, and at most 16 poses x 3 lines per player while a player is hidden (measured headless with six enemies: 2 us per frame, 5 us with nothing clear). Measured with the player standing as close behind each tall prop as a body (radius 0.34) can: longest hidden stretch 38 ticks (0.63 s) in the Dojo (screens, posts), 20 in the Warehouse and 23 in the Pit (pillars); the test limit is 0.9 s. **Off-screen attackers** (`MatchSim.isAttacker`, `Camera.offscreenMark`, `UI.edgeMarks`): an enemy that holds an attack token against the player team, or is in an ATTACK or GRAPPLE state on it, while it is outside the screen or behind the camera, gets a red arrow (`.edge`, one pooled element per enemy slot inside `#tags`, no panel) `CAMERA_EDGE_PAD` 30 px inside the screen edge, turned the way the enemy lies; it is hidden when the enemy is on screen, idle, out, or the match is not a brawl. Tests: "Brawl camera: ..." in the self-test.
- Local co-op (P4-07; owner decisions above): up to 4 local players in a Co-op Brawl, which is the brawl of P4-01 with a party (there are no brawler levels or stages yet).
  - Menu: Play > Co-op Brawl (last in the mode list) > join screen > arena > brawl. The join screen has a card per seat (P1 to P4) coloured by seat: cyan, green, orange, violet (pink stays the enemies' colour). A device joins the first open seat with Punch (a keyboard layout: the P1 layout or the P2 layout of Controls) or A / Start (a gamepad); Defend or B leaves; left / right (keys, D-pad or stick) cycle the seat's fighter over the unlocked roster plus custom fighters; clicking a card also cycles. Enter (the Choose arena button) or Start on a joined gamepad moves on; it needs at least one player. B on a gamepad without a seat, Esc and Backspace go back. Opening the join screen forgets what the pads held before, so a button still held from the screen after it (B to go back) is no press there and keeps the seat; the menu memory of all pads, seated or not, is kept when leaving it. A Difficulty button (keyboard / mouse) uses the Free Fight difficulty setting.
  - Devices: a keyboard layout only takes seat 1 or 2, so seats 3 and 4 are gamepad-only; a gamepad takes any seat and belongs to that seat alone (it keeps it while unplugged and takes it again when it returns, also in another browser slot: it is found by its id, unless another seat holds a pad with the same id; in the join screen an unplugged pad frees its seat). A gamepad seat plays no keyboard keys. With P2's layout seated, the spare arrow keys of P1's layout belong to P2 (as in Versus). Touch is not used (the on-screen buttons stay hidden, the Pause button shows). Esc pauses from the keyboard even with a gamepad-only party; any seated player can pause or skip. State: `Inputs.coop / seats / party`, set up by `Game.syncVersusInput` (on from the join screen until the main menu, cleared there); `Input3` / `Input4` are seats 3 and 4; `HUMAN_CONTROLLERS` gives fighter k the controller of its seat; lock-on, soft facing and rumble work per seat.
  - Match: `cfg.coop` = [{ slot, id }] in seat order makes party member k fighter k (team 0); enemies are fighters `partySize` and up. Enemies = `COOP_ENEMIES_BASE` (2) + players, at most 6 (1 player 3, 2 players 4, 3 players 5, 4 players 6), chosen from the roster without the players' fighters; the party stands in a line (0.8 m apart) on the player side. A second pick of the same fighter wears the alternate colours. A party of one starts exactly like the plain brawl (a test compares them).
  - Friendly fire: Settings > "Friendly fire (co-op)", off by default, saved with the other settings (an old save without it reads as off). It is read at every co-op start (a rematch follows the toggle); on, the players' strikes, grabs and tackles can hurt each other. CPU enemies never hurt each other.
  - Sit-out: a knocked-out player stays out for the rest of the brawl: no input, enemies skip it as a target, the camera leaves it out of the frame (only when every player is out does the first player stay in view), its tag says K.O. and its HUD cell is greyed with OUT. The brawl goes on while any player stands; it is lost when every player is out, won when every enemy is out (as P4-01). `MatchSim.reviveTeam(hpFraction = COOP_REVIVE_HP)` is the hook for a stage system: it stands every knocked-out player up where it fell (on a crate it stays on the crate) with 50 percent health, drops the Punch and Kick presses buffered while it was out, and returns how many came back (0 for a non-brawl or a finished brawl). Nothing calls it in play today; a test covers it.
  - HUD: the left bar is the party together ("n / N UP"); under the top bar a compact cell per player (name in seat colour, health bar, thin stamina bar, OUT when knocked out) in a row that shares the width, so it fits a narrow phone and a wide screen alike; the mode line (below the cells) and the P1 combo counter move down in a co-op. With more than one player the single-player combo counter, low-stamina warning and clinch hints are off (the cells show health and stamina); announcements say "P3: ..." and a player going down gets an "OUT" pop and an announcement. Name tags use the seat colour and label (1P to 4P). Results: "Co-op brawl" with a column per player (status, damage dealt and taken, hits, best combo, knock-outs, throws, objects).
  - Open: the screens have been checked only through the self-tests and CSS reading; nobody has used real gamepads or looked at 360 x 640 and 1280 x 720 yet.
- Match setup (P4-08; decided 2026-10-31 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row).
  - Entry and slots: Free Fight and Versus setup screens have a "Players and teams" button; Brawl is a new mode (after Versus, before Co-op Brawl: pick your fighter, then the same screen). A lineup is 2 to 8 fighters (`LINEUP_MAX`: P1-05's 8 in the scene), slot 1 always a player, at most 4 players (one per input seat), every other slot a player or the CPU, a fighter from the unlocked roster plus custom fighters, and a team: Solo (alone on a team of its own) or Team A to D. The rows are `.opt` cells (arrows, Enter, a tap or click cycles), so keyboard, pad and touch all work. Quick team layouts on the Teams row: free-for-all, players vs CPU, 2, 3 or 4 teams dealt in turn. Online slots join the same row after Phase 12 (a hint line says so).
  - Which path plays: the plain 1v1 of a mode (Free Fight: a player against the CPU; Versus: two players; different teams) plays the old way, with rounds, the round timer and the Versus score, byte for byte (the 1v1 fingerprints are unchanged). Every other lineup is one fight without rounds, the engine of the brawl with teams of its own (`cfg.slots`, `MatchSim.setup`): the last team standing wins, every team falling is a draw (also when the last team falls during the knock-out delay), and the optional clock (Off, 60, 120 or 180 s, set on the screen) goes to the team with the most health left as a share of its own total; a tie with the best share is a draw. No unlocks or records are credited for a lineup (owner rule: tournaments with several humans unlock nothing; everything is free anyway). Friendly fire stays the co-op setting; teammates in a lineup never hurt each other. Nobody is knocked out at a drop (a CPU enemy of a plain brawl is). No waves.
  - Starts: two teams stand in two loose lines facing each other (the lead's team on the left); three or more teams stand on a ring round the arena centre facing it, each team side by side (radius at least the level's spawn distance, 0.5 m per fighter). The lead's team stands first, people before CPU inside a team.
  - Input: one person plays on everything (keyboard 1, a gamepad, touch); two people split the keyboard and pads as Versus; three or four people take seats without a join screen: keyboard 1, then the connected gamepads in order, keyboard 2 only when there are too few pads (3 people need 2 pads, 4 need 3 pads or 2 pads and the second keyboard); touch is for one person. The screen shows the devices and refuses to start without enough gamepads. The camera keeps every person in view, a person on another team included. HUD: the left bar is the lead's team, the right bar every other team together, a cell per fighter in its team colour (Team A to D keep cyan, pink, green, orange; solo fighters take violet, yellow, white, red), name tags and the floor disc in the same colour, a mark where a fighter falls while the fight goes on, banners and a results table per fighter.
  - Group AI: the crowd director works per target and per attacking team, so rivals of different teams never queue behind each other (in a free-for-all of 4 they did on 1,070 of 2,386 ticks; now 0); a team of two or more still shares tokens and the ring as in a brawl. The old modes have one team per target and play as before.
  - DECIDED, uneven teams stay fair: "Even teams" (on by default, a switch on the screen). A fighter of a team smaller than the biggest team gets a factor on its health and on its damage that depends on the CPU level and on ratio = biggest team / own team (`LINEUP_HANDICAP`: rows [ratio, factor] for 1.5, 2, 3 and 4, straight lines between them and from 1 at ratio 1; above ratio 4 the factor of ratio 4, never more than the level's biggest; a free-for-all and equal teams get nothing). No cap on team sizes; 1 v 5 to 1 v 7 and the like use the factor of ratio 4 and are not measured. **A person is never weakened**: a factor under 1 is used only between CPU-only teams; a smaller team with a player, or any team smaller than a biggest team with a player, gets at least 1; with no CPU in the lineup the Hard column is used. The screen says so in plain words (no negative percentage is shown). Why a table by ratio and not one power per level: one power did not fit every shape (1 v 2 on Normal wanted a factor under 1, 1 v 4 one of 1.2 and more), and on Easy and Normal a CPU pair gets in its own way (Easy has one attack token), so without any handicap a lone CPU wins about 70% of 1 v 2 there, against about 20% on Hard and 25% on Expert. Why not a team-size cap: it would forbid the lineups the owner asked for.
  - Measured (the P0-06 runner, `BREAKPOINT.simulate({ lineup: { slots }, difficulty, seed, timer: 180 })` with all slots CPU, all fighters KAI so that only the team size differs, seeds 1 to 300, the slot order reversed on even seeds; the percentage is the smaller team winning, draws are 0 to 2 of 300 and count for nobody; band: the project's own style-pair band of the P14-01 table, 40-60% at Hard and Expert and 35-65% at Easy and Normal). The factors were fitted per level and ratio in scans of n 100 and checked at n 300:

    | Level: factors at ratio 1.5 / 2 / 3 / 4 | 1 v 2 (ratio 2) | 1 v 3 (3) | 2 v 3 (1.5) | 1 v 4 (4) | 2 v 4 (2) |
    |---|---|---|---|---|---|
    | Easy: 0.95 / 0.89 / 0.90 / 0.99 | 62.0% | 45.0% | 50.0% | 41.7% | 47.0% |
    | Normal: 0.98 / 0.96 / 1.00 / 1.22 | 60.3% | 36.7% | 49.0% | 50.0% | 38.7% |
    | Hard: 1.107 / 1.19 / 1.32 / 1.35 | 49.7% | 50.0% | 57.0% | 44.3% | 55.0% |
    | Expert: 1.22 / 1.45 / 1.72 / 1.90 | 52.7% | 55.7% | 49.3% | 54.0% | 48.0% |

    All 20 are inside their band (Hard 44.3-57.0%, Expert 48.0-55.7%, Easy 41.7-62.0%, Normal 36.7-60.3%; the 95% interval at n 300 is about +-5.6 points). Expert at ratio 3 was refitted from 1.84 (61.0%, over the band) to 1.72. Ratio 2 serves both 1 v 2 and 2 v 4, so on Easy and Normal its factor is a compromise (1 v 2 wants less, 2 v 4 more). A Hard run with fighters from the roster in turn (n 150, power-law version of the table) gave 42.0% (1 v 2) and 44.7% (2 v 3). Without the handicap: Easy 1 v 2 71%, Normal 1 v 2 73% (n 100), Hard 1 v 2 about 20% (n 20), Expert 1 v 2 about 25%. Open: lineups that have a player are measured only through the CPU-only rows, and on Easy and Normal a player on the smaller team gets no help (the CPU pair there is weak by design), so a player against two or three CPU on Easy or Normal plays without a handicap; ratios above 4 and team shapes other than the five measured are not measured; a team of mixed fighters on Easy and Normal was not measured. The runs print "Illegal transition KO -> STUN" now and then on Easy 2 v 3 (a fighter hit in the same tick it falls): it is logged, never a crash, and is not specific to lineups.
  - Tests: self-tests "Lineup: ..." in `breakpoint-tests.js` cover the rules (fix, check, plain, deals, plan), win, draw, clock and ties with 3 teams, simultaneous KOs, a KO during the knock-out delay, team counting up to 8, start positions and start health, the handicap on uneven teams only, the crowd director per team, 8 fighters of AI, `simulate`, the screens, the HUD, banners, results, the camera and the flow with the input plans.
- Same-tick trades (P3-08): a strike that lands on the same tick as a grab wins (either player); two strikes both land; two grabs split by tick parity. After a get-up, strikes miss for 6 more ticks (wake-up grace, closes a knockdown loop); grabs and the tackle still connect.
- Falling (P3-07; teeter and ledge grab are not approved): a fighter with no footing falls under the normal gravity. A drop is the height lost since the fighter last stood on something. Past 0.4 m a fighter in a grounded-only state (idle, walking, running, blocking, crouching, sidestep, sway, a ground attack, get-up, clinch, grapple, hold) switches to the Falling state; shallower drops (crate rubble 0.22, pillar rubble settling from 0.55 to 0.2) keep the state and just land. Reactions, jumps, air attacks and throws keep their own state and land the same way. A clinch or hold ends when either fighter drops past 0.4 m. Landing: under 1.6 m a stagger of 14 ticks plus 10 per metre (at most 40); from 1.6 m a knockdown. Fall damage: 8 HP per metre beyond a free 0.5 m, at most 40, then the combo scaling and the fighter's taken and impact scaling; it uses the scenery-impact damage path (training floor HP and the KO event hold) and never fills the momentum gauge. Examples: a pillar rubble top (0.55 m) costs 0.4 HP, a crate top (0.95 m) 3.6 HP, a 3 m balcony 20 HP. The CPU never walks, runs, sidesteps or jumps off a surface that would drop it past 0.4 m (it looks 0.5 m ahead, 0.9 m when running, 1.2 m for a sidestep, 1.4 m for a jump); knockback and throws still carry it off. After 1.5 s held at an edge it climbs down on purpose where the drop costs at most 5 HP (crate and rubble tops), never off a higher drop. Values: the FALL_* and AI_EDGE_* constants in breakpoint.html.
- Style data model (P5-01, P5-03): one table, `MOVE_STYLE` (breakpoint.html, before `MOVE_STYLE_IDS`), one row per style. Everything that depends on the style reads its row: `defaultDefense`, `SUBMISSION_STYLES`, `stringsFor` and `clinchStrikePose` (the old `STYLE_DEFENSE` and `CLINCH_STRIKE_FAMILY` tables are gone).
  - Fields: `label` and `desc` (creator, Move list); `family` (key of `STYLE_FAMILY_LABEL`, the 7 P1-04 families); stance = the `guard*` fields (`STYLE_STANCE_KEYS`); footwork = `bounce / bounceHz / sway / swayHz / headBob / stride / armSwing / walkBounce` (`STYLE_FOOTWORK_KEYS`); the punch / kick shaping fields and `react` / `victory` as before; `moves` (key of `STYLE_STRINGS`, or null = the default string rows); `grab` (key of `CLINCH_STRIKE_POSES`); `throws` (the `THROW_SETS` grip the style favours; every style can use all three grips, and P5-02's `STYLE_THROWS` swaps single throws for a style's own); `signature` ([name, uses] pairs, uses = an `ATTACKS` id, `knee` / `elbow`, `throw:<grip>.<dir>` or `hold`; P5-02 gave the unique ones moves of their own); `submit` (hold names, [] = none); `defense` (default defense type).
  - Ids and order: the 7 old ids stay first and unchanged (boxer, kickboxer, karateka, wrestler, judoka, brawler, capoeira), then the 9 new ones: wingchun, muaythai, taekwondo, sambo, bjj, hapkido, kali, kravmaga, mma. Share codes store the index into `MOVE_STYLE_IDS`, so new rows are appended only and a row is never moved or deleted. Labels now use the P1-04 names (Boxing, Kickboxing, Karate, Wrestling, Judo, Street Brawler; Capoeira as before).
  - Old ids (P5-03): `styleFor(id)` returns the current style id for any id a save, share code or profile carries (`LEGACY_STYLE_MAP` is the identity for the 7 kept ids; a later rename or merge adds one row there), or null for an unknown id, which `validateCustom` still rejects ("Unknown movement style"). `moveStyleFor`, `defaultDefense` and `validateCustom` go through it. A share code or save without a style still gets the archetype's default style.
  - Random fighters: `randomCustom(seed)` draws its style from `CLASSIC_STYLE_IDS` (the 7 old ids), so every old seed gives the same fighter as before (a test pins seven fingerprints taken before P5-01). `randomCustom(seed, true)`, used only by the creator's Randomize button, draws from all 16 with the same rng draws, so nothing else in the fighter changes.
  - Defense defaults (P1-04): Sway = Boxing, Taekwondo, Capoeira, Judo, Brazilian Jiu-Jitsu, Hapkido, Kali (7); Block = the other 9.
  - Table per style (family; defense; strings table; clinch pose set; holds):
    - Boxing (hand; Sway; boxer rows; boxer; none). Wing Chun (hand; Block; boxer rows; boxer; none).
    - Kickboxing (clinch; Block; default rows; thai; none). Muay Thai (clinch; Block; default rows; thai; none).
    - Karate (kicking; Block; karateka rows; default; none). Taekwondo (kicking; Sway; karateka rows; default; none). Capoeira (kicking; Sway; capoeira rows; default; none).
    - Wrestling (throws; Block; wrestler rows; collar; Pin, Choke). Judo (throws; Sway; judoka rows; collar; Hold-Down, Arm Lock, Choke). Sambo (throws; Block; wrestler rows; collar; Leg Lock, Heel Hook).
    - Brazilian Jiu-Jitsu (locks; Sway; judoka rows; collar; Armbar, Choke, Leg Lock). Hapkido (locks; Sway; judoka rows; collar; Wrist Lock, Elbow Lock).
    - Kali / Eskrima (weapon; Sway; default rows; default; none; the stick set is P7, so it plays empty-handed). Krav Maga (hybrid; Block; default rows; thai; none). MMA (hybrid; Block; default rows; thai; Armbar, Choke). Street Brawler (hybrid; Block; default rows; brawler; none).
  - Holds: Grapple next to a downed foe works for every style with a `submit` list: Wrestling, Judo, Sambo, Brazilian Jiu-Jitsu, Hapkido and MMA (the P3-05 rules are unchanged; since P5-02 each hold style has its holder pose, the names are data). The strikers have none.
  - Stance and footwork: every new style has its own guard and footwork numbers. The closest pair in the existing signature test (`Motion: move styles give different stances, rhythm and strikes`, limit 0.15) is Kickboxing / Muay Thai at 0.735, so no family needed an explicit exception.
  - Creator and Move list: the Movement row cycles all 16 (default defense follows, as before) and its hint starts with the family; the Move list has a "Move styles" table (family, defense, signature moves, holds) and the string-table rows name every style that plays them. Randomize in the creator can now give any of the 16.
  - AI: no style-specific AI code; it reads `Fighter.strings` and `styleCanSubmit`, so the new styles work through their rows. A self-test plays every style against every style (and itself), 136 short deterministic matches, with no errors and hits from each style.
  - State at P5-01, replaced by "Style animations (P5-02)": the signature moves are existing attacks / throws / holds under new names; the new styles reuse the animations, frame data and clinch pose sets of their neighbours, and the string rows of one (Wing Chun: Boxing's, Taekwondo: Karate's, Sambo: Wrestling's, Brazilian Jiu-Jitsu and Hapkido: Judo's; Muay Thai, Kali, Krav Maga and MMA: the default rows, like Kickboxing); the Muay Thai teep and shin kick, Wing Chun trap and chain punch, the Taekwondo spinning and flying kicks, the Brazilian Jiu-Jitsu guard and sweeps, Hapkido wrist locks, Krav Maga defend-and-strike and the MMA takedown / sprawl have no animation of their own; victory poses are the 6 existing ones; Kali has no stick.
  - Open: Block / Sway balance is unchanged (47 / 54 at Hard over 300 seeds; the runner uses KAI clones, so the P5-04 presets do not move it); no per-style win-rate check for the 9 new styles exists yet (P14-01).
- Style animations (P5-02): a style is told apart by four things: the stance and footwork numbers of its `MOVE_STYLE` row (the idle pose), its signature attacks, its style throws (`STYLE_THROWS`, a style swaps single throws of a grip set for its own) and its hold pose (`HOLD_POSES`, row field `hold`; none = the original pin). Everything else is shared where the real arts share it (the P1-04 families), by using the same attack, set or rows.
  - Unique vs shared, per style (unique = played only by that style; shared = same move, set or rows as the named styles):

    | Style | Stance (idle) | Unique moves | Shared moves (with whom) |
    |---|---|---|---|
    | Boxing | hands high, chin tucked, bouncing | its own rows (power jab ends P K P, no heavy roundhouse); tight boxer clinch knee / elbow | jab, cross, hook, uppercut: every striker (default rows) |
    | Kickboxing | upright, long guard, lead-leg bounce | none beyond the Thai clinch set | default rows; Thai clinch set with Muay Thai, Krav Maga, MMA |
    | Karate | long low front stance, very still | rows without hook and heavy uppercut; full-chamber kicks | front kick, round kick; rows are the base of Taekwondo's |
    | Wrestling | low level, wide base, hands forward | short 2-step rows; Pin hold; low-grip throws favoured | collar clinch set with Judo, Sambo; low throws with BJJ, MMA, Capoeira; rows with Sambo |
    | Judo | upright, relaxed, hands at chest | short rows (hook and heavy roundhouse as second steps, power jab, sweep); Hold-Down; hip toss, side throw | collar set and rows with BJJ (base of Hapkido's); throws with Sambo, Hapkido |
    | Street Brawler | loose, square, heavy, rolling shoulders | looping clinch knee, head lunge | default rows |
    | Capoeira | ginga: rocking side to side, one arm guarding | kick rows (no hook, heavy uppercut, power jab); low spinning kick; ginga victory | sweep with Judo; kicks with Karate |
    | Wing Chun | narrow, high, elbows in, hands on the centre line | Chain Punch, Trap Strike; standing rows without hook and heavy uppercut (crouch rows are the default ones) | low kick, grab; Boxing's rows as the base; clinch set with Boxing |
    | Muay Thai | hands high at the temples, slow rocking, weight back | Teep (leads every kick row), Elbow (replaces the hook) | round kick, shin kick (the heavy roundhouse, third step of K K K); clinch knee / elbow with Kickboxing |
    | Taekwondo | side-on, hands low, light fast bounce | Spinning Back Kick, Jump Round Kick | front, round, push kick; Karate's rows as the base |
    | Sambo | upright jacket grip, hands up and forward, bladed | Sambo Hip Throw (hip toss dropping to a knee); Leg Lock hold pose | rear takedown, low kick, collar set, rows: Wrestling's |
    | Brazilian Jiu-Jitsu | wide, low, slow, hands low and forward | Guard Pull (sits and takes the foe down); Armbar hold pose | double-leg takedown with Wrestling, MMA; rows and collar set: Judo's |
    | Hapkido | side-on, circling, hands loose | Spinning Heel Kick (low); Wrist Lock hold pose | hip toss, collar set with Judo; Judo's rows as the base |
    | Kali / Eskrima | weaving, bladed, one live hand up, wide sway | Angle 1 (diagonal cut), Angle 2 (backhand cut) | jab, thrust (power jab), grab; default rows |
    | Krav Maga | square forward guard, leaning in | Parry Strike (one hand sweeps out wide while the other punches) | knee / elbow (Thai set), low kick, hook; default rows |
    | MMA | mixed, upright, crouching to close | Overhand | takedown with Wrestling, BJJ; Armbar hold pose with BJJ; cross, round kick: default |

  - New attacks, start / active / recovery, damage, advantage on hit / block (all tier 1 or 2, none strong, reach at most 1.6): Chain Punch 5 / 2 / 10, 5, +3 / -3 (reach 1.4). Trap Strike 6 / 3 / 12, 6, +3 / -4 (reach 1.5). Teep 9 / 3 / 15, 6, -2 / -8 (reach 1.6, push 0.6, block push 1.0) (the three were retuned by P14-01 on 2026-10-30: were Chain Punch 5 / 2 / 8, 4, reach 1.3; Trap Strike 7 / 3 / 12, +1 / -6, reach 1.3; Teep 8 / 3 / 14, -1 / -7, reach 1.6, push 1.0). Elbow 8 / 3 / 14, 7, 0 / -7 (reach 1.1). Spinning Back Kick 12 / 4 / 20, 10, -2 / -11. Jump Round Kick 13 / 4 / 19, 10, -1 / -11. Spinning Heel Kick 10 / 4 / 17, 8, -1 / -9 (Low). Angle 1 8 / 3 / 14, 7, 0 / -7. Angle 2 8 / 3 / 13, 7, +1 / -6. Parry Strike 6 / 3 / 12, 6, +1 / -6. Overhand 10 / 3 / 15, 8, 0 / -7. Each is inside the damage-per-frame and the hit / block advantage band of the existing non-strong punches or kicks (a test checks it), so no new move dominates; the 8 strong moves are still the default table's. Style throws: Sambo Hip Throw 13 damage, start 22, escape until 13, recovery 26; Guard Pull 10, 20, 11, 28 (inside the ranges of the 12 set throws; it carries and throws the foe like the Pull-Through Trip, so the foe ends behind and beside the holder, lands more than 0.4 m along the throw and is never closer than 0.5 m on the way).
  - Rows: Wing Chun (Boxing's base, chain / trap steps), Muay Thai (teep leads every K row, elbow ends P P P), Taekwondo (Karate's base; K K K ends on the back kick, P K = jab + jump round kick), Hapkido (Judo's base; Crouch K K = low kick + heel kick, which replaces the Judo sweep), Kali (P P = jab + Angle 1, P P P ends on Angle 2), Krav Maga (parry strike as step 2 of every P P row), MMA (P P P ends on the overhand). Sambo and Brazilian Jiu-Jitsu add throws and holds, not attacks, and keep Wrestling's and Judo's rows. Each row obeys the P3-10 prefix and owner rules; the Move list shows every new move with its style's name.
  - Poses: new `STRIKE_BUILDERS` (chain, trap, parry, elbowH, angle, angleBack, overhand, teep, spinBack, jumpRound, spinHeel) on the same `attackPose` as every strike; `STRIKE_SPIN` adds the turn of the body to the back kick and the heel kick. Each new strike's pose differs from the standard move it resembles by at least 0.3 rad in one joint (smallest: teep against front kick, 0.40); idle poses of the new styles differ from their neighbour's by 0.19 to 0.35 rad (limit 0.15; Krav Maga against Brawler is the closest). Muay Thai, Taekwondo, Sambo and Hapkido stance numbers were changed from P5-01 (they were 0.04 to 0.15 from their neighbour). The back kick and the heel kick finish the circle in the recovery (the body ends a full turn round and the pose angle is wrapped, `wrapAngle`, before it blends to the next state). A test keeps every foot of every new attack, and the new hold poses, within 0.03 m of the floor (the old low kick reaches 0.032); the new throws sink no deeper than the deepest old throw (0.09 m). Throws and strings read the style through `moveStyleFor(profile)`. Nothing of the 7 kept styles changed: attacks, strings, timing and stance are as before.
  - Check in Training: the panel under the frame data shows "STYLE" (the player's style and its signature moves) and "Dummy style". To look at any style: Creator, Movement row, then Fight preview (Training with that fighter against KAI); or pick a starter (ROSA Wing Chun, PRANEE Muay Thai, SORA Taekwondo, CRUZ MMA) or choose the others as the sparring partner (all 32 presets and the saved customs are listed). The Move list names the style on each new move and lists the style throws.
  - Open (later): no BJJ ground game (guard, mount, sweeps); the guard pull and the armbar pose are the entry and finish of the existing hold. No MMA sprawl. Kali has no stick (P7) and no triangle step, only the weaving stance. Krav Maga's Parry Strike is a fast string step with the parry in the pose; the real block-counter is still the shared Counter Strike after a perfect block. Wing Chun's trap does not pin an arm. Victory poses are the 6 existing ones. The new poses and the stances were not looked at on screen.
- Attack animation audit (P5-06) (decided by the coordinator; the owner can change any row): poses only. The move rows (ticks, damage, reach, width, hit effects) of all attacks are pinned by a fingerprint in the self-tests (see P5-07: every gameplay field, not only the ticks), so the P3-10 balance and the three 1v1 fingerprints stand. How it works: the strike builders (`STRIKE_BUILDERS`) still give the shared pose on the style's guard; `STYLE_TECH` (one row per style, breakpoint.html after `STRIKE_SPIN`) adds that style's technique on top: striking arm, guard hand, kicking-side arm swing, kicking leg, support leg, lean, turn, roll, chin, step forward, level (knee bend) and the size of the wind-up before the strike. A row has `punch` and `kick` parts for every hand / leg strike and may add a part under the name of one builder.
  - DECIDE rows: (1) What was wrong: the 16 styles shared one pose per move and differed only in hip turn, lean and chamber numbers, so a cross looked the same for a boxer, a wrestler and a karateka. Decided: give each style its own guard hand, level, lean and wind-up in every strike, and keep the builders shared where the real arts share a technique. (2) Footwork and the walk: left as they are (P5-02 stance and footwork numbers); only strikes were reworked. (3) Real technique as the reference: guard hand and support leg first (they read at any camera distance), then level, lean and wind-up. (4) No tick, reach or hit box changes, so no re-measure of the balance was needed.
  - Audit table (what the real art does, what the pose now does; unlisted joints are the shared pose):

    | Style | Real technique | Pose now |
    |---|---|---|
    | Boxing | rear hand glued to the cheek, chin behind the shoulder, dip for the uppercut | guard hand raised 0.3 rad, chin tucked, uppercut sinks the knees, hook turns more |
    | Kickboxing | long upright guard, rear arm swings back on a round kick | guard hand up, kicking-side arm swings down and back, steps into punches |
    | Karate | hikite: the other fist pulled to the ribs, hips drive the reverse punch, straight support leg on kicks | guard hand pulled back (1.15 rad), more turn, shorter wind-up, straight support knee |
    | Wrestling | level change, hands reaching, drive from the legs | knees sink 0.35, chest over the knees, lead hand reaches low, short wind-up |
    | Judo | upright, free hand reaches for the collar | guard hand forward and bent out (collar reach), both hands forward on kicks |
    | Street Brawler | big looping swing, guard dropped, chin up | guard hand drops, looped arm, chin up, wind-up 1.7 x |
    | Capoeira | torso low on kicks, hands toward the floor | lean +0.5 and knees +0.2 on kicks, arms low |
    | Wing Chun | square, centre line, the other hand forward on the elbow (wu sao) | guard hand forward, little turn, upright, almost no wind-up |
    | Muay Thai | tall, hands at the temples, lean back on the round kick, arm swings down | hands high, lean back 0.25, arm swing, straight support leg |
    | Taekwondo | arms out for balance, straight support leg, high chamber | both arms out wide on kicks, support leg straight, lean back |
    | Sambo | jacket grip: hand forward and bent, bladed | guard hand forward, knees +0.15 |
    | Brazilian Jiu-Jitsu | low base, hands forward low | knees +0.35, lean +0.25, hands low and forward |
    | Hapkido | circular arm, the other hand deflects wide | looped striking arm, guard hand out wide on punches and kicks |
    | Kali / Eskrima | live hand checks forward and high, rolling torso | live hand forward and up, roll, knees +0.1 |
    | Krav Maga | forward lean, hands up, no wind-up | lean +0.2, hands up, chin down, wind-up 0.5 x |
    | MMA | wide, lower level, hands slightly low | knees +0.2, hands slightly lower, kick arm swing |

  - Tests (breakpoint-tests.js, after the P5-02 styles): "Technique: every style throws ..." (each style's punches differ by 0.15 rad or more and its kicks by 0.25 from the same style without `STYLE_TECH`; table keys valid), "no two styles throw the cross or the round kick with the same body" (all 120 pairs differ by 0.12 rad in some joint), "the guard hand does what the art does" (key point heights against the chest point), "the legs do what the art does" (lean back, straight support knee, low body, wind-ups), "every move of every style is finite and no foot sinks" (also guards the rows through `MOVE_ROWS_BEFORE_P506`, see P5-07). The tests fail with `STYLE_TECH` switched off.
  - Training captures: Training and the creator preview play any style; the captures were made by posing two fighters (before / after) at the contact tick of the cross and the round kick: `%TEMP%\claude\bp5\p506-hands-boxing-wingchun-kravmaga-brawler.png`, `p506-kicks-kickboxing-muaythai-taekwondo-karate.png`, `p506-grapplers-wrestling-judo-sambo-bjj.png`, `p506-hybrids-capoeira-hapkido-kali-mma.png`.
  - Open: the walk and the guard of each style were not touched; hit reactions are the shared ones; the poses were judged on the side view and 3/4 view only.
- Weapon attack animations (P5-07) (decided by the coordinator; the owner can change any row): poses and drawing only; what a match decides is pinned by a fingerprint (below), so nothing changed there. What was wrong: every item step reused a bare-hand pose (hook, straight, overhand) built for a fist, so a bat in the hook pointed at the ceiling behind the fighter (far end 0.35 m behind the body at contact), two-handed items had one hand on them, a chain was a stiff rod, a crate sat beside the right hand, and a throw swung the arm after the item had already gone.
  - DECIDE rows: (1) Swing shapes per class (`weaponSwing`): stick = poke, forehand, chop, (Kali: backhand); chain = forehand whip, backhand whip, chop; bin lid = push, backhand slam, chop; bottle and brick = clubbed downward; heavy one-hand items (bat, pipe, hammer, wrench, extinguisher) = forehand sweep, then the strong chop; two-handed items (chair, skateboard) = two-handed sweep, then a two-handed chop; broom = two-handed poke, then the low sweep. (2) Each swing has three key poses (wind-up, contact, follow-through) blended in joint space (`WEAPON_SWINGS`; breakpoint.html before `makeWeaponMove`): base to wind-up over the first 60 % of the start-up, wind-up to contact over the rest, contact held for the first 40 % of the active ticks, follow-through, then back to the held pose over the recovery. (3) The numbers were solved on the skeleton so the fist is 0.5 to 0.8 m in front of the body and the item points the way it hits; the body steps in (0.2 to 0.45 m of root forward, more for the two-handed items) so the far end reaches the move's reach. (4) The hit box is not changed (owner rule); instead the drawn item is made to reach it: new key points 21-23 of a fighter hold the far end of the held item, and a test checks it at contact. (5) The bike chain is drawn 1.0 m long (it was 0.7, its reach is 1.0 beyond the fist) and bends: slack at rest (0.5 rad over its 6 links), coiled behind the hand (1.3), straight at contact, curling on (-0.6). (6) The left hand of a two-handed item follows the shaft; such an item is also held in two hands at rest (`TWO_HELD`). (7) A crate is carried in both hands, its centre on the body's centre line at chest height (`CARRY_HELD`), and let go with a two-handed push (`CARRY_PUSH`); every other item is let go from the right hand (`THROW_RELEASE`). (8) Throws: the hand is at the release point on the tick of the release (0.45 m ahead, 1.3 m up, 1.0 m for a crate, as `MatchSim.throwItem` places the item for a standard body), then eases back. Body size is cosmetic, so a tall fighter's hand is a little off that point. (9) Review fix, gameplay leak: `MatchSim.breakHeld` put the debris, and the glass hazard of a bottle (real damage the AI avoids), at the drawn right hand, so an animation moved it. It now breaks at `ITEM_BREAK_AHEAD` (0.3 m in front of the fighter's centre) and `ITEM_BREAK_HEIGHT` (1.2 m up), whatever the pose; no other simulation code reads `Fighter.pts`. This is the one gameplay change of P5-06 to P5-08: the bottle's glass patch lands 0.3 m in front of the fighter instead of at the drawn hand (about 0.2 to 0.7 m, by pose); the fingerprint does not see it because the point is not a row field, a test pins it instead. (10) Review fix, the fingerprint: it now hashes every field of the attack rows, the item move rows, the items (except the drawing: parts, hex, hold, tilt, len), `STRINGS`, `STYLE_STRINGS`, `THROW_SETS`, `STYLE_THROWS`, the gameplay fields of the style rows (moves, throws, defense, submit) and the 18 `SUBMIT_*` constants, except the visual fields name, anim and swing. The expected values were taken from the code of commit 3b006f3 with `git show` (before P5-06) and are the same for the current code.
  - Measured, shortfall of the far end of the item at contact against the move's reach (standard body, metres; negative = past it): stick 0.00, 0.04, 0.00, 0.01; bat 0.05, 0.00; pipe 0.04, 0.00; hammer 0.03, -0.04; wrench 0.04, -0.03; chain 0.05, 0.02, 0.00; chair 0.04, -0.08; skateboard 0.03, -0.10; broom 0.09 and the sweep 0.10 (0.48 m up); extinguisher 0.03, -0.04. The test's limit is 0.15 short and 0.12 past. Hands of two-handed items 0.09 to 0.29 m apart on the key poses (limit 0.05 to 0.4). Throw releases: right hand 0.14 m from the spawn point, both hands of a crate 0.07 m.
  - Side effects: chain `len` 0.7 to 1.0 (its loose model is longer too, and the size of its debris is slightly larger), key points 21-23 of `Fighter.pts` (it is 36 long since P5-06: 24-35 hold knees and elbows), `Fighter.throwCls`, `Fighter.chainBend`, `POSE_SCRATCH` (a pose reused by the throw every tick, no allocation per tick).
  - Tests ("Weapons: ..."; 7): every item step has a swing of its own shape and wind-up (all 8 shapes used, none looks like a punch); far end within 0.15 m short of the reach, at hit height, inside the width; two-handed items keep both hands 0.05 to 0.4 m apart on the key poses, chops start above the head, the sweep ends low; the chain bends as specified; a throw leaves from the hand (within 0.3 m of the spawn point), a held item is held differently from an empty hand and the arm eases back from the release by real distances, a crate is carried in front of the chest, the scratch pose and the cached pivot exist; feet on the floor, finite poses and the fingerprint unchanged; a worn-out bottle breaks at the fixed point in three different poses. Each new check fails on the code without its fix (checked with mutants: the drawn hand, the old hash, no keep-down).
  - Training captures: `%TEMP%\claude\bp5\p507-swings-stick-bat.png`, `p507-swings-bat-chain-hammer.png`, `p507-swings-two-handed.png`, `p507-swings-skateboard-lid-bottle-extinguisher.png` (wind-up, contact, follow-through, recovery) and `p507-carry-and-throw.png` (held, release with the spawn point marked, follow-through).
  - Open: the blend between two key poses can pull the left hand off the shaft for a tick or two (the test checks the key poses); the bin lid is drawn as a disc in the fist with no far end to check; a rolling skateboard throw has the same release as the others.
- Submissions made clear (P5-08) (decided by the coordinator; the owner can change any row): the rules of P3-05 are unchanged (range 1.3 m, once per knockdown, 240 ticks, the taps; all `SUBMIT_*` constants are in the fingerprint), so no balance run was needed; the work is what the player sees. Every hold plays the same way; a style's hold names are data and its hold pose is the `hold` field of its row.
  - DECIDE rows: (1) Do styles without submissions get a basic hold? No. Boxing, Kickboxing, Karate, Muay Thai, Taekwondo, Capoeira, Wing Chun, Kali, Krav Maga and Street Brawler keep striking; a hold would add about 22 hp per knockdown to ten styles whose P3-10 balance was measured without it, and the P1-04 families give holds to the throwing and locking styles. They still get a line in the Move list and Help ("No hold. Let the foe stand up, or land one low move on the floor") and Training says so. (2) The prompt: for each of the first two human fighters (any team: Versus P2 too) whose style can hold, over the foe the Grapple press acts on, that is the fighter's own target (`UI.holdTarget`; the old nearest-foe search could name another foe), when it lies knocked down within 2.7 m and can still be held. It shows only while the fighter is free (a free state, no lock, not in the air; not in a hit reaction, an attack or a throw): "[button] HOLD · [hold name]" in the warning colour when a Grapple press would start it, "FOE ON ANOTHER LEVEL" when it is within reach but 0.6 m or more higher or lower (the rule of `Combat.canSubmit`, `SUBMIT_LEVEL_GAP`), "TOO TIRED TO HOLD" under 4 stamina, otherwise "STEP CLOSER TO HOLD" in grey. With two human fighters each prompt is labelled 1P / 2P and the second sits 34 px lower (`HOLD_PROMPT_STACK_PX`), so two prompts over one foe do not overlap. It is not a once-only tip (it only appears when it is useful). The hold name is the first of the style's list. (3) The meter: over the middle of every hold in progress (two at most), for human and CPU fighters alike: HELD to ESCAPE bar (green fills as the held fighter gets free: empty at the holder's lead cap of -40, full at the escape goal of 100), the hold name, the seconds left, and a line each for "TAP [Defend] TO ESCAPE" and "TAP [Grapple] TO SQUEEZE" for each human in it (the buttons of that player's last device). It is at most 15 em wide and never wider than the screen minus 1.5 em, and wraps (checked at 375 x 667: 204 px wide with two human fighters). (4) Move list and About & Help show the same "Holds on a downed opponent" section: four steps (every hold plays the same way), who can hold, and a table with one line for each of the 16 styles (hold names, the first is the one on screen, and the ground game; the six hold styles have an own sentence in `GROUND_NOTES` that names the one hold the style plays and its other names). (5) Training scenario 6 "Opponent knocked down (practise a hold)": the dummy lies 1 m from the player for 8 x the normal time (7 s or more; a hold lasts 4 s), key 6 and the pause menu list; review fix: at Normal and above a CPU dummy used to press Defend and be up in about 0.4 s, so the scenario sets `Fighter.keepDown` on the dummy (training only: cleared by `Fighter.reset` and at the get-up that ends the scenario's knockdown, so a later knockdown of the same dummy gets up as usual), which turns off the quick rise for it; it still taps Defend to escape a hold at its level. The Training panel says what to do, or that the style has no holds.
  - As built: `UI.holdTarget`, `UI.holdPromptFor`, `UI.holdPrompts`, `UI.holdMeterFor` (logic) and `UI.holdUi` (the DOM: `#holdPrompt`, `#holdPrompt2`, `#holdMeter`, `#holdMeter2`, projected on the foe / the pair like the name tags); `UI.holdHelpHtml`; `MatchSim.scenario(6)` and `scenarioNo`; constants `HOLD_PROMPT_RANGE`, `HOLD_PROMPT_STACK_PX`, `HOLD_SCENARIO_DOWN`, `SUBMIT_LEVEL_GAP`, `GROUND_NOTES`.
  - Tests: "Submission prompt" (ready, step closer, beyond range, tired, already held, a style without holds, a standing foe, the prompt follows the fighter's target, nothing while busy, another level, Versus P2 gets a labelled prompt), "Submission meter" (progress at the three contest values, time, name, a line per tap instruction, the HUD update runs), "Training scenario 6" (set up, a hold starts from it, the dummy stays down longer than a hold at all four dummy levels, the expert dummy still escapes a hold, the flag ends with the knockdown and a later knockdown quick-rises, panel text), "Submission help" (both screens, 16 style lines, hold sentences). Each fails on the code without its fix (mutants: nearest foe, no keep-down, restricted to the players' team, no busy check, no level text).
  - Training captures (a Sambo fighter against the dummy in scenario 6): `%TEMP%\claude\bp5\p508-1-prompt-ready.png`, `p508-2-prompt-step-closer.png`, `p508-3-hold-meter.png`, `p508-4-hold-squeezed.png`, and at 375 x 667 `p508-5-prompt-phone-375.png`, `p508-6-meter-two-humans-phone-375.png`.
  - Open: the hold name shown is always the style's first; at 375 px the Training panel (existing, 15 em) overlaps the meter.
- Preset roster (P5-04): the 32 fighters of "P1-06 preset roster" are in `ROSTER` (breakpoint.html). The 6 kept entries are unchanged (same ids, styles, attributes, ranks, ranges, bodies and looks; two additions: story fields, and YUKI's title is now "The Slipper", the P1-07 fix; ZERO's P1-07 look fix (grey-violet skin, glowing mask) is left to P9-04). The 26 new ones are rows of `PRESET_ROWS` (after `TIERS`, in the creator section) turned into entries by `presetFromRow` and appended to `ROSTER` / `ROSTER_BY_ID`, so ROSTER order is kai, mara, brutus, yuki, dmitri, zero, then the table order. A row averages 480 bytes (budget 430; the fields are spelled out in full), 12,479 bytes for the 26.
  - Entry fields (all 32): `id`, `name`, `title`, `moveStyle`, `defense` (the P1-06 column, 6 overrides of the style default), `role` (starter / unlock / rival / boss / champion), `country`, `origin`, `goal`, `age`, `gender` (M / F), `fit` = [muscle, weight], `attrs`, `range`, `style` (AI weights), `look`. New rows also keep `height` and `arch` (the creator archetype that gives the AI weights and base range). Only the 6 kept entries have `rank` (the base Arcade ladder order). Story fields are data for P10; the character select shows them in the hint line under the cards (style, age, country, origin, goal). Face is not stored: the 24 pre-drawn faces are P6-06.
  - Body mapping: `look.scale` = the table height (0.92 to 1.12, the creator's own range). `look.build` = `presetBuild(fit)` = 0.70 + 0.60 x weight + 0.10 x (muscle - 0.5), snapped to the creator's 0.05 build step (0.80 to 1.30). It reproduces the six kept builds to within 0.05 (a test pins this), so muscle only adds a little (P6-03 reuses this mapping in the creator's fitness picker, see "Body, age and gender"). Weight class (P3-06) derives from scale x build as before: all five classes occur (NIA and ROSA light, BRUTUS super heavy).
  - Attribute derivation: start from the 44-point `ARCHETYPES[arch].attrs` (capped at 7), add body and age effects (strength 4 x (muscle - 0.55); health 2 x (weight - 0.45) + (muscle - 0.55); speed -3 x (weight - 0.45) - (age - 30) / 25; stamina -2 x (weight - 0.45) - (age - 30) / 30; reach 6 x (height - 1); defense (age - 30) / 30; balance 2 x (weight - 0.45); recovery -(age - 30) / 12), round, keep every value between 4 and 7 and speed at 5 or more (the P0-06 finding that low speed loses), then move single points until the cost (points above 7 count double) equals the role budget: starter 44 (KAI's), unlock and rival 45, boss 46. The derivation was run once and the numbers are stored in the rows (PRANEE, ELISE and GIORGI were then nudged by a point or two so they do not copy their archetype twin). The existing "Roster: costs stay in a narrow band" test keeps all non-champion presets within 44 to 46. No boss has `bossAttrs` (only ZERO scales with the Arcade difficulty); the 3 bosses are 46-point fighters.
  - AI personality and range: `arch` picks `ARCHETYPES[arch].style`; `range` = archetype range + 0.5 x (height - 1) + 0.04 x (reach - archetype reach), snapped to 0.05 (1.0 to 1.7). Titles are street / gym nicknames (no fantasy, sci-fi or supernatural words; a test checks names, titles and story strings against a word list).
  - Looks: only existing `LOOK_CHOICES` and swatches; every look is different (a test compares the whole look and the skin / hair / hair style / top / shorts combination). No brows on 6 rows and no braids / headband on 3, to keep every fighter at 24 to 29 body parts (the roster test limit since P6-04); parts add up per option (brows +2, braids +2, a beard, headband, gi, sash, half mask or other hair +1, long pants -2).
  - Unlock rules (`UNLOCK_RULES`, text from `unlockRuleText`; shown on the locked card and in the locked hint and toast): starters (10, `DEFAULT_UNLOCKED`: KAI, MARA, BRUTUS, YUKI, ROSA, PRANEE, AMARA, SORA, ELISE, CRUZ) are open from the start. ZERO (champion): clear Arcade once. DMITRI: win Arcade stage 3 (also unlocked when beaten, as in 1.0). The 11 other unlocks use a saved counter: Arcade wins 3 LARS, 6 TIAGO, 10 VIKRAM, 15 LUCIA, 20 KASIA; Arcade clears 2 ARMINE, 3 NARAN, 4 TESSA; best Survival streak 3 REID, 5 CAMILA, 8 NIA. Rivals (DEACON, FEMKE, DIEGO, KELSEY, GIORGI, ROXY) and bosses (HAO, MARLON, YOAV): win against them in Arcade. Counters are checked after every Arcade win (`Game.creditArcadeWin`) and every Survival win (`saveSurvivalRecord`), on any difficulty; the results screen lists what was unlocked ("DMITRI and LARS"). Everything is open after 4 Arcade clears plus a Survival streak of 8. P10-05 / P10-06 replace this with the story progression.
  - Arcade ladder (`Game.ladderFor(playerId, clears)`): 5 bouts, always ending on ZERO (the champion), as in 1.0. A run with 0 clears before it (the first, and every run of an old save without a clear) is exactly the 1.0 ladder (`opponentsFor`: the six ranked fighters without the player, strongest 5). Run k after the first clear (clears = k + 1) swaps bouts 2 and 3 for the rivals at table positions 2k and 2k + 1 and bout 4 for the boss at position k (wrapping, never the player's own fighter, no repeats), so the 6 rivals and 3 bosses all appear in the 3 runs after the first clear. Bout 1 stays the weakest 1.0 opponent. The run remembers its clears (`run.clears`), so the ladder does not change while a run lasts, whatever it unlocks. Difficulty, arena and boss tuning per bout are unchanged. Training's default sparring partner is still the weakest ranked fighter. Survival and Free Fight / Training pickers list all presets (31 plus customs, 32 in Free Fight, which allows mirror matches); locked ones are not marked there, as before.
  - Save migration: `Progress.init` rebuilds `unlocked` from `DEFAULT_UNLOCKED` (so a save from before P5-04 gets the 6 new starters) plus the saved ids that have an unlock rule (own unlocks kept; unknown ids such as customs or typos are dropped), then runs `checkUnlocks` once without a message, so an old save's clears, wins and best streak already open what they earn. Counters and records are untouched; no save version change. The co-op seats start on the first four starters.
  - Pickers: the fighter select lists the 32 presets in ROSTER order in the existing card grid, inside the scrolling panel (Back / Confirm stay pinned); on screens up to 480 px wide the grid is 2 columns (it was 1) to halve the scrolling. Locked cards (22 at the start) show LOCKED and a second line with the rule. Co-op cycles the open fighters only. Not seen on screen: only the generated markup is tested.
- Customization items (P6-01, 2026-10-29): 91 items in 9 slots, the counts of "P1-05 content counts" (31 exist today, 60 are new; "None" counts once per slot). Rule: Modern Urban only and distinct silhouettes. Modern Urban = real street, gym and sportswear (checked against the P1-07 audit: nothing that glows or is self-lit, so every new part is matte with `em` 0 and no new item uses the accent glow, which P9-04 removes; no armor, capes, horns, wings, masks of fiction or costume pieces). Distinct silhouettes = an item must change the outline seen from the camera (length, width, height, or an added shape), not only the colour; two items of one slot may not share an outline, except tattoos / marks, which are flat decals and differ by place and shape. Every item is an option appended to the end of its slot's list (an old share-code index never changes). P6-02 implements them with the 6 shared generators (garment, shoe, glove, attach point, hair, decal) and must keep a fighter at 40 parts or fewer (the self-test limit today is 36).
  - Tops, 12 (exist: bare, tank, tee, gi; new 8): hoodie (hood bulk at the neck, long sleeves), jersey (long and loose, short sleeves), track jacket (long sleeves, high collar), bomber (short, wide waist cuff), polo (collar, short sleeves), vest (open front, bare arms), leather jacket (stiff shoulders, hip length), compression shirt (tight, long sleeves).
  - Bottoms, 10 (exist: shorts, pants; new 8): track pants (loose, side stripe), jeans (straight leg), cargo pants (wide leg, side pockets), board shorts (wide, to the knee), gi pants (wide, ankle length), long fight shorts (to the knee, wide waistband), tights (tight, full length), sweatpants (cuffed at the ankle).
  - Shoes, 8 (exist: shoes, boots, barefoot; new 5): high-tops (ankle high), runners (thin sole, low), wrestling boots (calf high, thin), slides (sole and a strap, bare foot), work boots (thick sole, chunky).
  - Gloves / wraps, 8 (exist: gloves, wraps; new 6): MMA gloves (small, open fingers), fingerless (wrist cuff, bare fingers), bag gloves (large, padded), tape (thin wrist and knuckle tape), leather gloves (thin, full hand), none (bare hands).
  - Headwear, 10 (exist: none, headband, half mask, full mask; new 6): cap (brim), beanie (snug dome), hood (peak behind the head), bandana (flat, knot at the back), boxing headgear (bulky, covered ears), balaclava (full cover, face opening).
  - Accessories, 10 (new slot; none exists today, the belt row stays as it is; new 9): chain (necklace), sunglasses (bar across the eyes), scarf (neck loop and tail), wristbands (bands at the wrists), towel (drape over the shoulders), earrings (both ears), glasses (frame), face tape (strip over the nose), backpack (bulk on the back).
  - Hair, 16 (exist: short, ponytail, long, mohawk, bald, afro, topknot, braids, buzz, sideswept; new 6): cornrows (flat rows, close to the head), locs (hanging strands), curly top (volume on top only), bob (jaw length), undercut (shaved sides, long top), fade (graded short).
  - Facial hair, 7 (exist: none, stubble, goatee, full; new 3): mustache, soul patch, chinstrap.
  - Tattoos / marks, 10 (new slot; new 9): none, sleeve, forearm band, chest piece, neck script, eyebrow scar, cheek scar, knuckle marks, face-tape mark, eye black. Plain graphic marks only (no glowing, magical or sigil-like designs).
  - Cost: the 60 new items about 12,100 bytes plus 4,600 for the generators (projection in "P1-05 content counts"). Slots that stay as they are: belt (none, belt, sash), the 7 colour groups, eyes, brows, glow (to be removed in P9-04).
- Customization items built (P6-02, 2026-10-29): all 60 new items of "Customization items (P6-01)" are in breakpoint.html (91 in 9 slots), as parameter rows fed to a few generators. Nothing is hand-drawn per item.
  - Where: `ITEMS` (before `class Fighter`) holds the rows of the 9 slots; `Fighter.applyLook` picks the rows, `Fighter.skeleton` reads them; `NEW_ITEMS` / `LOOK_CLASSIC` / `LOOK_ITEM_KEYS` (after `LOOK_CHOICES`) add the options, labels and the two new slots; `BODY` (before `ITEMS`) holds the bare body's sizes that the draw code and the clipping test both read; `randomItems`, `validateCustom`, `encodeCustom` / `decodeCustom` and the Head / Outfit tabs handle the rest.
  - Generators: (1) garment = `topStyle` and `legs` rows, (2) shoe = `feet` rows, (3) glove = `hands` rows (these three replace the old hand-written lines of the skeleton and draw the old options too, hash-identical), (4) attach point = `Fighter.pieces(list, frame, side)`, (5) hair, beard, headwear, accessory and mark rows are lists of pieces drawn by it (the old hair and beard switch is now rows too), (6) decal = a piece with a tilt (scars, face mark) or on an arm / hand frame (tattoos). `frameScale` gives the x / z scale of a frame (torso: build x chest and build; arms: build x arm; thigh: build x leg; hand: build x max(1, arm)).
  - Rows (metres before height): topStyle [torso width x, depth x, shoulder ball (0 bare), upper sleeve (0 bare), forearm sleeve, hem [width, y, height, depth] or 0, pieces]; legs [thigh, shin, overlay width, length, y (width 0 = the garment is the whole leg), pieces]; feet [width, height, y, z, length, colour, roughness]; hands [width, height, depth, wrapped forearm, hand colour, roughness]; piece [frame h / t / u / w / x / l, mesh, x, y, z, width, height, depth, colour, roughness, tilt, flags (1 both sides, 2 stays under headwear)]. About 100 bytes a piece, 60 to 90 a row.
  - Slots: Headwear is the existing Mask row (label now "Mask / hat"; half and full mask keep their code, the 6 hats are appended; a hat replaces the hair cap, the headband and all top hair, only ponytail, long, braids, cornrows, locs and bob stay under it; the balaclava colours the whole head in the accent colour, hides all hair, brows and beard and shows the eyes through a skin band; the Headband row reads "(hidden by hat)" while a hat is worn). Accessory (`acc`) and Tattoo / mark (`mark`) are new `LOOK_CHOICES` keys, outside `LOOK_CHOICE_KEYS` (so `randomCustom` and its seeds are untouched); rows: Accessory in the Outfit tab before the accent colour, Tattoo / mark in the Head tab after Mask / hat. Accessories use the accent colour, tattoos a darkened skin colour (`ink`).
  - Share code: two fields appended after the body fields, `SHARE_FIELD_COUNT_ITEMS` = 42 (accessory index, mark index); codes of 34 to 40 fields still load (items none); a bad index rejects the code. Saves without the two keys validate as none. SHARE_VERSION and the store version are not bumped (P6-11). Randomize adds `randomItems(seed)` from its own stream (each of the 9 slots takes a new item with probability 0.3).
  - Part budget (limit 40): body 24 + shorts overlay or pockets or stripes 2 + brows 2 + age lines 2 + beard 1 + hair, headwear and headband together at most 5 + top 1 + sash 1 = 38 as before, plus 1 for an accessory and 1 for a mark = 40. So every new piece list is held to its slot's old maximum: tops 1 extra (hood, collar, vest strip or hem), legs 2, hats 2 (headgear 3, which replaces the headband and the top hair), accessory 1, mark 1, shoes and gloves 1 a side. Measured worst case: 40 (the old worst look plus a chain and a sleeve tattoo). The self-test tries every other slot at its richest option and then every hair x headwear x headband x beard x brows mix.
  - Choices made to fit that budget (open for a later pass if parts rise): the wristband is one band on the lead forearm, above any glove, the scarf has no tail, sunglasses and glasses are one bar each (glasses are a thin frame-coloured bar in front of the eyes, not see-through), slides are a flat sole without a visible foot or strap, earrings are one thin bar through the head with the ends showing, track pants have a stripe and cargo pants pockets but no other detail, the vest's open front is a skin strip, sleeve tattoo and forearm band are on the lead arm, knuckle marks only show on small hands (they are hidden under big gloves), leather gloves differ from MMA gloves only by size and shine, the chain is a flat ring at the neck. Ink is not drawn where something covers the skin: the chest piece only on a bare chest, the sleeve tattoo not under a sleeve, the forearm band not under a sleeve or on a wrapped forearm, knuckle marks only on bare or fingerless hands.
  - Hands: the hand keeps its old size for every look (`handScale`); it grows, to just wide enough, only where a long sleeve (gi, hoodie, track jacket, bomber, leather jacket, compression shirt) would be wider than the hand's cut at the wrist. Of the 32 presets only NARAN (gi with wraps, build 1.15) changes, by 0.6 percent, because his sleeve end was wider than the wrap; the 31 others and the 3 pinned random customs draw exactly as before. An earlier version of this change grew the hand of every muscular fighter (8 presets, 2 to 9 percent); that was reverted.
  - Tests added (6): rows complete, labelled, theme-clean, old indices pinned (91 items); every item finite, matte (emissive 0) and 20 to 40 parts on 8 body extremes (height min / max, weight 0 / 1, muscle 0 / 1, Male / Female / Neutral, age 70 once) in the guard, punch, kick and victory preview poses; no clipping, with the body sizes read from `BODY` (the hand covers sleeve ends, shoes enclose the foot and match the shin, hems cover the belt, pockets and stripes sit on the thigh, ink hides under sleeves, hats cover the crown and back of the head, the headband clears the new hair, eyes and brows stay clear, new hair stays off the torso, accessories, marks and the balaclava band touch the body without floating or being buried); a pose check on the matrices of the real draw in the four preview poses (the jersey, bomber and leather jacket hems cut the thigh no more than the gi hem, the backpack and towel never cut the upper arm); ink is drawn only where nothing covers the skin; the 40-part worst case; share codes, saves, seeds, Randomize and the creator rows. Existing tests edited: the most-parts limit 38 to 40, three tests that read share fields from the end now use the field counts, the render test also walks the new slots, the age-mark test uses the live hair-cap rule, and the pinned draw hash now covers all 32 presets and the 3 random customs (values taken from the code before P6-02; NARAN is the one re-pinned).
  - Size: +33,267 bytes (LF 1,158,237 against 1,124,970 at HEAD): about 12,700 code and data, 20,500 tests. Budget 1,200,000. Balance Block / Sway at Hard over 300 seeds 47 / 54, unchanged.
  - Open (needs an on-screen look): every shape is a guess from numbers. Check in the Creator (Head and Outfit tabs, all 4 poses): hat fit and brims, hood and hoodie bulk, bomber and jersey hems in a kick, vest strip, cargo pockets, wrestling boots with shorts, backpack and towel on wide and narrow bodies, locs and bob against the neck, sunglasses width, tattoo ink contrast on dark skin tones. Distinct silhouettes (P6-01 rule) were designed from the dimensions, not looked at.
- Body, age and gender (P6-03 to P6-05, 2026-10-29): decisions by the owner's delegate, implemented in breakpoint.html (creator Body tab, `bodyOf`, `setFitness`, `Fighter.applyLook` `shape`, `validateCustom`, `encodeCustom` / `decodeCustom`).
  - Decision, P6-03: fitness COMPLEMENTS stats; it does not change attribute points. It sets the body shape, and through the body only the effects that already follow the body: the weight class of the P3-06 heavy tackle (scale x build) and the visual size. Reason: any look works with any stat build, balance stays inside the point budget (P14), a heavy fighter is not forced to be strong or a lean one fast, and nothing in the fitness picker needs a balance pass. (A trade-off such as heavy = tanky would have to be paid for in the 44-point budget, so it belongs to the attributes, where it already is.)
  - Decision, P6-04: age changes the look only, no stat. Reason: the same as P6-03, and the 26 new presets already carry age-based attribute values chosen by hand in P5-04 (their rows are data); a creator age that moved the points would make two old fighters of the same build differ by a hidden rule. Decision, P6-05: gender changes the look only; any gameplay effect waits for P14-02 (none is planned).
  - Picker: a square (not a triangle), Y = Muscle, X = Weight, both 0 to 1 (a triangle would hide corners the P1-06 table uses: lean and light, heavy and soft). Press or drag on it (mouse and touch, `touch-action: none`, the dot follows the finger and the preview updates live without rebuilding the page). The Weight and Muscle rows beside it are the keyboard / gamepad route, like every other creator row: Left / Right (or pad left / right) moves the dot by 0.05, Up / Down moves to the next row. The picker itself is not a focus stop (Up / Down already move focus in every menu and pad navigation, so a 2D control would trap it). The Build row is gone from the Body tab: build is now the result, shown as "Build: Athletic (1.00)" under the rows.
  - Body mapping: `look.muscle` and `look.weight` (0 to 1, two decimals). Build = `presetBuild([muscle, weight])` = 0.70 + 0.60 x weight + 0.10 x (muscle - 0.5), snapped to 0.05 and clamped to 0.80 to 1.30 (the P5-04 mapping, now shared); `look.scale` stays the Height row. Shaping beyond build, in `Fighter.applyLook` as `shape` (muscle m, g = 0 Male, 0.5 Neutral, 1 Female): arms and shoulder balls x (1 + 0.45 (m - 0.5)) x (1 - 0.12 g); torso and chest width and the shoulder offset x (1 + 0.2 (m - 0.5)) x (1 - 0.08 g); thighs x (1 + 0.25 (m - 0.5)); pelvis width and hip offset x (1 + 0.18 g). Muscle 0.5 and Male give exactly 1, so the original body is unchanged (floating-point multiplication by 1). No new parts.
  - Age (P6-04): Age row 16 to 70 (slider, arrows 1 year), default 28. Up to 45 nothing changes (`ageHair`, `shape.lean`). From 46: hair colour mixed toward #c9c9d2 by 0.85 x (age - 45) / 25 (about 85 percent grey at 70; brows and stubble follow because they use the hair colour); torso leans forward up to 0.14 rad (8 degrees) at 70 and the head tilts back by 0.6 of that so the eyes stay level; from 55 a thin line on each cheek below the eyes (2 parts, AGE_MARK, tilted along the face, skin darkened 30 percent, matte; a test checks it is in front of the head and not inside the hair cap, afro or buzz cut). Hair already lighter than the grey (white) is not darkened. Belt, sash and gi skirt widen with the hips. The Body tab hint and the Moves help say the weight class comes from height and fitness (build). The 26 new presets carry their `age`, `gender`, `muscle` (fit[0]) and `weight` (fit[1]) in their look; the six kept ones carry none, so their look is exactly the 1.0 one (MARA and YUKI stay on the original body shape although they are F). Presets of age 46, 49 and 57 (KASIA, MARLON, HAO) grey slightly (HAO's hair is already white).
  - Gender (P6-05): Gender row Male / Female / Neutral (a third value because it is one table entry: shape factor 0.5). Male is the original body (the reference), Female narrows chest and arms and widens the hips, Neutral is half way. Presets use M / F only.
  - Share code (append only, `SHARE_FIELD_COUNT_BODY` = 40 fields, SHARE_VERSION and the custom store version NOT bumped; P6-11 will): after the defense field four fields: muscle x 100, weight x 100, age, gender index (M 0, F 1, N 2). The decoder accepts 34, 35, 36 and 40 fields; shorter codes leave the body fields unset and `validateCustom` fills them. Code length stays about 210 characters (limit 400). A bad value (muscle or weight not a whole 0 to 100, age outside 16 to 70, gender index outside 0 to 2) rejects the code. Custom store: the fields are plain keys of `look`.
  - Defaults for a look without the fields (every older save and code, `randomCustom` output, a custom made before this change): muscle 0.5, weight = `weightFromBuild(build)` = (build - 0.70) / 0.60 clamped and rounded to two decimals (this reproduces the stored build through `presetBuild` for every step of 0.05 from 0.80 to 1.30, so the stored build stays what it was and the picker shows the matching weight), age 28, gender M. Such a fighter draws exactly as before. If a hand-edited code has a build that does not match its muscle and weight, the build wins until the picker is touched.
  - Random: `randomCustom` is untouched (same JSON for every seed, pinned by the P5-01 test); the creator's Randomize adds `randomBody(seed)` from its own stream (muscle and weight in 0.05 steps, age 16 to 70, gender M / F / N), and the build follows the fitness.
  - Measured: the draw stream of the six kept presets and of 15 random customs is identical to the previous build (hashes pinned in a self-test; the 26 new presets differ by design); Block / Sway at Hard over 300 seeds 47 / 54, unchanged. Attribute points, `deriveStats`, the point budget and the weight-class bounds are not touched. Size: +20,582 bytes (LF 1,124,967 against 1,104,385 at HEAD): about 11,000 code and CSS, 9,500 tests (over the 12,000 planned for the batch; the budget of 1,200,000 still has 75,000 free).
  - Existing tests edited: three tests that read the share code from its end (field count of an older code, the style field position, the defense field cases) now use the named field counts; their checks are unchanged. Part limits: the roster check allows 29 parts (HAO, aged 57, draws 29) and the most-parts check 38 (was 36) because the age lines add 2; P1-05 allows 40 per fighter, so P6-02 has 2 parts less room than planned.
  - Open (only checkable on screen): the picker feel on a phone (size 9 em high, dot 1.2 em), the female / neutral shapes, the cheek line position and the 8 degree lean at 70 in all pose previews; the Randomize range of ages (uniform 16 to 70) is a guess.
- Faces (P6-07, P6-08, 2026-10-29): 24 pre-drawn faces drawn on a texture, with a fallback to the procedural face. Written so that P6-06 (photo face) and P6-09 (expressions) reuse it.
  - Texture path: `FaceTex` (breakpoint.html, before `QUALITY_PRESETS`) paints one atlas on a 2D canvas, `FACE_GRID` x `FACE_GRID` = 8 x 8 cells of `FACE_CELL` = 64 px (512 x 512, 1 MB), and `R.buildGL` uploads it as one RGBA texture (LINEAR, clamped, no mipmaps) on unit 0; `R.render` binds it and re-uploads when `FaceTex.dirty` (a cell was repainted). No external file, no data URL; `texImage2D` from a canvas needs nothing from the CSP (`img-src data:` is unchanged). The atlas is rebuilt with the GL objects after a lost context (`buildGL`).
  - Face shell: a face is ONE part, a sphere the size of the head x 1.006 (`FACE_SHELL`), pushed in the solid layer with `part(..., cast = -1 - cell)`. `R.push` stores a number in the cast slot as it is; the vertex shader already drops cast < 0.5 from the planar shadow pass, so a shell casts none. The fragment shader (`uFace`, `vFN` = the mesh normal) reads the atlas by the front of the head, orthographic: x, y of the unit normal in +-0.8 fill one cell. It outputs `mix(skin, texel colour, texel alpha x front)`: where the texel is clear, or on the back half, the shell is the head's own skin colour, lit like the head (same normal, roughness 0.7, emissive 0), so there is no `discard`, no blending and no alpha layer in the shared program (the second review round dropped the alpha-layer variant of the first, which drew correctly on the NVIDIA / D3D11 setup used here but not on the reporter's). The atlas is premultiplied by hand when it is uploaded (`getImageData`, rgb x alpha, then `texImage2D` from the bytes: no canvas-source upload and no `UNPACK_PREMULTIPLY_ALPHA_WEBGL`), and the shader divides the alpha out, so filtering leaves no dark fringe at feature edges. Skin tone follows the Skin colour and any fine tone; the texture holds only features (eyes, brows, nose, mouth, freckles, eye bags) in neutral colours with alpha.
  - Fallback: `R.faceOk` is true only when the atlas was painted (a 2D canvas exists) and uploaded without a GL error; a failed refill in `R.render` sets it false (no retry every frame), and a rebuilt context (`buildGL`) creates the texture again and repaints the 24 faces (also after a cleared canvas). `FaceTex.cellOf(id)` returns -1 for Classic and whenever `R.faceOk` is false, and `Fighter.drawHead` then draws the procedural eyes and brows exactly as before. The creator follows it: the Face row reads "(not supported here)" and Eyes / Brows keep their own rows while no face can be drawn. A full mask and a balaclava also keep their own eyes (no shell); a half mask, cap, beanie, hood, bandana and headgear sit over the shell as they sat over the head (checked on screen). Quality presets: the face renders on low, medium and high; no preset has a fallback rule (cost: one part, one read of a 512 x 512 texture). To drop it on low later, add `&& Quality.level !== 'low'` to `cellOf`.
  - Part budget: the shell replaces the 2 eyes and the 2 brows (3 fewer parts than Classic with brows; 1 fewer with brows none), so the 40-part worst case is still the classic one (exactly 40) and a face never raises it (self-test).
  - Face rows (P6-08): `FACE_ROWS` = 24 strings of 20 digits (0 to 9), one digit per column; `FACE_RANGE` gives [low, high] per digit and `FaceTex.decode` applies it; `FaceTex.paint(cell, row)` names the columns in order: eye spread, eye height, eye half width, eye half height, eye tilt, iris colour (10 in `FACE_IRIS`), brow gap, brow thickness, brow tilt (positive = angry), brow length, brow shade, nose width, nose length, mouth half width, mouth height, lip thickness, mouth curve (positive = smile), lip tone, freckles (0 to 24), eye bags. Units are head-front units (the cell spans 1.6). Review fix: eye height is 0.06 to 0.18 and brow gap 0.11 to 0.2, and the rows were re-picked so that no brow (ends, centre, thickness, tilt) reaches under the `HAIR_CAP` hairline (self-test "no brow ... under the hair cap"); the rows are still as different as possible (minimum 39 digit steps apart). Scars and tattoos stay with the Tattoo / mark slot (not duplicated); known and accepted: the Eyebrow scar mark sits at a fixed place and misses the lower brows of Faces 2, 5 and 12. The count is the P1-05 count: 24 = 3 rows of 8 in the picker's cycle. Cost: rows about 500 bytes, atlas and painter code about 5,000.
  - Creator and share code: `LOOK_CHOICES.face` = Classic (`none`) + `f0` to `f23` ("Face 1" to "Face 24"), a third `LOOK_ITEM_KEYS` slot, so `validateCustom`, save slots and the preview treat it like Accessory and Tattoo / mark; the "Face" row is the first row of the Head tab (`choice:face`); with a face chosen the Eyes and Brows rows read "From the face" (their choices are kept and used again on Classic). Share code: one field appended after the item fields, `SHARE_FIELD_COUNT_FACE` = 43 (index into `LOOK_CHOICES.face.options`, 0 = Classic); codes of 34, 35, 36, 40 and 42 fields still load (Classic), a bad index rejects the code. SHARE_VERSION and the store version are not bumped (P6-11). `randomCustom` and its seeds are untouched; Randomize leaves the face on Classic.
  - P6-06 (photo face) plugs in here: paint the cropped, oval-masked photo into a free cell (24 to 63) with `FaceTex.put(cell, canvasOrImage)` (false for a cell outside 0 to 63; clear parts show the head; put the face in the middle of the cell, eyes at about 0.16 of the half height above the centre, since the cell is the head front window); store the cell per fighter and make `FaceTex.cellOf(id)` return it for a `photo` id. Nothing else in the renderer changes; the same shell and shader draw it. To hold more photo cells or expressions, raise `FACE_GRID` (shader and canvas both read it; a 16 x 16 atlas is 4 MB).
  - P6-09 (expressions) plugs in here: an expression is another cell for the same face (paint it with `FaceTex.paint` using a row whose brow tilt, mouth curve and eye height digits are changed, or `put` a warped photo). Swapping is only a different cell number in the shell's cast slot (`-1 - cell`), so it costs no upload and no part; extend `cellOf(id)` to `cellOf(id, expression)` and pass the fighter's state. Size warning: 24 faces x 8 expressions = 192 cells against the 64 of the 8 x 8 atlas, so P6-09 needs a bigger atlas (16 x 16 = 256 cells, 4 MB; raise `FACE_GRID`) or must paint expression cells on demand (only the faces and expressions in use, e.g. a small least-recently-used cell pool, then `FaceTex.dirty` re-uploads once).
  - Measured: 5 new self-tests (273 total; headless 258 of 273 with the 15 browser-only checks failing as before), pinned draw hashes of the 6 kept presets, all 32 presets and the 15 random customs unchanged (Classic draws the same stream), Block / Sway at Hard over 300 seeds 47 / 54. Size: +17,857 bytes (LF 1,176,094 against 1,158,237 at HEAD): about 10,100 code, comments and data, 7,700 tests; 23,900 bytes free below 1,200,000. The browser-only test "every face is painted into the atlas and ... into the uploaded texture" reads the painted canvas (`getImageData`) and, on a real GL context, the uploaded texture back through a framebuffer, and fails when any face has fewer than `FACE_MIN_TEXELS` (100; the faces have 240 to 490) visible texels: it catches a blank atlas or a failed upload on the machine it runs on, which the headless run cannot. Existing tests edited: two P6-02 share tests now compare the full code length with `SHARE_FIELD_COUNT_FACE` instead of `SHARE_FIELD_COUNT_ITEMS` (which is now the 42-field length); their checks are unchanged. Headless harness: its fake canvas now returns a no-op 2D context (scratchpad, not the repo).
  - Open (only checkable on a real GPU or a phone): an "invisible faces" report after the first review round was a view of the back of the head; rechecked from the front on the same setup, the faces draw. If faces ever look blank on some device, the message of the self-test "every face is painted into the atlas ..." says whether the canvas or the GPU texture is blank. Not checked on screen: the other 23 faces on that setup, the texture shimmer at the farthest camera on low (no mipmaps, 64 px cells), and the Face row on a phone. If the faces read too small in the creator preview, raise the eye ranges in `FACE_RANGE`.
- Photo faces and expressions (P6-06, P6-09, 2026-10-29): replaces the two "plugs in here" notes above.
  - Atlas (decision): it stays 8 x 8 (512 x 512, 1 MB). Cells 0 to 23 are the pre-drawn faces as drawn (also their rested / neutral look, so a face at rest draws exactly as before); cells 24 to 63 (`FACE_POOL_FIRST`) are a pool of 40, filled on demand by `FaceTex.slot(source, expression)`: it returns the cell that already holds that face (or photo) in that expression, else paints it into the least recently drawn cell (`stamps`, `owners`), after the shell's cell number is read, so the swap shows in the same frame. Why not 16 x 16: a 1,024 px atlas is 4 MB. Upload (review fix F1): a painted pool cell is added to `FaceTex.cells`, and `R.render` sends each one with `texSubImage2D` from a `getImageData` of only its 64 x 64 (premultiplied, 16 KB); the full 1 MB upload stays for the build, a lost context and `put` (`dirty`). Measured here (GPU Chrome): one cell median 0.3 ms (worst 6.7 ms), the full atlas median 3.4 ms (worst 4.5 ms). A face shows 7 expressions at most, a 1v1 needs at most 14 cells, a brawl evicts the oldest. `paintAll` (new texture after a lost context) also empties the pool. A cell used this frame has the newest stamp, so one frame never evicts its own cells.
  - Expressions: `FACE_EXPR` has 7 rows (rested = neutral, hurt, tired, panting, angry, win, shocked; the P1-05 list had 8 with rested and neutral apart, merged as the P6-09 text asked); each row adds to the face's own eye height (x), brow tilt, brow lift, mouth curve, mouth opening and eye bags. `FaceTex.paint(cell, row, expression, photo)` applies it; the freckles use the face's own number, so they stay put. `faceExpression(fighter)` reads state only, in this order: VICTORY win; DEFEAT angry (lost the round); KO, THROWN, FALL shocked; any reaction state (hit, stagger, stun, clinch, down) or `gotHits` above 0 hurt (the hit-stun plus the 12 combo-reset ticks, so about 0.5 s after the last hit); `exhaust` above 0 or stamina under 12 % panting; under 35 % tired; a combo of 2 or more still showing angry; else rested (the face as drawn). It is called from `Fighter.drawHead` only while drawing (not in the sim's own skeleton pass), writes nothing, and uses no random numbers. Classic faces: unchanged (their eyes and brows are separate cubes; tilting them was not cheap enough). No texture (`R.faceOk` false): `cellOf` returns -1, so expressions do nothing and the Photo row is not shown.
  - Photo faces: the Head tab "Photo" row (`photo:pick`) opens a hidden `<input type=file accept=image/*>` (a phone offers camera or gallery); the file goes straight to `createImageBitmap(file)`, so no blob: URL is needed and `img-src data:` in the CSP is unchanged (stored photos decode from data: URLs; verified in Chrome under the real CSP). A file over 25 MB (`PHOTO_MAX_FILE`) is refused with a toast before it is read; the rest is decoded no wider than 1,024 px (`resizeWidth`, orientation from the file; a 48 MP photo would otherwise take about 190 MB), retrying without the options if an older browser refuses them; one the browser cannot read gives a toast. The decoded picture is closed when the crop ends or is replaced, on Cancel, on leaving the creator, and when the creator is no longer showing; the centre is kept where the square can reach (`fitCrop`), so no drag travel is lost at the edges; Cancel or Use photo ends any drag in progress. The crop screen (`CreatorUI.crop`) shows the picture in a 256 px canvas with the oval that is kept (`PHOTO_OVAL`: half width 0.36, half height 0.46 of the cell) and three dots where the eyes and the mouth of the expression overlays are drawn; drag moves the picture, the Zoom slider (100 to 400 %) zooms, and the Zoom, Left / right and Up / down rows move in steps with the arrow keys or a pad (Esc / Back cancels). The Photo and Remove photo rows act only on OK, Enter or a click (`press`), never on a direction; if the browser reports no user activation (a pad button) a toast says to tap or click, since the picker may not open. There is no pinch or wheel: the slider is the touch zoom. Use photo draws the chosen square into 64 x 64 and encodes a JPEG data URL, trying quality 0.8, 0.6, 0.4, 0.25 until it is at most `PHOTO_MAX_CHARS` = 6,000 characters (2,115 for a plain test picture; a real photo is larger and the quality steps down to fit); if none fits it says so and stores nothing.
  - Storage: `look.photo` in the custom fighter save only. `validateCustom` keeps it only when it is a JPEG data URL of at most 6,000 characters, else drops just the photo; share codes never carry it (the encoder lists its fields, so a code made from a photo fighter has the chosen face, Classic or Face n, which is also what a fighter without a decoded photo shows). Eight slots at the cap are about 54,000 characters of the 65,536 `STORE_MAX_LENGTH`; `CustomRoster.put` also checks the whole store against that limit before writing and, if it would go over (not reachable at these caps), drops the newest photo with a toast, so a store the next load would ignore is never written. Importing a code over a fighter drops its photo (the new fighter has none); duplicating keeps it. SHARE_VERSION and the store version are not changed.
  - Drawing a photo: `FaceTex.photoOf(url)` decodes it once through an `Image` (cache of 12) and returns null until it is ready, so the fighter wears its chosen face for a moment; then the photo is clipped to the oval and drawn into a pool cell (hard antialiased oval edge, no feathering: the head's own skin shows outside it). For an expression the same cell gets overlays only, positioned from a fixed mid-range face row (`PHOTO_ROW`, eyes at 0.425 and mouth at 0.806 of the cell height): a dark lid over a narrowed eye, tilted brows, eye bags and an open mouth; the photo's own brows and mouth stay under them. Decision: overlays, not warping (cheaper and robust: no landmark detection, nothing can tear the photo). Known limit: they only line up when the player put their eyes on the dots.
  - Self-tests (2, compact): "Photo faces: ..." (the quality ladder, a rejected over-size URL, a synthetic canvas cut into a JPEG, junk and over-size values dropped on load, the code carries no photo and keeps the face, a photo reloads from the saved JSON, a pool cell outside the pre-drawn range drawn as one shell, the crop square staying inside the picture, no photo rows and cell -1 with no faces) and "Expressions: ..." (the state table, 24 faces x 7 expressions and a photo asked of the 40-cell pool with owners, faces and photos consistent both ways, a pool paint dirtying only its own cell, and a 1,500-tick seeded fight whose hp, stamina, positions, states and tick are identical with faces drawn every tick and with none, while the faces show a hurt look).
  - Measured: headless 260 of 275 (the same 15 browser-only failures), browser self-test 275 / 275 (GPU Chrome, real canvases), pinned draw hashes unchanged (a fresh fighter draws the face's own cell), Block / Sway at Hard over 300 seeds 47 / 54. Size: +17,982 bytes (LF 1,194,076 against 1,176,094 at HEAD; 5,924 free below 1,200,000): about 12,000 code and CSS, 6,000 tests, over the 12,000 planned for the batch.
  - Open (needs eyes or a phone): the crop screen on a real phone (it scrolls inside the panel and the picture sits partly above the fold at 390 x 844), a real camera / gallery pick (the file picker needs a tap or key press; a pad button may not count), a real photo against the overlay dots (alpha edge, skin tone mismatch, lid darkness), and expressions during a real fight (the swaps were checked through the draw path and as stills). The Eyes / Brows rows read "From the face" only after a photo has decoded (they are not redrawn when it finishes).
- Self-tests in their own file (owner decision 2026-10-29: "Move the self-tests into a separate breakpoint-tests.js next to the game, loaded only when selfTest() runs. The game file drops to about 750 KB and stays well inside 1.2 MB; BREAKPOINT.selfTest() works as before when the tests file sits next to the game."):
  - Why: the stored (LF) `breakpoint.html` had reached 1,194,076 bytes against the 1.2 MB budget of "P1-05 content counts", and the self-tests were about 430 KB of it. Now `breakpoint.html` is 765,075 bytes (LF as stored; 776,384 with CRLF on disk) and `breakpoint-tests.js` is 441,265 bytes (LF; 446,852 with CRLF). The P1-05 size budget counts `breakpoint.html` only. The game plays on its own: send `breakpoint.html` alone, and add the tests file only to test.
  - What moved: `SelfTest` and `SELFTEST_STORE_KEYS`, plus the helpers only the tests used (`ScriptedController`, `STATE_LABEL`, `FACE_MIN_TEXELS`, `STYLE_STANCE_KEYS`, `STYLE_FOOTWORK_KEYS`, `TOUCH_BUTTON_SCALE`, `touchOffsetPx`, `touchLayoutRects`). The test code is unchanged: the same 275 tests with the same names and order, and every result and detail matched the build before the move (pinned draw hashes, determinism, Block / Sway 47 / 54 at Hard over 300 seeds). A new test-only helper goes into `breakpoint-tests.js`, not the game.
  - How the file hooks in: `breakpoint-tests.js` is a classic script that sets `window.BREAKPOINT_TESTS = function (api) { ...; return SelfTest; }`. `api` is `testApi()` in the game: the 269 internal bindings the tests use (found by listing the closure's top-level declarations against the names the tests use, with a scope-aware scan), built only when the file has loaded. One binding is reassigned, `controlsChanged` (a top-level `let`, set by the game and by the migration tests), so it cannot be copied: tests use `api.get.controlsChanged()` and `api.set.controlsChanged(value)`. When a test needs another internal binding, add its name to the destructuring at the top of the tests file and to `testApi()`; a missing name shows as a ReferenceError in that test. A binding that gets reassigned must go through `api.get` / `api.set` too.
  - Loading: `UI.runSelfTest` (menu action `selftest`, `BREAKPOINT.selfTest()`) adds a `<script src="breakpoint-tests.js">` the first time, relative to the page, then keeps the tests object for later runs (no second request). It now returns a promise of the same array of `{ name, pass, detail }`, so `await BREAKPOINT.selfTest()` works; outside the main menu it still shows "available from the main menu only" and resolves to undefined. If the file is missing or blocked, the player gets a toast, the on-screen line and one failed result named "Self-test file loads" saying "Self-test file breakpoint-tests.js not found next to the game (or the browser blocked it)"; nothing crashes and a later try loads it. Normal play never requests the file.
  - CSP: `script-src 'unsafe-inline'` became `script-src 'self' 'unsafe-inline'`. Everything else is unchanged (`default-src 'none'`, no `unsafe-eval`). No self-test pins the CSP text. In Chrome, `'self'` matches a `file://` page and the script next to it (275 / 275 from `file://`), and with the old policy the same page refuses the script, so the change is needed and enough.
  - Running the tests: in a browser over http, start the `games` server, open `http://127.0.0.1:8765/Beat%20Em%20Up/breakpoint.html`, and from the main menu run `await BREAKPOINT.selfTest()` (or Menu > About & Help > Run self-test). From `file://`, open `breakpoint.html` from its folder and do the same (the tests file must sit next to it). Headless in Node: `extract.js` pulls the inline script as before; `harness.js` answers the game's `<script>` element by running `breakpoint-tests.js` in the same context, then runs `selfTests.run_all()`. Measured: headless 260 of 275 (the same 15 browser-only failures), browser 275 / 275 from `file://` and from an http address answered by a CDP script (the real `games` server was not running), balance 47 / 54.
- Weapons, items and hazards (P7-01, P7-02, P7-05, P7-06; decided 2026-10-29 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row).
  - Classes: **light** (one hand, fast, Punch = a 3-step weapon string), **heavy** (one hand, slow, Punch = a 2-step string whose last step is strong), **two-handed** (both hands, long reach, Punch = a 2-step string, no clinch while held), **throwable** (best thrown; a held strike is weak), **carry** (both hands, no strikes, walk at 70%, only throw or drop). Kicks stay the fighter's own kick strings with any one-hand item; with two-handed or carry items Kick still works. Damage values are base damage before the fighter's strength; speed = startup ticks; durability = hits (landed or blocked) and throw impacts before it breaks into debris of its material and vanishes.

    | Id | Item | Class | Dur. | Dmg | Reach m | Startup | Thrown dmg | Distinct use |
    |---|---|---|---|---|---|---|---|---|
    | bottle | Bottle | throwable | 1 | 9 | 0.35 | 5 | 10 | Shatters on the first hit: +10 ticks stun and glass shards on the floor |
    | brick | Brick | throwable | 3 | 8 | 0.25 | 6 | 16 | Hardest throw; a head hit knocks down |
    | binlid | Bin lid | light | 6 | 6 | 0.40 | 6 | 8 | Shield: while held, Block takes no stamina from strikes in front and a Sway fighter blocks instead of dodging |
    | stick | Escrima stick | light | 8 | 7 | 0.70 | 4 | 6 | Fastest weapon; Kali fighters get a 4-step string |
    | bat | Baseball bat | heavy | 6 | 16 | 0.90 | 10 | 12 | Full swing (last step) knocks down |
    | pipe | Steel pipe | heavy | 12 | 14 | 0.85 | 9 | 12 | Most durable; metal (arcs an electric panel) |
    | hammer | Hammer | heavy | 8 | 15 | 0.45 | 8 | 14 | Short reach, long stun; breaks any destructible in one hit |
    | wrench | Pipe wrench | heavy | 10 | 13 | 0.60 | 8 | 12 | Hook: the last step pulls the foe in and opens a free clinch |
    | chain | Bike chain | light | 10 | 9 | 1.00 | 7 | 8 | Wraps the guard: a blocked hit still deals half damage |
    | chair | Folding chair | two-handed | 3 | 18 | 0.80 | 13 | 14 | Wide arc hits every foe in front; breaks fast |
    | skateboard | Skateboard | two-handed | 5 | 12 | 0.80 | 9 | 10 | Thrown, it slides along the floor and trips (low knockdown) |
    | broom | Broom | two-handed | 6 | 7 | 1.30 | 7 | 6 | Longest reach; the second step is a low sweep that trips |
    | crate | Crate | carry | 2 | - | - | - | 20 | Thrown: knockdown on everyone it hits, breaks into wood debris |
    | extinguisher | Fire extinguisher | heavy | 4 | 12 | 0.50 | 10 | 12 | 3 sprays: a strike also sprays a 2 m cone that blinds (30 ticks, no damage); thrown, it bursts into a cloud |

  - Combat rules (P7-04 uses them): a weapon hit costs 1 durability (landed or blocked). Disarm: a strong string step that lands, any knockdown and any throw make the victim drop the item at their feet. Block: weapon hits cost the blocker 1.5x stamina; heavy and two-handed last steps count as strong (they break a non-perfect block). Sway dodges weapon swings like any strike. Grapple with a one-hand item works as normal (the item stays in hand); with a two-handed or carry item Grapple drops it first. Items never hurt their own team unless friendly fire is on. Thrown items (decided after the P7 review, 2026-10-29): a front-facing Block stops a thrown item at 1.5x stamina (a perfect block costs none); the item bounces off and drops, a bottle still shatters and a crate still bursts but without the knockdown; a sliding skateboard needs Crouch + Defend. Sway dodges throws like strikes. A thrown item hits only fighters a normal strike could hit (not a clinched pair, a fighter in a knockdown flight, a submission-held fighter or one in wake-up grace).
  - Where items appear: placed per arena (P7 puts 4-7 in each of the 3 current arenas; P8 adds the level placements). Dropped and thrown items stay where they land (P9-03), at most 12 loose items per scene (the oldest broken-off piece goes first). Setting "Items": on by default in Arcade, brawls, Training, Free Fight and Versus; off in Tournament (P11 rules may turn it on).
  - AI (fills the P4-02 stubs): `considerPickup` = an empty-handed AI without an attack token takes an item within 2.5 m that is closer than its target; with a throwable or carry item and the target 3-8 m away it throws. `considerHazard` = an AI with its target within 1.5 m of an active hazard moves so its next hit drives the target into it, or strikes the hazard's trigger when the target is in its zone.
- Weapon models (P7-07, decided 2026-10-31 by the coordinator; visual only). Each item row in `WEAPONS` keeps its gameplay fields; only `parts`, `len`, `hold` and `tilt` are model data (the move fingerprint ignores them). `parts` rows are `[mesh, x, y, z, w, h, d, colour, roughness, tilt about x, tilt about z]` in metres in the item's frame: the grip at the origin (the hand centre is at y 0.02, so the handle covers y 0 to 0.1), +y out of the fist to `len`, +z forward in the hand and up when it lies. `hold` = `[offset along y, offset forward, turn about y, offset across]` puts the grip part in the hand and turns the business end to lead (hammer face, wrench jaws, broom bristles forward; bin lid handle into the fist, rim to the foe); the chair hangs from one rear leg, the crate sits between both hands. `hold[4] = 1` marks an item modelled grip first (the extinguisher: carry handle at the fist, base at the far end), which is turned over to stand on its base when loose; `hex` is the debris colour where the first row is only a grip or tape (default: the first row). Real sizes: bottle 0.30 m (held by the neck: crown cap, lip, short neck and shoulder, a closed body of two thirds of the length with a paper label), brick 0.215 x 0.10 x 0.065 lying flat, bin lid 0.42 m, escrima stick 0.70, bat 0.90, steel pipe 0.85, hammer 0.45, pipe wrench 0.60, bike chain 1.0 (chunky two-rail links 0.05 m wide turned a quarter turn, a padlock at the end, a slack curve when loose), folding chair 0.8 high, skateboard 0.8 x 0.2 with round ends, trucks and wheels, push broom 1.3, crate 0.44, extinguisher 0.5 (red canister with a white band, black valve head, carry handle and squeeze lever, a short hose with a nozzle). `len` of the brick is 0.065 (its tumble centre) and of the chair 0.8 (the chair's far end is the chair back); `rest`, `lie` and the reach tips (P5-07) are unchanged. Material colours: green glass with a paper label, brick red, grey steel with a dark tape grip, rattan, natural wood and black tape, red enamel with a white label. Cost: 2 to 12 rows and 36 to 512 triangles per item, none uses the sphere mesh. Self-tests: real size per item, the fists within 0.04 m of the item (0.065 m for two-handed items and the crate) through the first swing, and loose items resting on the floor and on a table.
- Pick-up rule (P7-02, decided): one press of Use, no crouch. The item must be within 1.0 m of the fighter's front (within 70 degrees of facing); several in reach = the one nearest the facing line. The fighter plays one of three grab poses by the item's height: floor (below 0.4 m) = crouch-and-grab, waist (0.4-1.1 m, tables) = lean grab, high (1.1-1.8 m, racks and walls) = reach grab. 14 ticks; a hit during the grab cancels it and the item stays. The owner's ideas-file wording "crouch to pick up" is replaced by this because the owner disliked "crouch to take a hammer from a table". USE input is as the Phase 3 decision: tap Use while holding = throw (lock-on target, else facing); Crouch + Use = drop.
- Hazards (P7-05, decided; 7 of the 8 in P1-05, the wet floor was removed by the owner). Each one damages any fighter of any team, has a visible trigger, and runs through one shared handler (type row + zone + effect), so P9 can route interactions through its matrix.

    | Id | Hazard | Trigger on purpose | Effect | Placed in |
    |---|---|---|---|---|
    | panel | Electric panel | Strike it or a metal item hits it; a fighter knocked into it | 2 s arc, 1.2 m: 14 dmg + 40-tick shock stun; 6 s cooldown | Warehouse (P7), levels (P8) |
    | steam | Steam pipe | Strike the valve | 3 s jet, 2 m cone: 3 dmg every 15 ticks, push back | Warehouse, Pit (P7) |
    | drop | Open drop | A fighter knocked over the edge | 25 dmg and down; in a brawl the enemy is out | Rooftop, Construction (P8) |
    | glass | Glass wall | A fighter thrown or knocked into it, or a thrown item | Breaks: 10 dmg; shards on the floor (2 dmg to anyone knocked down on them) | Dojo (P7), levels (P8) |
    | load | Falling load | Strike its support | 0.6 s warning shake, then a 1.5 m circle: 30 dmg + knockdown | Warehouse (P7), Construction (P8) |
    | train | Passing train | Timed, with 2 s warning lights | 40 dmg + thrown down the track | Subway (P8) |
    | fire | Fire barrel | Strike it: it tips and spills fire 2 m for 4 s | Touch: 4 dmg + flinch, every 20 ticks | Pit (P7), levels (P8) |

  - Wet floor: removed (owner, 2026-10-29 08:21, verbatim: "Remove the wet floor thing in breakpoint its a bad idea"). No wet floor hazard, no panel-plus-wet interaction, no bucket in P9; this replaces the P1-05 "Hazards 8" count with 7.
  - Open drop and train are built with the shared handler in P7-05 and placed and checked in P8 (the current arenas have no edge and no track).
- Pickable hazards (P7-06, decided): the fire extinguisher (its spray is the hazard), the crate, the bottle (glass shards) and the brick. Panels, pipes, barrels, loads and glass walls are fixed hazards: they are triggered by hits, not carried.
- Levels (P8-01, decided 2026-10-29 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row). Modern Urban only; the 8 levels of P1-05 (3 reworked + 5 new). P8-02 / P8-03 build them, P8-04 the decks, stairs and collapses, P8-05 the 1v1 areas, P9 the rules (next entry).
  - Conventions: metres; x across the screen, z in depth (back wall at -z, the camera on the +z side); bounds are half sizes as in `ARENAS` (11.5, 6.5 = a 23 x 13 m floor; the 3 current arenas are 14-17 x 9-10 m). Positions below are guides: P8-02 / P8-03 may move a piece up to 1 m to fit, keeping the zones. Item heights use the P7-02 bands (floor, table 0.4-1.1, wall / rack 1.1-1.8). Deck tops are 1.0, 1.5, 2.0, 2.5 or 3.0 m, never higher (the P4-06 camera was checked with a 3 m height difference). At most 10 placed items per level (`ITEM_MAX` 12 leaves room for brick drops and thrown pieces). Hazards always stand on the floor, never on a deck. A fall off a deck is the P3-07 rule (2.5 m: knockdown, 16 HP). No wet floor anywhere (owner removal).
  - Mode use: every level works in the 1v1 modes (Versus, Free Fight, Training, Tournament). 6 are brawler levels (P1-05); the Gym and the Pit are 1v1 levels only (Arcade rival and boss bouts, the Tournament's home). "Vertical" marks the levels P8-04 must give climbable and breakable surfaces.

    | Id | Level | Floor m (bounds) | Brawl waves | 1v1 ring x, z, hx, hz | Ring-out | Vertical (P8-04) | Hazards | Items | Bytes est. |
    |---|---|---|---|---|---|---|---|---|---|
    | warehouse | Industrial Warehouse (rework) | 23 x 13 (11.5, 6.5) | 4: 3, 4, 5, 6 | 0, 0, 6, 4 | no (walls) | yes: mezzanine 2.5 + stair; loading dock 1.0 collapses | panel, steam, load, glass | 10 | 6,800 |
    | dojo | City Fight Gym (rework of Traditional Dojo, id kept) | 20 x 12 (10, 6) | none | 1, 0.5, 4, 3.5 | yes (mat tape) | no: sparring ring 1.0 + mezzanine 2.5, no collapse (a glass balustrade breaks) | glass, panel | 6 | 5,700 |
    | pit | Underground Pit (rework) | 20 x 13 (10, 6.5) | none | 0, 0, 4.5, 3.5 | no (cage) | yes: street landing 2.5 + stair; rusty catwalk 2.5 collapses | fire x2, steam, glass | 10 | 6,300 |
    | rooftop | City Rooftop | 22 x 14 (11, 7) | 4: 3, 4, 5, 6 | 1, 0, 4, 4 | yes (helipad paint) | yes: water-tank deck 2.0 + stair; billboard catwalk 2.0 collapses | drop x2, panel, fire | 10 | 7,000 |
    | subway | Subway Station | 24 x 13 (12, 6.5) | 5: 3, 4, 5, 6, 6 | 0, -1.3, 6, 4.6 | no | yes: ticket-hall mezzanine 2.5 + escalator; repair scaffold 1.5 collapses | train, panel, glass | 8 | 6,600 |
    | garage | Parking Garage | 23 x 14 (11.5, 7) | 4: 3, 4, 5, 6 | 1, 1.5, 6, 4 | no | no: upper split deck 2.0 + ramp, no collapse | panel (EV charger), fire, glass | 10 | 6,200 |
    | construction | Construction Site | 24 x 14 (12, 7) | 5: 3, 4, 5, 6, 6 | -1, 1, 5.5, 4 | yes (slab edge) | yes: scaffold 3 bays x 2 tiers (1.5, 3.0), collapses by bay | drop, load, panel, fire | 10 | 6,100 |
    | club | Night Club | 22 x 14 (11, 7) | 5: 3, 4, 5, 6, 6 | 0, 1.2, 4.5, 3.5 | yes (dance-floor edge) | yes: DJ stage 1.0 breaks; VIP balcony 2.5 + stair | panel, glass, steam (CO2 jet) | 9 | 7,200 |

  - Bytes: about 51,900 for the 8 levels against the P1-05 gross 68,000 (the 3 reworked rows replace 7,812), so about 16,000 stay in reserve. Estimate per level = header, env and audio 700 + objects x 110 + prop lines x 100 + generator rows x 100 + items x 40 + hazards x 112 + waves x 70 + ring 60 (P1-05 unit costs). The 3 shared generators (deck look, stair, scaffold) are about 2,500 inside the P8 system-code estimate (10,000); the 14 new looks and 4 new materials are their own P1-05 rows (+6,300, +684). Every one of the 14 looks is used: dumpster, parked car, vending machine, market stall (newspaper kiosk), speaker stack, table, chair, shipping container, scaffold section, sofa, lockers, ATM, bus-stop glass, fire door.
  - Waves (brawler levels): rows `[count, x, z, rival]`. The first wave stands in the level at the start; the next walks in from its entry when at most 1 enemy of the previous wave is still up (the level is won when the last wave is down). Never more than 6 enemies up (`BRAWL_MAX_ENEMIES`); co-op adds 1 per extra player to each wave, capped at 6 (as P4-07). `rival` = a P1-06 preset id that leads the last wave (Arcade fills it; 0 elsewhere). Entries are doors, stairs and tunnel mouths outside the 1v1 ring.
  - 1v1 areas (P8-05): the ring rectangle is the fighting area. Ring-out off: the fighters are held inside it (the bounds become the ring). Ring-out on (Tournament with its ring-out setting; Versus and Free Fight as an option): bounds = ring + 1.5 m apron, and a fighter whose feet touch the floor outside the ring loses the round (the canon rule in P1-08; Budokai 3's Cell Games ring had no ring-outs, so the cage and walled levels have none). Items and hazards outside the ring are not placed in a 1v1; spawns are the ring centre +- `spawn` on x (which fighter takes which spot is drawn per match and swapped every round: "1v1 seat balance (P9 follow-up)" below). [Superseded by P17-08 (2026-11-03): "ring-out off: the fighters are held inside it" no longer holds; with ring-out off (and in Arcade, Survival and Training) a 1v1 has the whole room, and the ring walls stand only with the Ring-out setting on, on a level with a ring edge, or in a Tournament bout.]
  - Warehouse (rework; was 17 x 10 m, 9 objects, 7 items):
    - Layout: loading floor in the centre (x -5..5); west racking aisle (x -11.5..-7) with 2 steel pallet racks along z; east office block under a steel mezzanine (x 7..11.5, z -6.5..-3); loading-bay door front-west, fire door on the east wall, crane hoist over the centre-west.
    - Verticality: mezzanine `grate` deck 2.5 m (fixed) with an open front edge at z -3 (yellow stripe: a knock-off point) and a metal rail (y 2.5) on its west edge above the office window; steel stair 1.0 m wide, foot near (3.5, -4.2), climbing +x. Unstable: timber loading dock, `boards` deck 1.0 m at x -10..-7, z 2..5.5, wood, weak 3 (jump up; collapses to 0.22 m rubble).
    - Destructibles (19): 6 crates (wood), 2 cardboard stacks (paper, crate look), 2 pillars (concrete), shipping container (sheet metal, 2.6 m), dumpster (sheet metal), 2 pallet racks (metal, hpMul 2), office window (glass), mezzanine rail (metal), loading dock (wood deck), fire door (metal), workbench (table look, wood).
    - Items (10): pipe and chain on rack brackets (1.4); wrench and hammer on the workbench (0.9); bottle on a crate (0.95); extinguisher on a bracket by the fire door (1.3); crate, brick, skateboard and bin lid on the floor.
    - Hazards (4): panel on the east wall by the stair foot (chains to the steel stair, P9 rule R3); steam on the west wall blowing +x; load on the crane hoist (support post 1.7 m toward the front); glass = the office window.
    - Modes: brawler, 4 waves (entries: loading-bay door, fire door, down the mezzanine stair); 1v1 / Tournament ring in the centre, no ring-out. [Superseded by P17-08 (2026-11-03): the Tournament has the whole room too, with the ring only under the Ring-out setting (owner, 2026-11-03 15:11: "use the whole room for tournament").]
    - Look: warm sodium high-bay lights, dust in the air; audio as today.
  - City Fight Gym (rework of the Dojo per P1-07: a modern martial-arts gym; id stays `dojo`):
    - Layout: competition mat in the centre (taped 8 x 7 m square = the ring); west a raised sparring ring; east weights corner, 3 lockers and a mirror wall; back a glass-block window partition pair in front of the office corner and 2 makiwara posts (changed 2026-10-29 by the coordinator after the visual check: the rice-paper screens read as Japanese, not Modern Urban); front-east the entrance with a vending machine.
    - Verticality: sparring ring = `stage` deck 1.0 m (fixed) at x -9.6..-5.2, z -2.2..2.2, ropes = 3 metal rails (y 1.0, fixed), 4 steps at the front-east corner. Mezzanine office / viewing deck `slab` 2.5 m (fixed) at x 4..10, z -6..-3.6 with a stair on its west side and 2 glass balustrade panels (y 2.5) on the front edge: breaking one opens the edge (a fall). Not "vertical" for P8-04: nothing collapses.
    - Destructibles (15): 3 lockers (sheet metal), mirror wall (glass), 2 balustrade panels (glass), 2 glass-block partitions (tile, blocks look; changed 2026-10-29 by the coordinator after the visual check), 2 benches (wood), 2 makiwara posts (wood, hpMul 1.6), vending machine (plastic), shower-block pillar (tile), fire door (metal).
    - Items (6): 2 escrima sticks on a wall rack (1.4); broom on a bracket by the lockers (1.3); bottle on a bench (0.5); folding chair on the floor by the ring; extinguisher on a bracket by the door.
    - Hazards (2): glass = the mirror wall; panel = the fuse box beside the lockers (chains to the lockers, R3).
    - Modes: 1v1 only (no waves); Tournament ring-out yes (mat tape). [Superseded by P17-08 (2026-11-03): the Tournament has the whole room too, with the ring only under the Ring-out setting (owner, 2026-11-03 15:11: "use the whole room for tournament").]
    - Look: cool fluorescent strip lights, mirrors, bright mats; the orange paper lanterns go (P1-07); dry, close sound (reverb 0.5).
  - Underground Pit (rework; an old boiler-room fight club):
    - Layout: the pit in the centre inside chain-link cage rails with 2 gaps; back the boiler wall with steam pipes; west a makeshift bar (counter 1.05 m, standable); east the street stair down from a landing; the silhouette crowd behind the back line and along the west (cosmetic, P9 R8).
    - Verticality: street landing `grate` deck 2.5 m (fixed) at x 7..10, z -6.5..-3.5 with a stair climbing +x from x 4.5. Unstable: rusty catwalk, `grate` deck 2.5 m, sheet metal, weak 2, along the back (x -6..4, z -6.5..-5.3), joined to the landing (collapses: 2.5 m fall plus crush below).
    - Destructibles (16): 3 barriers (concrete), 2 pillars (one concrete, one brick), 3 cage rails (metal), observation glass (glass), bar counter (wood), sofa (wood), speaker stack (wood), catwalk (sheet-metal deck), 2 crates (wood), bin (plastic).
    - Items (10): bin lid (floor); chain and brick on barriers (0.85); pipe and wrench on pillar brackets (1.4, 1.3); crate and extinguisher (floor); 2 bottles on the bar (1.05); bat on a bracket behind the bar (1.3).
    - Hazards (4): 2 fire barrels (west and east of the cage), steam on the boiler wall, glass = the observation glass.
    - Modes: 1v1 only (no waves); Tournament ring inside the cage, no ring-out. [Superseded by P17-08 (2026-11-03): the Tournament has the whole room too, with the ring only under the Ring-out setting (owner, 2026-11-03 15:11: "use the whole room for tournament").]
    - Look: dark, warm barrel fire, one cold lamp cluster over the cage (as today, P1-07 keep).
  - City Rooftop (new):
    - Layout: open roof with a painted helipad square in the centre (the ring); brick parapet (barriers 0.85 m, standable) round the back and east edges with 2 gaps; the stair housing block (east-centre) with a fire door; lounge corner front-east (sofa, table, 2 chairs); 3 AC units and an electrical box west-centre; a lit billboard on posts at the back-west; chimney stack.
    - Verticality: water-tank deck `grate` 2.0 m (fixed) at x -11..-7, z -7..-3.5, stair on its east side. Unstable: billboard catwalk, `grate` deck 2.0 m, sheet metal, weak 2, at x -7..-3.5, z -7..-5.9 (1.1 m deep; the tank stair arrives at z -5.9..-4.9, beside it), joined to the tank deck. AC units (1.0 m) are jump-up stepping stones.
    - Destructibles (21): 5 parapet barriers (brick), 3 AC units (sheet metal, plain box), chimney (brick column), stair housing (concrete, hpMul 3), fire door (metal), sofa (wood), table and 2 chairs (plastic), 2 bins (plastic), stairwell glass door (glass), catwalk (sheet-metal deck), 2 billboard posts (metal).
    - Items (10): 2 bricks by the broken parapet (floor); bottle on the lounge table (0.75); skateboard and folding chair (floor); pipe on a billboard-post bracket (1.4); bin lid by the bins; wrench on an AC unit (1.0); extinguisher and broom on brackets on the stair housing (1.3).
    - Hazards (4): drop 1 in the back parapet gap (x -3..1, z about -6.4, a 1.2 m strip); drop 2 in the east gap (x about 10.4, z 2..5); panel = the electrical box (chains to the AC units, R3); fire = an oil-drum brazier at the north-east corner of the helipad (4.2, -2.6; moved from the lounge, see "P8-03 changes").
    - Modes: brawler, 4 waves (all from the stair-housing door, the last also from the tank deck); Tournament ring-out yes (helipad paint; both drops lie outside the ring). [Superseded by P17-08 (2026-11-03): the Tournament has the whole room too, with the ring only under the Ring-out setting (owner, 2026-11-03 15:11: "use the whole room for tournament").]
    - Look: night, deep blue sky, city-glow fog, warm billboard light; wind and distant traffic.
  - Subway Station (new):
    - Layout: a long platform; the track bed along the back (z -6.5..-4.1) with rails and warning lamps; yellow edge line; the west end is the ticket-hall mezzanine; the east end is a tunnel mouth with a repair scaffold; tiled pillars in two rows; benches, vending machines, an ATM, a newspaper kiosk and an advertising shelter on the platform.
    - Track: the engine has no floor below 0, so the track bed is at platform level (drawn as ballast and rails; the platform kerb is a drawn 0.25 m strip). The train is the P7-05 `train` row along x (yaw pi/2, hx 1.2 across, hz 12 along), every 1500 ticks (25 s) with the 2 s lamps.
    - Verticality: mezzanine `slab` 2.5 m (fixed) at x -12..-8, z -1..6.5, reached by a stopped escalator (stair 1.2 m wide, 10 steps, metal). Unstable: repair scaffold at the tunnel mouth (scaffold generator, 1 bay x 1 tier at 1.5 m, east end in front of the track).
    - Destructibles (17): 4 pillars (tile), 2 benches (metal, bench look), 2 vending machines (plastic), ATM (metal), advertising shelter (glass, bus-stop look), kiosk (wood, market-stall look), cardboard boxes (paper), 2 bins (plastic), service fire door (metal), scaffold section (metal) and its tier deck (wood).
    - Items (8): bin lid by a bin; bottle on a bench (0.5); broom and extinguisher on pillar brackets (1.3); skateboard (floor); pipe on the scaffold tier (1.5, host = the tier deck); wrench on the kiosk counter (0.9); chain by the escalator foot (floor).
    - Hazards (3): train; panel = the signal box at the tunnel mouth (chains to the scaffold section and the escalator, R3); glass = the advertising shelter.
    - Modes: brawler, 5 waves (entries: down the escalator, out of the tunnel along the track, the service door); 1v1 ring includes the platform edge and the near track (the train is the level's identity), no ring-out.
    - Look: cold fluorescent tubes, white tiles, red warning lamps; long reverb, low rumble.
  - Parking Garage (new):
    - Layout: lower deck with 2 rows of bays and 3 parked cars; 4 concrete pillars on a grid; ramp up the west side to an upper split deck at the back; lift lobby (glass) and stairwell fire door back-east; ticket booth (glass) with a barrier arm front-east; EV charging posts in the east bays; a dumpster corner.
    - Verticality: upper split deck `slab` 2.0 m (fixed) at x -11.5..2, z -7..-4.5, with 2 concrete kerb barriers (y 2.0) on its front edge and gaps between them; ramp = stair generator with the `ramp` look (0.2 m rise, 0.6 m run) along the west wall. Not "vertical" for P8-04: nothing collapses (the open edge gaps give 2 m falls).
    - Destructibles (18): 3 parked cars (sheet metal), 4 pillars (concrete), dumpster (sheet metal), pay machine (metal, ATM look), lift-lobby glass (glass, bus-stop look), ticket-booth glass (glass panel), barrier arm (metal rail), 2 kerb barriers (concrete, y 2.0), stairwell fire door (metal), 2 bins (plastic), cardboard boxes (paper).
    - Items (10): bat and wrench on car bonnets (0.9, host = the car); chain on the barrier arm (1.0); pipe, brick, crate and bin lid (floor); extinguisher on a pillar bracket (1.3); skateboard on the upper deck (2.0, host = the deck); bottle (floor by the booth).
    - Hazards (3): panel = an EV charging post (chains to the parked car beside it, R3); fire = an oil-drum brazier by the east pillar (5.6, 0.8; moved from the dumpster corner, see "P8-03 changes"); glass = the ticket booth.
    - Modes: brawler, 4 waves (entries: down the ramp, the stairwell door); 1v1 ring on the lower deck, no ring-out.
    - Look: green-white fluorescent tubes, grey concrete, low ceiling beams; strong echo; a hit car blinks its lights and sounds its alarm (cosmetic, P9 R8).
  - Construction Site (new):
    - Layout: poured slab in the centre (the ring); a scaffold against the unfinished building along the back; the open slab edge / lift-shaft opening on the east with barrier tape; site office container at the back-west corner with a window (moved from front-west, see "P8-03 changes"); crane hanging a pallet of bricks centre-left; brick stacks, cement bags, a sawhorse table, a portable toilet, mesh-fence rails front and west; the generator board beside the scaffold; a brazier.
    - Verticality: scaffold generator, 3 bays x 2 tiers (tier 1 at 1.5 m, tier 2 at 3.0 m, stepped back 1.2 m), along x -6..0 at the back, stair at the west end. Unstable: each tier deck is wood, weak 3; striking a bay's steel standard down (metal, hpMul 0.5) collapses that bay's tiers (falls plus crush below, P9 R6).
    - Destructibles (20): 3 scaffold sections (metal) and their 6 tier decks (wood), container (sheet metal) and its window (glass), 2 brick stacks (brick, 0.9 m, standable), 2 cement-bag piles (paper), sawhorse table (wood, table look), portable toilet (plastic), 2 fence rails (metal), crate (wood).
    - Items (10): hammer on the sawhorse table (0.9); wrench and a brick on a brick stack (0.9); a brick on the floor; pipe on tier 1 (1.5, host = the tier); chain on a fence rail (1.05); broom and extinguisher on container brackets (1.3); crate (floor); bottle on the table.
    - Hazards (4): drop = the east slab edge (x about 11, z -2..2); load = the crane pallet (support post toward the front); panel = the generator board (chains along the 3 scaffold sections, R3: anyone touching the frame is shocked); fire = the brazier.
    - Modes: brawler, 5 waves (entries: site gate front-west, down the scaffold stair, the boss on tier 2); Tournament ring-out yes (slab edge). [Superseded by P17-08 (2026-11-03): the Tournament has the whole room too, with the ring only under the Ring-out setting (owner, 2026-11-03 15:11: "use the whole room for tournament").]
    - Look: dusk, orange sky, white floodlights on the scaffold; wind, distant traffic, a radio.
  - Night Club (new):
    - Layout: the dance floor in the centre (lit squares by the floor shader; the ring); DJ stage across the back; VIP balcony on the east; bar counter along the west with 3 stools; 2 tables with chairs front-west; 2 mirrored tile pillars; fire-door exit east-front; front door west-front; the crowd silhouettes along the walls and the balcony (cosmetic, P9 R8).
    - Verticality: the stage that breaks: `stage` deck 1.0 m at x -5..5, z -7..-4.6, wood, hpMul 3, weak 4, 4 steps at the west end and 4 steps from the stage front at the east end (x 3.4..4.6, climbing toward the back; see "P8-03 changes"); 2 speaker stacks and the DJ table stand on it (`on` = the stage: they topple when it breaks). VIP balcony `slab` 2.5 m (fixed) at x 7.9..11, z -7..-1, stair along the east wall from the front (rail along its west side), 2 VIP sofas on it (y 2.5), 2 glass balustrade panels (y 2.5) on its west edge (break = an open edge).
    - Destructibles (20): stage (wood deck), 2 speaker stacks (wood), DJ table (table look, wood), bar counter (wood), 3 stools (plastic, chair look), 2 tables and 2 chairs (plastic), 2 VIP sofas (wood), 2 balustrade panels (glass), 2 pillars (tile), fire door (metal), beer crate (wood).
    - Items (9): 3 bottles (bar counter 1.05, two tables 0.75); folding chair by the stage (floor); bat on a bracket behind the bar (1.3); chain and bin lid by the fire door (floor); extinguisher on a bracket by the fire door (1.3); crate (beer crate, floor).
    - Hazards (3): panel = the stage power box at the stage's east end; glass = a VIP balustrade panel; steam = a CO2 jet cannon on the floor in front of the stage (-1.5, -2.6; moved from the stage front, see "P8-03 changes") blowing +z (a real club effect; the `steam` row with the CO2 look and sound).
    - Modes: brawler, 5 waves (bouncers first; entries: front door, fire door, down the VIP stair; the boss waits on the stage); Tournament ring-out yes (dance-floor edge). [Superseded by P17-08 (2026-11-03): the Tournament has the whole room too, with the ring only under the Ring-out setting (owner, 2026-11-03 15:11: "use the whole room for tournament").]
    - Look: dark room, coloured moving spotlights (magenta, blue, amber: real club lights, never on the fighters), strobe only through the P13-03 reduce-flashes setting; thumping bass, 124 bpm, short muffled reverb.
  - Data shape (P8-03 / P8-04 implement it; every field is optional, so the current rows keep working):
    - `objects` rows gain: `type: 'deck'` (a standable block: the collider runs from the floor to `h` like every collider, and is standable at any height, unlike `box`, which is standable only at 0.8-1.05 m; looks `slab`, `grate`, `boards`, `stage`, `ramp`, drawn by the shared deck generator: top, edge stripe, side face by look); `y` (an object standing on a deck: drawn from `y`, collider top `y + h`; only inside or on the edge of a deck footprint, because the collider still runs from the floor and the deck below is solid anyway); `on` (the id of what it rests on: it falls when that breaks, P9 rule R6); `weak` (the fighter-weight that breaks it, R7); `fixed: 1` (takes no damage: sturdy decks, their stairs, ropes).
    - Decks are solid down to the floor (their side is drawn as a wall, an office front, a cross-braced frame or mesh sheeting), so nobody walks under a deck. This keeps collision, `supportAt`, the camera line test and the CPU edge checks unchanged.
    - `builds` rows, expanded by `Arena.build` into plain `objects` rows before `makeObject` (ids `<id>.<n>`), so damage, breaking, debris and the self-tests see ordinary objects:
      - `['stair', id, x, z, dir, width, from, top, mat, look, on]`: steps from height `from` (0 = the floor, or a deck top) to `top`, the foot at (x, z), climbing toward `dir` (0 = +z, 1 = +x, 2 = -z, 3 = -x); each step a `deck` of 0.25 m rise (exactly the 0.25 m step-up tolerance of `resolveFighter`) and 0.35 m run, or 0.2 / 0.6 for the `ramp` look; fixed unless it belongs to a weak structure (then `on` it). It stores a `foot` and a `head` waypoint for the CPU.
      - `['scaffold', id, x, z, bays, tiers, stairSide]`: bays of 2.0 m (x) by 1.2 m (z) side by side from (x, z) toward +x. Per bay one `scaffold` look metal object (the collider is one 0.2 x 0.2 m standard at the bay's front middle, h = tiers x 1.5 + 1.0; the look draws the whole bay frame and sheeting), hpMul 0.5; per tier one wood `boards` deck `on` that standard, weak 3, tier k at k x 1.5 m and stepped back 1.2 m per tier (a collider is a column from the floor, so tiers are terraced); a stair at the `stairSide` end (-1 west, 1 east) to each tier, its steps `on` the tier below.
    - Level fields: `ring: [x, z, hx, hz, ringOut]` (P8-05), `waves: [[count, x, z, rival]]` (brawler levels only), `crowd: 1` (P9 R8 layer). Items keep `[id, x, z, height, host]` with a deck allowed as host. Hazards keep their rows.
    - CPU (P8-04): a CPU whose target stands more than 0.4 m above or below it walks to the nearest stair `foot` (or `head`), then along the stair; the P3-07 edge rule still stops it walking off. Item heights for the pick-up bands and the CPU's floor-item rule are measured from the picker's footing (today they use the absolute `y`), so items on decks work.
    - Limits per level: at most 24 authored objects, 40 generated step and deck objects, 60 colliders in all (hazard posts included), 10 placed items, deck tops at most 3.0 m.
  - P8-03 changes (decided 2026-10-29 by the coordinator; the owner can change any row). Hazard moves, one reason for all three: in CPU against CPU matches nobody used the dangers that stood 7 m or more from where the fights happen (0 of 12 seeds on the Rooftop and the Club, 2 of 12 in the Garage), and P7-05 asks the CPUs to use them; each now stands 3 to 4 m from the start line; the Rooftop and Garage fires are inside their 1v1 rings, the Club jet (z -2.6) is just outside the Club ring (z -2.3 and up). Rooftop fire (the brazier): lounge (9.0, 2.2) -> (4.2, -2.6). Garage fire: dumpster corner (-10.0, 3.9) -> (5.6, 0.8). Club steam jet: (1.0, -2.6) -> (-1.5, -2.6) (the sheet only says "at the stage front"), still blowing +z. The Subway keeps its signal-box panel at the tunnel mouth (R3 link); a CPU cannot strike a panel from outside its arc, so the Gym and the Subway are exempt from the "CPU uses a hazard in 3 of 12 seeds" check. Other changes to the sheets: the Rooftop catwalk is 1.1 m deep and the tank stair arrives beside it; the Construction site office stands at the back-west corner (the camera hid the player behind it at the front); the Club stage east steps come from the stage front, the VIP balcony starts at x 7.9 and has a stair rail; the Garage ramp has a railing (a CPU jumped at its side); the Subway repair scaffold bay spans x 8..10 (its stair x 10..11). CPU bait (P7-05, hazardBait): a Hard CPU may walk to the far side of a strike hazard (never a panel) and wait on guard; at most once per 1,800 ticks, ended when the target is within blow range on the way or the CPU is hit.
- System rules matrix (P9-01, decided 2026-10-29 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row). Generic rules: every source has a damage type, every object a material, every fighter a few states; the effect comes from the table, never from a per-level or per-object script. No wet / water rule (owner removal). P9-02 implements it.
  - Sources -> damage type: fists, feet and blunt weapons = blunt; the bottle and glass shards = sharp; a panel arc = electric; a fire barrel's spill and a burning object = fire; a thrown item, a thrown or knocked fighter, a landing = impact (for objects the existing `throw` / `impact` categories); a falling load, a falling piece and a collapsing deck's boards = crush; the train = impact x3 (breaks every object and item in its zone); steam and the CO2 jet = push only (no damage to objects).
  - Matrix (9 materials x 6 damage types; "x" = multiplier on `MATERIALS.mult`, a missing one is 1; blunt and impact keep today's punch / kick / heavy / throw / impact values; HP as in `MATERIALS`, the 4 new rows below):

    | Material | HP | Blunt | Sharp | Electric | Fire | Impact (thrown / fighter) | Crush | Breaks into |
    |---|---|---|---|---|---|---|---|---|
    | wood | 60 | breaks | x0.3 | - | ignites, burns 8 s | breaks (x1.8 / x1.3) | breaks x1.5 | planks, 0.22 m rubble |
    | concrete | 170 | breaks slowly | x0.1 | - | - | x1.5 / x1.0 | x1.2 | chunks, 0.55 m rubble |
    | metal | 110 | dents | x0.1 | conducts | - | x1.5 / x1.1 | x1.0 | rods |
    | glass | 16 | shatters | x1.0 | - | - | shatters (x2.4 / x2.2) | shatters x2.2 | shards (a glass-wall hazard leaves its shard strip) |
    | paper | 10 | tears | x1.6 | ignites (arc sparks) | ignites, burns 3 s | x2.4 / x2.2 | x2.2 | scraps |
    | brick | 140 | breaks | x0.1 | - | - | x1.6 / x1.2 | x1.3 | chunks in brick colour, 0.4 m rubble, plus 1 brick item |
    | plastic | 40 | breaks | x0.6 | ignites (arc sparks) | ignites, burns 5 s, black smoke | x1.6 / x1.4 | x1.6 | coloured shards |
    | tile | 50 | shatters | x0.3 | - | - | x1.8 / x1.6 | x1.6 | tile shards, 0.55 m core rubble |
    | sheet metal | 80 | dents | x0.4 | conducts | - | x1.4 / x1.2 | x1.4 | panels (a car: lights and alarm, cosmetic) |

  - New `MATERIALS` rows (P1-05's 4; resist, then punch / kick / heavy / throw / impact): brick 5, 0.4 / 0.75 / 1.2 / 1.6 / 1.2; plastic 1, 1.2 / 1.4 / 1.8 / 1.6 / 1.4; tile 2, 0.8 / 1.0 / 1.5 / 1.8 / 1.6; sheet metal 3, 0.6 / 0.9 / 1.2 / 1.4 / 1.2. Each row also gets `burn` (ticks, 0 = never), `cond` (1 = conducts) and `debris` (which of the 4 existing break recipes it uses: brick -> concrete, plastic -> wood, tile -> glass, sheet metal -> metal), so `breakObject` picks the recipe by data. Sheet metal and metal use the metal stage names (Dented, Bent).
  - Fighter states (one flag or timer each; they stack by plain rules, no pair needs special code):

    | State | Comes from | Effect | Ends | Combines |
    |---|---|---|---|---|
    | burning | 1 tick in a fire zone | 2 dmg every 20 ticks, no control change | 40 ticks after the last touch, a knockdown (stop, drop and roll) or an extinguisher cone | a burning fighter never ignites objects (keeps the fire cap) |
    | shocked | an arc, or a chained metal object it touches | the P7-05 shock: 14 dmg + 40-tick stun; drops a held metal item (pipe, hammer, wrench, chain, bin lid, extinguisher) | the stun ends | passes to a clinch or hold partner; a shocked fighter is stunned |
    | stunned | heavy hits, bottle shatter, guard break, shock | as today | as today | in a hazard zone it takes the full effect (it cannot block) |
    | airborne | jump, throw flight, fall | floor zones (fire, shards, steam, arc) skip a fighter whose feet are above 1.0 m over its footing (`HAZARD_HEIGHT`) | landing | a thrown fighter is an impact on what it hits; landing on a weak deck is a load hit (R7) |
    | downed | knockdown | shards (2 dmg), fire and crush still hit; only ground strikes | get-up | puts out burning |

  - Rules (one implementation function each):
    - R1 Damage routing: every object hit names its damage type and goes through `Arena.damageObject` (existing; new categories `sharp`, `crush`, `fire`); electric does no HP damage. Fighters take the same sources through the existing damage path (`hitObjects` for strikes on scenery, the HAZARDS handler `MatchSim.stepHazards` for zones).
    - R2 Breaks, shatters, dents: HP 0 -> `Arena.breakObject` (existing) with the material's `debris` recipe and rubble; hosted items fall (existing host rule); a broken brick object leaves 1 brick item; tile and glass leave a shard patch (the bottle-shard patch of `stepHazards`).
    - R3 Conducts: at `Arena.build`, `Arena.linkConductors` chains metal and sheet-metal objects whose footprints are within 0.3 m of each other or inside a panel's arc circle (at most 6 per chain; this reuses the hazard `links` field the wet floor used). When the panel arcs, every fighter within 0.4 m of a chained object is shocked once per activation. A thrown metal item sets a panel off (existing `metalOnly`).
    - R4 Fire: `Arena.stepFire`. A flammable object (`burn` > 0) ignites after 30 ticks in a fire zone or at once inside an arc circle (paper, plastic). A burning object loses its HP evenly over its `burn` time, breaks charred (dark colour) at 0, and is itself a fire zone of its half size + 0.5 m (a transient `fire` hazard with `life`, like the bottle shards). Spread: every 60 ticks each burning object ignites the nearest unburnt flammable object within 1.0 m (neighbour lists built once at `Arena.build`, ties to the lower index). A burning deck loses HP like any object, so a fire can drop a stage. The extinguisher cone (item special `spray`) puts out objects, fighters and a spilled fire barrel (its active phase ends).
    - R5 Thrown things: a thrown item hits objects with the `throw` category (glass shatters at x2.4) and hazards (metal sets off a panel); a thrown or knocked fighter is an `impact` (existing paths in `hitObjects` and the thrown-item hit).
    - R6 Supports and falls: `Arena.dropSupported`, called from `breakObject`. Everything `on` the broken object falls (decks, speakers, steps of a higher tier); a broken deck drops the fighters on it (P3-07 fall) and its hosted items. Each falling piece lands as crush on fighters and objects under its footprint + 0.3 m: fighters take 10 + 6 per metre fallen (at most 30) and are knocked down from 20; objects take crush damage, so a collapse can chain. Crush uses the falling-load branch of `stepHazards` (a one-shot zone, first-tick damage).
    - R7 Load: `Arena.stepLoad`, every 6 ticks. A `weak` deck counts the fighters standing on it (weight class 3-4 counts 2). At or over `weak` for 60 ticks: a 36-tick creak (shake and sound; the CPU steps off), then it breaks (R6). A knockdown landing or a thrown fighter landing on it is an impact of raw 20.
    - R8 Crowd and bystanders (Night Club, Pit; car alarms in the Garage): a renderer-only layer, `Crowd.react`, listening to `Events` (object break, knockdown, KO, hazard): bystanders within 3 m lean away or scatter for 2 s, cheer on a KO. Never colliders, never damaged, no simulation state, no random numbers (`hash01`), so seeded tests and online play are unaffected.
    - R9 CPU use (P9-02 "AI can cause it"): `considerHazard` grows into one trigger rule for all of the above: strike a trigger (panel, fire barrel, load support, scaffold standard, a weak deck's support) or knock the target toward its zone when the target stands in the zone it would make (hazard zone, conductor chain, crush footprint, weak deck).
  - P9-02 as built (2026-10-31, coordinator; the owner can change any row). One function per rule: R1 `Arena.damageObject` (new categories sharp, crush, electric; a panel's arc deals electric to its conductors: sparks and a shake, no hit points; the matrix multipliers are in `MATERIALS.mult`; a held bottle strikes scenery as sharp); R2 `Arena.breakObject` + `MatchSim.leaveBehind` (brick item, shard patch); R3 `Arena.linkConductors` (the chain of a panel, `h.chain`, folded into `hazardCovers`, so the zone, the shock, the warning and the CPU's keep-out all use it); R4 `MatchSim.stepFire` (with `ignite`, `burnObject`, `douse`); R5 the P7-05 paths (tests of P7-05); R6 `Arena.dropSupported`; R7 `MatchSim.stepLoad` (both as P8-04); R8 `Crowd.react`; R9 `AIController.considerHazard`.
    - DECIDE (a) `stepFire` and `leaveBehind` live in `MatchSim`, not `Arena`: they read hazards, fighters and items. (b) The fire barrel's pool keeps its P7-05 hit (4 per 20 ticks, a brief touch costs 4). A fighter catches fire only after `FIRE_STAY_TICKS` 20 in a fire zone; then it burns 2 per 20 ticks for up to 40 ticks after leaving (inside the zone only the zone's own hits count), and a knockdown or an extinguisher ends it. The fire is credited to whoever tipped the barrel, struck the panel or lit the object (`f.burnBy`, `blaze.by`), so the knock-out of a burning fighter goes to them. (c) Burning objects are a transient hazard `blaze` (rect, 1 per 20 ticks plus the burning state); a burning fighter never lights objects. (e) A car's alarm lamps are started through `Crowd.react(x, z, 'alarm', obj)`, like the crowd. (f) Marks lie at the height of the surface they are on (`mark(..., y)`); `match.drops` follow the ring filter of the hazards (no CPU scaffold plan outside the 1v1 ring). (d) No level hazard row was added; one object was (Dojo `binC`, plastic, in the panel's arc; not in the 1v1 ring). A first try in the Subway burned the CPU that struck that panel, which is the rule working, but it broke the P7-05 CPU check.
    - Where each rule triggers: R1 every level; R2 Pit (brick pillar), Subway and Club (tile pillars), Dojo (glass rails); R3 Dojo (the panel arcs into the three lockers); R4 Pit (barrel pool lights the speaker, which spreads to the bar), Dojo (the panel's arc lights the plastic bin); R6 Construction and Subway scaffolds, Club stage; R7 Warehouse dock, Rooftop and Pit catwalks, Club stage; R8 Pit and Club crowds, Garage cars; R9 Construction scaffold, Pit barrel, Dojo panel.
    - How a CPU causes each rule: R4 tips the barrel when the target stands in the pool it would make (P7-05), so the wood in the pool burns; R6 the new scaffold plan (`match.drops`: a pseudo hazard per standard, zone = the footprint of its decks + 0.6 m, up to 12 hardest blows 24 ticks apart, stands outside the zone; a blow that misses narrows the arrival radius, `p.miss`, which also fixes CPUs that stopped 0.19 m short of a post); R7 CPUs follow a target onto a weak deck and their weight breaks it (3 CPUs + 1 on the dock: creak at tick 143, break at 179); R3 a CPU cannot strike a panel from outside its 1.2 m arc (reach is 1.0 to 1.3 m), so it sets the panel off by the P7-05 lure (a throw into the post) and every CPU walks off a conductor when the panel warns; R1, R2, R5, R8 follow from these (a collapse crushes, burns and breaks things, the crowd reacts to every event).
    - P9-03: `Arena.marks`, a fixed pool of `MARK_MAX` 32 records (the oldest is reused), kinds scorch (burnt-out object, spent barrel pool), glass (expired bottle patch), dust (fallen deck piece); `Quality.limits.marks` 10 / 20 / 32 sets how many are drawn (the records are the same on every preset). Objects, rubble, cracks and items persist as before; a new round (Versus) re-places items and hazards only.
    - Performance: marks at most 32 flat instances in the alpha layer; a burning object 8 flame instances (at most 4 burn: 32), a burning fighter 4; no new draw calls (instances in existing batches); fire work every 10 ticks over at most 64 objects. Measured (headless Chrome, software GL, medium preset, `BREAKPOINT.benchmark(8)` that smashes the whole Rooftop every few seconds; before = HEAD 9d5d179, after = this change): peak instances 1v1 669 -> 705 (marks of the smashed Rooftop now drawn), brawl with 5 enemies 916 -> 919, draw calls 13 -> 13 and 13 -> 12, heap 9.5 -> 10.1 MB; the work times of that machine are too noisy to read (p50 2.0 -> 3.5 and 2.2 -> 1.7 ms, p95 spikes of 150 to 250 ms in both builds). With 100 marks made in the Pit, instances went 213 -> 222 (low, limit 10), 394 -> 414 (medium, 20), 394 -> 426 (high, 32): the pool keeps 32 and the preset draws its limit, no draw call is added. File size: stored LF `breakpoint.html` 1,040,259 -> 1,055,503 bytes (+15.2 KB against the 9,000 projected for the P9 line, which did not count the AI plan, the tests' API names and the theme edits; 0.5% over the 1.05 MB target, under the 1.2 MB budget; trimming it further would cut features, so it stays).
    - Balance check (2026-10-31, `SimRunner`, KAI against KAI, Hard, ring + hazards + items on as in Versus, 600 seeds per ring and build, HEAD 9d5d179 against this change; seat = how often P1 wins, 95% interval about 4 points): Rooftop P1 30.2% -> 30.7%, Garage 64.2% -> 62.2%, Construction 33.5% -> 33.8%, Warehouse (control) 53.3% -> 53.3%. Hazard damage as a share of all damage: Rooftop 0.74% -> 0.78%, Garage 2.34% -> 2.88%, Construction 7.76% -> 7.75%, Warehouse 1.91% -> 1.90%; hazard hits Rooftop 492 -> 539, Garage 1,620 -> 2,378 (afterburn hits of 2), Construction 715 -> 716. So the change moves no seat result outside the noise and adds 0.5 points of hazard share in the Garage at most; a brief touch of a barrel costs 4 as before. NOT part of this change: the seat bias itself (Rooftop 30%, Garage 64%, Construction 34% for P1 with the same fighter on both sides, already so at HEAD) comes from the P8 layouts (spawn sides, barrel and panel placement) and is outside the 40-60% band: for P14 / the end audit (done afterwards: "1v1 seat balance (P9 follow-up)" below). A hazards-on 1v1 fingerprint test now guards these rings ("Balance (P9)").
  - 1v1 seat balance (P9 follow-up, 2026-10-31, coordinator's brief; the owner can change any row). Rule: in a real 1v1 (ring, hazards and items on, the default) the same fighter on both sides wins about half the time from either seat; band 40-60% at Hard and Expert, 35-65% at Easy and Normal.
    - Cause, per ring (KAI against KAI, Hard, 300 seeds, hazards and items switched off one at a time): with both off the five rings measured (Warehouse, Rooftop, Subway, Garage, Construction) give P1 52-56%, the engine's seat-0-first update (about +4; left as it is, changing it moves every 1v1 fingerprint). The rest is layout, because the left start spot (ring centre - spawn) always belonged to P1. Rooftop: the one hazard in the ring is the fire barrel (4.2, -2.6), 2.7 m from the right start and 6.2 m from the left; hazards alone P1 31%, items alone 53%. Garage: items alone 69% (the crate at 0.6, 3.4 is 2.9 m from the left start and 3.6 from the right: the left seat picked it up 369 times in 150 matches, the right seat never); the barrel (5.6, 0.8) lies 2.1 m from the right start. Subway: items alone 73%, hazards 0.04% of the damage (bench bottles, pillar items and the skateboard lie nearer one start spot). Construction: the falling load (-3.5, 1.5) is 0.6 m from the left start spot, so the left fighter starts inside its zone (4,980 load damage to the left seat against 300 to the right in 150 matches); hazards alone 42%, items alone 44%. Warehouse (53%), Pit, Dojo and Club hold next to nothing in the ring and sat at 51-53%.
    - Fix, one rule for every ring: `MatchSim.startSide`. A 1v1 in a ring draws which start spot the first fighter takes from the match seed in round 1 (a multiplicative hash of the seed, no random number drawn) and swaps it every round, so each seat gets each side equally often over a match and over seeds, whatever a level's layout (levels added later too); facing follows the side. Brawls, Training and fights without a ring start on the left as before. Not done: mirroring the layouts. 10 of the 22 item rows inside the rings (crate, car, sawhorse and stack hosts, pillars at another x, blocked floor) have no host or free floor at the mirror point, the Garage and Construction rings are not centred on their cover, and the rows are shared with the brawl and Training, so a mirror needs new objects or moves the other modes. Layouts, AI and update order are unchanged.
    - Result (KAI against KAI, ring + hazards + items, seeds 1-600 per cell, P1 win % before > after; 95% interval +-3.5 to +-4.0 points; * = outside the band before; Expert Pit, Dojo and Club had 4 to 6 drawn matches in both builds, the rest none). All 32 cells after are inside the band (45.8 to 53.2):
      | Ring | Easy | Normal | Hard | Expert |
      |---|---|---|---|---|
      | Warehouse | 49.5 > 48.8 | 48.0 > 49.5 | 53.3 > 50.5 | 53.0 > 52.5 |
      | Dojo (City Fight Gym) | 53.8 > 53.0 | 49.2 > 48.5 | 51.2 > 51.2 | 52.8 > 52.5 |
      | Pit | 52.7 > 50.3 | 46.7 > 49.8 | 51.7 > 53.2 | 51.7 > 52.3 |
      | Rooftop | 54.5 > 49.8 | 49.0 > 48.2 | 30.7* > 49.0 | 40.5 > 46.3 |
      | Subway | 61.8 > 53.2 | 50.0 > 48.0 | 70.8* > 52.3 | 55.8 > 47.7 |
      | Garage | 58.8 > 51.8 | 57.0 > 45.8 | 62.2* > 47.3 | 73.3* > 48.8 |
      | Construction | 53.3 > 47.5 | 35.2 > 53.2 | 33.8* > 48.7 | 33.3* > 47.3 |
      | Club | 53.7 > 49.7 | 50.2 > 48.7 | 52.8 > 52.0 | 49.2 > 50.3 |
    - Mirror check (Hard, 600 seeds each way, KAI against MARA with the seats exchanged on the same seeds; seat edge = (P1 rate with KAI first + P1 rate with MARA first - 100) / 2, interval about +-2.6): before Warehouse +8.9, Dojo +1.5, Pit +0.1, Rooftop -13.6, Subway +14.8, Garage +18.8, Construction -23.8, Club -3.1; after -1.0, +1.6, -0.6, +2.3, -1.1, +1.1, +2.1, -0.7. KAI wins only 24 to 29% of its matches against MARA on Subway and Garage from either seat: a pairing effect of the layout, not a seat effect (for the end audit).
    - Left as it is: inside one round the fighter on the barrel or load side still has the nearer hazard (the seats alternate); the Construction load zone moved off the left start spot to the ring's middle line, zone (-1.0, 1.9), post (-1.0, 3.6), floor brick to (-2.6, 4.0) (owner, 2026-10-31; moved again on 2026-11-01 from zone (-1.0, 3.0), post (-1.0, 4.7), whose strike spots lay past the ring edge, and the CPU's strike spot now stays in the ring when ring-out is on; KAI against KAI over 600 seeds each, first fighter wins 50.0 / 48.0 / 50.2 / 51.7% at Easy to Expert and 48.7% at Hard with ring-out, loads per match 1.19 / 2.13 / 0.83 / 1.06 and 0.54, was 0.43 / 0.41 / 0.13 / 0.08 and 0.72; the 2026-10-31 position gave 47.0 / 48.8 / 47.7 / 49.5%; side effects of the 2026-11-01 change: in the Hard wave brawl KAI against MARA's crowd wins 13 of 80 seeds in 49 s on average, was 23 of 80 in 56 s, for P14-05; Rooftop with ring-out at Expert, first fighter 62 to 47.5% and 68 to 45 s over 200 seeds; lineups of 3 to 7 fighters still start inside the load zone, accepted because the load only falls after a strike and a warning; in the Hard wave brawl the computer's hero loses all 80 seeds before and after, in 75 s then 80 s on average); Expert on Pit, Dojo and Club averages about 190 s per match (4 to 6 of 600 end drawn) in both builds, so the cause is not this change.
    - Tests: "Balance (P9)" start side (50 seeds x 8 rings x 4 rounds, no random number, Training / brawl / no ring on the left); the hazards-on fingerprints re-recorded (all three rings changed because the side is now drawn: with the side forced to the left the three old hashes came out again). Review lows of P9 fixed in the same change: a still-burning object at a new round keeps its fire zone and the credit of whoever lit it ("Rules R4 (P9 review)"); the flecks of a broken bottle and the dust of a fallen deck piece lie on the surface under them, not at floor height ("Marks (P9 review)"). File size: stored LF `breakpoint.html` 1,055,503 -> 1,056,586 bytes (+1,083). 395/395 browser self-tests.
  - Performance caps (P8-06 sets the per-preset debris values): at most 4 burning objects (further ignitions wait); spread every 60 ticks and ignition checks every 10 ticks over the prebuilt neighbour lists (no all-pairs per tick); conductor chains built once per level, at most 6 objects; at most 8 falling pieces at once and 4 crush landings per tick (the rest the next tick); at most 8 transient zones (burning objects) besides the 6 shard patches (`HAZARD_SHARD_MAX`); load checks every 6 ticks; debris stays under `DEBRIS_MAX` 220. The new rules draw no random numbers except the debris recipes (`simRng`, as today), so P12 determinism holds. Code estimate: the P1-05 P9 line (9,000 bytes).
- Story lists (P10-01, decided 2026-10-29 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row). The P1-05 counts: 64 countries in 10 regions, 24 origins, 24 goals. Every country, origin and goal of the 32 presets (P1-06) is in the lists with the same spelling, so the `ROSTER` story fields map by name.
  - Rules: each list is an append-only array (the share code stores the index, P6-10; a row is never moved or deleted). Saves store stable ids: country = ISO 3166-1 alpha-2 code, origin and goal = the short ids below. Plain ASCII only (Sao Paulo, Malmo). No national stereotypes: a country gives the text its city and the beats its region, nothing else; the style never follows the country (P1-06). Story settings change text, cutscene poses, rivals, the boss order, the stage order and rewards; they never change stats or a fight rule, so P14-02 has nothing to balance for them. The whole Arcade run takes place in the fighter's city (`{city}`); "the title" is that city's belt.
  - Defaults (a fighter without story fields: old customs and codes, `randomCustom`): CA, gymkid, title (KAI's settings). The creator's Randomize draws all three from its own stream, as `randomBody` does.
  - Countries (list order = this table, row by row, left to right; index 0 = Canada; region index = row 0 to 9). Region effects: the region line is the first box of B1 (`{city}` = the country's city); the home level is Arcade stage 1 and leaves the stage 3 / 5 pool (P10-02); the sign hue tints posters, billboard and kiosk faces in every level of the run (a matte colour only); the region index turns the boss order.

    Text note (2026-11-02): the owner asked for the story to read as written by a person, so every line was rewritten in `breakpoint.html`. The quoted lines in these tables are the first version; the `STORY_*` tables in the game hold the current text, and the structure, ids, poses and limits below are unchanged.

    | Region (tag) | Home level | Sign hue | Region line (B1) | Countries (id, city) |
    |---|---|---|---|---|
    | North America and Caribbean (nam) | garage | #f2a33a amber | "{city}: big lights, small gyms and a fight on every block." | Canada (CA, Toronto); USA (US, Detroit); Mexico (MX, Mexico City); Jamaica (JM, Kingston); Cuba (CU, Havana); Dominican Republic (DO, Santo Domingo) |
    | South America (sam) | construction | #3ec46d green | "{city} builds fast and hits hard. You grew up in the noise." | Brazil (BR, Sao Paulo); Argentina (AR, Buenos Aires); Colombia (CO, Medellin); Chile (CL, Santiago); Peru (PE, Lima); Venezuela (VE, Caracas) |
    | Western Europe (weu) | subway | #4a8fe0 blue | "In {city} the real fights start after the last train." | UK (GB, London); Ireland (IE, Dublin); France (FR, Marseille); Netherlands (NL, Rotterdam); Belgium (BE, Antwerp); Germany (DE, Hamburg) |
    | Southern Europe (seu) | warehouse | #e8573c red | "{city} by the sea: hot nights, old docks, loud crowds." | Spain (ES, Barcelona); Portugal (PT, Lisbon); Italy (IT, Naples); Greece (GR, Athens); Croatia (HR, Split); Serbia (RS, Belgrade) |
    | Nordic and Eastern Europe (neu) | warehouse | #9fb4c8 steel | "Long winters in {city}. The gym was the warmest room in town." | Sweden (SE, Malmo); Norway (NO, Oslo); Finland (FI, Helsinki); Poland (PL, Gdansk); Ukraine (UA, Odesa); Romania (RO, Bucharest); Czechia (CZ, Prague) |
    | Caucasus and Central Asia (cau) | construction | #c9a24a ochre | "In {city} old wrestling halls stand between new towers." | Georgia (GE, Tbilisi); Armenia (AM, Yerevan); Azerbaijan (AZ, Baku); Kazakhstan (KZ, Almaty); Uzbekistan (UZ, Tashkent); Kyrgyzstan (KG, Bishkek) |
    | Middle East and North Africa (mea) | garage | #e0c35a sand | "{city} never sleeps, and neither do its street fights." | Israel (IL, Tel Aviv); Turkey (TR, Istanbul); Lebanon (LB, Beirut); Egypt (EG, Cairo); Morocco (MA, Casablanca); Tunisia (TN, Tunis) |
    | Sub-Saharan Africa (afr) | warehouse | #f07d2a orange | "{city} is crowded, quick and proud. So are its fighters." | Nigeria (NG, Lagos); South Africa (ZA, Durban); Ghana (GH, Accra); Kenya (KE, Nairobi); Senegal (SN, Dakar); Ethiopia (ET, Addis Ababa); Cameroon (CM, Douala) |
    | South and Southeast Asia (sas) | subway | #e04a8f magenta | "In {city} the crowds never end, and neither does the competition." | India (IN, Mumbai); Pakistan (PK, Karachi); Thailand (TH, Bangkok); Vietnam (VN, Ho Chi Minh City); Philippines (PH, Manila); Indonesia (ID, Jakarta); Malaysia (MY, Kuala Lumpur) |
    | East Asia and Oceania (eao) | subway | #39c6d6 teal | "{city}: neon, night trains and fight clubs nobody talks about." | Japan (JP, Osaka); China (CN, Shanghai); South Korea (KR, Busan); Mongolia (MN, Ulaanbaatar); Australia (AU, Sydney); New Zealand (NZ, Auckland); Samoa (WS, Apia) |

  - Origins (list order = the P1-06 proposed order). Origin effect: its line is the fighter's box in B1 (first person, at most 64 characters); its tone picks the variant of every tone-keyed beat, rival B, the B1 pose and a preset's intro emote (tone table below).

    | # | Id | Origin | Line (B1) | Tone |
    |---|---|---|---|---|
    | 0 | gymkid | Gym kid | "I grew up sweeping the floor of a boxing gym." | ordinary |
    | 1 | working | Working class | "Two jobs in my family. Nobody ever took a day off." | ordinary |
    | 2 | wealthy | Wealthy family | "Private tutors, a big house, and something to prove." | strict |
    | 3 | immigrant | Immigrant family | "New country, new language. I learned to stand up early." | rough |
    | 4 | military | Military family | "Base to base, and drills before breakfast." | strict |
    | 5 | foster | Foster care | "Six homes by sixteen. I don't trust easily." | rough |
    | 6 | smalltown | Small town | "Everyone back home knows my name. Nobody thought I'd leave." | ordinary |
    | 7 | street | Big-city street | "Raised on corners and rooftops. Quick hands, quicker eyes." | rough |
    | 8 | sports | Sports family | "Medals on every wall. Second place counts as losing." | strict |
    | 9 | dropout | College dropout | "I left the lecture hall for the mat." | ordinary |
    | 10 | office | Office worker | "Desk by day, gym by night." | ordinary |
    | 11 | police | Police family | "My parents wore the badge. I know the rules and where they bend." | strict |
    | 12 | martial | Martial arts family | "The family school comes first. Always." | strict |
    | 13 | singleparent | Single parent | "One tired, stubborn parent raised me. I got the stubborn part." | rough |
    | 14 | nightshift | Night-shift worker | "I work while the city sleeps." | rough |
    | 15 | delivery | Delivery rider | "I know every street and every shortcut in town." | rough |
    | 16 | farm | Farm family | "Up at five. Real work made me strong." | ordinary |
    | 17 | restaurant | Restaurant family | "I grew up in a busy kitchen. I feed everyone." | ordinary |
    | 18 | bouncer | Bouncer family | "Door work runs in my family." | ordinary |
    | 19 | boarding | Boarding school | "Raised by rules, bells and dormitories." | strict |
    | 20 | orphanage | Orphanage | "No family name to carry, so I'm making one." | rough |
    | 21 | port | Port town | "Docks, cranes and rough bars. That was my school." | rough |
    | 22 | teacher | Teacher's child | "Homework first, fights never. Until now." | strict |
    | 23 | famous | Famous parents | "I grew up in the papers. I want a name of my own." | strict |

    | Tone (8 origins each) | Voice of the tone-keyed beats | Rival B (first that is neither rival A nor the player) | B1 pose | Preset intro emote |
    |---|---|---|---|---|
    | rough | blunt, short sentences, street words, no swearing | ROXY, DIEGO, KELSEY, GIORGI, FEMKE, DEACON | crossed_arms | crossed_arms |
    | ordinary | warm and plain | DIEGO, KELSEY, ROXY, GIORGI, FEMKE, DEACON | idle_relaxed | glove_tap |
    | strict | formal and disciplined | KELSEY, FEMKE, GIORGI, ROXY, DIEGO, DEACON | nod | nod |

  - Goals (list order = the P1-06 proposed order). Goal effect: the motive picks rival A, rival A's lines and the ending pose; the arc gives three boxes, B2 (set-up), B10 (midpoint) and B14 (ending), each one box written from the hint (at most 90 characters, spoken by the fighter); the first Arcade clear with that goal (any fighter carrying it, presets included) gives the reward (P10-05). The line is the creator hint (at most 60 characters). Thrill seeking is the ideas file's "psychopath", kept non-gory: the rush of a fair fight, nobody harmed outside it.

    | # | Id | Goal | Line (creator hint) | Motive | Arc hint: set-up / midpoint / ending | Clear reward |
    |---|---|---|---|---|---|---|
    | 0 | loseweight | Lose weight | The doctor said lose weight. The gym said fight. | body | winded on the gym stairs, signs up anyway / a belt notch tighter, takes the Pit stairs two at a time / the scale at home says down again, and still unbeaten | track jacket |
    | 1 | friends | Make friends | New in town, and nobody to call. | bond | eats alone after the first fight / rival A says hello in the street / the rivals take a group photo on the rooftop (rival A stands in the ending shot) | board shorts |
    | 2 | revenge | Revenge | Someone hurt a person I love. I want a reckoning. | past | names the crew that did it / learns it was ZERO's crew / wins, then turns and walks away: no violence after the bell | leather gloves |
    | 3 | title | Win the title | The city belt. Nothing else matters. | title | wants the belt / the champion knows the name now / holds the belt up over the city lights | leather jacket |
    | 4 | worth | Prove worth | Everyone said I wasn't good enough. | body | turned away by every gym / the doubters go quiet / signs a sponsor deal with their own name on it | chest_pound (emote) |
    | 5 | protect | Protect family | Threats at home. I end them in the ring. | family | a threat left at the family's door / the family moves somewhere safe / everyone safe at one table | boxing headgear |
    | 6 | debt | Pay a debt | I owe the wrong people. Prize money pays. | past | a deadline from the lenders / half paid after the Pit / tears up the note | work boots |
    | 7 | mentor | Honor a mentor | My coach's last wish: win the city title. | bond | a promise at the coach's photo / wears the coach's old wraps / leaves the belt by the photo | bag gloves |
    | 8 | redemption | Redemption | I made mistakes. Time to make them right. | past | an old wrong to fix / the person they hurt watches from the crowd / shakes that person's hand | wave (emote) |
    | 9 | fame | Fame | A million followers, one fight at a time. | fame | counts followers / the clips go viral / turns the buzzing phone off and enjoys the view | chain |
    | 10 | escape | Escape the past | New city, new name, new start. | past | arrives with one bag / the past catches up at the Pit / drops the old jacket from the roof and walks away free | balaclava |
    | 11 | thrill | Thrill seeking | I live for the rush of a real fight. | fame | bored of easy fights / every fight bigger, still not enough / shrugs at the belt and asks where the next fight is | laugh (emote) |
    | 12 | undefeated | Stay undefeated | Never lost. Not starting now. | title | a perfect record / a close call at the Pit, the record holds / record intact, walks off without looking back | sunglasses |
    | 13 | neighborhood | Defend the neighborhood | A gang pushes my street around. Not anymore. | bond | the gang's tags on the walls / the gang's boss is seen at the Pit / a street party, the tags painted over | bomber |
    | 14 | champion | Beat the champion | Only one opponent matters: ZERO. | title | ZERO on a poster / ZERO's crew starts to worry / stands over the champion, then asks for a rematch | point (emote) |
    | 15 | kids | Teach the kids | My free class needs money to stay open. | bond | the class may close / the kids watch the fights on a phone / teaches the kids the winning move | neck_crack (emote) |
    | 16 | lasttitle | One last title | Old knees, one more run. | title | the last run / the body aches, the heart doesn't / hangs the gloves on the rooftop rail, smiling | towel |
    | 17 | fit | Get fit | I want a body that can go twelve rounds. | body | out of breath after one round / breathing easier each night / runs up the rooftop stairs after the final, not winded | high-tops |
    | 18 | provide | Provide for family | The rent is due. The prize money isn't. | family | the rent is late / the first prize goes home / buys the family a proper dinner | cargo pants |
    | 19 | proud | Make family proud | My family has never seen me fight. | family | the family won't watch / the family calls after the Pit / the family in the front row on the rooftop | jersey |
    | 20 | wrong | Prove them wrong | An old coach said I'd never make it. | body | the coach said never / sends the coach a photo from the Pit / the coach claps in the crowd | shrug (emote) |
    | 21 | respect | Earn respect | Nobody in this city takes me seriously. | fame | laughed out of a gym / rivals nod in the street / ZERO bows first | fist_bump (emote) |
    | 22 | sibling | Find a lost sibling | My sibling vanished into the fight scene. | family | a missing sibling somewhere in the city's fight clubs / a photo turns up at the Pit / the sibling is in the rooftop crowd, they hug | beckon (emote) |
    | 23 | legacy | Leave a legacy | I want a name that outlives me. | fame | a name to build / kids copy the stance / opens a gym with the prize money | chest piece |

    | Motive (4 goals each) | Rival A (stages 2 and 6) | B4 pose | B4 challenge (rival A) | B5 when beaten (rival A, pose kneel) | B10 pose (P) | B14 ending pose (P) |
    |---|---|---|---|---|---|---|
    | title | DEACON | point | "The title's mine one last time. Go home, kid." | "Fair. Hit like that up top and you might just do it." | glove_tap | arms (victory) |
    | body | FEMKE | crossed_arms | "This isn't a fitness class. Leave the ring to athletes." | "Okay. You trained. I'll give you that." | idle_tired | flex (victory) |
    | fame | DIEGO | phone | "Smile, you're live on my channel. This one gets views." | "Stop the stream. Stop it!" | phone | fist (victory) |
    | past | KELSEY | think | "I know that look. Running from something? So was I." | "Whatever you carry, put it down. It's lighter that way." | head_down | shake_out |
    | family | GIORGI | argue | "Everyone fights for family. Show me yours is enough." | "Go. They're waiting for you." | plead | wave |
    | bond | ROXY | laugh | "Friends, kids, mentors. Cute. I'm here for the fun part." | "Ha! Finally someone worth the bus fare." | shake_out | fist_bump (rival A in the shot) |

    When the player is rival A, the rival of the next motive in this table's order is used (bond wraps to title).
- Arcade story structure (P10-02, with the P10-06 hybrid; decided 2026-10-29 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row). Replaces the 5-bout ladder of "Preset roster (P5-04)" (`Game.ladderFor`). Single player only; Co-op Brawl stays its own mode.
  - Stages (7 per run, 4 brawls and 3 1v1 bouts; every one of the 8 levels can appear):

    | Stage | Fight | Level | Opponents | Beats before | Beats after |
    |---|---|---|---|---|---|
    | 1 | brawl, the level's first 3 wave rows | home level (region) | grunts | B1 Prologue, B2 Goal | B3 Word spreads |
    | 2 | 1v1 | dojo (City Fight Gym) | rival A (motive) | B4 Challenge | B5 Beaten + choice |
    | 3 | brawl, all waves | brawl pool, first | grunts; rival B leads the last wave | B6 Into the city; B7 when the last wave enters (the fight pauses) | - |
    | 4 | 1v1 | pit | boss | B8 Setback, B9 Boss | B10 Midpoint |
    | 5 | brawl, all waves | brawl pool, second | grunts | B11 Invitation | - |
    | 6 | brawl, all 5 waves | club | grunts; after "Walk away" rival A leads the last wave; after "Offer a hand" the first wave has 1 enemy less and rival A is not there | B12 Club | - |
    | 7 | 1v1 | rooftop | ZERO | B13 Champion | B14 Ending + reward toast, B16 Epilogue |

  - Pool and boss: warehouse, subway, garage, construction minus the home level leaves 3 (`left`); stage 3 = left[c mod 3], stage 5 = left[(c + 1) mod 3], c = Arcade clears before the run (`run.clears`), so later runs show the third one. Boss = [HAO, MARLON, YOAV][(region index + c) mod 3], the next one when it is the player's fighter. Rivals, boss and levels are fixed when the run starts.
  - Fight rules: 1v1 bouts are 2 wins, 60 s, never ring-out in Arcade; items and hazards follow the settings (inside the ring only, P8-05). Brawls use the level's waves (P8-01; the `rival` field gets rival B in stage 3, rival A in stage 6 after "Walk away"). CPU strength: the Arcade difficulty for every stage; the boss and ZERO keep the 1.0 boss tuning (`bossAttrs` for ZERO only). A rival or boss knocked out as a wave leader counts as beaten (P10-05). A lost stage plays B15, then Continue (retry the stage; counted as today for `arcadeFewestContinues`) or Quit. [Superseded by P17-08 (2026-11-03): an Arcade stage fight has the whole room, not the ring; items and hazards are placed anywhere in it.]
  - Saving: after each won stage the run is saved in Progress (`arcadeRun`, P10-05) and the main menu offers "Continue Arcade"; starting a new run replaces it. Reason: a full run takes about 20 minutes, too long for one phone session.
  - Beats (16). Speakers: N = narrator (no body, box at the top, wide shot), P = the player's fighter, R = rival A, R2 = rival B, B = boss, Z = ZERO. Poses are ids of the P5-05 list below.

    | Beat | When | Variant key | Boxes (speaker: source) | Camera; poses |
    |---|---|---|---|---|
    | B1 Prologue | before stage 1 | region, origin | N: region line; P: origin line | wide, then close on P; P by tone (crossed_arms / idle_relaxed / nod) |
    | B2 Goal | before stage 1 | goal | P: goal set-up | close; think |
    | B3 Word spreads | after stage 1 | tone | N: tone text | wide; P phone |
    | B4 Challenge | before stage 2 | motive | R: challenge | two; R by motive, P crossed_arms |
    | B5 Beaten | after stage 2 | motive, result | R: beaten line; with result flawless (no round lost) R: "Not even one round. Who trained you?"; then the choice | two; R kneel; "Offer a hand": P help_up, R handshake; "Walk away": P defeat_turn |
    | B6 Into the city | before stage 3 | tone | P: tone text | wide; P by tone |
    | B7 Rival B | stage 3, last wave entry | tone | R2: tone text | close on R2; by tone |
    | B8 Setback | before stage 4 | tone | N: tone text | wide; P by tone |
    | B9 Boss | before stage 4 | boss | B: boss line | two; B by boss, P crossed_arms |
    | B10 Midpoint | after stage 4 | goal, motive | P: goal midpoint | close; P by motive |
    | B11 Invitation | before stage 5 | tone | N: tone text | wide; P by tone |
    | B12 Club | before stage 6 | choice | R: hand or walk line | two; hand: R fist_bump; walk: R angry |
    | B13 Champion | before stage 7 | tone | Z: tone text | two; Z by tone, P glove_tap |
    | B14 Ending | after stage 7 | goal, motive | P: goal ending; then the reward toast (first clear with that goal) | close, then wide; P motive ending pose, Z defeat_slump |
    | B15 Get up | after a lost stage | tone | P: tone text | close; P by tone |
    | B16 Epilogue | after B14 | tone, continues | N: tone text; with 1 or more continues N: "It took {continues} tries. Nobody remembers that part." | wide of the home level; P by tone |

    | Beat | rough | ordinary | strict |
    |---|---|---|---|
    | B3 (N) | "Word gets round fast. Someone filmed it. Now the street knows your face." | "Next morning the whole block is talking. Your phone won't stop buzzing." | "A message: an invitation to the City Fight Gym. Proper rules. Proper rivals." |
    | B6 (P) | "New part of town, same rules. Keep moving, keep swinging." (neck_crack) | "Never been this far across {city}. Let's see what they've got." (idle_stretch) | "Stay calm. Breathe. Do it the way you trained." (nod) |
    | B7 (R2) | "These are my streets. You're just visiting." (beckon) | "Heard you were coming. Didn't think you'd get this far." (laugh) | "No referee here. Let's see what your training is worth." (crossed_arms) |
    | B8 (N) | "Bruised and broke, you sleep on a friend's sofa. At dawn, a note: 'The Pit. Tonight.'" (sit_floor) | "One night at home: hot food, ice on the ribs, and a flyer for the Pit under the door." (idle_tired) | "Your old coach calls: 'The Pit is no gym. Keep your guard up.'" (phone) |
    | B11 (N) | "A car waits outside the Pit: 'The champion wants you. Get past the crew first.'" (shocked) | "A ticket to the champion's club night, and a crowd paid to stop you on the way." (phone) | "A formal reply: the champion accepts. The champion's crew does not." (think) |
    | B13 (Z) | "Street fighter. I've beaten a hundred like you. You're a hundred and one." (laugh) | "You came all this way. Shame it ends on a rooftop." (shrug) | "Discipline against discipline. Only one of us stays undefeated." (bow) |
    | B15 (P) | "Been knocked down my whole life. Getting up is the easy part." (kneel) | "Okay. Deep breath. Again." (head_down) | "Find the mistake. Fix it. Again." (idle_tired) |
    | B16 (N) | "Next day the kids on the corner know your name. Not bad for a nobody from {city}." (idle_relaxed) | "The whole street throws a party. You fall asleep before the cake." (laugh) | "A new photo goes on the wall in {city}. This one is yours." (nod) |

    - B12: hand: "You gave me a hand. Here's mine: the back door's open. Go."; walk: "You walked away from me. Big mistake. Round two."
    - B9: HAO "Fifty years of training. You have one night. Begin." (bow); MARLON "Down here nobody bows. We just finish." (beckon); YOAV "No rules, no referee. Just the next ten seconds." (glove_tap).
  - Story rules (data, `STORY_RULES` rows `[condition, effect]`; P10-03 evaluates them, no per-character code): region -> stage 1 level, sign hue, boss order, B1 first box; tone -> rival B, the tone-keyed beats, B1 pose; motive -> rival A, B4 / B5 lines and poses, B10 and B14 poses; goal -> B2, B10, B14 text and the reward; `goal:friends` -> rival A stands in the B14 shot; `goal:revenge` -> B14 ends with P turning away; `choice:hand` -> stage 6 first wave -1 and no rival A, B12 hand line; `choice:walk` -> rival A leads stage 6's last wave, B12 walk line; `result:flawless` -> the extra B5 box; `continues:>=1` -> the extra B16 box. Condition grammar: `region:<tag>`, `tone:<tag>`, `motive:<tag>`, `goal:<id>`, `origin:<id>`, `choice:hand|walk`, `result:flawless`, `continues:>=1`. When two rows fill the same slot the more specific wins (goal and origin over motive and region over tone, choice and result), ties to the first row. Tokens: {name} {city} {rival} {rival2} {boss} {continues}.
  - Endings: one per goal (B14 from the goal's ending hint, the motive's ending pose, the reward), then B16 by tone. A run that used continues adds the B16 box; there is no bad ending (a lost run just ends with Quit).
  - Mini cutscenes (P10-04):
    - In-engine: the stage's level is loaded and the cast stands in its 1v1 ring (P at x -1.2, the other at +1.2, facing each other). No sim ticks, no `simRng` draws, nothing written into a match; normal renderer, and each box may force one of the P6-09 looks (rested, hurt, tired, panting, angry, win, shocked) on its speaker.
    - Data: a `CUTSCENES` row per beat `[beat, cam, cast]`, boxes `[speaker, pose, look, textKey]`; text keys look up the story tables (about 120 bytes a beat, P1-05).
    - Camera: three presets, `wide` (the level's 1v1 framing pulled back x1.5), `two` (two-shot at chest height, 3.5 m), `close` (the speaker's head and shoulders, 1.6 m, 20 degrees off axis); a cut on a speaker change, a 0.5 s ease, no camera paths. Poses blend in over 0.3 s and loop their small motion while the box shows.
    - Skip: Punch, Kick, A, Enter, Space or a tap on the box = next box; Pause, Start, Esc or the Skip chip (top right, where the pause button sits) = end the beat (a pending choice still asks). Setting "Story scenes": Full (default) / Short (only the first box of each beat; choices still asked) / Off (no scenes; the choice is "Offer a hand"; rewards still given). Setting "Auto-advance": off by default; on = a box stays 2.5 s + 0.04 s per character, at most 6 s.
    - Choice (B5): two full-width buttons, "Offer a hand" and "Walk away", at least 44 px tall; Left / Right or Up / Down plus confirm on keys and pad; no timer.
    - Mobile text: the box is at the bottom (top for N), at most 30 percent of the height; at most 2 lines; at most 90 characters once tokens hold their longest value (city 16, name 10, rival and boss 6); speaker name in its colour; font at least 16 CSS px at 640 x 360; white on 80 percent black. At most 3 boxes a beat. A self-test checks every text row against the limit and every pose id against the list. Full scenes take about 2.5 minutes a run at a normal reading speed.
  - Non-combat pose list (the list P5-05 waits for): 28 new poses (`STORY_POSES`, `makePose` rows of joint targets plus at most one looping joint wave, about 350 bytes each, P1-05) + the 6 existing `VICTORY_POSES` = 34. Where they play: cutscenes; the round intro (each fighter its intro emote for 1.2 s during the countdown); the round end (winner = its style's victory pose as today; a loser by time-out or ring-out plays defeat_slump; a KO loser stays down); character select, creator preview and results (idles and emotes). Never during play: no input plays them and no CPU taunts mid-fight, so the simulation, the seeded fingerprints and online play are untouched. Intro emotes (creator Intro row, P6-10): nod, glove_tap, shake_out, crossed_arms open; wave, point, fist_bump, beckon, chest_pound, neck_crack, shrug, laugh are goal rewards (P10-05). Props: only `phone` holds one small matte box (1 part). Cutscenes use any pose whatever is unlocked.

    | Id | Group | Description | Used in |
    |---|---|---|---|
    | nod | greeting | small head nod, hands low | B1 / B6 / B16 strict, intro |
    | wave | greeting | one hand raised, waving | B14 family, intro (reward) |
    | point | greeting | arm straight, finger at the other fighter | B4 DEACON, intro (reward) |
    | fist_bump | greeting | fist held forward at chest height | B12 hand, B14 bond, intro (reward) |
    | handshake | greeting | open hand held out, slight lean | B5 hand (rival) |
    | help_up | greeting | leans down, arm reaching to a downed fighter | B5 hand (player) |
    | beckon | taunt | palm up, fingers curl twice: "come on" | B7 rough, B9 MARLON, intro (reward) |
    | chest_pound | taunt | fist taps the chest twice | intro (reward) |
    | neck_crack | taunt | head tilts left then right, shoulders roll | B6 rough, intro (reward) |
    | glove_tap | taunt | fists tap together twice in front of the chest | B9 YOAV, B10 title, B13 (P), intro |
    | shake_out | taunt | shakes arms and shoulders loose, small hop | B10 bond, B14 past, intro |
    | crossed_arms | taunt | arms folded, weight on one leg | B1 rough, B4 FEMKE, B7 strict, intro |
    | idle_relaxed | idle | loose stance, hands low, slow weight shift | B1 ordinary, B16 rough, menus |
    | idle_stretch | idle | pulls one arm across the chest, then the other | B6 ordinary, menus |
    | idle_tired | idle | hands on knees, deep slow breaths | B8 ordinary, B10 body, B15 strict, results after a loss |
    | shocked | reaction | steps back, open hands up | B11 rough |
    | laugh | reaction | head back, shoulders bounce | B4 ROXY, B7 ordinary, B13 rough, B16 ordinary, intro (reward) |
    | angry | reaction | fists clenched at the sides, leaning forward | B12 walk |
    | head_down | reaction | head down, shoulders slumped | B10 past, B15 ordinary |
    | think | reaction | hand on chin, head tilted | B2, B4 KELSEY, B11 strict |
    | argue | reaction | one hand chops the air while talking | B4 GIORGI |
    | plead | reaction | both palms up, a slight bow | B10 family |
    | shrug | reaction | palms up, shoulders raised | B13 ordinary, intro (reward) |
    | phone | reaction | looks at a phone held at chest height | B3, B4 DIEGO, B8 strict, B10 fame, B11 ordinary |
    | kneel | rest | one knee down, forearm on the other knee | B5 (rival), B15 rough |
    | sit_floor | rest | sits on the floor, arms on the knees | B8 rough |
    | defeat_slump | defeat | both knees down, hands on the floor, head low | round end (time-out / ring-out loser), B14 (ZERO) |
    | defeat_turn | defeat | turns away and waves the other off | B5 walk (player), Tournament elimination |
    | hips, arms, fist, bow, flex, ginga | victory (exist) | the 6 `VICTORY_POSES` | round end, B9 HAO and B13 strict (bow), B14 motive poses |

- Story system (P6-10, P10-03; decided by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row). Tables and texts are the P10-01 / P10-02 decisions above; what the implementation had to decide:
  - Storage (P6-10): flat additive fields on the custom record, `country` (ISO id), `origin`, `goal` (ids) and `intro` (emote id), after `look`; `storyFields()` is the one place that fills defaults (CA, gymkid, title, the tone's intro) and drops unknown values, so old saves, old codes, hostile storage (`'__proto__'`, numbers, objects) and `randomCustom` fighters work. A custom profile carries them as `profile.story`; a preset's names map to ids (`Story.settingsOf`). `CUSTOM_STORE_VERSION`, `SHARE_VERSION` and the share fields stay as they are until P6-11. The creator's Intro list is the 12 emotes of P10-02 in the order of the decision (share-code index = list index), all open ("Everything free").
  - A run (`Story.start(profile, clears, level, seed)`): rivals, boss, champion and levels are fixed at the start and follow the settings and the clears only (rival A by motive, the next motive's when that is the player; rival B the tone's first that is neither; boss `[hao, marlon, yoav][(region + clears) mod 3]`, the next one when it is the player; levels as P10-02, the pool order warehouse, subway, garage, construction minus the home level). DECIDE: when the player is ZERO the final opponent is the strongest other ranked fighter (MARA), so no stage is a mirror match. The run holds plain values only (`stage`, `choice`, `flawless`, `continues`), ready for `Progress.arcadeRun` (P10-05); `win(run, roundsLost)` sets `flawless` for stage 2 without a lost round, `retry` counts a continue, `choose` takes `hand` or `walk` (an unset choice reads as `hand`, the "Story scenes: Off" default).
  - Stage fights (`Story.cfg`): a duel is mode `arcade` (2 wins, 60 s, no ring-out, ZERO keeps `bossAttrs`), a brawl is mode `brawl` with the level's waves; DECIDE: the CPU difficulty of every stage is the Arcade difficulty setting itself (as P10-02 says "the Arcade difficulty for every stage"; the old 5-bout ramp is gone with the ladder). New optional match fields: `waveKeep` (first N wave rows; stage 1 = 3), `waveCut` (enemies fewer in the first wave; stage 6 after "Offer a hand" = 1), `keepSeed` (Game.beginMatch keeps the config's seed instead of drawing one, so a scene knows the 1v1 start side); the existing `rival` field leads the last wave (stage 3 rival B, stage 6 rival A after "Walk away"). `SimRunner.run` takes `matchCfg` (extra MatchSim fields) so a stage can be played headless (`Story.simOpts`). A stage's seed is `seedOf(run, n)` and changes with each retry. The wave rows of a level are never changed (`MatchSim.shapeWaves` copies).
  - Start side: `MatchSim.sideFor(seed, round)` is the rule `startSide()` uses (the P9 balance rule: 1v1 in a ring, drawn from the match seed, swapped every round; no random number). `Story.cast(run, n)` reads it for the scene before or after a duel stage (round 1's side; the fighter at -side x 1.2 m from the ring centre, the other opposite); a brawl scene keeps the fighter on the left. A scene or pose that places fighters must call it, never assume the left spot. [Superseded by P17-08 (2026-11-03): story fights have no ring, so the player always starts on the left and `Story.cast` puts the scene's cast there too (no draw); `sideFor` stays the rule for a 1v1 in a ring.]
  - Rows (`STORY_ROWS`, `slot|condition|text|pose|also`): a slot is `beat.box`; conditions are `dim:value` joined by `&` (`region`, `tone`, `motive`, `goal`, `origin`, `boss` (new: B9 is keyed by the boss), `choice`, `result`, `continues:>=1`; `*` = any); of the matching rows the most specific wins, DECIDE the ranks: choice, result and continues 5, goal, origin and boss 4, motive and region 3, tone 2, no condition 1, the first of equals. A slot without a matching row is no box (B5.2 only after a flawless stage 2, B16.2 only after a continue). Text may be `$region $origin $arc0..2 $challenge $beaten` (from the tables) or hold `{name} {city} {rival} {rival2} {boss} {continues}`; `pose` is the pose of whoever is on camera (for a narrator box the fighter), `also` = `who:pose` for the others in the shot. A beat has at most 3 boxes; the box look (P6-09) is left to P10-04. The test checks every text (and every region, origin and goal line) against 90 characters with the longest tokens (city 16, name 10, rival and boss 6) and that every row is chosen by some combination.
  - P6-10 / P10-03 UI: the creator's Identity tab (Country, Origin, Goal, Intro rows with hints, Preview story) and the story preview screen (`UI.screen_story`: stages with their level and opponent, every beat as a focusable card, four switches: choice after stage 2, flawless, tries, clears; this is not the cutscene player, P10-04 replaces it for play).
  - Balance: no stat, fight rule or difficulty table was changed; the 1v1, Balance (P9) fingerprints, engine-neutrality and seat-balance tests pass unchanged. Observation for P14-01 (not caused by this change): the brawl-stage band of the plan (AI player at Hard vs Normal grunts clears 50 to 80 % of seeds) is not met by the existing waves: on the code before P10-03 the Hard AI cleared 0 of 8 seeds on the full Garage and Subway waves, and in the story's stages 1 and 5 0 of 12 at Hard vs Normal and at Hard vs Easy. The four story brawls use those waves as they are.
  - P9 review lows fixed: a shattered bottle's glass is drawn at its surface height (`h.y` + 0.02) and cuts a fighter knocked down on it only when the fighter's footing is within `HAZARD_SHARD_LEVEL` (0.2 m) of that surface (a glass wall's strip, which has no height, is unchanged); a broken deck's dust mark uses its own landing surface, read once when it breaks (`Arena.collapses` record `land`, the surface under the deck's centre, `DECK_LAND_RADIUS`) instead of the highest surface within its half-size. Test "Hazards (P9 lows)".
- Unlocks (P10-05 plan, decided 2026-10-29 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row). One table `UNLOCKS`, rows `[kind, id, rule, need]`, replaces `UNLOCK_RULES` (the fighter rows keep their P5-04 rules and texts, so nothing already earned changes); `Progress.checkUnlocks` reads it after every Arcade stage, Survival fight and Tournament match.

    | Kind | Open at the start | Locked, and how it opens | Locked count |
    |---|---|---|---|
    | Fighters | the 10 starters (`DEFAULT_UNLOCKED`) | as P5-04: ZERO = clear Arcade once; DMITRI = win Arcade stage 3; LARS / TIAGO / VIKRAM / LUCIA / KASIA = 3 / 6 / 10 / 15 / 20 Arcade wins (a won stage counts 1); ARMINE / NARAN / TESSA = 2 / 3 / 4 clears; REID / CAMILA / NIA = Survival streak 3 / 5 / 8; the 6 rivals and 3 bosses = beat them in Arcade (who appears follows the story settings, P10-02) or in a Tournament match | 22 |
    | Creator content: styles, customization items, intro emotes, faces | all of it (16 styles, 91 items, every intro emote, Classic + 24 faces, photo faces) | nothing (owner, 2026-10-29: "Everything free": all creator content open from the start; unlocks only for fighters, levels and modes). The goal-reward items and emotes of "Story lists" stay as story flavour (the ending shows them), not as locks. | 0 |
    | Levels (Free Fight, Versus, Training, Co-op Brawl, Tournament stage pickers) | warehouse, dojo, pit | rooftop, subway, garage, construction, club: reach it in Arcade (play its stage, won or lost); all five after 2 Arcade clears | 5 |
    | Modes | Arcade, Survival, Training, Free Fight, Versus, Co-op Brawl, Online, Tournament Novice | Tournament Adept: win Novice; Advanced: win Adept | 2 |
    | Titles (a line on the results and the Unlocks screen) | - | "Champion" per Tournament tier won; "Stories n / 24" (goals cleared) | info only |

  - Never take away: an unlocked fighter, level or mode stays unlocked. Presets, CPUs and cutscenes use everything.
  - Single human only (owner confirmed 2026-10-29): a Tournament with 2-4 humans opens nothing (the Budokai 3 rule, P1-08); the bracket says so before the draw.
  - Combo counter (P13-01): owner confirmed 2026-10-29: a setting, off by default outside Training.
  - Screen: Main menu > Unlocks (before About & Help). Tabs Fighters, Levels, Modes (a row of chips that scrolls sideways on a phone). Each entry: name, OPEN or LOCKED, the rule text and progress ("Arcade wins 4 / 6"); 2 columns up to 480 px wide, 3 above; Back pinned; keys and pad step by entry. The results screen keeps its toast of what a fight opened.
  - Progress save (same key `breakpoint.v1.progress`) gains: `revision` 2; `goalsCleared` (goal ids); `levelsReached` (level ids); `tourneyWins` ({ novice, adept, advanced }); `grades` ({ arcade, survival, free, coop, tournament }: best letter, P10-07); `arcadeRun` (null or { fighter id, stage 1-7, clears, choice, continues, seed, rivalA, rivalB, boss }); `opened` (level and mode unlocks as "level:club", "mode:adept", kept once earned).
  - Migration (a 1.0.0 save and the current one have no `revision`): every existing field is read as `Progress.init` reads it today; the new fields start empty or zero; then `checkUnlocks(false)` runs, so old clears open their levels (a 1.0 save with 2 clears gets all levels); saved once. A bad or unknown value in a new field is dropped. `arcadeBest` keeps its meaning (highest stage won) on the 7-stage run; a 1.0 value up to 5 stays. Self-test: a 1.0.0 progress JSON, a current one and a corrupt one.
- Fight grade (P10-07, decided 2026-10-29 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row). One pure function `fightGrade({ won, seconds, par, taken, takenMax, distinct })`, no state and no random numbers.
  - Parts, each 0 to 1: Time T = clamp(1 - (seconds - par) / (2 x par), 0, 1) (par or faster = 1, three times par = 0). Damage D = 1 - clamp(taken / takenMax, 0, 1). Variety V = min(1, distinct / 8).
  - Score = 40 T + 35 D + 25 V (0 to 100). Letter: S >= 90, A >= 75, B >= 60, C >= 45, D below. A lost fight has no grade ("-") and saves nothing.
  - Inputs: par = 30 s per round won in a 1v1 (2-0 = 60 s), 20 s per enemy in a brawl stage (all waves), 30 s per Survival fight; seconds = fight time without pauses, intros, cutscenes and the KO slow motion; taken = HP the human lost; takenMax = its max HP x rounds played in a 1v1 (health refills each round), its max HP in a brawl; distinct = different moves that landed at least once (each attack id, string steps by their attack; each throw, clinch strike, hold, ground hit; each item's strike); jumps, blocks, sways and pick-ups do not count.
  - Shown on RESULTS: the letter large, the three parts under it as "Time 100 . Damage 95 . Variety 100". Arcade results add the run grade (mean of the stage scores). Co-op: a grade per player column; the best is saved. Versus and Training show none. Saved: `grades[mode]` keeps the best letter (arcade = run grade, survival, free, coop, tournament = mean of the human's matches).
  - Self-test vectors: (a) 1v1 won 2-0 in 50 s, 10 of 2 x 100 HP taken, 9 moves: T 1, D 0.95, V 1 = 98.25, S. (b) 1v1 won 2-1 in 120 s, 180 of 3 x 100 taken, 5 moves: T 0.5, D 0.4, V 0.625 = 49.6, C. (c) brawl of 10 enemies in 400 s, 70 of 100 taken, 3 moves: T 0.5, D 0.3, V 0.375 = 39.9, D. (d) a lost fight: no grade.
- Tournament (P11-01 plan, with the P11-02 and P11-03 parts; decided 2026-10-29 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row). Model: the Budokai World Tournament (P1-08): single elimination, tiers opened in order, ring-outs, rewards for a single human.

    | Tier | Entrants | Bracket rounds | CPU difficulty | Default match rule | Fixed CPU entrants | Opens |
    |---|---|---|---|---|---|---|
    | Novice | 8 | 3 | Normal | 1 round | none (no ZERO, no boss) | at the start |
    | Adept | 16 | 4 | Hard | 2 wins | HAO, MARLON, YOAV (slots 1, 6, 11) | win Novice |
    | Advanced | 16 | 4 | Expert | 2 wins | ZERO and the 3 bosses (slots 1, 5, 9, 13) | win Adept |

  - Entrants: 1-4 humans join on the Co-op seat screen (P4-07 devices: keyboard layouts take seats 1-2, pads any seat) and each picks an unlocked preset or a custom fighter; two humans may not pick the same fighter. AI fill: the fixed CPU entrants first, then the other presets (all 32, locked ones too; custom fighters only with "Include my custom fighters" on), in a seeded shuffle (`tourneySeed`, drawn once at the draw and saved), never a fighter a human took. Human k sits in slot k x (entrants / humans) (slots from 0, the fixed CPU slots move aside), so humans meet as late as possible.
  - Rules screen before the draw (defaults per tier): Rounds 1 / 2 wins / 3 wins; Timer 30 / 60 / 99 s (60); Ring-out on / off (on); Stage: Tournament ring (default: City Fight Gym, ring-out) / Rotate (bracket round r uses [dojo, rooftop, construction, club][r mod 4], the final always the rooftop) / any one unlocked level; Items off and Hazards off (P7 decision; both can be turned on); AI matches: Simulate (default) / Watch / Ask. [Superseded by P17-08 (2026-11-03): the Tournament has the whole room too, with the ring only under the Ring-out setting (owner, 2026-11-03 15:11: "use the whole room for tournament").]
  - Winning a match: KO; ring-out (feet on the floor outside the level's `ring`, only where its `ringOut` is yes and the setting is on; other levels fight inside the ring bounds, P8-05); time-out = the higher health share; a tie = the existing tied-decider rule (stamina share, then a replay). No continues: a human who loses is out. [Superseded by P17-08 (2026-11-03): "other levels fight inside the ring bounds" no longer holds; without the Ring-out setting every 1v1 has the whole room.]
  - AI vs AI: Simulate = `SimRunner.run` with the match's fighters, level, rounds, timer and ring-out, both at the tier's difficulty, seed = `tourneySeed` + match index, so a draw always replays to the same results; the score shows on the bracket at once. Watch = the same seeded match rendered; any press finishes it headless from the current tick (same result). "Simulate all AI" finishes every AI match up to the next human match.
  - Human vs human: local = Versus rules with the two seats (the others wait); online = P12 (P11-02).
  - When every human is out: Simulate to the end (default) / Watch the rest / Quit. The champion screen shows the winner in its victory pose (a human champion gets the title and the rewards).
  - Rewards (a single human only): Novice win = Face 19-21 and Adept opens; Adept = Face 22-24 and Advanced opens; Advanced = the "Champion" title; a rival or boss beaten in a match unlocks it; the tournament grade (P10-07). Prize money and shop: none (P1-03 rejected the economy).
  - Saving: the bracket is saved after every match under a new key `breakpoint.v1.tournament` (deleted when the tournament ends or is quit; added to `SELFTEST_STORE_KEYS`); the Tournament menu offers "Continue tournament".
  - Bracket screen (P11-03), landscape first, smallest 640 x 360: columns left to right = rounds (8: quarter-finals, semi-finals, final, champion; 16: round 1 first). A match card = two rows (name up to 10 characters, wins), 18 px rows, 6 px gaps; humans in their seat colour, the next match with a gold border, winners bold, losers dimmed. 8 entrants fit with no scroll (4 cards x 42 px + 32 px header + 48 px button bar = 248 of 360 px). 16 entrants: the round 1 column (8 cards) scrolls vertically inside the panel, scrolled to the next match; later columns stay centred on their pairs. Portrait: the same, scrolling sideways by column. Buttons pinned at the bottom: Fight (a human match) or Watch / Simulate (an AI match), Simulate all AI, Quit; arrows and the pad move between buttons only (cards are not focus stops).
  - Size: about 9,000 bytes (P1-05); the bracket is a formula (slot pairs), so 8 and 16 cost the same.
- Online signaling (P12-01) and netcode choice (P12-02), decided 2026-10-29 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row.
  - Flow: Online > Host or Join. The host picks the mode (1v1, a brawl level, a tournament), then makes one offer per open seat (seats 2-4): "Code for seat 2" shows the code text, Copy, Show QR, and a Paste / Scan field for that guest's answer. A guest pastes or scans the host's code and gets its answer code (text, Copy, Show QR) for the host. One peer connection per guest (star, P12-03); the lobby (P12-06) lists the seats.
  - ICE: `iceServers: []`: no STUN, no TURN, nothing outside the local network (owner: no server). The code is made when ICE gathering is complete or after 3 s, whichever comes first, with the candidates found by then (no trickle). UDP host candidates only (mDNS `.local` names or plain addresses); TCP candidates are dropped.
  - Code format: packed binary as base64url text with a prefix, `BPO-` (offer) or `BPA-` (answer); whitespace and line breaks are stripped on paste. Bytes: header (format version, kind, mode) 1; seat and net protocol version 1; ICE ufrag (length + 4-32 characters); ICE pwd (length + 22-32 characters); DTLS fingerprint 32 (sha-256 only); candidate count 1, and per candidate a type byte (mDNS name, IPv4, IPv6) + address (an mDNS name is a UUID: 16 bytes; IPv4 4; IPv6 16) + port 2; CRC-16 2 (a bad paste says "Code damaged or incomplete"). The receiver rebuilds a minimal data-channel SDP from a template: v=0, one `m=application 9 UDP/DTLS/SCTP webrtc-datachannel`, ice-ufrag, ice-pwd, fingerprint, setup actpass (offer) or active (answer), mid 0, sctp-port 5000, max-message-size 262144, the candidate lines with computed priorities, end-of-candidates. Estimated size: Chrome with 2 mDNS candidates 105 bytes = 140 characters; Firefox and Safari with 2-4 candidates 115-180 bytes = 155-240 characters. Fallback (mode raw): when the SDP has anything the packer cannot express (another hash, an unknown candidate type, over 6 candidates) or the template fails `setRemoteDescription` in testing, the whole SDP is deflated with `CompressionStream('deflate-raw')` where it exists (else sent as is) and base64url-coded (about 500-900 characters). P12-01 must prove the packed form between Chrome, Firefox and Safari (Android, iPhone, desktop) before it is the default.
  - QR display: yes. An inline encoder: byte mode, error correction L, versions 1-13, the 8 masks with the standard penalty score, Reed-Solomon over GF(256); about 4,500 bytes (first in the P1-05 cut order). A packed code (up to 240 characters) needs version 9 or 10 (53-57 modules); with a 4-module quiet zone and 4 px modules that is 260 px, drawn on a canvas in a full-screen "Show QR" overlay that fits a 360 px tall phone. A code over 425 characters (version 13) shows text only: "Too long for a QR: use Copy".
  - QR scan: only where `BarcodeDetector` exists and lists `qr_code` in `getSupportedFormats()`, `navigator.mediaDevices.getUserMedia` exists and `isSecureContext` is true (in practice Chrome on Android, ChromeOS and macOS; not Safari, Firefox or Chrome on Windows). There a Scan button opens the back camera (`facingMode: 'environment'`) in a `<video>`, detects every 200 ms, takes the first value with the expected prefix, and stops the camera on success, Cancel or leaving the screen. Elsewhere there is no Scan button and the player pastes. The stream uses `srcObject` (no URL), so no CSP change is expected; P12-04 verifies it under the real CSP. An iPhone may read the QR with the system Camera and copy the text (to verify on a device); otherwise the code travels by any messenger.
  - Copy: `navigator.clipboard.writeText` where it works, else the code's text box is selected for a manual copy. Paste is a plain text box (no clipboard-read permission).
  - Netcode for P12-02 (the P1-09 recommendation, confirmed): delay-based lockstep on the fixed 60 Hz sim, relayed by the host (star). Input delay 2 frames on a LAN; in the lobby and between rounds the host sets it to clamp(ceil(RTT / 2 / 16.7 ms) + 1, 2, 6) from 20 ping samples. Each peer sends its input for frame n + delay; the host relays the full set; a peer steps frame n only with every input of frame n. A missing input stalls the sim; "Waiting for P3..." after 0.5 s; the peer is dropped after 10 s (a 1v1 ends, a brawl seats it out like a knocked-out co-op player, a tournament match is lost). Inputs go on an unordered, no-resend channel (`ordered: false, maxRetransmits: 0`) with the last 8 frames in every packet; the lobby, the match config, pings and checksums go on a second, reliable ordered channel. A state checksum (FNV-1a 32 over positions, velocities, hp, stamina, states, timers and the `simRng` state) every 60 frames; a mismatch stops the match with "Out of sync" and offers a rematch (no state transfer in P12-02). Rollback only later, if saving and restoring the sim becomes cheap. Viewer settings must never change the sim: see P13-03 (Reduced motion now shortens hitstop; that must go before online play).
- Feedback list (P13-01) and reduce-effects settings (P13-03), decided 2026-10-29 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row. Rule: strong feedback lives on the fighters and in the world; the screen keeps only health, stamina and the timer, plus what earlier phases made for lock-on and brawls (the thin boost bar, the lock tag marker, off-screen arrows, brawl name tags) and the round / KO / wave announcements. Everything below is drawn or played outside the simulation (no sim state, no `simRng` draw), so seeded tests and online play are unchanged; hitstop is sim timing and stays as it is.

    | # | Feedback | Trigger | On | New bytes; per-frame cost | Status | Reduce setting |
    |---|---|---|---|---|---|---|
    | 1 | Hitstop | a landed hit, longer by tier | sim timing | 0; 0 | exists (no setting may change it) | none |
    | 2 | Impact flash, sparks and dust at the contact point (white, P1-07 / P9-04) | hit, block, guard break, KO | world, pooled FX | 0; exists | exists | Flashes |
    | 3 | Camera shake and FOV pulse | tier 2+ hit, knockdown, wall or object impact, KO, collapse, train | camera | 0; 0 | exists (`Camera.impact`) | Camera shake |
    | 4 | KO finisher | the hit that ends a match (last round, a brawl stage's last enemy, a boss): 40 ticks shown at 0.35 speed by the render clock, a 15 % punch-in from a low angle; the sim has already decided the result | camera | 1,200; 0 | new | Slow-motion finisher, Camera cuts |
    | 5 | Bruise tint | damage taken per body zone (head, torso, arms, legs, by hit height): that zone's skin parts mix toward #6b3b4a, up to 30 % at 60 % of max HP taken; a 1v1 resets it each round, a brawl keeps it | fighter | 600; a colour mix per part at draw, 0 parts | new | Wear marks |
    | 6 | Sweat sheen | 40 s of fighting or stamina under 35 %: skin roughness 0.7 -> 0.35 | fighter | 300; 0 | new | none |
    | 7 | Dust and scuffs | each knockdown, throw landing or fall: clothing parts mix 6 % toward the floor colour, at most 30 % | fighter | 300; 0 | new | Wear marks |
    | 8 | Breathing and panting | stamina under 35 %, exhaustion; the boost (exists) | fighter, draw-only pose offset | 400; 0 | partly exists | none |
    | 9 | Hurt posture | HP under 25 %: idle and walk lean 0.1 rad and a hand holds the most-hit zone (draw-only; the sim skeleton and hit tests unchanged) | fighter | 400; 0 | new | none |
    | 10 | Expression faces | P6-09 states | fighter | 0 | exists | none |
    | 11 | Weapon wear | item durability: colour darkens up to 25 %; on the last point a bend (bat, pipe: 0.1 rad) or a crack line (bottle, chair, crate: inside the item's mesh budget) | item | 400; 0 | new | none |
    | 12 | Layered impact sound | every hit: a body thud pitched by weight class, a slap or crack by tier, a material layer for a weapon or object; a crowd swell on a KO where a crowd exists | audio | 1,500; at most 12 voices, the oldest stops | partly exists | volumes |
    | 13 | Low-health heartbeat | a single human under 20 % HP: ambience low-passed to 1.2 kHz and a 70 bpm heartbeat | audio | 500; 1 filter | new | Heartbeat |
    | 14 | Crowd and bystanders | P9 rule R8 | world | in P9 | P9 | none |
    | 15 | Debris, rubble, persistent marks | breaks (exist), P9-03 marks | world | exists / P9 | exists | Effects (quality) |
    | 16 | Lamp sway and prop jolt | a wall or object impact, collapse or knockdown within 4 m of a hanging light or loose prop: sways 0.15 rad, damped over 1.5 s (draw-only) | world | 500; at most 8 swaying | new | Camera shake (0 stops it) |
    | 17 | Rumble and vibration | hits taken, throws, KO; pads per seat (exists); touch phones `navigator.vibrate` 20-60 ms on hits taken and KO where it exists (Android) | device | 200; 0 | pads exist, touch new | Rumble and vibration |
    | 18 | Strike trails | heavy strikes only, faint grey smear (P1-07) | fighter | 0 | exists | Strike trails |
    | 19 | Club lights and strobe | Night Club wave start and KO | world | in P8 | P8 | Flashes |

  - Rejected: blood and gore (P1-03 non-gory rule), torn clothes (a tear state per garment needs extra geometry; the 40-part limit), swelling (more face cells than the 40-cell pool; the bruise tint carries it), damage numbers and hit-count pop-ups (non-diegetic), low-health screen desaturation (a post pass the renderer does not have; the heartbeat carries it).
  - UI change: the combo counter becomes the setting "Combo counter", off by default outside Training (it is UI beyond health, stamina and timer).
  - Cost: about 7,000 bytes of new code (the P1-05 P13 line is 10,000); no new parts and no new draw calls; P13-02 runs the P0-04 check on low.
  - Reduce-effects settings (P13-03), in Settings, all saved like the others, none read by the sim:
    - Reduced motion (exists; follows the OS `prefers-reduced-motion` on first start): the master switch; turning it on sets the rows below to their reduced value once (each can still be changed). It must stop shortening hitstop (today `if (Settings.v.reducedMotion) hs = Math.ceil(hs * 0.5)` in the hit code): sim timing may not depend on a viewer setting (two online peers with different settings would desync; `SimRunner` already forces it off for the same reason).
    - Camera shake (exists, 0 to 1): also scales the lamp sway.
    - Flashes (new): Full / Reduced (impact flash alpha at most 0.3, no full-screen flash, no club strobe, slower club lights) / Off (no flash, steady club lights).
    - Slow-motion finisher (new): On / Off.
    - Camera cuts (new; the KO punch-in and low angle): On / Off.
    - Rumble and vibration (new; today rumble is off under Reduced motion and scaled by Camera shake): Full / Reduced (half strength, 20 ms) / Off.
    - Strike trails (new): On / Off.
    - Wear marks (new; bruise tint, dust): On / Off.
    - Low-health heartbeat (new): On / Off.
- Balance targets (P14-01, decided 2026-10-29 by the coordinator under the owner's standing go "complete the tasklist"; the owner can change any row). All measured headless with `BREAKPOINT.simulate` (P0-06) over fixed seed ranges (seeds 1 to n), so a re-run gives the same numbers. Noise: a 50 % rate measured over n matches wobbles about +-1.96 x sqrt(0.25 / n) (n 200: +-7; n 600: +-4); a result outside its band but within that noise is re-run once with 3 x n before it counts as a fail.

    | Target | Measured how | Band | n |
    |---|---|---|---|
    | Style pairs (all 136, mirrors included) | AI vs AI, same difficulty, `evenDamage`, KAI's body and attributes with the style swapped | each pair 40-60 % at Hard and Expert; 35-65 % at Easy and Normal | 200 per pair per difficulty |
    | Presets | each preset against all 31 others at Hard | starters, unlocks, rivals 42-58 % overall; bosses 50-62 %; ZERO measured apart with its Arcade scaling | 20 per pair (620 per preset) |
    | Block vs Sway | same fighter, only the defense differs | 45-55 % at every difficulty, momentum boost on and off | 600 |
    | Strings | damage share per string (P3-10) | no string above 35 % of a fighter's damage | the style-pair runs |
    | Time to KO, 1v1 | Hard vs Hard, 60 s timer, 2 wins | median round 20-40 s; time-outs at most 15 % of rounds; under 2 % of rounds end before 8 s; median match 50-110 s | the style-pair runs |
    | Time to KO, Tournament | 1 round, 60 s, ring-out on, the 4 ring-out levels | median round 20-40 s; ring-outs end 10-30 % of rounds | 200 per level (before P17-08; the Tournament has the whole room now, ring-out only under the Setting) |
    | Brawl stage | AI player at Hard vs Normal grunts, a full level with waves (needs a waves option, `simulate({ level, waves: true })`, from P8) | cleared in 50-80 % of seeds; median clear 2.5-5 min; one enemy down every 6-15 s | 50 per level |
    | Survival | AI player at Normal vs Normal | median fight 25-45 s | 200 |
    | Momentum boost | the style-pair runs with the boost on | every pair inside its band; 0.5 to 2 boosts per fighter per round on average | the style-pair runs |
    | Items | brawls with items on and off; 1v1 the same fighter armed vs unarmed (the item kept until it breaks or drops) | clear rate differs by at most 15 points; armed win rate 55-70 % per weapon, none above 72 %; no single item above 20 % of all damage in item-on brawls | 200 per weapon; 50 per level |
    | Hazards | brawls with hazards on; 1v1 Free Fight with hazards, spawn sides swapped | hazards at most 20 % of all damage in a brawl; the fighter starting nearer a hazard wins 45-55 % | 50 per level (brawl); 200 per level (1v1) |
    | Body options (P14-02 / P14-03) | one factor at a time against baseline KAI: height ends, fitness corners, age ends, each gender | each 40-60 % against the baseline | 200 each |
    | Weight classes | class 4 vs class 0, tackle included | 40-60 % | 200 |
    | Uneven teams (P4-08) | AI against AI, all KAI, the smaller team's wins in 1 v 2, 1 v 3, 2 v 3, 1 v 4 and 2 v 4 with the even-teams handicap on | 40-60 % at Hard and Expert; 35-65 % at Easy and Normal | 300 per shape and level (the table above) |
    | Difficulty ladder, 1v1 (P14-05) | the CPU at each difficulty with its damage bonus vs the reference player = the Normal AI without a bonus (needs a one-sided bonus option on `simulate`; P14-05 adds it) | the CPU wins: Easy 20-30 %, Normal 45-55 %, Hard 65-75 %, Expert 80-90 % | 400 each |
    | Difficulty ladder, groups | the reference player vs 3 CPU enemies | the player wins: Easy 85 % or more, Normal 50-70 %, Hard 25-45 %, Expert 10-25 % | 100 each |
    | Grades (P10-07) | the Hard AI player in Arcade-like fights at Normal | S at most 10 %, D at most 25 %, median B or C | 200 fights |
    | Arcade length | the 7 stages at Normal, scenes Short | 15-25 min (simulated fight time + 1 min of scenes) | 20 runs |

  - Reporting: P14-04 records each row (band, result, n, seed range) in Appendix C and fixes outliers by data (attributes, frame data, AI weights), never with a special case per matchup; a change re-runs only the rows it can touch (P14-03).

### P17-03 sway pose (2026-11-03)

- Owner (2026-11-02): the spine goes way too far back; a side sway should lean to its side, not back; add other movement (backsteps, sidesteps, lowering the torso). Visual only: the 12 i-frame ticks, recovery, stamina, sim travel (3 m/s fading, about 0.3 m) and the AI do not change.
- Rule (`SWAY_POSE`, `Fighter.computePose` case SWAY, `Fighter.swayTravel`, `Fighter.levelHead`): the pose is full on the first i-frame tick (blend 0.9) and upright `SWAY_POSE_RETURN_TICKS` (3) after the i-frames, as before. The drawn back step and side shift are only the part of the distance the sim has not yet travelled (`step - swayTravel()`), so the root stands at its full step from tick 0 and the feet hang from the root and move with it. These root offsets do not return with the joints: they ease out linearly over the whole recovery (`ease`, 15 ticks after the i-frames: the 0.2 m back step goes at 0.8 m/s, the shift at 1.0 m/s at most), so the body never slides forward fast; the joints (lean, bend, turn, knees, stance) still return over `SWAY_POSE_RETURN_TICKS` (3), and at the last sway tick the pose is the guard again (self-test: within 0.03 rad / m of it). `swayRoom` scales the drawn offsets down so the body stays inside the ring walls (`Arena.def.bounds` minus the fighter's radius).
  - Back (lay-back): step 0.28 m back, torso back 0.3 rad (17 degrees) from the guard, chin tucked +0.15 rad (the head tips forward against the torso), knees +0.2 rad (`sink` 0.06; the root drops about 0.02 m), the rear knee +0.12 rad (weight on the rear leg).
  - Side (slip): no backward tilt. The torso bends 0.3 rad (17 degrees) towards `swayDir` (drawn 0.25-0.3 in the fighter's frame), turns 0.35 rad (20 degrees) towards it (`torsoTwist` += `swayDir` * 0.35), the root shifts 0.25 m towards it (drawn 0.18-0.31, by guard), steps back 0.2 m (diagonal slip; drawn 0.19-0.22; the sim only moves the fighter sideways, so this is a constant offset), drops 0.08 m by the knees (drawn 0.10-0.14 with the wider stance), stance +0.2 rad wider. The head keeps its guard stance: while `levelHead` is set, `skeleton` undoes the torso's roll, twist and lean at the neck and re-applies the guard's twist and lean, so the head is as level as at rest and still looks where it did (at the opponent), with no pop at either end. The torso's axis is Rx(lean) Ry(twist) Rz(roll): its sideways tilt is `bend` when `sin(roll) = sin(bend) / cos(twist)` (cos capped at 0.3 and the sine at 0.8, so a torso turned far round takes a little less bend instead of blowing up), and its forward / back tilt stays the guard's when the lean gives up `atan(tan(roll) * sin(twist))` (the joint `torsoLean` drops up to about 0.3 rad on the side where the guard twist and the turn add up). Drawn tilt back: at most 0.02 rad more than at rest.
- Old and new: torso back 0.9 rad (52 degrees) -> back 0.3 rad (17), side 0 rad extra tilt (was 0.9); head 0.4 rad further back -> 0.15 rad forward of the torso (side: at its guard stance); root back 0.28 m on top of the sim travel (0.56 m in all, then a 0.28 m snap forward in 3 ticks) -> 0.28 m in all, eased out over the recovery; knees +0.3 -> back +0.2, side +0.27 (root -0.08); side roll 0.5 rad with the tilt back -> bend 0.3 rad, no tilt back; side shift 0.25 m on top of the travel -> 0.25 m in all, plus a 0.2 m step back (decision of the coordinator under the owner's delegation, 2026-11-03: the owner objected to the spine tipping back, not to the body stepping back); hips +0.2 -> +0.2; torso turn 0 -> 0.35 (the earlier hand-over of the turn, `turn`, was commented out by mistake and never ran; fixed 2026-11-03 after review, so the first tuning of the turn tested nothing).
- Clearance ('Sway pose' self-test, surface to surface, needs head 0.32 / torso 0.35 / foot 0.30 m point to strike path), worst style of the longest strike of each height at both timings:
  | Direction | head | torso | foot (low strikes) |
  | --- | --- | --- | --- |
  | back | 0.70 | 0.48 | 0.32 (all pass) |
  | side, `swayDir` +1 | 0.41 | 0.36 | 0.297 (capoeira sweep) |
  | side, `swayDir` -1 | 0.33 | 0.25 | 0.47 |
  | old pose (all directions) | 0.77 | 0.44 | 0.36 |
  | side before the diagonal step back, `swayDir` +1 / -1 | 0.33 / 0.32 | 0.30 / 0.16 | 0.298 / 0.38 |
- Tuning (strict bar, 288 trials; failing trials in brackets): step back 0.12 / 0.16 / 0.2 m -> (24 / 18 / 15 with the stance +0.1; 21 / 18 / 14 with +0.2); a deeper knee drop (0.12 instead of 0.08) made it worse at every step (20-26 at the same settings); stance +0.2 beat +0.1, +0.3 and +0.4; the turn (-0.5 to 0.5, with the turn working) changes nothing in the clearance: the clearance is measured at the torso and head points, which lie on the torso's axis, and the correction holds that axis (the turn only moves the shoulders and arms); with the correction exact, a bend of 0.30 beat 0.26 (12 against 14 failing trials) and 0.35 (12, head 0.32), a shift of 0.2 or 0.3 did not help. Chosen: shift 0.25, back 0.2, bend 0.3, turn 0.35, drop 0.08, stance +0.2 (12 failing trials).
- Open: the 'Sway pose' self-test keeps the full 0.1 m bar (head 0.32 / torso 0.35 / foot 0.30 m) for every style, strike height and direction except these 7 side slips, listed in the test as `shortSlips` with each measured clearance (minus 0.01 m) as its floor, so an exception can only get better and any other combination under the bar fails (the kickboxer heavy front kick, short before the bend of 0.3, now passes):
  | Style, strike, `swayDir` | short part | measured (m) | floor (m) | reason |
  | --- | --- | --- | --- | --- |
  | karateka heavy_front, -1 | torso | 0.32 | 0.31 | a heavy front kick drives straight along the slip side |
  | muaythai heavy_front, -1 | torso | 0.31 | 0.30 | same |
  | taekwondo heavy_front, -1 | torso | 0.30 | 0.29 | same |
  | capoeira heavy_front, -1 | torso | 0.33 | 0.32 | same |
  | hapkido heavy_roundhouse, -1 | torso | 0.25 (P17-11: now 0.33) | 0.24 (P17-11: now 0.32) | the roundhouse curves into the slip side |
  | wingchun trap_strike, -1 | torso | 0.29 | 0.28 | the trap strike curves into the slip side |
  | capoeira sweep, +1 | foot | 0.30 (just under) | 0.29 | the sweep runs along the floor on the slip side, where the shifted feet are |
- New self-tests (all in 'Sway pose (P17-03)'): a back sway lays the torso back by at most 0.35 rad and tucks the chin; a side sway never tips the torso back (at most 0.05 rad more than at rest), leans it (at least 0.15 rad drawn, roll at least 0.2), turns it towards swayDir (at least 0.25 rad) and keeps the head within 0.1 rad of its rest roll, measured in the world from `Fighter.pts` (the head's own axis rebuilt from the head and torso points); the drawn root steps back 0.15-0.5 m on a back sway and 0.15-0.5 m to the side (drops at least 0.05 m, steps back about 0.2 m) on a side sway; after the i-frames the drawn root moves at most 0.02 m a tick (1.2 m/s) against the fighter's place and the pose is within 0.03 of the guard at the last sway tick. All comparisons go through `within`, which fails on a NaN. The clearance test is renamed to mention the `shortSlips`. The lean-covers-the-window test now measures the back lean (back sway) or the roll (side sway) against the guard, with a peak of at least 0.2 rad instead of 0.6.
- Duck (bob): not added for now. It needs its own input direction and AI rule (a sim change), and the sway pose is visual only in this batch; a deeper root drop also made the clearance worse.

### P17-08 arena bounds (2026-11-03)

- What the owner met (2026-10-31, "Arena Bounds on Levels like Night Club, Yellow Borders on Construction Site are restrictive"): in Free Fight and Versus a 1v1 fought inside the level's ring (P8-05) whatever the Ring-out setting: invisible walls stood on the ring (Night Club: the 9 x 7 m dance floor in a 22 x 14 m room, so the stage, bar, tables and balcony could not be reached; Construction: the 11 x 8 m slab, whose edge the floor shader draws as yellow tape, in a 24 x 14 m site). Gym, Rooftop, Pit, Warehouse, Subway and Garage did the same with their rings. A brawl always had the whole bounds. The second limit was smaller: each drawn wall stood 0.2 to 0.8 m behind the bounds, so a fighter stopped at an invisible line short of the wall (Warehouse and Pit 0.7 m).
- Decision (DECIDE, by the coordinator's delegate; the owner can change any row):
  1. A 1v1 has the whole room. `Game.beginMatch` sets `ring` only when the Ring-out setting is on and the level has a ring edge (`ring[4]`: Gym, Rooftop, Construction, Night Club); the Tournament follows the same rule (owner, 2026-11-03 15:11, verbatim: "use the whole room for tournament"; first decided the other way, to keep its ring): `Game.tournamentBout` no longer passes a ring, and `Tournament.simulate` (the bracket's CPU fights, `tournamentStep`) passes `ring` / `ringOut` from the Ring-out setting and `sides: true`, the same set-up `Game.beginMatch` gives a live bout. A bracket saved before this change holds only results, scores and the open match (no ring data, `Tournament.rules` is derived), so it continues; an open bout restarts under the new rule. A restart reads the setting again. The same holds for Arcade, Survival and Training (the setting never applied to them, they had the ring as their area). The first fighter's start side is drawn from the seed in round 1 and swapped every round for every 1v1 but Training, ring or not (`cfg.sides`, set by `Game.beginMatch`, read by `MatchSim.startSide`; `SimRunner` takes `sides`, default off, so the recorded fingerprints stay as they were). Story fights are Arcade fights: `Story.cast` puts the scene's cast on the left of the middle of the room (on the drawn start side, around the middle of the room), `Story.simOpts` asks for no ring and for `sides`, and the self-test plays every stage through `Game.beginMatch` and checks the cast against the fight's opening positions. Off now means "the whole room", not "inside the ring" (the Settings hint says so). The ring stays the fighting area where it is a rule: ring-out on, and Tournament (P8-05 and the 1v1 areas entry above are unchanged for those).
  2. The bounds stay as they are on all eight levels. Every object, hazard post and item stands flush against them, and the 'Levels' test fails any gap smaller than a body (0.68 m) between an object and the bounds, so a larger bound would mean moving the objects of the level, which is a new layout (a later task if the owner wants bigger rooms). The yellow tape on the Construction slab and the Warehouse floor lines stay as paint; they stop nobody.
  3. The drawn walls move to 0.1 m behind the bounds (a body then stops 0.1 m from the wall, the test allows 0.15), and the wall decoration moves with them and stays inside the bounds line.
  4. The front of every room is open (the camera looks in over it) and its limit is as deep as the back wall: z is the same on both sides. The Rooftop and the Construction site have no wall on their sides: the bound there is the roof or site edge (parapet outer face; fence rail and lift shaft).
- Bounds per level (half sizes in metres, as in `ARENAS`; wall = inner face of the drawn wall):
  | Level | Old bounds | New bounds | Wall, old -> new | Why |
  | --- | --- | --- | --- | --- |
  | Industrial Warehouse | 11.5 x 6.5 | same | sides 12.2 -> 11.6, back 7.2 -> 6.6 | racks, crates and the container stand on the bounds; 0.7 m of floor in front of the wall could not be walked; barrels and pallets behind the back line gone with the wall |
  | City Fight Gym | 10 x 6 | same | sides 10.4 -> 10.1, back 6.6 -> 6.1 | lockers, the fire door and the pillar stand on the bounds; wall pilasters and the flag moved in with the wall |
  | Underground Pit | 10 x 6.5 | same | sides 10.75 -> 10.1, back 7.25 -> 6.6 | the cage, bar, speakers and decks stand on the bounds; boiler pipes moved in |
  | City Rooftop | 11 x 7 | same | none (no walls) | the bounds are the parapet's outer face and the roof edge already |
  | Subway Station | 12 x 6.5 | same | sides 12.2 -> 12.1, back 7.3 -> 6.6 | the track bed ends on the bounds, the tiled wall stood 0.8 m behind it; the station board and bands moved with it |
  | Parking Garage | 11.5 x 7 | same | sides 11.75 -> 11.6, back 7.25 -> 7.1 | the pay machine, kerbs and decks stand on the bounds |
  | Construction Site | 12 x 7 | same | back 7.35 -> 7.1; sides none | the west fence rail and the east lift shaft stand on the bounds; the building wall moved in |
  | Night Club | 11 x 7 | same | sides 11.2 -> 11.1, back 7.3 -> 7.1 | the balcony, stage, fire door and beer crate stand on the bounds; the front door moved in |
- Reached (self-tests): walking toward each wall and into each corner on a 0.5 m grid of lanes, a fighter stops within 0.34 + 0.15 m of the wall face found in the level's props, or within that of a solid thing in the way (on the old walls: 0.7 m short); every destructible has a floor spot that the start can walk to, or a deck spot, within 1.2 m of it; the camera eye stays inside the drawn room with the pair or the party at every wall and corner on three screen sizes; spawns (whole room, ring, brawl), hazard posts and the room beside them, placed items and wave entries lie inside the bounds and clear of solid things; a CPU 1v1 and a CPU against three (with the level waves) finish on every level with nobody outside the bounds; the ring default and the restart.
- P0-04 (frame cost, to be measured in a browser): the drawn scene is the same for each level (same props, same draw distance and fog; the walls only moved, 0.1 to 0.7 m). What can differ is play: a 1v1 that used to stay in the ring now roams, so the camera sees more of the room and more scenery can break at once (debris is capped by `DEBRIS_MAX` and the quality limits, and spreads no farther than 1.2 m past the bounds, as before).
- Balance: the sim is unchanged (the P0-06 runner never used the ring, and the bounds did not move). KAI against MARA at Hard, 30 seeds per level, and KAI against three CPUs at Hard (waves where the level has them), before and after: identical on all 8 levels (first fighter wins in the duel: Warehouse 57%, Gym 23%, Pit 7%, Rooftop 20%, Subway 23%, Garage 50%, Construction 20%, Club 30%; the single Hard hero wins the 1 v 3 brawl 0-13%). All the fingerprints (the three seeded 1v1s and the three with the ring) are unchanged.
- Decoration (review fixes): the Night Club back wall is now three pieces with a recess behind the stage-side corner (x -11.1 to -6.3, wall front at z -7.7) so the five crowd silhouettes stand in the open instead of being half sunk into the wall; the DJ screen and the lights moved out of the wall to z -7.05 / -7.02 / -7.04. The Pit boiler pipes (z -6.69 and -6.65) and hanging cables (z -6.58) sit flush against the wall, clear of the catwalk and landing. The Warehouse back wall has ribs (front z -6.56), the roller door 2 cm in front of them (-6.54) and its slats a further 2 cm (-6.52); the loading door and its slats on the west wall stand 1 cm apart (-11.51 / -11.50). The Pit street door sat on the wall face (coplanar); it now stands 8 cm out. The Warehouse barrels and pallets that stood behind the old back line are gone (nobody could reach them and the nearer wall would cut them). Self-test 'the wall decoration sits on its wall' checks every part that touches a wall on every level: its front is in front of the wall face (not hidden), it does not poke out behind, and nothing below 2.2 m stands more than 3 cm past the bounds.
- Frame numbers: the P0-04 benchmark 1v1 (`benchmark` in `Game.beginMatch`, Warehouse) now has the whole room instead of the ring, and its CPU roams and breaks more, so its frame numbers are not comparable with runs from before P17-08.
- Seat balance after the whole room (P9 follow-up rule, Appendix C "1v1 seat balance"): the start side had been drawn only in a ring, so with the ring gone every 1v1 started the first fighter on the left. KAI against KAI, Hard, items and hazards on, 120 seeds, first fighter wins (default rounds): left side only: Warehouse 30.0, Gym 46.7, Pit 20.0, Rooftop 38.3, Subway 36.7, Garage 70.0, Construction 26.7, Club 64.2 (the reviewer's four numbers reproduced); with the side drawn: Warehouse 45.0, Gym 42.5, Pit 50.0, Rooftop 55.0, Subway 39.2, Garage 48.3, Construction 40.8, Club 42.5. Subway and Construction at 300 seeds: 45.3 and 49.0 (the 120-seed values are sampling noise, standard error about 4.5 points), so no level needed a change. No self-test measures the balance of a layout (with the side drawn a mirror gives about 50% whatever the layout, and a useful sample takes minutes): that is a P14 balance run with the side forced. The self-tests only fix the mechanism: the default 1v1 through `Game.beginMatch` has the drawn side and swaps it each round, and a `SimRunner` 1v1 with `sides` opens the first fighter at the drawn spot in round 1 and the other spot in round 2, for seeds that draw either side (about 2 s).
- Night Club recess: a 0.2 x 6 x 0.2 m filler at x -6.4, z -7.6 closes the slot between the recess wall and the long wall piece.
- Open: bigger rooms (more floor than the objects fill) would need each level laid out again.
- New self-tests ('Arena bounds (P17-08)', 10): walls and corners; every destructible reachable (floor spots, and deck spots only through a flood fill over steps of at most 0.5 m, so a stair or ramp must lead there); camera at the walls and corners (the eye at least the near plane and its corner reach, 0.3 x (1 + tan(fov/2) x aspect), from the wall face); spawns, hazards, items and wave entries; CPU 1v1 and brawl on every level; the ring default in Free Fight, Versus, Arcade, Survival and Training with the setting off and on, the restart and an explicit ring; wall decoration on its wall; a Tournament bout (live and simulated) in the whole room, with the ring only under the Ring-out setting; the drawn start side of the default 1v1 and its swap; the drawn opening spots of a SimRunner 1v1 in rounds 1 and 2. The first and the last fail on the old code (0.70 m short of the Warehouse wall; every plain 1v1 had a ring).

### P17-05 player text (2026-11-03)

- Method: every string literal of the game script was listed (comments left out) and read; the texts below read as notes to a developer or as reasons for how the game was built. No task id (P3-02 and the like) was in any player text; the F3 diagnostics overlay and the error log lines are developer tools and were left as they are. Real help (what a button does, what a number means for the player) stays, in short player language.
- Removed or rewritten (old -> new, shortened):
  | Where | Old | New |
  | --- | --- | --- |
  | Move list, first line (the owner's example) | "Frame data at 60 fps. Strong moves cost more stamina ... There is no hold: Punch and Kick attack on every press, and the strong moves are steps of the attack strings below." | "Frame data at 60 fps. Strong moves cost more stamina and leave you open longer if they miss." |
  | Move list, Move styles | "... Each style has its own stance and footwork. The moves that carry a style name in the table above, the style throws and the hold poses are unique to that style; everything else is shared where the real arts share it. In Training ..." | "... In Training ..." |
  | Controls | "... Use and Lock on have no effect yet." | "Use picks up an item in reach and throws the one you hold (Crouch + Use drops it); Lock on picks the opponent in front of you, and pressing it again lets go (hold a direction as you press it to switch to the opponent that way)." (both are working now, so the old line was also wrong; a second press with no direction held releases the lock) |
  | Players and teams | "... Online players join here after Phase 12." | (removed) |
  | Holds (Move list and About & Help), step 3 | "Every hold plays the same way; only its pose and name belong to the style." | "Every hold plays the same way." |
  | Holds, step 4 | "The damage builds for up to 3 s (about 22 hp in all)." | "The damage builds for up to 3 s." |
  | Hold lines of the six hold styles (`GROUND_NOTES`: Wrestling, Judo, Sambo, Jiu-Jitsu, Hapkido, MMA) | "The hold is a pin: ... (the choke is another name for it)", and five like it ("arm lock and choke are other names for it", "heel hook is its other name", ...) | "The hold is a pin: kneel on the foe and clamp a limb." and the five others without the naming remark |
  | Kali style line | "Stick fighting without the stick for now: ..." | "Stick fighting without the stick: ..." |
  | Creator, Fitness hint | "... the weight class the heavy tackle uses, never the attribute points." | "... the weight class the heavy tackle uses." |
- Left on purpose: tuning numbers that tell the player what a move costs or how long it lasts (stamina, i-frame seconds, escape times, frame data in the Move list and the Training panel), the About line "single-file 3D fighting game ...", the "Run self-test" button and the story preview rows (Creator > Preview story).
- Self-test 'Player-facing text (P17-05)': opens 8 menu screens, the character, arena, setup, lineup and co-op screens for each of the 8 modes, the results screen for 4 modes, the story screen, the 6 creator tabs and the Training panel (striker and hold style), and adds the label and description tables (settings, actions, gamepad and touch labels, modes, move styles, families, hold notes, archetypes, arena blurbs). It fails on a task id (`/\bP\d{1,2}-\d{2}\b/`) or on one of: TODO, FIXME, placeholder, tuning, tuned, stub, hardcoded, not implemented, no effect yet, for now, "after Phase n", appendix, design note, "another name for it", "other name(s) for it", "the real arts". It also checks that the patterns match what they should, and that at least 40 screens were opened. It cannot read toasts or hints that only appear in a fight; those were read once in the string list.

### P17-07 items on surfaces (2026-11-03)

- Measured (headless, all 8 levels, every placement row of `ARENAS[id].items` and a drop onto every flat-topped box): an item rests with the lowest point of its drawn model at the height of its row (`loose.y`), and the physics lands it on the collider top (`Arena.supportAt`). Four causes made it look sunk, fall through or hover:
  1. The drawn top was higher than the collider top: the `table` look drew its slab at 1.0 x height with a thickness of 0.08 x height (top at 1.04 x height, 3-4.2 cm), the bench slab 0.04 m above, the barrier cap 0.045 m above, the kiosk counter at 1.05 x height. Every item on a table, bar, sawhorse, bench, barrier or kiosk (Construction site sawhorse, Night Club bar and tables, rooftop table, Pit bar and barriers, subway bench and kiosk, warehouse bench) therefore sank 3-4.5 cm into the slab. Fix: slab centres moved down so the drawn tops are the collider tops (`table` 0.96 x height; bench centre `h - 0.036` (top 4 mm above the leg tops, so no flicker); barrier cap centre `h - 0.0225` (top 2.5 mm); kiosk counter 0.975 x height). The colliders, row heights and the sim are untouched.
  2. A thrown or dropped item fell through low tables: `supportAt` only counted boxes between 0.8 m and 1.05 m high as footing, so the Night Club and rooftop tables (0.75 m), the benches (0.5 m) and the DJ table landed the item on the floor (or on the stage) under them. Fix: a collider `shelf` flag (a box up to 1.05 m high whose look is plain, table, bench, barrier, crate or kiosk) and an `item` argument of `supportAt` that counts it as footing for a loose item that is above its top. An item has no body, so with `item` the footing test is the item's centre, `ITEM_FOOTING` (0.03 m) beyond the box edge, not the 0.18 m `ITEM_RADIUS` (that radius let an item dropped up to 18 cm outside a table, bench, DJ table or bar rest in mid-air at the top height; it also applies to glass patches and to the other footings an item uses, decks included). Fighters are not affected (no change to who can stand where).
  3. A fast fall could cross the top between two ticks (0.08 m a tick at 4.7 m/s against a 0.05 m window): the item then counted as inside the footprint and was pushed out sideways, to rest on the floor beside the table or even hang beside a crate at its height. Fix: `moveItem` takes the higher of the new and the previous height as the height it came from (`above`) for the scenery test and the landing; the skip of the side push-out applies only to an item whose centre is over the top of a shelf or standable box (within `ITEM_FOOTING`), so an item that comes down beside a box is still pushed off it.
  3b. A thrown skateboard that started or slid onto a shelf rode its top at table height and could hit floor fighters from there. Fix: a sliding board takes its footing without shelves (`supportAt` without `item`, in `throwItem` and `moveItem`), and `itemStrike` only lets a sliding board hit a fighter within 0.35 m of its own height (before, only a fighter far above it was skipped). A board still rides a standable table or deck, as before, but no longer hits fighters on the floor from there.
  4. Row heights and `rest` values that did not match the model: the two Garage car items were placed at 0.9 m, 27 cm above the hood (0.63 m, the car's collider is the 1.15 m roof); the Construction fence chain lay 4 cm above the rail bar (top at 1.01 m); the pipe wrench and the hammer floated 1.4 cm and 1.1 cm (`rest` 0.03 -> 0.02 and 0.04 -> 0.032).
- Surfaces and the 1 cm rule in the self-test: a table / crate / deck / rail bar is the highest drawn part under the item at the item's spot (read from what `Arena.drawObject` draws), the floor is 0, a wall-mounted item rests on the pegs of its bracket (at its own `y`). The lowest point of the model is read from the matrices `drawItems` draws.
- Not changed here (taken up by P17-12 and P17-13 below): a sofa's collider (0.9 m, a standing proxy) is far above its seat (0.61 m), so an item thrown onto a sofa lay 0.29 m above the cushion; items thrown at a car roof or a rack, which were not footing for items, dropped beside them.
- New self-tests: 'Items on surfaces (P17-07)' twice: (1) every placement row of every level has its model within 1 cm of its surface (at least 60 items); (2) a bat and a brick dropped, and a pipe thrown, from three heights onto every flat-topped box of every level come to rest on its drawn top within 1 cm (at least 200 landings); a brick dropped 2 cm inside each of the four edges lies on the top and one dropped 6 cm past an edge does not stay in the air at the top's height unless it is over another box (at least 100 edge drops; it fails with the old 0.18 m footing); a board slid from a non-standable table top is on the floor from the first tick, and a board at table height does not hit a floor fighter while one at the floor does.

### P17-12 and P17-13 (2026-11-03)

- Cause: a sofa, a car and a rack each have one box collider of their full height (sofa 0.9 m, car 1.15 m, rack 2.4 m). The sofa counted as footing for items at that height only (its seat is at 0.61 m); the car and the rack are taller than 1.05 m, so they were no footing at all and a thrown item was pushed or bounced off beside them.
- Fix (data-driven, no new collider and no change to the shape of anything): a collider flag `lay` (look sofa, car or rack) and `Arena.lookTop(c, x, z, y)`. An item lies on the highest drawn top of the block and the look parts (`LOOKS`) under its centre (`ITEM_FOOTING` beyond each part), if it is above that top; below it, or beside the object, the call gives 0 and the item is a side hit as before (thrown: it bounces and drops, dropped: pushed out). `supportAt` with `item` uses it for `lay` colliders (before: the collider top) and `moveItem` skips the side push-out for an item over such a top. Review fixes (same day): (a) `moveItem` asks `lookTop` for the item's spot clamped into the footprint, because the push-out zone reaches 10 cm beyond the collider and the parts only 3 cm, so a throw at seat or bonnet height was a side hit in an invisible band in front of the sofa or car; (b) `lookTop` returns the highest part top the item is not below, and 0 only when the item is exactly inside a taller part (before: it returned 0 as soon as a taller part was within 3 cm, so a brick dropped 1.5 cm beside the windscreen, a sofa back or an arm was pushed to the floor). So an item rests on the sofa's seat (0.612 m), arm (0.833 m) or back (0.963 m), on a car's roof (1.179 m) or bonnet and boot (0.63 m), and on a rack's top shelf (2.196 m) or a rack post. Fighters use the same collider as before: nothing about who can stand where changed.
- Not changed: placed items keep their rows (the two car items already lie on the bonnet, the rack items hang on brackets); a lower rack shelf and the space under the top shelf are not landing places for a thrown item (it counts as a side hit), because it could otherwise end up inside a cushion or a car body. At damage stage 3 `drawBox` draws the plain block at 0.94 of its height (a car's bonnet or boot, a sofa's base, a crate), but the parts and `lookTop` keep the full height, so an item on such a block floats about 4 cm; P17-07's tables and crates have the same gap. Not fixed here: a cheap fix needs the object's stage in the item physics and a fingerprint-safe change to every box (open, low).
- Fingerprints: the fight, hazard and items fingerprints did not change (no re-recording).
- New self-test: 'Items on surfaces (P17-12, P17-13)': on every level, for every sofa, car and rack, a brick dropped and a pipe thrown from 0.3 m and 1.3 m above each part and each end of the block lie within 1 cm of the drawn top under them (or on the floor if they came down past an edge); a pipe thrown at a side along x and along z, low and at mid height (sofa 0.75 m into an arm or the back, car 0.9 m into the cabin, rack 1 m between shelves), drops to the floor and not into the footprint (at least 8 landings and 2 side hits per kind). Added after review: a brick dropped 1.5 cm beside every part that stands 20 cm or more above the top there (sofa back and arms, windscreen, rack posts) lies on the lower top where it fell; a pipe lobbed from 2 m away to arrive at seat height (sofa, from the front) or bonnet height (car, from the boot end) lands on the part (`GRAVITY` added to the test API). With the flag off it fails (a dropped brick lay at 0.9 m on a seat drawn at 0.833 m); with the first version of `lookTop` the new cases fail (lobs rest on the floor, side throws at mid height end inside the footprint, bricks beside the back are pushed to the floor). The `settle` helper of the P17-07 test moved to the shared scope.

### P17-04 move list (2026-11-03)

- Problem: the Move list showed every move of every style at once (an 8-column frame table, a table of all 16 styles, every style's throws and holds), so a player could not tell which moves were theirs, and the table ran wider than a phone.
- Which fighter (`UI.moveFighter`): in a paused fight, the fighter steered by the person who paused. `Game.pause(by)` now keeps that person's input in `Game.pausedBy` (any seat can pause; `pollMatchInput` takes every seat's press and passes the first), and `Inputs.forFighter` maps it to a fighter in Versus, a lineup, a bracket fight and a co-op. A pause from a button on screen or from losing focus has no seat: the first fighter a person steers is used (the player in Training and every other single-player mode). When no person steers a fighter (a watched CPU against CPU bracket fight) and in the menus (main menu, Controls opened from it) it is `Game.selection.player`, the fighter picked last; when that is not a known fighter, KAI. The profile is the fighter's own, so a creator fighter shows the style, defense and weight it was made with.
- Which device (`UI.moveKind`): the device the person who paused used last (touch, gamepad or keyboard, with that seat's keyboard layout), in the menus the same choice the controls card makes. The names of the buttons come from `UI.controlLabel`, now also used by the controls card: the same tables the Controls screen shows (`GAMEPAD_LABELS`, `TOUCH_LABELS`, the key bindings). A button with two faces (Square / Triangle) shows its first face in the rows; the full names are in a line above the table.
- What is listed (`UI.screen_moves(profile, kind, held)`, all optional): the strikes of the fighter's string rows (`stringsFor(style)`: the default rows with the style's own rows applied; with an item in hand `weaponTable(style, item)`, the table the fighter really plays, and the page says "holding" the item; a crate in the arms plays no Punch and cannot run, so the page says "carrying" and shows only the kick rows, the air and counter kick and the grab, with no lunge and no tackle), each with its two shortest inputs and its data (height, start / active / recover frames, damage, stamina, advantage on hit and on block, notes); the moves every fighter has (flying kick and air strike, running lunge, counter strike and kick, grab); the two clinch strikes; the heavy tackle ("a fighter at least 2 weight classes lighter") only when the fighter's weight class is `TACKLE_MIN_GAP` or more; the table of the fighter's string rows; the fighter's own defense (Block or Sway; a bin lid makes every fighter block) with its help text in the directions of the device in use, that strong moves break a block unless it is perfect and that Defend gets you up quickly, and counters that name only that defense ("after a perfect block" or "after a perfect sway"); the nine throws of the three grips with the style's own throws in place of the set's (`throwFor`); the holds and the ground game only for a hold style. Nothing about another style is shown: the overview of all 16 styles, the table of the styles' differences, the table of every style's throws and the hold table of all styles are gone from the Move list (About & Help still has the hold table of all styles).
- Phone width: three columns at most (Move, Input, Data) in every table, no fixed widths and no font size of its own (the tables keep the game's table text size), so the text wraps instead of scrolling sideways. The old table had 8 columns for the moves and 7 for the throws. The browser self-test then found a 2 px sideways scroll of the screen at 375 px (every page, not only the Move list): `.panel` had `min-width:min(26em,92vw)` (345 px) but the screen's content box is 375 px less two 1 em paddings (343 px) under the phone rule, so the panel stuck out 2 px and Chrome counts the screen's end padding after it (scroll width 377). On a phone with the notch in landscape the safe-area borders widen the gap. Fix: `min-width:min(26em,100%)`, a share of the screen's content box, which changes nothing where the screen is wider than 26 em.
- Self-tests: 'Move list (P17-04)', five tests. (1) For every roster fighter and a creator fighter of each of the 16 styles (alternating the defense, and a heavy and a light body), on keyboard, gamepad and touch: the names in the list are exactly the fighter's string moves, the shared moves, the clinch strikes, the tackle (heavy fighters only) and the fighter's nine throws; no move or style throw of another style appears; the style, defense and hold section match the fighter; the counters, the sway help directions and the block and get-up lines match the defense and the device; every move has an input; the punch, kick and grapple buttons of the device in use are shown and those of the other two devices are not; the three devices give three different pages; no table has more than 3 columns and no fixed size. (2) The current fighter on the paths that set the state by hand (menu pick, no known fighter, paused player, a seat with no fighter, Versus P1 and P2 with the P2 keyboard layout) and the device of the seat. (3) A real pause press (one more case each for a lineup seat and a co-op seat, both from `Game.pollMatchInput`): the test presses Pause on a seat and calls `Game.pollMatchInput`, which must keep who paused; for a non-first seat in Versus, a seat of a bracket fight (with a broom in that fighter's hand) and the first seat, the page then shows that seat's fighter and device; a watched bracket fight (two CPU fighters) shows the picked fighter. Putting `this.pause()` back in the poll fails it. (4) Every case with a bat, broom, escrima stick, bottle, bin lid and a crate in hand: the listed names are exactly the moves of the table the fighter has (`Fighter.strings`; for the crate only the rows without a Punch press, no punch move, no lunge, no tackle, which the test ties to `Fighter.resolveMove` returning nothing for a Punch), the "holding" or "carrying" line and the defense follow the fighter (`guardMode`). (5) Nothing scrolls sideways: the page of a heavy, a hold and a sway fighter on each device, and the main, mode, Controls, Settings, Unlocks, About, Pause, character and arena screens, are laid out in a frame 375 px wide, one 640 x 360 and one 1280 x 720 (so the vw units, the percentages, the phone rules and the minimum width of the panel resolve against that size); the screen and the page (and, for the Move list, the panel) must not run past the frame. Only the headless stub (no frames) passes it as "skipped"; in a browser, a frame that cannot be measured is a failure. Four older tests that read the old all-styles page now read the page of a fighter of the style they are about (a hold fighter's holds, the tackle row for a heavy fighter, the style names, each new move in its own style's list); three of them were renamed to say so; none was loosened.

### P17-14 and P17-16 (2026-11-03)

- P17-14, what Use does with a crate (read in the code first): with an item in hand, one Use press throws it (`Fighter.tryUse` calls `MatchSim.throwItem`; Crouch + Use drops it instead). A crate leaves the hands 1.0 m up at the slow throw speed, at the locked target or the way the fighter faces. A Grapple press drops a carried crate (`Fighter.dropBothHands`) and then starts the grab. The hint under the Move list table now says so: "Use [button] throws it; Grapple [button] drops it and grabs." The buttons come from the same helper as the rest of the page, so a keyboard, a pad and a touch screen each show their own.
- P17-16, cause: `SimRunner.run` builds its match with `items: cfg.items === true` and `hazards: cfg.hazards === true`, and `Story.simOpts` passed neither, so a simulated stage always played with no items and no hazards. The live stage gets both from `Game.beginMatch`, which reads the Items and Hazards options when the stage config does not say. Fix: `Story.simOpts` sets `items` and `hazards` from `Settings.v` the same way (on unless the option is off). A value in the stage config itself still wins in both paths.
- Fingerprints: none changed and none was re-recorded. The seeded 1v1 fingerprints and the hazards-on 1v1 fingerprints call `SimRunner.run` with their own options, not `Story.simOpts`. The only test that simulates stages (the whole-run test) checks structure, not a hash.
- Self-tests: 'Story (P17-16)' compares `Story.simOpts` with the real start of the stage (`Game.beginMatch`: its config and the match's `itemsOn` and `hazardsOn`) on all 7 stages (3 Arcade duels and 4 brawls) for all four combinations of the Items and Hazards options. The 'Move list (P17-04)' item test now also reads the carrying hint of every case on keyboard, gamepad and touch and checks that it names Use (throw) and Grapple (drop and grab) with that device's buttons.

### P17-11 sway polish (2026-11-03)

- What this is: four small faults in how a slip (side sway) is drawn, found in the review of P17-03. Drawing only: the sim, the i-frames, the stamina and the AI are not touched, and no fingerprint changed (none was re-recorded). The numbers below are from the 'Sway pose (P17-11)' self-tests, run on the old code and on the new.
- 1. The head snapped when a slip was hit on recovery tick 12 or 13.
  - Cause: while a slip lasts, the neck undoes the torso's bend and turn so the head stays level (`Fighter.levelHead`, used in `skeleton`). It was a yes / no switch that `computePose` cleared on the first tick of any other state. A hit on tick 12 or 13 arrives while the torso is still about two thirds and one third bent, so the whole undo vanished in one tick and the head jumped by the bend that was left.
  - Fix: `levelHead` is now a strength from 0 to 1. It is 1 during the slip and falls by a quarter a tick for `SWAY_NECK_TICKS` (4) ticks after it, and `skeleton` scales the undo by it. At 1 the drawing is the same as before.
  - Numbers: the largest extra head turn in one tick (against the same hit on a head at the guard) was 0.156 rad (9 degrees) at tick 12 and 0.085 to 0.12 at tick 13; now 0.031 rad (1.8 degrees) at worst over all 16 styles, both sides and all 15 recovery ticks (480 hits). The test allows 0.05.
- 2. The torso correction was exact only at the target pose.
  - Cause: the roll and the lean were worked out from the target turn, then blended with the old pose joint by joint (and the first tick blends from the idle stance), so on the first tick the sideways tilt was off by up to 0.022 rad (1.3 degrees) and the forward / back tilt by up to 0.015 rad (0.9 degrees). On the way out the old error was already under 0.002 rad, so the review's worry was real but small, and it was on the way in.
  - Fix: the three torso angles of a slip (turn, roll, lean) are no longer blended. `Fighter.levelTorso` sets them after the blend from the share of the pose that is drawn (`Fighter.swayOut`: 1 for every i-frame tick, then down to 0 over `SWAY_POSE_RETURN_TICKS`): the turn is that share of 0.35 rad, the bend that share of 0.3 rad, and the forward / back tilt is the guard's. The formulas are the ones P17-03 describes. So the torso is fully bent and turned on the first i-frame tick (it was 90 %) and the tilt is exact on each tick; the other joints, the root and the stance blend as before (`SWAY_POSE_BLEND` stays 0.9). This was tried first with the share read off the blended turn: it was exact too, but the roll of a guard that is turned far round (karateka, BJJ, Hapkido to `swayDir` -1) came out a little under the 85 % bar of "the drawn lean covers exactly the i-frames", and raising the blend to 0.95 to make up for it took the kickboxer heavy front kick to 0.3496 m, under its 0.35 m bar; this version passes both with room.
  - Numbers: tilt off by up to 0.022 / forward-back off by up to 0.015 rad (old, first tick) -> 0.000 / 0.000 at every tick of all 16 styles and both sides; the test allows 0.005 rad.
- 3. A slip went through ropes and props.
  - Cause: `Fighter.swayRoom` scaled the drawn offsets to keep the body inside the walls only.
  - Fix: `Arena.insideSolid` is the obstacle test of `resolveFighter` without the push (same colliders, same step-height and "can stand on it" rules, same body radius). `swayRoom` takes a twentieth (`SWAY_ROOM_STEP`) off the offset until the body stands clear. Ropes are colliders (the Gym ring ropes are `rail` objects), so they are covered by the same rule.
  - Numbers: the test puts the fighter flush against each of the four faces of every solid prop and rope on all 8 levels (1,020 set-ups, clear floor only, not on a stair) and slips back, and to each side, into the prop. Old code: all 1,020 sank into the prop, by 0.012 to 0.267 m. New code: none sank more than 0.01 m beyond how it stood before the slip (the test's limit).
- 4. The Hapkido heavy roundhouse slip touched the chest (owner decision, 2026-11-03: fix this one, accept the other 6 short slips).
  - Cause: the kick curves into the slip side, so stepping away to the side does not take the torso out of its path; the clearance was 0.250 m centre to centre, which is 0 cm of air (torso 0.15 m + kick 0.10 m).
  - Fix: `Fighter.startSway` now notes whether the foe is in a round kick (`move.anim === 'round'`: the roundhouses of every style) and `computePose` then adds `SWAY_POSE.curve` (0.15 m) to the slip's step back, 0.35 m instead of 0.2 m. A duck was tried first and made it worse (extra drops of 0.05, 0.10 and 0.15 m gave 0.210, 0.197 and 0.236 m at the worst timing, against 0.250 with nothing). The foe is read when the sway starts (when the buffered press is used, which can be a few ticks after the press), so the pose never changes in the middle of a slip. The extra step back applies to every style's round kick, not only Hapkido's; the full clearance test passes for all styles. Open (low): the slip torso is set from the guard pose alone, so the idle body sway is left out until the sway ends.
  - Numbers (heavy roundhouse, `swayDir` -1, strike going active on the first and on the last i-frame tick): torso clearance 0.291 / 0.250 m -> 0.386 / 0.331 m, air 0.0 -> 8.1 cm at worst (the bar is 4 cm); head 0.60 m -> 0.62 m. `shortSlips` floor for this entry 0.24 -> 0.32 (measured 0.331 minus 0.01). The other 6 entries keep their floors and pass.
- Self-tests added (all in the "Sway pose (P17-11)" group in `breakpoint-tests.js`; each fails on the old code): head after a hit (above; old code fails at 64 of the 480 hits); level torso (old fails on the first tick of every style); props and ropes (old fails all 1,020); Hapkido roundhouse air (old: 0.0 cm). `FMS`, `SWAY_POSE` and `SUPPORT_BASE_SLACK` were added to the test api list.

### P17-15 skipped self-tests (2026-11-03)

- The problem: a self-test that cannot run in the place it is run in returns a text that starts with "skipped: ". The runner counted that as a pass and the summary did not mention it, so a skipped check looked like a passed one.
- The fix: each result is still `{ name, pass, detail }` and a skip still has `pass: true` (the headless harness and the owner's runs count passes), but a skip now also has `skipped: true` (other results have `skipped: false`, or no `skipped` field for a test that threw or a tests file that failed to load, which reads the same). The summary line reads "Self-test: N passed, N failed, N skipped (of N) in N ms". The passed count does not include skips, so the three counts add up to the total. Under it comes a list "Skipped, not run here:" with each skipped test by name, and each skip is marked "[skip]" in the full list. The console line (`Diag.log`) carries the same counts and the names after "skipped:", and is a warning when anything failed or was skipped.
- The tests that can skip (only these two return a "skipped: " text; the other word "skipped" in the tests is a failure message in the Arcade results test, not a skip):
  - "Tournament (P11-03): the bracket of 8 drawn in the page fits ..." skips when the page has no style sheet, or the screens area cannot be measured, or it measures 0 high. Headless stub: it has no style sheets, so it skips. Real browser: it should never skip, but a hidden browser pane lays the page out at 0 high, so it would skip there.
  - "Move list (P17-04): neither the Move list nor the other menu screens scroll sideways ..." skips when the page cannot make a frame with a document inside it (no `contentDocument` on an iframe). Headless stub: it skips. Real browser: never, every real browser has frames.
- The guard: the last self-test, "Skipped tests (P17-15): no test is skipped where a real layout engine is present", looks at the results of all the earlier tests. If the run has a real layout engine (the same check the Move list test uses, now shared as `hasLayoutEngine`: an iframe has `contentDocument`) and any result has `skipped: true`, it fails and names them. In the headless stub it passes without skipping, so it is never a skip itself. Why this and not a check of the Tournament test's own conditions: it covers any test that is skipped later, and it catches exactly the hidden pane (a real engine, a 0-high page) that the problem was about. The check only asks whether the browser has frames, not whether the page is visible, so a hidden pane counts as a real browser and the guard fails there, as wanted.
- Fingerprints: none changed; the sim is not touched.

### P17-06 context actions (2026-11-03)

- Decided by the coordinator's delegate under the owner's standing go; the owner can change any row. One thing departs from an earlier owner line: P7-03 said "no hold" for Use. A hold is used here for one rare action (set down); the common ones (pick up, throw) stay a single press. See "Owner to confirm" at the end.
- Rules found in the code before the change (read first):
  - Pick up (Use press, empty-handed, `Match.itemInReach`): a floor item within 1.0 m inside a 70 degree cone in front, or within 0.55 m at the feet on any side; else a raised item (0.4 m or more above the feet) within 1.0 m plus the body radius (0.34 m) of the body centre, any side, the nearest. Nothing from 2.0 m above or 0.4 m below the feet. No wall test. Nothing on screen said which item it would be (every item has the same gold disc).
  - Throw (Use press with an item): at the locked enemy, else the way the fighter faces; fires on the press.
  - Set down (Crouch held at the Use press): keyboard C + E; gamepad tap-down-then-hold-down on the stick, then L2; touch DUCK (beside the left stick) and USE (right thumb) at the same time.
  - Crate: the same Use rules; Grapple puts it down and grabs (P17-14). Hazards and posts take no Use at all (they are struck, or hit by a thrown item). Touch USE showed only while an item was held or `itemInReach` found one; DUCK is a held button. The CPU plans and presses Use with `itemInReach`.
- What made it hard:
  - Pick up needed the right spot and the right facing: a fighter faces its foe, so a floor item behind or beside the fighter had to be walked onto (0.55 m) or the fighter had to stand with the foe on the item's side. Table and shelf items worked from any side, but nothing showed which item was meant when several lay near (a floor item in front beat the table item beside the fighter).
  - Set down needed two fingers on touch (Crouch + Use) and a stick gesture on a gamepad.
  - Use meant three things (take, throw, and with Crouch put down), and Crouch is a held button on a phone.
  - Nothing hid an item behind a wall or a tall rack from the reach test.
- The scheme (same on keyboard, gamepad and touch; no new button, so P2-01's no-clutter rule holds):
  1. Pick up: one Use press when empty-handed. `Match.itemToUse` takes, of the items within 1.4 m on any side from 0.6 m below the feet (a kerb, a stair step) to 2.2 m above them and with no solid wall between: first the one in front (within 1.0 m and the 70 degree cone, nearest the facing line); else the nearest, the first placed of two alike. A raised item (table, shelf, car top, deck, pillar bracket) and a floor item behind are taken the same way. No crouch, no exact spot.
  2. The cue: a bright ring under the one item a person's Use would take (`Match.useCues`, drawn by `drawItems`; the gold disc stays under every item). The touch USE button shows exactly while an item is held or `itemToUse` finds one. The ring and the button read the same function as the press.
  3. Throw: a short Use press with an item in hand throws it when the finger lifts (one tick to 29 ticks), at the locked enemy, else forward. Throw time moves from the press to the lift, which is 1 to 12 ticks (17 to 200 ms) for a normal tap.
  4. Set down: hold Use for `SETDOWN_TICKS` (30 ticks, 0.5 s) with an item in hand; it goes to the floor at the feet on the 30th tick, without waiting for the lift, and the lift then does nothing. A pick-up that is held on never puts the item straight down (the hold counts only if the press began with an item in hand).
  5. Crouch has no item job any more. It stays the low modifier of Punch, Kick, Defend and Grapple. A crate is the same: Use throws it, a hold of Use puts it down, Grapple still puts it down and grabs.
  6. The CPU is unchanged: `Fighter.tryUse` gives a CPU the old `itemInReach` and a person `itemToUse`; the CPU never sends the new `setDown` intent. So no CPU fight, balance run or fingerprint changes.
- Before and after, per device (everything else about Use is as before):

  | Action | Before: keyboard / gamepad / touch | After: keyboard / gamepad / touch |
  |---|---|---|
  | Pick up | E / L2 / USE, from the right spot facing it (floor) or within about 1.3 m (table) | E / L2 / USE, from anywhere within 1.4 m, any facing, the ringed item |
  | Throw | E / L2 / USE press | E / L2 / USE tap, thrown as the finger lifts |
  | Set down | C + E / tap-down-then-hold-down + L2 / DUCK + USE | hold E / hold L2 / hold USE for 0.5 s |
  | Which item | not shown | bright ring under it, the touch USE button lit |
  | Crouch needed | for set down | never for an item |

- Rejected:
  - Keep Crouch + Use for set down: two thumbs on a phone and a stick gesture on a pad; the cause of the complaint.
  - The ideas file's tap = drop, hold = throw: delays the common action (throw) and sets down by a tap, which is the accident people make.
  - A new permanent DROP or THROW button: breaks P2-01 (no clutter).
  - Double-tap Use to set down: the first tap would already have thrown the item.
  - Stick pulled back + Use: backing away while throwing is normal play, so it would set down by accident.
  - Make DUCK a toggle on touch: changes how low attacks and the low guard are made (P2-10); out of scope, and a stuck crouch is worse than a held button.
  - Use swaps the item in hand for the one in reach: a fourth meaning for Use, and it needs the same set down anyway.
  - Nearest item only, facing ignored: a floor item in front of the fighter (where the camera and the foe are) should win over a nearer one behind; the CPU reads it the same way.
  - Grapple sets a one-handed item down: a Grapple with a one-handed item must keep working (P17-14).
- Numbers: reach 1.4 m (`PICKUP_AROUND`; the old raised reach was 1.34 m, the old floor reach 1.0 m in front and 0.55 m at the feet), 2.2 m up (`PICKUP_UP`), 0.6 m down (`PICKUP_DOWN`; a subway kerb put a fighter 0.5 m above an item at its foot, and a first try with 0.4 m left it out of reach), a wall is anything more than 1.2 m (`REACH_OVER`) above both the fighter and the item that is not the object the item lies on (a table, bench or crate is reached over; a wall, a pillar or a tall rack is not; shelf and bracket items are taken from beside the rack). Set down 30 ticks. The ring is 1.35 m wide (`ITEM_CUE_SIZE`), the gold disc 0.95 m.
- Text (plain words, no design words): the Controls screen says "Use picks up the item marked by the bright ring on the ground (...; no crouching needed) and throws the one you hold; hold Use to put it down instead." The Move list shows, for a fighter holding an item, "Use [button] throws it; hold Use [button] to put it down. You never need to crouch." and for a crate "Use [button] throws it, or hold Use [button] to put it down; Grapple [button] drops it and grabs." with the buttons of the device in use. The P17-14 entry above and the P2-01 / P7-03 rows describe the earlier rule; this entry replaces them for Use.
- Self-tests added (breakpoint-tests.js, group 'Use (P17-06)'; the first one fails on the old pick-up rule): every kind of item on every placement row of every level (73 rows, 14 kinds, a spot the body really stands on, facing the item and away, 1,460 tries) picked up with Use alone on keyboard, gamepad and touch, with no Crouch in the intent; throw (tap, slow tap, 29 ticks), set down (hold, held on, lifted later) and the throw at a locked far enemy on each device, with and without Crouch held, and a held-on pick-up that keeps the item; no pick-up through a wall, past 1.4 m, 2.2 m up or 0.6 m down, over a 0.9 m wall yes, and every high item taken from beside its rack; several items (front, facing line, nearest, raised, tie, none); the ring under exactly the `itemToUse` item (and none for a CPU, a held item or out of reach) and Use taking the ringed item in 48 tries; the 375 x 667 and 667 x 375 layouts (USE 44 px or more, nothing else under a thumb on USE) and 30 pick-ups, 30 throws and 30 set-downs with one finger (through the page's own USE button where the browser has it); the Controls and Move list text. One earlier test was adapted to the new rule, not loosened: 'Items: Crouch + Use drops ...' now sends the set-down intent instead of Crouch (the throw, the wear and the touch USE parts are as before).
- Fingerprints: none changed and none was re-recorded; the sim a CPU runs is the same code path.
- Decided 2026-11-03 19:40 (The owner said at 19:36, verbatim: "1.,3.,4. select the correct option among the options"): the hold is kept. Why: it is the only way to set an item down with one button and no crouch, which is what P17-06 asked for on touch, and the release throw costs at most 0.2 s on a tap. This replaces P7-03's "no hold" for Use.
- Owner to confirm (asked before 19:40, (1) and (2) now decided as above): (1) set down is a hold of Use (0.5 s); (2) a throw now leaves as the finger lifts, not on the press; (3) the look of the bright ring (colour and size) in a browser; the headless run cannot show it.

### P18-34 CPU item throws (2026-11-03)

- Decided by the coordinator's delegate under the owner's standing go ("balanced", keep it simple); the owner can change any number. The owner's words (Arcade playtest): the CPU throws pickable items very often.
- What the code did before: a CPU with no attack token fetched any floor item within 2.5 m that was nearer than its target, and a CPU holding a bottle, a brick or a crate threw it at once when the target was 3 to 8 m away (a crate at any range up to 8 m). Nothing limited how many it fetched: in a group every enemy without a token did the same, one after the other, and a fighter fetched the next item a few seconds after the last throw. Easy had no brake at all.
- Measured on the old code (headless, `SimRunner`, items and hazards on, 16 seeded fights per row over the 8 arenas and many fighter pairs; both sides are CPUs, so every fighter counts; throws per minute of fight, all fighters together):

  | Difficulty | Free Fight 1v1 | Brawl 1v3 | 1v1, player kiting | Brawl, player kiting | Most in one fight | Closest two throws by one fighter |
  |---|---|---|---|---|---|---|
  | Easy | 0.15 | 0.61 | 0.58 | 0.78 | 5 | 68 ticks (1.1 s) |
  | Normal | 0.80 | 1.15 | 0.79 | 1.05 | 5 | 109 ticks |
  | Hard | 0.90 | 1.27 | 0.47 | 1.22 | 4 | 26 ticks |
  | Expert | 0.64 | 1.55 | 0.14 | 1.68 | 5 | 95 ticks |

  "Kiting" = fighter 1 only keeps 4 to 6 m from its foe and never attacks (the worst case for a CPU that throws at range). The averages look modest; the trouble is the bunching: up to 5 throws in one fight, two within a second or two of each other, and three enemies throwing in turn.
- The decision (one rule, no random number, so seeded fights stay repeatable): each team has a rest window, `AI_TOSS_REST_TICKS`: Easy 5400 ticks (90 s), Normal 3600 (60 s), Hard 2700 (45 s), Expert 2400 (40 s). When a CPU takes a throwable (bottle, brick) or a crate into its hand, `MatchSim.tossAt[team]` is set to the tick (`takeItem`); until the window is over no CPU of that team wants another throwable or crate (`AIController.wantsItem`, which also drops a pick-up plan whose treat a team-mate took on the way). So a team throws at most once per window: the next throw needs the next take. It holds for enemies and allies alike (the same `AIController`); a person's own pick-ups never start the window, and the two teams of a fight have a window each.
- Not changed: melee items (bat, pipe, stick, chair and the others) are fetched and used as before; a CPU that already holds a throwable or a crate throws it as before (a crate is never kept in the hand); the fetch range (2.5 m), the throw range (3 to 8 m) and what a thrown item does. The window opens at the take, not at the Use press, so the fetch itself plays as before.
- Rejected: a random chance to fetch or throw (a new random draw changes every seeded fight and repeats badly in small fights); a per-fighter cooldown only (three enemies still throw three in a row, the complaint); a cap per fight (a long Brawl would end with no throws at all, and a short one with the whole cap at the start); no throws at all on Easy (the window already makes Easy the rarest: 90 s); a distance-based chance (the throw range already is 3 to 8 m); opening the window at the Use press (the CPU then plans something else in the 10 ticks of the grab and carries the crate about for 3 s before it throws).
- Measured on the new code (same fights and seeds, throws per minute of fight, all fighters):

  | Difficulty | Free Fight 1v1 | Brawl 1v3 | 1v1, player kiting | Brawl, player kiting | Most in one fight | Closest two throws by one fighter |
  |---|---|---|---|---|---|---|
  | Easy | 0.00 | 0.28 | 0.19 | 0.25 | 1 | none twice |
  | Normal | 0.20 | 0.56 | 0.30 | 0.60 | 1 | none twice |
  | Hard | 0.58 | 0.78 | 0.32 | 0.57 | 3 | 2784 ticks (46 s) |
  | Expert | 0.63 | 0.73 | 0.14 | 0.60 | 2 | 2570 ticks (43 s) |

  The 1v1 rows hold 0 to 5 throws each, so a row moves either way with chance (Hard Free Fight 0.90 to 0.58, Easy 0.15 to 0.00); the brawl rows, where the bunching was, fall by 39 to 54 percent (Easy 0.61 to 0.28, Normal 1.15 to 0.56, Hard 1.27 to 0.78, Expert 1.55 to 0.73; with a kiting player by 43 to 68 percent), and the most in one fight falls from 4 or 5 to 1 on Easy and Normal and 3 or 2 on Hard and Expert (a 2-minute brawl holds two or three windows). Fetches of all items in the Easy brawl fell from 86 to 75, the throwables and crates that the window holds back.
- The decided rate, per team and difficulty: at most 1 throw per rest window, i.e. at most 0.67 (Easy), 1.0 (Normal), 1.33 (Hard) and 1.5 (Expert) throws per team-minute in the worst case, and the seeded test set (3 Free Fights and 5 brawls per difficulty, the fights that threw 2 to 4 times each before) must stay under 0.3 / 0.8 / 1.0 / 1.0 per team-minute. That set gave, per team-minute, 0.36 / 1.69 / 1.17 / 1.66 before and 0.21 / 0.55 / 0.81 / 0.73 after.
- Self-tests added (breakpoint-tests.js, group 'CPU item throws (P18-34)'; the first one fails on the old code: for example Easy seed 5 team 1 threw at ticks 74 and 138, Normal seed 5 at 64, 135, 235): (1) over that seeded set a team never throws more often than once per window (1 + fight ticks / window) and the set stays under the rates above; the constants equal the decided ones; (2) a CPU still fetches a floor brick, takes it and throws it at 3 to 8 m, the take sets the window of its own team only, a brick and a crate are not wanted one tick before the window ends and are wanted at its end, and a bat is wanted inside it. The P7 item tests (CPU fetch and throw of a bottle, the crate thrown at any range, levels, hazards) pass unchanged.
- Fingerprints: the three Free Fight hashes (Hard, Easy, Expert; no items) and the old-layout hashes are unchanged. Of the three hazards-and-items hashes (`HAZARD_1V1`) Rooftop is unchanged; Garage went from 54:1ch5240 to 85:1tnve97 and Construction from 49:kjptyk to 84:1lk7k6v, because a team's second brick or crate now waits for the window (the first take and throw of each fight are the same ticks as before: Garage take at tick 81, throw at 87). The test "Brawl camera" walks the player behind each prop with 3 Normal enemies on seed 5; the enemies' new item play moved them and the warehouse camera was hidden 141 ticks (limit 54), so it uses seed 6 now. Seeds 3 and 8 give the same long hiding on the code before this change, so this is a camera weakness that depends on where the enemies stand: not fixed here, open for the owner or a camera task. The same happened to "N fighters: a 1v6 brawl runs to a winner ..." (seed 5, two bodies squeezed to 0.24 m, the test wants over 0.3 m): it uses seed 6 now, and seed 2 squeezed bodies to 0.15 m on the code before this change, so crowding can still stack two bodies in some seeded brawls (now P18-36, with the camera).
- Easy 1v1 decided 2026-11-03 19:40 (The owner said at 19:36, verbatim: "1.,3.,4. select the correct option among the options"): Easy keeps its 90 s window. Why: the window only holds back a team's second throwable; the first of each fight is untouched, and the Easy 1v1 count was 2 throws in 16 fights before, so a shorter window would not bring more throws to a short Easy 1v1, only to Easy brawls, where the owner asked for fewer.
- Known lows (review): the Training dummy on a CPU level is not throttled (its AI sits inside the dummy controller), and a CPU walking to a melee item can take a nearer throwable in reach while its window is closed, which restarts the window; both rare. The Easy cap in the test is 0.3 so the rate check binds (the set gave 0.36 before).

### Path reorder (2026-11-03)

- Request (owner, 2026-11-03 19:56, verbatim): "Also for the tasks not yet started reorder logically and normalize them to follow one path without uncertainties and instructions that are x here and y there". Done by the coordinator's delegate; the owner can change any row.
- What moved: the 61 task IDs that were open and not started (P12-01 to P12-07, P13-02, P14-02 to P14-05, P15-01, P15-02, P16-01 to P16-04, P17-01, P17-02, P17-09, P17-10, P18-01 to P18-33, P18-35 to P18-40) are now in the section "Path - the open tasks in order", in 18 stages. Each old phase keeps one line naming what moved. Left in place: the ticked tasks, the tasks done in code that wait for the owner (P4-08, P6-06, P17-04, P17-05, P17-07, P17-08), and the partly done ones (P11-02, P15-03, P17-03). No ID was changed; no task was dropped.
- Stage order, with the cause where it is not obvious:
  1. Critical fixes (P18-39, P18-40); 2. stamina (P18-33, the owner's priority of 2026-11-03 19:40); 3. bugs (P18-38, P18-25 + P18-32, P18-36); 4. the Phase 17 audits and polish (P17-01, P17-02, P17-09, P17-10); 5. timing and speed; 6. modes and difficulty; 7. Arcade and Survival brawls, goons, allies; 8. abilities and the ultimate; 9. group attacks; 10. environment, start side, menu audit; 11. fighter looks; 12. story text; 13. research and identity; 14. audio and visual; 15. balance; 16. online; 17. performance and size; 18. final audit.
  - P18-18 and P18-19 (the mode merge) run before P18-05 (difficulty), which the owner's list had the other way round: P18-05 lists Versus, Brawl and Co-op Brawl, which the merge removes, so it is done once on the final mode list.
  - P18-01 (speed) sits in Stage 5 with the timing work, because both re-record fingerprints and the speed must be settled before abilities, group attacks and balance runs.
  - P18-20 + P18-37 and P18-21 run before the story text P18-35, because the cast and ally rules change which story rows exist.
  - P18-27 runs before P18-14 (it is one of the X-factor options), and P18-26 before P18-15 (its result feeds the price estimate).
  - P13-02 runs before the sound pass P18-28 and builds feedback rows 12 and 13 (impact layers, heartbeat), so the audit finds them in place.
  - P12-05 (determinism) and P12-04 (CSP under WebRTC) run before P12-01, P12-02 and P12-03, which the owner's list had in number order: the netcode needs a deterministic sim and the connection is tested under the real CSP.
  - P17-02 runs before P17-10, so the new style moves must pass its hit check; the Phase 17 audit P17-01 follows the critical sweep P18-40.
  - Balance (P14-02 to P14-05) runs after all content, and P14-02 now also lists the abilities, the ultimate, the group attacks and the goon variants.
  - New tasks that P17-01, P18-27 and P18-14 create are added at the end of their own stage; they replace "before Phase 16".
- Merges (both IDs kept on the task line):
  - P18-03 + P18-04: P18-04 (readable timing, flashes, sounds, Training readout, help text) is the second half of P18-03; one Done when.
  - P18-25 + P18-32: P18-25 was the check and the decision, P18-32 the implementation of that decision; the check comes first (the owner's line covers enemies only).
  - P18-20 + P18-37: P18-37 sets the Arcade half of P18-20; Survival stays in P18-20. P18-21 implements both.
  - Appendix A's coverage map was updated for these three merges only.
- Contradictions resolved (old text, winning rule, source):
  - P12-01 "DECIDE whether to add QR display / scan" against the decision "QR display: yes; scan only where BarcodeDetector exists" (Appendix C, Online signaling, 2026-10-29): the decision wins; P12-01 now states it.
  - P12-02 "delay-based or rollback" against "delay-based lockstep, rollback only later" (same entry): the decision wins.
  - P12-05 and Appendix D row D08 (hitstop halved by Reduced motion, open) against P13-03 (2026-11-02: Reduced motion no longer shortens hitstop): P13-03 wins; P12-05 proves it with a test and closes the row.
  - P12-06 "usable on touch and gamepad" against global rule 3 (touch, gamepad and keyboard): the rule wins; keyboard added.
  - P14-02 "each story setting if it affects gameplay" against "story settings never change stats or a fight rule" (Appendix C, Story lists): the story settings are dropped from the table. "age, gender" against "look only" (P6-04, P6-05): they are listed as look only and exempt from the unique-profile rule.
  - P17-09 against the P1-04 families that share animation: the owner's rule of 2026-10-31 (share only where the real arts do) wins; the share list of P17-09 is the one list.
  - P18-06, P18-10 "26 fighters" against 32 presets (6 kept + 26 new, P5-04): 32 (as of 2026-10-29).
  - P18-08 (an ultimate that needs charging) against the P1-03 rejection of resource-spent specials and taunt-for-meter: the owner's request of 2026-11-01 wins; the ultimate uses existing buttons only.
  - P18-16 "a 1v1 in a ring draws the start side ... fights without a ring always start left" against P17-08 (every 1v1 except Training draws and swaps it, ring or not): P17-08 wins (as of 2026-11-03).
  - P18-32 "allies by the friendly-fire rule" and the P4-01 rule "CPU enemies never hurt each other" against the owner's "when throwing an enemy the thrown enemy cant hit other enemies" (2026-11-03): the owner wins for thrown bodies only; nothing else about enemy-on-enemy damage changes.
  - P18-20 "Arcade and Survival allies set by the player" (owner, 2026-11-01) against P18-37 "depending on the story you might get cpu allies" (owner, 2026-11-03 19:56): the newest wins for Arcade (allies come from the story); Survival keeps the player setting. If the owner wants a player setting in Arcade too, this is the one row to change.
  - P18-37 "at most 3 main fighters as bosses" against the current run, which has 4 (rival A, rival B, boss, ZERO; Appendix C, Arcade story structure): the cap wins; the task decides which one stops being a main fighter (recommended: rival B).
  - P18-29 "within the performance budget (P15-02's audio voices)" against the order (P15-02 comes later): the cap of 12 impact voices from P13-01 row 12 is the budget.
  - P18-14, P18-15 and P18-26 keep the owner's own wording (the owner picks the X-factor, has read the price report, picks from the release recommendation); an earlier draft of this reorder had handed those to the coordinator, and the review put them back.
  - Answered (owner, 2026-11-04 00:30, "each stage's boss bring their own goons!"): the goons take the theme of each stage's boss, not only the final opponent's, so a run has one goon theme per main-fighter boss.
  - P17-01 "fix task (P17-02 to P17-10)" listed done tasks: it now names P17-02, P17-09, P17-10 or a new task added at the end of Stage 4.
  - P18-33 "Priority: moved up; the next task after this stop, before P17-01": now Stage 2, after Stage 1 and before Stage 4.
- Hedges turned into a recorded choice or a DECIDE (the coordinator picks the recommended option and records it here):
  - Answered by a recorded decision: QR (P12-01), delay-based or rollback (P12-02), the story settings and gender (P14-02), the sit-out rule, Friendly fire and the Versus score in P18-18 (P4-07, P4-08), the Arcade ally source (P18-20 + P18-37), the ultimate against the rejected specials (P18-08), "if added" for the combo break (P18-03 + P18-04, tied to the choice in P18-02).
  - Now an explicit DECIDE with a recommended option: speeds (P18-01, +10 percent as a start), combo break A or B and the window (P18-02), the difficulty step (P18-05), the setup screen layout (P18-18), the stamina share (P18-33), the drawn or sim reach of a failing move (P17-02), the thrown-body numbers (P18-25 + P18-32), the brawl-to-boss map, the boss cap, the goon variant count and the Survival record rule (P18-20 + P18-37), the ability count and how custom fighters get abilities (P18-06), the ultimate's charge, scope, input and cost (P18-08), the start-side rules (P18-16), the X-factor pick (P18-14), the chosen accessibility changes (P18-27).
  - The share-code and store "version bump if needed" of P18-07 became: the ability field is appended like Age and Gender (no bump; old codes take the default).
- Numbers and facts corrected, each marked "as of": fighters 26 to 32; the start-side rule (P17-08); the P0-04 benchmark note for P15-01 (not comparable with runs before P17-08); P14-05 now carries the bands of the P14-01 ladder rows; P13-02 now lists the rows of the P13-01 table that are still new.
- Where a task keeps an owner step: the owner's OK on the story sample (P18-35), the owner's Easy Arcade run (P18-33), the owner's pick of the X-factor (P18-14), the price report (P18-15) and the release choice (P18-26). Everything else is the coordinator's.
- Checks run on this edit: the list of task IDs with their ticked state before and after is identical (61 open IDs moved, all ticked tasks in place); every ID in the Path stands once; the file keeps its CRLF line endings and its BOM.

### P18-39 Tournament fighter choice (2026-11-03)

- Root cause: Tournament reuses the co-op join screen, where only a joined device (Punch or A) has a fighter card. Start with nobody joined drew the bracket at once with the default fighter (party[0], Kai), so touch and mouse had no pick.
- Fix: Start with nobody joined opens the same fighter screen as the other modes; its confirm draws the bracket with that fighter, Back returns to the join screen. The Versus flag for P2's pick is cleared there, so a Versus game before cannot keep Back on the fighter screen (seen in the Chrome self-test run).

## Appendix D - Audit findings

(Filled by P0-02 and P16-01. Columns: ID, severity, area, location, reproduction, fix task, status.)

### P15-03 first size pass (2026-11-03)

- Size (LF, BOM counted, `breakpoint.html`): 1,199,913 before, 1,157,562 after; 42,351 bytes freed, 42,438 bytes now left under the 1,200,000 budget (87 before). The 585,241 baseline is in P0-01.
- Where it came from (about): long doc comments cut by hand to the rule and the why 10.0 KB; one-line trims of the remaining long comments (first clauses kept, 265 comments) 27.2 KB; task-id tags like "(P7-05)" and the spare spaces before trailing comments 3.3 KB; the eleven "=====" section banners folded to one line 1.5 KB; dead code 0.7 KB (the rounded parts add to 42.7 of the 42.8 KB). Nothing else was touched: no code, data, CSS or player text.
- Safety: the code with every comment removed is identical to HEAD apart from the dead code below (checked with two separate comment strippers); `node --check` passes; headless run 461 / 478 with exactly the 17 known failures (16 "needs the main menu", 1 "blank faces"); every fight, hazard, items and weapons fingerprint passes unchanged and none was re-recorded.
- Dead code removed (each name is only defined or written in `breakpoint.html`, never read, and is not in `breakpoint-tests.js`): constant `DEBRIS_REPLACE_FRAME`; method `Arena.navCell`; `UI` fields `setupSel` and `lastToast`; `Sound` field `humNode`; `Debris` pool fields `born` and `maxLife`; `Fighter` fields `hitDirX`, `hitDirZ`, `fvx`, `fvz`; `MatchSim.disposed`; `Showcase` field `orbit`; `AIController` snapshot fields `pendingThrow` and `mvCat`.
- Kept on purpose: `MatchSim.reviveTeam` and `COOP_REVIVE_HP` (no game caller yet, but a self-test uses them); `opponentHp` and the other `simulate` result fields (a public result shape); every comment that holds a data format, a key legend or a rule that is not obvious from the code (shortened; a few return-value and side-effect notes were dropped by the trims and restored after review); aligned trailing comments in tables (only the standard 3-space gap was narrowed).
- Looked at and left: repeated string literals (14 of 20+ characters, under 1 KB in all), repeated lines (short code lines, no shared helper would be smaller or clearer), unused CSS (none: all 143 classes are used, the `seat3` and `tc0` to `tc7` ones are built from a number), spaces inside number arrays (about 3 KB, but it would hurt reading the tables), indentation (55 KB, kept for readability).
- For the final pass: about 214 KB of comments remain (block comments 113 KB, trailing comments 88 KB, full-line `//` comments 12 KB), the biggest lever left; the P3-10 and P14-01 balance numbers are in this log already, so their code comments could shrink to a pointer.

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
| D19 | Medium | Throws | `Fighter.startThrow` | Strong throw at 0 stamina keeps x1.5 damage | P3-08 | [x] fixed: strong throws were removed in P2-10; P3-08 adds a self-test for throw damage at 0 vs full stamina |
| D20 | Medium | Loop / errors | `Game.fail` (`errorCount`) | 9th caught error in a session stops the loop for good | P0-07 | [x] fixed: Return to main menu resets the count and restarts the loop |
| D21 | Medium | Self-test health | real matchEnd -> VICTORY -> RESULTS path, preview return | Tests set states directly, so D04 passed 114/114 | P0-07 | [x] fixed: two self-tests (real knock-out to RESULTS; preview return to CHARSEL); the About screen keeps the results |
| D22 | Low | Input / storage | `KeyBindings.load`, `Store.set`, `Progress.save`, `pollPad`, onboarding card, `touchStrike` | Unbound fallback key; one failed write disables storage for the session; two tabs overwrite saves; non-standard pad toast repeats; pad cannot close the controls card; two touch attacks in one tick drop one | P0-07; two tabs: P10-05; touch: P2-04 | [x] fixed for P0-07: unbound key list, write retry with one warning, toast once per pad, pad closes the card. Open: two tabs (P10-05), touch (P2-04) |
| D23 | Low | HUD / a11y | `#warn` under touch stick; `user-scalable=no`; spinbutton Up/Down move focus | Low-stamina warning hidden on touch; no pinch zoom in menus | P2-04, P2-08 | open |
| D24 | Low | Renderer | `WEAK_GPU`, `R.push` culling uses `proj[5]`, shader `vN` precision, per-frame arrays | Strong Linux / Mac GPUs rated low; props vanish at the screen edge in portrait; paper debris shading breaks on 16-bit GPUs; GC churn | P15-02 | open |
| D25 | Low | Combat | `resolveCombat` trade order, `tryEscape` one-tick bias, `blockHit` hp floor, impact / attack id overlap, per-tick allocations | Grab vs strike on the same tick favours P1; P1 gets one more escape tick; block at hp 0.6 sets hp 1 | P3-08 (allocations: P15-02) | [x] fixed in P3-08: strike before grab on the same tick (either player), equal escape window, chip damage never raises health, scenery ids negative. Open: per-tick allocations (P15-02) |
| D26 | Low | Storage | `CustomRoster.init` | Corrupt custom data is overwritten by the next save | P6-11 | open |
| D27 | Low | Game flow | `onNextRound` order, `errmenu` skips `quitToMenu`, preview clears the Versus score, menu shows the smashed arena, self-test leaks 4 matches and plays sounds | Auditor notes per item | P0-07; self-test sounds: P16-01 | [x] fixed: round order, error path uses quitToMenu, Versus score kept, menu arena rebuilt, self-test matches disposed. Open: the self-test still plays sounds, because some tests need the live listeners (P16-01) |
| D28 | Low | Benchmark / runner | benchmark used up the onboarding card and left the menu arena; unknown arena threw | `BREAKPOINT.benchmark()` on a new profile | P0-03 | [x] fixed |
| D29 | Info | Various | KO -> IDLE log comes from a deliberate self-test; decider tie goes to P1; share-code trimming is silent; style index in share codes must stay append-only; quick rise uses the dash input; grunt nodes not disconnected; CSP `frame-ancestors` needs an HTTP header if hosted | - | P2-02 (quick rise), P5-03 (style ids), P14-04 (tie), P12-04 (CSP) | noted |
