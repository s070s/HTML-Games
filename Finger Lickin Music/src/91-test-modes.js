// 91-test-modes.js - unit tests for M-28 FLM.Modes (group 'modes'; test build only).
// T01.09 delivers UT-28-04 to UT-28-07. Rows that need modules built later (audio, transport, charts, stage) are
// adapted to the modules that exist now: the failing setup step is a screen controller that throws, and the
// "stub Stage.dispose" step uses a stand-in FLM.Stage namespace. The "x" tests check the wiring around them.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('modes', (t) => {
  const Core = FLM.Core;
  const UI = FLM.UI;
  const Modes = FLM.Modes;
  const bus = Core.bus;
  const doc = window.document;
  const REGIONS = ['overlay', 'hud', 'touch'];
  const FOREIGN_OWNER = 'foreign-owner';
  const LONG_TIMER_MS = 600000;

  let ownsInit = false;
  let savedChildren = {};
  let log = [];
  let replaced = [];                         // [{name, had, value}] namespaces swapped for stand-ins

  t.before(() => {
    if (UI.counters().initialized) return;
    UI.init({ settings: {}, caps: {} });
    ownsInit = true;
  });

  t.after(() => {
    if (ownsInit) UI._teardownForTests();
    Modes._teardownForTests();               // a fresh baseline, now that the UI listeners are gone
  });

  // A screen controller that records its mount and unmount.
  function controllerFor(id, extra) {
    return () => Object.assign({
      mount(root) {
        log.push('mount ' + id);
        root.appendChild(UI.el('p', null, id));
      },
      unmount() {
        log.push('unmount ' + id);
      }
    }, extra);
  }

  function useScreens(overrides) {
    UI.Screens.setResolver((id) => (overrides && overrides[id] ? overrides[id] : controllerFor(id)));
  }

  // Swaps a whole namespace for a stand-in; afterEach puts it back (frozen namespaces cannot be stubbed per member).
  function standIn(name, value) {
    replaced.push({ name, had: Object.prototype.hasOwnProperty.call(FLM, name), value: FLM[name] });
    FLM[name] = value;
  }

  const yieldTurn = () => new Promise((resolve) => Core.timers.setTimeout(resolve, 0, t.owner));

  t.beforeEach(async () => {
    UI._resetForTests();
    savedChildren = {};
    REGIONS.forEach((id) => {
      const node = doc.getElementById(id);
      savedChildren[id] = Array.from(node.childNodes);
      savedChildren[id].forEach((child) => child.remove());
    });
    Core.ErrorReporter._resetForTests();
    log = [];
    replaced = [];
    Modes._teardownForTests();
    useScreens();
    const entered = await Modes.enter('menu');
    t.eq(entered.ok, true, 'the menu root is mounted');
    log = [];
  });

  t.afterEach(async () => {
    await Modes.leave('user');
    UI.closeAllDialogs('test');
    replaced.reverse().forEach((item) => {
      if (item.had) FLM[item.name] = item.value;
      else delete FLM[item.name];
    });
    UI._resetForTests();
    REGIONS.forEach((id) => {
      const node = doc.getElementById(id);
      Array.from(node.childNodes).forEach((child) => child.remove());
      savedChildren[id].forEach((child) => node.appendChild(child));
    });
    Modes._teardownForTests();
  });

  t.test('UT-28-01x enter and leave a panel mode is clean', async () => {
    const events = [];
    bus.on('mode.enter', (event) => events.push('enter ' + event.mode), t.owner);
    bus.on('mode.leave', (event) => events.push('leave ' + event.mode + ' ' + event.leaks), t.owner);
    t.eq(Modes.MODES.length, 16);
    t.eq(Object.keys(Modes.REQUIREMENTS).length, 16);
    const result = await Modes.enter('settings', { from: 'test' });
    t.deepEq(result, { ok: true, mode: 'settings' });
    t.eq(doc.body.dataset.mode, 'settings');
    t.eq(UI.Screens.depth(), 2);
    t.deepEq(Modes.params(), { from: 'test' });
    const left = await Modes.leave('user');
    t.eq(left.leaks, null);
    t.eq(Modes.assertClean(), null);
    t.eq(Modes.current().mode, 'menu');
    t.eq(doc.body.dataset.mode, 'menu');
    t.deepEq(events, ['enter settings', 'leave settings null']);
    t.deepEq(log, ['mount SCR-Settings', 'unmount SCR-Settings']);
    t.eq(Modes.isGameplay('quickplay'), true);
    t.eq(Modes.isGameplay('freeplay'), false);
  });

  t.test('UT-28-04 transitions serialize', async () => {
    const events = [];
    const transitioningSeen = [];
    const note = (text) => {
      events.push(text);
      transitioningSeen.push(Modes.isTransitioning());
    };
    bus.on('mode.enter', (event) => note('enter ' + event.mode), t.owner);
    bus.on('mode.leave', (event) => note('leave ' + event.mode), t.owner);
    let active = 0;
    let overlapped = false;
    const slow = (id) => controllerFor(id, {
      async mount(root) {
        active += 1;
        overlapped = overlapped || active > 1;
        root.appendChild(UI.el('p', null, id));
        await yieldTurn();
        active -= 1;
      },
      async unmount() {
        active += 1;
        overlapped = overlapped || active > 1;
        active -= 1;
      }
    });
    useScreens({ 'SCR-MainMenu': controllerFor('SCR-MainMenu'), 'SCR-Settings': slow('SCR-Settings'),
      'SCR-Help': slow('SCR-Help') });
    const first = Modes.enter('settings');
    const second = Modes.enter('help');
    const results = await Promise.all([first, second]);
    t.eq(results[0].ok && results[1].ok, true);
    t.eq(Modes.current().mode, 'help');
    t.deepEq(events, ['enter settings', 'leave settings', 'enter help']);
    t.ok(transitioningSeen.every(Boolean), 'every event fired inside a transition');
    t.eq(overlapped, false, 'no two transitions overlapped');
    t.eq(Modes.isTransitioning(), false);
  });

  t.test('UT-28-05 enter failure returns to the menu', async () => {
    useScreens({ 'SCR-MainMenu': controllerFor('SCR-MainMenu'),
      'SCR-Settings': () => ({ mount() { throw new Error('settings screen failed'); } }) });
    const result = await Modes.enter('settings');
    t.eq(result.ok, false);
    t.eq(result.mode, 'menu');
    t.eq(Modes.current().mode, 'menu');
    const recorded = Core.ErrorReporter.records().filter((record) => record.code === 'E-MODE-002');
    t.eq(recorded.length, 1, 'E-MODE-002 is recorded');
    t.ok(recorded[0].userMessage.includes('settings could not start'), recorded[0].userMessage);
    t.ok(doc.querySelector('[data-dialog="DLG-Unsupported"]') !== null, 'DLG-Unsupported is shown');
    UI.closeAllDialogs('test');
    t.eq(Modes.assertClean(), null);
    t.eq(UI.Screens.depth(), 1);
  });

  t.test('UT-28-05b an unknown mode is refused', async () => {
    const result = await Modes.enter('nonsense');
    t.eq(result.ok, false);
    t.eq(result.mode, 'menu');
    UI.closeAllDialogs('test');
    t.eq(Modes.assertClean(), null);
  });

  t.test('UT-28-06 leave step failure continues', async () => {
    await Modes.enter('settings');
    standIn('Stage', { dispose() { throw new Error('stage dispose failed'); } });
    UI.HUD.show('instrument');
    const left = await Modes.leave('user');
    const failures = Core.ErrorReporter.records().filter((record) => record.code === 'E-MODE-003');
    t.ok(failures.some((record) => record.context.step === 'stage'), 'E-MODE-003 names the stage step');
    t.eq(doc.getElementById('hud').hidden, true, 'the HUD step still ran');
    t.eq(UI.Screens.depth(), 1, 'the screens step still ran');
    t.eq(Modes.current().mode, 'menu');
    t.eq(left.leaks, null);
  });

  t.test('UT-28-07 assertClean detects leaks', async () => {
    await Modes.enter('settings');
    await Modes.leave('user');
    t.eq(Modes.assertClean(), null);
    const timerId = Core.timers.setTimeout(() => {}, LONG_TIMER_MS, FOREIGN_OWNER);
    const off = bus.on('leak.test', () => {}, FOREIGN_OWNER);
    try {
      const leaks = Modes.assertClean();
      t.ok(leaks !== null, 'a leak is reported');
      t.eq(leaks.timers.actual, leaks.timers.expected + 1);
      t.eq(leaks.busListeners.actual, leaks.busListeners.expected + 1);
      t.deepEq(Object.keys(leaks).sort(), ['busListeners', 'timers']);
    } finally {
      Core.timers.clearTimeout(timerId);
      off();
    }
    t.eq(Modes.assertClean(), null);
  });

  t.test('UT-28-08x audio gate refuses or waits for the dialog', async () => {
    standIn('Audio', { isUnlocked: () => false });
    // The real Screens.dialog waits for a click; the first half answers "cancel" itself (afterEach restores it).
    standIn('Screens', { Settings: FLM.Screens.Settings, dialog: async () => 'cancel' });
    const refused = await Modes.enter('quickplay');
    t.eq(refused.ok, false);
    t.eq(refused.mode, 'menu');
    t.ok(Core.ErrorReporter.records().some((record) => record.code === 'E-AUD-002'), 'E-AUD-002 is recorded');
    standIn('Screens', { Settings: FLM.Screens.Settings, dialog: async () => 'enabled' });
    const allowed = await Modes.enter('quickplay');
    t.eq(allowed.ok, true);
    t.eq(Modes.current().mode, 'quickplay');
  });

  t.test('UT-28-09x interruptions pause gameplay and leave panels alone', async () => {
    let transportState = 'playing';
    const pauses = [];
    standIn('Transport', { main: { state: () => transportState, song: () => null, unload() {},
      pause() { transportState = 'paused'; pauses.push('pause'); }, resume() { transportState = 'playing'; },
      stop() { transportState = 'stopped'; } } });
    const interrupted = [];
    bus.on('mode.interrupted', (event) => interrupted.push(event), t.owner);
    await Modes.enter('quickplay');
    t.eq(Modes.onInterrupt('visible'), 'continued');
    t.eq(Modes.onInterrupt('hidden'), 'paused');
    await yieldTurn();
    t.eq(UI.Screens.current().id, 'SCR-Pause');
    t.eq(pauses.length, 1);
    t.deepEq(interrupted[interrupted.length - 1], { mode: 'quickplay', cause: 'hidden', action: 'paused' });
    t.eq(await Modes.resume(), true);
    t.eq(UI.Screens.current().id, 'SCR-QuickPlay');
    t.eq(Modes.onInterrupt('stall', { gapMs: 100 }), 'ignored');
    const left = await Modes.leave('user');
    t.eq(left.leaks, null);
    await Modes.enter('help');
    t.eq(Modes.onInterrupt('hidden'), 'ignored');
    t.eq(Modes.onInterrupt('audio'), 'ignored');
  });

  t.test('UT-26-06x init installs the popstate wiring once', async () => {
    t.fakes.stub(window.history, 'back');
    t.fakes.stub(window.history, 'go');
    const before = Core.dom.count();
    Modes.init();
    const after = Core.dom.count();
    t.ok(after > before, 'init installs listeners');
    Modes.init();
    t.eq(Core.dom.count(), after, 'a second init adds nothing');
    await Modes.enter('settings');
    t.eq(UI.Screens.depth(), 2);
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: { flm: 1, depth: 1 } }));
    await yieldTurn();
    t.eq(UI.Screens.depth(), 1, 'browser back pops the screen through UI.Screens.onPopState');
  });

  // ------------------------------------------------------------------------------------ T02.06: one engine (S-18)
  const TRANSPORT_SOURCES = ['none', 'song', 'tempo', 'project', 'preview', 'tutorial'];
  const SCHEDULER_BINDINGS = ['none', 'bound', 'preview'];
  const NAMESPACE_KEYS = ['VERSION', 'BUILD', 'RELAY_URL', 'Core', 'Theory', 'Model', 'Transport', 'Audio',
    'Instruments', 'Input', 'Mapping', 'Rhythm', 'Midi', 'Zip', 'MusicXml', 'GuitarPro', 'Import', 'Project', 'Storage',
    'Studio', 'Render', 'Rig', 'Animation', 'Stage', 'Character', 'Dance', 'Net', 'Progress', 'UI', 'Screens', 'Modes',
    'Boot', 'Content', 'SelfTest', 'selfTest', 'selfTestReady', 'diagnostics', 'debug'];   // Part 4.8
  const PREVIEW_STOP_WAIT_MS = 80;

  function musicSong(id) {
    const Model = FLM.Model;
    const song = Model.Song.create({ id, title: 'Test ' + id });
    const track = Model.Track.create({ name: 'solo' }, song);
    Model.replaceEvents(track, [Model.Events.note(0, 960, 60, 100), Model.Events.note(960, 960, 64, 100)]);
    Model.Song.addTrack(song, track);
    song.durationTicks = 3840;
    return song;
  }

  // A stand-in Transport.main that records what Modes asks of it (the real one is checked in the other tests).
  function recordingMain() {
    const calls = [];
    let loaded = null;
    const record = (name) => (...args) => { calls.push([name].concat(args)); return true; };
    const main = {
      state: () => 'stopped',
      song: () => loaded,
      load(song, options) { loaded = song; calls.push(['load', song.id, options]); },
      unload() { loaded = null; calls.push(['unload']); },
      stop() {},
      pause: record('pause'),
      resume: record('resume'),
      setVisibilityPolicy: record('policy'),
      onHidden: record('hidden'),
      onVisible: record('visible')
    };
    return { calls, main };
  }

  const isDeepFrozen = (value) => Object.isFrozen(value) && Object.values(value)
    .every((item) => item === null || typeof item !== 'object' || isDeepFrozen(item));

  t.test('T02.06 every requirement row names one transport source and one scheduler binding', () => {
    Modes.MODES.forEach((mode) => {
      const row = Modes.REQUIREMENTS[mode];
      t.ok(TRANSPORT_SOURCES.includes(row.transport), mode + ' transport ' + row.transport);
      t.ok(SCHEDULER_BINDINGS.includes(row.scheduler), mode + ' scheduler ' + row.scheduler);
      if (row.scheduler === 'bound') t.ok(!['none', 'preview'].includes(row.transport), mode + ' binds a song');
      if (row.scheduler === 'preview') t.eq(row.transport, 'preview', mode + ' previews on the transport');
    });
    t.eq(isDeepFrozen(Modes.REQUIREMENTS), true);
  });

  t.test('T02.06 free play, studio and the tutorial load Song.create songs into the one Transport.main', async () => {
    const main = FLM.Transport.main;
    t.eq(main.song(), null);
    await Modes.enter('freeplay', { overrideBpm: 90 });
    t.eq(main.song().id, 'freeplay');
    t.eq(main.song().tracks.length, 1);
    t.eq(main.state(), 'stopped');
    t.near(main.tempoMap().tempoAt(0).bpm, 90, 1e-3);   // the tempo map stores whole microseconds per quarter
    t.eq((await Modes.leave('user')).leaks, null);
    t.eq(main.song(), null);
    await Modes.enter('studio');
    t.eq(main.song().id, 'studio');
    t.eq(main.song().tracks.length, 0);
    t.eq((await Modes.leave('user')).leaks, null);
    t.eq(main.song(), null, 'leaving studio unloads even without a Studio session');
    t.eq(Modes.assertClean(), null);
  });

  t.test('T02.06 gameplay modes load params.song or the catalog song and refuse an unknown id', async () => {
    const main = FLM.Transport.main;
    const asked = [];
    const getSong = (id) => {
      asked.push(id);
      return id === 'missing' ? null : musicSong(id);
    };
    standIn('Project', { Catalog: { getSong } });
    const given = musicSong('given');
    await Modes.enter('quickplay', { song: given });
    t.ok(main.song() === given, 'the song of the params is loaded as it is');
    await Modes.enter('instrument', { songId: 'known' });
    t.eq(main.song().id, 'known');
    await Modes.enter('tutorial');
    t.eq(main.song().id, 'tut-basics');
    t.deepEq(asked, ['known', 'tut-basics']);
    const refused = await Modes.enter('dance', { songId: 'missing' });
    t.eq(refused.ok, false);
    t.ok(Core.ErrorReporter.records().some((record) => record.code === 'E-MODE-002'), 'E-MODE-002 is recorded');
    UI.closeAllDialogs('test');
    t.eq(main.song(), null, 'the failed enter leaves nothing loaded');
    t.eq(Modes.assertClean(), null);
  });

  t.test('T02.06 modes only ever use Transport.main and set the visibility policy of their kind', async () => {
    const spy = recordingMain();
    const created = [];
    standIn('Transport', { create() { created.push('create'); }, main: spy.main });
    await Modes.enter('freeplay', { overrideBpm: 100 });
    await Modes.enter('quickplay', { song: musicSong('q') });
    t.deepEq(created, [], 'no mode creates a transport of its own');
    t.deepEq(spy.calls.filter((call) => call[0] === 'load').map((call) => call[1]), ['freeplay', 'q']);
    t.deepEq(spy.calls.filter((call) => call[0] === 'policy').map((call) => call[1]), ['continue', 'pause']);
    t.deepEq(spy.calls.find((call) => call[0] === 'load')[2], { tempoSource: 'override', overrideBpm: 100 });
    t.eq(spy.calls.some((call) => call[0] === 'unload'), true, 'leaving unloads the song');
  });

  t.test('T02.06 live modes note the background on Transport.main; gameplay modes pause instead', async () => {
    const spy = recordingMain();
    standIn('Transport', { main: spy.main });
    const watched = ['hidden', 'visible', 'pause'];
    const names = () => spy.calls.map((call) => call[0]).filter((name) => watched.includes(name));
    await Modes.enter('freeplay');
    t.eq(Modes.onInterrupt('hidden'), 'released');
    t.eq(Modes.onInterrupt('visible'), 'continued');
    t.deepEq(names(), ['hidden', 'visible']);
    const hiddenCall = spy.calls.find((call) => call[0] === 'hidden');
    t.eq(hiddenCall.length, 3, 'audio time and performance time are passed');
    spy.calls.length = 0;
    await Modes.enter('quickplay', { song: musicSong('g') });
    t.eq(Modes.onInterrupt('hidden'), 'paused');
    await yieldTurn();
    t.deepEq(names(), ['pause'], 'a gameplay mode pauses and does not take the live path');
    await Modes.resume();
    t.eq(Modes.onInterrupt('visible'), 'continued');
    t.deepEq(names(), ['pause'], 'a gameplay mode stays paused when visible again');
  });

  t.test('T02.06 a re-anchor reported by Transport.main on return is logged as E-AUD-009 once', async () => {
    const spy = recordingMain();
    spy.main.onVisible = () => ({ drifted: true, driftMs: 7000 });
    standIn('Transport', { main: spy.main });
    await Modes.enter('studio');
    Modes.onInterrupt('hidden');
    t.eq(Modes.onInterrupt('visible'), 'continued');
    const drift = Core.ErrorReporter.records().filter((record) => record.code === 'E-AUD-009');
    t.eq(drift.length, 1);
    t.eq(drift[0].class, 'recoverable');
  });

  t.test('T02.06 a preview plays on Transport.main in library and import and ends with the mode', async () => {
    const main = FLM.Transport.main;
    await Modes.enter('library');
    t.deepEq(await Modes.preview(musicSong('p1')), { ok: true });
    t.eq(main.state(), 'playing');
    t.eq(main.song().id, 'p1');
    await Modes.stopPreview();
    t.eq(main.state(), 'stopped');
    t.eq(main.song(), null);
    await Modes.stopPreview();
    t.deepEq(await Modes.preview(musicSong('p2')), { ok: true });
    const left = await Modes.leave('user');
    t.eq(left.leaks, null, 'leaving during a preview is clean');
    t.eq(main.song(), null);
    await Modes.enter('import');
    t.deepEq(await Modes.preview(musicSong('p3'), { durationS: 0.02 }), { ok: true });
    await new Promise((resolve) => Core.timers.setTimeout(resolve, PREVIEW_STOP_WAIT_MS, t.owner));
    t.eq(main.state(), 'stopped', 'the preview stops by itself');
    t.eq(main.song(), null);
    await Modes.enter('settings');
    t.deepEq(await Modes.preview(musicSong('p4')), { ok: false }, 'panel modes without a preview row refuse');
    t.eq(main.song(), null);
  });

  t.test('IT-047 (partial) transitions serialize on the one Transport.main; audio parts wait for T04.01', async () => {
    const events = [];
    bus.on('mode.enter', (event) => events.push('enter ' + event.mode), t.owner);
    bus.on('mode.leave', (event) => events.push('leave ' + event.mode), t.owner);
    const main = FLM.Transport.main;
    const results = await Promise.all([Modes.enter('quickplay', { song: musicSong('a') }),
      Modes.enter('quickplay', { song: musicSong('b') })]);
    t.eq(results[0].ok && results[1].ok, true);
    t.deepEq(events, ['enter quickplay', 'leave quickplay', 'enter quickplay']);
    t.ok(FLM.Transport.main === main, 'the same Transport.main throughout');
    t.eq(main.song().id, 'b');
    t.ok(FLM.Transport.create() !== main, 'create() makes private instances; only main is bound to modes');
    t.eq(Core.modules().filter((item) => item.name === 'Transport').length, 1);
  });

  t.test('IT-037 (partial) tables stay frozen and namespaces closed after every mode was entered and left once',
    async () => {
      const left = [];
      for (const mode of Modes.MODES.filter((name) => name !== 'menu')) {
        const entered = await Modes.enter(mode);
        UI.closeAllDialogs('test');
        t.eq(entered.ok, true, mode + ' entered');
        left.push((await Modes.leave('user')).leaks);
      }
      t.deepEq(left, new Array(left.length).fill(null), 'every leave is clean');
      [FLM.Theory.SCALES, FLM.Model.KIND_PRIORITY, FLM.Model.TRACK_COLORS, FLM.Transport.STATES, Modes.REQUIREMENTS,
        Modes.MODES].forEach((table, index) => t.eq(isDeepFrozen(table), true, 'table ' + index + ' is deep-frozen'));
      const extra = Object.keys(FLM).filter((key) => !NAMESPACE_KEYS.includes(key));
      t.deepEq(extra, [], 'no module added keys to the FLM namespace');
    });
});
})();
