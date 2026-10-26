## 6. Subsystem designs

### 6.0 Preface

This part is the normative design of every source module M-01..M-31. Each module section
follows one fixed structure (6.N.1 responsibilities, 6.N.2 public API, 6.N.3 internal state,
6.N.4 algorithms, 6.N.5 error handling, 6.N.6 limits, 6.N.7 spec coverage, 6.N.8 unit tests,
6.N.9 implementation notes). Read a module section immediately before implementing that
module and implement the API block literally: function names, parameter order, return shapes
and event payloads are contracts that later modules and Part 12 tests rely on.

Every module is one IIFE in its own `src/NN-name.js` file, registered with
`FLM.Core.define('<Namespace>', factory)` exactly as shown in 3.11, with `'use strict'`,
2-space indent, ES2020 maximum (ADR-09). A module references only lower-numbered modules;
upward communication goes through the `FLM.Core.Emitter` event bus (4.2). Unit tests are
registered with `FLM.SelfTest.group('<group>', t => ...)` in `src/91-test-<group>.js` and are
excluded from the shipped build (ADR-11).

The algorithms written here are normative. Where pseudocode and prose differ, the pseudocode
wins. Numbers (limits, windows, durations, dB values) are binding and come from BRIEF section 6
or are decided here; do not retune them without a LEDGER entry. Nothing in this part is
implemented at plan version 1.0.0; every unit test listed is Unimplemented until the T section
that owns the module passes it.

### 6.1 M-01 Core (`src/01-core.js`, `FLM.Core`)

#### 6.1.1 Responsibilities and non-goals

Responsibilities: create the `FLM` root namespace and `FLM.VERSION`; module registration
(`define`); the `Emitter` event bus; tracked timers and animation frames (so M-28 can count
leaks); the `Log` ring buffer; `Caps` capability detection; `ErrorReporter` (classification,
`#fatal` screen); `Diagnostics.export()`; utilities (`clamp`, `lerp`, `smoothstep`, `uid`,
`deepClone`, `assert`, `formatTime`, `fnv1a32`, `Prng`).

Non-goals: no DOM other than `#fatal` (the fatal screen must work when every other module is
broken); no audio, no storage, no settings. Core never imports anything; it is loaded first.

#### 6.1.2 Public API

```js
// Root namespace created by this file. Nothing else is attached to window by any module.
window.FLM = { VERSION: '1.0.0', BUILD: '/*@@BUILD@@*/' /* stamped by tools/build.mjs */ };

FLM.Core = {
  VERSION: '1.0.0',

  /** Register a module namespace. factory(FLM) returns the namespace object.
   *  @throws Error code 'E-GEN-001' if name is already defined. */
  define(name /* string */, factory /* (FLM) => object */) /* -> object */,
  /** Ordered list of {name, order} in load order. */
  modules() /* -> Array<{name:string, order:number}> */,

  // ---- Event bus ----
  Emitter: class Emitter {
    constructor();
    /** @returns unsubscribe function. owner is any object used by offOwner(). */
    on(topic /* string */, fn /* (payload, topic) => void */, owner /* ?object */) /* -> () => void */;
    once(topic, fn, owner) /* -> () => void */;
    off(topic, fn) /* -> boolean removed */;
    offOwner(owner) /* -> number removed */;
    /** Calls every listener in subscription order; a throwing listener is reported
     *  (E-GEN-001) and the others still run. Returns listener count called. */
    emit(topic, payload /* any */) /* -> number */;
    listenerCount(topic /* ?string */) /* -> number (all topics when omitted) */;
    topics() /* -> string[] */;
    clear() /* -> void (tests only) */;
  },
  /** The single application-wide bus used for every EVT-* topic in 4.4. */
  bus: /* Emitter */,

  // ---- Tracked timers (all modules must use these, never window.setTimeout directly) ----
  Timers: {
    setTimeout(fn, ms, owner) /* -> id */, setInterval(fn, ms, owner) /* -> id */,
    clear(id) /* -> void */, clearOwner(owner) /* -> number */,
    requestFrame(fn, owner) /* -> id */, cancelFrame(id) /* -> void */,
    counts() /* -> {timeouts:number, intervals:number, frames:number} */
  },

  // ---- Logging ----
  Log: {
    debug(tag, msg, data), info(tag, msg, data), warn(tag, msg, data), error(tag, msg, data),
    /** Logs once per key for the lifetime of the page; returns true the first time. */
    once(key /* string */, level, tag, msg, data) /* -> boolean */,
    entries() /* -> Array<LogEntry> oldest first, max 500 */,
    clear(), setLevel(level /* 'debug'|'info'|'warn'|'error' */)
  },
  // LogEntry { t:number /* performance.now ms */, level, tag, msg, data /* JSON-safe or undefined */ }

  // ---- Capabilities (computed once at load; refresh() re-probes) ----
  Caps: {
    get() /* -> CapsReport (frozen) */, refresh() /* -> CapsReport */,
    isMobile() /* -> boolean */
  },

  // ---- Errors ----
  ErrorReporter: {
    /** Installs window.onerror and unhandledrejection handlers (idempotent). */
    install() /* -> void */,
    /** code: 'E-XXX-nnn' from 10.6; err: Error|any; context: JSON-safe object.
     *  Returns the ErrorRecord. Emits EVT-error. Shows #fatal when class is 'reload'. */
    report(code, err, context) /* -> ErrorRecord */,
    /** 'recoverable' | 'returnToMenu' | 'reload' */
    classify(code, err) /* -> string */,
    /** Registered by M-26 so toasts/dialogs are shown by UI; Core falls back to #fatal only. */
    setPresenter(fn /* (ErrorRecord) => void */) /* -> void */,
    recent() /* -> ErrorRecord[] (max 50) */,
    showFatal(record) /* -> void (renders #fatal with textContent only) */
  },
  // ErrorRecord { id, t, code, class, message, stack /* <= 2000 chars */, context, count }

  Diagnostics: {
    /** Registers a provider that contributes a JSON-safe object under key. */
    provide(key /* string */, fn /* () => object */) /* -> void */,
    /** Builds the export per 6.1.4.6. opts.includeContent default false. */
    export(opts /* ?{includeContent:boolean} */) /* -> {json:string, bytes:number, truncated:boolean} */
  },

  // ---- Utilities ----
  clamp(x, lo, hi), lerp(a, b, t), smoothstep(e0, e1, x),
  uid() /* -> string, 12-20 chars, [0-9a-z-] */,
  deepClone(v) /* structuredClone when present, else JSON round trip (plain data only) */,
  assert(cond, msg) /* throws Error code 'E-GEN-004' */,
  /** seconds -> 'm:ss' ; opts.ms -> 'm:ss.mmm' ; negative -> '-0:02' (count-in). */
  formatTime(seconds, opts /* ?{ms:boolean} */) /* -> string */,
  fnv1a32(str /* string */) /* -> number uint32 */,
  fnv1a32Hex(str) /* -> 8 hex chars */,
  Prng: class Prng {
    constructor(seed /* uint32 */);
    next() /* -> float in [0,1) */; int(n) /* -> integer in [0,n) */;
    range(lo, hi) /* -> float */; pick(arr) /* -> element */; shuffle(arr) /* -> arr in place */;
    fork() /* -> Prng seeded from next() */; get state() /* uint32 */; set state(v);
  },
  now() /* -> performance.now() */
};
```

Events emitted: `EVT-error` payload `ErrorRecord` (from `ErrorReporter.report`). Events
consumed: none.

#### 6.1.3 Internal state

- `registry: Map<string, {name, order}>` for `define`; `order` increments from 1.
- `Emitter`: `Map<topic, Array<{fn, owner, once}>>`. Emission iterates over a snapshot copy
  so listeners added or removed during emit take effect on the next emit. Invariant: no
  duplicate `{topic, fn}` pair (second `on` with the same fn returns the existing
  unsubscribe without adding).
- `Timers`: `Map<id, {kind, nativeId, owner}>`; ids are positive integers from one counter;
  `requestFrame` wraps `requestAnimationFrame` and removes the record when the callback runs.
- `Log`: fixed array of 500 slots, write index, count; `once` keys in a `Set` (max 1,000
  keys; when full, the oldest key is evicted).
- `Caps`: one frozen report object; `refresh()` replaces it.
- `ErrorReporter`: `recent` array (max 50, dedup by `code + message`, incrementing `count`),
  `presenter` function or null, `installed` flag, `fatalShown` flag.
- `Diagnostics`: `Map<key, provider>`.

#### 6.1.4 Algorithms

6.1.4.1 `define(name, factory)`
1. If `registry.has(name)` throw `Error('E-GEN-001: module ' + name)`.
2. `ns = factory(FLM)`; `assert(ns && typeof ns === 'object')`.
3. `FLM[name] = ns`; `registry.set(name, {name, order: registry.size + 1})`; return `ns`.

6.1.4.2 Emitter.emit(topic, payload)
1. `list = map.get(topic)`; if none return 0. `snapshot = list.slice()`.
2. For each entry: if `entry.once` remove it from `list` first; then `try { entry.fn(payload,
   topic) } catch (e) { ErrorReporter.report('E-GEN-001', e, {topic}) }`.
3. Return `snapshot.length`. Nested emits are allowed (depth is not limited; a listener that
   re-emits its own topic synchronously is a bug reported once as `E-GEN-001` when
   depth exceeds 32).
4. `on` logs `warn` once per topic when a topic exceeds 100 listeners (leak signal).

6.1.4.3 Log ring buffer
- `write(entry)`: `slots[idx] = entry; idx = (idx + 1) % 500; count = min(count + 1, 500)`.
- `entries()` returns oldest-first by reading from `(idx - count + 500) % 500`.
- `data` is passed through `safeData(v)`: JSON-serializable snapshot with depth <= 4, arrays
  truncated to 32 elements, strings to 200 chars; functions and DOM nodes become `'[omitted]'`.
- Levels below `setLevel` are dropped (default `'info'`; the test build sets `'debug'`).

6.1.4.4 Caps detection (performed once at load, synchronously; all probes wrapped in
try/catch, a throwing probe yields `false`)

| Key | Probe | Type |
|---|---|---|
| `webgl2` | `document.createElement('canvas').getContext('webgl2')` non-null (context is lost immediately via `WEBGL_lose_context` when available) | boolean |
| `webgl1` | same with `'webgl'` then `'experimental-webgl'` | boolean |
| `audioContext` | `typeof (window.AudioContext or window.webkitAudioContext) === 'function'` | boolean |
| `offlineAudioContext` | `typeof (window.OfflineAudioContext or window.webkitOfflineAudioContext) === 'function'` | boolean |
| `mediaRecorder` | `typeof window.MediaRecorder === 'function'` | boolean |
| `pointerEvents` | `'PointerEvent' in window` | boolean |
| `maxTouchPoints` | `navigator.maxTouchPoints or 0` | number |
| `gamepad` | `typeof navigator.getGamepads === 'function'` | boolean |
| `webMidi` | `typeof navigator.requestMIDIAccess === 'function' && window.isSecureContext` | boolean |
| `indexedDB` | `'indexedDB' in window && indexedDB !== null` (openability is verified by M-16) | boolean |
| `localStorage` | write and remove key `flm.v1.probe` inside try/catch | boolean |
| `secureContext` | `window.isSecureContext === true` | boolean |
| `isFile` | `location.protocol === 'file:'` | boolean |
| `visibility` | `'visibilityState' in document` | boolean |
| `storageEstimate` | `navigator.storage && typeof navigator.storage.estimate === 'function'` | boolean |
| `performanceMemory` | `performance.memory && typeof performance.memory.usedJSHeapSize === 'number'` | boolean |
| `devicePixelRatio` | `window.devicePixelRatio or 1` | number |
| `hardwareConcurrency` | `navigator.hardwareConcurrency or 0` | number |
| `userAgent` | `navigator.userAgent` truncated to 200 chars | string |
| `mobile` | `maxTouchPoints > 0 && (navigator.userAgentData ? navigator.userAgentData.mobile : /Mobi or Android or iPhone or iPad/.test(userAgent))` | boolean |

`isMobile()` returns `mobile`. The report also records `probedAt` (ISO timestamp).

6.1.4.5 ErrorReporter
1. `classify(code, err)`: explicit table `CLASS_TABLE` taken from the class column of Part 10.6:
   `E-CAP-001` to `E-CAP-004` and `E-AUD-001` -> `reload`; `E-AUD-008`, `E-IMP-010`,
   `E-MODE-002`, `E-NET-009`, `E-NET-017`, `E-GEN-003` -> `returnToMenu`; every other
   registered code -> `recoverable` (`E-MODE-001` and `E-MODE-003` included; `E-GEN-001` by
   origin per Part 4.9); an unknown code is reported as `E-GEN-000` and is `recoverable`; a
   second uncaught error within 2 s of a `returnToMenu` -> `reload`.
2. `report(code, err, context)`: build `ErrorRecord` (message = `err && err.message or
   String(err)`, stack truncated to 2,000 chars); dedupe into `recent`; `Log.error(code,
   message, context)`; `bus.emit('error', record)`; if `presenter` set call it (inside
   try/catch); if `class === 'reload'` call `showFatal(record)`. Return record.
3. `install()`: `window.addEventListener('error', e => report('E-GEN-001', e.error or
   e.message, {src: e.filename, line: e.lineno}))`; `window.addEventListener(
   'unhandledrejection', e => report('E-GEN-002', e.reason, {}))`. Idempotent.
4. `showFatal(record)`: if `fatalShown` return. Set `fatalShown = true`; `el =
   document.getElementById('fatal')`; if missing, create a `div#fatal` appended to body.
   Build children with `document.createElement` and `textContent` only: heading "Finger
   Lickin Music stopped", paragraph `record.code + ': ' + record.message`, paragraph "Your
   saved projects are not affected. You can copy a diagnostics report to help fix this.",
   buttons "Copy diagnostics" (writes `Diagnostics.export().json` to clipboard via
   `navigator.clipboard.writeText`, falling back to selecting a `<textarea>` with the text)
   and "Reload" (`location.reload()`). Set `el.hidden = false`. Never uses `innerHTML`.

6.1.4.6 Diagnostics.export(opts)
1. `doc = { version: FLM.VERSION, build: FLM.BUILD, exportedAt: ISO, caps: Caps.get(),
   providers: {}, errors: ErrorReporter.recent(), log: Log.entries() }`.
2. For each provider `(key, fn)`: `providers[key] = safe(fn())` with try/catch; a throwing
   provider stores `{error: message}`.
3. Redaction (always, unless `opts.includeContent === true`): walk the object; delete keys
   matching `/^(title|artist|fileName|name|text|lyric|lyrics|displayName|roomCode|sdp)$/i`;
   truncate any string over 200 chars to 200 + `'...'`; replace any array over 200 elements
   by its first 200 plus `'[+N more]'`. Note events, chart notes and project bodies are never
   providers' outputs (providers return counts and settings only; enforced by review and
   UT-01-19).
4. `json = JSON.stringify(doc, null, 0)`; while `json.length > 200 * 1024` remove the oldest
   25 percent of `doc.log` and re-stringify; set `truncated = true` when any removal occurred.
5. Return `{json, bytes: json.length, truncated}`.

6.1.4.7 `uid()`: `Date.now().toString(36) + '-' + (counter++).toString(36) + '-' +
Math.floor(Math.random() * 1679616).toString(36).padStart(4, '0')`. Deterministic ids for
generated content are not produced by `uid()`; generators derive ids from `fnv1a32` of their
inputs (M-08, M-23).

6.1.4.8 `Prng` (mulberry32)
```js
next() {
  let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
int(n) { return Math.floor(this.next() * n); }
shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
```
Seed 0 is replaced by 0x9E3779B9 so the stream is never degenerate. Reference vector:
`new Prng(1).next()` must equal `0.6270739405881613` (first three outputs for seed 1:
0.6270739405881613, 0.002735721180215478, 0.5274470399599522).

6.1.4.9 `fnv1a32(str)`: `h = 0x811c9dc5; for each UTF-16 code unit c: h ^= c; h = Math.imul(h,
0x01000193) >>> 0`. Reference: `fnv1a32('') === 0x811c9dc5`, `fnv1a32('a') === 0xe40c292c`,
`fnv1a32('foobar') === 0xbf9cf968`.

6.1.4.10 `formatTime(s, opts)`: `sign = s < 0 ? '-' : ''`; `s = abs(s)`; `m = floor(s / 60)`;
`sec = floor(s % 60)`; base `sign + m + ':' + pad2(sec)`; with `opts.ms` append `'.' +
pad3(floor((s - floor(s)) * 1000))`. `formatTime(NaN)` returns `'-:--'`.

6.1.4.11 `smoothstep(e0, e1, x)`: `t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 -
2 * t)`; when `e1 === e0` return `x < e0 ? 0 : 1`.

#### 6.1.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Listener throws during emit | try/catch per listener | other listeners run; bus intact | n/a | no | toast via presenter if class recoverable; otherwise log only | none needed | automatic | UT-01-04 |
| Capability probe throws | try/catch per probe | report with `false` for that key | `refresh()` | no | capability gate (M-29) explains | the gate chooses tiers | n/a | UT-01-10 |
| Uncaught exception | window error handler | depends on class | n/a | no (storage writes are atomic in M-16) | `#fatal` or toast | returnToMenu path via M-28 | reload | UT-01-14 |
| Unhandled rejection | unhandledrejection | as above | n/a | no | as above | as above | reload | UT-01-15 |
| Diagnostics provider throws | try/catch | export still produced | n/a | no | export contains `{error}` | n/a | n/a | UT-01-18 |
| Clipboard write fails in `#fatal` | promise rejection | textarea fallback | user | no | textarea visible with text selected | n/a | n/a | UT-01-16 |
| `localStorage` probe throws (privacy mode) | try/catch | `caps.localStorage=false` | n/a | no | M-16 notice | memory-only settings (M-16) | n/a | UT-01-11 |
| Log data not serializable | `safeData` | entry stored with `'[omitted]'` | n/a | no | n/a | n/a | n/a | UT-01-08 |
| Timer owner forgets to clear | `Timers.counts()` delta in `assertClean()` | n/a | n/a | no | diagnostics overlay in test build | n/a | `clearOwner(owner)` | UT-01-12 |

#### 6.1.6 Limits and performance notes

- Log: 500 entries; `safeData` depth 4, 32 array elements, 200-char strings. Diagnostics
  export <= 200 KB (BRIEF 6).
- Emitter: `emit` on a topic with no listeners costs one Map lookup; the bus is used at up to
  ~2,000 emits per second during dense playback (`sched.noteOn`), so `emit` allocates only
  the snapshot array. Listener limit warning at 100 per topic.
- Caps probing creates at most two canvases and no AudioContext (contexts are created only
  by M-05 after a gesture). Probe time budget 20 ms on desktop.
- `Prng.next()` is allocation-free; chart generation uses on the order of 10^5 calls.

#### 6.1.7 Spec coverage

B 6.1 (capability check step 2), B 19.1 layers 16-17, B 19.4, B 24 (recoverable vs
returnToMenu vs reload; diagnostics mode), B 20.3 (listener and timer accounting), E 1
(browser capability risks surfaced as explicit cases), E 10 items 1 and 13 (no global state
object; tracked timers for cleanup), E 11 (framework for the nine questions), I 13 (diagnostics
for errors), I 13.2 (bug reproduction report without song content), P 19 (error messages
avoid sensitive information; logging bounded), P 15 (clear error messages).

#### 6.1.8 Unit tests (group `core`, file `src/91-test-core.js`)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-01-01 | define registers namespace | fresh registry (test hook `Core._resetRegistryForTests()`) | `FLM.X` is the factory result; `modules()` lists X with order 1 |
| UT-01-02 | define rejects duplicates | define X twice | second call throws with message starting `E-GEN-001` |
| UT-01-03 | emitter on/emit order | 3 listeners | called in subscription order with payload and topic |
| UT-01-04 | emitter isolates listener errors | listener 2 throws | listeners 1 and 3 run; `ErrorReporter.recent()` has `E-GEN-001`; emit returns 3 |
| UT-01-05 | once fires once | once + 2 emits | fn called once; `listenerCount(topic) === 0` |
| UT-01-06 | off and offOwner | 2 owners, 3 listeners | `offOwner(a)` returns 2; count 1; `off` returns false for unknown fn |
| UT-01-07 | emit snapshot semantics | listener removes itself and adds another during emit | removed listener not called again; added listener not called in this emit |
| UT-01-08 | log ring wraps at 500 | 600 writes | `entries().length === 500`; first entry is write 101; unserializable data stored as `'[omitted]'` |
| UT-01-09 | log once | `once('k')` twice | returns true then false; one entry |
| UT-01-10 | caps report shape | `Caps.get()` | all 20 keys present with declared types; frozen |
| UT-01-11 | caps probe isolation | stub `localStorage.setItem` to throw | `localStorage === false`; other keys unaffected |
| UT-01-12 | timers tracked | setTimeout + setInterval + requestFrame with owner | `counts()` reflects 1/1/1; `clearOwner` returns 3 and counts are 0 |
| UT-01-13 | classify table | codes from 10.6 | `E-CAP-001 -> reload`, `E-AUD-001 -> reload`, `E-MODE-001 -> recoverable`, `E-MODE-002 -> returnToMenu`, unknown -> `E-GEN-000` recoverable |
| UT-01-14 | report dedupes and emits | report same code+message 3 times | `recent().length === 1`, `count === 3`; `EVT-error` emitted 3 times |
| UT-01-15 | unhandled rejection captured | `install()`; dispatch synthetic `unhandledrejection` | record with `E-GEN-002` |
| UT-01-16 | fatal screen renders safely | `showFatal` with message containing `<b>x</b>` | `#fatal` visible; text contains the literal `<b>`; no element `b` inside |
| UT-01-17 | fatal shown once | two reload-class reports | one `#fatal` content render; second does not duplicate nodes |
| UT-01-18 | diagnostics provider isolation | provider throws | export JSON parses; `providers.bad.error` present |
| UT-01-19 | diagnostics redaction | provider returns `{title:'x', fileName:'y', n: 1, s: 'a'.repeat(500)}` | exported object lacks title and fileName; string length 203; with `includeContent:true` keys present |
| UT-01-20 | diagnostics size cap | fill log with 500 entries of 1 KB data | `bytes <= 204800`, `truncated === true` |
| UT-01-21 | uid uniqueness | 10,000 calls | all distinct; matches `/^[0-9a-z]+-[0-9a-z]+-[0-9a-z]{4}$/` |
| UT-01-22 | prng reference vector | `new Prng(1)` | first three `next()` equal the values in 6.1.4.8 within 1e-15; two instances with same seed agree for 1,000 draws |
| UT-01-23 | prng int/pick/shuffle bounds | 10,000 draws | `int(7)` in 0..6 all hit; `shuffle` is a permutation |
| UT-01-24 | fnv1a32 vectors | '', 'a', 'foobar' | match 6.1.4.9; `fnv1a32Hex` is 8 lowercase hex chars |
| UT-01-25 | formatTime | 0, 61.5, 3599.999, -2, NaN | `'0:00'`, `'1:01'`, `'59:59'`, `'-0:02'`, `'-:--'`; with ms `'1:01.500'` |
| UT-01-26 | clamp/lerp/smoothstep | edge values | `clamp(5,0,1)=1`, `lerp(0,10,0.5)=5`, `smoothstep(0,1,0.5)=0.5`, `smoothstep(1,1,2)=1` |
| UT-01-27 | deepClone independence | nested object with arrays | clone deep-equal and mutation-independent |
| UT-01-28 | assert throws coded error | `assert(false,'m')` | error message starts `E-GEN-004` |

