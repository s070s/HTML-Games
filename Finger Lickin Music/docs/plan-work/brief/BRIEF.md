# BRIEF for drafting agents: Finger Lickin Music implementation plan

You are drafting ONE PART of a single large Markdown document:
`Finger Lickin Music/docs/IMPLEMENTATION-PLAN.md` in the repository `s070s/HTML-Games`.

The document's purpose: a later AI coding session (Opus 5.5, high effort) must be able to
implement the ENTIRE game from this document alone, in one go, without re-deriving design
decisions. Treat the reader as a strong engineer who has the spec and this plan and nothing
else. Every design choice must be decided, not left open, unless this brief marks it as an
explicit open question. "Decide it, write it down, make it testable."

The source specification is at (read it; it is ~3,200 lines, four parts):
`SPEC_PATH` (replaced in your prompt). The four parts and their short codes:
- B  = base spec "FLM-1.0" (sections 1-29, lines 1-1894)
- E  = "FLM-1.1.0 Edge Cases and Critical Failure Modes" (sections 1-13, lines 1896-2253)
- I  = "FLM-1.2.0 Essential Product Improvements" (sections 1-21, lines 2256-2699)
- P  = "FLM-1.3.0 Complete Maximum-Polish Checklist" (sections 1-22, lines 2705-3193)

Nothing is implemented yet. Never describe anything as done, implemented, verified, tested or
measured. The plan sets targets and procedures; results are recorded later.

## 1. Writing rules (mandatory)

- Plain ASCII only. No em dashes, en dashes, curly quotes, arrows, bullets other than `-`,
  box-drawing, or any non-ASCII byte. Use `-` for dashes, `->` for arrows, `"` for quotes.
- Markdown. Your part begins with a level-2 heading exactly as given in your prompt
  (`## N. Title`). Subsections use `### N.x Title` and `#### N.x.y Title`. Do not write a
  level-1 heading. Do not write front matter, a document title, or a contents list.
- Tables: GitHub Markdown tables with a header row and a `|---|` separator; every row must
  have the same number of columns as the header. Avoid `|` inside cells (write "or").
- Code blocks (fenced with three backticks and a language tag: `js`, `json`, `text`) for
  signatures, schemas, pseudocode, ASCII diagrams, and shell commands.
- Terminology: use exactly the names in sections 4-7 of this brief (module names, type
  names, field names, screen names, status words). Do not invent synonyms.
- Status vocabulary (only these five words, capitalized): Implemented, Partial, Blocked,
  Unimplemented, Deferred. At plan time every requirement is Unimplemented or Deferred.
  Compatibility vocabulary (only these): Supported, Partial, Conversion, Unsupported.
- Priorities: P0, P1, P2 exactly as the spec defines (B section 4).
- Be concrete: numbers with units, exact file names, exact function signatures, exact
  key names, exact error messages where the spec demands user-facing text.
- Do not pad. No motivational prose, no restating the spec at length; cite spec sections
  as `B 7.3`, `E 2.3`, `I 5.1`, `P 6.3` (part code, space, section number).
- Length: write as much as the part needs to be executable, no more. Typical parts run
  400-1,500 lines; the module-design parts may run 1,500-3,000 lines.
- Write the part to the output file path given in your prompt (UTF-8, LF). Overwrite if it
  exists. Then return the JSON your prompt asks for.

## 2. ID conventions (define IDs only in the part that owns them)

