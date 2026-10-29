// ==== S04 SETTINGS / SAVE ====
// One save record in localStorage (ARC-020). Every storage access is wrapped: the game runs without persistence (PLT-003).
// Settings are declared by the section that reads them: Settings.define('video.fov', 90, {min, max}).

const SAVE_KEY = 'ctk.save.v1';
const BACKUP_KEY = 'ctk.save.bak';
const SPARE_KEY = 'ctk.save.spare';     // an unreadable or newer-version record, when BACKUP_KEY already holds a readable save (A-04, A-05)
const SAVE_VERSION = 1;
const SAVE_MAX_BYTES = 1024 * 1024;
const SAVE_DEBOUNCE_MS = 500;           // ARC-021
const SAVE_TOO_BIG = 'Save is over 1 MB and was not written.';
const SAVE_BLOCKED = 'Storage is blocked or full: settings and progress will not be kept.';
const SAVE_NEWER_ELSEWHERE = 'Another tab saved: this tab now uses its save.';
const SAVE_FROM_NEWER_GAME = 'Your save is from a newer version of the game. A copy was kept and the stored save will not be overwritten, so progress now is not kept.';
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
// True when the text parses to a JSON object (a readable save record, whatever its version).
function saveParses(text) {
  try { const value = JSON.parse(text); return !!value && typeof value === 'object' && !Array.isArray(value); } catch (error) { return false; }
}
// A stored record's revision (0: none, or unreadable).
function saveRevisionOf(raw) {
  const head = SAVE_REVISION_HEAD.exec(raw || '');
  return head ? Number(head[1]) : 0;
}

// P3-04 / P3-06: ids that no longer exist, each mapped to the row that took its place (Appendix C of the task list, "P3-03" and
// "P3-06"). A save, a saved map or a shared code that names an old id loads with the new one. Retired codes are never reused.
const WEAPON_MIGRATION = {
  twinsting: 'wasp', riptide: 'wasp', tempest: 'vanguard', longshot: 'kestrel', pulsecarbine: 'hornet', frostbore: 'scattergun', anvil: 'hailstorm', kingfisher: 'ramjet',
  W08: 'wasp', W11: 'wasp', W14: 'vanguard', W16: 'kestrel', W18: 'hornet', W22: 'scattergun', W29: 'hailstorm', W33: 'ramjet',
};
// Gadgets that moved into an ability (decoy, dome, lift pad, mender, dart) or another gadget (mine, drain). No save holds a gadget
// key today (custom class slots accept only the preset values); the map is for data rows and future loadouts.
const GADGET_MIGRATION = { decoy: 'holodouble', prox: 'claymore', bubble: 'aegisdome', liftpad: 'updraft', regen: 'mender', drain: 'emp', dart: 'echopulse' };
const ITEM_MIGRATION = { surplus: 'megacell', aegisbelt: 'heavyplate', scoutrune: 'quickening', ammorune: 'bottomless' };
const ABILITY_MIGRATION = { ignite: 'arcbolt', frostlance: 'arcbolt' };
const MAP_ITEM_MIGRATION = Object.assign({}, WEAPON_MIGRATION, ITEM_MIGRATION);   // the item keys of a map pad
const WEAPON_STAT_SUM_FIELDS = ['shots', 'hits', 'kills', 'headshots'];
const CUSTOM_DRAFT_SETTING = 'custom.draft';   // 18g keeps the match editor's draft as JSON text in this setting

