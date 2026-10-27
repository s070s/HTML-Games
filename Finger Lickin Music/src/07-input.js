// 07-input.js - M-07 FLM.Input: every physical input source (keyboard, pointer or touch pads, gamepad, optional Web
// MIDI) becomes one normalized InputEvent on input.event, with one lifecycle per control, key repeat and duplicate
// presses suppressed, every held control released when focus or the device goes away, and a performance-time to
// audio-time anchor (median of the last 20 samples).
// Separation rule: this file owns exactly one namespace (Input) and registers it once through FLM.Core.define.
// It may use only lower-numbered modules (Part 4.2, R-DEP). It declares no module-level global state object (S-07):
// all state lives inside the factory closure. It reads FLM.Audio and FLM.Transport lazily, because M-05 is built
// later (T04.01) and tests swap both namespaces.
// Delivered so far: T03.01 (keyboard, anchor), T03.02 (pointer, touch, gamepad, MIDI), T03.03 (lifecycle).
// EXTENSION POINT: T03.04 adds getMap, setMap, remap, unmap, resetMap, conflicts and the input.map event next to
// state.maps; T03.09 adds setCalibration and calibration.
// Spec: docs/IMPLEMENTATION-PLAN.md Part 6.7 (API 6.7.2, algorithms 6.7.4), Part 4.5 (anchor), ADR-10 (Part 2.10).
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Input', function (FLM) {
  const Core = FLM.Core;
  const bus = Core.bus;
  const Log = Core.Log;
  const doc = window.document;
  const nav = window.navigator;

  const INPUT_OWNER = Symbol('input');          // owner token of every listener and subscription of this module
  const NO_AUDIO_SOURCE = Object.freeze({});    // anchor source while M-05 does not exist (identity mapping)
  const SYSTEM = 'system';

  const ANCHOR_RING_SIZE = 20;                  // Part 4.5: the median of the 20 latest samples
  const ANCHOR_SAMPLE_GAP_MS = 25;              // samples are taken at most this often
  const ANCHOR_SPREAD_WARN_MS = 5;
  const ANCHOR_EVENT_SHIFT_SEC = 0.001;         // input.anchor fires only when the median moved by more than this
  const ANCHOR_EVENT_GAP_MS = 1000;             // and at most once per second
  const STAMP_SANITY_MS = 60000;                // an event stamp further from now than this is not performance-origin
  const MS_PER_SECOND = 1000;
  const MAX_POINTERS = 10;                      // pointer tracks kept; the oldest is dropped beyond this
  const PAD_COUNT = 4;
  const GAMEPAD_DOWN_LEVEL = 0.5;               // an analog button counts as pressed above this value
  const MOUSE_PRIMARY_BUTTON = 0;
  const DEFAULT_TOUCH_PRESSURE = 0.5;           // what pointer events report when the device has no pressure
  const MIDI_NOTE_OFF = 0x80;
  const MIDI_NOTE_ON = 0x90;
  const MIDI_CONTROL_CHANGE = 0xB0;
  const MIDI_STATUS_MASK = 0xF0;
  const MIDI_VELOCITY_MAX = 127;
  const MIDI_SUSTAIN_THRESHOLD = 64;
  const TEXT_TAGS = Object.freeze(['INPUT', 'TEXTAREA', 'SELECT']);
  const NEVER_PREVENTED = Object.freeze(['Escape']);   // the browser keeps Escape (fullscreen exit); pause still fires
  const TOUCH_API_VALUES = Object.freeze(['auto', 'pointer', 'touch']);
  const ACTIVE_LISTENER = Object.freeze({ passive: false });
  const DEBUG_SOURCES = Object.freeze(['gamepad', 'midi', 'pointer']);
  const CAPTURE_LISTENER = Object.freeze({ capture: true, passive: false });

  function deepFreeze(value) {
    Object.keys(value).forEach((key) => {
      if (value[key] !== null && typeof value[key] === 'object') deepFreeze(value[key]);
    });
    return Object.freeze(value);
  }

  // ---------------------------------------------------------------------------------------------
  // Control names, contexts and default maps (Part 6.7.1)
  // ---------------------------------------------------------------------------------------------
  const LANE_NAMES = Object.freeze(['lane0', 'lane1', 'lane2', 'lane3']);
  const DANCE_NAMES = Object.freeze(['dance0', 'dance1', 'dance2', 'dance3']);
  const PROFILE_NAMES = Object.freeze(['profile1', 'profile2', 'profile3', 'profile4', 'profile5', 'profile6']);
  const CONTROLS = Object.freeze([].concat(LANE_NAMES, DANCE_NAMES, ['pause', 'panic', 'octUp', 'octDown'],
    PROFILE_NAMES, ['sustain']));
  const CONTEXTS = Object.freeze(['menu', 'instrument', 'freeplay', 'dance', 'studio']);
  const PLAY_CONTROLS = [].concat(LANE_NAMES, ['octUp', 'octDown', 'sustain', 'pause', 'panic']);
  const LIVE_CONTROLS = deepFreeze({
    menu: [],
    instrument: PLAY_CONTROLS.slice(),
    freeplay: PLAY_CONTROLS.concat(PROFILE_NAMES),
    studio: PLAY_CONTROLS.concat(PROFILE_NAMES),
    dance: [].concat(DANCE_NAMES, ['pause', 'panic'])
  });
  const FREE_PLAY_CONTEXTS = Object.freeze(['freeplay', 'studio']);   // the contexts that accept midi:<n> controls

  function instrumentKeys() {
    return { lane0: ['KeyA'], lane1: ['KeyS'], lane2: ['KeyK'], lane3: ['KeyL'], octDown: ['KeyQ'], octUp: ['KeyE'],
      sustain: ['ShiftLeft', 'ShiftRight'] };
  }

  function freePlayKeys() {
    return Object.assign(instrumentKeys(), { profile1: ['Digit1'], profile2: ['Digit2'], profile3: ['Digit3'],
      profile4: ['Digit4'], profile5: ['Digit5'], profile6: ['Digit6'] });
  }

  const DEFAULT_MAPS = deepFreeze({
    version: 1,
    keyboard: {
      instrument: instrumentKeys(),
      freeplay: freePlayKeys(),
      studio: freePlayKeys(),
      dance: { dance0: ['ArrowLeft', 'KeyD'], dance1: ['ArrowDown', 'KeyF'], dance2: ['ArrowUp', 'KeyJ'],
        dance3: ['ArrowRight', 'KeyK'] },
      global: { pause: ['Escape'], panic: ['KeyP'], panicWhilePaused: ['Space'] }
    },
    midi: { lane0: 60, lane1: 62, lane2: 64, lane3: 65, sustainCC: 64 }
  });

  // Standard-mapping gamepad tables (Part 6.7.1): button index -> control. Fixed in v1, not remappable.
  const GAMEPAD_PLAY_MAP = Object.freeze({ 0: 'lane0', 1: 'lane1', 2: 'lane2', 3: 'lane3', 4: 'octDown',
    5: 'octUp', 6: 'sustain', 7: 'sustain', 8: 'panic', 9: 'pause', 12: 'octUp', 13: 'octDown' });
  const GAMEPAD_DANCE_MAP = Object.freeze({ 0: 'dance1', 1: 'dance3', 2: 'dance0', 3: 'dance2', 8: 'panic',
    9: 'pause', 12: 'dance2', 13: 'dance1', 14: 'dance0', 15: 'dance3' });

  // ---------------------------------------------------------------------------------------------
  // State (inside the closure, never module level)
  // ---------------------------------------------------------------------------------------------
  function newAnchor() {
    return { ring: new Float64Array(ANCHOR_RING_SIZE), filled: 0, next: 0, lastSampleMs: -Infinity, median: null,
      source: null, method: 'currentTime', spreadWarned: false, emittedOffset: null, emittedAtMs: -Infinity };
  }

  const state = {
    attached: null,                  // {target, padRoot, surface, offs[]} while init() is in force
    context: 'menu',
    maps: DEFAULT_MAPS,
    keyLookup: new Map(),            // physical code -> control for the current context plus the global table
    touchApi: 'auto',
    useTouchEvents: false,
    bindings: new Map(),             // owner -> context, one entry per bind()
    heldOrder: [],                   // control names in press order
    keysDown: new Set(),             // physical keys believed down
    tracks: new Map(),               // 'ptr<id>' or 't<id>' -> {key, padIndex}
    pads: { elements: [], rects: [], dirty: true },
    anchor: newAnchor(),
    gamepad: { prev: null, announced: new Map(), synthetic: undefined, nonStandardLogged: false },
    midi: { access: null, pending: null, stateOff: null, ports: new Map(), passThrough: false }
  };
  const records = new Map();         // control name -> {pressed, owner, tAudioPressed, tPerfPressed}, created lazily

  // ---------------------------------------------------------------------------------------------
  // Time: stamps and the audio anchor (Part 4.5, 6.7.4 A and B)
  // ---------------------------------------------------------------------------------------------
  /** The event's own performance-origin stamp when it is plausible, else the time of handling. */
  function stampOf(event) {
    const nowMs = Core.now();
    const stamp = event ? event.timeStamp : undefined;
    const plausible = Number.isFinite(stamp) && stamp > 0 && Math.abs(stamp - nowMs) < STAMP_SANITY_MS;
    return plausible ? stamp : nowMs;
  }

  /** One reading of the audio clock: {source, offsetSec, method}, or null while there is no running context. */
  function readClock(nowMs) {
    const audio = FLM.Audio;
    if (!audio || typeof audio.ctx !== 'function') {
      return { source: NO_AUDIO_SOURCE, offsetSec: 0, method: 'currentTime' };   // same as the Transport fallback clock
    }
    const context = audio.ctx();
    if (!context || context.state !== 'running') return null;
    const stamp = typeof context.getOutputTimestamp === 'function' ? context.getOutputTimestamp() : null;
    if (stamp && Number.isFinite(stamp.contextTime) && Number.isFinite(stamp.performanceTime) &&
      stamp.performanceTime > 0) {
      return { source: context, offsetSec: stamp.contextTime - stamp.performanceTime / MS_PER_SECOND,
        method: 'outputTimestamp' };
    }
    return { source: context, offsetSec: context.currentTime - nowMs / MS_PER_SECOND, method: 'currentTime' };
  }

  function clearAnchor() {
    const anchor = state.anchor;
    anchor.filled = 0;
    anchor.next = 0;
    anchor.lastSampleMs = -Infinity;
    anchor.median = null;
    anchor.source = null;
    anchor.spreadWarned = false;
  }

  function sortedSamples() {
    const anchor = state.anchor;
    return Array.from(anchor.ring.subarray(0, anchor.filled)).sort((a, b) => a - b);
  }

  function medianOf(sorted) {
    const middle = sorted.length >> 1;
    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function spreadMsOf(sorted) {
    return sorted.length === 0 ? 0 : (sorted[sorted.length - 1] - sorted[0]) * MS_PER_SECOND;
  }

  function jitterMsOf(sorted) {
    const quarter = sorted[Math.floor(sorted.length * 0.25)];
    const threeQuarters = sorted[Math.floor(sorted.length * 0.75)];
    return (threeQuarters - quarter) * MS_PER_SECOND;
  }

  function noteSpread(spreadMs) {
    const anchor = state.anchor;
    if (spreadMs > ANCHOR_SPREAD_WARN_MS && !anchor.spreadWarned) {
      Log.warn('input', 'INP_ANCHOR_SPREAD', { spreadMs: Math.round(spreadMs * 10) / 10 });
    }
    anchor.spreadWarned = spreadMs > ANCHOR_SPREAD_WARN_MS;
  }

  function emitAnchorIfMoved(nowMs, sorted) {
    const anchor = state.anchor;
    const first = anchor.emittedOffset === null;
    if (!first && Math.abs(anchor.median - anchor.emittedOffset) <= ANCHOR_EVENT_SHIFT_SEC) return;
    const gap = nowMs - anchor.emittedAtMs;
    if (!first && gap >= 0 && gap < ANCHOR_EVENT_GAP_MS) return;
    anchor.emittedOffset = anchor.median;
    anchor.emittedAtMs = nowMs;
    bus.emit('input.anchor', { offsetSec: anchor.median, samples: anchor.filled, jitterMs: jitterMsOf(sorted),
      method: anchor.method });
  }

  /** Takes one anchor sample when the last one is 25 ms old or older (or `force`). nowMs: performance time of now. */
  function sampleAnchor(nowMs, force) {
    const anchor = state.anchor;
    const gap = nowMs - anchor.lastSampleMs;
    if (!force && gap >= 0 && gap < ANCHOR_SAMPLE_GAP_MS) return;
    const reading = readClock(nowMs);
    if (!reading) return;
    if (anchor.source !== null && anchor.source !== reading.source) clearAnchor();   // a rebuilt context: new time base
    anchor.source = reading.source;
    anchor.method = reading.method;
    anchor.ring[anchor.next] = reading.offsetSec;
    anchor.next = (anchor.next + 1) % ANCHOR_RING_SIZE;
    anchor.filled = Math.min(anchor.filled + 1, ANCHOR_RING_SIZE);
    anchor.lastSampleMs = nowMs;
    const sorted = sortedSamples();
    anchor.median = medianOf(sorted);
    noteSpread(spreadMsOf(sorted));
    emitAnchorIfMoved(nowMs, sorted);
  }

  /** Performance time (ms) to audio time (s); null while no anchor exists. */
  function perfToAudio(tPerf) {
    const median = state.anchor.median;
    return median === null ? null : tPerf / MS_PER_SECOND + median;
  }

  /** The inverse mapping, used by the test fakes; identity (seconds to ms) while no anchor exists. */
  function audioToPerf(tAudio) {
    const median = state.anchor.median;
    return median === null ? tAudio * MS_PER_SECOND : (tAudio - median) * MS_PER_SECOND;
  }

  function anchorSummary() {
    const sorted = sortedSamples();
    return { samples: state.anchor.filled, offsetSec: state.anchor.median, spreadMs: spreadMsOf(sorted) };
  }

  /** Clears the ring and takes a fresh sample at once (the time base may have changed: unlock, rebuild, resume). */
  function resampleAnchor() {
    clearAnchor();
    sampleAnchor(Core.now(), true);
    return anchorSummary();
  }

  function audioTimeFor(tPerf) {
    sampleAnchor(Core.now(), false);
    return perfToAudio(tPerf);
  }

  // ---------------------------------------------------------------------------------------------
  // Control lifecycle: press and release (Part 6.7.4 F)
  // ---------------------------------------------------------------------------------------------
  function recordOf(control) {
    let record = records.get(control);
    if (!record) {
      record = { pressed: false, owner: null, tAudioPressed: null, tPerfPressed: null };
      records.set(control, record);
    }
    return record;
  }

  function sameOwner(a, b) {
    return a.source === b.source && a.physical === b.physical;
  }

  function isLive(control) {
    if (control.indexOf('midi:') === 0) return state.midi.passThrough && FREE_PLAY_CONTEXTS.includes(state.context);
    return LIVE_CONTROLS[state.context].includes(control);
  }

  function emitInput(source, control, type, tPerf, tAudio, pressure) {
    bus.emit('input.event', { source, control, type, tPerf, tAudio, pressure });
  }

  /** @returns {boolean} true when the press was accepted (live, and the control was idle) */
  function press(control, owner, tPerf, pressure) {
    if (!isLive(control)) return false;
    const record = recordOf(control);
    if (record.pressed) return false;       // a press from any owner while pressed is a duplicate
    const tAudio = audioTimeFor(tPerf);
    record.pressed = true;
    record.owner = owner;
    record.tAudioPressed = tAudio;
    record.tPerfPressed = tPerf;
    state.heldOrder.push(control);
    emitInput(owner.source, control, 'press', tPerf, tAudio, pressure === undefined ? 1 : pressure);
    return true;
  }

  /** Releases a control. owner: only that owner may release it; null releases whoever holds it (release-all). */
  function release(control, owner, tPerf, sourceOverride) {
    const record = records.get(control);
    if (!record || !record.pressed) return false;
    if (owner && !sameOwner(owner, record.owner)) return false;
    const holder = record.owner;
    record.pressed = false;
    record.owner = null;
    record.tAudioPressed = null;
    record.tPerfPressed = null;
    state.heldOrder.splice(state.heldOrder.indexOf(control), 1);
    emitInput(sourceOverride || holder.source, control, 'release', tPerf, audioTimeFor(tPerf), 0);
    return true;
  }

  /** Releases every control held by one source (device lost), reported with source 'system'. */
  function releaseOwnedBy(source, reason) {
    const tPerf = Core.now();
    const owned = state.heldOrder.filter((control) => records.get(control).owner.source === source);
    owned.forEach((control) => release(control, null, tPerf, SYSTEM));
    if (owned.length > 0) Log.info('input', 'INP_RELEASE_DEVICE', { source, reason, count: owned.length });
    return owned.length;
  }

  function releaseWhere(shouldRelease) {
    const tPerf = Core.now();
    state.heldOrder.filter(shouldRelease).forEach((control) => release(control, null, tPerf, SYSTEM));
  }

  /** Releases every pressed control with source 'system', in press order; reason is logged, not emitted. */
  function releaseAll(reason) {
    const count = state.heldOrder.length;
    releaseWhere(() => true);
    state.keysDown.clear();
    state.tracks.clear();
    if (state.gamepad.prev) state.gamepad.prev.buttons = {};
    if (count > 0) Log.info('input', 'INP_RELEASE_ALL', { reason: String(reason), count });
  }

  // ---------------------------------------------------------------------------------------------
  // Contexts and binding (Part 6.7.4 I)
  // ---------------------------------------------------------------------------------------------
  function buildKeyLookup(contextName) {
    const lookup = new Map();
    const addTable = (table) => Object.keys(table || {}).forEach((control) => {
      table[control].forEach((code) => { if (!lookup.has(code)) lookup.set(code, control); });
    });
    addTable(state.maps.keyboard[contextName]);
    addTable(state.maps.keyboard.global);
    return lookup;
  }

  function switchContext(next) {
    state.context = next;
    state.keyLookup = next === 'menu' ? new Map() : buildKeyLookup(next);
    releaseWhere((control) => !isLive(control));
    Array.from(state.keysDown).forEach((code) => { if (!state.keyLookup.has(code)) state.keysDown.delete(code); });
    state.pads.dirty = true;
  }

  /** Binds the input context of a mode; releases the controls that are not live in it (source 'system'). */
  function bind(opts) {
    const options = opts || {};
    Core.assert(CONTEXTS.includes(options.context), 'Input.bind needs a context: ' + CONTEXTS.join(', '));
    Core.assert(options.owner !== undefined && options.owner !== null, 'Input.bind needs an owner');
    state.bindings.set(options.owner, options.context);
    switchContext(options.context);
  }

  /** Releases everything and returns to the menu context. Unknown owners are ignored (panel modes never bind). */
  function unbind(owner) {
    if (!state.bindings.delete(owner)) return false;
    releaseAll('mode');
    const remaining = Array.from(state.bindings.values());
    switchContext(remaining.length > 0 ? remaining[remaining.length - 1] : 'menu');
    return true;
  }

  function controlsFor(contextName) {
    return LIVE_CONTROLS[contextName] ? LIVE_CONTROLS[contextName].slice() : [];
  }

  // ---------------------------------------------------------------------------------------------
  // Keyboard (Part 6.7.4 C)
  // ---------------------------------------------------------------------------------------------
  /** KeyboardEvent.code; a soft keyboard that reports '' still yields letters and digits from event.key. */
  function codeOf(event) {
    if (event.code) return event.code;
    const key = typeof event.key === 'string' ? event.key : '';
    if (/^[a-z]$/i.test(key)) return 'Key' + key.toUpperCase();
    if (/^[0-9]$/.test(key)) return 'Digit' + key;
    return '';
  }

  function transportIsPaused() {
    const transport = FLM.Transport;
    return Boolean(transport && transport.main && transport.main.state() === 'paused');
  }

  function resolveKeyControl(code) {
    const control = state.keyLookup.get(code);
    if (control === undefined) return null;
    if (control === 'panicWhilePaused') return transportIsPaused() ? 'panic' : null;
    return control;
  }

  function textFieldFocused() {
    const active = doc.activeElement;
    if (!active) return false;
    return TEXT_TAGS.includes(active.tagName) || active.isContentEditable === true;
  }

  function onKeyDown(event) {
    if (state.context === 'menu' || event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;      // browser shortcuts pass through
    const code = codeOf(event);
    const control = code === '' ? null : resolveKeyControl(code);
    if (control === null) return;
    if (textFieldFocused() && control !== 'pause') return;           // the keys belong to the text field
    if (!NEVER_PREVENTED.includes(code)) event.preventDefault();     // no page scroll from Space or arrows
    if (state.keysDown.has(code)) return;                            // a second keydown without keyup
    state.keysDown.add(code);
    press(control, { source: 'keyboard', physical: code }, stampOf(event), 1);
  }

  function holderOf(source, physical) {
    return state.heldOrder.find((control) => {
      const owner = records.get(control).owner;
      return owner.source === source && owner.physical === physical;
    });
  }

  function onKeyUp(event) {
    const code = codeOf(event);
    if (code === '') return;
    state.keysDown.delete(code);
    const control = holderOf('keyboard', code);   // by owner, so a late keyup after a system release does nothing
    if (control !== undefined) release(control, { source: 'keyboard', physical: code }, stampOf(event));
  }

  // ---------------------------------------------------------------------------------------------
  // System triggers (Part 6.7.4 F.4)
  // ---------------------------------------------------------------------------------------------
  function onBlur() {
    releaseAll('system');
  }

  function onPageHide() {
    releaseAll('system');
  }

  function onVisibilityChange() {
    if (doc.hidden) releaseAll('system');
  }

  // ---------------------------------------------------------------------------------------------
  // Pads, pointers and the Touch Events fallback (Part 6.7.4 D, ADR-10 decisions 2, 3 and 10)
  // ---------------------------------------------------------------------------------------------
  function refreshPadRects() {
    const padRoot = state.attached ? state.attached.padRoot : null;
    const pads = state.pads;
    pads.elements = padRoot ? Array.from(padRoot.querySelectorAll('.pad')).slice(0, PAD_COUNT) : [];
    pads.rects = pads.elements.map((element) => element.getBoundingClientRect());
    pads.dirty = false;
  }

  function padRectsStale() {
    const pads = state.pads;
    return pads.dirty || pads.elements.length === 0 || pads.elements.some((element) => !element.isConnected);
  }

  /** Index 0 to 3 of the pad under (x, y), or -1. Rects are cached and rebuilt after any layout change. */
  function padIndexAt(x, y) {
    if (padRectsStale()) refreshPadRects();
    return state.pads.rects.findIndex((rect) => rect.width > 0 && rect.height > 0 && x >= rect.left &&
      x < rect.right && y >= rect.top && y < rect.bottom);
  }

  function layoutChanged() {
    state.pads.dirty = true;
    if (state.attached) refreshPadRects();
  }

  function padControl(index) {
    return (state.context === 'dance' ? 'dance' : 'lane') + index;
  }

  function pressureOf(value) {
    return Number.isFinite(value) ? Core.clamp(value, 0, 1) : DEFAULT_TOUCH_PRESSURE;
  }

  function pointerOwner(key) {
    return { source: 'pointer', physical: key };
  }

  function dropOldestTrack() {
    const oldest = state.tracks.keys().next().value;
    const track = state.tracks.get(oldest);
    state.tracks.delete(oldest);
    if (track.padIndex >= 0) release(padControl(track.padIndex), pointerOwner(oldest), Core.now());
    Log.warn('input', 'INP_PTR_CAP', { dropped: oldest });
  }

  function beginTrack(key, x, y, tPerf, pressure) {
    if (state.tracks.has(key)) return false;
    const index = padIndexAt(x, y);
    if (index < 0) return false;
    if (state.tracks.size >= MAX_POINTERS) dropOldestTrack();
    state.tracks.set(key, { padIndex: index });
    press(padControl(index), pointerOwner(key), tPerf, pressure);
    return true;
  }

  /** A pointer that slides to another pad (or off every pad) releases the old pad, then presses the new one. */
  function moveTrack(key, x, y, tPerf, pressure) {
    const track = state.tracks.get(key);
    if (!track) return;
    const next = padIndexAt(x, y);
    if (next === track.padIndex) return;
    if (track.padIndex >= 0) release(padControl(track.padIndex), pointerOwner(key), tPerf);
    track.padIndex = next;
    if (next >= 0) press(padControl(next), pointerOwner(key), tPerf, pressure);
  }

  function endTrack(key, tPerf) {
    const track = state.tracks.get(key);
    if (!track) return;
    state.tracks.delete(key);
    if (track.padIndex >= 0) release(padControl(track.padIndex), pointerOwner(key), tPerf);
  }

  // Pointer Events (the primary path). Compatibility mouse events are never listened to, and pointerdown is
  // cancelled on a pad so the browser sends none. No pointer capture is requested: hit testing is by coordinates.
  function ignoredByTouchFallback(event) {
    return state.useTouchEvents && event.pointerType === 'touch';
  }

  function onPointerDown(event) {
    if (state.context === 'menu' || ignoredByTouchFallback(event)) return;
    if (event.pointerType === 'mouse' && event.button !== MOUSE_PRIMARY_BUTTON) return;
    const key = 'ptr' + event.pointerId;
    if (beginTrack(key, event.clientX, event.clientY, stampOf(event), pressureOf(event.pressure))) {
      event.preventDefault();
    }
  }

  function onPointerMove(event) {
    if (state.tracks.size === 0 || ignoredByTouchFallback(event)) return;
    moveTrack('ptr' + event.pointerId, event.clientX, event.clientY, stampOf(event), pressureOf(event.pressure));
  }

  function onPointerEnd(event) {
    if (state.tracks.size === 0 || ignoredByTouchFallback(event)) return;
    endTrack('ptr' + event.pointerId, stampOf(event));
  }

  // Touch Events: the OQ-1 fallback, selected by input.touchApi. Otherwise they only block page gestures.
  function touchForce(touch) {
    return Number.isFinite(touch.force) && touch.force > 0 ? Core.clamp(touch.force, 0, 1) : DEFAULT_TOUCH_PRESSURE;
  }

  function blockGesture(event) {
    if (state.context !== 'menu' && event.cancelable !== false) event.preventDefault();
  }

  function onTouchStart(event) {
    blockGesture(event);
    if (!state.useTouchEvents || state.context === 'menu') return;
    const tPerf = stampOf(event);
    Array.from(event.changedTouches).forEach((touch) => {
      beginTrack('t' + touch.identifier, touch.clientX, touch.clientY, tPerf, touchForce(touch));
    });
  }

  function onTouchMove(event) {
    blockGesture(event);
    if (!state.useTouchEvents) return;
    const tPerf = stampOf(event);
    Array.from(event.changedTouches).forEach((touch) => {
      moveTrack('t' + touch.identifier, touch.clientX, touch.clientY, tPerf, touchForce(touch));
    });
  }

  function onTouchEnd(event) {
    if (!state.useTouchEvents) return;
    const tPerf = stampOf(event);
    Array.from(event.changedTouches).forEach((touch) => endTrack('t' + touch.identifier, tPerf));
  }

  function onContextMenu(event) {
    if (state.context !== 'menu') event.preventDefault();
  }

  function setTouchApi(value) {
    const next = TOUCH_API_VALUES.includes(value) ? value : 'auto';
    const useTouch = next === 'touch' || (next === 'auto' && !('PointerEvent' in window));
    const changed = useTouch !== state.useTouchEvents;
    state.touchApi = next;
    state.useTouchEvents = useTouch;
    if (changed) releaseAll('context');     // never half the pointers on one API and half on the other
  }

  // ---------------------------------------------------------------------------------------------
  // Gamepad (Part 6.7.4 E)
  // ---------------------------------------------------------------------------------------------
  function isButtonDown(button) {
    return Boolean(button) && (button.pressed === true || button.value > GAMEPAD_DOWN_LEVEL);
  }

  function normalizeButton(button) {
    if (button !== null && typeof button === 'object') return button;
    return { pressed: Boolean(button), value: button ? 1 : 0 };
  }

  function normalizePad(pad) {
    const buttons = Array.isArray(pad.buttons) ? pad.buttons.map(normalizeButton) : [];
    return { index: pad.index === undefined ? 0 : pad.index, id: pad.id === undefined ? 'synthetic pad' : pad.id,
      mapping: pad.mapping === undefined ? 'standard' : pad.mapping, connected: pad.connected !== false, buttons };
  }

  function connectedPads() {
    const synthetic = state.gamepad.synthetic;
    if (synthetic !== undefined) return synthetic && synthetic.connected ? [synthetic] : [];
    if (typeof nav.getGamepads !== 'function') return [];
    try {
      return Array.from(nav.getGamepads()).filter((pad) => pad && pad.connected === true);
    } catch (error) {
      return [];     // a page that may not use gamepads (permissions policy) behaves as if none is connected
    }
  }

  function faultHolds(source) {
    const fault = Core.Faults.active('input.disconnect');
    return Boolean(fault) && fault.source === source;
  }

  function firstGamepad() {
    return faultHolds('gamepad') ? null : (connectedPads()[0] || null);
  }

  function announceConnect(pad) {
    if (state.gamepad.announced.has(pad.index)) return;
    state.gamepad.announced.set(pad.index, { id: String(pad.id), name: String(pad.id) });
    bus.emit('input.device', { source: 'gamepad', connected: true, id: String(pad.id), name: String(pad.id),
      index: pad.index });
  }

  function announceDisconnect(index) {
    const known = state.gamepad.announced.get(index);
    if (!known) return;
    state.gamepad.announced.delete(index);
    bus.emit('input.device', { source: 'gamepad', connected: false, id: known.id, name: known.name, index });
  }

  function loseGamepad() {
    const prev = state.gamepad.prev;
    state.gamepad.prev = null;
    releaseOwnedBy('gamepad', 'device');
    if (prev) announceDisconnect(prev.index);
  }

  function useNewPad(pad) {
    if (state.gamepad.prev) loseGamepad();
    state.gamepad.prev = { index: pad.index, buttons: {} };
    announceConnect(pad);
    if (pad.mapping !== 'standard' && !state.gamepad.nonStandardLogged) {
      state.gamepad.nonStandardLogged = true;
      Log.warn('input', 'INP_GP_NONSTANDARD', { mapping: String(pad.mapping) });
    }
  }

  function scanButtons(pad, tPerf) {
    const table = state.context === 'dance' ? GAMEPAD_DANCE_MAP : GAMEPAD_PLAY_MAP;
    const prev = state.gamepad.prev;
    Object.keys(table).forEach((name) => {
      const button = pad.buttons[name];
      const down = isButtonDown(button);
      if (down === Boolean(prev.buttons[name])) return;
      prev.buttons[name] = down;
      const owner = { source: 'gamepad', physical: 'gp' + name };
      if (!down) {
        release(table[name], owner, tPerf);
        return;
      }
      press(table[name], owner, tPerf, button.value > 0 ? Math.min(button.value, 1) : 1);
    });
  }

  /** Called once per render frame by the active mode: anchor sample plus gamepad edge detection. */
  function pollGamepad(tPerf) {
    const nowMs = Number.isFinite(tPerf) ? tPerf : Core.now();
    sampleAnchor(nowMs, false);
    const pad = firstGamepad();
    if (!pad) {
      if (state.gamepad.prev) loseGamepad();
      return;
    }
    if (!state.gamepad.prev || state.gamepad.prev.index !== pad.index) useNewPad(pad);
    if (state.context === 'menu') return;
    scanButtons(pad, nowMs);
  }

  function onGamepadConnected(event) {
    if (event.gamepad) announceConnect(event.gamepad);
  }

  function onGamepadDisconnected(event) {
    const pad = event.gamepad;
    if (!pad) return;
    const prev = state.gamepad.prev;
    if (prev && prev.index === pad.index) loseGamepad();     // release at once, not at the next poll
    else announceDisconnect(pad.index);
  }

  // ---------------------------------------------------------------------------------------------
  // Web MIDI (Part 6.7.4 G): only after the user enables it, only in a secure context
  // ---------------------------------------------------------------------------------------------
  function midiSupported() {
    return typeof nav.requestMIDIAccess === 'function';
  }

  function midiSecure() {
    return window.isSecureContext === true;
  }

  function midiControlForNote(note) {
    const lanes = state.maps.midi;
    const index = LANE_NAMES.findIndex((lane) => lanes[lane] === note);
    if (index >= 0) return padControl(index);
    return state.midi.passThrough ? 'midi:' + note : null;
  }

  function handleNote(note, velocity, on, tPerf) {
    const control = midiControlForNote(note);
    if (control === null) return;
    const owner = { source: 'midi', physical: 'n' + note };
    if (on) press(control, owner, tPerf, velocity / MIDI_VELOCITY_MAX);
    else release(control, owner, tPerf);
  }

  function handleSustain(value, tPerf) {
    const owner = { source: 'midi', physical: 'cc' + state.maps.midi.sustainCC };
    if (value >= MIDI_SUSTAIN_THRESHOLD) press('sustain', owner, tPerf, 1);
    else release('sustain', owner, tPerf);
  }

  function onMidiMessage(event) {
    const bytes = event.data;
    if (!bytes || bytes.length < 2 || faultHolds('midi')) return;
    const status = bytes[0] & MIDI_STATUS_MASK;
    const tPerf = stampOf(event);
    const velocity = bytes.length > 2 ? bytes[2] : 0;
    if (status === MIDI_NOTE_ON) handleNote(bytes[1], velocity, velocity > 0, tPerf);
    else if (status === MIDI_NOTE_OFF) handleNote(bytes[1], velocity, false, tPerf);
    else if (status === MIDI_CONTROL_CHANGE && bytes[1] === state.maps.midi.sustainCC) handleSustain(velocity, tPerf);
  }

  function emitMidiDevice(port, connected) {
    bus.emit('input.device', { source: 'midi', connected, id: String(port.id), name: String(port.name || port.id) });
  }

  function subscribePort(port) {
    if (!port || state.midi.ports.has(port.id)) return;
    const off = Core.dom.on(port, 'midimessage', onMidiMessage, undefined, INPUT_OWNER);
    state.midi.ports.set(port.id, { port, off });
    emitMidiDevice(port, true);
  }

  function unsubscribePort(port) {
    const entry = port ? state.midi.ports.get(port.id) : undefined;
    if (!entry) return;
    entry.off();
    state.midi.ports.delete(port.id);
    releaseOwnedBy('midi', 'device');
    emitMidiDevice(port, false);
  }

  function onMidiStateChange(event) {
    const port = event.port;
    if (!port || port.type !== 'input') return;
    if (port.state === 'connected') subscribePort(port);
    else unsubscribePort(port);
  }

  function subscribeAccess(access) {
    state.midi.access = access;
    state.midi.stateOff = Core.dom.on(access, 'statechange', onMidiStateChange, undefined, INPUT_OWNER);
    access.inputs.forEach((port) => subscribePort(port));
  }

  async function requestMidi() {
    try {
      const access = await nav.requestMIDIAccess({ sysex: false });
      if (!state.attached) return { ok: false, code: 'E-INP-002' };     // detached while the prompt was open
      subscribeAccess(access);
      return { ok: true };
    } catch (error) {
      Log.warn('input', 'INP_MIDI_DENIED', { reason: error && error.name ? error.name : 'error' });
      return { ok: false, code: 'E-INP-002' };
    }
  }

  /** User-triggered from Settings. Resolves {ok:true} or {ok:false, code:'E-INP-001' | 'E-INP-002'}. */
  function enableMidi() {
    if (state.midi.access) return Promise.resolve({ ok: true });
    if (!midiSupported() || !midiSecure()) return Promise.resolve({ ok: false, code: 'E-INP-001' });
    if (!state.midi.pending) {
      state.midi.pending = requestMidi().then((result) => {
        state.midi.pending = null;     // runs after the assignment, even when the request failed at once
        return result;
      });
    }
    return state.midi.pending;
  }

  function disableMidi() {
    state.midi.ports.forEach((entry) => entry.off());
    state.midi.ports.clear();
    if (state.midi.stateOff) state.midi.stateOff();
    state.midi.stateOff = null;
    state.midi.access = null;
    releaseOwnedBy('midi', 'device');
  }

  function setMidiPassThrough(on) {
    state.midi.passThrough = Boolean(on);
    if (!state.midi.passThrough) releaseWhere((control) => control.indexOf('midi:') === 0);
  }

  // ---------------------------------------------------------------------------------------------
  // Devices and fault injection
  // ---------------------------------------------------------------------------------------------
  function devices() {
    const names = [];
    state.midi.ports.forEach((entry) => names.push(String(entry.port.name || entry.port.id)));
    return {
      gamepads: connectedPads().map((pad) => ({ index: pad.index, id: String(pad.id), mapping: String(pad.mapping) })),
      midi: { supported: midiSupported(), secure: midiSecure(), enabled: state.midi.access !== null, inputs: names }
    };
  }

  function injectGamepadDisconnect() {
    const known = Array.from(state.gamepad.announced.keys());
    state.gamepad.prev = null;
    releaseOwnedBy('gamepad', 'fault');
    if (known.length === 0) {
      bus.emit('input.device', { source: 'gamepad', connected: false, id: 'injected', name: 'injected', index: 0 });
    }
    known.forEach(announceDisconnect);
  }

  /** The MIDI inputs report themselves disconnected, as a statechange event would. */
  function injectMidiDisconnect() {
    Array.from(state.midi.ports.values()).forEach((entry) => unsubscribePort(entry.port));
    releaseOwnedBy('midi', 'fault');
  }

  /** A pointercancel for every active pointer. */
  function injectPointerCancel() {
    const tPerf = Core.now();
    Array.from(state.tracks.keys()).forEach((key) => endTrack(key, tPerf));
  }

  /**
   * Test build and FLM.debug only: input.disconnect {source:'gamepad'|'midi'|'pointer'}. A gamepad or MIDI device
   * stays unplugged until debugClear.
   */
  function debugInject(fault, args) {
    if (fault !== 'input.disconnect') return false;
    const source = args && DEBUG_SOURCES.includes(args.source) ? args.source : 'gamepad';
    Core.Faults.set(fault, { source });
    if (source === 'midi') injectMidiDisconnect();
    else if (source === 'pointer') injectPointerCancel();
    else injectGamepadDisconnect();
    return true;
  }

  /** With a fault name it clears that fault; without one it also drops the synthetic gamepad. */
  function debugClear(fault) {
    if (fault === undefined || fault === 'input.disconnect') Core.Faults.clear('input.disconnect');
    if (fault === undefined) state.gamepad.synthetic = undefined;
  }

  // ---------------------------------------------------------------------------------------------
  // Anchor and layout subscriptions
  // ---------------------------------------------------------------------------------------------
  function onAudioState(event) {
    if (event && event.state !== 'running') clearAnchor();
  }

  function onAudioUnlocked() {
    resampleAnchor();
  }

  function onLayout() {
    state.pads.dirty = true;
  }

  function onSettingsChanged(event) {
    if (!event) return;
    if (event.key === 'input.touchApi') setTouchApi(event.value);
    else if (event.key === '*' || String(event.key).indexOf('input.pad') === 0) state.pads.dirty = true;
  }

  // ---------------------------------------------------------------------------------------------
  // init and detach (Part 6.7.2): every listener goes through Core.dom with the module's owner token
  // ---------------------------------------------------------------------------------------------
  function listen(target, type, handler, options) {
    state.attached.offs.push(Core.dom.on(target, type, handler, options, INPUT_OWNER));
  }

  function installWindowListeners(target) {
    listen(target, 'keydown', onKeyDown);
    listen(target, 'keyup', onKeyUp);
    listen(target, 'blur', onBlur);
    listen(target, 'pagehide', onPageHide);
    listen(target, 'resize', onLayout);
    listen(target, 'orientationchange', onLayout);
    listen(target, 'gamepadconnected', onGamepadConnected);
    listen(target, 'gamepaddisconnected', onGamepadDisconnected);
    listen(doc, 'visibilitychange', onVisibilityChange);
  }

  function installPadListeners(padRoot) {
    listen(padRoot, 'pointerdown', onPointerDown, ACTIVE_LISTENER);
    listen(padRoot, 'pointermove', onPointerMove, ACTIVE_LISTENER);
    listen(padRoot, 'pointerleave', onPointerEnd, ACTIVE_LISTENER);
    // The end of a pointer is heard on the document, in the capture phase: a finger that lifts off the pads (or
    // whose pad was rebuilt) still releases the pad it owned, and no widget can swallow the event first.
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
      listen(doc, type, onPointerEnd, CAPTURE_LISTENER);
    });
    listen(padRoot, 'touchstart', onTouchStart, ACTIVE_LISTENER);
    listen(padRoot, 'touchmove', onTouchMove, ACTIVE_LISTENER);
    listen(padRoot, 'touchend', onTouchEnd, ACTIVE_LISTENER);
    listen(padRoot, 'touchcancel', onTouchEnd, ACTIVE_LISTENER);
    listen(padRoot, 'contextmenu', onContextMenu, ACTIVE_LISTENER);
  }

  function installSurfaceListeners(surface) {
    listen(surface, 'touchstart', blockGesture, ACTIVE_LISTENER);
    listen(surface, 'touchmove', blockGesture, ACTIVE_LISTENER);
    listen(surface, 'contextmenu', onContextMenu, ACTIVE_LISTENER);
  }

  /** Installs the listeners once (boot step B9). opts: {keyboardTarget, padRoot, surface, touchApi?}. */
  function init(opts) {
    if (state.attached) {
      const error = new Error('E-GEN-004: Input.init twice');
      error.code = 'E-GEN-004';
      Core.ErrorReporter.report('E-GEN-004', error, { module: 'Input' });
      throw error;
    }
    const options = opts || {};
    const target = options.keyboardTarget || window;
    state.attached = { target, padRoot: options.padRoot || null, surface: options.surface || null, offs: [] };
    state.bindings.clear();
    state.context = 'menu';
    state.keyLookup = new Map();
    setTouchApi(options.touchApi);
    installWindowListeners(target);
    if (state.attached.padRoot) installPadListeners(state.attached.padRoot);
    if (state.attached.surface) installSurfaceListeners(state.attached.surface);
    bus.on('audio.state', onAudioState, INPUT_OWNER);
    bus.on('audio.unlocked', onAudioUnlocked, INPUT_OWNER);
    bus.on('ui.layout', onLayout, INPUT_OWNER);
    bus.on('settings.changed', onSettingsChanged, INPUT_OWNER);
    state.pads.dirty = true;
  }

  /** Releases everything, stops MIDI and removes every listener. Safe when not attached. */
  function detach() {
    if (!state.attached) return;
    releaseAll('system');
    disableMidi();
    state.attached.offs.forEach((off) => off());
    bus.removeOwner(INPUT_OWNER);
    state.attached = null;
    state.bindings.clear();
    state.context = 'menu';
    state.keyLookup = new Map();
    state.pads.elements = [];
    state.pads.rects = [];
    state.pads.dirty = true;
    state.gamepad.prev = null;
    state.gamepad.announced.clear();
    state.midi.passThrough = false;
    clearAnchor();
  }

  function listenerCount() {
    const own = state.attached ? state.attached.offs.length : 0;
    return own + state.midi.ports.size + (state.midi.stateOff ? 1 : 0);
  }

  // ---------------------------------------------------------------------------------------------
  // Test build only: synthetic events through the same handlers the browser calls
  // ---------------------------------------------------------------------------------------------
  function syntheticEvent(fields, tPerf) {
    const event = Object.assign({ timeStamp: tPerf, defaultPrevented: false, cancelable: true }, fields);
    event.preventDefault = function () { event.defaultPrevented = true; };
    return event;
  }

  const POINTER_HANDLERS = Object.freeze({ down: onPointerDown, move: onPointerMove, up: onPointerEnd,
    cancel: onPointerEnd });

  const synthesizer = Object.freeze({
    /** @returns {{defaultPrevented:boolean}} the event the handler saw */
    key(code, down, tPerf, mods) {
      const extra = mods || {};
      const event = syntheticEvent({ code, key: extra.key || '', repeat: Boolean(extra.repeat),
        ctrlKey: Boolean(extra.ctrlKey), metaKey: Boolean(extra.metaKey), altKey: Boolean(extra.altKey) }, tPerf);
      if (down) onKeyDown(event);
      else onKeyUp(event);
      return event;
    },
    pointer(pointerId, type, x, y, pressure, tPerf, pointerType) {
      const handler = POINTER_HANDLERS[type];
      Core.assert(handler !== undefined, 'synthesize.pointer type must be down, move, up or cancel');
      const event = syntheticEvent({ pointerId, clientX: x, clientY: y, pressure, button: MOUSE_PRIMARY_BUTTON,
        pointerType: pointerType || 'touch' }, tPerf);
      handler(event);
      return event;
    },
    gamepad(stateOrNull) {
      state.gamepad.synthetic = stateOrNull === null ? null : normalizePad(stateOrNull);
    },
    midi(bytes, tPerf) {
      // As in a browser, a message only arrives while MIDI is enabled.
      if (state.midi.access) onMidiMessage(syntheticEvent({ data: bytes }, tPerf));
    },
    blur() { onBlur(); },
    hidden() { releaseAll('system'); },
    pagehide() { onPageHide(); }
  });

  return Object.freeze({
    init, detach, bind, unbind,
    boundSurfaces: () => state.bindings.size,
    context: () => state.context,
    pollGamepad, releaseAll,
    held: () => state.heldOrder.slice(),
    State: Object.freeze({
      isHeld: (control) => Boolean(records.get(control) && records.get(control).pressed),
      pressedAt: (control) => (records.get(control) ? records.get(control).tAudioPressed : null),
      owner: (control) => {
        const record = records.get(control);
        return record && record.pressed ? Object.assign({}, record.owner) : null;
      }
    }),
    CONTROLS, DEFAULT_MAPS, controlsFor,
    perfToAudio, audioToPerf, anchor: anchorSummary, resampleAnchor,
    devices, enableMidi, disableMidi, setMidiPassThrough,
    listenerCount, layoutChanged, debugInject, debugClear,
    /** Undefined in the shipped build: FLM.SelfTest exists only in the test build. */
    get synthesize() { return FLM.SelfTest ? synthesizer : undefined; }
  });
});
})();
