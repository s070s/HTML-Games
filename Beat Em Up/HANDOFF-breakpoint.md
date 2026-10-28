# Breakpoint - resume prompt

Paste the text below into a new Claude Code session opened in `C:\Users\GS\Desktop\Dev\HTML Games`.

---

Continue the Breakpoint tasklist (`Beat Em Up/TASKLIST-breakpoint.md`) on `main`, no new branches. Phases 0-2 are done (last pushed commit 615e992; the local commit that wrote this prompt is not pushed yet, push it with the next batch). Next is Phase 3. Work until 20% of the weekly Claude usage (read it with the usage tool before each batch) and stop before it at a clean boundary. Commit and push everything on main, then clean up. At the end give me a table of all changes and, if any, a table of locked folders and files to delete, and keep `C:\Users\GS\Desktop\Locked folders.txt` up to date.

Before Phase 3 code, ask me once, batched:
1. P3-02 Block rules (perfect block, guard break, chip damage, stamina cost) and Sway rules (i-frame window, recovery, counter window). Each fighter has exactly one of the two.
2. P3-04 submissions with minimal inputs and an escape that works on touch; P3-06 heavy tackle yes / no and the weight threshold.
3. P3-10 combo audit: confirm or change the limit "no single string above 35% of a fighter's damage" (AI vs AI matches currently deal about 80% of their damage with kicks).
4. Should USE keep tap = drop / hold = throw, or lose its hold too?

Already decided, do not reopen: attacks fire on press with no hold anywhere; strong moves come only as steps of fixed attack strings (STRINGS table, Appendix C P2-01), a strong punch from a Punch press and a strong kick from a Kick press; a string continues only after contact, within 0.8 s (hit-stop pauses the count); strong throws removed. Dash removed; Defend replaces both block buttons (Crouch + Defend = low guard; a Defend press while down = quick recovery); sidestep = double-tap left / right; Use and Lock have keys but no gameplay yet. Tips and controls cards show once only. Auto-assist (off by default) lets a string continue after a whiff, human players only.

Known small issues to keep in mind: releasing Crouch during a hit-freeze can change a queued attack's height; touch auto-height does not use the crouch strings; the Training panel overlaps the touch pause button.

How to work:
- `breakpoint.html` and the tasklist are CRLF with a UTF-8 BOM: edit with the Edit tool or node scripts only, never `sed -i` in Git Bash; check `rg -c '\r$'` equals `rg -c ''` and the first bytes are `ef bb bf`.
- Batches: one implementer agent per batch, then an independent reviewer agent on the diff, fix medium and higher findings, tick the tasks, commit (`Breakpoint: P3-xx - ...`, no AI attribution), push.
- Tests: fast headless Node checks during work (extract the inline script, `node --check`, a small runner with a stubbed DOM; rebuild it, the old one is gone). Once per batch before committing: the `games` preview server (127.0.0.1:8765), Playwright on `http://127.0.0.1:8765/Beat%20Em%20Up/breakpoint.html`, accept the leave-page dialog, run `await BREAKPOINT.selfTest()` from the main menu (140 checks, all must pass). Close the browser and stop the server after each check.
