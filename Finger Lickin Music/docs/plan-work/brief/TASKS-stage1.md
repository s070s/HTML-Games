# Stage 1 drafting tasks

Common procedure for every task in this file:
1. Read `BRIEF.md` (same directory) completely. It is binding.
2. Read the specification completely (path given in your prompt; 3,193 lines; read in
   chunks of about 700 lines with offset/limit). Your part must be grounded in it.
3. Write your output file(s) to the `parts/` directory named in your prompt, with the exact
   file names below. Overwrite if present. UTF-8, LF, ASCII only.
4. Where this task says "decide", make the decision and write it as a decision, with a one
   line reason. Do not list alternatives without choosing.
5. Return the JSON requested by your prompt.

Heading rule: each part starts with the exact level-2 heading shown, then subsections
`### N.x`. Numbering of subsections is given; do not renumber.

---------------------------------------------------------------------------------------

## TASK 00  (file `00-front.md`)  heading: `## 0. How to use this plan`

Audience: the Opus 5.5 high-effort session that will implement the whole game in one go.

Write:
- 0.1 Plan identity: plan version 1.0.0; date 2026-10-25; specification parts covered
  (base FLM-1.0, FLM-1.1.0, FLM-1.2.0, FLM-1.3.0) with their line ranges; repository
  folder `Finger Lickin Music/`; shipped file `FingerLickinMusic.html`; where the spec copy
  lives (`docs/SPECIFICATION.txt`).
- 0.2 What this document is and is not (a complete, decided design plus an executable
  roadmap; not a status report; nothing is implemented at version 1.0.0).
- 0.3 Reading order: read Parts 0-5 and 9-10 fully before coding; read the Part 6 module
  design for a module immediately before implementing it; execute Part 11 in T order;
  consult Parts 7, 8, 12, 13, 14, 15 as the T sections direct.
- 0.4 One-session execution procedure, step by step: create the branch and folder; create
  `docs/LEDGER.md` and `docs/STATUS.md` from Appendix D templates; for each T section in
  order: implement, run `node tools/build.mjs`, run `node tools/selftest.mjs --group <g>`
  for the groups named in the section's Verification, update STATUS and LEDGER, commit at
  each phase gate with the commit message convention; never push unless the owner says so;
  what to do when context runs low (write the LEDGER RESUME line first, then stop; a fresh
  session resumes from Part 0 and the ledger). Include the exact shell commands.
- 0.5 Implementation discipline checklist: restate every obligation in spec B 1.4 and E 10
  as a checkbox list the agent re-reads at each phase gate. Include "never report a feature
  complete because its UI exists" and "document every placeholder or limitation".
- 0.6 Autonomy and assumptions: the owner has authorized autonomous execution (B 1.3); the
  agent records every assumption in the LEDGER "Assumptions" section; it must not omit a
  requirement because it is difficult; when a requirement conflicts with the single-file
  constraint it records the conflict and the smallest exception (B 1.4 last bullet).
- 0.7 Status tracking: `docs/STATUS.md` is the live list of Implemented / Partial /
  Blocked / Unimplemented / Deferred requirements (counts per spec part plus the full list
  of anything not Implemented, with reason); the Part 15 matrix Status column is updated
  in the Phase 16 pass. Give the exact STATUS.md structure.
- 0.8 Definition of completion (B 1.5) and pointer to the release-blocking gate (Part 12
  section 12.10) and the final report (Part 14).
- 0.9 Conventions: reproduce the full ID conventions table from BRIEF section 2, the status
  and compatibility vocabularies, the priority definitions, the writing/encoding rules for
  new files (ADR-09), and the terminology rule ("use the names in Parts 4 and 5").
- 0.10 Environment assumptions for the implementing session: Node 22 or newer, Playwright
  with Chromium preinstalled (fallback: `/opt/pw-browsers/chromium` or CDP), no network
  required, no npm installs required.

---------------------------------------------------------------------------------------

## TASK 01  (file `01-scope.md`)  heading: `## 1. Product scope and delivery profiles`

Write:
- 1.1 Product summary in one paragraph plus the five pillars (I 21) as the acceptance lens.
- 1.2 The unified engine: a table of modes (menu, quickplay, instrument, freeplay, studio,
  library, import, dance, multiplayer, customize, settings, help, about, diagnostics,
  tutorial, results) with: what the user does there, which shared systems it binds
  (Transport, Audio, Input, Mapping, Rhythm, Render, Stage, Project), and its exit paths.
- 1.3 Feature tiers: a table of every bullet in B 4.2, 4.3, 4.4 with columns Feature |
  Priority | Phase (B 27 phase number) | Modules | Status at v1 (Unimplemented or
  Deferred) | Notes. Also map I 18 "Prioritize improvements by impact" to phases.
- 1.4 Delivery profiles (B 5.4, I 14.3): Standalone edition vs Online edition table listing
  every feature and which profile needs what; the exact sentence the About screen uses to
  describe each; what fails gracefully when the relay or STUN is unreachable.
- 1.5 Decided Deferred and Unsupported items with reasons and the exact user-facing wording
  the UI shows: Collaborative Studio (rules specified in Part 6 M-24, not built), SoundFont
  (.sf2) loading, Guitar Pro 6/7 (.gpx/.gp), audio-to-notes transcription, MusicXML
  notation rendering/engraving, Web MIDI outside secure contexts, local two-player on one
  keyboard (decide: Deferred P2), audio effects beyond a master limiter and one global
  synthesized-IR reverb (decide: reverb P1 in Phase 14; delay, compression per track, EQ
  are Deferred P2), host migration in multiplayer (Deferred; the session ends with results).
- 1.6 Browser support policy: the five target browsers (B 5.1); a claim is published only
  after its XT tests pass; local-file (`file://`) behaviors to verify per browser
  (IndexedDB availability, audio unlock, file import, download).
- 1.7 Built-in content summary: the five demo arrangements (ADR-14) as a table: id | title
  (original, invented) | style | BPM | key | meter | length (s) | tracks and GM programs |
  notable features (tempo change, odd meter, dense chords) each one exercises. The note data
  itself is specified in Part 6 (M-30).
- 1.8 Non-goals for v1 (explicit list).

---------------------------------------------------------------------------------------

## TASK 02  (file `02-adr.md`)  heading: `## 2. Architecture and technology decisions`

Write 2.1 through 2.16 as ADR-01 through ADR-16 from BRIEF section 3, one subsection each:
`### 2.N ADR-NN Title`, with: Context (spec refs), Decision (restated precisely and expanded
with any sub-decisions needed to implement), Alternatives considered (a table scoring each
alternative on the B 19.3 criteria: browser compatibility, mobile performance, file size,
license, maintenance, security, functional completeness, offline behavior, single-file
compatibility), Consequences (what becomes easier and harder; limits the UI must disclose),
Verification (which test categories prove the decision holds).
Then:
- 2.17 Dependency inventory and policy (B 19.5, I 14.2): runtime dependencies: none;
  development: Node 22+, Playwright Chromium (preinstalled; fallback CDP via
  `--remote-debugging-port`), with purpose, version, license, loading strategy, failure
  handling, justification for each. State that no npm package is installed.
- 2.18 Single-file constraint analysis (B 5.2, 5.3, 5.4, E 9, I 14): what runs from
  `file://`, what needs HTTPS (Web MIDI, some storage), what cannot exist inside one HTML
  (a public multiplayer service) and the smallest exceptions adopted (manual-signaling
  WebRTC; optional STUN; optional relay). Include a table "capability | file:// | http(s) |
  secure context required | fallback".
- 2.19 Decisions deferred to implementation time: the three open questions OQ-1..3 from
  the BRIEF with the fallback already decided for each.

---------------------------------------------------------------------------------------

## TASK 03  (file `03-repo.md`)  heading: `## 3. Repository layout, build, and tooling`

Write:
- 3.1 Complete file tree of `Finger Lickin Music/` (every file from BRIEF section 4
  including `src/91-test-*.js` names: one test file per module group, e.g.
  `91-test-core.js`, `91-test-theory.js`, ... decide the full list), with one-line purpose
  each and whether it ships.
