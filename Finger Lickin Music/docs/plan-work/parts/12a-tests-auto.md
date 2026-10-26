## 12. Testing and acceptance plan

This part turns B 25 (testing strategy), B 26 (acceptance criteria), E 2 to E 7, E 9, E 11
and E 13 (edge cases, recovery rules, release gate), I 13 and I 13.1 (reliability and fault
injection), I 17 (automated quality gates), I 19 (measurable quality targets) and P 20
(testing and release quality) into named tests with fixed IDs. Sections 12.1 to 12.7 hold the
automated levels; 12.8 to 12.11 (cross-device, live manual, release gate, evidence) and 12.12
to 12.13 (acceptance tests per requirement) follow in the same part. Every test here is
planned: nothing is written, run or passing at plan time, and no result may be recorded
before the test has run against the build named in its row.

### 12.1 Strategy and tooling

#### 12.1.1 Test levels

| Level | IDs | Defined in | Code location and runner group | How it runs | Gate class (Part 9.1.1) |
|---|---|---|---|---|---|
| Unit | `UT-<MM>-<nn>` | Part 6 module sections; compiled in 12.2 | `src/91-test-<module>.js`, group `<module>` (file suffix of the module, Part 3.1) | in-page runner M-31; headless through `node tools/selftest.mjs --group <module>` | [U] |
| Integration | `IT-001`.. | 12.3 | `src/92-test-integration.js`, group `integration`; touch rows also run in the touch context as `integration@touch` | `node tools/selftest.mjs --group integration` (corpus injected, Part 3.4.3 step 4a) | [U] |
| File format | `FT-001`.. | 12.4 | `src/92-test-files.js`, group `files`, test name `<ID> files.<subgroup>.<file name>` | `node tools/selftest.mjs --group files` (corpus injected) | [U] |
| Timing | `TT-001`.. | 12.5 | `src/92-test-timing.js`, group `timing`; long rows registered `{slow:true}` | `node tools/selftest.mjs --group timing` and `--slow` for the slow rows | [U] |
| Performance | `PT-001`.. | 12.6 | scenarios of Part 9.7.3 driven by `tools/perf.mjs` (in-page part in `src/92-test-perf-smoke.js`); each PT row also has a short smoke check in group `perf-smoke` | `node tools/perf.mjs --scenario <name>` (default and slow sets, Part 9.7.1); smoke checks in every `selftest.mjs --all` | [H], [HD], [D], [B] as the row states |
| Fault injection | `FI-001`.. | 12.7 | `src/92-test-faults.js`, group `faults`; faults armed through `FLM.debug.inject` (Part 10.9) | `node tools/selftest.mjs --group faults` (corpus injected; touch rows as `faults@touch`) | [U] |
| Cross-device and browser | `XT-001`.. | 12.8 (Part 12b) | none (manual protocol) | owner on physical devices and browsers | [D] |
| Live manual | `LT-001`.. | 12.9 (Part 12b) | none (manual protocol) | tester with headphones and the shipped file | [D] |
| Acceptance | `AT-<R-ID>` | 12.12 and 12.13 (Parts 12c, 12d) | references the IDs above | by the referenced tests, or review | as referenced |
| Build checks | (no ID) | Part 3.3.4 | `tools/build.mjs` | every build: lint rules (S-01, S-04, S-05, S-07 regexes), size limits, `node --check` | [B] |
| Corpus check | (no ID) | Part 3.6.2 | `tools/make-corpus.mjs --check` | when a T section touches the generator or `test-corpus/` | [B] |
| Relay self-test | (no ID) | Part 3.7.6 | `server/relay.mjs --selftest` | Phase 13 gate and later gates | [U] |
| Smoke of the shipped file | (no ID) | Part 3.4.5 | `node tools/selftest.mjs --smoke` | every phase gate from Phase 1; Phase 16 on both editions | [B] |

B 25.1 lists the minimum unit-test topics; their coverage by module is in 12.2.32. B 25.2 to
B 25.4 and B 25.6 map to 12.3 to 12.6; B 25.5 maps to 12.8; B 25.7 maps to 12.12 and 12.13.

#### 12.1.2 Runner conventions (binding for every automated test)

1. Name. The runner test name is the ID, one space, then the title of its row (for example
   `IT-014 recording to project save and reload`); FT names follow Part 8.9.1
   (`FT-001 files.midi.midi-mono-simple.mid`). `--grep` matches either part. The ID in the
   name is how 12c and 12d, STATUS.md and the final report find a result.
2. Isolation. Each test starts from the `menu` mode with `Modes.assertClean()` null and ends
   with `Modes.leave('user')` when it entered a mode, `FLM.Core.Faults.clearAll()`, and an
   `assertClean()` that must return null (a non-null result fails the test, Part 9.5 rule 2).
   No test depends on another test's side effects or on run order.
3. Determinism. Random choices use `new FLM.Core.Prng(seed)`; the seed is the one named in
   the row, otherwise 1. Clock-sensitive rows use `FLM.SelfTest.fakes.clock()` or the
   offline engine of Part 6.5.4.10 (`createEngine({context: OfflineAudioContext, clock})` with
   `scheduler.tickOnce(audioNow)`); only rows that say "real clock" use the live
   `AudioContext` (headless Chromium starts it with `--autoplay-policy=no-user-gesture-required`,
   Part 3.4.2).
4. Storage. Rows that persist use the real M-16 with `FLM.SelfTest.fakes.indexedDB` and
   `FLM.SelfTest.fakes.localStorage` unless the row says "real storage"; real-storage rows
   delete every key and record they wrote (the headless context starts empty, Part 3.4.2).
5. Input. Gameplay presses come from `Input.synthesize` (source `synthetic`) or, in touch
   rows, from real dispatched Pointer Events; "chart bot" means the synthesized presses of
   Part 9.1.1 item 12, which judge perfect when the input anchor and the Transport agree.
6. Network. No automated test opens a network connection. Multiplayer rows use
   `Net.createSession(deps)` instances joined by `Net.createLoopbackPair(opts)` and
   `FLM.SelfTest.fakes.rtc` (Part 6.24.8). Rows that need the relay process are marked
   Automated "no" and are run by hand at the Phase 13 and Phase 15 gates.
7. Timeouts. Per test 10 s, slow tests 60 s (Part 3.4.6); slow rows of 12.5 and 12.6 run only
   with `--slow` or in `tools/perf.mjs` sets.
8. Skips. A test may skip only for a missing capability that it names in the message
   (for example `skip: no WEBGL_lose_context`); a skip is not a pass for gating unless the
   row is marked capability-dependent and 12.8 has an XT row for the capability.
9. Exact values. Expected values in the rows are the values the code must produce, derived
   from the Part 5, 6, 8 and 9 rules cited; a mismatch is a defect in the code or a plan
   inconsistency to be resolved by a LEDGER "Decisions" line before the test is changed.

#### 12.1.3 Execution environments

| Environment | Used by | What it can show | What it cannot show |
|---|---|---|---|
| Headless Chromium desktop context (1280 x 720, DPR 1, no touch) through `tools/selftest.mjs` | UT, IT, FT, TT, FI, perf-smoke | logic, scheduling against the audio clock, file handling, recovery paths, DOM structure, WebGL2 through SwiftShader | real device timing, audible quality, GPU performance |
| Headless Chromium touch context (390 x 844, `hasTouch:true`) | groups `input`, `ui`, `integration`, `faults` (Part 3.4.2) | Pointer Event lifecycle with up to 4 concurrent touch points, pad layout | iOS Safari pointer behavior (OQ-1, 12.8) |
| `OfflineAudioContext` inside the page | TT, UT-05-15, UT-06-06, wav export rows | sample-exact onsets, drift, pitch | output latency of a device |
| `tools/perf.mjs` headless runs | PT | regression signals for jitter, drift, heap growth, serialization, import time; frame metrics recorded as info "(software GL)" | device frame rate and memory claims (Part 9.1.4 rule 2) |
| Test build on a device (SCR-Diagnostics "Run self-test" and "Run performance scenarios") | owner runs of UT to FI and PT device sets | the same tests on a real browser | nothing beyond what the tests assert |
| Physical devices and browsers by hand | XT, LT (Part 12b) | audibility, touch feel, readability, browser-specific behavior | nothing automated |

#### 12.1.4 Gating rules per T section

A T section is done only when the "clean T section" conditions of Part 3.9 hold, with these
test rules:

1. Every test ID named in the section's Verification line exists in its file under its exact
   name, runs, and passes in a headless run made after the section's last code change. A
   Verification line may name a test that a later section completes only if it is marked
   "(partial until Tpp.nn)" there; such a test is registered and must pass in the form the
   current code supports.
2. Every group touched by the section passes in full (`--group <g>` exit 0), and its test
   count is at least the count of its 12.2 table (unit groups) or of its rows here that are
   assigned to phases up to the current one (cross-module groups).
3. After any change to M-01 to M-09, the foundation guard of Part 3.9 item 3 passes.
4. A section that adds a test adds its row to this part's table and its line to
   `parts/12x-index-*.txt` in the same commit (plan patch, LEDGER "Decisions" line); IDs are
   never reused or renumbered.
5. A failing test is never deleted, weakened or marked skipped to close a section; the
   section stays open, or the requirement goes to Partial or Blocked in STATUS.md with the
   failing test named (Part 0.7 rule 3).

#### 12.1.5 Gating rules per phase

At every phase gate (Part 0.4 step 5) the session runs, in this order, and records each
summary line in the LEDGER gate entry:

1. `node tools/build.mjs` (exit 0; size warnings allowed before Phase 16).
2. `node tools/selftest.mjs --all --json <scratch path>`: every registered test passes; zero
   page errors; capability skips listed by name.
3. `node tools/selftest.mjs --smoke` on the shipped file.
4. `node tools/make-corpus.mjs --check` (from Phase 7).
5. `node tools/perf.mjs --repeat 3` default set from Phase 4 (Part 9.1.1 item 9); the slow
   set (`--slow`) at the Phase 14 and Phase 16 gates.
6. `node tools/selftest.mjs --all --slow` at the Phase 2, 4, 9, 14, 15 and 16 gates (adds the
   10-minute drift and long-session rows).
7. `node server/relay.mjs --selftest` and the Automated "no" rows of 12.3 from Phase 13.

The tests of this part become binding at the gate of the phase in their row's Phase column
(12.3 lists it in the coverage table 12.3.2; 12.4 to 12.7 in their own tables). A phase
gate cannot close while a binding test of that phase or an earlier one fails.

| Phase (B 27) | Binding from this gate (cumulative with earlier phases) |
|---|---|
| 1 Foundation | unit groups `core`, `ui`, `screens` (menu, settings, help, about, diagnostics rows), `modes` (menu rows), `boot`, `selftest`; PT-001, PT-002 |
| 2 Musical data and timing | groups `theory`, `model`, `transport`; the FakeClock rows of 12.5 marked Phase 2 |
| 3 Input and four-button gameplay | groups `input`, `mapping` (profiles), `rhythm`; IT and TT rows marked Phase 3; PT-009 (input part) |
| 4 Audio engine | groups `audio`, `instruments`, `content`; offline TT rows; PT rows marked Phase 4 |
| 5 3D stage and visualization | groups `render`, `rig`, `animation`, `stage`; IT, TT, PT, FI rows marked Phase 5 |
| 6 Free Play | rows marked Phase 6 |
| 7 MIDI import and playback | groups `midi`, `import`; FT subgroups `midi`, `midi-damaged`, `limits` (MIDI and audio rows), `audio`, `ident`; rows marked Phase 7 |
| 8 Rhythm-game song mode | `mapping` chart rows; rows marked Phase 8 |
| 9 Studio and multitrack recording | groups `project`, `storage`, `studio`; FT `roundtrip` (MIDI and project rows); FI storage rows; rows marked Phase 9 |
| 10 Character customization | groups `character`, `progress`; rows marked Phase 10 |
| 11 Dance mode | group `dance`; rows marked Phase 11 |
| 12 MusicXML and Guitar Pro | groups `zip`, `musicxml`, `guitarpro`; FT subgroups `musicxml`, `security`, `mxl`, `gp`; rows marked Phase 12 |
| 13 Multiplayer | group `net`; IT and FI multiplayer rows; PT-020; relay self-test |
| 14 Advanced audio and performance | the slow PT set; rows marked Phase 14 |
| 15 Cross-browser and device validation | every row of 12.3 to 12.7 including slow ones; XT and LT (12.8, 12.9) |
| 16 Packaging and final delivery | everything above on the final build, plus the release gate of 12.10 |

#### 12.1.6 No continuous integration

This project has no continuous-integration service, no hosted runner and no pre-merge
check (repository convention; ADR-11). Every gate above is run by the implementing session
on its own machine with the commands listed, or by the owner with the same commands or from
SCR-Diagnostics on a device. A gate is "passed" only when its commands were run on the commit
being gated and their summary lines are in the LEDGER entry; a result from an earlier commit
never carries over. Pushes happen only when the owner says so (BRIEF 8).

#### 12.1.7 Regression policy (I 17 last rule, P 20)

1. Every defect found after its feature's tests first passed is recorded in STATUS.md
   section 6 with its severity (Part 13.2) before it is fixed.
2. The fix lands together with a regression test that fails on the unfixed code and passes
   on the fixed code. The test takes the next free ID of the lowest level that can show the
   defect (a new `UT-<MM>-<nn>` after the module's last number, or the next `IT`, `FT`, `TT`,
   `FI` number), its title ends with `(regression)`, its row is appended to the matching
   table (12.2 to 12.7) and index file, and STATUS.md section 6 names it in the "Regression
   test" column.
3. "Whenever practical" (I 17): a defect that only a physical device shows gets an XT or LT
   row instead (Part 12b); the STATUS row says why no automated test exists.
4. A corpus file that exposed a parser defect stays in the corpus; when the triggering file is
   a real-world file that cannot be committed (licensing), `tools/make-corpus.mjs` gets a
   synthetic recipe reproducing the structure, with a new FT row.
5. Regression tests are never removed; a test made obsolete by a plan change is changed
   only through a LEDGER "Decisions" line that names the replacing test.

#### 12.1.8 Test data

- Corpus: the 89 committed files and the in-memory cases of Part 8.9, injected by
  `tools/selftest.mjs`; a manual run from SCR-Diagnostics skips corpus rows with the message
  `corpus not loaded (run tools/selftest.mjs)` (Part 3.4.3).
- Built-in content: the five demo songs of Part 1.7 (`demo-poprock`, `demo-piano`,
  `demo-electro`, `demo-jazz`, `demo-dance`) and the tutorial sequence (M-30).
- Generated content: songs and projects built in page from a seeded `Prng` (seed `0xF1A9`
  unless stated, Part 9.6) for stress, chord and long-session rows.
- Fakes (M-31, Part 6.31): `fakes.clock`, `fakes.indexedDB`, `fakes.localStorage`,
  `fakes.audioDecoder`, `fakes.rtc`, `fakes.stub`, `fakes.inputEvent`.
- Faults: the 14 names of Part 10.9.2, armed only through `FLM.debug.inject` in the test
  build.

### 12.2 Unit test index

Every unit test defined in the Part 6 module sections, reproduced from the seven Part 6 index
files (`06x-ut-index-a.txt` to `06x-ut-index-g.txt`) without additions. The setup and assertion
of each test are in its module section (Part 6.N.8); the runner group and file follow
Part 3.1. Test names in the runner are `<UT-ID> <name>` (12.1.2 rule 1). Totals: 833 unit tests
in 31 groups.

#### 12.2.1 M-01 `FLM.Core` (group `core`, `src/91-test-core.js`, Part 6.1.8): 28 tests

| UT-ID | Name |
|---|---|
| UT-01-01 | define registers namespace |
| UT-01-02 | define rejects duplicates |
| UT-01-03 | emitter on/emit order |
| UT-01-04 | emitter isolates listener errors |
| UT-01-05 | once fires once |
| UT-01-06 | off and offOwner |
| UT-01-07 | emit snapshot semantics |
| UT-01-08 | log ring wraps at 500 |
| UT-01-09 | log once |
| UT-01-10 | caps report shape |
| UT-01-11 | caps probe isolation |
| UT-01-12 | timers tracked |
| UT-01-13 | classify table |
| UT-01-14 | report dedupes and emits |
| UT-01-15 | unhandled rejection captured |
| UT-01-16 | fatal screen renders safely |
| UT-01-17 | fatal shown once |
| UT-01-18 | diagnostics provider isolation |
| UT-01-19 | diagnostics redaction |
| UT-01-20 | diagnostics size cap |
| UT-01-21 | uid uniqueness |
| UT-01-22 | prng reference vector |
| UT-01-23 | prng int/pick/shuffle bounds |
| UT-01-24 | fnv1a32 vectors |
| UT-01-25 | formatTime |
| UT-01-26 | clamp/lerp/smoothstep |
| UT-01-27 | deepClone independence |
| UT-01-28 | assert throws coded error |

#### 12.2.2 M-02 `FLM.Theory` (group `theory`, `src/91-test-theory.js`, Part 6.2.8): 22 tests

| UT-ID | Name |
|---|---|
| UT-02-01 | noteName sharps |
| UT-02-02 | noteName flats by key |
| UT-02-03 | midiFromName parse |
| UT-02-04 | round trip names |
| UT-02-05 | scale table integrity |
| UT-02-06 | defineScale validation |
| UT-02-07 | unknown ids |
| UT-02-08 | scaleDegrees C major |
| UT-02-09 | scaleDegrees truncates at 127 |
| UT-02-10 | scaleNote negative degree |
| UT-02-11 | snapToScale |
| UT-02-12 | chordNotes close |
| UT-02-13 | chordNotes voicings |
| UT-02-14 | chord table integrity |
| UT-02-15 | key tables |
| UT-02-16 | recognizeChord basics |
| UT-02-17 | recognizeChord tie rules |
| UT-02-18 | intervals |
| UT-02-19 | GM names |
| UT-02-20 | GM drum names |
| UT-02-21 | all 128 program names unique and present |
| UT-02-22 | aliases |

#### 12.2.3 M-03 `FLM.Model` (group `model`, `src/91-test-model.js`, Part 6.3.8): 27 tests

| UT-ID | Name |
|---|---|
| UT-03-01 | Song.create defaults |
| UT-03-02 | Track.create defaults and colors |
| UT-03-03 | 32-track limit |
| UT-03-04 | compare ordering |
| UT-03-05 | insertEvent keeps order |
| UT-03-06 | insertEvents bulk |
| UT-03-07 | removeEvent by id and object |
| UT-03-08 | pairNotes unmatched on |
| UT-03-09 | pairNotes off before on |
| UT-03-10 | pairNotes velocity 0 as off |
| UT-03-11 | pairNotes same-pitch overlap |
| UT-03-12 | pairNotes zero duration |
| UT-03-13 | pairNotes channels independent |
| UT-03-14 | deriveSustain extends |
| UT-03-15 | deriveSustain retrigger cap |
| UT-03-16 | TempoMap conversions |
| UT-03-17 | TempoMap implicit start and last-wins |
| UT-03-18 | TempoMap precision |
| UT-03-19 | MeterMap bars and beats |
| UT-03-20 | validate catches unsorted |
| UT-03-21 | validate limits |
| UT-03-22 | fromJSON rejects bad shapes |
| UT-03-23 | computeDuration uses last event end |
| UT-03-24 | TrackIndex queries |
| UT-03-25 | indexFor cache invalidation |
| UT-03-26 | KeyMap keyAt |
| UT-03-27 | Song.clone independence |

#### 12.2.4 M-04 `FLM.Transport` (group `transport`, `src/91-test-transport.js`, Part 6.4.8): 28 tests

| UT-ID | Name |
|---|---|
| UT-04-01 | load resets |
| UT-04-02 | invalid actions ignored |
| UT-04-03 | default tempo without song entries |
| UT-04-04 | play anchors 50 ms ahead |
| UT-04-05 | positionAt / audioTimeAt inverse |
| UT-04-06 | speed math |
| UT-04-07 | pause freezes and resume re-anchors |
| UT-04-08 | seek while playing |
| UT-04-09 | seek clamps |
| UT-04-10 | stop returns to stopTick |
| UT-04-11 | count-in clicks only |
| UT-04-12 | count-in to playing transition and start item |
| UT-04-13 | pause during count-in resumes count-in |
| UT-04-14 | setLoop validation |
| UT-04-15 | loop wrap item and re-anchor |
| UT-04-16 | loop clamps sustained notes |
| UT-04-17 | loop does not retrigger notes before a |
| UT-04-18 | event exactly at b |
| UT-04-19 | event exactly at a |
| UT-04-20 | ten-minute loop drift |
| UT-04-21 | pullDue never returns items beyond until or at or before from |
| UT-04-22 | visibility continue drift re-anchor |
| UT-04-23 | visibility pause policy |
| UT-04-24 | cursor rebuild on track mutation |
| UT-04-25 | fake clock determinism |
| UT-04-26 | tempo source override |
| UT-04-27 | end of song |
| UT-04-28 | setSpeed while paused |

#### 12.2.5 M-05 `FLM.Audio` (group `audio`, `src/91-test-audio.js`, Part 6.5.8): 33 tests

| UT-ID | Name |
|---|---|
| UT-05-01 | unlock reports blocked state |
| UT-05-02 | constructor failure |
| UT-05-03 | statechange emits |
| UT-05-04 | stall detection |
| UT-05-05 | single context |
| UT-05-06 | graph topology |
| UT-05-07 | strip creation and reuse |
| UT-05-08 | pan fallback |
| UT-05-09 | solo set semantics |
| UT-05-10 | mute ramps not steps |
| UT-05-11 | gain product CC7 x CC11 x fader |
| UT-05-12 | allocator steal order |
| UT-05-13 | allocator counts |
| UT-05-14 | capacity by platform and setting |
| UT-05-15 | offline onset accuracy |
| UT-05-16 | lookahead bound |
| UT-05-17 | never schedules in the past |
| UT-05-18 | sched events payload |
| UT-05-19 | cc/program/bend routing |
| UT-05-20 | stall catch-up ordering |
| UT-05-21 | voice max duration cap |
| UT-05-22 | soft panic releases all |
| UT-05-23 | hard panic rebuilds |
| UT-05-24 | seek triggers soft panic |
| UT-05-25 | pause and stop fade |
| UT-05-26 | metronome click shape |
| UT-05-27 | latency estimate |
| UT-05-28 | peak meter |
| UT-05-29 | sample-rate independence |
| UT-05-30 | live note path |
| UT-05-31 | loopWrap releases |
| UT-05-32 | voices stats event |
| UT-05-33 | dispose closes |

#### 12.2.6 M-06 `FLM.Instruments` (group `instruments`, `src/91-test-instruments.js`, Part 6.6.8): 24 tests

| UT-ID | Name |
|---|---|
| UT-06-01 | definition table integrity |
| UT-06-02 | fidelity declarations |
| UT-06-03 | family coverage |
| UT-06-04 | program clamp |
| UT-06-05 | velocity curve and layers |
| UT-06-06 | offline onset and release timing |
| UT-06-07 | pitch accuracy |
| UT-06-08 | pluck buffer determinism |
| UT-06-09 | pluck cache LRU |
| UT-06-10 | mono legato |
| UT-06-11 | drum map table |
| UT-06-12 | drum recipes render |
| UT-06-13 | hi-hat choke |
| UT-06-14 | program change keeps sounding voices |
| UT-06-15 | live sustain |
| UT-06-16 | unsupported CC logged once |
| UT-06-17 | instrument change while holding |
| UT-06-18 | bend and RPN |
| UT-06-19 | node failure isolation |
| UT-06-20 | slot watchdog |
| UT-06-21 | CC routing to strip |
| UT-06-22 | all programs build |
| UT-06-23 | range advisory |
| UT-06-24 | releaseTrack |

#### 12.2.7 M-07 `FLM.Input` (group `input`, `src/91-test-input.js`, Part 6.7.8): 32 tests

