/* Headless runner for the Breakpoint self-tests (no browser): loads the game script of breakpoint.html into a stubbed browser
   (DOM, WebGL, window, localStorage), loads breakpoint-tests.js the way the game does and runs the tests.
   usage (paths relative to the Beat Em Up folder; the runner finds the game next to its own folder):
     node tools/run-tests.js                               every test (about 11 minutes)
     node tools/run-tests.js --only "Hazards|P18-13"       tests whose name holds one of the parts (plain text, any case)
     node tools/run-tests.js --affected [base]             the tests the changes since base touch (default: where HEAD left main)
     node tools/run-tests.js --affected --also "Levels"    the same plus more name parts
     node tools/run-tests.js --list --affected             print the picked names only, run nothing
     node tools/run-tests.js --eval "<expression>"         debugging: evaluate an expression inside the game closure and stop
   Exit code: 0 when every failure is a known headless limit (no main menu, no real canvas), 1 on any other failure, 2 on a runner error.
   The gate before a merge is the full run in Chrome (BREAKPOINT.selfTest() on the preview server); fingerprint hashes are recorded
   there only. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pickAffected } = require('./affected-tests.js');

const GAME_DIR = process.env.BREAKPOINT_DIR || path.join(__dirname, '..');   // the Beat Em Up folder; BREAKPOINT_DIR points at another copy (a worktree)
const HTML_FILE = path.join(GAME_DIR, 'breakpoint.html');
// Failures that happen only because the stub has no main menu screen or no real canvas: they pass in Chrome
const HEADLESS_LIMITS = /needs the main menu|blank faces/;
const SLOWEST_SHOWN = 5;

function readArgs(argv) {
  const args = { only: '', also: '', affected: false, base: '', list: false, evalText: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    const hasValue = next !== undefined && !next.startsWith('--');
    const needsValue = ['--only', '--also', '--eval'].includes(arg);
    if (needsValue && !hasValue) throw new Error(arg + ' needs a value');
    if (arg === '--only') { args.only = next; i++; }
    else if (arg === '--also') { args.also = next; i++; }
    else if (arg === '--eval') { args.evalText = next; i++; }
    else if (arg === '--list') args.list = true;
    else if (arg === '--affected') { args.affected = true; if (hasValue) { args.base = next; i++; } }
    else throw new Error('unknown option ' + arg + ' (see the usage at the top of tools/run-tests.js)');
  }
  if (args.affected && args.only) throw new Error('--affected and --only do not go together (use --also to add name parts)');
  return args;
}

// The inline game script with its boot(); line replaced by a hook that evaluates text inside the game closure
function gameScript() {
  const html = fs.readFileSync(HTML_FILE, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const start = html.indexOf('<script>');
  const end = html.lastIndexOf('</script>');
  if (start < 0 || end < 0) throw new Error('no inline script found in ' + HTML_FILE);
  const script = html.slice(start + '<script>'.length, end);
  const bootLine = /^boot\(\);$/m;
  if (!bootLine.test(script)) throw new Error('boot(); line not found in ' + HTML_FILE);
  return script.replace(bootLine, 'globalThis.__ev = (s) => eval(s);');
}

/* ---------- stubs ---------- */
const noop = () => {};
// a WebGL / 2D context: every method is a no-op returning a harmless object, constants read as numbers
function makeContext() {
  const target = { canvas: null, drawingBufferWidth: 800, drawingBufferHeight: 450 };
  return new Proxy(target, {
    get(t, key) {
      if (key in t) return t[key];
      if (typeof key === 'symbol') return undefined;
      if (/^[A-Z0-9_]+$/.test(key)) return 1;
      if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
      if (key === 'getParameter') return () => 0;
      if (key === 'getExtension') return () => null;
      if (key === 'getShaderPrecisionFormat') return () => ({ rangeMin: 127, rangeMax: 127, precision: 23 });
      if (key === 'getSupportedExtensions') return () => [];
      if (key === 'measureText') return () => ({ width: 10 });
      if (key === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (key === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      return () => ({});
    },
    set(t, key, value) { t[key] = value; return true; },
  });
}

const listenersOf = (el) => el._listeners || (el._listeners = {});
class FakeElement {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.style = { setProperty: noop, removeProperty: noop };
    this.dataset = {};
    this.children = [];
    this.childNodes = this.children;
    this.parentElement = null;
    this.parentNode = null;
    this.attributes = {};
    this.className = '';
    this.id = '';
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.checked = false;
    this.textContent = '';
    this._html = '';
    this.width = 300; this.height = 150;
    this.clientWidth = 800; this.clientHeight = 450;
    this.offsetWidth = 800; this.offsetHeight = 450;
    this.scrollTop = 0; this.scrollLeft = 0;
    const el = this;
    this.classList = {
      add(...names) { const set = new Set(el.className.split(/\s+/).filter(Boolean)); names.forEach((n) => set.add(n)); el.className = [...set].join(' '); },
      remove(...names) { const set = new Set(el.className.split(/\s+/).filter(Boolean)); names.forEach((n) => set.delete(n)); el.className = [...set].join(' '); },
      contains(name) { return el.className.split(/\s+/).includes(name); },
      toggle(name, force) { const has = this.contains(name), want = force === undefined ? !has : !!force; if (want) this.add(name); else this.remove(name); return want; },
    };
  }
  get innerHTML() { return this._html; }
  set innerHTML(value) { this._html = String(value); this.children.length = 0; }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children[this.children.length - 1] || null; }
  get nextSibling() { return null; }
  appendChild(child) { if (child) { this.children.push(child); child.parentElement = child.parentNode = this; } return child; }
  append(...kids) { kids.forEach((k) => this.appendChild(k)); }
  prepend(child) { this.appendChild(child); }
  insertBefore(child) { return this.appendChild(child); }
  removeChild(child) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); return child; }
  remove() { if (this.parentElement) this.parentElement.removeChild(this); }
  replaceChildren() { this.children.length = 0; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'id') this.id = String(value); }
  getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; }
  removeAttribute(name) { delete this.attributes[name]; }
  hasAttribute(name) { return name in this.attributes; }
  addEventListener(type, fn) { (listenersOf(this)[type] || (listenersOf(this)[type] = [])).push(fn); }
  removeEventListener(type, fn) { const list = listenersOf(this)[type]; if (list) { const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); } }
  dispatchEvent(event) { (listenersOf(this)[event.type] || []).slice().forEach((fn) => fn(event)); return true; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  contains(other) { return other === this || this.children.some((c) => c.contains && c.contains(other)); }
  getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 450, width: 800, height: 450 }; }
  getContext() { const c = makeContext(); c.canvas = this; return c; }
  focus() { document.activeElement = this; }
  blur() { if (document.activeElement === this) document.activeElement = document.body; }
  click() { this.dispatchEvent({ type: 'click', target: this, preventDefault: noop, stopPropagation: noop }); }
  scrollIntoView() {}
  setPointerCapture() {}
  releasePointerCapture() {}
  requestFullscreen() { return Promise.resolve(); }
  toDataURL() { return 'data:image/png;base64,'; }
}