| ID form | Meaning | Owning part | Example |
|---|---|---|---|
| `R-B<sec>-<nn>` | Requirement from base spec section `<sec>` | Part 15 (traceability) | `R-B7.3-04` |
| `R-E<sec>-<nn>` | Requirement from edge-case spec | Part 15 | `R-E2.3-01` |
| `R-I<sec>-<nn>` | Requirement from improvements spec | Part 15 | `R-I5.1-02` |
| `R-P<sec>-<nn>` | Requirement from polish checklist | Part 15 | `R-P6.3-05` |
| `M-<nn>` | Source module (fixed list in section 4 below) | This brief | `M-05` |
| `ADR-<nn>` | Architecture decision (fixed list in section 3 below) | Part 2 elaborates | `ADR-03` |
| `T<pp>.<nn>` | Table-of-contents section, phase `pp` (00-16) | Part 11 | `T04.03` |
| `UT-<MM>-<nn>` | Unit test owned by module MM | Part 6 (module designs) | `UT-05-07` |
| `IT-<nnn>` | Integration test | Part 12 | `IT-014` |
| `FT-<nnn>` | File-format test | Part 12 | `FT-031` |
| `TT-<nnn>` | Timing test | Part 12 | `TT-006` |
| `PT-<nnn>` | Performance test | Part 12 | `PT-003` |
| `XT-<nnn>` | Cross-device/browser test | Part 12 | `XT-010` |
| `FI-<nnn>` | Fault-injection test | Part 12 | `FI-008` |
| `LT-<nnn>` | Live manual test | Part 12 | `LT-022` |
| `AT-<R-ID>` | Acceptance test for requirement R-ID (deterministic name) | Part 12 lists; anyone may reference | `AT-R-B7.3-04` |
| `RISK-<nn>` | Risk register entry | Part 13 | `RISK-07` |
| `SCR-<name>` | UI screen | Part 7 | `SCR-MainMenu` |
| `EVT-<name>` | Event bus topic | Part 4 | `EVT-transport.state` |

Requirement numbering rule for Part 15: walk the spec part in order; every bullet, numbered
item, table row, or sentence that states a "must/should/may" obligation becomes one row,
numbered `-01, -02, ...` within its spec section (use the spec's own section number, e.g.
`7.3`, `2.3`, `11.2`). Headings and prose that only explain are not requirements.
Because other parts cannot know these numbers in advance, other parts cite spec sections
(`B 7.3`) rather than R-IDs, except Parts 11 and 12 which are drafted after Part 15 exists
and must cite R-IDs read from the Part 15 file.

Test IDs: Part 6 agents define unit tests inline as `UT-<MM>-<nn>` (module number, two
digits). Part 12 compiles them into tables and adds IT/FT/TT/PT/XT/FI/LT tests and the
`AT-<R-ID>` acceptance tests (one for every P0 and P1 requirement).

## 3. Fixed architecture decisions (ADR-01..ADR-16). Do not reopen them.

- ADR-01 Single-file delivery via a build step. Source lives in `src/` as `shell.html` plus
  `NN-name.js` files; `node tools/build.mjs` concatenates them in file-name order at the
  `/*@@SCRIPT@@*/` marker into `FingerLickinMusic.html` (players open this; no build needed
  to play) and `FingerLickinMusic.test.html` (same plus self-test modules; gitignored).
  Precedent: `ClassTimeKiller/` in this repo. The build strips any per-file BOM, emits one
  leading UTF-8 BOM, LF endings, fails if output exceeds 2.5 MB, warns above 1.5 MB, and
  runs `node --check` on the concatenated script.
- ADR-02 Zero runtime dependencies. No CDN, no fonts, no fetched assets, no libraries.
  three.js was evaluated (MIT, ~650 KB minified, UMD build discontinued after r160; CDNs are
  blocked in the development environment; repo convention is own renderers) and rejected.
  All three existing games ship their own WebGL renderer with zero dependencies.
- ADR-03 Rendering: own renderer. WebGL2 preferred, WebGL1 path, then a 2D-canvas
  "Abstract" tier when neither initializes or after context loss fails to restore. Quality
  tiers: High, Balanced, Low, Abstract (2D). Procedural humanoid rigs built from capsules
  and boxes (no imported models). Flat/Lambert shading, one directional light plus ambient
  plus up to 4 point lights on High, soft blob shadows (no shadow maps).
