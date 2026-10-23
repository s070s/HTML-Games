// ==== S20 TESTS: MAP EDITOR ====
// Group 'mapEditor': budget, undo / redo, serialising and validation, saves and codes, tools (cursor, placing, grab), the three input devices,
// the screens, runtime maps and test-play. A longer randomised sweep is behind __CTK.mapEditorSweep(seeds).

// Two maps are the same when every field is (the order of the top-level keys does not matter).
function mapEditSameMap(a, b) {
  const keys = new Set(Object.keys(a).concat(Object.keys(b)));
  for (const key of keys) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return key;
  return '';
}
const mapEditMapJson = () => JSON.stringify(MapEditor.map);
function mapEditRandomSource(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
const mapEditSnapped = (value) => Math.round(value * 2) / 2;
// The self-test can run from Help while the player has a map in the editor and saved maps registered: the first block keeps that state, the last puts it back.
let mapEditKept = null;
function mapEditKeepEditor() {
  const tools = MapEditorTools;
  mapEditKept = { device: Input.device, map: MapEditor.map, slotId: MapEditor.slotId, dirty: MapEditor.dirty, history: MapEditor.history, selection: Object.assign({}, MapEditor.selection), runtime: Maps.runtime.slice(),
    tools: { tool: tools.tool, elevation: tools.elevation, snapIndex: tools.snapIndex, turns: tools.turns, cameraPlaced: tools.cameraPlaced, stamp: mapEditClone(tools.stamp),
      view: Object.assign({}, tools.view), camera: Object.assign({}, tools.camera) } };
  MapEditor.history = { entries: new Array(MAPEDIT_HISTORY_SIZE).fill(null), start: 0, length: 0, position: 0 };
}
function mapEditRestoreEditor() {
  if (!mapEditKept) return;
  const kept = mapEditKept, tools = MapEditorTools;
  mapEditKept = null;
  mapEditEditorOff();
  Input.setDevice(kept.device);   // the device tests above act as a touch finger and a pad: other groups (the HUD layout) read the device
  MapEditor.map = kept.map; MapEditor.slotId = kept.slotId; MapEditor.dirty = kept.dirty; MapEditor.history = kept.history;
  Object.assign(MapEditor.selection, kept.selection);
  Maps.runtime.push(...kept.runtime);
  Object.assign(tools, { tool: kept.tools.tool, elevation: kept.tools.elevation, snapIndex: kept.tools.snapIndex, turns: kept.tools.turns, cameraPlaced: kept.tools.cameraPlaced });
  Object.assign(tools.stamp, kept.tools.stamp);
  Object.assign(tools.view, kept.tools.view);
  Object.assign(tools.camera, kept.tools.camera);
}
function mapEditEditorOff() {
  MapEditorTools.detach();
  MapEditorPlay.returning = false; MapEditorPlay.returnDue = false;
  Ui.closeAll();
  Maps.runtime.length = 0;
}
// One random edit (placing, moving, turning, resizing, deleting, recolouring, renaming, theme); returns true when it changed the map.
function mapEditRandomEdit(random) {
  const before = mapEditMapJson(), pick = Math.floor(random() * 11), x = mapEditSnapped((random() - 0.5) * 30), z = mapEditSnapped((random() - 0.5) * 30);
  const lists = MAP_REQUIRED_LISTS.filter((list) => MapEditor.map[list].length);
  const list = lists[Math.floor(random() * lists.length)];
  if (list) MapEditor.select(list, Math.floor(random() * MapEditor.map[list].length));
  if (pick === 0) MapEditor.add('brushes', MapKit.brush(['metal', x, 0, z, x + 2, 2, z + 2]));
  else if (pick === 1) MapEditor.add('spawns', MapKit.spawns([[-1, [], [[x, 0, z, 90]]]])[0]);
  else if (pick === 2) MapEditor.add('items', MapKit.item(['ammobox', x, 0, z]));
  else if (pick === 3) MapEditor.nudgeSelected(1, 0, -1);
  else if (pick === 4) MapEditor.turnSelected();
  else if (pick === 5) MapEditor.resizeSelected(1, 0.5);
  else if (pick === 6) MapEditor.deleteSelected();
  else if (pick === 7) MapEditor.editSelected((copy) => { if (copy.material) copy.material = copy.material === 'wood' ? 'glass' : 'wood'; else if (copy.team !== undefined) copy.team = 1; });
  else if (pick === 8) MapEditor.rename('Name ' + Math.floor(random() * 1000));
  else if (pick === 9) MapEditor.setTheme(MapRules.themes[Math.floor(random() * MapRules.themes.length)]);
  else MapEditor.group(() => { MapEditor.add('lights', MapKit.light([x, 3, z, 0xffffff, 10])); MapEditor.add('navHints', MapKit.hint(['cover', x, 0, z])); });
  return mapEditMapJson() !== before;
}
// Does a run of random edits followed by all-undo and all-redo restore the exact map at every step? Returns '' or the first failing step.
function mapEditRoundTrip(seed, steps) {
  const random = mapEditRandomSource(seed);
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  const snapshots = [mapEditMapJson()];
  for (let i = 0; i < steps; i++) if (mapEditRandomEdit(random)) snapshots.push(mapEditMapJson());
  for (let i = snapshots.length - 1; i > 0; i--) {
    if (!MapEditor.undo() || mapEditMapJson() !== snapshots[i - 1]) return 'undo step ' + i;
  }
  for (let i = 1; i < snapshots.length; i++) {
    if (!MapEditor.redo() || mapEditMapJson() !== snapshots[i]) return 'redo step ' + i;
  }
  return MapEditor.canRedo() ? 'redo left over' : '';
}
// A fake pad for the pad reader: buttons and axes as the Gamepad API reports them.
function mapEditFakePad() {
  return { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
}
function mapEditWithPad(pad, run) {
  const connected = PadInput.connected, activePad = PadInput.activePad;
  PadInput.connected = 1; PadInput.activePad = () => pad;
  try { run(); } finally { PadInput.connected = connected; PadInput.activePad = activePad; }
}
const mapEditFakeBatch = () => ({ count: 0, shapes: {}, mesh(shape) { this.count++; this.shapes[shape] = (this.shapes[shape] || 0) + 1; return 0; } });
// A batch like the renderer's: MAPEDIT_BATCH_SHAPE_CAPACITY instances of each shape, the rest is dropped and counted. selected: meshes in the selection colour.
function mapEditCappedBatch() {
  const mark = mapEditRgb(MAPEDIT_PALETTE.selected);
  return { shapes: {}, dropped: 0, selected: 0, bars: new Set(),
    mesh(shape, x, y, z, yaw, pitch, sx, sy, sz, r, g, b, emissive) {
      const count = this.shapes[shape] || 0;
      if (count >= MAPEDIT_BATCH_SHAPE_CAPACITY) { this.dropped++; return -1; }
      this.shapes[shape] = count + 1;
      this.bars.add([shape, x, y, z, sx, sy, sz].join());
      if (shape === 'box' && r === mark[0] && g === mark[1] && b === mark[2] && emissive === 1) this.selected++;
      return 0;
    } };
}
// Points the editor camera straight down at the middle of the map and reads the cursor under the screen centre.
function mapEditLookDown(height) {
  Object.assign(MapEditorTools.camera, { x: 0, y: height, z: 0, yaw: 0, pitch: -Math.PI / 2 + 0.001 });
  MapEditorTools.pointer.centre = true;
  MapEditorTools.updateCursor();
}

Test.add('mapEditor', (check) => {
  // ---- Start points, templates, built-in copies ----
  mapEditKeepEditor();
  mapEditEditorOff();
  const empty = MapEditor.newFrom({ kind: 'empty' });
  check('empty map starts with one floor brush', !empty.error && MapEditor.count() === 1 && MapEditor.map.brushes[0].shape === 'box' && MapEditor.dirty);
  for (const template of MAPEDIT_TEMPLATES) {
    MapEditor.newFrom({ kind: 'template', id: template.id });
    const problems = Maps.validate(MapEditor.toMap());
    check('template ' + template.id + ' passes Maps.validate', problems.length === 0, problems.join(' | '));
    check('template ' + template.id + ' lists its modes', MapEditor.map.modes.length > 0 && MapEditor.map.modes.every((mode) => !!MapRules.rule(mode)), MapEditor.map.modes.join());
    check('template ' + template.id + ' is ready for its modes', MapEditor.map.modes.every((mode) => MapEditor.modeReady(MapEditor.toMap(), mode, true)), MapEditor.map.modes.map((mode) => MapEditor.modeNeeds(MapEditor.toMap(), mode)).join('|'));
  }
  check('unknown template and built-in are refused', MapEditor.build({ kind: 'template', id: 'nope' }).error && MapEditor.build({ kind: 'builtin', id: 'nope' }).error);
  const failures = [];
  for (const row of CAT.maps) {
    const made = MapEditor.newFrom({ kind: 'builtin', id: row.id });
    const copy = made.error ? null : MapEditor.toMap();
    const problems = copy ? Maps.validate(copy) : [made.error];
    const back = copy ? MapEditor.expand(MapEditor.compact(copy)) : { error: 'no copy' };
    const same = back.error ? back.error : mapEditSameMap(copy, back.map);
    if (problems.length || same) failures.push(row.id + ': ' + (problems[0] || '') + (same ? ' differs in ' + same : ''));
  }
  check('a copy of every built-in map serialises back to the same map and validates', failures.length === 0, failures.join(' | '));
  check('a copy is a draft, not a catalogue row', MapEditor.newFrom({ kind: 'builtin', id: 'spire' }) && MapEditor.map.id === MAPEDIT_DRAFT_ID && MapEditor.map.name.startsWith('Copy of') && Maps.get('spire').name === 'Foundry Spire');
  MapEditor.map.brushes[0].material = 'wood';
  check('editing a copy leaves the catalogue map alone', Maps.get('spire').brushes[0].material === 'concrete');

  // ---- Budget (MAP-014: 400 objects) ----
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  const start = MapEditor.count();
  let added = 0;
  while (MapEditor.count() < MAPEDIT_BUDGET) { MapEditor.add('navHints', MapKit.hint(['cover', 0, 0, 0])); added++; }
  check('the budget counts every list and reaches exactly 400', MapEditor.count() === MAPEDIT_BUDGET && added === MAPEDIT_BUDGET - start, MapEditor.count());
  const refused = MapEditor.add('items', MapKit.item(['ammobox', 1, 0, 1]));
  check('object 401 is refused with a message', refused === -1 && MapEditor.count() === MAPEDIT_BUDGET && /budget/i.test(MapEditor.message), MapEditor.message);
  MapEditor.select('navHints', 0);
  MapEditor.nudgeSelected(2, 0, 0);
  check('moving keeps the budget exact', MapEditor.count() === MAPEDIT_BUDGET);
  MapEditor.deleteSelected();
  check('deleting frees exactly one place', MapEditor.count() === MAPEDIT_BUDGET - 1 && MapEditor.budgetLeft() === 1);
  check('the freed place can be used once', MapEditor.add('items', MapKit.item(['ammobox', 1, 0, 1])) >= 0 && MapEditor.add('items', MapKit.item(['ammobox', 3, 0, 3])) === -1);
  MapEditor.undo(); MapEditor.undo();
  check('undoing the add and the delete restores the full map; refusals left no history', MapEditor.count() === MAPEDIT_BUDGET && MapEditor.map.items.length === 10, MapEditor.count());
  MapEditor.newFrom({ kind: 'empty' });
  for (let i = 0; i < MapRules.limits.lights; i++) MapEditor.add('lights', MapKit.light([i, 3, 0, 0xffffff, 8]));
  check('lights stop at the validator limit of 24', MapEditor.add('lights', MapKit.light([0, 3, 5, 0xffffff, 8])) === -1 && MapEditor.map.lights.length === MapRules.limits.lights);

  // ---- Undo / redo ----
  check('50 mixed edits undo and redo to the exact map JSON at every step', mapEditRoundTrip(7, 50) === '', mapEditRoundTrip(7, 50));
  MapEditor.newFrom({ kind: 'empty' });
  const ring = MapEditor.history.entries;
  const earlySnapshots = [];
  for (let i = 0; i < MAPEDIT_HISTORY_SIZE * 2 + 30; i++) {
    MapEditor.add('navHints', MapKit.hint(['cover', i * 0.01, 0, 0]));
    if (i === MAPEDIT_HISTORY_SIZE + 29) earlySnapshots.push(mapEditMapJson());
  }
  check('the history ring never grows past its size', MapEditor.history.length === MAPEDIT_HISTORY_SIZE && MapEditor.history.entries === ring && ring.length === MAPEDIT_HISTORY_SIZE, MapEditor.history.length);
  let undone = 0;
  while (MapEditor.undo()) undone++;
  check('only the newest ' + MAPEDIT_HISTORY_SIZE + ' edits can be undone, and that restores the older state', undone === MAPEDIT_HISTORY_SIZE && mapEditMapJson() === earlySnapshots[0], undone);
  let redone = 0;
  while (MapEditor.redo()) redone++;
  check('redo returns to the newest edit', redone === MAPEDIT_HISTORY_SIZE && MapEditor.map.navHints.length === MAPEDIT_HISTORY_SIZE * 2 + 30);
  MapEditor.undo();
  MapEditor.add('navHints', MapKit.hint(['sniper', 0, 0, 0]));
  check('a new edit ends the redo branch', !MapEditor.canRedo());
  MapEditor.newFrom({ kind: 'empty' });
  MapEditor.group(() => { MapEditor.add('navHints', MapKit.hint(['cover', 0, 0, 0])); MapEditor.add('navHints', MapKit.hint(['cover', 4, 0, 0])); });
  MapEditor.undo();
  check('a group of edits is one undo step', MapEditor.map.navHints.length === 0 && !MapEditor.canUndo());
  MapEditor.add('zones', { name: 'A', min: [0, 0, 0], max: [4, 4, 4] });
  MapEditor.select('zones', 0);
  MapEditor.deleteSelected();
  check('deleting clears the selection', MapEditor.selected() === null);
  MapEditor.undo();
  check('undoing a delete selects the object that came back', MapEditor.selected() && MapEditor.selected().name === 'A');
  mapEditEditorOff();
});

Test.add('mapEditor', (check) => {
  // ---- Geometry helpers ----
  MapEditor.newFrom({ kind: 'empty' });
  MapEditor.add('brushes', MapKit.brush(['wood', 0, 0, 0, 4, 2, 2, '+z']));
  MapEditor.select('brushes', 1);
  const box = MapEditor.bounds('brushes', MapEditor.selected(), new Float64Array(6));
  check('bounds of a box list are its min and max', box.join() === '0,0,0,4,2,2');
  MapEditor.turnSelected();
  const turned = MapEditor.selected();
  check('a quarter turn swaps width and depth around the centre and turns a ramp', turned.min.join() === '1,0,-1' && turned.max.join() === '3,2,3' && turned.dir === '+x', JSON.stringify(turned));
  MapEditor.turnSelected(); MapEditor.turnSelected(); MapEditor.turnSelected();
  check('four quarter turns are the identity', JSON.stringify(MapEditor.selected().min) === '[0,0,0]' && MapEditor.selected().dir === '+z');
  MapEditor.add('spawns', MapKit.spawns([[0, [], [[0, 0, 0, 270]]]])[0]);
  MapEditor.select('spawns', 0);
  MapEditor.turnSelected();
  check('a spawn turns by 90 degrees and wraps', MapEditor.selected().yaw === 0);
  check('a spawn has no size to change', !MapEditor.resizeSelected(0, 1));
  MapEditor.select('brushes', 1);
  check('a box grows along an axis and refuses to vanish', MapEditor.resizeSelected(1, 1) && MapEditor.selected().max[1] === 3 && !MapEditor.resizeSelected(1, -5) && MapEditor.selected().max[1] === 3);
  MapEditor.nudgeSelected(1000, 0, 0);
  check('an object cannot be moved out of the map', MapEditor.selected().max[0] <= MapEditor.map.size[0] / 2 + MapRules.limits.shellThickness + 1e-9, MapEditor.selected().max[0]);
  MapEditor.add('objectives', MapKit.objective({ id: 'route', kind: 'payloadPath', x: 1, y: 0, z: 2, radius: 3, path: [[1, 0, 2], [3, 0, 2]] }));
  MapEditor.select('objectives', 0);
  MapEditor.turnSelected();
  check('a payload path turns with its objective', JSON.stringify(MapEditor.selected().path) === '[[1,0,2],[3,0,0]]' || JSON.stringify(MapEditor.selected().path) === '[[1,0,2],[1,0,0]]', JSON.stringify(MapEditor.selected().path));
  const near = { list: '', index: -1 };
  check('objectNear finds the nearest object within reach', MapEditor.objectNear(0, 0, 0, 0.5, near) && near.list !== '' && !MapEditor.objectNear(-100, 0, -100, 1, near));

  // ---- Problems point at objects ----
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  MapEditor.add('spawns', MapKit.spawns([[-1, [], [[0, 5, 0, 0]]]])[0]);   // hangs in the air above the platform
  const problems = MapEditor.validate();
  const spawnProblem = problems.find((text) => text.startsWith('spawn:'));
  const located = spawnProblem ? MapEditor.locate(spawnProblem) : null;
  check('a problem about a spawn names it and jumps to it', !!located && located.list === 'spawns' && located.index === MapEditor.map.spawns.length - 1, spawnProblem + ' -> ' + JSON.stringify(located));
  check('a problem with only a position finds the object near it', (() => {
    MapEditor.map.items[0].x += 0.2;
    const target = MapEditor.locate('items: something at (' + MapEditor.map.items[0].x.toFixed(1) + ', ' + MapEditor.map.items[0].y.toFixed(1) + ', ' + MapEditor.map.items[0].z.toFixed(1) + ')');
    return target && target.list === 'items' && target.index === 0;
  })());
  check('a problem with no place gives null', MapEditor.locate('structure: id and name are required') === null);
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  MapEditor.add('triggers', { kind: 'jumppad', min: [0, 0, 0], max: [2, 2, 2] });
  const triggerProblem = MapEditor.validate().find((text) => text.startsWith('triggers: trigger #0'));
  check('a problem about a trigger jumps to it', !!triggerProblem && (MapEditor.locate(triggerProblem) || {}).list === 'triggers' && MapEditor.locate(triggerProblem).index === 0, String(triggerProblem));
  MapEditor.deleteObject('triggers', 0);
  MapEditor.map.zones[1].name = MapEditor.map.zones[0].name;
  MapEditor.map.zones[2].max = [MapEditor.map.zones[2].min[0], 5, 5];
  const duplicateProblem = MapEditor.validate().find((text) => text.includes('duplicate zone name'));
  check('a problem about a zone name jumps to the zone', !!duplicateProblem && (MapEditor.locate(duplicateProblem) || {}).list === 'zones' && MapEditor.locate(duplicateProblem).index === 0, String(duplicateProblem));
  const zoneName = MapEditor.map.zones[3].name;
  check('zone problems in every wording find the zone by its name', ['zones: ' + zoneName + ' has an invalid box', 'lights: indoor zone ' + zoneName + ' has no light (no dark campable corners)',
    'items: zone ' + zoneName + ' holds two top items: a and b'].every((text) => (MapEditor.locate(text) || {}).index === 3), zoneName);
  check('a name that is only part of a zone name does not match', MapEditor.locate('zones: duplicate zone name Nor') === null);
  MapEditor.map.objectives.push(MapKit.objective({ id: 'odd', kind: 'point', x: 0, y: 0, z: 0, radius: 3 }));
  check('numbered objective and hint problems find their object', (MapEditor.locate('objectives: #' + (MapEditor.map.objectives.length - 1) + ' has no valid id or kind') || {}).list === 'objectives'
    && (MapEditor.locate('hints: #1 has unknown kind x') || {}).list === 'navHints');
  MapEditor.map.props.push({ min: [2, 0, 2], max: [2, 1, 3] });   // a flat box: the validator's form rule refuses it
  const propIndex = MapEditor.map.props.length - 1, propProblem = MapEditor.validate().find((text) => text.startsWith('props: #' + propIndex + ' '));
  const propTarget = propProblem ? MapEditor.locate(propProblem) : null;
  check('a problem about a prop jumps to the prop', !!propTarget && propTarget.list === 'props' && propTarget.index === propIndex, String(propProblem) + ' -> ' + JSON.stringify(propTarget));
  MapEditor.map.props.pop();
  for (const kind of MapRules.triggerKinds) {
    MapEditorTools.stamp.triggerKind = kind;
    MapEditorTools.turns = 1;
    const placed = MapEditorTools.makeTrigger([0, 0, 0], [2, 2, 2]);
    const changed = { kind: 'killzone', min: [0, 0, 0], max: [2, 2, 2], damage: 9 };
    MAPEDIT_FIELDS.triggers[0].set(changed, kind);
    check('placing a ' + kind + ' and changing a trigger to it give the same fields', mapEditSameMap(placed, changed) === '', JSON.stringify(placed) + ' vs ' + JSON.stringify(changed));
  }
  MapEditorTools.turns = 0; MapEditorTools.stamp.triggerKind = 'killzone';
  check('the far end of a trigger is exactly six metres from its box (no rounding noise)', mapEditTriggerDefaults({ min: [0, 0, 0], max: [2, 2, 2] }, 'jumppad', 0).target.join() === '1,0,7'
    && mapEditTriggerDefaults({ min: [0, 0, 0], max: [2, 2, 2] }, 'teleporter', 3).exit.join() === '-5,0,1');
  check('the editor shares the hazard elements, the name cleaning and the sun direction with the rest of the game', MAPEDIT_FIELDS.triggers[3].values() === MapRules.elements
    && mapEditNameOf(' a<b>\u0001c ') === 'abc' && cleanLabel('abcdef', 3) === 'abc' && CustomMatch.validate({ name: ' x<y> ' }).draft.name === 'xy'
    && mapEditSkyFor('foundry').sun.every((n, i) => Math.abs(n - writeSunDirection(CAT.themes.byId('foundry'), [0, 0, 0])[i]) < 0.001));
  MapEditor.newFrom({ kind: 'empty' });
  MapEditor.setModes(['ffa']);
  check('modes the map lacks things for are listed by MapEditor.modeNeeds', /spawn/.test(MapEditor.modeNeeds(MapEditor.toMap(), 'ffa')) && MapEditor.modeNeeds(MapEditor.toMap(), 'ctf') !== '');
  check('suggested modes are only strictly ready ones', MapEditor.suggestModes().length === 0);
  MapEditor.newFrom({ kind: 'template', id: 'yard' });
  MapEditor.setSize(80, 30);
  check('changing the height keeps the width and the depth of a non-square map', MapEditor.map.size.join() === '80,30,50', MapEditor.map.size.join());
  MapEditor.setSize(60, 30, 90);
  check('width, height and depth can be set apart', MapEditor.map.size.join() === '60,30,90');
  check('a copy of a built-in map of another size keeps its own size among the choices', (() => {
    const odd = CAT.maps.find((row) => !MAPEDIT_SIZES.includes(row.size[0]) || !MAPEDIT_SIZES.includes(row.size[2]) || !MAPEDIT_HEIGHTS.includes(row.size[1]));
    if (!odd) return true;
    MapEditor.newFrom({ kind: 'builtin', id: odd.id });
    return [0, 1, 2].every((axis) => mapEditChoices(axis === 1 ? MAPEDIT_HEIGHTS : MAPEDIT_SIZES, MapEditor.map.size[axis]).includes(MapEditor.map.size[axis]));
  })());
  MapEditor.newFrom({ kind: 'template', id: 'yard' });
  check('the yard template suggests team modes and capture the flag', ['tdm', 'ctf'].every((mode) => MapEditor.suggestModes().includes(mode)), MapEditor.suggestModes().join());
  MapEditor.newFrom({ kind: 'empty' });
  check('the zone grid adds nine zones once and then nothing', MapEditor.addZoneGrid() === 9 && MapEditor.map.zones.length === 9 && MapEditor.addZoneGrid() === 0);
  check('lights are added to the zones, one each', MapEditor.addZoneLights() === 9 && MapEditor.map.lights.length === 9 && MapEditor.addZoneLights() === 0);
  MapEditor.undo();
  check('zone helpers undo as one step', MapEditor.map.lights.length === 0 && MapEditor.map.zones.length === 9);
  mapEditEditorOff();
});

Test.add('mapEditor', (check) => {
  // ---- Saving, loading, codes ----
  mapEditEditorOff();
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  check('a new map is not saved yet', MapEditor.dirty && MapEditor.slotId === '' && MapEditor.saved().length === 0);
  check('a map without a name is refused', !MapEditor.saveCurrent('  <>  ') && /name/i.test(MapEditor.message));
  check('saving works and registers the map for matches', MapEditor.saveCurrent('My Arena') && MapEditor.saved().length === 1 && !MapEditor.dirty && MapEditor.slotId === 'user1');
  check('the saved map is a runtime map for its modes', Maps.get('user1') && Maps.get('user1').name === 'My Arena' && Maps.forMode('ffa').some((map) => map.id === 'user1') && !Maps.forMode('ctf').some((map) => map.id === 'user1'));
  check('catalogue maps are untouched by the runtime list', CAT.maps.length === 12 && !CAT.maps.byId('user1'));
  check('a custom match accepts a saved map', CustomMatch.validate({ mode: 'ffa', map: 'user1' }).draft.map === 'user1');
  const saved = MapEditor.toMap();
  MapEditor.map.brushes.pop();
  MapEditor.dirty = true;
  check('saving again uses the same slot', MapEditor.saveCurrent() && MapEditor.saved().length === 1 && MapEditor.slotId === 'user1');
  check('the stored entry knows its size and modes', MapEditor.saved()[0].bytes > 100 && MapEditor.saved()[0].modes.join() === 'ffa,duel');
  MapEditor.newFrom({ kind: 'empty' });
  check('loading restores the saved map exactly', MapEditor.loadSaved('user1') && MapEditor.map.brushes.length === saved.brushes.length - 1 && !MapEditor.dirty && MapEditor.slotId === 'user1');
  check('loading clears the history and selection', !MapEditor.canUndo() && MapEditor.selected() === null);
  check('loading an unknown map fails with a message', !MapEditor.loadSaved('user99') && /not in the list/.test(MapEditor.message));
  check('renaming updates the list and the runtime map', MapEditor.renameSaved('user1', 'Renamed') && MapEditor.saved()[0].name === 'Renamed' && Maps.get('user1').name === 'Renamed' && MapEditor.map.name === 'Renamed');
  check('the save holds the editor maps', JSON.parse(Save.exportText()).editorMaps.length === 1);
  MapEditor.syncRuntime();
  check('syncRuntime re-registers saved maps', Maps.get('user1') && Maps.runtime.length === 1);
  check('deleting removes the map from the list and from matches', MapEditor.deleteSaved('user1') && MapEditor.saved().length === 0 && !Maps.get('user1') && MapEditor.slotId === '');
  for (let i = 0; i < MAPEDIT_MAX_MAPS; i++) { MapEditor.newFrom({ kind: 'template', id: 'arena' }); MapEditor.saveCurrent('Map ' + i); }
  check('twenty maps can be saved', MapEditor.saved().length === MAPEDIT_MAX_MAPS);
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  check('the twenty-first save is refused', !MapEditor.saveCurrent('One too many') && /full/i.test(MapEditor.message) && MapEditor.saved().length === MAPEDIT_MAX_MAPS);
  check('a full list still lets a saved map be saved again', MapEditor.loadSaved('user5') && MapEditor.saveCurrent() && MapEditor.saved().length === MAPEDIT_MAX_MAPS);
  for (let i = 0; i < MAPEDIT_MAX_MAPS; i++) MapEditor.deleteSaved('user' + (i + 1));
  check('deleting all leaves an empty list', MapEditor.saved().length === 0 && Maps.runtime.length === 0);
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  MapEditor.setModes(['ffa', 'duel', 'dom', 'ctf']);
  MapEditor.saveCurrent('Too many modes');
  const toggledId = MapEditor.slotId;
  check('a saved map is registered only for the modes it has the spawns and objectives for', Maps.forMode('ffa').some((map) => map.id === toggledId) && Maps.forMode('duel').some((map) => map.id === toggledId)
    && !Maps.forMode('dom').some((map) => map.id === toggledId) && !Maps.forMode('ctf').some((map) => map.id === toggledId) && Maps.get(toggledId).modes.join() === 'ffa,duel', Maps.get(toggledId).modes.join());
  check('the save keeps the modes the player chose, and a random custom map never picks it for a mode it cannot serve', MapEditor.saved()[0].modes.join() === 'ffa,duel,dom,ctf'
    && [1, 2, 3, 4, 5, 6, 7].every((seed) => CustomMatch.mapFor({ mode: 'dom', map: '' }, seed) !== toggledId));
  check('readyModes keeps the modes the validator counts allow', MapEditor.readyModes(MapEditor.map).join() === 'ffa,duel');
  for (let i = 0; i < 30; i++) Maps.registerRuntime(Object.assign(mapEditClone(Maps.get('spire')), { id: 'gen' + i, code: 'G' + i }));
  MapEditor.syncRuntime();
  check('the runtime list has no cap that could push saved maps out, and syncing leaves the rows of others alone', Maps.runtime.length === 31 && Maps.get(toggledId) && Maps.get('gen0') && Maps.get('gen29'), Maps.runtime.length);
  Maps.runtime = Maps.runtime.filter((map) => map.id === toggledId);
  MapEditor.setModes(['dom']);
  MapEditor.saveCurrent();
  check('a map that serves none of its listed modes is not offered for matches at all', !Maps.get(toggledId) && MapEditor.saved().length === 1);
  MapEditor.deleteSaved(toggledId);

  // storage cap
  MapEditor.newFrom({ kind: 'template', id: 'yard' });
  Save.data.editorMaps.push({ id: 'user99', name: 'Filler', modes: [], data: { pad: 'x'.repeat(MAPEDIT_SAFE_SAVE_BYTES - 3000) }, bytes: MAPEDIT_SAFE_SAVE_BYTES - 3000 });
  check('free space is reported against the safe cap', MapEditor.freeBytes() < 4000 && MapEditor.freeBytes() > 0, MapEditor.freeBytes());
  check('a save that would pass the safe cap is refused with the sizes', !MapEditor.saveCurrent('Too big') && /not enough room/i.test(MapEditor.message) && /KB/.test(MapEditor.message) && MapEditor.saved().length === 1, MapEditor.message);
  Save.data.editorMaps.length = 0;
  MapEditor.syncRuntime();
  Save.data.editorMaps.push(null, { id: 'x' }, 'text', { id: 'user7', name: 'Damaged', modes: [], bytes: 5, data: 5 });
  check('damaged entries in the save are dropped, not trusted', MapEditor.saved().length === 0 && Array.isArray(Save.data.editorMaps));
  Save.data.editorMaps = 'broken';
  check('a save whose list is not a list is repaired', MapEditor.saved().length === 0 && Array.isArray(Save.data.editorMaps));
  check('with room again the same map saves', MapEditor.saveCurrent('Fits') && MapEditor.usedBytes() < MAPEDIT_SAFE_SAVE_BYTES);
  Save.storage = makeMemoryStorage(true);
  MapEditor.dirty = true;
  const before = MapEditor.saved().length;
  check('a blocked storage refuses the save and keeps the list as it was', !MapEditor.saveCurrent('Blocked') && MapEditor.saved().length === before && /storage/i.test(MapEditor.message), MapEditor.message);
  Save.storage = makeMemoryStorage(false);
  Save.storageWorks = true; Save.notice = '';
  MapEditor.deleteSaved('user1');

  // codes
  MapEditor.newFrom({ kind: 'template', id: 'yard' });
  const original = MapEditor.toMap();
  const code = MapEditorShare.exportCode();
  check('a code has the prefix, a check value and fits a text box', /^CTKEDIT1-[0-9a-f]{8}-[A-Za-z0-9_-]+$/.test(code) && code.length < MAPEDIT_CODE_MAX_CHARS, code.length);
  check('the code is much shorter than the plain JSON', code.length < JSON.stringify(original).length / 2, code.length + ' vs ' + JSON.stringify(original).length);
  MapEditor.newFrom({ kind: 'empty' });
  const imported = MapEditorShare.importCode('  ' + code.slice(0, 20) + '\n' + code.slice(20) + '  ');
  check('import accepts the code (white space is ignored)', !imported.error && MapEditor.dirty && MapEditor.slotId === '');
  check('export then import gives back the same map', mapEditSameMap(Object.assign(original, { id: MAPEDIT_DRAFT_ID }), MapEditor.toMap()) === '', mapEditSameMap(original, MapEditor.toMap()));
  check('an imported map validates like the original', Maps.validate(MapEditor.toMap()).length === 0);
  const mutate = (text, index) => text.slice(0, index) + (text[index] === 'A' ? 'B' : 'A') + text.slice(index + 1);
  const bad = [['an empty code', ''], ['a foreign text', 'hello world'], ['a custom match code', 'CTK1-00000000-AAAA'], ['a changed character', mutate(code, code.length - 5)],
    ['a changed check value', mutate(code, 10)], ['a cut code', code.slice(0, code.length - 30)], ['a newer version', code.replace('CTKEDIT1', 'CTKEDIT9')], ['an oversize code', code + 'A'.repeat(MAPEDIT_CODE_MAX_CHARS)]];
  for (const [name, text] of bad) {
    const result = MapEditorShare.decodeCode(text);
    check('corrupt code rejected: ' + name, !!result.error && !result.map, result.error);
  }
  check('a rejected import leaves the editor map alone', (() => { const json = mapEditMapJson(); MapEditorShare.importCode('CTKEDIT1-00000000-AAAA'); return json === mapEditMapJson(); })());
  // a code with a correct check value but hostile content
  const encodeCode = (object) => CustomCodec.packCode(MAPEDIT_CODE_FORMAT, object);
  check('codes: map, generator and match codes have distinct prefixes, and none is read by another box', MAPEDIT_CODE_PREFIX !== MAPGEN_SHARE_PREFIX
    && MapGen.parseShare(code) === null && !!CustomCodec.unpack(code).error && !!MapEditorShare.decodeCode(CustomCodec.pack({ name: 'x' })).error);
  const good = MapEditor.compact(original);
  const hostile = [['no lists', Object.assign({}, good, { brushes: 5 })], ['a bad number', Object.assign({}, good, { brushes: [['concrete', 0, 0, 0, 'x', 1, 1]] })],
    ['an unknown material', Object.assign({}, good, { brushes: [['lava', 0, 0, 0, 1, 1, 1]] })], ['a huge coordinate', Object.assign({}, good, { brushes: [['concrete', 0, 0, 0, 1e9, 1, 1]] })],
    ['too many objects', Object.assign({}, good, { hints: Array.from({ length: 450 }, () => ['cover', 0, 0, 0]) })], ['a bad size', Object.assign({}, good, { size: [1, 1, 1] })],
    ['an unknown theme', Object.assign({}, good, { theme: 'lava' })], ['an unknown mode', Object.assign({}, good, { modes: ['chess'] })], ['not an object', [1, 2, 3]],
    ['a bad objective', Object.assign({}, good, { objectives: [{ id: 5 }] })], ['a bad trigger', Object.assign({}, good, { triggers: [{ kind: 'jumppad', min: [0, 0], max: [1, 1, 1] }] })],
    ['a bad item', Object.assign({}, good, { items: [['notakey', 0, 0, 0]] })], ['an old version', Object.assign({}, good, { v: 0 })],
    ['an inherited name as the category', Object.assign({}, good, { category: '__proto__' })], ['an inherited name as a mode', Object.assign({}, good, { modes: ['constructor'] })],
    ['a bad objective team', Object.assign({}, good, { objectives: [{ id: 'a', kind: 'point', x: 0, y: 0, z: 0, radius: 3, team: 'red' }] })],
    ['a bad hazard element', Object.assign({}, good, { triggers: [{ kind: 'hazard', min: [0, 0, 0], max: [1, 1, 1], damage: 5, element: 'lava' }] })]];
  for (const [name, object] of hostile) {
    const result = MapEditorShare.decodeCode(encodeCode(object));
    check('hostile content rejected: ' + name, !!result.error && !result.map, JSON.stringify(result).slice(0, 80));
  }
  check('a harmless code still imports', !MapEditorShare.decodeCode(encodeCode(good)).error);
  const sneaky = JSON.parse('{"id":"a","kind":"point","x":0,"y":0,"z":0,"radius":3,"__proto__":{"evil":1},"extra":[1,2,3]}');
  const sneakyMap = MapEditorShare.decodeCode(encodeCode(Object.assign({}, good, { objectives: [sneaky], __proto__x: 1 }))).map;
  check('unknown keys in a code are dropped, __proto__ never changes a prototype', !!sneakyMap && sneakyMap.objectives[0].evil === undefined && sneakyMap.objectives[0].extra === undefined
    && Object.getPrototypeOf(sneakyMap.objectives[0]) === Object.prototype && sneakyMap.__proto__x === undefined);
  mapEditEditorOff();
});

// The first editor version's codes (owner: "Convert them") and the one form checker shared by the validator and the code import (audit 60).
Test.add('mapEditor', (check) => {
  MapEditor.newFrom({ kind: 'template', id: 'yard' });
  const original = MapEditor.toMap();
  // The first version's encoder, line for line: the v1 rows without a props list, framed under the CTKMAP prefix.
  const oldDef = MapEditor.compact(original);
  delete oldDef.props;
  const oldPayload = CustomCodec.toBase64Url(CustomCodec.compress(new TextEncoder().encode(JSON.stringify(oldDef))));
  const oldCode = 'CTKMAP' + 1 + '-' + CustomCodec.checksum(oldPayload) + '-' + oldPayload;
  const decoded = MapEditorShare.decodeCode(oldCode);
  check('a code of the first editor version is read and converted to the current rows', !decoded.error && Array.isArray(decoded.map.props)
    && mapEditSameMap(Object.assign({}, original, { props: [] }), decoded.map) === '', decoded.error || mapEditSameMap(original, decoded.map));
  MapEditor.newFrom({ kind: 'empty' });
  check('an old code imports and validates like the original', !MapEditorShare.importCode(' ' + oldCode.slice(0, 30) + '\n' + oldCode.slice(30)).error && Maps.validate(MapEditor.toMap()).length === 0);
  check('a new export of an imported old code uses the current prefix', MapEditorShare.exportCode().startsWith(MAPEDIT_CODE_PREFIX + MAPEDIT_CODE_VERSION + '-'));
  const damaged = MapEditorShare.decodeCode(oldCode.slice(0, 20) + (oldCode[20] === 'A' ? 'B' : 'A') + oldCode.slice(21));
  check('a damaged old code is refused as damaged', !!damaged.error && /damaged/.test(damaged.error), damaged.error);
  check('a generator settings code is still not a map code', !!MapEditorShare.decodeCode(MapGen.shareCode({ generator: 'GN1', size: 'small', theme: 'foundry', density: 'normal', seed: 7 })).error);
  check('an old prefix with a later version is refused', !!MapEditorShare.decodeCode(oldCode.replace('CTKMAP1', 'CTKMAP2')).error);
  // One checker: the import checks only shapes and types; the keys are the validator's form rules on the built row.
  const lava = Object.assign({}, oldDef, { v: MAPEDIT_CODE_VERSION, brushes: oldDef.brushes.concat([['lava', 0, 0, 0, 1, 1, 1]]) });
  const refused = MapEditor.expand(lava), built = MapKit.make(Object.assign({}, lava, { props: [] }));
  check('one checker: the import refuses with the validator\'s own form rule text', mapEditProblemWith(lava) === '' && !!refused.error
    && refused.error.includes('unknown material lava') && Maps.validate(built).some((text) => text.includes('unknown material lava')), refused.error);
  check('one checker: the validator also refuses inherited names as a category or a mode', MapCheck.headerProblems(Object.assign({}, built, { category: '__proto__' })).length === 1
    && MapCheck.headerProblems(Object.assign({}, built, { modes: ['constructor'] })).length === 1 && MapRules.rule('constructor') === null);
  check('one checker: a well-formed map has no form problem', MapCheck.formProblem(original) === '' && CAT.maps.every((map) => MapCheck.formProblem(map) === ''));
  mapEditEditorOff();
});

Test.add('mapEditor', (check) => {
  // ---- Tools: camera, cursor, placing, picking, grab ----
  mapEditEditorOff();
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  MapEditorTools.attach();
  check('the editor takes the camera and shows the map theme', MapEditorTools.active && Render.cameraOverride === MapEditorTools.cameraHook && World.map && World.map.theme === MapEditor.map.theme && World.brushes.length === 0);
  const camera = {};
  check('the camera hook places the editor camera', Render.cameraOverride(camera) === true && camera.x === MapEditorTools.camera.x && camera.y === MapEditorTools.camera.y);
  const startZ = MapEditorTools.camera.z;
  MapEditorTools.setHold('forward', true);
  MapEditorTools.frame(0.1);
  MapEditorTools.setHold('forward', false);
  check('holding forward flies the camera along the view', MapEditorTools.camera.z > startZ && Math.abs(MapEditorTools.camera.z - startZ) < MAPEDIT_FLY_SPEED * 0.1 + 1e-6);
  MapEditorTools.camera.y = 1;
  MapEditorTools.setHold('down', true); MapEditorTools.frame(1); MapEditorTools.setHold('down', false);
  check('the camera stays above the ground', MapEditorTools.camera.y >= 0.5);

  MapEditorTools.snapIndex = 0;
  MapEditorTools.setTool('box');
  mapEditLookDown(30);
  check('looking straight down puts the cursor under the screen centre', MapEditorTools.cursor.valid && MapEditorTools.cursor.x === 0 && MapEditorTools.cursor.z === 0, JSON.stringify(MapEditorTools.cursor));
  MapEditorTools.camera.x = -14; MapEditorTools.camera.z = 12;
  MapEditorTools.updateCursor();
  check('the cursor is snapped to the grid and sits on the floor', MapEditorTools.cursor.valid && MapEditorTools.cursor.x === -14 && MapEditorTools.cursor.z === 12 && MapEditorTools.cursor.y === 0, JSON.stringify(MapEditorTools.cursor));
  MapEditorTools.camera.x = -13.74; MapEditorTools.snapIndex = 1;
  MapEditorTools.updateCursor();
  check('snap 1 m rounds to whole metres', MapEditorTools.cursor.x === -14, MapEditorTools.cursor.x);
  MapEditorTools.snapIndex = 0;
  MapEditorTools.camera.x = 0; MapEditorTools.camera.z = 0;
  MapEditorTools.updateCursor();
  check('over the raised platform the cursor stands on its top', MapEditorTools.cursor.y === 2, JSON.stringify(MapEditorTools.cursor));
  MapEditorTools.setLevel(5);
  MapEditorTools.camera.x = -14; MapEditorTools.camera.z = 12; MapEditorTools.updateCursor();
  check('the level raises the ground plane the cursor lands on', MapEditorTools.cursor.y === 5, MapEditorTools.cursor.y);
  MapEditorTools.setLevel(0);

  const count = MapEditor.count();
  MapEditorTools.camera.x = -14; MapEditorTools.camera.z = 12; MapEditorTools.updateCursor();
  check('placing a box adds one brush at the cursor on the floor', MapEditorTools.place() === MapEditor.map.brushes.length - 1 && MapEditor.count() === count + 1);
  const placed = MapEditor.selected();
  check('the new box is 2 m wide, sits on the floor and is selected', placed.shape === 'box' && placed.max[0] - placed.min[0] === 2 && placed.min[1] === 0 && placed.max[1] === 2 && MapEditor.selection.list === 'brushes', JSON.stringify(placed));
  MapEditorTools.command('rotate');
  check('turning the stamp swaps width and depth of the next box', MapEditorTools.turns === 1 && MapEditorTools.layout(mapEditToolById('box'))[3] - MapEditorTools.layout(mapEditToolById('box'))[0] === 2);
  MapEditorTools.stamp.sizes.box = [4, 2, 2];
  MapEditorTools.turns = 0;
  const wide = MapEditorTools.layout(mapEditToolById('box'));
  const wideSize = wide[3] - wide[0];
  MapEditorTools.turns = 1;
  const deep = MapEditorTools.layout(mapEditToolById('box'));
  check('width and depth swap with a quarter turn', wideSize === 4 && deep[3] - deep[0] === 2 && deep[5] - deep[2] === 4);
  MapEditorTools.turns = 0; MapEditorTools.stamp.sizes.box = [2, 2, 2];

  for (const [tool, list] of [['ramp', 'brushes'], ['spawn', 'spawns'], ['item', 'items'], ['objective', 'objectives'], ['zone', 'zones'], ['trigger', 'triggers'], ['light', 'lights'], ['hint', 'navHints']]) {
    MapEditorTools.setTool(tool);
    const length = MapEditor.map[list].length;
    MapEditorTools.place();
    check('the ' + tool + ' tool places one ' + MAPEDIT_KINDS[list].label, MapEditor.map[list].length === length + 1 && MapEditor.selection.list === list);
  }
  check('a ramp is placed with a direction from the stamp', MapEditor.map.brushes.some((brush) => brush.shape === 'ramp' && brush.dir === '+z'));
  MapEditorTools.setTool('trigger'); MapEditorTools.setOption('triggerKind', 'jumppad'); MapEditorTools.place();
  check('a jump pad is placed with a target and a peak', (() => { const pad = MapEditor.selected(); return pad.kind === 'jumppad' && mapEditTriple(pad.target) && pad.peak > 0; })());
  MapEditorTools.setOption('triggerKind', 'teleporter'); MapEditorTools.place();
  check('a teleporter is placed with an exit and a yaw', (() => { const tele = MapEditor.selected(); return tele.kind === 'teleporter' && mapEditTriple(tele.exit) && typeof tele.yaw === 'number'; })());
  MapEditorTools.setOption('triggerKind', 'hazard'); MapEditorTools.place();
  check('a hazard is placed with damage and an element', MapEditor.selected().damage > 0 && MapRules.elements.includes(MapEditor.selected().element));
  MapEditorTools.setTool('objective'); MapEditorTools.setOption('objectiveKind', 'payloadPath'); MapEditorTools.place();
  check('a payload path starts with one point and can be extended', MapEditor.selected().path.length === 1 && (MapEditorTools.camera.x += 6, MapEditorTools.updateCursor(), MapEditorTools.addPathPoint()) && MapEditor.selected().path.length === 2);
  MapEditorTools.setOption('objectiveKind', 'flag'); MapEditorTools.setOption('objectiveTeam', 1); MapEditorTools.place();
  check('a flag takes the stamp team', MapEditor.selected().kind === 'flag' && MapEditor.selected().team === 1 && MapEditor.selected().id === 'flag1');
  MapEditorTools.place();
  check('objective ids stay unique', MapEditor.selected().id === 'flag2');
  MapEditorTools.setTool('spawn'); MapEditorTools.turns = 2; MapEditorTools.place();
  check('a spawn takes its yaw from the stamp turns', MapEditor.selected().yaw === 180 && MapEditorTools.turns === 2);
  MapEditorTools.turns = 0;
  MapEditorTools.setTool('item'); MapEditorTools.cycleOption(1, 0);
  MapEditorTools.place();
  check('an item takes its key and group from the item list', MapRules.groupOf(MapEditor.selected().item) === MapEditor.selected().group && MapEditor.selected().item !== 'healthpack');
  MapEditorTools.setTool('zone'); MapEditorTools.place(); MapEditorTools.place();
  check('zone names stay unique', MapEditor.map.zones.filter((zone) => zone.name === 'Zone').length === 1 && MapEditor.map.zones.some((zone) => zone.name === 'Zone 2'));

  // picking and grabbing
  MapEditor.clearSelection();
  MapEditorTools.setTool('select');
  mapEditLookDown(30);
  MapEditorTools.camera.x = MapEditor.map.items[0].x; MapEditorTools.camera.z = MapEditor.map.items[0].z; MapEditorTools.camera.y = MapEditor.map.items[0].y + 12;
  MapEditorTools.pointer.centre = true;
  MapEditorTools.updateCursor();
  check('the object under the pointer is the hover', MapEditorTools.hover.list !== '' && MapEditorTools.hover.distance > 0, JSON.stringify(MapEditorTools.hover));
  const hovered = { list: MapEditorTools.hover.list, index: MapEditorTools.hover.index };
  MapEditorTools.command('primary');
  check('the select tool selects what is under the pointer', MapEditor.selection.list === hovered.list && MapEditor.selection.index === hovered.index);
  const picked = { list: MapEditor.selection.list, index: MapEditor.selection.index };
  const firstPosition = JSON.stringify(MapEditor.selected());
  check('grab starts only with a selection and a cursor', MapEditorTools.command('grab') && MapEditorTools.grab.active);
  MapEditorTools.camera.x += 4; MapEditorTools.updateCursor();
  check('while grabbing the object follows the cursor without changing the map', MapEditorTools.grab.dx === 4 && JSON.stringify(MapEditor.selected()) === firstPosition, MapEditorTools.grab.dx);
  const historyBefore = MapEditor.history.position;
  MapEditorTools.command('primary');
  check('dropping moves the object once (one undo step)', !MapEditorTools.grab.active && MapEditor.history.position === historyBefore + 1 && JSON.stringify(MapEditor.selected()) !== firstPosition);
  MapEditor.undo();
  check('undo puts the dropped object back', JSON.stringify(MapEditor.map[picked.list][picked.index]) === firstPosition);
  MapEditorTools.command('grab'); MapEditorTools.camera.x += 2; MapEditorTools.updateCursor(); MapEditorTools.command('secondary');
  check('delete while grabbing cancels the grab instead of deleting', !MapEditorTools.grab.active && JSON.stringify(MapEditor.map[picked.list][picked.index]) === firstPosition);
  // a box grabbed by its top and dropped on a flat floor keeps its height
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  MapEditorTools.setTool('select');
  MapEditorTools.snapIndex = 0;
  const pillarIndex = MapEditor.map.brushes.findIndex((brush) => brush.min[0] === 9 && brush.min[2] === 9 && brush.max[1] === 1.8);
  const pillarBefore = JSON.stringify(MapEditor.map.brushes[pillarIndex]);
  MapEditor.select('brushes', pillarIndex);
  mapEditLookDown(30);
  MapEditorTools.camera.x = 10; MapEditorTools.camera.z = 10; MapEditorTools.updateCursor();
  check('the cursor is on the pillar top before the grab', MapEditorTools.cursor.y === 1.8, MapEditorTools.cursor.y);
  MapEditorTools.command('grab');
  check('the grab anchor is taken with the grabbed brush out of the way (the floor below it)', MapEditorTools.grab.active && MapEditorTools.grab.ay === 0, JSON.stringify(MapEditorTools.grab));
  MapEditorTools.camera.x = 14; MapEditorTools.updateCursor();
  MapEditorTools.command('primary');
  const dropped = MapEditor.map.brushes[pillarIndex];
  check('dropping a grabbed box on the flat floor moves it sideways only', dropped.min.join() === '13,0,9' && dropped.max.join() === '15,1.8,11', JSON.stringify(dropped));
  MapEditor.undo();
  check('and undo puts it back', JSON.stringify(MapEditor.map.brushes[pillarIndex]) === pillarBefore);
  // an undo during a grab cancels it: the list may have shifted under the grab
  const beforeShift = mapEditMapJson();
  MapEditor.deleteObject('items', 0);
  MapEditor.select('items', MapEditor.map.items.length - 1);
  mapEditLookDown(30); MapEditorTools.camera.x = -14; MapEditorTools.camera.z = 12; MapEditorTools.updateCursor();
  MapEditorTools.command('grab');
  MapEditorTools.camera.x += 3; MapEditorTools.updateCursor();
  MapEditor.undo();
  check('an undo during a grab cancels the grab', !MapEditorTools.grab.active && mapEditMapJson() === beforeShift);
  check('dropping after that moves nothing', MapEditorTools.dropGrab() === false && mapEditMapJson() === beforeShift);
  MapEditorTools.command('grab'); MapEditorTools.camera.x += 3; MapEditorTools.updateCursor();
  MapEditor.redo();
  check('a redo during a grab cancels it too', !MapEditorTools.grab.active);
  MapEditor.undo();
  MapEditor.clearSelection();
  MapEditor.select('brushes', 0);
  const objects = MapEditor.count();
  MapEditorTools.command('secondary');
  check('delete removes the selection', MapEditor.count() === objects - 1);
  MapEditor.clearSelection();
  mapEditLookDown(14);
  const bare = MapEditor.map.items.find((item) => !MapEditor.map.lights.some((light) => Math.hypot(light.x - item.x, light.z - item.z) < 2));   // no light above it to pick instead
  MapEditorTools.camera.x = bare.x; MapEditorTools.camera.z = bare.z; MapEditorTools.updateCursor();
  const itemsBefore = MapEditor.map.items.length;
  MapEditorTools.command('secondary');
  check('with nothing selected delete removes the object under the pointer', MapEditorTools.hover.list === '' && MapEditor.map.items.length === itemsBefore - 1, itemsBefore + ' -> ' + MapEditor.map.items.length);
  MapEditorTools.command('undo');
  check('the undo command brings it back', MapEditor.map.items.length === itemsBefore);
  MapEditorTools.command('snap');
  check('the snap command cycles 0.5, 1 and 2 m', MapEditorTools.snap() === 1 && (MapEditorTools.command('snap'), MapEditorTools.snap() === 2) && (MapEditorTools.command('snap'), MapEditorTools.snap() === 0.5));
  MapEditorTools.command('tool:ramp');
  check('tool commands select tools', MapEditorTools.tool === 'ramp');
  MapEditorTools.command('toolNext');
  check('toolNext moves to the next tool', MapEditorTools.tool === 'spawn');
  check('unknown commands do nothing', MapEditorTools.command('nope') === false && MapEditorTools.command('tool:nope') === false);
  while (MapEditor.count() < MAPEDIT_BUDGET) MapEditor.add('navHints', MapKit.hint(['cover', 0, 0, 0]));
  MapEditorTools.setTool('item');
  mapEditLookDown(30); MapEditorTools.camera.x = -14; MapEditorTools.camera.z = 12; MapEditorTools.updateCursor();
  const itemsAtBudget = MapEditor.map.items.length;
  check('placing an item with the tool is refused when the budget is full', MapEditorTools.place() === -1 && MapEditor.count() === MAPEDIT_BUDGET && MapEditor.map.items.length === itemsAtBudget && /budget/i.test(MapEditor.message), MapEditor.message);
  mapEditEditorOff();
});

Test.add('mapEditor', (check) => {
  // ---- Devices: keyboard + mouse, gamepad, touch ----
  mapEditEditorOff();
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  MapEditorTools.attach();
  MapEditorTools.setTool('box');
  const key = (code, extra) => Object.assign({ code, target: document.body, repeat: false, ctrlKey: false, shiftKey: false, metaKey: false, preventDefault() { this.prevented = true; } }, extra);
  const w = key('KeyW');
  MapEditorTools.onKeyDown(w);
  check('W is held and the browser default is stopped', MapEditorTools.held.forward === true && w.prevented === true);
  MapEditorTools.onKeyUp(key('KeyW'));
  check('releasing W stops the move', MapEditorTools.held.forward === false);
  MapEditorTools.onKeyDown(key('ShiftLeft'));
  check('shift flies fast', MapEditorTools.held.fast === true);
  MapEditorTools.onKeyUp(key('ShiftLeft'));
  mapEditLookDown(30); MapEditorTools.camera.x = -14; MapEditorTools.camera.z = 12; MapEditorTools.updateCursor();
  const count = MapEditor.count();
  MapEditorTools.onKeyDown(key('Enter'));
  check('a placing key adds an object', MapEditor.count() === count + 1);
  MapEditorTools.onKeyDown(key('KeyZ', { ctrlKey: true }));
  check('Ctrl+Z undoes', MapEditor.count() === count);
  MapEditorTools.onKeyDown(key('KeyY', { ctrlKey: true }));
  check('Ctrl+Y redoes', MapEditor.count() === count + 1);
  MapEditorTools.onKeyDown(key('KeyZ', { ctrlKey: true }));
  MapEditorTools.onKeyDown(key('KeyZ', { ctrlKey: true, shiftKey: true }));
  check('Ctrl+Shift+Z redoes too', MapEditor.count() === count + 1);
  MapEditorTools.onKeyDown(key('KeyR'));
  check('R turns the stamp', MapEditorTools.turns === 1);
  MapEditorTools.onKeyDown(key('Digit4'));
  check('number keys choose the tool', MapEditorTools.tool === 'spawn');
  MapEditorTools.onKeyDown(key('Period'));
  check('. and , step through the tools (Tab stays free for the panels)', MapEditorTools.tool === 'item' && (MapEditorTools.onKeyDown(key('Comma')), MapEditorTools.tool === 'spawn') && !MAPEDIT_COMMAND_KEYS.Tab);
  const arrowTarget = document.createElement('button');
  document.body.appendChild(arrowTarget);
  arrowTarget.focus();
  const arrow = key('ArrowLeft');
  MapEditor.select('spawns', 0);
  const spawnX = MapEditor.map.spawns[0].x, spawnZ = MapEditor.map.spawns[0].z;
  MapEditorTools.onKeyDown(arrow);
  check('arrows leave the focus alone while a panel control has it', !arrow.prevented && MapEditor.map.spawns[0].x === spawnX && MapEditor.map.spawns[0].z === spawnZ);
  const enterCount = MapEditor.count();
  const enterKey = key('Enter');
  MapEditorTools.onKeyDown(enterKey);
  check('Enter leaves a focused panel button alone and places nothing', !enterKey.prevented && MapEditor.count() === enterCount);
  arrowTarget.remove();
  const arrowFree = key('ArrowLeft');
  MapEditorTools.onKeyDown(arrowFree);
  check('arrows nudge the selection otherwise', arrowFree.prevented === true && (MapEditor.map.spawns[0].x !== spawnX || MapEditor.map.spawns[0].z !== spawnZ));
  MapEditor.undo();
  MapEditorTools.onKeyDown(key('Digit4'));
  MapEditorTools.onKeyDown(key('Enter', { repeat: true }));
  check('a held placing key does not repeat', MapEditor.count() === count + 1);
  MapEditorTools.onKeyDown(key('KeyZ', { ctrlKey: true, repeat: true }));
  check('a held undo key repeats', MapEditor.count() === count);
  const field = makeElement('input');
  field.type = 'text';
  const typed = key('KeyW', { target: field });
  MapEditorTools.onKeyDown(typed);
  check('typing in a text field does not fly the camera', !typed.prevented);
  MapEditorTools.releaseAll();

  // mouse
  const canvasEvent = (extra) => Object.assign({ target: { id: 'view' }, clientX: window.innerWidth / 2, clientY: window.innerHeight / 2, button: 0, pointerType: 'mouse', pointerId: 1, deltaY: -100, shiftKey: false, preventDefault() {} }, extra);
  MapEditorTools.setTool('hint');
  mapEditLookDown(30); MapEditorTools.camera.x = 6; MapEditorTools.camera.z = 6;
  const hints = MapEditor.map.navHints.length;
  MapEditorTools.onPointerDown(canvasEvent({}));
  check('a left click on the view places at the pointer', MapEditor.map.navHints.length === hints + 1 && MapEditorTools.pointer.centre === false);
  MapEditorTools.onPointerDown(canvasEvent({ target: { id: 'something else' } }));
  check('a click on a panel does not place', MapEditor.map.navHints.length === hints + 1);
  const yaw = MapEditorTools.camera.yaw;
  MapEditorTools.onPointerDown(canvasEvent({ button: 2, clientX: 100, clientY: 100 }));
  MapEditorTools.onPointerMove(canvasEvent({ clientX: 160, clientY: 100 }));
  MapEditorTools.onPointerUp(canvasEvent({ button: 2 }));
  check('dragging with the right button looks around (right turns the view right)', MapEditorTools.camera.yaw < yaw && !MapEditorTools.drag.look);
  const turns = MapEditorTools.turns;
  MapEditorTools.onWheel(canvasEvent({}));
  check('the wheel turns the stamp', MapEditorTools.turns === (turns + 1) % 4);
  MapEditorTools.onWheel(canvasEvent({ shiftKey: true }));
  check('shift + wheel raises the level', MapEditorTools.elevation === 0.5);
  MapEditorTools.setLevel(0);

  // gamepad
  const pad = mapEditFakePad();
  MapEditorTools.setTool('box');
  mapEditLookDown(30); MapEditorTools.camera.x = -14; MapEditorTools.camera.z = 12;
  mapEditWithPad(pad, () => {
    pad.axes[1] = -1;
    MapEditorTools.frame(0.1);
    check('the left stick flies along the view (down, here)', MapEditorTools.camera.y < 30 && MapEditorTools.pointer.centre === true, MapEditorTools.camera.y);
    pad.axes[1] = 0; pad.axes[2] = 1;
    const yawBefore = MapEditorTools.camera.yaw;
    MapEditorTools.frame(0.1);
    check('the right stick turns the view', MapEditorTools.camera.yaw < yawBefore);
    pad.axes[2] = 0; pad.axes[3] = 1;
    MapEditorTools.camera.pitch = 0;
    MapEditorTools.frame(0.1);
    check('pushing the right stick down looks down', MapEditorTools.camera.pitch < 0, MapEditorTools.camera.pitch);
    pad.axes[3] = 0;
    mapEditLookDown(30); MapEditorTools.camera.x = -14; MapEditorTools.camera.z = 12; MapEditorTools.pointer.centre = false;
    const objects = MapEditor.count();
    pad.buttons[0] = { pressed: true, value: 1 };
    MapEditorTools.frame(0.016);
    check('button A places at the screen centre', MapEditor.count() === objects + 1 && MapEditorTools.pointer.centre === true);
    MapEditorTools.frame(0.016);
    check('a held button acts once', MapEditor.count() === objects + 1);
    pad.buttons[0] = { pressed: false, value: 0 };
    MapEditorTools.frame(0.016);
    pad.buttons[8] = { pressed: true, value: 1 };
    MapEditorTools.frame(0.016);
    check('the View button undoes', MapEditor.count() === objects);
    pad.buttons[8] = { pressed: false, value: 0 };
    MapEditorTools.frame(0.016);
    pad.buttons[15] = { pressed: true, value: 1 };
    MapEditorTools.frame(0.016);
    check('d-pad right redoes', MapEditor.count() === objects + 1);
    pad.buttons[15] = { pressed: false, value: 0 };
    MapEditorTools.frame(0.016);
    const tool = MapEditorTools.tool;
    pad.buttons[13] = { pressed: true, value: 1 };
    MapEditorTools.frame(0.016);
    pad.buttons[13] = { pressed: false, value: 0 };
    check('d-pad down chooses the next tool', MapEditorTools.tool !== tool);
    MapEditorTools.setTool('item');
    const item = MapEditorTools.stamp.itemKey;
    pad.buttons[5] = { pressed: true, value: 1 };
    MapEditorTools.frame(0.016);
    pad.buttons[5] = { pressed: false, value: 0 };
    check('the right bumper cycles the tool option', MapEditorTools.stamp.itemKey !== item);
    let menu = 0;
    MapEditorTools.menuRequest = () => menu++;
    pad.buttons[9] = { pressed: true, value: 1 };
    MapEditorTools.frame(0.016);
    check('Start asks for the menu', menu === 1);
    MapEditorTools.menuRequest = null;
    pad.buttons[9] = { pressed: false, value: 0 };
    pad.buttons[7] = { pressed: true, value: 1 };
    const y = MapEditorTools.camera.y;
    MapEditorTools.frame(0.1);
    check('the right trigger flies up', MapEditorTools.camera.y > y);
  });

  // a dialog over the editor takes the input: the world must not react to the pad or the keys under it
  Ui.open('mapEditor');
  Ui.open('mapEditorMenu');
  mapEditLookDown(30); MapEditorTools.camera.x = -14; MapEditorTools.camera.z = 12; MapEditorTools.setTool('box');
  const underDialog = MapEditor.count();
  const dialogPad = mapEditFakePad();
  mapEditWithPad(dialogPad, () => {
    dialogPad.buttons[0] = { pressed: true, value: 1 };
    MapEditorTools.frame(0.016);
    check('the pad does not place while a dialog is open', MapEditor.count() === underDialog);
    Ui.pop();
    MapEditorTools.frame(0.016);
    check('a button still held from under the dialog does not fire when it closes', MapEditor.count() === underDialog);
    dialogPad.buttons[0] = { pressed: false, value: 0 };
    MapEditorTools.frame(0.016);
    dialogPad.buttons[0] = { pressed: true, value: 1 };
    MapEditorTools.frame(0.016);
    check('a new press after that places again', MapEditor.count() === underDialog + 1);
  });
  Ui.open('mapEditorMenu');
  MapEditorTools.onKeyDown(key('Enter'));
  MapEditorTools.onKeyDown(key('KeyW'));
  check('keys do not edit or fly while a dialog is open', MapEditor.count() === underDialog + 1 && MapEditorTools.held.forward !== true);
  Ui.closeAll();

  // the editor screen, its dialogs, and the touch buttons
  MapEditorTools.detach();
  check('the main menu offers the map editor', MAIN_MENU_ENTRIES.some((entry) => entry.screen === 'mapEditor') && Ui.screens.has('mapEditor'));
  Ui.open('main');
  MapEditor.clearSelection();
  check('the main menu button is enabled', Array.from(document.querySelectorAll('.ui-main .ui-button')).some((button) => button.textContent === 'Map editor' && !button.disabled));
  check('the editor screen opens and takes the camera', Ui.open('mapEditor') && MapEditorTools.active && Ui.current() === 'mapEditor');
  check('the pad menu commands are not for the panels while the editor is open', Ui.screens.get('mapEditor').onCommand('accept') === true);
  const root = document.querySelector('.ui-mapEditor');
  check('the screen shows the budget, the tools and the properties', /Objects \d+ \/ 400/.test(root.textContent) && root.textContent.includes('Nav hint') && root.textContent.includes('Nothing selected'));
  MapEditor.select('spawns', 0);
  MapEditorUi.flush();
  check('selecting an object shows its properties', document.querySelector('.me-right').textContent.includes('Spawn #0') && document.querySelector('.me-right').textContent.includes('Team'));
  for (const list of MAP_REQUIRED_LISTS) {
    if (MapEditor.map[list].length === 0) MapEditor.add(list, list === 'triggers' ? { kind: 'killzone', min: [0, 0, 0], max: [2, 2, 2] } : list === 'zones' ? { name: 'Z', min: [0, 0, 0], max: [2, 2, 2] } : MapKit.hint(['cover', 0, 0, 0]));
    MapEditor.select(list, 0);
    MapEditorUi.flush();
    check('properties of ' + list + ' build without errors', document.querySelector('.me-right').children.length > 3);
  }
  MapEditorUi.flush();
  const calls = [], rebuildPanel = MapEditorUi.rebuild, palettePanel = MapEditorUi.left;
  MapEditorUi.rebuild = function (panel, fill) { calls.push(panel === palettePanel ? 'palette' : 'properties'); return rebuildPanel.call(this, panel, fill); };
  const undoButton = MapEditorUi.undoButton, budgetText = MapEditorUi.budget.textContent;
  MapEditor.add('navHints', MapKit.hint(['cover', 1, 0, 1]));
  MapEditor.add('navHints', MapKit.hint(['cover', 2, 0, 1]));
  check('nothing is redrawn before the frame', calls.length === 0 && MapEditorUi.budget.textContent === budgetText);
  MapEditorUi.flush();
  check('two edits in a frame redraw the properties once and the palette not at all', calls.join() === 'properties', calls.join());
  check('the top bar keeps its buttons and shows the new count and undo state', MapEditorUi.undoButton === undoButton && !undoButton.disabled && MapEditorUi.budget.textContent !== budgetText && MapEditorUi.budget.textContent === 'Objects ' + MapEditor.count() + ' / 400');
  calls.length = 0;
  MapEditor.select('navHints', 0); MapEditorUi.flush();
  check('a new selection redraws only the properties', calls.join() === 'properties', calls.join());
  calls.length = 0;
  MapEditorTools.setTool('box'); MapEditorUi.flush();
  check('choosing a tool redraws only the palette', calls.join() === 'palette', calls.join());
  calls.length = 0;
  MapEditorTools.command('snap'); MapEditorUi.flush();
  check('a new snap step redraws the palette and the properties (their buttons move by it)', calls.join() === 'palette,properties' && /Snap 1 m/.test(MapEditorUi.snapButton.textContent), calls.join());
  MapEditorTools.command('snap'); MapEditorTools.command('snap'); MapEditorUi.flush();
  calls.length = 0;
  MapEditor.validate(); MapEditorUi.flush();
  check('checking the map redraws nothing', calls.length === 0);
  const toolButtons = () => Array.from(MapEditorUi.left.querySelectorAll('button'));
  const rampButton = toolButtons()[2];
  rampButton.focus();
  rampButton.click();
  MapEditorUi.flush();
  check('a panel control that had the focus gets it back after the redraw', document.activeElement === toolButtons()[2] && document.activeElement !== rampButton && MapEditorUi.left.contains(document.activeElement) && MapEditorTools.tool === 'ramp');
  MapEditorUi.rebuild = rebuildPanel;
  const holdButton = Array.from(document.querySelectorAll('.me-touch .ui-button')).find((button) => button.textContent === 'Fwd');
  check('the touch layer has the fly buttons and the place button', !!holdButton && Array.from(document.querySelectorAll('.me-touch .ui-button')).some((button) => button.textContent === 'Place'));
  holdButton.dispatchEvent(new Event('pointerdown', { cancelable: true }));
  check('pressing a touch button flies while held', MapEditorTools.held.forward === true);
  holdButton.dispatchEvent(new Event('pointerup'));
  check('releasing it stops', MapEditorTools.held.forward === false);
  const placeButton = Array.from(document.querySelectorAll('.me-touch .ui-button')).find((button) => button.textContent === 'Place');
  MapEditorTools.setTool('hint'); mapEditLookDown(30);
  const hintCount = MapEditor.map.navHints.length;
  placeButton.click();
  check('the touch place button places at the cursor', MapEditor.map.navHints.length === hintCount + 1);
  const touch = (type, id, x, y) => MapEditorTools[type](canvasEvent({ pointerType: 'touch', pointerId: id, clientX: x, clientY: y }));
  touch('onPointerDown', 1, 300, 300);
  check('one finger moves the cursor and does not place', MapEditor.map.navHints.length === hintCount + 1 && MapEditorTools.pointer.ndcX < 0 && !MapEditorTools.drag.look);
  touch('onPointerDown', 2, 500, 300);
  const touchYaw = MapEditorTools.camera.yaw;
  touch('onPointerMove', 1, 330, 300);
  check('two fingers look around', MapEditorTools.drag.look && MapEditorTools.camera.yaw < touchYaw);
  const steadyYaw = MapEditorTools.camera.yaw;
  touch('onPointerMove', 2, 700, 100);
  check('only the first finger drives the look (no jump when the other moves)', MapEditorTools.camera.yaw === steadyYaw);
  touch('onPointerUp', 2, 560, 300); touch('onPointerUp', 1, 300, 300);
  check('lifting the fingers ends the look', !MapEditorTools.drag.look && MapEditorTools.drag.touches === 0);
  touch('onPointerDown', 5, 300, 300);
  touch('onPointerUp', 77, 0, 0);
  check('a finger lifted from a hold button (never on the view) leaves the count alone', MapEditorTools.drag.touches === 1);
  touch('onPointerDown', 6, 500, 300);
  check('the second finger on the view starts the look', MapEditorTools.drag.look && MapEditorTools.drag.touches === 2);
  touch('onPointerUp', 5, 300, 300);
  touch('onPointerDown', 7, 520, 320);
  const lookYaw = MapEditorTools.camera.yaw;
  touch('onPointerMove', 6, 540, 300);
  check('after the first finger left, its start point is not used (no jump)', MapEditorTools.camera.yaw === lookYaw);
  touch('onPointerMove', 6, 580, 300);
  check('the finger that stayed drives the look', MapEditorTools.drag.look && MapEditorTools.camera.yaw < lookYaw);
  touch('onPointerDown', 8, 100, 100);
  check('a third finger is not counted', MapEditorTools.drag.touches === 2);
  touch('onPointerUp', 6, 580, 300); touch('onPointerUp', 7, 520, 320); touch('onPointerUp', 8, 100, 100);
  check('all fingers up leaves no count', MapEditorTools.drag.touches === 0 && !MapEditorTools.drag.look && MapEditorTools.drag.slots.join() === '-1,-1');
  MapEditorTools.setTool('item');
  MapEditor.select('spawns', 0);
  Ui.open('mapEditorObject');
  const objectDialog = document.querySelector('.ui-mapEditorObject');
  check('the tool and object dialog holds the tool options and the selection properties', objectDialog.textContent.includes('Item pad') && objectDialog.textContent.includes('Spawn #0') && objectDialog.textContent.includes('Team'));
  const teamCycle = Array.from(objectDialog.querySelectorAll('.ui-row')).find((row) => row.textContent.startsWith('Team')).querySelector('.ui-cycle');
  teamCycle.focus();
  teamCycle.click();
  MapEditorUi.flush();
  check('changing a property in the dialog edits the object and keeps the dialog and the focus', MapEditor.selected().team === 0 && Ui.current() === 'mapEditorObject' && document.activeElement.classList.contains('ui-cycle'));
  Ui.pop();
  check('closing the dialog stops its refresh', MapEditorUi.dialogRefresh === null);
  MapEditor.undo();
  for (const name of ['mapEditorMenu', 'mapEditorNew', 'mapEditorMaps', 'mapEditorCheck', 'mapEditorCode', 'mapEditorPlay', 'mapEditorSettings', 'mapEditorModes', 'mapEditorObject']) {
    check('dialog ' + name + ' opens', Ui.open(name) && Ui.current() === name);
    Ui.pop();
  }
  check('closing the dialogs shows the editor again', Ui.current() === 'mapEditor');
  Ui.pop();
  check('closing the editor gives the camera back', !MapEditorTools.active && Render.cameraOverride !== MapEditorTools.cameraHook);
  mapEditEditorOff();
});

Test.add('mapEditor', async (check) => {
  // ---- Dialogs that change things ----
  const tick = () => new Promise((done) => setTimeout(done, 20));
  mapEditEditorOff();
  MapEditor.newFrom({ kind: 'empty' });
  Ui.open('mapEditor');
  Ui.open('mapEditorSettings');
  const labels = () => Array.from(document.querySelectorAll('.ui-mapEditorSettings .ui-row')).map((row) => row.textContent);
  check('map settings list name, theme, width, depth, height, class and modes', ['Name', 'Theme', 'Width', 'Depth', 'Height', 'Sightline class', 'Modes'].every((label) => labels().some((text) => text.startsWith(label))));
  const themeButton = Array.from(document.querySelectorAll('.ui-mapEditorSettings .ui-cycle')).find((button) => button.textContent === 'Foundry');
  themeButton.click();
  check('changing the theme changes the sky too and reloads the editor world', MapEditor.map.theme === 'ruins' && MapEditor.map.sky.top !== mapEditSkyFor('foundry').top && World.map.theme === 'ruins', MapEditor.map.theme);
  const input = document.querySelector('.ui-mapEditorSettings .me-name');
  input.value = 'Fresh name';
  input.dispatchEvent(new Event('change'));
  check('renaming goes through the model', MapEditor.map.name === 'Fresh name');
  MapEditor.undo(); MapEditor.undo();
  check('settings are undoable', MapEditor.map.theme === 'foundry' && MapEditor.map.name === 'Untitled map');
  Ui.pop();
  MapEditor.newFrom({ kind: 'template', id: 'yard' });
  Ui.open('mapEditorSettings');
  const sizeCycle = (label) => Array.from(document.querySelectorAll('.ui-mapEditorSettings .ui-row')).find((row) => row.textContent.startsWith(label)).querySelector('.ui-cycle');
  sizeCycle('Height').click();
  check('the height row changes the height and keeps width and depth', MapEditor.map.size.join() === '80,30,50', MapEditor.map.size.join());
  sizeCycle('Depth').click();
  check('the depth row changes the depth only', MapEditor.map.size.join() === '80,30,60', MapEditor.map.size.join());
  Ui.pop();
  MapEditor.setSize(70, 14, 55);
  Ui.open('mapEditorSettings');
  check('sizes that are not in the usual lists are shown as they are', sizeCycle('Width').textContent === '70 m' && sizeCycle('Depth').textContent === '55 m' && sizeCycle('Height').textContent === '14 m');
  sizeCycle('Width').click();
  check('the next click goes to the next size above the map\'s own', MapEditor.map.size.join() === '80,14,55', MapEditor.map.size.join());
  Ui.pop();
  MapEditor.newFrom({ kind: 'template', id: 'yard' });
  Ui.open('mapEditorModes');
  const rows = Array.from(document.querySelectorAll('.ui-mapEditorModes .ui-row'));
  check('the mode list shows every mode with what it lacks', rows.length > 10 && rows.some((row) => row.textContent.includes('needs')) && rows.some((row) => row.textContent.startsWith(CAT.modes.byId('tdm').name)), rows.map((row) => row.textContent).join(' | ').slice(0, 300));
  Ui.pop();
  Ui.open('mapEditorCheck');
  check('the check screen opens at once and says it is checking', document.querySelector('.ui-mapEditorCheck').textContent.includes('Checking'));
  await tick();
  check('the check screen reports the template as sound', document.querySelector('.ui-mapEditorCheck').textContent.includes('No problems'));
  Ui.pop();
  MapEditor.map.spawns[0].y = 5;
  Ui.open('mapEditorCheck');
  await tick();
  const problem = document.querySelector('.ui-mapEditorCheck .me-problem');
  check('a problem is a button', !!problem);
  problem.click();
  check('tapping a problem returns to the editor with the object selected and the camera on it', Ui.current() === 'mapEditor' && MapEditor.selection.list === 'spawns' && MapEditor.selection.index === 0
    && Math.abs(MapEditorTools.camera.x + Math.sin(MapEditorTools.camera.yaw) * MAPEDIT_FOCUS_BACK - MapEditor.map.spawns[0].x) < 1e-6);
  Ui.open('mapEditorCode');
  document.querySelector('.ui-mapEditorCode .ui-code').value = 'not a code';
  Array.from(document.querySelectorAll('.ui-mapEditorCode .ui-button')).find((button) => button.textContent === 'Import').click();
  const confirmOpen = Ui.current() === 'confirm';
  if (confirmOpen) Array.from(document.querySelectorAll('.ui-confirm .ui-button')).find((button) => button.textContent === 'Import').click();
  check('a bad code shows its message and stays on the screen', Ui.current() === 'mapEditorCode' && document.querySelector('.ui-mapEditorCode .me-error').textContent.length > 0);
  Array.from(document.querySelectorAll('.ui-mapEditorCode .ui-button')).find((button) => button.textContent === 'Make code').click();
  check('Make code fills the box with a code', /^CTKEDIT1-/.test(document.querySelector('.ui-mapEditorCode .ui-code').value));
  Ui.toastBox.replaceChildren();
  Array.from(document.querySelectorAll('.ui-mapEditorCode .ui-button')).find((button) => button.textContent === 'Copy').click();
  await new Promise((done) => setTimeout(done, 50));
  check('Copy sends the code through copyText (iOS ignores select())', /copied|copy/i.test(Ui.lastToast), Ui.lastToast);
  Ui.pop();
  MapEditor.newFrom({ kind: 'empty' });
  check('saving an unfinished map says that no mode is complete', mapEditSave(false) && /no mode is complete/i.test(Ui.lastToast) && MapEditor.saved().length === 1 && Maps.runtime.length === 0, Ui.lastToast);
  MapEditor.deleteSaved('user1');
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  MapEditor.setModes([]);
  check('saving a map without modes picks the ones it is ready for', mapEditSave(false) && MapEditor.map.modes.includes('ffa') && Ui.lastToast === 'Saved' && Maps.forMode('ffa').some((map) => map.id === 'user1'));
  MapEditor.setModes(['ffa', 'duel', 'dom']);
  check('saving tells which modes matches will not offer yet', mapEditSave(false) && /still lack/i.test(Ui.lastToast), Ui.lastToast);
  MapEditor.setModes(['ffa', 'duel']);
  check('save as a new map keeps the first slot', mapEditSave(true) && MapEditor.saved().length === 2 && MapEditor.slotId === 'user2');
  MapEditor.deleteSaved('user2');
  MapEditor.loadSaved('user1');
  MapEditor.rename('Listed');
  MapEditor.saveCurrent();
  Ui.open('mapEditorMaps');
  const listed = () => Array.from(document.querySelectorAll('.ui-mapEditorMaps .me-name')).map((field) => field.value);
  check('the map list shows saved maps and the space used', listed().join() === 'Listed' && /KB/.test(document.querySelector('.ui-mapEditorMaps').textContent));
  Array.from(document.querySelectorAll('.ui-mapEditorMaps .ui-button')).find((button) => button.textContent === 'Delete').click();
  check('deleting asks first', Ui.current() === 'confirm' && MapEditor.saved().length === 1);
  Array.from(document.querySelectorAll('.ui-confirm .ui-button')).find((button) => button.textContent === 'Delete').click();
  check('after the answer the map is gone', MapEditor.saved().length === 0 && listed().length === 0);
  mapEditEditorOff();
});

Test.add('mapEditor', async (check) => {
  // ---- Test-play and drawing ----
  mapEditEditorOff();
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  MapEditorTools.attach();
  check('the arena can be test-played as free for all but not as capture the flag', MapEditorTools.playableModes().includes('ffa') && !MapEditorTools.playableModes().includes('ctf'), MapEditorTools.playableModes().join());
  MapEditor.newFrom({ kind: 'template', id: 'yard' });
  check('the yard offers team modes and capture the flag', ['tdm', 'ctf'].every((mode) => MapEditorTools.playableModes().includes(mode)), MapEditorTools.playableModes().join());
  MapEditor.newFrom({ kind: 'empty' });
  check('an empty map offers no mode', MapEditorTools.playableModes().length === 0);
  MapEditor.add('spawns', MapKit.spawns([[-1, [], [[0, 0, 0, 0]]]])[0]);
  check('a map with one spawn offers free-for-all modes but none that need objectives', MapEditorTools.playableModes().includes('ffa') && !MapEditorTools.playableModes().includes('dom'));
  check('test-play refuses a mode the map cannot serve', MapEditorPlay.testPlay('ctf') === false && !Game.match && /objectives/.test(MapEditor.message));
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  MapEditorTools.attach();
  const before = mapEditMapJson();
  check('test-play starts a match on the edited map', MapEditorPlay.testPlay('ffa') === true && Game.state === 'playing' && !!Game.match, Game.state);
  const played = Game.match.map;
  check('the match plays the edited map itself', played && mapEditSameMap(played, MapEditor.toMap()) === '' && played.brushes.length === MapEditor.map.brushes.length && Game.match.setup.mode === 'ffa');
  check('the editor is off during the match', !MapEditorTools.active && MapEditorPlay.returning && Render.cameraOverride !== MapEditorTools.cameraHook);
  check('the match world is the edited map', World.brushes.length === MapEditor.map.brushes.length);
  Sim.run(240);
  check('the match runs on the edited map', Actors.alive[Game.playerId] === 1 || Game.playerId >= 0);
  Game.stop();
  MapEditorPlay.settle();
  check('stopping the match brings the editor back', MapEditorTools.active && !MapEditorPlay.returning && Game.state === 'menu');
  check('the editor state is intact after the match', mapEditMapJson() === before && MapEditor.canUndo() === false && World.brushes.length === 0 && World.map.id === 'mapEditor');
  MapEditor.add('navHints', MapKit.hint(['cover', 0, 0, 0]));
  check('editing continues after the match', MapEditor.canUndo() && MapEditor.dirty);
  MapEditorTools.detach();
  // Restart in the pause menu: Game.start stops the match and starts the next one, the editor must not flash up in between
  MapEditorPlay.testPlay('ffa');
  const firstSetup = Game.match.setup;
  Game.start(firstSetup);
  MapEditorPlay.settle();
  check('a restart during test-play keeps the match and does not open the editor', !MapEditorTools.active && MapEditorPlay.returning && !!Game.match && Game.match.setup === firstSetup && Game.state === 'playing');
  Game.stop();
  MapEditorPlay.settle();
  check('quitting after a restart returns to the editor', MapEditorTools.active && !MapEditorPlay.returning && !Game.match);
  MapEditorTools.detach();
  MapEditorPlay.testPlay('ffa');
  Game.stop();
  await new Promise((done) => setTimeout(done, 0));
  check('the editor comes back by itself once the stop call is over', MapEditorTools.active && !MapEditorPlay.returning);
  MapEditorTools.detach();
  MapEditorPlay.testPlay('ffa');
  Game.start(Game.match.setup);
  await new Promise((done) => setTimeout(done, 0));
  check('a restart is also recognised without an explicit settle', !MapEditorTools.active && MapEditorPlay.returning && !!Game.match);
  Game.stop();
  await new Promise((done) => setTimeout(done, 0));
  check('and the later quit brings the editor back', MapEditorTools.active && !MapEditorPlay.returning);
  MapEditorTools.detach();

  // a team mode from the yard
  MapEditor.newFrom({ kind: 'template', id: 'yard' });
  MapEditorTools.attach();
  check('test-play starts capture the flag on the yard', MapEditorPlay.testPlay('ctf') === true && Game.match.map.objectives.length === 4);
  Game.stop();
  MapEditorPlay.settle();
  check('and returns again', MapEditorTools.active);
  MapEditorTools.detach();
  Game.stop();
  check('a match stop without test-play does not open the editor', !MapEditorTools.active);

  // the renderer reads the lights of a map row as they are stored ({ x, y, z, color, radius })
  const lights = readMapLights(Maps.get('spire'));
  check('map row lights reach the renderer', lights.length === Maps.get('spire').lights.length && lights[0].x === 0 && lights[0].y === 12 && lights[0].radius === 20, JSON.stringify(lights[0]));

  // saved map in a normal match
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  MapEditor.saveCurrent('Played');
  Game.start({ mode: 'ffa', map: 'user1', seed: 5 });
  check('a saved map starts as a normal match map by id', Game.match.map && Game.match.map.id === 'user1' && World.brushes.length === MapEditor.map.brushes.length);
  Game.stop();

  // drawing
  MapEditor.newFrom({ kind: 'template', id: 'yard' });
  MapEditorTools.attach();
  mapEditLookDown(30);
  const batch = mapEditFakeBatch();
  MapEditorTools.draw(batch);
  check('the source draws every brush as a box or a wedge', batch.shapes.box >= MapEditor.map.brushes.length && (batch.shapes.wedge || 0) === 0, JSON.stringify(batch.shapes));
  check('the source draws spawns, items, objectives and lights', batch.shapes.capsule === MapEditor.map.spawns.length && batch.shapes.sphere >= MapEditor.map.items.length + MapEditor.map.lights.length && batch.shapes.ring >= MapEditor.map.objectives.length);
  MapEditor.newFrom({ kind: 'template', id: 'arena' });
  const arena = mapEditFakeBatch();
  MapEditorTools.draw(arena);
  check('ramps are drawn as wedges', arena.shapes.wedge === 4, JSON.stringify(arena.shapes));
  MapEditorTools.view.zones = true;
  const zoned = mapEditFakeBatch();
  MapEditorTools.draw(zoned);
  check('showing the zones adds their outlines', zoned.count > arena.count + 9 * 12 - 1);
  MapEditorTools.view.zones = false;
  MapEditor.newFrom({ kind: 'empty' });
  while (MapEditor.count() < MAPEDIT_BUDGET) MapEditor.add('navHints', MapKit.hint(['cover', 0, 0, 0]));
  const full = mapEditCappedBatch();
  MapEditorTools.draw(full);
  check('a full map of nav hints stays inside the batch of every shape', full.dropped === 0, JSON.stringify(full.shapes));
  const bars = mapEditCappedBatch(), box = new Float64Array([0, 0, 0, 4, 2, 6]);
  MapEditorTools.drawEdges(bars, box, 0.1, [1, 1, 1], 0);
  const foot = mapEditCappedBatch();
  MapEditorTools.drawFootprint(foot, box, 0.1, [1, 1, 1], 0);
  check('a volume outline is 12 distinct bars, its foot 4', bars.bars.size === 12 && bars.shapes.box === 12 && foot.bars.size === 4 && foot.shapes.box === 4, bars.bars.size + ' / ' + foot.bars.size);
  check('the outline gets plainer as volumes multiply', MapEditorTools.outlineLevel(5, 10) === MAPEDIT_OUTLINE_FULL && MapEditorTools.outlineLevel(80, 17) === MAPEDIT_OUTLINE_FOOT && MapEditorTools.outlineLevel(399, 1) === MAPEDIT_OUTLINE_PLATE);
  MapEditorTools.view.zones = true; MapEditorTools.view.triggers = true;
  for (const volumes of [60, 120, 250, MAPEDIT_BUDGET - 10]) {
    MapEditor.newFrom({ kind: 'template', id: 'arena' });
    MapEditor.addZoneGrid();
    for (let i = 0; MapEditor.count() < Math.min(MAPEDIT_BUDGET, volumes + MapEditor.map.brushes.length + 9 + 4); i++) MapEditor.add('triggers', { kind: 'killzone', min: [i % 20 - 10, 0, 0], max: [i % 20 - 9, 2, 1] });
    const worst = mapEditCappedBatch();
    MapEditorTools.draw(worst);
    check('a map with ' + MapEditor.map.triggers.length + ' trigger volumes and ' + MapEditor.map.zones.length + ' zones shown draws every box of it', worst.dropped === 0 && worst.shapes.box <= MAPEDIT_BATCH_SHAPE_CAPACITY, worst.dropped + ' dropped, ' + worst.shapes.box + ' boxes');
  }
  MapEditor.select('triggers', 3);
  const marked = mapEditCappedBatch();
  MapEditorTools.draw(marked);
  check('the selection outline is drawn however many volumes there are', marked.selected === 12, marked.selected);
  MapEditorTools.view.zones = false;
  MapEditorTools.detach();
  const none = mapEditFakeBatch();
  MapEditorTools.draw(none);
  check('the source draws nothing while the editor is closed', none.count === 0);
  mapEditEditorOff();
});

Test.add('mapEditor', (check) => {
  // ---- Breakable props: drawn, picked, moved and deleted like the other objects ----
  mapEditEditorOff();
  MapEditor.newFrom({ kind: 'builtin', id: 'spire' });
  MapEditorTools.attach();
  const props = MapEditor.map.props, count = props.length, prop = props[0], x = prop.min[0], ray = MapEditorTools.ray, drawn = mapEditFakeBatch(), bare = mapEditFakeBatch();
  MapEditorTools.draw(drawn);
  MapEditor.map.props = [];
  MapEditorTools.draw(bare);
  MapEditor.map.props = props;
  ray.ox = (x + prop.max[0]) / 2; ray.oy = prop.max[1] + 0.5; ray.oz = (prop.min[2] + prop.max[2]) / 2; ray.dx = 0; ray.dy = -1; ray.dz = 0;
  MapEditorTools.pickHover();
  check('props: drawn and picked', drawn.shapes.box - bare.shapes.box === count && MapEditorTools.hover.list === 'props' && !MapEditorTools.hover.index, MapEditorTools.hover.list);
  MapEditor.select('props', 0);
  MapEditor.nudgeSelected(1, 0, 0);
  const moved = MapEditor.map.props[0].min[0] === x + 1;
  MapEditor.deleteSelected();
  check('props: moved and deleted', moved && MapEditor.map.props.length === count - 1 && mapEditCodeOf('user7') === 'U07');
  MapEditorTools.detach();
  mapEditEditorOff();
});

Test.add('mapEditor', (check) => {
  mapEditRestoreEditor();
  check('the editor state of the player is back after the tests', mapEditKept === null);
});

// A longer randomised sweep: many seeds of random edits with undo / redo, saves and codes. Returns { seeds, failures }.
DebugApi.mapEditor = { MapEditor, MapEditorTools, MapEditorUi, Ui, Maps, Game, World, Render, MapRules };   // for scripted checks and screenshots (--eval)
DebugApi.mapEditorSweep = (seeds) => {
  const failures = [];
  for (let seed = 1; seed <= (seeds || 100); seed++) {
    const problem = mapEditRoundTrip(seed, 80);
    if (problem) { failures.push('seed ' + seed + ': ' + problem); continue; }
    const code = MapEditorShare.exportCode();
    const back = MapEditorShare.decodeCode(code);
    if (back.error || mapEditSameMap(MapEditor.toMap(), back.map)) failures.push('seed ' + seed + ': code round trip ' + (back.error || mapEditSameMap(MapEditor.toMap(), back.map)));
  }
  return { seeds: seeds || 100, failures };
};

Test.add('mapEditor', (check) => {
  // ---- One object budget (props included) in add, copy, save and load ----
  mapEditEditorOff();
  MapEditor.newFrom({ kind: 'builtin', id: 'harbor' });
  const props = MapEditor.map.props.length;
  check('the budget counts props like every other list', MapEditor.count() === MAP_REQUIRED_LISTS.reduce((sum, list) => sum + MapEditor.map[list].length, 0) + props);
  const listed = MapEditor.countsText().match(/\d+/g).reduce((sum, number) => sum + Number(number), 0);
  check('the per-list counts add up to the budget count (props listed)', props > 0 && listed === MapEditor.count() && /Prop \d/.test(MapEditor.countsText()), MapEditor.countsText());
  const kept = MapEditor.map.navHints.slice();
  for (let index = MapEditor.count(); index <= MAPEDIT_BUDGET; index++) MapEditor.map.navHints.push({ kind: 'cover', x: 0, y: 0, z: 0 });
  check('a save is refused when the map would not reopen (over the budget)', !MapEditor.saveCurrent('Over budget') && /cannot be saved/.test(MapEditor.message), MapEditor.message);
  MapEditor.map.navHints = kept;
  while (MapEditor.count() < MAPEDIT_BUDGET) MapEditor.add('navHints', { kind: 'cover', x: 0, y: 0, z: 0 });
  check('the budget stops adding at the limit', MapEditor.count() === MAPEDIT_BUDGET && MapEditor.add('navHints', { kind: 'cover', x: 0, y: 0, z: 0 }) === -1);
  const slot = MapEditor.saveCurrent('Full harbor') && MapEditor.slotId;
  MapEditor.newFrom({ kind: 'empty' });
  check('a map saved at the budget reopens', slot && MapEditor.loadSaved(slot), MapEditor.message);
  MapEditor.deleteSaved(slot);
  mapEditEditorOff();
});
