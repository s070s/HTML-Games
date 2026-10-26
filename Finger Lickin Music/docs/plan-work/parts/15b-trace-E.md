### 15.2 Edge cases and failure modes (E)

Rows follow the edge-case specification (FLM-1.1.0) in order. A bullet case reads
"Handle: <case> -> <decided behavior>"; the "Required behavior" sentences of each subsection
follow it as separate rows. The two obligations in the unnumbered preamble before E 1 use
section number 0 (`R-E0-nn`, Spec ref "E preamble"). Where Part 1.5 marks a capability
Deferred, the Deferred capability is its own P2 row and the behavior that v1 shows the user
instead is a separate Unimplemented row. Warning codes (`W-*`) and error codes (`E-*`) named
here are defined in the module designs (Part 6) and the message catalog (Part 10.6).

#### 15.2.0 E preamble

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E0-01 | E preamble | Add the FLM-1.1.0 edge-case part to the plan as a mandatory section (this matrix plus Part 12 tests) | P0 | none | Phase 00 | AT-R-E0-01 | Unimplemented |
| R-E0-02 | E preamble | Include every E subsection in the end-to-end table of contents (Part 11) before implementation begins | P0 | none | Phase 00 | AT-R-E0-02 | Unimplemented |

#### 15.2.1 E 1 Highest-impact risks

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E1-01 | E 1 | Address every E 1 risk before bulk content: each is a Part 13 entry; core mitigations gate before chart work | P0 | none | Phase 00 | AT-R-E1-01 | Unimplemented |
| R-E1-02 | E 1 | Critical risk audio timing drift: audio clock is master; abs drift < 2 ms after a 10 min loop | P0 | M-04, M-05 | Phase 04 | AT-R-E1-02 | Unimplemented |
| R-E1-03 | E 1 | Critical risk audio blocked: unlock on the first gesture; DLG-AudioBlocked with retry; never silent failure | P0 | M-05, M-29 | Phase 04 | AT-R-E1-03 | Unimplemented |
| R-E1-04 | E 1 | Critical risk MIDI events lost or misordered: lossless parse, stable Part 5.2 ordering, FT corpus | P0 | M-03, M-10 | Phase 07 | AT-R-E1-04 | Unimplemented |
| R-E1-05 | E 1 | Critical risk lost note-offs: pairing closes notes at track end; 60 s voice cap; panic | P0 | M-03, M-05, M-06 | Phase 04 | AT-R-E1-05 | Unimplemented |
| R-E1-06 | E 1 | Critical risk rendering blocks scheduling: 25 ms timer, 120 ms lookahead, independent of the frame loop | P0 | M-05, M-18 | Phase 04 | AT-R-E1-06 | Unimplemented |
| R-E1-07 | E 1 | Critical risk single-file misunderstood: build inlines all code; delivered file fetches nothing to run | P0 | M-01, M-29 | Phase 01 | AT-R-E1-07 | Unimplemented |
| R-E1-08 | E 1 | Critical risk arrival-time sync in multiplayer: start and inputs carry shared-clock timestamps | P1 | M-24 | Phase 13 | AT-R-E1-08 | Unimplemented |
| R-E1-09 | E 1 | Critical risk save failure or corruption: temp, verify, swap, keep .bak; never a false "Saved" | P0 | M-15, M-16 | Phase 09 | AT-R-E1-09 | Unimplemented |
| R-E1-10 | E 1 | High risk stuck mobile touches: pointercancel, blur, hidden and pagehide release every held control | P0 | M-07 | Phase 03 | AT-R-E1-10 | Unimplemented |
| R-E1-11 | E 1 | High risk polyphony overload: 64 voices desktop, 32 mobile; steal released-quietest, then oldest | P0 | M-05 | Phase 04 | AT-R-E1-11 | Unimplemented |
| R-E1-12 | E 1 | High risk overstated compatibility: claims only from recorded FT corpus results in docs/COMPATIBILITY.md | P0 | M-14 | Phase 12 | AT-R-E1-12 | Unimplemented |
| R-E1-13 | E 1 | High risk state leaks between modes: full leave teardown; FLM.Modes.assertClean() counters at baseline | P0 | M-28 | Phase 01 | AT-R-E1-13 | Unimplemented |
| R-E1-14 | E 1 | High risk storage assumptions: probe storage at boot; localOnly or memory mode with notice; export offered | P0 | M-01, M-16 | Phase 09 | AT-R-E1-14 | Unimplemented |
| R-E1-15 | E 1 | High risk trusted imports: enforce size, event, track and 5 s time limits; imported text via textContent | P0 | M-10, M-12, M-13, M-14 | Phase 07 | AT-R-E1-15 | Unimplemented |
| R-E1-16 | E 1 | Treat blocked audio and missing Web MIDI as explicit Caps checks with recovery paths, never assumptions | P0 | M-01, M-05, M-07 | Phase 01 | AT-R-E1-16 | Unimplemented |

#### 15.2.2 E 2 Audio engine and musical timing

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E2-01 | E 2 | One shared audio engine serves rhythm, free play, recording, song playback and multiplayer; no per-mode engine | P0 | M-05 | Phase 04 | AT-R-E2-01 | Unimplemented |
| R-E2.1-01 | E 2.1 | Handle: audio blocked before first gesture -> no autoplay; unlock on pointerup, keydown or click | P0 | M-05, M-29 | Phase 04 | AT-R-E2.1-01 | Unimplemented |
| R-E2.1-02 | E 2.1 | Handle: context suspended while running -> gameplay pauses; DLG-ResumeAudio; resume re-anchors | P0 | M-05, M-28 | Phase 04 | AT-R-E2.1-02 | Unimplemented |
| R-E2.1-03 | E 2.1 | Handle: tab hidden for minutes -> auto-pause in gameplay modes; re-anchor on return; drift > 5 ms logged | P0 | M-04, M-28 | Phase 04 | AT-R-E2.1-03 | Unimplemented |
| R-E2.1-04 | E 2.1 | Handle: screen lock or power saving -> same suspend path; open recording take kept; resume by gesture | P0 | M-05, M-17, M-28 | Phase 04 | AT-R-E2.1-04 | Unimplemented |
| R-E2.1-05 | E 2.1 | Handle: headphones plugged or unplugged -> statechange or 3-tick clock stall detected; pause and resume dialog | P0 | M-05, M-28 | Phase 04 | AT-R-E2.1-05 | Unimplemented |
| R-E2.1-06 | E 2.1 | Handle: OS default output device changes -> same stall or statechange path; latency re-read after resume | P0 | M-05 | Phase 04 | AT-R-E2.1-06 | Unimplemented |
| R-E2.1-07 | E 2.1 | Handle: sample fails to decode -> no bundled samples; a failed audio-file decode is an import error only | P1 | M-14 | Phase 12 | AT-R-E2.1-07 | Unimplemented |
| R-E2.1-08 | E 2.1 | Handle: repeated start and stop -> each stop soft-panics; voice and node counts at baseline after 100 cycles | P0 | M-04, M-05 | Phase 04 | AT-R-E2.1-08 | Unimplemented |
| R-E2.1-09 | E 2.1 | Handle: audio init attempted twice -> one AudioContext; concurrent unlock calls share one pending promise | P0 | M-05 | Phase 04 | AT-R-E2.1-09 | Unimplemented |
| R-E2.1-10 | E 2.1 | Handle: record before audio init completes -> take starts only once the context runs; no unanchored take | P0 | M-05, M-17 | Phase 06 | AT-R-E2.1-10 | Unimplemented |
| R-E2.1-11 | E 2.1 | Manage audio state explicitly: one state machine published on EVT-audio.state; modes react only to it | P0 | M-05, M-28 | Phase 04 | AT-R-E2.1-11 | Unimplemented |
| R-E2.1-12 | E 2.1 | Failed playback yields a recoverable error or a clear Resume action; never a silent failure | P0 | M-05, M-27 | Phase 04 | AT-R-E2.1-12 | Unimplemented |
| R-E2.1-13 | E 2.1 | Reinitialization never creates a second engine or overlapping playback; the Scheduler binds one Transport | P0 | M-05 | Phase 04 | AT-R-E2.1-13 | Unimplemented |
| R-E2.2-01 | E 2.2 | Handle: 100-500 ms render frame -> scheduling independent of frames; late items played at now + 5 ms, counted | P0 | M-05, M-18 | Phase 04 | AT-R-E2.2-01 | Unimplemented |
| R-E2.2-02 | E 2.2 | Handle: background tab throttles animation -> musical time from the audio clock only; position right on return | P0 | M-04, M-20 | Phase 02 | AT-R-E2.2-02 | Unimplemented |
| R-E2.2-03 | E 2.2 | Handle: tempo change during playback -> transport re-anchors at the current tick; position never jumps | P0 | M-03, M-04 | Phase 02 | AT-R-E2.2-03 | Unimplemented |
| R-E2.2-04 | E 2.2 | Handle: multiple tempo changes -> TempoMap cumulative seconds; tick-seconds round trip within 1 tick | P0 | M-03 | Phase 02 | AT-R-E2.2-04 | Unimplemented |
| R-E2.2-05 | E 2.2 | Handle: pause during a sustained note -> voices fade in 30 ms; the note is not retriggered on resume | P0 | M-04, M-05 | Phase 04 | AT-R-E2.2-05 | Unimplemented |
| R-E2.2-06 | E 2.2 | Handle: seek with active notes -> soft panic; cursor rebuilt at the seek tick; spanning notes not retriggered | P0 | M-04, M-05 | Phase 04 | AT-R-E2.2-06 | Unimplemented |
| R-E2.2-07 | E 2.2 | Handle: loop end inside a sustained note -> note end clamped to the wrap; notes before loop start not replayed | P0 | M-04 | Phase 02 | AT-R-E2.2-07 | Unimplemented |
| R-E2.2-08 | E 2.2 | Handle: speed change while playing -> capture tick, set speed 0.25-2.0, re-anchor; future events rescheduled | P0 | M-04, M-05 | Phase 02 | AT-R-E2.2-08 | Unimplemented |
| R-E2.2-09 | E 2.2 | Handle: audio and performance clocks diverge -> 20-sample anchor ring, median offset; spread > 5 ms logged | P0 | M-04, M-07 | Phase 03 | AT-R-E2.2-09 | Unimplemented |
| R-E2.2-10 | E 2.2 | Handle: event exactly on a loop boundary -> region [a, b): tick b never plays while looping, tick a every pass | P0 | M-04 | Phase 02 | AT-R-E2.2-10 | Unimplemented |
| R-E2.2-11 | E 2.2 | Handle: notes with identical timestamps -> all scheduled at the same audio time in Part 5.2 comparator order | P0 | M-03, M-05 | Phase 04 | AT-R-E2.2-11 | Unimplemented |
| R-E2.2-12 | E 2.2 | Handle: dense chord -> every note scheduled in one pass; voices beyond capacity stolen per policy and counted | P0 | M-05, M-06 | Phase 04 | AT-R-E2.2-12 | Unimplemented |
| R-E2.2-13 | E 2.2 | Schedule on the audio clock, never by frame count; the renderer reads transport.positionAt(audio time) | P0 | M-04, M-05, M-18 | Phase 02 | AT-R-E2.2-13 | Unimplemented |
| R-E2.2-14 | E 2.2 | Define rules for pause, seek, loop and tempo change for active notes and future events (Part 6.4 tables) | P0 | M-04, M-05 | Phase 02 | AT-R-E2.2-14 | Unimplemented |
| R-E2.3-01 | E 2.3 | Handle: note-on without note-off -> note closed at track end (W-NOTE-UNMATCHED); 60 s voice cap | P0 | M-03, M-05 | Phase 04 | AT-R-E2.3-01 | Unimplemented |
| R-E2.3-02 | E 2.3 | Handle: note-off before its note-on -> orphan off dropped (W-NOTE-OFF-WITHOUT-ON); it never sounds | P0 | M-03 | Phase 02 | AT-R-E2.3-02 | Unimplemented |
| R-E2.3-03 | E 2.3 | Handle: same pitch retriggered before release -> the earlier voice of that track and pitch is released first | P0 | M-06 | Phase 04 | AT-R-E2.3-03 | Unimplemented |
| R-E2.3-04 | E 2.3 | Handle: overlapping notes, same pitch and channel -> both kept; earlier ends at the next on (W-NOTE-OVERLAP) | P0 | M-03 | Phase 02 | AT-R-E2.3-04 | Unimplemented |
| R-E2.3-05 | E 2.3 | Handle: sustain pedal never released -> notes end at track end; panic, stop and mode leave send CC 64 = 0 | P0 | M-03, M-06, M-08 | Phase 04 | AT-R-E2.3-05 | Unimplemented |
| R-E2.3-06 | E 2.3 | Handle: track ends while notes are active -> notes closed at the track end tick; voices released at song end | P0 | M-03, M-04, M-05 | Phase 04 | AT-R-E2.3-06 | Unimplemented |
| R-E2.3-07 | E 2.3 | Handle: program change while notes sustain -> sounding voices keep the old patch; later notes use the new one | P0 | M-06 | Phase 04 | AT-R-E2.3-07 | Unimplemented |
| R-E2.3-08 | E 2.3 | Handle: polyphony limit reached -> steal released-quietest, then oldest; stolen count shown in Diagnostics | P0 | M-05 | Phase 04 | AT-R-E2.3-08 | Unimplemented |
| R-E2.3-09 | E 2.3 | Handle: instrument changed while a note is held -> the held voice keeps its patch and ends on its note-off | P0 | M-06, M-08 | Phase 06 | AT-R-E2.3-09 | Unimplemented |
| R-E2.3-10 | E 2.3 | Deterministic voice cleanup: every voice has a scheduled stop and its nodes disconnect when it ends | P0 | M-05, M-06 | Phase 04 | AT-R-E2.3-10 | Unimplemented |
| R-E2.3-11 | E 2.3 | Note-release handling: every note-on ends by note-off, release-all, panic or the 60 s cap | P0 | M-06, M-08 | Phase 04 | AT-R-E2.3-11 | Unimplemented |
| R-E2.3-12 | E 2.3 | Sustain-pedal recovery: release-all and panic clear CC 64 and release every pedal-held voice | P0 | M-06, M-08 | Phase 04 | AT-R-E2.3-12 | Unimplemented |
| R-E2.3-13 | E 2.3 | Global panic: soft (30 ms release) and hard (graph rebuild); key KeyP, or Space while paused | P0 | M-05, M-07 | Phase 04 | AT-R-E2.3-13 | Unimplemented |
| R-E2.3-14 | E 2.3 | Panic leaves no voice or audio node running: FLM.Audio.nodeCount() back at baseline within 200 ms | P0 | M-05 | Phase 04 | AT-R-E2.3-14 | Unimplemented |