- ADR-04 Audio: Web Audio API only. Data-driven instrument definitions covering all 128 GM
  programs via 16 family patch templates (subtractive, FM, pluck/Karplus-Strong, noise,
  organ additive, etc.) with per-program overrides; velocity layers; ADSR; per-instrument
  declared fidelity level. GM percussion (channel 10, keys 35-81) via synthesized drum
  voices. No bundled sampled sound bank (size and licensing). Optional user-loaded SoundFont
  (.sf2) reader is P2 and Deferred; the UI must say "synthesized" and never imply sampled
  fidelity. Lookahead scheduler on `AudioContext.currentTime`.
- ADR-05 Timeline: integer ticks, internal PPQ 960; TempoMap converts ticks to seconds via
  piecewise-constant tempo segments with precomputed cumulative seconds; the audio clock is
  the master; the render loop reads `transport.positionAt(audioCtx.currentTime)` and never
  advances musical time by frame count.
- ADR-06 Parsers: own implementations. SMF (format 0, 1, 2; PPQ and SMPTE division; running
  status; VLQ; limits). MusicXML (DOMParser; `.xml`/`.musicxml` uncompressed; `.mxl` via own
  ZIP reader supporting stored and deflate; partwise and timewise). Guitar Pro GP3, GP4, GP5
  binary formats only (`.gp3 .gp4 .gp5`); GP6/GP7 (`.gpx`, `.gp`) are Unsupported and
  reported as such by the format identifier. Audio files (`.wav .mp3 .ogg .flac` where the
  browser decodes them) via `decodeAudioData` become audio tracks only; never note data.
- ADR-07 Multiplayer: WebRTC DataChannel peer-to-peer, host-authoritative, 2-4 players,
  manual signaling by copy-paste invite/answer codes (precedent: IRON HORIZON in this repo),
  optional public STUN toggle (`stun:stun.l.google.com:19302`, off by default, documented
  as an external dependency). Optional Online edition: a zero-dependency Node relay server
  `server/relay.mjs` (WebSocket-like over `http` upgrade, implemented by hand, no npm) that
  relays the same protocol; documented, not required. Standalone edition needs neither.
  v1 multiplayer experiences: Synchronized Play (same chart, competitive scoring) and
  Cooperative Band (different tracks of one arrangement). Collaborative Studio is Deferred
  (P2) with its rules specified but not built.
- ADR-08 Storage: `localStorage` for settings, progression, project index, small projects;
  IndexedDB (`flm-db` v1, stores `projects`, `recordings`, `charts`, `characters`) for
  projects and recordings; versioned keys prefixed `flm.v1.`; safe write = write to a
  temporary key/record, verify by read-back, then swap, keeping one `.bak`; quota errors
  surface as a "Save failed" dialog offering Export. Export/download is the real backup.
- ADR-09 Encoding and endings: every new text file is UTF-8 with BOM, LF line endings.
  JS/HTML source: 2-space indent, `'use strict'`, no semicolon-free style, no transpiling,
  ES2020 syntax maximum (optional chaining, nullish coalescing allowed; no decorators, no
  top-level await, no modules in the browser bundle).
- ADR-10 Input: Pointer Events are primary for mouse and touch (with `touch-action: none` on
  controls and `preventDefault` on the gameplay surface), Keyboard events with `code` not
  `key`, Gamepad API polled in the render loop, Web MIDI optional and only when
  `navigator.requestMIDIAccess` exists in a secure context. All sources normalize to
  `InputEvent {source, control, type:'press'|'release', tPerf, tAudio}`.
- ADR-11 Testing: in-page self-test runner `window.FLM.selfTest(groupName?)` (test build
  only), driven headlessly by `node tools/selftest.mjs` using the preinstalled Playwright
  Chromium (`require('playwright')`, `chromium.launch()`; fall back to
  `executablePath: '/opt/pw-browsers/chromium'`); `node tools/perf.mjs` for budgets;
  `node tools/make-corpus.mjs` generates the synthetic test corpus into `test-corpus/`
  (checked in). Unit tests live in `src/9N-test-*.js` and are excluded from the shipped
  build.
