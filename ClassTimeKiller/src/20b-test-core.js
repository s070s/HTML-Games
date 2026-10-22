// Self-tests for S01-S04 and the loop: math, RNG, events, actors, data, save, settings, world rays.

// Every defined setting key that starts with the prefix, for Settings.resetKeys in the test files ('video.' after a render test).
function settingKeysStarting(prefix) { return Array.from(Settings.definitions.keys()).filter((key) => key.startsWith(prefix)); }

Test.add('core', (check) => {
  const v = Vec.fromAngles(Vec.make(), 0, 0);
  check('yaw 0 looks +Z', Test.near(v.z, 1, 1e-6) && Test.near(v.x, 0, 1e-6));
  Vec.fromAngles(v, 0, 90 * DEG);
  check('pitch +90 looks up', Test.near(v.y, 1, 1e-6));
  check('wrapAngle', Test.near(wrapAngle(3 * Math.PI), Math.PI, 1e-6) || Test.near(wrapAngle(3 * Math.PI), -Math.PI, 1e-6));
  const view = Mat4.firstPerson(Mat4.create(), 0, 0, 0, 0, 0);
  // A point 5 m ahead (+Z) must land on the view-space -Z axis.
  const ahead = { x: view[8] * 5 + view[12], y: view[9] * 5 + view[13], z: view[10] * 5 + view[14] };
  check('view matrix: +Z is in front', Test.near(ahead.z, -5, 1e-5) && Test.near(ahead.x, 0, 1e-5), JSON.stringify(ahead));
  const right = { x: view[0] * -1, z: view[2] * -1 }; // world -X is the camera's right at yaw 0
  check('view matrix: world -X is camera right at yaw 0', Test.near(right.x, 1, 1e-5), JSON.stringify(right));
});

Test.add('core', (check) => {
  const a = makeRandom(42), b = makeRandom(42), c = makeRandom(43);
  let same = true, differs = false;
  for (let i = 0; i < 1000; i++) { const x = a.next(), y = b.next(); if (x !== y) same = false; if (x !== c.next()) differs = true; if (x < 0 || x >= 1) same = false; }
  check('rng: same seed, same sequence in 0..1', same);
  check('rng: different seed differs', differs);
  Rng.reseed(7); const first = Rng.bots.next(); Rng.map.next(); Rng.reseed(7); Rng.map.next(); Rng.map.next();
  check('rng: streams are independent', Rng.bots.next() === first);
});

Test.add('core', (check) => {
  let received = null;
  const handler = Bus.on('test.ping', (value) => { received = value; });
  Bus.emit('test.ping', 5);
  Bus.off('test.ping', handler);
  Bus.emit('test.ping', 9);
  check('bus: on/emit/off', received === 5);
  const thrower = Bus.on('test.throw', () => { throw new Error('listener failure'); });
  check('bus: a throwing listener is logged, not thrown', Test.expectErrors(() => Bus.emit('test.throw', null)) === 1);
  Bus.off('test.throw', thrower);
});

Test.add('core', (check) => {
  const first = Actors.create(ACTOR_KIND.BOT, 1, 'one');
  const second = Actors.create(ACTOR_KIND.BOT, 2, 'two');
  check('actors: create gives distinct ids', first === 0 && second === 1 && Actors.count === 2);
  Actors.remove(second);
  check('actors: remove shrinks count', Actors.count === 1);
  check('actors: enemy test by team', Actors.isEnemy(first, Actors.create(ACTOR_KIND.BOT, 2, 'x')) && !Actors.isEnemy(first, first));
  Actors.buttons[first] = BTN.FIRE;
  Sim.step();
  check('sim: pressed edge on first step', (Actors.pressed[first] & BTN.FIRE) !== 0);
  Sim.step();
  check('sim: no edge while held', (Actors.pressed[first] & BTN.FIRE) === 0);
  Actors.clear();
  check('actors: clear', Actors.count === 0);
});

Test.add('core', (check) => {
  for (const name in Data.schemas) {
    const problems = Data.validate(name);
    check('data: ' + name + ' rows follow the schema', problems.length === 0, problems.slice(0, 5).join('; '));
  }
  check('data: quality presets', CAT.quality.length === 5 && CAT.quality.byId('potato').bots === 7);
});

