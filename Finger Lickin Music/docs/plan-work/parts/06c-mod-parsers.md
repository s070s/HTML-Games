### 6.10 M-10 Midi (`src/10-midi.js`, `FLM.Midi`)

#### 6.10.1 Responsibilities and non-goals

M-10 turns Standard MIDI File bytes into one or more `Song` objects (format 0 and 1 produce
one Song, format 2 one Song per track) and writes a `Song` back to a format 1 SMF (Part
5.14.1). It owns SMF structure: header, chunks, variable-length quantities, running status,
channel and meta messages, PPQ and SMPTE divisions, tick rescaling to PPQ 960, the SMF
warning catalog `W-MIDI-*`, and the SMF limits. It uses `FLM.Model.pairNotes` for note-on
and note-off pairing (policies live in M-03, 6.3.4.3) and `FLM.Theory.GM_PROGRAMS` for track
name fallbacks.

Non-goals: no file identification beyond `identify` (the pipeline is M-14), no inspection
report, no UI, no project handling, no playback, no sustain derivation (M-03), no chart
generation (M-08). M-10 never reads `window`, never touches the DOM and never schedules
timers except the `setTimeout(0)` yields inside `parseAsync`.

Spec grounding: B 15.1, 15.2, 15.6, 15.7, 23.1; E 3.1, 3.2, 10 (items 3 and 11); I 6.4, 16.2,
17; P 11, 16 (repeated save and load preserve content).

#### 6.10.2 Public API

```js
FLM.Midi = {
  LIMITS: {
    maxFileBytes: 25 * 1024 * 1024,   // checked again by M-14 before bytes reach parse()
    maxTracks: 128,                   // MTrk chunks; E-IMP-004 when exceeded
    maxEvents: 1000000,               // channel + meta events across the file; E-IMP-004
    maxVlqBytes: 4,                   // 5th continuation byte -> W-MIDI-BAD-VLQ, track abandoned
    maxTick: 2147483647,              // after rescaling to PPQ 960; E-IMP-004 'song too long'
    maxNameChars: 128,                // track, sequence and instrument names (after sanitizing)
    maxTextChars: 1000,               // text, lyric, marker, cue, copyright payloads
    maxMapEntries: 10000,             // tempo, meter and key entries kept (Part 5.1.1)
    maxMarkers: 1000,
    yieldEvery: 20000,                // events between setTimeout(0) yields in parseAsync
    budgetMs: 5000                    // wall clock from parseAsync start; E-IMP-005
  },

  /** Warning catalog: code -> {severity, message}. `message` may contain {n}, {name}, {value}
   *  placeholders filled by the parser. The full table is in 6.10.4.9. */
  WARNINGS: { /* 'W-MIDI-TRUNCATED': {severity:'warn', message:'...'}, ... */ },

  /** Cheap sniff. Returns null unless bytes[0..3] === 'MThd'. Never throws. */
  identify(bytes /* Uint8Array */)
    /* -> {format:'midi', version:string, smfFormat:0|1|2, division:{ppq}|{fps, ticksPerFrame}, ntrks:int}
          or {format:'midi', version:'SMF (header incomplete)'} when bytes.length < 14, or null */,

  /** Synchronous parse. Throws Error with .code (E-IMP-003, E-IMP-004) on fatal structure
   *  errors; everything recoverable becomes a warning. Used by tests and by the writer round
   *  trip; the pipeline uses parseAsync. */
  parse(bytes /* Uint8Array */, opts /* ?ParseOptions */) /* -> ParseResult */,

  /** Time-sliced parse: yields with setTimeout(0) every LIMITS.yieldEvery events, checks the
   *  deadline at each yield (E-IMP-005), checks opts.isCancelled() at each yield (E-IMP-011),
   *  calls onProgress({bytesDone, bytesTotal, events}) after each yield. Resolves to the same
   *  ParseResult parse() would return for the same bytes (determinism test UT-10-33). */
  parseAsync(bytes, opts /* ?ParseOptions */, onProgress /* ?function */) /* -> Promise<ParseResult> */,

  /** Format 1 writer per Part 5.14.1. Throws Error .code E-EXP-001 when the song has no
   *  kind:'midi' track, E-EXP-002 when a delta exceeds 0x0FFFFFFF. */
  write(song /* Song */, options /* ?{tempoOverride:number|null, includeArtist:boolean=true} */) /* -> Uint8Array */,

  util: {
    readVlq(bytes, pos) /* -> {value:int, next:int, bytesRead:int, overflow:boolean} */,
    writeVlq(value) /* -> number[] (1..4 bytes) */,
    /** Exact rational rescale of an absolute tick: floor((tick * 960 * 2 + srcPpq) / (2 * srcPpq)). */
    rescale(tick, srcPpq) /* -> int */,
    /** SMPTE: seconds = tick / (fps * ticksPerFrame), fps 29 means 29.97; ticks at 120 BPM = round(seconds * 1920). */
    rescaleSmpte(tick, fps, ticksPerFrame) /* -> int */,
    decodeText(bytes /* Uint8Array */, maxChars) /* -> string: UTF-8 (fatal) then Latin-1 fallback; control chars removed; truncated */,
    programName(program, isDrums) /* -> string via FLM.Theory.GM_PROGRAMS or 'Drums' */
  }
};

// Shared across M-10, M-12, M-13 (each parser returns this shape; M-14 consumes it)
// ParseOptions { fileName:string, yieldEvery:int, budgetMs:int, deadline:number (performance.now() absolute; wins over budgetMs),
//                isCancelled:() => boolean, trackIndexBase:int }
// ParseResult {
//   format:'midi'|'musicxml'|'guitarpro', version:string, container:'xml'|'mxl'|null,
//   songs:[Song],                       // 1 song, or N for SMF format 2
//   warnings:[ImportWarning],           // file-level (not attached to a track); song-level ones are in song.source.warnings
//   stats:{bytes:int, events:int, notes:int, tracks:int, ms:number, yields:int},
//   smf:{format:int, ntrks:int, division:{ppq:int}|{fps:number, ticksPerFrame:int}} | null
// }
```

Events emitted: none. Events consumed: none. The module registers with
`FLM.Core.define('Midi', factory)` (Part 3.11) and depends on `FLM.Model` and `FLM.Theory`
only (`FLM.Core` implicitly).

#### 6.10.3 Internal state

M-10 holds no state between calls. A single parse owns one `Ctx`:

```text
Ctx {
  bytes, len, pos,                       // Reader primitive (6.10.4.1)
  smf: {format, ntrks, division},
  deadline, yieldEvery, isCancelled, onProgress,
  events: int, notes: int, yields: int,  // counters; events > LIMITS.maxEvents -> E-IMP-004
  tracksRaw: [RawTrack],                 // one per MTrk, in file order
  fileWarnings: WarningBag,              // coalesced by code
  t0: performance.now()
}
RawTrack {
  index, name:string|null, instrumentName:string|null, channelPrefix:int|null,
  raw: [RawNote]  // {tick, type:'on'|'off', pitch, velocity, channel, order}
  ccs: [{tick, controller, value, channel, order}], programs: [{tick, program, channel, order}],
  bends: [{tick, value, channel, order}], texts: [{tick, type, text, order}],
  tempos: [{tick, usPerQuarter, order}], meters: [{tick, numerator, denominator, order}],
  keys: [{tick, fifths, mode, order}], markers: [{tick, label, kind, order}],
  eotTick:int|null, truncated:boolean, abandonedAt:int|null, channelsUsed:Set<int>,
  warnings: WarningBag, maxTick:int
}
WarningBag: Map<code + '|' + trackIndex, ImportWarning>  // first location kept, count incremented
```

Invariants: `pos <= len` always (the Reader throws a typed `EOF` sentinel internally when a
read would cross `len`; callers convert it to truncation handling); ticks inside `RawTrack`
are already rescaled to PPQ 960 (rescaling happens at message read time on the absolute
source tick, never on deltas); `order` is the running index of the message within its track
and is the only tie-breaker used by `pairNotes` input ordering.

#### 6.10.4 Algorithms

6.10.4.1 Shared parser conventions (normative for M-10, M-11, M-12, M-13, M-14)

1. Reader primitive. Each binary module (M-10, M-11, M-13) contains a private `Reader`
   with the same contract: `u8() u16be() u32be() u16le() u32le() i8() i16le() i32le() f32le() f64le()
   bytes(n) skip(n) peek() pos len eof()`. Every read checks `pos + n <= len` first and
   throws the sentinel object `EOF = {eof:true, pos}` (not an Error) when it would cross
   the end; nothing is read partially. There is no shared copy because M-11 depends on no
   other module and M-13 may not reference M-10; the three copies are identical text and
   each module's UT-NN-02 checks the EOF behavior.
2. Fatal versus recoverable. Fatal = the structure cannot be interpreted at all (bad magic,
   impossible header) or a limit is exceeded: throw `Error` with `.code` (`E-IMP-003`,
   `E-IMP-004`, `E-IMP-005`, `E-IMP-006`, `E-IMP-011`, `E-IMP-014`, `E-IMP-015`), `.message`
   (user-facing text from 6.14.5), `.offset` (byte position when known) and `.stage`
   (`'parse'`). Recoverable = anything after a valid header: keep what was parsed and add an
   `ImportWarning`. A parser never throws any other exception out of `parse`/`parseAsync`;
   an unexpected exception is caught at the top level, logged, and re-thrown as `E-IMP-003`
   with `.cause` set.
3. Limits are checked before allocation: declared counts (`ntrks`, ZIP entry count,
   measure and track counts, declared sizes) are compared with `LIMITS` before any array
   sized from them is created.
4. Text sanitizing (`decodeText`): try `new TextDecoder('utf-8', {fatal:true})`; on failure
   decode each byte as Latin-1 (bytes 0x80-0x9F through the 32-entry Windows-1252 table,
   unmapped positions dropped); remove code points < 0x20 except none (tabs and newlines
   become single spaces), remove 0x7F-0x9F, trim, collapse runs of spaces, truncate to the
   given maximum, and return `''` for empty. Imported text is only ever inserted with
   `textContent` (ADR-12).
5. Warnings are coalesced per (code, track): the first location is kept and `count` is
   incremented. Per song at most 500 warnings are kept, sorted by severity (`error`, `warn`,
   `info`) then tick; the rest increment `song.source.warningsDropped` (Part 5.1.1).
   File-level warnings (no track) are returned in `ParseResult.warnings` and merged by M-14.
6. Time slicing: `parseAsync` awaits `new Promise(r => setTimeout(r, 0))` every
   `yieldEvery` events (M-10, M-13) or every part (M-12) or every ZIP entry (M-11 via M-12),
   then checks `performance.now() > deadline` (E-IMP-005) and `isCancelled()` (E-IMP-011),
   then calls `onProgress`. `parse` runs the same code with yields disabled; both share one
   generator-style implementation (`function* parseGen(ctx)` that `yield`s at slice points;
   `parse` drives it with a loop, `parseAsync` with awaits) so the two cannot diverge.
7. Determinism: parsing the same bytes with the same options produces structurally identical
   results (ids excepted when `Model` assigns them from `uid()`; tests compare after
   stripping ids). No `Math.random`, no `Date` except `importedAt` set by M-14.
8. Numbers: all tick arithmetic is integer; durations and positions are accumulated as
   integers (M-12 and M-13 use the exact-fraction scheme in 6.12.4.4 and 6.13.4.6) and
   rounded exactly once at event creation.

6.10.4.2 `identify(bytes)`

```text
if len < 4 or bytes[0..3] != 'MThd' -> return null
if len < 14 -> return {format:'midi', version:'SMF (header incomplete)'}
hlen = u32be(4); format = u16be(8); ntrks = u16be(10); div = u16be(12)
if div & 0x8000: fps = -(int8(div >> 8)) (24,25,29,30; 29 -> 29.97), tpf = div & 0xFF
   version = 'SMF format ' + format + ', SMPTE ' + fpsLabel + ' fps x ' + tpf
else version = 'SMF format ' + format + ', ' + div + ' PPQ'
return {format:'midi', version, smfFormat:format, division, ntrks}
```

6.10.4.3 Header

```text
1. bytes[0..3] must be 'MThd' else E-IMP-003 "This file is not a Standard MIDI File (missing MThd header)."
   (RIFF 'RMID' wrappers are recognized by M-14 and refused there with E-IMP-006.)
2. hlen = u32be. hlen < 6 -> E-IMP-003 "MIDI header is too short." hlen > 6 -> read the 6
   fields, skip hlen - 6 bytes, warning W-MIDI-HEADER-LENGTH (info).
3. format = u16be; not in {0,1,2} -> E-IMP-003 "MIDI format {value} is not 0, 1 or 2."
4. ntrks = u16be; ntrks > LIMITS.maxTracks -> E-IMP-004 (before any allocation);
   ntrks == 0 -> W-MIDI-NO-TRACKS (warn), result is one empty Song.
5. division = u16be; bit 15 clear: ppq = division; ppq == 0 -> E-IMP-003 "PPQ is zero."
   bit 15 set: fpsByte = int8(division >> 8) in {-24,-25,-29,-30} else E-IMP-003
   "Unknown SMPTE frame rate."; tpf = division & 0xFF; tpf == 0 -> E-IMP-003.
   Record smf.division; SMPTE sets ctx.smpte = {fps: 29 -> 29.97, tpf} and warning
   W-MIDI-SMPTE (info) once.
6. ppq != 960 and 960 % ppq != 0 -> W-MIDI-TICK-ROUNDING (info; message states the
   maximum error of half a tick at PPQ 960).
```

6.10.4.4 Chunk loop

```text
mtrkCount = 0
while pos + 8 <= len:
  id = 4 bytes as ASCII; clen = u32be
  end = pos + clen
  if end > len: truncated = true; end = len; fileWarnings W-MIDI-TRUNCATED ('warn', message names the chunk and missing byte count)
  if id == 'MTrk':
    if mtrkCount == LIMITS.maxTracks: throw E-IMP-004
    parseTrack(mtrkCount, pos, end, truncated); mtrkCount++
  else:
    fileWarnings W-MIDI-UNKNOWN-CHUNK (info, once per id, message includes the id)
  pos = end
if pos < len (trailing bytes < 8): W-MIDI-TRAILING-BYTES (info)
if mtrkCount != ntrks: W-MIDI-TRACK-COUNT (info: "header declares {n} tracks, file contains {value}")
```

6.10.4.5 `parseTrack(index, start, end, truncatedChunk)`

```text
tick = 0 (source ticks, integer); running = null; order = 0; rt = new RawTrack(index)
loop while pos < end:
  try:
    {value: delta, overflow} = readVlq (reads at most 4 bytes; if the 4th byte has bit 7 set:
         overflow = true)
    if overflow: rt.warnings W-MIDI-BAD-VLQ ('warn'); abandon(rt, pos); break
    tick += delta; if rescaled(tick) > LIMITS.maxTick: throw E-IMP-004 ("song is longer than the supported maximum")
    T = rescaled(tick)        // PPQ or SMPTE rescale on the absolute tick
    b = peek()
    if b >= 0x80: status = u8(); if status < 0xF0: running = status
                  else if status == 0xF0 or status == 0xF7: running = null   // sysex cancels running status; meta (0xFF) does not (lenient, 6.10.9)
    else: if running == null: rt.warnings W-MIDI-BAD-STATUS ('warn'); abandon(rt, pos); break
          status = running; if rt.usedRunningAfterMeta: rt.warnings W-MIDI-RUNNING-STATUS-AFTER-META ('info') once
    ctx.events++ ; if ctx.events > LIMITS.maxEvents: throw E-IMP-004
    switch high nibble of status:
      0x80 noteOff: p = data(), v = data(); push raw {tick:T, type:'off', pitch:p, velocity:v, channel:ch, order:order++}
      0x90 noteOn:  p, v; push raw {type: v == 0 ? 'off' : 'on', ...}  (velocity-0 rule applied here AND in pairNotes; harmless twice)
      0xA0 polyAftertouch: 2 data bytes consumed; W-MIDI-IGNORED-EVENT ('info', once per message type, message names 'polyphonic aftertouch')
      0xB0 cc: c, v; push ccs {tick:T, controller:c, value:v, channel:ch}
      0xC0 program: pgm; push programs
      0xD0 channelPressure: 1 data byte; W-MIDI-IGNORED-EVENT once ('channel pressure')
      0xE0 bend: lsb, msb; value = ((msb << 7) | lsb) - 8192; push bends
      0xF0: switch status:
        0xFF meta: type = u8(); mlen = readVlq (overflow -> bad VLQ, abandon); if pos + mlen > end: W-MIDI-TRUNCATED, mlen = end - pos
             meta(type, bytes(mlen), T)
             if type == 0x2F: rt.eotTick = T; if pos < end: W-MIDI-DATA-AFTER-EOT ('info', counts bytes); pos = end
        0xF0 sysex, 0xF7 escape: slen = readVlq; skip min(slen, end - pos); W-MIDI-SYSEX-SKIPPED ('info', once)
        other 0xF1..0xF6, 0xF8..0xFE: W-MIDI-BAD-STATUS; abandon; break
    rt.maxTick = max(rt.maxTick, T); rt.channelsUsed.add(ch) for channel messages
    every yieldEvery events: yield point (6.10.4.1 item 6)
  catch EOF: rt.truncated = true; rt.warnings W-MIDI-TRUNCATED; break
data(): d = u8(); if d >= 0x80: W-MIDI-BAD-DATA ('warn'); the whole message is dropped
        (its remaining data bytes are still consumed); return -1 and the caller skips the push
abandon(rt, at): rt.abandonedAt = at; pos = end (the remainder of this chunk is skipped; events already parsed are kept)
after loop: if rt.eotTick == null and not rt.truncated and rt.abandonedAt == null: rt.warnings W-MIDI-NO-EOT ('info')
```

`meta(type, data, T)`:

| Type | Meaning | Action |
|---|---|---|
| 0x00 | sequence number | ignored silently |
| 0x01 | text | `texts.push({tick:T, type:'text', text:decodeText(data, 1000)})`; if the text starts with `Artist: ` at T == 0 in track 0 (or in the first track of format 0) it is also used for `song.artist` |
| 0x02 | copyright | `texts.push({type:'copyright'})` |
| 0x03 | sequence or track name | first occurrence -> `rt.name = decodeText(data, 128)`; later occurrences -> `texts.push({type:'trackName'})` |
| 0x04 | instrument name | first -> `rt.instrumentName`; later -> `texts.push({type:'instrumentName'})` |
| 0x05 | lyric | `texts.push({type:'lyric'})` |
| 0x06 | marker | `markers.push({tick:T, label:decodeText(data, 80) or 'Marker', kind:'section'})` |
| 0x07 | cue point | `markers.push({kind:'cue'})` |
| 0x08, 0x09 | program name, device name | treated as text type `'text'` |
| 0x20 | channel prefix | `rt.channelPrefix = data[0] & 0x0F` (hint only) |
| 0x21 | port | ignored silently |
| 0x2F | end of track | see loop |
| 0x51 | set tempo | `mlen != 3` -> W-MIDI-META-LENGTH ('warn', ignored); `us = 24-bit BE`; `us == 0` -> W-MIDI-TEMPO-ZERO ('warn', ignored); else `tempos.push({tick:T, usPerQuarter:us})` |
| 0x54 | SMPTE offset | ignored silently |
| 0x58 | time signature | `mlen < 2` -> W-MIDI-META-LENGTH; `nn = data[0]`, `dd = data[1]`; `nn == 0` or `nn > 32` -> W-MIDI-METER-RANGE ('warn', ignored); `dd > 6` -> clamp to 6 with W-MIDI-METER-RANGE; `meters.push({tick:T, numerator:nn, denominator:1 << dd})` |
| 0x59 | key signature | `mlen < 2` -> W-MIDI-META-LENGTH; `sf = int8(data[0])`, `mi = data[1]`; `sf` outside -7..7 or `mi` not 0 or 1 -> W-MIDI-KEY-RANGE ('warn', ignored); else `keys.push({tick:T, fifths:sf, mode: mi ? 'minor' : 'major'})` |
| 0x7F | sequencer specific | skipped, W-MIDI-SEQ-SPECIFIC ('info', once) |
| other | unknown meta | skipped, W-MIDI-UNKNOWN-META ('info', once per type) |

Tempo metas in a SMPTE-timed file are recorded but not used for timing; they are dropped
at materialization with W-MIDI-SMPTE-TEMPO-IGNORED ('info').

6.10.4.6 Rescaling

- PPQ: `rescale(t) = floor((t * 960 * 2 + ppq) / (2 * ppq))` on the absolute source tick.
  `t <= 2^31 - 1`, so `t * 1920 < 2^42` and the arithmetic is exact in doubles. Deltas are
  never rescaled; durations are differences of rescaled absolute ticks, so there is no
  cumulative rounding (UT-10-22 checks that the last tick equals the exact rescale of the
  last source tick).
- SMPTE: `seconds = t / (fps * tpf)` with fps 29.97 for the -29 code; `T = round(seconds *
  1920)` (120 BPM, 960 PPQ). The resulting TempoMap has the single default entry.

6.10.4.7 Materialization (RawTrack list -> Song list)

```text
A. Determine songs:
   format 2: one Song per RawTrack (track i -> song i): title = rt.name or '<fileName stem> - Sequence <i+1>';
             each song's maps come from its own RawTrack; fileWarnings W-MIDI-FORMAT2 ('warn':
             "MIDI format 2 contains {n} independent sequences; choose one to import").
   format 0 and 1: one Song.
B. Per song, build maps (last value at a tick wins, in file order across all contributing tracks):
   tempos:  merge all tempos sorted by (tick, trackIndex, order); if a later entry at the same tick differs -> W-MIDI-DUPLICATE-META ('info')
            none -> entries = default and W-MIDI-NO-TEMPO ('info'); SMPTE -> default always
            more than LIMITS.maxMapEntries -> keep the first 10,000, W-MIDI-MAP-TRUNCATED ('warn')
            song.tempoMap = new Model.TempoMap(entries)   // adds the implicit tick-0 entry with W-TEMPO-IMPLICIT-START when needed (6.3.3)
   meters:  same; none -> W-MIDI-NO-METER ('info'), default 4/4
   keys:    same; none -> W-MIDI-NO-KEY ('info'), KeyMap default C major
   markers: merge all; dedupe identical (tick, label, kind); sort by tick then label; cap LIMITS.maxMarkers with W-MIDI-MAP-TRUNCATED
C. Decide which RawTracks become Tracks:
   conductor rule: a RawTrack with no channel messages and no text/lyric/marker-bearing texts
     (texts.length == 0 after removing name/instrumentName) is folded: its name becomes
     song.title when it is index 0 (format 1) and the title is still unset; it is not materialized.
   text-only track (no channel messages, texts.length > 0): materialized as a Track with
     events = TextEvents only, channel = channelPrefix ?? 0, program 0, W-MIDI-TEXT-ONLY-TRACK ('info').
   channel track: channelsUsed.size == 1 -> one Track.
                  channelsUsed.size > 1 -> one Track per channel in ascending channel order,
                  names suffixed ' (ch N)' (N = channel + 1), W-MIDI-MULTI-CHANNEL ('info');
                  texts go with the lowest channel's Track. Format 0 files hit this rule by design.
D. Per output Track (channel c, from RawTrack rt):
   track = Model.Track.create({channel:c, isDrums: c == 9, name: ..., color by index})
   raw = rt.raw.filter(channel == c) sorted by (tick, type 'off' before 'on', order)
   {notes, warnings} = Model.pairNotes(raw, {trackEndTick: rt.eotTick ?? rt.maxTick, trackIndex})
   programs on c: first program with tick <= firstNoteTick (or the first at all when no notes) -> track.program;
                  that event is dropped; all other ProgramEvents are kept (B 15.2 multiple program changes)
                  none -> program 0, W-MIDI-NO-PROGRAM ('info', coalesced)
   bank select: CC 0 / CC 32 on c at tick 0 before the first program -> track.bankMsb / bankLsb, dropped; later ones kept as ControlEvents
   events = notes + ControlEvents(ccs) + ProgramEvents + PitchBendEvents(bends) + TextEvents(texts, only for the lowest channel track)
   Model.insertEvents(track, events)   // sorts by the Part 5.2 comparator
   name: rt.name (sanitized) else 'Track {N} ({programName})' with N = 1-based output index and
         programName = Theory.GM_PROGRAMS[track.program] or 'Drums'; duplicates are allowed (E 3.2)
   song.source.warnings += rt.warnings + pairing warnings (location.track = track.id)
   Song.addTrack(song, track) -> more than 32 tracks: see 6.14.4.6 (the Song keeps all parsed tracks
         in a temporary `song.x.overflowTracks` array beyond the 32nd; M-14 presents the selection)
E. song.title: set in C, else first rt.name of a materialized track when format 0, else fileName stem, else 'Untitled'.
   song.artist from the 'Artist: ' text rule; copyright text events stay as TextEvents.
   song.source = {format:'midi', fileName, version: identify().version, warnings, warningsDropped, fileSizeBytes: len, fileHash: '' (M-14 fills)}
   song.durationTicks = Song.computeDuration(song)   // EOT ticks beyond the last event are not preserved (6.10.9)
   song.ppq = 960
F. ParseResult.stats = {bytes:len, events, notes, tracks, ms, yields}; ParseResult.smf = {format, ntrks, division}
```

6.10.4.8 Writer (`write(song, options)`)

Implements Part 5.14.1 exactly; the byte-level procedure:

```text
tracks = song.tracks.filter(t => t.kind !== 'audio'); if tracks.length == 0: throw E-EXP-001 "There are no MIDI tracks to export."
audio skipped -> caller shows W-EXP-AUDIO-SKIPPED (Part 5.14.1 rule 4)
out = ByteBuilder()   // growable Uint8Array, doubling, u8/u16be/u32be/bytes
out.ascii('MThd'); u32be(6); u16be(1); u16be(1 + tracks.length); u16be(960)
conductor = []  // {tick, bytes}
 push meta(0, 0x03, utf8(song.title)); if artist: meta(0, 0x01, utf8('Artist: ' + artist))
 copyright TextEvent at tick 0 in any track -> meta(0, 0x02, text)
 tempo: options.tempoOverride ? [ {tick:0, us: round(60e6 / tempoOverride)} ] : song.tempoMap.entries -> meta 0x51 (3 bytes)
 meterMap.entries -> meta 0x58 [nn, log2(dd), 24, 8]; keyMap.entries -> meta 0x59 [int8(fifths), mode == 'minor' ? 1 : 0]
 markers -> meta 0x06 (section) / 0x07 (cue) with utf8(label)
 endTick = max(song.durationTicks, max over tracks of last Events.endTick)
 writeTrack(conductor, endTick)
for each track in song order:
  ch = track.isDrums ? 9 : track.channel; if !isDrums and ch == 9: ch = lowest channel in 0..15 except 9 unused by other non-drum tracks (W-EXP-CHANNEL-REMAPPED to caller)
  list = []
  push meta(0, 0x03, name); instrumentName TextEvent -> meta(0, 0x04)
  if bankMsb or bankLsb: cc(0, 0, bankMsb), cc(0, 32, bankLsb)
  unless the first ProgramEvent is at tick 0: program(0, track.program)
  for e in track.events (already sorted): note -> on at e.tick (0x90|ch, pitch, velocity), off at e.tick + durTicks (0x80|ch, pitch, offVelocity ?? 64)
       cc -> (0xB0|ch, controller, value); program -> (0xC0|ch, program); bend -> (0xE0|ch, (v+8192) & 0x7F, (v+8192) >> 7)
       text -> meta by type: text/other 0x01, copyright 0x02, trackName 0x03 (skipped at tick 0 when equal to track.name), instrumentName 0x04, lyric 0x05, marker 0x06, cue 0x07
  stable sort list by (tick, class: off=0, meta=1, cc/program/bend=2, on=3, original index)
  writeTrack(list, trackEnd = max(last tick in list, song.durationTicks))
writeTrack(list, endTick):
  body = ByteBuilder(); last = 0; running = null
  for item: delta = item.tick - last; if delta > 0x0FFFFFFF: throw E-EXP-002 "A MIDI delta time exceeds the maximum encodable value."
            body.bytes(writeVlq(delta)); last = item.tick
            if meta: body.u8(0xFF); u8(type); bytes(writeVlq(data.length)); bytes(data); running = null
            else: if status != running: body.u8(status); running = status   // running status for same status byte
                  body.bytes(data)
  body.bytes(writeVlq(max(0, endTick - last))); body.bytes([0xFF, 0x2F, 0x00])
  out.ascii('MTrk'); out.u32be(body.length); out.bytes(body)
return out.toUint8Array()
```

`writeVlq(v)`: `v` in 0..0x0FFFFFFF; emit 7-bit groups most significant first with bit 7
set on all but the last; `0 -> [0x00]`.

6.10.4.9 Warning catalog (`FLM.Midi.WARNINGS`)

| Code | Severity | Message (user-facing, placeholders in braces) |
|---|---|---|
| W-MIDI-HEADER-LENGTH | info | MIDI header is {n} bytes long; the extra bytes were skipped. |
| W-MIDI-NO-TRACKS | warn | The MIDI header declares no tracks; the file is empty. |
| W-MIDI-TRACK-COUNT | info | The header declares {n} tracks but the file contains {value}. |
| W-MIDI-UNKNOWN-CHUNK | info | Unknown chunk "{name}" was skipped. |
| W-MIDI-TRAILING-BYTES | info | {n} bytes after the last chunk were ignored. |
| W-MIDI-TRUNCATED | warn | The file ends early ({n} bytes missing); events read before the cut were kept. |
| W-MIDI-BAD-VLQ | warn | A delta time is longer than 4 bytes; the rest of track {n} was skipped. |
| W-MIDI-BAD-STATUS | warn | Invalid status byte 0x{value} at offset {n}; the rest of this track was skipped. |
| W-MIDI-BAD-DATA | warn | {n} events with out-of-range data bytes were dropped. |
| W-MIDI-RUNNING-STATUS-AFTER-META | info | Running status continued across a meta event (accepted). |
| W-MIDI-IGNORED-EVENT | info | {name} messages are not used ({n} ignored). |
| W-MIDI-SYSEX-SKIPPED | info | System exclusive data was skipped ({n} messages). |
| W-MIDI-SEQ-SPECIFIC | info | Sequencer-specific meta events were skipped ({n}). |
| W-MIDI-UNKNOWN-META | info | Unknown meta event type 0x{value} was skipped ({n}). |
| W-MIDI-META-LENGTH | warn | A {name} meta event has an invalid length and was ignored. |
| W-MIDI-DATA-AFTER-EOT | info | {n} bytes after End of Track in track {value} were ignored. |
| W-MIDI-NO-EOT | info | Track {n} has no End of Track event; its end is the last event. |
| W-MIDI-TEMPO-ZERO | warn | A tempo of 0 was ignored. |
| W-MIDI-METER-RANGE | warn | A time signature value was out of range and was adjusted or ignored. |
| W-MIDI-KEY-RANGE | warn | A key signature value was out of range and was ignored. |
| W-MIDI-DUPLICATE-META | info | Conflicting {name} values at the same position; the last one was used. |
| W-MIDI-MAP-TRUNCATED | warn | More than {n} {name} entries; only the first {n} were kept. |
| W-MIDI-NO-TEMPO | info | No tempo in the file; 120 BPM is used. |
| W-MIDI-NO-METER | info | No time signature in the file; 4/4 is used. |
| W-MIDI-NO-KEY | info | No key signature in the file; C major is assumed for note spelling. |
| W-MIDI-NO-PROGRAM | info | {n} tracks have no program change; Acoustic Grand Piano is used. |
| W-MIDI-SMPTE | info | Timing was converted from SMPTE frames at 120 BPM; bar lines may not align with the music. |
| W-MIDI-SMPTE-TEMPO-IGNORED | info | Tempo events in a SMPTE-timed file do not affect timing and were ignored. |
| W-MIDI-TICK-ROUNDING | info | Source resolution {value} PPQ was rounded to 960 PPQ (maximum error half a tick). |
| W-MIDI-FORMAT2 | warn | MIDI format 2 contains {n} independent sequences; choose one to import. |
| W-MIDI-MULTI-CHANNEL | info | Track "{name}" uses {n} MIDI channels and was split into one track per channel. |
| W-MIDI-TEXT-ONLY-TRACK | info | Track "{name}" contains only text or lyrics. |

Model warnings that surface through M-10 (defined in 6.3): `W-NOTE-UNMATCHED`,
`W-NOTE-OFF-WITHOUT-ON`, `W-NOTE-OVERLAP`, `W-NOTE-ZERO-DURATION`, `W-NOTE-PITCH-RANGE`,
`W-NOTE-VELOCITY-CLAMP`, `W-TEMPO-IMPLICIT-START`.

#### 6.10.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Not an SMF or impossible header | magic, hlen, format, ppq checks (6.10.4.3) | nothing parsed; caller's project untouched | user picks another file | none | SCR-ImportInspect error state with E-IMP-003 text | n/a | import aborted | UT-10-03, 04, 05 |
| Declared track count or event count over limits | pre-allocation checks | nothing or partial parse discarded | no | none | E-IMP-004 text | n/a | import aborted | UT-10-31 |
| File truncated inside a chunk | `end > len`, EOF sentinel | all events before the cut | no | none | W-MIDI-TRUNCATED on the inspection warnings list | song imports with a warning | n/a | UT-10-15 |
| Bad VLQ or status byte | overflow, data byte without running status | events before the point | no | none | W-MIDI-BAD-VLQ or W-MIDI-BAD-STATUS | rest of that track skipped | n/a | UT-10-07, 11 |
| Missing EOT | end of chunk without 0x2F | all events | no | none | W-MIDI-NO-EOT | none | n/a | UT-10-16 |
| Unmatched or inverted note on and off | `pairNotes` | notes closed at track end or dropped | no | none | W-NOTE-* warnings | none | n/a | UT-10-14 |
| Format 2 file | header | N songs | user chooses | none | W-MIDI-FORMAT2 plus a sequence chooser (M-14, Part 7) | one sequence at a time | n/a | UT-10-21 |
| SMPTE division | header bit 15 | timing exact in seconds | no | none | W-MIDI-SMPTE | bars may misalign | n/a | UT-10-23 |
| Parse exceeds 5 s budget | deadline at yield | partial parse discarded | user may retry on a faster device | none | E-IMP-005 text | n/a | import aborted | UT-10-32 |
| Writer delta overflow | `delta > 0x0FFFFFFF` | song untouched | no | none | E-EXP-002 (export dialog) | n/a | export aborted | UT-10-36 |
| Writer with no MIDI tracks | filter empty | song untouched | no | none | E-EXP-001 | n/a | export aborted | UT-10-36 |

#### 6.10.6 Limits and performance notes

- Throughput target: 1,000,000 events parsed in <= 4 s on the desktop reference (PT scenario
  in Part 9.7), leaving 1 s of the budget for M-14 normalize and inspect. Yield cost is
  bounded: at most 50 yields for a maximal file.
- Memory: `RawNote` objects cost about 56 bytes each in V8; a 1,000,000-event file peaks at
  about 60 MB of raw records plus the input bytes (<= 25 MB), released when `parse` returns.
  The `Uint8Array` passed in is never copied (`subarray` only).
- `pairNotes` is called once per output Track with that track's raw list; the per-track sort
  is O(n log n) and dominated by the file read.
- Text decoding uses one `TextDecoder` instance per parse.

#### 6.10.7 Spec coverage

B 15.1 (steps 3-6), B 15.2 (all bullets: formats 0 and 1, track events, delta times, tempo
maps, time and key signatures, program changes, note on and off, velocity, controllers, pitch
bend, sustain pedal as CC 64 events, track names and metadata, percussion channel 10,
simultaneous notes, running status, VLQ, end of track, malformed and truncated files), B 15.6
(MIDI export), B 15.7 (source metadata, import warnings), B 23.1 (lengths, offsets, counts),
B 25.1 (MIDI parsing unit tests), B 25.3 corpus cases, B 26.3; E 3.1 (every listed structural
case), E 3.2 (tempo default, multiple tempo and meter and key changes, multiple program
changes, percussion channel, bend and modulation as events, sustain pedal kept as CC 64,
unusual velocities, missing or duplicated track names, final event after the last note), E 10
items 3 and 11, E 13 (valid supported MIDI files lose no events: nothing is dropped except
explicitly warned malformed bytes); I 6.4, 16.2, 16.3, 17 (MIDI parsing gate); P 11 (tempo
maps respected, multitrack retained, polyphony retained, program and percussion preserved,
unsupported events warned, large files within limits), P 16 (repeated save and load preserve
the same supported content: writer round trip).

#### 6.10.8 Unit tests

Fixtures are built in `src/91-test-midi.js` by a tiny builder `smf` (not the game's writer,
so that the tests exercise the reader and the writer independently): `smf.file({format, ntrks, division,
tracks:[bytes...]})`, `smf.track(items)` where items are `[delta, ...bytes]` arrays and
`smf.meta(type, data)`, `smf.vlq(v)`. `song()` returns the single Song of a result; `ids(x)`
strips `id` fields for deep comparison. Group name `midi`.

| UT | Name | Setup | Assertion |
|---|---|---|---|
| UT-10-01 | identify header | valid 14-byte header format 1, 480 PPQ, 2 tracks | `{format:'midi', smfFormat:1, ntrks:2, division:{ppq:480}}`, version `'SMF format 1, 480 PPQ'`; 10-byte input -> version `'SMF (header incomplete)'`; `'RIFF'` -> null |
| UT-10-02 | reader EOF sentinel | Reader over 3 bytes; `u32be()` | throws object with `eof:true`, `pos:0`; `pos` unchanged |
| UT-10-03 | bad magic | bytes `'MThX'...` | throws `.code === 'E-IMP-003'`, message contains `'Standard MIDI File'` |
| UT-10-04 | header length | hlen 10 with 4 extra bytes then a track | parses; warning W-MIDI-HEADER-LENGTH; hlen 4 -> E-IMP-003 |
| UT-10-05 | format 3 | header format 3 | E-IMP-003 message contains `'format 3'`; division 0 -> E-IMP-003 `'PPQ is zero'` |
| UT-10-06 | VLQ decode vectors | `[0x00]`, `[0x7F]`, `[0x81,0x00]`, `[0xFF,0x7F]`, `[0xFF,0xFF,0xFF,0x7F]` | 0, 127, 128, 16383, 0x0FFFFFFF; `bytesRead` 1,1,2,2,4; `overflow` false |
| UT-10-07 | VLQ overflow | track with delta `[0xFF,0xFF,0xFF,0xFF,0x7F]` after one note | one note kept; W-MIDI-BAD-VLQ; later events absent |
| UT-10-08 | writeVlq round trip | every value in {0, 1, 127, 128, 16383, 16384, 2097151, 2097152, 0x0FFFFFFF} | `readVlq(writeVlq(v))` equals v; lengths 1,1,1,2,2,3,3,4,4 |
| UT-10-09 | running status | `0x90 60 100` then `[delta, 64, 100]`, `[delta, 67, 100]`, then offs | three notes with pitches 60, 64, 67 |
| UT-10-10 | running status across meta | note on, meta text, data bytes without status | event parsed; W-MIDI-RUNNING-STATUS-AFTER-META info once |
| UT-10-11 | data byte without running status | track starts with `[0, 0x3C, 0x64]` after a note-free meta | W-MIDI-BAD-STATUS; events before kept; track abandoned (no later events) |
| UT-10-12 | pairing basic | on at 0, off at 480 (PPQ 480) | one NoteEvent tick 0, durTicks 960, velocity 100, offVelocity 64 |
| UT-10-13 | velocity-0 note on | on v100 at 0, on v0 at 240 | one note durTicks 480 (rescaled), offVelocity 0 |
| UT-10-14 | unmatched on | on at 0, EOT at 1920 (PPQ 960) | note durTicks 1920; warning W-NOTE-UNMATCHED with location track id |
| UT-10-15 | truncated chunk | MTrk length 1000 but file ends after 3 events | 3 events kept; W-MIDI-TRUNCATED severity warn; `stats.tracks` 1 |
| UT-10-16 | missing EOT | track without 0x2F | events kept; W-MIDI-NO-EOT info |
| UT-10-17 | data after EOT | EOT followed by 5 bytes inside the chunk | W-MIDI-DATA-AFTER-EOT with n 5; next chunk parsed normally |
| UT-10-18 | unknown chunk | `'XFIH'` chunk between header and MTrk | skipped; W-MIDI-UNKNOWN-CHUNK info once; track parsed |
| UT-10-19 | format 0 channel split | one track with notes on ch 0 and ch 9 | two Tracks; second `isDrums` true, `channel` 9; W-MIDI-MULTI-CHANNEL |
| UT-10-20 | conductor folding | format 1: track 0 has name, tempo 0x51, meter, key only; track 1 notes | one Track; `song.title` = track 0 name; tempoMap 2 entries; meterMap 3/4; keyMap fifths -3 minor |
| UT-10-21 | format 2 | 3 tracks with notes | `songs.length` 3; W-MIDI-FORMAT2 n 3; titles from track names |
| UT-10-22 | rescale exactness | PPQ 480: ticks 1, 3, 1001 -> 2, 6, 2002; PPQ 384 note at 1, 3 | W-MIDI-TICK-ROUNDING present for 384 only; `rescale(1,384)` 3 (2.5 rounds half up), `rescale(3,384)` 8; last tick of a 10,000-event track equals `rescale(lastSourceTick)` |
| UT-10-23 | SMPTE | division 0xE728 (25 fps, 40 tpf): note at 1000 frames-ticks | `rescaleSmpte(1000, 25, 40)` = round(1.0 s * 1920) = 1920; tempoMap default; W-MIDI-SMPTE; tempo meta -> W-MIDI-SMPTE-TEMPO-IGNORED |
| UT-10-24 | tempo merge | tempos at 0 (500000), 960 (400000) in track 0 and 960 (300000) in track 2; a 0x51 with 0 | entries [500000, 300000]; W-MIDI-DUPLICATE-META; W-MIDI-TEMPO-ZERO |
| UT-10-25 | defaults | file with notes only | W-MIDI-NO-TEMPO, W-MIDI-NO-METER, W-MIDI-NO-KEY, W-MIDI-NO-PROGRAM all info; tempoMap 120 BPM; meter 4/4 |
| UT-10-26 | meter denominator | 0x58 data [3,3,24,8] and [4,7,24,8] | 3/8; second clamped to /64 with W-MIDI-METER-RANGE |
| UT-10-27 | key range | 0x59 data [9, 0] | ignored with W-MIDI-KEY-RANGE; keyMap stays default |
| UT-10-28 | name fallback | unnamed track, program 33 | name `'Track 1 (Electric Bass (finger))'`; drum track -> `'Track 2 (Drums)'` |
| UT-10-29 | multi-channel split names | named `'Combo'` track using ch 0 and 1 | names `'Combo (ch 1)'`, `'Combo (ch 2)'`; texts only on the first |
| UT-10-30 | bank select folding | CC0 1, CC32 2, program 5 at tick 0; CC0 3 at tick 960 | `bankMsb` 1, `bankLsb` 2, `program` 5; one ControlEvent (controller 0, value 3, tick 960); no ProgramEvent at 0 |
| UT-10-31 | limits | header ntrks 200; a track with 1,000,001 note-on messages via running status | E-IMP-004 in both cases; the second throws before `pairNotes` |
| UT-10-32 | time budget | `parseAsync(bytes50k, {budgetMs:0})` | rejects `.code === 'E-IMP-005'` |
| UT-10-33 | parseAsync equals parse | 45,000-event file | `onProgress` called >= 2 times with increasing `events`; `ids(async)` deep equals `ids(sync)`; `stats.yields` 2 |
| UT-10-34 | writer round trip | Song with 2 tracks (ch 0 program 4, drums), tempo 2 entries, meter 6/8 at bar 3, key -2 major, 2 markers, CCs 7/10/64, bends, text and lyric events, artist | `write` then `parse`: notes, ccs, bends, programs, tempoMap, meterMap, keyMap, markers, title, artist equal (ids stripped); track order kept; `isDrums` true on channel 9 |
| UT-10-35 | writer ordering and running status | one track: two notes ending and starting at tick 960 | bytes show note-offs before note-ons at 960; second consecutive note-on has no status byte; EOT at `durationTicks` |
| UT-10-36 | writer errors | song with only an audio track; song with a marker at tick 2^30 | E-EXP-001; E-EXP-002 |
| UT-10-37 | text decoding | name bytes valid UTF-8 `'Caf\xC3\xA9'`, invalid `[0xE9]`, control chars, 200-char name | `'Caf' + String.fromCharCode(0xE9)`; `String.fromCharCode(0xE9)` (Latin-1 path); controls removed; length 128 |
| UT-10-38 | markers | 0x06 `'Verse'` at 0 in track 0 and track 1; 0x07 `'Hit'` | `song.markers` two entries: section `'Verse'` once, cue `'Hit'`; no TextEvent of type marker |
| UT-10-39 | ignored messages | sysex, poly aftertouch x3, channel pressure | W-MIDI-SYSEX-SKIPPED once; W-MIDI-IGNORED-EVENT with n 3 for aftertouch; notes intact |
| UT-10-40 | lyrics and texts | 0x05 syllables, 0x01 `'Artist: Band'` at 0 | TextEvents type lyric in the track; `song.artist` `'Band'`; a text event `'Artist: Band'` also kept |

#### 6.10.9 Implementation notes and browser quirks

- Lenient running status: the SMF 1.0 text says meta and sysex events cancel running status;
  many real files rely on running status surviving meta events, so M-10 cancels only on
  0xF0/0xF7 and records W-MIDI-RUNNING-STATUS-AFTER-META when the leniency was used. This
  preserves data (E 3.1) and the warning keeps the matrix honest.
- End of Track beyond the last event is not preserved as `durationTicks` (Part 5.1.1 defines
  `durationTicks` from events and markers); the writer emits EOT at the computed end, so a
  file with trailing silence re-exports without it (documented in the round-trip table).
- `DataView` is not used; the Reader builds integers from `Uint8Array` bytes so the same code
  path serves all three binary modules and avoids per-read `DataView` allocation.
- `TextDecoder` with `fatal:true` is available in all five target browsers; Safari lacks
  some legacy labels, so only `'utf-8'` is requested and Latin-1 is decoded by hand.
- Large files: `Uint8Array.subarray` for chunk views, never `slice`; `String.fromCharCode`
  is called per byte in the Latin-1 path and never with `apply` on big arrays (stack limits).
- `performance.now()` is used for the budget; it is monotonic in all target browsers, unlike
  `Date.now()`.
- Format 0 files that use a single channel produce one Track; files whose only tempo is in
  a channel track still get a correct map because maps are merged from all tracks.

### 6.11 M-11 Zip (`src/11-zip.js`, `FLM.Zip`)

#### 6.11.1 Responsibilities and non-goals

M-11 reads ZIP archives from memory: end-of-central-directory discovery, central directory
and local headers, extraction of entries stored (method 0) or deflated (method 8) with an
own RFC 1951 inflate, CRC-32 verification, and the archive limits that defend against ZIP
bombs. It exists for `.mxl` (M-12) and for identifying GP7 containers (M-14). Non-goals: no
writing, no encryption, no ZIP64, no multi-disk archives, no streaming (whole archive in
memory, which the 25 MB file limit makes acceptable), no file-system paths.

Spec grounding: B 15.3 (compressed MusicXML), B 23.1 (excessively large files), E 3.3
(compressed MusicXML imported), E 9 (no external dependency for unzip).

#### 6.11.2 Public API

```js
FLM.Zip = {
  LIMITS: {
    maxEntries: 256,                     // central directory entries; E-IMP-004
    maxUncompressedTotal: 50 * 1024 * 1024, // sum over entries; E-IMP-004
    maxUncompressedEntry: 50 * 1024 * 1024,
    maxRatio: 100,                       // uncompressed / compressed per entry (compressed > 0); E-IMP-004
    maxNameBytes: 512,                   // longer names truncated after decoding
    maxCommentBytes: 65535
  },
  /** Parses the central directory. Does not inflate anything. Throws E-IMP-003 (not a ZIP,
   *  inconsistent directory), E-IMP-004 (limits), E-IMP-006 (ZIP64, encryption). */
  read(bytes /* Uint8Array */) /* -> ZipArchive */,
  entries(archive) /* -> ZipEntry[] in central-directory order */,
  /** Extracts and verifies one entry. entryOrName: ZipEntry or exact name. Throws E-IMP-003 on
   *  CRC or size mismatch or bad local header, E-IMP-006 on an unsupported method. */
  extract(archive, entryOrName) /* -> Uint8Array */,
  /** Raw deflate (RFC 1951) decoder. expectedSize preallocates and caps the output; when
   *  omitted the cap is LIMITS.maxUncompressedEntry. Throws E-IMP-003 on stream errors,
   *  E-IMP-004 when output exceeds the cap. */
  inflate(input /* Uint8Array */, expectedSize /* ?int */) /* -> Uint8Array */,
  /** Standard CRC-32 (polynomial 0xEDB88320, reflected), unsigned result. `seed` is a
   *  previous result for incremental use. */
  crc32(bytes /* Uint8Array */, seed /* ?int = 0 */) /* -> int (unsigned 32-bit) */
};
// ZipArchive { bytes, entries:[ZipEntry], byName:Map<string, ZipEntry>, comment:string, eocdOffset:int, totalUncompressed:int }
// ZipEntry { name, method:0|8|other, flags, compressedSize, uncompressedSize, crc32, localHeaderOffset, isDirectory, supported:boolean, index }
```

Events: none emitted, none consumed. Depends on nothing but `FLM.Core`.

#### 6.11.3 Internal state

Stateless; the CRC table (256 `Uint32Array` entries) and the inflate constant tables are
built once at module load:

```text
LENGTH_BASE  (codes 257..285) = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258]
LENGTH_EXTRA                 = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0]
DIST_BASE    (codes 0..29)   = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577]
DIST_EXTRA                   = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13]
CL_ORDER (code length code order) = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]
FIXED_LIT lengths: 0..143 -> 8, 144..255 -> 9, 256..279 -> 7, 280..287 -> 8 ; FIXED_DIST: 0..29 -> 5
```

A `Huffman` table is `{count:Uint16Array(16), symbol:Uint16Array(n)}` (canonical, puff
style). An inflate call owns `{input, inPos, bitBuf, bitCount, out, outPos, cap}`.

#### 6.11.4 Algorithms

6.11.4.1 EOCD search

```text
if len < 22: E-IMP-003 "Not a ZIP archive."
for p from len - 22 down to max(0, len - 22 - 65535):
  if u32le(p) == 0x06054B50:
    commentLen = u16le(p + 20)
    if p + 22 + commentLen == len: eocd = p; break        // comment length must close the file exactly
    (otherwise keep searching: the signature occurred inside a comment or data)
none found -> E-IMP-003 "Not a ZIP archive (no end-of-central-directory record)."
disk fields: u16le(eocd+4) != 0 or u16le(eocd+6) != 0 -> E-IMP-006 "Multi-disk ZIP archives are not supported."
total = u16le(eocd + 10); cdSize = u32le(eocd + 12); cdOffset = u32le(eocd + 16)
if total == 0xFFFF or cdSize == 0xFFFFFFFF or cdOffset == 0xFFFFFFFF or u32le(eocd - 20) == 0x07064B50 (ZIP64 locator): E-IMP-006 "ZIP64 archives are not supported."
if total > LIMITS.maxEntries: E-IMP-004 (before allocating)
if cdOffset + cdSize > eocd: E-IMP-003 "ZIP central directory is out of bounds."
comment = decodeText(bytes[eocd+22 .. len], 256)
```

