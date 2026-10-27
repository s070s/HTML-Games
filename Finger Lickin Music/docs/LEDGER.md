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
- Never push unless the owner says so (project profile). Owner instruction 2026-10-27 17:31 local, verbatim:
  "push the commits in the end". Interpretation: at the clean stop of this session, push branch
  flm-implementation to origin once (fetch first, report the commit count); not main; no force; no later
  pushes without a new go.
- Commit on branch flm-implementation.
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

## 2026-10-27 19:00 - T04.01 to T04.02 - M-05 Audio: context, unlock, master chain, strips, meter

Done: src/05-audio.js (context created suspended at B7, unlock, state events, master chain with limiter, mute
ramp, 30/20 ms master fades, metronome bus, channel strips, 10 Hz peak feed), HUD master meter (26-ui), SCR-Pause
master/metronome sliders (27-screens), boot wiring B7/B13/B15 against the real module, fakes.detachAudio and
fakes.fakeAudioContext in 90-selftest, 'Audio' in EXPECTED_MODULES. Verified by me in the real folder: build 0,
`selftest --all` 623/623 (23 groups), 0 skipped, `--smoke` OK; the agent also ran --all three times and --slow 624/624.
Existing tests changed: IT-003/IT-004/IT-035 (use fakes.detachAudio), TT-023 (resampleAnchor + 5 ms tolerances), the
selftest fixtures test: because real Audio now exists; no test weakened beyond that stated tolerance.
Perf (software GL): ship 754,486 bytes; menuMs ~132-136; capsMs 16.3; input p95 0.8.
Decisions: D58 context created suspended at init (Part 4.3 over 6.5.2 "lazily"); D59 audio.state reason 'stalled' added
(UT-05-04); D60 held-peak decay uses a 0.5 s time constant (6.5.4.9 half-life contradicts UT-05-28); D61 metronome bus
feeds master; D62 limiter lookahead ~6 ms accepted (UT-05-10 within 20 ms); D63 boot unlock stays on pointerdown (UT-29-09).
Open issues: OI-31 real sound output unverified headless (LT-033/038/039 Phase 15); iOS/Safari unlock may need pointerup:
check at XT-006..010; OI-32 the 50 ms pump stand-in in src/28-modes.js stays until the Scheduler (T04.04); OI-33
UT-29-09b/UT-27-28e/f/UT-28-08y use a stand-in context, unlock timeout tested on fake timers only; deferred: VoiceAllocator,
Scheduler, panic, nodeCount (T04.03-T04.05), fault hooks audio.suspend/audio.fail phases, UT-05-27, Diagnostics Test tone.
Usage: weekly all 12% at 18:55 (5h 15%).
RESUME: T04.03 (VoiceAllocator), T04.04 (Scheduler), T04.05. Stop before 15% weekly; push is authorized once at the clean stop.

## 2026-10-27 18:30 - Phase 03 GATE (T03.10-T03.12) - input abstraction, mapping profiles, judge and scoring