#### 6.1.9 Implementation notes and browser quirks

- Safari exposes `webkitAudioContext` on older versions; probes check both names. Firefox
  lacks `performance.memory`; `performanceMemory` is false there and the perf tools record
  "not measured" for heap.
- `navigator.userAgentData` is Chromium-only; the UA regex fallback is used elsewhere. iPadOS
  Safari reports a desktop UA; `maxTouchPoints > 0` is the primary mobile signal.
- `WEBGL_lose_context.loseContext()` is called on probe canvases so that the probe does not
  hold a GPU context on mobile (some devices allow only a handful of live contexts).
- `window.onerror` on `file://` in Firefox may deliver `"Script error."` without a stack; the
  record keeps whatever is available.
- `Timers.requestFrame` must be used by M-18 for the render loop and by M-07 for gamepad
  polling so that `assertClean()` (4.7) sees zero frames after leaving a mode.
- The early inline error handler in `shell.html` (3.2) buffers errors that occur before
  `01-core.js` runs; `ErrorReporter.install()` drains `window.__flmEarlyErrors` (an array of
  `{message, source, line}`) into `report('E-GEN-001', ...)` and deletes the global.

### 6.2 M-02 Theory (`src/02-theory.js`, `FLM.Theory`)

#### 6.2.1 Responsibilities and non-goals

Responsibilities: pitch classes and enharmonic spelling; data-driven scale and chord tables;
interval names; key signatures (fifths <-> tonic); note name <-> MIDI number; scale degree and
chord note generation with inversions and voicings; chord recognition; GM program names,
families and GM drum names. Pure functions over numbers and strings, no state except the
tables and user-defined scales registered at runtime.

Non-goals: no mapping of inputs to notes (M-08), no synthesis parameters (M-06), no
notation rendering.

#### 6.2.2 Public API

```js
FLM.Theory = {
  VERSION: 1,                        // table version (see Part 5.17)
  PITCH_CLASS_SHARP: ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],
  PITCH_CLASS_FLAT:  ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'],

  /** Middle C = 60 = 'C4'. key: number fifths (-7..7) or {fifths, mode}; default 0.
   *  Spelling: fifths >= 0 -> sharps, fifths < 0 -> flats. */
  noteName(midi /* 0..127 */, key /* ?number|{fifths,mode} */) /* -> 'C#4' */,
  /** Accepts 'C4', 'c#4', 'Db-1', 'E##3', 'Fb5' (double accidentals allowed). Returns
   *  integer 0..127 or throws Error 'E-GEN-005'. */
  midiFromName(name) /* -> number */,
  pitchClass(midi) /* -> 0..11 */, octaveOf(midi) /* -> -1..9 */,

  scales() /* -> Array<ScaleDef> (built-in then user) */,
  scale(id) /* -> ScaleDef or undefined */,
  /** Registers a user scale; intervals must be ascending, unique, 0..11, start at 0, length 1..12.
   *  Returns the ScaleDef; throws 'E-GEN-006' when invalid. */
  defineScale(id, name, intervals) /* -> ScaleDef */,
  /** count notes ascending from root in octave (root pitch = root + 12*(octave+1)); wraps
   *  octaves; results are clamped to 0..127 and truncated at the range end. */
  scaleDegrees(root /* 0..11 */, scaleId, octave /* -1..9 */, count /* 1..128 */) /* -> number[] */,
  /** degree 0-based (may be negative or >= scale length: octave wrap). */
  scaleNote(root, scaleId, octave, degree) /* -> midi */,
  /** Nearest scale member to midi (ties -> lower); used by Profile D out-of-scale snapping. */
  snapToScale(midi, root, scaleId) /* -> midi */,
  inScale(midi, root, scaleId) /* -> boolean */,

  chords() /* -> Array<ChordDef> */, chord(type) /* -> ChordDef */,
  /** inversion 0..(size-1); voicing 'close' (default) | 'open' | 'spread'. */
  chordNotes(root /* 0..11 */, type, inversion /* ?0 */, octave /* ?4 */, voicing /* ?'close' */) /* -> number[] ascending */,
  /** pitchSet: midi numbers (any octave, duplicates allowed). Returns
   *  {root:0..11, type, inversion, bass:midi, exact:true} or null. */
  recognizeChord(pitchSet /* number[] */) /* -> object|null */,

  intervals() /* -> Array<{id, name, semitones}> */,
  intervalName(semitones /* 0..24 */) /* -> 'P5' etc. */,
  intervalSemitones(id) /* -> number */,

  /** fifths -7..7 and mode -> tonic pitch class and display name ('Eb', 'F#'). */
  keyTonic(fifths, mode /* 'major'|'minor' */) /* -> {pc, name} */,
  keyFifths(tonicPc, mode) /* -> fifths in -6..6 (prefers the spelling with fewer accidentals; Gb/F# -> -6 for major, 6 for minor) */,
  keyName(fifths, mode) /* -> 'G major' / 'E minor' */,

  gmProgramName(program /* 0..127 */) /* -> string */,
  gmFamily(program) /* -> {index:0..15, name} */,
  gmFamilies() /* -> string[16] */,
  gmDrumName(key /* 35..81 */) /* -> string or 'Percussion <key>' outside 35..81 */
};
// ScaleDef { id, name, intervals:number[], userDefined:boolean }
// ChordDef { type, name, intervals:number[], symbol }
```

Events: none emitted, none consumed.

#### 6.2.3 Internal state

Frozen built-in tables (scales, chords, intervals, key tonics, GM names). A `Map` of
user-defined scales (max 64; `defineScale` with an existing user id replaces it; built-in ids
cannot be replaced, `E-GEN-006`). User scales are persisted by M-16 under
`flm.v1.settings.userScales` (schema in Part 5.11) and re-registered at boot.

Scale table (intervals are semitones from the root):

| id | name | intervals |
|---|---|---|
| `major` | Major (Ionian) | 0 2 4 5 7 9 11 |
| `naturalMinor` | Natural minor (Aeolian) | 0 2 3 5 7 8 10 |
| `harmonicMinor` | Harmonic minor | 0 2 3 5 7 8 11 |
| `melodicMinor` | Melodic minor | 0 2 3 5 7 9 11 |
| `majorPentatonic` | Major pentatonic | 0 2 4 7 9 |
| `minorPentatonic` | Minor pentatonic | 0 3 5 7 10 |
| `blues` | Blues | 0 3 5 6 7 10 |
| `chromatic` | Chromatic | 0 1 2 3 4 5 6 7 8 9 10 11 |
| `dorian` | Dorian | 0 2 3 5 7 9 10 |
| `phrygian` | Phrygian | 0 1 3 5 7 8 10 |
| `lydian` | Lydian | 0 2 4 6 7 9 11 |
| `mixolydian` | Mixolydian | 0 2 4 5 7 9 10 |
| `locrian` | Locrian | 0 1 3 5 6 8 10 |
| `wholeTone` | Whole tone | 0 2 4 6 8 10 |
| `user:<id>` | user defined | validated at `defineScale` |

`ionian` and `aeolian` are accepted as aliases of `major` and `naturalMinor` by `scale(id)`.

Chord table:

| type | name | symbol | intervals |
|---|---|---|---|
| `major` | Major | `` | 0 4 7 |
| `minor` | Minor | `m` | 0 3 7 |
| `dim` | Diminished | `dim` | 0 3 6 |
| `aug` | Augmented | `aug` | 0 4 8 |
| `sus2` | Suspended 2nd | `sus2` | 0 2 7 |
| `sus4` | Suspended 4th | `sus4` | 0 5 7 |
| `maj7` | Major 7th | `maj7` | 0 4 7 11 |
| `min7` | Minor 7th | `m7` | 0 3 7 10 |
| `dom7` | Dominant 7th | `7` | 0 4 7 10 |
| `dim7` | Diminished 7th | `dim7` | 0 3 6 9 |
| `halfDim7` | Half-diminished 7th | `m7b5` | 0 3 6 10 |
| `minMaj7` | Minor-major 7th | `mMaj7` | 0 3 7 11 |
| `add9` | Add 9 | `add9` | 0 4 7 14 |
| `six` | Major 6th | `6` | 0 4 7 9 |
| `min6` | Minor 6th | `m6` | 0 3 7 9 |
| `nine` | Dominant 9th | `9` | 0 4 7 10 14 |
| `maj9` | Major 9th | `maj9` | 0 4 7 11 14 |
| `min9` | Minor 9th | `m9` | 0 3 7 10 14 |

Interval table: `P1 0, m2 1, M2 2, m3 3, M3 4, P4 5, A4 6 (alias d5), P5 7, m6 8, M6 9, m7 10,
M7 11, P8 12, m9 13, M9 14, m10 15, M10 16, P11 17, A11 18, P12 19, m13 20, M13 21, m14 22, M14 23,
P15 24`. `intervalName(6)` returns `'A4'`.