- 3.2 `src/shell.html` specification: exact `<head>` contents (charset, viewport with
  `viewport-fit=cover`, CSP from ADR-12, theme-color, apple/mobile web-app meta, icon
  `data:,`, title), the full CSS design-token block (names and values): palette with
  semantic meaning (P 2.1) - background, panel, text, muted text, accent, accent-2, ok,
  warn, error, focus ring; the four lane colors AND four lane glyphs (decide shapes:
  circle, triangle, square, diamond) and four dance arrow glyphs (inline SVG symbols);
  typography scale (6 sizes, system font stack); spacing scale; radii; border; shadow;
  motion durations; `prefers-reduced-motion` and `.reduced-motion` class behavior; safe-area
  variables; `--ui` scale variable; portrait/landscape body classes. Then the exact DOM
  scaffold (ids from BRIEF section 4) and the `/*@@SCRIPT@@*/` marker placement inside a
  single `<script>` after a tiny early error-handler script.
- 3.3 `tools/build.mjs`: inputs, ordering rule, BOM stripping, single leading BOM, LF
  normalization, exclusion of `9*-*.js` from the shipped build, inclusion in the test build,
  `--check` (build to memory only), `--online <relayUrl>` flag that widens `connect-src`,
  size gate (fail > 2.5 MB, warn > 1.5 MB), `node --check` on the joined script, version
  stamping (`FLM.VERSION` from a `VERSION` constant in `01-core.js`, build date comment),
  output paths, exit codes. Pseudocode.
- 3.4 `tools/selftest.mjs`: launch Playwright Chromium with flags
  `--autoplay-policy=no-user-gesture-required --use-gl=angle --use-angle=swiftshader
  --enable-unsafe-swiftshader`; open the test build via `file://`; wait for
  `window.FLM.selfTestReady`; call `FLM.selfTest(group)`; read `window.__FLM_RESULTS`;
  print a table; exit 1 on any failure; options `--group <name>`, `--all`, `--json <path>`,
  `--slow` (longer timing tests), `--headed`; fallback launch with
  `executablePath: '/opt/pw-browsers/chromium'`; timeout policy.
- 3.5 `tools/perf.mjs`: scenarios (defined in Part 9) and output format.
- 3.6 `tools/make-corpus.mjs`: writes `test-corpus/` deterministically with its own small
  SMF writer, MusicXML string templates, a stored-only ZIP writer for `.mxl`, a minimal GP5
  serializer (one or two tracks, a few measures, including bends/slides/tied notes), plus
  malformed and truncated variants produced by deterministic byte mutation; the list of
  files is specified in Part 8; here specify the generator's structure and determinism.
- 3.7 `server/relay.mjs`: zero-dependency Node relay: hand-written WebSocket (RFC 6455)
  handshake and framing (text frames only, masking, ping/pong, close), rooms by 6-character
  code, max 4 members, 64 KB message cap, 60 msg/s per connection, room idle expiry 10 min,
  no persistence, no credentials, configuration by environment variables (PORT), how to run
  behind TLS (reverse proxy; the relay itself is plain `http`), what it logs (nothing
  personal). Message pass-through rules (the relay never interprets game payloads except
  `join`/`leave`).
- 3.8 `docs/LEDGER.md` and `docs/STATUS.md` formats (summarize; templates are in Appendix D).
- 3.9 Developer loop: the exact commands for build, test, perf, corpus, relay, and a
  "definition of a clean T section" (build passes, named groups pass, STATUS updated).
- 3.10 `.gitignore` addition (`Finger Lickin Music/FingerLickinMusic.test.html`) and the
  `README.md` content for the folder (10-20 lines; must state that at plan version 1.0.0
  there is no game yet).
- 3.11 Source style: ADR-09 rules plus module skeleton code block showing the IIFE pattern,
  the `FLM.Core.define('Audio', factory)` registration, and the self-test registration
  pattern `FLM.SelfTest.group('audio', t => { t.test('name', async () => {...}) })`.

---------------------------------------------------------------------------------------

## TASK 04  (file `04-modules.md`)  heading: `## 4. Module map, interfaces, and integration`

Write:
- 4.1 Module table: M-01..M-31 with file, namespace, purpose, depends-on (module IDs),
  public API names (names only; signatures live in Part 6), emits (EVT-* topics), consumes.
- 4.2 Dependency graph as an ASCII diagram (layers: core -> theory/model -> transport/audio
  -> instruments/input/mapping/rhythm -> parsers/import -> project/storage/studio ->
  render/rig/animation/stage/character -> dance/net/progress -> ui/screens/modes -> boot).
  State the rule "a module references only lower-numbered modules" and the one allowed
  exception (callbacks via the event bus).
- 4.3 Initialization sequence (M-29): numbered steps from script start to main menu,
  including the capability gate decisions, the audio unlock gesture, storage open, settings
  load, content registration, renderer init with tier selection, first-launch branch.
- 4.4 Event bus catalog: table EVT-* | payload fields and types | emitted by | consumed by |
  frequency. Must include at least: `transport.state`, `transport.seek`, `transport.loop`,
  `audio.state`, `audio.unlocked`, `audio.voices`, `audio.panic`, `sched.noteOn`,
  `sched.noteOff` (scheduled musical events with audio time for visualization/animation),
  `input.event`, `judge.result`, `score.update`, `chart.ready`, `project.changed`,
  `project.saved`, `project.saveFailed`, `storage.quota`, `mode.enter`, `mode.leave`,
  `render.tier`, `render.contextLost`, `render.contextRestored`, `net.state`, `net.peer`,
  `net.message`, `net.sync`, `error`, `settings.changed`, `progress.unlock`. Payload
  definitions must be exact.
- 4.5 Clock domains: audio time (seconds, `AudioContext.currentTime`), performance time
  (`performance.now()` ms), musical time (ticks). The anchoring functions:
  `Transport.tickAt(audioTime)`, `Transport.audioTimeAt(tick)`,
  `Input.perfToAudio(tPerf)` (anchor = `audioCtx.getOutputTimestamp()` when available,
  else `audioCtx.currentTime - performance.now()/1000`, re-estimated every scheduler tick
  with a 20-sample median). Who may read which clock.
- 4.6 Separation rules (I 1.3, E 10): a numbered list of invariants, each with the test
  that asserts it (describe the assertion; IDs come later): renderer never advances musical
  time; scoring uses input audio time, not frame time; animation derives from scheduled
  events and audio time; calibration applied exactly once in `Rhythm.Judge`; parsers never
  execute content; the mode manager tears down fully; no module writes another module's
  state directly.
- 4.7 Mode transition contract (M-28): the enter and leave sequences as numbered lists
  (stop transport, soft panic then hard panic after release time, release all inputs,
  unbind input listeners, dispose scene nodes, cancel timers and RAF, clear HUD, remove
  dialogs, flush autosave if dirty and safe), the `FLM.Modes.assertClean()` leak counters
  (active voices, timers, RAF handles, listeners delta, GL buffers/textures delta, open
  dialogs) and what each must equal after leave.
- 4.8 Public surface `window.FLM`: `VERSION`, `selfTest(group?)`, `selfTestReady`,
  `diagnostics()`, `debug` (flags: `tier`, `showStats`, `inject(fault)`), and the rule that
  nothing else is global.
- 4.9 Error propagation: how a module reports errors (`FLM.Core.ErrorReporter.report(code,
  err, context)`), classes (recoverable, returnToMenu, reload), and who shows UI.

---------------------------------------------------------------------------------------

## TASK 05  (file `05-data.md`)  heading: `## 5. Data model and serialization`

Write:
- 5.1 Type definitions: for every type in BRIEF section 5 a field table: field | type |
  range/units | default | invariant. Add any helper types you need (e.g. `TrackIndex`,
  `DerivedNote` with `effectiveDurTicks` after sustain pedal, `Section`).