Test.add('core', (check) => {
  Save.data = Save.emptySave();
  Save.data.settings.example = 3;
  check('save: round trip', Save.saveNow() && JSON.parse(Save.read(SAVE_KEY)).settings.example === 3);
  Save.write(SAVE_KEY, '{"version":1,"settings":');
  Test.expectErrors(() => Save.load());
  check('save: corrupt save resets with notice', Save.data.version === SAVE_VERSION && Save.notice.length > 0 && Save.read(BACKUP_KEY) !== null);
  Save.storage = makeMemoryStorage(true);
  Save.storageWorks = true;
  let crashed = false;
  try { Save.load(); Save.saveNow(); } catch (error) { crashed = true; }
  check('save: blocked storage does not crash', !crashed && !Save.storageWorks);
  Save.storage = makeMemoryStorage(false); Save.storageWorks = true; Save.notice = '';   // no throwing store for the next block
});

// R-001 / R-163: a second tab (or a page back from the cache) never writes its stale copy over a newer save, and a flush with
// nothing changed writes nothing.
function saveOtherTabWrites(change) {
  const other = JSON.parse(Save.read(SAVE_KEY));
  change(other);
  other.revision++;
  Save.storage.setItem(SAVE_KEY, JSON.stringify(other));   // the other tab writes straight to the shared storage
  return other;
}
Test.add('core', (check) => {
  const inner = makeMemoryStorage(false);
  const counted = { writes: 0, getItem: (key) => inner.getItem(key), setItem(key, value) { this.writes++; inner.setItem(key, value); }, removeItem: (key) => inner.removeItem(key) };
  Save.storage = counted; Save.notice = '';
  Save.data = Save.emptySave();
  Save.saveNow();
  counted.writes = 0;
  flushSave(); flushSave(); window.dispatchEvent(new Event('pagehide'));
  check('save: pause, app switch and page hide with nothing changed write nothing', counted.writes === 0, counted.writes);
  const toasts = [], listener = Bus.on('toast', (payload) => toasts.push(payload.text));
  saveOtherTabWrites((other) => { other.stats.otherTab = 42; });
  Settings.set('video.fov', 100);   // this tab's change on its stale copy
  flushSave();
  const stored = JSON.parse(inner.getItem(SAVE_KEY));
  check('save: a stale tab does not write over the newer save of another tab', stored.stats.otherTab === 42 && stored.settings['video.fov'] === undefined, JSON.stringify(stored.stats));
  check('save: the stale tab carries on from the newer save and says so', Save.data.stats.otherTab === 42 && toasts.includes(SAVE_NEWER_ELSEWHERE), toasts.join());
  const newer = saveOtherTabWrites((other) => { other.stats.otherTab = 43; });
  window.dispatchEvent(new StorageEvent('storage', { key: SAVE_KEY, newValue: JSON.stringify(newer) }));
  check('save: a write in another tab is taken at once while this tab has no change', Save.data.stats.otherTab === 43 && Save.data.revision === newer.revision);
  Settings.set('video.fov', 101);
  flushSave();
  check('save: the next change of this tab is written on top of it', JSON.parse(inner.getItem(SAVE_KEY)).stats.otherTab === 43 && JSON.parse(inner.getItem(SAVE_KEY)).settings['video.fov'] === 101);
  Bus.off('toast', listener);
  Settings.resetKeys(['video.fov']);
  Save.notice = '';
});