- ADR-12 Security: CSP meta `default-src 'none'; script-src 'unsafe-inline'; style-src
  'unsafe-inline'; img-src data: blob:; media-src data: blob:; connect-src 'self'` (the
  connect-src is widened only in the Online edition build flag for the relay URL; WebRTC
  is not governed by connect-src). All imported text is inserted via `textContent`, never
  `innerHTML`. Parsers enforce the limits in section 6 below.
- ADR-13 UI: DOM overlay for menus, dialogs, HUD text and touch pads; `<canvas id="view">`
  for the 3D stage and note highway (the highway is drawn on the same WebGL canvas in 3D
  tiers and on a 2D canvas in the Abstract tier). CSS custom properties for theme; one
  font stack `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; no web fonts.
- ADR-14 Built-in content: five original demo arrangements defined as compact data
  (`src/30-content.js`), 60-120 s each, covering: pop-rock band (drums, bass, guitar, keys),
  piano solo, electronic (synths, drums), jazz trio, and a dance-oriented 128 BPM track.
  No copyrighted melodies. Each ships with instrument charts at four difficulties and a
  dance chart at three difficulties, generated deterministically at load by the chart
  generators (not hand-authored), plus one tutorial sequence.
- ADR-15 Progression: local only; performance history, personal bests, achievements,
  cosmetic unlocks, daily challenge seeded from the local date (deterministic). No
  accounts, no telemetry.
- ADR-16 Development ledger: `docs/LEDGER.md`, newest entry first, each entry ends with a
  `RESUME:` line naming the next T section; it is updated at every phase gate and before
  any pause.

## 4. Fixed module map (M-01..M-31) and source files

Load order is file-name order. A module may depend only on lower-numbered modules plus
the event bus. Every module attaches exactly one namespace object to `FLM` (for example
`FLM.Audio`) and nothing else to `window`. Modules are plain IIFEs with `'use strict'`.

| ID | File | Namespace | Responsibility (one line) |
|---|---|---|---|
| M-01 | `src/01-core.js` | `FLM.Core` | `FLM` namespace, VERSION, `Emitter` event bus, utilities (clamp, lerp, uid, deepClone, assert, formatTime), `Log` ring buffer (500 entries), `Caps` capability detection, `ErrorReporter`, `Diagnostics` export |
| M-02 | `src/02-theory.js` | `FLM.Theory` | pitch classes, enharmonic spelling, scales (data-driven table), chords, intervals, inversions, key signatures, GM program names, GM drum names, note name <-> MIDI number |
| M-03 | `src/03-model.js` | `FLM.Model` | `Song`, `Track`, `NoteEvent`, `ControlEvent`, `ProgramEvent`, `TempoMap`, `MeterMap`, `KeyMap`, `Marker`, tick<->seconds, ordering, validation, `ImportWarning` |
| M-04 | `src/04-transport.js` | `FLM.Transport` | transport state machine, position, speed, loop region, count-in, seek, pause/resume, audio-clock anchoring, scheduler cursor |
| M-05 | `src/05-audio.js` | `FLM.Audio` | AudioContext lifecycle, bus graph (master, metronome, per-track channels with gain/pan/mute/solo), `VoiceAllocator`, `Scheduler`, panic, metronome, latency estimate, peak meter |
| M-06 | `src/06-instruments.js` | `FLM.Instruments` | instrument definition table (128 programs + drum kit), patch templates, `Voice` synthesis graphs, velocity layers, fidelity declarations, program change handling |
| M-07 | `src/07-input.js` | `FLM.Input` | keyboard, pointer/touch, gamepad, optional Web MIDI; normalized `InputEvent`; remapping; focus-loss release; key-repeat suppression; calibration offsets; `InputState` |
| M-08 | `src/08-mapping.js` | `FLM.Mapping` | mapping profiles A-F; input -> musical actions; `ChartGenerator` (source arrangement -> four-button `Chart` per difficulty, deterministic) |
| M-09 | `src/09-rhythm.js` | `FLM.Rhythm` | `Chart` and `ChartNote` model, judgment windows per difficulty, `Judge`, `Score` (deterministic integers), combo, accuracy, holds, section stats, `PerformanceSummary` |
| M-10 | `src/10-midi.js` | `FLM.Midi` | SMF reader (0/1/2) and writer, limits, warnings |
| M-11 | `src/11-zip.js` | `FLM.Zip` | ZIP central-directory reader, stored and deflate (own inflate), CRC32 |
| M-12 | `src/12-musicxml.js` | `FLM.MusicXml` | MusicXML importer (uncompressed and .mxl via M-11) |
| M-13 | `src/13-guitarpro.js` | `FLM.GuitarPro` | GP3/GP4/GP5 reader |
| M-14 | `src/14-import.js` | `FLM.Import` | import pipeline: validate, identify, adapter registry, normalize, `InspectionReport`, audio adapter (`decodeAudioData`), compatibility matrix data |
| M-15 | `src/15-project.js` | `FLM.Project` | `Project` (Song + charts + characters + mixer + settings), `flm-project` v1 schema, validation, migrations, `UndoStack` command pattern, autosave checkpoints |
| M-16 | `src/16-storage.js` | `FLM.Storage` | localStorage and IndexedDB wrapper, safe write, quota handling, project index, export/download/import-file helpers |
| M-17 | `src/17-studio.js` | `FLM.Studio` | track lifecycle, `Recorder` (MIDI event capture with count-in), overdub, loop record, piano-roll edit operations, quantize, mixer state, section markers |
| M-18 | `src/18-render.js` | `FLM.Render` | WebGL2/WebGL1 init, context loss/restore, scene graph (`Node`, `Mesh`, `Material`), camera, lights, quality tiers, draw batching, resource disposal, 2D fallback surface |
| M-19 | `src/19-rig.js` | `FLM.Rig` | humanoid skeleton (joint list), attachment points, procedural mesh from `CharacterConfig`, pose blending, IK for hands (two-bone) |
| M-20 | `src/20-animation.js` | `FLM.Animation` | per-instrument animation controllers (keys, guitar, bass, drums, strings, winds/brass, percussion, synth, vocal/abstract), abstract visualizers, `StageDirector`, beat and section indicators |
| M-21 | `src/21-stage.js` | `FLM.Stage` | stage composition, performer slots, props (instruments as meshes), effects, camera presets, note highway rendering |
| M-22 | `src/22-character.js` | `FLM.Character` | `CharacterConfig` schema, options catalog, presets, validation, randomize, rig-affecting vs visual-only split |
| M-23 | `src/23-dance.js` | `FLM.Dance` | `DanceChart` model and validation, `DanceChartGenerator`, step input mapping, dance scoring (reuses `FLM.Rhythm.Judge`), `ChoreographyController` |
| M-24 | `src/24-net.js` | `FLM.Net` | WebRTC P2P (invite/answer codes), optional relay transport, protocol v1 messages, clock sync, room/session state, reconnection, validation and rate limits |
| M-25 | `src/25-progress.js` | `FLM.Progress` | performance history, personal bests, achievements, cosmetic unlocks, daily challenge |
| M-26 | `src/26-ui.js` | `FLM.UI` | screen stack, navigation, focus management, dialogs, toasts, sliders/inputs, responsive layout, safe areas, touch pads, HUD, settings widgets, reduced motion |
| M-27 | `src/27-screens.js` | `FLM.Screens` | all screens (SCR-*): first launch, main menu, quick play, instrument mode, free play, studio, library, import inspection, dance, multiplayer, customization, settings, help, about/licenses, diagnostics, tutorial, results |
| M-28 | `src/28-modes.js` | `FLM.Modes` | mode manager: enter/leave with full teardown contract, shared transport binding per mode, pause on visibility change, interruption handling |
| M-29 | `src/29-boot.js` | `FLM.Boot` | init order, capability gate, audio unlock gesture, first-launch flow, global error handlers, `window.FLM` public surface |
| M-30 | `src/30-content.js` | `FLM.Content` | five built-in demo arrangements as data, tutorial sequence data, presets |
| M-31 | `src/90-selftest.js`, `src/91-test-*.js` | `FLM.SelfTest` | test runner and test groups (test build only) |

Also fixed: `src/shell.html` (HTML head, CSP meta, viewport/apple meta, CSS, DOM scaffold:
`#app`, `canvas#view`, `canvas#flat` (2D fallback), `#overlay`, `#hud`, `#touch`, `#toast`,
`#rotate`, `#fatal`, `<noscript>`, and the `/*@@SCRIPT@@*/` marker), `tools/build.mjs`,
`tools/selftest.mjs`, `tools/perf.mjs`, `tools/make-corpus.mjs`, `server/relay.mjs`,
`test-corpus/` (generated files, checked in), `docs/IMPLEMENTATION-PLAN.md` (this document),
`docs/SPECIFICATION.txt`, `docs/LEDGER.md`, `docs/COMPATIBILITY.md` (published matrix,
written in Phase 12), `docs/FINAL-REPORT.md` (Phase 16), `README.md`.