- 5.2 Event ordering comparator (tick, then kind priority: program, cc, bend, note, text;
  note-off-like events before note-on at equal tick when represented separately during
  import; then channel; then pitch; then id) and the invariant "events arrays are always
  sorted; mutation goes through `Model.insertEvent`/`removeEvent` which keep order".
- 5.3 TempoMap: representation, `ticksToSeconds`, `secondsToTicks` (binary search over
  entries with precomputed `secondsAt`), handling of tempo entries at the same tick (last
  wins), default tempo (120 BPM = 500000 us per quarter) when none, precision statement
  (doubles; error < 1 us over 24 h), playback speed applied outside the map (Transport).
- 5.4 MeterMap and KeyMap operations (`barAt`, `beatAt`, `tickOfBar`, `keyAt`).
- 5.5 `flm-project` version 1: a JSON Schema (draft-07 style, in a `json` block) covering
  the whole Project, plus a short example document. Decide field order, required fields,
  and additionalProperties policy (unknown fields preserved under `x` namespaces).
- 5.6 Validation rules and error codes for loading projects (`E-PRJ-001` ... with messages).
- 5.7 Migration framework: `migrate(doc)` chain by version, refusal of newer versions with
  exact message, migration tests policy, and the rule that migrations never run on the
  original stored record until the migrated copy is validated.
- 5.8 Size accounting: `estimateSize(project)`, the localStorage vs IndexedDB routing rule
  (<= 2 MB and no recordings -> both; otherwise IndexedDB only), what is stripped from
  autosave checkpoints.
- 5.9 Gameplay data: `Chart`, `ChartNote`, `settingsHash` composition (sha-like 32-bit FNV
  of difficulty, profile, generatorVersion, trackId, source event count), `DanceChart`,
  `DanceStep` field tables and invariants.
- 5.10 `CharacterConfig` and the options catalog schema (option id, category, label,
  rigAffecting boolean, params), `CharacterPreset`.
- 5.11 Settings schema: EVERY setting key with type, range, default, where it appears in
  the UI (screen), and whether it affects competitive comparability (B/P 5.3). Include
  audio (master volume, metronome volume, polyphony cap), calibration (three offsets),
  input (key maps per profile, dance keys, pad layout, pad size), gameplay (visual lead,
  judgment preset, note speed, stray-press penalty), video (tier, resolution scale,
  camera motion, effects level, reduced motion, high contrast, UI scale), accessibility
  (lane glyphs always on, screen-reader labels), privacy (none to collect), onboarding
  flags, diagnostics overlay.
- 5.12 Calibration model and the single application point.
- 5.13 Progression records: `PerformanceRecord`, `Achievement`, `UnlockState`,
  `DailyChallenge` field tables.
- 5.14 Export formats: `.mid` writer rules (format 1, PPQ 960, track 0 conductor with
  tempo/meter/key/markers, one track per Track with name, program, CC, notes; running
  status allowed; EOT), project `.flm.json`, dance chart `.flmdance.json`, character
  `.flmchar.json`, settings backup `.flmsettings.json`, WAV (RIFF, 16-bit PCM, 48 kHz,
  stereo) from `OfflineAudioContext` render of the project (or MediaRecorder fallback,
  OQ-2). Round-trip rules: what MIDI export preserves and loses (table).
- 5.15 Storage key catalog (`flm.v1.*` keys with contents and size caps) and the IndexedDB
  schema (`flm-db` version 1: stores, keyPaths, indexes).
- 5.16 Network payload schemas: a table per `NetMessage.type` (hello, roomState, ready,
  selectChart, start, pause, resume, input, scoreUpdate, avatar, ping, pong, leave, error)
  with fields, types, size caps, and validation rules; `ProtocolVersion = 1`.
- 5.17 Versioning summary table: every persistent artifact (project, settings, chart,
  dance chart, character, instrument definitions, mapping profiles, net protocol) with its
  version field and migration owner.

---------------------------------------------------------------------------------------

## Module design tasks (06a-06g). Shared template.

Each module section uses EXACTLY this structure, where N = module number (6.1 for M-01,
6.5 for M-05, 6.31 for M-31):

```
### 6.N M-NN <Name> (`src/NN-name.js`, `FLM.<Namespace>`)
#### 6.N.1 Responsibilities and non-goals
#### 6.N.2 Public API            (js block: every exported function/class with JSDoc-style
                                   param and return types; events emitted and consumed)
#### 6.N.3 Internal state        (data structures, invariants)
#### 6.N.4 Algorithms            (pseudocode or numbered steps for every non-trivial part)
#### 6.N.5 Error handling and recovery   (table answering the nine E 11 questions:
                                   what can fail | detection | state that remains valid |
                                   retry | user data at risk | user informed how |
                                   degraded mode | return to known-good | test)
#### 6.N.6 Limits and performance notes
#### 6.N.7 Spec coverage         (list of spec sections B/E/I/P satisfied)
#### 6.N.8 Unit tests            (table: UT-NN-nn | Name | Setup | Assertion; at least the
                                   minimum count given per module below)
#### 6.N.9 Implementation notes and browser quirks
```

Also write, next to your part file, an index file named in your task (`06x-ut-index-<x>.txt`)
with one line per unit test: `UT-NN-nn | M-NN | <test name>`.

The agent that owns 06a also writes the part heading `## 6. Subsystem designs` followed by
a 6.0 preface (10-20 lines: how to read the module sections, the IIFE/registration pattern
reference to 3.11, and the rule that algorithms here are normative).

