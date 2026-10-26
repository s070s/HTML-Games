## 1. Product scope and delivery profiles

### 1.1 Product summary and the five pillars

Finger Lickin Music is a browser music game delivered as one HTML file,
`Finger Lickin Music/FingerLickinMusic.html` (B 2, B 5, B 29). In that one file the
player performs any of 128 General MIDI instruments with four buttons against a scrolling
chart, improvises in Free Play with six mapping profiles, records and layers tracks in a
multitrack Studio, imports MIDI, MusicXML and Guitar Pro 3-5 arrangements and turns any
track into a playable chart without altering the source, watches a procedurally built 3D
band whose every movement is derived from the scheduled musical events, plays a
four-direction Dance Mode on the same musical timeline, customizes the band members, keeps
a local progression record, and plays with 2-4 people over WebRTC using copy-paste invite
codes (an optional relay server adds room codes in the Online edition). Every mode is a
different experience on one engine (I 1.1): one integer-tick timeline at PPQ 960, one
Transport anchored to the audio clock, one Web Audio synthesizer, one input abstraction,
one renderer with four quality tiers, one Project model. At plan version 1.0.0 nothing is
implemented; "v1" below means the first release produced by executing this plan (game
`FLM.VERSION` 1.0.0).

The five pillars of I 21 are the acceptance lens for the whole plan. A feature counts
toward a pillar only when the named evidence exists (test IDs are assigned in Part 12).

| Pillar (I 21) | What it means in this product | Acceptance evidence | Primary modules |
|---|---|---|---|
| Musical accuracy | Integer ticks (PPQ 960), TempoMap and MeterMap respected, polyphony never collapsed, GM program mapping correct, drums on channel 10, imports preserve the source with warnings for anything not preserved | UT for M-03, M-04, M-05, M-10 to M-14; TT drift tests (abs drift < 2 ms after a 10 min loop, scheduled start within 1 ms); FT corpus (every file in Part 8.9); AT for B 3.1, B 3.5, B 9, B 11, B 15, B 26.3 | M-02 to M-06, M-10 to M-14 |
| Immediate playability | Quick Play demo playable <= 5 s desktop and <= 8 s mobile after file open; four buttons on keyboard, touch and gamepad; profiles A-F; deterministic chart generation per difficulty; calibration applied exactly once | PT startup scenario; UT for M-07, M-08, M-09 (boundary tests at exactly +/- window, determinism); IT input -> audio and input -> scoring; XT on the five browsers; LT on physical devices | M-07, M-08, M-09, M-26, M-27 |
| Expressive visualization | Animation and stage effects derive from `sched.noteOn`/`sched.noteOff` and audio time, never from frame count; performers are still during rests; abstract visualizers and the Abstract tier keep the event-to-visual relationship when humanoid animation is unavailable | UT for M-19 to M-21 (pose amplitude at event time, stillness in rests, determinism); IT imported MIDI -> animation; XT tier selection per device; FI `render.contextLoss` and `render.slowFrames` | M-18 to M-22 |
| Creative freedom | Free Play with record and replay, Studio with count-in, overdub, loop record, piano roll, quantize, undo/redo, mixer, markers; export to `.mid`, `.flm.json`, WAV | UT for M-15, M-17; IT record -> save -> reload, multitrack playback and mixing; FT round trips (Part 8.11) | M-15, M-16, M-17 |
| Reliability | Safe write with read-back and `.bak`, autosave only at safe points, panic for all voices, full mode teardown proven by `FLM.Modes.assertClean()`, parsers that never crash on the malformed corpus, fault injection, the E 13 release gate | FI tests for every `FLM.debug.inject` fault (Part 10.9); IT 20 enter/leave cycles with growth <= 10 MB; FT malformed and truncated files; LT interruption cases; the Part 12.10 gate | M-01, M-16, M-28, M-29, M-31 |

Pillar coverage is re-read at every phase gate (Part 11) and in the Phase 16 review
(Part 14). A feature whose evidence is missing is reported as Partial or Unimplemented in
`docs/STATUS.md`, never as Implemented because its screen exists (B 1.4, E 10 item 12).

### 1.2 The unified engine and its modes

The engine is a fixed set of shared systems, each existing exactly once for the lifetime of
the page. A mode "binds" a system when the mode manager (M-28) hands it to the mode on
enter and takes it back in the leave sequence of Part 4.7. No mode constructs its own copy
of a shared system, two modes are never active at the same time, and `mode.enter` for the
next mode is emitted only after `mode.leave` of the previous mode has completed and
`assertClean()` has passed (I 1.1, E 10 items 1 and 13).

| Shared system | Namespace | Exactly one of | Notes |
|---|---|---|---|
| Transport | `FLM.Transport` | transport state machine, position, loop, speed, count-in | Drives the Scheduler cursor; the only writer of musical position |
| Audio | `FLM.Audio` plus `FLM.Instruments` | `AudioContext`, bus graph, `VoiceAllocator`, `Scheduler`, metronome | Created at the audio unlock gesture and never recreated except by hard panic rebuild of the graph (same context) |
| Input | `FLM.Input` | listener set, `InputState`, calibration anchor | Gameplay controls only; DOM widgets use ordinary DOM events through M-26 |
| Mapping | `FLM.Mapping` | active profile A-F and its parameters | Converts `InputEvent` to musical actions for sound; charts are generated by `ChartGenerator` in the same module |
| Rhythm | `FLM.Rhythm` | `Judge`, `ScoreState`, chart cursor | Used by instrument, dance, multiplayer and tutorial; `restart()` clears all state |
| Render | `FLM.Render` | GL context (or `Flat2D`), scene graph root, stats | Tier chosen at boot and on downgrade; never advances musical time |
| Stage | `FLM.Stage` plus `FLM.Rig`, `FLM.Animation`, `FLM.Character` | performer slots 0-4, props, effects, camera, highway | Composed from the current characters and the current Song's tracks |
| Project | `FLM.Project` with `FLM.Storage` | the current `Project` (persistent or transient) | "Transient" means created for a mode and never saved unless the user asks |