Folder: `Finger Lickin Music/` at the repo root, next to `Beat Em Up/`, `ClassTimeKiller/`,
`Mech Flight Sim/`. Shipped file: `Finger Lickin Music/FingerLickinMusic.html`.

## 5. Fixed data model names (use exactly)

```js
// Core musical model (M-03)
Song { id, title, artist, source:{format, fileName, version, warnings:[ImportWarning]},
       ppq:960, tempoMap:TempoMap, meterMap:MeterMap, keyMap:KeyMap, tracks:[Track],
       markers:[Marker], durationTicks, createdAt, modifiedAt }
Track { id, name, channel, program, isDrums, events:[Event], mix:{gain:1, pan:0, mute:false, solo:false},
        color, visible, lockedSource:true }
Event = NoteEvent | ControlEvent | ProgramEvent | PitchBendEvent | TextEvent
NoteEvent { kind:'note', tick, durTicks, pitch, velocity, offVelocity, channel, id }
ControlEvent { kind:'cc', tick, controller, value, channel }      // 1 mod, 7 vol, 10 pan, 11 expr, 64 sustain, 121 reset, 123 all-notes-off
ProgramEvent { kind:'program', tick, program, bankMsb, bankLsb, channel }
PitchBendEvent { kind:'bend', tick, value /* -8192..8191 */, channel }
TextEvent { kind:'text', tick, type, text }                       // meta text, lyrics, markers
TempoMap { entries:[{tick, usPerQuarter, secondsAt}], ticksToSeconds(t), secondsToTicks(s) }
MeterMap { entries:[{tick, numerator, denominator}], barAt(tick), beatAt(tick) }
KeyMap   { entries:[{tick, fifths, mode:'major'|'minor'}] }
Marker   { tick, label, kind:'section'|'cue' }
ImportWarning { code, message, severity:'info'|'warn'|'error', location:{track, tick} }

// Gameplay (M-08, M-09)
Chart { id, songId, trackId, instrument, difficulty:'beginner'|'intermediate'|'advanced'|'expert',
        profile:'A'|'B'|'C'|'D'|'E'|'F', notes:[ChartNote], generatorVersion, settingsHash }
ChartNote { id, tick, durTicks, lanes:[0..3], sourceEventIds:[], pitches:[], isHold }
Judgment = 'perfect'|'great'|'good'|'miss'
JudgeResult { noteId, judgment, deltaMs, tInput }
ScoreState { score, combo, maxCombo, counts:{perfect,great,good,miss}, judged, total, accuracy, completion }

// Dance (M-23)
DanceChart { id, songId, difficulty:'easy'|'normal'|'hard', steps:[DanceStep], generatorVersion, layout:'arrows'|'pads' }
DanceStep { id, tick, durTicks, directions:[0..3] /* 0 left,1 down,2 up,3 right */, isHold }

// Input (M-07)
InputEvent { source:'keyboard'|'pointer'|'gamepad'|'midi', control:string, type:'press'|'release',
             tPerf /* performance.now ms */, tAudio /* mapped audio seconds */, pressure }
Calibration { inputOffsetMs:0, audioLatencyMs:0, visualLeadMs:0 }

// Character (M-22)
CharacterConfig { id, name, body:'slim'|'average'|'broad', heightScale:0.9..1.1, skin, hair:{style,color},
                  face, top:{style,color}, bottom:{style,color}, shoes:{style,color}, accessories:[],
                  instrument, slot:0..4, animationStyle:'calm'|'normal'|'energetic', version:1 }

// Project (M-15)
Project { format:'flm-project', version:1, id, name, song:Song, charts:[Chart], danceCharts:[DanceChart],
          characters:[CharacterConfig], mixer:{master}, settings:{key, scale, tempoOverride, timeSig},
          recordings:[RecordingTake], history:{}, createdAt, modifiedAt, sizeBytes }
RecordingTake { id, trackId, startedAt, events:[NoteEvent], countIn, tempoAtRecord, status:'complete'|'aborted' }

// Multiplayer (M-24) envelope
NetMessage { v:1, type, seq, from, tSend, payload }
```

