## 8. Import, export, and compatibility strategy

This part is the strategy layer over the parser and pipeline modules of Part 6 (M-10 Midi,
M-11 Zip, M-12 MusicXml, M-13 GuitarPro, M-14 Import) and the export producers named in
Part 5.14. It fixes what each format preserves, the published compatibility matrix
(`docs/COMPATIBILITY.md`), the complete warning catalog shown on SCR-ImportInspect, the
generated test corpus (`test-corpus/`, produced by `tools/make-corpus.mjs`, Part 3.6), the
inspection screen data contract, export round trips, and the practice tools. Spec grounding:
B 3.5, 3.6, 7.5, 15.1-15.7, 23.1, 25.3; E 3.1-3.4, 10 (items 3, 6, 11), 11, 13; I 6.1-6.4,
16.2; P 11, 16, 19.

Rules that apply to every table in this part:

- Status words are the compatibility vocabulary only: Supported, Partial, Conversion,
  Unsupported (Part 0.9.3). A row's status is the target status at plan time; it becomes a
  published claim only after the verifying tests named in 8.7 have passed and the evidence
  is recorded (B 1.4 "do not claim file-format compatibility without verification").
- "Model mapping" names the `Song`, `Track` and `Event` fields of Part 5.1 exactly.
- Warning codes are defined once, in 8.8; other sections cite them.
- Where this part decides behavior that a Part 6 module must implement and that the module
  text does not yet state, the decision is listed in 8.1.4 with the module and the exact
  rule. Those rows are binding on the implementation in the same way as Part 6.

### 8.1 Pipeline (B 15.1)

#### 8.1.1 Stage table

`FLM.Import.importFile(input, opts)` (Part 6.14.4.1) runs the stages below in order. The
stage names are the values of `import.progress.stage` (Part 4.4). The eight B 15.1 steps map
onto them as shown in the first column. Stages 1-6 run inside `importFile`; stage 7 runs in
SCR-ImportInspect (M-27) after `import.done`; nothing in stages 1-7 references
`FLM.Project` or `FLM.Storage` (invariant S-12, Part 4.6).

| No. | B 15.1 step | Stage (`stage` value) | Owner | Input | Output | Failure handling | Progress reporting | Time slicing |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 Validate the input | `validate` | M-14 `validateFile`, `readBytes` | `File`, `Blob` or `{name, bytes}` | sanitized name, size, `presumedKind`, `Uint8Array` bytes | size 0 -> E-IMP-003 "The file is empty."; over 25 MB (notes) or 100 MB (audio) -> E-IMP-001 before any byte is read; read failure -> E-IMP-009; all at stage `validate` | one `import.progress` at stage entry, `fraction:null` (the browser file read reports no progress) | none (one `arrayBuffer()` await) |
| 2 | 2 Identify the format | `identify` | M-14 `identify` (table 8.2) | bytes, file name | `{format, kind, adapterId, version, container, mime, mismatch, unsupported}` | unknown -> E-IMP-002; recognized but refused -> the row's `E-IMP-*` with the exact text of 8.2; extension mismatch -> W-IMP-EXT-MISMATCH and the content result is used | one event at stage entry, `fraction:null` | none (identification reads at most the first 4,096 bytes plus, for ZIP files, the central directory) |
| 3 | 3 Parse the source | `parse` | adapter `parseAsync` (M-10, M-12, M-13) or the audio adapter `decodeAudio` (M-14) | bytes, `ParseOptions` with `deadline` and `isCancelled` | `ParseResult {format, version, container, songs, warnings, stats, smf}` | typed adapter errors pass through with their code (E-IMP-003, 004, 005, 006, 007, 008, 011, 014, 015); an untyped exception becomes E-IMP-003 "(internal: ...)" and a Log entry | MIDI: `fraction = bytesDone / bytesTotal` (byte position of the reader); MusicXML: `null` during `DOMParser`, then `partsDone / parts`; `.mxl`: one event per extracted entry; Guitar Pro: `(measure + 1) / measureCount`; audio: `null` (decoding reports nothing) | MIDI and GP: `setTimeout(0)` yield every 20,000 events (GP also every 50 measures); MusicXML: one yield per part and every 20,000 notes; ZIP: one yield per entry; deadline and cancel flag checked at every yield |
| 4 | 4 Normalize tracks and events, 5 Preserve supported metadata, 6 Report unsupported features | `normalize` | M-14 `normalizeSong` (Part 6.14.4.4) | `ParseResult` | normalized `Song[]`: `lockedSource:true`, sanitized names, `source` filled (`fileName`, `version`, `importedAt`, `fileSizeBytes`, `fileHash`), merged and coalesced warnings (cap 500, `warningsDropped`), chord-limit and controller checks (8.1.4 rows D3, D4), `Model.validate` passed | `Model.validate` error -> E-IMP-003 "(internal: <code>)" (a parser defect, never user data); deadline -> E-IMP-005; cancel -> E-IMP-011 | `fraction = eventsDone / eventsTotal` over all tracks of all songs | yield every 20,000 events with deadline and cancel checks |
| 5 | 7 Present the imported tracks for inspection | `inspect` | M-14 `InspectionReport.build` | normalized songs, meta | `InspectionReport` (Part 6.14.2) including `status` computed by rule 8.1.3 | cannot fail on valid songs (pure computation); an exception is a defect reported as E-IMP-003 internal | one event at stage entry, `fraction:null` | none (O(tracks)) |
| 6 | 7 (continued): playability preview | `chart` | M-14 calling `Mapping.ChartGenerator.simplificationReport(song, recommendedTrackId, 'A')` | report, song | `chordComplexity.perDifficulty` | skipped (left `null`, UI text "computed when a track is chosen") when the recommended track has more than 50,000 notes or no track is playable | one event at stage entry, `fraction:null` | none (four generations of one track; budget covered by the 50,000-note cap) |
| 7 | 8 Make the arrangement available to playback, visualization and gameplay | (no `import.progress`; M-27 actions) | SCR-ImportInspect controller | `InspectionReport`, user choices | Play now: `Project.Catalog.register` plus `Modes.enter('quickplay', ...)`; Save to Library: `Project.fromSong` plus `Storage.saveProject` plus `Project.setCurrent` (flow in 8.10.4) | DLG-ImportReplace per 8.10.4; a save failure shows DLG-SaveFailed and the imported song stays in the screen (nothing lost); Cancel releases the report and every decoded audio buffer (`Import.releaseAudio()`) | n/a | n/a |

Completion: after stage 6 M-14 emits exactly one `import.done {report, songs, ms}`; any
failure in stages 1-6 emits exactly one `import.failed {code, message, format, fileName,
stage}` and rejects (Part 6.14.3 invariants). The input bytes are dropped when the promise
settles; the only memory retained is the report's songs and, for audio, the decoded buffer
registered in `Import.AudioTrack`.

#### 8.1.2 Budgets and watchdogs

| Budget | Value | Measured from | Applies to | On expiry |
|---|---|---|---|---|
| Note-format pipeline budget | 5,000 ms wall time (`performance.now()`) | `importFile` start (includes the file read) | stages 1-5 for MIDI, MusicXML, Guitar Pro | E-IMP-005 at the next yield; partial results are discarded |
| `DOMParser` | not sliceable | n/a | MusicXML text above 8 MB raises W-IMP-LARGE-FILE first so the UI can say "this may take a while" | the deadline check after `DOMParser` returns still applies |
| Audio decode watchdog | 60,000 ms | `decodeAudioData` call | audio files only (decoding runs off the main thread and does not freeze the UI, so the 5 s budget does not apply) | E-IMP-005 with the text "Decoding the audio took longer than 60 seconds and was stopped. Try a shorter file."; the pending promise is ignored when it settles later |
| Progress throttle | at most one `import.progress` per 100 ms per stage; stage changes always emit | n/a | all | n/a |

Progress honesty (B 20.4, I 11.4): the screen shows a determinate bar only while `fraction`
is non-null; otherwise it shows the stage checklist with the current stage marked "working"
and no percentage. No stage invents a fraction.

#### 8.1.3 Report status rule

`InspectionReport.status` is computed from the warning catalog's Loss column (8.8):

1. `Partial` when any warning in `report.warnings` has `loss: yes` in 8.8 (information in the
   source is absent from, or altered in, the imported Song).
2. Otherwise `Conversion` when `format` is `musicxml`, `guitarpro` or `audio`, or when
   W-MIDI-FORMAT2 or W-MIDI-SMPTE is present (the input was converted into a different
   representation: notation to events, audio to an audio track, independent sequences to
   separate songs, frames to ticks; Part 0.9.3).
3. Otherwise `Supported`.

Reason: a user must see first whether something was lost; whether a conversion happened is
secondary and always true for notation formats. This replaces the rule written in Part
6.14.4.7 (8.1.4 row D1).

#### 8.1.4 Decisions this part adds to module designs

| ID | Module | Decision (binding) | Reason |
|---|---|---|---|
| D1 | M-14 | `InspectionReport.status` follows 8.1.3; every entry of `FLM.Import.WARNINGS`, `FLM.Midi.WARNINGS`, `FLM.MusicXml.WARNINGS`, `FLM.GuitarPro.WARNINGS` carries `loss: true or false` as listed in 8.8 | one honest per-file status |
| D2 | M-14 | identification adds the rows of 8.2 marked "added": RIFF `sfbk` (SoundFont), JSON `flm-project`, JSON `flm-dance`; `Zip.read` errors raised during identification keep their own code (E-IMP-003, E-IMP-004 or E-IMP-006) instead of being mapped to E-IMP-003 | B 3.6, honest messages |
| D3 | M-14 | `normalizeSong` step 4 adds W-IMP-CC-NO-PLAYBACK: per track, count ControlEvents whose `controller` is not in `PLAYBACK_CCS = [0, 1, 6, 7, 10, 11, 32, 38, 64, 98, 99, 100, 101, 120, 121, 123]`; the message lists up to 8 distinct controller numbers ascending | B 11.4 "unsupported controllers must be handled deterministically and documented" |
| D4 | M-14 | `normalizeSong` step 4 adds W-IMP-BEND-RANGE: per track, an RPN 0 selection (CC 101 value 0 and CC 100 value 0, either order, not cancelled by CC 101/100 value 127) followed by CC 6 with value `v != 2` emits the warning once with `{value: v}`; playback keeps the fixed range of +/-2 semitones (Part 6.6) | the stored CCs survive export; the audible difference is disclosed |
| D5 | M-14 | `normalizeSong` drops W-MDL-NO-NOTES and W-MDL-EMPTY-TRACK from `Model.validate` warnings when W-IMP-NO-NOTES is added to the same song | one message per fact |
| D6 | M-14 | audio adapter: after decoding, `leadingSilenceMs` = time of the first sample whose absolute value exceeds 0.01 (-40 dBFS) in any channel, rounded to integer ms; when `>= 50` it adds W-AUD-LEADING-SILENCE; `AudioInfo` gains `leadingSilenceMs` | E 3.4 "audio containing silence at the beginning" |
| D7 | M-14 | audio adapter: a decoded buffer with more than 2 channels is rendered through `new OfflineAudioContext(2, buffer.length, buffer.sampleRate)` (one `AudioBufferSourceNode`, default `channelInterpretation:'speakers'` downmix) into a stereo buffer; W-AUD-DOWNMIX; `AudioRef.channels` is then 2 | `AudioRef.channels` is 1-2 (Part 5.1.2) |
| D8 | M-14 | audio adapter: 60 s decode watchdog (8.1.2); at most 4 audio tracks per Song and the decoded-size cap (192 MB desktop, 64 MB mobile) applies to the sum over all attached buffers of the project; exceeding either -> E-IMP-004 "{detail}" with detail "a project can hold at most 4 audio tracks" or "the project's audio would use {n} MB (limit {value} MB on this device)" | Part 9 memory budget (300 MB desktop, 150 MB mobile) |
| D9 | M-14 | audio adapter adds W-AUD-NO-TEMPO, W-AUD-NO-SPEED-CHANGE, W-AUD-NOT-PERSISTED to every audio import, and W-AUD-LARGE when the decoded size exceeds 50 percent of the cap; `normalizeSong` does not add W-IMP-NO-NOTES to audio imports (the Part 1.5 audio sentence is the unplayable reason) | the report states every audio limitation once |
| D10 | M-03 | `pairNotes` processing at each raw tick: (1) the offs in source order, each closing the most recent open note of its key that started at an earlier tick; an off that finds none is deferred; (2) the ons in source order; (3) the deferred offs, each closing the most recent open note of its key started at this tick with `durTicks = 1` and W-NOTE-ZERO-DURATION, otherwise W-NOTE-OFF-WITHOUT-ON | the Part 6.3.4.3 order (all offs first) turns an on/off pair at one tick into a stuck note sustained to track end (E 3.1 "zero-duration notes", E 2.3) |
| D11 | M-03 | `Song.computeDuration` includes audio tracks: `d = max(d, ceil(tempoMap.secondsToTicks(audioRef.durationS + audioRef.syncOffsetMs / 1000)))` for every `kind:'audio'` track | an audio-only song otherwise has duration 0 |
| D12 | M-10 | materialization step E: for format 1, `song.title` is the sanitized name of MTrk 0 whenever MTrk 0 has a name, whether or not MTrk 0 is folded as the conductor track | format 1 files with copyright or text events in track 0 otherwise fall back to the file name |
| D13 | M-12 | new warnings W-XML-FERMATA-IGNORED (any `notations/fermata`), W-XML-INSTRUMENT-CHANGE (`<sound>` with a `<midi-instrument>` child after the first measure of a part, or an `<instrument-change>` element) and W-XML-ARTICULATION-FLAGGED (articulations other than staccato, staccatissimo, detached-legato, accent, strong-accent, tenuto); each reported once per code with a count, notes unchanged | B 15.4 and E 3.3: nothing affecting performance is dropped silently |
| D14 | M-13 | new warning W-GP-FADE-IN-IGNORED (beat effect flag fade in) | the module text ignores it silently |
| D15 | M-05 | audio track playback: for each `kind:'audio'` track with an attached buffer, the Scheduler starts one `AudioBufferSourceNode` through the track's `ChannelStrip` at `Transport.audioTimeAt(tick) + delayS` with buffer offset `bufferOffsetS` from `Import.AudioTrack.startOffsetSeconds(track, tick, effectiveTempoMap)`, on `play`, `resume`, `seek` and every loop wrap (at `transport.loop.atAudioTime`), and stops it on `pause`, `stop`, seek and wrap; `effectiveTempoMap` is the Transport's map (the `tempoOverride` substitute when set) | E 3.4 "defined synchronization offset" |
| D16 | M-05 | audio tracks are silent while `Transport.speed() !== 1.0` (no source node is started; a running node is stopped at the speed change) | `playbackRate` would change pitch and no time-stretch exists (Part 1 non-goal) |
| D17 | M-05 | practice pitch filter: `Audio.Scheduler.setTrackFilter(trackId, {pitchLo, pitchHi, gainInRange})` scales the velocity-to-gain of notes inside `[pitchLo, pitchHi]` by `gainInRange` (0..1) and plays the others unchanged; `clearTrackFilter(trackId)`; filters are dropped by `Scheduler.unbind` | one-hand practice (8.12.2) |
| D18 | M-08 | `ChartGenerator.generate` option `pitchRange: {lo, hi}` restricts source notes to that inclusive range before grouping; when present the hash input gains a sixth field `range:<lo>-<hi>`, joined with the same separator character as the five fields of Part 5.9.1 | practice charts must not share a `settingsHash` with full charts (personal bests, multiplayer) |
| D19 | M-31 tooling | `tools/make-corpus.mjs` gains `deflateFixed(bytes)`, `WavWriter` and the mutate op `patchI32LE(off, v)` (8.9.2); `SmfWriter`, `zipStored` and `Gp5Writer` return byte offsets of the structures the variant recipes patch (`{bytes, offsets}`); the corpus may contain the extensions `.wav .mp3 .ogg .gtp .gpx .gp .rmi .sf2 .json` in addition to the list in Part 3.1 | needed by the 8.9 recipes |
| D20 | M-27 | the file picker `accept` list of 8.2.3 is used on every platform except iOS, where `accept` is omitted (iOS greys out files whose extension has no registered type, such as `.gp5`); identification then decides | iOS Safari picker behavior |
| D21 | M-15, M-17 | `Project.Commands.setAudioOffset(trackId, ms)` (undoable, coalesce key `'audioOffset:' + trackId`) writes `audioRef.syncOffsetMs` through `Import.AudioTrack.setSyncOffset`; `Studio.Session.addAudioTrack(file)` runs `Import.importFile` on the file, refuses non-audio results with the toast "Only audio files can be added as audio tracks.", and appends the audio track with `Commands.addTrack` | 8.6.3 controls |
| D22 | M-05 | `Audio.captureMix(project) -> Promise<{blob, mimeType}>`: real-time playback of the project from tick 0 to the end through a `MediaStreamAudioDestinationNode` tapped after the master limiter, recorded by `MediaRecorder` with the first supported of `audio/webm;codecs=opus`, `audio/mp4`, `audio/webm`; the metronome bus is muted; cancellable; the result is offered as a download and may be stored in the `recordings` store | OQ-2 alternative to WAV export |
| D23 | M-09 | `Rhythm.performanceSong(chart, song, results, {includeBand}) -> Song`: a new Song with the song's tempo, meter, key and markers, one track "Performance" (program `chart.instrument`, drums when 128) holding the `pitches` of every ChartNote whose head judgment is perfect, great or good, at `ChartNote.tick` with `ChartNote.durTicks`, plus deep copies of the other tracks when `includeBand` | B 15.6 MIDI performance export |
| D24 | M-10 | conductor folding (Part 6.10.4.7 C) for format 1 MTrk 0: a `text` event at tick 0 starting `Artist: ` and a `copyright` event at tick 0 do not prevent folding; on folding the artist text sets `song.artist` (no TextEvent kept) and the copyright TextEvent moves to tick 0 of the first materialized track unless an identical one is there; the writer (Part 5.14.1 rules 2 and 6) writes a tick-0 copyright only in the conductor track | otherwise every exported file re-imports with an extra text-only track and the MIDI round trip is not stable |
| D25 | M-05, M-28 | `Audio.setPracticeGain(trackId, gain 0..1)` multiplies a channel strip's gain for the session without touching `track.mix`; all practice gains, solos and filters are cleared by `Scheduler.unbind`; practice settings (speed, loop, hands, solo set) travel in the mode `params` so SCR-Pause "Restart" (leave then enter with identical params) keeps them and leaving the mode resets them | practice tools never modify the song or project (I 5.1) |

### 8.2 Format identification

#### 8.2.1 Identification table

`FLM.Import.identify(bytes, fileName)` tests content top to bottom; the first matching row
wins. Extensions are used only in the fallback rows (marked "ext") and to set `mismatch`.
"Status" is the compatibility word the row leads to; "Stage" is the `import.failed.stage`
when the row refuses the file. Rows marked "added" are decisions of this part (8.1.4 D2);
all other rows restate Part 6.14.4.2.

| Order | Content test | Typical extensions | Result | Adapter | Status | Refusal code and exact user text | Stage | Corpus file (8.9) |
|---|---|---|---|---|---|---|---|---|
| 1 | bytes 0-3 = `4D 54 68 64` (`MThd`) | `.mid .midi .smf .kar` | format `midi`, kind notes, version from `Midi.identify` (`SMF format 1, 480 PPQ`, `SMF format 0, SMPTE 25 fps x 40`, or `SMF (header incomplete)` below 14 bytes) | `midi` (M-10) | Supported (format 2 and SMPTE: Conversion) | none at identification; header errors are raised by M-10 at stage `parse` | n/a | `midi-mono-simple.mid` |
| 2 | `RIFF` at 0 and `WAVE` at 8 | `.wav` | format `audio`, mime `audio/wav` | audio adapter (M-14) | Conversion | none | n/a | `audio-sine-1s.wav` |
| 3 | `RIFF` at 0 and `RMID` at 8 | `.rmi` | refused | none | Unsupported | E-IMP-006 "This is a RIFF MIDI (.rmi) file. Save it as a standard .mid file and import that." | identify | `riff-midi.rmi` |
| 4 (added) | `RIFF` at 0 and `sfbk` at 8 | `.sf2` | refused | none | Unsupported | E-IMP-006 "This is a SoundFont (.sf2) sound bank, not a song. Loading SoundFont (.sf2) sound banks is not supported in this version." | identify | `soundfont.sf2` |
| 5 | `50 4B 03 04` (`PK..`) at 0, then `Zip.read`; entry `Content/score.gpif` present | `.gp` | refused | none | Unsupported | E-IMP-006 "This is a Guitar Pro 6 or 7 file (.gpx or .gp). Only Guitar Pro 3, 4 and 5 files (.gp3, .gp4, .gp5) can be imported. Export the file as GP5 or as MIDI from Guitar Pro and import that." (Part 1.5 wording) | identify | `gp7-file.gp` |
| 6 | `PK..` at 0; entry `META-INF/container.xml`, or any entry ending `.musicxml` or `.xml` outside `META-INF/` | `.mxl` | format `musicxml`, container `mxl` | `musicxml` (M-12 `parseMxl`) | Conversion | none | n/a | `mxl-stored.mxl` |
| 7 | `PK..` at 0; no row 5 or 6 entry | `.zip .mscz` and others | refused | none | Unsupported | E-IMP-002 "This ZIP archive does not contain a MusicXML score." | identify | `zip-without-score.mxl` |
| 7a | `PK..` at 0 and `Zip.read` throws | any | refused | none | n/a | the Zip error passes through with its own code: E-IMP-003 (no end-of-central-directory record, corrupt directory), E-IMP-004 (more than 256 entries, more than 50 MB uncompressed, ratio above 100), E-IMP-006 (ZIP64, encrypted, multi-disk) (added: D2) | identify | `mxl-stored.trunc-eocd.mxl`, `mxl-ratio-bomb.mxl`, `mxl-stored.encrypted.mxl` |
| 8 | `42 43 46 5A` (`BCFZ`) at 0 | `.gpx` | refused | none | Unsupported | E-IMP-006 with the Part 1.5 Guitar Pro 6 or 7 text (row 5) | identify | `gp6-file.gpx` |
| 9 | `bytes[0] <= 30` and ASCII at 1 starts `FICHIER GUITAR PRO `, `FICHIER GUITARE PRO ` or `CLIPBOARD GUITAR PRO` | `.gp3 .gp4 .gp5 .gtp` | format `guitarpro`, version label from `GuitarPro.identify` (`GP5 v5.10`) or the raw string | `guitarpro` (M-13) | Conversion for the six whitelisted strings (8.5.1); Unsupported for the others | unsupported strings are refused by M-13 at stage `parse` with E-IMP-006: GP1/GP2 "This is a Guitar Pro 1 or 2 file. Only Guitar Pro 3, 4 and 5 files (.gp3, .gp4, .gp5) can be imported. Open it in Guitar Pro and save it as GP5."; clipboard "This is Guitar Pro clipboard data, not a song file."; other "Guitar Pro version "{raw}" is not supported. Only Guitar Pro 3, 4 and 5 files can be imported." | parse | `gp5-basic.gp5`, `gp2-unsupported.gtp` |
| 10 (added) | text sniff (row 12 decoding) finds `{` as the first non-space character and the first 4,096 characters contain `"format"` followed by `"flm-project"` | `.json .flm.json` | refused | none | n/a | E-IMP-002 "This is a Finger Lickin Music project file. Open it from Song Library > Open project file." | identify | `project-file.json` |
| 11 (added) | as row 10 with `"flm-dance"` | `.json .flmdance.json` | refused | none | n/a | E-IMP-002 "This is a dance chart file. Load it from Dance Mode > Custom chart." | identify | (UT only) |
| 12 | text sniff: decode the first 4,096 bytes as UTF-8 (UTF-8 BOM skipped; UTF-16 BOM `FF FE` or `FE FF` decodes as UTF-16), skip whitespace, `<?xml ...?>`, comments and `<!DOCTYPE ...>`; next element is `score-partwise`, `score-timewise` or `opus` | `.musicxml .xml` | format `musicxml`, container `xml`; `opus` is refused inside M-12 | `musicxml` (M-12 `parseAsync`) | Conversion (opus: Unsupported) | opus: E-IMP-006 "MusicXML opus collections are not supported; import one score at a time." | parse (opus) | `xml-basic-partwise.musicxml`, `xml-opus.xml` |
| 13 | `ID3` at 0, or `bytes[0] = FF` and `(bytes[1] & E6) = E2` (MPEG layer III frame sync) | `.mp3` | format `audio`, mime `audio/mpeg` | audio adapter | Conversion | decode failure -> E-IMP-008 at stage `parse` | parse | `audio-garbage.mp3` |
| 14 | `OggS` at 0 | `.ogg .oga .opus` | format `audio`, mime `audio/ogg` | audio adapter | Conversion | as row 13 | parse | `audio-garbage.ogg` |
| 15 | `fLaC` at 0 | `.flac` | format `audio`, mime `audio/flac` | audio adapter | Conversion | as row 13 | parse | (LT only) |
| 16 | `ftyp` at 4 | `.m4a .mp4 .aac` | format `audio`, mime `audio/mp4` | audio adapter | Conversion | as row 13 | parse | (LT only) |
| 17 | `bytes[0] = FF` and `(bytes[1] & F6) = F0` (ADTS AAC) | `.aac` | format `audio`, mime `audio/aac` | audio adapter | Conversion | as row 13 | parse | (LT only) |
| 18 (ext) | no content match; extension in `wav mp3 ogg oga opus flac m4a mp4 aac` | as listed | format `audio`, mime `audio/unknown`; `decodeAudioData` decides | audio adapter | Conversion | decode failure -> E-IMP-008 | parse | (UT only) |
| 19 (ext) | no content match; extension in `mid midi smf kar` | as listed | refused | none | n/a | E-IMP-003 "This file is named like a MIDI file but does not start with a MIDI header." | identify | `midi-mono-simple.bad-magic.mid` |
| 20 (ext) | no content match; extension in `xml musicxml mxl` | as listed | refused | none | n/a | E-IMP-002 "This file is named like MusicXML but no score element was found." | identify | `xml-not-a-score.xml` |
| 21 (ext) | no content match; extension in `gp3 gp4 gp5 gpx gp gtp` | as listed | refused | none | Unsupported | E-IMP-006 "The Guitar Pro version was not recognized. Only Guitar Pro 3, 4 and 5 files can be imported." | identify | (UT only) |
| 22 | anything else | any | format `unknown` | none | n/a | E-IMP-002 "This file type is not recognized. Supported: MIDI (.mid), MusicXML (.xml, .musicxml, .mxl), Guitar Pro 3-5 (.gp3, .gp4, .gp5) and audio files." | identify | `unknown-random.bin` |