Done: T03.10 instrument-mode gameplay binding in src/28-modes.js (Judge bound to Transport.main, input.event routing,
pause/resume with 3-2-1, finish, E-INP-003 on gamepad disconnect, params.testChart refused in the shipped build),
play-phase SCR-Instrument and SCR-Pause in src/27-screens.js, SelfTest.fixtures.song/chart and chartBot,
perf scenario input-latency, S-PLAY-08 toast and pad layout refresh (OI-23, part of OI-17 fixed); T03.12 gate.
Gate run (real folder, headless Chrome via the CDP client): build exit 0; `selftest --all --slow` 586/586 over 22
groups (input@touch, integration@touch, ui@touch included), 0 skipped; `--smoke` OK; perf (software GL): PT-001
720,904 bytes; PT-002 menuMs 115.5, capsMs 15.7; PT-009 input phase inputProcP95Ms 0.7 (budget 4).
Gate gap: `perf.mjs --scenario touch-layout` (PT-024) is not registered anywhere (T03.02 should have delivered it);
not run, recorded OI-27. Risk review (13.3): RISK-09 (input timing) and RISK-38 (simultaneous presses) covered by
UT-07/TT-029 on synthetic input only; RISK-39 (touch multi-pointer) unverified on real devices (XT, OQ-1);
RISK-40 (calibration) judged on synthetic clock, wizard never run in a real browser.
Decisions: D53 chart is beats 1..31 at tick n*960, lane n%4, 120 BPM 4/4 (test fixture); D54 a 50 ms pump stands in for
the Scheduler until M-05 (remove with T04.01); D55 a calibration change at any time after the run began, including
while paused, marks the run not comparable; D56 gamepad held state tracked in M-28 from input.event; D57 panic toast
uses S-PLAY-09 wording ("All sound stopped.") over 6.27's "All notes stopped".
Open issues: OI-27 touch-layout scenario missing (above); OI-28 TT-023 runs in real time (~4 s) with a 70 ms margin:
likeliest flake, use skill flake-triage if it fails intermittently; OI-29 SCR-Pause practice/view/touch-pad/volume panels,
section restart, Stop-all-sound button, DLG-ResumeAudio not built; finish returns to the menu until SCR-Results exists;
OI-30 PT-009 Free Play phase and liveSchedMaxMs in Phase 06; real audible play, touch, gamepad, visibilitychange
unverified in a real browser; OI-15 still open (boot module list now wrapped at 120).
Usage: weekly all 12% at 18:25 (5h 14%).
RESUME: T04.01 (Phase 04 audio engine). Stop before 15% weekly; push of flm-implementation is authorized at the clean stop only.

## 2026-10-27 18:05 - T03.09 and T03.11 - calibration and deferred register

Done: T03.09 Input.setCalibration/calibration (UI-side store only; Rhythm applies calibration once), Settings pushes
calibration.* to Input and Rhythm, DLG-Calibration wizard (flash/tap step; listen step disabled until T04.09),
Screens.Calibration math; T03.11 two Deferred rows rewritten in STATUS section 3, catalog texts S-INP-09 and S-NET-02.
Verified by me in the real folder: build 0, `selftest --all` 564/564 (22 groups), 0 skipped, `--smoke` OK.
Decisions: D49 tap step per Part 7.7.1 (12 flashes at 90 BPM, first 4 ignored, >= 6 matched, IQR > 40 ms warns);
D50 wizard text avoids the word "latency" (AT-R-I2.3-08); D51 Input stores audio latency range +-500 (UT-07-32), settings key 0..500;
D52 S-INP-09 id chosen for the one-switch sentence (needs a 1.0.x plan patch to Part 7.11).
Open issues: OI-23 "Calibration changed; results not comparable" toast (S-PLAY-08) not shown anywhere yet (T03.10 HUD/pause);
OI-24 no "Browser estimate of the sound delay" line until Audio.latency exists (T04.05/T04.09); OI-25 Help Accessibility does
not show S-INP-09; Screens keeps a local copy of S-NET-02; OI-26 wizard never run in a real browser, only headless self-test.
Usage: weekly all 12% at 17:56 (5h 13%).
RESUME: T03.10 (instrument-mode gameplay binding with a test chart), then T03.12 gate. Stop before 15% weekly.

## 2026-10-27 17:55 - T03.04 to T03.08 - remapping, M-08 Mapping, M-09 Rhythm (judge, score, replay)

