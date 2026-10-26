## Appendix B. Glossary

Every term of art used in this plan, with the meaning the plan gives it. Where the "Defined
in" column names a part, that part owns the exact rule and this appendix only summarizes it;
if the two ever read differently, the owning part governs and the difference is recorded in
the LEDGER "Open issues" register. Names in `code` are exact identifiers (Part 0.9.6: no
synonyms in code, documents, UI text or commit messages). Numbers are the brief's fixed
values (brief section 6) unless the row says otherwise.

### B.1 Musical time and transport

| Term | Definition | Defined in |
|---|---|---|
| Tick | The integer unit of musical time. Every event, chart note, dance step, marker and recorded note stores its position (`tick`) and length (`durTicks`) in ticks. Ticks are never fractional in stored data; negative ticks exist only transiently during count-in. | ADR-05, Part 5.1 |
| PPQ | Pulses (ticks) per quarter note. The internal PPQ is fixed at 960 (`Song.ppq:960`, `FLM.Model.PPQ`). Imported files with another division are rescaled to 960; when 960 is not a multiple of the source PPQ the rounding is reported as `W-MIDI-TICK-ROUNDING`. | ADR-05, Part 6.10 |
| Tempo map | `TempoMap`: the sorted list of tempo entries `{tick, usPerQuarter, secondsAt}` of a `Song`. Tempo is piecewise constant between entries; `secondsAt` is the precomputed cumulative song time at each entry, so `ticksToSeconds(t)` and `secondsToTicks(s)` are a binary search plus one multiplication, never a running sum. A map without an entry at tick 0 gets `{tick:0, usPerQuarter:500000}` (120 BPM) and `W-TEMPO-DEFAULT-INSERTED`. | Part 5.3 |
| Meter map | `MeterMap`: sorted `{tick, numerator, denominator}` entries; answers `barAt(tick)` and `beatAt(tick)`; default 4/4 at tick 0 when the source has none. | Part 5.4 |
| Key map | `KeyMap`: sorted `{tick, fifths, mode}` entries (`mode` is `'major'` or `'minor'`); used for spelling and for the default key and scale of Free Play and Studio. | Part 5.4 |
| Song time | Seconds from tick 0 of a song as given by the tempo map (`TempoMap.ticksToSeconds`). Song time is not audio time; the Transport converts between them using the anchor and the speed. | Part 4.5 |
| Audio time | Seconds on `AudioContext.currentTime`, the master clock of the engine. Every sound is scheduled at an audio time; every input is converted to an audio time (`tAudio`). | Part 4.5 |
| Performance time | Milliseconds on `performance.now()` and `event.timeStamp` (`tPerf`). Used for input stamps, frame statistics and timeouts; converted to musical time only through audio time. | Part 4.5 |
| Wall-clock time | `Date.now()`. Used only for `createdAt`, `modifiedAt`, log stamps, the project index and the daily-challenge date; never for a position, duration or judgment. | Part 4.5 |
| Transport | `FLM.Transport` (M-04), the state machine that owns the authoritative musical position. One instance, `FLM.Transport.main`, serves every mode; `create()` exists for tests and the import preview. | Part 4.1, Part 6.4 |
| Transport states | Exactly `stopped`, `countin`, `playing`, `paused`, `recording`. | Brief section 5 |
| Anchor | The pair that ties musical time to audio time: the Transport keeps `{anchorTick, anchorAudio, speed}` and computes `positionAt(audioTime)` from it, never by accumulation. It is re-established on play, resume, seek, speed change, every loop wrap (at the exact computed wrap time) and after an audio rebuild. Input has its own anchor, `anchorOffset`, the 20-sample median of `contextTime - performanceTime` that `Input.perfToAudio` uses. | Part 4.5.1 |
| `positionAt` | `Transport.positionAt(audioTime)`: the tick playing at an audio time. The render loop, the Recorder and the highway obtain the current tick only this way. `tickAt` is the same function under the name used by Input, Recorder and Judge. | Part 4.5.1 |
| `audioTimeAt` | `Transport.audioTimeAt(tick)`: the audio time at which a tick sounds under the current anchor and speed; `Infinity` for ticks that are not scheduled (paused or stopped beyond the frozen tick). | Part 4.5.1 |
| Speed | Playback rate of the Transport, 0.25 to 2.0 (`transport.speed`). Speed scales song time against audio time; it does not change pitch, the tempo map or the judgment windows. | Part 4.4, UT-09-35 |
| Count-in | One or two bars of metronome clicks before playing or recording starts, accented on beat 1. During count-in the Transport state is `countin`, `positionAt` returns 0 and `countinTick` returns the negative tick. A recording's time origin is the end of the count-in. | Brief section 6, Part 6.4, Part 6.17 |
| Loop region | A half-open tick range `[a, b)` set with `setLoop`. At each wrap the Transport re-anchors at `a` exactly at the computed wrap time and emits `transport.loop`; sustained notes are released at `b` (`sched.noteOff` reason `loop`). | Part 4.4, Part 6.4 |
| Seek | Moving the position to a new tick. Seeking soft-panics sounding voices, clears the scheduler cursor and re-anchors. | Part 6.4, Part 6.5 |
| Lookahead | How far ahead of `ctx.currentTime` the Scheduler schedules events: 120 ms. Events beyond the lookahead stay in the cursor for a later tick. | Brief section 6, S-10 |
| Scheduler tick | One wake-up of the Scheduler, every 25 ms by `setInterval` through `FLM.Core.timers`. The timer only wakes the scheduler; it never times an event. One tick may spend at most 4 ms of main-thread time. | Brief section 6, S-09, S-10 |
| Scheduler cursor | The Transport-owned position up to which events have been handed to the Scheduler (`pullDue(from, until)`, `resetCursor`). Cleared on stop and seek, rebuilt on track mutation. | Part 6.4 |
| Stall | A scheduler tick that ran late enough that the lookahead window was not covered (`sched.stall {gapMs}`); typical causes are long frames and background throttling. Late events are scheduled in order on the next tick; a stall above 500 ms while playing pauses gameplay modes. | Part 4.4, Part 4.7.4 |
| Drift | Accumulated difference between where a sound should be and where it is scheduled after repeated loops, tempo changes or pauses. The budget is absolute drift below 2 ms after a 10-minute loop; the design prevents drift by computing positions from anchors instead of summing intervals. | Brief section 6, UT-04-20 |
| Beat, bar, downbeat | Positions derived from the meter map. A downbeat is beat 1 of a bar (`sched.beat.isDownbeat`). | Part 4.4 |
| Marker | `Marker {tick, label, kind}` with `kind` `'section'` (verse, chorus and similar) or `'cue'`. Section markers define section statistics and stage-director cuts; without markers sections fall back to 4-bar blocks. | Brief section 5, UT-09-31 |
| Section | The span between two section markers (or a 4-bar fallback block). Used for section statistics on SCR-Results, practice restarts and stage direction. | Part 6.9 |
| Metronome | The click generator on its own bus (`Audio.Metronome`, `metronomeBus`), driven by `sched.beat` and therefore by the audio clock; volume adjustable separately from the master. | Part 6.5 |

### B.2 Audio engine and instruments

| Term | Definition | Defined in |
|---|---|---|
| Audio unlock | The first user gesture (tap, click or key press) that resumes the `AudioContext`, which browsers keep suspended until then. `Audio.unlock()` runs inside that gesture; `audio.unlocked` reports success. Gameplay modes cannot be entered while audio is locked (DLG-AudioBlocked). | Part 4.3 B15, Part 4.7 |
| Bus graph | The fixed node graph of M-05: per-track `ChannelStrip` nodes -> master gain -> limiter -> destination, plus the metronome bus and the global reverb send. Built once per context; rebuilt only by a hard panic. | Part 6.5 |
| ChannelStrip | The per-track mixer node chain (gain, pan, mute and solo ramps, reverb send). One strip per track is created when the Scheduler binds a song and disposed when it unbinds. | Part 6.5 |
| Limiter | The master `DynamicsCompressorNode` that prevents clipping when many tracks sum; always on. | Part 1.5, Part 6.5 |
| Voice | One sounding note: the node graph M-06 builds from an instrument template for one pitch, with its ADSR envelope and release. | Part 6.6 |
| VoiceAllocator | The pool that grants voice slots up to the polyphony cap (64 desktop, 32 mobile, configurable) and steals when the pool is full. | Part 6.5 |
| Polyphony | The number of simultaneously sounding voices. The cap is a resource limit, not a musical simplification: source notes are never dropped from the model because of it. | Brief section 6 |
| Voice stealing | Reusing a voice slot when the pool is full. Order: first the quietest voice that is already releasing, then the oldest active voice; a stolen voice ramps to silence in 5 ms. Counted in `audio.voices.stolen` and documented on SCR-About. | Brief section 6, UT-05-12 |
| Panic | Stopping all sound. Soft panic (`Audio.panic(false)`) releases every voice with a 30 ms ramp; hard panic (`Audio.panic(true)`) disconnects and rebuilds the bus graph on the same context. Bound to `Space` while paused and `KeyP` (configurable); also run by stop, seek and every mode leave. | Part 4.7.2, brief section 7 |
| Stuck note | A voice that keeps sounding after its note should have ended (lost note-off, unreleased sustain, missed release on mode change). Prevented by note pairing, the voice maximum-duration cap, release on stop, seek and leave, and the hard-panic check 350 ms after leave. | E 2.3, UT-05-21 |
| Sustain pedal | Controller 64. Values >= 64 defer note-offs on that channel until the pedal is released; a pedal still down at the end of a track or on stop is released deterministically. | Part 6.6, UT-03-14 |
| GM program | One of the 128 General MIDI melodic programs, numbered 0 to 127 in this plan (0-based). Every program maps to one of 16 family patch templates with per-program overrides. | ADR-04, Part 6.6 |
| Family template | One of the 16 synthesis templates that cover the GM families: Piano, Chromatic Percussion, Organ, Guitar, Bass, Strings, Ensemble, Brass, Reed, Pipe, Synth Lead, Synth Pad, Synth Effects, Ethnic, Percussive, Sound Effects. | Brief section 6 |
| Drum voice | One of the 12 synthesized percussion recipes (kick, snare, rimshot, clap, tom, closed hat, open hat, pedal hat, crash, ride, cowbell or misc, shaker or misc) that GM percussion keys 35 to 81 on channel 10 map to. | Brief section 6, Part 6.6 |
| Velocity layer | A velocity range (1 to 127) within which an instrument changes timbre (filter, brightness, attack) as well as loudness. Programs declared `synth-velocity` have them. | Part 6.6 |
| ADSR | Attack, decay, sustain, release: the amplitude envelope of every voice. | Part 6.6 |
| Karplus-Strong (pluck) | The plucked-string synthesis used by the Guitar and Bass templates: a noise burst through a tuned delay loop. Buffers are generated deterministically and cached (LRU). | Part 6.6 |
| Fidelity level | What an instrument declares it reproduces (I 3.4), returned by `FLM.Instruments.fidelity(program)`. v1 levels are `synth-basic` (label "Synthesized") and `synth-velocity` (label "Synthesized, velocity-sensitive"); `sampled` exists in the vocabulary and no v1 instrument has it. The UI shows the label and never implies sampled sound. | ADR-04, Part 6.6 |
| Synthesized | The word the UI uses for every v1 instrument sound; the honest disclosure that no sampled sound bank is included. | Part 1.5 |
| SoundFont | A `.sf2` sampled sound bank. Loading one is a Deferred P2 feature; the import identifier reports `.sf2` as Unsupported. | Part 1.5 |
| Mono legato | The behavior of templates declared `mono:true` (for example programs 80 and 81): a new note on the same track and channel releases the previous one with a 10 ms ramp. The source events stay polyphonic in the model; only that instrument's sound is monophonic, and its fidelity declares `legato`. | Part 6.6, UT-06-10 |
| Latency estimate | `Audio.latency()`: base and output latency reported by the browser; informational, never added to scoring automatically. The calibration wizard measures what is heard. | Part 6.5, Part 5.12 |
| Peak meter | `Audio.peak()` and `audio.peak`: linear peak levels for the mixer meters and the clip indicator. | Part 6.5 |
| Global reverb | The single synthesized-impulse `ConvolverNode` aux bus (default 15 %), the only v1 effect besides the limiter. | Part 1.5 |
| OfflineAudioContext | A non-realtime context used for WAV mix export and for deterministic audio tests (rendered buffers let tests measure onsets). | Part 5.14.3, Part 6.31 |