| UT-ID | Name |
|---|---|
| UT-07-01 | default maps match BRIEF 7 |
| UT-07-02 | attach is idempotent-guarded |
| UT-07-03 | detach removes all listeners |
| UT-07-04 | keydown press lifecycle |
| UT-07-05 | keyup release |
| UT-07-06 | event.repeat ignored |
| UT-07-07 | duplicate keydown ignored |
| UT-07-08 | second owner cannot release |
| UT-07-09 | tAudio null before anchor |
| UT-07-10 | anchor median rejects outliers |
| UT-07-11 | perfToAudio mapping |
| UT-07-12 | blur releases all with source system |
| UT-07-13 | visibilitychange hidden and pagehide release all |
| UT-07-14 | modifier combos pass through |
| UT-07-15 | text field focus blocks gameplay keys |
| UT-07-16 | pointer down/up on pad |
| UT-07-17 | drag between pads |
| UT-07-18 | move outside all pads releases |
| UT-07-19 | pointercancel and pointer cap |
| UT-07-20 | four simultaneous pointers |
| UT-07-21 | gamepad edge detection and disconnect |
| UT-07-22 | gamepad dance context mapping |
| UT-07-23 | enableMidi without support |
| UT-07-24 | MIDI note mapping and pass-through |
| UT-07-25 | MIDI sustain CC |
| UT-07-26 | remap conflict detection |
| UT-07-27 | remap replaces after unbind, min one code |
| UT-07-28 | setMaps tolerates corrupt data |
| UT-07-29 | setContext releases non-live controls |
| UT-07-30 | Space is panic only while paused |
| UT-07-31 | timestamp sanity fallback |
| UT-07-32 | calibration clamp and non-application |

#### 12.2.8 M-08 `FLM.Mapping` (group `mapping`, `src/91-test-mapping.js`, Part 6.8.8): 34 tests

| UT-ID | Name |
|---|---|
| UT-08-01 | profile A pitches C major |
| UT-08-02 | profile A octave shift |
| UT-08-03 | profile B intervals major and minor |
| UT-08-04 | profile C chords and voicing |
| UT-08-05 | profile C inversion |
| UT-08-06 | profile D paging and register |
| UT-08-07 | profile E by family |
| UT-08-08 | profile F pages |
| UT-08-09 | profile switch via controls |
| UT-08-10 | range policy |
| UT-08-11 | velocity from pressure |
| UT-08-12 | fixed note length |
| UT-08-13 | release without press |
| UT-08-14 | sustain defers note offs |
| UT-08-15 | tick null when stopped |
| UT-08-16 | dispatch isolates Instruments errors |
| UT-08-17 | quantization snaps recorded tick only |
| UT-08-18 | chord label within 30 ms |
| UT-08-19 | releaseAll closes everything |
| UT-08-20 | generate argument validation |
| UT-08-21 | empty track |
| UT-08-22 | determinism |
| UT-08-23 | beginner keeps beats, omits the rest |
| UT-08-24 | difficulty ladder |
| UT-08-25 | validate detects corruption |
| UT-08-26 | contour same-pitch and direction |
| UT-08-27 | multi-lane block ordering |
| UT-08-28 | drum lane map |
| UT-08-29 | chord-slot strategy |
| UT-08-30 | hold truncation |
| UT-08-31 | settingsHash composition |
| UT-08-32 | sparse relaxation |
| UT-08-33 | preview and describe |
| UT-08-34 | simplificationReport |

#### 12.2.9 M-09 `FLM.Rhythm` (group `rhythm`, `src/91-test-rhythm.js`, Part 6.9.8): 36 tests

| UT-ID | Name |
|---|---|
| UT-09-01 | windows table |
| UT-09-02 | load validation |
| UT-09-03 | boundary exactly +window (beginner) |
| UT-09-04 | boundary exactly -window (beginner) |
| UT-09-05 | one past each boundary |
| UT-09-06 | expert windows |
| UT-09-07 | rounding symmetry |
| UT-09-08 | points and multiplier |
| UT-09-09 | miss resets combo, multiplier from combo before note |
| UT-09-10 | accuracy and completion |
| UT-09-11 | miss by tick |
| UT-09-12 | nearest-note candidate |
| UT-09-13 | missed then retried (E 4.2) |
| UT-09-14 | chord all lanes within tolerance |
| UT-09-15 | chord lane beyond 50 ms tolerance |
| UT-09-16 | chord missing lane after window |
| UT-09-17 | hold tail judged on release |
| UT-09-18 | hold through a pause |
| UT-09-19 | early release = hold break, head kept |
| UT-09-20 | stall does not reorder |
| UT-09-21 | inactive ignores inputs |
| UT-09-22 | stray penalty option |
| UT-09-23 | calibration applied once |
| UT-09-24 | custom windows refuse narrower |
| UT-09-25 | input without tAudio |
| UT-09-26 | NaN time map guard |
| UT-09-27 | replay determinism |
| UT-09-28 | restart clears state |
| UT-09-29 | calibration change mid-run flags comparability |
| UT-09-30 | listener error isolation |
| UT-09-31 | sections from markers and 4-bar fallback |
| UT-09-32 | worst section |
| UT-09-33 | dance chart through the same Judge |
| UT-09-34 | total counts heads plus tails |
| UT-09-35 | speed does not change windows |
| UT-09-36 | nextNotes helper |

#### 12.2.10 M-10 `FLM.Midi` (group `midi`, `src/91-test-midi.js`, Part 6.10.8): 40 tests

| UT-ID | Name |
|---|---|
| UT-10-01 | identify header |
| UT-10-02 | reader EOF sentinel |
| UT-10-03 | bad magic |
| UT-10-04 | header length |
| UT-10-05 | format 3 |
| UT-10-06 | VLQ decode vectors |
| UT-10-07 | VLQ overflow |
| UT-10-08 | writeVlq round trip |
| UT-10-09 | running status |
| UT-10-10 | running status across meta |
| UT-10-11 | data byte without running status |
| UT-10-12 | pairing basic |
| UT-10-13 | velocity-0 note on |
| UT-10-14 | unmatched on |
| UT-10-15 | truncated chunk |
| UT-10-16 | missing EOT |
| UT-10-17 | data after EOT |
| UT-10-18 | unknown chunk |
| UT-10-19 | format 0 channel split |
| UT-10-20 | conductor folding |
| UT-10-21 | format 2 |
| UT-10-22 | rescale exactness |
| UT-10-23 | SMPTE |
| UT-10-24 | tempo merge |
| UT-10-25 | defaults |
| UT-10-26 | meter denominator |
| UT-10-27 | key range |
| UT-10-28 | name fallback |
| UT-10-29 | multi-channel split names |
| UT-10-30 | bank select folding |
| UT-10-31 | limits |
| UT-10-32 | time budget |
| UT-10-33 | parseAsync equals parse |
| UT-10-34 | writer round trip |
| UT-10-35 | writer ordering and running status |
| UT-10-36 | writer errors |
| UT-10-37 | text decoding |
| UT-10-38 | markers |
| UT-10-39 | ignored messages |
| UT-10-40 | lyrics and texts |

#### 12.2.11 M-11 `FLM.Zip` (group `zip`, `src/91-test-zip.js`, Part 6.11.8): 21 tests

| UT-ID | Name |
|---|---|
| UT-11-01 | crc32 vectors |
| UT-11-02 | crc32 incremental |
| UT-11-03 | inflate stored |
| UT-11-04 | inflate fixed abc |
| UT-11-05 | inflate fixed with match |
| UT-11-06 | inflate dynamic |
| UT-11-07 | inflate bad block type |
| UT-11-08 | inflate distance too far |
| UT-11-09 | inflate cap |
| UT-11-10 | read directory |
| UT-11-11 | no EOCD |
| UT-11-12 | too many entries |
| UT-11-13 | total size limit |
| UT-11-14 | ratio bomb |
| UT-11-15 | extract stored and CRC |
| UT-11-16 | extract deflate |
| UT-11-17 | encryption and method |
| UT-11-18 | names |
| UT-11-19 | local header lengths |
| UT-11-20 | ZIP64 |
| UT-11-21 | over-subscribed code |

#### 12.2.12 M-12 `FLM.MusicXml` (group `musicxml`, `src/91-test-musicxml.js`, Part 6.12.8): 32 tests

| UT-ID | Name |
|---|---|
| UT-12-01 | identify |
| UT-12-02 | entity defense |
| UT-12-03 | malformed XML |
| UT-12-04 | part-list |
| UT-12-05 | divisions |
| UT-12-06 | derived duration |
| UT-12-07 | chord |
| UT-12-08 | ties |
| UT-12-09 | grace notes |
| UT-12-10 | dynamics |
| UT-12-11 | articulations |
| UT-12-12 | tempo |
| UT-12-13 | backup and forward |
| UT-12-14 | repeats |
| UT-12-15 | navigation marks |
| UT-12-16 | transpose |
| UT-12-17 | octave shift |
| UT-12-18 | unpitched fallback |
| UT-12-19 | texts and markers |
| UT-12-20 | pedal |
| UT-12-21 | timewise equals partwise |
| UT-12-22 | measure lengths |
| UT-12-23 | invalid attributes |
| UT-12-24 | unsupported catalog |
| UT-12-25 | mxl |
| UT-12-26 | limits |
| UT-12-27 | parseAsync |
| UT-12-28 | header |
| UT-12-29 | channel assignment |
| UT-12-30 | determinism |
| UT-12-31 | bend |
| UT-12-32 | staves |

#### 12.2.13 M-13 `FLM.GuitarPro` (group `guitarpro`, `src/91-test-guitarpro.js`, Part 6.13.8): 32 tests

| UT-ID | Name |
|---|---|
| UT-13-01 | identify versions |
| UT-13-02 | unsupported version error |
| UT-13-03 | info strings |
| UT-13-04 | tempo, key, feel |
| UT-13-05 | channel table |
| UT-13-06 | measure headers |
| UT-13-07 | tuning and capo |
| UT-13-08 | GP5 track tail |
| UT-13-09 | durations |
| UT-13-10 | rests and voices |
| UT-13-11 | chord diagram skips |
| UT-13-12 | beat text |
| UT-13-13 | mix table |
| UT-13-14 | bends |
| UT-13-15 | tremolo bar |
| UT-13-16 | palm mute and staccato |
| UT-13-17 | dead note |
| UT-13-18 | tied notes |
| UT-13-19 | let ring |
| UT-13-20 | grace |
| UT-13-21 | harmonics |
| UT-13-22 | art flags |
| UT-13-23 | drum track |
| UT-13-24 | repeats |
| UT-13-25 | lyrics |
| UT-13-26 | truncated |
| UT-13-27 | desync detection |
| UT-13-28 | limits |
| UT-13-29 | parseAsync |
| UT-13-30 | determinism and corpus |
| UT-13-31 | velocity table |
| UT-13-32 | ports |

#### 12.2.14 M-14 `FLM.Import` (group `import`, `src/91-test-import.js`, Part 6.14.8): 24 tests

| UT-ID | Name |
|---|---|
| UT-14-01 | identification table |
| UT-14-02 | extension mismatch |
| UT-14-03 | validateFile |
| UT-14-04 | registry and concurrency |
| UT-14-05 | report fields (MIDI) |
| UT-14-06 | track rows |
| UT-14-07 | recommendTrack |
| UT-14-08 | chord complexity |
| UT-14-09 | no notes |
| UT-14-10 | chord limit |
| UT-14-11 | normalize |
| UT-14-12 | progress events |
| UT-14-13 | cancel |
| UT-14-14 | budget |
| UT-14-15 | audio import |
| UT-14-16 | audio failures |
| UT-14-17 | format 2 |
| UT-14-18 | project isolation and internal errors |
| UT-14-19 | COMPATIBILITY shape |
| UT-14-20 | normalize yields |
| UT-14-21 | releaseAudio |
| UT-14-22 | overflow tracks |
| UT-14-23 | startOffsetSeconds |
| UT-14-24 | short buffers |

#### 12.2.15 M-15 `FLM.Project` (group `project`, `src/91-test-project.js`, Part 6.15.8): 30 tests

| UT-ID | Name |
|---|---|
| UT-15-01 | create defaults |
| UT-15-02 | fromSong locks tracks |
| UT-15-03 | serialize field order and history |
| UT-15-04 | serialize/parse round trip |
| UT-15-05 | addTrack limit |
| UT-15-06 | addTrack channel assignment |
| UT-15-07 | deleteTrack cascades and undo restores |
| UT-15-08 | reorder and duplicate |
| UT-15-09 | addEvents keeps order and overlap policy |
| UT-15-10 | moveEvents clamps |
| UT-15-11 | parse rejects wrong format |
| UT-15-12 | parse rejects bad JSON and depth |
| UT-15-13 | migrate refuses newer |
| UT-15-14 | migration failure leaves original intact |
| UT-15-15 | validate reference integrity |
| UT-15-16 | event limit |
| UT-15-17 | coalescing of setMix |
| UT-15-18 | undo limit 100 |
| UT-15-19 | apply throw is isolated |
| UT-15-20 | composite group undo/redo |
| UT-15-21 | locked track protection |
| UT-15-22 | forkTrack semantics |
| UT-15-23 | quantize rules |
| UT-15-24 | checkpoint stripping and size gate |
| UT-15-25 | autosave safe-point gating and failure stop |
| UT-15-26 | autosave ring and timer cleanup |
| UT-15-27 | dirty tracking |
| UT-15-28 | setTempo native vs imported |
| UT-15-29 | replaceTake modes |
| UT-15-30 | unknown fields preserved |

#### 12.2.16 M-16 `FLM.Storage` (group `storage`, `src/91-test-storage.js`, Part 6.16.8): 27 tests

| UT-ID | Name |
|---|---|
| UT-16-01 | init full mode |
| UT-16-02 | init localOnly when idb open rejects |
| UT-16-03 | init localOnly when idb open hangs |
| UT-16-04 | init memory mode |
| UT-16-05 | safeSetLocal quota pre-check and error |
| UT-16-06 | leftover tmp cleanup |
| UT-16-07 | read-back verification failure restores previous |
| UT-16-08 | corrupt record detection and backup load |
| UT-16-09 | save routing both vs idb |
| UT-16-10 | index upsert, order and rebuild |
| UT-16-11 | transaction timeout maps to E-STO-002 and reset |
| UT-16-12 | save success emits and marks saved |
| UT-16-13 | save failure never marks saved |
| UT-16-14 | localOnly too-large refusal |
| UT-16-15 | conflict detection |
| UT-16-16 | lock acquire and heldByOther |
| UT-16-17 | lock loss via storage event |
| UT-16-18 | checkpoint sink ring behavior |
| UT-16-19 | download fallback selection |
| UT-16-20 | file read pre-check |
| UT-16-21 | delete removes everything |
| UT-16-22 | kv get with damaged value |
| UT-16-23 | quota warning |
| UT-16-24 | counters clean after release |
| UT-16-25 | idb-only combination |
| UT-16-26 | rename updates record and index |
| UT-16-27 | sanitize file names |

#### 12.2.17 M-17 `FLM.Studio` (group `studio`, `src/91-test-studio.js`, Part 6.17.8): 30 tests

| UT-ID | Name |
|---|---|
| UT-17-01 | open binds strips and transport |
| UT-17-02 | close leaves zero leaks |
| UT-17-03 | addTrack limit and readOnly refusal |
| UT-17-04 | ensureEditable forks locked tracks once |
| UT-17-05 | recorder count-in origin |
| UT-17-06 | capture press/release ticks |
| UT-17-07 | held notes closed on stop |
| UT-17-08 | abort never touches previous take |
| UT-17-09 | press before origin clamps to 0 |
| UT-17-10 | same-pitch retrigger |
| UT-17-11 | overdub while playing starts immediately |
| UT-17-12 | audio suspension stops recording and keeps take |
| UT-17-13 | start refused when audio locked |
| UT-17-14 | deleteTrack during recording aborts first |
| UT-17-15 | recording auto-stops at event limit |
| UT-17-16 | loop record default keeps last pass |
| UT-17-17 | loop record keepAllPasses |
| UT-17-18 | commitTake replace vs merge |
| UT-17-19 | quantizeSelection uses bar rule |
| UT-17-20 | read-only mode blocks edits but allows playback |
| UT-17-21 | paste at snapped tick with new ids and channel |
| UT-17-22 | autosave safe points |
| UT-17-23 | strip creation failure degrades |
| UT-17-24 | close flushes checkpoint when dirty and safe |
| UT-17-25 | solo semantics via mixerState |
| UT-17-26 | sections derived from markers and fallback |
| UT-17-27 | setTempo refused while recording |
| UT-17-28 | sustain extends durations |
| UT-17-29 | moveSelection snap preserves relative timing |
| UT-17-30 | overview density cache |

#### 12.2.18 M-18 `FLM.Render` (group `render`, `src/91-test-render.js`, Part 6.18.8): 26 tests

| UT-ID | Name |
|---|---|
| UT-18-01 | mat4 multiply and invert |
| UT-18-02 | perspective and lookAt |
| UT-18-03 | quat slerp and euler |
| UT-18-04 | normal trick equals inverse transpose |
| UT-18-05 | scene graph dirty propagation |
| UT-18-06 | node add detaches and counts |
| UT-18-07 | primitive vertex and index counts |
| UT-18-08 | tier pick table |
| UT-18-09 | abstract init without GL |
| UT-18-10 | shader failure falls back |
| UT-18-11 | both programs compile and link |
| UT-18-12 | setTier clamping and events |
| UT-18-13 | auto-downgrade from p95 |
| UT-18-14 | hidden-tab gaps excluded |
| UT-18-15 | context loss and restore rebuild |
| UT-18-16 | restore timeout falls back |
| UT-18-17 | resource exhaustion downgrades |
| UT-18-18 | dispose returns counters to zero |
| UT-18-19 | frame error isolation |
| UT-18-20 | loop passes clock time untouched |
| UT-18-21 | instanced and per-draw paths agree |
| UT-18-22 | geometry cache sharing |
| UT-18-23 | camera spring settles without overshoot |
| UT-18-24 | Flat2D highway drawing |
| UT-18-25 | resolution scale and DPR cap |
| UT-18-26 | exported tables frozen |

#### 12.2.19 M-19 `FLM.Rig` (group `rig`, `src/91-test-rig.js`, Part 6.19.8): 19 tests

| UT-ID | Name |
|---|---|
| UT-19-01 | joint table order |
| UT-19-02 | lengths by body and height |
| UT-19-03 | rest pose FK positions |
| UT-19-04 | attachment positions |
| UT-19-05 | blend endpoints and midpoint |
| UT-19-06 | IK reachable target |
| UT-19-07 | IK unreachable target |
| UT-19-08 | IK pole side and degenerate pole |
| UT-19-09 | IK hand rotation |
| UT-19-10 | setPose drives nodes |
| UT-19-11 | default appearance mesh count |
| UT-19-12 | sleeve and leg rules |
| UT-19-13 | unknown style defaults |
| UT-19-14 | validateAttachments |
| UT-19-15 | NaN pose rejected |
| UT-19-16 | rig-affecting change keeps pose and moves attachments |
| UT-19-17 | visual-only change reuses geometry |
| UT-19-18 | dispose releases geometry |
| UT-19-19 | LOD rebuild |

#### 12.2.20 M-20 `FLM.Animation` (group `animation`, `src/91-test-animation.js`, Part 6.20.8): 33 tests

| UT-ID | Name |
|---|---|
| UT-20-01 | profile table |
| UT-20-02 | agrees with instrument definitions |
| UT-20-03 | readSched accepts both field schemes |
| UT-20-04 | drum kick contact and raise peak |
| UT-20-05 | drum limb map |
| UT-20-06 | crash goes to the nearest free hand |
| UT-20-07 | same-limb merge |
| UT-20-08 | keys split and position |
| UT-20-09 | keys press dip and hold |
| UT-20-10 | chord spread |
| UT-20-11 | guitar fret choice and hand position |
| UT-20-12 | guitar strum alternation |
| UT-20-13 | vibrato only on long notes |
| UT-20-14 | bowing and pizzicato |
| UT-20-15 | winds sustain posture and finger offsets |
| UT-20-16 | synth knob gesture |
| UT-20-17 | vocal and abstract |
| UT-20-18 | stillness during rests (S-17) |
| UT-20-19 | frame-count independence (S-03) |
| UT-20-20 | determinism and per-character variation |
| UT-20-21 | arrival order irrelevant |
| UT-20-22 | late arrival shortens anticipation; live dip |
| UT-20-23 | pause holds pose, resume continuous |
| UT-20-24 | seek eases to idle |
| UT-20-25 | intensity |
| UT-20-26 | director plan rules |
| UT-20-27 | director enable rules and resync |
| UT-20-28 | beat indicator |
| UT-20-29 | visualizer caps and reduced motion |
| UT-20-30 | controller failure isolation |
| UT-20-31 | program change swaps controller |
| UT-20-32 | low tier animated set |
| UT-20-33 | style gain |

#### 12.2.21 M-21 `FLM.Stage` (group `stage`, `src/91-test-stage.js`, Part 6.21.8): 22 tests

| UT-ID | Name |
|---|---|
| UT-21-01 | slot table |
| UT-21-02 | slot assignment |
| UT-21-03 | prop requirements align with the rig |
| UT-21-04 | stage detail node counts |
| UT-21-05 | FullBand frames every performer |
| UT-21-06 | Focus centers the slot |
| UT-21-07 | camera change leaves time and poses alone |
| UT-21-08 | highway crossing time with latency |
| UT-21-09 | lead time scaling |
| UT-21-10 | judged states |
| UT-21-11 | chords and glyphs |
| UT-21-12 | pool cap drops farthest |
| UT-21-13 | same model in 3D and Abstract |
| UT-21-14 | beat pulse from music position |
| UT-21-15 | sparks deterministic and capped |
| UT-21-16 | live character edit |
| UT-21-17 | dispose returns to baseline |
| UT-21-18 | context loss keeps state advancing |
| UT-21-19 | build failure falls back |
| UT-21-20 | loop shading |
| UT-21-21 | dance highway and themes |
| UT-21-22 | program change swaps the prop |

#### 12.2.22 M-22 `FLM.Character` (group `character`, `src/91-test-character.js`, Part 6.22.8): 20 tests

| UT-ID | Name |
|---|---|
| UT-22-01 | catalog completeness |
| UT-22-02 | create defaults |
| UT-22-03 | validate error codes |
| UT-22-04 | normalize repairs and is idempotent |
| UT-22-05 | hat and headphones exclusive |
| UT-22-06 | bottom and dress rules |
| UT-22-07 | resolve render rules and colors |
| UT-22-08 | presets registered and valid |
| UT-22-09 | applyPreset keeps identity |
| UT-22-10 | randomize deterministic and valid |
| UT-22-11 | serialize round trip |
| UT-22-12 | file errors |
| UT-22-13 | network payload limit |
| UT-22-14 | diff and rig-affecting split |
| UT-22-15 | edit emits and coalesces |
| UT-22-16 | roster load, save and failure |
| UT-22-17 | preset file round trip |
| UT-22-18 | project command |
| UT-22-19 | frozen tables |
| UT-22-20 | x extension handling |

#### 12.2.23 M-23 `FLM.Dance` (group `dance`, `src/91-test-dance.js`, Part 6.23.8): 33 tests