Done (three agents in parallel, each tested in a private scratch copy): T03.04 Input getMap/setMap/remap/unmap/
resetMap/conflicts, Settings->Input.setMap wiring (mapsFromSettings), Controls tab remap UI, Help Controls table;
T03.05/T03.06 src/08-mapping.js (FLM.Mapping profiles A-F, chords, scales, holds, sustain); T03.07/T03.08
src/09-rhythm.js (FLM.Rhythm: windows, judge, score, sections, replay; the entry names Rhythm, not Judge).
'Mapping' and 'Rhythm' added to EXPECTED_MODULES. Verified by me in the real folder: build 0, `selftest --all` 548/548
(22 groups) twice, 0 skipped; `--smoke` OK.
Decisions: D38 input.keys.more settings row for extra keys (not in Part 5 table: owner to confirm); D39 conflict
dialog per Part 7.7 ("Use for {control}"); D40 input.map payload adds `context`; D41 Mapping API per 6.8.2 (createLive/handle)
with Mapper/onInput/actions aliases; D42 chord voicing drop limit 9 semitones (plan examples contradict 7); D43 UT-08-12
asserts 0.25 s (plan says 0.5 s at 960 tpq); D44 window edges use rounded integer ms snapped to 1e-6; D45 miss declared
before a later stray (TT-026); D46 replay log carries pause/resume and calibration markers; D47 Rhythm.calibration()
module-level, pushed to bound Judges; D48 misses and hold completions in close-time order.
Open issues: OI-18 input/UT-07-04 flaked 2/5 runs under heavy machine load (anchor 25 ms sampling vs fake clock), passed
12/12 when idle: watch, if it flakes again use skill flake-triage. OI-19 Core code table words E-INP-011 as "Track too
dense" but 6.9 uses it for bad window name; reconcile. OI-20 fixed-length notes: pending note-off cannot be cancelled
on retrigger (T04.06); drum key replacement rule 35..81 not implemented; Instruments.range/liveNoteOn signatures unchecked
until M-06. OI-21 MIDI lane-note pickers on Controls tab not built; first-launch no-keyboard trigger uses touch only.
OI-22 typed-array input log (6.9.6) not implemented (plain objects). Deferred: IT-003/004/035, TT-023 real-clock (T03.10);
UT-21-08/09 (T05.09); UT-08-20..34 ChartGenerator (Phase 08); UT-09-29 banner (T03.09).
Usage: weekly all 11% at 17:45 (5h 12%).
RESUME: T03.09 (calibration settings and DLG-Calibration input step) and T03.11 (deferred register) in parallel, then
T03.10 (instrument-mode gameplay binding with a test chart), T03.12 gate.

## 2026-10-27 17:35 - T03.01 to T03.03 - M-07 Input (keyboard, pointer/touch, gamepad, Web MIDI, lifecycle)

Done: src/07-input.js, src/91-test-input.js (group input, 59, also input@touch 59), src/92-test-integration.js
(IT-002 input part, IT-043); 'Input' in EXPECTED_MODULES, Input.init gets touchApi. Verified by me: build 0,
`selftest --all` 448/448 (20 groups, touch passes included), 0 skipped.
Decisions: D31 identity audio anchor when FLM.Audio is absent, ring cleared on audio.state != running;
D32 no setPointerCapture (ADR-10/6.7.9 over T03.02 wording); D33 Touch Events fallback by input.touchApi;
D34 one owner per control (6.7 over ADR-10); D35 raw MIDI control ids midi:<n>; D36 Input.audioToPerf
made real for fakes.inputs.event; D37 19 controls (6.7.6 says 20, names total 19).
Open issues: OI-17 hardware unverified: gamepad, Web MIDI, real touch (4 simultaneous touches, OQ-1), keyboard
rollover; pad rectangles refresh lazily (no M-26 layoutChanged call); M-26 input-status badge and lane receptors
not built; Settings->Input.setMap wiring is T03.04. Deferred rows: UT-07-26..28 (T03.04), UT-07-32 (T03.09),
judge half of TT-029 (T03.07), audio half of IT-002 (Phase 06), PT-009 perf scenario (T03.10).
Usage: weekly all 11% at 17:25.
RESUME: T03.04 (remapping and controls help), T03.05/T03.06 (M-08 Mapper), T03.07/T03.08 (M-09 Judge, score,
replay) can run in parallel; then T03.09, T03.10, T03.11, T03.12 gate.

## 2026-10-27 17:10 - Phase 02 GATE (T02.04-T02.09) - transport, engine, timing tests, transport bar