6.11.4.2 Central directory

```text
p = cdOffset; sum = 0
for i in 0..total-1:
  u32le(p) != 0x02014B50 -> E-IMP-003 "ZIP central directory entry {i} is corrupt."
  flags = u16le(p+8); method = u16le(p+10); crc = u32le(p+16); csize = u32le(p+20); usize = u32le(p+24)
  nlen = u16le(p+28); elen = u16le(p+30); clen = u16le(p+32); lho = u32le(p+42)
  p + 46 + nlen + elen + clen > cdOffset + cdSize -> E-IMP-003
  flags & 0x0001 -> E-IMP-006 "Encrypted ZIP archives are not supported."
  nameBytes = bytes[p+46 .. p+46+nlen]; name = (flags & 0x0800) ? utf8(nameBytes) : latin1(nameBytes) (through decodeText without the
         control-character pass applied to '/'), backslashes -> '/', leading '/' removed, any '..' segment -> name prefixed 'invalid/' and supported=false
  isDirectory = name.endsWith('/') or (usize == 0 and csize == 0 and name ends with '/')
  supported = method == 0 or method == 8
  usize > LIMITS.maxUncompressedEntry -> E-IMP-004 "An entry in the archive is larger than 50 MB."
  csize > 0 and usize / csize > LIMITS.maxRatio -> E-IMP-004 "The archive has a suspicious compression ratio and was rejected."
  csize == 0 and usize > 0 and method == 8 -> E-IMP-003 (impossible)
  lho + 30 > cdOffset -> E-IMP-003 "Local header offset is out of bounds."
  sum += usize; sum > LIMITS.maxUncompressedTotal -> E-IMP-004 "The archive expands to more than 50 MB."
  push ZipEntry; byName.set(name, entry) (first wins on duplicates; later duplicates get supported=false)
  p += 46 + nlen + elen + clen
```

6.11.4.3 `extract(archive, entryOrName)`

```text
entry = resolve; missing -> E-IMP-003 "Entry {name} not found in the archive."
!entry.supported -> E-IMP-006 "ZIP compression method {method} is not supported." (or the invalid-name text)
p = entry.localHeaderOffset; u32le(p) != 0x04034B50 -> E-IMP-003 "Local file header for {name} is corrupt."
nlen = u16le(p+26); elen = u16le(p+28)        // local lengths may differ from the central ones: use the local ones
dataStart = p + 30 + nlen + elen; dataStart + entry.compressedSize > archive.bytes.length -> E-IMP-003 "{name} is truncated."
data = bytes.subarray(dataStart, dataStart + csize)
out = method == 0 ? data (copied with slice so the caller owns it) : inflate(data, entry.uncompressedSize)
out.length != entry.uncompressedSize -> E-IMP-003 "{name} has an unexpected size after decompression."
crc32(out) != entry.crc32 -> E-IMP-003 "{name} failed its CRC check (the archive is damaged)."
return out
```

Sizes in the central directory are authoritative even when flag bit 3 (data descriptor) is
set, so data descriptors are never read.

6.11.4.4 `inflate(input, expectedSize)` (RFC 1951)

```text
cap = expectedSize ?? LIMITS.maxUncompressedEntry
out = new Uint8Array(expectedSize ?? min(cap, max(1024, input.length * 4)))   // grows by doubling up to cap
bits(n): while bitCount < n: if inPos >= input.length: E-IMP-003 "Compressed data ends early."
                              bitBuf |= input[inPos++] << bitCount; bitCount += 8
         v = bitBuf & ((1 << n) - 1); bitBuf >>>= n; bitCount -= n; return v     // LSB-first; n <= 13 keeps bitBuf in 32-bit range (max 13 + 7 pending)
do:
  final = bits(1); type = bits(2)
  type == 0 (stored): drop bitCount % 8 bits; LEN = u16le from the next 2 input bytes, NLEN the next 2;
                      LEN != (~NLEN & 0xFFFF) -> E-IMP-003 "Stored block length check failed."
                      copy LEN bytes (bounds checked on input and cap)
  type == 1: lit = FIXED_LIT table, dist = FIXED_DIST table; codes()
  type == 2: HLIT = bits(5) + 257; HDIST = bits(5) + 1; HCLEN = bits(4) + 4
             HLIT > 286 or HDIST > 30 -> E-IMP-003
             clLengths[CL_ORDER[i]] = bits(3) for i < HCLEN, others 0; clTable = build(clLengths)
             read HLIT + HDIST lengths: sym = decode(clTable); sym < 16 -> length sym;
               16 -> repeat previous length 3 + bits(2) times (no previous -> E-IMP-003);
               17 -> zero length 3 + bits(3) times; 18 -> zero length 11 + bits(7) times; overrun -> E-IMP-003
             lengths[256] == 0 -> E-IMP-003 "Block has no end-of-block code."
             lit = build(lengths[0..HLIT)); dist = build(lengths[HLIT..HLIT+HDIST)); codes()
  type == 3: E-IMP-003 "Invalid deflate block type."
while !final
return out.subarray(0, outPos) (copied to an exact-size array)

build(lengths): count[len]++ for each symbol; count[0] = 0; check over-subscription: left = 1; for len 1..15: left <<= 1; left -= count[len]; left < 0 -> E-IMP-003 "Over-subscribed Huffman code."
                offs[1] = 0; offs[len+1] = offs[len] + count[len]; symbol[offs[lengths[s]]++] = s for each s with lengths[s] != 0
decode(table): code = first = index = 0; for len 1..15: code |= bits(1); count = table.count[len];
                if code - count < first: return table.symbol[index + (code - first)]
                index += count; first += count; first <<= 1; code <<= 1
               -> E-IMP-003 "Invalid Huffman code."
codes(): loop: sym = decode(lit)
           sym < 256: put(sym)
           sym == 256: return
           sym > 285: E-IMP-003
           len = LENGTH_BASE[sym-257] + bits(LENGTH_EXTRA[sym-257]); dsym = decode(dist); dsym > 29 -> E-IMP-003
           d = DIST_BASE[dsym] + bits(DIST_EXTRA[dsym]); d > outPos -> E-IMP-003 "Distance too far back."
           copy len bytes from outPos - d (byte by byte; overlapping copies are intended)
put(b): if outPos == out.length: if out.length >= cap: E-IMP-004 "Decompressed data exceeds the allowed size." else grow(min(cap, out.length * 2))
```

`bits(n)` is called with n <= 13 (HCLEN repeat 7, distance extra 13), and the bit buffer
is refilled byte by byte, so `bitBuf` never exceeds 20 significant bits and stays a
non-negative 32-bit integer.

6.11.4.5 `crc32(bytes, seed)`

```text
table[i] = c where c = i; repeat 8 times: c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
crc = (seed ^ 0xFFFFFFFF) >>> 0 ; for b: crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8)
return (crc ^ 0xFFFFFFFF) >>> 0
```
Incremental: `crc32(part2, crc32(part1))` equals `crc32(part1 + part2)` (UT-11-02).

#### 6.11.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Not a ZIP (no EOCD) | backward search fails | nothing | user picks another file | none | E-IMP-003 text | n/a | import aborted | UT-11-11 |
| ZIP64, encrypted, multi-disk | flags and markers | nothing | no | none | E-IMP-006 text naming the feature | n/a | aborted | UT-11-17, 20 |
| Too many entries, too large, bomb ratio | pre-allocation checks on declared values | nothing | no | none | E-IMP-004 text | n/a | aborted | UT-11-12, 13, 14 |
| Corrupt local header or truncated data | signature and bounds | archive directory still readable | user may extract another entry | none | E-IMP-003 text with the entry name | other entries | aborted for that entry | UT-11-19 |
| Deflate stream error | inflate checks | nothing from that entry | no | none | E-IMP-003 text | n/a | aborted | UT-11-07, 08 |
| CRC mismatch | post-inflate | the bytes are discarded | no | none | E-IMP-003 "failed its CRC check" | n/a | aborted | UT-11-15 |
| Output exceeds cap | `put` | partial output discarded | no | none | E-IMP-004 text | n/a | aborted | UT-11-09 |

#### 6.11.6 Limits and performance notes

- Inflate throughput target >= 10 MB/s of output on the desktop reference (bit-by-bit
  canonical decoding; adequate for a 50 MB cap within the 5 s budget only for realistic
  `.mxl` files, which are under 5 MB uncompressed; M-12 checks the deadline after each entry).
- Memory: output preallocated to `uncompressedSize` from the directory, so no doubling for
  well-formed archives; the input is a `subarray` view.
- Directory parsing is O(entries); `byName` lookups are O(1).

#### 6.11.7 Spec coverage

B 15.3 (compressed MusicXML container support explicitly defined), B 23.1 (defend
against malformed or excessively large files that would freeze the browser or consume
excessive memory), B 19.5 (no dependency for a small reliable native implementation), E 3.3
(compressed MusicXML), E 9 (dependency unavailable: none needed), E 10 item 10, I 14.2, P 11
(large files handled within documented limits), P 18 (required code embedded).

#### 6.11.8 Unit tests

`src/91-test-zip.js`, group `zip`. The test file contains a stored-only ZIP writer `zipw`
(local headers, central directory, EOCD, CRC via `FLM.Zip.crc32`) and three embedded raw
deflate fixtures as base64 strings, generated once with
`node -e "const z=require('zlib');console.log(z.deflateRawSync(Buffer.from(S)).toString('base64'))"`
for `S` = `'abc'` (expected bytes `4b 4c 4a 06 00`), `S` = `'a'.repeat(64)` (fixed block
with a match), and `S` = the 1,000-character string formed by repeating
`'The quick brown fox jumps over the lazy dog 0123456789 '` with a running counter appended
to each repetition until length 1,000 (dynamic block; the test asserts the first byte's BTYPE
bits equal 2).

| UT | Name | Setup | Assertion |
|---|---|---|---|
| UT-11-01 | crc32 vectors | `''`, `'a'`, `'123456789'` | 0x00000000, 0xE8B7BE43, 0xCBF43926 (unsigned) |
| UT-11-02 | crc32 incremental | `'12345'` then `'6789'` with seed | equals `crc32('123456789')` |
| UT-11-03 | inflate stored | hand-built block `01 05 00 FA FF 'hello'` | `'hello'`; LEN/NLEN mismatch -> E-IMP-003 |
| UT-11-04 | inflate fixed abc | bytes `4b 4c 4a 06 00` | `'abc'` |
| UT-11-05 | inflate fixed with match | 64 x `'a'` fixture | output equals; BTYPE 1 |
| UT-11-06 | inflate dynamic | 1,000-char fixture | output equals; BTYPE 2 |
| UT-11-07 | inflate bad block type | first byte with BTYPE 3 | E-IMP-003 "Invalid deflate block type." |
| UT-11-08 | inflate distance too far | fixed block referencing distance 5 at output position 1 (hand-built: literal `'a'`, then length 3 distance 5 code) | E-IMP-003 "Distance too far back." |
| UT-11-09 | inflate cap | dynamic fixture with `expectedSize` 100 | E-IMP-004 |
| UT-11-10 | read directory | `zipw` with 3 entries and a 10-byte comment | `entries` names, sizes, method 0, crc match; `comment` decoded |
| UT-11-11 | no EOCD | 100 random bytes (seeded `Prng`) | E-IMP-003 |
| UT-11-12 | too many entries | EOCD `total` 300 with an empty directory | E-IMP-004 before any entry is read (directory bytes absent) |
| UT-11-13 | total size limit | two entries declaring 30 MB each (directory only) | E-IMP-004 "expands to more than 50 MB" |
| UT-11-14 | ratio bomb | entry csize 10, usize 1,000,000 | E-IMP-004 "suspicious compression ratio"; `extract` never called |
| UT-11-15 | extract stored and CRC | `zipw` entry; then corrupt one payload byte | bytes equal; corrupt -> E-IMP-003 "CRC" |
| UT-11-16 | extract deflate | directory entry with method 8 wrapping the `'abc'` fixture, crc of `'abc'` | `'abc'` |
| UT-11-17 | encryption and method | flags bit 0 set -> `read` throws E-IMP-006; method 12 entry -> `read` ok, `supported` false, `extract` E-IMP-006 |  as stated |
| UT-11-18 | names | `'dir\\file.xml'`, UTF-8 flag name `'caf\xC3\xA9.xml'`, `'a/'` | `'dir/file.xml'`; `'caf' + String.fromCharCode(0xE9) + '.xml'`; `isDirectory` true; `'../x'` -> supported false |
| UT-11-19 | local header lengths | local extra length 8 while central is 0 | data located correctly; bad local signature -> E-IMP-003 |
| UT-11-20 | ZIP64 | EOCD with total 0xFFFF | E-IMP-006 "ZIP64" |
| UT-11-21 | over-subscribed code | dynamic block with code lengths all 1 for 3 symbols | E-IMP-003 "Over-subscribed" |

#### 6.11.9 Implementation notes and browser quirks

- All multi-byte ZIP fields are little-endian; the Reader's `u16le`/`u32le` are used (M-10
  uses the big-endian pair); `>>> 0` keeps CRC and sizes unsigned.
- Overlapping back-references must be copied byte by byte (not `copyWithin`), because a
  distance smaller than the length repeats the just-written bytes.
- `Uint8Array.prototype.slice` exists in all targets; `subarray` is used for views.
- The output array is grown by allocation plus `set`; `ArrayBuffer.prototype.resize` is not
  relied on.
- Entry names are display data only; they never become paths.

### 6.12 M-12 MusicXml (`src/12-musicxml.js`, `FLM.MusicXml`)

#### 6.12.1 Responsibilities and non-goals

M-12 converts MusicXML documents (partwise and timewise, uncompressed `.xml`/`.musicxml`
and compressed `.mxl` through M-11) into one `Song`: parts to Tracks, notes, rests, chords,
ties, tuplets, grace notes, dynamics, articulations, tempo (`<sound tempo>` and
`<metronome>`), meters, keys, transposing instruments, octave shifts, pedal marks, lyrics,
rehearsal marks, repeats and endings (expanded), unpitched percussion, and a catalog of
unsupported elements reported as warnings. Non-goals: notation rendering or engraving (B
15.3, never attempted), layout and `<print>` data, harmony and figured bass interpretation,
ornament realization (trills and mordents play as written notes), `dacapo`/`dalsegno`/
`fine`/`coda` navigation (reported, not expanded), MusicXML export, `opus` collections.

Spec grounding: B 15.1, 15.3, 15.7, 23.1; E 3.3; I 6.4, 16.2; P 11.

#### 6.12.2 Public API

```js
FLM.MusicXml = {
  LIMITS: {
    maxTextBytes: 25 * 1024 * 1024,   // UTF-8 bytes of the XML text (after .mxl extraction)
    maxParts: 128,                    // E-IMP-004 (Model keeps 32; see 6.14.4.6)
    maxMeasuresPerPart: 10000,        // E-IMP-004
    maxEvents: 1000000,               // notes + directions; E-IMP-004
    maxExpandedMeasures: 40000,       // repeat expansion cap (4 x maxMeasures); W-XML-REPEAT-CAP then stop expanding
    maxRepeatPlays: 16,               // `times` attribute clamp
    maxGraceChain: 8,                 // grace notes before one principal note
    yieldEvery: 20000,                // notes between yields (in addition to one yield per part)
    budgetMs: 5000
  },
  /** dynamics name -> velocity 1..127 (table 6.12.4.7). */
  DYNAMICS: { pppp:10, ppp:16, pp:33, p:49, mp:64, mf:80, f:96, ff:112, fff:127, ffff:127, sf:112, sfz:112, sffz:127, fz:112, fp:112, sfp:96, rf:112, rfz:112, n:1 },
  /** element localName (or 'notations/<child>') -> {code, severity}; table 6.12.4.10. */
  UNSUPPORTED: { /* harmony: {code:'W-XML-HARMONY-IGNORED', severity:'info'}, ... */ },
  WARNINGS: { /* code -> {severity, message} */ },

  /** Sniff text or bytes: returns {format:'musicxml', version, root:'score-partwise'|'score-timewise', container:'xml'}
   *  when the first 4 KB contain '<score-partwise' or '<score-timewise' (after an optional XML
   *  declaration, comments, DOCTYPE); {format:'musicxml', root:'opus', supported:false} for '<opus';
   *  null otherwise. Never throws. */
  identify(textOrBytes) /* -> object|null */,

  /** Synchronous parse of XML text. Throws E-IMP-014 (entity declaration), E-IMP-015 (not
   *  well-formed), E-IMP-002 (root is not a score), E-IMP-004 (limits), E-IMP-006 (opus). */
  parse(text /* string */, opts /* ?ParseOptions */) /* -> ParseResult (container 'xml') */,
  parseAsync(text, opts, onProgress) /* -> Promise<ParseResult> */,

  /** .mxl: Zip.read -> META-INF/container.xml -> rootfile -> extract -> decode UTF-8 -> parseAsync.
   *  Throws E-IMP-007 when no score can be located; Zip errors pass through. */
  parseMxl(bytes /* Uint8Array */, opts, onProgress) /* -> Promise<ParseResult (container 'mxl')> */,

  util: {
    /** duration in divisions -> ticks: floor((d * 960 * 2 + divisions) / (2 * divisions)) on absolute positions. */
    durationToTicks(d, divisions) /* -> int */,
    /** step 'C'..'B', alter (may be fractional), octave -> MIDI 0..127 (alter rounded toward zero; out of range clamped) */
    pitchToMidi(step, alter, octave) /* -> int */,
    /** type name + dots + time-modification -> ticks (table 6.12.4.4). */
    typeToTicks(type, dots, actual, normal) /* -> int */,
    /** metronome beat-unit (+dot) and per-minute -> quarter-note BPM. */
    metronomeToBpm(beatUnit, beatUnitDot, perMinute) /* -> number */,
    expandRepeats(measureInfos /* [{repeatForward, repeatBackward, times, endingStart:[n], endingStop, endingDiscontinue}] */) /* -> {order:[int], capped:boolean} */
  }
};
```

Events: none emitted or consumed. Depends on `FLM.Theory` (pitch spelling, GM names),
`FLM.Model`, `FLM.Zip`.

#### 6.12.3 Internal state

Per parse `Ctx`:

```text
Ctx {
  doc: Document, root: Element, partwise: boolean,
  partList: Map<partId, PartInfo>,             // from <part-list>
  parts: [PartParse],                          // one per <part> (partwise) or per distinct part id (timewise)
  measureInfos: [MeasureInfo],                 // per source measure index (shared by all parts)
  measureLen: [int],                           // ticks per source measure after 6.12.4.5
  order: [int], expandedStart: [int],          // repeat expansion: source index per expanded measure; start tick per expanded measure
  warnings: WarningBag (file level), events: int, notes: int, yields: int, deadline, isCancelled, onProgress
}
PartInfo { id, name, abbreviation, instruments: Map<instrId, {name, program, channel, unpitched}>,
           program: int, channel: int, isDrums: boolean, volumeCc: int|null, panCc: int|null, hasMidi: boolean }
PartParse { info, measures: [MeasureParse], divisions: int (current), transposeSemis: int, octaveShift: int,
            velocity: int (current dynamic, default 80), openTies: Map<key, OpenNote>, pendingGrace: [GraceNote],
            key: {fifths, mode}, meter: {numerator, denominator} }
MeasureParse { index, number: string, implicit: boolean, items: [Item], contentTicks: int }
Item = {kind:'note', rel:int (ticks from measure start), durTicks, pitch, velocity, voice, staff, art:[], tieStart, tieStop, isGrace, chord, x}
     | {kind:'cc'|'program'|'bend'|'text'|'tempo'|'meter'|'key'|'marker', rel:int, ...}
MeasureInfo { index, repeatForward, repeatBackward, times, endingStart:[int], endingStop, endingDiscontinue, hasNav: boolean }
```

Invariants: `rel` values are integers in ticks relative to the measure start and are produced
by `durationToTicks` on the absolute in-measure position (a running numerator in divisions
converted once per item); items are emitted into Tracks only during expansion, so no Track is
touched before the repeat order is known; `openTies` are keyed by `voice + '/' + staff + '/' +
pitch` and are resolved in source order across measures of the same part.

#### 6.12.4 Algorithms

6.12.4.1 Pre-checks and DOM parsing

```text
1. text.length > 0 else E-IMP-003 "The file is empty."
2. Byte length (TextEncoder or bytes.length when parseMxl supplied bytes) > LIMITS.maxTextBytes -> E-IMP-001.
3. head = first 64 KB. If head contains '<!DOCTYPE' and the DOCTYPE's internal subset (text between '[' and ']>' after
   '<!DOCTYPE') contains '<!ENTITY' -> E-IMP-014 "This XML declares custom entities, which are not allowed for safety. Re-export the file without a DOCTYPE."
   (External DTD references are harmless: DOMParser never fetches them; CSP blocks it anyway.)
4. doc = new DOMParser().parseFromString(text, 'text/xml')      // never 'text/html' (ADR-06)
5. err = doc.getElementsByTagName('parsererror')[0] (Chromium and Safari nest it in the root; Firefox makes it the root) ->
   E-IMP-015 "The XML is not well-formed: {first 160 chars of the error text}."
6. root = doc.documentElement; by root.localName:
   'score-partwise' -> partwise = true; 'score-timewise' -> partwise = false;
   'opus' -> E-IMP-006 "MusicXML opus collections are not supported; import one score at a time.";
   other -> E-IMP-002 "This XML file is not a MusicXML score."
7. version = root.getAttribute('version') or 'unknown'; software = first <encoding><software> text;
   ParseResult.version = 'MusicXML ' + version + ' (' + (partwise ? 'partwise' : 'timewise') + ')' + (software ? ', ' + software(80) : '')
```

All element and attribute access uses `localName` comparisons (namespace-insensitive) through
two helpers: `child(el, name)` (first child element with that localName), `children(el,
name)`, `text(el)` (trimmed `textContent`), `attr(el, name)`.

6.12.4.2 Header

- `song.title` = `<work><work-title>` else `<movement-title>` else first `<credit-words>`
  with `credit-type` `title` else fileName stem; `song.artist` = first
  `<identification><creator type="composer">` else any `<creator>` else `''`; copyright
  `<identification><rights>` -> TextEvent `copyright` at tick 0 of the first track.
- `<part-list>`: for each `<score-part id>`: `name` = `<part-name>` (128 chars) or `'Part N'`;
  `<score-instrument id>` -> `instruments[id].name`; `<midi-instrument id>`: `midi-channel`
  (1-16 -> channel - 1), `midi-program` (1-128 -> program - 1), `midi-unpitched` (1-128 ->
  key - 1), `volume` (0-100 -> `volumeCc = round(v * 127 / 100)`), `pan` (-180..180 ->
  `panCc = round((clamp(pan, -90, 90) + 90) / 180 * 127)`). The part's `program` and
  `channel` come from its first `midi-instrument`; `isDrums` when that channel is 9 or any
  instrument has `midi-unpitched`. Parts without any `midi-instrument`: `hasMidi = false`,
  program 0, channel assigned later (6.12.4.8), W-XML-NO-MIDI-INSTRUMENT (info).
- Part count > LIMITS.maxParts -> E-IMP-004 before measures are read.
- Timewise documents are regrouped first: for each `<measure>` of the root, for each `<part
  id>` child, append that `<part>` element to `partsById[id].measureEls`; partwise documents
  use each `<part>`'s `<measure>` children. From here both forms run the same code over
  `(partId, measureEls[])`.

6.12.4.3 Measure walk (per part, per source measure, in order)

```text
pos = 0 (divisions, integer, within the measure); maxPos = 0; prevNoteItem = null
for el in measure.children (document order):
  switch el.localName:
   'attributes': divisions -> part.divisions (must be 1..16384 else W-XML-DIVISIONS, keep previous);
                 key: fifths (int -7..7) + mode -> item {kind:'key', rel:T(pos), fifths, mode: 'minor' ? 'minor' : 'major'}; mode other than major/minor/absent -> major + W-XML-KEY-MODE (info)
                 time: beats, beat-type -> item {kind:'meter', numerator, denominator} if denominator is a power of two in 1..64 and numerator 1..32 else W-XML-METER-RANGE (warn, ignored);
                       <senza-misura> -> W-XML-SENZA-MISURA (info), meter unchanged; additive beats like '3+2' -> sum with W-XML-ADDITIVE-METER (info)
                 transpose: chromatic (int) + 12 * octave-change (int) -> part.transposeSemis; W-XML-TRANSPOSED (info, once per part)
                 staves, clef, staff-details, measure-style: ignored silently
   'note':      noteItem(el)  (6.12.4.4)
   'backup':    pos -= duration; pos < 0 -> pos = 0 with W-XML-BACKUP-UNDERFLOW (warn)
   'forward':   pos += duration
   'direction': for each <direction-type> child:
                  dynamics -> part.velocity = DYNAMICS[childName] (unknown name or <other-dynamics> -> W-XML-DYNAMIC-UNKNOWN, unchanged)
                  metronome -> bpm = metronomeToBpm(beat-unit, beat-unit-dot count, per-minute); invalid -> ignore with W-XML-TEMPO-INVALID
                  words -> item {kind:'text', type:'text', text(1000)}
                  rehearsal -> item {kind:'marker', label(80) or 'Rehearsal', markerKind:'section'}
                  pedal: type start or sostenuto -> item cc 64 value 127; type stop -> cc 64 value 0; change -> cc 64 0 then 127 at the same rel (ordered)
                  octave-shift: type down -> part.octaveShift = +12 * (size - 1) / 7 (size 8 -> 12, 15 -> 24); up -> negative; stop -> 0; continue -> unchanged
                  wedge -> W-XML-WEDGE-IGNORED (info, once); segno, coda -> W-XML-NAV-UNSUPPORTED (warn, once); other -> ignored silently
                <sound>: tempo attribute -> bpm (wins over metronome in the same direction); dynamics attribute -> part.velocity = clamp(round(v * 90 / 100), 1, 127);
                         dacapo, dalsegno, fine, coda, tocoda, segno, forward-repeat attributes -> measureInfo.hasNav = true, W-XML-NAV-UNSUPPORTED
                <offset> (divisions): dirPos = pos + offset (clamped >= 0) for the items of this direction
                bpm -> item {kind:'tempo', rel:T(dirPos), usPerQuarter: clamp(round(60e6 / bpm), 1, 16777215)}
   'sound' (measure-level): same attribute handling as above
   'barline': <repeat direction="forward"> -> info.repeatForward; direction="backward" -> info.repeatBackward, times = clamp(int(times) or 2, 2, LIMITS.maxRepeatPlays)
              <ending number="1, 2" type="start"> -> info.endingStart = numbers parsed from the comma list (ints 1..16); type stop -> info.endingStop; discontinue -> info.endingDiscontinue
              segno/coda/fermata children -> navigation ones set W-XML-NAV-UNSUPPORTED
   'harmony', 'figured-bass', 'print', 'bookmark', 'link', 'grouping', 'listening': per UNSUPPORTED table (harmony and figured-bass warn once; others silent)
  maxPos = max(maxPos, pos)
measure.contentTicks = T(maxPos)
T(p) = durationToTicks(p, part.divisions)   // integer ticks relative to the measure start
```