| UT-ID | Name |
|---|---|
| UT-23-01 | direction mapping |
| UT-23-02 | generated charts pass strict validation |
| UT-23-03 | same-tick steps: strict rejects, repair merges |
| UT-23-04 | overlapping holds in one direction |
| UT-23-05 | max simultaneous by difficulty |
| UT-23-06 | hold counts toward simultaneous |
| UT-23-07 | min spacing by difficulty |
| UT-23-08 | hold minimum and tap duration |
| UT-23-09 | determinism |
| UT-23-10 | easy uses beats 1 and 3 |
| UT-23-11 | difficulty ordering |
| UT-23-12 | hard jumps at section starts and even bars |
| UT-23-13 | drum strong hits drive selection |
| UT-23-14 | silent bars produce no steps; empty song throws |
| UT-23-15 | no three identical in a row |
| UT-23-16 | alternate feet |
| UT-23-17 | holds on sustained bass |
| UT-23-18 | minimum gap in ms at fast tempo |
| UT-23-19 | meter and tempo change |
| UT-23-20 | window map |
| UT-23-21 | jump is a chord |
| UT-23-22 | pause and interruption during a hold |
| UT-23-23 | life bar rules |
| UT-23-24 | finish detection and once-only |
| UT-23-25 | loop passes and speed ramp |
| UT-23-26 | choreography is a function of audio time |
| UT-23-27 | choreography failure isolation |
| UT-23-28 | export/import round trip |
| UT-23-29 | import errors and notice |
| UT-23-30 | unsupported step type |
| UT-23-31 | asJudgeChart |
| UT-23-32 | generator leaves the song untouched |
| UT-23-33 | HUD model |

#### 12.2.24 M-24 `FLM.Net` (group `net`, `src/91-test-net.js`, Part 6.24.8): 40 tests

| UT-ID | Name |
|---|---|
| UT-24-01 | code round trip |
| UT-24-02 | code rejection and whitespace |
| UT-24-03 | envelope rules |
| UT-24-04 | payload strictness |
| UT-24-05 | size caps |
| UT-24-06 | strings and depth |
| UT-24-07 | role rules |
| UT-24-08 | dedupe by seq |
| UT-24-09 | out-of-order |
| UT-24-10 | pause after resume ignored |
| UT-24-11 | offset math vector |
| UT-24-12 | median with outliers |
| UT-24-13 | quality thresholds and sample minimum |
| UT-24-14 | shared time conversions |
| UT-24-15 | rate limiter |
| UT-24-16 | invalid storm |
| UT-24-17 | hello checks |
| UT-24-18 | ready checks |
| UT-24-19 | scheduled start |
| UT-24-20 | start too close |
| UT-24-21 | input acceptance window |
| UT-24-22 | host judges guest with guest offset |
| UT-24-23 | score updates at 10 Hz |
| UT-24-24 | room full |
| UT-24-25 | same player twice and reconnect limit |
| UT-24-26 | reconnect resync |
| UT-24-27 | reconnect window and connect timeouts |
| UT-24-28 | host leaves |
| UT-24-29 | guest leaves |
| UT-24-30 | relay envelope and sender binding |
| UT-24-31 | relay control mapping |
| UT-24-32 | late join rejected |
| UT-24-33 | cleanup |
| UT-24-34 | room codes |
| UT-24-35 | avatar validation and privacy text |
| UT-24-36 | pause request throttle |
| UT-24-37 | missed updates |
| UT-24-38 | deferred studio types |
| UT-24-39 | non-trickle gathering and RTC failure |
| UT-24-40 | interruption routing |

#### 12.2.25 M-25 `FLM.Progress` (group `progress`, `src/91-test-progress.js`, Part 6.25.8): 23 tests

| UT-ID | Name |
|---|---|
| UT-25-01 | record shape |
| UT-25-02 | comparable rule |
| UT-25-03 | personal best update |
| UT-25-04 | bests keyed by song and chart |
| UT-25-05 | prune 500 |
| UT-25-06 | achievement catalog integrity |
| UT-25-07 | first clear and dance clear |
| UT-25-08 | combo and full combo |
| UT-25-09 | clears count |
| UT-25-10 | instrument groups and full band |
| UT-25-11 | dance achievements |
| UT-25-12 | practice minutes carry |
| UT-25-13 | counters from events |
| UT-25-14 | unlock state and listener isolation |
| UT-25-15 | daily seed determinism |
| UT-25-16 | daily ranges and variety |
| UT-25-17 | daily completion |
| UT-25-18 | maxScoreFor |
| UT-25-19 | storage failure keeps memory |
| UT-25-20 | corrupt documents |
| UT-25-21 | newer version is read-only |
| UT-25-22 | history query, trend, compare, stats |
| UT-25-23 | cosmetics do not affect gameplay |

#### 12.2.26 M-26 `FLM.UI` (group `ui`, `src/91-test-ui.js`, Part 6.26.8): 26 tests

| UT-ID | Name |
|---|---|
| UT-26-01 | push and pop order |
| UT-26-02 | lower screens inert |
| UT-26-03 | failing mount keeps stack |
| UT-26-04 | unmount throw still cleans |
| UT-26-05 | back consults onBack |
| UT-26-06 | history entries follow stack |
| UT-26-07 | forward is a no-op |
| UT-26-08 | dialog focus trap and restore |
| UT-26-09 | dialog escape and danger default |
| UT-26-10 | dialog stack limit |
| UT-26-11 | toast queue, durations, dedupe |
| UT-26-12 | button states |
| UT-26-13 | slider keyboard |
| UT-26-14 | disabled reason |
| UT-26-15 | roving tabindex list |
| UT-26-16 | layout classes and event |
| UT-26-17 | ui scale clamp and compact cap |
| UT-26-18 | pad geometry portrait |
| UT-26-19 | pad geometry landscape right |
| UT-26-20 | pad pressed state from input |
| UT-26-21 | pad glyphs and labels |
| UT-26-22 | HUD per kind and coalescing |
| UT-26-23 | text catalog |
| UT-26-24 | text entry restriction |
| UT-26-25 | truncate rules |
| UT-26-26 | reduced motion and contrast classes |

#### 12.2.27 M-27 `FLM.Screens` (group `screens`, `src/91-test-screens.js`, Part 6.27.8): 28 tests

| UT-ID | Name |
|---|---|
| UT-27-01 | main menu entries and order |
| UT-27-02 | disabled entries explain why |
| UT-27-03 | import picker inside the gesture |
| UT-27-04 | quick play defaults |
| UT-27-05 | quick play dance choice |
| UT-27-06 | instrument auto difficulty |
| UT-27-07 | first launch steps and flag |
| UT-27-08 | tutorial transitions |
| UT-27-09 | tutorial success criteria |
| UT-27-10 | tutorial variants |
| UT-27-11 | tutorial example import |
| UT-27-12 | tutorial done sets flag |
| UT-27-13 | settings load normalization |
| UT-27-14 | settings set event and debounce |
| UT-27-15 | settings export import round trip |
| UT-27-16 | remap capture and conflict |
| UT-27-17 | calibration math |
| UT-27-18 | save failed dialog |
| UT-27-19 | import inspect renders I 6.1 fields |
| UT-27-20 | import mapping change regenerates preview |
| UT-27-21 | results content |
| UT-27-22 | multiplayer views follow net.state |
| UT-27-23 | clipboard fallback |
| UT-27-24 | studio back guard |
| UT-27-25 | library filter restore |
| UT-27-26 | codeLabel table |
| UT-27-27 | pause screen registers no notes |
| UT-27-28 | audio blocked dialog resolves on unlock |

#### 12.2.28 M-28 `FLM.Modes` (group `modes`, `src/91-test-modes.js`, Part 6.28.8): 21 tests

| UT-ID | Name |
|---|---|
| UT-28-01 | enter and leave freeplay is clean |
| UT-28-02 | 20 cycles per gameplay mode |
| UT-28-03 | leave with a held note |
| UT-28-04 | transitions serialize |
| UT-28-05 | enter failure returns to menu |
| UT-28-06 | leave step failure continues |
| UT-28-07 | assertClean detects leaks |
| UT-28-08 | audio blocked gate |
| UT-28-09 | visibility hidden pauses gameplay |
| UT-28-10 | live mode continues when hidden |
| UT-28-11 | gamepad disconnect pauses only when held |
| UT-28-12 | context loss keeps transport |
| UT-28-13 | frame errors escalate |
| UT-28-14 | finish runs once |
| UT-28-15 | autosave on leave from studio |
| UT-28-16 | multiplayer hash mismatch |
| UT-28-17 | practice loop per-pass judging |
| UT-28-18 | target track policy |
| UT-28-19 | browser back pauses gameplay |
| UT-28-20 | auto tier |
| UT-28-21 | netConnections exemption |

#### 12.2.29 M-29 `FLM.Boot` (group `boot`, `src/91-test-boot.js`, Part 6.29.8): 12 tests

| UT-ID | Name |
|---|---|
| UT-29-01 | URL parameter parsing |
| UT-29-02 | gate soft rows |
| UT-29-03 | gate hard rows |
| UT-29-04 | missing module is fatal |
| UT-29-05 | storage modes reach the menu notice |
| UT-29-06 | audio init failure |
| UT-29-07 | errors before ready escalate |
| UT-29-08 | landing branch |
| UT-29-09 | one-shot unlock gesture |
| UT-29-10 | debug surface and fault gating |
| UT-29-11 | public surface keys |
| UT-29-12 | boot stage order |

#### 12.2.30 M-30 `FLM.Content` (group `content`, `src/91-test-content.js`, Part 6.30.8): 14 tests

| UT-ID | Name |
|---|---|
| UT-30-01 | expansion determinism |
| UT-30-02 | durations |
| UT-30-03 | note counts |
| UT-30-04 | tempo and meter change present |
| UT-30-05 | pitch ranges inside instrument ranges |
| UT-30-06 | drum voice coverage |
| UT-30-07 | swing and ties |
| UT-30-08 | controllers |
| UT-30-09 | notation errors |
| UT-30-10 | model validity |
| UT-30-11 | catalog registration |
| UT-30-12 | presets valid |
| UT-30-13 | tutorial charts |
| UT-30-14 | pedal derivation |

#### 12.2.31 M-31 `FLM.SelfTest` (group `selftest`, `src/90-selftest.js` runner, tests in `src/91-test-selftest.js`, Part 6.31.8): 16 tests

| UT-ID | Name |
|---|---|
| UT-31-01 | passing test recorded |
| UT-31-02 | failing assertion recorded |
| UT-31-03 | thrown error recorded |
| UT-31-04 | async test awaited |
| UT-31-05 | timeout |
| UT-31-06 | skip |
| UT-31-07 | slow filter |
| UT-31-08 | grep filter |
| UT-31-09 | unknown group |
| UT-31-10 | results shape and global |
| UT-31-11 | assertion semantics |
| UT-31-12 | stubs restored |
| UT-31-13 | fake clock with transport |
| UT-31-14 | fake IndexedDB basics and faults |
| UT-31-15 | group leak check |
| UT-31-16 | corpus hash check |

#### 12.2.32 B 25.1 minimum unit-test topics

| B 25.1 topic | Unit tests (ranges are inclusive) |
|---|---|
| Musical time conversion | UT-03-16..UT-03-19, UT-03-26, UT-04-05, UT-04-06, UT-04-25 |
| Tempo-map conversion | UT-03-16, UT-03-17, UT-03-18, UT-04-03, UT-04-26, UT-10-22, UT-10-24, UT-10-25 |
| Note scheduling | UT-04-15..UT-04-21, UT-05-15..UT-05-20, UT-05-29, UT-06-06 |
| Input normalization | UT-07-04..UT-07-13, UT-07-16..UT-07-20, UT-07-31 |
| Four-button mapping | UT-08-01..UT-08-09, UT-08-20..UT-08-30 |
| Chord generation | UT-02-12, UT-02-13, UT-02-14, UT-02-16, UT-08-04, UT-08-05, UT-08-29 |
| Scale mapping | UT-02-05..UT-02-11, UT-08-01, UT-08-06, UT-08-10 |
| Score calculation | UT-09-01..UT-09-10, UT-09-27, UT-09-34 |
| MIDI parsing | UT-10-01..UT-10-33, UT-10-37..UT-10-40 |
| Project serialization | UT-15-03, UT-15-04, UT-15-30, UT-16-09, UT-22-11 |
| Project migration | UT-15-13, UT-15-14 |
| Dance chart parsing | UT-23-02, UT-23-03, UT-23-04, UT-23-28, UT-23-29, UT-23-30 |
| Error handling | UT-01-13..UT-01-17, UT-14-18, UT-15-19, UT-26-03, UT-26-04, UT-28-05, UT-28-06, UT-29-07 |

### 12.3 Integration tests (IT-001..)

Integration tests run the real modules together in the test build (group `integration`,
`src/92-test-integration.js`) under the conventions of 12.1.2. "Modules" lists the modules whose
cooperation the test exercises; every row also relies on M-01 and M-31. Rows marked
Automated "no" need a process outside the page (the relay) and are run by hand at the gates
named in 12.1.5; their result is recorded like an automated one.

#### 12.3.1 Test table

