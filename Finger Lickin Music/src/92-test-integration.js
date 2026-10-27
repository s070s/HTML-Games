// 92-test-integration.js - IT integration tests (Part 12.5; group 'integration'; test build only; also run in the touch
// pass). Created by T03.03 with IT-002 and IT-043. Later entries append rows.
// IT-002 is partial until Phase 06 exit: the input and pressed-class assertions run now on the real M-26 pads and the
// real M-07 listeners; the audio assertions (sched.noteOn and noteOff, activeVoices) wait for Free Play sound.
// IT-043 runs against the real Modes leave steps. Modes does not bind the input context on enter yet (T03.10), so the
// test binds one itself and routes the Input.unbind of Modes to that owner through a stand-in namespace.
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
});
})();
