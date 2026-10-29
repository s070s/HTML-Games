// 91-test-storage.js - unit tests for M-16 FLM.Storage (group 'storage'; test build only).
// Until Phase 09 the group holds exactly UT-16-01 to UT-16-04, UT-16-19 and UT-16-22 (Part 6.16.8, T01.08).
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('storage', (t) => {
  const Core = FLM.Core;
  const Storage = FLM.Storage;
  const bus = Core.bus;
  const OPEN_TIMEOUT_PROBE_MS = 2100;        // past the 2,000 ms probe timeout of Part 4.3 B5
  const NOTICE_D1 = 'Browser database unavailable: projects are saved in limited local storage (2 MB each, ' +
    'no recordings). Export projects to keep them safe.';
  const NOTICE_D3 = 'Saving is unavailable in this browser context. Your work is kept in memory only until you ' +
    'export it.';
  const FILE_SUFFIX = ' Opening the file over http(s) usually restores the database.';

  let wasOpen = false;

  t.before(() => {
    wasOpen = Storage.state().opened;
  });

  t.afterEach(() => {
    Storage._teardownForTests();
  });

  // Puts the real backends back when boot had opened them before this group ran.
  t.after(async () => {
    if (wasOpen) await Storage.open();
  });

  // An IndexedDB factory whose open fails with the given DOMException name.
  function rejectingFactory(name) {
    return {
      open() {
        const request = { result: undefined, error: new DOMException('refused', name), onerror: null };
        Promise.resolve().then(() => { if (request.onerror) request.onerror({ target: request }); });
        return request;
      }
    };
  }

  // A localStorage that refuses everything, like a browser with storage blocked.
  function blockedStorage() {
    const refuse = () => { throw new DOMException('blocked', 'SecurityError'); };
    return { getItem: refuse, setItem: refuse, removeItem: refuse, key: refuse, get length() { return refuse(); } };
  }

  t.test('UT-16-01 init full mode', async () => {
    const idb = t.fakes.indexedDB();
    const ls = t.fakes.localStorage();
    const events = [];
    bus.on('storage.state', (event) => events.push(event), t.owner);
    const status = await Storage.open({ idbFactory: idb, localStorage: ls });
    t.eq(status.mode, 'full');
    t.eq(status.notice, null);
    t.eq(events.length, 1, 'storage.state is emitted once');
    t.eq(events[0].mode, 'full');
    t.eq(ls.getItem('flm.v1.probe'), null, 'the probe key is removed');
    const database = idb.databases.get('flm-db');
    t.eq(database.version, 1);
    t.deepEq(Array.from(database.stores.keys()), ['projects', 'recordings', 'charts', 'characters']);
    t.deepEq(Array.from(database.stores.get('projects').indexes.keys()), ['byModified']);
    t.deepEq(Array.from(database.stores.get('recordings').indexes.keys()), ['byProject']);
    t.deepEq(Array.from(database.stores.get('charts').indexes.keys()), ['byProject']);
    t.deepEq(Array.from(database.stores.get('characters').indexes.keys()), []);
  });

  t.test('UT-16-02 init localOnly when idb open rejects', async () => {
    const status = await Storage.open({ idbFactory: rejectingFactory('InvalidStateError'),
      localStorage: t.fakes.localStorage() });
    t.eq(status.mode, 'localOnly');
    t.eq(status.idb.error, 'InvalidStateError');
    // Text D1, followed by the D4 sentence when the page runs from file:// (Part 6.16.4 D).
    t.eq(status.notice, NOTICE_D1 + (status.isFile ? FILE_SUFFIX : ''));
  });

  t.test('UT-16-03 init localOnly when idb open hangs', async () => {
    const timers = t.fakes.timers();
    timers.install();
    const opening = Storage.open({ idbFactory: t.fakes.indexedDB({ hangOpen: true }),
      localStorage: t.fakes.localStorage() });
    timers.advance(OPEN_TIMEOUT_PROBE_MS);
    const status = await opening;
    t.eq(status.mode, 'localOnly');
    t.eq(status.idb.error, 'timeout');
    t.eq(Storage.state().idb.error, 'timeout');
  });

  t.test('UT-16-04 init memory mode', async () => {
    const status = await Storage.open({ idbFactory: null, localStorage: blockedStorage() });
    t.eq(status.mode, 'memory');
    t.eq(status.notice, NOTICE_D3);
    t.eq(Storage.set('round.trip', { a: 1, b: [2, 3] }).ok, true);
    t.deepEq(Storage.get('round.trip', null), { a: 1, b: [2, 3] });
  });

  t.test('UT-16-19 download fallback selection', async () => {
    const proto = window.HTMLAnchorElement.prototype;
    const saved = Object.getOwnPropertyDescriptor(proto, 'download');
    const nav = window.navigator;
    t.ok(saved !== undefined, 'the download attribute exists in this browser');
    // A desktop identity, so the iOS rule of Part 6.16.4 F never applies to this test.
    Object.defineProperty(nav, 'userAgent', { configurable: true,
      get: () => 'Mozilla/5.0 (X11; Linux x86_64) Chrome' });
    Object.defineProperty(nav, 'platform', { configurable: true, get: () => 'Linux x86_64' });
    try {
      delete proto.download;
      t.fakes.stub(window, 'open', () => null);
      const blocked = await Storage.download('a.txt', 'hello', 'text/plain');
      t.eq(blocked.method, 'none');
      t.eq(blocked.ok, false);
      t.eq(blocked.error.code, 'E-EXP-005');
    } finally {
      Object.defineProperty(proto, 'download', saved);
    }
    let clicked = null;
    t.fakes.stub(proto, 'click', function () { clicked = this; });
    try {
      const done = await Storage.download('a.txt', 'hello', 'text/plain');
      t.eq(done.method, 'anchor');
      t.eq(done.ok, true);
      t.ok(clicked instanceof window.HTMLAnchorElement, 'an anchor was clicked');
      t.eq(clicked.download, 'a.txt');
      t.ok(clicked.href.startsWith('blob:'), 'the anchor points at an object URL');
    } finally {
      delete nav.userAgent;
      delete nav.platform;
    }
  });

  t.test('UT-16-22 get with damaged value', async () => {
    const ls = t.fakes.localStorage();
    ls.setItem('flm.v1.settings', '{not json');
    await Storage.open({ idbFactory: null, localStorage: ls });
    Core.Log.clear();
    t.eq(Storage.get('settings', 'fallback'), 'fallback');
    t.eq(ls.getItem('flm.v1.settings'), null, 'the damaged key is removed');
    const entries = Core.Log.entries().filter((entry) => entry.tag === 'storage');
    t.eq(entries.length, 1, 'one log entry');
  });
});
})();
