// 01-core.js - M-01 FLM.Core: root namespace, module registry, event bus, tracked timers and listeners,
// log ring, text catalog, fault registry, capability detection, error reporting, diagnostics, utilities.
// Separation rule: this file is the one exception to the module skeleton (Part 3.11): it creates the
// namespace itself because define() does not exist before it. It imports nothing and is loaded first.
// The Part 10.6 code table and the Part 7.11 texts are data blocks near the end of the file.
(function () {
'use strict';
const VERSION = '0.1.0';
const BUILD = '@@BUILD@@';
const RELAY_URL = '@@RELAY_URL@@';
const LICENSE_NOTICE = 'Copyright (c) 2026 the Finger Lickin Music authors. All rights reserved.';   // Part 10.3.3, interim notice
const FLM = window.FLM = { VERSION, BUILD, RELAY_URL };

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------
const LOG_CAPACITY = 500;                 // Part 6.1.6: the log ring holds the latest 500 entries
const LOG_ONCE_KEY_LIMIT = 1000;          // oldest once-key is evicted beyond this
const LOG_STRING_LIMIT = 200;
const LOG_ARRAY_LIMIT = 32;
const LOG_DEPTH_LIMIT = 4;
const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const OMITTED = '[omitted]';
const EMIT_DEPTH_LIMIT = 8;               // T01.03: nested emit depth limit (a re-emitting listener is a bug)
const LISTENER_WARN_LIMIT = 100;          // leak signal: warn once per topic above this many listeners
const RECENT_ERROR_LIMIT = 50;
const STACK_LIMIT = 2000;
const DIAGNOSTICS_CAP = 200 * 1024;       // 204,800 bytes (Part 10.10.2 rule 5)
const DIAGNOSTICS_STRING_LIMIT = 200;
const DIAGNOSTICS_ARRAY_LIMIT = 200;
const DIAGNOSTICS_KEPT_ERRORS = 20;
const DIAGNOSTICS_DROP_FRACTION = 0.25;
const USER_AGENT_LIMIT = 200;
const DEFAULT_SEED = 0x9E3779B9;          // replaces seed 0 so the Prng stream is never degenerate
const PROBE_KEY = 'flm.v1.probe';
const ERROR_OWNER = 'core.errors';
const FATAL_OWNER = 'core.fatal';
// Keys removed from the diagnostics document unless includeContent is true (Part 10.10.2 rule 3).
const REDACTED_KEY_PATTERN =
  /^(title|artist|fileName|name|text|lyric|lyrics|displayName|roomCode|sdp|relayUrl|projectName|trackName)$/i;
const URL_PATTERN = /(https?|file|blob):\/\/[^\s)'"]+/g;
const CLASS_NAMES = { R: 'recoverable', M: 'returnToMenu', X: 'reload' };
// E-GEN codes whose class depends on origin (Part 4.9): reload while booting, else recoverable.
const BOOT_SENSITIVE_CODES = ['E-GEN-001', 'E-GEN-002', 'E-GEN-004'];

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------
function now() {
  const perf = window.performance;
  return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
}

function codedError(code, text) {
  const error = new Error(code + ': ' + text);
  error.code = code;
  return error;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function messageOf(err) {
  if (err === null || err === undefined) return '';
  if (typeof err === 'string') return err;
  return typeof err.message === 'string' ? err.message : String(err);
}

// Stack traces never carry page addresses or file paths into records (P 19, Part 10.10.2 rule 3).
function scrubUrls(text) {
  return String(text).replace(URL_PATTERN, '<page>');
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

let uidCounter = 0;
function uid() {
  const counter = (uidCounter += 1) - 1;
  const random = Math.floor(Math.random() * 1679616).toString(36).padStart(4, '0');
  return Date.now().toString(36) + '-' + counter.toString(36) + '-' + random;
}

function deepClone(value) {
  if (typeof window.structuredClone === 'function') return window.structuredClone(value);
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw codedError('E-GEN-004', message === undefined ? 'assertion failed' : String(message));
}

function pad(number, width) {
  return String(number).padStart(width, '0');
}

function formatTime(seconds, options) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '-:--';
  const sign = seconds < 0 ? '-' : '';
  const total = Math.abs(seconds);
  const text = sign + Math.floor(total / 60) + ':' + pad(Math.floor(total % 60), 2);
  if (!options || !options.ms) return text;
  return text + '.' + pad(Math.floor((total - Math.floor(total)) * 1000), 3);
}

function fnv1a32(text) {
  let hash = 0x811c9dc5;
  const input = String(text);
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function fnv1a32Hex(text) {
  return pad(fnv1a32(text).toString(16), 8);
}

// Parses a query string into a frozen plain object; a key without "=" maps to '' (Part 4.3 B2).
function urlParams(search) {
  const source = search === undefined ? (window.location && window.location.search) || '' : String(search);
  const params = Object.create(null);
  source.replace(/^\?/, '').split('&').forEach(function (pair) {
    if (pair === '') return;
    const cut = pair.indexOf('=');
    const key = decodeSafely(cut < 0 ? pair : pair.slice(0, cut));
    if (key === '' || key === '__proto__') return;
    params[key] = cut < 0 ? '' : decodeSafely(pair.slice(cut + 1));
  });
  return Object.freeze(params);
}

function decodeSafely(text) {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch (error) {
    return text;
  }
}

/** Seeded generator (mulberry32). Same seed gives the same stream on every browser. */
class Prng {
  constructor(seed) {
    this.s = (Number(seed) >>> 0) || DEFAULT_SEED;
  }

  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(n) {
    return Math.floor(this.next() * n);
  }

  range(lo, hi) {
    return lo + this.next() * (hi - lo);
  }

  pick(array) {
    return array[this.int(array.length)];
  }

  shuffle(array) {
    for (let index = array.length - 1; index > 0; index -= 1) {
      const other = this.int(index + 1);
      const held = array[index];
      array[index] = array[other];
      array[other] = held;
    }
    return array;
  }

  fork() {
    return new Prng(Math.floor(this.next() * 4294967296));
  }

  get state() {
    return this.s;
  }

  set state(value) {
    this.s = Number(value) >>> 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Log ring (never persisted)
// ---------------------------------------------------------------------------------------------
const logSlots = new Array(LOG_CAPACITY);
const logOnceKeys = new Set();
let logWriteIndex = 0;
let logCount = 0;
let logThreshold = LOG_LEVELS.info;

function isDomNode(value) {
  return typeof value.nodeType === 'number' && typeof value.nodeName === 'string';
}

// JSON-safe snapshot: depth <= 4, arrays cut to 32, strings to 200 chars, functions and DOM nodes omitted.
function safeData(value, depth) {
  const level = depth || 0;
  if (value === undefined || value === null) return value;
  const kind = typeof value;
  if (kind === 'string') return value.slice(0, LOG_STRING_LIMIT);
  if (kind === 'boolean') return value;
  if (kind === 'number') return Number.isFinite(value) ? value : String(value);
  if (kind !== 'object') return OMITTED;
  if (level > LOG_DEPTH_LIMIT || isDomNode(value)) return OMITTED;
  if (value instanceof Error) return { message: messageOf(value).slice(0, LOG_STRING_LIMIT) };
  if (Array.isArray(value)) return value.slice(0, LOG_ARRAY_LIMIT).map((item) => safeItem(item, level + 1));
  const copy = {};
  Object.keys(value).forEach(function (key) {
    copy[key] = safeItem(value[key], level + 1);
  });
  return copy;
}

function safeItem(item, level) {
  try {
    return safeData(item, level);
  } catch (error) {
    return OMITTED;   // a throwing getter must never break logging
  }
}

function writeLog(level, tag, message, data) {
  if (LOG_LEVELS[level] < logThreshold) return false;
  logSlots[logWriteIndex] = { t: now(), level, tag: String(tag), msg: String(message), data: safeItem(data, 0) };
  logWriteIndex = (logWriteIndex + 1) % LOG_CAPACITY;
  logCount = Math.min(logCount + 1, LOG_CAPACITY);
  return true;
}

function logOnce(key, level, tag, message, data) {
  if (logOnceKeys.has(key)) return false;
  if (logOnceKeys.size >= LOG_ONCE_KEY_LIMIT) logOnceKeys.delete(logOnceKeys.values().next().value);
  logOnceKeys.add(key);
  writeLog(LOG_LEVELS[level] ? level : 'info', tag, message, data);
  return true;
}

function logEntries() {
  const entries = [];
  const start = (logWriteIndex - logCount + LOG_CAPACITY) % LOG_CAPACITY;
  for (let offset = 0; offset < logCount; offset += 1) entries.push(logSlots[(start + offset) % LOG_CAPACITY]);
  return entries;
}

function clearLog() {
  logSlots.fill(undefined);
  logWriteIndex = 0;
  logCount = 0;
  logOnceKeys.clear();
}

function setLogLevel(level) {
  assert(hasOwn(LOG_LEVELS, level), 'unknown log level ' + level);
  logThreshold = LOG_LEVELS[level];
}

const Log = Object.freeze({
  debug: (tag, msg, data) => writeLog('debug', tag, msg, data),
  info: (tag, msg, data) => writeLog('info', tag, msg, data),
  warn: (tag, msg, data) => writeLog('warn', tag, msg, data),
  error: (tag, msg, data) => writeLog('error', tag, msg, data),
  /** Logs once per key for the lifetime of the page; returns true the first time. */
  once: logOnce,
  entries: logEntries,
  clear: clearLog,
  setLevel: setLogLevel
});

// ---------------------------------------------------------------------------------------------
// Fault registry (Part 10.9.1)
// ---------------------------------------------------------------------------------------------
const FAULT_DEFAULTS = {
  'audio.suspend': { blockResumeMs: 0 },
  'audio.fail': { phase: 'node', count: 1 },
  'render.contextLoss': { restoreAfterMs: 1000, oom: false },
  'render.slowFrames': { ms: 300, everyN: 1, durationMs: null },
  'storage.quota': { target: 'both' },
  'storage.writeFail': { stage: 'swap', count: 1 },
  'net.drop': { peer: 'all', silent: false },
  'net.delay': { ms: 200, jitterMs: 0, peer: 'all' },
  'net.duplicate': { probability: 1, peer: 'all' },
  'net.reorder': { window: 3, peer: 'all' },
  'input.disconnect': { source: 'gamepad' },
  'import.truncate': { fraction: 0.5 },
  'timer.stall': { ms: 300, count: 1, skipTicks: 0 },
  'error.throw': { origin: 'frame', count: 1 }
};
const FAULT_NAMES = Object.freeze(Object.keys(FAULT_DEFAULTS));
const armedFaults = new Map();

function setFault(name, args) {
  if (!hasOwn(FAULT_DEFAULTS, name)) return false;
  const merged = Object.assign({}, FAULT_DEFAULTS[name], args || {});
  armedFaults.set(name, { args: merged, hits: 0 });
  writeLog('warn', 'fault', name, merged);
  return true;
}

function peekFault(name) {
  const fault = armedFaults.get(name);
  return fault ? fault.args : null;
}

// Check point for continuous faults.
function activeFault(name) {
  const fault = armedFaults.get(name);
  if (!fault) return null;
  fault.hits += 1;
  return fault.args;
}

// Check point for counted faults: returns the args, then counts down and disarms at 0.
function takeFault(name) {
  const fault = armedFaults.get(name);
  if (!fault) return null;
  fault.hits += 1;
  const taken = Object.assign({}, fault.args);
  if (typeof fault.args.count === 'number') {
    fault.args.count -= 1;
    if (fault.args.count <= 0) armedFaults.delete(name);
  }
  return taken;
}

function listFaults() {
  return Array.from(armedFaults, ([name, fault]) => ({ name, args: Object.assign({}, fault.args), hits: fault.hits }));
}

const Faults = Object.freeze({
  NAMES: FAULT_NAMES,
  set: setFault,
  clear: (name) => { armedFaults.delete(name); },
  clearAll: () => { armedFaults.clear(); },
  active: activeFault,
  take: takeFault,
  list: listFaults
});

// ---------------------------------------------------------------------------------------------
// Event bus
// ---------------------------------------------------------------------------------------------
/** Topic bus. Listeners are isolated from each other; emit iterates a snapshot (Part 6.1.4.2). */
class Emitter {
  constructor() {
    this.topicMap = new Map();
    this.depth = 0;
  }

  /** @returns {function} unsubscribe */
  on(topic, fn, owner) {
    return this.addEntry(topic, fn, owner, false);
  }

  once(topic, fn, owner) {
    return this.addEntry(topic, fn, owner, true);
  }

  addEntry(topic, fn, owner, once) {
    assert(typeof topic === 'string' && typeof fn === 'function', 'Emitter.on needs a topic string and a function');
    let list = this.topicMap.get(topic);
    if (!list) {
      list = [];
      this.topicMap.set(topic, list);
    }
    const existing = list.find((entry) => entry.fn === fn);
    if (existing) return existing.unsubscribe;   // invariant: no duplicate {topic, fn} pair
    const entry = { fn, owner, once, unsubscribe: null };
    entry.unsubscribe = () => this.removeEntry(topic, entry);
    list.push(entry);
    if (list.length > LISTENER_WARN_LIMIT) {
      logOnce('bus.leak.' + topic, 'warn', 'bus', 'more than ' + LISTENER_WARN_LIMIT + ' listeners on ' + topic);
    }
    return entry.unsubscribe;
  }

  removeEntry(topic, entry) {
    const list = this.topicMap.get(topic);
    const index = list ? list.indexOf(entry) : -1;
    if (index < 0) return false;
    list.splice(index, 1);
    if (list.length === 0) this.topicMap.delete(topic);
    return true;
  }

  /** @returns {boolean} true when a listener was removed */
  off(topic, fn) {
    const list = this.topicMap.get(topic);
    const entry = list ? list.find((item) => item.fn === fn) : undefined;
    return entry ? this.removeEntry(topic, entry) : false;
  }

  /** @returns {number} listeners removed */
  removeOwner(owner) {
    if (owner === undefined || owner === null) return 0;
    let removed = 0;
    Array.from(this.topicMap.keys()).forEach((topic) => {
      this.topicMap.get(topic).filter((entry) => entry.owner === owner).forEach((entry) => {
        if (this.removeEntry(topic, entry)) removed += 1;
      });
    });
    return removed;
  }

  /** Calls every listener of the snapshot in subscription order; returns the number of listeners. */
  emit(topic, payload) {
    const list = this.topicMap.get(topic);
    if (!list) return 0;
    if (this.depth >= EMIT_DEPTH_LIMIT) {
      this.reportDepth(topic);
      return 0;
    }
    const snapshot = list.slice();
    this.depth += 1;
    try {
      snapshot.forEach((entry) => this.callListener(entry, topic, payload));
    } finally {
      this.depth -= 1;
    }
    return snapshot.length;
  }

  callListener(entry, topic, payload) {
    if (entry.once) this.removeEntry(topic, entry);
    try {
      if (topic === 'error') throwInjectedListenerFault();
      entry.fn(payload, topic);
    } catch (error) {
      reportListenerError(topic, error);
    }
  }

  reportDepth(topic) {
    const message = 'emit depth limit ' + EMIT_DEPTH_LIMIT + ' reached on ' + topic;
    if (!logOnce('bus.depth.' + topic, 'error', 'bus', message)) return;
    if (topic !== 'error') ErrorReporter.report('E-GEN-001', new Error(message), { topic });
  }

  listenerCount(topic) {
    if (topic !== undefined) return this.topicMap.has(topic) ? this.topicMap.get(topic).length : 0;
    let total = 0;
    this.topicMap.forEach((list) => { total += list.length; });
    return total;
  }

  topics() {
    return Array.from(this.topicMap.keys());
  }

  /** Tests only. */
  clear() {
    this.topicMap.clear();
    this.depth = 0;
  }
}

// Fault error.throw {origin:'listener'}: the next 'error' listener call throws (FI-037).
function throwInjectedListenerFault() {
  const fault = peekFault('error.throw');
  if (fault && fault.origin === 'listener' && takeFault('error.throw')) {
    throw new Error('E-GEN-001: injected listener fault');
  }
}

function reportListenerError(topic, error) {
  if (topic === 'error') {
    writeLog('error', 'bus', 'an error listener threw: ' + messageOf(error));   // reporting it would recurse
    return;
  }
  ErrorReporter.report('E-GEN-001', error, { topic });
}

const bus = new Emitter();

// ---------------------------------------------------------------------------------------------
// Tracked timers, animation frames and DOM listeners (Part 4.7.3)
// ---------------------------------------------------------------------------------------------
const handles = new Map();     // id -> {kind, nativeId, owner, ...}; ids come from one counter
let handleCounter = 0;
const FRAME_FALLBACK_MS = 16;

function nextHandleId() {
  handleCounter += 1;
  return handleCounter;
}

function reportCallbackError(error, origin) {
  ErrorReporter.report('E-GEN-001', error, { origin });
}

function countHandles(kinds, owner) {
  let total = 0;
  handles.forEach((handle) => {
    if (kinds.indexOf(handle.kind) >= 0 && (owner === undefined || handle.owner === owner)) total += 1;
  });
  return total;
}

function removeHandlesOf(kinds, owner, release) {
  if (owner === undefined) return 0;
  let removed = 0;
  Array.from(handles.keys()).forEach((id) => {
    const handle = handles.get(id);
    if (handle.owner !== owner || kinds.indexOf(handle.kind) < 0) return;
    release(id, handle);
    removed += 1;
  });
  return removed;
}

const TIMER_KINDS = ['timeout', 'interval'];

function releaseTimer(id, handle) {
  handles.delete(id);
  if (handle.kind === 'timeout') window.clearTimeout(handle.nativeId);
  else window.clearInterval(handle.nativeId);
}

const timers = Object.freeze({
  setTimeout(fn, ms, owner) {
    assert(typeof fn === 'function', 'timers.setTimeout needs a function');
    const id = nextHandleId();
    const nativeId = window.setTimeout(function () {
      handles.delete(id);
      try { fn(); } catch (error) { reportCallbackError(error, 'timer'); }
    }, ms);
    handles.set(id, { kind: 'timeout', nativeId, owner });
    return id;
  },
  clearTimeout(id) {
    const handle = handles.get(id);
    if (handle && handle.kind === 'timeout') releaseTimer(id, handle);
  },
  setInterval(fn, ms, owner) {
    assert(typeof fn === 'function', 'timers.setInterval needs a function');
    const id = nextHandleId();
    const nativeId = window.setInterval(function () {
      try { fn(); } catch (error) { reportCallbackError(error, 'timer'); }
    }, ms);
    handles.set(id, { kind: 'interval', nativeId, owner });
    return id;
  },
  clearInterval(id) {
    const handle = handles.get(id);
    if (handle && handle.kind === 'interval') releaseTimer(id, handle);
  },
  clearOwner: (owner) => removeHandlesOf(TIMER_KINDS, owner, releaseTimer),
  count: (owner) => countHandles(TIMER_KINDS, owner)
});

function releaseFrame(id, handle) {
  handles.delete(id);
  if (handle.fallback) window.clearTimeout(handle.nativeId);
  else window.cancelAnimationFrame(handle.nativeId);
}

const raf = Object.freeze({
  request(fn, owner) {
    assert(typeof fn === 'function', 'raf.request needs a function');
    const id = nextHandleId();
    const callback = function (timestamp) {
      handles.delete(id);
      try { fn(timestamp); } catch (error) { reportCallbackError(error, 'frame'); }
    };
    const fallback = typeof window.requestAnimationFrame !== 'function';
    const nativeId = fallback
      ? window.setTimeout(() => callback(now()), FRAME_FALLBACK_MS)
      : window.requestAnimationFrame(callback);
    handles.set(id, { kind: 'frame', nativeId, owner, fallback });
    return id;
  },
  cancel(id) {
    const handle = handles.get(id);
    if (handle && handle.kind === 'frame') releaseFrame(id, handle);
  },
  cancelOwner: (owner) => removeHandlesOf(['frame'], owner, releaseFrame),
  count: (owner) => countHandles(['frame'], owner)
});

function captureOf(options) {
  return options === true || Boolean(options && options.capture);
}

function releaseListener(id, handle) {
  handles.delete(id);
  handle.target.removeEventListener(handle.type, handle.fn, handle.options);
}

const dom = Object.freeze({
  /** @returns {function} off() */
  on(target, type, fn, options, owner) {
    assert(target && typeof target.addEventListener === 'function', 'dom.on needs an event target');
    assert(typeof fn === 'function', 'dom.on needs a function');
    const id = nextHandleId();
    target.addEventListener(type, fn, options);
    handles.set(id, { kind: 'listener', target, type, fn, options, capture: captureOf(options), owner });
    return () => {
      const handle = handles.get(id);
      if (handle) releaseListener(id, handle);
    };
  },
  off(target, type, fn, options) {
    const capture = captureOf(options);
    const found = Array.from(handles).find(([, handle]) => handle.kind === 'listener' && handle.target === target &&
      handle.type === type && handle.fn === fn && handle.capture === capture);
    if (found) releaseListener(found[0], found[1]);
  },
  offOwner: (owner) => removeHandlesOf(['listener'], owner, releaseListener),
  count: () => countHandles(['listener'])
});

// ---------------------------------------------------------------------------------------------
// Text catalog (Part 7.11.1)
// ---------------------------------------------------------------------------------------------
function fillPlaceholders(code, template, params) {
  return template.replace(/\{(\w+)\}/g, function (match, key) {
    if (params && hasOwn(params, key)) return String(params[key]);
    logOnce('text.param.' + code + '.' + key, 'warn', 'text', 'missing text parameter ' + key + ' for ' + code);
    return '';
  });
}

function buildTextTable() {
  const table = {};
  Object.keys(CODE_TABLE).forEach((code) => { table[code] = CODE_TABLE[code][1]; });
  return Object.freeze(Object.assign(table, TEXT_VARIANTS, TEXT_EXTRA));
}

const Text = Object.freeze({
  /** Unknown code: the E-GEN-000 text naming that code. Missing parameters become '' (logged once). */
  get(code, params) {
    if (!hasOwn(TEXT_TABLE, code)) {
      return fillPlaceholders('E-GEN-000', TEXT_TABLE['E-GEN-000'], { original: String(code) });
    }
    return fillPlaceholders(code, TEXT_TABLE[code], params);
  },
  has: (code) => hasOwn(TEXT_TABLE, code),
  all: () => TEXT_TABLE
});

// ---------------------------------------------------------------------------------------------
// Capabilities (Part 6.1.4.4, Part 4.3 B3)
// ---------------------------------------------------------------------------------------------
// Soft capabilities: a missing one is listed in degraded[] (the hard gate itself belongs to M-29).
const SOFT_CAPS = ['webgl2', 'webgl1', 'offlineAudioContext', 'mediaRecorder', 'pointerEvents', 'gamepad', 'webMidi',
  'indexedDB', 'localStorage', 'visibility', 'storageEstimate', 'performanceMemory'];
const MIN_TOUCH_POINTS = 4;
let capsReport = null;

function probe(fn, fallback) {
  try {
    const value = fn();
    return value === undefined ? fallback : value;
  } catch (error) {
    return fallback;   // a throwing probe yields false (or 0 / '') for that key only
  }
}

function probeWebgl(contextNames) {
  const canvas = window.document.createElement('canvas');
  for (let index = 0; index < contextNames.length; index += 1) {
    const gl = canvas.getContext(contextNames[index]);
    if (gl) {
      const lose = typeof gl.getExtension === 'function' ? gl.getExtension('WEBGL_lose_context') : null;
      if (lose) lose.loseContext();   // do not hold a GPU context on mobile
      return true;
    }
  }
  return false;
}

function probeLocalStorage() {
  window.localStorage.setItem(PROBE_KEY, '1');
  window.localStorage.removeItem(PROBE_KEY);
  return true;
}

function probeMobile(touchPoints, userAgent) {
  if (!(touchPoints > 0)) return false;
  const data = window.navigator.userAgentData;
  return data ? data.mobile === true : /Mobi|Android|iPhone|iPad/.test(userAgent);
}

function detectCaps() {
  const nav = window.navigator || {};
  const report = {};
  report.webgl2 = probe(() => probeWebgl(['webgl2']), false);
  report.webgl1 = probe(() => probeWebgl(['webgl', 'experimental-webgl']), false);
  report.audioContext = probe(() => typeof (window.AudioContext || window.webkitAudioContext) === 'function', false);
  report.offlineAudioContext = probe(
    () => typeof (window.OfflineAudioContext || window.webkitOfflineAudioContext) === 'function', false);
  report.mediaRecorder = probe(() => typeof window.MediaRecorder === 'function', false);
  report.pointerEvents = probe(() => 'PointerEvent' in window, false);
  report.maxTouchPoints = probe(() => nav.maxTouchPoints || 0, 0);
  report.gamepad = probe(() => typeof nav.getGamepads === 'function', false);
  report.secureContext = probe(() => window.isSecureContext === true, false);
  report.webMidi = probe(() => typeof nav.requestMIDIAccess === 'function' && window.isSecureContext === true, false);
  report.indexedDB = probe(() => 'indexedDB' in window && window.indexedDB !== null, false);
  report.localStorage = probe(probeLocalStorage, false);
  report.isFile = probe(() => window.location.protocol === 'file:', false);
  report.visibility = probe(() => 'visibilityState' in window.document, false);
  report.storageEstimate = probe(() => Boolean(nav.storage) && typeof nav.storage.estimate === 'function', false);
  report.performanceMemory = probe(() => Boolean(window.performance.memory) &&
    typeof window.performance.memory.usedJSHeapSize === 'number', false);
  report.devicePixelRatio = probe(() => window.devicePixelRatio || 1, 1);
  report.dpr = report.devicePixelRatio;   // Part 4.3 B3 name for the same value
  report.hardwareConcurrency = probe(() => nav.hardwareConcurrency || 0, 0);
  report.userAgent = probe(() => String(nav.userAgent || '').slice(0, USER_AGENT_LIMIT), '');
  report.mobile = probe(() => probeMobile(report.maxTouchPoints, report.userAgent), false);
  report.reducedMotionPref = probe(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches === true, false);
  report.language = probe(() => String(nav.language || ''), '');
  report.degraded = Object.freeze(degradedFrom(report));
  report.probedAt = new Date().toISOString();
  return Object.freeze(report);
}

function degradedFrom(report) {
  const degraded = SOFT_CAPS.filter((key) => report[key] === false);
  const touch = report.maxTouchPoints;
  if (touch > 0 && touch < MIN_TOUCH_POINTS) degraded.push('maxTouchPoints');
  return degraded;
}

/** Probes every capability, stores the frozen report and returns it. */
function detectAndStoreCaps() {
  capsReport = detectCaps();
  return capsReport;
}

const Caps = Object.freeze({
  get: () => capsReport || detectAndStoreCaps(),
  refresh: detectAndStoreCaps,
  detect: detectAndStoreCaps,
  isMobile: () => (capsReport || detectAndStoreCaps()).mobile === true
});

// ---------------------------------------------------------------------------------------------
// Error reporting (Part 4.9, Part 6.1.4.5, Part 10.6)
// ---------------------------------------------------------------------------------------------
const recentErrors = [];
let presenter = null;
let handlersInstalled = false;
let fatalShown = false;
let bootReady = false;

function classify(code, info) {
  const entry = hasOwn(CODE_TABLE, code) ? CODE_TABLE[code] : null;
  if (!entry) return 'recoverable';
  const isBoot = info && info.phase === 'boot';
  if (isBoot && BOOT_SENSITIVE_CODES.indexOf(code) >= 0) return 'reload';
  return CLASS_NAMES[entry[0]];
}

function buildRecord(code, err, context, forcedClass) {
  const known = hasOwn(CODE_TABLE, code);
  const finalCode = known ? code : 'E-GEN-000';
  const safeContext = safeItem(context || {}, 0);
  const info = safeContext && typeof safeContext === 'object' ? safeContext : {};
  if (!known) info.original = String(code).slice(0, 40);
  const stack = err && typeof err.stack === 'string' ? scrubUrls(err.stack).slice(0, STACK_LIMIT) : '';
  const time = now();
  return {
    id: uid(),
    t: time,
    at: time,
    code: finalCode,
    class: forcedClass || classify(finalCode, info),
    message: scrubUrls(messageOf(err)).slice(0, LOG_STRING_LIMIT * 2),
    userMessage: userMessageFor(finalCode, info),
    module: typeof info.module === 'string' ? info.module : '',
    stack,
    context: info,
    count: 1
  };
}

function userMessageFor(code, info) {
  const template = CODE_TABLE[code][1];
  return template === '' ? '' : Text.get(code, info);
}

// A repeated report of the same code, message and module raises count instead of adding a record.
function storeRecord(record) {
  const same = recentErrors.find((item) => item.code === record.code && item.message === record.message &&
    item.module === record.module);
  if (same) {
    same.count += 1;
    same.t = record.t;
    same.at = record.at;
    return same;
  }
  recentErrors.push(record);
  if (recentErrors.length > RECENT_ERROR_LIMIT) recentErrors.shift();
  return record;
}

function present(record) {
  if (typeof presenter !== 'function') return;
  try {
    presenter(record);
  } catch (error) {
    writeLog('error', 'errors', 'presenter threw: ' + messageOf(error));
  }
}

function publishReport(code, err, context, forcedClass) {
  const record = storeRecord(buildRecord(code, err, context, forcedClass));
  writeLog('error', record.code, record.message, record.context);
  bus.emit('error', record);
  present(record);
  if (record.class === 'reload') showFatal(record);
  return record;
}

/** Never throws: a failing reporter must not hide the original problem. */
function report(code, err, context) {
  try {
    return publishReport(code, err, context, null);
  } catch (inner) {
    writeLog('error', 'errors', 'report failed: ' + messageOf(inner));
    return { code: String(code), class: 'recoverable', message: messageOf(err), userMessage: '', count: 1 };
  }
}

/** Forces class reload and shows #fatal. */
function fatal(code, err, context) {
  try {
    return publishReport(code, err, context, 'reload');
  } catch (inner) {
    writeLog('error', 'errors', 'fatal report failed: ' + messageOf(inner));
    return { code: String(code), class: 'reload', message: messageOf(err), userMessage: '', count: 1 };
  }
}

function fatalChild(parent, tag, id) {
  let element = window.document.getElementById(id);
  if (!element) {
    element = window.document.createElement(tag);
    element.id = id;
    parent.appendChild(element);
  }
  return element;
}

function copyDiagnostics() {
  const text = exportDiagnostics().json;
  const clipboard = window.navigator.clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    clipboard.writeText(text).catch(() => selectDiagnosticsText(text));
    return;
  }
  selectDiagnosticsText(text);
}

// Fallback when the clipboard is refused: a visible textarea with the text selected.
function selectDiagnosticsText(text) {
  const panel = window.document.getElementById('fatal');
  if (!panel) return;
  const area = fatalChild(panel.firstElementChild || panel, 'textarea', 'fatal-diag');
  area.value = text;
  area.readOnly = true;
  area.select();
}

// Renders #fatal with textContent only; it must work when every other module is broken.
function showFatal(record) {
  if (fatalShown) return;
  fatalShown = true;
  try {
    renderFatal(record || {});
  } catch (error) {
    writeLog('error', 'errors', 'showFatal failed: ' + messageOf(error));
  }
}

function renderFatal(record) {
  const doc = window.document;
  let panel = doc.getElementById('fatal');
  if (!panel) {
    panel = doc.createElement('div');
    panel.id = 'fatal';
    panel.setAttribute('role', 'alertdialog');
    doc.body.appendChild(panel);
  }
  const inner = panel.firstElementChild || panel.appendChild(doc.createElement('div'));
  fatalChild(inner, 'h2', 'fatal-title').textContent = Text.get('fatal.title');
  const detail = fatalChild(inner, 'p', 'fatal-text');
  detail.className = 'code';
  detail.style.whiteSpace = 'pre-line';
  const shown = record.userMessage || record.message || Text.get('fatal.fallback', { code: record.code || '' });
  detail.textContent = shown + '\n' + Text.get('fatal.code', { code: record.code || '' });
  fatalChild(inner, 'p', 'fatal-hint').textContent = Text.get('fatal.body');
  const hadReload = Boolean(doc.getElementById('fatal-reload'));
  const reload = fatalChild(inner, 'button', 'fatal-reload');
  reload.textContent = Text.get('fatal.reload');
  if (!hadReload) dom.on(reload, 'click', () => window.location.reload(), undefined, FATAL_OWNER);
  const copy = fatalChild(inner, 'button', 'fatal-copy');
  copy.textContent = Text.get('fatal.copy');
  dom.on(copy, 'click', copyDiagnostics, undefined, FATAL_OWNER);
  panel.hidden = false;
  panel.classList.add('show');
}

function bootPhase() {
  return bootReady ? undefined : 'boot';
}

function onWindowError(event) {
  report('E-GEN-001', event.error || event.message, {
    src: scrubUrls(event.filename || ''), line: event.lineno, phase: bootPhase()
  });
}

function onUnhandledRejection(event) {
  report('E-GEN-002', event.reason, { phase: bootPhase() });
}

// Errors buffered by the early handler of shell.html (strings, or {message, source, line}).
function drainEarlyErrors() {
  const early = window.__flmEarlyErrors;
  if (!Array.isArray(early)) return;
  early.forEach(function (item) {
    const message = item && typeof item === 'object' ? item.message : item;
    report('E-GEN-001', String(message), { early: true, line: item && item.line });
  });
  delete window.__flmEarlyErrors;
}

function installHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;
  dom.on(window, 'error', onWindowError, undefined, ERROR_OWNER);
  dom.on(window, 'unhandledrejection', onUnhandledRejection, undefined, ERROR_OWNER);
  drainEarlyErrors();
}

// Tests only: forget records and the shown fatal screen, leave handlers installed.
function resetErrorsForTests() {
  recentErrors.length = 0;
  fatalShown = false;
  dom.offOwner(FATAL_OWNER);
  const panel = window.document && window.document.getElementById('fatal');
  if (!panel) return;
  panel.classList.remove('show');
  const area = window.document.getElementById('fatal-diag');
  if (area && area.parentNode) area.parentNode.removeChild(area);
}

const ErrorReporter = Object.freeze({
  get CLASS_TABLE() { return CLASS_TABLE; },   // data block below; read lazily
  install: installHandlers,
  report,
  fatal,
  classify,
  setPresenter: (fn) => { presenter = typeof fn === 'function' ? fn : null; },
  records: () => recentErrors.slice(),
  showFatal,
  _resetForTests: resetErrorsForTests
});

// ---------------------------------------------------------------------------------------------
// Diagnostics export (Part 6.1.4.6, Part 10.10.2)
// ---------------------------------------------------------------------------------------------
const diagnosticProviders = new Map();

function collectProviders() {
  const collected = {};
  diagnosticProviders.forEach(function (provider, key) {
    try {
      const value = provider();
      collected[key] = value === undefined ? null : JSON.parse(JSON.stringify(value));
    } catch (error) {
      collected[key] = { error: String(messageOf(error)).slice(0, DIAGNOSTICS_STRING_LIMIT) };
    }
  });
  return collected;
}

function redactText(text) {
  return text.length > DIAGNOSTICS_STRING_LIMIT ? text.slice(0, DIAGNOSTICS_STRING_LIMIT) + '...' : text;
}

function redactArray(array) {
  const kept = array.slice(0, DIAGNOSTICS_ARRAY_LIMIT).map(redact);
  if (array.length > DIAGNOSTICS_ARRAY_LIMIT) kept.push('[+' + (array.length - DIAGNOSTICS_ARRAY_LIMIT) + ' more]');
  return kept;
}

// Removes personal keys and cuts long strings and arrays; stack traces keep their own 2,000 char cap.
function redact(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return redactArray(value);
  if (!value || typeof value !== 'object') return value;
  const copy = {};
  Object.keys(value).forEach(function (key) {
    if (REDACTED_KEY_PATTERN.test(key)) return;
    copy[key] = key === 'stack' && typeof value[key] === 'string' ? value[key] : redact(value[key]);
  });
  return copy;
}

// ASCII-only JSON so that json.length equals the byte count.
function stringifyAscii(doc) {
  return JSON.stringify(doc).replace(/[^\x00-\x7e]/g, (char) => '\\u' + pad(char.charCodeAt(0).toString(16), 4));
}

// Oldest log entries go first, then stacks, then error records beyond the newest 20 (Part 10.10.2 rule 5).
function fitToCap(doc) {
  let json = stringifyAscii(doc);
  if (json.length <= DIAGNOSTICS_CAP) return { json, bytes: json.length, truncated: false };
  doc.truncated = true;
  while (json.length > DIAGNOSTICS_CAP && doc.log.length > 0) {
    doc.log.splice(0, Math.ceil(doc.log.length * DIAGNOSTICS_DROP_FRACTION));
    json = stringifyAscii(doc);
  }
  if (json.length > DIAGNOSTICS_CAP) {
    doc.errors.forEach((record) => { record.stack = ''; });
    json = stringifyAscii(doc);
  }
  if (json.length > DIAGNOSTICS_CAP) {
    doc.errors = doc.errors.slice(-DIAGNOSTICS_KEPT_ERRORS);
    json = stringifyAscii(doc);
  }
  if (json.length > DIAGNOSTICS_CAP) {
    doc.providers = { error: 'dropped: over the size cap' };
    json = stringifyAscii(doc);
  }
  return { json, bytes: json.length, truncated: true };
}

function exportDiagnostics(options) {
  const includeContent = Boolean(options && options.includeContent === true);
  const doc = {
    format: 'flm-diagnostics',
    version: 1,
    app: { version: VERSION, build: BUILD },
    exportedAt: new Date().toISOString(),
    caps: Caps.get(),
    providers: collectProviders(),
    faults: listFaults().map((fault) => ({ fault: fault.name, args: fault.args, hits: fault.hits })),
    errors: recentErrors.slice(),
    log: logEntries(),
    truncated: false
  };
  const plain = JSON.parse(JSON.stringify(doc));
  return fitToCap(includeContent ? plain : redact(plain));
}

const Diagnostics = Object.freeze({
  provide(key, fn) {
    assert(typeof key === 'string' && typeof fn === 'function', 'Diagnostics.provide needs a key and a function');
    diagnosticProviders.set(key, fn);
  },
  export: exportDiagnostics
});

// ---------------------------------------------------------------------------------------------
// Module registry
// ---------------------------------------------------------------------------------------------
const registry = new Map();   // name -> {name, order}; order counts up from 1

function define(name, factory) {
  assert(typeof name === 'string' && name !== '' && typeof factory === 'function', 'define needs a name and a factory');
  if (registry.has(name) || hasOwn(FLM, name)) throw codedError('E-GEN-001', 'module ' + name);
  try {
    const namespace = factory(FLM);
    assert(namespace && typeof namespace === 'object', 'module ' + name + ' must return an object');
    FLM[name] = namespace;
    registry.set(name, { name, order: registry.size + 1 });
    return namespace;
  } catch (error) {
    // Part 4.3 A2: a throwing factory is recorded, FLM[name] stays undefined and loading goes on.
    report('E-GEN-001', error, { module: name, phase: 'define' });
    return undefined;
  }
}

function modules() {
  return Array.from(registry.values(), (record) => ({ name: record.name, order: record.order }));
}

// A module that outgrew one file (Part 3.1: NNx-name-part.js) keeps one namespace: the parts register a factory under
// the module name, and the module asks for a part the first time it needs it (after boot, so every file has loaded).
const partFactories = new Map();   // module name -> Map(part name -> factory)
const partResults = new Map();     // module name -> Map(part name -> what the factory returned)

function part(moduleName, partName, factory) {
  assert(typeof moduleName === 'string' && typeof partName === 'string' && typeof factory === 'function',
    'part needs a module name, a part name and a factory');
  if (!partFactories.has(moduleName)) partFactories.set(moduleName, new Map());
  const table = partFactories.get(moduleName);
  if (table.has(partName)) throw codedError('E-GEN-001', 'part ' + moduleName + '.' + partName);
  table.set(partName, factory);
}

/** The result of factory(FLM, kit) of a part, made once. @throws E-GEN-001 when the part was never registered. */
function usePart(moduleName, partName, kit) {
  if (!partResults.has(moduleName)) partResults.set(moduleName, new Map());
  const results = partResults.get(moduleName);
  if (results.has(partName)) return results.get(partName);
  const table = partFactories.get(moduleName);
  if (!table || !table.has(partName)) throw codedError('E-GEN-001', 'missing part ' + moduleName + '.' + partName);
  const made = table.get(partName)(FLM, kit);
  results.set(partName, made);
  return made;
}

// Tests only: empties the registry and returns restore(), which puts every module back.
function resetRegistryForTests() {
  const saved = Array.from(registry.values(), (record) => ({ record, namespace: FLM[record.name] }));
  const savedFactories = new Map(partFactories);        // the parts of a module belong to the registry: a test with an empty
  const savedResults = new Map(partResults);            // registry gets none, and gets every one of them back
  registry.clear();
  partFactories.clear();
  partResults.clear();
  saved.forEach((item) => { if (item.record.name !== 'Core') delete FLM[item.record.name]; });
  return function restore() {
    Array.from(registry.keys()).forEach((name) => { if (name !== 'Core') delete FLM[name]; });
    registry.clear();
    saved.forEach((item) => {
      registry.set(item.record.name, item.record);
      FLM[item.record.name] = item.namespace;
    });
    partFactories.clear();
    partResults.clear();
    savedFactories.forEach((table, name) => partFactories.set(name, table));
    savedResults.forEach((table, name) => partResults.set(name, table));
  };
}

// ---------------------------------------------------------------------------------------------
// Data blocks: Part 10.6 code table and Part 7.11 texts
// ---------------------------------------------------------------------------------------------
// code -> [class, user text]; class R recoverable, M returnToMenu, X reload; '' means no user text (log only).
// E-NET-015 is returnToMenu for a guest only; M-24 escalates it, the table keeps recoverable (Part 6.1.4.5 rule).
const CODE_TABLE = Object.freeze({
  'E-CAP-001': ['X', 'This browser has no Web Audio support, so nothing could play. Use a current ' +
      'version of Chrome, Edge, Firefox or Safari.'],
  'E-CAP-002': ['X', 'This browser cannot draw graphics. Use a current version of Chrome, Edge, ' +
      'Firefox or Safari.'],
  'E-CAP-003': ['X', 'This browser is missing animation support. Use a current version of Chrome, ' +
      'Edge, Firefox or Safari.'],
  'E-CAP-004': ['X', 'This browser is too old to run Finger Lickin Music.'],
  'E-CAP-005': ['R', 'Multiplayer needs WebRTC, which this browser does not provide.'],
  'E-CAP-006': ['R', 'This device reports fewer than 4 simultaneous touches; chords may need fewer ' +
      'fingers.'],
  'E-AUD-001': ['X', 'Audio could not start in this browser. Reload the page; if this keeps happening, ' +
      'try another browser.'],
  'E-AUD-002': ['R', 'Sound is blocked by the browser until you tap or press a key. Tap Try again.'],
  'E-AUD-003': ['R', ''],
  'E-AUD-004': ['R', 'Audio was reset after an error. Playback continues.'],
  'E-AUD-005': ['R', ''],
  'E-AUD-006': ['R', ''],
  'E-AUD-007': ['R', 'Sound was paused by the browser. Tap Resume to continue.'],
  'E-AUD-008': ['M', 'The audio device stopped responding. Your work is safe in memory. Reload the ' +
      'page to restore sound.'],
  'E-AUD-009': ['R', ''],
  'E-AUD-010': ['R', 'Sound must be enabled before recording. Tap or press a key, then press Record ' +
      'again.'],
  'E-AUD-011': ['R', 'Audio output changed. If timing feels off, run calibration again.'],
  'E-REN-001': ['R', '3D stage unavailable in this browser; using the flat visualizer.'],
  'E-REN-002': ['R', 'Graphics were simplified to {tier} after a graphics error.'],
  'E-REN-003': ['R', 'Graphics paused. Music and scoring continue.'],
  'E-REN-004': ['R', 'Graphics could not be restored; using the flat visualizer.'],
  'E-REN-005': ['R', 'Reduced visual quality to keep audio stable.'],
  'E-REN-006': ['R', 'Reduced visual quality to keep audio stable.'],
  'E-REN-007': ['R', 'Playback may stutter on this device. Closing other tabs and apps can help.'],
  'E-REN-008': ['R', 'The stage stopped drawing because of an internal error. Your work is safe.'],
  'E-REN-009': ['R', ''],
  'E-REN-010': ['R', ''],
  'E-REN-011': ['R', '3D stage could not be built; showing the simplified view.'],
  'E-IMP-001': ['R', 'Files larger than 25 MB (100 MB for audio) cannot be imported.'],
  'E-IMP-002': ['R', 'This file type is not recognized. Supported: MIDI (.mid), MusicXML (.xml, ' +
      '.musicxml, .mxl), Guitar Pro 3-5 (.gp3, .gp4, .gp5) and audio files.'],
  'E-IMP-003': ['R', 'The file is damaged or not in the expected layout. {detail}'],
  'E-IMP-004': ['R', 'The file exceeds an import limit: {detail}'],
  'E-IMP-005': ['R', 'Importing took longer than 5 seconds and was stopped. Try a smaller file or a ' +
      'faster device.'],
  'E-IMP-006': ['R', '{detail}'],
  'E-IMP-007': ['R', 'The compressed MusicXML archive contains no score.'],
  'E-IMP-008': ['R', 'Your browser cannot decode this audio file. WAV files work in every supported ' +
      'browser.'],
  'E-IMP-009': ['R', 'The file cannot be read. Check that it still exists and try again.'],
  'E-IMP-010': ['M', 'A playable chart could not be made from this track. Choose another track or ' +
      'difficulty.'],
  'E-IMP-011': ['R', 'Import cancelled.'],
  'E-IMP-012': ['R', 'This dance chart file needs a newer version of Finger Lickin Music.'],
  'E-IMP-013': ['R', 'This character file needs a newer version of Finger Lickin Music.'],
  'E-IMP-014': ['R', 'This XML declares custom entities, which are not allowed for safety. Re-export ' +
      'the file without a DOCTYPE.'],
  'E-IMP-015': ['R', 'The XML is not well-formed: {detail}'],
  'E-IMP-016': ['R', 'An import is already running.'],
  'E-IMP-017': ['R', 'This dance chart file is invalid: {detail}'],
  'E-IMP-018': ['R', 'This file is not a valid {kind} file: {detail}'],
  'E-IMP-019': ['R', 'The browser blocked access to the file. Try dragging the file onto this window, ' +
      'or use the file picker button.'],
  'E-STO-001': ['R', 'Save failed: there is not enough browser storage for this project. Export it to ' +
      'a file to keep your work, or delete old projects.'],
  'E-STO-002': ['R', 'Save failed: the browser database is not available right now. Export the project ' +
      'to a file to keep your work.'],
  'E-STO-003': ['R', 'The saved copy of this project is damaged. A backup from the previous save may ' +
      'be available.'],
  'E-STO-004': ['R', 'Save failed: the saved copy could not be verified, so the previous version was ' +
      'kept. Try again or export the project.'],
  'E-STO-005': ['R', 'Settings and projects cannot be saved in this browser mode. Use Export to keep ' +
      'your work.'],
  'E-STO-006': ['R', 'Another tab has this project open. Studio opens read-only.'],
  'E-STO-007': ['R', 'A newer copy of this project was saved in another tab. Save this version as a ' +
      'copy, or reload the newer one.'],
  'E-STO-008': ['R', 'Settings were reset because the saved settings could not be read.'],
  'E-STO-009': ['R', 'Large projects cannot be stored in this browser mode; projects are limited to 2 ' +
      'MB. Use Export for backups.'],
  'E-PRJ-001': ['R', 'This project file is not valid JSON and cannot be opened.'],
  'E-PRJ-002': ['R', 'This project was saved by a newer version of Finger Lickin Music (format version ' +
      '{v}; this build reads up to version 1). Open it with the newer version or export ' +
      'it from there as MIDI.'],
  'E-PRJ-003': ['R', 'This file is not a Finger Lickin Music project (expected format \'flm-project\', ' +
      'found \'{format}\').'],
  'E-PRJ-004': ['R', 'The project is missing required data at {pointer} and cannot be opened.'],
  'E-PRJ-005': ['R', 'The project contains an invalid value at {pointer} and cannot be opened.'],
  'E-PRJ-006': ['R', 'The project contains duplicate identifiers ({pointer}) and cannot be opened.'],
  'E-PRJ-007': ['R', 'The project refers to data that does not exist ({pointer}).'],
  'E-PRJ-008': ['R', 'The project\'s musical events are out of order and could not be repaired.'],
  'E-PRJ-009': ['R', 'The project exceeds the supported size: {detail} (limits: 32 tracks, 1,000,000 ' +
      'events).'],
  'E-PRJ-010': ['R', 'The project file is too large or too deeply nested to open safely.'],
  'E-PRJ-011': ['R', 'The project\'s tempo or meter data is invalid and could not be repaired.'],
  'E-PRJ-012': ['R', 'The project could not be upgraded from format version {from} to version 1: ' +
      '{detail}.'],
  'E-PRJ-013': ['R', 'This project uses an audio file that is not stored on this device ({name}). That ' +
      'track stays silent until you import the audio again.'],
  'E-PRJ-014': ['R', 'An unsaved project from your last session was recovered. Open it or discard it?'],
  'E-PRJ-020': ['R', 'Track limit reached (32). Delete a track to add another.'],
  'E-PRJ-021': ['R', 'That item no longer exists.'],
  'E-PRJ-022': ['R', 'That instrument is not available.'],
  'E-PRJ-023': ['R', 'Track event limit reached (100,000).'],
  'E-PRJ-024': ['R', 'That note is outside the playable range.'],
  'E-PRJ-025': ['R', 'That quantize grid is not available.'],
  'E-PRJ-026': ['R', 'Tempo must be between 20 and 300 BPM.'],
  'E-PRJ-027': ['R', 'That time signature is not supported.'],
  'E-PRJ-028': ['R', 'That key or scale is not available.'],
  'E-PRJ-029': ['R', 'That take was not completed and cannot be used.'],
  'E-PRJ-030': ['R', 'That edit could not be applied.'],
  'E-PRJ-031': ['R', ''],
  'E-NET-001': ['R', 'This is not a valid {expected} code. Copy the whole code and paste it again.'],
  'E-NET-002': ['R', 'Could not connect to the other player. Without the STUN option, players usually ' +
      'need to be on the same network.'],
  'E-NET-003': ['R', 'The other player uses an incompatible multiplayer version. Both players need the ' +
      'same version of the game.'],
  'E-NET-004': ['R', 'The other player has a different version of Finger Lickin Music ({version}). ' +
      'Both players need the same version.'],
  'E-NET-005': ['R', 'Your chart differs from the host\'s. The host\'s chart settings were applied; ' +
      'press Ready again.'],
  'E-NET-006': ['R', 'Multiplayer uses standard timing windows. Your timing preset was set to Standard ' +
      'for this session.'],
  'E-NET-007': ['R', 'You do not have this song. Ask the host to choose a built-in song or one you ' +
      'both imported.'],
  'E-NET-008': ['R', ''],
  'E-NET-009': ['M', 'The host has left. The session has ended; here are the results so far.'],
  'E-NET-010': ['R', 'Disconnected {name} because their game sent invalid data.'],
  'E-NET-011': ['R', 'Disconnected {name} because their game sent too many messages.'],
  'E-NET-012': ['R', 'Could not reach the relay server at {relayUrl}. You can still play by exchanging ' +
      'invite codes directly.'],
  'E-NET-013': ['R', 'No room with this code exists. Check the code and try again.'],
  'E-NET-014': ['R', 'This room is full (4 players).'],
  'E-NET-015': ['R', 'Could not reconnect within 60 seconds. You have left the session.'],
  'E-NET-016': ['R', '{name} disconnected. They have 60 seconds to reconnect.'],
  'E-NET-017': ['M', 'The relay closed this room ({reason}). Local results were kept.'],
  'E-NET-018': ['R', 'Connection is unstable; timing between players may be less accurate.'],
  'E-NET-019': ['R', 'A song is in progress. You will join the room when it ends.'],
  'E-NET-020': ['R', 'The host did not admit you to the room.'],
  'E-NET-021': ['R', 'This invite has expired or was already used. Ask the host for a new invite.'],
  'E-NET-022': ['R', 'This player is already in the room.'],
  'E-NET-023': ['R', ''],
  'E-NET-024': ['R', 'That is not possible right now: {detail}.'],
  'E-INP-001': ['R', 'MIDI devices are not available here. Web MIDI needs a supporting browser and a ' +
      'secure page (https:// or localhost). Keyboard, touch and gamepad controls are ' +
      'unaffected.'],
  'E-INP-002': ['R', 'MIDI access was denied.'],
  'E-INP-003': ['R', 'Controller disconnected. Reconnect it or use another input, then resume.'],
  'E-INP-004': ['R', '{key} is already used for {action}. Swap the two?'],
  'E-INP-005': ['R', '{key} cannot be used because the browser or system reserves it.'],
  'E-INP-006': ['R', 'MIDI device {name} disconnected.'],
  'E-INP-010': ['R', '(none; surfaced as E-IMP-010 or the SCR-ImportInspect row text "Chart could not ' +
      'be generated for this track")'],
  'E-INP-011': ['R', 'Track too dense to chart (more than 50,000 notes). Choose another track or a ' +
      'lower difficulty.'],
  'E-INP-012': ['R', 'Chart data is invalid; regenerating.'],
  'E-EXP-001': ['R', 'There are no MIDI tracks to export.'],
  'E-EXP-002': ['R', 'A MIDI delta time exceeds the maximum encodable value.'],
  'E-EXP-003': ['R', 'The mix is longer than the {cap} supported for WAV export on this device. Export ' +
      'a shorter loop region.'],
  'E-EXP-004': ['R', 'WAV export is not available in this browser.'],
  'E-EXP-005': ['R', 'The browser blocked the download. Allow downloads for this page, or use Copy to ' +
      'clipboard.'],
  'E-EXP-006': ['R', 'Export too large for this browser.'],
  'E-EXP-007': ['R', 'The audio mix could not be rendered. Try a shorter section.'],
  'E-EXP-008': ['R', 'Audio capture stopped unexpectedly. The part recorded so far was discarded.'],
  'E-EXP-009': ['R', 'This browser cannot download files larger than 32 MB from a local page. Try a ' +
      'desktop browser.'],
  'E-GEN-000': ['R', 'Something went wrong ({original}).'],
  'E-GEN-001': ['R', 'Something went wrong. Your work is safe.'],
  'E-GEN-002': ['R', 'Something went wrong. Your work is safe.'],
  'E-GEN-003': ['M', 'The game hit repeated errors and returned to the menu. Your work is safe in ' +
      'memory.'],
  'E-GEN-004': ['R', ''],
  'E-GEN-005': ['R', ''],
  'E-GEN-006': ['R', ''],
  'E-MODE-001': ['R', ''],
  'E-MODE-002': ['M', '{mode} could not start: {message}'],
  'E-MODE-003': ['R', ''],
  'E-MDL-001': ['R', ''],
  'E-MDL-002': ['R', ''],
  'E-MDL-003': ['R', ''],
  'E-MDL-004': ['R', ''],
  'E-MDL-005': ['R', ''],
  'E-MDL-006': ['R', ''],
  'E-MDL-007': ['R', ''],
  'E-MDL-008': ['R', ''],
  'E-MDL-009': ['R', ''],
  'E-MDL-010': ['R', ''],
  'E-MDL-011': ['R', ''],
  'E-TRN-001': ['R', 'Loop region is too short.'],
  'E-CHR-001': ['R', 'This is not a valid character file.'],
  'E-CHR-002': ['R', ''],
  'E-CHR-003': ['R', ''],
  'E-CHR-010': ['R', ''],
  'E-CHR-011': ['R', ''],
  'E-CHR-012': ['R', ''],
  'E-CHR-013': ['R', ''],
  'E-CHR-014': ['R', ''],
  'E-CHR-015': ['R', ''],
  'E-CHR-016': ['R', ''],
  'E-CHR-017': ['R', ''],
  'E-CHR-018': ['R', ''],
  'E-CHR-019': ['R', ''],
  'E-CHR-020': ['R', 'A project can have at most 5 characters.'],
  'E-CNT-001': ['R', ''],
  'E-CNT-002': ['R', ''],
  'E-CNT-003': ['R', ''],
  'E-CNT-004': ['R', ''],
  'E-CNT-005': ['R', '']
});

// Variants of a code text, selected by the caller through Text.get('<code>:<variant>').
const TEXT_VARIANTS = Object.freeze({
  'E-IMP-005:audio': 'Decoding the audio took longer than 60 seconds and was stopped. Try a shorter ' +
      'file.',
  'E-IMP-006:gp67': 'This is a Guitar Pro 6 or 7 file (.gpx or .gp). Only Guitar Pro 3, 4 and 5 files ' +
      '(.gp3, .gp4, .gp5) can be imported. Export the file as GP5 or as MIDI from ' +
      'Guitar Pro and import that.',
  'E-GEN-001:boot': 'A part of the game failed to load: {name}. Reload the page.',
  'E-CHR-001:large': 'This character file is too large.'
});

// Strings of the fatal screen and the report fallback (Part 6.1.4.5). Later phases add more catalog entries.
const TEXT_EXTRA = Object.freeze({
  'fatal.title': 'Finger Lickin Music stopped',
  'fatal.body': 'Your saved projects are not affected. You can copy a diagnostics report to help fix this.',
  'fatal.copy': 'Copy diagnostics',
  'fatal.reload': 'Reload',
  'fatal.code': 'Code: {code}',
  'fatal.fallback': 'Something went wrong ({code}).',
  // Deferred-feature disclosures (Part 1.5, T03.11). S-INP-09 is new wording awaiting a Part 7.11 patch.
  'S-INP-09': 'One-switch play is not available in this version. Every control can be remapped and touch pads can be ' +
      'enlarged.',
  'S-NET-02': 'Two players on one keyboard is not available in this version. Each player uses their own device and ' +
      'connects by invite code.',
  // Sound fidelity (Part 1.5, T04.07): the only sentences that may name sampled sounds or a SoundFont.
  'S-AUD-01': 'All instruments are synthesized in real time. Loading SoundFont (.sf2) sound banks is not supported in ' +
      'this version.',
  'S-AUD-02': 'Instrument sounds are synthesized by this file; no sampled sound bank is included, so timbres ' +
      'approximate General MIDI instruments rather than reproduce recordings.',
  'S-AUD-03': 'Instruments are synthesized; timbres approximate General MIDI programs.',
  'S-AUD-04': 'Sound bank: synthesized, no sound bank',
  'S-AUD-05': 'Sound coverage: all 128 General MIDI programs and the percussion keys 35 to 81 are played by ' +
      'synthesized sounds; other percussion keys play a quiet shaker.'
});

const TEXT_TABLE = buildTextTable();

const CLASS_TABLE = Object.freeze(Object.keys(CODE_TABLE).reduce(function (table, code) {
  table[code] = CLASS_NAMES[CODE_TABLE[code][0]];
  return table;
}, {}));

// ---------------------------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------------------------
const Core = Object.freeze({
  VERSION,
  BUILD,
  RELAY_URL,
  LICENSE_NOTICE,
  define,
  part,
  usePart,
  modules,
  Emitter,
  bus,
  timers,
  raf,
  dom,
  Text,
  Faults,
  Log,
  Caps,
  ErrorReporter,
  Diagnostics,
  clamp,
  lerp,
  smoothstep,
  uid,
  deepClone,
  assert,
  formatTime,
  fnv1a32,
  fnv1a32Hex,
  Prng,
  now,
  urlParams,
  _resetRegistryForTests: resetRegistryForTests
});

FLM.Core = Core;
registry.set('Core', { name: 'Core', order: 1 });
bus.on('boot.ready', () => { bootReady = true; });
ErrorReporter.install();
})();