// ARC-041 / PLT-002: an error in a 'boot' or 'ready' listener ends the start on the fatal screen; so does a script error before boot.
Test.add('core', (check) => {
  const thrower = Bus.on('test.bootcheck', () => { throw new Error('listener broke'); });
  let thrown = null;
  const logged = Test.expectErrors(() => { try { Boot.emitChecked('test.bootcheck'); } catch (error) { thrown = error; } });
  Bus.off('test.bootcheck', thrower);
  check('boot: a start-up listener error stops the start', logged === 1 && !!thrown && /listener broke/.test(thrown.message), thrown && thrown.message);
  let quiet = true;
  try { Boot.emitChecked('test.bootcheck'); } catch (error) { quiet = false; }
  check('boot: a clean start-up event goes on', quiet);
  const run = Boot.run, fatal = document.getElementById('fatal');
  Boot.run = () => Boot.emitChecked('test.bootcheck');
  Bus.on('test.bootcheck', thrower);
  Test.expectErrors(() => Boot.start());
  Bus.off('test.bootcheck', thrower);
  Boot.run = run;
  check('boot: Boot.start shows the fatal screen for it', fatalShown && fatal.classList.contains('show') && document.getElementById('fatal-title').textContent === BOOT_FATAL_TITLE);
  fatalShown = false; fatal.classList.remove('show');
  const debugApi = window.__CTK;
  delete window.__CTK;
  window.onerror('Uncaught SyntaxError: early', '', 1, 1, null);
  window.__CTK = debugApi;
  check('boot: a script error before boot fills the fatal screen (shell.html)', fatal.classList.contains('show') && /early/.test(document.getElementById('fatal-detail').textContent));
  fatal.classList.remove('show');
  let newer = [];
  Test.expectErrors(() => { ErrorLog.add('test', 'one'); ErrorLog.add('test', 'two'); newer = ErrorLog.since(ErrorLog.total - 1); });
  check('errors: ErrorLog.since lists only the newer entries', newer.length === 1 && newer[0] === 'test: two', newer.join());
  // R-007: WebKit and Firefox stacks hold frames only, Chromium's start with the message; both keep the message once.
  const framesOnly = errorText({ name: 'TypeError', message: 'boom', stack: 'parse@file:1:2\nload@file:3:4\nrun@file:5:6' });
  const chromium = errorText({ name: 'Error', message: 'boom', stack: 'Error: boom\n    at parse (file:1:2)\n    at load (file:3:4)' });
  check('errors: the message is kept on every engine', framesOnly === 'TypeError: boom | parse@file:1:2 | load@file:3:4' && chromium === 'Error: boom | at parse (file:1:2) | at load (file:3:4)', framesOnly + ' / ' + chromium);
  // R-164: an error repeated every step is counted on one entry, so the root cause stays in the ring.
  let flood = [];
  const floodAdded = Test.expectErrors(() => {
    ErrorLog.add('test', 'root cause');
    for (let i = 0; i < 200; i++) ErrorLog.add('test', 'every step');
    flood = ErrorLog.entries.slice(-2);
  });
  check('errors: 200 identical errors keep the earlier entry and a count', floodAdded === 2 && flood[0] === 'test: root cause' && flood[1] === 'test: every step (x200)' && ErrorLog.first !== '', flood.join(' / '));
});

// PLT-003: a loaded field of the wrong kind is replaced, and a failed write tells the player at once (once per failure).
Test.add('core', (check) => {
  const migrated = Save.migrate({ version: 1, settings: null, bindings: [], touchLayouts: 'x', rulesets: {}, play: { mode: 'ffa' }, crosshairs: 5 });
  check('save: fields of the wrong kind are replaced', saveFieldKind(migrated.settings) === 'object' && saveFieldKind(migrated.bindings) === 'object'
    && saveFieldKind(migrated.touchLayouts) === 'object' && Array.isArray(migrated.rulesets) && saveFieldKind(migrated.crosshairs) === 'object' && migrated.play.mode === 'ffa');
  Save.data = migrated;
  let threw = false;
  try { Settings.get('video.fov'); } catch (error) { threw = true; }
  check('save: "settings": null no longer breaks Settings.get', !threw);
  const toasts = [], listener = Bus.on('toast', (payload) => toasts.push(payload.text));
  Save.storage = makeMemoryStorage(true); Save.storageWorks = true; Save.notice = '';
  Save.saveNow(); Save.saveNow();
  check('save: a failed write shows a toast once', toasts.length === 1 && toasts[0] === SAVE_BLOCKED, toasts.join());
  Save.storage = makeMemoryStorage(false); Save.storageWorks = true;
  Save.data.oversized = 'x'.repeat(SAVE_MAX_BYTES + 1);
  check('save: an oversized save is not written and shows a toast', Save.saveNow() === false && toasts[1] === SAVE_TOO_BIG, toasts.join());
  Bus.off('toast', listener);
  Save.storageWorks = true; Save.notice = '';
  // R-040: every top-level field is declared in emptySave, so a wrong kind is repaired before a screen reads it.
  check('save: every field the sections keep is declared in the empty save', ['loadouts', 'tips'].every((field) => saveFieldKind(Save.emptySave()[field]) === 'object'));
  Save.importText(JSON.stringify({ version: 1, settings: { 'video.fov': 90 }, loadouts: 'x', tips: 7 }));
  const leave = uiEnter();
  let screenErrors = -1;
  try { screenErrors = Test.expectErrors(() => { Ui.open('loadout'); Tips.show(); }); } finally { leave(); }
  check('save: an imported loadouts of the wrong kind is repaired and the loadout screen opens', screenErrors === 0 && saveFieldKind(Save.data.loadouts) === 'object'
    && Loadouts.selectedClass() === CAT.classes[0] && Save.data.tips.matches >= 0, screenErrors + ' ' + JSON.stringify(Save.data.loadouts));
});