Before identification, `validateFile` refuses 0-byte files (E-IMP-003 "The file is empty.",
stage `validate`, corpus `empty.mid`) and files over the size limit (E-IMP-001, stage
`validate`). When a file with an audio extension identifies as a notes format, the 25 MB
limit is applied again (E-IMP-001, stage `identify`).

#### 8.2.2 Extension mismatch

`mismatch` is true when the extension's expected format (the "Typical extensions" column)
differs from the content result. The content result is used and W-IMP-EXT-MISMATCH (info,
loss no) names both: "The file is named .xml but contains a Standard MIDI File; the content
was used." Corpus: `midi-named-as.xml`. Extensions not listed in any row never cause a
mismatch.

#### 8.2.3 File picker and drop target

| Item | Decision |
|---|---|
| Picker call | `FLM.Storage.files.pick({accept, multiple:false})` (Part 6.16) from SCR-ImportInspect "Choose file"; drag and drop through `Storage.files.enableDrop` on the screen's drop zone; one file per import (a multi-file drop imports the first file and shows the toast "One file at a time; imported '<name>'.") |
| `accept` value | `.mid,.midi,.smf,.kar,.musicxml,.xml,.mxl,.gp3,.gp4,.gp5,.wav,.mp3,.ogg,.oga,.opus,.flac,.m4a,.aac,audio/midi,audio/x-midi,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml,audio/*` (omitted on iOS, D20) |
| Hint text under the button (P 11 "the file picker clearly identifies accepted formats") | "MIDI (.mid), MusicXML (.musicxml, .xml, .mxl), Guitar Pro 3-5 (.gp3, .gp4, .gp5), or audio (.wav, .mp3, .ogg, .flac, .m4a) as a backing track. Up to 25 MB (audio 100 MB)." |
| Second line of the hint | "Guitar Pro 6 and 7 files (.gpx, .gp) are not supported. Audio files never become playable notes." |
| Size check | `Storage.files.read(file, {as:'arrayBuffer', maxBytes})` with `maxBytes` 25 MB or 100 MB by extension; the pipeline repeats the check in `validateFile` |
| Project and dance files | not accepted here; they are opened from SCR-Library ("Open project file", `.flm.json`) and SCR-Dance ("Custom chart", `.flmdance.json`); dropping one onto SCR-ImportInspect yields the row 10 or 11 message |

### 8.3 MIDI preservation (Standard MIDI File)

#### 8.3.1 Structure and division

