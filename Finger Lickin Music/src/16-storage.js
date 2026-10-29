// 16-storage.js - M-16 FLM.Storage (Phase 01 subset): storage probe, key-value helpers with safe write,
// settings persistence, export download, file picker and file reading.
// Separation rule: this file owns exactly one namespace (Storage) and registers it once through
// FLM.Core.define. It uses only M-01 (Core). It declares no module-level global state object (S-07): all state
// lives inside the factory closure. Phase 09 adds projects, autosave, checkpoints, recordings, quota, the tab lock
// and drag and drop (Part 6.16); the settings document is normalized and debounced by M-27, not here.
// Spec: docs/IMPLEMENTATION-PLAN.md Part 6.16 (API 6.16.2, algorithms 6.16.4), Part 5.15 (key catalog).
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Storage', function (FLM) {
  const Core = FLM.Core;
  const bus = Core.bus;

  const OWNER = 'storage';                   // owner token of every timer and listener this module creates
  const DB_NAME = 'flm-db';
  const DB_VERSION = 1;
  const KEY_PREFIX = 'flm.v1.';
  const TMP_SUFFIX = '.tmp';
  const BAK_SUFFIX = '.bak';
  const PROBE_TIMEOUT_MS = 2000;             // Part 4.3 B5: IndexedDB open probe
  const SETTINGS_DEBOUNCE_MS = 250;
  const READ_TIMEOUT_MS = 30000;             // Part 6.16.4 F: file read
  const PICK_FOCUS_DELAY_MS = 1500;          // iOS fallback: no change event after the window regains focus
  const KIB = 1024;
  const MIB = 1024 * KIB;
  const DEFAULT_KEY_CAP_BYTES = 2 * MIB;
  const DEFAULT_MAX_READ_BYTES = 25 * MIB;
  const EXPORT_CAP_BYTES = 256 * MIB;
  const DATA_URL_CAP_BYTES = 32 * MIB;
  const FILE_NAME_LIMIT = 80;
  const EXTENSION_LIMIT = 10;
  const SETTING_SOURCES = Object.freeze(['load', 'ui', 'reset', 'url', 'wizard']);

  // Relative key names (the flm.v1. prefix is added by every helper).
  const KEYS = Object.freeze({
    settings: 'settings',
    projectsIndex: 'projects.index',
    characters: 'characters',
    progressHistory: 'progress.history',
    progressBests: 'progress.bests',
    progressUnlocks: 'progress.unlocks',
    progressDaily: 'progress.daily',
    recovery: 'recovery',
    lastSession: 'lastSession',
    probe: 'probe'
  });
  // Size caps in bytes (UTF-16 code units x 2); keys not listed use DEFAULT_KEY_CAP_BYTES (Part 5.15).
  const KEY_CAP_BYTES = Object.freeze({
    [KEYS.settings]: 64 * KIB,
    [KEYS.projectsIndex]: 64 * KIB,
    [KEYS.characters]: 64 * KIB,
    [KEYS.progressHistory]: 512 * KIB,
    [KEYS.progressBests]: 128 * KIB,
    [KEYS.progressUnlocks]: 16 * KIB,
    [KEYS.progressDaily]: 4 * KIB,
    [KEYS.lastSession]: 1 * KIB
  });
  // Object stores and their single index (Part 6.16.3); every store has the key path "id".
  const STORE_DEFINITIONS = Object.freeze([
    { name: 'projects', index: 'byModified', indexPath: 'modifiedAt' },
    { name: 'recordings', index: 'byProject', indexPath: 'projectId' },
    { name: 'charts', index: 'byProject', indexPath: 'projectId' },
    { name: 'characters', index: null, indexPath: null }
  ]);
  const STORES = Object.freeze(STORE_DEFINITIONS.map((definition) => definition.name));
  const NOTICE_LOCAL_ONLY = 'Browser database unavailable: projects are saved in limited local storage ' +
    '(2 MB each, no recordings). Export projects to keep them safe.';
  const NOTICE_FILE_SUFFIX = ' Opening the file over http(s) usually restores the database.';
  const NOTICE_LOCAL_BLOCKED = 'Settings cannot be saved by this browser context; they are stored with your ' +
    'projects instead and may reset when site data is cleared.';
  const NOTICE_MEMORY = 'Saving is unavailable in this browser context. Your work is kept in memory only until ' +
    'you export it.';

  const state = {
    opened: false,
    mode: 'memory',
    isFile: false,
    ls: null,                                // probed localStorage or an injected fake
    idbFactory: null,
    db: null,
    local: { ok: false, error: null },
    idb: { ok: false, error: null, openMs: 0 },
    notice: null,
    memory: new Map(),                       // key (without prefix) -> JSON text; used when localStorage is unusable
    settingsWrite: null,                     // {text, timer, waiters} while a settings write is pending
    settingsLoad: { source: 'none', damaged: false },
    fileInput: null,
    pendingUrls: [],                         // object URLs to revoke at the next download or at pagehide
    offs: []                                 // off() functions of the permanent listeners
  };

  // ---------------------------------------------------------------- errors

  function errorName(error) {
    return error && typeof error.name === 'string' && error.name !== '' ? error.name : 'Error';
  }

  /** @returns {{code:string, message:string, cause:(string|null)}} StoError shape of Part 6.16.2 */
  function failure(code, cause) {
    return { code, message: Core.Text.get(code), cause: cause || null };
  }

  function isQuotaError(error) {
    const name = errorName(error);
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }

  function writeFailure(error) {
    return isQuotaError(error) ? failure('E-STO-001', errorName(error)) : failure('E-STO-002', errorName(error));
  }

  const RESULT_OK = Object.freeze({ ok: true, error: null });

  function failed(error) {
    return { ok: false, error };
  }

  // ---------------------------------------------------------------- opening and probing

  function defaultLocalStorage() {
    try {
      return window.localStorage || null;
    } catch (error) {
      return null;                           // SecurityError in some file:// and privacy configurations
    }
  }

  function defaultIndexedDb() {
    try {
      return window.indexedDB || null;
    } catch (error) {
      return null;
    }
  }

  function probeLocal(ls) {
    if (!ls) return { ok: false, error: 'unavailable' };
    const key = KEY_PREFIX + KEYS.probe;
    try {
      ls.setItem(key, '1');
      const readBack = ls.getItem(key) === '1';
      ls.removeItem(key);
      return { ok: readBack, error: readBack ? null : 'readback' };
    } catch (error) {
      return { ok: false, error: errorName(error) };
    }
  }

  // An interrupted write never becomes live: leftover temp keys are removed at open (Part 6.16.4 A).
  function removeLeftoverTemps(ls) {
    try {
      for (let index = ls.length - 1; index >= 0; index -= 1) {
        const key = ls.key(index);
        if (key && key.startsWith(KEY_PREFIX) && key.endsWith(TMP_SUFFIX)) ls.removeItem(key);
      }
    } catch (error) {
      Core.Log.warn('storage', 'temp cleanup failed: ' + errorName(error));
    }
  }

  function createSchema(db) {
    STORE_DEFINITIONS.forEach((definition) => {
      if (db.objectStoreNames.contains(definition.name)) return;
      const store = db.createObjectStore(definition.name, { keyPath: 'id' });
      if (definition.index) store.createIndex(definition.index, definition.indexPath, { unique: false });
    });
  }

  function watchDatabase(db) {
    const forget = () => { if (state.db === db) state.db = null; };
    db.onversionchange = () => { db.close(); forget(); };
    db.onclose = forget;
  }

  /** Opens flm-db v1 and resolves {ok, error, db}; never rejects. A hung open resolves with error 'timeout'. */
  function openDatabase(factory, timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;
      const timer = Core.timers.setTimeout(() => finish({ ok: false, error: 'timeout', db: null }), timeoutMs, OWNER);
      function finish(result) {
        if (settled) {
          if (result.db) result.db.close();  // success after the timeout: do not keep a handle nobody owns
          return;
        }
        settled = true;
        Core.timers.clearTimeout(timer);
        resolve(result);
      }
      let request = null;
      try {
        request = factory.open(DB_NAME, DB_VERSION);
      } catch (error) {
        finish({ ok: false, error: errorName(error), db: null });
        return;
      }
      request.onupgradeneeded = () => createSchema(request.result);
      request.onsuccess = () => finish({ ok: true, error: null, db: request.result });
      request.onerror = () => finish({ ok: false, error: errorName(request.error), db: null });
      request.onblocked = () => Core.Log.warn('storage', 'idb blocked');
    });
  }

  // Part 6.16.4 C and D: the mode and its notice from the two probes.
  function decideMode() {
    if (state.local.ok && state.idb.ok) return { mode: 'full', notice: null };
    if (state.local.ok) {
      return { mode: 'localOnly', notice: NOTICE_LOCAL_ONLY + (state.isFile ? NOTICE_FILE_SUFFIX : '') };
    }
    if (state.idb.ok) return { mode: 'full', notice: NOTICE_LOCAL_BLOCKED };
    return { mode: 'memory', notice: NOTICE_MEMORY };
  }

  function usesMemory() {
    return state.ls === null || !state.local.ok;
  }

  function status() {
    return {
      opened: state.opened,
      mode: state.mode,
      isFile: state.isFile,
      readOnly: false,
      lockedBy: null,
      local: { ok: state.local.ok, error: state.local.error },
      idb: { ok: state.idb.ok, error: state.idb.error, openMs: state.idb.openMs },
      notice: state.notice
    };
  }

  function closeDatabase() {
    const db = state.db;
    state.db = null;
    if (!db) return;
    try {
      db.close();
    } catch (error) {
      Core.Log.warn('storage', 'db close failed: ' + errorName(error));
    }
  }

  function releaseListeners() {
    state.offs.forEach((off) => off());
    state.offs = [];
    Core.dom.offOwner(OWNER);
  }

  function installListeners() {
    const onHidden = () => { writeSettingsNow(); revokePendingUrls(); };
    const onVisibility = () => { if (window.document.visibilityState === 'hidden') writeSettingsNow(); };
    state.offs.push(Core.dom.on(window, 'pagehide', onHidden, undefined, OWNER));
    state.offs.push(Core.dom.on(window.document, 'visibilitychange', onVisibility, undefined, OWNER));
  }

  async function probeIndexedDb(factory) {
    const started = Core.now();
    const result = factory ? await openDatabase(factory, PROBE_TIMEOUT_MS)
      : { ok: false, error: 'unavailable', db: null };
    state.db = result.db;
    if (result.db) watchDatabase(result.db);
    state.idb = { ok: result.ok, error: result.error, openMs: Math.round(Core.now() - started) };
  }

  function publishState(reason) {
    bus.emit('storage.state', {
      mode: state.mode, notice: state.notice, localStorage: state.local.ok, indexedDB: state.idb.ok,
      readOnly: false, lockedBy: null, reason
    });
  }

  /**
   * Probes localStorage and IndexedDB, creates the schema, publishes the storage mode. Never rejects.
   * @param {{idbFactory?:object|null, localStorage?:object|null}=} options test injection (null = none)
   * @returns {Promise<object>} StorageStatus
   * Emits: storage.state
   */
  async function open(options) {
    const config = options || {};
    writeSettingsNow();                      // a pending write belongs to the previous backend
    releaseListeners();
    closeDatabase();
    try {
      state.ls = 'localStorage' in config ? config.localStorage : defaultLocalStorage();
      state.idbFactory = 'idbFactory' in config ? config.idbFactory : defaultIndexedDb();
      state.isFile = window.location.protocol === 'file:';
      state.local = probeLocal(state.ls);
      if (state.local.ok) removeLeftoverTemps(state.ls);
      await probeIndexedDb(state.idbFactory);     // the 2 s timer is armed before the first await
    } catch (error) {
      Core.Log.error('storage', 'open failed: ' + errorName(error));
    }
    const decision = decideMode();
    state.mode = decision.mode;
    state.notice = decision.notice;
    state.opened = true;
    installListeners();
    publishState('open');
    return status();
  }

  // ---------------------------------------------------------------- text storage with safe write

  function capFor(key) {
    return Object.prototype.hasOwnProperty.call(KEY_CAP_BYTES, key) ? KEY_CAP_BYTES[key] : DEFAULT_KEY_CAP_BYTES;
  }

  function keepsBackup(key) {
    return key === KEYS.settings || key.startsWith('progress.');
  }

  function readText(key) {
    if (usesMemory()) return state.memory.has(key) ? state.memory.get(key) : null;
    try {
      return state.ls.getItem(KEY_PREFIX + key);
    } catch (error) {
      Core.Log.warn('storage', 'read failed: ' + errorName(error));
      return null;
    }
  }

  function removeText(key) {
    if (usesMemory()) {
      state.memory.delete(key);
      return;
    }
    try {
      state.ls.removeItem(KEY_PREFIX + key + TMP_SUFFIX);
      state.ls.removeItem(KEY_PREFIX + key);
    } catch (error) {
      Core.Log.warn('storage', 'remove failed: ' + errorName(error));
    }
  }

  function tryWrite(key, text) {
    try {
      state.ls.setItem(key, text);
      return null;
    } catch (error) {
      return writeFailure(error);
    }
  }

  function dropQuietly(key) {
    try {
      state.ls.removeItem(key);
    } catch (error) {
      Core.Log.warn('storage', 'cleanup failed: ' + errorName(error));
    }
  }

  // Step 5 of Part 6.16.4 A: the live key must read back equal, else the previous value is restored.
  function commitLive(fullKey, text, previous) {
    const writeError = tryWrite(fullKey, text);
    if (writeError) return writeError;
    if (state.ls.getItem(fullKey) === text) return null;
    if (previous !== null) tryWrite(fullKey, previous);
    else dropQuietly(fullKey);
    return failure('E-STO-004', null);
  }

  /** localStorage safe write (Part 6.16.4 A): temp, verify, optional .bak, swap, verify. @returns StoError|null */
  function safeSetLocal(key, text, withBackup) {
    if (text.length * 2 > capFor(key)) return failure('E-STO-001', 'cap');
    const fullKey = KEY_PREFIX + key;
    const tempKey = fullKey + TMP_SUFFIX;
    const tempError = tryWrite(tempKey, text);
    if (tempError) return tempError;
    if (state.ls.getItem(tempKey) !== text) {
      dropQuietly(tempKey);
      return failure('E-STO-004', null);
    }
    const previous = state.ls.getItem(fullKey);
    const backupError = withBackup && previous !== null ? tryWrite(fullKey + BAK_SUFFIX, previous) : null;
    const error = backupError || commitLive(fullKey, text, previous);
    dropQuietly(tempKey);
    return error;
  }

  function writeText(key, text) {
    if (usesMemory()) {
      state.memory.set(key, text);
      return RESULT_OK;
    }
    const error = safeSetLocal(key, text, keepsBackup(key));
    return error ? failed(error) : RESULT_OK;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  // A damaged record is removed and logged once; the caller sees "not found" (Part 6.16.5, UT-16-22).
  function readJson(key) {
    const text = readText(key);
    if (text === null) return { found: false, value: undefined, damaged: false };
    try {
      return { found: true, value: JSON.parse(text), damaged: false };
    } catch (error) {
      removeText(key);
      Core.Log.warn('storage', 'damaged value removed: ' + key);
      return { found: false, value: undefined, damaged: true };
    }
  }

  /** @returns {*} the stored JSON value, or fallback when missing or damaged (the damaged record is removed) */
  function get(key, fallback) {
    const record = readJson(key);
    return record.found ? record.value : fallback;
  }

  /** @returns {{ok:boolean, error:(object|null)}} */
  function set(key, value) {
    let text = null;
    try {
      text = JSON.stringify(value);
    } catch (error) {
      text = null;
    }
    if (typeof text !== 'string') return failed(failure('E-STO-002', 'unserializable'));
    return writeText(key, text);
  }

  function remove(key) {
    removeText(key);
  }

  /** @returns {string[]} sorted key names under flm.v1. without the prefix */
  function keys() {
    const names = [];
    if (usesMemory()) return Array.from(state.memory.keys()).sort();
    try {
      for (let index = 0; index < state.ls.length; index += 1) {
        const key = state.ls.key(index);
        if (key && key.startsWith(KEY_PREFIX)) names.push(key.slice(KEY_PREFIX.length));
      }
    } catch (error) {
      Core.Log.warn('storage', 'key listing failed: ' + errorName(error));
    }
    return names.sort();
  }

  /** @returns {number} bytes used by flm.v1.* keys (UTF-16 code units x 2) */
  function usedBytes() {
    return keys().reduce((total, name) => {
      const text = readText(name);
      return total + (KEY_PREFIX.length + name.length + (text === null ? 0 : text.length)) * 2;
    }, 0);
  }

  /** @param {string=} kind 'local', 'idb' or omitted for either backend */
  function isAvailable(kind) {
    if (kind === 'local') return state.local.ok;
    if (kind === 'idb') return state.idb.ok;
    return state.local.ok || state.idb.ok;
  }

  // ---------------------------------------------------------------- settings document

  function leafPaths(node, prefix, out) {
    Object.keys(node).forEach((name) => {
      const path = prefix === '' ? name : prefix + '.' + name;
      if (isPlainObject(node[name]) && Object.keys(node[name]).length > 0) leafPaths(node[name], path, out);
      else out.push(path);
    });
    return out;
  }

  function readDocument(key) {
    const record = readJson(key);
    if (record.found && !isPlainObject(record.value)) {
      removeText(key);
      Core.Log.warn('storage', 'damaged value removed: ' + key);
      return { doc: null, damaged: true };
    }
    return { doc: record.found ? record.value : null, damaged: record.damaged };
  }

  // The live record first; on a missing or damaged one the .bak is tried (Part 4.3 B6).
  function readSettingsDocument() {
    const main = readDocument(KEYS.settings);
    if (main.doc) return { doc: main.doc, source: 'stored', damaged: false };
    const backup = readDocument(KEYS.settings + BAK_SUFFIX);
    if (backup.doc) return { doc: backup.doc, source: 'backup', damaged: main.damaged };
    return { doc: null, source: 'none', damaged: main.damaged || backup.damaged };
  }

  /**
   * Reads flm.v1.settings (the .bak when the live record is damaged). The document is returned as stored:
   * M-27 normalizes it. A missing or unreadable record returns null.
   * Emits: settings.changed {key:'*', source:'load'}
   * @returns {(object|null)}
   */
  function loadSettings() {
    const found = readSettingsDocument();
    state.settingsLoad = { source: found.source, damaged: found.damaged };
    const keysOfDocument = found.doc ? leafPaths(found.doc, '', []) : [];
    bus.emit('settings.changed', { key: '*', value: null, prev: null, source: 'load', keys: keysOfDocument });
    return found.doc;
  }

  function announceChange(change) {
    if (!change) return;
    Core.assert(SETTING_SOURCES.includes(change.source), 'unknown settings source ' + change.source);
    const payload = { key: change.key, value: change.value, prev: change.prev, source: change.source };
    if (Array.isArray(change.keys)) payload.keys = change.keys;
    bus.emit('settings.changed', payload);
  }

  /** Writes the pending settings document now. @returns {(object|null)} the write result, null when none pending */
  function writeSettingsNow() {
    const pending = state.settingsWrite;
    if (!pending) return null;
    state.settingsWrite = null;
    if (pending.timer !== null) Core.timers.clearTimeout(pending.timer);
    const result = writeText(KEYS.settings, pending.text);
    if (!result.ok) Core.Log.warn('storage', 'settings write failed', { code: result.error.code });
    pending.waiters.forEach((resolve) => resolve(result));
    return result;
  }

  /**
   * Emits `change` at once, then safe-writes the document (debounced; 0 writes immediately). One write covers
   * every call made while it waits.
   * Emits: settings.changed
   * @returns {Promise<{ok:boolean, error:(object|null)}>} resolves after the write
   */
  function saveSettings(doc, change, opts) {
    announceChange(change);
    const delay = opts && Number.isFinite(opts.debounceMs) ? Math.max(0, opts.debounceMs) : SETTINGS_DEBOUNCE_MS;
    return new Promise((resolve) => {
      const pending = state.settingsWrite || { text: '', timer: null, waiters: [] };
      state.settingsWrite = pending;
      pending.text = JSON.stringify(doc);
      pending.waiters.push(resolve);
      if (delay === 0) writeSettingsNow();
      else if (pending.timer === null) pending.timer = Core.timers.setTimeout(writeSettingsNow, delay, OWNER);
    });
  }

  /** Writes a pending debounced settings document now (pagehide, tests). */
  function flushSettings() {
    return Promise.resolve(writeSettingsNow() || RESULT_OK);
  }

  // ---------------------------------------------------------------- export, download, files

  /** @returns {{ok:boolean, blob:(Blob|null), error:(object|null)}} E-EXP-006 above 256 MB */
  function exportBlob(data, mimeType) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || 'application/octet-stream' });
    if (blob.size > EXPORT_CAP_BYTES) return { ok: false, blob: null, error: failure('E-EXP-006', null) };
    return { ok: true, blob, error: null };
  }

  /** Letters, digits, dot, underscore, space and hyphen only; runs collapsed; 80 characters with the extension. */
  function sanitizeFileName(fileName) {
    const cleaned = String(fileName).replace(/[^A-Za-z0-9._ -]/g, '_').replace(/_{2,}/g, '_');
    const dot = cleaned.lastIndexOf('.');
    const extension = dot > 0 ? cleaned.slice(dot, dot + EXTENSION_LIMIT) : '';
    const base = dot > 0 ? cleaned.slice(0, dot) : cleaned;
    const name = base.slice(0, FILE_NAME_LIMIT - extension.length) + extension;
    return name === '' ? 'download' : name;
  }

  function isIosSafari() {
    const nav = window.navigator;
    const agent = String(nav.userAgent || '');
    const iPadOs = nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
    return /iPad|iPhone|iPod/.test(agent) || iPadOs;
  }

  function revokePendingUrls() {
    state.pendingUrls.forEach((url) => window.URL.revokeObjectURL(url));
    state.pendingUrls = [];
  }

  function downloadByAnchor(blob, name) {
    revokePendingUrls();                     // no timer: the previous URL is released at the next download
    const url = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.rel = 'noopener';
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    state.pendingUrls.push(url);
    return { ok: true, method: 'anchor', error: null };
  }

  function readAsDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new window.FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  // Fallback for browsers that ignore the download attribute: a new tab with the data URL.
  async function downloadByDataUrl(blob) {
    if (blob.size > DATA_URL_CAP_BYTES) return { ok: false, method: 'none', error: failure('E-EXP-009', null) };
    const url = await readAsDataUrl(blob);
    const opened = url === null ? null : window.open(url, '_blank');
    if (!opened) return { ok: false, method: 'none', error: failure('E-EXP-005', null) };
    return { ok: true, method: 'dataUrl', error: null };
  }

  /**
   * Triggers a file download. Resolves when the click was dispatched; success is unknowable.
   * @param {string} fileName
   * @param {Blob|string|ArrayBuffer} data
   * @param {string=} mimeType
   * @returns {Promise<{ok:boolean, method:string, error:(object|null)}>} method 'anchor', 'dataUrl' or 'none'
   */
  async function download(fileName, data, mimeType) {
    const made = exportBlob(data, mimeType);
    if (!made.ok) return { ok: false, method: 'none', error: made.error };
    const name = sanitizeFileName(fileName);
    const anchorWorks = 'download' in window.HTMLAnchorElement.prototype && !isIosSafari();
    return anchorWorks ? downloadByAnchor(made.blob, name) : downloadByDataUrl(made.blob);
  }

  function ensureFileInput() {
    if (state.fileInput && state.fileInput.isConnected) return state.fileInput;
    const input = window.document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    window.document.body.appendChild(input);
    state.fileInput = input;
    return input;
  }

  /**
   * Opens the file picker. Call it synchronously inside a click or key handler (gesture rule).
   * @param {{accept?:string[], multiple?:boolean}=} options
   * @returns {Promise<File[]>} [] when cancelled
   */
  function pickFile(options) {
    const config = options || {};
    return new Promise((resolve) => {
      const input = ensureFileInput();
      input.accept = Array.isArray(config.accept) ? config.accept.join(',') : '';
      input.multiple = config.multiple === true;
      const offs = [];
      let focusTimer = null;
      const finish = (files) => {
        offs.forEach((off) => off());
        if (focusTimer !== null) Core.timers.clearTimeout(focusTimer);
        input.value = '';                    // the same file can be chosen twice
        resolve(files);
      };
      const onChange = () => finish(Array.from(input.files || []));
      const onFocus = () => { focusTimer = Core.timers.setTimeout(() => finish([]), PICK_FOCUS_DELAY_MS, OWNER); };
      offs.push(Core.dom.on(input, 'change', onChange, undefined, OWNER));
      offs.push(Core.dom.on(input, 'cancel', () => finish([]), undefined, OWNER));
      offs.push(Core.dom.on(window, 'focus', onFocus, { once: true }, OWNER));
      input.click();
    });
  }

  function withTimeout(promise, limitMs) {
    return new Promise((resolve, reject) => {
      const timer = Core.timers.setTimeout(() => reject(new Error('timeout')), limitMs, OWNER);
      promise.then(
        (value) => { Core.timers.clearTimeout(timer); resolve(value); },
        (error) => { Core.timers.clearTimeout(timer); reject(error); }
      );
    });
  }

  /**
   * Size-checked file read: a file over maxBytes is refused before any read (E-IMP-001).
   * @param {File} file
   * @param {{as?:'arrayBuffer'|'text', maxBytes?:number}=} options
   * @returns {Promise<{ok:boolean, data:*, error:(object|null)}>}
   */
  async function readFile(file, options) {
    const config = options || {};
    const limit = Number.isFinite(config.maxBytes) ? config.maxBytes : DEFAULT_MAX_READ_BYTES;
    if (!file || file.size > limit) return { ok: false, data: null, error: failure('E-IMP-001', null) };
    try {
      const reading = config.as === 'text' ? file.text() : file.arrayBuffer();
      return { ok: true, data: await withTimeout(reading, READ_TIMEOUT_MS), error: null };
    } catch (error) {
      return { ok: false, data: null, error: failure('E-IMP-019', errorName(error)) };
    }
  }

  // ---------------------------------------------------------------- housekeeping

  /** Forgets the cached database handle (fault recovery); the next operation reopens it. */
  function reset() {
    closeDatabase();
  }

  /** For leak tests: open transactions, pending timers and listeners added by this module. */
  function counters() {
    return { tx: 0, timers: Core.timers.count(OWNER), listeners: state.offs.length };
  }

  // Tests only: drops pending writes, listeners and timers and returns to the unopened state.
  function teardownForTests() {
    const pending = state.settingsWrite;
    state.settingsWrite = null;
    if (pending) pending.waiters.forEach((resolve) => resolve(failed(failure('E-STO-002', 'teardown'))));
    releaseListeners();
    Core.timers.clearOwner(OWNER);
    closeDatabase();
    revokePendingUrls();
    if (state.fileInput) state.fileInput.remove();
    state.fileInput = null;
    state.memory.clear();
    Object.assign(state, {
      opened: false, mode: 'memory', isFile: false, ls: null, idbFactory: null, notice: null,
      local: { ok: false, error: null }, idb: { ok: false, error: null, openMs: 0 },
      settingsLoad: { source: 'none', damaged: false }
    });
  }

  return Object.freeze({
    DB_NAME,
    DB_VERSION,
    STORES,
    KEY_PREFIX,
    KEYS,
    open,
    state: status,
    isAvailable,
    get,
    set,
    remove,
    keys,
    usedBytes,
    loadSettings,
    /** @returns {{source:string, damaged:boolean}} how the last loadSettings found the record (M-27 uses it) */
    lastSettingsLoad: () => Object.assign({}, state.settingsLoad),
    saveSettings,
    flushSettings,
    exportBlob,
    download,
    pickFile,
    readFile,
    reset,
    counters,
    _teardownForTests: teardownForTests
  });
});
})();