6.12.4.4 `noteItem(el)`

```text
isGrace = child(el,'grace') != null; isCue = child(el,'cue') != null; isChord = child(el,'chord') != null; isRest = child(el,'rest') != null
if isCue: W-XML-CUE-SKIPPED (info, once); if not isChord: pos += duration; return
d = int(text(child(el,'duration'))) (grace: 0)
if !isGrace and d is NaN or d < 0: d = typeToTicks-derived divisions? -> derive: durTicksDerived = typeToTicks(type, dots, actual, normal); W-XML-DURATION-DERIVED (warn); use durTicksDerived directly as ticks (skip T())
startPos = isChord ? prevNoteItem.startPos : pos
startRel = T(startPos); durTicks = derived ? durTicksDerived : T(startPos + d) - startRel; durTicks < 1 -> 1 for notes (rests may be 0)
voice = text(child(el,'voice')) or '1'; staff = text(child(el,'staff')) or '1'
if isRest: if !isChord: pos += d; prevNoteItem = {startPos}; return
pitch:
  <pitch>: step, alter (float, default 0), octave -> midi = pitchToMidi(step, alter, octave); fractional alter -> W-XML-MICROTONE (warn, once)
  <unpitched>: instrId = attr(child(el,'instrument'),'id'); key = part.info.instruments[instrId]?.unpitched; key == null -> 38 with W-XML-UNPITCHED-FALLBACK (warn)
               midi = key; part.info.isDrums = true
  neither -> W-XML-NOTE-NO-PITCH (warn); treat as rest
pitched (not unpitched): midi += part.transposeSemis + part.octaveShift; clamp 0..127 with W-XML-PITCH-CLAMPED (warn) when changed
velocity = part.velocity; art = []
notations: for each <notations> child:
  tie handled via <tie> children of <note> (type start|stop), falling back to <tied> when no <tie> exists
  articulations: staccato -> durTicks = max(1, round(durTicks * 0.5)), art 'staccato'; staccatissimo -> 0.25, art 'staccatissimo'; detached-legato -> 0.75;
                 accent -> velocity += 15, art 'accent'; strong-accent -> velocity += 25, art 'marcato'; tenuto -> art 'tenuto' (duration unchanged); others -> art name only
  dynamics (inside notations) -> part.velocity updated as in direction, applies to this note too
  technical: bend -> bendAlter = float(bend-alter) semitones; release = child 'release' exists; art 'bend'; items added in 6.12.4.6 step 4
             hammer-on 'hammer', pull-off 'pull', harmonic 'harmonic-natural' (or 'harmonic-artificial' when <artificial>), string/fret -> x.tab = {string, fret}
             other technical -> W-XML-TECHNICAL-IGNORED (info, once per child name)
  ornaments: W-XML-ORNAMENT-UNSUPPORTED (info, once per child name), art 'ornament:<name>'
  glissando, slide -> W-XML-GLISS-UNSUPPORTED (info, once); arpeggiate -> W-XML-ARPEGGIO-IGNORED (info, once); tremolo -> W-XML-TREMOLO-IGNORED (info); slur, fermata -> ignored silently
velocity = clamp(velocity, 1, 127)
grace: if isGrace: pendingGrace.push({midi, velocity: clamp(velocity - 15, 1, 127), voice, staff, art, slash: attr(grace,'slash') == 'yes'});
                   pendingGrace.length > LIMITS.maxGraceChain -> drop oldest with W-XML-GRACE-CHAIN (info); return (grace does not advance pos)
principal note:
  k = pendingGrace.length; for i, g in pendingGrace: rel = max(0, startRel - 120 * (k - i)); dur = min(120, startRel - rel) or 1 when startRel == 0 (grace at measure start collapses to 1 tick, W-XML-GRACE-CLAMPED info)
       push item {kind:'note', rel, durTicks: dur, pitch: g.midi, velocity: g.velocity, voice, staff, art: ['grace', ...g.art], isGrace:true}
       if prevNoteItem on the same voice ends after rel: shorten it to end at rel (min 1)
  pendingGrace = []
tie: hasTieStop = tie type stop present; hasTieStart = tie type start present; key = voice + '/' + staff + '/' + midi
  if hasTieStop and part.openTies.has(key): open = openTies.get(key); open.item.durTicks += durTicks (open may live in an earlier measure: durations are stored as absolute spans, see 6.12.4.6 step 2)
       if !hasTieStart: openTies.delete(key)
       (no new item)
  else: if hasTieStop: W-XML-TIE-UNMATCHED (info); item = {kind:'note', rel:startRel, durTicks, pitch: midi, velocity, voice, staff, art, x, measureIndex}
        push item; if hasTieStart: openTies.set(key, {item, measureIndex, part})
notes++ ; notes > LIMITS.maxEvents -> E-IMP-004
if !isChord: pos += d (or derived divisions: pos += round(durTicksDerived * divisions / 960))
prevNoteItem = {startPos, item}
```

`typeToTicks(type, dots, actual, normal)`: base by type: maxima 30720, long 15360, breve
7680, whole 3840, half 1920, quarter 960, eighth 480, 16th 240, 32nd 120, 64th 60, 128th 30,
256th 15, 512th 8, 1024th 4, unknown -> 960 with W-XML-TYPE-UNKNOWN; dotted: 1 dot x 3/2, 2
dots x 7/4, 3 dots x 15/8; tuplet: x normal / actual (integers, actual 1..64); result rounded
to the nearest integer tick, minimum 1.

`durationToTicks(d, divisions)`: `floor((d * 1920 + divisions) / (2 * divisions))`; `d`
and `divisions` are integers (MusicXML allows decimal `duration`; a decimal is rounded to an
integer division count first with W-XML-DURATION-DECIMAL info).

6.12.4.5 Measure lengths and alignment

```text
for each source measure index i:
  meterTicks = ticksPerBar(meter in effect at i for the first part)      // meter items are shared: the first part's meter sequence is authoritative; a part whose meter at i differs -> W-XML-METER-MISMATCH (warn, once)
  content = max over parts of measures[i].contentTicks
  implicitPickup = measures[i].implicit for the first part, or (i == 0 and content < meterTicks)
  if content <= meterTicks: measureLen[i] = implicitPickup ? content : meterTicks     // pickup measures are as long as their content; full measures use the meter even when a part is under-filled
  else: measureLen[i] = content; W-XML-MEASURE-OVERFULL (warn, once with count)
  measureLen[i] < 1 -> 1
```

6.12.4.6 Repeat expansion and emission

```text
1. {order, capped} = util.expandRepeats(measureInfos):
   order = []; i = 0; repeatStart = 0; pass = Map<startIndex, int>(default 1); plays = Map<startIndex, int>
   while i < n and order.length < LIMITS.maxExpandedMeasures:
     m = infos[i]
     if m.repeatForward: repeatStart = i
     p = pass.get(repeatStart) ?? 1
     if m.endingStart.length and !m.endingStart.includes(p):
        j = i; while j < n and !(infos[j].endingStop or infos[j].endingDiscontinue or (j > i and infos[j].endingStart.length)): j++
        i = (j < n and (infos[j].endingStop or infos[j].endingDiscontinue)) ? j + 1 : j; continue
     order.push(i)
     if m.repeatBackward:
        total = m.times (default 2)
        if p < total: pass.set(repeatStart, p + 1); i = repeatStart; continue
        pass.set(repeatStart, 1); repeatStart = i + 1       // group finished; a later backward repeat without a forward starts here
     i++
   capped = order.length >= LIMITS.maxExpandedMeasures -> W-XML-REPEAT-CAP (warn)
   An ending whose numbers include a pass greater than `total` (for example ending 3 with a plain x2 repeat) raises total to the largest ending number (max LIMITS.maxRepeatPlays).
   Endings that never match any pass are still played once at the end so no source measure is silently lost.
2. expandedStart[k] = sum of measureLen[order[0..k-1]]
   Tied-note spans: an item whose tie ended in a later source measure stores durTicks as the span computed from source measure starts
   (sum of measureLen between the two measures plus relative offsets), so the item is self-contained; when the expansion places the
   starting measure somewhere, the note sounds for that span regardless of what follows (W-XML-TIE-ACROSS-REPEAT info when the end measure is not
   the next measure in `order` at that occurrence).
3. For each k, source measure i = order[k], base = expandedStart[k]:
   for each part: for each item of measures[i]: tick = base + item.rel; emit:
     note -> NoteEvent(tick, durTicks, pitch, velocity, channel, {x:{art, tab}}) (x omitted when empty)
     cc -> ControlEvent; program -> ProgramEvent; text -> TextEvent; bend -> PitchBendEvents (step 4)
     tempo/meter/key -> song map entries (last at a tick wins); marker -> song.markers (label gets ' (2)', ' (3)' suffixes on later occurrences of the same source measure)
   lyrics: <lyric number="1"> <text> joined with <elision>; syllabic begin/middle add '-' suffix -> TextEvent type 'lyric' at the note tick; other lyric numbers -> W-XML-LYRIC-LINES (info, once)
4. bend emission for a note with bendAlter: bend(tick, 0), bend(tick + round(durTicks * 0.5), value), and when release: bend(tick + durTicks - 1, 0);
   value = clamp(round(bendAlter / 2 * 8191), -8192, 8191); |bendAlter| > 2 -> W-XML-BEND-RANGE (info, once); a following note on the channel gets an explicit bend 0 at its tick when the previous bend did not return to 0
5. yield after each part's emission (and every yieldEvery notes within a part); progress fraction = partsDone / parts
```

6.12.4.7 Dynamics table

| Mark | Velocity | Mark | Velocity |
|---|---|---|---|
| pppp | 10 | f | 96 |
| ppp | 16 | ff | 112 |
| pp | 33 | fff | 127 |
| p | 49 | ffff | 127 |
| mp | 64 | sf, sfz, fz, fp, rf, rfz | 112 |
| mf (default) | 80 | sffz | 127 |
| n | 1 | sfp | 96 |

`<sound dynamics="N">`: `clamp(round(N * 90 / 100), 1, 127)` (N is a percentage of the
MusicXML reference velocity 90).

6.12.4.8 Track materialization

```text
for each part in part-list order (parts in <part-list> but without a <part> body -> skipped silently; <part> without a list entry -> PartInfo defaults with W-XML-PART-UNLISTED info):
  channel: part.info.hasMidi ? info.channel : next free channel in 0,1,...,15 skipping 9 (wrap to 0 after 15 with W-XML-CHANNEL-REUSE info); isDrums -> channel 9
  track = Model.Track.create({name: info.name, channel, program: info.program, bankMsb 0, bankLsb 0, isDrums, color by index})
  if volumeCc != null: ControlEvent(0, 7, volumeCc); panCc -> ControlEvent(0, 10, panCc)
  Model.insertEvents(track, emitted events of this part)
  Song.addTrack(song, track) (overflow beyond 32 as in 6.14.4.6)
song.tempoMap = new Model.TempoMap(entries) (none -> default + W-XML-NO-TEMPO info); meterMap, keyMap likewise (none -> defaults, no warning for key)
song.markers sorted and deduped; song.source = {format:'musicxml', fileName, version, warnings, ...}; song.durationTicks = Song.computeDuration(song)
```

6.12.4.9 `parseMxl(bytes, opts, onProgress)`

```text
archive = Zip.read(bytes)
container = archive.byName.get('META-INF/container.xml')
if container: cdoc = DOMParser(text/xml) of decodeUtf8(Zip.extract(archive, container)); rootfiles = elements 'rootfile';
   path = first rootfile full-path whose media-type is absent or 'application/vnd.recordare.musicxml+xml' (else the first rootfile)
   path missing from the archive -> E-IMP-007 "The compressed MusicXML container names a score that is not in the archive."
else: path = first entry (directory order) whose name ends with '.musicxml' or '.xml' and is not under 'META-INF/'; none -> E-IMP-007 "The .mxl archive contains no MusicXML score."
      W-XML-MXL-NO-CONTAINER (info)
yield (one yield per extracted entry); check deadline
xmlBytes = Zip.extract(archive, path); text = TextDecoder('utf-8') (non-fatal; a UTF-16 BOM FF FE / FE FF -> decode as 'utf-16le'/'utf-16be')
result = await parseAsync(text, opts, onProgress); result.container = 'mxl'; result.stats.bytes = bytes.length; return result
```

6.12.4.10 Unsupported element catalog and warning catalog

`UNSUPPORTED` (element -> code, severity; every entry is "reported, not applied"):

| Element | Code | Severity |
|---|---|---|
| harmony | W-XML-HARMONY-IGNORED | info |
| figured-bass | W-XML-FIGURED-BASS-IGNORED | info |
| notations/ornaments/* | W-XML-ORNAMENT-UNSUPPORTED | info |
| notations/glissando, notations/slide | W-XML-GLISS-UNSUPPORTED | info |
| notations/arpeggiate, notations/non-arpeggiate | W-XML-ARPEGGIO-IGNORED | info |
| notations/tremolo | W-XML-TREMOLO-IGNORED | info |
| notations/technical/* other than bend, hammer-on, pull-off, harmonic, string, fret | W-XML-TECHNICAL-IGNORED | info |
| direction-type/wedge | W-XML-WEDGE-IGNORED | info |
| direction-type/segno, direction-type/coda, sound[dacapo, dalsegno, fine, coda, tocoda, segno, forward-repeat], barline/segno, barline/coda | W-XML-NAV-UNSUPPORTED | warn |
| note/cue | W-XML-CUE-SKIPPED | info |
| lyric[number != 1] | W-XML-LYRIC-LINES | info |
| time/senza-misura | W-XML-SENZA-MISURA | info |

`WARNINGS` (all codes used above):

| Code | Severity | Message |
|---|---|---|
| W-XML-NO-MIDI-INSTRUMENT | info | Part "{name}" has no MIDI instrument; Acoustic Grand Piano on the next free channel is used. |
| W-XML-PART-UNLISTED | info | Part "{name}" is not in the part list; defaults were used. |
| W-XML-CHANNEL-REUSE | info | More than 15 parts without MIDI channels; channels were reused. |
| W-XML-DIVISIONS | warn | Invalid divisions value {value}; the previous value was kept. |
| W-XML-KEY-MODE | info | Key mode "{name}" was treated as major for spelling. |
| W-XML-METER-RANGE | warn | Time signature {value} is out of range and was ignored. |
| W-XML-METER-MISMATCH | warn | Parts disagree on the time signature; the first part's signature is used. |
| W-XML-ADDITIVE-METER | info | Additive time signature {value} was summed. |
| W-XML-SENZA-MISURA | info | A measure without time signature keeps the previous signature. |
| W-XML-TRANSPOSED | info | Part "{name}" is a transposing instrument; pitches were converted to sounding pitch. |
| W-XML-BACKUP-UNDERFLOW | warn | A backup moved before the start of a measure and was clamped. |
| W-XML-DYNAMIC-UNKNOWN | info | Dynamic mark "{name}" is not recognized; the previous level was kept. |
| W-XML-TEMPO-INVALID | warn | A tempo marking was unreadable and was ignored. |
| W-XML-NO-TEMPO | info | No tempo marking; 120 BPM is used. |
| W-XML-NAV-UNSUPPORTED | warn | Navigation marks (da capo, dal segno, fine, coda) are not expanded; the score plays through once. |
| W-XML-WEDGE-IGNORED | info | Crescendo and diminuendo hairpins are not applied ({n}). |
| W-XML-CUE-SKIPPED | info | Cue notes were skipped ({n}). |
| W-XML-DURATION-DERIVED | warn | {n} notes had no duration; it was derived from the note type. |
| W-XML-DURATION-DECIMAL | info | Decimal durations were rounded to whole divisions. |
| W-XML-TYPE-UNKNOWN | warn | Unknown note type "{name}" was treated as a quarter note. |
| W-XML-MICROTONE | warn | Microtonal alterations were rounded to the nearest semitone ({n}). |
| W-XML-UNPITCHED-FALLBACK | warn | {n} percussion notes have no MIDI instrument; Acoustic Snare was used. |
| W-XML-NOTE-NO-PITCH | warn | {n} notes have neither pitch nor unpitched data and were treated as rests. |
| W-XML-PITCH-CLAMPED | warn | {n} notes were outside MIDI range after transposition and were clamped. |
| W-XML-GRACE-CHAIN | info | More than {n} grace notes before one note; the earliest were dropped. |
| W-XML-GRACE-CLAMPED | info | Grace notes at the start of the score were shortened. |
| W-XML-TIE-UNMATCHED | info | A tie end had no matching start ({n}); the note was kept. |
| W-XML-TIE-ACROSS-REPEAT | info | A tied note crosses a repeat boundary; it sounds for its written length. |
| W-XML-MEASURE-OVERFULL | warn | {n} measures contain more than their time signature allows; they were lengthened. |
| W-XML-REPEAT-CAP | warn | Repeats expand to more than {n} measures; expansion stopped there. |
| W-XML-BEND-RANGE | info | Bends larger than two semitones were clamped. |
| W-XML-HARMONY-IGNORED | info | Chord symbols are not imported ({n}). |
| W-XML-FIGURED-BASS-IGNORED | info | Figured bass is not imported ({n}). |
| W-XML-ORNAMENT-UNSUPPORTED | info | Ornaments ({name}) play as plain notes ({n}). |
| W-XML-GLISS-UNSUPPORTED | info | Glissandi and slides are not played ({n}). |
| W-XML-ARPEGGIO-IGNORED | info | Arpeggio marks are not applied ({n}). |
| W-XML-TREMOLO-IGNORED | info | Tremolo marks are not applied ({n}). |
| W-XML-TECHNICAL-IGNORED | info | Technical marks ({name}) are notation only ({n}). |
| W-XML-LYRIC-LINES | info | Only the first lyric line is imported. |
| W-XML-MXL-NO-CONTAINER | info | The .mxl archive has no container.xml; the first score file was used. |

#### 6.12.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| DOCTYPE with entity declarations | 6.12.4.1 step 3 | nothing parsed | user re-exports | none | E-IMP-014 text | n/a | aborted | UT-12-02 |
| Not well-formed XML | `parsererror` | nothing | no | none | E-IMP-015 text with the browser message | n/a | aborted | UT-12-03 |
| Root is not a score, or opus | step 6 | nothing | no | none | E-IMP-002 or E-IMP-006 | n/a | aborted | UT-12-01 |
| Too many parts or measures or notes | pre-checks and counters | nothing | no | none | E-IMP-004 | n/a | aborted | UT-12-26 |
| Container without a score | 6.12.4.9 | archive readable | no | none | E-IMP-007 | n/a | aborted | UT-12-25 |
| Damaged .mxl | Zip errors | nothing | no | none | Zip E-IMP-003 text | n/a | aborted | UT-12-25 |
| Invalid attribute values (divisions, meter, key, tempo) | per-element validation | previous values kept | no | none | W-XML-* warnings | import continues | n/a | UT-12-23 |
| Navigation marks | hasNav | linear playback | no | none | W-XML-NAV-UNSUPPORTED | plays once through | n/a | UT-12-15 |
| Repeat explosion | expansion cap | partial expansion | no | none | W-XML-REPEAT-CAP | truncated repeats | n/a | UT-12-14 |
| Budget exceeded | deadline at yield | discarded | retry on a faster device | none | E-IMP-005 | n/a | aborted | UT-12-27 |

#### 6.12.6 Limits and performance notes

- `DOMParser` on a 25 MB document takes several seconds in all target browsers and cannot be
  sliced; it is the one non-yielding step. M-14 reports stage `parse` with `fraction` null
  during it. Documents above 8 MB raise W-IMP-LARGE-FILE (info) in M-14 before parsing so the
  UI can say "this may take a while".
- Element access uses `children` iteration with `localName` checks, not `querySelectorAll`
  with namespace prefixes, to stay namespace-insensitive and allocation-light.
- Per-part yields keep the main thread responsive for scores with many parts; within a part
  the note counter yields every 20,000 notes.
- Memory: items are plain objects (about 100 bytes each); 1,000,000 notes peak near 120 MB
  plus the DOM, which is the reason the event limit is enforced during the walk.

#### 6.12.7 Spec coverage

B 15.1 (steps 3-6), B 15.3 (parts and instruments, measures, notes and rests, durations,
chords, ties, time signatures, key signatures, tempo markings, articulation and dynamics,
repeats and endings; compressed and uncompressed variants defined; engraving explicitly not
assumed), B 15.7, B 23.1 (imported XML never executed; entity defense), B 25.3 (valid
MusicXML, unsupported features reported); E 3.3 (compressed MusicXML, multiple parts, voices
and staves, chords and ties across measures, tuplets, repeats and alternate endings,
transposing instruments, notation-to-event loss reported, valid file with no playable events
via M-14), E 10 item 11; I 6.4, 16.2; P 11 (MusicXML preserves supported notation and
performance information; unsupported events warn).

#### 6.12.8 Unit tests

`src/91-test-musicxml.js`, group `musicxml`. Fixtures are template strings built by
`mx.score({parts:[{id, name, midi:{channel, program}, measures:[xmlString...]}], timewise})`
with helpers `mx.note(step, octave, dur, extra)`, `mx.rest(dur)`, `mx.attributes({...})`,
`mx.direction(...)`, `mx.barline(...)`. `.mxl` fixtures use the `zipw` writer from the zip
tests (shared through `FLM.SelfTest.fixtures.zipw`, registered by `91-test-zip.js`, which
loads first).

| UT | Name | Setup | Assertion |
|---|---|---|---|
| UT-12-01 | identify | partwise 3.1 text; timewise; `<opus>`; `<html>` | `{root:'score-partwise', version:'3.1'}`; timewise root; opus `supported:false`; null |
| UT-12-02 | entity defense | DOCTYPE with `<!ENTITY x "y">` | E-IMP-014; plain DOCTYPE without entities parses |
| UT-12-03 | malformed XML | unclosed `<note>` | E-IMP-015, message contains browser text |
| UT-12-04 | part-list | two parts: ch 1 program 34; percussion with midi-unpitched 36 | track 0 channel 0 program 33; track 1 `isDrums`, channel 9, note pitch 35 |
| UT-12-05 | divisions | div 4 quarter, div 8 eighth after an attributes change mid-part | ticks 0 and 960 both 960 long; derived `durationToTicks(3, 4)` 720 |
| UT-12-06 | derived duration | note without `<duration>`, type eighth, dot, time-modification 3:2 | durTicks 480; W-XML-DURATION-DERIVED |
| UT-12-07 | chord | three notes with `<chord>` on the last two | three NoteEvents at the same tick; cursor advanced once |
| UT-12-08 | ties | half note tie start in measure 1, half tie stop in measure 2; a lone tie stop | one note durTicks 3840; W-XML-TIE-UNMATCHED n 1 and the lone note kept |
| UT-12-09 | grace notes | two grace notes before a quarter at tick 1920 | graces at 1680 and 1800, durTicks 120, velocity 65 (80 - 15), art contains `'grace'`; at tick 0 -> clamped, W-XML-GRACE-CLAMPED |
| UT-12-10 | dynamics | direction `pp` then notes; `<sound dynamics="50">`; default | velocities 33; 45; 80 |
| UT-12-11 | articulations | staccato quarter; accent; strong-accent; staccatissimo | durTicks 480 and art `'staccato'`; velocity 95; 105; durTicks 240 |
| UT-12-12 | tempo | `<sound tempo="100">`; metronome half = 60; dotted quarter = 80; direction with both | 600000 us; 120 BPM -> 500000; 120 BPM; sound wins |
| UT-12-13 | backup and forward | two voices via backup; forward 480 | second voice notes at measure start; forward shifts by 960 ticks at div 2 |
| UT-12-14 | repeats | A :x2 B; A x3 (`times="3"`); A [1.B][2.C] D | orders `[0,0,1]`, `[0,0,0]`, `[0,1,0,2,3]`; a 12-measure score with nested repeats hitting the cap -> W-XML-REPEAT-CAP and `capped` true |
| UT-12-15 | navigation marks | `<sound dacapo="yes">`, `<coda>`, `<segno>`, fine | W-XML-NAV-UNSUPPORTED once (count 4); linear order |
| UT-12-16 | transpose | `<transpose><chromatic>-2</chromatic><octave-change>-1</octave-change>` with C4 written | pitch 46; W-XML-TRANSPOSED once |
| UT-12-17 | octave shift | `octave-shift type="down" size="8"` then stop | pitches +12 inside, unchanged after |
| UT-12-18 | unpitched fallback | unpitched note without `<instrument>` | pitch 38; W-XML-UNPITCHED-FALLBACK |
| UT-12-19 | texts and markers | lyric `'la'`, rehearsal `'A'`, words `'Solo'` | TextEvent lyric `'la'`; Marker section `'A'`; TextEvent text `'Solo'` |
| UT-12-20 | pedal | pedal start at beat 1, stop at beat 3 | CC 64 127 at 0 and 0 at 1920 |
| UT-12-21 | timewise equals partwise | same content in both forms | `ids()` of both results deep equal (SourceInfo.version aside) |
| UT-12-22 | measure lengths | implicit pickup of one quarter; a measure with 5 quarters in 4/4 | first measure length 960; overfull measure 4800 with W-XML-MEASURE-OVERFULL |
| UT-12-23 | invalid attributes | divisions 0; time 5/3; key mode dorian; metronome without per-minute | W-XML-DIVISIONS, W-XML-METER-RANGE, W-XML-KEY-MODE, W-XML-TEMPO-INVALID; previous values kept |
| UT-12-24 | unsupported catalog | harmony x2, trill, mordent, wedge, glissando | warnings once per code with counts (`W-XML-HARMONY-IGNORED` count 2; ornament name list contains trill and mordent) |
| UT-12-25 | mxl | zip with container.xml -> `score.musicxml`; zip without container but with `a.xml`; zip with neither | parsed with `container:'mxl'`; parsed with W-XML-MXL-NO-CONTAINER; E-IMP-007 |
| UT-12-26 | limits | 129 `<score-part>` entries; 10,001 measures (generated string) | E-IMP-004 before measures; E-IMP-004 |
| UT-12-27 | parseAsync | 3 parts, `onProgress` captured; `budgetMs:0` | fractions 1/3, 2/3, 1; result equals `parse`; budget 0 -> E-IMP-005 |
| UT-12-28 | header | work-title, composer, software | `song.title`, `song.artist`, version string ends with the software name |
| UT-12-29 | channel assignment | 3 parts without midi-instrument after a drum part | channels 0, 1, 2; drums 9; W-XML-NO-MIDI-INSTRUMENT count 3 |
| UT-12-30 | determinism | parse the same text twice | `ids()` deep equal |
| UT-12-31 | bend | technical bend alter 1 with release on a quarter | bends 0 at tick, 4096 at +480, 0 at +959 |
| UT-12-32 | staves | piano part with staff 1 and 2, backup between | one Track; both staves' notes present at correct ticks |

#### 6.12.9 Implementation notes and browser quirks

- `DOMParser` error reporting differs: Firefox returns a document whose root is
  `parsererror` (namespace `http://www.mozilla.org/newlayout/xml/parsererror.xml`);
  Chromium and Safari insert a `parsererror` element inside the partially parsed root. The
  check uses `getElementsByTagName('parsererror')` which finds both.
- Safari's `DOMParser` is slower on large documents than Chromium's; the 8 MB notice above
  exists for it.
- `textContent` of a 25 MB document is never requested as a whole; `text(el)` is called per
  element.
- MusicXML `<divisions>` may change at any `<attributes>`; positions are tracked in the
  current divisions and converted per item, so a change mid-measure is handled by converting
  the positions before and after separately (the `pos` counter is reset to the converted
  tick basis: `pos` is kept in divisions only within one divisions regime; on change the
  code stores `baseTicks = T(pos)` and restarts `pos` at 0 with the new divisions).
- Octave-shift direction: `type="down"` (an 8va sign above the staff) means the notation is
  written an octave below the sound, so sounding pitch = written + 12; `type="up"` is the
  reverse. UT-12-17 pins this.
- `<tied>` appears in `<notations>` and is notation; `<tie>` is the sound element. When a
  file has only `<tied>` (some exporters), it is used as the fallback.

### 6.13 M-13 GuitarPro (`src/13-guitarpro.js`, `FLM.GuitarPro`)

#### 6.13.1 Responsibilities and non-goals

M-13 reads Guitar Pro 3, 4 and 5 binary files (`.gp3`, `.gp4`, `.gp5`; version strings in
6.13.4.2) into one `Song`: song information, tempo and tempo changes, key, 64 MIDI channel
definitions, measure headers (meter, repeats, alternate endings, markers, key changes),
track headers (name, strings, tuning, port and channel, frets, capo), beats with durations,
dots and tuplets, rests, notes per string with their effects, mix table changes, beat text,
chord names, lyrics, and GP5 second voices. It converts tablature effects to model events
and flags (bend points to `PitchBendEvent`s, palm mute and dead notes to velocity and
duration, harmonics to pitch offsets, tied and let-ring notes to extended durations, grace
notes to short preceding notes, slides and hammer-ons to `x.art` flags) and expands repeats.
It knows the identification signatures of GP6 (`BCFZ`) and GP7/GP8 (ZIP with
`Content/score.gpif`) only so that M-14 can name them; it never parses them.

Non-goals: GP1 and GP2 (`FICHIER GUITARE PRO v1.x`, `FICHIER GUITAR PRO v2.x`), GP6
`.gpx`, GP7 and later `.gp` (all Unsupported with the Part 1.5 wording), RSE data (skipped),
chord diagram fingering (name only), page setup, directions (coda, segno: reported, not
expanded), triplet feel (swing is not applied; reported), stroke and fade-in, writing GP
files.

Spec grounding: B 15.1, 15.4, 15.7, 23.1; E 3.3; I 6.4; P 11 (Guitar Pro support
limited to declared versions).

#### 6.13.2 Public API

```js
FLM.GuitarPro = {
  SUPPORTED_VERSIONS: {
    'FICHIER GUITAR PRO v3.00': {major:3, minor:0,  label:'GP3 v3.00'},
    'FICHIER GUITAR PRO v4.00': {major:4, minor:0,  label:'GP4 v4.00'},
    'FICHIER GUITAR PRO v4.06': {major:4, minor:6,  label:'GP4 v4.06'},
    'FICHIER GUITAR PRO L4.06': {major:4, minor:6,  label:'GP4 L4.06'},
    'FICHIER GUITAR PRO v5.00': {major:5, minor:0,  label:'GP5 v5.00'},
    'FICHIER GUITAR PRO v5.10': {major:5, minor:10, label:'GP5 v5.10'}
  },
  /** Signatures M-14 uses to name files this module refuses (data only). */
  UNSUPPORTED_SIGNATURES: [
    {kind:'magic',    bytes:[0x42,0x43,0x46,0x5A], label:'Guitar Pro 6 (.gpx)'},            // 'BCFZ'
    {kind:'zipEntry', entry:'Content/score.gpif',  label:'Guitar Pro 7 or 8 (.gp)'},
    {kind:'prefix',   text:'FICHIER GUITARE PRO v1', label:'Guitar Pro 1'},
    {kind:'prefix',   text:'FICHIER GUITAR PRO v2',  label:'Guitar Pro 2'},
    {kind:'prefix',   text:'CLIPBOARD GUITAR PRO',  label:'Guitar Pro clipboard data'}
  ],
  LIMITS: {
    maxFileBytes: 25 * 1024 * 1024, maxTracks: 128, maxMeasures: 10000, maxNotes: 1000000,
    maxBeatsPerVoice: 256,        // per measure per track per voice; more -> E-IMP-003 (desync)
    maxBendPoints: 64, maxNoticeLines: 64, maxStringBytes: 65535, maxLyricBytes: 1048576,
    maxStrings: 7, maxFrets: 64, maxRepeatPlays: 16, maxExpandedMeasures: 40000,
    yieldEveryNotes: 20000, yieldEveryMeasures: 50, budgetMs: 5000
  },
  WARNINGS: { /* W-GP-* -> {severity, message}; table 6.13.4.11 */ },

  /** Reads the 31-byte version block. Returns {format:'guitarpro', version:label, supported:boolean,
   *  major, minor} for any 'FICHIER GUITAR' / 'CLIPBOARD GUITAR' prefix, null otherwise. Never throws. */
  identify(bytes /* Uint8Array */) /* -> object|null */,
  parse(bytes, opts) /* -> ParseResult; throws E-IMP-003, E-IMP-004, E-IMP-006 */,
  parseAsync(bytes, opts, onProgress) /* -> Promise<ParseResult> */,

  util: {
    pitchFromStringFret(tuning /* int[] */, stringIndex /* 0-based, 0 = highest string */, fret, capo) /* -> int 0..127 (clamped) */,
    velocityFromGp(dyn /* 1..9 */) /* -> int (table 6.13.4.8) */,
    durationUnits(code /* -2..4 */, dotted, tuplet /* 0 or 3..13 */) /* -> int units of 1/18018 tick (6.13.4.6) */,
    harmonicOffset(type /* 'natural'|'artificial'|'tapped'|'pinch'|'semi' */, fret) /* -> semitones (table 6.13.4.9) */,
    expandRepeats(headers /* [{repeatOpen, plays, altMask}] */) /* -> {order:[int], capped:boolean} */,
    chordSkipLength(major, header /* first byte */ , view) /* -> int bytes (6.13.4.7) */
  }
};
```

Events: none emitted or consumed. Depends on `FLM.Theory` (GM names, pitch names), `FLM.Model`.

#### 6.13.3 Internal state

Per parse `Ctx`:

```text
Ctx { r: Reader, v: {major, minor, is5:boolean, is51:boolean}, info: {title, subtitle, artist, album, words, music, copyright, tab, instructions, notices:[]},
      tripletFeel: boolean|null, lyrics: {trackIndex:int|null, lines:[{startMeasure, text}]}|null,
      tempo: int, key: int, octave: int, channels: [ChannelDef x 64], directions: int[19]|null,
      measureCount, trackCount, headers: [MeasureHeader], tracks: [TrackDef],
      measures: Array<Array<MeasureBeats>>   // [measureIndex][trackIndex] -> {voices:[Beat[]], complete:boolean}
      notes: int, yields: int, deadline, isCancelled, onProgress, warnings: WarningBag, truncatedAt: int|null }
