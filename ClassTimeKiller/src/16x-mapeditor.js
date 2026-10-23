// ==== S16 MAPS: MAP EDITOR (MODEL) ====
// Map editor, model side (MAP-014): the map being edited (a normal map row), the object budget, undo / redo, serialising to the
// map data format, the saved map list in Save.data.editorMaps, text codes for sharing, and the start points (empty, template, copy of a
// built-in map). No DOM, no rendering, no input: 16x-mapeditor-tools.js adds the cursor and placement tools, 18i-ui-mapeditor.js the screens.
// Contract: docs/api/mapeditor.md.

const MAPEDIT_BUDGET = 400;                              // MAP-014: placed objects per map, all lists together
const MAPEDIT_HISTORY_SIZE = 128;                        // undo steps kept; the ring never grows past this
const MAPEDIT_MAX_MAPS = 20;                             // saved maps
const MAPEDIT_SAFE_SAVE_BYTES = Math.floor(SAVE_MAX_BYTES * 0.9);   // a save that would pass this is refused (the whole save stays under 1 MB, ARC-020)
const MAPEDIT_BLURB_MAX = 200;
const MAPEDIT_ID_PREFIX = 'user';
const MAPEDIT_DRAFT_ID = 'draft';
const MAPEDIT_CODE_VERSION = 1;                          // version of the compact rows (saved maps and share codes)
const MAPEDIT_COORD_LIMIT = 1000;                        // no coordinate of an imported map may be larger than this
const MAPEDIT_SIZE_RANGE = [10, 400];
const MAPEDIT_MIN_EXTENT = 0.5;                          // a resized box never gets thinner than this
const MAPEDIT_FLOOR_LIMIT = -10;                         // the validator's lowest brush level
const MAPEDIT_PICK_RADIUS = 3;                           // objectives are picked by at most this footprint
const MAPEDIT_PROBLEM_REACH = 1.5;                       // metres: a problem's position selects the object this close to it
const MAPEDIT_SNAPS = [0.5, 1, 2];                       // grid steps, metres
const MAPEDIT_SIZES = [30, 40, 50, 60, 80, 100, 120, 160];   // map width and depth choices
const MAPEDIT_HEIGHTS = [12, 20, 30, 40];
const MAPEDIT_AUTO_SKIP_MODES = ['royale', 'range', 'puzzle'];   // never suggested automatically: they need a special map
const MAPEDIT_GRID_ZONES = [['Northwest', -1, 1], ['North', 0, 1], ['Northeast', 1, 1], ['West', -1, 0], ['Middle', 0, 0], ['East', 1, 0],
  ['Southwest', -1, -1], ['South', 0, -1], ['Southeast', 1, -1]];   // callout zones laid over the map: name, column, row
const MAPEDIT_LIGHT_COLOR = 0xffd9a0;
const MAPEDIT_DIR_TURN = { '+z': '+x', '+x': '-z', '-z': '-x', '-x': '+z' };   // a quarter turn, the same way as spawn yaw + 90
const MAPEDIT_CODE_KEYS = ['id', 'code', 'name', 'size', 'theme', 'category', 'sky', 'modes', 'blurb', 'version', 'placeholder', 'seed'];

// How each list of a map is placed and measured. box: a { min, max } volume; otherwise a point with a footprint and a height.
const MAPEDIT_NEAR_ORDER = ['items', 'spawns', 'objectives', 'navHints', 'lights', 'triggers', 'brushes', 'zones'];   // a problem at a point most likely names a point object, so those win ties
const MAPEDIT_KINDS = {
  brushes: { label: 'Brush', box: true },
  spawns: { label: 'Spawn', halfWidth: 0.4, height: 1.8 },
  items: { label: 'Item pad', halfWidth: 0.4, height: 0.9 },
  objectives: { label: 'Objective', halfWidth: 0.5, height: 3 },
  zones: { label: 'Zone', box: true },
  triggers: { label: 'Trigger', box: true },
  lights: { label: 'Light', halfWidth: 0.3, height: 0.6, centred: true },
  navHints: { label: 'Nav hint', halfWidth: 0.3, height: 0.6 },
  props: { label: 'Prop', box: true },
};

// How a validator message names a list: the word before the number.
const MAPEDIT_PROBLEM_LISTS = { brush: 'brushes', light: 'lights', spawn: 'spawns', item: 'items', hint: 'navHints', hints: 'navHints', objectives: 'objectives', trigger: 'triggers', props: 'props' };
// Does a validator message talk about the zone with this name? ("duplicate zone name X", "indoor zone X has no light", "zones: X has an invalid box")
const mapEditNamesZone = (text, name) => text.includes('zone ' + name + ' ') || text.endsWith('zone name ' + name) || text.includes(': ' + name + ' has an invalid box');

const mapEditClone = (value) => JSON.parse(JSON.stringify(value));
const mapEditFinite = (value) => typeof value === 'number' && isFinite(value) && Math.abs(value) <= MAPEDIT_COORD_LIMIT;
const mapEditTriple = (value) => Array.isArray(value) && value.length === 3 && value.every(mapEditFinite);
const mapEditNameOf = (text) => cleanLabel(text || '', LABEL_MAX);
const mapEditAdd3 = (point, dx, dy, dz) => { point[0] += dx; point[1] += dy; point[2] += dz; };

// A quarter turn of a point around (cx, cz): the same direction as '+z' -> '+x' and spawn yaw + 90.
function mapEditTurnPoint(point, cx, cz) {
  const u = point[0] - cx, v = point[2] - cz;
  point[0] = cx + v;
  point[2] = cz - u;
}
const mapEditWrapDegrees = (degrees) => ((degrees % 360) + 360) % 360;
const mapEditYawTurn = (yaw) => mapEditWrapDegrees(yaw + 90);

// Mutating helpers: each works on a clone of an object and is followed by MapEditor.replace.
function mapEditShift(list, object, dx, dy, dz) {
  if (!MAPEDIT_KINDS[list].box) {
    object.x += dx; object.y += dy; object.z += dz;
    if (object.path) for (const point of object.path) mapEditAdd3(point, dx, dy, dz);
    return;
  }
  mapEditAdd3(object.min, dx, dy, dz);
  mapEditAdd3(object.max, dx, dy, dz);
  if (object.target) mapEditAdd3(object.target, dx, dy, dz);
  if (object.exit) mapEditAdd3(object.exit, dx, dy, dz);
}