Done: T02.04/T02.05 src/04-transport.js (Transport state machine, anchoring, positionAt, seek, loop,
count-in, speed; fakes.clock advanceMs); T02.06 Modes load the mode's song into Transport.main, one
Transport (S-18), visibility hooks, preview, events frozen in the test build; T02.07 src/92-test-timing.js
(group timing, FakeClock TT-005..013, 021, 022); T02.08 UI.TransportBar wired to Transport.main; T02.09 gate.
Gate run (real folder, headless Chrome via the CDP client): build exit 0; `selftest --all` 326/326 (16 groups),
`--all --slow` 327/327; `--smoke` OK; PT-001 526,829 bytes; PT-002 menuMs 126.1 (budget 1500), capsMs 19.7
(budget 20, noisy, software GL).
Risk review: RISK-77 (timing drift) mitigated on FakeClock only; real-clock and offline-engine halves of
TT-004/006/007/009/011 deferred to Phase 04, TT-021 input ring to Phase 03, full IT-037 to Phase 05.
Decisions: D25 test build detected with FLM.SelfTest (FLM.BUILD is a stamp string); D26 events frozen at
Transport.load in the test build only; D27 positions are floats, count-in negative, paused position frozen
(Part 6.4 over 4.5.1); D28 default count-in 0 bars; D29 transport bar opt-in via spec.transport, one Play
button with Play/Pause/Resume labels; D30 W-TRANSPORT-DRIFT in Transport, E-AUD-009 in Modes.
Open issues: OI-14 S-07 lint (module-level global state) not in tools/build.mjs; add in a tooling touch.
OI-15 src/29-boot.js EXPECTED_MODULES line is 128 chars (over 120): wrap on next edit of that file.
OI-16 README Develop/diagram lines unchanged; OI-7 AT tests still not wired; earlier OI list stands.
Usage: 5h 9% / weekly all 11% at 17:00.
RESUME: T03.01 (M-07 Input core). Constraint: owner stop rule; stop before 15% weekly.

## 2026-10-27 16:45 - Phase 01 GATE (T01.10-T01.12) and T02.01-T02.03 - boot, screens, theory, model