#### 15.2.3 E 3 MIDI and music-file edge cases

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E3-01 | E 3 | Treat parsing as data integrity: validate, bound, preserve and report every file; FT corpus per format | P0 | M-10, M-14 | Phase 07 | AT-R-E3-01 | Unimplemented |
| R-E3.1-01 | E 3.1 | Handle: SMF format 0 -> one Song; the single track is split into one Track per channel (W-MIDI-MULTI-CHANNEL) | P0 | M-10 | Phase 07 | AT-R-E3.1-01 | Unimplemented |
| R-E3.1-02 | E 3.1 | Handle: SMF format 1 -> one Song; all tracks share one merged tempo, meter and key map | P0 | M-03, M-10 | Phase 07 | AT-R-E3.1-02 | Unimplemented |
| R-E3.1-03 | E 3.1 | Handle: SMF format 2 -> one Song per sequence; user picks one (W-MIDI-FORMAT2); sequences never merged | P0 | M-10, M-14 | Phase 07 | AT-R-E3.1-03 | Unimplemented |
| R-E3.1-04 | E 3.1 | Handle: missing or invalid header -> import refused with E-IMP-003; current project untouched | P0 | M-10, M-14 | Phase 07 | AT-R-E3.1-04 | Unimplemented |
| R-E3.1-05 | E 3.1 | Handle: invalid track length -> chunk bounded by file end; events before the cut kept (W-MIDI-TRUNCATED) | P0 | M-10 | Phase 07 | AT-R-E3.1-05 | Unimplemented |
| R-E3.1-06 | E 3.1 | Handle: truncated variable-length quantity -> rest of that track skipped (W-MIDI-BAD-VLQ for an over-long quantity, W-MIDI-TRUNCATED for one cut by the end of the file); earlier events kept | P0 | M-10 | Phase 07 | AT-R-E3.1-06 | Unimplemented |
| R-E3.1-07 | E 3.1 | Handle: invalid status byte -> rest of that track skipped (W-MIDI-BAD-STATUS); other tracks kept | P0 | M-10 | Phase 07 | AT-R-E3.1-07 | Unimplemented |
| R-E3.1-08 | E 3.1 | Handle: missing end-of-track event -> the track ends at its last event (W-MIDI-NO-EOT) | P0 | M-10 | Phase 07 | AT-R-E3.1-08 | Unimplemented |
| R-E3.1-09 | E 3.1 | Handle: duplicate or conflicting metadata -> last value at a tick wins (W-MIDI-DUPLICATE-META) | P0 | M-10 | Phase 07 | AT-R-E3.1-09 | Unimplemented |
| R-E3.1-10 | E 3.1 | Handle: running status -> supported; sysex cancels it, a meta event does not (accepted, logged) | P0 | M-10 | Phase 07 | AT-R-E3.1-10 | Unimplemented |
| R-E3.1-11 | E 3.1 | Handle: empty track -> not materialized as a Track; listed in the InspectionReport | P0 | M-10, M-14 | Phase 07 | AT-R-E3.1-11 | Unimplemented |
| R-E3.1-12 | E 3.1 | Handle: track with metadata but no notes -> conductor data folded into song maps; text-only track kept | P0 | M-10 | Phase 07 | AT-R-E3.1-12 | Unimplemented |
| R-E3.1-13 | E 3.1 | Handle: huge event count -> refused above 1,000,000 events (E-IMP-004); parse aborted after 5 s (E-IMP-005) | P0 | M-10, M-14 | Phase 07 | AT-R-E3.1-13 | Unimplemented |
| R-E3.1-14 | E 3.1 | Handle: zero-duration notes -> kept with a 1-tick duration (W-NOTE-ZERO-DURATION) | P0 | M-03, M-10 | Phase 07 | AT-R-E3.1-14 | Unimplemented |
| R-E3.1-15 | E 3.1 | Handle: unmatched note-on and note-off -> ons closed at track end, orphan offs dropped, both warned | P0 | M-03, M-10 | Phase 07 | AT-R-E3.1-15 | Unimplemented |
| R-E3.1-16 | E 3.1 | Handle: note-on with velocity 0 -> treated as the matching note-off | P0 | M-10 | Phase 07 | AT-R-E3.1-16 | Unimplemented |
| R-E3.1-17 | E 3.1 | Handle: simultaneous identical pitches -> each kept as its own NoteEvent; LIFO pairing (W-NOTE-OVERLAP) | P0 | M-03, M-10 | Phase 07 | AT-R-E3.1-17 | Unimplemented |
| R-E3.1-18 | E 3.1 | Handle: equal timestamps in different tracks -> deterministic Part 5.2 order; file order kept within a tick | P0 | M-03, M-10 | Phase 07 | AT-R-E3.1-18 | Unimplemented |
| R-E3.1-19 | E 3.1 | Handle: unusual PPQ -> rescaled to 960 within half a tick (W-MIDI-TICK-ROUNDING); PPQ 0 refused | P0 | M-10 | Phase 07 | AT-R-E3.1-19 | Unimplemented |
| R-E3.1-20 | E 3.1 | Handle: SMPTE division -> converted through seconds onto a 120 BPM grid (W-MIDI-SMPTE); timing exact | P0 | M-10 | Phase 07 | AT-R-E3.1-20 | Unimplemented |
| R-E3.1-21 | E 3.1 | Validate the header and every chunk and event boundary against the file length before use | P0 | M-10 | Phase 07 | AT-R-E3.1-21 | Unimplemented |
| R-E3.1-22 | E 3.1 | Enforce resource limits: file 25 MB, 1,000,000 events, 128 tracks, 5 s parse budget | P0 | M-10, M-14 | Phase 07 | AT-R-E3.1-22 | Unimplemented |
| R-E3.1-23 | E 3.1 | Preserve valid event ordering: stable sort; same-tick events keep their source order | P0 | M-03, M-10 | Phase 07 | AT-R-E3.1-23 | Unimplemented |
| R-E3.1-24 | E 3.1 | Report malformed data as ImportWarning entries with code, severity, track and tick in the InspectionReport | P0 | M-10, M-14 | Phase 07 | AT-R-E3.1-24 | Unimplemented |
| R-E3.1-25 | E 3.1 | Check the SMF format field before interpreting; never treat every file as one synchronized song | P0 | M-10 | Phase 07 | AT-R-E3.1-25 | Unimplemented |
| R-E3.2-01 | E 3.2 | Handle: tempo not defined -> 120 BPM marked as assumed (W-MIDI-NO-TEMPO), never shown as a source fact | P0 | M-10, M-14 | Phase 07 | AT-R-E3.2-01 | Unimplemented |
| R-E3.2-02 | E 3.2 | Handle: many tempo changes -> all kept in the TempoMap up to 10,000 entries (W-MIDI-MAP-TRUNCATED beyond) | P0 | M-03, M-10 | Phase 07 | AT-R-E3.2-02 | Unimplemented |
| R-E3.2-03 | E 3.2 | Handle: time signature change mid-song -> MeterMap entry; bar and beat numbering follow it | P0 | M-03, M-10 | Phase 07 | AT-R-E3.2-03 | Unimplemented |
| R-E3.2-04 | E 3.2 | Handle: key signature change mid-song -> KeyMap entry used for note spelling; note data unchanged | P0 | M-02, M-03, M-10 | Phase 07 | AT-R-E3.2-04 | Unimplemented |
| R-E3.2-05 | E 3.2 | Handle: several program changes in a track -> first sets Track.program; the rest kept as ProgramEvents | P0 | M-06, M-10 | Phase 07 | AT-R-E3.2-05 | Unimplemented |
| R-E3.2-06 | E 3.2 | Handle: percussion on channel 10 -> isDrums; keys 35-81 map to the 12 drum voices, others to shakerMisc | P0 | M-06, M-10 | Phase 07 | AT-R-E3.2-06 | Unimplemented |
| R-E3.2-07 | E 3.2 | Handle: pitch bend or modulation during a note -> applied to sounding voices; bend range from RPN 0, default 2 | P0 | M-06, M-10 | Phase 07 | AT-R-E3.2-07 | Unimplemented |
| R-E3.2-08 | E 3.2 | Handle: sustain pedal lengthens notes -> CC 64 kept as events; derived sounding durations used for charts | P0 | M-03, M-08 | Phase 07 | AT-R-E3.2-08 | Unimplemented |
| R-E3.2-09 | E 3.2 | Handle: notes across bar lines -> one NoteEvent spanning the bars; never split at bar lines | P0 | M-03 | Phase 07 | AT-R-E3.2-09 | Unimplemented |
| R-E3.2-10 | E 3.2 | Handle: unusual velocities -> 1-127 kept exactly; above 127 clamped (W-NOTE-VELOCITY-CLAMP) | P0 | M-03, M-06 | Phase 07 | AT-R-E3.2-10 | Unimplemented |
| R-E3.2-11 | E 3.2 | Handle: note outside the instrument range -> source pitch kept; sound octave-shifted into range, logged once | P0 | M-06, M-08 | Phase 07 | AT-R-E3.2-11 | Unimplemented |
| R-E3.2-12 | E 3.2 | Handle: several instruments on one MIDI channel -> each Track keeps its own program and channel strip | P0 | M-05, M-10 | Phase 07 | AT-R-E3.2-12 | Unimplemented |
| R-E3.2-13 | E 3.2 | Handle: missing or duplicate track names -> generated "Track N (program)"; duplicates allowed, ids unique | P0 | M-10 | Phase 07 | AT-R-E3.2-13 | Unimplemented |
| R-E3.2-14 | E 3.2 | Handle: final event after the last note ends -> durationTicks covers the last event or end of track | P0 | M-03, M-10 | Phase 07 | AT-R-E3.2-14 | Unimplemented |
| R-E3.2-15 | E 3.2 | Keep original events in the Song separate from gameplay Charts; charts reference sourceEventIds only | P0 | M-03, M-08 | Phase 07 | AT-R-E3.2-15 | Unimplemented |
| R-E3.2-16 | E 3.2 | Missing metadata uses documented defaults (120 BPM, 4/4, C major, program 0) flagged as defaults | P0 | M-10, M-14 | Phase 07 | AT-R-E3.2-16 | Unimplemented |
| R-E3.3-01 | E 3.3 | Handle: compressed .mxl -> own ZIP reader (stored, deflate); rootfile from META-INF/container.xml | P1 | M-11, M-12 | Phase 12 | AT-R-E3.3-01 | Unimplemented |
| R-E3.3-02 | E 3.3 | Handle: multiple parts, voices or staves -> one Track per part; voices and staves merged; ties keyed per voice | P1 | M-12 | Phase 12 | AT-R-E3.3-02 | Unimplemented |
| R-E3.3-03 | E 3.3 | Handle: chords and ties across bar lines -> chord notes share an onset; a tie chain becomes one NoteEvent | P1 | M-12, M-13 | Phase 12 | AT-R-E3.3-03 | Unimplemented |
| R-E3.3-04 | E 3.3 | Handle: tuplets and unusual subdivisions -> exact ratio arithmetic, rounded to PPQ 960 within half a tick | P1 | M-12, M-13 | Phase 12 | AT-R-E3.3-04 | Unimplemented |
| R-E3.3-05 | E 3.3 | Handle: repeats and alternate endings -> expanded in play order; da capo and segno not expanded, warned | P1 | M-12, M-13 | Phase 12 | AT-R-E3.3-05 | Unimplemented |
| R-E3.3-06 | E 3.3 | Handle: transposing instruments -> sounding pitch from the transpose element (W-XML-TRANSPOSED) | P1 | M-12 | Phase 12 | AT-R-E3.3-06 | Unimplemented |
| R-E3.3-07 | E 3.3 | Handle: alternate tuning or capo -> pitch from tuning, fret and capo; tuning and capo kept on the track | P1 | M-13 | Phase 12 | AT-R-E3.3-07 | Unimplemented |
| R-E3.3-08 | E 3.3 | Handle: unsupported Guitar Pro effects -> mapped to bend, velocity or duration where defined, else warned | P1 | M-13 | Phase 12 | AT-R-E3.3-08 | Unimplemented |
| R-E3.3-09 | E 3.3 | Handle: unsupported version (GP1, GP2, GP6, GP7) -> identified and refused with the Part 1.5 wording | P1 | M-13, M-14 | Phase 12 | AT-R-E3.3-09 | Unimplemented |
| R-E3.3-10 | E 3.3 | Handle: notation lost in conversion -> InspectionReport lists each dropped notation feature with a count | P1 | M-12, M-14 | Phase 12 | AT-R-E3.3-10 | Unimplemented |
| R-E3.3-11 | E 3.3 | Handle: valid file with no playable events -> inspection states "no playable notes"; no chart offered | P1 | M-08, M-14 | Phase 12 | AT-R-E3.3-11 | Unimplemented |
| R-E3.3-12 | E 3.3 | Publish a compatibility matrix of versions and preserved features (M-14 data and docs/COMPATIBILITY.md) | P1 | M-14 | Phase 12 | AT-R-E3.3-12 | Unimplemented |
| R-E3.3-13 | E 3.3 | Never silently flatten unsupported notation: each dropped element yields a W-XML-* or W-GP-* warning | P1 | M-12, M-13 | Phase 12 | AT-R-E3.3-13 | Unimplemented |
| R-E3.3-14 | E 3.3 | Never discard instrument data: strings, tuning, capo and effect flags kept in track metadata | P1 | M-03, M-13 | Phase 12 | AT-R-E3.3-14 | Unimplemented |
| R-E3.3-15 | E 3.3 | Never claim universal Guitar Pro support: UI, About and docs name GP3, GP4 and GP5 only | P1 | M-14, M-27 | Phase 12 | AT-R-E3.3-15 | Unimplemented |
| R-E3.4-01 | E 3.4 | Handle: unsupported codec -> decode failure reported as E-IMP-008 naming the file type; project unchanged | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-E3.4-02 | E 3.4 | Handle: corrupted audio -> same E-IMP-008 path; no partial buffer is kept | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-E3.4-03 | E 3.4 | Handle: very long audio file -> refused above 2 h duration (E-IMP-004) | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-E3.4-04 | E 3.4 | Handle: very large decoded buffer -> refused above 192 MB decoded on desktop, 64 MB on mobile (E-IMP-004) | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-E3.4-05 | E 3.4 | Handle: variable bitrate audio -> duration taken from the decoded buffer, never from file headers | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-E3.4-06 | E 3.4 | Handle: leading silence -> never trimmed; the user aligns it with syncOffsetMs (-30,000 to 30,000 ms) | P2 | M-14, M-17 | Phase 12 | n/a | Unimplemented |
| R-E3.4-07 | E 3.4 | Handle: long fade-out -> song length covers the audio end plus offset; the tail is kept | P2 | M-03, M-14 | Phase 12 | n/a | Unimplemented |
| R-E3.4-08 | E 3.4 | Handle: no tempo or beat metadata -> 120 BPM grid labelled assumed; no beat detection is claimed | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-E3.4-09 | E 3.4 | Handle: audio and MIDI start offsets differ -> per-track syncOffsetMs applied at every start and seek | P2 | M-05, M-14 | Phase 12 | n/a | Unimplemented |
| R-E3.4-10 | E 3.4 | Audio and MIDI playback use one defined sync offset stored in the project (audioRef.syncOffsetMs) | P2 | M-14, M-15 | Phase 12 | n/a | Unimplemented |
| R-E3.4-11 | E 3.4 | Never derive note charts from audio; audio tracks are backing only and the UI says so (Part 1.5 wording) | P1 | M-08, M-14 | Phase 12 | AT-R-E3.4-11 | Unimplemented |