### B.3 Input, mapping and gameplay

| Term | Definition | Defined in |
|---|---|---|
| InputEvent | The one normalized input record: `{source, control, type:'press' or 'release', tPerf, tAudio, pressure}`. Keyboard, pointer, touch, gamepad and MIDI all produce it; it is emitted on `input.event`. | Brief section 5, Part 6.7 |
| Control | The logical name of an input (for example a lane control or a dance direction) that physical keys, pads, gamepad buttons and MIDI notes are mapped to. Keyboard controls use `KeyboardEvent.code`, never `key`. | Part 6.7 |
| Press lifecycle | The rule that every physical press yields exactly one `press` and one `release`: key repeat is ignored, duplicates are suppressed, and held controls are released with `source:'system'` on focus loss, page hide, pointer cancel, pause, device disconnect and mode leave. | E 4.1, Part 6.7 |
| Remapping | Changing which keys or buttons drive a control (SCR-Settings). A conflict (one key bound to two controls in the same context) is detected and explained in DLG-RemapConflict. | Part 6.7, UT-07-26 |
| Calibration | `Calibration {inputOffsetMs, audioLatencyMs, visualLeadMs}`. `inputOffsetMs` and `audioLatencyMs` are subtracted from the input time exactly once, in `Rhythm.Judge`; `audioLatencyMs` also shifts highway display; `visualLeadMs` sets highway travel time only. | Part 5.12, S-04 |
| Visual lead time | How long a note is visible on the highway before its hit time: default 1,500 ms, range 600 to 3,000 ms. It never affects scoring. | Brief section 6, Part 5.12 |
| Mapping profile | One of the six ways the four buttons turn into music (B 8.3): A Four-note lanes, B Interval, C Chord, D Scale, E Instrument-specific, F Rhythm/percussion. Switching profiles never modifies the source arrangement. In Free Play `Digit1` to `Digit6` select them. | Brief section 5, Part 6.8 |
| Mapper | `FLM.Mapping.Mapper`: converts `InputEvent`s into musical actions (note on, note off, chord) for live play in Free Play, Studio and the tutorial, using the active profile, key, scale, octave and register. | Part 6.8 |
| Register and octave | The pitch range a profile plays in. Octave shifts by 12 semitones (`KeyQ`, `KeyE`); register is the configured low and high bound with an out-of-range policy. | Part 6.8 |
| Lane | One of the four gameplay columns, numbered 0 to 3. Each lane has a color (`--lane-0` to `--lane-3`) and a glyph (circle, triangle, square, diamond) so it is never identified by color alone. | Part 3.2.5 |
| Chart | `Chart`: the playable four-lane part derived from one source track for one difficulty and one profile, `{id, songId, trackId, instrument, difficulty, profile, notes, generatorVersion, settingsHash}`. A chart references source events by id and never changes the `Song`. | Brief section 5, Part 5.9 |
| ChartNote | One chart target: `{id, tick, durTicks, lanes, sourceEventIds, pitches, isHold}`. A ChartNote with more than one lane is a chord target. | Brief section 5, Part 5.9 |
| ChartGenerator | `FLM.Mapping.ChartGenerator`: the deterministic function from (song, track, difficulty, profile, settings) to a `Chart`. Same inputs give byte-identical output; it reports how many source events it did not chart (`omittedSourceEventIds`) and never deletes them. | Part 6.8, UT-08-22 |
| settingsHash | The FNV-1a hash of every input that affects chart generation (generator version, difficulty, profile, track, options). Two charts with the same `settingsHash` are identical; multiplayer requires equal hashes before play; score comparisons require them. | Part 6.8, UT-08-31 |
| Difficulty | For instrument charts `beginner`, `intermediate`, `advanced`, `expert`; for dance charts `easy`, `normal`, `hard`. Each level differs in measurable chart properties and judgment windows. | Brief section 5 |
| Simplification | What a lower difficulty or a four-lane limit does to a dense part: it keeps strong beats, contour, chord changes and accents and omits the rest from the chart only. The omission count is reported (`W-IMP-CHART-OMITTED`, `simplificationReport`). | Part 6.8 |
| Judgment | One of `perfect`, `great`, `good`, `miss` for a judged chart note or hold tail. | Brief section 5 |
| Judgment window | The half-width in milliseconds around a note's audio time inside which an input earns a judgment: beginner 45/90/135, intermediate 35/70/110, advanced 25/55/90, expert 18/40/70 (perfect/great/good). Outside the good window the note is a `miss` when its window closes. | Brief section 6, Part 6.9 |
| Judge | `FLM.Rhythm.Judge`: compares each input's calibrated audio time with the audio time of the nearest pending note in its lane, produces `JudgeResult {noteId, judgment, deltaMs, tInput}`, and drives the score. It never runs inside a render frame. | Part 6.9, S-02 |
| Hold | A ChartNote or DanceStep with `isHold:true`. The head is judged on press; the tail is judged on release at the hold end with the same windows. Releasing earlier than the good window before the end is a hold break: the tail counts as a miss and the head judgment is kept. | Brief section 6, UT-09-19 |
| Stray press | A press that matches no pending note in its lane. It produces no judgment; by default it costs nothing (`strayPenalty:'none'`); with `'combo'` it resets the combo. | Part 6.9 |
| Combo and multiplier | Combo counts consecutive non-miss judgments; a miss resets it. The multiplier is `1 + floor(combo / 10)`, capped at 4, using the combo before the note. | Brief section 6 |
| Score | The deterministic integer `ScoreState.score`: points (perfect 100, great 70, good 40, miss 0) times the multiplier, summed. Equal input sequences give equal scores. | Brief section 6 |
| Accuracy and completion | Accuracy = points / (100 x judged); completion = judged / total. Both are reported in `ScoreState` and in the `PerformanceSummary`. | Brief section 6 |
| PerformanceSummary | The result of one play-through: final `ScoreState`, section statistics, calibration used, comparability flag, settings hash; shown on SCR-Results and recorded by M-25. | Part 6.9 |
| Comparable result | A result whose chart `settingsHash`, windows and calibration did not change during the run; a calibration change mid-run marks the result not comparable for personal bests and multiplayer. | UT-09-29 |
| Note highway | The scrolling lane display (M-21 `Highway`) on which chart notes travel toward the hit line during the visual lead time; drawn in WebGL in 3D tiers and on `canvas#flat` in the Abstract tier. | Part 6.21 |
| Touch pads | The four large on-screen buttons in `#touch` for touch devices: at least 56 x 56 CSS px with 8 px gaps, spanning the bottom 28 % of the viewport in portrait and the right or bottom 24 % in landscape. | Brief section 6, Part 7 |
| DanceChart and DanceStep | The dance gameplay data: `DanceChart {id, songId, difficulty, steps, generatorVersion, layout}` and `DanceStep {id, tick, durTicks, directions, isHold}` with directions 0 left, 1 down, 2 up, 3 right. Independent of instrument charts and mapping; judged by `DanceJudge`, which reuses the Rhythm judge rules. | Brief section 5, Part 6.23 |
| Choreography | The avatar movement driven by the dance chart (`ChoreographyController`). Missing choreography never disables dance scoring or step input. | Part 6.23 |
| Practice tools | Mute target, lower accompaniment, solo, loop a section, slow or speed up, restart at a section (I 6.3), reached from SCR-Pause. | Part 7 |

### B.4 Rendering, stage and characters

| Term | Definition | Defined in |
|---|---|---|
| Renderer | `FLM.Render` (M-18): the own WebGL2 renderer with a WebGL1 path and the 2D `Flat2D` fallback; owns the context, the scene graph root, counters and the render loop. | ADR-03, Part 6.18 |
| Tier (quality tier) | One of `High`, `Balanced`, `Low`, `Abstract`, a fixed parameter set (resolution scale, lights, shadows, segment counts, particle cap, animated performers, animation rate). Chosen at boot from capabilities, overridable in Settings or with `?tier=`; lowered one step automatically when the frame-time p95 exceeds 33 ms over 5 s; never raised automatically. Tier changes never touch the audio scheduler or the musical timeline. | ADR-03, Part 9.3 |
| Abstract tier | The non-3D tier: `canvas#flat` with a 2D context shows the highway and abstract visualizers. Used when WebGL is unavailable or a lost context is not restored within 3 s. | ADR-03, S-15 |
| Flat2D | The M-18 2D drawing surface used by the Abstract tier. | Part 6.18 |
| Context loss | The browser discarding the WebGL context (`render.contextLost`). Audio and scoring continue; the scene is rebuilt from CPU-side descriptions on restore (`render.contextRestored`) or the tier falls to Abstract. | Part 4.4, S-15 |
| Scene graph | The tree of `Node`, `Mesh`, `Material`, `Camera` and `Light` objects that M-18 draws; nodes are counted so leaks show in `assertClean`. | Part 6.18 |
| Render loop | The `requestAnimationFrame` loop started by `Render.startLoop(frame)`; each frame reads `audioNow` once and calls `frame(audioNow, dtMs)`. `dt` (clamped to 0 to 100 ms) only smooths transitions; it never advances musical time. | Part 4.5.2, S-01 |
| Rig | The procedural humanoid skeleton of M-19 (`FLM.Rig`), built from capsules and boxes: torso, neck, head, shoulders, upper and lower arms, hands or hand targets, hips, upper and lower legs, feet (B 12.2). Every character and every instrument uses the same rig interface. | ADR-03, Part 6.19 |
| Joint | One named bone of the rig, listed in `FLM.Rig.JOINTS`. | Part 6.19 |
| Attachment point | A named socket on the rig, listed in `FLM.Rig.ATTACHMENTS`, where an instrument prop, an accessory or an IK hand target is fixed. Attachment positions follow the rig dimensions, so rig-affecting options move them; `validateAttachments` checks a configuration before use, and a missing attachment falls back to the abstract visualizer for that performer. | Part 6.19 |
| Two-bone IK | The analytic inverse-kinematics solve for an arm (shoulder, elbow, hand) that places a hand on an instrument target. | Part 6.19 |
| Pose and pose blending | A set of joint rotations; blending interpolates between idle, playing and transition poses so joints do not snap. | Part 6.19 |
| Animation controller | A per-instrument-family driver in M-20 (keys, guitar, bass, drums, strings, winds and brass, percussion, synth, vocal or abstract) that turns `sched.*` events and audio time into poses. Selected by the instrument definition's `animProfile`; never one generic arm motion for every instrument. | Part 6.20 |
| Anticipation | The lead (`ANTICIPATION_MS`, 120 ms, equal to the scheduler lookahead) by which a controller starts a gesture before the note's audio time so the strike lands on the sound. | Part 6.20 |
| Abstract visualizer | A non-humanoid representation of events (floating notes, rings, particles, pitch bars) used for instruments without a practical humanoid animation and in the Abstract tier; each visual is tied to one event and nothing moves during silence. | Part 6.20, S-17 |
| Stage director | `StageDirector` (M-20): chooses camera presets deterministically from the arrangement (full band by default, focus on a soloing track, cuts at section markers), at most one automatic cut per 4 bars, never obscuring the highway, and fully disabled by reduced camera motion. Emits `director.cut`. | Part 6.20 |
| Camera preset | A named camera framing in `FLM.Stage.CAMERA_PRESETS`, including the full-band view and a focused musician view (B 12.1). | Part 6.21 |
| Performer slot | One of the five stage positions 0 to 4 (`CharacterConfig.slot`) a performer occupies. | Part 6.21 |
| Prop | An instrument rendered as a mesh and attached to a performer. | Part 6.21 |
| Beat indicator | The visual pulse driven by `sched.beat`; it is musical structure, so it shows even during rests and in reduced motion. | Part 6.20 |
| CharacterConfig | The data-driven appearance record `{id, name, body, heightScale, skin, hair, face, top, bottom, shoes, accessories, instrument, slot, animationStyle, version}`; at most 4 KB when sent over the network. | Brief section 5, Part 5.10 |
| Rig-affecting option | A character option that changes rig dimensions or attachment points (`body`, `heightScale`); changing one rebuilds that performer's rig. Every other option is visual only and changes materials or meshes without touching the skeleton. `FLM.Character.isRigAffecting(option)` is the authority. | Part 5.10, Part 6.22 |
| Preset (character) | A complete stored `CharacterConfig`; 8 built-in presets come from M-30. | Part 1.3 |
| Reduced motion | The setting (or OS preference) that disables camera motion, particles, judgment pop scaling and panel slides, and never the highway scroll, hit flash or beat indicator. | Part 3.2.2 |
| High contrast | The setting that switches to pure surfaces, white lane outlines and 2 px borders. | Part 3.2.2 |
| Glyph | The SVG symbol (`g-lane0` to `g-lane3`, `g-left`, `g-down`, `g-up`, `g-right`) shown with every lane or direction color so meaning never depends on color alone. | Part 3.2.5 |

