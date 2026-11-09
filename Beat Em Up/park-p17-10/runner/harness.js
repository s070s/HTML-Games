// usage: node harness.js [game.js]   env: BREAKPOINT_DIR (folder holding breakpoint-tests.js; default the Beat Em Up folder),
//        BP_BOOT=1 (also run the game's startup steps before the tests), BP_ONLY=<substring> (print details of matching tests)
// Loads the extracted game script into a stubbed browser (DOM, WebGL, window, localStorage), loads the self-test file the way
// the game does (script element with src evaluated in the same context, onload / onerror) and runs every self-test.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TESTS_DIR = process.env.BREAKPOINT_DIR || 'C:\\Users\\GS\\Desktop\\Dev\\HTML Games\\Beat Em Up';
const gamePath = process.argv[2] || path.join(__dirname, 'game.js');

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

// Script elements: appending one with a src evaluates that file (from TESTS_DIR) in the game's context, then calls onload.
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
  const file = path.join(TESTS_DIR, el.src);
  setImmediate(() => {
    let text;
    try { text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''); if (process.env.BP_FILTER) text = text.replace('const test = (name, fn) => {', 'const test = (name, fn) => { if (!new RegExp(' + JSON.stringify(process.env.BP_FILTER) + ').test(name)) return;'); } catch (error) { if (el.onerror) el.onerror(error); return; }
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

async function main() {
  const code = fs.readFileSync(gamePath, 'utf8');
  vm.runInContext(code, context, { filename: gamePath });
  if (typeof sandbox.__ev !== 'function') throw new Error('game script did not install __ev');
  const ev = sandbox.__ev;
  ev("Store.init(); Settings.init(); Keymap.init(); Keymap2.init(); Progress.init(); CustomRoster.init(); Debris.init(); FX.init(); Inputs.init(); Effects.init();");
  const tests = await ev('loadSelfTests()');
  if (process.env.BP_EVAL) { try { console.log(await ev(process.env.BP_EVAL)); } catch (error) { console.log(error.stack); } process.exit(0); }   // debugging: evaluate an expression inside the game closure
  const started = Date.now();
  const listenersBefore = ev('Events.count()');
  const results = ev('selfTests').run_all();
  console.log('listeners before/after: ' + listenersBefore + ' / ' + ev('Events.count()'));
  const failing = results.filter((r) => !r.pass);
  console.log('PASS ' + (results.length - failing.length) + ' / ' + results.length + '  (' + (Date.now() - started) + ' ms)');
  failing.forEach((r) => console.log('FAIL ' + r.name + (r.detail ? '  -> ' + String(r.detail).slice(0, 160) : '')));
  if (process.env.BP_ONLY) results.filter((r) => r.name.includes(process.env.BP_ONLY)).forEach((r) => console.log((r.pass ? 'ok   ' : 'FAIL ') + r.name + ' ' + r.detail));
  void tests;
  process.exit(0);
}
main().catch((error) => { console.error('harness error:', error && error.stack ? error.stack : error); process.exit(2); });