#### 15.2.4 E 4 Four-button input and scoring

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E4.1-01 | E 4.1 | Handle: two, three or four buttons pressed together -> each control has its own press and release lifecycle | P0 | M-07, M-09 | Phase 03 | AT-R-E4.1-01 | Unimplemented |
| R-E4.1-02 | E 4.1 | Handle: one button held while another is pressed -> lifecycles stay independent; no implied release | P0 | M-07 | Phase 03 | AT-R-E4.1-02 | Unimplemented |
| R-E4.1-03 | E 4.1 | Handle: key released after the window lost focus -> blur, hidden and pagehide release all; late keyup ignored | P0 | M-07 | Phase 03 | AT-R-E4.1-03 | Unimplemented |
| R-E4.1-04 | E 4.1 | Handle: key held through a pause -> Judge ignores input while paused; on resume unheld lanes count as released | P0 | M-07, M-09 | Phase 03 | AT-R-E4.1-04 | Unimplemented |
| R-E4.1-05 | E 4.1 | Handle: OS intercepts a shortcut -> lost keyup recovered by the blur release; modifier combos never bound | P0 | M-07 | Phase 03 | AT-R-E4.1-05 | Unimplemented |
| R-E4.1-06 | E 4.1 | Two players sharing one keyboard (local two-player mode) | P2 | M-07 | Phase 03 | n/a | Deferred |
| R-E4.1-07 | E 4.1 | Show the one-keyboard two-player unavailability text in SCR-Multiplayer and SCR-Help (Part 1.5 wording) | P1 | M-27 | Phase 13 | AT-R-E4.1-07 | Unimplemented |
| R-E4.1-08 | E 4.1 | Handle: duplicate pointer and touch events -> Pointer Events only; compat mouse and touch events ignored | P0 | M-07 | Phase 03 | AT-R-E4.1-08 | Unimplemented |
| R-E4.1-09 | E 4.1 | Handle: touch ends outside its button -> pointerup or pointercancel anywhere releases the owning control | P0 | M-07 | Phase 03 | AT-R-E4.1-09 | Unimplemented |
| R-E4.1-10 | E 4.1 | Handle: finger dragged from one button to another -> release of the first pad, press of the second | P0 | M-07 | Phase 03 | AT-R-E4.1-10 | Unimplemented |
| R-E4.1-11 | E 4.1 | Handle: rapid alternation between buttons -> no debounce; every distinct press is emitted and judged | P0 | M-07, M-09 | Phase 03 | AT-R-E4.1-11 | Unimplemented |
| R-E4.1-12 | E 4.1 | Handle: key repeat while held -> event.repeat ignored; a second keydown without keyup ignored | P0 | M-07 | Phase 03 | AT-R-E4.1-12 | Unimplemented |
| R-E4.1-13 | E 4.1 | Handle: input device disconnects mid-song -> its controls released at once; other sources continue | P0 | M-07 | Phase 03 | AT-R-E4.1-13 | Unimplemented |
| R-E4.1-14 | E 4.1 | Handle: calibration changed during a song -> applies to later inputs only; the run is marked not comparable | P0 | M-07, M-09 | Phase 03 | AT-R-E4.1-14 | Unimplemented |
| R-E4.1-15 | E 4.1 | Every physical press yields exactly one logical press and one logical release, in that order | P0 | M-07 | Phase 03 | AT-R-E4.1-15 | Unimplemented |
| R-E4.1-16 | E 4.1 | Suppress duplicates: a control already pressed ignores further presses from any source until released | P0 | M-07 | Phase 03 | AT-R-E4.1-16 | Unimplemented |
| R-E4.1-17 | E 4.1 | Recover held inputs on focus loss, cancel, pause, hidden page, mode leave or disconnect (source system) | P0 | M-07, M-28 | Phase 03 | AT-R-E4.1-17 | Unimplemented |
| R-E4.2-01 | E 4.2 | Handle: two target notes at one timestamp -> merged into one chord ChartNote (30-tick grouping tolerance) | P0 | M-08 | Phase 08 | AT-R-E4.2-01 | Unimplemented |
| R-E4.2-02 | E 4.2 | Handle: chord overlapping another chord -> lane masks per note; a hold ends before a new note in its lane | P0 | M-08 | Phase 08 | AT-R-E4.2-02 | Unimplemented |
| R-E4.2-03 | E 4.2 | Handle: target missed and later retried -> a miss is final; the later press is a stray | P0 | M-09 | Phase 03 | AT-R-E4.2-03 | Unimplemented |
| R-E4.2-04 | E 4.2 | Handle: input exactly on a judgment-window boundary -> inside the window (inclusive bound) | P0 | M-09 | Phase 03 | AT-R-E4.2-04 | Unimplemented |
| R-E4.2-05 | E 4.2 | Handle: input before the target is visible -> judged if inside the good window, else a stray | P0 | M-09 | Phase 03 | AT-R-E4.2-05 | Unimplemented |
| R-E4.2-06 | E 4.2 | Handle: press with no note expected -> stray: counted, no points, combo kept by default (strayPenalty none) | P0 | M-09 | Phase 03 | AT-R-E4.2-06 | Unimplemented |
| R-E4.2-07 | E 4.2 | Handle: note sustained across a scoring boundary -> head and tail judged once; credited to the head's section | P0 | M-09 | Phase 03 | AT-R-E4.2-07 | Unimplemented |
| R-E4.2-08 | E 4.2 | Handle: more simultaneous notes than lanes -> capped per difficulty; omitted notes play (W-IMP-CHART-OMITTED) | P0 | M-08 | Phase 08 | AT-R-E4.2-08 | Unimplemented |
| R-E4.2-09 | E 4.2 | Handle: scale mapping excludes a source note -> lane from the nearest scale degree; source pitch still sounds | P0 | M-08 | Phase 08 | AT-R-E4.2-09 | Unimplemented |
| R-E4.2-10 | E 4.2 | Handle: two source notes map to one button -> one ChartNote carrying both sourceEventIds and pitches | P0 | M-08 | Phase 08 | AT-R-E4.2-10 | Unimplemented |
| R-E4.2-11 | E 4.2 | Handle: difficulty changed during chart preparation -> stale generation discarded; latest settingsHash wins | P0 | M-08, M-27 | Phase 08 | AT-R-E4.2-11 | Unimplemented |
| R-E4.2-12 | E 4.2 | Handle: instrument changed during a song -> offered only on SCR-Pause; restarts the run with a new chart | P0 | M-27, M-28 | Phase 08 | AT-R-E4.2-12 | Unimplemented |
| R-E4.2-13 | E 4.2 | Define deterministic rules for chords, ambiguous mappings, misses, holds and unsupported chords; replay equal | P0 | M-08, M-09 | Phase 08 | AT-R-E4.2-13 | Unimplemented |
| R-E4.2-14 | E 4.2 | Never silently delete source notes: the Song stays intact; omitted counts shown in inspection and results | P0 | M-08, M-27 | Phase 08 | AT-R-E4.2-14 | Unimplemented |
| R-E4.2-15 | E 4.2 | Keep the full source arrangement audible and editable even when the chart mapping is lossy | P0 | M-05, M-08, M-17 | Phase 08 | AT-R-E4.2-15 | Unimplemented |

