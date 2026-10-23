// Self-tests for S01-S04 and the loop: math, RNG, events, actors, data, save, settings, world rays.

// The defined setting keys with this prefix (for Settings.resetKeys).
function settingKeysStarting(prefix) { return Array.from(Settings.definitions.keys()).filter((key) => key.startsWith(prefix)); }
// A memory store that counts its writes (the save tests).
function makeCountingStorage() {
  const store = makeMemoryStorage(false), write = store.setItem;
  store.writes = 0;
  store.setItem = (key, value) => { store.writes++; write(key, value); };
  return store;
}

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
  // R-159: one ally rule (same team, not free-for-all, not itself); an enemy is anyone else
  const mate = Actors.create(ACTOR_KIND.BOT, 1, 'mate'), loner = Actors.create(ACTOR_KIND.BOT, -1, 'a'), other = Actors.create(ACTOR_KIND.BOT, -1, 'b');
  check('actors: ally test', Actors.isAlly(first, mate) && !Actors.isAlly(first, first) && !Actors.isAlly(loner, other) && !Actors.isAlly(first, loner)
    && Actors.isEnemy(loner, other) && !Actors.isEnemy(first, mate));
  Actors.remove(other); Actors.remove(loner); Actors.remove(mate);
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
  Save.storage = makeMemoryStorage(false); Save.storageWorks = true; Save.notice = '';
});

// R-001 / R-163: a stale tab never writes over a newer save; an unchanged flush writes nothing.
function saveOtherTabWrites(mark) {
  const other = JSON.parse(Save.read(SAVE_KEY));
  other.stats.tab = mark;
  other.revision++;
  Save.storage.setItem(SAVE_KEY, JSON.stringify(other));
  return JSON.stringify(other);
}
Test.add('core', (check) => {
  const store = Save.storage = makeCountingStorage(), stored = () => JSON.parse(store.getItem(SAVE_KEY)).stats.tab;
  Save.saveNow();
  store.writes = 0;
  flushSave(); window.dispatchEvent(new Event('pagehide'));
  check('save: an unchanged flush writes nothing', store.writes === 0, store.writes);
  saveOtherTabWrites(1);
  Settings.set('video.fov', 100);
  flushSave();
  check('save: a stale tab takes the newer save', stored() === 1 && Save.data.stats.tab === 1 && Save.notice === SAVE_NEWER_ELSEWHERE);
  window.dispatchEvent(new StorageEvent('storage', { key: SAVE_KEY, newValue: saveOtherTabWrites(2) }));
  check('save: a storage event takes the newer save', Save.data.stats.tab === 2);
  Save.notice = '';
});

// R-037 / R-038 / R-039: junk or a failed write keeps the save; the backup can be shown and restored.
Test.add('core', (check) => uiWith(() => {
  const reload = SaveTransfer.reload, good = Save.storage, save = (mark) => JSON.stringify({ version: 1, stats: { mark } });
  let reloads = 0;
  SaveTransfer.reload = () => { reloads++; };
  try {
    Save.importText(save('A'));
    Save.storage = makeMemoryStorage(true);
    const blocked = SaveTransfer.importText(save('B'));
    Save.storage = good; Save.storageWorks = true;
    check('import: junk or a failed write keeps the save', SaveTransfer.importText('{}') !== '' && blocked === SAVE_BLOCKED && reloads === 0 && Save.data.stats.mark === 'A', blocked);
    SaveTransfer.importText(save('B'));
    Ui.open('saveTransfer');
    uiClickButton(Ui.top().element, 'Restore backup');
    uiClickButton(Ui.top().element, 'Restore');
    check('backup: restored', Save.data.stats.mark === 'A' && reloads === 2);
    Test.expectErrors(() => DebugApi.save.corrupt('trunc'));
    Ui.open('saveTransfer');
    const screen = Ui.top().element;
    check('backup: shown', uiClickButton(screen, 'Export backup') && screen.querySelector('textarea').value === '{"version":1,"settings":');
  } finally { SaveTransfer.reload = reload; Save.notice = ''; }
}));

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
  // R-007: 'listener broke' above needs the message, which WebKit and Firefox stacks lack. R-164: repeats count on one entry.
  let flood = [];
  const added = Test.expectErrors(() => { ErrorLog.add('t', 'root'); for (let i = 0; i < 200; i++) ErrorLog.add('t', 'step'); flood = ErrorLog.entries.slice(-2); });
  check('errors: repeats are counted', added === 2 && flood.join() === 't: root,t: step (x200)', flood.join());
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
  // R-040: a field of the wrong kind is repaired before a screen reads it.
  Save.importText(JSON.stringify({ version: 1, settings: { 'video.fov': 90 }, loadouts: 'x', tips: 7 }));
  const errors = uiWith(() => Test.expectErrors(() => { Ui.open('loadout'); Tips.show(); }));
  check('save: wrong-kind loadouts and tips are repaired', errors === 0 && Loadouts.selectedClass() === CAT.classes[0] && Save.data.tips.matches === 1, errors);
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

// ARC-010 spiral guard: a cheap sim keeps 1x game time down to 10 fps, a costly one keeps the 4-step floor. The first frame
// after a resume takes the clock from its own rAF timestamp (it can be older than the resume event).
Test.add('core', (check) => {
  const systems = Sim.systems, dropped = Perf.droppedSteps, raf = window.requestAnimationFrame, hooks = Loop.hooks;
  const run = (stepCostMs, seconds, frames) => {
    Sim.reset(); Loop.accumulator = 0; Loop.stepCostMs = stepCostMs;
    for (let frame = 0; frame < frames; frame++) Loop.advance(seconds);
    return Sim.tick;
  };
  // A cheap sim.
  Sim.systems = [];
  window.requestAnimationFrame = () => 0;
  Loop.hooks = { input: [], render: [], hud: [], audio: [], ui: [] };
  try {
    check('loop: 24 fps runs at 1x', run(0, 1 / 24, 48) >= 239 && Perf.droppedSteps === dropped, Sim.tick);
    check('loop: a stall runs 0.1 s, a costly sim 4 steps', run(0, 1, 1) === 12 && run(10, 1, 1) === MIN_STEPS_PER_FRAME, Sim.tick);
    Game.state = 'playing'; Game.paused = true;
    Game.resume();
    Game.state = 'menu';
    const start = performance.now() - 5, recorded = Perf.index;
    Loop.frame(start);
    const skipped = Perf.index === recorded;
    Loop.frame(start + 16);
    check('loop: a resume skips one frame, no negative interval', skipped && Math.abs(Perf.frameMs[Perf.lastIndex()] - 16) < 0.01);
  } finally {
    Sim.systems = systems; Sim.reset(); Loop.accumulator = 0; Loop.stepCostMs = 0; Perf.droppedSteps = dropped;
    window.requestAnimationFrame = raf; Loop.hooks = hooks; Game.paused = false;
  }
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
