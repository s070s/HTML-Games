### 6.15 M-15 Project (`src/15-project.js`, `FLM.Project`)

#### 6.15.1 Responsibilities and non-goals

Responsibilities:

- Own the `Project` aggregate (B 18.2, I 5.1): a `Song` plus charts, dance charts,
  characters, mixer, settings and recordings, with the metadata fields of BRIEF section 5.
- Create, serialize, parse, validate and migrate `flm-project` version 1 documents
  (B 18.3, E 5.3, P 16). The JSON Schema is normative in Part 5.5; this module implements it.
- Provide the `UndoStack` and the complete command set through which every edit to a
  project is made (B 7.4, B 16.4, E 5.2, I 5). No other module mutates a `Project` except
  through a command or through the explicit load/replace entry points listed in 6.15.2.
- Track dirty state and expose the unsaved-changes guard used by `FLM.UI` and `FLM.Modes`
  (P 3, P 16).
- Build autosave checkpoints (ring of 3) and decide when a checkpoint is due; persistence of
  the checkpoint is delegated to a sink attached by M-16 (ADR-08, I 5.3, I 13).
- Enforce the non-destructive rule (I 1.2, I 5.1, E 4.2): `lockedSource:true` tracks are
  never mutated; Studio edits create `derived:true` tracks or are recorded as commands.

Non-goals:

- No DOM, no dialogs, no toasts. M-15 reports through return values, `ErrorReporter` and
  the event bus; `FLM.UI` and `FLM.Screens` show the text.
- No direct `localStorage` or IndexedDB access. That is M-16, which depends on M-15, never
  the reverse.
- No transport, audio or input binding. That is M-17.
- No chart generation. `FLM.Mapping.ChartGenerator` (M-08) produces `Chart` objects; M-15
  only stores them, validates references and drops stale ones.

#### 6.15.2 Public API

```js
// FLM.Project (M-15). All functions are synchronous unless they return a Promise.
// Types Project, Song, Track, Chart, DanceChart, CharacterConfig, RecordingTake are the
// Part 5 types. ValidationResult, Command, CheckpointDoc are defined in this section.

FLM.Project = {
  FORMAT: 'flm-project',          // string constant written to doc.format
  VERSION: 1,                      // current schema version (integer)
  LIMITS: {
    maxTracks: 32,
    maxEventsPerTrack: 100000,
    maxEventsTotal: 1000000,
    maxCharts: 128,                // charts + danceCharts combined
    maxCharacters: 5,
    maxRecordings: 64,
    maxNameLength: 120,
    maxJsonDepth: 32,
    maxJsonContainers: 5000000,
    maxLocalStorageBytes: 2 * 1024 * 1024,
    maxCheckpointBytes: 8 * 1024 * 1024,
    undoLimit: 100,
    coalesceWindowMs: 500
  },

  /** @param {{name?:string, song?:Song, tempoBpm?:number, timeSig?:[number,number],
   *           key?:string, scale?:string}} opts
   *  @returns {Project} new project; song defaults to an empty Song at 120 BPM, 4/4, C major */
  create(opts),

  /** Wrap an imported Song. Every track gets lockedSource:true, derived:false.
   *  @param {Song} song @param {{name?:string}} opts @returns {Project} */
  fromSong(song, opts),

  /** Canonical JSON text (field order fixed in Part 5.5, 2-space indent off, history:{}).
   *  @param {Project} project @returns {string} */
  serialize(project),

  /** Parse + migrate + validate. Never throws for bad input.
   *  @param {string} text
   *  @returns {{ok:boolean, project:Project|null, errors:PrjError[], warnings:PrjError[],
   *             migratedFrom:number|null}} */
  deserialize(text),

  /** Validate an already-parsed document object (no migration).
   *  @param {object} doc @returns {ValidationResult} */
  validate(doc),

  /** Apply the migration chain to a deep copy of doc. doc is never mutated.
   *  @param {object} doc
   *  @returns {{ok:boolean, doc:object|null, applied:number[], error:PrjError|null}} */
  migrate(doc),

  /** @param {Project} project @returns {number} estimated serialized bytes (Part 5.8 rule) */
  estimateSize(project),

  /** Deep copy including history reset (new UndoStack, dirty=false). */
  clone(project),

  /** Rebuild derived indexes after a load or replace (track id map, chart refs). */
  rebuildIndexes(project),

  // ---- current project (the one open project; M-28 and M-27 read it) ----
  current(),                                 // Project|null
  /** Makes `project` current (null clears it) and emits `project.loaded`. */
  setCurrent(project, {where:'local' or 'idb' or 'file' or 'builtin' or 'new'}),

  // ---- dirty tracking and guard ----
  isDirty(project),                          // boolean
  markClean(project, savedAt /* ms */),      // sets history.savedRevision = history.revision
  revision(project),                         // integer, increments per applied command/undo/redo

  guard: {
    /** @param {Project|null} project @returns {boolean} */
    hasUnsaved(project),
    /** Text for DLG-UnsavedChanges body.
     *  @returns {{title:string, body:string, changeCount:number, lastSavedAt:number|null}} */
    describe(project)
  },

  // ---- undo/redo ----
  /** One UndoStack per Project lives at project.history.undoStack (not serialized). */
  UndoStack: class {
    constructor(project, limit /* = 100 */)
    /** Apply cmd to the project, push onto the undo list, clear the redo list.
     *  Coalesces with the previous entry when cmd.coalesceKey matches and the previous
     *  entry is younger than LIMITS.coalesceWindowMs. @returns {CommandResult} */
    push(cmd)
    undo()               // -> CommandResult|null
    redo()               // -> CommandResult|null
    canUndo()            // boolean
    canRedo()            // boolean
    undoLabel()          // string|null (for the Edit menu)
    redoLabel()
    /** Run fn(push) and record every pushed command as one composite entry. */
    group(label, fn)
    clear()
    /** For leak tests: {undo:number, redo:number} */
    counts()
  },

  // ---- command factories (each returns a Command; none mutates until pushed) ----
  Commands: {
    addTrack({name, channel, program, isDrums, index}),
    deleteTrack(trackId),
    renameTrack(trackId, name),
    reorderTrack(trackId, newIndex),
    duplicateTrack(trackId),
    setTrackInstrument(trackId, {program, bankMsb, bankLsb, isDrums}),
    setMix(trackId, {gain, pan, mute, solo}),            // coalesceKey 'mix:'+trackId
    setMaster({gain}),                                   // coalesceKey 'master'
    addEvents(trackId, events /* Event[] */),
    deleteEvents(trackId, eventIds /* string[] */),
    moveEvents(trackId, eventIds, dTicks, dPitch),       // coalesceKey 'move:'+trackId
    resizeEvents(trackId, eventIds, dDurTicks),          // coalesceKey 'resize:'+trackId
    setVelocity(trackId, eventIds, {value, delta}),      // coalesceKey 'vel:'+trackId
    quantize(trackId, eventIds, QuantizeOptions),
    setTempo({bpm, atTick}),
    setMeter({numerator, denominator, atTick}),
    setKeyScale({key, scale, fifths, mode}),
    addMarker({tick, label, kind}),
    removeMarker(markerIndex),
    replaceTake(trackId, take /* RecordingTake */, {mode:'replace'|'merge'}),
    forkTrack(trackId),                                  // creates the derived copy
    setCharacter(slot, config /* CharacterConfig */),    // the command of Character.projectCommand (6.22), `slot` overrides config.slot; scope 'characters'; undoable
    setAudioOffset(trackId, ms)                          // audioRef.syncOffsetMs; coalesceKey 'audioOffset:'+trackId
  },

  /** Apply a command outside the stack (load-time repairs only; not undoable). */
  applyRaw(project, cmd),

  // ---- non-destructive helpers ----
  /** Returns the id of the track that edits must target: trackId itself when
   *  lockedSource is false, otherwise the derived copy's id (or null if none exists yet). */
  editableTrackId(project, trackId),
  isLocked(project, trackId),

  // ---- checkpoints ----
  /** Stripped copy for autosave (6.15.4 step C). @returns {CheckpointDoc} */
  checkpointDoc(project, slot /* 0..2 */),
  /** Rebuild a Project from a CheckpointDoc; recordings have events:[] and stripped:true. */
  restoreCheckpoint(doc),

  Autosave: {
    /** M-16 calls this once at its init. */
    setSink({ write(projectId, slot, doc) /* Promise<void> */,
              read(projectId, slot) /* Promise<CheckpointDoc|null> */,
              list(projectId) /* Promise<{slot, modifiedAt, revision}[]> */,
              remove(projectId) /* Promise<void> */ }),
    /** M-17 calls this; returns true only when no recording or playback is active. */
    setSafePredicate(fn /* () => boolean */),
    start(project, {intervalMs /* = 60000 */}),
    stop(),
    /** reason: 'stop' | 'trackAdd' | 'trackDelete' | 'timer' | 'modeLeave' | 'manual' */
    notify(reason),
    /** Promise<{written:boolean, slot:number|null, skipped:string|null}> */
    flush(),
    /** Latest checkpoint newer than the project's saved revision, if any. */
    findRecoverable(projectId, savedModifiedAt),   // Promise<CheckpointDoc|null>
    state()                                         // {running, lastSlot, lastWrittenAt, pending}
  },

  // ---- song catalog (built-in demos, tutorial song, imported songs registered for Play now) ----
  Catalog: {
    registerBuiltin(entry), registerTutorial(entry), register(entry), unregister(id),
    list(kind /* ?'builtin'|'tutorial'|'imported' */),   // CatalogEntry[] (shape in 6.30.4.9)
    get(id),                                              // CatalogEntry|null
    getSong(id),                                          // Song|null (expands and caches)
    tutorial()                                            // CatalogEntry|null
  }
};

// Command (plain object, created by a factory)
// {
//   id: string,            // uid()
//   type: string,          // one of the factory names
//   label: string,         // user-visible, e.g. "Rename track"
//   ts: number,            // performance.now() at creation
//   coalesceKey: string|null,
//   params: object,        // factory arguments, frozen
//   undoData: object|null, // filled by apply(); what revert() needs
//   apply(project): CommandResult,
//   revert(project): CommandResult
// }
// CommandResult { ok:boolean, changed:string[] /* 'tracks','events','tempo','meter','key',
//                 'markers','mix','settings','recordings','charts','characters' */, error:PrjError|null,
//                 affectedTrackIds:string[] }
// PrjError { code:string, message:string, path:string }
// ValidationResult { ok:boolean, errors:PrjError[], warnings:PrjError[] }
// QuantizeOptions { grid:'1/4'|'1/8'|'1/16'|'1/32'|'1/8T'|'1/16T', strength:0..100,
//                   quantizeDurations:boolean, allowBarCross:boolean }
// CheckpointDoc = Project document with recordings[i].events = [] and
//                 recordings[i].stripped = true, plus checkpoint:{slot, revision, savedAt}
```

Events emitted (topics are listed in the Part 4.4 catalog; payloads here are exact):

| Topic | Payload | When |
|---|---|---|
| `project.changed` | `{projectId, changed:string[], source:'command' or 'undo' or 'redo' or 'load', commandType:string or null, revision:number}` | after every applied command, undo, redo and after `parse` produces a project |
| `project.dirty` | `{projectId, dirty:boolean, revision:number}` | whenever `isDirty` would change value |
| `project.checkpoint` | `{projectId, slot:number, bytes:number, revision:number}` | after a checkpoint write resolves |
| `project.saveFailed` | `{projectId, code:string, message:string, kind:'checkpoint'}` | when the checkpoint sink rejects (M-16 emits the same topic with `kind:'save'` for explicit saves) |

Events consumed: none. M-15 is driven by calls only, so it stays deterministic under test.

#### 6.15.3 Internal state

```js
// Runtime shape of a Project in memory (serialized shape is Part 5.5)
project = {
  format:'flm-project', version:1, id, name,
  song: Song,                       // M-03 object with live indexes
  charts: Chart[], danceCharts: DanceChart[], characters: CharacterConfig[],
  mixer: { master: { gain:1.0 } },
  settings: { key:'C', scale:'major', tempoOverride:null, timeSig:[4,4] },
  recordings: RecordingTake[],
  history: {                        // NEVER serialized; serialize() writes {}
    undoStack: UndoStack,
    revision: 0,                    // increments on apply, undo, redo
    savedRevision: 0,               // set by markClean
    checkpointRevision: 0,          // revision captured by the last checkpoint
    lastSavedAt: null
  },
  createdAt, modifiedAt, sizeBytes,
  _idx: { trackById: Map<string,Track>, trackIndexById: Map<string,number>,
          chartsByTrack: Map<string,Chart[]> }   // rebuilt by rebuildIndexes; not serialized
};
```

Invariants (asserted in the test build by `FLM.Core.assert`, checked by `validate` in all
builds):

1. `song.tracks.length <= 32`; every `track.id` unique; `_idx.trackById.size === tracks.length`.
2. Every `chart.trackId` and `chart.songId` resolves; a chart whose track was deleted is
   removed by the `deleteTrack` command (and restored by its revert).
3. `history.revision >= history.savedRevision` is not required (undo can move below it);
   `isDirty = revision !== savedRevision`.
4. A track with `lockedSource:true` is never the target of `addEvents`, `deleteEvents`,
   `moveEvents`, `resizeEvents`, `setVelocity`, `quantize`, `replaceTake`,
   `setTrackInstrument` or `renameTrack`. Factories throw `E-PRJ-031` (programming error,
   never user-facing) when given a locked target; UI code must call `editableTrackId` first.
5. `derived:true` tracks carry `derivedFromTrackId` naming an existing `lockedSource` track.
   Deleting a derived track restores `visible:true` and `mix.mute:false` on its source.
6. Events arrays stay sorted (M-03 comparator); all event mutation in commands goes through
   `FLM.Model.insertEvent` / `removeEvent` / `updateEvent`.
7. `modifiedAt` is set to `Date.now()` by every applied command; undo/redo also set it.
8. The redo list is empty after any new `push` (E 5.2 "redo after a new edit").
9. `UndoStack` holds at most `undoLimit` entries; the oldest entry is dropped first.
10. `recordings` keeps at most `maxRecordings` takes; the oldest `aborted` take is dropped
    first, then the oldest `complete` take that is not referenced by a track event id set.