function mapEditTurn(list, object) {
  if (list === 'spawns') { object.yaw = mapEditYawTurn(object.yaw); return; }
  if (list === 'objectives') { for (const point of object.path || []) mapEditTurnPoint(point, object.x, object.z); return; }
  if (!MAPEDIT_KINDS[list].box) return;
  const cx = (object.min[0] + object.max[0]) / 2, cz = (object.min[2] + object.max[2]) / 2;
  const halfX = (object.max[0] - object.min[0]) / 2, halfZ = (object.max[2] - object.min[2]) / 2;
  object.min[0] = cx - halfZ; object.max[0] = cx + halfZ;
  object.min[2] = cz - halfX; object.max[2] = cz + halfX;
  if (object.dir) object.dir = MAPEDIT_DIR_TURN[object.dir];
  if (object.target) mapEditTurnPoint(object.target, cx, cz);
  if (object.exit) mapEditTurnPoint(object.exit, cx, cz);
  if (typeof object.yaw === 'number') object.yaw = mapEditYawTurn(object.yaw);
}

// Grows (positive) or shrinks one side of a box along an axis, or the radius of an objective or light. Returns false when nothing can change.
function mapEditResize(list, object, axis, delta) {
  if (MAPEDIT_KINDS[list].box) {
    const extent = object.max[axis] - object.min[axis] + delta;
    if (extent < MAPEDIT_MIN_EXTENT) return false;
    object.max[axis] = object.min[axis] + extent;
    return true;
  }
  if (list !== 'objectives' && list !== 'lights') return false;
  const radius = object.radius + delta;
  if (radius < MAPEDIT_MIN_EXTENT || radius > MAPEDIT_COORD_LIMIT / 10) return false;
  object.radius = radius;
  return true;
}