| ID | Title | Modules | Setup | Steps | Expected | Pass criterion | Automated |
|---|---|---|---|---|---|---|---|
| IT-001 | keyboard lane press to live audio | M-07, M-08, M-05, M-06, M-28 | `freeplay` mode entered through `Modes.enter('freeplay', {})`; profile A, key C major, program 0; real clock; `Audio.unlock()` resolved true | dispatch a `keydown` then, 400 ms later, a `keyup` KeyboardEvent with `code` `KeyA` on the gameplay surface; spy on `input.event`, `sched.noteOn`, `sched.noteOff` | one `input.event` press and one release (source `keyboard`, control `lane0`); one `sched.noteOn` with `live:true` and the profile A lane 0 pitch of UT-08-01; one `sched.noteOff` with `reason:'live'` at the keyup's mapped audio time | event counts exactly 1, 1, 1, 1; `performance.now()` at the `sched.noteOn` emit minus `tPerf` <= 16.7 ms; `Audio.VoiceAllocator.activeCount()` is 0 within the program's release time plus 50 ms after the keyup | yes |
| IT-002 | touch pads: four simultaneous pointers to live audio | M-07, M-26, M-08, M-05 | touch context (`integration@touch`); `freeplay`; pads shown at `input.padSize` medium; real clock | dispatch `pointerdown` for pointerIds 1 to 4 on pads 0 to 3 in one task; after 300 ms dispatch `pointerup` in the order 3, 1, 4, 2; then repeat with the browser's compatibility mouse events also dispatched | 4 presses then 4 releases (source `pointer`), each pad's pressed class set then cleared; 4 live `sched.noteOn` and 4 `sched.noteOff`; the compatibility mouse events produce no extra `input.event` | exactly 8 `input.event` per round; no control left in `Input.State.held()`; `activeVoices` 0 after the release tails; `assertClean()` null after leave | yes |
| IT-003 | input to scoring: 31 perfect presses | M-07, M-09, M-04, M-28 | `instrument` mode with a test chart of 31 single-lane notes on beats 1 to 31 of a 120 BPM 4/4 test song (intermediate, lane `n % 4`); calibration all zero | chart bot presses and releases each note at `Transport.audioTimeAt(note.tick)`; record the input log; afterwards replay the log through a fresh `Rhythm.Judge` on the same chart | 31 `judge.result` perfect; final `ScoreState` `{score:6400, combo:31, maxCombo:31, counts:{perfect:31, great:0, good:0, miss:0}, judged:31, total:31, accuracy:1, completion:1}`; one `chart.finished` with `endedBy:'end'` | exact integer equality (score = 100 x (10 x 1 + 10 x 2 + 10 x 3 + 1 x 4) = 6400, multiplier from the combo before each note); the replayed ScoreState is deep-equal | yes |
| IT-004 | calibration affects scoring predictably | M-07, M-09, M-27, M-21 | the IT-003 chart at expert; inputs synthesized 30 ms after each note's audio time | run 1: `inputOffsetMs 0`, `audioLatencyMs 0`; run 2: `inputOffsetMs 30`; run 3: `audioLatencyMs 30`, `inputOffsetMs 0`; settings set through `Settings.set` as SCR-Settings does | run 1: every `deltaMs` +30 and every judgment `great` (expert perfect 18 ms, great 40 ms); runs 2 and 3: every `deltaMs` 0 and `perfect`; Scheduler `at` values and the highway's hit-line crossing times identical in all three runs | per note abs(`deltaMs` - expected) <= 1 ms; the three `sched.noteOn.at` lists are equal; run 2 and run 3 ScoreStates deep-equal (S-04: calibration applied once, in the Judge) | yes |
| IT-005 | chords and simultaneous presses within documented limits | M-07, M-09, M-08 | chart with chords of 2, 3 and 4 lanes (4 of each) at 1 s spacing, intermediate | press every lane of each chord with spreads of 0, 20 and 40 ms; for the last 4-lane chord press lane 3 60 ms after lane 0 | each in-tolerance chord yields one `judge.result` after its last press with `deltaMs` equal to the worst lane; the last chord's late press is a stray and the chord is a miss when the window closes (UT-09-15 rule) | 11 chord hits plus 1 chord miss; stray count 1; no lane judged twice | yes |
| IT-006 | imported MIDI to playback: tracks, programs and notes | M-10, M-14, M-15, M-04, M-05, M-06 | corpus `midi-multitrack-band.mid`; `Import.importFile`, then `Project.fromSong` as the Play now path does; offline engine of Part 6.5.4.10 with a 20 s `OfflineAudioContext` | schedule the whole song through `scheduler.tickOnce` in 25 ms steps; render; collect `sched.noteOn` and `sched.program` | 240 `sched.noteOn` (32, 64, 48, 96 per track); programs 33, 29 and 0 on the melodic tracks; the Drums track routed to the drum kit (`isDrums:true`, channel 9); every `at` equals `audioTimeAt(tick)` at tempo 600000 | counts exact; abs(`at` - `audioTimeAt(tick)`) <= 1 ms for every note; rendered onsets of the first note of each track within one render quantum plus 1 ms | yes |
| IT-007 | imported MIDI with tempo changes plays on the tempo map | M-10, M-14, M-03, M-04, M-05 | corpus `midi-tempo-changes.mid` imported; offline engine | schedule and render the full 26.9 s | 48 click notes at the seconds given by the six-segment TempoMap; the note at model tick 45360 starts at `ticksToSeconds(45360)` | every `at` within 1 ms of `TempoMap.ticksToSeconds(tick)` plus the start anchor; `ticksToSeconds(45600)` within 1e-6 of 26.911904 | yes |
| IT-008 | polyphonic MIDI stays polyphonic in playback | M-10, M-14, M-05, M-06 | corpus `midi-poly-chords.mid`; offline engine; voice cap 64 | schedule and render; sample `Audio.VoiceAllocator.activeCount()` after every tick | five notes sound together at every bar start of bars 9 to 16 (seventh chord plus bass); no voice is stolen | maximum simultaneous `sched.noteOn` sharing one `at` is 5; `audio.voices.stolen === 0`; 240 notes started | yes |
| IT-009 | imported MIDI drives instrument animation at scheduled audio times | M-14, M-05, M-20, M-21, M-19 | corpus `midi-multitrack-band.mid` confirmed as a project; `instrument` mode on Keys; tier Balanced; real clock | play 8 s; record for each `sched.noteOn` the `at` passed to the owning controller and the audio time at which the controller reports its contact or peak (`Animation.Mixer` debug readout used by UT-20-04 and UT-20-09) | the Drums controller reports kick and snare contacts and the Keys controller key dips for exactly the scheduled notes; each contact time equals the event's `at` | every scheduled note of the four tracks reaches its controller once; abs(contact time - `at`) <= one frame interval; no contact without a scheduled event (S-03, S-17) | yes |
| IT-010 | multiple instruments perform simultaneously | M-20, M-21, M-30 | `quickplay` with `demo-poprock` (five performers), FullBand camera; real clock | play bars 13 to 16 (chorus); sample each performer's controller activity per 250 ms window | all five performers (Drums, Bass, Rhythm Guitar, Lead Guitar, Keys) show event-driven motion inside the same 2 s window; poses of performers whose tracks rest stay idle-bounded | every performer with notes in the window has at least one controller contact in it; `sceneNodes` per performer constant during the run | yes |
| IT-011 | dense passage rendering never blocks audio scheduling | M-05, M-18, M-21, M-20 | generated song: 8 tracks, 200-note chords on every beat for 8 beats at 120 BPM; tier High (SwiftShader); real clock | play the passage; record Scheduler diagnostics and `render.stats` | every chord's notes are scheduled before their `at`; frames may be slow but the Scheduler tick never waits for a frame | `lateEvents === 0`; `tickWorkMaxMs` <= 4 ms (S-10); `started + dropped` equals 1,600 | yes |
| IT-012 | reduced-quality tiers preserve the timeline and scores | M-18, M-09, M-21, M-28 | the IT-003 chart and its recorded input log | replay the same input log with `video.tier` `high` and then `abstract` (Abstract draws on `#flat`) | both runs produce the same judgments and `ScoreState`; highway notes cross the hit line at the same audio times in both tiers | ScoreStates deep-equal (S-02); per note hit-line crossing times equal within one frame | yes |
| IT-013 | renderer never advances musical time in a live mode | M-04, M-18, M-21 | `instrument` mode, `demo-poprock` Keys; real clock | for 20 s alternate frame intervals between 16 ms and 300 ms by arming `render.slowFrames {ms:300, everyN:5}`; at every frame compare the highway's current tick with `Transport.main.positionAt(audioNow)` | the highway tick follows the audio clock through every slow frame; no catch-up jump beyond the clock | max abs difference <= 1 tick over the run (S-01) | yes |
| IT-014 | recording to project save and reload | M-17, M-15, M-16, M-04, M-07 | `studio` with a new project at 120 BPM 4/4, one track (program 0) armed, count-in 1 bar; `fakes.indexedDB` | record 64 synthesized presses of 120 ms at eighth-note spacing; stop; Save; then `Storage.open()` on a new Storage instance over the same fake database and load the project | one take with `status:'complete'` and 64 NoteEvents; `project.saved` after read-back; the reloaded project's track events equal the take | reloaded `Project.serialize` byte-equal to the saved text; 64 notes with ticks and durations equal to the recorded ones; `isDirty()` false after the save | yes |
| IT-015 | overdub: earlier tracks play while recording | M-17, M-05, M-04 | `studio` project with track 1 holding 16 recorded notes; track 2 armed; real clock | record on track 2 for 8 s with synthesized presses | track 1's notes produce `sched.noteOn` during the recording at their scheduled times; track 2 receives its take; track 1 is unchanged | 16 `sched.noteOn` for track 1 inside the take window; track 1 events deep-equal before and after | yes |
| IT-016 | multitrack playback and mixing | M-17, M-05, M-15 | `studio` project of 4 tracks with notes on every beat; real clock | during playback: set track 2 gain 0.5 and pan -1; mute track 3; solo track 4, then also solo track 1; unsolo both; undo the mute | strip effective gains follow the solo set rules (UT-05-09): with solos {4} only strip 4 is audible, with {1, 4} strips 1 and 4; mute and unmute ramp (no step); pan -1 sets the strip pan; all tracks keep scheduling events while muted | effective gains read from the strips equal the expected values within 0.001 once each ramp of UT-05-10 has ended; `sched.noteOn` count per track unchanged by mute or solo; undo restores track 3 `mix.mute:false` | yes |
| IT-017 | mix of 32 loud tracks stays below full scale | M-05, M-17 | generated 32-track project, every track playing a velocity-127 chord on beat 1 of 4 bars; offline engine | render 8 s through the master limiter | the master output never exceeds full scale; `audio.peak.clipped` stays false | rendered peak <= 1.0 (absolute sample value) and no sample is NaN | yes |
| IT-018 | undo and redo restore events and track configuration | M-15, M-17 | `studio` project with 3 tracks | apply in order: add track, set program 25, record 8 notes, quantize, move the notes 2 bars, delete the track; undo 6 times; redo 3 times; make a new edit; try redo | each undo restores the exact previous project state including program and mixer fields; redo re-applies; redo after a new edit does nothing | after 6 undos the serialized project equals the starting serialization; after 3 redos it equals the state after step 3; `redoDepth` 0 after the new edit | yes |
| IT-019 | dance chart to scoring | M-23, M-09, M-07, M-28 | `dance` mode, `demo-dance`, normal, layout `arrows`; real clock | chart bot presses every step on the dance controls (`ArrowLeft ArrowDown ArrowUp ArrowRight` mapping); then replay the input log on a fresh Judge | every step judged perfect through `Rhythm.Judge` with the intermediate windows (normal maps to intermediate, UT-09-33); jumps judged as one chord | final ScoreState has `accuracy 1` and `counts.miss 0`; the replay ScoreState is deep-equal | yes |
| IT-020 | dance avatar movement stays synchronized with the chart | M-23, M-20, M-21 | `dance` mode, `demo-dance`, easy; real clock | play 16 bars with the chart bot; for each step read the `ChoreographyController` pose phase at the step's audio time | the step pose for each direction is reached at the step's `audioTimeAt(tick)`; the pose is a function of audio time only (UT-23-26) | abs(pose peak time - step time) <= one frame interval for every step; with `render.slowFrames {ms:200}` armed the same holds | yes |
| IT-021 | dance scoring continues when choreography is missing | M-23, M-20, M-09 | `dance` mode with the choreography controller replaced by null for the player avatar (E 7 unavailable asset) | play 8 bars with the chart bot | steps are shown and judged normally; the avatar idles with beat sway; no error dialog | ScoreState equals a run with choreography present; one Log entry for the missing controller | yes |
| IT-022 | character customization to saved appearance | M-22, M-16, M-27, M-19, M-21 | `customize` mode; `fakes.indexedDB` and `fakes.localStorage`; roster default | change body, height 1.08, hair style and color, top, shoes and two accessories of slot 0 through the SCR-Characters controls; leave; re-open storage with a new Storage instance and load the roster; render the performer | the reloaded `CharacterConfig` is deep-equal to the edited one; `Character.resolve` of both gives the same render description; the rebuilt rig uses the new lengths | deep equality of config and resolved description; mesh count equals UT-19-11's count rule for that appearance | yes |
| IT-023 | character edited during playback rebuilds one performer only | M-22, M-21, M-19, M-04 | `quickplay` with `demo-poprock`; real clock | while playing, apply a rig-affecting change (body) and a visual-only change (top color) to the Keys performer through `Character.edit` | one `character.changed` per edit; only that performer's nodes are rebuilt (rig-affecting) or recolored (visual-only); the transport, scheduler and Judge are untouched | Transport state and tick continuity (no jump > 1 tick); `lateEvents === 0`; other performers' node ids unchanged | yes |
| IT-024 | characters saved inside a project | M-15, M-16, M-22 | `studio` project with 3 characters assigned to slots 0 to 2 | save, reload, and export then re-import the `.flm.json` | characters, slots and instruments restored; `x` extension fields kept | deep equality of `project.characters` after reload and after re-import | yes |
| IT-025 | multiplayer synchronized start over a loopback pair | M-24, M-04, M-05 | two `Net.createSession(deps)` instances (host, guest) on `Net.createLoopbackPair({latencyMs:20})`; each with its own FakeClock, guest clock = host clock + 0.250 s; `fakes.rtc` | host creates a room, guest joins with the invite and answer codes; both ready; host starts Synchronized Play on `demo-poprock` | 8 clock-sync samples before `countdown`; the guest's offset estimate within 20 ms of the true 250 ms offset (sign per the `Net.Clock` convention of Part 6.24); both sides convert the start to their local audio clocks so the start falls on the same shared time | abs(estimated offset - true offset) <= 20 ms; the two start instants converted to host time differ by <= 20 ms; `syncSamplesBeforeStart === 8` | yes |
| IT-026 | multiplayer scoring: host judges guest inputs | M-24, M-09 | IT-025 session in `playing` | guest sends 40 `input` messages for chart notes with its local audio times; host judges with the guest offset; run 6 s of fake time | host results for the guest match a local Judge run with the same inputs converted by the offset; guest receives `score` updates at 10 Hz | guest ScoreState from the host deep-equal to the local reference; 60 +/- 1 score updates in 6 s | yes |
| IT-027 | multiplayer disconnect and reconnect keep local state intact | M-24, M-15, M-28 | IT-025 session; a dirty local project exists in memory before entering `multiplayer` | close the guest link at song second 10; reconnect with the same resume token at second 30 (within 60 s) | host toast E-NET-016 and slot kept; guest shows the reconnect state; after reconnect `roomState` resync puts the guest at the shared position | guest position after resync within 20 ms of the host's; the local project deep-equal before and after the session; `Net.connectionCount() === 0` after the session closes | yes |
| IT-028 | multiplayer rejects invalid authoritative results | M-24 | IT-025 session in `playing` | guest sends a forged `score` message, a host-only `start` message, an oversized (70 KB) message, a message with a wrong `v`, and 70 messages in one second | host ignores the forged `score` and `start` (role rules), rejects the oversized and wrong-version messages and counts them as invalid, drops the messages above 60 per second and counts them; the session continues | host's authoritative scores unchanged by the forged messages; invalid count 2 (oversized, wrong `v`); role rejections 2; dropped count 10; the guest is disconnected only when 20 invalid messages arrive within 10 s | yes |
| IT-029 | multiplayer room full and late join | M-24 | host session with 3 guests joined over loopback pairs | a fifth session tries to join; then, after `start`, another session tries to join | the fifth join is refused with the room-full message; the join after start is rejected (late join, UT-24-32) | two refusals with their codes; the four-player session unaffected | yes |
| IT-030 | offline operation without the multiplayer service | M-28, M-24, M-29, M-27 | page with `RTCPeerConnection` and `WebSocket` replaced by undefined (`fakes.stub`) and `navigator.onLine` false | enter and leave `quickplay`, `instrument`, `freeplay`, `studio`, `library`, `import` (a corpus file), `dance`, `customize`, `tutorial`, `settings`; then open SCR-MainMenu | every local mode works; the Multiplayer entry is disabled with its one-line reason; no network request is made | every enter and leave succeeds with `assertClean()` null; `performance.getEntriesByType('resource').length === 0` at the end (ADR-02) | yes |
| IT-031 | optional relay failure does not disable standalone features | M-24, M-27, M-28 | online edition built with `node tools/build.mjs --online ws://127.0.0.1:8787`; `node server/relay.mjs` started by hand, then killed after the lobby opens | open SCR-Multiplayer, create a relay room, kill the relay process; then play `quickplay` | DLG-NetError with E-NET-012 or E-NET-017; SCR-Multiplayer offers the invite-code flow; Quick Play works normally | the dialog appears within 15 s of the kill; the Quick Play run completes with a PerformanceRecord written | no |
| IT-032 | twenty enter and leave cycles per mode stay clean | M-28, M-05, M-18, M-26, M-01 | storage fakes; tier Balanced; content built in | for each of `quickplay`, `instrument`, `freeplay`, `studio`, `dance`, `customize`, `library`, `import`, `tutorial`: 20 cycles of the Part 9.6.1 activity | every `Modes.leave` resolves with `assertClean()` null; the GL, timer, listener and node counters after cycle 20 equal those after cycle 1 | 180 clean leaves; `Audio.ctxCount() === 1` (S-18); heap growth <= 10 MB when `performance.memory` exists (S-06) | yes |
| IT-033 | leaving a mode with held notes leaves no stuck note | M-28, M-07, M-05, M-08 | `freeplay` playing; lanes 0 to 3 held through `Input.synthesize`; sustain on | call `Modes.enter('menu')` while the lanes and sustain are held | one release per held control; soft panic, then hard panic if voices remain at 350 ms | `activeVoices === 0` within 350 ms; `audioNodes` back to the base graph; `heldControls === 0` | yes |
| IT-034 | animation follows scheduled events, not frames, on the full stage | M-20, M-21, M-05 | `quickplay` with `demo-electro`; jump to the 4-bar Break (pad only) | play the Break and the first bar of the following Drop | during the Break the Drums, Synth Bass and Lead performers hold idle-bounded poses and their visualizers spawn nothing; the Pad performer moves; motion resumes on the Drop's first scheduled note | drum visualizer spawn count 0 in the Break (S-17); first drum contact time equals the first Drop note's `at` within one frame (S-03) | yes |
| IT-035 | calibration values touch only the Judge | M-07, M-09, M-21, M-24, M-05 | `instrument` mode; `inputOffsetMs 40`, `audioLatencyMs 25`, `visualLeadMs 0` | compare `Input.perfToAudio(t)` for 10 values of `t`, the Scheduler `at` values of 1 bar and the highway crossing times with a run where both calibration values are 0 | only `Rhythm.Judge` applies the 65 ms; mapping, scheduling and highway are identical | the three compared lists are equal between the runs (S-04) | yes |
| IT-036 | imported text never executes in the inspection screen | M-12, M-14, M-27, M-26 | corpus `xml-script-text.musicxml`; a sentinel `window.__pwned` undefined | import, render SCR-ImportInspect with the report, open the track list and the warning list | the title shows the literal text `<script>window.__pwned=1</script>`; no element is created from file text | `window.__pwned === undefined`; `#overlay` contains no `script`, `img` or `b` element created from the file (S-05) | yes |
| IT-037 | exported tables frozen and namespaces closed after a full session | M-01, M-29, all modules | boot of the test build; every mode entered and left once | check `Object.isFrozen` for `Instruments.DEFINITIONS`, `Theory.SCALES`, `Character.OPTIONS`, `Render.TIERS`, `Rhythm.WINDOWS`, `Rhythm.SCORING` and their nested objects; compare `Object.keys(window.FLM)` with the Part 4.8 list | every listed table is deep-frozen; no module added keys to another namespace | all frozen checks true; key list equal (S-07) | yes |
| IT-038 | chart generation never mutates the source arrangement | M-08, M-14, M-27, M-03 | corpus `midi-multitrack-band.mid` imported and shown on SCR-ImportInspect | in the preview, switch through the six profiles and four difficulties; change difficulty four times within 100 ms | one generation per settled change (debounced); every chart validates; the Song is untouched | fnv1a32 of the serialized Song equal before and after (S-08); exactly one generation for the four quick changes | yes |
| IT-039 | the audio clock is the only master | M-04, M-05 | `instrument` mode playing; real clock | replace `performance.now` with a function returning the true value plus 5,000 ms for 2 s, then restore; meanwhile read `positionAt(ctx.currentTime)` at every frame | the Transport position follows `ctx.currentTime` only; the input anchor is re-sampled after the jump | position continuity: successive positions differ by the audio-time delta within 1 tick; no `sched.noteOn` emitted out of tick order (S-09) | yes |
| IT-040 | bounded scheduling of a 2,000-note chord | M-05, M-04 | `freeplay`-style binding with a generated song holding 2,000 notes at one tick across 8 tracks; real clock | play through the chord | the chord is scheduled over several ticks; no note scheduled more than 125 ms ahead | every tick body <= 4 ms; `at - ctx.currentTime <= 0.125` at emission for every note (S-10); `started + dropped === 2000` | yes |
| IT-041 | malformed files in sequence leave the application usable | M-10, M-11, M-12, M-13, M-14, M-27 | every corpus file whose `expect.error` is set and every 8.9.4 variant | import each through `Import.importFile` from SCR-Import in one page session; afterwards start a Quick Play run | each file ends in its typed error or a partial song with warnings; the import screen returns to Empty or Report state each time | no uncaught error (S-11); each import settles within 5,000 ms; the following Quick Play run reaches `playing` | yes |
| IT-042 | import never touches the current project until confirmed | M-14, M-27, M-15 | a dirty project open in `studio` | import `midi-multitrack-band.mid`, view the report, Cancel; then import again and choose Save to Library: Cancel, then Discard changes, then (with `storage.writeFail` armed) Save first | Cancel changes nothing; DLG-ImportReplace appears on Save to Library; Discard leaves a checkpoint restorable by DLG-RecoverCheckpoint; Save first with the fault shows DLG-SaveFailed and keeps both the project and the report | `Project.current()` deep-equal and `isDirty()` unchanged after each Cancel (S-12); the checkpoint restores the discarded project deep-equal | yes |
| IT-043 | inputs are mode-stateless and released on leave | M-07, M-28 | SCR-MainMenu (mode `menu`) | press lanes 0 and 1 in `menu`; enter `freeplay`; hold lanes 2 and 3; leave | in `menu` only `input.event` fires (no note, no judgment); on leave exactly one release per held control | no `sched.noteOn` in `menu`; 2 releases with source `system` at leave; `held()` empty (S-13) | yes |
| IT-044 | save success only after read-back through the Studio UI | M-27, M-16, M-15 | `studio` with a dirty project; spies on the fake database requests | press Save; then arm `storage.writeFail {stage:'verify'}` and press Save again | first save: the read-back request precedes `project.saved` and `markClean`; second save: DLG-SaveFailed, no `project.saved` | request order verified by the spy log; `isDirty()` true after the failed save (S-14) | yes |
| IT-045 | tier changes during playback leave transport and judging alone | M-18, M-21, M-04, M-09 | `quickplay` with `demo-poprock`, chart bot; tier High | every 5 s switch `video.tier` High -> Low -> Abstract -> High while playing | geometry rebuilds in steps; the transport, Scheduler and Judge are not touched | `lateEvents === 0`; longest task during a switch <= 80 ms (Chromium `longtask`); all bot judgments perfect (S-15 applied to tier changes, Part 9.3.5) | yes |
| IT-046 | audio panic never touches project data | M-05, M-15, M-27 | `studio` with a dirty project playing | call `Audio.panic(true)` three times during playback; then Export the project | voices stop and the graph rebuilds; the project is unchanged; the export succeeds | `Project.current()` deep-equal to the pre-panic snapshot (S-16); exported text parses with `Project.parse` | yes |
| IT-047 | one audio engine per page | M-05, M-28, M-29 | booted test build | call `Audio.init()` twice; enter `quickplay` twice in a row without waiting (transitions serialize); call `Scheduler.bind` while bound | the same context is returned; transitions run one after another; the second bind throws E-AUD-005 | `Audio.ctxCount() === 1`; exactly one Scheduler binding active (S-18) | yes |
| IT-048 | Quick Play from the import screen uses the previewed chart | M-14, M-27, M-28, M-08 | corpus `midi-multitrack-band.mid` on SCR-ImportInspect with Keys, intermediate, profile C previewed | press Play now | Quick Play starts with the previewed chart; the current project is unchanged | the running chart's `settingsHash` equals the preview chart's; `Project.current()` deep-equal | yes |
| IT-049 | practice: target track mute and lower | M-28, M-05, M-09 | `instrument` with `demo-poprock` Keys | set `gameplay.targetTrackMode` `mute`, play 4 bars with perfect bot inputs; then `lower` | `mute`: target strip gain 0 and each hit sounds the ChartNote pitches live on the player strip; `lower`: target strip gain 0.3 | strip gains within 0.001; one live `sched.noteOn` per judged hit pitch in `mute` | yes |
| IT-050 | practice: slower speed silences audio tracks | M-04, M-05, M-14 | a project with one imported audio track (`audio-sine-1s.wav` looped as a 20 s track) and a MIDI track | play at speed 0.75 for 2 s; set speed 1.0 | at 0.75 no `AudioBufferSourceNode` is started for the audio track and the slider shows the notice; at 1.0 one is started at the current position | source-start spy counts 0 then 1; the start offset equals the transport position within 5 ms | yes |
| IT-051 | practice: loop with progressive speed | M-04, M-09, M-28, M-25 | `instrument` with `demo-poprock` Keys, Loop bars 9 to 16, Speed up after a clean pass (threshold 90), start speed 0.75 | three loop passes with perfect bot inputs | speed rises by 0.05 at each wrap; the HUD shows each pass accuracy; no PerformanceRecord is written | speed after 3 passes 0.90; `Progress` history count unchanged | yes |
| IT-052 | practice: restart at a bar and one-hand mode | M-04, M-08, M-09, M-05 | `instrument` with corpus `midi-multitrack-band.mid` Keys | restart at bar 9; then select Hands Left with split 60 | after the count-in `positionAt` equals `tickOfBar(8)`; the record is `comparable:false`; Left-hand chart has only pitches below 60 and notes at or above 60 play at unchanged gain | position equality within 1 tick; every ChartNote pitch < 60; the Left chart's `settingsHash` differs from Both | yes |
| IT-053 | results and progression after a finished song | M-09, M-25, M-27, M-28, M-16 | `quickplay` with `demo-piano`, beginner; `fakes.localStorage` | finish the song with perfect bot inputs; then finish it again with the bot missing 10 percent of notes | one `chart.finished` per run; SCR-Results shows score, accuracy, judgments and the worst section; first run sets the personal best, second does not | two PerformanceRecords stored; `isBest` true then false; `previousBest` of run 2 equals run 1's score | yes |
| IT-054 | two tabs editing the same project | M-16, M-27, M-17 | `studio` with project P open; the other tab simulated by writing the `flm.v1.lock` record for P with another tab id and dispatching a `StorageEvent` | attempt an edit and a Save | notice E-STO-006 and read-only Studio; Save offers DLG-SaveConflict (E-STO-007) with Take over and Save as copy; Save as copy writes a new project id | the original record unchanged after Save as copy; the copy loads deep-equal to the edited state | yes |
| IT-055 | autosave only at safe points | M-17, M-15, M-16 | `studio` with a dirty project; a storage write spy; FakeClock driving the autosave timer | play 30 s, record 10 s, stop, wait 61 s idle, add a track, delete a track | no write while `countin`, `playing` or `recording`; a write within 1,000 ms after stop; one idle write 60 s later; one write after each track add and delete | write timestamps match the rule exactly (Part 9.1.2 row 45) | yes |
| IT-056 | browser back during gameplay pauses instead of leaving | M-28, M-26, M-27 | `instrument` playing with a dirty project in memory | call `history.back()`; then call it again | first back opens SCR-Pause and pauses; second back shows DLG-UnsavedChanges because the project is dirty | transport `paused` after the first back; mode unchanged until the dialog is confirmed | yes |
| IT-057 | page hide autosaves a dirty project and offers recovery | M-28, M-16, M-29 | `studio` stopped with a dirty project under 2 MB; real localStorage (keys removed afterwards) | dispatch `pagehide`; then boot a fresh M-29 instance against the same storage | the synchronous localStorage safe write stores the project; the next boot offers the recovery copy (E-PRJ-014) | recovered project deep-equal to the dirty one; no write when a recording is active | yes |
| IT-058 | storage unavailable: memory-only mode | M-16, M-29, M-27 | `fakes.indexedDB` open rejects and `fakes.localStorage` throws on access | boot; open `studio`; record and press Save | SCR-MainMenu notice E-STO-005 or E-STO-009; Save offers Export only; nothing claims a successful save | no `project.saved` with `where` other than `export`; the Export file parses | yes |
| IT-059 | WebGL unavailable: Abstract tier still plays | M-18, M-21, M-28 | `Render.init` with a canvas factory whose `getContext` returns null for `webgl2` and `webgl` | enter `quickplay` with `demo-poprock` and play 10 s | tier Abstract with notice E-REN-001; the highway draws on `#flat`; judging and audio normal | `render.tier` `{tier:'Abstract'}` emitted; `lateEvents === 0`; bot judgments perfect | yes |
| IT-060 | settings persist and restore | M-27, M-16, M-07 | `fakes.localStorage` | change one value in every settings group and remap lane 0; reload settings through a new Storage instance; then back up and restore with `Settings.export()` and `Settings.import` | every changed value restored; the remap restored; out-of-range values in an edited backup normalized with W-SET-NORMALIZED | deep equality after reload and after restore | yes |

#### 12.3.2 Phase and specification map

"Phase" is the B 27 phase whose gate first makes the test binding (12.1.5).

| ID | Phase | Specification and invariant references |
|---|---|---|
| IT-001 | 6 | B 25.2 input to audio; B 26.2 |
| IT-002 | 3 | B 25.2 input to audio; B 26.2 keyboard and touch; E 4.1 duplicate pointer and touch events |
| IT-003 | 3 | B 25.2 input to scoring; B 26.2 timing judgments on the musical timeline; I 19 input |
| IT-004 | 3 | B 26.2 calibration affects scoring predictably; B 8.5; S-04 |
| IT-005 | 3 | B 26.2 chords and simultaneous inputs; E 4.1; E 4.2 two notes at one timestamp |
| IT-006 | 7 | B 25.2 imported MIDI to playback; B 26.3 track and note structure, program assignments |
| IT-007 | 7 | B 26.3 tempo changes are respected; E 2.2 multiple tempo changes |
| IT-008 | 7 | B 26.3 polyphonic passages remain polyphonic; E 10 item 4 |
| IT-009 | 7 | B 25.2 imported MIDI to 3D animation; B 26.4 animations respond to actual events |
| IT-010 | 5 | B 26.4 multiple instruments perform simultaneously; B 12.3 |
| IT-011 | 5 | B 26.4 dense passages without blocking audio scheduling; E 6.1 many notes at once |
| IT-012 | 5 | B 26.4 reduced-quality modes preserve the musical event timeline; S-02 |
| IT-013 | 5 | S-01; E 2.2 rendering frame of 100-500 ms |
| IT-014 | 9 | B 25.2 recording to project save and reload; B 26.5 record, save and reopen |
| IT-015 | 9 | B 26.5 previously recorded tracks play during overdubbing; B 16.3 |
| IT-016 | 9 | B 25.2 multitrack playback and mixing; E 5.2 mute during sustain, solo while soloed, volume and pan during playback |
| IT-017 | 9 | E 5.2 multiple tracks produce clipping; B 16.5 |
| IT-018 | 9 | E 5.2 repeated undo, redo after a new edit; I 13 undo and redo |
| IT-019 | 11 | B 25.2 dance chart to scoring; B 26.6 inputs evaluated correctly, deterministic |
| IT-020 | 11 | B 26.6 avatar movement synchronized with the chart; B 14.3 |
| IT-021 | 11 | E 7 choreography asset unavailable; Part 10.7.8 |
| IT-022 | 10 | B 25.2 character customization to saved appearance; B 13.4 |
| IT-023 | 10 | E 6.2 character customized during playback; I 8; Part 10.7.7 |
| IT-024 | 10 | B 13.4; B 18.2 |
| IT-025 | 13 | B 25.2 multiplayer session synchronization; B 26.7 start and position synchronized |
| IT-026 | 13 | B 17.2; B 26.7 |
| IT-027 | 13 | B 26.7 disconnection and reconnection without corrupting local state; E 8.1 |
| IT-028 | 13 | E 13 multiplayer accepts invalid authoritative results; B 17.4; E 8.3 |
| IT-029 | 13 | B 7.7 2-4 players; E 8.1 |
| IT-030 | 13 | B 25.2 offline operation; B 26.1; B 26.7 standalone when multiplayer is unavailable; E 11 rule 5 |
| IT-031 | 13 | B 26.1 optional network failures; Part 10.7.9 |
| IT-032 | 5 | S-06; S-18; B 20.3; P 17 |
| IT-033 | 6 | E 13 stuck notes after changing modes; I 13.1 switch modes while notes are active; E 2.3 |
| IT-034 | 5 | S-03; S-17; E 6.1 long rests |
| IT-035 | 3 | S-04; B 8.5 |
| IT-036 | 12 | S-05; B 23.1; ADR-12 |
| IT-037 | 5 | S-07 |
| IT-038 | 8 | S-08; E 4.2 never silently delete source notes; I 6.2 |
| IT-039 | 4 | S-09; E 2.2 audio and performance clocks diverge |
| IT-040 | 4 | S-10; E 2.2 dense chord |
| IT-041 | 12 | S-11; B 25.3 parsing failures do not crash; E 11 rule 6 |
| IT-042 | 9 | S-12; E 11 rule 3; P 11 |
| IT-043 | 3 | S-13; E 4.1 lifecycle |
| IT-044 | 9 | S-14; E 11 rule 4; I 19 persistence |
| IT-045 | 5 | S-15; B 26.4; E 6.2 device cannot sustain frame rate |
| IT-046 | 4 | S-16; E 11 rule 1 |
| IT-047 | 4 | S-18; E 2.1 initialization attempted more than once |
| IT-048 | 8 | I 6.2; Part 8.10.6 |
| IT-049 | 8 | I 6.3; Part 8.12.3 |
| IT-050 | 8 | Part 8.6.5 D16; I 6.3 |
| IT-051 | 8 | I 6.3; Part 8.12.3 |
| IT-052 | 8 | I 6.3; Part 8.12.3 |
| IT-053 | 10 | B 9.4; I 9; P 5 |
| IT-054 | 9 | E 5.3 two tabs edit the same project; Part 10.7.5 |
| IT-055 | 9 | BRIEF 6 autosave; I 13 autosave at safe points |
| IT-056 | 8 | Part 10.7.10; P 3 |
| IT-057 | 9 | B 21.4; E 5.3 browser closes during a save; Part 10.8 |
| IT-058 | 9 | E 9 storage under local-file execution; Part 10.7.5 |
| IT-059 | 5 | E 6.2 WebGL initialization fails; E 9 graphics feature missing |
| IT-060 | 8 | B 18.1; P 4 |

