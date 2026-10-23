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
const SAVE_NEWER_ELSEWHERE = 'Another tab saved: this tab now uses its save.';
// A record starts with version and revision: another tab's revision is read without parsing.
const SAVE_REVISION_HEAD = /^\{"version":\d+,"revision":(\d+)[,}]/;

// 'null' | 'array' | typeof: a loaded field must have the kind of its empty-save default (a null default also takes an object).
function saveFieldKind(value) { return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value; }
function saveFieldFits(freshValue, value) {
  const want = saveFieldKind(freshValue), have = saveFieldKind(value);
  return have === want || (want === 'null' && have === 'object');
}
// Fills the missing or wrong-kind fields of `loaded` from `fresh`, down every record the empty save spells out (loadouts.classes,
// tips); a list keeps only its record entries (a null custom class would throw in its readers).
function repairSaveFields(fresh, loaded) {
  for (const field in fresh) {
    const want = fresh[field];
    if (!saveFieldFits(want, loaded[field])) loaded[field] = want;
    else if (Array.isArray(want)) loaded[field] = loaded[field].filter((entry) => saveFieldKind(entry) === 'object');
    else if (saveFieldKind(want) === 'object') repairSaveFields(want, loaded[field]);
  }
}
// An import needs a version this game reads and one known, non-empty field of the right kind.
function saveLooksReal(loaded, fresh) {
  if (!loaded || !Number.isInteger(loaded.version) || loaded.version < 1 || loaded.version > SAVE_VERSION) return false;
  return Object.keys(fresh).some((field) => field !== 'version' && field !== 'revision' && !!loaded[field] && saveFieldFits(fresh[field], loaded[field])
    && Object.keys(loaded[field]).length > 0);
}
// A stored record's revision (0: none, or unreadable).
function saveRevisionOf(raw) {
  const head = SAVE_REVISION_HEAD.exec(raw || '');
  return head ? Number(head[1]) : 0;
}

