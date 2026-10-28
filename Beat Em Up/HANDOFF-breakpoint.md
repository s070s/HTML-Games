# Breakpoint - resume prompt

Paste the text below into a new Claude Code session opened in `C:\Users\GS\Desktop\Dev\HTML Games`.

---

Continue the Breakpoint tasklist (`Beat Em Up/TASKLIST-breakpoint.md`) on `main`, no new branches.
- **Progress:** Phases 0-2 and 4 are done. In Phase 3 every task is implemented and pushed; P3-09 (momentum boost) and P3-10 (combo audit) stay unticked only for their all-pairs win-rate check, which waits for P14-01. Phase 5: P5-01 to P5-04 are done (16-style data model, own stances and signature moves for the 9 new styles, 32 presets with unlocks). P5-05 waits for P10-02 (its list of story poses). Next is Phase 6 (character customization).
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
- File size: the stored (LF) `breakpoint.html` is about 1.08 MB against the P1-05 budget of 1.2 MB (target 1.05 MB); keep new tests and rows compact.
- Fighter select: with 33 cards the hint line and the Arcade difficulty row sit below the grid, and arrow / pad navigation steps one card at a time.
- Brawl camera: the occlusion pose search tests the aim point before `keepInFrame` shifts it (no hide found, 0.3 m side rays cover it). Bosses other than ZERO have no `bossAttrs`; ZERO's P1-07 look fix waits for P9-04.
- Co-op: tried on screen with two keyboard players only, not with real gamepads.
- Styles left for later: no BJJ ground game, no MMA sprawl, Kali has no stick (P7) and no triangle step, Wing Chun's trap does not pin an arm, victory poses are the old six.

How to work:
- **Encoding:** `breakpoint.html` and the tasklist are CRLF with a UTF-8 BOM. Edit them with the Edit tool or node scripts that replace exact strings, never `sed -i` in Git Bash. Check that `rg -c '\r$'` equals `rg -c ''` and that the first bytes are `ef bb bf`.
- **Batches:** one implementer agent per batch (general-purpose, sonnet, effort high), then an independent reviewer agent (opus, high) on the saved diff. Fix medium and higher findings, tick the tasks, commit (`Breakpoint: P4-xx - ...`, no AI attribution), and push after `git fetch` plus `git rev-list --left-right --count origin/main...HEAD`.
- **Headless tests during work:** use the Node runner in the session scratchpad: `extract.js` pulls the inline script, and `harness.js` stubs the DOM and runs `SelfTest`. `node harness.js game.js balance <seeds> <difficulty>` prints the Block vs Sway split. If the scratchpad is gone, rebuild both from the self-test API. 15 checks need a real browser (rumble, onboarding, "needs the main menu", "Menus: choosing", "Results: presses").
- **Browser test before each commit:**
  - Start the `games` preview server (127.0.0.1:8765).
  - In Playwright, open `http://127.0.0.1:8765/Beat%20Em%20Up/breakpoint.html` and accept the leave-page dialog.
  - From the main menu, run `await BREAKPOINT.selfTest()`: 257 checks at the last push (about 14 s), and all must pass.
  - Close the browser and stop the server after each check, then delete `.playwright-mcp/` at the end.