#### 15.2.5 E 5 Studio, recording, and project persistence

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E5.1-01 | E 5.1 | Handle: press before count-in ends -> presses in the last count-in beat clamp to tick 0; earlier ones dropped | P0 | M-17 | Phase 06 | AT-R-E5.1-01 | Unimplemented |
| R-E5.1-02 | E 5.1 | Handle: record while playback runs -> overdub without count-in; origin at the next beat boundary | P1 | M-17 | Phase 09 | AT-R-E5.1-02 | Unimplemented |
| R-E5.1-03 | E 5.1 | Handle: recording stops while notes are held -> held notes closed at the stop tick | P0 | M-17 | Phase 06 | AT-R-E5.1-03 | Unimplemented |
| R-E5.1-04 | E 5.1 | Handle: record over an existing take -> new take stored; commit Replace is undoable; the old take is kept | P0 | M-15, M-17 | Phase 09 | AT-R-E5.1-04 | Unimplemented |
| R-E5.1-05 | E 5.1 | Handle: two tracks recording at once -> one armed track at a time; arming another moves the arm | P1 | M-17 | Phase 09 | AT-R-E5.1-05 | Unimplemented |
| R-E5.1-06 | E 5.1 | Handle: audio suspended while recording -> recording stops; take kept with interrupted flag; toast shown | P0 | M-05, M-17 | Phase 06 | AT-R-E5.1-06 | Unimplemented |
| R-E5.1-07 | E 5.1 | Handle: tempo change during recording -> refused ("Stop recording to change the tempo"); tempoAtRecord kept | P0 | M-17 | Phase 09 | AT-R-E5.1-07 | Unimplemented |
| R-E5.1-08 | E 5.1 | Handle: many simultaneous notes recorded -> capture is not limited by voice polyphony; every note stored | P0 | M-17 | Phase 06 | AT-R-E5.1-08 | Unimplemented |
| R-E5.1-09 | E 5.1 | Handle: recording exceeds memory -> auto-stop at 100,000 notes with a toast; the take is kept | P0 | M-17 | Phase 06 | AT-R-E5.1-09 | Unimplemented |
| R-E5.1-10 | E 5.1 | Handle: user navigates away before saving -> DLG-UnsavedChanges; autosave checkpoint offered on next open | P0 | M-16, M-17, M-28 | Phase 09 | AT-R-E5.1-10 | Unimplemented |
| R-E5.1-11 | E 5.1 | Time origin: take tick 0 is the transport tick at count-in end, or the punch-in position | P0 | M-04, M-17 | Phase 06 | AT-R-E5.1-11 | Unimplemented |
| R-E5.1-12 | E 5.1 | Track assignment: a take belongs to its armed track; a locked imported track is forked first | P0 | M-15, M-17 | Phase 09 | AT-R-E5.1-12 | Unimplemented |
| R-E5.1-13 | E 5.1 | Note-release policy: notes held at stop, abort or interruption close at that tick | P0 | M-17 | Phase 06 | AT-R-E5.1-13 | Unimplemented |
| R-E5.1-14 | E 5.1 | Interrupted recording never alters saved takes: takes are append-only until commit | P0 | M-15, M-17 | Phase 09 | AT-R-E5.1-14 | Unimplemented |
| R-E5.2-01 | E 5.2 | Handle: track used by an active recording is deleted -> recorder aborted, voices released, delete undoable | P0 | M-05, M-17 | Phase 09 | AT-R-E5.2-01 | Unimplemented |
| R-E5.2-02 | E 5.2 | Handle: track muted while a note sustains -> strip gain ramps to 0 in 5 ms; the voice ends silently | P1 | M-05, M-17 | Phase 09 | AT-R-E5.2-02 | Unimplemented |
| R-E5.2-03 | E 5.2 | Handle: solo while another track is soloed -> solo set: both soloed; clearing the last empties the set | P1 | M-05, M-17 | Phase 09 | AT-R-E5.2-03 | Unimplemented |
| R-E5.2-04 | E 5.2 | Handle: several tracks clip together -> master limiter protects the output; peak meter shows clip | P1 | M-05 | Phase 09 | AT-R-E5.2-04 | Unimplemented |
| R-E5.2-05 | E 5.2 | Handle: volume or pan changed during playback -> ramped change without clicks; undo entries coalesced | P1 | M-05, M-17 | Phase 09 | AT-R-E5.2-05 | Unimplemented |
| R-E5.2-06 | E 5.2 | Handle: undo invoked repeatedly -> stops at an empty stack; the stack holds 100 commands, oldest dropped | P0 | M-15 | Phase 09 | AT-R-E5.2-06 | Unimplemented |
| R-E5.2-07 | E 5.2 | Handle: redo after a new edit -> the redo list is cleared by any new command | P0 | M-15 | Phase 09 | AT-R-E5.2-07 | Unimplemented |
| R-E5.2-08 | E 5.2 | Handle: track content moved past the song end -> durationTicks recomputed from the last event end | P1 | M-03, M-17 | Phase 09 | AT-R-E5.2-08 | Unimplemented |
| R-E5.2-09 | E 5.2 | Handle: quantize would cross a bar -> notes kept inside their bar unless allowBarCross is set | P1 | M-15, M-17 | Phase 09 | AT-R-E5.2-09 | Unimplemented |
| R-E5.2-10 | E 5.2 | Handle: instrument missing from the sound bank -> all 128 GM programs synthesized; unknown banks use bank 0 | P1 | M-06 | Phase 09 | AT-R-E5.2-10 | Unimplemented |
| R-E5.2-11 | E 5.2 | Every edit leaves a project that passes FLM.Project.validate; an invalid command is refused unchanged | P0 | M-15 | Phase 09 | AT-R-E5.2-11 | Unimplemented |
| R-E5.2-12 | E 5.2 | Undo and redo restore events and track configuration (name, program, mix) together | P0 | M-15 | Phase 09 | AT-R-E5.2-12 | Unimplemented |
| R-E5.3-01 | E 5.3 | Handle: quota exceeded -> DLG-SaveFailed with Export and Manage projects; live record and .bak untouched | P0 | M-16 | Phase 09 | AT-R-E5.3-01 | Unimplemented |
| R-E5.3-02 | E 5.3 | Handle: interrupted write -> temp record verified by read-back hash; leftover .tmp keys removed at init | P0 | M-16 | Phase 09 | AT-R-E5.3-02 | Unimplemented |
| R-E5.3-03 | E 5.3 | Handle: browser closes during a save -> the previous copy or .bak survives; checkpoint restore offered | P0 | M-16 | Phase 09 | AT-R-E5.3-03 | Unimplemented |
| R-E5.3-04 | E 5.3 | Handle: missing audio reference -> project opens; the audio track is marked "re-import audio" and is silent | P0 | M-14, M-15 | Phase 09 | AT-R-E5.3-04 | Unimplemented |
| R-E5.3-05 | E 5.3 | Handle: older schema version -> stepwise migration to version 1 (Part 5.7); pre-migration copy kept as .bak | P0 | M-15 | Phase 09 | AT-R-E5.3-05 | Unimplemented |
| R-E5.3-06 | E 5.3 | Handle: unknown fields -> preserved unchanged through load and save | P0 | M-15 | Phase 09 | AT-R-E5.3-06 | Unimplemented |
| R-E5.3-07 | E 5.3 | Handle: partially corrupted project -> E-PRJ or E-STO-003 reported; "Open backup" offered; live data untouched | P0 | M-15, M-16 | Phase 09 | AT-R-E5.3-07 | Unimplemented |
| R-E5.3-08 | E 5.3 | Handle: same project opened twice in one tab -> the open Session is reused; no second Session | P0 | M-17, M-27 | Phase 09 | AT-R-E5.3-08 | Unimplemented |
| R-E5.3-09 | E 5.3 | Handle: two tabs edit one project -> lock with heartbeat; second tab read-only with Take over; stale at 45 s | P0 | M-16 | Phase 09 | AT-R-E5.3-09 | Unimplemented |
| R-E5.3-10 | E 5.3 | Handle: project renamed or moved -> identity is the id; import of an existing id shows DLG-ImportReplace | P0 | M-15, M-16 | Phase 09 | AT-R-E5.3-10 | Unimplemented |
| R-E5.3-11 | E 5.3 | Handle: overwrite with an older or incomplete copy -> revision check, DLG-SaveConflict; invalid docs refused | P0 | M-15, M-16 | Phase 09 | AT-R-E5.3-11 | Unimplemented |
| R-E5.3-12 | E 5.3 | Handle: large recordings or assets -> IndexedDB above 2 MB or with recordings; else DLG-ProjectTooLarge | P0 | M-16 | Phase 09 | AT-R-E5.3-12 | Unimplemented |
| R-E5.3-13 | E 5.3 | Use validated, versioned serialization: format flm-project version 1, validated on every save and load | P0 | M-15 | Phase 09 | AT-R-E5.3-13 | Unimplemented |
| R-E5.3-14 | E 5.3 | Replace safely: write a temp copy, verify by read-back, swap, keep one .bak | P0 | M-16 | Phase 09 | AT-R-E5.3-14 | Unimplemented |
| R-E5.3-15 | E 5.3 | Never assume storage is permanent or unlimited: request persist() where offered; quota warning at 80 % | P0 | M-16 | Phase 09 | AT-R-E5.3-15 | Unimplemented |
| R-E5.3-16 | E 5.3 | Provide explicit export (.flm.json) and recovery paths (Open backup, autosave checkpoints) | P0 | M-16, M-27 | Phase 09 | AT-R-E5.3-16 | Unimplemented |

