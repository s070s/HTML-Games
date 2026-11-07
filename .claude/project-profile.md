# Project profile: HTML Games

- Repo: `s070s/HTML-Games`, local `C:\Users\GS\Desktop\Dev\HTML Games`, branch `main`.
- A push deploys nothing: no CI workflows, no GitHub Pages.
- Push policy: only after the owner's go for that job.
- Checks: each game's in-browser self-test (IRON HORIZON `__IH.selfTest()`, Breakpoint `window.BREAKPOINT.selfTest()`), run through the preview server (`.claude/launch.json`, "games"). Gate chain: a node syntax parse of the changed games' inline scripts.
- Breakpoint test scoping: while a task is being built, run only the tests it touches. Headless (no browser): from `Beat Em Up/`, `node tools/run-tests.js --affected` picks them from the git diff since main (`--also "Hazards|Levels"` adds name parts, `--only "<parts>"` picks by name, `--list` prints the pick; the header of `tools/run-tests.js` has every option). In a browser: `BREAKPOINT.selfTest('Hazards|P18-13')`. The picker reads test text only, so a side effect deep in the simulation or the AI can still break a test it did not pick: the full Chrome run `BREAKPOINT.selfTest()` (about 2.5 minutes) stays the gate before every merge. A full headless run (about 11 minutes) is needed only when Chrome cannot run. Headless always shows 17 known limits (16 "needs the main menu", 1 "blank faces"); the runner counts them apart and exits 1 only on other failures.
- e2e: none.
- Known flaky CI patterns: none (no CI).
- Line endings: keep each file's own (IRON HORIZON is CRLF with a BOM in the working copy, git stores LF; Breakpoint is CRLF with a BOM).
