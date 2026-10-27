// 91-test-input.js - unit tests for M-07 FLM.Input (group 'input'; test build only; also run in the touch pass).
// T03.01: UT-07-01 to UT-07-11, UT-07-14, UT-07-15, UT-07-31 and the input part of TT-025 and PT-009.
// T03.02: UT-07-16 to UT-07-25 (pointer, Touch Events fallback, gamepad, MIDI on fakes: no hardware is used).
// T03.03: UT-07-12, UT-07-13, UT-07-29, UT-07-30, the lifecycle rows of Part 6.7 and E 4.1, the input part of FI-027
// and TT-029, and the anchor half of TT-021. T03.04: UT-07-26 to UT-07-28 (maps API: remap, unmap, setMap, resetMap,
// conflicts, input.map); UT-07-32 belongs to T03.09.
// Every test starts from a private fixture: four pads laid out here, a fresh init, the instrument context bound.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('input', (t) => {
  const Core = FLM.Core;
  const Input = FLM.Input;
  const bus = Core.bus;
  const doc = window.document;
  const nav = window.navigator;
  const OWNER = Symbol('input-test');
  const PAD_LEFT = 10;
  const PAD_TOP = 100;
  const PAD_SIZE = 80;
  const PAD_STEP = 90;
  const GAMEPAD_BUTTONS = 17;
  const SAMPLE_STEP_MS = 25;
  const ANCHOR_SIZE = 20;
  const EPOCH_MS = 1.7e12;
  const FRAME_LIMIT_MS = 16.7;
  const P95_LIMIT_MS = 4;
  const WARM_UP_PRESSES = 10;
  const MEASURED_PRESSES = 40;
  const SCRATCH_ID = 'input-test-scratch';

  let wasAttached = false;
  let fixture = null;
  let events = [];
  let clock = null;
  let restores = [];
  let savedAudio = { had: false, value: undefined };

  // ------------------------------------------------------------------------------------------ helpers
  function buildFixture() {
    const root = doc.createElement('div');
    const surface = doc.createElement('div');
    [root, surface].forEach((node) => {
      node.id = SCRATCH_ID;
      node.setAttribute('aria-hidden', 'true');
      Object.assign(node.style, { position: 'fixed', left: '0px', top: '0px', width: '400px', height: '200px',
        visibility: 'hidden' });
      doc.body.appendChild(node);
    });
    const pads = [0, 1, 2, 3].map((index) => {
      const pad = doc.createElement('div');
      pad.className = 'pad';
      Object.assign(pad.style, { position: 'absolute', left: PAD_LEFT + index * PAD_STEP + 'px',
        top: PAD_TOP + 'px', width: PAD_SIZE + 'px', height: PAD_SIZE + 'px' });
      root.appendChild(pad);
      return pad;
    });
    return { root, surface, pads, remove() { root.remove(); surface.remove(); } };
  }

  const padCenter = (index) => ({ x: PAD_LEFT + index * PAD_STEP + PAD_SIZE / 2, y: PAD_TOP + PAD_SIZE / 2 });

  function attach(extra) {
    Input.detach();
    Input.init(Object.assign({ keyboardTarget: window, padRoot: fixture.root, surface: fixture.surface,
      touchApi: 'pointer' }, extra));
    Input.bind({ owner: OWNER, context: 'instrument' });
  }

  /** Empties the list the recorder (installed once per test) fills; `events` is rebound, never appended twice. */
  function record() {
    events = [];
  }

  t.before(() => {
    wasAttached = Input.listenerCount() > 0;
  });

  t.after(() => {
    Input.detach();
    if (!wasAttached) return;
    Input.init({ keyboardTarget: window, padRoot: doc.getElementById('touch'), surface: doc.getElementById('view') });
  });

  t.beforeEach(() => {
    fixture = buildFixture();
    savedAudio = { had: Object.prototype.hasOwnProperty.call(FLM, 'Audio'), value: FLM.Audio };
    clock = null;
    attach();
    record();
    bus.on('input.event', (event) => events.push(event), t.owner);
  });

  t.afterEach(() => {
    Input.synthesize.gamepad(null);          // announces a disconnect, so M-26 stops its gamepad menu polling
    Input.pollGamepad(window.performance.now());
    Input.detach();
    Input.resetMap();                        // a test that remapped keys must not leak them into the next
    Input.debugClear();
    fixture.remove();
    restores.reverse().forEach((restore) => restore());
    restores = [];
    if (savedAudio.had) FLM.Audio = savedAudio.value;
    else delete FLM.Audio;
    Core.ErrorReporter._resetForTests();
  });

  /** Puts a fake performance clock behind performance.now(); every stamp in the test is then exact. */
  function fakeClock(startMs) {
    clock = { now: startMs };
    t.fakes.stub(window.performance, 'now', () => clock.now);
    return clock;
  }

  /** A fake AudioContext whose currentTime follows the fake clock plus `offset` seconds. */
  function installAudio(offset, stateName) {
    const context = { state: stateName || 'running', offset,
      get currentTime() { return clock.now / 1000 + this.offset; } };
    FLM.Audio = { ctx: () => context };
    return context;
  }

  function standIn(name, value) {
    const had = Object.prototype.hasOwnProperty.call(FLM, name);
    const original = FLM[name];
    FLM[name] = value;
    restores.push(() => {
      if (had) FLM[name] = original;
      else delete FLM[name];
    });
  }

  /** Overrides one own property of a global object and puts the original descriptor back after the test. */
  function overrideProperty(object, name, descriptor) {
    const original = Object.getOwnPropertyDescriptor(object, name);
    Object.defineProperty(object, name, Object.assign({ configurable: true }, descriptor));
    restores.push(() => {
      if (original) Object.defineProperty(object, name, original);
      else delete object[name];
    });
  }

  const shape = (list) => list.map((event) => event.type + ' ' + event.control + ' ' + event.source);

  function key(code, down, tPerf, mods) {
    return Input.synthesize.key(code, down, tPerf, mods);
  }

  function dispatchKey(type, code, init) {
    const event = new window.KeyboardEvent(type, Object.assign({ code, bubbles: true, cancelable: true }, init));
    window.dispatchEvent(event);
    return event;
  }

  function dispatchPointer(type, target, id, point, init) {
    const event = new window.PointerEvent(type, Object.assign({ pointerId: id, clientX: point.x, clientY: point.y,
      pointerType: 'touch', pressure: 0.5, bubbles: type !== 'pointerleave', cancelable: true }, init));
    target.dispatchEvent(event);
    return event;
  }

  function dispatchTouch(type, target, touches) {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'changedTouches', { value: touches });
    target.dispatchEvent(event);
    return event;
  }

  const touchAt = (identifier, index) => Object.assign({ identifier, force: 0 }, { clientX: padCenter(index).x,
    clientY: padCenter(index).y });

  function fakePad(downIndexes, extra) {
    const buttons = [];
    for (let index = 0; index < GAMEPAD_BUTTONS; index += 1) {
      const down = downIndexes.includes(index);
      buttons.push({ pressed: down, value: down ? 1 : 0 });
    }
    return Object.assign({ index: 0, id: 'Test Pad', mapping: 'standard', buttons }, extra);
  }

  function fakeMidi(inputNames, requests) {
    const access = new window.EventTarget();
    access.inputs = new Map();
    inputNames.forEach((name) => {
      const port = new window.EventTarget();
      Object.assign(port, { id: name, name, type: 'input', state: 'connected' });
      access.inputs.set(name, port);
    });
    overrideProperty(nav, 'requestMIDIAccess', { writable: true, value: async (options) => {
      requests.push(options);
      return access;
    } });
    return access;
  }

  // ------------------------------------------------------------------------------------------ T03.01
  t.test('UT-07-01 default maps match BRIEF 7', () => {
    const keys = Input.DEFAULT_MAPS.keyboard;
    t.deepEq(['lane0', 'lane1', 'lane2', 'lane3'].map((lane) => keys.instrument[lane][0]),
      ['KeyA', 'KeyS', 'KeyK', 'KeyL']);
    t.deepEq(['dance0', 'dance1', 'dance2', 'dance3'].map((arrow) => keys.dance[arrow]),
      [['ArrowLeft', 'KeyD'], ['ArrowDown', 'KeyF'], ['ArrowUp', 'KeyJ'], ['ArrowRight', 'KeyK']]);
    t.deepEq(keys.global, { pause: ['Escape'], panic: ['KeyP'], panicWhilePaused: ['Space'] });
    t.deepEq([keys.instrument.octDown, keys.instrument.octUp], [['KeyQ'], ['KeyE']]);
    t.deepEq(keys.instrument.sustain, ['ShiftLeft', 'ShiftRight']);
    t.deepEq([1, 2, 3, 4, 5, 6].map((number) => keys.freeplay['profile' + number][0]),
      ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6']);
    t.deepEq(Object.keys(keys.studio), Object.keys(keys.freeplay));
    t.deepEq(Input.DEFAULT_MAPS.midi, { lane0: 60, lane1: 62, lane2: 64, lane3: 65, sustainCC: 64 });
    t.eq(Object.isFrozen(Input.DEFAULT_MAPS) && Object.isFrozen(keys.dance.dance0), true, 'the defaults are frozen');
    t.eq(Input.CONTROLS.length, 19);
    t.deepEq(Input.controlsFor('dance'), ['dance0', 'dance1', 'dance2', 'dance3', 'pause', 'panic']);
    t.deepEq(Input.controlsFor('menu'), []);
    t.eq(Input.controlsFor('freeplay').length, 15);
  });

  t.test('UT-07-02 init is idempotent-guarded', () => {
    const count = Input.listenerCount();
    const busCount = bus.listenerCount();
    t.ok(count > 0, 'init installed listeners');
    t.throws(() => Input.init({ keyboardTarget: window, padRoot: fixture.root, surface: fixture.surface }),
      'E-GEN-004');
    t.eq(Input.listenerCount(), count);
    t.eq(bus.listenerCount(), busCount);
    const report = Core.ErrorReporter.records().pop();
    t.eq(report.code, 'E-GEN-004');
    t.eq(report.class, 'recoverable', 'the report reaches the ErrorReporter');
  });

  t.test('UT-07-03 detach removes all listeners', () => {
    const own = Input.listenerCount();
    const domBefore = Core.dom.count();
    const busBefore = bus.listenerCount();
    Input.detach();
    t.eq(Input.listenerCount(), 0);
    t.eq(Core.dom.count(), domBefore - own, 'every listener went through Core.dom');
    t.eq(bus.listenerCount(), busBefore - 4, 'the four bus subscriptions are gone');
    key('KeyA', true, 10);
    dispatchKey('keydown', 'KeyA');
    t.deepEq(events, []);
    t.eq(Input.context(), 'menu');
    t.eq(Input.boundSurfaces(), 0);
    Input.detach();
    t.eq(Input.listenerCount(), 0, 'a second detach is harmless');
  });

  t.test('UT-07-04 keydown press lifecycle', () => {
    fakeClock(1000);
    installAudio(2.5);
    key('KeyA', true, 1000);
    t.eq(events.length, 1);
    t.deepEq(Object.keys(events[0]), ['source', 'control', 'type', 'tPerf', 'tAudio', 'pressure']);
    t.deepEq([events[0].source, events[0].control, events[0].type, events[0].tPerf, events[0].pressure],
      ['keyboard', 'lane0', 'press', 1000, 1]);
    t.near(events[0].tAudio, 3.5, 1e-9);
    t.eq(Input.State.isHeld('lane0'), true);
    t.deepEq(Input.State.owner('lane0'), { source: 'keyboard', physical: 'KeyA' });
    t.near(Input.State.pressedAt('lane0'), 3.5, 1e-9);
    t.eq(Input.State.isHeld('lane1'), false);
    t.eq(Input.State.owner('lane1'), null);
  });

  t.test('UT-07-05 keyup release', () => {
    fakeClock(1000);
    key('KeyA', true, 1000);
    key('KeyA', false, 1100);
    t.deepEq(shape(events), ['press lane0 keyboard', 'release lane0 keyboard']);
    t.eq(events[1].tPerf, 1100);
    t.eq(events[1].pressure, 0);
    t.deepEq(Input.held(), []);
    t.eq(Input.State.pressedAt('lane0'), null);
  });

  t.test('UT-07-06 event.repeat ignored', () => {
    key('KeyA', true, 1000);
    for (let count = 0; count < 5; count += 1) key('KeyA', true, 1010 + count, { repeat: true });
    t.deepEq(shape(events), ['press lane0 keyboard']);
  });

  t.test('UT-07-07 duplicate keydown ignored', () => {
    key('KeyA', true, 1000);
    key('KeyA', true, 1005);
    t.deepEq(shape(events), ['press lane0 keyboard']);
    key('KeyA', false, 1100);
    key('KeyA', true, 1200);
    t.deepEq(shape(events), ['press lane0 keyboard', 'release lane0 keyboard', 'press lane0 keyboard']);
  });

  t.test('UT-07-08 second owner cannot release', () => {
    const pad = padCenter(0);
    key('KeyA', true, 1000);
    Input.synthesize.pointer(1, 'down', pad.x, pad.y, 0.5, 1010);
    Input.synthesize.pointer(1, 'up', pad.x, pad.y, 0, 1020);
    t.deepEq(Input.held(), ['lane0']);
    t.deepEq(shape(events), ['press lane0 keyboard'], 'one press and no release');
    t.deepEq(Input.State.owner('lane0'), { source: 'keyboard', physical: 'KeyA' });
    key('KeyA', false, 1100);
    t.deepEq(Input.held(), []);
  });

  t.test('UT-07-09 tAudio null before anchor', () => {
    fakeClock(1000);
    installAudio(2.5, 'suspended');
    key('KeyA', true, 1000);
    t.eq(events.length, 1, 'the event is still emitted');
    t.eq(events[0].tAudio, null);
    t.eq(Input.perfToAudio(1000), null);
    t.deepEq(Input.anchor(), { samples: 0, offsetSec: null, spreadMs: 0 });
  });

  t.test('UT-07-10 anchor median rejects outliers', () => {
    fakeClock(0);
    const context = installAudio(1.0);
    const warned = Core.Log.entries().length;
    for (let step = 0; step < ANCHOR_SIZE; step += 1) {
      clock.now = 1000 + step * SAMPLE_STEP_MS;
      context.offset = step === 7 ? 3.0 : 1.0;
      Input.pollGamepad(clock.now);
    }
    const anchor = Input.anchor();
    t.eq(anchor.samples, ANCHOR_SIZE);
    t.near(anchor.offsetSec, 1.0, 1e-9);
    t.near(anchor.spreadMs, 2000, 1e-6);
    t.ok(Core.Log.entries().slice(warned - 1).some((entry) => entry.msg === 'INP_ANCHOR_SPREAD'),
      'a spread above 5 ms is logged');
  });

  t.test('UT-07-11 perfToAudio mapping', () => {
    fakeClock(2000);
    const fixed = { state: 'running', currentTime: 5.0 };
    FLM.Audio = { ctx: () => fixed };
    Input.pollGamepad(2000);
    t.near(Input.perfToAudio(2500), 5.5, 1e-6);
    t.near(Input.audioToPerf(5.5), 2500, 1e-6, 'the inverse mapping used by the test fakes');
  });

  t.test('UT-07-14 modifier combos pass through', () => {
    ['ctrlKey', 'metaKey', 'altKey'].forEach((modifier) => {
      const synthetic = key('KeyA', true, 1000, { [modifier]: true });
      t.eq(synthetic.defaultPrevented, false, modifier + ' is not prevented');
      const real = dispatchKey('keydown', 'KeyA', { [modifier]: true });
      t.eq(real.defaultPrevented, false);
    });
    t.deepEq(events, []);
    const plain = dispatchKey('keydown', 'KeyA', { shiftKey: true });
    t.eq(plain.defaultPrevented, true, 'a bound key is prevented');
    t.deepEq(shape(events), ['press lane0 keyboard'], 'Shift does not change the code');
  });

  t.test('UT-07-15 text field focus blocks gameplay keys', () => {
    const field = doc.createElement('input');
    field.id = SCRATCH_ID;
    doc.body.appendChild(field);
    restores.push(() => { field.blur(); field.remove(); });
    field.focus();
    t.eq(doc.activeElement, field);
    const typed = field.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyA', bubbles: true,
      cancelable: true }));
    t.eq(typed, true, 'the field keeps the key');
    t.deepEq(events, []);
    const escape = key('Escape', true, 1);
    t.deepEq(shape(events), ['press pause keyboard']);
    t.eq(escape.defaultPrevented, false, 'Escape is never prevented');
  });

  t.test('UT-07-31 timestamp sanity fallback', () => {
    key('KeyA', true, EPOCH_MS);
    key('KeyA', false, 0);
    t.eq(events.length, 2);
    events.forEach((event) => t.within(Math.abs(event.tPerf - window.performance.now()), 0, 50));
    const real = dispatchKey('keydown', 'KeyS');
    t.eq(real.defaultPrevented, true);
    t.within(Math.abs(events[2].tPerf - window.performance.now()), 0, 50, 'a real event stamp is accepted');
  });

  t.test('TT-025 input timestamp mapping accuracy (input part)', () => {
    fakeClock(5000);
    installAudio(7.25);
    for (let step = 0; step < 16; step += 1) {
      clock.now = 5000 + step * SAMPLE_STEP_MS;
      Input.pollGamepad(clock.now);
    }
    const stamps = [];
    for (let index = 0; index < 200; index += 1) {
      const tPerf = 6000 + index * 13.7;
      stamps.push(tPerf);
      clock.now = tPerf + 0.3;                  // the handler runs a moment after the browser stamped the event
      key('KeyA', index % 2 === 0, tPerf);
    }
    t.eq(events.length, 200);
    events.forEach((event, index) => {
      t.near(event.tPerf, stamps[index], 1e-9);
      t.near(event.tAudio, stamps[index] / 1000 + 7.25, 1e-3, 'within 1 ms of the true mapping');
    });
  });

  t.test('PT-009 input part: processing per press is far below one frame', () => {
    for (let index = 0; index < WARM_UP_PRESSES; index += 1) {     // an even count leaves the key idle
      key('KeyA', index % 2 === 0, window.performance.now());
    }
    const spent = [];
    for (let index = 0; index < MEASURED_PRESSES; index += 1) {
      const started = window.performance.now();
      key('KeyA', index % 2 === 0, started);
      spent.push(window.performance.now() - started);
    }
    spent.sort((a, b) => a - b);
    t.eq(events.length - WARM_UP_PRESSES, MEASURED_PRESSES);
    t.ok(spent[spent.length - 1] <= FRAME_LIMIT_MS, 'the slowest press took ' + spent[spent.length - 1] + ' ms');
    t.ok(spent[Math.floor(spent.length * 0.95)] <= P95_LIMIT_MS, 'p95 is within the 4 ms budget');
  });

  t.test('anchor: getOutputTimestamp is preferred, else currentTime, and spread stays small for a steady clock', () => {
    fakeClock(4000);
    const context = { state: 'running', currentTime: 99, getOutputTimestamp: () => ({ contextTime: 10,
      performanceTime: 4000 }) };
    FLM.Audio = { ctx: () => context };
    const seen = [];
    bus.on('input.anchor', (event) => seen.push(event), t.owner);
    Input.pollGamepad(4000);
    t.near(Input.anchor().offsetSec, 6, 1e-9);
    t.eq(seen.length, 1);
    t.eq(seen[0].method, 'outputTimestamp');
    context.getOutputTimestamp = () => ({ contextTime: 10, performanceTime: 0 });
    context.currentTime = 4.5;
    Input.resampleAnchor();
    t.near(Input.anchor().offsetSec, 0.5, 1e-9);
    t.eq(Input.anchor().samples, 1, 'resampleAnchor starts a fresh ring');
  });

  t.test('anchor: input.anchor fires on the first sample and then at most once a second when the median moves', () => {
    fakeClock(1000);
    const context = installAudio(1.0);
    const seen = [];
    bus.on('input.anchor', (event) => seen.push(event), t.owner);
    Input.pollGamepad(1000);
    Input.pollGamepad(1025);
    t.eq(seen.length, 1);
    t.deepEq([seen[0].samples, seen[0].method], [1, 'currentTime']);
    t.near(seen[0].offsetSec, 1.0, 1e-9);
    context.offset = 1.01;
    clock.now = 1050;
    Input.pollGamepad(1050);
    t.eq(seen.length, 1, 'a moved median inside the same second is held back');
    clock.now = 2100;
    Input.pollGamepad(2100);
    Input.pollGamepad(2125);
    t.eq(seen.length, 2);
    t.eq(seen[1].samples, 4);
  });

  t.test('anchor: a new AudioContext clears the ring; a missing Audio module maps identically', () => {
    fakeClock(1000);
    installAudio(1.0);
    Input.pollGamepad(1000);
    Input.pollGamepad(1025);
    t.eq(Input.anchor().samples, 2);
    installAudio(5.0);
    clock.now = 1050;
    Input.pollGamepad(1050);
    t.deepEq([Input.anchor().samples, Math.round(Input.anchor().offsetSec)], [1, 5], 'no sample of the old context');
    delete FLM.Audio;
    clock.now = 2000;
    key('KeyA', true, 2000);
    t.eq(events[0].tAudio, 2, 'without M-05 the audio time is the performance time in seconds');
    t.eq(Input.audioToPerf(2), 2000);
  });

  t.test('TT-021 anchor half: ring cleared when audio stops and refilled when it runs again', () => {
    fakeClock(1000);
    const context = installAudio(1.0);
    for (let step = 0; step < 5; step += 1) {
      clock.now = 1000 + step * SAMPLE_STEP_MS;
      Input.pollGamepad(clock.now);
    }
    t.eq(Input.anchor().samples, 5);
    bus.emit('audio.state', { state: 'suspended', unlocked: true });
    t.deepEq(Input.anchor(), { samples: 0, offsetSec: null, spreadMs: 0 });
    t.eq(Input.perfToAudio(1000), null);
    context.state = 'running';
    context.offset = 2.0;
    clock.now = 60000;
    bus.emit('audio.unlocked', { audioTime: 62, sampleRate: 48000, latencyMs: 10, attempts: 1 });
    t.eq(Input.anchor().samples, 1, 'unlock takes a fresh sample at once');
    t.near(Input.perfToAudio(60000), 62, 1e-9);
    bus.emit('audio.state', { state: 'running', unlocked: true });
    t.eq(Input.anchor().samples, 1, 'a running state does not clear');
  });

  // ------------------------------------------------------------------------------------------ keyboard contexts
  t.test('keyboard maps per context: instrument, free play, dance, menu', () => {
    const codes = (list) => { list.forEach((code) => { key(code, true, 1); key(code, false, 2); }); };
    codes(['KeyA', 'KeyS', 'KeyK', 'KeyL', 'KeyQ', 'KeyE', 'Digit1', 'ArrowLeft', 'KeyD']);
    t.deepEq(events.filter((event) => event.type === 'press').map((event) => event.control),
      ['lane0', 'lane1', 'lane2', 'lane3', 'octDown', 'octUp'], 'profiles and arrows are not live in instrument');
    events.length = 0;
    Input.bind({ owner: OWNER, context: 'freeplay' });
    codes(['Digit1', 'Digit6', 'KeyA']);
    t.deepEq(events.filter((event) => event.type === 'press').map((event) => event.control),
      ['profile1', 'profile6', 'lane0']);
    events.length = 0;
    Input.bind({ owner: OWNER, context: 'dance' });
    codes(['ArrowLeft', 'KeyF', 'ArrowUp', 'KeyK', 'KeyA', 'Digit1']);
    t.deepEq(events.filter((event) => event.type === 'press').map((event) => event.control),
      ['dance0', 'dance1', 'dance2', 'dance3'], 'KeyK is dance3 here and lane2 in instrument');
    events.length = 0;
    Input.bind({ owner: OWNER, context: 'menu' });
    codes(['KeyA', 'Escape', 'KeyP']);
    t.deepEq(events, [], 'the menu context has no live controls');
  });

  t.test('pause and panic are global; sustain accepts both shift keys as one control', () => {
    key('Escape', true, 1);
    key('KeyP', true, 2);
    t.deepEq(Input.held(), ['pause', 'panic']);
    Input.bind({ owner: OWNER, context: 'dance' });
    t.deepEq(Input.held(), ['pause', 'panic'], 'global controls stay held across a context change');
    Input.bind({ owner: OWNER, context: 'instrument' });
    key('ShiftLeft', true, 3);
    key('ShiftRight', true, 4);
    t.eq(events.filter((event) => event.control === 'sustain').length, 1);
    key('ShiftRight', false, 5);
    t.eq(Input.State.isHeld('sustain'), true, 'only the key that owns it releases it');
    key('ShiftLeft', false, 6);
    t.eq(Input.State.isHeld('sustain'), false);
  });

  t.test('a soft keyboard without KeyboardEvent.code still gives letters and digits', () => {
    key('', true, 1, { key: 'a' });
    key('', false, 2, { key: 'a' });
    key('', true, 3, { key: 'S' });
    key('', true, 4, { key: 'Enter' });
    key('', true, 5, { key: '1' });
    t.deepEq(shape(events), ['press lane0 keyboard', 'release lane0 keyboard', 'press lane1 keyboard']);
    Input.bind({ owner: OWNER, context: 'freeplay' });
    key('', false, 6, { key: '1' });
    key('', true, 7, { key: '1' });
    t.eq(events[events.length - 1].control, 'profile1');
  });

  t.test('UT-07-30 Space is panic only while paused', () => {
    let status = 'playing';
    standIn('Transport', { main: { state: () => status } });
    const playing = dispatchKey('keydown', 'Space');
    t.deepEq(events, []);
    t.eq(playing.defaultPrevented, false, 'the browser keeps Space while the transport plays');
    dispatchKey('keyup', 'Space');
    status = 'paused';
    const paused = dispatchKey('keydown', 'Space');
    t.deepEq(shape(events), ['press panic keyboard']);
    t.eq(paused.defaultPrevented, true);
    status = 'playing';
    dispatchKey('keyup', 'Space');
    t.deepEq(Input.held(), [], 'the key that pressed it still releases it after the state changed');
  });

  t.test('lifecycle: each control has its own lifecycle and held() keeps press order', () => {
    key('KeyL', true, 1);
    key('KeyA', true, 2);
    key('KeyS', true, 3);
    t.deepEq(Input.held(), ['lane3', 'lane0', 'lane1']);
    key('KeyA', false, 4);
    t.deepEq(Input.held(), ['lane3', 'lane1']);
    t.deepEq(shape(events), ['press lane3 keyboard', 'press lane0 keyboard', 'press lane1 keyboard',
      'release lane0 keyboard']);
  });

  t.test('lifecycle: rapid alternation is never debounced', () => {
    for (let round = 0; round < 10; round += 1) {
      key('KeyA', true, round * 10);
      key('KeyA', false, round * 10 + 5);
    }
    t.eq(events.filter((event) => event.type === 'press').length, 10);
    t.eq(events.filter((event) => event.type === 'release').length, 10);
  });

  t.test('lifecycle: a late keyup after a system release is ignored and the key can press again', () => {
    key('KeyA', true, 1);
    Input.synthesize.blur();
    t.deepEq(shape(events), ['press lane0 keyboard', 'release lane0 system']);
    key('KeyA', false, 2);
    t.eq(events.length, 2, 'the late keyup adds nothing');
    key('KeyA', true, 3);
    t.eq(events.length, 3, 'a new keydown after the release is a new press');
  });

  t.test('lifecycle: a key held across a context change leaves no stale release', () => {
    key('KeyA', true, 1);
    key('Escape', true, 2);
    Input.bind({ owner: OWNER, context: 'dance' });
    t.deepEq(shape(events.slice(2)), ['release lane0 system']);
    key('KeyA', false, 3);
    t.eq(events.length, 3);
    t.deepEq(Input.held(), ['pause']);
  });

  t.test('UT-07-12 blur releases all with source system', () => {
    key('KeyA', true, 1);
    key('KeyK', true, 2);
    window.dispatchEvent(new window.Event('blur'));
    t.deepEq(shape(events.slice(2)), ['release lane0 system', 'release lane2 system']);
    t.deepEq(Input.held(), []);
    key('KeyS', true, 3);
    Input.synthesize.blur();
    t.deepEq(shape(events.slice(-1)), ['release lane1 system']);
  });

  t.test('UT-07-13 visibilitychange hidden and pagehide release all', () => {
    key('KeyS', true, 1);
    Input.synthesize.hidden();
    t.deepEq(shape(events.slice(1)), ['release lane1 system']);
    t.deepEq(Input.held(), []);
    key('KeyS', true, 2);
    Input.synthesize.pagehide();
    t.deepEq(shape(events.slice(-1)), ['release lane1 system']);
    key('KeyS', true, 3);
    window.dispatchEvent(new window.Event('pagehide'));
    t.deepEq(Input.held(), [], 'the real pagehide event releases too');
    key('KeyS', true, 4);
    doc.dispatchEvent(new window.Event('visibilitychange'));
    t.eq(Input.held().length, doc.hidden ? 0 : 1, 'only a hidden document releases');
  });

  t.test('S-13 releaseAll leaves exactly one release per held control and an empty held()', () => {
    key('KeyA', true, 1);
    key('KeyL', true, 2);
    const pad = padCenter(1);
    Input.synthesize.pointer(7, 'down', pad.x, pad.y, 0.5, 3);
    Input.releaseAll('system');
    t.deepEq(shape(events.slice(3)), ['release lane0 system', 'release lane3 system', 'release lane1 system']);
    t.deepEq(Input.held(), []);
    Input.releaseAll('mode');
    t.eq(events.length, 6, 'nothing held, nothing emitted');
    Input.synthesize.pointer(7, 'up', pad.x, pad.y, 0, 4);
    t.eq(events.length, 6, 'the pointer track was dropped with the release');
  });

  // ------------------------------------------------------------------------------------------ bind and unbind
  t.test('UT-07-29 bind releases non-live controls', () => {
    key('KeyA', true, 1);
    key('Escape', true, 2);
    Input.bind({ owner: OWNER, context: 'dance' });
    t.deepEq(shape(events.slice(2)), ['release lane0 system']);
    t.deepEq(Input.held(), ['pause']);
    t.eq(Input.context(), 'dance');
  });

  t.test('bind and unbind: surfaces are counted and unbind returns to the menu', () => {
    t.eq(Input.boundSurfaces(), 1);
    const second = Symbol('second');
    Input.bind({ owner: second, context: 'freeplay' });
    t.eq(Input.boundSurfaces(), 2);
    key('Digit1', true, 1);
    t.eq(Input.unbind(second), true);
    t.deepEq(shape(events), ['press profile1 keyboard', 'release profile1 system']);
    t.eq(Input.context(), 'instrument', 'the remaining binding is in force again');
    t.eq(Input.unbind(second), false, 'an owner that is not bound is ignored');
    t.eq(Input.unbind(OWNER), true);
    t.deepEq([Input.context(), Input.boundSurfaces()], ['menu', 0]);
    t.eq(Input.unbind(Symbol('panel mode')), false, 'panel modes never bind and may still call unbind');
    t.throws(() => Input.bind({ owner: OWNER, context: 'nowhere' }), 'E-GEN-004');
    t.throws(() => Input.bind({ context: 'dance' }), 'E-GEN-004');
  });

  // ------------------------------------------------------------------------------------------ pointer
  t.test('UT-07-16 pointer down/up on pad', () => {
    const pad = padCenter(0);
    Input.synthesize.pointer(1, 'down', pad.x, pad.y, 0.5, 100);
    Input.synthesize.pointer(1, 'up', pad.x, pad.y, 0, 150);
    t.deepEq(shape(events), ['press lane0 pointer', 'release lane0 pointer']);
    t.eq(events[0].pressure, 0.5);
    t.deepEq([events[0].tPerf, events[1].tPerf], [100, 150]);
    Input.synthesize.pointer(2, 'down', 5, 5, 0.5, 200);
    t.eq(events.length, 2, 'a touch outside every pad is not an input');
  });

  t.test('UT-07-17 drag between pads', () => {
    const first = padCenter(0);
    const second = padCenter(1);
    Input.synthesize.pointer(1, 'down', first.x, first.y, 0.5, 100);
    Input.synthesize.pointer(1, 'move', second.x, second.y, 0.5, 110);
    Input.synthesize.pointer(1, 'move', second.x + 5, second.y, 0.5, 115);
    Input.synthesize.pointer(1, 'up', second.x, second.y, 0, 120);
    t.deepEq(shape(events), ['press lane0 pointer', 'release lane0 pointer', 'press lane1 pointer',
      'release lane1 pointer']);
  });

  t.test('UT-07-18 move outside all pads releases and re-entering presses again', () => {
    const pad = padCenter(2);
    Input.synthesize.pointer(1, 'down', pad.x, pad.y, 0.5, 100);
    Input.synthesize.pointer(1, 'move', -10, -10, 0.5, 110);
    t.deepEq(shape(events), ['press lane2 pointer', 'release lane2 pointer']);
    t.deepEq(Input.held(), []);
    Input.synthesize.pointer(1, 'move', pad.x, pad.y, 0.5, 120);
    t.deepEq(shape(events.slice(2)), ['press lane2 pointer']);
    Input.synthesize.pointer(1, 'up', pad.x, pad.y, 0, 130);
    t.deepEq(Input.held(), []);
  });

  t.test('UT-07-19 pointercancel and the pointer cap', () => {
    const pad = padCenter(3);
    Input.synthesize.pointer(1, 'down', pad.x, pad.y, 0.5, 100);
    Input.synthesize.pointer(1, 'cancel', pad.x, pad.y, 0, 110);
    t.deepEq(shape(events), ['press lane3 pointer', 'release lane3 pointer']);
    events.length = 0;
    const first = padCenter(0);
    for (let pointer = 10; pointer <= 20; pointer += 1) {
      Input.synthesize.pointer(pointer, 'down', first.x, first.y, 0.5, 200);
    }
    t.deepEq(shape(events), ['press lane0 pointer', 'release lane0 pointer', 'press lane0 pointer'],
      'the eleventh pointer drops the oldest track and releases its pad');
    t.deepEq(Input.State.owner('lane0'), { source: 'pointer', physical: 'ptr20' });
    t.ok(Core.Log.entries().slice(-5).some((entry) => entry.msg === 'INP_PTR_CAP'), 'the cap is logged');
  });

  t.test('UT-07-20 four simultaneous pointers', () => {
    [0, 1, 2, 3].forEach((index) => {
      const pad = padCenter(index);
      Input.synthesize.pointer(index + 1, 'down', pad.x, pad.y, 0.5, 100);
    });
    t.deepEq(Input.held(), ['lane0', 'lane1', 'lane2', 'lane3']);
    [3, 1, 4, 2].forEach((id) => Input.synthesize.pointer(id, 'up', 0, 0, 0, 200));
    t.deepEq(Input.held(), []);
    t.deepEq(events.slice(4).map((event) => event.control), ['lane2', 'lane0', 'lane3', 'lane1'],
      'each pointer releases its own pad');
  });

  t.test('pointer: a dance context presses dance controls from the same pads', () => {
    Input.bind({ owner: OWNER, context: 'dance' });
    const pad = padCenter(2);
    Input.synthesize.pointer(1, 'down', pad.x, pad.y, 0.5, 100);
    t.deepEq(shape(events), ['press dance2 pointer']);
  });

  t.test('pointer: real Pointer Events on the pads, compatibility mouse events ignored, mouse buttons filtered', () => {
    const pad = padCenter(1);
    const down = dispatchPointer('pointerdown', fixture.pads[1], 1, pad);
    t.eq(down.defaultPrevented, true, 'pointerdown is cancelled so no compatibility events follow');
    ['mousedown', 'mouseup', 'click'].forEach((type) => {
      fixture.pads[1].dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: pad.x,
        clientY: pad.y }));
    });
    dispatchPointer('pointerup', fixture.pads[1], 1, pad);
    t.deepEq(shape(events), ['press lane1 pointer', 'release lane1 pointer']);
    t.eq(events[0].pressure, 0.5);
    dispatchPointer('pointerdown', fixture.pads[0], 2, padCenter(0), { pointerType: 'mouse', button: 2, pressure: 0 });
    t.eq(events.length, 2, 'a secondary mouse button is not a press');
    dispatchPointer('pointerdown', fixture.pads[0], 3, padCenter(0), { pointerType: 'mouse', button: 0 });
    dispatchPointer('pointerleave', fixture.root, 3, padCenter(0), { pointerType: 'mouse' });
    t.deepEq(shape(events.slice(2)), ['press lane0 pointer', 'release lane0 pointer'], 'leaving the pads releases');
    dispatchPointer('pointerdown', fixture.pads[2], 4, padCenter(2));
    dispatchPointer('lostpointercapture', fixture.pads[2], 4, padCenter(2));
    t.deepEq(shape(events.slice(4)), ['press lane2 pointer', 'release lane2 pointer'], 'a lost capture releases');
    dispatchPointer('pointerdown', fixture.pads[3], 5, padCenter(3));
    dispatchPointer('pointercancel', fixture.pads[3], 5, padCenter(3));
    t.deepEq(Input.held(), []);
    t.eq(events.length, 8);
  });

  t.test('pointer: pointerup and pointercancel anywhere on the page release the owning pad', () => {
    dispatchPointer('pointerdown', fixture.pads[0], 1, padCenter(0));
    dispatchPointer('pointerdown', fixture.pads[1], 2, padCenter(1));
    dispatchPointer('pointerup', doc.body, 1, { x: 900, y: 900 });
    t.deepEq(Input.held(), ['lane1'], 'only the pad of pointer 1 is released');
    dispatchPointer('pointercancel', doc.body, 2, { x: 900, y: 900 });
    t.deepEq(Input.held(), []);
    dispatchPointer('pointerup', doc.body, 3, { x: 900, y: 900 });
    t.deepEq(shape(events), ['press lane0 pointer', 'press lane1 pointer', 'release lane0 pointer',
      'release lane1 pointer'], 'an unknown pointer adds nothing');
  });

  t.test('pointer: pad rectangles follow layout changes, resize, setting changes and rebuilt pads', () => {
    const target = new window.EventTarget();   // a private window stand-in: the real resize would wake M-26
    attach({ keyboardTarget: target });
    record();
    const old = padCenter(0);
    Input.synthesize.pointer(1, 'down', old.x, old.y, 0.5, 1);
    Input.synthesize.pointer(1, 'up', old.x, old.y, 0, 2);
    fixture.pads[0].style.left = '300px';
    fixture.pads[0].style.top = '300px';
    Input.layoutChanged();
    Input.synthesize.pointer(1, 'down', old.x, old.y, 0.5, 3);
    t.eq(events.length, 2, 'the old position is no longer a pad');
    Input.synthesize.pointer(2, 'down', 340, 340, 0.5, 4);
    t.eq(events.length, 3);
    Input.releaseAll('system');
    fixture.pads[0].style.left = '200px';
    target.dispatchEvent(new window.Event('resize'));
    Input.synthesize.pointer(3, 'down', 240, 340, 0.5, 5);
    t.eq(events[events.length - 1].control, 'lane0', 'resize marks the rectangles stale');
    Input.releaseAll('system');
    fixture.pads[0].style.left = '20px';
    fixture.pads[0].style.top = '20px';
    bus.emit('settings.changed', { key: 'input.padSize', value: 'large', prev: 'medium', source: 'ui' });
    Input.synthesize.pointer(4, 'down', 60, 60, 0.5, 6);
    t.eq(events[events.length - 1].control, 'lane0', 'a pad setting marks the rectangles stale');
    Input.releaseAll('system');
    const rebuilt = fixture.pads[1].cloneNode();
    fixture.pads[1].replaceWith(rebuilt);
    Input.synthesize.pointer(5, 'down', padCenter(1).x, padCenter(1).y, 0.5, 7);
    t.eq(events[events.length - 1].control, 'lane1', 'a rebuilt pad element is found again');
  });

  t.test('pointer: touchstart and touchmove are cancelled on the gameplay surface only', () => {
    const start = dispatchTouch('touchstart', fixture.surface, [touchAt(1, 0)]);
    t.eq(start.defaultPrevented, true);
    t.eq(dispatchTouch('touchmove', fixture.root, [touchAt(1, 0)]).defaultPrevented, true);
    t.eq(fixture.surface.dispatchEvent(new window.Event('contextmenu', { bubbles: true, cancelable: true })), false);
    t.deepEq(events, [], 'touch events do not press anything while the pointer API is selected');
    Input.bind({ owner: OWNER, context: 'menu' });
    t.eq(dispatchTouch('touchstart', fixture.surface, [touchAt(1, 0)]).defaultPrevented, false,
      'menus keep the default touch behavior');
  });

  t.test('touch fallback (OQ-1): Touch Events feed the same lifecycle when input.touchApi is touch', () => {
    attach({ touchApi: 'touch' });
    record();
    dispatchTouch('touchstart', fixture.root, [touchAt(1, 0), touchAt(2, 1)]);
    t.deepEq(Input.held(), ['lane0', 'lane1']);
    t.deepEq(Input.State.owner('lane0'), { source: 'pointer', physical: 't1' });
    dispatchTouch('touchmove', fixture.root, [touchAt(1, 2)]);
    t.deepEq(Input.held(), ['lane1', 'lane2']);
    dispatchPointer('pointerdown', fixture.pads[3], 9, padCenter(3));
    t.deepEq(Input.held(), ['lane1', 'lane2'], 'a touch pointer is ignored while Touch Events are in use (never both)');
    dispatchPointer('pointerdown', fixture.pads[3], 8, padCenter(3), { pointerType: 'mouse' });
    t.deepEq(Input.held(), ['lane1', 'lane2', 'lane3'], 'a mouse still uses Pointer Events');
    dispatchTouch('touchend', fixture.root, [touchAt(1, 2)]);
    dispatchTouch('touchcancel', fixture.root, [touchAt(2, 1)]);
    t.deepEq(Input.held(), ['lane3']);
    dispatchTouch('touchstart', fixture.root, [touchAt(3, 0)]);
    dispatchTouch('touchmove', fixture.root, [{ identifier: 3, clientX: -5, clientY: -5, force: 0.9 }]);
    t.deepEq(Input.held(), ['lane3'], 'sliding off every pad releases it');
    t.eq(events.filter((event) => event.control === 'lane0')[0].pressure, 0.5, 'no force means the default');
  });

  t.test('touch fallback: input.touchApi changes switch the API and release what is held', () => {
    const pad = padCenter(0);
    Input.synthesize.pointer(1, 'down', pad.x, pad.y, 0.5, 1);
    bus.emit('settings.changed', { key: 'input.touchApi', value: 'touch', prev: 'auto', source: 'ui' });
    t.deepEq(shape(events), ['press lane0 pointer', 'release lane0 system']);
    dispatchTouch('touchstart', fixture.root, [touchAt(1, 1)]);
    t.deepEq(Input.held(), ['lane1']);
    bus.emit('settings.changed', { key: 'input.touchApi', value: 'pointer', prev: 'touch', source: 'ui' });
    t.deepEq(Input.held(), []);
    attach({ touchApi: 'auto' });
    dispatchTouch('touchstart', fixture.root, [touchAt(1, 1)]);
    t.deepEq(Input.held(), [], 'auto keeps Pointer Events where the browser has them');
  });

  // ------------------------------------------------------------------------------------------ gamepad
  t.test('UT-07-21 gamepad edge detection and disconnect', () => {
    const devices = [];
    bus.on('input.device', (event) => devices.push(event), t.owner);
    Input.synthesize.gamepad(fakePad([0]));
    Input.pollGamepad(1000);
    Input.pollGamepad(1016);
    t.deepEq(shape(events), ['press lane0 gamepad'], 'one press and no duplicate on the second poll');
    t.deepEq(devices, [{ source: 'gamepad', connected: true, id: 'Test Pad', name: 'Test Pad', index: 0 }]);
    t.deepEq(Input.devices().gamepads, [{ index: 0, id: 'Test Pad', mapping: 'standard' }]);
    Input.synthesize.gamepad(fakePad([]));
    Input.pollGamepad(1032);
    t.deepEq(shape(events.slice(1)), ['release lane0 gamepad']);
    Input.synthesize.gamepad(fakePad([1]));
    Input.pollGamepad(1048);
    Input.synthesize.gamepad(null);
    Input.pollGamepad(1064);
    t.deepEq(shape(events.slice(2)), ['press lane1 gamepad', 'release lane1 system']);
    t.deepEq(devices[1], { source: 'gamepad', connected: false, id: 'Test Pad', name: 'Test Pad', index: 0 });
    t.deepEq(Input.held(), []);
  });

  t.test('UT-07-22 gamepad dance context mapping', () => {
    Input.bind({ owner: OWNER, context: 'dance' });
    Input.synthesize.gamepad(fakePad([12]));
    Input.pollGamepad(1000);
    t.deepEq(shape(events), ['press dance2 gamepad']);
    Input.synthesize.gamepad(fakePad([14, 9, 8]));
    Input.pollGamepad(1016);
    t.deepEq(Input.held().sort(), ['dance0', 'panic', 'pause']);
    Input.bind({ owner: OWNER, context: 'freeplay' });
    t.deepEq(Input.held().sort(), ['panic', 'pause'], 'dance controls are not live in free play');
  });

  t.test('gamepad: instrument table (face buttons, shoulders, triggers, d-pad) and analog values', () => {
    const pressedControls = (...downIndexes) => {
      events.length = 0;
      Input.synthesize.gamepad(fakePad(downIndexes));
      Input.pollGamepad(2000 + downIndexes.length);
      const names = events.map((event) => event.control);
      Input.releaseAll('system');
      Input.synthesize.gamepad(fakePad([]));
      Input.pollGamepad(3000 + downIndexes.length);
      return names;
    };
    t.deepEq(pressedControls(0, 1, 2, 3), ['lane0', 'lane1', 'lane2', 'lane3']);
    t.deepEq(pressedControls(4, 5, 12, 13), ['octDown', 'octUp']);
    t.deepEq(pressedControls(6, 7), ['sustain'], 'either trigger is sustain, one press');
    t.deepEq(pressedControls(8, 9, 14, 15), ['panic', 'pause'], 'unmapped buttons do nothing');
    events.length = 0;
    const analog = fakePad([]);
    analog.buttons[2] = { pressed: false, value: 0.8 };
    analog.buttons[3] = { pressed: false, value: 0.4 };
    Input.synthesize.gamepad(analog);
    Input.pollGamepad(5000);
    t.deepEq(events.map((event) => [event.control, event.pressure]), [['lane2', 0.8]], 'value above 0.5 counts');
  });

  t.test('gamepad: a non-standard mapping is logged once and still used; a menu context presses nothing', () => {
    Input.synthesize.gamepad(fakePad([0], { mapping: '' }));
    Input.pollGamepad(1000);
    t.deepEq(shape(events), ['press lane0 gamepad']);
    t.ok(Core.Log.entries().slice(-8).some((entry) => entry.msg === 'INP_GP_NONSTANDARD'));
    Input.bind({ owner: OWNER, context: 'menu' });
    Input.synthesize.gamepad(fakePad([0, 1]));
    Input.pollGamepad(1016);
    t.eq(events.length, 2, 'only the system release from the bind');
  });

  t.test('UT-07-21b gamepaddisconnected releases at once and announces the device once', () => {
    const devices = [];
    bus.on('input.device', (event) => devices.push(event), t.owner);
    key('KeyL', true, 1);
    Input.synthesize.gamepad(fakePad([1, 2]));
    Input.pollGamepad(1000);
    t.deepEq(Input.held(), ['lane3', 'lane1', 'lane2']);
    const gone = new window.Event('gamepaddisconnected');
    gone.gamepad = { index: 0, id: 'Test Pad' };
    window.dispatchEvent(gone);
    t.deepEq(shape(events.slice(3)), ['release lane1 system', 'release lane2 system'], 'before the next poll');
    t.deepEq(Input.held(), ['lane3'], 'the keyboard press is untouched');
    Input.synthesize.gamepad(null);
    Input.pollGamepad(1016);
    t.eq(devices.filter((event) => event.connected === false).length, 1, 'one disconnect event, not two');
    const other = new window.Event('gamepaddisconnected');
    other.gamepad = { index: 3, id: 'Other' };
    window.dispatchEvent(other);
    t.eq(devices.length, 2, 'a pad nobody announced is not announced');
    const connected = new window.Event('gamepadconnected');
    connected.gamepad = { index: 2, id: 'Late Pad' };
    window.dispatchEvent(connected);
    t.deepEq(devices[2], { source: 'gamepad', connected: true, id: 'Late Pad', name: 'Late Pad', index: 2 });
    const unplugged = new window.Event('gamepaddisconnected');
    unplugged.gamepad = { index: 2, id: 'Late Pad' };
    window.dispatchEvent(unplugged);     // also stops the gamepad menu polling that M-26 starts on a connect
    t.deepEq(devices[3], { source: 'gamepad', connected: false, id: 'Late Pad', name: 'Late Pad', index: 2 });
  });

  t.test('FI-027 input part: input.disconnect releases one control per held gamepad control', () => {
    const devices = [];
    bus.on('input.device', (event) => devices.push(event), t.owner);
    key('KeyL', true, 1);
    Input.synthesize.gamepad(fakePad([0, 1]));
    Input.pollGamepad(1000);
    t.eq(Input.debugInject('input.disconnect', { source: 'gamepad' }), true);
    t.deepEq(shape(events.slice(3)), ['release lane0 system', 'release lane1 system']);
    t.deepEq(Input.held(), ['lane3']);
    t.deepEq(devices.map((event) => event.connected), [true, false]);
    Input.pollGamepad(1016);
    t.eq(events.length, 5, 'the unplugged pad is not read while the fault is armed');
    Input.debugClear('input.disconnect');
    Input.pollGamepad(1032);
    t.deepEq(shape(events.slice(5)), ['press lane0 gamepad', 'press lane1 gamepad'], 'plugged in again');
    t.eq(Input.debugInject('no.such.fault', {}), false);
  });

  t.test('FI-027 input part: the pointer and midi sources of input.disconnect', async () => {
    const pad = padCenter(0);
    Input.synthesize.pointer(1, 'down', pad.x, pad.y, 0.5, 1);
    Input.synthesize.pointer(2, 'down', padCenter(1).x, padCenter(1).y, 0.5, 2);
    t.eq(Input.debugInject('input.disconnect', { source: 'pointer' }), true);
    t.deepEq(shape(events.slice(2)), ['release lane0 pointer', 'release lane1 pointer'],
      'a pointercancel for every active pointer');
    Input.debugClear('input.disconnect');
    events.length = 0;
    fakeMidi(['Keys'], []);
    await Input.enableMidi();
    Input.synthesize.midi(new Uint8Array([0x90, 60, 100]), 3);
    const devices = [];
    bus.on('input.device', (event) => devices.push(event), t.owner);
    t.eq(Input.debugInject('input.disconnect', { source: 'midi' }), true);
    t.deepEq(shape(events.slice(1)), ['release lane0 system']);
    t.deepEq(devices.map((event) => [event.source, event.connected]), [['midi', false]]);
    Input.synthesize.midi(new Uint8Array([0x90, 62, 100]), 4);
    t.eq(events.length, 2, 'the unplugged MIDI device is silent');
  });

  t.test('TT-029 input part: four presses at one timestamp are four events with the same tPerf', () => {
    fakeClock(7000);
    installAudio(1);
    ['KeyA', 'KeyS', 'KeyK', 'KeyL'].forEach((code) => key(code, true, 7000));
    t.deepEq(events.map((event) => event.control), ['lane0', 'lane1', 'lane2', 'lane3']);
    t.eq(new Set(events.map((event) => event.tPerf)).size, 1);
    t.eq(new Set(events.map((event) => event.tAudio)).size, 1);
    Input.releaseAll('system');
    events.length = 0;
    [0, 1, 2, 3].forEach((index) => {
      const pad = padCenter(index);
      Input.synthesize.pointer(index + 1, 'down', pad.x, pad.y, 0.5, 7100);
    });
    t.eq(new Set(events.map((event) => event.tPerf)).size, 1, 'the same holds for four touches');
    t.eq(events.length, 4);
  });

  // ------------------------------------------------------------------------------------------ Web MIDI (fakes)
  t.test('UT-07-23 enableMidi without support or a secure context', async () => {
    overrideProperty(nav, 'requestMIDIAccess', { writable: true, value: undefined });
    t.deepEq(await Input.enableMidi(), { ok: false, code: 'E-INP-001' });
    t.deepEq([Input.devices().midi.supported, Input.devices().midi.enabled], [false, false]);
    const requests = [];
    fakeMidi(['Keys'], requests);
    overrideProperty(window, 'isSecureContext', { value: false });
    t.deepEq(await Input.enableMidi(), { ok: false, code: 'E-INP-001' });
    t.eq(requests.length, 0, 'no permission request is made in an insecure context');
    t.eq(Input.devices().midi.secure, false);
  });

  t.test('UT-07-23b a denied permission resolves E-INP-002 and enabling twice asks once', async () => {
    overrideProperty(nav, 'requestMIDIAccess', { writable: true, value: () => Promise.reject(new Error('denied')) });
    t.deepEq(await Input.enableMidi(), { ok: false, code: 'E-INP-002' });
    t.eq(Input.devices().midi.enabled, false);
    const requests = [];
    fakeMidi(['Keys'], requests);
    const [first, second] = await Promise.all([Input.enableMidi(), Input.enableMidi()]);
    t.deepEq([first, second], [{ ok: true }, { ok: true }]);
    t.deepEq(await Input.enableMidi(), { ok: true });
    t.deepEq(requests, [{ sysex: false }], 'one request, without system exclusive access');
  });

  t.test('UT-07-24 MIDI note mapping and pass-through', async () => {
    const own = Input.listenerCount();
    fakeMidi(['Keys', 'Pads'], []);
    t.deepEq(await Input.enableMidi(), { ok: true });
    t.eq(Input.listenerCount(), own + 3, 'two ports and the statechange listener');
    t.deepEq(Input.devices().midi.inputs, ['Keys', 'Pads']);
    Input.synthesize.midi(new Uint8Array([0x90, 60, 100]), 100);
    Input.synthesize.midi(new Uint8Array([0x80, 60, 0]), 150);
    t.deepEq(shape(events), ['press lane0 midi', 'release lane0 midi']);
    t.near(events[0].pressure, 100 / 127, 1e-9);
    Input.synthesize.midi(new Uint8Array([0x90, 61, 64]), 200);
    t.eq(events.length, 2, 'an unmapped note is ignored while pass-through is off');
    Input.bind({ owner: OWNER, context: 'freeplay' });
    Input.setMidiPassThrough(true);
    Input.synthesize.midi(new Uint8Array([0x90, 61, 64]), 210);
    t.deepEq(shape(events.slice(2)), ['press midi:61 midi']);
    t.near(events[2].pressure, 64 / 127, 1e-9);
    Input.synthesize.midi(new Uint8Array([0x90, 61, 0]), 220);
    t.deepEq(shape(events.slice(3)), ['release midi:61 midi'], 'a note on with velocity 0 is a note off');
    Input.synthesize.midi(new Uint8Array([0x90, 62, 90]), 230);
    Input.setMidiPassThrough(false);
    Input.synthesize.midi(new Uint8Array([0x90, 70, 90]), 240);
    t.deepEq(Input.held(), ['lane1'], 'a mapped lane stays; an unmapped note is no longer accepted');
    Input.bind({ owner: OWNER, context: 'dance' });
    Input.synthesize.midi(new Uint8Array([0x90, 64, 90]), 250);
    t.eq(events[events.length - 1].control, 'dance2', 'the same notes drive the dance controls');
  });

  t.test('UT-07-25 MIDI sustain CC', async () => {
    fakeMidi(['Keys'], []);
    await Input.enableMidi();
    Input.synthesize.midi(new Uint8Array([0xB0, 64, 127]), 100);
    Input.synthesize.midi(new Uint8Array([0xB0, 64, 0]), 200);
    Input.synthesize.midi(new Uint8Array([0xB0, 7, 99]), 210);
    Input.synthesize.midi(new Uint8Array([0xE0, 0, 64]), 220);
    t.deepEq(shape(events), ['press sustain midi', 'release sustain midi']);
  });

  t.test('MIDI lifecycle: unplugging a port, disableMidi and detach release what MIDI holds', async () => {
    const own = Input.listenerCount();
    const devices = [];
    bus.on('input.device', (event) => devices.push(event), t.owner);
    const access = fakeMidi(['Keys'], []);
    await Input.enableMidi();
    Input.synthesize.midi(new Uint8Array([0x90, 60, 100]), 1);
    const port = access.inputs.get('Keys');
    port.state = 'disconnected';
    const change = new window.Event('statechange');
    change.port = port;
    access.dispatchEvent(change);
    t.deepEq(shape(events.slice(1)), ['release lane0 system']);
    t.deepEq(devices.map((event) => [event.source, event.connected]), [['midi', true], ['midi', false]]);
    t.eq(Input.listenerCount(), own + 1, 'the unplugged port is unsubscribed');
    port.state = 'connected';
    access.dispatchEvent(change);
    Input.synthesize.midi(new Uint8Array([0x90, 62, 100]), 2);
    t.eq(Input.State.isHeld('lane1'), true);
    Input.disableMidi();
    t.deepEq(shape(events.slice(-1)), ['release lane1 system']);
    t.eq(Input.listenerCount(), own);
    t.eq(Input.devices().midi.enabled, false);
    await Input.enableMidi();
    Input.detach();
    t.eq(Input.listenerCount(), 0, 'detach stops MIDI listening');
  });

  // ------------------------------------------------------------------------------------------ T03.04
  const mapEvents = () => {
    const seen = [];
    bus.on('input.map', (event) => seen.push(event), t.owner);
    return seen;
  };

  t.test('UT-07-26 remap conflict detection', () => {
    const seen = mapEvents();
    t.deepEq(Input.remap('instrument', 'lane1', 'KeyA'),
      { ok: false, conflict: { context: 'instrument', control: 'lane0', code: 'KeyA' } });
    t.deepEq(Input.getMap().keyboard.instrument.lane1, ['KeyS'], 'a refused remap changes nothing');
    t.deepEq(seen, [], 'and announces nothing');
    t.deepEq(Input.conflicts('instrument', 'lane1', 'KeyA'), { context: 'instrument', control: 'lane0', code: 'KeyA' });
    t.eq(Input.conflicts('instrument', 'lane1', 'KeyZ'), null, 'a free key has no conflict');
    // Per context: KeyL is lane3 in the instrument contexts but free in dance. (The plan row names KeyK, which the
    // default dance map already gives to dance3 as its second key, so that pair is a conflict inside dance.)
    t.deepEq(Input.remap('dance', 'dance0', 'KeyL'), { ok: true });
    t.deepEq(Input.remap('dance', 'dance0', 'KeyK'),
      { ok: false, conflict: { context: 'dance', control: 'dance3', code: 'KeyK' } });
    t.deepEq(seen.map((event) => [event.context, event.control, event.codes.join(), event.source]),
      [['dance', 'dance0', 'ArrowLeft,KeyD,KeyL', 'keyboard']]);
  });

  t.test('UT-07-26b global keys clash with every context and the reverse; limits and bad requests', () => {
    t.deepEq(Input.remap('freeplay', 'profile1', 'Escape').conflict, { context: 'global', control: 'pause',
      code: 'Escape' });
    t.deepEq(Input.remap('global', 'pause', 'KeyF').conflict, { context: 'dance', control: 'dance1', code: 'KeyF' },
      'a global key clashes with a key of any context');
    t.deepEq(Input.remap('global', 'pause', 'KeyK').conflict, { context: 'instrument', control: 'lane2',
      code: 'KeyK' }, 'the first clash in context order is named');
    t.deepEq(Input.remap('global', 'pause', 'KeyU'), { ok: true });
    t.deepEq(Input.remap('instrument', 'lane0', 'KeyZ'), { ok: true });
    t.deepEq(Input.remap('instrument', 'lane0', 'KeyZ'), { ok: true }, 'a key the control already has is a no-op');
    t.deepEq(Input.remap('instrument', 'lane0', 'KeyX'), { ok: true });
    Core.Log.clear();
    t.deepEq(Input.remap('instrument', 'lane0', 'KeyC'), { ok: false, conflict: null }, 'a fourth key is refused');
    t.ok(Core.Log.entries().some((entry) => entry.msg === 'INP_MAP_FULL'), 'and logged');
    [['instrument', 'bogus', 'KeyC'], ['nowhere', 'lane0', 'KeyC'], ['instrument', 'lane1', 'Key C!'],
      ['instrument', 'lane1', 7], ['midi', 'lane1', 128], ['midi', 'sustainCC', 5]].forEach((args) => {
      t.deepEq(Input.remap(args[0], args[1], args[2]), { ok: false, conflict: null }, args.join(' '));
    });
    t.deepEq(Input.controlsFor('global'), ['pause', 'panic', 'panicWhilePaused']);
    t.deepEq(Input.controlsFor('midi'), ['lane0', 'lane1', 'lane2', 'lane3']);
  });

  t.test('UT-07-26c MIDI lane notes remap, a note used by another lane is a conflict', () => {
    t.deepEq(Input.remap('midi', 'lane1', 60),
      { ok: false, conflict: { context: 'midi', control: 'lane0', code: 60 } });
    t.deepEq(Input.remap('midi', 'lane0', 61), { ok: true });
    t.eq(Input.getMap().midi.lane0, 61);
    t.eq(Input.unmap('midi', 'lane0', 61), false, 'a MIDI lane keeps its note');
    t.deepEq(Input.remap('midi', 'lane1', 60), { ok: true }, 'the old note of lane0 is free now');
  });

  t.test('UT-07-27 remap replaces after unmap, a control keeps at least one key', () => {
    const seen = mapEvents();
    t.eq(Input.unmap('instrument', 'lane0', 'KeyA'), false, 'the last key cannot be removed');
    t.deepEq(Input.remap('instrument', 'lane0', 'KeyZ'), { ok: true });
    t.eq(Input.unmap('instrument', 'lane0', 'KeyA'), true);
    t.eq(Input.unmap('instrument', 'lane0', 'KeyA'), false, 'a key the control does not have');
    t.deepEq(Input.getMap().keyboard.instrument.lane0, ['KeyZ']);
    key('KeyA', true, 10);
    t.deepEq(events, [], 'the old key does nothing');
    key('KeyZ', true, 20);
    key('KeyZ', false, 30);
    t.deepEq(shape(events), ['press lane0 keyboard', 'release lane0 keyboard']);
    t.deepEq(seen.map((event) => event.codes.join()), ['KeyA,KeyZ', 'KeyZ']);
  });

  t.test('UT-07-27b a freed key can be given to another control, and a held remapped key still releases', () => {
    Input.unmap('instrument', 'lane0', 'KeyA');
    Input.remap('instrument', 'lane0', 'KeyZ');
    Input.unmap('instrument', 'lane0', 'KeyA');
    t.deepEq(Input.remap('instrument', 'lane1', 'KeyA'), { ok: true });
    key('KeyA', true, 10);
    t.deepEq(shape(events), ['press lane1 keyboard']);
    Input.unmap('instrument', 'lane1', 'KeyA');
    Input.remap('instrument', 'lane1', 'KeyX');
    key('KeyA', false, 20);
    t.deepEq(shape(events), ['press lane1 keyboard', 'release lane1 keyboard'], 'the owner releases its own press');
  });

  t.test('UT-07-28 setMap tolerates corrupt data', () => {
    const result = Input.setMap({ keyboard: { instrument: { lane0: ['Key A!'], bogus: ['KeyB'] } } });
    t.eq(result.ok, false);
    t.ok(result.errors.length >= 2, 'one error per problem: ' + result.errors.join(' | '));
    t.deepEq(Input.getMap().keyboard.instrument.lane0, ['KeyA'], 'the default stays');
    key('KeyA', true, 10);
    t.deepEq(shape(events), ['press lane0 keyboard']);
  });

  t.test('UT-07-28b setMap installs valid maps, fills the gaps with defaults and never throws', () => {
    const seen = mapEvents();
    key('KeyA', true, 5);
    const result = Input.setMap({ version: 1, keyboard: { instrument: { lane0: ['KeyF', 'KeyG'] },
      global: { pause: ['KeyU'] } }, midi: { lane2: 70 } });
    t.deepEq(result, { ok: true, errors: [] });
    t.deepEq(shape(events), ['press lane0 keyboard', 'release lane0 system'], 'installing maps releases held controls');
    const map = Input.getMap();
    t.deepEq([map.keyboard.instrument.lane0, map.keyboard.instrument.lane1, map.keyboard.global.pause,
      map.keyboard.global.panic, map.midi.lane2, map.midi.lane0],
    [['KeyF', 'KeyG'], ['KeyS'], ['KeyU'], ['KeyP'], 70, 60]);
    t.deepEq(seen.map((event) => event.context + '.' + event.control).sort(),
      ['global.pause', 'instrument.lane0', 'midi.lane2'], 'only the changed controls are announced');
    key('KeyG', true, 10);
    key('KeyU', true, 20);
    t.deepEq(shape(events).slice(2), ['press lane0 keyboard', 'press pause keyboard']);
    [null, 5, 'text', [], { keyboard: 3, midi: [] }, { keyboard: { dance: 'x', nowhere: {} }, extra: 1 }]
      .forEach((bad) => {
        const outcome = Input.setMap(bad);
        t.eq(outcome.ok, false);
        t.ok(outcome.errors.length > 0);
      });
    t.deepEq(Input.getMap(), JSON.parse(JSON.stringify(Input.DEFAULT_MAPS)), 'corrupt data leaves the defaults');
  });

  t.test('UT-07-28c clashes inside supplied maps keep the first binding; unusable data is reported', () => {
    const result = Input.setMap({ keyboard: { instrument: { lane0: ['KeyZ'], lane1: ['KeyZ'] },
      dance: { dance0: ['KeyA', 'KeyB', 'KeyC', 'KeyD'] } }, midi: { lane0: 61, lane1: 61, sustainCC: 200 } });
    t.eq(result.ok, false);
    const map = Input.getMap();
    t.deepEq([map.keyboard.instrument.lane0, map.keyboard.instrument.lane1], [['KeyZ'], ['KeyS']]);
    t.deepEq(map.keyboard.dance.dance0, ['KeyA', 'KeyB', 'KeyC'], 'at most 3 keys');
    t.deepEq(map.midi, Input.DEFAULT_MAPS.midi, 'duplicate lane notes or a bad controller number: MIDI defaults');
    t.ok(result.errors.some((line) => line.includes('already used')));
  });

  t.test('UT-07-28d resetMap restores one context or everything, and the keys follow', () => {
    Input.remap('instrument', 'lane0', 'KeyZ');
    Input.remap('dance', 'dance1', 'KeyZ');
    Input.remap('midi', 'lane0', 61);
    Input.resetMap('instrument');
    t.deepEq(Input.getMap().keyboard.instrument.lane0, ['KeyA']);
    t.deepEq(Input.getMap().keyboard.dance.dance1, ['ArrowDown', 'KeyF', 'KeyZ'], 'other contexts keep theirs');
    Input.resetMap('nowhere');
    t.eq(Input.getMap().midi.lane0, 61, 'an unknown context changes nothing');
    Input.resetMap();
    t.deepEq(Input.getMap(), JSON.parse(JSON.stringify(Input.DEFAULT_MAPS)));
    key('KeyA', true, 10);
    t.deepEq(shape(events), ['press lane0 keyboard']);
  });

  t.test('getMap returns a copy and the defaults stay frozen through every change', () => {
    const copy = Input.getMap();
    copy.keyboard.instrument.lane0.push('KeyZ');
    t.deepEq(Input.getMap().keyboard.instrument.lane0, ['KeyA']);
    Input.remap('instrument', 'lane0', 'KeyZ');
    t.deepEq(Input.DEFAULT_MAPS.keyboard.instrument.lane0, ['KeyA']);
    t.eq(Object.isFrozen(Input.DEFAULT_MAPS.keyboard.instrument.lane0), true);
  });

  // ------------------------------------------------------------------------------------------ test hooks
  t.test('synthesize exists in the test build and plain listener-less calls never throw', () => {
    t.eq(typeof Input.synthesize.key, 'function');
    t.throws(() => Input.synthesize.pointer(1, 'sideways', 0, 0, 0, 0), 'E-GEN-004');
    Input.synthesize.midi(new Uint8Array([]), 0);
    Input.synthesize.midi(new Uint8Array([0x90, 60, 100]), 0);
    t.deepEq(events, [], 'MIDI that is not enabled produces nothing... and an empty message is ignored');
  });
});
})();