ChannelDef { program, volume, balance, chorus, reverb, phaser, tremolo }        // 12 bytes each
MeasureHeader { index, numerator, denominator, repeatOpen, plays (1..16, 1 = no close), altMask (bits), marker:{name,color}|null,
                key:{fifths, minor}|null, doubleBar, tripletFeel (GP5), beams }
TrackDef { index, name, isDrums, stringCount, tuning:int[7], port, channel (0-based 0..15), effectChannel, frets, capo, color, program, volumeCc, panCc }
Beat { status: 'note'|'rest'|'empty', units: int (duration in 1/18018 tick), text, chordName, effects: {tremoloBar:BendStruct|null, tap, slap, pop, fadeIn, stroke, pickstroke, rasgueado, vibrato},
       mix: MixChange|null, notes: [GpNote] }
GpNote { string (0-based), fret, type: 'normal'|'tied'|'dead', velocity, accent: 0|15|25, ghost, effects: {bend:BendStruct|null, hammer, slide:int|null, letRing, grace:Grace|null,
         staccato, palmMute, tremoloPicking:int|null, harmonic:{type, octaveCode}|null, trill:{fret, period}|null, vibrato}, durationPercent: number|null }
BendStruct { type, value, points:[{position (0..60), value (25 = quarter tone), vibrato}] }
Grace { fret, velocity, transition, durationCode, onBeat, dead }
```

Invariants: `headers.length === measureCount` after the header pass (or the file is fatal);
`measures[m][t]` exists only when fully read (`complete`), so truncation never leaves a half
measure in the data used for emission; every beat has `units >= 1`; `tuning` is 7 entries
with entries beyond `stringCount` ignored.

#### 6.13.4 Algorithms

6.13.4.1 Binary primitives (on top of the Reader of 6.10.4.1)

| Name | Encoding | Checks |
|---|---|---|
| `u8`, `i8`, `bool` | 1 byte; bool = byte != 0 | EOF |
| `i16`, `i32` | little-endian signed | EOF |
| `f64` | little-endian IEEE double | EOF |
| `byteString(block)` | `len = u8`; then exactly `block` bytes; string = first `min(len, block)` bytes decoded (6.13.4.1 note) | EOF; `len > block` -> W-GP-STRING-LENGTH (info), clamp |
| `intSizeString()` | `n = i32`; then `n` bytes | `n < 0` or `n > LIMITS.maxLyricBytes` -> E-IMP-003 "string length out of range at offset {n}" |
| `intByteSizeString()` | `n = i32` (= len + 1); `len = u8`; then `n - 1` bytes; string = first `min(len, n - 1)` bytes | `n < 1` or `n > LIMITS.maxStringBytes + 1` -> E-IMP-003 |
| `color()` | 4 bytes r, g, b, pad | EOF |

GP strings are Windows-1252 text: decode each byte through the Latin-1 path of
`decodeText` (6.10.4.1 item 4, including the 0x80-0x9F table); UTF-8 is not attempted.
Names are capped at 128 characters, beat text and lyrics at 1,000.

6.13.4.2 `identify(bytes)` and version gate

```text
if len < 31: return null
l = bytes[0]; if l > 30: return null
s = ASCII of bytes[1 .. 1+l] (bytes >= 0x80 -> not GP, return null)
if s starts with 'FICHIER GUITAR PRO ' or 'FICHIER GUITARE PRO ' or 'CLIPBOARD GUITAR PRO':
   sup = SUPPORTED_VERSIONS[s]; return {format:'guitarpro', version: sup ? sup.label : s, supported: !!sup, major: sup?.major ?? null, minor: sup?.minor ?? null, raw: s}
return null
parse(): id = identify(bytes); id == null -> E-IMP-002; !id.supported -> E-IMP-006 with the message:
   GP1/GP2: "This is a Guitar Pro 1 or 2 file. Only Guitar Pro 3, 4 and 5 files (.gp3, .gp4, .gp5) can be imported. Open it in Guitar Pro and save it as GP5."
   clipboard: "This is Guitar Pro clipboard data, not a song file."
   other FICHIER strings: "Guitar Pro version "{raw}" is not supported. Only Guitar Pro 3, 4 and 5 files can be imported."
r.pos = 31 after the version block
```

6.13.4.3 Header layouts

Field order (top to bottom) per version; `IBS` = intByteSizeString, `IS` = intSizeString.

| Step | GP3 | GP4 | GP5 (5.00 and 5.10) |
|---|---|---|---|
| version | 31-byte block | same | same |
| info | IBS x8: title, subtitle, artist, album, author (words), copyright, tab, instructions | same | IBS x9: title, subtitle, artist, album, words, music, copyright, tab, instructions |
| notices | `n = i32` (0..64 else E-IMP-004); `n` x IBS | same | same |
| triplet feel | `bool` | `bool` | none (per measure header) |
| lyrics | none | `trackNumber = i32` (1-based, 0 = none); 5 x (`startMeasure = i32`, `IS` text) | same |
| master effect | none | none | 5.10 only: `i32` volume, `i32` reserved, 11 x `i8` EQ |
| page setup | none | none | `i32` x7 (page width, height, margins left, right, top, bottom, score size), `i16` header flags, IBS x10 |
| tempo name | none | none | IBS |
| tempo | `i32` BPM | `i32` | `i32` |
| hide tempo | none | none | 5.10 only: `bool` |
| key | `i32` | `i8` | `i8` |
| octave | none | `i32` | `i32` |
| channels | 64 x (`i32` program, `u8` volume, `u8` balance, `u8` chorus, `u8` reverb, `u8` phaser, `u8` tremolo, `u8` x2 blank) | same | same |
| directions | none | none | 19 x `i16` (coda, double coda, segno, segno segno, fine, da capo, da capo al coda, da capo al double coda, da capo al fine, da segno, da segno al coda, da segno al double coda, da segno al fine, da segno segno, da segno segno al coda, da segno segno al double coda, da segno segno al fine, da coda, da double coda); any value != -1 -> W-GP-NAV-UNSUPPORTED (warn) |
| master reverb | none | none | `i32` |
| counts | `measureCount = i32`, `trackCount = i32` | same | same |

Checks after counts: `measureCount` in 1..LIMITS.maxMeasures else E-IMP-004 (0 -> E-IMP-003
"file has no measures"); `trackCount` in 1..LIMITS.maxTracks else E-IMP-004; `tempo` outside
1..999 -> W-GP-TEMPO-RANGE (warn) and clamp; `key` outside -7..7 -> W-GP-KEY-RANGE (warn),
use 0. Channel program outside 0..127 -> 0 with W-GP-CHANNEL-RANGE (info). Any EOF before
the counts are read -> E-IMP-003 "The file ends inside its header."

6.13.4.4 Measure headers (`measureCount` records)

```text
flags = u8
GP3, GP4 order:
  0x01 numerator = i8 (1..32 else E-IMP-003 "time signature out of range at offset {n}")
  0x02 denominator = i8 (1,2,4,8,16,32,64 else E-IMP-003)
  repeatOpen = flags & 0x04
  0x08 closeByte = u8; plays = closeByte + 1 (GP3, GP4: the byte counts additional repeats; 0 -> plays 1 with W-GP-REPEAT-ZERO info)
  0x10 alt = u8; GP3: altMask = alt in 1..8 ? 1 << (alt - 1) : 0 (ending number); GP4: altMask = alt (bitmask)
  0x20 marker: name = IBS (80 chars), color()
  0x40 key = i8 (fifths), type = i8 (0 major, 1 minor; GP3 ignores type: major)
  0x80 doubleBar (no data)
GP5 order:
  0x01 numerator = i8; 0x02 denominator = i8; repeatOpen = flags & 0x04
  0x08 closeByte = u8; plays = closeByte (GP5 stores plays); 0 -> plays 1 with W-GP-REPEAT-ZERO
  0x20 marker (IBS + color)
  0x10 altMask = u8 (bitmask)
  0x40 key = i8, type = i8
  if flags & 0x03: beams = 4 x u8 (eighth-note grouping; stored, unused)
  if !(flags & 0x10): u8 (blank)
  tripletFeel = u8 (0 none, 1 eighth, 2 sixteenth) -> any non-zero -> W-GP-TRIPLET-FEEL (info, once)
plays = clamp(plays, 1, LIMITS.maxRepeatPlays); numerator/denominator persist from the previous header when absent (first header defaults 4/4)
REPEAT_CLOSE_OFFSET = {3: 1, 4: 1, 5: 0} is the one constant to change if LT tests with real files show the opposite convention (6.13.9).
```

6.13.4.5 Track headers (`trackCount` records)

```text
GP5: if index == 0 or v.is5 and !v.is51: u8 (blank)            // GP5.00: before every track; GP5.10: before the first only
flags = u8  (0x01 drums, 0x02 twelve-string, 0x04 banjo, GP5: 0x08 visible, 0x10 solo, 0x20 mute, 0x40 RSE, 0x80 indicate tuning)
name = byteString(40) (128-char cap irrelevant; 40 max)
stringCount = i32 (1..7 else E-IMP-003 "track header out of range at offset {n}")
tuning = 7 x i32 (each 0..127 for the first stringCount entries else E-IMP-003)
port = i32 (1..4 else E-IMP-003); channel = i32 (1..16 else E-IMP-003); effectChannel = i32 (1..16 else E-IMP-003)
frets = i32 (1..LIMITS.maxFrets else E-IMP-003); capo = i32 (0..frets else W-GP-CAPO-RANGE warn, clamp 0..24); color()
GP5 tail:
  flags2 = i16; autoAccent = u8; bank = u8; humanize = u8; 3 x i32; 12 bytes; instrument = i32; unknown = i32; soundBank = i32
  GP5.00: effectNumber = i16; 1 byte       | GP5.10: effectNumber = i32; 4 x i8 EQ; IBS effect name; IBS effect category
after all tracks (GP5): skip 1 (5.00) or 2 (5.10) bytes
derived: isDrums = (flags & 0x01) || ((channel - 1) % 16 == 9); midiChannel = (channel - 1) % 16; port > 1 -> W-GP-PORT-COLLAPSED (info, once)
         ch = channels[(port - 1) * 16 + (channel - 1)]; program = ch.program; volumeCc = max(0, ch.volume * 8 - 1); panCc = max(0, ch.balance * 8 - 1)
```

The sanity ranges are the desynchronization detector for the GP5 tail: a wrong skip
length makes the next track's `stringCount` or `port` land on arbitrary bytes, which fails
these checks with a precise offset (UT-13-08).

6.13.4.6 Beats (`measureCount` x `trackCount`, then per voice)

```text
for m in 0..measureCount-1:
  for t in 0..trackCount-1:
    voices = v.is5 ? 2 : 1
    for voice in 0..voices-1:
      beatCount = i32 (0..LIMITS.maxBeatsPerVoice else E-IMP-003 "beat count out of range at offset {n}")
      for b in 0..beatCount-1: beats.push(readBeat())
    GP5: lineBreak = u8
    measures[m][t] = {voices, complete:true}
  every LIMITS.yieldEveryMeasures measures or LIMITS.yieldEveryNotes notes: yield (progress fraction = (m + 1) / measureCount)
on EOF anywhere in this loop: ctx.truncatedAt = r.pos; warnings W-GP-TRUNCATED (warn, "file ends in measure {n} of {value}"); measures from m onward are absent; stop

readBeat():
  flags = u8
  status = (flags & 0x40) ? (u8 == 2 ? 'rest' : 'empty') : 'note'      // 0 empty, 2 rest; other values -> 'rest' with W-GP-BEAT-STATUS (info)
  code = i8 (-2..4 else E-IMP-003 "beat duration out of range at offset {n}")
  tuplet = (flags & 0x20) ? i32 : 0 (allowed 3,5,6,7,9,10,11,12,13; other -> W-GP-TUPLET-UNKNOWN warn, treated as 0)
  units = durationUnits(code, flags & 0x01, tuplet)
  if flags & 0x02: chordName = readChord()                     (6.13.4.7)
  if flags & 0x04: text = IBS (1000 chars)
  if flags & 0x08: effects = readBeatEffects()
  if flags & 0x10: mix = readMixChange()
  stringFlags = u8
  for i in 0..6: if (stringFlags >> (6 - i)) & 1: if i < track.stringCount: notes.push(readNote(i)) else: readNote(i) and drop with W-GP-STRING-INDEX (warn)
  GP5: flags2 = i16; if flags2 & 0x0800: u8
  notes++ per note; notes > LIMITS.maxNotes -> E-IMP-004

durationUnits(code, dotted, tuplet):
  base ticks: -2 -> 3840, -1 -> 1920, 0 -> 960, 1 -> 480, 2 -> 240, 3 -> 120, 4 -> 60
  units = base * 18018; if dotted: units = units * 3 / 2 (exact: 18018 is even)
  if tuplet: normal = {3:2, 5:4, 6:4, 7:4, 9:8, 10:8, 11:8, 12:8, 13:8}[tuplet]; units = units * normal / tuplet
  (18018 = 2 * 7 * 9 * 11 * 13, so every division above is exact; units is an integer)
  tick(units) = round(units / 18018)
```

A beat position inside a measure is the integer sum of the preceding beats' `units`; the
beat tick is `measureStartTick + round(posUnits / 18018)`; the note duration is
`max(1, round((posUnits + units) / 18018) - round(posUnits / 18018))`.

6.13.4.7 Chord diagrams (skipped except the name)

| Version | Layout |
|---|---|
| GP3 | `header = u8`; `header & 0x01 == 0` (old): `name = IBS`, `firstFret = i32`, if `firstFret != 0`: 6 x `i32`; else (new): skip 25, `name = byteString(34)`, `firstFret = i32`, 6 x `i32`, skip 36 |
| GP4 | `header = u8`; old as GP3; new: skip 16, `name = byteString(21)`, skip 4, `firstFret = i32`, 7 x `i32`, skip 32 |
| GP5 | no header byte: skip 17, `name = byteString(21)`, skip 4, `firstFret = i32`, 7 x `i32`, skip 32 |

A non-empty chord name becomes a TextEvent of type `text` at the beat tick (W-GP-CHORD-NAME-ONLY
info once: "chord diagrams are imported as names only").

6.13.4.8 Beat effects, mix table, notes, note effects

```text
readBeatEffects():
  GP3: f1 = u8; vibrato = f1 & 0x03; naturalHarm = f1 & 0x04; artHarm = f1 & 0x08 (apply to all notes of the beat as harmonic type); fadeIn = f1 & 0x10
       if f1 & 0x20: type = u8; value = i32; type == 0 -> tremoloBar = {points: [{position:0, value:0}, {position:30, value}, {position:60, value:0}]}; else tap/slap/pop by type 1/2/3 (flags only)
       if f1 & 0x40: strokeDown = u8, strokeUp = u8 (ignored, W-GP-STROKE-IGNORED info once)
  GP4, GP5: f1 = u8; f2 = u8; vibrato = f1 & 0x03; naturalHarm = f1 & 0x04; artHarm = f1 & 0x08; fadeIn = f1 & 0x10
       if f1 & 0x20: type = u8 (1 tap, 2 slap, 3 pop)
       if f2 & 0x04: tremoloBar = readBend()
       if f1 & 0x40: strokeDown = u8, strokeUp = u8
       if f2 & 0x02: pickstroke = u8
       rasgueado = f2 & 0x01