// The row a retired key was merged into (a key still in use comes back unchanged).
function migratedId(table, key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key;
}
// A list of weapon keys with every retired key replaced and the repeats removed (two merged weapons in one list).
function migratedWeaponList(list) {
  return Array.from(new Set(list.map((key) => migratedId(WEAPON_MIGRATION, key))));
}
function savePlainObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
// Kills, headshots and shots of a retired weapon move into its successor, so a mastery tier already reached is never lost.
function migrateWeaponStats(weapons) {
  for (const key of Object.keys(weapons)) {
    const target = migratedId(WEAPON_MIGRATION, key);
    if (target === key) continue;
    const old = weapons[key];
    delete weapons[key];
    if (!savePlainObject(old)) continue;
    if (!savePlainObject(weapons[target])) weapons[target] = {};
    for (const field of WEAPON_STAT_SUM_FIELDS) weapons[target][field] = (Number(weapons[target][field]) || 0) + (Number(old[field]) || 0);
  }
}
// A crosshair override of a retired weapon moves to its successor when that has none of its own.
function migrateCrosshairs(crosshairs) {
  for (const key of Object.keys(crosshairs)) {
    const target = migratedId(WEAPON_MIGRATION, key);
    if (target === key) continue;
    if (!(target in crosshairs)) crosshairs[target] = crosshairs[key];
    delete crosshairs[key];
  }
}
// A match draft (a saved preset, its editor settings, the editor's current draft): the weapon list and the weapon lists of its mutators.
function migrateWeaponLists(draft) {
  if (!savePlainObject(draft)) return;
  if (Array.isArray(draft.weaponList)) draft.weaponList = migratedWeaponList(draft.weaponList);
  if (!Array.isArray(draft.mutators)) return;
  for (const entry of draft.mutators) if (savePlainObject(entry) && Array.isArray(entry.value)) entry.value = migratedWeaponList(entry.value);
}
// The editor's draft is JSON text inside the settings: its weapon list and mutator lists are mapped like a preset's.
function migrateCustomDraft(settings) {
  if (typeof settings[CUSTOM_DRAFT_SETTING] !== 'string') return;
  try {
    const draft = JSON.parse(settings[CUSTOM_DRAFT_SETTING]);
    if (!savePlainObject(draft)) return;
    migrateWeaponLists(draft);
    settings[CUSTOM_DRAFT_SETTING] = JSON.stringify(draft);
  } catch (error) {
    // Unreadable text stays as it is: the editor falls back to its defaults.
  }
}
function migrateLoadouts(loadouts) {
  for (const row of loadouts.classes.custom) {
    row.primary = migratedId(WEAPON_MIGRATION, row.primary);
    row.secondary = migratedId(WEAPON_MIGRATION, row.secondary);
  }
  for (const kit of Object.values(loadouts.kits)) {
    if (!savePlainObject(kit)) continue;
    for (const slot of Object.keys(kit)) kit[slot] = migratedId(ABILITY_MIGRATION, kit[slot]);
  }
}
// The pads of the map editor's saved maps: rows [key, x, y, z, modes?].
function migrateSavedMaps(maps) {
  for (const entry of maps) {
    if (!savePlainObject(entry.data) || !Array.isArray(entry.data.items)) continue;
    for (const row of entry.data.items) if (Array.isArray(row)) row[0] = migratedId(MAP_ITEM_MIGRATION, row[0]);
  }
}
// Maps every retired id in a loaded save to its successor (called by Save.migrate after the fields are repaired).
function migrateRetiredIds(data) {
  if (savePlainObject(data.stats) && savePlainObject(data.stats.weapons)) migrateWeaponStats(data.stats.weapons);
  migrateCrosshairs(data.crosshairs);
  migrateLoadouts(data.loadouts);
  for (const ruleset of data.rulesets) { migrateWeaponLists(ruleset); migrateWeaponLists(ruleset.editor); }
  migrateSavedMaps(data.editorMaps);
  migrateCustomDraft(data.settings);
}

