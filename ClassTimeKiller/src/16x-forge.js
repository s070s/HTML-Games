// ==== S16 MAPS: FORGE (EDITOR MODEL) ====
// Forge-lite map editor, model side (MAP-014): the map being edited (a normal map row), the object budget, undo / redo, serialising to the
// map data format, the saved map list in Save.data.editorMaps, text codes for sharing, and the start points (empty, template, copy of a
// built-in map). No DOM, no rendering, no input: 16x-forge-tools.js adds the cursor and placement tools, 18i-ui-forge.js the screens.
// Contract: docs/api/forge.md.

const FORGE_BUDGET = 400;                              // MAP-014: placed objects per map, all lists together
const FORGE_HISTORY_SIZE = 128;                        // undo steps kept; the ring never grows past this
const FORGE_MAX_MAPS = 20;                             // saved maps
const FORGE_SAFE_SAVE_BYTES = Math.floor(SAVE_MAX_BYTES * 0.9);   // a save that would pass this is refused (the whole save stays under 1 MB, ARC-020)
const FORGE_NAME_MAX = 40;
const FORGE_BLURB_MAX = 200;
const FORGE_ID_PREFIX = 'user';
const FORGE_DRAFT_ID = 'draft';
const FORGE_CODE_PREFIX = 'CTKMAP';
const FORGE_CODE_VERSION = 1;
const FORGE_CODE_MAX_CHARS = 60000;
const FORGE_CODE_MAX_BYTES = 262144;
const FORGE_COORD_LIMIT = 1000;                        // no coordinate of an imported map may be larger than this
const FORGE_SIZE_RANGE = [10, 400];
const FORGE_MIN_EXTENT = 0.5;                          // a resized box never gets thinner than this
const FORGE_FLOOR_LIMIT = -10;                         // the validator's lowest brush level
const FORGE_PICK_RADIUS = 3;                           // objectives are picked by at most this footprint
const FORGE_PROBLEM_REACH = 1.5;                       // metres: a problem's position selects the object this close to it
const FORGE_SNAPS = [0.5, 1, 2];                       // grid steps, metres
const FORGE_SIZES = [30, 40, 50, 60, 80, 100, 120, 160];   // map width and depth choices
const FORGE_HEIGHTS = [12, 20, 30, 40];
const FORGE_AUTO_SKIP_MODES = ['royale', 'range', 'puzzle'];   // never suggested automatically: they need a special map
const FORGE_GRID_ZONES = [['Northwest', -1, 1], ['North', 0, 1], ['Northeast', 1, 1], ['West', -1, 0], ['Middle', 0, 0], ['East', 1, 0],
  ['Southwest', -1, -1], ['South', 0, -1], ['Southeast', 1, -1]];   // callout zones laid over the map: name, column, row
const FORGE_LIGHT_COLOR = 0xffd9a0;
const FORGE_DIR_TURN = { '+z': '+x', '+x': '-z', '-z': '-x', '-x': '+z' };   // a quarter turn, the same way as spawn yaw + 90
const FORGE_CODE_KEYS = ['id', 'code', 'name', 'size', 'theme', 'category', 'sky', 'modes', 'blurb', 'version', 'placeholder', 'seed'];

// How each list of a map is placed and measured. box: a { min, max } volume; otherwise a point with a footprint and a height.
const FORGE_NEAR_ORDER = ['items', 'spawns', 'objectives', 'navHints', 'lights', 'triggers', 'brushes', 'zones'];   // a problem at a point most likely names a point object, so those win ties
const FORGE_KINDS = {
  brushes: { label: 'Brush', box: true },
  spawns: { label: 'Spawn', halfWidth: 0.4, height: 1.8 },
  items: { label: 'Item pad', halfWidth: 0.4, height: 0.9 },
  objectives: { label: 'Objective', halfWidth: 0.5, height: 3 },
  zones: { label: 'Zone', box: true },
  triggers: { label: 'Trigger', box: true },
  lights: { label: 'Light', halfWidth: 0.3, height: 0.6, centred: true },
  navHints: { label: 'Nav hint', halfWidth: 0.3, height: 0.6 },
};

