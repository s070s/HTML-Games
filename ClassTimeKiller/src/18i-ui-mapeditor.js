// ==== S18 UI: MAP EDITOR (SCREENS) ====
// The editor screen (a pass-through layer over the 3D view: top bar, tool palette, properties of the selection, status line and the touch buttons)
// and the dialogs it opens: menu, new map, my maps, validation, codes, test-play, map settings, modes. Every screen is built from the MapEditor model
// (16x-mapeditor.js) and the tools (16x-mapeditor-tools.js); all three devices reach the same commands. Contract: docs/api/mapeditor.md.

const MAPEDIT_PANEL_MIN_WIDTH = 760;          // narrower or lower screens start with the side panels hidden
const MAPEDIT_PANEL_MIN_HEIGHT = 440;
const MAPEDIT_STATUS_SECONDS = 0.2;           // how often the cursor text is refreshed
const MAPEDIT_BUDGET_WARNING = 0.9;           // the budget counter turns amber past this share
const MAPEDIT_LIGHT_COLORS = [[0xffd9a0, 'Warm'], [0xffffff, 'White'], [0x9fc8ff, 'Cool'], [0xff9060, 'Red']];
const MAPEDIT_CODE_PREFIX = 'CTKEDIT';       // not the generator's CTKMAP settings code (16w): each paste box knows its own codes
const MAPEDIT_CODE_MAX_CHARS = 60000;        // a longer text is refused before anything is decoded
const MAPEDIT_CODE_MAX_BYTES = 262144;       // the unpacked JSON may not be larger than this
const MAPEDIT_CODE_FORMAT = shareCodeFormat(MAPEDIT_CODE_PREFIX, MAPEDIT_CODE_VERSION, 0, MAPEDIT_CODE_MAX_CHARS, MAPEDIT_CODE_MAX_BYTES, 'map');
// Codes of the first editor version: the same framing and v1 rows (without the later props list, which expand() reads as empty) under the
// prefix CTKMAP, since then given to the generator's settings codes (16w). They are still read; new codes always use MAPEDIT_CODE_PREFIX.
const MAPEDIT_LEGACY_CODE_PREFIX = 'CTKMAP';
const MAPEDIT_LEGACY_CODE_VERSION = 1;
const MAPEDIT_LEGACY_CODE_FORMAT = shareCodeFormat(MAPEDIT_LEGACY_CODE_PREFIX, MAPEDIT_LEGACY_CODE_VERSION, MAPEDIT_LEGACY_CODE_VERSION, MAPEDIT_CODE_MAX_CHARS, MAPEDIT_CODE_MAX_BYTES, 'map');
const MAPEDIT_PLAY_SEED_RANGE = 99999;
const MAPEDIT_KIND_CHANGE_TURNS = 1;         // a trigger whose kind is changed in the panel gets its far end towards +x
// Parts of the editor screen a change of the model has to redraw (see MapEditorUi.mark).
const MAPEDIT_PART_TOP = 1, MAPEDIT_PART_PALETTE = 2, MAPEDIT_PART_PROPERTIES = 4, MAPEDIT_PART_DIALOG = 8;
const MAPEDIT_PARTS_BY_CHANGE = { map: 15, edit: MAPEDIT_PART_TOP | MAPEDIT_PART_PROPERTIES | MAPEDIT_PART_DIALOG, selection: MAPEDIT_PART_PROPERTIES | MAPEDIT_PART_DIALOG,
  tool: MAPEDIT_PART_TOP | MAPEDIT_PART_PALETTE | MAPEDIT_PART_DIALOG, saved: MAPEDIT_PART_TOP, problems: 0 };
const MAPEDIT_HELP = {
  kbm: 'WASD fly, E / Q up and down, hold right mouse to look, click to place, wheel to turn, G grab, Del delete, F snap, Ctrl+Z / Ctrl+Y undo and redo.',
  gamepad: 'Sticks fly and look, RT / LT up and down, A place, B delete, X turn, Y grab, LB / RB option, D-pad up / down tool, D-pad left snap, View undo, Start menu.',
  touch: 'Drag to move the cursor, two fingers to look, the buttons fly the camera. Place puts the object at the cursor.',
};
// On-screen buttons for touch (INP: all three devices). hold: a camera move while pressed; command: one action per tap.
const MAPEDIT_TOUCH_MOVES = [['Fwd', 'forward'], ['Back', 'back'], ['Left', 'left'], ['Right', 'right'], ['Up', 'up'], ['Down', 'down'],
  ['Turn L', 'turnLeft'], ['Turn R', 'turnRight'], ['Look up', 'lookUp'], ['Look dn', 'lookDown']];
const MAPEDIT_TOUCH_ACTIONS = [['Place', 'primary', 'primary'], ['Delete', 'secondary', 'danger'], ['Turn', 'rotate', ''], ['Grab', 'grab', ''], ['Undo', 'undo', ''], ['Redo', 'redo', '']];