#### 12.3.3 Coverage of B 25.2 and the Part 4.6 invariants

| Item | Integration tests |
|---|---|
| B 25.2 Input to audio playback | IT-001, IT-002 |
| B 25.2 Input to scoring | IT-003, IT-004, IT-005, IT-043 |
| B 25.2 Imported MIDI to playback | IT-006, IT-007, IT-008 |
| B 25.2 Imported MIDI to 3D animation (controllers receive scheduled events at their audio times) | IT-009, IT-010, IT-034 |
| B 25.2 Recording to project save and reload | IT-014, IT-015, IT-057 |
| B 25.2 Multitrack playback and mixing | IT-016, IT-017, IT-018 |
| B 25.2 Dance chart to scoring | IT-019, IT-020, IT-021 |
| B 25.2 Character customization to saved appearance | IT-022, IT-023, IT-024 |
| B 25.2 Multiplayer session synchronization (loopback pair, two session instances in one page) | IT-025, IT-026, IT-027, IT-028, IT-029 |
| B 25.2 Offline operation without the multiplayer service | IT-030, IT-031, IT-058 |
| S-01 renderer never advances musical time | IT-013 |
| S-02 scoring uses input audio time | IT-012 |
| S-03 animation derives from scheduled events | IT-034, IT-009 |
| S-04 calibration applied once | IT-004, IT-035 |
| S-05 parsers never execute content | IT-036 |
| S-06 full teardown on leave | IT-032, IT-033 |
| S-07 no cross-module state writes | IT-037 |
| S-08 musical data separate from mappings | IT-038 |
| S-09 audio clock is the only master | IT-039 |
| S-10 bounded scheduling | IT-040, IT-011 |
| S-11 imported data untrusted and bounded | IT-041 |
| S-12 import never touches the project until confirmed | IT-042 |
| S-13 inputs stateless with respect to modes | IT-043 |
| S-14 saves report success only after read-back | IT-044 |
| S-15 rendering failure never stops the transport | IT-045, IT-059 |
| S-16 audio failure never destroys project data | IT-046 |
| S-17 visuals never invent activity | IT-034 |
| S-18 one instance of each shared engine | IT-047, IT-032 |

The invariants are also asserted at other levels; 12.7.5 lists every test per invariant.

### 12.4 File-format tests (FT-001..)

Group `files`, `src/92-test-files.js`. One FT test per committed corpus file of Part 8.9.3 and
8.9.4 (89 files), one per in-memory case of Part 8.9.5 (subgroup `limits`, names starting `mem-`;
the decoded-audio case is named `mem-audio-400mb.wav`), three whole-corpus checks in `ident`, and
the writer round trips and export checks of Part 8.11 in `roundtrip`. IDs follow Part 8.9.1:
subgroups in the order `midi`, `midi-damaged`, `limits`, `musicxml`, `security`, `mxl`, `gp`,
`audio`, `ident`, `roundtrip`, and file-name order (ASCII) inside each subgroup. A new corpus file
takes the next free FT number at the end of the table (12.1.7), never a number inside a subgroup.

#### 12.4.1 Pass rules

Every corpus and `mem-` row passes only when the five assertion rules of Part 8.9.1 hold: (1) an
expected error rejects with that code, emits exactly one `import.failed` with the expected stage
and no `import.done`, lets no exception escape and leaves `Project.current()` deep-equal (S-12);
(2) an expected success matches `format`, `songs`, `tracks`, `notes`, `status` and `playable`,
contains every listed warning code and no unlisted warn or error code; (3) the import settles
within 5,000 ms; (4) two imports of the same bytes give deep-equal reports after removing ids,
`importedAt` and timings; (5) files with notes generate charts for the four difficulties that pass
`Mapping.ChartGenerator.validate`, and the Song's fnv1a32 is unchanged by generation (S-08). The
Expected column summarizes the Part 8.9 `expect` object; the manifest entry is the exact
reference. `roundtrip` and `ident` rows state their own criterion in the Expected column.

Supported publication rule (Part 8.7, BCD open issue): a format version is published as
Supported only with at least two valid-file FT rows and one malformed-file FT row passing for it;
otherwise it is published as Partial with "(not yet verified)" (Part 8.7.2 section 5).

#### 12.4.2 Test table

| ID | Test name | Exercises | Expected result | Phase |
|---|---|---|---|---|
| FT-001 | `files.midi.midi-controllers.mid` | B 25.3 controller events; B 11.4; E 3.2 bend, modulation, sustain pedal | tracks 1 (Strings, program 48); notes 9; ControlEvents 45; PitchBendEvents 9; warnings W-MIDI-IGNORED-EVENT, W-MIDI-SYSEX-SKIPPED, W-IMP-CC-NO-PLAYBACK, W-IMP-BEND-RANGE; Partial; check `derivedSustain:[3840,2880,1920,960]` | 7 |
| FT-002 | `files.midi.midi-drums-heavy.mid` | B 25.3 percussion-heavy; E 3.2 percussion channel, missing track name | tracks 1 (`Track 1 (Drums)`, `isDrums`, channel 9); notes 218; title from the file name; Supported; check `drumKeys:35-81 all present` | 7 |
| FT-003 | `files.midi.midi-duplicate-meta.mid` | E 3.1 duplicate or conflicting metadata; E 3.2 duplicated names | tracks 2 (both Guitar); notes 16; tempo [400000]; meter 3/4; warnings W-MIDI-DUPLICATE-META; Partial | 7 |
| FT-004 | `files.midi.midi-empty-and-text-tracks.mid` | E 3.1 empty track, metadata-only track | tracks 2 (Lyrics with 9 TextEvents and `playable:false`, Melody 8 notes); notes 8; warnings W-MIDI-TEXT-ONLY-TRACK; Supported | 7 |
| FT-005 | `files.midi.midi-format2.mid` | E 3.1 format 2 independent sequences | songs 3 (Pattern A, B, C); selected song 0: tracks 1, notes 16; warnings W-MIDI-FORMAT2; Conversion; check `songNotes:[16,12,32]` | 7 |
| FT-006 | `files.midi.midi-meter-key-changes.mid` | E 3.2 meter and key changes mid-song | tracks 1; notes 58; meter map at 0, 7680, 13440, 19200, 28800, 35520; key map at 0, 13440, 19200, 28800; durationTicks 42480; Supported; checks `barAt:39360=11`, `keyNames` | 7 |
| FT-007 | `files.midi.midi-mono-running-status.mid` | E 3.1 running status; velocity-0 note-off | as midi-mono-simple.mid; checks `sameNotesAs:midi-mono-simple.mid` and every `offVelocity` 0 | 7 |
| FT-008 | `files.midi.midi-mono-simple.mid` | B 25.3 simple monophonic; E 3.1 format 0 | tracks 1 (Mono); notes 32 at ticks 960k, durTicks 960; durationTicks 30720; tempo [500000]; 4/4; C major; no warnings; Supported; check `noteList` | 7 |
| FT-009 | `files.midi.midi-multi-program-channel.mid` | E 3.2 multiple program changes; several instruments on one channel | tracks 4 (Changes with ProgramEvents at 7680 and 15360, Combo (ch 2), Combo (ch 3), Shared); notes 48; warnings W-MIDI-MULTI-CHANNEL; Supported | 7 |
| FT-010 | `files.midi.midi-multitrack-band.mid` | B 25.3 multitrack; E 3.1 format 1 | tracks 4 (Bass, Guitar, Keys, Drums); notes 240; programs 33, 29, 0, 0; `isDrums` only on Drums; key G major; Supported; check `trackNotes:[32,64,48,96]` | 7 |
| FT-011 | `files.midi.midi-no-eot-no-meta.mid` | E 3.1 missing EOT; E 3.2 tempo not defined (documented defaults) | tracks 1 (`Track 1 (Acoustic Grand Piano)`); notes 8; warnings W-MIDI-NO-EOT, W-MIDI-NO-TEMPO, W-MIDI-NO-METER, W-MIDI-NO-KEY, W-MIDI-NO-PROGRAM; Supported; checks tempo and meter source `default` | 7 |
| FT-012 | `files.midi.midi-poly-chords.mid` | B 25.3 polyphonic; B 3.5 | tracks 1 (Piano); notes 240; durationTicks 61440; Supported; checks `polyphonyMax:5`, `maxChord:5` | 7 |
| FT-013 | `files.midi.midi-ppq-97.mid` | E 3.1 unusual PPQ; exact rescaling | tracks 1; notes 14; quarters at 960k, durTicks 960; pitch-72 notes at ticks 10 and 475 with durTicks 237 and 238; warnings W-MIDI-TICK-ROUNDING (info); Supported | 7 |
| FT-014 | `files.midi.midi-same-tick-tracks.mid` | E 3.1 identical pitches simultaneous; same timestamps in different tracks | tracks 2; notes 33; warnings W-NOTE-OVERLAP, W-NOTE-OFF-WITHOUT-ON; Partial; check `unison` | 7 |
| FT-015 | `files.midi.midi-smpte-25.mid` | E 3.1 SMPTE timing | tracks 1; notes 20 at model ticks 960k with durTicks 768; tempo map one default entry 500000; warnings W-MIDI-SMPTE, W-MIDI-SMPTE-TEMPO-IGNORED; Conversion | 7 |
| FT-016 | `files.midi.midi-tempo-changes.mid` | B 25.3 tempo changes; E 3.2; B 26.3 | tracks 1; notes 48; tempo map 6 entries at model ticks 0, 7680, 15360, 23040, 30720, 38400; durationTicks 45600; Supported; check `seconds:45600=26.911904` within 1e-6 | 7 |
| FT-017 | `files.midi.midi-text-markers.mid` | B 15.2 names and metadata; markers; lyrics; conductor folding | tracks 1 (Vocal); notes 8; markers 3 sections and 1 cue; title Marker Song; artist Corpus Band; copyright TextEvent; warnings W-MIDI-SEQ-SPECIFIC, W-MIDI-UNKNOWN-META; Supported; checks `lyrics:8`, `instrumentText:Voice` | 7 |
| FT-018 | `files.midi.midi-trailing-events.mid` | E 3.2 final event after the last note | tracks 1; notes 16; durationTicks 26880; Supported | 7 |
| FT-019 | `files.midi.midi-unknown-chunk.mid` | E 3.1 structure validation | tracks 1; notes 8; warnings W-MIDI-UNKNOWN-CHUNK, W-MIDI-TRAILING-BYTES; Supported | 7 |
| FT-020 | `files.midi.midi-unmatched.mid` | E 3.1 unmatched note-on and note-off; E 2.3 | tracks 1; notes 6 with the exact (pitch, tick, durTicks) list of Part 8.9.3; warnings W-NOTE-UNMATCHED (3), W-NOTE-OFF-WITHOUT-ON (3), W-NOTE-OVERLAP (1); Partial | 7 |
| FT-021 | `files.midi.midi-velocity-range.mid` | E 3.2 unusual velocities; notes outside an instrument range | tracks 1; notes 5 with pitches and velocities (0, 1), (1, 2), (60, 64), (126, 126), (127, 127); Supported | 7 |
| FT-022 | `files.midi.midi-zero-duration.mid` | E 3.1 zero-duration notes | tracks 1; notes 8; the last 4 have durTicks 1; warnings W-NOTE-ZERO-DURATION (4); no W-NOTE-UNMATCHED or W-NOTE-OFF-WITHOUT-ON; Supported | 7 |
| FT-023 | `files.midi-damaged.midi-mono-simple.bad-data.mid` | invalid data byte | notes 31; warnings W-MIDI-BAD-DATA, W-NOTE-OFF-WITHOUT-ON; Partial | 7 |
| FT-024 | `files.midi-damaged.midi-mono-simple.bad-hlen.mid` | bad header length | error E-IMP-003 (MIDI header is too short.), stage parse | 7 |
| FT-025 | `files.midi-damaged.midi-mono-simple.bad-magic.mid` | E 3.1 invalid header | error E-IMP-003 (named like a MIDI file), stage identify | 7 |
| FT-026 | `files.midi-damaged.midi-mono-simple.bad-status.mid` | E 3.1 invalid event status byte | notes 8; warnings W-MIDI-BAD-STATUS; Partial | 7 |
| FT-027 | `files.midi-damaged.midi-mono-simple.bad-vlq.mid` | E 3.1 bad variable-length quantity | notes 8; warnings W-MIDI-BAD-VLQ; no W-MIDI-NO-EOT; Partial | 7 |
| FT-028 | `files.midi-damaged.midi-mono-simple.format3.mid` | bad header format | error E-IMP-003 (MIDI format 3 is not 0, 1 or 2.), stage parse | 7 |
| FT-029 | `files.midi-damaged.midi-mono-simple.huge-length.mid` | E 3.1 invalid track length (too long) | notes 32; warnings W-MIDI-TRUNCATED; Partial | 7 |
| FT-030 | `files.midi-damaged.midi-mono-simple.ppq0.mid` | bad division | error E-IMP-003 (PPQ is zero.), stage parse | 7 |
| FT-031 | `files.midi-damaged.midi-mono-simple.short-length.mid` | E 3.1 invalid track length (too short) | notes 7; warnings W-MIDI-UNKNOWN-CHUNK, W-MIDI-TRUNCATED, W-MIDI-NO-EOT; Partial | 7 |
| FT-032 | `files.midi-damaged.midi-mono-simple.trunc-12.mid` | E 3.1 missing header | error E-IMP-003, stage parse | 7 |
| FT-033 | `files.midi-damaged.midi-mono-simple.trunc-128.mid` | E 3.1 truncated file | notes 8; warnings W-MIDI-TRUNCATED; Partial | 7 |
| FT-034 | `files.midi-damaged.midi-mono-simple.trunc-131.mid` | E 3.1 truncated variable-length quantity | notes 9 (the 9th with durTicks 1); warnings W-MIDI-TRUNCATED, W-NOTE-UNMATCHED; Partial | 7 |
| FT-035 | `files.midi-damaged.midi-mono-simple.trunc-20.mid` | truncated before the first chunk | songs 1; tracks 0; notes 0; warnings W-MIDI-TRAILING-BYTES, W-MIDI-TRACK-COUNT, W-IMP-NO-NOTES; Partial; `playable:false` | 7 |
| FT-036 | `files.limits.mem-1000001-events.mid` | BRIEF 6 events <= 1,000,000; S-11 | error E-IMP-004, stage parse, raised before `pairNotes` runs | 7 |
| FT-037 | `files.limits.mem-10001-measures.musicxml` | MusicXML 10,000 measures per part | error E-IMP-004, stage parse | 12 |
| FT-038 | `files.limits.mem-101mb.wav` | audio file <= 100 MB | error E-IMP-001, stage validate, before the content is read | 7 |
| FT-039 | `files.limits.mem-129-mtrk.mid` | tracks <= 128 | error E-IMP-004, stage parse | 7 |
| FT-040 | `files.limits.mem-129-parts.musicxml` | MusicXML parts <= 128 | error E-IMP-004, stage parse | 12 |
| FT-041 | `files.limits.mem-1m-events.mid` | exactly 1,000,000 events accepted | resolves; notes 500,000; settle time recorded (desktop target within the 5 s budget, PT-014 gates it; headless value info) | 7 |
| FT-042 | `files.limits.mem-26mb.mid` | file <= 25 MB | error E-IMP-001, stage validate, before the content is read | 7 |
| FT-043 | `files.limits.mem-audio-400mb.wav` | decoded audio cap (192 MB desktop, 64 MB touch) | fake decoder `FLM.SelfTest.fakes.audioDecoder` returns 400 MB: error E-IMP-004 | 7 |
| FT-044 | `files.limits.mem-budget.mid` | 5 s parse budget then abort | `midi-large-100k.mid` bytes with `{budgetMs:0}`: error E-IMP-005, stage parse | 7 |
| FT-045 | `files.limits.mem-cancel.mid` | user cancel | `Import.cancel()` after the first progress event: error E-IMP-011; `Import.isRunning() === false` afterwards | 7 |
| FT-046 | `files.limits.mem-repeat-bomb.musicxml` | 40,000 expanded measures cap | resolves; warnings W-XML-REPEAT-CAP; Partial | 12 |
| FT-047 | `files.limits.midi-40-tracks.mid` | tracks beyond 32; explicit selection (B 3.5) | before selection tracks 32, overflow 8, W-IMP-TRACKS-OVER-32, Supported; check `afterSelection`: tracks 32, notes 2,614, W-IMP-TRACKS-DROPPED naming Parts 32-39, status Partial | 7 |
| FT-048 | `files.limits.midi-huge-ntrks.mid` | E 3.1 huge counts; limits before allocation | error E-IMP-004, stage parse | 7 |
| FT-049 | `files.limits.midi-large-100k.mid` | B 25.3 large files; E 3.1 large event counts; time slicing | tracks 16; notes 100,000; durationTicks 1,500,000; one `isDrums` track; Supported; checks `stats.yields >= 10`, `settledMs < 5000` | 7 |
| FT-050 | `files.musicxml.xml-basic-partwise.musicxml` | B 25.3 valid MusicXML; E 3.3 baseline | tracks 1 (Piano, program 0, channel 0); notes 23; durationTicks 26880; tempo [600000]; key fifths 1; title Basic Score; artist Corpus Composer; version `MusicXML 3.1 (partwise), make-corpus`; no warnings; Conversion | 12 |
| FT-051 | `files.musicxml.xml-basic-partwise.trunc-half.musicxml` | truncated XML | error E-IMP-015, stage parse | 12 |
| FT-052 | `files.musicxml.xml-basic-timewise.musicxml` | timewise variant | as xml-basic-partwise.musicxml with the timewise version string; check `sameNotesAs:xml-basic-partwise.musicxml` | 12 |
| FT-053 | `files.musicxml.xml-chords-ties-tuplets.musicxml` | E 3.3 chords and ties across measures, tuplets, grace notes | tracks 1; notes 21; tied chord notes durTicks 2880; A4 durTicks 3840 at 9600; triplets at 5760, 6080, 6400 (320 each); quintuplets at 7680 + 192k; graces at 16080 and 16200 before E5 at 16320; Conversion | 12 |
| FT-054 | `files.musicxml.xml-expression.musicxml` | B 15.3 tempo markings, articulation, dynamics; lyrics; pedal | tracks 1; notes 16 with the Part 8.9.3 velocity list; note 2 durTicks 480; note 10 durTicks 240; tempo [833333 at 0, 666667 at 7680]; markers A and B; CC 64 127 at 3840 and 0 at 6720; 16 lyric TextEvents; warnings W-XML-LYRIC-LINES; Partial | 12 |
| FT-055 | `files.musicxml.xml-malformed.musicxml` | E 3.1 malformed files (XML) | error E-IMP-015, stage parse | 12 |
| FT-056 | `files.musicxml.xml-no-notes.musicxml` | E 3.3 valid file with no playable events | tracks 1; notes 0; durationTicks 0; warnings W-IMP-NO-NOTES; Conversion; `playable:false` with the Part 8.9.3 reason text | 12 |
| FT-057 | `files.musicxml.xml-not-a-score.xml` | identification of non-scores | error E-IMP-002 (named like MusicXML but no score element), stage identify | 12 |
| FT-058 | `files.musicxml.xml-opus.xml` | unsupported container kind | error E-IMP-006 (opus text), stage parse | 12 |
| FT-059 | `files.musicxml.xml-parts-voices-staves.musicxml` | E 3.3 multiple parts, voices and staves; unpitched percussion | tracks 4; notes 52; channels 0, 1, 2, 9; programs 0, 73, 40; Drums `isDrums` with pitches 36 and 38 only; Conversion | 12 |
| FT-060 | `files.musicxml.xml-repeats-endings.musicxml` | E 3.3 repeats and alternate endings | tracks 1; notes 12 with pitches 60, 62, 60, 62, 64, 65, 64, 67, 69, 69, 69, 71 at ticks 3840k; durationTicks 46080; Conversion | 12 |
| FT-061 | `files.musicxml.xml-transposing.musicxml` | E 3.3 transposing instruments; octave shifts | tracks 4; notes 16; pitches Clarinet 70 x4, Horn 65 x4, Guitar 52 x4, Piano 96, 96, 84, 84; warnings W-XML-TRANSPOSED; Conversion | 12 |
| FT-062 | `files.musicxml.xml-unsupported.musicxml` | E 3.3 unsupported features reported; B 25.3 | tracks 1; notes 15; the 12 warning codes of Part 8.9.3 (W-XML-HARMONY-IGNORED to W-XML-FERMATA-IGNORED); Partial | 12 |
| FT-063 | `files.security.mxl-ratio-bomb.mxl` | B 23.1 decompression bomb | error E-IMP-004 (suspicious compression ratio), stage identify; `Zip.extract` never called | 12 |
| FT-064 | `files.security.xml-entity-expansion.musicxml` | B 23.1 untrusted XML; S-05 | error E-IMP-014, stage parse; no expansion performed | 12 |
| FT-065 | `files.security.xml-script-text.musicxml` | B 23.1 imported text never executed; ADR-12 | tracks 1; notes 4; title is the literal `<script>` text; Conversion; check `noExecution` (`window.__pwned === undefined`, no element created from file text in `#overlay`) | 12 |
| FT-066 | `files.mxl.mxl-deflate.mxl` | own inflate on real data | as mxl-stored.mxl; check `sameNotesAs:xml-basic-partwise.musicxml` | 12 |
| FT-067 | `files.mxl.mxl-missing-rootfile.mxl` | container pointing nowhere | error E-IMP-007, stage parse | 12 |
| FT-068 | `files.mxl.mxl-no-container.mxl` | container fallback | as xml-basic-partwise.musicxml with warnings W-XML-MXL-NO-CONTAINER | 12 |
| FT-069 | `files.mxl.mxl-stored.bad-crc.mxl` | damaged archive data | error E-IMP-003 (failed its CRC check), stage parse | 12 |
| FT-070 | `files.mxl.mxl-stored.encrypted.mxl` | encrypted ZIP | error E-IMP-006 (Encrypted ZIP archives are not supported.), stage identify | 12 |
| FT-071 | `files.mxl.mxl-stored.mxl` | B 15.3 compressed container; E 3.3 | as xml-basic-partwise.musicxml with `container:'mxl'`; check `sameNotesAs:xml-basic-partwise.musicxml` | 12 |
| FT-072 | `files.mxl.mxl-stored.trunc-eocd.mxl` | truncated ZIP | error E-IMP-003 (no end-of-central-directory record), stage identify | 12 |
| FT-073 | `files.mxl.zip-without-score.mxl` | ZIP that is not MusicXML | error E-IMP-002 (does not contain a MusicXML score), stage identify | 12 |
| FT-074 | `files.gp.gp2-unsupported.gtp` | B 15.4 no universal support; E 3.3 unsupported version | error E-IMP-006 (text contains Guitar Pro 1 or 2), stage parse | 12 |
| FT-075 | `files.gp.gp3-basic.gp3` | B 25.3 valid GP per claimed version (v3.00) | tracks 1 (Guitar, program 25); notes 32; tempo [500000]; version `GP3 v3.00`; Conversion; checks `tab`, `cc0:[103, 63]` | 12 |
| FT-076 | `files.gp.gp4-basic.gp4` | GP4 v4.06; repeats; lyrics | tracks 1; notes 40; durationTicks 38400; 4 lyric TextEvents; version `GP4 v4.06`; Conversion | 12 |
| FT-077 | `files.gp.gp4-l406.gp4` | claimed version L4.06 | as gp4-basic.gp4 with version `GP4 L4.06` | 12 |
| FT-078 | `files.gp.gp4-v400.gp4` | claimed version v4.00 | as gp4-basic.gp4 with version `GP4 v4.00` | 12 |
| FT-079 | `files.gp.gp5-basic.bad-strings.gp5` | desynchronized or damaged layout | error E-IMP-003 with `.offset` equal to the string-count field offset, stage parse | 12 |
| FT-080 | `files.gp.gp5-basic.gp5` | GP5 v5.10; markers; mix-table tempo | tracks 2; notes 192; tempo [500000 at 0, 428571 at 30720]; markers Verse at 0, Chorus at 30720; durationTicks 61440; version `GP5 v5.10`; Conversion | 12 |
| FT-081 | `files.gp.gp5-basic.huge-measures.gp5` | huge counts | error E-IMP-004, stage parse | 12 |
| FT-082 | `files.gp.gp5-basic.trunc-header.gp5` | file ends inside the header | error E-IMP-003 (ends inside its header), stage parse | 12 |
| FT-083 | `files.gp.gp5-basic.trunc-measure9.gp5` | E 3.3 truncated GP | tracks 2; notes 96; markers 2; tempo [500000]; durationTicks 30720; warnings W-GP-TRUNCATED (measure 9 of 16); Partial | 12 |
| FT-084 | `files.gp.gp5-drums-mix-directions.gp5` | drums; mix changes; triplet feel; directions | tracks 2; notes 128; Drums `isDrums` channel 9; Guitar ProgramEvent 30, CC 7 = 79, CC 10 = 31 at 15360; tempo [500000, 600000 at 15360]; warnings W-GP-TEMPO-RAMP-IGNORED, W-GP-TRIPLET-FEEL, W-GP-NAV-UNSUPPORTED; Partial | 12 |
| FT-085 | `files.gp.gp5-effects.gp5` | B 15.4 effects; E 3.3 unsupported effects; GP5 v5.00 | tracks 1; notes 33; harmonic pitches 76 and 83; warnings W-GP-HARMONIC-APPROX, W-GP-TRILL-UNSUPPORTED, W-GP-TREMOLO-PICKING, W-GP-DURATION-PERCENT; version `GP5 v5.00`; Partial; checks `bendBeat1`, `art` | 12 |
| FT-086 | `files.gp.gp5-repeats.gp5` | GP5 repeat count and alternative endings | tracks 1; notes 11 with pitches 64, 66, 64, 66, 64, 66, 67, 69, 67, 71, 72 at ticks 3840k; durationTicks 42240; Conversion | 12 |
| FT-087 | `files.gp.gp5-tuning-capo.gp5` | E 3.3 alternate tuning and capo; 7 strings | tracks 4; notes 64; check `pitches`: Drop D string 6 = 38, Capo 3 string 1 = 67, Seven string 7 = 35, Twelve string 1 = 64; Conversion | 12 |
| FT-088 | `files.gp.gp6-file.gpx` | GP6 identification (Unsupported) | error E-IMP-006 (text contains Guitar Pro 6 or 7), stage identify | 12 |
| FT-089 | `files.gp.gp7-file.gp` | GP7 identification (Unsupported) | error E-IMP-006 (text contains Guitar Pro 6 or 7), stage identify | 12 |
| FT-090 | `files.audio.audio-garbage.mp3` | E 3.4 corrupted audio | error E-IMP-008, stage parse | 7 |
| FT-091 | `files.audio.audio-garbage.ogg` | E 3.4 corrupted audio | error E-IMP-008, stage parse | 7 |
| FT-092 | `files.audio.audio-lead-silence.wav` | E 3.4 silence at the beginning | as audio-sine-1s.wav plus W-AUD-LEADING-SILENCE; checks `leadingSilenceMs` in 495-502, `alignStart` within 0.002 s of 0.5 | 7 |
| FT-093 | `files.audio.audio-sine-1s.wav` | B 15.5 audio becomes an audio track only | tracks 1 (`kind:'audio'`); notes 0; `playable:false`; warnings W-AUD-NO-TEMPO, W-AUD-NO-SPEED-CHANGE, W-AUD-NOT-PERSISTED; Conversion; checks `audioDuration`, `noBufferInJson`, `audioSentence`, `releaseAudio` | 7 |
| FT-094 | `files.audio.audio-unknown-codec.wav` | E 3.4 unsupported codec | error E-IMP-008, stage parse | 7 |
| FT-095 | `files.ident.compat-table` | Part 8.7.1 published matrix equals the data object | `FLM.Import.COMPATIBILITY` equals the frozen copy of the Part 8.7.1 table field by field (formats, versions, statuses, limits) | 12 |
| FT-096 | `files.ident.empty.mid` | empty file | error E-IMP-003 (The file is empty.), stage validate | 7 |
| FT-097 | `files.ident.manifest-count` | corpus completeness | `test-corpus/MANIFEST.json` lists 89 files (68 base, 21 variants); every fnv1a32 matches the injected bytes | 7 |
| FT-098 | `files.ident.midi-named-as.xml` | extension mismatch | as midi-mono-simple.mid plus W-IMP-EXT-MISMATCH; Supported | 7 |
| FT-099 | `files.ident.project-file.json` | project file dropped on the import screen | error E-IMP-002 (project text), stage identify | 9 |
| FT-100 | `files.ident.report-fields` | I 6.1 inspection report contract (Part 8.10.2) | every report field of Part 8.10.2 populated (non-null where the format provides it) for midi-multitrack-band.mid, xml-basic-partwise.musicxml, gp5-basic.gp5 and audio-sine-1s.wav | 12 |
| FT-101 | `files.ident.riff-midi.rmi` | refused RIFF MIDI | error E-IMP-006 (rmi text), stage identify | 7 |
| FT-102 | `files.ident.soundfont.sf2` | refused SoundFont | error E-IMP-006 (SoundFont text), stage identify | 7 |
| FT-103 | `files.ident.unknown-random.bin` | unknown format | error E-IMP-002, stage identify | 7 |
| FT-104 | `files.roundtrip.character-cycle` | B 13.4 character preset export and import | every built-in preset through `Character.exportPreset` and `Character.importPreset`: appearance fields deep-equal; `id`, `slot`, `instrument` not part of a preset | 10 |
| FT-105 | `files.roundtrip.dance-cycle` | B 15.6; dance chart file | normal chart of `demo-dance` through `Dance.exportChart` and `Dance.importChart`: steps deep-equal; import onto another song shows the Part 5.14.2 notice and keeps the steps; a file above 2 MB or 20,000 steps is refused (UT-23-29 codes) | 11 |
| FT-106 | `files.roundtrip.diag-export` | B 24; I 13.2 bug report | `Core.Diagnostics.export()` after a session with 600 log entries: bytes <= 204,800, oldest entries dropped first, no song content, no file names of imported files unless Attach the file is ticked | 1 |
| FT-107 | `files.roundtrip.mid-corpus` | B 15.6 MIDI export; B 26.5 exported formats pass validation | import midi-poly-chords.mid, midi-multitrack-band.mid, midi-meter-key-changes.mid, midi-controllers.mid, midi-text-markers.mid, gp5-basic.gp5, xml-expression.musicxml; `Midi.write`; `Midi.parse`; equal per the Part 5.14.1 table after stripping ids (the GP and MusicXML sources join at the Phase 12 gate) | 9 |
| FT-108 | `files.roundtrip.mid-empty` | export failure handling (I 13 failed exports) | `Midi.write` of a song with only an audio track rejects with E-EXP-001; the project is unchanged | 9 |
| FT-109 | `files.roundtrip.mid-fixpoint` | writer stability | for each mid-corpus song: `w2 = write(parse(write(song)))` and `w3 = write(parse(w2))` are byte-equal | 9 |
| FT-110 | `files.roundtrip.mid-take` | B 15.6 MIDI performance export | a 64-note take recorded in a FakeClock Studio session, exported and re-imported: notes equal | 9 |
| FT-111 | `files.roundtrip.project-cycle` | B 18.2, B 18.3; P 16 | project from midi-multitrack-band.mid plus 2 takes, 3 characters, 1 dance chart, mixer and settings changes and an unknown field under `x`: serialize, parse, serialize byte-equal and deep-equal; 10 save and load cycles through Storage with the fake database byte-equal; unknown field kept | 9 |
| FT-112 | `files.roundtrip.project-limits` | Part 10.1.2 project JSON limits | text above 64 MB, nesting depth 33 and 5,000,001 containers each rejected with E-PRJ-010 before `JSON.parse`; a project with 33 tracks rejected with E-PRJ-009; a `version` 2 project rejected with E-PRJ-002; a version 0 document with the UT-15-14 test-hook migration loads through `migrate` on a clone and the input text is unchanged | 9 |
| FT-113 | `files.roundtrip.settings-cycle` | settings backup | non-default values in every group exported with `Settings.export()` and imported: deep-equal after normalization; an out-of-range value normalized with W-SET-NORMALIZED | 8 |
| FT-114 | `files.roundtrip.wav-header` | B 11.5 mix export | `Audio.renderWav` of a 3 s project: RIFF PCM 16-bit stereo 48 kHz; `dataBytes === frames * 4`; duration within 1 ms; RMS above 0; peak <= 1.0 | 9 |