Test.add('core', (check) => {
  World.load({ id: 'test', brushes: [{ shape: 'box', min: [-10, -1, -10], max: [10, 0, 10] }, { shape: 'ramp', min: [2, 0, -1], max: [6, 2, 1], dir: '+x' }] });
  const hit = makeHit();
  check('world: ray down hits the floor', World.raycast(0, 5, 0, 0, -1, 0, 100, hit) && Test.near(hit.y, 0, 1e-4) && hit.ny > 0.99, JSON.stringify(hit.y));
  check('world: ray down on ramp middle hits at half height', World.raycast(4, 5, 0, 0, -1, 0, 100, hit) && Test.near(hit.y, 1, 1e-3), hit.y);
  check('world: ray misses beyond max distance', !World.raycast(0, 5, 0, 0, -1, 0, 4, hit));
  check('world: line of sight', World.lineClear(-5, 1, 0, -5, 3, 0) && !World.lineClear(0, 1, 0, 0, -2, 0));
  World.clear();
});

Test.add('core', (check) => {
  // Two boxes; the wide one spans four 4 m cells, so a query over all of them must list it once.
  const boxes = [{ minX: 0, minZ: 0, maxX: 7, maxZ: 7 }, { minX: 9, minZ: 9, maxX: 11, maxZ: 11 }];
  const grid = BrushGrid.build({}, boxes, 4, 0, 0, 12, 12);
  check('grid: 3 x 3 cells over a 12 m square of 4 m cells', grid.cellsX === 3 && grid.cellsZ === 3, grid.cellsX + 'x' + grid.cellsZ);
  const count = BrushGrid.query(grid, 0, 0, 12, 12);
  check('grid: a query lists each overlapping box once', count === 2 && grid.found[0] === 0 && grid.found[1] === 1, Array.from(grid.found.slice(0, count)).join());
  check('grid: a query only reaches the cells it overlaps', BrushGrid.query(grid, 9, 9, 10, 10) === 1 && grid.found[0] === 1);
  check('grid: a point past the edge reads the nearest edge cell', BrushGrid.cellAt(grid, -50, -50) === 0 && BrushGrid.cellAt(grid, 50, 50) === 8);
  const walk = BrushGrid.startWalk(grid, makeGridWalk(), 1, 1, 1, 0), cells = [];
  for (let cell = BrushGrid.walkCell(grid, walk); cell >= 0; cell = BrushGrid.walkCell(grid, walk)) { cells.push(cell); BrushGrid.stepWalk(walk); }
  check('grid: a ray walk crosses the cells in order and ends outside the grid', cells.join() === '0,1,2' && BrushGrid.walkCell(grid, walk) === -1, cells.join());
  BrushGrid.beginPass(grid);
  check('grid: a pass counts a box once', BrushGrid.firstVisit(grid, 0) && !BrushGrid.firstVisit(grid, 0));
  check('grid: nav, map scan and render bake keep no lookup grid of their own', typeof navForCells === 'undefined' && typeof gridKey === 'undefined'
    && typeof MapScan.fillBuckets === 'undefined' && String(rayBlocked).includes('BrushGrid'));
});

// One emitter per shared event: emitSound, emitImpulse and emitToast in S01 send one reused payload, and no other
// section builds its own 'sound', 'impulse' or 'toast' payload.
const SHARED_EMIT_PATTERN = /Bus\.emit\('(sound|impulse|toast)'/;
const SHARED_EMIT_EXEMPT = ['01-core.js'];
Test.add('core', (check) => {
  const seen = [];
  const handlers = ['sound', 'impulse', 'toast'].map((type) => [type, Bus.on(type, (payload) => seen.push(type + ':' + JSON.stringify(payload)))]);
  emitSound(1, 2, 3, 0, 'step', 4);
  emitSound(1, 2, 3, 10, 'step', 4);
  emitImpulse(5, 0, 6, 0);
  emitToast('hello');
  for (const [type, handler] of handlers) Bus.off(type, handler);
  const expected = 'sound:{"x":1,"y":2,"z":3,"radius":10,"kind":"step","source":4,"effect":""}|impulse:{"id":5,"x":0,"y":6,"z":0}|toast:{"text":"hello"}';
  check('emitters: payloads arrive, a silent sound sends nothing', seen.join('|') === expected, seen.join('|'));
  const sections = Array.from(document.scripts).map((element) => element.textContent).join('\n').split(/\n\/\/ ==== (\S+) ====\n/);
  const offenders = [];
  for (let k = 1; k < sections.length; k += 2) {
    if (SHARED_EMIT_EXEMPT.includes(sections[k]) || sections[k].startsWith('20')) continue;
    if (SHARED_EMIT_PATTERN.test(sections[k + 1])) offenders.push(sections[k]);
  }
  check('emitters: no section emits its own sound, impulse or toast payload', sections.length > 10 && offenders.length === 0, offenders.join(', '));
});