const forgeClone = (value) => JSON.parse(JSON.stringify(value));
const forgeFinite = (value) => typeof value === 'number' && isFinite(value) && Math.abs(value) <= FORGE_COORD_LIMIT;
const forgeTriple = (value) => Array.isArray(value) && value.length === 3 && value.every(forgeFinite);
const forgeOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);   // never an inherited name such as __proto__
const forgeColor = (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffff;
const forgeNameOf = (text) => String(text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, FORGE_NAME_MAX);
const forgeAdd3 = (point, dx, dy, dz) => { point[0] += dx; point[1] += dy; point[2] += dz; };

// A quarter turn of a point around (cx, cz): the same direction as '+z' -> '+x' and spawn yaw + 90.
function forgeTurnPoint(point, cx, cz) {
  const u = point[0] - cx, v = point[2] - cz;
  point[0] = cx + v;
  point[2] = cz - u;
}
const forgeWrapDegrees = (degrees) => ((degrees % 360) + 360) % 360;
const forgeYawTurn = (yaw) => forgeWrapDegrees(yaw + 90);

// Mutating helpers: each works on a clone of an object and is followed by Forge.replace.
function forgeShift(list, object, dx, dy, dz) {
  if (!FORGE_KINDS[list].box) {
    object.x += dx; object.y += dy; object.z += dz;
    if (object.path) for (const point of object.path) forgeAdd3(point, dx, dy, dz);
    return;
  }
  forgeAdd3(object.min, dx, dy, dz);
  forgeAdd3(object.max, dx, dy, dz);
  if (object.target) forgeAdd3(object.target, dx, dy, dz);
  if (object.exit) forgeAdd3(object.exit, dx, dy, dz);
}

function forgeTurn(list, object) {
  if (list === 'spawns') { object.yaw = forgeYawTurn(object.yaw); return; }
  if (list === 'objectives') { for (const point of object.path || []) forgeTurnPoint(point, object.x, object.z); return; }
  if (!FORGE_KINDS[list].box) return;
  const cx = (object.min[0] + object.max[0]) / 2, cz = (object.min[2] + object.max[2]) / 2;
  const halfX = (object.max[0] - object.min[0]) / 2, halfZ = (object.max[2] - object.min[2]) / 2;
  object.min[0] = cx - halfZ; object.max[0] = cx + halfZ;
  object.min[2] = cz - halfX; object.max[2] = cz + halfX;
  if (object.dir) object.dir = FORGE_DIR_TURN[object.dir];
  if (object.target) forgeTurnPoint(object.target, cx, cz);
  if (object.exit) forgeTurnPoint(object.exit, cx, cz);
  if (typeof object.yaw === 'number') object.yaw = forgeYawTurn(object.yaw);
}

// Grows (positive) or shrinks one side of a box along an axis, or the radius of an objective or light. Returns false when nothing can change.
function forgeResize(list, object, axis, delta) {
  if (FORGE_KINDS[list].box) {
    const extent = object.max[axis] - object.min[axis] + delta;
    if (extent < FORGE_MIN_EXTENT) return false;
    object.max[axis] = object.min[axis] + extent;
    return true;
  }
  if (list !== 'objectives' && list !== 'lights') return false;
  const radius = object.radius + delta;
  if (radius < FORGE_MIN_EXTENT || radius > FORGE_COORD_LIMIT / 10) return false;
  object.radius = radius;
  return true;
}

const Forge = {
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
  history: { entries: new Array(FORGE_HISTORY_SIZE).fill(null), start: 0, length: 0, position: 0 },
  toastEvent: { text: '' },
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
  announce(what) { this.changedEvent.what = what; Bus.emit('forge.changed', this.changedEvent); },
  refuse(text) {
    this.message = text;
    this.toastEvent.text = text;
    Bus.emit('toast', this.toastEvent);
    return -1;
  },
  toMap() { return forgeClone(this.map); },

  // ---- Budget (MAP-014) ----
  count() {
    let total = 0;
    for (const list of MAP_REQUIRED_LISTS) total += this.map[list].length;
    return total;
  },
  budgetLeft() { return FORGE_BUDGET - this.count(); },
  countsText() { return MAP_REQUIRED_LISTS.map((list) => FORGE_KINDS[list].label + ' ' + this.map[list].length).join(', '); },

  // ---- Edits: every change is one history entry { op, list, index, before, after, group } ----
  add(list, object) {
    if (this.count() >= FORGE_BUDGET) return this.refuse('Object budget reached: ' + FORGE_BUDGET + ' objects per map.');
    if (list === 'lights' && this.map.lights.length >= MapRules.limits.lights) return this.refuse('A map holds at most ' + MapRules.limits.lights + ' lights.');
    const index = this.map[list].length;
    this.commit({ op: 'add', list, index, after: object });
    return index;
  },
  deleteObject(list, index) {
    if (!this.map[list][index]) return false;
    this.commit({ op: 'del', list, index, before: forgeClone(this.map[list][index]) });
    return true;
  },
  replace(list, index, object) {
    const before = this.map[list][index];
    if (!before || JSON.stringify(before) === JSON.stringify(object)) return false;
    this.commit({ op: 'set', list, index, before: forgeClone(before), after: object });
    return true;
  },
  setMeta(key, value) {
    if (JSON.stringify(this.map[key]) === JSON.stringify(value)) return false;
    this.commit({ op: 'meta', key, before: forgeClone(this.map[key]), after: value });
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
    const history = this.history, size = FORGE_HISTORY_SIZE;
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
    if (entry.op === 'meta') { this.map[entry.key] = forgeClone(undoing ? entry.before : entry.after); return; }
    const list = this.map[entry.list];
    const inserting = (entry.op === 'add') !== undoing;
    if (entry.op === 'set') list[entry.index] = forgeClone(undoing ? entry.before : entry.after);
    else if (inserting) list.splice(entry.index, 0, forgeClone(entry.op === 'add' ? entry.after : entry.before));
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
  entryAt(position) { return this.history.entries[(this.history.start + position) % FORGE_HISTORY_SIZE]; },
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
    const kind = FORGE_KINDS[list];
    if (kind.box) { out[0] = object.min[0]; out[1] = object.min[1]; out[2] = object.min[2]; out[3] = object.max[0]; out[4] = object.max[1]; out[5] = object.max[2]; return out; }
    const half = list === 'objectives' ? clamp(object.radius, kind.halfWidth, FORGE_PICK_RADIUS) : kind.halfWidth;
    const base = kind.centred ? object.y - kind.height / 2 : object.y;
    out[0] = object.x - half; out[1] = base; out[2] = object.z - half;
    out[3] = object.x + half; out[4] = base + kind.height; out[5] = object.z + half;
    return out;
  },
  // The playable area an object may be moved inside: boxes may reach into the 3 m shell around the map, points stay inside.
  limitDelta(list, object, dx, dy, dz, out) {
    const size = this.map.size, box = this.bounds(list, object, this.scratch);
    const shell = FORGE_KINDS[list].box ? MapRules.limits.shellThickness : 0, halfX = size[0] / 2 + shell, halfZ = size[2] / 2 + shell;
    out[0] = clamp(dx, -halfX - box[0], halfX - box[3]);
    out[1] = clamp(dy, FORGE_FLOOR_LIMIT - box[1], size[1] + shell - box[4]);
    out[2] = clamp(dz, -halfZ - box[2], halfZ - box[5]);
    return out;
  },
  moved(list, object, dx, dy, dz) {
    const delta = this.limitDelta(list, object, dx, dy, dz, this.deltaScratch || (this.deltaScratch = [0, 0, 0]));
    const copy = forgeClone(object);
    forgeShift(list, copy, delta[0], delta[1], delta[2]);
    return copy;
  },
  turned(list, object) { const copy = forgeClone(object); forgeTurn(list, copy); return copy; },
  resized(list, object, axis, delta) { const copy = forgeClone(object); return forgeResize(list, copy, axis, delta) ? copy : null; },
  // Edits the selected object through mutate(copy); returns true when something changed.
  editSelected(mutate) {
    const object = this.selected();
    if (!object) return false;
    const copy = forgeClone(object);
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
    for (const list of FORGE_NEAR_ORDER) {
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
  rename(name) { return this.setMeta('name', forgeNameOf(name) || this.map.name); },
  setTheme(theme) {
    if (!MapRules.themes.includes(theme)) return false;
    this.group(() => { this.setMeta('theme', theme); this.setMeta('sky', forgeSkyFor(theme)); });
    return true;
  },
  setSize(width, height) { return this.setMeta('size', [width, height, width]); },
  setCategory(category) { return forgeOwn(MapRules.sightLimits, category) && this.setMeta('category', category); },
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
  suggestModes() { return this.feasibleModes(this.map, true).filter((mode) => !FORGE_AUTO_SKIP_MODES.includes(mode)); },
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
    if (!named && target.found) this.objectNear(target.x, target.y, target.z, FORGE_PROBLEM_REACH, target);
    return target.list || target.found ? target : null;
  },
  locateNamed(text, target) {
    const numbered = /^(brush|light|spawn): #(\d+)/.exec(text) || /\b(item|hint) #(\d+)/.exec(text);
    if (numbered) {
      const list = { brush: 'brushes', light: 'lights', spawn: 'spawns', item: 'items', hint: 'navHints' }[numbered[1]];
      return this.targetIn(target, list, +numbered[2]);
    }
    const objective = /objective (\S+) \(/.exec(text);
    if (!objective) return false;
    return this.targetIn(target, 'objectives', this.map.objectives.findIndex((entry) => entry.id === objective[1]));
  },
  targetIn(target, list, index) {
    if (!this.map[list][index]) return false;
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
    const wanted = FORGE_GRID_ZONES.filter(([name]) => !existing.has(name));
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
    return this.add('lights', MapKit.light([centreX, y, centreZ, FORGE_LIGHT_COLOR, 16])) >= 0 ? 1 : 0;
  },

  // ---- Serialising: compact rows (the MapKit authoring format) <-> map rows ----
  compact(map) {
    const def = {};
    for (const key of FORGE_CODE_KEYS) def[key] = map[key];
    def.v = FORGE_CODE_VERSION;
    def.brushes = map.brushes.map((b) => [b.material, ...b.min, ...b.max].concat(b.shape === 'ramp' ? [b.dir] : []));
    def.spawns = map.spawns.map((s) => [s.team, s.modes, [[s.x, s.y, s.z, s.yaw]]]);
    def.items = map.items.map((i) => [i.item, i.x, i.y, i.z].concat(i.modes && i.modes.length ? [i.modes] : []));
    def.objectives = map.objectives;
    def.zones = map.zones.map((z) => [z.name, z.min[0], z.min[2], z.max[0], z.max[2], z.min[1], z.max[1]]);
    def.triggers = map.triggers;
    def.lights = map.lights.map((l) => [l.x, l.y, l.z, l.color, l.radius]);
    def.hints = map.navHints.map((h) => [h.kind, h.x, h.y, h.z]);
    return forgeClone(def);
  },
  // def (parsed JSON, possibly hostile) -> { map } or { error }.
  expand(def) {
    const error = forgeProblemWith(def);
    if (error) return { error };
    const map = MapKit.make(forgeClone(forgeCleanDef(def)));
    delete map.v;
    map.name = forgeNameOf(map.name) || 'Untitled';
    for (const zone of map.zones) zone.name = forgeNameOf(zone.name) || 'Zone';
    return { map };
  },
  exportCode(map) {
    const payload = CustomCodec.toBase64Url(CustomCodec.compress(new TextEncoder().encode(JSON.stringify(this.compact(map || this.map)))));
    return FORGE_CODE_PREFIX + FORGE_CODE_VERSION + '-' + CustomCodec.checksum(payload) + '-' + payload;
  },
  // text -> { map } or { error } with a message for the player. Nothing is changed.
  decodeCode(text) {
    const clean = String(text || '').replace(/\s+/g, '');
    if (clean.length > FORGE_CODE_MAX_CHARS) return { error: 'The code is too long to be a map code.' };
    const parts = /^CTKMAP(\d+)-([0-9a-f]{8})-([A-Za-z0-9_-]+)$/.exec(clean);
    if (!parts) return { error: 'This is not a ClassTimeKiller map code.' };
    if (Number(parts[1]) > FORGE_CODE_VERSION) return { error: 'This code was made by a newer version of the game.' };
    if (CustomCodec.checksum(parts[3]) !== parts[2]) return { error: 'The code is damaged: it does not match its check value. Copy it again.' };
    try {
      const bytes = CustomCodec.expand(CustomCodec.fromBase64Url(parts[3]), FORGE_CODE_MAX_BYTES);
      const def = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      return this.expand(def);
    } catch (error) {
      return { error: 'The code could not be read.' };
    }
  },
  importCode(text) {
    const result = this.decodeCode(text);
    if (result.error) return result;
    result.map.id = FORGE_DRAFT_ID;
    this.reset(result.map, '');
    return result;
  },

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
    return { id: FORGE_DRAFT_ID, code: 'U00', name, size, theme, category: 'arena', modes: [], sky: forgeSkyFor(theme), blurb: 'Your own map.',
      version: MapRules.version, placeholder: false, seed: 0 };
  },
  emptyMap() {
    const half = 20;
    return MapKit.make(Object.assign(this.headerFor('foundry', [40, 20, 40], 'Untitled map'), { brushes: [['concrete', -half, -1, -half, half, 0, half]], spawns: [], zones: [] }));
  },
  fromTemplate(id) {
    const template = FORGE_TEMPLATES.find((row) => row.id === id);
    if (!template) return { error: 'Unknown template.' };
    const header = Object.assign(this.headerFor(template.theme, template.size, template.name), template.header || {});
    return { map: MapKit.make(Object.assign(header, forgeClone(template.def()))) };
  },
  fromBuiltin(id) {
    const row = Maps.get(id);
    if (!row) return { error: 'Unknown map.' };
    const objects = MAP_REQUIRED_LISTS.reduce((sum, list) => sum + row[list].length, 0);
    if (objects > FORGE_BUDGET) return { error: row.name + ' has ' + objects + ' objects, more than the budget of ' + FORGE_BUDGET + '.' };
    const map = forgeClone(row);
    Object.assign(map, { id: FORGE_DRAFT_ID, code: 'U00', name: 'Copy of ' + row.name });
    return { map };
  },

  // ---- Saved maps (Save.data.editorMaps, up to 20) ----
  // The list in the save; an entry that is not a saved map (a damaged or edited save) is dropped.
  saved() {
    const list = Save.data.editorMaps;
    if (!Array.isArray(list)) Save.data.editorMaps = [];
    else if (!list.every(forgeEntryIs)) Save.data.editorMaps = list.filter(forgeEntryIs);
    return Save.data.editorMaps;
  },
  savedIndex(id) { return this.saved().findIndex((entry) => entry.id === id); },
  usedBytes() { return JSON.stringify(this.saved()).length; },
  freeBytes() { return FORGE_SAFE_SAVE_BYTES - JSON.stringify(Save.data).length; },
  nextId() {
    const taken = new Set(this.saved().map((entry) => entry.id));
    let number = 1;
    while (taken.has(FORGE_ID_PREFIX + number)) number++;
    return FORGE_ID_PREFIX + number;
  },
  // Saves the map being edited (a new slot, or its own slot again). Returns true, or false after telling the player why not.
  saveCurrent(name) {
    const clean = forgeNameOf(name || this.map.name);
    if (!clean) { this.refuse('Give the map a name first.'); return false; }
    const index = this.savedIndex(this.slotId);
    if (index < 0 && this.saved().length >= FORGE_MAX_MAPS) { this.refuse('The map list is full (' + FORGE_MAX_MAPS + ' maps). Delete one first.'); return false; }
    const id = index >= 0 ? this.slotId : this.nextId();
    const entry = this.entryFor(id, clean);
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
    Object.assign(map, { id, name, code: 'U' + id.slice(FORGE_ID_PREFIX.length).padStart(2, '0') });
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
    this.map.id = entry.id; this.map.name = entry.name; this.map.code = 'U' + entry.id.slice(FORGE_ID_PREFIX.length).padStart(2, '0');
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
    const index = this.savedIndex(id), clean = forgeNameOf(name);
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
    for (const row of Maps.runtime.slice()) if (row.id.startsWith(FORGE_ID_PREFIX)) Maps.unregisterRuntime(row.id);
    for (const entry of this.saved()) {
      const result = this.expand(entry.data);
      if (!result.error && result.map.modes.length) Maps.registerRuntime(result.map);
    }
  },
};

const forgeEntryIs = (entry) => isPlainObject(entry) && /^user\d+$/.test(entry.id) && typeof entry.name === 'string' && isPlainObject(entry.data) && Array.isArray(entry.modes) && Number.isFinite(entry.bytes);

// Why a parsed code is not a map this version can hold, or '' when it is fine. Every number and key is checked: a code is untrusted text.
function forgeProblemWith(def) {
  if (!isPlainObject(def) || def.v !== FORGE_CODE_VERSION) return 'The code holds no map of this version.';
  if (typeof def.name !== 'string' || !Array.isArray(def.size) || def.size.length !== 3 || !def.size.every((n) => forgeFinite(n) && n >= FORGE_SIZE_RANGE[0] && n <= FORGE_SIZE_RANGE[1])) return 'The map size is invalid.';
  if (!MapRules.themes.includes(def.theme) || !forgeOwn(MapRules.sightLimits, def.category)) return 'The map theme or category is unknown.';
  if (!isPlainObject(def.sky) || !forgeColor(def.sky.top) || !forgeColor(def.sky.horizon) || !forgeTriple(def.sky.sun)
    || (def.sky.fog !== undefined && !forgeColor(def.sky.fog)) || (def.sky.fogFar !== undefined && !forgeFinite(def.sky.fogFar))) return 'The sky is invalid.';
  if (!Array.isArray(def.modes) || !def.modes.every((mode) => forgeOwn(MapRules.modes, mode))) return 'The mode list is invalid.';
  for (const key of ['brushes', 'spawns', 'items', 'objectives', 'zones', 'triggers', 'lights', 'hints']) if (!Array.isArray(def[key])) return 'The ' + key + ' list is missing.';
  const total = def.brushes.length + def.spawns.length + def.items.length + def.objectives.length + def.zones.length + def.triggers.length + def.lights.length + def.hints.length;
  if (total > FORGE_BUDGET) return 'The map holds ' + total + ' objects, more than the budget of ' + FORGE_BUDGET + '.';
  for (const [key, check] of Object.entries(FORGE_ROW_CHECKS)) if (!def[key].every(check)) return 'A row of the ' + key + ' list is invalid.';
  return '';
}
const forgeRowIs = (row, length, texts, numbers) => Array.isArray(row) && row.length >= length && texts.every((i) => typeof row[i] === 'string') && numbers.every((i) => forgeFinite(row[i]));
const FORGE_OBJECTIVE_KEYS = ['team', 'radius', 'path', 'modes', 'id', 'kind', 'x', 'y', 'z', 'stage', 'checkpoints'];
const FORGE_TRIGGER_KEYS = ['kind', 'min', 'max', 'target', 'peak', 'exit', 'yaw', 'damage', 'element'];
const FORGE_SKY_KEYS = ['top', 'horizon', 'fog', 'fogFar', 'sun'];
const FORGE_DEF_LISTS = ['brushes', 'spawns', 'items', 'objectives', 'zones', 'triggers', 'lights', 'hints'];
const forgeText = (value, fallback, limit) => (typeof value === 'string' ? value.slice(0, limit || FORGE_NAME_MAX) : fallback);
const forgeStrings = (list) => list.every((entry) => typeof entry === 'string' && entry.length <= FORGE_NAME_MAX);
const forgeOptionalNumber = (value) => value === undefined || forgeFinite(value);
// A copy of an object with only the listed keys, in their own order (a key such as __proto__ never survives).
function forgeKeep(object, keys) {
  const kept = {};
  for (const key of Object.keys(object)) if (keys.includes(key)) kept[key] = object[key];
  return kept;
}
// The checked def rebuilt from known fields only: what a code carried beyond them is dropped.
function forgeCleanDef(def) {
  const clean = { v: FORGE_CODE_VERSION, id: forgeText(def.id, FORGE_DRAFT_ID), code: forgeText(def.code, 'U00'), name: def.name, size: def.size, theme: def.theme, category: def.category,
    sky: forgeKeep(def.sky, FORGE_SKY_KEYS), modes: def.modes, blurb: forgeText(def.blurb, '', FORGE_BLURB_MAX), version: forgeFinite(def.version) ? def.version : MapRules.version,
    placeholder: def.placeholder === true, seed: forgeFinite(def.seed) ? def.seed : 0 };
  for (const key of FORGE_DEF_LISTS) clean[key] = def[key];
  clean.objectives = def.objectives.map((objective) => forgeKeep(objective, FORGE_OBJECTIVE_KEYS));
  clean.triggers = def.triggers.map((trigger) => forgeKeep(trigger, FORGE_TRIGGER_KEYS));
  return clean;
}
const FORGE_ROW_CHECKS = {
  brushes: (row) => forgeRowIs(row, 7, [0], [1, 2, 3, 4, 5, 6]) && row.length <= 8 && MapRules.materials.includes(row[0]) && (row.length === 7 || ['+x', '-x', '+z', '-z'].includes(row[7])),
  spawns: (row) => Array.isArray(row) && [-1, 0, 1].includes(row[0]) && Array.isArray(row[1]) && forgeStrings(row[1]) && Array.isArray(row[2])
    && row[2].every((p) => Array.isArray(p) && p.length === 4 && p.every(forgeFinite)),
  items: (row) => forgeRowIs(row, 4, [0], [1, 2, 3]) && MapRules.groupOf(row[0]) !== '' && (row.length === 4 || (Array.isArray(row[4]) && forgeStrings(row[4]))),
  objectives: (o) => isPlainObject(o) && typeof o.id === 'string' && MapRules.objectiveKinds.includes(o.kind) && [o.x, o.y, o.z, o.radius].every(forgeFinite)
    && [o.team, o.stage].every(forgeOptionalNumber) && (o.path === undefined || (Array.isArray(o.path) && o.path.every(forgeTriple)))
    && (o.modes === undefined || (Array.isArray(o.modes) && forgeStrings(o.modes))) && (o.checkpoints === undefined || (Array.isArray(o.checkpoints) && o.checkpoints.every(forgeFinite))),
  zones: (row) => forgeRowIs(row, 7, [0], [1, 2, 3, 4, 5, 6]),
  triggers: (t) => isPlainObject(t) && MapRules.triggerKinds.includes(t.kind) && forgeTriple(t.min) && forgeTriple(t.max)
    && (t.target === undefined || forgeTriple(t.target)) && (t.exit === undefined || forgeTriple(t.exit)) && [t.peak, t.yaw, t.damage].every(forgeOptionalNumber)
    && (t.element === undefined || MapRules.elements.includes(t.element)),
  lights: (row) => forgeRowIs(row, 5, [], [0, 1, 2, 4]) && forgeColor(row[3]),
  hints: (row) => forgeRowIs(row, 4, [0], [1, 2, 3]) && MapRules.hintKinds.includes(row[0]),
};

// Sky colours and sun direction for a theme row (CAT.themes): the numbers a map row carries.
function forgeSkyFor(themeId) {
  const theme = CAT.themes.byId(themeId) || CAT.themes[0];
  const color = (text) => parseInt(text.slice(1), 16);
  const elevation = theme.sunElevation * DEG, azimuth = theme.sunAzimuth * DEG;
  const sun = [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)].map((n) => Math.round(n * 1000) / 1000);
  return { top: color(theme.skyTop), horizon: color(theme.skyHorizon), fog: color(theme.fog), fogFar: 140, sun };
}

// Saved maps become playable maps as soon as the game starts.
Bus.on('boot', () => Forge.syncRuntime());

// ---- Templates: compact MapKit lists (16a-maps.js). Each one passes Maps.validate for the modes it lists. ----
const forgeGridRows = (size) => FORGE_GRID_ZONES.map(([name, column, row]) => {
  const zone = Forge.gridZone(name, column, row, size);
  return [name, zone.min[0], zone.min[2], zone.max[0], zone.max[2]];
});

// Free for all on a 40 m square: a raised middle platform with four ramps, four pillars, low walls, 16 spawns round the edge.
function forgeArenaDef() {
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
    zones: forgeGridRows([40, 20, 40]),
    lights: [[0, 8, 0, FORGE_LIGHT_COLOR, 20], [12, 5, 12, FORGE_LIGHT_COLOR, 14], [-12, 5, 12, FORGE_LIGHT_COLOR, 14], [12, 5, -12, FORGE_LIGHT_COLOR, 14], [-12, 5, -12, FORGE_LIGHT_COLOR, 14]],
    hints: [['cover', -7, 0, -11], ['cover', 7, 0, 11], ['choke', -12, 0, 6], ['choke', 12, 0, -6], ['sniper', 2, 2, 2], ['flank', -14, 0, 12]],
  };
}