Autosave controller state (module-level singleton, one project at a time):

```js
autosave = { sink:null, isSafe:() => false, project:null, timer:null, intervalMs:60000,
             nextSlot:0, lastWrittenAt:null, lastSlot:null, pending:false, inFlight:false,
             consecutiveFailures:0 }
```

#### 6.15.4 Algorithms

A. Command lifecycle (`UndoStack.push`)

1. `assert(cmd.apply && cmd.revert)`; if `cmd.params.trackId` names a track with
   `lockedSource:true` and the type is in the mutating set of invariant 4, throw
   `E-PRJ-031` (never reaches the user; a unit test guards every factory).
2. `res = cmd.apply(project)`. If `res.ok === false`: do not push, do not change revision,
   return `res` (the UI shows `res.error.message` as a toast).
3. Coalescing: let `prev = undo[undo.length-1]`. If `cmd.coalesceKey !== null`,
   `prev && prev.coalesceKey === cmd.coalesceKey`, `cmd.ts - prev.ts <= 500`, and
   `prev.composite !== true`: replace `prev.params` by `cmd.params` for the fields the
   command updates, keep `prev.undoData` (the state before the first change), set
   `prev.ts = cmd.ts`. Otherwise push `cmd`. Coalescing never spans a `group`.
4. `redo.length = 0`. If `undo.length > limit`, `undo.shift()`.
5. `history.revision += 1`; `project.modifiedAt = Date.now()`; emit `project.changed`
   (`source:'command'`), and `project.dirty` if the dirty value changed.
6. Return `res`.

`undo()`: pop from `undo`, call `revert(project)`, push onto `redo`, `revision += 1`, emit
with `source:'undo'`. `redo()` mirrors with `apply`. A composite entry (from `group`)
reverts its children in reverse order and applies them in forward order; if any child fails
during undo or redo, the already-processed children are re-applied in the opposite direction
so the project returns to the state before the undo/redo call, and the entry is dropped with
`ErrorReporter.report('E-PRJ-030', err, {type})`.

B. Command semantics (apply / undoData / revert)

| Command | apply | undoData | revert | Validation (returns `ok:false`) |
|---|---|---|---|---|
| addTrack | `Track.create` with name default `Track N` (N = count+1), channel = first free channel 0-15 skipping 9 unless isDrums (then 9), program default 0, `lockedSource:false, derived:false`; insert at `index` or end; create empty chart set | `{trackId, index}` | remove track by id | 32 tracks reached -> `E-PRJ-020` "Track limit reached (32). Delete a track to add another." |
| deleteTrack | remove track; remove charts and danceCharts referencing it; remove recordings referencing it; if `derived`, restore source `visible/mute` | `{track, index, charts, recordings, sourceState}` deep copies | reinsert all at saved index | track id unknown -> `E-PRJ-021` |
| renameTrack | set `name` (trimmed, <= 120 chars, empty -> `Track N`) | `{oldName}` | restore | locked target -> E-PRJ-031 (programming) |
| reorderTrack | splice to `newIndex` clamped to `[0, n-1]` | `{oldIndex}` | splice back | none |
| duplicateTrack | deep copy with new ids for track and every event, name `<name> copy`, inserted after source, `lockedSource:false, derived:false`, charts not copied | `{newTrackId}` | remove copy | 32 tracks -> E-PRJ-020 |
| setTrackInstrument | set `program/bankMsb/bankLsb/isDrums`; if `isDrums` flips, set channel 9 or first free | `{old fields}` | restore | program not 0..127 -> E-PRJ-022 |
| setMix | patch `mix` fields; gain clamped 0..2, pan -1..1 | `{oldMix}` | restore | none |
| setMaster | `mixer.master.gain` clamped 0..2 | `{old}` | restore | none |
| addEvents | assign new ids where missing, `insertEvent` each (M-03 pairing/overlap policy applies to notes) | `{eventIds, displaced:[Event]}` (events shortened by overlap) | remove ids, re-insert displaced originals | > 100,000 events on track -> `E-PRJ-023` "Track event limit reached (100,000)."; event pitch/velocity out of range -> E-PRJ-024 |
| deleteEvents | remove by id | `{events:[Event]}` | re-insert | unknown ids are ignored (count reported in `changed`) |
| moveEvents | for each: `tick = max(0, tick + dTicks)`, `pitch = clamp(pitch + dPitch, 0, 127)` for notes only; remove then insert to keep order | `{before:[{id,tick,pitch}]}` | restore each | all ids unknown -> E-PRJ-021 |
| resizeEvents | `durTicks = max(1, durTicks + dDurTicks)` on note events only | `{before:[{id,durTicks}]}` | restore | none |
| setVelocity | `velocity = clamp(value or velocity + delta, 1, 127)` | `{before:[{id,velocity}]}` | restore | none |
| quantize | algorithm D below | `{before:[{id,tick,durTicks}]}` | restore | grid unknown -> E-PRJ-025 |
| setTempo | native song (`song.source.format === 'flm'`): replace the tempoMap entry at `atTick` (default 0; entry created if absent) with `usPerQuarter = round(60e6 / bpm)`, recompute `secondsAt`; imported song: set `settings.tempoOverride = bpm` and leave the map intact | `{oldEntry or oldOverride}` | restore | bpm outside 20..300 -> E-PRJ-026 |
| setMeter | native: replace meterMap entry at `atTick`; imported: set `settings.timeSig` only | `{old}` | restore | numerator 1..32, denominator in {1,2,4,8,16,32} else E-PRJ-027 |
| setKeyScale | set `settings.key/scale`; native song also sets `keyMap.entries[0] = {tick:0, fifths, mode}` | `{old}` | restore | key or scale name unknown to `FLM.Theory` -> E-PRJ-028 |
| addMarker | insert `Marker` keeping `markers` sorted by tick; same tick as an existing marker -> replace label (undo restores) | `{index, replaced}` | remove or restore | label trimmed to 60 chars |
| removeMarker | splice by index | `{marker, index}` | reinsert | index out of range -> E-PRJ-021 |
| replaceTake | mode `replace`: remove the track's events with `tick` in `[take.startTick, take.endTick)`, then insert `take.events`; mode `merge`: insert only | `{removed:[Event], insertedIds}` | remove inserted, re-insert removed | take.status !== 'complete' -> `E-PRJ-029` (aborted takes are never committed) |
| forkTrack | deep copy of the locked track with new ids, `lockedSource:false, derived:true, derivedFromTrackId`, inserted directly after the source; source gets `visible:false, mix.mute:true`; existing charts stay bound to the source | `{newTrackId, sourceState}` | remove copy, restore source | source not locked -> E-PRJ-031 |

`changed` arrays: tracks commands -> `['tracks']` (deleteTrack also `'charts'`,
`'recordings'`); event commands -> `['events']`; setMix/setMaster -> `['mix']`; setTempo ->
`['tempo']` or `['settings']`; setMeter -> `['meter']` or `['settings']`; setKeyScale ->
`['key','settings']`; markers -> `['markers']`; replaceTake -> `['events','recordings']`.

C. Checkpoint build (`checkpointDoc`)

1. `doc = JSON.parse(serialize(project))` (serialize already drops `history` and `_idx`).
2. For each `doc.recordings[i]`: set `events = []`, `stripped = true`, keep `id, trackId,
   startedAt, countIn, tempoAtRecord, status, eventCount` (eventCount added at this step).
3. Set `doc.checkpoint = { slot, revision: history.revision, savedAt: Date.now() }`.
4. `bytes = estimateSize(doc)`; if `bytes > LIMITS.maxCheckpointBytes` return `null` (the
   caller logs `checkpoint skipped: too large` once per project and the Studio shows the
   one-line notice "Autosave is off for this project (over 8 MB). Save or export manually.").
5. Return `doc`.

Autosave decision (`Autosave.notify(reason)` and the 60 s timer):

1. If `sink === null` or `project === null`: return (standalone without storage still works;
   `state().pending` stays true so the UI can show "Autosave unavailable").
2. If `!isSafe()`: set `pending = true` and return. The next `notify('stop')` or timer tick
   re-evaluates. Never write during `recording` or `playing` (BRIEF section 6).
3. If `history.revision === history.checkpointRevision`: return (nothing new).
4. If `inFlight`: set `pending = true`; return.
5. `slot = nextSlot; nextSlot = (nextSlot + 1) % 3`; `doc = checkpointDoc(project, slot)`;
   if `null` return.
6. `inFlight = true; sink.write(project.id, slot, doc)`. On resolve: `checkpointRevision =
   doc.checkpoint.revision`, `lastWrittenAt`, `lastSlot`, `consecutiveFailures = 0`, emit
   `project.checkpoint`. On reject: `consecutiveFailures += 1`, emit `project.saveFailed`
   with `kind:'checkpoint'` and the sink's `code`; after 3 consecutive failures the timer is
   stopped and `state().running = false` (the Studio shows "Autosave stopped: <message>").
7. `inFlight = false`; if `pending`, clear it and re-run from step 2 after a 1 s delay.

The timer is a single `setInterval(intervalMs)` created by `start` and cleared by `stop`;
`FLM.Modes.assertClean()` counts it, so Studio must call `stop()` on leave.

`findRecoverable(projectId, savedModifiedAt)`: `list(projectId)`, pick the entry with the
highest `revision`; read it; return it when `doc.checkpoint.savedAt > savedModifiedAt + 1000`
else `null`. The Studio screen offers `DLG-RecoverCheckpoint` when non-null.

D. Quantize (deterministic, integer ticks)

```text
gridTicks: 1/4 -> 960, 1/8 -> 480, 1/16 -> 240, 1/32 -> 120, 1/8T -> 320, 1/16T -> 160
for each selected note event e (non-note events are never quantized):
  bar      = song.meterMap.barAt(e.tick)                 // bar index
  barStart = song.meterMap.tickOfBar(bar)
  barEnd   = song.meterMap.tickOfBar(bar + 1)            // exclusive
  g        = barStart + round((e.tick - barStart) / gridTicks) * gridTicks
  if (!allowBarCross && (g < barStart || g >= barEnd)):
      g = (g < barStart) ? barStart : barStart + floor((barEnd - 1 - barStart) / gridTicks) * gridTicks
  newTick  = e.tick + round((g - e.tick) * strength / 100)
  if quantizeDurations:
      d = max(gridTicks, round(e.durTicks / gridTicks) * gridTicks)
      newDur = e.durTicks + round((d - e.durTicks) * strength / 100)
  else newDur = e.durTicks
  record before {id, tick, durTicks}; set via Model.updateEvent (re-sorts, applies
  same-pitch overlap policy W-NOTE-OVERLAP)
```

`strength` 100 snaps exactly; 0 is a no-op that still records a command (so a user who
quantizes at 0 percent sees "nothing changed" in the result count, not an error). Rounding
is `Math.round` (half away from zero for positives; ticks are non-negative).

E. Serialization and parse

`serialize`: build a plain object in the Part 5.5 field order (`format, version, id, name,
createdAt, modifiedAt, sizeBytes, settings, mixer, song, charts, danceCharts, characters,
recordings, history`), with `history: {}`, `sizeBytes` computed as the byte length of the
JSON without the `sizeBytes` field (two passes: serialize with `sizeBytes:0`, measure with
`TextEncoder`, patch). Numbers are written as JSON numbers; ticks are integers; floats
(gain, pan, heightScale) are rounded to 6 decimals. `JSON.stringify` with no indent.

`deserialize(text)`:
1. `text.length > 64 MB` -> `E-PRJ-010`. Depth check during a first `JSON.parse` with a
   reviver counting nesting is not possible; instead a pre-scan counts `{`/`[` nesting
   outside strings and fails above `maxJsonDepth` (32) or more than `maxJsonContainers`
   (5,000,000) containers with `E-PRJ-010` before parsing.
2. `JSON.parse` in try/catch -> `E-PRJ-001` on SyntaxError.
3. `doc.format !== 'flm-project'` -> `E-PRJ-003`.
4. `migrate(doc)`; failure -> its error (`E-PRJ-002` newer version, `E-PRJ-012` migration
   failure).
5. `validate(migrated)`; failure -> errors (`E-PRJ-004` missing required data, `E-PRJ-005`
   schema, `E-PRJ-006` duplicate identifiers, `E-PRJ-007` references (strict only),
   `E-PRJ-009` limits).
6. Build the runtime `Project`: `FLM.Model.Song.fromDoc(doc.song)` (rebuilds TempoMap
   cumulative seconds, re-sorts events, re-pairs nothing: notes are stored paired), fresh
   `history`, `rebuildIndexes`. Unknown top-level fields and unknown fields inside known
   objects are kept under `x` namespaces per Part 5.5 (`doc.x`, `track.x`, ...).
7. Emit `project.changed` with `source:'load'`.

Error codes used by `deserialize`/`validate` (owner: Part 5.6; messages are the user-facing text):

| Code | Message |
|---|---|
| E-PRJ-001 | This project file is not valid JSON and cannot be opened. |
| E-PRJ-002 | This project was saved by a newer version of Finger Lickin Music (format version {v}; this build reads up to version 1). Open it with the newer version or export it from there as MIDI. |
| E-PRJ-003 | This file is not a Finger Lickin Music project (expected format 'flm-project', found '{format}'). |
| E-PRJ-004 | The project is missing required data at {pointer} and cannot be opened. |
| E-PRJ-005 | The project contains an invalid value at {pointer} and cannot be opened. |
| E-PRJ-006 | The project contains duplicate identifiers ({pointer}) and cannot be opened. |
| E-PRJ-007 | The project refers to data that does not exist ({pointer}). |
| E-PRJ-008 | The project's musical events are out of order and could not be repaired. |
| E-PRJ-009 | The project exceeds the supported size: {detail} (limits: 32 tracks, 1,000,000 events). |
| E-PRJ-010 | The project file is too large or too deeply nested to open safely. |
| E-PRJ-011 | The project's tempo or meter data is invalid and could not be repaired. |
| E-PRJ-012 | The project could not be upgraded from format version {from} to version 1: {detail}. |

F. Migration framework

