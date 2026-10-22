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
const SAVE_NEWER_ELSEWHERE = 'The game was saved in another tab. This tab now uses that save; its own last change was not kept.';
// A written record starts with the version and its write counter, so another tab's revision is read without parsing the whole save.
const SAVE_REVISION_HEAD = /^\{"version":\d+,"revision":(\d+)[,}]/;

// 'null' | 'array' | typeof: a loaded field must have the kind of its empty-save default (a null default also takes an object).
function saveFieldKind(value) { return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value; }
function saveFieldFits(freshValue, value) {
  const want = saveFieldKind(freshValue), have = saveFieldKind(value);
  return have === want || (want === 'null' && have === 'object');
}
// A text to import is a save: a version this game can read and at least one known field of the right kind that holds something.
function saveLooksReal(loaded, fresh) {
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) return false;
  if (!Number.isInteger(loaded.version) || loaded.version < 1 || loaded.version > SAVE_VERSION) return false;
  return Object.keys(fresh).some((field) => {
    const value = loaded[field];
    if (field === 'version' || field === 'revision' || value === null || !saveFieldFits(fresh[field], value)) return false;
    return typeof value !== 'object' || Object.keys(value).length > 0;   // a non-empty object or list
  });
}
// The write counter of a stored record; 0 for a record from before the counter (or one that cannot be read).
function saveRevisionOf(raw) {
  const head = SAVE_REVISION_HEAD.exec(raw || '');
  return head ? Number(head[1]) : 0;
}

const Save = {
  data: null,             // the live save object
  storageWorks: true,
  notice: '',             // one-line message for the UI (storage blocked, save was reset)
  timer: 0,
  dirty: false,           // a change waits to be written: a flush on pause or page hide writes only then (R-163)
  storage: null,          // replaced by a memory stub in headless tests

  emptySave() {
    // Every top-level field is declared here, so migrate repairs each one (ARC-020). revision: counts the writes, so a stale tab never
    // writes over a newer save (R-001); play: the last play-screen setup (18d, null = none yet); crosshairs: per-weapon crosshair overrides
    // (17b); loadouts: classes, hero and kit choices (13d Loadouts); tips: matches seen (18n), the iPhone Home Screen tip shown (18p).
    return { version: SAVE_VERSION, revision: 0, settings: {}, bindings: {}, touchLayouts: {}, progression: {}, stats: {}, rulesets: [], editorMaps: [],
      ladder: {}, play: null, crosshairs: {}, tips: { matches: 0, homeScreen: false },
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
  // Brings any older save up to SAVE_VERSION; fills missing top-level fields and replaces ones of the wrong kind ("settings": null),
  // then checks every stored setting against its definition (load and import both come through here).
  migrate(loaded) {
    if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) throw new Error('save is not an object');
    const fresh = this.emptySave();
    for (const field in fresh) if (!saveFieldFits(fresh[field], loaded[field])) loaded[field] = fresh[field];
    Settings.sanitize(loaded.settings);
    // A copy that starts with version and revision (SAVE_REVISION_HEAD); the other fields keep their order.
    const ordered = Object.assign({ version: SAVE_VERSION, revision: 0 }, loaded);
    ordered.version = SAVE_VERSION;
    return ordered;
  },
  scheduleSave() {
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), SAVE_DEBOUNCE_MS);
  },
  // Writes at once (callers that changed the save call it directly). Another tab wrote a newer save since this one was read: this tab
  // carries on from that save instead of writing its stale copy over it (R-001).
  saveNow() {
    clearTimeout(this.timer);
    if (this.adoptNewer()) return this.fail(SAVE_NEWER_ELSEWHERE);
    this.data.revision++;
    const text = JSON.stringify(this.data);
    if (text.length > SAVE_MAX_BYTES) { this.data.revision--; return this.fail(SAVE_TOO_BIG); }
    if (!this.write(SAVE_KEY, text)) { this.data.revision--; return false; }
    this.dirty = false;
    return true;
  },
  // Takes the stored save when another tab wrote a newer one (a 'storage' event, a page back from the cache, or before a write).
  // Returns true when it did; the settings readers hear every key again.
  adoptNewer() {
    const raw = this.read(SAVE_KEY);
    if (saveRevisionOf(raw) <= this.data.revision) return false;
    try {
      this.data = this.migrate(JSON.parse(raw));
    } catch (error) {
      return false;   // an unreadable newer record: keep this tab's save; the next load backs it up
    }
    this.dirty = false;
    Settings.applyAll();
    return true;
  },
  // A failed write tells the player at once with a toast (PLT-003), not only at the next boot; a repeat of the same failure stays quiet.
  fail(text) {
    if (this.notice === text) return false;
    this.notice = text;
    emitToast(text);
    return false;
  },
  exportText() { return JSON.stringify(this.data); },
  // Replaces the save with an exported one; throws on text that is not a save (the UI shows the message). The replaced save goes to
  // BACKUP_KEY first (Restore backup undoes the import). Returns the write result: on a failed write the old save stays (R-037).
  importText(text) {
    const loaded = JSON.parse(text);
    if (!saveLooksReal(loaded, this.emptySave())) throw new Error('no save version or progress in it');   // '{}' never wipes a save (R-038)
    const parsed = this.migrate(loaded);
    parsed.revision = Math.max(parsed.revision, saveRevisionOf(this.read(SAVE_KEY)));   // an older export still replaces the stored save
    const previous = this.data;
    this.write(BACKUP_KEY, JSON.stringify(previous));
    this.data = parsed;
    const written = this.saveNow();
    if (!written && this.data === parsed) this.data = previous;   // (a newer save from another tab, adopted by saveNow, stays)
    Settings.applyAll();
    return written;
  },
  backupText() { return this.read(BACKUP_KEY); },   // the save replaced by the last import, or a save that could not be read (null = none)
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
    const valid = this.validValue(definition, value);
    Save.data.settings[key] = valid === undefined ? definition.fallback : valid;
    Save.scheduleSave();
    Bus.emit('setting', key);
  },
  // The value as the definition allows it (numbers clamped to min..max), or undefined when it cannot be one: not one of the options,
  // another type than the default, not a finite number. The one check for set and for every loaded or imported save (R-036).
  validValue(definition, value) {
    if (definition.options) return definition.options.includes(value) ? value : undefined;   // options may mix 'auto' and numbers
    const fallback = definition.fallback;
    // Older saves stored a plain on/off for what is a slider now (head bob): on = the slider's top, off = its bottom.
    if (typeof value === 'boolean' && typeof fallback === 'number' && definition.min !== undefined) value = value ? definition.max : definition.min;
    if (value === null || typeof value !== typeof fallback) return undefined;
    if (typeof value !== 'number') return value;
    if (!Number.isFinite(value)) return undefined;
    return definition.min === undefined ? value : clamp(value, definition.min, definition.max);
  },
  // A loaded or imported save's settings: values a reader could not use are dropped (the default applies), numbers are clamped.
  // Keys this version does not define are kept untouched.
  sanitize(stored) {
    for (const [key, definition] of this.definitions) {
      if (!(key in stored)) continue;
      const value = this.validValue(definition, stored[key]);
      if (value === undefined) delete stored[key]; else stored[key] = value;
    }
  },
  // The one reset path (a Reset button, the tests): drop the saved values of exactly these keys, then announce each key once.
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
const Quality = {
  autoId: 'medium',
  current() {
    const chosen = Settings.get('video.quality');
    const stored = chosen === 'auto' ? (Settings.get('video.autoQuality') || this.autoId) : chosen;
    return CAT.quality.byId(stored) || CAT.quality.byId('medium');
  },
};