### B.5 Import, formats and export

| Term | Definition | Defined in |
|---|---|---|
| SMF | Standard MIDI File. Formats 0 (one track), 1 (synchronized tracks) and 2 (independent sequences, imported as separate songs) are read by M-10; division is PPQ or SMPTE. | ADR-06, Part 6.10 |
| SMPTE division | An SMF time base in frames per second and ticks per frame instead of ticks per quarter. Times are converted to seconds and then to PPQ 960 against the default 120 BPM tempo map (1 s = 1,920 ticks); the file is reported with `W-MIDI-SMPTE`, and tempo meta events in it are ignored with `W-MIDI-SMPTE-TEMPO-IGNORED`. | Part 6.10, UT-10-23 |
| VLQ | Variable-length quantity, the SMF encoding of delta times and lengths; at most 4 bytes, a fifth continuation byte is a malformed file. | Part 6.10 |
| Running status | The SMF rule that a channel message may omit its status byte when it repeats the previous one. | Part 6.10 |
| Conductor track | An SMF track with no channel messages and no text-bearing events, normally the first track of a format 1 file; its tempo, meter and key meta events are folded into the song maps and it does not become a playable track. | Part 6.10, UT-10-20 |
| MusicXML | The XML notation format; partwise and timewise documents in `.xml` and `.musicxml`, and the compressed container `.mxl` read with M-11. Imported as events; sheet music is never displayed. | ADR-06, Part 6.12 |
| `.mxl` | A ZIP container with `META-INF/container.xml` pointing to the score; read by the own ZIP reader (stored and deflate entries). | Part 6.11 |
| Guitar Pro 3, 4, 5 | The binary `.gp3`, `.gp4`, `.gp5` formats read by M-13. GP6 and GP7 (`.gpx`, `.gp`) are identified and reported Unsupported. | ADR-06, Part 6.13 |
| Format identifier | `FLM.Import.identify(bytes, name)`: decides the format and version from content signatures, not from the extension; an extension that disagrees with the content produces a warning. | Part 6.14 |
| Adapter | An importer registered in `FLM.Import.adapters` that converts one format into the shared `Song` representation. The rest of the game never knows which adapter produced a song (I 16.2). | Part 6.14 |
| Import pipeline | Validate, identify, parse, normalize, inspect, then make the song available (B 15.1), all inside `FLM.Import.importFile`, with progress events and a 5 s parse budget. | Part 6.14 |
| Inspection report | `InspectionReport`: the object SCR-ImportInspect renders before anything is played or saved: format, version, compatibility status, duration, tempo, meters, keys, per-track rows (program, channel, note and event counts, pitch range, polyphony), the recommended playable track, chord complexity per difficulty, warnings, and whether the arrangement needs a simplified mapping. | Part 6.14 |
| Import warning | `ImportWarning {code, message, severity, location}` with severity `info`, `warn` or `error`, attached to `Song.source.warnings` and shown in the inspection report. | Brief section 5 |
| Warning code | The stable identifier of a warning, of the form `W-<AREA>-<NAME>` (for example `W-MIDI-TRUNCATED`, `W-NOTE-OVERLAP`, `W-XML-ENTITY`). The catalog with messages is Part 8.8; corpus expectations refer to these codes. | Part 3.11, Part 8.8 |
| Error code | The stable identifier of a failure, of the form `E-<AREA>-<nnn>` (for example `E-IMP-004`, `E-STO-001`), with a class (recoverable, returnToMenu, reload) and a user message. The taxonomy is Part 10.6. | Part 4.9, Part 10.6 |
| Error class | `recoverable` (the operation failed, the mode continues), `returnToMenu` (the mode is left with full teardown), `reload` (the page shows `#fatal`). | Part 4.9 |
| Import limits | File <= 25 MB (MIDI, MusicXML, Guitar Pro), audio <= 100 MB, events <= 1,000,000, tracks <= 128, chord size <= 16, parse time 5 s, enforced before allocation; parsers yield every 20,000 events. | Brief section 6, S-11 |
| Audio track | A track backed by a decoded audio file (`.wav .mp3 .ogg .flac` where the browser decodes it). It plays with a defined sync offset and never produces note events or charts. | ADR-06, Part 6.14 |
| Sync offset | The milliseconds by which an audio track is shifted against the song's tick 0 (`syncOffsetMs`), so audio and MIDI with different start offsets line up. | E 3.4, Part 6.14 |
| Compatibility matrix | `docs/COMPATIBILITY.md` and the `FLM.Import.COMPATIBILITY` data: every format and version with its compatibility word, preserved features, losses and the FT evidence. Written in Phase 12, finalized in Phase 16. | Part 8.7 |
| Test corpus | The files in `test-corpus/`, generated deterministically by `tools/make-corpus.mjs` from fixed recipes and seeds and committed, with `MANIFEST.json` holding each file's hash and authored expectations. | Part 3.6, Part 8.9 |
| Round trip | Export followed by import (or serialize followed by parse) that yields the same supported content; required for every export format where conversion back is applicable. | B 15.6, Part 5.14 |
| Export formats | `.mid` (SMF writer), `.flm.json` (project), `.flmdance.json` (dance chart), `.flmchar.json` (character), `.flmsettings.json` (settings), WAV mix. | Part 5.14 |

### B.6 Project, studio and storage

| Term | Definition | Defined in |
|---|---|---|
| Project | `Project {format:'flm-project', version:1, ...}`: the song plus charts, dance charts, characters, mixer, settings, recordings and history; the unit of save, load and export. | Brief section 5, Part 5.5 |
| `flm-project` v1 | The versioned project schema. Unknown fields are preserved; older versions are migrated step by step; newer or unknown versions are refused with an understandable error and never overwritten. | Part 5.5, Part 5.7 |
| Migration | A pure function from project version n to n + 1, applied in order; a failing step leaves the stored record untouched. | Part 5.7, UT-15-14 |
| Transient project | A project created for a mode (for example the Free Play session) that is never saved unless the user asks. | Part 1.2 |
| Source track (locked) | A track imported from a file, with `lockedSource:true`. It is never edited in place; the first edit forks it. | Part 5.1, UT-15-21 |
| Fork (derived track) | `forkTrack`: the editable copy of a locked track (`derived:true`, `derivedFromTrackId`); the source is hidden and muted, so the original stays intact (non-destructive editing, I 5.1). | Part 6.15, UT-15-22 |
| Command and UndoStack | Every edit is a command object with `apply` and `revert`, pushed on the `UndoStack` (100 steps); slider changes coalesce; undo restores events and track configuration together. | Part 6.15 |
| Dirty | The project has changes not yet saved (`isDirty()`); cleared only by `markClean` after `project.saved`. | Part 6.15, S-14 |
| Safe write | The only way the game persists a value: serialize, write to `<key>.tmp`, read back and compare length and FNV-1a checksum, move the previous value to `<key>.bak` (one generation), move `.tmp` to `<key>`, and only then report success. Any failure before the final move leaves the previous value intact and reports failure. | ADR-08, S-14 |
| `.bak` | The single previous generation kept by the safe write; tried when the live record is corrupt. | ADR-08 |
| Safe point | A moment when autosave may run: on stop, on track add or delete, every 60 s while idle in Studio; never during recording or playback. | Brief section 6, UT-15-25 |
| Autosave | Writing a checkpoint at a safe point without user action; it never interrupts gameplay and stops after three consecutive failures with a visible notice. | Part 6.15, Part 6.16 |
| Checkpoint | A recovery copy of the project in a ring of three per project (`<projectId>.cp0` to `.cp2`) in IndexedDB, stripped of aborted takes and regenerable charts; offered by "Recover unsaved project?" when newer than the saved version. Checkpoints are not backups and are never counted as saves. | Part 5.8, Part 6.15 |
| Recovery record | `flm.v1.recovery`: the project written synchronously to localStorage on a `reload`-class failure when it fits in 2 MB, offered on the next boot. | Part 4.9 |
| Export (as backup) | Downloading the project as a file. The plan treats Export as the real backup; browser storage is never presented as one. | ADR-08 |
| Storage routing | The rule that decides whether a project goes to IndexedDB, localStorage or both (2 MB and recordings conditions), and when it cannot be persisted (DLG-ProjectTooLarge). | Part 5.8 |
| Quota | The browser's storage limit; `navigator.storage.estimate()` when available, `QuotaExceededError` otherwise; surfaces as DLG-SaveFailed with Export. | ADR-08 |
| Tab lock | The concurrent-tab guard: a second tab opening the same project gets read-only Studio. | Part 6.16 |
| Recorder | `FLM.Studio.Recorder`: captures `InputEvent`s as `NoteEvent`s in ticks (`Transport.tickAt(evt.tAudio) - originTick`) with count-in, overdub and loop record; states idle, armed, countin, recording. | Part 6.17 |
| Take | `RecordingTake {id, trackId, startedAt, events, countIn, tempoAtRecord, status}`: one recording pass result, `complete` or `aborted`. An aborted or failed take never replaces the previous complete take. | Brief section 5, UT-17-08 |
| Time origin | The tick where a take's tick 0 sits (`originTick`): the end of the count-in, or the next beat boundary when recording starts during playback. | Part 6.17 |
| Overdub | Recording onto a track while every other track plays through its strip; by default the new take merges with the track's existing notes. | Part 6.17, UT-17-11 |
| Loop record | Recording repeatedly over a loop region; by default the last pass becomes the take, optionally all passes are kept (at most 64 per session). | Part 6.17, UT-17-16 |
| Quantize | Snapping selected note starts (and optionally durations) to a grid (`1/4`, `1/8`, `1/16`, `1/32`, `1/8T`, `1/16T`) with a strength of 0 to 100 %, bar-aware so a note never crosses its bar unless allowed; undoable; never applied to unselected notes or to non-note events. Free Play quantization snaps only the recorded tick, not the sound. | Part 6.15, UT-15-23, UT-08-17 |
| Grid | The editing subdivision used by snap and quantize (`FLM.Studio.GRID`, default `1/16`). | Part 6.17 |
| Piano roll | The Studio editor for note pitch, start, duration and velocity with selection, snap, copy and paste. | Part 6.17, Part 7 |
| Mixer | Per-track gain, pan, mute and solo plus master volume and peak meters; solo is a set (several tracks may be soloed). | Part 6.5, Part 6.17 |
| Catalog | `FLM.Project.Catalog`: the registry of built-in songs, imported songs and the tutorial that the Library and Quick Play list. | Part 4.1 |
| Built-in arrangement | One of the five original demo songs of M-30 (pop-rock band, piano solo, electronic, jazz trio, 128 BPM dance track), 60 to 120 s each, expanded lazily from compact data. | ADR-14 |