Done: T01.10 src/29-boot.js; T01.11 main menu, first launch, settings, help, about, diagnostics and audio
dialogs in src/27-screens.js (12 menu entries, 9 disabled with the reason "Available after a later
build step", 23 STATUS section 5 rows); T01.12 gate fixes (modes baseline after the menu mounts,
boot panel removed before the baseline, boot error listener removed before boot.ready, ui group
restores the menu, UT-28-08x stubs Screens.dialog, alertdialog role for alert dialogs, LICENSE_NOTICE
moved to Core). Started early at the owner's request to work in parallel (deviation from "no T section
before its dependency is done"; kept because the Phase 01 gate passed): T02.01 Theory, T02.02/T02.03
Model, TempoMap, MeterMap, KeyMap (src/02-theory.js, src/03-model.js; EXPECTED_MODULES now lists them).
Gate run (real folder, headless Chrome through the CDP client, 2026-10-27): `node tools/build.mjs` exit 0;
`node tools/selftest.mjs --all` 246/246, 0 failed, 0 skipped, 14 groups (core 33, selftest 16, ui 42,
storage 6, screens 24, modes 9, boot 12, files 1, faults 1, perf-smoke 2, theory 24, model 32, ui@touch 43,
faults@touch 1); `--smoke` OK; perf: PT-001 472,070 bytes; PT-002 menuMs 102.7 (budget 1500), capsMs 17.2
(budget 20; one run 20.2, headless WebGL probe, environment cost); all software GL.
0.5 checklist: T order followed except the early T02.01-03 above (recorded); every test registered in its
group; STATUS updated; no placeholder without a STATUS section 5 row (23 rows); no format/multiplayer/offline/
performance claim made beyond the runs above; modules communicate through APIs and the bus; files are BOM+LF+ASCII.
NOT ticked honestly: per-row statuses. The AT-<R-ID> acceptance tests (1,921) are defined in Part 12 but not
coded as runnable tests, so no Part 15 row has been moved to Partial or Implemented; STATUS counts stay
1,962 Unimplemented and 26 Deferred. Decision D17: rows move only when their named UT/IT/FT tests exist and
pass; a later T section must add an AT wiring step (open issue OI-7).
Risk review (13.3): RISK-06 (single-file size) and RISK-24 retire: build enforces limits, 472,070 bytes;
RISK-15 (global state object) guarded by the S-07 lint, no violation; RISK-29 retired by gate rule (tests
run from T01.05 on); RISK-50 (secure-context features) mitigated by Caps flags secureContext/webMidi, re-check
Phase 15; RISK-57 (Playwright absent) mitigated by decision D1, status: Node playwright path untested;
RISK-66 (one syntax error disables the game) mitigated by the early handler and syntax-ceiling check, XT-070 at
Phase 15.
Decisions: D18 Boot panel removed before the menu baseline; D19 Part 4.7.1 baseline retaken on boot.ready in
the menu; D20 UT-02-03 expected value for Fb5 is 76 not 64 (plan's own formula; Fb4 is 64); D21 first-launch has
6 steps (6.27.4.3) not 3 (7.6.1); D22 settings tabs 9 per Part 7.6.12; D23 MeterMap API per Part 6 (barAt number,
beatAt object); D24 Song.create gives a one-entry C major KeyMap (Part 6) not [] (Part 5).
Open issues: OI-7 AT tests not wired (above). OI-8 shell.html html/body font-size rule (corrective rule in
26-ui.js). OI-5 Core ErrorReporter drops function context members (unused so far). OI-9 five leftover browser
profile folders under %TEMP%\claude (flm-profile-*): a locked LOCK file, owner may delete. OI-10 Escape/Back at
stack depth 1 answers 'root' per 6.26.3 (menu has no back). OI-11 audio.unlocked and Boot unlock-gesture
listeners are inside the menu baseline until the next enter. OI-12 UT-29-06/09, UT-27-28 partial until T04.01.
OI-13 B7-B14 boot steps for unbuilt modules coded from plan text only (Input.init, Render.pickTier).
Owner actions: push of flm-implementation (pending approval); delete OI-9 folders; Phase 15 device tests.
Usage: 5h 7% / weekly all 10% at 16:30 (Fable weekly 3%).
RESUME: T02.04 (M-04 Transport state machine, audio-clock anchoring and positionAt), then T02.05.
Constraint: owner stop rule (stop before 15% weekly); T02.04 needs fakes.clock (also T01.05 UT-31-13 part).

## 2026-10-27 15:55 - T01.08 to T01.09 - settings storage subset and mode manager

Done: src/16-storage.js (M-16 subset), src/27-screens.js (Settings controller only; T01.11 extends),
src/28-modes.js (M-28) and tests. Real Chrome run, scratch copy with stand-in boot: core 33/33,
selftest 16/16, ui 42/42, ui@touch 43/43, storage 6/6, screens 6/6, modes 9/9 (155/155, no skips).
Decisions: D12 added Storage.lastSettingsLoad() ({source, damaged}); D13 settings size cap 64 KB (5.15
and 10) over 6.16's 256 KB; D14 release reason 'system' (4.7.2) over 'mode' (6.28.4.2); D15 Modes
restart(changes) re-enters with merged params; D16 assertClean skips the screen-depth check until a
mode was entered.
Open issues: OI-5 still open (Core ErrorReporter drops function context members). OI-6 UI._resetForTests
removes the menu screen, so once Boot enters the menu the runner's group-end assertClean may report
screenDepth: check in T01.10 integration. Deferred inside this entry: input.keys writes to Input.setMap
(M-07, Phase 03), D2 mirroring (Phase 09), popstate unsaved-changes guard test (needs Project).
Usage: weekly all 9% at 15:42.
RESUME: T01.10 (boot agent in progress at this checkpoint), then T01.11, T01.12.

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
