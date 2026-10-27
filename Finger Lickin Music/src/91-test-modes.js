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
});
})();