### B.7 Multiplayer and editions

| Term | Definition | Defined in |
|---|---|---|
| Standalone edition | The primary deliverable `FingerLickinMusic.html`: everything runs from the file with no server, account or network; multiplayer works by invite codes. | Part 1.4 |
| Online edition | The same client built with `tools/build.mjs --online <relayUrl>` into `FingerLickinMusic.online.html`: identical except that it may also use the relay for room codes and its CSP `connect-src` includes the relay origin. Never described as self-contained. | Part 1.4, Part 3.3.6 |
| Host | The player who creates the room; authoritative for room state, the shared clock, start, pause, resume, chart selection and scores. | ADR-07 |
| Guest | A player who joined a host's room; judges locally for feedback and accepts the host's scores as final. | ADR-07 |
| Invite code | The host's code for one guest slot: base64url-encoded JSON `{v:1, role:'offer', sdp}` of a non-trickle WebRTC offer, gathered until ICE completes or 3 s pass. | ADR-07 |
| Answer code | The guest's reply code `{v:1, role:'answer', sdp}` that the host pastes back to complete the connection. | ADR-07 |
| Manual signaling | Exchanging invite and answer codes through any channel the players choose (chat, message, spoken); no signaling server is involved. | ADR-07 |
| STUN toggle | The off-by-default setting that adds `stun:stun.l.google.com:19302` to ICE gathering for connections across NAT; an external service, disclosed where it is enabled (OQ-3). | ADR-07, Part 1.4 |
| Relay | `server/relay.mjs`, the optional zero-dependency Node WebSocket server of the Online edition that forwards opaque messages between members of a room and stores nothing. | Part 3.7 |
| Room code | The relay's 6-character room identifier from the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. | Part 3.7 |
| DataChannel | The single reliable, ordered `RTCDataChannel` named `flm` that carries `NetMessage` JSON between host and each guest. | ADR-07 |
| NetMessage | The protocol v1 envelope `{v:1, type, seq, from, tSend, payload}`; at most 64 KB; 60 messages per second per peer. | Brief section 5, Part 5.16 |
| Protocol version | `FLM.Net.PROTOCOL_VERSION`, 1 in v1; a message with another `v` is rejected. | Part 5.16 |
| Shared clock | The host's audio clock as the session timeline. Guests estimate their offset from 8 ping samples at join and one every 10 s (median), convert with `Net.Clock.toLocalAudio` and `toShared`, and anchor their Transport at the converted `tStart` (host now plus 2.0 s). Nothing is triggered on message arrival. | ADR-07, Part 4.5.1 |
| Clock offset and sync quality | The estimated difference between a guest's and the host's audio clocks; quality `good` at <= 20 ms error, `fair` at <= 50 ms, `poor` above, shown in the lobby and HUD. | Part 4.4 |
| Synchronized Play | The competitive experience: all players play the same chart (equal `settingsHash`) and are scored by the host with identical rules. | ADR-07 |
| Cooperative Band | The cooperative experience: players play different tracks of one arrangement on the shared timeline. | ADR-07 |
| Collaborative Studio | Shared project editing; Deferred (P2) with its rules specified but not built. | Part 1.5 |
| Rate limit | 60 messages per second per peer (token bucket); a violating peer is disconnected. | Brief section 6 |
| Reconnection | Rejoining after a temporary disconnect with resynchronized position and room state; a stale state is replaced by the host's. Host departure ends the session with results (host migration is Deferred). | Part 1.5, Part 6.24 |

### B.8 Architecture and code conventions

| Term | Definition | Defined in |
|---|---|---|
| Module | One of M-01 to M-31: a source file `src/NN-name.js` containing one IIFE that registers one namespace through `FLM.Core.define`. | Brief section 4, Part 3.11 |
| Namespace | The one object a module attaches to `FLM` (for example `FLM.Audio`); nothing else is attached to `window` except `window.FLM` itself and the two transient names of Part 4.8. | Part 4.8 |
| IIFE | Immediately invoked function expression, `(function () { 'use strict'; ... })();`, the wrapper of every source file. | Part 3.11 |
| R-DEP | The dependency rule: a module references only lower-numbered modules plus the event bus; checked by the build lint. | Part 4.2 |
| Event bus | `FLM.Core.bus`, the single `Emitter` through which modules publish and subscribe to topics. | Part 4.4 |
| Topic | A named bus channel, written `EVT-<name>` in documents and `<name>` in code (for example `EVT-transport.state`, `'transport.state'`); each topic has one owning emitter. | Part 4.4 |
| Owner token | A symbol created per mode enter (`Symbol(mode + ':' + uid())`) that tags every timer, frame request, DOM listener and bus subscription the mode creates, so the leave sequence can remove them all. | Part 4.7.1 |
| Mode | One of `menu`, `quickplay`, `instrument`, `freeplay`, `studio`, `library`, `import`, `dance`, `multiplayer`, `customize`, `settings`, `help`, `about`, `diagnostics`, `tutorial`, `results`; exactly one is active. | Brief section 5, Part 4.7 |
| Gameplay, live and panel modes | Gameplay modes (quickplay, instrument, dance, multiplayer, tutorial) auto-pause on interruption; live modes (freeplay, studio) continue and re-anchor; panel modes are the rest. | Part 4.7 |
| Enter and leave sequence | The ordered steps of `FLM.Modes.enter` and `FLM.Modes.leave` that bind and fully tear down the shared systems (release inputs, abort recording, stop, soft panic, hard-panic check, dispose judge, strips, stage, timers, UI, listeners, network, autosave). | Part 4.7.1, Part 4.7.2 |
| `assertClean` and baseline | `FLM.Modes.baseline()` snapshots the leak counters in `menu`; `FLM.Modes.assertClean()` compares them after leave and returns `null` when there is no leak. | Part 4.7.3 |
| Leak | Any counter (voices, strips, audio nodes, timers, frame handles, listeners, GL objects, scene nodes, dialogs, held controls, connections, audio buffers) left above its baseline after a leave. | Part 4.7.3 |
| Capability gate | Boot step B4: hard failures (no 2D canvas, no Web Audio, no animation frames) show `#fatal`; soft failures disable a feature with a stated reason and the rest of the game works. | Part 4.3 |
| Caps | `FLM.Core.Caps`, the capability detection results read by every module. | Part 4.3 |
| ErrorReporter | `FLM.Core.ErrorReporter`, the one function every module reports failures through; it logs, dedupes, emits `error` and acts on the class. | Part 4.9 |
| Log | `FLM.Core.Log`, the 500-entry ring buffer of log records. | Brief section 4 |
| Diagnostics export | `FLM.diagnostics()`: the JSON bug report (version, build, capabilities, tier, mode, redacted settings, log tail, errors, counters), at most 200 KB, never song content unless the user opts in. | Part 4.8, Part 10.10 |
| Fault injection | `FLM.debug.inject(fault, args)`: the single entry point that simulates failures (audio suspend, write failure, context loss, slow frames and others) in tests and with `?diag`. | Part 4.8, Part 10.9 |
| Build | `node tools/build.mjs`: joins `src/shell.html` and the module files in file-name order into the shipped and test HTML files, runs the lint checks and the size gate (warning above 1.5 MB, failure above 2.5 MB). | ADR-01, Part 3.3 |
| Shipped build and test build | `FingerLickinMusic.html` (modules 01 to 30; what players open) and `FingerLickinMusic.test.html` (plus `90-` to `92-` files; gitignored). | Part 3.1 |
| Lint check | A build-time rule in Part 3.3.4 (marker, skeleton, strict, namespace, top-level names, banned APIs, syntax ceiling, non-ASCII, duplicate blocks, parse, size) whose violation fails the build. | Part 3.3.4 |
| CSP | The Content-Security-Policy meta of the shell (`default-src 'none'` and the ADR-12 list) that blocks every external load. | ADR-12 |
| BOM and LF | Every new text file starts with the UTF-8 byte order mark and uses line-feed endings; content is ASCII. | ADR-09 |

### B.9 Process, status and testing vocabulary

| Term | Definition | Defined in |
|---|---|---|
| Status words | Exactly five words describe a requirement: Implemented (code exists and every test named in Part 15 passes in the latest full run, plus the acceptance test for P0 and P1), Partial (code exists but a named test fails or cannot run here, reason recorded), Blocked (work cannot proceed, blocker recorded), Unimplemented (no code yet), Deferred (intentionally not built in v1, rules documented, only items Part 1.5 lists or the owner approves). | Part 0.9.2 |
| Compatibility words | Exactly four words describe a format or feature: Supported (imports with the listed features preserved, verified by FT tests on the corpus), Partial (imports with listed losses, each with a warning code), Conversion (imported through a conversion path into a different representation, losses stated), Unsupported (identified and refused with a message naming it). | Part 0.9.3 |
| Priority | P0 (minimally complete product), P1 (full intended product), P2 (advanced features after the stable core); priorities sequence work and never permit silent omission. | Part 0.9.4 |
| Requirement row (R-ID) | One obligation of the specification, numbered `R-<part><section>-<nn>` in Part 15 (for example `R-B7.3-04`). | Part 0.9.1, Part 15 |
| T section | One entry of the executable table of contents in Part 11, numbered `T<pp>.<nn>` by phase. | Part 11 |
| Phase | One of the B 27 phases, written Phase 00 to Phase 16; Phase 00 is satisfied by this plan. | Part 11 |
| Phase gate | The checkpoint after the last T section of a phase: full build, `--all` self-test, phase-specific checks, Appendix C walk, LEDGER entry with the D.3 checklist, STATUS update and one commit. | Part 0.4 step 5, Appendix D.3 |
| Clean T section | A T section whose build passes, whose named self-test groups pass with at least the Part 6 minimum test counts, and whose STATUS and LEDGER updates are written. | Part 3.9 |
| LEDGER | `docs/LEDGER.md`, the newest-first development log whose entries end with a `RESUME:` line; template in Appendix D.1. | ADR-16 |
| `RESUME:` line | The last line of every LEDGER entry, naming the next T section (or `none (delivered)` at the end); the only thing a fresh session needs to continue. | ADR-16 |
| STATUS | `docs/STATUS.md`, the live requirement status list; structure in Part 0.7, template in Appendix D.4. | Part 0.7 |
| Self-test | The in-page runner `window.FLM.selfTest(groups, opts)` (test build only), driven headlessly by `node tools/selftest.mjs`; results land in `window.__FLM_RESULTS`. | ADR-11, Part 3.4 |
| Test group | A named set of tests: one per module (`core`, `audio`, ...) plus `integration`, `timing`, `files`, `faults`, `perf-smoke`; 36 names in all. | Part 3.1 |
| Test categories | UT unit (Part 6), IT integration, FT file-format, TT timing, PT performance, XT cross-device and browser, FI fault injection, LT live manual, and `AT-<R-ID>` acceptance tests (one per P0 and P1 requirement), all compiled in Part 12. | Part 0.9.1 |
| Invariant (S-nn) | One of the separation rules S-01 to S-18 of Part 4.6, each with the assertion that tests it. | Part 4.6 |
| Regression test | A test added when a defect is fixed, named in STATUS section 6 (I 17). | Part 0.7 |
| Owner action | Something only the repository owner can do (push, merge, physical-device and other-browser tests, licence choice), listed in the LEDGER and the final report and never presented as done. | Part 0.6 |
| Open question (OQ) | One of the three questions left open with a decided fallback: OQ-1 four simultaneous Pointer Events on iOS Safari (fallback Touch Events), OQ-2 OfflineAudioContext WAV export memory on iOS (fallback MediaRecorder capture), OQ-3 public STUN reachability (LAN play works without it). | Part 2.19 |
| Software GL | SwiftShader rendering in headless Chromium; frame and memory figures measured under it are marked "(software GL)" and never presented as device results. | Part 0.10 |