Transport states: `stopped | countin | playing | paused | recording`. Modes:
`menu | quickplay | instrument | freeplay | studio | library | import | dance | multiplayer |
customize | settings | help | about | diagnostics | tutorial | results`.

Mapping profiles (B 8.3): A Four-note lanes, B Interval, C Chord, D Scale, E
Instrument-specific, F Rhythm/percussion.

Difficulty names: instrument charts `beginner, intermediate, advanced, expert`; dance
charts `easy, normal, hard`.

## 6. Fixed numeric budgets and limits (use these numbers everywhere)

| Item | Value |
|---|---|
| Shipped HTML size | target <= 1.5 MB, build fails > 2.5 MB |
| Load to main menu | <= 1.5 s desktop, <= 3.0 s mid-range mobile |
| Time to first playable interaction (Quick Play demo) | <= 5 s desktop, <= 8 s mobile from file open |
| Frame rate | High 60 FPS desktop; Balanced 60 target / 45 floor mobile; Low 30; auto-downgrade when p95 frame time > 33 ms over 5 s |
| Scheduler | lookahead 120 ms, tick 25 ms (setInterval), events scheduled on audio clock |
| Scheduling precision | scheduled start within 1 ms of intended audio time; no cumulative drift (abs drift < 2 ms after 10 min loop) |
| Input timestamping | `event.timeStamp` -> audio time via anchored offset; added processing <= 1 frame |
| Memory | <= 300 MB desktop, <= 150 MB mobile steady; growth <= 10 MB after 20 enter/leave cycles |
| Polyphony | 64 voices desktop, 32 mobile; stealing order: released-quietest, then oldest |
| Tracks per project | 32 |
| Import limits | file <= 25 MB (MIDI/MusicXML/GP), audio <= 100 MB; events <= 1,000,000; tracks <= 128; chord size <= 16; parse time budget 5 s then abort with error |
| Project JSON | localStorage path <= 2 MB per project; IndexedDB path up to quota; serialization <= 200 ms for 100k events |
| Multiplayer | 2-4 players; state 10 Hz; inputs immediate; clock sync 8 samples at start then every 10 s; target sync error <= 20 ms; message <= 64 KB; avatar config <= 4 KB; 60 messages/s per peer rate limit |
| Judgment windows (half-width ms: perfect/great/good) | beginner 45/90/135; intermediate 35/70/110; advanced 25/55/90; expert 18/40/70 |
| Scoring | perfect 100, great 70, good 40, miss 0; multiplier 1 + floor(combo/10) capped at 4; score integer; accuracy = points / (100 * judged) |
| Hold notes | release judged at hold end with the same windows; early release > good window = hold break (counts as miss for the tail, head judgment kept) |
| Touch targets | minimum 56x56 CSS px, 8 px gap; four pads span the bottom 28% of the viewport in portrait and the right or bottom 24% in landscape (configurable) |
| Count-in | 1 or 2 bars, metronome accented on beat 1 |
| Autosave | at safe points: on stop, on track add/delete, every 60 s while idle in Studio; never during recording or playback |
| Log ring buffer | 500 entries; diagnostics export <= 200 KB |
| Visual lead time | default 1,500 ms highway travel, range 600-3,000 ms |

