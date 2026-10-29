// 91-test-rhythm.js - unit tests for M-09 FLM.Rhythm (group 'rhythm'; test build only).
// UT-09-01 to UT-09-36 follow Part 6.9.8 (UT-09-08 expects 6400 as IT-003 does, LEDGER decision). The judge halves of
// TT-023, TT-024, TT-026 and TT-029 are included because their harness is this one; IT-003, IT-004, IT-035 and the
// real-clock part of TT-023 run in 92-test-integration.js (T03.10). Every test here uses a fixed time map, no clock.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('rhythm', (t) => {
  const Rhythm = FLM.Rhythm;
  const Core = FLM.Core;
  const Model = FLM.Model;
  const TICKS_PER_SECOND = 1920;           // 120 BPM at PPQ 960
  const BAR = 3840;
  const ZERO_CALIBRATION = { inputOffsetMs: 0, audioLatencyMs: 0 };
  const LISTENER_FAILURE = 'judge-listener-failed-UT-09-30';
  const judges = [];

  t.afterEach(() => {
    judges.splice(0).forEach((judge) => judge.dispose());
  });

  // ------------------------------------------------------------------------------------------- fixtures
  /** Fixed time map: tick -> seconds at `ticksPerSecond` (960 = practice speed 0.5). `positionTick` feeds resume. */
  function makeMap(ticksPerSecond) {
    const rate = ticksPerSecond || TICKS_PER_SECOND;
    const map = {
      positionTick: 0,
      audioTimeAt: (tick) => tick / rate,
      tickAt: (seconds) => seconds * rate,
      position: () => map.positionTick
    };
    return map;
  }

  const tickOf = (ms) => Math.round(ms * TICKS_PER_SECOND / 1000);

  function note(id, lanes, ms, durationMs, isHold) {
    return {
      id, tick: tickOf(ms), durTicks: durationMs === undefined ? 1 : tickOf(durationMs), lanes: [].concat(lanes),
      sourceEventIds: [], pitches: [60], isHold: Boolean(isHold)
    };
  }

  const single = (id, lane, ms) => note(id, lane, ms);
  const chord = (id, lanes, ms) => note(id, lanes, ms);
  const hold = (id, lane, ms, durationMs) => note(id, lane, ms, durationMs, true);

  function chartOf(notes, difficulty) {
    return {
      id: 'song:test', songId: 'song', trackId: 'track', instrument: 0, difficulty: difficulty || 'beginner',
      profile: 'A', notes, generatorVersion: 1, settingsHash: '00000000', omittedSourceEventIds: 0, source: 'generated'
    };
  }

  /** A judge on a private bus; `held` is the fake Input.held() answer. */
  function setup(notes, options) {
    const settings = options || {};
    const difficulty = settings.difficulty || 'beginner';
    const bus = new Core.Emitter();
    const emitted = { results: [], scores: [], finished: [] };
    bus.on('judge.result', (result) => emitted.results.push(result));
    bus.on('score.update', (payload) => emitted.scores.push(payload));
    bus.on('chart.finished', (payload) => emitted.finished.push(payload));
    const input = { lanes: [], held() { return this.lanes.map((lane) => 'lane' + lane); } };
    const map = settings.timeMap || makeMap();
    const judge = Rhythm.Judge.bind({
      timeMap: map, bus, input, strayPenalty: settings.strayPenalty, windowsPreset: settings.windowsPreset,
      followCalibration: false
    });
    judges.push(judge);
    const song = Model.Song.create({ durationTicks: settings.durationTicks || 8 * BAR, markers: settings.markers });
    judge.load(chartOf(notes, difficulty), song, settings.windows || difficulty);
    judge.setCalibration(settings.calibration || ZERO_CALIBRATION);
    if (settings.active !== false) judge.setActive(true);
    return { judge, bus, emitted, input, map, song, difficulty };
  }

  function eventOf(lane, type, ms) {
    return {
      source: 'synthetic', control: 'lane' + lane, type, tPerf: ms, tAudio: ms / 1000,
      pressure: type === 'press' ? 1 : 0
    };
  }

  const press = (h, lane, ms) => h.judge.onInput(eventOf(lane, 'press', ms));
  const release = (h, lane, ms) => h.judge.onInput(eventOf(lane, 'release', ms));
  const judgmentsOf = (h) => h.judge.results().map((result) => result.judgment);

  /** Notes on lane `lane` at 1000 ms, 2000 ms, ... one per offset; returns [notes, pressMsList]. */
  function spreadNotes(lane, count) {
    const notes = [];
    for (let index = 0; index < count; index += 1) notes.push(single('n' + (index + 1), lane, (index + 1) * 1000));
    return notes;
  }

  // ------------------------------------------------------------------------------------------- UT-09-01..07
  t.test('UT-09-01 windows table', () => {
    t.deepEq(Rhythm.windowsFor('beginner'), { perfect: 45, great: 90, good: 135 });
    t.deepEq(Rhythm.windowsFor('intermediate'), { perfect: 35, great: 70, good: 110 });
    t.deepEq(Rhythm.windowsFor('advanced'), { perfect: 25, great: 55, good: 90 });
    t.deepEq(Rhythm.windowsFor('expert'), { perfect: 18, great: 40, good: 70 });
    t.throws(() => Rhythm.windowsFor('impossible'), 'E-INP-011');
    t.throws(() => Rhythm.windowsFor('expert', 'turbo'), 'E-INP-011');
    t.deepEq(Rhythm.windowsFor('beginner', 'relaxed'), { perfect: 68, great: 135, good: 203 });
    t.deepEq(Rhythm.windowsFor('beginner', 'strict'), { perfect: 34, great: 68, good: 101 });
    const copy = Rhythm.windowsFor('beginner');
    copy.perfect = 1;
    t.eq(Rhythm.WINDOWS.beginner.perfect, 45, 'windowsFor returns a copy');
    t.ok(Object.isFrozen(Rhythm.WINDOWS) && Object.isFrozen(Rhythm.WINDOWS.expert), 'WINDOWS is deep-frozen');
    t.ok(Object.isFrozen(Rhythm.SCORING) && Object.isFrozen(Rhythm.SCORING.points), 'SCORING is deep-frozen');
    t.deepEq(Rhythm.POINTS, { perfect: 100, great: 70, good: 40, miss: 0 });
    t.eq(Rhythm.CHORD_TOLERANCE_MS, 50);
    t.eq(Rhythm.judgmentFor(45, Rhythm.WINDOWS.beginner), 'perfect');
    t.eq(Rhythm.judgmentFor(46, Rhythm.WINDOWS.beginner), 'great');
    t.eq(Rhythm.judgmentFor(136, Rhythm.WINDOWS.beginner), null);
    t.eq(Rhythm.laneOf('lane3'), 3);
    t.eq(Rhythm.laneOf('dance0'), 0);
    t.eq(Rhythm.laneOf('lane4'), -1);
    t.eq(Rhythm.laneOf('KeyA'), -1);
    t.eq(Rhythm.laneOf(undefined), -1);
  });

  t.test('UT-09-02 load validation', () => {
    const h = setup([single('a', 0, 1000)]);
    const badLoad = (chart) => t.throws(() => h.judge.load(chart, h.song, 'beginner'), 'E-INP-012');
    badLoad(chartOf([single('a', 4, 1000)]));
    badLoad(chartOf([single('a', 0, 2000), single('b', 0, 1000)]));
    badLoad(chartOf([single('a', 0, 1000), single('a', 1, 2000)]));
    badLoad(chartOf([{ id: 'x', tick: 0, durTicks: 1, lanes: [2, 1] }]));
    badLoad({ notes: 'no' });
    t.eq(h.judge.state().total, 1, 'the previous chart stays loaded');
    t.eq(press(h, 0, 1000).judgment, 'perfect');
  });

  t.test('UT-09-03 boundary exactly +window (beginner)', () => {
    const h = setup(spreadNotes(0, 3));
    t.eq(press(h, 0, 1045).judgment, 'perfect');
    t.eq(press(h, 0, 2090).judgment, 'great');
    t.eq(press(h, 0, 3135).judgment, 'good');
  });

  t.test('UT-09-04 boundary exactly -window (beginner)', () => {
    const h = setup(spreadNotes(0, 3));
    const hits = [press(h, 0, 955), press(h, 0, 1910), press(h, 0, 2865)];
    t.deepEq(hits.map((result) => result.judgment), ['perfect', 'great', 'good']);
    t.deepEq(hits.map((result) => result.deltaMs), [-45, -90, -135]);
  });

  t.test('UT-09-05 one past each boundary', () => {
    const h = setup(spreadNotes(0, 3));
    t.eq(press(h, 0, 1046).judgment, 'great');
    t.eq(press(h, 0, 2091).judgment, 'good');
    t.eq(press(h, 0, 3136), null);
    t.eq(h.judge.state().stray, 1);
    t.deepEq(judgmentsOf(h), ['great', 'good', 'miss'], 'the third note closed unplayed');
  });

  t.test('UT-09-06 expert windows', () => {
    const h = setup(spreadNotes(0, 6), { difficulty: 'expert' });
    const presses = [18, 19, 40, 41, 70, 71].map((offset, index) => press(h, 0, (index + 1) * 1000 + offset));
    t.deepEq(presses.slice(0, 5).map((result) => result.judgment), ['perfect', 'great', 'great', 'good', 'good']);
    t.eq(presses[5], null);
    t.eq(h.judge.state().stray, 1);
  });

  t.test('UT-09-07 rounding symmetry', () => {
    const h = setup([single('a', 0, 1000), single('b', 0, 2000)]);
    const late = press(h, 0, 1045.5);
    const early = press(h, 0, 1954.5);
    t.eq(late.deltaMs, 46);
    t.eq(early.deltaMs, -46);
    t.deepEq([late.judgment, early.judgment], ['great', 'great']);
    t.eq(Rhythm.roundMs(0.4), 0);
    t.eq(Rhythm.roundMs(-0.4), 0);
    t.eq(Rhythm.roundMs(-0.5), -1);
    t.eq(Rhythm.roundMs(0.5), 1);
    t.eq(Rhythm.roundMs(-45.5), -46);
  });

  // ------------------------------------------------------------------------------------------- UT-09-08..10
  t.test('UT-09-08 points and multiplier (31 perfect notes score 6400, as IT-003)', () => {
    const notes = [];
    for (let index = 0; index < 31; index += 1) notes.push(single('n' + index, index % 4, (index + 1) * 500));
    const h = setup(notes, { difficulty: 'intermediate' });
    notes.forEach((item, index) => press(h, index % 4, (index + 1) * 500));
    const state = h.judge.state();
    t.eq(state.score, 6400);
    t.eq(state.combo, 31);
    t.eq(state.maxCombo, 31);
    t.deepEq(state.counts, { perfect: 31, great: 0, good: 0, miss: 0 });
    t.deepEq([state.judged, state.total, state.accuracy, state.completion], [31, 31, 1, 1]);
    t.deepEq([0, 9, 10, 19, 20, 29, 30, 99].map(Rhythm.Score.multiplierFor), [1, 1, 2, 2, 3, 3, 4, 4]);
  });

  t.test('UT-09-09 miss resets combo, multiplier from combo before note', () => {
    const notes = [];
    for (let index = 0; index < 14; index += 1) notes.push(single('n' + index, index % 4, (index + 1) * 500));
    const h = setup(notes, { difficulty: 'intermediate' });
    for (let index = 0; index < 12; index += 1) press(h, index % 4, (index + 1) * 500);
    h.judge.tick(6.7);
    press(h, 13 % 4, 7000);
    const state = h.judge.state();
    t.eq(state.score, 1500);
    t.eq(state.combo, 1);
    t.eq(state.maxCombo, 12);
    t.eq(state.counts.miss, 1);
  });

  t.test('UT-09-10 accuracy and completion', () => {
    const h = setup(spreadNotes(0, 4));
    press(h, 0, 1000);
    press(h, 0, 2090);
    press(h, 0, 3135);
    h.judge.tick(4.2);
    const state = h.judge.state();
    t.eq(state.pointsSum, 210);
    t.eq(state.accuracy, 0.525);
    t.eq(state.completion, 1);
    t.deepEq(state.counts, { perfect: 1, great: 1, good: 1, miss: 1 });
    t.eq(Rhythm.Score.create(0, []).state().accuracy, 0, 'accuracy is 0 when nothing is judged');
  });

  // ------------------------------------------------------------------------------------------- UT-09-11..16
  t.test('UT-09-11 miss by tick', () => {
    const h = setup([single('a', 0, 1000)]);
    t.deepEq(h.judge.tick(1.135), [], 'the window edge is still inside');
    const declared = h.judge.tick(1.136);
    t.eq(declared.length, 1);
    t.eq(declared[0].judgment, 'miss');
    t.eq(declared[0].tInput, null);
    t.eq(declared[0].deltaMs, null);
    t.deepEq(h.judge.tick(5), [], 'a miss is declared once');
  });

  t.test('UT-09-12 nearest-note candidate', () => {
    const h = setup([single('a', 0, 1000), single('b', 0, 1200)]);
    const result = press(h, 0, 1110);
    t.eq(result.noteId, 'b');
    t.eq(result.deltaMs, -90);
  });

  t.test('UT-09-13 missed then retried (E 4.2)', () => {
    const h = setup([single('a', 0, 1000)]);
    h.judge.tick(2.0);
    t.eq(press(h, 0, 2010), null);
    t.deepEq(judgmentsOf(h), ['miss']);
    t.eq(h.judge.state().stray, 1);
  });

  t.test('UT-09-14 chord all lanes within tolerance', () => {
    const h = setup([chord('c', [0, 2], 1000)]);
    t.eq(press(h, 0, 990), null);
    const result = press(h, 2, 1030);
    t.eq(result.judgment, 'perfect');
    t.eq(result.deltaMs, 30);
    t.deepEq(Array.from(result.lanes), [0, 2]);
    t.eq(h.judge.results().length, 1);
  });

  t.test('UT-09-15 chord lane beyond 50 ms tolerance', () => {
    const h = setup([chord('c', [0, 2], 1000)]);
    press(h, 0, 990);
    t.eq(press(h, 2, 1050), null);
    t.eq(h.judge.state().stray, 1);
    h.judge.tick(1.2);
    t.deepEq(judgmentsOf(h), ['miss']);
  });

  t.test('UT-09-16 chord missing lane after window', () => {
    const h = setup([chord('c', [0, 2], 1000)]);
    press(h, 0, 1000);
    h.judge.tick(1.2);
    t.deepEq(judgmentsOf(h), ['miss']);
    t.eq(h.judge.state().stray, 0);
  });

  // ------------------------------------------------------------------------------------------- UT-09-17..19
  t.test('UT-09-17 hold tail judged on release', () => {
    const h = setup([hold('h', 1, 0, 1000)]);
    t.eq(press(h, 1, 0).judgment, 'perfect');
    t.eq(release(h, 1, 1030), null);
    const results = h.judge.results();
    t.eq(results.length, 2);
    t.deepEq([results[1].part, results[1].judgment, results[1].deltaMs], ['tail', 'perfect', 30]);
    t.eq(results[1].tick, tickOf(1000));
    t.eq(h.judge.state().judged, 2);
  });

  t.test('UT-09-18 hold through a pause', () => {
    const h = setup([hold('h', 2, 0, 2000)]);
    press(h, 2, 0);
    h.judge.setActive(false, { tAudio: 0.5 });
    h.input.lanes = [2];
    h.map.positionTick = tickOf(500);
    h.judge.setActive(true);
    t.eq(h.judge.state().holdBreaks, 0);
    t.eq(h.judge.results().length, 1);
    const declared = h.judge.tick(3.0);
    t.deepEq(declared.map((result) => [result.part, result.judgment, result.deltaMs]), [['tail', 'perfect', 0]]);
  });

  t.test('UT-09-18 a hold released during the pause breaks at the resume position', () => {
    const h = setup([hold('h', 2, 0, 2000)]);
    press(h, 2, 0);
    h.judge.setActive(false, { tAudio: 0.5 });
    h.map.positionTick = tickOf(500);
    h.judge.setActive(true);
    const tail = h.judge.results()[1];
    t.deepEq([tail.part, tail.judgment, tail.deltaMs], ['tail', 'miss', -1500]);
    t.eq(h.judge.state().holdBreaks, 1);
  });

  t.test('UT-09-19 early release = hold break, head kept', () => {
    const h = setup([hold('h', 1, 0, 1000)]);
    const head = press(h, 1, 0);
    release(h, 1, 400);
    const results = h.judge.results();
    t.ok(results[0] === head, 'the head result is unchanged');
    t.deepEq([results[1].part, results[1].judgment, results[1].deltaMs], ['tail', 'miss', -600]);
    const state = h.judge.state();
    t.eq(state.holdBreaks, 1);
    t.eq(state.combo, 0);
    t.eq(state.counts.perfect, 1);
  });

  // ------------------------------------------------------------------------------------------- UT-09-20..26
  t.test('UT-09-20 stall does not reorder', () => {
    const notes = [single('a', 0, 1000), single('b', 1, 1200)];
    const stalled = setup(notes);
    press(stalled, 1, 1190);
    const summary = stalled.judge.results().map((result) => [result.noteId, result.judgment]);
    t.deepEq(summary, [['a', 'miss'], ['b', 'perfect']]);
    const steady = setup(notes);
    for (let ms = 10; ms < 1190; ms += 10) steady.judge.tick(ms / 1000);
    press(steady, 1, 1190);
    t.deepEq(steady.judge.results(), stalled.judge.results());
    t.deepEq(steady.judge.state(), stalled.judge.state());
  });

  t.test('UT-09-21 inactive ignores inputs', () => {
    const h = setup([single('a', 0, 1000)], { active: false });
    t.eq(press(h, 0, 1000), null);
    t.deepEq(h.judge.tick(5), []);
    t.eq(h.judge.state().stray, 0);
    t.eq(h.judge.results().length, 0);
    const log = h.judge.inputLog();
    t.eq(log[log.length - 1].ignored, true);
  });

  t.test('UT-09-22 stray penalty option', () => {
    const notes = spreadNotes(0, 3);
    const penalized = setup(notes, { strayPenalty: 'combo' });
    [1000, 2000, 3000].forEach((ms) => press(penalized, 0, ms));
    press(penalized, 3, 9000);
    t.eq(penalized.judge.state().combo, 2);
    t.eq(penalized.judge.state().lastStrayLane, 3);
    t.eq(penalized.judge.summary().comparable, false);
    const forgiving = setup(notes);
    [1000, 2000, 3000].forEach((ms) => press(forgiving, 0, ms));
    press(forgiving, 3, 9000);
    t.eq(forgiving.judge.state().combo, 3, 'the default keeps the combo');
    t.eq(forgiving.judge.summary().comparable, true);
    t.throws(() => Rhythm.Judge.bind({ strayPenalty: 'harsh' }), 'E-GEN-004');
  });

  t.test('UT-09-23 calibration applied once', () => {
    const h = setup([single('a', 0, 1000)], { calibration: { inputOffsetMs: 30, audioLatencyMs: 20 } });
    const evt = Object.freeze(eventOf(0, 'press', 1050));
    const result = h.judge.onInput(evt);
    t.eq(result.deltaMs, 0);
    t.eq(result.judgment, 'perfect');
    t.eq(evt.tAudio, 1.05, 'the event itself is never changed');
    t.deepEq(h.judge.summary().calibration, { inputOffsetMs: 30, audioLatencyMs: 20 });
  });

  t.test('UT-09-24 custom windows refuse narrower', () => {
    const h = setup([single('a', 0, 1000)], { difficulty: 'expert' });
    t.throws(() => h.judge.setWindows({ perfect: 10, great: 40, good: 70 }, 'custom'), 'E-INP-011');
    t.throws(() => h.judge.setWindows({ perfect: 20, great: 10, good: 70 }, 'custom'), 'E-INP-011');
    t.throws(() => h.judge.setWindows(Rhythm.windowsFor('expert'), 'turbo'), 'E-INP-011');
    h.judge.setWindows(Rhythm.windowsFor('expert', 'strict'), 'strict');
    t.eq(h.judge.summary().windowsPreset, 'strict');
    t.eq(h.judge.summary().comparable, false);
    h.judge.setWindows({ perfect: 60, great: 90, good: 150 }, 'custom');
    t.eq(h.judge.summary().windowsPreset, 'custom');
    t.eq(h.judge.summary().comparable, false);
    h.judge.setWindows(Rhythm.windowsFor('expert'), 'standard');
    t.eq(h.judge.summary().comparable, true);
  });

  t.test('UT-09-25 input without tAudio', () => {
    Core.Log.clear();
    const h = setup([single('a', 0, 1000)]);
    const withoutTime = { source: 'synthetic', control: 'lane0', type: 'press', tPerf: 1, tAudio: null, pressure: 1 };
    t.eq(h.judge.onInput(withoutTime), null);
    t.eq(h.judge.onInput(withoutTime), null);
    const warnings = Core.Log.entries().filter((entry) => entry.msg === 'RHY_NO_TAUDIO');
    t.eq(warnings.length, 1);
    t.eq(h.judge.state().stray, 0);
  });

  t.test('UT-09-26 NaN time map guard', () => {
    const h = setup([single('a', 0, 1000)], { timeMap: { audioTimeAt: () => NaN, tickAt: () => NaN } });
    t.eq(press(h, 0, 1000), null);
    t.deepEq(h.judge.tick(9), []);
    t.eq(h.judge.state().stray, 0);
    t.eq(h.judge.results().length, 0);
  });

  // ------------------------------------------------------------------------------------------- UT-09-27
  /** Small deterministic generator so the "random-ish" input log is the same on every run. */
  function seededRandom(seed) {
    let value = seed;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function denseNotes() {
    const notes = [];
    for (let index = 0; index < 140; index += 1) {
      const ms = 1000 + index * 200;
      if (index % 7 === 0) notes.push(chord('n' + index, [0, 2], ms));
      else if (index % 11 === 0) notes.push(hold('n' + index, index % 4, ms, 400));
      else notes.push(single('n' + index, index % 4, ms));
    }
    return notes;
  }

  function actionsFor(notes) {
    const random = seededRandom(20260101);
    const actions = [];
    notes.forEach((item) => {
      const ms = item.tick * 1000 / TICKS_PER_SECOND;
      if (random() < 0.15) return;
      const jitter = Math.round((random() - 0.5) * 160);
      item.lanes.forEach((lane, offset) => actions.push({ ms: ms + jitter + offset * 12, kind: 'press', lane }));
      if (!item.isHold) return;
      const heldFor = item.durTicks * 1000 / TICKS_PER_SECOND + Math.round((random() - 0.5) * 300);
      actions.push({ ms: ms + jitter + heldFor, kind: 'release', lane: item.lanes[0] });
    });
    for (let index = 0; index < 60; index += 1) {
      actions.push({ ms: Math.round(500 + random() * 29000), kind: 'press', lane: Math.floor(random() * 4) });
    }
    actions.push({ ms: 8000, kind: 'pause' }, { ms: 9000, kind: 'resume' });
    return actions.sort((a, b) => a.ms - b.ms);
  }

  function drive(h, action) {
    if (action.kind === 'pause') h.judge.setActive(false, { tAudio: action.ms / 1000 });
    else if (action.kind === 'resume') h.judge.setActive(true, { tAudio: action.ms / 1000, held: [] });
    else h.judge.onInput(eventOf(action.lane, action.kind, action.ms));
  }

  t.test('UT-09-27 replay determinism', () => {
    const notes = denseNotes();
    const calibration = { inputOffsetMs: 12, audioLatencyMs: 8 };
    const h = setup(notes, { difficulty: 'expert', calibration, durationTicks: 80 * BAR });
    const actions = actionsFor(notes);
    let nextTick = 0.5;
    actions.forEach((action) => {
      while (nextTick <= action.ms / 1000) {
        h.judge.tick(nextTick);
        nextTick += 0.037;
      }
      drive(h, action);
    });
    const log = h.judge.inputLog();
    t.ok(log.length >= 200, 'the log holds at least 200 entries, got ' + log.length);
    t.ok(log.some((entry) => entry.ignored === true), 'the pause ignored some inputs');
    const later = (latest, entry) => (Number.isFinite(entry.tAudio) ? Math.max(latest, entry.tAudio) : latest);
    const lastTime = log.reduce(later, 0);
    h.judge.tick(lastTime + 10);
    const replayed = Rhythm.replay(chartOf(notes, 'expert'), h.song, 'expert', log, calibration);
    t.ok(h.judge.results().length > 100, 'the run judged many notes');
    t.deepEq(replayed.results, h.judge.results());
    t.deepEq(replayed.state, h.judge.state());
    t.ok(h.judge.state().counts.miss > 0 && h.judge.state().stray > 0, 'the log has misses and strays');
  });

  // ------------------------------------------------------------------------------------------- UT-09-28..30
  t.test('UT-09-28 restart clears state', () => {
    const h = setup(spreadNotes(0, 6));
    const fresh = h.judge.state();
    for (let index = 1; index <= 5; index += 1) press(h, 0, index * 1000);
    press(h, 3, 9000);
    h.judge.finish('end');
    h.judge.finish('end');
    t.eq(h.emitted.finished.length, 1, 'finish emits once');
    t.deepEq([h.emitted.finished[0].kind, h.emitted.finished[0].endedBy], ['instrument', 'end']);
    t.eq(h.emitted.finished[0].summary.counts.perfect, 5);
    h.judge.restart();
    t.deepEq(h.judge.state(), fresh);
    t.deepEq(h.judge.results(), []);
    t.deepEq(h.judge.inputLog(), []);
    t.deepEq(h.judge.cursor(), { noteIndex: 0, lanes: [0, 0, 0, 0] });
    t.eq(press(h, 0, 1000).noteId, 'n1', 'the next press judges the first note again');
    h.judge.finish('user');
    t.eq(h.emitted.finished.length, 2, 'restart re-arms finish');
    t.throws(() => h.judge.finish('sideways'), 'E-GEN-004');
  });

  t.test('UT-09-29 calibration change mid-run flags comparability', () => {
    const h = setup(spreadNotes(0, 2), { active: false });
    h.judge.setCalibration({ inputOffsetMs: 5, audioLatencyMs: 0 });
    h.judge.setActive(true);
    t.eq(h.judge.summary().comparable, true, 'a change before play does not matter');
    const first = press(h, 0, 1005);
    h.judge.setCalibration({ inputOffsetMs: 5, audioLatencyMs: 0 });
    t.eq(h.judge.summary().comparable, true, 'the same values are not a change');
    h.judge.setCalibration({ inputOffsetMs: 40, audioLatencyMs: 0 });
    t.eq(h.judge.summary().comparable, false);
    t.ok(h.judge.results()[0] === first, 'earlier results are untouched');
    t.eq(press(h, 0, 2040).deltaMs, 0, 'later inputs use the new value');
  });

  t.test('UT-09-29c a calibration change while the run is paused still flags it not comparable (SCR-Pause)', () => {
    const h = setup(spreadNotes(0, 2));
    press(h, 0, 1000);
    h.judge.setActive(false);
    h.judge.setCalibration({ inputOffsetMs: 30, audioLatencyMs: 0 });
    h.judge.setActive(true);
    t.eq(h.judge.summary().comparable, false);
    h.judge.restart();
    t.eq(h.judge.summary().comparable, true, 'a restarted run is a fresh run');
  });

  t.test('UT-09-29 the module calibration is stored, clamped and handed to bound judges', () => {
    const before = Rhythm.calibration();
    try {
      const judge = Rhythm.Judge.bind({ timeMap: makeMap(), bus: new Core.Emitter(), input: { held: () => [] } });
      judges.push(judge);
      judge.load(chartOf([single('a', 0, 1000)]), Model.Song.create({ durationTicks: BAR }), 'beginner');
      judge.setActive(true);
      const stored = Rhythm.setCalibration({ inputOffsetMs: 30, audioLatencyMs: 20, visualLeadMs: 9000 });
      t.deepEq(stored, { inputOffsetMs: 30, audioLatencyMs: 20, visualLeadMs: 3000 });
      t.deepEq(Rhythm.calibration(), stored);
      t.eq(judge.onInput(eventOf(0, 'press', 1050)).deltaMs, 0);
      const clamped = Rhythm.setCalibration({ inputOffsetMs: -900 });
      t.deepEq(clamped, { inputOffsetMs: -500, audioLatencyMs: 20, visualLeadMs: 3000 });
    } finally {
      Rhythm.setCalibration(before);
    }
  });

  t.test('UT-09-30 listener error isolation', () => {
    Core.ErrorReporter._resetForTests();
    const h = setup([single('a', 0, 1000)]);
    h.bus.on('judge.result', () => { throw new Error(LISTENER_FAILURE); });
    const result = press(h, 0, 1000);
    t.eq(result.judgment, 'perfect');
    const records = Core.ErrorReporter.records().filter((record) => record.message === LISTENER_FAILURE);
    t.eq(records.length, 1);
    t.eq(h.emitted.scores.length > 0, true, 'score.update still follows');
    Core.ErrorReporter._resetForTests();
  });

  // ------------------------------------------------------------------------------------------- UT-09-31..36
  t.test('UT-09-31 sections from markers and 4-bar fallback', () => {
    const markers = [{ tick: 0, label: 'Verse', kind: 'section' }, { tick: 8 * BAR, label: 'Chorus', kind: 'section' },
      { tick: 4 * BAR, label: 'cue only', kind: 'cue' }];
    const withMarkers = Model.Song.create({ durationTicks: 16 * BAR, markers });
    t.deepEq(Rhythm.sectionsOf(withMarkers).map((section) => [section.label, section.startTick, section.endTick]),
      [['Verse', 0, 8 * BAR], ['Chorus', 8 * BAR, 16 * BAR]]);
    const verse = [{ tick: 2 * BAR, label: 'Verse', kind: 'section' }];
    const late = Model.Song.create({ durationTicks: 16 * BAR, markers: verse });
    t.deepEq(Rhythm.sectionsOf(late).map((section) => section.label), ['Intro', 'Verse']);
    const plain = Model.Song.create({ durationTicks: 16 * BAR });
    const fallback = Rhythm.sectionsOf(plain);
    t.deepEq(fallback.map((section) => section.label), ['Bars 1-4', 'Bars 5-8', 'Bars 9-12', 'Bars 13-16']);
    t.eq(fallback[3].endTick, 16 * BAR);
    const msOfBar = (bar) => bar * BAR * 1000 / TICKS_PER_SECOND;
    const notes = [0, 3, 4, 7, 8, 11, 12, 15].map((bar, index) => single('n' + index, 0, msOfBar(bar)));
    const h = setup(notes, { durationTicks: 16 * BAR });
    notes.forEach((item) => press(h, 0, item.tick * 1000 / TICKS_PER_SECOND));
    const sections = h.judge.sections();
    t.deepEq(sections.map((section) => section.judged), [2, 2, 2, 2]);
    t.eq(sections.reduce((sum, section) => sum + section.total, 0), h.judge.state().total);
    t.eq(h.emitted.scores[h.emitted.scores.length - 1].sectionIndex, 3);
  });

  t.test('UT-09-32 worst section', () => {
    const markers = [{ tick: 0, label: 'A', kind: 'section' }, { tick: 4 * BAR, label: 'B', kind: 'section' }];
    const notes = [];
    for (let index = 0; index < 5; index += 1) notes.push(single('a' + index, 0, 500 + index * 500));
    for (let index = 0; index < 5; index += 1) notes.push(single('b' + index, 0, 9000 + index * 500));
    const h = setup(notes, { markers, durationTicks: 8 * BAR });
    for (let index = 0; index < 5; index += 1) press(h, 0, 500 + index * 500);
    h.judge.tick(30);
    const summary = h.judge.summary({ startedAt: '2026-01-01T00:00:00.000Z', durationSec: 12 });
    t.eq(summary.worstSectionIndex, 1);
    t.deepEq(summary.sections.map((section) => section.accuracy), [1, 0]);
    t.deepEq([summary.songId, summary.chartId, summary.difficulty, summary.durationSec],
      [h.song.id, 'song:test', 'beginner', 12]);
    t.eq(summary.version, 1);
    const sparse = setup(notes.slice(0, 3), { markers, durationTicks: 8 * BAR });
    sparse.judge.tick(30);
    t.eq(sparse.judge.summary().worstSectionIndex, null, 'fewer than 4 judgments in every section');
  });

  t.test('UT-09-33 dance chart through the same Judge', () => {
    const steps = [{ id: 'd1', tick: tickOf(1000), directions: [2], durTicks: 1, isHold: false },
      { id: 'd2', tick: tickOf(2000), directions: [2], durTicks: 1, isHold: false }];
    const danceChart = chartOf(steps.map((step) => ({
      id: step.id, tick: step.tick, durTicks: step.durTicks, lanes: step.directions, sourceEventIds: [], pitches: [],
      isHold: step.isHold
    })), 'normal');
    const h = setup([]);
    h.judge.load(danceChart, h.song, Rhythm.windowsFor('intermediate'));
    const first = h.judge.onInput(Object.assign(eventOf(2, 'press', 1035), { control: 'dance2' }));
    t.deepEq([first.noteId, first.judgment, first.deltaMs], ['d1', 'perfect', 35]);
    t.eq(press(h, 2, 2036).judgment, 'great', 'lane2 is the same lane as dance2; windows are intermediate');
    t.eq(h.judge.summary().windowsPreset, 'standard');
  });

  t.test('UT-09-34 total counts heads plus tails', () => {
    const notes = [];
    for (let index = 0; index < 10; index += 1) {
      const ms = (index + 1) * 1000;
      const isHoldIndex = [2, 5, 8].includes(index);
      notes.push(isHoldIndex ? hold('n' + index, index % 4, ms, 500) : single('n' + index, index % 4, ms));
    }
    const h = setup(notes);
    t.eq(h.judge.state().total, 13);
    notes.forEach((item, index) => {
      const ms = (index + 1) * 1000;
      press(h, index % 4, ms);
      if (item.isHold) release(h, index % 4, ms + 500);
    });
    const state = h.judge.state();
    t.deepEq([state.judged, state.total, state.completion], [13, 13, 1]);
    const missed = setup([hold('h', 1, 1000, 500)]);
    missed.judge.tick(5);
    const parts = missed.judge.results().map((result) => [result.part, result.judgment]);
    t.deepEq(parts, [['head', 'miss'], ['tail', 'miss']]);
    t.eq(missed.judge.state().completion, 1, 'a missed hold is fully judged');
  });

  t.test('UT-09-35 speed does not change windows', () => {
    const half = setup([single('a', 0, 1000)], { timeMap: makeMap(TICKS_PER_SECOND / 2) });
    t.near(half.map.audioTimeAt(tickOf(1000)), 2, 1e-9, 'the chart spacing in audio time doubles');
    const late = press(half, 0, 2045);
    t.deepEq([late.judgment, late.deltaMs], ['perfect', 45]);
    const same = setup([single('a', 0, 1000)], { timeMap: makeMap(TICKS_PER_SECOND / 2) });
    t.eq(press(same, 0, 2046).judgment, 'great');
  });

  t.test('UT-09-36 nextNotes helper', () => {
    const h = setup(spreadNotes(0, 5));
    t.deepEq(h.judge.nextNotes(0, 2).map((item) => item.id), ['n1', 'n2']);
    press(h, 0, 1000);
    t.deepEq(h.judge.nextNotes(0, 2).map((item) => item.id), ['n2', 'n3']);
    t.deepEq(h.judge.nextNotes(1, 2), []);
    t.deepEq(h.judge.nextNotes(9, 2), []);
    t.deepEq(h.judge.cursor().lanes, [1, 0, 0, 0]);
  });

  // ------------------------------------------------------------------------------------------- TT-023, 026, 029
  t.test('TT-023 judge half: calibration applied once, through attach and input.event', () => {
    const judge = Rhythm.Judge.bind({ timeMap: makeMap(), followCalibration: false });
    judges.push(judge);
    judge.load(chartOf([single('a', 0, 1000)]), Model.Song.create({ durationTicks: BAR }), 'beginner');
    judge.setCalibration({ inputOffsetMs: 30, audioLatencyMs: 20 });
    judge.setActive(true);
    const own = Core.bus.listenerCount('input.event');
    judge.attach();
    judge.attach();
    t.eq(Core.bus.listenerCount('input.event'), own + 1, 'attach is idempotent');
    const seen = [];
    Core.bus.on('input.event', (evt) => seen.push(evt.tAudio), t.owner);
    t.fakes.inputEvent('lane0', 'press', 1.05);
    t.deepEq(seen, [1.05], 'no listener changed the event time');
    t.deepEq(judge.results().map((result) => [result.judgment, result.deltaMs]), [['perfect', 0]]);
    judge.detach();
    t.eq(Core.bus.listenerCount('input.event'), own + 1, 'detach removes only the judge listener');
  });

  t.test('TT-024 judge half: calibration changed during a song', () => {
    const h = setup(spreadNotes(0, 16), { difficulty: 'expert' });
    for (let index = 1; index <= 8; index += 1) press(h, 0, index * 1000 + 30);   // before the change: offset 0
    const before = h.judge.results().map((result) => result.deltaMs);
    t.deepEq(before, [30, 30, 30, 30, 30, 30, 30, 30], 'the offset 0 judges the late presses as late');
    t.eq(h.judge.summary().comparable, true);
    h.judge.setCalibration({ inputOffsetMs: 30, audioLatencyMs: 0 });             // the change, at "bar 9"
    for (let index = 9; index <= 16; index += 1) press(h, 0, index * 1000 + 30);
    const results = h.judge.results();
    t.deepEq(results.slice(0, 8).map((result) => result.deltaMs), before, 'no judgment is recomputed');
    t.deepEq(results.slice(8).map((result) => result.deltaMs), [0, 0, 0, 0, 0, 0, 0, 0], 'later inputs use 30');
    t.eq(h.judge.summary().comparable, false, 'the run is flagged not comparable');
    t.eq(h.judge.summary().calibration.inputOffsetMs, 30);
  });

  t.test('TT-026 judge half: judgment window boundaries in audio time (intermediate)', () => {
    const cases = [[35, 'perfect'], [-35, 'perfect'], [36, 'great'], [70, 'great'], [-70, 'great'], [-36, 'great'],
      [71, 'good'], [110, 'good'], [-110, 'good'], [-71, 'good'], [111, null], [-111, null]];
    cases.forEach(([offset, expected]) => {
      const h = setup([single('a', 0, 1000)], { difficulty: 'intermediate' });
      const result = press(h, 0, 1000 + offset);
      t.eq(result === null ? null : result.judgment, expected, 'offset ' + offset);
      if (expected !== null) return;
      t.eq(h.judge.state().stray, 1, 'offset ' + offset + ' is a stray');
      h.judge.tick(5);
      t.eq(h.judge.state().counts.miss, 1, 'offset ' + offset + ' leaves the note to miss');
    });
  });

  function permutations(items) {
    if (items.length <= 1) return [items];
    return items.flatMap((item, index) => permutations(items.filter((other, at) => at !== index))
      .map((rest) => [item].concat(rest)));
  }

  t.test('TT-029 judge half: simultaneous presses at identical timestamps', () => {
    permutations([0, 1, 2, 3]).forEach((order) => {
      const h = setup([chord('c', [0, 1, 2, 3], 1000)]);
      order.forEach((lane) => press(h, lane, 1000));
      const results = h.judge.results();
      t.eq(results.length, 1, 'order ' + order.join(''));
      t.deepEq([results[0].judgment, results[0].deltaMs], ['perfect', 0]);
      t.eq(h.judge.state().stray, 0);
    });
    const duplicate = setup([chord('c', [0, 1], 1000)]);
    [0, 0, 1].forEach((lane) => press(duplicate, lane, 1000));
    t.eq(duplicate.judge.results().length, 1, 'a repeated lane is not a stray and not judged twice');
    t.eq(duplicate.judge.state().stray, 0);
  });
});
})();