readBend(): type = i8; value = i32; count = i32 (0..LIMITS.maxBendPoints else E-IMP-003); points: count x {position = i32 (clamp 0..60), value = i32, vibrato = u8}
readMixChange():
  GP3, GP4: instrument = i8; volume = i8; balance = i8; chorus = i8; reverb = i8; phaser = i8; tremolo = i8; tempo = i32
            for each of volume, balance, chorus, reverb, phaser, tremolo with value >= 0: duration = u8; if tempo >= 0: tempoDuration = u8
            GP4: allTracks = u8
  GP5:      instrument = i8; skip 16; volume = i8; balance = i8; chorus = i8; reverb = i8; phaser = i8; tremolo = i8; tempoName = IBS; tempo = i32
            durations as above; if tempo >= 0: tempoDuration = u8; if v.is51: hideTempo = u8
            allTracks = u8; skip 1; if v.is51: IBS; IBS
  result: {program: instrument >= 0 ? instrument : null, volumeCc: volume >= 0 ? max(0, volume * 8 - 1) : null, panCc likewise from balance,
           tempo: tempo > 0 ? clamp(tempo, 1, 999) : null, tempoDuration}
readNote(stringIndex):
  flags = u8
  GP3, GP4: if flags & 0x20: type = u8 (1 normal, 2 tied, 3 dead; other -> normal with W-GP-NOTE-TYPE info)
            if flags & 0x01: durationCode = i8, tuplet = i8 (time-independent duration: ignored, W-GP-NOTE-DURATION info once)
            if flags & 0x10: dyn = u8 (1..9; else 6) -> velocity = velocityFromGp(dyn)   else velocity 95
            if flags & 0x20: fret = i8 (0..LIMITS.maxFrets else W-GP-FRET-RANGE warn, clamp)
            if flags & 0x80: leftFinger = i8, rightFinger = i8 (ignored)
            if flags & 0x08: effects = readNoteEffects()
  GP5:      if flags & 0x20: type = u8
            if flags & 0x10: dyn = u8 -> velocity
            if flags & 0x20: fret = i8
            if flags & 0x80: leftFinger = i8, rightFinger = i8
            if flags & 0x01: durationPercent = f64 (stored; applied as duration * percent when 0 < percent <= 1, W-GP-DURATION-PERCENT info once)
            flags2 = u8 (0x02 swap accidentals; ignored)
            if flags & 0x08: effects = readNoteEffects()
  accent = (flags & 0x40) ? 15 : 0; GP5: (flags & 0x02) ? 25 : accent; ghost = flags & 0x04 -> velocity = max(1, velocity - 20)
  velocityFromGp(dyn) = min(127, 16 * dyn - 1)   // 1 -> 15 (ppp), 6 -> 95 (f, default), 8 -> 127, 9 -> 127
readNoteEffects():
  GP3: f = u8; if f & 0x01: bend = readBend(); hammer = f & 0x02; slide = (f & 0x04) ? 2 : null (legato); letRing = f & 0x08
       if f & 0x10: grace = {fret = u8, dyn = u8, transition = u8, durationCode = u8, onBeat:false, dead:false}
  GP4, GP5: f1 = u8; f2 = u8
       if f1 & 0x01: bend = readBend()
       if f1 & 0x10: grace = {fret = u8, dyn = u8, transition = u8, durationCode = u8}; GP5: gflags = u8 (0x01 dead, 0x02 onBeat)
       if f2 & 0x04: tremoloPicking = u8
       if f2 & 0x08: slide = i8 (GP4: -2 in from above, -1 in from below, 1 shift, 2 legato, 3 out down, 4 out up; GP5: bitmask 0x01 shift, 0x02 legato, 0x04 out down, 0x08 out up, 0x10 in below, 0x20 in above)
       if f2 & 0x10: harmonicType = i8 (1 natural, 2 artificial, 3 tapped, 4 pinch, 5 semi); GP5: type 2 -> 3 bytes (semitone, accidental, octave); type 3 -> 1 byte (right-hand fret)
       if f2 & 0x20: trill = {fret = i8, period = i8}
       hammer = f1 & 0x02; letRing = f1 & 0x08; staccato = f2 & 0x01; palmMute = f2 & 0x02; vibrato = f2 & 0x40
```

6.13.4.9 Conversion rules (beat and note -> model events)

| Source | Model effect |
|---|---|
| normal note | `NoteEvent(tick, dur, pitch, velocity + accent, channel)`; `pitch = tuning[string] + capo + fret` (drums: `pitch = fret`); `x.tab = {string: string + 1, fret}`; pitch outside 0..127 -> clamp, W-GP-PITCH-CLAMPED (warn) |
| rest or empty beat | advances the position only |
| dead note (type 3 or grace dead) | velocity 20, `dur = min(dur, 120)`, art `dead` |
| tied note (type 2) | the most recent NoteEvent on the same track with the same `x.tab.string` whose end equals this beat's start (tolerance 1 tick) is extended by `dur`; none -> plain note with W-GP-TIE-UNMATCHED (info) |
| let ring | after the track is complete: `dur = min(nextNoteStartOnSameString - tick, dur + 3840)`; no next note -> `dur + 3840`; art `let-ring` |
| palm mute | `velocity = max(1, velocity - 20)`, `dur = max(1, round(dur * 0.6))`, art `palm-mute` |
| staccato | `dur = max(1, round(dur * 0.5))`, art `staccato` |
| durationPercent (GP5) | `dur = max(1, round(dur * percent))` when `0 < percent < 1` |
| hammer-on or pull-off flag | art `hammer-pull` (direction is implied by the next note's pitch) |
| slide | art `slide:<shift or legato or out-down or out-up or in-below or in-above>` per the version's encoding (several for GP5 bitmasks) |
| harmonics | natural: `pitch = tuning[string] + capo + harmonicOffset('natural', fret)`; others: `pitch += 12`; art `harmonic:<type>`; W-GP-HARMONIC-APPROX (info, once) for artificial, tapped, pinch, semi and for natural frets outside the table |
| harmonicOffset natural | fret 12 -> +12; 7 or 19 -> +19; 5 or 24 -> +24; 4, 9 or 16 -> +28; 3 -> +31; other -> +12 (approx) |
| bend (note) | `PitchBendEvent`s: for each point `bend(tick + round(position / 60 * dur), v)` with `v = clamp(round(value / 50 / 2 * 8191), -8192, 8191)` (value 50 = one semitone, range 2 semitones); if the last point's value != 0: `bend(tick + dur, 0)`; `value / 50 > 2` -> W-GP-BEND-RANGE (info, once); art `bend` |
| tremolo bar (beat) | the same conversion applied once per beat (not per note) on the track's channel; art `tremolo-bar` on the beat's notes |
| grace | `NoteEvent(graceTick, 120, graceFret -> pitch, velocityFromGp(dyn))`: onBeat false -> `graceTick = max(prevBeatTick, tick - 120)`, and the previous note on that string is shortened to end at `graceTick` when it overlaps; onBeat true (GP5) -> `graceTick = tick`, the main note starts at `tick + 120` with `dur - 120` (min 1); art `grace`; transition stored as art `grace:<none or slide or bend or hammer>` |
| trill | art `trill:<fret>:<period>`; W-GP-TRILL-UNSUPPORTED (info, once): "played as one note" |
| tremolo picking | art `tremolo-picking`; W-GP-TREMOLO-PICKING (info, once) |
| vibrato (note or beat) | art `vibrato` |
| tap, slap, pop | art `tap`, `slap`, `pop` |
| fade in, stroke, pickstroke, rasgueado | ignored; W-GP-STROKE-IGNORED (info, once) covers stroke, pickstroke and rasgueado; fade in silently ignored |
| accent, heavy accent | velocity +15 or +25 (clamped 127), art `accent` or `marcato` |
| mix change | `program != null` -> `ProgramEvent(tick, program, 0, 0, channel)`; `volumeCc` -> `ControlEvent(tick, 7, v)`; `panCc` -> `ControlEvent(tick, 10, v)`; `tempo` -> TempoMap entry at `tick` (`usPerQuarter = round(60e6 / tempo)`); `tempoDuration > 0` -> W-GP-TEMPO-RAMP-IGNORED (info) |
| beat text | `TextEvent(tick, 'text', text)` |
| chord name | `TextEvent(tick, 'text', name)` |
| measure marker | `Marker {tick: measureStart, label, kind:'section'}`; repeated occurrences get ` (2)`, ` (3)` suffixes |
| measure key change | KeyMap entry `{tick, fifths, mode}` |
| lyrics line 1 | tokens (split on whitespace; `-` kept) assigned in order to the note-bearing beats of voice 0 of track `lyrics.trackIndex` from measure `startMeasure` (1-based); each token -> `TextEvent(tick, 'lyric', token)`; lines 2-5 -> W-GP-LYRIC-LINES (info); `trackNumber` out of range -> W-GP-LYRIC-TRACK (info) |
| channel table volume and balance | `ControlEvent(0, 7, volumeCc)` and `ControlEvent(0, 10, panCc)` at tick 0 of each track |
| header tempo | TempoMap entry at tick 0 |
| header key (and GP5 header type) | KeyMap entry at tick 0 (`mode` major for GP3; GP4 and GP5 header key is major, measure-header key types give minor) |
| triplet feel | not applied; W-GP-TRIPLET-FEEL (info) |
| directions (GP5) | not expanded; W-GP-NAV-UNSUPPORTED (warn) |

6.13.4.10 Repeat expansion and emission

```text
1. headers -> infos {repeatOpen, plays, altMask}; {order, capped} = util.expandRepeats(infos):
   same structure as 6.12.4.6 step 1 with: endingStart test = altMask != 0 and !(altMask & (1 << (pass - 1)));
   an alternative-ending span ends at the next header with repeatOpen, a backward repeat (inclusive), or a header whose altMask is non-zero and different;
   backward repeat: total = plays; a header with altMask != 0 and bit (total) set raises total to the highest set bit + 1 (max 16)
   capped -> W-GP-REPEAT-CAP (warn)
2. measureLen[m] = ticksPerBar(headers[m]) = 960 * 4 / denominator * numerator; expandedStart[k] = sum of measureLen[order[0..k-1]]
3. for k, m = order[k], base = expandedStart[k]: for each track t with measures[m][t]: for each voice: pos = 0 units:
     for beat: tick = base + round(pos / 18018); dur = round((pos + beat.units) / 18018) - round(pos / 18018)
               emit per 6.13.4.9; pos += beat.units
     pos / 18018 > measureLen[m] -> W-GP-MEASURE-OVERFULL (info, once with count); the next measure still starts at base + measureLen[m]
   header marker and key change for m emitted at base; mix-table tempo entries at their ticks
4. Post passes per track: let-ring extension (needs the next same-string note), tie extension (done inline during emission because ties
   refer to the previous note), sort with Model.insertEvents, clamp overlapping same-pitch notes through pairNotes-equivalent rule:
   notes are inserted directly (they already carry durations), and Model.validate catches any invariant breach as E-IMP-003 'internal'
5. yield every LIMITS.yieldEveryMeasures expanded measures
```

Materialization: `Track.create({name, channel: midiChannel, program, isDrums, color})` per
`TrackDef` (GP5 flags `mute` and `solo` map to `mix.mute` and `mix.solo`); `song.title`,
`song.artist` from info (`artist` else `music` else `words`), `song.x.info = {subtitle,
album, words, music, copyright, tab, instructions, notices}`; `source.version` = the
`SUPPORTED_VERSIONS` label; `song.durationTicks = Song.computeDuration(song)`.

6.13.4.11 Warning catalog (`FLM.GuitarPro.WARNINGS`)

| Code | Severity | Message |
|---|---|---|
| W-GP-TRUNCATED | warn | The file ends early in measure {n} of {value}; the measures before it were kept. |
| W-GP-STRING-LENGTH | info | A text field declared a length larger than its block and was clamped. |
| W-GP-TEMPO-RANGE | warn | Tempo {value} is out of range and was clamped to 1-999 BPM. |
| W-GP-KEY-RANGE | warn | Key signature value {value} is out of range; C major is used. |
| W-GP-CHANNEL-RANGE | info | A MIDI channel definition had an invalid program and was reset to piano. |
| W-GP-REPEAT-ZERO | info | A repeat sign with zero repeats was ignored. |
| W-GP-TRIPLET-FEEL | info | Triplet (swing) feel is not applied; notes play straight. |
| W-GP-NAV-UNSUPPORTED | warn | Directions (coda, segno, da capo, fine) are not expanded; the song plays through once. |
| W-GP-CAPO-RANGE | warn | Capo position {value} is out of range and was clamped. |
| W-GP-PORT-COLLAPSED | info | Tracks on MIDI ports 2-4 were mapped onto the 16 channels of port 1. |
| W-GP-BEAT-STATUS | info | An unknown beat status was treated as a rest. |
| W-GP-TUPLET-UNKNOWN | warn | Tuplet value {value} is not supported; the beat keeps its plain duration. |
| W-GP-STRING-INDEX | warn | {n} notes refer to strings the track does not have and were dropped. |
| W-GP-CHORD-NAME-ONLY | info | Chord diagrams are imported as names only. |
| W-GP-STROKE-IGNORED | info | Strum direction, pick stroke and rasgueado marks are not applied ({n}). |
| W-GP-NOTE-TYPE | info | An unknown note type was treated as a normal note. |
| W-GP-NOTE-DURATION | info | Time-independent note durations are not supported; beat durations are used. |
| W-GP-FRET-RANGE | warn | {n} notes had fret numbers out of range and were clamped. |
| W-GP-DURATION-PERCENT | info | Note length percentages were applied to {n} notes. |
| W-GP-PITCH-CLAMPED | warn | {n} notes were outside MIDI pitch range and were clamped. |
| W-GP-TIE-UNMATCHED | info | {n} tied notes had no note to tie to and were played as new notes. |
| W-GP-HARMONIC-APPROX | info | Artificial, tapped and pinch harmonics are approximated one octave up ({n}). |
| W-GP-BEND-RANGE | info | Bends larger than two semitones were clamped. |
| W-GP-TRILL-UNSUPPORTED | info | Trills are played as single notes ({n}). |
| W-GP-TREMOLO-PICKING | info | Tremolo picking is played as single notes ({n}). |
| W-GP-TEMPO-RAMP-IGNORED | info | Gradual tempo changes are applied immediately ({n}). |
| W-GP-LYRIC-LINES | info | Only the first lyric line is imported. |
| W-GP-LYRIC-TRACK | info | The lyrics refer to a track that does not exist and were skipped. |
| W-GP-REPEAT-CAP | warn | Repeats expand to more than {n} measures; expansion stopped there. |
| W-GP-MEASURE-OVERFULL | info | {n} measures contain more beats than their time signature allows. |

#### 6.13.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Unsupported version (GP1, GP2, clipboard) | version string | nothing | user re-saves as GP5 | none | E-IMP-006 text (6.13.4.2) | n/a | aborted | UT-13-02 |
| GP6 or GP7 file | M-14 identification using `UNSUPPORTED_SIGNATURES` | nothing | user exports GP5 | none | Part 1.5 text via E-IMP-006 | n/a | aborted | UT-14-01 |
| File ends inside the header | EOF before counts | nothing | no | none | E-IMP-003 "ends inside its header" | n/a | aborted | UT-13-27 |
| Counts over limits | pre-allocation | nothing | no | none | E-IMP-004 | n/a | aborted | UT-13-28 |
| Desynchronized layout (wrong skip, corrupt bytes) | range checks on stringCount, port, channel, frets, duration code, beat count, string lengths | measures before the failing one | no | none | E-IMP-003 with offset; message "The file is damaged or uses an unexpected layout at byte {n}." | n/a | aborted | UT-13-08, 27 |
| File truncated inside the measures | EOF in the beat loop | all complete measures | no | none | W-GP-TRUNCATED | partial song | n/a | UT-13-26 |
| Unsupported effects | per-effect flags | note plays plain | no | none | W-GP-* info warnings | approximations documented | n/a | UT-13-21, 22 |
| Directions, triplet feel | header | linear, straight playback | no | none | W-GP-NAV-UNSUPPORTED, W-GP-TRIPLET-FEEL | plays once through | n/a | UT-13-24 |
| Repeat convention wrong for real files (6.13.9) | LT tests | n/a | n/a | none | n/a | n/a | change `REPEAT_CLOSE_OFFSET` | LT (Part 12) |
| Budget exceeded | deadline at yield | discarded | retry | none | E-IMP-005 | n/a | aborted | UT-13-29 |

#### 6.13.6 Limits and performance notes

- A GP5 file is small (a 300-measure, 8-track song is under 300 KB); parse time is dominated
  by object creation. Target: 10,000 measures x 8 tracks within 2 s.
- Yields every 50 measures keep the UI responsive during the beat loop; expansion yields the
  same way.
- The exact-fraction scheme uses integers below 2^40 (18018 x 3840 x 256 beats) and never
  loses precision; `round` happens once per emitted tick.
- Memory: beats are retained for all measures until emission (expansion needs them); for
  the limits above this is under 100 MB.

#### 6.13.7 Spec coverage

B 15.1 (steps 3-6), B 15.4 (specific versions and extensions identified; own parser with
declared boundaries; no universal-support claim; string and fret, tuning, capo, rhythmic duration, bends,
slides, hammer-ons and pull-offs, palm muting, harmonics, track and instrument information
preserved; unsupported notation features reported), B 15.7, B 23.1, B 25.3 (valid Guitar Pro
files for each claimed version; files with unsupported features); E 3.3 (alternate tuning
and capo, unsupported effects, unsupported version, notation-to-event loss reported, repeats
and alternate endings), E 10 item 11; I 6.4; P 11 (Guitar Pro support limited to declared
versions; unsupported events produce warnings).

#### 6.13.8 Unit tests

`src/91-test-guitarpro.js`, group `guitarpro`. The test file contains `gpb`, a byte builder
that writes the 6.13.4 layouts for all three versions (`gpb.file({version:'5.10', info,
tempo, key, channels, headers:[...], tracks:[...], measures:[[[beats]]]})`, with beat objects
`{dur:0, dotted:false, tuplet:0, rest:false, text, chord, effects, mix, notes:[{string, fret,
type, dyn, effects}]}`); it is independent of `tools/make-corpus.mjs` but follows the same
layout tables, so a layout error shows up as a mismatch against the FT corpus files in the
`files` group. `song()` and `ids()` as in 6.10.8.

| UT | Name | Setup | Assertion |
|---|---|---|---|
| UT-13-01 | identify versions | the six supported strings; `'FICHIER GUITAR PRO v2.21'`; `'FICHIER GUITARE PRO v1.02'`; `'CLIPBOARD GUITAR PRO 5.00'`; `'MThd'` | `supported` true with labels `GP3 v3.00` ... `GP5 v5.10`; false for the three others; null for MThd |
| UT-13-02 | unsupported version error | `parse` on a v2.21 block | E-IMP-006, message contains `'Guitar Pro 1 or 2'`; clipboard -> message contains `'clipboard'` |
| UT-13-03 | info strings | GP5 with title, artist, album, 2 notices | `song.title`, `song.artist`; `song.x.info.album`; `notices.length` 2; GP3 with author -> `artist` from author |
| UT-13-04 | tempo, key, feel | GP3 tempo 90 key 2; GP4 key -3 octave 0; GP5 hideTempo | tempoMap 666667 us; keyMap fifths 2 / -3; GP4 tripletFeel true -> W-GP-TRIPLET-FEEL |
| UT-13-05 | channel table | channel 3 program 25 volume 13 balance 8; track on channel 3 | `track.program` 25; CC7 103 and CC10 63 at tick 0 |
| UT-13-06 | measure headers | 3/4 at m0, 6/8 at m2, marker `'Verse'` at m1, key change -1 minor at m2, double bar | meterMap entries at tick 0 (3/4) and 5760 (6/8, start of m2 = 2 x 2880); marker tick 2880 (start of m1); keyMap entry fifths -1 minor at 5760; `doubleBar` has no effect on events |
| UT-13-07 | tuning and capo | standard tuning, capo 2, note string 1 fret 3; string 6 fret 0 | pitches 69 and 42; `x.tab` `{string:1, fret:3}` and `{string:6, fret:0}`; bit mapping from bit 6 |
| UT-13-08 | GP5 track tail | two tracks in 5.00 and in 5.10 with effect strings | both track names read; a fixture with one byte removed from the tail -> E-IMP-003 with `.offset` inside track 2 |
| UT-13-09 | durations | beats: quarter, dotted eighth, 16th, eighth triplet x3, 16th quintuplet x5, 32nd septuplet x7 | ticks 0, 960, 1680, 1920, 2240, 2560, 2880, 3072, ... exact where exact; septuplet positions round to the nearest tick with total 480; `durationUnits(1, false, 3)` 480 x 18018 x 2 / 3 |
| UT-13-10 | rests and voices | GP5 voice 1 with notes, voice 2 with an empty whole beat then rests | voice 2 advances without events; notes from both voices present when voice 2 has a note |
| UT-13-11 | chord diagram skips | beats with chord diagrams in GP3 old and new, GP4 old and new, GP5; each followed by a beat with text `'after'` | text `'after'` parsed at the right tick in all five cases; chord names become TextEvents |
| UT-13-12 | beat text | text `'Solo'` | TextEvent type text at the beat tick |
| UT-13-13 | mix table | GP4 tempo 140 at measure 2 beat 1 with duration 2; GP5.10 mix change with volume 10 and instrument 30 | tempoMap entry at the beat tick 428571 us; W-GP-TEMPO-RAMP-IGNORED; CC7 79; ProgramEvent 30 |
| UT-13-14 | bends | points (0,0), (30,100), (60,100) on a quarter | bends 0 at tick, 8191 at +480, 8191 at +960 then 0 at +960 (reset); value 150 -> clamped and W-GP-BEND-RANGE |
| UT-13-15 | tremolo bar | GP5 beat tremolo bar (0,0),(60,-100) with two notes | one bend sequence for the beat; both notes carry art `tremolo-bar` |
| UT-13-16 | palm mute and staccato | quarter notes with palm mute; with staccato | velocity 75 (95 - 20), durTicks 576; durTicks 480 |
| UT-13-17 | dead note | type 3 on a half note | velocity 20, durTicks 120, art `dead` |
| UT-13-18 | tied notes | quarter then tied quarter on the same string; tied note with no predecessor | one note durTicks 1920; second case: plain note plus W-GP-TIE-UNMATCHED |
| UT-13-19 | let ring | let-ring quarter followed two beats later by a note on the same string; let ring at the end of the track | durTicks 1920; final note dur + 3840 |
| UT-13-20 | grace | GP4 grace fret 5 dyn 4 before a quarter at tick 1920; GP5 on-beat grace | grace at 1800 dur 120 velocity 63; main note unchanged; on-beat: grace at 1920, main at 2040 with dur 840 |
| UT-13-21 | harmonics | natural at fret 12, 7, 5, 4, 3, 2 on open string 1 (64) | pitches 76, 83, 88, 92, 95, 76 with W-GP-HARMONIC-APPROX for fret 2; artificial -> fret pitch + 12 |
| UT-13-22 | art flags | hammer-on, GP4 slide 2, GP5 slide 0x05, vibrato, tap | `x.art` contains `hammer-pull`, `slide:legato`, (`slide:shift`, `slide:out-down`), `vibrato`, `tap` |
| UT-13-23 | drum track | track flag 0x01 on channel 10 with frets 36 and 38 | `isDrums`; pitches 36, 38; channel 9 |
| UT-13-24 | repeats | GP4: open at 0, close byte 1 at 1 -> plays 2; GP5 close byte 3 -> plays 3; alternatives mask 0x01 at m1, 0x02 at m2; GP5 directions coda = 4 | orders `[0,1,0,1]`, `[0,1,0,1,0,1]`, `[0,1,0,2]`; W-GP-NAV-UNSUPPORTED |
| UT-13-25 | lyrics | GP5 lyrics track 1 start measure 2, text `'la la-la'` | lyric TextEvents on the first three note beats from measure 2 |
| UT-13-26 | truncated | GP5 fixture cut in measure 3 of 4 | 2 measures of events; W-GP-TRUNCATED mentions measure 3 of 4; no throw |
| UT-13-27 | desync detection | stringCount 9; file ending inside the channel table | E-IMP-003 with `.offset` equal to the stringCount field; E-IMP-003 "ends inside its header" |
| UT-13-28 | limits | measureCount 100000; trackCount 200; notices 65 | E-IMP-004 in each case before allocation (no measure read: assert `.offset` <= counts position + 8) |
| UT-13-29 | parseAsync | 120-measure fixture; `budgetMs:0` | `onProgress` called >= 2 times; equals `parse`; budget 0 -> E-IMP-005 |
| UT-13-30 | determinism and corpus | parse the same bytes twice; when `FLM.SelfTest.corpus.has('gp5-basic.gp5')` also parse it | deep equal; corpus file yields the tracks and note count authored in its manifest `expect` (skipped with message when the corpus is not loaded) |
| UT-13-31 | velocity table | notes with dyn 1..9 | velocities 15, 31, 47, 63, 79, 95, 111, 127, 127; absent -> 95; accent +15; heavy +25 |
| UT-13-32 | ports | track port 2 channel 10 | `isDrums` true; `channel` 9; W-GP-PORT-COLLAPSED |

#### 6.13.9 Implementation notes and browser quirks

- Repeat count convention: GP3 and GP4 store the number of additional repeats and GP5 the
  number of plays (6.13.4.4). This is the single most likely layout detail to be wrong for
  real exports; it is isolated in `REPEAT_CLOSE_OFFSET` and the LT test for GP imports
  (Part 12) plays a real file with an "x2" repeat and listens for two passes. The GP3
  alternate-ending byte (ending number rather than bitmask) is the second such point.
- The GP5 track tail and GP5 measure-header ordering (marker before alternate ending) are
  guarded by the desync detectors: a wrong byte count throws E-IMP-003 with an offset
  instead of producing garbage.
- `f64` reads use a `DataView` on an 8-byte scratch buffer (little-endian), the only place
  a `DataView` is used in the parsers.
- Windows-1252 decoding is by table; the 0x80-0x9F mappings matter for typographic quotes
  and dashes in titles. `decodeText` keeps the decoded Unicode characters (only this plan is
  ASCII-restricted); imported titles may contain any Unicode and are shown via `textContent`.
- Strings are numbered from the highest-pitched string (string 1 = `tuning[0]`), and the
  per-beat string bit mask is read from bit 6 down to bit 0.
- All multi-byte integers are little-endian (the Reader's `le` family).

### 6.14 M-14 Import (`src/14-import.js`, `FLM.Import`)

#### 6.14.1 Responsibilities and non-goals

M-14 is the import pipeline of B 15.1: validate the input, identify the format by content,
dispatch to the registered adapter (M-10, M-12, M-13, or the audio adapter inside M-14),
normalize the resulting Songs, build the `InspectionReport` that SCR-ImportInspect renders,
emit progress, and hand the report to the caller. It owns the format identification table,
the adapter registry, the `E-IMP-*` error catalog, the `W-IMP-*` warnings, the audio
adapter (`decodeAudioData` to a `kind:'audio'` Track with metadata only), the recommended
playable track heuristic, the chord-complexity and simplification flags, the default
selection when a file has more than 32 tracks, the `COMPATIBILITY` data that Part 8.7
publishes as `docs/COMPATIBILITY.md`, and the rule that an import never touches the current
project: `importFile` returns a report holding new Songs and nothing else changes until
SCR-ImportInspect confirms DLG-ImportReplace and calls `Project.fromSong` or
`Project.Catalog.register` (Part 04 invariant S-12).

Non-goals: no parsing of any format (adapters), no UI (M-27 renders the report), no file
picking or drag-and-drop (M-16 `pickFile`, `readFile`), no chart generation (M-08; the report
calls `ChartGenerator.simplificationReport` for flags only), no persistence, no audio
playback (M-05 plays audio tracks), no transcription of audio to notes (never claimed; Part
1.5 wording).

Spec grounding: B 7.5, 15.1, 15.5, 15.7, 23.1, 24; E 3.3, 3.4, 11 (file-import failure must
not corrupt the current project); I 6.1, 6.2, 6.4, 16.2; P 11, 19.

#### 6.14.2 Public API

```js
FLM.Import = {
  LIMITS: {
    maxFileBytes: 25 * 1024 * 1024,          // MIDI, MusicXML, Guitar Pro (E-IMP-001)
    maxAudioFileBytes: 100 * 1024 * 1024,    // audio (E-IMP-001)
    maxDecodedAudioBytes: null,              // computed at init: 192 MB when Caps.maxTouchPoints === 0, else 64 MB (E-IMP-004)
    maxAudioSeconds: 7200,                   // Part 5.1.2 AudioRef (E-IMP-004)
    budgetMs: 5000,                          // whole pipeline from importFile start (parse + normalize + inspect)
    normalizeYieldEvery: 20000,              // events between yields in normalize
    maxWarnings: 500,                        // kept per song (Part 5.1.1)
    largeFileNoticeBytes: 8 * 1024 * 1024,   // W-IMP-LARGE-FILE
    maxTracksKept: 32,                       // Model limit; selection UI above it
    chordLimit: 16,                          // W-IMP-CHORD-LIMIT
    progressMinIntervalMs: 100               // import.progress throttle (10 Hz)
  },
  ERRORS: { /* 'E-IMP-001': {text:'...', class:'recoverable'}, ... table 6.14.5 */ },
  WARNINGS: { /* W-IMP-* table 6.14.4.8 */ },

  /** Content-first identification (table 6.14.4.2). Never throws; the result carries
   *  `unsupported` when the format is recognized but refused. */
  identify(bytes /* Uint8Array */, fileName /* string */)
    /* -> {format:'midi'|'musicxml'|'guitarpro'|'audio'|'unknown', kind:'notes'|'audio'|null, adapterId:string|null,
           version:string|null, container:'xml'|'mxl'|null, mime:string|null (audio), byExtension:string|null,
           mismatch:boolean, unsupported:{code:string, message:string}|null} */,

  /** Size and name checks before any bytes are read. Throws E-IMP-001 or E-IMP-003 (empty). */
  validateFile(meta /* {name:string, size:int} */) /* -> {name:string (sanitized), size:int, presumedKind:'notes'|'audio'} */,

  /** The pipeline. input: File | Blob (with .name) | {name, bytes:Uint8Array}. Emits import.progress,
   *  then import.done or import.failed. Resolves to the InspectionReport; rejects with Error .code E-IMP-*. */
  importFile(input, opts /* ?{budgetMs:int, syncOffsetMs:int} */) /* -> Promise<InspectionReport> */,
  /** Cancels the running import at its next yield (E-IMP-011). No-op when idle. */
  cancel() /* -> boolean (true when an import was running) */,
  isRunning() /* -> boolean */,

  adapters: {
    /** adapter: {id, format, extensions:[string], parseAsync(bytes, opts, onProgress) -> Promise<ParseResult>, identify(bytes) -> object|null}.
     *  Registering an existing id replaces it (Log info). M-10, M-12, M-13 register themselves at load via this call. */
    register(adapter) /* -> void */,
    list() /* -> [{id, format, extensions}] */,
    for(format) /* -> adapter | null */
  },

  /** Builds the report from normalized songs (also used by tests on hand-made songs). */
  InspectionReport: { build(songs, meta) /* -> InspectionReport */, trackRow(song, track, index) /* -> TrackRow */ },
  recommendTrack(song) /* -> trackId | null (6.14.4.5) */,
  /** Applies the user's selection when a song has overflow tracks (6.14.4.6). Mutates the report's song only. */
  applyTrackSelection(report, trackIds /* [id], length <= 32 */) /* -> Song */,

  // Audio adapter
  decodeAudio(bytes, fileName, onProgress) /* -> Promise<{track:Track, buffer:AudioBuffer, info:AudioInfo}> (E-IMP-008, E-IMP-004) */,
  AudioTrack: {
    attach(trackId, buffer) /* -> void (registry) */, bufferFor(trackId) /* -> AudioBuffer | null */, detach(trackId) /* -> boolean */,
    setSyncOffset(track, ms) /* -> int (clamped -30000..30000; writes track.audioRef.syncOffsetMs) */,
    /** Pure helper for M-05: where in the buffer playback from `tick` starts.
     *  t = tempoMap.ticksToSeconds(tick) - syncOffsetMs / 1000; t >= 0 -> {bufferOffsetS: t, delayS: 0}; t < 0 -> {bufferOffsetS: 0, delayS: -t}. */
    startOffsetSeconds(track, tick, tempoMap) /* -> {bufferOffsetS:number, delayS:number} */
  },
  audioBufferCount() /* -> int */,
  releaseAudio(trackId /* ?string; omitted = all */) /* -> int released */,

  COMPATIBILITY: { /* 6.14.4.9 */ }
};
```

Events emitted (payloads fixed in Part 4.4): `import.progress {stage, fraction, bytesDone,
bytesTotal, events, ms}`, `import.done {report, songs, ms}`, `import.failed {code, message,
format, fileName, stage}`. Consumed: none. Depends on `FLM.Model`, `FLM.Theory` (names),
`FLM.Audio` (`ctx`), `FLM.Mapping` (`ChartGenerator.simplificationReport`), `FLM.Midi`,
`FLM.Zip`, `FLM.MusicXml`, `FLM.GuitarPro`.

```text
InspectionReport {
  id: uid('imp'), fileName, fileSizeBytes, fileHash (8 hex), format, version, container, status: 'Supported'|'Partial'|'Conversion',
  songs: [SongSummary {index, title, trackCount, noteCount, durationTicks}], selectedSong: int, song: Song (the selected one),
  duration: {ticks, seconds, formatted},
  tempo: {bpmStart, bpmMin, bpmMax, changes, source:'file'|'default'},
  meters: [{tick, bar, numerator, denominator}] (<= 50), metersTruncated: boolean, metersSource: 'file'|'default',
  keys: [{tick, bar, fifths, mode, name}] (<= 50), keysSource: 'file'|'default',
  tracks: [TrackRow], overflowTracks: [TrackRow] (tracks beyond the 32nd, 6.14.4.6), trackSelection: [trackId] (default kept set),
  recommendedTrackId: id | null,
  chordComplexity: {maxSimultaneous:int, trackId:id|null, perDifficulty:{beginner, intermediate, advanced, expert: boolean}|null},
  warnings: [ImportWarning] (merged, sorted), warningsDropped: int, warningCounts: {error, warn, info},
  playable: boolean, unplayableReason: string | null,
  audio: AudioInfo | null,   // {durationS, sampleRate, channels, decodedBytes, syncOffsetMs}
  notes: [string],           // informational sentences (6.14.4.7)
  stats: {readMs, parseMs, normalizeMs, inspectMs, totalMs, events, yields}
}
TrackRow { trackId, index, name, kind, program, programName, channel, isDrums, noteCount, eventCount,
           pitchRange: {lo, hi, loName, hiName} | null, polyphonyMax, maxChord, firstNoteTick, bars, density (notes per bar, 1 decimal),
           warnings: [ImportWarning], playable: boolean, recommended: boolean, selected: boolean }