const MAPEDIT_CSS = '.ui-mapEditor { padding: 0; background: none; } .ui-mapEditor > * { pointer-events: auto; }'
  + '.me-top { position: absolute; top: 0; left: 0; right: 0; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: calc(6px + var(--safe-top)) calc(8px + var(--safe-right)) 6px calc(8px + var(--safe-left));'
  + ' background: linear-gradient(rgba(5, 8, 12, 0.85), rgba(5, 8, 12, 0)); pointer-events: none; } .me-top > * { pointer-events: auto; }'
  + '.me-top .ui-button, .me-panel .ui-button, .me-touch .ui-button { min-height: 36px; padding: 0.25em 0.65em; font-size: 0.9em; text-align: center; }'
  + '.me-budget { padding: 0.25em 0.6em; border-radius: 8px; background: var(--ui-bg); border: 1px solid var(--ui-line); font-variant-numeric: tabular-nums; } .me-budget.warn { border-color: var(--ui-accent); } .me-budget.full { border-color: var(--ui-bad); }'
  + '.me-panel { position: absolute; top: calc(52px + var(--safe-top)); bottom: calc(46px + var(--safe-bottom)); width: min(210px, 34vw); overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 6px;'
  + ' background: var(--ui-bg); border: 1px solid var(--ui-line); border-radius: 10px; touch-action: pan-y; }'
  + '.me-panel > * { flex-shrink: 0; } .me-left { left: calc(8px + var(--safe-left)); } .me-right { right: calc(8px + var(--safe-right)); width: min(250px, 38vw); }'
  + '.me-panel .ui-row { flex-direction: column; align-items: stretch; min-height: 34px; padding: 4px 6px; margin: 0; gap: 2px; } .me-panel .ui-label { min-width: 0; font-size: 0.875em; }'
  + '.me-panel .ui-cycle { min-width: 6em; } .me-panel .ui-group { margin: 6px 0 2px; font-size: 0.875em; } .me-panel .ui-note { margin: 0; font-size: 0.875em; }'
  + '.me-step { display: flex; align-items: center; gap: 4px; } .me-step .ui-button { min-width: 36px; padding: 0.25em 0.4em; } .me-step .ui-value { flex: 1; min-width: 3em; text-align: center; } .me-panel .ui-cycle { width: 100%; }'
  + '.me-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; } .me-name { background: var(--ui-panel); color: var(--ui-text); border: 1px solid var(--ui-line); border-radius: 8px; padding: 6px; font: inherit; min-width: 0; width: 100%; }'
  + '.me-status { position: absolute; left: 0; right: 0; bottom: 0; padding: 6px calc(10px + var(--safe-right)) calc(6px + var(--safe-bottom)) calc(10px + var(--safe-left)); pointer-events: none;'
  + ' background: linear-gradient(rgba(5, 8, 12, 0), rgba(5, 8, 12, 0.85)); font-size: 0.875em; color: var(--ui-dim); } .me-status b { color: var(--ui-text); font-weight: 600; }'
  + '.me-touch { position: absolute; left: 0; right: 0; bottom: calc(38px + var(--safe-bottom)); display: none; justify-content: space-between; align-items: flex-end; padding: 0 calc(10px + var(--safe-right)) 0 calc(10px + var(--safe-left)); pointer-events: none; }'
  + '.me-touch.show { display: flex; } .me-touch > * { pointer-events: auto; } .me-pad { display: grid; gap: 4px; }'
  + '.me-moves { grid-template-columns: repeat(5, minmax(52px, 1fr)); width: min(330px, 56vw); } .me-acts { grid-template-columns: repeat(3, minmax(52px, 1fr)); width: min(200px, 34vw); }'
  + '.me-touch .ui-button { min-height: 42px; min-width: 0; padding: 0.2em; font-size: 0.875em; opacity: 0.88; touch-action: none; } .ui-mapEditor.me-nopanels .me-panel { display: none; }'
  + '@media (max-width: 600px) { .me-touch { flex-direction: column; align-items: stretch; gap: 6px; } .me-moves, .me-acts { width: auto; } .me-acts { grid-template-columns: repeat(6, 1fr); } }'
  + '.me-problem { display: block; width: 100%; margin-bottom: 4px; }'
  + '.me-maprow { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; } .me-maprow .me-name { flex: 1; min-width: 8em; } .me-error { color: var(--ui-bad); }'
  + '@media (pointer: coarse) { .me-top .ui-button, .me-panel .ui-button { min-height: 44px; } } @media (max-width: 720px) { .me-panel { width: min(170px, 36vw); } }';

