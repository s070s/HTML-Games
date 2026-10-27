// 92-test-integration.js - IT integration tests (Part 12.5; group 'integration'; test build only; also run in the touch
// pass). Created by T03.03 with IT-002 and IT-043. Later entries append rows.
// IT-002 is partial until Phase 06 exit: the input and pressed-class assertions run now on the real M-26 pads and the
// real M-07 listeners; the audio assertions (sched.noteOn and noteOff, activeVoices) wait for Free Play sound.
// IT-043 runs against the real Modes leave steps. Free Play does not bind the input context on enter (only `instrument`
// does, since T03.10), so the test binds one itself and routes the Input.unbind of Modes to that owner through a
// stand-in namespace. T03.10 adds IT-003, IT-004, IT-035 and the real-clock part of TT-023 (TT-023 lives here because
// this group has the mode harness; the timing group has none).
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('integration', (t) => {
  const Core = FLM.Core;
  const UI = FLM.UI;
  const Modes = FLM.Modes;
  const bus = Core.bus;
  const doc = window.document;
  const REGIONS = ['overlay', 'hud', 'touch'];
  const NO_INSET = { top: 0, right: 0, bottom: 0, left: 0 };
  const TOUCH_VIEWPORT = { width: 390, height: 844, dpr: 1, safeArea: NO_INSET };
  const HOLD_MS = 300;
  const EVENTS_PER_ROUND = 8;
  const TEST_OWNER = Symbol('integration-test');

  let ownsInit = false;
  let savedChildren = {};
  let replaced = [];
  let reattach = false;

  function controllerFor(id) {
    return () => ({
      mount(root) { root.appendChild(UI.el('p', null, id)); },
      unmount() {}
    });
  }

  function standIn(name, value) {
    replaced.push({ name, had: Object.prototype.hasOwnProperty.call(FLM, name), value: FLM[name] });
    FLM[name] = value;
  }

  const wait = (ms) => new Promise((resolve) => Core.timers.setTimeout(resolve, ms, t.owner));

  t.before(() => {
    if (UI.counters().initialized) return;
    UI.init({ settings: {}, caps: {} });
    ownsInit = true;
  });

  t.after(() => {
    if (ownsInit) UI._teardownForTests();
    Modes._teardownForTests();
  });

  t.beforeEach(async () => {
    UI._resetForTests();
    savedChildren = {};
    REGIONS.forEach((id) => {
      const node = doc.getElementById(id);
      savedChildren[id] = Array.from(node.childNodes);
      savedChildren[id].forEach((child) => child.remove());
    });
    Core.ErrorReporter._resetForTests();
    replaced = [];
    Modes._teardownForTests();
    UI.Screens.setResolver((id) => controllerFor(id));
    await Modes.enter('menu');
    // The tests use the Input that boot attached to #touch and #view; attach one only when boot did not.
    reattach = FLM.Input.listenerCount() === 0;
    if (reattach) FLM.Input.init({ keyboardTarget: window, padRoot: doc.getElementById('touch'),
      surface: doc.getElementById('view') });
  });

  t.afterEach(async () => {
    await Modes.leave('user');
    UI.closeAllDialogs('test');
    replaced.reverse().forEach((item) => {
      if (item.had) FLM[item.name] = item.value;
      else delete FLM[item.name];
    });
    if (reattach) FLM.Input.detach();
    UI._resetForTests();
    REGIONS.forEach((id) => {
      const node = doc.getElementById(id);
      Array.from(node.childNodes).forEach((child) => child.remove());
      savedChildren[id].forEach((child) => node.appendChild(child));
    });
    Modes._teardownForTests();
  });

  function padCenterOf(index) {
    const rect = doc.getElementById('pad-' + index).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function pointerEvent(type, id, point) {
    return new window.PointerEvent(type, { pointerId: id, clientX: point.x, clientY: point.y, pointerType: 'touch',
      pressure: 0.5, bubbles: true, cancelable: true });
  }

  const pressedPads = () => [0, 1, 2, 3].map((index) => doc.getElementById('pad-' + index)
    .classList.contains('pressed'));

  /** One IT-002 round: four pointers down in one task, released in the order 3, 1, 4, 2. */
  async function fourPointerRound(events, withCompatibilityEvents) {
    const first = events.length;
    const centers = [0, 1, 2, 3].map(padCenterOf);
    [1, 2, 3, 4].forEach((id) => {
      doc.getElementById('pad-' + (id - 1)).dispatchEvent(pointerEvent('pointerdown', id, centers[id - 1]));
    });
    t.deepEq(pressedPads(), [true, true, true, true], 'every pad shows its pressed class');
    t.deepEq(FLM.Input.held(), ['lane0', 'lane1', 'lane2', 'lane3']);
    await wait(HOLD_MS);
    [3, 1, 4, 2].forEach((id) => {
      const pad = doc.getElementById('pad-' + (id - 1));
      pad.dispatchEvent(pointerEvent('pointerup', id, centers[id - 1]));
      if (withCompatibilityEvents) {
        ['mousedown', 'mouseup', 'click'].forEach((type) => pad.dispatchEvent(new window.MouseEvent(type,
          { bubbles: true, cancelable: true, clientX: centers[id - 1].x, clientY: centers[id - 1].y })));
      }
    });
    t.deepEq(pressedPads(), [false, false, false, false], 'every pressed class is cleared');
    t.eq(events.length - first, EVENTS_PER_ROUND, 'exactly 8 input.event per round');
    t.deepEq(FLM.Input.held(), [], 'zero held controls after the round');
    return events.slice(first);
  }

  t.test('IT-002 touch pads: four simultaneous pointers (input and pressed-class part)', async () => {
    const Input = FLM.Input;
    UI.Layout._measureFrom(TOUCH_VIEWPORT);
    UI.TouchPads.show({ kind: 'lanes', layout: 'bottom', size: 'medium', opacity: 0.75 });
    Input.bind({ owner: TEST_OWNER, context: 'freeplay' });
    const events = [];
    bus.on('input.event', (event) => events.push(event), t.owner);
    try {
      const plain = await fourPointerRound(events, false);
      t.deepEq(plain.slice(0, 4).map((event) => event.type + ' ' + event.source), Array(4).fill('press pointer'));
      t.deepEq(plain.slice(4).map((event) => event.control), ['lane2', 'lane0', 'lane3', 'lane1'],
        'releases follow the order 3, 1, 4, 2');
      const compatible = await fourPointerRound(events, true);
      t.eq(compatible.length, EVENTS_PER_ROUND, 'the browser compatibility mouse events add nothing');
    } finally {
      Input.unbind(TEST_OWNER);
      UI.TouchPads.hide();
    }
    t.deepEq(Input.held(), []);
    t.eq(Input.boundSurfaces(), 0);
  });

  t.test('IT-043 inputs are mode-stateless and released on leave', async () => {
    const Input = FLM.Input;
    const events = [];
    const forbidden = [];
    bus.on('input.event', (event) => events.push(event), t.owner);
    ['sched.noteOn', 'judge.result'].forEach((topic) => bus.on(topic, () => forbidden.push(topic), t.owner));
    t.eq(Modes.current().mode, 'menu');
    Input.synthesize.key('KeyA', true, 1);
    Input.synthesize.key('KeyS', true, 2);
    Input.synthesize.key('KeyA', false, 3);
    Input.synthesize.key('KeyS', false, 4);
    t.deepEq(events, [], 'in the menu a lane key is not a control: nothing is emitted, nothing sounds or is judged');

    t.eq((await Modes.enter('freeplay')).ok, true);
    Input.bind({ owner: TEST_OWNER, context: 'freeplay' });
    standIn('Input', Object.assign({}, Input, { unbind: () => Input.unbind(TEST_OWNER) }));
    Input.synthesize.key('KeyK', true, 10);
    Input.synthesize.key('KeyL', true, 11);
    t.deepEq(Input.held(), ['lane2', 'lane3']);
    t.eq(Input.boundSurfaces(), 1);

    const left = await Modes.leave('user');
    t.eq(left.leaks, null, 'the leave steps leave no held control and no bound surface');
    const releases = events.filter((event) => event.type === 'release');
    t.deepEq(releases.map((event) => event.control + ' ' + event.source), ['lane2 system', 'lane3 system']);
    t.deepEq(Input.held(), []);
    t.eq(Input.boundSurfaces(), 0);
    t.eq(Modes.assertClean(), null);
    t.deepEq(forbidden, [], 'no note was scheduled and nothing was judged');
  });

  // T04.01: the audio half of IT-047 (the Scheduler binding half waits for T04.04; the serialized transitions half is
  // the partial IT-047 of the modes group).
  t.test('IT-047b one audio engine per page: init twice returns the same engine and the same context', () => {
    const Audio = FLM.Audio;
    const engine = Audio.init();
    const context = Audio.ctx();
    t.ok(Audio.init() === engine && Audio.init({ mobile: true }) === engine, 'the same engine');
    t.ok(Audio.ctx() === context && context instanceof window.AudioContext, 'the same context');
    t.eq(Audio.ctxCount(), 1);
    t.eq(Core.modules().filter((item) => item.name === 'Audio').length, 1);
    t.ok(Audio.clock() === Audio.clock(), 'one clock for the Transport');
    t.near(Audio.clock().now(), context.currentTime, 0.5, 'the clock reads the context');
    t.eq(Modes.assertClean(), null, 'nothing was added to the page');
  });

  // ------------------------------------------------------------------------------------------ T03.10
  // IT-003, IT-004, IT-035 and the real-clock part of TT-023 run the `instrument` mode on a test chart
  // (params.testChart) with the chart bot. The Scheduler and the highway do not exist yet, so their halves of the
  // rows (sched.noteOn `at` lists, hit-line crossing times, activeVoices) are replaced by the note audio times of
  // Transport.main and wait for Phase 04 and Phase 09. IT-003 to IT-035 run on fake timers: the whole song takes
  // 19 s of fake time.
  const Fixtures = FLM.SelfTest.fixtures;
  const Rhythm = FLM.Rhythm;
  const Settings = FLM.Screens.Settings;
  const NOTE_COUNT = 31;
  const FINISH_FAKE_MS = 19000;            // song end (16.5 s) plus the 1.5 s "Song complete" note
  const ZERO_CALIBRATION = { inputOffsetMs: 0, audioLatencyMs: 0 };
  const SCORE_FIELDS = ['score', 'combo', 'maxCombo', 'counts', 'judged', 'total', 'accuracy', 'completion'];
  const LANE_CONTROL = /^lane[0-3]$/;
  const TIME_EPSILON = 1e-6;
  // The anchor of a real audio clock moves by about a millisecond between samples; the calibration under test is 50 ms.
  const REAL_CLOCK_DELTA_MS = 5;
  const REAL_CLOCK_EPSILON = 0.005;
  const PERF_SAMPLES = 10;
  const REAL_NOTE_COUNT = 6;
  const BOT_DELAY_MS = 30;
  const REAL_BOT_DELAY_MS = 50;
  const DEFAULT_VISUAL_LEAD_MS = 1500;

  const flush = async () => {
    for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  };

  const pickScore = (state) => SCORE_FIELDS.reduce((picked, field) => Object.assign(picked, { [field]: state[field] }),
    {});

  function startRun(songNotes, difficulty, extra) {
    const song = Fixtures.song(songNotes);
    const chart = Fixtures.chart(songNotes, difficulty);
    UI.Screens.setResolver(FLM.Screens.get);   // the real SCR-Instrument and SCR-Pause
    return { song, chart, params: Object.assign({ song, testChart: chart, countInBars: 0 }, extra) };
  }

  /** Records what a run emits, with its own owner so that several runs of one test do not mix. */
  function recordRun(chart, zero) {
    const owner = Symbol('run');
    const run = { results: [], scores: [], finished: [], events: [], owner };
    bus.on('judge.result', (result) => run.results.push(result), owner);
    bus.on('score.update', (state) => run.scores.push(state), owner);
    bus.on('chart.finished', (event) => run.finished.push(event), owner);
    bus.on('input.event', (event) => {
      if (!LANE_CONTROL.test(event.control)) return;
      run.events.push({ source: event.source, control: event.control, type: event.type,
        tPerf: event.tPerf - zero() * 1000, tAudio: event.tAudio - zero(), pressure: event.pressure });
    }, owner);
    run.stop = () => bus.removeOwner(owner);
    run.chart = chart;
    return run;
  }

  /** One whole song through the mode on fake timers: enter, bot, song end, "Song complete", leave. */
  async function playOnFakeTimers(timers, setup, botDelayMs) {
    let zeroAudio = 0;
    const entered = await Modes.enter('instrument', setup.params);   // the recorder follows: it is no baseline
    t.eq(entered.ok, true, 'the instrument mode started');
    const run = recordRun(setup.chart, () => zeroAudio);
    zeroAudio = FLM.Transport.main.audioTimeAt(0);
    run.noteTimes = setup.chart.notes.map((note) => FLM.Transport.main.audioTimeAt(note.tick) - zeroAudio);
    FLM.Input.resampleAnchor();              // the anchor the bot and the mapping use
    run.perfToAudio = Array.from({ length: PERF_SAMPLES },
      (unused, index) => FLM.Input.perfToAudio((index + 1) * 1000));
    const bot = FLM.SelfTest.chartBot(setup.chart, { offsetMs: botDelayMs, owner: run.owner });
    bot.start();
    timers.advance(FINISH_FAKE_MS);
    await flush();
    bot.stop();
    await Modes.leave('user');
    run.stop();
    t.eq(Modes.assertClean(), null, 'the run left nothing behind');
    run.state = run.scores.length > 0 ? run.scores[run.scores.length - 1] : null;
    run.zero = zeroAudio;
    return run;
  }

  // A fake settings store, so that Settings.set (as SCR-Settings does it) never writes the real storage.
  async function withSettingsStore(body) {
    const Storage = FLM.Storage;
    const wasOpen = Storage.state().opened;
    const savedDocument = Settings.all();
    const rhythm = Rhythm.calibration();
    const input = FLM.Input.calibration();
    await Storage.open({ localStorage: t.fakes.localStorage(), idbFactory: null });
    Settings.load();
    Modes._teardownForTests();               // a fresh leak baseline, now that the store listeners are in place
    await Modes.enter('menu');
    try {
      await body();
    } finally {
      Storage._teardownForTests();
      Settings._resetForTests(savedDocument);
      Rhythm.setCalibration(rhythm);
      FLM.Input.setCalibration(input);
      if (wasOpen) await Storage.open();
    }
  }

  const setCalibration = (values) => {
    const lead = values.visualLeadMs === undefined ? DEFAULT_VISUAL_LEAD_MS : values.visualLeadMs;
    const patch = { 'calibration.inputOffsetMs': values.inputOffsetMs,
      'calibration.audioLatencyMs': values.audioLatencyMs, 'calibration.visualLeadMs': lead };
    t.eq(Settings.setMany(patch, 'ui').ok, true);
  };

  const sameTimes = (actual, expected) => actual.length === expected.length &&
    actual.every((time, index) => Math.abs(time - expected[index]) <= TIME_EPSILON);

  const lanePresses = (run) => run.events.filter((event) => event.type === 'press');

  t.test('IT-003 input to scoring: 31 perfect presses through the instrument mode on a test chart', async () => {
    await withSettingsStore(async () => {
      setCalibration(ZERO_CALIBRATION);
      const timers = t.fakes.timers();
      timers.install();
      t.fakes.detachAudio();                 // the real audio clock does not follow fake time
      const setup = startRun(NOTE_COUNT, 'intermediate');
      const run = await playOnFakeTimers(timers, setup, 0);
      timers.uninstall();
      t.eq(run.results.length, NOTE_COUNT);
      t.deepEq(run.results.map((result) => result.judgment), new Array(NOTE_COUNT).fill('perfect'));
      t.ok(run.results.every((result) => Math.abs(result.deltaMs) === 0), 'every press is on the note');
      t.eq(run.finished.length, 1, 'one chart.finished');
      t.eq(run.finished[0].endedBy, 'end');
      const expected = { score: 6400, combo: 31, maxCombo: 31, counts: { perfect: 31, great: 0, good: 0, miss: 0 },
        judged: 31, total: 31, accuracy: 1, completion: 1 };
      t.deepEq(pickScore(run.state), expected, 'score = 100 x (10 x 1 + 10 x 2 + 10 x 3 + 1 x 4) = 6400');
      const replayed = Rhythm.replay(setup.chart, setup.song, 'intermediate', run.events, ZERO_CALIBRATION);
      t.deepEq(pickScore(replayed.state), pickScore(run.state), 'the input log replays to the same ScoreState');
      t.eq(Modes.current().mode, 'menu', 'the mode left by itself after "Song complete"');
      t.eq(Modes.assertClean(), null);
    });
  });

  t.test('IT-004 calibration affects scoring predictably: only the Judge moves, and once', async () => {
    await withSettingsStore(async () => {
      const timers = t.fakes.timers();
      timers.install();
      t.fakes.detachAudio();                 // the real audio clock does not follow fake time
      const runs = [];
      const cases = [ZERO_CALIBRATION, { inputOffsetMs: BOT_DELAY_MS, audioLatencyMs: 0 },
        { inputOffsetMs: 0, audioLatencyMs: BOT_DELAY_MS }];
      for (const values of cases) {
        setCalibration(values);
        runs.push(await playOnFakeTimers(timers, startRun(NOTE_COUNT, 'expert'), BOT_DELAY_MS));
      }
      timers.uninstall();
      const deltas = runs.map((run) => run.results.map((result) => result.deltaMs));
      const kinds = runs.map((run) => run.results.map((result) => result.judgment));
      t.ok(deltas[0].every((delta) => Math.abs(delta - BOT_DELAY_MS) <= 1), 'run 1: every deltaMs is +30');
      t.deepEq(kinds[0], new Array(NOTE_COUNT).fill('great'), 'run 1: expert perfect is 18 ms, great 40 ms');
      [1, 2].forEach((index) => {
        t.ok(deltas[index].every((delta) => Math.abs(delta) <= 1), 'run ' + (index + 1) + ': every deltaMs is 0');
        t.deepEq(kinds[index], new Array(NOTE_COUNT).fill('perfect'), 'run ' + (index + 1) + ': perfect');
      });
      t.deepEq(pickScore(runs[1].state), pickScore(runs[2].state), 'offset and latency give the same ScoreState');
      t.ok(sameTimes(runs[1].noteTimes, runs[0].noteTimes), 'the note audio times are the same in runs 1 and 2');
      t.ok(sameTimes(runs[2].noteTimes, runs[0].noteTimes), 'the note audio times are the same in runs 1 and 3');
      runs.forEach((run, index) => t.ok(lanePresses(run).every((event, position) => Math.abs(event.tAudio -
        (run.noteTimes[position] + BOT_DELAY_MS / 1000)) <= TIME_EPSILON), 'run ' + (index + 1) +
        ': input.event.tAudio is the uncalibrated mapping'));
    });
  });

  t.test('IT-035 calibration values touch only the Judge: input mapping and timeline are identical', async () => {
    await withSettingsStore(async () => {
      const timers = t.fakes.timers();
      timers.install();
      t.fakes.detachAudio();                 // the real audio clock does not follow fake time
      setCalibration(ZERO_CALIBRATION);
      const plain = await playOnFakeTimers(timers, startRun(NOTE_COUNT, 'expert'), 0);
      setCalibration({ inputOffsetMs: 40, audioLatencyMs: 25, visualLeadMs: 0 });
      t.eq(Settings.get('calibration.visualLeadMs'), 600, 'a visual lead of 0 is clamped to the smallest value');
      const shifted = await playOnFakeTimers(timers, startRun(NOTE_COUNT, 'expert'), 0);
      timers.uninstall();
      t.deepEq(shifted.perfToAudio, plain.perfToAudio, 'Input.perfToAudio gives the same 10 values');
      t.ok(sameTimes(shifted.noteTimes, plain.noteTimes), 'the timeline of the song is the same');
      t.ok(sameTimes(lanePresses(shifted).map((event) => event.tAudio),
        lanePresses(plain).map((event) => event.tAudio)), 'input.event.tAudio is the same');
      t.ok(plain.results.every((result) => Math.abs(result.deltaMs) === 0), 'with zero calibration: on the note');
      t.ok(shifted.results.every((result) => Math.abs(result.deltaMs + 65) <= 1), 'only the Judge applied the 65 ms');
    });
  });

  t.test('TT-023 calibration applied once across the chain (real clock)', async () => {
    const rhythm = Rhythm.calibration();
    const input = FLM.Input.calibration();
    const values = { inputOffsetMs: 30, audioLatencyMs: 20 };
    Rhythm.setCalibration(values);
    FLM.Input.setCalibration(values);
    const setup = startRun(REAL_NOTE_COUNT, 'expert');
    let zeroAudio = 0;
    let run = null;
    try {
      t.eq((await Modes.enter('instrument', setup.params)).ok, true);
      run = recordRun(setup.chart, () => zeroAudio);
      const finished = new Promise((resolve) => bus.on('chart.finished', resolve, run.owner));
      zeroAudio = FLM.Transport.main.audioTimeAt(0);
      const noteTimes = setup.chart.notes.map((note) => FLM.Transport.main.audioTimeAt(note.tick) - zeroAudio);
      FLM.Input.resampleAnchor();            // the bot maps audio time to performance time through the anchor
      const bot = FLM.SelfTest.chartBot(setup.chart, { offsetMs: REAL_BOT_DELAY_MS, owner: run.owner });
      bot.start();
      await finished;
      bot.stop();
      t.eq(run.results.length, REAL_NOTE_COUNT);
      t.deepEq(run.results.map((result) => result.judgment), new Array(REAL_NOTE_COUNT).fill('perfect'));
      t.ok(run.results.every((result) => Math.abs(result.deltaMs) <= REAL_CLOCK_DELTA_MS),
        'every deltaMs is 0 within the noise of a real clock');
      lanePresses(run).forEach((event, index) => t.near(event.tAudio, noteTimes[index] + REAL_BOT_DELAY_MS / 1000,
        REAL_CLOCK_EPSILON, 'press ' + (index + 1) + ' keeps the uncalibrated audio time'));
      run.stop();                              // the recorder is no leak of the mode
      t.eq((await Modes.leave('user')).leaks, null);
    } finally {
      if (run) run.stop();
      Rhythm.setCalibration(rhythm);
      FLM.Input.setCalibration(input);
    }
  });
});
})();