#### 15.2.6 E 6 3D visualization and avatars

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E6.1-01 | E 6.1 | Handle: many notes at once -> controllers aggregate per frame; chord size widens the gesture; cost bounded | P0 | M-20 | Phase 05 | AT-R-E6.1-01 | Unimplemented |
| R-E6.1-02 | E 6.1 | Handle: musician changes instrument mid-song -> controller and prop follow the program change at its tick | P0 | M-20, M-21 | Phase 05 | AT-R-E6.1-02 | Unimplemented |
| R-E6.1-03 | E 6.1 | Handle: long rests -> idle pose after one bar of rest; 120 ms anticipation before the next note | P0 | M-20 | Phase 05 | AT-R-E6.1-03 | Unimplemented |
| R-E6.1-04 | E 6.1 | Handle: extremely short notes -> each gesture lasts at least 80 ms; no note is skipped visually | P0 | M-20 | Phase 05 | AT-R-E6.1-04 | Unimplemented |
| R-E6.1-05 | E 6.1 | Handle: notes sustained for several measures -> sustain pose for the whole duration; release at note end | P0 | M-20 | Phase 05 | AT-R-E6.1-05 | Unimplemented |
| R-E6.1-06 | E 6.1 | Handle: camera switch during animation -> poses independent of the camera; a cut never resets controllers | P0 | M-20, M-21 | Phase 05 | AT-R-E6.1-06 | Unimplemented |
| R-E6.1-07 | E 6.1 | Handle: musician hidden or moved offstage -> controller state still advances; only drawing is skipped | P0 | M-20, M-21 | Phase 05 | AT-R-E6.1-07 | Unimplemented |
| R-E6.1-08 | E 6.1 | Handle: instrument without a matching humanoid rig -> abstract visualizer drawn for that track | P0 | M-20 | Phase 05 | AT-R-E6.1-08 | Unimplemented |
| R-E6.1-09 | E 6.1 | Handle: instrument attachment point missing -> validateAttachments uses the default hand point, logged | P0 | M-19 | Phase 05 | AT-R-E6.1-09 | Unimplemented |
| R-E6.1-10 | E 6.1 | Handle: customization changes body proportions -> rig lengths reset; two-bone IK re-targets the instrument | P0 | M-19, M-22 | Phase 10 | AT-R-E6.1-10 | Unimplemented |
| R-E6.1-11 | E 6.1 | Handle: animation events out of order -> buffered by audio time; late events applied without anticipation | P0 | M-20 | Phase 05 | AT-R-E6.1-11 | Unimplemented |
| R-E6.1-12 | E 6.1 | Handle: renderer drops frames -> poses evaluated at the current transport position; no catch-up replay | P0 | M-20 | Phase 05 | AT-R-E6.1-12 | Unimplemented |
| R-E6.1-13 | E 6.1 | Derive animation from musical state and event timestamps, never from the number of frames rendered | P0 | M-20 | Phase 05 | AT-R-E6.1-13 | Unimplemented |
| R-E6.1-14 | E 6.1 | Keep abstract visualization available whenever instrument-specific humanoid animation is unavailable | P0 | M-20, M-21 | Phase 05 | AT-R-E6.1-14 | Unimplemented |
| R-E6.2-01 | E 6.2 | Handle: WebGL initialization fails -> WebGL2, then WebGL1, then the Abstract 2D tier on canvas#flat | P0 | M-18 | Phase 05 | AT-R-E6.2-01 | Unimplemented |
| R-E6.2-02 | E 6.2 | Handle: GPU resources exhausted -> GL out-of-memory drops one tier and frees textures | P1 | M-18 | Phase 05 | AT-R-E6.2-02 | Unimplemented |
| R-E6.2-03 | E 6.2 | Handle: target frame rate not sustained -> auto-downgrade when p95 frame time > 33 ms over 5 s; toast shown | P1 | M-18 | Phase 14 | AT-R-E6.2-03 | Unimplemented |
| R-E6.2-04 | E 6.2 | Handle: graphics context lost -> restore within 3 s rebuilds resources, else Abstract tier; audio continues | P0 | M-18 | Phase 05 | AT-R-E6.2-04 | Unimplemented |
| R-E6.2-05 | E 6.2 | Handle: model or texture fails to load -> no external assets; a failed generated texture uses a flat color | P1 | M-18 | Phase 05 | AT-R-E6.2-05 | Unimplemented |
| R-E6.2-06 | E 6.2 | Handle: large scene memory -> at most 5 performers, shared geometry; within 300 MB desktop, 150 MB mobile | P1 | M-18, M-21 | Phase 14 | AT-R-E6.2-06 | Unimplemented |
| R-E6.2-07 | E 6.2 | Handle: repeated scene switches -> dispose on leave; memory growth <= 10 MB after 20 enter/leave cycles | P0 | M-18, M-28 | Phase 05 | AT-R-E6.2-07 | Unimplemented |
| R-E6.2-08 | E 6.2 | Handle: character customized during playback -> mesh rebuilt on the next frame; transport and audio unaffected | P1 | M-19, M-22 | Phase 10 | AT-R-E6.2-08 | Unimplemented |
| R-E6.2-09 | E 6.2 | Handle: orientation change mid-song -> canvas, highway and pads re-laid out in one frame; touches released | P1 | M-18, M-26 | Phase 05 | AT-R-E6.2-09 | Unimplemented |
| R-E6.2-10 | E 6.2 | Release unused GPU resources on tier change, scene change and mode leave (counted by assertClean) | P0 | M-18, M-28 | Phase 05 | AT-R-E6.2-10 | Unimplemented |
| R-E6.2-11 | E 6.2 | Support reduced rendering quality: High, Balanced, Low and Abstract tiers selectable in Settings | P1 | M-18 | Phase 05 | AT-R-E6.2-11 | Unimplemented |
| R-E6.2-12 | E 6.2 | Provide a fallback visualization: the Abstract 2D tier keeps the note highway and visualizers | P0 | M-18, M-21 | Phase 05 | AT-R-E6.2-12 | Unimplemented |
| R-E6.2-13 | E 6.2 | A graphics failure never corrupts the audio timeline or the saved project | P0 | M-18, M-28 | Phase 05 | AT-R-E6.2-13 | Unimplemented |