// The fields of the selected object per list, beyond position and size. cycle: choose a value; step: +/- a number; text: a name.
const mapEditTeamField = { label: 'Team', kind: 'cycle', values: () => [-1, 0, 1], texts: mapEditTeamTexts, get: (o) => o.team, set: (o, v) => { o.team = v; } };
const MAPEDIT_FIELDS = {
  brushes: [{ label: 'Material', kind: 'cycle', values: () => MapRules.materials, get: (o) => o.material, set: (o, v) => { o.material = v; } }],
  spawns: [mapEditTeamField],
  props: [],   // breakable props: no editable fields yet (a problem on one still selects it)
  items: [{ label: 'Item', kind: 'cycle', values: mapEditAllItemKeys, texts: (values) => values.map(mapEditItemName), get: (o) => o.item, set: (o, v) => { o.item = v; o.group = MapRules.groupOf(v); } }],
  objectives: [
    { label: 'Kind', kind: 'cycle', values: () => MapRules.objectiveKinds, get: (o) => o.kind, set: mapEditSetObjectiveKind },
    mapEditTeamField,
    { label: 'Stage', kind: 'cycle', values: () => [0, 1, 2, 3], texts: (values) => values.map((v) => (v ? String(v) : 'none')), get: (o) => o.stage || 0, show: (o) => o.kind === 'bombsite',
      set: (o, v) => { if (v) o.stage = v; else delete o.stage; } },
  ],
  zones: [{ label: 'Name', kind: 'text', get: (o) => o.name, set: (o, v) => { o.name = mapEditNameOf(v) || o.name; } }],
  triggers: [
    { label: 'Kind', kind: 'cycle', values: () => MapRules.triggerKinds, get: (o) => o.kind, set: (o, v) => mapEditTriggerDefaults(o, v, MAPEDIT_KIND_CHANGE_TURNS) },
    { label: 'Peak', kind: 'step', step: 0.5, get: (o) => o.peak, apply: (o, d) => { o.peak = Math.max(0.5, o.peak + d); }, show: (o) => o.kind === 'jumppad' },
    { label: 'Damage', kind: 'step', step: 5, get: (o) => o.damage, apply: (o, d) => { o.damage = Math.max(5, o.damage + d); }, show: (o) => o.kind === 'hazard' },
    { label: 'Element', kind: 'cycle', values: () => MapRules.elements, get: (o) => o.element, set: (o, v) => { o.element = v; }, show: (o) => o.kind === 'hazard' },
    { label: 'Exit yaw', kind: 'step', step: 45, get: (o) => o.yaw, apply: (o, d) => { o.yaw = mapEditWrapDegrees(o.yaw + d); }, show: (o) => o.kind === 'teleporter' },
  ].concat(['X', 'Y', 'Z'].map((name, axis) => ({ label: 'Far end ' + name, kind: 'step', step: 0.5, get: (o) => (o.target || o.exit)[axis],
    apply: (o, d) => { (o.target || o.exit)[axis] += d; }, show: (o) => !!(o.target || o.exit) }))),
  lights: [{ label: 'Colour', kind: 'cycle', values: () => MAPEDIT_LIGHT_COLORS.map((row) => row[0]), texts: () => MAPEDIT_LIGHT_COLORS.map((row) => row[1]), get: (o) => o.color, set: (o, v) => { o.color = v; } }],
  navHints: [{ label: 'Kind', kind: 'cycle', values: () => MapRules.hintKinds, get: (o) => o.kind, set: (o, v) => { o.kind = v; } }],
};
function mapEditSetObjectiveKind(objective, kind) {
  objective.kind = kind;
  if (kind === 'payloadPath' && !(objective.path && objective.path.length)) objective.path = [[objective.x, objective.y, objective.z]];
}