Mode table. Screens are listed by `SCR-*` name; layouts and states are specified in Part 7.
`SCR-Pause` is a screen inside the gameplay modes, not a mode. Exit paths name the
destination mode and the guard dialog where one applies.

| Mode | Screen(s) | What the user does | Binds | Exit paths |
|---|---|---|---|---|
| menu | SCR-MainMenu | Chooses one of the twelve entries (brief section 7 order); reads one-line reasons on disabled entries; sees the current project name when one is open; sees the daily challenge card | Render, Stage (idle band built from the saved characters, silent; in the Abstract tier a static title card) | Any entry -> that mode. Root of the screen stack: browser back does nothing here |
| quickplay | SCR-QuickPlay | Quick Start level: picks a song (built-in or imported), an instrument track or Dance, a difficulty, then Play. Customize level (reached from the "Instrument Mode" menu entry): also control layout and profile, backing tracks on or off, visualization on or off, chart preview per difficulty, practice options (I 6.3), audio and input shortcuts | Project (the chosen song loaded into a transient read-only Project when no project is open), Render, Stage (idle preview of the band for the chosen song) | Play -> instrument or dance with origin `quickplay` or `instrumentmode`; Back -> menu |
| instrument | SCR-Instrument, SCR-Pause | Plays the four-button chart of one track while the arrangement plays; practice tools from SCR-Pause (mute target, accompaniment level, loop, speed, restart at section) | Transport, Audio, Input, Mapping, Rhythm, Render, Stage, Project (read-only) | Song end -> results; `Escape` -> SCR-Pause -> Resume, Restart (full leave then enter with identical parameters), Quit -> origin |
| freeplay | SCR-FreePlay | Triggers notes and chords with profiles A-F (`Digit1-6`), picks instrument, key, scale or chromatic, octave (`KeyQ`/`KeyE`) and register, sustain, note duration, velocity, metronome, tempo, quantize on or off; records and replays takes | Transport (tempo override, metronome, count-in, recording), Audio, Input, Mapping, Render, Stage (one performer: the player's character), Project (transient Project named "Free Play session", created on the first take) | Back -> menu (DLG-UnsavedChanges when a take exists); Open in Studio -> studio with the same Project (it becomes persistent on first save) |
| studio | SCR-Studio | Creates, renames, reorders, duplicates and deletes tracks; assigns instruments; records with count-in; overdubs; loop-records; edits in the piano roll; quantizes; mixes; sets tempo, meter, key and scale; adds section markers; saves; exports | Transport, Audio, Input, Mapping, Render, Stage (collapsible panel; hidden by default in mobile portrait), Project (read-write) | Back -> menu (DLG-UnsavedChanges when dirty); Play this track -> instrument with origin `studio`; Characters -> customize (Project stays loaded); Export -> dialogs, stays in studio |
| library | SCR-Library | Browses built-in songs, imported songs and saved projects with filters; per item: Play, Open in Studio, Dance, Export, Delete | Project (an item is loaded only when an action is chosen; browsing reads index records) | Play -> quickplay prefilled; Open in Studio -> studio; Dance -> dance with origin `library`; Import -> import; Back -> menu |
| import | SCR-ImportInspect | Picks a file (picker or drag and drop); reads the `InspectionReport`; plays and stops a preview of the candidate; previews the generated chart per difficulty and changes the mapping; confirms or cancels | Transport, Audio (preview of the candidate Song only), Project (the candidate is held outside the current Project until confirmed) | Confirm "Save to Library" -> library with the song added; Confirm "Play now" -> quickplay prefilled; either path shows DLG-ImportReplace first when a project is open and dirty; Cancel -> previous screen with the current Project untouched |
| dance | SCR-Dance, SCR-Pause | Select state: picks song, difficulty (easy, normal, hard) and layout (arrows or pads). Play state: steps on four directions in time, holds and jumps; practice speed and loop | Transport, Audio, Input, Rhythm (lanes = directions), Render, Stage (choreography avatar), Project (read-only) | Song end -> results; `Escape` -> SCR-Pause -> Resume, Restart, Quit -> origin (`dance` select state when entered from the menu) |
| multiplayer | SCR-Multiplayer; play uses the SCR-Instrument layout with the multiplayer HUD additions of Part 7.6 | Reads the privacy statement; creates or joins a room by invite and answer codes (or by 6-character room code through the relay in the Online edition); sets display name and avatar; readies up; the host picks the experience (Synchronized Play or Cooperative Band), song and charts; plays; sees results; reads sync diagnostics | Transport (slaved to the shared clock, host-driven), Audio, Input, Mapping, Rhythm, Render, Stage, Project (read-only), plus `FLM.Net` | Results -> lobby; Leave -> menu (connection closed, room state cleared); host leaves -> results -> SCR-Multiplayer create-or-join state |
| customize | SCR-Characters | Edits a `CharacterConfig`: presets, seeded randomize, every option of the catalog, instrument and slot, animation style; hears and sees a looped preview phrase of the chosen instrument | Transport, Audio (the instrument's preview phrase from M-30 looped at -12 dB, toggleable), Render, Stage (the edited character alone), Project (characters are saved to settings, and to the open Project when one is open) | Back -> previous mode (menu or studio) with the Project still loaded; changes are kept on Back, no dialog |
| settings | SCR-Settings, DLG-Calibration, DLG-RemapConflict | Changes settings by category (Part 5.11); runs the calibration wizard; remaps controls | Input (capture for remapping; tap test), Audio (test tones, metronome preview), Transport (metronome ticks inside DLG-Calibration only) | Back -> previous screen; every change applies immediately and persists on change |
| help | SCR-Help | Reads controls and mode explanations; presses a key, pad or gamepad button to see its current binding | Input (display only; no musical action) | Back -> previous screen |
| about | SCR-About | Reads edition, version, build date, honest limits, licenses, privacy summary | none | Back -> previous screen |
| diagnostics | SCR-Diagnostics | Views timing, audio, render, storage and network metrics and the log tail; exports diagnostics JSON; toggles the stats overlay; runs the self-test in the test build | none bound; reads metrics from every module; Audio only for the "Test tone" button | Back -> previous screen |
| tutorial | SCR-Tutorial | Follows the seven steps of I 11.3: trigger a note, two simultaneous notes, follow a rhythm, change instrument, record a short take, import a song (guided to the picker, skippable), enter studio or dance | Transport, Audio, Input, Mapping, Rhythm (steps 1-3 only), Render, Stage, Project (tutorial Song `tut-basics` from M-30; the recording step uses a transient Project) | Finish or Skip all -> menu (onboarding flag set); step 7 -> studio or dance with origin `tutorial` |
| results | SCR-Results | Reads the `PerformanceSummary`, section stats, personal-best delta, new achievements and unlocks; retries or returns | Render, Stage (idle performers); reads and writes `FLM.Progress` | Retry -> the same gameplay mode with identical parameters (full leave then enter); Back -> the origin screen with its selection state restored; in multiplayer -> lobby |

Origin rule. Every gameplay launch (instrument, dance, tutorial, multiplayer play) carries an
`origin` value from the fixed set `menu`, `quickplay`, `instrumentmode`, `library`,
`import`, `studio`, `dance`, `multiplayer`, `tutorial`, `daily` (the daily challenge card).
SCR-Results "Back" and SCR-Pause "Quit" return to the screen that origin names, with that
screen's filters, selection and scroll position restored (P 21). Retry and Restart never
reuse scoring state: they run the full leave sequence and then enter again (P 5.2).

Menu entry to mode map (B 6.2 order): Quick Play -> quickplay (Quick Start level);
Instrument Mode -> quickplay (Customize level); Free Play -> freeplay; Studio -> studio
(opens the last project or a new empty one); Song Library -> library; Import Music ->
import; Dance Mode -> dance (select state); Multiplayer -> multiplayer; Characters ->
customize; Settings -> settings; Help and Controls -> help; About -> about. Diagnostics is
reached from Settings and from `?diag`; Tutorial from SCR-FirstLaunch, Help and the daily
card when onboarding is incomplete; Results only from gameplay.

### 1.3 Feature tiers

Every bullet of B 4.2, B 4.3 and B 4.4 is one row. Phase numbers are the B 27 phases;
Part 11 refines them into T sections. "Status at v1" is the status at plan version 1.0.0:
Unimplemented means planned for v1; Deferred means specified (where the brief requires)
but not built in v1. GM program numbers are 0-based throughout this plan.

| Feature (spec bullet) | Priority | Phase (B 27) | Modules | Status at v1 | Notes |
|---|---|---|---|---|---|
| Standalone HTML application shell (B 4.2) | P0 | 1 | shell.html, tools/build.mjs, M-01, M-26, M-29 | Unimplemented | ADR-01; players open `FingerLickinMusic.html` directly |
| Desktop and mobile responsive UI (B 4.2) | P0 | 1 | M-26, M-27 | Unimplemented | Breakpoints, orientation classes, safe areas (Part 7.5) |
| Four-button instrument gameplay (B 4.2) | P0 | 3, 8 | M-07, M-08, M-09, M-21 | Unimplemented | Phase 3: input, mapping, judging, calibration; Phase 8: charts, highway, results |
| Free-play instrument mode (B 4.2) | P0 | 6 | M-08, M-17, M-27 | Unimplemented | Includes `Recorder` and take replay from M-17 in Phase 6; the rest of M-17 in Phase 9 |
| Basic note, interval, and chord mapping (B 4.2) | P0 | 3 | M-02, M-08 | Unimplemented | Profiles A, B, C in Phase 3; D, E, F also in Phase 3 (same module, same tests) |
| Audio synthesis or bundled instrument playback (B 4.2) | P0 | 4 | M-05, M-06 | Unimplemented | Synthesis only (ADR-04); all 128 programs mapped in Phase 4 at `synth-basic` or `synth-velocity`; no bundled bank |
| MIDI file import and playback (B 4.2) | P0 | 7 | M-10, M-14, M-03 | Unimplemented | Formats 0, 1, 2; PPQ and SMPTE division |
| Tempo, key, and scale configuration (B 4.2) | P0 | 2, 6 | M-02, M-03, M-04, M-27 | Unimplemented | Model in Phase 2; UI in Phase 6 (Free Play) and Phase 9 (Studio) |
| Basic 3D band visualization (B 4.2) | P0 | 5 | M-18, M-19, M-21 | Unimplemented | WebGL2, WebGL1, Abstract tiers (ADR-03) |
| Note-synchronized instrument animation (B 4.2) | P0 | 5 | M-20 | Unimplemented | Driven by `sched.noteOn`/`sched.noteOff` with 120 ms anticipation |
| Basic character selection and customization (B 4.2) | P0 | 10 | M-22, M-27 | Unimplemented | The 8 presets are data in M-30 and are used by the stage from Phase 5; the editor arrives in Phase 10 |
| Recording and playback of basic performances (B 4.2) | P0 | 6, 9 | M-17, M-04 | Unimplemented | Count-in, time origin at count-in end, held notes closed on stop |
| Local project persistence and export (B 4.2) | P0 | 9 | M-15, M-16 | Unimplemented | `flm-project` v1, safe write, `.flm.json` and `.mid` export |
| Input calibration and latency configuration (B 4.2) | P0 | 3 | M-07, M-09, M-27 (DLG-Calibration) | Unimplemented | Three offsets (`Calibration`), applied once in `Rhythm.Judge` |
| Automated tests for musical timing and file handling (B 4.2) | P0 | 2 onward; full run in 15 | M-31, tools/selftest.mjs, tools/make-corpus.mjs | Unimplemented | Groups `timing` and `files` exist from Phase 2 and Phase 7 and grow per phase |
| Multitrack recording and mixing (B 4.3) | P1 | 9 | M-17, M-05, M-15 | Unimplemented | 32 tracks per project; `ChannelStrip` per track |
| Full MIDI event and track preservation (B 4.3) | P1 | 7 | M-10, M-03 | Unimplemented | Event types of brief section 5; preservation table in Part 8.3 |
| MusicXML import (B 4.3) | P1 | 12 | M-11, M-12, M-14 | Unimplemented | `.xml`, `.musicxml`, `.mxl` (own ZIP reader) |
| Guitar Pro import where technically supported (B 4.3) | P1 | 12 | M-13, M-14 | Unimplemented | GP3, GP4, GP5 only; GP6/7 Unsupported (1.5) |
| Expanded General MIDI instrument coverage (B 4.3) | P1 | 4, 14 | M-06 | Unimplemented | Phase 4 maps all 128 programs through the 16 family templates; Phase 14 raises programs to `synth-velocity` where declared and tunes timbres |
| Polyphonic instrument animation (B 4.3) | P1 | 5 | M-20 | Unimplemented | Chord density widens finger spread (keys), strum amplitude from chord size (guitar); no extra phase |
| Dance gameplay with configurable step patterns (B 4.3) | P1 | 11 | M-23, M-27 | Unimplemented | Three difficulties, arrows or pads layout, custom chart JSON |
| Expanded avatar customization (B 4.3) | P1 | 10 | M-22 | Unimplemented | Full options catalog of Part 6.22 |
| Online multiplayer with synchronization (B 4.3) | P1 | 13 | M-24, M-27 | Unimplemented | Synchronized Play and Cooperative Band; relay optional |
| More complete project export and import (B 4.3) | P1 | 9 | M-15, M-16 | Unimplemented | `.flmdance.json`, `.flmchar.json`, `.flmsettings.json`, WAV mix (OQ-2) |
| Mobile-specific interaction optimization (B 4.3) | P1 | 1 onward; tuning in 14 | M-07, M-26 | Unimplemented | Touch pads, pad layout and size settings, rotate recommendation; measured in Phase 15 |
| Performance profiling and fallback rendering modes (B 4.3) | P1 | 5, 14 | M-18, M-01, tools/perf.mjs | Unimplemented | Tiers in Phase 5; auto-downgrade and perf scenarios in Phase 14 |
| Additional music formats and conversion adapters (B 4.4): audio files | P2 | 12 | M-14 | Unimplemented | `.wav .mp3 .ogg .flac` via `decodeAudioData` as audio tracks only (ADR-06); small enough to ship in v1 |
| Additional music formats and conversion adapters (B 4.4): SoundFont and other sequencer or notation formats | P2 | none | M-14 (adapter registry ready) | Deferred | See 1.5 |
| Advanced instrument articulations (B 4.4) | P2 | none (GP articulations mapped in 12) | M-06, M-13 | Deferred | Legato, portamento and glissando synthesis are Deferred; GP bends, slides, hammer-ons, palm mute, harmonics, dead notes are mapped to velocity, duration and `PitchBendEvent` in Phase 12 |
| More sophisticated procedural humanoid animation (B 4.4) | P2 | none | M-19, M-20 | Deferred | Beyond the controllers specified in Part 6.20 (for example finger-level keys animation) |
| Advanced dance styles and choreography editing (B 4.4) | P2 | none | M-23 | Deferred | Custom chart import and export (JSON) is in v1 (I 7); a choreography editor is not |
| Expanded visual effects and stage customization (B 4.4) | P2 | 11 (unlock catalog only) | M-21, M-25 | Unimplemented for the 3 unlockable stage themes and 2 effects of M-25; Deferred otherwise | No free-form stage editor |
| Advanced mixing, automation, and musical editing (B 4.4) | P2 (global reverb P1, B 16.5) | 14 (global reverb only) | M-05, M-17 | Unimplemented for the global reverb (P1, Phase 14); Deferred for automation, per-track effects, EQ, delay, compression | See 1.5 |
| Optional controller integrations and additional accessibility mappings (B 4.4) | P2 | 3 | M-07 | Unimplemented for Gamepad and Web MIDI input (ADR-10); Deferred for further mappings (for example one-switch play) | Web MIDI only where `Caps.webMidi` and `Caps.secureContext` are true |
| Optional community features (B 4.4) | P2 | none | none | Deferred | No accounts, servers or telemetry (ADR-15); the relay stores nothing |

Mapping of I 18 ("Prioritize improvements by impact") to the B 27 phases. The order of
I 18 is preserved by the B 27 sequence; where B 27 interleaves (Free Play and the rhythm
song mode before the Studio), the I 18 tier spans the phases named.

| I 18 tier | B 27 phases | What the tier delivers in those phases |
|---|---|---|
| 1 Foundation | 1, 2 | Shell, navigation, capability gate, diagnostics; model, TempoMap, Transport, separated clocks (Part 4.5), project versioning scheme (Part 5.5, 5.7) |
| 2 Core gameplay | 3 | Input lifecycle, remapping, calibration, profiles A-F, `Judge` and `Score`, note release rules |
| 3 Audio and imports | 4, 7, 12 | Synthesizer, scheduler, voice allocation, GM table, drums, mixing; SMF import, inspection, honest compatibility data; MusicXML and Guitar Pro |
| 4 Visual identity | 5, 14 | Renderer, rig, controllers, `StageDirector`, camera presets, tiers; Phase 14 optimizes rendering and tunes mobile |
| 5 Creative tools | 6, 9 | Free Play recording; Studio tracks, overdub, piano roll, quantize, undo/redo, safe save, export |
| 6 Additional modes | 8, 10, 11 | Results and performance history (Phase 8); character editor (Phase 10); Dance Mode, achievements, unlocks, daily challenge, practice tools (Phase 11) |
| 7 Online features | 13 | Protocol v1, shared clock, Synchronized Play, Cooperative Band, reconnection, host authority; Collaborative Studio rules written, not built |
| 8 Release quality | 14, 15, 16 | Long-session and memory tests, fault injection, cross-browser and device matrix, packaging verification, final report |

### 1.4 Delivery profiles

B 5.4 and I 14.3 require two operating contexts. Both are the same source and the same
client; they differ only in the build flag `tools/build.mjs --online <relayUrl>` (Part 3.3),
which stamps the edition and relay URL into build constants and widens the CSP
`connect-src` to the relay origin (ADR-12). The Standalone edition is the primary
deliverable (B 3.7). Nothing in either edition requires an account, telemetry or a
download at runtime.

| Feature | Standalone edition | Online edition | Needs | When the need is not met |
|---|---|---|---|---|
| All local modes: menu, quickplay, instrument, freeplay, studio, library, dance, customize, tutorial, results, settings, help, about, diagnostics | Full | Full | Nothing beyond the browser | n/a |
| Import of MIDI, MusicXML, Guitar Pro 3-5, audio files | Full | Full | `<input type=file>` or drag and drop from `file://` (verified per browser, 1.6) | Picker blocked -> drag and drop remains; message names the alternative |
| Export: `.mid`, `.flm.json`, `.flmdance.json`, `.flmchar.json`, `.flmsettings.json`, WAV mix | Full | Full | `a[download]` with a Blob URL; fallback opens a data URL in a new tab (Part 5.14, Part 6.16) | Both blocked -> DLG-SaveFailed-style notice naming copy-to-clipboard for JSON formats |
| Local persistence (localStorage, IndexedDB `flm-db`) | Full | Full | Storage available on the current origin | IndexedDB unavailable -> localStorage-only with a 2 MB project cap and a visible notice; both unavailable -> session-only with export offered on every save |
| Progression: history, personal bests, achievements, unlocks, daily challenge | Full, local | Full, local | Local date for the daily seed | n/a |
| Multiplayer by invite and answer codes (WebRTC P2P, 2-4 players) | Full | Full | Players exchange codes through any channel of their own; same network, or the STUN toggle for NAT traversal | ICE fails -> DLG-NetError with Retry and the LAN hint; standalone play unaffected |
| Public STUN toggle (`stun:stun.l.google.com:19302`) | Available, off by default | Available, off by default | Reachability of the Google STUN service (OQ-3), an external dependency named in the lobby when on | Unreachable -> host candidates only after the 3 s gathering timeout; lobby note "STUN server not reachable; connections may only work on the same network." |
| Relay rooms by 6-character room code | Not available: the control is hidden, About states the Standalone sentence, `?online=` is ignored with a toast | Available | `server/relay.mjs` reachable at the build-time URL over `ws://` or `wss://`; CSP widened at build | Unreachable -> DLG-NetError "Could not reach the relay server at {relayUrl}. You can still play by exchanging invite codes directly." and the lobby switches to invite codes |
| Downloadable sound banks or assets | None | None (I 14.3 permits them; v1 ships none) | n/a | n/a |
| Web MIDI input | Where `Caps.webMidi` and `Caps.secureContext` are true | Same | Secure context and browser support | Control hidden with its reason (1.5) |
| Updates | Replace the file | Replace the file | n/a | n/a |
| Accounts, telemetry, leaderboards beyond the local device | None | None | n/a | n/a |

Edition sentences shown on SCR-About (also the first paragraph of the Multiplayer screen's
"How this works" panel):

- Standalone: "Standalone edition. Everything runs from this file on your device: no server,
  account or network connection is needed. Multiplayer uses direct peer-to-peer connections
  that you set up by exchanging invite codes."
- Online: "Online edition. This build can also use the relay server at {relayUrl} to connect
  players by room code. The relay only forwards messages between players and stores
  nothing. Every other feature works without it."

Toast shown when `?online=<relayUrl>` is present in a Standalone build: "Relay rooms need
the Online edition build. Invite codes still work."

Graceful failure rules (B 5.4, B 17.5, E 11, P 13):

1. The relay URL is used only by `FLM.Net`'s relay transport adapter; no other module
   reads it. A failed or absent relay changes exactly one thing: the "Join by room code"
   and "Create room" controls are replaced by the invite-code flow, with the DLG-NetError
   text above shown once per attempt.
2. STUN is used only inside `RTCPeerConnection` ICE gathering when the toggle is on. Its
   failure is detected by the gathering timeout (3 s, Part 6.24) and reported by the lobby
   note above; the invite code is still produced from the candidates gathered.
3. Multiplayer as a whole is disabled on the main menu only when `RTCPeerConnection` is
   missing (`Caps` check at boot), with the reason "Multiplayer needs WebRTC, which this
   browser does not provide." Every other entry stays enabled.
4. No network failure ever stops the Transport, mutes Audio, closes a Project or writes to
   storage. Leaving the multiplayer mode runs the standard leave sequence (Part 4.7) plus
   closing the `RTCPeerConnection` and the relay socket.
5. The relay never interprets game payloads except `join` and `leave` (Part 3.7); a relay
   restart drops the room, every client sees DLG-NetError and returns to the create-or-join
   state with local results kept.

Relay hosting requirements, recorded here for B 17.1 and detailed in Part 3.7: Node 22 or
newer, one TCP port from `PORT`, plain `http` upgrade handling with TLS terminated by a
reverse proxy for `wss://`, no persistence, no credentials, no personal logging. Budgets:
memory <= 64 MB at 100 concurrent rooms, outbound bandwidth <= 100 KB/s per room at the
worst-case rate limits (4 peers, 60 messages/s each, state at 10 Hz), room idle expiry
10 min. Operating cost is one small always-on process; the Standalone edition has no
operating cost.

### 1.5 Decided Deferred and Unsupported items

Each row records the decision, the reason, where the UI says so, and the exact wording.
Wording is quoted verbatim into Part 7.11; message codes for the error cases are assigned
in Part 10.6 within the families named.

| Item | Status at v1 | Priority | Reason | Where the UI says so | Exact wording |
|---|---|---|---|---|---|
| Collaborative Studio (shared project editing, I 10.1, I 10.4) | Deferred; rules specified in Part 6.24, not built | P2 | Needs shared-project ownership, permissions and conflict resolution plus persistence beyond the P2P room; the brief fixes v1 to Synchronized Play and Cooperative Band (ADR-07) | SCR-Multiplayer experience selector: a disabled third card | "Collaborative Studio is not in this version. Synchronized Play and Cooperative Band are available." |
| SoundFont (`.sf2`) loading and any sampled fidelity level (ADR-04) | Deferred | P2 | No bundled bank for size and licensing reasons; a user-loaded SoundFont reader is a separate P2 feature; the UI must never imply sampled fidelity | SCR-Settings > Audio (note under the instrument quality row); SCR-About limits | Settings: "All instruments are synthesized in real time. Loading SoundFont (.sf2) sound banks is not supported in this version." About: "Instrument sounds are synthesized by this file; no sampled sound bank is included, so timbres approximate General MIDI instruments rather than reproduce recordings." |
| Guitar Pro 6 and 7 files (`.gpx`, `.gp`) (ADR-06) | Unsupported (compatibility vocabulary) | P1 feature with an Unsupported subset | Different container and XML schema (`BCFZ` compressed blocks; `PK` with `Content/score.gpif`); out of scope for the own-parser decision | SCR-ImportInspect error state after identification; SCR-Library file picker hint; `docs/COMPATIBILITY.md` | "This is a Guitar Pro 6 or 7 file (.gpx or .gp). Only Guitar Pro 3, 4 and 5 files (.gp3, .gp4, .gp5) can be imported. Export the file as GP5 or as MIDI from Guitar Pro and import that." (family `E-IMP-*`) |
| Audio-to-notes transcription (B 15.5, E 3.4) | Unsupported; never claimed | not a feature | No transcription system exists in v1; claiming one would violate B 3.6 and E 3.4 | SCR-ImportInspect for audio files (info row); SCR-About limits | "Audio files are imported as backing audio only. Notes cannot be generated from audio in this version; use a MIDI, MusicXML or Guitar Pro file for a playable chart." |
| MusicXML notation rendering and engraving (B 15.3) | Unsupported; never claimed | not a feature | Event import is the feature; engraving is a separate product (B 15.3 last paragraph) | SCR-ImportInspect info row for MusicXML; SCR-About limits | "MusicXML files are imported as musical events (notes, timing, dynamics, tempo). Sheet music is not displayed." |
| Web MIDI outside secure contexts or in browsers without it (E 9, ADR-10) | Unimplemented (built for where `Caps.webMidi` and `Caps.secureContext` are true); unavailable elsewhere by capability gate | P2 | `navigator.requestMIDIAccess` requires a secure context in supporting browsers and is absent in Safari; four-button play must never depend on it | SCR-Settings > Input, MIDI device row (disabled with reason); SCR-Help | "MIDI devices are not available here. Web MIDI needs a supporting browser and a secure page (https:// or localhost). Keyboard, touch and gamepad controls are unaffected." |
| Local two-player on one keyboard (E 4.1) | Deferred | P2 | Eight simultaneous keys exceed the key-rollover limits of common keyboards, making scoring unreliable; multiplayer on separate devices covers the use case | SCR-Multiplayer "How this works" panel; SCR-Help | "Two players on one keyboard is not available in this version. Each player uses their own device and connects by invite code." |
| Audio effects beyond a master limiter and one global synthesized-IR reverb (B 16.5) | Reverb: Unimplemented, P1, Phase 14. Delay, per-track compression, EQ, automation: Deferred | P1 (reverb), P2 (others) | A limiter (DynamicsCompressor, Part 6.5) protects the output from Phase 4; one reverb (`ConvolverNode` with a procedurally generated stereo impulse, 1.8 s exponential decay) gives space at low cost; further effects multiply mobile CPU cost and UI surface | SCR-Studio mixer panel footer | "Effects: Reverb (global, one mix control). Per-track EQ, delay, compression and automation are not in this version." |
| Host migration in multiplayer (B 7.7, B 17.3) | Deferred; the session ends with results | P2 | Host authority over the shared clock and scores cannot be transferred without re-synchronizing every guest mid-song; ending the session is the only state that stays consistent | DLG-NetError variant shown to guests, then SCR-Results, then SCR-Multiplayer create-or-join state | "The host has left. The session has ended; here are the results so far." |
| Late join while a song is in progress (B 17.3 "if supported", E 8.1) | Deferred; the joiner waits in the lobby | P2 | Joining mid-song would need chart and position catch-up plus partial scoring rules | SCR-Multiplayer lobby status line | "A song is in progress. You will join the room when it ends." |

Global reverb decision (recorded for Part 6.5 and Part 7.6): one aux bus fed post-fader from
every `ChannelStrip` and from live input, one "Reverb" control 0-100 % (default 15 %,
drums tracks excluded from the send by default with a per-track "send to reverb" toggle
default on for melodic tracks and off for `isDrums` tracks), bypassed entirely at 0 % and on
the Low and Abstract tiers unless the user turns it on, never applied to the metronome bus.

About screen "Limits of this version" block (Part 7.11 reproduces it verbatim and appends
the polyphony and track limits line from Part 9.9):

```text
Limits of this version
- Instrument sounds are synthesized by this file; no sampled sound bank is included, so
  timbres approximate General MIDI instruments rather than reproduce recordings.
- Import: MIDI (.mid, .midi) format 0, 1 and 2; MusicXML (.xml, .musicxml, .mxl);
  Guitar Pro 3, 4 and 5 (.gp3, .gp4, .gp5). Guitar Pro 6 and 7 files (.gpx, .gp) cannot
  be imported. Audio files (.wav, .mp3, .ogg, .flac, where this browser can decode them)
  are imported as backing audio only; notes are never generated from audio.
- MusicXML and Guitar Pro files are imported as musical events; sheet music and
  tablature are not displayed.
- Studio effects are a master limiter and one global reverb. Per-track EQ, delay,
  compression and automation are not included.
- Multiplayer: 2 to 4 players in Synchronized Play or Cooperative Band. Shared studio
  editing, two players on one keyboard, joining a song in progress and continuing after
  the host leaves are not included.
- MIDI devices are used only where the browser offers Web MIDI on a secure page.
- Browser and file-format support is listed in docs/COMPATIBILITY.md and reflects
  recorded tests, not assumptions.
```

### 1.6 Browser support policy

Target browsers (B 5.1, B 25.5) and the version floors decided for v1. Floors are the
oldest versions the implementation is designed for; Phase 15 tests run on the current
stable release and the previous major release of each, and the published claim names the
versions actually tested (B 25.5 "versions and devices must be recorded").

| Browser | Floor | Why this floor | Claim at plan version 1.0.0 |
|---|---|---|---|
| Desktop Chromium (Chrome, Edge) | 110 | Stable WebGL2, `AudioContext.outputLatency`, Pointer Events, `navigator.storage.estimate`, IndexedDB on `file://` | Not yet verified |
| Desktop Firefox | 115 (ESR) | Stable WebGL2 and Web Audio; Web MIDI absent by default (optional feature) | Not yet verified |
| Desktop Safari | 16.4 | WebGL2 on by default, `OfflineAudioContext` and `AudioContext.resume()` stable, Pointer Events | Not yet verified |
| iOS Safari | 16.4 | Same engine as desktop Safari 16.4; multi-touch Pointer Events subject to OQ-1 | Not yet verified |
| Android Chrome | 110 | Same as desktop Chromium; mobile tier selection | Not yet verified |

Policy:

1. A browser is published as Supported in `docs/COMPATIBILITY.md`, `README.md` and
   SCR-About only after every XT test for it passes in Phase 15 on the delivered
   `FingerLickinMusic.html` opened from `file://` and from `http://` (E 9, I 17 last
   paragraph, P 18). A browser with failing XT tests is published as Partial with the list
   of failing capabilities, or Unsupported.
2. Until Phase 15 every claim reads "not yet verified"; the Phase 16 final report (Part 14)
   replaces that text with the recorded browser version, device, OS and date.
3. Compatibility is never inferred from the engine name (B 5.1); iOS Safari and desktop
   Safari are tested separately, and so are Android Chrome and desktop Chromium.
4. Other Chromium-based browsers (Brave, Opera, Samsung Internet) are not tested and not
   claimed; the About screen does not mention them.

Local-file (`file://`) behaviors to verify per browser. Each row becomes XT tests in
Part 12; `Caps` (M-01) detects the runtime facts at boot so the fallbacks switch
automatically.

| Behavior | What to verify on `file://` | Fallback when unavailable | Where the result is recorded |
|---|---|---|---|
| IndexedDB availability and persistence | `indexedDB.open('flm-db')` succeeds; records survive reload; quota via `navigator.storage.estimate()` when present | localStorage-only path with the 2 MB project cap and the notice of Part 6.16 (`E-STO-009`) | Part 9.2 device matrix, `docs/COMPATIBILITY.md` |
| localStorage availability | Read and write of `flm.v1.*` keys inside try/catch; private-mode behavior | Session-only settings; export offered on every save | Same |
| Audio unlock | `AudioContext` created on the first gesture reaches `running`; iOS needs the silent-buffer kick; `statechange` to `suspended` after backgrounding re-unlocks through DLG-ResumeAudio | DLG-AudioBlocked with a retry button; the game never auto-plays before the gesture | Same |
| File import | `<input type=file>` opens and returns a `File`; drag and drop onto `#app` works; `.mxl` and `.gp5` are not filtered out by the accept list | Drag and drop; a hint naming it | Same |
| Download | `a[download]` with a Blob URL saves `.mid`, `.flm.json` and `.wav` with the given file name | Open a data URL in a new tab with instructions to save it | Same |
| History API | `history.pushState` per screen does not throw (Part 7.4) | Hash-based navigation (`#/screen`) selected automatically when `pushState` throws | Same |
| Secure context and Web MIDI | `window.isSecureContext`; `navigator.requestMIDIAccess` presence; permission prompt behavior | MIDI row disabled with its reason (1.5) | Same |
| Multi-touch Pointer Events | Four simultaneous `pointerdown` events with distinct `pointerId` on the pads (OQ-1) | Touch Events listener path if XT tests fail on any supported device | Same, plus the LEDGER assumptions section |
| WebGL2, WebGL1, context attributes | Context creation per tier; `webglcontextlost` recovery within 3 s | WebGL1, then Abstract tier (`canvas#flat`) | Same |
| `OfflineAudioContext` render of a full mix | WAV export of a 2 min project completes within memory on iOS (OQ-2) | MediaRecorder capture of the live mix | Same |
| Background throttling | Timers and `requestAnimationFrame` stall while hidden; `visibilitychange` fires; the Transport re-anchors on return and logs drift > 5 ms | Auto-pause in gameplay modes (Part 6.4) | Same |

### 1.7 Built-in content summary

Five original demo arrangements (ADR-14) ship as compact data in `src/30-content.js`
(M-30). Titles, chord progressions and melodies are invented for this product; no
copyrighted melodies are used. Each arrangement ships with instrument charts at four
difficulties for every melodic track (drums use profile F) and a dance chart at three
difficulties, all generated deterministically by `ChartGenerator` and
`DanceChartGenerator` at load time from the expanded `Song` (not hand-authored), and with
section `Marker`s for every section named below. Note data, patterns and the expansion
algorithm are specified in Part 6.30. Lengths are computed from the tempo and meter data
given here. GM program numbers are 0-based.

| id | Title | Style | BPM | Key | Meter | Length (s) | Tracks and GM programs | Notable features exercised |
|---|---|---|---|---|---|---|---|---|
| `demo-poprock` | Neon Boulevard | Pop-rock band | 120 | G major | 4/4, 48 bars | 96.0 | Drums (channel 10), Bass 33 Electric Bass (finger), Rhythm Guitar 27 Electric Guitar (clean), Lead Guitar 29 Overdriven Guitar, Keys 4 Electric Piano 1 | Four-note strummed chords (G, D, Em, C voicings; chord size 4 and lane-by-pitch-order rules), eighth-note repeated-note bass, lead melody with clear melodic peaks (beginner selection rule), rock kit (36 kick, 38 snare, 42 and 46 hats, 49 crash at section starts), velocity step verse 80 to chorus 110, five performers filling all slots; sections Intro 4, Verse 8, Chorus 8, Verse 8, Chorus 8, Bridge 4, Chorus 8 |
| `demo-piano` | Rain on Glass Street | Piano solo | 76, ritardando to 64 | D minor | 4/4, 32 bars | 102 | Piano 0 Acoustic Grand Piano (one track, two hands) | Two-hand writing split at MIDI 60 (keys controller hand split), CC 64 sustain held across chord changes (derived durations), velocity range 36-112, the set's tempo change (tempo entries at bars 29, 30, 31, 32: 73, 70, 67, 64 BPM), notes tied across bar lines, a full-bar rest before the coda (stillness rule), single performer with the Focus camera; sections Intro 4, A 8, B 8, A2 8, Coda 4 |
| `demo-electro` | Circuit Bloom | Electronic | 110 | A minor | 4/4, 44 bars | 96.0 | Drums (channel 10), Synth Bass 39 Synth Bass 2, Arp 80 Lead 1 (square), Pad 88 Pad 1 (new age), Lead 81 Lead 2 (sawtooth) | Sixteenth-note arpeggios (expert density and min-spacing rules), `PitchBendEvent`s on the lead (2-semitone range, RPN 0 declared), CC 1 modulation sweep on the pad (synth knob gesture), four-on-the-floor 36 kick with 39 clap and 46 open hat offbeats, three- and four-note pad chords sustained 2 bars, a 4-bar break with pad only (long drum rest); sections Intro 8, Build 8, Drop 16, Break 4, Drop 8 |
| `demo-jazz` | Three Over Four | Jazz trio | 150 | F major | 4/4 with 3/4 B sections; 48 bars of 4/4 and 16 bars of 3/4 | 96.0 | Piano 0 Acoustic Grand Piano, Acoustic Bass 32, Drums (channel 10) | The set's meter changes (4/4 to 3/4 at bars 17 and 49, back at 25 and 57), swing eighths on the triplet grid (ticks 0 and 640 of each 960-tick beat), rootless four-note piano voicings (chord complexity), walking quarter-note bass with chromatic approaches, ride 51 pattern with pedal hat 44 on 2 and 4, snare 38 ghost notes at velocity 30 and feathered kick 36 at velocity 25 (velocity-to-gain and limb map), three-performer stage composition; form A 8, A 8, B 8 (3/4), A 8, repeated for a solo chorus |
| `demo-dance` | Four Floors Up | Dance, 128 BPM | 128 | E minor | 4/4, 60 bars | 112.5 | Drums (channel 10), Synth Bass 38 Synth Bass 1, Hook 87 Lead 8 (bass + lead), Pad 89 Pad 2 (warm), Stab 7 Clavinet | Kick 36 on every beat (the `DanceChartGenerator` strong-hit source), 46 open hat offbeats and 39 clap on 2 and 4, bass eighths on the root, a 2-bar hook repeated with octave variation (same pitch same lane rule), CC 11 expression pattern on the pad (dips to 40 on each beat, back to 127 by the offbeat) exercising CC 11 to strip gain, clavinet stabs on the "and" of 4 (syncopation for intermediate), the longest piece; sections Intro 8, Verse 16, Build 8, Drop 16, Outro 12 |

Coverage across the set: one tempo change (`demo-piano`), one meter change (`demo-jazz`),
dense chords (`demo-poprock`, `demo-jazz`), sustain pedal (`demo-piano`), pitch bend and
CC 1 (`demo-electro`), CC 11 (`demo-dance`), sixteenth density (`demo-electro`), swing
grid (`demo-jazz`), every drum voice of the 12-voice kit used at least once across the
five drum tracks, one single-track song, one three-track song, three five-track songs.
Total expanded note count target 4,000-7,000 across the set so content expansion stays
within the load budget (Part 9.4).

Tutorial sequence (ADR-14): `tut-basics` "First Steps", C major, 100 BPM, 4/4, 16 bars
(38.4 s), tracks Piano 0 (the player's part) and Drums (channel 10, a simple 36/38/42
pattern). Its seven step segments and the 4-bar recording loop are specified in Part 6.30.

Quick Play default selection (P 4 "start a built-in demo without importing a file"):
`demo-poprock`, track Keys, difficulty beginner, profile A, backing tracks on,
visualization on. The last selection is remembered in settings after the first play.

Character presets: the 8 named presets of Part 6.22 are content data in M-30 and populate
the five performer slots of the demo arrangements by default (slot assignment per
arrangement in Part 6.30).

### 1.8 Non-goals for v1

The following are explicitly outside v1. They are not Deferred requirements; they are not
requirements. Any of them appearing in a status report or the About screen as a feature is
a defect.

- Accounts, sign-in, cloud saves, telemetry, analytics or any outbound request other than
  the optional STUN lookup and the optional relay connection (ADR-15, B 23.2).
- Public matchmaking, room discovery lists, spectator mode, in-game text or voice chat,
  global leaderboards; all progression is local to the device.
- A bundled or downloaded sampled sound bank; any claim of acoustic fidelity (ADR-04).
- Audio-to-MIDI transcription, beat or tempo detection for imported audio, time-stretch or
  speed change of audio tracks (audio tracks play at 1.0 speed only; Part 8.12).
- Sheet music, tablature or notation display; MusicXML or Guitar Pro export.
- DAW-grade features: automation lanes, per-track effects, plugin formats, audio clip
  editing, microphone recording, MIDI output to external devices (Web MIDI is input only).
- Imported 3D models, textures or fonts; a stage or character model importer; a mod or
  plugin system; shaders beyond the ones specified in Part 6.18.
- Localization: v1 is English only; all user-facing strings live in the Part 7.11 catalog
  so a later localization does not touch module code.
- Service worker, web app manifest, PWA install or native wrappers; the single file is the
  offline mechanism (ADR-01).
- Minification, obfuscation or transpiling of the shipped source (B 19.4, ADR-09).
- Guitar Pro 6 and 7 import, Collaborative Studio, two players on one keyboard, host
  migration, late join during a song (all decided in 1.5).
- Any copyrighted melody, lyric, sample or artwork (B 23.3); every demo is original.
- Support claims for browsers, devices or formats without recorded XT and FT evidence
  (B 1.4, I 6.4, I 17).
