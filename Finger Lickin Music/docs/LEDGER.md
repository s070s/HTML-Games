# Finger Lickin Music - LEDGER

Plan version: 1.0.0. Software VERSION: 0.1.0 (set in src/01-core.js by T01.03).
Newest entry first. Every entry ends with a RESUME line. A fresh session reads Part 0 of
docs/IMPLEMENTATION-PLAN.md, the top entry below and docs/STATUS.md, then continues at RESUME.

## Standing rules

- Owner stop rule (2026-10-27 14:14 local, verbatim): "Stop at a clean boundary before 15% of
  weekly usage limit for all models (the one that resets on Saturday)". Interpretation: read
  usage (get_usage, "Weekly - all models") before every T section; when it reaches 14% or a
  next T section would plausibly cross 15%, finish only the current T section, run its
  verification, write the ledger entry, commit, and stop. Do not start another T section.
  Do not schedule a self-resume.
- Never push; the owner says when (project profile). Commit on branch flm-implementation.
- Regression policy (Part 12.1.7) and foundation guard (Part 3.9 item 3) apply from T01.05.
- New files: UTF-8 with BOM, LF, ASCII content.

## Usage log

| Local time | 5h % | Weekly all % | Note |
|---|---|---|---|
| 2026-10-27 14:20 | 11 | 8 | start of implementation; weekly resets 2026-10-31 10:00 UTC |

## Assumptions

- A1 (2026-10-27): Windows host with Node 24.22.1 (Part 0.10 expects Linux, Node 22+). Why: that
  is this machine. Verify: tools run with `node` and quoted paths. State: open.
- A2 (2026-10-27): Node `playwright` is not installed anywhere reachable (only the Python
  package and downloaded browsers under %LOCALAPPDATA%/ms-playwright; Chrome is at
  C:/Program Files/Google/Chrome/Application/chrome.exe). Why: Part 3.4 expects it. Verify:
  T01.05 tools/selftest.mjs. State: open (see Decision D1).

## Decisions

- D1 (2026-10-27): tools/selftest.mjs and tools/perf.mjs use `playwright` when it resolves; when
  it does not, they fall back to a built-in zero-dependency Chrome DevTools Protocol client
  (Node's global WebSocket) that launches the system Chrome or the ms-playwright Chromium with
  the Part 3.4.2 flags. Reason: no install is permitted (Part 0.10, ADR-02) and RISK-57 would
  otherwise block every automated test. The results object and exit codes stay as in Part 3.4.

## Owner actions

- Push of branch flm-implementation: pending owner approval.
- Device and other-browser tests (XT, LT): owner.
- Licence: the owner recorded "All rights reserved" (see docs/plan-work/OPEN-ISSUES-stage1.md).

## 2026-10-27 14:25 - Phase 00 - planning artifacts satisfied

Done: T00.01 to T00.09 satisfied by IMPLEMENTATION-PLAN.md 1.0.0. Branch flm-implementation
created from main (899334f). docs/STATUS.md created: 1,988 rows (B 921, E 364, I 343, P 360),
1,962 Unimplemented, 26 Deferred, matching Part 15.
Decisions: D1.
Assumptions: A1, A2.
Open issues: Part 0.3 reading (Parts 1-5, 9, 10) is done per T section as needed, not in full
up front, because of the owner's usage stop rule; any plan inconsistency found is logged here.
Next: T01.01.
RESUME: T01.01