#### 12.4.3 Subgroup ranges and B 25.3 coverage

| Subgroup | IDs | Count |
|---|---|---|
| `midi` | FT-001..FT-022 | 22 |
| `midi-damaged` | FT-023..FT-035 | 13 |
| `limits` | FT-036..FT-049 | 14 |
| `musicxml` | FT-050..FT-062 | 13 |
| `security` | FT-063..FT-065 | 3 |
| `mxl` | FT-066..FT-073 | 8 |
| `gp` | FT-074..FT-089 | 16 |
| `audio` | FT-090..FT-094 | 5 |
| `ident` | FT-095..FT-103 | 9 |
| `roundtrip` | FT-104..FT-114 | 11 |

| B 25.3 item | FT tests |
|---|---|
| Simple monophonic MIDI | FT-008, FT-007 |
| Polyphonic MIDI | FT-012 |
| Multitrack MIDI | FT-010, FT-047 |
| Percussion-heavy MIDI | FT-002 |
| MIDI with tempo changes | FT-016 |
| MIDI with controller events | FT-001 |
| Valid MusicXML | FT-050, FT-052, FT-053, FT-059, FT-060, FT-061, FT-054, FT-071, FT-066 |
| Valid Guitar Pro for each claimed version | FT-075, FT-078, FT-076, FT-077, FT-085, FT-080 |
| Malformed files | FT-025, FT-024, FT-028, FT-030, FT-027, FT-026, FT-023, FT-029, FT-055, FT-063, FT-069, FT-070, FT-079, FT-081, FT-094, FT-090, FT-091 |
| Truncated files | FT-032, FT-035, FT-033, FT-034, FT-031, FT-051, FT-072, FT-083, FT-082 |
| Large files | FT-049, FT-048, FT-042, FT-038, FT-036, FT-039, FT-041, FT-040, FT-037, FT-046, FT-044, FT-043 |
| Files containing unsupported features | FT-001, FT-062, FT-085, FT-084, FT-074, FT-088, FT-089, FT-101, FT-102, FT-058 |
| Writer round trips (B 15.6, B 26.5) | FT-107, FT-110, FT-109, FT-111, FT-105, FT-104, FT-113, FT-114 |

B 25.3 last sentence (unsupported data reported, failures never crash) is rule (1) and (2) of
12.4.1 applied to every row, plus IT-041 (all malformed files in one session) and FI-030
(truncation sweep). The capture export (`capture-smoke`, Part 8.11.1) is real-time and belongs to
12.8 and 12.9.

### 12.5 Timing tests (TT-001..)

Group `timing`, `src/92-test-timing.js`. Rows marked Slow run only with `--slow` (Part 3.4.1)
and at the phase gates of 12.1.5 rule 6. Harnesses: "FakeClock transport" is
`Transport.create({clock: fakes.clock(), bus})` with the Scheduler's `pullDue` read directly;
"offline engine" is `createEngine({context: OfflineAudioContext, clock})` of Part 6.5.4.10 with
onset detection by the first sample above 0.01 after the expected time; "real clock" is the
live `AudioContext`. Every assertion uses scheduled audio times or rendered sample positions,
never wall-clock observation of sound (Part 9.1.1 item 7).

| ID | Title | Harness and setup | Procedure | Pass criterion | Slow | Phase | Specification |
|---|---|---|---|---|---|---|---|
| TT-001 | scheduled onset precision, 1,000 notes offline | offline engine (Part 6.5.4.10): `OfflineAudioContext(1, 48000 * 30, 48000)`, FakeClock; generated song of 1,000 notes (16th notes at 133 BPM, pitches 48-84, `Prng(0xF1A9)`), program 80 (square lead, sharp attack) | drive `scheduler.tickOnce` every 25 ms of fake time; render; detect each onset as the first sample above 0.01 after its expected time | every onset within one render quantum plus 1 ms (3.67 ms at 48 kHz) of `audioTimeAt(tick)`; the scheduled `at` equals `audioTimeAt(tick)` exactly (no rounding beyond float precision) | no | 4 | B 25.4 scheduled audio-event timing; BRIEF 6 scheduling precision; S-09 |
| TT-002 | onset precision is sample-rate independent | as TT-001 at 44,100 Hz and 22,050 Hz, 200 notes each | render both and detect onsets | onsets within one render quantum plus 1 ms at each rate; the list of `at` values identical across rates | no | 4 | B 25.4; UT-05-29 |
| TT-003 | real-clock scheduling error and late events | real `AudioContext` (autoplay flag); `instrument` mode, `demo-electro` Arp expert, chart bot; harness `sched.noteOn` listener | play 30 s | max abs(`at` - `Transport.audioTimeAt(tick)`) <= 1.0 ms over all non-clamped events; `lateEvents === 0`; `at - ctx.currentTime` at emission <= 0.125 s | no | 4 | B 25.4; Part 9.1.2 rows 12 and 14 |
| TT-004 | no cumulative drift over a 10-minute loop, offline accelerated | offline engine with `OfflineAudioContext(1, 16000 * 600, 16000)`; generated click song at 120 BPM, 4-bar loop of 8 s with a click on the loop start; FakeClock advanced in 25 ms steps | schedule 75 loop passes through `scheduler.tickOnce`; render; detect the click onset of every pass | max over passes N of abs((onset N - onset 1) - (N - 1) x 8.000 s) < 2 ms; scheduled `at` of pass N equals `at` of pass 1 + (N - 1) x 8 s within 1e-6 s | yes | 4 | B 25.4 looping; BRIEF 6 drift < 2 ms after 10 min; S-09; E 13 timing drifts |
| TT-005 | no cumulative drift with jittered scheduler ticks | FakeClock transport and scheduler (no rendering); 4-bar loop of 8 s; tick intervals drawn from 10-90 ms by `Prng(7)` | advance 600 s of fake time with jittered ticks; record the wrap audio time of each pass | abs(wrap N - (wrap 1 + (N - 1) x 8 s)) < 2 ms for every pass; the item sequence equals the sequence with fixed 25 ms ticks | no | 2 | E 2.2 throttled timers; UT-04-20 companion |
| TT-006 | pause and resume do not shift the timeline | FakeClock transport and offline engine; 120 BPM song with a note on every beat | play to tick 9600 (5 s); pause; advance 2 s; resume; render 5 s more | position at resume equals 9600 (no tick lost or added); the first note after resume starts at `audioTimeAt(9600)` re-anchored at resume time + 0.05 s; no note duplicated or skipped | no | 2 | B 25.4 pause and resume; B 26.3 |
| TT-007 | pause during a sustained note | offline engine; note pitch 60 from tick 0 lasting 8 beats; next note at beat 9 | pause at beat 4; resume after 1 s | the sustained note gets a release at the pause time (soft panic, fade per UT-05-25) and is not restarted at resume (cursor from the frozen tick); the beat-9 note starts at its re-anchored time within 1 ms | no | 2 | E 2.2 pause during a sustained note |
| TT-008 | fifty pause and resume cycles accumulate no error | FakeClock transport | 50 cycles of play 0.7 s, pause 0.3 s at random positions (`Prng(50)`) | after the 50th resume the position equals the sum of played durations converted to ticks, within 1 tick; no `sched` item is emitted while paused | no | 2 | B 26.3 no cumulative drift; E 2.1 repeated start and stop |
| TT-009 | seek while notes are active | offline engine; 4-track song with sustained notes | while 6 notes sound, `seek` to bar 9 | one `sched.noteOff` with `reason:'seek'` per sounding note before any new note; the first event at or after bar 9 starts at `audioTimeAt` of its tick under the new anchor; no event with tick < bar 9 is emitted after the seek | no | 2 | B 25.4 seeking; E 2.2 seek while notes are active |
| TT-010 | seek while stopped, then play | FakeClock transport | seek to tick 7680 while stopped; play; stop | play starts from 7680 with the count-in before it; stop returns to 7680 (Part 6.4.4.3) | no | 2 | B 25.4 seeking |
| TT-011 | loop boundary with a sustained note | offline engine; loop [bar 1, bar 3); a note starting in bar 2 lasting 2 bars | play 3 passes | the note's release lands exactly at each wrap time (`endAudio` clamped to `wrapAudio`); it is not retriggered at the start of the next pass | no | 2 | B 25.4 looping; E 2.2 loop boundary during a sustained note |
| TT-012 | event exactly on the loop end is never played while looping | FakeClock transport; loop [0, 7680); a note at tick 7680 | play 4 passes; disable the loop during pass 5 | the tick-7680 note is emitted 0 times during passes 1-4 and once after the loop is disabled | no | 2 | E 2.2 event exactly on a loop boundary; UT-04-18 |
| TT-013 | event exactly on the loop start plays every pass | FakeClock transport; loop [1920, 9600); a note at tick 1920 | play 5 passes | the note is emitted once per pass at that pass's `wrapAudio` (pass 1 at `audioTimeAt(1920)`); 5 emissions | no | 2 | E 2.2 event exactly on a loop boundary; UT-04-19 |
| TT-014 | tempo change during playback | offline engine; corpus `midi-tempo-changes.mid` | render the whole song; also a note spanning the bar-5 tempo change | every onset within one render quantum plus 1 ms of the TempoMap time; the spanning note's release at `ticksToSeconds(end)` computed through both segments | no | 7 | B 25.4 tempo changes; E 2.2 tempo change during playback |
| TT-015 | ritardando of the piano demo | offline engine; `demo-piano` (tempo entries at bars 29 to 32: 73, 70, 67, 64 BPM) | render bars 28 to 32 | beat onsets follow the four tempo segments within 1 ms of the TempoMap; total duration equals `ticksToSeconds(durationTicks)` within 1 ms | no | 4 | E 2.2 multiple tempo changes |
| TT-016 | meter change keeps beat and click positions | FakeClock transport with metronome on; `demo-jazz` (4/4 to 3/4 at bars 17 and 49) | play across bars 15 to 26 | `sched.beat` reports numerator 3 from bar 17 and 4 from bar 25; accents on every bar start; click spacing equals one beat of the current tempo | no | 4 | B 10.5; E 3.2 time signature changes mid-song |
| TT-017 | speed change while playing | real clock; `instrument` mode playing at 1.0x | set speed 0.75 at a random beat, then 1.25 four beats later | position continuous at each change (no jump > 1 tick); events pulled after a change are spaced by beat duration / speed; events already inside the 120 ms lookahead keep their times (Part 6.4.4.7) | no | 4 | E 2.2 playback speed changes while playing |
| TT-018 | speed preserves pitch | offline engine; one 440 Hz synth note (program 80) at speeds 0.5, 1.0 and 1.5 | render each and compute the spectral peak and the onset | spectral peak within 1 Hz of 440 Hz at each speed; onset at `audioTimeAt(tick)` for that speed within 1 ms (Part 8.12.3) | no | 8 | I 6.3 slow playback while preserving pitch |
| TT-019 | scheduler stall injection does not shift the timeline | real clock; `instrument` mode; fault `timer.stall {ms:300, count:5}` armed | play 20 s with the fault applied at seconds 5 to 6 | five `sched.stall` events with `gapMs` near 300; events due during a stall are clamped to now + 5 ms and counted; every event after the stall starts at `audioTimeAt(tick)` within 1 ms; position stays `positionAt(ctx.currentTime)` | no | 4 | B 25.4 rendering stalls; E 2.2; FI hook `timer.stall` |
| TT-020 | render stalls of 100-500 ms leave the highway on the audio clock | real clock; `quickplay` with `demo-poprock`; fault `render.slowFrames` with `ms` cycling 100, 300, 500 every 10 s | play 120 s (slow set) or 30 s (default); compare the highway tick with `positionAt(audioNow)` each frame | max abs difference <= 1 tick (S-01); chart bot judgments all perfect; `lateEvents === 0` | yes | 5 | B 25.4 rendering stalls; E 2.2 frame takes 100-500 ms; S-01 |
| TT-021 | background and foreground in a gameplay mode | FakeClock transport with the visibility hooks; policy `pause` | hide at tick 5000; advance perf and audio by 180 s; show | paused at the hide tick; anchor ring cleared and refilled; position after the user's resume continues from tick 5000; nothing scheduled while hidden | no | 2 | B 25.4 background and foreground transitions; E 2.1 tab switch for minutes |
| TT-022 | background and foreground in the Studio (continue policy) | FakeClock transport; policy `continue`; perf advances 10 s while audio advances 3 s while hidden | hide during playback; show | `onVisible` reports `drifted:true` with driftMs near 7000; re-anchor at the current audio time; no burst of items (UT-04-22 rule); E-AUD-009 logged once | no | 2 | E 2.1; E 2.2 audio and performance clocks diverge |
| TT-023 | calibration applied once across the chain | real clock; `instrument` expert chart; `inputOffsetMs 30`, `audioLatencyMs 20` | chart bot presses 50 ms after each note's audio time | every judgment perfect with `deltaMs` 0; `input.event.tAudio` equals the uncalibrated mapping; Scheduler `at` values and highway crossing times equal a run with zero calibration (S-04) | no | 3 | B 26.2 calibration; E 4.1 calibration changed during a song; S-04 |
| TT-024 | calibration changed during a song | the TT-023 setup | change `inputOffsetMs` from 0 to 30 at bar 9 | judgments before bar 9 use 0 and after use 30; the performance summary is flagged `comparable:false` (UT-09-29); no judgment is recomputed | no | 3 | E 4.1 input calibration changed during a song |
| TT-025 | input timestamp mapping accuracy | FakeClock audio, controlled `performance.now`; input anchor from 16 samples | dispatch 200 inputs with known `timeStamp`s; compare `tAudio` with the true mapping | abs(`tAudio` - true audio time) <= 1 ms for every input; added processing time per event <= 1 frame (16.7 ms) | no | 3 | B 25.4 input judgment timing; BRIEF 6 input timestamping |
| TT-026 | judgment window boundaries in audio time | Judge with intermediate windows; inputs at note time +/- 35, 70, 110 ms and 1 ms beyond each | judge each input | exactly on a boundary is inside (perfect, great, good); 1 ms beyond falls to the next class; good + 1 ms is a stray then a miss | no | 3 | E 4.2 input exactly on a judgment-window boundary |
| TT-027 | input before the visual target appears | real clock; `instrument` intermediate chart; Stage highway active | seek to 100 ms before a note so that no frame has drawn the note yet; press 50 ms before the note's audio time, before the next animation frame runs | the press is judged against the note by audio time: `great` with `deltaMs` -50 (intermediate perfect 35 ms, great 70 ms), the same result as when the note is visible | no | 8 | E 4.2 input received before the visual target appears |
| TT-028 | dense chord at identical timestamps | offline engine; 64 notes at one tick across 4 tracks; voice cap 32 | schedule and render | all 64 `sched.noteOn` share one `at`; emission order stable (track order, then pitch ascending); 32 voices sound and the other 32 follow the stealing rule (released-quietest, then oldest); `started + dropped === 64` | no | 4 | E 2.2 several notes share a timestamp; dense chord; E 2.3 polyphony limit |
| TT-029 | simultaneous presses at identical timestamps | Judge with a 4-lane chord; 4 inputs with the same `tPerf` | judge the inputs | one chord judgment with `deltaMs` 0; no lane judged twice; order of processing does not change the result | no | 3 | E 4.1 four buttons pressed simultaneously; E 4.2 two target notes at one timestamp |
| TT-030 | count-in and recording time origin | offline engine; 4/4 at 100 BPM; count-in 2 bars; metronome on | start recording; press at the first downbeat | 8 clicks with accents on beats 1 and 5; the `start` item at `audioTimeAt(0)` exactly 2 bars after the first click; the press records at tick 0 within 1 tick | no | 9 | BRIEF 6 count-in; E 5.1 recording starts before the count-in finishes |
| TT-031 | sustain pedal release timing | offline engine; corpus `midi-controllers.mid` bar 5 notes under CC 64 | render bars 5 and 6 | the four pedal-held notes release at the CC 64 = 0 time within one render quantum plus 1 ms | no | 7 | E 3.2 sustain pedal changes note duration; E 2.3 sustain |
| TT-032 | swing grid onsets | offline engine; `demo-jazz` bars 1 to 2 | render and detect ride onsets | onsets at ticks 0 and 640 of each beat within one render quantum plus 1 ms | no | 4 | B 9.1; UT-30-07 |
| TT-033 | highway placement matches audio time at every lead | Stage highway model with `visualLeadMs` 600, 1,500 and 3,000 | for 100 notes compare the time a note reaches the hit line with `audioTimeAt(note.tick)` | placement error <= one frame of travel (16.7 ms of lead) at each lead time (Part 9.1.2 row 48) | no | 8 | B 12.6; BRIEF 6 visual lead time |
| TT-034 | loop recording pass boundaries | FakeClock studio session; loop of 2 bars; keepAllPasses off | record 3 passes with presses at known ticks | each pass's events relative to the loop start; the kept take holds the last pass only; one `studio.take` per completed pass | no | 9 | B 16.2; E 5.1 |
| TT-035 | dance steps across a tempo change | dance Judge on a generated chart with a tempo change from 120 to 150 BPM at bar 9 | chart bot presses at each step's audio time | all perfect; windows in ms identical before and after the change; step audio times follow the TempoMap | no | 11 | E 7 tempo changes during a dance sequence |
| TT-036 | dance hold across pause and resume | dance Judge; hold step of 2 s | press at the hold start; pause at 0.5 s with the key held; resume with the key still held; release at the end | no hold break; tail judged perfect; a release during the pause breaks the hold per the Judge rule (UT-23-22) | no | 11 | E 7 hold begins before a pause and ends after resume |

