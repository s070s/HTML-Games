### 6.23 M-23 Dance (`src/23-dance.js`, `FLM.Dance`)

#### 6.23.1 Responsibilities and non-goals

Responsibilities:
- Own the `DanceChart` and `DanceStep` runtime rules (Part 5.9.3): validation with an explicit
  strict mode (generated charts) and repair mode (imported charts), so that contradictory
  steps are either rejected or resolved with a named warning, never silently kept (E 7).
- `DanceChartGenerator`: derive one dance chart per difficulty (`easy`, `normal`, `hard`)
  from a `Song` deterministically: same song and difficulty -> byte-identical chart
  (I 6.2 safeguard, B 26.6). The generator never mutates the song (S-08).
- Step input mapping: controls `dance0..dance3` (M-07, dance context) -> directions 0..3
  (0 left, 1 down, 2 up, 3 right), plus the two display layouts `arrows` and `pads`.
- Dance scoring through `FLM.Rhythm` unchanged (B 14.4): `DanceJudge` converts steps to
  `ChartNote`s (`lanes = directions`), maps the dance difficulty to an instrument window
  preset, and adds the dance-only rules: life bar (optional, default off), finish detection,
  practice speed, loop passes and the speed ramp.
- `ChoreographyController`: an M-20 controller that poses the dancing performer from the
  chart and audio time only (S-03); a missing rig, a disabled stage or a controller error
  never blocks step input or scoring (E 7, P 12).
- Custom chart import and export as `.flmdance.json` (Part 5.14.2), with migration through
  `Dance.migrate` (Part 5.7 shape).
- The distinct dance HUD data model (I 7 "distinct gameplay HUD", P 12).

Non-goals:
- No drawing: the dance highway (receptors, scrolling steps) is drawn by M-21 from the chart
  and `LAYOUTS`; the HUD widgets are M-26; the pads DOM is M-26 `TouchPads`.
- No storage: imported charts are persisted by the SCR-Dance controller (M-27) into the
  IndexedDB `charts` store (Part 5.15); M-23 only produces and checks the documents.
- No input listening of its own: the wrapped Rhythm Judge subscribes to `input.event`.
- No choreography editor (B 4.4 P2 "choreography editing" is Deferred); presets only.
- Dance styles beyond the four-direction step game (P2) are Deferred.

#### 6.23.2 Public API

```js
FLM.Core.define('Dance', function (FLM) {
  return {
    VERSION: 1,                         // dance chart file format version (flm-dance)
    DIFFICULTIES: ['easy', 'normal', 'hard'],
    /** Direction ids are fixed (BRIEF 5). */
    DIRECTIONS: [
      { id: 0, name: 'left',  control: 'dance0', glyph: 'L' },
      { id: 1, name: 'down',  control: 'dance1', glyph: 'D' },
      { id: 2, name: 'up',    control: 'dance2', glyph: 'U' },
      { id: 3, name: 'right', control: 'dance3', glyph: 'R' }
    ],
    /** Dance difficulty -> Rhythm window preset (6.9 WINDOWS). Frozen. */
    WINDOW_MAP: { easy: 'beginner', normal: 'intermediate', hard: 'advanced' },
    /** Validation constants (6.23.4 A). Frozen. */
    MAX_SIMULTANEOUS: { easy: 1, normal: 2, hard: 2 },
    MIN_SPACING_TICKS: { easy: 960, normal: 480, hard: 480 },
    MIN_GAP_MS: { easy: 300, normal: 200, hard: 150 },
    HOLD_MIN_TICKS: 1920,               // two quarter notes (Part 5.9.3)
    HOLD_RELEASE_MARGIN_TICKS: 120,     // generator gap between a hold end and the next step in that direction
    LIMITS: { maxSteps: 20000, maxFileBytes: 2097152, maxJsonDepth: 8, endGraceTicks: 3840 },
    /** Display layouts (display only; data is identical). Frozen. */
    LAYOUTS: {
      arrows: { columns: [0, 1, 2, 3], pads: 'row',     label: 'Arrows' },
      pads:   { columns: [0, 1, 2, 3], pads: 'diamond', label: 'Dance pads' }
    },
    /** Optional failure rule (default off: settings gameplay.lifeBar = false). Frozen. */
    FAILURE_RULES: {
      lifeBar: { start: 50, max: 100, failAt: 0,
                 delta: { perfect: 2, great: 1, good: 0, miss: -8, holdBreak: -8 } },
      disabledInPractice: true          // speed != 1 or loop enabled -> life shown but never fails
    },

    /** 'dance0'..'dance3' -> 0..3; anything else -> -1. */
    controlToDirection(control /* string */) /* -> number */,
    /** 0..3 -> 'dance0'..'dance3'; throws E-INP-011 outside 0..3. */
    directionToControl(dir /* number */) /* -> string */,

    /** Validate a chart. opts.mode 'strict' (generated: no repair, any finding is an error) or
     *  'repair' (imported: resolve per 6.23.4 A and report warnings). opts.song gives the
     *  end-of-song bound; without it the end rule V8 is skipped. Never throws; never mutates
     *  its input (works on a deep copy in repair mode). */
    validate(chart /* object */, opts /* {mode:'strict'|'repair', song?:Song} */)
      /* -> ValidationReport {ok:boolean, chart:DanceChart|null, issues:DanceIssue[], repaired:number} */,
    // DanceIssue { code:string /* 'DANCE-...' */, severity:'error'|'warn', stepIndex:number|null,
    //              message:string /* user-facing ASCII <= 200 chars */ }

    /** Part 5.9.3 hash: hex8(fnv1a32(difficulty + '|' + 'F' + '|' + generatorVersion + '|' + song.id + '|' + sourceEventCount)), sourceEventCount = NoteEvents over all tracks (the 5.9.1 rule). */
    settingsHash(song /* Song */, difficulty /* string */) /* -> string 8 hex */,

    DanceChartGenerator: {
      VERSION: 1,                       // generatorVersion written into charts
      /** Deterministic; synchronous (a 10 min song has < 2,500 steps). Emits chart.ready
       *  {kind:'dance'}. Throws E-IMP-010 when the song has no notes and no meter (empty song). */
      generate(song /* Song */, difficulty /* string */, opts /* ?{layout:'arrows'|'pads'} */)
        /* -> DanceChart */,
      /** Analysis used by generate, exposed for SCR-Dance preview text and tests. */
      analyze(song) /* -> {drumTrackIds:string[], bassTrackId:string|null, activeBars:number,
                            bars:number, hasMarkers:boolean} */
    },

    /** DanceChart -> Rhythm Chart shape (ChartNote with lanes = directions). Pure. */
    asJudgeChart(chart /* DanceChart */) /* -> Chart {id, songId, trackId:null, instrument:-1,
        difficulty: WINDOW_MAP[chart.difficulty], profile:'F', notes, generatorVersion, settingsHash} */,

    /** Singleton facade over the one active dance run (one dance mode at a time). */
    DanceJudge: {
      /** Creates the Rhythm judge, loads the converted chart, applies calibration and window
       *  preset, attaches to input.event and transport events with `opts.owner`.
       *  Throws E-INP-012 when the chart fails strict validation. */
      bind(chart /* DanceChart */, song /* Song */, opts /* DanceBindOptions */) /* -> void */,
      // DanceBindOptions { owner:any, transport:Transport (default FLM.Transport.main),
      //   calibration:Calibration, judgmentPreset:'standard'|'relaxed'|'strict',
      //   strayPenalty:boolean, lifeBar:boolean, practiceSpeed:number 0.5..1.0,
      //   speedRamp:boolean (default false), choreography:ChoreographyController|null }
      onInput(evt /* InputEvent */) /* -> JudgeResult|null (forwarded to the Rhythm judge) */,
      /** Called once per frame by the mode frame (M-28). Declares misses, updates life,
       *  detects the finish. */
      tick(audioNow /* seconds */) /* -> JudgeResult[] */,
      restart() /* -> void */,
      /** Ends the run: emits chart.finished once. endedBy 'end'|'user'|'fail'|'net'. */
      finish(endedBy /* string */) /* -> PerformanceSummary */,
      dispose() /* -> void (idempotent) */,
      state() /* -> DanceState */,
      // DanceState { score:ScoreState, life:number|null, lifeEnabled:boolean, failed:boolean,
      //   passIndex:number, speed:number, practice:boolean, finished:boolean, bound:boolean }
      hud() /* -> DanceHud (6.23.4 F) */,
      results() /* -> JudgeResult[] */,
      summary() /* -> PerformanceSummary (Rhythm 6.9.2) plus {kind:'dance', failed, lifeMin} */
    },

    /** M-20 controller implementation for the dancing performer (6.23.4 E). */
    ChoreographyController: class {
      constructor(rig /* FLM.Rig.Rig */, chart /* DanceChart */, song /* Song */,
                  opts /* {transport, reducedMotion:boolean, style:'calm'|'normal'|'energetic'} */);
      /** Pure function of (tick, audioNow) plus the judged-miss set; dt smooths nothing musical. */
      update(tick /* number */, audioNow /* seconds */, dtMs /* number */) /* -> void */,
      /** Same pose computation without touching the rig (tests and the Flat2D silhouette). */
      poseAt(audioNow /* seconds */) /* -> PoseSpec */,
      markMiss(stepId /* string */) /* -> void */,
      setReducedMotion(on /* boolean */) /* -> void */,
      enabled() /* -> boolean (false after an error or without a rig) */,
      dispose() /* -> void */
    },
    /** Pose presets (data; 6.23.4 E). Frozen. */
    POSES: { /* idle, left, down, up, right, jump: PoseSpec */ },
    ANTICIPATION_MS: 120,
    RECOVERY_MS: 180,

    /** .flmdance.json export (Part 5.14.2). Pure. */
    exportChart(chart /* DanceChart */, song /* Song */) /* -> {fileName:string, text:string, bytes:number} */,
    /** Parse, migrate, validate (repair). Never throws.
     *  -> {ok:true, chart, warnings:DanceIssue[], notice:string|null}
     *   | {ok:false, error:{code:'E-IMP-012'|'E-IMP-017', message, detail}} */
    importChart(text /* string */, song /* Song */) /* -> object */,
    /** Part 5.7 shape; MIGRATIONS is empty for version 1. */
    migrate(doc /* object */) /* -> {ok:boolean, doc:object|null, applied:string[], error:object|null} */
  };
});
```

Events emitted: `chart.ready` with `kind:'dance'` (payload per Part 4.4: `{kind, chartId, songId,
trackId:null, difficulty, profile:null, noteCount, holdCount, omittedSourceEventIds:0,
settingsHash, generatorVersion, ms}`), and `chart.finished` with `kind:'dance'` (once per run,
from `DanceJudge.finish`; see 6.23.9 on topic ownership). `judge.result` and `score.update` are
emitted by the wrapped Rhythm judge (M-09 owns them).