const Save = {
  data: null,             // the live save object
  storageWorks: true,     // false from a failed access until a save is written again
  notice: '',             // one-line message for the UI (storage blocked, save was reset)
  lastFailure: '',        // the failure last told (fail), cleared by a good write
  timer: 0,
  // An unwritten change: a flush writes only then (R-163)
  dirty: false,
  storage: null,          // replaced by a memory stub in headless tests

  emptySave() {
    // Every field is declared here, so migrate repairs it (ARC-020). revision: write count (R-001); play: last setup (18d, null = none);
    // crosshairs: per-weapon overrides (17b); loadouts: 13d; tips: 18n, 18p, 06 (silentSwitch).
    return { version: SAVE_VERSION, revision: 0, settings: {}, bindings: {}, touchLayouts: {}, progression: {}, stats: {}, rulesets: [], editorMaps: [],
      ladder: {}, play: null, crosshairs: {}, tips: { matches: 0, homeScreen: false, silentSwitch: false },
      loadouts: { classes: { selected: CAT.classes[0].id, custom: [] }, heroes: { hero: CAT.heroes[0].id }, kits: {} } };
  },
  load() {
    const raw = this.read(SAVE_KEY);
    this.dirty = false;
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
  // Brings a save up to SAVE_VERSION: fills missing or wrong-kind fields ("settings": null, nested ones too), checks every setting (load and import).
  migrate(loaded) {
    if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) throw new Error('save is not an object');
    repairSaveFields(this.emptySave(), loaded);
    Settings.sanitize(loaded.settings);
    // Version and revision first (SAVE_REVISION_HEAD).
    const ordered = Object.assign({ version: SAVE_VERSION, revision: 0 }, loaded);
    ordered.version = SAVE_VERSION;
    return ordered;
  },
  scheduleSave() {
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), SAVE_DEBOUNCE_MS);
  },
  // Writes at once; when another tab wrote a newer save, takes it instead of writing over it (R-001).
  saveNow() {
    clearTimeout(this.timer);
    if (this.adoptNewer()) return this.fail(SAVE_NEWER_ELSEWHERE);
    this.data.revision++;
    const text = JSON.stringify(this.data);
    const written = text.length > SAVE_MAX_BYTES ? this.fail(SAVE_TOO_BIG) : this.write(SAVE_KEY, text);
    if (!written) { this.data.revision--; return false; }
    // Storage works again: the next failure is told again.
    this.dirty = false; this.storageWorks = true; this.lastFailure = '';
    return true;
  },
  // Takes a newer stored save (another tab's); true when it did.
  adoptNewer() {
    const raw = this.read(SAVE_KEY);
    if (saveRevisionOf(raw) <= this.data.revision) return false;
    try {
      this.data = this.migrate(JSON.parse(raw));
    } catch (error) {
      // Unreadable: this tab's save stays.
      return false;
    }
    this.dirty = false;
    Settings.applyAll();
    return true;
  },
  // A failed write tells the player at once with a toast (PLT-003), not only at the next boot; a repeat of the same failure
  // stays quiet until a write works again.
  fail(text) {
    if (this.lastFailure === text) return false;
    this.lastFailure = text;
    this.notice = text;
    emitToast(text);
    return false;
  },
  exportText() { return JSON.stringify(this.data); },
  // Replaces the save; throws on a non-save. The old save goes to BACKUP_KEY, and stays on a failed write (R-037).
  importText(text) {
    const loaded = JSON.parse(text);
    // '{}' never wipes a save (R-038)
    if (!saveLooksReal(loaded, this.emptySave())) throw new Error('no save version or progress in it');
    const parsed = this.migrate(loaded);
    // An older export still replaces the stored save.
    parsed.revision = Math.max(parsed.revision, saveRevisionOf(this.read(SAVE_KEY)));
    const previous = this.data;
    this.write(BACKUP_KEY, this.exportText());
    this.data = parsed;
    const written = this.saveNow();
    // Unless saveNow took another tab's save.
    if (!written && this.data === parsed) this.data = previous;
    Settings.applyAll();
    return written;
  },
  // The save an import replaced, or an unreadable one (null = none)
  backupText() { return this.read(BACKUP_KEY); },
  read(key) {
    try { return (this.storage || window.localStorage).getItem(key); } catch (error) { this.markBroken(); return null; }
  },
  write(key, text) {
    try { (this.storage || window.localStorage).setItem(key, text); return true; } catch (error) { this.markBroken(); return false; }
  },
  markBroken() {
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
    const valid = this.validValue(definition, value);
    Save.data.settings[key] = valid === undefined ? definition.fallback : valid;
    Save.scheduleSave();
    Bus.emit('setting', key);
  },
  // The value the definition allows (numbers clamped), or undefined; the one check for set and loaded saves (R-036).
  validValue(definition, value) {
    // Options may mix 'auto' and numbers.
    if (definition.options) return definition.options.includes(value) ? value : undefined;
    const fallback = definition.fallback;
    // An old on/off for what is now a slider (head bob): on = max, off = min.
    if (typeof value === 'boolean' && typeof fallback === 'number' && definition.min !== undefined) value = value ? definition.max : definition.min;
    if (value === null || typeof value !== typeof fallback || (typeof value === 'number' && !Number.isFinite(value))) return undefined;
    return definition.min === undefined ? value : clamp(value, definition.min, definition.max);
  },
  // Drops loaded values no reader could use (the default applies), clamps numbers; unknown keys stay.
  sanitize(stored) {
    for (const [key, definition] of this.definitions) {
      if (!(key in stored)) continue;
      const value = this.validValue(definition, stored[key]);
      if (value === undefined) delete stored[key]; else stored[key] = value;
    }
  },
  // Drops the saved values of these keys, then announces each once.
  resetKeys(keys) {
    for (const key of keys) delete Save.data.settings[key];
    Save.scheduleSave();
    for (const key of keys) Bus.emit('setting', key);
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
  // The step-down's preset for this session; 'quality.change' (payload: the preset row) tells every reader of the caps at once.
  setSession(id) {
    this.sessionId = id;
    Bus.emit('quality.change', this.current());
  },
};
// Registered before S07's video settings listener, which then reads the new preset.
Bus.on('setting', (key) => { if (key === 'video.quality' || key === 'video.autoQuality') Quality.sessionId = ''; });
