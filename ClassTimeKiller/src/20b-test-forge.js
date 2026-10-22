// ==== S20 TESTS: FORGE (MAP EDITOR) ====
// Group 'forge': budget, undo / redo, serialising and validation, saves and codes, tools (cursor, placing, grab), the three input devices,
// the screens, runtime maps and test-play. A longer randomised sweep is behind __CTK.forgeSweep(seeds).

const FORGE_LIST_KEYS = ['brushes', 'spawns', 'items', 'objectives', 'zones', 'triggers', 'lights', 'navHints'];
// Two maps are the same when every field is (the order of the top-level keys does not matter).
function forgeSameMap(a, b) {
  const keys = new Set(Object.keys(a).concat(Object.keys(b)));
  for (const key of keys) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return key;
  return '';
}
const forgeMapJson = () => JSON.stringify(Forge.map);
function forgeRandomSource(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
const forgeSnapped = (value) => Math.round(value * 2) / 2;
function forgeEditorOff() {
  ForgeTools.detach();
  ForgeTools.returning = false;
  Ui.closeAll();
  Maps.runtime.length = 0;
}
// One random edit (placing, moving, turning, resizing, deleting, recolouring, renaming, theme); returns true when it changed the map.
function forgeRandomEdit(random) {
  const before = forgeMapJson(), pick = Math.floor(random() * 11), x = forgeSnapped((random() - 0.5) * 30), z = forgeSnapped((random() - 0.5) * 30);
  const lists = FORGE_LIST_KEYS.filter((list) => Forge.map[list].length);
  const list = lists[Math.floor(random() * lists.length)];
  if (list) Forge.select(list, Math.floor(random() * Forge.map[list].length));
  if (pick === 0) Forge.add('brushes', MapKit.brush(['metal', x, 0, z, x + 2, 2, z + 2]));
  else if (pick === 1) Forge.add('spawns', MapKit.spawns([[-1, [], [[x, 0, z, 90]]]])[0]);
  else if (pick === 2) Forge.add('items', MapKit.item(['ammobox', x, 0, z]));
  else if (pick === 3) Forge.nudgeSelected(1, 0, -1);
  else if (pick === 4) Forge.turnSelected();
  else if (pick === 5) Forge.resizeSelected(1, 0.5);
  else if (pick === 6) Forge.deleteSelected();
  else if (pick === 7) Forge.editSelected((copy) => { if (copy.material) copy.material = copy.material === 'wood' ? 'glass' : 'wood'; else if (copy.team !== undefined) copy.team = 1; });
  else if (pick === 8) Forge.rename('Name ' + Math.floor(random() * 1000));
  else if (pick === 9) Forge.setTheme(MapRules.themes[Math.floor(random() * MapRules.themes.length)]);
  else Forge.group(() => { Forge.add('lights', MapKit.light([x, 3, z, 0xffffff, 10])); Forge.add('navHints', MapKit.hint(['cover', x, 0, z])); });
  return forgeMapJson() !== before;
}
// Does a run of random edits followed by all-undo and all-redo restore the exact map at every step? Returns '' or the first failing step.
function forgeRoundTrip(seed, steps) {
  const random = forgeRandomSource(seed);
  Forge.newFrom({ kind: 'template', id: 'arena' });
  const snapshots = [forgeMapJson()];
  for (let i = 0; i < steps; i++) if (forgeRandomEdit(random)) snapshots.push(forgeMapJson());
  for (let i = snapshots.length - 1; i > 0; i--) {
    if (!Forge.undo() || forgeMapJson() !== snapshots[i - 1]) return 'undo step ' + i;
  }
  for (let i = 1; i < snapshots.length; i++) {
    if (!Forge.redo() || forgeMapJson() !== snapshots[i]) return 'redo step ' + i;
  }
  return Forge.canRedo() ? 'redo left over' : '';
}
// A fake pad for the pad reader: buttons and axes as the Gamepad API reports them.
function forgeFakePad() {
  return { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
}
function forgeWithPad(pad, run) {
  const connected = PadInput.connected, activePad = PadInput.activePad;
  PadInput.connected = 1; PadInput.activePad = () => pad;
  try { run(); } finally { PadInput.connected = connected; PadInput.activePad = activePad; }
}
const forgeFakeBatch = () => ({ count: 0, shapes: {}, mesh(shape) { this.count++; this.shapes[shape] = (this.shapes[shape] || 0) + 1; return 0; } });
// Points the editor camera straight down at the middle of the map and reads the cursor under the screen centre.
function forgeLookDown(height) {
  Object.assign(ForgeTools.camera, { x: 0, y: height, z: 0, yaw: 0, pitch: -Math.PI / 2 + 0.001 });
  ForgeTools.pointer.centre = true;
  ForgeTools.updateCursor();
}

Test.add('forge', (check) => {
  // ---- Start points, templates, built-in copies ----
  forgeEditorOff();
  const empty = Forge.newFrom({ kind: 'empty' });
  check('empty map starts with one floor brush', !empty.error && Forge.count() === 1 && Forge.map.brushes[0].shape === 'box' && Forge.dirty);
  for (const template of FORGE_TEMPLATES) {
    Forge.newFrom({ kind: 'template', id: template.id });
    const problems = Maps.validate(Forge.toMap());
    check('template ' + template.id + ' passes Maps.validate', problems.length === 0, problems.join(' | '));
    check('template ' + template.id + ' lists its modes', Forge.map.modes.length > 0 && Forge.map.modes.every((mode) => !!MapRules.rule(mode)), Forge.map.modes.join());
    check('template ' + template.id + ' is ready for its modes', Forge.map.modes.every((mode) => Forge.modeReady(Forge.toMap(), mode, true)), Forge.map.modes.map((mode) => Forge.modeNeeds(Forge.toMap(), mode)).join('|'));
  }
  check('unknown template and built-in are refused', Forge.build({ kind: 'template', id: 'nope' }).error && Forge.build({ kind: 'builtin', id: 'nope' }).error);
  const failures = [];
  for (const row of CAT.maps) {
    const made = Forge.newFrom({ kind: 'builtin', id: row.id });
    const copy = made.error ? null : Forge.toMap();
    const problems = copy ? Maps.validate(copy) : [made.error];
    const back = copy ? Forge.expand(Forge.compact(copy)) : { error: 'no copy' };
    const same = back.error ? back.error : forgeSameMap(copy, back.map);
    if (problems.length || same) failures.push(row.id + ': ' + (problems[0] || '') + (same ? ' differs in ' + same : ''));
  }
  check('a copy of every built-in map serialises back to the same map and validates', failures.length === 0, failures.join(' | '));
  check('a copy is a draft, not a catalogue row', Forge.newFrom({ kind: 'builtin', id: 'spire' }) && Forge.map.id === FORGE_DRAFT_ID && Forge.map.name.startsWith('Copy of') && Maps.get('spire').name === 'Foundry Spire');
  Forge.map.brushes[0].material = 'wood';
  check('editing a copy leaves the catalogue map alone', Maps.get('spire').brushes[0].material === 'concrete');

  // ---- Budget (MAP-014: 400 objects) ----
  Forge.newFrom({ kind: 'template', id: 'arena' });
  const start = Forge.count();
  let added = 0;
  while (Forge.count() < FORGE_BUDGET) { Forge.add('navHints', MapKit.hint(['cover', 0, 0, 0])); added++; }
  check('the budget counts every list and reaches exactly 400', Forge.count() === FORGE_BUDGET && added === FORGE_BUDGET - start, Forge.count());
  const refused = Forge.add('items', MapKit.item(['ammobox', 1, 0, 1]));
  check('object 401 is refused with a message', refused === -1 && Forge.count() === FORGE_BUDGET && /budget/i.test(Forge.message), Forge.message);
  Forge.select('navHints', 0);
  Forge.nudgeSelected(2, 0, 0);
  check('moving keeps the budget exact', Forge.count() === FORGE_BUDGET);
  Forge.deleteSelected();
  check('deleting frees exactly one place', Forge.count() === FORGE_BUDGET - 1 && Forge.budgetLeft() === 1);
  check('the freed place can be used once', Forge.add('items', MapKit.item(['ammobox', 1, 0, 1])) >= 0 && Forge.add('items', MapKit.item(['ammobox', 3, 0, 3])) === -1);
  Forge.undo(); Forge.undo();
  check('undoing the add and the delete restores the full map; refusals left no history', Forge.count() === FORGE_BUDGET && Forge.map.items.length === 10, Forge.count());
  Forge.newFrom({ kind: 'empty' });
  for (let i = 0; i < MapRules.limits.lights; i++) Forge.add('lights', MapKit.light([i, 3, 0, 0xffffff, 8]));
  check('lights stop at the validator limit of 24', Forge.add('lights', MapKit.light([0, 3, 5, 0xffffff, 8])) === -1 && Forge.map.lights.length === MapRules.limits.lights);

  // ---- Undo / redo ----
  check('50 mixed edits undo and redo to the exact map JSON at every step', forgeRoundTrip(7, 50) === '', forgeRoundTrip(7, 50));
  Forge.newFrom({ kind: 'empty' });
  const ring = Forge.history.entries;
  const earlySnapshots = [];
  for (let i = 0; i < FORGE_HISTORY_SIZE * 2 + 30; i++) {
    Forge.add('navHints', MapKit.hint(['cover', i * 0.01, 0, 0]));
    if (i === FORGE_HISTORY_SIZE + 29) earlySnapshots.push(forgeMapJson());
  }
  check('the history ring never grows past its size', Forge.history.length === FORGE_HISTORY_SIZE && Forge.history.entries === ring && ring.length === FORGE_HISTORY_SIZE, Forge.history.length);
  let undone = 0;
  while (Forge.undo()) undone++;
  check('only the newest ' + FORGE_HISTORY_SIZE + ' edits can be undone, and that restores the older state', undone === FORGE_HISTORY_SIZE && forgeMapJson() === earlySnapshots[0], undone);
  let redone = 0;
  while (Forge.redo()) redone++;
  check('redo returns to the newest edit', redone === FORGE_HISTORY_SIZE && Forge.map.navHints.length === FORGE_HISTORY_SIZE * 2 + 30);
  Forge.undo();
  Forge.add('navHints', MapKit.hint(['sniper', 0, 0, 0]));
  check('a new edit ends the redo branch', !Forge.canRedo());
  Forge.newFrom({ kind: 'empty' });
  Forge.group(() => { Forge.add('navHints', MapKit.hint(['cover', 0, 0, 0])); Forge.add('navHints', MapKit.hint(['cover', 4, 0, 0])); });
  Forge.undo();
  check('a group of edits is one undo step', Forge.map.navHints.length === 0 && !Forge.canUndo());
  Forge.add('zones', { name: 'A', min: [0, 0, 0], max: [4, 4, 4] });
  Forge.select('zones', 0);
  Forge.deleteSelected();
  check('deleting clears the selection', Forge.selected() === null);
  Forge.undo();
  check('undoing a delete selects the object that came back', Forge.selected() && Forge.selected().name === 'A');
  forgeEditorOff();
});

Test.add('forge', (check) => {
  // ---- Geometry helpers ----
  Forge.newFrom({ kind: 'empty' });
  Forge.add('brushes', MapKit.brush(['wood', 0, 0, 0, 4, 2, 2, '+z']));
  Forge.select('brushes', 1);
  const box = Forge.bounds('brushes', Forge.selected(), new Float64Array(6));
  check('bounds of a box list are its min and max', box.join() === '0,0,0,4,2,2');
  Forge.turnSelected();
  const turned = Forge.selected();
  check('a quarter turn swaps width and depth around the centre and turns a ramp', turned.min.join() === '1,0,-1' && turned.max.join() === '3,2,3' && turned.dir === '+x', JSON.stringify(turned));
  Forge.turnSelected(); Forge.turnSelected(); Forge.turnSelected();
  check('four quarter turns are the identity', JSON.stringify(Forge.selected().min) === '[0,0,0]' && Forge.selected().dir === '+z');
  Forge.add('spawns', MapKit.spawns([[0, [], [[0, 0, 0, 270]]]])[0]);
  Forge.select('spawns', 0);
  Forge.turnSelected();
  check('a spawn turns by 90 degrees and wraps', Forge.selected().yaw === 0);
  check('a spawn has no size to change', !Forge.resizeSelected(0, 1));
  Forge.select('brushes', 1);
  check('a box grows along an axis and refuses to vanish', Forge.resizeSelected(1, 1) && Forge.selected().max[1] === 3 && !Forge.resizeSelected(1, -5) && Forge.selected().max[1] === 3);
  Forge.nudgeSelected(1000, 0, 0);
  check('an object cannot be moved out of the map', Forge.selected().max[0] <= Forge.map.size[0] / 2 + MapRules.limits.shellThickness + 1e-9, Forge.selected().max[0]);
  Forge.add('objectives', MapKit.objective({ id: 'route', kind: 'payloadPath', x: 1, y: 0, z: 2, radius: 3, path: [[1, 0, 2], [3, 0, 2]] }));
  Forge.select('objectives', 0);
  Forge.turnSelected();
  check('a payload path turns with its objective', JSON.stringify(Forge.selected().path) === '[[1,0,2],[3,0,0]]' || JSON.stringify(Forge.selected().path) === '[[1,0,2],[1,0,0]]', JSON.stringify(Forge.selected().path));
  const near = { list: '', index: -1 };
  check('objectNear finds the nearest object within reach', Forge.objectNear(0, 0, 0, 0.5, near) && near.list !== '' && !Forge.objectNear(-100, 0, -100, 1, near));

  // ---- Problems point at objects ----
  Forge.newFrom({ kind: 'template', id: 'arena' });
  Forge.add('spawns', MapKit.spawns([[-1, [], [[0, 5, 0, 0]]]])[0]);   // hangs in the air above the platform
  const problems = Forge.validate();
  const spawnProblem = problems.find((text) => text.startsWith('spawn:'));
  const located = spawnProblem ? Forge.locate(spawnProblem) : null;
  check('a problem about a spawn names it and jumps to it', !!located && located.list === 'spawns' && located.index === Forge.map.spawns.length - 1, spawnProblem + ' -> ' + JSON.stringify(located));
  check('a problem with only a position finds the object near it', (() => {
    Forge.map.items[0].x += 0.2;
    const target = Forge.locate('items: something at (' + Forge.map.items[0].x.toFixed(1) + ', ' + Forge.map.items[0].y.toFixed(1) + ', ' + Forge.map.items[0].z.toFixed(1) + ')');
    return target && target.list === 'items' && target.index === 0;
  })());
  check('a problem with no place gives null', Forge.locate('structure: id and name are required') === null);
  Forge.newFrom({ kind: 'empty' });
  Forge.setModes(['ffa']);
  check('modes the map lacks things for are listed by Forge.modeNeeds', /spawn/.test(Forge.modeNeeds(Forge.toMap(), 'ffa')) && Forge.modeNeeds(Forge.toMap(), 'ctf') !== '');
  check('suggested modes are only strictly ready ones', Forge.suggestModes().length === 0);
  Forge.newFrom({ kind: 'template', id: 'yard' });
  check('the yard template suggests team modes and capture the flag', ['tdm', 'ctf'].every((mode) => Forge.suggestModes().includes(mode)), Forge.suggestModes().join());
  Forge.newFrom({ kind: 'empty' });
  check('the zone grid adds nine zones once and then nothing', Forge.addZoneGrid() === 9 && Forge.map.zones.length === 9 && Forge.addZoneGrid() === 0);
  check('lights are added to the zones, one each', Forge.addZoneLights() === 9 && Forge.map.lights.length === 9 && Forge.addZoneLights() === 0);
  Forge.undo();
  check('zone helpers undo as one step', Forge.map.lights.length === 0 && Forge.map.zones.length === 9);
  forgeEditorOff();
});

Test.add('forge', (check) => {
  // ---- Saving, loading, codes ----
  forgeEditorOff();
  Forge.newFrom({ kind: 'template', id: 'arena' });
  check('a new map is not saved yet', Forge.dirty && Forge.slotId === '' && Forge.saved().length === 0);
  check('a map without a name is refused', !Forge.saveCurrent('  <>  ') && /name/i.test(Forge.message));
  check('saving works and registers the map for matches', Forge.saveCurrent('My Arena') && Forge.saved().length === 1 && !Forge.dirty && Forge.slotId === 'user1');
  check('the saved map is a runtime map for its modes', Maps.get('user1') && Maps.get('user1').name === 'My Arena' && Maps.forMode('ffa').some((map) => map.id === 'user1') && !Maps.forMode('ctf').some((map) => map.id === 'user1'));
  check('catalogue maps are untouched by the runtime list', CAT.maps.length === 12 && !CAT.maps.byId('user1'));
  check('a custom match accepts a saved map', CustomMatch.validate({ mode: 'ffa', map: 'user1' }).draft.map === 'user1');
  const saved = Forge.toMap();
  Forge.map.brushes.pop();
  Forge.dirty = true;
  check('saving again uses the same slot', Forge.saveCurrent() && Forge.saved().length === 1 && Forge.slotId === 'user1');
  check('the stored entry knows its size and modes', Forge.saved()[0].bytes > 100 && Forge.saved()[0].modes.join() === 'ffa,duel');
  Forge.newFrom({ kind: 'empty' });
  check('loading restores the saved map exactly', Forge.loadSaved('user1') && Forge.map.brushes.length === saved.brushes.length - 1 && !Forge.dirty && Forge.slotId === 'user1');
  check('loading clears the history and selection', !Forge.canUndo() && Forge.selected() === null);
  check('loading an unknown map fails with a message', !Forge.loadSaved('user99') && /not in the list/.test(Forge.message));
  check('renaming updates the list and the runtime map', Forge.renameSaved('user1', 'Renamed') && Forge.saved()[0].name === 'Renamed' && Maps.get('user1').name === 'Renamed' && Forge.map.name === 'Renamed');
  check('the save holds the editor maps', JSON.parse(Save.exportText()).editorMaps.length === 1);
  Forge.syncRuntime();
  check('syncRuntime re-registers saved maps', Maps.get('user1') && Maps.runtime.length === 1);
  check('deleting removes the map from the list and from matches', Forge.deleteSaved('user1') && Forge.saved().length === 0 && !Maps.get('user1') && Forge.slotId === '');
  for (let i = 0; i < FORGE_MAX_MAPS; i++) { Forge.newFrom({ kind: 'template', id: 'arena' }); Forge.saveCurrent('Map ' + i); }
  check('twenty maps can be saved', Forge.saved().length === FORGE_MAX_MAPS);
  Forge.newFrom({ kind: 'template', id: 'arena' });
  check('the twenty-first save is refused', !Forge.saveCurrent('One too many') && /full/i.test(Forge.message) && Forge.saved().length === FORGE_MAX_MAPS);
  check('a full list still lets a saved map be saved again', Forge.loadSaved('user5') && Forge.saveCurrent() && Forge.saved().length === FORGE_MAX_MAPS);
  for (let i = 0; i < FORGE_MAX_MAPS; i++) Forge.deleteSaved('user' + (i + 1));
  check('deleting all leaves an empty list', Forge.saved().length === 0 && Maps.runtime.length === 0);

  // storage cap
  Forge.newFrom({ kind: 'template', id: 'yard' });
  Save.data.editorMaps.push({ id: 'filler', name: 'Filler', modes: [], data: { pad: 'x'.repeat(FORGE_SAFE_SAVE_BYTES - 3000) }, bytes: FORGE_SAFE_SAVE_BYTES - 3000 });
  check('free space is reported against the safe cap', Forge.freeBytes() < 4000 && Forge.freeBytes() > 0, Forge.freeBytes());
  check('a save that would pass the safe cap is refused with the sizes', !Forge.saveCurrent('Too big') && /not enough room/i.test(Forge.message) && /KB/.test(Forge.message) && Forge.saved().length === 1, Forge.message);
  Save.data.editorMaps.length = 0;
  Forge.syncRuntime();
  check('with room again the same map saves', Forge.saveCurrent('Fits') && Forge.usedBytes() < FORGE_SAFE_SAVE_BYTES);
  Save.storage = makeMemoryStorage(true);
  Forge.dirty = true;
  const before = Forge.saved().length;
  check('a blocked storage refuses the save and keeps the list as it was', !Forge.saveCurrent('Blocked') && Forge.saved().length === before && /storage/i.test(Forge.message), Forge.message);
  Save.storage = makeMemoryStorage(false);
  Save.storageWorks = true; Save.notice = '';
  Forge.deleteSaved('user1');

  // codes
  Forge.newFrom({ kind: 'template', id: 'yard' });
  const original = Forge.toMap();
  const code = Forge.exportCode();
  check('a code has the prefix, a check value and fits a text box', /^CTKMAP1-[0-9a-f]{8}-[A-Za-z0-9_-]+$/.test(code) && code.length < FORGE_CODE_MAX_CHARS, code.length);
  check('the code is much shorter than the plain JSON', code.length < JSON.stringify(original).length / 2, code.length + ' vs ' + JSON.stringify(original).length);
  Forge.newFrom({ kind: 'empty' });
  const imported = Forge.importCode('  ' + code.slice(0, 20) + '\n' + code.slice(20) + '  ');
  check('import accepts the code (white space is ignored)', !imported.error && Forge.dirty && Forge.slotId === '');
  check('export then import gives back the same map', forgeSameMap(Object.assign(original, { id: FORGE_DRAFT_ID }), Forge.toMap()) === '', forgeSameMap(original, Forge.toMap()));
  check('an imported map validates like the original', Maps.validate(Forge.toMap()).length === 0);
  const mutate = (text, index) => text.slice(0, index) + (text[index] === 'A' ? 'B' : 'A') + text.slice(index + 1);
  const bad = [['an empty code', ''], ['a foreign text', 'hello world'], ['a custom match code', 'CTK1-00000000-AAAA'], ['a changed character', mutate(code, code.length - 5)],
    ['a changed check value', mutate(code, 10)], ['a cut code', code.slice(0, code.length - 30)], ['a newer version', code.replace('CTKMAP1', 'CTKMAP9')], ['an oversize code', code + 'A'.repeat(FORGE_CODE_MAX_CHARS)]];
  for (const [name, text] of bad) {
    const result = Forge.decodeCode(text);
    check('corrupt code rejected: ' + name, !!result.error && !result.map, result.error);
  }
  check('a rejected import leaves the editor map alone', (() => { const json = forgeMapJson(); Forge.importCode('CTKMAP1-00000000-AAAA'); return json === forgeMapJson(); })());
  // a code with a correct check value but hostile content
  const forge = (object) => { const payload = CustomCodec.toBase64Url(CustomCodec.compress(new TextEncoder().encode(JSON.stringify(object)))); return 'CTKMAP1-' + CustomCodec.checksum(payload) + '-' + payload; };
  const good = Forge.compact(original);
  const hostile = [['no lists', Object.assign({}, good, { brushes: 5 })], ['a bad number', Object.assign({}, good, { brushes: [['concrete', 0, 0, 0, 'x', 1, 1]] })],
    ['an unknown material', Object.assign({}, good, { brushes: [['lava', 0, 0, 0, 1, 1, 1]] })], ['a huge coordinate', Object.assign({}, good, { brushes: [['concrete', 0, 0, 0, 1e9, 1, 1]] })],
    ['too many objects', Object.assign({}, good, { hints: Array.from({ length: 450 }, () => ['cover', 0, 0, 0]) })], ['a bad size', Object.assign({}, good, { size: [1, 1, 1] })],
    ['an unknown theme', Object.assign({}, good, { theme: 'lava' })], ['an unknown mode', Object.assign({}, good, { modes: ['chess'] })], ['not an object', [1, 2, 3]],
    ['a bad objective', Object.assign({}, good, { objectives: [{ id: 5 }] })], ['a bad trigger', Object.assign({}, good, { triggers: [{ kind: 'jumppad', min: [0, 0], max: [1, 1, 1] }] })],
    ['a bad item', Object.assign({}, good, { items: [['notakey', 0, 0, 0]] })], ['an old version', Object.assign({}, good, { v: 0 })]];
  for (const [name, object] of hostile) {
    const result = Forge.decodeCode(forge(object));
    check('hostile content rejected: ' + name, !!result.error && !result.map, JSON.stringify(result).slice(0, 80));
  }
  check('a harmless code still imports', !Forge.decodeCode(forge(good)).error);
  forgeEditorOff();
});

Test.add('forge', (check) => {
  // ---- Tools: camera, cursor, placing, picking, grab ----
  forgeEditorOff();
  Forge.newFrom({ kind: 'template', id: 'arena' });
  ForgeTools.attach();
  check('the editor takes the camera and shows the map theme', ForgeTools.active && Render.cameraOverride === ForgeTools.cameraHook && World.map && World.map.theme === Forge.map.theme && World.brushes.length === 0);
  const camera = {};
  check('the camera hook places the editor camera', Render.cameraOverride(camera) === true && camera.x === ForgeTools.camera.x && camera.y === ForgeTools.camera.y);
  const startZ = ForgeTools.camera.z;
  ForgeTools.setHold('forward', true);
  ForgeTools.frame(0.1);
  ForgeTools.setHold('forward', false);
  check('holding forward flies the camera along the view', ForgeTools.camera.z > startZ && Math.abs(ForgeTools.camera.z - startZ) < FORGE_FLY_SPEED * 0.1 + 1e-6);
  ForgeTools.camera.y = 1;
  ForgeTools.setHold('down', true); ForgeTools.frame(1); ForgeTools.setHold('down', false);
  check('the camera stays above the ground', ForgeTools.camera.y >= 0.5);

  ForgeTools.snapIndex = 0;
  ForgeTools.setTool('box');
  forgeLookDown(30);
  check('looking straight down puts the cursor under the screen centre', ForgeTools.cursor.valid && ForgeTools.cursor.x === 0 && ForgeTools.cursor.z === 0, JSON.stringify(ForgeTools.cursor));
  ForgeTools.camera.x = -14; ForgeTools.camera.z = 12;
  ForgeTools.updateCursor();
  check('the cursor is snapped to the grid and sits on the floor', ForgeTools.cursor.valid && ForgeTools.cursor.x === -14 && ForgeTools.cursor.z === 12 && ForgeTools.cursor.y === 0, JSON.stringify(ForgeTools.cursor));
  ForgeTools.camera.x = -13.74; ForgeTools.snapIndex = 1;
  ForgeTools.updateCursor();
  check('snap 1 m rounds to whole metres', ForgeTools.cursor.x === -14, ForgeTools.cursor.x);
  ForgeTools.snapIndex = 0;
  ForgeTools.camera.x = 0; ForgeTools.camera.z = 0;
  ForgeTools.updateCursor();
  check('over the raised platform the cursor stands on its top', ForgeTools.cursor.y === 2, JSON.stringify(ForgeTools.cursor));
  ForgeTools.setLevel(5);
  ForgeTools.camera.x = -14; ForgeTools.camera.z = 12; ForgeTools.updateCursor();
  check('the level raises the ground plane the cursor lands on', ForgeTools.cursor.y === 5, ForgeTools.cursor.y);
  ForgeTools.setLevel(0);

  const count = Forge.count();
  ForgeTools.camera.x = -14; ForgeTools.camera.z = 12; ForgeTools.updateCursor();
  check('placing a box adds one brush at the cursor on the floor', ForgeTools.place() === Forge.map.brushes.length - 1 && Forge.count() === count + 1);
  const placed = Forge.selected();
  check('the new box is 2 m wide, sits on the floor and is selected', placed.shape === 'box' && placed.max[0] - placed.min[0] === 2 && placed.min[1] === 0 && placed.max[1] === 2 && Forge.selection.list === 'brushes', JSON.stringify(placed));
  ForgeTools.command('rotate');
  check('turning the stamp swaps width and depth of the next box', ForgeTools.turns === 1 && ForgeTools.layout(forgeToolById('box'))[3] - ForgeTools.layout(forgeToolById('box'))[0] === 2);
  ForgeTools.stamp.sizes.box = [4, 2, 2];
  ForgeTools.turns = 0;
  const wide = ForgeTools.layout(forgeToolById('box'));
  const wideSize = wide[3] - wide[0];
  ForgeTools.turns = 1;
  const deep = ForgeTools.layout(forgeToolById('box'));
  check('width and depth swap with a quarter turn', wideSize === 4 && deep[3] - deep[0] === 2 && deep[5] - deep[2] === 4);
  ForgeTools.turns = 0; ForgeTools.stamp.sizes.box = [2, 2, 2];

  for (const [tool, list] of [['ramp', 'brushes'], ['spawn', 'spawns'], ['item', 'items'], ['objective', 'objectives'], ['zone', 'zones'], ['trigger', 'triggers'], ['light', 'lights'], ['hint', 'navHints']]) {
    ForgeTools.setTool(tool);
    const length = Forge.map[list].length;
    ForgeTools.place();
    check('the ' + tool + ' tool places one ' + FORGE_KINDS[list].label, Forge.map[list].length === length + 1 && Forge.selection.list === list);
  }
  check('a ramp is placed with a direction from the stamp', Forge.map.brushes.some((brush) => brush.shape === 'ramp' && brush.dir === '+z'));
  ForgeTools.setTool('trigger'); ForgeTools.setOption('triggerKind', 'jumppad'); ForgeTools.place();
  check('a jump pad is placed with a target and a peak', (() => { const pad = Forge.selected(); return pad.kind === 'jumppad' && forgeTriple(pad.target) && pad.peak > 0; })());
  ForgeTools.setOption('triggerKind', 'teleporter'); ForgeTools.place();
  check('a teleporter is placed with an exit and a yaw', (() => { const tele = Forge.selected(); return tele.kind === 'teleporter' && forgeTriple(tele.exit) && typeof tele.yaw === 'number'; })());
  ForgeTools.setOption('triggerKind', 'hazard'); ForgeTools.place();
  check('a hazard is placed with damage and an element', Forge.selected().damage > 0 && MapRules.elements.includes(Forge.selected().element));
  ForgeTools.setTool('objective'); ForgeTools.setOption('objectiveKind', 'payloadPath'); ForgeTools.place();
  check('a payload path starts with one point and can be extended', Forge.selected().path.length === 1 && (ForgeTools.camera.x += 6, ForgeTools.updateCursor(), ForgeTools.addPathPoint()) && Forge.selected().path.length === 2);
  ForgeTools.setOption('objectiveKind', 'flag'); ForgeTools.setOption('objectiveTeam', 1); ForgeTools.place();
  check('a flag takes the stamp team', Forge.selected().kind === 'flag' && Forge.selected().team === 1 && Forge.selected().id === 'flag1');
  ForgeTools.place();
  check('objective ids stay unique', Forge.selected().id === 'flag2');
  ForgeTools.setTool('spawn'); ForgeTools.turns = 2; ForgeTools.place();
  check('a spawn takes its yaw from the stamp turns', Forge.selected().yaw === 180 && ForgeTools.turns === 2);
  ForgeTools.turns = 0;
  ForgeTools.setTool('item'); ForgeTools.cycleOption(1, 0);
  ForgeTools.place();
  check('an item takes its key and group from the item list', MapRules.groupOf(Forge.selected().item) === Forge.selected().group && Forge.selected().item !== 'healthpack');
  ForgeTools.setTool('zone'); ForgeTools.place(); ForgeTools.place();
  check('zone names stay unique', Forge.map.zones.filter((zone) => zone.name === 'Zone').length === 1 && Forge.map.zones.some((zone) => zone.name === 'Zone 2'));

  // picking and grabbing
  Forge.clearSelection();
  ForgeTools.setTool('select');
  forgeLookDown(30);
  ForgeTools.camera.x = Forge.map.items[0].x; ForgeTools.camera.z = Forge.map.items[0].z; ForgeTools.camera.y = Forge.map.items[0].y + 12;
  ForgeTools.pointer.centre = true;
  ForgeTools.updateCursor();
  check('the object under the pointer is the hover', ForgeTools.hover.list !== '' && ForgeTools.hover.distance > 0, JSON.stringify(ForgeTools.hover));
  const hovered = { list: ForgeTools.hover.list, index: ForgeTools.hover.index };
  ForgeTools.command('primary');
  check('the select tool selects what is under the pointer', Forge.selection.list === hovered.list && Forge.selection.index === hovered.index);
  const picked = { list: Forge.selection.list, index: Forge.selection.index };
  const firstPosition = JSON.stringify(Forge.selected());
  check('grab starts only with a selection and a cursor', ForgeTools.command('grab') && ForgeTools.grab.active);
  ForgeTools.camera.x += 4; ForgeTools.updateCursor();
  check('while grabbing the object follows the cursor without changing the map', ForgeTools.grab.dx === 4 && JSON.stringify(Forge.selected()) === firstPosition, ForgeTools.grab.dx);
  const historyBefore = Forge.history.position;
  ForgeTools.command('primary');
  check('dropping moves the object once (one undo step)', !ForgeTools.grab.active && Forge.history.position === historyBefore + 1 && JSON.stringify(Forge.selected()) !== firstPosition);
  Forge.undo();
  check('undo puts the dropped object back', JSON.stringify(Forge.map[picked.list][picked.index]) === firstPosition);
  ForgeTools.command('grab'); ForgeTools.camera.x += 2; ForgeTools.updateCursor(); ForgeTools.command('secondary');
  check('delete while grabbing cancels the grab instead of deleting', !ForgeTools.grab.active && JSON.stringify(Forge.map[picked.list][picked.index]) === firstPosition);
  const objects = Forge.count();
  ForgeTools.command('secondary');
  check('delete removes the selection', Forge.count() === objects - 1);
  Forge.clearSelection();
  forgeLookDown(14);
  ForgeTools.camera.x = Forge.map.items[0].x; ForgeTools.camera.z = Forge.map.items[0].z; ForgeTools.updateCursor();
  const itemsBefore = Forge.map.items.length;
  ForgeTools.command('secondary');
  check('with nothing selected delete removes the object under the pointer', ForgeTools.hover.list === '' && Forge.map.items.length === itemsBefore - 1, itemsBefore + ' -> ' + Forge.map.items.length);
  ForgeTools.command('undo');
  check('the undo command brings it back', Forge.map.items.length === itemsBefore);
  ForgeTools.command('snap');
  check('the snap command cycles 0.5, 1 and 2 m', ForgeTools.snap() === 1 && (ForgeTools.command('snap'), ForgeTools.snap() === 2) && (ForgeTools.command('snap'), ForgeTools.snap() === 0.5));
  ForgeTools.command('tool:ramp');
  check('tool commands select tools', ForgeTools.tool === 'ramp');
  ForgeTools.command('toolNext');
  check('toolNext moves to the next tool', ForgeTools.tool === 'spawn');
  check('unknown commands do nothing', ForgeTools.command('nope') === false && ForgeTools.command('tool:nope') === false);
  forgeEditorOff();
});

Test.add('forge', (check) => {
  // ---- Devices: keyboard + mouse, gamepad, touch ----
  forgeEditorOff();
  Forge.newFrom({ kind: 'template', id: 'arena' });
  ForgeTools.attach();
  ForgeTools.setTool('box');
  const key = (code, extra) => Object.assign({ code, target: document.body, repeat: false, ctrlKey: false, shiftKey: false, metaKey: false, preventDefault() { this.prevented = true; } }, extra);
  const w = key('KeyW');
  ForgeTools.onKeyDown(w);
  check('W is held and the browser default is stopped', ForgeTools.held.forward === true && w.prevented === true);
  ForgeTools.onKeyUp(key('KeyW'));
  check('releasing W stops the move', ForgeTools.held.forward === false);
  ForgeTools.onKeyDown(key('ShiftLeft'));
  check('shift flies fast', ForgeTools.held.fast === true);
  ForgeTools.onKeyUp(key('ShiftLeft'));
  forgeLookDown(30); ForgeTools.camera.x = -14; ForgeTools.camera.z = 12; ForgeTools.updateCursor();
  const count = Forge.count();
  ForgeTools.onKeyDown(key('Enter'));
  check('a placing key adds an object', Forge.count() === count + 1);
  ForgeTools.onKeyDown(key('KeyZ', { ctrlKey: true }));
  check('Ctrl+Z undoes', Forge.count() === count);
  ForgeTools.onKeyDown(key('KeyY', { ctrlKey: true }));
  check('Ctrl+Y redoes', Forge.count() === count + 1);
  ForgeTools.onKeyDown(key('KeyZ', { ctrlKey: true }));
  ForgeTools.onKeyDown(key('KeyZ', { ctrlKey: true, shiftKey: true }));
  check('Ctrl+Shift+Z redoes too', Forge.count() === count + 1);
  ForgeTools.onKeyDown(key('KeyR'));
  check('R turns the stamp', ForgeTools.turns === 1);
  ForgeTools.onKeyDown(key('Digit4'));
  check('number keys choose the tool', ForgeTools.tool === 'spawn');
  ForgeTools.onKeyDown(key('Enter', { repeat: true }));
  check('a held placing key does not repeat', Forge.count() === count + 1);
  ForgeTools.onKeyDown(key('KeyZ', { ctrlKey: true, repeat: true }));
  check('a held undo key repeats', Forge.count() === count);
  const field = makeElement('input');
  field.type = 'text';
  const typed = key('KeyW', { target: field });
  ForgeTools.onKeyDown(typed);
  check('typing in a text field does not fly the camera', !typed.prevented);
  ForgeTools.releaseAll();

  // mouse
  const canvasEvent = (extra) => Object.assign({ target: { id: 'view' }, clientX: window.innerWidth / 2, clientY: window.innerHeight / 2, button: 0, pointerType: 'mouse', pointerId: 1, deltaY: -100, shiftKey: false, preventDefault() {} }, extra);
  ForgeTools.setTool('hint');
  forgeLookDown(30); ForgeTools.camera.x = 6; ForgeTools.camera.z = 6;
  const hints = Forge.map.navHints.length;
  ForgeTools.onPointerDown(canvasEvent({}));
  check('a left click on the view places at the pointer', Forge.map.navHints.length === hints + 1 && ForgeTools.pointer.centre === false);
  ForgeTools.onPointerDown(canvasEvent({ target: { id: 'something else' } }));
  check('a click on a panel does not place', Forge.map.navHints.length === hints + 1);
  const yaw = ForgeTools.camera.yaw;
  ForgeTools.onPointerDown(canvasEvent({ button: 2, clientX: 100, clientY: 100 }));
  ForgeTools.onPointerMove(canvasEvent({ clientX: 160, clientY: 100 }));
  ForgeTools.onPointerUp(canvasEvent({ button: 2 }));
  check('dragging with the right button looks around (right turns the view right)', ForgeTools.camera.yaw < yaw && !ForgeTools.drag.look);
  const turns = ForgeTools.turns;
  ForgeTools.onWheel(canvasEvent({}));
  check('the wheel turns the stamp', ForgeTools.turns === (turns + 1) % 4);
  ForgeTools.onWheel(canvasEvent({ shiftKey: true }));
  check('shift + wheel raises the level', ForgeTools.elevation === 0.5);
  ForgeTools.setLevel(0);

  // gamepad
  const pad = forgeFakePad();
  ForgeTools.setTool('box');
  forgeLookDown(30); ForgeTools.camera.x = -14; ForgeTools.camera.z = 12;
  forgeWithPad(pad, () => {
    pad.axes[1] = -1;
    ForgeTools.frame(0.1);
    check('the left stick flies along the view (down, here)', ForgeTools.camera.y < 30 && ForgeTools.pointer.centre === true, ForgeTools.camera.y);
    pad.axes[1] = 0; pad.axes[2] = 1;
    const yawBefore = ForgeTools.camera.yaw;
    ForgeTools.frame(0.1);
    check('the right stick turns the view', ForgeTools.camera.yaw < yawBefore);
    pad.axes[2] = 0; pad.axes[3] = 1;
    ForgeTools.camera.pitch = 0;
    ForgeTools.frame(0.1);
    check('pushing the right stick down looks down', ForgeTools.camera.pitch < 0, ForgeTools.camera.pitch);
    pad.axes[3] = 0;
    forgeLookDown(30); ForgeTools.camera.x = -14; ForgeTools.camera.z = 12; ForgeTools.pointer.centre = false;
    const objects = Forge.count();
    pad.buttons[0] = { pressed: true, value: 1 };
    ForgeTools.frame(0.016);
    check('button A places at the screen centre', Forge.count() === objects + 1 && ForgeTools.pointer.centre === true);
    ForgeTools.frame(0.016);
    check('a held button acts once', Forge.count() === objects + 1);
    pad.buttons[0] = { pressed: false, value: 0 };
    ForgeTools.frame(0.016);
    pad.buttons[8] = { pressed: true, value: 1 };
    ForgeTools.frame(0.016);
    check('the View button undoes', Forge.count() === objects);
    pad.buttons[8] = { pressed: false, value: 0 };
    ForgeTools.frame(0.016);
    pad.buttons[15] = { pressed: true, value: 1 };
    ForgeTools.frame(0.016);
    check('d-pad right redoes', Forge.count() === objects + 1);
    pad.buttons[15] = { pressed: false, value: 0 };
    ForgeTools.frame(0.016);
    const tool = ForgeTools.tool;
    pad.buttons[13] = { pressed: true, value: 1 };
    ForgeTools.frame(0.016);
    pad.buttons[13] = { pressed: false, value: 0 };
    check('d-pad down chooses the next tool', ForgeTools.tool !== tool);
    ForgeTools.setTool('item');
    const item = ForgeTools.stamp.itemKey;
    pad.buttons[5] = { pressed: true, value: 1 };
    ForgeTools.frame(0.016);
    pad.buttons[5] = { pressed: false, value: 0 };
    check('the right bumper cycles the tool option', ForgeTools.stamp.itemKey !== item);
    let menu = 0;
    ForgeTools.menuRequest = () => menu++;
    pad.buttons[9] = { pressed: true, value: 1 };
    ForgeTools.frame(0.016);
    check('Start asks for the menu', menu === 1);
    ForgeTools.menuRequest = null;
    pad.buttons[9] = { pressed: false, value: 0 };
    pad.buttons[7] = { pressed: true, value: 1 };
    const y = ForgeTools.camera.y;
    ForgeTools.frame(0.1);
    check('the right trigger flies up', ForgeTools.camera.y > y);
  });

  // the editor screen, its dialogs, and the touch buttons
  ForgeTools.detach();
  check('the main menu offers the map editor', MAIN_MENU_ENTRIES.some((entry) => entry.screen === 'forge') && Ui.screens.has('forge'));
  Ui.open('main');
  Forge.clearSelection();
  check('the main menu button is enabled', Array.from(document.querySelectorAll('.ui-main .ui-button')).some((button) => button.textContent === 'Map editor' && !button.disabled));
  check('the editor screen opens and takes the camera', Ui.open('forge') && ForgeTools.active && Ui.current() === 'forge');
  check('the pad menu commands are not for the panels while the editor is open', Ui.screens.get('forge').onCommand('accept') === true);
  const root = document.querySelector('.ui-forge');
  check('the screen shows the budget, the tools and the properties', /Objects \d+ \/ 400/.test(root.textContent) && root.textContent.includes('Nav hint') && root.textContent.includes('Nothing selected'));
  Forge.select('spawns', 0);
  check('selecting an object shows its properties', document.querySelector('.fg-right').textContent.includes('Spawn #0') && document.querySelector('.fg-right').textContent.includes('Team'));
  for (const list of FORGE_LIST_KEYS) {
    if (Forge.map[list].length === 0) Forge.add(list, list === 'triggers' ? { kind: 'killzone', min: [0, 0, 0], max: [2, 2, 2] } : list === 'zones' ? { name: 'Z', min: [0, 0, 0], max: [2, 2, 2] } : MapKit.hint(['cover', 0, 0, 0]));
    Forge.select(list, 0);
    check('properties of ' + list + ' build without errors', document.querySelector('.fg-right').children.length > 3);
  }
  const holdButton = Array.from(document.querySelectorAll('.fg-touch .ui-button')).find((button) => button.textContent === 'Fwd');
  check('the touch layer has the fly buttons and the place button', !!holdButton && Array.from(document.querySelectorAll('.fg-touch .ui-button')).some((button) => button.textContent === 'Place'));
  holdButton.dispatchEvent(new Event('pointerdown', { cancelable: true }));
  check('pressing a touch button flies while held', ForgeTools.held.forward === true);
  holdButton.dispatchEvent(new Event('pointerup'));
  check('releasing it stops', ForgeTools.held.forward === false);
  const placeButton = Array.from(document.querySelectorAll('.fg-touch .ui-button')).find((button) => button.textContent === 'Place');
  ForgeTools.setTool('hint'); forgeLookDown(30);
  const hintCount = Forge.map.navHints.length;
  placeButton.click();
  check('the touch place button places at the cursor', Forge.map.navHints.length === hintCount + 1);
  const touch = (type, id, x, y) => ForgeTools[type](canvasEvent({ pointerType: 'touch', pointerId: id, clientX: x, clientY: y }));
  touch('onPointerDown', 1, 300, 300);
  check('one finger moves the cursor and does not place', Forge.map.navHints.length === hintCount + 1 && ForgeTools.pointer.ndcX < 0 && !ForgeTools.drag.look);
  touch('onPointerDown', 2, 500, 300);
  const touchYaw = ForgeTools.camera.yaw;
  touch('onPointerMove', 2, 560, 300);
  check('two fingers look around', ForgeTools.drag.look && ForgeTools.camera.yaw < touchYaw);
  touch('onPointerUp', 2, 560, 300); touch('onPointerUp', 1, 300, 300);
  check('lifting the fingers ends the look', !ForgeTools.drag.look && ForgeTools.drag.touches === 0);
  for (const name of ['forgeMenu', 'forgeNew', 'forgeMaps', 'forgeCheck', 'forgeCode', 'forgePlay', 'forgeSettings', 'forgeModes']) {
    check('dialog ' + name + ' opens', Ui.open(name) && Ui.current() === name);
    Ui.pop();
  }
  check('closing the dialogs shows the editor again', Ui.current() === 'forge');
  Ui.pop();
  check('closing the editor gives the camera back', !ForgeTools.active && Render.cameraOverride !== ForgeTools.cameraHook);
  forgeEditorOff();
});

Test.add('forge', (check) => {
  // ---- Dialogs that change things ----
  forgeEditorOff();
  Forge.newFrom({ kind: 'empty' });
  Ui.open('forge');
  Ui.open('forgeSettings');
  const labels = () => Array.from(document.querySelectorAll('.ui-forgeSettings .ui-row')).map((row) => row.textContent);
  check('map settings list name, theme, size, height, class and modes', ['Name', 'Theme', 'Width and depth', 'Height', 'Sightline class', 'Modes'].every((label) => labels().some((text) => text.startsWith(label))));
  const themeButton = Array.from(document.querySelectorAll('.ui-forgeSettings .ui-cycle')).find((button) => button.textContent === 'Foundry');
  themeButton.click();
  check('changing the theme changes the sky too and reloads the editor world', Forge.map.theme === 'ruins' && Forge.map.sky.top !== forgeSkyFor('foundry').top && World.map.theme === 'ruins', Forge.map.theme);
  const input = document.querySelector('.ui-forgeSettings .fg-name');
  input.value = 'Fresh name';
  input.dispatchEvent(new Event('change'));
  check('renaming goes through the model', Forge.map.name === 'Fresh name');
  Forge.undo(); Forge.undo();
  check('settings are undoable', Forge.map.theme === 'foundry' && Forge.map.name === 'Untitled map');
  Ui.pop();
  Forge.newFrom({ kind: 'template', id: 'yard' });
  Ui.open('forgeModes');
  const rows = Array.from(document.querySelectorAll('.ui-forgeModes .ui-row'));
  check('the mode list shows every mode with what it lacks', rows.length > 10 && rows.some((row) => row.textContent.includes('needs')) && rows.some((row) => row.textContent.startsWith(CAT.modes.byId('tdm').name)), rows.map((row) => row.textContent).join(' | ').slice(0, 300));
  Ui.pop();
  Ui.open('forgeCheck');
  check('the check screen reports the template as sound', document.querySelector('.ui-forgeCheck').textContent.includes('No problems'));
  Ui.pop();
  Forge.map.spawns[0].y = 5;
  Ui.open('forgeCheck');
  const problem = document.querySelector('.ui-forgeCheck .fg-problem');
  check('a problem is a button', !!problem);
  problem.click();
  check('tapping a problem returns to the editor with the object selected and the camera on it', Ui.current() === 'forge' && Forge.selection.list === 'spawns' && Forge.selection.index === 0
    && Math.abs(ForgeTools.camera.x + Math.sin(ForgeTools.camera.yaw) * FORGE_FOCUS_BACK - Forge.map.spawns[0].x) < 1e-6);
  Ui.open('forgeCode');
  document.querySelector('.ui-forgeCode .fg-code').value = 'not a code';
  Array.from(document.querySelectorAll('.ui-forgeCode .ui-button')).find((button) => button.textContent === 'Import').click();
  const confirmOpen = Ui.current() === 'confirm';
  if (confirmOpen) Array.from(document.querySelectorAll('.ui-confirm .ui-button')).find((button) => button.textContent === 'Import').click();
  check('a bad code shows its message and stays on the screen', Ui.current() === 'forgeCode' && document.querySelector('.ui-forgeCode .fg-error').textContent.length > 0);
  Array.from(document.querySelectorAll('.ui-forgeCode .ui-button')).find((button) => button.textContent === 'Make code').click();
  check('Make code fills the box with a code', /^CTKMAP1-/.test(document.querySelector('.ui-forgeCode .fg-code').value));
  Ui.pop();
  Forge.saveCurrent('Listed');
  Ui.open('forgeMaps');
  const listed = () => Array.from(document.querySelectorAll('.ui-forgeMaps .fg-name')).map((field) => field.value);
  check('the map list shows saved maps and the space used', listed().join() === 'Listed' && /KB/.test(document.querySelector('.ui-forgeMaps').textContent));
  Array.from(document.querySelectorAll('.ui-forgeMaps .ui-button')).find((button) => button.textContent === 'Delete').click();
  check('deleting asks first', Ui.current() === 'confirm' && Forge.saved().length === 1);
  Array.from(document.querySelectorAll('.ui-confirm .ui-button')).find((button) => button.textContent === 'Delete').click();
  check('after the answer the map is gone', Forge.saved().length === 0 && listed().length === 0);
  forgeEditorOff();
});

Test.add('forge', (check) => {
  // ---- Test-play and drawing ----
  forgeEditorOff();
  Forge.newFrom({ kind: 'template', id: 'arena' });
  ForgeTools.attach();
  check('the arena can be test-played as free for all but not as capture the flag', ForgeTools.playableModes().includes('ffa') && !ForgeTools.playableModes().includes('ctf'), ForgeTools.playableModes().join());
  Forge.newFrom({ kind: 'template', id: 'yard' });
  check('the yard offers team modes and capture the flag', ['tdm', 'ctf'].every((mode) => ForgeTools.playableModes().includes(mode)), ForgeTools.playableModes().join());
  Forge.newFrom({ kind: 'empty' });
  check('an empty map offers no mode', ForgeTools.playableModes().length === 0);
  Forge.add('spawns', MapKit.spawns([[-1, [], [[0, 0, 0, 0]]]])[0]);
  check('a map with one spawn offers free-for-all modes but none that need objectives', ForgeTools.playableModes().includes('ffa') && !ForgeTools.playableModes().includes('dom'));
  check('test-play refuses a mode the map cannot serve', ForgeTools.testPlay('ctf') === false && !Game.match && /objectives/.test(Forge.message));
  Forge.newFrom({ kind: 'template', id: 'arena' });
  ForgeTools.attach();
  const before = forgeMapJson();
  check('test-play starts a match on the edited map', ForgeTools.testPlay('ffa') === true && Game.state === 'playing' && !!Game.match, Game.state);
  const played = Game.match.map;
  check('the match plays the edited map itself', played && forgeSameMap(played, Forge.toMap()) === '' && played.brushes.length === Forge.map.brushes.length && Game.match.setup.mode === 'ffa');
  check('the editor is off during the match', !ForgeTools.active && ForgeTools.returning && Render.cameraOverride !== ForgeTools.cameraHook);
  check('the match world is the edited map', World.brushes.length === Forge.map.brushes.length);
  Sim.run(240);
  check('the match runs on the edited map', Actors.alive[Game.playerId] === 1 || Game.playerId >= 0);
  Game.stop();
  check('stopping the match brings the editor back', ForgeTools.active && !ForgeTools.returning && Game.state === 'menu');
  check('the editor state is intact after the match', forgeMapJson() === before && Forge.canUndo() === false && World.brushes.length === 0 && World.map.id === 'forge');
  Forge.add('navHints', MapKit.hint(['cover', 0, 0, 0]));
  check('editing continues after the match', Forge.canUndo() && Forge.dirty);
  ForgeTools.detach();

  // a team mode from the yard
  Forge.newFrom({ kind: 'template', id: 'yard' });
  ForgeTools.attach();
  check('test-play starts capture the flag on the yard', ForgeTools.testPlay('ctf') === true && Game.match.map.objectives.length === 4);
  Game.stop();
  check('and returns again', ForgeTools.active);
  ForgeTools.detach();
  Game.stop();
  check('a match stop without test-play does not open the editor', !ForgeTools.active);

  // saved map in a normal match
  Forge.newFrom({ kind: 'template', id: 'arena' });
  Forge.saveCurrent('Played');
  Game.start({ mode: 'ffa', map: 'user1', seed: 5 });
  check('a saved map starts as a normal match map by id', Game.match.map && Game.match.map.id === 'user1' && World.brushes.length === Forge.map.brushes.length);
  Game.stop();

  // drawing
  Forge.newFrom({ kind: 'template', id: 'yard' });
  ForgeTools.attach();
  forgeLookDown(30);
  const batch = forgeFakeBatch();
  ForgeTools.draw(batch);
  check('the source draws every brush as a box or a wedge', batch.shapes.box >= Forge.map.brushes.length && (batch.shapes.wedge || 0) === 0, JSON.stringify(batch.shapes));
  check('the source draws spawns, items, objectives and lights', batch.shapes.capsule === Forge.map.spawns.length && batch.shapes.sphere >= Forge.map.items.length + Forge.map.lights.length && batch.shapes.ring >= Forge.map.objectives.length);
  Forge.newFrom({ kind: 'template', id: 'arena' });
  const arena = forgeFakeBatch();
  ForgeTools.draw(arena);
  check('ramps are drawn as wedges', arena.shapes.wedge === 4, JSON.stringify(arena.shapes));
  ForgeTools.view.zones = true;
  const zoned = forgeFakeBatch();
  ForgeTools.draw(zoned);
  check('showing the zones adds their outlines', zoned.count > arena.count + 9 * 12 - 1);
  ForgeTools.view.zones = false;
  Forge.newFrom({ kind: 'empty' });
  while (Forge.count() < FORGE_BUDGET) Forge.add('navHints', MapKit.hint(['cover', 0, 0, 0]));
  const full = forgeFakeBatch();
  ForgeTools.draw(full);
  check('a full map stays inside one frame of instances', full.count < 1024 * 2, full.count);
  ForgeTools.detach();
  const none = forgeFakeBatch();
  ForgeTools.draw(none);
  check('the source draws nothing while the editor is closed', none.count === 0);
  forgeEditorOff();
});

// A longer randomised sweep: many seeds of random edits with undo / redo, saves and codes. Returns { seeds, failures }.
DebugApi.forge = { Forge, ForgeTools };
DebugApi.forgeSweep = (seeds) => {
  const failures = [];
  for (let seed = 1; seed <= (seeds || 100); seed++) {
    const problem = forgeRoundTrip(seed, 80);
    if (problem) { failures.push('seed ' + seed + ': ' + problem); continue; }
    const code = Forge.exportCode();
    const back = Forge.decodeCode(code);
    if (back.error || forgeSameMap(Forge.toMap(), back.map)) failures.push('seed ' + seed + ': code round trip ' + (back.error || forgeSameMap(Forge.toMap(), back.map)));
  }
  return { seeds: seeds || 100, failures };
};