```

#### 6.14.3 Internal state

```text
registry: Map<format, adapter>           // 'midi', 'musicxml', 'guitarpro' (audio is built in)
running: null | {id, cancelled:boolean, stage:string, t0:number, lastProgressAt:number}
audioBuffers: Map<trackId, AudioBuffer>  // the only retained import memory; cleared by releaseAudio and by mode leave (Part 4.7 counts it via audioBufferCount)
```

Invariants: at most one import runs at a time (`E-IMP-016` otherwise); `importFile` never
references `FLM.Project` or `FLM.Storage` (enforced by a UT that spies on the namespaces);
every rejection has emitted exactly one `import.failed`; every resolution exactly one
`import.done`; the input bytes are not retained after the promise settles.

#### 6.14.4 Algorithms

6.14.4.1 Pipeline

```text
importFile(input, opts):
  if running: throw E-IMP-016 (synchronously rejected promise; no events)
  running = {cancelled:false, stage:'validate', t0: performance.now(), lastProgressAt: 0}
  stage = s => { running.stage = s; progress(s, null, 0, size, 0, force=true) }
  try:
    stage('validate')
    meta = validateFile({name: input.name ?? 'import', size: input.size ?? input.bytes.length})      // E-IMP-001, E-IMP-003
    bytes = input.bytes ?? await readBytes(input)                                                      // E-IMP-009 on failure; checks cancelled after
    if bytes.length > LIMITS.largeFileNoticeBytes: warn W-IMP-LARGE-FILE (file-level, info)
    stage('identify')
    id = identify(bytes, meta.name)
    if id.unsupported: throw error(id.unsupported.code, id.unsupported.message)
    if id.format === 'unknown': throw error('E-IMP-002')
    if id.mismatch: warn W-IMP-EXT-MISMATCH (info, names both)
    deadline = running.t0 + (opts.budgetMs ?? LIMITS.budgetMs)
    stage('parse')
    if id.kind === 'audio':
      {track, buffer, info} = await decodeAudio(bytes, meta.name, p => progress('parse', p.fraction, ...))
      song = Model.Song.create({title: stem(meta.name), source: {format:'audio', fileName: meta.name, version: id.mime}})
      Model.Song.addTrack(song, track); result = {format:'audio', version: id.mime, container:null, songs:[song], warnings:[], stats:{...}}
    else:
      adapter = adapters.for(id.format) ?? throw error('E-IMP-002')
      result = await adapter.parseAsync(bytes, {fileName: meta.name, deadline, isCancelled: () => running.cancelled},
                                        p => progress('parse', fractionOf(p), p.bytesDone, bytes.length, p.events))
    stage('normalize')
    hash = Core.fnv1a32(bytes) as 8 lowercase hex
    songs = []; for each s of result.songs: songs.push(await normalizeSong(s, result, meta, hash, deadline))
    stage('inspect')
    report = InspectionReport.build(songs, {fileName: meta.name, size: bytes.length, hash, id, result, audioInfo, stats})
    bus.emit('import.done', {report, songs: songs.length, ms: performance.now() - running.t0})
    return report
  catch (err):
    code = err.code ?? 'E-IMP-003'; message = err.message ?? ERRORS[code].text
    if !err.code: Log.error('import internal', err); err.code = code; err.message = ERRORS['E-IMP-003'].text + ' (' + (err.message || 'internal') + ')'
    bus.emit('import.failed', {code, message: err.message, format: id?.format ?? null, fileName: meta?.name ?? '', stage: running.stage})
    Core.ErrorReporter.report(code, err, {module:'Import', stage: running.stage, fileName: meta?.name, userMessage: ''})   // no toast: SCR-ImportInspect shows the error state (Part 4.9)
    throw err
  finally: running = null; bytes = null
progress(stage, fraction, bytesDone, bytesTotal, events, force):
  now = performance.now(); if !force and now - running.lastProgressAt < LIMITS.progressMinIntervalMs: return
  running.lastProgressAt = now; bus.emit('import.progress', {stage, fraction, bytesDone, bytesTotal, events, ms: now - running.t0})
readBytes(input): try `new Uint8Array(await input.arrayBuffer())`; if arrayBuffer is missing (older Safari): FileReader.readAsArrayBuffer wrapped in a Promise; any failure -> E-IMP-009
cancel(): if running: running.cancelled = true (adapters throw E-IMP-011 at their next yield; normalize checks the flag at each yield); return !!running
```

Checking the deadline inside normalize and inspect: both check `performance.now() > deadline`
at every yield and throw E-IMP-005; the report build runs synchronously (it is O(tracks)
plus one `simplificationReport`) and is not checked.

6.14.4.2 Identification table (`identify(bytes, fileName)`)

Content is matched top to bottom; the first match wins. `ext` is the lower-case extension of
`fileName` (without the dot) and is used only for the fallback rows and the mismatch flag.

| Content test (bytes) | Result | Notes |
|---|---|---|
| `'MThd'` at 0 | midi, kind notes, adapter `midi`, version from `Midi.identify` | extensions `mid midi smf kar` |
| `'RIFF'` at 0 and `'WAVE'` at 8 | audio, mime `audio/wav` | ext `wav` |
| `'RIFF'` at 0 and `'RMID'` at 8 | unsupported E-IMP-006: "This is a RIFF MIDI (.rmi) file. Save it as a standard .mid file and import that." | |
| `'PK'` 0x03 0x04 at 0 | `Zip.read` (errors -> unsupported E-IMP-003 with the Zip message); entry `Content/score.gpif` -> unsupported E-IMP-006 with the Part 1.5 GP6/GP7 text; entry `META-INF/container.xml` or any entry ending `.musicxml` or `.xml` outside `META-INF/` -> musicxml, container mxl, adapter `musicxml`; else unsupported E-IMP-002: "This ZIP archive does not contain a MusicXML score." | ext `mxl` (musicxml) or `gp` (GP7) |
| `'BCFZ'` at 0 | unsupported E-IMP-006 with the Part 1.5 GP6/GP7 text | ext `gpx` |
| `bytes[0] <= 30` and ASCII at 1.. starts with `FICHIER GUITAR`, `FICHIER GUITARE` or `CLIPBOARD GUITAR` | guitarpro, adapter `guitarpro`, version from `GuitarPro.identify` (the version gate itself runs inside `parseAsync`, so unsupported GP1/GP2 fail at parse with E-IMP-006) | ext `gp3 gp4 gp5` |
| text sniff: decode the first 4,096 bytes as UTF-8 (skip BOM, also UTF-16 BOM -> decode as UTF-16), skip whitespace, `<?xml ...?>`, `<!-- -->`, `<!DOCTYPE ...>`; next tag is `score-partwise`, `score-timewise` or `opus` | musicxml, container xml, adapter `musicxml` (opus is refused inside the adapter with E-IMP-006) | ext `xml musicxml` |
| `'ID3'` at 0, or `bytes[0] == 0xFF` and `(bytes[1] & 0xE6) == 0xE2` (MPEG audio frame sync, layer III) | audio, mime `audio/mpeg` | ext `mp3` |
| `'OggS'` at 0 | audio, mime `audio/ogg` | ext `ogg oga opus` |
| `'fLaC'` at 0 | audio, mime `audio/flac` | ext `flac` |
| `'ftyp'` at 4 | audio, mime `audio/mp4` | ext `m4a mp4 aac` |
| `bytes[0] == 0xFF` and `(bytes[1] & 0xF6) == 0xF0` (ADTS AAC) | audio, mime `audio/aac` | ext `aac` |
| no content match, ext in the audio list | audio, mime `audio/unknown` (decodeAudioData decides; E-IMP-008 when it fails) | |
| no content match, ext in `mid midi smf kar` | unsupported E-IMP-003: "This file is named like a MIDI file but does not start with a MIDI header." | |
| no content match, ext in `xml musicxml mxl` | unsupported E-IMP-002: "This file is named like MusicXML but no score element was found." | |
| no content match, ext in `gp3 gp4 gp5 gpx gp` | unsupported E-IMP-006 with the GP version text ("The Guitar Pro version was not recognized. Only Guitar Pro 3, 4 and 5 files can be imported.") | |
| anything else | format `unknown` -> E-IMP-002 | |

`mismatch` is true when the extension maps to a different format than the content (for
example `.mid` bytes in a `.xml` file); the content result is used and W-IMP-EXT-MISMATCH is
added. `byExtension` records the extension's expected format for the warning text.

6.14.4.3 `validateFile(meta)`

```text
name = basename (strip path components after '/' or '\'), remove control characters, trim, max 255 chars; empty -> 'import'
presumedKind = extension in {wav, mp3, ogg, oga, opus, flac, m4a, mp4, aac} ? 'audio' : 'notes'
size == 0 -> E-IMP-003 "The file is empty."
size > (presumedKind == 'audio' ? LIMITS.maxAudioFileBytes : LIMITS.maxFileBytes) -> E-IMP-001 (text names the limit: "Files larger than 25 MB (100 MB for audio) cannot be imported.")
return {name, size, presumedKind}
```
The identification step re-applies the 25 MB limit when a file with an audio extension turns
out to be a notes format (E-IMP-001).

6.14.4.4 `normalizeSong(song, result, meta, hash, deadline)`

```text
1. song.title = trimmed title or stem(meta.name) or 'Untitled' (1-120 chars); artist 0-120 chars
2. song.source = {...song.source, format: result.format == 'audio' ? 'audio' : result.format, fileName: meta.name, version: result.version,
                 importedAt: new Date().toISOString(), fileSizeBytes: meta.size, fileHash: hash}
3. tracks: for each track (including song.x.overflowTracks): lockedSource = true; derived = false; sourceTrackId = null; kind = kind ?? 'midi';
           name sanitized (1-80 chars, fallback 'Track N (<program name>)'); color from palette by index
4. per track (yield every LIMITS.normalizeYieldEvery events, checking cancelled and deadline):
   idx = Model.indexFor(track); maxChord = max over idx.byTick values of the count of notes starting at that tick
   maxChord > LIMITS.chordLimit -> W-IMP-CHORD-LIMIT (warn, location track, count = number of such ticks; message gives the largest chord)
   track.x.inspect = {maxChord}   // cached for the report
5. overflow: if song.x.overflowTracks?.length: W-IMP-TRACKS-OVER-32 (warn) with the total; default selection per 6.14.4.6 is computed in the report
6. warnings: merged = song.source.warnings + result.warnings (file-level, once: attached to the first song only) + normalize warnings
   coalesce by (code, track); sort by severity (error, warn, info) then tick; keep LIMITS.maxWarnings; warningsDropped = merged.length - kept
7. song.durationTicks = Model.Song.computeDuration(song)
8. v = Model.validate(song); v.errors.length -> throw E-IMP-003 with text ERRORS['E-IMP-003'].text + ' (internal: ' + v.errors[0].code + ')' and Log.error (a parser bug, never user data)
   v.warnings appended (W-MDL-* codes)
9. notes = sum of idx.notes.length over tracks (not overflow); notes == 0 -> W-IMP-NO-NOTES (warn): the report marks playable=false with
   unplayableReason "This file contains no notes to play. It can still be opened in the Studio." (audio: playable=false, reason = the Part 1.5 audio sentence)
```

6.14.4.5 `recommendTrack(song)`

```text
candidates = song.tracks.filter(t => t.kind === 'midi' and !t.isDrums and notes(t) >= 8)
none -> the first track with notes >= 1 (drums allowed) or null
score(t):
  idx = Model.indexFor(t); bars = max(1, meterMap.barAt(song.durationTicks) + 1)
  coverage = (number of bars containing at least one note start) / bars                 // 0..1
  mono = (notes not sharing their start tick with another note) / notes                  // 0..1
  family = Theory.familyOf(t.program): Guitar 10, Synth Lead 10, Piano 8, Brass 8, Reed 8, Pipe 8, Strings 5, Chromatic Percussion 5, Organ 5, Ethnic 4,
           Percussive 3, Bass 2, Ensemble 1, Synth Pad 1, Synth Effects 0, Sound Effects 0
  range = idx.pitchRange(); rangeBonus = (range.lo >= 36 and range.hi <= 96) ? 10 : 0
  polyPenalty = idx.maxPolyphony() > 6 ? 10 : 0
  return coverage * 50 + mono * 30 + family + rangeBonus - polyPenalty
best = max score; ties -> lowest track index. Deterministic (no randomness, integer-free floats computed identically on every run).
```

6.14.4.6 Tracks beyond 32

Parsers add tracks through `Model.Song.addTrack` until the 32nd and push further tracks onto
`song.x.overflowTracks` (a plain array; the `x` namespace is preserved by serialization but
these tracks are removed before any save). The report lists both sets with `selected` flags
computed as: all tracks sorted by (isDrums first, then noteCount descending, then index); the
first 32 are selected. `applyTrackSelection(report, ids)` (called by SCR-ImportInspect on
confirm, or implicitly with the default selection when the user does not open the selector):
validates `ids.length <= 32` and that every id exists; rebuilds `song.tracks` in original
index order from the selected ids; deletes `song.x.overflowTracks`; appends
`W-IMP-TRACKS-DROPPED` (warn) listing the dropped names (<= 10 names, then "and N more");
recomputes `durationTicks`; returns the song. Dropped tracks are therefore an explicit,
listed user decision, never a silent reduction (B 3.5, E 4.2).

6.14.4.7 `InspectionReport.build(songs, meta)`

```text
selectedSong = 0 (format 2 and multi-sequence files show a chooser; the report is rebuilt for another index by build(songs, {...meta, selectedSong:i}))
song = songs[selectedSong]
duration.ticks = song.durationTicks; seconds = song.tempoMap.ticksToSeconds(durationTicks); formatted = Core.formatTime(seconds)
tempo: e = tempoMap.entries; bpm(x) = round(60e6 / x.usPerQuarter * 10) / 10; bpmStart = bpm(e[0]); bpmMin/Max over e; changes = e.length - 1;
       source = warnings include W-MIDI-NO-TEMPO or W-XML-NO-TEMPO ? 'default' : 'file' (audio: 'default')
meters: first 50 entries with bar = meterMap.barAt(tick) + 1; metersTruncated = entries.length > 50; metersSource like tempo (W-MIDI-NO-METER)
keys: first 50 keyMap entries with name = Theory.keyFromFifths(fifths, mode).name; keysSource = entries.length ? 'file' : 'default'
tracks = song.tracks.map(trackRow); overflowTracks = (song.x.overflowTracks ?? []).map(trackRow)
trackRow(song, t, i): idx = Model.indexFor(t); range = idx.pitchRange(); bars = max(1, meterMap.barAt(max(0, Events.endTick(last note) - 1)) + 1)
   {trackId: t.id, index: i, name: t.name, kind: t.kind, program: t.program, programName: t.isDrums ? 'Drums' : Theory.GM_PROGRAMS[t.program],
    channel: t.channel, isDrums: t.isDrums, noteCount: idx.notes.length, eventCount: t.events.length,
    pitchRange: range ? {lo, hi, loName: Theory.noteName(lo), hiName: Theory.noteName(hi)} : null,
    polyphonyMax: idx.maxPolyphony(), maxChord: t.x?.inspect?.maxChord ?? 0, firstNoteTick: idx.notes[0]?.tick ?? null, bars,
    density: round(noteCount / bars * 10) / 10, warnings: song.source.warnings.filter(w => w.location.track === t.id),
    playable: t.kind === 'midi' and noteCount > 0, recommended: t.id === recommendedTrackId, selected: per 6.14.4.6}
recommendedTrackId = recommendTrack(song)
chordComplexity: maxSimultaneous = max over rows of maxChord; trackId of that row;
   perDifficulty = recommendedTrackId and that track's noteCount <= 50000 ? from Mapping.ChartGenerator.simplificationReport(song, recommendedTrackId, 'A')
                   mapped to {difficulty: needsSimplification} : null (the UI shows "computed when a track is chosen")
warnings = song.source.warnings; warningCounts by severity
status = format == 'audio' or warnings include W-MIDI-FORMAT2 or W-MIDI-SMPTE ? 'Conversion' : warnings.some(severity == 'warn' or 'error') ? 'Partial' : 'Supported'
playable = song has >= 1 track with playable true and format != 'audio'; unplayableReason per 6.14.4.4 step 9
notes: format musicxml -> Part 1.5 engraving sentence ("MusicXML files are imported as musical events (notes, timing, dynamics, tempo). Sheet music is not displayed.");
       format audio -> Part 1.5 audio sentence ("Audio files are imported as backing audio only. Notes cannot be generated from audio in this version; use a MIDI, MusicXML or Guitar Pro file for a playable chart.");
       format guitarpro -> "Guitar Pro {version} imported. Tablature effects are converted as listed in the warnings; the matrix on the About screen lists what is preserved.";
       format midi with W-MIDI-FORMAT2 -> "This file holds {n} independent sequences. Choose the one to import."
       overflowTracks.length -> "This file has {n} tracks; up to 32 can be kept. Review the selection before importing."
       every format: "Instruments are synthesized; timbres approximate General MIDI programs." (ADR-04 honesty)
stats from meta (readMs, parseMs, normalizeMs, inspectMs, totalMs, events, yields)
```

6.14.4.8 Warnings owned by M-14

| Code | Severity | Message |
|---|---|---|
| W-IMP-EXT-MISMATCH | info | The file is named .{name} but contains {value}; the content was used. |
| W-IMP-LARGE-FILE | info | Large file ({n} MB); import may take several seconds. |
| W-IMP-CHORD-LIMIT | warn | Track "{name}" has chords of up to {value} notes at once (limit 16); all notes are kept, gameplay charts use at most four lanes. |
| W-IMP-TRACKS-OVER-32 | warn | The file has {n} tracks; up to 32 can be kept in a song. Choose which tracks to import. |
| W-IMP-TRACKS-DROPPED | warn | {n} tracks were not imported: {value}. |
| W-IMP-NO-NOTES | warn | This file contains no notes. |

Codes from Parts 06b (`W-IMP-CHART-EMPTY`, `W-IMP-CHART-OMITTED`) are produced by M-08 and
only displayed by the inspection screen.

6.14.4.9 `COMPATIBILITY` data

```js
FLM.Import.COMPATIBILITY = {
  version: 1, vocabulary: ['Supported', 'Partial', 'Conversion', 'Unsupported'],
  formats: [
    { id: 'midi', label: 'Standard MIDI File', extensions: ['.mid', '.midi', '.smf', '.kar'], testGroup: 'files',
      versions: [
        { name: 'SMF format 0', status: 'Supported', notes: 'split into one track per MIDI channel' },
        { name: 'SMF format 1', status: 'Supported', notes: '' },
        { name: 'SMF format 2', status: 'Conversion', notes: 'one sequence imported at a time' },
        { name: 'SMPTE time division', status: 'Conversion', notes: 'converted to 120 BPM ticks; bar lines may not align' },
        { name: 'RIFF MIDI (.rmi)', status: 'Unsupported', notes: 'save as .mid' } ],
      features: [
        { name: 'Notes, velocity, duration, channel', status: 'Supported' }, { name: 'Tempo map', status: 'Supported' },
        { name: 'Time and key signatures', status: 'Supported' }, { name: 'Program changes and bank select', status: 'Supported' },
        { name: 'Controllers (as events)', status: 'Supported' }, { name: 'Pitch bend', status: 'Supported' },
        { name: 'Sustain pedal (CC 64)', status: 'Supported', notes: 'kept as events; derived durations for playback' },
        { name: 'Track names, lyrics, text, markers', status: 'Supported' }, { name: 'Percussion channel 10', status: 'Supported' },
        { name: 'Polyphonic and channel aftertouch', status: 'Unsupported', notes: 'ignored with a warning' },
        { name: 'System exclusive', status: 'Unsupported', notes: 'skipped' }, { name: 'Running status', status: 'Supported' },
        { name: 'Malformed or truncated files', status: 'Partial', notes: 'events before the damage are kept and reported' } ],
      limits: ['file <= 25 MB', 'tracks <= 128 (32 kept per song)', 'events <= 1,000,000', 'parse <= 5 s'] },
    { id: 'musicxml', label: 'MusicXML', extensions: ['.xml', '.musicxml', '.mxl'], testGroup: 'files',
      versions: [
        { name: 'MusicXML 1.0 - 4.0 partwise', status: 'Supported', notes: '' },
        { name: 'MusicXML timewise', status: 'Conversion', notes: 'regrouped to partwise in memory' },
        { name: 'Compressed .mxl (stored or deflate)', status: 'Supported', notes: 'own ZIP reader' },
        { name: 'Opus collections', status: 'Unsupported', notes: 'import one score at a time' } ],
      features: [
        { name: 'Parts, instruments, MIDI assignments', status: 'Supported' }, { name: 'Notes, rests, chords, durations, divisions', status: 'Supported' },
        { name: 'Ties', status: 'Supported' }, { name: 'Tuplets and dots', status: 'Supported' }, { name: 'Time and key signatures', status: 'Supported' },
        { name: 'Tempo (sound tempo, metronome)', status: 'Supported' }, { name: 'Dynamics', status: 'Supported' },
        { name: 'Articulations', status: 'Partial', notes: 'staccato, staccatissimo, accent, marcato, tenuto; others flagged' },
        { name: 'Repeats and alternate endings', status: 'Supported' }, { name: 'Da capo, dal segno, fine, coda', status: 'Unsupported', notes: 'reported, played through once' },
        { name: 'Transposing instruments and octave shifts', status: 'Supported' }, { name: 'Grace notes', status: 'Conversion', notes: 'played 1/32 before the main note' },
        { name: 'Guitar bends (technical)', status: 'Conversion', notes: 'pitch bend events' }, { name: 'Unpitched percussion', status: 'Supported' },
        { name: 'Lyrics', status: 'Partial', notes: 'first line only' }, { name: 'Pedal marks', status: 'Supported' },
        { name: 'Ornaments, tremolo, glissando, arpeggio', status: 'Unsupported', notes: 'flagged; notes play plain' },
        { name: 'Chord symbols and figured bass', status: 'Unsupported' }, { name: 'Hairpins (wedge)', status: 'Unsupported' },
        { name: 'Notation rendering (engraving)', status: 'Unsupported', notes: 'not a feature of this product' } ],
      limits: ['file <= 25 MB', 'parts <= 128 (32 kept)', 'measures <= 10,000 per part', 'notes <= 1,000,000', 'parse <= 5 s'] },
    { id: 'guitarpro', label: 'Guitar Pro', extensions: ['.gp3', '.gp4', '.gp5'], testGroup: 'files',
      versions: [
        { name: 'GP3 (FICHIER GUITAR PRO v3.00)', status: 'Supported' }, { name: 'GP4 (v4.00, v4.06, L4.06)', status: 'Supported' },
        { name: 'GP5 (v5.00, v5.10)', status: 'Supported' }, { name: 'GP1, GP2', status: 'Unsupported' },
        { name: 'GP6 (.gpx)', status: 'Unsupported', notes: 'export as GP5 or MIDI' }, { name: 'GP7, GP8 (.gp)', status: 'Unsupported', notes: 'export as GP5 or MIDI' } ],
      features: [
        { name: 'String and fret', status: 'Supported', notes: 'kept as x.tab' }, { name: 'Tuning and capo', status: 'Supported' },
        { name: 'Durations, dots, tuplets', status: 'Supported' }, { name: 'Tempo and mix-table tempo changes', status: 'Supported' },
        { name: 'Time signatures, key, markers', status: 'Supported' }, { name: 'Repeats and alternate endings', status: 'Supported' },
        { name: 'Directions (coda, segno, da capo)', status: 'Unsupported', notes: 'reported' },
        { name: 'Bends and tremolo bar', status: 'Conversion', notes: 'pitch bend events, range two semitones' },
        { name: 'Slides, hammer-ons, pull-offs', status: 'Partial', notes: 'kept as flags; no pitch glide' },
        { name: 'Palm mute, staccato, dead notes', status: 'Conversion', notes: 'velocity and duration rules' },
        { name: 'Harmonics', status: 'Conversion', notes: 'pitch offset table; artificial approximated' },
        { name: 'Tied and let-ring notes', status: 'Supported' }, { name: 'Grace notes', status: 'Conversion' },
        { name: 'Vibrato, trill, tremolo picking', status: 'Partial', notes: 'flags only' },
        { name: 'Chord diagrams', status: 'Partial', notes: 'name only' }, { name: 'Lyrics', status: 'Partial', notes: 'first line' },
        { name: 'Drum tracks', status: 'Supported' }, { name: 'Triplet feel', status: 'Unsupported' },
        { name: 'RSE sound data', status: 'Unsupported', notes: 'skipped; GM program used' }, { name: 'Strokes, pick strokes, fade-in', status: 'Unsupported' } ],
      limits: ['file <= 25 MB', 'tracks <= 128 (32 kept)', 'measures <= 10,000', 'notes <= 1,000,000', 'parse <= 5 s'] },
    { id: 'audio', label: 'Audio (backing track only)', extensions: ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac'], testGroup: 'files',
      versions: [
        { name: 'WAV (PCM)', status: 'Supported' }, { name: 'MP3', status: 'Partial', notes: 'where the browser decodes it' },
        { name: 'OGG Vorbis / Opus', status: 'Partial', notes: 'not decoded by Safari' }, { name: 'FLAC', status: 'Partial', notes: 'browser dependent' },
        { name: 'M4A / AAC', status: 'Partial', notes: 'browser dependent' } ],
      features: [
        { name: 'Playback as a backing track', status: 'Supported' }, { name: 'Sync offset (-30 s .. +30 s)', status: 'Supported' },
        { name: 'Notes from audio (transcription)', status: 'Unsupported', notes: 'never claimed' },
        { name: 'Speed change of audio tracks', status: 'Unsupported', notes: 'audio plays at 1.0 speed' },
        { name: 'Persisting decoded audio', status: 'Unsupported', notes: 'metadata only; re-import after reload' } ],
      limits: ['file <= 100 MB', 'duration <= 2 h', 'decoded size <= 192 MB desktop / 64 MB mobile'] }
  ],
  sentences: { audioOnly: '<Part 1.5 audio sentence>', engraving: '<Part 1.5 engraving sentence>', gp67: '<Part 1.5 GP6/GP7 sentence>',
               synthesized: 'Instruments are synthesized; timbres approximate General MIDI programs.' }
};
```

Every `status` value is one of the four vocabulary words (UT-14-19 asserts it); the matrix
text in `docs/COMPATIBILITY.md` is generated from this object in Phase 12 (Part 8.7) and
rendered on SCR-About.

6.14.4.10 Audio adapter

```text
decodeAudio(bytes, fileName, onProgress):
  ctx = Audio.ctx() ?? new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 2, 48000)   // decoding needs no gesture
  copy = bytes.slice().buffer                      // decodeAudioData detaches its input; the import pipeline keeps `bytes` for hashing
  onProgress({fraction:null})
  buffer = await new Promise((res, rej) => { try { const p = ctx.decodeAudioData(copy, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); } })
           on rejection -> E-IMP-008 "Your browser cannot decode this audio file ({name}). WAV files work in every supported browser."
  buffer.duration > LIMITS.maxAudioSeconds -> E-IMP-004 "Audio longer than 2 hours is not supported."
  decodedBytes = buffer.length * buffer.numberOfChannels * 4; decodedBytes > LIMITS.maxDecodedAudioBytes -> E-IMP-004 "This audio file is too large to hold in memory on this device ({n} MB decoded)."
  track = Model.Track.create({name: stem(fileName), kind:'audio', program:0, channel:0, isDrums:false,
          audioRef: {fileName, durationS: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, syncOffsetMs: 0, sizeBytes: bytes.length}})
  track.audioRef.buffer = buffer (non-enumerable property so Song.toJSON skips it: Object.defineProperty(..., {enumerable:false, writable:true}))
  AudioTrack.attach(track.id, buffer)
  return {track, buffer, info: {durationS, sampleRate, channels, decodedBytes, syncOffsetMs: 0}}
