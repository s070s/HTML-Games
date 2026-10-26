## 5. Data model and serialization

This part is normative for every in-memory type, every persisted document, every export
file and every network payload. Module designs in Part 6 implement these shapes without
renaming fields. Where this part adds a field to a shape given in the project brief (for
example `Track.kind`), the addition is listed in 5.17 and is the only allowed extension.

Conventions used in the field tables:

- `int` means a JavaScript Number holding an integer; `float` a finite Number; `bool` a
  boolean; `string` a JavaScript string; `ISO` an ISO 8601 UTC timestamp string with
  millisecond precision (`2026-10-25T12:00:00.000Z`).
- `id` strings match `^[A-Za-z0-9_.:-]{1,64}$`. `FLM.Core.uid(prefix)` returns
  `<prefix>_<10 base36 chars>` drawn from `crypto.getRandomValues` when available and
  from `Math.random` otherwise. Sequence-based ids (events, tracks) are described per type.
- Ticks are integers at PPQ 960. Negative ticks exist only inside `FLM.Transport` during a
  count-in and never in the model or in any file.
- "Invariant" is checked by `FLM.Model.validate` (song level) or `FLM.Project.validate`
  (project level) and by the unit tests that Part 6 names for those functions.

### 5.1 Type definitions

#### 5.1.1 Song and SourceInfo

`Song` (M-03):

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| id | id | 1-64 chars | `uid('song')` | unique within a Project and within the library index; built-in songs use the fixed ids `demo-poprock`, `demo-piano`, `demo-electro`, `demo-jazz`, `demo-dance` (Part 1.7) |
| title | string | 1-120 chars, trimmed | `"Untitled"` | never empty after normalization (empty input becomes the default) |
| artist | string | 0-120 chars, trimmed | `""` | none |
| source | SourceInfo | see below | `{format:'empty'}` | `format` is one of the enum values |
| ppq | int | constant 960 | 960 | always 960; importers rescale ticks (5.3, Part 6 M-10) |
| tempoMap | TempoMap | 1-10,000 entries | one entry `{tick:0, usPerQuarter:500000}` | `entries[0].tick === 0`; sorted by tick; unique ticks after normalization |
| meterMap | MeterMap | 1-10,000 entries | one entry `{tick:0, numerator:4, denominator:4}` | `entries[0].tick === 0`; sorted; unique ticks |
| keyMap | KeyMap | 0-10,000 entries | `[]` (interpreted as C major) | sorted; unique ticks |
| tracks | Track[] | 0-32 | `[]` | `track.id` unique; array order is display order and MIDI export order |
| markers | Marker[] | 0-1,000 | `[]` | sorted by tick, then label |
| durationTicks | int | >= 0 | 0 | equals `max(lastEventEnd over tracks, last marker tick, 0)`; recomputed by `Model.recomputeDuration(song)` after every mutation |
| createdAt | ISO | | now | none |
| modifiedAt | ISO | | now | `modifiedAt >= createdAt` |
| idSeq | int | >= 1 | 1 | next track ordinal; strictly increases; never reused |

`SourceInfo`:

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| format | string | `'builtin'`, `'midi'`, `'musicxml'`, `'guitarpro'`, `'audio'`, `'recorded'`, `'empty'` | `'empty'` | enum |
| fileName | string | 0-255 chars, path components stripped | `""` | no `/` or `\` |
| version | string | 0-80 chars, human readable (`"SMF format 1, 480 PPQ"`, `"MusicXML 3.1 (partwise)"`, `"GP5.10"`) | `""` | none |
| warnings | ImportWarning[] | 0-500 | `[]` | sorted by (severity error > warn > info, then tick); duplicates coalesced into `count` |
| warningsDropped | int | >= 0 | 0 | number of warnings not kept because the 500 cap was reached |
| importedAt | ISO or null | | null | null when format is `'empty'`, `'builtin'` or `'recorded'` |
| fileSizeBytes | int | >= 0 | 0 | none |
| fileHash | string | 8 lowercase hex chars (`fnv1a32` of the file bytes) or `""` | `""` | used only to label "same file imported again" in SCR-ImportInspect |

#### 5.1.2 Track and AudioRef

`Track` (M-03):

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| id | id | `t<base36 of Song.idSeq at creation>` | assigned by `Track.create` | unique in song; never reused after deletion |
| name | string | 1-80 chars, trimmed | `"Track N (<GM program name>)"` | never empty |
| kind | string | `'midi'` or `'audio'` | `'midi'` | `'audio'` implies `events.length === 0` and `audioRef !== null` |
| channel | int | 0-15 (0-based MIDI channel) | 0 | `isDrums` tracks are exported on channel 9; in memory any channel is allowed |
| program | int | 0-127 (GM program, 0-based) | 0 | ignored when `isDrums` |
| bankMsb | int | 0-127 | 0 | none |
| bankLsb | int | 0-127 | 0 | none |
| isDrums | bool | | false | `true` for imported MIDI channel 9 tracks and MusicXML/GP percussion parts |
| events | Event[] | 0-100,000 per track; <= 1,000,000 per song | `[]` | always sorted by the 5.2 comparator; mutation only through `Model.insertEvent` / `Model.removeEvent` / `Model.replaceEvents` |
| mix | MixState | | `{gain:1, pan:0, mute:false, solo:false}` | ranges per MixState |
| color | string | `#rrggbb` lowercase | palette entry `trackIndex % 8` (palette in Part 3) | matches `^#[0-9a-f]{6}$` |
| visible | bool | | true | hidden tracks still play and export |
| lockedSource | bool | | true for imported and built-in tracks, false for tracks created in Studio | when true, no command may mutate `events`; derived tracks are used instead |
| derived | bool | | false | when true, `sourceTrackId` names an existing track with `lockedSource === true` |
| sourceTrackId | id or null | | null | null unless `derived` |
| idSeq | int | >= 1 | 1 | next note ordinal for this track |
| audioRef | AudioRef or null | | null | non-null only when `kind === 'audio'` |

`MixState`: `gain` float 0-2 (default 1; 1 = unity, 2 = +6 dB), `pan` float -1..1
(default 0), `mute` bool, `solo` bool. Mute and solo may both be true; solo wins (Part 6 M-05).

`AudioRef` (audio tracks keep metadata only; decoded buffers are never persisted):

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| fileName | string | 0-255 | `""` | none |
| durationS | float | 0-7200 s | 0 | none |
| sampleRate | int | 8,000-192,000 Hz | 0 | none |
| channels | int | 1-2 | 0 | none |
| syncOffsetMs | int | -30,000..30,000 ms; positive = audio starts later than tick 0 | 0 | applied only by the audio adapter when scheduling the buffer |
| sizeBytes | int | >= 0 | 0 | none |

At runtime the audio adapter attaches `track.audioRef.buffer` (an `AudioBuffer`) which the
serializer omits; a loaded project whose audio track has no buffer is shown as
"audio missing - re-import the file" (Part 7 SCR-Studio) and the track is silent.

#### 5.1.3 Events

Every event has `kind` and `tick` (int, >= 0). Only `NoteEvent` has an `id`; the other kinds
are addressed as `(trackId, kind, tick, ordinalAtTick)` by editing commands.

`NoteEvent`:

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| kind | string | `'note'` | | const |
| tick | int | >= 0 | | none |
| durTicks | int | >= 1 | 1 | zero-duration input is raised to 1 with warning `W-NOTE-ZERO-DURATION` |
| pitch | int | 0-127 | | none |
| velocity | int | 1-127 | 100 | velocity 0 never exists in the model (it is a note-off during import) |
| offVelocity | int | 0-127 | 64 | none |
| channel | int | 0-15 | track.channel | equals `track.channel` for every event of the track (importers split multi-channel tracks) |
| id | id | `<trackId>.<base36 of Track.idSeq at creation>` | assigned by `Model.insertEvent` | unique in song; stable across save/load; `Chart.sourceEventIds` refer to it |

`ControlEvent`: `kind:'cc'`, `tick`, `controller` int 0-127, `value` int 0-127, `channel`
int 0-15. Controllers with defined behavior: 1 modulation, 7 volume, 10 pan, 11 expression,
64 sustain, 120 all sound off, 121 reset controllers, 123 all notes off. Others are stored
and exported but ignored by playback (Part 6 M-06).

`ProgramEvent`: `kind:'program'`, `tick`, `program` 0-127, `bankMsb` 0-127 (default 0),
`bankLsb` 0-127 (default 0), `channel` 0-15.

`PitchBendEvent`: `kind:'bend'`, `tick`, `value` int -8192..8191 (0 = center), `channel`.

`TextEvent`: `kind:'text'`, `tick`, `type` one of `'text'`, `'lyric'`, `'marker'`, `'cue'`,
`'copyright'`, `'instrument'`, `'trackName'`, `'other'`, `text` string 0-1,024 chars after
sanitization (every code point below 0x20 except `\n` removed; longer text truncated with
warning `W-TEXT-TRUNCATED`). Text is always rendered through `textContent` (ADR-12).

#### 5.1.4 TempoMap, MeterMap, KeyMap, Marker, ImportWarning

`TempoMap.entries[i]`:

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| tick | int | >= 0 | | `entries[0].tick === 0`; strictly increasing after normalization |
| usPerQuarter | int | 1..16,777,215 (microseconds per quarter note, 3-byte MIDI range) | 500000 | BPM = 60,000,000 / usPerQuarter |
| secondsAt | float | >= 0 s | derived | seconds from tick 0 to `tick`; recomputed by `TempoMap.rebuild()`; never serialized |

`MeterMap.entries[i]`: `tick` int, `numerator` int 1-32, `denominator` int in
{1, 2, 4, 8, 16, 32, 64}. `entries[0].tick === 0`. Derived: `ticksPerBeat = 960 * 4 /
denominator`, `ticksPerBar = ticksPerBeat * numerator`.

`KeyMap.entries[i]`: `tick` int, `fifths` int -7..7, `mode` `'major'` or `'minor'`.

`Marker`: `tick` int >= 0, `label` string 1-80, `kind` `'section'` or `'cue'`.

`ImportWarning`:

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| code | string | `^W-[A-Z]+-[A-Z0-9-]+$` (catalog in Part 8.8 and Part 6) | | known code |
| message | string | 1-200 chars, user-facing, ASCII | | none |
| severity | string | `'info'`, `'warn'`, `'error'` | `'warn'` | enum |
| location | object | `{track: id or null, tick: int or null}` | `{track:null, tick:null}` | none |
| count | int | >= 1 | 1 | number of identical (code, track) occurrences coalesced into this entry |

#### 5.1.5 Helper types owned by M-03

`TrackIndex` (runtime only, rebuilt lazily by `Model.indexOf(track)` and invalidated by any
mutation of `track.events`):

| field | type | meaning |
|---|---|---|
| notes | NoteEvent[] | the note events of the track in comparator order (same objects as in `events`) |
| noteById | Map<string, NoteEvent> | id lookup |
| byTick | Map<int, int[]> | tick -> indexes into `notes` of notes starting at that tick |
| startTicks | Int32Array | `notes[i].tick`, for binary search (`Model.firstNoteAtOrAfter(track, tick)`) |
| endTicks | Int32Array | `notes[i].tick + notes[i].durTicks` |
| maxPolyphony | int | maximum number of notes sounding at any tick |
| pitchMin, pitchMax | int | range of pitches, or -1 when no notes |
| version | int | increments on every rebuild; consumers compare it to detect staleness |

`DerivedNote` (the sustain-pedal layer; non-destructive, computed by
`Model.deriveNotes(track)` from CC 64 and never written back to `events`):

| field | type | range/units | invariant |
|---|---|---|---|
| noteId | id | | refers to a NoteEvent of the same track |
| tick | int | | equals the source note tick |
| effectiveDurTicks | int | >= durTicks | extended to the next tick where CC 64 drops below 64 after the note end, or to the next same-pitch note start, whichever is first |
| pitch, velocity, channel | as NoteEvent | | copied |

`Section` (computed by `Model.sections(song)`): `{index:int, label:string, startTick:int,
endTick:int, kind:'marker' or 'auto'}`. When the song has at least two `'section'` markers
the sections are the spans between them (the first span starts at tick 0 even when the
first marker is later and is labeled `"Intro"` if unnamed); otherwise sections are
consecutive 4-bar spans labeled `"Bars 1-4"`, `"Bars 5-8"`, ... using `MeterMap`.

#### 5.1.6 Gameplay result types (M-09)

`Judgment` is one of `'perfect'`, `'great'`, `'good'`, `'miss'`.

`JudgeResult`:

| field | type | range/units | invariant |
|---|---|---|---|
| noteId | id | ChartNote id or DanceStep id | the note was unjudged before this result |
| judgment | Judgment | | |
| deltaMs | float or null | ms; `(tAdj - noteAudioTime) * 1000`; negative = early | null when judgment is `'miss'` by timeout or hold break |
| tInput | float or null | audio seconds, calibrated (`tAdj` of 5.12) | null for timeout misses |
| phase | string | `'head'` or `'tail'` | `'tail'` only for `isHold` notes |

`ScoreState` (every field is an integer except `accuracy` and `completion`):

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| score | int | >= 0 | 0 | `sum(basePoints * multiplierAtJudgment)` with base 100/70/40/0 and multiplier `min(4, 1 + floor(combo / 10))` evaluated before the combo is updated by the current judgment |
| combo | int | >= 0 | 0 | reset to 0 on miss or hold break |
| maxCombo | int | >= 0 | 0 | `>= combo` |
| counts | object | `{perfect, great, good, miss}` ints | zeros | `perfect + great + good + miss === judged` |
| judged | int | >= 0 | 0 | `<= total` |
| total | int | >= 0 | chart head count + hold tail count | fixed for a chart |
| accuracy | float | 0-1 | 0 | `(100 * perfect + 70 * great + 40 * good) / (100 * judged)`, 0 when `judged === 0` |
| completion | float | 0-1 | 0 | `judged / total`, or the fraction of song ticks elapsed when the chart is empty |

#### 5.1.7 Input types (M-07)

`InputEvent`:

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| source | string | `'keyboard'`, `'pointer'`, `'gamepad'`, `'midi'`, `'system'` | | `'system'` only for synthetic releases on blur, visibility change, pagehide, device disconnect |
| control | string | `lane0`..`lane3`, `dance0`..`dance3`, `pause`, `panic`, `octUp`, `octDown`, `profile1`..`profile6`, `sustain`, `note:<0-127>` (MIDI direct pitch) | | known name |
| type | string | `'press'` or `'release'` | | a release always follows a press of the same control (M-07 lifecycle) |
| tPerf | float | ms, `performance.now()` time base | | finite |
| tAudio | float | audio seconds via `Input.perfToAudio` (Part 4.5) | | finite; monotonic per control |
| pressure | float | 0-1 | 1 | pointer pressure, gamepad analog value or MIDI velocity / 127 |

`Calibration`: `inputOffsetMs` int -200..200 (default 0), `audioLatencyMs` int 0..500
(default 0), `visualLeadMs` int 600..3,000 (default 1500). Built by
`Settings.calibration()` from the settings document (5.11) and applied as in 5.12.

#### 5.1.8 Character, Project, RecordingTake, NetMessage

`CharacterConfig` field table: 5.10. `Chart`, `ChartNote`, `DanceChart`, `DanceStep`: 5.9.

`Project` (M-15):

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| format | string | const `'flm-project'` | | const |
| version | int | const 1 for this plan | 1 | loader refuses > 1 (5.7) |
| id | id | `uid('prj')` | | unique in the project index |
| name | string | 1-80 chars | `"New project"` | never empty |
| song | Song | | `Song.create()` | valid per 5.1.1 |
| charts | Chart[] | 0-64 | `[]` | `chart.songId === song.id`; `chart.trackId` exists; unique `(trackId, difficulty, profile)` |
| danceCharts | DanceChart[] | 0-16 | `[]` | `songId === song.id`; unique `(difficulty, source)` for generated charts |
| characters | CharacterConfig[] | 0-5 | `[]` | `slot` unique; `instrument` refers to an existing track id or is `null` |
| mixer | object | `{master:{gain: float 0-1}, reverb:{enabled: bool, amount: float 0-1}}` | `{master:{gain:0.8}, reverb:{enabled:false, amount:0.2}}` | ranges |
| settings | object | `{key: int 0-11, scale: string, tempoOverride: int 20-300 or null, timeSig:{numerator, denominator}}` | `{key:0, scale:'major', tempoOverride:null, timeSig:{numerator:4, denominator:4}}` | `scale` is a scale id from M-02 or `custom:<semitone list joined by '.'>`; `timeSig` equals `song.meterMap.entries[0]` (repaired on load) |
| recordings | RecordingTake[] | 0-32 | `[]` | at most one take with `status:'complete'` per `trackId`; `trackId` exists |
| history | object | always `{}` on disk | `{}` | in memory `FLM.Project` keeps the UndoStack elsewhere; the serializer writes `{}` |
| createdAt | ISO | | now | none |
| modifiedAt | ISO | | now | `>= createdAt` |
| sizeBytes | int | >= 0 | 0 | set to the serialized UTF-8 byte length at the last save; 0 for never-saved projects |
| x | object | free-form extension namespace, <= 64 KB serialized | absent | preserved verbatim on load and save |

`RecordingTake`:

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| id | id | `uid('take')` | | unique in project |
| trackId | id | | | existing track at save time; orphaned takes are moved to `x.orphans.recordings` on load with warning `W-PRJ-ORPHAN-TAKE` |
| startedAt | ISO | | | none |
| events | NoteEvent[] | 0-100,000 | `[]` | sorted; ticks relative to song tick 0 (count-in excluded) |
| countIn | int | 0, 1 or 2 bars | 1 | none |
| tempoAtRecord | int | 20-300 BPM (the effective tempo at tick 0 during the take) | | informational |
| status | string | `'complete'` or `'aborted'` | | `'aborted'` takes are dropped at save and never replace a previous take |
| loopPass | int | >= 1 | 1 | pass number when recorded in loop mode with "keep all passes" |

`NetMessage` envelope (M-24): `v` int const 1; `type` string from the 5.16 table; `seq`
int 0..4,294,967,295, strictly increasing per sender per session; `from` id (peer id,
`uid('p')` truncated to 10 chars); `tSend` float, sender's local audio-clock seconds;
`payload` object per type. Serialized as one JSON text; total length <= 65,536 bytes.

### 5.2 Event ordering

`Model.compareEvents(a, b)` is the total order of every `track.events` array:

```js
// kind priority: lower sorts first at an equal tick
const KIND_RANK = { program: 0, cc: 1, bend: 2, note: 3, text: 4 };
function compareEvents(a, b) {
  if (a.tick !== b.tick) return a.tick - b.tick;
  const ka = KIND_RANK[a.kind], kb = KIND_RANK[b.kind];
  if (ka !== kb) return ka - kb;
  if (a.channel !== b.channel) return (a.channel | 0) - (b.channel | 0);
  if (a.kind === 'note') {
    if (a.pitch !== b.pitch) return a.pitch - b.pitch;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  }
  if (a.kind === 'cc' && a.controller !== b.controller) return a.controller - b.controller;
  return 0; // stable sort keeps insertion order for the remaining ties
}
```

Rules:

1. Program changes sort before controllers, bends and notes at the same tick so that a
   note starting at the tick of a program change uses the new program (B 11.4, P 6.1).
2. During import, raw MIDI note-off-like events (note-off, note-on velocity 0) are paired
   into `NoteEvent.durTicks` before they ever enter `track.events`; while pairing, at an
   equal raw tick note-offs are processed before note-ons so that a repeated pitch at the
   same tick closes the previous note first (E 3.1). The paired model never contains
   note-off events.
3. `track.events` is always sorted. The only mutation entry points are
   `Model.insertEvent(track, evt)` (binary-search insert), `Model.removeEvent(track, evt)`,
   `Model.replaceEvents(track, events)` (sorts with `Array.prototype.sort` using the
   comparator, which is stable in ES2019+) and `Model.moveEvents` (remove then insert).
   `Model.validate` reports `E-MDL-004` when the invariant does not hold; the
   project loader repairs by re-sorting and records warning `W-PRJ-RESORTED`.
4. Text events sort last so that a marker at the tick of a note does not change note
   scheduling order.

### 5.3 TempoMap

Representation: `entries` array per 5.1.4, kept sorted by tick with unique ticks. The
serialized form is `[{tick, usPerQuarter}]`; `secondsAt` is rebuilt at load and after every
change by `rebuild()`:

```js
rebuild() {
  // 1. sort by tick (stable); 2. when several entries share a tick keep the LAST one in
  //    input order (last wins), drop the others; 3. if entries[0].tick !== 0 insert
  //    {tick:0, usPerQuarter:500000} with warning W-TEMPO-IMPLICIT-START;
  // 4. cumulative seconds:
  let s = 0;
  for (let i = 0; i < e.length; i++) {
    if (i > 0) s += (e[i].tick - e[i - 1].tick) * e[i - 1].usPerQuarter / (960 * 1e6);
    e[i].secondsAt = s;
  }
}
ticksToSeconds(tick) {
  // binary search for the last entry with entry.tick <= tick (tick may be fractional for
  // interpolation; negative ticks use entries[0].usPerQuarter)
  const i = lastIndexAtOrBefore(tick);
  const en = e[Math.max(0, i)];
  return en.secondsAt + (tick - en.tick) * en.usPerQuarter / (960 * 1e6);
}
secondsToTicks(sec) {
  // binary search over secondsAt for the last entry with secondsAt <= sec
  const i = lastIndexAtOrBeforeSeconds(sec);
  const en = e[Math.max(0, i)];
  return en.tick + (sec - en.secondsAt) * (960 * 1e6) / en.usPerQuarter; // float ticks
}
```

Decisions:

- Default tempo when a source defines none: 120 BPM = 500,000 us per quarter (B/E 3.2);
  the importer records warning `W-MIDI-NO-TEMPO` (info) so the UI never presents the
  default as a source fact.
- Same-tick duplicates: last wins (the later event in file order is the one a sequencer
  would apply last).
- `secondsToTicks` returns a float; callers that need an integer use `Math.round` and the
  `Transport` keeps the float position internally (ADR-05).
- Precision: all values are IEEE doubles. Cumulative seconds over 24 h at the fastest
  tempo (300 BPM, 1,382,400,000 ticks) carry a relative error below 1e-12, i.e. under 1 us;
  the unit test `UT-03` series asserts `abs(ticksToSeconds(secondsToTicks(s)) - s) < 1e-9`
  for 10,000 random seconds over a 200-entry map.
- Playback speed is not part of the map: `Transport` divides elapsed audio seconds by the
  speed factor before calling `secondsToTicks` (Part 6 M-04). The map therefore gives
  song-time seconds, never wall-clock seconds.
- `tempoOverride` (5.1.8) is implemented by `Transport` substituting a one-entry map
  `[{tick:0, usPerQuarter: round(60e6 / bpm)}]`; `song.tempoMap` is not modified.
- Mutation API: `TempoMap.set(tick, usPerQuarter)` (insert or replace), `remove(tick)`
  (refused for tick 0), both followed by `rebuild()` and the emission of
  `project.changed` by the calling command.

### 5.4 MeterMap and KeyMap operations

`MeterMap`:

```js
entryAt(tick)      // last entry with entry.tick <= tick (entries[0] for tick < 0)
barAt(tick)        // -> {bar, beat, tickInBeat, barStartTick, ticksPerBar, ticksPerBeat}
                   // bar and beat are 0-based ints; walks entries accumulating whole bars
                   // per segment: barsInSegment = floor((segEnd - segStart) / ticksPerBar)
beatAt(tick)       // -> float beats since tick 0 (sum of whole beats per segment plus the
                   // fractional beat in the current segment); used for grid snapping
tickOfBar(bar)     // -> start tick of 0-based bar; inverse of barAt().bar
tickOfBeat(bar, beat) // -> tickOfBar(bar) + beat * ticksPerBeat of that bar's meter
barCount(durationTicks) // -> ceil over segments; at least 1
set(tick, numerator, denominator) / remove(tick) // tick 0 cannot be removed
```

Invariants: a meter change that falls inside a bar of the previous meter starts a new bar
at its own tick (partial bars are allowed, as in SMF); `barAt` is monotonic in tick.

`KeyMap`: `keyAt(tick)` returns the last entry with `tick <= tick`, or
`{tick:0, fifths:0, mode:'major'}` when the map is empty; `set(tick, fifths, mode)`,
`remove(tick)`. `FLM.Theory.tonicOf(fifths, mode)` and `Theory.spell(pitch, fifths)` consume
these entries for note naming (Part 6 M-02).

### 5.5 `flm-project` version 1 schema

Decisions:

- Field order in serialized documents is the order of `properties` below; the serializer
  (`Project.serialize`) builds objects in this order so that diffs and hashes are stable.
- `required` lists every field the loader needs; defaults from 5.1 fill optional fields.
- `additionalProperties: false` on every object except `x`. Before validation,
  `Project.hoistUnknown(doc)` moves any unknown property of a known object into that
  object's `x.unknown[<name>]` and records warning `W-PRJ-UNKNOWN-FIELD` (one per distinct
  path, max 50). `x` is written back unchanged on save, so unknown data survives a
  load/save cycle (E 5.3).