Key signature table (`fifths` -> major tonic / minor tonic): -7 Cb/Ab, -6 Gb/Eb, -5 Db/Bb,
-4 Ab/F, -3 Eb/C, -2 Bb/G, -1 F/D, 0 C/A, 1 G/E, 2 D/B, 3 A/F#, 4 E/C#, 5 B/G#, 6 F#/D#,
7 C#/A#. `keyFifths` inverts this preferring `abs(fifths)` smallest; for pc 6 major it returns
-6 (Gb), for pc 3 minor it returns 6 (D# minor is not used; Eb minor = -6). Decision: for the
six-accidental ambiguity, `keyFifths(6,'major') = -6`, `keyFifths(3,'minor') = -6`, `keyFifths(1,'major')
= -5` (Db), `keyFifths(10,'minor') = -5` (Bb minor), `keyFifths(8,'major') = -4` (Ab),
`keyFifths(5,'minor') = -4` (F minor). Reason: flat spellings for these are the common
notation; the choice only affects display names.

GM family names (index = `floor(program / 8)`): 0 Piano, 1 Chromatic Percussion, 2 Organ,
3 Guitar, 4 Bass, 5 Strings, 6 Ensemble, 7 Brass, 8 Reed, 9 Pipe, 10 Synth Lead, 11 Synth Pad,
12 Synth Effects, 13 Ethnic, 14 Percussive, 15 Sound Effects.

GM program names (0-based program numbers; the UI shows `program + 1`):

| Prog | Name | Prog | Name | Prog | Name | Prog | Name |
|---|---|---|---|---|---|---|---|
| 0 | Acoustic Grand Piano | 32 | Acoustic Bass | 64 | Soprano Sax | 96 | FX 1 (rain) |
| 1 | Bright Acoustic Piano | 33 | Electric Bass (finger) | 65 | Alto Sax | 97 | FX 2 (soundtrack) |
| 2 | Electric Grand Piano | 34 | Electric Bass (pick) | 66 | Tenor Sax | 98 | FX 3 (crystal) |
| 3 | Honky-tonk Piano | 35 | Fretless Bass | 67 | Baritone Sax | 99 | FX 4 (atmosphere) |
| 4 | Electric Piano 1 | 36 | Slap Bass 1 | 68 | Oboe | 100 | FX 5 (brightness) |
| 5 | Electric Piano 2 | 37 | Slap Bass 2 | 69 | English Horn | 101 | FX 6 (goblins) |
| 6 | Harpsichord | 38 | Synth Bass 1 | 70 | Bassoon | 102 | FX 7 (echoes) |
| 7 | Clavinet | 39 | Synth Bass 2 | 71 | Clarinet | 103 | FX 8 (sci-fi) |
| 8 | Celesta | 40 | Violin | 72 | Piccolo | 104 | Sitar |
| 9 | Glockenspiel | 41 | Viola | 73 | Flute | 105 | Banjo |
| 10 | Music Box | 42 | Cello | 74 | Recorder | 106 | Shamisen |
| 11 | Vibraphone | 43 | Contrabass | 75 | Pan Flute | 107 | Koto |
| 12 | Marimba | 44 | Tremolo Strings | 76 | Blown Bottle | 108 | Kalimba |
| 13 | Xylophone | 45 | Pizzicato Strings | 77 | Shakuhachi | 109 | Bag pipe |
| 14 | Tubular Bells | 46 | Orchestral Harp | 78 | Whistle | 110 | Fiddle |
| 15 | Dulcimer | 47 | Timpani | 79 | Ocarina | 111 | Shanai |
| 16 | Drawbar Organ | 48 | String Ensemble 1 | 80 | Lead 1 (square) | 112 | Tinkle Bell |
| 17 | Percussive Organ | 49 | String Ensemble 2 | 81 | Lead 2 (sawtooth) | 113 | Agogo |
| 18 | Rock Organ | 50 | Synth Strings 1 | 82 | Lead 3 (calliope) | 114 | Steel Drums |
| 19 | Church Organ | 51 | Synth Strings 2 | 83 | Lead 4 (chiff) | 115 | Woodblock |
| 20 | Reed Organ | 52 | Choir Aahs | 84 | Lead 5 (charang) | 116 | Taiko Drum |
| 21 | Accordion | 53 | Voice Oohs | 85 | Lead 6 (voice) | 117 | Melodic Tom |
| 22 | Harmonica | 54 | Synth Voice | 86 | Lead 7 (fifths) | 118 | Synth Drum |
| 23 | Tango Accordion | 55 | Orchestra Hit | 87 | Lead 8 (bass + lead) | 119 | Reverse Cymbal |
| 24 | Acoustic Guitar (nylon) | 56 | Trumpet | 88 | Pad 1 (new age) | 120 | Guitar Fret Noise |
| 25 | Acoustic Guitar (steel) | 57 | Trombone | 89 | Pad 2 (warm) | 121 | Breath Noise |
| 26 | Electric Guitar (jazz) | 58 | Tuba | 90 | Pad 3 (polysynth) | 122 | Seashore |
| 27 | Electric Guitar (clean) | 59 | Muted Trumpet | 91 | Pad 4 (choir) | 123 | Bird Tweet |
| 28 | Electric Guitar (muted) | 60 | French Horn | 92 | Pad 5 (bowed) | 124 | Telephone Ring |
| 29 | Overdriven Guitar | 61 | Brass Section | 93 | Pad 6 (metallic) | 125 | Helicopter |
| 30 | Distortion Guitar | 62 | Synth Brass 1 | 94 | Pad 7 (halo) | 126 | Applause |
| 31 | Guitar Harmonics | 63 | Synth Brass 2 | 95 | Pad 8 (sweep) | 127 | Gunshot |

GM drum names (keys 35-81):

| Key | Name | Key | Name | Key | Name |
|---|---|---|---|---|---|
| 35 | Acoustic Bass Drum | 51 | Ride Cymbal 1 | 67 | High Agogo |
| 36 | Bass Drum 1 | 52 | Chinese Cymbal | 68 | Low Agogo |
| 37 | Side Stick | 53 | Ride Bell | 69 | Cabasa |
| 38 | Acoustic Snare | 54 | Tambourine | 70 | Maracas |
| 39 | Hand Clap | 55 | Splash Cymbal | 71 | Short Whistle |
| 40 | Electric Snare | 56 | Cowbell | 72 | Long Whistle |
| 41 | Low Floor Tom | 57 | Crash Cymbal 2 | 73 | Short Guiro |
| 42 | Closed Hi-Hat | 58 | Vibraslap | 74 | Long Guiro |
| 43 | High Floor Tom | 59 | Ride Cymbal 2 | 75 | Claves |
| 44 | Pedal Hi-Hat | 60 | Hi Bongo | 76 | Hi Wood Block |
| 45 | Low Tom | 61 | Low Bongo | 77 | Low Wood Block |
| 46 | Open Hi-Hat | 62 | Mute Hi Conga | 78 | Mute Cuica |
| 47 | Low-Mid Tom | 63 | Open Hi Conga | 79 | Open Cuica |
| 48 | Hi-Mid Tom | 64 | Low Conga | 80 | Mute Triangle |
| 49 | Crash Cymbal 1 | 65 | High Timbale | 81 | Open Triangle |
| 50 | High Tom | 66 | Low Timbale | | |

#### 6.2.4 Algorithms

6.2.4.1 `noteName(midi, key)`: `fifths = typeof key === 'number' ? key : (key && key.fifths) or
0`; `names = fifths < 0 ? PITCH_CLASS_FLAT : PITCH_CLASS_SHARP`; return `names[midi % 12] +
(Math.floor(midi / 12) - 1)`. Example: `noteName(61, -2) === 'Db4'`, `noteName(61) === 'C#4'`.

6.2.4.2 `midiFromName(name)`: regex `^([A-Ga-g])(#{1,2}|b{1,2}|x)?(-?\d{1,2})$`; letter ->
pc via `{C:0,D:2,E:4,F:5,G:7,A:9,B:11}`; accidental `#`=+1, `##`/`x`=+2, `b`=-1, `bb`=-2;
`midi = pc + acc + 12 * (octave + 1)`; throw `E-GEN-005` when no match or result outside
0..127.

6.2.4.3 `scaleDegrees(root, scaleId, octave, count)`
1. `def = scale(scaleId)`; throw `E-GEN-006` if missing. `base = root + 12 * (octave + 1)`.
2. For `i` in `0..count-1`: `oct = floor(i / len)`, `step = def.intervals[i % len]`, `midi =
   base + 12 * oct + step`; stop when `midi > 127`.
3. Return the array (may be shorter than `count`).

`scaleNote(root, scaleId, octave, degree)`: `oct = floor(degree / len)` (floor division handles
negatives), `step = intervals[((degree % len) + len) % len]`, result `clamp(base + 12*oct + step,
0, 127)`.

`snapToScale(midi, root, scaleId)`: compute `rel = ((midi - root) % 12 + 12) % 12`; find the
interval `iv` minimizing `abs(iv - rel)` considering also `iv + 12` and `iv - 12`; on a tie
choose the lower resulting pitch; return `midi + (chosen - rel)`.

6.2.4.4 `chordNotes(root, type, inversion, octave, voicing)`
1. `def = chord(type)`; `notes = def.intervals.map(iv => root + 12*(octave+1) + iv)`.
2. Inversion `k` (clamped to `0..notes.length-1`): repeat `k` times: `notes.push(notes.shift()
   + 12)`.
3. Voicing: `'close'` unchanged; `'open'`: if `notes.length >= 3`, move `notes[notes.length-2]`
   down an octave and re-sort; `'spread'`: duplicate the lowest note one octave below (adds a
   note). Then clamp every pitch to 0..127 and return ascending.
Example: `chordNotes(0,'major',1,4)` -> `[64, 67, 72]`.

6.2.4.5 `recognizeChord(pitchSet)`
1. `pcs = unique(pitchSet.map(pitchClass)).sort()`; `bass = min(pitchSet)`; if `pcs.length <
   2` return null.
2. For each candidate `root` in `pcs` (ascending), for each `ChordDef` in table order:
   `target = unique(def.intervals.map(iv => (root + iv) % 12))`; if `setEquals(target, pcs)`
   record `{root, type, size: def.intervals.length}`.
3. If no match return null. Choose the match with the smallest `size`, then earliest table
   order, then whose `root === pitchClass(bass)`, then lowest root.
4. `inversion` = index of `pitchClass(bass)` within `def.intervals.map(iv => (root+iv)%12)`
   (0 when bass is root). Return `{root, type, inversion, bass, exact: true}`.
Example: `[64, 67, 72]` -> `{root:0, type:'major', inversion:1, bass:64}`.

6.2.4.6 `keyTonic` and `keyFifths`: table lookups from 6.2.3; `keyTonic(fifths, 'minor').pc ===
(keyTonic(fifths, 'major').pc + 9) % 12` is an invariant checked by UT-02-15.

#### 6.2.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Invalid note name string | regex and range check | tables | user corrects input | no | field validation message in UI (M-26) | n/a | n/a | UT-02-03 |
| Invalid user scale | `defineScale` validation | built-in scales | user corrects | no | "Scale must list 1-12 ascending semitones starting at 0" | n/a | n/a | UT-02-06 |
| Unknown scale or chord id from a stale project | `scale()` returns undefined; callers (M-08) fall back to `major` / `major` chord and log `W-THEORY-FALLBACK` | playable mapping | n/a | no | toast "Unknown scale; using Major" | yes | n/a | UT-02-07 |
| Program outside 0..127 | range check | `gmProgramName` returns `'Program N'`, `gmFamily` clamps | n/a | no | n/a | n/a | n/a | UT-02-19 |

#### 6.2.6 Limits and performance notes

Tables total under 12 KB of source. `recognizeChord` evaluates at most 12 roots x 18 chords
= 216 set comparisons (used on every chord-window close in Free Play, well under 0.1 ms).
User scales <= 64.

#### 6.2.7 Spec coverage

B 10.1, B 10.2 (all listed scales plus modes and whole tone), B 10.3 (triads, suspended,
sevenths, extended, intervals, inversions and voicings), B 10.4 (root, pattern, octave,
register support functions), B 11.3 item 1 (program names for assignment display), B 15.2
key signatures, I 2.1 (scale-based and chord mappings data), P 9 (keys and scales map
correctly; inversions produce expected notes).

#### 6.2.8 Unit tests (group `theory`, file `src/91-test-theory.js`)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-02-01 | noteName sharps | 60, 61, 71, 0, 127 | `C4`, `C#4`, `B4`, `C-1`, `G9` |
| UT-02-02 | noteName flats by key | 61 with fifths -2; 61 with {fifths:-1} | `Db4` both |
| UT-02-03 | midiFromName parse | `C4`, `c#4`, `Db-1`, `E##3`, `Fb5`, `H4`, `C10` | 60, 61, 1, 54, 64, throws, throws |
| UT-02-04 | round trip names | all 128 midis, fifths 0 and -3 | `midiFromName(noteName(m,k)) === m` |
| UT-02-05 | scale table integrity | every built-in | intervals ascending, unique, within 0..11, start 0; `major` has 7 |
| UT-02-06 | defineScale validation | `[0,2,2]`, `[1,3]`, `[]`, 13 entries, replacing `major` | each throws `E-GEN-006`; valid `[0,3,7]` returns def and `scales()` includes it |
| UT-02-07 | unknown ids | `scale('nope')`, `chord('nope')` | undefined; `scaleDegrees` throws `E-GEN-006` |
| UT-02-08 | scaleDegrees C major | root 0, octave 4, count 8 | `[60,62,64,65,67,69,71,72]` |
| UT-02-09 | scaleDegrees truncates at 127 | root 0, octave 9, count 8 | returns `[120,122,124,125,127]` |
| UT-02-10 | scaleNote negative degree | root 0, major, octave 4, degree -1 | 59 |
| UT-02-11 | snapToScale | 61 in C major; 66 in C major; 63 in C minor pentatonic | 60 (tie -> lower), 65, 63 |
| UT-02-12 | chordNotes close | C major inv 0/1/2 octave 4 | `[60,64,67]`, `[64,67,72]`, `[67,72,76]` |
| UT-02-13 | chordNotes voicings | C maj7 inv 0 octave 4, voicing open; voicing spread | open `[55,60,64,71]`; spread `[48,60,64,67,71]` |
| UT-02-14 | chord table integrity | all 18 | intervals start 0, ascending, size 3..5 |
| UT-02-15 | key tables | fifths -7..7 | `keyTonic(f,'major')` names match 6.2.3; minor pc = major pc + 9 mod 12; `keyFifths(keyTonic(f,m).pc, m)` returns f for `abs(f) <= 5` |
| UT-02-16 | recognizeChord basics | `[60,64,67]`, `[64,67,72]`, `[60,63,67,70]`, `[60,64]` | C major inv 0; C major inv 1; C min7; null |
| UT-02-17 | recognizeChord tie rules | `[60,63,66,69]` (dim7 symmetric) | root 0 (lowest candidate), type `dim7`, inversion 0 |
| UT-02-18 | intervals | `intervalName(7)`, `intervalName(6)`, `intervalSemitones('m3')` | `P5`, `A4`, 3 |
| UT-02-19 | GM names | 0, 24, 127, 128 | `Acoustic Grand Piano`, `Acoustic Guitar (nylon)`, `Gunshot`, `Program 128`; `gmFamily(40).name === 'Strings'` |
| UT-02-20 | GM drum names | 35, 42, 81, 34, 82 | `Acoustic Bass Drum`, `Closed Hi-Hat`, `Open Triangle`, `Percussion 34`, `Percussion 82` |
| UT-02-21 | all 128 program names unique and present | iterate | 128 non-empty distinct strings |
| UT-02-22 | aliases | `scale('ionian')`, `scale('aeolian')` | same objects as `major`, `naturalMinor` |

Note on UT-02-13: the expected open voicing of C maj7 (`[60,64,67,71]`) is `[55,60,64,71]`
(the 67 moved down an octave, re-sorted); the spread voicing is `[48,60,64,67,71]`.

#### 6.2.9 Implementation notes and browser quirks

- No browser APIs are used. Keep every table as a frozen array literal; `Object.freeze` on
  nested arrays too so M-08 cannot mutate them.
- The GM tables are also the single source for the About screen's "synthesized instruments"
  list (M-27 reads `gmProgramName` and `FLM.Instruments.fidelity`).

### 6.3 M-03 Model (`src/03-model.js`, `FLM.Model`)

#### 6.3.1 Responsibilities and non-goals

Responsibilities: the musical data model of Part 5 (`Song`, `Track`, the five `Event` kinds,
`TempoMap`, `MeterMap`, `KeyMap`, `Marker`, `ImportWarning`); factories with defaults;
ordered insertion and removal; the note-on/off pairing algorithm used by every importer and
by the Recorder; the non-destructive sustain-pedal derived layer; validation; per-track
indexes; `durationTicks`. Everything is plain JSON-safe data plus pure functions; class
instances are used only for `TempoMap`, `MeterMap`, `KeyMap` and `TrackIndex`, each of which
has `toJSON()` and a static `fromJSON()`.

Non-goals: no file parsing (M-10..M-13), no project envelope or undo (M-15), no playback.

#### 6.3.2 Public API

```js
FLM.Model = {
  PPQ: 960,
  KIND_PRIORITY: { program: 0, cc: 1, bend: 2, note: 3, text: 4 },

  Song: {
    /** Fills defaults: id uid(), ppq 960, tempoMap default 120 BPM, meterMap 4/4 at 0,
     *  keyMap C major at 0, tracks [], markers [], durationTicks 0, timestamps now. */
    create(partial /* ?object */) /* -> Song */,
    fromJSON(obj) /* -> Song (re-hydrates maps; throws E-MDL-* on invalid) */,
    toJSON(song) /* -> plain object */,
    clone(song) /* -> deep copy with new event ids preserved */,
    /** Recomputes durationTicks from all tracks and markers. */
    computeDuration(song) /* -> number */,
    addTrack(song, track) /* -> track (enforces 32-track limit: throws E-MDL-010) */,
    removeTrack(song, trackId) /* -> boolean */,
    trackById(song, trackId) /* -> Track or undefined */
  },
  Track: {
    /** Defaults: id uid(), name 'Track', channel 0, program 0, isDrums false, events [],
     *  mix {gain:1, pan:0, mute:false, solo:false}, color from palette by index, visible true,
     *  lockedSource true. */
    create(partial) /* -> Track */
  },
  Events: {
    note(tick, durTicks, pitch, velocity, channel, extra /* ?{offVelocity,id} */) /* -> NoteEvent */,
    cc(tick, controller, value, channel) /* -> ControlEvent */,
    program(tick, program, bankMsb, bankLsb, channel) /* -> ProgramEvent */,
    bend(tick, value, channel) /* -> PitchBendEvent */,
    text(tick, type /* 'text'|'lyric'|'marker'|'trackName'|'instrumentName'|'copyright' */, text) /* -> TextEvent */,
    /** Total order used everywhere (Part 5.2). Returns negative, zero, positive. */
    compare(a, b) /* -> number */,
    endTick(e) /* -> tick + durTicks for notes, tick otherwise */
  },

  /** Binary-search insertion keeping track.events sorted; returns index. O(n) due to splice. */
  insertEvent(track, event) /* -> number */,
  insertEvents(track, events /* unsorted ok */) /* -> void (sorts then merges: O((n+m) log)) */,
  removeEvent(track, eventOrId) /* -> boolean */,
  removeEvents(track, predicate) /* -> number removed */,
  /** Verifies order; used by validate() and tests. */
  isSorted(events) /* -> boolean */,
  sortEvents(events) /* -> events (stable, in place) */,

  /** Pairs raw on/off messages into NoteEvents. raw: Array<RawNote>, in tick order
   *  (ties: offs before ons, as produced by parsers). Returns {notes, warnings}. */
  pairNotes(raw /* Array<RawNote> */, opts /* ?{trackEndTick:number, trackIndex:number} */) /* -> {notes:NoteEvent[], warnings:ImportWarning[]} */,
  // RawNote { tick, type:'on'|'off', pitch, velocity, channel, order /* source index */ }

  /** Non-destructive derived layer. Returns DerivedNote[] aligned to the track's notes. */
  deriveSustain(track) /* -> DerivedNote[] */,
  // DerivedNote { note:NoteEvent, effectiveDurTicks:number, extendedBySustain:boolean }

  validate(song) /* -> {ok:boolean, errors:ModelError[], warnings:ImportWarning[]} */,
  // ModelError { code:'E-MDL-nnn', message, location:{track?, index?, tick?} }
  ImportWarning: { create(code, message, severity, location) /* -> ImportWarning */ },

  TempoMap: class TempoMap {
    constructor(entries /* ?[{tick, usPerQuarter}] */);   // default [{tick:0, usPerQuarter:500000}]
    entries /* [{tick, usPerQuarter, secondsAt}] sorted, unique ticks, secondsAt precomputed */;
    set(tick, usPerQuarter) /* replaces an entry at the same tick */; remove(tick);
    ticksToSeconds(tick /* may be negative or fractional */) /* -> seconds */;
    secondsToTicks(seconds) /* -> ticks (float; callers round) */;
    tempoAt(tick) /* -> {usPerQuarter, bpm} */;
    static fromBpm(bpm) /* -> TempoMap with one entry */;
    toJSON(); static fromJSON(obj);
  },
  MeterMap: class MeterMap {
    constructor(entries /* ?[{tick, numerator, denominator}] */);  // default 4/4 at 0
    set(tick, numerator, denominator); remove(tick);
    meterAt(tick) /* -> {numerator, denominator, tick, ticksPerBar, ticksPerBeat} */;
    barAt(tick) /* -> 0-based bar index */; beatAt(tick) /* -> {bar, beat /* 0-based */, frac /* 0..1 */} */;
    tickOfBar(bar) /* -> tick */; tickOfBeat(bar, beat) /* -> tick */;
    toJSON(); static fromJSON(obj);
  },
  KeyMap: class KeyMap {
    constructor(entries /* ?[{tick, fifths, mode}] */);   // default C major at 0
    set(tick, fifths, mode); remove(tick); keyAt(tick) /* -> {fifths, mode, tick} */;
    toJSON(); static fromJSON(obj);
  },

  TrackIndex: class TrackIndex {
    constructor(track);
    /** Rebuild when track.version changed; cheap check. */
    refresh() /* -> this */;
    notes /* NoteEvent[] sorted by tick */; firstAtOrAfter(tick) /* -> index into notes */;
    notesBetween(a, b /* [a,b) by start tick */) /* -> NoteEvent[] */;
    activeAt(tick) /* -> NoteEvent[] with tick <= t < endTick */;
    maxPolyphony() /* -> number */; pitchRange() /* -> {lo, hi} or null */;
    eventsAtOrAfter(tick) /* -> index into track.events */;
  },
  /** Cached per track by id + version. */
  indexFor(track) /* -> TrackIndex */,

  /** Mutation helpers bump track.version (integer) so indexes invalidate. */
  touch(track) /* -> void */,
  TRACK_COLORS: /* 16 hex strings */
};
```

Events: none emitted (M-15 emits `project.changed` when it mutates through commands).

#### 6.3.3 Internal state

- Every `Track` carries a non-serialized `version` counter (added at creation, stripped by
  `Song.toJSON`). `insertEvent`, `removeEvent`, `insertEvents`, `removeEvents` and `touch`
  increment it. `indexFor` keeps a `Map<trackId, {version, index}>`; mismatch triggers rebuild.
- Invariant I1: `track.events` is always sorted by `Events.compare` (verified by UT-03-05 after
  every mutation helper). Direct `push` is forbidden by convention and detected by
  `validate()` as `E-MDL-004`.
- Invariant I2: every `NoteEvent` has `durTicks >= 1`, `pitch` 0..127, `velocity` 1..127,
  `channel` 0..15.
- Invariant I3: `song.durationTicks >= max(Events.endTick(e))` over all tracks and `>= max
  marker.tick`; recomputed by `computeDuration` after any structural change (M-15 commands
  call it).
- `TempoMap.entries[i].secondsAt` = seconds from tick 0 to `entries[i].tick`; entry 0 is
  always at tick 0 (a map whose first entry is later than 0 gets an implicit 120 BPM entry at
  tick 0, warning `W-TEMPO-IMPLICIT-START`).

#### 6.3.4 Algorithms

6.3.4.1 `Events.compare(a, b)`
```text
if a.tick != b.tick -> a.tick - b.tick
pa = KIND_PRIORITY[a.kind], pb = KIND_PRIORITY[b.kind]; if pa != pb -> pa - pb
ca = a.channel ?? -1, cb = b.channel ?? -1; if ca != cb -> ca - cb
if both notes and a.pitch != b.pitch -> a.pitch - b.pitch
if both cc and a.controller != b.controller -> a.controller - b.controller
return (a.id ?? '') < (b.id ?? '') ? -1 : (a.id ?? '') > (b.id ?? '') ? 1 : 0
```
Note-off-like raw messages do not exist in `track.events` (notes carry durations); the
"offs before ons at equal tick" rule applies only inside `pairNotes` input ordering.

6.3.4.2 `insertEvent(track, e)`: binary search for the first index `i` with `compare(events[i],
e) > 0`; `events.splice(i, 0, e)`; `touch(track)`; return `i`. `insertEvents`: if `m >
n / 8` concatenate and stable-sort; otherwise insert one by one.

6.3.4.3 `pairNotes(raw, opts)`
```text
open = Map<key = channel*128 + pitch, Array<{tick, velocity, order}>>   // stack per key
notes = [], warnings = []
for msg in raw (already ordered by tick; at equal tick 'off' before 'on'; then source order):
  key = msg.channel*128 + msg.pitch
  isOff = msg.type == 'off' or (msg.type == 'on' and msg.velocity == 0)
  if isOff:
    stack = open.get(key)
    if !stack or stack.empty:
      warnings.push(W-NOTE-OFF-WITHOUT-ON, 'warn', {tick, pitch, channel}) ; continue   // dropped
    start = stack.pop()                       // LIFO: most recent same-pitch on closes first
    dur = msg.tick - start.tick
    if dur <= 0: dur = 1; warnings.push(W-NOTE-ZERO-DURATION, 'info')
    notes.push(note(start.tick, dur, pitch, start.velocity, channel, {offVelocity: msg.velocity}))
  else (note on, velocity > 0):
    stack = open.get(key) or new
    if stack.length > 0:
      // same-pitch overlap: end the previous note at this start (policy: no stacking)
      prev = stack.pop()
      dur = max(1, msg.tick - prev.tick)
      notes.push(note(prev.tick, dur, pitch, prev.velocity, channel, {offVelocity: 64}))
      warnings.push(W-NOTE-OVERLAP, 'info', {tick, pitch, channel})
    stack.push({tick, velocity, order}); open.set(key, stack)
after loop: for every remaining open entry:
    end = opts.trackEndTick ?? (max tick seen) ; dur = max(1, end - start.tick)
    notes.push(note(start.tick, dur, ..., {offVelocity: 0}))
    warnings.push(W-NOTE-UNMATCHED, 'warn', {tick: start.tick, pitch, channel})
sortEvents(notes); dedupe warnings by code per track into one warning with a count field
return {notes, warnings}
```
Velocity clamp: an on with velocity > 127 becomes 127 with `W-NOTE-VELOCITY-CLAMP`. Pitch
outside 0..127 is dropped with `W-NOTE-PITCH-RANGE` (`warn`). Warning dedupe keeps the first
location and adds `count`.

6.3.4.4 `deriveSustain(track)`
1. Collect `pedal = events.filter(e => e.kind === 'cc' && e.controller === 64)` sorted;
   state per channel: down when `value >= 64`.
2. For each note (sorted): `end = tick + durTicks`; find pedal state at `end - 1` for the
   note's channel (binary search over that channel's pedal events). If down: `release =`
   tick of the next pedal event on that channel with `value < 64` after `end`; if none,
   `release = song-level track end` (max endTick of the track). `effectiveEnd = release`.
3. Same-pitch retrigger cap: `effectiveEnd = min(effectiveEnd, nextSamePitchStart)` where
   `nextSamePitchStart` is the tick of the next note with the same pitch and channel.
4. `effectiveDurTicks = max(durTicks, effectiveEnd - tick)`; `extendedBySustain =
   effectiveDurTicks > durTicks`.
The pedal never shortens a note; never-released pedal extends to track end (E 2.3 recovery:
the Scheduler additionally caps any single voice at 60 s of audio, 6.5.4.5).

6.3.4.5 `validate(song)` rules (errors stop loading; warnings do not):

| Code | Condition | Severity |
|---|---|---|
| E-MDL-001 | `song.ppq !== 960` | error |
| E-MDL-002 | `tracks.length > 32` | error |
| E-MDL-003 | duplicate track id or event id within a track | error |
| E-MDL-004 | `!isSorted(track.events)` | error |
| E-MDL-005 | note with `durTicks < 1`, pitch or velocity out of range, channel not 0..15 | error |
| E-MDL-006 | cc controller or value not 0..127; bend not -8192..8191; program not 0..127 | error |
| E-MDL-007 | tempoMap empty, non-ascending, usPerQuarter not 1..16,777,215, first tick != 0 | error |
| E-MDL-008 | meter numerator not 1..64 or denominator not a power of two 1..64 | error |
| E-MDL-009 | keyMap fifths not -7..7 or mode not major/minor | error |
| E-MDL-010 | `addTrack` beyond 32 tracks | error (thrown) |
| E-MDL-011 | total events > 1,000,000 | error |
| W-MDL-DURATION | `durationTicks` smaller than the last event end | info (auto-fixed by `computeDuration`) |
| W-MDL-EMPTY-TRACK | track with zero events | info |
| W-MDL-NO-NOTES | song with no notes at all | warn |