const MapEditor = {
  map: null,                       // the map being edited: a full map row
  slotId: '',                      // id of the saved copy ('' = never saved)
  dirty: false,
  selection: { list: '', index: -1 },
  message: '',                     // the last refusal text (the UI shows it as a toast)
  problems: [],
  problemsFresh: false,
  scratch: new Float64Array(6),    // bounds of the object being measured
  openGroup: 0,                    // history group of a multi-step edit, 0 = none
  groupCounter: 0,
  history: { entries: new Array(MAPEDIT_HISTORY_SIZE).fill(null), start: 0, length: 0, position: 0 },
  changedEvent: { what: '' },

  // ---- Lifecycle ----
  ensureMap() { if (!this.map) this.newFrom({ kind: 'empty' }); },
  reset(map, slotId) {
    this.map = map;
    this.slotId = slotId || '';
    this.dirty = !slotId;
    this.history.entries.fill(null);
    this.history.start = this.history.length = this.history.position = 0;
    this.selection.list = ''; this.selection.index = -1;
    this.problemsFresh = false;
    this.announce('map');
  },
  announce(what) { this.changedEvent.what = what; Bus.emit('mapEditor.changed', this.changedEvent); },
  refuse(text) {
    this.message = text;
    emitToast(text);
    return -1;
  },
  toMap() { return mapEditClone(this.map); },

  // ---- Budget (MAP-014) ----
  count() { return mapEditObjectCount(this.map); },
  budgetLeft() { return MAPEDIT_BUDGET - this.count(); },
  countsText() {
    const lists = this.map.props.length ? MAP_REQUIRED_LISTS.concat('props') : MAP_REQUIRED_LISTS;   // props count in the budget too
    return lists.map((list) => MAPEDIT_KINDS[list].label + ' ' + this.map[list].length).join(', ');
  },

  // ---- Edits: every change is one history entry { op, list, index, before, after, group } ----
  add(list, object) {
    if (this.count() >= MAPEDIT_BUDGET) return this.refuse('Object budget reached: ' + MAPEDIT_BUDGET + ' objects per map.');
    if (list === 'lights' && this.map.lights.length >= MapRules.limits.lights) return this.refuse('A map holds at most ' + MapRules.limits.lights + ' lights.');
    const index = this.map[list].length;
    this.commit({ op: 'add', list, index, after: object });
    return index;
  },
  deleteObject(list, index) {
    if (!this.map[list][index]) return false;
    this.commit({ op: 'del', list, index, before: mapEditClone(this.map[list][index]) });
    return true;
  },
  replace(list, index, object) {
    const before = this.map[list][index];
    if (!before || JSON.stringify(before) === JSON.stringify(object)) return false;
    this.commit({ op: 'set', list, index, before: mapEditClone(before), after: object });
    return true;
  },
  setMeta(key, value) {
    if (JSON.stringify(this.map[key]) === JSON.stringify(value)) return false;
    this.commit({ op: 'meta', key, before: mapEditClone(this.map[key]), after: value });
    return true;
  },
  // Several edits that one undo reverts together.
  group(run) {
    const outer = this.openGroup;
    if (!outer) this.openGroup = ++this.groupCounter;
    try { run(); } finally { this.openGroup = outer; }
  },
  commit(entry) {
    entry.group = this.openGroup || ++this.groupCounter;
    this.applyEntry(entry, false);
    this.record(entry);
    this.dirty = true;
    this.problemsFresh = false;
    this.announce('edit');
  },
  record(entry) {
    const history = this.history, size = MAPEDIT_HISTORY_SIZE;
    for (let i = history.position; i < history.length; i++) history.entries[(history.start + i) % size] = null;   // a new edit ends the redo branch
    history.length = history.position;
    if (history.length === size) {
      history.entries[history.start] = null;
      history.start = (history.start + 1) % size;
      history.length--;
      history.position--;
    }
    history.entries[(history.start + history.length) % size] = entry;
    history.length++;
    history.position++;
  },
  // Applies an entry forwards, or backwards when undoing.
  applyEntry(entry, undoing) {
    if (entry.op === 'meta') { this.map[entry.key] = mapEditClone(undoing ? entry.before : entry.after); return; }
    const list = this.map[entry.list];
    const inserting = (entry.op === 'add') !== undoing;
    if (entry.op === 'set') list[entry.index] = mapEditClone(undoing ? entry.before : entry.after);
    else if (inserting) list.splice(entry.index, 0, mapEditClone(entry.op === 'add' ? entry.after : entry.before));
    else list.splice(entry.index, 1);
    this.followSelection(entry, inserting);
  },
  // Keeps the selection on the same object when the list shifts; selects what an add or undo brought back.
  followSelection(entry, inserting) {
    const selection = this.selection;
    if (entry.op === 'set') return;
    if (inserting) { selection.list = entry.list; selection.index = entry.index; return; }
    if (selection.list !== entry.list) return;
    if (selection.index === entry.index) { selection.list = ''; selection.index = -1; } else if (selection.index > entry.index) selection.index--;
  },
  canUndo() { return this.history.position > 0; },
  canRedo() { return this.history.position < this.history.length; },
  undo() {
    const history = this.history;
    if (!this.canUndo()) return false;
    const group = this.entryAt(history.position - 1).group;
    while (history.position > 0 && this.entryAt(history.position - 1).group === group) {
      this.applyEntry(this.entryAt(history.position - 1), true);
      history.position--;
    }
    this.afterHistory();
    return true;
  },
  redo() {
    const history = this.history;
    if (!this.canRedo()) return false;
    const group = this.entryAt(history.position).group;
    while (history.position < history.length && this.entryAt(history.position).group === group) {
      this.applyEntry(this.entryAt(history.position), false);
      history.position++;
    }
    this.afterHistory();
    return true;
  },
  entryAt(position) { return this.history.entries[(this.history.start + position) % MAPEDIT_HISTORY_SIZE]; },
  afterHistory() {
    this.dirty = true;
    this.problemsFresh = false;
    this.announce('edit');
  },

  // ---- Selection and geometry ----
  select(list, index) {
    const same = this.selection.list === list && this.selection.index === index;
    this.selection.list = list; this.selection.index = index;
    if (!same) this.announce('selection');
  },
  clearSelection() { this.select('', -1); },
  selected() { return this.selection.list ? this.map[this.selection.list][this.selection.index] || null : null; },
  // Fills out (min xyz, max xyz) with the box an object occupies.
  bounds(list, object, out) {
    const kind = MAPEDIT_KINDS[list];
    if (kind.box) { out[0] = object.min[0]; out[1] = object.min[1]; out[2] = object.min[2]; out[3] = object.max[0]; out[4] = object.max[1]; out[5] = object.max[2]; return out; }
    const half = list === 'objectives' ? clamp(object.radius, kind.halfWidth, MAPEDIT_PICK_RADIUS) : kind.halfWidth;
    const base = kind.centred ? object.y - kind.height / 2 : object.y;
    out[0] = object.x - half; out[1] = base; out[2] = object.z - half;
    out[3] = object.x + half; out[4] = base + kind.height; out[5] = object.z + half;
    return out;
  },
  // The playable area an object may be moved inside: boxes may reach into the 3 m shell around the map, points stay inside.
  limitDelta(list, object, dx, dy, dz, out) {
    const size = this.map.size, box = this.bounds(list, object, this.scratch);
    const shell = MAPEDIT_KINDS[list].box ? MapRules.limits.shellThickness : 0, halfX = size[0] / 2 + shell, halfZ = size[2] / 2 + shell;
    out[0] = clamp(dx, -halfX - box[0], halfX - box[3]);
    out[1] = clamp(dy, MAPEDIT_FLOOR_LIMIT - box[1], size[1] + shell - box[4]);
    out[2] = clamp(dz, -halfZ - box[2], halfZ - box[5]);
    return out;
  },
  moved(list, object, dx, dy, dz) {
    const delta = this.limitDelta(list, object, dx, dy, dz, this.deltaScratch || (this.deltaScratch = [0, 0, 0]));
    const copy = mapEditClone(object);
    mapEditShift(list, copy, delta[0], delta[1], delta[2]);
    return copy;
  },
  turned(list, object) { const copy = mapEditClone(object); mapEditTurn(list, copy); return copy; },
  resized(list, object, axis, delta) { const copy = mapEditClone(object); return mapEditResize(list, copy, axis, delta) ? copy : null; },
  // Edits the selected object through mutate(copy); returns true when something changed.
  editSelected(mutate) {
    const object = this.selected();
    if (!object) return false;
    const copy = mapEditClone(object);
    mutate(copy);
    return this.replace(this.selection.list, this.selection.index, copy);
  },
  nudgeSelected(dx, dy, dz) {
    const object = this.selected();
    return !!object && this.replace(this.selection.list, this.selection.index, this.moved(this.selection.list, object, dx, dy, dz));
  },
  turnSelected() {
    const object = this.selected();
    return !!object && this.replace(this.selection.list, this.selection.index, this.turned(this.selection.list, object));
  },
  resizeSelected(axis, delta) {
    const object = this.selected();
    const next = object && this.resized(this.selection.list, object, axis, delta);
    return !!next && this.replace(this.selection.list, this.selection.index, next);
  },
  deleteSelected() {
    if (!this.selected()) return false;
    return this.deleteObject(this.selection.list, this.selection.index);
  },
  duplicateSelected(step) {
    const object = this.selected();
    if (!object) return -1;
    const list = this.selection.list;
    const copy = this.moved(list, object, step, 0, step);
    if (list === 'zones') copy.name = this.uniqueZoneName(object.name);
    if (list === 'objectives') copy.id = this.uniqueObjectiveId(object.kind);
    return this.add(list, copy);
  },
  uniqueZoneName(base) {
    const names = new Set(this.map.zones.map((zone) => zone.name));
    let name = base, number = 2;
    while (names.has(name)) name = base + ' ' + number++;
    return name;
  },
  uniqueObjectiveId(kind) {
    const ids = new Set(this.map.objectives.map((objective) => objective.id));
    let number = 1;
    while (ids.has(kind + number)) number++;
    return kind + number;
  },
  // The object of any list nearest to a point and within `reach` metres of its box, or null. out: { list, index }.
  objectNear(x, y, z, reach, out) {
    let best = Infinity;
    out.list = ''; out.index = -1;
    for (const list of MAPEDIT_NEAR_ORDER) {
      const items = this.map[list];
      for (let i = 0; i < items.length; i++) {
        const box = this.bounds(list, items[i], this.scratch);
        const gap = Math.hypot(Math.max(box[0] - x, 0, x - box[3]), Math.max(box[1] - y, 0, y - box[4]), Math.max(box[2] - z, 0, z - box[5]));
        if (gap <= reach && gap < best) { best = gap; out.list = list; out.index = i; }
      }
    }
    return out.index >= 0;
  },

  // ---- Map settings (each is one undoable edit) ----
  rename(name) { return this.setMeta('name', mapEditNameOf(name) || this.map.name); },
  setTheme(theme) {
    if (!MapRules.themes.includes(theme)) return false;
    this.group(() => { this.setMeta('theme', theme); this.setMeta('sky', mapEditSkyFor(theme)); });
    return true;
  },
  setSize(width, height, depth) { return this.setMeta('size', [width, height, depth === undefined ? this.map.size[2] : depth]); },
  setCategory(category) { return mapOwnKey(MapRules.sightLimits, category) && this.setMeta('category', category); },
  setModes(modes) { return this.setMeta('modes', modes.slice()); },

  // ---- Modes the map can serve ----
  // strict: the minimum counts of the validator (MapRules); otherwise one spawn per side and the objectives, enough to play a test match.
  feasibleModes(map, strict) {
    const modes = [];
    for (const mode in MapRules.modes) {
      if (!CAT.modes || !CAT.modes.byId(mode)) continue;
      if (this.modeReady(map, mode, strict)) modes.push(mode);
    }
    return modes;
  },
  modeReady(map, mode, strict) {
    const rule = MapRules.rule(mode);
    for (const [team, minimum] of MapRules.spawnRules[rule[0]]) {
      const have = map.spawns.filter((spawn) => Maps.spawnMatches(spawn, mode, team)).length;
      if (have < (strict ? minimum : 1)) return false;
    }
    for (const [kind, minimum] of rule[1]) if (Maps.objectivesFor(map, mode, kind).length < (strict ? minimum : 1)) return false;
    return true;
  },
  suggestModes() { return this.feasibleModes(this.map, true).filter((mode) => !MAPEDIT_AUTO_SKIP_MODES.includes(mode)); },
  // What a mode still lacks on this map (for the mode list), '' when it is ready.
  modeNeeds(map, mode) {
    const rule = MapRules.rule(mode), needs = [];
    for (const [team, minimum] of MapRules.spawnRules[rule[0]]) {
      const have = map.spawns.filter((spawn) => Maps.spawnMatches(spawn, mode, team)).length;
      if (have < minimum) needs.push((minimum - have) + ' more ' + (team < 0 ? 'free' : 'team ' + team) + ' spawn(s)');
    }
    for (const [kind, minimum] of rule[1]) {
      const have = Maps.objectivesFor(map, mode, kind).length;
      if (have < minimum) needs.push((minimum - have) + ' more ' + kind);
    }
    return needs.join(', ');
  },

  // ---- Validation (Maps.validate) and "jump to the problem" ----
  validate() {
    this.problems = Maps.validate(this.toMap());
    this.problemsFresh = true;
    this.announce('problems');
    return this.problems;
  },
  // problem text -> { list, index, x, y, z } for the object it names, or { list: '' } with only a position, or null.
  locate(problem) {
    const target = { list: '', index: -1, x: 0, y: 0, z: 0, found: false };
    const text = String(problem);
    const point = /\((-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\)/.exec(text);
    if (point) { target.x = +point[1]; target.y = +point[2]; target.z = +point[3]; target.found = true; }
    const named = this.locateNamed(text, target);
    if (!named && target.found) this.objectNear(target.x, target.y, target.z, MAPEDIT_PROBLEM_REACH, target);
    return target.list || target.found ? target : null;
  },
  // The validator names an object by list and number ("brush: #3 ...", "item #2 ..."), an objective by id and a zone by name.
  locateNamed(text, target) {
    const numbered = /^(brush|light|spawn|objectives|hints|props): #(\d+)/.exec(text) || /\b(item|hint|trigger) #(\d+)/.exec(text);
    if (numbered) return this.targetIn(target, MAPEDIT_PROBLEM_LISTS[numbered[1]], +numbered[2]);
    const objective = /objective (\S+) \(/.exec(text);
    if (objective) return this.targetIn(target, 'objectives', this.map.objectives.findIndex((entry) => entry.id === objective[1]));
    return this.targetIn(target, 'zones', this.map.zones.findIndex((zone) => mapEditNamesZone(text, zone.name)));
  },
  targetIn(target, list, index) {
    if (!this.map[list] || !this.map[list][index]) return false;   // props: an older map may lack the list
    target.list = list; target.index = index;
    this.centreOf(target);
    return true;
  },
  centreOf(target) {
    const box = this.bounds(target.list, this.map[target.list][target.index], this.scratch);
    target.x = (box[0] + box[3]) / 2; target.y = (box[1] + box[4]) / 2; target.z = (box[2] + box[5]) / 2;
    target.found = true;
  },

  // ---- Helpers that fill in what the validator asks for ----
  // Nine callout zones over the whole map (MAP-012), skipping names that exist. Returns the number added.
  addZoneGrid() {
    const size = this.map.size, existing = new Set(this.map.zones.map((zone) => zone.name));
    const wanted = MAPEDIT_GRID_ZONES.filter(([name]) => !existing.has(name));
    if (wanted.length > this.budgetLeft()) { this.refuse('Not enough budget for ' + wanted.length + ' zones.'); return 0; }
    this.group(() => {
      for (const [name, column, row] of wanted) this.add('zones', this.gridZone(name, column, row, size));
    });
    return wanted.length;
  },
  // The third of the map at `step` (-1, 0, 1) along an axis; the outer thirds reach into the shell so no floor is left out.
  gridZone(name, column, row, size) {
    const span = (axis, step) => {
      const third = size[axis] / 3, shell = MapRules.limits.shellThickness;
      return [step === -1 ? -size[axis] / 2 - shell : (step - 0.5) * third, step === 1 ? size[axis] / 2 + shell : (step + 0.5) * third];
    };
    const x = span(0, column), z = span(2, row);
    return MapKit.zone([name, x[0], z[0], x[1], z[1]]);
  },
  // One light above the middle of every zone that has none (up to the light limit). Returns the number added.
  addZoneLights() {
    let added = 0;
    this.group(() => {
      for (const zone of this.map.zones) added += this.lightZone(zone);
    });
    return added;
  },
  lightZone(zone) {
    const lit = this.map.lights.some((light) => mapInBox(zone, light.x, light.y, light.z, 2, 2));
    if (lit || this.map.lights.length >= MapRules.limits.lights) return 0;
    const centreX = (zone.min[0] + zone.max[0]) / 2, centreZ = (zone.min[2] + zone.max[2]) / 2;
    const y = Math.min(this.map.size[1] / 2, 6);
    return this.add('lights', MapKit.light([centreX, y, centreZ, MAPEDIT_LIGHT_COLOR, 16])) >= 0 ? 1 : 0;
  },

  // ---- Serialising: compact rows (the MapKit authoring format) <-> map rows ----
  compact(map) {
    const def = {};
    for (const key of MAPEDIT_CODE_KEYS) def[key] = map[key];
    def.v = MAPEDIT_CODE_VERSION;
    def.brushes = map.brushes.map((b) => [b.material, ...b.min, ...b.max].concat(b.shape === 'ramp' ? [b.dir] : []));
    def.spawns = map.spawns.map((s) => [s.team, s.modes, [[s.x, s.y, s.z, s.yaw]]]);
    def.items = map.items.map((i) => [i.item, i.x, i.y, i.z].concat(i.modes && i.modes.length ? [i.modes] : []));
    def.objectives = map.objectives;
    def.zones = map.zones.map((z) => [z.name, z.min[0], z.min[2], z.max[0], z.max[2], z.min[1], z.max[1]]);
    def.triggers = map.triggers;
    def.lights = map.lights.map((l) => [l.x, l.y, l.z, l.color, l.radius]);
    def.hints = map.navHints.map((h) => [h.kind, h.x, h.y, h.z]);
    def.props = map.props || [];
    return mapEditClone(def);
  },
  // def (parsed JSON, possibly hostile) -> { map } or { error }.
  expand(def) {
    const error = mapEditProblemWith(def);
    if (error) return { error };
    const map = MapKit.make(mapEditClone(mapEditCleanDef(def)));
    delete map.v;
    map.name = mapEditNameOf(map.name) || 'Untitled';
    for (const zone of map.zones) zone.name = mapEditNameOf(zone.name) || 'Zone';
    const problem = MapCheck.formProblem(map);
    return problem ? { error: 'The code holds an invalid map: ' + problem + '.' } : { map };
  },
  // The text codes (export, import) are MapEditorShare in 18i-ui-mapeditor.js: they use the custom match codec of the UI section.

  // ---- Start points: empty, a template or a copy of a built-in map ----
  newFrom(source) {
    const made = this.build(source);
    if (made.error) { this.refuse(made.error); return made; }
    this.reset(made.map, '');
    return made;
  },
  build(source) {
    if (source.kind === 'template') return this.fromTemplate(source.id);
    if (source.kind === 'builtin') return this.fromBuiltin(source.id);
    return { map: this.emptyMap() };
  },
  headerFor(theme, size, name) {
    return { id: MAPEDIT_DRAFT_ID, code: 'U00', name, size, theme, category: 'arena', modes: [], sky: mapEditSkyFor(theme), blurb: 'Your own map.',
      version: MapRules.version, placeholder: false, seed: 0 };
  },
  emptyMap() {
    const half = 20;
    return MapKit.make(Object.assign(this.headerFor('foundry', [40, 20, 40], 'Untitled map'), { brushes: [['concrete', -half, -1, -half, half, 0, half]], spawns: [], zones: [] }));
  },
  fromTemplate(id) {
    const template = MAPEDIT_TEMPLATES.find((row) => row.id === id);
    if (!template) return { error: 'Unknown template.' };
    const header = Object.assign(this.headerFor(template.theme, template.size, template.name), template.header || {});
    return { map: MapKit.make(Object.assign(header, mapEditClone(template.def()))) };
  },
  fromBuiltin(id) {
    const row = Maps.get(id);
    if (!row) return { error: 'Unknown map.' };
    const objects = mapEditObjectCount(row);
    if (objects > MAPEDIT_BUDGET) return { error: row.name + ' has ' + objects + ' objects, more than the budget of ' + MAPEDIT_BUDGET + '.' };
    const map = mapEditClone(row);
    Object.assign(map, { id: MAPEDIT_DRAFT_ID, code: 'U00', name: 'Copy of ' + row.name });
    return { map };
  },

  // ---- Saved maps (Save.data.editorMaps, up to 20) ----
  // The list in the save; an entry that is not a saved map (a damaged or edited save) is dropped.
  saved() {
    const list = Save.data.editorMaps;
    if (!Array.isArray(list)) Save.data.editorMaps = [];
    else if (!list.every(mapEditEntryIs)) Save.data.editorMaps = list.filter(mapEditEntryIs);
    return Save.data.editorMaps;
  },
  savedIndex(id) { return this.saved().findIndex((entry) => entry.id === id); },
  usedBytes() { return JSON.stringify(this.saved()).length; },
  freeBytes() { return MAPEDIT_SAFE_SAVE_BYTES - JSON.stringify(Save.data).length; },
  nextId() {
    const taken = new Set(this.saved().map((entry) => entry.id));
    let number = 1;
    while (taken.has(MAPEDIT_ID_PREFIX + number)) number++;
    return MAPEDIT_ID_PREFIX + number;
  },
  // Saves the map being edited (a new slot, or its own slot again). Returns true, or false after telling the player why not.
  saveCurrent(name) {
    const clean = mapEditNameOf(name || this.map.name);
    if (!clean) { this.refuse('Give the map a name first.'); return false; }
    const index = this.savedIndex(this.slotId);
    if (index < 0 && this.saved().length >= MAPEDIT_MAX_MAPS) { this.refuse('The map list is full (' + MAPEDIT_MAX_MAPS + ' maps). Delete one first.'); return false; }
    const id = index >= 0 ? this.slotId : this.nextId();
    const entry = this.entryFor(id, clean);
    const unreadable = this.expand(entry.data).error;   // the same check a reload runs: a saved map always reopens
    if (unreadable) { this.refuse('That map cannot be saved: ' + unreadable); return false; }
    const needed = entry.bytes - (index >= 0 ? this.saved()[index].bytes : 0);
    if (needed > this.freeBytes()) {
      this.refuse('Not enough room to save: this map needs ' + Math.ceil(needed / 1024) + ' KB, ' + Math.max(0, Math.floor(this.freeBytes() / 1024)) + ' KB are free. Delete a map first.');
      return false;
    }
    return this.store(entry, index);
  },
  // Saves the map being edited into a new slot even when it was loaded from one.
  saveAsNew() {
    const slot = this.slotId;
    this.slotId = '';
    if (this.saveCurrent()) return true;
    this.slotId = slot;
    return false;
  },
  entryFor(id, name) {
    const map = this.toMap();
    Object.assign(map, { id, name, code: 'U' + id.slice(MAPEDIT_ID_PREFIX.length).padStart(2, '0') });
    const entry = { id, name, modes: map.modes.slice(), data: this.compact(map), bytes: 0 };
    entry.bytes = JSON.stringify(entry).length + 8;
    return entry;
  },
  store(entry, index) {
    const list = this.saved(), previous = index >= 0 ? list[index] : null;
    if (previous) list[index] = entry; else list.push(entry);
    if (!Save.saveNow()) {
      if (previous) list[index] = previous; else list.pop();
      this.refuse('The map could not be written: storage is full or blocked.');
      return false;
    }
    this.map.id = entry.id; this.map.name = entry.name; this.map.code = 'U' + entry.id.slice(MAPEDIT_ID_PREFIX.length).padStart(2, '0');
    this.slotId = entry.id;
    this.dirty = false;
    this.syncRuntime();
    this.announce('saved');
    return true;
  },
  loadSaved(id) {
    const entry = this.saved()[this.savedIndex(id)];
    if (!entry) { this.refuse('That map is not in the list.'); return false; }
    const result = this.expand(entry.data);
    if (result.error) { this.refuse('That map could not be read: ' + result.error); return false; }
    this.reset(result.map, id);
    return true;
  },
  deleteSaved(id) {
    const index = this.savedIndex(id);
    if (index < 0) return false;
    this.saved().splice(index, 1);
    Save.saveNow();
    if (this.slotId === id) { this.slotId = ''; this.dirty = true; }
    this.syncRuntime();
    this.announce('saved');
    return true;
  },
  renameSaved(id, name) {
    const index = this.savedIndex(id), clean = mapEditNameOf(name);
    if (index < 0 || !clean) return false;
    this.saved()[index].name = clean;
    this.saved()[index].data.name = clean;
    Save.saveNow();
    if (this.slotId === id) this.map.name = clean;
    this.syncRuntime();
    this.announce('saved');
    return true;
  },
  // The saved maps that can be played become real maps of the game (Maps.forMode); everything else the editor registered is removed.
  syncRuntime() {
    for (const row of Maps.runtime.slice()) if (row.id.startsWith(MAPEDIT_ID_PREFIX)) Maps.unregisterRuntime(row.id);
    for (const entry of this.saved()) {
      const result = this.expand(entry.data);
      if (!result.error) this.registerPlayable(result.map);
    }
  },
  // A map is offered only for the modes it can serve (the validator's counts): a ctf match never starts on a map without flags.
  registerPlayable(map) {
    map.modes = this.readyModes(map);
    if (map.modes.length) Maps.registerRuntime(map);
  },
  // The modes the map lists that it also has the spawns and objectives for.
  readyModes(map) {
    const ready = this.feasibleModes(map, true);
    return map.modes.filter((mode) => ready.includes(mode));
  },
};

// Placed objects of a map, props included: the one count behind the editor budget, a copied built-in map and a saved map.
function mapEditObjectCount(map) {
  return MAP_REQUIRED_LISTS.reduce((sum, list) => sum + map[list].length, (map.props || []).length);
}

const mapEditEntryIs = (entry) => isPlainObject(entry) && /^user\d+$/.test(entry.id) && typeof entry.name === 'string' && isPlainObject(entry.data) && Array.isArray(entry.modes) && Number.isFinite(entry.bytes);

// Why a parsed code is not a map this version can hold, or '' when it is fine. A code is untrusted text: every number, list and text type is
// checked here; the keys and kinds (theme, category, modes, materials, item keys, trigger, objective and hint kinds) are the validator's form
// rules, which expand() runs on the built row (MapCheck.formProblem, one checker for every map).
function mapEditProblemWith(def) {
  if (!isPlainObject(def) || def.v !== MAPEDIT_CODE_VERSION) return 'The code holds no map of this version.';
  if (typeof def.name !== 'string' || !Array.isArray(def.size) || def.size.length !== 3 || !def.size.every((n) => mapEditFinite(n) && n >= MAPEDIT_SIZE_RANGE[0] && n <= MAPEDIT_SIZE_RANGE[1])) return 'The map size is invalid.';
  if (!isPlainObject(def.sky) || !mapColorIs(def.sky.top) || !mapColorIs(def.sky.horizon) || !mapEditTriple(def.sky.sun)
    || (def.sky.fog !== undefined && !mapColorIs(def.sky.fog)) || (def.sky.fogFar !== undefined && !mapEditFinite(def.sky.fogFar))) return 'The sky is invalid.';
  if (!Array.isArray(def.modes) || !mapEditStrings(def.modes)) return 'The mode list is invalid.';
  for (const key of ['brushes', 'spawns', 'items', 'objectives', 'zones', 'triggers', 'lights', 'hints']) if (!Array.isArray(def[key])) return 'The ' + key + ' list is missing.';
  if (def.props !== undefined && !Array.isArray(def.props)) return 'The props list is invalid.';   // codes made before props have none
  const props = def.props || [];
  const total = def.brushes.length + def.spawns.length + def.items.length + def.objectives.length + def.zones.length + def.triggers.length + def.lights.length + def.hints.length + props.length;
  if (total > MAPEDIT_BUDGET) return 'The map holds ' + total + ' objects, more than the budget of ' + MAPEDIT_BUDGET + '.';
  for (const [key, check] of Object.entries(MAPEDIT_ROW_CHECKS)) if (!def[key].every(check)) return 'A row of the ' + key + ' list is invalid.';
  if (!props.every(mapEditPropIs)) return 'A row of the props list is invalid.';
  return '';
}
const mapEditRowIs = (row, length, texts, numbers) => Array.isArray(row) && row.length >= length && texts.every((i) => typeof row[i] === 'string') && numbers.every((i) => mapEditFinite(row[i]));
const MAPEDIT_OBJECTIVE_KEYS = ['team', 'radius', 'path', 'modes', 'id', 'kind', 'x', 'y', 'z', 'stage', 'checkpoints'];
const MAPEDIT_TRIGGER_KEYS = ['kind', 'min', 'max', 'target', 'peak', 'exit', 'yaw', 'damage', 'element'];
const MAPEDIT_SKY_KEYS = ['top', 'horizon', 'fog', 'fogFar', 'sun'];
const MAPEDIT_PROP_KEYS = ['min', 'max', 'health', 'material', 'mass', 'debris', 'color'];   // the S08 prop row (PROP_FIELDS)
// A breakable prop box: min and max corners, the optional numbers finite, the colour a 0xRRGGBB one, the material a known one.
const mapEditPropIs = (prop) => isPlainObject(prop) && mapEditTriple(prop.min) && mapEditTriple(prop.max)
  && [prop.health, prop.mass, prop.debris].every(mapEditOptionalNumber) && (prop.color === undefined || mapColorIs(prop.color))
  && (prop.material === undefined || MapRules.materials.includes(prop.material));
const MAPEDIT_DEF_LISTS = ['brushes', 'spawns', 'items', 'objectives', 'zones', 'triggers', 'lights', 'hints'];
const mapEditText = (value, fallback, limit) => (typeof value === 'string' ? value.slice(0, limit || LABEL_MAX) : fallback);
const mapEditStrings = (list) => list.every((entry) => typeof entry === 'string' && entry.length <= LABEL_MAX);
const mapEditOptionalNumber = (value) => value === undefined || mapEditFinite(value);
const mapEditOptionalText = (value) => value === undefined || typeof value === 'string';
// A copy of an object with only the listed keys, in their own order (a key such as __proto__ never survives).
function mapEditKeep(object, keys) {
  const kept = {};
  for (const key of Object.keys(object)) if (keys.includes(key)) kept[key] = object[key];
  return kept;
}
// The checked def rebuilt from known fields only: what a code carried beyond them is dropped.
function mapEditCleanDef(def) {
  const clean = { v: MAPEDIT_CODE_VERSION, id: mapEditText(def.id, MAPEDIT_DRAFT_ID), code: mapEditText(def.code, 'U00'), name: def.name, size: def.size, theme: def.theme, category: def.category,
    sky: mapEditKeep(def.sky, MAPEDIT_SKY_KEYS), modes: def.modes, blurb: mapEditText(def.blurb, '', MAPEDIT_BLURB_MAX), version: mapEditFinite(def.version) ? def.version : MapRules.version,
    placeholder: def.placeholder === true, seed: mapEditFinite(def.seed) ? def.seed : 0 };
  for (const key of MAPEDIT_DEF_LISTS) clean[key] = def[key];
  clean.objectives = def.objectives.map((objective) => mapEditKeep(objective, MAPEDIT_OBJECTIVE_KEYS));
  clean.triggers = def.triggers.map((trigger) => mapEditKeep(trigger, MAPEDIT_TRIGGER_KEYS));
  clean.props = (def.props || []).map((prop) => mapEditKeep(prop, MAPEDIT_PROP_KEYS));
  return clean;
}
const MAPEDIT_ROW_CHECKS = {
  brushes: (row) => mapEditRowIs(row, 7, [0], [1, 2, 3, 4, 5, 6]) && row.length <= 8 && (row.length === 7 || typeof row[7] === 'string'),
  spawns: (row) => Array.isArray(row) && [-1, 0, 1].includes(row[0]) && Array.isArray(row[1]) && mapEditStrings(row[1]) && Array.isArray(row[2])
    && row[2].every((p) => Array.isArray(p) && p.length === 4 && p.every(mapEditFinite)),
  items: (row) => mapEditRowIs(row, 4, [0], [1, 2, 3]) && (row.length === 4 || (Array.isArray(row[4]) && mapEditStrings(row[4]))),
  objectives: (o) => isPlainObject(o) && [o.x, o.y, o.z, o.radius].every(mapEditFinite)
    && [o.team, o.stage].every(mapEditOptionalNumber) && (o.path === undefined || (Array.isArray(o.path) && o.path.every(mapEditTriple)))
    && (o.modes === undefined || (Array.isArray(o.modes) && mapEditStrings(o.modes))) && (o.checkpoints === undefined || (Array.isArray(o.checkpoints) && o.checkpoints.every(mapEditFinite))),
  zones: (row) => mapEditRowIs(row, 7, [0], [1, 2, 3, 4, 5, 6]),
  triggers: (t) => isPlainObject(t) && mapEditTriple(t.min) && mapEditTriple(t.max)
    && (t.target === undefined || mapEditTriple(t.target)) && (t.exit === undefined || mapEditTriple(t.exit)) && [t.peak, t.yaw, t.damage].every(mapEditOptionalNumber)
    && mapEditOptionalText(t.element),
  lights: (row) => mapEditRowIs(row, 5, [], [0, 1, 2, 4]),
  hints: (row) => mapEditRowIs(row, 4, [0], [1, 2, 3]),
};

// Sky colours and sun direction for a theme row (CAT.themes): the numbers a map row carries.
function mapEditSkyFor(themeId) {
  const theme = CAT.themes.byId(themeId) || CAT.themes[0];
  const color = (text) => parseInt(text.slice(1), 16);
  const sun = writeSunDirection(theme, [0, 0, 0]).map((n) => Math.round(n * 1000) / 1000);
  return { top: color(theme.skyTop), horizon: color(theme.skyHorizon), fog: color(theme.fog), fogFar: 140, sun };
}

// Saved maps become playable maps as soon as the game starts.
Bus.on('boot', () => MapEditor.syncRuntime());

// ---- Templates: compact MapKit lists (16a-maps.js). Each one passes Maps.validate for the modes it lists. ----
const mapEditGridRows = (size) => MAPEDIT_GRID_ZONES.map(([name, column, row]) => {
  const zone = MapEditor.gridZone(name, column, row, size);
  return [name, zone.min[0], zone.min[2], zone.max[0], zone.max[2]];
});

// Free for all on a 40 m square: a raised middle platform with four ramps, four pillars, low walls, 16 spawns round the edge.
function mapEditArenaDef() {
  const edge = 20, wall = 22;
  const spawns = [];
  for (const offset of [-14, -5, 5, 14]) spawns.push([offset, 0, -17, 0], [offset, 0, 17, 180]);
  for (const offset of [-12, -4, 4, 12]) spawns.push([-17, 0, offset, 90], [17, 0, offset, 270]);
  return {
    brushes: [
      ['concrete', -edge, -1, -edge, edge, 0, edge],
      ['concrete', -wall, -1, -wall, wall, 6, -edge], ['concrete', -wall, -1, edge, wall, 6, wall],
      ['concrete', -wall, -1, -edge, -edge, 6, edge], ['concrete', edge, -1, -edge, wall, 6, edge],
      ['metal', -3, 0, -3, 3, 2, 3],
      ['concrete', -3, 0, -7, 3, 2, -3, '+z'], ['concrete', -3, 0, 3, 3, 2, 7, '-z'], ['concrete', 3, 0, -3, 7, 2, 3, '-x'], ['concrete', -7, 0, -3, -3, 2, 3, '+x'],
      ['concrete', 9, 0, 9, 11, 1.8, 11], ['concrete', -11, 0, 9, -9, 1.8, 11], ['concrete', 9, 0, -11, 11, 1.8, -9], ['concrete', -11, 0, -11, -9, 1.8, -9],
      ['concrete', -4, 0, 14, 4, 1, 14.5], ['concrete', -4, 0, -14.5, 4, 1, -14], ['concrete', 14, 0, -4, 14.5, 1, 4], ['concrete', -14.5, 0, -4, -14, 1, 4],
    ],
    spawns: [[-1, [], spawns]],
    items: [['megacell', 0, 2, 0], ['heavyplate', -12, 0, 0], ['healthpack', 0, 0, 11], ['healthpack', 0, 0, -11], ['armorshard', 7, 0, 8], ['armorshard', -7, 0, -8],
      ['lancet', 8, 0, -8], ['scattergun', -8, 0, 8], ['ammobox', 0, 0, 8], ['ammobox', 0, 0, -8]],
    zones: mapEditGridRows([40, 20, 40]),
    lights: [[0, 8, 0, MAPEDIT_LIGHT_COLOR, 20], [12, 5, 12, MAPEDIT_LIGHT_COLOR, 14], [-12, 5, 12, MAPEDIT_LIGHT_COLOR, 14], [12, 5, -12, MAPEDIT_LIGHT_COLOR, 14], [-12, 5, -12, MAPEDIT_LIGHT_COLOR, 14]],
    hints: [['cover', -7, 0, -11], ['cover', 7, 0, 11], ['choke', -12, 0, 6], ['choke', 12, 0, -6], ['sniper', 2, 2, 2], ['flank', -14, 0, 12]],
  };
}

// Two sides on an 80 x 50 m yard, mirrored across a wall with three doors; a pillar behind every door blocks the line of sight between the bases.
// Top items must be as far from one team's spawns as from the other's (MAP-005), so they stand in the doors on the mirror line.
function mapEditYardDef() {
  const doors = [-16, 0, 16], spawns = [];
  for (const column of [-36, -33]) for (const offset of [-12, -4, 4, 12]) spawns.push([column, 0, offset, 90]);
  const half = {
    brushes: [['concrete', -42, -1, -27, 0, 6, -25], ['concrete', -42, -1, 25, 0, 6, 27], ['concrete', -42, -1, -25, -40, 6, 25],
      ['concrete', -29, 0, -9, -28, 1, -3], ['concrete', -29, 0, 3, -28, 1, 9]].concat(doors.map((centre) => ['concrete', -6, 0, centre - 4, -4, 3, centre + 4])),
    spawns: [[0, [], spawns]],
    items: [['armorshard', -20, 0, 0], ['healthvial', -20, 0, -20], ['healthpack', -10, 0, 12], ['healthpack', -10, 0, -12], ['armorshard', -12, 0, 6], ['armorshard', -12, 0, -6],
      ['lancet', -18, 0, 14], ['scattergun', -18, 0, -14], ['ammobox', -8, 0, 0], ['ammobox', -26, 0, 8]],
    objectives: [{ id: 'flagWest', kind: 'flag', team: 0, x: -28, y: 0, z: 0, radius: 2 }, { id: 'baseWest', kind: 'flagBase', team: 0, x: -31, y: 0, z: 0, radius: 2 }],
    lights: [[-20, 6, 0, MAPEDIT_LIGHT_COLOR, 20], [-30, 6, 15, MAPEDIT_LIGHT_COLOR, 16], [-30, 6, -15, MAPEDIT_LIGHT_COLOR, 16]],
    hints: [['cover', -24, 0, 6], ['cover', -24, 0, -6], ['choke', -8, 0, 8], ['choke', -8, 0, -8], ['flank', -12, 0, 20], ['sniper', -30, 0, 0]],
  };
  const full = { brushes: [['concrete', -40, -1, -25, 40, 0, 25]].concat(MapKit.wall('concrete', 'z', 0, 2, -25, 25, 0, 6, doors.map((centre) => [centre, 4, 3.5]))), zones: mapEditGridRows([80, 20, 50]),
    items: [['megacell', 0, 0, 0], ['heavyplate', 0, 0, 16]] };   // the top items stand in the doors: as far from one base as from the other
  return MapKit.join(MapKit.sym(half, 'x'), full);
}

const MAPEDIT_TEMPLATES = [
  { id: 'arena', name: 'Platform arena', blurb: 'Free for all on a 40 m square: a middle platform with ramps, pillars and 16 spawns.', theme: 'foundry', size: [40, 20, 40],
    header: { modes: ['ffa', 'duel'] }, def: mapEditArenaDef },
  { id: 'yard', name: 'Team yard', blurb: 'Two bases split by a wall with three doors: team modes and capture the flag.', theme: 'ruins', size: [80, 20, 50],
    header: { modes: ['tdm', 'ctf', 'elim', 'attrition'] }, def: mapEditYardDef },
];
