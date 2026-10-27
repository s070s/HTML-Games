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

  const Settings = createSettings();

  // =================================================================================================
  // T01.11: screens and dialogs (Part 6.27.4.3 to 6.27.4.17 and 6.27.4.21)
  // =================================================================================================
  const UI = FLM.UI;
  const doc = window.document;
  const bus = Core.bus;
  const el = UI.el;
  const icon = UI.icon;

  const SCREENS_OWNER = Symbol('screens');
  const STYLE_ID = 'flm-screens-style';
  const SCREEN_IDS = Object.freeze(['SCR-FirstLaunch', 'SCR-MainMenu', 'SCR-QuickPlay', 'SCR-Instrument',
    'SCR-FreePlay', 'SCR-Studio', 'SCR-Library', 'SCR-ImportInspect', 'SCR-Dance', 'SCR-Multiplayer',
    'SCR-Characters', 'SCR-Settings', 'SCR-Help', 'SCR-About', 'SCR-Diagnostics', 'SCR-Tutorial', 'SCR-Results',
    'SCR-Pause']);
  const DIALOG_IDS = Object.freeze(['DLG-UnsavedChanges', 'DLG-SaveFailed', 'DLG-ImportReplace', 'DLG-AudioBlocked',
    'DLG-DeleteTrack', 'DLG-Calibration', 'DLG-RemapConflict', 'DLG-ProjectTooLarge', 'DLG-Unsupported',
    'DLG-NetError', 'DLG-ResumeAudio', 'DLG-DeleteProject', 'DLG-ExportWav', 'DLG-ImportSettings']);
  // Part 11 T01.11 open item: every use is a STATUS.md section 5 placeholder row.
  const LATER_BUILD = 'Available after a later build step';
  const AUDIO_WAIT_MS = 5000;                // DLG-AudioBlocked: how long to wait for audio.unlocked
  const AUDIO_STEP_FAIL_MS = 1000;           // first launch: an unlock that takes longer shows the inline error
  const REFRESH_MS = 1000;                   // diagnostics panels refresh once per second
  const LOG_TAIL = 100;
  const ERROR_TAIL = 50;
  const IMPORT_LIST_LIMIT = 20;
  const SETTINGS_FILE_LIMIT = 256 * 1024;
  const FIRST_LAUNCH_LAST_STEP = 6;
  // Groups whose tests reset the screen stack; the Diagnostics button must not run them (it would remove itself).
  const SELF_TEST_SKIPPED_GROUPS = Object.freeze(['ui', 'modes', 'screens', 'boot']);
  const NOTE_NAMES = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);

  // Part 7.11 texts used by these screens, verbatim. M-26 and M-01 hold the E-* codes and screen names.
  const SCREEN_TEXT = Object.freeze({
    tagline: 'Play, record and perform music with four buttons.',
    'S-GEN-03': 'Single file, no build needed to play.',
    'S-GEN-04': 'Opening the file directly or over HTTPS gives the full feature set; plain HTTP disables MIDI input.',
    'S-GEN-05': 'Diagnostics never include songs, projects or recordings unless you turn this on.',
    'S-GEN-06': 'Diagnostics copied.',
    'S-GEN-07': 'Copying is blocked here. The text is selected; copy it with your device\'s copy command.',
    'S-AUD-01': 'Tap or press a key to enable sound.',
    'S-AUD-02': 'Your browser keeps sound off until you tap or press a key on this page.',
    'S-AUD-03': 'Sound did not start. Check that this tab and the device are not muted, then try again.',
    'S-CAP-01': 'Gamepad input is not available in this browser.',
    'S-INP-03': 'Gamepad buttons are fixed in this version.',
    'S-INP-04': 'If chords do not register on a touch screen, choose Settings > Controls > Touch input: Touch events.',
    'S-EXP-02': 'Download started: {fileName}.',
    'S-SET-01': 'Finger Lickin Music keeps your settings, projects, characters and results only in this browser on ' +
      'this device. It sends nothing anywhere: no account, no analytics, no telemetry. The only network ' +
      'connections are the ones you start in Multiplayer.',
    'S-SET-03': 'Settings replaced from {file}.',
    'S-SET-04': 'Settings reset to defaults.',
    'S-STO-03': 'Browser storage is not a permanent backup. Export projects you want to keep.',
    'S-NET-02': 'Two players on one keyboard is not available in this version. Each player uses their own device ' +
      'and connects by invite code.',
    'gate.webrtc': 'This browser has no WebRTC support.',
    'dlg.audio.title': 'Turn on sound',
    'dlg.audio.enable': 'Turn on sound',
    'dlg.audio.waiting': 'Waiting for sound...',
    'dlg.audio.blocked': 'Sound is still blocked. Check that the tab is not muted, then try again.',
    'dlg.resume.title': 'Sound was interrupted',
    'dlg.resume.body': 'Another app, a call or the lock screen interrupted the sound.',
    'dlg.resume.enable': 'Resume sound',
    'dlg.resume.cancel': 'Stay paused',
    'dlg.unsupported.title': '{feature} is not available',
    'dlg.returned.title': '{operation} stopped',
    'dlg.returned.body': 'You are back at the main menu. Your project is still open.',
    'dlg.copy': 'Copy diagnostics',
    'dlg.copy.title': 'Copy diagnostics',
    'dlg.ok': 'OK',
    'dlg.cancel': 'Cancel',
    'dlg.importSettings.title': 'Replace settings?',
    'dlg.importSettings.body': 'Replace your settings with the ones in {file}? Controls, calibration, volumes and ' +
      'display settings change. Projects and performance history are not affected.',
    'dlg.importSettings.apply': 'Replace settings',
    'dlg.importSettings.more': '+{count} more',
    'dlg.reset.title': 'Reset all settings?',
    'dlg.reset.body': 'Controls, calibration, volumes and display settings return to their defaults. Projects, ' +
      'characters and performance history are kept.',
    'dlg.reset.consequence': 'Your current settings are replaced and this cannot be undone.',
    'dlg.reset.apply': 'Reset settings'
  });

  function fillText(template, vars) {
    return template.replace(/\{(\w+)\}/g, (match, name) => (vars && hasOwn(vars, name) ? String(vars[name]) : ''));
  }

  /** Text lookup: this module's table, then M-26 (screen names, widgets) and M-01 (E-* codes). */
  function say(id, vars) {
    return hasOwn(SCREEN_TEXT, id) ? fillText(SCREEN_TEXT[id], vars) : UI.text(id, vars);
  }

  const STYLE_RULES = [
    '.panel { max-width: 44rem; margin: 0 0 var(--sp-5); }',
    '.panel h2 { margin: 0 0 var(--sp-2); font-size: var(--fs-4); line-height: var(--lh-tight); }',
    '.panel p, .panel ul { margin: 0 0 var(--sp-2); }',
    '.panel ul { padding-left: var(--sp-5); }',
    '.notice { display: flex; align-items: flex-start; gap: var(--sp-2); max-width: 44rem; margin: 0 0 var(--sp-3);' +
      ' padding: var(--sp-3); border: var(--border); border-left: 4px solid var(--c-accent-2);' +
      ' border-radius: var(--r-2); background: var(--c-panel); }',
    '.notice.warn { border-left-color: var(--c-warn); }',
    '.notice p, .notice ul { flex: 1 1 auto; margin: 0; }',
    '.table-wrap { max-width: 44rem; margin: 0 0 var(--sp-3); overflow-x: auto; }',
    '.data-table { width: 100%; border-collapse: collapse; font-size: var(--fs-2); }',
    '.data-table caption { padding: var(--sp-1) 0; text-align: left; font-weight: var(--fw-bold); }',
    '.data-table th, .data-table td { padding: var(--sp-1) var(--sp-2); border-bottom: var(--border); ' +
      'text-align: left; vertical-align: top; }',
    '.data-table.mono td, .mono { font-family: var(--font-mono); font-size: var(--fs-1); }',
    '.btn-row { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin: var(--sp-3) 0; }',
    '.menu-wrap { max-width: 40rem; }',
    '.menu-footer { margin: var(--sp-4) 0 0; color: var(--c-text-muted); font-size: var(--fs-2); }',
    '.fl-card { max-width: 32rem; margin: 0 auto; padding: var(--sp-5) var(--sp-4); }',
    '.fl-card h1 { margin: 0 0 var(--sp-2); font-size: var(--fs-6); line-height: var(--lh-tight); }',
    '.fl-glyphs { display: flex; gap: var(--sp-3); margin: var(--sp-3) 0; }',
    '.set-cats .tabs { overflow-x: auto; }',
    '.set-panel { max-width: 44rem; padding-top: var(--sp-3); }',
    '.set-note { color: var(--c-text-muted); font-size: var(--fs-2); }',
    '.badge-test { display: inline-block; margin-left: var(--sp-2); padding: 0 var(--sp-2); border: var(--border);' +
      ' border-radius: var(--r-pill); color: var(--c-warn); border-color: var(--c-warn); font-size: var(--fs-1); }'
  ].join('\n');

  function ensureStyles() {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_RULES;
    doc.head.appendChild(style);
  }

  // ---------------------------------------------------------------- key and pad words (Part 6.27.4.23)
  const CODE_LABELS = Object.freeze({
    ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', AltLeft: 'Left Alt', Escape: 'Esc',
    Space: 'Space', Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab', Semicolon: ';', Quote: '\'', Comma: ',',
    Period: '.', Slash: '/', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`'
  });
  const CODE_PATTERNS = Object.freeze([
    [/^Key([A-Z])$/, (match) => match[1]],
    [/^Digit(\d)$/, (match) => match[1]],
    [/^Numpad(\d)$/, (match) => 'Num ' + match[1]],
    [/^Arrow(Left|Right|Up|Down)$/, (match) => match[1]],
    [/^midi:(\d{1,3})$/, (match) => 'MIDI ' + noteLabel(Number(match[1]))]
  ]);

  function noteLabel(note) {
    return NOTE_NAMES[note % NOTE_NAMES.length] + (Math.floor(note / NOTE_NAMES.length) - 1);
  }

  /** 'KeyA' -> 'A', 'ShiftLeft' -> 'Left Shift', 'midi:60' -> 'MIDI C4'; an unknown code is returned unchanged. */
  function codeLabel(code) {
    const value = String(code);
    if (hasOwn(CODE_LABELS, value)) return CODE_LABELS[value];
    const found = CODE_PATTERNS.find((entry) => entry[0].test(value));
    return found ? found[1](found[0].exec(value)) : value;
  }

  /** Words for touch instructions: the four lane pads or the four dance arrows. */
  function padWords(kind) {
    return kind === 'dance' ? ['left', 'down', 'up', 'right'] : ['circle', 'triangle', 'square', 'diamond'];
  }

  // ---------------------------------------------------------------- small DOM helpers
  function addAll(parent, nodes) {
    nodes.forEach((node) => { if (node) parent.appendChild(node); });
    return parent;
  }

  const paragraph = (message, attrs) => el('p', attrs || null, message);

  function panel(id, title, nodes) {
    return addAll(el('section', { class: 'panel', id, 'aria-labelledby': id + '-title' },
      [el('h2', { id: id + '-title' }, title)]), nodes);
  }

  function dataTable(id, caption, headers, rows) {
    const head = el('tr', null, headers.map((name) => el('th', { scope: 'col' }, name)));
    const body = rows.map((cells) => el('tr', null, cells.map((cell) => el('td', null, String(cell)))));
    return el('div', { class: 'table-wrap' }, el('table', { id, class: 'data-table' },
      [el('caption', null, caption), el('thead', null, head), el('tbody', null, body)]));
  }

  function notice(id, kind, message) {
    return el('div', { class: 'notice ' + kind, id, role: 'status' }, [icon(kind === 'warn' ? 'warn' : 'info'),
      el('p', null, message)]);
  }

  function actionButton(spec) {
    return UI.Widgets.button(Object.assign({ kind: 'secondary' }, spec));
  }

  const yesNo = (value) => (value ? 'yes' : 'no');
  const editionName = () => (FLM.RELAY_URL ? 'Online' : 'Standalone');
  const buildDate = () => String(FLM.BUILD).slice(0, 10);
  const isTestBuild = () => Boolean(FLM.SelfTest);
  const currentMode = () => (FLM.Modes && FLM.Modes.current ? FLM.Modes.current().mode : 'menu');

  function enterMode(mode, params) {
    return Promise.resolve(FLM.Modes.enter(mode, params || {})).catch((error) => {
      Core.Log.warn('screens', 'enter ' + mode + ' failed: ' + (error && error.message));
    });
  }

  // Back from a panel screen: leave its mode (which ends at the menu) or just pop when it was pushed some other way.
  function panelBack(mode) {
    if (currentMode() !== mode) return 'pop';
    Promise.resolve(FLM.Modes.leave('user')).catch((error) => {
      Core.Log.warn('screens', 'leave ' + mode + ' failed: ' + (error && error.message));
    });
    return 'handled';
  }

  function gateEntries() {
    const result = FLM.Boot && typeof FLM.Boot.gateResult === 'function' ? FLM.Boot.gateResult() : { soft: [] };
    return result.soft.filter((row) => row.reason !== '');
  }

  function renderTierName() {
    const caps = Core.Caps.get();
    if (caps.webgl2) return 'WebGL2';
    return caps.webgl1 ? 'WebGL1' : '2D';
  }

  // ---------------------------------------------------------------- clipboard and downloads
  function showCopyFallback(json) {
    const area = el('textarea', { class: 'field mono', rows: 8, readonly: true, 'aria-label': say('dlg.copy.title') });
    area.value = json;
    Core.timers.setTimeout(() => { area.focus(); area.select(); }, 0, SCREENS_OWNER);
    return UI.dialog({ id: 'DLG-Unsupported', title: say('dlg.copy.title'), body: say('S-GEN-07'),
      build: (container) => container.appendChild(area),
      buttons: [{ id: 'ok', label: say('dlg.ok'), kind: 'primary', isDefault: true, isCancel: true }] });
  }

  /** Copies the diagnostics JSON; a blocked clipboard falls back to a selected textarea (S-GEN-07). */
  async function copyDiagnostics(includeContent) {
    const exported = Core.Diagnostics.export({ includeContent: includeContent === true });
    try {
      await window.navigator.clipboard.writeText(exported.json);
      UI.toast(say('S-GEN-06'), { kind: 'success' });
      return { ok: true };
    } catch (error) {
      UI.toast(say('S-GEN-07'), { kind: 'warn' });
      showCopyFallback(exported.json);
      return { ok: false };
    }
  }

  async function downloadText(fileName, content, mimeType) {
    const result = await FLM.Storage.download(fileName, content, mimeType);
    if (result.ok) UI.toast(say('S-EXP-02', { fileName }), { kind: 'success' });
    else UI.toast(Core.Text.get(result.error && result.error.code ? result.error.code : 'E-GEN-000',
      { original: 'download' }), { kind: 'error' });
    return result;
  }

  const todayStamp = () => new Date().toISOString().slice(0, 10);

  // ---------------------------------------------------------------- SCR-MainMenu (Part 6.27.4.4 and 7.6.2)
  // built is false while the mode's own screen does not exist yet (its phase has not started); such an entry is
  // disabled with LATER_BUILD, and the reason becomes the capability or content reason of Part 7.6.2 when it ships.
  const MENU_ENTRIES = Object.freeze([
    { id: 'quickplay', mode: 'quickplay', label: 'Quick Play', subtitle: 'Pick a song and play', built: false },
    { id: 'instrument', mode: 'instrument', label: 'Instrument Mode',
      subtitle: 'Choose part, profile and practice options', built: false },
    { id: 'freeplay', mode: 'freeplay', label: 'Free Play', subtitle: 'Play freely in any key', built: false },
    { id: 'studio', mode: 'studio', label: 'Studio', subtitle: 'Record and arrange tracks', built: false },
    { id: 'library', mode: 'library', label: 'Song Library', subtitle: 'Built-in songs, imports and projects',
      built: false },
    { id: 'import', mode: 'import', label: 'Import Music', subtitle: 'MIDI, MusicXML, Guitar Pro, audio',
      built: false },
    { id: 'dance', mode: 'dance', label: 'Dance Mode', subtitle: 'Step to the beat', built: false },
    { id: 'multiplayer', mode: 'multiplayer', label: 'Multiplayer', subtitle: 'Play with 2 to 4 people',
      built: false },
    { id: 'customize', mode: 'customize', label: 'Characters', subtitle: 'Customize your band', built: false },
    { id: 'settings', mode: 'settings', label: 'Settings', subtitle: 'Sound, controls, display', built: true },
    { id: 'help', mode: 'help', label: 'Help and Controls', subtitle: 'Controls and how each mode works',
      built: true },
    { id: 'about', mode: 'about', label: 'About', subtitle: 'Version, limits and licenses', built: true }
  ]);
  // Entries that open a select screen on the menu stack instead of switching mode (Part 6.27.4.4).
  const SELECT_SCREENS = Object.freeze({ quickplay: 'SCR-QuickPlay', instrument: 'SCR-Instrument',
    dance: 'SCR-Dance' });
  const LAST_USED_PREFIX = 'Last used - ';

  function gateFailed(id) {
    const result = FLM.Boot && typeof FLM.Boot.gateResult === 'function' ? FLM.Boot.gateResult() : { soft: [] };
    return result.soft.some((row) => row.id === id);
  }

  // params.environment is a test seam: {webrtc, relayUrl} replace what the gate and the build say.
  function menuEnvironment(override) {
    return Object.assign({ webrtc: !gateFailed('webrtc'), relayUrl: FLM.RELAY_URL || '' }, override);
  }

  function menuReason(entry, env) {
    if (entry.id === 'multiplayer' && !env.webrtc && env.relayUrl === '') return say('gate.webrtc');
    return entry.built ? null : LATER_BUILD;
  }

  function menuItems(env, lastEntry) {
    return MENU_ENTRIES.map((entry) => ({ id: entry.id, primary: entry.label, disabledReason: menuReason(entry, env),
      secondary: (entry === lastEntry ? LAST_USED_PREFIX : '') + entry.subtitle }));
  }

  function openMenuEntry(entry) {
    if (hasOwn(SELECT_SCREENS, entry.id)) return UI.Screens.push(SELECT_SCREENS[entry.id], { phase: 'select' });
    const params = entry.id === 'studio' ? { projectId: Settings.get('session.lastProjectId') } : {};
    return enterMode(entry.mode, params);
  }

  const audioIsLocked = () => Boolean(FLM.Audio) && typeof FLM.Audio.isUnlocked === 'function' &&
    !FLM.Audio.isUnlocked();

  function menuNotices(ctx) {
    const nodes = [];
    if (audioIsLocked()) {
      const banner = notice('mm-audio-banner', 'info', say('S-AUD-01'));
      bus.on('audio.unlocked', () => banner.remove(), ctx.owner);
      nodes.push(banner);
    }
    const storageNotice = FLM.Storage.state().notice;
    if (storageNotice) nodes.push(notice('mm-storage-notice', 'warn', storageNotice));
    return nodes;
  }

  function createMainMenu() {
    const view = { list: null, focusId: MENU_ENTRIES[0].id };
    return {
      mount(root, params, ctx) {
        ensureStyles();
        const env = menuEnvironment(params.environment);
        const frame = UI.Frame.create(root, { prefix: 'mm', title: 'Finger Lickin Music', subtitle: say('tagline'),
          back: false });
        if (isTestBuild()) frame.status.appendChild(el('span', { class: 'badge-test' }, 'TEST BUILD'));
        const lastEntry = MENU_ENTRIES.find((entry) => entry.mode === Settings.get('onboarding.lastMode'));
        view.focusId = lastEntry ? lastEntry.id : MENU_ENTRIES[0].id;
        view.list = UI.Widgets.list({ id: 'mm-list', label: 'Main menu', role: 'menu', selectedId: view.focusId,
          items: menuItems(env, lastEntry),
          onPick: (id) => openMenuEntry(MENU_ENTRIES.find((entry) => entry.id === id)) });
        const version = 'Version ' + FLM.VERSION + ' (' + editionName() + ') - ' + buildDate();
        addAll(frame.body, menuNotices(ctx).concat([
          el('div', { class: 'menu-wrap' }, el('nav', { id: 'mm-nav', 'aria-label': 'Main menu' }, view.list.root)),
          paragraph(version, { id: 'mm-version', class: 'menu-footer' })]));
      },
      initialFocus: () => view.list.root.querySelector('[data-item="' + view.focusId + '"]'),
      onBack: () => 'pop'                      // the root: M-26 answers 'root' before this is asked
    };
  }

  // ---------------------------------------------------------------- SCR-FirstLaunch (Part 6.27.4.3 and 7.6.1)
  // Six steps: identity, capability summary, sound (T04.01 completes it), rendering, input (T03.04 completes it),
  // mode choice with the features this browser lacks. Only completed onboarding is skipped on the next start.
  function createFirstLaunch() {
    const view = { step: 1, host: null, widgets: [], ctx: null };

    function track(handle) {
      view.widgets.push(handle);
      return handle;
    }

    function navigation(primary) {
      const row = el('div', { class: 'btn-row' });
      if (view.step > 1) {
        row.appendChild(track(actionButton({ id: 'fl-back', label: say('ui.back'), kind: 'ghost',
          onPress: () => goTo(view.step - 1) })).root);
      }
      const next = track(actionButton(Object.assign({ id: 'fl-next', label: 'Continue', kind: 'primary',
        onPress: () => goTo(view.step + 1) }, primary)));
      next.root.setAttribute('data-autofocus', '');
      row.appendChild(next.root);
      return row;
    }

    function goTo(step) {
      view.step = Core.clamp(step, 1, FIRST_LAUNCH_LAST_STEP);
      render();
      const target = view.host.querySelector('[data-autofocus]');
      if (target) target.focus();
    }

    function stepIdentity() {
      const glyphs = [0, 1, 2, 3].map((index) => UI.icon('lane' + index, 'glyph'));
      const skip = track(actionButton({ id: 'fl-skip', label: 'Skip setup', kind: 'ghost', onPress: skipSetup }));
      return [el('div', { id: 'fl-logo' }, [el('h1', null, 'Finger Lickin Music'),
        el('div', { class: 'fl-glyphs', 'aria-hidden': 'true' }, glyphs)]),
      paragraph(say('tagline'), { id: 'fl-tagline' }), paragraph('Version ' + FLM.VERSION, { id: 'fl-version' }),
      navigation(), el('div', { class: 'btn-row' }, skip.root)];
    }

    function stepCapabilities() {
      const entries = gateEntries();
      const body = entries.length === 0
        ? paragraph('Everything needed is available', { id: 'fl-checks' })
        : el('ul', { id: 'fl-checks', role: 'list' }, entries.map((row) => el('li', null, row.reason)));
      return [el('h2', null, 'This browser'), body, navigation()];
    }

    function advanceFromSound() {
      if (view.step === 3) goTo(4);
    }

    function startSound() {
      const error = view.host.querySelector('#fl-audio-error');
      error.textContent = '';
      const failTimer = Core.timers.setTimeout(() => { error.textContent = say('S-AUD-03'); }, AUDIO_STEP_FAIL_MS,
        view.ctx.owner);
      const attempt = FLM.Audio.unlock();      // called inside the click: browsers allow sound only after a gesture
      return Promise.resolve(attempt).then(() => {
        Core.timers.clearTimeout(failTimer);
        advanceFromSound();
      }, () => { error.textContent = say('S-AUD-03'); });
    }

    function stepSound() {
      const canUnlock = Boolean(FLM.Audio) && typeof FLM.Audio.unlock === 'function';
      const start = track(actionButton({ id: 'fl-start', label: 'Start sound', kind: 'primary',
        onPress: startSound, disabledReason: canUnlock ? undefined : LATER_BUILD }));
      const skip = track(actionButton({ id: 'fl-skip-sound', label: 'Continue without sound for now',
        onPress: () => goTo(4) }));
      return [el('h2', null, 'Sound'),
        paragraph('Starting turns on sound. Nothing plays until you choose a mode.', { id: 'fl-start-hint' }),
        paragraph('', { id: 'fl-audio-error', class: 'status status-error', role: 'status' }),
        el('div', { class: 'btn-row' }, [start.root, skip.root]), navigation()];
    }

    const TIER_OPTIONS = Object.freeze([{ value: 'auto', label: 'Automatic' }, { value: 'high', label: 'High' },
      { value: 'balanced', label: 'Balanced' }, { value: 'low', label: 'Low' },
      { value: 'abstract', label: 'Abstract (2D)' }]);

    function stepRendering() {
      const kind = renderTierName();
      const lines = [paragraph('Graphics: ' + kind, { id: 'fl-render-line' })];
      if (kind === '2D') lines.push(paragraph(Core.Text.get('E-REN-001'), { id: 'fl-tier' }));
      const tier = track(UI.Widgets.select({ id: 'fl-tier-select', label: 'Graphics quality', options: TIER_OPTIONS,
        value: Settings.get('video.tier'), onChange: (value) => Settings.set('video.tier', value, 'ui') }));
      return [el('h2', null, 'Graphics')].concat(lines, [tier.root, navigation()]);
    }

    const INPUT_OPTIONS = Object.freeze([{ value: 'auto', label: 'Automatic' },
      { value: 'desktop', label: 'Keyboard and mouse' }, { value: 'touch', label: 'Touch' }]);

    function stepInput() {
      const touch = Core.Caps.get().maxTouchPoints > 0;
      const lanes = Settings.get('input.keys.lanes').map(codeLabel).join(' ');
      const preview = touch ? 'Pads: ' + padWords('lanes').join(', ') : 'Lane keys: ' + lanes;
      const choice = track(UI.Widgets.select({ id: 'fl-input', label: 'How will you play?', options: INPUT_OPTIONS,
        value: Settings.get('onboarding.inputMode'),
        onChange: (value) => Settings.set('onboarding.inputMode', value, 'ui') }));
      return [el('h2', null, 'Controls'), paragraph('Detected input: ' + (touch ? 'touch' : 'keyboard')),
        choice.root, paragraph(preview, { id: 'fl-input-preview' }),
        paragraph('Trying the keys and pads on this page is added in a later build step.', { class: 'set-note' }),
        navigation()];
    }

    // Every choice sets the flag first (written at once, Part 5.11), then acts.
    function chooseMode(action) {
      Settings.set('onboarding.firstLaunchDone', true, 'ui');
      return action();
    }

    const toMainMenu = () => UI.Screens.replace('SCR-MainMenu', {});

    function skipSetup() {
      Settings.set('onboarding.inputMode', 'auto', 'ui');
      if (FLM.Audio && typeof FLM.Audio.unlock === 'function') FLM.Audio.unlock();   // the click is a gesture
      return chooseMode(toMainMenu);
    }

    function choiceCard(id, label, subtitle, config) {
      const handle = track(actionButton(Object.assign({ id, label, kind: config.kind }, config)));
      return el('div', { class: 'panel' }, [handle.root, paragraph(subtitle, { class: 'subtitle' })]);
    }

    function stepModes() {
      const cards = [
        choiceCard('fl-learn', 'Learn the basics', 'Interactive tutorial, about 3 minutes',
          { disabledReason: LATER_BUILD }),
        choiceCard('fl-demo', 'Play a demo song', 'Neon Boulevard, keys part, beginner',
          { disabledReason: LATER_BUILD }),
        choiceCard('fl-menu', 'Go to the main menu', 'Everything in one list',
          { kind: 'primary', onPress: () => chooseMode(toMainMenu) })];
      const lacking = gateEntries();
      const list = lacking.length === 0 ? null : el('div', { id: 'fl-unavailable', class: 'notice info' }, [
        icon('info'), el('div', null, [paragraph('Not available in this browser'),
          el('ul', null, lacking.map((row) => el('li', null, row.reason)))])]);
      const back = el('div', { class: 'btn-row' }, track(actionButton({ id: 'fl-back', label: say('ui.back'),
        kind: 'ghost', onPress: () => goTo(view.step - 1) })).root);
      return [el('h2', null, 'Choose where to start'), el('div', { id: 'fl-choices' }, cards), list, back];
    }

    const STEPS = [null, stepIdentity, stepCapabilities, stepSound, stepRendering, stepInput, stepModes];

    function render() {
      view.widgets.forEach((handle) => handle.destroy());
      view.widgets = [];
      view.host.textContent = '';
      const label = 'Step ' + view.step + ' of ' + FIRST_LAUNCH_LAST_STEP;
      addAll(view.host, [paragraph(label, { id: 'fl-steps', class: 'subtitle' })].concat(STEPS[view.step]()));
    }

    function onBack() {
      if (view.step > 1) goTo(view.step - 1);
      return 'handled';                        // nothing is behind this screen
    }

    return {
      mount(root, params, ctx) {
        ensureStyles();
        view.ctx = ctx;
        view.host = el('div', { class: 'fl-card', id: 'fl-card' });
        root.appendChild(el('div', { class: 'screen-body' }, view.host));
        render();
        bus.on('audio.unlocked', advanceFromSound, ctx.owner);
        Core.dom.on(root, 'keydown', (evt) => {
          if (evt.key !== 'Escape' || view.step === 1) return;
          evt.preventDefault();
          onBack();
        }, undefined, ctx.owner);
      },
      initialFocus: () => view.host.querySelector('[data-autofocus]'),
      onBack,
      step: () => view.step,
      goTo
    };
  }

  // ---------------------------------------------------------------- SCR-Settings (Part 6.27.4.14 and 7.6.12)
  const SETTINGS_CATEGORIES = Object.freeze([['audio', 'Audio'], ['controls', 'Controls'], ['gameplay', 'Gameplay'],
    ['video', 'Video'], ['accessibility', 'Accessibility'], ['calibration', 'Calibration'],
    ['data', 'Data and backup'], ['privacy', 'Privacy'], ['advanced', 'Advanced']]);
  const CONTEXTUAL_CATEGORIES = Object.freeze(['audio', 'controls', 'video', 'calibration']);
  const choices = (pairs) => pairs.map((pair) => ({ value: pair[0], label: pair[1] }));
  const OFF_ON_SYSTEM = choices([['system', 'System'], ['on', 'On'], ['off', 'Off']]);
  const RESOLUTION_OPTIONS = choices([[0, 'Automatic']].concat([50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]
    .map((percent) => [percent / 100, percent + ' %'])));
  const POLYPHONY_OPTIONS = choices([[0, 'Automatic (64 desktop, 32 mobile)']].concat([16, 24, 32, 48, 64]
    .map((voices) => [voices, voices + ' voices'])));
  const percentFormat = (value) => value + ' %';
  const noteSpeedFormat = (value) => 'x' + (1500 / value).toFixed(1) + ' (' + value + ' ms)';

  // Row kinds: toggle, slider (scale turns 0..1 settings into percent), select, number.
  const slider = (path, label, min, max, step, extra) => Object.assign({ kind: 'slider', path, label, min, max, step,
    scale: 100, format: percentFormat }, extra);
  const toggle = (path, label) => ({ kind: 'toggle', path, label });
  const select = (path, label, options) => ({ kind: 'select', path, label, options });

  const SETTINGS_ROWS = Object.freeze({
    audio: [slider('audio.masterVolume', 'Master volume', 0, 100, 1),
      slider('audio.metronomeVolume', 'Metronome volume', 0, 100, 1), toggle('audio.metronomeAccent', 'Accent beat 1'),
      toggle('audio.reverbEnabled', 'Reverb'), slider('audio.reverbAmount', 'Reverb amount', 0, 100, 1)],
    controls: [select('input.padLayout', 'Pad layout', choices([['bottom', 'Bottom'], ['right', 'Right']])),
      select('input.padSize', 'Pad size', choices([['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']])),
      slider('input.padOpacity', 'Pad opacity', 30, 100, 5),
      select('input.padsVisible', 'Touch pads', choices([['auto', 'Automatic'], ['always', 'Always show'],
        ['never', 'Never show']])),
      select('input.touchApi', 'Touch input', choices([['auto', 'Automatic'], ['pointer', 'Pointer events'],
        ['touch', 'Touch events']])),
      { kind: 'toggle', path: 'input.gamepadEnabled', label: 'Use gamepad', needs: 'gamepad' },
      { kind: 'toggle', path: 'input.midiEnabled', label: 'Use MIDI devices', needs: 'webMidi' }],
    gameplay: [select('gameplay.judgmentPreset', 'Timing windows', choices([['standard', 'Standard'],
      ['relaxed', 'Relaxed (wider windows)'], ['strict', 'Strict (narrower windows)']])),
    toggle('gameplay.strayPressPenalty', 'Extra presses break combo'),
    toggle('gameplay.showJudgmentText', 'Show judgment text'),
    select('gameplay.targetTrackMode', 'My part', choices([['mute', 'Mute my part'], ['lower', 'Lower my part'],
      ['full', 'Full']])),
    slider('gameplay.accompanimentVolume', 'Accompaniment volume', 0, 100, 1),
    toggle('gameplay.autoCountIn', 'Count-in before play'),
    select('audio.countInBars', 'Count-in length', choices([[1, '1 bar'], [2, '2 bars']])),
    slider('calibration.visualLeadMs', 'Note speed', 600, 3000, 50, { scale: 1, format: noteSpeedFormat }),
    toggle('gameplay.lifeBar', 'Life bar (song can be failed)')],
    video: [select('video.tier', 'Graphics quality', choices([['auto', 'Automatic'], ['high', 'High'],
      ['balanced', 'Balanced'], ['low', 'Low'], ['abstract', 'Abstract (2D)']])),
    select('video.resolutionScale', 'Resolution', RESOLUTION_OPTIONS), toggle('video.cameraMotion', 'Camera motion'),
    select('video.cameraPreset', 'Camera', choices([['FullBand', 'Full band'], ['Focus', 'Focus'], ['Side', 'Side'],
      ['Overhead', 'Overhead'], ['Player', 'Player']])),
    select('video.effectsLevel', 'Visual effects', choices([[0, 'Off'], [1, 'Reduced'], [2, 'Full']]))],
    accessibility: [select('video.reducedMotion', 'Reduced motion', OFF_ON_SYSTEM),
      toggle('video.highContrast', 'High contrast'), slider('video.uiScale', 'Interface size', 80, 150, 5),
      toggle('accessibility.laneGlyphs', 'Lane symbols'),
      toggle('accessibility.screenReaderLabels', 'Screen reader labels'),
      toggle('accessibility.flashOnBeat', 'Flash on the beat'),
      toggle('accessibility.largeJudgmentText', 'Large judgment text')],
    calibration: [{ kind: 'number', path: 'calibration.inputOffsetMs', label: 'Input offset', min: -200, max: 200,
      unit: 'ms' }, { kind: 'number', path: 'calibration.audioLatencyMs', label: 'Audio latency', min: 0, max: 500,
      unit: 'ms' }, slider('calibration.visualLeadMs', 'Visual lead', 600, 3000, 50,
      { scale: 1, format: (value) => value + ' ms' })],
    advanced: [select('audio.polyphonyCap', 'Polyphony cap', POLYPHONY_OPTIONS),
      slider('input.chordWindowMs', 'Chord window', 10, 60, 5, { scale: 1, format: (value) => value + ' ms' }),
      toggle('video.showStats', 'Show stats overlay'), toggle('diagnostics.overlay', 'Diagnostics overlay'),
      select('diagnostics.logLevel', 'Log level', choices([['info', 'Info'], ['debug', 'Debug']]))]
  });

  function widgetIdFor(path) {
    return 'set-' + path.replace(/\./g, '-');
  }

  function rowReason(row) {
    if (row.needs === 'gamepad' && !Core.Caps.get().gamepad) return say('S-CAP-01');
    if (row.needs === 'webMidi' && !Core.Caps.get().webMidi) return Core.Text.get('E-INP-001');
    return undefined;
  }

  function toggleWidget(row, change) {
    return UI.Widgets.toggle({ id: widgetIdFor(row.path), label: row.label, value: Settings.get(row.path),
      disabledReason: rowReason(row), onChange: (value) => change(value) });
  }

  function sliderWidget(row, change) {
    const current = Math.round(Settings.get(row.path) * row.scale);
    return UI.Widgets.slider({ id: widgetIdFor(row.path), label: row.label, min: row.min, max: row.max,
      step: row.step, value: current, format: row.format, onChange: (value) => change(value / row.scale) });
  }

  function selectWidget(row, change) {
    const byText = (text) => row.options.find((option) => String(option.value) === text);
    return UI.Widgets.select({ id: widgetIdFor(row.path), label: row.label, options: row.options,
      value: Settings.get(row.path), onChange: (text) => change(byText(text).value) });
  }

  function numberWidget(row, change) {
    return UI.Widgets.number({ id: widgetIdFor(row.path), label: row.label, min: row.min, max: row.max,
      step: 1, unit: row.unit, value: Settings.get(row.path), onChange: change });
  }

  const ROW_BUILDERS = Object.freeze({ toggle: toggleWidget, slider: sliderWidget, select: selectWidget,
    number: numberWidget });

  const keyRows = () => {
    const codes = (path) => Settings.get(path);
    const words = padWords('lanes');
    const lanes = codes('input.keys.lanes').map((code, index) => ['Lane ' + (index + 1) + ' (' + words[index] + ')',
      codeLabel(code)]);
    const arrows = ['left', 'down', 'up', 'right'];
    const dance = codes('input.keys.dance').map((code, index) => ['Dance ' + arrows[index],
      codeLabel(code) + ' or ' + codeLabel(codes('input.keys.danceAlt')[index])]);
    const singles = [['Pause', 'input.keys.pause'], ['Stop all sound', 'input.keys.panic'],
      ['Octave down', 'input.keys.octDown'], ['Octave up', 'input.keys.octUp'], ['Sustain', 'input.keys.sustain']]
      .map((pair) => [pair[0], codeLabel(codes(pair[1]))]);
    const profiles = codes('input.keys.profiles').map((code, index) => ['Profile ' + (index + 1), codeLabel(code)]);
    return lanes.concat(dance, singles, profiles);
  };

  const GAMEPAD_ROWS = Object.freeze([
    ['Face buttons (bottom, right, left, top)', 'Lane 1, Lane 2, Lane 3, Lane 4', 'Down, Right, Left, Up'],
    ['D-pad (up, down, left, right)', 'Octave up, Octave down, none, none', 'Up, Down, Left, Right'],
    ['Shoulder buttons (left, right)', 'Octave down, Octave up', 'none'], ['Start', 'Pause', 'Pause'],
    ['Select', 'Stop all sound', 'Stop all sound'], ['Triggers', 'Sustain', 'none']]);

  const STORAGE_WORDS = Object.freeze({ full: 'browser database and local storage',
    localOnly: 'local storage only (projects up to 2 MB, no recordings)', memory: 'memory only (nothing is saved)' });

  function createSettingsScreen() {
    const view = { frame: null, panel: null, tabs: null, category: 'audio', widgets: [], owner: null, params: {},
      byPath: {}, comparable: null };

    function dropWidgets() {
      view.widgets.forEach((handle) => handle.destroy());
      view.widgets = [];
      view.byPath = {};
    }

    function keep(handle, path) {
      view.widgets.push(handle);
      if (path) view.byPath[path] = handle;
      return handle.root;
    }

    function afterChange(row, value) {
      if (row.path === 'video.highContrast') lockLaneGlyphs(value);
      if (row.path === 'gameplay.judgmentPreset' && view.comparable) view.comparable.hidden = Settings.comparable();
    }

    // High contrast forces lane symbols on (Part 5.11); the row says why it cannot change.
    function lockLaneGlyphs(locked) {
      const handle = view.byPath['accessibility.laneGlyphs'];
      if (!handle) return;
      handle.set(Settings.get('accessibility.laneGlyphs'));
      handle.setDisabled(locked ? 'On (required by high contrast)' : null);
    }

    function buildRow(row) {
      const change = (value) => {
        const result = Settings.set(row.path, value, 'ui');
        if (result.ok) afterChange(row, value);
      };
      const root = keep(ROW_BUILDERS[row.kind](row, change), row.path);
      if (row.path === 'accessibility.laneGlyphs' && Settings.get('video.highContrast')) lockLaneGlyphs(true);
      return root;
    }

    function rowsOf(category) {
      return (SETTINGS_ROWS[category] || []).map(buildRow);
    }

    function laterButton(id, label) {
      return keep(actionButton({ id, label, disabledReason: LATER_BUILD }));
    }

    function audioExtras() {
      return [paragraph('All instruments are synthesized in real time. Loading SoundFont (.sf2) sound banks is ' +
        'not supported in this version.', { id: 'set-fidelity', class: 'set-note' }),
      laterButton('set-test', 'Play test sound')];
    }

    function controlsExtras() {
      return [dataTable('set-remap', 'Keyboard controls (read only in this build)', ['Control', 'Key'], keyRows()),
        laterButton('set-remap-change', 'Change keys'),
        dataTable('set-gamepad', say('S-INP-03'), ['Button', 'Instrument, Free Play, Studio', 'Dance'],
          GAMEPAD_ROWS)];
    }

    function gameplayExtras() {
      const note = paragraph('Practice setting: results are not comparable', { id: 'set-comparable', class: 'badge' });
      note.hidden = Settings.comparable();
      view.comparable = note;
      return [note];
    }

    function videoExtras() {
      const render = FLM.Render && typeof FLM.Render.tier === 'function' ? FLM.Render.tier() : 'not started';
      return [paragraph('Running: ' + render, { id: 'set-running' })];
    }

    function calibrationExtras() {
      const reset = keep(actionButton({ id: 'set-reset-calibration', label: 'Reset calibration', onPress: () => {
        Settings.reset('calibration');
        showCategory(view.category);
      } }));
      return [el('div', { class: 'btn-row' }, [laterButton('set-wizard', 'Run calibration'), reset])];
    }

    function exportSettings() {
      return downloadText(todayStamp() + '-flm.flmsettings.json', Settings.export(), 'application/json');
    }

    async function applyImportFile(file) {
      const read = await FLM.Storage.readFile(file, { as: 'text', maxBytes: SETTINGS_FILE_LIMIT });
      const parsed = read.ok ? Settings.parseImport(read.data) : { ok: false, error: say('E-IMP-019') };
      if (!parsed.ok) {
        UI.toast(parsed.error, { kind: 'error' });
        return;
      }
      const answer = await openDialog('DLG-ImportSettings', { file: file.name, changes: parsed.changes });
      if (answer !== 'apply') return;
      Settings.applyImport(parsed.doc);
      UI.toast(say('S-SET-03', { file: file.name }), { kind: 'success' });
      showCategory(view.category);
    }

    // The picker opens inside the click (gesture rule), the rest follows when a file was chosen.
    function importSettings() {
      const picking = FLM.Storage.pickFile({ accept: ['.json', 'application/json'], multiple: false });
      return picking.then((files) => (files.length > 0 ? applyImportFile(files[0]) : undefined));
    }

    async function showFirstLaunchAgain() {
      Settings.set('onboarding.firstLaunchDone', false, 'ui');
      await FLM.Modes.leave('user');
      await UI.Screens.replace('SCR-FirstLaunch', {});
    }

    async function resetEverything() {
      const answer = await openDialog('DLG-ConfirmReset', {});
      if (answer !== 'reset') return;
      Settings.reset();
      UI.toast(say('S-SET-04'), { kind: 'success' });
      showCategory(view.category);
    }

    function dataExtras() {
      const state = FLM.Storage.state();
      const words = STORAGE_WORDS[state.mode] || state.mode;
      const lines = [paragraph('Storage: ' + words, { id: 'set-storage' })];
      if (state.notice) lines.push(notice('set-storage-notice', 'warn', state.notice));
      lines.push(paragraph(say('S-STO-03'), { id: 'set-backup-note' }));
      const buttons = [keep(actionButton({ id: 'set-export', label: 'Export settings (.flmsettings.json)',
        onPress: exportSettings })), keep(actionButton({ id: 'set-import', label: 'Import settings...',
        onPress: importSettings })), keep(actionButton({ id: 'set-first-launch', label: 'Show first-launch setup again',
        onPress: showFirstLaunchAgain })), laterButton('set-clear-history', 'Clear performance history'),
      keep(actionButton({ id: 'set-reset-all', label: 'Reset all settings', kind: 'danger',
        onPress: resetEverything }))];
      return lines.concat([el('div', { class: 'btn-row' }, buttons)]);
    }

    function privacyExtras() {
      const statement = paragraph(PRIVACY_NETWORK, { id: 'set-network-privacy', hidden: true });
      const link = keep(actionButton({ id: 'set-network-link', label: 'Multiplayer privacy', onPress: () => {
        statement.hidden = !statement.hidden;
      } }));
      return [paragraph(say('S-SET-01'), { id: 'set-privacy' }), link, statement];
    }

    function advancedExtras() {
      return [keep(actionButton({ id: 'set-diagnostics', label: 'Open diagnostics',
        onPress: () => enterMode('diagnostics') }))];
    }

    const EXTRAS = { audio: audioExtras, controls: controlsExtras, gameplay: gameplayExtras, video: videoExtras,
      calibration: calibrationExtras, data: dataExtras, privacy: privacyExtras, advanced: advancedExtras };

    function showCategory(category) {
      dropWidgets();
      view.category = category;
      view.comparable = null;
      view.panel.textContent = '';
      view.panel.setAttribute('aria-labelledby', 'w-set-cats-tab-' + category);
      const rows = rowsOf(category);
      const extras = EXTRAS[category] ? EXTRAS[category]() : [];
      addAll(view.panel, rows.concat(extras));
    }

    function categoriesFor(params) {
      const all = SETTINGS_CATEGORIES.map((pair) => ({ id: pair[0], label: pair[1] }));
      return params.variant === 'contextual' ? all.filter((tab) => CONTEXTUAL_CATEGORIES.includes(tab.id)) : all;
    }

    return {
      mount(root, params, ctx) {
        ensureStyles();
        view.params = params;
        view.frame = UI.Frame.create(root, { prefix: 'set', title: say('screen.SCR-Settings'), subtitle: '' });
        const tabs = categoriesFor(params);
        const wanted = tabs.some((tab) => tab.id === params.category) ? params.category : tabs[0].id;
        view.tabs = UI.Widgets.tabs({ id: 'set-cats', tabs, value: wanted, onChange: showCategory });
        view.panel = el('div', { class: 'set-panel', id: 'set-panel', role: 'tabpanel' });
        addAll(view.frame.body, [el('div', { class: 'set-cats' }, view.tabs.root), view.panel]);
        showCategory(wanted);
      },
      unmount() {
        dropWidgets();
        Settings.flush();                      // pending writes go out when the screen closes
      },
      onBack: () => (view.params.variant === 'contextual' ? 'pop' : panelBack('settings')),
      category: () => view.category,
      showCategory: (category) => { view.tabs.set(category); showCategory(category); }
    };
  }

  const PRIVACY_NETWORK = [
    'What is shared',
    'When you connect, Finger Lickin Music sends the other players: your display name, your character\'s ' +
      'appearance, your ready state, the buttons you press during a song with their timing, and your scores. The ' +
      'host also sends the room state, the song choice and the results. Nothing else is sent: no files, projects, ' +
      'recordings, settings or history.',
    'Connections go directly between the devices. Invite and answer codes contain your device\'s network ' +
      'addresses, so share them only with the people you play with. Nothing is stored on any server.'
  ].join(' ');

  // ---------------------------------------------------------------- SCR-Help (Part 6.27.4.15 and 7.6.13)
  const HELP_MODE_TEXTS = Object.freeze([
    'Quick Play: pick a song, a part and a difficulty, and play along with the band.',
    'Instrument Mode: the same as Quick Play with every option shown: mapping profile, backing tracks, speed, ' +
      'practice loops and chart preview.',
    'Free Play: no chart and no score. Choose an instrument, key and scale and play anything; record takes and ' +
      'send them to the Studio.',
    'Studio: build songs track by track. Record with a count-in, overdub, edit notes in the piano roll, mix, and ' +
      'export MIDI, project files or an audio mix.',
    'Dance Mode: step on four directions in time with the music. It has its own charts, difficulties and score, ' +
      'separate from instrument play.',
    'Multiplayer: 2 to 4 players on their own devices, connected by invite codes. Play the same chart ' +
      'competitively or different parts as a band.'
  ]);
  const HELP_PROFILE_TEXTS = Object.freeze([
    ['A', 'Lanes: each button plays one note of the scale.'],
    ['B', 'Intervals: buttons add intervals above a root note.'],
    ['C', 'Chords: each button plays a chord of the key.'],
    ['D', 'Scale: buttons walk up and down the scale four notes at a time.'],
    ['E', 'Instrument: patterns suited to the selected instrument (power chords on guitar, root and fifth on ' +
      'bass).'],
    ['F', 'Rhythm: drum sounds on every button.']
  ]);
  const HELP_TIPS = Object.freeze([
    'Playback in a background tab may stutter in some browsers.',
    'No sound on iPhone or iPad? Check that the ring and silent switch is not set to silent, and raise the volume.',
    'A controller appears after you press one of its buttons.',
    'MIDI devices are used only where the browser offers Web MIDI on a secure page.'
  ]);

  function createHelp() {
    function controlsPanel() {
      const midi = Settings.get('input.midiLaneNotes').map(noteLabel).join(', ');
      const touch = 'The ' + padWords('lanes').join(', ') + ' pads play lanes 1 to 4. In Dance Mode the pads are the ' +
        padWords('dance').join(', ') + ' arrows. Place up to four fingers on the pads.';
      const change = actionButton({ id: 'hlp-change', label: 'Change',
        onPress: () => enterMode('settings', { category: 'controls' }) });
      return panel('hlp-controls', 'Controls', [dataTable('hlp-keys', 'Keyboard', ['Control', 'Key'], keyRows()),
        el('div', { class: 'btn-row' }, change.root),
        dataTable('hlp-gamepad', 'Gamepad (' + say('S-INP-03') + ')', ['Button', 'Instrument, Free Play, Studio',
          'Dance'], GAMEPAD_ROWS), paragraph(touch, { id: 'hlp-touch' }),
        paragraph('Default MIDI notes for lanes 1 to 4: ' + midi + '.', { id: 'hlp-midi' })]);
    }

    function modesPanel() {
      return panel('hlp-modes', 'Modes', [el('ul', null, HELP_MODE_TEXTS.map((line) => el('li', null, line)))]);
    }

    function profilesPanel() {
      const lines = HELP_PROFILE_TEXTS.map((pair) => el('li', null, 'Profile ' + pair[0] + ' - ' + pair[1]));
      return panel('hlp-profiles', 'Profiles', [el('ul', null, lines),
        paragraph('Key tables for each profile are added in a later build step.', { class: 'set-note' })]);
    }

    function tipsPanel() {
      const tips = HELP_TIPS.concat([say('S-INP-04'), say('S-NET-02')]);
      const tutorial = actionButton({ id: 'hlp-tutorial', label: 'Start the tutorial', disabledReason: LATER_BUILD });
      return panel('hlp-tips', 'Tips', [el('ul', null, tips.map((line) => el('li', null, line))),
        el('div', { class: 'btn-row' }, tutorial.root)]);
    }

    return {
      mount(root) {
        ensureStyles();
        const frame = UI.Frame.create(root, { prefix: 'hlp', title: say('screen.SCR-Help'), subtitle: '' });
        const pages = { controls: controlsPanel(), modes: modesPanel(), profiles: profilesPanel(),
          tips: tipsPanel() };
        const tabs = UI.Widgets.tabs({ id: 'hlp-tabs', value: 'controls', tabs: [{ id: 'controls', label: 'Controls' },
          { id: 'modes', label: 'Modes' }, { id: 'profiles', label: 'Profiles' }, { id: 'tips', label: 'Tips' }] });
        addAll(frame.body, [tabs.root].concat(Object.keys(pages).map((id) => pages[id])));
        Object.keys(pages).forEach((id) => tabs.panel(id, pages[id]));
      },
      onBack: () => panelBack('help')
    };
  }

  // ---------------------------------------------------------------- SCR-About (Part 6.27.4.16, 7.6.14, 7.11.6)
  const EDITION_TEXT = Object.freeze({
    standalone: 'Standalone edition. Everything runs from this file on your device: no server, account or network ' +
      'connection is needed. Multiplayer uses direct peer-to-peer connections that you set up by exchanging ' +
      'invite codes.',
    online: 'Online edition. This build can also use the relay server at {relayUrl} to connect players by room ' +
      'code. The relay only forwards messages between players and stores nothing. Every other feature works ' +
      'without it.'
  });
  const LIMITS_TEXT = Object.freeze([
    'Instrument sounds are synthesized by this file; no sampled sound bank is included, so timbres approximate ' +
      'General MIDI instruments rather than reproduce recordings.',
    'Import: MIDI (.mid, .midi) format 0, 1 and 2; MusicXML (.xml, .musicxml, .mxl); Guitar Pro 3, 4 and 5 ' +
      '(.gp3, .gp4, .gp5). Guitar Pro 6 and 7 files (.gpx, .gp) cannot be imported. Audio files (.wav, .mp3, ' +
      '.ogg, .flac, where this browser can decode them) are imported as backing audio only; notes are never ' +
      'generated from audio.',
    'MusicXML and Guitar Pro files are imported as musical events; sheet music and tablature are not displayed.',
    'Studio effects are a master limiter and one global reverb. Per-track EQ, delay, compression and automation ' +
      'are not included.',
    'Multiplayer: 2 to 4 players in Synchronized Play or Cooperative Band. Shared studio editing, two players on ' +
      'one keyboard, joining a song in progress and continuing after the host leaves are not included.',
    'MIDI devices are used only where the browser offers Web MIDI on a secure page.',
    'Browser and file-format support is listed in docs/COMPATIBILITY.md and reflects recorded tests, not ' +
      'assumptions.',
    'Sound: up to 64 voices at once on desktop and 32 on mobile; at the limit, the quietest released notes stop ' +
      'first, then the oldest. Projects: up to 32 tracks, 100,000 notes per track and 1,000,000 events.'
  ]);
  const FIDELITY_TEXT = 'Instruments are synthesized; timbres approximate General MIDI programs.';
  const CREDITS_TEXT = Object.freeze([
    'Finger Lickin Music is a single file. All code, sounds, music, characters and graphics in it were made for ' +
      'this game. It contains no third-party libraries, fonts, sound banks, samples or 3D models, so there are no ' +
      'third-party licenses to list.',
    'Instrument sounds are synthesized in real time; they approximate General MIDI instruments and are not ' +
      'recordings of real instruments.',
    'General MIDI, MusicXML and Guitar Pro are named only to describe file formats and instrument sets. They are ' +
      'trademarks of their respective owners. This game is not affiliated with or endorsed by them.',
    'The optional public STUN server stun.l.google.com is operated by Google and is used only when you turn it ' +
      'on in Multiplayer.'
  ]);
  const DEPENDENCY_TEXT = Object.freeze([
    'Runtime dependencies: none. The game is a single HTML file that loads nothing from the network: no ' +
      'libraries, fonts, images, sound files, 3D models or scripts.',
    'Development tools, not part of the game and not needed to play it: Node.js (MIT license) runs the build and ' +
      'test scripts; Playwright (Apache-2.0 license) and its Chromium browser (BSD-3-Clause and bundled ' +
      'component licenses) run the automated tests; Git keeps the history.'
  ]);
  const CONTENT_TEXT = 'Built-in content: the five demo songs, the tutorial, the character presets and the ' +
    'default settings are part of the file as data or are generated by the program while it runs. Nothing is ' +
    'downloaded or fetched.';
  // What the standalone core needs versus what needs HTTPS, a permission, an outside service or a server (R-E9-17).
  const NEEDS_ROWS = Object.freeze([
    ['Playing, Free Play, Studio, Library, Import, Dance, Settings', 'Nothing: this file alone, opened from a ' +
      'file or from any web server'],
    ['MIDI input', 'A browser with Web MIDI on a secure page (https:// or localhost), and your permission for ' +
      'each device'],
    ['Multiplayer by invite code', 'WebRTC in the browser and the other player; no server'],
    ['Multiplayer across networks', 'The optional public STUN server of Google, turned on by you in Multiplayer'],
    ['Multiplayer by room code', 'The Online edition and its relay server']
  ]);
  const BROWSER_ROWS = Object.freeze([['Desktop Chromium (Chrome, Edge)', 'Not yet verified'],
    ['Desktop Firefox', 'Not yet verified'], ['Desktop Safari', 'Not yet verified'],
    ['iOS Safari', 'Not yet verified'], ['Android Chrome', 'Not yet verified']]);
  const ABOUT_INDEX = Object.freeze([['ab-version', 'Version'], ['ab-limits', 'Limits'], ['ab-compat', 'Formats'],
    ['ab-browsers', 'Browsers'], ['ab-licenses', 'Licenses'], ['ab-privacy', 'Privacy']]);

  function openedFromWords() {
    const protocol = window.location.protocol;
    if (protocol === 'file:') return 'This device (file)';
    return protocol === 'https:' ? 'a web server (https)' : 'a web server (http)';
  }

  function aboutVersionPanel() {
    const online = fillText(EDITION_TEXT.online, { relayUrl: FLM.RELAY_URL });
    const edition = FLM.RELAY_URL ? online : EDITION_TEXT.standalone;
    const caps = Core.Caps.get();
    const render = FLM.Render && typeof FLM.Render.tier === 'function' ? FLM.Render.tier() : 'not started';
    const facts = [['Secure page', yesNo(caps.secureContext)], ['Opened from a file', yesNo(caps.isFile)],
      ['Graphics', render], ['Storage', FLM.Storage.state().mode]];
    return panel('ab-version', 'Finger Lickin Music ' + FLM.VERSION, [
      paragraph('Build ' + buildDate() + (isTestBuild() ? ' (Test build)' : ''), { id: 'ab-build' }),
      paragraph(edition, { id: 'ab-edition' }),
      paragraph('Opened from: ' + openedFromWords(), { id: 'ab-context' }),
      paragraph(say('S-GEN-03')), paragraph(say('S-GEN-04')),
      dataTable('ab-needs', 'What needs more than this file', ['Feature', 'Needs'], NEEDS_ROWS),
      dataTable('ab-facts', 'This device', ['Fact', 'Value'], facts)]);
  }

  function aboutLicensesPanel() {
    const lines = ['Third-party code: none.', 'Fonts, sounds, models: none; all content is original and synthesized.',
      'Built-in songs are original compositions for this game.', Core.LICENSE_NOTICE];
    return panel('ab-licenses', 'Credits and licenses', lines.map((line) => paragraph(line))
      .concat(CREDITS_TEXT.map((line) => paragraph(line)), DEPENDENCY_TEXT.map((line) => paragraph(line)),
        [paragraph(CONTENT_TEXT, { id: 'ab-content' }), paragraph(FIDELITY_TEXT, { id: 'ab-fidelity' }),
          paragraph('Finger Lickin Music is part of the HTML-Games collection.', { id: 'ab-credits' })]));
  }

  function createAbout() {
    function jumpTo(id) {
      const target = doc.getElementById(id);
      if (target) target.scrollIntoView({ block: 'start' });
    }

    function indexNav() {
      const buttons = ABOUT_INDEX.map((pair) => actionButton({ id: 'ab-jump-' + pair[0], label: pair[1],
        kind: 'ghost', onPress: () => jumpTo(pair[0]) }).root);
      return el('nav', { id: 'ab-index', 'aria-label': 'On this page' }, el('div', { class: 'btn-row' }, buttons));
    }

    function actions() {
      const copy = actionButton({ id: 'ab-copy', label: say('dlg.copy'), onPress: () => copyDiagnostics(false) });
      const open = actionButton({ id: 'ab-diagnostics', label: 'Diagnostics',
        onPress: () => enterMode('diagnostics') });
      return el('div', { class: 'btn-row' }, [copy.root, open.root]);
    }

    return {
      mount(root) {
        ensureStyles();
        const frame = UI.Frame.create(root, { prefix: 'ab', title: say('screen.SCR-About'), subtitle: '' });
        addAll(frame.body, [indexNav(), aboutVersionPanel(),
          panel('ab-limits', 'Limits of this version',
            [el('ul', null, LIMITS_TEXT.map((line) => el('li', null, line)))]),
          panel('ab-compat', 'Supported formats', [paragraph('The format table is added with the import step.')]),
          panel('ab-browsers', 'Browsers', [dataTable('ab-browser-table', 'Browser claims', ['Browser', 'Status'],
            BROWSER_ROWS)]),
          aboutLicensesPanel(),
          panel('ab-privacy', 'Privacy', [paragraph(say('S-SET-01')), paragraph('What is shared when you play with ' +
            'others is described under Settings > Privacy > Multiplayer privacy.')]),
          actions()]);
      },
      onBack: () => panelBack('about')
    };
  }

  // ---------------------------------------------------------------- SCR-Diagnostics (Part 6.27.4.17 and 7.6.15)
  const NO_SCENARIOS = 'No performance scenarios are registered yet.';
  const LOG_TEXT_LIMIT = 160;

  function laterSection() {
    return { headers: ['Value', 'Status'], rows: () => [['Not measured yet', LATER_BUILD]] };
  }

  function loadTimingText() {
    const stages = FLM.Boot && typeof FLM.Boot.stage === 'function' ? FLM.Boot.stage() : [];
    if (stages.length === 0) return 'Load timing: not available';
    const steps = stages.map((record) => record.stage + ' ' + record.stepMs + ' ms');
    return 'Load timing: ' + steps.join(', ') + '; ready after ' + stages[stages.length - 1].ms + ' ms';
  }

  function buildSection() {
    return { headers: ['Item', 'Value'], rows: () => {
      const names = Object.keys(Core.urlParams());
      return [['Version', FLM.VERSION], ['Edition', editionName()], ['Build date', buildDate()],
        ['Test build', yesNo(isTestBuild())], ['URL parameters', names.length > 0 ? names.join(', ') : 'none']];
    } };
  }

  function capsSection() {
    return { headers: ['Capability', 'Value'], rows: () => {
      const caps = Core.Caps.get();
      const flags = Object.keys(caps).filter((name) => name !== 'degraded' && name !== 'userAgent')
        .map((name) => [name, typeof caps[name] === 'boolean' ? yesNo(caps[name]) : caps[name]]);
      const degraded = gateEntries().map((row) => row.id + ': ' + row.reason);
      return flags.concat([['degraded', degraded.length > 0 ? degraded.join('; ') : 'none']]);
    } };
  }

  function storageSection() {
    return { headers: ['Item', 'Value'], rows: () => {
      const state = FLM.Storage.state();
      return [['Mode', state.mode], ['Notice', state.notice || 'none'], ['localStorage', yesNo(state.local.ok)],
        ['IndexedDB', yesNo(state.idb.ok)], ['Bytes used by flm.v1 keys', FLM.Storage.usedBytes()]];
    } };
  }

  function errorsSection() {
    return { headers: ['Code', 'Class', 'Count', 'Message'], rows: () => Core.ErrorReporter.records().slice(-ERROR_TAIL)
      .map((record) => [record.code, record.class, record.count, record.userMessage || record.message || '']) };
  }

  function logSection() {
    return { headers: ['Time (ms)', 'Level', 'Tag', 'Message'], rows: () => {
      const showDebug = Settings.get('diagnostics.logLevel') === 'debug';
      return Core.Log.entries().filter((entry) => showDebug || entry.level !== 'debug').slice(-LOG_TAIL)
        .map((entry) => [Math.round(entry.t), entry.level, entry.tag, UI.truncate(entry.msg, LOG_TEXT_LIMIT)]);
    } };
  }

  const DIAG_SECTIONS = Object.freeze([['dg-build', 'Build', buildSection], ['dg-caps', 'Capabilities', capsSection],
    ['dg-timing', 'Timing', laterSection], ['dg-audio', 'Audio', laterSection],
    ['dg-render', 'Rendering', laterSection],
    ['dg-storage', 'Storage', storageSection], ['dg-input', 'Input', laterSection], ['dg-net', 'Network', laterSection],
    ['dg-errors', 'Errors', errorsSection], ['dg-log', 'Log', logSection]]);

  function fillRows(body, rows) {
    body.textContent = '';
    rows.forEach((cells) => body.appendChild(el('tr', null, cells.map((cell) => el('td', null, String(cell))))));
  }

  // One section: a heading and a two or four column table that its provider refills; a throwing provider shows
  // "unavailable" for its rows (Part 7.6.15 Error state).
  function diagnosticsSection(definition) {
    const spec = definition[2]();
    const body = el('tbody');
    const head = el('tr', null, spec.headers.map((name) => el('th', { scope: 'col' }, name)));
    const table = el('table', { class: 'data-table mono' }, [el('thead', null, head), body]);
    const refresh = () => {
      try {
        fillRows(body, spec.rows());
      } catch (error) {
        fillRows(body, [['unavailable']]);
      }
    };
    refresh();
    return { node: panel(definition[0], definition[1], [el('div', { class: 'table-wrap' }, table)]), refresh };
  }

  function resultRows(results) {
    return results.tests.map((test) => [test.group, test.name, test.skipped ? 'Skipped' : (test.pass ? 'Pass' : 'Fail'),
      test.ms, test.message || '']);
  }

  function createDiagnostics() {
    const view = { mounted: false, includeContent: false, sections: [], selfTestBody: null, summary: null,
      perfBody: null };

    function refreshAll() {
      view.sections.forEach((section) => section.refresh());
    }

    function exportDiagnostics() {
      const exported = Core.Diagnostics.export({ includeContent: view.includeContent });
      return downloadText(todayStamp() + '-flm.flmdiag.json', exported.json, 'application/json');
    }

    function overlayToggle() {
      return UI.Widgets.toggle({ id: 'dg-overlay', label: 'Show stats overlay', value: Settings.get('video.showStats'),
        onChange: (value) => Settings.set('video.showStats', value, 'ui') });
    }

    function includeToggle() {
      return UI.Widgets.toggle({ id: 'dg-include', label: 'Include song content', value: false,
        onChange: (value) => { view.includeContent = value; } });
    }

    function logLevelSelect() {
      return UI.Widgets.select({ id: 'dg-log-level', label: 'Log level', value: Settings.get('diagnostics.logLevel'),
        options: choices([['info', 'Info'], ['debug', 'Debug']]), onChange: (value) => {
          Settings.set('diagnostics.logLevel', value, 'ui');
          Core.Log.setLevel(value);
          refreshAll();
        } });
    }

    function actionPanel() {
      const exportButton = actionButton({ id: 'dg-export', label: 'Export diagnostics', kind: 'primary',
        onPress: exportDiagnostics });
      const copy = actionButton({ id: 'dg-copy', label: say('dlg.copy'),
        onPress: () => copyDiagnostics(view.includeContent) });
      const tone = actionButton({ id: 'dg-tone', label: 'Test tone', disabledReason: LATER_BUILD });
      return panel('dg-actions', 'Actions', [paragraph(say('S-GEN-05'), { id: 'dg-include-note' }),
        includeToggle().root, overlayToggle().root, logLevelSelect().root,
        el('div', { class: 'btn-row' }, [exportButton.root, copy.root, tone.root])]);
    }

    async function runSelfTest() {
      const names = FLM.SelfTest.groups().map((group) => group.name)
        .filter((name) => !SELF_TEST_SKIPPED_GROUPS.includes(name));
      const results = await FLM.SelfTest.run(names, {});
      const line = results.passed + ' of ' + results.total + ' passed';
      if (!view.mounted) {
        UI.toast(line, { kind: results.failed === 0 ? 'success' : 'error' });
        return;
      }
      fillRows(view.selfTestBody, resultRows(results));
      view.summary.textContent = line;
    }

    async function runPerformance() {
      const names = FLM.SelfTest.perf.list();
      const lines = [];
      for (const name of names) {
        const result = await FLM.SelfTest.perf.run(name, {});
        lines.push([name, result.durationMs, result.notes.join('; ')]);
      }
      if (!view.mounted) {
        UI.toast(names.length + ' performance scenarios finished', { kind: 'info' });
        return;
      }
      fillRows(view.perfBody, lines);
    }

    function testBuildPanel() {
      if (!isTestBuild()) return null;
      const scenarios = FLM.SelfTest.perf.list();
      const run = actionButton({ id: 'dg-selftest', label: 'Run self-test', onPress: runSelfTest });
      const perf = actionButton({ id: 'dg-perf', label: 'Run performance scenarios', onPress: runPerformance,
        disabledReason: scenarios.length === 0 ? NO_SCENARIOS : undefined });
      view.selfTestBody = el('tbody');
      view.perfBody = el('tbody');
      view.summary = paragraph('', { id: 'dg-selftest-summary' });
      const results = el('table', { class: 'data-table mono', id: 'dg-selftest-results' }, [el('thead', null,
        el('tr', null, ['Group', 'Test', 'Result', 'ms', 'Message'].map((name) => el('th', { scope: 'col' }, name)))),
      view.selfTestBody]);
      const perfTable = el('table', { class: 'data-table mono', id: 'dg-perf-results' }, [el('thead', null,
        el('tr', null, ['Scenario', 'ms', 'Notes'].map((name) => el('th', { scope: 'col' }, name)))), view.perfBody]);
      return panel('dg-selftest-panel', 'Self-test (test build)', [el('div', { class: 'btn-row' },
        [run.root, perf.root]), view.summary, el('div', { class: 'table-wrap' }, results),
      el('div', { class: 'table-wrap' }, perfTable)]);
    }

    return {
      mount(root, params, ctx) {
        ensureStyles();
        view.mounted = true;
        const frame = UI.Frame.create(root, { prefix: 'dg', title: say('screen.SCR-Diagnostics'), subtitle: '' });
        view.sections = DIAG_SECTIONS.map((definition) => diagnosticsSection(definition));
        addAll(frame.body, [paragraph(loadTimingText(), { id: 'dg-load' }), actionPanel()]
          .concat(view.sections.map((section) => section.node), [testBuildPanel()]));
        Core.timers.setInterval(refreshAll, REFRESH_MS, ctx.owner);
      },
      unmount() {
        view.mounted = false;
      },
      onBack: () => panelBack('diagnostics')
    };
  }

  // ---------------------------------------------------------------- dialogs (Part 6.27.4.21 and 7.7)
  const OK_BUTTON = Object.freeze({ id: 'ok', kind: 'primary', isDefault: true, isCancel: true });

  function modeLabel(mode) {
    const entry = MENU_ENTRIES.find((item) => item.mode === mode);
    return entry ? entry.label : 'This mode';
  }

  function coded(code, message) {
    return Object.assign(new Error(message), { code });
  }

  // DLG-AudioBlocked: the enable button calls Audio.unlock() inside the click, then the dialog waits for
  // audio.unlocked (resolves 'enabled') and after 5 s says the sound is still blocked.
  function openAudioBlocked(params) {
    const token = Symbol('dlg-audio-blocked');
    const view = { status: null, finish: null, enable: null };
    const isUnlocked = () => Boolean(FLM.Audio) && typeof FLM.Audio.isUnlocked === 'function' &&
      FLM.Audio.isUnlocked();
    function tryUnlock() {
      if (!FLM.Audio || typeof FLM.Audio.unlock !== 'function') {
        view.status.textContent = say('S-AUD-03');
        return undefined;
      }
      view.status.textContent = say('dlg.audio.waiting');
      const attempt = FLM.Audio.unlock();      // inside the gesture, before any await
      Core.timers.setTimeout(() => { view.status.textContent = say('dlg.audio.blocked'); }, AUDIO_WAIT_MS, token);
      return Promise.resolve(attempt).then(() => { if (isUnlocked()) view.finish('enabled'); },
        () => { view.status.textContent = say('S-AUD-03'); });
    }
    const spec = { id: 'DLG-AudioBlocked', title: say('dlg.audio.title'),
      body: say('S-AUD-02') + ' ' + modeLabel(params.mode) + ' needs sound.',
      buttons: [{ id: 'cancel', label: say('dlg.cancel'), kind: 'secondary', isCancel: true }],
      build(container, finish) {
        view.finish = finish;
        view.enable = actionButton({ id: 'dlg-audio-enable', label: say('dlg.audio.enable'), kind: 'primary',
          onPress: tryUnlock });
        view.status = paragraph('', { id: 'dlg-audio-status', role: 'status' });
        addAll(container, [el('div', { class: 'btn-row' }, view.enable.root), view.status]);
      } };
    const shown = UI.dialog(spec);
    bus.on('audio.unlocked', () => view.finish('enabled'), token);
    view.enable.focus();
    return shown.then((result) => {
      bus.removeOwner(token);
      Core.timers.clearOwner(token);
      return result;
    });
  }

  // DLG-ResumeAudio: Audio.resume() runs inside the click, then the dialog closes with 'resume'.
  function openResumeAudio(params) {
    const detail = params.detail ? ' ' + params.detail : '';
    const view = { resume: null };
    const spec = { id: 'DLG-ResumeAudio', title: say('dlg.resume.title'), body: say('dlg.resume.body') + detail,
      buttons: [{ id: 'cancel', label: say('dlg.resume.cancel'), kind: 'secondary', isCancel: true }],
      build(container, finish) {
        const resume = () => {
          const attempt = FLM.Audio && typeof FLM.Audio.resume === 'function' ? FLM.Audio.resume() : undefined;
          return Promise.resolve(attempt).then(() => finish('resume'));
        };
        view.resume = actionButton({ id: 'dlg-resume', label: say('dlg.resume.enable'), kind: 'primary',
          onPress: resume });
        container.appendChild(el('div', { class: 'btn-row' }, view.resume.root));
      } };
    const shown = UI.dialog(spec);
    view.resume.focus();
    return shown;
  }

  // DLG-Unsupported: a disabled feature (title, reason) or the "returned to the menu" variant of showError().
  function openUnsupported(params) {
    const returned = params.variant === 'returned';
    const record = params.record || {};
    const operation = record.context && record.context.mode ? modeLabel(record.context.mode) : 'The last action';
    const title = returned ? say('dlg.returned.title', { operation }) :
      say('dlg.unsupported.title', { feature: params.feature });
    const body = returned ? [record.userMessage || record.message || '', say('dlg.returned.body')] : params.reason;
    const buttons = [Object.assign({ label: say('dlg.ok') }, OK_BUTTON)];
    if (returned) buttons.unshift({ id: 'copy', label: say('dlg.copy'), kind: 'secondary' });
    return UI.dialog({ id: 'DLG-Unsupported', title, body, buttons, alert: returned }).then((result) => {
      if (result === 'copy') copyDiagnostics(false);
      return result;
    });
  }

  function openImportSettings(params) {
    const shown = params.changes.slice(0, IMPORT_LIST_LIMIT);
    const rest = params.changes.length - shown.length;
    const lines = shown.map((change) => el('li', null, change.path));
    if (rest > 0) lines.push(el('li', null, say('dlg.importSettings.more', { count: rest })));
    return UI.dialog({ id: 'DLG-ImportSettings', title: say('dlg.importSettings.title'),
      body: say('dlg.importSettings.body', { file: params.file }),
      build: (container) => container.appendChild(el('ul', { id: 'dlg-import-changes' }, lines)),
      buttons: [{ id: 'apply', label: say('dlg.importSettings.apply'), kind: 'primary' },
        { id: 'cancel', label: say('dlg.cancel'), kind: 'secondary', isCancel: true, isDefault: true }] });
  }

  function openConfirmReset() {
    return UI.dialog({ id: 'DLG-ConfirmReset', title: say('dlg.reset.title'), body: say('dlg.reset.body'),
      consequence: say('dlg.reset.consequence'),
      buttons: [{ id: 'reset', label: say('dlg.reset.apply'), kind: 'danger' },
        { id: 'cancel', label: say('dlg.cancel'), kind: 'secondary', isCancel: true, isDefault: true }] });
  }

  // Dialogs of the list that later steps build; asking for one now is a clear error, never a silent no-op.
  const dialogBuilders = new Map([['DLG-AudioBlocked', openAudioBlocked], ['DLG-ResumeAudio', openResumeAudio],
    ['DLG-Unsupported', openUnsupported], ['DLG-ImportSettings', openImportSettings],
    ['DLG-ConfirmReset', openConfirmReset]]);

  /** Opens a dialog by id; resolves to the chosen button id. */
  function openDialog(id, params) {
    const builder = dialogBuilders.get(id);
    if (!builder) return Promise.reject(coded('E-MODE-002', 'dialog ' + id + ' is not built in this version'));
    try {
      return builder(params || {});
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /** DLG-Unsupported variant "Returned to the menu" for the error records of M-28. */
  function showError(record) {
    return openDialog('DLG-Unsupported', { variant: 'returned', record }).then(() => undefined);
  }

  // ---------------------------------------------------------------- registry and global reactions
  // Screens of the list that later steps build are known ids but have no controller yet (E-MODE-002).
  const controllers = new Map([['SCR-FirstLaunch', createFirstLaunch], ['SCR-MainMenu', createMainMenu],
    ['SCR-Settings', createSettingsScreen], ['SCR-Help', createHelp], ['SCR-About', createAbout],
    ['SCR-Diagnostics', createDiagnostics]]);
  const registration = { reactions: false };

  /** Controller factory for a screen id; an unknown or not yet built id throws E-MODE-002. */
  function get(id) {
    if (!SCREEN_IDS.includes(id)) throw coded('E-MODE-002', 'unknown screen ' + id);
    if (!controllers.has(id)) throw coded('E-MODE-002', 'screen ' + id + ' is not built in this version');
    return controllers.get(id);
  }

  function installReactions() {
    bus.on('progress.unlock', (event) => {
      if (event && event.title) UI.toast('Unlocked: ' + event.title, { kind: 'success' });
    }, SCREENS_OWNER);
    bus.on('storage.state', (event) => {
      if (event && event.notice && event.reason !== 'open') UI.toast(event.notice, { kind: 'warn' });
    }, SCREENS_OWNER);
  }

  /** Boot step B11: installs the resolver into UI.Screens and the global reactions once. Idempotent. */
  function register() {
    ensureStyles();
    UI.Screens.setResolver(get);
    if (registration.reactions) return;
    registration.reactions = true;
    installReactions();
  }

  const show = (id, params) => UI.Screens.push(id, params);

  return Object.freeze({
    SCREENS: SCREEN_IDS,
    DIALOGS: DIALOG_IDS,
    register,
    get,
    show,
    dialog: openDialog,
    showError,
    codeLabel,
    padWords,
    counters: () => ({ globalListeners: registration.reactions ? 2 : 0,
      activeController: UI.Screens.current() ? UI.Screens.current().id : null }),
    Settings
  });
});
})();