### B.10 Abbreviations

| Abbreviation | Expansion |
|---|---|
| ADR | Architecture decision record (ADR-01 to ADR-16, Part 2) |
| BPM | Beats (quarter notes) per minute; `60,000,000 / usPerQuarter` |
| CC | MIDI control change (`ControlEvent`); 1 modulation, 7 volume, 10 pan, 11 expression, 64 sustain, 121 reset, 123 all notes off |
| DPR | `window.devicePixelRatio` |
| FNV-1a | The 32-bit Fowler-Noll-Vo hash (`FLM.Core.fnv1a32`) used for checksums, corpus hashes and `settingsHash` |
| GM | General MIDI |
| ICE | Interactive Connectivity Establishment, the WebRTC candidate gathering process |
| IK | Inverse kinematics |
| LRU | Least recently used (cache eviction order) |
| NAT | Network address translation |
| p50, p95 | 50th and 95th percentile of a measured distribution |
| PRNG | The seeded pseudo-random generator `FLM.Core.Prng` (mulberry32) used wherever determinism is required |
| RAF | `requestAnimationFrame` |
| RTT | Round-trip time of a ping |
| SDP | Session description protocol text inside invite and answer codes |
| UI | User interface; in this plan the DOM overlay of M-26 and M-27 |

## Appendix C. Prohibited mistakes and their guards

E 10 lists fifteen architecture mistakes the implementation must explicitly guard against.
Each row below names the mistake, the guard this plan builds against it (the design element,
the module that owns it and the rule that enforces it), and how a test catches a regression
if the guard is weakened later. Test IDs of the form `UT-NN-nn` are the Part 6 unit tests;
integration, timing, file, fault and performance tests are described by mechanism and
receive their IT, TT, FT, FI and PT numbers in Part 12, which lists this appendix as the
source of those cases. A row is "held" at a phase gate when every test named in it that
exists by then passes in the `--all` run and the guard is still present in the code; C.2 is
the walk procedure and C.3 says from which phase each row's tests exist.

### C.1 Guard table

| No. | Mistake (E 10) | Guard in this plan (design element, module, rule) | How a test catches a regression |
|---|---|---|---|
| 1 | One global state object for everything: audio, gameplay, editing and multiplayer state become coupled and mode transitions break unrelated systems. | Thirty-one modules, each with private state behind one namespace registered through `FLM.Core.define` (brief section 4, Part 3.11). Dependency rule R-DEP (Part 4.2): a module references only lower-numbered modules plus the event bus. Invariant S-07: no module writes another module's state; exported data tables are deep-frozen. Cross-module communication only through public APIs and the `EVT-*` topics of Part 4.4, each with one owning emitter. One mode at a time with per-mode binding and full teardown (Part 4.7). The only global is `window.FLM` (Part 4.8). | Build lint (Part 3.3.4): checks `namespace`, `top-level names`, the `window.` assignment ban and the S-07 regex `FLM\.[A-Z]\w+\.\w+\s*=` fail the build on any cross-module write or extra global. UT-01-01 and UT-01-02 (define registers, rejects duplicates). UT (core, S-07): `Object.isFrozen` holds for `DEFINITIONS`, `SCALES`, `OPTIONS`, `TIERS`, `WINDOWS`, `SCORING`. IT (S-06): 20 enter and leave cycles of every gameplay mode with `assertClean()` null after each leave, and after switching from Studio to Instrument Mode the instrument, tempo and track set match the new mode's song, not the previous project (E 1 "project state leaks between modes"). |
| 2 | Using rendering time as musical time: frame drops create timing errors and inaccurate scores. | ADR-05 and Part 4.5: the audio clock is the master; musical position is only `Transport.positionAt(audioNow)`, computed from the anchor, never accumulated. The render loop receives `frame(audioNow, dtMs)`; `dt` is clamped to 0-100 ms and used only for smoothing (S-01). Judgments use `evt.tAudio`, never a frame time (S-02). Animation derives from scheduled events (S-03). The Scheduler schedules against `ctx.currentTime` with a 120 ms lookahead; timers only wake it (S-09). | Build lint (S-01): M-18, M-20 and M-21 contain no `+= dt` applied to a variable named with `tick`, `time` or `pos`. UT (transport, S-01): 200 frames with random `dt` in 0-500 ms leave `positionAt(clock.now())` equal to the clock-only value; UT-04-25 fake clock determinism; UT-04-20 ten-minute loop drift below 2 ms. UT-09-27 replay determinism and IT (S-02): one input log replayed at tiers High and Abstract gives identical `ScoreState`. UT-05-15 offline onset accuracy within 1 ms. TT: 120 s playback with 300 ms frame stalls injected by `FLM.debug.inject('render.slowFrames')` ends with the highway tick within 1 tick of `positionAt(audioNow)` and unchanged scores for a scripted input log. |
| 3 | Treating MIDI as audio: MIDI describes musical events and needs a synthesizer or instrument to produce sound. | MIDI files become `Song` events (M-10, M-03); sound is produced only by the Scheduler (M-05) handing events to `FLM.Instruments` voices (M-06), with all 128 programs and the drum kit defined (ADR-04). Audio files go through the audio adapter (`decodeAudioData`) into audio tracks with a sync offset, are reported with status Conversion and never produce note events or charts (ADR-06, Part 1.5 audio sentence). The Studio distinguishes MIDI-event recording (Recorder, editable `NoteEvent`s) from rendered audio export (WAV through `OfflineAudioContext`) (B 11.5). | UT-14-15: an imported WAV yields `format:'audio'`, `status:'Conversion'`, `playable:false`, one track of kind audio, no `NoteEvent`, and the Part 1.5 sentence in `notes`. UT-06-22: every program builds a voice graph. UT-06-06: offline onset and release timing of synthesized notes. IT (imported MIDI to playback): a corpus MIDI file rendered through `OfflineAudioContext` has a detected onset within 1 ms of `audioTimeAt(tick)` for every note of a monophonic test track. FT: an audio file never appears in a chart track list and `ChartGenerator.generate` on an audio track throws its argument error (UT-08-20 pattern). |
| 4 | Treating every instrument as monophonic: chords and overlapping notes are lost. | The model keeps every note, including same-pitch overlaps and identical timestamps (pairing rules of M-03, `W-NOTE-OVERLAP`). The `VoiceAllocator` gives 64 voices on desktop and 32 on mobile with documented stealing. Charts carry chords as one `ChartNote` with several `lanes`; import accepts chords up to 16 notes and the inspection report states chord complexity per difficulty. The Recorder captures simultaneous presses as simultaneous notes. Animation widens finger spread and strum amplitude with chord size. The only monophonic sounds are the templates declared `mono:true` (legato leads), whose source events stay polyphonic in the model. | UT-03-11 same-pitch overlap keeps both notes; UT-03-13 channels independent; UT-09-14 chord judged when all lanes arrive within tolerance; UT-14-08 chord complexity; UT-05-12 and UT-05-13 allocator order and counts; UT-17-06 simultaneous capture ticks. IT (polyphonic MIDI): the corpus polyphonic file plays with the number of concurrently active voices equal to the source's maximum simultaneous notes (up to the cap) at the densest chord, and the serialized song after import, save and reload has the same note count and pitch multiset. UT-06-10 confines mono behavior to `mono:true` programs. |
| 5 | Using generic animations for every instrument: the visualization no longer reflects the actual performance. | M-20 per-family animation controllers (keys, guitar, bass, drums, strings, winds and brass, percussion, synth, vocal or abstract) selected through each instrument definition's `animProfile`; abstract visualizers for instruments without a practical humanoid animation and for the Abstract tier; S-03 (motion derived from `sched.*` events and audio time) and S-17 (no invented activity during silence, I 4.4 critical rule). | UT (animation, Part 6.20): `controllerFor` resolves every one of the 128 programs and the drum kit to a non-default controller or to a visualizer, and no two families share a controller unless Part 6.20 lists them together. UT (S-03): a `sched.noteOn` at 2.000 s produces peak amplitude at `audioNow = 2.000` regardless of how many updates ran before. UT (S-17): a 4-bar rest gives idle-bounded poses and zero visualizer spawns. IT (imported MIDI to 3D animation): two performers with different parts produce different joint trajectories over the same 8 bars (P 7.2). |
| 6 | Assuming four buttons can represent every source arrangement without information loss: mapping must be explicit and configurable. | Musical data is separate from gameplay mappings (I 1.2, S-08): `ChartGenerator` reads the `Song` and never mutates it; `lockedSource` tracks are never edited in place (edits fork them). Every chart reports `omittedSourceEventIds`; `W-IMP-CHART-OMITTED` and `simplificationReport` feed the inspection report line "needs a simplified mapping". Six mapping profiles, switchable without touching the source; chart preview per difficulty before play (I 6.2); the full arrangement keeps playing as accompaniment. | UT (S-08): `generate()` over a deep-frozen song for all four difficulties and all six profiles leaves the song's serialized FNV-1a hash unchanged. UT-08-22 determinism; UT-08-23 beginner keeps beats and reports the omitted rest; UT-08-34 simplification report; UT-15-21 locked track protection; UT-15-22 fork semantics. IT: after playing an imported song on beginner, saving and reloading, the project's source track has the same note count as the original import. |
| 7 | Using browser storage as the only backup: users lose work to quotas, cleared data or browser behavior. | ADR-08: Export (`.flm.json`, `.mid`) is the real backup; every DLG-SaveFailed and DLG-ProjectTooLarge offers "Export project" as the primary button; persistent notices in localStorage-only and memory modes; the UI never calls browser storage a backup (Part 7.11 text catalog). Safe write with read-back and one `.bak`; autosave checkpoints are recovery aids, not backups; `flm.v1.recovery` on fatal errors. | UT-16-13 save failure never marks the project saved; UT-16-07 read-back failure restores the previous value; UT-16-14 too-large refusal offers Export; UT-15-04 serialize and parse round trip. FI (`storage.writeFail` and quota exhaustion): DLG-SaveFailed opens with Export first, the exported file parses back deep-equal to the in-memory project, and the previous stored version is intact. UT (screens): no Part 7.11 catalog string contains, case-insensitively, any of the phrases `backed up`, `backup`, `saved permanently` or `safe forever`, except the Export guidance texts that tell the user to export. |
| 8 | Building multiplayer before defining the timeline protocol: retrofitting synchronization causes expensive redesign. | The protocol is defined in the plan before any multiplayer code: `NetMessage` v1 envelope and payload schemas (Part 5.16), the shared clock and offset estimation (ADR-07, Part 4.5.1), scheduled start `tStart = hostNow + 2.0 s`, host authority for scores. The single-player timeline (Phases 02-08) is built and tested first; Phase 13 implements that protocol and is not allowed to change it without a plan patch recorded in the LEDGER (Part 0.1). Nothing is triggered on message arrival. | UT (net): `validateMessage` rejects `v !== 1`, unknown `type`, oversize payloads and non-monotonic `seq`; the set `MESSAGE_TYPES` equals the Part 5.16 list exactly. UT (net, clock): offset estimation from 8 synthetic ping samples with asymmetric delay stays within 5 ms of the injected offset. UT (net, start): a guest that receives `start` 300 ms late anchors its Transport at the same local audio time as one that receives it immediately. IT: two in-page peers over a loopback `RTCPeerConnection` start within 20 ms of each other on the shared timeline. |
| 9 | Loading all assets at startup: large sound banks and 3D assets delay or prevent first play. | No fetched assets at all (ADR-02); instrument voice graphs and pluck buffers are created on first use of a program (M-06 `warmup` only for the programs of the song being entered); built-in arrangements are compact data expanded on demand (`FLM.Content.expand`); charts are generated on mode enter; rig meshes are built per performer at stage build; boot steps B1-B16 with budgets (Part 4.3) and real progress only for measurable steps. Budgets: load to menu <= 1.5 s desktop and <= 3.0 s mobile; first playable interaction <= 5 s desktop and <= 8 s mobile; shipped file target <= 1.5 MB. | PT (perf.mjs): time to main menu and time to first playable interaction in the headless scenario stay within budget (regression signal under software GL). Build size gate: warning above 1.5 MB, failure above 2.5 MB. UT (boot): at `boot.ready` the diagnostics providers that M-06 and M-30 register with `FLM.Core.Diagnostics` report zero compiled program voice graphs, zero pluck buffers and zero expanded built-in songs. UT-06-09 pluck cache LRU bounds. |
| 10 | Adding dependencies without a packaging strategy: the final HTML may fail when opened offline or directly from disk. | ADR-02 zero runtime dependencies; the build inlines everything into one file (ADR-01) and bans `fetch(`, `XMLHttpRequest`, `import(`, `importScripts`, `navigator.sendBeacon` (Part 3.3.4); the CSP `default-src 'none'` blocks any external load (ADR-12); the shell has no external reference and a `data:` favicon; the only external services are the optional STUN toggle and the optional relay, both documented (Part 2.17, Part 2.18). | Build lint banned-API check. `node tools/selftest.mjs --smoke` opens the shipped file from `file://` and fails on any page error, console error (CSP violations appear there) or `#fatal`. Gate grep for absolute `src` or `href` URLs in `FingerLickinMusic.html` (exact command in C.2) prints 0. IT (offline operation without the multiplayer service): with every network route aborted in the browser context, Quick Play, Free Play, Studio save and Export complete. |
| 11 | Claiming full format support after testing only one sample: compatibility requires a representative corpus and documented version coverage. | The generated corpus of Part 8.9 (`tools/make-corpus.mjs`, fixed seeds, authored expectations in `MANIFEST.json`) covers each claimed format and version with valid, malformed, truncated, large and unsupported-feature files; the compatibility vocabulary (Part 0.9.3); every `docs/COMPATIBILITY.md` cell names the FT tests behind it; GP6 and GP7 are identified and reported Unsupported; browser claims name only tested versions (Part 1.6). Publication rule decided here: a format and version backed by fewer than two passing FT files of valid content plus one passing malformed or truncated file is not published as Supported; it is published as Partial with the note "limited test coverage". | FT group `files`: every corpus file meets its authored expectation (tracks, note count, warning codes or error code). `node tools/make-corpus.mjs --check` proves the checked-in corpus is reproducible. UT-14-19 shape of the compatibility data. UT-13-01 and UT-13-02 version identification and refusal. Gate check (Phase 12 onward): a script over `FLM.Import.COMPATIBILITY` and the latest `--json` results confirms every Supported or Partial entry lists FT ids that passed, and applies the publication rule above. |
| 12 | Marking UI completion as feature completion: every feature requires functional tests. | Status rules of Part 0.7: Implemented requires every test named in the Part 15 row to pass in the latest `--all` run and, for P0 and P1, the `AT-<R-ID>` acceptance test; acceptance tests drive behavior (audio onsets, scores, saved bytes), not DOM presence; disabled entries show a one-line reason; placeholders are listed in STATUS section 5 with their disclosure text; the 0.5 checklist is ticked at every gate. | Gate audit (D.3 item G-08): for every R-ID marked Implemented in STATUS, each test id in its Part 15 Tests column appears with `pass:true` in the `--json` results of the gate run; any absence reverts the row to Partial (0.7 rule 3). UT (screens): every SCR-* controller registered in M-27 has at least one IT that exercises its primary action through the module API, checked by a list comparison in the `integration` group. |
| 13 | Ignoring cleanup on mode transitions: active notes, timers, animation loops, listeners and network connections accumulate. | The leave sequence of Part 4.7.2 (release inputs, abort recording, stop, soft panic, hard-panic check after 350 ms, dispose judge, strips, stage, timers, UI, listeners, network) and `FLM.Modes.assertClean()` with the counters of Part 4.7.3; every timer, frame request and DOM listener goes through the counted `FLM.Core.timers`, `raf` and `dom` wrappers with an owner token; the build bans raw `setTimeout(`, `setInterval(`, `requestAnimationFrame(` and `addEventListener(` outside `01-core.js`, `shell.html` and `90-selftest.js`; the runner calls `assertClean()` after every test group. | IT (S-06): 20 enter and leave cycles of each gameplay mode leave `assertClean()` null every time and heap growth (when `performance.memory` exists) <= 10 MB. UT (modes): leaving while a note is held and the transport plays gives zero active voices within 350 ms. UT-01-12 timers tracked; UT-17-02 Studio close leaves zero leaks; UT-16-24 storage counters clean; UT-05-22 soft panic releases all; UT-07-03 detach removes all listeners. FI: switching modes while notes are active (I 13.1) leaves no sounding voice after the leave resolves. |
| 14 | Silently degrading fidelity: when a sound bank, effect or animation is unavailable the limitation must be visible and documented. | Every instrument declares its fidelity and the UI shows the label ("Synthesized" or "Synthesized, velocity-sensitive"); the Settings and About texts of Part 1.5 state that no sampled bank exists; tier changes show a toast and the active tier is visible in Settings; context loss shows "Graphics paused"; unsupported controllers are handled deterministically and logged once; every import loss produces a warning code shown in the inspection report; a performer without a matching controller or attachment shows the abstract visualizer; STATUS section 5 lists every limitation with its exact disclosure ("none" is not allowed). | UT-06-02: fidelity labels are exact, `sampled === false`, no label contains `sampl`. UT-06-16: an unsupported CC is logged once and has no other effect. UT (render): an auto-downgrade emits `render.tier` with `reason:'auto'` and triggers the toast text of ADR-03. UT-12-24 unsupported MusicXML catalog produces warnings. FT: every corpus file with unsupported features yields exactly its authored `W-*` codes. Gate check: every STATUS section 5 row has a non-empty Disclosure cell. |
| 15 | Implementing every subsystem before testing any subsystem: interacting defects become hard to isolate. | Part 0.4 step 4: every T section ends with its named self-test groups passing before the next starts; modules are built in M-number order within a phase, public API before screens; the clean T section definition of Part 3.9 (including the foundation regression run of `core`, `model`, `transport`, `audio`, `rhythm` after any change to M-01 to M-09); a phase gate with `--all` after every phase; Part 6 minimum unit-test counts per module. | `node tools/selftest.mjs` exits 1 when zero tests ran, so a named group that does not exist yet fails rather than passing silently. Gate check (D.3 items G-02 and G-03): each group's test count in the `--json` results is at least the Part 6 minimum, and the LEDGER entry of every T section names the groups that passed with their counts; a T section without that line is not done. The `--all` run at each gate re-runs every earlier group, so a later change that breaks an earlier subsystem blocks the gate. |