Events consumed (subscribed with the bind owner token): `transport.state` (active flag, finish
on `reason:'end'`), `transport.seek` (restart), `transport.loop` (pass end), `input.event`
(through the Rhythm judge's `attach`), `settings.changed` for `calibration.*` and
`video.reducedMotion` (forwarded).

#### 6.23.3 Internal state

```js
DanceRun {                           // exists between bind() and dispose()
  chart: DanceChart, song: Song, judgeChart: Chart,
  judge: RhythmJudge,                 // FLM.Rhythm.Judge.bind(...) instance
  owner, transport,
  windowsName: 'beginner'|'intermediate'|'advanced',
  lifeEnabled: boolean, life: number, lifeMin: number, failed: boolean,
  practiceSpeed: number, speedRamp: boolean, loopEnabled: boolean, passIndex: number,
  lastResultCount: number,            // results already folded into life
  lastEndTick: number,                // max(step.tick + (isHold ? durTicks : 0))
  finished: boolean, startedAt: string /* ISO */, activeSince: number|null,
  playedSeconds: number,              // audio seconds while active (for PerformanceSummary.durationSec)
  choreography: ChoreographyController|null,
  lastJudgment: {judgment, part, atAudio}|null,
  missStreak: number
}

GeneratorScratch {                   // local to one generate() call
  slots: [{tick, bar, beat, half:boolean, drumScore:0..3, onset:boolean, sectionStart:boolean}],
  kept: [slot], jumps: Set<tick>, holds: Map<tick, endTick>, rng: Prng
}
```

Invariants:
1. A bound run has exactly one Rhythm judge; `dispose()` detaches it and removes every
   listener registered with the owner (bus `removeOwner` is also called by M-28 leave).
2. `life` is only changed by folding new `judge.result` entries in result order; it is a
   pure function of the result list and `FAILURE_RULES` (deterministic).
3. `finish()` emits `chart.finished` at most once per bind; `restart()` re-arms it.
4. Generated charts always pass `validate(chart, {mode:'strict', song})` (asserted at the end
   of `generate`; a failure is a generator defect reported as `E-IMP-010`).
5. M-23 never writes to `song`, `song.tracks` or any event (S-08).

#### 6.23.4 Algorithms

6.23.4 A. Validation (`validate`)

Rules are checked in order on a deep copy. "Repair" is the action in repair mode; in strict
mode every finding is `severity:'error'` and the report has `ok:false`, `chart:null`.

| Rule | Check | Issue code | Repair action (imported charts) |
|---|---|---|---|
| V1 | schema: the `danceChart` definition of Part 5.5 (ids, enums, integer ticks, `directions` 1-2 items, `steps` <= 20,000) after the import pre-pass (6.23.4 G) | `DANCE-SCHEMA` | none: fatal (`E-IMP-017`) |
| V2 | `steps` sorted by tick ascending | `DANCE-UNSORTED` | stable sort by tick |
| V3 | one step per tick | `DANCE-SAME-TICK` | merge same-tick steps: union of directions, `isHold` true if any part was a hold, `durTicks` the longest hold part |
| V4 | `directions` distinct, ascending, each 0..3 | `DANCE-DUP-DIRECTION` | dedupe and sort; out-of-range values are dropped by the pre-pass (V1) |
| V5 | `directions.length <= MAX_SIMULTANEOUS[difficulty]` counting directions held by active holds at that tick | `DANCE-TOO-MANY` | keep the lowest direction ids up to the cap; a step left with no direction is dropped |
| V6 | `isHold` implies `durTicks >= 1920`; a tap has `durTicks === 1` | `DANCE-HOLD-SHORT`, `DANCE-TAP-DURATION` | short hold -> tap (`isHold:false, durTicks:1`); tap duration -> 1 |
| V7 | no overlap in one direction: a later step using direction `d` starts at or after `hold.tick + hold.durTicks` of every earlier hold on `d` | `DANCE-HOLD-OVERLAP` | truncate the hold to end at `next.tick - 120`; if then shorter than 1920 -> tap |
| V8 | `tick + durTicks <= song.durationTicks + 3840` (only with `opts.song`) | `DANCE-PAST-END` | steps starting after the bound are dropped; a hold crossing it is truncated to the bound |
| V9 | consecutive step spacing `>= MIN_SPACING_TICKS[difficulty]` | `DANCE-DENSE` | none; kept with a `warn` (custom charts may be denser; generated charts never are) |
| V10 | step ids unique and matching the id pattern | `DANCE-ID` | reassign every id as `d<base36 ordinal>` in tick order |
| V11 | `songId` equals `opts.song.id` (only with `opts.song`) | `DANCE-OTHER-SONG` | `songId` rewritten; `info` severity; the import notice of Part 5.14.2 is returned |
| V12 | at least one step remains | `DANCE-EMPTY` | none: fatal (`E-IMP-017`) |

Repair mode returns `ok:true` when no fatal issue remains; every repair adds one `warn` issue
(V11 `info`) with `stepIndex` of the first affected step and a count in the message when one
rule repaired several steps ("12 overlapping holds were shortened."). Issue codes map to the
`ImportWarning` codes `W-DANCE-<suffix>` (for example `DANCE-HOLD-OVERLAP` ->
`W-DANCE-HOLD-OVERLAP`) when SCR-Dance lists them.

6.23.4 B. `DanceChartGenerator.generate(song, difficulty, opts)`

```text
generate(song, difficulty, opts):
  t0 = Core.now(); assert difficulty in DIFFICULTIES else throw E-INP-011
  hash = settingsHash(song, difficulty)
  rng  = new Core.Prng(Core.fnv1a32('dance|' + hash))
  A = analyze(song)
  if song.durationTicks === 0 or no track has notes: throw E-IMP-010 ("This song has no notes to dance to.")

  1. Slots. For every bar b in 0 .. meterMap.barCount(song.durationTicks) - 1:
       bs = meterMap.tickOfBar(b); m = meterMap.entryAt(bs); tpb = 3840 / m.denominator
       be = min(meterMap.tickOfBar(b + 1), song.durationTicks)
       if bar b is not active (A: no note of any track overlaps [bs, be)): continue
       for i in 0 .. m.numerator - 1:
         t = bs + i * tpb; if t >= be: break
         push slot {tick:t, bar:b, beat:i, half:false}
         if tpb >= 960 and t + tpb/2 < be: push slot {tick:t + tpb/2, bar:b, beat:i, half:true}
     For every slot:
       drumScore = max over drum notes n (A.drumTrackIds) with |n.tick - slot.tick| <= 60 of
                   3 if n.pitch in {49, 52, 55, 57} (crash, china, splash, crash 2)
                   2 if n.pitch in {35, 36, 38, 40} (kicks and snares)
                   1 if n.velocity >= 64
                   0 otherwise                      (0 when no drum track)
       onset = some non-drum note starts within +-60 ticks of slot.tick
       sectionStart = slot is the first slot at or after the start tick of a section of
                      FLM.Model.sections(song) (marker or auto 4-bar sections)
  2. Candidates by difficulty (hasDrums = A.drumTrackIds.length > 0):
       easy:   !half and (beat === 0 or (beat === 2 and (!hasDrums or drumScore >= 2)))
       normal: (!half and (beat === 0 or !hasDrums or drumScore >= 1))
               or (half and (hasDrums ? drumScore >= 2 : (onset and bar % 2 === 1 and beat === numerator - 1)))
       hard:   (!half) or (half and (onset or drumScore >= 1))
  3. Spacing filter (ascending ticks): keep a candidate when
       tick - lastKept.tick >= MIN_SPACING_TICKS[difficulty] and
       (tempoMap.ticksToSeconds(tick) - tempoMap.ticksToSeconds(lastKept.tick)) * 1000 >= MIN_GAP_MS[difficulty]
     (the first candidate is always kept).
  4. Jumps (two directions): easy none.
       normal: kept slots with sectionStart.
       hard:   kept slots with sectionStart, or drumScore === 3, or (!hasDrums and !half and beat === 0 and bar % 2 === 0).
       Then, ascending: a jump whose previous kept slot is also a jump loses its jump flag.
  5. Holds. bass = A.bassTrackId. For each bass note n in tick order with
       n.durTicks >= max(2 * tpbAt(n.tick), HOLD_MIN_TICKS):
       s = kept slot with |s.tick - n.tick| <= 60 that is not a jump; if none: skip
       if another hold is active at s.tick: skip
       end = min(n.tick + n.durTicks, song.durationTicks); if end - s.tick < HOLD_MIN_TICKS: skip
       holds.set(s.tick, end)
       easy: remove kept slots with s.tick < tick < end + MIN_SPACING_TICKS.easy
       normal, hard: kept slots inside (s.tick, end) lose their jump flag (two feet: hold + one)
  6. Directions (one rng.next() per single step, one per jump), in tick order (6.23.4 C).
  7. Hold clamp: for each hold step h on direction d, find the next step using d;
       if next.tick < h.tick + h.durTicks + HOLD_RELEASE_MARGIN_TICKS:
         h.durTicks = next.tick - HOLD_RELEASE_MARGIN_TICKS - h.tick
         if h.durTicks < HOLD_MIN_TICKS: h becomes a tap (isHold false, durTicks 1)
  8. Assemble: steps in tick order, ids 'd' + (index + 1).toString(36);
       chart = {id: song.id + ':dance:' + hash, songId: song.id, difficulty, steps,
                generatorVersion: 1, layout: opts.layout or 'arrows', settingsHash: hash,
                source:'generated', name:''}
  9. r = validate(chart, {mode:'strict', song}); if !r.ok: report E-IMP-010 with r.issues[0]; throw
 10. emit chart.ready {kind:'dance', chartId, songId, trackId:null, difficulty, profile:null,
       noteCount: steps.length, holdCount, omittedSourceEventIds:0, settingsHash: hash,
       generatorVersion:1, ms: Core.now() - t0}; return chart
```

`analyze(song)`:
- `drumTrackIds`: tracks with `isDrums === true`, `kind !== 'audio'` and at least one note, in
  song order.
- `bassTrackId`: the first non-drum MIDI track in song order whose `program` is 32..39 (GM Bass
  family) and that has at least 8 notes; else the non-drum track with at least 8 notes and the
  lowest median pitch (ties -> earlier track); else `null` (no holds are generated).
- An active bar is a bar overlapped by at least one note of any track (I 4.4 critical rule
  applied to dance: no steps are invented during silence).
- `tpbAt(tick) = 3840 / meterMap.entryAt(tick).denominator`.

Worked example (4/4, 120 BPM, no drums, 8 active bars, no markers -> auto sections at bars 0
and 4): easy keeps beats 1 and 3 of each bar (16 steps, 960 ticks = 0.5 s apart, both above
the 300 ms gap); normal keeps every beat (32) plus the "and of 4" in bars 1, 3, 5, 7 where a
melody note starts; hard keeps every beat and every half-beat with an onset, with jumps at
bars 0, 2, 4, 6 downbeats (bars 0 and 4 are also section starts).

Difficulty measurability (P 5.3, P 12): for each built-in song Part 12 records steps per
minute, jump count and hold count per difficulty; the generator guarantees easy < normal <
hard in steps per minute for every song with at least 8 active bars (asserted by UT-23-11).

6.23.4 C. Direction assignment

Feet model: direction 0 is left-foot only, 3 is right-foot only, 1 and 2 may be taken by either
foot. The generator alternates feet and never stacks three identical single steps.

```text
state: nextFoot = 'L'; prev1 = -1; prev2 = -1; hold = null  // {dir, foot, end}
WEIGHTS = { L: [[0, 2], [1, 1], [2, 1]], R: [[3, 2], [1, 1], [2, 1]] }
JUMP_WEIGHTS = [[[0, 3], 3], [[1, 2], 1], [[0, 1], 1], [[0, 2], 1], [[1, 3], 1], [[2, 3], 1]]

for each kept slot s in tick order:
  if hold and s.tick >= hold.end: hold = null
  if s is a jump (and hold === null):
    dirs = weightedPick(JUMP_WEIGHTS, rng); prev1 = prev2 = -1; nextFoot = 'L'; emit step; continue
  foot = hold ? other(hold.foot) : nextFoot
  options = WEIGHTS[foot] minus { hold.dir if hold } minus { d : prev1 === d and prev2 === d }
  if options is empty: options = fallback order (L: 0, 1, 2; R: 3, 2, 1) minus the same exclusions,
                       first element only; if still empty: lowest direction != hold.dir
  dir = weightedPick(options, rng)
  if holds.has(s.tick): hold = {dir, foot, end: holds.get(s.tick)}
  prev2 = prev1; prev1 = dir; nextFoot = other(foot); emit step {directions:[dir]}

weightedPick(list, rng): total = sum of weights; r = rng.next() * total;
  for [value, w] of list in order: if r < w return value; r -= w; return last value
```

Exactly one `rng.next()` is drawn per emitted step, so inserting or removing a step changes
only the directions after it (useful for diffing charts in tests).

6.23.4 D. `DanceJudge`

```text
bind(chart, song, opts):
  if a run exists: dispose()
  r = validate(chart, {mode: chart.source === 'imported' ? 'repair' : 'strict', song})
  if !r.ok: throw E-INP-012 (message "Dance chart data is invalid; regenerating.")
  run.chart = r.chart; run.judgeChart = asJudgeChart(r.chart)
  judge = Rhythm.Judge.bind({strayPenalty: opts.strayPenalty ? 'combo' : 'none'})
  judge.load(run.judgeChart, song, WINDOW_MAP[chart.difficulty])
  judge.setCalibration(opts.calibration)
  preset: 'relaxed' -> judge.setWindows(scale(windowsFor(name), 1.5), 'custom')
          'strict'  -> judge.setWindows(scale(windowsFor(name), 0.75), 'strict')   (see 6.23.9)
  judge.attach(); judge.setActive(transport.state() === 'playing')
  transport.setSpeed(opts.practiceSpeed)              // 1.0 outside practice
  subscribe (owner): transport.state, transport.seek, transport.loop, settings.changed
  life = FAILURE_RULES.lifeBar.start; lifeEnabled = opts.lifeBar; failed = false; passIndex = 1

on transport.state {state, reason}:
  judge.setActive(state === 'playing')               // countin, paused, stopped -> inactive (no strays)
  if state === 'stopped' and reason === 'end': finish('end')
on transport.seek {reason} with reason in ('user', 'section', 'restart'): restart()
on transport.loop: endPass()                           // each loop pass is a fresh scoring pass (6.9.4 C.5)

endPass():
  acc = judge.state().accuracy; passIndex++
  if speedRamp and acc >= 0.90 and speed < 1.0: speed = min(1.0, round2(speed + 0.05)); transport.setSpeed(speed)
  judge.restart(); resetLife()

tick(audioNow):
  if !bound or finished: return []
  out = judge.tick(audioNow); foldLife()
  if judge.state().judged === judge.state().total and
     audioNow >= transport.audioTimeAt(lastEndTick) + windows.good / 1000 + 0.5: finish('end')
  return out

foldLife(): for each new result in judge.results() after lastResultCount:
  if result.judgment === 'miss': missStreak++; choreography?.markMiss(result.noteId) else missStreak = 0
  if lifeEnabled: key = (result.part === 'tail' and result.judgment === 'miss') ? 'holdBreak' : result.judgment
                  life = clamp(life + delta[key], 0, max); lifeMin = min(lifeMin, life)
                  if life <= failAt and !practice(): failed = true; finish('fail')
practice() = speed !== 1.0 or transport.loopEnabled()

finish(endedBy):
  if finished: return summary
  finished = true; judge.setActive(false)
  s = judge.summary({songId, chartId, startedAt, durationSec: playedSeconds})
  s.kind = 'dance'; s.failed = failed; s.lifeMin = lifeEnabled ? lifeMin : null
  s.comparable = s.comparable and !practice()
  emit chart.finished {chartId, kind:'dance', summary: s, endedBy}
  return s

restart(): judge.restart(); resetLife(); finished = false; missStreak = 0; lastResultCount = 0
dispose(): judge.detach(); judge.dispose(); bus.removeOwner(owner); choreography?.dispose(); run = null
```

Rules decided here:
- A jump is a chord note in the Rhythm judge: both directions must be pressed within the
  50 ms chord tolerance (6.9.4 B.8); its head judgment uses the worse of the two deltas.
- A tap step pressed while the same direction is still physically held from an earlier step
  counts only if a new press event occurs (M-07 lifecycle; holding through is not a press).
- Changing difficulty during a song is not offered: the SCR-Dance difficulty selector is
  disabled unless the transport is `stopped`; a change regenerates the chart and calls `bind`
  again (E 7 "difficulty changes after chart generation").
- A paused hold follows 6.9.4 C.4: on resume, a direction no longer held is a release at the
  resume position (E 7 "hold begins before a pause and ends after resume").
- Many consecutive misses (E 7) reset the combo and, with the life bar on, drain life; with the
  life bar off nothing ends the song early. `missStreak >= 8` shows the HUD hint
  "Tip: lower the difficulty or practice this section" once per run (P 5.2 informative failure).
- Practice: `practiceSpeed` 0.5..1.0 in steps of 0.05 (`session.dance.practiceSpeed`, Part 5.11);
  pitch is unchanged because notes are synthesized from MIDI events at the scaled tempo
  (I 6.3 "preserving pitch where supported"; imported audio tracks follow M-14); section
  loop uses `Transport.setLoop` with bounds from `Model.sections(song)`; `speedRamp` raises the speed by 0.05 after a pass with accuracy
  >= 90 percent (I 6.3 "increase speed progressively").

6.23.4 E. `ChoreographyController`

The performer dances the chart (not the player's input), so the avatar always shows the
intended choreography in sync with the music (B 14.3, B 26.6); a missed step plays the same
move at reduced amplitude so the player sees the miss without the avatar inventing motion.

Pose data (`POSES`, degrees, Euler XYZ applied in the joint's parent space; positive X pitches
forward, positive Z rolls the limb outward to the performer's left). Joint names are the M-19
`JOINTS` names `hips`, `spine`, `chest`, `neck`, `head`, `shoulderL`, `upperArmL`, `lowerArmL`,
`handL`, `shoulderR`, `upperArmR`, `lowerArmR`, `handR`, `upperLegL`, `lowerLegL`, `footL`,
`upperLegR`, `lowerLegR`, `footR`; `root` is a translation in meters.

| Pose | root [x, y, z] | Legs | Arms | Torso and head |
|---|---|---|---|---|
| idle | [0, 0, 0] | all 0 | upperArmL/R Z +-8 | 0 |
| left | [-0.12, -0.03, 0] | upperLegL Z 22, lowerLegL X 12, footL Z -10; upperLegR X 6 | upperArmL Z 40, lowerArmL X -20; upperArmR Z -15 | spine Z -6, head Z 4 |
| down | [0, -0.08, -0.04] | foot side (6.23.4 C): upperLeg X 28, lowerLeg X -42, foot X 14; other leg upperLeg X 10, lowerLeg X -16 | upperArmL/R X 20, lowerArmL/R X -35 | chest X 10, head X 8 |
| up | [0, 0.02, 0.10] | foot side: upperLeg X -32, lowerLeg X 14, foot X -8 | upperArmL/R X -70, lowerArmL/R X -15 | chest X -6, head X -10 |
| right | mirror of left (x negated, Z angles negated, L and R swapped) | | | |
| jump | [0, 0.16, 0] at peak, [0, -0.06, 0] at landing | peak: upperLegL/R X -35, lowerLegL/R X 60; landing: upperLegL/R X 25, lowerLegL/R X -40 | upperArmL/R X -120 at peak | chest X -8 |

Foot side for `down` and `up` is computed at construction with the same alternation rule as
6.23.4 C (left -> L, right -> R, down or up -> the foot opposite the previous single step,
starting with L; a jump resets to L), so imported charts animate consistently too.

Timing (audio seconds; `ts = transport.audioTimeAt(step.tick)`, `te` the hold end time):

```text
a = min(ANTICIPATION_MS / 1000, 0.4 * gapToPreviousStepSeconds)   // 120 ms unless steps are dense
r = min(RECOVERY_MS / 1000, 0.6 * gapToNextStepSeconds)
weight(t) for a tap:  t in [ts - a, ts]      -> smoothstep(ts - a, ts, t)
                      t in (ts, ts + r]      -> 1 - smoothstep(ts, ts + r, t)
                      else 0
weight(t) for a hold: rises as a tap; stays 1 on (ts, te]; falls over (te, te + r]
jump: root.y follows peak pose on [ts - a, ts - a/3], landing pose on [ts, ts + r]
amplitude = styleScale (calm 0.7, normal 1.0, energetic 1.3) * (missed ? 0.5 : 1)
            * (reducedMotion ? 0.3 : 1)   // reduced motion also sets root.y offsets to 0
pose(t) = idle; for the at most 2 steps whose weight(t) > 0, in step order:
            pose = blend(pose, POSES[kind] * amplitude, weight)   // later step applied last
during a hold, bars with steps add a hip bob root.y = -0.015 * (1 - cos(2*pi*beatPhase)) / 2
```

`update(tick, audioNow, dt)` finds the candidate steps by binary search on precomputed step
start times (rebuilt on `transport.speed` and `transport.seek`), computes `poseAt(audioNow)`
and writes it to the rig through `rig.setPose(poseSpec)`; arm targets use `rig.ikArm` only
for the `up` pose (hands above the head). The pose is a pure function of `audioNow`, the chart
and the miss set, so frame drops never desynchronize it (S-03, P 7.2). With no step within
`[t - r, t + a]` and no active hold, the pose is exactly `idle` (S-17: no invented activity).

Failure isolation: `update` runs inside `try`; the first exception disables the controller
(`enabled() === false`), returns the rig to `idle` once, logs `W-DANCE-CHOREO-DISABLED`, and
the HUD shows "Dancer animation unavailable" for 3 s. Scoring and input continue because the
controller has no reference to the judge. Without a rig (Abstract tier or no performer slot)
SCR-Dance passes `choreography: null` and the Flat2D view draws a silhouette from `poseAt`.

6.23.4 F. HUD data (`DanceJudge.hud()`)

```js
DanceHud {
  kind: 'dance',
  score: int, combo: int, maxCombo: int, accuracy: number /* 0..1 */,
  judgment: { text: 'Perfect'|'Great'|'Good'|'Miss'|'Hold break'|null, ageMs: number },
  progress: number /* 0..1: transport position / lastEndTick */,
  steps: { judged: int, total: int },          // "Steps 120 / 340"
  life: number|null /* 0..100, null when disabled */, lifeWarning: boolean /* life < 25 */,
  receptors: [ { dir: 0..3, glyph: 'L'|'D'|'U'|'R', held: boolean, holdActive: boolean } x4 ],
  next: [ { dirs: [int], isHold: boolean, inMs: int } ],   // up to 8 upcoming steps
  speed: number, passIndex: int, practice: boolean, section: string|null,
  missStreak: int, layout: 'arrows'|'pads'
}
```

The instrument HUD shows lanes, instrument name and chord markers; the dance HUD shows the
receptor row with direction glyphs (never color only, B 22), the life bar when enabled, step
counts, practice speed and pass number. `judgment.text` for a tail miss is "Hold break".

6.23.4 G. Import and export

```text
exportChart(chart, song):
  doc = {format:'flm-dance', version:1,
         songRef:{songId: song.id, title: song.title, durationTicks: song.durationTicks,
                  bpmAtStart: round(60e6 / song.tempoMap.entries[0].usPerQuarter)},
         chart: {...chart, source:'imported'}}       // field order of Part 5.5 danceChart
  text = JSON.stringify(doc, null, 1); fileName = sanitize(song.title) + '-' + chart.difficulty + '.flmdance.json'

importChart(text, song):
  if text.length * 2 > LIMITS.maxFileBytes: E-IMP-017 (detail 'too large (limit 2 MB)')
  doc = JSON.parse(text) catch -> E-IMP-017
  depth(doc) > 8 -> E-IMP-017
  doc.format !== 'flm-dance' -> E-IMP-017
  doc.version > 1 -> E-IMP-012 (Part 5.17 text)
  m = migrate(doc) (version < 1 none exist) ; if !m.ok -> E-IMP-017
  pre-pass on doc.chart.steps (E 7 "unsupported step type"):
    a step with a field `type` whose value is not 'tap' or 'hold' (for example 'mine', 'roll')
      is dropped with DANCE-UNSUPPORTED-STEP (warn); 'tap' and 'hold' set isHold and the field is removed
    directions outside 0..3 are removed (DANCE-DUP-DIRECTION); unknown step fields are removed (DANCE-SCHEMA warn)
  chart.source = 'imported'; chart.id = uid('dance') when missing or invalid
  r = validate(chart, {mode:'repair', song}); if !r.ok -> E-IMP-017 with r.issues
  notice = songRef.songId !== song.id ? "This chart was made for '" + songRef.title +
           "'; steps will be aligned to the current song's ticks." : null
  return {ok:true, chart: r.chart, warnings: r.issues, notice}
```

Error texts:

| Code | Message |
|---|---|
| E-IMP-012 | "This dance chart file needs a newer version of Finger Lickin Music." (Part 5.17) |
| E-IMP-017 | "This dance chart file is invalid: {detail}" (detail: not a dance chart file, the first validation error message, or "too large (limit 2 MB)") |

Imported charts are aligned by ticks to the current song (Part 5.14.2); there is no separate
offset field because the shared tick timeline defines alignment (E 7 "chart and audio have
different starting offsets").

#### 6.23.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| song without notes or bars | `generate` precheck | previous chart, song | choose another song | none | SCR-Dance empty state "This song has no notes to dance to." (E-IMP-010) | Dance unavailable for that song | menu stays | UT-23-14 |
| generator output fails strict validation (defect) | step 9 of 6.23.4 B | song untouched | no | none | toast via ErrorReporter E-IMP-010 returnToMenu | none | leave to menu | UT-23-02 |
| imported chart contradictory (E 7) | `validate` repair | current chart and project | user edits file | none (source file unchanged) | SCR-Dance warning list with counts | chart used after repair | n/a | UT-23-03, UT-23-04 |
| imported file invalid or newer | `importChart` | current chart | other file | none | dialog with E-IMP-012 or E-IMP-017 text | n/a | previous chart remains selected | UT-23-29 |
| chart and song mismatch | V11 | chart | n/a | none | notice text of 6.23.4 G | aligned by ticks | n/a | UT-23-29 |
| input while paused or in count-in | `setActive(false)` | score | n/a | none | none | inputs ignored | resume | UT-23-22 |
| hold across pause (E 7) | Rhythm C.4 | hold state | n/a | none | HUD hold indicator | n/a | resume | UT-23-22 |
| touch still active during interruption (E 7) | M-07 `releaseAll('system')` -> release events | head judgments | n/a | none | "Hold break" if held through | n/a | resume | UT-23-22 |
| choreography error or missing rig (E 7) | `try` in `update`, `rig === null` | judge, transport | no (until next bind) | none | HUD note "Dancer animation unavailable" | scoring without avatar motion | next bind | UT-23-27 |
| life bar empties | `foldLife` | results so far | restart | none | SCR-Results "Life bar emptied at bar {n}" | n/a | results screen | UT-23-23 |
| tempo change during a dance (E 7) | none needed (ticks plus TempoMap) | all | n/a | none | none | n/a | n/a | UT-23-19 |
| `chart.finished` listener throws | Emitter isolation | run marked finished | n/a | none | ErrorReporter | n/a | n/a | UT-23-24 |

#### 6.23.6 Limits and performance notes

- `generate`: O(slots + notes) with one binary search per bass note; a 10-minute 4/4 song at
  180 BPM has ~3,600 slots and < 2,500 steps; target <= 30 ms on the desktop reference device
  and <= 80 ms on mobile (synchronous; no yielding needed). Memory < 1 MB transient.
- `validate`: O(steps log steps) for the sort, O(steps) otherwise; 20,000 steps <= 15 ms.
- `ChoreographyController.update`: O(log steps) per frame plus a blend of 19 joints; <= 0.1 ms.
- `DanceJudge.tick`: as Rhythm `tick` plus O(new results) for life.
- `.flmdance.json`: about 70 bytes per step; 20,000 steps ~ 1.4 MB, under the 2 MB cap.
- Polyphony and audio are unaffected by dance mode (the arrangement plays unmodified through
  the Scheduler; no target track is muted).

#### 6.23.7 Spec coverage

B 7.6 (all 12 items: four directional inputs, keyboard and touch, controller through M-07,
charts on musical time, three difficulties, timing judgments, combos and score, miss and
accuracy, progress, optional choreography, configurable layouts, custom charts), B 14.1 (chart
model fields), B 14.2 (steps, simultaneous steps, holds, judgments, combos, score, progress,
failure rules configurable), B 14.3 (choreography synchronized and explicit), B 14.4 (same
low-level input, independent mapping and scoring), B 15.6 (dance chart export), B 25.1 (dance
chart parsing), B 25.2 (dance chart to scoring, IT in Part 12), B 26.6 (all four), E 7 (all 10
cases), E 11, I 6.3 (loop, slow, progressive speed for dance), I 7 (all 10 items), I 16.4
(dance chart versioning), P 5.2 (pause, restart, failure feedback), P 5.3 (measurable
difficulty), P 12 (all 12 items), P 15 (non-color lane identification, reduced motion).

#### 6.23.8 Unit tests (group `dance`, file `src/91-test-dance.js`)

Fixtures: `fx.song44` (4/4, 120 BPM, 8 bars, one piano track of quarter and eighth notes with an
onset on every "and of 4", so no note reaches the 2-beat hold length; no drums, no markers), `fx.songDrums` (same plus a drum track: kick on beats 1 and 3, snare on
2 and 4, crash at bar 0 and bar 4, hats on every half-beat at velocity 50), `fx.songBass` (4/4,
a bass track with a 4-beat note at bar 2 and a 1-beat note at bar 3), `fx.songTempo` (bars 0-3
at 4/4 120 BPM, bars 4-7 at 3/4 90 BPM), `fx.songFast` (4/4, 220 BPM, 16 bars, onsets on all
half-beats), `fx.songSilent` (bars 2-3 silent). A judge time map at 120 BPM (`tick t -> t/1920
s`) as in 6.9.8.

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-23-01 | direction mapping | `controlToDirection` for dance0..3, 'lane0', 'x' | 0, 1, 2, 3, -1, -1; `directionToControl(4)` throws E-INP-011 |
| UT-23-02 | generated charts pass strict validation | generate all 3 difficulties for every fixture | `validate(c, {mode:'strict', song}).ok` for all; `issues` empty |
| UT-23-03 | same-tick steps: strict rejects, repair merges | two steps at tick 960 with directions [0] and [3] on `hard` | strict: `DANCE-SAME-TICK` error; repair: one step `[0,3]`, one warn |
| UT-23-04 | overlapping holds in one direction | hold dir 1 at 0 for 3840, tap dir 1 at 1920 | strict error `DANCE-HOLD-OVERLAP`; repair: hold durTicks 1800 -> below 1920 -> tap; warn issued |
| UT-23-05 | max simultaneous by difficulty | `easy` step with [0,3]; `hard` step with [0,1,2] (pre-pass) | easy strict error `DANCE-TOO-MANY`; repair keeps [0]; hard repair keeps [0,1] |
| UT-23-06 | hold counts toward simultaneous | `normal`: hold dir 0 at 0 (3840), jump [1,2] at 960 | `DANCE-TOO-MANY`; repair keeps [1] |
| UT-23-07 | min spacing by difficulty | generated `easy` chart; imported `easy` chart with steps 480 apart | generated consecutive gaps >= 960; imported repair `ok:true` with `DANCE-DENSE` warn and steps kept |
| UT-23-08 | hold minimum and tap duration | hold of 1000 ticks; tap with durTicks 240 | repair: first becomes tap, second durTicks 1; strict errors `DANCE-HOLD-SHORT`, `DANCE-TAP-DURATION` |
| UT-23-09 | determinism | generate `hard` on `fx.songDrums` twice, and once after `Core.Prng` instances elsewhere advanced | `JSON.stringify` equal in all three; `settingsHash` equals the 5.9.3 formula |
| UT-23-10 | easy uses beats 1 and 3 | `fx.song44` easy | 16 steps at ticks `bar*3840 + {0, 1920}`; no jumps |
| UT-23-11 | difficulty ordering | every fixture with >= 8 active bars | steps per minute easy < normal < hard; jumps easy 0 |
| UT-23-12 | hard jumps at section starts and even bars | `fx.song44` hard | jumps exactly at bars 0, 2, 4, 6 downbeats; no two consecutive jumps |
| UT-23-13 | drum strong hits drive selection | `fx.songDrums` normal | every kept non-downbeat on-beat has a drum hit; half-beats kept only where drumScore >= 2 (none here, hats are velocity 50) |
| UT-23-14 | silent bars produce no steps; empty song throws | `fx.songSilent` hard; empty song | no step tick in bars 2-3; empty song throws E-IMP-010 |
| UT-23-15 | no three identical in a row | `fx.songFast` hard, 200 seeds by varying song id | for every chart, no index i with three equal single-direction steps i, i+1, i+2 |
| UT-23-16 | alternate feet | same charts | consecutive single steps never both left-only (0) or both right-only (3); after a jump the next single step is in {0,1,2} |
| UT-23-17 | holds on sustained bass | `fx.songBass` easy and normal | one hold at bar 2 with durTicks >= 1920; 1-beat note produces no hold; easy has no step inside the hold or within 960 ticks after |
| UT-23-18 | minimum gap in ms at fast tempo | `fx.songFast` hard | every gap >= 150 ms by `ticksToSeconds`; half-beats at 220 BPM (136 ms) are filtered |
| UT-23-19 | meter and tempo change | `fx.songTempo` easy | bars 4-7 have steps at beats 1 and 3 of 3/4 (ticks +0 and +1920 from bar start); step times follow the 90 BPM segment |
| UT-23-20 | window map | bind `normal` chart; press `dance2` exactly at a dir-2 step and at +70 ms and +71 ms | perfect, great (70 = intermediate great edge), good; `WINDOW_MAP` frozen |
| UT-23-21 | jump is a chord | jump [0,3]; press dance0 at -10 ms, dance3 at +30 ms | one head result, `deltaMs` 30; pressing dance3 at +60 ms instead -> stray and later miss |
| UT-23-22 | pause and interruption during a hold | hold dir 1; press; transport paused; `releaseAll` while paused; resume | tail judged hold break at the resume position (6.9.4 C.4); inputs while paused return null |
| UT-23-23 | life bar rules | lifeBar off: 30 misses; on: 7 misses (50 - 56 < 0) at speed 1; on with speed 0.8 | off: no fail; on: `finish('fail')` once with `endedBy:'fail'`, `failed:true`; practice: life reaches 0, no fail |
| UT-23-24 | finish detection and once-only | all steps judged; tick past last end + good + 0.5 s; tick again | `chart.finished` emitted exactly once with `kind:'dance'`; `restart()` re-arms it |
| UT-23-25 | loop passes and speed ramp | loop over bars 0-3, speedRamp on, speed 0.8, pass with all perfects | on `transport.loop`: judge restarted, `passIndex` 2, `Transport.setSpeed(0.85)` called; pass with accuracy 0.5 keeps the speed |
| UT-23-26 | choreography is a function of audio time | `poseAt(t)` for t in a grid, computed after 10 and after 1,000 `update` calls | identical poses; no step within range -> exactly `POSES.idle`; peak weight 1 at `ts` |
| UT-23-27 | choreography failure isolation | fake rig whose `setPose` throws | `enabled()` false after first update; subsequent `onInput` still judged; `W-DANCE-CHOREO-DISABLED` logged once |
| UT-23-28 | export/import round trip | export generated `hard` chart, import into the same song | chart steps deep-equal except `source:'imported'` and `id`; no warnings; `notice` null |
| UT-23-29 | import errors and notice | invalid JSON; `format:'x'`; `version:2`; 3 MB text; other song | E-IMP-017, E-IMP-017, E-IMP-012, E-IMP-017; other song -> ok with the exact notice text |
| UT-23-30 | unsupported step type | imported steps with `type:'mine'` and `type:'hold'` | mine dropped with `DANCE-UNSUPPORTED-STEP`; hold kept with `isHold:true` |
| UT-23-31 | asJudgeChart | any chart | notes deep-equal steps mapped to `{id, tick, durTicks, lanes: directions, sourceEventIds:[], pitches:[], isHold}`; difficulty mapped via `WINDOW_MAP` |
| UT-23-32 | generator leaves the song untouched | deep-frozen `fx.songDrums` | `generate` does not throw; `fnv1a32(JSON.stringify(song))` unchanged |
| UT-23-33 | HUD model | bound run with lifeBar on, 3 judged steps | `hud()` has `kind:'dance'`, receptors with glyphs L D U R, `steps.total` equals chart length, `life` a number, `next.length <= 8` |
| UT-23-34 | miss streak hint | bound run, 8 consecutive misses, then a ninth miss | S-PLAY-07 hint emitted exactly once after the 8th miss; combo is 0; no second hint on the 9th miss |

#### 6.23.9 Implementation notes and browser quirks

- Topic ownership (Part 4.4): `chart.finished` is emitted by M-09 `Judge.finish` for instrument
  runs and by M-23 `DanceJudge.finish` for dance runs; M-28 emits nothing.
- The `strict` judgment preset (x0.75) is narrower than standard; 6.9.6 refuses only custom
  windows narrower than the strict table and accepts the strict preset table, in instrument
  mode and in DanceJudge alike.
- `Prng` must be instantiated per `generate` call; never share a generator with other code
  (UT-23-09 guards this).
- Keep `MAX_SIMULTANEOUS`, `WINDOW_MAP`, `POSES`, `LAYOUTS` and `FAILURE_RULES` deep-frozen
  (S-07).
- Gamepad dance mapping (face buttons and d-pad) is owned by M-07 (6.7.1 table); a dance mat
  that presents itself as a gamepad works through the d-pad buttons 12-15.
- Touch: the `pads` layout places the four pads in a diamond (up top, left and right middle,
  down bottom) in landscape and a 2 x 2 grid (left, down / up, right) in portrait; pad index
  equals direction id in both, so M-07 needs no layout knowledge.
- Reduced motion (`video.reducedMotion`) reaches the controller through `setReducedMotion`;
  the highway scroll itself is not reduced (it carries the timing information).

### 6.24 M-24 Net (`src/24-net.js`, `FLM.Net`)

#### 6.24.1 Responsibilities and non-goals

Responsibilities:
- Multiplayer client for 2-4 players (ADR-07): host-authoritative star topology; the host's
  browser is the session authority and its audio clock is the shared clock.
- Two transports behind one `Link` interface: WebRTC DataChannel peer-to-peer with manual
  copy-paste signaling (standalone and online editions) and the optional WebSocket relay
  `server/relay.mjs` (online edition only, Part 3.7).
- Protocol version 1 (Part 5.16): envelope, per-type payload validation, size caps, sender and
  state rules, sequence dedupe, rate limits, invalid-message accounting.
- Session lifecycle: create room -> invite code -> answer code -> connected -> lobby ->
  ready -> countdown -> playing -> results -> lobby; reconnection; host and guest departure;
  expiry; cleanup with zero leaks (S-06).
- Clock synchronization (ping/pong, median of 8), scheduled start and resume on shared time,
  shared position, pause and resume with state sequence numbers (B 17.2, E 8.2, I 10.2).
- Host-side authoritative judging of guest inputs with `FLM.Rhythm` against the identical
  chart (`settingsHash` must match), 10 Hz score updates, results (B 17.4, E 8.3).
- Synchronization diagnostics (latency, offset, jitter, missed updates) for the lobby and
  SCR-Diagnostics; the privacy statement text (B 23.2).
- The future Collaborative Studio rules (6.24.4 L), marked Deferred.

Non-goals:
- No UI (SCR-Multiplayer and its dialogs are M-27); no chart generation (M-27 prepares charts
  with M-08 or M-23 and passes them in with `bindGame`); no audio of other players' notes (each
  client plays the source arrangement locally; coop shows contributions through scores and
  performer highlights).
- No host migration: when the host leaves, the session ends with results (ADR-07).
- No late join into a running song; no spectators; no voice or text chat; no matchmaking or
  room discovery (codes are exchanged by the players out of band).
- Collaborative Studio is Deferred (P2): its message types are reserved and rejected in v1.
- No accounts, no credentials, no telemetry (B 23.4, ADR-15).

#### 6.24.2 Public API

```js
FLM.Core.define('Net', function (FLM) {
  return {
    PROTOCOL_VERSION: 1,
    MESSAGE_TYPES: ['hello', 'roomState', 'ready', 'selectChart', 'start', 'pause', 'resume',
                    'input', 'scoreUpdate', 'avatar', 'ping', 'pong', 'leave', 'error'],
    RESERVED_TYPES: ['studioOp', 'studioAck', 'studioReject', 'studioSnapshot'],   // Deferred (6.24.4 L)
    STUN_URL: 'stun:stun.l.google.com:19302',
    ROOM_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',     // 32 symbols, same as Part 3.7.4
    LIMITS: { /* 6.24.6 table, frozen */ },
    ERRORS: { /* code -> user message, 6.24.5 table, frozen */ },
    PRIVACY_TEXT: '...',                // exact text in 6.24.4 K

    // ---- session facade (one live session per page; methods delegate to it) ----
    /** Host. opts {mode:'sync'|'coop', transport:'p2p'|'relay', displayName, avatar:CharacterConfig}.
     *  p2p: resolves at once with a room code; relay: after {"op":"created"}. */
    createRoom(opts) /* -> Promise<{ok:boolean, roomCode:string|null, error:NetError|null}> */,
    /** Host, p2p. One pending invite at a time. Gathers ICE (3 s cap) and returns the code. */
    createInvite(opts /* ?{slot:number, forPeerId:string (reconnect invite)} */)
      /* -> Promise<{ok, code:string|null, slot:number, expiresAt:number /* Core.now() ms */, warning:string|null, error}> */,
    cancelInvite() /* -> void */,
    /** Host, p2p. Applies the guest's answer; resolves when the DataChannel opened and hello completed. */
    acceptAnswer(code /* string */) /* -> Promise<{ok, peerId:string|null, error}> */,
    /** Guest, p2p. Resolves with the answer code to send back to the host; the session then
     *  waits up to 120 s for the channel to open. */
    joinWithInvite(code /* string */, opts /* {displayName, avatar} */)
      /* -> Promise<{ok, answerCode:string|null, error}> */,
    /** Guest, relay. roomCode is 6 symbols of ROOM_ALPHABET (case-insensitive input). */
    joinRelay(roomCode /* string */, opts /* {displayName, avatar} */) /* -> Promise<{ok, error}> */,
    /** Host, relay: admit or decline a pending joiner (relay rooms require host approval). */
    admit(peerId /* string */, accept /* boolean */) /* -> void */,
    kick(peerId /* string */) /* -> void (host; sends leave reason 'error' then closes that link) */,

    // ---- lobby and game ----
    /** Host, lobby only. Broadcasts selectChart; resets every ready flag. */
    selectChart(sel /* {songId, difficulty, profile:string|null, trackId:string|null, mode} */) /* -> void */,
    /** Both. Host: applies locally. Guest: sends ready to the host. */
    setReady(ready /* boolean */, info /* {settingsHash, judgeOffsetMs, trackId:string|null} */) /* -> void */,
    /** Host. Supplies the song, transport and charts the session judges against; called by the
     *  SCR-Multiplayer controller after it generated the charts for selectChart. */
    bindGame(game /* GameBinding */) /* -> void */,
    // GameBinding { song:Song, transport:Transport, kind:'instrument'|'dance',
    //   localChart:Chart /* judge shape (dance via Dance.asJudgeChart) */,
    //   localState:() => ScoreState /* the host's own judge (M-28 bound) */,
    //   chartFor:(peerId, trackId) => Chart /* host only: chart for a guest's track */,
    //   windowsFor:(peerId) => 'beginner'|'intermediate'|'advanced'|'expert',
    //   countInBars:1|2 }
    unbindGame() /* -> void */,
    /** Host. Checks start conditions (6.24.4 F); returns reasons when not possible. */
    canStart() /* -> {ok:boolean, reasons:string[], warnings:string[]} */,
    start() /* -> {ok:boolean, error:NetError|null} */,
    /** Both. Host pauses everybody; a guest sends a request the host may honor. */
    requestPause() /* -> void */,
    resume() /* -> {ok, error} (host only) */,
    stopGame() /* -> void (host: back to lobby for everyone) */,
    backToLobby() /* -> void (host, from results) */,
    setAvatar(cfg /* CharacterConfig */) /* -> {ok, error} (lobby only; validated, <= 4 KB) */,
    /** Ends the session: leave to every peer (200 ms best effort), closes every link and
     *  RTCPeerConnection or the relay socket, clears every timer and listener. */
    close(reason /* 'user'|'error'|'timeout'|'mode' */) /* -> Promise<void> */,

    // ---- state ----
    state() /* -> net.state value (Part 4.4) */,
    role() /* -> 'host'|'guest'|null */,
    roomCode() /* -> string|null */,
    transportKind() /* -> 'p2p'|'relay'|null */,
    selfId() /* -> peerId|null */,
    peers() /* -> PeerView[] (includes self) */,
    // PeerView { peerId, displayName, avatar, slot:0..3, ready, trackId, connected, isHost,
    //            latencyMs:number|null, offsetMs:number|null, quality:'good'|'fair'|'poor'|null, left:boolean }
    room() /* -> RoomState copy (5.16 roomState payload) or null */,
    connectionCount() /* -> number of open links (RTCPeerConnection or relay socket) */,
    pending() /* -> {invite:{slot, expiresAt}|null, admits:PeerView[]} */,
    /** Last authoritative scores; final once state is 'results' or 'ended'. */
    results() /* -> NetResults|null (6.24.4 H) */,
    resyncTick() /* -> number|null (guest: tick of the last resynchronization; HUD suppresses earlier flashes) */,

    // ---- configuration ----
    setStun(on /* boolean */) /* -> void (applies to the next invite or join) */, stunEnabled() /* -> boolean */,
    setRelayUrl(url /* string */) /* -> {ok, error} (ws: or wss:, <= 200 chars) */, relayUrl() /* -> string */,
    /** true only in the Online edition (FLM.BUILD.online non-empty) with a valid relay URL. */
    relayAvailable() /* -> boolean */,
    /** true when RTCPeerConnection exists (Caps). */
    p2pAvailable() /* -> boolean */,

    // ---- protocol helpers (pure) ----
    encodeCode(kind /* 'invite'|'answer' */, obj /* object */) /* -> string */,
    decodeCode(text /* string */) /* -> {ok:true, kind, data} | {ok:false, error:NetError} */,
    /** Envelope plus payload validation (6.24.4 C). ctx {role, expectedFrom, lastSeq, hostId}. */
    validateMessage(msgOrText /* object|string */, ctx /* object */)
      /* -> {ok:true, msg:NetMessage} | {ok:false, reason:string, code:string|null} */,
    validate: /* same function as validateMessage (name used by Part 5.16) */ null,
    makeRoomCode(rand /* ?(n)=>Uint8Array */) /* -> string 6 symbols */,
    songHash(song /* Song */) /* -> 8 hex (6.24.4 F) */,
    RateLimiter: class {
      constructor(perSecond /* 60 */, reserve /* 10, kept for non-input types */);
      allow(nowMs /* number */, isInput /* boolean */) /* -> boolean */;
      count(nowMs) /* -> number in the last 1,000 ms */;
      dropped() /* -> number */;
    },

    /** Clock of the live session (guest: offset to the host; host: identity). */
    Clock: {
      offsetMs() /* -> number (host 0) */,
      sharedNow() /* -> seconds: local audio now + offset */,
      toLocalAudio(tShared) /* -> seconds */,
      toShared(tLocal) /* -> seconds */,
      frozenOffsetMs() /* -> number|null (offset frozen at the last start, resume or resync) */,
      samples() /* -> [{offsetMs, rttMs}] last 8 */,
      quality() /* -> {quality, errorMs, jitterMs, rttMs, samples} */,
      /** Pure math used by the session and tests. */
      offsetFrom(t0, t1, t2, t3) /* -> {offsetS, rttS} */,
      summarize(samples /* [{offsetS, rttS}] */) /* -> {offsetMs, rttMs, jitterMs, errorMs, quality} */
    },

    diagnostics() /* -> NetDiagnostics (6.24.4 J) */,

    /** Independent session object with injected dependencies (tests and the Diagnostics
     *  "network self-check", which runs a host and a guest inside one page over a loopback pair).
     *  deps {clock:{now():seconds}, linkFactory, rtc:RTCPeerConnection constructor or fake,
     *        WebSocketCtor, timers, bus, appVersion}. Same methods as the facade. */
    createSession(deps /* object */) /* -> Session */,
    /** Two connected in-memory Links (delivery on the next microtask, in order). */
    createLoopbackPair(opts /* ?{latencyMs:number, dropEvery:number} */) /* -> [Link, Link] */
  };
});
```

`NetError { code:'E-NET-0nn', message:string /* ERRORS text, placeholders filled */, detail:string|null }`.

Events emitted (payloads exactly as Part 4.4): `net.state` on every session state change;
`net.peer` on join, leave, ready, avatar, slot or latency change; `net.message` once per
received frame (valid or not; `msg` null when invalid) for diagnostics counters; `net.sync`
after every completed sync sample once at least one sample exists.

Events consumed (subscribed with the session owner token): `input.event` (guest: forward
gameplay controls while playing), `transport.state` (countdown -> playing, end detection on
the host, interruption-driven pause routing), `chart.finished` (host: final scores and
results), `character.changed` (lobby: avatar update of self), `audio.state` (a suspended guest
context sends a pause request), `judge.result` and `score.update` (host: mark the 10 Hz score
packet dirty).

#### 6.24.3 Internal state

```js
Session {
  role: 'host'|'guest'|null, state: string /* net.state */, transport: 'p2p'|'relay'|null,
  selfId: string /* 'p' + 9 base36 chars */, roomCode: string|null, hostId: string|null,
  mode: 'sync'|'coop', stateSeq: int /* host: last issued; guest: last applied */,
  sendSeq: int /* envelope seq for every message this peer sends, starts at 1 */,
  players: Map<peerId, Player>,          // includes self; ordered by slot
  invite: {pc, dc, slot, forPeerId, expiresAt, timer}|null,          // host p2p, at most one
  admits: Map<peerId, {link, hello}>,    // host relay, waiting for admit()
  links: Map<peerId, Link>,              // host: one per guest; guest: one (to host)
  relay: {ws, url, memberId, memberToPeer: Map<int, peerId>, backoffIndex}|null,
  clock: {samples: [{offsetS, rttS}] /* last 8 */, offsetS: number, frozenOffsetS: number|null,
          pendingPings: Map<t0, true>, lastSampleAt: number},
  game: GameBinding|null, guestJudges: Map<peerId, RhythmJudge>,   // host only
  scoreTimer: id|null, scoreDirty: boolean, lastScoreUpdate: ScoreUpdatePayload|null,
  startAttempts: int, resync: {tick, at}|null, results: NetResults|null,
  counters: {in:int, out:int, bytesIn:int, bytesOut:int, invalid:int, dropped:int, ignored:int},
  owner: Symbol('net'),                  // timers, bus and DOM listeners
  closed: boolean
}
Player { peerId, displayName, avatar, slot, isHost, ready:boolean, trackId:string|null,
         settingsHash:string|null, judgeOffsetMs:int, connected:boolean, left:boolean,
         resumeToken:string /* host-assigned, 16 base36 chars */, reconnects:int,
         disconnectedAt:number|null, lastSeqIn:int, lastISeq:int, lastInputT:number,
         invalidTimes:number[], droppedTimes:number[], limiter:RateLimiter,
         lastPauseRequestAt:number, sync:{samples, offsetS, rttS} /* host-side view */,
         lastMessageAt:number, missedUpdates:int }
Link { kind:'p2p'|'relay'|'loopback', remoteId:string|null, open:boolean,
       send(text):boolean, close(reason):void, bufferedAmount():number,
       onmessage:(text)=>void, onclose:(reason)=>void, onopen:()=>void }
```

Invariants:
1. Every received frame passes 6.24.4 C before any handler sees it; handlers never parse
   JSON themselves.
2. `stateSeq` on a guest never decreases; a message carrying a `stateSeq` not greater than
   the last applied one is ignored (counted in `ignored`).
3. Envelope `seq` per sender is strictly increasing; the receiver keeps `lastSeqIn` per link
   and drops anything else (duplicates and reordering, E 8.2).
4. The host is the only producer of scores, room state, start, resume and results; a guest
   never computes another player's score (B 17.4).
5. All timers, RAF-free intervals and DOM or RTC listeners are created through `Core.timers`
   and `Core.dom` with `Session.owner`; `close()` cancels them by owner and `connectionCount()`
   returns 0 afterwards (S-06).
6. Nobody schedules audio from message arrival time: start, resume and resync carry shared
   times at least 0.5 s in the future and every client anchors its own `Transport` to the
   converted local audio time (B 17.2, E 8.2, I 10.2).

#### 6.24.4 Algorithms

6.24.4 A. Message table (protocol version 1)

Envelope (Part 5.1.8): `{v:1, type, seq, from, tSend, payload}`; `tSend` is the sender's local
audio time (diagnostics only; never used for timing decisions). "Rx states" are the receiver
states in which the type is handled; outside them it is dropped and counted as `ignored` (not
invalid). Rates are per sender; the limiter (6.24.4 D) enforces the global 60 per second.

| type | Sender -> receiver | Payload (Part 5.16) | Rx states | Validation beyond schema | Cap | Rate |
|---|---|---|---|---|---|---|
| hello | guest -> host first; host -> guest reply | `protocol, appVersion, peerId, displayName, avatar, mobile, resumeToken` | connecting, reconnecting | protocol 1 else E-NET-003; major of `appVersion` equal else E-NET-004; avatar `Character.validate` and serialized <= 4,096 B; host: room not full (E-NET-014), not playing unless `resumeToken` matches a disconnected player (E-NET-019), peerId not already connected (E-NET-022) | 8 KB | once per link |
| roomState | host -> all | `roomCode, hostId, mode, state, stateSeq, players[<=4], song, chart, position` | guest: any connected state | `stateSeq` > last applied; `hostId` equals the bound host; the receiving guest appears in `players` | 32 KB | on change (coalesced 200 ms) and every 2 s |
| ready | guest -> host | `ready, settingsHash, judgmentPreset, judgeOffsetMs, trackId` | host: lobby | `judgmentPreset === 'standard'` else E-NET-006; `settingsHash` equals `chartFor(peer, trackId).settingsHash` else E-NET-005; coop: `trackId` exists in the song and no other player holds it else E-NET-024 | 512 B | <= 4 per s |
| selectChart | host -> all | `songId, difficulty, profile, trackId, mode` | guest: lobby | song resolvable locally (6.24.4 F) else reply E-NET-007; difficulty in the instrument or dance enum (dance when `easy`, `normal`, `hard`; then `profile` and `trackId` are null) | 512 B | <= 2 per s |
| start | host -> one guest (unicast, each with its own hash) | `stateSeq, tStartShared, countInBars, songId, settingsHash` | guest: lobby, countdown | `songId` and `settingsHash` equal the guest's bound chart else E-NET-005; lead >= 1.0 s else E-NET-008 | 256 B | <= 1 per countdown attempt |
| pause | guest -> host (request); host -> all (authoritative) | `stateSeq, tick, tShared` | host: playing; guest: playing | host honors at most one request per guest per 10 s; guest applies only `stateSeq` > last applied | 128 B | request <= 1 per 10 s |
| resume | host -> all | `stateSeq, tick, tStartShared` | guest: playing (room paused) | `stateSeq` > last applied; lead >= 0.5 s else the guest resumes immediately at the converted time and logs `W-NET-LATE-RESUME` | 128 B | per resume |
| input | guest -> host | `control, type, tShared, iSeq` | host: playing and room not paused | control in `lane0..3` (instrument) or `dance0..3` (dance) matching the bound kind; `iSeq` > last; `tShared` within [hostNow - 2 s, hostNow + 2 s] and `tShared >= lastInputT - 0.005` else dropped (late or manipulated, E 8.2, E 8.3) | 128 B | <= 50 per s (reserve) |
| scoreUpdate | host -> all | `tick, players[{peerId, score, combo, maxCombo, accuracyPermille, judged, miss, lastJudgment}]` | guest: playing, results | sender must be the host | 1 KB | 10 Hz while playing; once at results |
| avatar | guest -> host; host reflects through `roomState` | `avatar` | host: lobby | `Character.validate`; <= 4,096 B | 4 KB | <= 2 per s |
| ping | any -> any | `t0` | any connected state | finite | 64 B | burst of 8 at 100 ms spacing, then 1 per 10 s |
| pong | reply to ping | `t0, t1, t2` | any connected state | `t1 <= t2`; `t0` matches an outstanding ping (else dropped) | 64 B | one per ping |
| leave | any -> all | `reason` | any | none | 128 B | once |
| error | any -> any | `code, message, fatal` | any | code matches `^E-NET-[0-9]{3}$`; message shown only through `textContent` | 512 B | <= 5 per 10 s displayed |

The host does not send `avatar` messages: avatar changes are reflected in the next `roomState`
(this narrows Part 5.16, which allows "host -> all"; the guest-side handler still accepts an
`avatar` from the host in the lobby and treats it like a roomState player update).

6.24.4 B. Session lifecycle

```text
 host:  idle -> creating -> lobby -> (inviting -> awaitingAnswer -> connecting -> lobby)* ->
        countdown -> playing -> results -> lobby ...                       -> ended
 guest: idle -> connecting (p2p: invite decoded, answer shown; relay: socket joining) ->
        connected (hello done) -> lobby -> countdown -> playing -> results -> lobby ...
        any connected state -> reconnecting -> (previous state) | ended
 any:   error (failed attempt; close() -> idle)
```

| From | Event | To | Action |
|---|---|---|---|
| idle | `createRoom` p2p | lobby (via creating) | `selfId`, `roomCode = makeRoomCode()`, host Player slot 0, `hostId = selfId` |
| idle | `createRoom` relay | creating -> lobby | open socket (10 s timeout -> error E-NET-012), send `{"op":"create"}`, on `created` take `code` as `roomCode` |
| lobby (host) | `createInvite` | inviting -> awaitingAnswer | 6.24.4 E; invite timer 10 min -> `cancelInvite`, state lobby, invite invalid (E-NET-021 when its answer arrives later) |
| awaitingAnswer | `acceptAnswer` | connecting -> lobby | set remote description; channel open within 20 s else E-NET-002; hello exchange; `net.peer {joined:true}` |
| idle (guest) | `joinWithInvite` | connecting | 6.24.4 E; wait 120 s for channel open else error E-NET-002 |
| idle (guest) | `joinRelay` | connecting | socket, `{"op":"join","code"}`; on `joined` send hello to member 1; host admits -> hello reply |
| connecting (guest) | hello reply received | connected -> lobby | first `roomState` moves to lobby; start sync burst |
| lobby | host `selectChart` | lobby | all `ready = false`; guests resolve the song and prepare charts (M-27) |
| lobby | host `start` with `canStart().ok` | countdown | 6.24.4 F |
| countdown | Transport reaches tick 0 (`transport.state` playing) | playing | host starts the 10 Hz score timer at `start` already |
| playing | host chart end (`chart.finished` locally) | results | final scoreUpdate, roomState `results` |
| results | host `backToLobby` | lobby | ready flags cleared, stateSeq++ |
| any connected (guest) | host link closed or silent 6 s | reconnecting | 6.24.4 I |
| reconnecting | resync completed | previous state | |
| reconnecting | 60 s elapsed, or `leave` from host, or relay `closed` | ended | results frozen from the last scoreUpdate (`complete:false`) |
| any | `close()` | idle (after ended) | 6.24.4 I cleanup |

`net.state` maps the room state as `lobby`, `countdown`, `playing` (also while the room is
paused; the pause is visible in `room().state === 'paused'`) and `results`.

6.24.4 C. Validation (`validateMessage`)

```text
validateMessage(input, ctx):
  1. text input: if text.length > 65536 -> reject 'size' (E-NET-023); obj = JSON.parse in try -> reject 'json'
  2. depth(obj) > 8 or total keys > 2,000 -> reject 'depth'
  3. obj is a plain object with exactly the keys v, type, seq, from, tSend, payload -> else 'envelope'
  4. v === 1 -> else 'version' (E-NET-003)
  5. type in MESSAGE_TYPES -> else 'type' (RESERVED_TYPES -> 'deferred', reply E-NET-024 once)
  6. seq integer 1..4294967295 and seq > ctx.lastSeq -> else 'seq' (duplicate or out of order)
  7. from matches ^p[0-9a-z]{9}$ and (ctx.expectedFrom === null or from === ctx.expectedFrom)
     -> else 'from'; a guest additionally requires from === ctx.hostId after hello
  8. tSend finite number -> else 'tSend'
  9. sender role allowed for type (host-only: roomState, selectChart, start, resume, scoreUpdate;
     guest-only: ready, input; pause from a guest is a request) -> else 'role'
 10. payload passes SCHEMA[type] (below): exact key set (no unknown keys, all required keys),
     types, ranges, string lengths, no code point below 0x20 in any string, arrays within caps
 11. JSON.stringify(payload).length <= CAP[type] -> else 'size'
  ok -> {ok:true, msg}
```

Schema notation: `int a..b`, `uint` (0..2^32-1), `num` (finite), `bool`, `str a..b` (length),
`hex8`, `id` (Part 5 id pattern), `pid` (`^p[0-9a-z]{9}$`), `enum(...)`, `T?` (null allowed),
`[T] max n`, `avatar` (object; `Character.validate(obj).ok` and serialized <= 4,096 bytes).

```js
SCHEMA = {
  hello:       { protocol: 'int 1..1', appVersion: 'str 1..32', peerId: 'pid', displayName: 'str 1..24',
                 avatar: 'avatar', mobile: 'bool', resumeToken: 'str 0..32' },
  roomState:   { roomCode: 'str 6..6', hostId: 'pid', mode: 'enum(sync,coop)',
                 state: 'enum(lobby,countdown,playing,paused,results)', stateSeq: 'uint',
                 players: '[player] max 4', song: 'songRef?', chart: 'chartRef?', position: 'pos' },
  player:      { peerId: 'pid', displayName: 'str 1..24', avatar: 'avatar', ready: 'bool', slot: 'int 0..3',
                 trackId: 'id?', latencyMs: 'int 0..60000', offsetMs: 'int -86400000..86400000', connected: 'bool' },
  songRef:     { songId: 'id', title: 'str 1..120', durationTicks: 'int 0..2147483647', sourceHash: 'hex8' },
  chartRef:    { difficulty: 'enum(beginner,intermediate,advanced,expert,easy,normal,hard)',
                 profile: 'enum(A,B,C,D,E,F)?', settingsHash: 'hex8' },
  pos:         { tick: 'int 0..2147483647', tShared: 'num' },
  ready:       { ready: 'bool', settingsHash: 'hex8', judgmentPreset: 'str 1..16',
                 judgeOffsetMs: 'int -500..500', trackId: 'id?' },
  selectChart: { songId: 'id', difficulty: 'enum(beginner,intermediate,advanced,expert,easy,normal,hard)',
                 profile: 'enum(A,B,C,D,E,F)?', trackId: 'id?', mode: 'enum(sync,coop)' },
  start:       { stateSeq: 'uint', tStartShared: 'num', countInBars: 'int 1..2', songId: 'id', settingsHash: 'hex8' },
  pause:       { stateSeq: 'uint', tick: 'int 0..2147483647', tShared: 'num' },
  resume:      { stateSeq: 'uint', tick: 'int 0..2147483647', tStartShared: 'num' },
  input:       { control: 'enum(lane0,lane1,lane2,lane3,dance0,dance1,dance2,dance3)',
                 type: 'enum(press,release)', tShared: 'num', iSeq: 'uint' },
  scoreUpdate: { tick: 'int 0..2147483647', players: '[score] max 4' },
  score:       { peerId: 'pid', score: 'uint', combo: 'uint', maxCombo: 'uint', accuracyPermille: 'int 0..1000',
                 judged: 'uint', miss: 'uint', lastJudgment: 'enum(perfect,great,good,miss)?' },
  avatar:      { avatar: 'avatar' },
  ping:        { t0: 'num' },
  pong:        { t0: 'num', t1: 'num', t2: 'num' },
  leave:       { reason: 'enum(user,error,timeout)' },
  error:       { code: 'str 9..9', message: 'str 0..200', fatal: 'bool' }
};
CAP = { hello: 8192, roomState: 32768, ready: 512, selectChart: 512, start: 256, pause: 128,
        resume: 128, input: 128, scoreUpdate: 1024, avatar: 4096, ping: 64, pong: 64, leave: 128, error: 512 };
```

`ready.judgmentPreset` is a free string in the schema so the host can answer a non-standard
value with the specific E-NET-006 instead of a generic invalid-message drop. `hello.peerId`
must equal the envelope `from`.

Invalid-message policy (per link): each rejection pushes `now` into `invalidTimes` (entries
older than 10 s removed); at 20 entries the receiver sends `error {code:'E-NET-010',
fatal:true}` (host to the offender) and closes that link; a guest that receives 20 invalid
frames from the host in 10 s ends the session with E-NET-010. Rejections emit `net.message`
with `valid:false` and the reason; they never reach `ErrorReporter` individually (one
`Log.warn` per reason per 10 s).

6.24.4 D. Rate limiting and payload caps

```text
RateLimiter(perSecond = 60, reserve = 10): ring of receive times (ms) within the last 1,000 ms
allow(now, isInput):
  drop entries older than now - 1000
  n = entries.length
  if n >= perSecond: dropped++; return false
  if isInput and n >= perSecond - reserve: dropped++; return false     // inputs are shed first
  push(now); return true
```

The limiter runs before JSON parsing on the frame text; `isInput` is decided by a substring
check for `"type":"input"` (cheap; a false guess only affects which frame is shed first).
Dropped frames are counted per player; more than 120 drops in 10 s disconnects the sender
with `error E-NET-011 fatal`. The sender side also self-limits: a guest coalesces nothing but
never sends more than 50 inputs per second (excess presses are still judged locally for the
display and simply not forwarded; the host then records them as not received, which can only
lower that player's score). Outgoing messages above their CAP are a defect: `send` refuses
them with `E-NET-023` in the log.

DataChannel back-pressure: when `dc.bufferedAmount > 1 MB` the link is considered stalled and
closed with reason `'timeout'` (a stalled peer cannot grow memory).

6.24.4 E. WebRTC signaling (non-trickle) and codes

```text
rtcConfig() = {iceServers: stunEnabled ? [{urls: STUN_URL}] : [], iceCandidatePoolSize: 0}

createInvite(opts):                                           // host, state lobby, no invite pending
  pc = new RTCPeerConnection(rtcConfig())                     // throws -> E-CAP-005
  dc = pc.createDataChannel('flm', {ordered: true})           // reliable, ordered
  offer = await pc.createOffer(); await pc.setLocalDescription(offer)
  await gather(pc)                                            // 6.24.4 E gather
  slot = opts.slot ?? lowest free slot 1..3 (none -> E-NET-014)
  code = encodeCode('invite', {room: roomCode, hostId: selfId, slot, sdp: pc.localDescription.sdp,
                               stun: stunEnabled, forPeerId: opts.forPeerId ?? null})
  invite = {pc, dc, slot, forPeerId, expiresAt: Core.now() + 600000}; timer(600000, cancelInvite)
  state 'awaitingAnswer'; return {ok:true, code, slot, expiresAt, warning}

gather(pc): resolve when pc.iceGatheringState === 'complete' (listener on 'icegatheringstatechange')
            or after 3,000 ms, whichever first; warning = 'No network address was found; the
            connection may fail.' when the SDP has no 'a=candidate' line

joinWithInvite(code, opts):                                   // guest
  d = decodeCode(code); require d.kind === 'invite'
  pc = new RTCPeerConnection({iceServers: d.data.stun or stunEnabled ? [{urls: STUN_URL}] : []})
  pc.ondatachannel (via Core.dom.on(pc, 'datachannel')): accept only label 'flm'; else close it
  await pc.setRemoteDescription({type:'offer', sdp: d.data.sdp}); answer = await pc.createAnswer()
  await pc.setLocalDescription(answer); await gather(pc)
  answerCode = encodeCode('answer', {room: d.data.room, hostId: d.data.hostId, slot: d.data.slot,
                                     guestId: selfId, sdp: pc.localDescription.sdp})
  state 'connecting'; timer(120000 -> E-NET-002); return {ok:true, answerCode}

acceptAnswer(code):                                            // host
  d = decodeCode(code); require kind 'answer', room === roomCode, slot === invite.slot, invite not expired
    (else E-NET-021)
  await invite.pc.setRemoteDescription({type:'answer', sdp: d.data.sdp})
  state 'connecting'; wait dc 'open' (20 s -> close pc, E-NET-002)
  link = p2pLink(pc, dc); wait guest hello (5 s -> E-NET-002); validate hello; reply hello;
  register player; invite = null; state 'lobby'; broadcast roomState

encodeCode(kind, obj): prefix = kind === 'invite' ? 'FLMI1.' : 'FLMA1.'
  json = JSON.stringify({v:1, k:kind, ...obj, created: Date.now()})   // created: informational only
  return prefix + base64url(utf8(json))                               // RFC 4648 section 5, no padding

decodeCode(text):
  s = text with all whitespace removed (pasted codes often wrap)
  s.length > 16384 or prefix not 'FLMI1.' or 'FLMA1.' or body has a char outside [A-Za-z0-9_-] -> E-NET-001
  json = new TextDecoder('utf-8', {fatal:true}).decode(base64urlDecode(body)) catch -> E-NET-001
  data = JSON.parse(json) catch -> E-NET-001
  checks: v === 1; k matches the prefix; room 6 symbols of ROOM_ALPHABET; hostId pid; slot int 1..3;
          invite: stun bool, forPeerId pid or null; answer: guestId pid;
          sdp string <= 12,000 chars, starts with 'v=0', contains 'a=fingerprint:' and
          'm=application', only printable ASCII plus CR and LF -> else E-NET-001
  return {ok:true, kind: k, data}
```

Codes are plain text (about 2-4 KB); SCR-Multiplayer offers Copy and Paste buttons and a
read-only text area. Codes carry no secret beyond the session's DTLS fingerprint and network
candidates; they expire with the invite (10 min) and are single-use (the RTCPeerConnection is
consumed by the first accepted answer).

Relay link (`transport:'relay'`, Part 3.7.4 envelope): one WebSocket per client; NetMessage
texts travel inside `{"op":"msg","to":<memberId or 0>,"data":"<NetMessage text>"}`; received
`{"op":"msg","from":<memberId>,"data"}` frames are passed to the receive path with the relay
member id. The host binds `memberId -> peerId` on the guest's hello and afterwards requires
`from(envelope) === boundPeer(memberId)`; a guest accepts game messages only from member 1
(the host). Relay control frames map as: `peer {event:'join'}` -> pending admit; `peer
{event:'leave'}` -> link closed for that member; `closed {reason:'host-left'}` -> E-NET-009,
`'expired'` -> E-NET-017, `'shutdown'` -> E-NET-017; `error` codes `ROOM_NOT_FOUND` and
`BAD_CODE` -> E-NET-013, `ROOM_FULL` -> E-NET-014, `SERVER_FULL` -> E-NET-012, `TOO_LARGE` ->
E-NET-023, `RATE_LIMIT` -> counted (`dropped`), others -> logged. Relay rooms require host
approval: a hello from a new member waits in `admits` until the host calls `admit(peerId,
true)`; declining sends `error E-NET-020 fatal` to that member. Part 5.16's `{v:1,
type:'join', ...}` relay envelope is superseded by the Part 3.7.4 `op` envelope.

6.24.4 F. Song resolution, chart identity and scheduled start

```text
songHash(song) = hex8(fnv1a32(song.source.format === 'builtin'
                  ? 'builtin|' + song.id + '|' + song.durationTicks
                  : 'file|' + song.source.fileHash + '|' + song.durationTicks))
guest resolves selectChart / roomState.song:
  builtin -> Project.Catalog.getSong(songId); imported -> the catalog song whose songHash equals
  roomState.song.sourceHash (imported song ids differ between devices; file hash plus duration
  identify the same file); none -> reply error {code:'E-NET-007', fatal:false}, ready stays false
```

Chart identity: every player generates its own chart locally with the same deterministic
generator (I 6.2) and sends its `settingsHash` in `ready`; the host compares it with the hash
of the chart it generated for that player (`chartFor(peerId, trackId)`), so mismatched chart
versions or settings are caught before the start (E 8.2 "players load different versions of
the same chart"; P 5.3 "compatible charts and settings"). In `sync` mode all players share the
host's chart; in `coop` mode each player has the chart of its own `trackId`.

`canStart()` (host): at least 2 connected players; every connected player `ready === true`
with a hash that matched; every guest has >= 4 sync samples; no pending admits or invite in
`connecting`; game bound. Warnings (start allowed, M-27 asks for confirmation): any player with
sync quality `poor`; any player on mobile with `latencyMs > 150`.

```text
start():                                                      // host
  stateSeq++; tStart = localAudioNow() + 2.0                  // host audio time is shared time
  room.state = 'countdown'; broadcast roomState (immediately, not coalesced)
  for each connected guest g: send g start {stateSeq, tStartShared: tStart, countInBars,
                                            songId, settingsHash: chartFor(g).settingsHash}
  for each guest g: j = Rhythm.Judge.bind({timeMap: game.transport, strayPenalty: 'none'})
                    j.load(chartFor(g, g.trackId), game.song, windowsFor(g))
                    j.setCalibration({inputOffsetMs: g.judgeOffsetMs, audioLatencyMs: 0})
                    j.setActive(false)               // follows the host transport state; never attach()ed
                    guestJudges.set(g, j)
  game.transport.play({countInBars, atAudio: tStart})         // count-in starts at tStart (6.24.9)
  scoreTimer = Core.timers.setInterval(sendScores, 100, owner)

guest onStart(p):
  if p.stateSeq <= stateSeq: ignore
  if p.songId !== game.song.id or p.settingsHash !== game.localChart.settingsHash: send error E-NET-005; return
  lead = p.tStartShared - Clock.sharedNow()
  if lead < 1.0: send error {code:'E-NET-008', fatal:false}; return
  clock.frozenOffsetS = clock.offsetS; stateSeq = p.stateSeq
  game.transport.play({countInBars: p.countInBars, atAudio: Clock.toLocalAudio(p.tStartShared)})
  state 'countdown'

host onError E-NET-008 from g: startAttempts++;
  if startAttempts <= 3: game.transport.stop(); start() again (new stateSeq, new tStart)
  else: stopGame(); toast via M-27 "Could not synchronize the start with {name}."
```

Countdown accuracy: the count-in clicks and the first note sound at the same shared time on
every client within the clock error (target <= 20 ms, BRIEF 6).

6.24.4 G. Inputs, authoritative judging and scores

```text
guest on input.event e (state playing, room not paused, control in the bound kind's set, e.tAudio !== null):
  send input {control: e.control, type: e.type, tShared: e.tAudio + clock.frozenOffsetS, iSeq: ++iSeq}
  (the local M-28 judge also judges e for immediate feedback; its numbers are display-only)

host on input p from g:
  checks of 6.24.4 A; then judge = guestJudges[g]
  judge.onInput({source:'net', control: p.control, type: p.type, tPerf: 0, tAudio: p.tShared, pressure: 1})
  g.lastInputT = p.tShared; scoreDirty = true

host each frame (called from the multiplayer mode frame) and each scoreTimer tick:
  for each guest g: lagS = clamp(2 * g.sync.rttS + 0.1, 0.25, 2.0)
                    guestJudges[g].tick(localAudioNow() - lagS)    // misses wait for in-flight inputs

host transport.state playing/paused: every guest judge setActive(state === 'playing')

sendScores() every 100 ms while playing (always sent, so guests can count missed updates):
  players = [host from game.localState()] + [each guest from guestJudges[g].state()]
  item = {peerId, score, combo, maxCombo, accuracyPermille: round(accuracy * 1000), judged,
          miss: counts.miss, lastJudgment: last JudgeResult judgment or null}
  broadcast scoreUpdate {tick: floor(transport.positionAt(localAudioNow())), players}
```

Guests are judged against the timeline they heard: their `tShared` uses the offset frozen
at the start (or the last resume or resync), which is the same offset that anchored their
transport, so slow clock drift between devices during a song does not move their judgment
windows. The current median offset keeps updating for diagnostics and the next anchoring.
Calibration: the guest's declared `judgeOffsetMs` (its local `inputOffsetMs + audioLatencyMs`,
Part 5.12) is applied once by the host's judge for that guest; the host enforces +/- 500 ms.

Competitive ranking (`sync` mode): score descending, then accuracy, then maxCombo, then slot.
Cooperative (`coop`): band score = sum of scores; band accuracy = sum of points / (100 * sum
of judged) computed from `accuracyPermille * judged` per player; each player's row shows its
track name and contribution percentage (score / band score).

6.24.4 H. Clock synchronization

```text
offsetFrom(t0, t1, t2, t3):       // t0, t3 local audio s; t1, t2 remote audio s
  offsetS = ((t1 - t0) + (t2 - t3)) / 2
  rttS    = (t3 - t0) - (t2 - t1)
on pong p (guest from host, or host from guest): t3 = localAudioNow()
  r = offsetFrom(p.t0, p.t1, p.t2, t3); if r.rttS < 0 or r.rttS > 5: discard (counted)
  samples.push(r); keep the last 8
  summarize(samples):
    offs = sorted offsetS; rtts = sorted rttS; n = samples.length
    median(x) = n odd ? x[(n-1)/2] : (x[n/2 - 1] + x[n/2]) / 2
    q1, q3 = medians of the lower and upper halves (n >= 4), else q1 = q3 = median
    offsetMs = median(offs) * 1000; rttMs = median(rtts) * 1000
    jitterMs = (q3(offs) - q1(offs)) * 1000
    driftMs = frozenOffsetS === null ? 0 : |median(offs) - frozenOffsetS| * 1000
    errorMs = jitterMs + driftMs
    quality = n < 4 ? 'poor' : errorMs <= 20 ? 'good' : errorMs <= 50 ? 'fair' : 'poor'
  emit net.sync {peerId, offsetMs, rttMs, jitterMs, samples:n, quality}
schedule: after hello, 8 pings 100 ms apart; then one ping every 10 s (both directions: the
  guest measures its offset to the host; the host measures rtt to each guest for latencyMs and lagS)
pong reply: t1 = localAudioNow() at receipt, t2 = localAudioNow() just before sending
```

Reference vector (UT-24-11): guest clock 5.000 s behind the host, 10 ms each way, 2 ms host
processing: `t0 = 10.000, t1 = 15.010, t2 = 15.012, t3 = 10.022` -> `offsetS = 5.000`,
`rttS = 0.020`. The host's `offsetMs` is 0 and `Clock.toShared` is the identity on the host.
`localAudioNow()` is the injected clock (`FLM.Audio` engine time in production); while the
local AudioContext is not running, pings are not sent and stale samples older than 60 s are
dropped.

6.24.4 I. Pause, resume, interruptions, reconnection, departure, cleanup

Pause and resume:
```text
host pause (requestPause on host, a guest request honored, or host interruption):
  if room.state !== 'playing': return
  stateSeq++; tick = floor(transport.positionAt(now)); transport.pause()
  room.state = 'paused'; broadcast pause {stateSeq, tick, tShared: now}; broadcast roomState
guest on pause p: if p.stateSeq <= stateSeq: ignore (late pause after a resume, E 8.2)
  stateSeq = p.stateSeq; transport.pause(); transport.seek(p.tick)   // frozen exactly at the host tick
host resume(): stateSeq++; tStart = now + 1.0; room.state = 'playing'
  broadcast resume {stateSeq, tick: frozenTick, tStartShared: tStart}; transport.resume({atAudio: tStart})
guest on resume p: if p.stateSeq <= stateSeq: ignore; stateSeq = p.stateSeq
  clock.frozenOffsetS = clock.offsetS; transport.seek(p.tick)
  transport.resume({atAudio: max(Clock.toLocalAudio(p.tStartShared), localAudioNow() + 0.05)})
guest requestPause(): send pause {stateSeq, tick: local position, tShared: sharedNow()}; the
  guest's own transport keeps playing until the host's authoritative pause arrives
```
Interruptions in multiplayer (M-28 routes them here instead of pausing the transport
directly): host hidden, host audio suspended -> host pause; guest hidden or guest audio
suspended -> `requestPause()` (honored subject to the 10 s rule). Speed changes are not
offered in multiplayer (speed fixed at 1.0; `transport.speed` from a guest UI is rejected by
M-27); a host seek while playing (not offered by the UI; defensive) is converted into pause
at the current tick followed by `resume` at the new tick so every client re-anchors (E 8.2
"host changes tempo or seeks").

Liveness and disconnection detection:
- Guest: host link `close` event, RTCPeerConnection `connectionState` `failed`, or no frame
  from the host for 6 s (the host sends `roomState` every 2 s) -> `reconnecting`.
- Host: guest link close, `failed`, or no frame from a guest for 12 s (guests ping every 10 s)
  -> player `connected:false`, `disconnectedAt = now`, roomState broadcast, the player's judge
  keeps running (inputs during the outage are not received; notes become misses).

Reconnection (within 60 s, at most 3 per player per 5 min):
- P2P: SCR-Multiplayer on the host shows "Create reconnect invite for {name}" ->
  `createInvite({forPeerId})`; the guest pastes it into `joinWithInvite` with its stored
  `resumeToken` in hello. Relay: the guest reopens the socket with backoff 1, 2, 4, 8, 16 s
  (stopping at 60 s), re-joins the room code and sends hello with its `resumeToken`.
- Host matches `resumeToken` to the disconnected player (wrong token or `left` -> treated
  as a new player: E-NET-019 while playing, else normal join), restores the slot, replies
  hello and a full roomState. If playing: `position = {tShared: now + 0.5, tick:
  floor(transport.positionAt(now + 0.5))}`.
- Guest resync: `frozenOffsetS = offsetS` (after a fresh 8-sample burst when time allows,
  else the old median), `transport.play({fromTick: position.tick, countInBars: 0, atAudio:
  toLocalAudio(position.tShared)})`; the local display judge restarts and `resyncTick` is set
  so the HUD suppresses flashes for notes before it (E 8.1 "reconnects with stale state": all
  local state is replaced by the host's roomState).
- After 60 s the host marks the player `left` (kept in results with its last score); the
  guest ends with E-NET-015 and frozen results.

Departure:
- Host `close()` or host leave: guests receive `leave` (or relay `closed host-left`, or
  silence) -> `ended` with reason `hostLeft`, transport stopped, results from the last
  `scoreUpdate` with `complete:false` and the text "The host left. Scores are the last ones
  the host sent." (no migration, ADR-07).
- Guest leave: host marks the player `left` immediately (no reconnect window), keeps its
  score row, continues the song for the others (E 8.1, I 10.3).
- Host losing every guest while playing: the song continues locally for the host to the end
  (standalone play is never disabled by network failure, E 11).

`close(reason)`: send `leave {reason}` to every open link and wait at most 200 ms; close every
DataChannel and RTCPeerConnection (`pc.close()`) or send `{"op":"leave"}` and close the
socket with 1000; dispose guest judges; `Core.timers.clearOwner(owner)`, `Core.dom.offOwner(owner)`,
`bus.removeOwner(owner)`; state `ended` then `idle`; `connectionCount() === 0`.

6.24.4 J. Diagnostics

```js
NetDiagnostics {
  role, state, transport, roomCode, stateSeq, sendSeq,
  totals: { in, out, bytesIn, bytesOut, invalid, dropped, ignored },
  peers: [ { peerId, displayName, connected, rttMs, offsetMs, jitterMs, errorMs, quality,
             samples, lastMessageAgoMs, missedUpdates, invalid, dropped, reconnects,
             bufferedAmount } ],
  invalidByReason: { size, json, depth, envelope, version, type, deferred, seq, from, tSend, role, payload }
}
```
`missedUpdates` (guest view of the host): while playing, a gap between two `scoreUpdate`
messages longer than 250 ms adds `floor(gap / 100) - 1`; the lobby shows "Missed updates: n"
and the HUD sync badge turns to fair when more than 5 updates were missed in the last 10 s
(I 10.2 "detect missed updates"). The lobby lists for every player: latency (rtt/2), clock
offset, sync quality word (good, fair, poor; never color only), missed updates.

6.24.4 K. Privacy statement (`PRIVACY_TEXT`, shown on SCR-Multiplayer before the first room
and under "What is shared")

```text
Multiplayer shares the following with the other players in your room: your display name,
your character's appearance, your ready state and chosen track, the name and length of the
selected song, your button presses with their timing, your scores, and timing measurements
used to keep everyone in sync. Your projects, recordings, imported files and settings are
never sent; an imported song is identified only by a checksum of the file. Peer-to-peer play
connects your browser directly to the other players' browsers, which lets them see your
network address. If you turn on the public STUN server, your browser also contacts
stun.l.google.com to find its public address. If an online relay is used, every message
passes through that relay server, which does not store messages. Nothing is sent when you do
not use Multiplayer.
```

6.24.4 L. Collaborative Studio (Deferred, P2; rules fixed now so v1 data does not block it)

| Topic | Rule |
|---|---|
| Ownership | each track has `ownerPeerId` (its creator); tempo, meter, key and markers belong to the host |
| Permissions | only the owner edits a track's events, mix and instrument; the host may grant `edit` on a track to another player; nobody deletes a track they do not own; the host may remove any player's tracks after confirmation |
| Operations | every edit is an M-15 Command (type and params) sent as `studioOp {opId, baseRevision, trackId, command}`; the host is the single serializer and applies ops in arrival order |
| Conflicts | the host rejects (`studioReject {opId, reason}`) an op whose `baseRevision` is older than the last revision that touched any of its event ids or the track's instrument; the client discards its local optimistic change and re-applies after the next snapshot; ops on different tracks never conflict |
| Versioning | the project revision (M-15) increments per applied op; `studioAck {opId, revision}` confirms; late joiners receive `studioSnapshot` chunks (<= 48 KB each, `index/count`, `fnv1a32` of the whole) |
| Recording | each player records locally against the shared clock; the take is submitted as one `replaceTake` op after stop |
| Undo | a player undoes only its own ops; the host converts an undo into the inverse op |
| v1 behavior | the four `studio*` types are in `RESERVED_TYPES`; receiving one is rejected as `deferred` and answered once with `error E-NET-024` "Collaborative Studio is not available in this version." |

#### 6.24.5 Error handling and recovery

Error codes (numbering and texts are those of Part 10.6.8, which is the registry; classes per
Part 10.6.8, the session either stays in the lobby or ends, and standalone play continues):

| Code | Message (ERRORS) |
|---|---|
| E-CAP-005 | "Multiplayer needs WebRTC, which this browser does not provide." |
| E-NET-001 | "This is not a valid {expected} code. Copy the whole code and paste it again." |
| E-NET-002 | "Could not connect to the other player. Without the STUN option, players usually need to be on the same network." |
| E-NET-003 | "The other player uses an incompatible multiplayer version. Both players need the same version of the game." |
| E-NET-004 | "The other player has a different version of Finger Lickin Music ({version}). Both players need the same version." |
| E-NET-005 | "Your chart differs from the host's. The host's chart settings were applied; press Ready again." |
| E-NET-006 | "Multiplayer uses standard timing windows. Your timing preset was set to Standard for this session." |
| E-NET-007 | "You do not have this song. Ask the host to choose a built-in song or one you both imported." |
| E-NET-008 | (log only; no user text) |
| E-NET-009 | "The host has left. The session has ended; here are the results so far." |
| E-NET-010 | "Disconnected {name} because their game sent invalid data." |
| E-NET-011 | "Disconnected {name} because their game sent too many messages." |
| E-NET-012 | "Could not reach the relay server at {relayUrl}. You can still play by exchanging invite codes directly." |
| E-NET-013 | "No room with this code exists. Check the code and try again." |
| E-NET-014 | "This room is full (4 players)." |
| E-NET-015 | "Could not reconnect within 60 seconds. You have left the session." |
| E-NET-016 | "{name} disconnected. They have 60 seconds to reconnect." |
| E-NET-017 | "The relay closed this room ({reason}). Local results were kept." |
| E-NET-018 | "Connection is unstable; timing between players may be less accurate." |
| E-NET-019 | "A song is in progress. You will join the room when it ends." |
| E-NET-020 | "The host did not admit you to the room." |
| E-NET-021 | "This invite has expired or was already used. Ask the host for a new invite." |
| E-NET-022 | "This player is already in the room." |
| E-NET-023 | (log only; no user text) |
| E-NET-024 | "That is not possible right now: {detail}." |

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| WebRTC missing or `RTCPeerConnection` throws | `p2pAvailable()`, try/catch | menu, projects | no | none | Multiplayer entry disabled with reason (Part 4.3 gate) or E-CAP-005 | relay if available, else standalone | idle | UT-24-39 |
| ICE gathering finds nothing (no STUN, isolated network) | 3 s timeout, no candidate lines | lobby | new invite with STUN on | none | warning text on the invite | none | lobby | UT-24-39 |
| connection never opens | 20 s (host) / 120 s (guest) timers | lobby | new invite | none | E-NET-002 | standalone | lobby or idle | UT-24-27 |
| bad or expired code | `decodeCode`, invite timer | lobby | paste again or new invite | none | E-NET-001, E-NET-021 | n/a | lobby | UT-24-02 |
| version or protocol mismatch | hello checks | host lobby | update | none | E-NET-003, E-NET-004 | n/a | link closed | UT-24-17 |
| chart mismatch (E 8.2) | ready and start hash checks | lobby | re-select | none | E-NET-005 | n/a | lobby, ready false | UT-24-18 |
| missing song | song resolution | lobby | import file | none | E-NET-007 | n/a | lobby | UT-24-18 |
| start too close (latency spike) | lead < 1.0 s | lobby state | 3 automatic attempts | none | E-NET-008 then toast | n/a | lobby | UT-24-20 |
| latency increases sharply (E 8.2) | rtt samples, lagS | session | n/a | none | sync badge fair or poor; `net.sync` | host waits up to 2 s for inputs | automatic | UT-24-22 |
| duplicate or reordered messages (E 8.2) | seq check | session | n/a | none | diagnostics counters | n/a | n/a | UT-24-08, UT-24-09 |
| pause after resume arrives late (E 8.2) | stateSeq | transport state | n/a | none | none | n/a | n/a | UT-24-10 |
| malformed messages or flood (E 8.3) | validation, limiter | session | n/a | none | E-NET-010, E-NET-011 on the offender | offender disconnected | others continue | UT-24-16, UT-24-15 |
| guest disconnects (E 8.1) | close, failed, 12 s silence | session, other players | reconnect within 60 s | none | lobby row "Disconnected (reconnect within 60 s)" | game continues | slot freed after 60 s | UT-24-29 |
| host disconnects or leaves (E 8.1) | leave, close, 6 s silence | local project and settings | guest: reconnect within 60 s | none | E-NET-009 or E-NET-015 with results | standalone | results then menu | UT-24-28 |
| relay down or restarted (E 8.1) | socket close or `closed shutdown` | local state | relay backoff for guests (60 s) | none | E-NET-012 | standalone | idle | UT-24-31 |
| room expired (E 8.1) | relay `closed expired` | local state | new room | none | E-NET-017 | standalone | idle | UT-24-31 |
| reconnect after room expired | relay `ROOM_NOT_FOUND` during backoff | local state | no | none | E-NET-013 then E-NET-015 | standalone | ended | UT-24-27 |
| too many reconnects (E 8.3) | `reconnects > 3` within 5 min | session | no | none | E-NET-015 "too many reconnection attempts" to that player | player removed | others continue | UT-24-25 |
| local AudioContext suspended during a song | `audio.state` | session | resume | none | DLG-ResumeAudio plus pause request | paused | resume message re-anchors | UT-24-10 |
| `net.*` listener throws | Emitter isolation | session | n/a | none | ErrorReporter | n/a | n/a | UT-24-33 |

Security checks (E 8.3) and the response to each abuse case:

| Abuse case | Check | Response |
|---|---|---|
| impossible scores submitted by a client | no message type lets a guest send a score; `scoreUpdate` from a non-host is rejected by the role rule | guest scores are computed only by the host's judges from inputs; a forged `scoreUpdate` counts as invalid |
| malformed messages | 6.24.4 C on every frame | dropped and counted; 20 in 10 s -> E-NET-010 and disconnect |
| input flood | RateLimiter 60 per s with input shedding; 120 drops in 10 s | excess dropped; then E-NET-011 and disconnect |
| joining a private room without authorization | p2p: joining requires the host's invite code and the host pasting the answer; relay: host must `admit` every new member | unknown joiners never reach the lobby; declined joiners get E-NET-020 |
| oversized avatar or project payload | CAP per type before parsing the payload; avatar `Character.validate` and <= 4,096 B; projects are never transferred in v1 | rejected as invalid (E-NET-023 counted) |
| local clock changes to manipulate results | timing uses audio clocks and the measured offset, never wall clock; input `tShared` must lie in [hostNow - 2 s, hostNow + 2 s] and be non-decreasing; `judgeOffsetMs` bounded to +/- 500 | out-of-window inputs dropped; a shifted clock only changes the measured offset; the residual advantage is bounded by the 500 ms calibration bound and is visible in diagnostics |
| events for a song that is not active | input accepted only in `playing` and not paused; `start` and `ready` must carry the bound `songId` and `settingsHash` | dropped (`ignored`) or E-NET-005 |
| repeated reconnection attempts | 3 reconnects per player per 5 min; resume token required; relay connection rate limits (Part 3.7) | further attempts refused with E-NET-015 |
| spoofed sender id | `from` must equal the id bound to the link (p2p channel or relay member id) | rejected as invalid |
| replayed old messages | `seq` strictly increasing; `stateSeq` monotonic | dropped as duplicates |
| script injection through names or error text | strings without control characters, length capped, rendered with `textContent` only (ADR-12) | text shown literally |
| fabricated precise inputs (a bot) | not detectable in a P2P design | documented limit: host scores certify the host's judging of received inputs, not human play (Part 10) |

#### 6.24.6 Limits and performance notes

| LIMITS key | Value | Meaning |
|---|---|---|
| maxPlayers | 4 | including the host (BRIEF 6) |
| maxMessageBytes | 65536 | per frame (BRIEF 6; relay frame cap Part 3.7.3) |
| maxDepth | 8 | JSON nesting |
| ratePerSecond, inputReserve | 60, 10 | per peer sliding 1 s window |
| invalidMax, invalidWindowMs | 20, 10000 | disconnect threshold |
| droppedMax, droppedWindowMs | 120, 10000 | flood disconnect threshold |
| scoreHz | 10 | scoreUpdate rate while playing (BRIEF 6 state 10 Hz) |
| roomStateIntervalMs, roomStateCoalesceMs | 2000, 200 | heartbeat and change coalescing |
| syncBurst, syncBurstSpacingMs, syncIntervalMs, syncKeep | 8, 100, 10000, 8 | BRIEF 6 clock sync |
| syncTargetMs | 20 | `good` threshold (BRIEF 6) |
| startLeadS, startMinLeadS, resumeLeadS, resyncLeadS, startAttempts | 2.0, 1.0, 1.0, 0.5, 3 | scheduled starts |
| iceGatherTimeoutMs, connectTimeoutMs, guestAnswerWaitMs, inviteTtlMs | 3000, 20000, 120000, 600000 | signaling |
| hostSilenceMs, guestSilenceMs | 6000, 12000 | liveness |
| reconnectWindowMs, maxReconnects, reconnectLimitWindowMs | 60000, 3, 300000 | reconnection |
| inputWindowS, judgeOffsetMaxMs | 2.0, 500 | input acceptance |
| avatarBytes, codeMaxChars, sdpMaxChars | 4096, 16384, 12000 | payload limits |
| pauseRequestMinIntervalMs | 10000 | guest pause requests |
| relayConnectTimeoutMs, relayBackoffMs | 10000, [1000, 2000, 4000, 8000, 16000] | relay |
| leaveFlushMs, bufferedMaxBytes | 200, 1048576 | close and back-pressure |

Performance: validation of a 128-byte input frame <= 0.05 ms; a 32 KB roomState <= 1 ms;
traffic per guest while playing ~ 10 scoreUpdates (<= 1 KB) + 0.5 roomState + inputs (~10
per s x 110 B) ~ 12 KB/s down, ~ 1.5 KB/s up. Host CPU per guest judge as 6.9.6. The Net
module never runs work in the render loop beyond the per-frame `tick` of guest judges.

#### 6.24.7 Spec coverage

B 5.4 (standalone versus online contexts), B 7.7 (all 13 items and the four distinctions:
shared-song synchronized play = `sync`, cooperative = `coop`, competitive scoring = `sync`
ranking, shared creative sessions = Deferred with rules), B 9.4 (per-player statistics), B 13.4
(avatar sync within 4 KB), B 17.1 (protocol, transport, hosting: relay Part 3.7), B 17.2 (all 9
items), B 17.3 (all 8 items), B 17.4 (validation, payload limits, authoritative scores), B 17.5,
B 23.2 (privacy text), B 23.4 (no credentials), B 25.2 (session synchronization, offline
operation), B 26.7 (all four), E 8.1 (all 10), E 8.2 (all 10), E 8.3 (all 8), E 10 item 8, E 11
(network failure never disables standalone), I 10.1 (three experiences; collaborative studio
Deferred), I 10.2, I 10.3, I 10.4 (rules defined), I 10.5, I 14.3 (Profile B), I 16.4
(message versioning), I 17 (message validation tests), P 5.3 (compatible charts, calibration
bounded), P 13 (all 14 items), P 18 (no private credentials).

#### 6.24.8 Unit tests (group `net`, file `src/91-test-net.js`)

Harness: `createSession(deps)` with a `FakeClock` per side (`now()` in seconds, advanced
manually), `createLoopbackPair({latencyMs})` links, a fake RTC constructor
(`FLM.SelfTest.fakes.rtc`: records config, `createOffer` returns a fixed SDP with one
candidate, gathering completes after a configurable delay or never) and a fake WebSocket that
speaks the Part 3.7.4 envelope. `msg(type, payload, seq, from)` builds envelopes.

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-24-01 | code round trip | `encodeCode('invite', {room:'ABC234', hostId:'p000000001', slot:1, sdp:SDP, stun:false, forPeerId:null})` | `decodeCode` returns `ok`, `kind:'invite'`, identical fields; text starts with `FLMI1.`; body only `[A-Za-z0-9_-]` |
| UT-24-02 | code rejection and whitespace | code with inserted spaces and line breaks; wrong prefix; `+` character; 20,000 chars; SDP without fingerprint | first decodes ok; the others `E-NET-001` |
| UT-24-03 | envelope rules | missing `tSend`; extra key; `v:2`; `seq:0`; `from:'x'` | reasons `envelope`, `envelope`, `version`, `seq`, `from` |
| UT-24-04 | payload strictness | `ping` with extra field; `input` without `iSeq`; `leave` reason `'bye'` | all rejected `payload`; valid forms accepted |
| UT-24-05 | size caps | 70,000-char text; `scoreUpdate` payload of 1,100 B; avatar of 4,200 B | `size` for all three; nothing parsed for the first (JSON.parse spy not called) |
| UT-24-06 | strings and depth | displayName with `\u0007`; payload nested 9 deep | both rejected; a name with `<script>` text is accepted as plain text |
| UT-24-07 | role rules | guest sends `scoreUpdate`, `roomState`, `start`; host sends `input` | all rejected `role` |
| UT-24-08 | dedupe by seq | deliver seq 5 twice | second dropped; `counters.invalid` +1 with reason `seq`; handler called once |
| UT-24-09 | out-of-order | deliver seq 7 then 6 | 6 dropped; 7 handled |
| UT-24-10 | pause after resume ignored | guest receives resume stateSeq 12, then pause stateSeq 11 | guest transport stays playing; `ignored` +1 |
| UT-24-11 | offset math vector | `offsetFrom(10.000, 15.010, 15.012, 10.022)` | `offsetS` 5.000 and `rttS` 0.020 within 1e-9 |
| UT-24-12 | median with outliers | 8 samples with offsets 4.998, 4.999, 5.000, 5.000, 5.001, 5.001, 5.002, 5.300 s | `offsetMs` 5000.5; `jitterMs` 2.0 (q1 4.9995, q3 5.0015); quality `good` |
| UT-24-13 | quality thresholds and sample minimum | jitter 15, 35, 80 ms; 3 samples | good, fair, poor; 3 samples -> poor |
| UT-24-14 | shared time conversions | offset 5.000 s | `toShared(toLocalAudio(x)) === x`; host `toShared` identity |
| UT-24-15 | rate limiter | 70 frames within 1 s, first 55 inputs then 15 controls | 50 inputs allowed, 5 inputs dropped, 10 controls allowed, 5 dropped; window slides after 1 s |
| UT-24-16 | invalid storm | 20 invalid frames in 9 s from one guest | host sends `error E-NET-010 fatal` and closes that link; other guests unaffected |
| UT-24-17 | hello checks | protocol 2; appVersion '2.0.0' vs '1.0.0'; valid hello | E-NET-003, E-NET-004 with link closed; valid -> player registered and hello replied with a resumeToken |
| UT-24-18 | ready checks | wrong settingsHash; `judgmentPreset:'relaxed'`; `judgeOffsetMs` 600; coop duplicate trackId; guest without the song | E-NET-005, E-NET-006, `payload` invalid, E-NET-024, E-NET-007 |
| UT-24-19 | scheduled start | host clock 100.0, guest offset 5.0 | start payload `tStartShared` 102.0; guest `transport.play` called with `atAudio` 97.0; both count-ins begin at the same shared time |
| UT-24-20 | start too close | loopback latency 1,500 ms | guest replies E-NET-008; host re-issues with a higher stateSeq; after 3 failures `stopGame` and lobby |
| UT-24-21 | input acceptance window | inputs with tShared hostNow - 2.5, hostNow + 1, decreasing tShared, repeated iSeq | first dropped, second judged, third and fourth dropped |
| UT-24-22 | host judges guest with guest offset | guest offset 5.0 s, guest calibration 30 ms, guest press exactly at the heard note time + 30 ms | host guest-judge result `perfect`, `deltaMs 0`; lagS defers the miss declaration by 2*rtt + 0.1 s |
| UT-24-23 | score updates at 10 Hz | play 1.0 s of fake clock | 10 scoreUpdate frames; `accuracyPermille` rounded; host row first |
| UT-24-24 | room full | 5th hello (p2p) and relay `ROOM_FULL` | E-NET-014 both; no 5th player |
| UT-24-25 | same player twice and reconnect limit | hello with a connected peerId; disconnected peer with the right resumeToken; 4th reconnect within 5 min | E-NET-022; slot restored; E-NET-015 |
| UT-24-26 | reconnect resync | guest drops at t = 10 s of play, reconnects at t = 25 s | guest `transport.play({fromTick, atAudio})` with `fromTick` = host position at hostNow + 0.5; `resyncTick` set; host judge recorded misses during the gap |
| UT-24-27 | reconnect window and connect timeouts | no reconnect within 60 s; guest channel never opens | E-NET-015 and player `left`; guest E-NET-002 after 120 s |
| UT-24-28 | host leaves | host `close('user')` while playing | guest `ended`, `results().complete === false`, transport stopped, E-NET-009 |
| UT-24-29 | guest leaves | one of 3 guests sends leave | host continues; player row `left:true` with last score; other guests unaffected |
| UT-24-30 | relay envelope and sender binding | fake WebSocket; guest member 3 sends a message with `from` of member 2's peer | wrapped as `{"op":"msg","to":1,...}`; spoofed message rejected `from` |
| UT-24-31 | relay control mapping | `closed host-left`, `closed expired`, `error ROOM_NOT_FOUND`, socket close | E-NET-009, E-NET-017, E-NET-013, E-NET-012 (guest after backoff exhausted) |
| UT-24-32 | late join rejected | new hello without resumeToken while playing | E-NET-019; link closed |
| UT-24-33 | cleanup | full session then `close()` | `connectionCount() === 0`; `Core.timers.count(owner) === 0`; bus listeners for the owner 0; fake RTC `close` called on every pc |
| UT-24-34 | room codes | `makeRoomCode` 1,000 times with a fixed random source | 6 symbols, all in ROOM_ALPHABET; never contains I, O, 0, 1 |
| UT-24-35 | avatar validation and privacy text | avatar 4,200 B; invalid `body` value; `PRIVACY_TEXT` | rejected; rejected; text non-empty, ASCII, mentions "STUN" and "relay" |
| UT-24-36 | pause request throttle | guest sends 3 pause requests within 5 s | host pauses once; later requests ignored until 10 s passed |
| UT-24-37 | missed updates | host silent for 650 ms during play, then a second 650 ms gap 3 s later | first gap: `missedUpdates` += 5, badge stays good; after the second gap (10 missed in 10 s) badge fair |
| UT-24-38 | deferred studio types | message type `studioOp` | rejected reason `deferred`; one `error E-NET-024` reply |
| UT-24-39 | non-trickle gathering and RTC failure | fake RTC that never completes gathering; fake RTC with no candidates; constructor throws | invite returned after 3,000 ms of fake time; warning text present; E-CAP-005 |
| UT-24-40 | interruption routing | guest `audio.state` suspended while playing | guest sends a pause request; host pauses everyone; guest does not pause its transport before the host message |

#### 6.24.9 Implementation notes and browser quirks

- Transport extension required by this module: `Transport.play(opts)` and
  `Transport.resume(opts)` must accept `atAudio` (anchor the count-in start or resume tick at
  that audio time when it is at least 50 ms in the future; else behave as today with now +
  0.05). 6.4.2 has no such option; the Transport owner adds it (recorded as an open issue).
- Envelope `tSend` follows Part 5.1.8 (sender local audio time); Part 4.5.2 calls it shared
  time. Nothing depends on it except diagnostics.
- `RTCPeerConnection`, `RTCDataChannel` and `WebSocket` listeners are attached with
  `Core.dom.on(target, type, fn, undefined, owner)` (any EventTarget), never with raw
  `addEventListener` (Part 4.7.3 lint rule).
- Safari: DataChannel `ordered:true` reliable is the default; do not set `maxRetransmits`.
  Safari and Firefox obfuscate local addresses as mDNS `.local` candidates; LAN play still
  works when both devices resolve mDNS (OQ-3 covers public STUN).
- Firefox reports `iceGatheringState` transitions reliably; Chromium sometimes stays in
  `gathering` when no STUN is configured until the 3 s timer fires; the timer is the contract.
- iOS Safari suspends the page in the background; the 6 s / 12 s liveness rules then take
  over; on return the guest runs the reconnect flow.
- CSP: WebRTC is not governed by `connect-src` (ADR-12); the relay needs the Online edition
  build where `connect-src` includes the relay origin, which is why `relayAvailable()`
  requires `FLM.BUILD.online` (in the standalone build `?online=` is ignored with
  `Log.warn('Relay needs the Online edition')`).
- `audio clock` resolution: `AudioContext.currentTime` advances per render quantum (128
  frames, 2.7 ms at 48 kHz); this bounds a single offset sample's precision and is well below
  the 20 ms target.
- Clipboard: Copy uses `navigator.clipboard.writeText` with a selected `textarea` fallback
  (M-27); codes contain only URL-safe ASCII so messaging apps do not alter them.

### 6.25 M-25 Progress (`src/25-progress.js`, `FLM.Progress`)

#### 6.25.1 Responsibilities and non-goals

Responsibilities:
- Performance history (Part 5.13 `PerformanceRecord`): build one record per finished
  play-through from the Rhythm `PerformanceSummary` plus mode metadata, keep the newest 500,
  prune the oldest (I 9.2).
- Personal bests keyed by `songId + '|' + chartHash` (the chart's `settingsHash`), updated
  only from comparable records; score, accuracy and max combo tracked independently (I 9.1,
  P 5.3).
- 20 achievements with deterministic conditions and 10 cosmetic unlocks (3 stage themes, 5
  accessory color sets, 2 effects); cosmetics never change gameplay data (I 9.3).
- The daily challenge: seed from the local date, deterministic song, mode, instrument,
  difficulty and goal; optional, local, no account (I 9.4, ADR-15).
- History view data for SCR-Results and SCR-Library (attempt list, trend, comparison, stats).
- Persistence through `FLM.Storage.get` and `set` under the Part 5.15 keys with size caps, migration
  and corruption handling.

Non-goals:
- No UI (SCR-Results, the Library history tab and the Characters cosmetics tab are M-27);
  no rendering of themes or effects (M-21, M-19 read the unlocked ids).
- No online leaderboards, accounts or telemetry (ADR-15, B 23.2).
- No locking of any music tool behind progression (I 9.1): every mode, song, instrument and
  feature is available from the first launch; only cosmetics unlock.
- Tutorial runs and Free Play are not recorded as performances (they have no chart result);
  Studio contributes only the `takesRecorded` counter.

#### 6.25.2 Public API

```js
FLM.Core.define('Progress', function (FLM) {
  return {
    VERSION: 1,
    LIMITS: { maxRecords: 500, historyBytes: 524288, bestsBytes: 131072, unlocksBytes: 16384,
              dailyBytes: 4096, trendPoints: 20, pruneStep: 50 },
    /** Storage names passed to FLM.Storage.get and set (the prefix 'flm.v1.' is added; Part 5.15 keys). */
    KEYS: { history: 'progress.history', bests: 'progress.bests',
            unlocks: 'progress.unlocks', daily: 'progress.daily' },
    INSTRUMENT_GROUPS: { keys: [[0, 23], [80, 95]], guitar: [[24, 31]], bass: [[32, 39]], drums: [[128, 128]] },

    /** Loads the four documents, validates and migrates them, subscribes to studio.take and
     *  import.done. Called once by M-29 after Storage.open. Never rejects. */
    init() /* -> Promise<{ok:boolean, readOnly:boolean, warnings:string[]}> */,

    /** Called by M-28 on chart.finished for instrument, dance and multiplayer runs.
     *  meta: RecordMeta. Persists, updates bests, evaluates achievements and the daily
     *  challenge, emits progress.record then progress.unlock per unlock. Returns null (and
     *  logs W-PRG-SKIPPED) when the summary is unusable (judged === 0 and completion === 0). */
    record(summary /* PerformanceSummary */, meta /* RecordMeta */) /* -> RecordOutcome|null */,
    // RecordMeta { mode:'instrument'|'dance'|'multiplayer', difficulty:string, songTitle:string,
    //   instrument:number|null /* 0-128, null for dance */, profile:string|null, speed:number,
    //   endedBy:'end'|'user'|'fail'|'net', failed:boolean, durationS:number,
    //   settingsSnapshot:{judgmentPreset, inputOffsetMs, audioLatencyMs, visualLeadMs, strayPressPenalty},
    //   players:Array<{displayName, score, accuracy, maxCombo}>|null }
    // RecordOutcome { record:PerformanceRecord, isBest:boolean, previousBest:number|null,
    //   unlocked:string[] /* achievement and cosmetic ids */, daily:{matched:boolean, completed:boolean}|null,
    //   saved:boolean }

    /** Newest first. query {mode, songId, chartHash, instrument, difficulty, comparableOnly,
     *  limit (default 50, max 500), offset (default 0)}; all filters optional. */
    history(query /* ?object */) /* -> PerformanceRecord[] (copies) */,
    /** Last n records (oldest first) for one chart: [{playedAt, score, accuracy, maxCombo, comparable}]. */
    trend(songId, chartHash, n /* default 20 */) /* -> object[] */,
    /** Differences b - a for two records (I 9.2 compare attempts). */
    compare(recordIdA, recordIdB) /* -> {score, accuracy, maxCombo, miss, completion}|null */,
    stats() /* -> HistoryStats (6.25.4 F) */,

    best(songId, chartHash) /* -> PersonalBest|null */,
    bests() /* -> {[key]: PersonalBest} copy */,

    ACHIEVEMENTS: /* frozen array of 20 Achievement (6.25.4 C) */ [],
    /** Catalog joined with state: [{...Achievement, unlockedAt:ISO|null, progress:{current, target}}]. */
    achievements() /* -> object[] */,
    UNLOCKS: /* frozen array of 10 Cosmetic (6.25.4 D) */ [],
    unlocks() /* -> [{...Cosmetic, unlockedAt:ISO|null, enabled:boolean}] */,
    isUnlocked(cosmeticId /* string */) /* -> boolean ('default' theme is always true) */,
    /** Effects only: player can switch an unlocked effect off and on. */
    setEffectEnabled(cosmeticId, on) /* -> {ok:boolean} */,
    effectEnabled(cosmeticId) /* -> boolean (unlocked and not disabled) */,

    /** Today's challenge (or for a given 'YYYYMMDD'); generated on first call per date. Null when
     *  no built-in song is registered. */
    daily(date /* ?string */) /* -> DailyChallenge|null */,
    dailySeed(date /* 'YYYYMMDD' */) /* -> number uint32 = fnv1a32('daily|' + date) */,
    localDate(d /* ?Date */) /* -> 'YYYYMMDD' from the local calendar date */,

    /** Pure: which achievements a new record unlocks given the state before it. */
    evaluate(record /* PerformanceRecord */, state /* UnlockState */) /* -> string[] achievement ids */,
    /** Pure: maximum score for `total` judgments (all perfect; BRIEF 6 multiplier). */
    maxScoreFor(total /* int */) /* -> int */,
    /** Pure: newest-first records trimmed to LIMITS.maxRecords (oldest removed). */
    prune(records /* PerformanceRecord[] */) /* -> PerformanceRecord[] */,
    counters() /* -> UnlockState.counters copy */,

    /** Part 5.7 shape per document kind ('history'|'bests'|'unlocks'|'daily'); empty MIGRATIONS. */
    migrate(doc, kind) /* -> {ok, doc, applied:string[], error} */,
    /** Clears history and bests ('history') or every progression document ('all'); the UI
     *  confirms first ("This deletes your local results. Achievements are kept." / "...and
     *  achievements and unlocks."). */
    reset(scope /* 'history'|'all' */) /* -> Promise<{ok:boolean, error:StoError|null}> */,
    readOnly() /* -> boolean (a stored document is newer than this build) */
  };
});
```

Events emitted: `progress.record {record, isBest, previousBest}` (Part 4.4) once per
`record()`; `progress.unlock {kind:'achievement' or 'cosmetic', id, title, description}` per
newly unlocked item, achievements first in catalog order, then their cosmetics.

Events consumed (subscribed in `init`, owner `'progress'`, kept for the page lifetime):
`studio.take` with `status:'complete'` -> `counters.takesRecorded++`; `import.done` ->
`counters.filesImported++`. Both re-run `evaluate`-style checks for `recordTake` and
`importFile` achievements.

#### 6.25.3 Internal state

```js
docs = {
  history: { version: 1, records: [PerformanceRecord] /* newest first, <= 500 */ },
  bests:   { version: 1, bests: { ['<songId>|<chartHash>']: PersonalBest } },
  unlocks: UnlockState,   // Part 5.13 plus the extension fields below
  daily:   DailyChallenge|null
}
UnlockState {
  version: 1,
  achievements: { [achId]: ISO },        // unlock time
  cosmetics:    { [cosmeticId]: ISO },
  counters: { clears, danceClears, practiceMinutes, dailyCompleted, takesRecorded, filesImported,
              practiceCarryS /* extension: seconds below one minute not yet counted */ },
  disabledEffects: [cosmeticId]          // extension: effects the player switched off
}
readOnlyKinds: Set<'history'|'bests'|'unlocks'|'daily'>   // newer-version documents
writeFailedOnce: boolean                 // toast shown at most once per page life
```

Invariants:
1. `records` is newest first, length <= 500, serialized size <= 512 KB.
2. A `PersonalBest` exists only for keys that have at least one comparable record (at the time
   it was recorded; pruning a record never removes a best).
3. `achievements[id]` and `cosmetics[id]` are only ever added, never removed, except by
   `reset('all')`.
4. `evaluate` is pure and deterministic: the same record and state give the same ids in
   catalog order.
5. Gameplay modules never read progression state: unlocks change appearance only (I 9.3).

#### 6.25.4 Algorithms

6.25.4 A. Building and storing a record

```text
record(summary, meta):
  if summary.judged === 0 and summary.completion === 0: Log.warn('W-PRG-SKIPPED'); return null
  dance = meta.difficulty in ('easy', 'normal', 'hard')
  rec = { id: 'perf_' + uid(), playedAt: new Date().toISOString(), mode: meta.mode,
          songId: summary.songId, songTitle: truncate(meta.songTitle, 120) or 'Untitled',
          chartHash: summary.settingsHash, instrument: dance ? null : meta.instrument,
          difficulty: meta.difficulty, profile: dance ? null : meta.profile,
          score: summary.score, accuracy: summary.accuracy, maxCombo: summary.maxCombo,
          counts: copy(summary.counts), judged: summary.judged, total: summary.total,
          completion: summary.completion, durationS: round1(meta.durationS),
          speed: meta.speed, settingsSnapshot: copy(meta.settingsSnapshot),
          comparable: false, players: meta.players, version: 1 }
  rec.comparable = rec.settingsSnapshot.judgmentPreset === 'standard' and rec.speed === 1.0
                   and rec.completion === 1 and summary.comparable !== false and !meta.failed
  clear = rec.comparable and meta.endedBy === 'end'
  before = deepClone(docs.unlocks)
  counters: if clear: clears++; if clear and dance: danceClears++
            practiceCarryS += rec.durationS; practiceMinutes += floor(practiceCarryS / 60);
            practiceCarryS = practiceCarryS mod 60
  best update (6.25.4 B); daily check (6.25.4 E)
  ids = evaluate(rec, before-with-updated-counters)    // achievements newly met
  unlock each id (achievements[id] = now); for each reward cosmetic not yet unlocked: cosmetics[c] = now
  docs.history.records = prune([rec, ...records]); persist all changed docs (6.25.4 G)
  emit progress.record {record: rec, isBest, previousBest}; emit progress.unlock per id
  return {record: rec, isBest, previousBest, unlocked, daily, saved}
```

`summary.comparable` (6.9.4 G) is false for custom windows, stray penalty and mid-run
calibration changes, and M-23 sets it false for dance practice; the record keeps the stricter
of both rules. The record's `difficulty` is the mode's own name (`meta.difficulty`), not the
judge window name a dance summary carries.

6.25.4 B. Personal bests

```text
key = rec.songId + '|' + rec.chartHash
if rec.comparable:
  b = bests[key]
  previousBest = b ? b.score : null
  isBest = !b or rec.score > b.score
  if !b: bests[key] = {score, accuracy, maxCombo, recordId: rec.id, playedAt: rec.playedAt}
  else:  if rec.score > b.score: b.score = rec.score; b.recordId = rec.id; b.playedAt = rec.playedAt
         b.accuracy = max(b.accuracy, rec.accuracy); b.maxCombo = max(b.maxCombo, rec.maxCombo)
else: isBest = false; previousBest = bests[key]?.score ?? null
```

Equal scores do not replace the best (the earlier record keeps it). Results with a
non-standard judgment preset, practice speed, failure or incomplete runs appear in the
history marked "Practice result" and never in bests (P 5.3: accessibility adjustments are
distinguished where they affect scoring).

6.25.4 C. Achievement catalog (`ACHIEVEMENTS`, 20 entries)

Condition semantics (all evaluated on the new record `r` and the counters after the update;
"comparable clear" means `r.comparable && endedBy === 'end'`; instrument groups use
`INSTRUMENT_GROUPS`, 128 = drum kit; dance records are those with a dance difficulty):

| # | id | title | description | condition | reward |
|---|---|---|---|---|---|
| 1 | ach-first-song | First Song | Clear any instrument chart. | `firstClear {mode:'instrument'}`: comparable clear of a non-dance record | none |
| 2 | ach-first-dance | First Steps | Clear any dance chart. | `danceClear {}`: comparable clear of a dance record | theme-club |
| 3 | ach-clears-10 | Regular | Clear 10 charts. | `clearsCount {min:10}`: `counters.clears >= 10` | theme-neon |
| 4 | ach-accuracy-90 | Sharp | Clear a chart with at least 90 percent accuracy. | `accuracyAtLeast {min:0.90}` on a comparable clear | acc-color-glasses |
| 5 | ach-accuracy-98 | Precise | Clear an advanced, expert or hard chart with at least 98 percent accuracy. | `accuracyAtLeast {min:0.98, difficulties:['advanced','expert','hard']}` | none |
| 6 | ach-combo-50 | On a Roll | Reach a combo of 50. | `comboAtLeast {min:50}`: comparable record with `maxCombo >= 50` | acc-color-wristband |
| 7 | ach-combo-200 | Unbroken | Reach a combo of 200. | `comboAtLeast {min:200}` | fx-sparks-plus |
| 8 | ach-full-combo | Full Combo | Clear a chart without a single miss. | `comboAtLeast {full:true}`: comparable clear with `counts.miss === 0` and `total >= 20` | acc-color-hat |
| 9 | ach-keys | Keys Player | Clear a chart on a keyboard or synth instrument. | `instrumentFamily {group:'keys'}` on a comparable clear | none |
| 10 | ach-guitar | Six Strings | Clear a chart on a guitar. | `instrumentFamily {group:'guitar'}` | none |
| 11 | ach-bass | Low End | Clear a chart on a bass. | `instrumentFamily {group:'bass'}` | none |
| 12 | ach-drums | Backbeat | Clear a chart on drums. | `instrumentFamily {group:'drums'}` | none |
| 13 | ach-full-band | Full Band | Clear charts on keys, guitar, bass and drums. | `instrumentFamily {group:'all'}`: achievements 9-12 all unlocked (including those unlocked by this record) | theme-sunset |
| 14 | ach-dance-hard | Fast Feet | Clear a hard dance chart. | `danceClear {difficulty:'hard'}` | none |
| 15 | ach-dance-smooth | Smooth Moves | Clear a dance chart with at least 95 percent accuracy. | `danceClear {minAccuracy:0.95}` | fx-trails |
| 16 | ach-practice-30 | Practice Makes Progress | Play songs for 30 minutes in total. | `practiceMinutes {min:30}`: `counters.practiceMinutes >= 30` (all recorded runs count, practice included) | none |
| 17 | ach-daily-1 | Daily Player | Complete a daily challenge. | `dailyCount {min:1}` | none |
| 18 | ach-daily-7 | Weekly Habit | Complete 7 daily challenges. | `dailyCount {min:7}` | acc-color-scarf |
| 19 | ach-record-take | Recording Artist | Record a complete take in the Studio. | `recordTake {min:1}`: `counters.takesRecorded >= 1` | acc-color-headphones |
| 20 | ach-import | Crate Digger | Import a music file. | `importFile {min:1}`: `counters.filesImported >= 1` | none |

```text
evaluate(r, state):
  out = []
  for a in ACHIEVEMENTS (catalog order): if state.achievements[a.id]: continue
    if met(a.condition, r, state, out): out.push(a.id)       // 'all' sees ids pushed earlier in this call
  return out
achievements().progress: current/target for counted conditions (clears, practiceMinutes,
  dailyCount, recordTake, importFile, full-band groups 0..4); boolean conditions report 0 or 1 of 1
```

Counter-only achievements (16-20) are also checked when `studio.take`, `import.done` or a
daily completion changes a counter outside `record()`.

6.25.4 D. Cosmetic catalog (`UNLOCKS`, 10 entries)

| id | kind | title | Effect (rendering owner) | Unlocked by |
|---|---|---|---|---|
| theme-neon | stageTheme | Neon Stage | stage palette: magenta and cyan rim lights, dark floor (M-21) | ach-clears-10 |
| theme-club | stageTheme | Club Stage | warm amber lights, wood floor, low ceiling truss (M-21) | ach-first-dance |
| theme-sunset | stageTheme | Sunset Stage | orange-to-purple sky backdrop, open-air floor (M-21) | ach-full-band |
| acc-color-hat | accessoryColor | Gold Hat | hat colors `#d4af37` and `#c0c0c0` selectable (M-22, M-19) | ach-full-combo |
| acc-color-glasses | accessoryColor | Mirror Glasses | glasses colors `#c0c0c0` and `#2f6fdf` | ach-accuracy-90 |
| acc-color-headphones | accessoryColor | Studio Headphones | headphones colors `#e03c31` and `#f2f2f2` | ach-record-take |
| acc-color-scarf | accessoryColor | Striped Scarf | scarf colors `#e8b923` and `#2a9d8f` | ach-daily-7 |
| acc-color-wristband | accessoryColor | Glow Wristband | wristband colors `#39ff14` and `#ff4fd8` | ach-combo-50 |
| fx-sparks-plus | effect | Big Sparks | larger judgment spark bursts; only at `video.effectsLevel` 2 (M-21) | ach-combo-200 |
| fx-trails | effect | Motion Trails | hand motion trails on performers; `effectsLevel` >= 1 and not in reduced motion (M-21) | ach-dance-smooth |

Application rules: `video.stageTheme` (Part 5.11) may name `default` or an unlocked theme;
SCR-Settings and SCR-Characters list locked items disabled with "Unlocked by: <achievement
title>" (P 15 disabled controls explain why). An accessory color is stored on the character as
`x.accColors[<accessory>] = '#rrggbb'` (CharacterConfig `x` namespace, Part 5.5) and is used
only when the cosmetic is unlocked; otherwise the default accessory color renders. Effects are
on when unlocked unless listed in `disabledEffects`. None of these values reach `Chart`,
`Judge`, `Transport` or `Audio` (I 9.3).

6.25.4 E. Daily challenge

```text
localDate(d = new Date()) = pad4(d.getFullYear()) + pad2(d.getMonth() + 1) + pad2(d.getDate())
daily(date = localDate()):
  if docs.daily and docs.daily.date === date: return copy(docs.daily)
  ids = Project.Catalog.list().filter(e => e.builtIn).map(e => e.id).sort()   // demo-dance, demo-electro, demo-jazz, demo-piano, demo-poprock
  if ids.length === 0: return null
  seed = dailySeed(date); rng = new Core.Prng(seed)
  songId = ids[rng.int(ids.length)]
  mode = rng.int(4) < 3 ? 'instrument' : 'dance'
  if mode === 'instrument':
    song = Project.Catalog.getSong(songId)
    insts = sorted distinct (t.isDrums ? 128 : t.program) over MIDI tracks with >= 16 notes
    instrument = insts[rng.int(insts.length)]
    difficulty = ['intermediate', 'advanced'][rng.int(2)]
  else: instrument = null; difficulty = ['normal', 'hard'][rng.int(2)]
  type = ['accuracy', 'combo', 'score'][rng.int(3)]
  value = type === 'accuracy' ? 850 + 10 * rng.int(11)     // permille 850..950
        : type === 'combo'    ? 20 + 5 * rng.int(9)        // 20..60
        :                       60 + 5 * rng.int(7)        // percent of max score 60..90
  docs.daily = {date, seed, songId, mode, instrument, difficulty, goal:{type, value},
                completedAt: null, bestResult: null}
  persist daily; return copy

in record(): d = daily(localDate(new Date(rec.playedAt)))
  matched = d and rec.songId === d.songId and rec.difficulty === d.difficulty and
            (d.mode === 'dance' ? isDance(rec) : !isDance(rec) and rec.instrument === d.instrument
             and rec.profile === 'A') and rec.comparable
  if matched:
    if !d.bestResult or rec.score > d.bestResult.score: d.bestResult = {score, accuracy, maxCombo, recordId}
    met = type accuracy: round(rec.accuracy * 1000) >= value
          type combo:    rec.maxCombo >= value
          type score:    rec.score >= ceil(value * maxScoreFor(rec.total) / 100)
    if met and !d.completedAt: d.completedAt = now ISO; counters.dailyCompleted++
```

The challenge depends only on the local date and the built-in catalog, so two devices with
the same date and build show the same challenge; changing the device clock changes the date
(local and harmless: the challenge is optional and grants only cosmetics). A daily from a
previous date is replaced on the first call of a new date; its completion was already
counted. SCR-MainMenu shows the challenge as one optional card ("Daily challenge: <song>,
<instrument or Dance>, <difficulty>: reach 90 percent accuracy") and SCR-QuickPlay can start
it with those settings (profile A).

```text
maxScoreFor(N) = 100 * ( min(N, 10) * 1 + clamp(N - 10, 0, 10) * 2
                       + clamp(N - 20, 0, 10) * 3 + max(0, N - 30) * 4 )
// maxScoreFor(0) = 0, maxScoreFor(10) = 1000, maxScoreFor(31) = 6400, maxScoreFor(100) = 34000
```

6.25.4 F. History view data

```js
HistoryStats {
  plays: int, clears: int, comparableClears: int, totalMinutes: int,
  averageAccuracyLast20: number|null,     // over the newest 20 comparable records
  byGroup: { keys: int, guitar: int, bass: int, drums: int, dance: int, other: int },   // plays
  bySong: [ { songId, songTitle, plays, bestScore: int|null, bestAccuracy: number|null } ]  // top 20 by plays
}
```
`trend` returns at most `LIMITS.trendPoints` points for one `(songId, chartHash)`; SCR-Results
draws them as a small line of accuracy values with the personal best marked ("Best" text label,
not color only). `compare` returns `b - a` deltas for SCR-Results "Compared with your best"
and "Compared with your last attempt" lines (I 9.2).

6.25.4 G. Persistence, caps and corruption

```text
load(kind): v = Storage.get(KEYS[kind], null)        // Storage.get removes an unparsable record and returns null
  if v === null: docs[kind] = empty(kind)
  else if !isObject(v) or typeof v.version !== 'number': docs[kind] = empty(kind); warn W-PRG-RESET
  else if v.version > 1: docs[kind] = v; readOnlyKinds.add(kind); warn W-PRG-NEWER
  else: m = migrate(v, kind) -> validate shape; invalid entries dropped one by one
        (W-PRG-RECORD-DROPPED with a count); unknown fields kept under x
persist(kind):
  if readOnlyKinds.has(kind): return {ok:false, skipped:true}
  text size check: history > 512 KB -> drop the oldest LIMITS.pruneStep records until it fits
  r = Storage.set(KEYS[kind], docs[kind])
  if !r.ok and r.error.code === 'E-STO-001' and kind === 'history':
     drop the oldest 50 records; retry once
  if still !r.ok: keep in memory; Log.warn('W-PRG-SAVE-FAILED', r.error.code);
     first time only: toast "Your results could not be saved (storage is full or blocked). They
     stay available until you close the game."
```

Size caps per Part 5.15: history 512 KB (500 records), bests 128 KB (when exceeded, the bests
whose newest record is oldest are removed first, `W-PRG-BESTS-PRUNED`), unlocks 16 KB, daily
4 KB. `empty('unlocks')` has every counter 0 and empty maps.

#### 6.25.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| storage unavailable or quota exceeded | `Storage.set` result `E-STO-001` or `E-STO-002` | in-memory history, bests, unlocks | next `record()` writes again | results of this session if the page closes | one toast per page life (6.25.4 G) | memory-only progression | next successful write persists everything | UT-25-19 |
| stored document corrupt | `Storage.get` null or failed shape check | other documents | n/a | the corrupt document's content | toast "Your local results could not be read and were reset." once | fresh document | fresh document | UT-25-20 |
| single invalid record inside history | per-record validation | other records | n/a | that record | none (logged with count) | n/a | record dropped | UT-25-20 |
| document from a newer version (Part 5.17) | `version > 1` | that document, read-only | n/a | none (not overwritten) | Library notice "History saved by a newer version" | read-only history; new results kept in memory only | update the game | UT-25-21 |
| unusable summary (nothing judged) | `judged === 0 and completion === 0` | all | n/a | none | none | no record | n/a | UT-25-01 |
| no built-in songs registered | `Catalog.list()` empty | all | n/a | none | menu card hidden; "Daily challenge unavailable" in Library | no daily | n/a | UT-25-16 |
| `progress.unlock` listener throws | Emitter isolation | progression state | n/a | none | ErrorReporter | toast missing | n/a | UT-25-14 |
| device date changed | `localDate` differs | completed dailies counted once | n/a | none | none | new challenge | n/a | UT-25-17 |

#### 6.25.6 Limits and performance notes

- `record()` is O(records) for the prune (500) plus O(20) for `evaluate`; target <= 2 ms plus
  the storage writes (history ~ 300 KB JSON, ~ 3 ms to stringify on desktop). The writes happen
  after the results screen is shown (M-28 calls `record` after `enter('results')` starts its
  render), so they never delay gameplay; nothing is written during playback (BRIEF 6 autosave
  rule spirit).
- About 600 bytes per record serialized; 500 records ~ 300 KB < 512 KB cap.
- `daily()` expands one built-in song (M-30 lazy expansion, <= 10 ms) on the first call per date.
- `init` reads four small keys synchronously through `Storage.get` (<= 5 ms).

#### 6.25.7 Spec coverage

I 9.1 (completion records, best accuracy and score, difficulty completion, personal bests,
instrument-specific and dance achievements, practice milestones, optional challenges, no tool
locking), I 9.2 (history with song, difficulty, instrument, score, accuracy and settings;
comparisons), I 9.3 (optional themes, avatar cosmetics, effects; no gameplay effect), I 9.4
(optional daily, no account), B 9.4 (statistics persisted per run), B 23.2 (no telemetry), E 11,
I 16.4 (progression versioning), P 5.3 (comparable results; adjustments distinguished), P 15
(locked items explain why), P 16 (failed saves never reported as success), P 19 (no silent
failure; bounded storage).

#### 6.25.8 Unit tests (group `progress`, file `src/91-test-progress.js`)

Harness: `FLM.SelfTest.fakes` in-memory storage (a fake with the `Storage.get` and `Storage.set` shape and injectable
write failures), a fake catalog with the five built-in ids and fixed track programs, a
`summary(opts)` builder producing a `PerformanceSummary`, and a fixed `Date` for `playedAt`.

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-25-01 | record shape | `record(summary({score:5000, judged:40, total:40}), meta)`; and a summary with judged 0 and completion 0 | every Part 5.13 field present with the right types; second call returns null and logs W-PRG-SKIPPED |
| UT-25-02 | comparable rule | variants: preset relaxed; speed 0.8; completion 0.9; failed; `summary.comparable:false` | all five `comparable:false`; baseline true |
| UT-25-03 | personal best update | comparable 5000, then 4800 with higher accuracy, then 5200 | best score 5000 -> 5000 (accuracy raised) -> 5200 with recordId of the third; `isBest` false, false, true; `previousBest` 5000 for the third |
| UT-25-04 | bests keyed by song and chart | same song with two chartHashes | two keys (song id joined with each hash by the bar character); non-comparable record creates no key |
| UT-25-05 | prune 500 | insert 520 records | 500 kept, newest first; the 20 oldest are gone; bests unchanged |
| UT-25-06 | achievement catalog integrity | `ACHIEVEMENTS`, `UNLOCKS` | 20 unique ids matching `^ach-[a-z0-9-]+$`; every condition type in the Part 5.13 enum; every reward id exists in `UNLOCKS`; each of the 10 cosmetics rewarded exactly once; titles <= 40 and descriptions <= 120 chars; frozen |
| UT-25-07 | first clear and dance clear | first comparable instrument clear; then a dance clear | `ach-first-song`; then `ach-first-dance` and cosmetic `theme-club` unlocked, `progress.unlock` emitted twice |
| UT-25-08 | combo and full combo | maxCombo 55 practice record (comparable false); comparable 55; comparable clear 0 misses total 25 | nothing; `ach-combo-50`; `ach-full-combo` |
| UT-25-09 | clears count | 10 comparable clears | `ach-clears-10` unlocked at the 10th exactly; `theme-neon` unlocked |
| UT-25-10 | instrument groups and full band | clears on program 0, 25, 33, then 128 | ach-keys, ach-guitar, ach-bass, then ach-drums and ach-full-band in the same call (catalog order) |
| UT-25-11 | dance achievements | dance hard clear accuracy 0.96 | `ach-dance-hard` and `ach-dance-smooth`; `fx-trails` unlocked |
| UT-25-12 | practice minutes carry | records of 50 s, 50 s, 40 s | practiceMinutes 0, 1, 2; practiceCarryS 50, 40, 20 |
| UT-25-13 | counters from events | emit `studio.take {status:'complete'}` twice and `{status:'aborted'}` once; emit `import.done` | takesRecorded 2; filesImported 1; `ach-record-take` and `ach-import` unlocked |
| UT-25-14 | unlock state and listener isolation | unlock fx-sparks-plus; `setEffectEnabled('fx-sparks-plus', false)`; a throwing `progress.unlock` listener | `isUnlocked` true, `effectEnabled` false; `isUnlocked('default')` true; record still saved |
| UT-25-15 | daily seed determinism | `dailySeed('20261026')` twice; `daily('20261026')` twice on fresh state | equal seeds equal to `fnv1a32` of the text daily, a bar character and 20261026; identical challenge objects |
| UT-25-16 | daily ranges and variety | `daily(d)` for 365 consecutive dates | songId in the 5 ids; mode ratio instrument between 0.65 and 0.85; difficulty per mode enum; goal values in range and on their steps; empty catalog -> null |
| UT-25-17 | daily completion | matching comparable record meeting the goal, then a second one | completedAt set once; dailyCompleted 1; non-matching instrument record does not count; profile B record does not count |
| UT-25-18 | maxScoreFor | 0, 10, 31, 100 | 0, 1000, 6400, 34000 |
| UT-25-19 | storage failure keeps memory | fake `Storage.set` fails with E-STO-001 on history | `record` returns `saved:false`; `history()` still contains the record; toast requested once over two failures; history retried after pruning 50 |
| UT-25-20 | corrupt documents | `Storage.get` returns a string for history; one record with `score:'x'` | history reset with W-PRG-RESET; bad record dropped with W-PRG-RECORD-DROPPED, others kept |
| UT-25-21 | newer version is read-only | stored history `version:2` | `readOnly()` true; `record()` keeps the result in memory; `Storage.set` never called for history |
| UT-25-22 | history query, trend, compare, stats | 30 mixed records | filters by mode and chart; limit/offset; trend <= 20 points oldest first; compare deltas; `stats().byGroup` sums to plays |
| UT-25-23 | cosmetics do not affect gameplay | unlock every cosmetic, then replay a fixed input log through `Rhythm.replay` | ScoreState identical to the run before unlocking |

#### 6.25.9 Implementation notes and browser quirks

- Storage key names: the four Part 5.15 keys (`flm.v1.progress.history`, `.bests`,
  `.unlocks`, `.daily`, also listed in 6.16.3), through `Storage.get` and `Storage.set` with
  the name without prefix (`Storage.keys()` reports names without the prefix, 6.16.2).
- `localDate` must use the local calendar (`getFullYear`, `getMonth`, `getDate`), never
  `toISOString()` (UTC would change the daily at the wrong hour).
- Never block on writes inside a gameplay frame: `record()` is called from the results
  transition only.
- `PerformanceRecord.speed` stores the speed actually used; Transport allows 0.25..2.0 and
  Part 5.13 lists 0.25-2.0; the record keeps the true value.
- Achievement and cosmetic titles are ASCII and rendered with `textContent`.