#### 15.2.7 E 7 Dance mode

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E7-01 | E 7 | Handle: two steps at once -> one jump step judged as a chord; capped by MAX_SIMULTANEOUS (DANCE-TOO-MANY) | P1 | M-23 | Phase 11 | AT-R-E7-01 | Unimplemented |
| R-E7-02 | E 7 | Handle: hold across pause and resume -> hold kept; on resume unheld lanes count as released (shared Judge) | P1 | M-09, M-23 | Phase 11 | AT-R-E7-02 | Unimplemented |
| R-E7-03 | E 7 | Handle: unsupported step type in an imported chart -> step dropped with DANCE-UNSUPPORTED-STEP, counted | P1 | M-23 | Phase 11 | AT-R-E7-03 | Unimplemented |
| R-E7-04 | E 7 | Handle: tempo change during a dance -> steps in ticks via the TempoMap; scroll speed constant in seconds | P1 | M-21, M-23 | Phase 11 | AT-R-E7-04 | Unimplemented |
| R-E7-05 | E 7 | Handle: difficulty change after generation -> only while stopped; chart regenerated and rebound; no mixing | P1 | M-23, M-27 | Phase 11 | AT-R-E7-05 | Unimplemented |
| R-E7-06 | E 7 | Handle: touch active while the page is interrupted -> release-all on hidden or pagehide; auto-pause | P1 | M-07, M-28 | Phase 11 | AT-R-E7-06 | Unimplemented |
| R-E7-07 | E 7 | Handle: choreography unavailable -> HUD note "Dancer animation unavailable"; scoring and input unchanged | P1 | M-20, M-23 | Phase 11 | AT-R-E7-07 | Unimplemented |
| R-E7-08 | E 7 | Handle: chart and audio start offsets differ -> steps use song ticks; audio tracks apply syncOffsetMs | P1 | M-14, M-23 | Phase 11 | AT-R-E7-08 | Unimplemented |
| R-E7-09 | E 7 | Handle: overlapping or contradictory steps -> validation merges duplicates and shortens holds, else rejects | P1 | M-23 | Phase 11 | AT-R-E7-09 | Unimplemented |
| R-E7-10 | E 7 | Handle: many consecutive misses -> combo resets; song ends early only with the life bar on; hint at 8 misses | P1 | M-23 | Phase 11 | AT-R-E7-10 | Unimplemented |
| R-E7-11 | E 7 | Dance charts use the shared Transport and TempoMap; there is no separate dance clock | P1 | M-04, M-23 | Phase 11 | AT-R-E7-11 | Unimplemented |
| R-E7-12 | E 7 | Missing choreography never disables dance scoring or step input | P1 | M-23 | Phase 11 | AT-R-E7-12 | Unimplemented |
| R-E7-13 | E 7 | Chart validation rejects or explicitly resolves each contradictory event and reports which rule applied | P1 | M-23 | Phase 11 | AT-R-E7-13 | Unimplemented |

#### 15.2.8 E 8 Multiplayer

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E8-01 | E 8 | Treat multiplayer as a separate distributed system with its own UT, IT, FI and XT tests and operating rules | P1 | M-24 | Phase 13 | AT-R-E8-01 | Unimplemented |
| R-E8.1-01 | E 8.1 | Handle: two users join at once -> each slot has its own invite and connection; slots fill in hello order | P1 | M-24 | Phase 13 | AT-R-E8.1-01 | Unimplemented |
| R-E8.1-02 | E 8.1 | Handle: room full -> 4 players maximum; no further invites; relay join refused with "Room is full" | P1 | M-24 | Phase 13 | AT-R-E8.1-02 | Unimplemented |
| R-E8.1-03 | E 8.1 | Handle: invalid room or invite code -> decoding fails; "This code is not valid"; no connection attempted | P1 | M-24 | Phase 13 | AT-R-E8.1-03 | Unimplemented |
| R-E8.1-04 | E 8.1 | Handle: host leaves before the song starts -> session ends; guests return to create-or-join with a message | P1 | M-24, M-27 | Phase 13 | AT-R-E8.1-04 | Unimplemented |
| R-E8.1-05 | E 8.1 | Handle: host disconnects during a song -> session ends for all with results so far (Part 1.5 wording) | P1 | M-24, M-27 | Phase 13 | AT-R-E8.1-05 | Unimplemented |
| R-E8.1-06 | E 8.1 | Host migration so a session continues after the host leaves | P2 | M-24 | Phase 13 | n/a | Deferred |
| R-E8.1-07 | E 8.1 | Handle: player joins after the start -> waits in the lobby until the song ends (Part 1.5 wording) | P1 | M-24, M-27 | Phase 13 | AT-R-E8.1-07 | Unimplemented |
| R-E8.1-08 | E 8.1 | Late join into a song in progress with chart and position catch-up | P2 | M-24 | Phase 13 | n/a | Deferred |
| R-E8.1-09 | E 8.1 | Handle: reconnect with stale state -> host sends full roomState and position; guest replaces its view | P1 | M-24 | Phase 13 | AT-R-E8.1-09 | Unimplemented |
| R-E8.1-10 | E 8.1 | Handle: same player joins twice -> the same resumeToken replaces the older connection | P1 | M-24 | Phase 13 | AT-R-E8.1-10 | Unimplemented |
| R-E8.1-11 | E 8.1 | Handle: room expires while a player reconnects -> 60 s window, then slot freed; guest sees session ended | P1 | M-24 | Phase 13 | AT-R-E8.1-11 | Unimplemented |
| R-E8.1-12 | E 8.1 | Handle: relay server restarts in a session -> DLG-NetError; back to create-or-join; local results kept | P2 | M-24 | Phase 13 | n/a | Unimplemented |
| R-E8.2-01 | E 8.2 | Handle: latency rises sharply -> inputs judged by shared-time stamps, not arrival; sync quality shown | P1 | M-09, M-24 | Phase 13 | AT-R-E8.2-01 | Unimplemented |
| R-E8.2-02 | E 8.2 | Handle: packets out of order -> seq must increase; older messages dropped; roomState resync requested | P1 | M-24 | Phase 13 | AT-R-E8.2-02 | Unimplemented |
| R-E8.2-03 | E 8.2 | Handle: duplicate input messages -> dropped by sender id and iSeq | P1 | M-24 | Phase 13 | AT-R-E8.2-03 | Unimplemented |
| R-E8.2-04 | E 8.2 | Handle: very different clock offset -> median of 8 ping-pong samples; shared time is the host audio clock | P1 | M-24 | Phase 13 | AT-R-E8.2-04 | Unimplemented |
| R-E8.2-05 | E 8.2 | Handle: pause arrives after a resume -> a lower stateSeq is ignored | P1 | M-24 | Phase 13 | AT-R-E8.2-05 | Unimplemented |
| R-E8.2-06 | E 8.2 | Handle: late message for an old position -> tShared outside position +/- 2 s dropped and counted | P1 | M-24 | Phase 13 | AT-R-E8.2-06 | Unimplemented |
| R-E8.2-07 | E 8.2 | Handle: players at different frame rates -> timing from audio clocks only; frame rate has no effect | P1 | M-04, M-24 | Phase 13 | AT-R-E8.2-07 | Unimplemented |
| R-E8.2-08 | E 8.2 | Handle: different chart versions -> settingsHash must match the host; E-NET-005 and the host re-sends | P1 | M-08, M-24 | Phase 13 | AT-R-E8.2-08 | Unimplemented |
| R-E8.2-09 | E 8.2 | Handle: different audio output latency -> each player's calibration applies; judgeOffsetMs sent with ready | P1 | M-09, M-24 | Phase 13 | AT-R-E8.2-09 | Unimplemented |
| R-E8.2-10 | E 8.2 | Handle: host changes tempo or seeks in a session -> disabled while playing; allowed only in the lobby | P1 | M-24, M-27 | Phase 13 | AT-R-E8.2-10 | Unimplemented |
| R-E8.2-11 | E 8.2 | Server authority: the host decides room state, start, pause, resume and scores | P1 | M-24 | Phase 13 | AT-R-E8.2-11 | Unimplemented |
| R-E8.2-12 | E 8.2 | Session versioning: protocol 1 checked in hello; stateSeq increases on every state change | P1 | M-24 | Phase 13 | AT-R-E8.2-12 | Unimplemented |
| R-E8.2-13 | E 8.2 | Clock-offset estimation: 8 samples at start, then 1 every 10 s; target sync error <= 20 ms | P1 | M-24 | Phase 13 | AT-R-E8.2-13 | Unimplemented |
| R-E8.2-14 | E 8.2 | Message ordering and duplicate suppression by per-peer seq and iSeq | P1 | M-24 | Phase 13 | AT-R-E8.2-14 | Unimplemented |
| R-E8.2-15 | E 8.2 | Late-event handling: inputs outside the 2 s window dropped; start set at least 1 s ahead in shared time | P1 | M-24 | Phase 13 | AT-R-E8.2-15 | Unimplemented |
| R-E8.2-16 | E 8.2 | Never use message arrival time as the musical timing authority; every timed action carries shared time | P1 | M-24 | Phase 13 | AT-R-E8.2-16 | Unimplemented |
| R-E8.3-01 | E 8.3 | Handle: client submits impossible scores -> guests never send scores; the host scores validated inputs | P1 | M-09, M-24 | Phase 13 | AT-R-E8.3-01 | Unimplemented |
| R-E8.3-02 | E 8.3 | Handle: malformed messages -> strict validation; dropped and counted; 20 invalid in 10 s disconnects | P1 | M-24 | Phase 13 | AT-R-E8.3-02 | Unimplemented |
| R-E8.3-03 | E 8.3 | Handle: input flood -> 60 messages/s per peer; excess dropped (input first) and counted | P1 | M-24 | Phase 13 | AT-R-E8.3-03 | Unimplemented |
| R-E8.3-04 | E 8.3 | Handle: join without authorization -> invite codes single-use per slot; relay joins need the host's Admit | P1 | M-24 | Phase 13 | AT-R-E8.3-04 | Unimplemented |
| R-E8.3-05 | E 8.3 | Handle: oversized avatar or project payload -> message over 64 KB or avatar over 4 KB dropped before parse | P1 | M-22, M-24 | Phase 13 | AT-R-E8.3-05 | Unimplemented |
| R-E8.3-06 | E 8.3 | Handle: player alters the local clock -> timing from audio clocks and ping offsets; Date.now never used | P1 | M-24 | Phase 13 | AT-R-E8.3-06 | Unimplemented |
| R-E8.3-07 | E 8.3 | Handle: events for a song that is not active -> songId or stateSeq mismatch dropped | P1 | M-24 | Phase 13 | AT-R-E8.3-07 | Unimplemented |
| R-E8.3-08 | E 8.3 | Handle: repeated reconnection attempts -> at most 3 reconnects per player per 5 min; then the slot is closed | P1 | M-24 | Phase 13 | AT-R-E8.3-08 | Unimplemented |
| R-E8.3-09 | E 8.3 | Validate session state per message type: lobby-only types refused while a song is playing | P1 | M-24 | Phase 13 | AT-R-E8.3-09 | Unimplemented |
| R-E8.3-10 | E 8.3 | Apply rate and size limits: 60 messages/s per peer, 64 KB per message | P1 | M-24 | Phase 13 | AT-R-E8.3-10 | Unimplemented |
| R-E8.3-11 | E 8.3 | Authoritative scores are the host's scoreUpdate values; results screens show host scores | P1 | M-24, M-27 | Phase 13 | AT-R-E8.3-11 | Unimplemented |
| R-E8.3-12 | E 8.3 | The client and the relay contain no private server credentials or secrets | P1 | M-24 | Phase 13 | AT-R-E8.3-12 | Unimplemented |