6.3.4.6 `computeDuration(song)`: `d = 0`; for each track: last event `e = events[len-1]`;
`d = max(d, Events.endTick(e))`; also scan backwards for notes whose `endTick` exceeds the
last event's tick (a long note followed by a cc): precisely `d = max(d, max over notes of
endTick)` which `TrackIndex.maxEnd` caches; `d = max(d, max marker.tick)`; set
`song.durationTicks = d`; return `d`. The "last event end, not last note only" rule means a
trailing CC or text event at tick 10,000 after the last note makes the duration 10,000.

6.3.4.7 `TempoMap`
- `rebuild()`: `secondsAt[0] = 0`; `secondsAt[i] = secondsAt[i-1] + (tick[i] - tick[i-1]) *
  usPerQuarter[i-1] / 1e6 / 960`.
- `ticksToSeconds(t)`: `i = last entry with tick <= t` (binary search; for `t < 0` use entry
  0, giving negative seconds for count-in); `return secondsAt[i] + (t - tick[i]) *
  usPerQuarter[i] / 1e6 / 960`.
- `secondsToTicks(s)`: `i = last entry with secondsAt <= s` (entry 0 for negative); `return
  tick[i] + (s - secondsAt[i]) * 1e6 * 960 / usPerQuarter[i]`.
- `set(tick, us)`: replace existing at same tick (last wins), else insert sorted; `rebuild()`.
- Precision: doubles; UT-03-18 asserts `abs(secondsToTicks(ticksToSeconds(t)) - t) < 1e-6`
  for ticks up to 24 h at 30 BPM.

6.3.4.8 `MeterMap`
- `ticksPerBeat = 960 * 4 / denominator`; `ticksPerBar = numerator * ticksPerBeat`.
- Each entry caches `barAtEntry` = cumulative bar index at its tick (computed in rebuild:
  `barAtEntry[i] = barAtEntry[i-1] + ceil((tick[i] - tick[i-1]) / ticksPerBar[i-1])`; a meter
  change that is not on a bar line starts a new bar at its tick, the partial bar before it
  counts as one bar).
- `barAt(t)`: entry `i` for `t`; `barAtEntry[i] + floor((t - tick[i]) / ticksPerBar[i])`; for
  `t < 0`: `-ceil(-t / ticksPerBar[0])` (count-in bars are negative).
- `beatAt(t)`: `rem = t - (tick[i] + (barAt(t) - barAtEntry[i]) * ticksPerBar[i])` adjusted for
  negatives via floor; `beat = floor(rem / ticksPerBeat)`, `frac = (rem % ticksPerBeat) /
  ticksPerBeat`.
- `tickOfBar(b)`: find the entry `i` with `barAtEntry[i] <= b` (last); `tick[i] + (b -
  barAtEntry[i]) * ticksPerBar[i]`; negative bars use entry 0.

6.3.4.9 `TrackIndex.build`: `notes = events.filter(kind === 'note')` (already sorted by tick);
`starts = Float64Array(notes.map(n => n.tick))`; `maxEnd`; `activeAt(t)`: scan back from
`firstAtOrAfter(t)` while `notes[j].tick + maxDurSeen >= t` using a precomputed running
"max duration so far" array to bound the scan; `maxPolyphony`: sweep of +1 at start, -1 at
end sorted, track the max.

#### 6.3.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Unsorted events supplied by a parser bug | `validate` E-MDL-004 | nothing loaded | n/a | no (import never touches the project) | import error "The file produced an invalid arrangement (E-MDL-004)" | n/a | discard import | UT-03-20 |
| Unmatched note-on | `pairNotes` | notes closed at track end | n/a | no | inspection warning list | n/a | n/a | UT-03-08 |
| Off before on | `pairNotes` | off dropped | n/a | no | warning | n/a | n/a | UT-03-09 |
| Pedal never released | `deriveSustain` + Scheduler voice cap | derived layer only | n/a | no | none (documented) | n/a | n/a | UT-03-14 |
| Tempo map with first entry after tick 0 | constructor | implicit 120 BPM at 0 | n/a | no | warning `W-TEMPO-IMPLICIT-START` | n/a | n/a | UT-03-17 |
| Track limit exceeded | `addTrack` throws E-MDL-010 | song unchanged | n/a | no | dialog "Projects are limited to 32 tracks" | n/a | n/a | UT-03-03 |
| Over 1,000,000 events | `validate` E-MDL-011 | nothing loaded | n/a | no | import error | n/a | discard | UT-03-21 |
| Corrupt JSON shape in `fromJSON` | type checks -> E-MDL-* | nothing loaded | n/a | no (original record untouched, M-16) | DLG per 10.6 | n/a | previous project | UT-03-22 |

#### 6.3.6 Limits and performance notes

- 32 tracks; 1,000,000 events total; 100,000 events per track (M-17 enforces for recording).
- `insertEvents` of 100k events into an empty track <= 50 ms (sort path). `pairNotes` on
  200k raw messages <= 150 ms. `ticksToSeconds` is O(log n) over tempo entries (typical n <
  200; cap 10,000 entries, excess collapsed by the importer with a warning).
- `TrackIndex` memory: one Float64Array per track plus references; rebuilt lazily.
- `Song.toJSON` for 100k events <= 200 ms (BRIEF 6), achieved by emitting events as compact
  arrays `[kindCode, tick, ...]` in the project serializer (M-15, Part 5.5); the Model's own
  `toJSON` keeps objects (used only for tests and clones).

#### 6.3.7 Spec coverage

B 9.1 (timeline, ticks, tempo maps, time signature changes, positions), B 10.5, B 15.7 (all
listed internal representation items except editing/recording state, which M-15 holds),
B 3.1 and 3.5 (events preserved exactly), E 2.3 (unmatched on/off, same-pitch overlap, pedal
never released), E 3.1 (zero-duration notes, unmatched events, velocity-0 offs, identical
pitches), E 3.2 (tempo undefined default, tempo and meter and key changes, notes across
measures, final event after last note), I 1.1 and 1.2 (one model shared by all modes; source
separate from mappings), I 16.3 (events consumable without modification), P 6.3 (timeline
authority), P 11 (tempo maps respected; polyphony preserved).

#### 6.3.8 Unit tests (group `model`, file `src/91-test-model.js`)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-03-01 | Song.create defaults | `Song.create({title:'x'})` | ppq 960; tempo 120 at 0; meter 4/4; key C major; durationTicks 0; id string |
| UT-03-02 | Track.create defaults and colors | 3 tracks | mix defaults; distinct colors from `TRACK_COLORS`; `lockedSource === true` |
| UT-03-03 | 32-track limit | add 33 | 33rd throws `E-MDL-010`; `tracks.length === 32` |
| UT-03-04 | compare ordering | mixed kinds at equal tick | order program, cc, bend, note, text; notes by channel then pitch then id |
| UT-03-05 | insertEvent keeps order | 1,000 random events inserted singly | `isSorted` true; `version` incremented 1,000 times |
| UT-03-06 | insertEvents bulk | 100k random notes | sorted; time < 50 ms (informational log, asserts order only) |
| UT-03-07 | removeEvent by id and object | 10 events | both return true; unknown returns false; order kept |
| UT-03-08 | pairNotes unmatched on | on at 0, no off, trackEndTick 3840 | one note dur 3840; warning `W-NOTE-UNMATCHED` |
| UT-03-09 | pairNotes off before on | off at 10, on at 20, off at 30 | one note (20,10); warning `W-NOTE-OFF-WITHOUT-ON` |
| UT-03-10 | pairNotes velocity 0 as off | on v100 at 0, on v0 at 480 | note dur 480, offVelocity 0 |
| UT-03-11 | pairNotes same-pitch overlap | on at 0, on at 240, off at 480, off at 600 | notes (0,240) and (240,240); `W-NOTE-OVERLAP`; stack LIFO closes the later note first then the remaining |
| UT-03-12 | pairNotes zero duration | on and off at same tick | dur 1; `W-NOTE-ZERO-DURATION` |
| UT-03-13 | pairNotes channels independent | same pitch on ch 0 and ch 1 | two notes, no overlap warning |
| UT-03-14 | deriveSustain extends | note (0,480), CC64=127 at 0, CC64=0 at 1920 | effectiveDurTicks 1920; `extendedBySustain` true; never released -> extends to track end |
| UT-03-15 | deriveSustain retrigger cap | pedal down; same pitch at 960 | first note effective end 960 |
| UT-03-16 | TempoMap conversions | entries 120 BPM at 0, 60 BPM at 1920 | `ticksToSeconds(1920) = 1.0`, `(3840) = 3.0`; `secondsToTicks(2.0) = 2880`; negative ticks map to negative seconds |
| UT-03-17 | TempoMap implicit start and last-wins | entries starting at 960; two sets at same tick | entry 0 at tick 0 with 500000; warning; second `set` replaces |
| UT-03-18 | TempoMap precision | 30 BPM, ticks up to 24 h | round trip error < 1e-6 ticks |
| UT-03-19 | MeterMap bars and beats | 4/4 then 3/4 at 3840 | `barAt(3839) = 0`, `barAt(3840) = 1`, `barAt(6720) = 2`; `beatAt(480)` = {bar 0, beat 0, frac 0.5}; `tickOfBar(2) = 6720`; `barAt(-1) = -1` |
| UT-03-20 | validate catches unsorted | push out of order | `E-MDL-004` |
| UT-03-21 | validate limits | 1,000,001 events (synthetic count via stub) | `E-MDL-011` |
| UT-03-22 | fromJSON rejects bad shapes | missing tracks; bad tempo | `E-MDL-*` thrown; valid round trip equals input |
| UT-03-23 | computeDuration uses last event end | note (0,480), cc at 10000 | durationTicks 10000; note (9000, 2000) alone -> 11000 |
| UT-03-24 | TrackIndex queries | 1,000 notes | `firstAtOrAfter`, `notesBetween`, `activeAt` agree with brute force; `maxPolyphony` correct |
| UT-03-25 | indexFor cache invalidation | index, insert, index | second index object differs; stale index not returned |
| UT-03-26 | KeyMap keyAt | C at 0, G at 1920 | `keyAt(1919).fifths = 0`, `keyAt(1920).fifths = 1` |
| UT-03-27 | Song.clone independence | clone then mutate | original unchanged; ids equal |

Note on UT-03-19: with 4/4 at 0 (3840 ticks per bar) and 3/4 from tick 3840 (2880 per bar):
`barAt(3839) = 0`, `barAt(3840) = 1`, `barAt(6720) = 2`, `tickOfBar(2) = 6720`.

#### 6.3.9 Implementation notes and browser quirks

- Use `Float64Array` for tick arrays in indexes; plain arrays of objects for events (ticks are
  integers up to 2^53, far beyond any file).
- `structuredClone` is used by `Song.clone` when present (all modern targets); fallback JSON.
- The `version` field is defined with `Object.defineProperty(track, 'version', {enumerable:
  false, writable: true})` so `JSON.stringify` skips it automatically.
- Negative ticks exist only transiently in Transport (count-in); the model never stores them;
  `validate` flags any negative tick as `E-MDL-005`.

### 6.4 M-04 Transport (`src/04-transport.js`, `FLM.Transport`)

#### 6.4.1 Responsibilities and non-goals

Responsibilities: the authoritative musical position for every mode; the state machine
`stopped | countin | playing | paused | recording`; anchoring of musical time to the audio
clock with playback speed; seek, pause, resume, stop; loop region; count-in in negative tick
space; tempo source selection (song TempoMap or override BPM); visibility policy; the
`pullDue(untilAudioTime)` cursor API consumed by `FLM.Audio.Scheduler`; deterministic
behavior under an injected clock.

Non-goals: no audio nodes (M-05), no judging (M-09), no rendering. Transport never calls
`setInterval`; it is driven by the Scheduler's tick and by explicit calls.

#### 6.4.2 Public API

```js
FLM.Transport = {
  /** One transport per app, created by M-29; tests create their own with a FakeClock. */
  create(opts /* {clock:{now():seconds}, bus:Emitter} */) /* -> Transport */,
  STATES: ['stopped', 'countin', 'playing', 'paused', 'recording'],

  // Transport instance
  // --- binding ---
  /** Binds a song (or null). Resets position to 0, state to 'stopped', clears loop. */
  load(song /* Song|null */, opts /* ?{tempoSource:'song'|'override', overrideBpm:number} */) /* -> void */,
  song() /* -> Song|null */,
  setTempoSource(source /* 'song'|'override' */, overrideBpm /* ?number 20..300 */) /* -> void */,
  tempoMap() /* -> TempoMap in effect */,
  meterMap() /* -> MeterMap (song's or the override meter) */,
  setOverrideMeter(numerator, denominator) /* -> void (Free Play / Studio without song meter) */,

  // --- state machine ---
  state() /* -> string */,
  /** From stopped or paused. countInBars 0|1|2. Returns false if no song bound. */
  play(opts /* ?{countInBars:number, fromTick:number} */) /* -> boolean */,
  /** From stopped or paused; like play but final state 'recording'; recording starts at tick 0 of the take. */
  record(opts /* ?{countInBars:number, fromTick:number} */) /* -> boolean */,
  pause() /* -> boolean (only from countin, playing, recording) */,
  resume() /* -> boolean (only from paused; re-anchors at audioNow + 0.05) */,
  stop() /* -> void (any state -> stopped; position returns to stopTick, see 6.4.4.3) */,
  seek(tick /* integer >= 0 */) /* -> void (allowed in every state) */,
  setSpeed(speed /* 0.25..2.0 */) /* -> void */, speed() /* -> number */,
  setLoop(region /* {a:tick, b:tick} with a < b, or null */) /* -> void */, loop() /* -> region|null */,
  setLoopEnabled(flag) /* -> void */, loopEnabled() /* -> boolean */,
  setCountInBars(n /* 0|1|2 */) /* -> void */, countInBars() /* -> number */,

  // --- clocks and position ---
  /** Musical position (ticks, float, may be negative in countin) at an audio time. */
  positionAt(audioTime) /* -> number ticks */,
  tickAt(audioTime) /* alias of positionAt */,
  /** Audio time at which a tick will sound under the current anchor (future or past). */
  audioTimeAt(tick) /* -> seconds */,
  /** Convenience: positionAt(clock.now()) when running; frozen tick when paused/stopped. */
  position() /* -> ticks */,
  positionSeconds() /* -> song seconds (tempo-map seconds, not audio seconds) */,
  anchor() /* -> {audioTime, songSeconds, speed, tick} copy of the current anchor */,

  // --- scheduler cursor ---
  /** Returns every due item with tick-derived audio times in (lastPulled, untilAudioTime],
   *  advancing the cursor. Handles count-in clicks, metronome clicks, loop wraps, song end. */
  pullDue(untilAudioTime) /* -> DueItem[] */,
  // DueItem =
  //   {kind:'note',  track, event:NoteEvent, atAudio, endAudio /* clamped to loop end */, trackIndex}
  // | {kind:'cc'|'program'|'bend', track, event, atAudio}
  // | {kind:'click', atAudio, accent:boolean, bar, beat, countIn:boolean}
  // | {kind:'loopWrap', atAudio, fromTick:b, toTick:a}
  // | {kind:'end', atAudio}                 // song end reached (no loop): state -> stopped
  // | {kind:'start', atAudio}               // emitted once when tick 0 is crossed after count-in
  setMetronome(opts /* {enabled:boolean, countInOnly:boolean} */) /* -> void */,
  /** Called by the Scheduler each tick before pullDue; performs state auto-transitions
   *  (countin -> playing/recording when tick 0 is reached; end-of-song stop). */
  update(audioNow) /* -> void */,

  // --- held-note info for UI ---
  /** Source notes active at the current position across visible tracks (for HUD on pause). */
  activeNotesAt(tick /* ?number */) /* -> Array<{track, event}> */,

  // --- interruptions ---
  /** 'pause' (gameplay modes) or 'continue' (studio, free play). Set by M-28 on mode enter. */
  setVisibilityPolicy(policy) /* -> void */,
  /** Called by M-28 on visibilitychange/pagehide. */
  onHidden(audioNow, perfNow) /* -> void */, onVisible(audioNow, perfNow) /* -> {drifted:boolean, driftMs:number} */,

  dispose() /* -> void */
};
```

Events emitted (via the bus passed at creation):

| Topic | Payload | When |
|---|---|---|
| `transport.state` | `{from, to, tick, audioTime}` | every state change |
| `transport.seek` | `{fromTick, toTick, audioTime}` | `seek()` and loop wraps |
| `transport.loop` | `{a, b, atAudio, passIndex}` | each wrap (passIndex increments from 1) |
| `transport.speed` | `{speed}` | `setSpeed` |
| `transport.tempoSource` | `{source, bpm}` | `setTempoSource` |
| `transport.end` | `{tick, atAudio}` | end of song without loop |

Events consumed: none (M-28 calls `onHidden`/`onVisible` directly).

#### 6.4.3 Internal state

```js
{
  clock, bus, song: Song|null,
  state: 'stopped',
  speed: 1.0,
  tempoSource: 'song', overrideBpm: 120, overrideMeter: {numerator:4, denominator:4},
  anchor: { audioTime: 0, songSeconds: 0 },      // songSeconds = tempoMap.ticksToSeconds(anchorTick)
  frozenTick: 0,                                 // position while paused or stopped
  stopTick: 0,                                   // where stop() returns to (play start or last seek while stopped)
  countIn: { bars: 1, ticks: 0, active: false }, // ticks = bars * ticksPerBar(meterAt(0))
  loop: { a: 0, b: 0, enabled: false, passIndex: 0 },
  cursors: Array<number>  /* per track: index of next event in track.events */,
  clickCursor: { nextTick: number },             // next metronome click tick (beat grid)
  lastPulledAudio: number,                       // exclusive lower bound for pullDue
  startEmitted: boolean,
  metronome: { enabled: false, countInOnly: true },
  visibility: { policy: 'pause', hiddenAt: null },
  indexes: Map<trackId, TrackIndex>              // from Model.indexFor
}
```

Invariants: `anchor` is only rewritten by `reanchor(tick, audioTime)`; `frozenTick` is
meaningful only in `stopped` and `paused`; every cursor index satisfies `events[cursor-1].tick
< positionTick <= events[cursor].tick` after `pullDue`; `lastPulledAudio` never decreases
except through `reanchor`, which resets it to the new anchor audio time.

#### 6.4.4 Algorithms

6.4.4.1 Anchoring math
```text
tempoMap  = tempoSource == 'override' ? TempoMap.fromBpm(overrideBpm) : song.tempoMap
reanchor(tick, audioTime):
  anchor.audioTime = audioTime; anchor.songSeconds = tempoMap.ticksToSeconds(tick)
  lastPulledAudio = audioTime; rebuildCursors(tick)
positionAt(t)   = tempoMap.secondsToTicks(anchor.songSeconds + (t - anchor.audioTime) * speed)
audioTimeAt(k)  = anchor.audioTime + (tempoMap.ticksToSeconds(k) - anchor.songSeconds) / speed
```
Speed multiplies elapsed audio seconds into song seconds; the TempoMap is never modified by
speed (ADR-05). Negative ticks (count-in) convert through entry 0 of the tempo map.

6.4.4.2 State machine (states x actions -> next state; side effects)

| State | play | record | pause | resume | stop | seek(k) | setSpeed | setLoop |
|---|---|---|---|---|---|---|---|---|
| stopped | countin if bars > 0 else playing; `startRun('playing')` | countin or recording; `startRun('recording')` | ignored (false) | ignored (false) | stays; `frozenTick = stopTick` | `frozenTick = stopTick = k`; emit seek | set speed (no anchor) | set region |
| countin | ignored | ignored | paused; `frozenTick = positionAt(now)` (may be negative; resume continues count-in) | ignored | stopped; `frozenTick = stopTick` | aborts count-in: `reanchor(k, now + 0.05)`, state playing/recording per `runTarget` | reanchor at current tick | set region |
| playing | ignored | ignored | paused; `frozenTick = positionAt(now)`; emit | ignored | stopped | `reanchor(k, now + 0.05)`; emit seek | capture tick, set speed, reanchor | set region; if position outside [a,b) nothing else |
| paused | resumes (same as resume) | if `runTarget` was recording: resume; else ignored | ignored | `reanchor(frozenTick, now + 0.05)`; state = runTarget (`playing` or `recording`, or `countin` when frozenTick < 0); emit | stopped | `frozenTick = k`; emit seek | set speed | set region |
| recording | ignored | ignored | paused (recording pauses; M-17 keeps the take open) | ignored | stopped (M-17 closes held notes at `positionAt(now)`) | `reanchor(k, now + 0.05)`; emit seek; M-17 is notified via `transport.seek` and ends the take segment | reanchor | set region |

`startRun(target)`:
1. `runTarget = target`; `startTick = opts.fromTick ?? frozenTick`; `stopTick = startTick`.
2. `countIn.ticks = countIn.bars * meterMap.meterAt(startTick).ticksPerBar`; if `countIn.bars
   > 0`: state `countin`, `reanchor(startTick - countIn.ticks, now + 0.05)`, `startEmitted =
   false`; else state `target`, `reanchor(startTick, now + 0.05)`, `startEmitted = true`.
3. Emit `transport.state`.

Every side-effecting transition emits `transport.state` with `{from, to, tick, audioTime}`.
Seek while running performs a soft panic indirectly: the Scheduler listens to
`transport.seek` and calls `Audio.panic(false)` before continuing (6.5.4.4). Pause likewise.

6.4.4.3 `stop()`: `frozenTick = stopTick`; state `stopped`; `loop.passIndex = 0`; emit. Stop
returns to where play started (or the last seek made while stopped), matching DAW
convention; Studio's "return to zero" is `seek(0)` while stopped.

6.4.4.4 Count-in: during `countin` the position is negative. `pullDue` emits only `click`
items (accent on beat 0 of each count-in bar, `countIn: true`) and no track events. When
`update(audioNow)` observes `positionAt(audioNow + lookahead) >= 0` it does not change the
anchor (continuous time) but switches state to `runTarget` exactly when `positionAt(audioNow)
>= 0`, emitting `transport.state {from:'countin', to:runTarget}` and a `start` DueItem at
`audioTimeAt(0)` on the next `pullDue`. Recording (M-17) uses the `start` item's `atAudio`
as the take's time origin, so recorded ticks are relative to tick 0 of the song.

6.4.4.5 Loop rules (region `[a, b)`, `a < b`, both multiples of 1 tick; the UI snaps to beats)
- When `loop.enabled` and the run is in `playing` or `recording` and `positionAt(until) >= b`
  during `pullDue`: `wrapAudio = audioTimeAt(b)`; emit items up to `wrapAudio` only; push
  `{kind:'loopWrap', atAudio: wrapAudio, fromTick: b, toTick: a}`; `loop.passIndex++`;
  `reanchor(a, wrapAudio)` (so tick `a` sounds exactly at `wrapAudio`; no gap); emit
  `transport.loop` and `transport.seek`; continue pulling from `a` until `until`.
- Notes starting before `b` and ending after `b`: their `endAudio` is clamped to `wrapAudio`
  (the Scheduler releases them there).
- Notes starting before `a` whose span covers `a` are NOT retriggered at the wrap: cursors are
  rebuilt to the first event with `tick >= a`.
- An event exactly at tick `b` is outside the half-open region: events with `tick === b` are
  never emitted while looping; when the user disables the loop they play normally.
- An event exactly at tick `a` plays at `wrapAudio` on every pass.
- `setLoop` while the position is outside `[a, b)` does nothing immediate; the wrap applies
  when `b` is reached; if the position is beyond `b` the song continues to its end.
- A loop shorter than one lookahead window (120 ms) is clamped: `b - a >= ticks of 0.25 s at
  the current tempo`, enforced by `setLoop` (throws `E-TRN-001` with message "Loop region is
  too short").

6.4.4.6 `pullDue(until)`
```text
items = []
if state not in {countin, playing, recording}: return items
from = lastPulledAudio
guard: if until <= from return items
loop while true:
  tickUntil = positionAt(until)
  wrapping = loop.enabled && state != 'countin' && tickUntil >= loop.b && positionAt(from) < loop.b
  limitTick = wrapping ? loop.b : tickUntil
  // 1. clicks
  if metronome.enabled && (state == 'countin' || !metronome.countInOnly):
     while clickCursor.nextTick < limitTick:
        at = audioTimeAt(clickCursor.nextTick); if at > from: items.push(click(at, beatInfo(clickCursor.nextTick)))
        clickCursor.nextTick += ticksPerBeat at that tick
  // 2. start marker
  if !startEmitted && state != 'countin' && positionAt(from) < 0 <= limitTick: items.push({kind:'start', atAudio: audioTimeAt(0)}); startEmitted = true
  // 3. track events
  if state != 'countin':
     for each track i (skipping track.mute is NOT done here; Audio decides audibility):
        ev = track.events; c = cursors[i]
        while c < ev.length && ev[c].tick < limitTick:
           e = ev[c]; at = audioTimeAt(e.tick)
           if at > from:   // strictly after the last pull
              if e.kind == 'note': endTick = e.tick + e.durTicks; endAudio = audioTimeAt(endTick)
                 if wrapping: endAudio = min(endAudio, audioTimeAt(loop.b))
                 items.push({kind:'note', track, event:e, atAudio:at, endAudio, trackIndex:i})
              else items.push({kind:e.kind, track, event:e, atAudio:at})
           c++
        cursors[i] = c
  if wrapping:
     wrapAudio = audioTimeAt(loop.b)
     items.push({kind:'loopWrap', atAudio: wrapAudio, fromTick: loop.b, toTick: loop.a})
     loop.passIndex++; reanchor(loop.a, wrapAudio); emit transport.loop, transport.seek
     from = wrapAudio; continue      // pull the rest of the window from the new anchor
  break
// 4. song end
if !loop.enabled && state in {playing} && song && tickUntil >= song.durationTicks && lastPulledAudio < audioTimeAt(song.durationTicks):
   items.push({kind:'end', atAudio: audioTimeAt(song.durationTicks)})