### C.2 Phase-gate walk procedure

At every phase gate (Part 0.4 step 5, item 2) the session walks C.1 row by row after the
`--all` run. For each row it confirms that the guard is still present and that every test
named in the row that exists by this phase (C.3) passed in the gate run, and it records the
result in the D.3 checklist item G-09 as `rows held: <list>` and `rows not yet testable:
<list>`. A row that is not held blocks the gate until fixed, or it is recorded as an open
issue in the LEDGER and a defect in STATUS section 6 with severity High.

Commands (run from `Finger Lickin Music/`):

```text
node tools/build.mjs                                   # rows 1, 2, 10, 13: lint checks must report no problem
node tools/selftest.mjs --all --json /tmp/flm-gate.json  # rows 1-15: named tests; keep the file for G-08
node tools/selftest.mjs --smoke                        # row 10: shipped file opens without errors
node tools/make-corpus.mjs --check                     # row 11: from Phase 07 onward
grep -c -E '(src|href)="(https?:)?//' FingerLickinMusic.html          # row 10: must print 0
grep -n 'console\.log' src/*.js | grep -v '^src/01-core\.js:'            # Part 3.11 review rule: must print nothing
grep -n -E 'inputOffsetMs|audioLatencyMs' src/0[458]-*.js src/1[0-4]-*.js src/24-net.js   # S-04 and Part 5.12, row 2: must print nothing
grep -n -E 'Date\.now\(\)' src/0[4-9]-*.js src/2[01]-*.js               # row 2 and Part 4.5: timing modules never read wall-clock time; must print nothing
```

The `grep` lines are review aids that duplicate build-lint rules where they exist; if a lint
rule and a grep disagree, the lint rule is fixed (it is the enforced guard) and the
disagreement is recorded in the LEDGER "Decisions" register.

### C.3 First phase in which each row is testable

Before the phase named here a row is walked by code review only and recorded as "not yet
testable".

| Row | First phase with tests | Tests that start in that phase |
|---|---|---|
| 1 | Phase 01 | build lint, UT-01-01, UT-01-02, S-07 frozen tables (core); mode-cycle IT from Phase 05 |
| 2 | Phase 02 | S-01 transport test, UT-04-20, UT-04-25; S-02 tier comparison from Phase 05; render-stall TT from Phase 08 |
| 3 | Phase 04 | UT-06-06, UT-06-22; UT-14-15 and the imported-MIDI playback IT from Phase 07 |
| 4 | Phase 02 | UT-03-11, UT-03-13; allocator tests Phase 04; chord judging Phase 03; polyphonic IT Phase 07 |
| 5 | Phase 05 | animation controller, S-03 and S-17 tests; two-performer IT Phase 07 |
| 6 | Phase 07 | S-08, UT-08-22, UT-08-23, UT-08-34 (M-08 generator tests run on synthetic songs from Phase 03 where Part 11 schedules them); fork tests Phase 09 |
| 7 | Phase 09 | UT-16-07, UT-16-13, UT-16-14, UT-15-04, storage FI |
| 8 | Phase 13 | net validation, clock and start tests, loopback IT (the protocol itself is fixed by the plan before Phase 01) |
| 9 | Phase 01 | size gate and time-to-menu PT; M-06 lazy counters Phase 04; M-30 expansion counter Phase 05 |
| 10 | Phase 01 | lint, `--smoke`, grep; offline IT from Phase 09 (save and Export) |
| 11 | Phase 07 | MIDI FT and `make-corpus --check`; MusicXML and Guitar Pro FT and the publication rule Phase 12 |
| 12 | Phase 01 | G-08 audit from the first requirement marked Implemented |
| 13 | Phase 01 | UT-01-12, wrapper lint; mode-cycle IT Phase 05; Studio and storage counters Phase 09 |
| 14 | Phase 04 | UT-06-02, UT-06-16; render tier tests Phase 05; import warning FT Phase 07 |
| 15 | Phase 01 | zero-tests-ran exit code, per-group minimum counts, LEDGER group lines |

## Appendix D. Templates

The implementing session creates `docs/LEDGER.md` and `docs/STATUS.md` from D.1 and D.4 in
Part 0.4 step 3, before the first line of code, writes every LEDGER entry in the D.2 format,
pastes the D.3 checklist into every phase-gate entry, and writes commit messages as in D.5.
Both documents are UTF-8 with BOM, LF line endings and ASCII content (ADR-09); their tables
follow Part 0.9.5. Text in angle brackets `<...>` is replaced; everything else is copied
verbatim.