### TASK 06a  (file `06a-mod-foundation.md`, index `06x-ut-index-a.txt`)
Modules M-01 Core, M-02 Theory, M-03 Model, M-04 Transport, M-05 Audio, M-06 Instruments.
Must-haves:
- M-01: `Emitter` (on/off/once/emit with per-listener error isolation and listener counts
  for leak tests), `Log` ring buffer (500), `Caps` detection list (webgl2, webgl1,
  audioContext, offlineAudioContext, mediaRecorder, pointerEvents, maxTouchPoints, gamepad,
  webMidi, indexedDB, localStorage, secureContext, isFile (file://), visibility API,
  storageEstimate, performanceMemory), `ErrorReporter` (window.onerror,
  unhandledrejection, classification recoverable/returnToMenu/reload, #fatal screen with
  diagnostics export), `Diagnostics.export()` JSON (redaction rules), `uid()`,
  `Prng` (mulberry32, seedable; used by chart generators and daily challenge), `fnv1a32`,
  `clamp/lerp/smoothstep`, `formatTime`, `define()` module registration, `VERSION`.
  Minimum 20 unit tests.
- M-02: scale table (major, natural minor, harmonic minor, melodic minor, major pentatonic,
  minor pentatonic, blues, chromatic, plus the seven diatonic modes, whole tone, user
  defined), chord table (major, minor, dim, aug, sus2, sus4, maj7, min7, dom7, dim7,
  half-dim7, min-maj7, add9, 6, m6, 9, maj9, min9), inversions and voicings, intervals
  (names and semitones), key signatures (fifths <-> tonic, enharmonic spelling by key),
  `noteName(midi, key)`, `midiFromName`, `scaleDegrees(root, scale, octave, count)`,
  `chordNotes(root, type, inversion, octave)`, `recognizeChord(pitchSet)`, GM program
  names (128) and GM drum names (35-81) as tables in the section. Minimum 20 tests.
- M-03: all types from Part 5 implemented; `Song.create`, `Track.create`, `insertEvent`,
  `removeEvent`, pairing algorithm for note-on/off during import with policies (velocity 0
  = off; unmatched on -> close at track end with warning `W-NOTE-UNMATCHED`; off before on
  -> drop with warning; same-pitch overlap -> end previous at new start, warning
  `W-NOTE-OVERLAP`; zero-duration -> minimum 1 tick, warning); sustain pedal derived
  durations (non-destructive derived layer `DerivedNote.effectiveDurTicks`); `validate()`
  rules; indexes (per track sorted notes, per tick lookups, by-time binary search);
  `durationTicks` computation (last event end, not last note only); `TempoMap`,
  `MeterMap`, `KeyMap` per Part 5. Minimum 25 tests.
- M-04: state machine table (states x actions -> next state and side effects), anchoring
  math with speed, `positionAt(audioTime)`, `seek(tick)` (soft panic, re-anchor, emit),
  pause (record tick, soft panic, keep held-note set for UI), resume (re-anchor to
  `audioNow + 0.05`), loop rules (region [a,b); notes starting before b and ending after
  are released at b; notes starting before a are not retriggered at the wrap; wrap emits
  `transport.loop`; scheduler cursor jumps), speed change (re-anchor; TempoMap unaffected),
  count-in (negative tick space, metronome only, recording starts at tick 0), tempo
  override for Free Play/Studio vs song tempo map for imported songs, visibility change
  policy per mode (gameplay modes auto-pause; studio/free play continue and re-anchor on
  return with a drift check that logs and re-anchors if > 5 ms), `pullDue(untilAudioTime)`
  cursor API used by the scheduler including loop wrap handling, deterministic behavior
  under an injected fake clock for tests. Minimum 25 tests.
- M-05: context creation and unlock flow (gesture, `resume()`, iOS silent buffer kick,
  `statechange` handling, re-unlock prompt), bus graph (master gain -> limiter
  (DynamicsCompressor: threshold -6 dB, knee 6, ratio 12, attack 0.003, release 0.25) ->
  destination; metronome bus; per-track `ChannelStrip` gain+pan+mute+solo logic (solo set
  semantics); analyser for peak), `VoiceAllocator` (pool of 64/32, steal order:
  released-quietest, then oldest; voice handles; `activeCount`), `Scheduler` (setInterval
  25 ms, lookahead 120 ms, pulls due events from Transport, calls
  `Instruments.noteOn(track, note, atAudioTime)`, emits `sched.noteOn/Off` with audio time
  for visuals, handles program/cc/bend events, never schedules more than lookahead ahead,
  catches up after a stall by scheduling all overdue events at `now + 0.005` with a stall
  log), `panic(hard)` (soft: release all with 30 ms ramp; hard: disconnect and rebuild
  graph), metronome click synthesis (two pitches), `latency()` using `baseLatency` and
  `outputLatency` when available, click-free gain ramps (5 ms), start/stop fades, peak
  meter. Minimum 30 tests (use `OfflineAudioContext` for deterministic scheduling tests).
- M-06: instrument definition record format; the 16 family templates with full synthesis
  specs (oscillator types and counts, detune cents, filter type/cutoff/Q and envelope,
  amplitude ADSR values, velocity-to-gain curve, velocity layers thresholds, release
  behavior, polyphony hints, playable range); THE FULL 128-ROW TABLE program -> family ->
  parameter overrides -> fidelity level; the 12 drum voice specs with synthesis recipes
  and the GM key 35-81 -> voice table; `Voice` lifecycle (`start(at)`, `release(at)`,
  `stop(at)`, `dispose()`), program change while sustaining (existing voices keep old
  patch), pitch bend (range 2 semitones default; RPN 0 parsed), CC 1 vibrato depth, CC 7
  and 11 to strip gain, CC 10 pan, CC 64 sustain for live input (per channel flag), CC
  120/121/123 handling, unsupported CCs ignored deterministically and logged once per
  controller, fidelity declaration API `Instruments.fidelity(program)`. Minimum 20 tests.

### TASK 06b  (file `06b-mod-input.md`, index `06x-ut-index-b.txt`)
Modules M-07 Input, M-08 Mapping, M-09 Rhythm.
- M-07: sources and control names (`lane0..3`, `dance0..3`, `pause`, `panic`, `octUp`,
  `octDown`, `profile1..6`, `sustain`), default maps (BRIEF 7), lifecycle state machine
  per control (idle -> pressed -> released; duplicate press ignored; `event.repeat`
  ignored), pointer handling (pointer events only; `touchstart` listener with
  `preventDefault` to block gestures; `pointercancel`, `pointerleave` outside pad ->
  release; drag between pads = release old, press new), `blur`/`visibilitychange`/
  `pagehide` -> release all with `source:'system'`, gamepad polling (buttons 0-3 lanes,
  d-pad dance, start pause) with edge detection, Web MIDI optional (note numbers mapped to
  controls; secure context only), timestamping (`tPerf = event.timeStamp` when it is a
  performance timestamp, else `performance.now()`; `tAudio` via the anchor from 4.5),
  remap API with conflict detection, two-player same keyboard Deferred (state it),
  `InputState.held()`. Minimum 25 tests.
- M-08: profiles A-F precise semantics as tables (button -> action with examples for a C
  major context), simultaneous presses -> chord recognition (within 30 ms chord window for
  free play), octave/register controls, out-of-range policy (clamp to range, log),
  quantization option for free play (snap note-on to nearest grid at 1/16 when enabled),
  `ChartGenerator.generate(song, trackId, difficulty, profile, options) -> Chart`:
  deterministic algorithm in numbered steps: collect source notes; group simultaneous
  notes (same tick) into events; compute strong-beat weights from MeterMap; per difficulty
  rules (beginner: max 1 lane, min spacing 1 beat, keep events on beats preferring beat 1
  and chord roots and melodic peaks; intermediate: up to 2 lanes, min spacing 1/8;
  advanced: up to 3 lanes, min spacing 1/16; expert: up to 4 lanes, 1/16, holds for notes
  >= 1 beat); lane assignment by pitch contour over a sliding window of 8 events mapping
  relative pitch rank to lanes with the "same pitch -> same lane" and "direction" rules;
  drums: fixed map kick 0, snare 1, hats 2, cymbals/toms 3; chords: lanes by pitch order
  low to high; never delete source (every ChartNote lists `sourceEventIds`; a chart-level
  `omittedSourceEventIds` count is reported); `settingsHash`; preview data for the import
  inspection screen. Minimum 25 tests including a determinism test (two runs identical).
- M-09: `Chart` playback cursor, `Judge.onInput(evt)` algorithm (apply calibration once:
  `tAdj = evt.tAudio - inputOffsetMs/1000`; candidate = nearest unjudged ChartNote in that
  lane within the good window; chord notes: all lanes must be pressed within a 50 ms chord
  tolerance, judgment = worst lane delta, a missing lane after the window = miss; stray
  presses = no penalty by default, optional -1 combo setting), `Judge.tick(audioNow)` for
  misses (`audioNow > noteTime + goodWindow`), boundary rule (`abs(delta) <= window` is
  inside), hold logic per BRIEF, scoring per BRIEF (integer math only), combo, accuracy,
  completion percentage, per-section stats (by markers or every 4 bars), `restart()`
  clears all state, `PerformanceSummary` content, replay determinism (an input log replay
  reproduces identical ScoreState), difficulty -> window table, dance uses the same Judge
  with lanes = directions. Minimum 30 tests including boundary tests at exactly +/-
  window.

### TASK 06c  (file `06c-mod-parsers.md`, index `06x-ut-index-c.txt`)
Modules M-10 Midi, M-11 Zip, M-12 MusicXml, M-13 GuitarPro, M-14 Import.
- M-10: reader algorithm (MThd, length not 6 handled, format 0/1/2, division PPQ or
  SMPTE, MTrk, unknown chunks skipped, VLQ max 4 bytes, running status, meta events:
  tempo, time signature, key signature, track name, instrument name, marker, lyric, text,
  end of track, sequencer-specific skipped; sysex skipped; status byte validation;
  truncated track -> keep parsed events plus warning `W-MIDI-TRUNCATED`; missing EOT ->
  warning; format 2 -> one Song per track offered in inspection with warning), tick
  rescaling to PPQ 960 (exact rational with rounding; SMPTE -> seconds -> ticks at the
  default tempo), default tempo rule, drums on channel 10 (0-based 9), track naming
  fallback (`Track N (<program name>)`), limits per BRIEF, time-sliced parsing (yield every
  20,000 events), writer spec (Part 5.14). Minimum 30 tests (header, VLQ, running status,
  truncation, format 2, SMPTE, limits, round trip).
- M-11: EOCD search (backwards, with comment), central directory, local header, methods 0
  and 8, inflate per RFC 1951 (stored, fixed Huffman, dynamic Huffman; pseudocode),
  CRC32 table and check, limits (entries <= 256, uncompressed <= 50 MB, ratio <= 100).
  Minimum 15 tests.
- M-12: partwise and timewise, `score-part`/`midi-instrument` program and channel,
  `divisions`, key/time attributes, notes (step/alter/octave, rest, chord, duration, type,
  dot, tie, tuplet via time-modification, voice, staff, grace -> 1/32 before the next note,
  unpitched/percussion), dynamics -> velocity table (ppp 16 ... fff 127), articulations
  (staccato 50 percent duration, accent +15 velocity, tenuto full, marcato +25), tempo via
  `<sound tempo>` and `<metronome>`, `backup`/`forward`, measure numbering, repeats and
  endings expansion algorithm (forward/backward repeat, `ending` numbers; `dacapo`,
  `dalsegno`, `fine`, `coda` produce warning `W-XML-NAV-UNSUPPORTED` and are not expanded),
  transposing instruments (`<transpose>` to sounding pitch), ties merge, slurs ignored,
  lyrics -> TextEvent, `.mxl` via Zip and `META-INF/container.xml`, unsupported element
  catalog with warning codes, namespace handling, limits. Minimum 25 tests.
- M-13: supported version strings (`FICHIER GUITAR PRO v3.00`, `v4.00`, `v4.06`, `L4.06`,
  `v5.00`, `v5.10`), file layout per version (header, info strings, triplet feel, lyrics
  GP4+, page setup GP5, tempo (+ hide tempo GP5.1), key, octave GP4+, 64 MIDI channels,
  measures count, tracks count, measure headers with repeat flags, track headers (name,
  strings, tuning, port/channel/effects channel, frets, capo, color; GP5 extra RSE bytes
  to skip), measures x tracks beats (status, duration, dotted, n-tuplet, chord diagram
  skip, text, beat effects, mix table change incl. tempo -> TempoMap, notes per string
  with effects: bend points -> PitchBendEvents, slide, hammer/pull -> articulation flag,
  palm mute -> velocity -20 and 60 percent duration, harmonics -> pitch offset table, dead
  note -> velocity 20 and 1/32, tied -> extend previous, let ring -> extend to next same
  string note, grace notes -> 1/32 before), binary primitives, string/fret -> pitch via
  tuning and capo, drum tracks (channel 10 -> fret value is the MIDI key), repeats
  expansion (measure header flags and alternate endings), unsupported features list with
  warnings, limits, and the explicit statement that GP6/GP7 are Unsupported with their
  identification signatures (`BCFZ`, `PK` + `Content/score.gpif`) so the identifier can
  name them. Minimum 25 tests (synthetic GP5 from the corpus generator).
- M-14: pipeline stages with pseudocode; identification table by magic bytes and
  extension (MThd; PK -> zip -> container.xml -> mxl, or `Content/score.gpif` -> GP7
  Unsupported; `<?xml`/`<score-` -> musicxml; `FICHIER GUITAR PRO` -> gp with version
  whitelist; `BCFZ` -> GP6 Unsupported; RIFF/WAVE, ID3 or 0xFFFB/0xFFF3 -> mp3, OggS ->
  ogg, fLaC -> flac); adapter registry API; `InspectionReport` structure (format,
  version, duration, tempo summary, meters, keys, tracks table with program name, channel,
  note count, pitch range, polyphony max, isDrums, warnings; recommended playable track
  heuristic; chord-complexity flag; whether simplification is needed per difficulty);
  time slicing and 5 s budget; audio adapter (`decodeAudioData`, `AudioTrack` with
  `syncOffsetMs` setting, not persisted beyond metadata); import never touches the current
  project until the user confirms (DLG-ImportReplace); `COMPATIBILITY` data object that
  Part 8 publishes. Minimum 20 tests.

### TASK 06d  (file `06d-mod-project.md`, index `06x-ut-index-d.txt`)
Modules M-15 Project, M-16 Storage, M-17 Studio.
- M-15: create/load/save API, validation, migration chain, `UndoStack` with command
  objects (list every command: addTrack, deleteTrack, renameTrack, reorderTrack,
  duplicateTrack, setTrackInstrument, setMix, addEvents, deleteEvents, moveEvents,
  resizeEvents, setVelocity, quantize, setTempo, setMeter, setKeyScale, addMarker,
  removeMarker, replaceTake), coalescing of continuous changes (sliders), 100-entry limit,
  autosave checkpoints (ring of 3 in IndexedDB `recordings`/`projects` store, stripped
  of recordings' raw buffers), dirty tracking, unsaved-changes guard API, non-destructive
  rule (`lockedSource` tracks never mutated by chart generation; edits in Studio create
  `derived:true` tracks or are recorded as commands), `history` persistence policy
  (not persisted). Minimum 25 tests.
- M-16: APIs, safe write algorithm (temp -> verify -> swap -> keep `.bak`), IndexedDB
  open/upgrade and transaction wrappers with timeouts, quota estimate, fallback when
  IndexedDB is unavailable (localStorage only with 2 MB cap and a visible notice), the
  `file://` behaviors to detect at runtime, export (Blob + anchor download with
  `download` attribute, fallback to opening a data URL), import (`<input type=file>`,
  drag and drop), project index record, concurrent-tab guard (`storage` event with a
  lock record and timestamp; warn and open read-only), error codes with exact user texts
  (`E-STO-001` quota, `E-STO-002` unavailable, `E-STO-003` corrupt record, `E-STO-004`
  write verify failed). Minimum 25 tests (use an in-memory fake for IndexedDB in unit
  tests and the real one in integration tests).
- M-17: track ops, `Recorder` (time origin anchored at count-in end; InputEvents mapped
  through the active Mapping profile to NoteEvents with ticks from `Transport.tickAt`;
  held notes closed on stop; aborted take never replaces the previous take; recording
  while playback is running = overdub; loop record keeps the last pass by default with a
  "keep all passes as takes" option), overdub mixing of existing tracks, piano-roll
  operations (select, move with grid snap, resize, delete, velocity, copy/paste at
  cursor), quantize algorithm (grid 1/4 .. 1/32, strength 0-100 percent, never across a
  bar boundary unless `allowBarCross`), section markers, mixer state binding to
  `Audio.ChannelStrip`, limits (32 tracks, 100k events per track). Minimum 25 tests.

### TASK 06e  (file `06e-mod-render.md`, index `06x-ut-index-e.txt`)
Modules M-18 Render, M-19 Rig, M-20 Animation, M-21 Stage, M-22 Character.
- M-18: own minimal math lib (vec3, quat, mat4 functions list), WebGL2 then WebGL1 init
  (context attributes per tier, `powerPreference`), `webglcontextlost`/`restored`
  handlers (preventDefault, rebuild resources from CPU-side descriptions, if restore fails
  within 3 s -> Abstract tier), shader sources (GLSL for vertex: MVP, normal matrix,
  per-instance color; fragment: Lambert + ambient + up to 4 point lights + simple fog;
  WebGL1 variant), primitives (box, capsule, cylinder, sphere, plane, ring), `Mesh`,
  `Material` (color, emissive), scene graph `Node` (local/world matrices, dirty flags),
  instanced drawing (WebGL2 instanced arrays; `ANGLE_instanced_arrays` on WebGL1;
  per-draw fallback), camera (perspective, smooth follow with critically damped spring),
  lights, blob shadows (quad with radial gradient texture), tier parameters table
  (resolution scale, AA, lights, shadows, particles, geometry LOD), stats (frame time
  ring, p95), `dispose()` with GL object counters, 2D fallback surface API (`Flat2D`:
  highway and visualizer drawing on `canvas#flat`). Minimum 20 tests (headless: shader
  compile, matrix math, scene graph, resource counters, tier selection).
- M-19: joint list (hips, spine, chest, neck, head, shoulderL/R, upperArmL/R, foreArmL/R,
  handL/R, upLegL/R, legL/R, footL/R) with default lengths by body type and height scale,
  attachment points (handL, handR, chest, mouth, head, hip, back), pose representation,
  `blend`, two-bone IK for arms (analytic), procedural mesh from `CharacterConfig`
  (capsules, box torso, sphere head, hair cap variants, clothing as colored segments,
  accessories as small meshes at attachment points), rig-affecting options recompute
  lengths and attachments, validation that attachments exist for every instrument prop.
  Minimum 15 tests.
- M-20: controller interface (`onEvent(schedEvt)`, `onBeat`, `update(musicTime, dt) ->
  Pose`), anticipation using `sched.noteOn` events 120 ms ahead, per-instrument
  controllers with the exact gesture rules: keys (left/right hand split at MIDI 60; hand x
  from pitch; press dip; chord density widens fingers), guitar/bass (fret hand x along
  neck from pitch; pick/strum stroke on note-on with velocity amplitude; sustained vibrato),
  drums (limb map: kick 35/36 right foot, pedal hat 44 left foot, snare 38/40 left hand,
  hats 42/46 right hand, ride 51/59 right hand, crash 49/57 nearest hand, toms 41-50 by
  position; anticipated raise 120 ms before, strike at time), strings (bow direction
  alternates per note; pizzicato for short notes), winds/brass (torso expansion on
  sustain, finger fidget), percussion (strike), synth (keys plus knob gesture on CC 1/74),
  vocal/abstract (no body: abstract visualizer), idle breathing amplitude, rests = still
  (no invented activity), intensity from velocity and density windows, blending between
  idle/playing, `StageDirector` deterministic rules (full band default; focus the busiest
  track for 8 bars when its density exceeds 2x the others; section change on markers; no
  cut more often than every 4 bars; camera motion can be disabled), beat/measure
  indicators, abstract visualizers (floating notes, rings, pitch height, trails) with
  caps per tier, reduced-motion behavior. Minimum 20 tests (controllers produce poses
  with the right amplitude at event times; stillness during rests; determinism).
- M-21: stage geometry, five performer slots and positions, instrument props per
  instrument family (drum kit, keyboard stand, guitar, bass, mic stand, generic), effects
  (beat light pulses, perfect-judgment sparks with caps), camera presets (FullBand,
  Focus(slot), Side, Overhead, Player), note highway in 3D tiers (lane planes, scrolling
  notes as instanced quads, hold tails, glyphs for non-color identification, hit line) and
  the Abstract tier equivalent in `Flat2D`, judgment flashes are DOM (HUD), scene
  disposal. Minimum 15 tests.
- M-22: options catalog (every option with id, label, category, rigAffecting, params;
  body 3, heightScale, skin 8 colors, hair 6 styles x colors, face 4, top 6, bottom 4,
  shoes 3, accessories: hat, glasses, headphones, scarf, wristband), 8 named presets,
  validation and incompatible combos (hat hides hair top), seeded randomize,
  serialization and version, multiplayer payload trimming to <= 4 KB, live preview update
  without scene reload. Minimum 15 tests.

### TASK 06f  (file `06f-mod-modes.md`, index `06x-ut-index-f.txt`)
Modules M-23 Dance, M-24 Net, M-25 Progress.
- M-23: `DanceChart` validation rules (no duplicate direction at a tick, no overlapping
  holds in one direction, max simultaneous directions by difficulty: easy 1, normal 2,
  hard 2, min spacing by difficulty), `DanceChartGenerator` (source: drum track strong
  hits if present else tempo grid; easy beats 1 and 3; normal all beats plus some
  eighths; hard eighths with jumps; direction pattern from seeded `Prng` with "no three
  identical in a row" and "alternate feet" rules; holds on sustained bass notes >= 2
  beats; deterministic), input mapping (arrows/pads to directions), scoring via
  `Rhythm.Judge` with difficulty mapping easy->beginner, normal->intermediate,
  hard->advanced windows, `ChoreographyController` (poses per direction and jumps,
  anticipation 120 ms, missing choreography never blocks scoring), practice speed and
  loop, custom chart import/export (JSON), failure rules (life bar optional, default off),
  distinct HUD data. Minimum 20 tests.
- M-24: protocol v1 message table (type, fields, who sends, validation, size cap, rate),
  session lifecycle (create room -> invite code -> answer code -> connected -> lobby ->
  ready -> countdown -> playing -> results -> lobby), WebRTC details (RTCPeerConnection
  with empty iceServers by default, STUN toggle, one reliable ordered DataChannel
  `flm`, non-trickle: gather until `icegatheringstate complete` or 3 s then encode
  `{sdp}` as base64url JSON invite code; answer code the same way), clock sync (8
  ping/pong samples at start then every 10 s; offset = ((t1-t0)+(t2-t3))/2; median;
  shared time = host audio clock), scheduled start (`tStart = hostNow + 2.0 s` shared),
  inputs timestamped in shared time and judged by the host against the same chart
  (`settingsHash` must match; mismatch -> error), authoritative scores from the host,
  10 Hz score updates, pause/resume with seq numbers (late pause after resume ignored),
  dedupe by `seq`, out-of-order handling (control messages must be in order on the
  reliable channel; defensive check), reconnection (new invite/answer exchange within 60
  s; resync by `roomState` and shared position), host leaves -> session ends with results
  (no migration), guest leaves -> continue, rate limits and payload caps, relay transport
  adapter (same messages as WebSocket text frames to `server/relay.mjs`; room code 6
  chars), privacy statement text, security checks table (E 8.3) with the response to each
  abuse case, diagnostics (latency, offset, missed updates shown in the lobby),
  Collaborative Studio rules specified for the future but marked Deferred. Minimum 25
  tests (protocol validation, clock sync math with synthetic samples, dedupe, ordering,
  pause/resume seq, code encode/decode, rate limit).
- M-25: records, personal bests keyed by (songId, chartHash), achievements (define 20
  with id, title, condition), unlock catalog (3 stage themes, 5 accessories, 2 effects
  with unlock conditions), daily challenge (seed YYYYMMDD -> song, instrument, difficulty,
  goal; deterministic), history views data, storage keys, size caps (500 records,
  oldest pruned). Minimum 15 tests.

### TASK 06g  (file `06g-mod-ui.md`, index `06x-ut-index-g.txt`)
Modules M-26 UI, M-27 Screens, M-28 Modes, M-29 Boot, M-30 Content, M-31 SelfTest.
- M-26: screen stack API (`push`, `replace`, `pop`, `back`), focus management (focus trap
  in dialogs, restore on close, visible focus ring), keyboard navigation (Tab, arrows,
  Enter, Escape; sliders with arrows and Home/End), widgets (button, toggle, slider with
  units and precision, select, number, list, tabs), toast (queue, durations), dialogs with
  consequence text, responsive layout (breakpoints, orientation classes, safe areas),
  touch pads component (4 pads, glyphs, pressed state, pointer events, per-orientation
  layout and size setting), HUD component (score, combo, judgment text, accuracy,
  progress bar, section name, performers active indicator), transport bar, UI scale,
  high contrast, reduced motion class, "unsaved changes" prompt API, long-name
  truncation rules, text-entry restrictions during gameplay. Minimum 20 tests (DOM-level
  in headless Chromium).
- M-27: for every SCR-* and DLG-*: the controller logic (what it reads, which modules it
  calls, which events it handles, how it leaves), with layouts and states deferred to
  Part 7; tutorial state machine (I 11.3 seven steps, skippable and repeatable, keyboard
  and touch variants); results screen content; pause screen behavior. Minimum 20 tests.
- M-28: mode manager contract implementing Part 4.7, per-mode setup/teardown table,
  interruption handling table (visibilitychange, pagehide, audio statechange,
  orientationchange, resize, gamepaddisconnected, contextlost, low memory heuristics),
  `assertClean()` implementation. Minimum 15 tests (enter/leave cycles leave zero leaks).
- M-29: boot sequence (Part 4.3) with capability gate decision table and messages, audio
  unlock UI, first-launch flow (B 6.1 seven steps), global error handling to `#fatal`
  with diagnostics export, `window.FLM` surface, URL parameters (`?test`, `?tier=`,
  `?diag`, `?online=<relayUrl>`), returning-user path. Minimum 10 tests.
- M-30: the five arrangements fully specified as data in a compact notation you define
  (e.g. per track: program, channel, and a pattern string per section with pitches,
  durations, velocities; sections with bar counts; tempo and meter maps) so the
  implementer can type them in: give the chord progressions, bass patterns, drum
  patterns, melodic motifs, and section structure for each piece, with lengths that
  yield 60-120 s; include one tempo change and one meter change across the set; tutorial
  sequence data; the 8 character presets; the code that expands the notation into a
  `Song` (algorithm). Minimum 10 tests (expansion determinism, durations, ranges).
- M-31: runner API (`group`, `test`, async, per-test timeout 10 s default, `--slow`
  budget), assertions (`eq`, `near(a,b,eps)`, `throws`, `rejects`, `within`), fakes
  (fake clock for Transport, in-memory IndexedDB fake, `OfflineAudioContext` usage,
  input event synthesis helpers), results format `{group, name, pass, ms, message}` and
  `window.__FLM_RESULTS`, `selfTestReady` flag, the list of all test groups (one per
  module plus `integration`, `timing`, `files`, `faults`, `perf-smoke`), how the UI exposes
  "Run self-test" under Diagnostics in the test build. Minimum 10 tests (the runner tests
  itself).

---------------------------------------------------------------------------------------

## TASK 07  (file `07-ui.md`)  heading: `## 7. User interface and navigation`

Write:
- 7.1 Visual identity (P 2.1-2.3): one paragraph direction; the token names from Part 3
  are referenced, not redefined; iconography (inline SVG symbol list: play, pause, stop,
  record, loop, metronome, settings, back, import, export, mute, solo, the four lane
  glyphs, four arrows, instrument family icons); typography use; motion rules; hierarchy
  rules; what is forbidden (excess glow, gradients).
- 7.2 Complexity levels (I 11.1): Quick Start / Customize / Advanced - what each exposes.
- 7.3 Contextual controls map (I 11.2): which settings appear on which screen.
- 7.4 Navigation model: screen stack, back behavior, browser back/forward handling
  (`history.pushState` per screen; popstate -> `back()`), unsaved-changes guard points,
  focus restoration, no duplicate listeners (reference 4.7).
- 7.5 Responsive rules: desktop (multi-panel), mobile portrait, mobile landscape; touch
  target sizes; pad placement; rotate recommendation rule (which modes recommend
  landscape, never block); safe areas; UI scale; text entry minimization.
- 7.6 One subsection per screen (SCR-FirstLaunch, SCR-MainMenu, SCR-QuickPlay,
  SCR-Instrument, SCR-FreePlay, SCR-Studio, SCR-Library, SCR-ImportInspect, SCR-Dance,
  SCR-Multiplayer, SCR-Characters, SCR-Settings, SCR-Help, SCR-About, SCR-Diagnostics,
  SCR-Tutorial, SCR-Results, SCR-Pause) with: purpose; entry points; elements (ids and
  labels); desktop layout; mobile portrait and landscape layout (ASCII sketch allowed);
  states (empty, loading, success, error, disabled) with exact text; keyboard map; touch
  behavior; exit paths; accessibility labels. SCR-Studio must describe the arrangement
  overview timeline, track list, piano roll, mixer, transport, markers (I 5). SCR-
  ImportInspect must list every field of I 6.1 and the chart preview and mapping change.
  SCR-Dance must have a distinct HUD. SCR-Multiplayer must show the privacy statement,
  invite/answer code flows, lobby, sync diagnostics.
- 7.7 Dialogs (DLG-UnsavedChanges, DLG-SaveFailed, DLG-ImportReplace, DLG-AudioBlocked,
  DLG-DeleteTrack, DLG-Calibration (wizard steps: audio latency tap test, input offset
  test, visual lead preview), DLG-RemapConflict, DLG-ProjectTooLarge, DLG-Unsupported,
  DLG-NetError, DLG-ResumeAudio) with exact texts and buttons.
- 7.8 HUD and gameplay feedback: judgment text and non-color cues (shape and text),
  combo display rules, section feedback, failure feedback wording, pause behavior (no
  stray notes registered), restart clears state.
- 7.9 Onboarding and tutorial: first-launch steps (B 6.1), tutorial steps (I 11.3) with
  success criteria per step and the keyboard and touch variants.
- 7.10 Accessibility implementation: remappable controls, scalable UI, keyboard nav,
  labels, non-color lane identification, reduced motion, high contrast, adjustable
  windows (with the competitive-comparability flag), focus visibility.
- 7.11 Text catalog: all user-facing error and status messages referenced by code
  (`E-AUD-001` ...), with exact wording; the About screen text including the honest
  limits sentences from Part 1.

---------------------------------------------------------------------------------------

## TASK 08  (file `08-import.md`)  heading: `## 8. Import, export, and compatibility strategy`

Write:
- 8.1 Pipeline (B 15.1) stage table with inputs, outputs, failure handling, progress
  reporting, time slicing.
- 8.2 Format identification table (magic bytes, extensions, result, including GP6/GP7
  and unknown).
- 8.3 MIDI preservation table: every SMF event/meta type -> model mapping -> status
  (Supported/Partial/Unsupported) -> notes.
- 8.4 MusicXML preservation table: elements and attributes -> mapping -> status; the
  compressed vs uncompressed statement; the engraving disclaimer.
- 8.5 Guitar Pro preservation table: versions and features (B 15.4 list plus repeats,
  mix changes, drums) -> mapping -> status; identification of unsupported versions.
- 8.6 Audio import policy: formats by browser decode support, audio tracks only,
  `syncOffsetMs`, large buffer limits, no transcription claim text.
- 8.7 Published compatibility matrix (the content of `docs/COMPATIBILITY.md`): format |
  versions | status | preserved | not preserved | limits | verifying tests (name the FT
  group; IDs are assigned in Part 12).
- 8.8 Warning code catalog: `W-MIDI-*`, `W-XML-*`, `W-GP-*`, `W-AUD-*`, `W-IMP-*` with
  message text and severity.
- 8.9 Test corpus definition: a table of every generated file in `test-corpus/` with:
  file name | generator recipe | what it exercises | expected import result (events,
  tracks, warnings) | malformed variants (truncated at N bytes, bad header, bad VLQ, bad
  length, huge counts). Cover every case in E 3.1-3.3 and B 25.3. At least 40 files.
- 8.10 Inspection screen data contract (I 6.1) and the chart preview and mapping change
  flow (I 6.2), including "import never overwrites the current project without
  confirmation".
- 8.11 Export formats and round trips (B 15.6): table format | schema ref (Part 5.14) |
  round-trip test description | what is lossy.
- 8.12 Practice tools (I 6.3): mute target, lower accompaniment, solo, loop, speed with
  pitch preserved (MIDI playback is pitch-independent of speed by construction; audio
  tracks: speed change not supported for audio tracks in v1, say so), restart at
  section, one-hand practice (keys split).

---------------------------------------------------------------------------------------

## TASK 09  (file `09-perf.md`)  heading: `## 9. Performance budgets and device matrix`

Write:
- 9.1 Budget table (every row of BRIEF section 6, expanded): budget | value | how
  measured (tool, scenario, metric, sample size) | pass criterion | phase measured.
- 9.2 Target-device matrix template: device | OS | browser + version | tier assigned |
  load | TTI | FPS p50/p95 | audio glitches | memory | notes; with the rule that the
  implementing session fills real measurements and records "not measured" otherwise.
- 9.3 Quality tiers: High, Balanced, Low, Abstract: parameters table (resolution scale,
  MSAA, light count, shadows, particle caps, geometry detail, max performers rendered,
  highway effects, animation update rate, visualizer caps); auto-tier algorithm (initial
  pick from Caps and `devicePixelRatio`, downgrade on p95 > 33 ms over 5 s, upgrade never
  automatic, user override); the rule that audio is independent of tiers.
- 9.4 Loading strategy (B 20.4): critical vs lazy; instrument patch compilation on first
  use with cache; content expansion lazy; progress reporting only for measurable steps.
- 9.5 Resource cleanup checklist per subsystem (B 20.3) with the counters observed by
  `assertClean()`.
- 9.6 Long-session and memory tests design (20 mode cycles, 30 min playback, repeated
  import, 1,000-note chord stress, 32-track project).
- 9.7 `tools/perf.mjs` scenarios: list with setup, duration, metrics, output JSON shape,
  and thresholds taken from 9.1.
- 9.8 Mobile-specific adaptations (B 21.3, I 12) and their triggers.
- 9.9 Polyphony and track limits statement for the About screen.

---------------------------------------------------------------------------------------

## TASK 10  (file `10-safety.md`)  heading: `## 10. Security, privacy, accessibility, and failure recovery`

Write:
- 10.1 Untrusted input rules (B 23.1, E 1): parser limits (restate), bounds checks,
  time budgets, no `innerHTML` for imported text, no `eval`, no `Function`, CSP, file
  size pre-checks before reading, zip ratio checks, project JSON depth and size limits.
- 10.2 Privacy (B 23.2): what standalone stores (locally only) and the exact multiplayer
  privacy statement (what is transmitted: display name, avatar config, inputs, scores,
  room state; nothing else; no server storage in P2P; relay keeps nothing).
- 10.3 Licensing (B 23.3): inventory of included content (all original; no third-party
  fonts, sounds, models); About screen license text; MIT or owner's choice for the game
  itself left to the owner (state it as an owner decision).
- 10.4 Online credentials (B 23.4): none embedded; STUN URL is public and optional;
  relay URL is a user setting.
- 10.5 Accessibility requirements (B 22, I 15, P 15): table requirement | implementation
  | where (module/screen) | test category.
- 10.6 Error taxonomy: codes `E-AUD-*`, `E-REN-*`, `E-IMP-*`, `E-STO-*`, `E-PRJ-*`,
  `E-NET-*`, `E-INP-*`, `E-CAP-*`, `E-EXP-*` with user text, class (recoverable /
  returnToMenu / reload), recovery action, and whether user data is at risk.
- 10.7 Failure-recovery matrix (E 11): for each subsystem group (audio, transport,
  input, import, project/storage, studio/recording, render/animation, dance, multiplayer,
  UI/modes) answer the nine questions; then the minimum recovery rules (E 11 list) each
  mapped to a mechanism and a test category.
- 10.8 Interruptions (B 21.4, E 2.1): table event | detection | gameplay behavior |
  studio behavior | recording behavior | recovery.
- 10.9 Fault-injection hooks (I 13.1): `FLM.debug.inject(name)` list: `audio.suspend`,
  `audio.fail`, `render.contextLoss`, `render.slowFrames`, `storage.quota`,
  `storage.writeFail`, `net.drop`, `net.delay`, `net.duplicate`, `net.reorder`,
  `input.disconnect`, `import.truncate`, `timer.stall`; what each does and how tests use
  them.
- 10.10 Diagnostics (B 24, I 13.2): the Diagnostics screen metrics and the bug report
  export content (no song content unless opted in).

---------------------------------------------------------------------------------------

## TASK 13  (file `13-risks.md`)  heading: `## 13. Risk register`

Write a table RISK-01.. with columns: ID | Severity (Critical/High/Medium/Low) | Risk |
Impact | Mitigation in design (reference Part 6 modules and Part 2 ADRs) | Early warning
signal | Phase that retires it | Verification (test categories; note that IDs are listed
in Part 12). Seed from E 1 (all 14 rows), E 10 (all 15 prohibited mistakes), E 2-9
notable cases, plus engineering risks: GP5 parser complexity, inflate correctness, iOS
pointer multi-touch (OQ-1), WAV export memory on iOS (OQ-2), STUN reachability (OQ-3),
Playwright absence, `file://` IndexedDB differences, single-session context limits of the
implementing agent (mitigated by LEDGER), build size creep, synthesized GM timbre
acceptance, WebRTC code length for copy-paste, headless GL differences from real GPUs.
At least 40 rows. Then 13.2 Severity classification rules and 13.3 Review cadence (every
phase gate re-reads the register and updates STATUS).

---------------------------------------------------------------------------------------

## Traceability tasks (15a-15d)

Rules: walk your spec part in order. Every bullet, numbered item, table row, checklist
line, or sentence stating an obligation (must, should, may, required, never, do not)
becomes one row. Number rows `-01, -02, ...` within the spec's own section number.
Columns: `R-ID | Spec ref | Requirement (short, <= 110 chars) | Priority | Module(s) |
Phase | Tests | Status`. Priority: use the spec's P0/P1/P2 where B 4 assigns it; otherwise
derive (core correctness/safety = P0; full product feature = P1; advanced/optional = P2);
polish checklist items default P1, micro-polish (P 21) P2. Module(s): M-IDs. Phase:
`Phase NN` (00-16 per B 27; the Phase column is rewritten to T-IDs later by a script, so
write only `Phase NN`). Tests: `AT-<R-ID>` for P0 and P1; `n/a` for P2. Status:
`Unimplemented`, or `Deferred` for items Part 1 marks Deferred (Collaborative Studio,
SoundFont, GP6/7, transcription, engraving, two-player one keyboard, extra effects, host
migration). Also write an index file with one line per row:
`R-ID | Priority | short | Phase NN | AT-or-n/a`.

### TASK 15a (file `15a-trace-B.md`, index `15x-index-B.txt`)
Heading `## 15. Requirements traceability matrix` then a 15.0 preface (how to read,
column meanings, the script-rewrite note about the Phase column) then
`### 15.1 Base specification (B)` covering B sections 2 through 29 (section 1 is
instructions to the agent: include its 1.4 and 1.5 obligations as rows too). Expect
450-600 rows.

### TASK 15b (file `15b-trace-E.md`, index `15x-index-E.txt`)
`### 15.2 Edge cases and failure modes (E)` covering E sections 1 through 13 (every
bullet case is a row: the requirement is "handle: <case>" plus the "Required behavior"
lines). Expect 200-300 rows.

### TASK 15c (file `15c-trace-I.md`, index `15x-index-I.txt`)
`### 15.3 Essential product improvements (I)` covering I sections 1 through 21. Expect
200-280 rows.

### TASK 15d (file `15d-trace-P.md`, index `15x-index-P.txt`)
`### 15.4 Maximum-polish checklist (P)` covering P sections 1 through 22. Expect 250-320
rows.

---------------------------------------------------------------------------------------

## TASK BCD  (file `B-appendices.md`)  headings: `## Appendix B. Glossary`,
`## Appendix C. Prohibited mistakes and their guards`, `## Appendix D. Templates`

- Appendix B: glossary of every term of art used (tick, PPQ, tempo map, lookahead,
  anchor, voice stealing, chart, lane, judgment window, hold, profile A-F, tier, rig,
  attachment point, stage director, invite code, shared clock, safe write, checkpoint,
  take, overdub, quantize, inspection report, warning code, fidelity level, Standalone
  edition, Online edition, status words, compatibility words).
- Appendix C: the 15 prohibited mistakes (E 10) each with: mistake | guard in this plan
  (design element, module, rule) | how a test would catch a regression.
- Appendix D: `docs/LEDGER.md` template (header, entry format with date, T sections done,
  decisions, assumptions, open issues, `RESUME:` line), `docs/STATUS.md` template (counts
  table per spec part and the Not-Implemented list), commit message examples, the phase
  gate checklist to paste into each ledger entry.
