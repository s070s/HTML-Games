# Project profile: HTML Games

- Repo: `s070s/HTML-Games`, local `C:\Users\GS\Desktop\Dev\HTML Games`, branch `main`.
- A push deploys nothing: no CI workflows, no GitHub Pages.
- Push policy: only after the owner's go for that job.
- Checks: each game's in-browser self-test (IRON HORIZON `__IH.selfTest()`, Breakpoint `window.BREAKPOINT.selfTest()`), run through the preview server (`.claude/launch.json`, "games"). Gate chain: a node syntax parse of the changed games' inline scripts.
- e2e: none.
- Known flaky CI patterns: none (no CI).
- Line endings: keep each file's own (IRON HORIZON is LF in the working copy; Breakpoint is CRLF with a BOM).