Reconciliation decided here: Part 0.7 gives the exact STATUS structure and D.4 reproduces it;
Part 3.8 summarizes the same file with a different section numbering. The Part 0.7 structure
governs: Part 3.8's "list of every requirement that is not Implemented" is STATUS sections 3
and 4, and its "Deferred items with the user-facing wording" are the Deferred rows of
section 3, whose Disclosure column carries that wording. The LEDGER format below merges ADR-16
(fields), Part 3.8 (heading form, `Next:` line, permanent Assumptions section) and Part 0.4 and
0.6 (Decisions, Open issues and Owner actions registers).

### D.1 `docs/LEDGER.md` template

The file has a fixed header, four registers that are updated in place, and the entries,
newest first, directly after the registers. Each register row has a ledger-local ID used only
inside `LEDGER.md` and `STATUS.md`: `LA-<nnn>` assumption, `LD-<nnn>` decision, `LI-<nnn>`
open issue, `LO-<nn>` owner action, numbered from 001 (owner actions from 01) in order of
recording and never reused.

```text
# Finger Lickin Music - LEDGER

Plan: docs/IMPLEMENTATION-PLAN.md version 1.0.0
Software VERSION: <x.y.z, the VERSION constant of src/01-core.js at the newest entry>
Branch: flm-implementation
Requirement status: docs/STATUS.md (this ledger does not duplicate it)
Rules:
- Entries are newest first, directly below the registers; the newest entry is the one a fresh
  session reads first.
- Every entry ends with a RESUME: line naming the next T section.
- Nothing is recorded as passed, built or measured without the command that was run and its
  result line.
- Registers are updated in place (State and Resolved columns); a committed entry is never
  edited, except that the newest entry of Kind progress is extended until it is committed
  at a pause or converted into the phase-gate entry.

## Assumptions

| ID | Assumption | Why it was needed | How it will be verified | State | Recorded | Resolved |
|---|---|---|---|---|---|---|
| LA-001 | <one sentence> | <one line> | <test id, command or observation> | open | <YYYY-MM-DD> | - |

## Decisions

| ID | Decision | Reason | Plan reference | Affected R-IDs or T sections | Recorded |
|---|---|---|---|---|---|
| LD-001 | <one sentence> | <one line> | <Part n.m or ADR-nn or "beyond plan"> | <list or "none"> | <YYYY-MM-DD> |

## Open issues

| ID | Issue | Affects (R-ID, T section or test) | Severity | State | Recorded | Resolved |
|---|---|---|---|---|---|---|
| LI-001 | <one sentence> | <list> | <Critical or High or Medium or Low> | open | <YYYY-MM-DD> | - |

## Owner actions

| ID | Action | Why the session cannot do it | Affected R-IDs or tests | State | Recorded |
|---|---|---|---|---|---|
| LO-01 | Push branch flm-implementation and merge | Push only on the owner's word (.claude/project-profile.md) | none | pending | <YYYY-MM-DD> |

<entries, newest first, in the D.2 format>
```

Register rules:

| Register | State values | When a row is added | When it changes |
|---|---|---|---|
| Assumptions | `open`, `confirmed`, `refuted` | whenever the session assumes something about the environment, a browser behavior, a spec reading or a missing detail (Part 0.6) | `confirmed` or `refuted` when the verification named in the row runs; a refuted assumption adds a Decisions row stating what changed and its LD id is written in Resolved |
| Decisions | none (decisions are permanent; a reversal is a new row naming the old ID) | anything decided beyond the plan, every plan patch (Part 0.1), the OQ fallback selected for OQ-1, OQ-2 or OQ-3, and every lint or grep disagreement found by Appendix C.2 | never |
| Open issues | `open`, `resolved` | every defect, blocker or failing test not fixed within the T section that found it; every Appendix C row not held | `resolved` when the fix commit exists and its regression test passes; a defect is also a STATUS section 6 row whose Defect cell begins with the LI id |
| Owner actions | `pending`, `closed` | every action of Part 0.6 "Owner actions": push and merge, tests on physical devices, Firefox, Safari, iOS and Android, the licence choice, OQ-3 STUN reachability in the owner's network | `closed` only when the owner reports the action back; the session never closes one itself |

### D.2 Entry format and entry kinds

Every entry uses exactly this field order. A field with nothing to record says `none`; a
check that the phase requires but that could not run says `not run (<reason>)`.

```text
## <YYYY-MM-DDTHH:MMZ> - <Tpp.nn, or Tpp.nn..Tpp.nn> - <one-line title>

Kind: <progress or phase gate or pause or final>
Phase: Phase <NN>
Previous commit: <output of: git log -1 --format='%h %s'>
Done:
- <Tpp.nn> <T section title from Part 11>: groups <group> <passed>/<total>, <group> <passed>/<total>
Build: node tools/build.mjs exit <code>; FingerLickinMusic.html <bytes> bytes (<x.xx> MB); warnings: <none or the WARNING line>
Self-test: node tools/selftest.mjs <arguments> -> <the SELFTEST summary line, copied>
Other checks:
- <command> -> <result line, copied>
STATUS: B <I>/<P>/<Bl>/<U>/<D>; E <I>/<P>/<Bl>/<U>/<D>; I <I>/<P>/<Bl>/<U>/<D>; P <I>/<P>/<Bl>/<U>/<D> (Implemented/Partial/Blocked/Unimplemented/Deferred)
Decisions:
- <LD-nnn>: <decision> (reason: <one line>)
Assumptions:
- <LA-nnn> <new or confirmed or refuted>: <assumption>
Open issues:
- <LI-nnn> <new or resolved>: <issue> - affects <R-ID, T section or test>
Owner actions:
- <LO-nn> <new or closed>: <action>
Commit: <subject line of the commit that contains this entry, D.5>
<Gate checklist block from D.3: phase gate entries only>
Next: <Tpp.nn> <title of the next T section>
RESUME: <Tpp.nn>
```

Field rules:

- The heading timestamp is UTC (`date -u +%Y-%m-%dT%H:%MZ`). The middle part is the T section
  range the entry covers; the first entry, which covers no T section, writes `Phase 00`.
- `Previous commit` records the last commit before this entry; this is how the hash of a gate
  commit, which cannot appear inside itself, enters the ledger (in the next entry). STATUS
  section 2 writes `this commit` in the Gate commit cell of the gate commit and replaces it
  with the short hash at the first STATUS update of the next phase.
- `Done` has one line per T section with every self-test group named in that section's
  Verification and its counts from the run that closed the section. A T section without such
  a line is not done (Appendix C row 15).
- `STATUS` copies the counts of STATUS section 1 after this entry's update.
- The four register lists name only rows added or changed by this entry; the registers at the
  top hold the full rows.
- `RESUME:` is the last line of the entry and is written first when context runs low
  (Part 0.4 step 6).

Entry kinds:

| Kind | When | Rules |
|---|---|---|
| progress | created at the first T section of a phase (and after a pause, for the rest of that phase) | after each T section: append its `Done` line, update `Build`, `Self-test`, `STATUS` and the register lists, rewrite `Next` and `RESUME`; at the phase gate the same entry becomes Kind `phase gate` |
| phase gate | after the last T section of a phase | all fields complete; the D.3 checklist pasted and every box ticked or the reason written next to it; committed with the gate commit; `RESUME: T<next phase>.01` |
| pause | when context runs low or the session stops deliberately (Part 0.4 step 6) | adds `Paused in: <Tpp.nn>, verification <passed or failing: test names>` after `Phase`; `RESUME` names the next T section, or the current one when its verification did not pass; committed with the WIP commit message of D.5 |
| final | the Phase 16 gate | Kind final replaces phase gate; adds the two count sets of Part 0.7 rule 7 (`STATUS section 1` and `Part 15 Status column`), which must be equal; lists every Owner actions row still `pending`; `RESUME: none (delivered)` |

First entry (Part 0.4 step 3), written before any code:

```text
## <YYYY-MM-DDTHH:MMZ> - Phase 00 - planning artifacts satisfied by IMPLEMENTATION-PLAN.md 1.0.0

Kind: progress
Phase: Phase 00
Previous commit: <git log -1 --format='%h %s'>
Done:
- Phase 00: planning artifacts satisfied by IMPLEMENTATION-PLAN.md 1.0.0 (Part 0.2); no T sections, no code.
Plan validation: <"no inconsistency found" or one line per inconsistency found during the Part 0.3 reading and how it was resolved, each also an LD or LI row>
Environment (Part 0.10): node <version>; playwright <resolves or fallback used>; git tree clean <yes>; other rows <as observed>
Build: not built (tools/build.mjs is created in Phase 01)
Self-test: not run (tools/selftest.mjs is created in Phase 01)
Other checks:
- none
STATUS: <counts per part from Part 15: every row Unimplemented or Deferred>
Decisions:
- <LD rows for plan inconsistencies, or none>
Assumptions:
- <LA rows for every Part 0.10 expectation not checked by a command, or none>
Open issues:
- none
Owner actions:
- LO-01 new: Push branch flm-implementation and merge
- LO-02 new: Run the XT and LT tests on Firefox, Safari, iOS Safari and Android Chrome devices (Part 1.6)
- LO-03 new: Choose the licence of the game (Part 10.3)
- LO-04 new: Report whether stun:stun.l.google.com:19302 is reachable in the owner's network (OQ-3)
Commit: Finger Lickin Music docs: start implementation ledger and status
Next: T01.01 <title from Part 11>
RESUME: T01.01
```

### D.3 Phase gate checklist

Paste this block into every phase-gate entry (and into the final entry) and tick each box as
`[x]`. A box that cannot be ticked carries the reason after it and blocks the gate unless the
reason is recorded in STATUS (Part 0.5 first paragraph).

```text
Gate checklist - Phase <NN>
[ ] G-01 Build: node tools/build.mjs exit 0, no problem lines; size <bytes>; warning <none or text>. Phase 16: size <= 1,572,864 bytes.
[ ] G-02 Full suite: node tools/selftest.mjs --all --json /tmp/flm-gate-<NN>.json exit 0; SELFTEST line copied into Self-test; zero page errors; zero FAIL lines.
[ ] G-03 Group minimums: every module group total >= its Part 6 minimum (6.N.8) and every cross-module group total >= its Part 12 count; groups below: <none or list>.
[ ] G-04 Phase checks: node tools/selftest.mjs --smoke exit 0 (every gate); node tools/make-corpus.mjs --check prints OK (Phase 07 onward); node server/relay.mjs --selftest exit 0 (Phase 13 onward); node tools/perf.mjs --all exit 0 when Part 11 names it for this phase; result lines copied into Other checks.
[ ] G-05 Slow suite: node tools/selftest.mjs --all --slow exit 0 when Part 11 names it for this phase, and always at Phases 14, 15 and 16.
[ ] G-06 Leaks: every mode cycle in the integration group ended with assertClean() null (Phase 05 onward); heap growth over 20 cycles <= 10 MB where performance.memory exists.
[ ] G-07 STATUS: header and sections 1 to 7 rewritten; the five status columns sum to Rows for each part; section 3 lists every row of this phase that is not Implemented.
[ ] G-08 Implemented audit: for every R-ID marked Implemented, each test in its Part 15 Tests column has pass:true in /tmp/flm-gate-<NN>.json, and for P0 and P1 its AT-<R-ID> passes; rows failing the audit set back to Partial: <none or list>.
[ ] G-09 Appendix C walk (C.2): rows held <list>; rows not yet testable <list>; rows not held: none.
[ ] G-10 Part 0.5 checklist: the ten B 1.4 items and the six "Added by this plan" items ticked in review; the fifteen E 10 items are covered by G-09.
[ ] G-11 Risks: the Part 13 register reviewed; risks retired or changed by this phase updated (Part 13.3); changed RISK ids: <none or list>.
[ ] G-12 Registers: every assumption, decision, open issue and owner action of this phase has its LA, LD, LI or LO row; every refuted assumption has a decision row.
[ ] G-13 Placeholders and limitations: each one introduced this phase is a STATUS section 5 row with its exact disclosure text, and that text appears in the UI where the user meets it.
[ ] G-14 Claims: no document, UI string or commit message written this phase claims format support, synchronization, offline operation or a performance figure without the FT, IT, XT or PT evidence named in this entry.
[ ] G-15 Encoding: the D.3.1 check prints ENCODING OK for the files staged in the gate commit.
[ ] G-16 Names: no module, namespace, type, field, event topic, screen, transport state or mode name outside Parts 4 and 5 was introduced (Part 0.9.6).
[ ] G-17 Commit: one gate commit with the D.5 phase subject, containing code, STATUS.md and LEDGER.md; nothing pushed; LO-01 still pending.
[ ] G-18 RESUME: this entry ends with RESUME: T<NN+1>.01 (final entry: RESUME: none (delivered)).
```