#### 15.2.9 E 9 Single-HTML-file and browser edge cases

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E9-01 | E 9 | Handle: HTML opened from a file:// URL -> every core feature works from file:// | P0 | M-29 | Phase 01 | AT-R-E9-01 | Unimplemented |
| R-E9-02 | E 9 | Handle: served over HTTP or HTTPS -> identical behavior; secure-context features enabled where available | P0 | M-01, M-29 | Phase 01 | AT-R-E9-02 | Unimplemented |
| R-E9-03 | E 9 | Handle: external dependency unavailable -> none at runtime; build fails on a remote script or style reference | P0 | M-01 | Phase 01 | AT-R-E9-03 | Unimplemented |
| R-E9-04 | E 9 | Handle: offline on first launch -> every local mode works offline; only STUN and relay need a network | P0 | M-29 | Phase 01 | AT-R-E9-04 | Unimplemented |
| R-E9-05 | E 9 | Handle: CDN blocks or changes a dependency -> no CDN is ever used (ADR-02) | P0 | M-01 | Phase 01 | AT-R-E9-05 | Unimplemented |
| R-E9-06 | E 9 | Handle: external resource incompatible with the browser -> none loaded; browser APIs gated by Caps checks | P0 | M-01 | Phase 01 | AT-R-E9-06 | Unimplemented |
| R-E9-07 | E 9 | Handle: HTML beyond practical size -> build warns above 1.5 MB and fails above 2.5 MB | P0 | none | Phase 01 | AT-R-E9-07 | Unimplemented |
| R-E9-08 | E 9 | Handle: embedded content slows startup -> content generated lazily; menu <= 1.5 s desktop, <= 3.0 s mobile | P0 | M-29, M-30 | Phase 14 | AT-R-E9-08 | Unimplemented |
| R-E9-09 | E 9 | Handle: browser refuses local file access -> no fetch or XHR of local files; imports via picker or drop only | P0 | M-16 | Phase 07 | AT-R-E9-09 | Unimplemented |
| R-E9-10 | E 9 | Handle: feature needs a secure context -> Web MIDI and clipboard gated by Caps; disabled with a reason | P0 | M-01, M-07 | Phase 01 | AT-R-E9-10 | Unimplemented |
| R-E9-11 | E 9 | Handle: feature needs server headers -> none used (no SharedArrayBuffer, COOP or COEP); stated in docs | P0 | M-01 | Phase 01 | AT-R-E9-11 | Unimplemented |
| R-E9-12 | E 9 | Handle: storage differs under file:// -> probed at boot; localOnly or memory mode with a visible notice | P0 | M-01, M-16 | Phase 09 | AT-R-E9-12 | Unimplemented |
| R-E9-13 | E 9 | Handle: file import blocked by the browser -> drag and drop onto #app offered with a hint | P0 | M-16, M-27 | Phase 07 | AT-R-E9-13 | Unimplemented |
| R-E9-14 | E 9 | Handle: mobile browser suspends the page -> auto-pause, release inputs, checkpoint when safe | P0 | M-07, M-28 | Phase 01 | AT-R-E9-14 | Unimplemented |
| R-E9-15 | E 9 | Handle: required graphics feature missing -> WebGL1 or Abstract tier; menus and audio unaffected | P0 | M-18 | Phase 05 | AT-R-E9-15 | Unimplemented |
| R-E9-16 | E 9 | Test the delivered FingerLickinMusic.html in every claimed browser from file:// and http:// (XT tests) | P0 | M-31 | Phase 15 | AT-R-E9-16 | Unimplemented |
| R-E9-17 | E 9 | Separate standalone core from features needing HTTPS, permissions, external services or a server in About | P0 | M-27 | Phase 01 | AT-R-E9-17 | Unimplemented |
| R-E9-18 | E 9 | Web MIDI stays optional; four-button play never depends on it or on a secure context | P0 | M-07 | Phase 03 | AT-R-E9-18 | Unimplemented |

#### 15.2.10 E 10 Prohibited architecture mistakes

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E10-01 | E 10 | No single global state object: each module owns its state (Part 4.6 separation rules, review check) | P0 | M-01, M-28 | Phase 01 | AT-R-E10-01 | Unimplemented |
| R-E10-02 | E 10 | Never use rendering time as musical time | P0 | M-04, M-18, M-20 | Phase 02 | AT-R-E10-02 | Unimplemented |
| R-E10-03 | E 10 | Treat MIDI as event data sounded by the synthesizer, never as audio | P0 | M-03, M-06 | Phase 04 | AT-R-E10-03 | Unimplemented |
| R-E10-04 | E 10 | Never treat an instrument as monophonic; chords and overlapping notes are kept and sounded | P0 | M-03, M-05, M-06 | Phase 04 | AT-R-E10-04 | Unimplemented |
| R-E10-05 | E 10 | Use per-instrument animation controllers, not one generic animation for every instrument | P0 | M-20 | Phase 05 | AT-R-E10-05 | Unimplemented |
| R-E10-06 | E 10 | Keep four-button mapping explicit and configurable: profiles A-F, difficulty, visible omissions | P0 | M-08 | Phase 03 | AT-R-E10-06 | Unimplemented |
| R-E10-07 | E 10 | Browser storage is never the only backup: export offered on save, on save failure and in the Library | P0 | M-16, M-27 | Phase 09 | AT-R-E10-07 | Unimplemented |
| R-E10-08 | E 10 | Fix the multiplayer timeline protocol (Part 5.16) before any multiplayer code is written | P1 | M-24 | Phase 00 | AT-R-E10-08 | Unimplemented |
| R-E10-09 | E 10 | Never load all assets at startup; charts, patches and stage meshes are built on demand | P0 | M-29, M-30 | Phase 01 | AT-R-E10-09 | Unimplemented |
| R-E10-10 | E 10 | No dependency without a packaging strategy: zero runtime dependencies; the build inlines all code | P0 | M-01 | Phase 01 | AT-R-E10-10 | Unimplemented |
| R-E10-11 | E 10 | Never claim full format support from one sample; the corpus covers each format and version first | P0 | M-14 | Phase 12 | AT-R-E10-11 | Unimplemented |
| R-E10-12 | E 10 | UI completion is not feature completion: Implemented only after functional and AT tests pass | P0 | M-31 | Phase 01 | AT-R-E10-12 | Unimplemented |
| R-E10-13 | E 10 | Clean up on mode transitions: notes, timers, loops, listeners, connections (FLM.Modes.assertClean) | P0 | M-28 | Phase 01 | AT-R-E10-13 | Unimplemented |
| R-E10-14 | E 10 | Never degrade fidelity silently: synthesized sound, tier drops and fallbacks are shown and documented | P0 | M-05, M-18, M-27 | Phase 04 | AT-R-E10-14 | Unimplemented |
| R-E10-15 | E 10 | Validate incrementally: each gate runs its self-test groups before the next subsystem starts | P0 | M-31 | Phase 01 | AT-R-E10-15 | Unimplemented |