const byId = new Map();
const document = {
  hidden: false, activeElement: null, fullscreenElement: null, fullscreenEnabled: true,
  _listeners: {},
  createElement(tag) {
    if (String(tag).toLowerCase() === 'script') return makeScriptElement();
    return new FakeElement(tag);
  },
  getElementById(id) { if (!byId.has(id)) { const el = new FakeElement('div'); el.id = id; byId.set(id, el); } return byId.get(id); },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener(type, fn) { (document._listeners[type] || (document._listeners[type] = [])).push(fn); },
  removeEventListener(type, fn) { const list = document._listeners[type]; if (list) { const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); } },
  dispatchEvent(event) { (document._listeners[event.type] || []).slice().forEach((fn) => fn(event)); return true; },
  exitFullscreen() { document.fullscreenElement = null; return Promise.resolve(); },
};
document.documentElement = new FakeElement('html');
document.body = new FakeElement('body');
document.head = new FakeElement('head');
document.activeElement = document.body;
document.documentElement.requestFullscreen = function requestFullscreen() { document.fullscreenElement = document.documentElement; return Promise.resolve(); };

// Script elements: appending one with a src evaluates that file (from the game folder) in the game's context, then calls onload.
let context = null;
function makeScriptElement() {
  const el = new FakeElement('script');
  el.src = '';
  el.onload = null;
  el.onerror = null;
  return el;
}
const originalHeadAppend = document.head.appendChild.bind(document.head);
document.head.appendChild = function appendChild(el) {
  if (!el || el.tagName !== 'SCRIPT' || !el.src) return originalHeadAppend(el);
  originalHeadAppend(el);
  const file = path.join(GAME_DIR, el.src);
  setImmediate(() => {
    let text;
    try { text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''); } catch (error) { if (el.onerror) el.onerror(error); return; }
    try { vm.runInContext(text, context, { filename: file }); } catch (error) { console.error('self-test file threw:', error); if (el.onerror) el.onerror(error); return; }
    if (el.onload) el.onload();
  });
  return el;
};