```js
const MIGRATIONS = {            // key = from version, value = function(docCopy) -> docCopy
  // 1 -> 2 will be added when version 2 exists. Empty at plan version 1.0.0.
};
migrate(doc):
  if (!Number.isInteger(doc.version) || doc.version < 1) -> E-PRJ-005 at path 'version'
  if (doc.version > VERSION) -> E-PRJ-002
  copy = deepClone(doc); applied = []
  for v = copy.version; v < VERSION; v++:
    step = MIGRATIONS[v]; if (!step) -> E-PRJ-012
    try { copy = step(copy); copy.version = v + 1 } catch (e) -> E-PRJ-012
    r = validate(copy); if (!r.ok) -> E-PRJ-012 (first error appended to message)
    applied.push(v + 1)
  return {ok:true, doc:copy, applied}
```

Rules: migrations run on a deep copy and the stored record is untouched until M-16 writes
the validated result as a new save that the user explicitly triggers (loading a project
never writes). Every future migration ships with a fixture document of the old version in
`src/91-test-project.js` and a test that the migrated output validates and reopens.

#### 6.15.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Command apply throws (bug or bad params) | try/catch in `push`; `ErrorReporter.report('E-PRJ-030')` | project unchanged (apply mutates only after validation; partial mutation guarded by revert-on-throw) | user retries the edit | none | toast "That edit could not be applied." | n/a | `revert` of partial changes using undoData collected so far | UT-15-19 |
| Undo/redo of a composite fails midway | child result `ok:false` | restored by re-applying processed children | no | none | toast "Undo could not complete; the project is unchanged." | n/a | step A rollback | UT-15-20 |
| Parse of a damaged project | `deserialize` returns `ok:false` with code | current open project untouched (deserialize never replaces it) | user picks another file | the damaged file only | DLG-SaveFailed style dialog with the E-PRJ message and "Open backup" when M-16 has a `.bak` | n/a | nothing to undo | UT-15-11, UT-15-12 |
| Newer version document | `migrate` E-PRJ-002 | same | no | none | exact E-PRJ-002 text | n/a | n/a | UT-15-13 |
| Migration step throws | E-PRJ-012 | stored record untouched | no | none | E-PRJ-012 text | n/a | n/a | UT-15-14 |
| Checkpoint sink rejects (quota, unavailable) | promise rejection | project in memory | automatic on next safe point; stops after 3 failures | yes, unsaved edits are at risk until exported | `project.saveFailed` -> Studio notice "Autosave stopped: <message>. Export to keep your work." | manual save/export remains available | user saves or exports | UT-15-25 |
| Checkpoint too large | `checkpointDoc` returns null | project in memory | n/a | yes | one-line notice (6.15.4 C step 4) | manual save only | n/a | UT-15-24 |
| Track or event limit hit | command returns `ok:false` E-PRJ-020/023 | unchanged | after deleting data | none | toast with the code's text | n/a | n/a | UT-15-05, UT-15-16 |
| Locked track targeted by an edit | factory throws E-PRJ-031 in the test build; in the shipped build the factory returns `ok:false` and logs once | unchanged | n/a | none | never user-facing (UI calls `editableTrackId` first) | n/a | n/a | UT-15-21 |
| Autosave timer left running after Studio leave | `assertClean` timer counter | n/a | n/a | none | diagnostics only | n/a | `Autosave.stop()` in Modes leave contract | UT-15-26 |

#### 6.15.6 Limits and performance notes

- `serialize` of a project with 100,000 events must complete within 200 ms (BRIEF section 6);
  the implementation builds plain arrays of numbers and uses one `JSON.stringify`; no
  per-event string concatenation. Measured by PT tests (Part 12).
- `deserialize` of the same project within 400 ms excluding `Song.fromDoc` index rebuild, which is
  O(n log n) over events per track.
