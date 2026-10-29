# Breakpoint - resume prompt

Paste the text below into a new Claude Code session opened in `C:\Users\GS\Desktop\Dev\HTML Games`.

---

Continue the Breakpoint tasklist (`Beat Em Up/TASKLIST-breakpoint.md`) on `main`, no new branches.
- **Progress:** Phases 0-2 and 4 are done. In Phase 3 every task is implemented and pushed; P3-09 (momentum boost) and P3-10 (combo audit) stay unticked only for their all-pairs win-rate check, which waits for P14-01. Phase 5: P5-01 to P5-04 are done (16-style data model, own stances and signature moves for the 9 new styles, 32 presets with unlocks). P5-05 waits for P10-02 (its list of story poses). Phase 6: P6-01 (item list), P6-03 (fitness picker), P6-04 (age) and P6-05 (gender) are done; body, age and gender change looks and weight class only, never stat points. Next: P6-02 (items with shared generators; only 2 parts of headroom left under the 40-part rule), then P6-06 to P6-11.
- **Budget:** work until about 35% of the weekly Claude usage, never past 40%. Read it with the usage tool before each batch and stop at a clean boundary before it.
- **Finish:** commit and push everything on main, then clean up. At the end give me a table of all changes and, if any, a table of locked folders and files to delete. Keep `C:\Users\GS\Desktop\Locked folders.txt` up to date.

Already decided, do not reopen (details in Appendix C, "Phase 3 owner decisions (2026-10-28)"):
- **Attacks:** no hold anywhere; attacks fire on press. Strong moves come only as steps of fixed attack strings: the default STRINGS table plus per-style overrides (STYLE_STRINGS, P3-10). A strong punch comes from a Punch press and a strong kick from a Kick press. A strong string step breaks any non-perfect block.
- **Defense:** each fighter has Block or Sway, defaulting from the style.
  - Block: hold Defend; Crouch + Defend = low.
  - Sway: press Defend for a 12-tick strike dodge with 15 recovery ticks; a late sway is a perfect sway that opens a counter.
  - Block vs Sway AI is balanced at 45-55% on every difficulty (300-seed runs).
- **Holds:** submission holds only on a downed foe (Wrestling, Judo), with a Defend vs Grapple tapping contest of at most 4 s.
- **Heavy tackle:** only for a weight-class gap of 2 or more, triggered by running into the foe. Block stops it; Sway or sidestep dodges it. Weight classes come from body size until P6-03.
- **Use:** no hold. Tap = throw, Crouch + Use = drop, Use near an item = pick up. P7-03's task text still says "hold" and must be corrected when P7 starts.
- **P4-07 co-op:** friendly fire is a setting, off by default, and only between players (CPU enemies never hurt each other). A knocked-out player sits out until the next stage, and the level is lost only when everyone is out (`reviveTeam()` is the hook for stages).
- **Tips:** tips and controls cards show once only (seenClinch, seenHold, seenControls).

Known small issues to keep in mind:
- Releasing Crouch during a hit-freeze can change a queued attack's height.
- Touch auto-height does not use the crouch strings.
- At Hard, Sway presets (Yuki, Mara) now beat Block heavies more often; preset matchups are for P14.
- The AI never uses the heavy tackle.
- The new hold and clinch-strike poses were never looked at on screen.
- File size: the stored (LF) `breakpoint.html` is about 0.77 MB against the P1-05 budget of 1.2 MB (target 1.05 MB). The self-tests moved to `breakpoint-tests.js` on 2026-10-29 (about 0.44 MB, not counted); keep new rows compact.
- Fighter select: with 33 cards the hint line and the Arcade difficulty row sit below the grid, and arrow / pad navigation steps one card at a time.
- Brawl camera: the occlusion pose search tests the aim point before `keepInFrame` shifts it (no hide found, 0.3 m side rays cover it). Bosses other than ZERO have no `bossAttrs`; ZERO's P1-07 look fix waits for P9-04.
- Co-op: tried on screen with two keyboard players only, not with real gamepads.
- Styles left for later: no BJJ ground game, no MMA sprawl, Kali has no stick (P7) and no triangle step, Wing Chun's trap does not pin an arm, victory poses are the old six.

How to work:
- **Encoding:** `breakpoint.html` and the tasklist are CRLF with a UTF-8 BOM; `breakpoint-tests.js` and this file are CRLF without a BOM. Edit them with the Edit tool or node scripts that replace exact strings, never `sed -i` in Git Bash. Check that `rg -c '\r$'` equals `rg -c ''` and that the first bytes are `ef bb bf` (not for the tests file or this file).
- **Self-tests:** they live in `breakpoint-tests.js` next to the game, not in `breakpoint.html` (Appendix C, "Self-tests in their own file"). Add and edit tests there. A test that needs an internal game binding that is not yet in the destructuring at the top of that file needs the name added there and in `testApi()` in the game; a binding the tests reassign goes through `api.get` / `api.set`. Test-only helpers go into the tests file.
- **Batches:** one implementer agent per batch (general-purpose, sonnet, effort high), then an independent reviewer agent (opus, high) on the saved diff. Fix medium and higher findings, tick the tasks, commit (`Breakpoint: P4-xx - ...`, no AI attribution), and push after `git fetch` plus `git rev-list --left-right --count origin/main...HEAD`.
- **Headless tests during work:** use the Node runner in the session scratchpad: `extract.js` pulls the inline script, and `harness.js` stubs the DOM, answers the game's `<script src="breakpoint-tests.js">` by running that file in the same context (`$BREAKPOINT_DIR` overrides the folder, default the Beat Em Up folder), then runs the tests from `selfTests`. Usage: `node extract.js "<path>/breakpoint.html" && node --check game.js && node harness.js game.js` (260 of 275 expected); `node harness.js game.js balance <seeds> <difficulty>` prints the Block vs Sway split (47 / 54 at Hard over 300 seeds); `node harness.js game.js loader` checks the loader only. If the scratchpad is gone, rebuild both: extract the inline script and replace the `boot();` line by `globalThis.__ev = (s) => eval(s);`; stub `document.createElement("script")` and `document.head.appendChild` so that a script element with a `src` evaluates that file's text and then calls its `onload` (a missing file calls `onerror`); then `await ev("loadSelfTests()")` and `ev("selfTests.run_all()")`. 15 checks need a real browser (rumble, onboarding, "needs the main menu", "Menus: choosing", "Results: presses").
- **Browser test before each commit:**
  - Start the `games` preview server (127.0.0.1:8765). The tests file must be served from the same folder as the page. Without a server, `file://` works too: open `breakpoint.html` from the Beat Em Up folder in Chrome.
  - In Playwright, open `http://127.0.0.1:8765/Beat%20Em%20Up/breakpoint.html` and accept the leave-page dialog.
  - From the main menu, run `await BREAKPOINT.selfTest()` (it returns a promise; the first call loads `breakpoint-tests.js`): 275 checks at the last run (about 15 s), and all must pass. If the file is missing it answers "Self-test file breakpoint-tests.js not found next to the game".
  - Close the browser and stop the server after each check, then delete `.playwright-mcp/` at the end.