| SMF element | Bytes | Model mapping | Status | Notes and warnings |
|---|---|---|---|---|
| Header chunk | `MThd`, length, format, ntrks, division | `song.source.version` = `Midi.identify().version`; `ParseResult.smf` | Supported | length above 6: extra bytes skipped (W-MIDI-HEADER-LENGTH); length below 6, format not 0-2, PPQ 0, unknown SMPTE rate: E-IMP-003 |
| Format 0 | one MTrk | one Song; one Track per MIDI channel used, in ascending channel order, names suffixed ` (ch N)` | Supported | W-MIDI-MULTI-CHANNEL when more than one channel |
| Format 1 | conductor plus parallel MTrk | one Song; an MTrk without channel messages and without texts (other than the tick-0 `Artist:` text and copyright of MTrk 0, D24) is folded: its tempo, meter, key and markers go to the song maps; MTrk 0's name becomes `song.title` (D12) | Supported | parallel tracks share one timeline |
| Format 2 | independent sequences | one Song per MTrk, each with its own maps; SCR-ImportInspect shows a sequence chooser and imports one at a time | Conversion | W-MIDI-FORMAT2; never merged into one synchronized song (E 3.1) |
| Division PPQ | bit 15 clear | absolute ticks rescaled to 960 with `floor((t * 1920 + ppq) / (2 * ppq))` on absolute positions (no cumulative error) | Supported | W-MIDI-TICK-ROUNDING when `960 % ppq != 0` (error at most half a tick) |
| Division SMPTE | bit 15 set, fps 24/25/29.97/30, ticks per frame | ticks = `round(seconds * 1920)` (120 BPM grid); tempo map is the single default entry | Conversion | W-MIDI-SMPTE; tempo metas ignored (W-MIDI-SMPTE-TEMPO-IGNORED); bar lines follow 120 BPM 4/4, not the music |
| MTrk chunk | `MTrk`, length, events | RawTrack -> Track(s) | Supported | length past the end of file: read to the end (W-MIDI-TRUNCATED); more than 128 MTrk: E-IMP-004 before allocation |
| Unknown chunk | any other 4-byte id | skipped | Supported (skipped by the SMF standard's rule) | W-MIDI-UNKNOWN-CHUNK |
| Trailing bytes | fewer than 8 bytes after the last chunk | ignored | Supported | W-MIDI-TRAILING-BYTES |
| Variable-length quantity | 1-4 bytes | delta ticks | Supported | 5th continuation byte: W-MIDI-BAD-VLQ, rest of the track skipped, earlier events kept |
| Running status | data byte after a channel status | same status reused | Supported | kept across meta events (lenient, W-MIDI-RUNNING-STATUS-AFTER-META); cancelled by sysex |
| Data byte without any status | first byte below 0x80 with no running status | none | Partial | W-MIDI-BAD-STATUS; rest of the track skipped |

#### 8.3.2 Channel messages

| Message | Status byte | Model mapping | Playback use (M-05, M-06) | Export (`Midi.write`) | Status | Notes and warnings |
|---|---|---|---|---|---|---|
| Note off | `8n` | closes the open note: `NoteEvent.durTicks`, `offVelocity` | release at `tick + durTicks` | `80` with `offVelocity` | Supported | pairing rules Part 6.3.4.3 as amended by D10 |
| Note on | `9n` velocity 1-127 | `NoteEvent {tick, pitch, velocity, channel}` | voice start | `90` | Supported | velocity above 127 cannot occur in valid data; out-of-range data bytes: W-MIDI-BAD-DATA |
| Note on velocity 0 | `9n` vel 0 | note off with `offVelocity` 0 | as note off | written as `80` with velocity 0 | Supported | E 3.1 |
| Unmatched note on | on without off | note closed at the track end (EOT tick, else last event tick) | sounds to that end | written with the computed off | Partial | W-NOTE-UNMATCHED; the Scheduler also caps any voice at 60 s (Part 6.5) |
| Note off without on | off with no open note | dropped | none | none | Supported (nothing to keep) | W-NOTE-OFF-WITHOUT-ON |
| Same pitch re-struck on one channel before release | on, on, off, off | the earlier note ends at the later start (no stacking) | one voice per pitch and channel | as stored | Partial | W-NOTE-OVERLAP |
| On and off at the same tick | zero length | `durTicks = 1` | 1-tick note (the shortest voice the synthesizer plays) | as stored | Supported | W-NOTE-ZERO-DURATION (D10) |
| Polyphonic aftertouch | `An` | not stored | none | none | Unsupported | W-MIDI-IGNORED-EVENT (count) |
| Control change bank select | `Bn` CC 0, CC 32 | at tick 0 before the first program: `Track.bankMsb`, `bankLsb`; later: `ControlEvent` | bank not used for timbre (GM sound set only) | CC 0 and CC 32 at tick 0 when non-zero, later events as stored | Supported (stored and exported) | GM has one bank; the matrix notes "bank select is kept but does not change the synthesized sound" |
| CC 1 modulation | `Bn 01` | `ControlEvent` | vibrato depth (Part 6.6) | as stored | Supported | |
| CC 6, 38 data entry; CC 98-101 RPN and NRPN | `Bn` | `ControlEvent` | RPN 0 (pitch-bend range) not applied; range fixed at +/-2 semitones | as stored | Partial | W-IMP-BEND-RANGE when RPN 0 sets a value other than 2 (D4) |
| CC 7 volume, CC 11 expression | `Bn` | `ControlEvent` | channel-strip expression gain (Part 6.5) | as stored | Supported | the mixer `mix.gain` is separate and not written as CC 7 |
| CC 10 pan | `Bn 0A` | `ControlEvent` | strip pan | as stored | Supported | |
| CC 64 sustain | `Bn 40` | `ControlEvent`; playback durations derived by `Model.deriveSustain` (non-destructive) | voices held while the pedal is down | the CC events, not lengthened notes | Supported | pedal never released: extended to track end, voice cap 60 s |
| CC 120 all sound off, 121 reset controllers, 123 all notes off | `Bn` | `ControlEvent` | applied at their tick (Part 6.6) | as stored | Supported | |
| Other controllers (CC 2-5, 8, 9, 12-31, 33-37, 39-63, 65-97, 102-119, 122, 124-127) | `Bn` | `ControlEvent` | none | as stored | Partial | W-IMP-CC-NO-PLAYBACK lists them (D3); they survive a MIDI round trip |
| Program change | `Cn` | first program at or before the first note: `Track.program` (event dropped); every other one: `ProgramEvent` | voice program switches at the event tick; sustaining notes keep their program (E 2.3) | `C0` at tick 0 plus the stored events | Supported | none on a channel: program 0 (W-MIDI-NO-PROGRAM) |
| Channel pressure | `Dn` | not stored | none | none | Unsupported | W-MIDI-IGNORED-EVENT |
| Pitch bend | `En` | `PitchBendEvent` value -8192..8191 | applied, range +/-2 semitones | `E0` | Supported | |
| Channel 10 (index 9) | any | tracks on channel 9 get `isDrums:true`; notes map to the 12 drum voices (brief section 6) | GM percussion keys 35-81; keys outside play the closest voice per Part 6.6 | written on channel 9 | Supported | |
| Several tracks on one channel | different MTrk, same channel | separate Tracks with their own `program` and strips | per track, not per channel | each on its channel (drum remap rule Part 5.14.1) | Supported | E 3.2 |

#### 8.3.3 System and meta events

| Event | Bytes | Model mapping | Status | Notes and warnings |
|---|---|---|---|---|
| System exclusive | `F0`, `F7` | skipped (length honored) | Unsupported | W-MIDI-SYSEX-SKIPPED; GM, GS and XG resets therefore have no effect |
| System common and real-time | `F1-F6`, `F8-FE` | invalid inside files | Unsupported | W-MIDI-BAD-STATUS; rest of the track skipped |
| Meta 0x00 sequence number | `FF 00` | dropped | Unsupported (no musical content) | listed in the matrix; no per-file warning |
| Meta 0x01 text | `FF 01` | `TextEvent type:'text'`; `Artist: <name>` at tick 0 of track 0 also sets `song.artist` | Supported | text over 1,000 characters truncated (W-TEXT-TRUNCATED); `.kar` lyric texts (`@`, `/`, `\` prefixes) stay text events, not lyrics |
| Meta 0x02 copyright | `FF 02` | `TextEvent type:'copyright'` | Supported | |
| Meta 0x03 sequence or track name | `FF 03` | first: `Track.name` (MTrk 0 of format 1: `song.title`, D12); later: `TextEvent type:'trackName'` | Supported | missing name: `Track {N} ({GM program name})`; duplicates kept |
| Meta 0x04 instrument name | `FF 04` | `TextEvent type:'instrument'` | Supported | display only |
| Meta 0x05 lyric | `FF 05` | `TextEvent type:'lyric'` | Supported | |
| Meta 0x06 marker | `FF 06` | `Marker {kind:'section'}` (deduplicated across tracks) | Supported | sections drive Model.sections, practice restart (8.12) |
| Meta 0x07 cue point | `FF 07` | `Marker {kind:'cue'}` | Supported | |
| Meta 0x08 program name, 0x09 device name | `FF 08`, `FF 09` | `TextEvent type:'text'` | Partial | type distinction lost (exported as 0x01) |
| Meta 0x20 channel prefix | `FF 20` | hint for text-only tracks | Supported | |
| Meta 0x21 port | `FF 21` | dropped (all ports share the 16 channels; tracks stay separate) | Unsupported (no musical content) | listed in the matrix; no per-file warning |
| Meta 0x2F end of track | `FF 2F` | ends the track; trailing silence after the last event is not kept in `durationTicks` | Partial | missing: W-MIDI-NO-EOT; data after it: W-MIDI-DATA-AFTER-EOT |
| Meta 0x51 set tempo | `FF 51 03` | `TempoMap` entry; same-tick conflict across tracks: last in file order wins | Supported | length not 3: W-MIDI-META-LENGTH; value 0: W-MIDI-TEMPO-ZERO; none: 120 BPM with W-MIDI-NO-TEMPO; above 10,000 entries: W-MIDI-MAP-TRUNCATED |
| Meta 0x54 SMPTE offset | `FF 54` | dropped; playback starts at tick 0 | Unsupported | listed in the matrix; no per-file warning (video synchronization only) |
| Meta 0x58 time signature | `FF 58 04` | `MeterMap` entry `{numerator, denominator: 2^dd}`; clocks-per-click and 32nds fields dropped | Supported | out of range: W-MIDI-METER-RANGE; none: 4/4 with W-MIDI-NO-METER |
| Meta 0x59 key signature | `FF 59 02` | `KeyMap` entry `{fifths, mode}` | Supported | out of range: W-MIDI-KEY-RANGE; none: C major for spelling with W-MIDI-NO-KEY |
| Meta 0x7F sequencer specific | `FF 7F` | skipped | Unsupported | W-MIDI-SEQ-SPECIFIC |
| Other meta types | `FF xx` | skipped | Unsupported | W-MIDI-UNKNOWN-META |
| RIFF MIDI wrapper (`.rmi`) | `RIFF ... RMID` | refused at identification | Unsupported | E-IMP-006 (8.2 row 3) |

#### 8.3.4 E 3.1 and E 3.2 case table

Every structural (E 3.1) and interpretation (E 3.2) case, its decided behavior, and the
corpus file that verifies it (8.9). "Source preserved" means the raw event data that the
model can hold is kept unchanged; gameplay mappings are derived later and never write back
(I 1.2, S-08).

| Case (spec) | Behavior | Warning | Corpus file |
|---|---|---|---|
| Format 0, all events on one track (E 3.1) | split per channel | W-MIDI-MULTI-CHANNEL when more than one channel | `midi-mono-simple.mid`, `midi-drums-heavy.mid` |
| Format 1, synchronized tracks (E 3.1) | one song, conductor folded | none | `midi-multitrack-band.mid`, `midi-poly-chords.mid` |
| Format 2, independent sequences (E 3.1) | one song per sequence, chooser | W-MIDI-FORMAT2 | `midi-format2.mid` |
| Missing or invalid header (E 3.1) | refused | E-IMP-003 | `midi-mono-simple.bad-magic.mid`, `midi-mono-simple.bad-hlen.mid`, `midi-mono-simple.format3.mid`, `midi-mono-simple.ppq0.mid`, `midi-mono-simple.trunc-12.mid` |
| Invalid track length (E 3.1) | too long: read to end of file; too short: the chunk ends early and the following bytes are treated as a chunk header | W-MIDI-TRUNCATED; W-MIDI-UNKNOWN-CHUNK and W-MIDI-NO-EOT | `midi-mono-simple.huge-length.mid`, `midi-mono-simple.short-length.mid` |
| Truncated variable-length quantity (E 3.1) | events before the cut kept; open notes closed | W-MIDI-TRUNCATED, W-NOTE-UNMATCHED | `midi-mono-simple.trunc-131.mid` |
| Over-long VLQ | rest of the track skipped | W-MIDI-BAD-VLQ | `midi-mono-simple.bad-vlq.mid` |
| Invalid event status byte (E 3.1) | rest of the track skipped | W-MIDI-BAD-STATUS | `midi-mono-simple.bad-status.mid` |
| Invalid data byte | that message dropped | W-MIDI-BAD-DATA | `midi-mono-simple.bad-data.mid` |
| Missing end-of-track (E 3.1) | track ends at its last event | W-MIDI-NO-EOT | `midi-no-eot-no-meta.mid` |
| Duplicate or conflicting metadata (E 3.1) | last value at a tick wins; duplicate names kept | W-MIDI-DUPLICATE-META | `midi-duplicate-meta.mid` |
| Running status (E 3.1) | decoded | none | `midi-mono-running-status.mid` |
| Empty track (E 3.1) | not materialized (no events of any kind) | none | `midi-empty-and-text-tracks.mid` |
| Track with metadata but no notes (E 3.1) | materialized as a text-only Track (not playable); a format 1 conductor holding only its name, tempo, meter, key, markers, an `Artist:` text and a copyright is folded instead (D24) | W-MIDI-TEXT-ONLY-TRACK | `midi-empty-and-text-tracks.mid`, `midi-text-markers.mid` |
| Extremely large event counts (E 3.1) | above 1,000,000 events or 128 MTrk: refused before allocation; 100,000 notes: imported with yields | E-IMP-004 | `midi-huge-ntrks.mid`, `midi-large-100k.mid`, in-memory cases 8.9.5 |
| Zero-duration notes (E 3.1) | 1 tick | W-NOTE-ZERO-DURATION | `midi-zero-duration.mid` |
| Unmatched note on and off (E 3.1) | closed at track end; orphan offs dropped | W-NOTE-UNMATCHED, W-NOTE-OFF-WITHOUT-ON, W-NOTE-OVERLAP | `midi-unmatched.mid` |
| Note on velocity 0 as note off (E 3.1) | note off | none | `midi-mono-running-status.mid` |
| Simultaneous notes with identical pitches (E 3.1) | same channel: no stacking (earlier ends at the later start); different channels or tracks: both kept | W-NOTE-OVERLAP (same channel only) | `midi-same-tick-tracks.mid` |
| Events sharing timestamps in different tracks (E 3.1) | kept; scheduled in one Scheduler pass in comparator order | none | `midi-same-tick-tracks.mid` |
| Unusual PPQ (E 3.1) | rescaled exactly | W-MIDI-TICK-ROUNDING | `midi-ppq-97.mid` |
| SMPTE timing (E 3.1) | converted at 120 BPM | W-MIDI-SMPTE | `midi-smpte-25.mid` |
| Tempo not defined (E 3.2) | 120 BPM default, labelled "(default, not in file)" on SCR-ImportInspect | W-MIDI-NO-TEMPO | `midi-no-eot-no-meta.mid` |
| Multiple tempo changes (E 3.2) | full TempoMap | none | `midi-tempo-changes.mid` |
| Time signature changes mid-song (E 3.2) | full MeterMap; partial bars allowed | none | `midi-meter-key-changes.mid` |
| Key signature changes mid-song (E 3.2) | full KeyMap | none | `midi-meter-key-changes.mid` |
| Track with several program changes (E 3.2) | `ProgramEvent`s kept | none | `midi-multi-program-channel.mid` |
| Percussion on the designated channel (E 3.2) | `isDrums` | none | `midi-drums-heavy.mid` |
| Pitch bend or modulation during a note (E 3.2) | kept as events at their ticks | none | `midi-controllers.mid` |
| Sustain pedal changes note duration (E 3.2) | CC 64 kept; derived durations for playback only | none | `midi-controllers.mid` |
| Notes extending across measures (E 3.2) | one NoteEvent | none | `midi-controllers.mid` |
| Unusual velocities (E 3.2) | kept exactly (1-127) | none | `midi-velocity-range.mid` |
| Note outside the playable instrument range (E 3.2) | kept in the Song; the chart generator and live mapper apply the range policy of Part 6.8 | none | `midi-velocity-range.mid` |
| Several instruments on one MIDI channel (E 3.2) | separate Tracks | none | `midi-multi-program-channel.mid` |
| Track names missing or duplicated (E 3.2) | fallback names; duplicates kept | none | `midi-drums-heavy.mid`, `midi-duplicate-meta.mid` |
| Final event after the last note (E 3.2) | `durationTicks` ends at the last event of any kind; EOT beyond that is not kept | none | `midi-trailing-events.mid` |

### 8.4 MusicXML preservation

#### 8.4.1 Containers and variants (B 15.3 "explicitly define support for compressed and uncompressed")

| Variant | Identification | Handling | Status |
|---|---|---|---|
| Uncompressed partwise `.musicxml` or `.xml` (MusicXML 1.0 to 4.0) | 8.2 row 12, root `score-partwise` | `DOMParser` with `'text/xml'`, walk per part | Conversion |
| Uncompressed timewise | root `score-timewise` | regrouped in memory into per-part measure lists, then the same walk; events are identical to the partwise form | Conversion |
| Compressed `.mxl`, entries stored (method 0) | 8.2 row 6 | M-11 `Zip.read` and `extract`; score located through `META-INF/container.xml` (first `rootfile` with media type absent or `application/vnd.recordare.musicxml+xml`), else the first `.musicxml` or `.xml` entry outside `META-INF/` (W-XML-MXL-NO-CONTAINER) | Conversion |
| Compressed `.mxl`, entries deflated (method 8) | as above | own RFC 1951 inflate with CRC-32 check | Conversion |
| `.mxl` with ZIP64, encryption, other methods (6, 9, 12, 14) or several disks | Zip errors | refused, E-IMP-006 naming the feature | Unsupported |
| `.mxl` whose container names a missing score, or with no score | M-12 | E-IMP-007 | Unsupported |
| Text encodings | BOM or declaration | UTF-8 (default and BOM), UTF-16 LE and BE by BOM; other declared encodings are decoded as UTF-8 (non-fatal) | Supported (UTF-8, UTF-16); Partial (others) |
| `opus` collections | root `opus` | refused, E-IMP-006 | Unsupported |
| DOCTYPE with internal entity declarations | `<!ENTITY` inside the DOCTYPE subset in the first 64 KB | refused before `DOMParser` runs, E-IMP-014 (entity-expansion defense, S-05) | Unsupported |
| External DTD reference without entities | DOCTYPE with a system id | accepted; `DOMParser` never fetches it and the CSP forbids it | Supported |

Limits: XML text <= 25 MB after extraction, archive <= 256 entries and <= 50 MB
uncompressed with ratio <= 100, parts <= 128 (32 kept), measures <= 10,000 per part,
notes <= 1,000,000, repeat expansion <= 40,000 measures, 5 s pipeline budget.

#### 8.4.2 Engraving disclaimer (B 15.3 last paragraph)

MusicXML import is event import. Notation rendering, page layout, engraving and tablature
display are not features of this product and are never inferred from a successful parse.
Every MusicXML report carries the Part 1.5 sentence in `report.notes`, shown as the first
info row on SCR-ImportInspect and repeated in `docs/COMPATIBILITY.md`:

```text
MusicXML files are imported as musical events (notes, timing, dynamics, tempo). Sheet music is not displayed.
```

Layout and notation-only elements (`print`, `defaults`, `credit` positions, `layout`,
`page-layout`, `system-layout`, `staff-layout`, `appearance`, `clef`, `staff-details`,
`measure-style`, `bar-style`, `stem`, `beam`, `notehead`, `accidental` display, `slur`,
`tuplet` brackets, `dot` placement, `fingering`) are covered by that sentence and listed in the
matrix as "notation only, not imported"; they produce no per-file warning because they do not
change what is heard.

#### 8.4.3 Element and attribute table

| Element or attribute | Model mapping | Status | Notes and warnings |
|---|---|---|---|
| `score-partwise`, `score-timewise` `@version` | `source.version` = `MusicXML <version> (partwise or timewise), <software>` | Supported | missing version: `unknown` |
| `work/work-title`, `movement-title`, `credit-words` (type title) | `song.title` (first present in that order, else file stem) | Supported | text via `textContent` only |
| `identification/creator` (composer first) | `song.artist` | Supported | |
| `identification/rights` | `TextEvent type:'copyright'` at tick 0 of the first track | Supported | |
| `encoding/software` | appended to `source.version` (80 chars) | Supported | |
| `part-list/score-part@id`, `part-name` | one Track per part in part-list order, `Track.name` | Supported | part without list entry: W-XML-PART-UNLISTED; list entry without body: skipped |
| `score-instrument` | instrument names (display) | Partial | names are not shown per note; several instruments in one part keep the first `midi-instrument` program |
| `midi-instrument/midi-channel` | `Track.channel` (1-16 -> 0-15) | Supported | parts without one: next free channel skipping 9 (W-XML-NO-MIDI-INSTRUMENT, W-XML-CHANNEL-REUSE beyond 15) |
| `midi-instrument/midi-program` | `Track.program` (1-128 -> 0-127) | Supported | |
| `midi-instrument/midi-bank` | not mapped | Unsupported | GM sound set only; listed in the matrix |
| `midi-instrument/midi-unpitched` | percussion key (1-128 -> 0-127) for `<unpitched>` notes | Supported | |
| `midi-instrument/volume`, `pan` | `ControlEvent` CC 7 and CC 10 at tick 0 | Supported | volume 0-100 scaled to 0-127; pan clamped to -90..90 then 0-127 |
| `sound/midi-instrument` after the first measure, `instrument-change` | not applied | Unsupported | W-XML-INSTRUMENT-CHANGE (D13) |
| `measure`, `@implicit` | measure length from the meter; pickup measures as long as their content | Supported | overfull measures lengthened (W-XML-MEASURE-OVERFULL) |
| `attributes/divisions` | duration scale; positions converted exactly per item | Supported | invalid (not 1-16384): W-XML-DIVISIONS, previous kept |
| `attributes/key` `fifths`, `mode` | `KeyMap` entry | Supported | modes other than major or minor: spelled as major (W-XML-KEY-MODE) |
| `attributes/time` `beats`, `beat-type` | `MeterMap` entry; first part authoritative | Supported | additive `3+2`: summed (W-XML-ADDITIVE-METER); out of range: W-XML-METER-RANGE; parts disagree: W-XML-METER-MISMATCH; `senza-misura`: W-XML-SENZA-MISURA |
| `attributes/transpose` `chromatic`, `octave-change` | sounding pitch = written + chromatic + 12 x octave-change | Supported | W-XML-TRANSPOSED (info) per transposing part; `diatonic` is spelling only |
| `attributes/staves`, staff numbers | all staves of a part in one Track | Supported | the staff number is not kept per note |
| `note/pitch` `step`, `alter`, `octave` | `NoteEvent.pitch` | Supported | fractional `alter`: nearest semitone (W-XML-MICROTONE); outside 0-127 after transposition: clamped (W-XML-PITCH-CLAMPED) |
| `note/unpitched` with `instrument@id` | pitch = that instrument's `midi-unpitched`; track becomes `isDrums` | Supported | no mapping: key 38 (W-XML-UNPITCHED-FALLBACK) |
| `note/rest` | position advance only | Supported | trailing rest measures do not extend `durationTicks` |
| `note/duration` | `NoteEvent.durTicks` (exact rational conversion, rounded once) | Supported | missing: derived from `type`, dots and tuplet (W-XML-DURATION-DERIVED); decimal: rounded (W-XML-DURATION-DECIMAL) |
| `note/type`, `dot`, `time-modification` | used only when `duration` is missing | Supported | unknown type: quarter (W-XML-TYPE-UNKNOWN) |
| `note/chord` | same start tick as the previous note | Supported | |
| `note/tie` (`tied` fallback) | tied notes merged into one NoteEvent spanning measures | Supported | unmatched stop: kept as a new note (W-XML-TIE-UNMATCHED); across a repeat: written length (W-XML-TIE-ACROSS-REPEAT) |
| `note/grace` | 120-tick notes before the principal note, velocity -15, `x.art` `grace` | Conversion | at score start: shortened (W-XML-GRACE-CLAMPED); more than 8 in a row: earliest dropped (W-XML-GRACE-CHAIN) |
| `note/cue` | skipped | Unsupported (cue notes are not performed) | W-XML-CUE-SKIPPED |
| `note/voice` | voices of a part share the Track | Supported | voice number used for tie matching |
| `backup`, `forward` | position cursor | Supported | backup before measure start: clamped (W-XML-BACKUP-UNDERFLOW) |
| `direction/dynamics`, `notations/dynamics` | current velocity (table Part 6.12.4.7: pp 33, p 49, mp 64, mf 80, f 96, ff 112) | Supported | unknown mark: W-XML-DYNAMIC-UNKNOWN |
| `sound@dynamics` | velocity = round(N x 90 / 100) | Supported | |
| `sound@tempo`, `direction/metronome` | `TempoMap` entry (sound wins in the same direction) | Supported | unreadable: W-XML-TEMPO-INVALID; none: 120 BPM (W-XML-NO-TEMPO) |
| `direction/words` | `TextEvent type:'text'` | Supported | expressive words ("rit.", "accel.") are not interpreted |
| `direction/rehearsal` | `Marker kind:'section'` | Supported | repeated occurrences get ` (2)`, ` (3)` |
| `direction/pedal` start, stop, change | `ControlEvent` CC 64 127 and 0 | Supported | |
| `direction/octave-shift` | pitch offset +12 x (size - 1) / 7 (down) or negative (up) | Supported | |
| `direction/wedge` | not applied | Unsupported | W-XML-WEDGE-IGNORED |
| `direction/segno`, `coda`; `sound@dacapo, dalsegno, fine, coda, tocoda, segno` | not expanded; plays once through | Unsupported | W-XML-NAV-UNSUPPORTED (warn) |
| `direction@offset` | shifts the direction's items | Supported | |
| `barline/repeat` forward, backward `@times` | measures expanded in play order (times clamped 2-16) | Supported | expansion over 40,000 measures stops (W-XML-REPEAT-CAP) |
| `barline/ending` numbers, stop, discontinue | ending measures played on matching passes | Supported | endings matching no pass are played once at the end (nothing lost) |
| `notations/articulations` staccato, staccatissimo, detached-legato | duration x 0.5, 0.25, 0.75; `x.art` | Conversion | |
| `notations/articulations` accent, strong-accent | velocity +15, +25; `x.art` | Conversion | |
| `notations/articulations` tenuto | `x.art` only | Supported | |
| other articulations (breath-mark, caesura, spiccato, scoop, plop, doit, falloff, stress, unstress) | `x.art` name only (kept for the visualizer) | Partial | W-XML-ARTICULATION-FLAGGED (D13) |
| `notations/technical/bend` (`bend-alter`, `release`) | `PitchBendEvent`s at the note start, middle and end | Conversion | over 2 semitones: clamped (W-XML-BEND-RANGE) |
| `notations/technical` hammer-on, pull-off, harmonic, string, fret | `x.art` flags, `x.tab {string, fret}` | Partial | no pitch glide or harmonic pitch change |
| other `notations/technical` (fingering, up-bow, down-bow, pluck, tap, heel, toe, open-string, thumb-position) | not applied | Unsupported | W-XML-TECHNICAL-IGNORED (notation only, loss no) |
| `notations/ornaments` (trill-mark, turn, mordent, inverted-mordent, shake, wavy-line, tremolo) | written note plays plain; `x.art` `ornament:<name>` | Unsupported | W-XML-ORNAMENT-UNSUPPORTED; `tremolo`: W-XML-TREMOLO-IGNORED |
| `notations/glissando`, `slide` | not played | Unsupported | W-XML-GLISS-UNSUPPORTED |
| `notations/arpeggiate`, `non-arpeggiate` | chord plays together | Unsupported | W-XML-ARPEGGIO-IGNORED |
| `notations/fermata` | not applied (no hold) | Unsupported | W-XML-FERMATA-IGNORED (D13) |
| `lyric number="1"` with `syllabic`, `elision` | `TextEvent type:'lyric'` at the note tick (`-` suffix for begin and middle) | Partial | other lyric lines: W-XML-LYRIC-LINES |
| `harmony` (chord symbols) | not imported | Unsupported | W-XML-HARMONY-IGNORED |
| `figured-bass` | not imported | Unsupported | W-XML-FIGURED-BASS-IGNORED |
| `print`, `bookmark`, `link`, `grouping`, `listening`, layout elements | ignored | Unsupported (notation only) | covered by the engraving sentence (8.4.2) |
| Text injection (markup inside text nodes, `<script>` elements in foreign namespaces) | text read with `textContent`; unknown elements ignored | Supported (safe) | never executed or inserted as HTML (S-05) |

#### 8.4.4 E 3.3 case table (MusicXML part)

| Case (E 3.3) | Behavior | Warning | Corpus file |
|---|---|---|---|
| Compressed MusicXML instead of uncompressed | `.mxl` path, same events | none (W-XML-MXL-NO-CONTAINER without container) | `mxl-stored.mxl`, `mxl-deflate.mxl`, `mxl-no-container.mxl` |
| Multiple parts, voices or staves | one Track per part; voices and staves merged in time | none | `xml-parts-voices-staves.musicxml` |
| Chords and tied notes crossing measure boundaries | chord members share a tick; ties merged into one event | none | `xml-chords-ties-tuplets.musicxml` |
| Tuplets and unusual subdivisions | exact rational durations | none | `xml-chords-ties-tuplets.musicxml` |
| Repeats and alternate endings | expanded in play order | none | `xml-repeats-endings.musicxml` |
| Transposing instruments | sounding pitch | W-XML-TRANSPOSED | `xml-transposing.musicxml` |
| Notation-to-event conversion loses notation-specific information | engraving sentence on every import; performance-relevant losses each have a code | per element | `xml-unsupported.musicxml` |
| Valid file with no playable events | imports; `playable:false`; Studio still opens it | W-IMP-NO-NOTES | `xml-no-notes.musicxml` |

### 8.5 Guitar Pro preservation

#### 8.5.1 Versions and identification (B 15.4 "identify the specific versions and file extensions")

The only accepted files are the binary GP3, GP4 and GP5 formats whose 31-byte version block
(`u8` length, then the ASCII string padded to 30 bytes) holds one of six whitelisted strings.
No other version is parsed, and the product never claims universal Guitar Pro support.

| Version string (exact) | Label (`source.version`) | Usual extension | Status | Corpus file |
|---|---|---|---|---|
| `FICHIER GUITAR PRO v3.00` | `GP3 v3.00` | `.gp3` | Conversion | `gp3-basic.gp3` |
| `FICHIER GUITAR PRO v4.00` | `GP4 v4.00` | `.gp4` | Conversion | `gp4-v400.gp4` |
| `FICHIER GUITAR PRO v4.06` | `GP4 v4.06` | `.gp4` | Conversion | `gp4-basic.gp4` |
| `FICHIER GUITAR PRO L4.06` | `GP4 L4.06` | `.gp4` | Conversion | `gp4-l406.gp4` |
| `FICHIER GUITAR PRO v5.00` | `GP5 v5.00` | `.gp5` | Conversion | `gp5-effects.gp5` |
| `FICHIER GUITAR PRO v5.10` | `GP5 v5.10` | `.gp5` | Conversion | `gp5-basic.gp5` |

Identification of refused Guitar Pro files (all Unsupported; texts are exact):

| File kind | Signature | Where refused | Code and text | Corpus file |
|---|---|---|---|---|
| Guitar Pro 1 (`.gtp`) | version string starts `FICHIER GUITARE PRO v1` | M-13 `parse` (stage parse) | E-IMP-006 "This is a Guitar Pro 1 or 2 file. Only Guitar Pro 3, 4 and 5 files (.gp3, .gp4, .gp5) can be imported. Open it in Guitar Pro and save it as GP5." | (UT-13-01) |
| Guitar Pro 2 (`.gtp`) | starts `FICHIER GUITAR PRO v2` | M-13 `parse` | same text | `gp2-unsupported.gtp` |
| Guitar Pro clipboard data | starts `CLIPBOARD GUITAR PRO` | M-13 `parse` | E-IMP-006 "This is Guitar Pro clipboard data, not a song file." | (UT-13-01) |
| Any other `FICHIER GUITAR PRO` string (for example `v5.20`, `v3.10`) | not in the whitelist | M-13 `parse` | E-IMP-006 "Guitar Pro version "{raw}" is not supported. Only Guitar Pro 3, 4 and 5 files can be imported." | (UT-13-01) |
| Guitar Pro 6 (`.gpx`) | `BCFZ` at offset 0 | M-14 identify (stage identify) | E-IMP-006 "This is a Guitar Pro 6 or 7 file (.gpx or .gp). Only Guitar Pro 3, 4 and 5 files (.gp3, .gp4, .gp5) can be imported. Export the file as GP5 or as MIDI from Guitar Pro and import that." | `gp6-file.gpx` |
| Guitar Pro 7 and 8 (`.gp`) | ZIP with entry `Content/score.gpif` | M-14 identify | same GP6/GP7 text | `gp7-file.gp` |
| Named `.gp3 .gp4 .gp5 .gpx .gp .gtp` but no signature | 8.2 row 21 | M-14 identify | E-IMP-006 "The Guitar Pro version was not recognized. Only Guitar Pro 3, 4 and 5 files can be imported." | (UT-14-01) |

Every Guitar Pro import carries the info line in `report.notes`: "Guitar Pro {version}
imported. Tablature effects are converted as listed in the warnings; the matrix on the
About screen lists what is preserved." Tablature is never displayed (Part 1.5).

#### 8.5.2 Feature table

| Feature | Versions | Model mapping | Status | Notes and warnings |
|---|---|---|---|---|
| Song information (title, subtitle, artist, album, words, music, copyright, tab author, instructions, notices) | 3, 4, 5 | `song.title`; `song.artist` (artist, else music, else words); the rest in `song.x.info` | Supported | text Windows-1252 decoded, names 128 chars |
| Track name, color | 3, 4, 5 | `Track.name`; color not used (palette color) | Partial | the GP color is not kept |
| String count and tuning (1-7 strings) | 3, 4, 5 | pitch = tuning[string] + capo + fret; `NoteEvent.x.tab = {string, fret}` (string 1 = highest) | Supported | alternate tunings exact |
| 12-string and banjo flags | 3, 4, 5 | not used (12-string octave doubling is not synthesized) | Unsupported | listed in the matrix |
| Capo | 3, 4, 5 | added to every pitch | Supported | out of range: clamped (W-GP-CAPO-RANGE) |
| String and fret per note | 3, 4, 5 | `x.tab` | Supported | fret out of range: clamped (W-GP-FRET-RANGE); string beyond the track's count: dropped (W-GP-STRING-INDEX) |
| Rhythmic duration (whole to 64th), dots, tuplets 3, 5, 6, 7, 9-13 | 3, 4, 5 | exact integer arithmetic in units of 1/18018 tick, rounded once per tick | Supported | other tuplet values: plain duration (W-GP-TUPLET-UNKNOWN) |
| Rests and empty beats | 3, 4, 5 | position advance | Supported | unknown beat status: rest (W-GP-BEAT-STATUS) |
| Second voice | 5 | merged into the same Track | Supported | |
| Measure headers: time signature, double bar | 3, 4, 5 | `MeterMap`; double bar has no event | Supported | |
| Key signature (header and per measure, major or minor) | 3, 4, 5 | `KeyMap` | Supported | GP3 measure keys are major; out of range: C major (W-GP-KEY-RANGE) |
| Tempo (header) | 3, 4, 5 | `TempoMap` tick 0 | Supported | outside 1-999: clamped (W-GP-TEMPO-RANGE) |
| Markers | 3, 4, 5 | `Marker kind:'section'` at the measure start | Supported | repeats add ` (2)` suffixes |
| Repeats (open, close with count) | 3, 4, 5 | expanded in play order (GP3/GP4 count = extra plays, GP5 = plays; `REPEAT_CLOSE_OFFSET`) | Supported | zero repeats ignored (W-GP-REPEAT-ZERO); above 40,000 measures: W-GP-REPEAT-CAP; the convention is confirmed by an LT test with real files (Part 6.13.9) |
| Alternate endings (GP3 number, GP4/GP5 bitmask) | 3, 4, 5 | ending measures on matching passes | Supported | |
| Directions (coda, segno, da capo, fine and their 19 combinations) | 5 | not expanded; plays once through | Unsupported | W-GP-NAV-UNSUPPORTED (warn) |
| Triplet feel (swing) | 3, 4 (header), 5 (measure) | not applied; straight timing | Unsupported | W-GP-TRIPLET-FEEL |
| MIDI channel table (64 channels: program, volume, balance) | 3, 4, 5 | `Track.program`; CC 7 and CC 10 at tick 0 | Supported | invalid program: piano (W-GP-CHANNEL-RANGE); ports 2-4 share the 16 channels (W-GP-PORT-COLLAPSED); chorus, reverb, phaser, tremolo sends not applied (listed in the matrix) |
| Drum tracks (flag 0x01 or channel 10) | 3, 4, 5 | `isDrums:true`, channel 9, pitch = fret (GM key) | Supported | |
| Mix table change: instrument | 3, 4, 5 | `ProgramEvent` at the beat tick | Supported | |
| Mix table change: volume, balance | 3, 4, 5 | `ControlEvent` CC 7, CC 10 at the beat tick | Supported | gradual transitions applied immediately |
| Mix table change: tempo | 3, 4, 5 | `TempoMap` entry at the beat tick | Supported | ramp duration ignored (W-GP-TEMPO-RAMP-IGNORED) |
| Mix table change: chorus, reverb, phaser, tremolo | 3, 4, 5 | not applied | Unsupported | listed in the matrix |
| Note velocity (dynamics ppp to fff), accent, heavy accent, ghost | 3, 4, 5 | velocity table (Part 6.13.4.8) +15, +25, -20 | Conversion | |
| Tied notes | 3, 4, 5 | previous note on the same string extended | Supported | no predecessor: new note (W-GP-TIE-UNMATCHED) |
| Let ring | 3, 4, 5 | duration extended to the next note on the same string, at most +3,840 ticks (one 4/4 bar) | Conversion | `x.art` `let-ring` |
| Dead notes | 3, 4, 5 | velocity 20, duration at most 120 ticks | Conversion | `x.art` `dead` |
| Palm muting | 3, 4, 5 | velocity -20, duration x 0.6 | Conversion | `x.art` `palm-mute` |
| Staccato | 4, 5 | duration x 0.5 | Conversion | |
| Note length percentage | 5 | duration x percent | Conversion | W-GP-DURATION-PERCENT (info, loss no) |
| Bends (note) and tremolo bar (beat) | 3, 4, 5 | `PitchBendEvent`s at the bend points, range +/-2 semitones, reset after the note | Conversion | over 2 semitones: clamped (W-GP-BEND-RANGE); `x.art` `bend` or `tremolo-bar` |
| Slides (shift, legato, in, out) | 3 (legato only), 4, 5 | `x.art` `slide:<kind>`; no pitch glide | Partial | listed in the matrix (flags only, no warning) |
| Hammer-on and pull-off | 3, 4, 5 | `x.art` `hammer-pull`; note plays normally | Partial | listed in the matrix |
| Harmonics natural | 3, 4, 5 | pitch from the node table (fret 12 -> +12, 7 or 19 -> +19, 5 or 24 -> +24, 4, 9 or 16 -> +28, 3 -> +31) | Conversion | other frets approximated +12 (W-GP-HARMONIC-APPROX) |
| Harmonics artificial, tapped, pinch, semi | 3 (artificial), 4, 5 | pitch +12 | Partial | W-GP-HARMONIC-APPROX |
| Grace notes (before and on the beat, dead grace, transition) | 3, 4, 5 | 120-tick NoteEvent; on-beat grace delays the main note | Conversion | `x.art` `grace:<transition>` |
| Vibrato (note and beat) | 3, 4, 5 | `x.art` `vibrato` | Partial | no pitch modulation |
| Trill | 4, 5 | plays as one note; `x.art` `trill:<fret>:<period>` | Unsupported | W-GP-TRILL-UNSUPPORTED |
| Tremolo picking | 4, 5 | plays as one note; `x.art` `tremolo-picking` | Unsupported | W-GP-TREMOLO-PICKING |
| Tap, slap, pop | 3, 4, 5 | `x.art` flags | Partial | |
| Strokes (strum direction), pick stroke, rasgueado | 3, 4, 5 | not applied | Unsupported | W-GP-STROKE-IGNORED |
| Fade in | 3, 4, 5 | not applied | Unsupported | W-GP-FADE-IN-IGNORED (D14) |
| Beat text | 3, 4, 5 | `TextEvent type:'text'` | Supported | |
| Chord diagrams | 3, 4, 5 | chord name as `TextEvent`; diagram and fingering skipped | Partial | W-GP-CHORD-NAME-ONLY |
| Lyrics (5 lines, start measure) | 4, 5 | line 1 as `TextEvent type:'lyric'` on note beats | Partial | other lines: W-GP-LYRIC-LINES; bad track: W-GP-LYRIC-TRACK |
| Time-independent note duration | 3, 4 | not used; beat durations apply | Unsupported | W-GP-NOTE-DURATION |
| RSE sound data, master effects, EQ | 5 | skipped; the GM program from the channel table is used | Unsupported | listed in the matrix (no per-file warning; covered by the "synthesized" sentence) |
| Page setup, tempo name, hide tempo | 5 | skipped | Unsupported (layout only) | no warning |
| Visible, solo and mute track flags | 5 | `mix.solo`, `mix.mute` | Supported | visibility not kept |

#### 8.5.3 E 3.3 case table (Guitar Pro part)

| Case (E 3.3) | Behavior | Warning | Corpus file |
|---|---|---|---|
| Alternate tuning or a capo | exact sounding pitch | none | `gp5-tuning-capo.gp5` |
| Unsupported effects | note plays plain or approximated; each effect named | W-GP-* per 8.5.2 | `gp5-effects.gp5`, `gp5-drums-mix-directions.gp5` |
| File created by an unsupported version | refused with the version named | E-IMP-006 | `gp2-unsupported.gtp`, `gp6-file.gpx`, `gp7-file.gp` |
| Notation-to-MIDI conversion loses notation information | `x.tab`, `x.art` keep the tab data; losses reported | W-GP-* | `gp5-effects.gp5` |
| Repeats and alternate endings | expanded | none | `gp5-repeats.gp5`, `gp4-basic.gp4` |
| Truncated file | complete measures kept | W-GP-TRUNCATED | `gp5-basic.trunc-measure9.gp5` |
| Damaged layout | refused with the byte offset | E-IMP-003 | `gp5-basic.bad-strings.gp5`, `gp5-basic.trunc-header.gp5` |

### 8.6 Audio import policy (B 15.5, E 3.4)

#### 8.6.1 What an audio file becomes

An audio file becomes exactly one `Track {kind:'audio', events:[], audioRef}` (Part 5.1.2)
in a new Song (import screen) or in the open project (Studio "Add audio track", which runs
the same pipeline and appends the track through a Studio command). It never becomes note
data, a chart, or a dance chart. Decoding uses `decodeAudioData` on `Audio.ctx()` (or a
2-frame `OfflineAudioContext` before the unlock gesture; decoding needs no gesture). The
report is `playable:false`, `status` `Conversion` (or `Partial` with W-AUD-DOWNMIX), and its
first info row is the exact Part 1.5 sentence:

```text
Audio files are imported as backing audio only. Notes cannot be generated from audio in this version; use a MIDI, MusicXML or Guitar Pro file for a playable chart.
```

No screen, help text, achievement or matrix row may suggest that audio can be turned into
notes, a chart or a tempo map (B 15.5, E 3.4, I 6.4).

#### 8.6.2 Formats by browser decoding support

Decoding is delegated to the browser; the game adds no codec. Every successful audio
import is a Conversion (8.7.1); the "Decode status" column states where decoding works:
Supported = expected in every target browser, Partial = in some, Unsupported = in none. The
"Expected" columns are the design assumption at plan time; `docs/COMPATIBILITY.md` shows a
cell as verified only after an XT run records it (8.7.2 section 5). "No" cells end in
E-IMP-008 "Your browser cannot decode this audio file. WAV files work in every supported
browser."

| Container and codec | Extensions | Decode status | Chromium desktop and Android (expected) | Firefox desktop (expected) | Safari desktop and iOS (expected) | Headless test Chromium (Playwright build) |
|---|---|---|---|---|---|---|
| WAV PCM 16-bit and 24-bit integer, 32-bit float | `.wav` | Supported | yes | yes | yes | yes (corpus `audio-sine-1s.wav`) |
| WAV with other codecs (ADPCM, A-law, mu-law, unknown) | `.wav` | Unsupported | no (E-IMP-008) | partly | partly | no (corpus `audio-unknown-codec.wav`) |
| MP3 (MPEG-1/2 layer III, CBR and VBR) | `.mp3` | Partial | yes | yes | yes | yes |
| Ogg Vorbis, Ogg Opus | `.ogg .oga .opus` | Partial | yes | yes | no | yes |
| FLAC | `.flac` | Partial | yes | yes | yes | yes |
| AAC in MP4 or ADTS | `.m4a .mp4 .aac` | Partial | yes (Chrome); no in builds without proprietary codecs | yes on platforms with a system decoder | yes | no (the Playwright Chromium build has no AAC decoder; AAC is covered by XT and LT only) |

Variable bitrate MP3 (E 3.4): decoded by the browser like CBR; the duration is
`buffer.duration` after decoding, never estimated from the header, so VBR files have no
duration error. An LT test with a real VBR file checks this (Part 12).

#### 8.6.3 Synchronization offset `syncOffsetMs`

| Item | Decision |
|---|---|
| Meaning | `audioRef.syncOffsetMs` (int, -30,000..30,000) is the song time at which buffer time 0 sounds: positive = the audio starts later than tick 0, negative = the first `-syncOffsetMs` of the buffer are skipped |
| Default | 0 at import; not guessed from content |
| Playback rule | `Import.AudioTrack.startOffsetSeconds(track, tick, effectiveTempoMap)`: `t = ticksToSeconds(tick) - syncOffsetMs / 1000`; `t >= 0` -> start the buffer at offset `t` immediately at `audioTimeAt(tick)`; `t < 0` -> start at offset 0 after a delay of `-t` (D15) |
| Seek, loop, resume | the source node is restarted from the rule above at the new tick (loop wrap at `transport.loop.atAudioTime`); a node that ends before the song does is not restarted |
| Tempo changes and `tempoOverride` | audio is in seconds and does not follow tempo; the rule uses the Transport's effective map, so bars move against the audio when the user changes tempo (stated on the track inspector: "Audio does not follow tempo changes.") |
| Leading silence (E 3.4) | W-AUD-LEADING-SILENCE reports it (D6); the inspector button "Align start" sets `syncOffsetMs = -leadingSilenceMs`; never applied automatically |
| Long fade-out (E 3.4) | kept; `durationTicks` includes the whole buffer (D11); nothing is trimmed |
| Missing tempo or beat metadata (E 3.4) | the new Song uses 120 BPM 4/4 with W-AUD-NO-TEMPO; the Studio tempo control changes the grid only |
| Audio and MIDI with different start offsets (E 3.4) | the audio track carries its own `syncOffsetMs`; MIDI tracks are not moved |
| Controls | SCR-ImportInspect (audio report) and the SCR-Studio track inspector: number field in ms (step 10), nudge buttons -100, -10, +10, +100 ms, "Align start", "Reset to 0"; changes in Studio are an undoable `setAudioOffset` command |
| Calibration interaction | none: `syncOffsetMs` aligns content, `audioLatencyMs` aligns the device (Part 5.12); neither is added to the other |

#### 8.6.4 Limits and memory

| Limit | Value | Check | Code |
|---|---|---|---|
| Encoded file size | <= 100 MB | `validateFile` | E-IMP-001 |
| Duration | <= 2 h (7,200 s) | after decoding | E-IMP-004 "Audio longer than 2 hours is not supported." |
| Decoded size per project (sum over attached buffers; `length x channels x 4` bytes) | <= 192 MB when `Caps.maxTouchPoints === 0`, else <= 64 MB (about 8.3 min and 2.8 min of 48 kHz stereo) | after decoding, before attaching | E-IMP-004 "This audio file is too large to hold in memory on this device ({n} MB decoded)." |
| Audio tracks per Song | <= 4 | before decoding | E-IMP-004 (D8) |
| Decode time | 60 s watchdog | `decodeAudioData` | E-IMP-005 (8.1.2) |
| Channels | 1-2 kept; more are downmixed | after decoding | W-AUD-DOWNMIX |
| Large buffer notice | decoded size above 50 percent of the cap | after decoding | W-AUD-LARGE |

Decoded buffers live only in `Import.AudioTrack` (counted by `Import.audioBufferCount()` in
`Modes.assertClean`) and are released by `Import.releaseAudio(trackId)` when the track is
deleted, when SCR-ImportInspect is cancelled, and when a project without that track is
loaded. They are never written to localStorage or IndexedDB (W-AUD-NOT-PERSISTED); a
reopened project shows the track as "Audio missing - import <fileName> again" with a "Find
file" button that runs the pipeline and re-attaches the buffer when the decoded duration
matches `audioRef.durationS` within 50 ms (else the toast "This file has a different length;
it was added as a new track."). MediaRecorder captures (the OQ-2 alternative) are stored
in the `recordings` IndexedDB store, not as audio tracks.

#### 8.6.5 Speed and practice

Audio tracks play only at speed 1.0 (D16). When the user sets any other speed the audio
tracks stop, the speed control shows "Audio tracks are silent at speeds other than 1.0x.",
and they restart at the current position when the speed returns to 1.0. A song whose only
tracks are audio cannot start a gameplay mode (no chart can exist) and opens in the Studio.

### 8.7 Published compatibility matrix (`docs/COMPATIBILITY.md`)

#### 8.7.1 Summary matrix (the content of `docs/COMPATIBILITY.md` section 2)

Verifying tests name the FT subgroups of the `files` self-test group (8.9.1); each corpus
file is one FT test named `files.<subgroup>.<file name>`; Part 12 assigns the FT-nnn IDs.
XT and LT categories are defined in Part 12.

| Format | Versions | Status | Preserved | Not preserved | Limits | Verifying tests |
|---|---|---|---|---|---|---|
| Standard MIDI File | SMF format 0 and 1, PPQ division (`.mid .midi .smf .kar`) | Supported | notes (pitch, velocity, off velocity, duration, channel), tempo map, time and key signatures, program changes and bank select, every controller as an event, pitch bend, sustain pedal, track names, text, lyrics, markers, cue points, copyright, percussion channel 10, polyphony and multitrack structure | aftertouch (polyphonic and channel), system exclusive, sequencer-specific and unknown meta events, SMPTE offset, port and sequence-number metas, trailing silence after the last event; controllers without a synthesizer effect are kept but not heard (W-IMP-CC-NO-PLAYBACK); pitch-bend range other than 2 semitones is not applied (W-IMP-BEND-RANGE) | file 25 MB; 128 MTrk, 32 tracks kept per song (selection above 32); 1,000,000 events; 5 s import budget | `files.midi`, `files.midi-damaged`, `files.limits`, `files.roundtrip`; XT import per browser; LT 3 real files |
| Standard MIDI File | SMF format 2 | Conversion | each sequence imported as its own song with everything listed for format 0 and 1 | the relation between sequences (they are never played together) | as above | `files.midi` (`midi-format2.mid`) |
| Standard MIDI File | SMPTE time division (24, 25, 29.97, 30 fps) | Conversion | event timing in seconds (converted to a 120 BPM grid) | musical bar and beat positions; tempo metas | as above | `files.midi` (`midi-smpte-25.mid`) |
| RIFF MIDI | `.rmi` | Unsupported | nothing | everything (refused with a message) | n/a | `files.ident` (`riff-midi.rmi`) |
| MusicXML | 1.0 to 4.0, partwise and timewise, uncompressed (`.musicxml .xml`) | Conversion | parts and MIDI instrument assignments, measures, notes, rests, chords, durations and divisions, ties, tuplets and dots, time and key signatures, tempo (sound tempo and metronome), dynamics, staccato, staccatissimo, accent, strong accent, tenuto, repeats and alternate endings, transposing instruments, octave shifts, unpitched percussion, pedal marks, rehearsal marks, words, first lyric line, guitar bends | sheet music display and engraving, chord symbols, figured bass, ornaments (play as written notes), glissando and slides, arpeggio and tremolo marks, fermatas, hairpins, da capo, dal segno, fine and coda navigation, cue notes, further lyric lines, mid-part instrument changes, microtones (rounded), MIDI bank | XML 25 MB; 128 parts (32 kept); 10,000 measures per part; 1,000,000 notes; 40,000 expanded measures; 5 s | `files.musicxml`, `files.security`, `files.limits`; XT; LT 3 real files |
| MusicXML compressed | `.mxl`, entries stored or deflated | Conversion | as uncompressed MusicXML | as uncompressed MusicXML | 256 archive entries; 50 MB uncompressed; compression ratio 100 | `files.mxl` |
| MusicXML | `opus` collections; `.mxl` with ZIP64, encryption or other compression methods; documents declaring entities | Unsupported | nothing | everything (refused with a message) | n/a | `files.musicxml`, `files.mxl`, `files.security` |
| Guitar Pro | GP3 v3.00; GP4 v4.00, v4.06, L4.06; GP5 v5.00, v5.10 (`.gp3 .gp4 .gp5`) | Conversion | tracks and instruments, string and fret, tuning (1-7 strings) and capo, durations, dots and tuplets, second voice (GP5), time and key signatures, tempo and mix-table tempo, markers, repeats and alternate endings, drum tracks, mix-table instrument, volume and pan, tied and let-ring notes, dead notes, palm muting, staccato, accents, ghost notes, bends and tremolo bar (as pitch bend), natural harmonics, grace notes, beat text, chord names, first lyric line | tablature display, slides and hammer-ons (kept as flags, no pitch glide), artificial, tapped and pinch harmonics (approximated one octave up), vibrato (flag only), trills and tremolo picking (single notes), strokes, rasgueado and fade in, triplet feel, coda and segno directions, chord diagram fingering, further lyric lines, RSE sound data, chorus, reverb, phaser and tremolo sends, 12-string doubling | file 25 MB; 128 tracks (32 kept); 10,000 measures; 1,000,000 notes; 7 strings; 5 s | `files.gp`, `files.limits`; LT 3 real files per major version (repeat convention check, Part 6.13.9) |
| Guitar Pro | GP1, GP2, clipboard data, unlisted version strings, GP6 (`.gpx`), GP7 and GP8 (`.gp`) | Unsupported | nothing | everything (refused with the version named) | n/a | `files.gp`, `files.ident` |
| Audio | WAV PCM | Conversion | sound as a backing audio track with a sync offset | notes (no transcription), tempo and beats, speed change (silent at speeds other than 1.0x), persistence of decoded audio (metadata only; re-import after reload) | file 100 MB; 2 h; decoded 192 MB desktop or 64 MB mobile per project; 4 audio tracks | `files.audio`; XT per browser |
| Audio | MP3, Ogg Vorbis and Opus, FLAC, AAC and M4A | Conversion where the browser decodes the codec, otherwise Unsupported in that browser (8.6.2) | as WAV | as WAV | as WAV | `files.audio` (fake files for the refusal path); XT per browser and codec; LT one real file per codec |
| SoundFont | `.sf2` | Unsupported | nothing | everything (sound banks cannot be loaded in this version) | n/a | `files.ident` (`soundfont.sf2`) |
| Anything else | unknown content | Unsupported | nothing | everything | n/a | `files.ident` (`unknown-random.bin`) |

Row status rule: a format row is Supported when every item in its Preserved column imports
without loss into the same kind of representation (events stay events) and every item in
Not preserved is a feature the model does not hold, listed with its own status in 8.3 to
8.6; Conversion when the input is turned into a different representation (Part 0.9.3:
notation becomes events, audio becomes an audio track, frames become ticks); Unsupported
when the file is refused. Per-feature statuses are in 8.3 to 8.6 and
are reproduced in `docs/COMPATIBILITY.md` section 3. The data object
`FLM.Import.COMPATIBILITY` (Part 6.14.4.9) carries exactly these rows and statuses: its
`versions` entries for MusicXML (partwise, timewise, `.mxl`) and Guitar Pro (GP3, GP4, GP5)
use `Conversion`, and its audio `versions` use `Conversion` with the browser note; the
UT-14-19 shape test and the FT test `files.ident.compat-table` compare it field by field
with a frozen copy of this table embedded in `src/92-test-files.js`.

#### 8.7.2 `docs/COMPATIBILITY.md` layout

Written in Phase 12 (Part 11) from this section and updated in Phase 15 with recorded
evidence; UTF-8 with BOM, LF. Sections in this order:

1. Title "Finger Lickin Music - file compatibility", build version (`FLM.VERSION`), date,
   and the sentence "Status words: Supported, Partial, Conversion, Unsupported. A claim is
   listed only with the test evidence in section 5."
2. Summary matrix: the table of 8.7.1.
3. Feature tables: the Status columns of 8.3.1-8.3.3 (MIDI), 8.4.1 and 8.4.3 (MusicXML),
   8.5.1 and 8.5.2 (Guitar Pro), 8.6.2 (audio), each as "Feature | Status | Note".
4. Fixed statements (verbatim): the Part 1.5 sentences for audio, MusicXML engraving and
   Guitar Pro 6 and 7; "Instruments are synthesized; timbres approximate General MIDI
   programs."; "Import never changes the open project until you confirm."
5. Evidence table: `Format or version | Test group or LT id | Browser and version | Device | Date | Result (pass or fail) | Notes`;
   one row per FT run of the `files` group (headless Chromium from `tools/selftest.mjs`), per
   XT browser run, and per LT real-file import. A matrix row without a passing evidence row
   is shown with "(not yet verified)" after its status word.
6. Limits table: every limit of 8.3 to 8.6 with its value and error code.
7. "Reporting a file that fails": export diagnostics from SCR-Diagnostics (song content is not
   included unless the user ticks "Attach the file", Part 10.10) and the warning codes shown.

#### 8.7.3 In-game rendering

SCR-About renders section 2 and section 4 from `FLM.Import.COMPATIBILITY` (not from the
Markdown file, which the page cannot read) and appends "Last verified: see
docs/COMPATIBILITY.md". SCR-ImportInspect links each refused file and each Partial report to
that view ("What is supported?").

### 8.8 Warning code catalog

Every `ImportWarning` (Part 5.1.4) shown on SCR-ImportInspect comes from the tables below.
Placeholders in braces are filled by the emitter (`{n}` count or number, `{name}` a name,
`{value}` a value); the filled message is at most 200 ASCII characters, truncated with
"..." otherwise. "Loss" feeds the report status rule (8.1.3): `yes` means information present
in the source is absent from, or altered in, the imported Song; `no` means nothing the
source specifies is lost (defaults for missing data, structural notices, playback-only
limitations of data that is kept). Warnings are coalesced per (code, track) with `count`
(Part 6.10.4.1 item 5). Severity order on screen: error, warn, info.

#### 8.8.1 `W-MIDI-*` (emitted by M-10)

| Code | Severity | Loss | Message |
|---|---|---|---|
| W-MIDI-HEADER-LENGTH | info | no | MIDI header is {n} bytes long; the extra bytes were skipped. |
| W-MIDI-NO-TRACKS | warn | no | The MIDI header declares no tracks; the file is empty. |
| W-MIDI-TRACK-COUNT | info | yes | The header declares {n} tracks but the file contains {value}. |
| W-MIDI-UNKNOWN-CHUNK | info | no | Unknown chunk "{name}" was skipped. |
| W-MIDI-TRAILING-BYTES | info | no | {n} bytes after the last chunk were ignored. |
| W-MIDI-TRUNCATED | warn | yes | The file ends early ({n} bytes missing); events read before the cut were kept. |
| W-MIDI-BAD-VLQ | warn | yes | A delta time is longer than 4 bytes; the rest of track {n} was skipped. |
| W-MIDI-BAD-STATUS | warn | yes | Invalid status byte 0x{value} at offset {n}; the rest of this track was skipped. |
| W-MIDI-BAD-DATA | warn | yes | {n} events with out-of-range data bytes were dropped. |
| W-MIDI-RUNNING-STATUS-AFTER-META | info | no | Running status continued across a meta event (accepted). |
| W-MIDI-IGNORED-EVENT | info | yes | {name} messages are not used ({n} ignored). |
| W-MIDI-SYSEX-SKIPPED | info | no | System exclusive data was skipped ({n} messages). |
| W-MIDI-SEQ-SPECIFIC | info | no | Sequencer-specific meta events were skipped ({n}). |
| W-MIDI-UNKNOWN-META | info | no | Unknown meta event type 0x{value} was skipped ({n}). |
| W-MIDI-META-LENGTH | warn | yes | A {name} meta event has an invalid length and was ignored. |
| W-MIDI-DATA-AFTER-EOT | info | no | {n} bytes after End of Track in track {value} were ignored. |
| W-MIDI-NO-EOT | info | no | Track {n} has no End of Track event; its end is the last event. |
| W-MIDI-TEMPO-ZERO | warn | yes | A tempo of 0 was ignored. |
| W-MIDI-METER-RANGE | warn | yes | A time signature value was out of range and was adjusted or ignored. |
| W-MIDI-KEY-RANGE | warn | yes | A key signature value was out of range and was ignored. |
| W-MIDI-DUPLICATE-META | info | yes | Conflicting {name} values at the same position; the last one was used. |
| W-MIDI-MAP-TRUNCATED | warn | yes | More than {n} {name} entries; only the first {n} were kept. |
| W-MIDI-NO-TEMPO | info | no | No tempo in the file; 120 BPM is used. |
| W-MIDI-NO-METER | info | no | No time signature in the file; 4/4 is used. |
| W-MIDI-NO-KEY | info | no | No key signature in the file; C major is assumed for note spelling. |
| W-MIDI-NO-PROGRAM | info | no | {n} tracks have no program change; Acoustic Grand Piano is used. |
| W-MIDI-SMPTE | info | no | Timing was converted from SMPTE frames at 120 BPM; bar lines may not align with the music. |
| W-MIDI-SMPTE-TEMPO-IGNORED | info | no | Tempo events in a SMPTE-timed file do not affect timing and were ignored. |
| W-MIDI-TICK-ROUNDING | info | no | Source resolution {value} PPQ was rounded to 960 PPQ (maximum error half a tick). |
| W-MIDI-FORMAT2 | warn | no | MIDI format 2 contains {n} independent sequences; choose one to import. |
| W-MIDI-MULTI-CHANNEL | info | no | Track "{name}" uses {n} MIDI channels and was split into one track per channel. |
| W-MIDI-TEXT-ONLY-TRACK | info | no | Track "{name}" contains only text or lyrics. |

#### 8.8.2 `W-XML-*` (emitted by M-12)

| Code | Severity | Loss | Message |
|---|---|---|---|
| W-XML-NO-MIDI-INSTRUMENT | info | no | Part "{name}" has no MIDI instrument; Acoustic Grand Piano on the next free channel is used. |
| W-XML-PART-UNLISTED | info | no | Part "{name}" is not in the part list; defaults were used. |
| W-XML-CHANNEL-REUSE | info | no | More than 15 parts without MIDI channels; channels were reused. |
| W-XML-DIVISIONS | warn | yes | Invalid divisions value {value}; the previous value was kept. |
| W-XML-KEY-MODE | info | yes | Key mode "{name}" was treated as major for spelling. |
| W-XML-METER-RANGE | warn | yes | Time signature {value} is out of range and was ignored. |
| W-XML-METER-MISMATCH | warn | yes | Parts disagree on the time signature; the first part's signature is used. |
| W-XML-ADDITIVE-METER | info | no | Additive time signature {value} was summed. |
| W-XML-SENZA-MISURA | info | no | A measure without time signature keeps the previous signature. |
| W-XML-TRANSPOSED | info | no | Part "{name}" is a transposing instrument; pitches were converted to sounding pitch. |
| W-XML-BACKUP-UNDERFLOW | warn | yes | A backup moved before the start of a measure and was clamped. |
| W-XML-DYNAMIC-UNKNOWN | info | yes | Dynamic mark "{name}" is not recognized; the previous level was kept. |
| W-XML-TEMPO-INVALID | warn | yes | A tempo marking was unreadable and was ignored. |
| W-XML-NO-TEMPO | info | no | No tempo marking; 120 BPM is used. |
| W-XML-NAV-UNSUPPORTED | warn | yes | Navigation marks (da capo, dal segno, fine, coda) are not expanded; the score plays through once. |
| W-XML-WEDGE-IGNORED | info | yes | Crescendo and diminuendo hairpins are not applied ({n}). |
| W-XML-CUE-SKIPPED | info | no | Cue notes were skipped ({n}). |
| W-XML-DURATION-DERIVED | warn | no | {n} notes had no duration; it was derived from the note type. |
| W-XML-DURATION-DECIMAL | info | yes | Decimal durations were rounded to whole divisions. |
| W-XML-TYPE-UNKNOWN | warn | yes | Unknown note type "{name}" was treated as a quarter note. |
| W-XML-MICROTONE | warn | yes | Microtonal alterations were rounded to the nearest semitone ({n}). |
| W-XML-UNPITCHED-FALLBACK | warn | yes | {n} percussion notes have no MIDI instrument; Acoustic Snare was used. |
| W-XML-NOTE-NO-PITCH | warn | yes | {n} notes have neither pitch nor unpitched data and were treated as rests. |
| W-XML-PITCH-CLAMPED | warn | yes | {n} notes were outside MIDI range after transposition and were clamped. |
| W-XML-GRACE-CHAIN | info | yes | More than {n} grace notes before one note; the earliest were dropped. |
| W-XML-GRACE-CLAMPED | info | no | Grace notes at the start of the score were shortened. |
| W-XML-TIE-UNMATCHED | info | no | A tie end had no matching start ({n}); the note was kept. |
| W-XML-TIE-ACROSS-REPEAT | info | no | A tied note crosses a repeat boundary; it sounds for its written length. |
| W-XML-MEASURE-OVERFULL | warn | no | {n} measures contain more than their time signature allows; they were lengthened. |
| W-XML-REPEAT-CAP | warn | yes | Repeats expand to more than {n} measures; expansion stopped there. |
| W-XML-BEND-RANGE | info | yes | Bends larger than two semitones were clamped. |
| W-XML-HARMONY-IGNORED | info | yes | Chord symbols are not imported ({n}). |
| W-XML-FIGURED-BASS-IGNORED | info | yes | Figured bass is not imported ({n}). |
| W-XML-ORNAMENT-UNSUPPORTED | info | yes | Ornaments ({name}) play as plain notes ({n}). |
| W-XML-GLISS-UNSUPPORTED | info | yes | Glissandi and slides are not played ({n}). |
| W-XML-ARPEGGIO-IGNORED | info | yes | Arpeggio marks are not applied ({n}). |
| W-XML-TREMOLO-IGNORED | info | yes | Tremolo marks are not applied ({n}). |
| W-XML-TECHNICAL-IGNORED | info | no | Technical marks ({name}) are notation only ({n}). |
| W-XML-LYRIC-LINES | info | yes | Only the first lyric line is imported. |
| W-XML-MXL-NO-CONTAINER | info | no | The .mxl archive has no container.xml; the first score file was used. |
| W-XML-FERMATA-IGNORED | info | yes | Fermatas are not applied; notes keep their written length ({n}). |
| W-XML-INSTRUMENT-CHANGE | info | yes | Instrument changes inside a part are not applied; the part keeps its first instrument ({n}). |
| W-XML-ARTICULATION-FLAGGED | info | yes | Articulations ({name}) are kept as marks but not played ({n}). |

#### 8.8.3 `W-GP-*` (emitted by M-13)

| Code | Severity | Loss | Message |
|---|---|---|---|
| W-GP-TRUNCATED | warn | yes | The file ends early in measure {n} of {value}; the measures before it were kept. |
| W-GP-STRING-LENGTH | info | yes | A text field declared a length larger than its block and was clamped. |
| W-GP-TEMPO-RANGE | warn | yes | Tempo {value} is out of range and was clamped to 1-999 BPM. |
| W-GP-KEY-RANGE | warn | yes | Key signature value {value} is out of range; C major is used. |
| W-GP-CHANNEL-RANGE | info | yes | A MIDI channel definition had an invalid program and was reset to piano. |
| W-GP-REPEAT-ZERO | info | no | A repeat sign with zero repeats was ignored. |
| W-GP-TRIPLET-FEEL | info | yes | Triplet (swing) feel is not applied; notes play straight. |
| W-GP-NAV-UNSUPPORTED | warn | yes | Directions (coda, segno, da capo, fine) are not expanded; the song plays through once. |
| W-GP-CAPO-RANGE | warn | yes | Capo position {value} is out of range and was clamped. |
| W-GP-PORT-COLLAPSED | info | no | Tracks on MIDI ports 2-4 were mapped onto the 16 channels of port 1. |
| W-GP-BEAT-STATUS | info | yes | An unknown beat status was treated as a rest. |
| W-GP-TUPLET-UNKNOWN | warn | yes | Tuplet value {value} is not supported; the beat keeps its plain duration. |
| W-GP-STRING-INDEX | warn | yes | {n} notes refer to strings the track does not have and were dropped. |
| W-GP-CHORD-NAME-ONLY | info | no | Chord diagrams are imported as names only. |
| W-GP-STROKE-IGNORED | info | yes | Strum direction, pick stroke and rasgueado marks are not applied ({n}). |
| W-GP-NOTE-TYPE | info | yes | An unknown note type was treated as a normal note. |
| W-GP-NOTE-DURATION | info | yes | Time-independent note durations are not supported; beat durations are used. |
| W-GP-FRET-RANGE | warn | yes | {n} notes had fret numbers out of range and were clamped. |
| W-GP-DURATION-PERCENT | info | no | Note length percentages were applied to {n} notes. |
| W-GP-PITCH-CLAMPED | warn | yes | {n} notes were outside MIDI pitch range and were clamped. |
| W-GP-TIE-UNMATCHED | info | no | {n} tied notes had no note to tie to and were played as new notes. |
| W-GP-HARMONIC-APPROX | info | yes | Artificial, tapped and pinch harmonics are approximated one octave up ({n}). |
| W-GP-BEND-RANGE | info | yes | Bends larger than two semitones were clamped. |
| W-GP-TRILL-UNSUPPORTED | info | yes | Trills are played as single notes ({n}). |
| W-GP-TREMOLO-PICKING | info | yes | Tremolo picking is played as single notes ({n}). |
| W-GP-TEMPO-RAMP-IGNORED | info | yes | Gradual tempo changes are applied immediately ({n}). |
| W-GP-LYRIC-LINES | info | yes | Only the first lyric line is imported. |
| W-GP-LYRIC-TRACK | info | yes | The lyrics refer to a track that does not exist and were skipped. |
| W-GP-REPEAT-CAP | warn | yes | Repeats expand to more than {n} measures; expansion stopped there. |
| W-GP-MEASURE-OVERFULL | info | no | {n} measures contain more beats than their time signature allows. |
| W-GP-FADE-IN-IGNORED | info | yes | Fade-in effects are not applied ({n}). |

#### 8.8.4 `W-AUD-*` (emitted by the M-14 audio adapter)

| Code | Severity | Loss | Message |
|---|---|---|---|
| W-AUD-NO-TEMPO | info | no | Audio files carry no tempo or beat information; the song grid uses {value} BPM. Set the tempo in the Studio to line up bars. |
| W-AUD-NO-SPEED-CHANGE | info | no | Audio tracks are silent when the playback speed is not 1.0x. |
| W-AUD-NOT-PERSISTED | info | no | Decoded audio is not saved with the project. After reopening the project, import {name} again to hear it. |
| W-AUD-LEADING-SILENCE | info | no | The audio starts with {n} ms of silence. Use Align start to move the sound to the beginning of the song. |
| W-AUD-DOWNMIX | info | yes | The audio had {n} channels and was mixed down to stereo. |
| W-AUD-LARGE | info | no | This audio uses {n} MB of memory while loaded (limit {value} MB on this device). |

#### 8.8.5 `W-IMP-*` (emitted by M-14; the two chart codes by M-08)

| Code | Severity | Loss | Emitter | Message |
|---|---|---|---|---|
| W-IMP-EXT-MISMATCH | info | no | M-14 identify | The file is named .{name} but contains {value}; the content was used. |
| W-IMP-LARGE-FILE | info | no | M-14 validate | Large file ({n} MB); import may take several seconds. |
| W-IMP-CHORD-LIMIT | warn | no | M-14 normalize | Track "{name}" has chords of up to {value} notes at once (limit 16); all notes are kept, gameplay charts use at most four lanes. |
| W-IMP-TRACKS-OVER-32 | warn | no | M-14 normalize | The file has {n} tracks; up to 32 can be kept in a song. Choose which tracks to import. |
| W-IMP-TRACKS-DROPPED | warn | yes | M-14 `applyTrackSelection` | {n} tracks were not imported: {value}. |
| W-IMP-NO-NOTES | warn | no | M-14 normalize | This file contains no notes. |
| W-IMP-CC-NO-PLAYBACK | info | no | M-14 normalize (D3) | Controllers {value} are kept in the song but have no effect on the synthesized sound ({n} events). |
| W-IMP-BEND-RANGE | info | no | M-14 normalize (D4) | The file sets a pitch-bend range of {value} semitones; bends play with a range of 2 semitones. |
| W-IMP-CHART-EMPTY | info | no | M-08 `ChartGenerator` | Track "{name}" has no notes to chart. |
| W-IMP-CHART-OMITTED | info | no | M-08 `ChartGenerator` | {n} of {value} notes are not charted at this difficulty; they still play in the arrangement. |

W-IMP-CHART-* codes never enter `song.source.warnings`: they live in `Chart.stats.warnings`
and are shown in the preview panel of SCR-ImportInspect (8.10.3) and on SCR-Results. The
chord limit of 16 (brief section 6) is a gameplay limit: notes above it are never dropped
from the Song, which is why W-IMP-CHORD-LIMIT has loss `no`.

#### 8.8.6 Related codes shown on import and export screens (owned elsewhere; messages fixed here)

| Code | Owner | Severity | Loss | Message |
|---|---|---|---|---|
| W-NOTE-UNMATCHED | M-03 `pairNotes` | warn | yes | {n} notes had no end and were held to the end of the track. |
| W-NOTE-OFF-WITHOUT-ON | M-03 | warn | no | {n} note-off events had no matching note-on and were ignored. |
| W-NOTE-OVERLAP | M-03 | info | yes | {n} notes re-struck the same pitch on the same channel before release; the earlier note was ended at the new start. |
| W-NOTE-ZERO-DURATION | M-03 | info | no | {n} notes started and ended at the same moment and were given the shortest length. |
| W-NOTE-PITCH-RANGE | M-03 | warn | yes | {n} notes outside the MIDI pitch range were dropped. |
| W-NOTE-VELOCITY-CLAMP | M-03 | info | yes | {n} note velocities above 127 were set to 127. |
| W-TEMPO-IMPLICIT-START | M-03 `TempoMap` | info | no | The tempo map did not start at the beginning; 120 BPM is used until the first tempo. |
| W-TEXT-TRUNCATED | M-03 | info | yes | {n} text events longer than 1,000 characters were shortened. |
| W-MDL-DURATION | M-03 `validate` | info | no | The song length was recomputed from its events. |
| W-MDL-EMPTY-TRACK | M-03 | info | no | Track "{name}" has no events. |
| W-MDL-NO-NOTES | M-03 | warn | no | The song has no notes. (suppressed when W-IMP-NO-NOTES is present, D5) |
| W-EXP-AUDIO-SKIPPED | M-10 writer caller (export dialog) | info | n/a | Audio tracks are not part of a MIDI file and were left out ({n}). |
| W-EXP-CHANNEL-REMAPPED | M-10 writer | info | n/a | Track "{name}" used channel 10 but is not a drum track; it was moved to channel {value}. |

Parts 5.3 and 6.3 both use W-TEMPO-IMPLICIT-START for the implicit tempo warning; no second
code exists.

#### 8.8.7 Error codes of the import family (reference)

The `E-IMP-*` user texts are fixed in Part 6.14.5 and repeated in 8.2. This part adds two
text variants that keep their codes: E-IMP-005 for the audio watchdog (8.1.2) and E-IMP-004
details for audio track count and project audio size (D8). Error codes never appear as
`ImportWarning`s; a refused file produces no report.

#### 8.8.8 Warnings owned by other parts (registered here)

These codes are written to the `Log` (and, where a screen lists them, to SCR-Diagnostics or the
load report) by the module named in the Owner column, using the severity and message below. They
are not `ImportWarning`s of an import report, so "Loss" does not apply. `W-DANCE-<suffix>` is
formed from the `DANCE-<suffix>` validation issue codes of Part 6.23; the two listed are the ones
that are logged or shown.

| Code | Owner | Severity | Loss | Message |
|---|---|---|---|---|
| W-PRJ-UNKNOWN-FIELD | M-15 `hoistUnknown` (5.6 step 7) | info | n/a | Unknown fields were kept under x ({n} paths). |
| W-PRJ-DROPPED-CHART | M-15 `validate` (step 11) | warn | n/a | {n} charts referred to a missing track or song and were removed. |
| W-PRJ-ORPHAN-TAKE | M-15 `validate` (step 11) | warn | n/a | {n} recorded takes referred to a missing track and were moved aside. |
| W-PRJ-CHARACTER-UNBOUND | M-15 `validate` (step 11) | info | n/a | A character's instrument no longer exists and was cleared. |
| W-PRJ-DERIVED-UNBOUND | M-15 `validate` (step 11) | info | n/a | A derived track lost its source track and became a normal track. |
| W-PRJ-RESORTED | M-15 `validate` (step 12) | info | n/a | Events were out of order and were sorted. |
| W-PRJ-CHANNEL-FIXED | M-15 `validate` (step 13) | info | n/a | Event channels were set to the channel of their track. |
| W-PRJ-MAP-REPAIRED | M-15 `validate` (step 14) | info | n/a | The tempo or meter map was repaired. |
| W-PRJ-DURATION-FIXED | M-15 `validate` (step 15) | info | n/a | The song length was recomputed from its events. |
| W-PRJ-TIMESIG-FIXED | M-15 `validate` (step 16) | info | n/a | The time signature setting was set from the meter map. |
| W-PRJ-TAKES-PRUNED | M-15 `validate` (step 17) | info | n/a | Older or aborted takes were removed. |
| W-PRJ-CHART-STALE | M-15 `validate` (step 18) | info | n/a | Generated charts were out of date and are regenerated when needed. |
| W-PRJ-SLOT-FIXED | M-15 `validate` (step 19) | info | n/a | Character slots were reassigned and extra characters were dropped. |
| W-PRJ-AUDIO-FIXED | M-15 `validate` (step 20) | info | n/a | An audio track without audio was changed to a MIDI track. |
| W-PRJ-X-TRUNCATED | M-15 `validate` (step 21) | warn | n/a | Extension data larger than 64 KB was removed. |
| W-SET-NEWER | M-27 `Settings.load` | warn | n/a | The settings were saved by a newer version; defaults are used and the stored settings are kept. |
| W-SET-NORMALIZED | M-27 `Settings.load`, `Settings.import` | info | n/a | Settings values that were not valid were replaced. |
| W-CHR-NO-VERSION | M-22 `validate` | info | n/a | The character file has no version; version 1 is assumed. |
| W-CHR-UNKNOWN-FIELD | M-22 `normalize` | info | n/a | Unknown character fields were dropped. |
| W-CHR-X-LARGE | M-22 `validate`, `normalize` | info | n/a | The character extension data was larger than 1,024 bytes and was dropped. |
| W-CHR-X-DROPPED | M-22 `deserialize` | info | n/a | The character extension data was dropped to fit the network limit of 4,096 bytes. |
| W-CHR-NORMALIZED | M-22 `normalize` | info | n/a | A character value was not valid and was replaced. |
| W-CHR-EXCLUSIVE | M-22 `normalize` | info | n/a | A hat and headphones cannot be worn together; the later one was kept. |
| W-CHR-PRESET-SKIPPED | M-22 `registerPresets` | warn | n/a | A character preset was not valid and was skipped. |
| W-CHR-ROSTER-RESET | M-22 roster load | warn | n/a | The saved characters could not be read and were reset. |
| W-RIG-DEFAULTED | M-19 `buildMesh` | info | n/a | An unknown appearance value was replaced by the default (logged once per field). |
| W-DANCE-HOLD-OVERLAP | M-23 `validate` (V11) | info | n/a | {n} overlapping holds were shortened. |
| W-DANCE-CHOREO-DISABLED | M-23 `ChoreographyController` | warn | n/a | Dance choreography failed and was turned off; steps are still judged. |
| W-NET-LATE-RESUME | M-24 `resume` handling | info | n/a | A resume arrived less than 0.5 s ahead; playback resumed immediately at the converted time. |
| W-PRG-SKIPPED | M-25 `record` | info | n/a | A session without judged notes or completion was not recorded. |
| W-PRG-RESET | M-25 document load | warn | n/a | A progress document was not valid and was reset. |
| W-PRG-NEWER | M-25 document load | warn | n/a | A progress document was saved by a newer version and is read-only. |
| W-PRG-RECORD-DROPPED | M-25 document load | warn | n/a | {n} progress records were not valid and were dropped. |
| W-PRG-SAVE-FAILED | M-25 save | warn | n/a | Progress could not be saved and is kept in memory. |
| W-PRG-BESTS-PRUNED | M-25 size caps | info | n/a | The oldest best scores were removed to stay under the size cap. |
| W-UI-HISTORY | M-26 `Screens` | info | n/a | The browser history could not be used; in-app Back is used (logged once). |
| W-URL-TIER | M-29 `parseUrlParams` | warn | n/a | The tier parameter of the page address was not valid and was ignored. |
| W-URL-ONLINE | M-29 `parseUrlParams` | warn | n/a | The online parameter of the page address was not valid and was ignored. |
| W-INS-PROGRAM | M-06 `definition` | warn | n/a | A program number outside 0..127 was replaced by 0. |
| W-THEORY-FALLBACK | M-08 via M-02 `Theory` | info | n/a | An unknown scale or chord was replaced by Major. |
| W-TRANSPORT-DRIFT | M-04 `onVisible` | info | n/a | The transport clock drifted while the page was hidden and was re-anchored. |
| W-JSON-PROTO-KEY | M-15 `parse`, M-16 | warn | n/a | A JSON document contained a `__proto__`, `constructor` or `prototype` key; the key was removed (logged once per document). |

### 8.9 Test corpus definition (`test-corpus/`)

#### 8.9.1 Conventions and the FT assertion rules

- Every file below is produced by `node tools/make-corpus.mjs` (Part 3.6) from the recipe in
  its row, written to `test-corpus/`, and listed in `test-corpus/MANIFEST.json` with
  `{file, bytes, fnv1a32, format, recipe, base, mutate, expect}`. Variant files (8.9.4) are
  produced from their base file's bytes by `mutate` operations. 89 files in total: 68 base
  files and 21 variants (count checked by the FT test `files.ident.manifest-count`).
- Each file is one FT test named `files.<subgroup>.<file name>` in `src/92-test-files.js`;
  subgroups: `midi`, `midi-damaged`, `limits`, `musicxml`, `security`, `mxl`, `gp`,
  `audio`, `ident`. Round-trip tests are the `roundtrip` subgroup (8.11). Part 12 assigns
  FT-nnn IDs in file-name order within each subgroup.
- Conventions inside recipes: PPQ is the file's own division; "model ticks" are after
  rescaling to 960; notes are 100 velocity and 64 off velocity and use explicit `0x80`
  note-offs unless the recipe says otherwise; "bar n" is 1-based; pitches are MIDI numbers;
  `Prng(seed)` is mulberry32 identical to `FLM.Core.Prng`.
- `expect` fields: `error` (null or an `E-IMP-*` code), `stage` (the `import.failed.stage`
  when `error` is set), `format`, `songs`, `tracks` (kept tracks of the selected song),
  `notes` (sum of NoteEvents over kept tracks), `warnings` (codes), `status`, `playable`,
  `checks` (named assertions in the Expected column, written in `92-test-files.js`).

FT assertion rules for every corpus file (the `files` group runs
`FLM.Import.importFile({name: file, bytes})` with the default 5 s budget):

1. `error` set: the promise rejects with that code; exactly one `import.failed` with
   `stage === expect.stage`; no `import.done`; no exception escapes; `Project.current()` is
   deep-equal before and after (S-12).
2. `error` null: the promise resolves; `format`, `songs`, `tracks`, `notes`, `status` and
   `playable` equal `expect`; every code in `expect.warnings` is present in
   `report.warnings`; no code with severity warn or error is present that `expect.warnings`
   does not list (unlisted info codes are allowed, so default notices such as W-MIDI-NO-KEY
   do not make tests brittle).
3. Every import settles within 5,000 ms in the headless run (each file's time is recorded).
4. Determinism: each file is imported twice; the reports are deep-equal after removing
   `id`, `importedAt`, `stats` timings and event and track ids.
5. Files with `notes > 0` whose recommended track exists additionally pass
   `Mapping.ChartGenerator.validate` for the four difficulties generated from it, and the
   Song is unchanged by generation (fnv1a32 of the serialized tracks before and after, S-08).

#### 8.9.2 Generator writers (additions to Part 3.6.1)

| Writer | Output | Rules |
|---|---|---|
| `SmfWriter` | SMF bytes plus `offsets` (`header`, `trackLength[i]`, `event[i][k]`) | header(format, ntrks, division); `track(events, {runningStatus, offStyle:'0x80' or 'vel0'})`; VLQ deltas; metas; raw bytes allowed for malformed recipes |
| `musicXml(template, vars)` | ASCII text, LF, no BOM | partwise and timewise templates; XML declaration `<?xml version="1.0" encoding="UTF-8"?>`; MusicXML 3.1 PUBLIC DOCTYPE line without an internal subset (except the entity recipe); `encoding/software` = `make-corpus` |
| `zipStored(entries)` and `zip(entries)` | ZIP bytes plus `offsets` (`local[i]`, `data[i]`, `central[i]`, `eocd`) | local headers, central directory, EOCD; entry methods 0 or 8; CRC-32 table; no data descriptors; names ASCII |
| `deflateFixed(bytes)` | raw RFC 1951 stream | one final block with BTYPE 01 (fixed Huffman); greedy LZ77 with a 4,096-entry hash of the next 3 bytes (`((b0 << 16) or (b1 << 8) or b2) % 4093`, newest position wins), match length 3-258, distance 1-32,768, literals otherwise; end-of-block code 256; final byte zero-padded. `--check` additionally verifies `zlib.inflateRawSync(output)` equals the input (Node built-in used only as an independent check, ADR-02 tooling row), so the corpus bytes never depend on the Node zlib version |
| `Gp3Writer`, `Gp4Writer`, `Gp5Writer` | GP bytes plus `offsets` (`channelTable`, `measureCount`, `trackHeader[i].stringCount`, `measureBeats[m][t]`) | layouts of Part 6.13.4 for the version string given in the recipe |
| `WavWriter` | RIFF WAVE bytes | `fmt ` chunk size 16 (audioFormat, channels, sampleRate, byteRate, blockAlign, bitsPerSample), `data` chunk; 16-bit samples `round(x * 32767)` little-endian |
| `mutate` ops | bytes | `truncate(n)`, `setByte(off, v)`, `xorRange(off, len, mask)`, `insert(off, bytes)`, `patchU32BE(off, v)`, `patchU16BE(off, v)`, `patchI32LE(off, v)`, `repeat(off, len, times)`; offsets come from the base writer's `offsets` when the row names a structure |

#### 8.9.3 Base files

| File | Seed | Generator recipe | Exercises | Expected import result |
|---|---|---|---|---|
| `midi-mono-simple.mid` | 1001 | SMF format 0, PPQ 480, one MTrk: name "Mono", tempo 500000, 4/4, key C major, program 0 on channel 0, then 32 consecutive quarter notes (480 source ticks) cycling pitches 60, 62, 64, 65, 67, 69, 71, 72; no running status; EOT at 15360. Layout: 346 bytes; first note-on at byte 54; each note is 9 bytes (on `00 90 pp 64`, off `83 60 80 pp 40`) | B 25.3 simple monophonic; E 3.1 format 0; the base of 13 variants | midi; songs 1; tracks 1 ("Mono"); notes 32; durationTicks 30720; tempo [500000]; meter 4/4; key C major; title "Mono"; warnings none; Supported; playable. Checks: `noteList` (32 notes at ticks 960k, durTicks 960) |
| `midi-mono-running-status.mid` | 1002 | as 1001 but running status on and note-offs written as note-on velocity 0 | E 3.1 running status, velocity-0 note-off | as 1001; Checks: `sameNotesAs:midi-mono-simple.mid` (tick, durTicks, pitch, velocity) and every `offVelocity` 0 |
| `midi-poly-chords.mid` | 1003 | format 1, PPQ 960; MTrk 0 name "Poly Chords", tempo 500000, 4/4; MTrk 1 "Piano" channel 0 program 0, 16 bars: root r = [60, 65, 67, 69][(bar - 1) % 4]; bars 1-8 one triad per beat (major [0,4,7] for 60, 65, 67; minor [0,3,7] for 69), bars 9-16 one seventh chord per beat (r=60 [0,4,7,11], 65 [0,4,7,11], 67 [0,4,7,10], 69 [0,3,7,10]), each 960 long; a bass whole note r - 24 at every bar start | B 25.3 polyphonic; B 3.5 polyphony preserved | tracks 1 ("Piano"); notes 240; title "Poly Chords"; durationTicks 61440; warnings none; Supported. Checks: `polyphonyMax:5`, `maxChord:5` |
| `midi-multitrack-band.mid` | 1004 | format 1, PPQ 480, 5 MTrk: 0 name "Band Test", tempo 600000, 4/4, key fifths 1 major; 1 "Bass" ch 1 program 33, 32 quarter notes; 2 "Guitar" ch 2 program 29, 64 eighth notes; 3 "Keys" ch 0 program 0, 16 half-note triads (48 notes); 4 "Drums" ch 9 no program: per bar kick 36 on beats 1 and 3, snare 38 on 2 and 4, closed hat 42 on every eighth (12 per bar, 96 total, 120 source ticks long); 8 bars | B 25.3 multitrack; E 3.1 format 1 | tracks 4 (Bass, Guitar, Keys, Drums); notes 240; programs 33, 29, 0, 0; `isDrums` only on Drums (channel 9); title "Band Test"; tempo [600000]; key G major; Supported. Checks: `trackNotes:[32,64,48,96]` |
| `midi-drums-heavy.mid` | 1005 | format 0, PPQ 960, no name, tempo 428571 (140 BPM), channel 9 only, velocities from `Prng(1005)` in 60-127: bars 1-8 closed hat 42 on every 16th (128), kick 36 on beats 1, 2.5 and 3 (24), snare 38 on beats 2 and 4 (16), crash 49 at bar 1 beat 1 (1); from bar 9 beat 1 every key 35-81 once on consecutive 16ths (47), then keys 34 and 82 (2); all notes 120 ticks | B 25.3 percussion-heavy; E 3.2 percussion channel, missing track name | tracks 1 ("Track 1 (Drums)", `isDrums`, channel 9); notes 218; title "midi-drums-heavy"; Supported. Checks: `drumKeys:35-81 all present` |
| `midi-tempo-changes.mid` | 1006 | format 1, PPQ 480; MTrk 0 name "Tempo Changes", 4/4, tempos at bars 1, 3, 5, 7, 9, 11 = 500000, 666667, 428571, 1000000, 300000, 500000; MTrk 1 "Click" ch 0 program 115, 48 notes pitch 76 on every beat, 240 source ticks long | B 25.3 tempo changes; E 3.2 multiple tempo changes; B 26.3 | tracks 1; notes 48; tempo map 6 entries at model ticks 0, 7680, 15360, 23040, 30720, 38400; durationTicks 45600; Supported. Checks: `seconds:45600=26.911904` (`ticksToSeconds(45600)` within 1e-6 of 4.0 + 5.333336 + 3.428568 + 8.0 + 2.4 + 3.75) |
| `midi-meter-key-changes.mid` | 1007 | format 1, PPQ 960; MTrk 0 name "Meter Key": meters at bar starts 1: 4/4, 3: 3/4, 5: 6/8, 7: 5/4, 9: 7/8, 11: 4/4 (12 bars); keys tick 0 C major, bar 5 A minor (0, minor), bar 7 fifths -3 major, bar 9 fifths 6 major; MTrk 1 "Beats" ch 0: one note (pitch 72, 240 ticks) on every beat of the meter's denominator (8, 6, 12, 10, 14, 8 per two-bar span) | E 3.2 meter and key changes mid-song; partial bars | tracks 1; notes 58; meter map at ticks 0, 7680, 13440, 19200, 28800, 35520; key map at 0, 13440, 19200, 28800; durationTicks 42480; Supported. Checks: `barAt:39360=11` (0-based), `keyNames:C major,A minor,Eb major,F# major` |
| `midi-controllers.mid` | 1008 | format 1, PPQ 480; MTrk 0 name "Controllers", tempo 500000, 4/4; MTrk 1 "Strings" ch 0: tick 0 program 48, CC 7=100, 10=64, 11=127, 101=0, 100=0, 6=12, 38=0, 91=64, 74=80, sysex `F0 7E 7F 09 01 F7`; notes: bars 1-4 whole notes 60, 64, 67, 72; bar 5 four notes 60, 62, 64, 65 each half a beat long on beats 1-4 under CC 64=127 at bar 5 and CC 64=0 at bar 6; one note 67 from bar 6 beat 3 lasting 8 beats; CC 1 values 0, 8, ..., 120 on the 16 sixteenths of bar 1; CC 10 0, 18, 36, 54, 72, 90, 108, 127 on the eighths of bar 2; CC 11 127, 116, 105, 94, 83, 72, 61, 50 on the eighths of bar 3; bends -8192, -6144, -4096, -2048, 0, 2048, 4096, 6144 on the eighths of bar 4 and 0 at bar 5; polyphonic aftertouch x3 in bar 1; channel pressure x2 in bar 2; CC 121 and CC 123 at bar 9 | B 25.3 controller events; B 11.4; E 3.2 bend and modulation during a note, sustain pedal, notes across measures | tracks 1 ("Strings", program 48); notes 9; ControlEvents 45; PitchBendEvents 9; ProgramEvents 0; durationTicks 30720; warnings W-MIDI-IGNORED-EVENT, W-MIDI-SYSEX-SKIPPED, W-IMP-CC-NO-PLAYBACK (value "74, 91"), W-IMP-BEND-RANGE (value 12); Partial. Checks: `derivedSustain:[3840,2880,1920,960]` for the four bar-5 notes |
| `midi-format2.mid` | 1009 | format 2, PPQ 480, 3 MTrk: "Pattern A" tempo 500000 4/4, ch 0 program 0, 16 quarter notes; "Pattern B" tempo 666667 3/4, ch 1 program 24, 12 quarter notes; "Pattern C" tempo 400000, ch 9, 32 eighth notes alternating 36 and 42 | E 3.1 format 2 | songs 3 (titles "Pattern A", "Pattern B", "Pattern C"); selected song 0: tracks 1, notes 16; warnings W-MIDI-FORMAT2; Conversion. Checks: `songNotes:[16,12,32]` via `InspectionReport.build(songs, {selectedSong:i})` |
| `midi-smpte-25.mid` | 1010 | format 0, division `E7 28` (25 fps x 40 = 1,000 ticks per second); tempo meta 500000 at 0; 20 notes ch 0 pitch 60 + (k % 12) at source ticks 500k, 400 long | E 3.1 SMPTE timing | tracks 1; notes 20 at model ticks 960k with durTicks 768; tempo map one entry 500000 (default); warnings W-MIDI-SMPTE, W-MIDI-SMPTE-TEMPO-IGNORED; Conversion |
| `midi-ppq-97.mid` | 1011 | format 0, PPQ 97; 12 quarter notes pitch 60 at source ticks 97k, 97 long; two notes pitch 72 at source ticks 1 and 48, 24 long | E 3.1 unusual PPQ; exact rescaling | tracks 1; notes 14; quarter notes at 960k, durTicks 960; the pitch-72 notes at ticks 10 and 475 with durTicks 237 and 238; warnings W-MIDI-TICK-ROUNDING (info, listed); Supported |
| `midi-zero-duration.mid` | 1012 | format 0, PPQ 960, ch 0: quarter notes 60, 62, 64, 65 on beats 1-4; then on beats 5-8 pitches 67, 69, 71, 72 each written as note-on immediately followed by note-off at the same tick | E 3.1 zero-duration notes; D10 | tracks 1; notes 8; the last 4 have durTicks 1; warnings W-NOTE-ZERO-DURATION (count 4); no W-NOTE-UNMATCHED, no W-NOTE-OFF-WITHOUT-ON; Supported |
| `midi-unmatched.mid` | 1013 | format 0, PPQ 960, ch 0: ons without offs for 60 at 0, 62 at 960, 64 at 1920; offs without ons for 70 at 2880 and 72 at 3840; pitch 67 on at 4800, on at 5040, off at 5280, off at 5520; note 69 from 5760 to 6720; EOT at 7680 | E 3.1 unmatched on and off; E 2.3 stuck notes | tracks 1; notes 6: (60, 0, 7680), (62, 960, 6720), (64, 1920, 5760), (67, 4800, 240), (67, 5040, 240), (69, 5760, 960); warnings W-NOTE-UNMATCHED (3), W-NOTE-OFF-WITHOUT-ON (3), W-NOTE-OVERLAP (1); Partial |
| `midi-same-tick-tracks.mid` | 1014 | format 1, PPQ 960; MTrk 0 tempo only; MTrk 1 "Unison A" ch 0: 16 quarter notes cycling the 1001 pitches, the first written as two note-ons at 0 and two note-offs at 960; MTrk 2 "Unison B" ch 1: the same 16 notes written once | E 3.1 identical pitches simultaneous, same timestamps in different tracks | tracks 2; notes 33 (17 + 16); warnings W-NOTE-OVERLAP (1), W-NOTE-OFF-WITHOUT-ON (1); Partial. Checks: `unison` (every Unison B note has a Unison A note with the same tick and pitch) |
| `midi-empty-and-text-tracks.mid` | 1015 | format 1, PPQ 960, 4 MTrk: 0 name "Meta Tracks", tempo, 4/4; 1 only EOT; 2 name "Lyrics", 8 lyric metas and 1 text meta, no channel messages; 3 "Melody" ch 0, 8 quarter notes | E 3.1 empty track, track with metadata but no notes | tracks 2 ("Lyrics" with 9 TextEvents and `playable:false`, "Melody" 8 notes); notes 8; title "Meta Tracks"; warnings W-MIDI-TEXT-ONLY-TRACK; Supported |
| `midi-no-eot-no-meta.mid` | 1016 | format 0, PPQ 960, ch 0, 8 quarter notes pitch 60-67, no meta events at all, no program change, no EOT (chunk length exact) | E 3.1 missing EOT; E 3.2 tempo not defined, documented defaults | tracks 1 ("Track 1 (Acoustic Grand Piano)"); notes 8; warnings W-MIDI-NO-EOT, W-MIDI-NO-TEMPO, W-MIDI-NO-METER, W-MIDI-NO-KEY, W-MIDI-NO-PROGRAM; Supported. Checks: `report.tempo.source === 'default'`, `metersSource === 'default'` |
| `midi-duplicate-meta.mid` | 1017 | format 1, PPQ 960; MTrk 0 name "Dup Meta", tempo 500000 and 4/4 at 0; MTrk 1 "Guitar" ch 0 program 25 with tempo 400000 at 0 and 8 notes; MTrk 2 "Guitar" ch 1 program 25 with 3/4 at 0 and 8 notes | E 3.1 duplicate or conflicting metadata; E 3.2 duplicated names | tracks 2 (both "Guitar"); notes 16; tempo [400000]; meter 3/4; warnings W-MIDI-DUPLICATE-META; Partial |
| `midi-text-markers.mid` | 1018 | format 1, PPQ 960; MTrk 0 name "Marker Song", copyright "(c) Corpus", text "Artist: Corpus Band", markers "Intro" at 0, "Verse" at bar 3, "Chorus" at bar 5, cue "Hit" at bar 6 beat 3, sequencer-specific `FF 7F 03 00 00 41`, unknown meta `FF 60 03 01 02 03`; MTrk 1 "Vocal" ch 0, instrument name "Voice", 8 half notes each with a lyric "la" | B 15.2 track names and metadata; markers; lyrics; D24 conductor folding | tracks 1 ("Vocal"); notes 8; markers 3 sections + 1 cue; title "Marker Song"; artist "Corpus Band"; a copyright TextEvent "(c) Corpus" at tick 0 of "Vocal"; warnings W-MIDI-SEQ-SPECIFIC, W-MIDI-UNKNOWN-META; Supported. Checks: `lyrics:8`, `instrumentText:Voice` |
| `midi-unknown-chunk.mid` | 1019 | header ntrks 1; chunk `XFIH` of length 12 (12 zero bytes); MTrk with 8 quarter notes and EOT; 5 trailing zero bytes | E 3.1 structure validation | tracks 1; notes 8; warnings W-MIDI-UNKNOWN-CHUNK, W-MIDI-TRAILING-BYTES; Supported |
| `midi-multi-program-channel.mid` | 1020 | format 1, PPQ 960; MTrk 0 name "Programs"; MTrk 1 "Changes" ch 0: program 0 at 0, 48 at bar 3, 56 at bar 5, 8 quarter notes after each (24); MTrk 2 "Combo": ch 1 program 32 and ch 2 program 25 interleaved, 8 notes each; MTrk 3 "Shared" ch 0 program 73, 8 notes | E 3.2 multiple program changes, several instruments on one channel; format 0 style channel split | tracks 4 ("Changes" program 0 with ProgramEvents at 7680 and 15360, "Combo (ch 2)" program 32, "Combo (ch 3)" program 25, "Shared" ch 0 program 73); notes 48; warnings W-MIDI-MULTI-CHANNEL; Supported |
| `midi-trailing-events.mid` | 1021 | format 0, PPQ 960, ch 0: 16 quarter notes in bars 1-4, CC 7=90 at bar 8 (26880), EOT at bar 10 (34560) | E 3.2 final event after the last note | tracks 1; notes 16; durationTicks 26880; Supported |
| `midi-velocity-range.mid` | 1022 | format 0, PPQ 960, ch 0: notes (pitch, velocity) (0, 1), (1, 2), (60, 64), (126, 126), (127, 127), one per beat, note-offs as note-on velocity 0 | E 3.2 unusual velocities, notes outside an instrument's range | tracks 1; notes 5 with exactly these pitches and velocities; Supported |
| `midi-large-100k.mid` | 1023 | format 1, PPQ 480, 16 MTrk (no names), MTrk c on channel c with program 8c (MTrk 9 drums); MTrk 0 also holds tempo 500000 and 4/4; each MTrk 6,250 sixteenth notes (120 source ticks), pitches `Prng(1023)` in 36-84 (drums 35-81), velocities 64-127; running status, velocity-0 note-offs; about 0.6 MB | B 25.3 large files; E 3.1 large event counts; time slicing | tracks 16; notes 100,000; durationTicks 1,500,000; one `isDrums` track; Supported. Checks: `stats.yields >= 10`, `settledMs < 5000` |
| `midi-huge-ntrks.mid` | 1024 | valid header with ntrks 65535 followed by the MTrk of 1001 | E 3.1 huge counts; limits before allocation | error E-IMP-004, stage parse |
| `midi-40-tracks.mid` | 1025 | format 1, PPQ 480; MTrk 0 name "Forty Tracks"; MTrk i = 1..39 "Part i" on channel `[0,1,2,3,4,5,6,7,8,10,11,12,13,14,15][(i - 1) % 15]`, program i, (100 - i) eighth notes; MTrk 40 "Drums" ch 9 with 10 notes | tracks beyond 32; explicit selection (B 3.5) | before selection: tracks 32, overflow 8, warnings W-IMP-TRACKS-OVER-32, Supported; the default selection keeps "Drums" and Parts 1-31. Checks: `afterSelection` (`applyTrackSelection(report, report.trackSelection)`: tracks 32, notes 2,614, W-IMP-TRACKS-DROPPED naming Parts 32-39, status recomputed Partial) |
| `xml-basic-partwise.musicxml` | 2001 | MusicXML 3.1 partwise; work-title "Basic Score", creator composer "Corpus Composer"; one part "Piano" midi-channel 1 midi-program 1; divisions 4; key fifths 1; 4/4; `<sound tempo="100">` in measure 1; 8 measures: 4 quarters G4 A4 B4 C5; half D5, quarter rest, quarter E5; whole G4; 8 eighths G4 A4 B4 C5 D5 E5 F#5 G5; dotted half B4 and quarter A4; 4 quarters; 2 halves; whole rest | B 25.3 valid MusicXML; E 3.3 baseline | musicxml; tracks 1 ("Piano", program 0, channel 0); notes 23; durationTicks 26880; tempo [600000]; key fifths 1 major; title "Basic Score"; artist "Corpus Composer"; version "MusicXML 3.1 (partwise), make-corpus"; warnings none; Conversion |
| `xml-basic-timewise.musicxml` | 2002 | the 2001 score written as `score-timewise` | timewise variant | as 2001 with version "MusicXML 3.1 (timewise), make-corpus". Checks: `sameNotesAs:xml-basic-partwise.musicxml` |
| `xml-chords-ties-tuplets.musicxml` | 2003 | one part "Keys", divisions 60, 4/4, 5 measures: m1 chord C4 E4 G4 half, then chord E4 G4 C5 half tied to m2; m2 tied chord quarter (tie stop), quarter rest, eighth triplet D5 E5 F5 (`time-modification` 3:2, duration 20), quarter G5; m3 five 16th quintuplet notes (duration 12), dotted eighth and 16th, half A4 tied to m4; m4 half A4 (tie stop), half rest; m5 quarter rest, two grace notes B4 C5 before quarter E5, half rest | E 3.3 chords and ties across measures, tuplets, grace notes | tracks 1; notes 21; tied chord notes durTicks 2880; A4 durTicks 3840 at tick 9600; triplets at 5760, 6080, 6400 (durTicks 320); quintuplets at 7680 + 192k; graces at 16080 and 16200 (durTicks 120) before E5 at 16320; warnings none; Conversion |
| `xml-parts-voices-staves.musicxml` | 2004 | 4 parts, 4 measures 4/4: "Piano" midi-channel 1 program 1, staff 1 voice 1 quarters C5 D5 E5 F5, `backup`, staff 2 voice 5 halves C3 G3 (24 notes); "Flute" midi-channel 2 program 74, whole notes (4); "Violin" midi-channel 3 program 41, halves (8); "Drums" midi-channel 10 with score-instruments kick (`midi-unpitched` 37) and snare (39), unpitched notes kick on beats 1 and 3, snare on 2 and 4 (16) | E 3.3 multiple parts, voices and staves; unpitched percussion | tracks 4; notes 52; channels 0, 1, 2, 9; programs 0, 73, 40; Drums `isDrums` with pitches 36 and 38 only; warnings none; Conversion |
| `xml-repeats-endings.musicxml` | 2005 | one part, 7 measures, one whole note each: C4 D4 E4 F4 G4 A4 B4; m1 forward repeat, m2 backward repeat; m3 forward repeat; m4 ending 1 (start and stop) with backward repeat; m5 ending 2 (start, discontinue); m6 forward repeat and backward repeat `times="3"`; m7 plain | E 3.3 repeats and alternate endings | tracks 1; notes 12 with pitches 60, 62, 60, 62, 64, 65, 64, 67, 69, 69, 69, 71 at ticks 3840k; durationTicks 46080; Conversion |
| `xml-transposing.musicxml` | 2006 | 4 parts, one measure of 4 quarters each: "Clarinet in Bb" transpose chromatic -2 diatonic -1, written C5; "Horn in F" chromatic -7, written C5; "Guitar" octave-change -1, written E4; "Piano" with `octave-shift type="down" size="8"` before note 1 and `stop` after note 2, written C6 | E 3.3 transposing instruments; octave shifts | tracks 4; notes 16; pitches Clarinet 70 x4, Horn 65 x4, Guitar 52 x4, Piano 96, 96, 84, 84; warnings W-XML-TRANSPOSED (3 parts); Conversion |
| `xml-expression.musicxml` | 2007 | one part "Voice" midi-program 53, 4 measures of 4 quarters: m1 metronome quarter=72, rehearsal "A", `pp`; note 2 staccato, note 3 accent, note 4 tenuto; m2 `mf`, words "Freely", pedal start beat 1 and stop beat 4, note 6 strong-accent; m3 metronome dotted-quarter=60, rehearsal "B", `ff`, note 10 staccatissimo; m4 `<sound dynamics="50">`; lyric line 1 "la" on all notes, line 2 on notes 1 and 2 | B 15.3 tempo markings, articulation and dynamics; lyrics; pedal | tracks 1; notes 16; velocities 33, 33, 48, 33, 80, 105, 80, 80, 112, 112, 112, 112, 45, 45, 45, 45; note 2 durTicks 480; note 10 durTicks 240; tempo [833333 at 0, 666667 at 7680]; markers "A" at 0 and "B" at 7680; CC 64 127 at 3840 and 0 at 6720; lyric TextEvents 16; warnings W-XML-LYRIC-LINES; Partial |
| `xml-unsupported.musicxml` | 2008 | one part "Flute", 4 measures 4/4: m1 4 quarters with `harmony` before notes 1 and 3 and one `figured-bass`; m2 trill-mark on note 5, mordent on note 6, wedge crescendo start and stop; m3 glissando from note 9 to 10, arpeggiate on note 11, `ornaments/tremolo` on note 12; m4 segno direction at beat 1, coda at beat 3, `<sound dacapo="yes">`, note 13 C5 with `alter` 0.5, a quarter cue note, notes 15 and 16, fermata on note 16 | E 3.3 unsupported features reported; B 25.3 files with unsupported features | tracks 1; notes 15 (note 13 pitch 72); warnings W-XML-HARMONY-IGNORED (2), W-XML-FIGURED-BASS-IGNORED, W-XML-ORNAMENT-UNSUPPORTED (names trill-mark, mordent), W-XML-WEDGE-IGNORED, W-XML-GLISS-UNSUPPORTED, W-XML-ARPEGGIO-IGNORED, W-XML-TREMOLO-IGNORED, W-XML-NAV-UNSUPPORTED, W-XML-MICROTONE, W-XML-CUE-SKIPPED, W-XML-FERMATA-IGNORED; Partial |
| `xml-no-notes.musicxml` | 2009 | one part "Empty", 4 measures of whole rests | E 3.3 valid file with no playable events | tracks 1; notes 0; durationTicks 0; warnings W-IMP-NO-NOTES (no W-MDL-NO-NOTES, D5); Conversion; `playable:false` with reason "This file contains no notes to play. It can still be opened in the Studio." |
| `xml-entity-expansion.musicxml` | 2010 | DOCTYPE `score-partwise` with internal subset `<!ENTITY a "aaaaaaaaaa">` and `<!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">`, work-title `&b;` | B 23.1 untrusted XML; S-05 | error E-IMP-014, stage parse |
| `xml-script-text.musicxml` | 2011 | one part, one measure of 4 quarters; work-title text `<script>window.__pwned=1</script>` (XML-escaped); `credit-words` holding a CDATA `<img src=x onerror="window.__pwned=1">`; an XHTML-namespace `<script>` element inside `<credit>`; lyric text `"><b>x</b>` (escaped) | B 23.1 imported text never executed; ADR-12 | tracks 1; notes 4; title is the literal text `<script>window.__pwned=1</script>`; Conversion. Checks: `noExecution` (after SCR-ImportInspect renders the report in the test page: `window.__pwned === undefined` and `#overlay` contains no `script`, `img` or `b` element created from file text) |
| `xml-malformed.musicxml` | 2012 | the 2001 text with the closing tag of the 5th `<note>` omitted | E 3.1 malformed files (XML) | error E-IMP-015, stage parse |
| `xml-not-a-score.xml` | 2013 | `<?xml version="1.0"?>` and an empty `<svg xmlns="http://www.w3.org/2000/svg"></svg>` | identification of non-scores | error E-IMP-002 ("named like MusicXML but no score element"), stage identify |
| `xml-opus.xml` | 2014 | `<opus version="3.1">` with a title and one `<score xlink:href="a.musicxml"/>` | unsupported container kind | error E-IMP-006 (opus text), stage parse |
| `mxl-stored.mxl` | 3001 | `zip` with entries `META-INF/container.xml` (rootfile `score.musicxml`, media type `application/vnd.recordare.musicxml+xml`) and `score.musicxml` = the bytes of 2001, both method 0 | B 15.3 compressed container; E 3.3 | as 2001 with `container:'mxl'`. Checks: `sameNotesAs:xml-basic-partwise.musicxml` |
| `mxl-deflate.mxl` | 3002 | as 3001 with `score.musicxml` method 8 through `deflateFixed` | own inflate on real data | as 3001. Checks: `sameNotesAs:xml-basic-partwise.musicxml` |
| `mxl-no-container.mxl` | 3003 | one stored entry `song.xml` = the bytes of 2001 | container fallback | as 2001 with warnings W-XML-MXL-NO-CONTAINER |
| `mxl-missing-rootfile.mxl` | 3004 | stored entries `META-INF/container.xml` naming `missing.musicxml` and `other.musicxml` (2001 bytes) | container pointing nowhere | error E-IMP-007, stage parse |
| `mxl-ratio-bomb.mxl` | 3005 | hand-built archive: one central entry `score.musicxml`, method 8, compressed size 100, uncompressed size 40,000,000, 100 zero bytes of data | B 23.1 decompression bomb | error E-IMP-004 ("suspicious compression ratio"), stage identify; `Zip.extract` never called |
| `zip-without-score.mxl` | 3006 | stored entries `readme.txt` ("corpus") and `image.png` (8 bytes) | ZIP that is not MusicXML | error E-IMP-002 ("does not contain a MusicXML score"), stage identify |
| `gp3-basic.gp3` | 4001 | `Gp3Writer` version "FICHIER GUITAR PRO v3.00", title "GP3 Basic", artist "Corpus", tempo 120, key 0; channel table entry 0 program 25 volume 13 balance 8; one track "Guitar", 6 strings [64, 59, 55, 50, 45, 40], port 1 channel 1, 24 frets, capo 0; 8 measures 4/4, each beat a quarter with one note on string ((4m + b) % 6) + 1, fret (4m + b) % 5 (m, b 0-based) | B 25.3 valid GP per version; B 15.4 | guitarpro; tracks 1 ("Guitar", program 25); notes 32; tempo [500000]; version "GP3 v3.00"; warnings none; Conversion. Checks: `tab` (first note `x.tab {string:1, fret:0}` pitch 64; second `{string:2, fret:1}` pitch 60), `cc0:[103, 63]` |
| `gp4-basic.gp4` | 4002 | `Gp4Writer` "FICHIER GUITAR PRO v4.06", the 4001 music plus repeat open at measure 1 and close byte 1 at measure 2; lyrics track 1, start measure 1, "one two three four" | GP4 version; repeats; lyrics | tracks 1; notes 40; durationTicks 38400; lyric TextEvents 4; version "GP4 v4.06"; Conversion |
| `gp4-v400.gp4` | 4003 | as 4002 with version string "FICHIER GUITAR PRO v4.00" | claimed version v4.00 | as 4002 with version "GP4 v4.00" |
| `gp4-l406.gp4` | 4004 | as 4002 with version string "FICHIER GUITAR PRO L4.06" | claimed version L4.06 | as 4002 with version "GP4 L4.06" |
| `gp5-basic.gp5` | 4005 | `Gp5Writer` "FICHIER GUITAR PRO v5.10", title "GP5 Basic"; tracks "Lead" (6 strings standard, channel 1, program 29) and "Bass" (4 strings [43, 38, 33, 28], channel 2, program 33); 16 measures 4/4; Lead 8 eighth notes per measure, Bass 4 quarters per measure; markers "Verse" at measure 1 and "Chorus" at measure 9; mix table on Lead at measure 9 beat 1 with tempo 140, duration 0 | GP5 v5.10; markers; mix-table tempo (UT-13-30 uses this file) | tracks 2; notes 192; tempo [500000 at 0, 428571 at 30720]; markers "Verse" at 0, "Chorus" at 30720; durationTicks 61440; version "GP5 v5.10"; warnings none; Conversion |
| `gp5-effects.gp5` | 4006 | `Gp5Writer` "FICHIER GUITAR PRO v5.00"; one track "FX" standard tuning program 27; 8 measures x 4 quarter beats, one note per beat; beats 1-28 carry in order: bend (0,0)(30,100)(60,100); bend with release (0,0)(15,100)(45,100)(60,0); slide shift; slide legato; slide out down; slide in from below; hammer-on; palm mute; staccato; dead note; natural harmonic fret 12 on string 1; natural harmonic fret 7 on string 1; artificial harmonic; pinch harmonic; plain note string 3 fret 5; tied note on string 3; let ring; grace before the beat (fret 5, dynamic 4); on-beat grace; vibrato; trill; tremolo picking; tremolo bar on the beat; tap; ghost note; accent; heavy accent; duration percent 0.5; beats 29-32 plain | B 15.4 effects list; E 3.3 unsupported effects; GP5 v5.00 | tracks 1; notes 33 (32 beats, minus 1 tied, plus 2 graces); harmonic pitches 76 and 83; warnings W-GP-HARMONIC-APPROX, W-GP-TRILL-UNSUPPORTED, W-GP-TREMOLO-PICKING, W-GP-DURATION-PERCENT; version "GP5 v5.00"; Partial. Checks: `bendBeat1` (bend 0 at the beat tick, 8191 at +480, and the last bend of that note at +960 equal to 0), `art` (x.art contains slide:shift, slide:legato, slide:out-down, slide:in-below, hammer-pull, palm-mute, dead, let-ring, vibrato, tap) |
| `gp5-tuning-capo.gp5` | 4007 | "FICHIER GUITAR PRO v5.10"; 4 tracks, 4 measures of 4 quarters each, open strings in order 1..N repeating: "Drop D" [64, 59, 55, 50, 45, 38]; "Capo 3" standard with capo 3; "Seven" [64, 59, 55, 50, 45, 40, 35]; "Twelve" standard with flag 0x02 | E 3.3 alternate tuning and capo; 7 strings | tracks 4; notes 64; checks `pitches`: Drop D string 6 = 38, Capo 3 string 1 = 67, Seven string 7 = 35, Twelve string 1 = 64; Conversion |
| `gp5-drums-mix-directions.gp5` | 4008 | "FICHIER GUITAR PRO v5.10"; tracks "Drums" (flag 0x01, channel 10) and "Guitar" (channel 1 program 29); 8 measures; Drums 8 eighth beats per measure with hat (fret 42) on each, kick (36) on beats 1 and 5, snare (38) on 3 and 7; Guitar 4 quarters per measure; mix table on Guitar at measure 5 beat 1: instrument 30, volume 10, balance 4, tempo 100 with duration 4; measure 3 triplet feel 1; directions: coda = 6 | drums; mix changes; triplet feel; directions | tracks 2; notes 128; Drums `isDrums` channel 9; on Guitar a ProgramEvent 30, CC 7 = 79 and CC 10 = 31 at 15360; tempo [500000, 600000 at 15360]; warnings W-GP-TEMPO-RAMP-IGNORED, W-GP-TRIPLET-FEEL, W-GP-NAV-UNSUPPORTED; Partial |
| `gp5-repeats.gp5` | 4009 | "FICHIER GUITAR PRO v5.10"; one track; 6 measures, one whole note each on string 1 frets 0, 2, 3, 5, 7, 8; measure 1 repeat open; measure 2 close byte 3; measure 3 repeat open; measure 4 alternative mask 0x01 and close byte 2; measure 5 alternative mask 0x02 | GP5 repeat count and alternative endings | tracks 1; notes 11, pitches 64, 66, 64, 66, 64, 66, 67, 69, 67, 71, 72 at ticks 3840k; durationTicks 42240; Conversion |
| `gp2-unsupported.gtp` | 4010 | version block "FICHIER GUITAR PRO v2.21" followed by 200 zero bytes | B 15.4 no universal support; E 3.3 unsupported version | error E-IMP-006 (text contains "Guitar Pro 1 or 2"), stage parse |
| `gp6-file.gpx` | 4011 | `BCFZ`, a little-endian u32 512, 512 bytes from `Prng(4011)` | GP6 identification | error E-IMP-006 (text contains "Guitar Pro 6 or 7"), stage identify |
| `gp7-file.gp` | 4012 | stored zip with `VERSION` ("7.0") and `Content/score.gpif` (`<GPIF/>`) | GP7 identification | error E-IMP-006 (text contains "Guitar Pro 6 or 7"), stage identify |
| `audio-sine-1s.wav` | 5001 | `WavWriter` PCM 16-bit mono 44,100 Hz, 44,100 frames of a 440 Hz sine at amplitude 0.5; 88,244 bytes | B 15.5 audio as audio track | audio; tracks 1 (`kind:'audio'`); notes 0; `playable:false`; warnings W-AUD-NO-TEMPO, W-AUD-NO-SPEED-CHANGE, W-AUD-NOT-PERSISTED; Conversion. Checks: `audioDuration:1.000+-0.001`, `noBufferInJson` (`Song.toJSON` has no `buffer`), `audioSentence` (report notes contain the Part 1.5 sentence), `releaseAudio` (count 1 then 0) |
| `audio-lead-silence.wav` | 5002 | PCM 16-bit mono 8,000 Hz: 4,000 zero frames then 4,000 frames of 440 Hz at amplitude 0.5; 16,044 bytes | E 3.4 silence at the beginning; D6 | as 5001 plus W-AUD-LEADING-SILENCE. Checks: `leadingSilenceMs` in 495-502; `alignStart` (`setSyncOffset(track, -leadingSilenceMs)` then `startOffsetSeconds(track, 0, map)` gives `bufferOffsetS` within 0.002 of 0.5) |
| `audio-unknown-codec.wav` | 5003 | RIFF WAVE with `fmt ` audioFormat 0x7777, 1 channel, 8,000 Hz, `data` of 1,000 bytes from `Prng(5003)` | E 3.4 unsupported codec | error E-IMP-008, stage parse |
| `audio-garbage.mp3` | 5004 | ID3v2.3 header (10 bytes, tag size 0) and 2,000 bytes from `Prng(5004)` with every 0xFF replaced by 0x00 | E 3.4 corrupted audio | error E-IMP-008, stage parse |
| `audio-garbage.ogg` | 5005 | `OggS` and 1,000 bytes from `Prng(5005)` | E 3.4 corrupted audio | error E-IMP-008, stage parse |
| `unknown-random.bin` | 6001 | 4,096 bytes from `Prng(6001)` with byte 0 set to 0x00 (the generator asserts no identification row matches) | unknown format | error E-IMP-002, stage identify |
| `midi-named-as.xml` | 6002 | the bytes of 1001 | extension mismatch | as 1001 plus W-IMP-EXT-MISMATCH; Supported |
| `riff-midi.rmi` | 6003 | `RIFF`, size, `RMID`, `data` chunk holding the bytes of 1001 | refused RIFF MIDI | error E-IMP-006 (rmi text), stage identify |
| `soundfont.sf2` | 6004 | `RIFF`, size, `sfbk`, `LIST` `INFO` with `ifil` = 2.1 | refused SoundFont (D2) | error E-IMP-006 (SoundFont text), stage identify |
| `empty.mid` | 6005 | 0 bytes | empty file | error E-IMP-003 ("The file is empty."), stage validate |
| `project-file.json` | 6006 | the Part 5.5 example document as ASCII JSON | project file dropped on the import screen (D2) | error E-IMP-002 (project text), stage identify |

#### 8.9.4 Malformed variants

Byte offsets for `midi-mono-simple.mid` come from its fixed layout (8.9.3: MThd 0-13, MTrk
id 14-17, MTrk length 18-21, metas 22-53, note k at 54 + 9 (k - 1); the 9th note-on is
bytes 126-129 (`00 90 3C 64`) and its note-off delta bytes 130-131 (`83 60`)). Offsets for
the other bases are taken from the writer's `offsets` (D19).

| File | Base | Mutation | Exercises | Expected import result |
|---|---|---|---|---|
| `midi-mono-simple.trunc-128.mid` | 1001 | `truncate(128)` (inside the 9th note-on) | E 3.1 truncated file | notes 8; warnings W-MIDI-TRUNCATED; Partial |
| `midi-mono-simple.trunc-131.mid` | 1001 | `truncate(131)` (inside the off delta VLQ) | E 3.1 truncated variable-length quantity | notes 9 (the 9th has durTicks 1); warnings W-MIDI-TRUNCATED, W-NOTE-UNMATCHED; Partial |
| `midi-mono-simple.trunc-20.mid` | 1001 | `truncate(20)` (header plus 6 bytes) | truncated before the first chunk | songs 1; tracks 0; notes 0; warnings W-MIDI-TRAILING-BYTES, W-MIDI-TRACK-COUNT, W-IMP-NO-NOTES; Partial; `playable:false` |
| `midi-mono-simple.trunc-12.mid` | 1001 | `truncate(12)` (inside the header) | E 3.1 missing header | error E-IMP-003, stage parse |
| `midi-mono-simple.bad-magic.mid` | 1001 | `setByte(3, 0x58)` (`MThX`) | E 3.1 invalid header | error E-IMP-003 ("named like a MIDI file"), stage identify |
| `midi-mono-simple.bad-hlen.mid` | 1001 | `patchU32BE(4, 4)` | bad header length | error E-IMP-003 ("MIDI header is too short."), stage parse |
| `midi-mono-simple.format3.mid` | 1001 | `patchU16BE(8, 3)` | bad header format | error E-IMP-003 ("MIDI format 3 is not 0, 1 or 2."), stage parse |
| `midi-mono-simple.ppq0.mid` | 1001 | `patchU16BE(12, 0)` | bad division | error E-IMP-003 ("PPQ is zero."), stage parse |
| `midi-mono-simple.bad-vlq.mid` | 1001 | `insert(126, [0xFF, 0xFF, 0xFF, 0xFF, 0x7F])`, `patchU32BE(18, 329)` | bad VLQ | notes 8; warnings W-MIDI-BAD-VLQ; no W-MIDI-NO-EOT; Partial |
| `midi-mono-simple.bad-status.mid` | 1001 | `setByte(127, 0xF4)` | E 3.1 invalid event status byte | notes 8; warnings W-MIDI-BAD-STATUS; Partial |
| `midi-mono-simple.bad-data.mid` | 1001 | `setByte(128, 0xBC)` (pitch byte of the 9th note-on) | invalid data byte | notes 31; warnings W-MIDI-BAD-DATA, W-NOTE-OFF-WITHOUT-ON; Partial |
| `midi-mono-simple.huge-length.mid` | 1001 | `patchU32BE(18, 0x7FFFFFF0)` | E 3.1 invalid track length (too long, huge count) | notes 32; warnings W-MIDI-TRUNCATED; Partial |
| `midi-mono-simple.short-length.mid` | 1001 | `patchU32BE(18, 95)` (chunk ends after 7 notes) | E 3.1 invalid track length (too short) | notes 7; warnings W-MIDI-UNKNOWN-CHUNK, W-MIDI-TRUNCATED, W-MIDI-NO-EOT; Partial |
| `xml-basic-partwise.trunc-half.musicxml` | 2001 | `truncate(floor(length / 2))` | truncated XML | error E-IMP-015, stage parse |
| `mxl-stored.bad-crc.mxl` | 3001 | `xorRange(offsets.data[1] + 100, 1, 0x01)` | damaged archive data | error E-IMP-003 ("failed its CRC check"), stage parse |
| `mxl-stored.encrypted.mxl` | 3001 | `setByte(offsets.central[0] + 8, 0x01)` (general-purpose flag bit 0) | encrypted ZIP | error E-IMP-006 ("Encrypted ZIP archives are not supported."), stage identify |
| `mxl-stored.trunc-eocd.mxl` | 3001 | `truncate(length - 10)` | truncated ZIP (no end record) | error E-IMP-003 ("no end-of-central-directory record"), stage identify |
| `gp5-basic.trunc-measure9.gp5` | 4005 | `truncate(offsets.measureBeats[8][0] + 5)` | E 3.3 truncated GP | tracks 2; notes 96; markers 2; tempo [500000]; durationTicks 30720; warnings W-GP-TRUNCATED ("measure 9 of 16"); Partial |
| `gp5-basic.trunc-header.gp5` | 4005 | `truncate(offsets.channelTable + 100)` | file ends inside the header | error E-IMP-003 ("ends inside its header"), stage parse |
| `gp5-basic.bad-strings.gp5` | 4005 | `patchI32LE(offsets.trackHeader[0].stringCount, 9)` | desynchronized or damaged layout | error E-IMP-003 with `.offset` equal to that field's offset, stage parse |
| `gp5-basic.huge-measures.gp5` | 4005 | `patchI32LE(offsets.measureCount, 100000)` | huge counts | error E-IMP-004, stage parse |

#### 8.9.5 Cases built in memory by `src/92-test-files.js` (not committed)

These exceed the 2 MB corpus size policy (Part 3.6.2) and are generated inside the test page.

| Case | Construction | Expected |
|---|---|---|
| `mem-26mb.mid` | the 1001 bytes padded with zeros to 26 MB | error E-IMP-001, stage validate |
| `mem-101mb.wav` | the 5001 header followed by 101 MB of zeros | error E-IMP-001, stage validate |
| `mem-1000001-events.mid` | format 0, one MTrk with 1,000,001 running-status note messages | error E-IMP-004, stage parse, before `pairNotes` |
| `mem-129-mtrk.mid` | header ntrks 129 and 129 minimal MTrk chunks | error E-IMP-004, stage parse |
| `mem-1m-events.mid` | format 1, 16 MTrk, 1,000,000 events in total (500,000 notes) | resolves; `notes` 500,000; time recorded (desktop PT target: within the 5 s budget; headless value recorded as info, Part 9) |
| `mem-129-parts.musicxml` | 129 `score-part` entries | error E-IMP-004, stage parse |
| `mem-10001-measures.musicxml` | one part with 10,001 measures | error E-IMP-004, stage parse |
| `mem-repeat-bomb.musicxml` | one part in 1/4 with 2,501 measures, each with its own forward and backward repeat `times="16"` (40,016 expanded measures) | resolves; warnings W-XML-REPEAT-CAP; Partial |
| `mem-budget.mid` | `midi-large-100k.mid` bytes with `{budgetMs: 0}` | error E-IMP-005, stage parse |
| `mem-cancel.mid` | `midi-large-100k.mid` bytes, `Import.cancel()` after the first progress event | error E-IMP-011; `Import.isRunning() === false` afterwards |
| audio over the decoded cap | fake decoder (`FLM.SelfTest.fakes.audioDecoder`) returning 400 MB | error E-IMP-004 (UT-14-16 also covers it) |

#### 8.9.6 B 25.3 coverage

| B 25.3 item | Files |
|---|---|
| Simple monophonic MIDI | `midi-mono-simple.mid`, `midi-mono-running-status.mid` |
| Polyphonic MIDI | `midi-poly-chords.mid` |
| Multitrack MIDI | `midi-multitrack-band.mid`, `midi-40-tracks.mid` |
| Percussion-heavy MIDI | `midi-drums-heavy.mid` |
| MIDI with tempo changes | `midi-tempo-changes.mid` |
| MIDI with controller events | `midi-controllers.mid` |
| Valid MusicXML | `xml-basic-partwise.musicxml`, `xml-basic-timewise.musicxml`, `mxl-stored.mxl`, `mxl-deflate.mxl` and the other `xml-*` files with `error` null |
| Valid Guitar Pro for each claimed version | `gp3-basic.gp3` (v3.00), `gp4-v400.gp4` (v4.00), `gp4-basic.gp4` (v4.06), `gp4-l406.gp4` (L4.06), `gp5-effects.gp5` (v5.00), `gp5-basic.gp5` (v5.10) |
| Malformed files | every 8.9.4 row except the truncations; `xml-malformed.musicxml`, `mxl-ratio-bomb.mxl`, `audio-unknown-codec.wav`, `audio-garbage.mp3`, `audio-garbage.ogg` |
| Truncated files | the `trunc-*` and `short-length` rows of 8.9.4 |
| Large files | `midi-large-100k.mid`, `midi-huge-ntrks.mid`, 8.9.5 |
| Files with unsupported features | `midi-controllers.mid`, `xml-unsupported.musicxml`, `gp5-effects.gp5`, `gp5-drums-mix-directions.gp5`, `gp2-unsupported.gtp`, `gp6-file.gpx`, `gp7-file.gp`, `riff-midi.rmi`, `soundfont.sf2` |

E 3.1 and E 3.2 coverage is the "Corpus file" column of 8.3.4; E 3.3 coverage is 8.4.4 and
8.5.3; E 3.4 coverage is `audio-*` plus 8.9.5 and the LT real-file rows (VBR MP3, long
fade-out, AAC). Real-world files are not committed (licensing); LT tests import at least
three real files per format and record the browser, file description and result in
`docs/COMPATIBILITY.md` section 5 (Part 12).

### 8.10 Inspection screen data contract (I 6.1) and chart preview flow (I 6.2)

SCR-ImportInspect (mode `import`, M-27) renders only the `InspectionReport` object (Part
6.14.2) and the outputs of `Mapping.ChartGenerator`; it never receives file bytes or raw
file text, and every string from the file is inserted with `textContent` (ADR-12).

#### 8.10.1 Screen states

| State | Entered on | Content | Leaves to |
|---|---|---|---|
| Empty | screen mount | "Choose file" button, drop zone ("Drop a music file here"), the hint text of 8.2.3, link "What is supported?" (8.7.3) | Loading |
| Loading | `importFile` called | file name; checklist Validate, Identify, Read, Organize, Inspect, Preview (stage values `validate`, `identify`, `parse`, `normalize`, `inspect`, `chart`) with the current one marked "working"; a determinate bar only while `fraction` is non-null; "Cancel" calls `Import.cancel()` | Report, Error, or Empty after E-IMP-011 (no error panel) |
| Error | `import.failed` | title "Import failed"; the code's user text (8.2 or Part 6.14.5) via `textContent`; line "Step: <stage label>"; actions from the Part 6.14.5 action column ("Choose another file", "Retry", "What is supported?"); "Copy details" copies `code`, `stage`, file name and size (no file content) | Empty or Loading |
| Report | `import.done` | 8.10.2 | Sequence chooser, Track selector, Preview, Confirm |
| Sequence chooser | report with `songs.length > 1` (SMF format 2) | list of `SongSummary {title, trackCount, noteCount, duration}`; choosing one rebuilds the report with `InspectionReport.build(songs, {selectedSong:i})` | Report |
| Track selector | report with `overflowTracks.length > 0` | checklist of all tracks with notes and instrument, 32 maximum checked, default `report.trackSelection`; counter "32 of 40 selected"; "Apply" | Report (`applyTrackSelection` runs at confirm, 8.10.4) |

#### 8.10.2 Report data contract

| I 6.1 item | Report field(s) | UI element | Display rule |
|---|---|---|---|
| Detected file format and version | `format`, `version`, `container`, `status` | header line and status badge | "Standard MIDI File - SMF format 1, 480 PPQ"; "MusicXML 3.1 (partwise), Finale" plus " (compressed .mxl)" when `container === 'mxl'`; "Guitar Pro - GP5 v5.10"; "Audio - audio/wav"; badge shows the status word with a glyph (check for Supported, double arrow for Conversion, half circle for Partial) and never color alone |
| File identity | `fileName`, `fileSizeBytes`, `fileHash` | subtitle | name truncated in the middle to 48 characters (`UI.truncate`); size with one decimal ("1.2 MB", "88 KB"); when a Song Library entry has the same `source.fileHash`: "This file is already in your library as '<title>'." |
| Tracks and instrument assignments | `tracks[]` (`TrackRow`) | table: target radio, Name, Instrument, Channel, Notes, Range, Largest chord, Notes per bar, Warnings | Instrument = `programName` ("Drums" for `isDrums`, "Audio" for `kind:'audio'`); Channel 1-based; Range "E2-G5" from `pitchRange` names or "-"; rows with `playable:false` show "No notes to play" and have a disabled radio; the `recommended` row has the label "Recommended" |
| Song duration and tempo information | `duration`, `tempo` | facts list | duration `m:ss` from `duration.formatted`; tempo "120 BPM" when `changes === 0`, else "90-140 BPM, 5 changes (starts at 120 BPM)"; `tempo.source === 'default'` appends " (default, not in file)" |
| Time and key signatures | `meters`, `metersSource`, `keys`, `keysSource` | facts list | "4/4, then 3/4 at bar 3, 6/8 at bar 5" (first four entries, then "and N more"); keys by name; default sources append " (assumed, not in file)" |
| Track event counts | `TrackRow.noteCount`, `eventCount`, `stats.events` | Notes column; tooltip and accessible label "N notes, M events" | integers with thousands separators |
| Unsupported features and conversion warnings | `warnings`, `warningCounts`, `warningsDropped`, `notes` | info rows first (`notes` sentences, 8.4.2, 8.5.1, 8.6.1), then the warnings list grouped error, warn, info | each row: glyph, message, location ("Track 'Bass', bar 12" from `location.track` and `MeterMap.barAt(tick).bar + 1`), count "x3"; the first 10 rows, then "Show all (N)"; `warningsDropped > 0` adds "and N more of the same kinds were not listed" |
| Which track will be playable | `recommendedTrackId`, the target radio, `playable`, `unplayableReason` | target radio default = recommended track; Play button state | `playable:false` disables "Play now" with `unplayableReason` as the visible reason text |
| Whether the arrangement needs a simplified four-button mapping | `chordComplexity` and the preview chart's `stats` | "Four-button fit" box | per difficulty: "Simplified" when `needsSimplification`, else "Close to the source"; the selected chart's `describe()` line; W-IMP-CHART-OMITTED message when `omittedSourceEventIds > 0`; the sentence "All {n} notes of this track stay in the song; the chart uses {k} of them." (I 1.2, E 4.2); `perDifficulty === null` shows "Computed when you choose a track." |
| Audio facts (audio reports only) | `audio` | facts list and sync controls | duration, sample rate, channels, decoded size in MB; `syncOffsetMs` controls of 8.6.3; leading silence line with "Align start" |

#### 8.10.3 Chart preview and mapping change flow (I 6.2)

Controls under the tracks table: Target track (the radio), Instrument (GM program select,
default the track's program, fixed to "Drums" for drum tracks; sets `Chart.instrument`, the
sound of hit notes), Difficulty (Beginner, Intermediate, Advanced, Expert; default from
`session.quickPlay.difficulty`), Profile (A to F with the names of brief section 5; default
A, F for drum tracks), and the preview panel.

```text
user changes target, instrument, difficulty or profile
  -> stop any running preview playback
  -> debounce 150 ms (a newer change restarts the timer)
  -> if target.noteCount <= 50,000:
        chart = Mapping.ChartGenerator.generate(song, trackId, difficulty, profile, {})
     else: show "Preview" button; generate on press, showing "Generating chart..." (no percentage)
  -> chart.instrument = selected program (128 for drums)
  -> rows = ChartGenerator.preview(chart, song, fromBar, 4); text = ChartGenerator.describe(chart)
  -> draw rows on canvas#import-preview: four lanes with the lane glyphs of Part 7, holds as bars,
     chord members joined, bar lines and bar numbers; omitted-note count; fromBar controls
     "<" ">" and "Jump to section" (Model.sections(song))
  -> song is never modified (lockedSource tracks; S-08); the chart is held only by the screen
```

- Determinism: identical `(song, trackId, difficulty, profile)` gives an identical chart and
  `settingsHash` (I 6.2 safeguard); the same parameters are passed to Quick Play, which
  regenerates the same chart at mode enter (Part 4.7.1 step 7) instead of receiving the
  object.
- Listen: the "Listen" button binds `Audio.Scheduler` to `Transport.main` with the report's
  song (the `import` mode preview binding, Part 4.7 table), plays the full arrangement from
  `fromBar` for 4 bars with a playhead over the preview canvas, then stops and unbinds; any
  control change or leaving the screen stops it. Before the audio unlock gesture the button
  shows DLG-AudioBlocked.
- Chart errors are shown before play (P 12 analogue for instrument charts): a chart failing
  `ChartGenerator.validate` shows "This chart could not be prepared (E-INP-012)." and
  disables Play now; W-IMP-CHART-EMPTY shows "This track has no notes to chart."
- Dance: the screen offers no dance preview; Dance Mode generates dance charts from the
  saved or registered song (Part 6.23).

#### 8.10.4 Confirm actions and "import never overwrites the current project without confirmation" (P 11)

The current project is `Project.current()`. It "has unsaved work" when `Project.isDirty()`
is true, or when it has never been saved (`sizeBytes === 0`) and has at least one track.

| Action | Enabled when | Steps |
|---|---|---|
| Play now | `report.playable` and a playable target is chosen | 1. If `overflowTracks.length > 0`: `Import.applyTrackSelection(report, selection)` (default selection unless changed); 2. if the current project has unsaved work: DLG-ImportReplace variant "keep"; 3. `Project.Catalog.register({id: 'imp-' + fileHash + '-' + selectedSong, title, kind:'imported', persisted:false, song})` (memory only; re-registering the same id replaces the entry); 4. `Modes.enter('quickplay', {songId, trackId, difficulty, profile, instrument, origin:'import'})`; the current project stays current and unchanged; 5. `session.quickPlay` is updated |
| Save to Library | always for a successful report (including audio and no-notes reports) | 1. selection as above; 2. if the current project has unsaved work: DLG-ImportReplace variant "replace"; 3. `project = Project.fromSong(song, {name: song.title})`; 4. `await Storage.saveProject(project)`; on `project.saveFailed`: DLG-SaveFailed (with "Export project file" offering `.flm.json`), the screen stays on the report and nothing else changes; 5. on `project.saved`: `Project.setCurrent(project)`, toast "'<title>' was added to the Song Library.", `Modes.enter('library', {highlight: project.id})`; audio buffers stay attached to the new project's audio tracks |
| Cancel | always | `Import.releaseAudio()` for this report's audio tracks; the report and its songs are dropped; `UI.Screens.back()`; the current project is unchanged (S-12 IT) |

DLG-ImportReplace (exact texts; `{current}` is the current project name, `{song}` the
imported title; both inserted with `textContent`):

| Variant | Title | Body | Buttons (left to right; first is primary) |
|---|---|---|---|
| keep (Play now) | "Save your project first?" | "'{current}' has unsaved changes. It stays open while you play '{song}', but it is not saved yet." | "Save and play" (await `Storage.saveProject(current)`; on failure DLG-SaveFailed and stop), "Play without saving", "Cancel" |
| replace (Save to Library) | "Replace the open project?" | "'{current}' has unsaved changes. Adding '{song}' to the Song Library opens it in place of '{current}'." | "Save '{current}' first" (await save; on failure DLG-SaveFailed and stop), "Discard changes" (first writes a recovery checkpoint of the current project through `Storage.checkpoints.write` so DLG-RecoverCheckpoint can restore it, then continues), "Cancel" |

No path writes over the current project's stored record: Save to Library creates a new
project id; "Discard changes" drops only unsaved in-memory edits and keeps a checkpoint.
`Escape` and the browser back gesture equal "Cancel" in both variants.

#### 8.10.5 Leaving the screen

Leaving `import` without confirming releases every decoded audio buffer of the report
(`Modes.assertClean` expects `Import.audioBufferCount()` to equal the audio tracks of the
current project), stops a running preview (`Scheduler.unbind`), cancels a running import
(`Import.cancel()`) and drops the report. Confirmed songs live on through the Catalog entry
(Play now) or the saved project (Save to Library).

#### 8.10.6 Verification (IDs assigned in Part 12)

| Category | Test |
|---|---|
| IT | import a corpus file while a dirty project is open, then Cancel: `Project.current()` deep-equal and `isDirty()` unchanged (S-12) |
| IT | Save to Library with a dirty current project: DLG-ImportReplace "replace" appears; "Cancel" changes nothing; "Discard changes" leaves a checkpoint restorable by DLG-RecoverCheckpoint; "Save first" with `storage.writeFail` injected shows DLG-SaveFailed and leaves both the current project and the report intact |
| IT | Play now from `midi-multitrack-band.mid`: Quick Play starts with the chart whose `settingsHash` equals the preview chart's; the current project is unchanged |
| IT | preview flow: changing difficulty four times within 100 ms generates once (debounce); the song's serialized fnv1a32 is unchanged after all six profiles and four difficulties |
| FT | every report field of 8.10.2 is populated for `midi-multitrack-band.mid`, `xml-basic-partwise.musicxml`, `gp5-basic.gp5`, `audio-sine-1s.wav` (non-null where the format provides it) |
| LT | keyboard-only and touch-only walkthrough of Empty, Loading, Report, Preview, Play now, Save to Library on desktop and mobile |

### 8.11 Export formats and round trips (B 15.6)

#### 8.11.1 Export table

All exports are pure functions from model to bytes, delivered by `Storage.files.download`
(Part 6.16) with the file-name rule of Part 5.14; none mutates the project, and a failed
export never changes stored data (I 13 "safe handling of failed exports"). Round-trip tests
are the FT subgroup `files.roundtrip`. Where Part 5.14 and Part 6 name a reader differently,
the Part 6 name is used: `Midi.parse` (Part 5.14 "Midi.read") and `Project.parse` (Part 5.14
"Project.load").

| Format (suffix) | Schema reference | Producer, reader | Where offered | Round-trip test (`files.roundtrip.*`) | What is lossy |
|---|---|---|---|---|---|
| Standard MIDI File (`.mid`) | Part 5.14.1 writer rules and round-trip table | `Midi.write(song, {tempoOverride})`, `Midi.parse` | SCR-Studio Export (whole song); Studio track menu "Export track as MIDI" (a one-track song); SCR-FreePlay after a recording "Export take as MIDI"; SCR-Results "Export my performance" (the hit notes of the run, 8.11.3) | `mid-corpus`: import `midi-poly-chords.mid`, `midi-multitrack-band.mid`, `midi-meter-key-changes.mid`, `midi-controllers.mid`, `midi-text-markers.mid`, `gp5-basic.gp5`, `xml-expression.musicxml`; `write`; `parse`; compare per the 5.14.1 table (notes tick, durTicks, pitch, velocity, offVelocity, channel; CC, program, bend, text; tempo, meter, key maps; markers; track names, order, programs, `isDrums`; title; artist) after stripping ids. `mid-take`: record a 64-note take in a fake-clock Studio session, export, re-import, equal. `mid-fixpoint`: with `w1 = write(song)`, `w2 = write(parse(w1))`, `w3 = write(parse(w2))`, `w2` and `w3` are byte-equal for every song above (the first generation may differ only by trailing silence, D11 and Part 6.10.9) | note ids, track colors, visibility, mixer (`mix` gain, pan, mute, solo), `lockedSource`, `derived`, `SourceInfo` and warnings, charts, dance charts, characters, settings, recordings, audio tracks (W-EXP-AUDIO-SKIPPED), `x` data (articulation and tab flags), trailing silence after the last event; with `tempoOverride` the song's tempo map is replaced by one tempo (the dialog says so) |
| Project (`.flm.json`) | Part 5.5 schema `flm-project` v1 | `Project.serialize`, `Project.parse` | SCR-Studio Export; SCR-Library item menu "Export project file"; DLG-SaveFailed and DLG-ProjectTooLarge "Export" | `project-cycle`: for a project built from `midi-multitrack-band.mid` plus 2 recorded takes, 3 characters, 1 dance chart, mixer and settings changes and an unknown field under `x`: `serialize` -> `parse` -> `serialize` is byte-equal and the projects are deep-equal; 10 save and load cycles through `Storage` with `FakeIndexedDB` stay byte-equal (P 16); unknown fields survive in `x` | the undo history (`history` is `{}` on disk), decoded audio buffers (metadata only), aborted takes, generated charts in checkpoints (regenerated) |
| Dance chart (`.flmdance.json`) | Part 5.14.2 `flm-dance` v1, `danceChart` definition of 5.5 | `Dance.exportChart(chart, song)`, `Dance.importChart` | SCR-Dance chart menu "Export chart" | `dance-cycle`: export the `normal` chart of built-in song 5, import, steps deep-equal; importing onto a different song shows the Part 5.14.2 notice and keeps the steps | generated charts become `source:'imported'` on re-import (never regenerated) |
| Character (`.flmchar.json`) | Part 5.10 `CharacterPreset` (`flm-character` v1) | `Character.exportPreset(config)`, `Character.importPreset` | SCR-Characters "Download preset" | `character-cycle`: every built-in preset exported and imported, appearance fields deep-equal; `id`, `slot`, `instrument` are not part of a preset | `id`, `slot`, `instrument` (by design) |
| Settings backup (`.flmsettings.json`) | Part 5.14.2 `flm-settings` v1 | `Settings.export()`, `Settings.import` | SCR-Settings "Back up settings" and "Restore settings" (DLG-ImportSettings confirms) | `settings-cycle`: non-default values in every group exported and imported, deep-equal after normalization | none (out-of-range values are normalized on import, W-SET-NORMALIZED) |
| Audio mix (`.wav`) | Part 5.14.3 (RIFF PCM 16-bit stereo 48 kHz) | `Audio.renderWav(project, {durationS, sampleRate:48000})`; no reader | SCR-Studio Export, enabled when `Caps.offlineAudioContext` | `wav-header` (no round trip: a WAV is not a project): parse the header back, `dataBytes === frames * 4`, duration within 1 ms of the request, RMS above 0 for a project with notes, peak <= 1.0 | everything editable: a WAV is rendered sound only (B 11.5); the metronome is excluded; the mix is limited by the master limiter; synthesized timbres |
| Captured mix (`.webm` or `.m4a`, OQ-2 alternative) | MediaRecorder output of the master bus | `Audio.captureMix(project)` through `MediaStreamAudioDestinationNode` and `MediaRecorder`; no reader | SCR-Studio Export when WAV is refused for length on mobile or `OfflineAudioContext` is missing and `MediaRecorder` exists | `capture-smoke` (XT and LT only: real-time capture of a 5 s project produces a non-empty blob with the reported MIME type) | as WAV; plus lossy compression by the browser codec; real-time duration |
| Diagnostics (`.flmdiag.json`) | Part 10.10 | `Core.Diagnostics.export()`; no reader | SCR-Diagnostics, `#fatal` | not applicable (FT checks the size limit 200 KB and the absence of song content unless attached) | not a song format |

#### 8.11.2 Export dialog rules (DLG-Export, rendered by M-27)

| Rule | Decision |
|---|---|
| Formats listed | MIDI, Project file, Audio (WAV) and, when applicable, Audio (recorded in real time); each unavailable entry is disabled with its reason ("WAV export is not available in this browser.", "This mix is longer than {cap} for WAV export on this device.", "There are no MIDI tracks to export.") |
| Notices shown before a MIDI export | "Mixer settings are not part of MIDI." always; "Audio tracks are not included." when the song has audio tracks (W-EXP-AUDIO-SKIPPED); "The tempo you set in the Studio replaces the song's tempo changes." when `tempoOverride` is set; channel remaps (W-EXP-CHANNEL-REMAPPED) listed by track |
| Progress | MIDI and project exports are synchronous (budget 200 ms for 100,000 events, Part 9); WAV shows an indeterminate "Rendering..." state (OfflineAudioContext reports no progress) and is cancellable by closing the dialog |
| Failure | writer errors E-EXP-001 ("There are no MIDI tracks to export."), E-EXP-002 ("A MIDI delta time exceeds the maximum encodable value."), E-EXP-003 (WAV length cap) and a download `method:'none'` result (Part 6.16 texts) show the text in the dialog with "Try again"; the project is untouched |
| Success message | "Downloaded '<file name>'." only after `Storage.files.download` resolved with `method` `anchor` or `dataUrl`; the browser's own download completion cannot be observed, so the text never says "saved" |

#### 8.11.3 MIDI performance exports (B 15.6 "Exporting MIDI performances")

| Source | Song written |
|---|---|
| Studio project | the project song (all `kind:'midi'` tracks, in track order) |
| One Studio track | a Song holding that track plus the conductor data (tempo, meter, key, markers) |
| Free Play take | the take's NoteEvents as one track with the take's program and the session tempo and meter (`tempoAtRecord`) |
| Rhythm-mode run (SCR-Results "Export my performance") | one track named "Performance" whose notes are the `pitches` of every ChartNote judged perfect, great or good, at the chart tick, with the chart duration, on the chart's instrument; plus the source arrangement's other tracks when "Include the band" is ticked (default on) |

### 8.12 Practice tools (I 6.3)

#### 8.12.1 Where the tools are

The practice panel is a tab of SCR-Pause in `instrument`, `quickplay` and `tutorial`
(instrument charts) and is also reachable from the SCR-QuickPlay Customize level before the
run starts. SCR-Dance offers speed and loop only (Part 5.11 `session.dance.practiceSpeed`).
SCR-Results offers "Practice this section" for the section with the lowest accuracy, which
starts the same chart with Loop set to that section. Multiplayer has no practice tools (the
host's settings apply and speed is fixed at 1.0x). No tool modifies the Song, its tracks or
the project (I 5.1, S-08); every tool acts through Transport, Scheduler, practice gains and
chart options (D16, D17, D18, D25).

#### 8.12.2 Tool table

| Tool (I 6.3 item) | Control | Range and default | Implementation | Effect on scoring and records | Persists |
|---|---|---|---|---|---|
| Mute the target instrument | "Your part" selector: Muted, Lowered, Full | `gameplay.targetTrackMode`: `mute` (gain 0), `lower` (gain 0.3, about -10 dB), `full` (gain 1); default `lower` | `Audio.setPracticeGain(targetTrackId, g)`; in `mute` and `lower` each judged hit (perfect, great, good) sounds the ChartNote's `pitches` on the chart instrument through the player strip; in `full` hits do not sound separately (the source plays) | none; results stay comparable (Part 5.11 "yes") | setting |
| Lower accompaniment volume | "Band volume" slider | `gameplay.accompanimentVolume` 0-1, step 0.05, default 1.0 | `Audio.setPracticeGain(id, v)` on every non-target track | none | setting |
| Solo an individual track | per-track "Solo" toggles in the panel's track list | session only; default none | Scheduler solo semantics on a session copy of the mute and solo flags (target track keeps its "Your part" gain) | none | mode params |
| Loop a difficult section | "Loop" toggle plus a section menu (`Model.sections(song)`) or bars From and To (1-based integers, From <= To <= bar count) | off by default | `Transport.setLoop(tickOfBar(from - 1), tickOfBar(to))`; one count-in bar before the first pass only; at each wrap the Judge re-arms the region's notes (Part 6.9, `transport.loop`) and the HUD shows "Pass N: <accuracy> %" | a loop run creates no PerformanceRecord; practice minutes count toward `counters.practiceMinutes` (Part 5.13) | mode params |
| Slow playback while preserving pitch | "Speed" slider and buttons -0.05 and +0.05 | 0.50x to 1.50x in 0.05 steps, default 1.00x (instrument); 0.50x to 1.00x (dance) | `Transport.setSpeed(v)`; synthesized MIDI notes keep their pitch at every speed by construction (the synthesizer starts each note at its own pitch; only the timing scales); audio tracks are silent at any speed other than 1.0x (D16) and the slider shows "Audio tracks are silent at speeds other than 1.0x." when the song has audio tracks; judgment windows stay in milliseconds of audio time (Part 6.9); note spacing on the highway grows because travel time is constant in ms | speed other than 1.0 makes the record `comparable:false` (Part 5.13) | mode params |
| Increase speed progressively | "Speed up after a clean pass" toggle (needs Loop) with Threshold (80, 90, 95 percent; default 90) and Target speed (default 1.00x, up to 1.50x) | off by default | after each loop pass whose accuracy >= threshold: `setSpeed(min(target, speed + 0.05))` at the wrap; a pass below the threshold keeps the speed; HUD "Next pass: 0.85x" | as Loop | mode params |
| Restart from a measure or section | "Start at" section buttons and a "Bar" number field (1 to bar count) | default bar 1 | `Transport.stop()`, `Transport.seek(tickOfBar(bar - 1))`, `Transport.play()` with a 1-bar count-in; the Judge marks notes before the start tick as skipped (excluded from `total`) | completion below 1, so `comparable:false`; recorded normally otherwise | mode params |
| Practice one hand or one part | "Hands": Both, Left, Right; "Split at" note (48 to 72, default 60 = C4) | available when the target track's GM family is Piano, Chromatic Percussion, Organ, Synth Lead or Synth Pad and the track has notes on both sides of the split; otherwise the control is disabled with "One-hand practice is available for keyboard parts." | Left: chart regenerated with `pitchRange {lo:0, hi:split - 1}`, Right: `{lo:split, hi:127}` (D18, own `settingsHash`); the other hand plays automatically: `Audio.Scheduler.setTrackFilter(targetTrackId, {pitchLo, pitchHi, gainInRange: <Your part gain>})` with the track's practice gain at 1 (D17) | the chart has its own hash, so personal bests are kept per hand and never mixed with the full chart | mode params |

Rules shared by all tools:

1. Changing a tool while playing takes effect at the next scheduler tick (speed, gains,
   solo) or at the next loop wrap or restart (loop range, hands); changing hands
   regenerates the chart, which pauses the run and resumes after a 1-bar count-in.
2. Calibration is never touched by any practice tool (Part 5.12).
3. Every tool's state is listed on SCR-Results ("Practice: 0.75x, loop bars 9-16, left
   hand") so a result is never presented without the conditions that produced it (P 5.3).

#### 8.12.3 Verification (IDs assigned in Part 12)

| Category | Test |
|---|---|
| TT | with an `OfflineAudioContext`, a 440 Hz synth note rendered at speeds 0.5, 1.0 and 1.5 has its spectral peak within 1 Hz of 440 Hz each time, and onsets at `audioTimeAt(tick)` for that speed within 1 ms |
| IT | `targetTrackMode` `mute`: the target strip's effective gain is 0 and synthetic perfect inputs produce `sched.noteOn` events with `live:true` on the player strip; `lower`: gain 0.3 |
| IT | speed 0.75 on a song with an audio track: no `AudioBufferSourceNode` is started for it; back to 1.0: one is started at the current position (D15, D16) |
| IT | loop bars 9-16 with progressive speed (threshold 90) and synthetic perfect inputs: the speed after 3 passes is the start speed + 0.15; no PerformanceRecord is written |
| IT | restart at bar 9: `Transport.positionAt` after the count-in equals `tickOfBar(8)`; the record has `comparable:false` |
| IT | one-hand Left on the piano track of `midi-multitrack-band.mid` ("Keys"): every ChartNote pitch is below 60; notes at or above 60 are scheduled at unchanged gain; the chart's `settingsHash` differs from the Both-hands chart |
| UT | all tools leave the Song's serialized fnv1a32 unchanged and leave `Modes.assertClean` clean after leave (practice gains and filters dropped by `Scheduler.unbind`) |
