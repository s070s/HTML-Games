// 27-screens.js - M-27 FLM.Screens (Phase 01 step T01.08): the settings store FLM.Screens.Settings.
// Separation rule: this file owns exactly one namespace (Screens) and registers it once through
// FLM.Core.define. It may use only lower-numbered modules (Core, Storage, UI). It declares no module-level
// global state object (S-07): the settings document lives inside the factory closure.
// EXTENSION POINT: T01.10 and T01.11 add SCREENS, DIALOGS, register, get, show, dialog, showError, the screen
// controllers and the dialog builders to the object returned at the bottom of this factory; later tasks add
// Tutorial, codeLabel, padWords and counters. Do not register a second FLM.Screens namespace.
// Spec: docs/IMPLEMENTATION-PLAN.md Part 6.27.2 and 6.27.4.2 (settings store), Part 5.11 (schema), Part 5.14.2.
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Screens', function (FLM) {
  const Core = FLM.Core;

  const SETTINGS_VERSION = 1;
  const DEBOUNCE_MS = 250;                   // Part 5.11: settings writes are debounced
  const EXPORT_FORMAT = 'flm-settings';
  const IMPORT_LIMIT_CHARS = 256 * 1024;     // a settings backup is far smaller; refuse anything larger
  const EXPORT_INDENT = 1;
  const ROUNDING = 1e6;                      // removes floating point noise after step snapping
  const SOURCES = Object.freeze(['ui', 'wizard', 'url', 'load', 'reset']);
  const UNSAFE_NAMES = Object.freeze(['__proto__', 'constructor', 'prototype']);
  const IMMEDIATE_PREFIXES = Object.freeze(['onboarding.', 'input.keys.', 'calibration.']);
  const CODE_PATTERN = /^[A-Za-z0-9]{1,32}$/;
  const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
  const RELAY_PATTERN = /^$|^wss?:\/\/\S+$/;
  const MAX_USER_SCALES = 64;
  const TEXT = Object.freeze({
    saveFailed: 'Settings could not be saved in this browser. They are kept until you close the page.',
    importNewer: 'These settings were saved by a newer version of the game and cannot be imported.',
    importInvalid: 'This file is not a settings backup.'
  });

  // ---------------------------------------------------------------- the Part 5.11 table
  const bool = () => ({ type: 'bool' });
  const int = (min, max, extra) => Object.assign({ type: 'int', min, max }, extra);
  const float = (min, max, extra) => Object.assign({ type: 'float', min, max }, extra);
  const choice = (values) => ({ type: 'enum', values });
  const word = (min, max, extra) => Object.assign({ type: 'text', min, max, pattern: ID_PATTERN }, extra);
  const codes = (count) => ({ type: 'codes', count });
  const code = () => ({ type: 'text', min: 1, max: 32, pattern: CODE_PATTERN });

  const FREE_PLAY_FIELDS = {
    program: { spec: int(0, 127), default: 0 }, key: { spec: int(0, 11), default: 0 },
    scale: { spec: word(1, 64), default: 'major' }, octave: { spec: int(2, 6), default: 4 },
    profile: { spec: word(1, 64), default: 'D' }, quantize: { spec: bool(), default: false },
    noteDurMs: { spec: int(50, 2000), default: 400 }, velocity: { spec: int(1, 127), default: 100 },
    sustain: { spec: bool(), default: false }
  };
  const QUICK_PLAY_FIELDS = {
    songId: { spec: word(1, 64), default: 'demo-poprock' }, instrument: { spec: int(0, 127), default: 0 },
    difficulty: { spec: word(1, 64), default: 'beginner' }, profile: { spec: word(1, 64), default: 'A' }
  };
  const DANCE_FIELDS = {
    difficulty: { spec: word(1, 64), default: 'easy' }, layout: { spec: word(1, 64), default: 'arrows' },
    practiceSpeed: { spec: float(0.5, 1), default: 1 }
  };
  const LIBRARY_FIELDS = {
    query: { spec: { type: 'text', min: 0, max: 100 }, default: '' },
    sort: { spec: choice(['recent', 'name']), default: 'recent' }, scroll: { spec: int(0, 1000000), default: 0 }
  };
  const objectOf = (fields) => ({ type: 'object', fields });

  // [path, spec, default, comparable]: comparable is 'yes', 'default' (only the default value keeps results
  // comparable) or 'n/a' (not a gameplay setting).
  const ROWS = [
    ['audio.masterVolume', float(0, 1), 0.8, 'yes'],
    ['audio.metronomeVolume', float(0, 1), 0.6, 'yes'],
    ['audio.metronomeAccent', bool(), true, 'yes'],
    ['audio.polyphonyCap', int(16, 64, { zero: true }), 0, 'yes'],
    ['audio.countInBars', int(1, 2), 1, 'yes'],
    ['audio.reverbEnabled', bool(), false, 'yes'],
    ['audio.reverbAmount', float(0, 1), 0.2, 'yes'],
    ['calibration.inputOffsetMs', int(-200, 200), 0, 'yes'],
    ['calibration.audioLatencyMs', int(0, 500), 0, 'yes'],
    ['calibration.visualLeadMs', int(600, 3000), 1500, 'yes'],
    ['input.keymapVersion', int(1, 1), 1, 'n/a'],
    ['input.keys.lanes', codes(4), ['KeyA', 'KeyS', 'KeyK', 'KeyL'], 'yes'],
    ['input.keys.dance', codes(4), ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'], 'yes'],
    ['input.keys.danceAlt', codes(4), ['KeyD', 'KeyF', 'KeyJ', 'KeyK'], 'yes'],
    ['input.keys.pause', code(), 'Escape', 'yes'],
    ['input.keys.panic', code(), 'KeyP', 'yes'],
    ['input.keys.octUp', code(), 'KeyE', 'yes'],
    ['input.keys.octDown', code(), 'KeyQ', 'yes'],
    ['input.keys.profiles', codes(6), ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'], 'yes'],
    ['input.keys.sustain', code(), 'ShiftLeft', 'yes'],
    ['input.padLayout', choice(['bottom', 'right']), 'bottom', 'yes'],
    ['input.padSize', choice(['small', 'medium', 'large']), 'medium', 'yes'],
    ['input.padOpacity', float(0.3, 1), 0.75, 'yes'],
    ['input.gamepadEnabled', bool(), true, 'yes'],
    ['input.touchApi', choice(['auto', 'pointer', 'touch']), 'auto', 'yes'],
    ['input.padsVisible', choice(['auto', 'always', 'never']), 'auto', 'yes'],
    ['input.midiEnabled', bool(), false, 'yes'],
    ['input.midiLaneNotes', { type: 'ints', count: 4, min: 0, max: 127 }, [60, 62, 64, 65], 'yes'],
    ['input.chordWindowMs', int(10, 60), 30, 'yes'],
    ['gameplay.judgmentPreset', choice(['standard', 'relaxed', 'strict']), 'standard', 'default'],
    ['gameplay.strayPressPenalty', bool(), false, 'yes'],
    ['gameplay.showJudgmentText', bool(), true, 'yes'],
    ['gameplay.targetTrackMode', choice(['mute', 'lower', 'full']), 'lower', 'yes'],
    ['gameplay.accompanimentVolume', float(0, 1), 1, 'yes'],
    ['gameplay.autoCountIn', bool(), true, 'yes'],
    ['gameplay.lifeBar', bool(), false, 'yes'],
    ['video.tier', choice(['auto', 'high', 'balanced', 'low', 'abstract']), 'auto', 'yes'],
    ['video.resolutionScale', float(0.5, 1, { step: 0.05, zero: true }), 0, 'yes'],
    ['video.cameraMotion', bool(), true, 'yes'],
    ['video.cameraPreset', choice(['FullBand', 'Focus', 'Side', 'Overhead', 'Player']), 'FullBand', 'yes'],
    ['video.effectsLevel', int(0, 2), 2, 'yes'],
    ['video.reducedMotion', choice(['system', 'on', 'off']), 'system', 'yes'],
    ['video.highContrast', bool(), false, 'yes'],
    ['video.uiScale', float(0.8, 1.5, { step: 0.05 }), 1, 'yes'],
    ['video.showStats', bool(), false, 'yes'],
    ['video.stageTheme', word(1, 64), 'default', 'yes'],
    ['accessibility.laneGlyphs', bool(), true, 'yes'],
    ['accessibility.screenReaderLabels', bool(), true, 'yes'],
    ['accessibility.flashOnBeat', bool(), false, 'yes'],
    ['accessibility.largeJudgmentText', bool(), false, 'yes'],
    ['privacy', objectOf({}), {}, 'n/a'],
    ['net.displayName', { type: 'text', min: 1, max: 24 }, 'Player', 'n/a'],
    ['net.stunEnabled', bool(), false, 'n/a'],
    ['net.relayUrl', { type: 'text', min: 0, max: 200, pattern: RELAY_PATTERN }, '', 'n/a'],
    ['onboarding.firstLaunchDone', bool(), false, 'n/a'],
    ['onboarding.inputMode', choice(['auto', 'desktop', 'touch']), 'auto', 'n/a'],
    ['onboarding.tutorialDone', bool(), false, 'n/a'],
    ['onboarding.audioHintSeen', bool(), false, 'n/a'],
    ['onboarding.lastMode', { type: 'text', min: 1, max: 20, pattern: /^[a-z]+$/ }, 'menu', 'n/a'],
    ['session.quickPlay', objectOf(QUICK_PLAY_FIELDS), fieldDefaults(QUICK_PLAY_FIELDS), 'n/a'],
    ['session.freePlay', objectOf(FREE_PLAY_FIELDS), fieldDefaults(FREE_PLAY_FIELDS), 'n/a'],
    ['session.dance', objectOf(DANCE_FIELDS), fieldDefaults(DANCE_FIELDS), 'n/a'],
    ['session.libraryFilter', objectOf(LIBRARY_FIELDS), fieldDefaults(LIBRARY_FIELDS), 'n/a'],
    ['session.lastProjectId', word(1, 64, { nullable: true }), null, 'n/a'],
    ['diagnostics.overlay', bool(), false, 'n/a'],
    ['diagnostics.logLevel', choice(['info', 'debug']), 'info', 'n/a'],
    ['diagnostics.selfTestLastRun', { type: 'text', min: 1, max: 40, nullable: true }, null, 'n/a'],
    ['settings.userScales', { type: 'scales' }, [], 'n/a']
  ];

  function fieldDefaults(fields) {
    const defaults = {};
    Object.keys(fields).forEach((name) => { defaults[name] = fields[name].default; });
    return defaults;
  }

  // ---------------------------------------------------------------- small object helpers
  const isPlain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const copy = (value) => (value === undefined ? undefined : Core.deepClone(value));

  function getPath(root, path) {
    return path.split('.').reduce((node, name) => (isPlain(node) ? node[name] : undefined), root);
  }

  function setPath(root, path, value) {
    const names = path.split('.');
    const last = names.pop();
    const holder = names.reduce((node, name) => {
      if (!isPlain(node[name])) node[name] = {};
      return node[name];
    }, root);
    holder[last] = value;
  }

  function sameValue(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
    }
    if (isPlain(a) && isPlain(b)) {
      const names = Object.keys(a);
      const sameKeys = names.length === Object.keys(b).length;
      return sameKeys && names.every((name) => hasOwn(b, name) && sameValue(a[name], b[name]));
    }
    return Object.is(a, b);
  }

  function deepFreeze(value) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach((name) => deepFreeze(value[name]));
    }
    return value;
  }

  // ---------------------------------------------------------------- schema, defaults, coercion
  const SCHEMA = {};
  const DEFAULTS = { version: SETTINGS_VERSION, x: {} };      // x holds the keys this version does not know
  const GROUP_PATHS = new Set();             // every proper prefix of a schema path (audio, input.keys, ...)

  ROWS.forEach((row) => {
    const path = row[0];
    SCHEMA[path] = Object.assign({}, row[1], {
      default: copy(row[2]), comparable: row[3], immediate: IMMEDIATE_PREFIXES.some((prefix) => path.startsWith(prefix))
    });
    setPath(DEFAULTS, path, copy(row[2]));
    path.split('.').slice(0, -1).reduce((prefix, name) => {
      const group = prefix === '' ? name : prefix + '.' + name;
      GROUP_PATHS.add(group);
      return group;
    }, '');
  });
  deepFreeze(SCHEMA);
  deepFreeze(DEFAULTS);

  const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
  const accepted = (value) => ({ ok: true, value, adjusted: false });
  const adjustedTo = (value) => ({ ok: true, value, adjusted: true });
  const rejected = (spec) => ({ ok: false, value: copy(spec.default), adjusted: true });

  // The nearest allowed number: a "zero allowed" setting (auto) takes 0 below half of its minimum.
  function limitNumber(spec, number) {
    if (spec.zero && number === 0) return 0;
    if (spec.zero && number < spec.min / 2) return 0;
    const clamped = Core.clamp(number, spec.min, spec.max);
    if (!spec.step) return clamped;
    const snapped = spec.min + Math.round((clamped - spec.min) / spec.step) * spec.step;
    return Math.round(snapped * ROUNDING) / ROUNDING;
  }

  function coerceNumber(spec, raw) {
    if (!isNumber(raw)) return rejected(spec);
    const number = spec.type === 'int' ? Math.round(raw) : raw;
    const limited = limitNumber(spec, number);
    return limited === raw ? accepted(limited) : adjustedTo(limited);
  }

  function coerceBool(spec, raw) {
    return typeof raw === 'boolean' ? accepted(raw) : rejected(spec);
  }

  function coerceEnum(spec, raw) {
    return spec.values.includes(raw) ? accepted(raw) : rejected(spec);
  }

  function coerceText(spec, raw) {
    if (raw === null && spec.nullable) return accepted(null);
    const fits = typeof raw === 'string' && raw.length >= spec.min && raw.length <= spec.max;
    return fits && (!spec.pattern || spec.pattern.test(raw)) ? accepted(raw) : rejected(spec);
  }

  function coerceCodes(spec, raw) {
    const valid = Array.isArray(raw) && raw.length === spec.count && raw.every((item) => CODE_PATTERN.test(item)) &&
      new Set(raw).size === spec.count;
    return valid ? accepted(raw.slice()) : rejected(spec);
  }

  function coerceInts(spec, raw) {
    const inRange = (item) => Number.isInteger(item) && item >= spec.min && item <= spec.max;
    const valid = Array.isArray(raw) && raw.length === spec.count && raw.every(inRange) &&
      new Set(raw).size === spec.count;
    return valid ? accepted(raw.slice()) : rejected(spec);
  }

  // A fixed-shape object: each known field is coerced on its own, missing fields take their default, extra fields
  // are dropped.
  function coerceObject(spec, raw) {
    if (!isPlain(raw)) return rejected(spec);
    const value = {};
    let adjusted = false;
    Object.keys(spec.fields).forEach((name) => {
      const field = spec.fields[name];
      const missing = raw[name] === undefined;
      const result = missing ? accepted(copy(field.default)) : coerce(field.spec, raw[name], field.default);
      value[name] = result.value;
      adjusted = adjusted || !result.ok || result.adjusted;
    });
    return adjusted ? adjustedTo(value) : accepted(value);
  }

  function validScale(item) {
    const intervals = isPlain(item) ? item.intervals : null;
    const named = isPlain(item) && ID_PATTERN.test(item.id) && typeof item.name === 'string' &&
      item.name.length >= 1 && item.name.length <= 24;
    const steps = Array.isArray(intervals) && intervals.length > 0 && intervals[0] === 0 &&
      intervals.every((step, index) => Number.isInteger(step) && step >= 0 && step <= 11 &&
        (index === 0 || step > intervals[index - 1]));
    return named && steps;
  }

  function coerceScales(spec, raw) {
    if (!Array.isArray(raw)) return rejected(spec);
    const kept = raw.filter(validScale).slice(0, MAX_USER_SCALES)
      .map((item) => ({ id: item.id, name: item.name, intervals: item.intervals.slice() }));
    return kept.length === raw.length ? accepted(kept) : adjustedTo(kept);
  }

  const COERCERS = {
    bool: coerceBool, int: coerceNumber, float: coerceNumber, enum: coerceEnum, text: coerceText,
    codes: coerceCodes, ints: coerceInts, object: coerceObject, scales: coerceScales
  };

  /** @returns {{ok:boolean, value:*, adjusted:boolean}} ok false = the raw value was unusable (default returned) */
  function coerce(spec, raw, fallback) {
    const result = COERCERS[spec.type](spec, raw);
    if (!result.ok && fallback !== undefined) result.value = copy(fallback);
    return result;
  }

  // Keys the schema does not know are kept under `x` like projects do (Part 5.11).
  function collectUnknown(node, prefix, target) {
    Object.keys(node).forEach((name) => {
      const path = prefix === '' ? name : prefix + '.' + name;
      const reserved = prefix === '' && (name === 'version' || name === 'x');
      if (reserved || UNSAFE_NAMES.includes(name) || hasOwn(SCHEMA, path)) return;
      if (GROUP_PATHS.has(path)) {
        if (isPlain(node[name])) collectUnknown(node[name], path, target);
        return;
      }
      setPath(target, path, copy(node[name]));
    });
  }

  /** Deep-merge over the defaults, clamp, enum check (Part 6.27.4.2). @returns {{doc:object, warnings:string[]}} */
  function normalize(source) {
    const input = isPlain(source) ? source : {};
    const doc = copy(DEFAULTS);
    const warnings = [];
    Object.keys(SCHEMA).forEach((path) => {
      const raw = getPath(input, path);
      if (raw === undefined) return;
      const result = coerce(SCHEMA[path], raw);
      if (!result.ok || result.adjusted) warnings.push(path);
      setPath(doc, path, result.value);
    });
    doc.x = isPlain(input.x) ? copy(input.x) : {};
    collectUnknown(input, '', doc.x);
    return { doc, warnings };
  }

  // ---------------------------------------------------------------- the store
  function createSettings() {
    const store = { doc: copy(DEFAULTS), saveFailedShown: false };

    function toast(message, key, kind) {
      if (FLM.UI && typeof FLM.UI.toast === 'function') FLM.UI.toast(message, { kind, key });
    }

    function noteSaveResult(result) {
      if (result.ok || store.saveFailedShown) return;
      store.saveFailedShown = true;            // once per session; the settings stay in memory
      toast(TEXT.saveFailed, 'settings.saveFailed', 'warn');
    }

    function persist(change, spec) {
      const debounceMs = spec && spec.immediate ? 0 : DEBOUNCE_MS;
      FLM.Storage.saveSettings(copy(store.doc), change, { debounceMs }).then(noteSaveResult);
    }

    function readStored() {
      let doc = null;
      try {
        doc = FLM.Storage.loadSettings();
      } catch (error) {
        Core.Log.warn('settings', 'load failed: ' + (error && error.message));
      }
      const info = typeof FLM.Storage.lastSettingsLoad === 'function' ? FLM.Storage.lastSettingsLoad() : null;
      if (!isPlain(doc)) return { doc: null, source: 'defaults', bothDamaged: Boolean(info && info.damaged) };
      return { doc, source: info && info.source === 'backup' ? 'backup' : 'stored', bothDamaged: false };
    }

    /**
     * Boot step B6: reads the stored document (M-16 tries the .bak), validates it against the schema.
     * A document from a newer version is ignored (defaults) and not rewritten until the user changes a setting.
     * @returns {{doc:object, source:'stored'|'backup'|'defaults', warnings:string[]}} never throws
     */
    function load() {
      const stored = readStored();
      let source = stored.source;
      let warnings = [];
      let raw = stored.doc;
      if (raw && raw.version > SETTINGS_VERSION) {
        Core.Log.once('W-SET-NEWER', 'warn', 'settings', 'W-SET-NEWER: settings version ' + raw.version);
        raw = null;
        source = 'defaults';
        warnings = ['W-SET-NEWER'];
      }
      const result = normalize(raw);
      store.doc = result.doc;
      if (result.warnings.length > 0) {
        warnings = warnings.concat(result.warnings);
        Core.Log.once('W-SET-NORMALIZED', 'warn', 'settings', 'W-SET-NORMALIZED: ' + result.warnings.join(', '));
      }
      if (stored.bothDamaged) toast(Core.Text.get('E-STO-008'), 'settings.reset', 'warn');
      return { doc: copy(store.doc), source, warnings };
    }

    function get(path) {
      return copy(getPath(store.doc, path));
    }

    function applyValue(path, value, source) {
      const spec = SCHEMA[path];
      const prev = getPath(store.doc, path);
      if (sameValue(prev, value)) return { ok: true, value: copy(value), error: null };
      setPath(store.doc, path, copy(value));
      persist({ key: path, value: copy(value), prev: copy(prev), source }, spec);
      if (path === 'video.highContrast' && value === true) applyValue('accessibility.laneGlyphs', true, source);
      return { ok: true, value: copy(value), error: null };
    }

    /** @returns {{ok:boolean, value:*, error:(string|null)}} out-of-range numbers are clamped, bad types refused */
    function set(path, value, source) {
      const sourceName = source === undefined ? 'ui' : source;
      if (!hasOwn(SCHEMA, path)) return { ok: false, value: undefined, error: 'unknown setting' };
      if (!SOURCES.includes(sourceName)) return { ok: false, value: get(path), error: 'unknown source' };
      const result = coerce(SCHEMA[path], value);
      if (!result.ok) return { ok: false, value: get(path), error: 'invalid value for ' + path };
      return applyValue(path, result.value, sourceName);
    }

    function setMany(patch, source) {
      const errors = [];
      Object.keys(patch).forEach((path) => {
        const result = set(path, patch[path], source);
        if (!result.ok) errors.push(path + ': ' + result.error);
      });
      return { ok: errors.length === 0, errors };
    }

    /** Restores defaults for one group (e.g. 'audio') or everything. Emits '*' with source 'reset'. */
    function reset(group) {
      const paths = Object.keys(SCHEMA).filter((path) => group === undefined || path === group ||
        path.startsWith(group + '.'));
      if (paths.length === 0) return;
      paths.forEach((path) => setPath(store.doc, path, copy(SCHEMA[path].default)));
      const change = { key: '*', value: copy(store.doc), prev: null, source: 'reset', keys: paths };
      FLM.Storage.saveSettings(copy(store.doc), change, { debounceMs: 0 }).then(noteSaveResult);
    }

    function calibration() {
      const values = store.doc.calibration;
      return { inputOffsetMs: values.inputOffsetMs, audioLatencyMs: values.audioLatencyMs,
        visualLeadMs: values.visualLeadMs };
    }

    const comparable = () => store.doc.gameplay.judgmentPreset === 'standard';

    /** Writes pending changes now (pagehide, tests). */
    function flush() {
      return FLM.Storage.flushSettings().then((result) => ({ ok: result.ok }));
    }

    function exportText() {
      return JSON.stringify({ format: EXPORT_FORMAT, version: SETTINGS_VERSION, exportedAt: new Date().toISOString(),
        appVersion: FLM.VERSION, settings: store.doc }, null, EXPORT_INDENT);
    }

    function differences(current, imported) {
      return Object.keys(SCHEMA).filter((path) => !sameValue(getPath(current, path), getPath(imported, path)))
        .map((path) => ({ path, from: copy(getPath(current, path)), to: copy(getPath(imported, path)) }));
    }

    function parseJson(text) {
      if (typeof text !== 'string' || text.length > IMPORT_LIMIT_CHARS) return null;
      try {
        return JSON.parse(text);
      } catch (error) {
        return null;
      }
    }

    /** Parses and validates a .flmsettings.json text; does not apply it. */
    function parseImport(text) {
      const refuse = (message) => ({ ok: false, doc: null, changes: [], error: message });
      const parsed = parseJson(text);
      const valid = isPlain(parsed) && parsed.format === EXPORT_FORMAT && isPlain(parsed.settings) &&
        Number.isInteger(parsed.version) && parsed.version >= 1;
      if (!valid) return refuse(TEXT.importInvalid);
      if (parsed.version > SETTINGS_VERSION) return refuse(TEXT.importNewer);
      const imported = normalize(parsed.settings).doc;
      return { ok: true, doc: imported, changes: differences(store.doc, imported), error: null };
    }

    /** Applies a document from parseImport: one settings.changed event per changed path (source 'load'). */
    function applyImport(doc) {
      const imported = normalize(doc).doc;
      const patch = {};
      differences(store.doc, imported).forEach((change) => { patch[change.path] = change.to; });
      setMany(patch, 'load');
    }

    // Tests only: back to the defaults (or to a saved document) without events or writes.
    function resetForTests(saved) {
      store.doc = copy(saved || DEFAULTS);
      store.saveFailedShown = false;
    }

    return Object.freeze({
      DEFAULTS, SCHEMA, load, get, all: () => copy(store.doc), set, setMany, reset, calibration, comparable, flush,
      export: exportText, parseImport, applyImport, _resetForTests: resetForTests
    });
  }

  return Object.freeze({
    Settings: createSettings()
  });
});
})();