B 25.4 and E 2.2 coverage:

| Item | Timing tests |
|---|---|
| B 25.4 Scheduled audio-event timing | TT-001, TT-002, TT-003, TT-028 |
| B 25.4 Input judgment timing | TT-023, TT-025, TT-026, TT-027, TT-029 |
| B 25.4 Pause and resume behavior | TT-006, TT-007, TT-008, TT-036 |
| B 25.4 Seeking | TT-009, TT-010 |
| B 25.4 Looping | TT-004, TT-005, TT-011, TT-012, TT-013, TT-034 |
| B 25.4 Tempo changes | TT-014, TT-015, TT-016, TT-035 |
| B 25.4 Rendering stalls | TT-019, TT-020 |
| B 25.4 Background and foreground transitions | TT-021, TT-022 |
| E 2.2 playback speed changed while playing | TT-017, TT-018 |
| E 2.2 audio clock and performance clock diverge | TT-022, TT-025, IT-039 |
| E 2.2 several notes share a timestamp; dense chord | TT-028, TT-029, IT-040 |
| Calibration applied once (S-04) | TT-023, TT-024, IT-004, IT-035 |

### 12.6 Performance tests (PT-001..)

Each PT row is one `tools/perf.mjs` scenario of Part 9.7.3 (plus the build-size check and one
tool-side layout scenario), with the budgets and thresholds of Part 9.1 and 9.7.7 unchanged.
Thresholds are written "desktop (mobile)". Gate classes are those of Part 9.1.1: [B] build,
[U] unit-verified, [H] headless-gated, [D] device-gated, [HD] both. Headless frame-time values
are info and carry "(software GL)"; device cells stay "not measured" until a device run
exists (Part 9.2.3). Default-set rows run at every gate from their Phase; slow-set rows at the
Phase 14 and 16 gates (12.1.5). The Smoke column is a short in-page check in group `perf-smoke`
(`src/92-test-perf-smoke.js`) that runs in every `selftest.mjs --all` so a gross regression is
caught between perf runs; a smoke pass never stands in for the PT result.

| ID | Scenario | Set | Setup and procedure | Metrics and thresholds, desktop (mobile) | Part 9.1 rows | Gate | Smoke check (group `perf-smoke`) | Phase |
|---|---|---|---|---|---|---|---|---|
| PT-001 | `build-size` (tools/build.mjs, not a perf.mjs scenario) | every build | byte length of `FingerLickinMusic.html` including the BOM, printed by the build report | target <= 1,572,864 bytes (warning above it until Phase 16, a gate failure at Phase 16); hard limit: above 2,621,440 bytes the build exits 3 and writes no shipped file; phase envelopes 0.55, 0.95, 1.20, 1.35, 1.50 MB recorded per gate (RISK-60) | 1, 2 | [B] | none (the build itself) | 1 |
| PT-002 | `boot-to-menu` | default; device by the Part 9.7.5 manual procedure | shipped file from `file://`, empty storage, 5 cold loads in new contexts | `menuMs` median <= 1,500 (mobile 3,000); `menuMsMax` <= 2,250 (4,500); `phaseAMs` <= 600 (1,200); `bootMs` <= 400 (800); `capsMs` <= 20 | 3, 4; 9.1.3 Phase A, Phase B, caps | [HD] | `boot.ready` record present in `FLM.Boot.stage` with all 16 stages in order (info: its `ms`) | 1 |
| PT-003 | `first-playable` | default; device by the manual procedure | test build `?perf`; 3 cold loads with empty storage and 3 with onboarding completed; one real click on the unlock control | `ttiMs` and `ttiFirstLaunchMs` medians <= 5,000 (8,000); `enterMs` <= 1,000 (2,000) | 5, 6; 9.1.3 mode enter | [HD] | `Modes.enter('quickplay')` with the Part 1.7 default selection reaches `countin`; `enterMs` recorded as info | 8 |
| PT-004 | `playback-dense` | default (30 s); device (120 s) | `instrument`, `demo-electro`, track Arp, expert, chart bot, all tracks audible | `lookaheadMaxMs` <= 125; `tickIntervalP50Ms` 23-27; `tickIntervalP95Ms` <= 50; `tickIntervalMaxMs` <= 95; `tickWorkMaxMs` <= 4; `schedErrorMaxMs` <= 1.0; `lateEvents` 0; `voicesMax` <= cap | 12, 13, 14; 9.1.3 tick body | [H] and [HD] per row | 5 s of the same scenario: `lateEvents` 0 and `lookaheadMaxMs` <= 125 | 4 |
| PT-005 | `full-band-render` | default (20 s); device (60 s) | `quickplay`, `demo-poprock`, five performers, FullBand camera, Keys expert, chart bot, `video.effectsLevel` 2, tier from `--tier` | frame p50 <= 17.5 ms and p95 <= 20.0 ms at High on `ref-desktop`; Balanced mobile p50 <= 17.5 ms (target) and p95 <= 22.2 ms (floor); Low and Abstract p95 <= 33.3 ms (device only; headless info "(software GL)"); `drawsMax` High 1,200, Balanced 900, Low 600; `trisMax` 150,000, 80,000, 40,000; `particlesMax` <= tier cap; `downgrades` 0 on a device that meets its floor | 7, 8, 9, 10, 11(b); 9.1.3 draws, triangles | [D] frames; [H] draws, triangles, particles | one frame at each tier: draws and triangles under the tier caps | 5 |
| PT-006 | `tier-downgrade` | default | no `tier` parameter (auto active, headless initial High); `quickplay`, `demo-poprock`; `render.slowFrames {ms:45}` from t = 10 s to 30 s after enter | `firstDowngradeMs` 500-2,500 after injection start; `secondDowngradeGapMs` >= 10,000; `tickDriftTicks` <= 1; `lateEvents` 0; `longTaskMaxMs` <= 80; `tickIntervalMaxMs` <= 95 | 11(a); 9.1.3 tier switch | [H] | none (UT-18-13 and UT-18-14 cover the algorithm with fed frames) | 5 |
| PT-007 | `loop-drift-short` | default | `instrument`, `demo-poprock`, 4-bar loop of the first verse at 120 BPM (8 s), real clock, 60 s | `driftMs` < 2.0 | 15 | [H] | none (TT-005 covers the logic) | 4 |
| PT-008 | `loop-drift` | slow | 4-bar loop at 120 BPM (8 s) of a generated click song, real clock, 600 s (75 passes) | `driftMs` < 2.0; `lateEvents` 0 | 15 | [H] | none (TT-004 is the offline equivalent) | 14 |
| PT-009 | `input-latency` | default; device (touch variant, 50 taps) | tool-assisted: `instrument` with `demo-piano` beginner, 100 trusted key presses at seeded 50-150 ms spacing; then `freeplay`, 100 presses | `inputProcP95Ms` <= 4; `inputProcMaxMs` <= 16.7; `liveSchedMaxMs` <= 16.7; `anchorJitterMs` info | 16, 17 | [HD] | 20 synthesized presses with known `tPerf`: processing <= 16.7 ms each | 3 |
| PT-010 | `steady-memory` | default; device | `quickplay`, `demo-poprock` looped, High (headless: `--tier`), chart bot; samples every 5 s from 60 s to 120 s | `memSteadyMb` <= 300 (mobile 150) plus decoded imported audio (192 MB or 64 MB caps); `heapSteadyMb` same limits; `pluckCacheMb` <= 29 (15) | 18, 19; 9.1.3 pluck cache | [HD] | `Instruments.stats().pluckCacheBytes` within the cap after a 10 s run | 14 |
| PT-011 | `mode-cycles-20` | default (4 modes); slow (9 modes) | Part 9.6.1: 2 warm-up cycles then 20 measured cycles per mode, round robin | `heapGrowthMb` <= 10; `leaveMaxMs` <= 400; `assertCleanFailures` 0; `counterDiffs` 0; `Audio.ctxCount() === 1` | 20; 9.1.3 mode leave | [H] | 2 cycles of `freeplay` with `assertClean()` null (IT-032 is the full in-page version) | 5 |
| PT-012 | `chord-stress-1000` | default; device | Part 9.6.4: 16 beats of 1,000 simultaneous notes over 8 tracks at 120 BPM, then 8 beats of silence | `voicesMax` <= 64 (mobile 32); `started + dropped === 16000`; `tickWorkMaxMs` <= 4; `lateEvents` 0 for the beats after each chord; `activeVoicesAfterStop` 0 within 350 ms; `audioNodes` back to the base graph | 21, 22; 9.1.3 voice build | [U, H]; [D] on mobile | one 1,000-note chord: `voicesMax` <= cap and `activeVoices` 0 within 350 ms after stop | 4 |
| PT-013 | `project-32-tracks` | default (60 s play); slow (300 s) | Part 9.6.5: generated 32-track project (96,000 notes), saved to the fake IndexedDB, loaded through the SCR-Library path, played with mute, solo and pan changes, saved and reloaded | `lateEvents` 0; `tickWorkMaxMs` <= 4; `serializeMs` <= 200 (400); reloaded project deep-equal except `modifiedAt`; `heapSteadyMb` within row 18 or 19; `loadMs` info | 23, 31 | [U, HD] | the 33rd `addTrack` refused with E-PRJ-020 | 9 |
| PT-014 | `import-large-midi` | default | generated format-1 SMF with exactly 1,000,000 events over 16 tracks, then one with 1,000,001 | `parseMs` <= 4,000 and `importMs` <= 5,000 desktop; on a device either completion within 5,000 ms or abort with E-IMP-005 and the project unchanged; `refusedOverLimit` 1 | 25, 28; 9.1.3 SMF parse | [HD] | none (FT-036 and FT-041 cover the limits) | 7 |
| PT-015 | `zip-inflate` | default | 20 MB of generated MusicXML compressed with `CompressionStream('deflate-raw')`, inflated by `FLM.Zip.inflate` | `inflateMBps` >= 10 desktop | 9.1.3 inflate | [H] | 1 MB inflate equals the input | 12 |
| PT-016 | `serialize-100k` | default | generated project: 8 tracks, 100,000 NoteEvents, 2,000 CCs; 5 repetitions | `serializeMs` median <= 200 (400); `parseMs` median <= 400 (800); `bytes` info | 31; 9.1.3 project parse | [HD] | 10,000-event project serializes and parses to a deep-equal project | 9 |
| PT-017 | `storage-save` | default | a 2,000,000-byte project on the localStorage path (IndexedDB disabled by the fake), then a 10 MB project on the IndexedDB path | `lsWriteMs` <= 100 (200); `falseSuccess` 0 (no `project.saved` without verified read-back); `idbWriteMs` info | 29, 30 | [H] | a 2,097,153-byte project is never written to localStorage | 9 |
| PT-018 | `content-expand` | default | built-in caches cleared through the M-31 fake; expand all five demo songs and generate one chart per melodic track at intermediate, profile A | `expandMaxMs` <= 50 (100); `chartBuiltinMaxMs` <= 30 (60) | 9.1.3 expansion, built-in charts | [H] | expansion of `demo-poprock` is deterministic (UT-30-01) and timed as info | 8 |
| PT-019 | `chart-generate` | default | generated track of 100,000 notes with chords up to 6 notes; median of 3 | `chartGenMs` <= 150 (400) | 9.1.3 chart generation | [HD] | 10,000-note track generates a chart that passes `validate` | 8 |
| PT-020 | `net-loopback` | default (2 pages, 60 s); slow (4 pages, 120 s) | tool-assisted host and guest pages in one browser, codes copied by the tool; Synchronized Play on `demo-poprock` with chart bots; true offset from epoch-aligned clock samples (Part 9.7.4) | `syncErrorMaxMs` <= 20; `startSkewMs` <= 20; `stateRateHz` 9.5-10.5; `stateGapMaxMs` <= 300; `inputSendMaxMs` <= 4; `syncSamplesBeforeStart` 8; `resyncIntervalMs` 9,500-10,500; `connectionsAfterClose` 0; a fifth player refused (slow set) | 32, 33, 34, 35, 36 | [H]; device claim by LT | in-page loopback pair (IT-025 setup) completes 8 sync samples | 13 |
| PT-021 | `import-repeat` | default (5 iterations); slow (25) | Part 9.6.3: SMF of 200,000 events, 4 MB `.mxl`, 30 s WAV; import, cancel; every 5th iteration confirm, play 2 s, delete | `heapGrowthMb` <= 10; `audioBuffersLeft` 0 beyond the current project's audio tracks; `importMsLast` <= 1.2 x `importMsFirst`; current project deep-equal before and after | 9.6.3 | [H] | one import and cancel of `audio-sine-1s.wav` leaves `Import.audioBufferCount()` unchanged | 12 |
| PT-022 | `playback-long` | slow (30 min); device (10 min) | Part 9.6.2: `quickplay` with `demo-dance` Hook expert, whole-song loop, chart bot, pause at minute 15, seek to the Drop at minute 20 | `heapGrowthMb` <= 10; `audioNodesMax` <= cap x 11 + base graph and back to the base graph within 350 ms of the final stop; `lateEvents` 0; `driftMs` < 2.0 at every wrap; `nonPerfectBotJudgments` 0 | 15, 18, 20 | [H]; [D] device set | none | 14 |
| PT-023 | `record-long` | slow (20 min) | Part 9.6.6: `studio` from `demo-poprock`, loop recording over a 16-bar section, 8 presses per second with chords up to 4 notes | `heapGrowthMb` <= 10 plus the kept takes; `lateEvents` 0; `missingEvents` 0; `duplicateEvents` 0; `saveOk` 1; take `complete` | 9.6.6 | [H] | none | 14 |
| PT-024 | `touch-layout` (tool-side; added to Part 9.7.3 by this part) | default | perf.mjs opens the test build in contexts with `hasTouch:true` at 360 x 640, 390 x 844, 844 x 390, 768 x 1024 and 1024 x 768, enters `instrument` and reads `getBoundingClientRect` of each pad and of the pad region at `input.padSize` small, for `input.padLayout` right and bottom | every pad >= 56 x 56 CSS px; every gap >= 8 px; pad region height (portrait) or width or height (landscape) within 1 px of 28 % or 24 % of the viewport after safe-area insets | 43 | [H]; [D] by XT | pad geometry functions of M-26 at the five sizes (UT-26-18 and UT-26-19 values) | 3 |

B 25.6 coverage: startup PT-002, PT-003; sustained playback PT-004, PT-022; dense polyphonic
passages PT-012; full-band visualization PT-005; mobile rendering fallback PT-006 (and the
device runs of PT-005, PT-010 and PT-012 on the 9.2 mobile classes); long sessions PT-022,
PT-023; large project loading PT-013, PT-016; memory after repeated mode changes PT-011. I 19
rendering ("quality degrades gracefully") is PT-006 with IT-045 and IT-059.

Part 9.7.3 gains the `touch-layout` scenario of PT-024 (open issue for Part 9): `tools/perf.mjs`
runs it without the in-page harness because only the tool can create touch contexts at the five
viewport sizes.

### 12.7 Fault-injection tests (FI-001..)

Group `faults`, `src/92-test-faults.js`, using the fault registry of Part 10.9 (`FLM.debug.inject`
in the test build). Every row also asserts the three E 11 outcomes of Part 10.9.3: no exception
reached `window.onerror` other than the injected one, user data equals its pre-fault snapshot
(or only the documented at-risk item changed), and the application ends in a known-good state
(`Modes.current().mode` is a valid mode and `assertClean()` is null after leaving), then
`FLM.Core.Faults.clearAll()`. "Data-safety assertion" is the row's specific check on top of that.

#### 12.7.1 Test table