- Numbers use JSON numbers; ticks and other ints are validated with `"type":"integer"`.
- The schema is embedded as data in `src/15-project.js` (`FLM.Project.SCHEMA_V1`) and
  checked by a small built-in validator `Project.validateSchema(doc, schema)` supporting
  exactly the keywords used here: `type`, `const`, `enum`, `properties`, `required`,
  `additionalProperties`, `items`, `minItems`, `maxItems`, `minimum`, `maximum`,
  `minLength`, `maxLength`, `pattern`, `oneOf` (discriminated by `kind`), `$ref` to
  `#/definitions/*`.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "flm-project-v1",
  "title": "Finger Lickin Music project, format flm-project version 1",
  "type": "object",
  "additionalProperties": false,
  "required": ["format", "version", "id", "name", "createdAt", "modifiedAt", "song"],
  "properties": {
    "format": { "const": "flm-project" },
    "version": { "const": 1 },
    "id": { "$ref": "#/definitions/id" },
    "name": { "type": "string", "minLength": 1, "maxLength": 80 },
    "createdAt": { "$ref": "#/definitions/iso" },
    "modifiedAt": { "$ref": "#/definitions/iso" },
    "sizeBytes": { "type": "integer", "minimum": 0 },
    "settings": {
      "type": "object", "additionalProperties": false,
      "required": ["key", "scale", "tempoOverride", "timeSig"],
      "properties": {
        "key": { "type": "integer", "minimum": 0, "maximum": 11 },
        "scale": { "type": "string", "minLength": 1, "maxLength": 64,
                   "pattern": "^([a-z][a-z0-9-]*|custom:(0)(\\.[0-9]{1,2}){1,11})$" },
        "tempoOverride": { "oneOf": [ { "type": "null" },
                           { "type": "integer", "minimum": 20, "maximum": 300 } ] },
        "timeSig": { "$ref": "#/definitions/meterEntryNoTick" },
        "x": { "type": "object" }
      }
    },
    "mixer": {
      "type": "object", "additionalProperties": false, "required": ["master"],
      "properties": {
        "master": { "type": "object", "additionalProperties": false, "required": ["gain"],
                    "properties": { "gain": { "type": "number", "minimum": 0, "maximum": 1 } } },
        "reverb": { "type": "object", "additionalProperties": false,
                    "required": ["enabled", "amount"],
                    "properties": { "enabled": { "type": "boolean" },
                                    "amount": { "type": "number", "minimum": 0, "maximum": 1 } } },
        "x": { "type": "object" }
      }
    },
    "song": { "$ref": "#/definitions/song" },
    "charts": { "type": "array", "maxItems": 64, "items": { "$ref": "#/definitions/chart" } },
    "danceCharts": { "type": "array", "maxItems": 16, "items": { "$ref": "#/definitions/danceChart" } },
    "characters": { "type": "array", "maxItems": 5, "items": { "$ref": "#/definitions/character" } },
    "recordings": { "type": "array", "maxItems": 32, "items": { "$ref": "#/definitions/take" } },
    "history": { "type": "object", "additionalProperties": false, "properties": {} },
    "x": { "type": "object" }
  },
  "definitions": {
    "id": { "type": "string", "pattern": "^[A-Za-z0-9_.:-]{1,64}$" },
    "iso": { "type": "string",
             "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,3})?Z$" },
    "tick": { "type": "integer", "minimum": 0, "maximum": 2147483647 },
    "midi7": { "type": "integer", "minimum": 0, "maximum": 127 },
    "channel": { "type": "integer", "minimum": 0, "maximum": 15 },
    "color": { "type": "string", "pattern": "^#[0-9a-f]{6}$" },
    "meterEntryNoTick": {
      "type": "object", "additionalProperties": false,
      "required": ["numerator", "denominator"],
      "properties": { "numerator": { "type": "integer", "minimum": 1, "maximum": 32 },
                      "denominator": { "enum": [1, 2, 4, 8, 16, 32, 64] } }
    },
    "song": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "title", "ppq", "tempoMap", "meterMap", "tracks", "durationTicks"],
      "properties": {
        "id": { "$ref": "#/definitions/id" },
        "title": { "type": "string", "minLength": 1, "maxLength": 120 },
        "artist": { "type": "string", "maxLength": 120 },
        "source": { "$ref": "#/definitions/sourceInfo" },
        "ppq": { "const": 960 },
        "tempoMap": { "type": "array", "minItems": 1, "maxItems": 10000,
          "items": { "type": "object", "additionalProperties": false,
                     "required": ["tick", "usPerQuarter"],
                     "properties": { "tick": { "$ref": "#/definitions/tick" },
                                     "usPerQuarter": { "type": "integer", "minimum": 1, "maximum": 16777215 } } } },
        "meterMap": { "type": "array", "minItems": 1, "maxItems": 10000,
          "items": { "type": "object", "additionalProperties": false,
                     "required": ["tick", "numerator", "denominator"],
                     "properties": { "tick": { "$ref": "#/definitions/tick" },
                                     "numerator": { "type": "integer", "minimum": 1, "maximum": 32 },
                                     "denominator": { "enum": [1, 2, 4, 8, 16, 32, 64] } } } },
        "keyMap": { "type": "array", "maxItems": 10000,
          "items": { "type": "object", "additionalProperties": false,
                     "required": ["tick", "fifths", "mode"],
                     "properties": { "tick": { "$ref": "#/definitions/tick" },
                                     "fifths": { "type": "integer", "minimum": -7, "maximum": 7 },
                                     "mode": { "enum": ["major", "minor"] } } } },
        "tracks": { "type": "array", "maxItems": 32, "items": { "$ref": "#/definitions/track" } },
        "markers": { "type": "array", "maxItems": 1000,
          "items": { "type": "object", "additionalProperties": false,
                     "required": ["tick", "label", "kind"],
                     "properties": { "tick": { "$ref": "#/definitions/tick" },
                                     "label": { "type": "string", "minLength": 1, "maxLength": 80 },
                                     "kind": { "enum": ["section", "cue"] } } } },
        "durationTicks": { "$ref": "#/definitions/tick" },
        "createdAt": { "$ref": "#/definitions/iso" },
        "modifiedAt": { "$ref": "#/definitions/iso" },
        "idSeq": { "type": "integer", "minimum": 1 },
        "x": { "type": "object" }
      }
    },
    "sourceInfo": {
      "type": "object", "additionalProperties": false, "required": ["format"],
      "properties": {
        "format": { "enum": ["builtin", "midi", "musicxml", "guitarpro", "audio", "recorded", "empty"] },
        "fileName": { "type": "string", "maxLength": 255 },
        "version": { "type": "string", "maxLength": 80 },
        "warnings": { "type": "array", "maxItems": 500, "items": { "$ref": "#/definitions/warning" } },
        "warningsDropped": { "type": "integer", "minimum": 0 },
        "importedAt": { "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/iso" } ] },
        "fileSizeBytes": { "type": "integer", "minimum": 0 },
        "fileHash": { "type": "string", "pattern": "^([0-9a-f]{8})?$" },
        "x": { "type": "object" }
      }
    },
    "warning": {
      "type": "object", "additionalProperties": false, "required": ["code", "message", "severity"],
      "properties": {
        "code": { "type": "string", "pattern": "^W-[A-Z]+-[A-Z0-9-]+$" },
        "message": { "type": "string", "minLength": 1, "maxLength": 200 },
        "severity": { "enum": ["info", "warn", "error"] },
        "location": { "type": "object", "additionalProperties": false,
                      "properties": { "track": { "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/id" } ] },
                                      "tick": { "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/tick" } ] } } },
        "count": { "type": "integer", "minimum": 1 }
      }
    },
    "track": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "name", "channel", "program", "isDrums", "events", "mix", "lockedSource"],
      "properties": {
        "id": { "$ref": "#/definitions/id" },
        "name": { "type": "string", "minLength": 1, "maxLength": 80 },
        "kind": { "enum": ["midi", "audio"] },
        "channel": { "$ref": "#/definitions/channel" },
        "program": { "$ref": "#/definitions/midi7" },
        "bankMsb": { "$ref": "#/definitions/midi7" },
        "bankLsb": { "$ref": "#/definitions/midi7" },
        "isDrums": { "type": "boolean" },
        "events": { "type": "array", "maxItems": 100000, "items": { "$ref": "#/definitions/event" } },
        "mix": { "type": "object", "additionalProperties": false,
                 "required": ["gain", "pan", "mute", "solo"],
                 "properties": { "gain": { "type": "number", "minimum": 0, "maximum": 2 },
                                 "pan": { "type": "number", "minimum": -1, "maximum": 1 },
                                 "mute": { "type": "boolean" }, "solo": { "type": "boolean" } } },
        "color": { "$ref": "#/definitions/color" },
        "visible": { "type": "boolean" },
        "lockedSource": { "type": "boolean" },
        "derived": { "type": "boolean" },
        "sourceTrackId": { "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/id" } ] },
        "idSeq": { "type": "integer", "minimum": 1 },
        "audioRef": { "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/audioRef" } ] },
        "x": { "type": "object" }
      }
    },
    "audioRef": {
      "type": "object", "additionalProperties": false,
      "required": ["fileName", "durationS", "sampleRate", "channels", "syncOffsetMs", "sizeBytes"],
      "properties": {
        "fileName": { "type": "string", "maxLength": 255 },
        "durationS": { "type": "number", "minimum": 0, "maximum": 7200 },
        "sampleRate": { "type": "integer", "minimum": 0, "maximum": 192000 },
        "channels": { "type": "integer", "minimum": 0, "maximum": 2 },
        "syncOffsetMs": { "type": "integer", "minimum": -30000, "maximum": 30000 },
        "sizeBytes": { "type": "integer", "minimum": 0 }
      }
    },
    "event": {
      "oneOf": [
        { "type": "object", "additionalProperties": false,
          "required": ["kind", "tick", "durTicks", "pitch", "velocity", "channel", "id"],
          "properties": { "kind": { "const": "note" }, "tick": { "$ref": "#/definitions/tick" },
                          "durTicks": { "type": "integer", "minimum": 1, "maximum": 2147483647 },
                          "pitch": { "$ref": "#/definitions/midi7" },
                          "velocity": { "type": "integer", "minimum": 1, "maximum": 127 },
                          "offVelocity": { "$ref": "#/definitions/midi7" },
                          "channel": { "$ref": "#/definitions/channel" },
                          "id": { "$ref": "#/definitions/id" } } },
        { "type": "object", "additionalProperties": false,
          "required": ["kind", "tick", "controller", "value", "channel"],
          "properties": { "kind": { "const": "cc" }, "tick": { "$ref": "#/definitions/tick" },
                          "controller": { "$ref": "#/definitions/midi7" },
                          "value": { "$ref": "#/definitions/midi7" },
                          "channel": { "$ref": "#/definitions/channel" } } },
        { "type": "object", "additionalProperties": false,
          "required": ["kind", "tick", "program", "channel"],
          "properties": { "kind": { "const": "program" }, "tick": { "$ref": "#/definitions/tick" },
                          "program": { "$ref": "#/definitions/midi7" },
                          "bankMsb": { "$ref": "#/definitions/midi7" },
                          "bankLsb": { "$ref": "#/definitions/midi7" },
                          "channel": { "$ref": "#/definitions/channel" } } },
        { "type": "object", "additionalProperties": false,
          "required": ["kind", "tick", "value", "channel"],
          "properties": { "kind": { "const": "bend" }, "tick": { "$ref": "#/definitions/tick" },
                          "value": { "type": "integer", "minimum": -8192, "maximum": 8191 },
                          "channel": { "$ref": "#/definitions/channel" } } },
        { "type": "object", "additionalProperties": false,
          "required": ["kind", "tick", "type", "text"],
          "properties": { "kind": { "const": "text" }, "tick": { "$ref": "#/definitions/tick" },
                          "type": { "enum": ["text", "lyric", "marker", "cue", "copyright",
                                             "instrument", "trackName", "other"] },
                          "text": { "type": "string", "maxLength": 1024 } } }
      ]
    },
    "chart": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "songId", "trackId", "instrument", "difficulty", "profile", "notes",
                   "generatorVersion", "settingsHash"],
      "properties": {
        "id": { "$ref": "#/definitions/id" },
        "songId": { "$ref": "#/definitions/id" },
        "trackId": { "$ref": "#/definitions/id" },
        "instrument": { "$ref": "#/definitions/midi7" },
        "difficulty": { "enum": ["beginner", "intermediate", "advanced", "expert"] },
        "profile": { "enum": ["A", "B", "C", "D", "E", "F"] },
        "notes": { "type": "array", "maxItems": 100000,
          "items": { "type": "object", "additionalProperties": false,
                     "required": ["id", "tick", "durTicks", "lanes", "sourceEventIds", "pitches", "isHold"],
                     "properties": { "id": { "$ref": "#/definitions/id" },
                                     "tick": { "$ref": "#/definitions/tick" },
                                     "durTicks": { "type": "integer", "minimum": 1 },
                                     "lanes": { "type": "array", "minItems": 1, "maxItems": 4,
                                                "items": { "type": "integer", "minimum": 0, "maximum": 3 } },
                                     "sourceEventIds": { "type": "array", "maxItems": 16,
                                                         "items": { "$ref": "#/definitions/id" } },
                                     "pitches": { "type": "array", "maxItems": 16,
                                                  "items": { "$ref": "#/definitions/midi7" } },
                                     "isHold": { "type": "boolean" } } } },
        "generatorVersion": { "type": "integer", "minimum": 1 },
        "settingsHash": { "type": "string", "pattern": "^[0-9a-f]{8}$" },
        "omittedSourceEventIds": { "type": "integer", "minimum": 0 },
        "source": { "enum": ["generated", "imported"] },
        "x": { "type": "object" }
      }
    },
    "danceChart": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "songId", "difficulty", "steps", "generatorVersion", "layout"],
      "properties": {
        "id": { "$ref": "#/definitions/id" },
        "songId": { "$ref": "#/definitions/id" },
        "difficulty": { "enum": ["easy", "normal", "hard"] },
        "steps": { "type": "array", "maxItems": 20000,
          "items": { "type": "object", "additionalProperties": false,
                     "required": ["id", "tick", "durTicks", "directions", "isHold"],
                     "properties": { "id": { "$ref": "#/definitions/id" },
                                     "tick": { "$ref": "#/definitions/tick" },
                                     "durTicks": { "type": "integer", "minimum": 1 },
                                     "directions": { "type": "array", "minItems": 1, "maxItems": 2,
                                                     "items": { "type": "integer", "minimum": 0, "maximum": 3 } },
                                     "isHold": { "type": "boolean" } } } },
        "generatorVersion": { "type": "integer", "minimum": 1 },
        "layout": { "enum": ["arrows", "pads"] },
        "settingsHash": { "type": "string", "pattern": "^[0-9a-f]{8}$" },
        "source": { "enum": ["generated", "imported"] },
        "name": { "type": "string", "maxLength": 80 },
        "x": { "type": "object" }
      }
    },
    "character": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "name", "body", "heightScale", "skin", "hair", "face", "top", "bottom",
                   "shoes", "accessories", "instrument", "slot", "animationStyle", "version"],
      "properties": {
        "id": { "$ref": "#/definitions/id" },
        "name": { "type": "string", "minLength": 1, "maxLength": 24 },
        "body": { "enum": ["slim", "average", "broad"] },
        "heightScale": { "type": "number", "minimum": 0.9, "maximum": 1.1 },
        "skin": { "type": "string", "pattern": "^skin[1-8]$" },
        "hair": { "$ref": "#/definitions/styledPart" },
        "face": { "type": "string", "pattern": "^face[1-4]$" },
        "top": { "$ref": "#/definitions/styledPart" },
        "bottom": { "$ref": "#/definitions/styledPart" },
        "shoes": { "$ref": "#/definitions/styledPart" },
        "accessories": { "type": "array", "maxItems": 5,
                         "items": { "enum": ["hat", "glasses", "headphones", "scarf", "wristband"] } },
        "instrument": { "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/id" } ] },
        "slot": { "type": "integer", "minimum": 0, "maximum": 4 },
        "animationStyle": { "enum": ["calm", "normal", "energetic"] },
        "version": { "const": 1 },
        "x": { "type": "object" }
      }
    },
    "styledPart": {
      "type": "object", "additionalProperties": false, "required": ["style", "color"],
      "properties": { "style": { "type": "string", "pattern": "^[a-z0-9-]{1,24}$" },
                      "color": { "$ref": "#/definitions/color" } }
    },
    "take": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "trackId", "startedAt", "events", "countIn", "tempoAtRecord", "status"],
      "properties": {
        "id": { "$ref": "#/definitions/id" },
        "trackId": { "$ref": "#/definitions/id" },
        "startedAt": { "$ref": "#/definitions/iso" },
        "events": { "type": "array", "maxItems": 100000, "items": { "$ref": "#/definitions/event" } },
        "countIn": { "enum": [0, 1, 2] },
        "tempoAtRecord": { "type": "integer", "minimum": 20, "maximum": 300 },
        "status": { "enum": ["complete", "aborted"] },
        "loopPass": { "type": "integer", "minimum": 1 },
        "x": { "type": "object" }
      }
    }
  }
}
```

Example document (a one-track Studio project with one recorded note; charts omitted):

```json
{
  "format": "flm-project",
  "version": 1,
  "id": "prj_4k2m9x1q0z",
  "name": "First riff",
  "createdAt": "2026-10-25T12:00:00.000Z",
  "modifiedAt": "2026-10-25T12:03:12.418Z",
  "sizeBytes": 1184,
  "settings": { "key": 9, "scale": "minor-pentatonic", "tempoOverride": 100,
                "timeSig": { "numerator": 4, "denominator": 4 } },
  "mixer": { "master": { "gain": 0.8 }, "reverb": { "enabled": false, "amount": 0.2 } },
  "song": {
    "id": "song_7hd0p2ls8e", "title": "First riff", "artist": "",
    "source": { "format": "recorded", "fileName": "", "version": "", "warnings": [],
                "warningsDropped": 0, "importedAt": null, "fileSizeBytes": 0, "fileHash": "" },
    "ppq": 960,
    "tempoMap": [ { "tick": 0, "usPerQuarter": 600000 } ],
    "meterMap": [ { "tick": 0, "numerator": 4, "denominator": 4 } ],
    "keyMap": [ { "tick": 0, "fifths": 0, "mode": "minor" } ],
    "tracks": [
      { "id": "t1", "name": "Electric Bass (finger)", "kind": "midi", "channel": 1,
        "program": 33, "bankMsb": 0, "bankLsb": 0, "isDrums": false,
        "events": [
          { "kind": "program", "tick": 0, "program": 33, "bankMsb": 0, "bankLsb": 0, "channel": 1 },
          { "kind": "note", "tick": 0, "durTicks": 960, "pitch": 45, "velocity": 96,
            "offVelocity": 64, "channel": 1, "id": "t1.1" }
        ],
        "mix": { "gain": 1, "pan": 0, "mute": false, "solo": false },
        "color": "#4f8fe8", "visible": true, "lockedSource": false, "derived": false,
        "sourceTrackId": null, "idSeq": 2, "audioRef": null }
    ],
    "markers": [],
    "durationTicks": 960,
    "createdAt": "2026-10-25T12:00:00.000Z",
    "modifiedAt": "2026-10-25T12:03:12.418Z",
    "idSeq": 2
  },
  "charts": [],
  "danceCharts": [],
  "characters": [],
  "recordings": [
    { "id": "take_8sj2kd01aa", "trackId": "t1", "startedAt": "2026-10-25T12:02:40.000Z",
      "events": [ { "kind": "note", "tick": 0, "durTicks": 960, "pitch": 45, "velocity": 96,
                    "offVelocity": 64, "channel": 1, "id": "t1.1" } ],
      "countIn": 1, "tempoAtRecord": 100, "status": "complete", "loopPass": 1 }
  ],
  "history": {}
}
```

### 5.6 Project validation rules and error codes

`Project.deserialize(text or object) -> {ok:true, project, warnings} or {ok:false, error:{code,
message, detail}}` runs these steps in order; the first failing fatal step stops the load.
Repairable findings produce warnings (`W-PRJ-*`) and continue.

| Step | Check | On failure | Code |
|---|---|---|---|
| 1 | Input text length <= 64 MB (UTF-16 code units * 2 as an estimate) | fatal | E-PRJ-010 |
| 2 | `JSON.parse` succeeds | fatal | E-PRJ-001 |
| 3 | Nesting depth <= 32 and total object/array count <= 5,000,000 (counted during a pre-walk) | fatal | E-PRJ-010 |
| 4 | Root is an object with `format === 'flm-project'` | fatal | E-PRJ-003 |
| 5 | `version` is an integer; `version <= 1` | fatal when newer | E-PRJ-002 |
| 6 | `version < 1` (none exist; reserved) -> run `migrate` (5.7) | fatal when migration throws | E-PRJ-012 |
| 7 | `hoistUnknown(doc)` | warning per path | W-PRJ-UNKNOWN-FIELD |
| 8 | Schema validation (5.5) | fatal on the first error; `detail` is the JSON pointer | E-PRJ-004 (missing required) or E-PRJ-005 (type/range/enum/pattern) |
| 9 | Semantic: `song.tracks.length <= 32`, total events <= 1,000,000 | fatal | E-PRJ-009 |
| 10 | Semantic: unique ids (tracks, note events across the song, charts, dance charts, characters, takes) | fatal | E-PRJ-006 |
| 11 | Semantic: references (`chart.trackId`, `chart.songId`, `danceChart.songId`, `character.instrument`, `take.trackId`, `track.sourceTrackId`) | charts and dance charts with a dangling reference are dropped (warning W-PRJ-DROPPED-CHART); takes are moved to `x.orphans.recordings` (W-PRJ-ORPHAN-TAKE); `character.instrument` set to null (W-PRJ-CHARACTER-UNBOUND); `sourceTrackId` dangling -> `derived:false, sourceTrackId:null` (W-PRJ-DERIVED-UNBOUND) | warnings |
| 12 | Semantic: `events` sorted per 5.2 | re-sort | W-PRJ-RESORTED |
| 13 | Semantic: `event.channel === track.channel` for every event | event channels rewritten to the track channel | W-PRJ-CHANNEL-FIXED |
| 14 | Semantic: `tempoMap[0].tick === 0`, `meterMap[0].tick === 0`, unique ticks (last wins) | repaired per 5.3 and 5.4 | W-PRJ-MAP-REPAIRED |
| 15 | Semantic: `durationTicks` equals the recomputed value | recomputed | W-PRJ-DURATION-FIXED |
| 16 | Semantic: `settings.timeSig` equals `meterMap[0]` | `settings.timeSig` overwritten from the map | W-PRJ-TIMESIG-FIXED |
| 17 | Semantic: at most one `status:'complete'` take per track; `'aborted'` takes present | keep the newest complete take per track; drop aborted takes | W-PRJ-TAKES-PRUNED |
| 18 | Semantic: `chart.generatorVersion !== Mapping.ChartGenerator.VERSION` or `settingsHash` mismatch when recomputed | chart dropped and regenerated lazily | W-PRJ-CHART-STALE |
| 19 | Semantic: `character.slot` duplicates; more than 5 characters | later duplicates are reassigned to the lowest free slot; extra characters dropped | W-PRJ-SLOT-FIXED |
| 20 | Semantic: `kind:'audio'` track with `audioRef === null` or `events.length > 0` | `kind` set to `'midi'`, `audioRef` set to null | W-PRJ-AUDIO-FIXED |
| 21 | `x` namespace serialized size > 64 KB | `x` truncated to `{truncated:true}` | W-PRJ-X-TRUNCATED |

Error codes and exact user-facing texts (placeholders in braces are filled at runtime; the
UI shows `message`, and the Diagnostics screen additionally shows `detail`):

| Code | Message | Class (Part 4.9) |
|---|---|---|
| E-PRJ-001 | "This project file is not valid JSON and cannot be opened." | recoverable |
| E-PRJ-002 | "This project was saved by a newer version of Finger Lickin Music (format version {v}; this build reads up to version 1). Open it with the newer version or export it from there as MIDI." | recoverable |
| E-PRJ-003 | "This file is not a Finger Lickin Music project (expected format 'flm-project', found '{format}')." | recoverable |
| E-PRJ-004 | "The project is missing required data at {pointer} and cannot be opened." | recoverable |
| E-PRJ-005 | "The project contains an invalid value at {pointer} and cannot be opened." | recoverable |
| E-PRJ-006 | "The project contains duplicate identifiers ({pointer}) and cannot be opened." | recoverable |
| E-PRJ-007 | "The project refers to data that does not exist ({pointer})." (reserved: only emitted when `strict:true` is passed by tests; normal loads repair per step 11) | recoverable |
| E-PRJ-008 | "The project's musical events are out of order and could not be repaired." (reserved for a repair failure in step 12, e.g. non-integer ticks) | recoverable |
| E-PRJ-009 | "The project exceeds the supported size: {detail} (limits: 32 tracks, 1,000,000 events)." | recoverable |
| E-PRJ-010 | "The project file is too large or too deeply nested to open safely." | recoverable |
| E-PRJ-011 | "The project's tempo or meter data is invalid and could not be repaired." (reserved for step 14 repair failure) | recoverable |
| E-PRJ-012 | "The project could not be upgraded from format version {from} to version 1: {detail}." | recoverable |

Every failed load leaves the currently open project untouched (E 11: "File-import failure
must not corrupt the current project"). `Project.deserialize` never mutates its input object; it
works on a deep clone.

### 5.7 Migration framework

```js
// src/15-project.js
const CURRENT_VERSION = 1;
const MIGRATIONS = {
  // fromVersion: function (doc) -> doc  (returns a NEW object; must not mutate its input)
  // none for version 1; the first future entry will be MIGRATIONS[1] producing version 2
};
function migrate(doc) {
  // doc is already a deep clone of the stored record (Project.deserialize clones before step 6)
  const applied = [];
  let cur = doc;
  while ((cur.version | 0) < CURRENT_VERSION) {
    const step = MIGRATIONS[cur.version];
    if (!step) throw new ProjectError('E-PRJ-012', { from: cur.version, detail: 'no migration path' });
    const next = step(cur);
    if ((next.version | 0) !== (cur.version | 0) + 1) {
      throw new ProjectError('E-PRJ-012', { from: cur.version, detail: 'migration did not advance version' });
    }
    applied.push(cur.version + '->' + next.version);
    cur = next;
  }
  if (cur.version > CURRENT_VERSION) throw new ProjectError('E-PRJ-002', { v: cur.version });
  return { doc: cur, applied };
}
```

Rules:

1. Newer versions are refused with E-PRJ-002 (text in 5.6); the file is never modified.
2. Migrations run on a deep clone. The original stored record (localStorage key or
   IndexedDB record) is not touched until the migrated copy has passed every step of 5.6
   and has been written through the safe-write path of Part 6 M-16; the pre-migration
   record is kept as the `.bak` copy of that write, so a failed or wrong migration can be
   undone by restoring `.bak`.
3. Each migration is a pure function `doc -> doc` that sets `doc.version` to exactly
   `from + 1` and records its name in `doc.x.migrations` (array of strings, appended).
4. A migration must never drop data it does not understand; it moves such data to `x`.
5. Test policy: every migration ships with (a) a fixture document of the old version in
   `src/91-test-project.js`, (b) a test that the migrated document validates against the
   current schema, (c) a test that the fixture's note count, track count, tempo entries and
   markers are preserved, (d) a test that running the migration twice on the same input
   yields identical output (idempotence under deep equality), and (e) a test that the
   original fixture object is deep-equal to itself after migration (no mutation). The same
   fixture/test pattern applies to settings, character, dance chart and progression
   migrations (5.17).
6. The same `migrate` shape is reused by `Dance.migrate`, `Character.migrate`,
   `Progress.migrate` and `Storage.migrateSettings` with their own `MIGRATIONS` tables.

### 5.8 Size accounting and storage routing

`Project.estimateSize(project) -> int bytes` is a constant-time-per-item estimate used for
routing decisions and UI display before serialization:

```text
base            = 2,048
per track       = 1,024 + 48 * notes + 36 * (cc + program + bend) + sum(40 + text.length) over text events
per chart       = 256 + 72 * notes            (sourceEventIds and pitches included)
per dance chart = 256 + 56 * steps
per character   = 1,024
per take        = 256 + 48 * events
x namespaces    = JSON.stringify(x).length for each present x
estimate        = ceil(1.10 * sum)
```

`project.sizeBytes` is set to the exact UTF-8 byte length (`new TextEncoder().encode(text).length`)
after each successful `Project.serialize`, which must complete within 200 ms for 100,000
events on the desktop reference device (PT test in Part 12; measured, not assumed).

Routing rule (`Storage.saveProject`, Part 6 M-16), evaluated at every save:

| Condition | Where the project is written |
|---|---|
| IndexedDB available, `estimateSize <= 2 MB`, `recordings.length === 0` | IndexedDB `projects` store (primary) and localStorage `flm.v1.project.<id>` (mirror); the index entry records `locations:['idb','ls']` |
| IndexedDB available, otherwise | IndexedDB only; `locations:['idb']` |
| IndexedDB unavailable (`Caps.indexedDB === false` or open failed), `estimateSize <= 2 MB` | localStorage only (recordings allowed); `locations:['ls']`; the Library shows the notice "Browser database unavailable: projects are limited to 2 MB each; export regularly." |
| IndexedDB unavailable, `estimateSize > 2 MB` | not persisted; DLG-ProjectTooLarge offers Export (`.flm.json`) and continues unsaved |

Autosave checkpoints (ring of 3 per project, ids `<projectId>.cp0..2`, `kind:'checkpoint'`
in the `projects` store, Part 6 M-15) are the serialized project with these fields
stripped: `recordings` entries with `status:'aborted'`; `charts` and `danceCharts` entries
with `source:'generated'` (regenerated deterministically on restore); `source.warnings`
beyond the first 50; `x` when larger than 8 KB (replaced by `{truncated:true}`). Checkpoints
are never mirrored to localStorage and never counted in the 2 MB rule.

### 5.9 Gameplay data

#### 5.9.1 Chart

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| id | id | `<songId>:<settingsHash>` | computed | unique per project; two charts with equal ids are the same chart |
| songId | id | | | equals the owning song id |
| trackId | id | | | existing track; the chart is generated from that track's (derived) notes |
| instrument | int | 0-127 GM program, or 128 for a drum kit | `track.program` (128 when `isDrums`) | none |
| difficulty | string | `beginner`, `intermediate`, `advanced`, `expert` | | enum |
| profile | string | `A`-`F` | `A` | enum |
| notes | ChartNote[] | 0-100,000 | | sorted by tick then lowest lane; no two notes share (tick, lane); hold tails never overlap a later head in the same lane |
| generatorVersion | int | >= 1 | `Mapping.ChartGenerator.VERSION` (1 in this plan) | regenerate when different |
| settingsHash | string | 8 lowercase hex | computed | see below |
| omittedSourceEventIds | int | >= 0 | 0 | number of source notes of the track that no ChartNote references (reported in SCR-ImportInspect; the source is never modified) |
| source | string | `generated` or `imported` | `generated` | `imported` is reserved for future chart files; v1 only generates |

`settingsHash = hex8(fnv1a32(difficulty + '|' + profile + '|' + generatorVersion + '|' +
trackId + '|' + sourceEventCount))` where `sourceEventCount` is the number of NoteEvents
in the source track and `hex8` is lowercase zero-padded. It is recomputed on load (5.6
step 18) and compared across multiplayer peers (5.16 `ready`); a mismatch means the peers
did not generate the same chart.

#### 5.9.2 ChartNote

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| id | id | `c<base36 ordinal>` ordinal 1.. in generation order | | unique in chart |
| tick | int | >= 0 | | none |
| durTicks | int | >= 1 | 1 for taps | for holds equals the longest source note duration in the group, clamped to the next head in any of its lanes minus 1/32 note (120 ticks) |
| lanes | int[] | 1-4 distinct values 0-3, ascending | | `lanes.length === pitches.length` for profile A chords; otherwise `lanes.length <= pitches.length` |
| sourceEventIds | id[] | 1-16 | | every id exists in the source track; a source id appears in at most one ChartNote |
| pitches | int[] | 1-16 values 0-127, ascending | | the pitches of the referenced source notes (used for sound and the inspection preview) |
| isHold | bool | | false | true implies `durTicks >= 960` (one beat) and difficulty `expert` or an explicit generator option |

The judge treats a ChartNote with `lanes.length > 1` as a chord (all lanes required within
the 50 ms chord tolerance of Part 6 M-09). The audio for a judged ChartNote plays
`pitches` on the chart's instrument; the source track itself is muted or lowered by the
practice settings (Part 8.12).

#### 5.9.3 DanceChart and DanceStep

`DanceChart`:

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| id | id | generated: `<songId>:dance:<settingsHash>`; imported: `uid('dance')` | | unique |
| songId | id | | | existing song |
| difficulty | string | `easy`, `normal`, `hard` | | enum |
| steps | DanceStep[] | 0-20,000 | | sorted by tick; no two steps share (tick, direction); hold tails do not overlap a later step in the same direction; max simultaneous directions: easy 1, normal 2, hard 2 |
| generatorVersion | int | >= 1 | `Dance.DanceChartGenerator.VERSION` (1) | regenerate when different (generated charts only) |
| layout | string | `arrows` or `pads` | `arrows` | display only; directions are the same data |
| settingsHash | string | 8 hex | `hex8(fnv1a32(difficulty + '\|' + profile + '\|' + generatorVersion + '\|' + trackId + '\|' + sourceEventCount))` with profile `F`, trackId = songId and sourceEventCount = NoteEvents of all song tracks (rule of 5.9.1) | recomputed on load for generated charts |
| source | string | `generated` or `imported` | `generated` | imported charts are validated but never regenerated |
| name | string | 0-80 | `""` | imported charts may carry a name |

`DanceStep`:

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| id | id | `d<base36 ordinal>` | | unique in chart |
| tick | int | >= 0 | | none |
| durTicks | int | >= 1 | 1 for taps | holds: >= 1,920 (two beats at 4/4) |
| directions | int[] | 1-2 distinct values; 0 left, 1 down, 2 up, 3 right; ascending | | `directions.length <= 1` on easy |
| isHold | bool | | false | true implies `durTicks >= 1920` |

Dance judging reuses `Rhythm.Judge` with `lanes = directions` (Part 6 M-23).

### 5.10 CharacterConfig, options catalog, presets

`CharacterConfig` (M-22):

| field | type | range/units | default | invariant |
|---|---|---|---|---|
| id | id | `uid('chr')` | | unique in project and in the roster |
| name | string | 1-24 chars | preset name or `"Performer N"` | never empty |
| body | string | `slim`, `average`, `broad` | `average` | rig-affecting |
| heightScale | float | 0.9-1.1, step 0.01 | 1.0 | rig-affecting |
| skin | string | `skin1`..`skin8` (catalog colors) | `skin3` | visual |
| hair | object | `{style: 'none','short','medium','long','curly','mohawk'; color: #rrggbb}` | `{style:'short', color:'#2b1d14'}` | visual; `hat` accessory hides the top of `long`, `medium`, `mohawk` (rendered as `short` under the hat) |
| face | string | `face1`..`face4` | `face1` | visual |
| top | object | `{style: 'tee','shirt','hoodie','jacket','tank','dress'; color}` | `{style:'tee', color:'#3a6ea5'}` | visual; `dress` forces `bottom.style` to `none` in rendering |
| bottom | object | `{style: 'jeans','shorts','skirt','none'; color}` | `{style:'jeans', color:'#2d3a4a'}` | visual |
| shoes | object | `{style: 'sneakers','boots','bare'; color}` | `{style:'sneakers', color:'#f2f2f2'}` | visual |
| accessories | string[] | 0-5 distinct of `hat`, `glasses`, `headphones`, `scarf`, `wristband` | `[]` | `hat` and `headphones` are mutually exclusive (validation replaces the earlier one) |
| instrument | id or null | track id the character performs | null | null = idle performer; set by the Stage when slots are assigned |
| slot | int | 0-4 (stage positions, Part 6 M-21) | lowest free | unique among a project's characters |
| animationStyle | string | `calm`, `normal`, `energetic` | `normal` | visual (scales gesture amplitude 0.7 / 1.0 / 1.3) |
| version | int | const 1 | 1 | `Character.migrate` owns upgrades |

Serialized size cap: a CharacterConfig must serialize to <= 4,096 bytes (invariant checked
by `Character.validate`; names and colors are the only variable-length fields so the cap
cannot be exceeded by valid data; the check guards future options and multiplayer input).

Options catalog (`FLM.Character.OPTIONS`, data in `src/22-character.js`; the full list of
entries is in Part 6 M-22):

```js
CatalogOption {
  id: string,            // 'body.slim', 'hair.style.mohawk', 'hair.color', 'acc.hat', ...
  category: 'body' | 'height' | 'skin' | 'hair' | 'face' | 'top' | 'bottom' | 'shoes' | 'accessory',
  label: string,         // UI text, ASCII, <= 24 chars
  rigAffecting: boolean, // true only for body.* and height (lengths, attachment points)
  params: object         // category-specific: {palette:[...]} for color options,
                         // {styles:[...]} for style options, {min,max,step} for height,
                         // {excludes:[optionId]} for accessories
}
```

`CharacterPreset` (8 shipped presets in `src/30-content.js`, plus user presets in the
roster key of 5.15): `{format:'flm-character', version:1, presetId: string, builtIn: bool,
character: CharacterConfig without id, slot and instrument}`. Applying a preset copies the
appearance fields into an existing CharacterConfig and keeps its `id`, `slot`, `instrument`.

### 5.11 Settings schema

The settings document is one JSON object stored at `flm.v1.settings` (5.15) with
`version: 1` and nested groups. The table lists keys as `group.key`. "Screen" is where the
control appears (Part 7); "Comparable" says whether a non-default value makes results
non-comparable for personal bests and multiplayer (B 9.4, P 5.3): `yes` = results remain
comparable, `NO` = results are flagged `comparable:false` (5.13), `n/a` = not gameplay.

| Key | Type | Range / values | Default | Screen | Comparable |
|---|---|---|---|---|---|
| version | int | const 1 | 1 | none | n/a |
| audio.masterVolume | float | 0-1 | 0.8 | SCR-Settings Audio; HUD transport bar | yes |
| audio.metronomeVolume | float | 0-1 | 0.6 | SCR-Settings Audio; SCR-FreePlay; SCR-Studio | yes |
| audio.metronomeAccent | bool | | true | SCR-Settings Audio | yes |
| audio.polyphonyCap | int | 0 (auto: 64 desktop, 32 mobile), 16-64 | 0 | SCR-Settings Advanced | yes |
| audio.countInBars | int | 1 or 2 | 1 | SCR-FreePlay; SCR-Studio; SCR-QuickPlay options | yes |
| audio.reverbEnabled | bool | | false | SCR-Settings Audio (Phase 14) | yes |
| audio.reverbAmount | float | 0-1 | 0.2 | SCR-Settings Audio | yes |
| calibration.inputOffsetMs | int | -200..200 | 0 | SCR-Settings Calibration; DLG-Calibration | yes |
| calibration.audioLatencyMs | int | 0..500 | 0 | same | yes |
| calibration.visualLeadMs | int | 600..3000 | 1500 | same; SCR-Settings Gameplay as "Note speed" (`x` + (1500 / visualLeadMs).toFixed(1)) | yes |
| input.keymapVersion | int | const 1 | 1 | none | n/a |
| input.keys.lanes | string[4] | KeyboardEvent.code values, distinct | `["KeyA","KeyS","KeyK","KeyL"]` | SCR-Settings Controls | yes |
| input.keys.dance | string[4] | codes | `["ArrowLeft","ArrowDown","ArrowUp","ArrowRight"]` | same | yes |
| input.keys.danceAlt | string[4] | codes | `["KeyD","KeyF","KeyJ","KeyK"]` | same | yes |
| input.keys.pause | string | code | `"Escape"` | same | yes |
| input.keys.panic | string | code | `"KeyP"` (plus `Space` while paused, fixed) | same | yes |
| input.keys.octUp | string | code | `"KeyE"` | same | yes |
| input.keys.octDown | string | code | `"KeyQ"` | same | yes |
| input.keys.profiles | string[6] | codes | `["Digit1",...,"Digit6"]` | same | yes |
| input.keys.sustain | string | code | `"ShiftLeft"` | same | yes |
| input.padLayout | string | `bottom`, `right` (landscape placement; portrait is always bottom) | `bottom` | SCR-Settings Controls; SCR-Pause quick toggle | yes |
| input.padSize | string | `small` (56 px), `medium` (72 px), `large` (88 px) minimum pad height | `medium` | same | yes |
| input.padOpacity | float | 0.3-1 | 0.75 | same | yes |
| input.gamepadEnabled | bool | | true | same | yes |
| input.touchApi | string | `auto`, `pointer`, `touch` (Part 2.19 OQ-1 fallback switch) | `auto` | SCR-Settings Controls | yes |
| input.padsVisible | string | `auto` (pads shown when the device reports touch points), `always`, `never` | `auto` | SCR-Settings Controls | yes |
| input.midiEnabled | bool | effective only in a secure context with Web MIDI | false | same (disabled with reason otherwise) | yes |
| input.midiLaneNotes | int[4] | 0-127 distinct | `[60,62,64,65]` | same | yes |
| input.chordWindowMs | int | 10-60 | 30 | SCR-Settings Advanced | yes |
| gameplay.judgmentPreset | string | `standard`, `relaxed` (windows x1.5), `strict` (x0.75) | `standard` | SCR-Settings Gameplay; SCR-QuickPlay options | NO unless `standard` |
| gameplay.strayPressPenalty | bool | | false | same | yes (stricter) |
| gameplay.showJudgmentText | bool | | true | same | yes |
| gameplay.targetTrackMode | string | `mute`, `lower`, `full` | `lower` | SCR-QuickPlay; SCR-Instrument practice panel | yes |
| gameplay.accompanimentVolume | float | 0-1 | 1.0 | same | yes |
| gameplay.autoCountIn | bool | | true | same | yes |
| gameplay.lifeBar | bool | dance failure rule | false | SCR-Dance options | yes |
| video.tier | string | `auto`, `high`, `balanced`, `low`, `abstract` | `auto` | SCR-Settings Video; SCR-Diagnostics | yes |
| video.resolutionScale | float | 0 (auto) or 0.5-1.0 step 0.05 | 0 | same | yes |
| video.cameraMotion | bool | | true | same; SCR-Pause | yes |
| video.cameraPreset | string | `FullBand`, `Focus`, `Side`, `Overhead`, `Player` | `FullBand` | SCR-Instrument / SCR-Dance HUD camera button | yes |
| video.effectsLevel | int | 0 (off), 1 (reduced), 2 (full) | 2 | SCR-Settings Video | yes |
| video.reducedMotion | string | `system` (follow `prefers-reduced-motion`), `on`, `off` | `system` | SCR-Settings Accessibility | yes |
| video.highContrast | bool | | false | same | yes |
| video.uiScale | float | 0.8-1.5 step 0.05 | 1.0 | SCR-Settings Accessibility | yes |
| video.showStats | bool | FPS and audio stats overlay | false | SCR-Settings Advanced; SCR-Diagnostics | yes |
| video.stageTheme | string | `default` plus unlock ids (5.13) | `default` | SCR-Characters stage tab | yes |
| accessibility.laneGlyphs | bool | glyphs always drawn on notes (forced true when `video.highContrast`) | true | SCR-Settings Accessibility | yes |
| accessibility.screenReaderLabels | bool | `aria-label` on HUD live regions | true | same | yes |
| accessibility.flashOnBeat | bool | HUD beat indicator pulse | false | same | yes |
| accessibility.largeJudgmentText | bool | | false | same | yes |
| privacy | object | no keys: the standalone edition collects nothing; the group exists so the Settings screen can state that | `{}` | SCR-Settings Privacy (informational text only) | n/a |
| net.displayName | string | 1-24 chars | `"Player"` | SCR-Multiplayer lobby | n/a |
| net.stunEnabled | bool | | false | SCR-Multiplayer advanced | n/a |
| net.relayUrl | string | `""` or `ws://`/`wss://` URL <= 200 chars | `""` (from `?online=` when given) | same | n/a |
| onboarding.firstLaunchDone | bool | | false | set by SCR-FirstLaunch | n/a |
| onboarding.inputMode | string | `auto`, `desktop`, `touch` | `auto` | SCR-FirstLaunch step 5; SCR-Settings Controls | n/a |
| onboarding.tutorialDone | bool | | false | SCR-Tutorial | n/a |
| onboarding.audioHintSeen | bool | | false | DLG-AudioBlocked | n/a |
| onboarding.lastMode | string | mode name | `"menu"` | none (used by SCR-MainMenu to highlight) | n/a |
| session.quickPlay | object | `{songId, instrument:int, difficulty, profile}` last used | built-in song 1, track 0's program, `beginner`, `A` | SCR-QuickPlay restores | n/a |
| session.freePlay | object | `{program:int, key:int, scale:string, octave:int 2-6, profile, quantize:bool, noteDurMs:int 50-2000, velocity:int 1-127, sustain:bool}` | `{program:0, key:0, scale:'major', octave:4, profile:'D', quantize:false, noteDurMs:400, velocity:100, sustain:false}` | SCR-FreePlay restores | n/a |
| session.dance | object | `{difficulty, layout, practiceSpeed: float 0.5-1.0}` | `{difficulty:'easy', layout:'arrows', practiceSpeed:1.0}` | SCR-Dance restores | n/a |
| session.libraryFilter | object | `{query:string, sort:'recent' or 'name', scroll:int}` | `{query:'', sort:'recent', scroll:0}` | SCR-Library restores (P 21) | n/a |
| session.lastProjectId | id or null | | null | SCR-Studio reopens | n/a |
| diagnostics.overlay | bool | | false | SCR-Diagnostics | n/a |
| diagnostics.logLevel | string | `info`, `debug` | `info` | same | n/a |
| diagnostics.selfTestLastRun | ISO or null | test build only | null | same | n/a |
| settings.userScales | object[] | up to 64 `{id:string, name:string 1-24 chars, intervals:int[] 0..11 ascending, 0 included}`; the 65th is refused, built-in ids cannot be replaced (Part 6.2) | `[]` | SCR-FreePlay `fp-scale-editor` | n/a |

Rules:

- `Storage.loadSettings()` (M-16) reads the stored document and emits `settings.changed` with
  `source:'load'`; `Settings.load()` (M-27) deep-merges it over the defaults, then clamps every
  numeric value to its range and replaces every invalid enum value with the default,
  recording warning `W-SET-NORMALIZED` once (P 19: invalid settings are normalized
  predictably). Unknown keys are preserved under `x` like projects.
- `Settings.set(path, value)` (M-27) validates and normalizes, then calls `Storage.saveSettings`
  (M-16), which emits `settings.changed` with `{key, value, prev, source}` and persists the
  document (debounced 250 ms; the write is immediate for `onboarding.*`).
- Playback speed (`Transport.speed`) is per session, not a setting; a song-mode result with
  speed != 1.0 is `comparable:false`.
- A settings backup (`.flmsettings.json`, 5.14) contains the whole document including
  `session.*` and `onboarding.*`.

### 5.12 Calibration model

`Calibration = Settings.calibration()` returns `{inputOffsetMs, audioLatencyMs, visualLeadMs}`
(5.1.7). Meaning of each offset:

| Offset | What it corrects | Who reads it | Where applied |
|---|---|---|---|
| audioLatencyMs | the delay between the audio clock time at which a sound is scheduled and the moment it is heard (`AudioContext.outputLatency` plus device latency); measured by the DLG-Calibration tap test or set manually | `Rhythm.Judge`, `Stage` highway | Judge: subtracted from the input time (scoring). Stage: added to the display time of every note so that a note crosses the hit line when its sound is heard. The two uses are display versus scoring and never combine |
| inputOffsetMs | the player's systematic early/late tendency and input device latency | `Rhythm.Judge` only | subtracted from the input time |
| visualLeadMs | how long a note is visible before its hit time (highway travel time) | `Stage` highway, `Dance` highway only | never used in scoring |

The single scoring application point is `Rhythm.Judge.onInput(evt)`:

```js
const judgeOffsetS = (cal.inputOffsetMs + cal.audioLatencyMs) / 1000;   // Calibration.judgeOffsetS()
const tAdj = evt.tAudio - judgeOffsetS;             // the only place calibration touches scoring
const deltaMs = (tAdj - noteAudioTime) * 1000;      // noteAudioTime = Transport.audioTimeAt(note.tick)
```

Prohibited: `Transport`, `Audio.Scheduler`, `Input` and `Mapping` never add or subtract any
calibration value; `Input.perfToAudio` is a pure clock-domain conversion (Part 4.5). The
unit test for Judge asserts that with `inputOffsetMs = 30` and `audioLatencyMs = 20` an
input at `noteAudioTime + 0.050` is judged `perfect` with `deltaMs === 0` and that
changing calibration mid-song affects only inputs received after the change (E 4.1).

Multiplayer: each peer judges with its own calibration locally only for display; the host
judges every peer's inputs with that peer's declared `judgeOffsetMs` carried in the `ready`
message (5.16), so results are comparable and the client cannot gain by lying beyond the
+/- 500 ms bound the host enforces.

### 5.13 Progression records (M-25)

`PerformanceRecord` (stored in `flm.v1.progress.history`, newest first, max 500):

| field | type | range/units | invariant |
|---|---|---|---|
| id | id | `uid('perf')` | unique |
| playedAt | ISO | | none |
| mode | string | `instrument`, `dance`, `multiplayer` | enum |
| songId | id | | none (built-in or project song id) |
| songTitle | string | 1-120 | copied for display when the song is gone |
| chartHash | string | 8 hex; the chart's `settingsHash` | personal-best key together with `songId` |
| instrument | int or null | 0-128 (128 = drums), null for dance | none |
| difficulty | string | instrument or dance difficulty names | enum per mode |
| profile | string or null | `A`-`F`, null for dance | none |
| score | int | >= 0 | from ScoreState |
| accuracy | float | 0-1 | from ScoreState |
| maxCombo | int | >= 0 | none |
| counts | object | `{perfect, great, good, miss}` | sums to `judged` |
| judged, total | int | | `judged <= total` |
| completion | float | 0-1 | none |
| durationS | float | seconds played | none |
| speed | float | 0.25-2.0 | playback speed used |
| settingsSnapshot | object | `{judgmentPreset, inputOffsetMs, audioLatencyMs, visualLeadMs, strayPressPenalty}` | copied at the end of play |
| comparable | bool | | `judgmentPreset === 'standard' && speed === 1.0 && completion === 1` |
| players | object[] or null | multiplayer only: `[{displayName, score, accuracy, maxCombo}]` <= 4 | none |
| version | int | const 1 | none |

`PersonalBest` (`flm.v1.progress.bests`, map keyed by `songId + '|' + chartHash`): `{score,
accuracy, maxCombo, recordId, playedAt}`; updated only from records with
`comparable === true`; `score` and `accuracy` bests are tracked independently.

`Achievement` (catalog of 20 in Part 6 M-25; state in `flm.v1.progress.unlocks`):
`{id: string 'ach-<name>', title: <= 40 chars, description: <= 120 chars, condition:
{type: 'firstClear' | 'accuracyAtLeast' | 'comboAtLeast' | 'clearsCount' | 'instrumentFamily' |
'danceClear' | 'practiceMinutes' | 'dailyCount' | 'recordTake' | 'importFile', params: object},
reward: cosmeticId or null}`.

`UnlockState`: `{version:1, achievements: {achId: ISO unlockedAt}, cosmetics: {cosmeticId:
ISO unlockedAt}, counters: {clears:int, danceClears:int, practiceMinutes:int,
dailyCompleted:int, takesRecorded:int, filesImported:int}}`. Cosmetic catalog: 3 stage
themes (`theme-neon`, `theme-club`, `theme-sunset`), 5 accessories' alternate colors
(`acc-color-<name>`), 2 effects (`fx-sparks-plus`, `fx-trails`); conditions in Part 6 M-25.
Cosmetics never change gameplay data.

`DailyChallenge` (`flm.v1.progress.daily`):

| field | type | invariant |
|---|---|---|
| date | string `YYYYMMDD` local date | one record per date; previous dates are summarized into `counters.dailyCompleted` |
| seed | int | `fnv1a32('daily\|' + date)` |
| songId | id | built-in song chosen by `Prng(seed)`; imported songs are never required |
| mode | string | `instrument` or `dance` (`Prng` 3:1) |
| instrument | int or null | one of the chosen song's tracks' programs |
| difficulty | string | `Prng` over `intermediate`, `advanced` (instrument) or `normal`, `hard` (dance) |
| goal | object | `{type: 'accuracy' or 'combo' or 'score', value: int}`; accuracy goals are permille 850-950, combo goals 20-60, score goals 60-90 percent of the chart's maximum score |
| completedAt | ISO or null | set when a comparable record meets the goal |
| bestResult | object or null | `{score, accuracy, maxCombo, recordId}` |

### 5.14 Export formats

All exports go through `Storage.download(fileName, blob)` (Part 6 M-16). File names are the
project or song name sanitized to `[A-Za-z0-9 _-]`, trimmed to 60 chars, `"export"` when
empty, plus the suffix below. Every exporter is a pure function from model to bytes and has
a round-trip test in Part 12 (FT group) where a reader exists.

| Export | Suffix | Producer | Reader (round trip) |
|---|---|---|---|
| Standard MIDI File | `.mid` | `Midi.write(song, options)` | `Midi.parse` (FT) |
| Project | `.flm.json` | `Project.serialize(project)` (5.5 document, pretty-printed with 1-space indent to keep size down while staying diffable) | `Project.deserialize` (FT) |
| Dance chart | `.flmdance.json` | `Dance.exportChart(chart, song)` | `Dance.importChart` (FT) |
| Character | `.flmchar.json` | `Character.exportPreset(config)` | `Character.importPreset` (FT) |
| Settings backup | `.flmsettings.json` | `Settings.export()` | `Settings.import` (FT) |
| Audio mix | `.wav` | `Audio.renderWav(project, options)` | none (validated by header parse and duration check, FT) |
| Diagnostics | `.flmdiag.json` | `Core.Diagnostics.export()` (Part 10.10) | none |

#### 5.14.1 `.mid` writer rules (M-10)

1. Header: `MThd`, length 6, format 1, `ntrks = 1 + number of exported tracks`, division
   `960` (PPQ). Format 0 is never written.
2. Track 0 (conductor), in this order at each tick, sorted by tick: sequence/track name
   (meta 0x03) = song title at tick 0; copyright (0x02) only when a `TextEvent` of type
   `copyright` exists in any track at tick 0; every `TempoMap` entry as set tempo (0x51,
   3 bytes `usPerQuarter`); every `MeterMap` entry as time signature (0x58: `nn`, `dd =
   log2(denominator)`, `cc = 24`, `bb = 8`); every `KeyMap` entry as key signature (0x59:
   `sf = fifths` as signed byte, `mi = mode === 'minor' ? 1 : 0`); every `Marker` as marker
   (0x06) for `section` and cue point (0x07) for `cue`; end of track (0x2F) at
   `song.durationTicks`.
3. When `project.settings.tempoOverride` is non-null, the conductor track writes exactly
   one tempo event `round(60e6 / tempoOverride)` at tick 0 instead of the song map, because
   that is what the user hears in Studio and Free Play; the UI export dialog states this.
4. One `MTrk` per `Track` with `kind === 'midi'`, in song order, skipping audio tracks
   (warning `W-EXP-AUDIO-SKIPPED` shown once in the export dialog). Per track at tick 0:
   track name (0x03) = `track.name`; instrument name (0x04) only when a `TextEvent` of type
   `instrument` exists; bank select CC 0 and CC 32 when `bankMsb` or `bankLsb` are non-zero;
   program change `0xC0 | ch` with `track.program` unless the track's first `ProgramEvent`
   is at tick 0 (then only the event is written).
5. Channel: `ch = track.isDrums ? 9 : track.channel`; when a non-drum track has
   `channel === 9` the exporter remaps it to the lowest channel not used by any other
   non-drum track (warning `W-EXP-CHANNEL-REMAPPED`); every event of the track uses `ch`.
6. Events in comparator order (5.2). Note pairs: note-on `0x90 | ch, pitch, velocity`
   at `tick`, note-off `0x80 | ch, pitch, offVelocity` at `tick + durTicks`. All note-offs
   due at a tick are emitted before note-ons at that tick. CC -> `0xB0 | ch`; program ->
   `0xC0 | ch`; bend -> `0xE0 | ch, lsb, msb` with `value + 8192`; text events -> meta
   0x01 (`text`, `other`), 0x05 (`lyric`), 0x06 (`marker`), 0x07 (`cue`), 0x02
   (`copyright`), 0x04 (`instrument`), 0x03 (`trackName`, skipped at tick 0 when equal to
   the track name already written).
7. Running status is used for consecutive channel events with the same status byte; meta
   events reset it. Delta times are VLQ (max 4 bytes; a delta over 0x0FFFFFFF is a writer
   error `E-EXP-002`).
8. End of track at `max(last event end tick, song.durationTicks)`.
9. Text is encoded as UTF-8 bytes; the reader decodes UTF-8 and falls back to Latin-1 on
   invalid sequences.
10. Derived notes (sustain layer) are not exported as longer notes: the CC 64 events that
    produced them are exported, so a compliant player reproduces the sustain (round-trip
    preserves the source, not the derivation).

Round-trip table (export then re-import with `Midi.parse`):

| Model data | Preserved | Notes |
|---|---|---|
| Note tick, durTicks, pitch, velocity, offVelocity, channel | yes | exact at PPQ 960 |
| Note ids | no | ids are reassigned on import; charts must be regenerated (they are, deterministically) |
| ControlEvent, ProgramEvent, PitchBendEvent, bank select | yes | exact |
| TextEvent (all types) | yes | type mapping is bijective except `other` -> text 0x01 -> `text` |
| TempoMap, MeterMap, KeyMap, markers | yes | written in the conductor track; same-tick duplicates are already collapsed |
| Track name, program, channel, isDrums | yes | `isDrums` is inferred from channel 9 on re-import |
| Track order | yes | |
| Track color, visible, mix (gain, pan, mute, solo) | no | mix is not written as CC 7/10 to avoid duplicating source controllers; the UI export dialog says "Mixer settings are not part of MIDI" |
| lockedSource, derived, sourceTrackId | no | re-imported tracks are all `lockedSource:true` |
| Song title, artist | title yes (track 0 name); artist no | artist is written as a text event 0x01 `"Artist: <name>"` at tick 0 of track 0 and read back into `artist` when that prefix is present |
| SourceInfo, ImportWarnings | no | the re-import gets its own SourceInfo |
| Charts, dance charts, characters, settings, recordings | no | project-only data; use `.flm.json` |
| Audio tracks | no | skipped with warning |
| tempoOverride | replaces the tempo map (rule 3) | documented in the dialog |

#### 5.14.2 JSON exports

`.flm.json`: exactly the 5.5 document. `.flmdance.json`:

```json
{ "format": "flm-dance", "version": 1,
  "songRef": { "songId": "...", "title": "...", "durationTicks": 0, "bpmAtStart": 120 },
  "chart": { "...DanceChart fields per 5.9.3 with source: 'imported'..." } }
```

Import validation (`Dance.importChart`): schema check with the `danceChart` definition,
then the 5.9.3 invariants; a chart whose `songRef.songId` does not match the current song is
offered anyway with the notice "This chart was made for '{title}'; steps will be aligned to
the current song's ticks." (E 7 "chart and audio have different starting offsets" is handled
by the shared tick timeline, not by an offset field).

