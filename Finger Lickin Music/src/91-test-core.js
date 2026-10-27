// 91-test-core.js - unit tests for M-01 FLM.Core (group 'core'; test build only).
// UT-01-01 to UT-01-28 and FI-037 follow Part 6.1.8; UT-01-29 to UT-01-32 are extra checks for T01.03 and T01.04.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('core', (t) => {
  const Core = FLM.Core;
  const ErrorReporter = Core.ErrorReporter;
  const BIG_COUNT = 10000;
  const LOG_SIZE = 500;
  const SIZE_CAP = 204800;

  // Runs a block with an empty module registry and always restores the real one.
  function withFreshRegistry(block) {
    const restore = Core._resetRegistryForTests();
    try {
      block();
    } finally {
      restore();
    }
  }

  // A minimal event target so listener tracking is tested without a real DOM element.
  function fakeTarget() {
    const added = [];
    return {
      added,
      addEventListener(type, fn) { added.push([type, fn]); },
      removeEventListener(type, fn) {
        const index = added.findIndex((pair) => pair[0] === type && pair[1] === fn);
        if (index >= 0) added.splice(index, 1);
      }
    };
  }

  function recordsWithMessage(message) {
    return ErrorReporter.records().filter((record) => record.message === message);
  }

  t.test('UT-01-01 define registers namespace', () => {
    withFreshRegistry(() => {
      const namespace = Core.define('X', () => ({ marker: 1 }));
      t.eq(FLM.X, namespace);
      t.deepEq(Core.modules(), [{ name: 'X', order: 1 }]);
    });
  });

  t.test('UT-01-02 define rejects duplicates', () => {
    withFreshRegistry(() => {
      Core.define('X', () => ({}));
      t.throws(() => Core.define('X', () => ({})), 'E-GEN-001');
    });
  });

  t.test('UT-01-03 emitter on/emit order', () => {
    const emitter = new Core.Emitter();
    const calls = [];
    [1, 2, 3].forEach((number) => emitter.on('topic', (payload, topic) => calls.push([number, payload, topic])));
    const called = emitter.emit('topic', 'payload');
    t.eq(called, 3);
    t.deepEq(calls, [[1, 'payload', 'topic'], [2, 'payload', 'topic'], [3, 'payload', 'topic']]);
  });

  t.test('UT-01-04 emitter isolates listener errors', () => {
    ErrorReporter._resetForTests();
    const emitter = new Core.Emitter();
    const calls = [];
    emitter.on('topic', () => calls.push(1));
    emitter.on('topic', () => { throw new Error('listener-failed-UT-01-04'); });
    emitter.on('topic', () => calls.push(3));
    t.eq(emitter.emit('topic'), 3);
    t.deepEq(calls, [1, 3]);
    const records = recordsWithMessage('listener-failed-UT-01-04');
    t.eq(records.length, 1);
    t.eq(records[0].code, 'E-GEN-001');
    ErrorReporter._resetForTests();
  });

  t.test('UT-01-05 once fires once', () => {
    const emitter = new Core.Emitter();
    let count = 0;
    emitter.once('topic', () => { count += 1; });
    emitter.emit('topic');
    emitter.emit('topic');
    t.eq(count, 1);
    t.eq(emitter.listenerCount('topic'), 0);
  });

  t.test('UT-01-06 off and removeOwner', () => {
    const emitter = new Core.Emitter();
    const ownerA = {};
    const ownerB = {};
    const keep = () => {};
    emitter.on('one', () => {}, ownerA);
    emitter.on('two', () => {}, ownerA);
    emitter.on('one', keep, ownerB);
    t.eq(emitter.removeOwner(ownerA), 2);
    t.eq(emitter.listenerCount('one') + emitter.listenerCount('two'), 1);
    t.eq(emitter.off('one', () => {}), false);
    t.eq(emitter.off('one', keep), true);
    t.eq(emitter.listenerCount(), 0);
  });

  t.test('UT-01-07 emit snapshot semantics', () => {
    const emitter = new Core.Emitter();
    const calls = [];
    const added = () => calls.push('added');
    const selfRemoving = () => {
      calls.push('self');
      emitter.off('topic', selfRemoving);
      emitter.on('topic', added);
    };
    emitter.on('topic', selfRemoving);
    emitter.emit('topic');
    t.deepEq(calls, ['self']);
    emitter.emit('topic');
    t.deepEq(calls, ['self', 'added']);
  });

  t.test('UT-01-08 log ring wraps at 500', () => {
    Core.Log.clear();
    for (let index = 1; index <= 600; index += 1) Core.Log.info('ut0108', 'write ' + index);
    const entries = Core.Log.entries();
    t.eq(entries.length, LOG_SIZE);
    t.eq(entries[0].msg, 'write 101');
    t.eq(entries[LOG_SIZE - 1].msg, 'write 600');
    const circular = {};
    circular.self = { a: { b: { c: { d: { e: circular } } } } };
    Core.Log.info('ut0108', 'function data', () => 1);
    Core.Log.info('ut0108', 'deep data', circular);
    const last = Core.Log.entries().slice(-2);
    t.eq(last[0].data, '[omitted]');
    t.eq(last[1].data.self.a.b.c.d, '[omitted]');
    Core.Log.clear();
  });

  t.test('UT-01-09 log once', () => {
    Core.Log.clear();
    t.eq(Core.Log.once('ut0109', 'info', 'ut0109', 'first'), true);
    t.eq(Core.Log.once('ut0109', 'info', 'ut0109', 'second'), false);
    t.eq(Core.Log.entries().length, 1);
    Core.Log.clear();
  });

  t.test('UT-01-10 caps report shape', () => {
    const report = Core.Caps.get();
    const shape = {
      webgl2: 'boolean', webgl1: 'boolean', audioContext: 'boolean', offlineAudioContext: 'boolean',
      mediaRecorder: 'boolean', pointerEvents: 'boolean', maxTouchPoints: 'number', gamepad: 'boolean',
      webMidi: 'boolean', indexedDB: 'boolean', localStorage: 'boolean', secureContext: 'boolean',
      isFile: 'boolean', visibility: 'boolean', storageEstimate: 'boolean', performanceMemory: 'boolean',
      devicePixelRatio: 'number', hardwareConcurrency: 'number', userAgent: 'string', mobile: 'boolean'
    };
    Object.keys(shape).forEach((key) => t.eq(typeof report[key], shape[key], 'caps.' + key));
    t.eq(Object.keys(shape).length, 20);
    t.ok(Object.isFrozen(report), 'report is frozen');
    t.ok(Array.isArray(report.degraded) && Object.isFrozen(report.degraded), 'degraded is a frozen array');
    t.eq(typeof report.probedAt, 'string');
    t.eq(Core.Caps.isMobile(), report.mobile);
    t.ok(report.userAgent.length <= 200, 'userAgent is cut to 200 characters');
  });

  t.test('UT-01-11 caps probe isolation', () => {
    if (!window.localStorage) t.skip('no localStorage object in this environment');
    const storageProto = Object.getPrototypeOf(window.localStorage);   // stubbing the instance would store a key
    const original = storageProto.setItem;
    const baseline = Core.Caps.refresh();
    storageProto.setItem = function () { throw new Error('storage blocked'); };
    try {
      const report = Core.Caps.refresh();
      t.eq(report.localStorage, false);
      t.eq(report.audioContext, baseline.audioContext);
      t.eq(report.pointerEvents, baseline.pointerEvents);
      t.eq(report.userAgent, baseline.userAgent);
    } finally {
      storageProto.setItem = original;
      Core.Caps.refresh();
    }
  });

  t.test('UT-01-12 timers tracked', () => {
    const owner = {};
    const timersBefore = Core.timers.count();
    const framesBefore = Core.raf.count();
    Core.timers.setTimeout(() => {}, 100000, owner);
    Core.timers.setInterval(() => {}, 100000, owner);
    Core.raf.request(() => {}, owner);
    t.eq(Core.timers.count() - timersBefore, 2);
    t.eq(Core.raf.count() - framesBefore, 1);
    t.eq(Core.timers.count(owner), 2);
    t.eq(Core.timers.clearOwner(owner), 2);
    t.eq(Core.raf.cancelOwner(owner), 1);
    t.eq(Core.timers.count(), timersBefore);
    t.eq(Core.raf.count(), framesBefore);
  });

  t.test('UT-01-13 classify table', () => {
    t.eq(ErrorReporter.classify('E-CAP-001'), 'reload');
    t.eq(ErrorReporter.classify('E-CAP-004'), 'reload');
    t.eq(ErrorReporter.classify('E-AUD-001'), 'reload');
    t.eq(ErrorReporter.classify('E-AUD-002'), 'recoverable');
    t.eq(ErrorReporter.classify('E-MODE-001'), 'recoverable');
    t.eq(ErrorReporter.classify('E-MODE-002'), 'returnToMenu');
    t.eq(ErrorReporter.classify('E-GEN-003'), 'returnToMenu');
    t.eq(ErrorReporter.classify('E-GEN-001'), 'recoverable');
    t.eq(ErrorReporter.classify('E-GEN-001', { phase: 'boot' }), 'reload');
    t.eq(ErrorReporter.classify('E-ZZZ-999'), 'recoverable');
    const listed = Object.keys(ErrorReporter.CLASS_TABLE);
    const expected = { reload: 5, returnToMenu: 6 };
    Object.keys(expected).forEach((name) => {
      const count = listed.filter((code) => ErrorReporter.CLASS_TABLE[code] === name).length;
      t.eq(count, expected[name], 'number of ' + name + ' codes');
    });
    const record = ErrorReporter.report('E-ZZZ-999', new Error('unknown-code-UT-01-13'), {});
    t.eq(record.code, 'E-GEN-000');
    t.eq(record.class, 'recoverable');
    t.eq(record.context.original, 'E-ZZZ-999');
    ErrorReporter._resetForTests();
  });

  t.test('UT-01-14 report dedupes and emits', () => {
    ErrorReporter._resetForTests();
    const owner = {};
    let emitted = 0;
    Core.bus.on('error', () => { emitted += 1; }, owner);
    try {
      for (let index = 0; index < 3; index += 1) ErrorReporter.report('E-GEN-005', new Error('same-UT-01-14'), {});
    } finally {
      Core.bus.removeOwner(owner);
    }
    const records = ErrorReporter.records();
    t.eq(records.length, 1);
    t.eq(records[0].count, 3);
    t.eq(emitted, 3);
    ErrorReporter._resetForTests();
  });

  t.test('UT-01-15 unhandled rejection captured', () => {
    if (typeof window.Event !== 'function' || typeof window.dispatchEvent !== 'function') {
      t.skip('window events are not available in this environment');
    }
    ErrorReporter._resetForTests();
    ErrorReporter.install();
    const event = new window.Event('unhandledrejection');
    event.reason = new Error('rejected-UT-01-15');
    window.dispatchEvent(event);
    const records = recordsWithMessage('rejected-UT-01-15');
    t.eq(records.length, 1);
    t.eq(records[0].code, 'E-GEN-002');
    ErrorReporter._resetForTests();
  });

  t.test('UT-01-16 fatal screen renders safely', () => {
    if (!window.document.getElementById('fatal')) t.skip('the page has no #fatal element');
    ErrorReporter._resetForTests();
    try {
      ErrorReporter.showFatal({ code: 'E-GEN-001', message: '<b>x</b>', class: 'reload' });
      const panel = window.document.getElementById('fatal');
      t.ok(panel.classList.contains('show'), '#fatal is shown');
      t.ok(panel.textContent.indexOf('<b>x</b>') >= 0, 'the text is literal');
      t.eq(panel.querySelector('b'), null);
    } finally {
      ErrorReporter._resetForTests();
    }
  });

  t.test('UT-01-17 fatal shown once', () => {
    if (!window.document.getElementById('fatal')) t.skip('the page has no #fatal element');
    ErrorReporter._resetForTests();
    try {
      ErrorReporter.report('E-AUD-001', new Error('first-fatal-UT-01-17'), {});
      const panel = window.document.getElementById('fatal');
      const nodesAfterFirst = panel.querySelectorAll('*').length;
      ErrorReporter.report('E-AUD-001', new Error('second-fatal-UT-01-17'), {});
      t.eq(panel.querySelectorAll('*').length, nodesAfterFirst);
      t.ok(panel.textContent.indexOf('second-fatal-UT-01-17') < 0, 'the second report does not rewrite the screen');
    } finally {
      ErrorReporter._resetForTests();
    }
  });

  t.test('UT-01-18 diagnostics provider isolation', () => {
    Core.Diagnostics.provide('coreTestBad', () => { throw new Error('provider-failed-UT-01-18'); });
    try {
      const parsed = JSON.parse(Core.Diagnostics.export().json);
      t.ok(parsed.providers.coreTestBad.error.indexOf('provider-failed-UT-01-18') >= 0);
    } finally {
      Core.Diagnostics.provide('coreTestBad', () => ({}));   // there is no remove: leave a harmless provider
    }
  });

  t.test('UT-01-19 diagnostics redaction', () => {
    Core.Diagnostics.provide('coreTestRedact', () => ({ title: 'x', fileName: 'y', n: 1, s: 'a'.repeat(500) }));
    const hidden = JSON.parse(Core.Diagnostics.export().json).providers.coreTestRedact;
    t.eq(hidden.title, undefined);
    t.eq(hidden.fileName, undefined);
    t.eq(hidden.n, 1);
    t.eq(hidden.s.length, 203);
    const shown = JSON.parse(Core.Diagnostics.export({ includeContent: true }).json).providers.coreTestRedact;
    t.eq(shown.title, 'x');
    t.eq(shown.fileName, 'y');
    Core.Diagnostics.provide('coreTestRedact', () => ({}));
  });

  t.test('UT-01-20 diagnostics size cap', () => {
    Core.Log.clear();
    const kilobyte = {};
    for (let index = 0; index < 5; index += 1) kilobyte['field' + index] = 'x'.repeat(200);
    for (let index = 0; index < LOG_SIZE; index += 1) Core.Log.info('ut0120', 'entry ' + index, kilobyte);
    const result = Core.Diagnostics.export();
    t.ok(result.bytes <= SIZE_CAP, 'bytes ' + result.bytes);
    t.eq(result.json.length, result.bytes);
    t.eq(result.truncated, true);
    const parsed = JSON.parse(result.json);
    t.eq(parsed.truncated, true);
    t.ok(parsed.log.length < LOG_SIZE, 'the oldest entries were dropped');
    Core.Log.clear();
  });

  t.test('UT-01-21 uid uniqueness', () => {
    const seen = new Set();
    const pattern = /^[0-9a-z]+-[0-9a-z]+-[0-9a-z]{4}$/;
    for (let index = 0; index < BIG_COUNT; index += 1) {
      const id = Core.uid();
      if (!pattern.test(id)) t.ok(false, 'bad uid ' + id);
      seen.add(id);
    }
    t.eq(seen.size, BIG_COUNT);
  });

  t.test('UT-01-22 prng reference vector', () => {
    const generator = new Core.Prng(1);
    t.near(generator.next(), 0.6270739405881613, 1e-15);
    t.near(generator.next(), 0.002735721180215478, 1e-15);
    t.near(generator.next(), 0.5274470399599522, 1e-15);
    const first = new Core.Prng(42);
    const second = new Core.Prng(42);
    for (let index = 0; index < 1000; index += 1) t.eq(first.next(), second.next());
  });

  t.test('UT-01-23 prng int/pick/shuffle bounds', () => {
    const generator = new Core.Prng(7);
    const hit = new Set();
    for (let index = 0; index < BIG_COUNT; index += 1) {
      const value = generator.int(7);
      t.within(value, 0, 6);
      hit.add(value);
    }
    t.eq(hit.size, 7);
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = generator.shuffle(items.slice());
    t.deepEq(shuffled.slice().sort((a, b) => a - b), items);
    t.ok(items.indexOf(generator.pick(items)) >= 0, 'pick returns an element');
    t.within(generator.range(2, 3), 2, 3);
    const saved = generator.state;
    const expected = generator.next();
    generator.state = saved;
    t.eq(generator.next(), expected);
    t.ok(new Core.Prng(0).next() !== new Core.Prng(0).fork().next(), 'seed 0 gives a live stream');
  });

  t.test('UT-01-24 fnv1a32 vectors', () => {
    t.eq(Core.fnv1a32(''), 0x811c9dc5);
    t.eq(Core.fnv1a32('a'), 0xe40c292c);
    t.eq(Core.fnv1a32('foobar'), 0xbf9cf968);
    t.eq(Core.fnv1a32Hex('foobar'), 'bf9cf968');
    t.ok(/^[0-9a-f]{8}$/.test(Core.fnv1a32Hex('')), 'eight lowercase hex characters');
  });

  t.test('UT-01-25 formatTime', () => {
    t.eq(Core.formatTime(0), '0:00');
    t.eq(Core.formatTime(61.5), '1:01');
    t.eq(Core.formatTime(3599.999), '59:59');
    t.eq(Core.formatTime(-2), '-0:02');
    t.eq(Core.formatTime(NaN), '-:--');
    t.eq(Core.formatTime(61.5, { ms: true }), '1:01.500');
  });

  t.test('UT-01-26 clamp/lerp/smoothstep', () => {
    t.eq(Core.clamp(5, 0, 1), 1);
    t.eq(Core.clamp(-5, 0, 1), 0);
    t.eq(Core.lerp(0, 10, 0.5), 5);
    t.eq(Core.smoothstep(0, 1, 0.5), 0.5);
    t.eq(Core.smoothstep(0, 1, -1), 0);
    t.eq(Core.smoothstep(1, 1, 2), 1);
    t.eq(Core.smoothstep(1, 1, 0), 0);
  });

  t.test('UT-01-27 deepClone independence', () => {
    const source = { list: [1, { deep: 'x' }], nested: { value: 1 } };
    const copy = Core.deepClone(source);
    t.deepEq(copy, source);
    copy.list[1].deep = 'changed';
    copy.nested.value = 2;
    t.eq(source.list[1].deep, 'x');
    t.eq(source.nested.value, 1);
  });

  t.test('UT-01-28 assert throws coded error', () => {
    t.throws(() => Core.assert(false, 'm'), 'E-GEN-004');
    Core.assert(true, 'never thrown');
  });

  t.test('FI-037 bus listener throws', () => {
    Core.Faults.clearAll();
    const emitter = new Core.Emitter();
    const calls = [];
    ['a', 'b', 'c'].forEach((name) => emitter.on('error', () => calls.push(name)));
    t.eq(Core.Faults.set('error.throw', { origin: 'listener', count: 1 }), true);
    try {
      t.eq(emitter.emit('error', { code: 'E-GEN-005' }), 3);
      t.deepEq(calls, ['b', 'c']);
      t.eq(Core.Faults.active('error.throw'), null, 'the counted fault is used up');
      t.eq(emitter.emit('error', { code: 'E-GEN-005' }), 3);
      t.deepEq(calls, ['b', 'c', 'a', 'b', 'c']);
    } finally {
      Core.Faults.clearAll();
    }
  });

  t.test('UT-01-29 urlParams parses the query string', () => {
    const params = Core.urlParams('?test&tier=Low&name=a%20b&bad=%E0%A4%A');
    t.eq(params.test, '');
    t.eq(params.tier, 'Low');
    t.eq(params.name, 'a b');
    t.eq(params.bad, '%E0%A4%A');
    t.ok(Object.isFrozen(params), 'the result is frozen');
    t.deepEq(Object.keys(Core.urlParams('')), []);
  });

  t.test('UT-01-30 text catalog', () => {
    t.eq(Core.Text.has('E-CAP-004'), true);
    t.eq(Core.Text.get('E-CAP-004'), 'This browser is too old to run Finger Lickin Music.');
    t.eq(Core.Text.get('E-NET-010', { name: 'Sam' }), 'Disconnected Sam because their game sent invalid data.');
    t.eq(Core.Text.get('E-ZZZ-999'), 'Something went wrong (E-ZZZ-999).');
    t.eq(Core.Text.has('E-ZZZ-999'), false);
    t.ok(Object.isFrozen(Core.Text.all()), 'all() is frozen');
    t.eq(Core.Text.all()['fatal.title'], 'Finger Lickin Music stopped');
    t.ok(!/[^\x20-\x7e]/.test(Object.values(Core.Text.all()).join('')), 'texts are printable ASCII');
  });

  t.test('UT-01-31 fault registry', () => {
    Core.Faults.clearAll();
    t.eq(Core.Faults.NAMES.length, 14);
    t.ok(Object.isFrozen(Core.Faults.NAMES), 'NAMES is frozen');
    t.eq(Core.Faults.set('no.such.fault'), false);
    t.eq(Core.Faults.set('audio.fail', { count: 2 }), true);
    t.deepEq(Core.Faults.active('audio.fail'), { phase: 'node', count: 2 });
    t.eq(Core.Faults.take('audio.fail').count, 2);
    t.eq(Core.Faults.list()[0].args.count, 1);
    t.eq(Core.Faults.take('audio.fail').count, 1);
    t.eq(Core.Faults.take('audio.fail'), null, 'disarmed at zero');
    Core.Faults.set('net.drop');
    t.eq(Core.Faults.list().length, 1);
    Core.Faults.clear('net.drop');
    t.eq(Core.Faults.active('net.drop'), null);
    Core.Faults.clearAll();
  });

  t.test('UT-01-32 dom listeners tracked', () => {
    const target = fakeTarget();
    const owner = {};
    const before = Core.dom.count();
    const handler = () => {};
    const off = Core.dom.on(target, 'click', handler, undefined, owner);
    Core.dom.on(target, 'keydown', handler, { capture: true }, owner);
    t.eq(Core.dom.count() - before, 2);
    t.eq(target.added.length, 2);
    off();
    t.eq(Core.dom.count() - before, 1);
    Core.dom.off(target, 'keydown', handler, { capture: true });
    t.eq(Core.dom.count(), before);
    Core.dom.on(target, 'click', handler, undefined, owner);
    t.eq(Core.dom.offOwner(owner), 1);
    t.eq(target.added.length, 0);
  });
});
})();
