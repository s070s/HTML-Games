## 4. Module map, interfaces, and integration

This part fixes how the thirty-one modules of the brief (section 4) fit together: what each
one owns, what it may reference, what it emits and consumes on the event bus, how the
application starts, how the three clocks relate, which invariants separate the subsystems,
how a mode is entered and left without leaking, what the page exposes globally, and how
errors travel. Signatures and algorithms live in Part 6; this part owns the names of the
public API members, the `EVT-*` topics and their payloads, and the integration contracts.

Conventions used in this part:

- "Depends on" lists direct dependencies only (modules whose namespace the source text
  references). Every module also depends on M-01, which is omitted from the column.
- "Emits" and "Consumes" list topics on the single event bus `FLM.Core.bus`. Topic names are
  written without the `EVT-` prefix inside code and tables; `EVT-transport.state` and
  `transport.state` denote the same topic.
- Payload field types use a compact notation: `n` number, `i` integer, `s` string, `b`
  boolean, `[T]` array of T, `T?` nullable. Union string values are written with "or".

### 4.1 Module table

| ID | File | Namespace | Purpose | Depends on | Public API names | Emits | Consumes |
|---|---|---|---|---|---|---|---|
| M-01 | `src/01-core.js` | `FLM.Core` | namespace root, VERSION, module registration, event bus, utilities, log ring, capability detection, error reporting, diagnostics export, timer, RAF and DOM-listener wrappers | none | `VERSION`, `define`, `modules`, `bus`, `Emitter`, `timers`, `raf`, `dom`, `clamp`, `lerp`, `smoothstep`, `uid`, `deepClone`, `assert`, `formatTime`, `fnv1a32`, `Prng`, `Log`, `Caps`, `ErrorReporter`, `Diagnostics`, `urlParams`, `Text` (`get`, `has`, `all`), `Faults` (`NAMES`, `set`, `clear`, `clearAll`, `active`, `take`, `list`), `fnv1a32Hex`, `now` | `error` | none |
| M-02 | `src/02-theory.js` | `FLM.Theory` | pitch classes, spelling, scales, chords, intervals, inversions, key signatures, GM names | none | `PITCH_CLASSES`, `SCALES`, `CHORDS`, `INTERVALS`, `GM_PROGRAMS`, `GM_DRUMS`, `GM_FAMILIES`, `familyOf`, `noteName`, `midiFromName`, `spell`, `scaleDegrees`, `chordNotes`, `invert`, `recognizeChord`, `keyFromFifths`, `fifthsFromKey`, `transpose` | none | none |
| M-03 | `src/03-model.js` | `FLM.Model` | Song, Track, events, TempoMap, MeterMap, KeyMap, Marker, ordering, pairing, validation, indexes, ImportWarning | M-02 | `Song`, `Track`, `Events`, `compareEvents`, `insertEvent`, `removeEvent`, `pairNotes`, `deriveSustain`, `TrackIndex`, `TempoMap`, `MeterMap`, `KeyMap`, `Marker`, `ImportWarning`, `validate`, `durationTicks`, `clone`, `PPQ` | none | none |
| M-04 | `src/04-transport.js` | `FLM.Transport` | transport state machine, position, speed, loop, count-in, seek, anchoring, scheduler cursor | M-03 | `create`, `main`, `STATES`, `Transport` (`load`, `unload`, `play` (opts `{countInBars, fromTick, atAudio}`), `pause`, `resume` (opts `{atAudio}`), `stop`, `record`, `seek`, `setSpeed`, `setLoop`, `clearLoop`, `setCountIn`, `setClock`, `state`, `positionAt`, `tickAt`, `audioTimeAt`, `countinTick`, `pullDue`, `resetCursor`, `heldNotes`, `song`) | `transport.state`, `transport.seek`, `transport.loop`, `transport.loopSet`, `transport.speed`, `transport.tempoSource`, `transport.end`, `transport.loaded` | none |
| M-05 | `src/05-audio.js` | `FLM.Audio` | AudioContext lifecycle, bus graph, channel strips, voice pool, scheduler, panic, metronome, latency, peak meter | M-03, M-04 | `init`, `createEngine`, `unlock`, `resume`, `isUnlocked`, `ctx`, `clock`, `state`, `close`, `master`, `limiter`, `metronomeBus`, `ChannelStrip`, `createStrip`, `disposeStrip`, `strips`, `stripCount`, `nodeCount`, `setSolo`, `setMute`, `VoiceAllocator`, `Scheduler` (`bind`, `unbind`, `start`, `stop`, `pending`, `running`, `tickOnce`, `stats`, `setInstruments`, `setTrackFilter`, `liveNoteOn`, `liveNoteOff`, `liveControl`), `panic`, `Metronome`, `latency`, `peak`, `setMasterGain`, `masterGain`, `setMetronomeGain`, `metronomeGain`, `setPracticeGain`, `captureMix`, `fadeOut`, `fadeIn`, `sampleRate`, `now`, `debugInject`, `debugClear` | `audio.state`, `audio.unlocked`, `audio.voices`, `audio.panic`, `audio.peak`, `sched.noteOn`, `sched.noteOff`, `sched.program`, `sched.cc`, `sched.bend`, `sched.beat`, `sched.marker`, `sched.stall` | `transport.state`, `transport.seek`, `transport.loop`, `transport.speed`, `settings.changed` |
| M-06 | `src/06-instruments.js` | `FLM.Instruments` | instrument definition table, patch templates, Voice graphs, velocity layers, fidelity, program and controller handling | M-02, M-03, M-05 | `DEFINITIONS`, `FAMILIES`, `DRUM_VOICES`, `drumVoiceFor`, `definition`, `fidelity`, `noteOn`, `noteOff`, `allNotesOff`, `program`, `controller`, `pitchBend`, `Voice`, `warmup`, `activeVoices`, `liveNoteOn`, `liveNoteOff`, `attach`, `onGraphRebuilt`, `control`, `controlLive`, `programOf`, `setTrackProgram`, `releaseTrack`, `stats`, `DRUM_MAP`, `VERSION` | none | `sched.noteOn`, `sched.noteOff`, `sched.program`, `sched.cc`, `sched.bend`, `audio.panic`, `audio.state` |
| M-07 | `src/07-input.js` | `FLM.Input` | keyboard, pointer, gamepad, optional MIDI; normalized InputEvent; remapping; focus-loss release; anchor | M-05 | `init`, `detach`, `bind`, `unbind`, `context`, `boundSurfaces`, `listenerCount`, `CONTROLS`, `DEFAULT_MAPS`, `getMap`, `setMap`, `remap`, `unmap`, `resetMap`, `controlsFor`, `conflicts`, `held`, `State` (`isHeld`, `pressedAt`, `owner`), `releaseAll`, `perfToAudio`, `anchor`, `resampleAnchor`, `pollGamepad`, `enableMidi`, `disableMidi`, `devices`, `setMidiPassThrough`, `setCalibration`, `calibration`, `layoutChanged`, `synthesize`, `debugInject`, `debugClear` | `input.event`, `input.device`, `input.anchor`, `input.map` | `audio.state`, `audio.unlocked`, `transport.state` |
| M-08 | `src/08-mapping.js` | `FLM.Mapping` | profiles A-F, input to musical actions, ChartGenerator | M-02, M-03, M-07 | `PROFILES`, `Mapper` (`setProfile`, `setContext`, `onInput`, `actions`, `release`), `ChartGenerator` (`generate`, `generateAsync`, `preview`, `VERSION`), `settingsHash`, `laneForPitch`, `DRUM_LANES` | `chart.ready` | none |
| M-09 | `src/09-rhythm.js` | `FLM.Rhythm` | Chart playback cursor, Judge, Score, combo, accuracy, holds, section stats, PerformanceSummary, replay | M-03, M-04, M-07, M-08 | `WINDOWS`, `SCORING`, `Judge` (`bind`, `load`, `setCalibration`, `setWindows`, `setActive`, `attach`, `detach`, `onInput`, `tick`, `restart`, `finish`, `dispose`, `state`, `summary`, `sections`, `results`, `inputLog`, `nextNotes`, `cursor`), `Score`, `sectionsOf`, `PerformanceSummary`, `replay`, `performanceSong`, `windowsFor`, `laneOf`, `judgmentFor`, `roundMs`, `POINTS`, `CHORD_TOLERANCE_MS`, `calibration`, `setCalibration` | `judge.result`, `score.update`, `chart.finished` | `input.event`, `transport.state`, `transport.seek`, `transport.loop` |
| M-10 | `src/10-midi.js` | `FLM.Midi` | SMF reader (0, 1, 2) and writer, limits, warnings | M-03 | `parse`, `parseAsync`, `write`, `identify`, `LIMITS`, `WARNINGS` | none | none |
| M-11 | `src/11-zip.js` | `FLM.Zip` | ZIP central-directory reader, stored and deflate, CRC32 | none | `read`, `entries`, `extract`, `inflate`, `crc32`, `LIMITS` | none | none |
| M-12 | `src/12-musicxml.js` | `FLM.MusicXml` | MusicXML importer, uncompressed and .mxl | M-02, M-03, M-11 | `parse`, `parseAsync`, `parseMxl`, `identify`, `DYNAMICS`, `UNSUPPORTED`, `LIMITS`, `WARNINGS` | none | none |
| M-13 | `src/13-guitarpro.js` | `FLM.GuitarPro` | GP3, GP4, GP5 reader | M-02, M-03 | `parse`, `parseAsync`, `identify`, `SUPPORTED_VERSIONS`, `UNSUPPORTED_SIGNATURES`, `LIMITS`, `WARNINGS` | none | none |
| M-14 | `src/14-import.js` | `FLM.Import` | pipeline: validate, identify, adapters, normalize, InspectionReport, audio adapter, compatibility data | M-03, M-05, M-08, M-10, M-11, M-12, M-13 | `identify`, `validateFile`, `importFile`, `cancel`, `adapters` (`register`, `list`, `for`), `InspectionReport`, `recommendTrack`, `AudioTrack`, `decodeAudio`, `audioBufferCount`, `releaseAudio`, `COMPATIBILITY`, `LIMITS`, `debugInject`, `debugClear` | `import.progress`, `import.done`, `import.failed` | none |
| M-15 | `src/15-project.js` | `FLM.Project` | Project schema v1, validation, migrations, UndoStack, commands, dirty tracking, size estimate, song catalog | M-03, M-08, M-09 | `create`, `fromSong`, `validate`, `migrate`, `serialize`, `deserialize`, `estimateSize`, `checkpointDoc`, `current`, `setCurrent`, `isDirty`, `markClean`, `UndoStack`, `Commands` (`setCharacter`, `setAudioOffset`; the full list is 6.15.2), `Autosave`, `guard`, `SCHEMA`, `ERRORS`, `Catalog` (`registerBuiltin`, `registerTutorial`, `register`, `unregister`, `list`, `get`, `getSong`, `tutorial`) | `project.changed`, `project.loaded`, `project.dirty` | none |
| M-16 | `src/16-storage.js` | `FLM.Storage` | localStorage and IndexedDB wrapper, safe write, quota, project index, autosave, export, import-file helpers, tab lock | M-15 | `open`, `state`, `isAvailable`, `get`, `set`, `remove`, `keys`, `usedBytes`, `safeWrite`, `idb` (`get`, `put`, `delete`, `list`, `clear`), `loadSettings`, `saveSettings`, `flushSettings`, `saveProject`, `loadProject`, `loadBackup`, `deleteProject`, `listProjects`, `projectExists`, `renameProject`, `autosave`, `checkpoints`, `restoreCheckpoint`, `recordings`, `characters`, `exportBlob`, `download`, `readFile`, `pickFile`, `enableDrop`, `estimateQuota`, `lastQuota`, `lock`, `unlock`, `lockState`, `isLockedByOther`, `tabId`, `reset`, `counters`, `debugInject`, `debugClear`, `KEYS`, `ERRORS` | `project.saved`, `project.saveFailed`, `storage.quota`, `storage.state`, `storage.lock`, `settings.changed` | `project.changed` |
| M-17 | `src/17-studio.js` | `FLM.Studio` | track lifecycle, Recorder, overdub, loop record, piano-roll edits, quantize, mixer binding, markers, autosave scheduling | M-03, M-04, M-05, M-07, M-08, M-15, M-16 | `Session` (`open`, `close`, `addTrack`, `deleteTrack`, `renameTrack`, `duplicateTrack`, `reorderTrack`, `setInstrument`, `addAudioTrack`, `selectTrack`, `ensureEditable`, `setMix`, `setMaster`, `mixerState`, `select`, `move`, `resize`, `remove`, `setVelocity`, `copy`, `paste`, `quantize`, `addMarker`, `removeMarker`, `bindMixer`, `cut`, `setGrid`, `setTempo`, `setLoop`, `clearLoop`, `setMetronome`, `sections`, `playSection`, `overview`, `pianoRollData`, `undoLabel`, `counters`), `Recorder` (`arm`, `disarm`, `start`, `stop`, `abort`, `state`, `take`, `takes`, `commitTake`, `discardTake`, `liveEvents`), `LIMITS`, `GRID` | `studio.recording`, `studio.take`, `studio.selection` | `input.event`, `transport.state`, `transport.loop`, `project.changed` |
| M-18 | `src/18-render.js` | `FLM.Render` | WebGL2, WebGL1 init, context loss, scene graph, camera, lights, tiers, batching, disposal, stats, 2D fallback | none | `init`, `renderer`, `TIERS`, `tier`, `setTier`, `pickTier`, `Math3` (`vec3`, `quat`, `mat4`), `Scene`, `Node`, `Mesh`, `Material`, `Camera`, `Light`, `Primitives`, `Texture`, `setAutoTier`, `holdAutoTier`, `autoTierState`, `startLoop`, `stopLoop`, `loopRunning`, `stats`, `counters`, `dispose`, `Flat2D`, `resize`, `debugInject`, `debugClear` | `render.tier`, `render.contextLost`, `render.contextRestored`, `render.stats` | `settings.changed` |
| M-19 | `src/19-rig.js` | `FLM.Rig` | humanoid skeleton, attachments, procedural mesh from CharacterConfig, pose blend, two-bone IK | M-18 | `JOINTS`, `ATTACHMENTS`, `createRig`, `Rig` (`setLengths`, `pose`, `setPose`, `blend`, `ikArm`, `attachment`, `buildMesh`, `applyConfig`, `dispose`), `Pose`, `validateAttachments` | none | none |
| M-20 | `src/20-animation.js` | `FLM.Animation` | per-instrument controllers, abstract visualizers, StageDirector, beat and section indicators | M-03, M-04, M-18, M-19 | `controllerFor`, `Controller`, `CONTROLLERS`, `Visualizer`, `StageDirector`, `BeatIndicator`, `Mixer` (`add`, `remove`, `update`, `dispose`), `INTENSITY`, `ANTICIPATION_MS` | `director.cut` | `sched.noteOn`, `sched.noteOff`, `sched.cc`, `sched.beat`, `sched.marker`, `transport.state`, `transport.seek`, `render.tier`, `settings.changed` |
| M-21 | `src/21-stage.js` | `FLM.Stage` | stage geometry, performer slots, props, effects, camera presets, note highway (3D and Flat2D) | M-03, M-04, M-18, M-19, M-20 | `build`, `Stage` (`addPerformer`, `removePerformer`, `setCamera`, `camera`, `highway`, `effects`, `update`, `resize`, `dispose`), `CAMERA_PRESETS`, `SLOTS`, `PROPS`, `Highway` (`setChart`, `setLead`, `update`, `clear`) | none | `chart.ready`, `judge.result`, `sched.noteOn`, `sched.beat`, `director.cut`, `render.tier`, `render.contextRestored`, `settings.changed` |
| M-22 | `src/22-character.js` | `FLM.Character` | CharacterConfig schema, options catalog, presets, validation, randomize, rig-affecting split | M-19 | `OPTIONS`, `CATEGORIES`, `PRESETS`, `registerPresets`, `create`, `validate`, `normalize`, `randomize`, `diff`, `isRigAffecting`, `serialize`, `deserialize`, `forNet`, `applyTo`, `VERSION` | `character.changed` | none |
| M-23 | `src/23-dance.js` | `FLM.Dance` | DanceChart model, validation, generator, step mapping, dance scoring, ChoreographyController | M-03, M-04, M-07, M-09, M-19, M-20 | `validate`, `DanceChartGenerator` (`generate`, `VERSION`), `DIRECTIONS`, `controlToDirection`, `DanceJudge` (`bind`, `onInput`, `tick`, `restart`, `finish`, `dispose`, `state`), `WINDOW_MAP`, `ChoreographyController`, `importChart`, `exportChart`, `FAILURE_RULES`, `LAYOUTS` | `chart.ready` | `input.event`, `transport.state`, `transport.seek` |
| M-24 | `src/24-net.js` | `FLM.Net` | WebRTC P2P, optional relay transport, protocol v1, clock sync, room state, reconnection, validation, rate limits | M-03, M-04, M-05, M-09, M-22 | `PROTOCOL_VERSION`, `MESSAGE_TYPES`, `createRoom`, `createInvite`, `joinWithInvite`, `joinRelay`, `admit`, `acceptAnswer`, `bindGame`, `encodeCode`, `decodeCode`, `send`, `broadcast`, `close`, `state`, `role`, `peers`, `connectionCount`, `setStun`, `setRelayUrl`, `Clock` (`offsetMs`, `sharedNow`, `toLocalAudio`, `toShared`), `validateMessage`, `RateLimiter`, `diagnostics`, `PRIVACY_TEXT`, `LIMITS`, `debugInject`, `debugClear` | `net.state`, `net.peer`, `net.message`, `net.sync` | `judge.result`, `score.update`, `chart.finished`, `audio.state`, `input.event`, `transport.state`, `character.changed` |
| M-25 | `src/25-progress.js` | `FLM.Progress` | performance history, personal bests, achievements, cosmetic unlocks, daily challenge | M-09, M-15, M-16 | `record`, `history`, `best`, `bests`, `ACHIEVEMENTS`, `achievements`, `UNLOCKS`, `unlocks`, `isUnlocked`, `daily`, `dailySeed`, `evaluate`, `prune`, `LIMITS` | `progress.unlock`, `progress.record` | `chart.finished`, `studio.take`, `import.done` |
| M-26 | `src/26-ui.js` | `FLM.UI` | screen stack, focus, dialogs, toasts, widgets, responsive layout, safe areas, touch pads, HUD, settings widgets, reduced motion | none | `init`, `Screens` (`push`, `replace`, `pop`, `popTo`, `back`, `current`, `depth`), `Focus` (`trap`, `release`, `restore`), `dialog`, `closeAllDialogs`, `dialogCount`, `toast`, `Widgets` (`button`, `toggle`, `slider`, `select`, `number`, `list`, `tabs`, `field`), `HUD` (`show`, `hide`, `set`, `flash`, `reset`), `TouchPads` (`show`, `hide`, `layout`, `setPressed`), `TransportBar`, `Layout` (`orientation`, `safeArea`, `compact`, `setScale`), `setReducedMotion`, `setHighContrast`, `confirmUnsaved`, `truncate`, `el`, `text` | `ui.screen`, `ui.dialog`, `ui.layout` | `settings.changed`, `error` |
| M-27 | `src/27-screens.js` | `FLM.Screens` | all SCR-* and DLG-* controllers, tutorial state machine, results, pause | M-02 to M-26 | `register`, `show`, `get`, `SCREENS`, `DIALOGS`, `Tutorial` (`start`, `step`, `skip`, `repeat`, `state`), `showError`, `showSaveFailed` | none | `error`, `project.saveFailed`, `storage.quota`, `audio.state`, `net.state`, `net.peer`, `net.sync`, `import.progress`, `import.done`, `import.failed`, `judge.result`, `score.update`, `chart.finished`, `progress.unlock`, `studio.recording`, `studio.take`, `render.tier` |
| M-28 | `src/28-modes.js` | `FLM.Modes` | mode manager: enter and leave with full teardown, per-mode bindings, interruption handling, leak counters | M-02 to M-27 | `init`, `MODES`, `enter`, `leave`, `current`, `params`, `isGameplay`, `assertClean`, `baseline`, `REQUIREMENTS`, `onInterrupt`, `restart`, `debugInject`, `debugClear` | `mode.enter`, `mode.leave`, `mode.interrupted` | `error`, `audio.state`, `render.contextLost`, `render.contextRestored`, `ui.layout`, `input.device`, `net.state`, `chart.finished` |
| M-29 | `src/29-boot.js` | `FLM.Boot` | init order, capability gate, audio unlock gesture, first-launch branch, URL parameters, global surface | M-02 to M-28 | `start`, `stage`, `ready`, `GATE`, `applyUrlParams`, `installSurface` | `boot.stage`, `boot.ready` | `error` |
| M-30 | `src/30-content.js` | `FLM.Content` | five demo arrangements as data, tutorial sequence, character presets, notation expander | M-02, M-03, M-15, M-22 | `ARRANGEMENTS`, `expand`, `NOTATION`, `TUTORIAL`, `CHARACTER_PRESETS`, `list` | none | none |
| M-31 | `src/90-selftest.js`, `src/91-test-*.js` | `FLM.SelfTest` | test runner, assertions, fakes, test groups (test build only) | M-02 to M-30 | `group`, `test`, `run`, `groups`, `assert` (`eq`, `near`, `throws`, `rejects`, `within`, `ok`, `deepEq`), `fakes` (`FakeClock`, `FakeIndexedDB`, `offlineContext`, `inputs`), `results`, `RESULT_SHAPE` | none | any (tests subscribe to assert payloads) |