GM mapping policy: all 128 programs mapped to 16 family templates: Piano, Chromatic
Percussion, Organ, Guitar, Bass, Strings, Ensemble, Brass, Reed, Pipe, Synth Lead, Synth
Pad, Synth Effects, Ethnic, Percussive, Sound Effects. Fidelity level declared per program:
`synth-basic` or `synth-velocity` (all v1 programs), `sampled` (none in v1). Drum kit: keys
35-81 each mapped to one of 12 synthesized drum voices (kick, snare, rimshot, clap, tom,
closed hat, open hat, pedal hat, crash, ride, cowbell/misc, shaker/misc).

## 7. Fixed UI screens (SCR-*) and the main menu

Main menu entries (B 6.2), in this order: Quick Play, Instrument Mode, Free Play, Studio,
Song Library, Import Music, Dance Mode, Multiplayer, Characters, Settings, Help and
Controls, About. Unavailable entries show a disabled state with a one-line reason.

Screens: `SCR-FirstLaunch`, `SCR-MainMenu`, `SCR-QuickPlay`, `SCR-Instrument`,
`SCR-FreePlay`, `SCR-Studio`, `SCR-Library`, `SCR-ImportInspect`, `SCR-Dance`,
`SCR-Multiplayer`, `SCR-Characters`, `SCR-Settings`, `SCR-Help`, `SCR-About`,
`SCR-Diagnostics`, `SCR-Tutorial`, `SCR-Results`, `SCR-Pause`, dialogs `DLG-*`.

