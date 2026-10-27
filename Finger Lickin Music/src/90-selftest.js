// 90-selftest.js - M-31 FLM.SelfTest: in-page test runner, assertions and fakes (test build only).
// Separation rule: this file owns exactly one namespace (SelfTest) and registers it once through
// FLM.Core.define. It never ships: the build puts 9*-*.js into the test build only (Part 3.3).
// It captures the real timer functions at load, so fake timers never disturb the runner itself.
// Spec: docs/IMPLEMENTATION-PLAN.md Part 6.31 (API 6.31.2, algorithms 6.31.4) and Part 3.4.4 (results).
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('SelfTest', function (FLM) {
  const VERSION = '1.0.0';
  /** The 36 group names of Part 3.1, in run order. The list is closed. */
  const KNOWN_GROUPS = Object.freeze(['core', 'theory', 'model', 'transport', 'audio', 'instruments', 'input',
    'mapping', 'rhythm', 'midi', 'zip', 'musicxml', 'guitarpro', 'import', 'project', 'storage', 'studio',
    'render', 'rig',
    'animation', 'stage', 'character', 'dance', 'net', 'progress', 'ui', 'screens', 'modes', 'boot', 'content',
    'selftest', 'integration', 'timing', 'files', 'faults', 'perf-smoke']);

  const DEFAULT_TIMEOUT_MS = 10000;      // Part 3.4.6: per-test default
  const SLOW_TIMEOUT_MS = 60000;         // Part 3.4.6: tests registered with { slow: true }
  const MESSAGE_LIMIT = 500;             // result messages are cut to this many characters (6.31.4.1)
  const VALUE_LIMIT = 200;               // values inside assertion messages are cut to this many characters
  const MAX_DIFF_DEPTH = 200;            // deepEq gives up on structures nested deeper than this
  const FRAME_MS = 1000 / 60;            // fake requestAnimationFrame step (6.31.4.3)
  const MAX_FAKE_CALLBACKS = 100000;     // guards FakeTimers.advance against endless interval chains
  const DEFAULT_SAMPLE_RATE = 48000;
  const ONSET_QUIET_SECONDS = 0.01;      // an onset needs 10 ms below the threshold before it (6.31.4.3)
  const DEFAULT_ONSET_THRESHOLD = 0.05;
  const DEFAULT_TAP_HOLD_MS = 50;
  const LANE_KEYS = Object.freeze(['KeyA', 'KeyS', 'KeyK', 'KeyL']);   // default instrument keys (06b)
  const FNV_OFFSET = 0x811c9dc5;
  const FNV_PRIME = 0x01000193;

  // Real browser functions, captured before any test can install fakes.
  const real = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    now: performance.now.bind(performance)
  };

  let activeStubs = [];          // Spy[] restored after every test
  let activeFakeTimers = [];     // FakeTimers[] uninstalled after every test

  // ---------------------------------------------------------------- errors and signals

  class AssertionError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AssertionError';
    }
  }

  class SkipSignal extends Error {
    constructor(reason) {
      super(reason);
      this.name = 'SkipSignal';
      this.isSkip = true;
    }
  }

  function errorMessage(error) {
    return error && error.message !== undefined ? String(error.message) : String(error);
  }

  function errorCode(error) {
    return String(error && error.code !== undefined ? error.code : errorMessage(error));
  }

  // ---------------------------------------------------------------- assertions (6.31.4.2)

  function describe(value) {
    let text;
    if (typeof value === 'number' && !Number.isFinite(value)) text = String(value);
    else if (['function', 'bigint', 'symbol'].includes(typeof value)) text = String(value);
    else {
      try { text = JSON.stringify(value); } catch (error) { text = String(value); }
      if (text === undefined) text = String(value);
    }
    return text.length > VALUE_LIMIT ? text.slice(0, VALUE_LIMIT) + '...' : text;
  }

  function fail(base, message) {
    throw new AssertionError(message ? message + ': ' + base : base);
  }

  function eq(actual, expected, message) {
    const same = Object.is(actual, expected) || (Number.isNaN(actual) && Number.isNaN(expected));
    if (!same) fail('expected ' + describe(expected) + ' but got ' + describe(actual), message);
  }

  function near(actual, expected, epsilon, message) {
    if (!(Math.abs(actual - expected) <= epsilon)) {
      fail('expected ' + describe(expected) + ' +/- ' + describe(epsilon) + ' but got ' + describe(actual), message);
    }
  }

  function within(value, low, high, message) {
    if (!(low <= value && value <= high)) {
      fail('expected ' + describe(value) + ' in [' + describe(low) + ', ' + describe(high) + ']', message);
    }
  }

  function ok(condition, message) {
    if (!condition) throw new AssertionError('assertion failed: ' + (message || ''));
  }

  const isObjectLike = (value) => typeof value === 'object' && value !== null;
  const isTyped = (value) => ArrayBuffer.isView(value) && !(value instanceof DataView);

  function childPath(path, key) {
    if (typeof key === 'number') return path + '[' + key + ']';
    return path === '' ? String(key) : path + '.' + key;
  }

  function mismatch(path, actual, expected) {
    return 'at ' + (path || '(root)') + ': expected ' + describe(expected) + ' got ' + describe(actual);
  }

  function compareLists(actual, expected, path) {
    if (actual.length !== expected.length) return mismatch(childPath(path, 'length'), actual.length, expected.length);
    for (let index = 0; index < actual.length; index += 1) {
      const difference = firstDifference(actual[index], expected[index], childPath(path, index), 0);
      if (difference) return difference;
    }
    return null;
  }

  function compareTyped(actual, expected, path) {
    if (!isTyped(actual) || !isTyped(expected) || actual.constructor !== expected.constructor) {
      return mismatch(path, actual, expected);
    }
    return compareLists(actual, expected, path);
  }

  function compareMaps(actual, expected, path, depth) {
    if (actual.size !== expected.size) return mismatch(childPath(path, 'size'), actual.size, expected.size);
    for (const [key, value] of actual) {
      const where = path + '<' + String(key) + '>';
      if (!expected.has(key)) return 'at ' + where + ': key missing in expected';
      const difference = firstDifference(value, expected.get(key), where, depth + 1);
      if (difference) return difference;
    }
    return null;
  }

  function compareSets(actual, expected, path) {
    if (actual.size !== expected.size) return mismatch(childPath(path, 'size'), actual.size, expected.size);
    for (const value of actual) {
      if (!expected.has(value)) return 'at ' + path + ': set member ' + describe(value) + ' missing in expected';
    }
    return null;
  }

  function compareProperties(actual, expected, path, depth) {
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    const missing = expectedKeys.filter((key) => !Object.prototype.hasOwnProperty.call(actual, key));
    const extra = actualKeys.filter((key) => !Object.prototype.hasOwnProperty.call(expected, key));
    if (missing.length > 0 || extra.length > 0) {
      return 'at ' + (path || '(root)') + ': expected keys [' + expectedKeys.join(',')
        + '] got [' + actualKeys.join(',') + ']';
    }
    for (const key of actualKeys) {
      const difference = firstDifference(actual[key], expected[key], childPath(path, key), depth + 1);
      if (difference) return difference;
    }
    return null;
  }

  /** @returns {string|null} description of the first difference, null when structurally equal. */
  function firstDifference(actual, expected, path, depth) {
    if (Object.is(actual, expected)) return null;
    if (!isObjectLike(actual) || !isObjectLike(expected)) return mismatch(path, actual, expected);
    if (depth > MAX_DIFF_DEPTH) return 'at ' + path + ': structure nested deeper than ' + MAX_DIFF_DEPTH;
    if (isTyped(actual) || isTyped(expected)) return compareTyped(actual, expected, path);
    if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return mismatch(path, actual, expected);
    if (Array.isArray(actual)) return compareLists(actual, expected, path);
    if (actual instanceof Map) return compareMaps(actual, expected, path, depth);
    if (actual instanceof Set) return compareSets(actual, expected, path);
    if (actual instanceof Date) {
      return actual.getTime() === expected.getTime() ? null : mismatch(path, actual, expected);
    }
    return compareProperties(actual, expected, path, depth);
  }

  function deepEq(actual, expected, message) {
    const difference = firstDifference(actual, expected, '', 0);
    if (difference) fail(difference, message);
  }

  function checkThrown(error, codePrefix, message) {
    if (!codePrefix) return;
    const code = errorCode(error);
    if (!code.startsWith(codePrefix)) fail('expected code ' + codePrefix + ' but got ' + code, message);
  }

  function throws(fn, codePrefix, message) {
    let thrown = null;
    let didThrow = false;
    try { fn(); } catch (error) { thrown = error; didThrow = true; }
    if (!didThrow) fail('expected a throw', message);
    checkThrown(thrown, codePrefix, message);
  }

  async function rejects(promiseOrFunction, codePrefix, message) {
    let thrown = null;
    let didReject = false;
    try {
      await (typeof promiseOrFunction === 'function' ? promiseOrFunction() : promiseOrFunction);
    } catch (error) {
      thrown = error;
      didReject = true;
    }
    if (!didReject) fail('expected a throw', message);
    checkThrown(thrown, codePrefix, message);
  }

  const assert = Object.freeze({ eq, deepEq, near, within, ok, throws, rejects });

  // ---------------------------------------------------------------- results shape (6.31.4.4)

  function deepFreeze(value) {
    if (isObjectLike(value) && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach((key) => deepFreeze(value[key]));
    }
    return value;
  }

  const RESULT_SHAPE = deepFreeze({
    version: 'string', build: 'string', userAgent: 'string', startedAt: 'string (ISO)', finishedAt: 'string (ISO)',
    options: { groups: 'string[] | null', slow: 'boolean', grep: 'string', touch: 'boolean' },
    known: 'string[]', unknown: 'string[]',
    groups: [{ name: 'string', total: 'number', passed: 'number', failed: 'number', skipped: 'number', ms: 'number' }],
    tests: [{ group: 'string', name: 'string', pass: 'boolean', skipped: 'boolean', ms: 'number', message: 'string' }],
    total: 'number', passed: 'number', failed: 'number', skipped: 'number', pageErrors: 'string[] (filled by the tool)'
  });

  function buildLabel() {
    const build = FLM.BUILD;
    const text = build && typeof build === 'object' ? build.date + ' test' : String(build);
    return FLM.VERSION + ' ' + text;
  }

  function newResults(groups, options, wanted, unknown) {
    return {
      version: VERSION, build: buildLabel(), userAgent: navigator.userAgent,
      startedAt: new Date().toISOString(), finishedAt: null,
      options: {
        groups: groups === undefined ? null : wanted, slow: !!options.slow, grep: options.grep || '',
        touch: !!options.touch
      },
      known: KNOWN_GROUPS.slice(), unknown, groups: [], tests: [],
      total: 0, passed: 0, failed: 0, skipped: 0, pageErrors: []
    };
  }

  function roundMs(value) {
    return Math.round(value * 10) / 10;
  }

  function recordTest(results, row, entry) {
    results.tests.push(entry);
    const kind = entry.skipped ? 'skipped' : (entry.pass ? 'passed' : 'failed');
    [results, row].forEach((target) => {
      target.total += 1;
      target[kind] += 1;
    });
  }

  function testEntry(group, name, outcome, ms) {
    return { group, name, pass: outcome.pass, skipped: outcome.skipped, ms: roundMs(ms), message: outcome.message };
  }

  // ---------------------------------------------------------------- fakes: clock and timers

  class FakeClock {
    constructor(startSeconds) {
      this.seconds = startSeconds || 0;
    }

    now() { return this.seconds; }

    advance(deltaSeconds) { this.seconds += deltaSeconds; }

    /** Same as advance but in milliseconds (T02.04 names `advance(ms)`; `advance` keeps seconds per Part 6.31). */
    advanceMs(deltaMs) { this.seconds += deltaMs / 1000; }

    set(seconds) { this.seconds = seconds; }
  }

  class FakeTimers {
    constructor() {
      this.entries = [];
      this.nextId = 1;
      this.virtualNow = 0;
      this.frameBase = 0;
      this.installed = false;
      this.saved = null;
      this.errors = [];
    }

    install() {
      if (this.installed) return;
      this.virtualNow = real.now();
      this.frameBase = this.virtualNow;
      this.saved = {
        setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
        setInterval: window.setInterval, clearInterval: window.clearInterval,
        requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame
      };
      window.setTimeout = (fn, ms, ...args) => this.schedule('timeout', fn, ms, args);
      window.clearTimeout = (id) => this.cancel(id);
      window.setInterval = (fn, ms, ...args) => this.schedule('interval', fn, ms, args);
      window.clearInterval = (id) => this.cancel(id);
      window.requestAnimationFrame = (fn) => this.schedule('frame', fn, 0, []);
      window.cancelAnimationFrame = (id) => this.cancel(id);
      performance.now = () => this.virtualNow;   // own property on the instance; deleted on uninstall (6.31.9)
      this.installed = true;
      activeFakeTimers.push(this);
    }

    uninstall() {
      if (!this.installed) return;
      window.setTimeout = this.saved.setTimeout;
      window.clearTimeout = this.saved.clearTimeout;
      window.setInterval = this.saved.setInterval;
      window.clearInterval = this.saved.clearInterval;
      window.requestAnimationFrame = this.saved.requestAnimationFrame;
      window.cancelAnimationFrame = this.saved.cancelAnimationFrame;
      delete performance.now;
      this.entries = [];
      this.installed = false;
      activeFakeTimers = activeFakeTimers.filter((timers) => timers !== this);
    }

    nextFrameTime() {
      const frameIndex = Math.floor((this.virtualNow - this.frameBase) / FRAME_MS + 1e-9) + 1;
      return this.frameBase + frameIndex * FRAME_MS;
    }

    schedule(type, fn, ms, args) {
      const delay = Math.max(0, Number(ms) || 0);
      const entry = {
        id: this.nextId, type, fn, args,
        due: type === 'frame' ? this.nextFrameTime() : this.virtualNow + delay,
        interval: type === 'interval' ? Math.max(1, delay) : 0
      };
      this.nextId += 1;
      this.entries.push(entry);
      return entry.id;
    }

    cancel(id) {
      this.entries = this.entries.filter((entry) => entry.id !== id);
    }

    pending() { return this.entries.length; }

    nextDue(limit) {
      let best = null;
      this.entries.forEach((entry) => {
        if (entry.due > limit) return;
        if (best === null || entry.due < best.due || (entry.due === best.due && entry.id < best.id)) best = entry;
      });
      return best;
    }

    fire(entry) {
      if (entry.type === 'interval') entry.due += entry.interval;
      else this.cancel(entry.id);
      try {
        if (entry.type === 'frame') entry.fn(this.virtualNow);
        else entry.fn(...entry.args);
      } catch (error) {
        this.errors.push(error);
      }
    }

    /** Runs every due timeout, interval and frame callback in time order, then moves the clock to the target. */
    advance(ms) {
      const target = this.virtualNow + ms;
      let calls = 0;
      let entry = this.nextDue(target);
      while (entry) {
        calls += 1;
        if (calls > MAX_FAKE_CALLBACKS) {
          throw new Error('fake timers: more than ' + MAX_FAKE_CALLBACKS + ' callbacks in one advance');
        }
        this.virtualNow = Math.max(this.virtualNow, entry.due);
        this.fire(entry);
        entry = this.nextDue(target);
      }
      this.virtualNow = target;
      if (this.errors.length > 0) {
        const first = this.errors[0];
        this.errors = [];
        throw first;
      }
    }
  }

  // ---------------------------------------------------------------- fakes: localStorage

  function quotaError(message) {
    return new DOMException(message || 'quota exceeded', 'QuotaExceededError');
  }

  class FakeStorage {
    constructor(options) {
      this.map = new Map();
      this.quotaBytes = options && typeof options.quotaBytes === 'number' ? options.quotaBytes : Infinity;
    }

    get length() { return this.map.size; }

    key(index) {
      const keys = Array.from(this.map.keys());
      return index >= 0 && index < keys.length ? keys[index] : null;
    }

    getItem(key) {
      const name = String(key);
      return this.map.has(name) ? this.map.get(name) : null;
    }

    usedBytes() {
      let total = 0;
      this.map.forEach((value, key) => { total += key.length + value.length; });
      return total;
    }

    setItem(key, value) {
      const name = String(key);
      const text = String(value);
      const previous = this.map.has(name) ? name.length + this.map.get(name).length : 0;
      if (this.usedBytes() - previous + name.length + text.length > this.quotaBytes) {
        throw quotaError('localStorage quota exceeded');
      }
      this.map.set(name, text);
    }

    removeItem(key) { this.map.delete(String(key)); }

    clear() { this.map.clear(); }
  }

  // ---------------------------------------------------------------- fakes: IndexedDB (6.31.4.3)

  const cloneValue = (value) => (typeof structuredClone === 'function'
    ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
  const domError = (name, message) => new DOMException(message || name, name);
  const keyId = (key) => typeof key + ':' + String(key);

  function compareKeyValues(a, b) {
    if (typeof a === typeof b) {
      if (a < b) return -1;
      return a > b ? 1 : 0;
    }
    return typeof a === 'number' ? -1 : 1;
  }

  function readPath(value, path) {
    return String(path).split('.')
      .reduce((current, part) => (isObjectLike(current) ? current[part] : undefined), value);
  }

  function writePath(value, path, newValue) {
    const parts = String(path).split('.');
    const last = parts.pop();
    const holder = parts.reduce((current, part) => current[part], value);
    holder[last] = newValue;
  }

  function estimateSize(value, seen) {
    if (typeof value === 'string') return value.length;
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (!isObjectLike(value) || seen.has(value)) return 0;
    seen.add(value);
    if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size;
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value.byteLength;
    let total = 0;
    Object.keys(value).forEach((key) => { total += key.length + estimateSize(value[key], seen); });
    return total;
  }

  function fireEvent(target, type, extra) {
    const event = Object.assign({
      type, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}
    }, extra);
    const handler = target['on' + type];
    if (typeof handler === 'function') handler.call(target, event);
    return event;
  }

  class FakeRequest {
    constructor(transaction, source) {
      this.result = undefined;
      this.error = null;
      this.readyState = 'pending';
      this.transaction = transaction || null;
      this.source = source || null;
      this.onsuccess = null;
      this.onerror = null;
      this.onupgradeneeded = null;
      this.onblocked = null;
    }
  }

  class FakeTransaction {
    constructor(database, factory, storeNames, mode) {
      this.db = database;
      this.factory = factory;
      this.storeNames = storeNames;      // null = every store (upgrade transaction)
      this.mode = mode;
      this.error = null;
      this.pending = 0;
      this.finished = false;
      this.aborted = false;
      this.oncomplete = null;
      this.onerror = null;
      this.onabort = null;
      this.whenFinished = null;          // internal hook used by open(): called with (aborted)
      this.snapshots = this.takeSnapshots();
      this.scheduleComplete();
    }

    takeSnapshots() {
      const snapshots = [];
      this.db.data.stores.forEach((store) => {
        if (this.storeNames === null || this.storeNames.includes(store.name)) {
          snapshots.push({ store, records: new Map(store.records), nextKey: store.nextKey });
        }
      });
      return snapshots;
    }

    objectStore(name) {
      const data = this.db.data.stores.get(name);
      const outOfScope = this.storeNames !== null && !this.storeNames.includes(name);
      if (!data || outOfScope) throw domError('NotFoundError', 'no store ' + name);
      return new FakeObjectStore(this, data);
    }

    scheduleComplete() {
      Promise.resolve().then(() => {
        if (this.finished || this.pending > 0) return;
        this.finished = true;
        fireEvent(this, 'complete');
        if (this.whenFinished) this.whenFinished(false);
      });
    }

    abort(error) {
      if (this.finished) return;
      this.finished = true;
      this.aborted = true;
      this.error = error || null;
      this.snapshots.forEach((snapshot) => {
        snapshot.store.records = snapshot.records;
        snapshot.store.nextKey = snapshot.nextKey;
      });
      Promise.resolve().then(() => {
        fireEvent(this, 'abort');
        if (this.whenFinished) this.whenFinished(true);
      });
    }

    /** Queues a request; work() runs in a microtask and returns the result or throws a DOMException. */
    request(work, isWrite, source) {
      if (this.finished) throw domError('TransactionInactiveError', 'transaction finished');
      if (isWrite && this.mode === 'readonly') throw domError('ReadOnlyError', 'transaction is read-only');
      const request = new FakeRequest(this, source);
      this.pending += 1;
      Promise.resolve().then(() => this.settle(request, work, isWrite));
      return request;
    }

    settle(request, work, isWrite) {
      if (this.finished) return;
      try {
        if (isWrite) this.factory.consumeWriteFault();
        request.result = work();
      } catch (error) {
        this.failRequest(request, error);
        return;
      }
      request.readyState = 'done';
      fireEvent(request, 'success');
      this.pending -= 1;
      this.scheduleComplete();
    }

    failRequest(request, error) {
      if (error.name === 'AbortError') {
        this.abort(error);
        return;
      }
      request.error = error;
      request.readyState = 'done';
      const event = fireEvent(request, 'error');
      if (typeof this.onerror === 'function') this.onerror(event);
      this.pending -= 1;
      if (event.defaultPrevented) this.scheduleComplete();
      else this.abort(error);
    }
  }

  class FakeIndex {
    constructor(transaction, storeData, definition) {
      this.transaction = transaction;
      this.storeData = storeData;
      this.name = definition.name;
      this.keyPath = definition.keyPath;
      this.unique = !!definition.unique;
    }

    matches(query) {
      const entries = Array.from(this.storeData.records.values()).filter((entry) => {
        const indexKey = readPath(entry.value, this.keyPath);
        return indexKey !== undefined && (query === undefined || Object.is(indexKey, query));
      });
      const keyPath = this.keyPath;
      return entries.sort((a, b) => compareKeyValues(readPath(a.value, keyPath), readPath(b.value, keyPath))
        || compareKeyValues(a.key, b.key));
    }

    get(query) {
      return this.transaction.request(() => {
        const found = this.matches(query)[0];
        return found ? this.transaction.factory.readValue(found) : undefined;
      }, false, this);
    }

    getAll(query) {
      const read = (entry) => this.transaction.factory.readValue(entry);
      return this.transaction.request(() => this.matches(query).map(read), false, this);
    }

    count(query) {
      return this.transaction.request(() => this.matches(query).length, false, this);
    }
  }

  class FakeObjectStore {
    constructor(transaction, data) {
      this.transaction = transaction;
      this.data = data;
      this.name = data.name;
      this.keyPath = data.keyPath;
      this.autoIncrement = data.autoIncrement;
    }

    get indexNames() { return Array.from(this.data.indexes.keys()); }

    createIndex(name, keyPath, options) {
      if (this.transaction.mode !== 'versionchange') throw domError('InvalidStateError', 'createIndex outside upgrade');
      if (this.data.indexes.has(name)) throw domError('ConstraintError', 'index exists: ' + name);
      const definition = { name, keyPath, unique: !!(options && options.unique) };
      this.data.indexes.set(name, definition);
      return new FakeIndex(this.transaction, this.data, definition);
    }

    index(name) {
      const definition = this.data.indexes.get(name);
      if (!definition) throw domError('NotFoundError', 'no index ' + name);
      return new FakeIndex(this.transaction, this.data, definition);
    }

    get(key) {
      return this.transaction.request(() => {
        const entry = this.data.records.get(keyId(key));
        return entry ? this.transaction.factory.readValue(entry) : undefined;
      }, false, this);
    }

    sortedEntries() {
      return Array.from(this.data.records.values()).sort((a, b) => compareKeyValues(a.key, b.key));
    }

    getAll(query) {
      return this.transaction.request(() => this.sortedEntries()
        .filter((entry) => query === undefined || Object.is(entry.key, query))
        .map((entry) => this.transaction.factory.readValue(entry)), false, this);
    }

    getAllKeys() {
      return this.transaction.request(() => this.sortedEntries().map((entry) => entry.key), false, this);
    }

    count() {
      return this.transaction.request(() => this.data.records.size, false, this);
    }

    put(value, key) { return this.write(value, key, false); }

    add(value, key) { return this.write(value, key, true); }

    resolveKey(stored, key) {
      if (this.data.keyPath !== null) {
        if (key !== undefined) throw domError('DataError', 'key given for an in-line key store');
        let inlineKey = readPath(stored, this.data.keyPath);
        if (inlineKey === undefined && this.data.autoIncrement) {
          inlineKey = this.data.nextKey;
          writePath(stored, this.data.keyPath, inlineKey);
        }
        if (inlineKey === undefined) throw domError('DataError', 'no key at ' + this.data.keyPath);
        return inlineKey;
      }
      if (key !== undefined) return key;
      if (this.data.autoIncrement) return this.data.nextKey;
      throw domError('DataError', 'a key is required');
    }

    checkUnique(key, stored) {
      this.data.indexes.forEach((definition) => {
        if (!definition.unique) return;
        const indexKey = readPath(stored, definition.keyPath);
        const clash = Array.from(this.data.records.values()).some((entry) => keyId(entry.key) !== keyId(key)
          && Object.is(readPath(entry.value, definition.keyPath), indexKey) && indexKey !== undefined);
        if (clash) throw domError('ConstraintError', 'unique index ' + definition.name);
      });
    }

    totalSize() {
      return this.transaction.db.factory.totalSize();
    }

    write(value, key, addOnly) {
      const stored = cloneValue(value);          // synchronous, so DataCloneError surfaces at the call (6.31.4.3)
      const resolvedKey = this.resolveKey(stored, key);
      return this.transaction.request(() => {
        const id = keyId(resolvedKey);
        const previous = this.data.records.get(id);
        if (addOnly && previous) throw domError('ConstraintError', 'key exists');
        this.checkUnique(resolvedKey, stored);
        const size = estimateSize(stored, new Set());
        const quota = this.transaction.factory.faults.quotaBytes;
        if (typeof quota === 'number' && this.totalSize() - (previous ? previous.size : 0) + size > quota) {
          throw quotaError('IndexedDB quota exceeded');
        }
        this.data.records.set(id, { key: resolvedKey, value: stored, size });
        if (typeof resolvedKey === 'number' && resolvedKey >= this.data.nextKey) {
          this.data.nextKey = Math.floor(resolvedKey) + 1;
        }
        return resolvedKey;
      }, true, this);
    }

    delete(key) {
      return this.transaction.request(() => {
        this.data.records.delete(keyId(key));
        return undefined;
      }, true, this);
    }

    clear() {
      return this.transaction.request(() => {
        this.data.records.clear();
        return undefined;
      }, true, this);
    }
  }

  class FakeDatabase {
    constructor(factory, data) {
      this.factory = factory;
      this.data = data;
      this.name = data.name;
      this.upgradeTransaction = null;
      this.closed = false;
      this.onversionchange = null;
      this.onclose = null;
    }

    get version() { return this.data.version; }

    get objectStoreNames() {
      const names = Array.from(this.data.stores.keys());
      names.contains = (name) => names.includes(name);
      return names;
    }

    createObjectStore(name, options) {
      if (!this.upgradeTransaction) throw domError('InvalidStateError', 'createObjectStore outside upgrade');
      if (this.data.stores.has(name)) throw domError('ConstraintError', 'store exists: ' + name);
      const keyPath = options && options.keyPath !== undefined ? options.keyPath : null;
      const data = {
        name, keyPath, autoIncrement: !!(options && options.autoIncrement), nextKey: 1,
        records: new Map(), indexes: new Map()
      };
      this.data.stores.set(name, data);
      return new FakeObjectStore(this.upgradeTransaction, data);
    }

    deleteObjectStore(name) {
      if (!this.upgradeTransaction) throw domError('InvalidStateError', 'deleteObjectStore outside upgrade');
      if (!this.data.stores.delete(name)) throw domError('NotFoundError', 'no store ' + name);
    }

    transaction(stores, mode) {
      if (this.closed) throw domError('InvalidStateError', 'database closed');
      const names = [].concat(stores);
      names.forEach((name) => {
        if (!this.data.stores.has(name)) throw domError('NotFoundError', 'no store ' + name);
      });
      return new FakeTransaction(this, this.factory, names, mode || 'readonly');
    }

    close() { this.closed = true; }
  }

  /** In-memory IndexedDB factory. options: {hangOpen, failNextWrite, quotaBytes, corruptOnRead} (fault options). */
  class FakeIndexedDB {
    constructor(options) {
      this.databases = new Map();
      this.faults = Object.assign(
        { hangOpen: false, failNextWrite: null, quotaBytes: undefined, corruptOnRead: undefined }, options);
    }

    failNextWrite(name) { this.faults.failNextWrite = name; }

    consumeWriteFault() {
      const name = this.faults.failNextWrite;
      if (!name) return;
      this.faults.failNextWrite = null;
      throw domError(name, 'injected ' + name);
    }

    totalSize() {
      let total = 0;
      this.databases.forEach((data) => data.stores.forEach((store) => store.records.forEach((entry) => {
        total += entry.size;
      })));
      return total;
    }

    /** Applies the corruptOnRead fault once, otherwise returns a fresh clone of the stored value. */
    readValue(entry) {
      const damaged = this.faults.corruptOnRead;
      if (damaged !== undefined && Object.is(damaged, entry.key)) {
        this.faults.corruptOnRead = undefined;
        return { damaged: true, key: entry.key };
      }
      return cloneValue(entry.value);
    }

    open(name, version) {
      const request = new FakeRequest(null, null);
      if (!this.faults.hangOpen) Promise.resolve().then(() => this.runOpen(request, name, version));
      return request;
    }

    failOpen(request, error) {
      request.error = error;
      request.readyState = 'done';
      fireEvent(request, 'error');
    }

    runOpen(request, name, version) {
      let data = this.databases.get(name);
      const existingVersion = data ? data.version : 0;
      const wanted = version === undefined ? (existingVersion || 1) : version;
      if (wanted < existingVersion) {
        this.failOpen(request, domError('VersionError', 'requested version is lower than ' + existingVersion));
        return;
      }
      if (!data) {
        data = { name, version: 0, stores: new Map() };
        this.databases.set(name, data);
      }
      const database = new FakeDatabase(this, data);
      request.result = database;
      if (wanted === data.version) {
        request.readyState = 'done';
        fireEvent(request, 'success');
        return;
      }
      this.runUpgrade(request, database, wanted);
    }

    runUpgrade(request, database, wanted) {
      const oldVersion = database.data.version;
      database.data.version = wanted;
      const transaction = new FakeTransaction(database, this, null, 'versionchange');
      database.upgradeTransaction = transaction;
      request.transaction = transaction;
      transaction.whenFinished = (aborted) => {
        database.upgradeTransaction = null;
        request.transaction = null;
        if (aborted) this.failOpen(request, domError('AbortError', 'upgrade aborted'));
        else {
          request.readyState = 'done';
          fireEvent(request, 'success');
        }
      };
      fireEvent(request, 'upgradeneeded', { oldVersion, newVersion: wanted });
      transaction.scheduleComplete();
    }

    deleteDatabase(name) {
      const request = new FakeRequest(null, null);
      Promise.resolve().then(() => {
        this.databases.delete(name);
        request.readyState = 'done';
        fireEvent(request, 'success');
      });
      return request;
    }
  }

  // ---------------------------------------------------------------- fakes: audio, input, stubs

  function offlineContext(options) {
    const settings = Object.assign({ seconds: 1, sampleRate: DEFAULT_SAMPLE_RATE, channels: 2 }, options);
    const Context = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Context) return Promise.reject(new Error('OfflineAudioContext is not available'));
    const frames = Math.ceil(settings.seconds * settings.sampleRate);
    return Promise.resolve(new Context(settings.channels, frames, settings.sampleRate));
  }

  /** Seconds at which abs(sample) first exceeds the threshold after at least 10 ms below it. */
  function onsets(audioBuffer, options) {
    const settings = Object.assign({ threshold: DEFAULT_ONSET_THRESHOLD, channel: 0 }, options);
    const samples = audioBuffer.getChannelData(settings.channel);
    const quietNeeded = Math.round(ONSET_QUIET_SECONDS * audioBuffer.sampleRate);
    const times = [];
    let quietRun = quietNeeded;       // the start of a buffer counts as quiet
    for (let index = 0; index < samples.length; index += 1) {
      if (Math.abs(samples[index]) > settings.threshold) {
        if (quietRun >= quietNeeded) times.push(index / audioBuffer.sampleRate);
        quietRun = 0;
      } else {
        quietRun += 1;
      }
    }
    return times;
  }

  function synthesizer() {
    if (!FLM.Input || !FLM.Input.synthesize) throw new Error('FLM.Input.synthesize is not available (M-07 not built)');
    return FLM.Input.synthesize;
  }

  function emitInputEvent(control, type, tAudio, source) {
    const hasAnchor = FLM.Input && typeof FLM.Input.audioToPerf === 'function';
    const toPerf = hasAnchor ? FLM.Input.audioToPerf : (seconds) => seconds * 1000;
    const payload = {
      source: source || 'synthetic', control, type, tPerf: toPerf(tAudio), tAudio, pressure: type === 'press' ? 1 : 0
    };
    FLM.Core.bus.emit('input.event', payload);
    return payload;
  }

  const inputs = {
    key(code, down, tPerf) { return synthesizer().key(code, down, tPerf); },
    tap(lane, tPerf, holdMs) {
      const code = LANE_KEYS[lane];
      if (code === undefined) throw new Error('tap: lane must be 0 to 3');
      synthesizer().key(code, true, tPerf);
      synthesizer().key(code, false, tPerf + (holdMs === undefined ? DEFAULT_TAP_HOLD_MS : holdMs));
    },
    pointer(id, type, x, y, tPerf, pointerType) {
      const pressure = type === 'up' || type === 'cancel' ? 0 : 0.5;
      return synthesizer().pointer(id, type, x, y, pressure, tPerf, pointerType || 'touch');
    },
    gamepad(state) { return synthesizer().gamepad(state); },
    midi(bytes, tPerf) { return synthesizer().midi(bytes, tPerf); },
    event: emitInputEvent
  };

  // ---------------------------------------------------------------- fixtures and the chart bot (Part 9.1.1 item 12)

  const FIXTURE_BEAT_TICKS = 960;        // one beat at PPQ 960; the fixture song is 120 BPM in 4/4
  const FIXTURE_TAIL_BEATS = 2;          // the fixture song runs this long after its last chart note
  const FIXTURE_LANES = 4;
  const BOT_STEP_MS = 5;                 // the bot's timer: every event goes out at most this late (limit: 50 ms)
  const BOT_TAP_HOLD_MS = 20;            // how long the bot holds a tap before it releases it

  /** The test song of IT-003: 120 BPM, 4/4, one track with a short note on each beat 1 to noteCount. */
  function fixtureSong(noteCount) {
    const Model = FLM.Model;
    const song = Model.Song.create({ id: 'test-song', title: 'Test song' });
    const track = Model.Track.create({ id: 'test-track', name: 'Test' }, song);
    const events = [];
    for (let beat = 1; beat <= noteCount; beat += 1) {
      events.push(Model.Events.note(beat * FIXTURE_BEAT_TICKS, FIXTURE_BEAT_TICKS / 2, 60, 100));
    }
    Model.replaceEvents(track, events);
    Model.Song.addTrack(song, track);
    song.durationTicks = (noteCount + FIXTURE_TAIL_BEATS) * FIXTURE_BEAT_TICKS;
    return song;
  }

  /** The chart of IT-003 for fixtureSong: one single-lane tap on beats 1 to noteCount, lane = beat % 4. */
  function fixtureChart(noteCount, difficulty) {
    const notes = [];
    for (let beat = 1; beat <= noteCount; beat += 1) {
      notes.push({ id: 'n' + beat, tick: beat * FIXTURE_BEAT_TICKS, durTicks: 1, lanes: [beat % FIXTURE_LANES],
        sourceEventIds: [], pitches: [60], isHold: false });
    }
    const level = difficulty || 'intermediate';
    return { id: 'test-song:test-track:' + level + ':A', songId: 'test-song', trackId: 'test-track', instrument: 0,
      difficulty: level, profile: 'A', notes, generatorVersion: 1, settingsHash: '00000000',
      omittedSourceEventIds: 0, source: 'generated' };
  }

  /**
   * The chart bot: for every chart note a press (and a release, at the hold end or after BOT_TAP_HOLD_MS) is sent
   * through Input.synthesize with the stamp of the note's audio time (Transport.main.audioTimeAt), turned into a
   * performance stamp through the input anchor. A timer sends each event once its stamp has passed. Call start()
   * after Transport.main.play() so that the anchor is the one of the run.
   * options: {offsetMs: delay after the note time, default 0; owner: timer owner token}
   */
  function createChartBot(chart, options) {
    const given = options || {};
    const offsetSeconds = (given.offsetMs || 0) / 1000;
    const owner = given.owner || Symbol('chart-bot');
    let queue = [];
    let timerId = null;
    let sent = 0;

    function keyFor(lane) {
      const keys = FLM.Input.getMap().keyboard.instrument['lane' + lane];
      return keys && keys.length > 0 ? keys[0] : LANE_KEYS[lane];
    }

    function eventsOf(note) {
      const main = FLM.Transport.main;
      const pressAt = main.audioTimeAt(note.tick) + offsetSeconds;
      const releaseAt = note.isHold ? main.audioTimeAt(note.tick + note.durTicks) + offsetSeconds
        : pressAt + BOT_TAP_HOLD_MS / 1000;
      return note.lanes.reduce((list, lane) => list.concat([{ audio: pressAt, code: keyFor(lane), down: true },
        { audio: releaseAt, code: keyFor(lane), down: false }]), []);
    }

    function sendDue() {
      const input = FLM.Input;
      const nowPerf = FLM.Core.now();
      while (queue.length > 0 && input.audioToPerf(queue[0].audio) <= nowPerf) {
        const item = queue.shift();
        input.synthesize.key(item.code, item.down, input.audioToPerf(item.audio));
        sent += 1;
      }
    }

    function start() {
      queue = chart.notes.reduce((list, note) => list.concat(eventsOf(note)), [])
        .sort((a, b) => a.audio - b.audio);
      if (timerId === null) timerId = FLM.Core.timers.setInterval(sendDue, BOT_STEP_MS, owner);
    }

    function stop() {
      if (timerId !== null) FLM.Core.timers.clearInterval(timerId);
      timerId = null;
      queue = [];
    }

    return { start, stop, pending: () => queue.length, sent: () => sent };
  }

  function createSpy(implementation) {
    const calls = [];
    function spy(...args) {
      const call = { args, result: undefined, error: undefined };
      calls.push(call);
      try {
        call.result = implementation ? implementation.apply(this, args) : undefined;
      } catch (error) {
        call.error = error;
        throw error;
      }
      return call.result;
    }
    Object.defineProperty(spy, 'count', { get() { return calls.length; } });
    spy.calls = calls;
    spy.last = () => calls[calls.length - 1];
    spy.reset = () => { calls.length = 0; };
    spy.restore = () => {};
    return spy;
  }

  function isFrozenMember(object, method) {
    const descriptor = Object.getOwnPropertyDescriptor(object, method);
    return !!descriptor && !descriptor.writable && !descriptor.configurable;
  }

  /** Replaces object[method] with a spy; the original comes back after the test (or through spy.restore()). */
  function stub(object, method, implementation) {
    if (typeof object[method] !== 'function') throw new Error('cannot stub ' + method + ': not a function');
    if (isFrozenMember(object, method)) throw new Error('cannot stub frozen ' + method);
    const original = object[method];
    const wasOwn = Object.prototype.hasOwnProperty.call(object, method);
    const spy = createSpy(implementation);
    spy.restore = () => {
      if (object[method] === spy) {
        if (wasOwn) object[method] = original;
        else delete object[method];
      }
      activeStubs = activeStubs.filter((entry) => entry !== spy);
    };
    object[method] = spy;
    activeStubs.push(spy);
    return spy;
  }

  function restoreAllStubs() {
    activeStubs.slice().reverse().forEach((spy) => spy.restore());
    activeStubs = [];
  }

  function uninstallAllTimers() {
    activeFakeTimers.slice().forEach((timers) => timers.uninstall());
    activeFakeTimers = [];
  }

  const fakes = Object.freeze({
    FakeClock, FakeIndexedDB, FakeTimers,
    clock(startSeconds) { return new FakeClock(startSeconds); },
    timers() { return new FakeTimers(); },
    indexedDB(options) { return new FakeIndexedDB(options); },
    localStorage(options) { return new FakeStorage(options); },
    offlineContext, onsets, inputs,
    inputEvent: emitInputEvent,
    stub,
    spy(fn) { return createSpy(fn); },
    stubCount() { return activeStubs.length; }
  });

  // ---------------------------------------------------------------- corpus store (6.31.4.5)

  function fnv1a32Bytes(bytes) {
    let hash = FNV_OFFSET;
    for (let index = 0; index < bytes.length; index += 1) {
      hash ^= bytes[index];
      hash = Math.imul(hash, FNV_PRIME) >>> 0;
    }
    return hash >>> 0;
  }

  function decodeBase64(text) {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function parseHash(value) {
    return typeof value === 'string' ? parseInt(value, 16) >>> 0 : Number(value) >>> 0;
  }

  class CorpusStore {
    constructor() {
      this.files = new Map();
      this.errors = [];            // file names whose bytes did not match their fnv1a32
    }

    load(entries) {
      (entries || []).forEach((entry) => {
        const bytes = decodeBase64(entry.base64 || '');
        if (fnv1a32Bytes(bytes) !== parseHash(entry.fnv1a32)) {
          this.errors.push(entry.file);
          return;
        }
        this.files.set(entry.file, { bytes, recipe: entry.recipe, format: entry.format, expect: entry.expect });
      });
    }

    has(file) { return this.files.has(file); }

    get(file) {
      if (!this.files.has(file)) throw new Error('corpus file not loaded: ' + file);
      return this.files.get(file);
    }

    list() { return Array.from(this.files.keys()).sort(); }

    loaded() { return this.files.size > 0 || this.errors.length > 0; }
  }

  // ---------------------------------------------------------------- performance scenario registry

  async function leaveToMenu() {
    const modes = FLM.Modes;
    if (!modes || typeof modes.current !== 'function') return;
    if (modes.current().mode !== 'menu') await modes.leave('user');
  }

  const perfScenarios = new Map();

  function mergeScenarioOutput(result, output) {
    if (!output || typeof output !== 'object') return;
    Object.assign(result.metrics, output.metrics);
    Object.assign(result.samples, output.samples);
    if (Array.isArray(output.notes)) result.notes.push(...output.notes);
    if (typeof output.durationMs === 'number') result.durationMs = output.durationMs;
  }

  const perf = {
    register(name, fn) { perfScenarios.set(name, fn); },
    list() { return Array.from(perfScenarios.keys()); },
    /** Never rejects: a failure inside the scenario is reported in notes. */
    async run(name, options) {
      const result = { name, durationMs: 0, metrics: {}, samples: {}, notes: [] };
      const scenario = perfScenarios.get(name);
      if (!scenario) {
        result.notes.push('unknown scenario');
        return result;
      }
      const started = real.now();
      try {
        await leaveToMenu();
        mergeScenarioOutput(result, await scenario(options || {}));
        await leaveToMenu();
      } catch (error) {
        result.notes.push('error: ' + (error && error.code ? error.code + ' ' : '') + errorMessage(error));
      }
      if (result.durationMs === 0) result.durationMs = roundMs(real.now() - started);
      return result;
    }
  };

  // ---------------------------------------------------------------- the runner (6.31.4.1)

  function withTimeout(promise, limitMs) {
    return new Promise((resolve, reject) => {
      const timer = real.setTimeout(() => reject(new Error('timeout after ' + limitMs + ' ms')), limitMs);
      promise.then((value) => { real.clearTimeout(timer); resolve(value); },
        (error) => { real.clearTimeout(timer); reject(error); });
    });
  }

  function outcomeFromError(error) {
    if (error && error.isSkip) return { pass: true, skipped: true, message: errorMessage(error) };
    return { pass: false, skipped: false, message: errorMessage(error).slice(0, MESSAGE_LIMIT) };
  }

  const PASSED = Object.freeze({ pass: true, skipped: false, message: '' });

  async function runHooks(hooks, context) {
    for (const hook of hooks) await hook(context);
  }

  async function runHooksSafely(hooks, context) {
    try {
      await runHooks(hooks, context);
      return null;
    } catch (error) {
      return error;
    }
  }

  function coreCounts() {
    const core = FLM.Core;
    return {
      timers: core.timers ? core.timers.count() : 0,
      raf: core.raf ? core.raf.count() : 0,
      dom: core.dom ? core.dom.count() : 0
    };
  }

  /** Leak check: Modes.assertClean() once M-28 exists, otherwise growth of the Core timer, frame and
   *  listener counts. */
  function findLeaks(baseline) {
    if (FLM.Modes && typeof FLM.Modes.assertClean === 'function') return FLM.Modes.assertClean();
    const now = coreCounts();
    const leaks = {};
    Object.keys(now).forEach((counter) => {
      if (now[counter] <= baseline[counter]) return;
      leaks[counter === 'raf' ? 'rafHandles' : counter] = { expected: baseline[counter], actual: now[counter] };
    });
    return Object.keys(leaks).length > 0 ? leaks : null;
  }

  function makeRunner(config) {
    const registry = new Map();
    const state = { running: null, lastResults: null, options: {}, owner: null };

    function addTest(entry, name, options, fn) {
      const callback = typeof options === 'function' ? options : fn;
      const testOptions = typeof options === 'function' || options === undefined ? {} : options;
      if (typeof name !== 'string' || name === '') throw new Error('a test needs a name');
      if (typeof callback !== 'function') throw new Error('test "' + name + '" needs a function');
      entry.tests.push({ name, opts: testOptions, fn: callback });
    }

    function createContext(entry) {
      const hooks = entry.hooks;
      return {
        test(name, options, fn) { addTest(entry, name, options, fn); },
        before(fn) { hooks.before.push(fn); },
        after(fn) { hooks.after.push(fn); },
        beforeEach(fn) { hooks.beforeEach.push(fn); },
        afterEach(fn) { hooks.afterEach.push(fn); },
        skip(reason) { throw new SkipSignal(reason); },
        eq, deepEq, near, within, ok, throws, rejects,
        fakes, corpus: config.corpus,
        get options() { return state.options; },
        get owner() { return state.owner; }
      };
    }

    function group(name, fn) {
      if (!KNOWN_GROUPS.includes(name)) throw new Error('unknown test group: ' + name);
      if (state.running) throw new Error('cannot register group ' + name + ' while a run is in progress');
      let entry = registry.get(name);
      if (!entry) {
        entry = { name, tests: [], hooks: { before: [], after: [], beforeEach: [], afterEach: [] }, context: null };
        entry.context = createContext(entry);
        registry.set(name, entry);
      }
      if (typeof fn === 'function') fn(entry.context);
    }

    function test(groupName, name, options, fn) {
      const entry = registry.get(groupName);
      if (!entry) throw new Error('group not registered: ' + groupName);
      addTest(entry, name, options, fn);
    }

    function groups() {
      return Array.from(registry.values()).map((entry) => ({
        name: entry.name, tests: entry.tests.length, slow: entry.tests.filter((item) => item.opts.slow).length
      }));
    }

    function progress() {
      const running = state.running;
      if (!running) return { running: false, group: null, index: 0, total: 0, passed: 0, failed: 0 };
      const { passed, failed } = running.results;
      return { running: true, group: running.group, index: running.index, total: running.total, passed, failed };
    }

    function isSelected(item, groupName, options) {
      if (item.opts.slow && !options.slow) return false;
      if (item.opts.touch === true && !options.touch) return false;
      if (!options.grep) return true;
      return (groupName + '/' + item.name).toLowerCase().includes(String(options.grep).toLowerCase());
    }

    function cleanupAfterTest() {
      restoreAllStubs();
      uninstallAllTimers();
      if (FLM.Core.bus && state.owner) FLM.Core.bus.removeOwner(state.owner);
      state.owner = null;
    }

    async function runTestBody(entry, item, options) {
      try {
        await runHooks(entry.hooks.beforeEach, entry.context);
        const fallbackLimit = item.opts.slow ? SLOW_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
        const limit = item.opts.timeoutMs || options.timeoutMs || fallbackLimit;
        await withTimeout(Promise.resolve().then(() => item.fn(entry.context)), limit);
        return PASSED;
      } catch (error) {
        return outcomeFromError(error);
      }
    }

    async function runTest(entry, item, options, results, row) {
      const started = real.now();
      state.owner = { test: item.name };
      let outcome = await runTestBody(entry, item, options);
      const afterError = await runHooksSafely(entry.hooks.afterEach, entry.context);
      if (afterError && outcome.pass && !outcome.skipped) {
        outcome = outcomeFromError(new Error('afterEach hook: ' + errorMessage(afterError)));
      }
      cleanupAfterTest();
      recordTest(results, row, testEntry(entry.name, item.name, outcome, real.now() - started));
    }

    function failSelected(entry, selected, message, results, row) {
      const outcome = { pass: false, skipped: false, message };
      selected.forEach((item) => recordTest(results, row, testEntry(entry.name, item.name, outcome, 0)));
    }

    async function runGroup(entry, options, results) {
      const row = { name: entry.name, total: 0, passed: 0, failed: 0, skipped: 0, ms: 0 };
      results.groups.push(row);
      const started = real.now();
      const baseline = coreCounts();
      const selected = entry.tests.filter((item) => isSelected(item, entry.name, options));
      const corpusFailure = entry.name === 'files' && config.corpus.errors.length > 0
        ? 'corpus hash mismatch: ' + config.corpus.errors.join(', ') : null;
      const beforeError = corpusFailure ? null : await runHooksSafely(entry.hooks.before, entry.context);
      if (corpusFailure) failSelected(entry, selected, corpusFailure, results, row);
      else if (beforeError) {
        const message = 'before hook: ' + errorMessage(beforeError).slice(0, MESSAGE_LIMIT);
        failSelected(entry, selected, message, results, row);
      }
      else for (const item of selected) await runTest(entry, item, options, results, row);
      await finishGroup(entry, baseline, results, row);
      row.ms = roundMs(real.now() - started);
    }

    async function finishGroup(entry, baseline, results, row) {
      const afterError = await runHooksSafely(entry.hooks.after, entry.context);
      if (afterError) {
        recordTest(results, row, testEntry(entry.name, entry.name + ' after hook',
          { pass: false, skipped: false, message: errorMessage(afterError).slice(0, MESSAGE_LIMIT) }, 0));
      }
      await leaveToMenu();
      // Error reports raised by a group's tests become toasts once Boot has started the UI; drop them
      // so their timers and listeners are not counted as the group's leaks.
      if (FLM.UI && typeof FLM.UI.clearToasts === 'function') FLM.UI.clearToasts();
      const leaks = findLeaks(baseline);
      if (leaks) {
        recordTest(results, row, testEntry(entry.name, entry.name + ' leak check',
          { pass: false, skipped: false, message: JSON.stringify(leaks).slice(0, MESSAGE_LIMIT) }, 0));
      }
    }

    /** Runs groups (undefined = all, a name or an array). Assigns window.__FLM_RESULTS when top level.
     *  Never rejects. */
    async function run(groupsToRun, runOptions) {
      const options = runOptions || {};
      const wanted = groupsToRun === undefined ? KNOWN_GROUPS.slice() : [].concat(groupsToRun);
      const unknown = wanted.filter((name) => !KNOWN_GROUPS.includes(name));
      const order = KNOWN_GROUPS.filter((name) => wanted.includes(name) && registry.has(name));
      const results = newResults(groupsToRun, options, wanted, unknown);
      // A test may start a nested run (UT-31-10): keep the outer run's state and put it back afterwards.
      const previous = { running: state.running, options: state.options, owner: state.owner };
      state.running = { group: null, index: 0, total: order.length, results };
      state.options = options;
      try {
        await leaveToMenu();
        for (let index = 0; index < order.length; index += 1) {
          state.running.group = order[index];
          state.running.index = index + 1;
          await runGroup(registry.get(order[index]), options, results);
        }
      } catch (error) {
        recordTest(results, { total: 0, passed: 0, failed: 0, skipped: 0 },
          testEntry('(runner)', 'runner error', outcomeFromError(error), 0));
      }
      state.running = previous.running;
      state.options = previous.options;
      state.owner = previous.owner;
      results.finishedAt = new Date().toISOString();
      state.lastResults = results;
      if (config.publish) window.__FLM_RESULTS = results;
      return results;
    }

    return { group, test, run, groups, progress, results: () => state.lastResults };
  }

  const corpus = new CorpusStore();
  const runner = makeRunner({ publish: true, corpus });

  return Object.freeze({
    VERSION,
    KNOWN_GROUPS,
    group: runner.group,
    test: runner.test,
    run: runner.run,
    groups: runner.groups,
    results: runner.results,
    progress: runner.progress,
    RESULT_SHAPE,
    /** Isolated runner with its own registry and corpus; it never touches window.__FLM_RESULTS. */
    createRunner() { return makeRunner({ publish: false, corpus: new CorpusStore() }); },
    createCorpus() { return new CorpusStore(); },
    assert,
    AssertionError,
    fakes,
    fixtures: Object.freeze({ song: fixtureSong, chart: fixtureChart }),
    chartBot: createChartBot,
    corpus,
    perf
  });
});
})();