const Save = {
  data: null,             // the live save object
  storageWorks: true,     // false from a failed access until a save is written again
  notice: '',             // one-line message for the UI (storage blocked, save was reset)
  lastFailure: '',        // the failure last told (fail), cleared by a good write
  timer: 0,
  // An unwritten change: a flush writes only then (R-163)
  dirty: false,
  keepStored: false,      // true while the stored save is from a newer game: saveNow writes nothing until an import replaces it (A-04)
  storage: null,          // replaced by a memory stub in headless tests

  emptySave() {
    // Every field is declared here, so migrate repairs it (ARC-020). revision: write count (R-001); play: last setup (18d, null = none);
    // crosshairs: per-weapon overrides (17b); loadouts: 13d (pickup: the weapons, gear and abilities of the pickup rulesets, P3-05); tips: 18n, 18p, 06 (silentSwitch).
    return { version: SAVE_VERSION, revision: 0, settings: {}, bindings: {}, touchLayouts: {}, progression: {}, stats: {}, rulesets: [], editorMaps: [],
      ladder: {}, play: null, crosshairs: {}, tips: { matches: 0, homeScreen: false, silentSwitch: false },
      loadouts: { classes: { selected: CAT.classes[0].id, custom: [] }, heroes: { hero: CAT.heroes[0].id }, kits: {}, pickup: Object.assign({}, DEFAULT_PICKUP_LOADOUT) } };
  },
  load() {
    const raw = this.read(SAVE_KEY);
    this.dirty = false;
    this.keepStored = false;
    if (raw === null) { this.data = this.emptySave(); return this.data; }
    try {
      const stored = JSON.parse(raw);
      this.data = this.migrate(stored);
      if (Number.isInteger(stored.version) && stored.version > SAVE_VERSION) this.keepNewerSave(raw);
    } catch (error) {
      this.backUpRecord(raw);
      this.data = this.emptySave();
      this.notice = 'Your save could not be read. It was backed up and reset.';
      ErrorLog.add('save.load', error);
    }
    return this.data;
  },
  // A save written by a newer game is played on from a migrated copy but never overwritten: it is backed up, the player is told,
  // and saveNow writes nothing (an import or a new game version replaces it) - downgrading it would lose what the newer game stored (A-04).
  keepNewerSave(raw) {
    this.backUpRecord(raw);
    this.keepStored = true;
    this.notice = SAVE_FROM_NEWER_GAME;
  },
  // Keeps a record the game cannot use as is. The backup slot takes it unless it already holds a readable save (an import's
  // backup): that one stays, and the record goes to the spare slot instead, so no readable copy is ever lost (A-05).
  // The same text already in either slot is not copied again (a kept newer save is met on every boot: up to 1 MB each time otherwise).
  backUpRecord(raw) {
    const kept = this.read(BACKUP_KEY);
    if (kept === raw || this.read(SPARE_KEY) === raw) return;
    this.write(kept !== null && saveParses(kept) ? SPARE_KEY : BACKUP_KEY, raw);
  },
  // Brings a save up to SAVE_VERSION: fills missing or wrong-kind fields ("settings": null, nested ones too), checks every setting (load and import).
  migrate(loaded) {
    if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) throw new Error('save is not an object');
    repairSaveFields(this.emptySave(), loaded);
    migrateRetiredIds(loaded);
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
    if (this.keepStored) return false;
    if (this.adoptNewer()) return this.keepStored ? false : this.fail(SAVE_NEWER_ELSEWHERE);
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
    let stored;
    try {
      stored = JSON.parse(raw);
      this.data = this.migrate(stored);
    } catch (error) {
      // Unreadable: this tab's save stays.
      return false;
    }
    this.dirty = false;
    if (Number.isInteger(stored.version) && stored.version > SAVE_VERSION) this.keepNewerSave(raw);   // another tab saved with a newer game: never write it back downgraded (A-04)
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
    const previous = this.data, wasKept = this.keepStored;
    this.write(BACKUP_KEY, wasKept ? this.read(SAVE_KEY) : this.exportText());   // a kept newer save is backed up as it was stored
    this.data = parsed;
    this.keepStored = false;   // the player replaced the newer game's save on purpose
    const written = this.saveNow();
    // Unless saveNow took another tab's save.
    if (!written && this.data === parsed) { this.data = previous; this.keepStored = wasKept; }
    Settings.applyAll();
    return written;
  },
  // The save an import replaced, or an unreadable one (null = none)
  backupText() { return this.read(BACKUP_KEY); },
  // The unreadable or newer-version record kept next to a readable backup (null = none)
  spareText() { return this.read(SPARE_KEY); },
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
    // A whole-number setting (integer step: FOV, a tier shift) keeps no fraction from an import.
    if (Number.isInteger(definition.step)) value = Math.round(value);
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