lastPulledAudio = until
sort items by atAudio (stable); return items
```
`update(audioNow)`: handles `countin -> runTarget` (6.4.4.4) and, when an `end` item was
produced and `audioNow >= end.atAudio + 0.05`, performs `stop()` and emits `transport.end`.
In `recording` the song end does not stop the run (the take may extend the song).

6.4.4.7 Speed change while running: `tick = positionAt(now)`; `speed = clamp(v, 0.25, 2)`;
`reanchor(tick, now)`; emit `transport.speed`. Already-scheduled audio in the 120 ms
lookahead keeps its old timing (accepted; the Scheduler does not unschedule).

6.4.4.8 Tempo source: `setTempoSource('override', bpm)` rebuilds the effective map and
re-anchors at the current tick so the position is continuous; Free Play and new Studio
projects use `'override'`; imported songs use `'song'`; Studio switches to `'song'` when the
project song has more than one tempo entry (M-17 decides and calls this).

6.4.4.9 Visibility
- `onHidden(audioNow, perfNow)`: store `hiddenAt = {audio: audioNow, perf: perfNow, tick:
  positionAt(audioNow)}`; if `policy === 'pause'` and state in `{countin, playing,
  recording}`: `pause()` (M-28 shows SCR-Pause on return).
- `onVisible(audioNow, perfNow)`: if no `hiddenAt` return `{drifted:false, driftMs:0}`.
  `dAudio = audioNow - hiddenAt.audio`, `dPerf = (perfNow - hiddenAt.perf) / 1000`, `driftMs
  = (dPerf - dAudio) * 1000`. Under `'continue'` while running: if `abs(driftMs) > 5`: log
  `W-TRANSPORT-DRIFT {driftMs, dAudio, dPerf}` and `reanchor(positionAt(audioNow), audioNow +
  0.05)` which also sets `lastPulledAudio` forward so events that fell due while hidden are
  skipped rather than fired in a burst (Studio users hear playback jump to "now" in song time
  as derived from the audio clock, which is the master). Clear `hiddenAt`. Return the result.

6.4.4.10 Fake clock: `create({clock: {now: () => t}})`; tests advance `t` and call `update`
and `pullDue` manually; all time reads inside Transport go through `clock.now()`, and there
are none outside `play/record/pause/resume/seek/setSpeed/update/position` (checked by review
and UT-04-25).

#### 6.4.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Action invalid in current state | table 6.4.4.2 returns false | state unchanged | n/a | no | UI buttons are disabled per state; no message | n/a | n/a | UT-04-02 |
| `seek` out of range | clamp to `[0, durationTicks]` and log | position valid | n/a | no | none | n/a | n/a | UT-04-09 |
| Loop region invalid | `setLoop` throws `E-TRN-001` | loop unchanged | user adjusts | no | toast "Loop region is too short" | n/a | n/a | UT-04-14 |
| Audio clock stalls (context suspended) | `Scheduler` notices `now` unchanged across 3 ticks and emits `audio.state`; M-28 pauses via policy | anchor valid | resume | no | DLG-ResumeAudio | paused | resume re-anchors | UT-04-23 |
| Tab hidden long under 'continue' | `onVisible` drift > 5 ms | anchor re-set | n/a | recording: M-17 closes held notes at hide time | log; Studio shows toast "Playback re-synced after background" | n/a | automatic | UT-04-22 |
| Song replaced while running | `load()` forces stop first | stopped | n/a | no | n/a | n/a | n/a | UT-04-01 |
| Tempo map with zero entries | Model guarantees default; Transport asserts | default 120 | n/a | no | n/a | n/a | n/a | UT-04-03 |
| Cursor desync after external event mutation | `track.version` check in `update` triggers `rebuildCursors(positionAt(now))` | playback continues | n/a | no | n/a | n/a | automatic | UT-04-24 |

#### 6.4.6 Limits and performance notes

- `pullDue` is called 40 times per second; cost is O(tracks + items). With 32 tracks and
  1,000 notes per second it processes about 25 items per call.
- `rebuildCursors(tick)` is O(tracks x log n) via `TrackIndex.eventsAtOrAfter`.
- Speed range 0.25..2.0; count-in 0..2 bars; loop minimum 0.25 s; `durationTicks` up to
  2^40 (no practical limit).
- Drift budget: the anchor is exact arithmetic on the audio clock; `abs drift < 2 ms after
  10 min loop` (BRIEF 6) is met by construction because each wrap re-anchors to
  `audioTimeAt(b)` computed from the previous anchor, never from `now`. TT tests verify.

#### 6.4.7 Spec coverage

B 7.5 (slow down/speed up, seek, loop, pause/resume without drift), B 9.1 (song position,
loop regions, count-in, pause/resume, seeking, speed), B 9.2 (audio clock authority; render
loop estimates position), B 16.2 steps 3-5 (count-in, metronome, recording start), B 19.2
(transport controls the authoritative position), B 21.4 (interruptions: pause policy), E 2.2
(all twelve cases: tempo changes, pause during sustain, seek with active notes, loop boundary
during sustain, speed change, clock divergence, event exactly on loop boundary, identical
timestamps), E 5.1 (recording starts before count-in finishes: recording state begins at tick
0; recording while playback runs: `record()` from `playing` is ignored, M-17 uses the overdub
path by starting in `recording` from stopped or paused), I 1.1, I 1.3, I 6.3 (loop, slow
playback, restart from section via `seek`), P 6.3 (pause/resume do not shift the song; seeking
reconciles scheduled events; loop boundaries and sustained notes; backgrounding), P 10
(count-in behavior).

#### 6.4.8 Unit tests (group `transport`, file `src/91-test-transport.js`; all use a FakeClock
and a 2-track synthetic song: track 0 notes every beat at 120 BPM for 8 bars, track 1 a
CC and a 2-bar note)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-04-01 | load resets | load song while playing | state stopped; position 0; loop cleared; `transport.state` emitted |
| UT-04-02 | invalid actions ignored | pause in stopped; resume in playing | both return false; no state event |
| UT-04-03 | default tempo without song entries | song with default map | `positionAt(anchor + 1 s) = 1920` |
| UT-04-04 | play anchors 50 ms ahead | clock 10.0; play with 0 bars | `audioTimeAt(0) = 10.05`; state playing |
| UT-04-05 | positionAt / audioTimeAt inverse | random ticks | `positionAt(audioTimeAt(k))` within 1e-6 of k |
| UT-04-06 | speed math | speed 0.5 at tick 1920 | one audio second later position is 2880; TempoMap unchanged |
| UT-04-07 | pause freezes and resume re-anchors | play, advance 1.3 s, pause, advance 5 s, resume at clock 20 | position frozen at 2496; after resume `audioTimeAt(2496) = 20.05`; no drift in `positionAt(21.05) = 4416` |
| UT-04-08 | seek while playing | seek 3840 at clock 5 | `audioTimeAt(3840) = 5.05`; `transport.seek` payload fromTick/toTick correct; cursors at first event >= 3840 |
| UT-04-09 | seek clamps | seek -10, seek 10^9 | 0 and durationTicks; logged |
| UT-04-10 | stop returns to stopTick | seek 1920 stopped, play, advance, stop | position 1920 |
| UT-04-11 | count-in clicks only | 1 bar count-in, metronome enabled | first `pullDue` window contains 4 clicks with `countIn:true`, accent on first, no notes; position negative |
| UT-04-12 | count-in to playing transition and start item | advance across tick 0 | state becomes playing when `positionAt(now) >= 0`; one `start` item at `audioTimeAt(0)`; note at tick 0 emitted exactly once |
| UT-04-13 | pause during count-in resumes count-in | pause at tick -960, resume | state countin again; reaches playing later; no duplicate start |
| UT-04-14 | setLoop validation | a >= b; too short | throws `E-TRN-001`; valid region accepted |
| UT-04-15 | loop wrap item and re-anchor | loop [0, 3840) at 120 BPM | wrap at `audioTimeAt(3840)`; after wrap `audioTimeAt(0) === wrapAudio`; `transport.loop.passIndex` 1 then 2; `transport.seek` emitted |
| UT-04-16 | loop clamps sustained notes | 2-bar note starting at 1920, loop [0, 3840) | item `endAudio === wrapAudio` |
| UT-04-17 | loop does not retrigger notes before a | loop [1920, 3840), note at 960 with dur 1920 | after wrap no item for the tick-960 note |
| UT-04-18 | event exactly at b | note at 3840, loop [0, 3840) | never emitted while looping; emitted after `setLoopEnabled(false)` |
| UT-04-19 | event exactly at a | note at 0 | emitted at `wrapAudio` on each pass |
| UT-04-20 | ten-minute loop drift | loop of 1 bar, advance clock in 25 ms steps for 600 s | `abs(audioTimeAt(0 at pass n) - (start + n*2.0)) < 0.002` for the final pass; pass count 300 |
| UT-04-21 | pullDue never returns items beyond until or at or before from | random windows | all `atAudio` in `(from, until]`; monotonic across calls; no duplicates by event id |
| UT-04-22 | visibility continue drift re-anchor | hide; advance perf 10 s and audio 3 s; show | `drifted:true`, `driftMs ~ 7000`; `lastPulledAudio = now + 0.05`; no burst of items |
| UT-04-23 | visibility pause policy | policy pause; hide while playing | state paused; `onVisible` keeps paused |
| UT-04-24 | cursor rebuild on track mutation | insert a note earlier than the cursor during playback; `update` | note not emitted (past) but no exception; a later inserted note is emitted |
| UT-04-25 | fake clock determinism | run the same script twice | identical item sequences (JSON equal) |
| UT-04-26 | tempo source override | override 60 BPM at tick 1920 | continuity: position unchanged at switch; one second later +960 ticks |
| UT-04-27 | end of song | advance past durationTicks | `end` item; after +50 ms `stop()` applied; `transport.end` emitted; in recording no stop |
| UT-04-28 | setSpeed while paused | pause, setSpeed 2, resume | resume anchor correct; 1 s later +3840 |

#### 6.4.9 Implementation notes and browser quirks

- `AudioContext.currentTime` advances in render-quantum steps (128 samples, about 2.9 ms at
  44.1 kHz); the 50 ms resume/seek margin plus the 120 ms lookahead make this irrelevant.
- When the audio context is `suspended` (iOS after a phone call), `currentTime` stops;
  Transport does not detect this itself (no timers), the Scheduler does (6.5.4.3).
- Floating point: `positionAt` returns floats; consumers that need integers round with
  `Math.round` (Recorder) or `Math.floor` (HUD bar display). The Judge never uses ticks; it
  compares audio seconds.
- Keep `pullDue` allocation-light: reuse the `items` array per call is NOT done (callers keep
  references); instead allocate a fresh array (40 per second is negligible).

### 6.5 M-05 Audio (`src/05-audio.js`, `FLM.Audio`)

#### 6.5.1 Responsibilities and non-goals

Responsibilities: `AudioContext` lifecycle (creation after a gesture, unlock, suspend and
resume handling, re-unlock prompt); the bus graph (master gain -> limiter -> destination,
metronome bus, per-track `ChannelStrip` with gain, pan, mute, solo); the `VoiceAllocator`;
the lookahead `Scheduler` that turns `Transport.pullDue` items into instrument calls and
`sched.*` events; `panic(hard)`; metronome click synthesis; latency estimate; click-free
ramps; the peak meter; an injectable context for `OfflineAudioContext` tests.

Non-goals: no synthesis recipes (M-06 builds voices and connects them to strips), no
judging, no persistence. The Scheduler does not know charts or input.

#### 6.5.2 Public API

```js
FLM.Audio = {
  /** Creates the engine object. ctx may be injected (OfflineAudioContext in tests). */
  createEngine(opts /* ?{context:BaseAudioContext, clock:{now()}, bus:Emitter, mobile:boolean} */) /* -> Engine */,
  /** The app-wide engine (created by M-29 before the unlock gesture, context created lazily). */
  engine /* Engine|null */,
  LIMITER: { threshold: -6, knee: 6, ratio: 12, attack: 0.003, release: 0.25 },
  LOOKAHEAD_S: 0.120, TICK_MS: 25, RAMP_S: 0.005, SOFT_PANIC_S: 0.030,
  START_FADE_S: 0.020, STOP_FADE_S: 0.030, VOICE_MAX_S: 60,

  // Engine instance
  /** Must be called inside a user gesture handler. Creates the context on first call.
   *  Resolves {ok, state, reason?}. Idempotent; never creates a second context. */
  unlock() /* -> Promise<{ok:boolean, state:string, reason?:string}> */,
  resume() /* -> Promise<boolean> */,
  context() /* -> BaseAudioContext|null */,
  state() /* -> 'none'|'suspended'|'running'|'closed'|'interrupted' */,
  now() /* -> context.currentTime or 0 */,
  latency() /* -> {seconds:number, estimated:boolean, base:number, output:number} */,
  sampleRate() /* -> number */,

  // --- bus graph ---
  master /* GainNode */, limiter /* DynamicsCompressorNode */, metronomeBus /* GainNode */,
  setMasterVolume(v /* 0..1 */), masterVolume(), setMetronomeVolume(v), metronomeVolume(),
  /** Creates (or returns) the strip for a track id. */
  strip(trackId) /* -> ChannelStrip */, removeStrip(trackId) /* -> void */, strips() /* -> ChannelStrip[] */,
  /** Solo set semantics: any solo -> every non-solo strip is silenced. */
  setSolo(trackId, flag), setMute(trackId, flag), soloSet() /* -> Set<string> */,
  // ChannelStrip { trackId, input:GainNode /* voices connect here */, gain:GainNode, pan:StereoPannerNode|PannerNode,
  //                muteGain:GainNode, setGain(v, at?), setPan(p, at?), setMute(flag), setSolo(flag),
  //                effectiveMuted() /* -> boolean */, setExpression(v /* 0..1, CC11 */), setVolumeCC(v /* 0..1, CC7 */),
  //                dispose() }

  // --- voices ---
  voices /* VoiceAllocator */,
  // VoiceAllocator { capacity /* 64 desktop, 32 mobile, or setting */, activeCount(), releasedCount(),
  //   /** Returns a VoiceSlot or steals one; never returns null. */
  //   acquire(owner /* {trackId, channel, pitch, priority:0..2} */, atAudio) /* -> VoiceSlot */,
  //   markReleased(slot, atAudio, releaseEndAudio), free(slot), releaseAll(atAudio, rampS), stopAll(),
  //   setCapacity(n), list() /* -> VoiceSlot[] (diagnostics) */ }
  // VoiceSlot { id, owner, voice /* M-06 Voice */, startedAt, releasedAt:null|number, state:'active'|'released'|'free',
  //             levelAt(t) /* envelope estimate 0..1 */ }

  // --- scheduler ---
  scheduler /* Scheduler */,
  // Scheduler { start(transport), stop(), running(), tickOnce(audioNow) /* tests */, stats() -> {ticks, stalls, maxLateMs, scheduled},
  //             setInstruments(instr /* FLM.Instruments */), liveNoteOn(trackId, pitch, velocity, channel, atAudio), liveNoteOff(...),
  //             liveControl(trackId, kind, event, atAudio) }

  /** soft: release all voices with a 30 ms ramp. hard: stop every node and rebuild the graph. */
  panic(hard /* boolean */) /* -> void */,
  metronome /* { click(atAudio, accent) } */,
  peak() /* -> {peak:number 0..1+, clip:boolean, holdPeak:number} */,
  /** Fade master to 0 over STOP_FADE_S then back to volume over START_FADE_S on next start. */
  fadeOut(atAudio), fadeIn(atAudio),
  dispose() /* -> void (closes context) */
};
```

Events emitted:

| Topic | Payload | When |
|---|---|---|
| `audio.state` | `{state, previous, reason}` | context `statechange`, unlock result, stall detection |
| `audio.unlocked` | `{sampleRate, baseLatency, outputLatency}` | first successful `unlock()` |
| `audio.voices` | `{active, released, capacity, stolen}` | once per second while the scheduler runs |
| `audio.panic` | `{hard, releasedCount}` | `panic()` |
| `sched.noteOn` | `{trackId, noteId, pitch, velocity, channel, atAudio, endAudio, tick, durTicks, live:boolean}` | each scheduled note |
| `sched.noteOff` | `{trackId, noteId, pitch, atAudio, live}` | each scheduled release |
| `sched.control` | `{trackId, kind, controller?, value, atAudio}` | cc/program/bend scheduled |
| `sched.click` | `{atAudio, accent, bar, beat, countIn}` | metronome |
| `sched.stall` | `{lateMs, items}` | catch-up after a stall |

Events consumed: `transport.seek` and `transport.state` (soft panic on seek, pause, stop;
fade in on play/resume); `settings.changed` for `audio.masterVolume`, `audio.metronomeVolume`,
`audio.polyphonyCap`.

#### 6.5.3 Internal state

- `ctx` (null until unlock), `unlocking` promise (dedupes concurrent unlock calls), `created`
  flag (a second `createContext` attempt is refused, `E-AUD-003`).
- Graph nodes: `master`, `limiter`, `analyser` (fftSize 1024, connected from `master` in
  parallel, not in the signal path), `metronomeBus`, `strips: Map<trackId, ChannelStrip>`,
  `soloSet: Set<trackId>`.
- `VoiceAllocator`: `slots: VoiceSlot[]` fixed length `capacity`; `freeList`; `stolen`
  counter.
- `Scheduler`: `intervalId` (via `Core.Timers`), `transport`, `instruments`, `lastNow`,
  `sameNowCount` (stall detection), `pending: Map<noteKey, {slot, endAudio}>` for scheduled
  releases, `stats`.
- Mix state cache per strip (`gainValue`, `panValue`, `mute`, `solo`, `ccVolume`,
  `expression`) so that a hard panic can rebuild nodes with identical settings.
- Peak: `Float32Array(1024)` scratch, `holdPeak` with 500 ms decay.

Invariants: exactly one `AudioContext` per page; every voice node chain is connected to a
strip `input` and nothing else; after `panic(true)` `voices.activeCount() === 0` and
`strips.size` is unchanged; `master.gain` never exceeds `masterVolume`.

#### 6.5.4 Algorithms

6.5.4.1 Unlock flow (`unlock()`), run inside a `pointerup`/`keydown`/`click` handler (M-29):
1. If `unlocking` return it. If `ctx` is null: `Ctor = window.AudioContext or
   window.webkitAudioContext`; `ctx = new Ctor({latencyHint: 'interactive'})` (no sampleRate
   option; the device rate is used). Build the graph (6.5.4.2). Attach `ctx.onstatechange`.
2. `await ctx.resume()` (ignore rejection; inspect `ctx.state`).
3. iOS kick: create a 1-frame silent `AudioBuffer`, `AudioBufferSourceNode`, connect to
   `destination`, `start(0)`; this is needed on iOS Safari to transition from
   `interrupted`/`suspended` reliably.
4. If `ctx.state === 'running'`: emit `audio.unlocked` once; resolve `{ok:true, state}`.
   Otherwise resolve `{ok:false, state, reason:'E-AUD-002'}` (UI shows DLG-AudioBlocked with a
   "Tap to enable sound" button that calls `unlock()` again).
5. `onstatechange`: emit `audio.state {state, previous}`; if the new state is `suspended` or
   `interrupted` (Safari) while the Scheduler runs: emit with `reason:'suspended'`; M-28
   pauses the transport (per mode policy) and the UI shows DLG-ResumeAudio whose button calls
   `resume()`; on `running` after a resume the Scheduler continues (transport was paused, so
   nothing is overdue).

6.5.4.2 Bus graph build
```text
master = ctx.createGain(); master.gain.value = masterVolume
limiter = ctx.createDynamicsCompressor(); set threshold -6, knee 6, ratio 12, attack 0.003, release 0.25
master.connect(limiter); limiter.connect(ctx.destination)
analyser = ctx.createAnalyser(); analyser.fftSize = 1024; master.connect(analyser)
metronomeBus = ctx.createGain(); metronomeBus.gain.value = metronomeVolume; metronomeBus.connect(master)
ChannelStrip(trackId):
  input -> gain -> pan -> muteGain -> master
  gain.gain = gainValue * ccVolume * expression   (recomputed by applyGain(at) with a 5 ms ramp)
  pan: ctx.createStereoPanner() if available else PannerNode with panningModel 'equalpower',
       positionX = p, positionY = 0, positionZ = 1 - abs(p)
  muteGain.gain = effectiveMuted() ? 0 : 1  (ramped 5 ms)
```
Solo semantics: `effectiveMuted = mute || (soloSet.size > 0 && !soloSet.has(trackId))`.
`setSolo` and `setMute` recompute `muteGain` for every strip. Muting while a note sustains
ramps the strip to silence in 5 ms; voices keep running until their release (P 6.2: no
notes left behind because the voices end normally; a muted strip still counts voices, which
is why `panic(false)` is also wired to M-17's "delete track").

6.5.4.3 Scheduler tick (every 25 ms via `Core.Timers.setInterval`, owner = engine)
```text
tick():
  now = ctx.currentTime
  if now == lastNow: sameNowCount++ ; if sameNowCount == 3: emit audio.state {state: ctx.state, reason:'stalled'} ; return
  else sameNowCount = 0; lastNow = now
  transport.update(now)
  horizon = now + LOOKAHEAD_S
  items = transport.pullDue(horizon)
  late = 0
  for item in items (sorted by atAudio):
    at = item.atAudio
    if at < now + 0.005: late = max(late, (now + 0.005 - at) * 1000); at = now + 0.005
    switch item.kind:
      'note':    scheduleNote(item, at)
      'cc','program','bend': instruments.control(item.track, item.event, at); emit sched.control
      'click':   metronome.click(at, item.accent); emit sched.click
      'loopWrap': releaseAllActive(at)   // every voice started by the scheduler is released at the wrap (end clamp already applied to notes crossing b; this is the safety net)
      'start':   fadeIn(at)
      'end':     fadeOut(at)
  if late > 1: stats.stalls++; stats.maxLateMs = max(...); emit sched.stall {lateMs: late, items: items.length}; Log.warn('sched', 'stall catch-up', {late})
  stats.ticks++; stats.scheduled += items.length
  every 40 ticks: emit audio.voices
scheduleNote(item, at):
  end = max(item.endAudio, at + 0.010)            // minimum audible 10 ms
  end = min(end, at + VOICE_MAX_S)                // 60 s cap (pedal never released, E 2.3)
  if strip(item.track.id).effectiveMuted() and not item.track.visible: still schedule (mute is audibility only, animation needs the event)
  slot = instruments.noteOn(item.track, item.event, at, end)     // M-06 acquires a voice through voices.acquire
  emit sched.noteOn {..., atAudio: at, endAudio: end, live:false}
  // M-06 schedules the release itself (voice.release(end)); the scheduler only records for panic
  pending.set(item.event.id, {slot, endAudio: end}); timers are not used for releases
  emit sched.noteOff {..., atAudio: end} immediately (consumers that animate use the audio time, not arrival)
```
Note: `sched.noteOff` is emitted at scheduling time with the future `atAudio`; animation
(M-20) and HUD consumers compare against `Transport.positionAt`/audio time. This avoids a
timer per note. The Scheduler never schedules beyond `horizon`; a dense chord with 200 notes
at one tick is 200 `noteOn` calls in one tick (M-06 bounds the cost by voice capacity).

Live input path (Free Play and Studio recording): `liveNoteOn(trackId, pitch, velocity,
channel, atAudio)` calls `instruments.noteOnLive(...)` at `max(atAudio, now + 0.002)` and
emits `sched.noteOn {live:true}`; `liveNoteOff` releases the live voice for that
`(trackId, channel, pitch)` key (CC64 live sustain handled in M-06).

6.5.4.4 Panic
- `panic(false)` (soft): `t = now`; `voices.releaseAll(t, SOFT_PANIC_S)` (each voice's
  `release(t)` with a 30 ms ramp override), `pending.clear()`, emit `audio.panic
  {hard:false}`. Wired to: `transport.seek`, `transport.state` to `paused` or `stopped`,
  M-28 mode leave (step 2 of 4.7), the UI panic key.
- `panic(true)` (hard): `voices.stopAll()` (every voice `stop(now)` then `dispose()`); for
  each strip: disconnect and dispose nodes; `master.disconnect()`, `limiter.disconnect()`;
  rebuild master, limiter, analyser, metronome bus and every strip from the cached mix state;
  `instruments.onGraphRebuilt(engine)` so M-06 drops cached node references; emit
  `audio.panic {hard:true}`. Wired to: the second press of the panic key within 2 s, M-28
  step 3 ("hard panic after release time" = 100 ms after the soft panic when
  `voices.activeCount() > 0` still), `E-AUD-004` recovery.

6.5.4.5 VoiceAllocator.acquire(owner, at)
```text
if freeList non-empty: slot = freeList.pop()
else:
  released = slots.filter(s => s.state == 'released')
  if released non-empty: slot = argmin over released of levelAt(at)   // quietest released
  else: slot = argmin over slots of startedAt                          // oldest active
  slot.voice.stop(at)  // immediate 5 ms ramp to silence then dispose (steal)
  stolen++