#### D.3.1 Encoding check for G-15

Run from the repository root after `git add`. It checks the staged files of the game folder
with the extensions the plan creates, except the generated corpus (ASCII, LF and no BOM by
Part 3.6.2) and the verbatim specification copy.

```text
git diff --cached --name-only -z --diff-filter=AM -- "Finger Lickin Music" | node -e '
const fs = require("fs");
const files = fs.readFileSync(0, "utf8").split("\0").filter(Boolean)
  .filter(f => /\.(md|js|mjs|html)$/.test(f) && !f.includes("/test-corpus/") && !f.endsWith("SPECIFICATION.txt"));
let bad = 0;
for (const f of files) {
  const b = fs.readFileSync(f);
  const bom = b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF;
  const body = bom ? b.subarray(3) : b;
  const nonAscii = body.some(x => x > 0x7F);
  const cr = body.includes(0x0D);
  if (!bom || nonAscii || cr) { bad++; console.log(f, bom ? "" : "no-BOM", nonAscii ? "non-ASCII" : "", cr ? "CR" : ""); }
}
console.log(bad ? "ENCODING FAIL " + bad : "ENCODING OK " + files.length);
process.exit(bad ? 1 : 0);'
```

`FingerLickinMusic.html` passes this check by construction (the build writes one BOM, LF and
ASCII); a failure on it is a build defect.

### D.4 `docs/STATUS.md` template

The structure is Part 0.7 verbatim; the rules of Part 0.7 (rows per part, section 3 versus
section 4, status transitions, placeholders, defects, measurements, the Phase 16 pass) apply
unchanged. STATUS is rewritten, not appended, after every T section and at every gate.

```text
# Finger Lickin Music - STATUS

Plan version: 1.0.0
Updated: <YYYY-MM-DD> (UTC date of the last change to this file)
Current phase: Phase <NN>
Last completed T section: <Tpp.nn or none>
Build: <FingerLickinMusic.html size in bytes, or "not built">
Self-test (--all): <passed>/<total> on <YYYY-MM-DD>, or "not run"
Live and device tests (LT, XT): <count run>/<count defined>, or "not run"

## 1. Counts per specification part

| Part | Rows | Implemented | Partial | Blocked | Unimplemented | Deferred |
|---|---|---|---|---|---|---|
| B (FLM-1.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| E (FLM-1.1.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| I (FLM-1.2.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| P (FLM-1.3.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| Total | <n> | <n> | <n> | <n> | <n> | <n> |

## 2. Phase gates

| Phase | T sections done / total | Gate commit | Gate date | --all result |
|---|---|---|---|---|
| Phase 00 | satisfied by plan 1.0.0 | n/a | 2026-10-25 | n/a |
| Phase 01 | <d> / <t> | <short hash or -> | <date or -> | <passed/total or -> |
| Phase 02 to Phase 16 | one row each with the same five columns | - | - | - |

## 3. Not Implemented, listed individually

| R-ID | Status | Phase | Reason (one line) | Disclosure (screen, doc, or n/a) |
|---|---|---|---|---|

## 4. Not yet reached, summarized per phase

| Phase | Unimplemented rows | Deferred rows |
|---|---|---|

## 5. Placeholders and limitations

| Module or screen | Limitation | Spec ref | Disclosure (exact UI text or document) | Affected R-IDs |
|---|---|---|---|---|

## 6. Known defects

| Defect | Severity | Found in T section | Regression test | State |
|---|---|---|---|---|

## 7. Measurements recorded

| Budget (Part 9.1 row) | Value or "not measured" | Tool and scenario | Date |
|---|---|---|---|
```

Content of the file when it is created (Part 0.4 step 3):

| Part of the file | Initial content |
|---|---|
| Header | `Updated:` the creation date; `Current phase: Phase 01`; `Last completed T section: none`; `Build: not built`; `Self-test (--all): not run`; `Live and device tests (LT, XT): not run` |
| Section 1 | Rows per part equal to the row count of Part 15.1 (B), 15.2 (E), 15.3 (I), 15.4 (P); each row counted Unimplemented or Deferred exactly as its Part 15 Status column says; Implemented, Partial and Blocked are 0 |
| Section 2 | the Phase 00 row as shown; one row for each of Phase 01 to Phase 16 with `0 / <number of T sections of that phase in Part 11>` and `-` in the other three cells (the template's "Phase 02 to Phase 16" line is expanded into fifteen rows) |
| Section 3 | every Deferred row of Part 15 (Part 0.7 rule 2), each with Phase `none` or the phase Part 15 names, the reason from Part 1.5 and the exact Part 1.5 wording as Disclosure |
| Section 4 | one row per phase, Phase 01 to Phase 16, with the number of Unimplemented and Deferred Part 15 rows assigned to that phase |
| Section 5 | one row per row of the Part 1.5 table: Module or screen = its "Where the UI says so" cell, Limitation = its Item cell, Spec ref = the spec sections it cites, Disclosure = its "Exact wording" cell, Affected R-IDs from Part 15 |
| Section 6 | the header row only |
| Section 7 | one row per Part 9.1 budget row in Part 9.1 order, Value `not measured`, Tool and scenario `-`, Date `-`; this includes at least the brief's budgets: shipped HTML size, load to main menu, time to first playable interaction, frame rate per tier, scheduler lookahead and tick, scheduling precision and drift, input timestamping, memory steady state and growth over 20 cycles, polyphony, tracks per project, import limits and parse time, project serialization time, multiplayer state rate and sync error, log and diagnostics size |

Row formats for later updates (one line per section; `<...>` is replaced):

```text
Section 3: | <R-ID> | <Partial or Blocked or Unimplemented or Deferred> | Phase <NN> | <one line; a Blocked row names the blocker and what unblocks it; a device-only row says "awaiting owner device test"> | <SCR-* or DLG-* with the exact text, a docs/ file name, or n/a> |
Section 4: | Phase <NN> | <n> | <n> |      (the row is removed when the phase starts; its requirements move to section 3 or become Implemented)
Section 5: | <M-NN or SCR-* or DLG-*> | <what is missing or approximated> | <B, E, I or P section> | <exact UI text in quotes, or the document name> | <R-ID list> |
Section 6: | <LI-nnn>: <defect in one line> | <Critical or High or Medium or Low> | <Tpp.nn> | <test id of the regression test, or "to be added" while open> | <open or fixed> |
Section 7: | <Part 9.1 row name> | <value with unit, plus "(software GL)" when measured under SwiftShader, or "not measured"> | <node tools/perf.mjs --scenario <name>, or the device and browser of a device run> | <YYYY-MM-DD> |
```

### D.5 Commit messages

Rules (Part 0.9.5, brief section 8):

- Subject line: `Finger Lickin Music: <plain words>` for any commit that contains code (with
  or without documents); `Finger Lickin Music docs: <plain words>` for commits that change
  only documents. At most 100 characters, no trailing period, no status claim beyond what the
  commit's tests show.
- A phase-gate subject is `Finger Lickin Music: Phase <NN> - <what the phase delivers>`; a
  commit that closes one T section between gates names it (`... T<pp>.<nn> <what changed>`);
  a pause commit is marked WIP and says it is not a phase gate.
- Body (after one blank line, lines of at most 100 characters): the T sections covered, the
  self-test command and its SELFTEST line, the STATUS counts that changed, and the LEDGER
  entry timestamp and `RESUME:` value. Trailer lines that the session's environment requires
  (for example co-author attribution) go after the body.
- Commits are made at every phase gate and pause, and may be made after any clean T section.
  Nothing is pushed until the owner says so (LO-01).

Phase-gate subjects (the descriptions follow the B 27 phase contents; the session uses these
subjects):

| Phase | Gate commit subject |
|---|---|
| 01 | `Finger Lickin Music: Phase 01 - application shell, build tool, self-test runner` |
| 02 | `Finger Lickin Music: Phase 02 - music model, tempo map and shared transport` |
| 03 | `Finger Lickin Music: Phase 03 - input lifecycle, mapping profiles, judging and calibration` |
| 04 | `Finger Lickin Music: Phase 04 - audio engine, scheduler, GM programs and drum kit` |
| 05 | `Finger Lickin Music: Phase 05 - renderer, rigs, instrument animation and quality tiers` |
| 06 | `Finger Lickin Music: Phase 06 - Free Play with keys, scales, metronome and takes` |
| 07 | `Finger Lickin Music: Phase 07 - MIDI import, inspection and playback` |
| 08 | `Finger Lickin Music: Phase 08 - chart generation, highway, scoring and results` |
| 09 | `Finger Lickin Music: Phase 09 - Studio tracks, recording, editing, save and export` |
| 10 | `Finger Lickin Music: Phase 10 - character editor, presets and persistence` |
| 11 | `Finger Lickin Music: Phase 11 - Dance Mode, choreography and progression` |
| 12 | `Finger Lickin Music: Phase 12 - MusicXML and Guitar Pro import and compatibility matrix` |
| 13 | `Finger Lickin Music: Phase 13 - peer-to-peer multiplayer, shared clock and relay` |
| 14 | `Finger Lickin Music: Phase 14 - instrument coverage, reverb, rendering and mobile tuning` |
| 15 | `Finger Lickin Music: Phase 15 - cross-browser, timing and recovery validation runs` |
| 16 | `Finger Lickin Music: Phase 16 - packaging and final delivery` |

Other commit kinds (T section titles and test ids in angle brackets come from Parts 11 and 6):

| Kind | Example subject |
|---|---|
| Ledger and status start (Part 0.4 step 3) | `Finger Lickin Music docs: start implementation ledger and status` |
| Clean T section between gates | `Finger Lickin Music: T04.03 transport loop wrap and seek` |
| Pause (Part 0.4 step 6) | `Finger Lickin Music: WIP T05.03 (paused, not a phase gate)` |
| Documents-only ledger checkpoint | `Finger Lickin Music docs: ledger checkpoint before pause at T<pp>.<nn>` |
| Plan patch (Part 0.1, patch number only) | `Finger Lickin Music docs: plan 1.0.1 - correct <what> in Part <n>` |
| Defect fix with regression test | `Finger Lickin Music: fix <defect in plain words>, add regression test <UT-NN-nn>` |
| Corpus change | `Finger Lickin Music: regenerate test corpus after adding <recipe>` |
| Compatibility matrix | `Finger Lickin Music docs: publish compatibility matrix from Phase 12 file tests` |
| Final report | `Finger Lickin Music docs: final implementation report and status` |

Body example for a phase gate (values in angle brackets come from the run):

```text
Finger Lickin Music: Phase 02 - music model, tempo map and shared transport

T sections: T02.01..T02.<nn>.
Self-test: node tools/selftest.mjs --all -> SELFTEST <passed>/<total> passed, <failed> failed, <skipped> skipped in <s> s (<n> groups)
STATUS: B <I>/<P>/<Bl>/<U>/<D>; E <I>/<P>/<Bl>/<U>/<D>; I <I>/<P>/<Bl>/<U>/<D>; P <I>/<P>/<Bl>/<U>/<D>
LEDGER: entry <YYYY-MM-DDTHH:MMZ>, RESUME: T03.01
```