Default desktop keys: lanes `KeyA KeyS KeyK KeyL`; dance `ArrowLeft ArrowDown ArrowUp
ArrowRight` with alternates `KeyD KeyF KeyJ KeyK`; pause `Escape`; panic `Space` while
paused or `KeyP` (configurable); octave `KeyQ`/`KeyE`; profile switch `Digit1-6` in Free
Play.

## 8. Repository conventions to restate where relevant

- Commit messages start with `Finger Lickin Music: ` and describe the change in plain
  words; docs commits `Finger Lickin Music docs: ...`.
- Push only when the owner says so (repo rule in `.claude/project-profile.md`).
- In-browser self-test is the gate, like the other games (`__IH.selfTest()`,
  `window.BREAKPOINT.selfTest()`, `__CTK.selfTest()`); ours is `window.FLM.selfTest()`.
- Line endings LF; BOM at file start; `.gitignore` already ignores `node_modules/`, `dist/`;
  add `Finger Lickin Music/FingerLickinMusic.test.html`.

## 9. Explicit open questions (the only ones allowed to remain open)

- OQ-1 Whether iOS Safari delivers simultaneous Pointer Events for 4 touches on all
  supported devices; plan a fallback to Touch Events if XT tests fail.
- OQ-2 Whether `OfflineAudioContext` WAV export is acceptable for mixes on iOS (memory);
  plan MediaRecorder capture as the alternative.
- OQ-3 Public STUN availability in the owner's network; LAN play works without it.
Everything else is decided in this brief or must be decided in your part.