slot.owner = owner; slot.startedAt = at; slot.releasedAt = null; slot.state = 'active'
return slot
```
`levelAt(t)` is supplied by the M-06 voice (`voice.levelAt(t)` from its envelope model).
Capacity: `Caps.isMobile() ? 32 : 64`, overridable by the `audio.polyphonyCap` setting (8..128).
`markReleased(slot, at, end)`: state `released`; after `end` M-06's `onended` calls
`free(slot)` -> `freeList.push`.

6.5.4.6 Metronome click (`metronome.click(at, accent)`)
```text
osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = accent ? 1600 : 1000
g = ctx.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(accent ? 1.0 : 0.7, at + 0.002)
g.gain.exponentialRampToValueAtTime(0.001, at + (accent ? 0.06 : 0.04))
osc.connect(g); g.connect(metronomeBus); osc.start(at); osc.stop(at + 0.08); osc.onended = () => { osc.disconnect(); g.disconnect(); }
```

6.5.4.7 Latency: `base = ctx.baseLatency or 0`, `output = ctx.outputLatency or 0`;
`seconds = base + output`; if both are 0 (Safari lacks `outputLatency`; Firefox lacks
`baseLatency` on some versions): `seconds = mobile ? 0.040 : 0.020`, `estimated = true`. The
value seeds the calibration wizard's `audioLatencyMs` default (DLG-Calibration); it is never
applied automatically to scoring (Part 5.12: calibration is applied once, in `Rhythm.Judge`).

6.5.4.8 Gain ramps: `rampParam(param, target, at)`: `v = param.value` is unreliable during
ramps, so every strip keeps its last commanded value; `param.cancelScheduledValues(at);
param.setValueAtTime(lastValue, at); param.linearRampToValueAtTime(target, at + RAMP_S);
lastValue = target`. Master fades use `START_FADE_S` (20 ms) and `STOP_FADE_S` (30 ms) on
`master.gain` between 0 and `masterVolume`.

6.5.4.9 Peak meter: `peak()` fills the scratch buffer with
`analyser.getFloatTimeDomainData` (fallback `getByteTimeDomainData` converted to -1..1),
`peak = max(abs(samples))`, `clip = peak >= 0.99`, `holdPeak = max(peak, holdPeak * decay)`
where decay = `0.5 ^ (dt / 0.5)`. Called by the mixer UI at its own frame rate; costs < 0.05 ms.

6.5.4.10 Offline test harness: `createEngine({context: new OfflineAudioContext(2, 48000 * 4,
48000), clock: fake})`. `scheduler.tickOnce(audioNow)` runs one tick with `now = audioNow`
(the clock is injected, so `ctx.currentTime` is not consulted). Tests render with
`ctx.startRendering()` and locate onsets by scanning the buffer for the first sample above
0.01 after each expected time; the assertion is `abs(detected - expected) <= 1 / 48000 *
128 + 0.001` (one render quantum plus 1 ms).

#### 6.5.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Autoplay policy blocks audio (E 2.1) | `unlock()` returns `ok:false` | everything except sound | yes, next gesture | no | DLG-AudioBlocked "Sound is blocked until you tap. Tap to enable sound." | silent UI works (menus, studio editing) | `unlock()` again | UT-05-01 |
| Context suspended mid-play (call, lock screen, headphones) | `statechange` -> `audio.state` | transport paused by M-28 | `resume()` | no (recording take kept, M-17) | DLG-ResumeAudio "Audio was interrupted. Resume" | paused | resume re-anchors | UT-05-03 |
| Audio clock stalls without statechange | `sameNowCount === 3` | transport paused | `resume()` | no | same dialog | paused | same | UT-05-04 |
| AudioContext constructor throws (`E-AUD-001`) | try/catch | stored projects (the recovery copy is written first) | reload | no | `#fatal` with the E-AUD-001 text of Part 10.6.3 (Part 4.3 B7) | none (no mode works without Web Audio) | reload | UT-05-02 |
| Second context creation attempted | `created` flag | single context | n/a | no | log `E-AUD-003` | n/a | n/a | UT-05-05 |
| Voice pool exhausted | `acquire` steals | sound continues | n/a | no | About screen documents stealing; `audio.voices.stolen` in Diagnostics | stealing | n/a | UT-05-12 |
| Render stall > 120 ms (E 2.2) | `late > 1 ms` | timeline intact (audio clock master) | n/a | no | `sched.stall` counted in Diagnostics | late events clamped to now+5 ms | automatic | UT-05-20 |
| Stuck voice (release never scheduled) | `VOICE_MAX_S` cap; `panic` | n/a | n/a | no | panic key | n/a | `panic(true)` | UT-05-21 |
| Node graph corrupted (exception inside Web Audio call, `E-AUD-004`) | try/catch around `scheduleNote` | transport | `panic(true)` | no | toast "Audio was reset" | n/a | hard panic rebuild | UT-05-23 |
| `StereoPannerNode` missing | feature check | pan via PannerNode | n/a | no | none | equal-power panner | n/a | UT-05-08 |
| Sample rate unusual (e.g. 96 kHz, 22.05 kHz) | `ctx.sampleRate` | all synthesis is rate-independent (oscillators, computed buffers at ctx rate) | n/a | no | none | n/a | n/a | UT-05-29 |

#### 6.5.6 Limits and performance notes

- Polyphony 64 desktop / 32 mobile (BRIEF 6); stealing order released-quietest then oldest.
- Scheduler: 25 ms tick, 120 ms lookahead, catch-up at `now + 5 ms`; scheduled start within
  1 ms of the intended audio time (the Web Audio parameter timeline is sample-accurate; the
  only error is the clamp during stalls, which is counted).
- Per note: at most 6 nodes created by M-06 (template dependent); at 64 voices this is < 400
  live nodes. Node creation per second at 1,000 notes/s is within Chromium's and Safari's
  budgets; the 128-note chord stress (PT) verifies.
- `analyser` reads are on demand only. `audio.voices` emits at 1 Hz.
- `latency()` result is informative only (I 3.5: no claim of exact measurement).

#### 6.5.7 Spec coverage

B 11.1 (playback for synthesized notes, percussion, polyphony, multitrack, live input,
metronome; track volume and mute), B 11.2 (polyphony limits, voice allocation, note stealing,
scheduling, mixing and master), B 11.6 (no main-thread blocking: all scheduling is
parameter-timeline based; bounded voices; no decoding here), B 16.5 (per-track volume, pan,
mute, solo, master, peak indicator), B 21.2 (gesture activation), B 21.4 (audio suspension),
B 24 (audio initialization failure), E 1 rows "audio blocked", "rendering blocks audio",
E 2.1 (all ten lifecycle cases), E 2.2 (frame stall, background throttling, identical
timestamps, dense chords), E 2.3 (polyphony limit, panic), E 11 (audio failure must not
destroy project data: Audio holds no project data), I 3.3, I 3.5, I 13 (panic/stop), P 6.2
(all ten mixing items), P 6.3, P 9 (metronome timing), P 21 (audio transitions do not click).

#### 6.5.8 Unit tests (group `audio`, file `src/91-test-audio.js`; "offline" tests use the
harness of 6.5.4.10; "live" tests run in headless Chromium with the autoplay flag of 3.4)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-05-01 | unlock reports blocked state | stub context whose `resume` leaves state suspended | `{ok:false, reason:'E-AUD-002'}`; no `audio.unlocked` |
| UT-05-02 | constructor failure | stub `AudioContext` throwing | engine state `'none'`; `E-AUD-001` reported; `unlock()` resolves ok:false |
| UT-05-03 | statechange emits | stub context, fire `statechange` to suspended | `audio.state {state:'suspended'}` |
| UT-05-04 | stall detection | fake clock frozen for 3 ticks | `audio.state {reason:'stalled'}` emitted once |
| UT-05-05 | single context | `unlock()` twice concurrently and sequentially | one constructor call; same promise returned while pending |
| UT-05-06 | graph topology | live context | `master -> limiter -> destination`; limiter params equal `LIMITER`; analyser not in path |
| UT-05-07 | strip creation and reuse | `strip('t1')` twice; `removeStrip` | same object; after remove a new one; `strips().length` correct |
| UT-05-08 | pan fallback | stub context without `createStereoPanner` | PannerNode used with equalpower; `setPan(-1)` sets positionX -1 |
| UT-05-09 | solo set semantics | strips a, b, c; solo a | b and c `effectiveMuted()`; solo b too -> c only; unsolo all -> none |
| UT-05-10 | mute ramps not steps | offline render: tone then mute at 1.0 s | no sample-to-sample jump > 0.2 around 1.0 s; silence by 1.01 s |
| UT-05-11 | gain product CC7 x CC11 x fader | `setGain(0.5)`, `setVolumeCC(0.5)`, `setExpression(0.5)` | commanded gain 0.125 |
| UT-05-12 | allocator steal order | capacity 4; 4 active, release one quietly, then acquire twice | first steals the released one; second steals the oldest active; `stolen === 2` |
| UT-05-13 | allocator counts | acquire 3, release 1, free 1 | `activeCount 2`, `releasedCount 0` after free; `list()` length = capacity |
| UT-05-14 | capacity by platform and setting | mobile flag; `setCapacity(16)` | 32 then 16; values outside 8..128 clamped |
| UT-05-15 | offline onset accuracy | schedule 8 notes at 0.5 s intervals | detected onsets within 3.7 ms (6.5.4.10) of targets |
| UT-05-16 | lookahead bound | ticks with items 1 s ahead | no `noteOn` emitted with `atAudio > now + 0.120` |
| UT-05-17 | never schedules in the past | item due 50 ms ago | scheduled at `now + 0.005`; `sched.stall` emitted with `lateMs ~ 55` |
| UT-05-18 | sched events payload | one note | `sched.noteOn` and `sched.noteOff` carry trackId, noteId, pitch, velocity, atAudio, endAudio equal to the instrument call |
| UT-05-19 | cc/program/bend routing | items of each kind | `instruments.control` called with the event and audio time; `sched.control` emitted |
| UT-05-20 | stall catch-up ordering | 20 overdue items | all scheduled at `now + 0.005` preserving original order; one `sched.stall` |
| UT-05-21 | voice max duration cap | note with endAudio 120 s away | scheduled release at `at + 60` |
| UT-05-22 | soft panic releases all | 10 voices; `panic(false)` | each voice `release` called with ramp 0.03; `audio.panic {hard:false}`; pending cleared |
| UT-05-23 | hard panic rebuilds | mix state gain 0.3 pan -0.5 mute; `panic(true)` | new node objects; strip settings identical; `activeCount 0`; `onGraphRebuilt` called |
| UT-05-24 | seek triggers soft panic | emit `transport.seek` | `panic(false)` invoked once |
| UT-05-25 | pause and stop fade | emit `transport.state` to paused | master gain ramp to 0 over 30 ms scheduled; resume ramps back over 20 ms |
| UT-05-26 | metronome click shape | offline render accent and normal | accent peak > normal peak; durations 60 ms and 40 ms (envelope under 0.001 after) |
| UT-05-27 | latency estimate | stub ctx with baseLatency 0.01 and outputLatency 0.02; stub without either | 0.03 estimated:false; 0.02 estimated:true (desktop) |
| UT-05-28 | peak meter | offline: full-scale square for 100 ms | `peak() >= 0.98`, `clip true`; silence -> hold decays below 0.1 within 1.5 s |
| UT-05-29 | sample-rate independence | offline contexts at 44100 and 96000 | onset timings equal within 1 ms; metronome pitch unchanged (zero-crossing count) |
| UT-05-30 | live note path | `liveNoteOn` then `liveNoteOff` 100 ms later | `sched.noteOn {live:true}` at `>= now + 0.002`; voice released at off time |
| UT-05-31 | loopWrap releases | items with `loopWrap` | every active voice released at `wrapAudio` |
| UT-05-32 | voices stats event | run 40 ticks | one `audio.voices` with `capacity`, `active`, `stolen` |
| UT-05-33 | dispose closes | `dispose()` | `ctx.close` called; interval cleared (`Timers.counts().intervals` back to baseline) |

#### 6.5.9 Implementation notes and browser quirks

- iOS Safari: the context is created `suspended` and may become `interrupted`; `resume()` must
  be called from a gesture; the silent-buffer kick (6.5.4.1 step 3) is required. Safari also
  lacks `outputLatency` and (older versions) `createStereoPanner`; both have fallbacks.
- Chromium requires the gesture to be a "user activation"; `pointerdown` qualifies, but
  `pointermove` does not. M-29 attaches the unlock to `pointerup`, `keydown` and `click`.
- Firefox `baseLatency` exists; `outputLatency` exists since 70. `DynamicsCompressorNode`
  attack/release are k-rate; set once.
- `exponentialRampToValueAtTime` cannot reach 0; the metronome ramps to 0.001 then the node
  stops.
- `setInterval` is throttled to 1 Hz in background tabs; the stall path handles it. Do not
  use a Worker timer (no additional threads in v1; documented in 13.x risk register).
- `AudioParam.cancelScheduledValues` followed by `setValueAtTime` is the only portable way to
  start a ramp from the current commanded value; `cancelAndHoldAtTime` is not in Firefox.
- Keep the analyser connected but never call `getFloatTimeDomainData` from the scheduler tick.

### 6.6 M-06 Instruments (`src/06-instruments.js`, `FLM.Instruments`)

#### 6.6.1 Responsibilities and non-goals

Responsibilities: the data-driven instrument definition table (128 GM programs plus the drum
kit) built from 16 family patch templates with per-program overrides; `Voice` synthesis
graphs with velocity layers and ADSR; the 12 synthesized drum voices and the GM key map;
voice lifecycle on top of `FLM.Audio.voices`; program change, pitch bend (with RPN 0 range),
CC 1/7/10/11/64/120/121/123 handling; deterministic ignore-and-log-once for unsupported
controllers; the fidelity declaration API; per-channel live state (sustain flag, bend,
modulation) for Free Play and recording.

Non-goals: no sampled sound bank (ADR-04; SoundFont loading is Deferred P2 and not designed
here), no effects beyond the per-voice filter (reverb is M-05 Phase 14 scope per Part 1.5), no
scheduling decisions (M-05 decides when; M-06 decides how a note sounds).

#### 6.6.2 Public API

```js
FLM.Instruments = {
  VERSION: 1,                                   // definition table version (Part 5.17)
  FAMILY_TEMPLATES: /* 16 Template records, 6.6.3 */,
  DEFINITIONS: /* 128 InstrumentDef records (frozen), 6.6.3 */,
  DRUM_VOICES: /* 12 DrumVoiceDef records */,
  DRUM_MAP: /* Uint8Array(128): GM key -> drum voice index, 255 = none (keys outside 35..81 map to 'misc') */,

  /** Binds to an Audio engine (called by M-29 after unlock and again on hard panic). */
  attach(engine /* FLM.Audio Engine */) /* -> void */,
  onGraphRebuilt(engine) /* -> void (drops cached nodes, re-creates per-channel LFOs) */,

  definition(program /* 0..127 */) /* -> InstrumentDef (frozen) */,
  drumDefinition(key /* 0..127 */) /* -> DrumVoiceDef */,
  /** Fidelity declaration shown in UI (I 3.4). */
  fidelity(program /* 0..127 or 'drums' */) /* -> Fidelity */,
  // Fidelity { level:'synth-basic'|'synth-velocity', sampled:false, velocityLayers:number,
  //            controllers:number[], articulations:string[], percussion:boolean, label:string }
  // label is the exact UI string: 'Synthesized' or 'Synthesized, velocity-sensitive'

  /** Scheduled playback (called by Audio.Scheduler). Returns the VoiceSlot (or null when the
   *  track is a drum track with an unmapped key, which is silent by design). */
  noteOn(track /* Track */, note /* NoteEvent */, atAudio, endAudio) /* -> VoiceSlot|null */,
  /** Live input (Free Play / recording): voice held until noteOffLive or sustain release. */
  noteOnLive(trackId, program, isDrums, channel, pitch, velocity, atAudio) /* -> VoiceSlot|null */,
  noteOffLive(trackId, channel, pitch, atAudio) /* -> boolean */,
  /** Scheduled control event (cc, program, bend) for a track. */
  control(track, event /* ControlEvent|ProgramEvent|PitchBendEvent */, atAudio) /* -> void */,
  /** Live control for Free Play (sustain pedal key, mod wheel from MIDI, bend). */
  controlLive(trackId, channel, kind /* 'cc'|'bend'|'program' */, a, b, atAudio) /* -> void */,
  /** Current program for a track (after scheduled program changes). */
  programOf(trackId) /* -> number */,
  setTrackProgram(trackId, program, isDrums) /* -> void (initial assignment; M-17/M-27) */,
  /** Precomputes pluck buffers for a program over a pitch range (Free Play instrument select). */
  warm(program, loPitch, hiPitch) /* -> Promise<void> (yields every 8 buffers) */,
  releaseTrack(trackId, atAudio, rampS) /* -> number released */,
  stats() /* -> {pluckCacheEntries, pluckCacheBytes, voicesBuilt, unsupportedCCs:number[]} */,
  dispose()
};
// InstrumentDef { program, name, family:0..15, template:string, fidelity:'synth-basic'|'synth-velocity',
//                 params:object /* resolved template params after overrides */, range:[lo,hi],
//                 polyphonyHint:number, mono:boolean, animProfile:string /* M-20 controller id */ }
// Voice (internal, one per sounding note) { start(at), release(at, rampS?), stop(at), dispose(),
//                 levelAt(t), setBend(cents, at), setVibratoDepth(cents, at), slot }
```

Events emitted: none directly (M-05 emits `sched.*`). Events consumed: none; M-06 is called
synchronously by M-05 and by M-08/M-17 for live input. `Log.once` is used for unsupported
controllers (`cc-unsupported-<n>`), logged at level `info` the first time each controller
number is seen per page.

#### 6.6.3 Internal state

Per attached engine: `engine`, `ctx`, `channelState: Map<trackId, Map<channel, ChannelState>>`
where `ChannelState { program, bendCents, bendRangeSemis:2, modDepthCents:0, volumeCC:100,
expression:127, pan:64, sustain:false, rpn:{msb:127, lsb:127}, heldLive: Map<pitch,
VoiceSlot>, sustainedLive: Set<VoiceSlot>, lfo: OscillatorNode (5.5 Hz) + GainNode depth }`.
Pluck buffer cache: `Map<key = templateId + ':' + pitch + ':' + layer, AudioBuffer>` with LRU
order, cap 48 entries desktop / 24 mobile, each `<= 3 s` mono at `ctx.sampleRate` (max about
0.6 MB at 48 kHz; cache cap under 29 MB desktop, 15 MB mobile). Drum noise buffers: one 1 s
white-noise buffer and one 1 s pink-noise buffer, generated once per context with
`Prng(0x5EED)` so renders are reproducible.

Template record (parameter schema). All times in seconds, frequencies in Hz, gains linear:

```js
Template {
  id, oscs: [{type:'sine'|'square'|'sawtooth'|'triangle', ratio:1, detune:0 /* cents */, gain:1}],
  noise: null | {color:'white'|'pink', gain, bandpassHz:null|number, q:1, decay:0.05},
  fm: null | {ratio, index /* peak modulation index */, indexDecay /* s */},
  filter: {type:'lowpass'|'bandpass'|'highpass', cutoff, velCutoff /* added at velocity 127 */, keyTrack /* 0..1, cutoff *= (f/261.63)^keyTrack */,
           q, env:{attack, decay, sustain /* fraction of (cutoff+velCutoff) kept */}},
  amp: {a, d, s, r, decay2:null /* second-stage time constant toward 0 while held (piano-like) */},
  vel: {exp:1.6, min:0.08},                    // gain = min + (1-min) * (v/127)^exp
  layers: [{maxVel:63, gainMul:0.8, cutoffMul:0.75}, {maxVel:127, gainMul:1, cutoffMul:1}],
  pluck: null | {damping /* 0.990..0.999 */, brightness /* 0..1 */, seconds, pickPos /* 0..1 */},
  vibrato: {rate:5.5, autoDepthCents:0, delay:0.3},   // auto vibrato (strings); CC1 adds to depth
  mono:false, polyphonyHint:16, range:[21,108], releaseMax:2.0, animProfile:'keys'
}
```

The sixteen family templates (every field not listed takes the schema default above):

| Template (families) | Oscillators and sources | Filter (type, cutoff, +vel, keyTrack, Q, env a/d/sustain) | Amp a/d/s/r (decay2) | vel exp/min | Layers (maxVel: gainMul, cutoffMul) | Range, poly, anim |
|---|---|---|---|---|---|---|
| `piano` (0) | triangle 1.0 g1.0; sawtooth 1.0 +3c g0.35; sine 2.0 g0.15 | lowpass 1800, +3200, kt 0.5, Q 0.7, env 0.002/0.5/0.35 | 0.002/0.9/0.30/0.18 (decay2 3.0) | 1.6/0.06 | 48: 0.7, 0.6; 96: 0.9, 0.85; 127: 1, 1 | 21-108, 24, `keys` |
| `chromatic` (1) | sine carrier g1.0; fm ratio 3.5 index 2.2 decay 0.6 | lowpass 6000, +2000, kt 0.3, Q 0.5, env 0.001/0.4/0.5 | 0.001/1.4/0/0.4 (decay2 null) | 1.4/0.1 | 64: 0.8, 1; 127: 1, 1 | 48-108, 12, `percussion` |
| `organ` (2) | sine 1 g1; sine 2 g0.6; sine 3 g0.35; sine 4 g0.2; sine 0.5 g0.3 | lowpass 5000, +0, kt 0, Q 0.3, env none | 0.006/0/1.0/0.06 | 1.0/1.0 (no velocity) | single layer | 36-96, 16, `keys` |
| `guitar` (3) | pluck damping 0.996 brightness 0.7 seconds 2.5 pickPos 0.2 | lowpass 2600, +2400, kt 0.4, Q 0.8, env 0.001/0.25/0.4 | 0.001/0/1.0/0.08 | 1.5/0.1 | 70: 0.8, 0.7; 127: 1, 1 | 40-88, 8, `guitar` |
| `bass` (4) | pluck damping 0.998 brightness 0.45 seconds 3.0 pickPos 0.3 (programs 38-39 use oscs instead: sawtooth g1 + square 0.5 g0.5) | lowpass 900, +1200, kt 0.3, Q 1.2, env 0.002/0.3/0.3 | 0.002/0/1.0/0.10 | 1.4/0.15 | 80: 0.85, 0.7; 127: 1, 1 | 28-67, 4, `bass` |
| `strings` (5) | sawtooth -7c g0.6; sawtooth 0c g0.7; sawtooth +7c g0.6 | lowpass 1600, +1800, kt 0.5, Q 0.6, env 0.08/0.3/0.7 | 0.08/0.25/0.85/0.35 | 1.2/0.2 | 90: 0.85, 0.8; 127: 1, 1 | 36-100, 16, `strings` |
| `ensemble` (6) | sawtooth -12c g0.5; sawtooth 0 g0.6; sawtooth +12c g0.5; triangle 0 g0.3 (choir 52-54, 91 add bandpass noise 1200 Hz g0.08) | lowpass 1400, +1200, kt 0.4, Q 0.7, env 0.15/0.4/0.75 | 0.14/0.3/0.9/0.5 | 1.1/0.25 | 127: 1, 1 | 36-96, 24, `strings` |
| `brass` (7) | sawtooth g0.8; square +5c g0.35 | lowpass 1200, +2600, kt 0.4, Q 1.4, env 0.05/0.12/0.7 | 0.035/0.1/0.8/0.14 | 1.5/0.12 | 80: 0.8, 0.7; 127: 1, 1 | 40-84, 8, `winds` |
| `reed` (8) | square g0.7; sawtooth g0.35; noise white g0.03 bandpass at 2x pitch | lowpass 1500, +2000, kt 0.6, Q 1.0, env 0.04/0.15/0.65 | 0.045/0.1/0.85/0.12 | 1.3/0.15 | 127: 1, 1 | 48-96, 8, `winds` |
| `pipe` (9) | sine g0.8; triangle g0.35; noise white g0.05 bandpass at pitch Q 8 decay 0.08 | lowpass 3000, +1500, kt 0.5, Q 0.5, env 0.06/0.1/0.8 | 0.06/0.08/0.9/0.10 | 1.2/0.2 | 127: 1, 1 | 55-103, 8, `winds` |
| `synthLead` (10) | sawtooth -8c g0.6; sawtooth +8c g0.6 (80: square x2; 86: adds osc ratio 1.5 g0.5) | lowpass 2400, +3000, kt 0.3, Q 1.8, env 0.005/0.2/0.5 | 0.005/0.1/0.8/0.10 | 1.3/0.15 | 127: 1, 1 | 36-96, 8, mono true for 80-87, `synth` |
| `synthPad` (11) | sawtooth -10c g0.4; triangle 0 g0.5; sawtooth +10c g0.4 | lowpass 1000, +900, kt 0.3, Q 0.9, env 0.6/1.0/0.6 | 0.45/0.6/0.9/0.9 | 1.1/0.3 | 127: 1, 1 | 36-96, 16, `synth` |
| `synthFx` (12) | sine g0.6; fm ratio 2.01 index 4 decay 1.2; noise pink g0.1 | bandpass 800 (sweeps via env), +2400, kt 0.2, Q 2.5, env 0.3/1.5/0.3 | 0.2/0.8/0.6/0.8 | 1.0/0.3 | 127: 1, 1 | 36-96, 8, `synth` |
| `ethnic` (13) | pluck damping 0.993 brightness 0.8 seconds 1.5 pickPos 0.1 (109 bagpipe and 111 shanai use reed oscs with constant drone) | lowpass 3200, +2000, kt 0.4, Q 0.9, env 0.001/0.2/0.4 | 0.001/0/1.0/0.07 | 1.5/0.1 | 70: 0.8, 0.7; 127: 1, 1 | 43-91, 8, `guitar` |
| `percussive` (14) | sine g0.8 pitch drops 1 octave over 0.03 s; noise white g0.5 bandpass 3000 Q 1 decay 0.06 | lowpass 5000, +3000, kt 0.3, Q 0.7, env 0.001/0.15/0.3 | 0.001/0.35/0/0.12 | 1.4/0.1 | 64: 0.75, 0.9; 127: 1, 1 | 36-96, 8, `percussion` |
| `sfx` (15) | noise pink g0.6 bandpass 600 Q 0.8 decay 0.8; sine g0.2 | bandpass 900, +1500, kt 0, Q 1.2, env 0.1/0.6/0.4 | 0.05/0.6/0.3/0.4 | 1.0/0.3 | 127: 1, 1 | 36-96, 4, `abstract` |