- `UndoStack` memory: undoData for `deleteTrack` and `replaceTake` can hold up to 100,000
  events; the 100-entry limit bounds total memory to the size of the project times 100 in the
  worst case. To keep steady-state memory within the BRIEF budget, entries older than 20
  that hold more than 10,000 events are dropped first when the stack exceeds 50 entries
  (deterministic rule, documented in the Help screen as "Undo history for very large edits is
  kept for the 20 most recent steps").
- `estimateSize` is the exact serialized byte length when the project is below 2 MB
  (serialize is cheap there); above 2 MB it is computed incrementally per track from a
  cached per-track byte count updated on each command (`_idx.bytesByTrack`), so routing
  decisions in M-16 never serialize twice.
- Coalescing keeps slider drags at one undo entry and one `project.changed` emit per 500 ms
  window; the emit still happens on every push so the UI stays live.

#### 6.15.7 Spec coverage

B 7.4 (undo/redo, save/load, tempo/meter/key settings), B 15.7 (internal representation:
editing state, recording data, source vs gameplay separation), B 16.1 (track lifecycle data),
B 16.4 (editing operations as commands), B 18.1-18.4 (persistence contents, versioning,
limits), E 4.2 (never silently delete source notes: locked tracks), E 5.2 (editing and mixing
cases: undo repeatedly, redo after new edit, delete referenced track, quantize across bar),
E 5.3 (older schema, unknown fields, partially corrupted, overwrite with smaller version via
revision check in M-16), E 10 items 1, 7, 14, E 11 minimum rules (save failure never reports
success: checkpoint result is explicit), I 1.2, I 5 (undo/redo, section markers, project
export data), I 5.1 (non-destructive model), I 5.3 (recovery checkpoints), I 13 (autosave at
safe points, versioned projects, validation before loading), I 16.4 (versioning), P 10
(undo/redo restore expected state; destructive safeguards), P 16 (explicit versions,
migrated or rejected safely, corrupted projects recoverable, autosave does not interrupt
gameplay, repeated save/load preserves content).

#### 6.15.8 Unit tests (group `project`, file `src/91-test-project.js`)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-15-01 | create defaults | `Project.create({})` | format 'flm-project', version 1, song has 1 tempo entry 500000 us, meter 4/4, settings key 'C' scale 'major', tracks [], isDirty false |
| UT-15-02 | fromSong locks tracks | Song with 3 tracks | every track `lockedSource:true, derived:false`; name taken from song.title |
| UT-15-03 | serialize field order and history | project with 1 track, 2 notes | JSON keys in Part 5.5 order; `history` serialized as `{}`; `sizeBytes` equals byte length |
| UT-15-04 | serialize/deserialize round trip | project with 2 tracks, tempo change, marker, chart | `deserialize(serialize(p))` deep-equals p minus history and _idx; events sorted |
| UT-15-05 | addTrack limit | push addTrack 32 times then once more | 32 tracks; 33rd returns `ok:false, error.code 'E-PRJ-020'`; revision unchanged by the failure |
| UT-15-06 | addTrack channel assignment | 10 non-drum tracks then a drum track | channels 0-8,10 then drums on 9 |
| UT-15-07 | deleteTrack cascades and undo restores | track with a chart and a recording | after delete: chart and recording gone; after undo: identical to before (deep equal) |
| UT-15-08 | reorder and duplicate | 3 tracks | reorder moves to clamped index; duplicate has new track and event ids, name ends with ' copy', inserted after source |
| UT-15-09 | addEvents keeps order and overlap policy | insert notes out of order, two same-pitch overlaps | events sorted by comparator; earlier note shortened; undo restores original durations |
| UT-15-10 | moveEvents clamps | note at tick 100 moved -200 ticks and +200 pitch | tick 0, pitch 127; undo restores 100 and original pitch |
| UT-15-11 | parse rejects wrong format | text `{"format":"other"}` | `ok:false`, code E-PRJ-003, no project |
| UT-15-12 | parse rejects bad JSON and depth | truncated text; 33-deep nested arrays | E-PRJ-001; E-PRJ-010 |
| UT-15-13 | migrate refuses newer | doc with version 2 | E-PRJ-002, message contains 'format 2'; input doc unchanged (deep equal to copy) |
| UT-15-14 | migration failure leaves original intact | inject failing MIGRATIONS[0] via test hook with version 0 doc | E-PRJ-012; input doc unchanged |
| UT-15-15 | validate reference integrity | chart.trackId pointing to missing track | E-PRJ-007 (strict) with path `charts[0].trackId` |
| UT-15-16 | event limit | track with 100,000 events, addEvents of 1 | E-PRJ-023 |
| UT-15-17 | coalescing of setMix | 5 setMix pushes within 100 ms with fake ts, then one 600 ms later | undo count 2; first undo restores to the 5th value's predecessor state; second undo restores original mix |
| UT-15-18 | undo limit 100 | 120 renameTrack commands | `counts().undo === 100`; oldest dropped; undo 100 times reaches the state after the 20th command |
| UT-15-19 | apply throw is isolated | command whose apply throws after partial mutation (test-only command) | push returns ok:false; project deep-equals pre-state; ErrorReporter received E-PRJ-030 |
| UT-15-20 | composite group undo/redo | group of addTrack + addEvents + setMix | one undo entry; undo removes all three effects; redo restores all |
| UT-15-21 | locked track protection | fromSong project, `Commands.addEvents(lockedId, ...)` | throws E-PRJ-031 in test build; `editableTrackId` returns null before fork and the derived id after `forkTrack` |
| UT-15-22 | forkTrack semantics | fork a locked track | derived track `derived:true`, `derivedFromTrackId`, new ids; source `visible:false, mix.mute:true`; undo restores source flags and removes copy |
| UT-15-23 | quantize rules | notes at ticks 230, 250, 3830 in 4/4 at grid 1/16 strength 100 and 50; `allowBarCross:false` | 230->240, 250->240; 3830 stays within bar 0 (-> 3600 not 3840); strength 50 moves half way (230->235) |
| UT-15-24 | checkpoint stripping and size gate | project with a 1,000-event recording; then LIMITS.maxCheckpointBytes set to 10 via test hook | doc.recordings[0].events is []; `stripped:true`; `eventCount` 1000; second call returns null |
| UT-15-25 | autosave safe-point gating and failure stop | fake sink (array), isSafe toggled, three rejecting writes | no write while unsafe; write on notify('stop') when safe; after 3 rejections `state().running` false and `project.saveFailed` emitted 3 times |
| UT-15-26 | autosave ring and timer cleanup | fake sink, fake timers, 4 safe notifies with revisions advancing | slots 0,1,2,0 in order; `stop()` clears the interval (timer counter back to baseline) |
| UT-15-27 | dirty tracking | push, markClean, undo | dirty true after push, false after markClean, true after undo (revision moved), `project.dirty` emitted exactly on changes |
| UT-15-28 | setTempo native vs imported | native project and fromSong project | native: tempoMap entry 0 usPerQuarter 400000 for 150 BPM; imported: tempoOverride 150 and map unchanged; bpm 500 -> E-PRJ-026 |
| UT-15-29 | replaceTake modes | track with notes in [0, 3840); take covering [960, 2880) | replace removes only notes in range and inserts take; merge keeps all; aborted take -> E-PRJ-029; undo restores |
| UT-15-30 | unknown fields preserved | doc with `x.custom` at top level and in a track | after parse+serialize, both `x` objects survive unchanged |

#### 6.15.9 Implementation notes and browser quirks

- `Date.now()` is used for `createdAt/modifiedAt`; `performance.now()` for `cmd.ts`
  (coalescing). Tests inject both through `FLM.Project._clock = {now, perf}` (test build
  only; shipped build ignores the hook).
- `structuredClone` is available in all five target browsers at the versions targeted, but
  `FLM.Core.deepClone` is used everywhere so the fake-clock and `x` namespace behavior is
  identical in tests and production.
- `TextEncoder` is used for byte counts; it exists in every target browser. Do not use
  `Blob.size` for counting (allocates).
- Never store functions or class instances in `project` outside `history` and `_idx`;
  `serialize` relies on `JSON.stringify` ignoring them only for those two keys, which are
  explicitly omitted rather than relying on `toJSON`.
- Keep command factories pure: they capture parameters only; `apply` reads the live project.
  This makes replaying a command list (used by UT-15-19 and by the fault tests) deterministic.

### 6.16 M-16 Storage (`src/16-storage.js`, `FLM.Storage`)

#### 6.16.1 Responsibilities and non-goals

Responsibilities:

- Open and probe browser storage at boot: `localStorage` and IndexedDB `flm-db` version 1
  (ADR-08, B 18.1, E 5.3, E 9), and publish the resulting storage mode.
- Safe write for both backends: temp -> verify -> swap -> keep one `.bak` (ADR-08, E 5.3,
  I 13, P 16).
- Project persistence (save, load, delete, list, restore backup) with the routing rule of
  Part 5.8, plus the project index record.
- Checkpoint sink for `FLM.Project.Autosave` (ring of 3 per project).
- Settings and progression key-value storage under `flm.v1.*` keys (catalog: Part 5.15).
- Quota estimation and the `storage.quota` warning (B 18.4, B 24).
- Export (download) and import (file picker, drag and drop) helpers used by every export
  format in Part 5.14 (B 15.6).
- Concurrent-tab guard (E 5.3 "two browser tabs edit the same project").
- The four storage error codes with exact user texts.

Non-goals:

- No knowledge of the project schema beyond `id`, `name`, `modifiedAt`, `sizeBytes`,
  `recordings.length` and the `history.revision`; validation is M-15.
- No UI. Dialogs `DLG-SaveFailed`, `DLG-ProjectTooLarge` and the storage notice are shown by
  `FLM.Screens` in response to return values and events.
- No cloud or server storage. No SoundFont storage (Deferred; the `charts` and
  `characters` stores exist in the v1 schema so the database version does not change later).

#### 6.16.2 Public API

```js
FLM.Storage = {
  DB_NAME: 'flm-db', DB_VERSION: 1,
  STORES: ['projects', 'recordings', 'charts', 'characters'],
  KEY_PREFIX: 'flm.v1.',
  LIMITS: {
    localProjectBytes: 2 * 1024 * 1024,     // per project on the localStorage path
    localTotalBytes: 4.5 * 1024 * 1024,     // soft budget for everything in localStorage
    indexEntries: 200,
    indexBytes: 64 * 1024,
    openTimeoutMs: 5000,
    txTimeoutMs: 10000,
    probeTimeoutMs: 2000,
    lockTtlMs: 45000,
    lockRefreshMs: 15000,
    quotaWarnRatio: 0.8
  },

  /** Probe both backends, open the database, attach the checkpoint sink to
   *  FLM.Project.Autosave, start the lock heartbeat machinery (idle until a project opens).
   *  Never rejects. @returns {Promise<StorageStatus>} */
  open(options /* {idbFactory?, localStorage?, now?} test injection */),

  /** @returns {StorageStatus} last open() result */
  state(),
  // StorageStatus { mode:'full'|'localOnly'|'memory', isFile:boolean,
  //                 readOnly:boolean /* lock held by another tab */, lockedBy:string|null,
  //                 local:{ok:boolean, error:string|null},
  //                 idb:{ok:boolean, error:string|null, openMs:number},
  //                 notice:string|null /* exact user text or null when mode is 'full' */ }

  // ---- key-value helpers over localStorage (prefix flm.v1.) ----
  /** JSON value or fallback; a damaged record is removed, logged, and fallback returned. */
  get(key, fallback),
  /** Safe write (6.16.4 A). @returns {{ok:boolean, error:StoError|null}} */
  set(key, value),
  remove(key),
  /** keys under the prefix, without the prefix */
  keys(),
  /** bytes used by flm.v1.* keys (UTF-16 code units x 2) */
  usedBytes(),

  // ---- settings (documents of Part 5.11; normalization and debouncing are M-27's) ----
  /** Reads `flm.v1.settings`; a damaged or missing record returns null (M-27 then uses defaults).
   *  Emits `settings.changed` {key:'*', source:'load'} (Part 4.4). */
  loadSettings(),
  /** Emits `settings.changed` with `change` ({key, value, prev, source, keys?}, Part 4.4) at once, then
   *  safe-writes the settings document (debounced by opts.debounceMs, default 250; 0 = immediate).
   *  @returns {Promise<{ok:boolean, error:StoError|null}>} (resolves after the write) */
  saveSettings(doc, change, opts /* ?{debounceMs:number} */),
  /** Writes a pending debounced settings document now (pagehide, tests). */
  flushSettings(),

  // ---- projects ----
  /** Route by Part 5.8, safe-write, update index, markClean on success.
   *  Never resolves ok:true unless the read-back verified. */
  saveProject(project, {force:boolean} = {}),     // Promise<SaveResult>
  // SaveResult { ok, id, location:'ls'|'idb'|'both'|null, bytes, error:StoError|null,
  //              conflict:{storedRevision:number, storedModifiedAt:number}|null }
  loadProject(id),                          // Promise<{ok, text:string|null, location, error}>
  loadBackup(id),                           // Promise<{ok, text, error}>  reads the .bak
  deleteProject(id),                        // Promise<{ok, error}>  removes record, .bak, checkpoints, lock
  listProjects(),                           // Promise<ProjectIndexEntry[]> newest first
  projectExists(id),                        // Promise<boolean>
  renameProject(id, name),                  // Promise<{ok,error}> loads, patches name, saves
  /** Writes a checkpoint of the project now (calls FLM.Project.Autosave.flush for it); used by
   *  M-28 on leave. @returns {Promise<{ok:boolean, error:StoError|null}>} */
  autosave(project),
  // ProjectIndexEntry { id, name, modifiedAt, sizeBytes, location, trackCount,
  //                     durationTicks, hasRecordings, revision }

  checkpoints: {                              // the sink object passed to Project.Autosave.setSink
    write(projectId, slot, doc), read(projectId, slot), list(projectId), remove(projectId)
  },

  recordings: {                               // raw take buffers for 'keep all passes'
    put(projectId, take),                     // Promise<{ok,error}>
    get(id), listByProject(projectId), remove(id), removeByProject(projectId)
  },

  /** navigator.storage.estimate() when available. */
  estimateQuota(),                            // Promise<{usage:number, quota:number, known:boolean}>
  /** last estimate, refreshed after every save */
  lastQuota(),

  lock(projectId),                            // Promise<{ok:boolean, heldBy:string|null, since:number|null}>
  unlock(projectId),
  isLockedByOther(projectId),                 // boolean from the cached lock record
  tabId,                                      // string, uid() per page load

  /** Trigger a download. Resolves when the click was dispatched; success is unknowable. */
  download(fileName, data /* Blob|string|ArrayBuffer */, mimeType),   // Promise<{ok, method:'anchor'|'dataUrl'|'none', error}>
  pickFile({accept:string[], multiple:boolean}),                       // Promise<File[]>  [] when cancelled
  enableDrop(element, onFiles /* (File[]) => void */),                 // returns dispose()
  /** Size-checked read. maxBytes default 25 MB; exceeded -> E-IMP-001 error from Part 10.6 */
  readFile(file, {as:'arrayBuffer'|'text', maxBytes}),                 // Promise<{ok, data, error}>

  /** Forget cached db handle (used by fault injection 'storage.writeFail' recovery). */
  reset(),
  /** For leak tests: open transactions, pending timers, listeners added by this module. */
  counters()
};
// StoError { code:'E-STO-001'|'E-STO-002'|'E-STO-003'|'E-STO-004', message:string,
//            cause:string|null /* DOMException name */ }
```

Events emitted:

| Topic | Payload | When |
|---|---|---|
| `project.saved` | `{projectId, location, bytes, kind:'save' or 'checkpoint', at}` | after a verified write |
| `project.saveFailed` | `{projectId, code, message, kind:'save' or 'checkpoint'}` | after a failed or unverified write |
| `storage.quota` | `{usage, quota, ratio, known}` | after every estimate whose ratio >= 0.8, and once when a quota error occurs (ratio 1) |
| `storage.state` | `{mode, notice, localStorage, indexedDB, readOnly, lockedBy, reason}` (Part 4.4) | once at open and whenever the mode degrades at runtime |
| `settings.changed` | `{key, value, prev, source, keys?}` (Part 4.4) | after `loadSettings` and after every `saveSettings` |
| `storage.lock` | `{projectId, state:'acquired' or 'lost' or 'heldByOther', heldBy}` | on acquire result and when a `storage` event shows another tab took the lock |

Events consumed: `mode.leave` (release the lock when leaving `studio`), and the DOM
`storage`, `pagehide` and `visibilitychange` events (registered once at init, counted by
`counters()`).

#### 6.16.3 Internal state

```js
state = {
  mode:'memory', isFile:false, status:null,
  ls: Storage|null,                        // probed window.localStorage or injected fake
  idbFactory: IDBFactory|null, db: IDBDatabase|null, opening: Promise|null,
  memory: new Map(),                       // mode 'memory' only: key -> string
  index: {version:1, entries:[]},          // cached copy of flm.v1.projects.index
  locks: new Map(),                        // projectId -> {tabId, ts} as last read
  heartbeat: null,                         // setInterval handle for the held lock
  heldProjectId: null,
  lastQuota: {usage:0, quota:0, known:false},
  counters: {tx:0, timers:0, listeners:0}
};
```

Key layout in `localStorage` (prefix `flm.v1.`; the full catalog is Part 5.15):

| Key | Content | Cap |
|---|---|---|
| `flm.v1.probe` | transient `"1"` during init | removed |
| `flm.v1.projects.index` | JSON `{version:1, entries:[ProjectIndexEntry]}` | 64 KB, 200 entries |
| `flm.v1.project.<id>` | serialized project (localStorage path only) | 2 MB |
| `flm.v1.project.<id>.tmp` | in-flight safe write | transient |
| `flm.v1.project.<id>.bak` | previous good copy | 2 MB |
| `flm.v1.lock.<id>` | JSON `{tabId, ts}` | 128 B |
| `flm.v1.settings` | the settings document, owned by M-16 (`loadSettings`, `saveSettings`; M-27 normalizes and debounces) | <= 256 KB |
| `flm.v1.progress.history`, `flm.v1.progress.bests`, `flm.v1.progress.unlocks`, `flm.v1.progress.daily` | the four progress documents of Part 5.15, owned by M-25 through `get`/`set` | each <= 256 KB |
| `flm.v1.ckpt.<id>.<slot>` | checkpoint doc (mode `localOnly` only, <= 512 KB each) | 512 KB |

IndexedDB `flm-db` version 1 (schema owner: Part 5.15; this is what M-16 creates on
`upgradeneeded`):

| Store | keyPath | Indexes | Records |
|---|---|---|---|
| `projects` | `id` | `byModified` on `modifiedAt` | `{id, kind:'project' or 'backup' or 'checkpoint', projectId, name, modifiedAt, revision, sizeBytes, text:string, hash:number}`; backup id = `<projectId>.bak`; checkpoint id = `<projectId>.ckpt.<slot>` |
| `recordings` | `id` | `byProject` on `projectId` | `{id, projectId, trackId, startedAt, status, eventCount, events:[NoteEvent]}` |
| `charts` | `id` | `byProject` on `projectId` | reserved for cached generated charts (`{id, projectId, settingsHash, text}`); written by M-27 Library in Phase 8, read-through cache only |
| `characters` | `id` | none | `{id, modifiedAt, text}` character presets saved by M-22 through key-value-like helpers `Storage.characters.put/get/list/remove` (same safe-write algorithm) |

Invariants:

1. A `projects` record of kind `project` is only ever replaced by a record whose `hash`
   (`fnv1a32(text)`) was verified by read-back; the previous record becomes the `.bak`
   inside the same transaction (6.16.4 A).
2. `index.entries` is the only list the Library screen reads; it is rewritten after every
   successful save or delete and rebuilt from the stores on demand when its parse fails.
3. At most one project lock is held per tab; `heldProjectId` names it.
4. In mode `memory` every API still resolves (never rejects) and `state().notice` is the
   exact text in 6.16.4 D.

#### 6.16.4 Algorithms

A. Safe write

localStorage path (`set` and `saveProject` on the `ls` location):

```text
safeSetLocal(key, text):
  1. if text.length * 2 > cap(key) -> E-STO-001 (pre-check, no write attempted)
  2. try ls.setItem(key + '.tmp', text) catch QuotaExceededError or NS_ERROR_DOM_QUOTA_REACHED -> E-STO-001
     (any other DOMException -> E-STO-002)
  3. back = ls.getItem(key + '.tmp'); if back !== text -> remove tmp; E-STO-004
  4. prev = ls.getItem(key); if prev !== null: ls.setItem(key + '.bak', prev)
     (quota error here -> remove tmp; E-STO-001; the live key is untouched)
  5. ls.setItem(key, text); verify ls.getItem(key) === text else:
     restore: if prev !== null ls.setItem(key, prev); remove tmp; E-STO-004
  6. ls.removeItem(key + '.tmp'); return ok
```

Keys that are not projects (`settings`, `progress`, index, locks) use the same routine
without step 4 (no `.bak`) except `flm.v1.settings` and the four `flm.v1.progress.*` keys, which keep a
`.bak`. On init, any leftover `*.tmp` key is removed (an interrupted write never becomes
live).

IndexedDB path (`saveProject` on the `idb` location, `checkpoints.write`,
`recordings.put`, `characters.put`):

```text
safePutIdb(store, record):                      // record.id, record.text or record.events
  1. record.hash = fnv1a32(serializedPayload)
  2. tx = db.transaction([store], 'readwrite'); armTimeout(tx, 10 s)
     if store === 'projects' and record.kind === 'project':
        prev = await get(store, record.id)
        if prev: await put(store, {...prev, id: record.id + '.bak', kind:'backup'})
     await put(store, record)
     await tx.complete                            // 'complete' event; 'abort'/'error' -> map error
  3. verify: tx2 = readonly; back = await get(store, record.id);
     if (!back || back.hash !== record.hash) -> E-STO-004 (prev is still the .bak; the live
     record may be the new unverified one: in that case restore prev as live in a third tx
     and report E-STO-004; if restore also fails report E-STO-003 and keep the .bak)
  4. return ok
```

Error mapping: `QuotaExceededError` -> E-STO-001; `InvalidStateError`, `UnknownError`,
`VersionError`, `AbortError` on open -> E-STO-002; `DataError`, JSON parse failure or hash
mismatch on read -> E-STO-003; read-back mismatch after write -> E-STO-004. Transaction
timeout (10 s without `complete`) -> E-STO-002 with `cause:'timeout'`, and `reset()` is
called so the next operation reopens the database.

B. `saveProject(project, {force})`

1. `text = FLM.Project.serialize(project)`; `bytes = utf8Length(text)`;
   `hasRecordings = project.recordings.length > 0`.
2. Conflict check (E 5.3 "overwrite with a smaller or incomplete version", "two tabs"):
   read the index entry; if it exists and `entry.revision > project.history.revision` or
   `entry.modifiedAt > project.modifiedAt + 1000`, and `!force`: resolve
   `{ok:false, conflict:{storedRevision, storedModifiedAt}, error:null}`. The Studio shows
   `DLG-SaveConflict` text (Part 7.7): "A newer copy of this project was saved by another
   tab or session. Overwrite it, or save this one under a new name?" with buttons
   "Overwrite", "Save as copy", "Cancel". `force:true` skips the check; "Save as copy" calls
   `save` with a cloned project (new id, name + " copy").
3. Lock check: if `isLockedByOther(project.id)` and `!force` -> same conflict path with
   `heldBy`.
4. Routing (Part 5.8): `location = (bytes <= 2 MB && !hasRecordings) ? 'both' : 'idb'`.
   Mode `localOnly`: `location = 'ls'` if `bytes <= 2 MB && !hasRecordings`, else resolve
   `{ok:false, error:E-STO-001}` with the `DLG-ProjectTooLarge` text (Part 7.7) and the
   Export offer. Mode `memory`: write to `state.memory` only, resolve `ok:true,
   location:null`, and the Studio shows the memory notice (D) instead of "Saved".
5. `idb` write first (when applicable) via `safePutIdb('projects', {id, kind:'project',
   projectId:id, name, modifiedAt, revision, sizeBytes:bytes, text, hash})`; then `ls` write
   via `safeSetLocal('flm.v1.project.' + id, text)`. If the `ls` write fails with
   E-STO-001 but the `idb` write succeeded, the save is still `ok:true` with
   `location:'idb'` and a log entry (the index records the real location).
6. Update the index entry (upsert, newest first, cap 200 entries; a 201st project is
   refused before writing with E-STO-001 and the text "Project limit reached (200). Delete
   or export older projects."); write the index with `safeSetLocal`.
7. `FLM.Project.markClean(project, now)`; refresh `estimateQuota()` (fire and forget; emits
   `storage.quota` when ratio >= 0.8); emit `project.saved`; resolve `ok:true`.
8. Any failure: emit `project.saveFailed` with the StoError and resolve `ok:false`. The
   UI must never show "Saved" unless `ok === true` (E 11, P 16).

`loadProject(id)`: index entry decides the location; try `idb` first, then `ls`; a record
whose `hash !== fnv1a32(text)` is E-STO-003 and `loadBackup` is offered. `load` returns the
raw text; `FLM.Project.deserialize` does the rest (so storage never needs the schema).

C. IndexedDB open and probe

```text
openDb():
  if state.db: return state.db
  if state.opening: return state.opening
  state.opening = new Promise:
    req = idbFactory.open('flm-db', 1); timer 5 s -> reject E-STO-002 'timeout'
    req.onupgradeneeded: create the four stores and indexes of 6.16.3 (idempotent checks)
    req.onblocked: log 'idb blocked' (another tab holds an old version; cannot happen at v1 but handled)
    req.onsuccess: db = req.result; db.onversionchange = () => { db.close(); state.db = null }
                   db.onclose = () => { state.db = null }; resolve db
    req.onerror: reject mapped error
  finally state.opening = null
probe at init:
  local: try { ls.setItem(probe,'1'); ok = ls.getItem(probe) === '1'; ls.removeItem(probe) } catch -> local.ok = false
  idb: if (!('indexedDB' in window)) idb.ok = false else try openDb() with the 2 s probe timeout
       (Firefox private windows reject with InvalidStateError; Safari on file:// has rejected
       opens in some versions; both become mode 'localOnly')
  mode = idb.ok && local.ok ? 'full' : (local.ok ? 'localOnly' : (idb.ok ? 'idbOnly' treated as 'full'
         with settings mirrored into idb 'characters'? NO: decided: 'full' requires local; idb-only
         becomes 'localOnly'-equivalent for settings in memory plus idb for projects, reported as mode 'full'
         with local.ok false and notice text D2) : 'memory')
```

Decision for the rare idb-ok/local-fail combination: mode is reported as `full`, settings
and index live in `state.memory` for the session and are additionally written to a
`characters`-store record `__settings__` so they survive reloads; `state().notice` is text
D2. Reason: losing IndexedDB projects because `localStorage` is blocked would contradict
"preserve user work whenever possible" (B 24).

D. User-facing storage notices (exact text; shown by `FLM.Screens` as a dismissible bar in
`SCR-Studio` and `SCR-Library`, and once as a toast after init):

- D1 (`localOnly`): "Browser database unavailable: projects are saved in limited local
  storage (2 MB each, no recordings). Export projects to keep them safe."
- D2 (`full` with local blocked): "Settings cannot be saved by this browser context; they
  are stored with your projects instead and may reset when site data is cleared."
- D3 (`memory`): "Saving is unavailable in this browser context. Your work is kept in memory
  only until you export it."
- D4 (`isFile` and `localOnly`): D1 followed by " Opening the file over http(s) usually
  restores the database."

E. `file://` behaviors detected at runtime (E 9; verified per browser by XT tests, Part 12)

| Behavior | Detection | Consequence |
|---|---|---|
| `localStorage` throws SecurityError (Firefox with `security.fileuri.strict_origin_policy` variants, some Safari configurations) | probe in C | mode `localOnly` or `memory` |
| IndexedDB open rejects or hangs on `file://` (Firefox older profiles, Safari) | probe with 2 s timeout | mode `localOnly`, notice D4 |
| `navigator.storage.estimate` missing or rejecting | try/catch | `quota.known:false`; the UI shows "unknown" instead of a percentage |
| Every `file://` page shares one origin in Chromium ("file:" origin) so another HTML file in the same folder could read keys | `location.protocol === 'file:'` | all keys carry the `flm.v1.` prefix and the index records `appId:'flm'`; nothing else is done (documented limitation in About) |
| `download` attribute ignored (older iOS Safari) | `'download' in HTMLAnchorElement.prototype` false | `download` uses `method:'dataUrl'` (opens a new tab with the data URL and the toast "Use Share or Save to keep this file.") |
| `<input type=file>` cannot be opened programmatically without a gesture | `pick()` is only called from click handlers | contract documented for M-27 |

F. Download and import

`download(fileName, data, mimeType)`:
1. `blob = data instanceof Blob ? data : new Blob([data], {type: mimeType})`; cap 256 MB
   (above -> `{ok:false, error:E-EXP-006}` from Part 10.6 and the toast "Export too large
   for this browser.").
2. If `'download' in HTMLAnchorElement.prototype` and not `isIosSafari`: `url =
   URL.createObjectURL(blob)`; `a = document.createElement('a'); a.href = url; a.download =
   sanitize(fileName); a.rel = 'noopener'; document.body.appendChild(a); a.click(); remove;
   setTimeout(revokeObjectURL, 10000)`; `method:'anchor'`.
3. Else: `FileReader.readAsDataURL(blob)` (<= 32 MB; above -> `method:'none'`, error E-EXP-009 text
   "This browser cannot download files larger than 32 MB from a local page. Try a desktop
   browser.") then `window.open(dataUrl, '_blank')`; if `open` returns null (popup blocked)
   -> `method:'none'` with E-EXP-005 and its text "The browser blocked the download. Allow
   downloads for this page, or use Copy to clipboard."
4. `sanitize(fileName)`: replace characters outside `[A-Za-z0-9._ -]` with `_`, collapse
   runs, max 80 chars, keep the extension.

`pickFile({accept, multiple})`: one hidden `<input type="file">` is created lazily and
reused; `accept` joins extensions and MIME types (`.mid,.midi,audio/midi,...`); resolve on
`change` with `Array.from(input.files)`; resolve `[]` on `cancel` event or when `window`
regains focus with no `change` within 1,500 ms (iOS fallback); reset `input.value = ''`
after reading so the same file can be chosen twice.

`enableDrop(element, onFiles)`: `dragenter/dragover` call `preventDefault()` and add
class `drop-active`; `dragleave` removes it; `drop` calls `preventDefault()`, collects
`dataTransfer.files`, removes the class, calls `onFiles`. Returns a `dispose()` that removes
all four listeners (counted).

`readFile(file, {as, maxBytes})`: if `file.size > maxBytes` -> `{ok:false, error}` before
reading (E 1 "imported data is treated as trusted"); else `file.arrayBuffer()` or
`file.text()` with a 30 s timeout.

G. Concurrent-tab guard

1. `lock(id)`: read `flm.v1.lock.<id>`; if present with `tabId !== self` and
   `now - ts < 45 s` -> `{ok:false, heldBy, since}`; the Studio opens the project read-only
   (every command factory call is refused by the Studio layer with the toast "This project is
   open in another tab. Close it there to edit here.") and shows a "Take over" button that
   calls `acquire(id, {force:true})`.
2. Otherwise write `{tabId:self, ts:now}` (plain `setItem`, no `.bak`), start the heartbeat
   `setInterval(15 s)` refreshing `ts`, set `heldProjectId`.
3. `storage` event with key `flm.v1.lock.<heldProjectId>` and a different `tabId` -> emit
   `storage.lock {state:'lost'}`; the Studio switches to read-only and shows "Another tab
   took over this project. Your unsaved changes stay here until you export or take over
   again."
4. `release`: clear heartbeat, `removeItem` if the record still names this tab; called on
   `mode.leave` of `studio`, on `pagehide`, and by `deleteProject`.
5. Modes `memory` and the idb-only case have no `storage` event source; the guard is then
   inert and `acquire` always succeeds (documented).

H. Checkpoint sink

`write(projectId, slot, doc)`: mode `full` -> `safePutIdb('projects', {id: projectId +
'.ckpt.' + slot, kind:'checkpoint', projectId, modifiedAt: doc.checkpoint.savedAt,
revision: doc.checkpoint.revision, sizeBytes, text: JSON.stringify(doc), hash})` without
the `.bak` step; mode `localOnly` -> `safeSetLocal('flm.v1.ckpt.' + projectId + '.' +
slot, text)` only when `bytes <= 512 KB`, else reject with E-STO-001 and `cause:'ckptCap'`
(Autosave counts it as a failure; after 3 the Studio notice says "Autosave stopped: project
too large for local storage."). Mode `memory` -> resolve without writing (checkpoints are
pointless when nothing survives reload; `Autosave.state().lastSlot` stays null and the
Studio shows "Autosave unavailable").
`list(projectId)`: `projects` store `getAll` over `IDBKeyRange.bound(projectId + '.ckpt.',
projectId + '.ckpt.~')` or the three local keys; returns `{slot, modifiedAt, revision}`.
`remove(projectId)`: deletes all three slots.

#### 6.16.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Quota exceeded on save | QuotaExceededError or pre-check | live record and `.bak` untouched | after deleting projects or exporting | unsaved edits | `DLG-SaveFailed` with E-STO-001 text and buttons "Export", "Manage projects", "Cancel" | memory until export | nothing to undo | UT-16-05, UT-16-14 |
| Write interrupted (tab closed mid-write) | leftover `.tmp` key or missing hash at next init | live record is the previous good copy | automatic (next save) | the interrupted save only | none (silent cleanup, logged) | n/a | init removes `*.tmp` | UT-16-06 |
| Read-back mismatch | hash or string compare | previous copy restored or kept as `.bak` | user retries | unsaved edits | E-STO-004 text | export | step A restore | UT-16-07 |
| IndexedDB unavailable or open timeout | probe or E-STO-002 | localStorage path | on next `init` or `reset()` | projects over 2 MB cannot be saved | notice D1 or D4 bar; `DLG-ProjectTooLarge` on save | `localOnly` | reopen on next operation | UT-16-02, UT-16-03 |
| Both backends unavailable | probe | memory | n/a | everything unsaved | notice D3; Save button label becomes "Export" in `SCR-Studio` | `memory` | n/a | UT-16-04 |
| Corrupt record (bad JSON or hash) | E-STO-003 on load | `.bak` | user chooses "Open backup" | the damaged save | dialog "The saved project record is damaged ... A backup copy from the previous save may be available." with "Open backup" | n/a | load `.bak`, then save under the same id | UT-16-08 |
| Index damaged | JSON parse failure on `flm.v1.projects.index` | stores | automatic | none | none (rebuild logged) | n/a | rebuild index from `projects` store `getAll` and `ls` keys | UT-16-10 |
| Another tab holds the lock | lock record fresh | both tabs' data | "Take over" | the other tab's unsaved edits if taken over | toast and read-only banner (G) | read-only | release or force | UT-16-16, UT-16-17 |
| Transaction timeout or `versionchange` close | timer or event | stores | next operation reopens | in-flight write only | E-STO-002 text on the failed operation | n/a | `reset()` | UT-16-11 |
| Download blocked | `window.open` null or no `download` support | project in memory | user allows pop-ups | none (data still in memory) | toast texts in F | data URL | n/a | UT-16-19 |
| File read failure or oversize | pre-check or reader error | current project untouched | pick again | none | E-IMP text (Part 10.6) | n/a | n/a | UT-16-20 |

#### 6.16.6 Limits and performance notes

- `localStorage` budget: browsers allow about 5 MB per origin (10 MB in Firefox); the module
  keeps `flm.v1.*` under 4.5 MB total by refusing a project write whose `bytes + usedBytes()
  - existingBytes > 4.5 MB` with E-STO-001 before touching storage.
- A 2 MB project write on the `ls` path performs three `setItem` calls (tmp, bak, live) and
  two `getItem` reads: about 10 MB of string copying, measured under 100 ms on desktop in
  PT tests; it never runs during playback (Autosave gating) so the main-thread stall cannot
  reach the audio scheduler.
- IndexedDB writes are asynchronous; the `text` payload is one string per record so
  structured-clone cost is linear and no per-event objects are cloned.
- `estimateQuota()` runs at most once per 10 s (debounced) and after every save.
- `list()` reads only the index (one `getItem`), never the stores, so `SCR-Library` opens in
  O(1) storage operations.
- Lock heartbeat is one timer and one write per 15 s while a project is open in Studio.
- `counters()` must return `{tx:0, timers:0}` after `mode.leave` of `studio` plus the three
  permanent window listeners (`storage`, `pagehide`, `visibilitychange`) registered at init.

#### 6.16.7 Spec coverage

B 15.6 (download/export helper, import file helper), B 18.1 (storage options evaluated:
localStorage plus IndexedDB with file-based download as backup; quotas, privacy settings,
http vs file differences), B 18.3 (unsupported versions produce an understandable error via
M-15; storage never corrupts), B 18.4 (too large -> export path), B 21.4 (pagehide releases
locks), B 23.1 (size pre-check before reading files), B 24 (storage quota errors, corrupted
projects), E 1 rows "Saving fails or corrupts projects" and "Browser storage assumptions are
incorrect", E 5.3 (all twelve cases: quota, interrupted write, browser closes during save,
missing audio references reported by M-15 validation, older schema and unknown fields via
M-15, partially corrupted record, same project opened twice, two tabs, renamed project,
overwrite with smaller version via conflict check, large recordings routed to IndexedDB),
E 9 (file:// storage differences, file import blocked, feature requires secure context is
not the case for storage), E 10 item 7 (browser storage is not the only backup: export is
first-class), E 11 (save failure never reports success), I 5.3, I 12 (persistent settings
and recoverable projects), I 13 (explicit save confirmation only after success, safe handling
of failed exports), P 16 (every bullet), P 18 (browser storage behavior verified for the
deployment context; file import and export tested from the delivered file).

#### 6.16.8 Unit tests (group `storage`, file `src/91-test-storage.js`)

Unit tests inject `FLM.SelfTest.fakes.indexedDB()` (in-memory IDBFactory fake, M-31) and
`FLM.SelfTest.fakes.localStorage()` (Map-backed, with a settable quota in bytes and a
`failNextWrite` switch) through `Storage.open({idbFactory, localStorage, now})`. The real
backends are exercised by the integration tests in Part 12.

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-16-01 | init full mode | both fakes healthy | `state().mode === 'full'`, notice null, `storage.state` emitted once, four stores created with the indexes of 6.16.3 |
| UT-16-02 | init localOnly when idb open rejects | fake idb whose open rejects InvalidStateError | mode `localOnly`; notice equals text D1 exactly |
| UT-16-03 | init localOnly when idb open hangs | fake idb that never fires success; fake clock advanced 2,100 ms | mode `localOnly`; `state().idb.error === 'timeout'`; init resolved (never rejects) |
| UT-16-04 | init memory mode | fake localStorage throwing SecurityError, no idb | mode `memory`; notice D3; `set` then `get` round-trips in memory |
| UT-16-05 | safeSetLocal quota pre-check and error | fake quota 1 MB, value of 1.5 MB | returns E-STO-001; no `.tmp`, no live key written; `project.saveFailed` not emitted for kv (only for projects) |
| UT-16-06 | leftover tmp cleanup | pre-seed `flm.v1.project.x.tmp` and a good live key | after init: tmp removed, live key intact |
| UT-16-07 | read-back verification failure restores previous | fake localStorage that corrupts the next write of the live key | result E-STO-004; live key equals previous value; `.bak` equals previous value |
| UT-16-08 | corrupt record detection and backup load | idb record with wrong hash | `load` returns E-STO-003; `loadBackup` returns the `.bak` text |
| UT-16-09 | save routing both vs idb | project A 100 KB no recordings; project B with one recording; project C 3 MB | A: `location 'both'`, present in ls and idb; B and C: `location 'idb'`, absent from ls |
| UT-16-10 | index upsert, order and rebuild | save 3 projects with increasing modifiedAt; corrupt the index key; call `list()` | before corruption newest first; after corruption `list()` rebuilds 3 entries from the stores with correct locations |
| UT-16-11 | transaction timeout maps to E-STO-002 and reset | fake idb that never completes a readwrite tx; clock +10,100 ms | save resolves `ok:false` E-STO-002 cause 'timeout'; `state.db` null; next save reopens and succeeds |
| UT-16-12 | save success emits and marks saved | dirty project | `project.saved` payload `{projectId, location, bytes, kind:'save'}`; `Project.isDirty` false afterwards |
| UT-16-13 | save failure never marks saved | fake quota 0 in localOnly mode | `ok:false`; `Project.isDirty` still true; `project.saveFailed` emitted with E-STO-001 |
| UT-16-14 | localOnly too-large refusal | localOnly mode, project with recordings | `ok:false`, E-STO-001, no write attempted (fake write counter unchanged) |
| UT-16-15 | conflict detection | save project; set index entry revision higher; save again without force; then with force | first returns `conflict` and `ok:false`; forced save `ok:true` |
| UT-16-16 | lock acquire and heldByOther | pre-seed lock record of tab 'other' with fresh ts; then with ts 50 s old | fresh: `ok:false, heldBy 'other'`; stale: `ok:true` and record now names this tab |
| UT-16-17 | lock loss via storage event | acquire; dispatch synthetic `storage` event for the key with another tabId | `storage.lock {state:'lost'}` emitted; `isLockedByOther` true; heartbeat timer cleared |
| UT-16-18 | checkpoint sink ring behavior | write slots 0,1,2 then list | three entries with the right revisions; `remove` deletes all; localOnly mode rejects a 600 KB checkpoint with cause 'ckptCap' |
| UT-16-19 | download fallback selection | stub `HTMLAnchorElement.prototype.download` absent and `window.open` returning null | `method:'none'` with E-EXP-005; with `download` present `method:'anchor'` and an anchor click observed |
| UT-16-20 | file read pre-check | fake File of 30 MB with maxBytes 25 MB | `ok:false` before any read (reader stub not called) |
| UT-16-21 | delete removes everything | save, write 2 checkpoints, acquire lock, then `delete` | project, `.bak`, checkpoints, lock and index entry all gone; `exists` false |
| UT-16-22 | get with damaged value | seed `flm.v1.settings` with invalid JSON | `get` returns fallback, key removed, one Log entry |
| UT-16-23 | quota warning | fake `navigator.storage.estimate` returning usage 90, quota 100 | `storage.quota` emitted with ratio 0.9 and `known:true`; with estimate missing `known:false` and no emit |
| UT-16-24 | counters clean after release | acquire lock, run a save, release, await | `counters()` tx 0, timers 0, listeners equal to the three permanent ones |
| UT-16-25 | idb-only combination | fake localStorage throwing, fake idb healthy | mode reported `full`, notice D2, `set/get` work in memory and persist in the `characters` store record `__settings__` |
| UT-16-26 | rename updates record and index | save, `rename(id, 'New')` | stored text parses with name 'New'; index entry name 'New'; `.bak` holds the old name |
| UT-16-27 | sanitize file names | `download('my song: take/1.mid', ...)` with anchor path | anchor `download` attribute equals `my song_ take_1.mid` |

#### 6.16.9 Implementation notes and browser quirks

- Wrap every `localStorage` access in try/catch: Safari in private mode (older versions)
  throws on `setItem` with quota 0; Firefox throws `SecurityError` when storage is disabled;
  Chromium returns `null` for unknown keys but throws when the browser is shutting down.
- IndexedDB requests must be attached to handlers synchronously in the same task they are
  created, or Safari may fire `success` before the handler exists. The wrapper creates
  request and handlers inside one function (`reqToPromise`).
- Safari (desktop and iOS) has thrown `InvalidStateError` on `open` when called during
  `pagehide`; the module never opens the database from the `pagehide` handler, it only
  releases the lock.
- `QuotaExceededError` name differs: Chromium `QuotaExceededError`, Firefox
  `NS_ERROR_DOM_QUOTA_REACHED` (code 1014), Safari `QuotaExceededError` with `code 22`.
  The mapping checks `name`, `code === 22` and `code === 1014`.
- The `storage` event fires only in other tabs of the same origin, never in the writing tab,
  which is exactly what the lock guard needs. On `file://` in Chromium all local files share
  one origin, so the event also fires between two different HTML files; the key prefix keeps
  them apart.
- `navigator.storage.estimate()` is unavailable in Safari below 16.4 and on `file://` in
  some Chromium builds; always `known:false` in that case, never a fabricated percentage.
- Object URLs are revoked after 10 s; Safari has aborted downloads when the URL was revoked
  synchronously after `click()`.
- `pagehide` is preferred over `beforeunload` (unreliable on iOS and blocked for pages with
  no user gesture); `visibilitychange` to `hidden` also triggers `unlock` only when
  the mode is not `studio` (in Studio the lock stays held while the tab is merely hidden).

### 6.17 M-17 Studio (`src/17-studio.js`, `FLM.Studio`)

#### 6.17.1 Responsibilities and non-goals

Responsibilities:

- Bind one open `Project` to the shared engine while the `studio` mode is active: transport
  (tempo override, loop region, count-in), audio channel strips, input events (B 7.4, B 16,
  I 1.1, I 5).
- Track lifecycle operations as thin wrappers over M-15 commands with the Studio-level
  rules (locked tracks are forked, limits are explained, deletions are confirmed by the UI).
- `Recorder`: MIDI-event capture with count-in, overdub, loop record and take management
  (B 11.5, B 16.2, B 16.3, E 5.1, I 5).
- Piano-roll editing operations with selection, grid snap, clipboard, quantize (B 16.4, I 5).
- Section markers and section playback (I 5, I 6.3 "restart from a section").
- Mixer state binding to `FLM.Audio.ChannelStrip` and the master gain (B 16.5, E 5.2).
- Autosave orchestration: safe-point notifications to `FLM.Project.Autosave` (BRIEF
  section 6, I 13).
- Limits: 32 tracks, 100,000 events per track (BRIEF section 6).

Non-goals:

- No DOM. `SCR-Studio` (M-27) renders the arrangement overview, track list, piano roll and
  mixer from the data this module exposes and calls these functions.
- No audio rendering to WAV (that is the export path in Part 5.14 through M-05
  `OfflineAudioContext` and M-16 download; Studio only triggers it).
- No chart generation and no gameplay judging in Studio.
- No audio-track recording (microphone) in v1: `Recorder` captures MIDI events only
  (B 11.5 distinction; stated on the record button tooltip "Records notes, not sound").

#### 6.17.2 Public API

```js
FLM.Studio = {
  LIMITS: { maxTracks: 32, maxEventsPerTrack: 100000, maxClipboardEvents: 100000,
            chordWindowMs: 30, maxTakesPerSession: 64 },
  GRID: ['1/4', '1/8', '1/16', '1/32', '1/8T', '1/16T'],

  // ---- recorder (Studio.Recorder) ----
  Recorder: {
    state(),        // 'idle'|'armed'|'countin'|'recording'|'finishing'
    arm(trackId, {countInBars, overdub:true, loop:false, keepAllPasses:false}),
    disarm(),
    start(),        // Promise<void> resolves when recording actually begins (after count-in)
    stop(),         // Promise<RecordingTake|null>  null when nothing was captured
    abort(),        // Promise<void>  discards the current take, previous take untouched
    takes(),        // RecordingTake[] from project.recordings for the armed track
    commitTake(takeId, {mode:'replace'|'merge'}),  // CommandResult via replaceTake
    discardTake(takeId),
    liveEvents()    // NoteEvent[] captured so far (for the live piano-roll preview)
  },

  // ---- session (Studio.Session): everything else ----
  Session: {
    /** Bind a project. Called by FLM.Modes on entering 'studio'. Creates channel strips,
     *  applies settings.tempoOverride/timeSig to the Transport, acquires the storage lock,
     *  starts Autosave. @returns {Promise<{ok:boolean, readOnly:boolean, notice:string|null}>} */
    open(project),
    /** Full teardown (6.17.4 H). Returns a Promise that resolves after the hard panic. */
    close(),
    project(),                     // Project|null
    isReadOnly(),                  // boolean (lock held elsewhere)

    // ---- tracks (each returns CommandResult from M-15; refused with ok:false when readOnly) ----
    addTrack({name, program, isDrums}),             // also Autosave.notify('trackAdd')
    deleteTrack(trackId),                           // stops recording on that track first; Autosave.notify('trackDelete')
    renameTrack(trackId, name),
    reorderTrack(trackId, newIndex),
    duplicateTrack(trackId),
    setInstrument(trackId, {program, isDrums}),
    /** Ensures an editable target: forks a locked track on first edit. @returns {string} id */
    ensureEditable(trackId),
    selectTrack(trackId),                            // current track for recording/editing
    currentTrackId(),

    // ---- mixer ----
    setMix(trackId, {gain, pan, mute, solo}),        // command + live strip update
    setMaster(gain),
    peak(trackId),                                   // {peak:number, clip:boolean} from Audio
    mixerState(),                                    // [{trackId, gain, pan, mute, solo, effectiveMute}]

    // ---- musical settings ----
    setTempo(bpm), setMeter(numerator, denominator), setKeyScale(key, scale),
    setCountIn(bars /* 0,1,2 */), setMetronome({enabled, volume}),
    setLoop(aTick, bTick /* exclusive */ ) , clearLoop(),

    // ---- markers and sections ----
    addMarker(tick, label), removeMarker(index), renameMarker(index, label), moveMarker(index, tick),
    sections(),                                      // [{index, label, startTick, endTick}]
    playSection(index, {loop:boolean}),              // seek + optional loop + play
    restartSection(),                                // seek to current section start


    // ---- piano roll ----
    select(trackId, {eventIds, rect:{tickFrom, tickTo, pitchFrom, pitchTo}, mode:'set'|'add'|'toggle'}),
    selection(),                                     // {trackId, eventIds:string[]}
    clearSelection(),
    move(dTicks, dPitch, {snap:boolean}),
    resize(dDurTicks, {snap:boolean}),
    remove(),
    setVelocity({value, delta}),
    copy(),                                 // {count}
    cut(),
    paste(atTick, trackId),                          // CommandResult
    quantize(QuantizeOptions),
    setGrid(grid /* '1/4'|'1/8'|'1/16'|'1/32'|'1/8T'|'1/16T' */), grid(),
    snapTick(tick),                                  // nearest grid tick (bar-aware)

    // ---- undo passthrough ----
    undo(), redo(), canUndo(), canRedo(), undoLabel(), redoLabel(),

    // ---- data views for SCR-Studio ----
    overview(),      // {durationTicks, bars:[{index, tick}], sections, tracks:[{id, name, color, density:[per bar]}], loop, playhead}
    pianoRollData(trackId, {tickFrom, tickTo}),      // {notes:[{id, tick, durTicks, pitch, velocity, selected}], derivedNotes}

    /** For leak tests: {listeners, timers, strips} */
    counters()
  }
};
```

Events emitted:

| Topic | Payload | When |
|---|---|---|
| `studio.recording` | `{state, trackId, takeId, passIndex, eventCount}` | on every Recorder state change and after each loop pass |
| `project.changed` | (emitted by M-15 when Studio pushes commands) | n/a |

Events consumed: `input.event` (only while `Recorder.state() === 'recording'` or for live
monitoring in Studio), `transport.state`, `transport.loop`, `transport.seek`,
`audio.state`, `mode.leave`.

#### 6.17.3 Internal state

```js
state = {
  project:null, readOnly:false, currentTrackId:null,
  strips: Map<trackId, ChannelStrip>,            // from FLM.Audio.createStrip(trackId)
  selection: {trackId:null, ids:new Set()},
  clipboard: null,                                // {anchorTick, events:[Event without ids]}
  grid:'1/16',
  countInBars:1, metronome:{enabled:true, volume:0.8},
  recorder: {
    state:'idle', trackId:null, options:null,
    originTick:0,                                 // transport tick where tick 0 of the take sits
    startAudioTime:0,                             // audio time of originTick (after count-in)
    events:[],                                    // NoteEvent[] of the current pass
    held: Map<string /* pitch:channel */, {noteId, tick, velocity}>,
    passIndex:0, passes:[],                       // RecordingTake[] when keepAllPasses
    take:null,                                    // RecordingTake being built
    previousTakeId:null,                          // last committed take on the track (never touched by abort)
    monitorVoices: Map<pitch, voiceHandle>        // live monitoring voices (FLM.Instruments)
  },
  subs: [],                                       // event bus unsubscribe functions
  timers: new Set()
};
```

Invariants:

1. `strips.size === project.song.tracks.length` while open; a strip exists for every track
   including hidden `lockedSource` sources (muted, so forked sources stay silent).
2. `recorder.held` is empty whenever `recorder.state === 'idle'` (every stop/abort path
   closes held notes).
3. A `RecordingTake` reaches `project.recordings` only through `Recorder.stop()` with
   `status:'complete'` or `Recorder.abort()` with `status:'aborted'` (kept for the session so
   the UI can show "Recording aborted (N notes discarded)"; pruned by M-15 invariant 10).
4. `previousTakeId` and the track's events are never modified by `start`, `stop` or
   `abort`; only `commitTake` (a `replaceTake` command) changes track events.
5. `selection.ids` only contains ids that exist on `selection.trackId`; commands that delete
   events remove them from the selection; undo of a deletion does not re-select.
6. Every bus subscription made in `open` is recorded in `subs` and removed in `close`;
   `counters().listeners === 0` after `close`.

#### 6.17.4 Algorithms

A. `open(project)`

1. `state.project = project`; `FLM.Project.rebuildIndexes(project)`.
2. `lock = await FLM.Storage.lock(project.id)`; `readOnly = !lock.ok`; notice text
   from 6.16.4 G when read-only.
3. For each track: `strip = FLM.Audio.createStrip(track.id)`; `strip.set(track.mix)`;
   `FLM.Instruments.setProgram(track.id, track.program, track.isDrums)`.
4. `FLM.Audio.master.setGain(project.mixer.master.gain)`.
5. Transport: `FLM.Transport.bind(project.song)`; if `settings.tempoOverride !== null`
   `Transport.setTempoOverride(bpm)` else `Transport.clearTempoOverride()`;
   `Transport.setCountIn(countInBars)`; loop cleared; `Transport.seek(0)`.
6. Subscribe to `input.event`, `transport.state`, `transport.loop`, `transport.seek`,
   `audio.state`.
7. `FLM.Project.Autosave.setSafePredicate(() => Transport.state() === 'stopped' &&
   recorder.state === 'idle')`; `Autosave.start(project, {intervalMs: 60000})`.
8. `recoverable = await Autosave.findRecoverable(project.id, project.history.lastSavedAt
   || project.modifiedAt)`; return it in the result as `notice` so `SCR-Studio` can show
   `DLG-RecoverCheckpoint` ("An autosaved version from {time} is newer than the last save.
   Restore it?" with "Restore", "Keep current"). "Restore" calls
   `FLM.Project.restoreCheckpoint(doc)` then `open` again with the restored project.

B. Track operations

- `addTrack`: refuse when `readOnly` (toast text in 6.16.4 G); refuse when
  `tracks.length >= 32` with the E-PRJ-020 text; push `Commands.addTrack`; on success create
  the strip, select the track, `Autosave.notify('trackAdd')`.
- `deleteTrack`: if `recorder.trackId === trackId` and state is not idle -> `Recorder.abort()`
  first (E 5.2 "deletes a track referenced by an active recording"); if the transport is
  playing, `FLM.Audio.releaseTrack(trackId)` (soft release of that strip's voices, 30 ms)
  before the command so no voice outlives its strip; push `deleteTrack`; dispose the strip;
  clear selection if it pointed at the track; `Autosave.notify('trackDelete')`. The
  confirmation dialog `DLG-DeleteTrack` is shown by `SCR-Studio` before calling this.
- `ensureEditable(trackId)`: if `!Project.isLocked(project, trackId)` return `trackId`;
  `existing = Project.editableTrackId(project, trackId)`; if non-null return it; else push
  `Commands.forkTrack(trackId)`, create a strip for the copy, return the new id. Every
  editing entry point (`addEvents` via paste, `move`, `Recorder.arm`, ...) calls
  this first, so an imported song is never mutated (I 5.1).
- `setInstrument`: push the `setTrackInstrument` command; `FLM.Instruments.setProgram` for the strip; voices
  already sounding keep the old patch (M-06 rule).

C. Mixer binding

`setMix(trackId, patch)`: push `Commands.setMix` (coalesced); on success
`strips.get(trackId).set(patch)`. Solo semantics live in `FLM.Audio` (solo set: when the
set is non-empty every strip not in it is effectively muted). `mixerState()` reads
`effectiveMute` from the strip so the UI shows dimmed tracks correctly (E 5.2 "soloed while
another is soloed": both stay soloed; un-soloing the last clears the set). Muting a track
with sustaining notes: the strip's gain ramps to 0 in 5 ms and the voices continue to their
release silently (M-05 click-free rule), so no stuck notes and no clicks (P 6.2).
`setMaster(gain)`: `setMaster` command plus `Audio.master.setGain`. `peak(trackId)` is a
read-through to the strip's analyser.

D. Recorder

State machine:

| State | Action | Next | Side effects |
|---|---|---|---|
| idle | arm(trackId, opts) | armed | `trackId = ensureEditable(trackId)`; store opts; `previousTakeId` = id of the newest `complete` take of that track or null |
| armed | start() | countin (countInBars > 0) or recording | `Transport.startCountIn(bars)` or `Transport.play()`; if `Transport.state() === 'playing'` already (overdub while playing, E 5.1): skip count-in, `originTick = Transport.positionTick()` at the next beat boundary, state recording |
| countin | transport.state -> playing | recording | `originTick = Transport.tickAtCountInEnd()`, `startAudioTime = Transport.audioTimeAt(originTick)`; `events = []`; `held.clear()`; `passIndex = 0`; `take = {id:uid(), trackId, startedAt:Date.now(), events:[], countIn:bars, tempoAtRecord: Transport.currentBpm(), status:'recording', startTick: originTick, endTick:null}` |
| countin | stop() or abort() | idle | `Transport.stop()`; nothing captured; `studio.recording` emitted; no take created |
| recording | input.event press | recording | algorithm D2 |
| recording | input.event release | recording | algorithm D2 |
| recording | transport.loop (wrap) | recording | algorithm D3 |
| recording | stop() | finishing -> idle | algorithm D4; resolves the take |
| recording | abort() | idle | close held notes silently (no events added), `take.status = 'aborted'`, push take into `project.recordings` (for the session message), `Transport.stop()`; track and `previousTakeId` untouched |
| recording | audio.state suspended or transport.state -> paused by interruption | finishing -> idle | treated as `stop()` (E 5.1 "browser suspends audio during recording"); the take is kept with `status:'complete'` and `interrupted:true`; toast "Recording stopped: audio was interrupted. The take was kept." |
| recording | deleteTrack(trackId) | idle | `abort()` first (B) |
| any | close() | idle | `abort()` when recording, `disarm()` otherwise |

D2. Event capture (`input.event` while recording):

1. Ignore events whose `control` is not `lane0..3`, `sustain`, `octUp`, `octDown` or a
   `midi` note (Studio recording uses the Free Play mapping; dance controls are ignored).
2. `action = FLM.Mapping.resolve(evt, profileContext)` where `profileContext` is the current
   Free Play profile, key, scale, octave for the armed track's instrument (M-08). The chord
   window (30 ms) applies in Profile C only; lanes are independent notes otherwise.
3. For `press` with pitches `P[]`: `tick = Transport.tickAt(evt.tAudio) - originTick`;
   if `tick < 0` (press during the last count-in beat) clamp to 0 (E 5.1 "recording starts
   before the count-in finishes": notes ahead of the origin are recorded at tick 0, never
   dropped). For each pitch: if `held.has(key)` first close it at `tick` (same-pitch retrigger,
   E 2.3); create `NoteEvent {kind:'note', id:uid(), tick, durTicks:0, pitch, velocity:
   evt.pressure ? round(1 + evt.pressure * 126) : 100, offVelocity:64, channel:track.channel}`;
   `held.set(key, ...)`; start a monitoring voice `FLM.Instruments.noteOn(trackId, pitch,
   velocity, FLM.Audio.clock().now() + 0.005)` so the player hears the note immediately (recorded
   `tick` uses the input time, not the monitoring time; calibration offsets are not applied
   here: judging offsets belong to `Rhythm.Judge` only, BRIEF 4.6 invariant).
4. For `release`: `tick` as above; for each pitch of the action: `h = held.get(key)`; if
   absent ignore (release without press, e.g. after a loop wrap); `durTicks = max(1, tick -
   h.tick)`; push the completed NoteEvent into `events`; `held.delete(key)`; stop the
   monitoring voice with `noteOff` at `now + 0.005`.
5. `sustain` press sets `sustainDown = true`; releases while sustain is down are deferred:
   the note is moved to `pendingRelease`; on `sustain` release all pending notes close at the
   release tick (this records the sustain effect as longer durations; CC 64 events are not
   recorded in v1, stated in the Help screen as "Sustain is recorded as note length").
6. `liveEvents()` returns `events` plus synthetic open notes from `held` (durTicks to the
   current tick) for the live piano-roll preview.

D3. Loop wrap during recording (`transport.loop` with `{fromTick:b, toTick:a}`):

1. Close every held note at `b - originTick` (`durTicks = max(1, ...)`); do not reopen at `a`
   (a note held across the wrap is recorded once, ending at the loop end; E 2.2 "loop
   boundary during a sustained note").
2. Finish the pass: `pass = {...take, id: uid(), events: events.slice(), status:'complete',
   endTick: b - originTick, passIndex}`.
3. If `options.keepAllPasses`: push `pass` into `recorder.passes` and into
   `project.recordings` (capped by `LIMITS.maxTakesPerSession`; beyond it the oldest pass of
   this session is dropped with a one-time toast "Keeping the last 64 passes"). Else: replace
   `recorder.lastPass = pass` (default: the last complete pass wins).
4. `events = []`; `passIndex += 1`; `originTick` stays (the take's tick space is relative to
   the first pass start, so every pass covers `[a - originTick, b - originTick)`); emit
   `studio.recording`.

D4. `stop()`:

1. `state = 'finishing'`; `stopTick = Transport.tickAt(FLM.Audio.clock().now()) - originTick`;
   close every held note at `stopTick` (E 5.1 "recording stops while notes are held"); stop
   monitoring voices with a 30 ms release.
2. `Transport.stop()` (which triggers Autosave via `notify('stop')` after the take is stored
   below, because the safe predicate requires `recorder.state === 'idle'`).
3. Choose the take events: loop record -> `lastPass.events` (or the last entry of `passes`)
   plus the current partial pass only if it contains events and the user stopped mid-pass
   (the partial pass is appended as a separate take with `partial:true` when `keepAllPasses`,
   otherwise it replaces `lastPass` only when `events.length > 0 and lastPass is null`);
   non-loop -> `events`.
4. If the chosen events are empty: `state = 'idle'`, resolve `null` (toast "Nothing was
   recorded"), nothing stored.
5. `take.events = chosen` sorted by the M-03 comparator; `take.status = 'complete'`;
   `take.endTick = stopTick` (loop: `b - originTick`); push into `project.recordings`
   through `FLM.Project.applyRaw(project, Commands.addRecording(take))` (not undoable; takes
   are data, committing is the undoable step); `state = 'idle'`; emit `studio.recording`.
6. Resolve the take. `SCR-Studio` then shows the take review bar ("Keep", "Keep and merge",
   "Discard", "Record again") which calls `commitTake(takeId, {mode})` or `discardTake`.

`commitTake(takeId, {mode})`: `mode 'replace'` for a re-record (E 5.1 "records over an
existing take": the previous events in the take's tick range are replaced, undoable);
`mode 'merge'` for overdub onto the same track (the default when `options.overdub` and the
track already has events). Events are shifted by `originTick` back into song ticks at commit.
After commit the take stays in `project.recordings` (so "use another take" remains possible)
until pruned by M-15 invariant 10.

Overdub mixing: while recording, every other track plays normally through its strip; the
armed track's existing events also play unless the UI set its `mix.mute` (the "Mute track
while recording" toggle in `SCR-Studio`, default off). Monitoring voices use the armed
track's strip so its gain and pan apply.

Time origin statement: the take's tick 0 is the transport tick at count-in end
(`originTick`); when recording starts from a non-zero position (punch-in) `originTick` is
that position; all ticks in `RecordingTake.events` are relative to `originTick`; the Studio
converts to song ticks at commit (`tick + originTick`). This single rule answers E 5.1
"consistent time origin".

E. Piano-roll operations

- `select`: `mode 'set'` replaces, `'add'` unions, `'toggle'` flips; `rect` selects notes
  whose `[tick, tick + durTicks)` intersects `[tickFrom, tickTo)` and pitch in range.
- `move(dTicks, dPitch, {snap})`: `trackId = ensureEditable(selection.trackId)`;
  if `snap`, `dTicks` is adjusted so the earliest selected note lands on `snapTick(minTick +
  dTicks)` and all notes move by the same delta (relative timing preserved); push
  `moveEvents`. `dPitch` is ignored for drum tracks (drum pitches are instrument keys; the
  UI shows the row labels from `FLM.Theory.gmDrumName`). Coalesced during drags.
- `resize(dDurTicks, {snap})`: with snap, the delta is chosen so the longest selected
  note's end lands on the grid; push `resizeEvents`.
- `remove`: push `deleteEvents`; clear selection.
- `setVelocity`: push the `setVelocity` command (coalesced).
- `copy`: `clipboard = {anchorTick: min tick, events: deepClone without ids and
  minus anchorTick}`; cap `maxClipboardEvents`.
- `cut` = copy + delete (one `group`).
- `paste(atTick, trackId)`: `target = ensureEditable(trackId)`; `atTick = snapTick(atTick)`
  when the grid is on; events get `tick + atTick`, new ids, `channel` of the target track;
  push `addEvents` (M-03 overlap policy shortens earlier notes; the result count of
  displaced notes is shown in the toast "Pasted N notes (M shortened)"). Pasting beyond
  `song.durationTicks` extends the song (E 5.2 "moved beyond the song's current end":
  `durationTicks` is recomputed by M-03 from the last event end).
- `quantize(opts)`: push `quantize` with the current selection (6.15.4 D).
- `snapTick(tick)`: bar-aware nearest grid tick using `MeterMap.tickOfBar` so a snap never
  crosses a bar boundary unless the tick itself is already in the next bar.

F. Markers and sections

`sections()` derives `[{index, label, startTick, endTick}]` from `song.markers` of kind
`section` sorted by tick; the first section starts at 0 (label "Intro" when no marker at 0 is
present, synthetic, not stored); the last ends at `durationTicks`. When the song has no
markers, sections are every 4 bars labelled "Bars N-M" (synthetic). `playSection(index,
{loop})`: `Transport.seek(startTick)`; `loop ? Transport.setLoop(startTick, endTick) :
Transport.clearLoop()`; `Transport.play()`. `restartSection()`: seek to the start of the
section containing the playhead.

G. Musical settings

- `setTempo(bpm)`: refuse while `recorder.state !== 'idle'` with toast "Stop recording to
  change the tempo" (E 5.1 "changes tempo during a recording": the tempo is frozen for the
  take; `tempoAtRecord` documents it); otherwise push `setTempo` and update the Transport
  (`setTempoOverride` for imported songs, `rebind` of the tempo map for native songs). When
  the transport is playing, the Transport re-anchors at the current tick (M-04 rule) so the
  position does not jump.
- `setMeter`, `setKeyScale`: push the command; `setKeyScale` also updates the Free Play
  mapping context used by the recorder.
- `setCountIn(bars)`: 0, 1 or 2; stored in settings `studio.countInBars` (Part 5.11).
- `setMetronome({enabled, volume})`: `FLM.Audio.Metronome.set(...)`; during count-in the
  metronome is forced on (BRIEF: count-in is metronome only, accented on beat 1).
- `setLoop(a, b)`: requires `b - a >= 1 beat`; `Transport.setLoop(a, b)`.

H. `close()` (called by `FLM.Modes` leave, before the generic teardown of Part 4.7)

1. If `recorder.state` is recording or countin -> `await Recorder.abort()`; else `disarm()`.
2. `Transport.stop()`; `FLM.Audio.panic(false)` (soft); after the release time (max 250 ms)
   the Modes contract performs the hard panic.
3. `await FLM.Project.Autosave.flush()` only when `Project.isDirty(project)` and the safe
   predicate is true (it is, after step 2); then `Autosave.stop()`.
4. Unsubscribe everything in `subs`; clear `timers`; dispose every strip
   (`FLM.Audio.disposeStrip(id)`); `strips.clear()`.
5. `FLM.Storage.unlock(project.id)`; `state.project = null`; selection and clipboard
   cleared (the clipboard does not survive leaving Studio; stated in Help).
6. `counters()` must read `{listeners:0, timers:0, strips:0}`.

#### 6.17.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Audio suspended during recording | `audio.state` suspended | captured events so far; previous take | user resumes audio and records again | the interrupted take only | toast in D state table; `DLG-ResumeAudio` from M-05 | recording stops, playback paused | take kept as `complete, interrupted:true` | UT-17-12 |
| Recording started before audio unlocked | `FLM.Audio.isUnlocked() === false` in `start()` | project | after unlock gesture | none | `DLG-AudioBlocked` (M-29 text) and `start()` resolves without starting | n/a | state back to armed | UT-17-13 |
| Held notes at stop or abort | invariant 2 | track events | n/a | none | none | n/a | all held closed at stop tick | UT-17-07, UT-17-08 |
| Track deleted while recording on it | `deleteTrack` path | other tracks, previous take | n/a | the current take (discarded) | toast "Recording aborted: the track was deleted" | n/a | abort then delete | UT-17-14 |
| Memory growth from a very long take (E 5.1 "exceeds available memory") | `events.length > 100,000` during recording | track events | n/a | the overflow | recording auto-stops with toast "Recording stopped at 100,000 notes (track limit)" | n/a | `stop()` path | UT-17-15 |
| Project read-only (lock elsewhere) | `readOnly` | project | "Take over" | none | banner text 6.16.4 G | view and play only | lock acquired | UT-17-20 |
| Command refused (limits, locked target) | CommandResult ok:false | project | after fixing | none | toast with the E-PRJ text | n/a | n/a | UT-17-03 |
| Quantize would cross a bar | algorithm D in 6.15.4 | events | n/a | none | result count mentions "kept inside bars" | n/a | undo | UT-17-17 |
| Autosave fails | `project.saveFailed` | project in memory | next safe point | unsaved edits | Studio notice (6.15.5) | manual save/export | n/a | UT-17-22 |
| Strip creation fails (audio graph error) | exception from `FLM.Audio.createStrip` | project data | `open` again after `Audio.panic(true)` | none | `E-AUD` text from M-05 | Studio opens without sound, editing works | hard panic rebuilds the graph | UT-17-23 |
| Navigate away before saving (E 5.1) | `mode.leave` with dirty project | checkpoint written by H step 3 when safe | n/a | unsaved edits beyond the checkpoint | `DLG-UnsavedChanges` shown by Modes before leave | n/a | checkpoint recovery on next open | UT-17-24 |

#### 6.17.6 Limits and performance notes

- Recording: `held` map operations are O(1); `events.push` per release; a 100,000-note take
  stays under 10 MB in memory (about 100 bytes per NoteEvent object).
- `liveEvents()` is called by the UI at most once per frame and returns a view of the
  current pass only; the piano roll renders only the `[tickFrom, tickTo)` window via
  `pianoRollData`, which uses the M-03 by-time binary search (O(log n + k)).
- `overview()` density per bar is computed once per `project.changed` and cached.
- Monitoring voices use the same `VoiceAllocator` as playback; recording a dense passage on
  top of a dense arrangement is subject to the 64/32 voice cap with the M-05 stealing order.
- Loop record passes are capped at 64 per session (`maxTakesPerSession`) and 64 takes per
  project (M-15 `maxRecordings`).
- Limits shown in `SCR-Studio` and About: 32 tracks per project, 100,000 events per track,
  1,000,000 events per project.

#### 6.17.7 Spec coverage

B 7.3 (record and replay a performance in Free Play uses the same Recorder with a scratch
project), B 7.4 (every bullet: track creation, instrument per track, recording, playback,
overdubbing, mute/solo, volume/pan, naming, tempo and time signature, key and scale, timing
edits, looping and section playback, undo/redo, save/load/export triggers, mixer, MIDI vs
audio distinction), B 11.5 (MIDI-event recording vs audio), B 16.1-16.5, E 2.2 (loop
boundary during a sustained note while recording), E 2.3 (same pitch retriggered before
release), E 5.1 (all ten cases), E 5.2 (delete referenced track, mute while sustaining, solo
semantics, clipping via peak meter and limiter in M-05, volume/pan during playback, undo
repeatedly, redo after new edit, move beyond end, quantize across bar, instrument
unavailable: every GM program is synthesized so this cannot occur, stated), E 11 (interrupted
recording never overwrites the previous take), I 5 (all ten essential improvements), I 5.1,
I 5.2 (arrangement overview data), I 6.3 (loop, restart from section, mute target and lower
accompaniment through setMix), I 13 (recoverable recording sessions), P 9 (free-play
performances can be recorded and replayed), P 10 (every bullet), P 16 (autosave does not
interrupt gameplay or recording).

#### 6.17.8 Unit tests (group `studio`, file `src/91-test-studio.js`)

Tests use the M-31 fakes: fake clock for `FLM.Transport`, `OfflineAudioContext` for
`FLM.Audio`, the in-memory IndexedDB fake for `FLM.Storage`, and
`FLM.SelfTest.fakes.inputEvent({control, type, tAudio})` to synthesize `input.event`.

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-17-01 | open binds strips and transport | project with 3 tracks, tempoOverride 100 | `counters().strips === 3`; Transport tempo override 100; Autosave running; lock acquired by this tab |
| UT-17-02 | close leaves zero leaks | open then close | `counters()` all zero; `FLM.Modes.assertClean()` deltas zero; Autosave stopped; lock released |
| UT-17-03 | addTrack limit and readOnly refusal | 32 tracks; then a read-only open (lock pre-seeded by another tab) | 33rd add `ok:false` E-PRJ-020; read-only add `ok:false` with the read-only toast text |
| UT-17-04 | ensureEditable forks locked tracks once | fromSong project | first call pushes `forkTrack` and returns a new id; second call returns the same id; source hidden and muted; strip count +1 |
| UT-17-05 | recorder count-in origin | arm with countInBars 1 at 120 BPM 4/4; start; advance fake clock 2.0 s | state `recording`; `originTick === 0`; take.countIn 1; tempoAtRecord 120 |
| UT-17-06 | capture press/release ticks | press lane0 at audio time origin+0.5 s, release at +1.0 s | one NoteEvent tick 960, durTicks 960, velocity 100, pitch from the Free Play mapping |
| UT-17-07 | held notes closed on stop | press two lanes, stop at +2.0 s without releases | two events with durTicks ending at tick 3840; `held` empty; state idle |
| UT-17-08 | abort never touches previous take | commit a take (replace) to the track; arm again, press notes, abort | track events identical to after the first commit; new take `status:'aborted'` in recordings; previous take id unchanged |
| UT-17-09 | press before origin clamps to 0 | press during the last count-in beat (tick -200) | recorded tick 0, not dropped |
| UT-17-10 | same-pitch retrigger | press lane0, press lane0 again at +0.25 s (via octave trick producing the same pitch), release | first note closed at the second press tick; two events |
| UT-17-11 | overdub while playing starts immediately | Transport playing at tick 1920; arm with overdub and start | no count-in; state recording; `originTick` equals the next beat boundary (2880) |
| UT-17-12 | audio suspension stops recording and keeps take | recording with 3 events; emit `audio.state {state:'suspended'}` | state idle; take `complete, interrupted:true` stored; held empty |
| UT-17-13 | start refused when audio locked | fake Audio `isUnlocked` false | `start()` resolves; state stays armed; `DLG-AudioBlocked` request emitted (toast/dialog hook called once) |
| UT-17-14 | deleteTrack during recording aborts first | recording on track T; `deleteTrack(T)` | recorder idle before deletion; track gone; no error thrown; strips count decreased |
| UT-17-15 | recording auto-stops at event limit | inject 100,000 events via the test hook then one more release | state idle; toast text "Recording stopped at 100,000 notes (track limit)"; take complete |
| UT-17-16 | loop record default keeps last pass | loop [0, 3840); record 3 passes with different note counts (2, 5, 3) | stop resolves a take with 3 events (last pass); `project.recordings` has exactly that take |
| UT-17-17 | loop record keepAllPasses | same with `keepAllPasses:true` | recordings has 3 takes with passIndex 0,1,2 and counts 2,5,3; held note across the wrap closed at tick 3840 and not reopened |
| UT-17-18 | commitTake replace vs merge | track with notes in [0, 7680); take over [1920, 3840) | replace: notes in range replaced, outside kept; merge: all kept plus take; undo restores |
| UT-17-19 | quantize uses bar rule | notes near bar boundary at 1/8 grid | note at tick 3830 moved to 3360 (last 1/8 in bar 0) when `allowBarCross:false`; to 3840 when true |
| UT-17-20 | read-only mode blocks edits but allows playback | lock held by another tab | `open` returns `readOnly:true`; `move` ok:false; `Transport.play()` through Studio succeeds |
| UT-17-21 | paste at snapped tick with new ids and channel | copy 3 notes from track A (channel 0), paste at tick 1000 on track B (channel 3) with grid 1/16 | pasted at tick 960; ids new; channel 3; result toast count "Pasted 3 notes" |
| UT-17-22 | autosave safe points | dirty project; `Transport.stop()` emits transport.state stopped | checkpoint written once (fake sink); no write while playing (advance fake timer 60 s during playback) |
| UT-17-23 | strip creation failure degrades | fake `Audio.createStrip` throwing for one track | `open` resolves ok with notice mentioning sound; editing commands work; no exception escapes |
| UT-17-24 | close flushes checkpoint when dirty and safe | dirty project, stopped transport, close | `Autosave.flush` wrote one checkpoint before `stop()`; lock released |
| UT-17-25 | solo semantics via mixerState | solo A, solo B, unsolo A, unsolo B | effectiveMute: after solo A: B,C muted; after solo B: only C muted; after unsolo A: A,C muted; after unsolo B: none muted |
| UT-17-26 | sections derived from markers and fallback | song with markers at 0 'Verse', 3840 'Chorus'; song without markers (16 bars) | 2 sections with correct bounds; 4 synthetic sections 'Bars 1-4' ... with 4-bar bounds |
| UT-17-27 | setTempo refused while recording | recording state | `setTempo(140)` returns ok:false with the toast text; tempo unchanged |
| UT-17-28 | sustain extends durations | press lane0, press sustain, release lane0, release sustain 1 s later | the note's durTicks ends at the sustain release tick |
| UT-17-29 | move snap preserves relative timing | notes at 100 and 350 selected, move +500 with snap at 1/16 | earliest lands on 720 (nearest grid to 600 is 720? no: nearest to 600 is 480 or 720 -> 480 by round-half-down rule? decided: Math.round((600)/240)=3 -> 720); second note at 970; delta identical for both |
| UT-17-30 | overview density cache | 4-bar song, 10 notes in bar 2 | `overview().tracks[0].density` equals [0,10,0,0]; unchanged object identity until a `project.changed` |

Note on UT-17-29: `Math.round(600 / 240) = Math.round(2.5) = 3`, so the snapped tick is 720
and the delta applied to both notes is 620 (100 -> 720, 350 -> 970). The row records the
decided arithmetic so the implementer does not re-derive it.

#### 6.17.9 Implementation notes and browser quirks

- Monitoring latency: the monitoring voice starts at `Audio.clock().now() + 0.005`; on iOS the
  `AudioContext` output latency can add 20-60 ms, which the player perceives but which does
  not affect recorded ticks (input time is used). The Help screen states "Recorded timing
  uses when you pressed, not when you heard the note".
- `input.event` for `pointer` sources arrives with `tAudio` mapped by M-07; Studio never reads
  `performance.now()` for musical time.
- Loop record relies on `transport.loop` being emitted exactly once per wrap by M-04 with
  the wrap's audio time; the Recorder closes held notes at the wrap tick, not at the time
  the event handler runs.
- Chromium throttles `setInterval` in background tabs to once per minute; the Autosave timer
  (60 s) is unaffected in practice, and `visibilitychange` back to visible triggers
  `Autosave.notify('timer')` so a long background stay still produces a checkpoint on return.
- Safari fires `audio.state` suspended when the screen locks even in Studio; the Recorder
  treats it as a stop (D state table) rather than attempting to continue across the gap, so a
  take never contains a silent hole of unknown length.
- Keep `Recorder` free of DOM and of `FLM.UI` calls: the toast texts are returned in
  `studio.recording` payload field `message` and in CommandResults so `SCR-Studio` shows them;
  this keeps the group `studio` tests headless and deterministic.