const MapEditorUi = {
  root: null, top: null, left: null, right: null, status: null, touch: null, cursorText: null,
  undoButton: null, redoButton: null, snapButton: null, panelsButton: null, touchButton: null, budget: null, nameTag: null,   // the top bar, built once and updated in place
  dialogRefresh: null,                  // fn() of the open dialog that mirrors the panels (the tool and object dialog)
  pending: 0,                           // MAPEDIT_PART_* bits waiting for the next frame
  shownSnap: -1,                        // the snap step the properties panel was built for (its buttons move by it)
  touchShown: false, panelsShown: true, statusTimer: 0, shownX: NaN, shownY: NaN, shownZ: NaN, shownValid: false,

  // ---- small builders ----
  stepper(label, valueText, onMinus, onPlus) {
    const wrap = makeElement('div', 'me-step');
    wrap.appendChild(Ui.button('-', onMinus));
    wrap.appendChild(makeElement('span', 'ui-value', valueText));
    wrap.appendChild(Ui.button('+', onPlus));
    return Ui.row(label, wrap);
  },
  nameInput(value, onChange) {
    const input = makeElement('input', 'me-name');
    input.type = 'text'; input.value = value; input.maxLength = MAPEDIT_NAME_MAX;
    input.addEventListener('change', () => onChange(input.value));
    return input;
  },
  fixed(value) { return (Math.round(value * 100) / 100).toString(); },
  // Empties a panel and fills it again; the control that had the keyboard focus gets it back (by its place in the panel).
  rebuild(panel, fill) {
    const controls = () => Array.from(panel.querySelectorAll('button, input, textarea'));
    const focused = controls().indexOf(document.activeElement);
    panel.replaceChildren();
    fill(panel);
    const next = focused >= 0 ? controls()[focused] : null;
    if (next) next.focus();
  },

  // Leaves the editor from the menu (asks first when the map has unsaved changes).
  exit() {
    const leave = () => { Ui.back(); Ui.pop(); };
    if (!MapEditor.dirty) { leave(); return; }
    Ui.confirm({ title: 'Leave the editor?', text: 'The map has changes that were not saved.', yes: 'Leave', onYes: leave });
  },

  // ---- the editor screen ----
  build(root) {
    this.root = root;
    root.classList.add('ui-mapEditor');
    this.top = makeElement('div', 'me-top');
    this.left = makeElement('div', 'me-panel me-left');
    this.right = makeElement('div', 'me-panel me-right');
    this.status = makeElement('div', 'me-status');
    this.touch = this.buildTouch();
    for (const part of [this.top, this.left, this.right, this.status, this.touch]) root.appendChild(part);
    this.touchShown = Input.device === 'touch' || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    this.panelsShown = window.innerWidth >= MAPEDIT_PANEL_MIN_WIDTH && window.innerHeight >= MAPEDIT_PANEL_MIN_HEIGHT;   // a phone starts with the view free
    this.buildTop();
    this.pending = 0;
    this.redraw(MAPEDIT_PARTS_BY_CHANGE.map);
    this.buildStatus();
  },
  // A change of the model (Bus 'mapEditor.changed') marks the parts of the screen it touches; flush redraws them once per frame.
  mark(what) {
    if (!this.root) return;
    this.pending |= MAPEDIT_PARTS_BY_CHANGE[what] || 0;
    if (what === 'tool' && MapEditorTools.snapIndex !== this.shownSnap) this.pending |= MAPEDIT_PART_PROPERTIES;
  },
  flush() {
    const parts = this.pending;
    this.pending = 0;
    if (parts && this.root && this.root.isConnected) this.redraw(parts);
  },
  redraw(parts) {
    if (parts & MAPEDIT_PART_TOP) this.updateTop();
    if (parts & MAPEDIT_PART_PALETTE) this.rebuild(this.left, (panel) => this.fillPalette(panel));
    if (parts & MAPEDIT_PART_PROPERTIES) this.rebuild(this.right, (panel) => this.fillProperties(panel));
    if ((parts & MAPEDIT_PART_DIALOG) && this.dialogRefresh) this.dialogRefresh();
  },
  // The top bar keeps its buttons: only their texts and states change.
  buildTop() {
    const top = this.top, tools = MapEditorTools;
    top.appendChild(Ui.button('Menu', () => Ui.open('mapEditorMenu'), 'primary'));
    this.undoButton = Ui.button('Undo', () => tools.command('undo'));
    this.redoButton = Ui.button('Redo', () => tools.command('redo'));
    this.snapButton = Ui.button('', () => tools.command('snap'));
    this.panelsButton = Ui.button('', () => { this.panelsShown = !this.panelsShown; this.updateTop(); });
    this.touchButton = Ui.button('', () => { this.touchShown = !this.touchShown; this.updateTop(); });
    for (const button of [this.undoButton, this.redoButton, this.snapButton]) top.appendChild(button);
    top.appendChild(Ui.button('Check', () => Ui.open('mapEditorCheck')));
    top.appendChild(Ui.button('Test play', () => Ui.open('mapEditorPlay')));
    top.appendChild(this.panelsButton); top.appendChild(this.touchButton);
    this.budget = makeElement('span', 'me-budget');
    this.nameTag = makeElement('span', 'me-budget');
    top.appendChild(this.budget); top.appendChild(this.nameTag);
  },
  updateTop() {
    this.undoButton.disabled = !MapEditor.canUndo();
    this.redoButton.disabled = !MapEditor.canRedo();
    this.snapButton.textContent = 'Snap ' + MapEditorTools.snap() + ' m';
    this.panelsButton.textContent = this.panelsShown ? 'Hide panels' : 'Panels';
    this.touchButton.textContent = this.touchShown ? 'Hide buttons' : 'Touch buttons';
    const share = MapEditor.count() / MAPEDIT_BUDGET;
    this.budget.className = 'me-budget' + (share >= 1 ? ' full' : share >= MAPEDIT_BUDGET_WARNING ? ' warn' : '');
    this.budget.textContent = 'Objects ' + MapEditor.count() + ' / ' + MAPEDIT_BUDGET;
    this.nameTag.textContent = MapEditor.map.name + (MapEditor.dirty ? ' *' : '');
    this.touch.classList.toggle('show', this.touchShown);
    this.root.classList.toggle('me-nopanels', !this.panelsShown);
  },
  fillPalette(panel) {
    panel.appendChild(makeElement('div', 'ui-group', 'Tools'));
    for (const tool of MAPEDIT_TOOLS) {
      const button = Ui.button(tool.label, () => MapEditorTools.setTool(tool.id), MapEditorTools.tool === tool.id ? 'primary' : '');
      panel.appendChild(button);
    }
    this.fillToolOptions(panel);
    panel.appendChild(makeElement('div', 'ui-group', 'View'));
    const level = this.stepper('Level', this.fixed(MapEditorTools.elevation) + ' m', () => MapEditorTools.command('levelDown'), () => MapEditorTools.command('levelUp'));
    panel.appendChild(level);
    panel.appendChild(Ui.row('Zones', Ui.toggle(MapEditorTools.view.zones, (on) => { MapEditorTools.view.zones = on; MapEditor.announce('tool'); })));
    panel.appendChild(Ui.row('Triggers', Ui.toggle(MapEditorTools.view.triggers, (on) => { MapEditorTools.view.triggers = on; MapEditor.announce('tool'); })));
  },
  fillToolOptions(panel) {
    const tools = MapEditorTools, tool = tools.toolRow();
    if (tool.id === 'select') { panel.appendChild(makeElement('p', 'ui-note', 'Click an object to select it. Grab moves it, then place drops it.')); return; }
    panel.appendChild(makeElement('div', 'ui-group', tool.label));
    for (const option of tools.options()) {
      const values = option.values(), texts = option.texts ? option.texts(values) : values.map(String);
      panel.appendChild(Ui.row(option.label, Ui.cycle(values, texts, tools.stamp[option.key], (value) => tools.setOption(option.key, value))));
    }
    const size = tools.stamp.sizes[tool.id];
    if (size) ['Width', 'Height', 'Depth'].forEach((name, axis) => panel.appendChild(this.stepper(name, this.fixed(size[axis]) + ' m',
      () => tools.resizeStamp(axis, -tools.snap()), () => tools.resizeStamp(axis, tools.snap()))));
    const turn = tool.id === 'spawn' || tool.size ? 'Turn: ' + tools.turns * 90 + ' deg' : '';
    if (turn) panel.appendChild(Ui.button(turn, () => tools.command('rotate')));
  },
  fillProperties(panel) {
    const object = MapEditor.selected(), list = MapEditor.selection.list;
    this.shownSnap = MapEditorTools.snapIndex;
    if (!object) {
      panel.appendChild(makeElement('div', 'ui-group', 'Nothing selected'));
      panel.appendChild(makeElement('p', 'ui-note', MapEditor.countsText()));
      return;
    }
    panel.appendChild(makeElement('div', 'ui-group', MAPEDIT_KINDS[list].label + ' #' + MapEditor.selection.index));
    for (const field of MAPEDIT_FIELDS[list]) if (!field.show || field.show(object)) panel.appendChild(this.fieldRow(field, object));
    this.buildSizeRows(panel, list, object);
    this.buildMoveRows(panel);
    this.buildObjectButtons(panel, object);
  },
  fieldRow(field, object) {
    const edit = (change) => MapEditor.editSelected(change);
    if (field.kind === 'text') return Ui.row(field.label, this.nameInput(field.get(object), (value) => edit((copy) => field.set(copy, value))));
    if (field.kind === 'step') {
      return this.stepper(field.label, this.fixed(field.get(object)), () => edit((copy) => field.apply(copy, -field.step)), () => edit((copy) => field.apply(copy, field.step)));
    }
    const values = field.values(), texts = field.texts ? field.texts(values) : values.map(String);
    return Ui.row(field.label, Ui.cycle(values, texts, field.get(object), (value) => edit((copy) => field.set(copy, value))));
  },
  buildSizeRows(panel, list, object) {
    const step = MapEditorTools.snap();
    if (MAPEDIT_KINDS[list].box) {
      ['Width', 'Height', 'Depth'].forEach((name, axis) => panel.appendChild(this.stepper(name, this.fixed(object.max[axis] - object.min[axis]) + ' m',
        () => MapEditor.resizeSelected(axis, -step), () => MapEditor.resizeSelected(axis, step))));
    } else if (list === 'objectives' || list === 'lights') {
      panel.appendChild(this.stepper('Radius', this.fixed(object.radius) + ' m', () => MapEditor.resizeSelected(0, -step), () => MapEditor.resizeSelected(0, step)));
    }
  },
  buildMoveRows(panel) {
    const step = MapEditorTools.snap(), grid = makeElement('div', 'me-grid');
    for (const [name, dx, dy, dz] of [['West', -1, 0, 0], ['East', 1, 0, 0], ['Down', 0, -1, 0], ['Up', 0, 1, 0], ['South', 0, 0, -1], ['North', 0, 0, 1]]) {
      grid.appendChild(Ui.button(name, () => MapEditor.nudgeSelected(dx * step, dy * step, dz * step)));
    }
    panel.appendChild(makeElement('div', 'ui-group', 'Move ' + step + ' m'));
    panel.appendChild(grid);
  },
  buildObjectButtons(panel, object) {
    const grid = makeElement('div', 'me-grid');
    grid.appendChild(Ui.button('Grab', () => MapEditorTools.command('grab')));
    grid.appendChild(Ui.button('Turn', () => MapEditor.turnSelected()));
    grid.appendChild(Ui.button('Copy', () => MapEditorTools.command('duplicate')));
    grid.appendChild(Ui.button('Look at', () => MapEditorTools.focusSelected()));
    panel.appendChild(grid);
    panel.appendChild(Ui.button('Delete', () => MapEditor.deleteSelected(), 'danger'));
    if (object.kind === 'payloadPath') {
      panel.appendChild(Ui.button('Add path point at cursor', () => MapEditorTools.addPathPoint()));
      panel.appendChild(makeElement('p', 'ui-note', 'Path points: ' + object.path.length + ' (the payload needs 4 or more).'));
    }
  },
  buildStatus() {
    this.status.replaceChildren();
    this.cursorText = makeElement('b', '', '');
    this.status.appendChild(this.cursorText);
    this.status.appendChild(document.createTextNode('  ' + MAPEDIT_HELP[Input.device]));
    this.shownX = NaN;
  },
  // Cursor position, refreshed a few times a second while the screen is open.
  updateStatus(seconds) {
    this.statusTimer -= seconds;
    if (this.statusTimer > 0 || !this.cursorText || !this.cursorText.isConnected) return;
    this.statusTimer = MAPEDIT_STATUS_SECONDS;
    const cursor = MapEditorTools.cursor;
    if (cursor.valid === this.shownValid && cursor.x === this.shownX && cursor.y === this.shownY && cursor.z === this.shownZ) return;
    this.shownValid = cursor.valid; this.shownX = cursor.x; this.shownY = cursor.y; this.shownZ = cursor.z;
    this.cursorText.textContent = cursor.valid ? 'x ' + this.fixed(cursor.x) + '  y ' + this.fixed(cursor.y) + '  z ' + this.fixed(cursor.z) : 'no surface';
  },
  buildTouch() {
    const wrap = makeElement('div', 'me-touch'), moves = makeElement('div', 'me-pad me-moves'), actions = makeElement('div', 'me-pad me-acts');
    for (const [label, hold] of MAPEDIT_TOUCH_MOVES) moves.appendChild(this.holdButton(label, hold));
    for (const [label, command, style] of MAPEDIT_TOUCH_ACTIONS) actions.appendChild(Ui.button(label, () => MapEditorTools.command(command), style));
    wrap.appendChild(moves); wrap.appendChild(actions);
    return wrap;
  },
  // A button that acts while a finger is on it (fly, turn, look).
  holdButton(label, hold) {
    const button = makeElement('button', 'ui-button', label);
    button.type = 'button';
    const release = () => MapEditorTools.setHold(hold, false);
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      try { button.setPointerCapture(event.pointerId); } catch (error) { /* a pointer that is not active (synthetic event): the release events still arrive */ }
      MapEditorTools.setHold(hold, true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
    return button;
  },
};

Ui.register('mapEditor', {
  passthrough: true,
  build(root) { MapEditor.ensureMap(); MapEditorUi.build(root); },
  onOpen() {
    MapEditorTools.attach();
    MapEditorTools.menuRequest = () => Ui.open('mapEditorMenu');
  },
  onClose() {
    MapEditorTools.detach();
    MapEditorTools.menuRequest = null;
    MapEditorUi.root = null;
  },
  // Esc: let go of what is held or selected first; otherwise open the menu.
  onBack() {
    if (!MapEditorTools.command('cancel')) Ui.open('mapEditorMenu');
    return true;
  },
  // The pad drives the editor itself (MapEditorTools.readPad): the menu commands it also produces are not for the panels.
  onCommand() { return true; },
});
Bus.on('mapEditor.changed', (change) => MapEditorUi.mark(change.what));
Bus.on('input.device', () => { if (Ui.isOpen('mapEditor')) MapEditorUi.buildStatus(); });
Bus.on('boot', () => Loop.onFrame('ui', (seconds) => { if (MapEditorUi.root) { MapEditorUi.flush(); MapEditorUi.updateStatus(seconds); } }));
// The editing keys, mouse and pad act only while the editor itself is on top, not while a dialog (menu, list, confirm) is open over it.
MapEditorTools.dialogOpen = () => { const top = Ui.current(); return top !== '' && top !== 'mapEditor'; };

// ---- Test-play (MAP-014): a match on the edited map; the editor comes back when it stops ----
const MapEditorPlay = {
  returning: false,                     // a test match is running: the editor comes back when it stops
  returnDue: false,                     // a match stopped while returning: settle decides whether it was the last one
  testPlay(modeId) {
    if (!MapEditorTools.playableModes().includes(modeId)) return MapEditor.refuse('This map has no objectives or spawns for that mode.') >= 0;
    const setup = CustomMatch.setup(CustomMatch.validate({ mode: modeId }).draft, Math.floor(performance.now()) % MAPEDIT_PLAY_SEED_RANGE);
    setup.map = MapEditor.toMap();
    this.returning = true;
    MapEditorTools.detach();
    CustomMatch.start(setup);
    return true;
  },
  // 'match.stop': a restart from the pause menu stops the match and starts the next one inside Game.start, so the decision waits until that call is over.
  onMatchStop() {
    if (!this.returning) return;
    this.returnDue = true;
    queueMicrotask(() => this.settle());
  },
  // The editor comes back with its state as it was (the model never left memory), unless a new match is already running.
  settle() {
    if (!this.returnDue) return;
    this.returnDue = false;
    if (Game.match) return;
    this.returning = false;
    if (Game.headless) MapEditorTools.attach(); else Ui.open('mapEditor');
  },
};
// This listener runs after the main menu opened, so the editor ends up on top.
Bus.on('match.stop', () => MapEditorPlay.onMatchStop());

// ---- Share codes: the whole map as one line of text (copy and paste only) ----
const MapEditorShare = {
  exportCode(map) { return CustomCodec.packCode(MAPEDIT_CODE_FORMAT, MapEditor.compact(map || MapEditor.map)); },
  // text -> { map } or { error } with a message for the player. Nothing is changed.
  decodeCode(text) {
    const unpacked = CustomCodec.unpackCode(this.formatOf(text), text);
    if (unpacked.error) return unpacked;
    try {
      return MapEditor.expand(unpacked.object);
    } catch (error) {
      return { error: SHARE_CODE_UNREADABLE };
    }
  },
  // The format of a pasted text: a first-version code (CTKMAP1-...) is read with its own prefix, anything else as a current code.
  formatOf(text) { return MAPEDIT_LEGACY_CODE_FORMAT.pattern.test(CustomCodec.cleanCode(text)) ? MAPEDIT_LEGACY_CODE_FORMAT : MAPEDIT_CODE_FORMAT; },
  importCode(text) {
    const result = this.decodeCode(text);
    if (result.error) return result;
    result.map.id = MAPEDIT_DRAFT_ID;
    MapEditor.reset(result.map, '');
    return result;
  },
};

// ---- Dialog builders ----
function mapEditDialog(root, title, backTo) {
  screenHeader(root, title, backTo);
  const body = makeElement('div', 'ui-scroll');
  root.appendChild(body);
  return body;
}
const mapEditListRow = (label, buttons) => {
  const row = makeElement('div', 'ui-row');
  row.appendChild(makeElement('span', 'ui-label', label));
  for (const button of buttons) row.appendChild(button);
  return row;
};
const mapEditKilobytes = (bytes) => (bytes / 1024).toFixed(1) + ' KB';
// Closes dialogs until the editor screen is on top again.
function mapEditBackToEditor() { while (Ui.current() && Ui.current() !== 'mapEditor') Ui.pop(); }

// Saves the map; one that offers no mode yet gets the modes it is ready for, and the player is told which modes matches will not offer yet.
function mapEditSave(asNew) {
  if (!MapEditor.map.modes.length) MapEditor.setModes(MapEditor.suggestModes());
  if (!(asNew ? MapEditor.saveAsNew() : MapEditor.saveCurrent())) return false;
  Ui.toast(mapEditSavedText());
  return true;
}
function mapEditSavedText() {
  const ready = MapEditor.readyModes(MapEditor.map).length;
  if (!ready) return 'Saved. No mode is complete yet: add spawns and objectives to play it in matches.';
  return ready < MapEditor.map.modes.length ? 'Saved. Some modes still lack spawns or objectives, so matches do not offer this map for them.' : 'Saved';
}

// ---- Menu ----
Ui.register('mapEditorMenu', {
  build(root) {
    const body = mapEditDialog(root, 'Map editor');
    const items = makeElement('div', 'ui-menu');
    const add = (label, action, style) => items.appendChild(Ui.button(label, action, style));
    add('Resume editing', () => Ui.back(), 'primary');
    add('Test play', () => Ui.open('mapEditorPlay'));
    add('Tool and object options', () => Ui.open('mapEditorObject'));
    add('Check the map', () => Ui.open('mapEditorCheck'));
    add('Save', () => mapEditSave(false));
    add('Save as a new map', () => mapEditSave(true));
    add('My maps (' + MapEditor.saved().length + ' / ' + MAPEDIT_MAX_MAPS + ')', () => Ui.open('mapEditorMaps'));
    add('New map', () => Ui.open('mapEditorNew'));
    add('Map settings', () => Ui.open('mapEditorSettings'));
    add('Share code', () => Ui.open('mapEditorCode'));
    add('Exit editor', () => MapEditorUi.exit(), 'danger');
    body.appendChild(items);
    body.appendChild(makeElement('p', 'ui-note', MapEditor.map.name + (MapEditor.dirty ? ' (not saved)' : ' (saved)') + ' - ' + MapEditor.count() + ' of ' + MAPEDIT_BUDGET + ' objects.'));
  },
});

// ---- The tool options and the properties of the selection as a dialog: the pad and the keyboard reach every control here ----
Ui.register('mapEditorObject', {
  build(root) {
    const body = mapEditDialog(root, 'Tool and selection');
    const render = () => MapEditorUi.rebuild(body, (panel) => { MapEditorUi.fillToolOptions(panel); MapEditorUi.fillProperties(panel); });
    MapEditorUi.dialogRefresh = render;
    render();
  },
  onClose() { MapEditorUi.dialogRefresh = null; },
});

// ---- New map: empty, a template or a copy of a built-in map ----
Ui.register('mapEditorNew', {
  build(root) {
    const body = mapEditDialog(root, 'New map');
    const start = (source) => {
      const begin = () => { if (!MapEditor.newFrom(source).error) mapEditBackToEditor(); };
      if (MapEditor.dirty) Ui.confirm({ title: 'Discard changes?', text: 'The map has changes that were not saved.', yes: 'Discard', onYes: begin }); else begin();
    };
    body.appendChild(makeElement('div', 'ui-group', 'Start'));
    body.appendChild(Ui.button('Empty map (a floor)', () => start({ kind: 'empty' })));
    body.appendChild(makeElement('div', 'ui-group', 'Templates'));
    for (const template of MAPEDIT_TEMPLATES) body.appendChild(mapEditListRow(template.name + ' - ' + template.blurb, [Ui.button('Use', () => start({ kind: 'template', id: template.id }))]));
    body.appendChild(makeElement('div', 'ui-group', 'Copy of a built-in map'));
    for (const row of CAT.maps) body.appendChild(mapEditListRow(row.code + ' ' + row.name, [Ui.button('Copy', () => start({ kind: 'builtin', id: row.id }))]));
  },
});

// ---- My maps: open, rename, delete; shows how much space is used ----
Ui.register('mapEditorMaps', {
  build(root) {
    const body = mapEditDialog(root, 'My maps');
    const render = () => {
      body.replaceChildren();
      body.appendChild(makeElement('p', 'ui-note', MapEditor.saved().length + ' of ' + MAPEDIT_MAX_MAPS + ' maps. Saved maps use ' + mapEditKilobytes(MapEditor.usedBytes()) + '; about '
        + mapEditKilobytes(Math.max(0, MapEditor.freeBytes())) + ' are free. Saved maps with a mode also appear in Custom match.'));
      if (!MapEditor.saved().length) body.appendChild(makeElement('p', 'ui-note', 'No saved maps yet. Use Save in the menu.'));
      for (const entry of MapEditor.saved()) body.appendChild(this.row(entry, render));
    };
    render();
  },
  row(entry, render) {
    const row = makeElement('div', 'ui-row me-maprow');
    let name = entry.name;
    row.appendChild(MapEditorUi.nameInput(entry.name, (value) => { name = value; }));
    row.appendChild(makeElement('span', 'ui-tag', mapEditKilobytes(entry.bytes) + (entry.modes.length ? '' : ' - no mode')));
    row.appendChild(Ui.button('Rename', () => { MapEditor.renameSaved(entry.id, name); render(); }));
    row.appendChild(Ui.button('Open', () => {
      const open = () => { if (MapEditor.loadSaved(entry.id)) mapEditBackToEditor(); };
      if (MapEditor.dirty) Ui.confirm({ title: 'Discard changes?', text: 'The map being edited has changes that were not saved.', yes: 'Open', onYes: open }); else open();
    }, 'primary'));
    row.appendChild(Ui.button('Delete', () => Ui.confirm({ title: 'Delete ' + entry.name + '?', text: 'The saved map is removed for good.', yes: 'Delete', onYes: () => { MapEditor.deleteSaved(entry.id); render(); } }), 'danger'));
    return row;
  },
});

// ---- Validation: the list of problems; each one jumps to the object ----
Ui.register('mapEditorCheck', {
  build(root) {
    const body = mapEditDialog(root, 'Check the map');
    const render = () => {
      body.replaceChildren();
      const problems = MapEditor.validate();
      body.appendChild(makeElement('p', 'ui-note', problems.length ? problems.length + ' problem(s). Tap one to look at it.' : 'No problems: the map passes every rule.'));
      for (const problem of problems) body.appendChild(this.problemButton(problem));
      const foot = makeElement('div', 'ui-foot');
      foot.appendChild(Ui.button('Check again', render));
      foot.appendChild(Ui.button('Add callout zones', () => { Ui.toast(MapEditor.addZoneGrid() + ' zones added'); render(); }));
      foot.appendChild(Ui.button('Add lights', () => { Ui.toast(MapEditor.addZoneLights() + ' lights added'); render(); }));
      foot.appendChild(Ui.button('Suggest modes', () => { MapEditor.setModes(MapEditor.suggestModes()); Ui.toast('Modes: ' + (MapEditor.map.modes.join(', ') || 'none')); render(); }));
      body.appendChild(foot);
    };
    body.appendChild(makeElement('p', 'ui-note', 'Checking the map...'));
    setTimeout(() => { if (body.isConnected) render(); }, 0);    // the screen opens first (UI-001): the check can take a second on a slow phone
  },
  problemButton(problem) {
    const button = Ui.button(problem, () => {
      const target = MapEditor.locate(problem);
      if (!target) { Ui.toast('This problem has no place on the map'); return; }
      mapEditBackToEditor();
      if (target.list) MapEditor.select(target.list, target.index);
      MapEditorTools.focusOn(target.x, target.y, target.z);
    }, 'me-problem');
    return button;
  },
});

// ---- Share codes ----
Ui.register('mapEditorCode', {
  build(root) {
    const body = mapEditDialog(root, 'Share code');
    body.appendChild(makeElement('p', 'ui-note', 'Make a code to copy and send, or paste a code you received and press Import. The code holds the whole map.'));
    const area = makeElement('textarea', 'ui-code');
    area.spellcheck = false;
    const message = makeElement('p', 'ui-note', '');
    const foot = makeElement('div', 'ui-foot');
    foot.appendChild(Ui.button('Make code', () => { area.value = MapEditorShare.exportCode(); message.textContent = area.value.length + ' characters. Select all and copy.'; area.select(); }));
    foot.appendChild(Ui.button('Import', () => {
      const run = () => {
        const result = MapEditorShare.importCode(area.value);
        message.textContent = result.error || '';
        message.className = result.error ? 'ui-note me-error' : 'ui-note';
        if (!result.error) mapEditBackToEditor();
      };
      if (MapEditor.dirty) Ui.confirm({ title: 'Replace the map?', text: 'The map being edited has changes that were not saved.', yes: 'Import', onYes: run }); else run();
    }, 'primary'));
    body.appendChild(area); body.appendChild(message); body.appendChild(foot);
  },
});

// ---- Test-play: modes the map has objectives for ----
Ui.register('mapEditorPlay', {
  build(root) {
    const body = mapEditDialog(root, 'Test play');
    const modes = MapEditorTools.playableModes();
    body.appendChild(makeElement('p', 'ui-note', modes.length ? 'Pick a mode. You play against bots on this map and come back here when you quit.'
      : 'This map needs spawns first (and the objectives of the mode: flags, points, bomb sites...).'));
    for (const mode of modes) body.appendChild(Ui.button(CAT.modes.byId(mode).name, () => MapEditorPlay.testPlay(mode)));
  },
});

// ---- Map settings ----
// The usual sizes, plus the map's own when it is another one (a copy of a built-in map), so a row never shows a size the map does not have.
const mapEditChoices = (list, current) => (list.includes(current) ? list : list.concat(current).sort((a, b) => a - b));
function mapEditSizeRow(label, axis, usual) {
  const values = mapEditChoices(usual, MapEditor.map.size[axis]);
  return Ui.row(label, Ui.cycle(values, values.map((n) => n + ' m'), MapEditor.map.size[axis], (value) => {
    const size = MapEditor.map.size.slice();
    size[axis] = value;
    MapEditor.setSize(size[0], size[1], size[2]);
  }));
}
Ui.register('mapEditorSettings', {
  build(root) {
    const body = mapEditDialog(root, 'Map settings');
    const map = MapEditor.map, themes = MapRules.themes.map((id) => CAT.themes.byId(id).name);
    body.appendChild(Ui.row('Name', MapEditorUi.nameInput(map.name, (value) => MapEditor.rename(value))));
    body.appendChild(Ui.row('Theme', Ui.cycle(MapRules.themes, themes, map.theme, (value) => MapEditor.setTheme(value))));
    body.appendChild(mapEditSizeRow('Width', 0, MAPEDIT_SIZES));
    body.appendChild(mapEditSizeRow('Depth', 2, MAPEDIT_SIZES));
    body.appendChild(mapEditSizeRow('Height', 1, MAPEDIT_HEIGHTS));
    const categories = Object.keys(MapRules.sightLimits);
    body.appendChild(Ui.row('Sightline class', Ui.cycle(categories, categories, map.category, (value) => MapEditor.setCategory(value))));
    body.appendChild(Ui.row('Modes', Ui.button(map.modes.length + ' chosen', () => Ui.open('mapEditorModes'))));
  },
});

Ui.register('mapEditorModes', {
  build(root) {
    const body = mapEditDialog(root, 'Modes of this map');
    body.appendChild(makeElement('p', 'ui-note', 'The modes the map is offered for. A mode that still lacks something is listed under its name; the check finds the same gaps.'));
    const map = MapEditor.toMap();
    for (const mode of Object.keys(MapRules.modes)) {
      if (!CAT.modes.byId(mode)) continue;
      const needs = MapEditor.modeNeeds(map, mode), label = CAT.modes.byId(mode).name + (needs ? ' - needs ' + needs : '');
      body.appendChild(Ui.row(label, Ui.toggle(MapEditor.map.modes.includes(mode), (on) => {
        const modes = MapEditor.map.modes.filter((id) => id !== mode);
        MapEditor.setModes(on ? modes.concat(mode) : modes);
      })));
    }
  },
});

Bus.on('boot', () => injectStyle('mapEditor-style', MAPEDIT_CSS));
