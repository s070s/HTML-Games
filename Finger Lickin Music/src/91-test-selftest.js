// 91-test-selftest.js - UT-31-01 to UT-31-16: tests of the runner itself (Part 6.31.8).
// Every test runs its inner groups on SelfTest.createRunner(), so the real registry and
// window.__FLM_RESULTS stay untouched (UT-31-10 is the one test that uses the top-level runner).
(function () {
'use strict';
const FLM = window.FLM;
const SelfTest = FLM.SelfTest;

const TIMER_WAIT_MS = 25;         // UT-31-04 waits a little longer than the 20 ms it asserts
const SHORT_TIMEOUT_MS = 50;      // UT-31-05
const KNOWN_GROUP_COUNT = 36;

/** Runs `register` as the body of an inner group named selftest and resolves to its results object. */
function runInner(register, options) {
  const runner = SelfTest.createRunner();
  runner.group('selftest', register);
  return runner.run('selftest', options);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolves with the request result, or rejects with the request error. */
function settle(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Resolves 'complete' or 'abort' when the transaction finishes. */
function finish(transaction) {
  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve('complete');
    transaction.onabort = () => resolve('abort');
  });
}

FLM.SelfTest.group('selftest', (t) => {
  t.test('UT-31-01 passing test recorded', async () => {
    const results = await runInner((inner) => inner.test('ZZ-01 passes', () => {}));
    const entry = results.tests[0];
    t.eq(results.tests.length, 1);
    t.eq(entry.pass, true);
    t.eq(entry.skipped, false);
    t.ok(entry.ms >= 0, 'ms is not negative');
    t.eq(entry.message, '');
  });

  t.test('UT-31-02 failing assertion recorded', async () => {
    const results = await runInner((inner) => {
      inner.test('ZZ-01 fails', () => inner.eq(1, 2));
      inner.test('ZZ-02 still runs', () => {});
    });
    t.eq(results.tests.length, 2);
    t.eq(results.tests[0].pass, false);
    t.eq(results.tests[0].message, 'expected 2 but got 1');
    t.eq(results.tests[1].pass, true);
  });

  t.test('UT-31-03 thrown error recorded', async () => {
    const results = await runInner((inner) => inner.test('ZZ-01 throws', () => { throw new Error('boom'); }));
    t.eq(results.tests[0].pass, false);
    t.eq(results.tests[0].message, 'boom');
  });

  t.test('UT-31-04 async test awaited', async () => {
    const results = await runInner((inner) => inner.test('ZZ-01 waits', async () => {
      await wait(TIMER_WAIT_MS);
      inner.eq(1 + 1, 2);
    }));
    t.eq(results.tests[0].pass, true);
    t.ok(results.tests[0].ms >= 20, 'ms covers the awaited timer, got ' + results.tests[0].ms);
  });

  t.test('UT-31-05 timeout', async () => {
    const results = await runInner((inner) => {
      inner.test('ZZ-01 hangs', { timeoutMs: SHORT_TIMEOUT_MS }, () => new Promise(() => {}));
      inner.test('ZZ-02 after the hang', () => {});
    });
    t.eq(results.tests[0].pass, false);
    t.eq(results.tests[0].message, 'timeout after ' + SHORT_TIMEOUT_MS + ' ms');
    t.eq(results.tests[1].pass, true);
    t.ok(results.finishedAt !== null, 'the run finished');
  });

  t.test('UT-31-06 skip', async () => {
    const reason = 'no WebGL2 in headless';
    const results = await runInner((inner) => inner.test('ZZ-01 skipped', () => inner.skip(reason)));
    const entry = results.tests[0];
    t.eq(entry.skipped, true);
    t.eq(entry.pass, true);
    t.eq(entry.message, reason);
    t.eq(results.groups[0].skipped, 1);
  });

  t.test('UT-31-07 slow filter', async () => {
    const register = (inner) => {
      inner.test('ZZ-01 normal', () => {});
      inner.test('ZZ-02 slow', { slow: true }, () => {});
    };
    const without = await runInner(register);
    const withSlow = await runInner(register, { slow: true });
    t.eq(without.tests.length, 1);
    t.eq(withSlow.tests.length, 2);
  });

  t.test('UT-31-08 grep filter', async () => {
    const results = await runInner((inner) => {
      inner.test('ZZ-01 alpha', () => {});
      inner.test('ZZ-02 beta', () => {});
    }, { grep: 'BETA' });
    t.eq(results.tests.length, 1);
    t.eq(results.tests[0].name, 'ZZ-02 beta');
  });

  t.test('UT-31-09 unknown group', async () => {
    const results = await SelfTest.createRunner().run('nonsense');
    t.deepEq(results.unknown, ['nonsense']);
    t.eq(results.total, 0);
    t.eq(results.known.length, KNOWN_GROUP_COUNT);
  });

  t.test('UT-31-10 results shape and global', async () => {
    // The grep keeps the nested run to UT-31-01, so this test cannot recurse into itself. The nested
    // run publishes its results; the outer run overwrites window.__FLM_RESULTS when it finishes.
    const returned = await SelfTest.run('selftest', { grep: 'selftest/ut-31-01' });
    t.ok(window.__FLM_RESULTS === returned, 'the global holds the returned object');
    t.deepEq(Object.keys(returned).sort(), Object.keys(SelfTest.RESULT_SHAPE).sort());
    t.eq(returned.total, returned.tests.length);
    returned.groups.forEach((row) => {
      const entries = returned.tests.filter((entry) => entry.group === row.name);
      t.eq(row.total, entries.length);
      t.eq(row.passed + row.failed + row.skipped, row.total);
    });
  });

  t.test('UT-31-11 assertion semantics', async () => {
    t.near(0.1 + 0.2, 0.3, 1e-12);
    t.within(5, 0, 5);
    t.deepEq({ a: new Map([['k', new Float32Array([1, 2])]]) }, { a: new Map([['k', new Float32Array([1, 2])]]) });
    t.throws(() => { throw Object.assign(new Error('x'), { code: 'E-CNT-001' }); }, 'E-CNT-001');
    await t.rejects(() => Promise.reject(Object.assign(new Error('x'), { code: 'E-CNT-002' })), 'E-CNT-002');
    let message = '';
    try {
      t.deepEq({ tracks: [{ events: [{ tick: 959 }] }] }, { tracks: [{ events: [{ tick: 960 }] }] });
    } catch (error) {
      message = error.message;
    }
    t.eq(message, 'at tracks[0].events[0].tick: expected 960 got 959');
    t.throws(() => t.eq(1, 2), '');
    t.throws(() => t.near(1, 2, 0.1));
    t.throws(() => t.within(6, 0, 5));
    t.throws(() => t.ok(false, 'nope'));
  });

  t.test('UT-31-12 stubs restored', async () => {
    const results = await runInner((inner) => {
      inner.test('ZZ-01 stubs', () => {
        inner.fakes.stub(Math, 'max', () => 42);
        inner.eq(Math.max(1, 2), 42);
      });
      inner.test('ZZ-02 sees the original', () => inner.eq(Math.max(1, 2), 2));
    });
    t.eq(results.tests[0].pass, true);
    t.eq(results.tests[1].pass, true);
    t.eq(SelfTest.fakes.stubCount(), 0);
  });

  t.test('UT-31-13 fake clock with transport', async () => {
    const clock = SelfTest.fakes.clock(1);
    clock.advance(0.5);
    t.eq(clock.now(), 1.5);
    clock.set(10);
    t.eq(clock.now(), 10);

    const timers = SelfTest.fakes.timers();
    const originalSetTimeout = window.setTimeout;
    const order = [];
    timers.install();
    try {
      const start = performance.now();
      setTimeout(() => order.push('timeout100'), 100);
      const intervalId = setInterval(() => order.push('interval40'), 40);
      requestAnimationFrame((time) => order.push('frame' + Math.round(time - start)));
      timers.advance(100);
      clearInterval(intervalId);
      t.near(performance.now() - start, 100, 1e-6);
    } finally {
      timers.uninstall();
    }
    t.deepEq(order, ['frame17', 'interval40', 'interval40', 'timeout100']);
    t.ok(window.setTimeout === originalSetTimeout, 'setTimeout restored');
    t.ok(!Object.prototype.hasOwnProperty.call(performance, 'now'), 'performance.now is the prototype method again');

    // Part 6.31.8: a Transport on the fake clock. play anchors at now + 0.05, so one second later the position is
    // (1.00 - 0.05) s x 1,920 ticks per second = 1,824.
    const transportClock = SelfTest.fakes.clock();
    const transport = FLM.Transport.create({ clock: transportClock, bus: new FLM.Core.Emitter() });
    transport.load(FLM.Model.Song.create());
    t.eq(transport.play(), true);
    transportClock.advance(1);
    t.eq(Math.floor(transport.positionAt(transportClock.now())), 1824);
  });

  t.test('UT-31-14 fake IndexedDB basics and faults', async () => {
    const factory = SelfTest.fakes.indexedDB();
    const opening = factory.open('ut-31-14', 1);
    opening.onupgradeneeded = (event) => {
      const store = event.target.result.createObjectStore('songs', { keyPath: 'id' });
      store.createIndex('byGroup', 'group', { unique: false });
    };
    const database = await settle(opening);

    const writing = database.transaction('songs', 'readwrite');
    const done = finish(writing);
    writing.objectStore('songs').put({ id: 'a', group: 'x', title: 'Alpha' });
    writing.objectStore('songs').put({ id: 'b', group: 'x', title: 'Beta' });
    t.eq(await done, 'complete');

    const reading = database.transaction('songs', 'readonly');
    const found = await settle(reading.objectStore('songs').get('a'));
    t.deepEq(found, { id: 'a', group: 'x', title: 'Alpha' });
    const grouped = await settle(reading.objectStore('songs').index('byGroup').getAll('x'));
    t.eq(grouped.length, 2);

    factory.failNextWrite('QuotaExceededError');
    const failing = database.transaction('songs', 'readwrite');
    const outcome = finish(failing);
    const request = failing.objectStore('songs').put({ id: 'c', group: 'x', title: 'Gamma' });
    let errorName = '';
    request.onerror = (event) => { errorName = event.target.error.name; };
    t.eq(await outcome, 'abort');
    t.eq(errorName, 'QuotaExceededError');
    const check = database.transaction('songs', 'readonly');
    t.eq(await settle(check.objectStore('songs').get('c')), undefined);
  });

  t.test('UT-31-15 group leak check', async () => {
    if (!FLM.Core.timers) t.skip('FLM.Core.timers is not available');
    const owner = {};
    let intervalId = null;
    try {
      const results = await runInner((inner) => inner.test('ZZ-01 leaks an interval', () => {
        intervalId = FLM.Core.timers.setInterval(() => {}, 1000, owner);
      }));
      const leak = results.tests.find((entry) => entry.name === 'selftest leak check');
      t.ok(leak !== undefined, 'a leak check entry was added');
      t.eq(leak.pass, false);
      t.ok(leak.message.includes('timers'), 'the message names the timers counter: ' + leak.message);
    } finally {
      if (intervalId !== null) FLM.Core.timers.clearInterval(intervalId);
    }
  });

  t.test('UT-31-16 corpus hash check', async () => {
    const corpus = SelfTest.createCorpus();
    corpus.load([{ file: 'a.mid', base64: 'TVRoZA==', fnv1a32: 0 }]);
    t.deepEq(corpus.errors, ['a.mid']);
    t.eq(corpus.has('a.mid'), false);
    // The same bytes with their real hash load without an error.
    const good = SelfTest.createCorpus();
    good.load([{ file: 'b.mid', base64: 'TVRoZA==', fnv1a32: 0x044aa5c0 }]);
    t.deepEq(good.errors, []);
    t.eq(good.has('b.mid'), true);
  });

  // T03.10: the fixtures and the chart bot of Part 9.1.1 item 12 (the IT rows use them through the instrument mode).
  t.test('T03.10 fixtures: the IT-003 song and chart; the chart bot presses at the audio time of each note', () => {
    const song = SelfTest.fixtures.song(4);
    const chart = SelfTest.fixtures.chart(4, 'expert');
    t.deepEq(chart.notes.map((note) => [note.tick, note.lanes[0]]), [[960, 1], [1920, 2], [2880, 3], [3840, 0]]);
    t.eq(chart.difficulty, 'expert');
    t.eq(song.durationTicks, 6 * 960, 'two beats after the last note');
    t.eq(song.tempoMap.tempoAt(0).bpm, 120);
    const owner = Symbol('bot-test');
    const main = FLM.Transport.main;
    const timers = t.fakes.timers();
    timers.install();
    t.fakes.detachAudio();                   // the real audio clock does not follow fake time
    const events = [];
    FLM.Core.bus.on('input.event', (event) => events.push(event), t.owner);
    FLM.Input.bind({ owner, context: 'instrument' });
    main.load(song);
    main.play({ countInBars: 0 });
    const bot = SelfTest.chartBot(chart, { offsetMs: 30 });
    try {
      bot.start();
      t.eq(bot.pending(), 8, 'a press and a release per note');
      timers.advance(3000);
      t.eq(bot.sent(), 8);
      const presses = events.filter((event) => event.type === 'press');
      t.deepEq(presses.map((event) => event.control), ['lane1', 'lane2', 'lane3', 'lane0']);
      presses.forEach((event, index) => t.near(event.tAudio, main.audioTimeAt(chart.notes[index].tick) + 0.03, 1e-6));
      t.deepEq(FLM.Input.held(), []);
    } finally {
      bot.stop();
      main.stop();
      main.unload();
      FLM.Input.unbind(owner);
    }
    t.eq(bot.pending(), 0);
  });
});
})();