releaseAudio(trackId): detach from the registry and delete track.audioRef.buffer where reachable; returns the count; M-28 calls releaseAudio() on leaving `import` without confirming and `Modes.assertClean` expects audioBufferCount() === 0 afterwards.
```

#### 6.14.5 Error handling and recovery

Error catalog (`FLM.Import.ERRORS`; all class `recoverable`; user data never at risk because
the pipeline writes nothing):

| Code | User text | Action offered by SCR-ImportInspect |
|---|---|---|
| E-IMP-001 | Files larger than 25 MB (100 MB for audio) cannot be imported. | Choose another file |
| E-IMP-002 | This file type is not recognized. Supported: MIDI (.mid), MusicXML (.xml, .musicxml, .mxl), Guitar Pro 3-5 (.gp3, .gp4, .gp5) and audio files. | Choose another file; link to the compatibility matrix |
| E-IMP-003 | The file is damaged or not in the expected layout. {detail} | Choose another file |
| E-IMP-004 | The file exceeds an import limit: {detail} | Choose another file; limits listed |
| E-IMP-005 | Importing took longer than 5 seconds and was stopped. Try a smaller file or a faster device. | Retry; choose another file |
| E-IMP-006 | {format-specific sentence from the adapter or identification table} | Choose another file |
| E-IMP-007 | The compressed MusicXML archive contains no score. | Choose another file |
| E-IMP-008 | Your browser cannot decode this audio file. WAV files work in every supported browser. | Choose another file |
| E-IMP-009 | The file cannot be read. Check that it still exists and try again. | Retry |
| E-IMP-011 | Import cancelled. | none (returns to the previous screen) |
| E-IMP-014 | This XML declares custom entities, which are not allowed for safety. Re-export the file without a DOCTYPE. | Choose another file |
| E-IMP-015 | The XML is not well-formed: {detail} | Choose another file |
| E-IMP-016 | An import is already running. | Wait or cancel |

Nine-question table:

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| File read fails (permission, removed) | `arrayBuffer` rejects | everything (nothing started) | yes | none | E-IMP-009 in the error state | n/a | screen stays on the picker | UT-14-03 |
| Too large, empty | `validateFile` | everything | choose another | none | E-IMP-001 / E-IMP-003 | n/a | picker | UT-14-03 |
| Unknown or unsupported format | identification | everything | choose another | none | E-IMP-002 / E-IMP-006 with the exact Part 1.5 wording for GP6/GP7 | n/a | picker | UT-14-01 |
| Adapter throws (malformed, limits, budget) | adapter error with `.code` | current project untouched (no reference to Project) | retry or another file | none | `import.failed` -> error state with the code's text and `stage` | n/a | picker | UT-14-14, 18 |
| Adapter throws an untyped exception (bug) | catch without `.code` | project untouched | another file | none | E-IMP-003 with "(internal: ...)" and a Log entry; Diagnostics export includes it | n/a | picker | UT-14-18 |
| Normalized song fails `Model.validate` | step 8 | project untouched | no | none | E-IMP-003 internal | n/a | picker | UT-14-11 |
| User cancels | flag at yields | project untouched | yes | none | E-IMP-011 (no error dialog) | n/a | previous screen | UT-14-13 |
| Audio decode fails or too large | `decodeAudioData` rejects; size checks | project untouched | another file | none | E-IMP-008 / E-IMP-004 | n/a | picker | UT-14-16 |
| More than 32 tracks | overflow array | all tracks parsed | n/a | none | W-IMP-TRACKS-OVER-32 plus the selector; W-IMP-TRACKS-DROPPED after confirm | 32 kept | n/a | UT-14-22 |
| No notes | step 9 | song importable to Studio | n/a | none | W-IMP-NO-NOTES; Play disabled with reason | Studio only | n/a | UT-14-09 |
| Second import while one runs | `running` | first import continues | after it ends | none | E-IMP-016 | n/a | n/a | UT-14-04 |
| Decoded audio retained after leaving the screen | `audioBufferCount` in `assertClean` | n/a | n/a | none | leak counter (Part 4.7) | n/a | `releaseAudio()` | UT-14-21 |

#### 6.14.6 Limits and performance notes

- The 5 s budget covers parse, normalize and inspect; hashing 25 MB with FNV-1a takes about
  40 ms in V8 and is included in the parse stage's time.
- Normalize is O(events) with yields; `Model.indexFor` builds per-track indexes once and the
  report reuses them (the cache key is the track version).
- `simplificationReport` runs four chart generations on the recommended track; it is skipped
  above 50,000 notes so the report stays under the budget (the UI computes it on demand).
- Progress events are throttled to 10 Hz; stage changes always emit.
- Audio buffers are the only retained memory and are counted by `audioBufferCount()`.

#### 6.14.7 Spec coverage

B 7.5 (import, inspect tracks and instruments, select tracks, source arrangement intact), B
15.1 (all eight pipeline steps: validate, identify, parse, normalize, preserve metadata,
report unsupported features, present for inspection, make available to the game via the
report's Song), B 15.5 (audio adapters by browser decoding; audio files are audio tracks
only; no transcription claim), B 15.7 (source metadata and warnings), B 23.1 (untrusted
input, limits before reading), B 24 (actionable errors for invalid files and unsupported
versions), B 26.3; E 3.3 (compatibility matrix as data; valid file with no playable events),
E 3.4 (unsupported codec, corrupted audio, very long or large audio, no beat metadata,
defined `syncOffsetMs`), E 11 (file-import failure never corrupts the current project), E 13
(required formats run against the corpus by the `files` group); I 6.1 (every inspection field),
I 6.2 (preview hook through `chordComplexity` and `ChartGenerator.preview`), I 6.4 (honest
matrix), I 11.4 (real progress where measurable, null otherwise), I 16.2 (adapters), I 17; P
11 (every bullet), P 19 (failed imports preserve the project; unsupported features identified).

#### 6.14.8 Unit tests

`src/91-test-import.js`, group `import`. Fixtures reuse `smf`, `mx`, `gpb` and `zipw` from
the sibling test files through `FLM.SelfTest.fixtures` (those files load first in file-name
order). `decodeAudioData` is replaced in tests by `FLM.SelfTest.fakes.audioDecoder({durationS,
sampleRate, channels, fail})`, which installs a stub on the context returned by `Audio.ctx()`
and restores it after the test.

| UT | Name | Setup | Assertion |
|---|---|---|---|
| UT-14-01 | identification table | bytes for: MThd; RIFF/WAVE; RIFF/RMID; PK with container.xml; PK with Content/score.gpif; `<?xml` + score-partwise after a comment; BCFZ; FICHIER v5.10; ID3; FF FB; OggS; fLaC; ftyp at 4; 4 zero bytes with name `x.bin` | formats midi, audio/wav, E-IMP-006 rmi text, musicxml mxl, E-IMP-006 containing `'Guitar Pro 6 or 7'`, musicxml xml, E-IMP-006 GP text, guitarpro `'GP5 v5.10'`, audio/mpeg, audio/mpeg, audio/ogg, audio/flac, audio/mp4, unknown |
| UT-14-02 | extension mismatch | MThd bytes named `song.xml`; `.mid` name with text content | midi with `mismatch` true and W-IMP-EXT-MISMATCH in the report; E-IMP-003 "named like a MIDI file" |
| UT-14-03 | validateFile | size 0; 26 MB `.mid`; 26 MB `.wav`; 101 MB `.wav`; name `'../../x/song.mid'` | E-IMP-003; E-IMP-001; ok (audio limit); E-IMP-001; name `'song.mid'` |
| UT-14-04 | registry and concurrency | `adapters.list()` after load; register a fake adapter for format `'midi'` twice; start two imports | three adapters midi, musicxml, guitarpro; second registration replaces (Log info); second `importFile` rejects E-IMP-016 while the first resolves |
| UT-14-05 | report fields (MIDI) | `smf` fixture: 2 tracks, tempo 2 entries, meter 3/4, key 1 major, 8 bars | `format` midi, `version` `'SMF format 1, 480 PPQ'`, `duration.seconds` within 1e-6 of the TempoMap value, `tempo` {bpmStart 120, changes 1, source 'file'}, `meters[0]` 3/4 bar 1, `keys[0].name` `'G major'`, `tracks.length` 2, `status` 'Supported' |
| UT-14-06 | track rows | track with program 33 on ch 1, 40 notes over 8 bars, chords of 3; drum track | row: programName `'Electric Bass (finger)'`, channel 1, noteCount 40, pitchRange with names, polyphonyMax 3, maxChord 3, density 5.0, playable true; drum row programName `'Drums'` |
| UT-14-07 | recommendTrack | song with: drums (200 notes), pad (ensemble, chords, 100 notes), lead guitar (80 notes, mono, full coverage), bass (60) | guitar recommended; removing the guitar -> bass; only drums -> drums; empty song -> null; two identical tracks -> lower index |
| UT-14-08 | chord complexity | dense piano fixture (`fx.dense` from the mapping tests) | `chordComplexity.maxSimultaneous` >= 5; `perDifficulty.beginner` true; `perDifficulty.expert` boolean |
| UT-14-09 | no notes | file with cc events only | W-IMP-NO-NOTES; `playable` false; `unplayableReason` contains `'no notes'`; `import.done` still emitted |
| UT-14-10 | chord limit | track with 17 notes at tick 0 | W-IMP-CHORD-LIMIT warn with value 17; all 17 notes present in the song |
| UT-14-11 | normalize | song titled `'  '` from `my song.mid`; 600 distinct warnings injected by a fake adapter; a fake adapter returning an unsorted track | title `'my song'`; `fileHash` 8 hex equal to `fnv1a32(bytes)`; `importedAt` ISO; `warningsDropped` 100 and `warnings.length` 500 sorted by severity; unsorted track -> E-IMP-003 containing `'internal'` |
| UT-14-12 | progress events | import a 45,000-event SMF with a spy on `import.progress` | stages appear in order validate, identify, parse, normalize, inspect; parse events carry `bytesTotal` = file size; at most 1 event per 100 ms within a stage |
| UT-14-13 | cancel | start import of a large fixture, call `cancel()` after the first progress event | rejects E-IMP-011; `import.failed` with code E-IMP-011; no `import.done`; `isRunning()` false afterwards |
| UT-14-14 | budget | `importFile(bytes50k, {budgetMs: 0})` | rejects E-IMP-005; `import.failed.stage` 'parse' |
| UT-14-15 | audio import | fake decoder 30 s, 44100 Hz, 2 ch on `beat.wav` | report `format` 'audio', `status` 'Conversion', `playable` false, `audio.durationS` 30, one track `kind` 'audio' with `audioRef.syncOffsetMs` 0; `Song.toJSON` output has no `buffer` key; `audioBufferCount()` 1; `notes` contains the Part 1.5 audio sentence |
| UT-14-16 | audio failures | fake decoder `fail:true`; fake 7300 s; fake 400 MB decoded | E-IMP-008; E-IMP-004 "2 hours"; E-IMP-004 "too large to hold" |
| UT-14-17 | format 2 | 3-sequence SMF | `songs.length` 3; `selectedSong` 0; `build(songs, {selectedSong: 2})` reports the third; `notes` contains "independent sequences" |
| UT-14-18 | project isolation and internal errors | spy on every `FLM.Project.*` and `FLM.Storage.*` function during an import; a fake adapter that throws `new TypeError('boom')` | no spy called; TypeError surfaces as `.code` 'E-IMP-003' with "(internal: boom)" and one Log error entry; `import.failed` emitted once |
| UT-14-19 | COMPATIBILITY shape | iterate formats, versions, features | every `status` in the vocabulary; every format has non-empty `extensions`, `versions`, `features`, `limits`; `sentences` has the four keys |
| UT-14-20 | normalize yields | fake adapter returning a 300,000-event song | at least 15 yields counted in `stats.yields`; result identical to a non-yielding build |
| UT-14-21 | releaseAudio | import two audio fixtures, `releaseAudio(firstId)`, then `releaseAudio()` | counts 1 then 1; `audioBufferCount()` 0; `track.audioRef.buffer` undefined |
| UT-14-22 | overflow tracks | 40-track SMF (drums on track 40 with 10 notes; tracks 1-39 with 100 - i notes) | `tracks.length` 32, `overflowTracks.length` 8; default selection includes the drum track and the 31 busiest; `applyTrackSelection(report, ids)` with 32 ids rebuilds `song.tracks` in index order, deletes `x.overflowTracks`, adds W-IMP-TRACKS-DROPPED naming 8 tracks; 33 ids -> throws |
| UT-14-23 | startOffsetSeconds | audio track with `syncOffsetMs` 1500 and -2000; tempo 120 | tick 0 -> {bufferOffsetS 0, delayS 1.5}; tick 1920 (1 s) -> {bufferOffsetS 0, delayS 0.5}; offset -2000 at tick 0 -> {bufferOffsetS 2, delayS 0}; `setSyncOffset(track, 99999)` -> 30000 |
| UT-14-24 | short buffers | 3-byte file; 20-byte file starting `'MThd'` | identify returns unknown / midi with incomplete version; `importFile` rejects E-IMP-003 in both cases with `import.failed.stage` 'identify' or 'parse' |

#### 6.14.9 Implementation notes and browser quirks

- `decodeAudioData` detaches the `ArrayBuffer` it receives in every browser; the pipeline
  passes a copy so the original bytes remain available for hashing and so the same bytes can
  be retried.
- Safari before 14.1 exposes only the callback form of `decodeAudioData`; the wrapper in
  6.14.4.10 handles both. Safari does not decode Ogg Vorbis or Opus (E-IMP-008 there, as the
  matrix states). Firefox decodes FLAC and Ogg; Chromium decodes all listed formats on most
  platforms.
- `Blob.prototype.arrayBuffer` is missing in Safari 13; `FileReader` is the fallback.
- Decoding on a suspended `AudioContext` works in all five browsers, so audio import does not
  require the unlock gesture; playback does (M-05).
- MP3 frame sync detection accepts MPEG-1 and MPEG-2 layer III headers (`0xFFFB`, `0xFFFA`,
  `0xFFF3`, `0xFFF2`); files with leading junk and no ID3 tag fall to the extension row.
- The report object is plain data (no DOM), so SCR-ImportInspect can render it with
  `textContent` only; the inspection screen never receives raw file text.
- FNV-1a over 25 MB runs in a tight loop with `Math.imul`; it is executed inside the parse
  stage after the adapter returns so that a failed parse never pays for it.
