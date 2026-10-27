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
- Regression policy (Part 12.1.7, in force from T01.05): (1) every defect found after its
  feature's tests first passed is recorded in STATUS.md section 6 with its severity (Part 13.2)
  before it is fixed; (2) the fix lands together with a regression test that fails on the
  unfixed code and passes on the fixed code, with the next free ID of the lowest level that can
  show the defect (a new UT-<MM>-<nn> after the module's last number, or the next IT, FT, TT,
  FI number), a title ending with "(regression)", its row appended to the matching table
  (12.2 to 12.7) and index file, and named in the "Regression test" column of STATUS.md
  section 6; (3) a defect that only a physical device shows gets an XT or LT row instead, and
  the STATUS row says why no automated test exists; (4) a corpus file that exposed a parser
  defect stays in the corpus (a real-world file that cannot be committed gets a synthetic
  recipe in tools/make-corpus.mjs and a new FT row); (5) regression tests are never removed,
  and a test made obsolete by a plan change is changed only through a LEDGER Decisions line
  that names the replacing test.
- Foundation guard (Part 3.9 item 3, in force from T01.05): after any change to M-01 to M-09
  run `node tools/selftest.mjs --group core --group model --group transport --group audio
  --group rhythm` (about 40 s); it must pass before the T section counts as clean. A clean T
  section (Part 3.9) also needs: `node tools/build.mjs` exits 0 with no problem lines, every
  group named in the section's Verification passes with at least the minimum test count of
  Part 6.N.8, `node tools/make-corpus.mjs --check` passes when the corpus or its generator was
  touched, STATUS.md and the LEDGER are current, and nothing is described as done beyond what
  the passing tests show. The foundation guard is applied from T01.06 on.

## Usage log

| Local time | 5h % | Weekly all % | Note |
|---|---|---|---|
| 2026-10-27 14:20 | 11 | 8 | start of implementation; weekly resets 2026-10-31 10:00 UTC |
| 2026-10-27 15:08 | 2 | 9 | after T01.01-T01.05 (about 1 point per 50 min with 2 parallel agents) |

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

## 2026-10-27 15:35 - T01.06 to T01.07 - M-26 UI framework and accessibility

Done: src/26-ui.js (FLM.UI: Screens, widgets, dialogs, toasts, Layout, Focus, TouchPads, HUD, Frame)
and src/91-test-ui.js. Real Chrome run through the CDP client in a scratch copy with a stand-in boot:
core 33/33, selftest 16/16, ui 42/42, ui@touch 43/43 (134/134, no page errors, no skips).
Decisions: D7 widget/screen CSS is injected by 26-ui.js as <style id="flm-ui-style"> (shell S02-S05
stay empty); D8 error presentation only via ErrorReporter.setPresenter; D9 extra glyph icons g-* added
by 26-ui.js at load; D10 toast durations from 6.26 over 7.11.4; D11 lower screens inert+aria-hidden.
Open issues: OI-4 shell.html (Part 3.2.4 text) sets `html,body{font-size:var(--fs-3)}` after the
`html{font-size:calc(16px*var(--ui))}` rule, so UI scale does nothing; 26-ui.js adds a corrective rule;
fix at source (shell.html) when convenient. OI-5 Core ErrorReporter safeItem drops functions from the
error context, so toast/dialog actions from context.onAction never fire; fix in 01-core.js with T01.10.
Not verified: Part 12.9.14 keyboard-only task walk; 200% zoom; LT/XT/AT; orientationchange and
visualViewport paths; HUD announcements; toast-action activation.
Usage: 5h 4% / weekly all 9% at 15:30.
RESUME: T01.08 (settings persistence subset M-16 + M-27 settings controller), then T01.09.

## 2026-10-27 15:10 - T01.01 to T01.05 - shell, build tool, core, self-test runner

Done: T01.01 src/shell.html + module skeleton (src/README.md); T01.02 tools/build.mjs (build OK in a
scratch copy; --check planted fetch(, remote script and ??= -> 3 problems, exit 1); T01.03/T01.04
src/01-core.js (all M-01 API, Part 10.6 code table, Faults, Caps, ErrorReporter, Diagnostics);
T01.05 src/90-selftest.js, tools/selftest.mjs, tools/perf.mjs, tools/lib-cdp.mjs (D1).
Verification run (real Chrome through the CDP client, scratch copy with a stand-in boot module
loaded last, scratch deleted): `selftest --all` 53/54: core 33/33, selftest 16/16, files 1/1,
faults 2/2, perf-smoke 1/2. The one failure is PT-002 (boot-to-menu needs Boot stage records,
real boot is T01.10). In the real folder `selftest` cannot become ready until T01.10 sets
FLM.selfTestReady, so `--group selftest` in the real folder is not yet verifiable.
Not verified: Playwright code path (module not installed); the #fatal panel from file:// with no
script; UT-31-13 Transport part (T02.04).
Decisions: D2 version '0.1.0' (T01.03) over 6.1's '1.0.0'; D3 emit depth limit 8 over 6.1's 32;
D4 FingerLickinMusic.html is committed as the shipped file (rebuilt at every gate); D5 build treats
a missing src/01-core.js as a "version" problem; D6 bad selftest usage exits 3 (2 is the watchdog).
Assumptions: A3 Part 3.2.5 vs 10.6.12 early-handler text: followed 10.6.12 (E-CAP-004 text, then
the browser message, white-space pre-line set from script).
Open issues: OI-1 FT-106 vs Core redaction: Part 6.1.4.6 cuts arrays to the OLDEST 200 entries, FT-106
and Part 10.10.2 say the OLDEST log entries are dropped first (newest kept); src/01-core.js
redactArray keeps the oldest; test checks only what holds either way. Fix in a later T section.
OI-2 PT-002 metrics: Boot stage `ms` is read as absolute time by perf.mjs; plan unclear (UT-29-12
vs 9.1 row 3); settle in T01.10. OI-3 Part 3.5 says perf default file is the test build, 9.7.1 says
the shipped file; perf.mjs uses the shipped file for boot-to-menu.
Usage: 5h 2% / weekly all 9% at 15:08 (start 8%).
Next: T01.06 (M-26 UI framework).
RESUME: T01.06. Constraint: owner stop rule above; after T01.06 check usage, stop before 15% weekly.

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