`.flmchar.json`: `{format:'flm-character', version:1, presetId, builtIn:false, character:{...}}`
per 5.10 (CharacterPreset). `.flmsettings.json`: `{format:'flm-settings', version:1,
exportedAt: ISO, appVersion: FLM.VERSION, settings: <5.11 document>}`; import runs
`Settings.load` normalization and asks for confirmation (DLG text in Part 7).

#### 5.14.3 WAV export

`Audio.renderWav(project, {durationS, sampleRate:48000}) -> Promise<Blob>`:

1. `durationS = TempoMap.ticksToSeconds(song.durationTicks) + 2.0` (release tail), capped
   at 600 s on desktop and 180 s on mobile (`Caps.isMobile`). A project longer than the cap
   is refused with E-EXP-003 "The mix is longer than the {cap} supported for WAV export on
   this device. Export MIDI instead or shorten the song." and, on mobile, the dialog offers
   the MediaRecorder alternative of OQ-2 (real-time capture of the master bus via
   `MediaStreamAudioDestinationNode`, `audio/webm` or `audio/mp4` as supported, file
   suffix `.webm` or `.m4a`, no conversion).
2. `ctx = new OfflineAudioContext(2, Math.ceil(durationS * 48000), 48000)`;
   `Audio.buildGraph(ctx)` builds the same bus graph as live playback (master gain,
   limiter, channel strips with the project's mix state; metronome bus muted);
   `Audio.scheduleAll(ctx, song, 0)` schedules every event of every unmuted track (solo
   semantics applied) through the same `Instruments` voices; `tempoOverride` applies.
3. `const buf = await ctx.startRendering()`.
4. Encode: RIFF header (`RIFF`, `36 + dataBytes`, `WAVE`, `fmt ` size 16, audioFormat 1,
   channels 2, sampleRate 48000, byteRate 192000, blockAlign 4, bitsPerSample 16, `data`,
   `dataBytes = frames * 4`), then interleaved little-endian 16-bit PCM:
   `s = max(-1, min(1, x)); out = s < 0 ? round(s * 32768) : round(s * 32767)`. No dither.
5. Progress UI is indeterminate (OfflineAudioContext reports none); the dialog is modal
   and cancellable only by closing it (the rendering promise is then ignored and the
   context dropped).
6. The FT test parses the header back, checks `dataBytes === frames * 4`, duration within
   1 ms of the request, and non-zero RMS when the project has notes.

### 5.15 Storage key catalog and IndexedDB schema

localStorage keys (all JSON text; `Storage.safeWriteLocal(key, text)` writes `<key>.tmp`,
reads it back, compares, renames by writing `<key>` then deletes `.tmp`, and keeps the
previous value at `<key>.bak`):

| Key | Contents | Size cap | Written by |
|---|---|---|---|
| `flm.v1.settings` | 5.11 document | 64 KB | Settings |
| `flm.v1.settings.bak` | previous settings | 64 KB | safe write |
| `flm.v1.projects.index` | `{version:1, projects:[ProjectIndexEntry]}` | 64 KB (max 200 entries; oldest non-favorite entries pruned from the index only, never deleting data) | Storage |
| `flm.v1.project.<id>` | 5.5 document (mirror or primary per 5.8) | 2 MB | Storage |
| `flm.v1.project.<id>.bak` | previous version of that project | 2 MB | safe write |
| `flm.v1.project.<id>.tmp` | in-flight write | 2 MB | safe write (removed on success) |
| `flm.v1.characters` | `{version:1, presets:[CharacterPreset]}` user roster | 64 KB (max 16 presets) | Character |
| `flm.v1.progress.history` | `{version:1, records:[PerformanceRecord]}` | 512 KB (500 records) | Progress |
| `flm.v1.progress.bests` | `{version:1, bests:{key: PersonalBest}}` | 128 KB | Progress |
| `flm.v1.progress.unlocks` | UnlockState | 16 KB | Progress |
| `flm.v1.progress.daily` | DailyChallenge | 4 KB | Progress |
| `flm.v1.lock.<id>` | `{tabId, ts}` concurrent-tab guard, one key per open project (Part 6 M-16) | 128 B | Storage |
| `flm.v1.recovery` | `{projectId, savedAt, text}` the unsaved project written synchronously at a `reload`-class failure or on `pagehide` (Part 4.9) | 2 MB | Storage, Boot |
| `flm.v1.ckpt.<id>.<slot>` | checkpoint document, mode `localOnly` only (Part 6 M-16) | 512 KB | Storage |
| `flm.v1.probe` | transient `"1"` written and removed by the storage probe at open | 1 B | Storage |
| `flm.v1.lastSession` | `{mode, projectId, songId, at: ISO}` for the "Continue" entry of SCR-MainMenu | 1 KB | Modes |

`ProjectIndexEntry`: `{id, name, modifiedAt, sizeBytes, trackCount, durationTicks,
sourceFormat, locations:['idb' or 'ls' ...], favorite:bool}`.

Total localStorage budget assumed: 5 MB per origin (the smallest common limit); the Library
screen shows used/estimated space from the sum of key lengths times 2.

IndexedDB `flm-db`, version 1 (`Storage.openDb()`; `onupgradeneeded` creates everything
below; a future version bump adds stores or indexes only and never deletes):

| Store | keyPath | Record shape | Indexes (name: keyPath, unique) |
|---|---|---|---|
| `projects` | `id` | `{id, kind:'project' or 'checkpoint' or 'bak', projectId, name, modifiedAt: ISO, sizeBytes, doc: <5.5 object>}`; checkpoints use `id = projectId + '.cp' + slot`; the safe-write previous version uses `id = projectId + '.bak'` | `byProject: projectId, false`; `byModified: modifiedAt, false`; `byKind: kind, false` |
| `recordings` | `id` | `AudioCapture {id, projectId, createdAt: ISO, mimeType, durationS, sizeBytes, blob: Blob}` (rendered-audio captures from MediaRecorder; MIDI takes live inside the project document) | `byProject: projectId, false` |
| `charts` | `id` | `{id, kind:'dance', songId, name, importedAt: ISO, doc: DanceChart}` (imported custom dance charts not bound to a project) | `bySong: songId, false` |
| `characters` | `id` | `{id, name, modifiedAt: ISO, doc: CharacterPreset}` (mirror of the roster for projects larger than the localStorage roster cap) | `byName: name, false` |

Transactions: one `readwrite` transaction per logical save; `Storage` wraps every request in
a promise with a 10 s timeout (E-STO-004 on timeout after a read-back failure). Safe write
in IndexedDB: put `<id>.tmp` record, get it back and compare `sizeBytes` and
`modifiedAt`, then put `<id>` and copy the old `<id>` to `<id>.bak` in the same
transaction, then delete `<id>.tmp`.

### 5.16 Network payload schemas (protocol version 1)

`FLM.Net.PROTOCOL_VERSION = 1`. Every message is a UTF-8 JSON text (one WebRTC
DataChannel message or one WebSocket text frame) of at most 65,536 bytes parsed with
`JSON.parse` inside try/catch, then validated by `Net.validate(msg)`: `v === 1`; `type` in
the table; `seq` integer, strictly greater than the last `seq` from that peer (duplicates
and reordered messages are dropped and counted); `from` equals the peer id bound to the
channel (the host assigns and checks; a guest accepts only `from === hostId`); `tSend`
finite; `payload` an object with no unknown fields (strict) and sizes within the cap;
strings have no code points below 0x20; depth <= 8. Invalid messages are dropped, counted,
and after 20 invalid messages in 10 s the peer is disconnected with `error` code
`E-NET-010`. Rate limit: 60 messages per second per peer measured over a 1 s sliding
window; excess messages are dropped and counted (`input` first).

| type | Sender -> receiver | Payload fields | Cap | Validation |
|---|---|---|---|---|
| hello | guest -> host, first message after the channel opens; also host -> guest in reply | `protocol:1, appVersion: string <= 32, peerId: id, displayName: string 1-24, avatar: CharacterConfig, mobile: bool, resumeToken: string 0-32` | 8 KB (avatar <= 4 KB) | `protocol === 1` else `error E-NET-003`; `appVersion` major must match else `E-NET-004`; avatar validated by `Character.validate`; `displayName` trimmed, control chars removed |
| roomState | host -> all, on every change and every 2 s | `roomCode: string 6, hostId, mode: 'sync' or 'coop', state: 'lobby' or 'countdown' or 'playing' or 'paused' or 'results', stateSeq: int, players: [{peerId, displayName, avatar, ready: bool, slot: 0-3, trackId: id or null, latencyMs: int, offsetMs: int, connected: bool}] (<= 4), song: {songId, title, durationTicks, sourceHash: 8 hex}, chart: {difficulty, profile, settingsHash}, position: {tick: int, tShared: float}` | 32 KB | guests replace their room view wholesale; `stateSeq` must increase |
| ready | guest -> host; host applies its own locally | `ready: bool, settingsHash: 8 hex, judgmentPreset: 'standard', judgeOffsetMs: int -500..500, trackId: id or null (coop)` | 512 B | `judgmentPreset` must be `'standard'` else `E-NET-006`; `settingsHash` must equal the host's for `sync` mode else `E-NET-005` |
| selectChart | host -> all (lobby only) | `songId, difficulty, profile, trackId, mode: 'sync' or 'coop'` | 512 B | song must be built-in or already shared by `sourceHash` match; guests without the song reply `error E-NET-007` |
| start | host -> all | `stateSeq, tStartShared: float, countInBars: 1 or 2, songId, settingsHash` | 256 B | `tStartShared` must be at least 1.0 s in the future in shared time; otherwise the guest requests a restart via `error E-NET-008` (non-fatal) |
| pause | any -> host (request); host -> all (authoritative) | `stateSeq, tick: int, tShared: float` | 128 B | guests apply only host messages with `stateSeq` greater than the last applied; a pause with an older `stateSeq` than a received resume is ignored (E 8.2) |
| resume | host -> all | `stateSeq, tick, tStartShared` | 128 B | same seq rule; re-anchors the transport at `tick` for `tStartShared` |
| input | guest -> host (host inputs are local) | `control: 'lane0'..'lane3' or 'dance0'..'dance3', type: 'press' or 'release', tShared: float, iSeq: int` | 128 B | `tShared` within [position - 2 s, position + 2 s] else dropped and counted (E 8.2 late message); `iSeq` strictly increasing |
| scoreUpdate | host -> all, 10 Hz while playing and once at results | `tick: int, players: [{peerId, score: int, combo: int, maxCombo: int, accuracyPermille: int 0-1000, judged: int, miss: int, lastJudgment: Judgment or null}]` | 1 KB | host-only; guests display, never compute shared scores (B 17.4) |
| avatar | any -> host; host -> all (lobby only) | `avatar: CharacterConfig` | 4 KB | `Character.validate`; ignored while `state !== 'lobby'` |
| ping | any -> any | `t0: float` (sender local audio time) | 64 B | none |
| pong | reply to ping | `t0: float, t1: float, t2: float` (receive and send times of the replier) | 64 B | `t1 <= t2` |
| leave | any -> all | `reason: 'user' or 'error' or 'timeout'` | 128 B | none; the host removes the player, a guest leaving the host ends the session with results (ADR-07) |
| error | any -> any | `code: 'E-NET-' + 3 digits, message: string <= 200, fatal: bool` | 512 B | `message` is displayed through `textContent` only; `fatal:true` from the host ends the session on the guest |

Clock sync uses `ping`/`pong`: `offset = ((t1 - t0) + (t2 - t3)) / 2` where `t3` is the
local receive time; 8 samples at session start, then one every 10 s; the median of the last
8 is the shared offset (Part 6 M-24). Shared time = host audio clock seconds.

Relay transport (`server/relay.mjs`, Part 3.7) carries the same JSON texts as WebSocket text
frames; the relay reads only `type === 'join'` and `type === 'leave'` control envelopes of
the shape `{v:1, type:'join', room: 6 chars, from}` which are a transport concern and are
not part of the game protocol table above.

### 5.17 Versioning summary

| Persistent artifact | Version field | Current | Migration owner | Policy on mismatch |
|---|---|---|---|---|
| Project document (`.flm.json`, storage) | `version` (format `flm-project`) | 1 | `FLM.Project.migrate` (5.7) | older: migrate on a clone; newer: E-PRJ-002 |
| Settings document | `version` | 1 | `FLM.Storage.migrateSettings` | older: migrate; newer: keep defaults and warn `W-SET-NEWER` without overwriting the stored document until the user changes a setting |
| Key maps inside settings | `input.keymapVersion` | 1 | `FLM.Mapping.migrateKeymap` | older: migrate; unknown codes replaced by defaults with `W-SET-NORMALIZED` |
| Chart (generated) | `generatorVersion` | 1 (`Mapping.ChartGenerator.VERSION`) | none: regenerate | any difference: drop and regenerate (W-PRJ-CHART-STALE) |
| Dance chart (generated) | `generatorVersion` | 1 (`Dance.DanceChartGenerator.VERSION`) | none: regenerate | same |
| Dance chart file (`.flmdance.json`) | `version` (format `flm-dance`) | 1 | `FLM.Dance.migrate` | newer: refuse with E-IMP-012 text "This dance chart file needs a newer version of Finger Lickin Music." |
| Character (`CharacterConfig`, `.flmchar.json`) | `version` | 1 | `FLM.Character.migrate` | newer: refuse with the same pattern (E-IMP-013) |
| Instrument definitions | `FLM.Instruments.DEFS_VERSION` | 1 | none (projects store only GM program numbers) | a definitions change never requires project migration; the About screen shows the version |
| Mapping profile semantics | `FLM.Mapping.PROFILE_VERSION` | 1 | none | folded into `generatorVersion` bumps when chart output changes |
| Progression records | `version` on records and state documents | 1 | `FLM.Progress.migrate` | newer: keep the stored document read-only and show "History saved by a newer version" |
| Net protocol | `NetMessage.v`, `hello.protocol` | 1 | none: no negotiation | mismatch: `error E-NET-003` and disconnect |
| IndexedDB schema | `flm-db` version | 1 | `Storage.openDb` upgrade handler | additive upgrades only |
| localStorage key prefix | `flm.v1.` | v1 | `Storage` | bumped only together with a project version bump; old keys are read once for migration and left in place |
| Test corpus | `test-corpus/MANIFEST.json` `corpusVersion` | 1 | `tools/make-corpus.mjs` | regenerate when the generator changes |
| Diagnostics export | `appVersion = FLM.VERSION` | plan 1.0.0 | none | informational |

Field additions made by this part to the brief's shapes (allowed extensions, all optional
in the schema with defaults): `Song.idSeq`; `Track.kind`, `Track.bankMsb`, `Track.bankLsb`,
`Track.derived`, `Track.sourceTrackId`, `Track.idSeq`, `Track.audioRef`;
`SourceInfo.warningsDropped`, `SourceInfo.importedAt`, `SourceInfo.fileSizeBytes`,
`SourceInfo.fileHash`; `ImportWarning.count`; `JudgeResult.phase`; `Chart.omittedSourceEventIds`,
`Chart.source`; `DanceChart.settingsHash`, `DanceChart.source`, `DanceChart.name`;
`RecordingTake.loopPass`; `Project.mixer.reverb`; `Project.x` and `x` on every object.
