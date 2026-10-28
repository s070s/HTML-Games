# Breakpoint - handoff for the next session

Read this first, then `TASKLIST-breakpoint.md` (the plan; Appendix C = decisions, Appendix D = audit findings). Delete this file when the tasklist is finished.

## Where it stands (2026-10-28 15:50)

- Branch `main` only (owner rule: no new branches). Last commit `255e2a2`, pushed; `main == origin/main`. Baseline tag of the 1.0.0 game: `breakpoint-1.0.0-baseline`.
- Done: Phase 0, Phase 1, Phase 2 (18 + 8 tasks). Open: 81 tasks, Phase 3 to Phase 16.
- Self-test: `window.BREAKPOINT.selfTest()` from the main menu, 140 checks, all pass in Chrome. AI vs AI runs (`BREAKPOINT.simulate({seed})`) finish.

## How to resume

1. Owner's standing request: work through the tasklist on `main`, stop at a clean boundary before 20% of the weekly Claude usage (read it with the usage tool before each batch; it was 16% at the stop, resets 2026-10-31), commit and push on `main`, then clean up and report a table of changes plus a table of locked folders / files to delete.
2. Next is Phase 3. Ask the owner first (one batched question) for the decisions below, then implement in batches: one implementer agent per batch, then an independent reviewer agent on the diff, fix medium+ findings, one real-browser self-test, tick the tasks, commit, push.
3. Keep `C:\Users\GS\Desktop\Locked folders.txt` up to date (owner request): every folder Windows will not delete, and items waiting for deletion approval.

## Decisions waiting for the owner

- P3-02 Block rules (perfect block, guard break, chip, stamina) and Sway rules (i-frame window, recovery, counter window). One defense type per fighter.
- P3-04 submissions design (minimal inputs, escape on touch); P3-06 heavy tackle yes / no and weight threshold.
- P3-10 combo audit: the "no string above 35% of a fighter's damage" limit was set by Claude, confirm or change. Note: AI vs AI matches currently deal about 80% of damage with kicks.
- USE still has tap = drop, hold = throw (from the owner's ideas file). Owner said "ditch the hold overall" for attacks; ask whether USE keeps its hold.

## Owner decisions already made (do not reopen)

- No hold-to-strengthen on any device; attacks fire on press. Strong moves only as steps of fixed attack strings (`STRINGS` table, Appendix C P2-01). A strong punch always comes from a Punch press, a strong kick from a Kick press. A string continues only if the previous step made contact, within 0.8 s (48 sim ticks; hit-stop pauses the count). Strong throws removed. Combos get a balance audit (P3-10).
- Dash removed. `defend` replaces both block buttons (crouch + defend = low guard); quick recovery = fresh Defend press while down. Sidestep stays (double-tap left / right). `use` and `lock` exist with keys but no gameplay yet (P7 / P4). Touch USE / LOCK buttons appear only when useful.
- Tips and tutorial cards show once only (one controls card per input type).
- Auto-assist setting (off by default): string continues after a whiff, window doubled, human players only.

## Known small issues (not fixed)

- Releasing Crouch during a hit-freeze can change a queued attack's height (height is read when the press is taken, not when made).
- Touch auto-height does not move a standing string onto the crouch rows.
- The Training panel overlaps the touch pause button (older than this work).

## Working rules for this file set

- `breakpoint.html` and `TASKLIST-breakpoint.md` are CRLF with a UTF-8 BOM. Edit with the Edit tool or a node script that keeps CRLF; never `sed -i` in Git Bash (it strips CR). Check: `rg -c '\r$' FILE` equals `rg -c '' FILE`, and `head -c3 FILE | od -An -tx1` prints `ef bb bf`.
- Commit messages: `Breakpoint: P2-xx - ...` or `Breakpoint docs: ...`; no AI attribution; stage by path; before push `git fetch` and `git rev-list --left-right --count origin/main...HEAD`.
- Syntax check: extract the inline `<script>` with a small node script, then `node --check`.
- Fast checks during work: a headless Node runner (extract the inline script, stub the DOM with a Proxy, run the self-test object). 16 checks need a real browser (menus, gamepad rumble). It lived in the old scratchpad and is gone: rebuild it if useful.
- Real-browser check once per batch, before commit: start the `games` server (`.claude/launch.json`, python http.server on 127.0.0.1:8765) with the preview tool, open `http://127.0.0.1:8765/Beat%20Em%20Up/breakpoint.html` with the Playwright MCP, accept the beforeunload dialog, run `await BREAKPOINT.selfTest()` and list entries with `pass === false`. Close the browser and stop the server afterwards (the owner does not want an idle game window open).
- Agents: implementer = Sonnet (high effort for big batches), reviewer = Opus high; brief them with the tasklist line numbers and the rules above; they must not commit, push, start servers or delete files.
