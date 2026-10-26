## 9. Performance budgets and device matrix

This part turns B 20 (performance and resource management), B 21.3 (mobile performance),
B 25.6 (performance tests), I 12.1-12.2 (device profiles, resource limits), I 19
(measurable quality targets), P 17 (performance and resource management) and the budget
table of the brief (section 6) into numbers, measurement procedures and pass criteria. It
also fixes the four quality tiers in full (ADR-03 holds the normative core values, repeated
here unchanged), the loading strategy, the cleanup checklist observed by
`FLM.Modes.assertClean()` (Part 4.7.3), the long-session tests, the `tools/perf.mjs`
scenarios (Part 3.5 owns the tool's command line) and the limits statement for SCR-About.

Nothing in this part is a measured result. Every value is a target or a limit; results are
recorded in `docs/STATUS.md` section 7 (Part 0.7) and in the device matrix of 9.2. The
budgets must not be relaxed after measurement to make results pass (I 19 last paragraph);
a change to any value in 9.1 is a plan patch recorded in the LEDGER with its reason, made
before the measurement it affects.

### 9.1 Budget table

#### 9.1.1 Measurement conventions

1. Gate classes, written in brackets at the end of every pass criterion:
   - `[B]` build-gated: `tools/build.mjs` checks it on every build (Part 3.3).
   - `[U]` unit-verified: an exact rule checked by UT, TT or FT tests in every
     `node tools/selftest.mjs --all` run; a failure fails the run.
   - `[H]` headless-gated: `tools/perf.mjs` reports `FAIL` and exits 1 when the criterion
     fails in headless Chromium (Part 3.5). These are regression gates; they do not
     establish device performance. Values are recorded with the suffix "(software GL)"
     when they involve rendering (Part 0.10).
   - `[D]` device-gated: final only when measured on a physical device of the 9.2 matrix;
     headless values of the same metric are reported as `info`. Until measured, STATUS.md
     records "not measured" and the requirement stays Partial with reason "awaiting owner
     device test" (Part 0.10).
   - `[HD]` both: the headless run gates regressions and the device run is the claim.
2. Percentiles use the nearest-rank method: sort ascending, `pK = sorted[ceil(K / 100 * n)
   - 1]`. Medians of repeated runs use the same rule with K = 50.
3. Frame interval: the difference between consecutive `requestAnimationFrame` timestamps
   recorded by the perf frame probe (9.7.2). Intervals larger than 1,000 ms (page hidden,
   debugger pause) are discarded and restart the sample. FPS = 1000 / interval; "p95 FPS"
   means 1000 / p95 interval (the slow tail).
4. Navigation-relative times: `performance.now()` has its origin at navigation start, so
   load and time-to-interactive values are read directly from `performance.now()` stamps
   taken in the page.
5. Cold load: headless, a new `browser.newContext()` per load (empty storage unless the
   scenario seeds it); device, every tab of the browser closed, the browser process ended
   from the OS task switcher, then the file opened.
6. Heap: tool side, `HeapProfiler.collectGarbage` followed by `Runtime.getHeapUsage`
   through a Playwright CDP session (`page.context().newCDPSession(page)`); in page,
   `performance.memory.usedJSHeapSize` without a forced collection (Chromium only,
   informational). "Audio term" = `FLM.Instruments.stats().pluckCacheBytes` plus the
   decoded bytes of imported audio buffers (`length * channels * 4`). Device memory is the
   browser-reported memory of the tab: Chrome task manager "Memory footprint" (desktop),
   `chrome://inspect` remote Memory panel (Android), Safari Web Inspector Timelines
   "Memory" total (macOS, iOS over cable). The method is written next to every device
   value; without one of these tools the cell is "not measured".
7. Audio timing metrics use the scheduled audio times (`at` in `sched.*` payloads),
   `Transport.audioTimeAt(tick)` and `OfflineAudioContext` renders (onset detection of
   Part 6.5.4.10). No metric infers audio timing from wall-clock observation of sound.
8. Sample minima are stated per row. A run that yields fewer samples reports the metric as
   `invalid`, which counts as a failure for gated rows.
9. Repeats: a phase gate that runs the performance scenarios (Part 0.4 step 5) uses
   `node tools/perf.mjs --repeat 3` and gates on the median of the three values per metric.
10. Mobile values: where the brief gives only a desktop value, the mobile budget is twice
    the desktop value (the same rule as the boot step budgets of Part 4.3).
11. Units: MB = 1,048,576 bytes; KB = 1,024 bytes; times in ms unless written in s.
12. Built-in songs, track names and difficulties named in scenarios are those of Part 1.7.
    "Chart bot" means synthesized presses and releases generated in page by the perf
    harness through `Input.synthesize`: for each chart note the target audio time
    `audioTimeAt(tick)` (and the hold end for holds) is converted to a performance stamp
    through the current input anchor, the event carries that stamp as `tPerf`, and a timer
    dispatches it no later than 50 ms after that instant. Judgments are then perfect unless
    the input anchor and the Transport disagree, and judging, HUD flashes and hit effects
    run as in real play.

#### 9.1.2 Primary budgets

Rows 1-48 expand every row of the brief's section 6 and every B 20.1 item. "Phase" uses the
B 27 phase numbers: where the budget is first measured, and the phase whose gate makes it
binding.

| No. | Budget | Value | How measured (tool, scenario, metric, sample size) | Pass criterion | Phase measured |
|---|---|---|---|---|---|
| 1 | Shipped HTML size, target | <= 1.5 MB | `node tools/build.mjs`: byte length of `FingerLickinMusic.html` including the BOM; every build; sample 1 | <= 1,572,864 bytes at the Phase 16 gate; above it earlier prints the warning line of Part 3.3 [B] | every build from Phase 1; binding at Phase 16 |
| 2 | Shipped HTML size, hard limit | build fails above 2.5 MB | same | above 2,621,440 bytes the build exits 3 and writes no shipped file [B] | every build from Phase 1 |
| 3 | Load to main menu, desktop | <= 1.5 s | perf `boot-to-menu` on the shipped file from `file://`: `menuMs` = absolute `performance.now()` of the B16 record in `FLM.Boot.stage` (boot.ready, after SCR-MainMenu or SCR-FirstLaunch is mounted); 5 cold loads | median <= 1,500 ms and every load <= 2,250 ms [HD] | Phase 1; binding at every gate from Phase 1; device claim Phase 15 |
| 4 | Load to main menu, mobile | <= 3.0 s | same metric on the mobile devices of 9.2, read from SCR-Diagnostics "Load timing" of the shipped file; 5 cold loads | median <= 3,000 ms [D] | Phase 15 |
| 5 | Time to first playable interaction, desktop | <= 5 s from file open | perf `first-playable` on the test build with `?perf`: `ttiMs` = `performance.now()` at the `transport.state` emit with `state:'countin'` (or `'playing'` when count-in is off) for the Quick Play default selection (Part 1.7), minus the gesture wait (from the unlock control becoming ready to the gesture's `pointerdown`); every other step performed by automation with zero delay; 3 cold loads for each storage state (first launch, returning user with onboarding completed) | median of each storage state <= 5,000 ms [HD] | Phase 8; binding at every gate from Phase 8; device claim Phase 15 |
| 6 | Time to first playable interaction, mobile | <= 8 s | same on mobile devices (the tester taps the unlock control once; the `?perf` auto path performs the rest) | median of each storage state <= 8,000 ms [D] | Phase 15 |
| 7 | Frame rate, High tier, desktop | 60 FPS | perf `full-band-render --tier High`: `demo-poprock`, five performers, FullBand camera, chart bot on Keys at expert, `video.effectsLevel` 2; 60 s on device (>= 3,000 intervals), 20 s headless | p50 interval <= 17.5 ms and p95 interval <= 20.0 ms on the desktop reference [D] | Phase 5 (headless info); tuning Phase 14; claim Phase 15 |
| 8 | Frame rate, Balanced tier, mobile target | 60 FPS target | same scenario with `--tier Balanced` (device run: the assigned tier) on the mobile reference devices | p50 interval <= 17.5 ms; a miss is recorded as a known deviation (Partial with the measured value), not a defect [D] | Phase 15 |
| 9 | Frame rate, Balanced tier, mobile floor | >= 45 FPS | same run as row 8 | p95 interval <= 22.2 ms; a miss is a High-severity defect [D] | Phase 15 |
| 10 | Frame rate, Low tier | >= 30 FPS | same scenario at Low on every device whose initial or final tier is Low, and on the slowest mobile device of the matrix forced to Low | p95 interval <= 33.3 ms [D]; the same criterion applies to Abstract | Phase 15 |
| 11 | Automatic tier downgrade | one step down when p95 frame interval > 33 ms over the last 5 s (9.3.4) | (a) perf `tier-downgrade`: `FLM.debug.inject('render.slowFrames', {ms:45})` during playback; (b) the device runs of rows 7-10 | (a) first downgrade 500-2,500 ms after the injection starts, second downgrade >= 10,000 ms after the first, `lateEvents === 0`, highway tick equals `positionAt(audioNow)` within 1 tick (S-01) [H]; (b) no automatic downgrade during a 60 s run on a device that meets its floor [D] | (a) Phase 5; (b) Phase 15 |
| 12 | Scheduler lookahead | 120 ms | UT-05-16; perf `playback-dense`: `lookaheadMaxMs` = max over every emitted `sched.noteOn` of (`at` - `ctx.currentTime` at emission); >= 5,000 events | <= 125 ms (S-10) [H] | Phase 4 |
| 13 | Scheduler tick | 25 ms `setInterval` | perf `playback-dense`: `tickIntervalP50Ms`, `tickIntervalP95Ms`, `tickIntervalMaxMs` between consecutive tick starts (`performance.now()`), `tickWorkMaxMs` = longest tick body; >= 1,000 ticks | p50 in 23-27 ms; p95 <= 50 ms; max <= 95 ms (beyond it the 120 ms lookahead is exhausted); `tickWorkMaxMs` <= 4 ms (S-10) [HD] | Phase 4; device claim Phase 15 |
| 14 | Scheduling precision | scheduled start within 1 ms of the intended audio time | UT-05-15 and TT (OfflineAudioContext render of 1,000 notes, onset detection); perf `playback-dense`: `schedErrorMaxMs` = max of abs(`at` - `Transport.audioTimeAt(tick)` at the current speed) over all events not clamped, `lateEvents` = count of events clamped to `now + 5 ms` | offline onsets within one render quantum plus 1 ms; `schedErrorMaxMs` <= 1.0; `lateEvents === 0` [U for offline, HD for `lateEvents`] | Phase 4; device claim Phase 15 |
| 15 | No cumulative drift | abs drift < 2 ms after a 10 min loop | UT-04-20 (FakeClock); perf `loop-drift` (real AudioContext, 10 min, 4-bar loop of 8 s at 120 BPM, 75 passes): `driftMs` = max over passes N of abs(`audioTimeAt(loopStart)` on pass N - (pass-1 value + (N - 1) * loop seconds / speed)); `loop-drift-short` (60 s) in the default set | `driftMs` < 2.0 [U, H] | Phase 2 (UT); Phase 4 (real clock) |
| 16 | Input timestamping | `event.timeStamp` -> audio time through the anchored offset; added processing <= 1 frame | UT-07-11, UT-07-31; perf `input-latency`: 200 key presses dispatched by Playwright (`page.keyboard.down` and `up`) at random 50-150 ms spacing during playback: `inputProcMaxMs` and `inputProcP95Ms` = (`performance.now()` at the `input.event` emit) - `tPerf`; device variant: 50 pad taps by the tester | p95 <= 4 ms and max <= 16.7 ms [HD] | Phase 3; device claim Phase 15 |
| 17 | Live input to sound scheduling (B 20.1 input latency) | added processing <= 1 frame; device output latency compensated by calibration, not budgeted | perf `input-latency` in Free Play: `liveSchedMaxMs` = `performance.now()` when `liveNoteOn` schedules the voice - `tPerf`; device: `Audio.latency()` value recorded in the matrix notes | `liveSchedMaxMs` <= 16.7 ms [H]; output latency recorded per device [D] | Phase 6; device record Phase 15 |
| 18 | Memory, desktop steady state | <= 300 MB | perf `steady-memory`: High tier, `demo-poprock` looped, chart bot; samples every 5 s from 60 s to 120 s: `memSteadyMb` = max(heap + audio term); device: tab memory per 9.1.1 item 6 at 120 s | <= 300 MB without imported audio; with imported audio the limit is 300 MB plus the decoded audio bytes (bounded by 192 MB, Part 6.14) [HD] | Phase 5 (info); binding Phase 14; claim Phase 15 |
| 19 | Memory, mobile steady state | <= 150 MB | same on mobile devices at the assigned tier | <= 150 MB, plus decoded imported audio (bounded by 64 MB) [D] | Phase 15 |
| 20 | Memory growth after mode cycles | <= 10 MB after 20 enter and leave cycles | perf `mode-cycles-20` (9.6.1): tool-side heap A after 2 warm-up cycles, heap B after 20 measured cycles, both after forced collection | B - A <= 10 MB; `assertClean()` returns null on every leave (S-06) [H] | Phase 5 (first cycle test); binding Phase 14 |
| 21 | Polyphony, desktop | 64 voices; stealing order released-quietest, then oldest | UT-05-12, UT-05-13, UT-05-14; perf `chord-stress-1000` (9.6.4) | `voicesMax` <= 64; stealing order per UT-05-12; `activeVoices === 0` within 350 ms after stop [U, H] | Phase 4; binding Phase 14 |
| 22 | Polyphony, mobile | 32 voices | UT-05-14 (capacity by platform); device run of `chord-stress-1000` | `voicesMax` <= 32 on every mobile device; no audible stuck note after stop [U, D] | Phase 4 (UT); Phase 15 |
| 23 | Tracks per project | 32 | UT-15-05, UT-17-03 (the 33rd track is refused); perf `project-32-tracks` (9.6.5) | the 33rd track is refused with the documented message; 32-track playback with `lateEvents === 0` and `tickWorkMaxMs` <= 4 ms [U, HD] | Phase 9; binding Phase 14 |
| 24 | Import file size | MIDI, MusicXML, Guitar Pro <= 25 MB; audio <= 100 MB | UT-10-31, UT-12-26, UT-13-28; FT oversize cases (Part 12) | a larger file is refused with `E-IMP-001` before its content is read; the current project is unchanged (S-12) [U] | Phase 7; Phase 12 for MusicXML and Guitar Pro |
| 25 | Import event count | <= 1,000,000 events | UT-10-31; perf `import-large-midi` with a generated SMF of exactly 1,000,000 events and one of 1,000,001 | 1,000,000 accepted; 1,000,001 refused with `E-IMP-004` before the excess is allocated [U, H] | Phase 7 |
| 26 | Import track count | <= 128 tracks | UT-10-31; UT-13-28 | 129 refused with `E-IMP-004` before allocation [U] | Phase 7 |
| 27 | Chord size | <= 16 notes | UT-14-10 | larger chords handled per Part 6.14 with the documented warning [U] | Phase 7 |
| 28 | Import parse time | 5 s budget, then abort with an error | UT-10-32 (deadline); perf `import-large-midi`: `importMs` (validate to inspection report) and `parseMs` for the 1,000,000-event file | desktop: `parseMs` <= 4,000 and `importMs` <= 5,000 [HD]; any device: either completes within 5,000 ms or aborts with `E-IMP-005` and leaves the project unchanged [D] | Phase 7 |
| 29 | Project JSON, localStorage path | <= 2 MB per project | UT of M-16 routing (Part 6.16) and Part 5.8 routing table; perf `storage-save`: a 2 MB project on the localStorage path | a project above 2,097,152 bytes is never written to localStorage; `lsWriteMs` <= 100 ms desktop [U, H] | Phase 9 |
| 30 | Project JSON, IndexedDB path | up to the origin quota | UT-16-05, UT-16-23; FI `storage.writeFail` (Part 10.9) | a quota failure shows DLG-SaveFailed with Export and never reports success (S-14) [U] | Phase 9 |
| 31 | Project serialization time | <= 200 ms for 100,000 events | perf `serialize-100k`: project with 100,000 NoteEvents over 8 tracks; 5 repetitions | median `serializeMs` <= 200 desktop, <= 400 mobile; median `parseMs` <= 400 desktop (Part 6.15.6), <= 800 mobile [HD] | Phase 9; binding Phase 14 |
| 32 | Multiplayer player count | 2-4 players | IT (Part 12); perf `net-loopback` with 4 pages in the slow set | a fifth join is refused with the room-full message; 4 players complete a song [H] | Phase 13 |
| 33 | Multiplayer state rate | 10 Hz | perf `net-loopback`: host `state` messages per second at each guest over 60 s | mean 9.5-10.5 per s; no gap > 300 ms [H] | Phase 13 |
| 34 | Multiplayer inputs | sent immediately | perf `net-loopback`: `inputSendMaxMs` = DataChannel `send` time - `input.event` emit time | <= 4 ms [H] | Phase 13 |
| 35 | Clock sync schedule | 8 samples at start, then every 10 s | perf `net-loopback`: ping samples before `countdown`; interval between later sync rounds | exactly 8 samples before `countdown`; rounds every 10,000 +/- 500 ms [H] | Phase 13 |
| 36 | Multiplayer sync error | <= 20 ms | perf `net-loopback`: `syncErrorMaxMs` = max abs(estimated offset - true offset), the true offset taken from epoch-aligned clock samples of both pages (9.7.4); `startSkewMs` = difference of the song-start instants converted to epoch time; LT on two devices on one LAN | `syncErrorMaxMs` <= 20 and `startSkewMs` <= 20 [H]; LT: the sync badge reads "good" and the tester hears the count-in clicks of both devices as one [D] | Phase 13; claim Phase 15 |
| 37 | Multiplayer message size | <= 64 KB | UT of `Net.validateMessage` (Part 6.24); FI oversize message | larger messages are rejected and counted; the session continues [U] | Phase 13 |
| 38 | Avatar config size | <= 4 KB | UT of `Character.forNet` and `Net.validateMessage` | a larger avatar payload is rejected; the default avatar is shown [U] | Phase 10 (serializer); Phase 13 (enforcement) |
| 39 | Multiplayer rate limit | 60 messages per s per peer | UT of `Net.RateLimiter` | the 61st message within one second is dropped and counted [U] | Phase 13 |
| 40 | Judgment windows (half-width, standard preset) | beginner 45/90/135; intermediate 35/70/110; advanced 25/55/90; expert 18/40/70 ms | UT-09-01, UT-09-03, UT-09-04, UT-09-06 | exact table values; an input exactly on a boundary is inside [U] | Phase 3 |
| 41 | Scoring | perfect 100, great 70, good 40, miss 0; multiplier 1 + floor(combo / 10) capped at 4; integer score; accuracy = points / (100 * judged) | UT-09-08, UT-09-09, UT-09-10, UT-09-27 (replay determinism) | exact integers; identical input logs give identical `ScoreState` [U] | Phase 3 |
| 42 | Hold notes | release judged at the hold end with the same windows; early release beyond the good window is a hold break | UT-09-17, UT-09-18, UT-09-19 | tail judged as specified; head judgment kept on a break [U] | Phase 3; Phase 8 (charts with holds) |
| 43 | Touch targets | >= 56 x 56 CSS px, 8 px gap; pads span the bottom 28 % of the viewport in portrait and the right or bottom 24 % in landscape | headless layout test with touch emulation at 360 x 640, 390 x 844, 844 x 390, 768 x 1024, 1024 x 768: `getBoundingClientRect` of each pad and of the pad region at `input.padSize` small; XT on devices | every pad >= 56 x 56; every gap >= 8 px; region height (portrait) or width or height (landscape, per `input.padLayout`) within 1 px of 28 % or 24 % of the viewport after safe-area insets [H, D] | Phase 1 (layout); Phase 3 (pads); claim Phase 15 |
| 44 | Count-in | 1 or 2 bars, metronome accented on beat 1 | UT-04-11, UT-04-12, UT-04-13, UT-05-26; TT offline render of the clicks | click count = numerator x bars; the first click of each bar uses the accent shape [U] | Phase 4 |
| 45 | Autosave | on stop, on track add and delete, every 60 s while idle in Studio; never during recording or playback | UT-15-25, UT-17-22; IT with a storage write spy (Part 12) | zero storage writes while the transport state is `countin`, `playing` or `recording`; a write within 1,000 ms after stop; idle writes 60 +/- 1 s apart [U] | Phase 9 |
| 46 | Log ring buffer | 500 entries | UT-01-08 | exactly the last 500 entries kept [U] | Phase 1 |
| 47 | Diagnostics export | <= 200 KB | UT-01-20 | `bytes` <= 204,800 with oldest log entries dropped first [U] | Phase 1 |
| 48 | Visual lead time | default 1,500 ms; range 600-3,000 ms | settings clamp UT (Part 5.11 normalization); TT: a highway note reaches the hit line at `audioNow = audioTimeAt(note.tick)` | out-of-range values clamp; placement error <= one frame of travel (16.7 ms of lead) at 600, 1,500 and 3,000 ms [U] | Phase 5; Phase 8 (highway with charts) |

Release-blocking rows (E 13, E 1 Critical risks): a failure of row 14 (`lateEvents` during
normal gameplay on any claimed device), row 15, row 21 or 22 (voices remaining after stop),
row 2 or row 20 blocks the release regardless of other results. Severity of every other
budget failure follows Part 13.2.

#### 9.1.3 Derived budgets from module designs

These budgets come from Parts 2, 4 and 6 and are collected here so that one table holds
every number `tools/perf.mjs` checks. Each feeds a primary row.

| Budget | Value | Source | Scenario and metric | Gate | Feeds row |
|---|---|---|---|---|---|
| Script evaluation (Phase A, file open to B1) | <= 600 ms desktop, <= 1,200 ms mobile | this part (load budget split) | `boot-to-menu`: `phaseAMs` = `performance.now()` at B1 | [HD] | 3, 4 |
| Boot Phase B (B1 to B16) | <= 400 ms desktop, <= 800 ms mobile (sum of the Part 4.3 step budgets plus margin) | Part 4.3 | `boot-to-menu`: `boot.ready.ms` | [HD] | 3, 4 |
| Capability probing | <= 20 ms desktop | Part 6.1.6 | `boot-to-menu`: B3 stage delta | [H] | 3 |
| Mode enter, Quick Play with a built-in song | <= 1,000 ms desktop, <= 2,000 ms mobile from `Modes.enter` to `countin` | this part | `first-playable`: `enterMs` | [HD] | 5, 6 |
| Mode leave | <= 400 ms desktop including the 350 ms voice wait | Part 4.7.2 | `mode-cycles-20`: `leaveMaxMs` | [H] | 20 |
| Built-in song expansion | <= 50 ms per song desktop | ADR-14 decision 2 | `content-expand`: `expandMaxMs` | [H] | 5 |
| Built-in chart generation, one (track, difficulty, profile) | <= 30 ms desktop | this part (built-in tracks hold <= 2,000 notes) | `content-expand`: `chartBuiltinMaxMs` | [H] | 5 |
| Chart generation, 100,000-note track | <= 150 ms desktop, <= 400 ms mobile | Part 6.8.6 | `chart-generate`: `chartGenMs` | [HD] | 28 |
| SMF parse, 1,000,000 events | <= 4,000 ms desktop | Part 6.10.6 | `import-large-midi`: `parseMs` | [H] | 28 |
| ZIP inflate throughput | >= 10 MB/s of output desktop | Part 6.11.6 | `zip-inflate`: `inflateMBps` | [H] | 28 |
| Project parse, 100,000 events | <= 400 ms desktop | Part 6.15.6 | `serialize-100k`: `parseMs` | [H] | 31 |
| localStorage write of a 2 MB project | <= 100 ms desktop | Part 6.16.6 | `storage-save`: `lsWriteMs` | [H] | 29 |
| Scheduler tick body | <= 4 ms | S-10 (Part 4.6) | `playback-dense`, `chord-stress-1000`, `project-32-tracks`: `tickWorkMaxMs` | [H] | 13, 23 |
| Voice build | <= 0.15 ms per voice desktop | Part 6.6.6 | `chord-stress-1000`: `voiceBuildMeanMs` = `tickWorkSumMs` / `voicesStarted` over the run (an upper bound, since tick bodies also do other work) | info | 13 |
| Input handler | <= 0.1 ms per event desktop | Part 6.7.6 | covered by `inputProcP95Ms`; the handler alone is profiled with the browser profiler during Phase 14 tuning | info | 16 |
| Judge `onInput` | <= 0.05 ms per call | Part 6.9.6 | profiled with the browser profiler during Phase 14 tuning | info | 16 |
| Pluck buffer cache | <= 48 buffers desktop, 24 mobile (<= 29 MB, 15 MB) | Part 6.6.3 | UT-06-09; `steady-memory`: `pluckCacheMb` | [U] | 18, 19 |
| Decoded imported audio | <= 192 MB when `maxTouchPoints === 0`, else 64 MB | Part 6.14 | UT-14-16 | [U] | 18, 19 |
| Draw calls per frame | High <= 1,200; Balanced <= 900; Low <= 600 | ADR-03 decision 7, 9.3.1 | `full-band-render`: `drawsMax` | [H] | 7-10 |
| Triangles per frame | High <= 150,000; Balanced <= 80,000; Low <= 40,000 | 9.3.1 | `full-band-render`: `trisMax` | [H] | 7-10 |
| Tier switch main-thread block | longest task <= 80 ms during a tier change; no late events | 9.3.5 | `tier-downgrade`: `longTaskMaxMs` (PerformanceObserver `longtask`, Chromium), `lateEvents` | [H] | 11 |
| Indeterminate indicator delay | shown only after 300 ms of waiting | 9.4.3 (P 21) | UT of M-26 (Part 12) | [U] | 5 |

#### 9.1.4 Rules for using the budgets

1. A gated metric that fails is recorded in STATUS.md section 7 with its value and the run
   (scenario, tier, environment, date) and opens a defect in STATUS.md section 6; the
   requirement it verifies cannot become Implemented while the defect is open (Part 0.7).
2. A device-gated metric with no device run stays "not measured"; no headless value is
   written into a device cell and no headless value supports a performance claim in
   `docs/COMPATIBILITY.md`, `README.md`, SCR-About or the final report (B 1.4, B 20.1).
3. The Phase 16 final report (B 28 item 9) reproduces 9.1.2 with one value column per
   measured environment and the word "not measured" elsewhere.
4. Budgets apply to the shipped build. Scenarios that need the test build (hooks in
   M-31) measure an upper bound of the shipped build, because the shipped build is the
   test build minus the self-test files; a test-build pass therefore counts as a pass, and
   a test-build failure is re-measured on the shipped build where the metric is readable
   there (load timing on SCR-Diagnostics) before it is recorded as a failure.

### 9.2 Target-device matrix

#### 9.2.1 Device classes

B 20.1 and B 25.5 require representative desktop and mobile devices with recorded browser
versions and models. The classes below define what "desktop reference" and "mobile
reference" mean wherever Parts 2, 4 and 6 use those words. A tested device belongs to the
lowest class whose minimum it meets; its actual model, OS build and browser version are
recorded in its row.

| Class key | Class | Minimum specification | Examples that qualify | Browsers | Expected initial tier (9.3.3) |
|---|---|---|---|---|---|
| `ref-desktop` | Desktop reference | 4 CPU cores, 8 GB RAM, integrated GPU of the Intel UHD 620, Iris Xe, AMD Vega 8 or Apple M1 class; display 1920 x 1080 at DPR 1 or 2560 x 1600 at DPR 2; Windows 10 or 11, macOS 13 or newer, or a current Linux desktop | 2019 or newer business laptop; Apple MacBook Air M1 | Chrome, Firefox, Safari (macOS only) | High |
| `low-desktop` | Low-end desktop | 2 cores or 4 GB RAM, GPU of the Intel HD 4000 to HD 520 class | 2013-2016 laptop | Chrome | High, then an expected automatic downgrade |
| `ref-android` | Mobile reference, Android | 2021-2022 mid-range SoC (Snapdragon 695 or 778G, Dimensity 900 class), 6 GB RAM, Android 12 or newer | Pixel 6a, Galaxy A53 or A54 | Chrome | Balanced |
| `low-android` | Low-end Android | 3-4 GB RAM, Snapdragon 4-series or Helio G85 class (2019-2020), Android 10 or newer | Galaxy A12, Redmi 9 | Chrome | Balanced, then an expected downgrade to Low |
| `ref-ios` | Mobile reference, iOS | A13 to A15 SoC, iOS 16.4 or newer | iPhone 11, iPhone SE (2nd or 3rd generation), iPhone 12 or 13 | Safari | Balanced |
| `old-ios` | iOS floor device | A12 SoC on iOS 16.4 or newer | iPhone XR, iPhone XS | Safari | Balanced |
| `tablet` | Tablet | iPad with A13 or newer on iPadOS 16.4 or newer; or an Android tablet meeting `ref-android` | iPad (9th generation) | Safari or Chrome | Balanced (touch device) |
| `headless` | Session environment | Linux container, headless Chromium from Playwright, SwiftShader software GL (Part 0.10) | the implementing session's machine | Chromium (headless) | Balanced by `perf.mjs` default; any by `--tier` |

The `headless` row is not a target device: its values are regression signals, always
suffixed "(software GL)" where rendering is involved, and never support a device claim
(9.1.4 rule 2).

#### 9.2.2 Matrix template

The implementing session creates this table in `docs/COMPATIBILITY.md` when that file is
written (Phase 12); before then, and in addition afterwards, per-budget values go to
STATUS.md section 7 in the form Part 0.7 fixes. Every measurement cell starts as "not
measured". The Device column starts as the class key followed by "model recorded at test".

| Device | OS | Browser + version | Tier assigned | Load (ms) | TTI (ms) | FPS p50/p95 | Audio glitches | Memory (MB) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `ref-desktop`, model recorded at test | not measured | Chrome, version recorded at test | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| `ref-desktop`, model recorded at test | not measured | Firefox, version recorded at test | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| `ref-desktop` (macOS), model recorded at test | not measured | Safari, version recorded at test | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| `low-desktop`, model recorded at test | not measured | Chrome, version recorded at test | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| `ref-android`, model recorded at test | not measured | Chrome, version recorded at test | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| `low-android`, model recorded at test | not measured | Chrome, version recorded at test | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| `ref-ios`, model recorded at test | not measured | Safari, version recorded at test | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| `old-ios`, model recorded at test | not measured | Safari, version recorded at test | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| `tablet`, model recorded at test | not measured | Safari or Chrome, version recorded at test | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| `headless` | Linux (container) | Chromium headless, version from `perf.mjs` JSON | from `--tier` | from `boot-to-menu` | from `first-playable` | from `full-band-render`, "(software GL)" | from `playback-dense` (`lateEvents` only) | from `steady-memory` (heap + audio term) | GL renderer string, Playwright version |

#### 9.2.3 Filling rules

1. Only measured values are written. A cell without a measurement stays "not measured";
   estimates, expectations and values from another device are never written. The
   implementing session cannot reach physical devices (Part 0.10), so it fills only the
   `headless` row and transcribes device rows from reports the owner supplies.
2. Device reports come from the test build's SCR-Diagnostics "Run performance scenarios"
   control (9.7.5), which produces the same JSON shape as `tools/perf.mjs` with
   `environment: "device"`, plus the shipped build's SCR-Diagnostics "Load timing" line
   for the Load column. The owner pastes the JSON; the session transcribes it and stores
   the JSON verbatim in the LEDGER entry of the day.
3. Column sources:
   - Load: row 3 or 4 of 9.1.2, median of 5 cold loads of the shipped file, opened from
     `file://`; a second value from `http://` is added in Notes when tested.
   - TTI: row 5 or 6, median of 3 cold loads per storage state, written
     "first <ms> / returning <ms>".
   - Tier assigned: the initial tier (`render.tier` with `reason:'initial'`); when an
     automatic downgrade happens during the runs, append "-> <tier> (auto at <s> s)".
   - FPS p50/p95: `full-band-render`, 60 s at the assigned tier, written
     "<fps p50> / <fps p95>" with one decimal.
   - Audio glitches: `playback-dense` device run (120 s), written "<lateEvents> late /
     <n> heard", where "heard" is the number of clicks, dropouts or stutters the tester
     hears through headphones during the same run.
   - Memory: row 18 or 19 maximum, with the method in parentheses ("task manager",
     "Web Inspector", "remote Memory panel", "heap + audio").
   - Notes: date (YYYY-MM-DD); OS build; DPR and viewport in CSS px; unmasked GL renderer
     string when `WEBGL_debug_renderer_info` is available; `Audio.latency()` and
     `sampleRate`; `maxTouchPoints`; OQ-1 probe result (concurrent pointers counted on
     SCR-FirstLaunch); OQ-2 export path taken (OfflineAudioContext or MediaRecorder);
     Low Power Mode or battery saver state; any failing budget by 9.1 row number.
4. Evaluation: each row is evaluated against the 9.1.2 rows for its class (desktop rows
   for `ref-desktop` and `low-desktop`; mobile rows for the others) and for its assigned
   tier. A row passes only when every gated cell passes; a failing cell names the 9.1 row
   in Notes and opens a defect (9.1.4 rule 1).
5. Re-measurement updates the row in place with the new date; the replaced values are kept
   in the LEDGER entry of the re-measurement. A row with measurements is never deleted;
   rows for additional devices are added below the class they belong to.
6. A browser or device is published as Supported only under Part 1.6 policy; a matrix row
   that passes is necessary but not sufficient (the XT tests of Part 12 must also pass).
7. The Phase 16 final report (B 28 items 8 and 9) reproduces the matrix as it stands, with
   "not measured" cells unchanged.

### 9.3 Quality tiers

Four tiers exist: `High`, `Balanced`, `Low`, `Abstract` (ADR-03). They satisfy the five
fallback levels of B 12.7 (High = level 1, Balanced = level 2, Low = levels 3 and 4,
Abstract = level 5) and the three device profiles of I 12.1 (High, Balanced, Low) plus the
2D fallback. `FLM.Render.TIERS` holds the table below as deep-frozen data (S-07); the
`params` field of `render.tier` (Part 4.4) is the selected column.

#### 9.3.1 Parameters

Rows marked "ADR-03" repeat the normative values of ADR-03 decision 2 unchanged; the
`TierParams` field name of Part 6.18 is given in brackets; rows without a field name are
behavior decided here and implemented by the module named in the row.

| Parameter | High | Balanced | Low | Abstract |
|---|---|---|---|---|
| Context | WebGL2 (a forced High on WebGL1 is clamped to Balanced) | WebGL2 or WebGL1 | WebGL2 or WebGL1 | 2D canvas `#flat` |
| Resolution scale of CSS px x capped DPR (ADR-03) [`resolutionScale`] | 1.0 | 0.75 | 0.5 | 1.0 |
| DPR cap (ADR-03) [`dprCap`] | 2 | 2 | 1.5 | 2 |
| Drawing-buffer pixel budget (9.3.2) [`pixelBudget`] | 3,686,400 px (2560 x 1440) | 2,073,600 px (1920 x 1080) | 921,600 px (1280 x 720) | 2,073,600 px |
| MSAA, context `antialias` (ADR-03) [`antialias`] | on | on | off | n/a |
| Lights (ADR-03) [`pointLights`] | 1 directional + ambient + 4 point | 1 directional + ambient + 2 point | 1 directional + ambient | n/a |
| Point-light behavior (M-21) | stage spots pulse on `sched.beat` and on section markers | same, 2 spots | none | n/a |
| Blob shadows (ADR-03) [`blobShadows`] | on | on | off | n/a |
| Fog [`fog`] | linear | linear | linear | n/a |
| Capsule segments, radial x height rings (ADR-03) [`capsuleSeg`] | 16 x 8 | 10 x 6 | 6 x 4 | n/a |
| Sphere segments, longitude x latitude [`sphereSeg`] | 16 x 12 | 12 x 8 | 8 x 6 | n/a |
| Cylinder segments [`cylinderSeg`] | 16 | 12 | 8 | n/a |
| Stage set pieces [`stageDetail`] | `full`: floor, riser, truss, back panels, speaker stacks, light rigs | `reduced`: floor, riser, truss, back panels | `minimal`: floor and riser | `none`: backdrop gradient |
| Triangles per frame (perf budget, 9.1.3) | <= 150,000 | <= 80,000 | <= 40,000 | n/a |
| Draw calls per frame [`maxDrawsPerFrame`] | <= 1,200 | <= 900 | <= 600 (ADR-03 decision 7) | n/a |
| Particle cap (ADR-03) [`particlesCap`] | 256 | 96 | 0 | 0 |
| Max performers rendered | 5 | 5 | 5 | 0 humanoids; one visualizer column per performer slot (max 5) |
| Performers animated per frame (ADR-03) [`performersAnimated`] | 5 | 5 | 3 (the focused performer and the two with the most note activity in the last bar; the others hold the idle pose and get the abstract visualizer) | 0 |
| Animation update rate (ADR-03) [`animEveryNthFrame`] | every frame | every frame | every 2nd frame | visualizer every frame |
| Hand IK (two-bone, M-19) | every animated performer | every animated performer | animated performers only | n/a |
| Highway (ADR-03) | 3D lanes in `#view` | 3D lanes | 3D lanes, no glow | 2D lanes in `#flat` |
| Highway glow [`highwayGlow`] | on | on | off | off |
| Highway effects (M-21) | lane glow, hit flare, hold shimmer, beat and bar lines, judgment burst particles | lane glow, hit flare, beat and bar lines, burst particles (within the particle cap) | flat hit flare, beat and bar lines | filled hit flash, beat and bar lines |
| Highway note instances drawn [`highwayMaxNotes`] | 400 | 300 | 200 | 200 |
| Lane identification | color plus glyph meshes (circle, triangle, square, diamond) | same | same | color plus 2D glyphs |
| Visualizer items (rings, waves, floating notes, trails, B 12.4) [`visualizerCap`] | 128; trails 16 points | 96; trails 8 points | 48; no trails | 64 2D shapes; no trails |
| Camera (M-20, M-21) | director cuts with a 600 ms blend; smoothing on | same | cuts with a 300 ms blend | static framing |
| Frame-rate budget (9.1.2) | 60 FPS desktop (row 7) | 60 target, 45 floor mobile (rows 8, 9) | 30 floor (row 10) | 30 floor (row 10) |

Highway note cap: when more chart notes lie inside the lead window than
`highwayMaxNotes`, the notes nearest the hit line are drawn and the farthest are drawn as
soon as they come within the nearest `highwayMaxNotes`; a note is therefore never missing
from the highway while it is due (the cap only shortens the visible look-ahead in extreme
density, and the shortening is counted in `render.stats` for diagnostics).

Settings that further reduce effects apply on top of the tier and never raise it:
`video.effectsLevel` 1 halves the particle cap and the visualizer cap (rounded down);
`video.effectsLevel` 0 sets both to 0 and removes lane glow and hold shimmer, but keeps the
hit flare or flash, beat and bar lines and lane glyphs, because those carry musical
feedback (P 15 "visual effects can be reduced without breaking musical feedback");
`video.reducedMotion` (effective) removes camera blends (instant cuts) and camera
smoothing, disables director cuts other than user cuts, and sets point-light pulses to a
static level (P 7.3 "camera motion can be reduced or disabled"); `video.cameraMotion`
false disables director cuts only. None of these changes the frame-rate budget.

Unchanged across all tiers (the musical-feedback floor of B 12.7 and B 26.4): every chart
note is drawn at its correct time before it is due; judgments flash for every judged note;
beat and bar lines follow `sched.beat`; every sounding track has a visible performer or visualizer
response; visuals never invent activity (S-17).

#### 9.3.2 Resolution and pixel budget

`devicePixelRatio` enters only through the drawing-buffer size; it does not change the
tier choice (9.3.3). M-18 computes the buffer size on every `ui.layout` event and on every
tier change:

```js
// M-18. cssW, cssH: canvas client size in CSS px. p: the tier's params row.
// userScale: settings video.resolutionScale (0 = automatic).
function bufferSize(cssW, cssH, dpr, p, userScale) {
  const d = Math.min(dpr || 1, p.dprCap);
  const scale = userScale > 0 ? userScale : p.resolutionScale;
  let w = cssW * d * scale, h = cssH * d * scale;
  if (!(userScale > 0)) {                         // the budget never overrides a user choice
    const px = w * h;
    if (px > p.pixelBudget) { const k = Math.sqrt(p.pixelBudget / px); w *= k; h *= k; }
  }
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)),
           effectiveScale: Math.round(w) / Math.max(1, cssW * d) };
}
```

This is the resolution step of `Render.resize` (Part 6.18.4.2) with the pixel-budget clamp
added; the Abstract tier applies the same function to `#flat`. The canvas keeps its CSS
size; the browser scales the buffer to it. `effectiveScale` is
shown on SCR-Diagnostics and in `render.stats`. Decision: the pixel budget exists because
a 4K desktop display at DPR 2 would otherwise ask an integrated GPU for 8.3 million pixels
per frame on High; capping by pixels keeps the tier choice simple (ADR-03 decision 3) and
still uses the display's density on ordinary screens.

#### 9.3.3 Initial tier selection

`FLM.Render.pickTier()` runs once at boot step B8 (Part 4.3) and again when the user sets
`video.tier` to `auto`. It reproduces ADR-03 decision 3 exactly; DPR is handled by 9.3.2.

```js
// M-18. Returns {tier, reason, auto}. auto=false disables automatic downgrade (9.3.4).
function pickTier(caps, settings, urlTier) {
  const NAMES = { high: 'High', balanced: 'Balanced', low: 'Low', abstract: 'Abstract' };
  const best = caps.webgl2 ? 'High' : caps.webgl1 ? 'Balanced' : 'Abstract';   // ceiling
  const clampTo = (t) => order(t) <= order(best) ? t : best;   // order: Abstract 0 .. High 3
  if (urlTier) return { tier: clampTo(urlTier), reason: 'url', auto: false };
  if (settings.video.tier !== 'auto') return { tier: clampTo(NAMES[settings.video.tier]), reason: 'user', auto: false };
  if (!caps.webgl2 && !caps.webgl1) return { tier: 'Abstract', reason: 'initial', auto: true };
  if (!caps.webgl2) return { tier: 'Low', reason: 'initial', auto: true };
  const touch = caps.maxTouchPoints > 0;
  const minSide = Math.min(window.innerWidth, window.innerHeight);
  if (!touch && minSide >= 600) return { tier: 'High', reason: 'initial', auto: true };
  return { tier: 'Balanced', reason: 'initial', auto: true };
}
```

After the pick, `Render.init` creates the context for that tier; when context creation or
the base shader compile fails, it steps down one tier at a time (WebGL2 -> WebGL1 ->
Abstract) and the emitted `render.tier` carries the tier that actually initialized. A
forced tier above the ceiling (for example `?tier=High` on a WebGL1-only browser) is
clamped as shown and logged once with `Log.warn`; it never fails boot.

#### 9.3.4 Automatic downgrade

Ownership follows ADR-03 decision 4 and Part 6.18: M-18 keeps the frame ring and runs the
check once per second on its stats tick; M-28 calls `Render.holdAutoTier(3000)` at every
mode enter and `Render.setAutoTier(enabled)` when the rules below change the state; M-27
shows the toast on `render.tier` with `reason:'auto'`. The algorithm below is normative;
it refines the steps of Part 6.18.4.2 with the 5 s coverage requirement, the window reset
at the end of a hold and the 30 Hz cadence exception.

```js
// M-18. Frame ring: entries {t, dt} for the last 10 s (cap 1,200 entries).
function onFrame(tRaf) {
  const dt = tRaf - lastT; lastT = tRaf;
  if (!(dt > 0) || dt > 1000) { resetWindow(tRaf); return; }   // hidden page, sleep, clock jump
  ring.push({ t: tRaf, dt }); trimOlderThan(tRaf - 10000);
  if (tRaf - lastStatsAt >= 1000) { lastStatsAt = tRaf; computeStats(tRaf); autoTierCheck(tRaf); }
}
function resetWindow(t) { ring.length = 0; windowStart = t; }
// computeStats over entries with t >= now - 5000:
//   windowMs = now - max(windowStart, now - 5000); frames; p50; p95 (nearest rank);
//   locked30 = fraction of entries with abs(dt - 33.33) <= 1.5

function autoTierCheck(now) {
  if (!autoEnabled || tier === 'Abstract' || st.lost) return;
  if (now < heldUntil) { holdPending = true; return; }
  if (holdPending) { holdPending = false; resetWindow(now); return; }   // frames of the hold never count
  if (dialogsOpen > 0 || now - lastDowngradeAt < 10000) return;        // at most one step per 10 s
  if (stats.windowMs < 5000 || stats.frames < 60) return;              // need a full 5 s window
  if (stats.locked30 >= 0.9) { Log.once('tier-locked30', 'info', 'render', 'frame rate capped at 30 by the device'); return; }
  if (stats.p95 > 33) {
    const next = { High: 'Balanced', Balanced: 'Low', Low: 'Abstract' }[tier];
    setTier(next, 'auto');            // clears the ring, emits render.tier {reason:'auto'}
    lastDowngradeAt = now;
  }
}
```

The toast text is "Graphics quality lowered to <tier> to keep the music smooth" (ADR-03
decision 4).

Rules:

1. The window resets (`resetWindow`) on every tier change, on `ui.layout` (resize and
   orientation), on a frame gap above 1,000 ms (which covers `visibilitychange` back to
   visible), on `render.contextRestored`, and when a hold ends. M-28's
   `holdAutoTier(3000)` at mode enter (ADR-03 decision 4) therefore means the frames of the
   first 3 s (shader warm-up, first geometry upload) never count and the first possible
   evaluation is 8 s after entering. While a dialog is open the check is skipped.
2. The check runs in every mode whose render loop runs (gameplay, live and customize
   modes). It never runs while the loop is stopped.
3. The 30 Hz cadence exception (`locked30 >= 0.9`): a frame cadence locked to half of a
   60 Hz display (iOS Low Power Mode, battery savers, 30 Hz displays) is stable delivery
   at the Low target, and a downgrade would not raise it. Decision: such a window never
   triggers a downgrade; SCR-Diagnostics shows "Frame rate capped at 30 by the device".
4. There is no automatic upgrade (ADR-03 decision 4). An automatic downgrade lasts for
   the page session and is not written to settings: a transient cause (a background
   task, thermal throttling) must not silently lower quality forever; the toast tells the
   user each time and SCR-Settings offers the higher tier.
5. Automatic downgrade is disabled (`autoEnabled = pick.auto`, then
   `Render.setAutoTier`) when the tier came from `?tier=` (perf scenarios need a fixed
   tier) or from a `video.tier` value other than `auto`.
6. The memory and stall heuristics of Part 4.7.4 (heap above 80 % of
   `jsHeapSizeLimit`, or two consecutive `sched.stall` events above 500 ms) are evaluated
   by M-28, which first emits `mode.interrupted {cause:'memory' or 'stall', action:'continued'}`
   and then steps down one tier through `Render.setTier(next, 'auto')`; M-27 shows "Reduced
   visual quality to keep audio stable" instead of the generic downgrade toast when the
   `render.tier` follows such an interruption in the same task. They wait until 10 s have
   passed since
   the last downgrade (`Render.autoTierState().lastDowngradeAt`) and are active even when
   automatic downgrade is disabled by rule 5 (audio stability outranks a forced tier).
7. Context loss: after 3,000 ms without `webglcontextrestored` the tier becomes Abstract
   with reason `contextLoss` (ADR-03 decision 8). This is independent of the cooldown.

#### 9.3.5 User override and tier changes

- SCR-Settings Video offers `video.tier` values `auto`, `high`, `balanced`, `low`,
  `abstract` (Part 5.11). M-18 reacts to `settings.changed` for `video.tier`: a named
  tier calls `setTier(name, 'user')` immediately (no reload, no transport interruption)
  and disables automatic downgrade; `auto` re-runs `pickTier`, applies its result and
  re-enables it.
- `video.resolutionScale` other than 0 replaces the tier's resolution scale and bypasses
  the pixel budget (9.3.2).
- A tier change during playback rebuilds stage geometry and GL resources in steps of one
  performer or one prop group per task, so that no task blocks the main thread for more
  than 80 ms (derived budget in 9.1.3); until a performer is rebuilt it keeps drawing with
  the previous tier's meshes. The transport, Scheduler, Judge and HUD are not touched
  (S-15 applies to tier changes as to context loss).
- The active tier and the reason of the last change are shown on SCR-Settings Video and
  SCR-Diagnostics; the Abstract tier shows the label "Simplified view" (ADR-03
  consequences).

#### 9.3.6 Audio is independent of tiers

The tier controls drawing only. No tier, tier change, resolution change or effects setting
alters any of: the Scheduler (25 ms tick, 120 ms lookahead), the TempoMap and Transport
anchors, the polyphony cap and stealing order, instrument definitions and patches, the
metronome, the Judge and its windows, input timestamping, recording, or multiplayer
timing (I 12.1 "the audio scheduler must remain independent of these profiles", B 12.7
"audio and musical timing must take priority", B 21.3 "without corrupting the musical
timeline"). The polyphony cap depends on the device class (`Caps.isMobile()`, row 21 and
22) and the setting `audio.polyphonyCap`, never on the tier.

One documented coupling exists and it is evaluated only at mode enter: the global reverb
default (Part 1.5) is bypassed when the tier at mode enter is Low or Abstract and the user
has not enabled reverb explicitly. An automatic downgrade during a song never changes the
audio graph, so a downgrade cannot cause an audible change. Verified by the `tier-downgrade`
scenario (`lateEvents === 0` and `tickIntervalMaxMs` <= 95 ms across two downgrades) and
by S-02 (identical `ScoreState` at High and Abstract).

### 9.4 Loading strategy

B 20.4 requires progressive loading, a distinction between critical startup resources and
optional ones, and real progress only. E 10 item 9 prohibits loading everything at
startup. In a single-file product with no fetched assets (ADR-02) the whole file arrives
at once, so "loading" means computation: what is evaluated or built before the main menu,
and what is deferred to first use.

#### 9.4.1 Critical versus lazy

| Resource or work | Class | When it happens | Cost budget | Cached where, released when | Progress shown |
|---|---|---|---|---|---|
| Static shell markup and CSS (game identity, B 6.1 step 1) | critical | HTML parse, before any script | part of Phase A | n/a | the identity is visible immediately; no indicator |
| Script evaluation: module factories, frozen data tables (`GM_PROGRAMS`, `SCALES`, `CHORDS`, `Instruments.DEFINITIONS` as compact rows, `Character.OPTIONS`, `Render.TIERS`), content data as compact notation | critical | Phase A (Part 4.3) | <= 600 ms desktop, <= 1,200 ms mobile (9.1.3) | page lifetime | none |
| Capability probe, storage open, settings load | critical | B3, B5, B6 | per Part 4.3 | page lifetime | named boot states (9.4.3) |
| `AudioContext` object and bus graph (no unlock, no voices) | critical | B7 | 30 ms desktop | page lifetime (one context, S-18) | named boot state |
| WebGL context, base shader programs, 64 x 64 blob-shadow texture | critical | B8 | 150 ms desktop | page lifetime; rebuilt after context restore | named boot state |
| Catalog metadata of the five built-in songs (title, style, BPM, key, meter, duration, track list) | critical, data only | Phase A (M-30 registration) | included in Phase A | page lifetime | n/a; SCR-QuickPlay lists songs without expanding them |
| Built-in song expansion (compact notation -> `Song`) | lazy | first selection of a song (SCR-QuickPlay preview or mode enter) | <= 50 ms per song desktop (ADR-14) | Catalog memory, page lifetime | none (below the 300 ms indicator delay) |
| Tutorial song expansion | lazy | `tutorial` mode enter | <= 50 ms | page lifetime | none |
| Instrument definition resolution ("patch compilation"): family template merged with the per-program override into a frozen `InstrumentDef` | lazy | first `Instruments.definition(program)` call (warm-up at mode enter or the first note) | <= 0.05 ms per program | page-lifetime map of 128 entries plus the drum kit; never released (bounded, < 200 KB) | none |
| Per-context audio assets: white and pink noise buffers (1 s each), one `PeriodicWave` per organ-template program used, the reverb impulse (1.8 s stereo) | lazy | noise buffers on `audio.unlocked`; `PeriodicWave` on the program's first note or warm-up; impulse when reverb is first enabled | noise <= 10 ms total; impulse <= 30 ms | per `AudioContext`; dropped by `Instruments.onGraphRebuilt` after a hard panic and regenerated on demand | none |
| Pluck buffers (Karplus-Strong, Part 6.6.4.3) | lazy with warm-up | `Instruments.warmup` at mode enter (step 6 of Part 4.7.1) for every distinct (program, pitch, layer) of pluck-template tracks in the loaded song, up to the cache cap; Free Play warms the playable range on instrument selection | <= 0.6 ms per buffer; warm-up yields every 8 buffers; mode enter waits for it at most 300 ms, then continues and the rest is built on first use | LRU cache, 48 desktop or 24 mobile buffers, kept across modes (bounded; Part 6.6.3) | part of the mode-enter indicator |
| Charts for built-in songs | lazy | mode enter or SCR-QuickPlay preview for the selected (track, difficulty, profile); dance charts for the selected difficulty | <= 30 ms per chart desktop (9.1.3) | memory keyed by `settingsHash`, page lifetime, at most 64 charts with least-recently-used eviction (regenerated deterministically on demand) | none |
| Charts for imported songs | lazy | SCR-ImportInspect preview or mode enter | <= 150 ms per 100,000 notes desktop | same cache | indeterminate indicator after 300 ms |
| Stage GL resources (performer meshes, props, highway buffers, glyph meshes) | lazy per mode | `Stage.build` at mode enter (Part 4.7.1 step 9) | within the mode-enter budget (9.1.3) | disposed at mode leave (9.5) | part of the mode-enter indicator |
| Character editor preview performer | lazy | `customize` enter | within the mode-enter budget | disposed at leave | none |
| Imported file parse and normalize | user action | import | 5 s budget (row 28) | report Song until confirmed or cancelled | real fraction where measurable (9.4.3) |
| Decoded imported audio | user action | import of an audio file | browser decode; limits of Part 6.14 | held while the project references it; released by `Import.releaseAudio` | indeterminate (decoding is one browser call) |
| WAV mix export (OfflineAudioContext, 10 s chunks, ADR-04 decision 9) | user action | export | not budgeted (offline render) | released after the download | real fraction: chunks rendered / chunks total |
| Project load from IndexedDB or file | user action | SCR-Library open or file import | parse <= 400 ms per 100,000 events (row 31) | current project | indeterminate after 300 ms |
| Sound banks | none in v1 | n/a | n/a | n/a | the UI says "synthesized" (ADR-04; SoundFont loading is Deferred, Part 1.5) |
| Web fonts, images, models | none | n/a | n/a | n/a | n/a (system fonts, procedural geometry; ADR-02, ADR-13) |

#### 9.4.2 Patch compilation on first use

Decisions (normative for M-06; the Part 6.6 API calls the warm-up entry point `warm`, the
module table of Part 4.1 names it `warmup`; this part uses the Part 4.1 name):

1. `Instruments.definition(program)` resolves and freezes the definition on the first call
   for that program and returns the cached object on every later call. No definition is
   resolved at load.
2. Per-context assets are created on first need and cached per `AudioContext`; the cache
   is dropped only by `onGraphRebuilt` (hard panic) and `dispose`.
3. `Instruments.warmup(requests)` with `requests = [{program, loPitch, hiPitch}]` is called
   by M-28 at mode enter for every melodic track of the loaded song (pitch range = the
   track's lowest and highest note) and by SCR-FreePlay when the instrument changes. It
   resolves definitions, creates `PeriodicWave`s and fills the pluck cache in
   ascending-pitch order until the cap. It yields every 8 buffers through
   `Core.timers.setTimeout(..., 0, owner)` and is cancelled by mode leave through the
   owner token.
4. The Scheduler never waits for warm-up: a pluck buffer missing at note time is computed
   synchronously inside the tick (<= 0.6 ms, counted in `tickWorkMaxMs`).
5. Nothing in warm-up creates `AudioNode`s that outlive the call; voices are always created
   per note (Part 6.6), so `audioNodes` in `assertClean` is unaffected.

#### 9.4.3 Progress reporting

1. A percentage or a filling bar appears only when the work reports a `fraction` computed
   from countable units with a known total: bytes consumed by the SMF, Guitar Pro and ZIP
   readers; events processed by `generateAsync` and `parseAsync` with a known total; WAV
   chunks rendered. The fraction is monotonic and reaches 1.0 only on completion.
2. Work without a countable total (`DOMParser` of MusicXML, `decodeAudioData`, IndexedDB
   reads, mode enter) shows its named stage with an indeterminate indicator, and only
   after 300 ms of waiting (P 21 "loading indicators appear only when useful"); work that
   completes sooner shows nothing.
3. Boot shows the four named states B5 to B8 of Part 4.3 as they complete, never a
   percentage.
4. `import.progress` carries `fraction:null` whenever rule 1 does not apply (Part 4.4);
   the screen shows the label of the current `stage` (texts in Part 7.11) in both cases.
5. No progress value is derived from elapsed time or from a fixed schedule (B 20.4 "must
   not fabricate progress percentages", I 11.4, P 21).

### 9.5 Resource cleanup checklist

B 20.3 lists eight resource kinds that must be released; P 17 adds "event listeners are not
duplicated" and "switching modes does not leak resources"; E 10 item 13 prohibits ignoring
cleanup. The table maps each subsystem to what it releases, which step of the leave
sequence (Part 4.7.2) releases it, and the `assertClean()` counters of Part 4.7.3 that
observe it. "Extra check" names the 9.6 test measurement that covers what a counter
cannot see.

| Subsystem (module) | Resources released (B 20.3 item) | Released by | `assertClean()` counters and condition | Extra check |
|---|---|---|---|---|
| Voices (M-05, M-06) | every sounding and releasing voice and its nodes (audio voices) | leave steps 4-5: soft panic, then hard panic after 350 ms when voices remain | `activeVoices === 0`; `audioNodes === baseline` | `Audio.ctxCount() === 1` after 20 cycles (S-18); `audio.voices.peakActive` <= cap |
| Scheduler and channel strips (M-05) | the 25 ms interval, the pending list, one `ChannelStrip` per track | leave steps 3 and 7 (`Scheduler.unbind`) | `schedulerRunning === false`; `schedulerPending === 0`; `strips === baseline`; `timers === baseline` | none |
| Transport (M-04) | the loaded Song reference, loop, anchors, cursor | leave step 7 (`Transport.main.unload`) | `transportState`: `stopped` and `song() === null` | the preview Transport of `library` and `import` is unbound when the preview stops (`strips` back to baseline) |
| Decoded audio buffers (M-14, M-06) | imported `AudioBuffer`s no longer referenced by the current project (decoded audio buffers); the pluck cache is a bounded cache and is intentionally kept | `Import.releaseAudio()` on cancel, on project close and on track deletion | `audioBuffers` equals the current project's audio-track count | `pluckCacheMb` <= 29 desktop and 15 mobile; heap growth over repeated imports (9.6.3) |
| GPU resources (M-18, M-19, M-21) | buffers, textures, programs, vertex arrays, scene nodes of the stage, performers, props, highway (GPU resources) | leave step 8 (`Stage.dispose` through `Render`) | `glBuffers`, `glTextures`, `glPrograms`, `glVaos` each `=== baseline`; `sceneNodes === 0` | same counters after 20 cycles and after a forced context loss and restore during a cycle |
| Render loop (M-18) | the RAF handle and the frame callback | leave steps 8-9 | `rafHandles === 0`; `Render.loopRunning() === false` | the perf frame probe is stopped by the harness before the leave assertions |
| Animation state (M-20) | controllers, visualizers, StageDirector, pose and IK scratch buffers, anticipation queues (animation state) | leave step 8 (`Animation.Mixer.dispose`) | indirect only: `busListeners` (controllers subscribe to `sched.*`) and `sceneNodes` (visualizer nodes) | heap growth (9.6.1); UT of `Mixer.dispose` (Part 6.20) |
| DOM and bus listeners (M-01, M-07, M-26, M-27) | surface and pad listeners, screen listeners, bus subscriptions with the mode owner (event listeners) | leave steps 1 and 11 | `domListeners === baseline`; `busListeners === baseline`; `boundSurfaces === 0` | equal counts after cycle 1 and cycle 20 (no duplication, P 17) |
| Input state (M-07) | held controls, pointer-to-pad map, gamepad edge state | leave step 1 (`releaseAll('system')`, `unbind`) | `heldControls === 0` | none |
| Judges and charts (M-09, M-23) | Judge subscriptions, input logs, results arrays | leave step 6 (`dispose`) | `busListeners === baseline` | heap growth (9.6.1, 9.6.2) |
| Timers (M-01 wrappers) | autosave idle timer, debounce, toast and lock-heartbeat timers created with the owner | leave step 9 (`timers.clearOwner`, `raf.cancelOwner`) | `timers === baseline` | M-16 `counters()` returns `{tx:0, timers:0}` after leaving `studio` (Part 6.16.6) |
| UI (M-26, M-27) | dialogs, screens above the menu, HUD, touch pads | leave step 10 | `openDialogs === 0`; `screenDepth === 1`; `hudHidden` and `touchHidden` true | DOM node count of `#overlay` equal after cycle 1 and cycle 20 |
| Network (M-24) | RTCPeerConnection, DataChannel, relay socket, ping and state timers (network connections) | leave step 12 (`Net.close`) | `netConnections === 0` (1 only when leaving to `results` after a multiplayer song); `timers === baseline` | `net-loopback`: `connectionsAfterClose === 0` (`Net.connectionCount()` after the session closes) |
| Recording (M-17) | the in-progress take's event array, held-note map, loop-pass buffers (temporary recording buffers) | leave step 2 (`Recorder.abort`) | `recorderState === 'idle'` | heap growth over record cycles (9.6.6) |
| Imported-file buffers (M-10 to M-14) | the file's `ArrayBuffer`, parser intermediates (raw note records, ZIP entry buffers, the `DOMParser` document) (imported-file buffers) | M-14 drops them when the `InspectionReport` is built or the import is cancelled (`Import.cancel`) | none (no counter can see them) | heap growth over 25 imports <= 10 MB (9.6.3) |
| Storage (M-16) | open IndexedDB transactions, tab-lock heartbeat | M-16 on transaction completion and on `unlock` | `timers === baseline` | M-16 `counters()` as above |

Rules:

1. Every resource above is created through a counted wrapper or with the mode's owner
   token (Part 4.7.1), so the leave sequence can release it without knowing its creator.
2. A counter that does not return to its condition is reported as `E-MODE-001` with the
   counter names (Part 4.7.2 step 15) and fails the integration tests in the test build.
3. "Extra check" measurements are part of the 9.6 tests; they are not run on every leave.
4. Intentionally retained caches (instrument definitions, per-context audio assets, the
   pluck cache, built-in Songs and charts) are bounded by the limits in 9.4.1 and are part
   of the `menu` baseline after their first creation; the 9.6.1 warm-up cycles exist so
   that their first creation is not counted as growth.

### 9.6 Long-session and memory tests

These six tests implement B 25.6 ("long sessions", "large project loading", "memory after
repeated mode changes", "dense polyphonic passages"), P 17 ("long playback and recording
sessions are tested", "large file imports are tested") and I 12.2 (resource limits). Each
is a `tools/perf.mjs` scenario (9.7) whose in-page part lives in
`src/92-test-perf-smoke.js`; Part 12 assigns their PT identifiers and lists them in the
acceptance tables. All synthetic content is generated in page from a seeded `Prng`
(seed `0xF1A9` unless stated) so runs are reproducible and need no corpus files.

Common procedure: before each measured section the tool forces a garbage collection and
reads the heap (9.1.1 item 6); during the run the harness samples, every 5 s,
`performance.memory.usedJSHeapSize` (when available), `Audio.VoiceAllocator.activeCount()`,
`Audio.nodeCount()`, `Render.counters()`, `Core.timers.count()`, `bus.listenerCount()` and
`Core.dom.count()`; every `assertClean()` result is recorded. A scenario fails at the
first `E-MODE-001`, uncaught error, or `#fatal` display.

#### 9.6.1 Twenty mode cycles (`mode-cycles-20`)

- Purpose: S-06, row 20; B 20.3 last sentence, P 3 "repeated navigation does not
  duplicate event listeners", P 17.
- Setup: shipped content only; tier from `--tier`; storage empty except settings with
  onboarding completed.
- Cycle definition per mode: `Modes.enter(mode, params)`, run the mode's activity, then
  `Modes.leave('user')` back to `menu`:
  - `quickplay` and `instrument`: `demo-poprock`, track Keys, intermediate, chart bot,
    3 s of play.
  - `dance`: `demo-dance`, normal, chart bot on dance controls, 3 s.
  - `freeplay`: 24 synthesized lane presses over 3 s with sustain toggled once.
  - `studio`: open a new project, add one track, record 3 s of synthesized input with a
    1-bar count-in, stop (the take is kept), leave (autosave runs).
  - `customize`: change 5 options on one character, 2 s of preview.
  - `library` and `import`: start and stop a 2 s preview of a built-in song.
  - `tutorial`: start step 1, 2 s.
- Default set: modes `quickplay`, `freeplay`, `studio`, `dance`; 2 warm-up cycles of each
  (not measured), then 20 measured cycles of each, in round-robin order. Slow set: all
  nine modes listed above, 20 measured cycles each.
- Measurements: heap A (after warm-up) and heap B (after the last cycle), both after forced
  collection; `assertClean()` after every leave; `leaveMs` of every leave; GL counters,
  `audioNodes`, `timers`, `busListeners`, `domListeners` after cycle 1 and cycle 20;
  `Audio.ctxCount()`.
- Pass: B - A <= 10 MB; every `assertClean()` null; `leaveMaxMs` <= 400 ms; the counters
  after cycle 20 equal those after cycle 1; `Audio.ctxCount() === 1`.
- Duration: default about 150 s; slow about 450 s.

#### 9.6.2 Thirty-minute playback (`playback-long`)

- Purpose: B 25.6 "long sessions", P 6.2 "long sessions do not create runaway voices or
  memory growth", P 6.3 "timing tests cover long playback sessions", E 2.2.
- Setup: `quickplay` with `demo-dance` (the longest piece, 112.5 s), track Hook, expert,
  whole-song loop, chart bot, `video.effectsLevel` 2, tier from `--tier`.
- Procedure: 30 minutes (16 loop passes) of real-time playback; at minute 15 a pause of
  10 s and resume; at minute 20 a seek to the Drop section.
- Measurements every 60 s: heap (in page), `activeVoices`, `audioNodes`, `lateEvents`,
  `sched.stall` count, frame p95 of the last minute, `driftMs` at each loop wrap (as row
  15), `ScoreState.judged`.
- Pass: `heapGrowthMb` (tool side, after forced collection: heap after the measured run
  minus heap after a 2 min warm-up run of the same scenario, 9.7.1) <= 10 MB, with the
  in-page samples recorded as info; `audioNodes` never exceeds
  (cap x 11 + base graph) and returns to the base graph within 350 ms of the final stop;
  `lateEvents === 0`; `driftMs` < 2.0 at every wrap; after the seek and the resume the
  chart bot's judgments stay `perfect` (any non-perfect judgment means the timeline and
  the highway diverged).
- Set: slow (30 min). Device set: the same with a 10 min duration on each mobile device
  of 9.2 (the Audio glitches column uses the shorter `playback-dense` run).

#### 9.6.3 Repeated import (`import-repeat`)

- Purpose: P 17 "large file imports are tested", B 20.3 "imported-file buffers", I 12.2.
- Setup: generated inputs: a format-1 SMF of 16 tracks and 200,000 events (about 1.2 MB),
  a 4 MB `.mxl` built from a generated MusicXML document compressed with
  `CompressionStream('deflate-raw')` and written as a ZIP container with
  `META-INF/container.xml` and one deflate entry (method 8) (skipped with a note when the
  browser lacks `deflate-raw`), and a 30 s stereo 48 kHz WAV.
- Procedure: per iteration, import each file through `Import.importFile` (the same path as
  the file picker), wait for `import.done`, then cancel the inspection; on every 5th
  iteration confirm the SMF as a new project, play it for 2 s, then delete the project.
- Iterations: 2 warm-up plus 25 measured (slow set); 2 warm-up plus 5 measured (default
  set).
- Measurements: heap after warm-up and after the last iteration (forced collection);
  `Import.audioBufferCount()` after every cancel; `importMs` per file.
- Pass: heap growth <= 10 MB; `audioBufferCount()` returns to the current project's audio
  track count after every cancel; `importMs` of the SMF does not grow by more than 20 %
  between the first and last measured iteration; the current project before the run is
  unchanged by deep equality after it (S-12).

#### 9.6.4 One-thousand-note chord stress (`chord-stress-1000`)

- Purpose: E 2.2 "a dense chord contains many simultaneous note events", E 2.3 "maximum
  polyphony limit is reached", B 11.6 "unbounded voice creation", rows 21-22, S-10.
- Setup: a generated Song of 8 tracks (programs 0, 19, 48, 52, 61, 81, 89 and one drum
  track); each beat for 16 beats at 120 BPM holds exactly 1,000 NoteEvents at the same
  tick (125 per track, durations of 1 beat, velocities 40-120; the drum track cycles
  through keys 35-81 so every drum note is mapped); then 8 beats of silence.
  Played through `Transport.main` and the Scheduler with a chart-free `freeplay`-style
  binding (no Judge); tier from `--tier`, five performers on stage.
- Measurements: `voicesMax`, `stolen`, `dropped` (from `audio.voices`), `tickWorkMaxMs`,
  `voiceBuildMeanMs`, `lateEvents` for events after each chord (the next beat), frame p95,
  `activeVoices` 350 ms after the final stop, `audioNodes` after the final stop.
- Pass: `voicesMax` <= the cap (64 desktop, 32 on mobile devices); every one of the 16,000
  notes is accounted for as started (including notes later stolen) or dropped
  (`started + dropped === 16000`);
  `tickWorkMaxMs` <= 4 ms; `lateEvents === 0` for the events of the beats after each
  chord; `activeVoices === 0` 350 ms after stop; `audioNodes` back to the base graph; no
  error report.
- Duration: 20 s (default set and device set).

#### 9.6.5 Thirty-two-track project (`project-32-tracks`)

- Purpose: row 23, B 25.6 "large project loading", B 16.3 "track playback must remain
  synchronized", P 10 "long projects remain manageable".
- Setup: a generated Project of 32 tracks (programs spread over the 16 families, 2 drum
  tracks), 3,000 NoteEvents per track (96,000 notes), CC 7 and CC 10 per track, 300 s
  long at 100 BPM with 2 tempo changes and 1 meter change; saved to IndexedDB through
  `Storage.saveProject` before measuring.
- Procedure: load it from IndexedDB through SCR-Library's code path; enter `studio`; play
  60 s (default set) or the full 300 s (slow set) while toggling mute on one track and
  solo on another every 2 s and moving one pan control every 500 ms; stop; save; reload
  from storage; compare.
- Measurements: `loadMs` (storage read to `project.loaded`), `serializeMs` of the save,
  `lateEvents`, `tickWorkMaxMs`, `voicesMax`, frame p95, heap steady maximum.
- Pass: `lateEvents === 0`; `tickWorkMaxMs` <= 4 ms; `serializeMs` <= 200 ms desktop
  (row 31 applies because the project holds about 100,000 events); the reloaded project
  is deep-equal to the saved one apart from `modifiedAt`; heap within row 18 or 19.

#### 9.6.6 Long recording session (`record-long`)

- Purpose: P 17 "long playback and recording sessions are tested", E 5.1 "the recording
  contains many simultaneous notes", B 16.3.
- Setup: `studio` with a project made from `demo-poprock` through `Project.fromSong`
  (5 tracks); one new track armed.
- Procedure: record 20 minutes over a looped 16-bar section (32 s at 120 BPM, so 37 full
  passes, within the 64-pass cap of Part 6.17.6) with loop recording on, the harness
  pressing synthesized lanes at 8 notes per second with chords of up to 4 notes every
  2 s; then stop, keep the last pass, save.
- Measurements: `heapGrowthMb` as in 9.6.2 (warm-up run: 2 min of the same recording);
  in-page heap every 60 s (info); `lateEvents`; recorded event count against presses sent;
  take status; save result.
- Pass: every press during the kept pass appears as one NoteEvent with a matching release
  (no stuck note, no duplicate), and every completed pass emits `studio.take` with an
  `eventCount` equal to the presses sent during that pass; `lateEvents === 0`; heap growth over the session
  <= 10 MB plus the size of the kept takes (about 100 bytes per recorded event, Part
  6.17.6); the take is `complete` and the save emits `project.saved`.
- Set: slow (20 min).

### 9.7 `tools/perf.mjs` scenarios

Part 3.5 fixes the command line, the launch and fallback chain, the output table and the
exit codes. This section fixes the scenarios, the in-page harness contract, the sets, the
result shape and the thresholds.

#### 9.7.1 Sets, page loads and watchdog

- Default set (no `--scenario`, no `--slow`): every scenario whose Set column in 9.7.3
  contains "default". Planned duration about 10 minutes.
- Slow set (`--slow`, the flag meaning of Part 3.4): the default set plus every scenario
  marked "slow". Planned duration about 90 minutes. Phase 14 and Phase 16 gates run it
  once; other gates run the default set.
- `--scenario <name>` runs exactly the named scenarios regardless of set.
- Page loads: harness scenarios open `file://<test build>?test&tier=<tier>&perf` once per
  scenario in a fresh browser context, wait for `FLM.selfTestReady`, then call the
  harness (9.7.2). Load-class scenarios differ: `boot-to-menu` opens the shipped
  `FingerLickinMusic.html?tier=<tier>` (no `test`, no `perf`) and reads `FLM.Boot.stage`
  after `boot.ready`; `first-playable` opens the test build with `?perf&tier=<tier>`
  (without `test`, so boot reaches the menu) where the `?perf` auto path of 9.7.2 drives
  Quick Play after the gesture. Both use a new context per load.
- Watchdog: `max(240 s, 1.5 x planned duration of the selected scenarios x repeat + 120 s)`
  unless `--timeout` is given. Decision: the fixed 240 s and 900 s values of Part 3.4 are
  too short for real-time scenarios (the slow set holds 30-minute and 20-minute runs), so
  perf.mjs derives its watchdog from the planned durations in 9.7.3 while keeping the
  Part 3.4 exit code 2 on expiry.
- Heap: before and after each scenario the tool forces a collection and reads the heap through CDP (9.1.1 item 6). Scenarios with a
  heap budget are invoked twice: first with `{warmup:true}` (short form, result
  discarded), then measured, so that one-time caches are not counted as growth.

#### 9.7.2 In-page harness contract (test build only)

`FLM.SelfTest.perf` lives in `src/92-test-perf-smoke.js` (Part 3.1) and is absent from the
shipped build.

```js
FLM.SelfTest.perf = {
  /** Names of every scenario of 9.7.3 that runs in page. */
  list() /* -> string[] */,
  /** Runs one scenario. opts: {durationMs?, warmup?, tier?, device?} where
   *  device:true selects the device-set durations of 9.7.3. Never rejects: a failure inside
   *  the scenario resolves with notes:['error: <code> <message>'] and metrics so far. */
  run(name, opts) /* -> Promise<{name, durationMs, metrics:{[metric]:number}, samples:{[metric]:number}, notes:[string]}> */,
  /** Tool-assisted scenarios (input-latency) call back into the page between steps. */
  step(name, index) /* -> Promise<object> */,
};
```

Harness rules:

1. Frame probe: the harness starts its own frame chain with `Core.raf.request(fn,
   'perf-probe')` after the mode is entered and records every RAF timestamp; it cancels
   the chain with `Core.raf.cancelOwner('perf-probe')` before any `Modes.leave`, so
   `assertClean()` stays meaningful. Because all callbacks of one frame share the
   timestamp argument, the probe sees the same intervals as the render loop.
2. Scheduler metrics. Lookahead and scheduling error are computed by the harness in its
   own `sched.noteOn` listener (the listener runs synchronously inside the emit, so
   `ctx.currentTime` read there is the emission time; `at` and `tick` come from the
   payload). Tick intervals, tick body durations and clamp counts come from the
   `scheduler` diagnostics provider that M-05 registers with `Core.Diagnostics.provide`
   (Part 6.1.2): cumulative fields `ticks`, `clamped`, `notesScheduled`, `voicesStarted`,
   `tickWorkSumMs`, a tick-interval histogram (1 ms buckets from 0 to 200 ms plus an
   overflow bucket) and a tick-body histogram (0.1 ms buckets from 0 to 20 ms plus an
   overflow bucket). The harness reads the provider at the start and the end of the
   measured section and takes differences; a maximum is the upper edge of the highest
   non-empty bucket of the difference. The provider is part of the shipped build because
   SCR-Diagnostics shows the same values; it returns counts only, so the redaction of
   Part 6.1.4.6 has nothing to remove. Input metrics are computed the same way from the
   harness's `input.event` listener (`performance.now() - tPerf`); `liveSchedMaxMs` pairs
   each live `sched.noteOn` with the latest press before it.
3. The `?perf` auto path (test build, `first-playable` and device TTI): after `boot.ready`
   the harness records `tReady` (the unlock control is ready), listens once for the
   gesture's `pointerdown` or `keydown` (`tGesture` = its `timeStamp`), completes any
   SCR-FirstLaunch steps with their defaults programmatically, enters `quickplay` with the
   Part 1.7 default selection and records the `countin` emit time `tStart`.
   `ttiMs = tStart - (tGesture - tReady)`; `enterMs` is measured from the
   `Modes.enter` call to `tStart`.
4. Chart bot and synthesized input follow 9.1.1 item 12; tool-driven key presses (in
   `input-latency`) are real CDP input events and therefore trusted events.
5. Every run ends with `Modes.leave('user')` and an `assertClean()` whose result is put in
   `notes` when not null (and fails the scenario).
6. Audio: the tool shares the launch flags of Part 3.4, including
   `--autoplay-policy=no-user-gesture-required`, so harness scenarios call `Audio.unlock()`
   directly after `selfTestReady`; `first-playable` still performs a real click on the
   unlock control so that the measured path is the user's path.

#### 9.7.3 Scenario list

"Set" lists the sets that include the scenario; "device" means it is offered by the device
runner of 9.7.5. Durations are planned values for one repeat.

| Scenario | Set | Setup | Duration | Metrics | Budget rows |
|---|---|---|---|---|---|
| `boot-to-menu` | default; device by the manual procedure of 9.7.5 | shipped file, empty storage, 5 cold loads | about 10 s | `menuMs` (median), `menuMsMax`, `phaseAMs`, `bootMs` (`boot.ready.ms`), `capsMs` | 3, 4; 9.1.3 Phase A, Phase B, caps |
| `first-playable` | default; device by the manual procedure of 9.7.5 | test build `?perf`; 3 cold loads with empty storage and 3 with onboarding completed | about 25 s | `ttiMs`, `ttiFirstLaunchMs`, `enterMs` | 5, 6; 9.1.3 mode enter |
| `playback-dense` | default (30 s), device (120 s) | `instrument` mode, `demo-electro`, track Arp, expert, chart bot, all tracks audible | 30 s or 120 s | `lookaheadMaxMs`, `tickIntervalP50Ms`, `tickIntervalP95Ms`, `tickIntervalMaxMs`, `tickWorkMaxMs`, `schedErrorMaxMs`, `lateEvents`, `stalls`, `voicesMax`, `frameP50Ms`, `frameP95Ms` | 12, 13, 14; 9.1.3 tick body |
| `full-band-render` | default (20 s), device (60 s) | `quickplay`, `demo-poprock`, five performers, FullBand camera, Keys expert, chart bot, `video.effectsLevel` 2 | 20 s or 60 s | `frameP50Ms`, `frameP95Ms`, `fpsP50`, `fpsP95`, `drawsMax`, `trisMax`, `particlesMax`, `downgrades`, `lateEvents` | 7, 8, 9, 10, 11(b); 9.1.3 draws, triangles |
| `tier-downgrade` | default | page opened without the `tier` parameter so that automatic downgrade is active (headless initial pick: High, because WebGL2 is present, there is no touch and the 1280 x 720 viewport has a short side >= 600); `quickplay`, `demo-poprock`; `render.slowFrames {ms:45}` injected from t = 10 s to t = 30 s after mode enter | 35 s | `firstDowngradeMs` (after injection start), `secondDowngradeGapMs`, `tickDriftTicks` (highway tick minus `positionAt(audioNow)` at each frame, max abs), `lateEvents`, `longTaskMaxMs`, `tickIntervalMaxMs` | 11(a); 9.1.3 tier switch |
| `loop-drift-short` | default | `instrument`, `demo-poprock`, 4-bar loop of the first verse at 120 BPM (8 s), real clock | 60 s | `driftMs` | 15 |
| `loop-drift` | slow | same loop as row 15: 4-bar loop at 120 BPM (8 s), generated click song | 600 s | `driftMs`, `lateEvents` | 15 |
| `input-latency` | default, device (touch variant, 50 taps) | tool-assisted: phase 1 `instrument` with `demo-piano`, beginner, 100 presses of the lane keys; phase 2 `freeplay`, 100 presses; presses sent with `page.keyboard` at random 50-150 ms spacing (seeded) | about 25 s | `inputProcP95Ms`, `inputProcMaxMs`, `liveSchedMaxMs`, `anchorJitterMs` | 16, 17 |
| `steady-memory` | default, device | `quickplay`, `demo-poprock` looped, High (headless: the `--tier` value), chart bot; samples every 5 s from 60 s to 120 s | 120 s | `memSteadyMb`, `heapSteadyMb`, `pluckCacheMb` | 18, 19 |
| `mode-cycles-20` | default (4 modes), slow (9 modes) | 9.6.1 | about 150 s or 450 s | `heapGrowthMb`, `leaveMaxMs`, `assertCleanFailures`, `counterDiffs` | 20; 9.1.3 mode leave |
| `chord-stress-1000` | default, device | 9.6.4 | 20 s | `voicesMax`, `stolen`, `dropped`, `started`, `tickWorkMaxMs`, `voiceBuildMeanMs`, `lateEvents`, `activeVoicesAfterStop`, `frameP95Ms` | 21, 22; 9.1.3 voice build |
| `project-32-tracks` | default (60 s play), slow (300 s play) | 9.6.5 | about 70 s or 310 s | `loadMs`, `serializeMs`, `lateEvents`, `tickWorkMaxMs`, `voicesMax`, `frameP95Ms`, `heapSteadyMb` | 23, 31 |
| `import-large-midi` | default | generated format-1 SMF with exactly 1,000,000 events over 16 tracks (written with `FLM.Midi.write`); a second file with 1,000,001 events | about 15 s | `importMs`, `parseMs`, `refusedOverLimit` (1 when the second file fails with `E-IMP-004`) | 25, 28; 9.1.3 SMF parse |
| `zip-inflate` | default | 20 MB of generated MusicXML text compressed with `CompressionStream('deflate-raw')`, inflated by `FLM.Zip.inflate` | about 5 s | `inflateMBps` | 9.1.3 inflate |
| `serialize-100k` | default | generated Project: 8 tracks, 100,000 NoteEvents, 2,000 CCs; 5 repetitions | about 10 s | `serializeMs` (median), `parseMs` (median), `bytes` | 31; 9.1.3 project parse |
| `storage-save` | default | a project of 2,000,000 bytes serialized on the localStorage path (IndexedDB disabled by the test fake); a 10 MB project on the IndexedDB path | about 10 s | `lsWriteMs`, `idbWriteMs` (info), `falseSuccess` (count of `project.saved` without a verified read-back; must be 0) | 29, 30 |
| `content-expand` | default | built-in caches cleared through the M-31 fake; expand all five songs and generate one chart per melodic track at intermediate, profile A | about 5 s | `expandMaxMs`, `chartBuiltinMaxMs` | 9.1.3 expansion, built-in charts |
| `chart-generate` | default | generated track of 100,000 notes with chords up to 6 notes | about 5 s | `chartGenMs` (median of 3) | 9.1.3 chart generation |
| `net-loopback` | default (2 pages, 60 s), slow (4 pages, 120 s) | tool-assisted: one host page and one or three guest pages in one browser; invite and answer codes copied between pages by the tool; Synchronized Play on `demo-poprock` with chart bots | about 75 s or 140 s | `syncErrorMaxMs`, `startSkewMs`, `stateRateHz`, `stateGapMaxMs`, `inputSendMaxMs`, `syncSamplesBeforeStart`, `resyncIntervalMs`, `connectionsAfterClose` | 32-36 |
| `import-repeat` | default (5 iterations), slow (25 iterations) | 9.6.3 | about 30 s or 150 s | `heapGrowthMb`, `audioBuffersLeft`, `importMsFirst`, `importMsLast` | 9.6.3 |
| `playback-long` | slow; device (10 min) | 9.6.2 | 1,800 s | `heapGrowthMb`, `audioNodesMax`, `lateEvents`, `stalls`, `driftMs`, `nonPerfectBotJudgments`, `frameP95Ms` (per minute, max) | 15, 18, 20 |
| `record-long` | slow | 9.6.6 | 1,200 s | `heapGrowthMb`, `lateEvents`, `missingEvents`, `duplicateEvents`, `saveOk` | 9.6.6 |

#### 9.7.4 Multiplayer loopback measurement

The true clock offset between two pages is measurable because both pages run on one
machine: each page samples, at the same moments requested by the tool, the pair
(`performance.timeOrigin + performance.now()`, `ctx.currentTime`) and reports it. For a
host sample (eH, aH) and a guest sample (eG, aG), the true offset of the guest's audio clock
to the host's is `trueOffsetMs = ((aH - eH / 1000) - (aG - eG / 1000)) * 1000`. The tool
requests 20 sample pairs every 5 s; `syncErrorMaxMs` is the maximum of
`abs(Net.Clock.offsetMs() - trueOffsetMs)` over all pairs after the first sync round.
`startSkewMs` converts each page's song-start audio time to epoch time through the same
sample pairs and takes the difference. The method assumes the epoch clocks of the two
pages agree, which holds for pages of one browser process on one machine; it is not used
on devices, where the LT procedure of row 36 applies.

#### 9.7.5 Device runs

The test build's SCR-Diagnostics shows a "Run performance scenarios" control (next to
"Run self-test", ADR-11 decision 10). It runs the scenarios marked "device" with the
device durations, one after another, on the device's assigned tier, and shows a summary
table and a "Copy results" button that copies the JSON of 9.7.6 with
`environment: "device"`. Scenarios that need cold loads (`boot-to-menu`,
`first-playable`) are not run from this control: the screen instead explains the manual
procedure (close the browser, open the file, read "Load timing" on SCR-Diagnostics of the
shipped build; for TTI open the test build with `?perf` and tap once). The touch variant
of `input-latency` asks the tester to tap the four pads 50 times in any order.

#### 9.7.6 Result shape

The object written by `--json` and copied by the device runner is a superset of the Part
3.5 shape:

```json
{ "version": "0.1.0", "build": "1.0.0 2026-11-02 test", "environment": "headless-swiftshader",
  "userAgent": "...", "glRenderer": "...", "playwright": "1.x.y", "tier": "Balanced",
  "repeat": 3, "set": "default", "startedAt": "2026-11-02T10:00:00Z",
  "scenarios": [
    { "name": "playback-dense", "durationMs": 30000,
      "metrics": { "lookaheadMaxMs": 120.0, "tickWorkMaxMs": 1.9, "schedErrorMaxMs": 0.0, "lateEvents": 0 },
      "samples": { "lookaheadMaxMs": 7412, "tickWorkMaxMs": 1200 },
      "budgets": { "lookaheadMaxMs": 125, "tickWorkMaxMs": 4, "schedErrorMaxMs": 1, "lateEvents": 0 },
      "results": { "lookaheadMaxMs": "pass", "tickWorkMaxMs": "pass", "schedErrorMaxMs": "pass", "lateEvents": "pass" },
      "rows": [12, 13, 14], "notes": [], "pass": true } ],
  "pass": true }
```

The values above illustrate the shape only. `environment` is `headless-swiftshader` for the
tool and `device` for the device runner; device results add
`"device": {"class": "ref-ios", "model": "...", "os": "...", "dpr": 3, "viewport": [390, 844]}`.
`results` values are `pass`, `FAIL`, `info` or `invalid` (9.1.1 item 8). `pass` of a
scenario is true when no gated metric is `FAIL` or `invalid`; the top-level `pass` is the
conjunction over scenarios.

#### 9.7.7 Thresholds applied by the tool

Each metric is compared with its budget as below. "Headless result" is what `perf.mjs`
reports in the headless environment; device runs compare every listed metric with the
same threshold and report `pass` or `FAIL` (desktop or mobile threshold by device class).

| Metric | Threshold (desktop; mobile) | 9.1 row | Headless result |
|---|---|---|---|
| `menuMs` median | <= 1,500; <= 3,000 | 3, 4 | gated |
| `menuMsMax` | <= 2,250; <= 4,500 | 3 | gated |
| `phaseAMs` | <= 600; <= 1,200 | 9.1.3 | gated |
| `bootMs` | <= 400; <= 800 | 9.1.3 | gated |
| `capsMs` | <= 20; info | 9.1.3 | gated |
| `ttiMs`, `ttiFirstLaunchMs` medians | <= 5,000; <= 8,000 | 5, 6 | gated |
| `enterMs` | <= 1,000; <= 2,000 | 9.1.3 | gated |
| `frameP50Ms` (High desktop, Balanced mobile) | <= 17.5; <= 17.5 | 7, 8 | info |
| `frameP95Ms` | High <= 20.0; Balanced <= 22.2; Low and Abstract <= 33.3 | 7, 9, 10 | info |
| `drawsMax` | High <= 1,200; Balanced <= 900; Low <= 600 | 9.1.3 | gated |
| `trisMax` | High <= 150,000; Balanced <= 80,000; Low <= 40,000 | 9.1.3 | gated |
| `particlesMax` | <= the tier cap of 9.3.1 | 9.3.1 | gated |
| `downgrades` in `full-band-render` | 0 | 11(b) | info |
| `firstDowngradeMs` | 500-2,500 | 11(a) | gated |
| `secondDowngradeGapMs` | >= 10,000 | 11(a) | gated |
| `tickDriftTicks` | <= 1 | 11(a) | gated |
| `longTaskMaxMs` | <= 80 | 9.1.3 | gated |
| `lookaheadMaxMs` | <= 125 | 12 | gated |
| `tickIntervalP50Ms` | 23-27 | 13 | gated |
| `tickIntervalP95Ms` | <= 50 | 13 | gated |
| `tickIntervalMaxMs` | <= 95 | 13 | gated |
| `tickWorkMaxMs` | <= 4 | 13, 23 | gated |
| `schedErrorMaxMs` | <= 1.0 | 14 | gated |
| `lateEvents` (every scenario that reports it) | 0 | 14 | gated |
| `driftMs` | < 2.0 | 15 | gated |
| `inputProcP95Ms` | <= 4 | 16 | gated |
| `inputProcMaxMs`, `liveSchedMaxMs` | <= 16.7 | 16, 17 | gated |
| `memSteadyMb` | <= 300; <= 150 | 18, 19 | gated (desktop threshold) |
| `heapGrowthMb` | <= 10 | 20, 9.6 | gated |
| `leaveMaxMs` | <= 400 | 9.1.3 | gated |
| `assertCleanFailures` | 0 | 20 | gated |
| `voicesMax` | <= 64; <= 32 | 21, 22 | gated |
| `activeVoicesAfterStop` | 0 | 21 | gated |
| `started + dropped` in `chord-stress-1000` | === 16,000 | 21 | gated |
| `importMs`, `parseMs` (`import-large-midi`) | <= 5,000 and <= 4,000; abort with `E-IMP-005` or completion within 5,000 | 28 | gated |
| `refusedOverLimit` | 1 | 25 | gated |
| `inflateMBps` | >= 10 | 9.1.3 | gated |
| `serializeMs` median | <= 200; <= 400 | 31 | gated |
| `parseMs` median (`serialize-100k`) | <= 400; <= 800 | 31 | gated |
| `lsWriteMs` | <= 100; <= 200 | 29 | gated |
| `falseSuccess` | 0 | 30 | gated |
| `expandMaxMs` | <= 50; <= 100 | 9.1.3 | gated |
| `chartBuiltinMaxMs` | <= 30; <= 60 | 9.1.3 | gated |
| `chartGenMs` | <= 150; <= 400 | 9.1.3 | gated |
| `syncErrorMaxMs`, `startSkewMs` | <= 20 | 36 | gated |
| `stateRateHz` | 9.5-10.5 | 33 | gated |
| `stateGapMaxMs` | <= 300 | 33 | gated |
| `inputSendMaxMs` | <= 4 | 34 | gated |
| `syncSamplesBeforeStart` | === 8 | 35 | gated |
| `resyncIntervalMs` | 9,500-10,500 | 35 | gated |
| `connectionsAfterClose` | 0 | 9.5 | gated |
| `audioNodesMax` (`playback-long`) | <= cap x 11 + the base graph node count | 9.6.2 | gated |
| `counterDiffs` (`mode-cycles-20`) | 0 counters differing between cycle 1 and cycle 20 | 20 | gated |
| `audioBuffersLeft` (`import-repeat`) | 0 beyond the current project's audio tracks | 9.6.3 | gated |
| `importMsLast` (`import-repeat`) | <= 1.2 x `importMsFirst` | 9.6.3 | gated |
| `heapSteadyMb` (`steady-memory`, `project-32-tracks`) | <= 300; <= 150 | 18, 19 | gated (desktop threshold) |
| `saveOk` (`record-long`) | 1 | 9.6.6 | gated |
| `pluckCacheMb` | <= 29; <= 15 | 9.1.3 | gated |
| `nonPerfectBotJudgments`, `missingEvents`, `duplicateEvents` | 0 | 9.6.2, 9.6.6 | gated |
| `voiceBuildMeanMs`, `anchorJitterMs`, `idbWriteMs`, `stalls`, `stolen`, `loadMs`, `bytes`, `fpsP50`, `fpsP95` | no threshold | 9.1.3 | info |

A threshold change follows 9.1 (plan patch first, then measurement). The tool reads
thresholds from one constant table at the top of `tools/perf.mjs` whose entries name the
9.1 row, so a reviewer can compare the two directly.

### 9.8 Mobile-specific adaptations

B 21.3 requires adapting rendering resolution, shadow quality, lighting complexity,
particle count, animation complexity and audio polyphony "without corrupting the musical
timeline"; I 12 requires adaptive resolution, adjustable loading, reduced effects and
recoverable state on constrained devices. Every adaptation below has a detectable trigger,
a fixed effect and the module that applies it. None of them changes the Transport, the
Scheduler, the TempoMap, the Judge windows or recorded data (9.3.6); this is asserted by
running the `tier-downgrade` and `chord-stress-1000` scenarios on every mobile device of
9.2 and by S-02.

| Trigger | Detection | Adaptation | Applied by, when | Spec |
|---|---|---|---|---|
| Touch device | `Caps.maxTouchPoints > 0` | initial tier at most Balanced (9.3.3); touch pads shown in gameplay modes (Part 4.7.1 step 10) at `input.padSize` (default medium, 72 px minimum height) | M-18 at B8; M-26 at mode enter | B 21.1, B 21.3, I 12.1 |
| Mobile class | `Caps.isMobile()` | polyphony cap 32 instead of 64 unless `audio.polyphonyCap` is set; pluck cache 24 buffers instead of 48; latency fallback estimate 40 ms instead of 20 ms when the browser reports none (Part 6.5.4.7) | M-05 at `Audio.init`; M-06 at attach | B 21.3 (audio polyphony), I 12.2 |
| No mouse or small screen | `Math.min(innerWidth, innerHeight) < 600` | High never picked automatically (9.3.3) | M-18 at B8 and on `auto` re-pick | I 12.1 |
| High-density display | `devicePixelRatio` above the tier's DPR cap, or drawing buffer above the pixel budget | buffer scaled down per 9.3.2 (rendering resolution) | M-18 on every `ui.layout` and tier change | B 21.3 (resolution), I 12 (adaptive resolution) |
| Sustained slow frames | p95 frame interval > 33 ms over 5 s (9.3.4) | one tier step down: Balanced -> Low removes MSAA, point lights, blob shadows, highway glow and particles, reduces geometry and stage detail, animates 3 performers at every 2nd frame; Low -> Abstract switches to the 2D view | M-18 stats tick (`autoTierCheck`, `setTier`) | B 21.3 (shadows, lighting, particles, animation), B 12.7 |
| Device-capped 30 Hz cadence | `Render.stats().locked30 >= 0.9` | no downgrade; SCR-Diagnostics note "Frame rate capped at 30 by the device" | M-18 stats tick | B 20.2 (responsiveness over a fixed rate) |
| Memory pressure | `performance.memory.usedJSHeapSize > 0.8 x jsHeapSizeLimit` (Chromium), or two consecutive `sched.stall` events above 500 ms (every browser) | one tier step down and the toast "Reduced visual quality to keep audio stable" (Part 4.7.4) | M-28 | B 21.4 (temporary memory pressure), I 12.2 |
| Fewer than four touch points | `navigator.maxTouchPoints < 4` | HUD note "This device reports fewer than 4 simultaneous touches."; chords needing more presses than available are still charted (the source is never reduced) | M-29 gate, M-26 HUD | B 8.2, Part 4.3 gate |
| Pointer Events deliver fewer than 4 concurrent pointers (OQ-1) | first-launch "press all four pads" probe count < 4 while `Caps.pointerEvents` is true | pad surface switches to the Touch Events path (ADR-10 decision 10) | M-07 from SCR-FirstLaunch result | B 21.1, OQ-1 |
| Orientation change | `ui.layout` with a new `orientation` | highway and pads relayout (portrait: pads in the bottom 28 %; landscape: right or bottom 24 % per `input.padLayout`); drawing buffer recomputed; frame window reset; no pause (Part 4.7.4) | M-26, M-21, M-18 | B 21.1, B 21.4, E 6.2 |
| Backgrounding, screen lock, call | `visibilitychange` to hidden, `pagehide`, `audio.state` leaving `running` | gameplay modes pause; held inputs released; RAF stops naturally; the frame window resets on return so the gap never counts toward a downgrade; the Transport re-anchors on resume | M-28, M-07, M-18 | B 21.4, E 2.1 |
| Compact layout in Studio | `UI.Layout.compact()` true | the Studio stage starts hidden (a "Show stage" toggle restores it), so the GPU is idle while editing | M-27 SCR-Studio at enter | P 10, P 14 |
| Character editor on a touch device | `customize` mode with `Caps.maxTouchPoints > 0` | preview renders at the current tier with the resolution scale capped at 0.75 and pauses its preview loop after 30 s without input (resumes on the next input) | M-27 SCR-Characters, M-18 | P 8 "the editor performs acceptably on mobile devices" |
| Large imported audio on a touch device | `maxTouchPoints > 0` | decoded audio limit 64 MB instead of 192 MB (Part 6.14) | M-14 at init | I 12.2 |
| WAV export on iOS above 60 MB of PCM, or offline render failure (OQ-2) | estimated PCM size, exception | MediaRecorder capture path (ADR-04, Part 2.19) | the WAV export path of Part 8, at export time | OQ-2 |
| Reverb on constrained tiers | tier Low or Abstract at mode enter | global reverb bypassed unless the user enabled it (Part 1.5) | M-05 at mode enter only | B 16.5 (mobile processing cost) |

Rules:

1. Adaptations are applied at the moments named in the table only; none is applied
   inside a Scheduler tick.
2. Every adaptation that the user can notice is visible: tier changes by toast and on
   SCR-Settings and SCR-Diagnostics; the polyphony cap on SCR-About (9.9) and
   SCR-Diagnostics; the pad-surface switch on SCR-Diagnostics (E 10 item 14, "silently
   degrading fidelity" is prohibited).
3. The user can override every rendering adaptation (`video.tier`, `video.resolutionScale`,
   `video.effectsLevel`) and the polyphony cap (`audio.polyphonyCap`, Part 5.11); audio
   timing parameters have no user override.
4. Mobile testing happens on physical devices throughout development where the owner
   provides them (I 12 "testing on actual iOS and Android devices"); until then rows 4, 6,
   8, 9, 10, 19 and 22 stay "not measured".

### 9.9 Polyphony and track limits statement for the About screen

B 11.6 and P 17 require the polyphony and track-count limits to be defined and
documented. Part 1.5 reserves this line for the "Limits of this version" block on
SCR-About, and Part 7.11 reproduces it verbatim. The line is generated at runtime so it
states the cap that is actually active on the device:

```text
- Up to {cap} notes can sound at once on this device ({capReason}). When more notes are
  needed, the note that is already fading and quietest stops first, then the oldest
  note. A project holds up to 32 tracks, 100,000 notes per track and 1,000,000 events in
  total. Imported files may be up to 25 MB (audio files up to 100 MB) with up to
  1,000,000 events and 128 tracks.
```

Substitutions:

| Placeholder | Value |
|---|---|
| `{cap}` | `Audio.VoiceAllocator` capacity in effect (64, 32 or the `audio.polyphonyCap` value) |
| `{capReason}` | "computer default" when `Caps.isMobile()` is false and the setting is 0; "phone and tablet default" when `Caps.isMobile()` is true and the setting is 0; "set in Settings" when `audio.polyphonyCap` is non-zero |

Rules:

1. The statement describes enforced limits, not measured performance. Whether a device
   sustains them without audible glitches is reported only in `docs/COMPATIBILITY.md`
   from the 9.2 matrix. The About text gains the sentence "Measured device results are
   listed in docs/COMPATIBILITY.md." only in a build made after at least one device row of
   9.2 holds measurements; the Phase 16 LEDGER entry records whether it was added.
2. The numbers come from the same constants the code enforces (`Audio` capacity, Studio
   `LIMITS`, Import `LIMITS`); a unit test in the `screens` group (M-27, Part 6.27)
   asserts that the rendered line contains those constants, so the text cannot drift from
   the code.
3. `README.md` and `docs/COMPATIBILITY.md` carry the same sentence with `{cap}` written as
   "64 on computers and 32 on phones and tablets (adjustable in Settings)".