function makeStorage(initial) {
  const data = new Map(Object.entries(initial || {}));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] || null,
    get length() { return data.size; },
  };
}

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, queueMicrotask, performance,
  Promise, Map, Set, WeakMap, WeakSet, Symbol, JSON, Math, Date, Number, String, Object, Array, Error, TypeError, RangeError, Reflect, Proxy,
  Float32Array, Float64Array, Int32Array, Uint32Array, Uint8Array, Uint8ClampedArray, Uint16Array, Int16Array, Int8Array, ArrayBuffer, DataView,
  TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa, encodeURIComponent, decodeURIComponent, isFinite, isNaN, parseFloat, parseInt,
  document, localStorage: makeStorage(),
  navigator: { userAgent: 'node-harness', maxTouchPoints: 0, getGamepads: () => [], clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') } },
  screen: { orientation: { addEventListener: noop, type: 'landscape-primary' }, width: 800, height: 450 },
  location: { search: '', hash: '', href: 'file:///breakpoint.html' },
  history: { replaceState: noop, pushState: noop },
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  requestAnimationFrame: (fn) => setTimeout(() => fn(performance.now()), 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
  Image: class { set src(v) { this._src = v; if (this.onload) setImmediate(() => this.onload()); } get src() { return this._src; } },
  Blob: class { constructor(parts) { this.parts = parts; } },
  AudioContext: undefined, webkitAudioContext: undefined,
  innerWidth: 800, innerHeight: 450, devicePixelRatio: 1, scrollX: 0, scrollY: 0, scrollTo: noop,
  visualViewport: null,
};
const windowListeners = {};
sandbox.addEventListener = (type, fn) => { (windowListeners[type] || (windowListeners[type] = [])).push(fn); };
sandbox.removeEventListener = (type, fn) => { const list = windowListeners[type]; if (list) { const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); } };
sandbox.dispatchEvent = (event) => { (windowListeners[event.type] || []).slice().forEach((fn) => fn(event)); return true; };
sandbox._windowListeners = windowListeners;
sandbox._document = document;
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

context = vm.createContext(sandbox);

/* ---------- run ---------- */
// The name filter for run_all: the --only parts, or the affected test names plus the --also parts; null runs every test
function chooseFilter(args) {
  const partsOf = (text) => text.split('|').map((part) => part.trim()).filter(Boolean);
  const extra = args.also ? partsOf(args.also) : [];
  if (args.affected) {
    const picked = pickAffected({ base: args.base });
    console.log(picked.summary);
    return picked.names.concat(extra);
  }
  if (args.only) return partsOf(args.only).concat(extra);
  return extra.length ? extra : null;
}

// Prints the counts, every failure that is not a known headless limit and the slowest tests; returns the count of those failures
function report(results, elapsedMs) {
  const failing = results.filter((r) => !r.pass);
  const limits = failing.filter((r) => HEADLESS_LIMITS.test(r.detail || ''));
  const real = failing.filter((r) => !HEADLESS_LIMITS.test(r.detail || ''));
  console.log('PASS ' + (results.length - failing.length) + ' / ' + results.length + ' in ' + Math.round(elapsedMs / 1000) + ' s; '
    + limits.length + ' known headless limits, ' + real.length + ' other failures');
  real.forEach((r) => console.log('FAIL ' + r.name + (r.detail ? '  -> ' + String(r.detail).slice(0, 300) : '')));
  const slowest = results.slice().sort((a, b) => (b.ms || 0) - (a.ms || 0)).slice(0, SLOWEST_SHOWN);
  console.log('slowest: ' + slowest.map((r) => (r.ms || 0) + ' ms ' + r.name.slice(0, 60)).join(' | '));
  return real.length;
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const filter = chooseFilter(args);
  if (args.list) { (filter || ['(every test)']).forEach((name) => console.log(name)); process.exit(0); }
  if (filter && !filter.length) { console.log('No test picked: nothing to run.'); process.exit(0); }
  vm.runInContext(gameScript(), context, { filename: HTML_FILE });
  if (typeof sandbox.__ev !== 'function') throw new Error('game script did not install __ev');
  const ev = sandbox.__ev;
  ev('Store.init(); Settings.init(); Keymap.init(); Keymap2.init(); Progress.init(); CustomRoster.init(); Debris.init(); FX.init(); Inputs.init(); Effects.init();');
  await ev('loadSelfTests()');
  if (args.evalText) { try { console.log(await ev(args.evalText)); } catch (error) { console.log(error.stack); } process.exit(0); }
  const started = Date.now();
  const listenersBefore = ev('Events.count()');
  const results = ev('selfTests').run_all(filter || undefined);
  if (results.settled) await results.settled;   // the async tests (WebRTC, P12-04 and P12-01) fill in their results after run_all returns
  console.log('listeners before/after: ' + listenersBefore + ' / ' + ev('Events.count()'));   // a test that leaks event listeners shows here
  if (filter && !results.length) { console.log('No test matched: ' + filter.join(' | ')); process.exit(1); }
  const otherFailures = report(results, Date.now() - started);
  process.exit(otherFailures ? 1 : 0);
}
main().catch((error) => { console.error('runner error:', error && error.stack ? error.stack : error); process.exit(2); });