Velocity-to-gain curve: `gain = vel.min + (1 - vel.min) * (velocity / 127) ^ vel.exp`. Layer
selection: the first layer with `velocity <= maxVel`; its `gainMul` multiplies the voice gain
and `cutoffMul` the filter cutoff. Release behavior: `release(at)` ramps the amp gain from its
current level to 0 over `amp.r` (linear ramp after `setValueAtTime(level, at)`), the filter
envelope is left alone; pluck voices additionally stop the buffer source at `at + amp.r`.
`decay2` (piano) is implemented as `setTargetAtTime(0, at + a + d, decay2)` after the sustain
level is reached. Polyphony hints are advisory for the allocator priority (`priority = 2` for
drums and bass, `1` for melody-range templates, `0` for pads and sfx; equal-priority ties use
the normal steal order; a higher-priority acquire may steal a lower-priority active voice
before stealing the oldest of its own class).

The 128-program table (program -> template -> overrides -> fidelity). Overrides name
template fields; `cutoff` and `+vel` replace the filter values, `a d s r` replace amp values,
`range` replaces the range; "none" means the family template applies unchanged.

| Prog | Name | Template | Overrides | Fidelity |
|---|---|---|---|---|
| 0 | Acoustic Grand Piano | piano | none | synth-velocity |
| 1 | Bright Acoustic Piano | piano | cutoff 2400, +vel 3600 | synth-velocity |
| 2 | Electric Grand Piano | piano | osc2 gain 0.2, cutoff 2200, decay2 2.0 | synth-velocity |
| 3 | Honky-tonk Piano | piano | add osc triangle +9c g0.6 (detuned pair) | synth-velocity |
| 4 | Electric Piano 1 | chromatic | fm ratio 1.0 index 1.4 decay 0.8, amp d 2.0 s 0.2 r 0.25, range 28-103 | synth-velocity |
| 5 | Electric Piano 2 | chromatic | fm ratio 2.0 index 1.0 decay 1.0, amp d 2.5 s 0.25 r 0.3, range 28-103 | synth-velocity |
| 6 | Harpsichord | guitar | pluck damping 0.994 brightness 0.95 seconds 1.5, cutoff 4000, amp r 0.05, range 29-89 | synth-velocity |
| 7 | Clavinet | guitar | pluck damping 0.992 brightness 0.9 seconds 1.0, cutoff 2800 Q 2.0, range 36-96 | synth-velocity |
| 8 | Celesta | chromatic | fm ratio 4.0 index 1.5 decay 0.4, amp d 1.0 | synth-velocity |
| 9 | Glockenspiel | chromatic | fm ratio 5.0 index 1.8 decay 0.5, amp d 1.6, range 72-108 | synth-velocity |
| 10 | Music Box | chromatic | fm ratio 3.0 index 1.2 decay 0.3, amp d 1.0, range 60-100 | synth-velocity |
| 11 | Vibraphone | chromatic | fm ratio 4.0 index 0.8 decay 1.0, amp d 2.5, vibrato autoDepth 15 rate 4.5 delay 0 | synth-velocity |
| 12 | Marimba | percussive | sine only (noise g0.15), amp d 0.25, cutoff 3000, range 45-96 | synth-velocity |
| 13 | Xylophone | percussive | noise g0.3 bandpass 5000, amp d 0.18, range 65-108 | synth-velocity |
| 14 | Tubular Bells | chromatic | fm ratio 1.41 index 3.0 decay 2.0, amp d 4.0 r 1.0, range 48-84 | synth-velocity |
| 15 | Dulcimer | guitar | pluck damping 0.995 brightness 0.85 seconds 2.0, range 48-96 | synth-velocity |
| 16 | Drawbar Organ | organ | none | synth-basic |
| 17 | Percussive Organ | organ | add click: amp a 0.001 plus osc 3 gain 0.6 decaying to 0.35 over 0.15 s | synth-basic |
| 18 | Rock Organ | organ | osc gains 1/0.8/0.5/0.3/0.3, cutoff 3500 Q 1.5 (mild drive via Q) | synth-basic |
| 19 | Church Organ | organ | add sine 0.25 g0.4 and sine 8 g0.1, amp a 0.04 r 0.25 | synth-basic |
| 20 | Reed Organ | reed | amp a 0.03 s 1.0, cutoff 1200, vel exp 1.0 min 1.0 | synth-basic |
| 21 | Accordion | reed | square g0.6 + sawtooth -6c g0.4 + sawtooth +6c g0.4, cutoff 1800 | synth-velocity |
| 22 | Harmonica | reed | cutoff 2200 Q 1.6, amp a 0.03, range 60-96 | synth-velocity |
| 23 | Tango Accordion | reed | as 21 with detune +/-9c | synth-velocity |
| 24 | Acoustic Guitar (nylon) | guitar | pluck brightness 0.5 damping 0.995, cutoff 2000 | synth-velocity |
| 25 | Acoustic Guitar (steel) | guitar | none | synth-velocity |
| 26 | Electric Guitar (jazz) | guitar | pluck brightness 0.4 damping 0.997, cutoff 1600 | synth-velocity |
| 27 | Electric Guitar (clean) | guitar | pluck brightness 0.75 damping 0.997 seconds 3.0, cutoff 3200 | synth-velocity |
| 28 | Electric Guitar (muted) | guitar | pluck damping 0.985 seconds 0.6, amp r 0.04 | synth-velocity |
| 29 | Overdriven Guitar | guitar | pluck brightness 0.9 damping 0.998 seconds 3.0, filter Q 3.0 cutoff 1800 (resonant drive), waveshaper curve `tanh(2x)` on the voice output | synth-velocity |
| 30 | Distortion Guitar | guitar | as 29 with waveshaper `tanh(5x)` and cutoff 2600 | synth-velocity |
| 31 | Guitar Harmonics | guitar | pluck brightness 0.3 damping 0.998, pitch +12 semitones, gain 0.6, range 52-100 | synth-velocity |
| 32 | Acoustic Bass | bass | pluck brightness 0.35 damping 0.997 | synth-velocity |
| 33 | Electric Bass (finger) | bass | none | synth-velocity |
| 34 | Electric Bass (pick) | bass | pluck brightness 0.7 pickPos 0.15, cutoff 1400 | synth-velocity |
| 35 | Fretless Bass | bass | pluck brightness 0.4 damping 0.998, vibrato autoDepth 10 delay 0.25 | synth-velocity |
| 36 | Slap Bass 1 | bass | pluck brightness 0.9 pickPos 0.1 damping 0.996, cutoff 1800 +vel 2400 | synth-velocity |
| 37 | Slap Bass 2 | bass | as 36 with cutoff 2200 | synth-velocity |
| 38 | Synth Bass 1 | bass | oscs sawtooth g1 + square ratio 0.5 g0.5, cutoff 700 +vel 1600 Q 2.0, filter env d 0.25, amp d 0.2 s 0.6 r 0.12 | synth-velocity |
| 39 | Synth Bass 2 | bass | oscs square g0.8 + sawtooth -5c g0.6, cutoff 900 Q 1.5, amp s 0.8 | synth-velocity |
| 40 | Violin | strings | single osc set gains 0.5/0.8/0.5, vibrato autoDepth 12 delay 0.35, range 55-103 | synth-velocity |
| 41 | Viola | strings | vibrato autoDepth 10, cutoff 1400, range 48-91 | synth-velocity |
| 42 | Cello | strings | cutoff 1100 kt 0.4, vibrato autoDepth 9, range 36-76 | synth-velocity |
| 43 | Contrabass | strings | cutoff 800, amp a 0.1, vibrato autoDepth 6, range 28-62 | synth-velocity |
| 44 | Tremolo Strings | strings | amplitude LFO 7 Hz depth 0.5 on voice gain | synth-velocity |
| 45 | Pizzicato Strings | guitar | pluck brightness 0.5 damping 0.992 seconds 1.0, amp r 0.06, range 36-96 | synth-velocity |
| 46 | Orchestral Harp | guitar | pluck brightness 0.6 damping 0.997 seconds 3.0, cutoff 3000, range 24-103 | synth-velocity |
| 47 | Timpani | percussive | sine pitch drop 0.5 octave over 0.08 s, noise g0.3 bandpass 400, amp d 1.2 r 0.4, range 36-60 | synth-velocity |
| 48 | String Ensemble 1 | ensemble | none | synth-velocity |
| 49 | String Ensemble 2 | ensemble | amp a 0.25 r 0.7, cutoff 1200 | synth-velocity |
| 50 | Synth Strings 1 | ensemble | oscs sawtooth x3 detune +/-15c, cutoff 1800 Q 1.0 | synth-velocity |
| 51 | Synth Strings 2 | ensemble | as 50 with amp a 0.3 and cutoff 1300 | synth-velocity |
| 52 | Choir Aahs | ensemble | choir variant: bandpass noise 1200 Hz g0.08, osc set triangle-heavy (gains 0.3/0.6/0.3/0.6), formant filter bandpass 900 Hz Q 2 in series | synth-velocity |
| 53 | Voice Oohs | ensemble | as 52 with formant 500 Hz | synth-velocity |
| 54 | Synth Voice | ensemble | as 52 with formant 1400 Hz and cutoff 2200 | synth-velocity |
| 55 | Orchestra Hit | ensemble | amp a 0.005 d 0.4 s 0 r 0.3, plus noise burst g0.4 decay 0.1 | synth-velocity |
| 56 | Trumpet | brass | range 55-86 | synth-velocity |
| 57 | Trombone | brass | cutoff 900 +vel 2000, amp a 0.045, range 40-72 | synth-velocity |
| 58 | Tuba | brass | cutoff 600 +vel 1200, amp a 0.06, range 28-58 | synth-velocity |
| 59 | Muted Trumpet | brass | cutoff 1800 Q 3.0 (bandpass-like), gain 0.7, range 55-86 | synth-velocity |
| 60 | French Horn | brass | cutoff 800 +vel 1400, amp a 0.06 r 0.2, range 41-77 | synth-velocity |
| 61 | Brass Section | brass | add third osc sawtooth -9c g0.5, amp a 0.04, range 40-86 | synth-velocity |
| 62 | Synth Brass 1 | brass | oscs sawtooth x2 detune +/-12c, cutoff 1500 Q 2.0, filter env d 0.3 | synth-velocity |
| 63 | Synth Brass 2 | brass | as 62 with amp a 0.02 and cutoff 2000 | synth-velocity |
| 64 | Soprano Sax | reed | cutoff 1800, range 56-88 | synth-velocity |
| 65 | Alto Sax | reed | cutoff 1500, range 49-81 | synth-velocity |
| 66 | Tenor Sax | reed | cutoff 1200, amp a 0.05, range 44-76 | synth-velocity |
| 67 | Baritone Sax | reed | cutoff 900, amp a 0.06, range 36-69 | synth-velocity |
| 68 | Oboe | reed | square g0.4 sawtooth g0.6, cutoff 2200 Q 1.8, range 58-91 | synth-velocity |
| 69 | English Horn | reed | as 68 with cutoff 1500, range 52-81 | synth-velocity |
| 70 | Bassoon | reed | cutoff 900 Q 1.2, amp a 0.05, range 34-72 | synth-velocity |
| 71 | Clarinet | reed | square g0.9 sawtooth g0.1 (odd harmonics), cutoff 1800, range 50-91 | synth-velocity |
| 72 | Piccolo | pipe | range 74-108, noise g0.07 | synth-velocity |
| 73 | Flute | pipe | none | synth-velocity |
| 74 | Recorder | pipe | triangle g0.5, cutoff 2400, range 60-96 | synth-velocity |
| 75 | Pan Flute | pipe | noise g0.12 decay 0.15, amp a 0.08, range 60-96 | synth-velocity |
| 76 | Blown Bottle | pipe | noise g0.2 bandpass Q 12, sine g0.6, range 55-91 | synth-velocity |
| 77 | Shakuhachi | pipe | noise g0.15 decay 0.3, vibrato autoDepth 20 delay 0.4, range 55-91 | synth-velocity |
| 78 | Whistle | pipe | sine only g0.9, cutoff 6000, vibrato autoDepth 10, range 72-108 | synth-velocity |
| 79 | Ocarina | pipe | sine g0.9 triangle g0.1, cutoff 3500, range 60-96 | synth-velocity |
| 80 | Lead 1 (square) | synthLead | oscs square x2 detune +/-6c, mono | synth-velocity |
| 81 | Lead 2 (sawtooth) | synthLead | mono | synth-velocity |
| 82 | Lead 3 (calliope) | synthLead | oscs triangle g0.7 + sine ratio 2 g0.3, noise g0.05, amp a 0.03, mono false | synth-velocity |
| 83 | Lead 4 (chiff) | synthLead | add noise g0.15 decay 0.04, cutoff 2000 | synth-velocity |
| 84 | Lead 5 (charang) | synthLead | filter Q 3.0 cutoff 1800, waveshaper `tanh(3x)` | synth-velocity |
| 85 | Lead 6 (voice) | synthLead | formant bandpass 800 Hz Q 2 in series, amp a 0.04 | synth-velocity |
| 86 | Lead 7 (fifths) | synthLead | add osc sawtooth ratio 1.4983 g0.5 | synth-velocity |
| 87 | Lead 8 (bass + lead) | synthLead | add osc square ratio 0.5 g0.6, cutoff 1800 | synth-velocity |
| 88 | Pad 1 (new age) | synthPad | add fm sine ratio 2 index 0.6 decay 2.0 | synth-velocity |
| 89 | Pad 2 (warm) | synthPad | none | synth-velocity |
| 90 | Pad 3 (polysynth) | synthPad | amp a 0.05 d 0.4 s 0.7 r 0.5, cutoff 1600 +vel 2000, filter env d 0.5 | synth-velocity |
| 91 | Pad 4 (choir) | synthPad | formant bandpass 1000 Hz Q 2, noise g0.06 | synth-velocity |
| 92 | Pad 5 (bowed) | synthPad | oscs sawtooth x3 detune +/-5c, amp a 0.7 | synth-velocity |
| 93 | Pad 6 (metallic) | synthPad | add fm ratio 3.7 index 2.0 decay 3.0 | synth-velocity |
| 94 | Pad 7 (halo) | synthPad | cutoff 1400, add sine ratio 2 g0.3, amp r 1.5 | synth-velocity |
| 95 | Pad 8 (sweep) | synthPad | filter env a 2.0 d 2.0 sustain 0.4, cutoff 600 +vel 2400 | synth-velocity |
| 96 | FX 1 (rain) | synthFx | noise pink g0.5, filter bandpass 2500 Q 1, amp a 0.3 | synth-velocity |
| 97 | FX 2 (soundtrack) | synthFx | oscs sawtooth x2 detune +/-20c, amp a 0.8 r 1.5 | synth-velocity |
| 98 | FX 3 (crystal) | synthFx | fm ratio 5.0 index 3.0 decay 1.0, amp a 0.005 d 2.0 s 0.1 | synth-velocity |
| 99 | FX 4 (atmosphere) | synthFx | pluck-like: guitar template params plus synthPad layer g0.4 | synth-velocity |
| 100 | FX 5 (brightness) | synthFx | sine + fm ratio 2 index 1.5, cutoff 3000, amp a 0.2 | synth-velocity |
| 101 | FX 6 (goblins) | synthFx | filter env a 1.5 sweep, vibrato autoDepth 40 rate 3 | synth-velocity |
| 102 | FX 7 (echoes) | synthFx | amp a 0.01 d 1.5 s 0.3, three re-triggered sub-voices at +0.25 s and +0.5 s with gains 0.5 and 0.25 | synth-velocity |
| 103 | FX 8 (sci-fi) | synthFx | fm ratio 1.5 index 6 decay 2.0, filter Q 4 | synth-velocity |
| 104 | Sitar | ethnic | pluck brightness 0.95 damping 0.997 seconds 2.5, add drone osc at pitch-12 g0.15, filter Q 3 | synth-velocity |
| 105 | Banjo | ethnic | pluck brightness 0.9 damping 0.990 seconds 1.0 | synth-velocity |
| 106 | Shamisen | ethnic | pluck brightness 0.85 damping 0.991 seconds 1.2, cutoff 2800 | synth-velocity |
| 107 | Koto | ethnic | pluck brightness 0.7 damping 0.996 seconds 2.0 | synth-velocity |
| 108 | Kalimba | percussive | sine g0.9 no pitch drop, noise g0.1, amp d 0.6, range 48-96 | synth-velocity |
| 109 | Bag pipe | reed | drone osc at pitch-12 g0.3 constant, cutoff 1600 Q 1.5, vel exp 1.0 min 1.0 | synth-basic |
| 110 | Fiddle | strings | as 40 with cutoff 2000 and vibrato autoDepth 8 | synth-velocity |
| 111 | Shanai | reed | cutoff 2600 Q 2.5, range 60-91 | synth-velocity |
| 112 | Tinkle Bell | chromatic | fm ratio 6.0 index 2.0 decay 0.3, amp d 0.8, range 72-108 | synth-velocity |
| 113 | Agogo | percussive | sine g0.8 no drop, noise g0.2, amp d 0.3, range 60-96 | synth-velocity |
| 114 | Steel Drums | chromatic | fm ratio 2.0 index 1.2 decay 0.5 plus osc ratio 3 g0.2, amp d 1.2, range 52-88 | synth-velocity |
| 115 | Woodblock | percussive | noise g0.6 bandpass 2000 Q 2 decay 0.03, sine g0.3, amp d 0.08, range 48-84 | synth-velocity |
| 116 | Taiko Drum | percussive | sine pitch drop 1 octave over 0.1 s start 2x, noise g0.4 bandpass 300, amp d 0.9, range 36-60 | synth-velocity |
| 117 | Melodic Tom | percussive | sine pitch drop 0.5 octave over 0.12 s, amp d 0.5, range 40-72 | synth-velocity |
| 118 | Synth Drum | percussive | square + sine, pitch drop 2 octaves over 0.15 s, amp d 0.4, range 36-72 | synth-velocity |
| 119 | Reverse Cymbal | sfx | noise white g0.8 bandpass 4000 Q 0.7, amp a 1.0 d 0.05 s 0 r 0.05 (reversed swell) | synth-basic |
| 120 | Guitar Fret Noise | sfx | noise white g0.5 bandpass 3000 Q 2 decay 0.05, amp d 0.08 | synth-basic |
| 121 | Breath Noise | sfx | noise pink g0.6 bandpass 1500 Q 1, amp a 0.05 d 0.3 | synth-basic |
| 122 | Seashore | sfx | noise pink g0.7 lowpass 800 with 0.3 Hz amplitude LFO depth 0.5 | synth-basic |
| 123 | Bird Tweet | sfx | sine g0.6 with 8 Hz vibrato depth 300 cents, pitch +24, amp d 0.2 | synth-basic |
| 124 | Telephone Ring | sfx | square g0.5 at 1000 Hz plus 1200 Hz, 20 Hz amplitude LFO depth 1 | synth-basic |
| 125 | Helicopter | sfx | noise pink g0.8 lowpass 400, 12 Hz amplitude LFO depth 0.8 | synth-basic |
| 126 | Applause | sfx | noise white g0.7 bandpass 2500 Q 0.5 with random-grain gain modulation (Prng, 40 Hz) | synth-basic |
| 127 | Gunshot | sfx | noise white g1.0 lowpass 1500, amp a 0.001 d 0.25 s 0 r 0.1 | synth-basic |

Fidelity summary: programs 16-19, 20, 109 and 119-127 are `synth-basic` (no velocity
response); all others are `synth-velocity`. No program is `sampled` (ADR-04). Drum kit
fidelity is `synth-velocity` with `percussion: true`.

The 12 drum voices (channel 10 / `isDrums` tracks). Every recipe is built per hit from
oscillators, the shared noise buffers and gain envelopes; `vel` scales gain by `0.1 + 0.9 *
(velocity / 127) ^ 1.3`:

| Index | Voice | Recipe |
|---|---|---|
| 0 | kick | sine 150 Hz -> 50 Hz exponential over 0.05 s; amp a 0.001 d 0.35 to 0; plus click: white noise g0.25 lowpass 2000 decay 0.01; waveshaper `tanh(1.5x)` |
| 1 | snare | triangle 190 Hz drop to 160 Hz over 0.02 s g0.6 d 0.12; white noise g0.9 highpass 1200 Q 0.7 d 0.18; body bandpass 900 Hz Q 1 on the osc |
| 2 | rimshot | sine 400 Hz g0.5 d 0.04; white noise g0.6 bandpass 2500 Q 2 d 0.05 (used for side stick 37 and sticks 31) |
| 3 | clap | white noise bandpass 1100 Hz Q 1.5; four bursts at 0, 0.011, 0.022, 0.033 s each d 0.02 g0.8, then tail d 0.15 g0.5 |
| 4 | tom | sine with pitch per key (see map; low floor 90 Hz .. high tom 220 Hz) dropping 15 percent over 0.08 s g0.9 d 0.45; noise g0.15 lowpass 1500 d 0.03 |
| 5 | closedHat | white noise highpass 7000 Q 0.8 g0.6 d 0.045; plus square 420 Hz g0.08 d 0.02 (metallic) |
| 6 | openHat | white noise highpass 6500 g0.6 d 0.35 with bandpass 9000 Q 0.5 mix 0.3; a later closedHat or pedalHat on the same track chokes it (release 0.02 s) |
| 7 | pedalHat | closedHat with d 0.03 and g0.4 |
| 8 | crash | white noise bandpass 5000 Q 0.3 g0.8 a 0.002 d 1.6; plus 4 detuned square partials (3100, 4300, 5700, 7200 Hz) g0.04 d 1.2 |
| 9 | ride | white noise bandpass 6000 Q 0.8 g0.3 d 0.9; sine 3400 Hz g0.15 d 0.6 (ride bell 53: sine 2800 g0.35 d 0.9) |
| 10 | cowbellMisc | two square oscs 560 and 845 Hz g0.5 bandpass 1200 Q 2 d 0.25 (cowbell 56); tuned variants for agogo, bongos, congas, timbales, claves, wood blocks, triangle, bells (pitch per key in the map) |
| 11 | shakerMisc | pink noise bandpass 4500 Q 1.5 g0.5 a 0.005 d 0.08 (shaker/maracas/cabasa 69-70); tambourine 54 adds square partials 6000/8000 Hz g0.08 d 0.15; guiro/whistle/cuica variants use amplitude LFO 25 Hz |

GM key -> drum voice (keys outside 35..81 map to `shakerMisc` with velocity reduced to 60
percent; parameters in parentheses are the per-key overrides):

| Key | Voice (override) | Key | Voice (override) | Key | Voice (override) |
|---|---|---|---|---|---|
| 35 | kick (start 120 Hz, d 0.45) | 51 | ride | 67 | cowbellMisc (1200 Hz) |
| 36 | kick | 52 | crash (bandpass 3500, d 1.2) | 68 | cowbellMisc (900 Hz) |
| 37 | rimshot | 53 | ride (bell variant) | 69 | shakerMisc |
| 38 | snare | 54 | shakerMisc (tambourine) | 70 | shakerMisc (d 0.06) |
| 39 | clap | 55 | crash (d 0.7, bandpass 7000) | 71 | shakerMisc (whistle: sine 2000 Hz LFO, d 0.15) |
| 40 | snare (noise g1.0, osc g0.4) | 56 | cowbellMisc | 72 | shakerMisc (whistle, d 0.5) |
| 41 | tom (90 Hz) | 57 | crash (bandpass 4200, d 1.8) | 73 | shakerMisc (guiro, d 0.12) |
| 42 | closedHat | 58 | shakerMisc (vibraslap: LFO 30 Hz, d 0.6) | 74 | shakerMisc (guiro, d 0.4) |
| 43 | tom (110 Hz) | 59 | ride (d 0.7) | 75 | cowbellMisc (claves: 2500 Hz, d 0.06) |
| 44 | pedalHat | 60 | cowbellMisc (bongo hi: sine 400 Hz, d 0.12) | 76 | cowbellMisc (wood block hi: 1800 Hz, d 0.07) |
| 45 | tom (135 Hz) | 61 | cowbellMisc (bongo lo: sine 300 Hz, d 0.14) | 77 | cowbellMisc (wood block lo: 1300 Hz, d 0.08) |
| 46 | openHat | 62 | cowbellMisc (conga mute: 260 Hz, d 0.08) | 78 | shakerMisc (cuica mute: 500 Hz LFO, d 0.15) |
| 47 | tom (160 Hz) | 63 | cowbellMisc (conga open: 230 Hz, d 0.3) | 79 | shakerMisc (cuica open: 400 Hz LFO, d 0.3) |
| 48 | tom (190 Hz) | 64 | cowbellMisc (conga low: 180 Hz, d 0.35) | 80 | cowbellMisc (triangle mute: 4200 Hz sine, d 0.08) |
| 49 | crash | 65 | cowbellMisc (timbale hi: 320 Hz, d 0.25) | 81 | cowbellMisc (triangle open: 4200 Hz sine, d 1.2) |
| 50 | tom (220 Hz) | 66 | cowbellMisc (timbale lo: 250 Hz, d 0.3) | | |

Hi-hat choke rule: a `closedHat` or `pedalHat` hit on a track releases any `openHat` voice
of that track within 20 ms (same for crash choke on CC 120). Drum voices ignore note-off and
never sustain; `endAudio` is ignored except as the latest possible stop.

#### 6.6.4 Algorithms

6.6.4.1 Definition resolution (at load): for each program `p`, `def.params = deepClone(
FAMILY_TEMPLATES[templateOf(p)])` then apply the override list; results are frozen. Each
template exposes `build(ctx, params, pitch, velocity, strip)` returning a `Voice`. The 128
definitions are validated at load by UT-06-01 (every referenced field exists in the schema).

6.6.4.2 Melodic voice build (`buildVoice(def, pitch, velocity, strip, at, end)`)
```text
p = def.params; layer = first p.layers with velocity <= maxVel
f0 = 440 * 2^((pitch - 69)/12) * (def.pitchOffsetSemis ? 2^(offset/12) : 1)
velGain = p.vel.min + (1 - p.vel.min) * (velocity/127)^p.vel.exp; gain = velGain * layer.gainMul * def.gain(1.0)
nodes:
  sources: for each osc: OscillatorNode(type, frequency f0*ratio, detune) -> oscGain(gain) -> mix
           if p.pluck: AudioBufferSourceNode(pluckBuffer(def, pitch, layerIndex)) -> mix
           if p.noise: BufferSource(noiseBuffer(color), loop) -> BiquadFilter(bandpass bandpassHz or f0*ratio, q) -> noiseGain (env: g at 'at', ramp to 0 over decay) -> mix
           if p.fm: modulator OscillatorNode(sine, f0*fm.ratio) -> modGain(index*f0 decaying to index*f0*0.1 over indexDecay) -> carrier.frequency
  filter: BiquadFilter(p.filter.type, Q) ; cutoff0 = p.filter.cutoff * layer.cutoffMul * (f0/261.63)^keyTrack
          peak = cutoff0 + p.filter.velCutoff * (velocity/127); env: setValueAtTime(cutoff0, at); linearRamp(peak, at+fa); setTargetAtTime(cutoff0 + (peak-cutoff0)*sustain, at+fa, fd/3)
  shaper: WaveShaperNode when def.params.waveshape (curve 1024 points of tanh(k x))
  amp: GainNode(0) ; gain.setValueAtTime(0, at); linearRamp(gain, at + a); linearRamp(gain * s, at + a + d); if decay2: setTargetAtTime(0, at + a + d, decay2)
  vibrato: strip's channel LFO -> perVoiceDepthGain -> every osc.detune (and buffer playbackRate via detune when pluck)
  bend: channelState.bendCents applied as osc.detune offset (added to vibrato), updated by setBend
  chain: mix -> filter -> (shaper) -> amp -> strip.input
start: all sources start(at); scheduled release: voice.release(end) when end given (Scheduler path)
release(t, rampS = p.amp.r): amp.gain.cancelScheduledValues(t); amp.gain.setValueAtTime(levelAt(t), t); linearRamp(0, t + rampS)
   stopAll sources at t + rampS + 0.02; onended of the last source -> dispose -> allocator.free(slot)
stop(t): amp ramp to 0 over 0.005 then stop sources at t + 0.01 (steal path)
levelAt(t): analytic envelope model from the stored (a, d, s, decay2, releaseStart, releaseRamp)
```
Mono templates (`mono:true`): a new note on the same track+channel while another is active
calls `release(at, 0.01)` on the previous voice (legato approximation, I 3.2).

6.6.4.3 Pluck buffer (`pluckBuffer(def, pitch, layer)`): Karplus-Strong computed in JS:
```text
sr = ctx.sampleRate; f0 = freq(pitch); N = max(2, round(sr / f0)); len = round(p.pluck.seconds * sr)
rng = new Prng(fnv1a32(def.program + ':' + pitch))          // deterministic excitation
ring = Float32Array(N): white noise in [-1,1]; apply pick position comb: ring[i] -= ring[(i + round(N*pickPos)) % N] * 0.5
lowpass the excitation by brightness: one-pole with coefficient (1 - brightness)
out = Float32Array(len); for i in 0..len-1: out[i] = ring[i % N]; next = damping * 0.5 * (ring[i%N] + ring[(i+1)%N]); ring[i%N] = next
normalize peak to 0.9; buffer = ctx.createBuffer(1, len, sr); copyToChannel(out, 0)
```
Cost: 3 s at 48 kHz is 144k iterations (about 0.3-0.6 ms). Cache key `program:pitch:layer`;
LRU eviction at the cap; `warm()` precomputes a range asynchronously (yield via
`Timers.setTimeout(0)` every 8 buffers) when the user selects a pluck instrument in Free Play.
Playback uses `playbackRate = 1` (each pitch has its own buffer); bend and vibrato use
`detune` on the buffer source.

6.6.4.4 `noteOn(track, note, at, end)` (scheduled path)
1. `cs = channelState(track.id, note.channel)`; `program = track.isDrums ? 'drums' : cs.program`
   (initialised from `track.program` by `setTrackProgram`; scheduled `ProgramEvent`s update
   it at their audio time through a sorted pending list consulted by `programAt(at)`).
2. Drums: `voiceIdx = DRUM_MAP[note.pitch]`; build the drum recipe; apply choke rule; acquire a
   slot with priority 2; start at `at`; the recipe schedules its own end (`<= 2 s`).
3. Melodic: `def = definition(program)`; if `note.pitch` outside `def.range`: still play (the
   range is advisory for mapping, not a mute) but log once `range-exceeded-<program>`.
   `slot = engine.voices.acquire({trackId, channel, pitch, priority}, at)`; `voice = buildVoice`;
   `slot.voice = voice`; `voice.start(at)`; `voice.release(end)` scheduled on the parameter
   timeline (no JS timers); `engine.voices.markReleased(slot, end, end + p.amp.r)` is
   scheduled by recording `releaseAt` on the slot so the allocator's steal order can treat it
   as released once `now >= end`.
4. Return the slot.

6.6.4.5 Program change: `control(track, {kind:'program', program, tick}, at)` pushes `{at,
program}` onto the channel's pending list; `programAt(t)` returns the latest entry with
`entry.at <= t`. Voices already sounding keep their patch (E 2.3: "program change while
sustaining" leaves existing voices unchanged). A program change on a drum track is recorded
but ignored for synthesis (GM kits are not distinguished in v1; logged once).

6.6.4.6 Pitch bend: value -8192..8191 -> `cents = value / 8192 * bendRangeSemis * 100`;
`cs.bendCents = cents`; for each active voice of the channel: `voice.setBend(cents, at)`
(`detune.setTargetAtTime(base + cents, at, 0.005)`); new voices read `cs.bendCents`. RPN
parsing: CC 101 (RPN MSB) and 100 (RPN LSB) set `cs.rpn`; CC 6 (data entry MSB) when `rpn ==
{0,0}` sets `bendRangeSemis = value` (0..24); CC 38 adds `value/128` semitones; CC 101=127 and
100=127 (null RPN) ends the sequence. Other RPN/NRPN numbers are ignored and logged once.

6.6.4.7 Controllers (`control` and `controlLive`):

| CC | Handling |
|---|---|
| 1 | `cs.modDepthCents = value / 127 * 50`; channel LFO depth gain ramps to it at `at`; vibrato auto-depth of the template adds to it |
| 6, 38, 100, 101 | RPN mechanism (6.6.4.6) |
| 7 | `strip.setVolumeCC(value / 127, at)` (strip gain = fader x CC7 x CC11) |
| 10 | `strip.setPan((value - 64) / 63, at)` clamped to -1..1 |
| 11 | `strip.setExpression(value / 127, at)` |
| 64 | `cs.sustain = value >= 64`. Live path: while true, `noteOffLive` moves the voice to `cs.sustainedLive` instead of releasing; on false, release every sustained voice at `at`. Scheduled path: the pedal is not interpreted in real time; `noteOn` extends `end` to the note's `DerivedNote.effectiveDurTicks` (Model `deriveSustain`, cached per track version) converted with `transport.audioTimeAt`, see 6.6.9 |
| 120 | all sound off: `stop(at)` every voice of the channel (5 ms ramp) |
| 121 | reset controllers: bend 0, mod 0, expression 127, sustain false (volume and pan unchanged per MIDI spec); release sustained live voices |
| 123 | all notes off: `release(at)` every voice of the channel with template release |
| 0, 32 | bank select: stored on the ProgramEvent, ignored for synthesis (one kit, one bank), logged once |
| others (2-5, 8-9, 12-31, 33-37, 39-63, 65-99, 102-119, 122, 124-127) | ignored; `Log.once('cc-unsupported-' + n, 'info', 'instruments', 'Unsupported controller ignored', {controller:n})`; counted in `stats().unsupportedCCs` |

6.6.4.8 `fidelity(program)`: from the definition: `level = def.fidelity`; `velocityLayers =
def.params.layers.length` (1 for synth-basic); `controllers = [1, 7, 10, 11, 64, 120, 121,
123]`; `articulations = def.params.mono ? ['legato'] : []`; `percussion = program === 'drums'`;
`label = level === 'synth-basic' ? 'Synthesized' : 'Synthesized, velocity-sensitive'`.
The UI never shows the word "sampled" for any v1 instrument (ADR-04).

6.6.4.9 Live input (`noteOnLive`): same as 6.6.4.4 without `end`; the slot is stored in
`cs.heldLive[pitch]`. `noteOffLive(trackId, channel, pitch, at)`: look up the slot; if
`cs.sustain` move to `sustainedLive`; else `voice.release(at)`; remove from `heldLive`. A
second `noteOnLive` for a pitch already held releases the old voice at `at` with 10 ms ramp
(retrigger) before starting the new one. `releaseTrack(trackId, at, rampS)` releases every
held and sustained live voice and every scheduled voice of the track (used by M-28 on mode
leave and by M-17 on track delete).

#### 6.6.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Program number outside 0..127 in a file | `definition()` clamps to 0 and logs `W-INS-PROGRAM` | playback with piano | n/a | no | inspection warning | n/a | n/a | UT-06-04 |
| Drum key unmapped (outside 35..81) | `DRUM_MAP` | plays `shakerMisc` quietly | n/a | no | none (documented in About) | n/a | n/a | UT-06-12 |
| Pluck cache memory pressure | cap reached | LRU eviction | n/a | no | none | recompute on demand | n/a | UT-06-09 |
| Web Audio node creation throws (`E-AUD-004`) | try/catch in `buildVoice` | other voices | hard panic by M-05 | no | toast "Audio was reset" | n/a | `onGraphRebuilt` | UT-06-19 |
| Unsupported controller | table | ignored | n/a | no | logged once; Diagnostics lists numbers | n/a | n/a | UT-06-16 |
| Sustain pedal never released (live) | voices accumulate in `sustainedLive` | allocator steals | n/a | no | panic key releases all | stealing | `controlLive(64, 0)` or panic | UT-06-15 |
| Instrument change while a live note is held (E 2.3) | `setTrackProgram` | old voice keeps old patch and releases normally on note-off | n/a | no | none | n/a | n/a | UT-06-17 |
| Voice `onended` never fires (node GC'd early) | allocator `releasedAt + releaseMax` watchdog in the 1 Hz stats pass frees slots whose release ended more than 1 s ago | pool recovers | n/a | no | none | n/a | automatic | UT-06-20 |

#### 6.6.6 Limits and performance notes

- Nodes per melodic voice: 2-5 sources, 1-2 filters, 1 optional shaper, 1-3 gains (<= 11
  nodes worst case, synthFx); drum hits <= 8 nodes; node lifetime bounded by `release + 20 ms`
  or the drum decay.
- Build cost per voice <= 0.15 ms desktop (measured by PT scenarios; target, not a result).
- Pluck cache <= 48 buffers desktop / 24 mobile, <= 3 s each.
- Vibrato: one LFO per (track, channel) that has ever used CC1 or an auto-vibrato template;
  created lazily; disposed by `onGraphRebuilt` and `dispose`.
- All definitions are frozen data; total source for the table and templates <= 60 KB.

#### 6.6.7 Spec coverage

B 11.2 (oscillator synthesis, envelope handling, polyphony), B 11.3 (levels 1-3 fully; level 4
"reasonable timbral similarity" is the declared aim of the family templates; level 5
articulations: legato only, declared), B 11.4 (pitch, velocity, duration, program, channel,
sustain, bend, modulation, volume and expression, pan, listed controllers; unsupported
controllers deterministic and documented), E 2.3 (program change while sustaining; repeated
same pitch; instrument change while holding), E 3.2 (percussion channel, bend during note,
pedal, out-of-range notes, multiple program changes), E 5.2 (instrument unavailable: never,
every program is defined), E 10 item 3 and 14 (MIDI is not audio; fidelity is visible),
I 3.1, I 3.2, I 3.4 (fidelity levels declared per instrument), I 16.1 (data-driven
definitions with name, program, percussion behavior, range, polyphony, animation profile,
supported controllers), P 6.1 (all twelve items).

#### 6.6.8 Unit tests (group `instruments`, file `src/91-test-instruments.js`; offline
context harness from 6.5.4.10 where sound is rendered)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-06-01 | definition table integrity | iterate 0..127 | 128 frozen defs; family = floor(p/8); template id exists; every override field is in the schema; range lo < hi within 0..127 |
| UT-06-02 | fidelity declarations | 0, 16, 109, 127, 'drums' | levels per 6.6.3; labels exact; `sampled === false` everywhere; no label contains 'sampl' |
| UT-06-03 | family coverage | group by template | each of the 16 templates used by at least one program |
| UT-06-04 | program clamp | `definition(200)`, `definition(-1)` | program 0 def; `W-INS-PROGRAM` logged |
| UT-06-05 | velocity curve and layers | piano at velocity 20, 64, 127 | gains strictly increasing; layer indexes 0, 1, 2; organ gains equal |
| UT-06-06 | offline onset and release timing | piano note at 1.0 s, end 1.5 s | onset within 3.7 ms of 1.0; level below 0.01 by `1.5 + r + 0.02` |
| UT-06-07 | pitch accuracy | render A4 (69) sine-heavy program 78 for 1 s | dominant zero-crossing frequency 440 within 0.5 percent |
| UT-06-08 | pluck buffer determinism | `pluckBuffer(25, 60, 1)` twice (cache cleared between) | identical sample data; length = 2.5 s x sr |
| UT-06-09 | pluck cache LRU | cap 4; request 5 pitches | 4 entries; first evicted; `stats().pluckCacheBytes` matches |
| UT-06-10 | mono legato | program 81, two overlapping live notes | first voice released with 10 ms ramp at the second onset |
| UT-06-11 | drum map table | keys 35, 42, 46, 49, 81, 20, 100 | voices kick, closedHat, openHat, crash, cowbellMisc, shakerMisc, shakerMisc |
| UT-06-12 | drum recipes render | each of 12 voices at velocity 100 | non-silent; total duration <= 2 s; peak <= 1.0 |
| UT-06-13 | hi-hat choke | openHat at 0, closedHat at 0.1 | open voice released at 0.1 (+/- 0.02) |
| UT-06-14 | program change keeps sounding voices | note at 0 (program 0), program 40 at 0.2, note at 0.3 | first voice def program 0; second program 40; `programOf` 40 |
| UT-06-15 | live sustain | `noteOnLive`, CC64 on, `noteOffLive`, CC64 off at 1.0 | voice released at 1.0 not at note-off; `sustainedLive` empty afterwards |
| UT-06-16 | unsupported CC logged once | CC 91 three times, CC 93 once | two `Log.once` entries; `stats().unsupportedCCs` = [91, 93]; no exception |
| UT-06-17 | instrument change while holding | live note, `setTrackProgram(..., 56)`, `noteOffLive` | old voice releases with piano release; next note uses brass |
| UT-06-18 | bend and RPN | RPN 0 range 12, bend +8191 | `cs.bendRangeSemis 12`; voice detune ~ +1200 cents; CC121 resets bend to 0 |
| UT-06-19 | node failure isolation | stub `ctx.createOscillator` throwing once | `E-AUD-004` reported; next note succeeds; no leaked slot (`activeCount` consistent) |
| UT-06-20 | slot watchdog | voice whose `onended` never fires (stub) | slot freed within the next stats pass after `releaseEnd + 1 s` |
| UT-06-21 | CC routing to strip | CC7 64, CC10 0, CC11 127 | strip volumeCC 0.504, pan -1 (clamped), expression 1.0 |
| UT-06-22 | all programs build | for p in 0..127: build a voice at pitch 60 velocity 100 in an offline context | no exception; node count per voice <= 11 |
| UT-06-23 | range advisory | program 56 (trumpet) note at pitch 30 | plays; `range-exceeded-56` logged once |
| UT-06-24 | releaseTrack | 3 scheduled + 2 live voices on track A, 1 on track B | A's 5 released; B untouched |

#### 6.6.9 Implementation notes and browser quirks

- Sustain in scheduled playback: M-05 passes `endAudio` computed from `note.durTicks`; M-06
  extends it to the derived duration when the track's `DerivedNote` layer (Model
  `deriveSustain`, cached per track version) marks the note `extendedBySustain`. The cached
  derived array is looked up by note id in a `Map` built with the index. This keeps CC 64 out
  of the real-time path and matches "sustain pedal changes note duration" (E 3.2).
- `OscillatorNode.detune` has a range of at least +/- 153,600 cents in all targets; bend plus
  vibrato stays within +/- 2,500 cents.
- Safari requires `AudioBufferSourceNode.start` before any `stop`; the steal path calls
  `stop(at)` only on started nodes (`started` flag per voice).
- `WaveShaperNode.curve` must be a `Float32Array`; curves are built once per `k` and shared.
- `setTargetAtTime` time constants: decay2 3.0 s means the piano reaches -60 dB after about 21
  s if held; the 60 s voice cap in M-05 is the hard stop.
- Node `onended` fires only for the source whose `stop` time passes; the voice attaches it to
  the last-stopping source and disposes all nodes with `disconnect()` there. Do not rely on GC
  to silence nodes.
- Firefox creates `BiquadFilterNode` with Q in dB for `lowshelf`/`highshelf` only; the
  templates use `lowpass`, `bandpass`, `highpass` where Q is linear everywhere.