| ID | Title | Fault and args | Mode and setup | Procedure | Expected recovery | Data-safety assertion | Rules covered | Phase |
|---|---|---|---|---|---|---|---|---|
| FI-001 | audio suspended during gameplay | `audio.suspend {blockResumeMs:0}` | `quickplay` with `demo-poprock`, playing; chart bot | arm at song second 5; after DLG-ResumeAudio appears, press Resume (the test calls the dialog action) | transport paused with `reason:'interrupt'`; DLG-ResumeAudio (E-AUD-007); Resume runs `Audio.unlock()` and re-anchors; play continues from the frozen tick | no position jump > 1 tick across the resume; ScoreState before the fault unchanged; no PerformanceRecord written for the interrupted part | I 13.1 suspend audio; E 2.1 context suspended while running | 4 |
| FI-002 | audio suspended during recording keeps the previous take | `audio.suspend` | `studio`; track 1 holds a saved take T1; recording a new take T2 on track 1 | arm 3 s into the take | Recorder stops; toast "Recording stopped: audio was interrupted. The take was kept for review."; take review offers Keep take and Discard | track 1 events deep-equal to T1 until Keep take; after Discard T1 is intact; after Keep take `replaceTake` is undoable and undo restores T1 | E 11 rule 7; E 5.1 browser suspends audio during recording; I 13 recoverable recording | 9 |
| FI-003 | audio suspended in a dirty Studio session | `audio.suspend` | `studio` with a dirty project, playback running | arm; resume after 2 s | playback paused, editor usable, DLG-ResumeAudio | `Project.current()` deep-equal before and after; `isDirty()` unchanged; Export produces a valid `.flm.json` | E 11 rule 1; S-16 | 9 |
| FI-004 | audio resume blocked for 5 s | `audio.suspend {blockResumeMs:5000}` | `instrument` playing | arm; press Resume at 1 s and again at 6 s | the first Resume fails with E-AUD-002 and the dialog stays; the second succeeds and re-anchors | transport stays paused until the successful Resume; no audio scheduled while blocked | E 2.1 failed playback produces a clear resume action | 4 |
| FI-005 | node creation fails mid-song | `audio.fail {phase:'node', count:1}` | `quickplay` with `demo-poprock` playing | arm during playback | toast E-AUD-004; hard panic rebuilds the graph; scheduling resumes from `positionAt(now)` | no leaked voice slot (`activeCount` equals the voices actually sounding); project and charts untouched | E 2.1 sample fails or is unavailable; E 11 rule 1 | 4 |
| FI-006 | scheduling calls fail repeatedly | `audio.fail {phase:'schedule', count:3}` | `instrument` playing with the chart bot | arm during playback | three failed `start()` calls each handled as in FI-005; playback continues; the Judge keeps judging inputs by audio time | ScoreState counts only real judgments; no exception reaches `window.onerror` | E 2.1; Part 4.9 origin rules | 4 |
| FI-007 | audio context closed behind the engine | `audio.fail {phase:'closed'}` | `studio` with a dirty project | arm | E-AUD-008, return-to-menu class: the recovery copy is written first, then SCR-MainMenu | the recovery copy `flm.v1.recovery` deep-equals the dirty project; the next boot offers it (E-PRJ-014); stored projects untouched | E 11 rule 1; E 11 rule 8 | 4 |
| FI-008 | audio initialization fails | `audio.fail {phase:'init'}` | a fresh engine instance created by the test with an injected context factory | call `Audio.init()` on that instance | E-AUD-001 fatal path in the test page (`#fatal` rendered with the text of Part 10.6.3); a second `init` does not create a second context | stored projects and settings untouched; `#fatal` text inserted with `textContent` | E 2.1 audio initialization attempted more than once; B 24 | 4 |
| FI-009 | graphics context lost and restored | `render.contextLoss {restoreAfterMs:1000}` | `quickplay` with `demo-poprock`, tier Balanced, playing | arm at second 5 | HUD "Graphics paused" (E-REN-003); on restore buffers, textures and programs rebuilt from CPU descriptions | `transport.state` unchanged and `sched.noteOn` rate unchanged during the loss (S-15); GL counters after restore equal the pre-loss values; bot judgments unchanged | E 11 rule 2; I 13.1 force a rendering interruption; E 6.2 browser loses its graphics context | 5 |
| FI-010 | graphics context never restored | `render.contextLoss {restoreAfterMs:null}` | `instrument` playing, tier High | arm | after 3,000 ms tier Abstract with reason `contextLoss`, toast E-REN-004, highway on `#flat` | transport and Judge continue; the saved project record byte-identical before and after | E 11 rule 2; E 6.2 graphics failure must not corrupt the timeline or the saved project | 5 |
| FI-011 | GPU memory exhausted | `render.contextLoss {oom:true}` | `quickplay` playing, tier High | arm, then trigger a buffer allocation by a camera preset change | one tier down (E-REN-005); the old tier's resources disposed | `lateEvents` 0; GL counters after the downgrade at the new tier's baseline | E 6.2 GPU resources exhausted | 5 |
| FI-012 | slow frames trigger a graceful downgrade | `render.slowFrames {ms:300, everyN:1, durationMs:20000}` | `quickplay` with `demo-poprock`, auto tier on | arm 8 s after enter (after the 3 s hold and a full 5 s window) | automatic downgrade within 6 s with toast E-REN-006; at most one step per 10 s | highway tick equals `positionAt(audioNow)` within 1 tick throughout (S-01); audio onsets of the same schedule within 1 ms in the offline check | E 11 rule 2; I 19 rendering; E 6.2 device cannot sustain the target frame rate | 5 |
| FI-013 | storage quota exhausted on save | `storage.quota {target:'both'}` | `studio` with a dirty project previously saved once (live record and `.bak` exist) | press Save | DLG-SaveFailed (E-STO-001) with Export | no `project.saved`; `isDirty()` true; live record and `.bak` byte-identical to before; Export produces a `.flm.json` that `Project.parse` accepts | E 11 rule 4; I 13.1 exhaust storage; E 5.3 quota exceeded | 9 |
| FI-014 | localStorage quota exhausted in localStorage-only mode | `storage.quota {target:'ls'}` | Storage in localOnly mode (fake IndexedDB open rejects); a 1.5 MB project | press Save; then autosave at stop | DLG-SaveFailed with Export on Save; the autosave failure is reported once and stops further autosaves until the next manual save (UT-15-25) | no false success; the previous localStorage record intact | E 11 rule 4; E 9 storage behaves differently under local-file execution | 9 |
| FI-015 | IndexedDB open fails | `storage.writeFail {stage:'open'}` | fresh `Storage.open()` | open storage; open `studio`; save a 100 KB project | localStorage-only mode with notice E-STO-005 and the 2 MB cap; the save goes to localStorage | save verified by read-back before `project.saved`; nothing written to IndexedDB | E 5.3; Part 10.7.5 | 9 |
| FI-016 | temporary-copy write fails | `storage.writeFail {stage:'tmp'}` | `studio`, dirty project with an existing live record | press Save | DLG-SaveFailed (E-STO-002) | live record and `.bak` unchanged; no `.tmp` left after the next `Storage.open()` | E 11 rule 4; E 5.3 write interrupted | 9 |
| FI-017 | read-back verification fails | `storage.writeFail {stage:'verify'}` | `studio`, dirty project with an existing live record | press Save | E-STO-004 shown; the previous version restored | live record equals the previous version; `isDirty()` true; no `project.saved` | E 11 rule 4; S-14 | 9 |
| FI-018 | save interrupted at the swap | `storage.writeFail {stage:'swap'}` | `studio`, dirty project with an existing live record | press Save; then call `Storage.open()` on a new instance (simulated restart) | DLG-SaveFailed (E-STO-002); at the next open the leftover `.tmp` is removed silently | the live record is the last verified save; the new instance loads it deep-equal to that save | I 13.1 interrupt a save; E 5.3 browser closes during a save; E 11 rule 4 | 9 |
| FI-019 | backup copy fails | `storage.writeFail {stage:'bak'}` | `studio`, dirty project with an existing live record | press Save | the save is reported as failed with the Part 10.6.6 code; nothing reported as saved | live record unchanged; the previous `.bak` unchanged | E 11 rule 4; E 5.3 overwrite with a smaller or incomplete version | 9 |
| FI-020 | guest connection dropped | `net.drop {peer:<guest>, silent:false}` on the host session | host and guest sessions over a loopback pair in `playing` (IT-025 setup) | arm at song second 10; reconnect the guest at second 40 | host toast E-NET-016; guest slot kept for 60 s; reconnect resyncs `roomState` and position | host session and other guests unaffected; guest local results kept; local projects deep-equal | I 13.1 drop network connections; E 11 rule 5; E 8.1 | 13 |
| FI-021 | host connection dropped | `net.drop {peer:'all'}` on the guest session | host and guest in `playing` | arm at second 10 | guest: DLG-NetError E-NET-009, then SCR-Results marked Disconnected; afterwards Quick Play works | guest local transport plays to the song end on the shared timeline; no storage write except the local result; `Net.connectionCount() === 0` after close | E 11 rule 5; B 26.7 standalone remains functional | 13 |
| FI-022 | silent connection detected by timeout | `net.drop {silent:true}` | host and guest in `playing`; FakeClocks | arm on the guest side (guest receives nothing); then on the host side | the guest declares the host lost after 6 s without `roomState`; the host declares the guest lost after 12 s without messages | same safety assertions as FI-020 and FI-021 | E 8.1; E 11 rule 5 | 13 |
| FI-023 | connection never opens | `net.drop` armed before the DataChannel opens | guest joining with an answer code | complete the code exchange | DLG-NetError E-NET-002 after the 15 s connect timeout; SCR-Multiplayer offers create or join | no session state left (`Net.connectionCount() === 0`); local modes usable | E 11 rule 5 | 13 |
| FI-024 | network delay and jitter | `net.delay {ms:200, jitterMs:50}` | host and guest in `lobby` | start Synchronized Play | sync quality classified from the measured error; `start` lands on the shared timeline, not on arrival; late `input` messages outside +/- 2 s dropped | host scores computed only from accepted inputs; no state corruption | E 8.2 latency spikes; B 26.7 synchronized within documented limits | 13 |
| FI-025 | duplicated messages | `net.duplicate {probability:1}` | host and guest in `playing` with chart bots | arm for the whole song | duplicates dropped by `(from, seq)` | final scores identical to a run without the fault | E 8.2 duplicate messages | 13 |
| FI-026 | reordered messages | `net.reorder {window:3}` | host and guest in `playing`; host sends pause then resume | arm during the pause and resume | stale `seq` dropped; a pause older than a resume ignored; an out-of-order control message triggers a `roomState` resync | guest state after the resync equals the host's | E 8.2 messages arrive out of order | 13 |
| FI-027 | gamepad disconnected while held | `input.disconnect {source:'gamepad'}` | `instrument` playing; lane 1 held on a fake gamepad (last used source) | arm | one release per held gamepad control; gameplay paused with "Controller disconnected" (E-INP-003) | `activeVoices` returns to 0 (no stuck note); ScoreState unchanged by the pause | I 13.1 disconnect an input device; E 4.1 device disconnects mid-performance | 3 |
| FI-028 | MIDI device disconnected | `input.disconnect {source:'midi'}` | `freeplay` with a fake MIDI input holding two notes | arm | toast E-INP-006; both notes released; play continues | no stuck voice; Studio take (if recording) closes the held notes at the disconnect time | E 4.1; Part 10.8 MIDI device disconnected | 6 |
| FI-029 | touch pointers cancelled | `input.disconnect {source:'pointer'}` | touch context (`faults@touch`); `dance` with a hold step in progress and two pads pressed | arm | a `pointercancel` for every active pointer; pads clear; the hold breaks per the Judge rule | no control left held; `activeVoices` 0 after the tails | E 13 mobile controls release reliably; E 7 touch active while interrupted | 11 |
| FI-030 | truncation sweep over every base corpus file | `import.truncate {fraction:f}` for f in 0.25, 0.5, 0.75, 0.99 | every committed base file of Part 8.9.3 (68 files x 4 cuts) | import each truncated file through `Import.importFile` | each ends in a typed error or a song with truncation warnings within 5,000 ms | `Project.current()` deep-equal before and after every import; no uncaught error | I 13.1 load malformed files; E 11 rule 3; E 11 rule 6 | 12 |
| FI-031 | truncated import while a dirty project is open | `import.truncate {bytes:200}` | `studio` with a dirty project; SCR-Import | import `midi-multitrack-band.mid` truncated, then the intact file and Cancel | inline error for the first; report then Cancel for the second | project deep-equal and `isDirty()` unchanged after both | E 11 rule 3; S-12 | 7 |
| FI-032 | short scheduler stalls | `timer.stall {ms:300, count:3}` | `instrument` playing | arm | `sched.stall` emitted with the gap each time; late events clamped to now + 5 ms; gameplay not paused (gap below 500 ms) | no cumulative drift after recovery (next onsets at `audioTimeAt(tick)` within 1 ms); ScoreState unaffected for inputs judged by audio time | E 2.2 rendering frame of 100-500 ms; B 25.4 rendering stalls | 4 |
| FI-033 | long stall pauses gameplay and stops recording | `timer.stall {ms:700, count:1}` | run 1: `instrument` playing; run 2: `studio` recording over a saved take | arm in each run | run 1: pause with "Playback stalled"; run 2: recording stopped, take kept for review | run 2: the previous take on the track unchanged until Keep take | E 11 rule 7; Part 10.8 main-thread stall | 9 |
| FI-034 | background throttling of timers | `timer.stall {ms:0, skipTicks:40}` | `studio` playback under the continue policy | arm (1 s of skipped interval callbacks) | the next tick schedules from `positionAt(now)`; events of the skipped second are clamped, not bunched later | no burst: at most the events of one lookahead window emitted in the first tick after the gap; position continuous | E 2.2 browser throttles a background tab | 4 |
| FI-035 | frame callback throws | `error.throw {origin:'frame', count:3}` | `quickplay` playing | arm three times within 10 s | the first two frames are skipped and logged; the third in 10 s escalates to the E-REN-008 dialog | transport and audio unaffected; ScoreState unchanged | E 11 rule 2; Part 4.9 | 5 |
| FI-036 | scheduler tick throws | `error.throw {origin:'scheduler', count:1}` | `instrument` playing | arm | the tick is skipped and reported; the next tick continues from `positionAt(now)` | no duplicated or lost events beyond the skipped tick's window (each such event is clamped to now + 5 ms and counted) | Part 4.9; E 11 rule 6 | 4 |
| FI-037 | bus listener throws | `error.throw {origin:'listener', count:1}` | `instrument` playing; an `error` listener armed to throw | emit one error event | the throwing listener is isolated; every other listener runs (UT-01-04 at integration level) | no state change in any module from the failed listener | E 11 rule 6 | 1 |
| FI-038 | mode enter step fails | `error.throw {origin:'enter', count:1}` | SCR-MainMenu | `Modes.enter('quickplay', defaults)` | dialog E-MODE-002; the partial leave sequence runs; SCR-MainMenu shown | `Modes.current().mode === 'menu'`; `assertClean()` null; project in memory unchanged | E 11 rule 8 | 5 |
| FI-039 | error storm | `error.throw {origin:'listener', count:20}` with an emitter of errors at 10 per second | `studio` with a dirty project | arm | E-GEN-003 dialog (or fatal when the class requires); Export offered | the dirty project exportable and deep-equal to the pre-fault state | E 11 rule 6; B 24 | 5 |
| FI-040 | switch modes while notes are active | none (I 13.1 method of Part 10.9.3) | `freeplay` with 4 lanes and sustain held through `Input.synthesize`; then `studio` recording with 3 held notes | `Modes.enter('menu')` in each case | soft panic then hard panic after 350 ms if needed; the recording is aborted with "Recording discarded" | `activeVoices === 0` within 350 ms; `assertClean()` null; the previous take on the recorded track intact | I 13.1 switch modes while notes are active; E 13 stuck notes; E 11 rule 7 | 9 |
| FI-041 | random input fuzz never crashes | none (seeded fuzz) | fresh page state | 200 random byte buffers (`Prng(1)` to `Prng(200)`, 0-64 KB, with valid magic numbers prefixed for half of them) through `Import.importFile`; 1,000 random `NetMessage` objects through `Net.validateMessage`; 500 random key and pointer event sequences through M-07 | every import ends in a typed error or a report; every message is accepted or rejected with a code; input lifecycle stays balanced | no uncaught error; `Project.current()` unchanged; `Input.State.held()` empty after a final `releaseAll` | E 11 rule 6; B 23.1 | 13 |
| FI-042 | page hidden during a recording | none (dispatch `visibilitychange` hidden and `pagehide`) | `studio` recording a take over an existing take T1; dirty project under 2 MB | dispatch the events, then boot a fresh M-29 instance on the same storage | recording stopped at the hide; the pending take written with the autosave as `interrupted:true` and not applied; the recovery copy offered at boot | track 1 holds T1 in the recovered project; the pending take offered for review | E 11 rule 7; E 5.1 user navigates away before saving; I 13 recoverable recording sessions | 9 |

#### 12.7.2 Coverage of the fault hooks (Part 10.9.2) and of I 13.1

| Fault hook | Tests |
|---|---|
| `audio.suspend` | FI-001, FI-002, FI-003, FI-004 |
| `audio.fail` | FI-005, FI-006, FI-007, FI-008 |
| `render.contextLoss` | FI-009, FI-010, FI-011 |
| `render.slowFrames` | FI-012, IT-013, TT-020, PT-006 |
| `storage.quota` | FI-013, FI-014 |
| `storage.writeFail` | FI-015, FI-016, FI-017, FI-018, FI-019, IT-042, IT-044 |
| `net.drop` | FI-020, FI-021, FI-022, FI-023 |
| `net.delay` | FI-024 |
| `net.duplicate` | FI-025 |
| `net.reorder` | FI-026 |
| `input.disconnect` | FI-027, FI-028, FI-029 |
| `import.truncate` | FI-030, FI-031 |
| `timer.stall` | FI-032, FI-033, FI-034, TT-019 |
| `error.throw` | FI-035, FI-036, FI-037, FI-038, FI-039 |

| I 13.1 item | Tests |
|---|---|
| Drop network connections | FI-020, FI-021, FI-022, FI-023 |
| Suspend audio | FI-001, FI-002, FI-003, FI-004 |
| Force a rendering interruption | FI-009, FI-010, FI-011, FI-012 |
| Load malformed files | FI-030, FI-031, IT-041, FT-023..FT-035, the error and truncation rows of FT-050..FT-089 |
| Exhaust storage | FI-013, FI-014 |
| Interrupt a save | FI-018 (stage `swap`), FI-015, FI-016, FI-017, FI-019 |
| Disconnect an input device | FI-027, FI-028, FI-029 |
| Switch modes while notes are active | FI-040, IT-033 |
| Verify recovery without corrupting user data | the data-safety column of every FI row and the three E 11 outcomes of 12.7 |

#### 12.7.3 Coverage of the E 11 minimum recovery rules and the Part 10.7 matrix

| E 11 minimum rule | Tests |
|---|---|
| 1 Audio failure must not destroy project data | FI-003, FI-005, FI-007, IT-046 |
| 2 Rendering failure must not permanently stop the musical transport | FI-009, FI-010, FI-012, FI-035, IT-045, TT-020 |
| 3 File-import failure must not corrupt the current project | FI-030, FI-031, IT-041, IT-042, every `error` row of 12.4 (rule 1) |
| 4 Save failure must not falsely report success | FI-013, FI-014, FI-016, FI-017, FI-018, FI-019, IT-044, PT-017 (`falseSuccess`) |
| 5 Network failure must not disable standalone gameplay | FI-020, FI-021, FI-022, FI-023, IT-030, IT-031 |
| 6 Invalid input must not crash the application | FI-030, FI-036, FI-037, FI-039, FI-041, IT-041 |
| 7 Interrupted recording must not overwrite the previous successful take | FI-002, FI-033, FI-040, FI-042 |
| 8 An unrecoverable mode transition must return to a valid application state | FI-038, FI-007, FI-040, IT-032 |

The E 11 question "which automated test verifies recovery" is answered per subsystem by the
Test columns of Part 10.7, resolved to IDs here:

| Part 10.7 group | Automated tests |
|---|---|
| 10.7.1 Audio | FI-001..FI-008, IT-033, IT-047, UT-05-01..UT-05-05, UT-05-22, UT-05-23 |
| 10.7.2 Transport | FI-032, FI-033, FI-034, FI-009, TT-009, TT-011, UT-04-14 |
| 10.7.3 Input | FI-027, FI-028, FI-029, IT-043, UT-07-12, UT-07-13, UT-07-19, UT-07-26..UT-07-28, UT-08-34 |
| 10.7.4 Import | FT-001..FT-103, FI-030, FI-031, IT-042, UT-14-18 |
| 10.7.5 Project and storage | FI-013..FI-019, IT-044, IT-054, IT-058, UT-15-13, UT-16-08, UT-16-15 |
| 10.7.6 Studio and recording | FI-002, FI-033, FI-040, FI-042, IT-055, UT-17-08, UT-17-12..UT-17-15, UT-15-19 |
| 10.7.7 Render and animation | FI-009..FI-012, FI-035, IT-023, IT-059, UT-19-14, UT-20-30 |
| 10.7.8 Dance | IT-021, FI-029, TT-036, UT-23-27, UT-23-29 |
| 10.7.9 Multiplayer | FI-020..FI-026, IT-027, IT-028, IT-031, UT-24-15, UT-24-16 |
| 10.7.10 UI and modes | FI-038, FI-039, IT-032, IT-056, IT-057, UT-28-05, UT-28-06, UT-29-07 |
| 10.8 Interruptions | FI-001, FI-027, FI-042, TT-021, TT-022, IT-056, IT-057, UT-28-09, UT-28-10 |

#### 12.7.4 Automated quality gates (I 17), quality targets (I 19) and P 20

| Required automatic verification (I 17) | Tests |
|---|---|
| Musical time conversion | 12.2.32 rows 1-2, TT-005 |
| Audio scheduling logic | TT-001..TT-004, UT-05-15..UT-05-20, PT-004 |
| Note-on and note-off lifecycle | UT-03-08..UT-03-13, UT-10-12..UT-10-14, IT-001, IT-033, TT-007, TT-011 |
| Chord and scale mapping | UT-02-12, UT-02-13, UT-08-01..UT-08-08, IT-005 |
| Scoring boundary conditions | UT-09-03..UT-09-07, TT-026, IT-003 |
| MIDI parsing | FT-001..FT-035, FT-047..FT-049, UT-10-01..UT-10-40 |
| Project save and load integrity | FT-111, IT-014, FI-013..FI-019 |
| Import and export round trips where supported | FT-104..FT-114 |
| Mode-transition cleanup | IT-032, IT-033, PT-011, UT-28-01..UT-28-07 |
| Multiplayer message validation | UT-24-03..UT-24-06, UT-24-15, UT-24-16, IT-028, FI-041 |
| Mobile input lifecycle | IT-002, FI-029, UT-07-16..UT-07-20, PT-024 |
| Resource limits | FT-036..FT-049, FT-112, UT-10-31, UT-12-26, UT-13-28, PT-012 |
| Regression test for every fixed defect | 12.1.7 |
| Final release tested by opening the delivered file | `node tools/selftest.mjs --smoke` on `FingerLickinMusic.html` (12.1.1) and the `file://` rows of 12.8 |

| I 19 area | Target (as fixed in Part 9) | Tests |
|---|---|---|
| Timing | drift < 2 ms after a 10 min loop; precision 1 ms | TT-001, TT-004, TT-005, PT-007, PT-008, PT-022 |
| Input | calibration configurable; judgments deterministic | IT-003, IT-004, TT-023, UT-09-27 |
| Audio | no voices after 350 ms past stop; voices <= 64 or 32 | IT-033, FI-040, PT-012, PT-022 |
| File integrity | valid supported files keep every event | FT-001..FT-022, FT-050..FT-062, FT-074..FT-089 valid rows, FT-107, FT-109 |
| Recording | saved takes intact after failed recordings | FI-002, FI-033, FI-042 |
| Rendering | one tier step per 10 s, never touching audio | PT-006, FI-012, IT-045, IT-059 |
| Persistence | failed saves never report success | FI-013..FI-019, IT-044, PT-017 |
| Multiplayer | sync error <= 20 ms measured and recorded | PT-020, IT-025 |
| Compatibility | every advertised format and browser has evidence | 12.4 publication rule, 12.8 |
| Packaging | the shipped file works where claimed | PT-001, `--smoke`, 12.8 |

| P 20 item | Where |
|---|---|
| Unit tests cover musical timing and mapping | 12.2 (12.2.32) |
| Integration tests cover audio, input, scoring and rendering | IT-001..IT-013, IT-045 |
| Import tests cover valid, malformed and unusually large files | 12.4, FI-030 |
| Save and load tests verify data integrity | FT-111, IT-014, IT-044, FI-013..FI-019 |
| Multiplayer tests cover latency, disconnects and invalid messages | FI-020..FI-026, IT-027, IT-028, PT-020 |
| Mobile tests run on actual devices | 12.8 (Part 12b) |
| Cross-browser tests cover advertised browsers | 12.8 (Part 12b) |
| Performance tests cover long and demanding sessions | PT-011, PT-012, PT-013, PT-022, PT-023 |
| Accessibility checks are completed | UT-26-08, UT-26-13, UT-26-15, UT-26-26 and the 12.9 accessibility rows (Part 12b) |
| Licensing and dependency inventories are reviewed | review (Part 14.6) |
| The release build has no known critical defects | 12.10 gate; STATUS.md section 6 |
| All documented limitations are accurate | review at 12.10 against Part 14.7 |
| Every P0 and P1 requirement has an acceptance test | 12.12, 12.13 |
| The final HTML has been independently validated | `--smoke` on the shipped file; 12.8 `file://` rows |

#### 12.7.5 Invariant coverage across levels (Part 4.6)

| Invariant | Tests at every level |
|---|---|
| S-01 | IT-013, TT-020, FI-012, PT-006, UT-18-20; build lint (Part 3.3.4) |
| S-02 | IT-012, UT-09-27 |
| S-03 | IT-009, IT-034, UT-20-19, UT-20-21 |
| S-04 | IT-004, IT-035, TT-023, UT-09-23, UT-07-32; build lint |
| S-05 | IT-036, FT-064, FT-065; build lint |
| S-06 | IT-032, IT-033, PT-011, UT-28-02, UT-28-03 |
| S-07 | IT-037, UT-18-26, UT-22-19; build lint |
| S-08 | IT-038, 12.4.1 rule 5, UT-08-22 |
| S-09 | IT-039, TT-001, TT-004, UT-05-15 |
| S-10 | IT-040, IT-011, PT-004, PT-012, UT-05-16 |
| S-11 | IT-041, FT-036..FT-049, FI-030, FI-041 |
| S-12 | IT-042, FI-031, 12.4.1 rule 1 |
| S-13 | IT-043, UT-07-12, UT-07-29 |
| S-14 | IT-044, FI-017, UT-16-07, UT-16-13 |
| S-15 | FI-009, FI-010, IT-045, IT-059, UT-18-15 |
| S-16 | FI-003, FI-007, IT-046 |
| S-17 | IT-034, UT-20-18 |
| S-18 | IT-047, IT-032, PT-011, UT-05-05 |

#### 12.7.6 Automated part of the E 13 release gate

Part 12b (12.10) maps every E 13 line to all required tests and evidence; the automated tests
that must pass for each line are:

| E 13 line | Automated tests |
|---|---|
| Audio timing drifts during normal gameplay | TT-001, TT-003, TT-004, TT-005, PT-004, PT-007, PT-008, PT-022 |
| Stuck notes can persist after stopping or changing modes | IT-033, FI-040, PT-012, UT-05-22, UT-05-23, UT-28-03 |
| Valid supported MIDI files lose musical events | FT-001..FT-022, FT-047, FT-049, FT-107, FT-109, IT-006, IT-008 |
| Saving can silently destroy an existing project | FI-013..FI-019, IT-044, FT-111, FI-002 |
| The advertised standalone file cannot perform its documented core functions | `--smoke`, IT-030, IT-058, IT-059, PT-001 |
| A rendering failure permanently disables audio or transport | FI-009, FI-010, FI-012, IT-045 |
| Mobile controls fail to release inputs reliably | IT-002, FI-029, UT-07-12..UT-07-20 |
| Multiplayer accepts invalid authoritative results | IT-028, FI-041, UT-24-03..UT-24-07 |
| Required supported file formats not tested against a representative corpus | 12.4 (FT-001..FT-103) with the publication rule of 12.4.1 |
| Critical errors silently ignored or reported as successful | FI-013, FI-017, FI-035, FI-039, UT-01-14, PT-017 |