Notes on the table:

- M-02 and M-11 and M-18 and M-26 reference only M-01. Keeping M-18 and M-26 free of the
  music modules means the renderer and the widget library can be exercised by self-tests
  without an AudioContext.
- M-27, M-28, M-29 and M-31 are "integration" modules: they may reference every lower
  module. No other module may reference more than the modules listed.
- `FLM.Transport.main` is the one Transport instance used by every mode. `FLM.Transport.create`
  exists for tests and for the import preview player (M-14 previews use a second instance that
  is never bound to the Scheduler's main binding; the Scheduler binds one Transport at a time).
- M-30 is data. Its only load-time side effect is registration into M-15 and M-22 (4.2).

### 4.2 Dependency graph

```text
 Layer 9  boot            M-29 Boot ................................ window.FLM surface
                            |
 Layer 8  ui              M-26 UI --> M-27 Screens --> M-28 Modes
                            |             |              |
 Layer 7  modes           M-23 Dance    M-24 Net       M-25 Progress
                            |             |              |
 Layer 6  render stack    M-18 Render --> M-19 Rig --> M-20 Animation --> M-21 Stage
                                          |
                                        M-22 Character
                            |
 Layer 5  project         M-15 Project --> M-16 Storage --> M-17 Studio
                            |
 Layer 4  parsers         M-10 Midi   M-11 Zip --> M-12 MusicXml   M-13 GuitarPro
                                \          \          |             /
                                 +----------+---- M-14 Import -----+
                            |
 Layer 3  play            M-06 Instruments     M-07 Input --> M-08 Mapping --> M-09 Rhythm
                            |
 Layer 2  time            M-04 Transport --> M-05 Audio
                            |
 Layer 1  music           M-02 Theory --> M-03 Model
                            |
 Layer 0  core            M-01 Core  (FLM, define, bus, timers, raf, dom, Log, Caps, ErrorReporter)

 Data    M-30 Content   loads after M-29; registers into M-15 Catalog and M-22 presets at load
 Tests   M-31 SelfTest  test build only; loads last; registers groups into FLM.SelfTest
```

Arrows point from a lower module to a higher module that references it. Every module may
reference anything in a lower layer; the table in 4.1 narrows this to the modules actually
referenced.

Principal runtime flows (all through APIs of lower modules or through the bus):

```text
 DOM events -> M-07 Input --(input.event)--> M-08 Mapper -> M-06 liveNoteOn (Free Play, Studio)
                            --(input.event)--> M-09 Judge --(judge.result, score.update)--> M-26 HUD, M-21 effects, M-24 host
                            --(input.event)--> M-17 Recorder (ticks via Transport.tickAt)
 M-04 Transport.pullDue  <- M-05 Scheduler (every 25 ms) --(sched.noteOn/Off/program/cc/bend)--> M-06 voices
                                                          --(sched.noteOn/Off/beat/marker)--> M-20 Animation, M-21 Stage
 RAF -> M-18 loop -> M-21 Stage.update(Transport.positionAt(audioNow)) -> M-20 Mixer.update -> M-19 poses -> M-18 draw
 M-28 Modes.enter -> M-04 load, M-05 Scheduler.bind, M-08 generate, M-09 bind, M-21 build, M-07 bind, M-26 HUD
 M-16 Storage.saveProject(M-15 serialize) --(project.saved or project.saveFailed)--> M-27 dialogs
 M-24 Net <--> peers; host judges guests' inputs with M-09 against the same settingsHash chart
```

Rule R-DEP (enforced by the build lint in Part 3.3.4): the source text of `src/NN-name.js`
may reference `FLM.<Namespace>` only for namespaces defined by files with a lower NN, plus
`FLM.Core`. Load order is file-name order, so a lower module is always defined before a higher
one runs. The one allowed exception is upward communication through the event bus
`FLM.Core.bus`: a lower module emits a topic that higher modules subscribe to, and a lower
module may subscribe to a topic that a higher module emits (a callback). Both directions use
only the topic catalog in 4.4; a module never emits a topic it does not own, and never relies
on a specific higher module being present (if nobody subscribes, the emit is a no-op).

Corollaries:

1. A higher module calling a lower module's API is the normal direction and needs no event
   (M-29 calls `FLM.Transport.main.setClock(FLM.Audio.clock())`; M-30 calls
   `FLM.Project.Catalog.registerBuiltin(...)`; M-28 calls everything).
2. Registries are downward calls: `FLM.Project.Catalog.register*`, `FLM.Character.registerPresets`,
   `FLM.Import.adapters.register`, `FLM.SelfTest.group`. The registered records may contain
   functions (for example a lazy `expand()` that builds a `Song`); the lower module calls them
   without knowing who registered them.
3. Load-time side effects are limited to: namespace definition through `FLM.Core.define`,
   registry registration (M-30, M-31, M-14 adapters registering themselves from M-10, M-12,
   M-13 is not allowed because those are lower; M-14 registers the adapters it wraps), M-01
   installing `window.onerror` and `unhandledrejection` handlers, and M-29 installing a
   `DOMContentLoaded` listener. No factory creates an AudioContext, a WebGL context, a timer,
   a RAF handle, or a DOM listener other than those listed.
4. `FLM.Core.define(name, factory)` runs `factory(FLM)` immediately inside a `try` block,
   assigns the returned object to `FLM[name]`, freezes nothing (modules keep mutable
   internals), and appends `{name, file, order, ms}` to `FLM.Core.modules`. A throwing
   factory is reported as `E-GEN-001` with `context.module = name`; M-29 refuses to start
   when any module in M-01 to M-28 failed to define and shows `#fatal` (4.9).

### 4.3 Initialization sequence (M-29)

The joined script runs once, top to bottom, when the browser parses the second `<script>` of
`shell.html` (Part 3.2.5). Phase A below happens during that parse; Phase B starts from the
`DOMContentLoaded` listener M-29 installs (or from `setTimeout(start, 0)` when
`document.readyState` is already `interactive` or `complete`, which is the case when the
script executes after the parser reached the end of the body). Phase B is `FLM.Boot.start()`.
Every step records `performance.now()` into `FLM.Boot.stage` and emits `boot.stage`.

Phase A, script evaluation (no I/O, no timers):

| Step | What runs | Failure handling |
|---|---|---|
| A1 | `01-core.js`: creates `window.FLM = {VERSION, Core}`, `FLM.Core.bus`, `Log`, `Caps` (lazy detection object), `ErrorReporter.install()` (window `error` and `unhandledrejection` handlers), drains `window.__flmEarlyErrors` into `Log` and deletes it, parses `location.search` into `urlParams` | a throw here leaves the early handler of `shell.html` in charge; it shows `#fatal` with the message |
| A2 | `02-theory.js` to `28-modes.js`: each file calls `FLM.Core.define(name, factory)` | a throwing factory is recorded (`E-GEN-001`, `context.module`), `FLM[name]` is left undefined, evaluation continues with the next file |
| A3 | `29-boot.js`: defines `FLM.Boot`, installs `FLM.selfTest` (test build only, else a stub that resolves to `{skipped:true}`), `FLM.selfTestReady = false`, `FLM.diagnostics`, `FLM.debug`, then registers the `DOMContentLoaded` listener | as A2 |
| A4 | `30-content.js`: defines `FLM.Content`, calls `FLM.Project.Catalog.registerBuiltin(FLM.Content.list())`, `FLM.Project.Catalog.registerTutorial(FLM.Content.TUTORIAL)`, `FLM.Character.registerPresets(FLM.Content.CHARACTER_PRESETS)` | a throw is `E-GEN-001`; Boot continues with an empty catalog and SCR-QuickPlay shows its empty state ("No built-in songs were loaded") |
| A5 | test build only: `90-selftest.js` defines `FLM.SelfTest`; `91-test-*.js` call `FLM.SelfTest.group(...)` | as A2 |

Phase B, `FLM.Boot.start()` (numbered; the budget column is the desktop target, mobile is
twice the value; the total must satisfy load-to-menu <= 1.5 s desktop and <= 3.0 s mobile):

| Step | Action | Decision or branch | Budget |
|---|---|---|---|
| B1 | `t0 = performance.now()`; `Log.info('boot', VERSION)`; verify `FLM.Core.modules` holds every name M-01 to M-28 | any missing module -> `ErrorReporter.fatal('E-GEN-001', ...)` -> `#fatal` ("A part of the game failed to load: <name>. Reload the page.") and stop | 1 ms |
| B2 | `applyUrlParams()`: `?test` -> test mode; `?tier=<name>` (one of High, Balanced, Low, Abstract) -> `tierOverride`; `?diag` -> `FLM.debug.enabled = true`, diagnostics overlay on; `?online=<relayUrl>` -> `Net.setRelayUrl(url)` after validating `wss:` or `ws:` scheme and length <= 256; `?perf` -> perf scenario hooks (Part 9.7); unknown parameters ignored | an invalid `tier` or `online` value logs a warning and is ignored | 1 ms |
| B3 | `Caps.detect()` fills every flag of the brief (webgl2, webgl1, audioContext, offlineAudioContext, mediaRecorder, pointerEvents, maxTouchPoints, gamepad, webMidi, indexedDB, localStorage, secureContext, isFile, visibility, storageEstimate, performanceMemory, plus `dpr`, `mobile`, `reducedMotionPref`, `language`) | capability gate below | 20 ms |
| B4 | Capability gate (table follows) | hard failures show `#fatal`; soft failures set `Caps.degraded[]` and continue | 1 ms |
| B5 | `Storage.open()`: probes `localStorage` read and write of `flm.v1.probe`, opens `flm-db` v1 with a 2,000 ms timeout, runs the concurrent-tab lock check, emits `storage.state` | localStorage unavailable -> settings default in memory, notice on SCR-MainMenu ("Settings cannot be saved in this browser mode"); IndexedDB unavailable or timed out -> localStorage-only mode (2 MB cap) and notice; both unavailable -> continue, Export is the only save path | 100 ms (2,000 ms worst case) |
| B6 | `Storage.loadSettings()` -> validate and normalize (Part 5.11) -> `settings.changed` with `source:'load'` and `keys:[...]`; apply `--ui` scale, reduced motion (setting or `prefers-reduced-motion`), high contrast, orientation classes through `UI.init()` | corrupt settings record -> defaults, `.bak` tried first, toast "Settings were reset" | 10 ms |
| B7 | `Audio.init()`: creates the `AudioContext` (`latencyHint:'interactive'`, no `sampleRate` option), builds the bus graph (master -> limiter -> destination, metronome bus), creates the `VoiceAllocator` with the polyphony cap from settings (64 desktop, 32 mobile default), registers `statechange`; `FLM.Transport.main = FLM.Transport.create(); main.setClock(Audio.clock())`; emits `audio.state` | constructor throws -> `E-AUD-001`, class reload, `#fatal` ("Audio could not start in this browser") because no mode can function without Web Audio; `state === 'suspended'` is normal before the gesture | 30 ms |
| B8 | `Render.init(canvas#view, canvas#flat, pickTier())`: compiles the base programs, emits `render.tier` | WebGL2 fails -> WebGL1 -> Abstract (`Flat2D` on `#flat`); shader compile failure in a tier -> next lower tier; Abstract never fails (2D canvas is a hard requirement checked in B4) | 150 ms |
| B9 | `Input.init()`: attaches the window-level `keydown`, `keyup`, `blur`, `visibilitychange`, `pagehide`, `gamepadconnected`, `gamepaddisconnected` listeners through `Core.dom`; no gameplay binding yet | none | 5 ms |
| B10 | `Modes.init()`: registers the mode table, interruption handlers, `history` integration (`popstate` -> `UI.Screens.back()`), takes the leak baseline | none | 5 ms |
| B11 | `Screens.register()` registers every SCR-* and DLG-* controller (no DOM built yet) | none | 5 ms |
| B12 | Catalog check: `Project.Catalog.list()` must contain 5 built-in entries | fewer -> `Log.warn`, continue | 1 ms |
| B13 | Test mode (`?test`): set `FLM.selfTestReady = true`, emit `boot.ready` and return without entering a mode (tests drive modes themselves) | none | n/a |
| B14 | First-launch branch: `onboarding.firstLaunchDone === false` -> `Modes.enter('menu', {screen:'SCR-FirstLaunch'})`; else `Modes.enter('menu')` -> SCR-MainMenu | SCR-FirstLaunch runs the seven B 6.1 steps (Part 7.9); its "Start" button is the audio unlock gesture | 50 ms |
| B15 | Audio unlock gesture (returning users): SCR-MainMenu installs a one-shot `pointerdown` and `keydown` capture listener on `#overlay` that calls `Audio.unlock()`; until `audio.unlocked` fires, the menu shows the banner "Tap or press a key to enable sound" and gameplay entries open DLG-AudioBlocked when chosen | `unlock()` resolves `false` after 1,000 ms without `running` -> DLG-AudioBlocked with "Try again" | gesture-driven |
| B16 | `boot.ready {ms: performance.now()-t0, tier, firstLaunch}`; `Log.info`; if `?diag`, show the diagnostics overlay | none | 0 |

Capability gate (B4). "Hard" means `#fatal` with the given text and no mode starts; "Soft"
means the feature is disabled with the stated reason wherever it appears (B 6.1 step 7,
B 6.2 disabled state with a one-line reason).

| Capability | Test | Missing -> class | User text or reason |
|---|---|---|---|
| ES2020 syntax | the script parsed (implicit) | Hard (shell early handler) | "This browser is too old to run Finger Lickin Music." |
| 2D canvas | `document.createElement('canvas').getContext('2d')` non-null | Hard | "This browser cannot draw graphics." |
| Web Audio | `window.AudioContext or window.webkitAudioContext` | Hard (`E-CAP-001`) | "This browser has no Web Audio support, so nothing could play." |
| `requestAnimationFrame` | function exists | Hard | "This browser is missing animation support." |
| WebGL2 | `canvas.getContext('webgl2')` | Soft: try WebGL1 | tier Balanced at most |
| WebGL1 | `canvas.getContext('webgl') or ('experimental-webgl')` | Soft: Abstract tier | "3D stage unavailable in this browser; using the flat visualizer." |
| Pointer Events | `window.PointerEvent` | Soft: mouse and Touch Events path (OQ-1 fallback) | none shown |
| `maxTouchPoints >= 4` | `navigator.maxTouchPoints` | Soft: touch pads limited to that many simultaneous presses; HUD note | "This device reports fewer than 4 simultaneous touches." |
| Gamepad API | `navigator.getGamepads` | Soft | Settings: "Gamepad input is not available in this browser." |
| Web MIDI | `navigator.requestMIDIAccess` and `isSecureContext` | Soft | Settings: "Web MIDI needs a secure context and a supporting browser." |
| localStorage | probe write and read-back | Soft | "Settings and projects cannot be saved in this browser mode. Use Export." |
| IndexedDB | open succeeds within 2,000 ms | Soft: localStorage-only | "Large projects cannot be stored; projects are limited to 2 MB. Use Export for backups." |
| `OfflineAudioContext` | constructor exists | Soft | Export: "WAV export is not available in this browser." (MediaRecorder path per OQ-2 when available) |
| `MediaRecorder` with `captureStream` | both exist | Soft | Export: audio capture alternative disabled |
| `isSecureContext` | boolean | informational | About screen reports it; Web MIDI gate |
| `isFile` (`location.protocol === 'file:'`) | boolean | informational | storage differences handled by B5; About screen reports it |
| Visibility API | `document.hidden !== undefined` | Soft: `blur` only | none shown |
| `navigator.storage.estimate` | function exists | Soft: quota shown as "unknown" | Diagnostics shows "quota: unknown" |
| `performance.memory` | object exists (Chromium) | Soft | Diagnostics shows "memory: not available" |
| RTCPeerConnection | constructor exists | Soft | Multiplayer entry disabled: "This browser has no WebRTC support." (relay path still works if a relay URL is set) |

Boot never fabricates progress: the loading indicator on SCR-FirstLaunch shows only the
named steps B5 to B8 as they complete (four discrete states), never a percentage.

### 4.4 Event bus catalog

The bus is `FLM.Core.bus`, an `Emitter`:

```js
/** @typedef {{ (payload:object): void }} Listener */
class Emitter {
  /** Subscribe. `owner` is any object or symbol used for bulk removal; returns an unsubscribe function. */
  on(topic /*:string*/, fn /*:Listener*/, owner /*:any?*/) /*: () => void */ {}
  once(topic, fn, owner) /*: () => void */ {}
  off(topic, fn) /*: void */ {}
  /** Remove every listener registered with this owner (used by Modes.leave). */
  removeOwner(owner) /*: number */ {}
  /** Synchronous dispatch in subscription order; each listener runs in its own try block;
   *  a throw is reported through ErrorReporter.report('E-GEN-001', err, {topic}) and
   *  does not stop the other listeners. Re-entrant emits are allowed to depth 8;
   *  deeper emits are dropped and reported once per topic. */
  emit(topic, payload /*:object*/) /*: number listenersCalled */ {}
  listenerCount(topic /*:string?*/) /*: number */ {}
  topics() /*: string[] */ {}
}
```

Rules: every topic in the table below is emitted only by the module in "Emitted by";
payloads are plain objects created per emit and treated as read-only by listeners (a listener
that needs to keep data copies it); no topic carries DOM nodes, AudioNodes or GL objects;
every payload field listed is always present (nullable fields are marked `?`). Frequencies are
upper bounds the emitter must respect; a module needing higher-rate data polls the owning
module's API instead (for example `Audio.peak()` from the render loop).

| EVT topic | Payload fields and types | Emitted by | Consumed by | Frequency |
|---|---|---|---|---|
| `transport.loaded` | `{songId:s, name:s, durationTicks:i, tempoOverride:n?, ppq:960}` | M-04 | M-05, M-20, M-21, M-26 (TransportBar), M-27 | per load |
| `transport.state` | `{prev:s, state:s ('stopped' or 'countin' or 'playing' or 'paused' or 'recording'), tick:i, audioTime:n, speed:n, reason:s ('user' or 'end' or 'seek' or 'loop' or 'interrupt' or 'error' or 'net' or 'mode')}` | M-04 | M-05, M-07, M-09, M-17, M-20, M-23, M-24, M-26, M-27, M-28 | per state change (user rate) |
| `transport.seek` | `{fromTick:i, toTick:i, state:s, audioTime:n, reason:s ('user' or 'restart' or 'net' or 'section')}` | M-04 | M-05, M-09, M-20, M-21, M-23, M-26 | per seek |
| `transport.loop` | `{a:i, b:i, pass:i, atAudioTime:n}` where `atAudioTime` is the scheduled audio time of the wrap (future, within lookahead) | M-04 (from `pullDue`) | M-05, M-09, M-17 (loop record pass end), M-20, M-21 | per wrap (>= 1 beat apart) |
| `transport.loopSet` | `{a:i?, b:i?, enabled:b}` | M-04 | M-26, M-27, M-21 (highway region shading) | per change |
| `transport.speed` | `{speed:n (0.25..2.0), tick:i, audioTime:n}` | M-04 | M-05 (metronome spacing), M-20, M-26, M-24 (host only; guests reject) | per change |
| `transport.tempoSource` | `{source:s ('song' or 'override'), bpm:n}` | M-04 | M-26, M-27 | per change |
| `transport.end` | `{tick:i, atAudioTime:n}` the song ended without a loop (the same moment is also `transport.state` with `reason:'end'`) | M-04 | M-28, M-31 | once per song end |
| `audio.state` | `{state:s ('none' or 'suspended' or 'running' or 'interrupted' or 'closed'), unlocked:b, sampleRate:n, baseLatencyMs:n, outputLatencyMs:n?, reason:s ('init' or 'gesture' or 'statechange' or 'visibility' or 'panic' or 'rebuild')}` | M-05 | M-06, M-07, M-24, M-26, M-27, M-28 | per change |
| `audio.unlocked` | `{audioTime:n, sampleRate:n, latencyMs:n, attempts:i}` | M-05 | M-07 (start anchor sampling), M-27 (hide banner), M-28 | once per unlock (repeat after rebuild) |
| `audio.voices` | `{active:i, max:i, stolen:i, dropped:i, peakActive:i}` cumulative counters since bind | M-05 | M-26 (diagnostics overlay), M-27 (SCR-Diagnostics), M-18 (nothing), M-31 | <= 10 Hz, only when changed |
| `audio.panic` | `{hard:b, reason:s ('user' or 'stop' or 'seek' or 'mode' or 'fatal' or 'rebuild'), voicesStopped:i, audioTime:n}` | M-05 | M-06 (drop voice handles), M-07 (release held), M-20 (release gestures), M-26 (toast on user panic), M-28 | per panic |
| `audio.peak` | `{l:n, r:n, clipped:b, audioTime:n}` linear peak 0..2 | M-05 | M-26 (mixer meters, master meter) | 10 Hz while `listenerCount('audio.peak') > 0`, else never |
| `sched.noteOn` | `{trackId:s, channel:i, eventId:s, pitch:i, velocity:i, program:i, isDrums:b, at:n, atOff:n, durTicks:i, tick:i, live:b}` (`atOff` is the planned release time at the current speed; `live:true` for Free Play and Studio input notes, which carry `tick` from `Transport.tickAt`) | M-05 (Scheduler for chart and song notes; `Audio.Scheduler.liveNoteOn` and `liveNoteOff` for live notes forwarded from M-06) | M-06 (voice start), M-20 (anticipation and gesture), M-21 (highway active-note highlight, effects), M-24 (host: none), M-31 | up to 2,000 per s in dense passages; emitted when scheduled (<= 120 ms ahead) |
| `sched.noteOff` | `{trackId:s, channel:i, eventId:s, pitch:i, at:n, reason:s ('end' or 'loop' or 'seek' or 'stop' or 'overlap' or 'live')}` | M-05 | M-06, M-20, M-21 | same as noteOn |
| `sched.program` | `{trackId:s, channel:i, program:i, bankMsb:i, bankLsb:i, at:n}` | M-05 | M-06, M-20 (controller swap at `at`), M-21 (prop swap) | per program event |
| `sched.cc` | `{trackId:s, channel:i, controller:i, value:i, at:n}` | M-05 | M-06, M-20 (CC 1 and 74 knob gesture) | per control event (capped 500 per s per track; excess coalesced to the last value) |
| `sched.bend` | `{trackId:s, channel:i, value:i (-8192..8191), at:n}` | M-05 | M-06, M-20 | per bend event (same cap as cc) |
| `sched.beat` | `{tick:i, bar:i, beat:i, numerator:i, denominator:i, at:n, isDownbeat:b, countin:b}` | M-05 (Scheduler derives beats within the lookahead from `MeterMap`; count-in beats have `countin:true` and negative ticks) | M-05 Metronome (internal), M-20 BeatIndicator, M-21 light pulses, M-26 HUD beat marker, M-17 (count-in display) | one per beat (<= 10 per s at 600 BPM eighths) |
| `sched.marker` | `{tick:i, label:s, kind:s ('section' or 'cue'), at:n, index:i}` | M-05 | M-20 StageDirector, M-26 HUD section name, M-09 (section stats boundary) | per marker |
| `sched.stall` | `{gapMs:n, eventsRescheduled:i, at:n, cause:s ('timer' or 'hidden' or 'unknown')}` | M-05 | M-01 Log (diagnostics), M-26 overlay, M-28 (gameplay modes pause when `gapMs > 500` while playing) | per stall |
| `input.event` | `InputEvent {source:s ('keyboard' or 'pointer' or 'gamepad' or 'midi' or 'system' or 'synthetic'), control:s, type:s ('press' or 'release'), tPerf:n, tAudio:n, pressure:n (0..1)}` | M-07 | M-08 Mapper (live modes), M-09 Judge, M-17 Recorder, M-23 DanceJudge, M-24 (guest forwards), M-26 TouchPads (pressed state), M-27 (pause control), M-31 | per physical press and release |
| `input.device` | `{source:s, connected:b, id:s, name:s, index:i?}` | M-07 | M-26 (toast), M-27 (SCR-Settings), M-28 (gamepad disconnect releases and pauses gameplay) | per connect or disconnect |
| `input.anchor` | `{offsetSec:n, samples:i, jitterMs:n, method:s ('outputTimestamp' or 'currentTime')}` | M-07 | M-26 overlay, M-27 SCR-Diagnostics, M-31 | <= 1 Hz, only when the median moved by > 1 ms |
| `input.map` | `{profile:s?, control:s, codes:[s], source:s ('keyboard' or 'gamepad' or 'midi')}` | M-07 | M-26 (labels), M-27 (SCR-Settings, SCR-Help) | per remap |
| `judge.result` | `JudgeResult {noteId:s, judgment:s ('perfect' or 'great' or 'good' or 'miss'), deltaMs:n, tInput:n} + {lanes:[i], tick:i, isHold:b, holdPhase:s? ('head' or 'tail'), combo:i, stray:b}` | M-09 (also on behalf of M-23, whose DanceJudge wraps it) | M-26 HUD flash, M-21 effects, M-24 (host aggregates), M-25 (none; uses summary), M-31 | per judged note or stray press |
| `score.update` | `ScoreState {score:i, combo:i, maxCombo:i, counts:{perfect:i, great:i, good:i, miss:i}, judged:i, total:i, accuracy:n, completion:n} + {chartId:s, sectionIndex:i}` | M-09 | M-26 HUD, M-24 (host sends `scoreUpdate` at 10 Hz from the latest), M-27 | per judgment, coalesced to <= 30 Hz for HUD text |
| `chart.ready` | `{kind:s ('instrument' or 'dance'), chartId:s, songId:s, trackId:s?, difficulty:s, profile:s?, noteCount:i, holdCount:i, omittedSourceEventIds:i, settingsHash:s, generatorVersion:i, ms:n}` | M-08 (instrument), M-23 (dance) | M-09 or M-23 (bind), M-21 Highway, M-27 (SCR-ImportInspect preview), M-24 (hash check) | per generation |
| `chart.finished` | `{chartId:s, kind:s, summary:PerformanceSummary, endedBy:s ('end' or 'user' or 'fail' or 'net')}` | M-09 (`Judge.finish`, instrument) and M-23 (`DanceJudge.finish`, dance) | M-28 (enter results), M-25 (record), M-24 (host sends results), M-27 | once per play-through |
| `project.changed` | `{projectId:s, command:s?, scope:s ('song' or 'tracks' or 'events' or 'mixer' or 'charts' or 'settings' or 'characters' or 'markers' or 'meta'), dirty:b, undoDepth:i, redoDepth:i, modifiedAt:i}` | M-15 | M-16 (dirty tracking for autosave), M-17 (refresh views), M-21 (performer props on instrument change), M-26, M-27 | per command (sliders coalesce to <= 10 Hz) |
| `project.loaded` | `{projectId:s, name:s, migratedFrom:i?, warnings:[s], where:s ('local' or 'idb' or 'file' or 'builtin' or 'new')}` | M-15 (`setCurrent`) | M-27, M-28, M-21, M-25 | per load |
| `project.dirty` | `{projectId:s, dirty:b, revision:i}` | M-15 | M-16 (autosave), M-26, M-27 | whenever the dirty flag would change value |
| `project.saved` | `{projectId:s, where:s ('local' or 'idb' or 'both' or 'export'), bytes:i, ms:n, kind:s ('manual' or 'autosave' or 'checkpoint')}` | M-16 | M-15 (`markClean` for manual and autosave), M-26 (toast on manual), M-27 | per successful save |
| `project.saveFailed` | `{projectId:s, code:s, message:s, where:s, kind:s, canExport:b, bytes:i}` | M-16 | M-27 (DLG-SaveFailed), M-28 (does not block leave), M-01 Log | per failed save |
| `storage.quota` | `{usage:i?, quota:i?, level:s ('ok' or 'warn' or 'critical' or 'unknown'), source:s ('estimate' or 'exception')}` warn at >= 80 percent, critical at >= 95 percent or on a quota exception | M-16 | M-27 (notice on SCR-Studio and SCR-Library), M-26 | after every save and every 60 s in Studio |
| `storage.state` | `{mode:s ('full' or 'localOnly' or 'memory'), notice:s?, localStorage:b, indexedDB:b, readOnly:b, lockedBy:s?, reason:s}` | M-16 | M-27, M-28 (read-only blocks Studio recording with a dialog), M-29 | per change |
| `storage.lock` | `{projectId:s, state:s ('acquired' or 'lost' or 'heldByOther'), heldBy:s?}` | M-16 | M-17, M-27, M-28 | on lock acquire result and when another tab takes the lock |
| `studio.recording` | `{state:s ('armed' or 'countin' or 'recording' or 'stopped' or 'aborted'), trackId:s, takeId:s?, startTick:i, countInBars:i, passIndex:i?, eventCount:i?}` | M-17 | M-26 HUD and TransportBar, M-27 SCR-Studio, M-28 (leave aborts), M-16 (no autosave while recording) | per change |
| `studio.take` | `{takeId:s, trackId:s, eventCount:i, status:s ('complete' or 'aborted'), replacedTakeId:s?, keptPasses:i}` | M-17 | M-25, M-27, M-15 (none; M-17 applies `replaceTake` command) | per take |
| `studio.selection` | `{trackId:s?, eventIds:[s], tickRange:[i,i]?}` | M-17 | M-27 SCR-Studio (piano roll and inspector) | per change (<= 30 Hz) |
| `import.progress` | `{stage:s ('validate' or 'identify' or 'parse' or 'normalize' or 'inspect' or 'chart'), fraction:n? (0..1 when measurable, else null), bytesDone:i, bytesTotal:i, events:i, ms:n}` | M-14 | M-27 SCR-ImportInspect progress, M-26 | <= 10 Hz |
| `import.done` | `{report:InspectionReport, songs:i, ms:n}` | M-14 | M-25, M-27 (SCR-ImportInspect), M-28 | per import |
| `import.failed` | `{code:s, message:s, format:s?, fileName:s, stage:s}` | M-14 | M-27 (error state with action), M-01 Log | per failure |
| `render.tier` | `{tier:s ('High' or 'Balanced' or 'Low' or 'Abstract'), prev:s?, reason:s ('initial' or 'auto' or 'user' or 'contextLoss' or 'url'), params:object}` (`params` is the tier row of Part 9.3) | M-18 | M-20 (visualizer caps), M-21 (rebuild LOD), M-26 (overlay), M-27 (SCR-Settings label), M-28 | per change |
| `render.contextLost` | `{tier:s, at:n}` | M-18 | M-21 (stop updates), M-28 (gameplay keeps audio; shows HUD note "Graphics paused"), M-01 Log | per loss |
| `render.contextRestored` | `{tier:s, ms:n, rebuilt:{buffers:i, textures:i, programs:i}, fallback:b}` (`fallback:true` when restore failed within 3,000 ms and the tier is now Abstract) | M-18 | M-21 (rebuild scene from CPU descriptions), M-28, M-27 | per restore |
| `render.stats` | `{fps:n, p50:n, p95:n, frames:i, draws:i, tris:i, tier:s, downgraded:b}` | M-18 | M-26 overlay, M-27 SCR-Diagnostics, M-28 (none: the auto-downgrade check runs inside M-18, Part 9.3.4), M-31 | 1 Hz while the loop runs and `listenerCount > 0` |
| `director.cut` | `{preset:s, slot:i?, reason:s ('default' or 'focus' or 'section' or 'user' or 'reset'), at:n, tick:i}` | M-20 StageDirector | M-21 (camera), M-26 (none), M-31 | <= one per 4 bars (user cuts exempt) |
| `character.changed` | `{characterId:s, option:s?, rigAffecting:b, config:CharacterConfig}` | M-22 | M-21 (live preview rebuild of one performer), M-24 (host broadcasts `avatar` when in lobby), M-27 | per option change (<= 30 Hz from sliders) |
| `net.state` | `{state:s ('idle' or 'creating' or 'inviting' or 'awaitingAnswer' or 'connecting' or 'connected' or 'lobby' or 'countdown' or 'playing' or 'results' or 'reconnecting' or 'ended' or 'error'), role:s? ('host' or 'guest'), roomCode:s?, transport:s? ('p2p' or 'relay'), reason:s, code:s?}` | M-24 | M-27 SCR-Multiplayer, M-28 (ended -> results or lobby), M-26 | per change |
| `net.peer` | `{peerId:s, name:s, joined:b, slot:i, ready:b, avatar:CharacterConfig?, latencyMs:n?, instrument:i?}` | M-24 | M-27 lobby list, M-21 (remote performers), M-28 | per peer change |
| `net.message` | `{peerId:s, type:s, seq:i, size:i, valid:b, error:s?, msg:NetMessage?}` (`msg` null when invalid) | M-24 | M-27 SCR-Diagnostics (counts), M-31; gameplay consumers use M-24's typed callbacks, not this topic | <= 60 per s per peer (rate limit) |
| `net.sync` | `{peerId:s, offsetMs:n, rttMs:n, jitterMs:n, samples:i, quality:s ('good' or 'fair' or 'poor')}` good <= 20 ms error, fair <= 50, poor above | M-24 | M-27 lobby diagnostics, M-26 HUD sync badge, M-28 (poor for 30 s -> toast) | per sync round (start: 8 samples, then every 10 s) |
| `progress.unlock` | `{kind:s ('achievement' or 'cosmetic'), id:s, title:s, description:s}` | M-25 | M-26 (toast queue), M-27 SCR-Results | per unlock |
| `progress.record` | `{record:PerformanceRecord, isBest:b, previousBest:i?}` | M-25 | M-27 SCR-Results | per recorded play-through |
| `settings.changed` | `{key:s, value:any, prev:any, source:s ('ui' or 'load' or 'reset' or 'url' or 'wizard'), keys:[s]?}` (`key` is `'*'` and `keys` lists all keys for `source:'load'` and `'reset'`) | M-16 (`saveSettings`, `loadSettings`) | M-05 (volumes, polyphony), M-07 (maps, calibration), M-09 (calibration, judgment preset), M-18 (tier, resolution scale), M-20 (reduced motion, camera motion), M-21 (visual lead, effects), M-26 (scale, contrast, motion), M-27 | per change (slider drags coalesce to <= 10 Hz) |
| `ui.screen` | `{action:s ('push' or 'pop' or 'replace' or 'popTo'), screen:s, prev:s?, depth:i}` | M-26 | M-28 (history), M-27, M-31 | per navigation |
| `ui.dialog` | `{id:s, open:b, result:s?}` | M-26 | M-07 (dialog open -> gameplay inputs ignored), M-28, M-31 | per open or close |
| `ui.layout` | `{orientation:s ('portrait' or 'landscape'), width:i, height:i, dpr:n, compact:b, safeArea:{top:n, right:n, bottom:n, left:n}}` | M-26 | M-18 (resize), M-21 (highway layout), M-26 TouchPads, M-27, M-28 (rotate recommendation) | per resize (debounced 100 ms) and orientation change |
| `mode.enter` | `{mode:s, prev:s?, params:object, ms:n}` | M-28 | M-26 (HUD and pads visibility are set by M-28 directly; listeners are informational), M-27, M-24, M-31 | per enter |
| `mode.leave` | `{mode:s, next:s?, reason:s ('user' or 'finished' or 'error' or 'interrupt' or 'net'), ms:n, leaks:object?}` (`leaks` is the `assertClean()` result, null when clean) | M-28 | M-27, M-31 | per leave |
| `mode.interrupted` | `{mode:s, cause:s ('hidden' or 'pagehide' or 'audio' or 'orientation' or 'resize' or 'gamepad' or 'contextLost' or 'memory' or 'stall'), action:s ('paused' or 'continued' or 'ended' or 'released')}` | M-28 | M-27 (SCR-Pause reason line), M-26, M-31 | per interruption |
| `boot.stage` | `{stage:s, index:i, total:i, ms:n}` | M-29 | M-27 SCR-FirstLaunch loading states, M-31 | per boot step |
| `boot.ready` | `{ms:n, tier:s, firstLaunch:b, degraded:[s]}` | M-29 | M-27, M-31, perf tooling | once |
| `error` | `{id:s, code:s, class:s ('recoverable' or 'returnToMenu' or 'reload'), message:s, userMessage:s, module:s?, context:object?, at:n, count:i}` | M-01 ErrorReporter | M-05 (reload class -> soft panic), M-26 (toast for recoverable), M-27 (dialogs), M-28 (returnToMenu -> leave), M-29 | per report (duplicates within 1 s increment `count` instead) |

Topic ownership summary: M-04 owns `transport.*`; M-05 owns `audio.*` and `sched.*`; M-07
owns `input.*`; M-09 owns `judge.*`, `score.*` and `chart.finished` (M-23 emits it for dance runs); M-08 and M-23 share
`chart.ready` (distinguished by `kind`); M-15 owns `project.changed`, `project.loaded` and `project.dirty`;
M-16 owns `project.saved`, `project.saveFailed`, `storage.*` and `settings.changed`; M-17 owns
`studio.*`; M-14 owns `import.*`; M-18 owns `render.*`; M-20 owns `director.cut`; M-22 owns
`character.changed`; M-24 owns `net.*`; M-25 owns `progress.*`; M-26 owns `ui.*`; M-28 owns
`mode.*`; M-29 owns `boot.*`; M-01 owns `error`. A module that needs a new topic adds it to
this table first (the table is the contract that Part 12's integration tests read).

### 4.5 Clock domains and anchoring

Three clocks exist. Each has one owner, one unit, and a fixed set of readers.

| Clock | Unit | Source | Owner | Properties |
|---|---|---|---|---|
| Audio time | seconds (double) | `AudioContext.currentTime` (and `getOutputTimestamp()` when available) | M-05 (`Audio.clock()` returns `{now(): number}`) | master clock for everything musical; monotonic while the context is `running`; frozen while `suspended`; restarts at 0 after a hard rebuild (every anchor is re-established on `audio.unlocked`) |
| Performance time | milliseconds (double) | `performance.now()`, `event.timeStamp`, RAF callback argument | M-01 (`Core.now()` wraps `performance.now()`) | monotonic; used for input stamps, frame statistics, timeouts and test durations; never converted to ticks except through audio time |
| Musical time | integer ticks at PPQ 960 | `Song.tempoMap` through `Transport` | M-03 (conversion) and M-04 (position) | depends on the tempo map and the Transport speed; the only unit stored in events, charts, markers and recordings |

Wall-clock time (`Date.now()`) is a fourth value but not a clock of the engine: it is used
only for `createdAt` and `modifiedAt` stamps (M-15, M-25), the daily-challenge seed (local
date, M-25), log entry stamps (M-01) and the project index. Nothing derives a position,
duration or judgment from it.

#### 4.5.1 Anchoring functions

`Transport` keeps one anchor `{anchorTick, anchorAudio, speed}` and the loaded `TempoMap`.
Positions are computed, never accumulated:

```js
// M-04, playing or recording; secondsAt(tick) is TempoMap.ticksToSeconds
positionAt(audioTime) = secondsToTicks(secondsAt(anchorTick) + (audioTime - anchorAudio) * speed)
tickAt(audioTime)     = positionAt(audioTime)                  // alias used by Input, Recorder, Judge
audioTimeAt(tick)     = anchorAudio + (secondsAt(tick) - secondsAt(anchorTick)) / speed
// paused, stopped: positionAt returns the frozen tick; audioTimeAt returns Infinity for ticks
// beyond the frozen tick (callers treat Infinity as "not scheduled")
// countin: positionAt returns 0 and countinTick(audioTime) returns the negative tick in
// (-barsTicks, 0); audioTimeAt(0) is the planned start time.
```

Re-anchoring happens on `play`, `resume`, `seek`, `setSpeed`, each loop wrap (exactly at the
wrap time computed from the previous anchor, so no rounding error accumulates), and on
`audio.unlocked` after a rebuild. Ticks returned by `positionAt` are integers (`Math.floor`
of the double conversion); `tickAt` has the same rounding, so an input converts to the tick
that is playing at that instant.

`Input.perfToAudio(tPerf)` converts a performance stamp to audio time:

```js
// M-07. One sample per scheduler tick (every 25 ms while the Scheduler runs) and once per
// render frame while the Scheduler is stopped; at most 40 samples per second.
function sampleAnchor() {
  const ctx = FLM.Audio.ctx();
  if (!ctx || ctx.state !== 'running') return;         // frozen clock: keep the old median
  let offsetSec, method;
  if (typeof ctx.getOutputTimestamp === 'function') {
    const ts = ctx.getOutputTimestamp();                // {contextTime, performanceTime}
    if (ts && isFinite(ts.contextTime) && isFinite(ts.performanceTime) && ts.performanceTime > 0) {
      offsetSec = ts.contextTime - ts.performanceTime / 1000; method = 'outputTimestamp';
    }
  }
  if (offsetSec === undefined) {
    offsetSec = ctx.currentTime - performance.now() / 1000; method = 'currentTime';
  }
  ring.push(offsetSec); if (ring.length > 20) ring.shift();
  const sorted = ring.slice().sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  if (Math.abs(median - anchorOffset) > 0.001) emit('input.anchor', {...});
  anchorOffset = median; anchorMethod = method;
}
function perfToAudio(tPerf) { return tPerf / 1000 + anchorOffset; }
```

Decisions behind the anchor:

- A 20-sample median rejects single late timer callbacks (a `setInterval` tick that ran 80 ms
  late produces one outlier sample, not a shifted anchor). Jitter reported in `input.anchor`
  is the interquartile range of the ring in ms.
- With `getOutputTimestamp` the mapping expresses "the audio time whose sound is leaving the
  output at `tPerf`", which already absorbs the browser-reported output latency; without it
  the mapping is the render-time mapping and the sound is heard about `outputLatency` later.
  In both cases the calibration wizard (Part 7.7 DLG-Calibration) measures the residual as
  `audioLatencyMs`; the anchor itself never includes a calibration value.
- The ring is cleared on `audio.unlocked` (the context time base may have changed after a
  rebuild) and on `audio.state` leaving `running`; the first sample after a clear becomes the
  anchor immediately (median of one).
- `tPerf` comes from `event.timeStamp` when it is a performance-origin stamp (ADR-10 decision
  8), so an input that occurred before the current JavaScript task started is stamped at its
  true time, not at handler time. The added processing between the DOM event and the
  `input.event` emission must stay below one frame (16.7 ms) and is measured by a timing test.

Shared time for multiplayer (M-24) is the host's audio clock; `Net.Clock.toLocalAudio(tShared)
= tShared - offsetMs/1000` and `toShared(tLocal) = tLocal + offsetMs/1000`, where `offsetMs`
is the median of the ping samples (Part 6 M-24). Guests convert the host's `tStart` to local
audio time and anchor their own `Transport` there; nobody schedules from message arrival time.

#### 4.5.2 Who may read which clock

| Module | Audio time | Performance time | Ticks | Notes |
|---|---|---|---|---|
| M-01 Core | no | yes (Log stamps, timers) | no | `Core.now()` is the only `performance.now()` call site besides M-07, M-18 and M-31 |
| M-03 Model | no | no | yes | pure conversions; `TempoMap.ticksToSeconds` returns song seconds, not audio time |
| M-04 Transport | through the injected clock only | no | yes | never calls `performance.now()`; tests inject `FakeClock` |
| M-05 Audio | yes (`ctx.currentTime`) | only to measure scheduler tick lateness for `sched.stall` | through Transport | schedules at audio time only |
| M-06 Instruments | yes (`at` from payloads) | no | no | voices start and release at given audio times |
| M-07 Input | through `perfToAudio` | yes (`tPerf`) | through `Transport.tickAt` for display only | computes `tAudio` for every event |
| M-08 Mapping | no | no | yes | charts are in ticks |
| M-09 Rhythm | yes (`tAudio`, `audioTimeAt(note.tick)`) | no | yes | judgments compare audio seconds; never reads `performance.now()` |
| M-14 Import | no | yes (parse time budget) | yes | the 5 s parse budget is wall time measured with `Core.now()` |
| M-17 Studio | through `Transport.tickAt(evt.tAudio)` | no | yes | recorded ticks derive from the input's audio time, never from the frame |
| M-18 Render | no | yes (frame times, RAF argument for `dt`) | no | `dt` is clamped to 0..100 ms and used only for camera smoothing |
| M-20 Animation | yes (`audioNow` passed by the frame) | `dt` only | through `Transport.positionAt(audioNow)` | poses are functions of music time and scheduled events; `dt` smooths only transitions |
| M-21 Stage | yes | `dt` only | yes | highway position is `positionAt(audioNow)` in ticks converted per note to seconds for vertical placement |
| M-23 Dance | same as M-09 | no | yes | dance steps are ticks |
| M-24 Net | yes (shared time) | yes (RTT measurement) | no | `tSend` in `NetMessage` is shared time |
| M-25 Progress | no | no | no | wall clock for dates only |
| M-26 UI, M-27 Screens | no (display values arrive in payloads) | yes (toast durations, debounce) | display only | never compute positions |
| M-28 Modes | no | yes (teardown deadlines) | no | reads `Transport.state()` |
| M-31 SelfTest | yes in tests | yes (durations) | yes | uses `FakeClock` and `OfflineAudioContext` for determinism |

The render loop callback has the shape `frame(audioNow, dtMs)`, where `audioNow` is read once
per frame by M-18 from `FLM.Audio.clock().now()` (or from the frozen value when the context is
not running) and passed down; no visual module reads `Audio.ctx()` directly.

### 4.6 Separation rules (invariants)

Each invariant names the assertion a test makes. Test IDs are assigned in Part 12; the
"Asserted by" column names the category and the mechanism so the test can be written from
this text alone.

| No. | Invariant | Asserted by |
|---|---|---|
| S-01 | The renderer never advances musical time. `Transport.positionAt` is the only way to obtain the current tick, and M-18, M-20, M-21 contain no accumulation of `dt` into a tick or second value. | UT (transport): with a `FakeClock`, 200 frames with random `dt` in 0..500 ms leave `positionAt(clock.now())` equal to the value computed from the clock alone. Build lint: M-18, M-20, M-21 sources contain no `+= dt` applied to a variable named with `tick`, `time` or `pos` (Part 3.3.4 rule list is extended with this regex). TT: a 120 s playback with injected 300 ms frame stalls (`FLM.debug.inject('render.slowFrames')`) ends with the highway tick equal to `positionAt(audioNow)` within 1 tick. |
| S-02 | Scoring uses input audio time, not frame time. `Judge.onInput` reads `evt.tAudio` only; no judgment is created inside a RAF callback. | UT (rhythm): replaying an input log with `tAudio` values while the fake frame clock is frozen produces the same `ScoreState` as with the frame clock running. IT: the same input log replayed at render tiers High and Abstract yields identical `ScoreState`. |
| S-03 | Animation derives from scheduled events and audio time. Controllers consume `sched.*` payloads with `at`, and `update(musicTime, audioNow, dt)`; a controller given no events produces the idle pose regardless of elapsed frames. | UT (animation): a controller fed a `sched.noteOn` at `at = 2.000` reaches peak amplitude at `audioNow = 2.000` within one update step, whether `update` is called 10 or 1,000 times before; with no events the pose stays within idle breathing bounds for 60 s of simulated time. |
| S-04 | Calibration is applied exactly once, in `Rhythm.Judge`: `tAdj = evt.tAudio - (inputOffsetMs + audioLatencyMs) / 1000`. `Input.perfToAudio`, the Scheduler, the highway and M-24 never add or subtract a calibration value. | UT (rhythm): with `inputOffsetMs = 30` an input at `noteTime + 0.030` judges `perfect` with `deltaMs = 0`. UT (input): `perfToAudio(t)` is independent of every `Calibration` field. Build lint: the identifiers `inputOffsetMs`, `audioLatencyMs` appear in `09-rhythm.js`, `16-storage.js` (settings), `27-screens.js` (wizard UI) and `05-data` schema code only; any other file fails the lint. |
| S-05 | Parsers never execute content. M-10 to M-14 produce data only: no `innerHTML`, no `eval`, no `Function`, no element creation from strings; `DOMParser` is used with `'application/xml'` and the result is read with `textContent` and attribute getters; `<!ENTITY>` declarations abort the parse with the error `E-IMP-014`. | FT: the corpus file with a `<script>` element inside a `<credit-words>` and one with an external entity import and produce text only; no global side effect (a sentinel `window.__pwned` stays undefined). Build lint bans the APIs (Part 3.3.4). |
| S-06 | The mode manager tears down fully. After `Modes.leave()` resolves, `assertClean()` reports zero leaks (4.7). | IT: 20 enter/leave cycles of each gameplay mode leave `assertClean()` clean every time and heap growth (when `performance.memory` exists) <= 10 MB. UT (modes): leaving while a note is held and the transport is playing produces `activeVoices = 0` within 350 ms. |
| S-07 | No module writes another module's state directly. Cross-module state changes go through the owning module's API or through events. Internal state objects are not exported; API objects expose methods, and the few exported data tables (`DEFINITIONS`, `SCALES`, `OPTIONS`, `TIERS`, `WINDOWS`, `SCORING`) are deep-frozen at load. | UT (core): `Object.isFrozen` holds for every exported table listed. Build lint: no file assigns to `FLM.<Other>.<prop> =` where Other is not its own namespace (regex on `FLM\.[A-Z]\w+\.\w+\s*=` excluding the module's own namespace and `FLM.Core.define`). |
| S-08 | Musical data is separate from gameplay mappings. `Chart` and `DanceChart` reference source events by `sourceEventIds` and never mutate `Song`; tracks with `lockedSource:true` are never modified by generation, difficulty changes or profile switches. | UT (mapping): `generate()` on a frozen `Song` (deep-frozen copy) does not throw and the song's `fnv1a32` of its serialized events is unchanged; running all four difficulties and all six profiles leaves it unchanged. |
| S-09 | The audio clock is the only master. `Transport` receives time only through its injected clock; the Scheduler schedules only against `ctx.currentTime`; timers are used to wake the scheduler, never to time events. | UT (audio, OfflineAudioContext): 1,000 notes scheduled through the Scheduler start within 1 ms of `audioTimeAt(tick)` (measured by the rendered buffer's onset positions). TT: a 10 min loop shows absolute drift < 2 ms between `audioTimeAt(loopStart)` on pass 1 and pass N minus the exact loop length. |
| S-10 | Scheduling is bounded. The Scheduler never schedules more than 120 ms ahead and never blocks the main thread for more than 4 ms per tick (events beyond the budget stay in the cursor for the next tick). | UT (audio): a 2,000-note chord at one tick is scheduled over several ticks with each tick's `performance.now()` delta <= 4 ms in the fake-clock harness; `sched.noteOn.at - clock.now() <= 0.125` for every emitted note. |
| S-11 | Imported data is treated as untrusted and bounded. Every parser checks lengths and offsets before reading, enforces the brief's limits (file <= 25 MB, events <= 1,000,000, tracks <= 128, chord <= 16, 5 s budget) and yields to the event loop every 20,000 events. | FT: every malformed and truncated corpus file returns a result or a typed error, never throws out of `parseAsync`, and finishes within 5 s; a synthetic file declaring 2^31 events fails with `E-IMP-004` before allocation. |
| S-12 | Import never touches the current project until confirmed. `Import.importFile` returns an `InspectionReport` that holds a new `Song`; only `Project.Catalog.register` or `Project.fromSong` (called by SCR-ImportInspect after DLG-ImportReplace) changes state. | IT: importing a file while a dirty project is open and then cancelling leaves `Project.current()` unchanged by deep equality and `isDirty()` unchanged. |
| S-13 | Inputs are stateless with respect to modes. M-07 holds per-control lifecycle state only; pressing a control in a mode that does not bind it emits nothing beyond `input.event`; held controls are released on leave. | UT (input): after `releaseAll('system')`, `held()` is empty and exactly one `release` was emitted per previously held control. |
| S-14 | Saves report success only after read-back. `Storage.saveProject` emits `project.saved` only after the verify step of the safe write; `project.saveFailed` is emitted on any failure; `markClean` runs only on `project.saved`. | UT (storage, FakeIndexedDB): with `storage.writeFail` injected, no `project.saved` fires, `isDirty()` stays true, and the previous record and its `.bak` are intact. |
| S-15 | Rendering failure never stops the transport. `render.contextLost` leaves `Transport.state()` unchanged; audio continues; the Abstract fallback resumes visuals. | FI: injecting `render.contextLoss` during playback leaves `transport.state` unchanged and `sched.noteOn` events continuing at the same rate; after 3 s without restore `render.tier` becomes Abstract and the highway draws on `#flat`. |
| S-16 | Audio failure never destroys project data. `audio.state` changes, `panic(true)` and context rebuilds never touch `Project`. | FI: injecting `audio.fail` while a project is dirty keeps `Project.current()` deep-equal to a snapshot; the user can still Export. |
| S-17 | Visuals never invent activity. Controllers and visualizers emit no motion from silence: with no `sched.*` events between two beats, performer poses stay within idle bounds and particle counts are zero. | UT (animation): a 4-bar rest in a test song produces idle-bounded poses for every controller and zero visualizer spawns; `BeatIndicator` still pulses (it is driven by `sched.beat`, which is music structure, not activity). |
| S-18 | One instance of each shared engine. Exactly one `AudioContext` exists per page life (plus `OfflineAudioContext` instances for export and tests); exactly one `Transport.main`; exactly one Scheduler binding at a time. | UT (audio): calling `Audio.init()` twice returns the same `ctx`; `Scheduler.bind` while bound throws `E-AUD-005`. IT: 20 mode cycles leave `Audio.ctxCount() === 1`. |

Build-lint additions named in this table (S-01, S-04, S-07) are owned by Part 3.3.4 and
apply to the shipped and test builds equally.

### 4.7 Mode transition contract (M-28)

Exactly one mode is active at a time. `FLM.Modes.enter(mode, params)` and `FLM.Modes.leave(reason)`
are the only ways to change it; both return Promises and are serialized (a call made while a
transition is in progress waits for it). Modes are the sixteen names of the brief:
`menu, quickplay, instrument, freeplay, studio, library, import, dance, multiplayer, customize,
settings, help, about, diagnostics, tutorial, results`. Gameplay modes are `quickplay,
instrument, dance, multiplayer, tutorial`; they auto-pause on interruption. Live modes are
`freeplay, studio`; they continue on interruption and re-anchor on return. Panel modes are
the rest; they have no transport binding except `library`, `import` and `customize`, which may
run a preview on `Transport.main` with the Scheduler bound.

Per-mode requirements (`Modes.REQUIREMENTS`):

| Mode | Audio unlocked | Transport loaded | Scheduler bound | Chart | Stage and loop | Input binding | HUD | Touch pads | Project may be dirty |
|---|---|---|---|---|---|---|---|---|---|
| menu | no | no | no | none | no | menu keys only | hidden | hidden | yes (kept in memory) |
| quickplay | yes | song | yes | instrument or dance | yes | gameplay | shown | shown on touch devices | yes |
| instrument | yes | song | yes | instrument | yes | gameplay | shown | shown on touch | yes |
| freeplay | yes | tempo-only song | yes | none | yes | gameplay plus octave and profile keys | shown (reduced) | shown on touch | yes |
| studio | yes | project song | yes | none | yes (stage optional, small) | gameplay while recording or auditioning, editor keys otherwise | transport bar | shown while recording | yes |
| library | no | preview song | yes for preview only | none | no | menu keys | hidden | hidden | yes |
| import | no | preview song after import | yes for preview only | preview instrument chart | no | menu keys | hidden | hidden | yes |
| dance | yes | song | yes | dance | yes | dance controls | dance HUD | dance pads | yes |
| multiplayer | yes | song (after `selectChart`) | yes | instrument or dance | yes | gameplay | shown plus peers | shown on touch | yes |
| customize | no | no | no | none | yes (one performer, preview loop by RAF, no transport) | menu keys | hidden | hidden | yes |
| settings | no | no | no | none | no | menu keys | hidden | hidden | yes |
| help | no | no | no | none | no | menu keys | hidden | hidden | yes |
| about | no | no | no | none | no | menu keys | hidden | hidden | yes |
| diagnostics | no | no | no | none | no | menu keys | hidden | hidden | yes |
| tutorial | yes | tutorial song | yes | tutorial chart per step | yes | gameplay | shown | shown on touch | yes |
| results | no | no (unloaded on enter) | no | none | no | menu keys | hidden | hidden | yes |

A mode whose "Audio unlocked" cell is "yes" cannot be entered while `Audio.isUnlocked()` is
false: `enter` shows DLG-AudioBlocked first and resumes the transition when `audio.unlocked`
fires or rejects with `E-AUD-002` when the user cancels (the menu stays).

#### 4.7.1 Enter sequence

`enter(mode, params)` runs these steps in order. Every created resource is tagged with the
mode's owner token `owner = Symbol(mode + ':' + uid())`, which the leave sequence uses.

1. Serialize: wait for any transition in progress. If a mode other than `menu` is active,
   run the full leave sequence (4.7.2) first with `reason:'user'` (or the given reason).
2. Baseline: if the previous mode was `menu` (or none), record `baseline = Modes.baseline()`
   (the counter snapshot of 4.7.3). The baseline is taken only in `menu` so that menu-level
   resources (menu screen, banner listeners) are part of it.
3. Requirements: check the row above. Audio unlocked -> wait for unlock through DLG-AudioBlocked.
   Storage read-only (`storage.state.readOnly`) and mode `studio` -> DLG-Unsupported variant
   "Another tab has this project open. Studio opens read-only." and `params.readOnly = true`.
4. Mark `Modes.current = {mode, params, owner, enteredAt: Core.now()}`; `history.pushState({mode,
   screen}, '')` (Part 7.4); set `document.body.dataset.mode = mode`.
5. Load music: `Transport.main.load(song, {countInBars, speed, loop, tempoOverride})` where
   `song` comes from `params.songId` through `Project.Catalog.getSong`, from `Project.current().song`
   (studio, freeplay with a project) or from a fresh `Song.create` (freeplay without a project).
   `Transport.main.setClock(Audio.clock())` is already done at boot and not repeated.
6. Audio binding: `Audio.Scheduler.bind(Transport.main, song, mixer)` creates one `ChannelStrip`
   per track and applies `mix` and the project master gain; `Audio.Metronome.configure(settings)`.
   In `import` and `library` the binding is created only when the user presses the preview
   Play button and released when the preview stops or the mode leaves.
7. Charts: instrument modes call `Mapping.ChartGenerator.generateAsync(song, trackId,
   difficulty, profile, options)` (yielding every 20,000 source events) and wait for
   `chart.ready`; dance modes call `Dance.DanceChartGenerator.generate`; `multiplayer` verifies
   `settingsHash` against the host's before binding. Generation failure -> `E-IMP-010`
   returnToMenu.
8. Judge: `Rhythm.Judge.bind({timeMap: Transport.main, strayPenalty, windowsPreset})` from `settings.gameplay`,
   then `judge.load(chart, song, windows)` and `judge.setCalibration(settings.calibration)` (dance:
   `Dance.DanceJudge.bind`). The Judge subscribes to `input.event` with `owner`.
9. Stage: `Stage.build(Render.renderer(), performers, {camera, highway: chart ? {chart, leadMs}
   : null, tier})`; performers come from the project characters or defaults (one per track up
   to five slots); `Animation.Mixer` controllers are created per performer by instrument
   family; `StageDirector` starts in FullBand. `Render.startLoop(frame)` begins the RAF loop
   with `frame(audioNow, dt)` calling `Stage.update`, `Animation.Mixer.update`, HUD polling of
   `Audio.peak()` when visible and `Input.pollGamepad()`; the auto-tier check runs inside M-18's own
   loop (Part 9.3.4), and M-28 calls `Render.holdAutoTier(3000)` here.
   In the Abstract tier the same loop drives `Flat2D`.
10. Input: `Input.bind({owner, context:'menu' or 'instrument' or 'freeplay' or 'dance' or 'studio', surface: '#view',
    pads: '#touch', controls: [...]})` installs the surface listeners (pointer, touch
    gesture suppression) and enables the control set; `UI.TouchPads.show(layout)` when
    `Caps.maxTouchPoints > 0` and the setting `input.padsVisible` is not `'never'`.
11. UI: `UI.HUD.show(kind)` (`'instrument'`, `'dance'`, `'freeplay'`, `'studio'`), `UI.HUD.reset()`;
    `UI.Screens.push('SCR-<Mode>', params)` mounts the screen controller (M-27), which
    subscribes to its topics with `owner`.
12. Subscriptions: M-28 subscribes with `owner` to `chart.finished` (-> `enter('results')`),
    `transport.state` with `reason:'end'` (free play and studio: stop only), `net.state`
    `ended` (-> results or menu), and the interruption sources (4.7.4).
13. Emit `mode.enter {mode, prev, params, ms}`.
14. Start: gameplay modes call `Transport.main.play()` after the screen's ready signal
    (SCR-QuickPlay and SCR-Instrument start immediately after a 1-bar or 2-bar count-in per
    setting; SCR-Dance the same; SCR-Multiplayer waits for the host `start`; `tutorial` waits
    for the step script); live modes start stopped and wait for the user.

If any step throws, `enter` runs the leave sequence for the partially entered mode, reports
`E-MODE-002` ("<mode> could not start: <message>", class returnToMenu), and resolves to
`menu`.

#### 4.7.2 Leave sequence

`leave(reason)` runs these steps in order; it never throws (each step is in its own try block
and a failure is reported as `E-MODE-003` with the step name, then the sequence continues).

1. Freeze input: `Input.releaseAll('system')` (emits one `release` per held control so judges
   and recorders close holds and notes), then `Input.unbind(owner)` (removes surface listeners
   and disables the control set; menu keys remain through the boot-level binding).
2. Recording guard: if `Studio.Recorder.state()` is `recording` or `countin`, `Recorder.abort()`
   (the aborted take is discarded; the previous take is untouched) and `studio.recording
   {state:'aborted'}` is emitted.
3. Stop transport: `Transport.main.stop()` -> `transport.state {state:'stopped', reason}`;
   the Scheduler reacts by clearing its cursor and pending list and stopping its interval.
4. Soft panic: `Audio.panic(false)` releases every voice with a 30 ms gain ramp and emits
   `audio.panic {hard:false}`; M-06 marks all voices releasing.
5. Hard panic check: wait 350 ms (longest patch release 300 ms plus margin) using
   `Core.timers.setTimeout(..., owner)`; then if `Audio.VoiceAllocator.activeCount() > 0`,
   `Audio.panic(true)` disconnects and rebuilds the bus graph (`audio.panic {hard:true,
   reason:'mode'}`) and logs `E-AUD-006` as recoverable (a stuck voice is a defect to fix).
   During these 350 ms no other step runs, but the UI is not blocked (the screen shows its
   leaving state).
6. Judge and charts: `Rhythm.Judge.dispose()` or `Dance.DanceJudge.dispose()`; chart objects
   are dropped (charts are plain data; nothing to dispose).
7. Scheduler and strips: `Audio.Scheduler.unbind()` disposes every `ChannelStrip` created at
   enter (gain nodes disconnected), keeps master, limiter and metronome bus. `Transport.main.unload()`
   clears the song, loop and anchors (state stays `stopped`).
8. Stage: `Render.stopLoop()` cancels the RAF handle; `Stage.dispose()` disposes nodes, meshes,
   instanced buffers and highway textures through `Render` so the GL counters return to the
   baseline; `Animation.Mixer.dispose()`; `Flat2D.clear()`.
9. Timers: `Core.timers.clearOwner(owner)` and `Core.raf.cancelOwner(owner)` cancel anything
   the mode or its screens created (autosave idle timer, toast timers created with the
   owner, debounce timers).
10. UI: `UI.HUD.hide()` and `UI.HUD.reset()`; `UI.TouchPads.hide()`; `UI.closeAllDialogs('mode-leave')`
    (each open dialog resolves with `result:'dismissed'`); `UI.Screens.popTo('SCR-MainMenu')`
    (unmounts every screen above the menu root; screen controllers remove their DOM in
    `unmount`); `document.body.dataset.mode = 'menu'`.
11. Listeners: `Core.dom.offOwner(owner)` and `bus.removeOwner(owner)` remove any listener
    the mode, its screens, the Judge, the Stage or the Recorder registered with the token.
12. Network: if `mode === 'multiplayer'`, `Net.close(reason)` sends `leave` to peers (best
    effort, 200 ms), closes the DataChannel and the RTCPeerConnection or the relay socket,
    and emits `net.state {state:'ended'}`. Leaving to `results` after a multiplayer song keeps
    the connection open (results then returns to the lobby); this is the one case where
    `Net.connectionCount()` may be non-zero after a leave, and `assertClean` is told so by
    `reason:'finished'` plus `next:'results'`.
13. Autosave: if `Project.isDirty()` and the previous mode is `studio` or `freeplay` (modes
    that create project changes) and no recording is in progress (guaranteed by step 2), call
    `Storage.autosave(Project.current())` with a 2,000 ms timeout; on failure
    `project.saveFailed` is emitted and SCR-MainMenu shows DLG-SaveFailed with Export. The
    project stays in memory either way; leave does not block on the dialog.
14. Emit `mode.leave {mode, next, reason, ms, leaks}` after step 15 computes `leaks`.
15. `assertClean()` against the baseline; a non-null result is reported as `E-MODE-001`
    (recoverable; details in the log and in `Diagnostics.export()`); in the test build the
    integration tests fail on it.
16. `Modes.current = {mode:'menu', ...}`; the caller continues with `enter(next)` when leaving
    was part of a transition.

Total leave time budget: <= 400 ms on desktop including the 350 ms voice wait (the wait is
skipped when `VoiceAllocator.activeCount() === 0` immediately after the soft panic, which is the
common case when the transport was already stopped).

#### 4.7.3 `FLM.Modes.assertClean()` counters

`baseline()` returns the counter snapshot; `assertClean()` returns `null` when every counter
meets its condition, else an object `{counter: {expected, actual}}` for each violation.

| Counter | Read from | Condition after leave |
|---|---|---|
| `activeVoices` | `Audio.VoiceAllocator.activeCount()` | `=== 0` |
| `schedulerRunning` | `Audio.Scheduler.running()` | `=== false` |
| `schedulerPending` | `Audio.Scheduler.pending()` | `=== 0` |
| `strips` | `Audio.stripCount()` | `=== baseline.strips` (0 in menu) |
| `audioNodes` | `Audio.nodeCount()` (count of nodes created through `Audio` factories minus disposed) | `=== baseline.audioNodes` |
| `transportState` | `Transport.main.state()` | `=== 'stopped'` and `Transport.main.song() === null` |
| `timers` | `Core.timers.count()` (all live timeouts and intervals created through the wrapper) | `=== baseline.timers` |
| `rafHandles` | `Core.raf.count()` | `=== 0` and `Render.loopRunning() === false` |
| `busListeners` | `bus.listenerCount()` | `=== baseline.busListeners` |
| `domListeners` | `Core.dom.count()` | `=== baseline.domListeners` |
| `glBuffers`, `glTextures`, `glPrograms`, `glVaos` | `Render.counters()` | each `=== baseline.<counter>` (base programs and the glyph atlas belong to the baseline) |
| `sceneNodes` | `Render.renderer().scene.count()` | `=== 0` |
| `openDialogs` | `UI.dialogCount()` | `=== 0` |
| `screenDepth` | `UI.Screens.depth()` | `=== 1` (SCR-MainMenu only) |
| `hudHidden`, `touchHidden` | `#hud.hidden`, `#touch.hidden` | both `=== true` |
| `heldControls` | `Input.held().length` | `=== 0` |
| `boundSurfaces` | `Input.boundSurfaces()` | `=== 0` |
| `recorderState` | `Studio.Recorder.state()` | `=== 'idle'` |
| `netConnections` | `Net.connectionCount()` | `=== 0`, except `leave` with `next:'results'` from `multiplayer` where it must equal `baseline.netConnections` of that session (1) |
| `audioBuffers` | `Import.audioBufferCount()` | `=== Project.current() ? Project.current().audioTrackCount() : 0` |
| `undoDepth` | `Project.current() ? UndoStack.depth() : 0` | unchanged by leave (informational; recorded, not asserted) |
| `heapMB` | `performance.memory.usedJSHeapSize / 1048576` when available | recorded, not asserted per leave; the 20-cycle test asserts growth <= 10 MB |

Wrappers that make the counters possible (all in M-01):

```js
FLM.Core.timers.setTimeout(fn, ms, owner) -> id;  clearTimeout(id);  setInterval(fn, ms, owner) -> id;
FLM.Core.timers.clearInterval(id);  clearOwner(owner) -> n;  count(owner?) -> n
FLM.Core.raf.request(fn, owner) -> id;  cancel(id);  cancelOwner(owner) -> n;  count() -> n
FLM.Core.dom.on(el, type, fn, opts, owner) -> off;  off(el, type, fn, opts);  offOwner(owner) -> n;  count() -> n
```

The build lint (Part 3.3.4) bans raw `setTimeout(`, `setInterval(`, `requestAnimationFrame(`
and `addEventListener(` outside `01-core.js`, `shell.html` and `90-selftest.js`, so every
timer, frame request and listener is counted.

#### 4.7.4 Interruptions (summary; the full table is Part 6 M-28)

| Event | Gameplay modes | Live modes (freeplay, studio) | Panel modes |
|---|---|---|---|
| `visibilitychange` to hidden | `Transport.pause()`, `Input.releaseAll('system')`, SCR-Pause shown with reason "Paused because the game went to the background" | continue; `Input.releaseAll('system')`; recording in progress is stopped (not aborted: the take is kept up to the last event) | nothing |
| `visibilitychange` to visible | stay paused (user resumes) | drift check: if `Scheduler.cursorTick` differs from `positionAt(audioNow)` by more than 5 ms of song time, log and re-anchor; `audio.state` re-checked | nothing |
| `pagehide` | as hidden, plus `Storage.autosave` if dirty and not recording (synchronous localStorage path only) | same | autosave if dirty |
| `audio.state` leaves `running` | `Transport.pause()`; DLG-ResumeAudio on return | pause playback (not the editor); DLG-ResumeAudio | nothing |
| orientation change or resize | `ui.layout` -> highway and pads relayout; no pause; rotate recommendation per Part 7.5 | relayout | relayout |
| `gamepaddisconnected` while any gamepad control is held | release those controls; pause with reason "Controller disconnected" | release | nothing |
| `render.contextLost` | HUD note "Graphics paused"; audio and scoring continue; after 3 s without restore -> Abstract tier | same | same (no visible effect) |
| low memory heuristic (`performance.memory` > 80 percent of `jsHeapSizeLimit`, or two consecutive `sched.stall` > 500 ms) | downgrade one tier; toast "Reduced visual quality to keep audio stable" | same | nothing |
| `sched.stall` > 500 ms while playing | `Transport.pause()` with reason "Playback stalled"; SCR-Pause | log only; scheduler catch-up rule applies | n/a |

### 4.8 Public surface `window.FLM`

The page defines exactly one global, `window.FLM`, plus two transient names: `window.__flmEarlyErrors`
(created by the shell's early handler, deleted by M-01 at load) and `window.__FLM_RESULTS`
(test build only, written by `FLM.selfTest`). The build lint (Part 3.3.4) fails on any other
`window.<name> =` assignment and on any top-level declaration outside an IIFE.

```js
window.FLM = {
  VERSION: '1.0.0',                 // from the VERSION constant in 01-core.js; stamped by the build
  BUILD: { date: 'YYYY-MM-DD', test: false, online: null },   // build.mjs stamps date, test flag, relay URL or null
  Core, Theory, Model, Transport, Audio, Instruments, Input, Mapping, Rhythm, Midi, Zip,
  MusicXml, GuitarPro, Import, Project, Storage, Studio, Render, Rig, Animation, Stage,
  Character, Dance, Net, Progress, UI, Screens, Modes, Boot, Content,
  SelfTest,                         // test build only; absent from FingerLickinMusic.html

  /** Runs self-test groups. `groups`: a group name, an array of names, or undefined for all.
   *  Resolves to the results object (Part 3.4.4) and assigns it to window.__FLM_RESULTS.
   *  In the shipped build it resolves to {skipped:true, reason:'not a test build'}. */
  selfTest(groups, opts /* {slow:boolean, grep:string, timeoutMs:number} */) /*: Promise<object> */ {},
  selfTestReady: false,             // set true by Boot step B13 in the test build, never in the shipped build

  /** Returns the diagnostics JSON (Part 10.10): version, build, caps, tier, mode, settings
   *  (redacted), last 500 log entries, error list, counters. Never song content unless
   *  opts.includeSong === true. Size <= 200 KB (older log entries dropped first). */
  diagnostics(opts /* {includeSong:boolean} */) /*: object */ {},

  debug: {
    enabled: false,                 // true with ?diag or in the test build; gates inject()
    get tier() {}, set tier(name) {},   // reads Render.tier(); setter calls Render.setTier(name, 'user')
    showStats: false,               // setter shows or hides the diagnostics overlay (M-26)
    inject(fault, args) /*: boolean */ {},   // Part 10.9 fault list; returns false when not enabled
    clear(fault) /*: void */ {},    // removes an injected fault
    log(level /* 'debug'|'info'|'warn'|'error' */) /*: Array */ {},   // Log entries at or above level
    counters() /*: object */ {},    // the assertClean counter snapshot
  },
};
```

Rules:

- `FLM.<Namespace>` objects are the module APIs of 4.1; they are the same objects in the
  shipped and test builds. Tests reach internals only through documented API and the fakes
  in M-31, never through extra properties added for tests (no `_private` exposure).
- Nothing else is global: no global helper functions, no global constants, no `var` at the
  top level, no `globalThis` writes. CSS classes and element ids are the DOM-side surface and
  are listed in Part 3.2 and Part 7.
- `FLM.debug.inject` is the only entry point for fault injection; shipped builds keep the
  function but it returns `false` unless `?diag` was given, so a user cannot trigger faults
  by accident while a tester can reproduce a report with the URL parameter.
- URL parameters recognized by M-29 (and nothing else reads `location.search`): `test`,
  `tier`, `diag`, `online`, `perf`. They are read once at boot; changing them requires a
  reload.

### 4.9 Error propagation

Every module reports through one function:

```js
/** @param {string} code     e.g. 'E-AUD-003' (Part 10.6 taxonomy; unknown codes are accepted and logged as 'E-GEN-000')
 *  @param {Error|string|null} err   the original error (stack kept in the log, never shown to the user)
 *  @param {object=} context  module, operation, ids, sizes; must not contain song content or file bytes
 *  @returns {{id:string, code:string, class:string, message:string, userMessage:string, module:string, at:number, count:number}} */
FLM.Core.ErrorReporter.report(code, err, context) {}
/** Shortcut that forces class 'reload' and shows #fatal. */
FLM.Core.ErrorReporter.fatal(code, err, context) {}
/** Class override for a code (used by tests and by Modes to escalate). */
FLM.Core.ErrorReporter.classify(code) /*: 'recoverable'|'returnToMenu'|'reload' */ {}
```

`report` does, in order: build the record (class from the taxonomy table of Part 10.6, with
the defaults below when a code is unknown; `userMessage` from the text catalog of Part 7.11,
falling back to "Something went wrong (<code>)."), dedupe (a record with the same `code` and
`module` within 1,000 ms increments `count` on the existing record and re-emits nothing),
append to `Log` at level `error`, append to the error list kept for `diagnostics()` (last 50),
emit `error`, then act on the class as in the table. It never throws.

Default class by code prefix when Part 10.6 has no row: `E-CAP-*` reload; `E-AUD-*` recoverable
except `E-AUD-001` (context creation) reload; `E-REN-*` recoverable (tier fallback is the
recovery); `E-IMP-*` recoverable (the import fails, the project stays); `E-STO-*` recoverable
(the save fails visibly); `E-PRJ-*` recoverable (the load fails visibly); `E-NET-*`
recoverable (the session ends or stays in lobby); `E-INP-*` recoverable; `E-EXP-*`
recoverable; `E-MODE-*` recoverable except `E-MODE-002` returnToMenu; `E-GEN-*` decided by
origin (below).

| Class | Meaning | Who acts | UI shown | Transport and project |
|---|---|---|---|---|
| recoverable | the operation failed; the application continues in the same mode | the reporting module (returns a failure result to its caller); M-26 shows a toast when `userMessage` is non-empty and the same code was not toasted in the last 10 s | toast "<userMessage>" with an action button when the taxonomy row names one (for example "Export" for `E-STO-001`); dialogs for save and import failures are shown by M-27 from `project.saveFailed` and `import.failed`, not from `error` | unchanged |
| returnToMenu | the current mode cannot continue safely | M-28 subscribes to `error`; on this class it runs `leave('error')` (full teardown including soft and hard panic) and then `UI.dialog(DLG-NetError or DLG-Unsupported variant "Returned to the menu")` with the `userMessage` | dialog on SCR-MainMenu: title "<operation> stopped", text `userMessage`, buttons "OK" and "Copy diagnostics" | transport stopped by leave; project kept in memory; autosave attempted by the leave sequence |
| reload | the page state cannot be trusted (module failed to define, AudioContext cannot be created, error storm) | M-01 itself: emits `error` (so M-05 can attempt a soft panic and M-16 can attempt a synchronous localStorage autosave of the current project if `Project.current()` exists and is dirty), then sets `#fatal-text` with `userMessage` and `code`, adds class `show` to `#fatal`, wires "Copy diagnostics" to `navigator.clipboard.writeText(JSON.stringify(FLM.diagnostics()))` with a `textarea` fallback | `#fatal` panel (static DOM from Part 3.2.5) | transport left as is (audio is stopped by the soft panic attempt); the project is written to `flm.v1.recovery` in localStorage when it fits (<= 2 MB) and offered on next boot by SCR-MainMenu ("Recover unsaved project?") |

Origin rules for uncaught errors (`window.onerror` -> `E-GEN-001`, `unhandledrejection` ->
`E-GEN-002`):

1. During Phase A or Phase B of boot (before `boot.ready`): class reload.
2. Inside the render loop callback (`Render` wraps `frame` in a try block and reports with
   `context.origin = 'frame'`): the first error in a mode is recoverable (the frame is
   skipped); the third error within 10 s in the same mode escalates to returnToMenu.
3. Inside a Scheduler tick (`context.origin = 'scheduler'`): recoverable; the tick's remaining
   events are scheduled on the next tick; three in 10 s escalate to returnToMenu.
4. Inside a bus listener (`context.topic` set): recoverable; the listener is not removed
   (a listener that throws on every emit is a defect surfaced by the dedupe counter).
5. Anywhere else: recoverable.

Error storms: more than 20 reports in 10 s (any class) escalate the next report to
returnToMenu; more than 3 returnToMenu transitions in 60 s escalate the next to reload. The
counters reset on `mode.enter` of `menu` after 60 s without errors.

What the user sees for each class is fixed by Part 7.11 (text catalog) and Part 10.6
(taxonomy); this part fixes who shows it and when. Two guarantees hold for every class:
the record is in the log before any UI is shown, and no module other than M-01 (fatal),
M-26 (toast) and M-27 (dialogs) creates error UI.

Test hooks: `FLM.debug.inject('error.throw', {origin:'frame'|'scheduler'|'listener'})` makes
the next frame, scheduler tick or `error` listener throw once so the integration tests can
check each origin rule; `ErrorReporter.records()` returns the last 50 records for assertions.
