// 15-project.js - M-15 FLM.Project, the Catalog subset (T04.10): the one list of songs that can be played without a
// project file: the five built-in demos, the tutorial song and (later) imported songs registered for "Play now".
// The rest of M-15 (the project object, commands, history, serialization) arrives in Phase 09 and extends this namespace.
// Separation rule: this file owns exactly one namespace and registers it once through FLM.Core.define. It uses only
// lower-numbered modules. State lives inside the factory closure (S-07). An entry is plain data plus an `expand()`
// closure; the Catalog calls it once per song and keeps the result (the expanded Song is never persisted).
// Spec: docs/IMPLEMENTATION-PLAN.md Part 6.15 (Catalog), Part 6.30.4.9 (the entry shape), Part 4.3 A4 and B12.
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Project', function (FLM) {
  const Core = FLM.Core;
  const KINDS = Object.freeze(['builtin', 'tutorial', 'imported']);

  const entries = new Map();               // id -> entry, in registration order
  const songs = new Map();                 // id -> expanded Song (the cache)

  function codedError(code, text) {
    const error = new Error(code + ': ' + text);
    error.code = code;
    return error;
  }

  function checkEntry(entry, kind) {
    if (!entry || typeof entry !== 'object') throw codedError('E-GEN-004', 'a catalog entry must be an object');
    if (typeof entry.id !== 'string' || entry.id === '') throw codedError('E-GEN-004', 'a catalog entry needs an id');
    if (typeof entry.expand !== 'function') throw codedError('E-GEN-004', 'a catalog entry needs expand()');
    if (kind !== undefined && entry.kind !== kind) throw codedError('E-GEN-004', 'entry ' + entry.id + ' is not ' + kind);
    if (!KINDS.includes(entry.kind)) throw codedError('E-GEN-004', 'entry ' + entry.id + ' has an unknown kind');
    return entry;
  }

  function add(entry) {
    songs.delete(entry.id);
    entries.set(entry.id, entry);
    return entry;
  }

  /** Registers (or replaces) one entry of any kind. */
  function register(entry) {
    return add(checkEntry(entry));
  }

  /** The built-in demos, in the order given; a failing entry does not stop the others. */
  function registerBuiltin(list) {
    const given = Array.isArray(list) ? list : [list];
    return given.map((entry) => add(checkEntry(entry, 'builtin')));
  }

  function registerTutorial(entry) {
    return add(checkEntry(entry, 'tutorial'));
  }

  function unregister(id) {
    songs.delete(id);
    return entries.delete(id);
  }

  /** Entries in registration order; kind limits the list ('builtin', 'tutorial' or 'imported'). */
  function list(kind) {
    const all = Array.from(entries.values());
    return kind === undefined ? all : all.filter((entry) => entry.kind === kind);
  }

  const get = (id) => (entries.has(id) ? entries.get(id) : null);

  /** The expanded Song of an entry (expanded on first use, then cached); null for an unknown id. */
  function getSong(id) {
    const entry = get(id);
    if (!entry) return null;
    if (!songs.has(id)) songs.set(id, entry.expand());
    return songs.get(id);
  }

  const tutorial = () => list('tutorial')[0] || null;

  /** Test hook: forgets everything (a test that registers its own entries restores the old ones itself). */
  function clearForTests() {
    entries.clear();
    songs.clear();
  }

  const cacheSize = () => songs.size;

  void Core;
  return Object.freeze({
    Catalog: Object.freeze({ registerBuiltin, registerTutorial, register, unregister, list, get, getSong, tutorial,
      cacheSize, _clearForTests: clearForTests })
  });
});
})();
