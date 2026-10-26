### 15.3 Essential product improvements (I)

Rows follow I sections 1 to 21 in spec order. Section-level rows (for example `R-I5-01`)
carry the obligations stated directly under a section heading that has no numbered
subsection for them. Planning-only obligations (I 18, I 19, I 20) name the plan part or
document that satisfies them in the Module(s) column when no source module applies.

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-I1.1-01 | I 1.1 | All modes share one timeline, event model, audio scheduler, instrument table and Transport.main | P0 | M-03, M-04, M-05, M-06, M-28 | Phase 02 | AT-R-I1.1-01 | Unimplemented |
| R-I1.1-02 | I 1.1 | Rhythm, free play, studio, imported songs and dance are modes on shared foundations, not separate engines | P0 | M-28, M-08, M-09, M-17, M-23 | Phase 02 | AT-R-I1.1-02 | Unimplemented |
| R-I1.2-01 | I 1.2 | Original arrangement is preserved independently of chart, difficulty and instrument (sourceEventIds only) | P0 | M-03, M-08, M-15 | Phase 08 | AT-R-I1.2-01 | Unimplemented |
| R-I1.3-01 | I 1.3 | Musical events are scheduled against AudioContext.currentTime; timers only wake the scheduler | P0 | M-04, M-05 | Phase 04 | AT-R-I1.3-01 | Unimplemented |
| R-I1.3-02 | I 1.3 | Visuals follow the timeline via Transport.positionAt and never control it, even under frame stalls | P0 | M-04, M-18, M-20, M-21 | Phase 05 | AT-R-I1.3-02 | Unimplemented |
| R-I2-01 | I 2 | Four buttons make each instrument feel distinct (per-family profile E), not one identical control feel | P1 | M-08, M-06 | Phase 03 | AT-R-I2-01 | Unimplemented |
| R-I2.1-01 | I 2.1 | Mapping profile A: four independent note lanes | P0 | M-08 | Phase 03 | AT-R-I2.1-01 | Unimplemented |
| R-I2.1-02 | I 2.1 | Mapping profiles B and C: interval buttons and chord buttons | P0 | M-02, M-08 | Phase 03 | AT-R-I2.1-02 | Unimplemented |
| R-I2.1-03 | I 2.1 | Mapping profile D: scale-based note selection in the configured key and scale | P0 | M-02, M-08 | Phase 03 | AT-R-I2.1-03 | Unimplemented |
| R-I2.1-04 | I 2.1 | Mapping profile E: instrument-specific mappings per GM family | P1 | M-06, M-08 | Phase 03 | AT-R-I2.1-04 | Unimplemented |
| R-I2.1-05 | I 2.1 | Mapping profile F: percussion triggers (drum lanes) | P0 | M-08 | Phase 03 | AT-R-I2.1-05 | Unimplemented |
| R-I2.1-06 | I 2.1 | Configurable custom layouts: remappable lane controls and touch pad layout | P1 | M-07, M-08, M-26 | Phase 03 | AT-R-I2.1-06 | Unimplemented |
| R-I2.1-07 | I 2.1 | Players switch profiles (Digit1-6, chart profile select) without modifying the original music | P0 | M-08, M-03 | Phase 03 | AT-R-I2.1-07 | Unimplemented |
| R-I2.2-01 | I 2.2 | Difficulty changes the performance challenge by rule-based selection, never random note deletion | P0 | M-08 | Phase 08 | AT-R-I2.2-01 | Unimplemented |
| R-I2.2-02 | I 2.2 | Beginner: simplified rhythms, reduced chord complexity, forgiving timing (45/90/135 ms windows) | P0 | M-08, M-09 | Phase 08 | AT-R-I2.2-02 | Unimplemented |
| R-I2.2-03 | I 2.2 | Intermediate: more syncopation, chord changes and rhythmic subdivisions (35/70/110 ms windows) | P0 | M-08, M-09 | Phase 08 | AT-R-I2.2-03 | Unimplemented |
| R-I2.2-04 | I 2.2 | Advanced: denser patterns, sustain management with holds, demanding timing (25/55/90 ms windows) | P0 | M-08, M-09 | Phase 08 | AT-R-I2.2-04 | Unimplemented |
| R-I2.2-05 | I 2.2 | Expert: close correspondence to the source where four buttons allow it (18/40/70 ms windows) | P0 | M-08, M-09 | Phase 08 | AT-R-I2.2-05 | Unimplemented |
| R-I2.2-06 | I 2.2 | Simplification keeps important beats, melodic contours, chord changes and instrument accents | P1 | M-08 | Phase 08 | AT-R-I2.2-06 | Unimplemented |
| R-I2.3-01 | I 2.3 | Configurable input offset (Calibration.inputOffsetMs) applied once in Rhythm.Judge | P0 | M-07, M-09, M-27 | Phase 03 | AT-R-I2.3-01 | Unimplemented |
| R-I2.3-02 | I 2.3 | Visual lead-time adjustment: visualLeadMs 600-3000 ms, default 1500 ms | P0 | M-09, M-21, M-27 | Phase 03 | AT-R-I2.3-02 | Unimplemented |
| R-I2.3-03 | I 2.3 | Clear pressed and released states on touch pads, highway lane receptors and HUD | P0 | M-21, M-26 | Phase 03 | AT-R-I2.3-03 | Unimplemented |
| R-I2.3-04 | I 2.3 | Simultaneous button handling: four lanes at once, chord grouping window 30 ms | P0 | M-07, M-08 | Phase 03 | AT-R-I2.3-04 | Unimplemented |
| R-I2.3-05 | I 2.3 | Hold and sustain support: hold notes judged at release, sustain control in Free Play | P0 | M-07, M-08, M-09 | Phase 03 | AT-R-I2.3-05 | Unimplemented |
| R-I2.3-06 | I 2.3 | Immediate feedback for successful and missed inputs, drawn in the frame after judgment | P0 | M-09, M-21, M-26 | Phase 03 | AT-R-I2.3-06 | Unimplemented |
| R-I2.3-07 | I 2.3 | Input latency and audio output compensation are separate values (inputOffsetMs, audioLatencyMs) | P0 | M-05, M-07, M-09 | Phase 03 | AT-R-I2.3-07 | Unimplemented |
| R-I2.3-08 | I 2.3 | Calibration wizard (DLG-Calibration, tap and listen) needs no knowledge of audio settings | P0 | M-27, M-09 | Phase 03 | AT-R-I2.3-08 | Unimplemented |
| R-I2.4-01 | I 2.4 | Show accuracy, combo, streaks, missed events and per-section performance (HUD and SCR-Results) | P0 | M-09, M-26, M-27 | Phase 08 | AT-R-I2.4-01 | Unimplemented |
| R-I2.4-02 | I 2.4 | Feedback names where to improve (weakest section, early or late tendency) without crowding lanes | P1 | M-09, M-21, M-27 | Phase 08 | AT-R-I2.4-02 | Unimplemented |
| R-I2.4-03 | I 2.4 | Scoring is deterministic (integer ScoreState) and testable alone by replaying an input log | P0 | M-09, M-31 | Phase 03 | AT-R-I2.4-03 | Unimplemented |
| R-I3.1-01 | I 3.1 | Layered engine: 16 synthesized family templates plus instrument-specific playback behavior | P0 | M-05, M-06 | Phase 04 | AT-R-I3.1-01 | Unimplemented |
| R-I3.1-02 | I 3.1 | Sampled instruments: none bundled; sampled playback via a user SoundFont is a separate P2 feature | P2 | M-06 | Phase 14 | n/a | Deferred |
| R-I3.1-03 | I 3.1 | Support polyphony, velocity, sustain, program change, percussion, pitch bend and controller events | P0 | M-05, M-06 | Phase 04 | AT-R-I3.1-03 | Unimplemented |
| R-I3.1-04 | I 3.1 | A reliable baseline across all 128 GM programs takes precedence over a few showcase instruments | P1 | M-06 | Phase 04 | AT-R-I3.1-04 | Unimplemented |
| R-I3.2-01 | I 3.2 | A guitar does not sound or respond like a piano preset: family templates differ in behavior | P1 | M-06 | Phase 04 | AT-R-I3.2-01 | Unimplemented |
| R-I3.2-02 | I 3.2 | Per instrument: note decay, articulation, velocity response, playing range, sustain, limitations | P1 | M-06, M-08 | Phase 04 | AT-R-I3.2-02 | Unimplemented |
| R-I3.2-03 | I 3.2 | Legato, portamento, glissando and other advanced articulation synthesis | P2 | M-06 | Phase 14 | n/a | Deferred |
| R-I3.3-01 | I 3.3 | Track gain, master volume, mute, solo, pan, peak management (limiter, meter), voice allocation | P0 | M-05, M-27 | Phase 04 | AT-R-I3.3-01 | Unimplemented |
| R-I3.3-02 | I 3.3 | Prevent clipping (master limiter) and runaway audio-node creation (bounded, disconnected nodes) | P0 | M-05, M-06 | Phase 04 | AT-R-I3.3-02 | Unimplemented |
| R-I3.3-03 | I 3.3 | Audio stays stable in dense arrangements and long recording sessions (60 min soak) | P0 | M-05, M-06, M-17 | Phase 14 | AT-R-I3.3-03 | Unimplemented |
| R-I3.4-01 | I 3.4 | Every instrument definition declares its supported fidelity features | P1 | M-06 | Phase 04 | AT-R-I3.4-01 | Unimplemented |
| R-I3.4-02 | I 3.4 | Declare basic synthesized sound (fidelity synth-basic) | P1 | M-06 | Phase 04 | AT-R-I3.4-02 | Unimplemented |
| R-I3.4-03 | I 3.4 | Declare sample-based sound (false for every v1 program; level sampled unused) | P1 | M-06 | Phase 04 | AT-R-I3.4-03 | Unimplemented |
| R-I3.4-04 | I 3.4 | Declare velocity layers (fidelity synth-velocity where layers exist) | P1 | M-06 | Phase 04 | AT-R-I3.4-04 | Unimplemented |
| R-I3.4-05 | I 3.4 | Declare articulation support per instrument | P1 | M-06 | Phase 04 | AT-R-I3.4-05 | Unimplemented |
| R-I3.4-06 | I 3.4 | Declare controller support per instrument | P1 | M-06 | Phase 04 | AT-R-I3.4-06 | Unimplemented |
| R-I3.4-07 | I 3.4 | Declare percussion-specific playback for the drum kit | P1 | M-06 | Phase 04 | AT-R-I3.4-07 | Unimplemented |
| R-I3.4-08 | I 3.4 | UI never implies full GM timbral fidelity; Settings and About state sounds are synthesized | P0 | M-27 | Phase 04 | AT-R-I3.4-08 | Unimplemented |
| R-I3.5-01 | I 3.5 | Optional calibration and diagnostics screen (SCR-Diagnostics with DLG-Calibration) | P1 | M-01, M-27 | Phase 04 | AT-R-I3.5-01 | Unimplemented |
| R-I3.5-02 | I 3.5 | Measure or guide audio output latency (outputLatency estimate plus tap-and-listen step) | P1 | M-05, M-27 | Phase 04 | AT-R-I3.5-02 | Unimplemented |
| R-I3.5-03 | I 3.5 | Measure or guide input response (tap test showing input-to-beat deltas) | P1 | M-07, M-27 | Phase 04 | AT-R-I3.5-03 | Unimplemented |
| R-I3.5-04 | I 3.5 | Report playback stability (scheduler stalls and late events from sched.stall) | P1 | M-05, M-01 | Phase 04 | AT-R-I3.5-04 | Unimplemented |
| R-I3.5-05 | I 3.5 | Report audio initialization (context state, sample rate, unlock result) | P1 | M-05, M-29 | Phase 04 | AT-R-I3.5-05 | Unimplemented |
| R-I3.5-06 | I 3.5 | Report sample or sound-bank availability: "synthesized, no sound bank" in v1 | P1 | M-06, M-27 | Phase 04 | AT-R-I3.5-06 | Unimplemented |
| R-I3.5-07 | I 3.5 | Never claim exact automatic hardware latency measurement; measured values are labeled estimates | P0 | M-27 | Phase 04 | AT-R-I3.5-07 | Unimplemented |
| R-I3.5-08 | I 3.5 | Where measurement is uncertain, provide a calibration procedure (guided wizard) | P0 | M-27, M-09 | Phase 03 | AT-R-I3.5-08 | Unimplemented |
| R-I4-01 | I 4 | The band visualizes the actual music, not characters animated independently of it | P0 | M-20, M-21 | Phase 05 | AT-R-I4-01 | Unimplemented |
| R-I4.1-01 | I 4.1 | One humanoid rig with attachment points, reusable controllers and procedural motion (IK, idle) | P0 | M-19, M-20 | Phase 05 | AT-R-I4.1-01 | Unimplemented |
| R-I4.1-02 | I 4.1 | Believable movement and instrument interaction without a bespoke animation system per model | P1 | M-19, M-20, M-22 | Phase 05 | AT-R-I4.1-02 | Unimplemented |
| R-I4.2-01 | I 4.2 | Notes, velocity, density and sustain drive strum, key-press, drum-strike, bowing and other gestures | P0 | M-20 | Phase 05 | AT-R-I4.2-01 | Unimplemented |
| R-I4.2-02 | I 4.2 | Hybrid fallback: skeletal animation plus clear note visualizers where hand-to-note accuracy fails | P1 | M-20, M-21 | Phase 05 | AT-R-I4.2-02 | Unimplemented |
| R-I4.3-01 | I 4.3 | StageDirector picks camera presets, emphasizes solos, reacts to sections, highlights key events | P1 | M-20, M-21 | Phase 05 | AT-R-I4.3-01 | Unimplemented |
| R-I4.3-02 | I 4.3 | Camera changes never obscure gameplay targets or interrupt player control | P0 | M-20, M-21, M-07 | Phase 05 | AT-R-I4.3-02 | Unimplemented |
| R-I4.4-01 | I 4.4 | Beat and measure indicators (BeatIndicator driven by sched.beat) | P1 | M-20, M-21 | Phase 05 | AT-R-I4.4-01 | Unimplemented |
| R-I4.4-02 | I 4.4 | Active-note highlighting | P1 | M-20, M-21 | Phase 05 | AT-R-I4.4-02 | Unimplemented |
| R-I4.4-03 | I 4.4 | Instrument identity indicators per performer | P1 | M-21 | Phase 05 | AT-R-I4.4-03 | Unimplemented |
| R-I4.4-04 | I 4.4 | Velocity-responsive animation | P1 | M-20 | Phase 05 | AT-R-I4.4-04 | Unimplemented |
| R-I4.4-05 | I 4.4 | Solo and accompaniment emphasis | P1 | M-20, M-21 | Phase 05 | AT-R-I4.4-05 | Unimplemented |
| R-I4.4-06 | I 4.4 | Section transitions shown in the stage | P1 | M-20, M-21 | Phase 05 | AT-R-I4.4-06 | Unimplemented |
| R-I4.4-07 | I 4.4 | Optional abstract effects for instruments without practical humanoid animation (Visualizer) | P1 | M-20 | Phase 05 | AT-R-I4.4-07 | Unimplemented |
| R-I4.4-08 | I 4.4 | Adjustable camera distance and stage layout (performer slots 0-4) | P1 | M-21, M-22 | Phase 05 | AT-R-I4.4-08 | Unimplemented |
| R-I4.4-09 | I 4.4 | Visualizer never invents activity in silence nor shows inactive or muted instruments performing | P0 | M-20, M-21 | Phase 05 | AT-R-I4.4-09 | Unimplemented |
| R-I5-01 | I 5 | Studio lets a player go from a short idea to a complete multitrack composition without leaving the game | P1 | M-17, M-27 | Phase 09 | AT-R-I5-01 | Unimplemented |
| R-I5-02 | I 5 | Instant track creation: add an instrument track and start recording in at most two actions | P1 | M-17, M-27 | Phase 09 | AT-R-I5-02 | Unimplemented |
| R-I5-03 | I 5 | Count-in (0, 1 or 2 bars, beat 1 accented) and metronome with configurable tempo and time signature | P0 | M-03, M-04, M-05, M-17 | Phase 06 | AT-R-I5-03 | Unimplemented |
| R-I5-04 | I 5 | Overdubbing: record a new instrument while hearing existing tracks | P1 | M-17, M-05 | Phase 09 | AT-R-I5-04 | Unimplemented |
| R-I5-05 | I 5 | Loop recording: repeat a section for practice and composition | P1 | M-17, M-04 | Phase 09 | AT-R-I5-05 | Unimplemented |
| R-I5-06 | I 5 | Basic piano roll: edit note pitch, start time, duration and velocity | P1 | M-17, M-27 | Phase 09 | AT-R-I5-06 | Unimplemented |
| R-I5-07 | I 5 | Quantize selected events to configurable subdivisions, never forced on whole performances | P1 | M-17 | Phase 09 | AT-R-I5-07 | Unimplemented |
| R-I5-08 | I 5 | Undo and redo with a predictable edit history (UndoStack command pattern) | P1 | M-15, M-17 | Phase 09 | AT-R-I5-08 | Unimplemented |
| R-I5-09 | I 5 | Track management: rename, duplicate, mute, solo, reorder and delete (confirmed, undoable) | P1 | M-17, M-05, M-27 | Phase 09 | AT-R-I5-09 | Unimplemented |
| R-I5-10 | I 5 | Section markers label intro, verse, chorus, bridge and other sections | P1 | M-17, M-03 | Phase 09 | AT-R-I5-10 | Unimplemented |
| R-I5-11 | I 5 | Project export saves editable musical events (.flm.json, .mid) separately from rendered audio (WAV) | P0 | M-15, M-16 | Phase 09 | AT-R-I5-11 | Unimplemented |
| R-I5.1-01 | I 5.1 | Original imported data stays intact: lockedSource tracks are never mutated | P0 | M-15, M-17 | Phase 09 | AT-R-I5.1-01 | Unimplemented |
| R-I5.1-02 | I 5.1 | Edits are stored as project changes or derived data: editing a locked track forks a derived copy | P0 | M-15, M-17 | Phase 09 | AT-R-I5.1-02 | Unimplemented |
| R-I5.1-03 | I 5.1 | Users can reset mappings, compare an edit with its source, recover, and switch modes losslessly | P1 | M-08, M-15, M-17, M-28 | Phase 09 | AT-R-I5.1-03 | Unimplemented |
| R-I5.2-01 | I 5.2 | Arrangement overview timeline shows tracks, sections, loops and important events | P1 | M-17, M-27 | Phase 09 | AT-R-I5.2-01 | Unimplemented |
| R-I5.2-02 | I 5.2 | Navigate long songs without blind scrubbing: click a bar or section to seek, jump to markers | P1 | M-17, M-27, M-04 | Phase 09 | AT-R-I5.2-02 | Unimplemented |
| R-I5.3-01 | I 5.3 | Versioned project data, safe save (temp write, read-back, swap, one .bak) and recovery checkpoints | P0 | M-15, M-16 | Phase 09 | AT-R-I5.3-01 | Unimplemented |
| R-I5.3-02 | I 5.3 | Warn before destructive operations (delete, replace, discard unsaved changes) | P0 | M-26, M-27 | Phase 09 | AT-R-I5.3-02 | Unimplemented |
| R-I5.3-03 | I 5.3 | Explicit recovery path when a save fails: DLG-SaveFailed offers Retry and Export | P0 | M-16, M-27 | Phase 09 | AT-R-I5.3-03 | Unimplemented |
| R-I5.3-04 | I 5.3 | Local browser storage is never presented as a guaranteed permanent backup | P0 | M-27 | Phase 09 | AT-R-I5.3-04 | Unimplemented |
| R-I6.1-01 | I 6.1 | Before gameplay, SCR-ImportInspect shows detected file format and version where identifiable | P0 | M-14, M-27 | Phase 07 | AT-R-I6.1-01 | Unimplemented |
| R-I6.1-02 | I 6.1 | Show tracks and instrument assignments | P0 | M-14, M-27 | Phase 07 | AT-R-I6.1-02 | Unimplemented |
| R-I6.1-03 | I 6.1 | Show song duration and tempo information | P0 | M-14, M-27 | Phase 07 | AT-R-I6.1-03 | Unimplemented |
| R-I6.1-04 | I 6.1 | Show detected time and key signatures where available | P0 | M-14, M-27 | Phase 07 | AT-R-I6.1-04 | Unimplemented |
| R-I6.1-05 | I 6.1 | Show track event counts | P0 | M-14, M-27 | Phase 07 | AT-R-I6.1-05 | Unimplemented |
| R-I6.1-06 | I 6.1 | Show unsupported features and conversion warnings (ImportWarning list) | P0 | M-14, M-27 | Phase 07 | AT-R-I6.1-06 | Unimplemented |
| R-I6.1-07 | I 6.1 | Show which track will be playable (recommendTrack) | P0 | M-14, M-27 | Phase 07 | AT-R-I6.1-07 | Unimplemented |
| R-I6.1-08 | I 6.1 | Show whether the arrangement needs a simplified four-button mapping | P0 | M-08, M-14, M-27 | Phase 07 | AT-R-I6.1-08 | Unimplemented |
| R-I6.2-01 | I 6.2 | Chart generator derives playable patterns from the source arrangement using configurable rules | P0 | M-08 | Phase 07 | AT-R-I6.2-01 | Unimplemented |
| R-I6.2-02 | I 6.2 | Generator can prioritize melodic contours | P1 | M-08 | Phase 07 | AT-R-I6.2-02 | Unimplemented |
| R-I6.2-03 | I 6.2 | Generator can prioritize chord roots and important chord tones | P1 | M-08 | Phase 07 | AT-R-I6.2-03 | Unimplemented |
| R-I6.2-04 | I 6.2 | Generator can prioritize strong beats | P1 | M-08 | Phase 07 | AT-R-I6.2-04 | Unimplemented |
| R-I6.2-05 | I 6.2 | Generator can prioritize rhythmic accents | P1 | M-08 | Phase 07 | AT-R-I6.2-05 | Unimplemented |
| R-I6.2-06 | I 6.2 | Generator can prioritize instrument-specific note patterns | P1 | M-08 | Phase 07 | AT-R-I6.2-06 | Unimplemented |
| R-I6.2-07 | I 6.2 | Users preview the generated chart per difficulty and change the mapping before playing | P0 | M-08, M-21, M-27 | Phase 07 | AT-R-I6.2-07 | Unimplemented |
| R-I6.2-08 | I 6.2 | Generation is deterministic for identical inputs and settings (generatorVersion, settingsHash) | P0 | M-08 | Phase 07 | AT-R-I6.2-08 | Unimplemented |
| R-I6.2-09 | I 6.2 | Generation never overwrites the original arrangement | P0 | M-08, M-15 | Phase 07 | AT-R-I6.2-09 | Unimplemented |
| R-I6.3-01 | I 6.3 | Mute the target instrument (gameplay.targetTrackMode mute) | P1 | M-05, M-27 | Phase 08 | AT-R-I6.3-01 | Unimplemented |
| R-I6.3-02 | I 6.3 | Lower accompaniment volume (gameplay.accompanimentVolume 0-1) | P1 | M-05, M-27 | Phase 08 | AT-R-I6.3-02 | Unimplemented |
| R-I6.3-03 | I 6.3 | Solo an individual track from the practice panel | P1 | M-05, M-27 | Phase 11 | AT-R-I6.3-03 | Unimplemented |
| R-I6.3-04 | I 6.3 | Loop a difficult section (Transport loop region, minimum 0.25 s) | P1 | M-04, M-27 | Phase 11 | AT-R-I6.3-04 | Unimplemented |
| R-I6.3-05 | I 6.3 | Slow playback preserving pitch where supported: synthesized tracks keep pitch; audio tracks stay 1.0 | P1 | M-04, M-05 | Phase 11 | AT-R-I6.3-05 | Unimplemented |
| R-I6.3-06 | I 6.3 | Increase speed progressively: +0.05 per completed loop pass up to 1.0 | P1 | M-04, M-27 | Phase 11 | AT-R-I6.3-06 | Unimplemented |
| R-I6.3-07 | I 6.3 | Restart from a chosen measure or section | P1 | M-04, M-27 | Phase 11 | AT-R-I6.3-07 | Unimplemented |
| R-I6.3-08 | I 6.3 | Practice one hand or part: keys hand split at MIDI 60, or one track of the arrangement | P1 | M-08, M-27 | Phase 11 | AT-R-I6.3-08 | Unimplemented |
| R-I6.4-01 | I 6.4 | Compatibility matrix lists supported MIDI, MusicXML, Guitar Pro and audio formats with limitations | P1 | M-14, docs/COMPATIBILITY.md | Phase 12 | AT-R-I6.4-01 | Unimplemented |
| R-I6.4-02 | I 6.4 | No format is advertised as supported because its extension is recognized; FT evidence required | P0 | M-14, docs/COMPATIBILITY.md | Phase 12 | AT-R-I6.4-02 | Unimplemented |
| R-I7-01 | I 7 | Dance mode has its own presentation and progression, not relabeled instrument gameplay | P1 | M-23, M-27 | Phase 11 | AT-R-I7-01 | Unimplemented |
| R-I7-02 | I 7 | Four-direction and configurable step layouts (arrows or pads, remappable step controls) | P1 | M-23, M-07 | Phase 11 | AT-R-I7-02 | Unimplemented |
| R-I7-03 | I 7 | Simultaneous steps (jumps) and hold notes | P1 | M-23 | Phase 11 | AT-R-I7-03 | Unimplemented |
| R-I7-04 | I 7 | Multiple dance difficulty levels: easy, normal, hard | P1 | M-23 | Phase 11 | AT-R-I7-04 | Unimplemented |
| R-I7-05 | I 7 | Dance timing judgments (Rhythm.Judge windows) and combos | P1 | M-23, M-09 | Phase 11 | AT-R-I7-05 | Unimplemented |
| R-I7-06 | I 7 | Song-specific dance charts generated per song by DanceChartGenerator | P1 | M-23 | Phase 11 | AT-R-I7-06 | Unimplemented |
| R-I7-07 | I 7 | Distinct dance gameplay HUD | P1 | M-23, M-26 | Phase 11 | AT-R-I7-07 | Unimplemented |
| R-I7-08 | I 7 | Avatar choreography synchronized to the chart (ChoreographyController) | P1 | M-23, M-20 | Phase 11 | AT-R-I7-08 | Unimplemented |
| R-I7-09 | I 7 | Dance practice mode with speed control (practiceSpeed 0.5-1.0) | P1 | M-23, M-04 | Phase 11 | AT-R-I7-09 | Unimplemented |
| R-I7-10 | I 7 | Dance chart validation and custom chart import (.flmdance.json) | P1 | M-23, M-16 | Phase 11 | AT-R-I7-10 | Unimplemented |
| R-I7-11 | I 7 | Accessible control alternatives: alternate keys, touch pads, gamepad, optional no-fail play | P1 | M-23, M-07, M-26 | Phase 11 | AT-R-I7-11 | Unimplemented |
| R-I7-12 | I 7 | Dance chart data, scoring and choreography are separate systems joined by the common timeline | P1 | M-23, M-04 | Phase 11 | AT-R-I7-12 | Unimplemented |
| R-I8-01 | I 8 | Preset characters (8 presets) | P0 | M-22, M-30 | Phase 10 | AT-R-I8-01 | Unimplemented |
| R-I8-02 | I 8 | Body and silhouette choices (slim, average, broad; heightScale 0.9-1.1) | P0 | M-22, M-19 | Phase 10 | AT-R-I8-02 | Unimplemented |
| R-I8-03 | I 8 | Color and material customization | P1 | M-22 | Phase 10 | AT-R-I8-03 | Unimplemented |
| R-I8-04 | I 8 | Hair and clothing options | P1 | M-22 | Phase 10 | AT-R-I8-04 | Unimplemented |
| R-I8-05 | I 8 | Accessories | P1 | M-22 | Phase 10 | AT-R-I8-05 | Unimplemented |
| R-I8-06 | I 8 | Instrument selection per character | P0 | M-22 | Phase 10 | AT-R-I8-06 | Unimplemented |
| R-I8-07 | I 8 | Stage positions (slot 0-4) | P1 | M-22, M-21 | Phase 10 | AT-R-I8-07 | Unimplemented |
| R-I8-08 | I 8 | Saved character presets (characters store, .flmchar.json export) | P0 | M-22, M-16 | Phase 10 | AT-R-I8-08 | Unimplemented |
| R-I8-09 | I 8 | Preview animations (looped instrument preview phrase) | P1 | M-22, M-20, M-27 | Phase 10 | AT-R-I8-09 | Unimplemented |
| R-I8-10 | I 8 | Avatar compatibility checks (validate, attachment check, version) | P1 | M-22, M-19 | Phase 10 | AT-R-I8-10 | Unimplemented |
| R-I8-11 | I 8 | Character editor reuses the gameplay stage rendering and rig systems | P0 | M-22, M-18, M-19, M-21 | Phase 10 | AT-R-I8-11 | Unimplemented |
| R-I8-12 | I 8 | Customization causes no full scene reload and never loses the current song, recording or project | P0 | M-21, M-22, M-28, M-15 | Phase 10 | AT-R-I8-12 | Unimplemented |
| R-I9.1-01 | I 9.1 | Song completion records | P1 | M-25 | Phase 08 | AT-R-I9.1-01 | Unimplemented |
| R-I9.1-02 | I 9.1 | Best accuracy and best score per song and chart | P1 | M-25 | Phase 08 | AT-R-I9.1-02 | Unimplemented |
| R-I9.1-03 | I 9.1 | Difficulty completion records | P1 | M-25 | Phase 08 | AT-R-I9.1-03 | Unimplemented |
| R-I9.1-04 | I 9.1 | Personal bests (comparable plays only) | P1 | M-25 | Phase 08 | AT-R-I9.1-04 | Unimplemented |
| R-I9.1-05 | I 9.1 | Instrument-specific achievements | P1 | M-25 | Phase 11 | AT-R-I9.1-05 | Unimplemented |
| R-I9.1-06 | I 9.1 | Dance achievements | P1 | M-25 | Phase 11 | AT-R-I9.1-06 | Unimplemented |
| R-I9.1-07 | I 9.1 | Practice milestones | P1 | M-25 | Phase 11 | AT-R-I9.1-07 | Unimplemented |
| R-I9.1-08 | I 9.1 | Optional challenge objectives | P1 | M-25 | Phase 11 | AT-R-I9.1-08 | Unimplemented |
| R-I9.1-09 | I 9.1 | Progression rewards improvement and never locks core music creation tools | P1 | M-25, M-27 | Phase 11 | AT-R-I9.1-09 | Unimplemented |
| R-I9.2-01 | I 9.2 | Save results locally: song, difficulty, instrument, score, accuracy and relevant settings | P1 | M-25, M-16 | Phase 08 | AT-R-I9.2-01 | Unimplemented |
| R-I9.2-02 | I 9.2 | Compare attempts and show improvement over time (history list, best delta, per-chart trend) | P1 | M-25, M-27 | Phase 08 | AT-R-I9.2-02 | Unimplemented |
| R-I9.3-01 | I 9.3 | Unlockable stage themes, avatar cosmetics and animated effects through progression (catalog M-25) | P2 | M-25, M-21, M-22 | Phase 11 | n/a | Unimplemented |
| R-I9.3-02 | I 9.3 | Cosmetic unlocks never affect accuracy, input timing or instrument performance | P1 | M-25, M-09 | Phase 11 | AT-R-I9.3-02 | Unimplemented |
| R-I9.4-01 | I 9.4 | Optional daily challenges: short repeatable activities (rhythm, hard section, given instrument) | P2 | M-25, M-27 | Phase 11 | n/a | Unimplemented |
| R-I9.4-02 | I 9.4 | Daily features stay optional: nothing is locked or penalized when skipped | P1 | M-25, M-27 | Phase 11 | AT-R-I9.4-02 | Unimplemented |
| R-I9.4-03 | I 9.4 | Daily features never require an account in standalone mode | P0 | M-25 | Phase 11 | AT-R-I9.4-03 | Unimplemented |
| R-I10-01 | I 10 | Multiplayer offers shared musical play, not only the sight of other players' avatars | P1 | M-24, M-27 | Phase 13 | AT-R-I10-01 | Unimplemented |
| R-I10.1-01 | I 10.1 | Cooperative Band: players perform different instruments within the same arrangement | P1 | M-24, M-09, M-27 | Phase 13 | AT-R-I10.1-01 | Unimplemented |
| R-I10.1-02 | I 10.1 | Cooperative Band shows each player's contribution and synchronizes the musical timeline | P1 | M-24, M-04, M-27 | Phase 13 | AT-R-I10.1-02 | Unimplemented |
| R-I10.1-03 | I 10.1 | Synchronized Play: same chart version (settingsHash) and scoring rules; compare accuracy, combo, score | P1 | M-24, M-08, M-09, M-27 | Phase 13 | AT-R-I10.1-03 | Unimplemented |
| R-I10.1-04 | I 10.1 | Collaborative Studio: shared project with explicit ownership, edit permissions and conflict handling | P2 | M-24, M-17 | Phase 13 | n/a | Deferred |
| R-I10.2-01 | I 10.2 | Measure latency and clock offset (8 samples, then every 10 s), detect missed updates, show quality | P1 | M-24, M-27 | Phase 13 | AT-R-I10.2-01 | Unimplemented |
| R-I10.2-02 | I 10.2 | Musical events use the shared timeline with lead time, never playback on message arrival | P1 | M-24, M-04, M-05 | Phase 13 | AT-R-I10.2-02 | Unimplemented |
| R-I10.3-01 | I 10.3 | Support reconnecting, resynchronizing song position and recovering room state | P1 | M-24, M-04 | Phase 13 | AT-R-I10.3-01 | Unimplemented |
| R-I10.3-02 | I 10.3 | Handle host departure: the session ends with results for every guest (host migration not built) | P1 | M-24, M-27 | Phase 13 | AT-R-I10.3-02 | Unimplemented |
| R-I10.3-03 | I 10.3 | A disconnected player never corrupts the session or permanently blocks other players | P1 | M-24 | Phase 13 | AT-R-I10.3-03 | Unimplemented |
| R-I10.4-01 | I 10.4 | Collaborative editing with rules for simultaneous edits, versioning, permissions, conflicts | P2 | M-24, M-15, M-17 | Phase 13 | n/a | Deferred |
| R-I10.4-02 | I 10.4 | Shared-studio rules are written down (Part 6 M-24) before any shared studio code exists | P1 | M-24 | Phase 13 | AT-R-I10.4-02 | Unimplemented |
| R-I10.5-01 | I 10.5 | No account, server or network connection is needed for local play, recording or project management | P0 | M-29, M-16, M-24 | Phase 13 | AT-R-I10.5-01 | Unimplemented |
| R-I11.1-01 | I 11.1 | Quick Start level: choose a song, instrument and difficulty, then play | P0 | M-27 | Phase 08 | AT-R-I11.1-01 | Unimplemented |
| R-I11.1-02 | I 11.1 | Customize level: change mappings, audio, controls and visualization | P1 | M-27 | Phase 08 | AT-R-I11.1-02 | Unimplemented |
| R-I11.1-03 | I 11.1 | Advanced level: editing, detailed musical settings, chart generation and diagnostics | P1 | M-27 | Phase 08 | AT-R-I11.1-03 | Unimplemented |
| R-I11.1-04 | I 11.1 | The initial screen never exposes every advanced control | P1 | M-27 | Phase 08 | AT-R-I11.1-04 | Unimplemented |
| R-I11.2-01 | I 11.2 | Contextual controls: instrument settings with an instrument, dance settings in dance, edit tools in studio | P1 | M-27 | Phase 08 | AT-R-I11.2-01 | Unimplemented |
| R-I11.2-02 | I 11.2 | No single enormous settings screen: categorized settings plus contextual panels | P1 | M-26, M-27 | Phase 08 | AT-R-I11.2-02 | Unimplemented |
| R-I11.3-01 | I 11.3 | Tutorial step: trigger a note | P1 | M-27, M-30 | Phase 08 | AT-R-I11.3-01 | Unimplemented |
| R-I11.3-02 | I 11.3 | Tutorial step: play two simultaneous notes | P1 | M-27, M-30 | Phase 08 | AT-R-I11.3-02 | Unimplemented |
| R-I11.3-03 | I 11.3 | Tutorial step: follow a simple rhythm | P1 | M-27, M-30 | Phase 08 | AT-R-I11.3-03 | Unimplemented |
| R-I11.3-04 | I 11.3 | Tutorial step: select a different instrument | P1 | M-27, M-30 | Phase 08 | AT-R-I11.3-04 | Unimplemented |
| R-I11.3-05 | I 11.3 | Tutorial step: record a short performance | P1 | M-27, M-17, M-30 | Phase 08 | AT-R-I11.3-05 | Unimplemented |
| R-I11.3-06 | I 11.3 | Tutorial step: import a song (guided to the picker) | P1 | M-27, M-14 | Phase 08 | AT-R-I11.3-06 | Unimplemented |
| R-I11.3-07 | I 11.3 | Tutorial step: enter the studio or dance mode | P1 | M-27, M-28 | Phase 08 | AT-R-I11.3-07 | Unimplemented |
| R-I11.3-08 | I 11.3 | Every tutorial step is skippable, repeatable and usable with keyboard or touch | P1 | M-27, M-07 | Phase 08 | AT-R-I11.3-08 | Unimplemented |
| R-I11.4-01 | I 11.4 | Loading screens report real progress where measurable, otherwise an indeterminate indicator | P1 | M-26, M-27, M-14 | Phase 01 | AT-R-I11.4-01 | Unimplemented |
| R-I11.4-02 | I 11.4 | Every error explains what failed and what the user can do next (message catalog) | P0 | M-01, M-26, M-27 | Phase 01 | AT-R-I11.4-02 | Unimplemented |
| R-I11.4-03 | I 11.4 | A failed import, recording, save or connection is never silently ignored | P0 | M-01, M-14, M-16, M-17, M-24, M-27 | Phase 01 | AT-R-I11.4-03 | Unimplemented |
| R-I12-01 | I 12 | Mobile compatibility is tested at every phase gate, not after the desktop game is finished | P1 | M-31, tools/selftest.mjs | Phase 01 | AT-R-I12-01 | Unimplemented |
| R-I12-02 | I 12 | Large, configurable touch controls: minimum 56x56 CSS px, sizes small, medium, large | P1 | M-26, M-07 | Phase 03 | AT-R-I12-02 | Unimplemented |
| R-I12-03 | I 12 | Reliable simultaneous presses: four concurrent touch pointers | P1 | M-07 | Phase 03 | AT-R-I12-03 | Unimplemented |
| R-I12-04 | I 12 | Touch cancellation and focus changes release held controls (pointercancel, blur, hidden page) | P0 | M-07, M-28 | Phase 03 | AT-R-I12-04 | Unimplemented |
| R-I12-05 | I 12 | Portrait and landscape layouts | P1 | M-26 | Phase 01 | AT-R-I12-05 | Unimplemented |
| R-I12-06 | I 12 | Adaptive rendering resolution (video.resolutionScale auto) | P1 | M-18 | Phase 05 | AT-R-I12-06 | Unimplemented |
| R-I12-07 | I 12 | Adjustable sound-bank loading: no sound banks exist in v1; tied to the SoundFont feature | P2 | M-06 | Phase 14 | n/a | Deferred |
| R-I12-08 | I 12 | Reduced visual effects on constrained devices (tier auto-selection and effectsLevel) | P1 | M-18, M-21 | Phase 14 | AT-R-I12-08 | Unimplemented |
| R-I12-09 | I 12 | Persistent settings and recoverable projects on mobile (checkpoints survive a killed tab) | P1 | M-15, M-16 | Phase 09 | AT-R-I12-09 | Unimplemented |
| R-I12-10 | I 12 | Clear audio activation behavior: tap to start, DLG-AudioBlocked, DLG-ResumeAudio | P0 | M-29, M-05, M-27 | Phase 01 | AT-R-I12-10 | Unimplemented |
| R-I12-11 | I 12 | Protection against accidental navigation during play (back, swipe, reload guarded; auto-pause) | P1 | M-26, M-28 | Phase 08 | AT-R-I12-11 | Unimplemented |
| R-I12-12 | I 12 | Testing on actual iOS and Android devices | P1 | M-31 | Phase 15 | AT-R-I12-12 | Unimplemented |
| R-I12.1-01 | I 12.1 | At least three rendering profiles are defined (plus the Abstract fallback) | P1 | M-18 | Phase 05 | AT-R-I12.1-01 | Unimplemented |
| R-I12.1-02 | I 12.1 | High profile: full stage, richer lighting, detailed animation | P1 | M-18, M-20, M-21 | Phase 05 | AT-R-I12.1-02 | Unimplemented |
| R-I12.1-03 | I 12.1 | Balanced profile: reduced geometry and visual effects | P1 | M-18, M-21 | Phase 05 | AT-R-I12.1-03 | Unimplemented |
| R-I12.1-04 | I 12.1 | Low profile: simplified scene and reduced animation complexity | P1 | M-18, M-20, M-21 | Phase 05 | AT-R-I12.1-04 | Unimplemented |
| R-I12.1-05 | I 12.1 | The audio scheduler is independent of the rendering profiles | P0 | M-05, M-18 | Phase 05 | AT-R-I12.1-05 | Unimplemented |
| R-I12.2-01 | I 12.2 | Explicit limits: 64/32 voices, 4 decoded audio tracks, 32 tracks, 5 performers, 2 MB local project | P0 | M-05, M-14, M-15, M-20, M-16 | Phase 14 | AT-R-I12.2-01 | Unimplemented |
| R-I12.2-02 | I 12.2 | Reaching any limit shows a clear warning naming the limit or applies a documented fallback | P0 | M-26, M-27 | Phase 14 | AT-R-I12.2-02 | Unimplemented |
| R-I13-01 | I 13 | Autosave at safe points: on stop, on track add or delete, every 60 s idle; never while playing | P0 | M-16, M-17 | Phase 09 | AT-R-I13-01 | Unimplemented |
| R-I13-02 | I 13 | Recoverable recording sessions: an interrupted take is kept with status aborted | P0 | M-17 | Phase 09 | AT-R-I13-02 | Unimplemented |
| R-I13-03 | I 13 | Versioned project files | P0 | M-15 | Phase 09 | AT-R-I13-03 | Unimplemented |
| R-I13-04 | I 13 | Validation before loading projects | P0 | M-15 | Phase 09 | AT-R-I13-04 | Unimplemented |
| R-I13-05 | I 13 | Explicit save confirmation only after a verified successful write | P0 | M-16, M-27 | Phase 09 | AT-R-I13-05 | Unimplemented |
| R-I13-06 | I 13 | Undo and redo for all edit commands | P1 | M-15 | Phase 09 | AT-R-I13-06 | Unimplemented |
| R-I13-07 | I 13 | Safe handling of failed exports: error shown, project untouched, retry offered | P0 | M-16, M-27 | Phase 09 | AT-R-I13-07 | Unimplemented |
| R-I13-08 | I 13 | Resource cleanup when changing modes (assertClean reports zero leaks) | P0 | M-28 | Phase 01 | AT-R-I13-08 | Unimplemented |
| R-I13-09 | I 13 | Panic/stop control silences all active notes | P0 | M-05, M-06, M-07 | Phase 04 | AT-R-I13-09 | Unimplemented |
| R-I13-10 | I 13 | Diagnostics for audio, rendering, storage and network errors (SCR-Diagnostics) | P1 | M-01, M-27 | Phase 01 | AT-R-I13-10 | Unimplemented |
| R-I13-11 | I 13 | Automated regression tests for previously fixed bugs | P1 | M-31 | Phase 01 | AT-R-I13-11 | Unimplemented |
| R-I13.1-01 | I 13.1 | Fault injection: drop network connections | P1 | M-24, M-31 | Phase 15 | AT-R-I13.1-01 | Unimplemented |
| R-I13.1-02 | I 13.1 | Fault injection: suspend audio | P1 | M-05, M-31 | Phase 15 | AT-R-I13.1-02 | Unimplemented |
| R-I13.1-03 | I 13.1 | Fault injection: force a rendering interruption (context loss) | P1 | M-18, M-31 | Phase 15 | AT-R-I13.1-03 | Unimplemented |
| R-I13.1-04 | I 13.1 | Fault injection: load malformed files | P0 | M-14, M-31 | Phase 15 | AT-R-I13.1-04 | Unimplemented |
| R-I13.1-05 | I 13.1 | Fault injection: exhaust storage | P0 | M-16, M-31 | Phase 15 | AT-R-I13.1-05 | Unimplemented |
| R-I13.1-06 | I 13.1 | Fault injection: interrupt a save | P0 | M-16, M-31 | Phase 15 | AT-R-I13.1-06 | Unimplemented |
| R-I13.1-07 | I 13.1 | Fault injection: disconnect an input device | P1 | M-07, M-31 | Phase 15 | AT-R-I13.1-07 | Unimplemented |
| R-I13.1-08 | I 13.1 | Fault injection: switch modes while notes are active | P0 | M-28, M-31 | Phase 15 | AT-R-I13.1-08 | Unimplemented |
| R-I13.1-09 | I 13.1 | Every injected fault is recovered from without corrupting user data | P0 | M-15, M-16, M-28, M-31 | Phase 15 | AT-R-I13.1-09 | Unimplemented |
| R-I13.2-01 | I 13.2 | Bug report export (Diagnostics JSON <= 200 KB): Caps, version, mode, settings, recent error log | P1 | M-01, M-27 | Phase 01 | AT-R-I13.2-01 | Unimplemented |
| R-I13.2-02 | I 13.2 | Report excludes song contents, private files and personal data unless the user opts to attach | P0 | M-01 | Phase 01 | AT-R-I13.2-02 | Unimplemented |
| R-I14-01 | I 14 | Single-file delivery uses a modular source tree, not a fragile monolith (src/ built to one file) | P0 | M-01, tools/build.mjs | Phase 01 | AT-R-I14-01 | Unimplemented |
| R-I14.1-01 | I 14.1 | Logical modules inside the HTML: one IIFE per module, one FLM namespace each | P0 | M-01, tools/build.mjs | Phase 01 | AT-R-I14.1-01 | Unimplemented |
| R-I14.1-02 | I 14.1 | Musical timeline is independently testable | P0 | M-03, M-04, M-31 | Phase 02 | AT-R-I14.1-02 | Unimplemented |
| R-I14.1-03 | I 14.1 | Input and mapping are independently testable | P0 | M-07, M-08, M-31 | Phase 03 | AT-R-I14.1-03 | Unimplemented |
| R-I14.1-04 | I 14.1 | Audio engine is independently testable (OfflineAudioContext harness) | P0 | M-05, M-06, M-31 | Phase 04 | AT-R-I14.1-04 | Unimplemented |
| R-I14.1-05 | I 14.1 | File parsers are independently testable | P0 | M-10, M-11, M-12, M-13, M-14, M-31 | Phase 07 | AT-R-I14.1-05 | Unimplemented |
| R-I14.1-06 | I 14.1 | Rhythm scoring is independently testable | P0 | M-09, M-31 | Phase 03 | AT-R-I14.1-06 | Unimplemented |
| R-I14.1-07 | I 14.1 | Studio and recording are independently testable | P0 | M-17, M-31 | Phase 09 | AT-R-I14.1-07 | Unimplemented |
| R-I14.1-08 | I 14.1 | Rendering and animation are independently testable | P0 | M-18, M-19, M-20, M-31 | Phase 05 | AT-R-I14.1-08 | Unimplemented |
| R-I14.1-09 | I 14.1 | Dance gameplay is independently testable | P1 | M-23, M-31 | Phase 11 | AT-R-I14.1-09 | Unimplemented |
| R-I14.1-10 | I 14.1 | Character customization is independently testable | P0 | M-22, M-31 | Phase 10 | AT-R-I14.1-10 | Unimplemented |
| R-I14.1-11 | I 14.1 | Persistence is independently testable (FakeIndexedDB) | P0 | M-15, M-16, M-31 | Phase 09 | AT-R-I14.1-11 | Unimplemented |
| R-I14.1-12 | I 14.1 | Multiplayer client is independently testable | P1 | M-24, M-31 | Phase 13 | AT-R-I14.1-12 | Unimplemented |
| R-I14.2-01 | I 14.2 | Record purpose, version, license, size, loading strategy and fallback for every dependency | P1 | Part 2 ADR-02, docs/FINAL-REPORT.md | Phase 01 | AT-R-I14.2-01 | Unimplemented |
| R-I14.2-02 | I 14.2 | Prefer native capabilities; a library only where it meaningfully improves correctness (v1: none) | P1 | Part 2 ADR-02, tools/build.mjs | Phase 01 | AT-R-I14.2-02 | Unimplemented |
| R-I14.3-01 | I 14.3 | Standalone edition: one HTML file containing the core application | P0 | tools/build.mjs | Phase 16 | AT-R-I14.3-01 | Unimplemented |
| R-I14.3-02 | I 14.3 | Standalone: gameplay, import, recording, visualization and export work without an online service | P0 | M-14, M-16, M-17, M-21, M-29 | Phase 16 | AT-R-I14.3-02 | Unimplemented |
| R-I14.3-03 | I 14.3 | Online edition: the same HTML client plus the optional relay (build flag --online) | P1 | M-24, server/relay.mjs, tools/build.mjs | Phase 13 | AT-R-I14.3-03 | Unimplemented |
| R-I14.3-04 | I 14.3 | Downloadable sound banks or assets only if their absence keeps standalone working; v1 ships none | P2 | M-06 | Phase 14 | n/a | Deferred |
| R-I14.3-05 | I 14.3 | The Online edition is never described as entirely self-contained | P1 | M-27 | Phase 13 | AT-R-I14.3-05 | Unimplemented |
| R-I14.3-06 | I 14.3 | No claim that client code alone creates a public multiplayer service; the relay is separate | P1 | M-27, server/relay.mjs | Phase 13 | AT-R-I14.3-06 | Unimplemented |
| R-I15-01 | I 15 | Remappable keyboard and touch controls with conflict detection | P1 | M-07, M-26, M-27 | Phase 03 | AT-R-I15-01 | Unimplemented |
| R-I15-02 | I 15 | Adjustable note speed (visualLeadMs shown as Note speed) | P1 | M-21, M-27 | Phase 08 | AT-R-I15-02 | Unimplemented |
| R-I15-03 | I 15 | Adjustable judgment windows where appropriate; non-standard windows mark results not comparable | P1 | M-09, M-25 | Phase 08 | AT-R-I15-03 | Unimplemented |
| R-I15-04 | I 15 | Reduced-motion mode (system, on, off) | P1 | M-26, M-20, M-21 | Phase 05 | AT-R-I15-04 | Unimplemented |
| R-I15-05 | I 15 | High-contrast note indicators | P1 | M-21, M-26 | Phase 08 | AT-R-I15-05 | Unimplemented |
| R-I15-06 | I 15 | Non-color-only lane identification: lane glyphs and fixed lane positions | P1 | M-21 | Phase 08 | AT-R-I15-06 | Unimplemented |
| R-I15-07 | I 15 | Adjustable visual effects (effectsLevel off, reduced, full) | P1 | M-21 | Phase 05 | AT-R-I15-07 | Unimplemented |
| R-I15-08 | I 15 | Scalable interface (uiScale 0.8-1.5) | P1 | M-26 | Phase 01 | AT-R-I15-08 | Unimplemented |
| R-I15-09 | I 15 | Clear focus indicators on every focusable control | P1 | M-26 | Phase 01 | AT-R-I15-09 | Unimplemented |
| R-I15-10 | I 15 | Keyboard navigation for all menus and dialogs | P1 | M-26 | Phase 01 | AT-R-I15-10 | Unimplemented |
| R-I15-11 | I 15 | Configurable control sizes (padSize small, medium, large) | P1 | M-26 | Phase 03 | AT-R-I15-11 | Unimplemented |
| R-I15-12 | I 15 | Optional simplified visualization for lower-powered devices (Abstract tier selectable) | P1 | M-18 | Phase 05 | AT-R-I15-12 | Unimplemented |
| R-I15-13 | I 15 | Accessibility settings apply consistently in instrument, studio and dance modes | P1 | M-26, M-28 | Phase 11 | AT-R-I15-13 | Unimplemented |
| R-I16.1-01 | I 16.1 | Instrument definition: display name | P1 | M-06 | Phase 04 | AT-R-I16.1-01 | Unimplemented |
| R-I16.1-02 | I 16.1 | Instrument definition: General MIDI program | P1 | M-06 | Phase 04 | AT-R-I16.1-02 | Unimplemented |
| R-I16.1-03 | I 16.1 | Instrument definition: sound-bank mapping (family template; bank reference null in v1) | P1 | M-06 | Phase 04 | AT-R-I16.1-03 | Unimplemented |
| R-I16.1-04 | I 16.1 | Instrument definition: percussion behavior | P1 | M-06 | Phase 04 | AT-R-I16.1-04 | Unimplemented |
| R-I16.1-05 | I 16.1 | Instrument definition: playable range | P1 | M-06 | Phase 04 | AT-R-I16.1-05 | Unimplemented |
| R-I16.1-06 | I 16.1 | Instrument definition: polyphony requirements | P1 | M-06, M-05 | Phase 04 | AT-R-I16.1-06 | Unimplemented |
| R-I16.1-07 | I 16.1 | Instrument definition: input mapping defaults (default profile) | P1 | M-06, M-08 | Phase 04 | AT-R-I16.1-07 | Unimplemented |
| R-I16.1-08 | I 16.1 | Instrument definition: animation profile (controller id) | P1 | M-06, M-20 | Phase 04 | AT-R-I16.1-08 | Unimplemented |
| R-I16.1-09 | I 16.1 | Instrument definition: visual representation (prop id) | P1 | M-06, M-21 | Phase 04 | AT-R-I16.1-09 | Unimplemented |
| R-I16.1-10 | I 16.1 | Instrument definition: supported controllers and articulations | P1 | M-06 | Phase 04 | AT-R-I16.1-10 | Unimplemented |
| R-I16.1-11 | I 16.1 | Adding an instrument means adding or updating its definition, never changing the scheduler | P1 | M-06, M-05 | Phase 04 | AT-R-I16.1-11 | Unimplemented |
| R-I16.2-01 | I 16.2 | Each importer is an adapter converting its source into the shared Song representation | P0 | M-14, M-10 | Phase 07 | AT-R-I16.2-01 | Unimplemented |
| R-I16.2-02 | I 16.2 | The rest of the game never depends on whether a song came from MIDI, MusicXML or Guitar Pro | P1 | M-14, M-12, M-13 | Phase 12 | AT-R-I16.2-02 | Unimplemented |
| R-I16.3-01 | I 16.3 | Audio, scoring, visuals, recording and animation consume events without copying or mutating them | P0 | M-03, M-05, M-09, M-17, M-20, M-21 | Phase 02 | AT-R-I16.3-01 | Unimplemented |
| R-I16.4-01 | I 16.4 | Instruments, projects, charts, dance charts and net messages carry versions and migration rules | P1 | M-06, M-08, M-15, M-23, M-24 | Phase 09 | AT-R-I16.4-01 | Unimplemented |
| R-I17-01 | I 17 | Automated verification runs from the first phase, not only when the game appears complete | P0 | M-31, tools/selftest.mjs | Phase 01 | AT-R-I17-01 | Unimplemented |
| R-I17-02 | I 17 | Automatically verify musical time conversion | P0 | M-03, M-31 | Phase 02 | AT-R-I17-02 | Unimplemented |
| R-I17-03 | I 17 | Automatically verify audio scheduling logic | P0 | M-05, M-31 | Phase 04 | AT-R-I17-03 | Unimplemented |
| R-I17-04 | I 17 | Automatically verify note-on and note-off lifecycle | P0 | M-05, M-06, M-31 | Phase 04 | AT-R-I17-04 | Unimplemented |
| R-I17-05 | I 17 | Automatically verify chord and scale mapping | P0 | M-02, M-08, M-31 | Phase 03 | AT-R-I17-05 | Unimplemented |
| R-I17-06 | I 17 | Automatically verify scoring boundary conditions | P0 | M-09, M-31 | Phase 08 | AT-R-I17-06 | Unimplemented |
| R-I17-07 | I 17 | Automatically verify MIDI parsing | P0 | M-10, M-31 | Phase 07 | AT-R-I17-07 | Unimplemented |
| R-I17-08 | I 17 | Automatically verify project save and load integrity | P0 | M-15, M-16, M-31 | Phase 09 | AT-R-I17-08 | Unimplemented |
| R-I17-09 | I 17 | Automatically verify import and export round trips where supported (MIDI, project JSON) | P1 | M-10, M-15, M-31 | Phase 09 | AT-R-I17-09 | Unimplemented |
| R-I17-10 | I 17 | Automatically verify mode-transition cleanup | P0 | M-28, M-31 | Phase 05 | AT-R-I17-10 | Unimplemented |
| R-I17-11 | I 17 | Automatically verify multiplayer message validation | P1 | M-24, M-31 | Phase 13 | AT-R-I17-11 | Unimplemented |
| R-I17-12 | I 17 | Automatically verify mobile input lifecycle | P1 | M-07, M-31 | Phase 03 | AT-R-I17-12 | Unimplemented |
| R-I17-13 | I 17 | Automatically verify resource limits | P1 | M-05, M-15, M-31 | Phase 14 | AT-R-I17-13 | Unimplemented |
| R-I17-14 | I 17 | Every defect fixed after testing gets a regression test whenever practical | P1 | M-31, docs/LEDGER.md | Phase 15 | AT-R-I17-14 | Unimplemented |
| R-I17-15 | I 17 | The final release is tested by opening the delivered FingerLickinMusic.html, not a dev build | P0 | tools/selftest.mjs, FingerLickinMusic.html | Phase 16 | AT-R-I17-15 | Unimplemented |
| R-I18-01 | I 18 | Tier 1 Foundation first: timeline, separate clocks, event model, module boundaries, versioning | P0 | M-01, M-03, M-04, M-15 | Phase 01 | AT-R-I18-01 | Unimplemented |
| R-I18-02 | I 18 | Tier 2 Core gameplay: four-button input, calibration, mappings, deterministic scoring, note release | P0 | M-07, M-08, M-09 | Phase 03 | AT-R-I18-02 | Unimplemented |
| R-I18-03 | I 18 | Tier 3 Audio and imports: polyphony, sound strategy, MIDI parsing, track inspection, honest formats | P0 | M-05, M-06, M-10, M-14 | Phase 04 | AT-R-I18-03 | Unimplemented |
| R-I18-04 | I 18 | Tier 4 Visual identity: rigs, instrument animation, event-driven effects, camera presets, quality tiers | P0 | M-18, M-19, M-20, M-21 | Phase 05 | AT-R-I18-04 | Unimplemented |
| R-I18-05 | I 18 | Tier 5 Creative tools: multitrack recording, overdub, piano roll, quantize, undo, safe save, export | P1 | M-15, M-16, M-17 | Phase 06 | AT-R-I18-05 | Unimplemented |
| R-I18-06 | I 18 | Tier 6 Additional modes: dance charts and scoring, customization, progression, practice tools | P1 | M-22, M-23, M-25 | Phase 08 | AT-R-I18-06 | Unimplemented |
| R-I18-07 | I 18 | Tier 7 Online: shared clock, cooperative and competitive modes, reconnection, message validation | P1 | M-24 | Phase 13 | AT-R-I18-07 | Unimplemented |
| R-I18-08 | I 18 | Tier 7 Online: collaborative editing | P2 | M-24, M-17 | Phase 13 | n/a | Deferred |
| R-I18-09 | I 18 | Tier 8 Release quality: cross-browser, mobile devices, fault injection, budgets, packaging check | P1 | M-31, tools/perf.mjs | Phase 15 | AT-R-I18-09 | Unimplemented |
| R-I18-10 | I 18 | Multiplayer, advanced animation and extensive content are not built before timeline and audio pass | P0 | Part 11 phase gates | Phase 00 | AT-R-I18-10 | Unimplemented |
| R-I19-01 | I 19 | Target budgets and verification procedures are defined before implementation (Part 9) | P0 | Part 9 | Phase 00 | AT-R-I19-01 | Unimplemented |
| R-I19-02 | I 19 | Timing target: no cumulative drift in playback and loops (abs drift < 2 ms after a 10 min loop) | P0 | M-04, M-05 | Phase 04 | AT-R-I19-02 | Unimplemented |
| R-I19-03 | I 19 | Input target: configurable calibration and deterministic judgment calculations | P0 | M-07, M-09 | Phase 03 | AT-R-I19-03 | Unimplemented |
| R-I19-04 | I 19 | Audio target: no persistent stuck notes and no unbounded voice growth | P0 | M-05, M-06 | Phase 04 | AT-R-I19-04 | Unimplemented |
| R-I19-05 | I 19 | File integrity target: valid supported files preserve required musical events | P0 | M-10, M-12, M-13, M-14 | Phase 07 | AT-R-I19-05 | Unimplemented |
| R-I19-06 | I 19 | Recording target: previously saved takes remain intact after a failed recording | P0 | M-17, M-16 | Phase 09 | AT-R-I19-06 | Unimplemented |
| R-I19-07 | I 19 | Rendering target: quality degrades gracefully (auto-downgrade when p95 frame > 33 ms over 5 s) | P1 | M-18 | Phase 14 | AT-R-I19-07 | Unimplemented |
| R-I19-08 | I 19 | Persistence target: failed saves never report success | P0 | M-16 | Phase 09 | AT-R-I19-08 | Unimplemented |
| R-I19-09 | I 19 | Multiplayer target: synchronization quality is measured and documented (target <= 20 ms) | P1 | M-24, docs/FINAL-REPORT.md | Phase 13 | AT-R-I19-09 | Unimplemented |
| R-I19-10 | I 19 | Compatibility target: every advertised browser and format has explicit recorded test evidence | P0 | docs/COMPATIBILITY.md | Phase 15 | AT-R-I19-10 | Unimplemented |
| R-I19-11 | I 19 | Packaging target: the actual standalone HTML works in every environment claimed | P0 | FingerLickinMusic.html, docs/FINAL-REPORT.md | Phase 16 | AT-R-I19-11 | Unimplemented |
| R-I19-12 | I 19 | Numeric limits for latency, frame rate, file size, polyphony, tracks and memory are set in planning | P0 | Part 9 | Phase 00 | AT-R-I19-12 | Unimplemented |
| R-I19-13 | I 19 | Limits are never invented or relaxed after implementation to make results look successful | P0 | Part 9, docs/LEDGER.md | Phase 16 | AT-R-I19-13 | Unimplemented |
| R-I20-01 | I 20 | Contents include section: Unified musical engine and event architecture | P0 | Part 11, M-03, M-04, M-05 | Phase 02 | AT-R-I20-01 | Unimplemented |
| R-I20-02 | I 20 | Contents include section: Four-button mapping and adaptive difficulty | P0 | Part 11, M-08, M-09 | Phase 08 | AT-R-I20-02 | Unimplemented |
| R-I20-03 | I 20 | Contents include section: Audio fidelity and General MIDI coverage strategy | P0 | Part 11, M-05, M-06 | Phase 04 | AT-R-I20-03 | Unimplemented |
| R-I20-04 | I 20 | Contents include section: Instrument-specific animation and stage direction | P0 | Part 11, M-19, M-20, M-21 | Phase 05 | AT-R-I20-04 | Unimplemented |
| R-I20-05 | I 20 | Contents include section: Non-destructive studio editing | P0 | Part 11, M-15, M-17 | Phase 09 | AT-R-I20-05 | Unimplemented |
| R-I20-06 | I 20 | Contents include section: Import inspection and automatic chart generation | P0 | Part 11, M-08, M-14 | Phase 07 | AT-R-I20-06 | Unimplemented |
| R-I20-07 | I 20 | Contents include section: Dance-mode gameplay and choreography | P0 | Part 11, M-23 | Phase 11 | AT-R-I20-07 | Unimplemented |
| R-I20-08 | I 20 | Contents include section: Player progression and performance history | P0 | Part 11, M-25 | Phase 10 | AT-R-I20-08 | Unimplemented |
| R-I20-09 | I 20 | Contents include section: Multiplayer modes and synchronization architecture | P0 | Part 11, M-24 | Phase 13 | AT-R-I20-09 | Unimplemented |
| R-I20-10 | I 20 | Contents include section: Onboarding and contextual interface design | P0 | Part 11, M-26, M-27 | Phase 08 | AT-R-I20-10 | Unimplemented |
| R-I20-11 | I 20 | Contents include section: Mobile performance profiles | P0 | Part 11, M-18, M-26 | Phase 14 | AT-R-I20-11 | Unimplemented |
| R-I20-12 | I 20 | Contents include section: Autosave, recovery, and fault injection | P0 | Part 11, M-16, M-17, M-31 | Phase 09 | AT-R-I20-12 | Unimplemented |
| R-I20-13 | I 20 | Contents include section: Single-file dependency and packaging budget | P0 | Part 11, tools/build.mjs | Phase 01 | AT-R-I20-13 | Unimplemented |
| R-I20-14 | I 20 | Contents include section: Accessibility requirements | P0 | Part 11, M-26 | Phase 01 | AT-R-I20-14 | Unimplemented |
| R-I20-15 | I 20 | Contents include section: Data-driven instruments and extensible import adapters | P0 | Part 11, M-06, M-14 | Phase 07 | AT-R-I20-15 | Unimplemented |
| R-I20-16 | I 20 | Contents include section: Automated quality gates and regression testing | P0 | Part 11, M-31 | Phase 01 | AT-R-I20-16 | Unimplemented |
| R-I20-17 | I 20 | Contents include section: Quantitative performance targets | P0 | Part 11, Part 9 | Phase 00 | AT-R-I20-17 | Unimplemented |
| R-I20-18 | I 20 | Contents include section: Final product-quality acceptance review | P0 | Part 11, Part 14 | Phase 16 | AT-R-I20-18 | Unimplemented |
| R-I20-19 | I 20 | Each such section states dependencies, deliverables, test cases and measurable exit criteria | P0 | Part 11 | Phase 00 | AT-R-I20-19 | Unimplemented |
| R-I20-20 | I 20 | Each such section also appears in the requirements traceability matrix (rows of I 20 above) | P0 | Part 15 | Phase 00 | AT-R-I20-20 | Unimplemented |
| R-I21-01 | I 21 | Treat the game as one unified musical platform with several modes, not separate games on one menu | P0 | M-04, M-05, M-28 | Phase 02 | AT-R-I21-01 | Unimplemented |
| R-I21-02 | I 21 | Pillar musical accuracy: reliable timing, polyphony, instrument playback and faithful import | P0 | M-04, M-05, M-06, M-14 | Phase 16 | AT-R-I21-02 | Unimplemented |
| R-I21-03 | I 21 | Pillar immediate playability: four buttons make complex music playable without altering its structure | P0 | M-07, M-08, M-09 | Phase 16 | AT-R-I21-03 | Unimplemented |
| R-I21-04 | I 21 | Pillar expressive visualization: the virtual band responds to the actual musical performance | P0 | M-20, M-21 | Phase 16 | AT-R-I21-04 | Unimplemented |
| R-I21-05 | I 21 | Pillar creative freedom: free play, recording, layering, editing and export | P1 | M-17, M-15, M-16 | Phase 16 | AT-R-I21-05 | Unimplemented |
| R-I21-06 | I 21 | Pillar reliability: recoverable projects, robust mobile input, graceful degradation, verified file | P0 | M-16, M-07, M-18, M-28 | Phase 16 | AT-R-I21-06 | Unimplemented |
