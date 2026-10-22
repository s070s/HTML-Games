// ==== S04 SETTINGS / SAVE ====
// One save record in localStorage (ARC-020). Every storage access is wrapped: the game runs without persistence (PLT-003).
// Settings are declared by the section that reads them: Settings.define('video.fov', 90, {min, max}).

const SAVE_KEY = 'ctk.save.v1';
const BACKUP_KEY = 'ctk.save.bak';
const SAVE_VERSION = 1;
const SAVE_MAX_BYTES = 1024 * 1024;
const SAVE_DEBOUNCE_MS = 500;           // ARC-021
const SAVE_TOO_BIG = 'Save is over 1 MB and was not written.';
const SAVE_BLOCKED = 'Storage is blocked or full: settings and progress will not be kept.';

// 'null' | 'array' | typeof: a loaded field must have the kind of its empty-save default (a null default also takes an object).
function saveFieldKind(value) { return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value; }

const Save = {
  data: null,             // the live save object
  storageWorks: true,
  notice: '',             // one-line message for the UI (storage blocked, save was reset)
  timer: 0,
  storage: null,          // replaced by a memory stub in headless tests

  emptySave() {
    // play: the last play-screen setup (18d, null = none yet); crosshairs: per-weapon crosshair overrides (17b).
    return { version: SAVE_VERSION, settings: {}, bindings: {}, touchLayouts: {}, progression: {}, stats: {}, rulesets: [], editorMaps: [], ladder: {},
      play: null, crosshairs: {} };
  },
  load() {
    const raw = this.read(SAVE_KEY);
    if (raw === null) { this.data = this.emptySave(); return this.data; }
    try {
      this.data = this.migrate(JSON.parse(raw));
    } catch (error) {
      this.write(BACKUP_KEY, raw);
      this.data = this.emptySave();
      this.notice = 'Your save could not be read. It was backed up and reset.';
      ErrorLog.add('save.load', error);
    }
    return this.data;
  },
  // Brings any older save up to SAVE_VERSION; fills missing top-level fields and replaces ones of the wrong kind ("settings": null).
  migrate(loaded) {
    if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) throw new Error('save is not an object');
    const fresh = this.emptySave();
    for (const field in fresh) {
      const want = saveFieldKind(fresh[field]), have = saveFieldKind(loaded[field]);
      if (have !== want && !(want === 'null' && have === 'object')) loaded[field] = fresh[field];
    }
    loaded.version = SAVE_VERSION;
    return loaded;
  },
  scheduleSave() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), SAVE_DEBOUNCE_MS);
  },
  saveNow() {
    clearTimeout(this.timer);
    const text = JSON.stringify(this.data);
    if (text.length > SAVE_MAX_BYTES) return this.fail(SAVE_TOO_BIG);
    return this.write(SAVE_KEY, text);
  },
  // A failed write tells the player at once with a toast (PLT-003), not only at the next boot; a repeat of the same failure stays quiet.
  fail(text) {
    if (this.notice === text) return false;
    this.notice = text;
    emitToast(text);
    return false;
  },
  exportText() { return JSON.stringify(this.data); },
  importText(text) {
    const parsed = this.migrate(JSON.parse(text)); // throws on bad input; the UI shows the message
    this.data = parsed;
    Settings.applyAll();
    this.saveNow();
  },
  read(key) {
    try { return (this.storage || window.localStorage).getItem(key); } catch (error) { this.markBroken(); return null; }
  },
  write(key, text) {
    try { (this.storage || window.localStorage).setItem(key, text); return true; } catch (error) { this.markBroken(); return false; }
  },
  markBroken() {
    if (!this.storageWorks) return;
    this.storageWorks = false;
    this.fail(SAVE_BLOCKED);
  },
};

// In-memory stand-in for localStorage (headless tests, and the "storage broken" test case).
function makeMemoryStorage(throwOnAccess) {
  const values = new Map();
  return {
    getItem(key) { if (throwOnAccess) throw new Error('storage blocked'); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { if (throwOnAccess) throw new Error('storage blocked'); values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

const Settings = {
  definitions: new Map(),   // key -> { fallback, min, max, options, onChange }
  readCounts: new Map(),    // key -> times read (self-test: no setting is written but never read, MIS-008)
  define(key, fallback, extra) {
    if (this.definitions.has(key)) throw new Error('setting defined twice: ' + key);
    this.definitions.set(key, Object.assign({ fallback }, extra || {}));
  },
  get(key) {
    const definition = this.definitions.get(key);
    if (!definition) throw new Error('unknown setting: ' + key);
    this.readCounts.set(key, (this.readCounts.get(key) || 0) + 1);
    const stored = Save.data ? Save.data.settings[key] : undefined;
    return stored === undefined ? definition.fallback : stored;
  },
  set(key, value) {
    const definition = this.definitions.get(key);
    if (!definition) throw new Error('unknown setting: ' + key);
    if (typeof value === 'number' && definition.min !== undefined) value = clamp(value, definition.min, definition.max);
    if (definition.options && !definition.options.includes(value)) value = definition.fallback;
    Save.data.settings[key] = value;
    Save.scheduleSave();
    Bus.emit('setting', key);
  },
  reset(prefix) {
    for (const key of this.definitions.keys()) if (!prefix || key.startsWith(prefix)) delete Save.data.settings[key];
    Save.scheduleSave();
    this.applyAll();
  },
  applyAll() { for (const key of this.definitions.keys()) Bus.emit('setting', key); },
};

// Current quality preset (PERF-008). 'auto' resolves to Quality.autoId, which the renderer's first-run benchmark sets.
Settings.define('video.quality', 'auto', { label: 'Quality', category: 'video', options: ['auto', 'ultra', 'high', 'medium', 'low', 'potato'] });
Settings.define('video.autoQuality', '', { label: 'Benchmarked quality', category: 'developer' });
// sessionId: the renderer's automatic step-down (PERF-013), for this session only and never saved, so bots, enemies,
// props and audio voices drop with the renderer; a chosen or benchmarked preset ends it.
const Quality = {
  autoId: 'medium',
  sessionId: '',
  current() {
    const chosen = Settings.get('video.quality');
    const stored = this.sessionId || (chosen === 'auto' ? (Settings.get('video.autoQuality') || this.autoId) : chosen);
    return CAT.quality.byId(stored) || CAT.quality.byId('medium');
  },
};
// Registered before S07's video settings listener, which then reads the new preset.
Bus.on('setting', (key) => { if (key === 'video.quality' || key === 'video.autoQuality') Quality.sessionId = ''; });