// Two sides on an 80 x 50 m yard, mirrored across a wall with three doors; a pillar behind every door blocks the line of sight between the bases.
// Top items must be as far from one team's spawns as from the other's (MAP-005), so they stand in the doors on the mirror line.
function forgeYardDef() {
  const doors = [-16, 0, 16], spawns = [];
  for (const column of [-36, -33]) for (const offset of [-12, -4, 4, 12]) spawns.push([column, 0, offset, 90]);
  const half = {
    brushes: [['concrete', -42, -1, -27, 0, 6, -25], ['concrete', -42, -1, 25, 0, 6, 27], ['concrete', -42, -1, -25, -40, 6, 25],
      ['concrete', -29, 0, -9, -28, 1, -3], ['concrete', -29, 0, 3, -28, 1, 9]].concat(doors.map((centre) => ['concrete', -6, 0, centre - 4, -4, 3, centre + 4])),
    spawns: [[0, [], spawns]],
    items: [['armorshard', -20, 0, 0], ['healthvial', -20, 0, -20], ['healthpack', -10, 0, 12], ['healthpack', -10, 0, -12], ['armorshard', -12, 0, 6], ['armorshard', -12, 0, -6],
      ['lancet', -18, 0, 14], ['scattergun', -18, 0, -14], ['ammobox', -8, 0, 0], ['ammobox', -26, 0, 8]],
    objectives: [{ id: 'flagWest', kind: 'flag', team: 0, x: -28, y: 0, z: 0, radius: 2 }, { id: 'baseWest', kind: 'flagBase', team: 0, x: -31, y: 0, z: 0, radius: 2 }],
    lights: [[-20, 6, 0, FORGE_LIGHT_COLOR, 20], [-30, 6, 15, FORGE_LIGHT_COLOR, 16], [-30, 6, -15, FORGE_LIGHT_COLOR, 16]],
    hints: [['cover', -24, 0, 6], ['cover', -24, 0, -6], ['choke', -8, 0, 8], ['choke', -8, 0, -8], ['flank', -12, 0, 20], ['sniper', -30, 0, 0]],
  };
  const full = { brushes: [['concrete', -40, -1, -25, 40, 0, 25]].concat(MapKit.wall('concrete', 'z', 0, 2, -25, 25, 0, 6, doors.map((centre) => [centre, 4, 3.5]))), zones: forgeGridRows([80, 20, 50]),
    items: [['megacell', 0, 0, 0], ['heavyplate', 0, 0, 16]] };   // the top items stand in the doors: as far from one base as from the other
  return MapKit.join(MapKit.sym(half, 'x'), full);
}

const FORGE_TEMPLATES = [
  { id: 'arena', name: 'Foundry arena', blurb: 'Free for all on a 40 m square: a middle platform with ramps, pillars and 16 spawns.', theme: 'foundry', size: [40, 20, 40],
    header: { modes: ['ffa', 'duel'] }, def: forgeArenaDef },
  { id: 'yard', name: 'Team yard', blurb: 'Two bases split by a wall with three doors: team modes and capture the flag.', theme: 'ruins', size: [80, 20, 50],
    header: { modes: ['tdm', 'ctf', 'elim', 'attrition'] }, def: forgeYardDef },
];