#### 15.2.11 E 11 Mandatory failure-recovery rules

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E11-01 | E 11 | Every subsystem defines what can fail before implementation (Part 6 error tables) | P0 | M-01 to M-31 | Phase 00 | AT-R-E11-01 | Unimplemented |
| R-E11-02 | E 11 | Every subsystem defines how each failure is detected | P0 | M-01 to M-31 | Phase 00 | AT-R-E11-02 | Unimplemented |
| R-E11-03 | E 11 | Every subsystem defines what state remains valid after each failure | P0 | M-01 to M-31 | Phase 00 | AT-R-E11-03 | Unimplemented |
| R-E11-04 | E 11 | Every subsystem defines whether the failed operation can be retried | P0 | M-01 to M-31 | Phase 00 | AT-R-E11-04 | Unimplemented |
| R-E11-05 | E 11 | Every subsystem defines whether user data is at risk | P0 | M-01 to M-31 | Phase 00 | AT-R-E11-05 | Unimplemented |
| R-E11-06 | E 11 | Every subsystem defines how the user is informed | P0 | M-01 to M-31 | Phase 00 | AT-R-E11-06 | Unimplemented |
| R-E11-07 | E 11 | Every subsystem defines whether the application continues in a degraded mode | P0 | M-01 to M-31 | Phase 00 | AT-R-E11-07 | Unimplemented |
| R-E11-08 | E 11 | Every subsystem defines how it returns to a known-good state | P0 | M-01 to M-31 | Phase 00 | AT-R-E11-08 | Unimplemented |
| R-E11-09 | E 11 | Every subsystem names the automated test that verifies each recovery | P0 | M-01 to M-31 | Phase 00 | AT-R-E11-09 | Unimplemented |
| R-E11-10 | E 11 | Audio failure never destroys project data | P0 | M-05, M-15 | Phase 04 | AT-R-E11-10 | Unimplemented |
| R-E11-11 | E 11 | Rendering failure never permanently stops the musical transport | P0 | M-04, M-18 | Phase 05 | AT-R-E11-11 | Unimplemented |
| R-E11-12 | E 11 | File-import failure never corrupts the current project | P0 | M-14, M-15 | Phase 07 | AT-R-E11-12 | Unimplemented |
| R-E11-13 | E 11 | Save failure never reports success; "Saved" appears only after a verified write | P0 | M-16, M-27 | Phase 09 | AT-R-E11-13 | Unimplemented |
| R-E11-14 | E 11 | Network failure never disables standalone gameplay | P0 | M-24, M-28 | Phase 13 | AT-R-E11-14 | Unimplemented |
| R-E11-15 | E 11 | Invalid input never crashes the application (global error handlers, ErrorReporter) | P0 | M-01, M-29 | Phase 01 | AT-R-E11-15 | Unimplemented |
| R-E11-16 | E 11 | Interrupted recording never overwrites the previous successful take | P0 | M-17 | Phase 09 | AT-R-E11-16 | Unimplemented |
| R-E11-17 | E 11 | An unrecoverable mode transition returns to SCR-MainMenu with every subsystem in a clean state | P0 | M-28 | Phase 01 | AT-R-E11-17 | Unimplemented |

#### 15.2.12 E 12 Required roadmap sections

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E12-01 | E 12 | Add every E 12 section to the roadmap (Part 11) as a dedicated T entry before any code is written | P0 | none | Phase 00 | AT-R-E12-01 | Unimplemented |
| R-E12-02 | E 12 | Dedicated roadmap entry: Risk register and severity classification (Part 13) | P0 | none | Phase 00 | AT-R-E12-02 | Unimplemented |
| R-E12-03 | E 12 | Dedicated roadmap entry: Audio lifecycle and recovery matrix | P0 | M-05 | Phase 04 | AT-R-E12-03 | Unimplemented |
| R-E12-04 | E 12 | Dedicated roadmap entry: Timing, scheduling, and drift test plan | P0 | M-04, M-05 | Phase 02 | AT-R-E12-04 | Unimplemented |
| R-E12-05 | E 12 | Dedicated roadmap entry: MIDI parser edge-case corpus | P0 | M-10, M-31 | Phase 07 | AT-R-E12-05 | Unimplemented |
| R-E12-06 | E 12 | Dedicated roadmap entry: MusicXML and Guitar Pro compatibility matrix | P1 | M-12, M-13, M-14 | Phase 12 | AT-R-E12-06 | Unimplemented |
| R-E12-07 | E 12 | Dedicated roadmap entry: Input lifecycle and simultaneous-press tests | P0 | M-07 | Phase 03 | AT-R-E12-07 | Unimplemented |
| R-E12-08 | E 12 | Dedicated roadmap entry: Scoring boundary-condition tests | P0 | M-09 | Phase 08 | AT-R-E12-08 | Unimplemented |
| R-E12-09 | E 12 | Dedicated roadmap entry: Recording integrity and project recovery tests | P0 | M-15, M-16, M-17 | Phase 09 | AT-R-E12-09 | Unimplemented |
| R-E12-10 | E 12 | Dedicated roadmap entry: Rendering degradation and resource-cleanup tests | P0 | M-18, M-28 | Phase 05 | AT-R-E12-10 | Unimplemented |
| R-E12-11 | E 12 | Dedicated roadmap entry: Dance-chart validation tests | P1 | M-23 | Phase 11 | AT-R-E12-11 | Unimplemented |
| R-E12-12 | E 12 | Dedicated roadmap entry: Multiplayer synchronization and security tests | P1 | M-24 | Phase 13 | AT-R-E12-12 | Unimplemented |
| R-E12-13 | E 12 | Dedicated roadmap entry: Browser and standalone-file compatibility matrix | P0 | M-31 | Phase 15 | AT-R-E12-13 | Unimplemented |
| R-E12-14 | E 12 | Dedicated roadmap entry: Storage quota and project migration tests | P0 | M-15, M-16 | Phase 09 | AT-R-E12-14 | Unimplemented |
| R-E12-15 | E 12 | Dedicated roadmap entry: Dependency failure and offline tests | P0 | M-31 | Phase 15 | AT-R-E12-15 | Unimplemented |
| R-E12-16 | E 12 | Dedicated roadmap entry: Fault-injection strategy | P0 | M-31 | Phase 15 | AT-R-E12-16 | Unimplemented |
| R-E12-17 | E 12 | Dedicated roadmap entry: Requirements-to-test traceability matrix (Part 15) | P0 | none | Phase 00 | AT-R-E12-17 | Unimplemented |
| R-E12-18 | E 12 | Dedicated roadmap entry: Final failure-recovery acceptance review | P0 | M-31 | Phase 16 | AT-R-E12-18 | Unimplemented |
| R-E12-19 | E 12 | Each E 12 entry names its dependencies, implementation deliverables and objective pass/fail criteria | P0 | none | Phase 00 | AT-R-E12-19 | Unimplemented |

#### 15.2.13 E 13 Release-blocking acceptance gate

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-E13-01 | E 13 | Release gate: audio timing does not drift during normal gameplay (drift TT tests pass) | P0 | M-04, M-05 | Phase 16 | AT-R-E13-01 | Unimplemented |
| R-E13-02 | E 13 | Release gate: no stuck note persists after stop or a mode change | P0 | M-05, M-06, M-28 | Phase 16 | AT-R-E13-02 | Unimplemented |
| R-E13-03 | E 13 | Release gate: valid supported MIDI files lose no musical events (FT corpus round trip) | P0 | M-10 | Phase 16 | AT-R-E13-03 | Unimplemented |
| R-E13-04 | E 13 | Release gate: saving can never silently destroy an existing project | P0 | M-16 | Phase 16 | AT-R-E13-04 | Unimplemented |
| R-E13-05 | E 13 | Release gate: the delivered standalone file performs every documented core function | P0 | M-29 | Phase 16 | AT-R-E13-05 | Unimplemented |
| R-E13-06 | E 13 | Release gate: a rendering failure never permanently disables audio or the transport | P0 | M-04, M-18 | Phase 16 | AT-R-E13-06 | Unimplemented |
| R-E13-07 | E 13 | Release gate: mobile controls release inputs reliably on every claimed device | P0 | M-07 | Phase 16 | AT-R-E13-07 | Unimplemented |
| R-E13-08 | E 13 | Release gate: multiplayer rejects invalid authoritative results per the validation rules | P1 | M-24 | Phase 16 | AT-R-E13-08 | Unimplemented |
| R-E13-09 | E 13 | Release gate: every required supported format is tested against the representative corpus | P0 | M-10, M-12, M-13, M-14 | Phase 16 | AT-R-E13-09 | Unimplemented |
| R-E13-10 | E 13 | Release gate: no critical error is silently ignored or reported as a successful operation | P0 | M-01, M-27 | Phase 16 | AT-R-E13-10 | Unimplemented |
| R-E13-11 | E 13 | Defer a lower-priority feature only with its Status documented and every core acceptance criterion met | P0 | none | Phase 16 | AT-R-E13-11 | Unimplemented |
| R-E13-12 | E 13 | Spec versioning: patch for clarifications, minor for additions, major for scope; date and summary on top | P1 | none | Phase 00 | AT-R-E13-12 | Unimplemented |
