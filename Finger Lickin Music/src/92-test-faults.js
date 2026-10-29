// 92-test-faults.js - FI fault-injection tests (Part 12.5). First row: FI-037 (T01.05). Later entries append rows.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('faults', (t) => {
  t.test('FI-037 bus listener throws', () => {
    const core = FLM.Core;
    if (!core.Emitter || !core.Faults) t.skip('Core.Emitter or Core.Faults is not available');
    const emitter = new core.Emitter();      // a private bus: no other module hears the armed listener
    const calls = [];
    emitter.on('error', () => calls.push('first'), t.owner);
    emitter.on('error', () => calls.push('second'), t.owner);
    emitter.on('error', () => calls.push('third'), t.owner);
    const moduleCount = core.modules().length;

    // The fault makes the next listener call of the 'error' topic throw; the first listener is the one hit.
    core.Faults.set('error.throw', { origin: 'listener', count: 1 });
    try {
      emitter.emit('error', { code: 'E-TEST-000', origin: 'listener', count: 1 });
    } finally {
      core.Faults.clear('error.throw');
    }

    t.deepEq(calls, ['second', 'third']);
    t.eq(core.Faults.active('error.throw'), null);
    t.eq(core.modules().length, moduleCount);
    emitter.removeOwner(t.owner);
  });

  // T04.01: FI-008 on a fresh engine with an injected context factory (the app engine is already running).
  t.test('FI-008 audio initialization fails', () => {
    const core = FLM.Core;
    const settingsBefore = JSON.stringify(FLM.Screens.Settings.all());
    const stand = t.fakes.fakeAudioContext();
    const factory = t.fakes.spy(() => stand.context);
    const engine = FLM.Audio.createEngine({ contextFactory: factory, bus: new core.Emitter(), mobile: false });
    core.ErrorReporter._resetForTests();
    core.Faults.set('audio.fail', { phase: 'init' });
    try {
      t.throws(() => engine.init(), 'E-AUD-001');
      t.eq(engine.state(), 'none', 'no context');
      const panel = window.document.getElementById('fatal');
      t.ok(panel && panel.classList.contains('show'), '#fatal is shown');
      const text = window.document.getElementById('fatal-text');
      t.ok(text.textContent.includes(core.Text.get('E-AUD-001')), 'with the text of Part 10.6.3');
      t.eq(text.children.length, 0, 'the text went in as text, not as markup');
      t.eq(core.Faults.active('audio.fail'), null, 'the fault was used up');
      engine.init();
      engine.init();
      t.eq(factory.count, 1, 'a second init does not create a second context');
      t.eq(engine.ctxCount(), 1);
      t.eq(JSON.stringify(FLM.Screens.Settings.all()), settingsBefore, 'settings untouched');
    } finally {
      core.Faults.clearAll();
      core.ErrorReporter._resetForTests();
      engine.close();
    }
  });
  // ------------------------------------------------------------------------------------------- T04.08: audio faults
  // FI-004 to FI-007 on engines of their own (a fake context that really changes state, a private bus, a fake clock);
  // FI-001 and the dialog half live in the modes group. Instruments is attached to the private engine and the app
  // engine is attached again afterwards.
  const BEAT = 960;
  const TICK_S = 0.025;

  function audioRig(extra) {
    const core = FLM.Core;
    const stand = t.fakes.fakeAudioContext({ state: 'running' });
    stand.overrides.suspend = () => { stand.setState('suspended'); return Promise.resolve(); };
    stand.overrides.resume = () => { stand.setState('running'); return Promise.resolve(); };
    stand.overrides.close = () => { stand.setState('closed'); return Promise.resolve(); };
    const bus = new core.Emitter();
    const clock = t.fakes.clock();
    const engine = FLM.Audio.createEngine(Object.assign({ contextFactory: () => stand.context, bus, clock,
      mobile: false, readSetting: () => 1, polyphony: 0 }, extra));
    engine.init();
    FLM.Instruments.attach(engine);
    engine.Scheduler.setInstruments(FLM.Instruments);
    const events = {};
    const watch = (topic) => {
      events[topic] = [];
      bus.on(topic, (event) => events[topic].push(event), t.owner);
    };
    ['audio.state', 'audio.panic', 'sched.noteOn'].forEach(watch);
    return { core, stand, bus, clock, engine, events };
  }

  function endRig(rig) {
    rig.core.Faults.clearAll();
    rig.core.ErrorReporter._resetForTests();
    rig.engine.Scheduler.unbind();
    rig.engine.close();
    FLM.Instruments.attach(FLM.Audio.init());
  }

  /** A real Transport on the rig's clock playing notes every half second on one track, bound to the Scheduler. */
  function playNotes(rig, count) {
    const Model = FLM.Model;
    const song = Model.Song.create({ title: 'Fault fixture' });
    const keys = Model.Track.create({ name: 'Keys', program: 16 }, song);
    Model.replaceEvents(keys, Array.from({ length: count }, (unused, index) => Model.Events.note(index * BEAT, BEAT / 2,
      60 + index, 100)));
    Model.Song.addTrack(song, keys);
    song.durationTicks = count * BEAT;
    const transport = FLM.Transport.create({ clock: rig.clock, bus: rig.bus });
    transport.load(song);
    rig.engine.Scheduler.bind(transport, song, {});
    transport.play({ countInBars: 0 });
    return transport;
  }

  function tickFor(rig, seconds) {
    const until = rig.clock.now() + seconds;
    while (rig.clock.now() < until - 1e-9) {
      rig.clock.advance(TICK_S);
      rig.engine.Scheduler.tickOnce(rig.clock.now());
    }
  }

  t.test('FI-004 audio resume blocked for 5 s: the first Resume fails with E-AUD-002, a later one succeeds', async () => {
    const rig = audioRig();
    const timers = t.fakes.timers();
    timers.install();
    try {
      await rig.engine.unlock();
      playNotes(rig, 8);
      tickFor(rig, 0.5);
      rig.core.Faults.set('audio.suspend', { blockResumeMs: 5000 });
      tickFor(rig, TICK_S);
      t.eq(rig.engine.state(), 'suspended', 'the fault suspended the context');
      t.ok(rig.events['audio.state'].some((event) => event.state === 'suspended'), 'audio.state announced it');
      t.eq(rig.core.Faults.active('audio.suspend'), null, 'the fault is one-shot');
      timers.advance(1000);
      const first = await rig.engine.resume();
      t.eq(first, false, 'the first Resume at 1 s fails');
      t.eq(rig.engine.state(), 'suspended');
      t.eq(rig.engine.unlock !== undefined, true);
      timers.advance(5000);
      const second = await rig.engine.resume();
      t.eq(second, true, 'the second one, after 6 s, succeeds');
      t.eq(rig.engine.state(), 'running');
    } finally {
      timers.uninstall();
      endRig(rig);
    }
  });

  t.test('FI-005 node creation fails mid-song: E-AUD-004, a hard panic rebuilds, scheduling resumes, no slot leaks', () => {
    const rig = audioRig();
    try {
      const transport = playNotes(rig, 8);
      tickFor(rig, 0.4);
      const before = rig.events['sched.noteOn'].length;
      rig.core.ErrorReporter._resetForTests();
      rig.core.Faults.set('audio.fail', { phase: 'node', count: 1 });
      tickFor(rig, 0.6);
      const report = rig.core.ErrorReporter.records().find((record) => record.code === 'E-AUD-004');
      t.ok(report, 'E-AUD-004 was reported');
      const hard = rig.events['audio.panic'].filter((event) => event.hard);
      t.eq(hard.length, 1, 'one hard panic');
      t.eq(hard[0].reason, 'rebuild');
      t.eq(rig.events['audio.panic'].filter((event) => !event.hard && (event.reason === 'seek' || event.reason === 'user')).length, 0,
        'the position resync after the rebuild is not a seek: no soft panic follows (regression)');
      tickFor(rig, 1.5);
      t.ok(rig.events['sched.noteOn'].length > before + 1, 'scheduling went on after the rebuild');
      t.eq(transport.state(), 'playing');
      const counts = rig.engine.VoiceAllocator.stats();
      t.eq(rig.engine.VoiceAllocator.activeCount(), FLM.Instruments.activeVoices(),
        'every held slot is a voice that really exists');
      t.eq(counts.dropped >= 1, true, 'the failed note is counted dropped');
    } finally {
      endRig(rig);
    }
  });

  t.test('FI-043 an instrument definition fails: the family template plays, no E-AUD-004 and no hard panic (regression)', () => {
    const rig = audioRig();
    try {
      const transport = playNotes(rig, 8);
      tickFor(rig, 0.4);
      rig.core.ErrorReporter._resetForTests();
      rig.core.Faults.set('audio.fail', { phase: 'definition', count: 2 });
      tickFor(rig, 1.5);
      t.eq(rig.core.ErrorReporter.records().filter((record) => record.code === 'E-AUD-004').length, 0, 'no audio error');
      t.eq(rig.events['audio.panic'].filter((event) => event.hard).length, 0, 'no rebuild');
      t.eq(rig.core.Faults.active('audio.fail'), null, 'the fault was used');
      t.eq(transport.state(), 'playing');
      t.eq(rig.engine.VoiceAllocator.stats().dropped, 0, 'no note was lost');
    } finally {
      endRig(rig);
    }
  });

  t.test('FI-006 scheduling calls fail repeatedly: three failures, each recovered; the notes after them play', () => {
    const rig = audioRig();
    try {
      playNotes(rig, 12);
      tickFor(rig, 0.3);
      rig.core.ErrorReporter._resetForTests();
      rig.core.Faults.set('audio.fail', { phase: 'schedule', count: 3 });
      tickFor(rig, 3);
      t.eq(rig.core.Faults.active('audio.fail'), null, 'all three were used');
      const record = rig.core.ErrorReporter.records().find((item) => item.code === 'E-AUD-004');
      t.ok(record && record.count >= 1, 'reported');
      t.ok(rig.events['audio.panic'].filter((event) => event.hard).length >= 2, 'recoveries ran, 250 ms apart at most once each');
      const last = rig.events['sched.noteOn'][rig.events['sched.noteOn'].length - 1];
      t.ok(last.tick >= 5 * BEAT, 'playback reached the later notes');
      t.eq(rig.engine.Scheduler.stats().errors >= 3, true);
    } finally {
      endRig(rig);
    }
  });

  t.test('FI-007 the audio context is closed behind the engine: E-AUD-008, return to the menu class, once', async () => {
    const rig = audioRig();
    try {
      playNotes(rig, 8);
      tickFor(rig, 0.3);
      rig.core.ErrorReporter._resetForTests();
      rig.core.Faults.set('audio.fail', { phase: 'closed' });
      tickFor(rig, 0.2);
      const records = rig.core.ErrorReporter.records().filter((item) => item.code === 'E-AUD-008');
      t.eq(records.length, 1);
      t.eq(records[0].class, 'returnToMenu');
      t.eq(rig.engine.state(), 'closed');
      tickFor(rig, 0.2);
      t.eq(rig.core.ErrorReporter.records().filter((item) => item.code === 'E-AUD-008')[0].count, 1,
        'reported once, not at every tick');
      for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();      // M-28 leaves and shows the returned dialog
      FLM.UI.closeAllDialogs('test');
    } finally {
      endRig(rig);
    }
  });

  t.test('IT-046 an audio panic never touches project data (partial until Phase 09: the project is a stand-in)', () => {
    const rig = audioRig();
    const touched = [];
    const hadProject = Object.prototype.hasOwnProperty.call(FLM, 'Project');
    const saved = FLM.Project;
    const project = { title: 'dirty', tracks: [{ id: 'a', events: [1, 2, 3] }] };
    const watchedProject = new Proxy(project, { get(target, name) { touched.push(String(name)); return target[name]; },
      set() { touched.push('set'); return true; } });
    FLM.Project = { current: () => watchedProject, isDirty: () => true };
    try {
      const snapshot = JSON.stringify(project);
      playNotes(rig, 8);
      tickFor(rig, 0.3);
      [1, 2, 3].forEach(() => { rig.engine.panic(true); tickFor(rig, 0.1); });
      t.deepEq(touched, [], 'the audio module never read or wrote the project');
      t.eq(JSON.stringify(project), snapshot);
    } finally {
      if (hadProject) FLM.Project = saved;
      else delete FLM.Project;
      endRig(rig);
    }
  });

});
})();
